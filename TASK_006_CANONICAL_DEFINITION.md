# TASK-006 — Propuesta de readiness documental para Stage 2 productivo controlado

## 1. Estado del documento

```text
TASK_006_DEFINITION_STATUS = PROPOSED_PENDING_OWNER_APPROVAL
TASK_006_EXECUTION_AUTHORIZED = NO
TASK_006_IMPLEMENTATION_STARTED = NO
TASK_007_AUTHORIZED = NO
DOCUMENT_CREATED_AT_UTC = 2026-07-29T15:32:42Z
DOCUMENT_CREATED_AT_AMERICA_BOGOTA = 2026-07-29 10:32:42 -05:00
```

Este documento propone una definicion canonica para TASK-006. No aprueba ni ejecuta TASK-006. No modifica codigo, SQL, scripts, workflows, infraestructura, produccion, R2, n8n, Mercado Pago ni datos reales.

## 2. Objetivo

Definir y preparar documentalmente el readiness de Stage 2 para una futura ejecucion productiva controlada de `backup_production_database.ps1`, incluyendo runbook, preflight, criterios de autorizacion, evidencias, rollback y limites de seguridad.

TASK-006 no ejecuta el backup productivo. La ejecucion real de backup, acceso SSH, PostgreSQL productivo, R2 o validaciones remotas queda fuera de alcance y requiere autorizacion humana separada.

## 3. Justificacion y origen

TASK-005 cerro la validacion documental, estatica, local y temporal de los controles previos del script de backup. El siguiente bloque identificado en las fuentes versionadas es Stage 2, pero las mismas fuentes prohiben asumir ejecucion automatica y exigen decision separada.

Por tanto, la definicion responsable de TASK-006 no debe ser "ejecutar produccion", sino preparar una unidad documental y verificable de readiness para solicitar una autorizacion productiva posterior.

## 4. Fuentes canonicas

| Fuente | Seccion o referencia | Uso |
|---|---|---|
| `TASK_005_CONTROLLED_IMPLEMENTATION_PLAN.md` | Secciones 1, 9, 13.2 | Cierre de TASK-005, secuencia de gates y decision separada sobre Stage 2 |
| `TASK_005_PRE_EXECUTION_REVIEW_V17.md` | Seccion 12 canonica y cierre documental posterior | Controles canonicos, prohibiciones de Stage 2 sin autorizacion y cierre de TASK-005 |
| `pruebas/task005_closure_and_task006_discovery_20260729T152640Z.md` | Secciones 2, 3, 6, 7 | Gate H aprobado, TASK-005 cerrado y ausencia previa de definicion canonica de TASK-006 |
| `backup_production_database.ps1` | Estados TASK005 fail-closed y bloque operacional posterior | Identifica que Stage 2 implica backup productivo, SSH, PostgreSQL productivo, R2 y gates previos completos |
| `BARBERAGENCY_MASTER.md` | Reglas criticas y fuente de verdad canonica | RLS obligatorio, aislamiento multi-tenant y PostgreSQL como fuente de verdad |

No se encontro `PAGOS-LICENCIAS-IMPLEMENTACION-MASTER.md` ni `BARBERAGENCY-FASE-0-DECISIONES-ARQUITECTURA.md` en el worktree versionado actual.

## 5. Dependencias

| Dependencia | Estado | Fuente |
|---|---|---|
| TASK-005 finalizada | CUMPLIDA | `TASK_005_CONTROLLED_IMPLEMENTATION_PLAN.md` seccion 13.2 |
| Gate G auditada | CUMPLIDA | `TASK_005_CONTROLLED_IMPLEMENTATION_PLAN.md` seccion 13.2 |
| Gate H aprobada por Owner | CUMPLIDA | `TASK_005_CONTROLLED_IMPLEMENTATION_PLAN.md` seccion 13.2 |
| Definicion canonica previa de TASK-006 | NO EXISTIA | `pruebas/task005_closure_and_task006_discovery_20260729T152640Z.md` |
| Autorizacion para ejecutar produccion | NO CUMPLIDA | Restricciones vigentes y fuentes TASK-005 |

## 6. Alcance incluido

1. Consolidar el runbook documental de Stage 2.
2. Identificar comandos productivos previstos, sanitizados y no ejecutados.
3. Definir preflight obligatorio antes de cualquier produccion.
4. Definir evidencias requeridas para una futura ejecucion autorizada.
5. Definir criterios de GO/NO-GO.
6. Definir rollback y limpieza.
7. Definir controles de secreto y minimo privilegio.
8. Preparar formato de reporte para futura autorizacion productiva.

## 7. Alcance excluido

- Ejecutar `backup_production_database.ps1` en modo real.
- Acceder a EasyPanel.
- Acceder a PostgreSQL externo o productivo.
- Leer `.env`.
- Leer o exponer credenciales.
- Usar SSH/SCP real.
- Usar Docker remoto.
- Usar R2 real.
- Usar n8n externo.
- Usar Mercado Pago.
- Ejecutar pagos.
- Aplicar migraciones.
- Modificar datos reales.
- Hacer deploy.
- Crear PR.
- Hacer merge.
- Iniciar TASK-007.

## 8. Entregables obligatorios

1. Runbook de Stage 2 propuesto.
2. Matriz de preflight productivo.
3. Matriz GO/NO-GO.
4. Lista de evidencias requeridas.
5. Procedimiento de rollback.
6. Lista de acciones productivas no ejecutadas.
7. Prompt de autorizacion productiva posterior, si aplica.
8. Evidencia documental bajo `pruebas/`.

## 9. Gates internos

| Gate | Nombre | Tipo | Estado inicial |
|---|---|---|---|
| 006-A | Confirmacion documental de dependencias TASK-005 | documental | PENDING |
| 006-B | Runbook productivo sanitizado | documental | PENDING |
| 006-C | Matriz de riesgos, rollback y GO/NO-GO | documental | PENDING |
| 006-D | Readiness review documental | documental/read-only | PENDING |
| 006-E | Solicitud de autorizacion productiva separada | decision humana | PENDING_OWNER_APPROVAL |

Ningun gate de TASK-006 autoriza por si mismo acceso productivo.

## 10. Criterios de aceptacion

TASK-006 puede quedar `COMPLETED_PENDING_OWNER_PRODUCTION_AUTHORIZATION` solo si:

- el runbook identifica cada accion productiva prevista;
- el preflight cubre identidad, destino, secretos, backup, R2, rollback y validacion posterior;
- las acciones productivas quedan explicitamente no ejecutadas;
- el reporte permite una decision humana GO/NO-GO;
- no hay cambios de codigo, SQL, scripts o infraestructura;
- no se accede a produccion ni secretos;
- TASK-007 queda sin iniciar.

## 11. Pruebas obligatorias

Solo pruebas documentales:

- `git status`;
- `git diff`;
- `git diff --check`;
- `git diff --cached --check` antes del commit;
- escaneo de secretos limitado al diff;
- verificacion de archivos modificados;
- verificacion de ausencia de codigo, SQL, scripts o infraestructura modificados.

## 12. Regresion requerida

Regresion documental:

- TASK-005 permanece `CLOSED`;
- Gate G permanece `APPROVED`;
- Gate H permanece `APPROVED_BY_OWNER`;
- TASK-006 permanece no ejecutada;
- TASK-007 permanece no iniciada;
- ninguna evidencia historica de TASK-005 se elimina o reescribe.

## 13. Evidencias requeridas

La ejecucion documental de TASK-006 debe crear evidencia bajo `pruebas/` con:

- estado Git inicial y final;
- fuentes revisadas;
- decisiones explicitas e inferencias;
- gates 006-A a 006-E;
- runbook sanitizado;
- riesgos y mitigaciones;
- pruebas documentales;
- archivos modificados;
- confirmacion de no produccion;
- estado final.

## 14. Riesgos y mitigaciones

| Riesgo | Severidad | Mitigacion |
|---|---|---|
| Confundir readiness con ejecucion productiva | Alta | Estados fail-closed y autorizacion productiva separada |
| Exponer secretos en runbook | Alta | Comandos sanitizados y prohibicion de `.env` |
| Ejecutar backup sin GO humano | Alta | Gate 006-E obligatorio |
| Tocar R2 o PostgreSQL real | Alta | Prohibicion explicita y evidencia de no acceso |
| Iniciar TASK-007 por continuidad automatica | Media | `TASK_007_AUTHORIZED = NO` |

## 15. Acciones locales permitidas

- Lectura local de documentos versionados.
- Creacion o edicion de documentos `.md`.
- Evidencias documentales bajo `pruebas/`.
- Validaciones Git.
- Escaneo local de secretos limitado al diff.

## 16. Acciones productivas prohibidas

Todas las acciones productivas estan prohibidas en TASK-006 salvo autorizacion humana posterior y separada. Esto incluye SSH, PostgreSQL productivo, R2 real, EasyPanel, n8n externo, Mercado Pago, backups reales, restores reales, migraciones, despliegues, PR y merge.

## 17. Condiciones que requieren autorizacion humana

- Ejecutar cualquier comando real contra produccion.
- Leer o cargar credenciales.
- Usar R2 real.
- Ejecutar `backup_production_database.ps1` fuera de ramas de prueba estatica autorizadas.
- Iniciar TASK-007.
- Cambiar el alcance de TASK-006 de documental a tecnico/productivo.

## 18. Estrategia de rollback, cuando corresponda

Para TASK-006 documental:

- revertir exclusivamente el commit documental de TASK-006 si la propuesta es rechazada;
- no tocar evidencias historicas de TASK-005;
- no ejecutar rollback productivo porque no hay accion productiva autorizada.

Para una futura ejecucion productiva separada:

- debe definirse un rollback especifico antes de ejecutar;
- debe incluir limpieza de artefactos temporales, no sobrescritura R2, verificacion de integridad y reporte de fallo sanitizado.

## 19. Estado inicial esperado

```text
TASK_005_FINAL_STATUS = CLOSED
TASK_005_CLOSURE_COMMIT = 30d66e1fdb0674cf8565f842f1ba01b570802d37
TASK_006_DEFINITION_STATUS = PROPOSED_PENDING_OWNER_APPROVAL
TASK_006_EXECUTION_AUTHORIZED = NO
TASK_006_IMPLEMENTATION_STARTED = NO
TASK_007_AUTHORIZED = NO
```

## 20. Estado final permitido

Estados permitidos para esta propuesta:

```text
TASK_006_DEFINITION_STATUS = PROPOSED_PENDING_OWNER_APPROVAL
TASK_006_EXECUTION_AUTHORIZED = NO
TASK_006_IMPLEMENTATION_STARTED = NO
TASK_006_AUDIT_STATUS = NOT_APPLICABLE_DEFINITION_PROPOSAL
TASK_007_AUTHORIZED = NO
```

Estados permitidos para una futura ejecucion documental aprobada:

```text
TASK_006_STATUS = COMPLETED_PENDING_OWNER_PRODUCTION_AUTHORIZATION
PRODUCTION_ACTION_EXECUTED = NO
TASK_007_STARTED = NO
```

## 21. Relacion con TASK-005

TASK-005 cerro la validacion de controles previos, evidencia local/temporal y aprobacion Gate H. TASK-006 comienza donde TASK-005 termina: preparar Stage 2 como decision productiva separada, no ejecutar Stage 2 automaticamente.

## 22. Condiciones para habilitar TASK-007

TASK-007 solo podra solicitarse si:

- TASK-006 fue aprobada por Owner;
- la ejecucion documental de TASK-006 queda completada;
- existe decision explicita sobre autorizacion productiva o postergacion;
- cualquier accion productiva requerida tiene evidencia y autorizacion separada;
- una auditoria independiente, si se exige, queda aprobada.

## 23. Matriz de trazabilidad

| Decision propuesta | Fuente | Respaldo | Clasificacion |
|---|---|---|---|
| TASK-006 trata Stage 2 | `TASK_005_CONTROLLED_IMPLEMENTATION_PLAN.md` seccion 9 | Gate H es decision separada sobre Stage 2 | INFERRED_FROM_SEQUENCE |
| TASK-006 no ejecuta produccion automaticamente | `TASK_005_CONTROLLED_IMPLEMENTATION_PLAN.md` secciones 1 y 9 | Stage 2 fuera de alcance y continuacion automatica prohibida | EXPLICIT |
| Stage 2 involucra backup/R2/productivo | `backup_production_database.ps1` bloque operacional | Variables SSH/R2, nombres `barberagency_prod_*`, upload R2 | EXPLICIT |
| Debe existir autorizacion humana posterior | `pruebas/task005_closure_and_task006_discovery_20260729T152640Z.md` | Avance sujeto a alcance canonico y limites de seguridad | EXPLICIT |
| TASK-006 debe ser readiness documental | Este documento | Control nuevo para resolver bloqueo sin ampliar a produccion | PROPOSED_NEW_CONTROL |
| RLS y aislamiento son restricciones globales | `BARBERAGENCY_MASTER.md` reglas criticas | RLS obligatorio y multi-tenant absoluto | EXPLICIT |

## 24. Preguntas o decisiones pendientes

1. Owner debe aprobar o rechazar que TASK-006 sea `Readiness documental para Stage 2 productivo controlado`.
2. Owner debe decidir si TASK-006 debe preparar autorizacion productiva posterior o si debe redefinirse hacia otro bloque del roadmap.
3. Owner debe confirmar si la ejecucion productiva de backup sera una TASK posterior separada.

## 25. Aprobaciones

```text
TASK_006_DEFINITION_STATUS = PROPOSED_PENDING_OWNER_APPROVAL
TASK_006_EXECUTION_AUTHORIZED = NO
TASK_006_IMPLEMENTATION_STARTED = NO
TASK_006_APPROVED_BY_OWNER = NO
TASK_007_AUTHORIZED = NO
HUMAN_AUTHORIZATION_REQUIRED = YES
```

## 26. Ejecucion documental autorizada — 2026-07-29

Registro de aprobacion delegada y readiness documental:

```text
TASK_006_DEFINITION_STATUS = APPROVED_BY_OWNER_DELEGATION
TASK_006_PHASE = FASE_0
TASK_006_SCOPE = DOCUMENTARY_READINESS_ONLY
GATES_AUTHORIZED = 006-A, 006-B, 006-C, 006-D
GATE_006_A_RESULT = PASSED
GATE_006_B_RESULT = PASSED
GATE_006_C_RESULT = PASSED
GATE_006_D_RESULT = PASSED
GATE_006_E_RESULT = PENDING_SEPARATE_OWNER_AUTHORIZATION
TASK_006_EXECUTION_RESULT = PASSED
TASK_006_STATUS = COMPLETED_PENDING_INDEPENDENT_AUDIT
TASK_006_AUDIT_STATUS = PENDING
PRODUCTION_GO = NOT_AUTHORIZED
TASK_007_STARTED = NO
```

Entregables:

```text
READINESS_PACKAGE = TASK_006_DOCUMENTARY_READINESS.md
EVIDENCE_FILE = pruebas/task006_documentary_readiness_evidence_20260729T170127Z.md
```

Esta ejecucion fue exclusivamente documental. No ejecuto Gate 006-E, produccion, PostgreSQL externo, Docker, SQL, migraciones, backup, R2, n8n externo, Mercado Pago, deploy, PR, merge ni TASK-007.
