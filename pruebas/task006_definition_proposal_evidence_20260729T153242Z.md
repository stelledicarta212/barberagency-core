# TASK-006 — Evidencia de propuesta canonica controlada

EVIDENCE_ID = TASK006_DEFINITION_PROPOSAL_20260729T153242Z
CREATED_AT_UTC = 2026-07-29T15:32:42Z
CREATED_AT_AMERICA_BOGOTA = 2026-07-29 10:32:42 -05:00

## 1. Estado Git inicial

```text
REPOSITORY_PATH = C:/Users/calvi/OneDrive/n8n/Visual studio/barberagency-core/.codex-worktrees/task-005-sixth-documentary-correction
REPOSITORY_NAME = barberagency-core
CURRENT_BRANCH = agent/task-005-sixth-documentary-correction
INITIAL_HEAD = 30d66e1fdb0674cf8565f842f1ba01b570802d37
UPSTREAM = origin/agent/task-005-sixth-documentary-correction
INITIAL_AHEAD_BEHIND = 0/0
REMOTE_HEAD_BEFORE = 30d66e1fdb0674cf8565f842f1ba01b570802d37
WORKTREE_CLEAN_BEFORE = YES
TASK_005_CLOSURE_COMMIT_EXISTS = YES
AGENTS_MD_FOUND = NO
```

## 2. Archivos revisados

```text
TASK_005_CONTROLLED_IMPLEMENTATION_PLAN.md
TASK_005_PRE_EXECUTION_REVIEW_V17.md
pruebas/task005_closure_and_task006_discovery_20260729T152640Z.md
pruebas/task005_accelerated_gate_ef_evidence_20260729T150223Z.md
pruebas/task005_gate_d_static_parsers_evidence_20260729T135918Z.md
pruebas/task005_gate_d_independent_audit_evidence_20260729T143523Z.md
backup_production_database.ps1
BARBERAGENCY_MASTER.md
```

No se encontraron en el worktree versionado:

```text
PAGOS-LICENCIAS-IMPLEMENTACION-MASTER.md
BARBERAGENCY-FASE-0-DECISIONES-ARQUITECTURA.md
DX-BARBERAGENCY-MASTER.md
pruebas/DX-BARBERAGENCY-MASTER.md
```

## 3. Busquedas realizadas

```text
git ls-files | rg -n "(TASK-006|TASK_006|task006|task-006|TASK-005|TASK_005|TASK-007|TASK_007|roadmap|ROADMAP|FASE|Stage 2|backup|staging|licencias|billing|RLS|roles|minimos|migraciones|dependencias|criterios|siguiente)"
rg -n "TASK-006|TASK_006|TASK-005|TASK_005|TASK-007|TASK_007|roadmap|ROADMAP|FASE 0|FASE 1|Stage 2|Gate H|backup|staging|licencias|billing|RLS|roles mínimos|roles minimos|migraciones|dependencias|criterios de aceptación|criterios de aceptacion|siguiente tarea|siguiente bloque" -S .
```

## 4. Fuentes encontradas

| Fuente | Hallazgo | Uso |
|---|---|---|
| `TASK_005_CONTROLLED_IMPLEMENTATION_PLAN.md` | Gate H = decision separada sobre Stage 2; Stage 2 fuera de alcance previo | Secuencia posterior a TASK-005 |
| `TASK_005_PRE_EXECUTION_REVIEW_V17.md` | Seccion canonica conserva prohibiciones de Stage 2 sin autorizacion | Limites de seguridad |
| `pruebas/task005_closure_and_task006_discovery_20260729T152640Z.md` | TASK-005 cerrado; TASK-006 bloqueada por definicion no encontrada | Estado inicial |
| `backup_production_database.ps1` | Bloque operacional requiere SSH/R2 y nombres productivos; states fail-closed | Naturaleza de Stage 2 |
| `BARBERAGENCY_MASTER.md` | RLS obligatorio, aislamiento multi-tenant y PostgreSQL como fuente de verdad | Guardrails globales |

## 5. Matriz de trazabilidad

| Decision | Fuente | Clasificacion |
|---|---|---|
| TASK-006 se propone como readiness de Stage 2 | Gate H en `TASK_005_CONTROLLED_IMPLEMENTATION_PLAN.md` | INFERRED_FROM_SEQUENCE |
| TASK-006 no ejecuta backup productivo | Prohibiciones de TASK-005 y prompt actual | EXPLICIT |
| Stage 2 requiere autorizacion productiva posterior | `backup_production_database.ps1` usa SSH/R2/productivo | INFERRED_FROM_SEQUENCE |
| La propuesta debe quedar pendiente de Owner | Prompt actual y ausencia previa de definicion | EXPLICIT |
| Se agregan gates 006-A a 006-E | Control documental nuevo | PROPOSED_NEW_CONTROL |

## 6. Inferencias utilizadas

1. Como Gate H es decision separada sobre Stage 2 y ya fue aprobado, TASK-006 debe comenzar el bloque Stage 2.
2. Como la autorizacion actual prohibe produccion y el script operacional requiere SSH/R2/PostgreSQL productivo, TASK-006 no puede ejecutar Stage 2 real.
3. Como no habia definicion canonica de TASK-006, la salida correcta es propuesta pendiente de aprobacion, no tarea aprobada.

## 7. Ambiguedades encontradas

| Ambiguedad | Alternativas | Recomendacion |
|---|---|---|
| Si TASK-006 debe ejecutar backup real o preparar readiness | Ejecutar produccion / preparar readiness documental | Preparar readiness documental, porque produccion esta prohibida |
| Si TASK-006 pertenece a FASE 0 o FASE 1 | Cierre de FASE 0 / inicio operativo Stage 2 | Marcar como inicio propuesto de Stage 2 pendiente de Owner |
| Si la ejecucion productiva sera TASK-006 o TASK posterior | TASK-006 productiva / TASK posterior separada | Requerir decision humana explicita |

## 8. Alternativas evaluadas

1. Definir TASK-006 como ejecucion productiva inmediata: rechazada porque contradice las prohibiciones.
2. Definir TASK-006 como implementacion tecnica adicional del script: rechazada porque TASK-005 ya cerro esa etapa y el prompt actual es documental.
3. Definir TASK-006 como readiness documental de Stage 2: recomendada porque resuelve el bloqueo sin ampliar permisos.

## 9. Justificacion de la propuesta

La propuesta conserva el flujo aprobado: TASK-005 cierra controles previos, Gate H abre la conversacion sobre Stage 2, y TASK-006 prepara el paquete documental necesario para que el Owner pueda decidir una autorizacion productiva posterior con riesgos, evidencias y rollback claros.

## 10. Archivos modificados

```text
TASK_006_CANONICAL_DEFINITION.md
pruebas/task006_definition_proposal_evidence_20260729T153242Z.md
```

`PAGOS-LICENCIAS-IMPLEMENTACION-MASTER.md` no fue modificado porque no existe en el worktree versionado actual.

## 11. Confirmaciones de seguridad

```text
TASK_006_IMPLEMENTED = NO
TASK_006_EXECUTION_AUTHORIZED = NO
CODE_MODIFIED = NO
SQL_MODIFIED = NO
SCRIPTS_MODIFIED = NO
INFRASTRUCTURE_MODIFIED = NO
DOCKER_EXECUTED = NO
POSTGRESQL_ACCESSED = NO
PRODUCTION_ACCESSED = NO
EASYPANEL_ACCESSED = NO
POSTGRESQL_EXTERNAL_ACCESSED = NO
ENV_FILES_READ = NO
SECRETS_READ = NO
R2_ACCESSED = NO
N8N_EXTERNAL_ACCESSED = NO
MERCADOPAGO_ACCESSED = NO
PAYMENTS_EXECUTED = NO
DEPLOY_EXECUTED = NO
PR_CREATED = NO
MERGE_EXECUTED = NO
TASK_007_STARTED = NO
```

## 12. Estado final propuesto

```text
TASK_005_FINAL_STATUS = CLOSED
TASK_006_DEFINITION_FILE = TASK_006_CANONICAL_DEFINITION.md
TASK_006_DEFINITION_STATUS = PROPOSED_PENDING_OWNER_APPROVAL
TASK_006_EXECUTION_AUTHORIZED = NO
TASK_006_IMPLEMENTATION_STARTED = NO
TASK_006_AUDIT_STATUS = NOT_APPLICABLE_DEFINITION_PROPOSAL
RESULT = PASSED
NEXT_ACTION = Someter la definicion propuesta de TASK-006 a aprobacion humana
HUMAN_AUTHORIZATION_REQUIRED = YES
```
