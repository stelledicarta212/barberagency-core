# P0 Fuente de Verdad — Bloque 1 Matriz de Endpoints

## Resumen ejecutivo

Como auditor arquitectónico senior de producción para BarberAgency, he llevado a cabo la auditoría técnica e inventario detallado del **Bloque 1** del plan P0 (Matriz de Endpoints Canónicos). 

El análisis abarca los 16 dominios solicitados e involucra la revisión exhaustiva de:
1. Las API Routes (Proxies) de Next.js (`_work_panel_de_barberia/src/app/api`).
2. El cliente de API del panel de control (`_work_panel_de_barberia/src/lib/dashboard-api.ts`).
3. El router público de WordPress (`wordpress-plugins/barberagency-public-router-v5/barberagency-public-router.php`).
4. El esquema de base de datos y funciones RPC (`app/database/schema/bdmaster.md` y archivos de migración).

Se detectó una duplicidad crítica de inicio de sesión (`/api/auth/login` vs `/api/session/login`), fallbacks inseguros a nivel de frontend que inyectan datos de prueba (mocks de barberos), lecturas riesgosas directamente sobre PostgREST eludiendo el proxy, y un fallo de seguridad crítico en el proxy de pagos (`/api/pos`) que omite la validación de la cookie de sesión `ba_session`.

---

## Archivos revisados

Se revisaron y auditaron los siguientes recursos clave:
- [FuenteDeVerdad_PRODUCCION.md](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/ContextoGeneral/docs/FuenteDeVerdad_PRODUCCION.md)
- [FuenteDeVerdad_ENDPOINTS_CANONICOS.md](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/ContextoGeneral/docs/FuenteDeVerdad_ENDPOINTS_CANONICOS.md)
- [P0_IMPLEMENTACION_FuenteDeVerdad_Produccion.md](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/ContextoGeneral/planes/P0_IMPLEMENTACION_FuenteDeVerdad_Produccion.md)
- [CLAUDE.md](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/CLAUDE.md)
- [qa_production_report.md](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/qa_production_report.md)
- [audit_go_nogo_produccion_04-06-26.md](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/ContextoGeneral/daily/audit_go_nogo_produccion_04-06-26.md)
- [Hallazgos04-06-26.md](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/ContextoGeneral/daily/Hallazgos04-06-26.md)
- [dashboard-api.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/dashboard-api.ts)
- [env.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/env.ts)
- [api.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/api.ts)
- [api/session/me/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/session/me/route.ts)
- [api/session/login/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/session/login/route.ts)
- [api/auth/login/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/auth/login/route.ts)
- [api/configuracion/update/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/configuracion/update/route.ts)
- [api/dashboard/state/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/dashboard/state/route.ts)
- [api/editor/publish/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/editor/publish/route.ts)
- [api/pos/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/pos/route.ts)
- [barberagency-public-router.php](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/wordpress-plugins/barberagency-public-router-v5/barberagency-public-router.php)

---

## Búsquedas ejecutadas

Se rastreó el uso de los 26 términos clave requeridos en el repositorio para identificar dependencias cruzadas e inconsistencias:
- `/api/session/me` (Usado en el hydration wrapper del dashboard de Next.js y en los reportes de QA).
- `/api/dashboard/state` (Hidratación canónica del Dashboard Next.js).
- `/api/configuracion/update` (API proxy para persistir cambios vivos en PostgreSQL).
- `/api/editor/publish` (Publicación segura del editor visual).
- `reservas/slots` (Webhook n8n público para malla horaria en plantillas).
- `reservas/create` (Webhook n8n para generación de citas).
- `ba_get_landing_publica` (RPC PostgreSQL para recuperar el snapshot público en WordPress).
- `ba_resolver_qr` (RPC PostgreSQL para resolver QR público a landing).
- `ba_publicar` y `ba_publicar_landing` (Funciones de migración e inicialización del tenant en DB).
- `ba_sync_registro` y `ba_sync_registro_collections` (Invocaciones PostgREST directas del formulario heredado).
- `localStorage` y `sessionStorage` (Mecanismos no autoritativos de persistencia e identidad).
- `seedLandingData` y `ba_landing_seed` (Datos precargados de templates).
- `ba_dashboard_reservas` (Caché local de citas en el Dashboard).
- `mock` y `fallback` (Detectados datos estáticos de barberos y mitigación de errores de API).
- `email_contacto` (Históricamente asociado a permisos; saneado para ser únicamente valor de contacto comercial).
- `barberia_miembros` (Uso correcto para control de membresías multi-tenant).
- `owner_id` (Identificador clave de propiedad del tenant).
- `slug` (Ruta legible; validada con `barberia_id` para evitar cruces).
- `PostgREST`, `rpc` y `webhook` (Canales de comunicación hacia PostgreSQL).

---

## Matriz de endpoints

| Dominio | Endpoint o función | Método | Tipo | Estado | Archivo origen | Tabla PostgreSQL | Validación auth | Validación tenant | Riesgo | Recomendación |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Identidad | `/api/session/me` | GET | AUTH / LECTURA_PRIVADA | CANONICO | `_work_panel_de_barberia/src/app/api/session/me/route.ts` | `usuarios`, `barberia_miembros`, `barberias` | Valida `ba_session` JWT | Filtra y devuelve solo barberías asociadas en miembros | Si falla, rompe todo el dashboard | Confirmar correcto parseo y expiración del JWT en backend (n8n). |
| Identidad | `/api/session/login` | POST | AUTH | CANONICO | `_work_panel_de_barberia/src/app/api/session/login/route.ts` | `usuarios`, `barberia_miembros`, `barberias` | Ninguna | Resuelve y asocia la barbería ingresada | Exposición de credenciales | Mantener con HTTPS estricto y rate limiting. |
| Identidad | `/api/auth/login` | POST | AUTH | DUPLICADO | `_work_panel_de_barberia/src/app/api/auth/login/route.ts` | `usuarios`, `barberias` | Ninguna | Resuelve identidad | Duplicación de lógica de login con `/api/session/login` | ELIMINAR en favor de `/api/session/login`. |
| Dashboard | `/api/dashboard/state` | GET | LECTURA_PRIVADA | CANONICO | `_work_panel_de_barberia/src/app/api/dashboard/state/route.ts` | Todas las del tenant | Valida `ba_session` JWT | Compara `user_id` con `owner_id` o `barberia_miembros` | Cruce multi-tenant si falla n8n | Eliminar fallbacks de datos mock y local storage en Next.js. |
| Configuración | `/api/configuracion/update` | POST | ESCRITURA_PRIVADA | CANONICO | `_work_panel_de_barberia/src/app/api/configuracion/update/route.ts` | `barberias`, `servicios`, `barberos`, `horarios` | Valida `ba_session` JWT | Valida pertenencia del `barberia_id` | Mismatch id-slug o alteración de datos de usuario/owner | Asegurar que n8n bloquee edición de `owner_id` y password principal. |
| Registro | `/webhook/registro-barberia` | POST | ESCRITURA_PUBLICA_CONTROLADA | CANONICO | n8n webhook | `usuarios`, `barberias`, `barberia_miembros`, `servicios`, `barberos`, `horarios` | Pública | Crea nuevo tenant | Transacciones fallidas parciales o duplicaciones | Asegurar transacción atómica y robusta en base de datos. |
| Registro | `POST /rpc/ba_sync_registro_collections` | POST | RPC_DB / ESCRITURA_PRIVADA | LEGACY | Base de datos SQL | `servicios`, `barberos` | RLS DB Grants | Por `p_barberia_id` | Escritura directa desde frontend que elude n8n | DEPRECATED; consolidar todo flujo de registro por n8n. |
| Registro | `POST /rpc/ba_sync_registro_horarios` | POST | RPC_DB / ESCRITURA_PRIVADA | LEGACY | Base de datos SQL | `horarios` | RLS DB Grants | Por `p_barberia_id` | Desactivación rota si se omiten días | DEPRECATED; consolidar en `/api/configuracion/update`. |
| Publicación | `/api/editor/publish` | POST | ESCRITURA_PRIVADA | CANONICO | `_work_panel_de_barberia/src/app/api/editor/publish/route.ts` | `barberia_public_profiles`, `barberia_theme`, `barberia_assets` | Valida `ba_session` JWT | Valida que sea owner o miembro admin de la barbería | Snapshot viejo si lee de `ba_get_landing_publica` | Usar siempre el payload vivo actual para publicar. |
| Publicación | `POST /rpc/ba_publicar_barberia` | POST | RPC_DB / ESCRITURA_PRIVADA | LEGACY | Base de datos SQL | `barberia_public_profiles` | RLS DB Grants | Por `p_barberia_id` | bypass de n8n o ejecución anónima | DEPRECATED; delegar exclusivamente en `/api/editor/publish`. |
| Publicación | `POST /rpc/ba_publicar_landing_completa` | POST | RPC_DB / ESCRITURA_PRIVADA | LEGACY | Base de datos SQL | `barberia_public_profiles`, `barberia_theme`, `barberia_assets` | RLS DB Grants | Por `p_barberia_id` | bypass de n8n | DEPRECATED; delegar en `/api/editor/publish`. |
| Landing pública | `ba_get_landing_publica` | POST | RPC_DB / LECTURA_PUBLICA | CANONICO | Base de datos SQL | `barberia_public_profiles`, `barberia_theme`, `barberia_assets` | Pública | Por `slug` | Exposición de datos no publicados si hay fallos | Mantener con RLS estricta para lectura pública. |
| QR | `ba_resolver_qr` | POST | RPC_DB / LECTURA_PUBLICA | CANONICO | Base de datos SQL | `barberia_public_profiles` | Pública | Por `qr_code` | Redirección incorrecta si slug cambia | Asegurar que el QR se actualice en cascada al cambiar slug. |
| Slots | `/webhook/barberagency/reservas/slots` | GET | LECTURA_PUBLICA | CANONICO | n8n webhook | `horarios`, `citas`, `barberos`, `servicios` | Pública | Filtra por barbería, servicio y barbero | Slots de otro tenant expuestos si no se valida | Validar pertenencia del servicio y barbero en backend. |
| Reservas | `/webhook/barberagency/reservas/create` | POST | ESCRITURA_PUBLICA_CONTROLADA | CANONICO | n8n webhook | `clientes_finales`, `citas` | Pública | Valida pertenencia de servicios y barberos | Doble reserva (concurrencia) o citas falsas | Implementar bloqueo a nivel de fila (`FOR UPDATE`) en base de datos. |
| Citas dashboard | `/webhook/barberagency/dashboard/citas` | POST | ESCRITURA_PRIVADA | CANONICO | n8n webhook | `clientes_finales`, `citas` | Valida `ba_session` JWT | Valida que sea owner o admin del tenant | Citas fantasma en localStorage | Desactivar almacenamiento local en frontend y depender de DB. |
| Servicios | `/webhook/barberagency/dashboard/servicios` | POST | ESCRITURA_PRIVADA | CANONICO | n8n webhook | `servicios` | Valida `ba_session` JWT | Valida que sea owner o admin del tenant | No persistencia de datos (cambios solo en React) | Exigir que cada cambio visual llame al webhook. |
| Barberos | `/webhook/barberagency/dashboard/barberos` | POST | ESCRITURA_PRIVADA | CANONICO | n8n webhook | `barberos`, `barberos_descansos` | Valida `ba_session` JWT | Valida que sea owner o admin del tenant | Actualización de barberos de otra barbería | Mantener validación cruzada y RLS. |
| Barberos | `/barberos_descansos` | GET | LECTURA_PRIVADA | RIESGOSO | `_work_panel_de_barberia/src/lib/dashboard-api.ts` (directo a PostgREST) | `barberos_descansos` | PostgREST JWT | Filtra por query param `barberia_id` | Lectura de descansos de otros tenants si el RLS falla | Mover la lectura a `/api/dashboard/state` o a través del proxy same-origin. |
| Horarios | `/api/configuracion/update` (horarios block) | POST | ESCRITURA_PRIVADA | CANONICO | `_work_panel_de_barberia/src/app/api/configuracion/update/route.ts` | `horarios` | Valida `ba_session` JWT | Valida que sea owner o admin del tenant | Horarios incompletos si el front filtra días | Exigir siempre el envío de los 7 días (activo=true/false). |
| Pagos | `/api/pos` | POST | ESCRITURA_PRIVADA | RIESGOSO | `_work_panel_de_barberia/src/app/api/pos/route.ts` (Next Proxy) | `pagos` | Ninguna (Bypass de cookie `ba_session` en proxy Next.js) | Ninguna en proxy | Ventas/pagos fraudulentos de otros tenants | Agregar validación de cookie `ba_session` en el manejador `/api/pos/route.ts`. |
| Productos | `/api/productos` | GET/POST | ESCRITURA_PRIVADA | DESCONOCIDO | Pendiente (planificado Bloque 8) | `productos` | Pendiente | Pendiente | Inconsistencias o bypass de auth | Implementar con el mismo patrón seguro (Next Proxy -> n8n -> DB). |
| Gastos | `/api/gastos` | GET/POST | ESCRITURA_PRIVADA | DESCONOCIDO | Pendiente (planificado Bloque 8) | `gastos` | Pendiente | Pendiente | Inconsistencias o bypass de auth | Implementar con el mismo patrón seguro (Next Proxy -> n8n -> DB). |

---

## Endpoints CANONICO confirmados

Se catalogan como canónicos y autorizados para producción los siguientes 13 flujos:
1. `GET /api/session/me` (Identidad activa)
2. `POST /api/session/login` (Login controlado)
3. `GET /api/dashboard/state` (Lectura del dashboard)
4. `POST /api/configuracion/update` (Escritura de configuración comercial)
5. `POST /webhook/registro-barberia` (Onboarding del tenant)
6. `POST /api/editor/publish` (Publicación segura de landing)
7. `POST /rpc/ba_get_landing_publica` (Lectura pública segura)
8. `POST /rpc/ba_resolver_qr` (Resolución de QR público)
9. `GET /webhook/barberagency/reservas/slots` (Carga de malla horaria)
10. `POST /webhook/barberagency/reservas/create` (Creación de reserva pública)
11. `POST /webhook/barberagency/dashboard/citas` (CRUD citas del dashboard)
12. `POST /webhook/barberagency/dashboard/servicios` (CRUD servicios del dashboard)
13. `POST /webhook/barberagency/dashboard/barberos` (CRUD barberos del dashboard)

---

## Endpoints LEGACY detectados

Rutas y funciones heredadas del desarrollo que deben ser deprecadas:
- `POST /rpc/ba_sync_registro_collections`
- `POST /rpc/ba_sync_registro_horarios`
- `POST /rpc/ba_publicar_barberia`
- `POST /rpc/ba_publicar_landing_completa`

---

## Endpoints DUPLICADO detectados

- `/api/auth/login` (Hace exactamente lo mismo que `/api/session/login` invocando al mismo webhook de n8n).

---

## Endpoints RIESGOSO detectados

- `/api/pos` (La ruta del proxy Next.js no inspecciona ni valida la cookie `ba_session` del usuario ni cruza los permisos con `session/me`, permitiendo crear facturas/ventas anónimas o para cualquier barbería).
- `/barberos_descansos` (Se lee de forma directa desde el frontend usando PostgREST. Si falla la política de RLS, expone información a otros tenants).

---

## Endpoints para ELIMINAR

- `/api/auth/login` (Eliminar para forzar el uso de `/api/session/login`).
- `POST /rpc/ba_sync_registro_collections` y `POST /rpc/ba_sync_registro_horarios` (Bloquear ejecución desde el rol `anon`/`authenticated` para evitar bypass del backend).
- `POST /rpc/ba_publicar_barberia` (Bloquear para llamadas directas anónimas).

---

## Escrituras directas desde frontend

- El formulario antiguo de registro (`registrobarberia.html`) realizaba llamadas directas a las RPCs `/rpc/ba_sync_registro_collections` y `/rpc/ba_sync_registro_horarios`.
- El editor de WordPress histórico poseía scripts de publicación directa.

---

## Lecturas desde localStorage, seed o cache

- El dashboard de citas (`src/app/citas/page.tsx`) guarda las peticiones localmente en `ba_dashboard_reservas` sin llamadas persistentes al backend (citas "fantasma").
- El dashboard de Next.js hidrata la identidad de la barbería leyendo de `localStorage` (`ba_barberia_id`, `ba_barberia_slug`) y posee fallbacks de desarrollo para barberos ficticios (como "Alex M.", "James V.", "Aldo H.") si la carga del estado falla.
- WordPress inyecta el snapshot público en `sessionStorage` bajo la llave `ba_landing_seed` vía `BarberAgency_Public_Router`.

---

## Riesgos P0

1. **Bypass de autenticación en POS (`/api/pos`)**: Cualquier cliente puede invocar la creación de ventas enviando un payload con una `barberia_id` aleatoria, dado que el proxy de Next.js no valida la existencia de una sesión ni la pertenencia del usuario al tenant.
2. **Cruce de datos y privilegios por `email_contacto`**: La query de validación de identidad histórica en n8n validaba acceso si el email del usuario coincidía con el `email_contacto` comercial de la barbería, lo cual permitía usurpación si un tenant cambiaba el contacto.

---

## Riesgos P1

1. **Lectura directa eludiendo el Same-Origin Proxy**: La API frontend de descansos consulta `/barberos_descansos` directamente a PostgREST sin pasar por las API Routes seguras de Next.js.
2. **Inconsistencias y pérdidas en horarios**: Al filtrar el frontend los horarios inactivos, la base de datos omite la desactivación lógica en la tabla `horarios`.

---

## Riesgos P2

1. **Estados locales ocultando caídas de base de datos**: Los mocks y errores silenciados con `setError(null)` usando caché antigua impiden que el administrador sepa que el backend está caído.

---

## Recomendación para Codex

1. **Refactorizar `/api/pos/route.ts`**: Implementar la extracción de `ba_session`, parsear la firma y validar los accesos cruzados antes de hacer fetch al webhook de facturación de n8n.
2. **Eliminar `/api/auth/login`** y apuntar las llamadas de autenticación del panel a `/api/session/login`.
3. **Hardening de RPCs**: Ejecutar comandos SQL para revocar permisos de ejecución pública a `ba_sync_registro_collections`, `ba_sync_registro_horarios` y `ba_publicar_barberia`.

---

## Decisión

**GO CON RESERVAS**

*Motivación*: La auditoría e inventario se encuentran completos y consolidados. No obstante, no se debe liberar a producción el panel sin antes blindar la ruta de POS `/api/pos` en Next.js (Riesgo P0) y resolver la persistencia directa de citas para evitar datos ficticios en storage.
