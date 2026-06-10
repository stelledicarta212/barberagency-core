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
| Identidad           | `/api/session/me`                                     | Login/auth controlado                                          | `usuarios`, `barberia_miembros`, `barberias`                                      | CANONICO          |
| Dashboard           | `/api/dashboard/state`                                | No escribe                                                     | Tablas del tenant                                                                 | CANONICO          |
| Configuración       | `/api/dashboard/state`                                | `/api/configuracion/update`                                    | `barberias`, `servicios`, `barberos`, `horarios`                                  | CANONICO          |
| Registro inicial    | Pendiente auditar                                     | Webhook onboarding / registro autorizado                       | `usuarios`, `barberias`, `barberia_miembros`, `servicios`, `barberos`, `horarios` | DESCONOCIDO       |
| Publicación landing | `ba_get_landing_publica(slug)`                        | `/api/editor/publish`                                          | `barberia_public_profiles`, `barberia_theme`, `barberia_assets`                   | CANONICO          |
| Landing pública     | `ba_get_landing_publica(slug)`                        | No escribe                                                     | `barberia_public_profiles`, `barberia_theme`, `barberia_assets`                   | CANONICO          |
| QR                  | `ba_resolver_qr` o perfil público publicado           | Generado en publicación                                        | `barberia_public_profiles`                                                        | PENDIENTE AUDITAR |
| Slots               | `/webhook/barberagency/reservas/slots`                | No escribe                                                     | `horarios`, `citas`, `barberos`, `servicios`                                      | CANONICO          |
| Reservas públicas   | Dashboard lee después por `/api/dashboard/state`      | `/webhook/barberagency/reservas/create`                        | `clientes_finales`, `citas`                                                       | CANONICO          |
| Citas dashboard     | `/api/dashboard/state` o endpoint autorizado de citas | Endpoint autorizado de citas                                   | `clientes_finales`, `citas`                                                       | PENDIENTE AUDITAR |
| Servicios           | `/api/dashboard/state` o endpoint autorizado          | `/api/configuracion/update` o endpoint autorizado de servicios | `servicios`                                                                       | PENDIENTE AUDITAR |
| Barberos            | `/api/dashboard/state` o endpoint autorizado          | `/api/configuracion/update` o endpoint autorizado de barberos  | `barberos`                                                                        | PENDIENTE AUDITAR |
| Horarios            | `/api/dashboard/state` o endpoint autorizado          | `/api/configuracion/update` o endpoint autorizado de horarios  | `horarios`                                                                        | PENDIENTE AUDITAR |
| Pagos               | Endpoint autorizado / dashboard state                 | Endpoint autorizado de pagos                                   | `pagos`                                                                           | PENDIENTE AUDITAR |
| Productos           | Endpoint autorizado                                   | Endpoint autorizado de productos                               | `productos`                                                                       | PENDIENTE AUDITAR |
| Gastos              | Endpoint autorizado                                   | Endpoint autorizado de gastos                                  | `gastos`                                                                          | PENDIENTE AUDITAR |

---

## 6. Matriz detallada de endpoints

> Esta tabla debe ser completada por Antigravity durante el Bloque 1.

| Dominio         | Endpoint o función                      | Método     | Tipo                         | Estado            | Archivo origen | Tabla PostgreSQL                                                | Validación auth           | Validación tenant                            | Riesgo                             | Recomendación                               |
| --------------- | --------------------------------------- | ---------- | ---------------------------- | ----------------- | -------------- | --------------------------------------------------------------- | ------------------------- | -------------------------------------------- | ---------------------------------- | ------------------------------------------- |
| Identidad       | `/api/session/me`                       | GET        | AUTH / LECTURA_PRIVADA       | CANONICO          | Pendiente      | `usuarios`, `barberia_miembros`, `barberias`                    | Debe validar `ba_session` | Debe devolver solo barberías autorizadas     | Si falla, rompe todo el dashboard  | Confirmar implementación actual             |
| Dashboard       | `/api/dashboard/state`                  | GET        | LECTURA_PRIVADA              | CANONICO          | Pendiente      | Tablas del tenant                                               | Debe validar `ba_session` | Debe validar `barberia_id` y `slug` si viene | Cruce multi-tenant                 | Confirmar bloqueo 401/403                   |
| Configuración   | `/api/configuracion/update`             | POST       | ESCRITURA_PRIVADA            | CANONICO          | Pendiente      | `barberias`, `servicios`, `barberos`, `horarios`                | Debe validar `ba_session` | Debe validar `barberia_id`                   | Escritura ajena o parcial          | Confirmar Postman y SQL                     |
| Publicación     | `/api/editor/publish`                   | POST       | ESCRITURA_PRIVADA            | CANONICO          | Pendiente      | `barberia_public_profiles`, `barberia_theme`, `barberia_assets` | Debe validar `ba_session` | Debe validar `barberia_id`                   | Publicación ajena o snapshot viejo | Confirmar payload actual                    |
| Landing pública | `ba_get_landing_publica(slug)`          | RPC / POST | LECTURA_PUBLICA              | CANONICO          | Pendiente      | `barberia_public_profiles`, `barberia_theme`, `barberia_assets` | No requiere sesión admin  | Solo datos públicos                          | Datos viejos si hay legacy         | Confirmar que no se pisa por endpoint viejo |
| QR              | `ba_resolver_qr`                        | RPC / POST | LECTURA_PUBLICA              | PENDIENTE AUDITAR | Pendiente      | `barberia_public_profiles`                                      | No requiere sesión admin  | Solo datos públicos                          | QR incorrecto                      | Auditar flujo real                          |
| Slots           | `/webhook/barberagency/reservas/slots`  | GET        | LECTURA_PUBLICA              | CANONICO          | Pendiente      | `horarios`, `citas`, `barberos`, `servicios`                    | No requiere sesión admin  | Debe validar pertenencia servicio/barbero    | Servicio/barbero ajeno             | Confirmar 400 controlado                    |
| Reservas        | `/webhook/barberagency/reservas/create` | POST       | ESCRITURA_PUBLICA_CONTROLADA | CANONICO          | Pendiente      | `clientes_finales`, `citas`                                     | No requiere sesión admin  | Debe validar tenant por barbería/slug/ids    | Reserva doble o ajena              | Confirmar atomicidad DB                     |
| Citas dashboard | Pendiente auditar                       | Pendiente  | ESCRITURA_PRIVADA            | DESCONOCIDO       | Pendiente      | `clientes_finales`, `citas`                                     | Debe validar `ba_session` | Debe validar `barberia_id`                   | Cita ajena o fantasma              | Identificar endpoint real                   |
| Servicios       | Pendiente auditar                       | Pendiente  | ESCRITURA_PRIVADA            | DESCONOCIDO       | Pendiente      | `servicios`                                                     | Debe validar `ba_session` | Debe validar `barberia_id`                   | Servicio local o ajeno             | Identificar endpoint real                   |
| Barberos        | Pendiente auditar                       | Pendiente  | ESCRITURA_PRIVADA            | DESCONOCIDO       | Pendiente      | `barberos`                                                      | Debe validar `ba_session` | Debe validar `barberia_id`                   | Barbero local o ajeno              | Identificar endpoint real                   |
| Horarios        | Pendiente auditar                       | Pendiente  | ESCRITURA_PRIVADA            | DESCONOCIDO       | Pendiente      | `horarios`                                                      | Debe validar `ba_session` | Debe validar `barberia_id`                   | Horarios incompletos               | Confirmar 7 días                            |
| Pagos           | Pendiente auditar                       | Pendiente  | ESCRITURA_PRIVADA            | DESCONOCIDO       | Pendiente      | `pagos`                                                         | Debe validar `ba_session` | Debe validar cita/barbería                   | Pago ajeno                         | Identificar endpoint real                   |
| Productos       | Pendiente auditar                       | Pendiente  | ESCRITURA_PRIVADA            | DESCONOCIDO       | Pendiente      | `productos`                                                     | Debe validar `ba_session` | Debe validar `barberia_id`                   | Producto ajeno                     | Identificar endpoint real                   |
| Gastos          | Pendiente auditar                       | Pendiente  | ESCRITURA_PRIVADA            | DESCONOCIDO       | Pendiente      | `gastos`                                                        | Debe validar `ba_session` | Debe validar `barberia_id`                   | Gasto ajeno                        | Identificar endpoint real                   |

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
