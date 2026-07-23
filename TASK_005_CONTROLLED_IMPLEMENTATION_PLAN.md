# TASK_005_CONTROLLED_IMPLEMENTATION_PLAN

```text
DOCUMENT_STATUS = PROPOSED_PENDING_INDEPENDENT_REVIEW
IMPLEMENTATION_AUTHORIZED = NO
EXECUTION_AUTHORIZED = NO
SOURCE_DOCUMENT = TASK_005_PRE_EXECUTION_REVIEW_V17.md
SOURCE_APPROVED_COMMIT = 1c58f1ac3e3a41fba2c5ebff0c62ed17193eded7
CANONICAL_ROLE_STRATEGY = SESSION_ROLE_WITH_EFFECTIVE_PRIVILEGE_ASSERTIONS
```

Este documento prepara una futura implementacion controlada de TASK_005. No implementa cambios, no modifica `backup_production_database.ps1`, no ejecuta pruebas tecnicas, no accede a PostgreSQL, no accede a produccion, no realiza backups/restauraciones, no usa Docker/SSH/R2 y no autoriza Stage 2.

## 1. Proposito y alcance

El proposito es definir un plan documental para una implementacion futura, revisable y auditable de la politica controlada de validacion de `DATABASE ACL` derivada de la septima correccion documental aprobada.

Alcance permitido de este plan:

- describir cambios futuros propuestos;
- definir gates, evidencias, rollback y condiciones de detencion;
- clasificar fixtures A-V;
- documentar la estrategia canonica de roles;
- dejar todo en estado `PROPOSED_NOT_IMPLEMENTED` o `NOT_STARTED`.

Fuera de alcance:

- modificar o ejecutar PowerShell;
- ejecutar SQL o fixtures;
- conectarse a PostgreSQL;
- acceder a produccion;
- usar datos, nombres, hosts, puertos, credenciales o secretos reales;
- iniciar Stage 2;
- hacer merge.

## 2. Fuentes normativas

| Fuente | Identidad | Uso normativo |
|---|---|---|
| `TASK_005_PRE_EXECUTION_REVIEW_V17.md` | commit `1c58f1ac3e3a41fba2c5ebff0c62ed17193eded7` | Septima correccion documental aprobada. |
| `backup_production_database.ps1` | SHA-256 `d82f72bc0bab5725975540426443b46dc8f01494cdc9ae5f72c19524f4cc9fe9` | Archivo futuro de implementacion, inmutable en esta tarea. |
| Estrategia de roles | `SESSION_ROLE_WITH_EFFECTIVE_PRIVILEGE_ASSERTIONS` | Unica estrategia canonica permitida para la propuesta futura. |
| PR #2 | `https://github.com/stelledicarta212/barberagency-core/pull/2` | Contenedor documental draft; no autoriza merge. |

## 3. Limites de seguridad

```text
PRODUCTION_CONNECTION_ALLOWED = NO
REAL_CREDENTIALS_ALLOWED = NO
TEMP_POSTGRES_ONLY = YES
REAL_BACKUP_ALLOWED = NO
R2_ALLOWED = NO
DOCKER_EXECUTION_AUTHORIZED = NO
SSH_EXECUTION_AUTHORIZED = NO
```

Limites obligatorios para una futura tarea de implementacion:

- prohibida conexion a produccion durante desarrollo y validacion inicial;
- prohibido usar credenciales reales o reutilizar secretos;
- uso exclusivo de una base PostgreSQL temporal, aislada y descartable;
- prohibido reutilizar nombres, hosts, puertos, rutas o secretos de produccion;
- entorno temporal debe tener identificador propio y allowlist explicita;
- blocklist de produccion obligatoria para hosts, contenedores y nombres de base;
- limpieza obligatoria de roles, base temporal, contenedores y artefactos;
- evidencias sanitizadas, sin secretos ni datos reales.

## 4. Cambios propuestos en PowerShell

Todos los cambios son propuestas futuras. Ninguno esta implementado.

| Funcion o seccion afectada | Comportamiento actual | Comportamiento futuro esperado | Motivo | Entradas | Salidas | Errores controlados | Invariantes de seguridad | Evidencia necesaria | Rollback | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| Inicializacion 15-104 | Define parametros y estados existentes. | Agregar parametros futuros validados para entorno temporal, roles y blocklists. | Evitar ambiguedad de entorno. | nombres temporales, allowlists, blocklists. | parametros normalizados o aborto. | `database_acl_policy_parameter_invalid` | no produccion, no secretos, no nombres reales. | diff, logs de parser estatico. | revertir bloque de parametros. | PROPOSED_NOT_IMPLEMENTED |
| Preflight 1610-1702 | Verifica entorno real del flujo actual. | Agregar preflight temporal que rechace produccion y valide roles temporales. | Fail-closed antes de cualquier restore. | `TEMP_ENVIRONMENT_ID`, host/container/db temporal. | preflight OK o aborto. | role missing/admin/membership/collision. | cero produccion, cero credenciales reales. | salida sanitizada de preflight. | revertir funcion nueva y llamadas. | PROPOSED_NOT_IMPLEMENTED |
| Manifest/TOC 1723-2191 | Procesa `pg_dump`, manifest y TOC. | Construir payload de allowlist bidireccional para esquemas esperados/descubiertos. | Evitar restores parciales o schemas inesperados. | manifest, TOC, schema allowlist. | matriz expected/actual. | schema missing/unexpected. | sin modificar dump, sin datos reales en logs. | reporte de diferencias. | revertir builder. | PROPOSED_NOT_IMPLEMENTED |
| Restore temporal 2208-2218 | Comprueba, crea y restaura base temporal. | Insertar politica ACL solo despues del restore temporal y antes de validaciones ACL. | Respetar orden fisico canonico. | db temporal, roles temporales, SQL fijo. | ACL local propuesta aplicada o aborto. | transaction/ACL/owner errors. | no R2, no produccion, una transaccion. | SQL sanitizado, exit code. | revertir invocacion de politica. | PROPOSED_NOT_IMPLEMENTED |
| `Test-StaticParsers` 1073-1591 | Ejecuta fixtures offline del parser. | Ampliar fixtures estaticos sin infraestructura viva. | Cubrir validaciones de parametros y transporte. | fixtures sinteticos. | pass/fail local. | fixture-specific errors. | sin PostgreSQL, sin Docker, sin SSH. | resumen fixture A-F/H-M/O/J/K/L. | revertir fixtures agregados. | PROPOSED_NOT_IMPLEMENTED |
| `Assert-NoDuplicates` 2060-2068 | Detecta duplicados en listas. | Reutilizar para payloads de schemas/roles si aplica. | Evitar identidades duplicadas. | listas normalizadas. | OK o exception. | duplicate identity. | no cambios de datos. | prueba estatica. | revertir uso adicional. | PROPOSED_NOT_IMPLEMENTED |
| Gates antes de R2 2433-2434 | Evalua gates reales del flujo actual. | Bloquear pipeline si ACL temporal no tiene evidencia completa. | Impedir continuation automatica. | estados de gates. | fail closed. | post verification failed. | R2 bloqueado hasta autorizacion separada. | matriz de gates. | revertir gate nuevo. | PROPOSED_NOT_IMPLEMENTED |
| Salida final 2724-2773 | Exit code segun gates actuales. | Propagar exit code exacto de politica ACL y limpieza. | Auditoria reproducible. | resultados de tests/gates. | exit 0/1 deterministico. | exit propagation failed. | no ocultar fallos. | codigo de salida y log. | revertir control de salida. | PROPOSED_NOT_IMPLEMENTED |

## 5. Estrategia de roles

```text
ROLE_STRATEGY = SESSION_ROLE_WITH_EFFECTIVE_PRIVILEGE_ASSERTIONS
STRATEGY_STATUS = PROPOSED_PENDING_INDEPENDENT_REVIEW
ROLE_STRATEGY_IMPLEMENTED = NO
ROLE_STRATEGY_VALIDATED = NO
```

Definicion ejecutable futura:

- `SESSION_ROLE` inicia la sesion temporal.
- `LOCAL_VALIDATION_ROLE` permanece `NOLOGIN`.
- No existe membresia directa ni transitiva entre `SESSION_ROLE` y `LOCAL_VALIDATION_ROLE`.
- No se usa `SET ROLE`.
- `SESSION_ROLE` consulta catalogos y funciones de inspeccion para verificar privilegios efectivos de `LOCAL_VALIDATION_ROLE`.
- No se afirma falsamente que las consultas se ejecutaron como `LOCAL_VALIDATION_ROLE`.

Separacion de conceptos:

| Concepto | Definicion |
|---|---|
| Identidad real de la sesion | `SESSION_ROLE`. |
| Rol objetivo evaluado | `LOCAL_VALIDATION_ROLE`. |
| Privilegios efectivos observables | Resultado de catalogos y funciones `has_*_privilege` sobre `LOCAL_VALIDATION_ROLE`. |
| Validaciones que puede probar | grants efectivos, ausencia de ownership, ausencia de membresias, no privilegios administrativos, no EXECUTE segun allowlist. |
| Validaciones que no puede probar por si sola | experiencia exacta de una sesion iniciada como `LOCAL_VALIDATION_ROLE`, porque el rol es `NOLOGIN`. |

Criterios de aceptacion futuros:

- `SESSION_ROLE` puede conectarse solo a la base temporal allowlisted.
- `LOCAL_VALIDATION_ROLE_LOGIN = NOLOGIN`.
- `SESSION_ROLE_MEMBER_OF_LOCAL_VALIDATION_ROLE = NO`.
- `SET_ROLE_USED = NO`.
- cualquier membresia directa o transitiva falla.
- cualquier privilegio de escritura, ownership, CREATE, EXECUTE no permitido o BYPASSRLS falla.
- evidencias muestran identidad real de sesion y rol objetivo evaluado por separado.

Limitaciones:

- esta estrategia demuestra privilegios efectivos observables, no una ejecucion real logueada como `LOCAL_VALIDATION_ROLE`;
- cualquier necesidad futura de validar comportamiento como rol asumido requeriria nueva decision, nueva revision independiente y autorizacion expresa.

## 6. Matriz de implementacion

| ID | Cambio | Archivo o funcion | Precondiciones | Accion futura | Validacion | Evidencia | Rollback | Riesgo | Autorizacion requerida | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| IMPL-01 | Parametros temporales | Inicializacion | plan aprobado | agregar parametros y validadores | pruebas estaticas | diff + hash | revert commit | medio | Gate B | NOT_STARTED |
| IMPL-02 | Preflight anti-produccion | Preflight | parametros definidos | bloquear hosts/db/contenedores productivos | fixture K + revision | logs sanitizados | revert funcion | alto | Gate B | NOT_STARTED |
| IMPL-03 | Roles temporales | nueva funcion propuesta | entorno temporal | validar `SESSION_ROLE` y `LOCAL_VALIDATION_ROLE` | fixtures G/P/Q | catalogos temporales | drop roles | alto | Gate E | NOT_STARTED |
| IMPL-04 | Schema allowlist | manifest/TOC | dump sintetico | comparar expected/actual | fixture N | reporte diff | revert builder | medio | Gate D/E | NOT_STARTED |
| IMPL-05 | Politica ACL local | restore temporal | base temporal restaurada | aplicar SQL transaccional fijo | fixtures R/S/T/U/V | exit code + SQL log | rollback transaccion | alto | Gate F | NOT_STARTED |
| IMPL-06 | Gates fail-closed | gates antes R2 | politica ACL propuesta | detener continuidad automatica | fixture J | matriz gates | revert gate | alto | Gate D | NOT_STARTED |
| IMPL-07 | Evidencia sanitizada | reporting | pruebas autorizadas | capturar hashes/logs sin secretos | secret scan | bundle evidencia | borrar bundle | medio | Gate G | NOT_STARTED |
| IMPL-08 | Revision independiente | documentos/evidencia | gates previos completos | entregar evidencia | dictamen externo | acta/dictamen | no aplica | alto | Gate G | NOT_STARTED |

## 7. Plan de fixtures A-V

Ningun fixture esta ejecutado ni aprobado tecnicamente.

| ID | Clasificacion | Requiere PowerShell | Requiere PostgreSQL temporal | Produccion permitida | Estado |
|---|---|---:|---:|---:|---|
| A | verificacion puramente estatica | NO | NO | NO | NOT_STARTED |
| B | verificacion puramente estatica | NO | NO | NO | NOT_STARTED |
| C | verificacion estatica de parametros | YES | NO | NO | NOT_STARTED |
| D | verificacion estatica de identificadores | YES | NO | NO | NOT_STARTED |
| E | verificacion estatica de valores vacios | YES | NO | NO | NOT_STARTED |
| F | verificacion estatica de colision temp/prod | YES | NO | NO | NOT_STARTED |
| G | verificacion de rol local inexistente | YES | YES | NO | NOT_STARTED |
| H | verificacion estatica de flags psql | YES | NO | NO | NOT_STARTED |
| I | verificacion estatica transaccional | YES | NO | NO | NOT_STARTED |
| J | verificacion de detencion de pipeline | YES | NO | NO | NOT_STARTED |
| K | verificacion estatica de hardcode productivo | YES | NO | NO | NOT_STARTED |
| L | verificacion estatica de secretos | YES | NO | NO | NOT_STARTED |
| M | verificacion estatica de schema interno | YES | NO | NO | NOT_STARTED |
| N | verificacion de schema inesperado | YES | YES | NO | NOT_STARTED |
| O | verificacion estatica de colision de roles | YES | NO | NO | NOT_STARTED |
| P | verificacion de atributos administrativos | YES | YES | NO | NOT_STARTED |
| Q | verificacion de membresia directa/transitiva | YES | YES | NO | NOT_STARTED |
| R | verificacion de EXECUTE fuera de allowlist | YES | YES | NO | NOT_STARTED |
| S | verificacion de SECURITY DEFINER accesible | YES | YES | NO | NOT_STARTED |
| T | verificacion de escritura inesperada | YES | YES | NO | NOT_STARTED |
| U | verificacion de privilegio PUBLIC/ACL NULL | YES | YES | NO | NOT_STARTED |
| V | verificacion de rollback antes de COMMIT | YES | YES | NO | NOT_STARTED |

Para G, N y P-V:

```text
FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED = YES
PRODUCTION_CONNECTION_ALLOWED = NO
PRODUCTION_CONNECTION_PERFORMED = NO
TECHNICAL_VALIDATION_COMPLETED = NO
```

## 8. Plan de entorno temporal

Plan futuro, no ejecutado:

1. crear entorno aislado con identificador temporal unico;
2. crear identidad administrativa temporal no productiva;
3. crear `SESSION_ROLE` con LOGIN temporal restringido;
4. crear `LOCAL_VALIDATION_ROLE` como `NOLOGIN`;
5. confirmar ausencia de membresias directas y transitivas;
6. conceder privilegios minimos solo en la base temporal;
7. cargar datos sinteticos sin informacion real;
8. ejecutar fixtures autorizados por gate;
9. recolectar evidencia sanitizada;
10. revocar privilegios temporales;
11. destruir roles/base/artefactos temporales;
12. registrar limpieza final.

No se incluyen ni se requieren credenciales reales en este plan.

## 9. Secuencia de implementacion futura por gates

| Gate | Objetivo | Autorizacion explicita | Continuacion automatica | Estado |
|---|---|---|---|---|
| Gate A | aprobacion del plan | requerida | NO | NOT_STARTED |
| Gate B | implementacion estatica del codigo | requerida | NO | NOT_STARTED |
| Gate C | revision del diff | requerida | NO | NOT_STARTED |
| Gate D | pruebas estaticas | requerida | NO | NOT_STARTED |
| Gate E | PostgreSQL temporal aislado | requerida | NO | NOT_STARTED |
| Gate F | restauracion temporal controlada | requerida | NO | NOT_STARTED |
| Gate G | revision independiente de evidencias | requerida | NO | NOT_STARTED |
| Gate H | decision separada sobre Stage 2 | requerida | NO | NOT_STARTED |

Cada gate debe detener el proceso y requerir aprobacion expresa. Ningun gate autoriza automaticamente el siguiente.

## 10. Rollback

Rollback futuro limitado a codigo:

- revertir exclusivamente commits de implementacion futura;
- no tocar produccion;
- no tocar datos reales;
- no usar `git reset --hard` sobre worktrees con cambios ajenos;
- preservar evidencia de diff, commit y revert;
- destruir unicamente recursos temporales creados por la tarea autorizada;
- validar que `backup_production_database.ps1` vuelve al hash esperado o al hash aprobado por la tarea futura.

## 11. Evidencias requeridas

Evidencias minimas futuras:

- SHA-256, tamano y lineas de archivos antes/despues;
- diff exacto de codigo;
- inventario de archivos staged;
- pruebas ejecutadas y comandos exactos;
- codigos de salida;
- identidad del entorno temporal;
- evidencia de ausencia de produccion;
- resultados por fixture A-V;
- logs sanitizados;
- secret scan;
- limpieza final;
- revision independiente.

## 12. Condiciones de detencion

Detener inmediatamente ante:

- diferencia inesperada en `backup_production_database.ps1`;
- cambios ajenos en el worktree;
- secretos o credenciales reales;
- referencia activa a produccion;
- falta de entorno temporal;
- ambiguedad de privilegios;
- fixture que no pueda validarse con la estrategia canonica;
- fallo de limpieza;
- falta de autorizacion explicita;
- intento de continuar automaticamente entre gates.

## 13. Estados finales

```text
CONTROLLED_IMPLEMENTATION_PLAN_CREATED = PROPOSED_PENDING_INDEPENDENT_REVIEW
SEVENTH_CORRECTION_DOCUMENTARILY_APPROVED = YES
IMPLEMENTATION_AUTHORIZED = NO
IMPLEMENTATION_COMPLETED = NO
TECHNICAL_VALIDATION_COMPLETED = NO
STATIC_FIXTURES_EXECUTED = NO
TEMP_DATABASE_FIXTURES_EXECUTED = NO
SCRIPT_MODIFIED = NO
SCRIPT_EXECUTED = NO
SQL_EXECUTED = NO
PRODUCTION_ACCESSED = NO
REAL_BACKUP_EXECUTED = NO
TEMP_RESTORE_EXECUTED = NO
R2_UPLOAD_EXECUTED = NO
READY_FOR_IMPLEMENTATION = NO
READY_FOR_STAGE_2 = NO
READY_FOR_EXPLICIT_EXECUTION_AUTHORIZATION = NO
MERGE_AUTHORIZED = NO
```
