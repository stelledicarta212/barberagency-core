# 📝 Evidencia de Pruebas de Persistencia de Servicios (Paso 5)

**Fecha de Ejecución:** 2026-06-04T23:33:27.730Z
**Validador:** Antigravity (AI Agent)

## 📊 Tabla de Resultados

| Caso de Prueba | Estado Esperado | Estado Obtenido | Resultado |
| :--- | :--- | :--- | :--- |
| Test 1: Sin Cookie | 401 | 401 | ✅ APTO |
| Test 2: Barberia Ajena (Forbidden) | 403 | 403 | ✅ APTO |
| Test 3: Crear Servicio | 200 | 200 | ✅ APTO |
| Test 4: Verificar en Postgres (Creación) | Record found matching inputs | Found | ✅ APTO |
| Test 5: Editar Servicio | 200 | 200 | ✅ APTO |
| Test 6: Verificar en Postgres (Edición) | Updated values matches | Found | ✅ APTO |
| Test 7: Eliminar Servicio (Soft Delete) | 200 | 200 | ✅ APTO |
| Test 8: Verificar en Postgres (Soft Delete) | activo = false | activo = false | ✅ APTO |

## 🛠/⚙️ Detalles de Registros en PostgreSQL

### Registro Creado (Test 4)
```json
{
  "id": 494,
  "barberia_id": 1,
  "nombre": "Test-Servicio-Nuevo",
  "precio": "45.00",
  "duracion_min": 40,
  "activo": true
}
```

### Registro Modificado (Test 6)
```json
{
  "id": 494,
  "barberia_id": 1,
  "nombre": "Test-Servicio-Modificado",
  "precio": "55.00",
  "duracion_min": 45,
  "activo": true
}
```

### Registro Desactivado Lógicamente (Test 8)
```json
{
  "id": 494,
  "barberia_id": 1,
  "nombre": "Test-Servicio-Modificado",
  "precio": "55.00",
  "duracion_min": 45,
  "activo": false
}
```


**Conclusión:** Todos los bloqueadores de seguridad, verificación de cookie, comprobación de pertenencia de barbería y eliminación lógica (soft delete) han sido validados con éxito. El backend de n8n y Postgres actúan como la única fuente de verdad y rechazan peticiones no autorizadas.