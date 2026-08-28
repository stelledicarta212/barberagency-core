# Gate 006-E — Secure local credentials setup TEMPLATE

TEMPLATE_ONLY = YES
CONTAINS_REAL_SECRETS = NO
DO_NOT_COMMIT_REAL_VALUES = YES
DO_NOT_PASTE_SECRETS_IN_CHAT = YES
DO_NOT_USE_REPOSITORY_ENV_FILES = YES

## 1. Purpose

This template defines the local, temporary, non-versioned credential mechanism for a future separately authorized Gate 006-E PF-05 to PF-08 precheck.

It does not authorize:

- Running the precheck.
- Accessing production.
- Accessing R2.
- Running SQL.
- Running `backup_production_database.ps1`.
- Creating or verifying a backup.

## 2. Credential placeholders

Use only secure local entry outside the repository. Replace these placeholders only inside the future authorized local shell session, never in this file:

```text
POSTGRES_TEMP_CREDENTIAL = <PROVIDE_USING_SECURE_LOCAL_CHANNEL>
POSTGRES_TEMP_HOST = <PROVIDE_USING_SECURE_LOCAL_CHANNEL>
POSTGRES_TEMP_PORT = <PROVIDE_USING_SECURE_LOCAL_CHANNEL>
POSTGRES_TEMP_DATABASE = <PROVIDE_USING_SECURE_LOCAL_CHANNEL>
POSTGRES_TEMP_USER = <PROVIDE_USING_SECURE_LOCAL_CHANNEL>
POSTGRES_TEMP_PASSWORD = <PROVIDE_USING_SECURE_LOCAL_CHANNEL>

R2_TEMP_ACCESS_KEY = <PROVIDE_USING_SECURE_LOCAL_CHANNEL>
R2_TEMP_SECRET_KEY = <PROVIDE_USING_SECURE_LOCAL_CHANNEL>
R2_TEMP_SESSION_TOKEN = <PROVIDE_USING_SECURE_LOCAL_CHANNEL_OR_NOT_APPLICABLE>
R2_TEMP_ENDPOINT = <PROVIDE_USING_SECURE_LOCAL_CHANNEL>
R2_TEMP_BUCKET = <PROVIDE_USING_SECURE_LOCAL_CHANNEL>
R2_TEMP_PREFIX = <PROVIDE_USING_SECURE_LOCAL_CHANNEL>
```

## 3. Future PowerShell session-only variable model

In the future authorized precheck task, set variables only in the current PowerShell process or session. Do not write them to profile scripts, `.env` files, Git-tracked files, shell history, task logs, or evidence files.

Expected future variable names:

```text
PGHOST
PGPORT
PGDATABASE
PGUSER
PGPASSWORD
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN
R2_ENDPOINT
R2_BUCKET
R2_PREFIX
```

`AWS_SESSION_TOKEN` may be absent only if the temporary R2 credential mechanism does not issue one.

## 4. Presence check pattern

Future checks must confirm only presence/absence, never values:

```powershell
Test-Path Env:\PGHOST
Test-Path Env:\PGPORT
Test-Path Env:\PGDATABASE
Test-Path Env:\PGUSER
Test-Path Env:\PGPASSWORD
Test-Path Env:\AWS_ACCESS_KEY_ID
Test-Path Env:\AWS_SECRET_ACCESS_KEY
Test-Path Env:\R2_ENDPOINT
Test-Path Env:\R2_BUCKET
Test-Path Env:\R2_PREFIX
```

Do not run `set`, `env`, `printenv`, broad `Get-ChildItem Env:`, or any equivalent command that prints values.

## 5. Cleanup pattern

Future cleanup must remove the temporary variables from the local session and verify absence without printing values:

```powershell
Remove-Item Env:\PGHOST -ErrorAction SilentlyContinue
Remove-Item Env:\PGPORT -ErrorAction SilentlyContinue
Remove-Item Env:\PGDATABASE -ErrorAction SilentlyContinue
Remove-Item Env:\PGUSER -ErrorAction SilentlyContinue
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\AWS_ACCESS_KEY_ID -ErrorAction SilentlyContinue
Remove-Item Env:\AWS_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
Remove-Item Env:\AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:\R2_ENDPOINT -ErrorAction SilentlyContinue
Remove-Item Env:\R2_BUCKET -ErrorAction SilentlyContinue
Remove-Item Env:\R2_PREFIX -ErrorAction SilentlyContinue
```

Then verify absence with `Test-Path Env:\<NAME>` only.

## 6. Owner responsibilities outside this task

PostgreSQL temporary credential must be:

- Temporary.
- Read-only.
- Limited to the correct production database.
- Without DDL permissions.
- Without DML permissions.
- Without role creation or permission management.
- Without configuration changes.
- Revocable or expiring after the future precheck window.

R2 temporary credential must be:

- Temporary.
- Limited to the correct bucket and prefix.
- Read/list/metadata/HEAD only.
- No PUT.
- No POST.
- No DELETE.
- No COPY.
- No multipart upload.
- No bucket or lifecycle configuration changes.
- Revocable or expiring after the future precheck window.

## 7. Git exclusion rule

This template contains no secrets and is intentionally versioned. Any future file containing real credential values is prohibited and must not be created in the repository.
