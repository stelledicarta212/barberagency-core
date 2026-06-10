# P0 Fuente de Verdad — Bloque 8 Corrección POS y Pagos Multi-tenant

**Fecha:** 2026-06-10  
**Implementador:** Antigravity — Implementador Senior Controlado  
**Estado:** `P0 CORREGIDO`  

---

## 1. Resumen del P0
Se detectó un riesgo crítico de seguridad **P0** en el módulo de finanzas/punto de venta (POS) y cobros. Un usuario administrador autenticado en una barbería A (`barberia_id: 198`) podía registrar o modificar cobros en la tabla `public.pagos` para una cita perteneciente a una barbería B (`barberia_id: 1`) enviando dicho `cita_id` en el payload de `/api/pos`. Ni el proxy de Next.js ni el webhook de n8n validaban la pertenencia de la cita al tenant que realizaba la solicitud.

---

## 2. Causa Raíz
1. **Proxy Next.js (`/api/pos`):** El proxy verificaba la sesión `ba_session` y validaba que el usuario tuviera acceso a la `barberia_id` enviada, pero delegaba a ciegas el `cita_id` sin corroborar si la cita pertenecía a esa barbería.
2. **Webhook n8n (`pos/create-sale`):** El nodo de actualización de base de datos realizaba un `INSERT ... ON CONFLICT (cita_id) DO UPDATE` en caliente sin ejecutar previamente una comprobación del tenant (`barberia_id`) de la cita.

---

## 3. Confirmación de Solución Genérica y Multi-tenant
La solución implementada es **100% genérica** y no tiene parámetros, ids de citas ni usuarios hardcodeados. Se validó su robustez de la siguiente manera:
1. **En Next.js (`route.ts`):** Al recibir una solicitud, el proxy consulta el estado del tenant en caliente `/api/dashboard/state` usando las credenciales del usuario. Extrae el listado de citas válidas del tenant (`stateData.reservas`) y verifica mediante búsqueda lineal que el `cita_id` del payload esté en esa lista. Si no está, rechaza la operación con `403 Forbidden` (`cita_ajena`) y no envía la solicitud a n8n.
2. **En n8n (`pos_workflow.json`):** Antes de la sentencia `INSERT/UPDATE` en el nodo `postgres-insert-existing-sale`, se agregó un bloque de validación física PL/pgSQL:
   ```sql
   DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM public.citas 
       WHERE id = {{ Number($('Webhook - POS Sale').item.json.body.cita_id) }}
         AND barberia_id = {{ Number($('Webhook - POS Sale').item.json.body.barberia_id) }}
         AND estado IN ('confirmada', 'pendiente')
     ) THEN
       RAISE EXCEPTION 'La cita no existe o pertenece a otra barberia.';
     END IF;
   END $$;
   ```
   Si la cita no existe o pertenece a otra barbería, se arroja una excepción en base de datos, abortando la transacción y respondiendo un error HTTP controlado.

---

## 4. Confirmación de No Hardcoding
Se confirma de forma absoluta que **NO** se hardcodearon filtros para:
- `barberia_id = 198`
- `user_id = 7`
- `user_id = 6`
- Citas específicas (`cita_id = 183` o `cita_id = 1`).
Todas las validaciones consultan el estado y permisos dinámicamente basándose en la cookie `ba_session` y el payload enviado en tiempo de ejecución.

---

## 5. Archivos Modificados
### Panel (`_work_panel_de_barberia/`):
* [route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/pos/route.ts): Agrega validación del monto negativo (`monto_total < 0` $\rightarrow$ 400 `monto_negativo`) y comprobación de pertenencia del `cita_id` contra `stateData.reservas` ($\rightarrow$ 403 `cita_ajena`).
* [page.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/inventario/page.tsx): Reemplaza `eval()` por un parser matemático seguro (`safeEvaluate`) para evitar riesgos de inyección de código.

### Core:
* `ContextoGeneral/daily/2026-06-10_P0_Bloque8_Correccion_POS_Pagos.md` (Este reporte).

---

## 6. Workflow n8n Modificado y Backup
* **Workflow Modificado:** `BarberAgency - Registrar Venta POS` (ID: `NmWr6GFc8jZtCjXe`).
* **Archivo de Producción:** [pos_workflow.json](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/pos_workflow.json) actualizado y desplegado de manera automática en el servidor de n8n.
* **Copia de Respaldo:** `scratch/pos_workflow_live.json`.

---

## 7. SQL Antes / Después
Evidencia física ejecutada en la base de datos PostgreSQL:

### Consultar Citas (Propia: 183, Ajena: 1)
```sql
SELECT id, barberia_id, fecha, hora_inicio, estado
FROM public.citas
WHERE id IN (183, 1);
```
**Resultado:**
```json
[
  {
    "id": 1,
    "barberia_id": 1,
    "fecha": "2026-02-20T00:00:00.000Z",
    "hora_inicio": "10:00:00",
    "estado": "cancelada"
  },
  {
    "id": 183,
    "barberia_id": 198,
    "fecha": "2026-06-12T00:00:00.000Z",
    "hora_inicio": "08:00:00",
    "estado": "confirmada"
  }
]
```

### Consultar Pagos Asociados
```sql
SELECT id, cita_id, total, metodo, pagado_en
FROM public.pagos
WHERE cita_id IN (183, 1)
ORDER BY pagado_en DESC;
```
**Resultado:**
```json
[
  {
    "id": 29,
    "cita_id": 183,
    "total": "25000.00",
    "metodo": "digital",
    "pagado_en": "2026-06-10T18:46:08.537Z"
  }
]
```
*(Nota: No existe fila de pago para la cita ajena `1` tras el intento de hackeo).*

### Consultar Pagos con Monto Negativo
```sql
SELECT id, cita_id, total, metodo
FROM public.pagos
WHERE total < 0;
```
**Resultado:**
`0 filas devueltas.`

---

## 8. Evidencia Postman / HTTP Local
Se corrió la suite completa de pruebas locales sobre el proxy Next.js (`http://localhost:3100`) y la base de datos de n8n:

1. **POST `/api/pos` (Cita propia válida):**
   * **Status:** 200 OK
   * **Respuesta:** `{"ok":true,"message":"Cobro registrado correctamente","pago_id":29,"cita_id":183,"total":15000,"metodo":"efectivo"}`
2. **POST `/api/pos` (Sin cookie):**
   * **Status:** 401 Unauthorized
   * **Respuesta:** `{"ok":false,"code":"sesion_requerida","message":"Sesion requerida..."}`
3. **POST `/api/pos` (Barbería ajena):**
   * **Status:** 403 Forbidden
   * **Respuesta:** `{"ok":false,"code":"sin_permiso","message":"No tienes permisos..."}`
4. **POST `/api/pos` (Cita de otra barbería):**
   * **Status:** 403 Forbidden
   * **Respuesta:** `{"ok":false,"code":"cita_ajena","message":"La cita no pertenece a esta barbería."}`
5. **POST `/api/pos` (Monto negativo):**
   * **Status:** 400 Bad Request
   * **Respuesta:** `{"ok":false,"code":"monto_negativo","message":"No se permiten montos negativos."}`
6. **POST `/api/pos` (Doble pago - controlled update):**
   * **Status:** 200 OK
   * **Respuesta:** `{"ok":true,"message":"Cobro registrado correctamente","pago_id":29,"cita_id":183,"total":25000,"metodo":"digital"}`
7. **GET `/api/dashboard/state` (Reflejo del pago actualizado):**
   * **Status:** 200 OK
   * **Resultado:** `total_pagado: 25000`, `metodo_pago: "digital"` en la cita 183.

---

## 9. Evidencia de Aislamiento Cruzado
* **Cita Ajena (`cita_id: 1`):** El intento de pagar la cita `1` de la barbería `1` enviando `barberia_id: 198` fue abortado inmediatamente por el proxy Next.js con **HTTP 403 Forbidden (`cita_ajena`)**.
* **Integridad Física:** Ningún registro de cobro fue creado o modificado en la tabla `public.pagos` para la cita `1`.

---

## 10. Compilación y Linter (Panel)
* **npx tsc --noEmit:** `PASS` (0 errores de tipos).
* **npm run lint:** `PASS` (0 errores, warnings heredados ignorados).
* **npm run build:** `PASS` (Compilación exitosa en 3.5s).

---

## 11. Corrección de `eval()` (Riesgo P2)
El uso inseguro de `eval()` en la calculadora de POS (`src/app/inventario/page.tsx`) fue **corregido**. Se implementó una función `safeEvaluate(expr)` que analiza recursivamente sumas, restas, multiplicaciones, divisiones y paréntesis de forma segura e incremental:
- No utiliza `eval()` ni `Function()`.
- Lanza excepciones controladas en caso de división por cero o sintaxis inválida.
- Valida que la entrada conste exclusivamente de caracteres matemáticos.

---

## 12. Decisión Final
**P0 CORREGIDO** (El flujo financiero de cobro es ahora seguro y multi-tenant, y la calculadora de POS es inmune a inyecciones de código).
