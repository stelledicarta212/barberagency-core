# SYSTEM RULES - BarberAgency

## 🔒 Reglas Inmutables

1. AUTENTICACIÓN
- NO modificar el sistema de autenticación existente.
- Se usa Google Identity Services + n8n + JWT en cookie `ba_session`.
- NO cambiar cookies, endpoints `/session/me` ni flujos de login.

2. MULTI-TENANT
- TODAS las operaciones deben estar aisladas por `barberia_id`.
- NUNCA acceder a datos de otra barbería.
- SIEMPRE validar tenant mediante RLS.

3. BASE DE DATOS
- NO eliminar columnas o tablas existentes sin justificación.
- NO romper relaciones FK.
- RESPETAR triggers existentes (especialmente en `citas`).
- RESPETAR soft delete (`deleted_at`).

4. CITAS (CRÍTICO)
- NO permitir solapamientos (constraint EXCLUDE).
- RESPETAR `slot_min` de cada barbería.
- VALIDAR horarios (`horarios`).
- `hora_fin` SIEMPRE se calcula automáticamente.

5. POSTGREST
- NO crear lógica fuera de la base de datos si ya existe en SQL.
- Usar endpoints REST generados automáticamente.

6. N8N
- Mantener estructura de webhooks existente.
- Respuestas estándar:
  - 201 → éxito
  - 409 → conflicto (choque de horario)
  - 400 → error de validación

7. SEGURIDAD
- RLS SIEMPRE activado y respetado.
- NO bypass de seguridad.
- NO exponer datos sensibles.

---

## ⚠️ Regla General

Si una acción rompe:
- multi-tenant
- RLS
- citas
- auth

👉 NO se debe ejecutar.