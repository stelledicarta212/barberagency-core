param(
    [int]$runSequence = 1
)

$runId = [Guid]::NewGuid().ToString()
$startedAtUtc = [DateTime]::UtcNow.ToString("o")

# Generate synthetic password dynamically (ephemeral and random)
$adminPassword = [Guid]::NewGuid().ToString("N")
$sessionPassword = [Guid]::NewGuid().ToString("N")
$containerName = "task005_b7_second_correction_tmp_local_only_disposable"
$dbName = "task005_b7_tmp_db"
$adminUser = "task005_b7_tmp_admin"

$script:globalFail = $false

Write-Output "RUN_SEQUENCE: $runSequence"
Write-Output "RUN_ID: $runId"
Write-Output "RUN_STARTED_AT_UTC: $startedAtUtc"

# Helper for assertions
function Assert-TestCase {
    param(
        [string]$testName,
        $expected,
        $actual,
        [string]$message,
        [bool]$deliberateMismatch = $false
    )
    $pass = ($expected -eq $actual)
    if ($deliberateMismatch) {
        # Deliberate mismatch verification (testing the assertion mechanism itself)
        $pass = ($expected -ne $actual)
    }

    Write-Output "TEST_CASE: $testName"
    Write-Output "EXPECTED: $expected"
    Write-Output "ACTUAL: $actual"
    Write-Output "ASSERTION: $message"
    if ($pass) {
        Write-Output "PASS/FAIL: PASS"
        Write-Output "EXIT_CODE: 0`n"
    } else {
        Write-Output "PASS/FAIL: FAIL"
        Write-Output "EXIT_CODE: 1`n"
        if (-not $deliberateMismatch) {
            $script:globalFail = $true
        }
    }
}

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
    if ($LASTEXITCODE -eq 0) {
        Write-Output "CLEANUP_STATUS: SUCCESS"
    } else {
        Write-Output "CLEANUP_STATUS: FAILED"
    }
}

try {
    # 2. Wait for Postgres to be ready
    Write-Output "Waiting for database to accept connections..."
    $retries = 30
    $ready = $false
    while ($retries -gt 0 -and -not $ready) {
        $check = "SELECT 1;" | docker exec -i $containerName psql -U $adminUser -d $dbName 2>&1
        if ($LASTEXITCODE -eq 0 -and $check -match "1") {
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
    $pgVersion = ("SELECT version();" | docker exec -i $containerName psql -U $adminUser -d $dbName -t -A).Trim()
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
    Write-Output "PORTS_PUBLISHED = NO"
    Write-Output "PROJECT_MOUNTS = NO"
    Write-Output "REAL_CREDENTIALS = NO"
    Write-Output "REAL_DATA = NO"
    Write-Output "EXTERNAL_POSTGRESQL = NO"

    # Create synthetic schemas, roles and functions
    Write-Output "`n--- Creating Synthetic Objects in PostgreSQL ---"
    "CREATE SCHEMA task005_b7_schema;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    "CREATE ROLE task005_b7_val_role WITH NOLOGIN;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    "CREATE ROLE task005_b7_session_role WITH LOGIN PASSWORD '$sessionPassword';" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
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
            exit_code = $LASTEXITCODE
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
    $resR_neg = Test-AclQuery -sql $checkR_sql -expectedError "database_acl_policy_execute_privilege"
    Assert-TestCase -testName "Item_R_Negative" -expected $true -actual $resR_neg.matched -message "Must detect unauthorized EXECUTE privilege"

    "REVOKE EXECUTE ON FUNCTION task005_b7_schema.task005_b7_func_reg() FROM task005_b7_val_role;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    $resR_pos = Test-AclQuery -sql $checkR_sql -expectedError "database_acl_policy_execute_privilege"
    Assert-TestCase -testName "Item_R_Positive" -expected $false -actual $resR_pos.matched -message "Must pass when EXECUTE privilege is revoked"

    # ==========================================
    # ITEM S: SECURITY DEFINER accesible
    # ==========================================
    Write-Output "`n--- Testing Item S (SECURITY DEFINER) ---"
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
    $resS_neg = Test-AclQuery -sql $checkS_sql -expectedError "database_acl_policy_execute_privilege"
    Assert-TestCase -testName "Item_S_Negative" -expected $true -actual $resS_neg.matched -message "Must detect SECURITY DEFINER executable by PUBLIC"

    "REVOKE EXECUTE ON FUNCTION task005_b7_schema.task005_b7_func_secdef() FROM PUBLIC;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    $resS_pos = Test-AclQuery -sql $checkS_sql -expectedError "database_acl_policy_execute_privilege"
    Assert-TestCase -testName "Item_S_Positive" -expected $false -actual $resS_pos.matched -message "Must pass when SECURITY DEFINER is restricted"

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
    $resT_neg = Test-AclQuery -sql $checkT_sql -expectedError "database_acl_policy_write_privilege"
    Assert-TestCase -testName "Item_T_Negative" -expected $true -actual $resT_neg.matched -message "Must detect unauthorized table write privileges"

    "REVOKE INSERT ON TABLE task005_b7_schema.task005_b7_table FROM task005_b7_val_role;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    $resT_pos = Test-AclQuery -sql $checkT_sql -expectedError "database_acl_policy_write_privilege"
    Assert-TestCase -testName "Item_T_Positive" -expected $false -actual $resT_pos.matched -message "Must pass when write privileges are absent"

    # ==========================================
    # ITEM U: privilegio PUBLIC con ACL NULL
    # ==========================================
    Write-Output "`n--- Testing Item U (PUBLIC privileges via acldefault/aclexplode) ---"
    # Create a new function that inherits default privileges (null proacl) so PUBLIC has EXECUTE privilege by default
    "CREATE FUNCTION task005_b7_schema.task005_b7_func_def_null() RETURNS int LANGUAGE plpgsql AS 'BEGIN RETURN 3; END';" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null

    # The SQL policy checks specifically for function default execution privileges to PUBLIC using acldefault/aclexplode
    $checkU_sql = @'
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) ae
            WHERE n.nspname = 'task005_b7_schema'
              AND p.proname = 'task005_b7_func_def_null'
              AND ae.grantee = 0
              AND ae.privilege_type = 'EXECUTE'
        ) THEN
            RAISE EXCEPTION 'database_acl_policy_public_privilege';
        END IF;
    END $$;
'@
    $resU_neg = Test-AclQuery -sql $checkU_sql -expectedError "database_acl_policy_public_privilege"
    Assert-TestCase -testName "Item_U_Negative" -expected $true -actual $resU_neg.matched -message "Must detect default EXECUTE to PUBLIC on null proacl function"

    # Revoke default privilege to populate proacl (non-null) and restrict PUBLIC
    "REVOKE EXECUTE ON FUNCTION task005_b7_schema.task005_b7_func_def_null() FROM PUBLIC;" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    $resU_pos = Test-AclQuery -sql $checkU_sql -expectedError "database_acl_policy_public_privilege"
    Assert-TestCase -testName "Item_U_Positive" -expected $false -actual $resU_pos.matched -message "Must pass when default public EXECUTE is revoked (proacl non-null)"

    # ==========================================
    # ITEM V: error antes de COMMIT exige rollback
    # ==========================================
    Write-Output "`n--- Testing Item V (Rollback on Error) ---"
    "CREATE TABLE task005_b7_schema.task005_b7_persist (id int);" | docker exec -i $containerName psql -U $adminUser -d $dbName | Out-Null
    
    # We execute a transaction that inserts, then raises exception.
    # We check that the exception raised is precisely "database_acl_policy_transaction_failed".
    $checkV_sql = @'
    BEGIN;
    INSERT INTO task005_b7_schema.task005_b7_persist VALUES (42);
    RAISE EXCEPTION 'database_acl_policy_transaction_failed';
    INSERT INTO task005_b7_schema.task005_b7_persist VALUES (99); -- Surface posterior, should not execute
    COMMIT;
'@
    $resV_neg = Test-AclQuery -sql $checkV_sql -expectedError "database_acl_policy_transaction_failed"
    Assert-TestCase -testName "Item_V_Negative" -expected $true -actual $resV_neg.matched -message "Must catch precise transaction failed exception"

    # Confirm rollback occurred: no rows exist in table
    $persistedCount = ("SELECT COUNT(*) FROM task005_b7_schema.task005_b7_persist;" | docker exec -i $containerName psql -U $adminUser -d $dbName -t -A).Trim()
    Assert-TestCase -testName "Item_V_Rollback" -expected "0" -actual $persistedCount -message "Transaction changes must be rolled back on error"

    # Positive test: successful insert/commit transaction
    $checkV_pos_sql = @'
    BEGIN;
    INSERT INTO task005_b7_schema.task005_b7_persist VALUES (100);
    COMMIT;
'@
    $resV_pos = Test-AclQuery -sql $checkV_pos_sql -expectedError "database_acl_policy_transaction_failed"
    Assert-TestCase -testName "Item_V_Positive" -expected $false -actual $resV_pos.matched -message "Must succeed and commit when no exception is raised"

    $persistedCountPos = ("SELECT COUNT(*) FROM task005_b7_schema.task005_b7_persist;" | docker exec -i $containerName psql -U $adminUser -d $dbName -t -A).Trim()
    Assert-TestCase -testName "Item_V_Persist" -expected "1" -actual $persistedCountPos -message "Succeeded transaction must persist changes"

    # Negative test of assertion mechanism itself (deliberate mismatch test)
    Write-Output "--- Testing Assertion Mechanism Mismatch Check ---"
    Write-Output "DELIBERATE_MISMATCH = YES"
    Write-Output "EXPECTED_ASSERTION_FAILURE = YES"
    $resV_mismatch = Test-AclQuery -sql $checkV_sql -expectedError "unrelated_syntax_error"
    if ($resV_mismatch.matched -eq $false) {
        Write-Output "OBSERVED_ASSERTION_FAILURE = YES"
        Write-Output "MISMATCH_TEST_RESULT = PASS"
        Write-Output "TEST_CASE: Item_V_Negative_Harness_Mismatch"
        Write-Output "EXPECTED: True"
        Write-Output "ACTUAL: True"
        Write-Output "ASSERTION: Harness must detect unmatched exception"
        Write-Output "PASS/FAIL: PASS"
        Write-Output "EXIT_CODE: 0`n"
    } else {
        Write-Output "OBSERVED_ASSERTION_FAILURE = NO"
        Write-Output "MISMATCH_TEST_RESULT = FAIL"
        Write-Output "TEST_CASE: Item_V_Negative_Harness_Mismatch"
        Write-Output "EXPECTED: True"
        Write-Output "ACTUAL: False"
        Write-Output "ASSERTION: Harness must detect unmatched exception"
        Write-Output "PASS/FAIL: FAIL"
        Write-Output "EXIT_CODE: 1`n"
        $script:globalFail = $true
    }

} finally {
    Invoke-Cleanup
    $finishedAtUtc = [DateTime]::UtcNow.ToString("o")
    Write-Output "RUN_FINISHED_AT_UTC: $finishedAtUtc"
}

if ($script:globalFail) {
    Write-Output "Harness result: FAIL"
    Write-Output "HARNESS_GLOBAL_EXIT_CODE: 1"
    exit 1
} else {
    Write-Output "Harness result: PASS"
    Write-Output "HARNESS_GLOBAL_EXIT_CODE: 0"
    exit 0
}
