# 📝 Evidencia de Pruebas de Persistencia de Citas (Paso 6)

**Fecha de Ejecución:** 2026-06-05T00:02:04.955Z
**Validador:** Antigravity (AI Agent)

## 📊 Tabla de Resultados

| Caso de Prueba | Estado Esperado | Estado Obtenido | Resultado |
| :--- | :--- | :--- | :--- |
| Test 1: Sin Cookie | 401 | 401 | ✅ APTO |
| Test 2: Barberia Ajena (Forbidden) | 403 | 403 | ✅ APTO |
| Test 3: Crear Cita Válida | 200 | 200 | ✅ APTO |
| Test 4: Verificar en Postgres (Creación) | Cita and upserted client found | Found | ✅ APTO |
| Test 5: Crear Cita con Barbero Ajeno | 400 | 400 | ✅ APTO |
| Test 6: Crear Cita con Servicio Ajeno | 400 | 400 | ✅ APTO |
| Test 7: Crear Cita Solapada | 400 | 400 | ✅ APTO |
| Test 8: Cancelar Cita (Soft Delete) | 200 | 200 | ✅ APTO |
| Test 9: Verificar en Postgres (Cancelación) | estado = cancelada | estado = cancelada | ✅ APTO |
| Test 10: Slot Cancelado Queda Libre | 200 | 200 | ✅ APTO |
| Test 11: Editar Cita | 200 | 200 | ✅ APTO |
| Test 12: Verificar en Postgres (Edición) | hora_inicio = 11:00 and name modified | Found (11:00:00, name: Test-Cita-Cliente-Modificado) | ✅ APTO |

## 🛠/⚙️ Detalles de Registros en PostgreSQL

### Registro Creado (Test 4)
```json
Cita: {
  "id": 165,
  "barberia_id": 1,
  "barbero_id": 2,
  "servicio_id": 1,
  "cliente_id": 132,
  "cliente_nombre": "Test-Cita-Cliente",
  "cliente_tel": "3009876543",
  "fecha": "2026-06-08T00:00:00.000Z",
  "hora_inicio": "10:00:00",
  "hora_fin": "10:30:00",
  "estado": "confirmada"
}
Cliente: {
  "id": 132,
  "barberia_id": 1,
  "nombre": "Test-Cita-Cliente",
  "telefono": "3009876543"
}
```

### Registro Cancelado Lógicamente (Test 9)
```json
{
  "id": 165,
  "estado": "cancelada"
}
```

### Registro Modificado (Test 12)
```json
{
  "id": 167,
  "hora_inicio": "11:00:00",
  "cliente_nombre": "Test-Cita-Cliente-Modificado"
}
```


**Conclusión:** Todos los bloqueadores de seguridad, verificación de cookie, comprobación de pertenencia de barbería, restricciones de solape y horarios relacionales, y borrado lógico de citas (estado = 'cancelada') han sido validados con éxito en PostgreSQL y expuestos de forma segura en n8n y el panel.