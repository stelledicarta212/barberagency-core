# P0 Fuente de Verdad — Bloque 5 Auditoría de Publicación Pública

**Fecha:** 2026-06-10  
**Auditor:** Antigravity — Auditor Arquitectónico Senior de Producción  
**Estado:** `BLOQUE 5 — AUDITORIA_ENTREGADA`  

---

## 1. Resumen Ejecutivo
Esta auditoría evalúa el flujo de publicación de landings, guardado de borradores, hidratación de la landing pública y resolución de códigos QR en BarberAgency. Se verifica el cumplimiento de las directivas arquitectónicas que exigen que todo flujo de escritura pase por un proxy same-origin de Next.js (`POST /api/editor/publish`) y que las lecturas públicas se sirvan directamente de las funciones de base de datos canónicas (`ba_get_landing_publica` y `ba_resolver_qr`), sin fugas de credenciales ni postbacks directos del cliente a n8n.

La auditoría arrojó vulnerabilidades arquitectónicas críticas y de seguridad de tipo **P0**:
1. **Bypass del Proxy de Publicación:** El panel del editor llama directamente al webhook expuesto de n8n en lugar de usar la ruta `/api/editor/publish`.
2. **Falta de Validación Tenant-Slug (Test 4 FAILED):** El endpoint responde exitosamente (`200 OK`) ante solicitudes con barbería propia pero slug incorrecto, ignorando la verificación cruzada obligatoria en multi-tenancy.
3. **Escrituras directas a n8n:** El borrador de landing (`saveLandingDraft`) y el guardado legacy (`publishLanding`) se envían de forma directa a URLs de n8n desde el navegador.

---

## 2. Archivos Revisados
1. `_work_panel_de_barberia/src/app/api/editor/publish/route.ts` (API Proxy route)
2. `_work_panel_de_barberia/src/lib/dashboard-api.ts` (API Client helpers - draft and publish functions)
3. `_work_panel_de_barberia/src/lib/public-rpc.ts` (Client RPC helpers for landing & QR resolving)
4. `_work_panel_de_barberia/src/lib/env.ts` (Environment config mappings)
5. `_work_panel_de_barberia/src/store/dashboard-context.tsx` (Dashboard provider, publish action)
6. `pruebas/publish_workflow.json` (n8n Publish Workflow schema)
7. `wordpress-plugins/barberagency-public-router/barberagency-public-router.php` (WordPress public landing resolver)
8. `ContextoGeneral/docs/FuenteDeVerdad_PRODUCCION.md` (SSOT Rules)

---

## 3. Búsquedas Ejecutadas (Greps)
Se realizaron búsquedas completas en el codebase de `_work_panel_de_barberia` and `barberagency-core` para rastrear los siguientes términos:
* `/api/editor/publish`: Localizado en el proxy de Next.js `/app/api/editor/publish/route.ts`.
* `saveLandingDraft` / `publishLanding` / `publishBarbershopViaRpc`: Ubicados en `dashboard-api.ts` y consumidos en `dashboard-context.tsx`.
* `ba_get_landing_publica` / `ba_resolver_qr`: Identificados en `public-rpc.ts` y en el plugin de WordPress.
* `NEXT_PUBLIC`: Encontrados en `env.ts` mapeando directamente webhooks de n8n hacia el cliente browser.

---

## 4. Matriz de Flujos de Publicación

| Flujo | Origen | Canal / Endpoint | Persistencia Final | Tipo | Estado / Riesgo |
|---|---|---|---|---|---|
| **Publicar Landing (Actual)** | Panel | Fetch directo browser $\rightarrow$ n8n | `public.barberia_public_profiles` | LEGACY/BYPASS | **Riesgo P0:** Expone endpoint de n8n y bypassa el proxy local. |
| **Publicar Landing (Deseado)** | Panel | `POST /api/editor/publish` | `public.barberia_public_profiles` | CANÓNICO | **No Activo:** El frontend no usa esta ruta. |
| **Borrador de Landing** | Panel | `POST` directo $\rightarrow$ n8n webhook | `public.barberia_public_profiles` | LEGACY | **Riesgo P1:** Bypass de proxy, directo a n8n. |
| **Lectura pública de Landing** | WordPress / Next.js | `POST /rpc/ba_get_landing_publica` | `public.barberia_public_profiles` | CANÓNICO | **Correcto:** Lee directamente de la base de datos REST. |
| **Resolución de Código QR** | WordPress / Next.js | `POST /rpc/ba_resolver_qr` | `public.qr_links` $\rightarrow$ `/b/{slug}` | CANÓNICO | **Correcto:** Valida el código QR y redirige dinámicamente. |

---

## 5. Respuestas a Preguntas de Auditoría

1. **¿Cuál es el endpoint real que publica landing?**  
   El cliente llama a la función `publishBarbershopViaRpc` la cual realiza un fetch directo a `https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/dashboard/publicar`. La ruta local same-origin `/api/editor/publish` está implementada pero no es consumida por el cliente.
2. **¿/api/editor/publish valida ba_session?**  
   Sí. Extrae la cookie `ba_session` y devuelve `401 Unauthorized` (`no_autorizado_anonimo`) si no está presente.
3. **¿/api/editor/publish valida barberia_id autorizado?**  
   No de forma interna en Next.js. Delegó la autorización al claim del JWT de `ba_session` evaluado por n8n/PostgreSQL. Si el usuario no es owner/miembro del `barberia_id` solicitado, se genera un `403 Forbidden` (`no_autorizado_barberia_ajena`).
4. **¿Existen llamadas directas desde cliente a n8n?**  
   Sí. Las funciones `publishBarbershopViaRpc`, `saveLandingDraft` y `publishLanding` en `dashboard-api.ts` realizan fetches directos desde el cliente a n8n.
5. **¿saveLandingDraft pasa por proxy o llama directo a n8n?**  
   Llama directo a n8n a través del endpoint `env.draftSaveEndpoint` (por defecto `https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/landing/draft/save`).
6. **¿publishLanding pasa por proxy o llama directo a n8n?**  
   Llama directo a n8n a través del endpoint `env.publishEndpoint` (por defecto `https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/landing/save-v2`).
7. **¿La landing pública lee desde ba_get_landing_publica?**  
   Sí. El plugin de WordPress y el cliente consumen la función pública REST `/rpc/ba_get_landing_publica` en `https://api.agencia2c.cloud` de forma correcta.
8. **¿Existe endpoint legacy que pise el contexto correcto?**  
   Sí. Los endpoints n8n expuestos en el frontend (`save-v2`, `draft/save`) y las funciones PostgreSQL legacy como `ba_publicar_landing_completa` (si se invocan sin control estricto de claims).
9. **¿El QR sale de la fuente pública canónica?**  
   Sí. Se resuelve de manera dinámica consumiendo `/rpc/ba_resolver_qr` mapeado a la tabla `public.qr_links`.
10. **¿El editor publica payload actual o reconstruye desde snapshot viejo?**  
    El editor publica el payload actual cargado en memoria, y actualiza el estado local del contexto con la respuesta devuelta de la base de datos para evitar pisar datos vivos con snapshots obsoletos.
11. **¿Hay RPC directa desde frontend?**  
    Sí. Para lecturas públicas, el cliente consume directamente `/rpc/ba_get_landing_publica` y `/rpc/ba_resolver_qr` desde `https://api.agencia2c.cloud`. Las escrituras (publicaciones) no deberían realizarse por RPC directa pero actualmente eluden el proxy.
12. **¿Hay variables NEXT_PUBLIC exponiendo webhooks sensibles?**  
    Sí. En `env.ts` se exponen `NEXT_PUBLIC_DRAFT_SAVE_ENDPOINT`, `NEXT_PUBLIC_PUBLISH_ENDPOINT`, entre otros, exponiendo webhooks privados de n8n en el bundle de producción del cliente.

---

## 6. Clasificación de Riesgos Detectados

### P0 (Riesgo Crítico) — Bypass de la API Proxy en Publicación
* **Descripción:** La función `publishBarbershopViaRpc` realiza un fetch del lado del cliente a la URL absoluta del webhook de n8n.
* **Impacto:** Fuga de URLs de n8n y pérdida del control de Same-Origin y headers de seguridad locales implementados en Next.js.
* **Remedación:** Cambiar el fetch de `publishBarbershopViaRpc` para que apunte al path relativo `/api/editor/publish`.

### P0 (Riesgo Crítico) — Falta de validación cruzada Tenant-Slug
* **Descripción:** Cuando se envía un payload con `barberia_id` propio pero con un slug incorrecto o de otro tenant, el endpoint responde exitosamente con `200 OK` (Test 4 FAILED) en vez de `403`. Esto se debe a que la función `ba_publicar_barberia` de base de datos solo requiere `p_barberia_id` e ignora el slug del payload, y el proxy de Next.js no valida que el slug pertenezca a la barbería autorizada antes de procesar el webhook.
* **Impacto:** Vulnerabilidad multi-tenant donde se pueden publicar datos inconsistentes bajo el contexto de un slug ajeno o incorrecto.
* **Remedación:** El proxy Next.js `/api/editor/publish` debe validar que el slug coincida con la barbería autorizada.

### P1 (Riesgo Alto) — Exposición de Webhooks Sensibles vía NEXT_PUBLIC_
* **Descripción:** Variables como `NEXT_PUBLIC_DRAFT_SAVE_ENDPOINT` exponen direcciones de backend n8n en el cliente.
* **Remedación:** Eliminar estas variables del bundle cliente y encapsular todas las llamadas del editor (borradores y publicación) en proxies de Next.js.

---

## 7. Evidencia de Pruebas Ejecutadas (Producción)

Pruebas ejecutadas localmente contra el servidor de producción (`https://barberagency-app.gymh5g.easypanel.host`) y la API REST (`https://api.agencia2c.cloud`):

```txt
┌─────────┬────┬────────────────────────────────────────────────────────────────────────────────────────┬──────────┬──────────┬────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ (index) │ id │ test                                                                                   │ expected │ obtained │ status │ evidence                                                                                                                                                           │
├─────────┼────┼────────────────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┼────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 0       │ 1  │ 'POST /api/editor/publish con barbería propia debe responder 200'                      │ 200      │ 200      │ 'PASS' │ '{"ok":true,"slug":"barberia-prueba-4","qr_code":"QR04851428","qr_path":"/q/QR04851428","barberia_id":198,"public_path":"/b/barberia-prueba-4","status_code":200}' │
│ 1       │ 2  │ 'POST /api/editor/publish sin cookie debe responder 401'                               │ 401      │ 401      │ 'PASS' │ '{"ok":false,"code":"no_autorizado_anonimo","message":"Sesion requerida para publicar"}'                                                                           │
│ 2       │ 3  │ 'POST /api/editor/publish con barbería ajena debe responder 403'                       │ 403      │ 403      │ 'PASS' │ '{"ok":false,"error":"no_autorizado_barberia_ajena"}'                                                                                                              │
│ 3       │ 4  │ 'POST /api/editor/publish con barberia_id propia + slug incorrecto debe responder 403' │ 403      │ 200      │ 'FAIL' │ '{"ok":true,"slug":"barberia-prueba-4","qr_code":"QR04851428","qr_path":"/q/QR04851428","barberia_id":198,"public_path":"/b/barberia-prueba-4","status_code":200}' │
│ 4       │ 5  │ 'Lectura pública ba_get_landing_publica después de publicar debe responder 200'        │ 200      │ 200      │ 'PASS' │ 'Landing public: Barberia Prueba 4 (Slug: barberia-prueba-4, Publicada: true)'                                                                                     │
│ 5       │ 6  │ 'ba_resolver_qr o flujo QR debe responder 200'                                         │ 200      │ 200      │ 'PASS' │ '{"ok":true,"slug":"barberia-prueba-4","barberia_id":198,"redirect_path":"/b/barberia-prueba-4"}'                                                                  │
└─────────┴────┴────────────────────────────────────────────────────────────────────────────────────────┴──────────┴──────────┴────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Evidencia SQL (Ejecutada en PostgreSQL)

### 8.1 public.barberia_public_profiles (barberia_id = 198)
```json
[
  {
    "barberia_id": 198,
    "slug": "barberia-prueba-4",
    "enabled": true,
    "qr_enabled": true,
    "nombre_publico": "Barberia Prueba 4",
    "logo_url": "https://images.unsplash.com/logo.jpg",
    "cover_url": "https://images.unsplash.com/cover.jpg",
    "ciudad": "Bogota",
    "direccion": "Calle 131#101-10",
    "telefono": "3106974573",
    "whatsapp": null,
    "email_contacto": "pildorasdeautomatizacion@gmail.com",
    "instagram": null,
    "tiktok": null,
    "politicas": "QA_P0_CONFIG_UPDATE_1781041517382",
    "moneda": "COP",
    "created_at": "2026-06-02T03:08:23.494Z",
    "updated_at": "2026-06-10T15:30:34.489Z",
    "public_landing_url": "https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-prueba-4",
    "reservation_url": "https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-prueba-4#reservas",
    "qr_url": "https://quickchart.io/qr?size=320&margin=2&text=https%3A%2F%2Fbarberagency-barberagency.gymh5g.easypanel.host%2Fb%2Fbarberia-prueba-4%23reservas",
    "maps_url": "https://www.google.com/maps?q=Calle%20131%23101-10&output=embed"
  }
]
```

### 8.2 public.barberia_theme (barberia_id = 198)
```json
[
  {
    "barberia_id": 198,
    "primary_color": "#000000",
    "secondary_color": "#111111",
    "background_color": "#FFFFFF",
    "text_color": "#ffffff",
    "updated_at": "2026-06-09T23:32:26.964Z"
  }
]
```

### 8.3 public.barberia_assets (barberia_id = 198)
```json
[]
```
*(El resultado está vacío, confirmando que la barbería no posee assets adicionales registrados actualmente).*

---

## 9. Recomendaciones Técnicas para Codex
1. **Enrutar Publicación al Proxy:** Cambiar el endpoint consumido en `publishBarbershopViaRpc` (ubicado en `/src/lib/dashboard-api.ts`) a `/api/editor/publish` (ruta relativa del mismo origen).
2. **Implementar Validación de Slug en Proxy:** Modificar el handler `/app/api/editor/publish/route.ts` para que extraiga el slug y el `barberia_id` del payload y verifique en la base de datos que el slug provisto pertenezca legítimamente a ese `barberia_id`. Si hay inconsistencia, denegar inmediatamente con `403 Forbidden`.
3. **Encapsular Borradores (`saveLandingDraft`):** Crear el endpoint proxy `/api/editor/draft` y enrutar las peticiones de guardado del editor a través del mismo, absteniéndose de usar webhooks de n8n expuestos directamente en el cliente.
4. **Remover variables `NEXT_PUBLIC` de Webhooks:** Eliminar las referencias directas a URLs de n8n del lado cliente en `env.ts` para proteger la topología interna del sistema.

---

## 10. Decisión
**NO GO**  

**Justificación:** Existen riesgos de seguridad multi-tenant de severidad **P0** (Bypass del proxy de publicación que permite llamadas directas a n8n desde el navegador, y la falta de validación cruzada entre el slug y el id del tenant en el endpoint de publicación). Codex debe resolver estas fallas antes de proceder con el despliegue del Bloque 5.
