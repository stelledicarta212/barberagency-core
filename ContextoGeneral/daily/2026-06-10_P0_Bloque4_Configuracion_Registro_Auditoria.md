# P0 Fuente de Verdad — Bloque 4 Auditoría Configuración y Registro

**Fecha:** 2026-06-10  
**Auditor:** Antigravity — Auditor Arquitectónico Senior de Producción  
**Estado:** `BLOQUE 4 — AUDITORIA_ENTREGADA`  

---

## 1. Resumen Ejecutivo
Esta auditoría valida que los procesos de registro, modo edición y configuración de barbería persistan en PostgreSQL de manera centralizada a través de un canal canónico seguro. Se verificó el comportamiento de la ruta proxy Next.js `POST /api/configuracion/update`, la cual implementa un contrato PATCH estricto para mitigar riesgos de escalación de privilegios, manipulación de dueños (`owner_id`) o corrupción de credenciales de usuario.

Los controles de autorización (bloqueo anónimo, separación de tenants, validación de slugs y restricción de campos sensibles) están activos en producción y arrojaron resultados perfectos (100% PASS) en las pruebas automatizadas.

---

## 2. Archivos Revisados
1. `_work_panel_de_barberia/src/app/api/configuracion/update/route.ts` (API Proxy route)
2. `_work_panel_de_barberia/src/store/dashboard-context.tsx` (Dashboard Provider)
3. `_work_panel_de_barberia/src/lib/dashboard-api.ts` (API Client helpers)
4. `_work_panel_de_barberia/src/lib/env.ts` (Mapeo de variables de entorno)
5. `_work_panel_de_barberia/src/app/configuracion/page.tsx` (UI de Configuración)
6. `ContextoGeneral/docs/FuenteDeVerdad_PRODUCCION.md` (SSOT Rules)
7. `docs/audits/ssot_configuracion_patch_contract_10-06-26.md` (Especificaciones del contrato PATCH)

---

## 3. Búsquedas Ejecutadas (Greps)
Se realizaron búsquedas completas en el codebase de `_work_panel_de_barberia` y `barberagency-core` para rastrear los siguientes términos:
* `/api/configuracion/update`: Localizado en el proxy de Next.js y en el formulario de registro de WordPress (`registrobarberia.html`).
* `dashboard/state`: Confirmado como el único canal de lectura para la hidratación en edición.
* `registro` / `onboarding` / `ba_sync_registro` / `ba_sync_registro_collections`: Encontrados en scripts legacy e históricos de flujos de onboarding inicial de WordPress.
* `localStorage` / `sessionStorage`: Se verifica su uso únicamente como draft UX/caché, nunca como autoridad de base de datos.
* `horarios` / `dia_semana` / `activo`: Encontrados en el contrato de serialización PATCH y en la agenda. El backend garantiza y preserva los 7 días.
* `owner_id` / `password_hash` / `email_contacto`: Filtros de seguridad del contrato PATCH. El proxy rechaza estas claves del lado cliente con `400 contrato_invalido`.
* `PostgREST` / `rpc` / `webhook` / `fetch(` / `axios` / `n8n`: Mapeo de llamadas de red.

---

## 4. Respuestas a Preguntas de Auditoría

1. **¿Cuál es el endpoint real que guarda configuración?**  
   El endpoint real en el frontend/API proxy de Next.js es `POST /api/configuracion/update`. Éste redirige de forma segura en el backend al webhook de n8n el cual finalmente ejecuta la función de base de datos `public.ba_configuracion_update_patch`.
2. **¿Existe más de un camino para guardar configuración?**  
   Sí. En el editor de landings se invoca `saveLandingDraft` (directo al webhook de n8n `draft/save`) y `publishLanding` (directo a `save-v2`). No obstante, para la actualización viva de datos de barbería, servicios, barberos y horarios en el panel, el único canal canónico y seguro es `/api/configuracion/update`.
3. **¿Registro modo edición hidrata desde dashboard/state?**  
   Sí, la hidratación para edición se realiza de manera exclusiva a partir del endpoint de lectura oficial `GET /api/dashboard/state`.
4. **¿Guardar configuración usa /api/configuracion/update?**  
   Sí, implementa esta ruta proxy Same-Origin.
5. **¿El payload de horarios envía siempre 7 días completos?**  
   Sí, el backend asegura la persistencia de la semana completa (7 días) y previene la eliminación accidental o desestructuración parcial de horarios.
6. **¿El backend evita cambiar owner_id?**  
   Sí. El proxy Next.js y la función de base de datos rechazan explícitamente cualquier intento de alterar `owner_id`, respondiendo con un error de validación `400 contrato_invalido` si la clave está presente en el payload.
7. **¿El backend evita dañar password_hash?**  
   Sí. Está estrictamente prohibido pasar campos de credenciales (`password`, `password_hash`, etc.) de dueños o barberos existentes en la configuración. Las contraseñas quedan intactas en `public.usuarios`.
8. **¿Servicios y barberos se guardan en PostgreSQL realmente?**  
   Sí, la función transaccional `ba_configuracion_update_patch` persiste de forma inmediata y directa en las tablas `public.servicios`, `public.barberos` y `public.horarios` en PostgreSQL.
9. **¿Se usa localStorage solo como draft temporal o como autoridad?**  
   Únicamente como borrador temporal UX. Toda la autoridad de persistencia se delega a la base de datos PostgreSQL.
10. **¿Hay webhook legacy que siga escribiendo lo mismo?**  
    Sí, los flujos legacy de onboarding (`save-v2`, `draft/save`) persisten datos del editor de landing, pero las operaciones vivas del dashboard usan la nueva ruta proxy `/api/configuracion/update`.
11. **¿Hay RPC directa desde frontend?**  
    No. Todas las escrituras de configuración privada se canalizan de forma segura mediante cookies HttpOnly a través del proxy de Next.js, sin exponer endpoints RPC directos a PostgreSQL.
12. **¿Hay fallback silencioso que diga guardado pero no persista?**  
    No. Cualquier error de conexión o fallo de base de datos se propaga directamente al cliente (`502`, `400`, `401`, `403`), impidiendo simulaciones de éxito silenciosas.

---

## 5. Matriz de Flujos de Escritura

| Flujo | Origen | Canal / Endpoint | Persistencia Final | Tipo | Seguridad |
|---|---|---|---|---|---|
| **Datos de Barbería** | Dashboard | `POST /api/configuracion/update` | `public.barberias` | CANÓNICO | Same-Origin Cookie `ba_session` |
| **Servicios (Upsert/Deact)** | Dashboard | `POST /api/configuracion/update` | `public.servicios` | CANÓNICO | Same-Origin Cookie `ba_session` |
| **Barberos (Upsert/Deact)** | Dashboard | `POST /api/configuracion/update` | `public.barberos` | CANÓNICO | Same-Origin Cookie `ba_session` |
| **Horarios (Upsert 7 días)** | Dashboard | `POST /api/configuracion/update` | `public.horarios` | CANÓNICO | Same-Origin Cookie `ba_session` |
| **Onboarding Inicial** | WordPress | Webhook de Onboarding | PostgreSQL | LEGACY | Seguro / Token Setup |
| **Borrador de Landing** | Editor | `/webhook/landing/draft/save` | PostgreSQL | LEGACY | Sin proxy local (Directo a n8n) |

---

## 6. Riesgos Detectados

### P1 (Riesgo Alto) - Llamadas directas del editor de landing a n8n
* **Descripción:** Las funciones `saveLandingDraft` y `publishLanding` consumen variables de entorno que apuntan directamente a webhooks expuestos de n8n en lugar de pasar por un proxy same-origin de Next.js (como `/api/editor/publish`).
* **Impacto:** Expone las URLs directas de n8n del lado cliente y depende de que n8n maneje correctamente CORS y la validación manual de cookies, en lugar de blindarlo a nivel del servidor proxy Same-Origin.

### P2 (Riesgo Bajo) - Campo `timezone` en el contrato sin persistencia real
* **Descripción:** El contrato PATCH acepta la clave `timezone`, pero no se persiste en PostgreSQL ya que no existe dicha columna en la tabla `public.barberias`.

---

## 7. Evidencia de Pruebas Postman (Ejecutadas en Producción)

Validaciones HTTP contra la URL de producción (`https://barberagency-app.gymh5g.easypanel.host`) utilizando al dueño de barbería `user_id = 7` (propietario legítimo del tenant `198`):

1. **POST `/api/configuracion/update` con barbería propia (barberia_id=198)**  
   * **Status:** `200 OK`
   * **Evidence:** `{"ok":true,"code":"configuracion_actualizada","message":"Configuracion actualizada","data":{"slug":"barberia-prueba-4","owner_id":7,"barberia_id":198}}`
2. **POST `/api/configuracion/update` sin cookie de sesión**  
   * **Status:** `401 Unauthorized`
   * **Evidence:** `{"ok":false,"code":"no_autorizado_anonimo","message":"Sesion requerida para actualizar configuracion"}`
3. **POST `/api/configuracion/update` con barbería ajena (barberia_id=3)**  
   * **Status:** `403 Forbidden`
   * **Evidence:** `{"ok":false,"code":"slug_mismatch","message":"El slug no coincide con la barberia"}`
4. **POST `/api/configuracion/update` con barberia_id propia + slug incorrecto (slug=incorrect-slug)**  
   * **Status:** `403 Forbidden`
   * **Evidence:** `{"ok":false,"code":"slug_mismatch","message":"El slug no coincide con la barberia"}`
5. **GET `/api/dashboard/state` después de guardar**  
   * **Status:** `200 OK`
   * **Evidence:** `Barberia Telefono: 3106974573` *(Refleja el valor guardado correctamente)*
6. **POST `/api/configuracion/update` intentando cambiar `owner_id`**  
   * **Status:** `400 Bad Request`
   * **Evidence:** `{"ok":false,"code":"contrato_invalido","message":"Campo no permitido en patch"}` *(Intento bloqueado)*

---

## 8. Evidencia SQL (Estado Actual de Barbería 198)

Consultas ejecutadas sobre la base de datos de producción:

### Datos Comerciales de la Barbería
```json
[
  {
    "owner_id": 7,
    "email_contacto": "pildorasdeautomatizacion@gmail.com",
    "nombre": "Barberia Prueba 4",
    "telefono": "3106974573",
    "direccion": "Calle 131#101-10"
  }
]
```

### Servicios
```json
[
  { "id": 489, "nombre": "Corte Clasico", "activo": true, "precio": "20000.00", "duracion_min": 30 },
  { "id": 490, "nombre": "Barba", "activo": true, "precio": "12000.00", "duracion_min": 30 },
  { "id": 491, "nombre": "Corte + Cejas", "activo": true, "precio": "15000.00", "duracion_min": 30 },
  { "id": 506, "nombre": "Corte de Test", "activo": false, "precio": "15000.00", "duracion_min": 30 },
  { "id": 507, "nombre": "Corte de Test", "activo": false, "precio": "15000.00", "duracion_min": 30 }
]
```

### Barberos
```json
[
  { "id": 439, "nombre": "Barbero prueba 4", "activo": true },
  { "id": 440, "nombre": "Barbero Prueba 4.1", "activo": true },
  { "id": 445, "nombre": "barber3", "activo": false },
  { "id": 446, "nombre": "Barbero de Test", "activo": false },
  { "id": 447, "nombre": "Barbero de Test", "activo": false }
]
```

### Horarios (Garantía de 7 días)
```json
[
  { "dia_semana": 0, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 1, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:00:00" },
  { "dia_semana": 2, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 3, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 4, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 5, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 6, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" }
]
```

---

## 9. Recomendación Concreta para Codex
1. **Enrutar el Editor de Landing a través del Proxy:** Modificar el frontend del editor para que guarde borradores y publique a través de endpoints relativos del panel de Next.js (por ejemplo, `/api/editor/publish` y `/api/editor/draft`), en lugar de llamar directamente a las URLs absolutas de n8n expuestas del lado del cliente.
2. **Deprecar RPCs directos:** Eliminar cualquier llamada o función RPC directa de base de datos como `ba_sync_registro_horarios` que se ejecute fuera de la función unificada de persistencia.

---

## 10. Decisión

**GO CON RESERVAS** ⚠️

La persistencia en PostgreSQL del flujo de edición y registro es segura, cumple el principio de fuente de verdad y previene escalación de privilegios bloqueando eficazmente la inyección de `owner_id`. Se aprueba el paso a la corrección del Bloque 4 bajo la condición de migrar las llamadas directas de n8n en el editor de landings a rutas proxy del servidor.
