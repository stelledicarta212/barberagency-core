# P0 Fuente de Verdad — Bloque 2 Identidad y Permisos

## Resumen ejecutivo

Como auditor arquitectónico senior de producción para BarberAgency, he ejecutado la auditoría de identidad, sesión, permisos y control multi-tenant (**Bloque 2**). 

Esta auditoría es puramente técnica e identifica fallas y vulnerabilidades en la resolución de sesión e identidad entre el frontend Next.js, las API Routes proxies y el motor de base de datos PostgreSQL/PostgREST.

---

## 1. Riesgos e Inventario Detallado (P0/P1/P2)

### R1. Bypass de autenticación y autorización en proxy de pagos (P0 - Crítico)
- **Archivo exacto**: `_work_panel_de_barberia/src/app/api/pos/route.ts`
- **Endpoint exacto**: `POST /api/pos`
- **Validación actual**: Lee el JSON del body y lo reenvía directamente al webhook de n8n (`/pos/create-sale`). No realiza ninguna comprobación de cookies ni de firma JWT de la sesión.
- **Validación esperada**: Debe extraer la cookie `ba_session`, validar el token, recuperar el `user_id` y comprobar que dicho usuario sea dueño o miembro autorizado del `barberia_id` enviado en el payload.
- **Recomendación para Codex**: Modificar `/api/pos/route.ts` para implementar la verificación de la cookie `ba_session` utilizando el mismo helper de validación que `/api/configuracion/update`.
- **Riesgo**: Un atacante podría forjar registros de ventas y cobros para cualquier barbería de forma anónima.

### R2. Autorización por coincidencia de email_contacto (P0 - Crítico)
- **Archivo exacto**: Webhooks de n8n (`login` y `dashboard/state`) y consultas de base de datos históricas.
- **Endpoint exacto**: `/webhook/barberagency/dashboard/state`
- **Validación actual**: Históricamente permitía accesos administrativos si el email del usuario autenticado coincidía con el `email_contacto` comercial de la barbería.
- **Validación esperada**: Exclusión absoluta de `email_contacto` en la lógica de autorización. El acceso administrativo debe validarse únicamente contra `owner_id` en `barberias` o membresías activas en `barberia_miembros`.
- **Recomendación para Codex**: Revisar todos los flujos SQL de backend y asegurar que la correspondencia de privilegios ignore el valor comercial `email_contacto`.
- **Riesgo**: Escalada de privilegios y fuga de datos multi-tenant si un usuario coincide su email con el contacto comercial de otra barbería.

### R3. Fallback de Datos Mock y direct fetch a PostgREST en caso de error (P0 - Crítico)
- **Archivo exacto**: `_work_panel_de_barberia/src/lib/dashboard-api.ts` (función `getDashboardState`)
- **Endpoint exacto**: `GET /api/dashboard/state` (lado del cliente)
- **Validación actual**: Si el fetch del proxy de estado del dashboard falla, el cliente Next.js ejecuta un catch que consulta directamente a PostgREST (`/servicios`, `/barberos`, `/citas`, `/clientes_finales`) y genera barberos ficticios ("Alex M.", "James V.") si la base de datos está vacía.
- **Validación esperada**: Si la API falla, debe propagarse el error de forma limpia en la UI con un código 502/503 o 403. No debe haber conexiones directas que eludan el proxy de autenticación ni inyección de mocks.
- **Recomendación para Codex**: Eliminar el bloque de catch en `getDashboardState` que hace consultas directas a tablas PostgREST y remueve la generación de mocks.
- **Riesgo**: Exposición innecesaria de endpoints PostgREST desde el cliente y enmascaramiento de errores reales de permisos.

### R4. Uso de localStorage como Autoridad de Identidad (P1 - Alto)
- **Archivo exacto**: `_work_panel_de_barberia/src/lib/barbershop-context.ts` (función `resolveBarbershopIdentity`)
- **Endpoint exacto**: N/A (Módulo de frontend React)
- **Validación actual**: Permite resolver la barbería activa desde la caché local (`localStorage`/`sessionStorage` de `ba_barberia_identity:*` o `ba_landing_seed`) como autoridad de fallback.
- **Validación esperada**: La única autoridad de identidad permitida debe ser `session/me` en el backend. El storage local solo puede actuar como caché de lectura no autoritativo.
- **Recomendación para Codex**: Restringir el storage local a caché de UX con expiración corta, y forzar que el DashboardProvider invalide cualquier contexto si no coincide con los privilegios reales obtenidos por `session/me`.
- **Riesgo**: Cruce de datos si un usuario tiene abiertos múltiples tenants en distintas pestañas del mismo navegador.

### R5. Mismatch no controlado de slug + barberia_id (P1 - Alto)
- **Archivo exacto**: `_work_panel_de_barberia/src/store/dashboard-context.tsx` (Mount Effect de inicialización)
- **Endpoint exacto**: N/A (Lógica de proveedor React)
- **Validación actual**: Valida de manera estricta contra las barberías del usuario: `Number(b.id) === fromUrl.barberia_id && b.slug === fromUrl.slug`.
- **Validación esperada**: Mantener el operador lógico `AND` estricto. Si hay inconsistencia entre el ID numérico y el slug en la URL, arrojar un error 403 inmediato en lugar de intentar adivinar la identidad real.
- **Recomendación para Codex**: Garantizar que el dashboard no intente resolver fallbacks parciales si ID y slug están presentes y no coinciden.
- **Riesgo**: Hidratación incorrecta del panel con la barbería equivocada.

### R6. Endpoint Duplicado /api/auth/login (P2 - Medio)
- **Archivo exacto**: `_work_panel_de_barberia/src/app/api/auth/login/route.ts`
- **Endpoint exacto**: `POST /api/auth/login`
- **Validación actual**: Duplica la redirección hacia el webhook de n8n, realizando extracción manual y redundante de cookies.
- **Validación esperada**: Debe ser eliminado, consolidando toda la lógica de sesión en `/api/session/login`.
- **Recomendación para Codex**: Eliminar el archivo de la ruta `/api/auth/login` y actualizar `dashboard-api.ts` para llamar exclusivamente a `/api/session/login`.
- **Riesgo**: Divergencia en la lógica de seguridad y cookies si se actualiza una ruta y la otra no.

---

## 2. Pruebas Postman Obligatorias

Para la validación del Bloque 2, Codex debe ejecutar y documentar las siguientes pruebas en Postman:

| Request | Método | Headers / Cookies | Payload / Params | Status esperado | Caso a probar |
| --- | --- | --- | --- | ---: | --- |
| `GET /api/session/me` | GET | Sin Cookie | N/A | 401 | Sesión anónima rechazada |
| `GET /api/session/me` | GET | `Cookie: ba_session=<token>` | N/A | 200 | Retorno de membresías autorizadas |
| `POST /api/session/login` | POST | N/A | `{ "email": "test@test.com", "password": "123" }` | 200/401 | Autenticación correcta o rechazada |
| `GET /api/dashboard/state` | GET | `Cookie: ba_session=<token>` | `?barberia_id=198` | 200 | Acceso concedido a tenant propio |
| `GET /api/dashboard/state` | GET | `Cookie: ba_session=<token>` | `?barberia_id=3` | 403 | Bloqueo de acceso a tenant ajeno |
| `GET /api/dashboard/state` | GET | `Cookie: ba_session=<token>` | `?barberia_id=198&slug=slug-ajeno` | 403 | Bloqueo de acceso ante mismatch de slug e id |
| `POST /api/pos` | POST | Sin Cookie | `{ "barberia_id": 198, "monto_total": 50.0 }` | 401 | Bloqueo de POS sin sesión |

---

## 3. Consultas SQL de Validación Obligatorias

Antes de certificar la seguridad, se deben correr estas consultas en PostgreSQL:

### Validación de membresías del usuario
```sql
SELECT 
  bm.barberia_id,
  b.nombre AS barberia_nombre,
  bm.usuario_id,
  u.email AS usuario_email,
  bm.rol,
  bm.activo
FROM public.barberia_miembros bm
JOIN public.barberias b ON b.id = bm.barberia_id
JOIN public.usuarios u ON u.id = bm.usuario_id
WHERE bm.usuario_id = :user_id;
```

### Verificación de que email_contacto no tiene privilegios de owner
```sql
SELECT id, nombre, owner_id, email_contacto 
FROM public.barberias 
WHERE id = :barberia_id;
-- Verificar que el usuario administrador tenga ID coincidente con owner_id, 
-- y que no se realicen comprobaciones de acceso basadas únicamente en el string email_contacto.
```

---

## 4. Decisión Final

**GO CON RESERVAS**

*Motivación*: Las API Routes de sesión e identidad (`/api/session/me` y `/api/session/login`) se encuentran listas y alineadas con las políticas RLS. No obstante, es **indispensable** implementar las correcciones en el proxy de pagos `/api/pos` y eliminar por completo la ruta obsoleta `/api/auth/login` y los fallbacks de mocks de frontend para asegurar que el sistema sea 100% robusto antes de pasar a producción.
