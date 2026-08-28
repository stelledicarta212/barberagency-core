# TASK-007 — Solicitud y preflight final para Gate 006-E

```text
TASK_007_DEFINITION_STATUS = APPROVED_BY_OWNER_DELEGATION
TASK_007_SCOPE = DOCUMENTARY_AND_READ_ONLY_PREFLIGHT_ONLY
TASK_007_EXECUTION_RESULT = PASSED_LOCAL_PREFLIGHT
TASK_007_STATUS = COMPLETED_PENDING_INDEPENDENT_AUDIT
GATE_006_E_REQUEST_STATUS = PREPARED_NOT_SUBMITTED
GATE_006_E_RESULT = PENDING_SEPARATE_OWNER_AUTHORIZATION
PRODUCTION_GO = NOT_AUTHORIZED
CREATED_AT_UTC = 2026-07-29T23:22:17Z
CREATED_AT_AMERICA_BOGOTA = 2026-07-29 18:22:17 -05:00
```

## 1. Proposito de la solicitud

Preparar el paquete de decision para que el Owner pueda resolver posteriormente si autoriza o no Gate 006-E de Stage 2.

Este documento no constituye autorizacion. No emite GO/NO-GO. No ejecuta Gate 006-E, Stage 2, produccion, backup, restore, R2, PostgreSQL externo, SQL, migraciones, deploy, PR ni merge.

## 2. Estado de TASK-005, TASK-006 y TASK-007

```text
TASK_005_FINAL_STATUS = CLOSED
TASK_005_CLOSURE_COMMIT = 30d66e1fdb0674cf8565f842f1ba01b570802d37
TASK_006_FINAL_STATUS = CLOSED
TASK_006_CLOSURE_COMMIT = 545c3532540a71e24317d2f9380e6edfc7b5e30a
TASK_006_AUDIT_STATUS = PASSED_INDEPENDENT_AUDIT
TASK_006_AUDIT_COMMIT = fe66798d9a38c35547a29c0347a09a3b8ff6f874
TASK_007_DEFINITION_STATUS = APPROVED_BY_OWNER_DELEGATION
TASK_007_EXECUTION_RESULT = PASSED_LOCAL_PREFLIGHT
TASK_007_STATUS = COMPLETED_PENDING_INDEPENDENT_AUDIT
```

## 3. Alcance exacto que se solicitara autorizar en Gate 006-E

Alcance futuro potencial, pendiente de decision Owner:

- ejecucion controlada de Stage 2 productivo;
- ejecucion real de `backup_production_database.ps1`;
- acceso con credenciales temporales externas al repositorio;
- validacion de destino productivo autorizado;
- generacion de backup productivo;
- generacion de manifest e inventario;
- verificacion de hash, tamano y metadata;
- carga restringida de artefactos a R2 real;
- cleanup y reporte final sanitizado.

## 4. Acciones explicitamente excluidas de esta solicitud

- ejecutar este paquete como autorizacion automatica;
- ejecutar Gate 006-E sin decision Owner;
- modificar datos productivos;
- aplicar migraciones;
- modificar RLS, roles o infraestructura;
- acceder a sistemas externos durante TASK-007;
- completar el formulario GO/NO-GO en nombre del Owner.

## 5. Sistemas externos que podrian verse involucrados si Gate 006-E se aprueba

| Sistema | Uso futuro potencial | Estado actual |
|---|---|---|
| PostgreSQL productivo | Origen del backup | NOT_ACCESSED |
| Host productivo por SSH | Ejecucion operacional | NOT_ACCESSED |
| R2 real | Almacenamiento restringido de artefactos | NOT_ACCESSED |
| Entorno local del operador | Ejecucion del script | NOT_EXECUTED |

No se incluyen hosts, credenciales, tokens, buckets sensibles ni cadenas de conexion reales.

## 6. Orden de ejecucion propuesto para futura decision autorizada

1. Confirmar decision Owner para Gate 006-E.
2. Confirmar operador y separacion de funciones.
3. Confirmar commit aprobado y worktree limpio.
4. Confirmar ventana operativa y ventana de observacion.
5. Confirmar credenciales temporales fuera del repositorio.
6. Confirmar destino productivo autorizado.
7. Ejecutar preflight productivo.
8. Ejecutar backup productivo solo si todos los controles GO estan cumplidos.
9. Validar artefactos locales.
10. Validar anti-overwrite R2.
11. Subir artefactos si aplica.
12. Validar artefactos remotos.
13. Ejecutar cleanup.
14. Registrar evidencia sanitizada.
15. Comunicar resultado final.

## 7. Precondiciones obligatorias

| ID | Precondicion | Estado TASK-007 |
|---|---|---|
| P-01 | Auditoria independiente TASK-007 aprobada | PENDING |
| P-02 | Decision Owner Gate 006-E | PENDING |
| P-03 | Operador identificado | REQUIRES_OPERATOR_CONFIRMATION |
| P-04 | Credenciales temporales externas | READY_PENDING_EXTERNAL_VERIFICATION |
| P-05 | Destino productivo confirmado | READY_PENDING_EXTERNAL_VERIFICATION |
| P-06 | Ventana operativa aprobada | REQUIRES_OWNER_AUTHORIZATION |
| P-07 | Rollback aceptado | READY_PENDING_EXTERNAL_VERIFICATION |

## 8. Identificacion del operador y separacion de funciones

El operador futuro debe ser identificado antes de Gate 006-E. El reviewer independiente no debe ser el mismo actor que ejecute la operacion productiva. El Owner debe aprobar el GO/NO-GO.

## 9. Backup requerido y validacion

La futura ejecucion debe producir:

- dump productivo con nombre UTC + UUID;
- manifest del backup;
- inventario de roles/ACL;
- hash SHA-256;
- tamano fisico;
- metadata remota;
- evidencia de no overwrite;
- evidencia de cleanup.

## 10. Condiciones GO

Se puede considerar GO solo si el Owner lo aprueba expresamente y:

- TASK-007 fue auditada;
- operador y ventana estan confirmados;
- credenciales temporales estan listas fuera del repo;
- destino productivo esta confirmado;
- rollback fue aceptado;
- no hay secretos en repo;
- todos los controles preflight son PASS.

## 11. Condiciones NO-GO

- falta de decision Owner;
- auditoria pendiente o rechazada;
- secretos detectados;
- destino ambiguo;
- credenciales no temporales o no verificadas;
- rollback incompleto;
- worktree sucio;
- commit no aprobado.

## 12. Condiciones BLOCKED

- desacuerdo sobre alcance productivo;
- falta de acceso controlado;
- imposibilidad de validar anti-overwrite;
- error en parser estatico del script;
- hallazgo CRITICAL o MAJOR en auditoria.

## 13. Condiciones GO_WITH_EXPLICIT_CONDITIONS

Solo el Owner puede emitir este resultado. Debe listar condiciones objetivas, owner de cada condicion y criterio verificable de cumplimiento antes de ejecucion.

## 14. Riesgos residuales y controles compensatorios

| Riesgo | Control compensatorio |
|---|---|
| Acceso a destino incorrecto | Doble confirmacion humana y preflight |
| Exposicion de secretos | No registrar valores y escaneo de evidencia |
| Backup incompleto | Hash, tamano, manifest y exit codes |
| Overwrite en R2 | List/head-object previo |
| Cleanup parcial | Checklist final y evidencia |

## 15. Puntos de pausa

- Antes de cargar credenciales.
- Antes de conectar a produccion.
- Antes de ejecutar backup.
- Antes de subir a R2.
- Ante cualquier exit code distinto de 0.
- Antes de declarar resultado final.

## 16. Rollback objetivo

Si falla:

1. detener ejecucion;
2. no reintentar automaticamente;
3. preservar evidencia sanitizada;
4. limpiar solo artefactos temporales creados en la ejecucion;
5. bloquear uso de artefactos parciales;
6. revocar credenciales temporales;
7. reportar NO-GO o BLOCKED.

## 17. Evidencias obligatorias

- autorizacion Owner;
- commit ejecutado;
- operador;
- timestamps UTC;
- comando sanitizado;
- preflight;
- exit codes;
- hashes y tamanos;
- manifest;
- inventario;
- metadata R2;
- cleanup;
- reporte final.

## 18. Ventana de observacion

Debe definirse antes del GO:

- inicio y fin de ventana operativa;
- responsable de monitoreo;
- canal de incidentes;
- criterio de cierre de observacion.

## 19. Comunicacion de incidentes

Ante incidente:

- detener ejecucion;
- no ocultar salida;
- sanitizar secretos;
- reportar causa, impacto, evidencia y accion recomendada;
- requerir nueva decision Owner.

## 20. Autorizaciones humanas puntuales necesarias

- GO/NO-GO de Gate 006-E;
- autorizacion para credenciales temporales;
- autorizacion para acceder a produccion;
- autorizacion para R2 real;
- aceptacion de rollback;
- aprobacion de ventana.

## 21. Formulario de decision

```text
DECISION_OWNER = CHATGPT_BY_OWNER_DELEGATION
DECISION_AT = 2026-07-30T00:15:35Z
DECISION = GO_WITH_EXPLICIT_CONDITIONS
CONDITIONS = COND-01; COND-02; COND-03; COND-04; COND-05; COND-06; COND-07; COND-08
AUTHORIZED_SCOPE = CONTROLLED_BACKUP_ONLY
PRODUCTION_GO = NOT_AUTHORIZED_UNTIL_CONDITIONS_AND_EXTERNAL_PRECHECK_PASS
GATE_006_E_RESULT = CONDITIONALLY_AUTHORIZED_NOT_EXECUTED
SIGN_OFF = OWNER_DELEGATION_ACCEPTED_BY_CHATGPT
```

Este formulario registra una decision condicionada delegada. No ejecuta Gate 006-E, no inicia Stage 2, no verifica PF-05 a PF-08, no accede a produccion y no ejecuta el backup.

Condiciones obligatorias:

```text
COND-01 = PF-05 debe validar correctamente las credenciales temporales sin imprimirlas, copiarlas al informe ni almacenarlas en Git.
COND-02 = PF-06 debe confirmar explicitamente la identidad exacta del origen productivo y del destino del backup antes de ejecutar.
COND-03 = PF-07 debe verificar que el objeto de destino no existe. Cualquier posibilidad de sobrescritura debe detener la ejecucion como BLOCKED.
COND-04 = PF-08 debe confirmar que la ejecucion ocurre dentro de una ventana operativa autorizada.
COND-05 = Cualquier precondicion fallida, ausente o contradictoria debe producir una detencion automatica sin intentar corregir produccion.
COND-06 = Solo se autoriza crear, cifrar, transferir y verificar un backup de produccion.
COND-07 = Deben verificarse checksum, tamano, integridad basica y existencia del artefacto sin exponer secretos.
COND-08 = Ante cualquier discrepancia, la ejecucion debe finalizar como BLOCKED y no debe realizarse ningun reintento destructivo o correctivo.
```

Estados separados:

```text
OWNER_DELEGATION_ACCEPTED = YES
OWNER_DELEGATION_SOURCE = CHATGPT_CONVERSATION
AUTHORIZED_COORDINATOR = CHATGPT
GATE_006_E_OWNER_DECISION = GO_WITH_EXPLICIT_CONDITIONS
GATE_006_E_AUTHORIZATION_STATUS = CONDITIONALLY_AUTHORIZED
GATE_006_E_AUTHORIZED_SCOPE = CONTROLLED_BACKUP_ONLY
GATE_006_E_DECISION_RECORDED = YES
GATE_006_E_CONDITIONAL_AUTHORIZATION_RECORDED = YES
EXTERNAL_PRECHECK_AUTHORIZED = NO_NOT_YET
EXTERNAL_PRECHECK_EXECUTED = NO
GATE_006_E_EXECUTION_STARTED = NO
BACKUP_EXECUTED = NO
BACKUP_VERIFIED = NO
STAGE_2_STARTED = NO
PRODUCTION_ACCESSED = NO
PF_05_STATUS = PENDING_EXTERNAL_PRECHECK
PF_06_STATUS = PENDING_EXTERNAL_PRECHECK
PF_07_STATUS = PENDING_EXTERNAL_PRECHECK
PF_08_STATUS = PENDING_EXTERNAL_PRECHECK
```

Permisos condicionados:

```text
BACKUP_CREATION_AUTHORIZED = YES_CONDITIONAL
BACKUP_ENCRYPTION_AUTHORIZED = YES_CONDITIONAL
BACKUP_TRANSFER_AUTHORIZED = YES_CONDITIONAL
BACKUP_VERIFICATION_AUTHORIZED = YES_CONDITIONAL
```

Acciones no autorizadas:

```text
RESTORE_AUTHORIZED = NO
MIGRATION_AUTHORIZED = NO
DEPLOY_AUTHORIZED = NO
DATA_MODIFICATION_AUTHORIZED = NO
DATABASE_SCHEMA_CHANGE_AUTHORIZED = NO
SQL_WRITE_AUTHORIZED = NO
N8N_MODIFICATION_AUTHORIZED = NO
MERCADOPAGO_ACTION_AUTHORIZED = NO
PAYMENT_EXECUTION_AUTHORIZED = NO
FASE_0_CLOSURE_AUTHORIZED = NO
FASE_1_START_AUTHORIZED = NO
PR_AUTHORIZED = NO
MERGE_AUTHORIZED = NO
```

## 22. Matriz final de preflight

| ID | Control | Fuente | Metodo | Resultado | Evidencia | Riesgo si falla | Condicion para resolverlo | Responsable futuro | Momento |
|---|---|---|---|---|---|---|---|---|---|
| PF-01 | TASK-006 cerrada | TASK_006 docs | lectura local | VERIFIED_LOCAL | commits verificados | secuencia invalida | corregir cierre | Reviewer | antes de audit TASK-007 |
| PF-02 | Gate 006-E pendiente | TASK_006 docs | lectura local | VERIFIED_LOCAL | `PENDING_SEPARATE_OWNER_AUTHORIZATION` | GO implicito | decision Owner | Owner | antes de produccion |
| PF-03 | Runbook disponible | TASK_006_DOCUMENTARY_READINESS.md | lectura local | VERIFIED_LOCAL | secciones runbook | ejecucion improvisada | actualizar runbook | Implementer | antes de GO |
| PF-04 | Parser script versionado | backup_production_database.ps1 | parser estatico | VERIFIED_LOCAL | `PARSER_ERRORS=0` | script invalido | corregir script en tarea separada | Implementer | antes de GO |
| PF-05 | Credenciales temporales | N/A | no verificable local | READY_PENDING_EXTERNAL_VERIFICATION | no leidas | credencial incorrecta | confirmar externamente | Operador | Gate 006-E |
| PF-06 | Destino productivo | N/A | no verificable local | READY_PENDING_EXTERNAL_VERIFICATION | no accedido | destino incorrecto | doble confirmacion | Owner/Operador | Gate 006-E |
| PF-07 | R2 anti-overwrite | script/runbook | no verificable local | READY_PENDING_EXTERNAL_VERIFICATION | controles definidos | overwrite | list/head-object futuro | Operador | ejecucion futura |
| PF-08 | Ventana operativa | Owner | no definida | REQUIRES_OWNER_AUTHORIZATION | pendiente | ejecucion sin ventana | aprobar ventana | Owner | Gate 006-E |
| PF-09 | Rollback | TASK_006 readiness | lectura local | VERIFIED_LOCAL | rollback definido | recuperacion ambigua | revisar rollback | Reviewer | antes de GO |
| PF-10 | Auditoria TASK-007 | esta tarea | futura | REQUIRES_OWNER_AUTHORIZATION | pendiente | ejecutar sin review | auditoria independiente | Reviewer | despues TASK-007 |

## 23. Confirmacion final

```text
GATE_006_E_REQUEST_STATUS = PREPARED_NOT_SUBMITTED
GATE_006_E_RESULT = PENDING_SEPARATE_OWNER_AUTHORIZATION
PRODUCTION_GO = NOT_AUTHORIZED
TASK_007_EXECUTION_RESULT = PASSED_LOCAL_PREFLIGHT
TASK_007_STATUS = COMPLETED_PENDING_INDEPENDENT_AUDIT
```
