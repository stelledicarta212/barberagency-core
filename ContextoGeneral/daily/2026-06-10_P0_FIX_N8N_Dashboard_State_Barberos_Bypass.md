# P0 FIX — Corrección de Bypass de Permisos en N8N Dashboard State

**Fecha:** 2026-06-10  
**Auditor:** Antigravity — Ingeniero Senior de Producción  
**Estado:** `P0 CORREGIDO`  

---

## 1. Resumen del P0 de Seguridad
Se identificó una vulnerabilidad crítica de escalación de privilegios y bypass multi-tenant en el workflow de n8n:  
`BarberAgency - Dashboard State Webhook`.

El usuario `user_id = 6` (registrado como barbero operativo con ID `439` en la `barberia_id = 198` pero sin ser propietario ni poseer una membresía en `barberia_miembros`) podía consultar y descargar todo el estado administrativo (finanzas, clientes, configuración de otros barberos) del tenant `198`. La causa raíz fue un bypass explícito en la consulta SQL de validación de sesión de n8n, que permitía el acceso si el usuario existía en la tabla `public.barberos`.

---

## 2. SQL Anterior (Vulnerable)
En el nodo `Postgres - session validate`, la CTE `barberia_check` contenía la siguiente condición vulnerable:

```sql
barberia_check AS (
  SELECT tb.id FROM target_barberia tb
  LEFT JOIN auth_check ac ON true
  WHERE (
    tb.owner_id = $1 OR
    EXISTS (
      SELECT 1 FROM public.barberia_miembros m 
      WHERE m.barberia_id = tb.id 
        AND (m.usuario_id = $1 OR lower(m.email) = lower(ac.email)) 
        AND m.activo = true
    ) OR
    EXISTS (SELECT 1 FROM public.barberos WHERE usuario_id = $1 AND barberia_id = tb.id) -- <-- BYPASS VULNERABLE
  )
  AND ($2::int IS NULL OR $2::int = 0 OR tb.slug IS NULL OR $3::text IS NULL OR tb.slug = $3::text)
  LIMIT 1
)
```

---

## 3. SQL Corregido (Parcheado)
Se eliminó la condición basada en `public.barberos`, garantizando que la autorización dependa estrictamente de la propiedad directa de la barbería (`owner_id`) o membresías activas en `barberia_miembros`:

```sql
barberia_check AS (
  SELECT tb.id FROM target_barberia tb
  LEFT JOIN auth_check ac ON true
  WHERE (
    tb.owner_id = $1 OR
    EXISTS (
      SELECT 1 FROM public.barberia_miembros m 
      WHERE m.barberia_id = tb.id 
        AND (m.usuario_id = $1 OR lower(m.email) = lower(ac.email)) 
        AND m.activo = true
    )
  )
  AND ($2::int IS NULL OR $2::int = 0 OR tb.slug IS NULL OR $3::text IS NULL OR tb.slug = $3::text)
  LIMIT 1
)
```

---

## 4. Evidencia de Exportación del Workflow
Antes de aplicar la modificación, se realizó una copia de respaldo completa de la estructura del workflow de n8n directamente desde su API de control de producción:

* **Nombre del archivo de respaldo (Tracked en Git):**  
  [6JugRzxsOGKBvgWW_backup.json](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/ContextoGeneral/daily/6JugRzxsOGKBvgWW_backup.json)

---

## 5. Evidencia de Pruebas de API (Postman / Producción)

Tras la activación del workflow corregido en n8n, se ejecutaron las validaciones de acceso:

1. **GET `/api/session/me` con cookie de `user_id=6`**
   * **Status Esperado:** `200` | **Obtenido:** `200` | **Resultado:** **PASS**
   * **Evidencia:** `{ "ok": true, "user_id": 6, "email": "carlosalbertoalvisrodriguez@gmail.com", ... }`
2. **GET `/api/dashboard/state?barberia_id=198` con cookie de `user_id=6`**
   * **Status Esperado:** `403` | **Obtenido:** `403` | **Resultado:** **PASS**
   * **Evidencia:** `{"ok":false,"message":"No tienes permisos para esta barberia o no existe"}`
3. **GET `/api/dashboard/state?barberia_id=198&slug=barberia-prueba-4` con cookie de `user_id=6`**
   * **Status Esperado:** `403` | **Obtenido:** `403` | **Resultado:** **PASS**
   * **Evidencia:** `{"ok":false,"message":"No tienes permisos para esta barberia o no existe"}`
4. **GET `/api/dashboard/state?barberia_id=198` con cookie del owner `user_id=7`**
   * **Status Esperado:** `200` | **Obtenido:** `200` | **Resultado:** **PASS**
   * **Evidencia:** `{ "ok": true, "merged": { "biz_name": "Barberia Prueba 4", ... } }`
5. **GET `/api/dashboard/state?barberia_id=198&slug=incorrect-slug` con cookie del owner `user_id=7`**
   * **Status Esperado:** `403` | **Obtenido:** `403` | **Resultado:** **PASS**
   * **Evidencia:** `{"ok":false,"message":"No tienes permisos para esta barberia o no existe"}`

---

## 6. Evidencia SQL (Verificación de Integridad)

Se comprobó que el usuario `user_id = 6` sigue existiendo de manera legítima como barbero operativo activo para dar soporte a la agenda de reservas del local `198`, pero sin poseer ninguna credencial administrativa:

```json
// SELECT id, barberia_id, usuario_id, nombre, activo FROM public.barberos WHERE barberia_id = 198 AND usuario_id = 6;
[
  {
    "id": 439,
    "barberia_id": 198,
    "usuario_id": 6,
    "nombre": "Barbero prueba 4",
    "activo": true
  }
]
```

---

## 7. Decisión Final

### **P0 CORREGIDO** ✅

El bypass de privilegios fue completamente removido. Las tablas `barberia_miembros` y `owner_id` actúan ahora como la única y estricta fuente de verdad para el acceso administrativo al panel, mientras que los barberos operativos pueden seguir existiendo sin privilegios de visualización del dashboard administrativo de producción.
