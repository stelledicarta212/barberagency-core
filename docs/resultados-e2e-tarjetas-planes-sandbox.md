# Reporte de Resultados: E2E Tarjetas de Planes (Mercado Pago Sandbox)

Este reporte detalla los resultados de las comprobaciones de facturación para los 4 planes COP configurados en el catálogo de suscripciones de **BarberAgency**.

---

## 1. Verificación de Tarifa por Tipo de Tarjeta

Se comprobó en el catálogo comercial de la base de datos de Staging (`public.plan_prices`) que los códigos de plan e intervalos de facturación se resuelven a los montos y monedas exactos estipulados para evitar fraude:

### A. Tarjeta Plan Mensual (`monthly`)
*   **Parámetros URL:** `/registro?plan=barberagency_full&term=monthly`
*   **Monto Esperado:** **50.000 COP**
*   **Consulta SQL de Verificación:**
    ```sql
    SELECT amount, currency FROM public.plan_prices 
    WHERE plan_id = (SELECT id FROM public.planes WHERE code = 'barberagency_full') 
      AND name = 'monthly' AND active = true;
    ```
*   **Resultado en DB:** `amount = 50000.00`, `currency = 'COP'`.
*   **Estado:** **PASADO (SERVER-SIDE)**.

### B. Tarjeta Plan Trimestral (`quarterly`)
*   **Parámetros URL:** `/registro?plan=barberagency_full&term=quarterly`
*   **Monto Esperado:** **142.500 COP**
*   **Consulta SQL de Verificación:**
    ```sql
    SELECT amount, currency FROM public.plan_prices 
    WHERE plan_id = (SELECT id FROM public.planes WHERE code = 'barberagency_full') 
      AND name = 'quarterly' AND active = true;
    ```
*   **Resultado en DB:** `amount = 142500.00`, `currency = 'COP'`.
*   **Estado:** **PASADO (SERVER-SIDE)**.

### C. Tarjeta Plan Semestral (`semiannual`)
*   **Parámetros URL:** `/registro?plan=barberagency_full&term=semiannual`
*   **Monto Esperado:** **270.000 COP**
*   **Consulta SQL de Verificación:**
    ```sql
    SELECT amount, currency FROM public.plan_prices 
    WHERE plan_id = (SELECT id FROM public.planes WHERE code = 'barberagency_full') 
      AND name = 'semiannual' AND active = true;
    ```
*   **Resultado en DB:** `amount = 270000.00`, `currency = 'COP'`.
*   **Estado:** **PASADO (SERVER-SIDE)**.

### D. Tarjeta Plan Anual (`annual`)
*   **Parámetros URL:** `/registro?plan=barberagency_full&term=annual`
*   **Monto Esperado:** **510.000 COP**
*   **Consulta SQL de Verificación:**
    ```sql
    SELECT amount, currency FROM public.plan_prices 
    WHERE plan_id = (SELECT id FROM public.planes WHERE code = 'barberagency_full') 
      AND name = 'annual' AND active = true;
    ```
*   **Resultado en DB:** `amount = 510000.00`, `currency = 'COP'`.
*   **Estado:** **PASADO (SERVER-SIDE)**.

---

## 2. Diagnóstico del Estado E2E de la Integración

*   **WordPress Plan Links:** **VÁLIDOS**. Las URL redireccionan al usuario con los parámetros de consulta requeridos.
*   **Lectura de Registro:** **FALLIDO (NO IMPLEMENTADO)**. El formulario `/registro` no captura ni preserva los parámetros en su estado de wizard ni payload.
*   **Resolución de Precios Servidor:** **CORRECTO**. Los montos no se envían desde el cliente, sino que se resuelven exclusivamente mediante el ID de precio (`plan_price_id`) contra la base de datos en el RPC `billing_create_checkout`.
