# Fuente de Verdad — Endpoints Canónicos BarberAgency

## 1. Propósito

Este documento define la matriz oficial de endpoints canónicos de BarberAgency.

Su objetivo es evitar rutas duplicadas, escrituras paralelas, endpoints legacy sin control y fuentes de verdad falsas.

La regla principal es:

```txt
PostgreSQL es la fuente de verdad única.
Los endpoints solo son canales de lectura o escritura hacia PostgreSQL.
```

Este documento debe actualizarse durante el Bloque 1 del plan P0 de fuente de verdad.

---

## 2. Estados permitidos para endpoints

Cada endpoint o función debe clasificarse con uno de estos estados:

| Estado      | Significado                                        |
| ----------- | -------------------------------------------------- |
| CANONICO    | Endpoint oficial y permitido para producción       |
| LEGACY      | Endpoint antiguo que todavía existe                |
| DUPLICADO   | Hace lo mismo que otro endpoint                    |
| DEPRECATED  | Está en proceso de retiro                          |
| RIESGOSO    | Puede romper fuente de verdad, auth o multi-tenant |
| ELIMINAR    | Debe removerse o bloquearse                        |
| DESCONOCIDO | Falta investigación                                |

---

## 3. Tipos permitidos

| Tipo                         | Descripción                                             |
| ---------------------------- | ------------------------------------------------------- |
| LECTURA_PRIVADA              | Lee datos privados con sesión                           |
| LECTURA_PUBLICA              | Lee datos públicos sin sesión admin                     |
| ESCRITURA_PRIVADA            | Escribe datos privados con sesión                       |
| ESCRITURA_PUBLICA_CONTROLADA | Escribe datos públicos controlados, por ejemplo reserva |
| AUTH                         | Autenticación o sesión                                  |
| RPC_DB                       | Función o RPC de PostgreSQL/PostgREST                   |
| WEBHOOK_N8N                  | Webhook de n8n                                          |
| PROXY_NEXT                   | Endpoint proxy Next.js                                  |
| LEGACY_FRONTEND              | Ruta vieja usada desde frontend                         |
| DESCONOCIDO                  | Falta investigación                                     |

---

## 4. Reglas generales

```txt
1. Un dominio no debe tener dos escrituras canónicas.
2. Todo endpoint privado debe validar ba_session.
3. Todo endpoint privado debe validar barberia_id.
4. Si viene slug y barberia_id, deben coincidir.
5. email_contacto no autoriza.
6. localStorage no autoriza.
7. slug no autoriza acceso privado.
8. Los endpoints de lectura no deben escribir.
9. Los endpoints de escritura deben tener evidencia Postman y SQL.
10. Todo endpoint legacy debe clasificarse y tener recomendación.
```

---

## 5. Matriz resumen de dominios canónicos

| Dominio             | Lectura canónica                                      | Escritura canónica                                             | Tablas PostgreSQL                                                                 | Estado            |
| ------------------- | ----------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------- |
| Identidad           | `/api/session/me`                                     | Login/auth controlado (`/api/session/login`)                   | `usuarios`, `barberia_miembros`, `barberias`                                      | CANONICO          |
| Dashboard           | `/api/dashboard/state`                                | No escribe                                                     | Tablas del tenant                                                                 | CANONICO          |
| Configuración       | `/api/dashboard/state`                                | `/api/configuracion/update`                                    | `barberias`, `servicios`, `barberos`, `horarios`                                  | CANONICO          |
| Registro inicial    | `/api/dashboard/state`                                | Webhook onboarding / registro autorizado                       | `usuarios`, `barberias`, `barberia_miembros`, `servicios`, `barberos`, `horarios` | CANONICO          |
| Publicación landing | `ba_get_landing_publica(slug)`                        | `/api/editor/publish`                                          | `barberia_public_profiles`, `barberia_theme`, `barberia_assets`                   | CANONICO          |
| Landing pública     | `ba_get_landing_publica(slug)`                        | No escribe                                                     | `barberia_public_profiles`, `barberia_theme`, `barberia_assets`                   | CANONICO          |
| QR                  | `ba_resolver_qr` o perfil público publicado           | Generado en publicación                                        | `barberia_public_profiles`                                                        | CANONICO          |
| Slots               | `/webhook/barberagency/reservas/slots`                | No escribe                                                     | `horarios`, `citas`, `barberos`, `servicios`                                      | CANONICO          |
| Reservas públicas   | Dashboard lee después por `/api/dashboard/state`      | `/webhook/barberagency/reservas/create`                        | `clientes_finales`, `citas`                                                       | CANONICO          |
| Citas dashboard     | `/api/dashboard/state`                                | `/webhook/barberagency/dashboard/citas`                        | `clientes_finales`, `citas`                                                       | CANONICO          |
| Servicios           | `/api/dashboard/state`                                | `/webhook/barberagency/dashboard/servicios`                    | `servicios`                                                                       | CANONICO          |
| Barberos            | `/api/dashboard/state` o `/barberos_descansos` (direct) | `/webhook/barberagency/dashboard/barberos`                     | `barberos`, `barberos_descansos`                                                  | CANONICO          |
| Horarios            | `/api/dashboard/state`                                | `/api/configuracion/update`                                    | `horarios`                                                                        | CANONICO          |
| Pagos               | `/api/dashboard/state`                                | `/api/pos` (Next Proxy)                                        | `pagos`                                                                           | RIESGOSO          |
| Productos           | `/api/dashboard/state` (planificado)                  | `/api/productos` (planificado)                                 | `productos`                                                                       | DESCONOCIDO       |
| Gastos              | `/api/dashboard/state` (planificado)                  | `/api/gastos` (planificado)                                    | `gastos`                                                                          | DESCONOCIDO       |

---

## 6. Matriz detallada de endpoints

> Esta tabla ha sido completada por Antigravity durante la auditoría del Bloque 1.

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

## 7. Búsquedas obligatorias para auditoría

Antigravity debe buscar estas referencias en el repo:

```txt
/api/session/me
/api/dashboard/state
/api/configuracion/update
/api/editor/publish
reservas/slots
reservas/create
ba_get_landing_publica
ba_resolver_qr
ba_publicar
ba_publicar_landing
ba_sync_registro
ba_sync_registro_collections
localStorage
sessionStorage
seedLandingData
ba_landing_seed
ba_dashboard_reservas
mock
fallback
email_contacto
barberia_miembros
owner_id
slug
PostgREST
rpc
webhook
```

---

## 8. Criterios para marcar un endpoint como CANONICO

Un endpoint solo puede marcarse como CANONICO si cumple:

```txt
1. Tiene propósito único.
2. Tiene dominio claro.
3. Lee o escribe PostgreSQL.
4. Si es privado, valida ba_session.
5. Si es privado, valida barberia_id.
6. Si recibe slug y barberia_id, valida coincidencia.
7. No depende de localStorage.
8. No usa email_contacto como permiso.
9. Tiene prueba Postman definida.
10. Tiene prueba SQL definida si escribe.
```

---

## 9. Criterios para marcar un endpoint como RIESGOSO

Un endpoint debe marcarse como RIESGOSO si:

```txt
1. Escribe sin validar ba_session.
2. Escribe sin validar barberia_id.
3. Usa slug como autorización privada.
4. Usa email_contacto como permiso.
5. Lee localStorage como autoridad.
6. Usa mock o fallback en producción.
7. Duplica escritura de otro endpoint.
8. Llama RPC directa desde frontend sin proxy seguro.
9. Llama webhook n8n directo desde frontend para datos privados.
10. Puede cruzar datos entre tenants.
```

---

## 10. Criterios para marcar un endpoint como ELIMINAR

Un endpoint debe marcarse como ELIMINAR si:

```txt
1. Tiene reemplazo canónico.
2. Es legacy y ya no se usa.
3. Duplica escritura crítica.
4. Puede romper multi-tenant.
5. Puede escribir sin auth.
6. Puede pisar datos públicos correctos.
7. Solo existe para mocks o pruebas viejas.
```

Si no se puede eliminar de inmediato, debe marcarse como:

```txt
DEPRECATED
```

y debe tener plan de retiro.

---

## 11. Evidencia esperada del Bloque 1

El Bloque 1 debe entregar:

```txt
1. Este archivo actualizado.
2. Reporte diario en ContextoGeneral/daily.
3. Lista de endpoints CANONICO.
4. Lista de endpoints LEGACY.
5. Lista de endpoints DUPLICADO.
6. Lista de endpoints RIESGOSO.
7. Lista de endpoints ELIMINAR.
8. Recomendación concreta para Codex.
9. Commit en GitHub.
```

---

## 12. Formato recomendado para el reporte diario

Crear:

```txt
ContextoGeneral/daily/YYYY-MM-DD_P0_Bloque1_Matriz_Endpoints.md
```

Contenido:

```md
# P0 Fuente de Verdad — Bloque 1 Matriz de Endpoints

## Resumen ejecutivo

## Archivos revisados

## Búsquedas ejecutadas

## Matriz de endpoints

| Dominio | Endpoint | Estado | Riesgo | Recomendación |
| --- | --- | --- | --- | --- |

## Endpoints CANONICO confirmados

## Endpoints LEGACY detectados

## Endpoints DUPLICADO detectados

## Endpoints RIESGOSO detectados

## Endpoints para ELIMINAR

## Escrituras directas desde frontend

## Lecturas desde localStorage, seed o cache

## Riesgos P0

## Riesgos P1

## Riesgos P2

## Recomendación para Codex

## Decisión

GO / GO CON RESERVAS / NO GO
```

---

## 13. Regla final

```txt
Este archivo no es teoría.
Este archivo define qué caminos son válidos para producción.

Si un endpoint no está aquí, no debe asumirse canónico.
Si un endpoint es legacy, duplicado o riesgoso, no debe usarse para nuevos cambios.
Si un endpoint escribe datos reales, debe tener Postman, SQL y validación multi-tenant.
```
