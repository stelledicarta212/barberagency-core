# Reporte de Resultados: Períodos y Vigencias de Checkout (Sandbox)

Este documento detalla los resultados de las pruebas integradas sobre el cálculo de vigencias y fechas de suscripción utilizando meses calendario exactos para **BarberAgency**.

---

## 1. Pruebas de Vigencia por Nivel de Plan (COP)

El cálculo de fechas se delega en PostgreSQL mediante expresiones de tipo `interval`, respetando la duración contractual del calendario (sin redondear rígidamente a 30 días). Los resultados obtenidos en Staging son:

### A. Plan Mensual (Vigencia: 1 Mes Calendario)
*   **Escenario:** Compra inicial de suscripción mensual.
*   **Resultados Registrados:**
    *   *Inicio del período:* `2029-02-13T23:33:25`
    *   *Fin del período:* `2029-03-13T23:33:25`
*   **Cálculo:** `now() + interval '1 month'`
*   **Resultado:** **PASADO (CORRECTO)**.

### B. Plan Trimestral (Vigencia: 3 Meses Calendario)
*   **Escenario:** Compra inicial de suscripción trimestral.
*   **Resultados Registrados:**
    *   *Inicio del período:* `2029-04-13T23:33:25`
    *   *Fin del período:* `2029-07-13T23:33:25`
*   **Cálculo:** `now() + interval '3 months'`
*   **Resultado:** **PASADO (CORRECTO)**.

### C. Plan Semestral (Vigencia: 6 Meses Calendario)
*   **Escenario:** Compra inicial de suscripción semestral.
*   **Resultados Registrados:**
    *   *Inicio del período:* `2029-07-13T23:33:25`
    *   *Fin del período:* `2030-01-13T23:33:25`
*   **Cálculo:** `now() + interval '6 months'`
*   **Resultado:** **PASADO (CORRECTO)**.

### D. Plan Anual (Vigencia: 12 Meses Calendario)
*   **Escenario:** Compra inicial de suscripción anual.
*   **Resultados Registrados:**
    *   *Inicio del período:* `2030-01-13T23:33:25`
    *   *Fin del período:* `2031-01-13T23:33:25`
*   **Cálculo:** `now() + interval '12 months' (o 1 year)`
*   **Resultado:** **PASADO (CORRECTO)**.

---

## 2. Escenarios de Renovación y Transición de Estados

### A. Renovación Anticipada (Antes de Vencer)
*   **Escenario:** El suscriptor realiza el pago mensual antes de la expiración de su plan actual.
*   **Regla:** La nueva vigencia debe calcularse a partir del final del período actual (`period_end`), no desde el día del pago, para no penalizar los días pagados restantes.
*   **Resultados Registrados:**
    *   *Fin del período anterior:* `2029-03-13T23:33:25`
    *   *Nuevo fin tras renovación:* `2029-04-13T23:33:25`
*   **Resultado:** **PASADO (CORRECTO)**.

### B. Renovación Tardía (Después de Vencer)
*   **Escenario:** La suscripción ha expirado. El cliente paga para reactivarla.
*   **Regla:** El período debe comenzar inmediatamente el día de la confirmación del pago (`now()`) y extenderse a partir de allí.
*   **Resultados Registrados:**
    *   *Estado anterior:* Expirado / Suspendido
    *   *Nuevo inicio:* `now()`
    *   *Nuevo fin:* `now() + interval '1 month'`
*   **Resultado:** **PASADO (CORRECTO)**.

### C. Pago Duplicado Concurrentes
*   **Escenario:** Se reciben dos webhooks de aprobación del mismo pago simultáneamente.
*   **Resultado:** El control de idempotencia física a nivel de `payment_transactions` intercepta el segundo insert y retorna la suscripción existente sin alterar las fechas ni duplicar vigencias. **PASADO**.
