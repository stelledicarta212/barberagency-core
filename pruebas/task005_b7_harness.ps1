# pruebas/task005_b7_harness.ps1
# Harness script for TASK-005 B7 controlled validation of PostgreSQL privileges (R, S, T, U, V)

$containerName = "task005_b7_tmp_local_only_disposable"
$dbName = "task005_b7_tmp_db"
$adminUser = "task005_b7_tmp_admin"
$adminPassword = "disposable_temp_password_123!"

# 1. Spin up container
Write-Output "Spinning up Docker container for B7..."
$dockerRun = docker run --name $containerName -e POSTGRES_USER=$adminUser -e POSTGRES_PASSWORD=$adminPassword -e POSTGRES_DB=$dbName -d postgres:16
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to start Docker container."
    exit 1
}

# Cleanup helper
function Invoke-Cleanup {
    Write-Output "Cleaning up B7 container $containerName..."
    docker rm -f $containerName | Out-Null
}

try {
    # 2. Wait for Postgres to be ready
    Write-Output "Waiting for database to accept connections..."
    $retries = 30
    $ready = $false
    while ($retries -gt 0 -and -not $ready) {
        docker exec $containerName pg_isready -U $adminUser -d $dbName > $null 2>&1
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
        } else {
            Start-Sleep -Seconds 1
            $retries--
        }
    }

    if (-not $ready) {
        throw "Database failed to become ready in time."
    }

    # Retrieve real PG version
    $pgVersion = ($adminPassword | docker exec -i $containerName psql -U $adminUser -d $dbName -t -A -c "SELECT version();").Trim()
    Write-Output "PostgreSQL Version: $pgVersion"

    # Precheck Identity
    Write-Output "Checking blocklist and identity..."
    $dbList = "SELECT datname FROM pg_database;" | docker exec -i $containerName psql -U $adminUser -d $dbName -t -A
    foreach ($db in ($dbList -split "`r`n")) {
        $dbTrimmed = $db.Trim()
        if ($dbTrimmed.Length -gt 0 -and ($dbTrimmed -match "barberagency" -or $dbTrimmed -match "production" -or $dbTrimmed -match "prod" -or $dbTrimmed -match "easypanel")) {
            throw "BLOCKED_ENVIRONMENT_IDENTITY_MISMATCH: Database name '$dbTrimmed' violates blocklist."
        }
    }
    Write-Output "ENVIRONMENT_CLASSIFICATION = LOCAL_DOCKER_TEMPORARY"

    # Create synthetic schemas, roles and functions
    Write-Output "`n--- Creating Synthetic Objects in PostgreSQL ---"
    "CREATE SCHEMA task005_b7_schema;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    "CREATE ROLE task005_b7_val_role WITH NOLOGIN;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    "CREATE ROLE task005_b7_session_role WITH LOGIN PASSWORD 's_pwd';" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    "CREATE TABLE task005_b7_schema.task005_b7_table (id int, val text);" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    
    # Create functions: one regular, one security definer
    "CREATE FUNCTION task005_b7_schema.task005_b7_func_reg() RETURNS int LANGUAGE plpgsql AS 'BEGIN RETURN 1; END';" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    "CREATE FUNCTION task005_b7_schema.task005_b7_func_secdef() RETURNS int SECURITY DEFINER LANGUAGE plpgsql AS 'BEGIN RETURN 2; END';" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    
    # Revoke default EXECUTE from PUBLIC on both functions
    "REVOKE EXECUTE ON FUNCTION task005_b7_schema.task005_b7_func_reg() FROM PUBLIC;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    "REVOKE EXECUTE ON FUNCTION task005_b7_schema.task005_b7_func_secdef() FROM PUBLIC;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null

    # Grant select/usage to validation role
    "GRANT USAGE ON SCHEMA task005_b7_schema TO task005_b7_val_role;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    "GRANT SELECT ON TABLE task005_b7_schema.task005_b7_table TO task005_b7_val_role;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null

    # Helper function to run query and check for expected error
    function Test-AclQuery {
        param([string]$sql, [string]$expectedError)
        $output = $sql | docker exec -i $containerName psql -U $adminUser -d $dbName 2>&1 | Out-String
        $matched = $output -match $expectedError
        return [ordered]@{
            matched = $matched
            output = $output.Trim()
        }
    }

    # ==========================================
    # ITEM R: EXECUTE fuera de allowlist
    # ==========================================
    Write-Output "`n--- Testing Item R (EXECUTE Allowlist) ---"
    "GRANT EXECUTE ON FUNCTION task005_b7_schema.task005_b7_func_reg() TO task005_b7_val_role;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    
    $checkR_sql = @'
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON n.oid = p.pronamespace 
            WHERE n.nspname = 'task005_b7_schema'
              AND has_function_privilege('task005_b7_val_role', p.oid, 'EXECUTE')
        ) THEN
            RAISE EXCEPTION 'database_acl_policy_execute_privilege';
        END IF;
    END $$;
'@
    $resR = Test-AclQuery -sql $checkR_sql -expectedError "database_acl_policy_execute_privilege"
    Write-Output "Item R Negative Test: matched=$($resR.matched) / output=$($resR.output)"
    
    "REVOKE EXECUTE ON FUNCTION task005_b7_schema.task005_b7_func_reg() FROM task005_b7_val_role;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    $resR_pos = Test-AclQuery -sql $checkR_sql -expectedError "database_acl_policy_execute_privilege"
    Write-Output "Item R Positive Test: matched=$($resR_pos.matched) (should be False) / output=$($resR_pos.output)"

    # ==========================================
    # ITEM S: SECURITY DEFINER accesible
    # ==========================================
    Write-Output "`n--- Testing Item S (SECURITY DEFINER) ---"
    # To test Item S negative case, we grant execute to PUBLIC again on the secdef function
    "GRANT EXECUTE ON FUNCTION task005_b7_schema.task005_b7_func_secdef() TO PUBLIC;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    
    $checkS_sql = @'
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON n.oid = p.pronamespace 
            WHERE n.nspname = 'task005_b7_schema'
              AND p.prosecdef = true
              AND has_function_privilege('public', p.oid, 'EXECUTE')
        ) THEN
            RAISE EXCEPTION 'database_acl_policy_execute_privilege:security_definer_accessible_to_public';
        END IF;
    END $$;
'@
    $resS = Test-AclQuery -sql $checkS_sql -expectedError "database_acl_policy_execute_privilege"
    Write-Output "Item S Negative Test: matched=$($resS.matched) / output=$($resS.output)"
    
    "REVOKE EXECUTE ON FUNCTION task005_b7_schema.task005_b7_func_secdef() FROM PUBLIC;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    $resS_pos = Test-AclQuery -sql $checkS_sql -expectedError "database_acl_policy_execute_privilege"
    Write-Output "Item S Positive Test: matched=$($resS_pos.matched) (should be False) / output=$($resS_pos.output)"

    # ==========================================
    # ITEM T: escritura inesperada
    # ==========================================
    Write-Output "`n--- Testing Item T (Write Privileges) ---"
    "GRANT INSERT ON TABLE task005_b7_schema.task005_b7_table TO task005_b7_val_role;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    
    $checkT_sql = @'
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.role_table_grants 
            WHERE grantee = 'task005_b7_val_role' 
              AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
        ) THEN
            RAISE EXCEPTION 'database_acl_policy_write_privilege';
        END IF;
    END $$;
'@
    $resT = Test-AclQuery -sql $checkT_sql -expectedError "database_acl_policy_write_privilege"
    Write-Output "Item T Negative Test: matched=$($resT.matched) / output=$($resT.output)"

    "REVOKE INSERT ON TABLE task005_b7_schema.task005_b7_table FROM task005_b7_val_role;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    $resT_pos = Test-AclQuery -sql $checkT_sql -expectedError "database_acl_policy_write_privilege"
    Write-Output "Item T Positive Test: matched=$($resT_pos.matched) (should be False) / output=$($resT_pos.output)"

    # ==========================================
    # ITEM U: privilegio PUBLIC con ACL NULL
    # ==========================================
    Write-Output "`n--- Testing Item U (PUBLIC privileges) ---"
    $checkU_sql = @'
    DO $$
    BEGIN
        IF has_database_privilege('public', current_database(), 'CONNECT') THEN
            RAISE EXCEPTION 'database_acl_policy_public_privilege';
        END IF;
    END $$;
'@
    $resU = Test-AclQuery -sql $checkU_sql -expectedError "database_acl_policy_public_privilege"
    Write-Output "Item U Negative Test: matched=$($resU.matched) / output=$($resU.output)"

    "REVOKE CONNECT ON DATABASE $dbName FROM PUBLIC;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    $resU_pos = Test-AclQuery -sql $checkU_sql -expectedError "database_acl_policy_public_privilege"
    Write-Output "Item U Positive Test: matched=$($resU_pos.matched) (should be False) / output=$($resU_pos.output)"

    # ==========================================
    # ITEM V: error antes de COMMIT exige rollback
    # ==========================================
    Write-Output "`n--- Testing Item V (Rollback on Error) ---"
    "CREATE TABLE task005_b7_schema.task005_b7_persist (id int);" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    
    $checkV_sql = @'
    BEGIN;
    INSERT INTO task005_b7_schema.task005_b7_persist VALUES (42);
    RAISE EXCEPTION 'database_acl_policy_transaction_failed';
    COMMIT;
'@
    $resV = Test-AclQuery -sql $checkV_sql -expectedError "database_acl_policy_transaction_failed"
    
    $persistedCount = ("SELECT COUNT(*) FROM task005_b7_schema.task005_b7_persist;" | docker exec -i $containerName psql -U $adminUser -d $dbName -t -A).Trim()
    Write-Output "Persisted rows count (expected 0): $persistedCount"
    
    if ($persistedCount -eq 0) {
        Write-Output "RESULT V: Rollback verified. Transaction failed successfully without persisting changes."
    } else {
        throw "Item V failed: rows persisted after exception!"
    }

} finally {
    Invoke-Cleanup
}
