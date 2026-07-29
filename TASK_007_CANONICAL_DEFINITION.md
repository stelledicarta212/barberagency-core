# TASK-007 — Propuesta de solicitud y preflight final de Gate 006-E para Stage 2

## Estado

```text
TASK_007_DEFINITION_STATUS = PROPOSED_PENDING_OWNER_APPROVAL
TASK_007_EXECUTION_AUTHORIZED = NO
TASK_007_IMPLEMENTATION_STARTED = NO
TASK_007_PHASE = FASE_0
PRODUCTION_GO = NOT_AUTHORIZED
GATE_006_E_RESULT = PENDING_SEPARATE_OWNER_AUTHORIZATION
CREATED_AT_UTC = 2026-07-29T23:15:10Z
CREATED_AT_AMERICA_BOGOTA = 2026-07-29 18:15:10 -05:00
```

Esta es una propuesta canonica. No autoriza ejecutar TASK-007, Gate 006-E, Stage 2, backup, R2, PostgreSQL productivo, EasyPanel, SQL, migraciones, deploy, PR ni merge.

## Antecedentes y dependencia de TASK-006

TASK-006 cerro el readiness documental para Stage 2 y dejo Gate 006-E pendiente de autorizacion separada. La auditoria independiente de TASK-006 fue aprobada sin hallazgos en el commit `fe66798d9a38c35547a29c0347a09a3b8ff6f874`.

TASK-007 depende de:

```text
TASK_005_FINAL_STATUS = CLOSED
TASK_006_FINAL_STATUS = CLOSED
TASK_006_AUDIT_STATUS = PASSED_INDEPENDENT_AUDIT
GATES_006_A_TO_006_D = PASSED
GATE_006_E_RESULT = PENDING_SEPARATE_OWNER_AUTHORIZATION
PRODUCTION_GO = NOT_AUTHORIZED
```

## Fuentes canonicas utilizadas

| Fuente | Uso |
|---|---|
| `TASK_006_CANONICAL_DEFINITION.md` | Define TASK-006 como readiness de Stage 2 y condiciones para habilitar TASK-007 |
| `TASK_006_DOCUMENTARY_READINESS.md` | Define runbook, preflight, riesgos, rollback y matriz GO/NO-GO |
| `pruebas/task006_independent_audit_evidence_20260729T230800Z.md` | Registra auditoria independiente aprobada y Gate 006-E pendiente |
| `TASK_005_CONTROLLED_IMPLEMENTATION_PLAN.md` | Establece Stage 2 como decision separada |
| `backup_production_database.ps1` | Identifica que Stage 2 implica backup productivo, SSH, PostgreSQL productivo y R2 |
| `BARBERAGENCY_MASTER.md` | Establece guardrails de RLS, aislamiento y PostgreSQL como fuente de verdad |

## Hechos verificados

1. TASK-005 esta cerrada.
2. TASK-006 fue definida, ejecutada documentalmente y auditada.
3. Gate 006-E permanece pendiente de autorizacion separada.
4. No hay GO productivo.
5. TASK-007 no ha comenzado.
6. Stage 2 implica acciones productivas si se ejecuta realmente.

## Inferencias identificadas

| Inferencia | Clasificacion |
|---|---|
| TASK-007 debe ubicarse despues del cierre auditado de TASK-006 | INFERRED_FROM_SEQUENCE |
| TASK-007 debe preparar o solicitar Gate 006-E, no ejecutar Stage 2 automaticamente | INFERRED_FROM_SEQUENCE |
| La ejecucion productiva real debe requerir decision puntual posterior | EXPLICIT_FROM_SECURITY_LIMITS |

## Ambiguedades

| Ambiguedad | Alternativas | Recomendacion |
|---|---|---|
| Si TASK-007 debe ser Gate 006-E o un preflight previo | Gate 006-E directo / preflight final para solicitar Gate 006-E | Preflight final y solicitud de decision GO/NO-GO |
| Si TASK-007 debe ejecutar Stage 2 productivo | Ejecucion productiva / solicitud documental | Solicitud documental; ejecucion productiva requiere autorizacion posterior |
| Si TASK-007 cierra FASE 0 o inicia FASE 1 | Cierre FASE 0 / inicio FASE 1 | Mantener FASE 0 hasta decision productiva explicita |

## Posicion propuesta en roadmap/fase

```text
TASK_007_POSITION_IN_ROADMAP = FASE_0_GATE_006_E_AUTHORIZATION_REQUEST_AND_FINAL_PREFLIGHT
```

TASK-007 se propone como la tarea que prepara la decision final del Owner sobre Gate 006-E, sin ejecutar la accion productiva.

## Objetivo unico

Preparar y someter al Owner el paquete final de decision GO/NO-GO para Gate 006-E de Stage 2, incluyendo confirmacion de auditoria TASK-006, checklist productivo, ventana propuesta, riesgos residuales, rollback y autorizacion requerida.

## Alcance incluido

- Consolidar el paquete de decision Gate 006-E.
- Verificar que TASK-006 esta cerrada y auditada.
- Revisar el runbook y matriz GO/NO-GO existentes.
- Preparar una solicitud formal de autorizacion productiva.
- Definir evidencia esperada para una ejecucion posterior.
- Mantener produccion bloqueada.

## Alcance excluido

- Ejecutar Gate 006-E.
- Aprobar GO productivo.
- Ejecutar Stage 2.
- Ejecutar backup o restore.
- Acceder a PostgreSQL productivo.
- Acceder a R2 real.
- Leer `.env` o secretos.
- Ejecutar SQL, migraciones, Docker, deploy, PR o merge.
- Modificar codigo funcional, scripts o infraestructura.

## Entregables

1. Solicitud formal de decision Gate 006-E.
2. Checklist final de preflight productivo.
3. Matriz de riesgos residuales.
4. Confirmacion de auditoria TASK-006.
5. Condiciones GO/NO-GO para Owner.
6. Evidencia documental bajo `pruebas/`.

## Gates propuestos

| Gate | Nombre | Resultado permitido |
|---|---|---|
| 007-A | Verificacion de cierre TASK-006 | PASSED / BLOCKED |
| 007-B | Paquete de decision Gate 006-E | PASSED / BLOCKED |
| 007-C | Riesgos residuales y rollback final | PASSED / BLOCKED |
| 007-D | Solicitud Owner GO/NO-GO preparada | PASSED / BLOCKED |
| 007-E | Decision productiva del Owner | PENDING_SEPARATE_OWNER_AUTHORIZATION |

## Criterios de aceptacion

TASK-007 solo puede quedar `COMPLETED_PENDING_OWNER_DECISION` si:

- no ejecuta ninguna accion productiva;
- contiene solicitud formal de Gate 006-E;
- identifica riesgos residuales;
- mantiene `PRODUCTION_GO = NOT_AUTHORIZED`;
- deja `TASK_007_EXECUTION_AUTHORIZED = NO` hasta aprobacion;
- no modifica codigo, SQL, scripts ni infraestructura;
- no inicia una tarea posterior.

## Riesgos

| Riesgo | Severidad | Control |
|---|---|---|
| Confundir solicitud con GO productivo | Alta | Estados fail-closed |
| Ejecutar Stage 2 sin autorizacion | Critica | Gate 007-E separado |
| Exponer secretos | Alta | Sin `.env`, sin credenciales, comandos sanitizados |
| Saltar auditoria | Alta | Verificar commit auditado TASK-006 |

## Restricciones de seguridad

TASK-007 propuesta mantiene prohibidas todas las acciones productivas hasta decision humana puntual:

```text
PRODUCTION_GO = NOT_AUTHORIZED
PRODUCTION_ACTION_EXECUTED = NO
GATE_006_E_RESULT = PENDING_SEPARATE_OWNER_AUTHORIZATION
```

## Acciones reversibles y no productivas

- Lectura documental local.
- Preparacion de checklist.
- Preparacion de solicitud GO/NO-GO.
- Validaciones Git.
- Evidencia Markdown.

## Acciones que exigirian autorizacion puntual

- Ejecutar Gate 006-E.
- Ejecutar `backup_production_database.ps1` en modo real.
- Acceder a SSH, PostgreSQL productivo o R2.
- Leer credenciales.
- Ejecutar backup, restore, SQL, migraciones o deploy.

## Estrategia de auditoria independiente

Si TASK-007 se aprueba y ejecuta documentalmente, debe quedar lista para auditoria independiente unica antes de cualquier accion productiva.

## Condiciones de bloqueo

- Ausencia de auditoria TASK-006 aprobada.
- Cualquier intento de ejecutar produccion.
- Secretos detectados.
- Worktree sucio o cambios fuera de alcance.
- Ambiguedad no resuelta sobre GO/NO-GO.

## Estado final permitido

```text
TASK_007_DEFINITION_STATUS = PROPOSED_PENDING_OWNER_APPROVAL
TASK_007_EXECUTION_AUTHORIZED = NO
TASK_007_IMPLEMENTATION_STARTED = NO
PRODUCTION_GO = NOT_AUTHORIZED
GATE_006_E_RESULT = PENDING_SEPARATE_OWNER_AUTHORIZATION
```

## Decisiones exactas pendientes del Owner

1. Aprobar o rechazar esta definicion propuesta de TASK-007.
2. Confirmar si TASK-007 debe preparar la decision Gate 006-E o si debe ejecutar otra etapa.
3. Confirmar que cualquier GO productivo queda fuera de esta propuesta y requiere autorizacion separada.
