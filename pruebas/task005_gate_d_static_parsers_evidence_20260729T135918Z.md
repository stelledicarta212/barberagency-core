# TASK-005 Gate D Static Parsers Evidence

```text
TASK = TASK_005_GATE_D_CONTROLLED_EXECUTION
GATE_D_SCOPE = STATIC_PARSER_TEST_ONLY
EVIDENCE_CREATED_AT_UTC = 2026-07-29T13:59:20.2346868Z
CURRENT_BRANCH = agent/task-005-sixth-documentary-correction
HEAD_AT_EXECUTION = 2ce67480d4bbcb6f239b843dfb9007649ba2e7e9
UPSTREAM = origin/agent/task-005-sixth-documentary-correction
SCRIPT = backup_production_database.ps1
SCRIPT_SHA256 = 6417A81228196D7D7142BDBA9CCE646764EF6082E1DB25B265A8353E5E9CEDA3
SCRIPT_SIZE_BYTES = 209946
SCRIPT_LINE_COUNT = 3327
IDENTITY_SOURCE_COMMIT = e343d397a37733b1a6373abe92c3f55d91b2221c
EXACT_COMMAND = powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\backup_production_database.ps1 -TestStaticParsersOnly
EXECUTION_COUNT = 1
START_TIME_UTC = 2026-07-29T13:59:18.8938529Z
END_TIME_UTC = 2026-07-29T13:59:20.2346868Z
DURATION_SECONDS = 1.341
EXIT_CODE = 0
STATIC_TESTS_TOTAL = 1
STATIC_TESTS_PASSED = 1
STATIC_TESTS_FAILED = 0
STDERR = EMPTY
SENSITIVE_OUTPUT_DETECTED = NO
BACKUP_EXECUTED = NO
RESTORE_EXECUTED = NO
DOCKER_EXECUTED = NO
SQL_EXECUTED = NO
PRODUCTION_ACCESSED = NO
EASYPANEL_ACCESSED = NO
POSTGRESQL_EXTERNAL_ACCESSED = NO
R2_ACCESSED = NO
N8N_EXTERNAL_ACCESSED = NO
MERCADOPAGO_ACCESSED = NO
ENV_FILES_READ = NO
SECRETS_READ = NO
GATE_D_RESULT = PASSED
GATE_D_STATUS = CLOSED
B8_DEFINITION_STATUS = NOT_DEFINED
B8_AUTHORIZED = NO
B8_EXECUTED = NO
```

## Static mode inspection

Read-only inspection before execution confirmed that `backup_production_database.ps1` evaluates `if ($TestStaticParsersOnly)` before the operational backup block. In that branch it calls `Test-StaticParsers` and exits with `0` or `1`; the normal backup route starts only after that branch.

## Captured output

```text
START_TIME=2026-07-29T13:59:18.8938529Z
EXACT_COMMAND=powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\backup_production_database.ps1 -TestStaticParsersOnly
Iniciando pruebas estaticas de parsers y comparadores...
Todas las pruebas estaticas completadas exitosamente.
END_TIME=2026-07-29T13:59:20.2346868Z
DURATION_SECONDS=1.341
EXIT_CODE=0
```

## Result

Gate D static parser validation passed in one authorized local execution. No backup, restore, Docker, SQL, production, EasyPanel, PostgreSQL externo, R2, n8n externo, Mercado Pago, `.env` or secrets were accessed.
