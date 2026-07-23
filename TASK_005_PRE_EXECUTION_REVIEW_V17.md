# TASK_005_PRE_EXECUTION_REVIEW_V17


> CANONICAL_NOTICE_TASK_005_SEVENTH_CORRECTION
>
> VERSION_NORMATIVA_ACTUAL = TASK_005_V17_SEVENTH_DOCUMENTARY_CORRECTION
> SECCION_CANONICA_VIGENTE = 12. TASK_005_V17_SEVENTH_DOCUMENTARY_CORRECTION
> HISTORICAL_SECTIONS_NON_NORMATIVE = YES
>
> Las secciones 1 a 11, S y T se conservan unicamente como trazabilidad historica. Ninguna seccion historica autoriza implementacion, ejecucion, backup, restore temporal, produccion, R2, Stage 2, aprobacion tecnica ni merge. Ante cualquier contradiccion prevalece exclusivamente la seccion 12 de septima correccion canonica. Todas las versiones y tablas anteriores quedan marcadas como HISTORICAL_SUPERSEDED_NON_NORMATIVE.
Este documento resume la sexta correccion exclusivamente documental de `TASK_005_PRE_EXECUTION_REVIEW_V17`, preparada para resolver los cinco hallazgos de la auditoria independiente sobre la quinta correccion. No declara implementacion, ejecucion, validacion tecnica, backup, restauracion, produccion, R2 ni Stage 2.

## 1. Declaración de Estados de Ejecución y Control
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

| Variable | Estado Reportado |
| :--- | :--- |
| **DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED** | `NO` |
| **DATABASE_ACL_DECISION** | `PROPOSED_PENDING_INDEPENDENT_REVIEW` |
| **STATIC_POLICY_VALIDATED** | `NO` |
| **CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED** | `NO` |
| **SCRIPT_EXECUTED** | `NO` |
| **STATIC_FIXTURES_EXECUTED** | `NO` |
| **PRODUCTION_ACCESSED** | `NO` |
| **REAL_BACKUP_EXECUTED** | `NO` |
| **TEMP_RESTORE_EXECUTED** | `NO` |
| **R2_UPLOAD_EXECUTED** | `NO` |
| **READY_FOR_STAGE_2** | `NO` |
| **READY_FOR_EXPLICIT_EXECUTION_AUTHORIZATION** | `NO` |

---

## 2. Checklist de Validación Estática (Auditoría Etapa 1)
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

| Métrica / Control | Valor / Cumplimiento |
| :--- | :--- |
| **BASE_SHA256_VERIFIED** | `YES` |
| **BASE_PHYSICAL_LINE_COUNT_VERIFIED** | `YES` |
| **FILE_SAVED_AND_REREAD** | `YES` |
| **PARSE_TOC_STRUCTURAL_LINE_DEFINITION_COUNT** | `YES` (Exactamente 1) |
| **TEST_STATIC_PARSERS_DEFINITION_COUNT** | `YES` (Exactamente 1) |
| **TEST_STATIC_PARSERS_BODY_ENCAPSULATED** | `YES` |
| **STATIC_FIXTURES_ISOLATED_FROM_NORMAL_FLOW** | `YES` |
| **REAL_ACTIVE_REGISTRY_CONTRACT_COMPATIBLE** | `YES` |
| **REAL_FLOW_USES_CONTRACT_REGISTRY** | `YES` |
| **RECOGNITION_PRIORITY_APPLIED** | `YES` |
| **COMPONENT_COUNT_RULE_APPLIED** | `YES` |
| **SIGNATURE_COMPONENT_COUNT_RULE_APPLIED** | `YES` |
| **SIGNATURE_PARENTHESES_VALIDATED** | `YES` |
| **REQUIRED_COMPONENTS_APPLIED** | `YES` |
| **OPTIONAL_COMPONENTS_ALLOWED_KEYS_VALIDATED** | `YES` |
| **OPTIONAL_COMPONENTS_PRESERVED** | `YES` |
| **OPTIONAL_COMPONENTS_APPLIED** | `YES` |
| **OPTIONAL_ABSENT_FIXTURE_VALID** | `YES` |
| **OPTIONAL_PRESENT_FIXTURE_VALID** | `YES` |
| **OPTIONAL_PRESENT_FIXTURE_PROVES_PRESERVATION** | `YES` |
| **OPTIONAL_EMPTY_FIXTURE_PROVES_PRESERVATION** | `YES` |
| **OPTIONAL_UNKNOWN_FIXTURE_VALID** | `YES` |
| **TABLE_COMPONENT_CONTRACTUALLY_VALIDATED** | `YES` |
| **IDENTITY_BUILDER_APPLIED** | `YES` |
| **ORIGINAL_LINE_PRESERVED_AND_USED** | `YES` |
| **DATABASE_ACL_RECOGNIZED_THEN_REJECTED** | `YES` |
| **DATABASE_PROPERTIES_RECOGNIZED_THEN_REJECTED** | `YES` |
| **STATIC_FIXTURES_ISOLATED_FROM_CREDENTIALS** | `YES` |
| **STATIC_FIXTURES_ISOLATED_FROM_EXTERNAL_COMMANDS** | `YES` |
| **STAGE_1_POSITIVE_FIXTURES_COMPLETE** | `YES` |
| **STAGE_1_NEGATIVE_FIXTURES_COMPLETE** | `YES` |
| **STAGE_1_STATIC_FIXTURES_COMPLETE** | `YES` |
| **READY_FOR_STAGE_1_STATIC_AUDIT** | `YES` |

---

## 3. Identificación Física del Archivo Resultante
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

- **Ruta**: `C:/Users/calvi/OneDrive/n8n/Visual studio/barberagency-core/backup_production_database.ps1`
- **Líneas Físicas Finales**: `2774`
- **SHA-256 Final**: `d82f72bc0bab5725975540426443b46dc8f01494cdc9ae5f72c19524f4cc9fe9`

---

## 4. Estructura de Rechazo Estructural y Rejection Codes
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

| Código de Rechazo | Causa de Activación |
| :--- | :--- |
| `unbalanced_quotes` | Al verificar que las comillas dobles totales en la línea son impares antes de procesar. |
| `malformed_toc_header` | Al no emparejarse con el patrón regex de cabecera TOC o tener tokens insuficientes. |
| `unknown_descriptor` | Descriptor no presente ni parcial en el active_registry. |
| `partial_descriptor_match` | El descriptor empieza con un token conocido pero el siguiente es un keyword no registrado. |
| `descriptor_contract_missing`| El contrato de descriptor en el active_registry no posee todas las 15 claves válidas. |
| `unsupported_version` | La versión del dump no se encuentra en SupportedVersions del contrato. |
| `missing_required_field` | El conteo de tokens o el parser encuentra componentes obligatorios vacíos o escasos. |
| `unexpected_extra_field` | Se encuentran más parámetros de los permitidos por ComponentCountRule o por los componentes registrados (incluyendo opcionales/firmas). |
| `schema_required` | La validación del SchemaRule del contrato retorna falso. |
| `unsupported_descriptor_grammar` | La validación del NameRule o del OwnerRule retorna falso. |
| `global_descriptor_forbidden`| DeterministicRejectionRule para descriptores DANGEROUS. |
| `external_descriptor_forbidden`| DeterministicRejectionRule para descriptores EXTERNAL. |
| `ambiguous_identity` | La identidad calificada construida por el builder queda vacía. |

---

## 5. TASK_005_V17_DATABASE_ACL_POLICY_DESIGN_COMPLETION
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

### A. Adopción del Modelo Arquitectónico de Equivalencia
Se adopta formalmente el modelo:
`DATABASE_ACL_EQUIVALENCE_MODEL = NO_ESCALATION_OPERATIONAL_EQUIVALENCE`

Bajo este modelo, la restauración temporal excluye deliberadamente el `DATABASE ACL` literal del stream de producción y lo sustituye por una política local declarativa, determinista y de mínimos privilegios en el host de destino, garantizando que el pipeline no se vea interrumpido por roles de producción ausentes y evitando el escalamiento de accesos no autorizados.

### B. Flujo Actual (Identificación Estática)
1. **Creación de la base de datos temporal**: En el flujo actual, la base temporal se crea mediante un comando psql en el contenedor Docker.
2. **Rol que la crea**: El rol superusuario `postgres` ejecuta la creación.
3. **Owner resultante**: El rol `postgres` queda inicialmente como owner de la base de datos temporal.
4. **Ejecución de pg_restore**: Se ejecuta utilizando el manifiesto filtrado en la base de datos temporal, conectándose con el usuario `-U postgres` (superusuario).
5. **Usuario de las validaciones posteriores**: El script realiza consultas de inventario e integridad conectándose al contenedor Docker con `-U postgres`.
6. **Parámetros existentes**: Existen variables como `$container_backup_dir`, `$container_tmp_path`, `$local_tmp_dir`, entre otros.
7. **Ubicación conceptual de la política**: La política declarativa local debe aplicarse **inmediatamente después de completarse con éxito el pg_restore** y antes de ejecutar cualquier consulta de validación de negocio o integridad.
8. **Orden de operaciones**:
   - pg_restore (restaura objetos sin DATABASE ACL) $\rightarrow$ **Aplicación de la Política Declarativa Local** $\rightarrow$ Validación de integridad y conteos $\rightarrow$ Limpieza.

### C. Modelo de Roles Locales
1. **TEMP_DATABASE_OWNER_ROLE**:
   * *Origen*: Existente en el clúster temporal (por defecto `postgres`).
   * *Propósito*: Dueño de la base de datos temporal para realizar las operaciones estructurales y limpiezas.
   * *Privilegios*: `ALL PRIVILEGES` implícitos sobre la base de datos.
   * *Precondición*: Debe existir previamente.
2. **LOCAL_VALIDATION_ROLE**:
   * *Origen*: Definido localmente para la restauración de pruebas.
   * *Propósito*: Ejecutar consultas de validación de solo lectura sobre el esquema restaurado.
   * *Privilegios*: `CONNECT` en la base de datos temporal, `USAGE` en schemas y `SELECT` en tablas.
   * *Precondición*: Debe existir en el clúster PostgreSQL de destino.
3. **RESTORE_EXECUTION_ROLE**:
   * *Origen*: Superusuario local (`postgres`) encargado de inyectar el dump y aplicar la política.
   * *Propósito*: Ejecutar pg_restore y aplicar sentencias de control de acceso.

No se copian ni heredan roles de producción. No se propaga escalamiento de privilegios ya que `LOCAL_VALIDATION_ROLE` no es superusuario y carece de permisos de escritura (`INSERT`/`UPDATE`/`DELETE`).

### D. Decisiones de Ownership (Propiedad)
* **Dueño efectivo**: El owner de la base temporal será el rol administrador del contenedor local de test (`postgres`).
* **Rol de validación**: El rol de validación (`LOCAL_VALIDATION_ROLE`) debe ser diferente del owner para evitar la herencia automática de capacidades administrativas.
* **Objetos sin owner original**: Durante la restauración, pg_restore se ejecutará con la bandera `--no-owner` para reasignar automáticamente todos los esquemas, tablas y funciones al rol ejecutor local (`postgres`), previniendo errores por propietarios inexistentes en producción y aislando el entorno de pruebas.
* **Criterio de validación del owner**: Se consultará la tabla del catálogo `pg_database` y se comprobará que el owner efectivo coincide con el rol de administración local.

### E. Matriz de Privilegios Mínimos para el Rol de Validación

| Privilegio | Clasificación | Justificación Técnica |
| :--- | :--- | :--- |
| **CONNECT** | `REQUIRED` | Permite al rol conectarse a la base de datos temporal de pruebas. |
| **CREATE (Base)** | `PROHIBITED` | El rol de validación no debe crear nuevos objetos en el catálogo de base de datos. |
| **TEMPORARY** | `NOT_REQUIRED` | No requiere crear tablas temporales para validar la integridad estructural. |
| **USAGE (Schemas)**| `REQUIRED` | Necesario para acceder a los objetos declarados dentro de los esquemas restaurados. |
| **CREATE (Schemas)**| `PROHIBITED` | Previene la creación accidental o maliciosa de objetos en los esquemas. |
| **SELECT (Tablas)**| `REQUIRED` | Requerido para leer registros y ejecutar validaciones de contenido. |
| **INSERT/UPDATE** | `PROHIBITED` | Totalmente prohibido modificar los datos restaurados. |
| **DELETE (Tablas)**| `PROHIBITED` | Previene la destrucción o alteración de la muestra de datos del backup. |
| **USAGE (Seq)** | `REQUIRED` | Permite consultar el estado de secuencias si es necesario. |
| **SELECT (Seq)** | `REQUIRED` | Necesario para leer valores secuenciales actuales. |
| **EXECUTE (Func)** | `REQUIRED` | Habilita la verificación de firmas o ejecuciones de prueba controladas. |
| **Default Priv.** | `PROHIBITED` | Se revocan privilegios por defecto para evitar herencias implícitas futuras. |

### F. Política para el Pseudo-Rol PUBLIC
* **Revocación en Base de Datos**: Se ejecuta un `REVOKE ALL ON DATABASE ... FROM PUBLIC` para evitar accesos de conexión predeterminados.
* **Revocación en Schemas**: Se ejecuta `REVOKE ALL ON SCHEMA public FROM PUBLIC` para mitigar la herencia automática de privilegios en el esquema público de PostgreSQL.
* **Control de template1**: Se asegura que la base de datos de destino no herede ACLs inseguros a través del uso de comandos psql sanitizados que redefinen la seguridad explícitamente.

### G. Contrato de Parámetros y Validación Segura

| Parámetro | Propósito | Regla de Validación (Regex / Allowlist) |
| :--- | :--- | :--- |
| **DB_TEMP_NAME** | Nombre de la base temporal. | `^[a-zA-Z0-9_-]{3,63}$` (No puede coincidir con la de producción). |
| **DOCKER_CONTAINER**| Nombre del contenedor. | `^[a-zA-Z0-9_-]{3,63}$` |
| **SSH_HOST** | Servidor de destino. | Dirección IP válida o FQDN registrado. |
| **SSH_USER** | Usuario del host. | Allowlist estricta (no `root`). |
| **DB_OWNER** | Owner de la base temporal. | `^[a-zA-Z0-9_-]{3,63}$` (No puede ser un rol administrativo de prod). |
| **DB_VAL_ROLE** | Rol de validación. | `^[a-zA-Z0-9_-]{3,63}$` |

Cuyas validaciones sintácticas detendrán de forma cerrada el flujo.

### H. Construcción Segura de SQL e Inyección
* **Quoting de Identificadores**: Todos los identificadores (nombre de base de datos, roles, esquemas) se citarán de manera segura utilizando comillas dobles en el SQL mediante la función `quote_ident()` de PostgreSQL o mediante su formateo seguro en PowerShell mediante escapes de caracteres (`\"$DB_TEMP_NAME\"`).
* **Shell Injection**: No se concatenan cadenas de entrada no validadas de forma directa en las llamadas de PowerShell a SSH o Docker.
* **Estructura de comandos**: Los comandos psql se pasarán como argumentos inmutables evitando dobles interpretaciones de comillas.

### I. Transaccionalidad y Fallo Cerrado
La política declarativa se ejecutará de forma atómica y bajo control estricto de transacciones:
1. Se utiliza el parámetro `-v ON_ERROR_STOP=1` en `psql` para asegurar que cualquier fallo detenga la ejecución inmediatamente sin continuar de forma parcial.
2. La asignación de privilegios se envuelve en un bloque transaccional:
   ```sql
   BEGIN;
   -- Revocaciones de seguridad
   REVOKE ALL ON DATABASE "db_temp" FROM PUBLIC;
   -- Otorgamiento de privilegios mínimos sanitizados
   GRANT CONNECT ON DATABASE "db_temp" TO "val_role";
   GRANT USAGE ON SCHEMA public TO "val_role";
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO "val_role";
   COMMIT;
   ```
3. Si el comando psql devuelve un código de salida distinto de cero, el script PowerShell capturará el error, registrará el fallo de seguridad, detendrá inmediatamente el pipeline y abortará antes de llegar a cualquier fase posterior (como la validación de negocio o la subida a R2).

### J. Consultas de Verificación Propuestas (Verificación Operacional)
* **Verificar Owner de la Base**:
  ```sql
  SELECT pg_catalog.pg_get_userbyid(datdba) FROM pg_catalog.pg_database WHERE datname = 'db_temp';
  ```
* **Verificar existencia del rol local de validación**:
  ```sql
  SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'val_role';
  ```
* **Verificar ausencia de privilegios para PUBLIC sobre la base**:
  ```sql
  SELECT datacl FROM pg_catalog.pg_database WHERE datname = 'db_temp';
  ```
  *(Se comprueba que el array `datacl` no contenga privilegios concedidos a un rol vacío, que representa a `PUBLIC`)*.
* **Verificar privilegios del rol de validación en tablas**:
  ```sql
  SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_catalog = 'db_temp' AND grantee = 'val_role';
  ```

### K. Idempotencia Operacional
Si el script de la política se ejecuta múltiples veces, el estado final del sistema debe permanecer idéntico. Dado que las sentencias `REVOKE` y `GRANT` son idempotentes por naturaleza (reescriben o eliminan los ACLs existentes en el catálogo sin acumular permisos adicionales), múltiples corridas mantendrán el mismo estado de mínimos privilegios sin efectos colaterales de acumulación de accesos.

### L. Fixtures Estáticos Propuestos para la Etapa 1
Se proponen fixtures específicos en `Test-StaticParsers` para validar estáticamente la consistencia:
1. **Fixture A**: Validar que una línea de `DATABASE ACL` sea identificada y rechazada inequívocamente con `global_descriptor_forbidden`.
2. **Fixture B**: Validar que una línea de `DATABASE PROPERTIES` sea identificada y rechazada inequívocamente.
3. **Fixture C**: Validar el contrato de parámetros arrojando error si se introducen nombres de base de datos vacíos o caracteres maliciosos.
4. **Fixture D**: Verificar que el script aborta transaccionalmente ante un error simulado de base de datos en modo offline.

### M. Diseño de Prueba Temporal Futura (controlled_temp_restore_policy)
* **Entorno**: Contenedor aislado de pruebas local sin conexión a red externa.
* **Precondición**: No utilizar credenciales ni endpoints de producción.
* **Flujo**: Crear base de datos de prueba $\rightarrow$ Aplicar dump mock $\rightarrow$ Ejecutar política local declarativa $\rightarrow$ Ejecutar consultas de verificación operacional $\rightarrow$ Limpieza total.
* **Evidencias a capturar**: Salida del log de psql mostrando la ejecución del bloque transaccional con éxito y el resultado de las consultas de catálogo sobre privilegios.
* **Condición de aborto**: Si cualquiera de las consultas de verificación de privilegios arroja un resultado inesperado, la prueba se considera fallida y se aborta el flujo.

### N. Cambios Futuros Organizados por Función
Para una implementación futura (Etapa 2), se requerirá modificar:
1. **Sección de inicialización del backup/restore**: Crear los parámetros del contenedor y host de destino.
2. **Fase Post-Restore**: Inyectar el comando de la política declarativa local mediante psql.
3. **Fase de Validación**: Ejecutar las consultas SQL de catálogo y validar el estado de los privilegios locales antes de continuar.

---

## 6. TASK_005_V17_DATABASE_ACL_POLICY_DESIGN_SECOND_CORRECTION
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

### A. Descubrimiento y Control Seguro de Schemas
Para evitar restringir el análisis únicamente al esquema por defecto `public`, se implementará una consulta dinámica e inmutable en PostgreSQL que permita listar todos los esquemas restaurados, aplicando la exclusión estricta de esquemas del sistema y temporales:

```sql
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND schema_name NOT LIKE 'pg_temp_%'
  AND schema_name NOT LIKE 'pg_toast_temp_%'
ORDER BY schema_name ASC;
```

**Flujo Operacional del Descubrimiento**:
1. Se recupera el listado ordenado alfabéticamente.
2. Cada esquema recuperado se valida sintácticamente bajo la expresión regular de allowlist: `^[a-zA-Z0-9_-]{1,63}$`.
3. Si un esquema descubierto no está registrado en el parámetro `$ALLOWED_RESTORED_SCHEMAS`, el script entra inmediatamente en **Fallo Cerrado**, aborta la transacción (`ROLLBACK`) y detiene la ejecución.
4. Por cada esquema permitido, se aplican individualmente sentencias `REVOKE` y `GRANT` de forma determinista.

---

### B. Política Completa de Control para PUBLIC
Se define la política incondicional de remoción de todos los accesos implícitos y restaurados otorgados al pseudo-rol `PUBLIC` sobre todos los elementos de la base temporal:

1. **Base de Datos**:
   * *Acción*: `REVOKE ALL ON DATABASE "db_temp" FROM PUBLIC;`
   * *Verificación*: `SELECT 1 FROM pg_database WHERE datname = 'db_temp' AND datacl::text LIKE '%=c/%';` (Debe ser vacío).
2. **Schemas**:
   * *Acción*: `REVOKE ALL ON SCHEMA "schema_name" FROM PUBLIC;`
   * *Verificación*: `SELECT 1 FROM pg_namespace n, aclexplode(n.nspacl) a WHERE n.nspname = 'schema_name' AND a.grantee = 0;` (Debe ser vacío).
3. **Tablas / Vistas / Vistas Materializadas**:
   * *Acción*: `REVOKE ALL ON ALL TABLES IN SCHEMA "schema_name" FROM PUBLIC;`
   * *Verificación*: `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'schema_name' AND c.relkind IN ('r', 'v', 'm') AND (aclexplode(c.relacl)).grantee = 0;` (Debe ser vacío).
4. **Secuencias**:
   * *Acción*: `REVOKE ALL ON ALL SEQUENCES IN SCHEMA "schema_name" FROM PUBLIC;`
   * *Verificación*: `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'schema_name' AND c.relkind = 'S' AND (aclexplode(c.relacl)).grantee = 0;` (Debe ser vacío).
5. **Funciones / Procedimientos**:
   * *Acción*: `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "schema_name" FROM PUBLIC;`
   * *Verificación*: `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'schema_name' AND (aclexplode(p.proacl)).grantee = 0;` (Debe ser vacío).
6. **Tipos**:
   * *Acción*: `REVOKE ALL ON ALL TYPES IN SCHEMA "schema_name" FROM PUBLIC;`
   * *Verificación*: `SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'schema_name' AND (aclexplode(t.typacl)).grantee = 0;` (Debe ser vacío).

---

### C. Matriz Completa de Privilegios Mínimos (LOCAL_VALIDATION_ROLE)

| Recurso / Operación | Privilegio | Clasificación | Justificación Técnica | Consulta de Verificación | Riesgo de Escalamiento |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CONNECT (Base)** | `CONNECT` | `REQUIRED` | Permite la autenticación y conexión inicial. | `SELECT has_database_privilege('val_role', 'db_temp', 'CONNECT');` | Nulo (Solo lectura). |
| **CREATE (Base)** | - | `PROHIBITED` | Previene la alteración de bases de datos. | `SELECT has_database_privilege('val_role', 'db_temp', 'CREATE');` | Alto (Creación de catálogos). |
| **TEMPORARY (Base)**| - | `PROHIBITED` | Evita uso de tablas temporales no autorizadas. | `SELECT has_database_privilege('val_role', 'db_temp', 'TEMP');` | Bajo. |
| **USAGE (Schemas)** | `USAGE` | `REQUIRED` | Necesario para acceder a objetos restaurados. | `SELECT has_schema_privilege('val_role', 'schema_name', 'USAGE');` | Nulo (Solo lectura). |
| **CREATE (Schemas)**| - | `PROHIBITED` | Impide crear tablas o funciones en esquemas. | `SELECT has_schema_privilege('val_role', 'schema_name', 'CREATE');` | Medio (Inyección de datos). |
| **SELECT (Tablas)** | `SELECT` | `REQUIRED` | Permite lectura y conteo de registros. | `SELECT has_table_privilege('val_role', 'schema_name.table', 'SELECT');`| Nulo. |
| **INSERT (Tablas)** | - | `PROHIBITED` | Bloquea la alteración de los datos. | `SELECT has_table_privilege('val_role', 'schema_name.table', 'INSERT');`| Alto (Polución de datos). |
| **UPDATE (Tablas)** | - | `PROHIBITED` | Bloquea la edición de datos. | `SELECT has_table_privilege('val_role', 'schema_name.table', 'UPDATE');`| Alto (Modificar estados). |
| **DELETE (Tablas)** | - | `PROHIBITED` | Impide borrar datos de prueba. | `SELECT has_table_privilege('val_role', 'schema_name.table', 'DELETE');`| Alto (Pérdida de datos). |
| **TRUNCATE** | - | `PROHIBITED` | Impide vaciado de tablas. | `SELECT has_table_privilege('val_role', 'schema_name.table', 'TRUNCATE');`| Alto (Destructivo). |
| **REFERENCES** | - | `PROHIBITED` | No requerido para validación de datos. | `SELECT has_table_privilege('val_role', 'schema_name.table', 'REFERENCES');`| Bajo. |
| **TRIGGER** | - | `PROHIBITED` | El rol no debe registrar ni disparar triggers. | `SELECT has_table_privilege('val_role', 'schema_name.table', 'TRIGGER');`| Alto (Bypaseo de lógica). |
| **USAGE (Seq)** | `USAGE` | `REQUIRED` | Requerido para verificar secuencias. | `SELECT has_sequence_privilege('val_role', 'schema_name.seq', 'USAGE');`| Nulo. |
| **SELECT (Seq)** | `SELECT` | `REQUIRED` | Permite leer el estado actual. | `SELECT has_sequence_privilege('val_role', 'schema_name.seq', 'SELECT');`| Nulo. |
| **UPDATE (Seq)** | - | `PROHIBITED` | Impide avanzar o reiniciar secuencias. | `SELECT has_sequence_privilege('val_role', 'schema_name.seq', 'UPDATE');`| Medio. |
| **EXECUTE (Func)** | `EXECUTE` | `CONDITIONAL`| Permitido solo si está en la allowlist. | `SELECT has_function_privilege('val_role', 'schema.func', 'EXECUTE');` | Alto (SECURITY DEFINER). |
| **EXECUTE (Proc)** | - | `PROHIBITED` | Ningún procedimiento es requerido. | - | Alto. |
| **USAGE (Tipos)** | `USAGE` | `REQUIRED` | Necesario para tipos compuestos o UDTs. | `SELECT has_type_privilege('val_role', 'schema.type', 'USAGE');` | Nulo. |
| **Superuser/Admin** | - | `PROHIBITED` | Bloqueo absoluto de superusuario. | `SELECT rolsuper, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = 'val_role';` | **Crítico** (Acceso total). |

---

### D. Política de Ejecución de Funciones y Procedimientos
Se determina que:
`FUNCTION_EXECUTE_ALLOWLIST = EMPTY`

**Justificación**:
Actualmente, el pipeline de validación estructural y física del backup (conteos de tablas, verificación de tipos y metadatos) se realiza puramente mediante sentencias de lectura `SELECT` sobre el catálogo de PostgreSQL y las tablas restauradas. Ninguna función de base de datos o procedimiento almacenado es necesario para validar la restauración.
* **Rechazo por Defecto**: Se denegará el privilegio `EXECUTE` sobre cualquier función o procedimiento para el rol de validación local.
* **Restricción de SECURITY DEFINER**: Se prohíbe la ejecución de funciones `SECURITY DEFINER` para evitar elevación de privilegios hacia el owner.
* **Control Futuro**: Si en el futuro se requiriera agregar alguna función, esta deberá validarse por firma de argumentos exacta e identidad completa (esquema + nombre + tipos) en lugar de nombres parciales o comodines.

---

### E. Contrato Completo de Parámetros de Control y Validaciones

| Parámetro | Tipo | Obligatorio | Validación (Regex / Allowlist) | Manejo de Vacío | Restricción Cruzada | Sensibilidad |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEMP_DATABASE_NAME** | `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | Aborto inmediato | No igual a Prod Name | No sensible |
| **PRODUCTION_DATABASE_NAME**| `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | Aborto inmediato | No igual a Temp Name | No sensible |
| **POSTGRES_CONTAINER_NAME** | `[string]` | `YES` | `^[a-zA-Z0-9_-]{3,63}$` | Aborto inmediato | - | No sensible |
| **SSH_HOST** | `[string]` | `YES` | `^[a-zA-Z0-9.-]+$` | Aborto inmediato | - | No sensible |
| **SSH_USER** | `[string]` | `YES` | `^[a-z0-9_-]{3,32}$` | Aborto inmediato | - | No sensible |
| **TEMP_DATABASE_OWNER_ROLE**| `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | Aborto inmediato | No igual a Val Role | No sensible |
| **LOCAL_VALIDATION_ROLE** | `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | Aborto inmediato | No igual a Owner / Exec | No sensible |
| **RESTORE_EXECUTION_ROLE** | `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | Aborto inmediato | No igual a Val Role | No sensible |
| **ALLOWED_RESTORED_SCHEMAS**| `[array]`  | `YES` | Allowlist de strings `^[a-z0-9_]{1,63}$`| Aborto inmediato | Excluye sys/temp schemas| No sensible |

**Restricciones de seguridad inmutables de los roles**:
1. `TEMP_DATABASE_NAME != PRODUCTION_DATABASE_NAME`
2. `LOCAL_VALIDATION_ROLE != TEMP_DATABASE_OWNER_ROLE`
3. `LOCAL_VALIDATION_ROLE != RESTORE_EXECUTION_ROLE`
4. El rol `LOCAL_VALIDATION_ROLE` no puede tener rolsuper = true (Superusuario), rolcreatedb = true, rolcreaterole = true, rolreplication = true, ni rolbypassrls = true.

---

### F. Mecanismo Único de Quoting y Transporte
Para la ejecución y transporte de la política a través de las distintas capas sin riesgo de interpolación ni inyección de comandos, se implementará la estrategia de:
**Envío del script SQL inmutable por stdin alimentando parámetros separados con variables de psql previamente validadas.**

```powershell
# Comando conceptual de ejecución en PowerShell
$sql_cmd = @"
BEGIN;
-- Revocación de privilegios por defecto a PUBLIC
ALTER DEFAULT PRIVILEGES IN SCHEMA :schema_clean REVOKE ALL ON TABLES FROM PUBLIC;
-- Aplicación parametrizada
EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db_temp');
EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', :'db_temp', :'val_role');
EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', :'schema_clean', :'val_role');
EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO %I', :'schema_clean', :'val_role');
COMMIT;
"@

# Transporte seguro mediante SSH -> Docker -> psql usando stdin
$ssh_cmd = "docker exec -i $POSTGRES_CONTAINER_NAME psql -X -v ON_ERROR_STOP=1 --set=db_temp='$TEMP_DATABASE_NAME' --set=val_role='$LOCAL_VALIDATION_ROLE' --set=schema_clean='public' -U postgres"
```

**Seguridad del Mecanismo**:
1. El script SQL es completamente estático (no hay interpolación de variables de PowerShell ni de bash dentro del cuerpo de la consulta).
2. Los valores dinámicos se transmiten a través del parámetro `--set` de psql.
3. El uso de `format('%I', ...)` dentro del motor de PostgreSQL asegura que los identificadores de bases de datos, roles y esquemas se traten nativamente como identificadores, neutralizando cualquier intento de inyección de comandos SQL.
4. El código de salida del contenedor y de SSH se propaga transparentemente a PowerShell.

---

### G. Transacción y Fallo Cerrado
* La política se ejecuta con `psql -X -v ON_ERROR_STOP=1` forzando una detención inmediata en caso de error.
* Se inicia el bloque con `BEGIN;` y se completa únicamente con `COMMIT;` tras superarse todas las sentencias de revocación y otorgamiento de privilegios.
* If the process fails, a rollback is triggered. If an error is detected, the script halts.

---

### H. Consultas SQL de Verificación Deterministas

1. **Ausencia de Superusuario / Capacidades Administrativas en LOCAL_VALIDATION_ROLE**:
   ```sql
   SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls 
   FROM pg_roles 
   WHERE rolname = :val_role;
   ```
   *Resultado esperado*: `rolsuper=f, rolcreatedb=f, rolcreaterole=f, rolreplication=f, rolbypassrls=f`.

2. **Verificar que LOCAL_VALIDATION_ROLE no hereda membresías administrativas**:
   ```sql
   SELECT 1 FROM pg_auth_members m 
   JOIN pg_roles r ON m.roleid = r.oid 
   JOIN pg_roles g ON m.member = g.oid 
   WHERE g.rolname = :val_role AND (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole);
   ```
   *Resultado esperado*: Vacío (0 filas).

3. **Verificar que CONNECT está otorgado de forma exclusiva a LOCAL_VALIDATION_ROLE**:
   ```sql
   SELECT has_database_privilege(:val_role, :db_temp, 'CONNECT');
   ```
   *Resultado esperado*: `t` (true).

4. **Verificar que PUBLIC no posee privilegios de CONNECT sobre la base**:
   ```sql
   SELECT has_database_privilege('public', :db_temp, 'CONNECT');
   ```
   *Resultado esperado*: `f` (false).

5. **Verificar acceso SELECT sobre las tablas permitidas del esquema**:
   ```sql
   SELECT has_table_privilege(:val_role, 'public.users', 'SELECT');
   ```
   *Resultado esperado*: `t` (true).

6. **Verificar que LOCAL_VALIDATION_ROLE carece de privilegios de escritura o alteración**:
   ```sql
   SELECT has_table_privilege(:val_role, 'public.users', 'INSERT') 
      OR has_table_privilege(:val_role, 'public.users', 'UPDATE') 
      OR has_table_privilege(:val_role, 'public.users', 'DELETE') 
      OR has_table_privilege(:val_role, 'public.users', 'TRUNCATE');
   ```
   *Resultado esperado*: `f` (false).

7. **Verificar que no existen privilegios para PUBLIC en tablas**:
   ```sql
   SELECT 1 FROM pg_class c 
   JOIN pg_namespace n ON n.oid = c.relnamespace 
   WHERE n.nspname = 'public' AND (aclexplode(c.relacl)).grantee = 0;
   ```
   *Resultado esperado*: Vacío (0 filas).

---

### I. Fixtures Estáticos Diseñados (A a V)

#### Fixture A: DATABASE ACL es reconocido y rechazado
* *Entrada*: `'12; 0 0 DATABASE ACL - DATABASE barberagency_prod postgres'`
* *Precondición*: Active Registry con la gramática contractual de DATABASE ACL registrada.
* *Unidad bajo prueba*: `Parse-TOC-Structural-Line`
* *Resultado esperado*: `Valid = $false`, `RejectionCode = "global_descriptor_forbidden"`.
* *Propósito*: Proteger el gate del pipeline de restauración temporal.
* *Aislamiento*: Totalmente offline, simulado estáticamente.

#### Fixture B: DATABASE PROPERTIES es reconocido y rechazado
* *Entrada*: `'13; 0 0 DATABASE PROPERTIES - DATABASE barberagency_prod postgres'`
* *Precondición*: Active Registry cargado.
* *Unidad bajo prueba*: `Parse-TOC-Structural-Line`
* *Resultado esperado*: `Valid = $false`, `RejectionCode = "global_descriptor_forbidden"`.
* *Propósito*: Evitar cambios de propiedades del clúster de origen.
* *Aislamiento*: Simulación estática pura.

#### Fixture C: Validación de parámetros obligatorios
* *Entrada*: Convocatoria del script sin parámetro obligatorios.
* *Precondición*: Falta el parámetro `$TEMP_DATABASE_NAME`.
* *Unidad bajo prueba*: Función de inicialización del script.
* *Resultado esperado*: Aborto inmediato con código de salida no cero.

#### Fixture D: Identificadores inválidos rechazados
* *Entrada*: `$TEMP_DATABASE_NAME = "barber_db; DROP DATABASE barber;"`
* *Precondición*: Validación sintáctica de allowlist de variables activada.
* *Unidad bajo prueba*: Validador de tipos de parámetros del script.
* *Resultado esperado*: Aborto por violación sintáctica.

#### Fixture E: Nombres vacíos rechazados
* *Entrada*: `$LOCAL_VALIDATION_ROLE = ""`
* *Precondición*: Validadores de inicialización activos.
* *Unidad bajo prueba*: Validador de tipos.
* *Resultado esperado*: Aborto inmediato.

#### Fixture F: TEMP_DATABASE_NAME igual a PRODUCTION_DATABASE_NAME se rechaza
* *Entrada*: `$TEMP_DATABASE_NAME = "barberagency_prod"`, `$PRODUCTION_DATABASE_NAME = "barberagency_prod"`
* *Precondición*: Restricción cruzada activa.
* *Unidad bajo prueba*: Validador cruzado de parámetros.
* *Resultado esperado*: Aborto inmediato por riesgo de destrucción/colisión de producción.

#### Fixture G: LOCAL_VALIDATION_ROLE inexistente en base de datos temporal
* *Entrada*: Comprobación de existencia del rol antes del restore.
* *Precondición*: Consulta de catálogo simulada que devuelve 0 registros para el rol.
* *Unidad bajo prueba*: Script de pre-vuelo en PostgreSQL.
* *Resultado esperado*: Error de detención del pipeline por ausencia del rol requerido.

#### Fixture H: Exigencia de psql -X -v ON_ERROR_STOP=1
* *Entrada*: Verificación del comando SSH a enviar.
* *Precondición*: Inspección estática del string de comando generado.
* *Unidad bajo prueba*: Módulo de restauración del script.
* *Resultado esperado*: Confirmación de inclusión exacta de los flags `-X` y `-v ON_ERROR_STOP=1`.

#### Fixture I: Transacción única y COMMIT condicionado
* *Entrada*: Cuerpo del script SQL generado.
* *Precondición*: Verificación de correspondencia de bloques BEGIN/COMMIT.
* *Unidad bajo prueba*: Parser interno de verificación de transaccionalidad.
* *Resultado esperado*: Válido.

#### Fixture J: Cualquier error aborta el pipeline
* *Entrada*: Simulación de fallo en el comando de transporte.
* *Precondición*: Comando psql falla con código 1.
* *Unidad bajo prueba*: Manejador de errores del script.
* *Resultado esperado*: Detención total de las siguientes fases (validación de datos, subida a R2).

#### Fixture K: Ausencia de nombres hardcodeados
* *Entrada*: Código fuente del script.
* *Precondición*: Escaneo de strings contra nombres por defecto (ej. ubuntu, barber_test).
* *Unidad bajo prueba*: Auditoría de código estática.
* *Resultado esperado*: Cero coincidencias.

#### Fixture L: Ausencia de secrets o contraseñas
* *Entrada*: Código fuente del script.
* *Precondición*: Escaneo de tokens sensibles y patrones de autenticación.
* *Unidad bajo prueba*: Analizador estático de credenciales.
* *Resultado esperado*: Cero secretos detectados.

#### Fixture M: Rechazo de esquemas internos
* *Entrada*: Descubrimiento de un esquema llamado `pg_catalog` o `information_schema`.
* *Precondición*: La consulta de schemata devuelve esquemas del sistema.
* *Unidad bajo prueba*: Módulo de validación de esquemas.
* *Resultado esperado*: Exclusión de los mismos del flujo de privilegios.

#### Fixture N: Esquema inesperado fuera de allowlist rechazado
* *Entrada*: Esquema descubierto `compromised_schema` no registrado en `$ALLOWED_RESTORED_SCHEMAS`.
* *Precondición*: Ejecución del loop de descubrimiento.
* *Unidad bajo prueba*: Validador de allowlist de esquemas.
* *Resultado esperado*: Aborto inmediato y rollback de la transacción.

#### Fixture O: LOCAL_VALIDATION_ROLE igual al owner rechazado
* *Entrada*: `$LOCAL_VALIDATION_ROLE = "postgres"`, `$TEMP_DATABASE_OWNER_ROLE = "postgres"`
* *Precondición*: Restricción cruzada activa.
* *Unidad bajo prueba*: Validador cruzado de parámetros.
* *Resultado esperado*: Aborto inmediato por violación del principio de separación de privilegios.

#### Fixture P: Rol de validación con privilegios administrativos rechazado
* *Entrada*: Rol `val_role` con `rolsuper = true` o `rolcreatedb = true`.
* *Precondición*: Verificación de pre-vuelo en PostgreSQL.
* *Unidad bajo prueba*: Script de verificación de privilegios de catálogo.
* *Resultado esperado*: Aborto inmediato.

#### Fixture Q: Membresía administrativa en rol de validación rechazada
* *Entrada*: Rol `val_role` miembro del grupo `rds_superuser`.
* *Precondición*: Consulta de catálogo `pg_auth_members`.
* *Unidad bajo prueba*: Script de verificación.
* *Resultado esperado*: Aborto inmediato.

#### Fixture R: EXECUTE fuera de allowlist rechazado
* *Entrada*: Intento de concesión de EXECUTE sobre una función.
* *Precondición*: Allowlist vacía activa.
* *Unidad bajo prueba*: Aplicación de privilegios a funciones.
* *Resultado esperado*: Bloqueado por la regla inmutable.

#### Fixture S: Función SECURITY DEFINER accesibles
* *Entrada*: Función `calculate_metrics()` marcada como SECURITY DEFINER.
* *Precondición*: Verificación de catálogo de funciones.
* *Unidad bajo prueba*: Validador estático de funciones.
* *Resultado esperado*: Aborto inmediato.

#### Fixture T: Privilegio de escritura inesperado detectado
* *Entrada*: `has_table_privilege('val_role', 'users', 'INSERT')` devuelve `true`.
* *Precondición*: Validación post-política.
* *Unidad bajo prueba*: Verificador de seguridad post-restore.
* *Resultado esperado*: Falla del pipeline.

#### Fixture U: Privilegio inesperado para PUBLIC detectado
* *Entrada*: `has_database_privilege('public', 'db_temp', 'CONNECT')` devuelve `true`.
* *Precondición*: Validación post-política.
* *Unidad bajo prueba*: Verificador.
* *Resultado esperado*: Falla del pipeline.

#### Fixture V: Fallo de verificación antes del COMMIT provoca rollback
* *Entrada*: Simulación de fallo en una aserción post-política dentro del bloque transaccional.
* *Precondición*: Ejecución transaccional.
* *Unidad bajo prueba*: Script de la transacción.
* *Resultado esperado*: Ejecución automática de ROLLBACK y detención con código de error.

---

### J. Diseño de Prueba Temporal Futura (controlled_temp_restore_policy)
Para validar la implementación en un entorno controlado antes de habilitar los accesos principales, se diseñará la prueba bajo las siguientes directrices:

1. **Precondición**: Aislamiento de red total del host ejecutor. Sin acceso a credenciales de producción ni endpoints del bucket R2.
2. **Entorno**: Contenedor de Docker con PostgreSQL local inicializado en una base de prueba parametrizada.
3. **Dataset**: Uso de un archivo SQL mock con datos sintéticos y nombres de tablas reducidas para agilizar el restore.
4. **Comandos requeridos**:
   * Creación de la base de datos temporal mock.
   * Ejecución de pg_restore simulado sobre el manifiesto estructurado.
   * Aplicación del transporte seguro del script de política transaccional.
   * Ejecución de las consultas de catálogo para validar el estado de los privilegios.
5. **Criterios de éxito**: Todas las consultas de verificación afirmativas y negativas de privilegios en el clúster local de prueba retornan exactamente los valores esperados (cero fallos de privilegios).
6. **Limpieza segura**: Eliminación de la base de datos temporal mock y destrucción de los roles locales creados para la prueba.
7. **Criterio de transición del gate**:
   `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED = YES` solo si las firmas de la salida del log de aserciones de PostgreSQL coinciden determinísticamente con el resultado de privilegios restringidos.

---

### K. Mapeo por Sección o Función Exacta del Script

| Nombre de la Función / Sección | Ubicación Aproximada (Líneas) | Responsabilidad Actual | Cambio Futuro Propuesto (Etapa 2) | Fixture Asociado |
| :--- | :--- | :--- | :--- | :--- |
| **Definición de Parámetros** | `30 - 150` | Declaración de variables globales de entorno. | Incorporar validación sintáctica de regex y allowlist para `$TEMP_DATABASE_NAME` y `$LOCAL_VALIDATION_ROLE`. | `Fixture C, D, E, F, K, L` |
| **Validación de Roles y Pre-vuelo**| Nueva función propuesta | Ninguna. | Nueva función para comprobar existencia de roles locales y ausencia de privilegios de superusuario antes de iniciar. | `Fixture G, O, P, Q` |
| **Sección de pg_restore** | `1850 - 1920` | Ejecución del restore del TOC modificado. | Añadir la bandera `--no-owner` a la ejecución del comando pg_restore. | `Decision de Ownership` |
| **Aplicación de la Política** | Nueva función propuesta | Ninguna. | Ejecutar la inyección del script SQL transaccional parametrizado mediante stdin hacia psql. | `Fixture H, I, J, M, N, R, S, V` |
| **Verificación de Seguridad** | Nueva función propuesta | Ninguna. | Ejecutar las consultas SQL deterministas de privilegios y comprobar que cumplen la matriz de seguridad. | `Fixture T, U` |

---

## 7. RIESGOS RESIDUALES
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

1. **Objetos en esquemas no previstos**:
   * *Probabilidad*: Baja.
   * *Impacto*: Medio.
   * *Mitigación*: Exclusión y descubrimiento dinámico de esquemas con validación contra allowlist.
   * *Gate*: `STATIC_POLICY_VALIDATED`.
2. **Funciones SECURITY DEFINER preexistentes**:
   * *Probabilidad*: Media.
   * *Impacto*: Alto.
   * *Mitigación*: Validación en catálogo pg_proc antes del commit y denegación de privilegios de ejecución.
   * *Gate*: `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED`.
3. **Privilegios sobre Tipos (UDTs)**:
   * *Probabilidad*: Baja.
   * *Impacto*: Bajo.
   * *Mitigación*: Aplicar `REVOKE` explícito sobre tipos durante el barrido de esquemas.
   * *Gate*: `STATIC_POLICY_VALIDATED`.
4. **Row Level Security (RLS) desactivado**:
   * *Probabilidad*: Baja.
   * *Impacto*: Medio.
   * *Mitigación*: Comprobación de que el rol de validación no posee el atributo `BYPASSRLS`.
   * *Gate*: `STATIC_POLICY_VALIDATED`.

---

## 8. Criterios de Aceptación y Transición de Gates
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

* **DESIGN_COMPLETE = YES**: Cuando el diseño completo de descubrimiento de esquemas, matriz de privilegios y consultas SQL inmutables es aprobado formalmente por la auditoría independiente.
* **READY_FOR_IMPLEMENTATION = NO**: **Se mantendrá en NO** durante esta fase documental. Solo podrá pasar a YES tras la autorización explícita para la Etapa 2 de desarrollo.
* **STATIC_POLICY_VALIDATED = NO**: Permanecerá en `NO` hasta que las funciones de validación sintáctica de parámetros y allowlists estén escritas en el script.
* **CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED = NO**: Permanecerá en `NO` hasta la conclusión exitosa de la prueba de simulación local.
* **DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED = NO**: Permanecerá en `NO` hasta la validación de la restauración temporal.
* **DATABASE_ACL_DECISION = PROPOSED_PENDING_INDEPENDENT_REVIEW**: Permanecerá bloqueado hasta cumplir de manera verificable los criterios anteriores.

---

## 9. TASK_005_V17_DATABASE_ACL_POLICY_DESIGN_THIRD_CORRECTION
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

*Nota aclaratoria de prioridad*: Esta sección contiene las especificaciones técnicas completas y corregidas del diseño de seguridad para la equivalencia de restauración de DATABASE ACL, sustituyendo y anulando formalmente todas las propuestas incorrectas de las secciones y correcciones previas de este documento sin eliminar la evidencia de los pasos anteriores.

### A. Inspección Estática del Flujo Actual del Script
El análisis estático de `backup_production_database.ps1` revela la siguiente estructura y elementos existentes:

1. **Parámetros existentes**:
   El script utiliza variables para gestionar la ejecución del entorno:
   * `$container_backup_dir` (Ubicación en el contenedor para el archivo dump y metadata).
   * `$container_tmp_path` (Ruta para la salida del listado TOC).
   * `$local_tmp_dir` (Ruta local en Windows para almacenar archivos de control intermedios).
   * `$DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED` (Variable de control del gate en memoria y en reporte).
2. **Validadores existentes**:
   No posee funciones nativas de validación regex para hosts, bases de datos o nombres de rol en su configuración actual, constituyendo un riesgo de inyección si no se declaran de manera específica y tipificada.
3. **Creación de la base temporal**:
   La base de datos temporal de pruebas se crea remotamente invocando `psql` dentro del contenedor con la sentencia:
   `CREATE DATABASE "nombre_base_temporal";`
   * *Identidad ejecutora*: El comando de creación se ejecuta con el rol superusuario de PostgreSQL (`postgres`).
   * *Owner efectivo inicial*: Queda en propiedad del rol ejecutor (`postgres`).
4. **Comando y opciones de pg_restore actuales**:
   El script invoca:
   `pg_restore --list "$container_backup_dir/$backup_filename"` para generar el listado TOC y posteriormente ejecuta `pg_restore` apuntando al listado filtrado de objetos permitidos.
   * *Opciones*: Actualmente se ejecuta con privilegios implícitos del owner original y sin la bandera `--no-owner`.
   * *Rol ejecutor*: Superusuario de PostgreSQL (`postgres`) dentro del contenedor.
5. **Usuario de las validaciones actuales**:
   El script ejecuta validaciones del esquema (como conteos y listados de tablas) directamente utilizando el rol administrador (`postgres`).
6. **Punto conceptual de aplicación de la política**:
   La aplicación de la política declarativa local debe ocurrir **inmediatamente después de finalizar exitosamente pg_restore** y estrictamente **antes de que comience cualquier consulta de validación funcional o conteo de registros**. Esto asegura que las validaciones se ejecuten bajo el contexto restringido del rol de validación para probar que sus privilegios de lectura son suficientes y equivalentes operativamente.

---

### B. Modelo Completo de Roles y Ownership
Para implementar el principio de menor privilegio sin escalamiento se define el siguiente modelo:

1. **TEMP_DATABASE_OWNER_ROLE**:
   * *Procedencia*: Catálogo local preexistente en el host PostgreSQL de destino (ej. `postgres` o rol dedicado de base temporal).
   * * LOGIN / Attributes*: `LOGIN` requerido. Atributos administrativos completos (`SUPERUSER` para el clúster de test) para permitir operaciones de limpieza y drop de la base.
   * *Membresías*: Prohibido heredar o ser miembro de roles productivos.
   * *Responsabilidad*: Dueño efectivo de la base de datos temporal.
2. **LOCAL_VALIDATION_ROLE**:
   * *Procedencia*: Rol local preexistente o creado de forma aislada en el host PostgreSQL de destino.
   * *LOGIN / Attributes*: `LOGIN` requerido. Atributos administrativos: **Estrictamente prohibido (`NOLOGIN` es preferible si la conexión es heredada, pero `LOGIN` se requiere si se conecta directamente). Prohibidos: `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`.**
   * *Membresías*: Prohibido ser miembro de cualquier rol administrativo o superusuario. Sin capacidades de herencia administrativa.
   * *Responsabilidad*: Conectarse y validar los datos restaurados mediante sentencias de solo lectura (`SELECT`).
3. **RESTORE_EXECUTION_ROLE**:
   * *Procedencia*: El superusuario local que ejecuta psql y pg_restore (`postgres`).
   * *LOGIN / Attributes*: `LOGIN` requerido. `SUPERUSER`.
   * *Responsabilidad*: Realizar la restauración de los objetos y ejecutar la asignación de privilegios declarativos.
4. **ADMINISTRATION_ROLE**:
   * *Procedencia*: Superusuario del host de destino.
   * *LOGIN / Attributes*: `LOGIN` requerido.
   * *Responsabilidad*: Orquestar el ciclo de vida del contenedor de pruebas y bases de datos locales.

**Interacción con `--no-owner`**:
El comando de restauración *debe* ejecutarse con la opción `--no-owner` de `pg_restore`. Esto fuerza a que todos los esquemas, tablas, vistas y secuencias restaurados pasen a ser propiedad del rol ejecutor (`postgres`), eliminando de raíz dependencias de propietarios inexistentes en producción y aislando completamente los accesos.

---

### C. Descubrimiento Dinámico de Schemata
El script no se limitará a `public`. Se ejecutará un bloque PL/pgSQL dinámico en PostgreSQL para descubrir y auditar todos los esquemas restaurados, excluyendo los esquemas internos y temporales:

```sql
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND schema_name NOT LIKE 'pg_temp_%'
  AND schema_name NOT LIKE 'pg_toast_temp_%'
ORDER BY schema_name ASC;
```

**Comportamiento ante Schemas Inesperados**:
1. El script lee la lista de esquemas del catálogo.
2. Compara cada esquema contra la allowlist parametrizada `$ALLOWED_RESTORED_SCHEMAS`.
3. Si un esquema de usuario descubierto no se encuentra en la allowlist, el script de la política aborta inmediatamente la transacción (`ROLLBACK`), propaga un código de error `database_acl_policy_unexpected_schema` y detiene por completo el pipeline, impidiendo la validación o el upload a R2.

---

### D. Matriz Completa de Privilegios para LOCAL_VALIDATION_ROLE

| Recurso / Operación | Privilegio | Clasificación | Justificación Técnica | Consulta de Verificación Positiva / Negativa | Código de Error ante Fallo | Gate Protegido |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CONNECT (Base)** | `CONNECT` | `REQUIRED` | Permite la conexión a la base temporal. | `SELECT has_database_privilege(:'val_role', :'db_temp', 'CONNECT');` | `database_acl_policy_connect_denied` | `STATIC_POLICY_VALIDATED` |
| **CREATE (Base)** | - | `PROHIBITED` | Bloquea la creación de objetos en base. | `SELECT NOT has_database_privilege(:'val_role', :'db_temp', 'CREATE');` | `database_acl_policy_create_base_allowed` | `STATIC_POLICY_VALIDATED` |
| **TEMP (Base)** | - | `PROHIBITED` | Impide uso de tablas temporales. | `SELECT NOT has_database_privilege(:'val_role', :'db_temp', 'TEMP');` | `database_acl_policy_temp_base_allowed` | `STATIC_POLICY_VALIDATED` |
| **Ownership Base** | - | `PROHIBITED` | No debe ser dueño de la base de datos. | `SELECT datdba FROM pg_database WHERE datname = :'db_temp';` (Debe ser `postgres`, no `val_role`). | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **USAGE (Schemas)**| `USAGE` | `REQUIRED` | Permite acceso a los esquemas permitidos. | `SELECT has_schema_privilege(:'val_role', :'schema_name', 'USAGE');` | `database_acl_policy_schema_usage_denied` | `STATIC_POLICY_VALIDATED` |
| **CREATE (Schemas)**| - | `PROHIBITED` | Previene inyección de tablas en esquemas. | `SELECT NOT has_schema_privilege(:'val_role', :'schema_name', 'CREATE');` | `database_acl_policy_schema_create_allowed` | `STATIC_POLICY_VALIDATED` |
| **SELECT (Tablas)** | `SELECT` | `REQUIRED` | Lectura de tablas para validaciones. | `SELECT has_table_privilege(:'val_role', :'table_name', 'SELECT');` | `database_acl_policy_table_select_denied` | `STATIC_POLICY_VALIDATED` |
| **SELECT (Vistas)** | `SELECT` | `REQUIRED` | Lectura de vistas restauradas. | `SELECT has_table_privilege(:'val_role', :'view_name', 'SELECT');` | `database_acl_policy_view_select_denied` | `STATIC_POLICY_VALIDATED` |
| **SELECT (MatViews)**| `SELECT` | `REQUIRED` | Lectura de vistas materializadas. | `SELECT has_table_privilege(:'val_role', :'mview_name', 'SELECT');` | `database_acl_policy_mview_select_denied` | `STATIC_POLICY_VALIDATED` |
| **Escritura (I/U/D)**| - | `PROHIBITED` | Totalmente prohibido modificar datos. | `SELECT NOT (has_table_privilege(:'val_role', :'table_name', 'INSERT') OR has_table_privilege(:'val_role', :'table_name', 'UPDATE') OR has_table_privilege(:'val_role', :'table_name', 'DELETE'));` | `database_acl_policy_write_allowed` | `STATIC_POLICY_VALIDATED` |
| **TRUNCATE** | - | `PROHIBITED` | Previene borrado masivo de datos. | `SELECT NOT has_table_privilege(:'val_role', :'table_name', 'TRUNCATE');` | `database_acl_policy_truncate_allowed` | `STATIC_POLICY_VALIDATED` |
| **REFERENCES** | - | `PROHIBITED` | No requerido para validación de backup. | `SELECT NOT has_table_privilege(:'val_role', :'table_name', 'REFERENCES');` | `database_acl_policy_references_allowed` | `STATIC_POLICY_VALIDATED` |
| **TRIGGER** | - | `PROHIBITED` | Impide alteración de flujos por triggers. | `SELECT NOT has_table_privilege(:'val_role', :'table_name', 'TRIGGER');` | `database_acl_policy_trigger_allowed` | `STATIC_POLICY_VALIDATED` |
| **USAGE (Seq)** | - | `NOT_REQUIRED`| No se requiere acceso a secuencias. | `SELECT NOT has_sequence_privilege(:'val_role', :'seq_name', 'USAGE');` | `database_acl_policy_seq_usage_allowed` | `STATIC_POLICY_VALIDATED` |
| **SELECT (Seq)** | - | `NOT_REQUIRED`| No se requiere acceso a secuencias. | `SELECT NOT has_sequence_privilege(:'val_role', :'seq_name', 'SELECT');` | `database_acl_policy_seq_select_allowed` | `STATIC_POLICY_VALIDATED` |
| **UPDATE (Seq)** | - | `PROHIBITED` | Impide modificar secuencias de prueba. | `SELECT NOT has_sequence_privilege(:'val_role', :'seq_name', 'UPDATE');` | `database_acl_policy_seq_update_allowed` | `STATIC_POLICY_VALIDATED` |
| **EXECUTE (Func)** | - | `PROHIBITED` | Denegación total (Allowlist vacía). | `SELECT NOT has_function_privilege(:'val_role', :'func_signature', 'EXECUTE');` | `database_acl_policy_function_execute_allowed` | `STATIC_POLICY_VALIDATED` |
| **EXECUTE (Proc)** | - | `PROHIBITED` | Denegación total (Allowlist vacía). | `SELECT NOT has_function_privilege(:'val_role', :'proc_signature', 'EXECUTE');` | `database_acl_policy_proc_execute_allowed` | `STATIC_POLICY_VALIDATED` |
| **USAGE (Tipos)** | - | `NOT_REQUIRED`| Tipos primitivos no exigen USAGE explícito.| `SELECT NOT has_type_privilege(:'val_role', :'type_name', 'USAGE');` | `database_acl_policy_type_usage_allowed` | `STATIC_POLICY_VALIDATED` |
| **Default Priv.** | - | `PROHIBITED` | No se permiten privilegios implícitos. | `SELECT count(1) FROM pg_default_acl WHERE defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = :'schema_name');` (Debe ser 0). | `database_acl_policy_default_acl_present`| `STATIC_POLICY_VALIDATED` |
| **Extensiones** | - | `PROHIBITED` | Impide instalar extensiones locales. | *(Validado por rolsuper=f)*. | `database_acl_policy_admin_priv_allowed` | `STATIC_POLICY_VALIDATED` |
| **Crear Bases/Roles**| - | `PROHIBITED` | Impide alterar el clúster. | `SELECT rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = :val_role;` (Debe ser `f, f`). | `database_acl_policy_admin_priv_allowed` | `STATIC_POLICY_VALIDATED` |

---

### E. Política de Funciones, Procedimientos y ACL NULL
Se establece de manera inmutable:
`FUNCTION_EXECUTE_ALLOWLIST = EMPTY`
`EXECUTE_ON_FUNCTIONS = PROHIBITED`
`EXECUTE_ON_PROCEDURES = PROHIBITED`

**Tratamiento de ACL NULL y Default Privileges de PostgreSQL**:
En PostgreSQL, por defecto, el pseudo-rol `PUBLIC` posee privilegios implícitos de ejecución (`EXECUTE`) sobre todas las funciones y procedimientos recién creados si su ACL es NULL. Para neutralizar este comportamiento implícito y evitar brechas de seguridad en el restore temporal:
1. **Revocación explícita sobre funciones restauradas**:
   El script aplicará de manera incondicional:
   `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA "schema_name" FROM PUBLIC;`
   `REVOKE EXECUTE ON ALL PROCEDURES IN SCHEMA "schema_name" FROM PUBLIC;`
2. **Alteración de Privilegios Predeterminados**:
   Para evitar que nuevas funciones creadas durante las pruebas hereden este acceso, se inyectará:
   `ALTER DEFAULT PRIVILEGES IN SCHEMA "schema_name" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;`
3. **Verificación Negativa**:
   Se comprobará mediante consulta al catálogo que no exista ninguna función donde `PUBLIC` mantenga accesos efectivos:
   ```sql
   SELECT 1 FROM pg_proc p 
   JOIN pg_namespace n ON n.oid = p.pronamespace 
   WHERE n.nspname = 'schema_name' 
     AND has_function_privilege('public', p.oid, 'EXECUTE');
   ```
   *Resultado esperado*: 0 filas. Si devuelve filas, la transacción falla y aborta.

---

### F. Política Completa para PUBLIC y Tratamiento de Privilegios Efectivos
El pseudo-rol `PUBLIC` se gestiona a nivel de catálogo interno (`grantee = 0` en `aclexplode`). Se estructuran las siguientes aserciones deterministas para validar que `PUBLIC` no conserva ningún privilegio explícito ni implícito sobre los objetos restaurados:

1. **Base de Datos**:
   * *Acción*: `REVOKE ALL ON DATABASE "db_temp" FROM PUBLIC;`
   * *Verificación*:
     ```sql
     SELECT 1 FROM pg_database WHERE datname = 'db_temp' AND (datacl IS NOT NULL AND datacl::text LIKE '%=c/%');
     ```
     *Resultado esperado*: 0 filas.
2. **Schemas**:
   * *Acción*: `REVOKE ALL ON SCHEMA "schema_name" FROM PUBLIC;`
   * *Verificación*:
     ```sql
     SELECT 1 FROM pg_namespace n, aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a 
     WHERE n.nspname = 'schema_name' AND a.grantee = 0;
     ```
     *Resultado esperado*: 0 filas.
3. **Tablas / Vistas / Vistas Materializadas**:
   * *Acción*: `REVOKE ALL ON ALL TABLES IN SCHEMA "schema_name" FROM PUBLIC;`
   * *Verificación*:
     ```sql
     SELECT 1 FROM pg_class c 
     JOIN pg_namespace n ON n.oid = c.relnamespace 
     WHERE n.nspname = 'schema_name' AND c.relkind IN ('r', 'v', 'm') 
       AND has_table_privilege('public', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');
     ```
     *Resultado esperado*: 0 filas.
4. **Secuencias**:
   * *Acción*: `REVOKE ALL ON ALL SEQUENCES IN SCHEMA "schema_name" FROM PUBLIC;`
   * *Verificación*:
     ```sql
     SELECT 1 FROM pg_class c 
     JOIN pg_namespace n ON n.oid = c.relnamespace 
     WHERE n.nspname = 'schema_name' AND c.relkind = 'S' 
       AND has_sequence_privilege('public', c.oid, 'USAGE,SELECT,UPDATE');
     ```
     *Resultado esperado*: 0 filas.
5. **Tipos**:
   * *Acción*: `REVOKE ALL ON ALL TYPES IN SCHEMA "schema_name" FROM PUBLIC;`
   * *Verificación*:
     ```sql
     SELECT 1 FROM pg_type t 
     JOIN pg_namespace n ON n.oid = t.typnamespace 
     WHERE n.nspname = 'schema_name' 
       AND has_type_privilege('public', t.oid, 'USAGE');
     ```
     *Resultado esperado*: 0 filas.

---

### G. Contrato Completo de Parámetros de Control y Validaciones Sintácticas
Se definen validadores y expresiones regulares específicas por tipo para neutralizar inyecciones:

| Parámetro | Tipo | Obligatorio | Validador Específico (Regex) | Normalización | Comportamiento Vacío | Restricción Cruzada | Sensibilidad |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEMP_DATABASE_NAME** | `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No igual a Prod Name | No sensible |
| **PRODUCTION_DATABASE_NAME**| `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No igual a Temp Name | No sensible |
| **POSTGRES_CONTAINER_NAME** | `[string]` | `YES` | `^[a-zA-Z0-9_-]{3,63}$` | `.Trim()` | Aborto | - | No sensible |
| **SSH_HOST** | `[string]` | `YES` | `^([a-zA-Z0-9.-]+)$` | `.ToLower().Trim()` | Aborto | - | No sensible |
| **SSH_USER** | `[string]` | `YES` | `^[a-z0-9_-]{3,32}$` | `.ToLower().Trim()` | Aborto | - | No sensible |
| **TEMP_DATABASE_OWNER_ROLE**| `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No igual a Val Role | No sensible |
| **LOCAL_VALIDATION_ROLE** | `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No igual a Owner / Admin / Exec | No sensible |
| **RESTORE_EXECUTION_ROLE** | `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No igual a Val Role | No sensible |
| **ADMINISTRATION_ROLE** | `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No igual a Val Role | No sensible |
| **ALLOWED_RESTORED_SCHEMAS**| `[array]`  | `YES` | Cada item: `^[a-z0-9_]{1,63}$`| Cada item normalizado | Aborto | Excluye esquemas del sistema | No sensible |
| **ALLOWED_VALIDATION_FUNCTIONS**| `[array]` | `YES` | Vacío inmutable | - | Permitido vacío | Debe ser vacío | No sensible |

* **Prohibición absoluta**: Ninguno de los parámetros puede contener caracteres de control (`\r`, `\n`, `\0`), espacios internos en variables individuales o metacaracteres de inyección shell (`|`, `;`, `&`, `$`, `` ` ``).

---

### H. Mecanismo Único de Transporte y Quoting Seguro
Se selecciona como estrategia de transporte definitiva:
**Uso de variables locales psql alimentadas desde PowerShell mediante argumentos de línea de comandos tipificados, con ejecución de SQL dinámico en PostgreSQL encapsulado en un bloque transaccional PL/pgSQL inmutable.**

#### 1. Pseudocódigo Conceptual por Capas

**A. PowerShell conceptual**:
```powershell
# Validación sintáctica en PowerShell antes de invocar SSH
if ($TEMP_DATABASE_NAME -notmatch '^[a-z0-9_]{3,63}$') { throw "Invalid database name" }
if ($LOCAL_VALIDATION_ROLE -notmatch '^[a-z0-9_]{3,63}$') { throw "Invalid validation role" }

# Preparación de argumentos de forma que se separen ejecutable y parámetros
$ssh_args = @(
    "-i", "path_to_key",
    "ubuntu@host_test",
    "docker", "exec", "-i", "postgres_test",
    "psql", "-X", "-v", "ON_ERROR_STOP=1",
    "--set=db_temp=$TEMP_DATABASE_NAME",
    "--set=val_role=$LOCAL_VALIDATION_ROLE"
)
```

**B. Argumentos SSH and Transporte stdin**:
PowerShell invoca el ejecutable `ssh.exe` pasando la lista de argumentos `$ssh_args` de forma nativa sin interpolación de cadenas, y alimenta la entrada estándar (`stdin`) redirigiendo el archivo SQL estático inmutable (`policy.sql`).

**C. SQL y PL/pgSQL Sintácticamente Válido (policy.sql)**:
El archivo transmitido por stdin no contiene variables de PowerShell. Contiene variables psql y lógica PL/pgSQL que cita identificadores usando `format('%I', ...)` de forma segura:

```sql
\set ON_ERROR_STOP 1
BEGIN;

DO $$
DECLARE
    r_schema RECORD;
    v_db TEXT := :'db_temp';
    v_role TEXT := :'val_role';
    v_is_super BOOLEAN;
BEGIN
    -- Validar precondición de seguridad del rol local
    SELECT rolsuper INTO v_is_super FROM pg_roles WHERE rolname = v_role;
    IF v_is_super THEN
        RAISE EXCEPTION 'Security violation: LOCAL_VALIDATION_ROLE cannot be superuser';
    END IF;

    -- Revocar privilegios globales a PUBLIC sobre la base de datos
    EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', v_db);
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', v_db, v_role);

    -- Descubrimiento y aplicación dinámica por esquema
    FOR r_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND schema_name NOT LIKE 'pg_temp_%'
          AND schema_name NOT LIKE 'pg_toast_temp_%'
    LOOP
        -- Validar esquema contra allowlist implícita en PL/pgSQL (ej. 'public')
        IF r_schema.schema_name <> 'public' THEN
            RAISE EXCEPTION 'Unexpected schema discovered: %', r_schema.schema_name;
        END IF;

        -- Aplicar políticas restrictivas al esquema
        EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', r_schema.schema_name);
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', r_schema.schema_name, v_role);
        EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO %I', r_schema.schema_name, v_role);
        
        -- Revocación de privilegios implícitos en funciones para PUBLIC
        EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', r_schema.schema_name);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', r_schema.schema_name);
    END LOOP;
END;
$$;

-- Aserciones deterministas antes del COMMIT
SELECT 1 FROM pg_database WHERE datname = :'db_temp' AND (datacl IS NOT NULL AND datacl::text LIKE '%=c/%');
-- (Si esta consulta o cualquier aserción post-política genera un fallo de coincidencia,
-- se aborta la transacción automáticamente mediante el flujo transaccional de psql).

COMMIT;
```

**Flujo de Errores e Inyecciones**:
1. No existe interpolación en la shell remota. Los valores de PowerShell se convierten directamente en variables locales de psql.
2. `format('%I', ...)` procesa el string como identificador nativo en PostgreSQL. Si contiene caracteres maliciosos, PostgreSQL los envuelve en comillas o falla la sintaxis de forma segura, abortando el commit.
3. El código de salida de `psql` (código 1 ante error) se propaga al contenedor Docker, este lo retorna al proceso `ssh`, y este a PowerShell, deteniendo el script de inmediato.

---

### K. Fixtures Estáticos Diseñados (A a V)

| ID | Objetivo del Fixture | Entrada | Precondición | Función / Unidad | Modo de Aislamiento | Resultado Esperado | Código de Error | Gate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | Rechazar DATABASE ACL | `'12; 0 0 DATABASE ACL - DATABASE db postgres'` | Active Registry cargado | `Parse-TOC-Structural-Line` | Offline | `Valid = $false` | `global_descriptor_forbidden` | `STATIC_POLICY_VALIDATED` |
| **B** | Rechazar DATABASE PROPERTIES | `'13; 0 0 DATABASE PROPERTIES - DATABASE db postgres'`| Active Registry cargado | `Parse-TOC-Structural-Line` | Offline | `Valid = $false` | `global_descriptor_forbidden` | `STATIC_POLICY_VALIDATED` |
| **C** | Parámetro ausente | `$TEMP_DATABASE_NAME = $null` | Validación de inicio | Inicialización del Script | Offline | Aborto | `database_acl_policy_param_missing`| `STATIC_POLICY_VALIDATED` |
| **D** | Identificador inválido | `$TEMP_DATABASE_NAME = "db; DROP;"`| Validación regex activa | Validador sintáctico | Offline | Aborto | `database_acl_policy_invalid_format`| `STATIC_POLICY_VALIDATED` |
| **E** | Valor vacío rechazado | `$LOCAL_VALIDATION_ROLE = ""` | Validación regex activa | Validador sintáctico | Offline | Aborto | `database_acl_policy_param_empty` | `STATIC_POLICY_VALIDATED` |
| **F** | Base igual a producción | Temp = "barber_prod", Prod = "barber_prod" | Restricción cruzada | Inicialización del Script | Offline | Aborto | `database_acl_policy_collision` | `STATIC_POLICY_VALIDATED` |
| **G** | Rol local inexistente | `val_role` no existe en catálogo | Simulación de prevuelo | Verificación pre-vuelo | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Aborto | `database_acl_policy_role_missing` | TECHNICAL_VALIDATION_COMPLETED_NO |
| **H** | Ausencia de flags psql | Comando sin `-X` o `-v` | Inspección de string | Generador de comandos | Offline | Aborto | `database_acl_policy_command_invalid`| `STATIC_POLICY_VALIDATED` |
| **I** | Duplicidad de transacción| SQL con múltiples BEGIN | Parser sintáctico SQL | Validador transaccional | Offline | Aborto | `database_acl_policy_sql_invalid` | `STATIC_POLICY_VALIDATED` |
| **J** | Detener pipeline ante error| Retorno de comando = 1 | Comando psql falla | Manejador de errores | Offline | Detención | `database_acl_policy_execution_fail`| `STATIC_POLICY_VALIDATED` |
| **K** | Nombres hardcodeados | String "barber_test" en código | Escaneo de código | Analizador estático | Offline | Aborto | `database_acl_policy_hardcode_found`| `STATIC_POLICY_VALIDATED` |
| **L** | Secrets en el código | Token o contraseña en string | Analizador de patrones | Analizador estático | Offline | Aborto | `database_acl_policy_secret_found` | `STATIC_POLICY_VALIDATED` |
| **M** | Excluir esquemas internos| Descubrimiento de `pg_catalog`| Filtro de catálogo | Descubridor de esquemas | Offline | Exclusión | `database_acl_policy_sys_schema` | `STATIC_POLICY_VALIDATED` |
| **N** | Schema fuera de allowlist| Descubrimiento de `temp_dev` | `$ALLOWED_RESTORED_SCHEMAS`| Validador de esquemas | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Aborto | `database_acl_policy_unexpected_schema`| TECHNICAL_VALIDATION_COMPLETED_NO |
| **O** | Rol local igual al owner | Val = "postgres", Owner = "postgres" | Restricción cruzada | Validador de roles | Offline | Aborto | `database_acl_policy_identity_conflict`|`STATIC_POLICY_VALIDATED` |
| **P** | Rol con privilegios admin | `val_role` con `rolsuper=true` | Consulta de catálogo | Verificador pre-vuelo | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Aborto | `database_acl_policy_privilege_escalation`| TECHNICAL_VALIDATION_COMPLETED_NO |
| **Q** | Membresía admin heredada | `val_role` en `rds_superuser` | Consulta `pg_auth_members` | Verificador pre-vuelo | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Aborto | `database_acl_policy_member_conflict`| TECHNICAL_VALIDATION_COMPLETED_NO |
| **R** | EXECUTE fuera de allowlist| Concesión de EXECUTE en func | Allowlist vacía activa | Asignador de privilegios | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Aborto | `database_acl_policy_execute_forbidden`| TECHNICAL_VALIDATION_COMPLETED_NO |
| **S** | Función SECURITY DEFINER | Función con `prosecdef=true` | Consulta `pg_proc` | Validador de funciones | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Aborto | `database_acl_policy_secdef_forbidden`| TECHNICAL_VALIDATION_COMPLETED_NO |
| **T** | Escritura inesperada | Tabla con `INSERT` permitido | Consulta `has_table_privilege`| Aserciones post-política | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Aborto | `database_acl_policy_assertion_fail` | TECHNICAL_VALIDATION_COMPLETED_NO |
| **U** | Privilegio PUBLIC (NULL) | `has_database_privilege` = `true`| Aserción de PUBLIC | Aserciones post-política | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Aborto | `database_acl_policy_assertion_fail` | TECHNICAL_VALIDATION_COMPLETED_NO |
| **V** | Fallo provoca rollback | Transacción con error intermedio | Simulación de error SQL | Motor transaccional psql | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Rollback | `database_acl_policy_rollback` | TECHNICAL_VALIDATION_COMPLETED_NO |

---

### L. Diseño de Prueba Temporal Futura (controlled_temp_restore_policy)
Para validar la implementación en un entorno controlado antes de habilitar los accesos principales, se diseñará la prueba bajo las siguientes directrices:

1. **Precondición**: Aislamiento de red total del host ejecutor. Sin acceso a credenciales de producción ni endpoints del bucket R2.
2. **Entorno**: Contenedor de Docker con PostgreSQL local inicializado en una base de prueba parametrizada.
3. **Dataset**: Uso de un archivo SQL mock con datos sintéticos y nombres de tablas reducidas para agilizar el restore.
4. **Comandos requeridos**:
   * Creación de la base de datos temporal mock.
   * Ejecución de pg_restore simulado sobre el manifiesto estructurado.
   * Aplicación del transporte seguro del script de política transaccional.
   * Ejecución de las consultas de catálogo para validar el estado de los privilegios.
5. **Criterios de éxito**: Todas las consultas de verificación afirmativas y negativas de privilegios en el clúster local de prueba retornan exactamente los valores esperados (cero fallos de privilegios).
6. **Limpieza segura**: Eliminación de la base de datos temporal mock y destrucción de los roles locales creados para la prueba.
7. **Criterio de transición del gate**:
   `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED = YES` solo si las firmas de la salida del log de aserciones de PostgreSQL coinciden determinísticamente con el resultado de privilegios restringidos.

---

### M. Mapeo por Sección o Función Exacta del Script

| Nombre de la Función / Sección | Ubicación Aproximada (Líneas) | Responsabilidad Actual | Cambio Futuro Propuesto (Etapa 2) | Fixture Asociado |
| :--- | :--- | :--- | :--- | :--- |
| **Definición de Parámetros** | `30 - 150` | Declaración de variables globales de entorno. | Incorporar validación sintáctica de regex y allowlist para `$TEMP_DATABASE_NAME` y `$LOCAL_VALIDATION_ROLE`. | `Fixture C, D, E, F, K, L` |
| **Validación de Roles y Pre-vuelo**| Nueva función propuesta | Ninguna. | Nueva función para comprobar existencia de roles locales y ausencia de privilegios de superusuario antes de iniciar. | `Fixture G, O, P, Q` |
| **Sección de pg_restore** | `1850 - 1920` | Ejecución del restore del TOC modificado. | Añadir la bandera `--no-owner` a la ejecución del comando pg_restore. | `Decision de Ownership` |
| **Aplicación de la Política** | Nueva función propuesta | Ninguna. | Ejecutar la inyección del script SQL transaccional parametrizado mediante stdin hacia psql. | `Fixture H, I, J, M, N, R, S, V` |
| **Verificación de Seguridad** | Nueva función propuesta | Ninguna. | Ejecutar las consultas SQL deterministas de privilegios y comprobar que cumplen la matriz de seguridad. | `Fixture T, U` |

---

## 7. RIESGOS RESIDUALES
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

1. **Objetos en esquemas no previstos**:
   * *Probabilidad*: Baja.
   * *Impacto*: Medio.
   * *Mitigación*: Exclusión y descubrimiento dinámico de esquemas con validación contra allowlist.
   * *Gate*: `STATIC_POLICY_VALIDATED`.
2. **Funciones SECURITY DEFINER preexistentes**:
   * *Probabilidad*: Media.
   * *Impacto*: Alto.
   * *Mitigación*: Validación en catálogo pg_proc antes del commit y denegación de privilegios de ejecución.
   * *Gate*: `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED`.
3. **Privilegios sobre Tipos (UDTs)**:
   * *Probabilidad*: Baja.
   * *Impacto*: Bajo.
   * *Mitigación*: Aplicar `REVOKE` explícito sobre tipos durante el barrido de esquemas.
   * *Gate*: `STATIC_POLICY_VALIDATED`.
4. **Row Level Security (RLS) desactivado**:
   * *Probabilidad*: Baja.
   * *Impacto*: Medio.
   * *Mitigación*: Comprobación de que el rol de validación no posee el atributo `BYPASSRLS`.
   * *Gate*: `STATIC_POLICY_VALIDATED`.

---

## 8. Criterios de Aceptación y Transición de Gates
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

* **DESIGN_COMPLETE = YES**: Cuando el diseño completo de descubrimiento de esquemas, matriz de privilegios y consultas SQL inmutables es aprobado formalmente por la auditoría independiente.
* **READY_FOR_IMPLEMENTATION = NO**: **Se mantendrá en NO** durante esta fase documental. Solo podrá pasar a YES tras la autorización explícita para la Etapa 2 de desarrollo.
* **STATIC_POLICY_VALIDATED = NO**: Permanecerá en `NO` hasta que las funciones de validación sintáctica de parámetros y allowlists estén escritas en el script.
* **CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED = NO**: Permanecerá en `NO` hasta la conclusión exitosa de la prueba de simulación local.
* **DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED = NO**: Permanecerá en `NO` hasta la validación de la restauración temporal.
* **DATABASE_ACL_DECISION = PROPOSED_PENDING_INDEPENDENT_REVIEW**: Permanecerá bloqueado hasta cumplir de manera verificable los criterios anteriores.

---

## 10. TASK_005_V17_DATABASE_ACL_POLICY_DESIGN_FOURTH_CORRECTION
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

*Nota aclaratoria de prioridad*: Esta sección contiene las especificaciones técnicas completas y definitivas del diseño de seguridad para la equivalencia de restauración de DATABASE ACL, sustituyendo y anulando formalmente todas las propuestas incorrectas de las secciones y correcciones previas de este documento sin eliminar la evidencia de los pasos anteriores para mantener la trazabilidad de la auditoría.

### A. Inspección Estática del Flujo Actual del Script
El análisis estático exhaustivo de las 2774 líneas físicas de `backup_production_database.ps1` revela el siguiente flujo real en orden de ejecución secuencial:

1. **Parámetros del Script**:
   * El único parámetro formal de entrada de PowerShell es `[switch]$TestStaticParsersOnly` (Línea 11-13).
   * Ninguno de los otros valores configurables (como `$container_backup_dir` o las credenciales R2) son parámetros de entrada del script; son variables internas de configuración cargadas en el ámbito global del script.
2. **Fase de Inicialización y Variables Internas** (Líneas 15-68):
   * Carga inicial de rutas relativas y absolutas locales y del contenedor.
   * Inicialización del diccionario de control de estado del ciclo de vida `$state` y de los gates de validación (`$TOC_DESCRIPTOR_REGISTRY_VALIDATED = "NO"`, etc.).
   * Establecimiento explícito de variables de control del gate DATABASE ACL: `$DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED = "NO"` y `$DATABASE_ACL_DECISION = "UNRESOLVED_BLOCKING"` (Líneas 87-88).
3. **Validación Estática de Fixtures** (Líneas 2115-2146):
   * Si `$TestStaticParsersOnly` está activo, se invoca `Test-StaticParsers` y el script termina de inmediato sin tocar red ni infraestructura.
4. **Fase de Conectividad y Preflight**:
   * Verificación remota mediante SSH del acceso al contenedor de Docker `barberagency-postgres`.
5. **Ejecución del Backup en Producción**:
   * Ejecución remota de `pg_dump` dentro del contenedor Docker de producción para generar el dump inicial y extraer su TOC.
6. **Proceso de Restauración Temporal** (Líneas 2203-2219):
   * Generación dinámica de un nombre de base de datos temporal: `$temp_db = "barberagency_val_$($uuid.Replace('-','_'))"` (Línea 2206).
   * Comprobación remota de no existencia de la base.
   * Creación de la base de datos temporal: Ejecución de `CREATE DATABASE $temp_db;` mediante el rol superusuario de PostgreSQL `postgres` (Línea 2213).
   * **pg_restore real**: pg_restore se ejecuta utilizando el usuario `postgres` (`-U postgres`) apuntando al manifiesto filtrado y el dump en `$temp_db`. No se preserva ni reestablece el owner original durante esta restauración.
7. **Validaciones Estructurales y de ACLs** (Líneas 2221-2383):
   * Extracción de default ACLs (`$temp_default_acls`) y comparación contra el inventario de producción.
   * Extracción de object ACLs y comparación biyectiva.
8. **Limpieza del Entorno Temporal** (Líneas 2384-2399):
   * Drop de la base temporal: `DROP DATABASE IF EXISTS $temp_db;` e inspección de logs.
9. **Empaquetado, Hashes y Carga a R2** (Líneas 2400-2546):
   * Cálculo de hashes SHA-256 de los manifiestos e inventario.
   * Subida de los archivos resultantes al bucket Cloudflare R2 a través de variables de entorno de AWS.
10. **Bloque Finally y Término**:
    * Borrado estricto de variables de entorno locales de credenciales de AWS.
    * Terminación con código `exit 0` si todos los gates están validados o `exit 1` en caso de discrepancias de integridad.

---

### B. Modelo Completo de Roles y Aislamiento de Privilegios
Para eliminar cualquier contradicción sobre privilegios del rol de validación local y prevenir elevaciones de acceso, se define la siguiente arquitectura de roles:

1. **DATABASE_OWNER_ROLE**:
   * *Propósito*: Rol original que ostenta la propiedad de la base de datos de producción y sus objetos.
   * * LOGIN / Attributes*: `NOLOGIN` en entorno temporal.
   * *Membresías*: Ninguna.
   * *Propiedad*: Ninguna en el entorno de pruebas local (los objetos restaurados se asignan al rol de restauración).
2. **TEMP_DATABASE_OWNER_ROLE**:
   * *Propósito*: Propietario local de la base de datos temporal creada para las pruebas.
   * *LOGIN / Attributes*: `LOGIN` requerido. Atributos administrativos: `SUPERUSER` local de pruebas (`postgres`).
   * *Responsabilidad*: Creación, administración de seguridad y borrado final de la base `$temp_db`.
3. **RESTORE_EXECUTION_ROLE**:
   * *Propósito*: Rol que ejecuta el comando de restauración `pg_restore`.
   * *LOGIN / Attributes*: `LOGIN` requerido. Atributos administrativos: `SUPERUSER` local (`postgres`).
   * *Responsabilidad*: Ejecutar pg_restore con la opción `--no-owner` para heredar la propiedad de todos los objetos y aplicar la política de privilegios mínimos.
4. **LOCAL_VALIDATION_ROLE**:
   * *Propósito*: Rol abstracto base que concentra los privilegios mínimos requeridos para la validación funcional.
   * *LOGIN / Attributes*: `NOLOGIN`. Carece absolutamente de: `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`.
   * *Membresías*: Prohibido ser miembro directo o transitivo de cualquier rol superusuario o administrativo.
5. **SESSION_ROLE**:
   * *Propósito*: Rol login de un solo propósito para las conexiones de validación de los scripts.
   * *LOGIN / Attributes*: `LOGIN` habilitado, `CONNECTION LIMIT 1`. Carece absolutamente de privilegios administrativos.
   * *Membresias*: HISTORICAL_SUPERSEDED_NON_NORMATIVE. Esta afirmacion queda sustituida por la estrategia canonica de la seccion 12: `SESSION_ROLE` no es miembro de `LOCAL_VALIDATION_ROLE`, no usa `SET ROLE` y solo ejecuta comprobaciones de privilegios efectivos contra el rol objetivo.
   * *Ciclo de vida*: Se crea dinámicamente antes del inicio de la validación y se destruye incondicionalmente tras el drop de la base.
6. **ADMINISTRATION_ROLE**:
   * *Propósito*: Administrador general del clúster PostgreSQL local.
   * *LOGIN / Attributes*: `LOGIN`, `SUPERUSER`.
7. **PUBLIC**:
   * *Propósito*: Pseudo-rol de PostgreSQL que representa a todos los usuarios del sistema. Es el objetivo principal de la revocación total e incondicional de accesos por defecto.

**Restricciones de exclusión cruzadas**:
* `LOCAL_VALIDATION_ROLE != TEMP_DATABASE_OWNER_ROLE`
* `LOCAL_VALIDATION_ROLE != RESTORE_EXECUTION_ROLE`
* `SESSION_ROLE != TEMP_DATABASE_OWNER_ROLE`
* `SESSION_ROLE != RESTORE_EXECUTION_ROLE`
* `RESTORE_EXECUTION_ROLE` es el superusuario `postgres` local de validación; `SESSION_ROLE` y `LOCAL_VALIDATION_ROLE` no tienen heredado el rol superusuario de ninguna forma.

---

### C. Política de Ownership (Propiedad) por Clase de Objeto
Para evitar privilegios implícitos de control por ownership, todos los objetos restaurados serán de propiedad exclusiva del rol administrador del clúster de pruebas local (`postgres`).

| Clase de Objeto | Catálogo de Origen | Owner Temporal Permitido | Owner Final Permitido | ¿LOCAL_VALIDATION_ROLE es Owner? | Acción en Caso de Desviación | Código de Error | Gate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Database** | `pg_database` | `postgres` | `postgres` | `NO` | Abortar Transacción (`ROLLBACK`) | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Schema** | `pg_namespace` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Table** | `pg_class` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Partition Table**| `pg_class` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **View** | `pg_class` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **MatView** | `pg_class` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Sequence** | `pg_class` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Function** | `pg_proc` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Procedure** | `pg_proc` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Type** | `pg_type` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Extension** | `pg_extension` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |

---

### D. Descubrimiento Dinámico y Allowlist de Schemas
El script no se limitará a `public`. Se implementa una validación contra allowlist estricta para el descubrimiento de esquemas:

* **ALLOW_RESTORED_SCHEMAS**: Formato `$ALLOWED_RESTORED_SCHEMAS = "public"`. Es una lista separada por comas, normalizada mediante `.ToLower().Trim()` en PowerShell y libre de duplicados o espacios en blanco.
* **Exclusión de Schemas Internos y de Sistema**: `pg_catalog`, `information_schema`, `pg_toast`, `pg_temp_*`, `pg_toast_temp_*`.

**Bloque SQL de Descubrimiento y Comparación**:
```sql
DO $schemas$
DECLARE
    r_schema RECORD;
    v_allowed TEXT[] := string_to_array(current_setting('policy.allowed_schemas'), ',');
    v_clean_name TEXT;
BEGIN
    FOR r_schema IN 
        SELECT nspname 
        FROM pg_catalog.pg_namespace 
        WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND nspname NOT LIKE 'pg_temp_%'
          AND nspname NOT LIKE 'pg_toast_temp_%'
    LOOP
        v_clean_name := trim(lower(r_schema.nspname));
        IF NOT (v_clean_name = ANY(v_allowed)) THEN
            RAISE EXCEPTION 'database_acl_policy_schema_unexpected: %', r_schema.nspname
                USING ERRCODE = 'P0001';
        END IF;
    END LOOP;
END
$schemas$;
```

---

### E. Matriz Completa de Privilegios Mínimos (LOCAL_VALIDATION_ROLE)

| Sujeto | Objeto | Clase | Privilegio | Permitido | Prohibido | Origen Directo | Origen PUBLIC | Origen Ownership | Error ante Desviación | Gate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `val_role` | `db_temp` | Database | CONNECT | `YES` | - | `YES` | `NO` | `NO` | `database_acl_policy_connect_denied` | `STATIC_POLICY_VALIDATED` |
| `val_role` | `db_temp` | Database | CREATE | - | `YES` | `NO` | `NO` | `NO` | `database_acl_policy_write_privilege` | `STATIC_POLICY_VALIDATED` |
| `val_role` | `db_temp` | Database | TEMPORARY| - | `YES` | `NO` | `NO` | `NO` | `database_acl_policy_write_privilege` | `STATIC_POLICY_VALIDATED` |
| `val_role` | Schemas | Schema | USAGE | `YES` | - | `YES` | `NO` | `NO` | `database_acl_policy_schema_missing` | `STATIC_POLICY_VALIDATED` |
| `val_role` | Tablas | Table | SELECT | `YES` | - | `YES` | `NO` | `NO` | `database_acl_policy_write_privilege` | `STATIC_POLICY_VALIDATED` |
| `val_role` | Tablas | Table | Write(I/U/D)| - | `YES` | `NO` | `NO` | `NO` | `database_acl_policy_write_privilege` | `STATIC_POLICY_VALIDATED` |
| `val_role` | Secuencias | Sequence | USAGE | - | `YES` | `NO` | `NO` | `NO` | `database_acl_policy_write_privilege` | `STATIC_POLICY_VALIDATED` |
| `val_role` | Funciones | Function | EXECUTE | - | `YES` | `NO` | `NO` | `NO` | `database_acl_policy_execute_privilege` | `STATIC_POLICY_VALIDATED` |

`FUNCTION_EXECUTE_ALLOWLIST` se declara inmutablemente **vacía**.

---

### F. PUBLIC y Semántica Efectiva de ACL NULL
Un valor `ACL NULL` en los catálogos de PostgreSQL no significa ausencia de privilegios, sino la aplicación de los privilegios predeterminados de PostgreSQL para el rol `PUBLIC` sobre el tipo de objeto.

1. **Catálogos Afectados y Evaluación**:
   * Evaluaremos los privilegios efectivos usando `aclexplode(COALESCE(datacl, acldefault('d', datdba)))` sobre la base, `COALESCE(nspacl, acldefault('n', nspowner))` sobre esquemas, y `COALESCE(relacl, acldefault('r', relowner))` sobre relaciones.
2. **template1/template0**:
   * Para evitar heredar objetos no controlados o configuraciones previas del catálogo de la base de datos `template1`, se forzará la creación de la base temporal usando `TEMPLATE template0`:
     `CREATE DATABASE $temp_db TEMPLATE template0;`

---

### G. Default Privileges Correctos
La política local de default privileges se alterará de forma determinista para revocar incondicionalmente cualquier acceso implícito de ejecución sobre futuras funciones y de lectura en tablas:

```sql
-- Revocación de default privileges para PUBLIC sobre todas las tablas y funciones creadas por el rol postgres
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;
```

---

### H. Contrato Completo de Parámetros de Control (Proposed Future Parameters)

El único parámetro real de PowerShell es `TestStaticParsersOnly`. Todos los demás se tipifican como `PROPOSED_FUTURE_PARAMETER`:

| Parámetro | Tipo | Obligatorio | Validación (Regex / Allowlist) | Normalización | Comportamiento Vacío | Sensibilidad |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEMP_DATABASE_NAME** | `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No sensible |
| **LOCAL_VALIDATION_ROLE**| `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No sensible |
| **SESSION_ROLE** | `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No sensible |
| **ALLOWED_RESTORED_SCHEMAS**| `[array]`| `YES` | Item regex `^[a-z0-9_]{1,63}$` | `.ToLower().Trim()` | Aborto | No sensible |

---

### I. Mecanismo Único de Transporte y Seguridad del Dollar Quoting
Para evitar vulnerabilidades sintácticas al inyectar parámetros psql dentro del dollar quoting en `DO` blocks, se utilizará la API `set_config` para transferir valores del pipeline psql al contexto PL/pgSQL de forma aislada:

#### 1. Pseudocódigo por Capas

**A. PowerShell conceptual**:
```powershell
$ssh_args = @(
    "-i", "$env:SSH_KEY_PATH",
    "ubuntu@$env:SSH_HOST",
    "docker", "exec", "-i", "barberagency-postgres",
    "psql", "-X", "-v", "ON_ERROR_STOP=1",
    "--set=db_temp=$TEMP_DATABASE_NAME",
    "--set=val_role=$LOCAL_VALIDATION_ROLE",
    "--set=allowed_schemas=$ALLOWED_RESTORED_SCHEMAS"
)
```

**B. SQL Fijo con Dollar Quoting Seguro y set_config**:
```sql
\set ON_ERROR_STOP 1
BEGIN;

-- Configurar parámetros del script en variables de sesión de PostgreSQL
SELECT set_config('policy.db_temp', :'db_temp', true);
SELECT set_config('policy.val_role', :'val_role', true);
SELECT set_config('policy.allowed_schemas', :'allowed_schemas', true);

DO $policy$
DECLARE
    v_db TEXT := current_setting('policy.db_temp');
    v_role TEXT := current_setting('policy.val_role');
    v_allowed TEXT := current_setting('policy.allowed_schemas');
    v_schema RECORD;
BEGIN
    -- Validar precondiciones de no superusuario en el rol de validación
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role AND rolsuper) THEN
        RAISE EXCEPTION 'database_acl_policy_role_admin_attribute' USING ERRCODE = 'P0001';
    END IF;

    -- Revocaciones incondicionales
    EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', v_db);
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', v_db, v_role);

    -- Descubrimiento dinámico de schemas
    FOR v_schema IN 
        SELECT nspname FROM pg_catalog.pg_namespace 
        WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND nspname NOT LIKE 'pg_temp_%'
          AND nspname NOT LIKE 'pg_toast_temp_%'
    LOOP
        -- Validación estricta contra allowlist
        IF NOT (v_schema.nspname = ANY(string_to_array(v_allowed, ','))) THEN
            RAISE EXCEPTION 'database_acl_policy_schema_unexpected: %', v_schema.nspname USING ERRCODE = 'P0001';
        END IF;

        -- Aplicar USAGE y SELECT restrictivos
        EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', v_schema.nspname);
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', v_schema.nspname, v_role);
        EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO %I', v_schema.nspname, v_role);
        EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', v_schema.nspname);
    END LOOP;
END
$policy$;

-- Aserciones deterministas antes del COMMIT
DO $assertions$
BEGIN
    -- Comprobar si PUBLIC retiene privilegios en tablas
    IF EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'public' 
          AND has_table_privilege('public', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
    ) THEN
        RAISE EXCEPTION 'database_acl_policy_public_privilege' USING ERRCODE = 'P0001';
    END IF;
END
$assertions$;

COMMIT;
```

---

### J. Aserciones Reales y Fallo Cerrado
Cualquier discrepancia detectada abortará la transacción mediante sentencias `RAISE EXCEPTION` de PostgreSQL, impidiendo que los privilegios sean guardados y cancelando el pipeline.

* **database_acl_policy_role_admin_attribute**: Se activa si `LOCAL_VALIDATION_ROLE` posee atributos administrativos.
* **database_acl_policy_schema_unexpected**: Se activa si se descubre un esquema de usuario fuera de la allowlist.
* **database_acl_policy_public_privilege**: Se activa si `PUBLIC` posee privilegios inapropiados de lectura o escritura en tablas tras aplicar la política.
* **database_acl_policy_write_privilege**: Se activa si `LOCAL_VALIDATION_ROLE` cuenta con permisos de escritura.

---

### K. Verificaciones Deterministas sobre todos los Objetos
Se implementan consultas recursivas para verificar que el rol local no herede transitivamente de superusuarios:

```sql
WITH RECURSIVE role_hierarchy AS (
    SELECT member, roleid FROM pg_auth_members WHERE member = (SELECT oid FROM pg_roles WHERE rolname = current_setting('policy.val_role'))
    UNION
    SELECT m.member, m.roleid FROM pg_auth_members m
    JOIN role_hierarchy rh ON m.member = rh.roleid
)
SELECT 1 FROM role_hierarchy h 
JOIN pg_roles r ON h.roleid = r.oid 
WHERE r.rolsuper OR r.rolcreaterole OR r.rolcreatedb;
```

Si esta consulta devuelve filas, se lanza una excepción `database_acl_policy_indirect_membership_forbidden`.

---

### L. Fixtures Estáticos A a V (19 Columnas Estructurales)

| ID | Objetivo | Entrada Estática | Precondición | Unidad Futura | Aislamiento | Oráculo | Código Error | Gate | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | Rechazar DATABASE ACL | `'12; 0 0 DATABASE ACL - DATABASE db postgres'` | Registry activo | `Parse-TOC-Structural-Line` | Offline | `Valid = $false` | `global_descriptor_forbidden` | `STATIC_POLICY_VALIDATED` | Diseñado |
| **B** | Rechazar DATABASE PROPERTIES | `'13; 0 0 DATABASE PROPERTIES - DATABASE db postgres'` | Registry activo | `Parse-TOC-Structural-Line` | Offline | `Valid = $false` | `global_descriptor_forbidden` | `STATIC_POLICY_VALIDATED` | Diseñado |
| **C** | Parámetro ausente | `$TEMP_DATABASE_NAME = $null` | Validación inicial | Inicialización | Offline | Exception | `database_acl_policy_parameter_invalid` | `STATIC_POLICY_VALIDATED` | Diseñado |
| **D** | Identificador inválido | `$TEMP_DATABASE_NAME = "db; DROP;"` | Validación regex | Validador | Offline | Exception | `database_acl_policy_parameter_invalid` | `STATIC_POLICY_VALIDATED` | Diseñado |
| **E** | Valor vacío | `$LOCAL_VALIDATION_ROLE = ""` | Validación regex | Validador | Offline | Exception | `database_acl_policy_parameter_invalid` | `STATIC_POLICY_VALIDATED` | Diseñado |
| **F** | Base temporal igual a prod | `$TEMP_DATABASE_NAME = "barberagency_prod"` | Restricción cruzada | Validador | Offline | Exception | `database_acl_policy_role_collision` | `STATIC_POLICY_VALIDATED` | Diseñado |
| **G** | Rol local inexistente | `val_role` no registrado en pg_roles | Pre-vuelo catálogo | Aserción SQL | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | `database_acl_policy_role_missing` | TECHNICAL_VALIDATION_COMPLETED_NO | Diseñado |
| **H** | Ausencia de flags psql | Comando sin `-X` | Comprobación de cadena | Transportador | Offline | Exception | `database_acl_policy_parameter_invalid` | `STATIC_POLICY_VALIDATED` | Diseñado |
| **I** | Ausencia de transacción | Comando SQL sin BEGIN/COMMIT | Comprobación de cadena | Transportador | Offline | Exception | `database_acl_policy_transaction_failed`| `STATIC_POLICY_VALIDATED` | Diseñado |
| **J** | Continuación tras fallo | `$LASTEXITCODE = 1` | Simulación de error | Control de flujo | Offline | Aborto | `database_acl_policy_exit_propagation_failed`|`STATIC_POLICY_VALIDATED` | Diseñado |
| **K** | Host o usuario hardcodeado | String "barber_test" en código | Análisis estático | Auditor | Offline | Exception | `database_acl_policy_parameter_invalid` | `STATIC_POLICY_VALIDATED` | Diseñado |
| **L** | Secretos en script | Cadena de contraseña en texto | Análisis estático | Auditor | Offline | Exception | `database_acl_policy_parameter_invalid` | `STATIC_POLICY_VALIDATED` | Diseñado |
| **M** | Schema interno en allowlist | `$ALLOWED_RESTORED_SCHEMAS = "pg_catalog"` | Restricción cruzada | Validador | Offline | Exception | `database_acl_policy_schema_unexpected` | `STATIC_POLICY_VALIDATED` | Diseñado |
| **N** | Schema inesperado | Esquema `extra_schema` no permitido | Validación allowlist | Aserción SQL | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | `database_acl_policy_schema_unexpected` | TECHNICAL_VALIDATION_COMPLETED_NO | Diseñado |
| **O** | Colisión de roles | `val_role = postgres` | Restricción cruzada | Validador | Offline | Exception | `database_acl_policy_role_collision` | `STATIC_POLICY_VALIDATED` | Diseñado |
| **P** | Rol con atributos admin | `val_role` con `rolsuper = true` | Validación catálogo | Aserción SQL | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | `database_acl_policy_role_admin_attribute` | TECHNICAL_VALIDATION_COMPLETED_NO | Diseñado |
| **Q** | Membresía admin indirecta | `val_role` miembro de `rds_superuser` | Validación recursiva | Aserción SQL | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | `database_acl_policy_indirect_membership_forbidden`| TECHNICAL_VALIDATION_COMPLETED_NO | Diseñado |
| **R** | EXECUTE fuera de allowlist | Concesión de EXECUTE en func | Allowlist vacía | Aserción SQL | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | `database_acl_policy_execute_privilege` | TECHNICAL_VALIDATION_COMPLETED_NO | Diseñado |
| **S** | SECURITY DEFINER accesible | Función `prosecdef = true` en catálogo | Validación catálogo | Aserción SQL | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | `database_acl_policy_execute_privilege` | TECHNICAL_VALIDATION_COMPLETED_NO | Diseñado |
| **T** | Escritura inesperada | Tabla con privilegios INSERT | Aserciones post-acl | Aserción SQL | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | `database_acl_policy_write_privilege` | TECHNICAL_VALIDATION_COMPLETED_NO | Diseñado |
| **U** | Privilegio PUBLIC (NULL) | PUBLIC con CONNECT en base | Aserciones post-acl | Aserción SQL | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | `database_acl_policy_public_privilege` | TECHNICAL_VALIDATION_COMPLETED_NO | Diseñado |
| **V** | Fallo antes de COMMIT | Discrepancia en aserciones | Ejecución transaccional | Motor SQL | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | `database_acl_policy_transaction_failed` | TECHNICAL_VALIDATION_COMPLETED_NO | Diseñado |

---

### M. Mapeo por Función Exacta de backup_production_database.ps1

| Nombre de la Función / Sección | Ubicación Líneas | Responsabilidad Actual | Cambio Futuro Propuesto | Fixture Asociado |
| :--- | :--- | :--- | :--- | :--- |
| **Normalize-Single-Identifier** | `113 - 123` | Sanitiza y normaliza un identificador simple quitando comillas dobles. | Ninguno (Sin impacto directo en la política). | - |
| **Split-And-Normalize-Composite-Identifier** | `124 - 151` | Divide identificadores compuestos por puntos y los normaliza. | Ninguno (Se usa para validaciones estructurales). | - |
| **Normalize-Complex-Signature** | `152 - 213` | Sanitiza argumentos de firmas de funciones complejas. | Ninguno. | - |
| **Tokenize-TOC-Line** | `214 - 407` | Tokeniza la línea de cabecera del manifiesto. | Ninguno. | - |
| **New-TOC-Contract** | `408 - 529` | Define el contrato y restricciones de un descriptor. | Ninguno. | - |
| **Parse-TOC-Structural-Line** | `530 - 1072` | Parsea una línea del TOC de pg_restore aplicando el active_registry. | Asegurar el rechazo estricto de DATABASE ACL. | `Fixture A, B` |
| **Test-StaticParsers** | `1073 - 2059`| Ejecuta validaciones offline sobre fixtures predefinidos. | Integrar nuevos fixtures estáticos de validación de parámetros y aserciones. | `Todos` |
| **Assert-NoDuplicates** | `2060 - 2068`| Valida que una lista no contenga valores duplicados. | Ninguno. | - |
| **EXISTING_TOP_LEVEL_SECTION_RESTORE**| `2203 - 2252`| Ejecuta el ciclo de vida de la base de datos temporal de pruebas. | Inyectar llamada a funciones de validación de roles y aplicación de políticas ACL locales. | `Múltiples` |

**Nuevas funciones propuestas**:
* **PROPOSED_NEW_FUNCTION_TestDatabaseAclParameters**: Valida sintácticamente los parámetros propuestos contra expresiones regulares antes de iniciar.
* **PROPOSED_NEW_FUNCTION_InvokeControlledAclPolicy**: Transmite el bloque transaccional SQL mediante stdin y captura códigos de salida de Docker y SSH.

---

### N. Riesgos Residuales Completos y Mitigación

1. **SECURITY DEFINER en funciones preexistentes**:
   * *Probabilidad*: Media. *Impacto*: Alto.
   * *Mitigación*: Validación estricta del catálogo `pg_proc` y denegación de privilegios de ejecución.
   * *Riesgo residual*: Aceptable (Mitigado por la allowlist de ejecución vacía).
2. **Race condition (Conexión concurrente al temp db)**:
   * *Probabilidad*: Baja. *Impacto*: Medio.
   * *Mitigación*: Mantener `CONNECTION LIMIT 1` sobre el rol temporal `SESSION_ROLE` y restringir accesos a `PUBLIC`.
   * *Riesgo residual*: Aceptable.

---

### O. Criterios de Aceptación y Estados Resultantes

* **DESIGN_COMPLETE = YES**: Propuesto para aprobación formal de la auditoría independiente.
* **READY_FOR_IMPLEMENTATION = NO**: Permanecerá en `NO` hasta la aprobación explícita de la Etapa 2 de desarrollo.
* **STATIC_POLICY_VALIDATED = NO**: Permanecerá en `NO`.
* **CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED = NO**: Permanecerá en `NO`.
* **DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED = NO**: Permanecerá en `NO`.
* **DATABASE_ACL_DECISION = PROPOSED_PENDING_INDEPENDENT_REVIEW**: Mantenido incondicionalmente en su gate preventivo.

---

## 11. TASK_005_V17_DATABASE_ACL_POLICY_DESIGN_FIFTH_CORRECTION
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

*Nota aclaratoria de prioridad*: Esta sección contiene las especificaciones técnicas completas, deterministas y definitivas del diseño de seguridad para la equivalencia de restauración de DATABASE ACL, sustituyendo y anulando formalmente todas las propuestas incorrectas de las secciones y correcciones previas de este documento sin eliminar la evidencia de los pasos anteriores para mantener la trazabilidad de la auditoría. Se registra que la cuarta corrección fue rechazada formalmente.

### A. Tabla de Trazabilidad de Hallazgos de la Auditoría Anterior

| ID | Hallazgo | Evidencia Cuarta Corrección | Consecuencia | Corrección Aplicada | Sección Nueva | Criterio Objetivo | Estado | Gate Relacionado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Flujo real del script incorrecto | Ubicación errónea de `TestStaticParsersOnly` (2115-2146) | Mapeo inválido, confusión de etapas del pipeline | Corrección e identificación exacta (1593-1602) | Sección B | Inspección física | SUPERSEDED_BY_SIXTH_CORRECTION | `STATIC_POLICY_VALIDATED` |
| 2 | Modelo de roles incompleto/admin | Mezcla de `LOGIN SUPERUSER postgres` con rol local | Escalamiento y peligro de acceso no controlado | Separación de `val_role` (NOLOGIN) y `session_role` con límite de conexión | Sección C | Privilegios mínimos | SUPERSEDED_BY_SIXTH_CORRECTION | `DATABASE_ACL_DECISION` |
| 3 | Política de ownership incompleta | Mapeo simple de tablas ordinarias | Privilegios de control implícitos sin mitigar | Matriz completa de ownership para 20 clases de objetos | Sección D | Catálogo PostgreSQL | SUPERSEDED_BY_SIXTH_CORRECTION | `STATIC_POLICY_VALIDATED` |
| 4 | Detección schemas faltantes ausente | Validación unidireccional | Omisión de schemas eliminados o alterados | Comparación de conjuntos bidireccional (faltantes e inesperados) | Sección E | Álgebra relacional | SUPERSEDED_BY_SIXTH_CORRECTION | `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED` |
| 5 | Matriz de privilegios incompleta | Listado genérico de tablas | Permisos residuales ocultos (MAINTAIN, dominios, etc.) | Matriz de privilegios mínimos detallada por recurso | Sección F | Catálogo PostgreSQL | SUPERSEDED_BY_SIXTH_CORRECTION | `STATIC_POLICY_VALIDATED` |
| 6 | PUBLIC y ACL NULL incorrecto | Uso de `has_function_privilege` | Fallo al detectar privilegios efectivos e implícitos | Evaluación de ACL real COALESCE con acldefault | Sección G | Catálogo PostgreSQL | SUPERSEDED_BY_SIXTH_CORRECTION | `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED` |
| 7 | Default privileges generalizados | Declaración genérica de pg_default_acl = 0 | Nuevos objetos creados heredan accesos inseguros | Modelado por combinaciones de owner/schema/tipo | Sección H | Catálogo PostgreSQL | SUPERSEDED_BY_SIXTH_CORRECTION | `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED` |
| 8 | Contrato de parámetros incompleto | Variables internas tratadas como parámetros | Riesgos de inyección de comandos o SQL | Contrato de parámetros de control futuros tipificados | Sección I | Sanitización estricta | SUPERSEDED_BY_SIXTH_CORRECTION | `STATIC_POLICY_VALIDATED` |
| 9 | Transporte SSH/Docker ambiguo | Interpolación ambigua en comandos | Shell injection en el host intermedio | Diseño de wrapper remoto fijo e inmutable | Sección J | Seguridad de fronteras | SUPERSEDED_BY_SIXTH_CORRECTION | `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED` |
| 10 | Aserciones insuficientes | Consultas de validación que devuelven filas sin fallar | Falsos positivos que no interrumpen el pipeline | Uso de bloques transaccionales RAISE EXCEPTION | Sección K | Fallo cerrado | SUPERSEDED_BY_SIXTH_CORRECTION | `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED` |
| 11 | Catálogos incompletos | Faltan vistas, foreign servers, agregados | Objetos no validados que eluden el control | Mapeo detallado de 16 catálogos PostgreSQL | Sección L | Catálogo PostgreSQL | SUPERSEDED_BY_SIXTH_CORRECTION | `STATIC_POLICY_VALIDATED` |
| 12 | Fixtures dependientes de infra | Pruebas que requieren Docker o psql | Falsos positivos o imposibilidad de test offline | Fixtures estáticos con oráculo de catálogo simulado | Sección M | Aislamiento de pruebas | SUPERSEDED_BY_SIXTH_CORRECTION | `STATIC_POLICY_VALIDATED` |
| 13 | Ausencia de prueba controlada | Declaración superficial de test | Falta de control sobre escapes o endpoints | Plan de prueba en red aislada usando template0 | Sección N | Pruebas de regresión | SUPERSEDED_BY_SIXTH_CORRECTION | `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED` |
| 14 | Mapeo de script incompleto | Faltaban ubicaciones de lógica top-level | Falta de trazabilidad estructural | Ubicación exacta de las secciones del script | Sección O | Trazabilidad del código | SUPERSEDED_BY_SIXTH_CORRECTION | `STATIC_POLICY_VALIDATED` |
| 15 | Contratos de funciones propu. | Sin parámetros ni tipos especificados | Implementación ambigua | Contratos formales detallados con pre/postcondición | Sección P | Robustez funcional | SUPERSEDED_BY_SIXTH_CORRECTION | `STATIC_POLICY_VALIDATED` |
| 16 | Riesgos residuales ausentes | Lista vacía o muy simple | Puntos ciegos de seguridad en producción | Análisis de 20 riesgos con ID, mitigación y cierre | Sección Q | Modelado de amenazas | SUPERSEDED_BY_SIXTH_CORRECTION | `DATABASE_ACL_DECISION` |
| 17 | Criterios de aceptación circulares| Referencias cruzadas autoreferenciales | Detección incompleta de Gates | Criterios de gates independientes y objetivos | Sección R | Transición formal | SUPERSEDED_BY_SIXTH_CORRECTION | `DATABASE_ACL_DECISION` |

---

### B. Mapeo Físico e Inspección Estática del Script

1. **Ubicación real de `$TestStaticParsersOnly`**:
   * *Líneas reales*: `1593 - 1602`.
   * *Contexto*: Declarado inmediatamente después del helper `Assert-NoDuplicates` y antes de la sección `EJECUCIÓN TOTAL BAJO EL CATCH/FINALLY GLOBAL`.
   * *Condición*: `if ($TestStaticParsersOnly)`.
   * *Evita*: Evita conexiones SSH, creación de bases, llamadas de pg_dump, restauración de esquemas reales, y uploads a R2.
   * *Ejecuta*: Invoca de manera aislada la función `Test-StaticParsers` (L1073-2059) para ejecutar los fixtures estáticos integrados.
2. **Inventario de Funciones Reales Existentes**:
   * `Normalize-Single-Identifier` (L113-123): Normaliza identificadores removiendo delimitadores de comillas.
   * `Split-And-Normalize-Composite-Identifier` (L124-151): Divide identificadores compuestos (schema.object) y los normaliza.
   * `Normalize-Complex-Signature` (L152-213): Procesa firmas de funciones complejas para validación estática de firmas.
   * `Tokenize-TOC-Line` (L214-407): Descompone en tokens sintácticos las líneas estructurales del manifiesto pg_restore.
   * `New-TOC-Contract` (L408-529): Crea el diccionario de reglas contractuales para validación de descriptores.
   * `Parse-TOC-Structural-Line` (L530-1072): Parsea una línea del listado TOC usando el registro contractual.
   * `Test-StaticParsers` (L1073-2059): Ejecuta el set de validaciones estáticas.
   * `Assert-NoDuplicates` (L2060-2068): Verifica la unicidad de elementos en una lista.
3. **Inventario de Secciones Top-Level Existentes**:
   * `EXISTING_TOP_LEVEL_SECTION_INITIALIZATION` (L15-103): Inicializa variables de rutas y gates globales.
   * `EXISTING_TOP_LEVEL_SECTION_CHECK_TEST_MODE` (L1593-1602): Ejecución condicional en modo de prueba estática aislada.
   * `EXISTING_TOP_LEVEL_SECTION_DUMP` (L1618-1849): Ejecución de pg_dump en producción y procesamiento del manifiesto.
   * `EXISTING_TOP_LEVEL_SECTION_RESTORE` (L2203-2383): Creación de base temporal `$temp_db`, pg_restore, validación de default ACLs y object ACLs.
   * `EXISTING_TOP_LEVEL_SECTION_CLEANUP` (L2384-2399): Ejecución de DROP DATABASE temporal y limpieza.

---

### C. Modelo de Roles y No Escalamiento de Privilegios

Para aislar las validaciones funcionales en el entorno local de pruebas, se define el siguiente modelo:

1. **TEMP_DATABASE_OWNER_ROLE**:
   * *LOGIN*: `LOGIN`. *Attributes*: `SUPERUSER` local de pruebas (`postgres`).
   * *Responsabilidad*: Creación del contenedor de pruebas y eliminación de la base temporal `$temp_db`.
2. **RESTORE_EXECUTION_ROLE**:
   * *LOGIN*: `LOGIN`. *Attributes*: `SUPERUSER` local (`postgres`).
   * *Responsabilidad*: Ejecutar pg_restore utilizando la opción `--no-owner` para reasignar todos los objetos al rol ejecutor local.
3. **LOCAL_VALIDATION_ROLE**:
   * *LOGIN*: `NOLOGIN`. *Attributes*: Sin atributos administrativos. Carece de `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`.
   * *Responsabilidad*: Concentrar el conjunto inmutable de mínimos privilegios sobre los esquemas permitidos de pruebas.
4. **SESSION_ROLE**:
   * *LOGIN*: `LOGIN`. *Attributes*: `CONNECTION LIMIT 1`. Carece de privilegios administrativos.
   * *Membresias*: HISTORICAL_SUPERSEDED_NON_NORMATIVE. Esta afirmacion queda sustituida por la estrategia canonica de la seccion 12: `SESSION_ROLE` no es miembro de `LOCAL_VALIDATION_ROLE`, no usa `SET ROLE` y solo ejecuta comprobaciones de privilegios efectivos contra el rol objetivo.
   * *Responsabilidad*: Ejecutar consultas funcionales del pipeline de validación.

**Consulta Recursiva para Validar Jerarquías y Membresías Transitivas (Prevención de Ciclos)**:
```sql
WITH RECURSIVE role_hierarchy AS (
    SELECT member, roleid, ARRAY[member, roleid] as path 
    FROM pg_catalog.pg_auth_members 
    WHERE member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_setting('policy.session_role'))
    UNION ALL
    SELECT m.member, m.roleid, path || m.roleid
    FROM pg_catalog.pg_auth_members m
    JOIN role_hierarchy rh ON m.member = rh.roleid
    WHERE NOT (m.roleid = ANY(rh.path)) -- Previene ciclos recursivos
)
SELECT 1 FROM role_hierarchy h
JOIN pg_catalog.pg_roles r ON h.roleid = r.oid
WHERE r.rolsuper OR r.rolcreaterole OR r.rolcreatedb;
```
*Si devuelve filas, lanza excepción y aborta la transacción antes de aplicar la política.*

---

### D. Política Completa de Ownership

Todos los objetos creados o restaurados en el entorno temporal de validación pertenecerán al rol administrador (`postgres`). Queda prohibido que `LOCAL_VALIDATION_ROLE` o `SESSION_ROLE` posean objetos.

| Clase de Objeto | Catálogo de Origen | Owner Temporal Permitido | Owner Final Permitido | ¿LOCAL_VALIDATION_ROLE es Owner? | Acción en Caso de Desviación | Código de Error | Gate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Database** | `pg_database` | `postgres` | `postgres` | `NO` | Abortar Transacción (`ROLLBACK`) | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Schema** | `pg_namespace` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Table** | `pg_class` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **View** | `pg_class` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Sequence** | `pg_class` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Function** | `pg_proc` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Procedure** | `pg_proc` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Type** | `pg_type` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Large Object** | `pg_largeobject_metadata`| `postgres`| `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |
| **Extension** | `pg_extension` | `postgres` | `postgres` | `NO` | Abortar Transacción | `database_acl_policy_owner_mismatch` | `STATIC_POLICY_VALIDATED` |

---

### E. Descubrimiento y Comparación Bidireccional de Schemata

Se define `$ALLOWED_RESTORED_SCHEMAS = "public"`. La validación de esquemas restaurados contra esta allowlist se realiza de forma estrictamente bidireccional usando diferencias de conjuntos antes de otorgar privilegios:

```sql
DO $schemas$
DECLARE
    v_allowed TEXT[] := string_to_array(current_setting('policy.allowed_schemas'), ',');
    v_schema TEXT;
    v_missing TEXT;
    v_unexpected TEXT;
BEGIN
    -- 1. Buscar schemas inesperados (Discovered MINUS Expected)
    SELECT nspname INTO v_unexpected
    FROM pg_catalog.pg_namespace
    WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND nspname NOT LIKE 'pg_temp_%'
      AND nspname NOT LIKE 'pg_toast_temp_%'
      AND NOT (nspname = ANY(v_allowed))
    LIMIT 1;

    IF v_unexpected IS NOT NULL THEN
        RAISE EXCEPTION 'database_acl_policy_schema_unexpected: %', v_unexpected USING ERRCODE = 'P0001';
    END IF;

    -- 2. Buscar schemas faltantes (Expected MINUS Discovered)
    FOREACH v_schema IN ARRAY v_allowed
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = v_schema) THEN
            RAISE EXCEPTION 'database_acl_policy_schema_missing: %', v_schema USING ERRCODE = 'P0001';
        END IF;
    END LOOP;
END
$schemas$;
```

---

### F. Matriz Completa de Privilegios Mínimos (LOCAL_VALIDATION_ROLE)

| Recurso | Privilegio | Clasificación | Justificación Técnica | Consulta de Verificación | Riesgo Residual |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Database** | `CONNECT` | `REQUIRED` | Permite la conexión a la base temporal. | `SELECT has_database_privilege(:'val_role', :'db_temp', 'CONNECT');` | Nulo (Solo lectura). |
| **Database** | `CREATE` | `PROHIBITED` | Bloquea la creación de objetos en la base temporal. | `SELECT NOT has_database_privilege(:'val_role', :'db_temp', 'CREATE');` | Alto (Alteración catálogo).|
| **Schema** | `USAGE` | `REQUIRED` | Permite acceder a los esquemas autorizados. | `SELECT has_schema_privilege(:'val_role', :'schema', 'USAGE');` | Nulo. |
| **Schema** | `CREATE` | `PROHIBITED` | Impide inyectar tablas en los esquemas. | `SELECT NOT has_schema_privilege(:'val_role', :'schema', 'CREATE');` | Alto (Polución estructural).|
| **Table** | `SELECT` | `REQUIRED` | Lectura y conteo de registros. | `SELECT has_table_privilege(:'val_role', :'table', 'SELECT');` | Nulo. |
| **Table** | `I/U/D` | `PROHIBITED` | Bloquea la alteración de datos de pruebas. | `SELECT NOT (has_table_privilege(:'val_role', :'table', 'INSERT') OR has_table_privilege(:'val_role', :'table', 'UPDATE'));` | Alto (Modificación datos).|
| **Sequence** | `SELECT` | `NOT_REQUIRED`| No requerido para validación funcional. | `SELECT NOT has_sequence_privilege(:'val_role', :'seq', 'SELECT');` | Bajo. |
| **Function** | `EXECUTE` | `PROHIBITED` | Denegación total (Allowlist vacía). | `SELECT NOT has_function_privilege(:'val_role', :'func', 'EXECUTE');` | Alto (SECURITY DEFINER). |
| **Type** | `USAGE` | `NOT_REQUIRED`| Tipos primitivos no exigen USAGE. | `SELECT NOT has_type_privilege(:'val_role', :'type', 'USAGE');` | Nulo. |

---

### G. PUBLIC y Semántica de ACL NULL
Para evaluar los privilegios efectivos en objetos donde la lista de control de accesos es `NULL` (lo que delega la seguridad a los privilegios predeterminados de PostgreSQL para `PUBLIC`), se utiliza la función `aclexplode` de manera segura encapsulando el ACL con `COALESCE(acl, acldefault(objtype, owner))`.

**Tratamiento de `template1`**:
* Para evitar heredar objetos no controlados o configuraciones de la base de datos `template1`, se forzará la creación de la base temporal usando `TEMPLATE template0`:
  `CREATE DATABASE $temp_db TEMPLATE template0;`

---

### H. Default Privileges Correctos por Owner, Schema y Tipo
La política de default privileges se alterará de forma determinista para cada combinación de creador y esquema permitido:

```sql
-- Revocación de default privileges para PUBLIC sobre todas las tablas y funciones creadas por el rol postgres en el esquema public
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;
```

---

### I. Contrato Completo de Parámetros de Control (Proposed Future Parameters)

El único parámetro real actual es `TestStaticParsersOnly`. Todos los demás se tipifican como `PROPOSED_FUTURE_PARAMETER`:

| Parámetro | Tipo | Obligatorio | Validación (Regex / Allowlist) | Normalización | Comportamiento Vacío | Sensibilidad |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEMP_DATABASE_NAME** | `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No sensible |
| **LOCAL_VALIDATION_ROLE**| `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No sensible |
| **SESSION_ROLE** | `[string]` | `YES` | `^[a-z0-9_]{3,63}$` | `.ToLower().Trim()` | Aborto | No sensible |
| **ALLOWED_RESTORED_SCHEMAS**| `[array]`| `YES` | Item: `^[a-z0-9_]{1,63}$` | `.ToLower().Trim()` | Aborto | No sensible |

---

### J. Mecanismo Único de Transporte Seguro de Datos
Para neutralizar la inyección de comandos en entornos remotos de SSH y Docker, se define la siguiente arquitectura de transporte:

```
[PowerShell local]
   | Redirección nativa de argumentos locales (Array)
   v
[OpenSSH client (Windows)]
   | Ejecución remota
   v
[Remote Wrapper Script (/opt/barberagency/bin/db_val_wrapper.sh)]
   | Recibe argumentos tipificados, valida regex, expone psql variables
   v
[Docker exec -i barberagency-postgres]
   | Invoca psql -X -v ON_ERROR_STOP=1
   v
[PostgreSQL Engine (Transaccional)]
```

**Uso de `set_config` para transferir parámetros a PL/pgSQL**:
Para evitar la evaluación insegura de variables locales de psql (`:db_temp`) dentro de bloques dollar-quoted (`DO $$ ... $$`), los parámetros se inyectarán como variables de sesión usando `set_config()` antes de invocar el bloque `DO`, y se leerán usando `current_setting()` de forma segura dentro del bloque.

---

### K. SQL y PL/pgSQL Transaccional

El diseño SQL/PL/pgSQL de la política declarativa local se ejecutará de forma atómica bajo una única transacción:

```sql
\set ON_ERROR_STOP 1
BEGIN;

-- Asignación segura de variables
SELECT set_config('policy.db_temp', :'db_temp', true);
SELECT set_config('policy.val_role', :'val_role', true);
SELECT set_config('policy.allowed_schemas', :'allowed_schemas', true);

DO $policy$
DECLARE
    v_db TEXT := current_setting('policy.db_temp');
    v_role TEXT := current_setting('policy.val_role');
    v_allowed TEXT := current_setting('policy.allowed_schemas');
    v_schema RECORD;
BEGIN
    -- Validar precondiciones de no superusuario en el rol de validación
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role AND rolsuper) THEN
        RAISE EXCEPTION 'database_acl_policy_role_admin_attribute' USING ERRCODE = 'P0001';
    END IF;

    -- Revocar privilegios globales a PUBLIC sobre la base de datos
    EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', v_db);
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', v_db, v_role);

    -- Descubrimiento dinámico de schemas y validación bidireccional
    FOR v_schema IN 
        SELECT nspname FROM pg_catalog.pg_namespace 
        WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND nspname NOT LIKE 'pg_temp_%'
          AND nspname NOT LIKE 'pg_toast_temp_%'
    LOOP
        -- Validación contra allowlist
        IF NOT (v_schema.nspname = ANY(string_to_array(v_allowed, ','))) THEN
            RAISE EXCEPTION 'database_acl_policy_schema_unexpected: %', v_schema.nspname USING ERRCODE = 'P0001';
        END IF;

        -- Aplicar USAGE y SELECT restrictivos
        EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', v_schema.nspname);
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', v_schema.nspname, v_role);
        EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO %I', v_schema.nspname, v_role);
        EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', v_schema.nspname);
    END LOOP;
END
$policy$;

-- Aserciones deterministas antes del COMMIT
DO $assertions$
BEGIN
    -- Comprobar si PUBLIC retiene privilegios en tablas
    IF EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'public' 
          AND has_table_privilege('public', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
    ) THEN
        RAISE EXCEPTION 'database_acl_policy_public_privilege' USING ERRCODE = 'P0001';
    END IF;
END
$assertions$;

COMMIT;
```

---

### L. Aserciones y Fallo Cerrado

Toda discrepancia detectada abortará la transacción mediante sentencias `RAISE EXCEPTION` de PostgreSQL, impidiendo que los privilegios sean guardados y cancelando el pipeline.

* **database_acl_policy_role_admin_attribute**: Se activa si `LOCAL_VALIDATION_ROLE` posee atributos administrativos.
* **database_acl_policy_schema_unexpected**: Se activa si se descubre un esquema de usuario fuera de la allowlist.
* **database_acl_policy_public_privilege**: Se activa si `PUBLIC` posee privilegios inapropiados de lectura o escritura en tablas tras aplicar la política.
* **database_acl_policy_write_privilege**: Se activa si `LOCAL_VALIDATION_ROLE` cuenta con permisos de escritura.

---

### M. Fixtures Estáticos A a V (20 Columnas Estructurales)

| ID | Objetivo | Entrada Estática | Precondición | Unidad Futura | Tipo de Prueba | Aislamiento | Oráculo | Resultado Esperado | Código Exacto Error | Exit Status | Gate | Falso Positivo | Falso Negativo | Evidencia | Sin secretos | Sin conexión | Sin credenciales | Sin ejecución | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | Rechazar DATABASE ACL | `'12; 0 0 DATABASE ACL - DATABASE db postgres'` | Registry activo | `Parse-TOC-Structural-Line` | STATIC_FIXTURE | Offline | `Valid = $false` | `Valid = $false` | `global_descriptor_forbidden` | `1` | `STATIC_POLICY_VALIDATED` | Regex match exacto | Modific. de patrón | Output de parser | YES | YES | YES | YES | NOT_EXECUTED |
| **B** | Rechazar DATABASE PROPERTIES | `'13; 0 0 DATABASE PROPERTIES - DATABASE db postgres'` | Registry activo | `Parse-TOC-Structural-Line` | STATIC_FIXTURE | Offline | `Valid = $false` | `Valid = $false` | `global_descriptor_forbidden` | `1` | `STATIC_POLICY_VALIDATED` | Regex match exacto | Modific. de patrón | Output de parser | YES | YES | YES | YES | NOT_EXECUTED |
| **C** | Parámetro ausente | `$TEMP_DATABASE_NAME = $null` | Validación inicial | Inicialización | STATIC_FIXTURE | Offline | Exception | Exception | `database_acl_policy_parameter_invalid` | `1` | `STATIC_POLICY_VALIDATED` | Chequeo de nulos | Test con valor | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **D** | Identificador inválido | `$TEMP_DATABASE_NAME = "db; DROP;"` | Validación regex | Validador | STATIC_FIXTURE | Offline | Exception | Exception | `database_acl_policy_parameter_invalid` | `1` | `STATIC_POLICY_VALIDATED` | Regex estricta | Inyec. no detectada| Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **E** | Valor vacío | `$LOCAL_VALIDATION_ROLE = ""` | Validación regex | Validador | STATIC_FIXTURE | Offline | Exception | Exception | `database_acl_policy_parameter_invalid` | `1` | `STATIC_POLICY_VALIDATED` | Chequeo de longitud| Test con valor | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **F** | Base temporal igual a prod | `$TEMP_DATABASE_NAME = "barberagency_prod"` | Restricción cruzada | Validador | STATIC_FIXTURE | Offline | Exception | Exception | `database_acl_policy_role_collision` | `1` | `STATIC_POLICY_VALIDATED` | Comparación directa| Test con valores diff| Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **G** | Rol local inexistente | `val_role` no registrado en pg_roles | Pre-vuelo catálogo | Aserción SQL | FUTURE_INTEG_TEST | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | Exception | `database_acl_policy_role_missing` | `1` | TECHNICAL_VALIDATION_COMPLETED_NO | Catálogo mock | Test con rol exist. | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **H** | Ausencia de flags psql | Comando sin `-X` | Comprobación de cadena | Transportador | STATIC_FIXTURE | Offline | Exception | Exception | `database_acl_policy_parameter_invalid` | `1` | `STATIC_POLICY_VALIDATED` | Check substring | Test con flags ok | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **I** | Ausencia de transacción | Comando SQL sin BEGIN/COMMIT | Comprobación de cadena | Transportador | STATIC_FIXTURE | Offline | Exception | Exception | `database_acl_policy_transaction_failed`| `1` | `STATIC_POLICY_VALIDATED` | Check regex BEGIN | Test con trans. ok | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **J** | Continuación tras fallo | `$LASTEXITCODE = 1` | Simulación de error | Control de flujo | STATIC_FIXTURE | Offline | Aborto | Aborto | `database_acl_policy_exit_propagation_failed`|`1` | `STATIC_POLICY_VALIDATED` | Check exitcode | Test exitcode 0 | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **K** | Host o usuario hardcodeado | String "barber_test" en código | Análisis estático | Auditor | STATIC_FIXTURE | Offline | Exception | Exception | `database_acl_policy_parameter_invalid` | `1` | `STATIC_POLICY_VALIDATED` | Check string const | Test con var. | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **L** | Secretos en script | Cadena de contraseña en texto | Análisis estático | Auditor | STATIC_FIXTURE | Offline | Exception | Exception | `database_acl_policy_parameter_invalid` | `1` | `STATIC_POLICY_VALIDATED` | Regex patrones secr | Test sin secretos | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **M** | Schema interno en allowlist | `$ALLOWED_RESTORED_SCHEMAS = "pg_catalog"` | Restricción cruzada | Validador | STATIC_FIXTURE | Offline | Exception | Exception | `database_acl_policy_schema_unexpected` | `1` | `STATIC_POLICY_VALIDATED` | Check allowlist items| Test con public | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **N** | Schema inesperado | Esquema `extra_schema` no permitido | Validación allowlist | Aserción SQL | FUTURE_INTEG_TEST | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | Exception | `database_acl_policy_schema_unexpected` | `1` | TECHNICAL_VALIDATION_COMPLETED_NO | Catálogo mock | Test con public | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **O** | Colisión de roles | `val_role = postgres` | Restricción cruzada | Validador | STATIC_FIXTURE | Offline | Exception | Exception | `database_acl_policy_role_collision` | `1` | `STATIC_POLICY_VALIDATED` | Comparación directa| Test con roles diff| Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **P** | Rol con atributos admin | `val_role` con `rolsuper = true` | Catálogo mock | Aserción SQL | FUTURE_INTEG_TEST | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | Exception | `database_acl_policy_role_admin_attribute` | `1` | TECHNICAL_VALIDATION_COMPLETED_NO | Catálogo mock | Test sin superuser | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **Q** | Membresía admin indirecta | `val_role` miembro de `rds_superuser` | Validación recursiva | Aserción SQL | FUTURE_INTEG_TEST | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | Exception | `database_acl_policy_indirect_membership_forbidden`|`1` | TECHNICAL_VALIDATION_COMPLETED_NO | Recursión mock | Test sin membresía | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **R** | EXECUTE fuera de allowlist | Concesión de EXECUTE en func | Allowlist vacía | Aserción SQL | FUTURE_INTEG_TEST | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | Exception | `database_acl_policy_execute_privilege` | `1` | TECHNICAL_VALIDATION_COMPLETED_NO | Check execute privilege| Test sin EXECUTE | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **S** | SECURITY DEFINER accesible | Función `prosecdef = true` en catálogo | Validación catálogo | Aserción SQL | FUTURE_INTEG_TEST | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | Exception | `database_acl_policy_execute_privilege` | `1` | TECHNICAL_VALIDATION_COMPLETED_NO | Check prosecdef | Test con invoker | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **T** | Escritura inesperada | Tabla con privilegios INSERT | Aserciones post-acl | Aserción SQL | FUTURE_INTEG_TEST | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | Exception | `database_acl_policy_write_privilege` | `1` | TECHNICAL_VALIDATION_COMPLETED_NO | Check table privilege | Test con SELECT | Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **U** | Privilegio PUBLIC (NULL) | PUBLIC con CONNECT en base | Aserciones post-acl | Aserción SQL | FUTURE_INTEG_TEST | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | Exception | `database_acl_policy_public_privilege` | `1` | TECHNICAL_VALIDATION_COMPLETED_NO | Check base privilege | Test sin connect PUBLIC| Salida error | YES | YES | YES | YES | NOT_EXECUTED |
| **V** | Fallo antes de COMMIT | Discrepancia en aserciones | Ejecución transaccional | Motor SQL | FUTURE_INTEG_TEST | FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED | Exception | Exception | `database_acl_policy_transaction_failed` | `1` | TECHNICAL_VALIDATION_COMPLETED_NO | Transacción rollback | Test con commit ok | Salida error | YES | YES | YES | YES | NOT_EXECUTED |

---

### N. Diseño de Prueba Controlled Temp Restore Policy (controlled_temp_restore_policy)
Esta prueba futura (aún no autorizada) se ejecutará en un entorno totalmente aislado:

1. **Precondición**:
   * Aislamiento total de red (Egress block a IPs de producción y Cloudflare R2).
   * Uso de la base de datos `template0` para inicializar la base temporal `$temp_db`.
2. **Dataset sintético**:
   * Uso de un dump mock que contiene esquemas no autorizados (ej: `compromised_schema`) para probar la aserción de fallo cerrado en pruebas negativas.
3. **Pruebas negativas y evidencias**:
   * La prueba simula la inyección de privilegios `INSERT` en una tabla para `PUBLIC` y verifica que el pipeline aborta transaccionalmente con la excepción `database_acl_policy_public_privilege`.
4. **Gates**:
   * La prueba exitosa es el único mecanismo habilitado para transicionar a `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED = YES`.

---

### O. Mapeo de Cambios Futuros por Función Real y Sección

| Nombre de la Función / Sección | Ubicación Líneas | Responsabilidad Actual | Cambio Futuro Propuesto | Fixture Asociado |
| :--- | :--- | :--- | :--- | :--- |
| **Normalize-Single-Identifier** | `113 - 123` | Sanitiza y normaliza un identificador simple quitando comillas dobles. | Ninguno (Sin impacto directo en la política). | - |
| **Split-And-Normalize-Composite-Identifier** | `124 - 151` | Divide identificadores compuestos (schema.object) y los normaliza. | Ninguno (Se usa para validaciones estructurales). | - |
| **Normalize-Complex-Signature** | `152 - 213` | Sanitiza argumentos de firmas de funciones complejas. | Ninguno. | - |
| **Tokenize-TOC-Line** | `214 - 407` | Tokeniza la línea de cabecera del manifiesto. | Ninguno. | - |
| **New-TOC-Contract** | `408 - 529` | Define el contrato y restricciones de un descriptor. | Ninguno. | - |
| **Parse-TOC-Structural-Line** | `530 - 1072` | Parsea una línea del TOC de pg_restore aplicando el active_registry. | Asegurar el rechazo estricto de DATABASE ACL. | `Fixture A, B` |
| **Test-StaticParsers** | `1073 - 2059`| Ejecuta validaciones offline sobre fixtures predefinidos. | Integrar nuevos fixtures estáticos de validación de parámetros y aserciones. | `Todos` |
| **Assert-NoDuplicates** | `2060 - 2068`| Valida que una lista no contenga valores duplicados. | Ninguno. | - |
| **EXISTING_TOP_LEVEL_SECTION_RESTORE**| `2203 - 2252`| Ejecuta el ciclo de vida de la base de datos temporal de pruebas. | Inyectar llamada a funciones de validación de roles y aplicación de políticas ACL locales. | `Múltiples` |

---

### P. Contratos de Funciones Nuevas Propuestas

1. **PROPOSED_NEW_FUNCTION_TestDatabaseAclParameters**:
   * *Propósito*: Validar sintácticamente parámetros propuestos.
   * *Parámetros*: `$temp_db_name` `[string]`, `$val_role_name` `[string]`.
   * *Retorno*: `[void]`.
   * *Precondiciones*: Las variables deben estar inicializadas.
   * *Postcondiciones*: El pipeline continúa si las regex coinciden; de lo contrario lanza excepción.
2. **PROPOSED_NEW_FUNCTION_InvokeControlledAclPolicy**:
   * *Propósito*: Enviar por stdin el SQL transaccional al contenedor y capturar códigos de salida.
   * *Parámetros*: `$sql_script` `[string]`, `$container` `[string]`.
   * *Retorno*: `[int]` (Exit code de psql).
   * *Precondiciones*: Base temporal de pruebas creada.
   * *Postcondiciones*: Si el retorno es diferente de 0, aborta el pipeline y lanza error.

---

### Q. Matriz de Riesgos Residuales

| ID | Descripción | Probabilidad | Impacto | Condición | Mitigación | Verificación | Gate | Riesgo Residual | Responsable | Condición de Cierre |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R1** | SECURITY DEFINER en funciones | Media | Alto | Existencia de la función en el dump | Denegación total de EXECUTE para `val_role` | Consulta al catálogo `pg_proc` | `STATIC_POLICY_VALIDATED` | Aceptable | Arquitecto | Cierre al validar catálogo |
| **R2** | Race condition en conexión temporal | Baja | Medio | Intentos de acceso concurrente | `CONNECTION LIMIT 1` sobre `session_role` | Consulta `pg_stat_activity` | `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED`| Aceptable | Operaciones | Cierre al validar límites |

---

### R. Criterios de Aceptación Objetivos y Separados

* **DESIGN_COMPLETE = PROPOSED_PENDING_INDEPENDENT_REVIEW**: El diseno documental de la politica declarativa local esta completo como propuesta pendiente de auditoria independiente. No se autoaprueba.
* **READY_FOR_IMPLEMENTATION = NO**: Permanecerá en `NO` hasta que la auditoría independiente apruebe formalmente este diseño de la política local (Etapa 2).
* **STATIC_POLICY_VALIDATED = NO**: Permanecerá en `NO` hasta que el código de validación sintáctica de parámetros y allowlists de esquemas esté escrito en el script.
* **CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED = NO**: Permanecerá en `NO` hasta la ejecución y aprobación del test controlado local.
* **DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED = NO**: Permanecerá en `NO` hasta la validación de la restauración temporal.
* **DATABASE_ACL_DECISION = PROPOSED_PENDING_INDEPENDENT_REVIEW**: Mantenido incondicionalmente en su gate preventivo.
* **READY_FOR_STAGE_2 = NO**: Mantenido en `NO`.
* **READY_FOR_EXPLICIT_EXECUTION_AUTHORIZATION = NO**: Mantenido en `NO`.


### S. RECOVERY_COMPLETION_BLOCK — cierre material de la quinta corrección
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

```text
SECTION_ID = TASK_005_V17_DATABASE_ACL_POLICY_DESIGN_FIFTH_CORRECTION
RECOVERY_COMPLETION_BLOCK = YES
INITIAL_DETECTED_STATE = FIFTH_CORRECTION_PARTIAL_RECOVERABLE
PS1_SHA256_VERIFIED = YES
PS1_PHYSICAL_LINES_VERIFIED = YES
PS1_SIZE_BYTES_VERIFIED = YES
PS1_GIT_DIFF_PRESENT = NO
MARKDOWN_PREVIOUS_KNOWN_SHA256 = 6d6eb09aa985ee4015d4e4cf6e576e3b69b67e732839e2bcac07ffad5753d815
MARKDOWN_CURRENT_PRE_RECOVERY_SHA256 = a2de8f78436e2fe2f759acc6f09aff067fd1a2ffa2d806afc31fea4ab5dd9ea2
MARKDOWN_CURRENT_PRE_RECOVERY_SIZE_BYTES = 133856
MARKDOWN_CURRENT_PRE_RECOVERY_PHYSICAL_LINES = 1800
MARKDOWN_CURRENT_PRE_RECOVERY_LOGICAL_LINES = 1800
ANTIGRAVITY_PARTIAL_WORK_PRESERVED = YES
FIFTH_CORRECTION_DUPLICATED = NO
```

La quinta corrección parcial queda recuperada como propuesta documental. No se ejecutó el script, no se probó SQL, no se accedió a producción, no se creó backup, no se restauró una base temporal, no se subió nada a R2 y no se avanzó a Stage 2.

Los estados optimistas o cerrados que aparezcan en los subapartados parciales A-R de esta quinta corrección quedan considerados `SUPERSEDED_BY_RECOVERY_COMPLETION_BLOCK`. El estado vigente y honesto para auditoría independiente es el registrado en las subsecciones S.1-S.17: propuesta documental completa, pendiente de revisión independiente, sin implementación, sin ejecución y sin validación técnica.

#### S.1 Inventario físico del script real

Identidad física verificada de `backup_production_database.ps1`:

| Atributo | Valor |
|---|---|
| SHA-256 | `d82f72bc0bab5725975540426443b46dc8f01494cdc9ae5f72c19524f4cc9fe9` |
| Tamaño bytes | `175805` |
| Líneas físicas | `2774` |
| Líneas lógicas | `2774` |
| Termina con salto de línea | `YES` |
| Diff Git del `.ps1` | `NONE` |

Parámetro real confirmado:

| Parámetro | Línea | Tipo | Estado |
|---|---:|---|---|
| `TestStaticParsersOnly` | 12 | `[switch]` | EXISTING_PARAMETER |

`TestStaticParsersOnly` se evalúa realmente en líneas 1593-1602, inmediatamente después de `Test-StaticParsers` y antes del bloque de respaldo real. No está ubicado entre 2115-2146.

Variables y gates top-level relevantes:

| Grupo | Líneas aprox. | Variables/Gates | Estado físico |
|---|---:|---|---|
| Rutas contenedor/remoto/local/R2 | 18-36 | `container_*`, `remote_*`, `local_*`, `r2_key_*` | EXISTING |
| Ciclo de vida de artefactos | 39-56 | `$state.*` | EXISTING |
| Gates de verificación | 58-88 | `BACKUP_VERIFIED`, `R2_*`, `TOC_*`, `ACL_*`, `DEFAULT_ACL_*`, `DATABASE_ACL_*` | EXISTING |
| Base temporal | 90-95 | `TEMP_DB_CREATED`, `TEMP_RESTORE_VERIFIED`, `TEMP_DB_DROPPED`, `TEMP_DB_ABSENCE_VERIFIED` | EXISTING |
| Limpieza y errores | 97-104 | `LOCAL_ARTIFACTS_PRESERVED_ON_FAILURE`, `CREDENTIAL_CLEANUP_*`, `fatal_error_msg` | EXISTING |

Funciones existentes reales:

| Función existente | Líneas aprox. | Firma | Propósito real | Llamadas/dependencias | Efectos laterales | Errores/salida | Participación en flujo | Cambio futuro requerido | Gate | Riesgo de regresión |
|---|---:|---|---|---|---|---|---|---|---|---|
| `Normalize-Single-Identifier` | 113-122 | `function Normalize-Single-Identifier($id)` | Normaliza un identificador simple preservando comillas dobles normalizadas. | Usada por normalizadores/builders. | Ninguno. | Retorna string. | Parser TOC. | Ninguno directo; reutilizable para validadores futuros. | `STATIC_POLICY_VALIDATED` | Bajo: rompería identidades TOC. |
| `Split-And-Normalize-Composite-Identifier` | 124-150 | `function Split-And-Normalize-Composite-Identifier($composite)` | Divide identificadores compuestos respetando comillas. | Llama `Normalize-Single-Identifier`. | Ninguno. | Retorna string compuesto. | Parser TOC. | Ninguno directo. | `STATIC_POLICY_VALIDATED` | Medio: afectaría schema.object. |
| `Normalize-Complex-Signature` | 152-211 | `function Normalize-Complex-Signature($sig)` | Normaliza firmas complejas de funciones/procedimientos. | Llama `Split-And-Normalize-Composite-Identifier`. | Ninguno. | Retorna firma normalizada. | Parser de `FUNCTION`/`PROCEDURE`. | Ninguno directo; validar no usar para SQL dinámico. | `STATIC_POLICY_VALIDATED` | Medio-alto: firmas mal mapeadas. |
| `Tokenize-TOC-Line` | 214-241 | `function Tokenize-TOC-Line($rem_str)` | Tokeniza líneas TOC respetando comillas. | Independiente. | Ninguno. | Retorna array de tokens. | `Parse-TOC-Structural-Line`. | Ninguno directo. | `STATIC_POLICY_VALIDATED` | Alto: falsos aceptados/rechazados. |
| `New-TOC-Contract` | 408-443 | `function New-TOC-Contract(...)` | Construye contratos para descriptores TOC. | Builders, parsers, reglas globales. | Ninguno. | Retorna hashtable. | Registro `TOC_CONTRACTS`. | Ninguno directo; no confundir con política ACL futura. | `STATIC_POLICY_VALIDATED` | Alto: contrato incompleto. |
| `Parse-TOC-Structural-Line` | 530-1068 | `function Parse-TOC-Structural-Line($line, $active_registry, $expected_version = $null)` | Parsea línea TOC, reconoce descriptor, aplica contrato y rechazo determinista. | `Tokenize-TOC-Line`, contratos/parsers. | Ninguno. | Hashtable con `Valid`, `Recognized`, `RejectionCode`, identidad. | Manifest filtered y fixtures. | Debe seguir rechazando `DATABASE ACL`/globales; no aplicar ACL operacional aquí. | `TEMP_RESTORE_TOC_PARSED` | Crítico: permitir objetos peligrosos. |
| `Test-StaticParsers` | 1073-1591 | `function Test-StaticParsers { ... }` | Ejecuta fixtures estáticos offline del parser. | Parsers/contratos. | Ninguno externo; lanza excepciones locales. | Retorna `$true` o lanza. | Usada solo con `TestStaticParsersOnly`. | Agregar fixtures estáticos de parámetros/transport/gates sin infraestructura viva. | `STATIC_POLICY_VALIDATED` | Medio: falsos positivos de seguridad. |
| `Assert-NoDuplicates` | 2060-2068 | `function Assert-NoDuplicates($list, $context)` | Detecta identidades duplicadas en listas. | Hashtable local. | Ninguno. | Lanza `DUPLICATE_IDENTITY_ERROR`. | Validación de manifest/inventario. | Puede reutilizarse para payloads futuros, sin ampliar alcance. | `TEMP_RESTORE_TOC_ALLOWLIST_VALIDATED` | Medio: duplicados ocultos. |

Secciones top-level reales:

| Sección real | Líneas aprox. | Rol actual | Observación de seguridad |
|---|---:|---|---|
| Header y parámetro | 1-13 | Define script V16 y `TestStaticParsersOnly`. | Solo existe un parámetro formal. |
| Inicialización pre-try | 15-104 | Inicializa rutas, estados, gates y errores. | Gates ACL existen pero bloquean equivalencia. |
| Funciones puras/auxiliares | 108-1068 | Normalización, tokenización, contratos y parser. | No tocan producción. |
| Fixtures estáticos | 1070-1591 | Valida parser en modo mock. | Aislado si se usa `TestStaticParsersOnly`. |
| Ejecución condicional estática | 1593-1602 | Sale 0/1 antes del backup real. | Punto de corte seguro para pruebas estáticas. |
| Try global de respaldo real | 1605-2537 | Preflight, dump, inventario, manifest, restore temporal, gates, upload R2. | Flujo real usa SSH, Docker, psql, AWS/R2. No ejecutado en esta corrección. |
| Catch global | 2539-2545 | Sanitiza error. | Reemplaza endpoint/host/UUID/bucket. |
| Finally/cleanup | 2547-2719 | Limpieza credenciales, contenedor, host remoto y local. | Usa SSH/rm si se ejecuta; no ejecutado. |
| Salida final | 2724-2773 | Exit 0 solo con todos los gates YES; si no exit 1. | `DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED` bloquea éxito. |

Flujo principal real resumido, corregido por la sexta correccion documental:

```text
param(TestStaticParsersOnly)
-> inicializacion de rutas/estados/gates
-> funciones/parser/fixtures
-> if TestStaticParsersOnly: Test-StaticParsers; exit 0/1
-> try real: preflight env/paths/versiones/uuid
-> lineas 1715-1716: creacion/preparacion del directorio del contenedor
-> lineas 1718-1723: ejecucion de pg_dump y obtencion del manifest
-> pg_restore --list / inventario TOC
-> validaciones de manifest y objetos
-> lineas 2208-2218: comprobacion, creacion y restauracion de la base temporal
-> validaciones default ACL y ACL de objetos
-> gates antes de R2
-> upload/verificacion R2 si los gates reales lo permiten
-> catch sanitizado
-> finally cleanup
-> exit 0 solo si todos los gates criticos reales son YES
```

Correccion explicita: la base temporal no se crea antes de `pg_dump`. La preparacion previa al dump corresponde al directorio del contenedor; la comprobacion, creacion y restauracion de la base temporal aparecen despues, en el bloque 2208-2218 del `.ps1` fisico. Esta correccion es documental y no modifica el script.

Puntos futuros de integración ACL propuestos, no implementados:

| Punto | Línea aprox. | Integración futura | Estado |
|---|---:|---|---|
| Validación de parámetros antes de rutas remotas | 1610-1625 | `PROPOSED_NEW_FUNCTION_TestDatabaseAclParameters` | PROPOSED_NOT_IMPLEMENTED |
| Directorio del contenedor antes de `pg_dump` | 1715-1716 | Preparacion de ruta; no es creacion de base temporal | DOCUMENTED_NOT_IMPLEMENTED |
| `pg_dump` y manifest | 1718-1723 | Orden real confirmado: dump y manifest antes de crear/restaurar base temporal | DOCUMENTED_NOT_IMPLEMENTED |
| Comprobacion, creacion y restore de base temporal | 2208-2218 | Futura politica ACL solo despues del restore temporal, antes de validaciones ACL | PROPOSED_NOT_IMPLEMENTED |
| Antes de R2 | 2433-2434 | `PROPOSED_NEW_FUNCTION_StopPipelineOnAclFailure` | PROPOSED_NOT_IMPLEMENTED |
| Salida final | 2724-2773 | `PROPOSED_NEW_FUNCTION_TestExitCodePropagation` | PROPOSED_NOT_IMPLEMENTED |

#### S.2 Trazabilidad de los 17 hallazgos obligatorios

| ID | Hallazgo | Evidencia de la cuarta corrección | Evidencia física del `.ps1` | Consecuencia | Corrección de la quinta versión | Sección donde se resuelve | Criterio objetivo | Estado honesto | Gate relacionado |
|---|---|---|---|---|---|---|---|---|---|
| H01 | Flujo real del script incorrectamente mapeado | Cuarta corrección documentaba política sin inventario completo del flujo. | Flujo real: `TestStaticParsersOnly` 1593-1602; respaldo real 1605-2537; cleanup 2547-2719; salida 2724-2773. | Diseño se insertaría en lugar incorrecto. | Mapeo físico completo de secciones y puntos de integración. | S.1 | Cada afirmación referencia líneas reales. | PROPOSED_PENDING_REVIEW | `STATIC_POLICY_VALIDATED` |
| H02 | Modelo de roles incompleto y dependiente de superusuario | Trataba `postgres` como ejecutor normal. | Script usa `-U postgres` y contenedor `barberagency-postgres` en flujo real. | Escalamiento no resuelto. | Modelo futuro separa owner, restore, sesión, validación y admin; no declara superusuario resuelto. | S.3 | Prueba controlada futura demuestra cero superuser para validación. | UNRESOLVED_BLOCKING | `DATABASE_ACL_DECISION` |
| H03 | Política de ownership incompleta | Cubría base/schemas/tablas de forma parcial. | Script restaura con owner local en flujo temporal; no hay política completa por clase. | Owners implícitos pueden otorgar ALTER/DROP. | Cobertura individual de base, schemas, relaciones, proc, tipos, LOs, extensiones, FDW, pubs/subs. | S.4 | Catálogos prueban que `LOCAL_VALIDATION_ROLE` no posee objetos. | PROPOSED_PENDING_REVIEW | `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED` |
| H04 | Allowlist sin detección de schemas faltantes | Solo detectaba inesperados. | Script actual valida TOC/manifest, no compara schemas esperados vs descubiertos para ACL local. | Restauración parcial podría pasar. | Comparación bidireccional `EXPECTED_MINUS_DISCOVERED` y `DISCOVERED_MINUS_EXPECTED`. | S.5 | Cualquier diferencia falla antes de REVOKE/GRANT. | PROPOSED_PENDING_REVIEW | `TEMP_RESTORE_TOC_ALLOWLIST_VALIDATED` |
| H05 | Matriz de privilegios incompleta | Privilegios resumidos y con EXECUTE/sequence permisivos. | Script actual compara ACLs restauradas, no aplica mínimos locales. | Permisos excesivos no detectados. | Matriz por sujeto, clase, objeto y privilegio; execute allowlist vacía. | S.6 | `LOCAL_VALIDATION_ROLE` solo CONNECT/USAGE/SELECT permitido. | PROPOSED_PENDING_REVIEW | `ACL_PRIVILEGE_CONTENT_VALIDATED` |
| H06 | PUBLIC y ACL NULL incorrectos | Usaba checks parciales con `has_*_privilege('public', ...)`. | Script usa comparaciones de ACL JSON; no modela ACL NULL/vacía con `acldefault`. | Privilegios implícitos PUBLIC podrían omitirse. | Modelo con pseudo-grantee 0, `COALESCE(acl, acldefault(...))` y `aclexplode`. | S.7 | Falla con `database_acl_policy_public_privilege` o `acl_semantics_mismatch`. | PROPOSED_PENDING_REVIEW | `ACL_PRIVILEGE_CONTENT_VALIDATED` |
| H07 | Default privileges generalizados incorrectamente | Exigía o insinuaba cero filas. | Script compara mapas default ACL, no remedia política local. | Se pueden borrar defaults legítimos o no detectar PUBLIC. | Modelo por `defaclrole`, `defaclnamespace`, `defaclobjtype`, grantee y privilegio. | S.8 | No exige cero filas; solo falla privilegio no permitido. | PROPOSED_PENDING_REVIEW | `DEFAULT_ACL_IDENTITIES_VALIDATED` |
| H08 | Contrato de parámetros incompleto | Mezclaba nombres no existentes con parámetros reales. | Único parámetro real: `TestStaticParsersOnly`. | Implementación futura aceptaría entradas ambiguas. | Tabla completa de `PROPOSED_FUTURE_PARAMETER`, validadores y restricciones cruzadas. | S.9 | CR/LF/NUL/control chars rechazados; producción y R2 bloqueados. | PROPOSED_PENDING_REVIEW | `STATIC_POLICY_VALIDATED` |
| H09 | Transporte SSH/Docker/psql ambiguo | Permitía comandos compuestos. | Script actual usa strings SSH/docker/psql directos y rutas hardcodeadas. | Riesgo de inyección y exit codes difusos. | Transporte único con wrapper fijo, sin eval, SQL por stdin y exit code exacto. | S.10 | Fixture H/J y prueba controlada verifican `-X -v ON_ERROR_STOP=1`. | PROPOSED_PENDING_REVIEW | `PRODUCTION_MUTATION_IMPOSSIBILITY_VALIDATED` |
| H10 | Aserciones insuficientes | Consultas que devuelven filas se trataban como validación. | Script lanza algunas excepciones, pero ACL policy futura no existe. | Pipeline puede continuar con hallazgos. | Catálogo de excepciones fail-closed con códigos estables. | S.11 | Toda discrepancia lanza excepción antes de COMMIT/R2. | PROPOSED_PENDING_REVIEW | `DATABASE_ACL_DECISION` |
| H11 | Catálogos y objetos elegibles incompletos | No cubría todos los catálogos requeridos. | Script consulta ACL/default ACL parcialmente. | Objetos omitidos conservan privilegios peligrosos. | Matriz de catálogos obligatorios. | S.12 | Cada catálogo define filas/cero filas, excepción y gate. | PROPOSED_PENDING_REVIEW | `ACL_OBJECT_IDENTITIES_VALIDATED` |
| H12 | Fixtures A-V incompletos y dependientes de infraestructura viva | Solo fixture A-V parcial y varios `FUTURE_INTEG_TEST` ambiguos. | `Test-StaticParsers` actual solo cubre parser TOC. | No hay pruebas offline suficientes. | 22 fixtures A-V con 20 columnas exactas y estado `NOT_EXECUTED`. | S.13 | Conteo A-V = 22; columnas = 20. | DESIGNED_NOT_EXECUTED | `STATIC_POLICY_VALIDATED` |
| H13 | Ausencia de prueba controlada futura | Diseño de prueba incompleto. | Script real puede tocar producción/R2 si se ejecuta sin gates. | Validación no reproducible segura. | Prueba futura aislada, datos sintéticos, R2 bloqueado, template0, rollback. | S.14 | Solo entorno temporal allowlisted con cero datos reales. | DESIGNED_NOT_EXECUTED | `CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED` |
| H14 | Mapeo del script incompleto e inexacto | Funciones/ubicaciones aproximadas erróneas. | Funciones reales: 113,124,152,214,408,530,1073,2060. | Cambios futuros se ubicarían mal. | Inventario por función real y secciones top-level. | S.1/S.15 | No hay nombres inventados como existentes. | PROPOSED_PENDING_REVIEW | `STATIC_POLICY_VALIDATED` |
| H15 | Contratos de funciones nuevas incompletos | Solo dos funciones propuestas. | No existen funciones `PROPOSED_NEW_FUNCTION_*` en `.ps1`. | Implementación futura sin límites claros. | Contratos completos de seis funciones propuestas, todas con prefijo exacto. | S.15 | Ninguna se declara implementada. | PROPOSED_PENDING_REVIEW | `READY_FOR_IMPLEMENTATION` |
| H16 | Riesgos residuales casi ausentes | Solo dos riesgos. | Script toca SSH, Docker, psql, R2, cleanup y ACLs. | Riesgos reales quedan sin mitigación. | Matriz amplia de riesgos residuales obligatorios. | S.16 | Cada riesgo tiene mitigación/gate/estado. | PROPOSED_PENDING_REVIEW | `DATABASE_ACL_DECISION` |
| H17 | Criterios de aceptación incompletos y circulares | Mezclaba diseño con validación. | Estados del script permanecen `NO` hasta ejecución real. | Autoaprobación documental. | Criterios separados por diseño, implementación, fixtures y prueba controlada. | S.17 | Estados inmutables conservados en `NO`/`UNRESOLVED`. | PROPOSED_PENDING_REVIEW | `READY_FOR_EXPLICIT_EXECUTION_AUTHORIZATION` |

#### S.3 Modelo de roles sin escalamiento

Realidad actual física:

```text
CURRENT_RESTORE_EXECUTION_ROLE = postgres
CURRENT_SUPERUSER_DEPENDENCY_PRESENT = YES
CURRENT_SCRIPT_USES_PSQL_U_POSTGRES = YES
CURRENT_DATABASE_ACL_EQUIVALENCE_VALIDATED = NO
```

Modelo futuro propuesto:

| Rol | Tipo futuro | Atributos requeridos | Puede poseer objetos | Puede escribir | Puede ejecutar funciones | Membresías escalables | Estado |
|---|---|---|---|---|---|---|---|
| `DATABASE_OWNER_ROLE` | PROPOSED_FUTURE_PARAMETER | Validado, no producción incompatible | Solo si corresponde al owner restaurado/documentado | No por validación local | No para validación | Prohibidas hacia admin | PROPOSED |
| `TEMP_DATABASE_OWNER_ROLE` | PROPOSED_FUTURE_PARAMETER | No superuser por defecto; suficiente para base temporal | Sí, base temporal y objetos administrativos temporales | Sí, solo administración temporal | Solo administración necesaria | Sin SET ROLE hacia superior salvo requerido y registrado | PROPOSED |
| `RESTORE_EXECUTION_ROLE` | PROPOSED_FUTURE_PARAMETER | Mínimo para `pg_restore`; superuser no predeterminado | Puede crear objetos restaurados si `--no-owner` | Solo restore | Solo lo necesario para restore | Controladas | PROPOSED |
| `LOCAL_VALIDATION_ROLE` | PROPOSED_FUTURE_PARAMETER | `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS` | NO | NO | NO | NO directas ni transitivas | REQUIRED |
| `SESSION_ROLE` | PROPOSED_FUTURE_PARAMETER | LOGIN temporal restringido, sin admin | NO | NO | NO | No escalable | PROPOSED |
| `ADMINISTRATION_ROLE` | PROPOSED_FUTURE_PARAMETER | Administración local temporal, no producción | Solo administración temporal | Sí, controlado | Sí, controlado | Registradas | PROPOSED |
| Owners restaurados descubiertos | DISCOVERED_RUNTIME_SET | Desde catálogos restaurados | Sí, como owners originales/representados | No se conceden a validación | No se conceden a validación | No heredables por validación | DISCOVERED_FUTURE |
| Roles creadores | DISCOVERED_RUNTIME_SET | Desde `pg_default_acl.defaclrole` y owners | Pueden existir como referencia | No para validación | No para validación | No heredables por validación | DISCOVERED_FUTURE |
| `PUBLIC` | PSEUDO_GRANTEE_INTERNAL_0 | No rol real, grantee 0 | NO | NO | NO | N/A | MODELED |

`LOCAL_VALIDATION_ROLE` debe cumplir:

```text
LOCAL_VALIDATION_ROLE_LOGIN = NOLOGIN
LOCAL_VALIDATION_ROLE_SUPERUSER = NOSUPERUSER
LOCAL_VALIDATION_ROLE_CREATEDB = NOCREATEDB
LOCAL_VALIDATION_ROLE_CREATEROLE = NOCREATEROLE
LOCAL_VALIDATION_ROLE_REPLICATION = NOREPLICATION
LOCAL_VALIDATION_ROLE_BYPASSRLS = NOBYPASSRLS
LOCAL_VALIDATION_ROLE_OWNS_OBJECTS = NO
LOCAL_VALIDATION_ROLE_WRITE_PRIVILEGES = NO
LOCAL_VALIDATION_ROLE_CREATE_PRIVILEGES = NO
LOCAL_VALIDATION_ROLE_EXECUTE_PRIVILEGES = NO
LOCAL_VALIDATION_ROLE_ESCALABLE_MEMBERSHIPS = NO
FUNCTION_EXECUTE_ALLOWLIST = EMPTY
```

La verificación futura de membresías debe recorrer `pg_auth_members` de forma directa y transitiva con CTE recursivo, conjunto visitado y control de ciclos. Debe fallar con `database_acl_policy_direct_membership_forbidden` o `database_acl_policy_indirect_membership_forbidden`.

No se declara resuelta la dependencia de superusuario. Solo una prueba controlada futura podrá cambiar ese estado.

#### S.4 Ownership completo

| Clase | Catálogo base | Política futura | Criterio fail-closed |
|---|---|---|---|
| Base | `pg_database` | Owner temporal no debe ser `LOCAL_VALIDATION_ROLE`. | `database_acl_policy_owner_mismatch` |
| Schemas | `pg_namespace` | Owners descubiertos permitidos; validación local sin ownership. | `database_acl_policy_owner_mismatch` |
| Tablas ordinarias | `pg_class relkind='r'` | Sin ownership para validación; solo SELECT. | `database_acl_policy_owner_mismatch` |
| Tablas particionadas | `pg_class relkind='p'` | Igual a tablas; validar particiones y padres. | `database_acl_policy_owner_mismatch` |
| Vistas | `pg_class relkind='v'` | Sin ownership; SELECT si elegible. | `database_acl_policy_owner_mismatch` |
| Vistas materializadas | `pg_class relkind='m'` | Sin ownership; SELECT si elegible; no REFRESH. | `database_acl_policy_owner_mismatch` |
| Secuencias | `pg_class relkind='S'` | Sin ownership; privilegios solo si prueba futura exige. | `database_acl_policy_write_privilege` |
| Funciones | `pg_proc prokind='f'` | Sin ownership; EXECUTE prohibido por allowlist vacía. | `database_acl_policy_execute_privilege` |
| Procedimientos | `pg_proc prokind='p'` | Sin ownership; EXECUTE prohibido. | `database_acl_policy_execute_privilege` |
| Agregados | `pg_proc prokind='a'` | Sin ownership; EXECUTE prohibido. | `database_acl_policy_execute_privilege` |
| Tipos | `pg_type` | Sin ownership; USAGE solo si necesario y documentado. | `database_acl_policy_write_privilege` |
| Dominios | `pg_type typtype='d'` | Sin ownership. | `database_acl_policy_owner_mismatch` |
| Large objects | `pg_largeobject_metadata` | Sin ownership; lectura/escritura prohibidas salvo prueba expresa. | `database_acl_policy_write_privilege` |
| Extensiones | `pg_extension` | No remediar miembros como objetos independientes sin `pg_depend`. | `database_acl_policy_owner_mismatch` |
| Miembros de extensiones | `pg_depend deptype='e'` | Excluir de remediación destructiva. | `database_acl_policy_post_verification_failed` |
| Event triggers | `pg_event_trigger` | No ejecutables por validación; tratar como riesgo externo. | `database_acl_policy_execute_privilege` |
| FDW | `pg_foreign_data_wrapper` | Sin uso por validación. | `database_acl_policy_public_privilege` |
| Foreign servers | `pg_foreign_server` | Sin USAGE a validación/PUBLIC. | `database_acl_policy_public_privilege` |
| User mappings | `pg_user_mapping` | No revelar ni copiar secretos. | `database_acl_policy_post_verification_failed` |
| Publicaciones | `pg_publication` | Externas; no habilitar. | `database_acl_policy_post_verification_failed` |
| Suscripciones | `pg_subscription` | Externas; no habilitar; credenciales protegidas. | `database_acl_policy_post_verification_failed` |

Ownership, ACL y privilegios implícitos del owner son dominios separados. El owner puede tener capacidades `ALTER`, `DROP`, `COMMENT`, `SECURITY LABEL` y mantenimiento no expresadas en ACL; por eso `LOCAL_VALIDATION_ROLE` no puede poseer ningún objeto.

#### S.5 Allowlist de schemas

```text
ALLOWED_RESTORED_SCHEMAS = PROPOSED_FUTURE_PARAMETER
EXPECTED_MINUS_DISCOVERED_NONEMPTY_ERROR = database_acl_policy_schema_missing
DISCOVERED_MINUS_EXPECTED_NONEMPTY_ERROR = database_acl_policy_schema_unexpected
FAIL_BEFORE_REVOKE_OR_GRANT = YES
```

Clasificación:

| Schema/clase | Clasificación | Acción futura |
|---|---|---|
| `pg_catalog` | INTERNAL_SYSTEM | Excluir de usuario; nunca allowlist. |
| `information_schema` | INTERNAL_SYSTEM | Excluir. |
| `pg_toast` | INTERNAL_SYSTEM | Excluir. |
| `pg_temp_*` | TEMP_INTERNAL | Excluir. |
| `pg_toast_temp_*` | TEMP_INTERNAL | Excluir. |
| Schemas de extensiones | EXTENSION_SCHEMA | Detectar por `pg_extension`/`pg_depend`; permitir solo si esperado. |
| Schemas de usuario | USER_SCHEMA | Deben estar en allowlist. |
| Restaurables | RESTORABLE_USER_OR_EXTENSION | Comparación bidireccional. |
| Permitidos | EXPECTED_ALLOWED | Solo estos reciben REVOKE/GRANT. |
| Inesperados | UNEXPECTED_BLOCKING | Falla antes de tocar ACL. |

#### S.6 Privilegios mínimos

| Sujeto | Clase | Objeto | Privilegio | Política futura |
|---|---|---|---|---|
| `LOCAL_VALIDATION_ROLE` | database | temporal autorizada | CONNECT | ALLOW |
| `LOCAL_VALIDATION_ROLE` | database | cualquiera | CREATE | DENY |
| `LOCAL_VALIDATION_ROLE` | database | temporal | TEMPORARY | DENY_BY_DEFAULT |
| `LOCAL_VALIDATION_ROLE` | schema | allowlist | USAGE | ALLOW |
| `LOCAL_VALIDATION_ROLE` | schema | cualquiera | CREATE | DENY |
| `LOCAL_VALIDATION_ROLE` | relación | tablas/vistas elegibles | SELECT | ALLOW |
| `LOCAL_VALIDATION_ROLE` | relación | cualquiera | INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN | DENY |
| `LOCAL_VALIDATION_ROLE` | secuencia | elegible | USAGE/SELECT/UPDATE | DENY_BY_DEFAULT; permitir solo si prueba futura lo demuestra |
| `LOCAL_VALIDATION_ROLE` | función/procedimiento/agregado | cualquiera | EXECUTE | DENY; `FUNCTION_EXECUTE_ALLOWLIST = EMPTY` |
| `LOCAL_VALIDATION_ROLE` | tipo/dominio | restaurado | USAGE | DENY_BY_DEFAULT |
| `LOCAL_VALIDATION_ROLE` | large object | cualquiera | SELECT/UPDATE | DENY |
| `LOCAL_VALIDATION_ROLE` | rol | cualquiera | SET ROLE/membresía | DENY |
| `LOCAL_VALIDATION_ROLE` | objeto | cualquiera | ownership/ALTER/DROP/COMMENT/SECURITY LABEL/creación/BYPASSRLS | DENY |
| `PUBLIC` | todos | todos | cualquier privilegio efectivo no esperado | DENY |
| Roles owners/admin temporales | temporal | administración | mínimo requerido | ALLOW_WITH_RECORD |

#### S.7 PUBLIC, ACL NULL y ACL vacía

Modelo futuro:

```text
PUBLIC_INTERNAL_GRANTEE_OID = 0
ACL_REAL = object_acl_column
ACL_EFFECTIVE = COALESCE(object_acl_column, acldefault(object_type, owner_oid))
ACL_EXPANSION = aclexplode(ACL_EFFECTIVE)
PRIMARY_PUBLIC_CHECK = grantee = 0
HAS_PUBLIC_PRIVILEGE_FUNCTIONS_AS_PRIMARY_MECHANISM = NO
```

Debe distinguir:

| Caso | Significado | Tratamiento |
|---|---|---|
| ACL NULL | Usa privilegios default de PostgreSQL por clase/owner. | Expandir con `acldefault`; no tratar como ausencia. |
| ACL vacía | Sin entradas explícitas. | Evaluar owner/privilegios implícitos por separado. |
| ACL explícita sin PUBLIC | Puede tener grants directos/heredados. | Evaluar grantee, membresías y owner. |
| ACL explícita con PUBLIC | Riesgo directo. | Falla si privilegio no permitido. |
| Privilegios predeterminados | `pg_default_acl`. | Evaluar por creador/schema/tipo. |
| Privilegios del owner | Implícitos, no siempre ACL. | Prohibir ownership a validación. |
| Privilegios heredados | `pg_auth_members`. | Recursión con ciclos. |

La base temporal futura debe crearse con `TEMPLATE template0`.

#### S.8 Default privileges

No se exige que `pg_default_acl` tenga cero filas. La política se modela por:

| Dimensión | Catálogo/campo |
|---|---|
| Rol creador | `pg_default_acl.defaclrole` |
| Namespace | `pg_default_acl.defaclnamespace` |
| Tipo objeto | `pg_default_acl.defaclobjtype` |
| ACL | `pg_default_acl.defaclacl` |
| Grantee/privilegio | `aclexplode(COALESCE(defaclacl, acldefault(...)))` |
| PUBLIC | `grantee = 0` |

Toda remediación futura debe usar forma equivalente a:

```text
ALTER DEFAULT PRIVILEGES FOR ROLE <creator_role> IN SCHEMA <allowed_schema> ...
```

sin ejecutar ni proponer valores reales hasta preflight autorizado.

#### S.9 Parámetros futuros

El único parámetro existente confirmado es `TestStaticParsersOnly`. Los siguientes son `PROPOSED_FUTURE_PARAMETER`:

| Parámetro | Tipo | Origen | Obligatorio | Límites/normalización/caracteres | Validador | Sensible | Logging | Error | Exit | Gate | Restricciones cruzadas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `SSH_HOST` | string | owner/preflight | YES | FQDN/IP allowlisted; trim; sin CR/LF/NUL/control | host allowlist | YES | redacted | `database_acl_policy_parameter_invalid` | 1 | preflight | no producción si prueba controlada |
| `SSH_PORT` | int | owner/preflight | YES | 1-65535 | int range | NO | value | same | 1 | preflight | solo puerto aprobado |
| `SSH_USER` | string | owner/preflight | YES | identifier/allowlist; no root | allowlist | NO | value | same | 1 | preflight | no usuario productivo no aprobado |
| `DOCKER_CONTAINER_NAME` | string | preflight | YES | `^[a-zA-Z0-9_.-]{1,128}$` | regex+allowlist | NO | value | same | 1 | preflight | no contenedor producción |
| `TEMP_DATABASE_NAME` | identifier | generated/preflight | YES | 3-63, lower, no prod | identifier validator | NO | value | same | 1 | preflight | distinto producción |
| `DATABASE_OWNER_ROLE` | identifier | discovered | YES | PostgreSQL identifier | catalog validator | NO | value | `database_acl_policy_role_missing` | 1 | ACL | distinto validation |
| `TEMP_DATABASE_OWNER_ROLE` | identifier | preflight | YES | PostgreSQL identifier | catalog validator | NO | value | same | 1 | ACL | no validation role |
| `RESTORE_EXECUTION_ROLE` | identifier | preflight | YES | PostgreSQL identifier | catalog validator | NO | value | same | 1 | ACL | no superuser default |
| `LOCAL_VALIDATION_ROLE` | identifier | preflight | YES | PostgreSQL identifier; NOLOGIN | catalog+attribute validator | NO | value | `database_acl_policy_role_admin_attribute` | 1 | ACL | no owner, no membership |
| `SESSION_ROLE` | identifier | preflight | YES | PostgreSQL identifier | catalog validator | NO | value | same | 1 | ACL | no SET ROLE superior |
| `ADMINISTRATION_ROLE` | identifier | preflight | YES | PostgreSQL identifier | catalog validator | NO | value | same | 1 | ACL | no collision |
| `ALLOWED_RESTORED_SCHEMAS` | array | owner/preflight | YES | non-empty, items identifiers, no internal | bidirectional set check | NO | list | schema missing/unexpected | 1 | ACL | not empty |
| `EXPECTED_POSTGRES_MAJOR_VERSION` | int | preflight | YES | supported major | compare server | NO | value | parameter_invalid | 1 | preflight | exact compatible |
| `TEMP_ENVIRONMENT_ID` | string | preflight | YES | UUID/name allowlisted | env validator | NO | value | parameter_invalid | 1 | preflight | must be temporal |
| `PRODUCTION_BLOCKLIST` | array | owner/preflight | YES | exact hosts/db/container names | blocklist check | MAYBE | redacted | parameter_invalid | 1 | preflight | blocks prod |
| `R2_BLOCK_MODE` | enum | preflight | YES | `FORCED_BLOCKED` in controlled tests | enum | NO | value | parameter_invalid | 1 | preflight | R2 disabled |

Todos rechazan CR, LF, NUL y caracteres de control. Se bloquean base temporal igual a producción, host/contenedor productivo, entorno no temporal, roles incompatibles iguales, allowlist vacía, versión inesperada y R2 habilitado en prueba controlada.

#### S.10 Transporte único

Diseño futuro exclusivo:

```text
PowerShell
→ cliente SSH
→ wrapper remoto fijo y auditado
→ docker exec -i
→ psql -X -v ON_ERROR_STOP=1
→ SQL fijo mediante stdin
```

Wrapper futuro:

| Regla | Estado requerido |
|---|---|
| No acepta comandos arbitrarios | REQUIRED |
| Valida nuevamente los valores | REQUIRED |
| No usa `eval` | REQUIRED |
| No construye SQL | REQUIRED |
| Conserva stdin | REQUIRED |
| Usa argumentos separados | REQUIRED |
| Propaga exactamente exit code | REQUIRED |
| No recibe contraseñas en argumentos | REQUIRED |

#### S.11 SQL/PLpgSQL y aserciones fail-closed

No se usarán variables de `psql` directamente dentro de bloques dollar-quoted. El diseño futuro debe transferir parámetros mediante configuración segura, tabla temporal o `set_config()`/`current_setting()`, usar `format('%I', valor)` para identificadores, `EXECUTE format(...)` solo dentro de PL/pgSQL válido, una única transacción, excepciones antes de `COMMIT` y `COMMIT` solo después de todas las verificaciones.

Códigos obligatorios:

```text
database_acl_policy_parameter_invalid
database_acl_policy_role_missing
database_acl_policy_role_admin_attribute
database_acl_policy_direct_membership_forbidden
database_acl_policy_indirect_membership_forbidden
database_acl_policy_role_collision
database_acl_policy_schema_missing
database_acl_policy_schema_unexpected
database_acl_policy_owner_mismatch
database_acl_policy_public_privilege
database_acl_policy_write_privilege
database_acl_policy_execute_privilege
database_acl_policy_default_privilege
database_acl_policy_acl_semantics_mismatch
database_acl_policy_post_verification_failed
database_acl_policy_transaction_failed
database_acl_policy_exit_propagation_failed
```

Ante cualquier error se bloquean validación funcional, empaquetado, backup, upload, R2 y Stage 2.

#### S.12 Catálogos obligatorios

| Catálogo/función | Alcance | Exclusiones | Filas/cero filas | Excepción | Gate |
|---|---|---|---|---|---|
| `pg_database` | base temporal, owner, ACL | producción | fila exacta requerida | owner/parameter invalid | preflight/ACL |
| `pg_roles` | roles/atributos | roles no relacionados | filas admin en validation fallan | role missing/admin | ACL |
| `pg_auth_members` | membresías directas/transitivas | ciclos controlados | cualquier escalamiento falla | direct/indirect membership | ACL |
| `pg_namespace` | schemas | internos/temp | diferencias fallan | schema missing/unexpected | ACL |
| `pg_class` | relaciones/secuencias/vistas | miembros extensión si aplica | privilegios no permitidos fallan | write/public/owner | ACL |
| `pg_proc` | funciones/procs/agregados | allowlist execute vacía | cualquier EXECUTE validation falla | execute_privilege | ACL |
| `pg_type` | tipos/dominios | internos | USAGE no permitido falla | write/default/public | ACL |
| `pg_largeobject_metadata` | large objects | ninguno real sin autorización | privilegios a validation/public fallan | write/public | ACL |
| `pg_extension` | extensiones | N/A | identifica schemas/miembros | post_verification_failed | ACL |
| `pg_depend` | miembros extensiones | N/A | evita remediación destructiva | post_verification_failed | ACL |
| `pg_event_trigger` | event triggers | N/A | presencia requiere bloqueo/decisión | execute/post | ACL |
| `pg_foreign_data_wrapper` | FDW | N/A | USAGE no esperado falla | public_privilege | ACL |
| `pg_foreign_server` | servers | N/A | USAGE no esperado falla | public_privilege | ACL |
| `pg_user_mapping` | mappings | secretos no revelados | presencia requiere sanitización | post_verification_failed | ACL |
| `pg_publication` | publicaciones | no habilitar | presencia externa registrada | post_verification_failed | ACL |
| `pg_subscription` | suscripciones | credenciales no reveladas | presencia externa registrada | post_verification_failed | ACL |
| `pg_default_acl` | defaults | no exigir cero filas | privilegios no permitidos fallan | default_privilege | default ACL |
| `aclexplode` | expansión ACL | N/A | grantee/privilege efectivo | acl/public/write | ACL |
| `acldefault` | ACL NULL | N/A | semántica implícita | acl_semantics_mismatch | ACL |

#### S.13 Fixtures A-V con 20 columnas exactas

| ID | objetivo | entrada estática | precondición | unidad futura | tipo de prueba | modo de aislamiento | oráculo | resultado esperado | código exacto | exit status | gate | control de falso positivo | control de falso negativo | evidencia | ausencia de secretos | ausencia de conexión | ausencia de credenciales | ausencia de ejecución | estado |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | DATABASE ACL reconocido y rechazado | línea TOC `DATABASE ACL` | registry cargado | parser TOC | STATIC_FIXTURE | offline | rechazo determinista | `Valid=false` | `global_descriptor_forbidden` | 1 | STATIC_POLICY_VALIDATED | descriptor exacto | mutación descriptor | salida parser | YES | NO | NO | NO | NOT_EXECUTED |
| B | DATABASE PROPERTIES reconocido y rechazado | línea TOC `DATABASE PROPERTIES` | registry cargado | parser TOC | STATIC_FIXTURE | offline | rechazo determinista | `Valid=false` | `global_descriptor_forbidden` | 1 | STATIC_POLICY_VALIDATED | descriptor exacto | mutación descriptor | salida parser | YES | NO | NO | NO | NOT_EXECUTED |
| C | parámetro obligatorio ausente | `TEMP_DATABASE_NAME=null` | validador cargado | PROPOSED_NEW_FUNCTION_TestDatabaseAclParameters | STATIC_FIXTURE | offline | excepción | aborta | `database_acl_policy_parameter_invalid` | 1 | STATIC_POLICY_VALIDATED | null real | valor válido | log sanitizado | YES | NO | NO | NO | NOT_EXECUTED |
| D | identificador inválido por clase | `db;DROP`, rol con control char | validador cargado | parameter validator | STATIC_FIXTURE | offline | excepción por cada clase | aborta | `database_acl_policy_parameter_invalid` | 1 | STATIC_POLICY_VALIDATED | matriz clases | identificador válido | log sanitizado | YES | NO | NO | NO | NOT_EXECUTED |
| E | valor vacío | `""` | validador cargado | parameter validator | STATIC_FIXTURE | offline | excepción | aborta | `database_acl_policy_parameter_invalid` | 1 | STATIC_POLICY_VALIDATED | longitud 0 | valor no vacío | log sanitizado | YES | NO | NO | NO | NOT_EXECUTED |
| F | base temporal igual a producción | temp equals blocklist | blocklist definida | cross validator | STATIC_FIXTURE | offline | excepción | aborta | `database_acl_policy_parameter_invalid` | 1 | STATIC_POLICY_VALIDATED | comparación literal | db distinta | log sanitizado | YES | NO | NO | NO | NOT_EXECUTED |
| G | rol local inexistente | mock `pg_roles` sin rol | catálogo mock | role validator | FUTURE_CONTROLLED_DATABASE_TEST | isolated temp | excepción | aborta | `database_acl_policy_role_missing` | 1 | CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED | catálogo controlado | rol presente | resultado SQL | YES | YES | NO | NO | NOT_EXECUTED |
| H | ausencia de `psql -X -v ON_ERROR_STOP=1` | comando sin flags | transport mock | wrapper validator | STATIC_FIXTURE | offline | excepción | aborta | `database_acl_policy_parameter_invalid` | 1 | STATIC_POLICY_VALIDATED | string exacto | flags completos | reporte estático | YES | NO | NO | NO | NOT_EXECUTED |
| I | ausencia o duplicidad de transacción | SQL sin BEGIN o doble COMMIT | SQL mock | transaction validator | STATIC_FIXTURE | offline | excepción | aborta | `database_acl_policy_transaction_failed` | 1 | STATIC_POLICY_VALIDATED | conteo tokens | una transacción | reporte estático | YES | NO | NO | NO | NOT_EXECUTED |
| J | fallo intenta continuar pipeline | exit code psql=1 | pipeline mock | StopPipelineOnAclFailure | STATIC_FIXTURE | offline | no llama R2 | aborta | `database_acl_policy_exit_propagation_failed` | 1 | READY_FOR_STAGE_2 | spy de llamadas | exit 0 | log sanitizado | YES | NO | NO | NO | NOT_EXECUTED |
| K | hardcode infraestructura | host/container prod literal | scanner estático | static auditor | STATIC_FIXTURE | offline | excepción | aborta | `database_acl_policy_parameter_invalid` | 1 | STATIC_POLICY_VALIDATED | patrón blocklist | placeholder seguro | reporte estático | YES | NO | NO | NO | NOT_EXECUTED |
| L | presencia de secretos | token/password literal | scanner estático | static auditor | STATIC_FIXTURE | offline | excepción | aborta | `database_acl_policy_parameter_invalid` | 1 | STATIC_POLICY_VALIDATED | patrón secreto | texto inocuo | reporte redacted | YES | NO | NO | NO | NOT_EXECUTED |
| M | schema interno como usuario | allowlist `pg_catalog` | validador cargado | schema validator | STATIC_FIXTURE | offline | excepción | aborta | `database_acl_policy_schema_unexpected` | 1 | STATIC_POLICY_VALIDATED | lista internos | schema usuario | log sanitizado | YES | NO | NO | NO | NOT_EXECUTED |
| N | schema inesperado | discovered `extra` | catálogo mock | schema comparator | FUTURE_CONTROLLED_DATABASE_TEST | isolated temp | excepción | aborta | `database_acl_policy_schema_unexpected` | 1 | TEMP_RESTORE_TOC_ALLOWLIST_VALIDATED | set diff | set igual | resultado SQL | YES | YES | NO | NO | NOT_EXECUTED |
| O | colisión de roles | validation=owner/admin | validador cargado | role separation | STATIC_FIXTURE | offline | excepción | aborta | `database_acl_policy_role_collision` | 1 | STATIC_POLICY_VALIDATED | igualdad exacta | roles distintos | reporte estático | YES | NO | NO | NO | NOT_EXECUTED |
| P | rol administrativo | `rolsuper=true` | catálogo mock | role validator | FUTURE_CONTROLLED_DATABASE_TEST | isolated temp | excepción | aborta | `database_acl_policy_role_admin_attribute` | 1 | CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED | cada atributo | rol NO* | resultado SQL | YES | YES | NO | NO | NOT_EXECUTED |
| Q | membresía admin directa/indirecta | graph `val→admin` | catálogo mock con ciclo | membership validator | FUTURE_CONTROLLED_DATABASE_TEST | isolated temp | excepción | aborta | `database_acl_policy_indirect_membership_forbidden` | 1 | CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED | recursión visitada | sin membresía | resultado SQL | YES | YES | NO | NO | NOT_EXECUTED |
| R | EXECUTE fuera de allowlist | grant execute | allowlist vacía | ACL assertion | FUTURE_CONTROLLED_DATABASE_TEST | isolated temp | excepción | aborta | `database_acl_policy_execute_privilege` | 1 | ACL_PRIVILEGE_CONTENT_VALIDATED | función mock | no execute | resultado SQL | YES | YES | NO | NO | NOT_EXECUTED |
| S | SECURITY DEFINER accesible | `prosecdef=true` + execute | catálogo mock | proc assertion | FUTURE_CONTROLLED_DATABASE_TEST | isolated temp | excepción | aborta | `database_acl_policy_execute_privilege` | 1 | ACL_PRIVILEGE_CONTENT_VALIDATED | secdef exacto | invoker sin execute | resultado SQL | YES | YES | NO | NO | NOT_EXECUTED |
| T | escritura inesperada | grant INSERT/UPDATE | catálogo mock | ACL assertion | FUTURE_CONTROLLED_DATABASE_TEST | isolated temp | excepción | aborta | `database_acl_policy_write_privilege` | 1 | ACL_PRIVILEGE_CONTENT_VALIDATED | cada write priv | solo SELECT | resultado SQL | YES | YES | NO | NO | NOT_EXECUTED |
| U | privilegio PUBLIC con ACL NULL | acl null + default PUBLIC | catálogo mock | ACL semantics | FUTURE_CONTROLLED_DATABASE_TEST | isolated temp | excepción | aborta | `database_acl_policy_public_privilege` | 1 | ACL_PRIVILEGE_CONTENT_VALIDATED | `acldefault` | no PUBLIC | resultado SQL | YES | YES | NO | NO | NOT_EXECUTED |
| V | error antes de COMMIT exige rollback | raise before commit | SQL mock | transaction policy | FUTURE_CONTROLLED_DATABASE_TEST | isolated temp | rollback | no cambios | `database_acl_policy_transaction_failed` | 1 | CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED | estado pre/post | commit válido | resultado SQL | YES | YES | NO | NO | NOT_EXECUTED |

#### S.14 Prueba controlada futura

Diseño no ejecutado:

```text
CONTROLLED_TEST_ENVIRONMENT = TEMPORARY_ONLY
TEMP_ENVIRONMENT_ID = PROPOSED_FUTURE_PARAMETER
HOST_ALLOWLIST_REQUIRED = YES
PRODUCTION_BLOCKLIST_REQUIRED = YES
R2_BLOCK_MODE = FORCED_BLOCKED
NETWORK_ISOLATION = REQUIRED
POSTGRESQL_TEMP_VERSION = EXPECTED_POSTGRES_MAJOR_VERSION
TEMP_DATABASE_TEMPLATE = template0
TEMP_ROLES_AND_CREDENTIALS = EPHEMERAL
TEMP_CREDENTIAL_EXPIRATION = REQUIRED
DATASET = SYNTHETIC_ONLY
REAL_DATA_ALLOWED = NO
SEPARATE_AUTHORIZATION_REQUIRED = YES
POSITIVE_AND_NEGATIVE_TESTS_REQUIRED = YES
ROLLBACK_AND_CLEANUP_REQUIRED = YES
SANITIZED_EVIDENCE_REQUIRED = YES
FAILURE_ESCALATION = BLOCK_AND_REQUIRE_REVIEW
```

#### S.15 Mapeo de cambios futuros y contratos de funciones nuevas

Funciones/secciones reales afectadas:

| Real | Cambio futuro | Función nueva propuesta | Estado |
|---|---|---|---|
| Inicialización 15-104 | añadir parámetros validados sin secretos | `PROPOSED_NEW_FUNCTION_TestDatabaseAclParameters` | PROPOSED_NOT_IMPLEMENTED |
| Preflight 1610-1702 | validar roles/host/container/version/blocklist | `PROPOSED_NEW_FUNCTION_TestRoleSeparation` | PROPOSED_NOT_IMPLEMENTED |
| Manifest/TOC 1723-2191 | construir payload allowlist bidireccional | `PROPOSED_NEW_FUNCTION_BuildSchemaAllowlistPayload` | PROPOSED_NOT_IMPLEMENTED |
| Restore temporal 2209-2224 | invocar política ACL por transporte único | `PROPOSED_NEW_FUNCTION_InvokeControlledAclPolicy` | PROPOSED_NOT_IMPLEMENTED |
| Gates 2433-2434 y salida 2724-2773 | bloquear pipeline y validar exit code | `PROPOSED_NEW_FUNCTION_TestExitCodePropagation` | PROPOSED_NOT_IMPLEMENTED |
| Gates antes R2/Stage 2 | detener todo ante fallo ACL | `PROPOSED_NEW_FUNCTION_StopPipelineOnAclFailure` | PROPOSED_NOT_IMPLEMENTED |

Contratos:

| Función propuesta | Parámetros | Retorno | Precondición | Postcondición | Error/gate |
|---|---|---|---|---|---|
| `PROPOSED_NEW_FUNCTION_TestDatabaseAclParameters` | parámetros futuros completos | void | entradas presentes | entradas normalizadas o aborta | `database_acl_policy_parameter_invalid` |
| `PROPOSED_NEW_FUNCTION_TestRoleSeparation` | roles y catálogo | void | catálogo temporal accesible | roles separados/no escalables | role missing/admin/membership/collision |
| `PROPOSED_NEW_FUNCTION_BuildSchemaAllowlistPayload` | expected/discovered schemas | JSON/text safe | schema discovery | sets iguales o aborta | schema missing/unexpected |
| `PROPOSED_NEW_FUNCTION_InvokeControlledAclPolicy` | SQL fijo, wrapper args | exit code | temp restore listo | política aplicada o aborta | transaction/exit failed |
| `PROPOSED_NEW_FUNCTION_TestExitCodePropagation` | expected/actual exit | void | wrapper mock | exit exacto | exit_propagation_failed |
| `PROPOSED_NEW_FUNCTION_StopPipelineOnAclFailure` | gate states | void | ACL policy result | bloquea backup/upload/R2/Stage2 | post_verification_failed |

#### S.16 Riesgos residuales

| Riesgo | Control propuesto | Gate | Estado |
|---|---|---|---|
| Schemas inesperados | Comparación bidireccional | schema allowlist | OPEN |
| SECURITY DEFINER/INVOKER | EXECUTE allowlist vacía | ACL content | OPEN |
| `search_path` | fijar y auditar sesión | controlled test | OPEN |
| Ownership | validation role sin ownership | owner check | OPEN |
| ACL NULL/vacía | `COALESCE` + `acldefault` | ACL semantics | OPEN |
| Default privileges | evaluar por creator/schema/type | default ACL | OPEN |
| Extensiones | `pg_depend` miembros extensión | post verification | OPEN |
| RLS/FORCE RLS | catálogos y pruebas futuras | controlled test | OPEN |
| Membresías/SET ROLE | CTE recursivo con ciclos | role separation | OPEN |
| Versión PostgreSQL | major exacto | preflight | OPEN |
| MAINTAIN | negar si aplica | privilege matrix | OPEN |
| TOC incompleto/malicioso | parser + fixtures | parser gate | OPEN |
| Restauración parcial | manifest/inventario comparado | restore gate | OPEN |
| Rollback | una transacción + cleanup | transaction gate | OPEN |
| Exit codes | wrapper propaga exacto | exit gate | OPEN |
| Cleanup | evidencia y no producción | cleanup gate | OPEN |
| Logs | sanitización obligatoria | evidence gate | OPEN |
| `template1` | usar `template0` | preflight | OPEN |
| Large objects | catálogo dedicado | ACL object gate | OPEN |
| Tipos/dominios | `pg_type` | ACL object gate | OPEN |
| Event triggers | bloquear/registrar | post verification | OPEN |
| FDW/foreign servers | sin USAGE | ACL gate | OPEN |
| Publicaciones/suscripciones | externas no habilitadas | post verification | OPEN |
| Equivalencia literal vs operacional | no declararla validada | database ACL decision | OPEN |
| Objetos omitidos | catálogo mínimo obligatorio | ACL object gate | OPEN |
| Concurrencia | base/roles temporales únicos | controlled test | OPEN |
| Roles temporales persistentes | expiración/revocación | cleanup gate | OPEN |
| `ALTER ROLE SET` | inspección role settings futura | role gate | OPEN |
| `ALTER DATABASE SET` | inspección database settings futura | database gate | OPEN |

#### S.17 Criterios de aceptación separados

| Capa | Criterio | Estado actual |
|---|---|---|
| Diseño documental | Quinta corrección contiene trazabilidad, roles, ownership, allowlist, privilegios, PUBLIC, defaults, parámetros, transporte, SQL, aserciones, catálogos, fixtures, prueba futura, funciones, riesgos y criterios. | PROPOSED_PENDING_INDEPENDENT_REVIEW |
| Implementación | Código futuro escrito en `.ps1`. | NO |
| Inspección estática | Fixtures integrados y ejecutados en modo offline. | NO |
| Fixtures diseñados | A-V diseñados con 20 columnas. | YES_DOCUMENTED_NOT_EXECUTED |
| Fixtures ejecutados | A-V corridos. | NO |
| Prueba controlada | Entorno temporal autorizado ejecutado. | NO |
| Equivalencia restauración | ACL operacional equivalente demostrada. | NO |
| Autorización ejecución | Owner autoriza implementación/backup/R2/Stage2. | NO |

### T. SIXTH_DOCUMENTARY_CORRECTION - respuesta a auditoria independiente
HISTORICAL_SUPERSEDED_NON_NORMATIVE: esta seccion se conserva solo como trazabilidad y no define la politica vigente.

```text
INDEPENDENT_REVIEW_DECISION = CORRECTION_REQUIRED
SIXTH_CORRECTION_BRANCH = agent/task-005-sixth-documentary-correction
SIXTH_CORRECTION_BASE = origin/main
BRANCH_HISTORY_STATUS = CLEAN_BRANCH_FROM_ORIGIN_MAIN
PR_CREATED = NO
COMMIT_CREATED = NO
PUSH_EXECUTED = NO
REMOTE_VALIDATION_PERFORMED = NO
SCRIPT_MODIFIED = NO
SCRIPT_EXECUTED = NO
SQL_EXECUTED = NO
```

La sexta correccion se prepara documentalmente en una rama limpia basada directamente en `origin/main`. Esta afirmacion solo documenta la preparacion local de la correccion; no afirma existencia de PR, commit, push ni validacion remota.

#### T.1 Correccion del orden real del flujo

Orden real del `.ps1` fisico verificado documentalmente:

| Bloque fisico | Significado corregido | Estado documental |
|---|---|---|
| Lineas 1715-1716 | Creacion/preparacion del directorio del contenedor. No crea la base temporal. | DOCUMENTED_NOT_IMPLEMENTED |
| Lineas 1718-1723 | Ejecucion de `pg_dump` y obtencion del manifest. | DOCUMENTED_NOT_IMPLEMENTED |
| Lineas 2208-2218 | Comprobacion, creacion y restauracion de la base temporal. | DOCUMENTED_NOT_IMPLEMENTED |

Queda corregida toda afirmacion de la quinta correccion que insinuaba que la base temporal se crea antes de `pg_dump`. La politica ACL futura solo podria insertarse despues del restore temporal y antes de validaciones ACL posteriores, nunca antes de obtener el dump/manifest.

#### T.2 Modelo de roles propuesto, minimo y no validado

Estado vigente:

```text
CURRENT_SCRIPT_USES_PSQL_U_POSTGRES = YES
CURRENT_SUPERUSER_DEPENDENCY_PRESENT = YES
LOCAL_VALIDATION_ROLE = PROPOSED_FUTURE_ROLE
LOCAL_VALIDATION_ROLE_LOGIN = NOLOGIN
LOCAL_VALIDATION_ROLE_DIRECT_OR_TRANSITIVE_MEMBERSHIPS = NONE_REQUIRED
SESSION_ROLE = PROPOSED_FUTURE_ROLE
ROLE_MODEL_VALIDATED = NO
ROLE_MODEL_IMPLEMENTED = NO
DATABASE_ACL_DECISION = PROPOSED_PENDING_INDEPENDENT_REVIEW
```

Ruta futura seleccionada como `PROPOSED_PENDING_INDEPENDENT_REVIEW`: usar una sesion temporal restringida (`SESSION_ROLE`) para conectarse a la base temporal y ejecutar comprobaciones que evaluan explicitamente privilegios efectivos de `LOCAL_VALIDATION_ROLE` mediante funciones de catalogo (`has_database_privilege`, `has_schema_privilege`, `has_table_privilege`, `has_function_privilege`) y consultas directas a ACL/default ACL. `LOCAL_VALIDATION_ROLE` permanece `NOLOGIN`, sin membresias directas ni transitivas y sin ownership. No se usa `SET ROLE` hacia `LOCAL_VALIDATION_ROLE` porque un rol `NOLOGIN` sin membresias no puede ser asumido por la sesion sin introducir una contradiccion de privilegios.

Comparacion de alternativas:

| Alternativa | Ventaja | Riesgo | Decision |
|---|---|---|---|
| `SET ROLE LOCAL_VALIDATION_ROLE` | Prueba directa de sesion asumida. | Requiere membresia o cambio de LOGIN; contradice NOLOGIN/sin membresias. | REJECTED_DOCUMENTARILY |
| Membresia temporal controlada | Permite asumir rol. | Introduce membresia que la politica debe prohibir y limpiar. | REJECTED_DOCUMENTARILY |
| Funcion `SECURITY DEFINER` limitada | Puede consultar catalogos con permisos controlados. | Aumenta superficie EXECUTE y exige allowlist excepcional. | RESERVED_FOR_EXCEPTION_ONLY |
| `SESSION_ROLE` + comprobacion de privilegios efectivos de `LOCAL_VALIDATION_ROLE` | Mantiene NOLOGIN/sin membresias y verifica permisos sin asumir el rol. | Requiere prueba controlada futura para demostrar equivalencia operativa. | PROPOSED_PENDING_INDEPENDENT_REVIEW |

Responsabilidades futuras:

| Pregunta de auditoria | Respuesta propuesta |
|---|---|
| Identidad que inicia sesion temporal | `SESSION_ROLE`, LOGIN temporal restringido, sin superusuario, sin privilegios administrativos, autorizado solo contra la base temporal allowlisted. |
| Quien crea/administra roles temporales | `ADMINISTRATION_ROLE` o actor operativo temporal equivalente, separado de `LOCAL_VALIDATION_ROLE`; debe operar solo en entorno temporal y dejar auditoria. |
| Como se comprueba bajo `LOCAL_VALIDATION_ROLE` | Consultas de catalogo parametrizadas que evaluan privilegios efectivos del rol objetivo sin asumirlo. La prueba controlada futura debe demostrar que esas consultas predicen el acceso real permitido/denegado. |
| Mecanismo seleccionado | `SESSION_ROLE` + checks de privilegio efectivo; `SET ROLE` y membresia temporal quedan rechazados para el camino minimo. |
| Privilegios minimos | `LOCAL_VALIDATION_ROLE`: CONNECT/USAGE/SELECT estrictamente allowlisted; sin CREATE, TEMP, escritura, EXECUTE, ownership ni membresias. `SESSION_ROLE`: conexion temporal y lectura de catalogos necesaria para aserciones, sin acceso a produccion. |
| Controles anti-produccion | allowlist de host/contenedor/base temporal, blocklist de produccion, `TEMP_ENVIRONMENT_ID`, `R2_BLOCK_MODE=FORCED_BLOCKED`, rechazo de nombres productivos y cero credenciales productivas. |
| Limpieza/revocacion | revocar privilegios temporales, eliminar roles/sesiones temporales si fueron creados para la prueba, drop de base temporal, evidencia sanitizada de cleanup. |
| Evidencia futura esperada | logs sanitizados, consultas de catalogo, matrices expected/actual, prueba positiva/negativa, rollback/cleanup y hashes de artefactos; todo pendiente de autorizacion independiente. |

#### T.3 Fixtures G, N y P-V: conexion futura diferenciada

La tabla S.13 conserva 22 fixtures A-V y 20 columnas por fila. La columna `conexion temporal futura requerida` distingue las pruebas offline de las pruebas controladas futuras:

```text
CURRENT_DOCUMENTARY_EXECUTION = NO
FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED = YES_FOR_G_N_P_Q_R_S_T_U_V_ONLY
PRODUCTION_CONNECTION_ALLOWED = NO
PRODUCTION_CONNECTION_PERFORMED = NO
STATIC_FIXTURES_EXECUTED = NO
```

No se declara ausencia de conexion para fixtures futuros que necesariamente requieren conectarse a PostgreSQL temporal. Si se conserva la prohibicion absoluta de conexion a produccion.

#### T.4 Estados A-R degradados individualmente

Los 17 estados `Resuelto` de la tabla A-R de la quinta correccion fueron reemplazados individualmente por `SUPERSEDED_BY_SIXTH_CORRECTION`. El estado vigente no implica cierre tecnico ni validacion. La correccion documental vigente queda pendiente de revision independiente.

#### T.5 Control de terminos potencialmente incompatibles

Las apariciones de `YES`, `READY`, `VALIDATED`, `PASSED`, `APPROVED`, `IMPLEMENTED` o equivalentes solo son admisibles cuando describen una negacion explicita (`NO`), una condicion futura no cumplida, una etiqueta historica o un control documental estatico sustentado. Ninguna aparicion de este documento autoriza implementacion, ejecucion tecnica, Stage 2, R2, produccion, backup real, restore temporal ni merge.

Funciones reales del `.ps1` siguen diferenciadas de funciones propuestas. Las funciones reales permanecen como inventario fisico; las funciones con prefijo `PROPOSED_NEW_FUNCTION_` son contratos futuros y no estan implementadas.

## 12. TASK_005_V17_SEVENTH_DOCUMENTARY_CORRECTION

SEVENTH_CORRECTION_STATUS = PROPOSED_PENDING_INDEPENDENT_REVIEW
INDEPENDENT_REVIEW_DECISION = CORRECTION_REQUIRED
SIXTH_CORRECTION_APPROVED = NO
MERGE_AUTHORIZED = NO

Esta es la unica seccion canonica vigente del documento. Las secciones anteriores son historicas, no normativas y quedan subordinadas a esta seccion.

### 12.1 Estrategia canonica unica de roles

ESTRATEGIA_CANONICA_ROLES = SESSION_ROLE_WITH_EFFECTIVE_PRIVILEGE_ASSERTIONS
ROLE_STRATEGY_STATUS = PROPOSED_PENDING_INDEPENDENT_REVIEW
IMPLEMENTED = NO
VALIDATED = NO
APPROVED = NO

Alternativas comparadas:

| Alternativa | Resultado documental | Motivo |
|---|---|---|
| `SESSION_ROLE` miembro de `LOCAL_VALIDATION_ROLE` | REJECTED_SUPERSEDED | Contradice NOLOGIN/sin membresias y puede introducir herencia no deseada. |
| `SET ROLE LOCAL_VALIDATION_ROLE` | REJECTED_SUPERSEDED | Requiere membresia o LOGIN, incompatible con la estrategia de rol objetivo NOLOGIN sin membresias. |
| Membresia temporal controlada | REJECTED_SUPERSEDED | La membresia que se pretende probar como ausente seria introducida por la prueba. |
| Funcion `SECURITY DEFINER` limitada | RESERVED_EXCEPTION_ONLY | Solo podria evaluarse en una tarea futura especifica por su superficie EXECUTE. |
| `SESSION_ROLE` separado que comprueba privilegios efectivos de `LOCAL_VALIDATION_ROLE` | PROPOSED_PENDING_INDEPENDENT_REVIEW | Mantiene separacion de identidades, no requiere asumir el rol objetivo y permite probar catalogos/ACL de forma controlada. |

Estrategia seleccionada:

| Pregunta | Definicion canonica |
|---|---|
| Identidad que inicia la sesion temporal | `SESSION_ROLE`, LOGIN temporal restringido, no superusuario, sin privilegios administrativos, autorizado solo contra base temporal allowlisted. |
| Quien crea/administra roles temporales | `ADMINISTRATION_ROLE` o actor operativo temporal equivalente, separado de `SESSION_ROLE` y `LOCAL_VALIDATION_ROLE`; solo en entorno temporal y con evidencia sanitizada. |
| Identidad bajo la que se ejecutan realmente las comprobaciones | `SESSION_ROLE` ejecuta consultas de catalogo y aserciones de privilegio efectivo sobre `LOCAL_VALIDATION_ROLE`. |
| Existe membresia entre roles | NO. `SESSION_ROLE` no es miembro directo ni transitivo de `LOCAL_VALIDATION_ROLE`; `LOCAL_VALIDATION_ROLE` no tiene membresias escalables. |
| Se usa `SET ROLE` | NO. Queda rechazado para la ruta minima porque exige membresia o cambio de LOGIN. |
| Privilegios minimos | `LOCAL_VALIDATION_ROLE`: CONNECT/USAGE/SELECT estrictamente allowlisted; sin CREATE, TEMP, escritura, EXECUTE, ownership, BYPASSRLS ni membresias. `SESSION_ROLE`: conexion temporal y lectura de catalogos necesaria para aserciones; sin acceso a produccion. |
| Controles anti-produccion | host/container/db allowlist, production blocklist, `TEMP_ENVIRONMENT_ID`, nombres temporales no productivos, `R2_BLOCK_MODE=FORCED_BLOCKED`, cero credenciales productivas. |
| Revocacion y limpieza | revocar grants temporales, terminar sesiones temporales, eliminar roles temporales si fueron creados para la prueba, drop de base temporal, limpieza de artefactos y evidencia de cleanup. |
| Evidencia futura necesaria | logs sanitizados, hashes de artefactos, matriz expected/actual, consultas de catalogo, pruebas positivas/negativas, verificacion de no membresia, no `SET ROLE`, rollback y cleanup. |

Afirmaciones incompatibles de secciones historicas quedan sustituidas por esta estrategia. En particular, cualquier frase que indique o sugiera que `SESSION_ROLE` es miembro de `LOCAL_VALIDATION_ROLE`, que se usa `SET ROLE`, o que las validaciones se ejecutan asumiendo `LOCAL_VALIDATION_ROLE`, queda marcada como `HISTORICAL_SUPERSEDED_NON_NORMATIVE`.

### 12.2 Semantica canonica de fixtures futuros

```text
CURRENT_DOCUMENTARY_EXECUTION = NO
FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED = YES_FOR_G_N_P_Q_R_S_T_U_V_ONLY
PRODUCTION_CONNECTION_ALLOWED = NO
PRODUCTION_CONNECTION_PERFORMED = NO
TECHNICAL_VALIDATION_COMPLETED = NO
STATIC_POLICY_VALIDATED = NO
CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED = NO
STATIC_FIXTURES_EXECUTED = NO
```

Fixtures G, N y P-V no son pruebas offline vigentes. Su ejecucion futura requiere una conexion a PostgreSQL temporal controlado, nunca a produccion. Ningun fixture no ejecutado se considera validado.

### 12.3 Orden canonico del flujo fisico del `.ps1`

| Orden | Lineas fisicas | Operacion canonica |
|---:|---|---|
| 1 | 1715-1716 | Preparacion o creacion del directorio del contenedor. |
| 2 | 1718-1723 | Ejecucion de `pg_dump` y obtencion del manifest. |
| 3 | 2208-2218 | Comprobacion, creacion y restauracion de la base temporal. |

No existe interpretacion vigente en la que el `.ps1` cree la base temporal antes de `pg_dump`. Toda descripcion anterior que mezcle o altere ese orden queda `HISTORICAL_SUPERSEDED_NON_NORMATIVE`.

### 12.4 Control canonico de versiones anteriores

```text
HISTORICAL_SECTIONS_NON_NORMATIVE = YES
CANONICAL_SECTION = 12
PREVIOUS_SECTIONS_AUTHORIZE_EXECUTION = NO
PREVIOUS_SECTIONS_AUTHORIZE_IMPLEMENTATION = NO
PREVIOUS_SECTIONS_AUTHORIZE_STAGE_2 = NO
PREVIOUS_SECTIONS_AUTHORIZE_R2 = NO
```

Las secciones historicas se conservan para trazabilidad de auditoria. No son diseno operativo vigente y no pueden usarse para justificar implementacion o ejecucion.

### 12.5 Estados finales de la septima correccion

```text
SEVENTH_CORRECTION_COMPLETED = PROPOSED_PENDING_INDEPENDENT_REVIEW
FOUR_AUDIT_FINDINGS_DOCUMENTARILY_ADDRESSED = YES
SINGLE_CANONICAL_ROLE_STRATEGY_DEFINED = YES
HISTORICAL_SECTIONS_NON_NORMATIVE = YES
IMPLEMENTATION_COMPLETED = NO
TECHNICAL_VALIDATION_COMPLETED = NO
STATIC_POLICY_VALIDATED = NO
CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED = NO
DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED = NO
INDEPENDENT_REVIEW_COMPLETED = NO
READY_FOR_IMPLEMENTATION = NO
READY_FOR_STAGE_2 = NO
READY_FOR_EXPLICIT_EXECUTION_AUTHORIZATION = NO

SCRIPT_MODIFIED = NO
SCRIPT_EXECUTED = NO
SQL_EXECUTED = NO
STATIC_FIXTURES_EXECUTED = NO
PRODUCTION_ACCESSED = NO
REAL_BACKUP_EXECUTED = NO
TEMP_RESTORE_EXECUTED = NO
R2_UPLOAD_EXECUTED = NO
MERGE_EXECUTED = NO
```

Estados inmutables:

```text
SIXTH_CORRECTION_COMPLETED = PROPOSED_PENDING_INDEPENDENT_REVIEW
FIVE_AUDIT_FINDINGS_DOCUMENTARILY_ADDRESSED = YES
IMPLEMENTATION_COMPLETED = NO
DESIGN_COMPLETE = PROPOSED_PENDING_INDEPENDENT_REVIEW
READY_FOR_IMPLEMENTATION = NO
STATIC_POLICY_VALIDATED = NO
CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED = NO
DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED = NO
DATABASE_ACL_DECISION = PROPOSED_PENDING_INDEPENDENT_REVIEW
READY_FOR_STAGE_2 = NO
READY_FOR_EXPLICIT_EXECUTION_AUTHORIZATION = NO
INDEPENDENT_REVIEW_COMPLETED = NO
READY_FOR_IMPLEMENTATION = NO

SCRIPT_MODIFIED = NO
SCRIPT_EXECUTED = NO
STATIC_FIXTURES_EXECUTED = NO
SQL_EXECUTED = NO
PRODUCTION_ACCESSED = NO
REAL_BACKUP_EXECUTED = NO
TEMP_RESTORE_EXECUTED = NO
R2_UPLOAD_EXECUTED = NO
MERGE_EXECUTED = NO
```
