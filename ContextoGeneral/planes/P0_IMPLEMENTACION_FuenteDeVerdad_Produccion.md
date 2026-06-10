# P0 IMPLEMENTACIÓN — Robustecer Fuente de Verdad para Producción

## 1. Objetivo del plan

Este plan define la implementación técnica necesaria para que BarberAgency quede con una fuente de verdad robusta, segura y lista para producción.

La meta no es documentar teoría ni hacer parches visuales.

La meta es eliminar los puntos débiles detectados en la arquitectura actual y garantizar que:

```txt
PostgreSQL sea la única fuente de verdad.
session/me sea la autoridad de identidad.
dashboard/state sea la lectura canónica del dashboard.
ba_get_landing_publica sea la lectura pública canónica.
Los endpoints de escritura sean únicos, autorizados y probados.
No exista localStorage, seed, cache, mock, slug o email_contacto actuando como verdad.
```

Todo arreglo debe quedar en GitHub, probado con Postman, validado con SQL y documentado en `ContextoGeneral/daily`.

---

## 2. Principio rector

```txt
Este trabajo es de producción.

No se aceptan:
- parches visuales
- arreglos temporales
- cambios sin Postman
- cambios sin SQL
- cambios sin GitHub
- cambios sin evidencia
- cambios que funcionen solo para una barbería
- cambios que rompan multi-tenant
- cambios que oculten errores
- cambios que creen otra fuente de verdad
```

La fuente de verdad debe quedar robusta, auditada y defendida por backend, PostgreSQL, pruebas y CI.

---

## 3. Hallazgos que este plan debe corregir

### H1 — Exceso de canales de entrada

Actualmente existen varios caminos potenciales de entrada:

```txt
n8n webhooks
PostgREST RPC
Next.js API proxy
WordPress templates
Dashboard Next.js
scripts de pruebas
rutas legacy
```

Riesgo:

```txt
Un mismo dato puede escribirse por dos caminos distintos.
Un flujo nuevo puede quedar bien, pero una ruta vieja puede seguir escribiendo mal.
```

Solución objetivo:

```txt
Cada dominio debe tener un único endpoint canónico de escritura.
Los endpoints legacy deben eliminarse, bloquearse o documentarse como deprecated.
```

---

### H2 — Riesgo de localStorage como autoridad

Se detectó históricamente uso de:

```txt
localStorage
sessionStorage
ba_dashboard_reservas
ba_landing_seed
seedLandingData
cache local
```

Riesgo:

```txt
Datos viejos.
Cruce entre barberías.
Citas fantasma.
Servicios o barberos que aparecen sin estar en PostgreSQL.
Dashboard mostrando datos no reales.
```

Solución objetivo:

```txt
localStorage solo puede ser cache temporal no autoritativa.
Si dashboard/state falla, se debe mostrar error real.
Nunca se deben renderizar datos inventados en producción.
```

---

### H3 — Identidad mezclada entre barberia_id, slug, email_contacto y cache

Se detectó riesgo de usar varios identificadores como autoridad:

```txt
barberia_id
slug
email_contacto
localStorage
query params
seed
```

Riesgo:

```txt
Un usuario puede hidratar una barbería equivocada.
Un slug viejo puede pisar el barberia_id correcto.
email_contacto puede confundirse con permiso.
```

Solución objetivo:

```txt
session/me manda.
barberia_id identifica internamente.
slug solo verifica.
email_contacto no autoriza.
barberia_miembros y owner_id definen permisos.
```

---

### H4 — Horarios incompletos

Se detectó riesgo de enviar solo horarios activos.

Riesgo:

```txt
Si un día se desactiva en frontend y no se envía al backend, PostgreSQL nunca se entera.
El día queda activo por error.
Los slots se siguen mostrando.
```

Solución objetivo:

```txt
Siempre enviar los 7 días completos:
domingo, lunes, martes, miércoles, jueves, viernes, sábado.
Cada día debe traer activo=true o activo=false.
```

---

### H5 — Publicación usando snapshot público viejo

Se detectó riesgo de que el editor use `ba_get_landing_publica` como base antes de publicar.

Riesgo:

```txt
El editor puede tomar el último estado publicado, no los cambios vivos actuales.
Al publicar, puede pisar servicios, barberos, horarios o branding nuevos.
```

Solución objetivo:

```txt
El editor debe publicar el payload actual del flujo de edición.
ba_get_landing_publica solo sirve para lectura pública, no para reconstruir el payload vivo de publicación.
```

---

### H6 — Landing pública con endpoints legacy

Se detectó riesgo de que la landing pública cargue un contexto correcto y luego un endpoint legacy lo sobrescriba.

Riesgo:

```txt
La landing muestra datos viejos aunque PostgreSQL esté bien.
QR, URL, servicios o barberos pueden quedar desfasados.
```

Solución objetivo:

```txt
En /b/{slug}, la landing debe usar una única lectura pública canónica.
No debe existir una segunda lectura legacy que pise el contexto actual.
```

---

### H7 — Reservas y concurrencia

El QA detectó riesgo de concurrencia de slots.

Riesgo:

```txt
Dos clientes intentan reservar el mismo barbero, fecha y hora al mismo tiempo.
```

Solución objetivo:

```txt
PostgreSQL debe proteger no solape.
La RPC o función de reserva debe ser atómica.
n8n no debe ser la única defensa.
```

---

### H8 — Scripts, secretos y archivos sin control

Se detectaron archivos de pruebas, scripts y posibles riesgos operativos.

Riesgo:

```txt
Tokens expuestos.
Scripts tocando datos reales.
Archivos sin trackear.
Pruebas que cambian usuarios reales.
```

Solución objetivo:

```txt
Separar pruebas QA.
Usar variables de entorno.
Rotar secretos si aparecen.
No tocar usuarios reales.
Crear CI.
Documentar Postman.
```

---

## 4. Estado final esperado

Al terminar este plan, el sistema debe cumplir:

```txt
1. Un solo canal canónico de escritura por dominio.
2. dashboard/state como única lectura privada del dashboard.
3. session/me como única autoridad de identidad.
4. ba_get_landing_publica como lectura pública canónica.
5. localStorage sin autoridad.
6. email_contacto sin autoridad.
7. slug sin autoridad privada.
8. horarios siempre completos.
9. publicación sin snapshot viejo.
10. reservas atómicas y protegidas por PostgreSQL.
11. Postman PASS.
12. SQL PASS.
13. CI activo.
14. Documentación diaria.
15. Cambios en GitHub.
```

---

# 5. Plan de implementación por bloques

---

## BLOQUE 1 — Matriz de endpoints canónicos

### Objetivo

Definir oficialmente cuál endpoint escribe y cuál endpoint lee cada dominio.

### Entregable

Crear o actualizar:

```txt
ContextoGeneral/FuenteDeVerdad_ENDPOINTS_CANONICOS.md
```

### Contenido mínimo

| Dominio         | Lectura canónica                       | Escritura canónica                      | Tablas                                                          |
| --------------- | -------------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| Identidad       | `/api/session/me`                      | login/auth controlado                   | `usuarios`, `barberia_miembros`, `barberias`                    |
| Dashboard       | `/api/dashboard/state`                 | No escribe                              | Tablas del tenant                                               |
| Configuración   | `/api/dashboard/state`                 | `/api/configuracion/update`             | `barberias`, `servicios`, `barberos`, `horarios`                |
| Publicación     | `ba_get_landing_publica`               | `/api/editor/publish`                   | `barberia_public_profiles`, `barberia_theme`, `barberia_assets` |
| Slots           | `/webhook/barberagency/reservas/slots` | No escribe                              | `horarios`, `citas`, `barberos`, `servicios`                    |
| Reservas        | `dashboard/state` después de crear     | `/webhook/barberagency/reservas/create` | `clientes_finales`, `citas`                                     |
| Citas dashboard | `/api/dashboard/state`                 | endpoint autorizado de citas            | `clientes_finales`, `citas`                                     |
| Pagos           | endpoint autorizado / dashboard state  | endpoint autorizado de pagos            | `pagos`                                                         |
| Productos       | endpoint autorizado                    | endpoint autorizado de productos        | `productos`                                                     |
| Gastos          | endpoint autorizado                    | endpoint autorizado de gastos           | `gastos`                                                        |

### Reglas de implementación

```txt
Si existe un endpoint alterno para el mismo dominio, debe clasificarse:
- CANONICO
- LEGACY
- DEPRECATED
- DUPLICADO
- RIESGOSO
- ELIMINAR
```

### Pruebas Postman

```txt
No aplica todavía como validación funcional.
Este bloque es inventario técnico.
```

### Criterio de cierre

```txt
Existe matriz oficial.
Todo endpoint tiene dueño.
Todo endpoint legacy queda identificado.
Todo endpoint duplicado queda identificado.
Todo endpoint riesgoso queda documentado.
Commit en GitHub.
```

---

## BLOQUE 2 — Blindaje de identidad y permisos

### Objetivo

Eliminar cualquier permiso basado en `email_contacto`, `slug`, query params o localStorage.

### Cambios esperados

```txt
1. session/me debe resolver usuario desde ba_session.
2. session/me debe devolver solo barberías autorizadas.
3. dashboard/state debe validar ba_session.
4. dashboard/state debe validar owner_id o barberia_miembros.
5. dashboard/state debe bloquear barbería ajena.
6. dashboard/state debe bloquear mismatch barberia_id + slug.
7. email_contacto solo queda como dato comercial.
```

### Archivos/módulos a revisar

```txt
/api/session/me
/api/dashboard/state
dashboard context
dashboard access
n8n dashboard state workflow
barberia_miembros SQL/migraciones
```

### SQL de diagnóstico

```sql
SELECT
  b.id,
  b.nombre,
  b.owner_id,
  u.email AS owner_email,
  b.email_contacto,
  COUNT(bm.*) AS miembros_activos
FROM public.barberias b
LEFT JOIN public.usuarios u
  ON u.id = b.owner_id
LEFT JOIN public.barberia_miembros bm
  ON bm.barberia_id = b.id
 AND bm.activo = true
WHERE b.deleted_at IS NULL
GROUP BY b.id, b.nombre, b.owner_id, u.email, b.email_contacto
ORDER BY b.id;
```

### Pruebas Postman obligatorias

```txt
GET /api/session/me sin cookie = 401
GET /api/session/me cookie válida = 200
GET /api/dashboard/state?barberia_id=PROPIA = 200
GET /api/dashboard/state?barberia_id=AJENA = 403
GET /api/dashboard/state?barberia_id=PROPIA&slug=SLUG_INCORRECTO = 403
Cambiar email_contacto y repetir dashboard/state = acceso no cambia
```

### Criterio de cierre

```txt
No existe autorización final por email_contacto.
No existe autorización privada por slug.
No existe autorización por localStorage.
Postman PASS.
SQL PASS.
Commit en GitHub.
```

---

## BLOQUE 3 — Dashboard state como única lectura privada

### Objetivo

Eliminar cualquier hidratación privada desde localStorage, mocks, seed o fallback.

### Cambios esperados

```txt
1. Dashboard lee datos desde dashboard/state.
2. Citas dashboard vienen de PostgreSQL.
3. Servicios dashboard vienen de PostgreSQL.
4. Barberos dashboard vienen de PostgreSQL.
5. Horarios dashboard vienen de PostgreSQL.
6. Si dashboard/state falla, se muestra error real.
7. No se muestran datos inventados.
```

### Buscar y eliminar como autoridad

```txt
localStorage
sessionStorage
ba_dashboard_reservas
ba_locally_paid_appointments
seedLandingData
ba_landing_seed
mock
fallback
Alex M
James V
setError(null) después de error real
```

### Implementación esperada

```txt
localStorage puede quedar solo como cache temporal, con:
- barberia_id asociado
- expiración
- invalidación por mismatch
- nunca como fuente primaria
```

Recomendación de producción:

```txt
Para P0, eliminar autoridad local.
Si se deja cache, debe ser estrictamente secundaria y nunca ocultar error.
```

### Pruebas Postman obligatorias

```txt
GET /api/dashboard/state propio = 200
GET /api/dashboard/state sin cookie = 401
GET /api/dashboard/state ajeno = 403
GET /api/dashboard/state mismatch = 403
```

### Pruebas funcionales

```txt
Barbería sin barberos reales muestra vacío real.
Barbería sin citas reales muestra vacío real.
API caída no muestra mocks.
API caída no muestra citas viejas.
```

### SQL de verificación

```sql
SELECT id, nombre, activo
FROM public.barberos
WHERE barberia_id = :barberia_id
ORDER BY id;

SELECT id, nombre, activo
FROM public.servicios
WHERE barberia_id = :barberia_id
ORDER BY id;

SELECT id, fecha, hora_inicio, estado
FROM public.citas
WHERE barberia_id = :barberia_id
ORDER BY fecha DESC, hora_inicio DESC;
```

### Criterio de cierre

```txt
Dashboard no inventa datos.
Dashboard no oculta errores.
Dashboard no toma localStorage como verdad.
Postman PASS.
SQL PASS.
Commit en GitHub.
```

---

## BLOQUE 4 — Configuración y registro con escritura única

### Objetivo

Consolidar la escritura de configuración en un único canal seguro.

### Endpoint canónico

```txt
POST /api/configuracion/update
```

### Cambios esperados

```txt
1. Registro modo edición carga desde dashboard/state.
2. Guardar configuración escribe por /api/configuracion/update.
3. El endpoint valida ba_session.
4. El endpoint valida barberia_id autorizado.
5. El endpoint valida slug si viene.
6. El endpoint no cambia owner_id.
7. El endpoint no daña password_hash.
8. El endpoint guarda servicios, barberos y horarios en PostgreSQL.
```

### Regla crítica de horarios

```txt
El payload debe enviar siempre 7 días completos.
No se acepta filter activo antes de enviar.
```

Formato esperado:

```json
[
  { "dia_semana": 0, "activo": false, "hora_abre": "09:00", "hora_cierra": "18:00" },
  { "dia_semana": 1, "activo": true, "hora_abre": "09:00", "hora_cierra": "18:00" },
  { "dia_semana": 2, "activo": true, "hora_abre": "09:00", "hora_cierra": "18:00" },
  { "dia_semana": 3, "activo": true, "hora_abre": "09:00", "hora_cierra": "18:00" },
  { "dia_semana": 4, "activo": true, "hora_abre": "09:00", "hora_cierra": "18:00" },
  { "dia_semana": 5, "activo": true, "hora_abre": "09:00", "hora_cierra": "18:00" },
  { "dia_semana": 6, "activo": false, "hora_abre": "09:00", "hora_cierra": "18:00" }
]
```

### Pruebas Postman obligatorias

```txt
POST /api/configuracion/update propio = 200
POST /api/configuracion/update sin cookie = 401
POST /api/configuracion/update ajeno = 403
POST /api/configuracion/update mismatch barberia_id + slug = 403
```

### SQL obligatorio

```sql
SELECT owner_id, email_contacto, nombre, telefono, direccion
FROM public.barberias
WHERE id = :barberia_id;

SELECT dia_semana, activo, hora_abre, hora_cierra
FROM public.horarios
WHERE barberia_id = :barberia_id
ORDER BY dia_semana;

SELECT id, nombre, activo
FROM public.servicios
WHERE barberia_id = :barberia_id
ORDER BY id;

SELECT id, nombre, activo
FROM public.barberos
WHERE barberia_id = :barberia_id
ORDER BY id;
```

### Criterio de cierre

```txt
Configuración tiene un único canal de escritura.
Horarios se guardan completos.
owner_id no cambia.
password_hash no se daña.
Postman PASS.
SQL PASS.
Commit en GitHub.
```

---

## BLOQUE 5 — Publicación pública robusta

### Objetivo

Separar correctamente estado vivo interno y estado público publicado.

### Endpoint de escritura canónico

```txt
POST /api/editor/publish
```

### Lectura pública canónica

```txt
ba_get_landing_publica(slug)
```

### Cambios esperados

```txt
1. Editor publica con ba_session.
2. Editor publica por /api/editor/publish.
3. Editor no publica directo por RPC anónima.
4. Editor no reconstruye payload desde ba_get_landing_publica.
5. Landing /b/slug lee una sola fuente pública.
6. Endpoint legacy no pisa contexto actual.
7. QR y URL salen de fuente pública.
```

### Regla crítica

```txt
ba_get_landing_publica es lectura pública.
No se usa para armar una nueva publicación.
```

### Pruebas Postman obligatorias

```txt
POST /api/editor/publish propio = 200
POST /api/editor/publish sin cookie = 401
POST /api/editor/publish ajeno = 403
POST /api/editor/publish mismatch = 403
POST ba_get_landing_publica después de publicar = 200
POST ba_resolver_qr = 200
```

### Pruebas funcionales obligatorias

```txt
Cambiar color y publicar.
Landing muestra color nuevo.
Agregar servicio y publicar.
Landing muestra servicio nuevo.
Quitar servicio y publicar.
Landing deja de mostrar servicio.
Cambiar plantilla y publicar.
Landing usa plantilla nueva.
QR abre landing correcta.
```

### SQL obligatorio

```sql
SELECT *
FROM public.barberia_public_profiles
WHERE barberia_id = :barberia_id;

SELECT *
FROM public.barberia_theme
WHERE barberia_id = :barberia_id;

SELECT *
FROM public.barberia_assets
WHERE barberia_id = :barberia_id
ORDER BY orden, id;
```

### Criterio de cierre

```txt
Landing pública muestra lo publicado en PostgreSQL.
No hay endpoint legacy pisando datos.
No hay RPC anónima de escritura.
Postman PASS.
SQL PASS.
Commit en GitHub.
```

---

## BLOQUE 6 — Reservas públicas y citas dashboard

### Objetivo

Garantizar que toda cita real exista en PostgreSQL y respete reglas de negocio.

### Endpoints canónicos

```txt
GET /webhook/barberagency/reservas/slots
POST /webhook/barberagency/reservas/create
```

### Cambios esperados

```txt
1. Slots validan servicio pertenece al tenant.
2. Slots validan barbero pertenece al tenant.
3. Slots respetan horarios.
4. Slots respetan descansos.
5. Reserva valida no solape.
6. Reserva crea o reutiliza cliente_final.
7. Reserva crea cita.
8. Dashboard lee cita desde dashboard/state.
9. Cancelación cambia estado, no borra físico en producción.
```

### Riesgo de concurrencia

Debe validarse en DB:

```txt
No debe existir doble cita para:
barberia_id + barbero_id + rango fecha/hora
en estado confirmada o pendiente.
```

### Pruebas Postman obligatorias

```txt
GET slots servicio propio = 200
GET slots servicio ajeno = 400
GET slots barbero ajeno = 400
POST reservas/create válido = 200
POST reservas/create solapado = 400
GET dashboard/state después de reserva = cita visible
Cancelar cita = 200
GET slots después de cancelar = slot libre
```

### SQL obligatorio

```sql
SELECT id, nombre, telefono
FROM public.clientes_finales
WHERE barberia_id = :barberia_id
ORDER BY id DESC
LIMIT 10;

SELECT id, barberia_id, barbero_id, servicio_id, cliente_id, fecha, hora_inicio, hora_fin, estado
FROM public.citas
WHERE barberia_id = :barberia_id
ORDER BY id DESC
LIMIT 10;
```

### Criterio de cierre

```txt
No hay citas fantasma.
No hay reserva doble.
No hay servicio ajeno.
No hay barbero ajeno.
Postman PASS.
SQL PASS.
Commit en GitHub.
```

---

## BLOQUE 7 — Servicios, barberos y horarios dashboard

### Objetivo

Garantizar que las acciones CRUD desde dashboard sean persistentes y multi-tenant.

### Cambios esperados

```txt
1. Crear servicio escribe PostgreSQL.
2. Editar servicio escribe PostgreSQL.
3. Desactivar servicio escribe PostgreSQL.
4. Crear barbero escribe PostgreSQL.
5. Editar barbero escribe PostgreSQL.
6. Desactivar barbero escribe PostgreSQL.
7. Horarios dashboard escriben 7 días completos.
8. Ninguna acción se queda solo en estado React.
```

### Pruebas Postman obligatorias

```txt
Crear servicio propio = 200
Editar servicio propio = 200
Servicio ajeno = 403 o 400
Crear barbero propio = 200
Editar barbero propio = 200
Barbero ajeno = 403 o 400
Actualizar horarios propios = 200
Actualizar horarios ajenos = 403
```

### SQL obligatorio

```sql
SELECT id, nombre, precio, duracion_min, activo
FROM public.servicios
WHERE barberia_id = :barberia_id
ORDER BY id DESC;

SELECT id, nombre, activo
FROM public.barberos
WHERE barberia_id = :barberia_id
ORDER BY id DESC;

SELECT dia_semana, activo, hora_abre, hora_cierra
FROM public.horarios
WHERE barberia_id = :barberia_id
ORDER BY dia_semana;
```

### Criterio de cierre

```txt
Servicios no viven en estado local.
Barberos no viven en estado local.
Horarios no viven en estado local.
Postman PASS.
SQL PASS.
Commit en GitHub.
```

---

## BLOQUE 8 — Finanzas, POS, productos y gastos

### Objetivo

Preparar los módulos financieros para producción real.

### Cambios esperados

```txt
1. Pagos se guardan en PostgreSQL.
2. Productos se guardan en PostgreSQL.
3. Gastos se guardan en PostgreSQL.
4. Caja no se calcula desde localStorage.
5. Inventario no usa eval.
6. Todo dato financiero tiene barberia_id o relación segura con cita/barbería.
```

### Riesgos a eliminar

```txt
Pago sin tenant.
Producto sin tenant.
Gasto sin tenant.
Caja calculada desde frontend.
eval en inventario.
```

### Pruebas Postman obligatorias

```txt
Crear pago propio = 200
Pago cita ajena = 403
Crear producto propio = 200
Producto ajeno = 403
Crear gasto propio = 200
Gasto ajeno = 403
```

### SQL obligatorio

```sql
SELECT *
FROM public.pagos
ORDER BY id DESC
LIMIT 10;

SELECT *
FROM public.productos
WHERE barberia_id = :barberia_id
ORDER BY id DESC
LIMIT 10;

SELECT *
FROM public.gastos
WHERE barberia_id = :barberia_id
ORDER BY id DESC
LIMIT 10;
```

### Criterio de cierre

```txt
Finanzas salen de PostgreSQL.
No hay caja local.
No hay eval.
Postman PASS.
SQL PASS.
Commit en GitHub.
```

---

## BLOQUE 9 — Limpieza de legacy y secretos

### Objetivo

Eliminar riesgos operativos que pueden romper producción.

### Tareas

```txt
1. Listar archivos sin trackear.
2. Clasificar scripts de pruebas.
3. Buscar tokens, API keys, cookies o passwords.
4. Mover secretos a variables de entorno.
5. Rotar secretos si ya fueron commiteados.
6. Eliminar endpoints legacy no usados.
7. Documentar endpoints legacy que no puedan eliminarse todavía.
```

### Búsquedas obligatorias

```txt
token
api_key
apikey
password
secret
ba_session
Authorization
Bearer
X-N8N-API-KEY
localStorage
sessionStorage
legacy
fallback
mock
```

### Criterio de cierre

```txt
No hay secretos vivos en repo.
No hay scripts peligrosos sin documentar.
No hay rutas legacy activas sin justificación.
Commit en GitHub.
```

---

## BLOQUE 10 — CI y validación automática

### Objetivo

Evitar que cambios futuros rompan producción sin detección.

### Implementación mínima

Crear workflow:

```txt
.github/workflows/ci.yml
```

Contenido base:

```yaml
name: BarberAgency CI

on:
  push:
    branches: [main, principal]
  pull_request:
    branches: [main, principal]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install
        run: npm install

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build
```

### Etapa posterior recomendada

Agregar smoke tests controlados:

```txt
session/me sin cookie
dashboard/state sin cookie
dashboard/state barbería ajena
endpoint público landing
endpoint slots
```

### Criterio de cierre

```txt
GitHub Actions corre.
Lint pasa o warnings quedan documentados.
Build pasa.
Commit en GitHub.
```

---

# 6. Orden obligatorio de implementación

El orden no debe cambiarse sin aprobación.

```txt
1. BLOQUE 1 — Matriz de endpoints canónicos
2. BLOQUE 2 — Identidad y permisos
3. BLOQUE 3 — Dashboard state
4. BLOQUE 4 — Configuración y registro
5. BLOQUE 5 — Publicación pública
6. BLOQUE 6 — Reservas y citas
7. BLOQUE 7 — Servicios, barberos y horarios dashboard
8. BLOQUE 8 — Finanzas, POS, productos y gastos
9. BLOQUE 9 — Limpieza de legacy y secretos
10. BLOQUE 10 — CI y validación automática
```

---

# 7. Regla de aprobación entre bloques

No se puede pasar de un bloque al siguiente hasta que el bloque actual tenga:

```txt
1. Auditoría terminada.
2. Cambios implementados si aplican.
3. Commit en GitHub.
4. Evidencia Postman.
5. Evidencia SQL.
6. Reporte en ContextoGeneral/daily.
7. Revisión del arquitecto.
8. Aprobación explícita para pasar al siguiente bloque.
```

Si el arquitecto no aprueba, el bloque queda abierto.

---

# 8. Definition of Done del plan completo

El plan completo solo se considera terminado cuando:

```txt
1. Existe matriz de endpoints canónicos.
2. No hay autorización por email_contacto.
3. No hay autorización privada por slug.
4. session/me controla identidad.
5. dashboard/state controla lectura privada.
6. configuración escribe por un canal único.
7. publicación escribe por un canal único.
8. landing pública lee una fuente única.
9. reservas crean citas reales en PostgreSQL.
10. no hay localStorage autoritativo.
11. no hay mocks en producción.
12. no hay fallbacks silenciosos.
13. horarios se envían completos.
14. no hay rutas legacy críticas activas.
15. no hay secretos vivos en repo.
16. CI corre en GitHub.
17. Postman PASS por cada bloque.
18. SQL PASS por cada bloque.
19. cada bloque tiene evidencia en ContextoGeneral/daily.
20. cada bloque tiene commit en GitHub.
```

---

# 9. Formato de entrega por bloque

Cada bloque debe dejar un documento:

```txt
ContextoGeneral/daily/YYYY-MM-DD_P0_BloqueX_FuenteDeVerdad.md
```

Formato:

````md
# P0 Fuente de Verdad — Bloque X

## Objetivo

## Hallazgos

## Archivos revisados

## Archivos modificados

## Endpoints Postman probados

| Endpoint | Método | Caso | Esperado | Obtenido | Resultado |
| --- | --- | --- | --- | --- | --- |

## SQL ejecutado

```sql
-- SQL usado
````

## Resultado DB

## Riesgos eliminados

## Riesgos pendientes

## Commit GitHub

## Decisión

GO / GO CON RESERVAS / NO GO

````

---

# 10. Regla final

```txt
Este plan es de producción.

No se aceptan:
- parches visuales
- cambios sin Postman
- cambios sin SQL
- cambios sin GitHub
- cambios sin evidencia
- cambios que funcionen solo para una barbería
- cambios que rompan multi-tenant
- cambios que oculten errores
- cambios que creen otra fuente de verdad

La fuente de verdad debe quedar robusta, auditada y defendida por backend, PostgreSQL, pruebas y CI.
````
