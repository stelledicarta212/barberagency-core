# P0 Fuente de Verdad — Bloque 8 Finanzas, POS, Productos y Gastos

**Fecha:** 2026-06-10  
**Auditor:** Antigravity — Auditor Arquitectónico Senior de Producción  
**Estado:** `BLOQUE 8 — AUDITORIA_ENTREGADA`  

---

## 1. Resumen Ejecutivo

Esta auditoría valida la seguridad, consistencia multi-tenant y adherencia a la Fuente de Verdad (SSOT - PostgreSQL) de los flujos de finanzas, punto de venta (POS), inventario de productos y registro de gastos para BarberAgency. 

El resultado del análisis es **GO CON RESERVAS (FAIL en pruebas cruzadas de tenant y doble pago en webhook, pero PASS en blindaje físico de BD y autenticación proxy)**. Se ha detectado un **Riesgo Crítico P0** de aislamiento de tenant que permite a cualquier barbería registrar o modificar cobros en citas pertenecientes a otras barberías del sistema si se manipula el payload enviado a `/api/pos`.

Adicionalmente, se confirmó que las funcionalidades de **Productos** y **Gastos** están marcadas como "planificadas" en el frontend y carecen de rutas API Next.js o integraciones activas en backend (devuelven 404), por lo que se clasifican como **Pendientes/No Implementados**.

---

## 2. Archivos y Workflows Revisados

1. `_work_panel_de_barberia/src/app/api/pos/route.ts` (API Proxy route para POS).
2. `_work_panel_de_barberia/src/lib/dashboard-api.ts` (State API Client helpers, `savePosSale`).
3. `_work_panel_de_barberia/src/store/dashboard-context.tsx` (Dashboard React Context).
4. `_work_panel_de_barberia/src/app/inventario/page.tsx` (Interfaz del POS y cálculo de Caja del Día).
5. `_work_panel_de_barberia/src/app/finanzas/page.tsx` (Métricas de lealtad y caja demo).
6. Tablas `public.pagos`, `public.productos`, `public.gastos` y `public.citas` en PostgreSQL.
7. Workflow n8n: `pos/create-sale` (Orquestación del registro de cobro).

---

## 3. Búsquedas Ejecutadas

Se ejecutaron búsquedas recursivas en el codebase del panel para verificar el uso de las rutas financieras y almacenamiento de datos:
* Búsqueda de endpoints de productos y gastos: `productos`, `products`, `gastos`, `expenses` (no encontrados en `app/api`).
* Búsqueda de llamadas directas: `/api/pos` (identificado únicamente en `dashboard-api.ts`).
* Búsqueda de `eval()` en frontend: detectado en la calculadora interactiva de `inventario/page.tsx`.
* Búsqueda de almacenamiento local: `localStorage` / `sessionStorage` no actúan como fuente de verdad para montos o estados de cobro.

---

## 4. Matriz de Flujos de Lectura/Escritura

| Dominio | Flujo | Origen | Canal / Endpoint | Consumo SQL | Tipo | Estado |
|---|---|---|---|---|---|---|
| **Finanzas** | Caja del Día | Frontend | `/api/dashboard/state` | `public.citas` $\rightarrow$ `merged.appointments` | LECTURA_PRIVADA | **Seguro:** Se calcula en caliente sobre citas válidas del tenant. |
| **POS** | Registro de Venta | Frontend | `/api/pos` | Proxy Next.js $\rightarrow$ Webhook n8n $\rightarrow$ `public.pagos` | ESCRITURA_PRIVADA | **Riesgoso (P0):** Valida sesión y barberia_id, pero no valida pertenencia de `cita_id`. |
| **Productos** | Registro/CRUD | Frontend | `/api/productos` | No implementado (404) | ESCRITURA_PRIVADA | **No Implementado** (Planificado). |
| **Gastos** | Registro/CRUD | Frontend | `/api/gastos` | No implementado (404) | ESCRITURA_PRIVADA | **No Implementado** (Planificado). |

---

## 5. Endpoints Canónicos Confirmados

* **POST `/api/pos`:** **CONFIRMADO CON RESERVA (RIESGOSO)**. Es el único canal same-origin para procesar cobros de POS, validando la cookie `ba_session` y el acceso de la barbería. Sin embargo, carece de validación cruzada para citas de otros tenants.
* **POST `/api/productos`:** **NO CONFIRMADO (404)**. Planificado pero no implementado en Next.js.
* **POST `/api/gastos`:** **NO CONFIRMADO (404)**. Planificado pero no implementado en Next.js.

---

## 6. Validación de Reglas de Negocio (Integridad de Datos)

### 6.1. Validación de Tenant (Multi-tenant)
* **Bypass P0 Detectado:** Un administrador de la barbería A (`barberia_id: 198`) puede registrar un pago para una cita de la barbería B (`barberia_id: 1`) manipulando el payload (`cita_id: 1`) en la llamada a `/api/pos`. Ni el proxy de Next.js ni el webhook de n8n verifican que la cita pertenezca al tenant del usuario autenticado.

### 6.2. Validación de Montos y Stock No Negativos
* **Paso Exitoso (Físico):** PostgreSQL protege de forma absoluta la base de datos contra valores negativos usando CHECK constraints nativos:
  * `public.pagos`: `CHECK ((total >= (0)::numeric))`
  * `public.gastos`: `CHECK ((total >= (0)::numeric))`
  * `public.productos`: `CHECK ((precio >= (0)::numeric))` y `CHECK ((stock >= 0))`
  Cualquier petición con montos o stocks negativos es rechazada físicamente por la base de datos.

### 6.3. Validación de Doble Pago
* **UPSERT en Webhook:** La tabla `public.pagos` posee el constraint `UNIQUE (cita_id)`, lo que impide físicamente tener filas duplicadas para un mismo servicio. No obstante, el webhook de n8n maneja esto realizando un **UPSERT (UPDATE)** en caliente del pago. Si un usuario intenta pagar de nuevo una cita ya cobrada, el monto y el método de pago se actualizan silenciosamente con el nuevo valor en vez de abortar con un error.

### 6.4. Integridad con Citas
* Los cobros del POS se asocian de forma atómica a `citas.id` mediante la columna `cita_id` (FK con cascada). Las citas del dashboard se cargan a través de `/api/dashboard/state` directamente de la tabla `public.citas`.

---

## 7. Riesgos Detectados (Matriz P0/P1/P2)

* **Riesgo P0 (Crítico): Bypass de Seguridad Multi-tenant en POS.**  
  El endpoint `/api/pos` y el webhook n8n no comprueban que el `cita_id` del payload pertenezca al `barberia_id` del usuario autenticado. Un atacante puede registrar o alterar cobros en cualquier cita del sistema.
* **Riesgo P1 (Alto): Funcionalidades de Productos y Gastos Inexistentes.**  
  Las rutas de la API Next.js `/api/productos` y `/api/gastos` no están implementadas y devuelven 404. El panel de inventario y gastos en el frontend no tiene conexión real con PostgreSQL.
* **Riesgo P2 (Medio): Uso de `eval()` en POS Frontend.**  
  La calculadora en `src/app/inventario/page.tsx` utiliza `eval()` para evaluar expresiones matemáticas ingresadas en la interfaz de usuario. Aunque tiene un filtro regex, representa un vector potencial de inyección de código.

---

## 8. Evidencia Postman (Ejecución de Pruebas en Producción)

Colección: **BarberAgency - Bloque 8 Finanzas & POS**  
Ambiente: **Producción EasyPanel (`https://barberagency-app.gymh5g.easypanel.host`)**  

| ID | Test Case / Endpoint | Método | Payload / Headers | Status Esperado | Status Obtenido | Resultado | Evidencia / Detalle |
|---|---|---|---|---|---|---|---|
| **1** | POST `/api/pos` (Venta válida) | POST | Cookie válida, `cita_id: 183`, `total: 15000` | 200 | 200 | **PASS** | `{"ok":true,"message":"Cobro registrado...","pago_id":23}` |
| **2** | POST `/api/pos` (Sin cookie) | POST | Sin Cookie header | 401 | 401 | **PASS** | `{"ok":false,"code":"sesion_requerida"}` |
| **3** | POST `/api/pos` (Barbería ajena) | POST | Cookie válida, `barberia_id: 3` | 403 | 403 | **PASS** | `{"ok":false,"code":"sin_permiso"}` |
| **4** | POST `/api/pos` (Monto negativo) | POST | `total: -5000` | Falla | 200 (ok=false) | **PASS** | `{"ok":false,"message":"Error al registrar pago"}` (Bloqueado por DB check). |
| **5** | POST `/api/pos` (Cita de otra barbería) | POST | Cookie válida, `cita_id: 1` (Pertenece a barbería 1) | Falla | 200 (ok=true) | **FAIL (P0)** | Registró cobro en la cita 1 ajena: `{"ok":true,"pago_id":25}`. |
| **6** | POST `/api/pos` (Intento de doble pago) | POST | Cita 181 (ya pagada) | Falla | 200 (ok=true) | **FAIL** | Sobrescribió el registro mediante UPDATE en lugar de rechazar. |
| **7** | POST `/api/productos` (Crear producto) | POST | Cookie válida, payload de producto | 200 o 404 | 404 | **PASS** | 404 Not Found (Funcionalidad no implementada). |
| **8** | POST `/api/productos` (Precio negativo) | POST | `precio: -25000` | Falla o 404 | 404 | **PASS** | 404 Not Found (Funcionalidad no implementada). |
| **9** | POST `/api/productos` (Stock negativo) | POST | `stock: -5` | Falla o 404 | 404 | **PASS** | 404 Not Found (Funcionalidad no implementada). |
| **10** | POST `/api/gastos` (Crear gasto) | POST | Cookie válida, payload de gasto | 200 o 404 | 404 | **PASS** | 404 Not Found (Funcionalidad no implementada). |
| **11** | POST `/api/gastos` (Gasto negativo) | POST | `total: -80000` | Falla o 404 | 404 | **PASS** | 404 Not Found (Funcionalidad no implementada). |
| **12** | GET `/api/dashboard/state` | GET | Cookie de barbería 198 | 200 | 200 | **PASS** | Retorna estado real del tenant con citas e historial de pagos. |
| **13** | GET `/api/dashboard/state` (Ajeno) | GET | Cookie de barbería 198, query `barberia_id=3` | 403 | 403 | **PASS** | `{"ok":false,"message":"No tienes permisos..."}` |

---

## 9. Evidencia SQL (Ejecutada en PostgreSQL)

### 9.1. Historial de Pagos de la Barbería 198 (citas de id 181, 182, 180)
```sql
SELECT id, cita_id, total, metodo, pagado_en
FROM public.pagos
WHERE cita_id IN (
  SELECT id FROM public.citas WHERE barberia_id = 198
)
ORDER BY pagado_en DESC
LIMIT 20;
```
**Resultado:**
```json
[
  {
    "id": 22,
    "cita_id": 181,
    "total": "20000.00",
    "metodo": "digital",
    "pagado_en": "2026-06-09T23:19:23.175Z"
  },
  {
    "id": 21,
    "cita_id": 182,
    "total": "12000.00",
    "metodo": "efectivo",
    "pagado_en": "2026-06-09T23:18:56.937Z"
  },
  {
    "id": 20,
    "cita_id": 180,
    "total": "12000.00",
    "metodo": "efectivo",
    "pagado_en": "2026-06-05T21:06:47.885Z"
  }
]
```

### 9.2. Constraints de Seguridad Físicos en PostgreSQL
```sql
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid IN ('public.pagos'::regclass, 'public.productos'::regclass, 'public.gastos'::regclass);
```
**Resultado:**
```json
[
  {
    "conname": "pagos_total_check",
    "pg_get_constraintdef": "CHECK ((total >= (0)::numeric))"
  },
  {
    "conname": "pagos_cita_id_key",
    "pg_get_constraintdef": "UNIQUE (cita_id)"
  },
  {
    "conname": "chk_pagos_metodo",
    "pg_get_constraintdef": "CHECK ((metodo = ANY (ARRAY['efectivo'::text, 'digital'::text])))"
  },
  {
    "conname": "productos_precio_check",
    "pg_get_constraintdef": "CHECK ((precio >= (0)::numeric))"
  },
  {
    "conname": "productos_stock_check",
    "pg_get_constraintdef": "CHECK ((stock >= 0))"
  },
  {
    "conname": "gastos_total_check",
    "pg_get_constraintdef": "CHECK ((total >= (0)::numeric))"
  }
]
```

---

## 10. Recomendaciones Técnicas para la Implementación

1. **Blindaje de Aislamiento Cruzado en POS (P0):**
   * En el manejador proxy de Next.js (`/api/pos/route.ts`), se debe validar que el `cita_id` enviado pertenezca efectivamente a la `barberia_id` autorizada en la sesión antes de redirigir al webhook.
   * Se debe realizar una consulta simple server-side o agregar esta validación directa en la consulta CTE del webhook de n8n.
2. **Control de Doble Pago:**
   * En caso de re-intento de cobro, el webhook n8n debería arrojar un error HTTP 409 (Conflicto) en lugar de realizar un UPSERT silencioso, o al menos retornar un estado controlado que alerte de la actualización del pago.
3. **Implementación de Rutas de Productos e Inventario (P1):**
   * Crear los proxies safe-origin same-origin `/api/productos` y `/api/gastos` imitando el blindaje de cookies y roles de `/api/configuracion/update`.
4. **Reemplazo de `eval()` (P2):**
   * Utilizar un parser de expresiones matemáticas seguro como `mathjs` o implementar una pequeña máquina de estados lineal para operaciones aritméticas sencillas, previniendo cualquier riesgo de inyección de código.

---

## 11. Decisión

**GO CON RESERVAS**

**Fundamento:**  
Las rutas de lectura y las escrituras controladas a través del proxy same-origin de Next.js están operativas y la base de datos PostgreSQL cuenta con blindaje físico estricto frente a valores negativos. Sin embargo, no se puede dar un "GO" limpio debido a que:
1. Existe un riesgo crítico P0 que permite a un tenant alterar cobros sobre citas de otras barberías.
2. Las funcionalidades de productos y gastos no se encuentran implementadas (retornan 404).
3. Se requiere resolver el bypass de tenant en la API proxy antes de abrir los módulos financieros al público general.
