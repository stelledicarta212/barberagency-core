# RC-2 - Mitigacion productiva reservas publicas

Fecha: 2026-06-05

## Diagnostico cerrado

Se corrigio en produccion la debilidad detectada en RC-2: los endpoints publicos de reservas ya no dependen de reglas duplicadas en n8n para validar pertenencia multi-tenant, horario, descansos, `slot_min`, duracion y solapes.

La autoridad queda en PostgreSQL mediante RPCs `SECURITY DEFINER`:

- `public.ba_reservas_public_slots(...)`
- `public.ba_reservas_public_create(...)`

Los workflows n8n productivos ahora solo normalizan entrada, llaman la RPC y devuelven JSON tipado. Tambien tienen `continueOnFail` en los nodos PostgreSQL para que un error de base de datos no vuelva a producir `200` vacio; en ese caso devuelven `ok=false`, `code=error_postgres` y HTTP 500.

## Cambios aplicados

- Migracion SQL: `app/database/migrations/2026-06-05_rc2_public_reservas_rpc.sql`
- Workflow slots: `pruebas/reservas_slots_workflow.json`
- Workflow create: `pruebas/reservas_save_workflow.json`
- Deploy SQL temporal: `scratch/deploy_rc2_public_reservas_sql_once_workflow.js`
- Patch workflows: `scratch/patch_rc2_public_reservas_workflows.js`
- Pruebas RC-2: `scratch/test_rc2_public_reservas.js`

## Contrato de respuesta

Todas las respuestas usan:

```json
{
  "ok": true,
  "code": "reserva_creada",
  "message": "Reserva creada correctamente.",
  "data": {}
}
```

Codigos validados:

- `datos_invalidos`
- `servicio_no_pertenece`
- `barbero_no_pertenece`
- `servicio_inactivo`
- `barbero_inactivo`
- `fuera_de_horario`
- `descanso_barbero`
- `slot_invalido`
- `slot_ocupado`
- `reserva_creada`

## Pruebas ejecutadas

Tenant QA usado: `barberia_id=185`, `slug=barberia-185`, `servicio_id=435`, `barbero_id=400`.

| Prueba | Resultado |
| --- | --- |
| slots con servicio propio | PASS - 200 `ok=true`, `count=51`, `slot_min=15`, `duracion_min=30` |
| slots con servicio ajeno | PASS - 400 `servicio_no_pertenece` |
| slots con barbero ajeno | PASS - 400 `barbero_no_pertenece` |
| create valido | PASS - 200 `reserva_creada`, `cita_id=175` |
| create con servicio ajeno | PASS - 400 `servicio_no_pertenece` |
| create con barbero ajeno | PASS - 400 `barbero_no_pertenece` |
| create fuera de horario | PASS - 400 `fuera_de_horario` |
| create en descanso | PASS - 400 `descanso_barbero` |
| create solapada | PASS - 400 `slot_ocupado` |
| create valido despues de cancelar slot | PASS - 200 `reserva_creada`, `cita_id=176` |
| create con datos incompletos | PASS - 400 `datos_invalidos` |
| evidencia SQL `public.citas` y `public.clientes_finales` | PASS |

## Evidencia SQL

Consulta ejecutada:

```sql
SELECT id, barberia_id, barbero_id, servicio_id, cliente_id, cliente_nombre, cliente_tel, fecha, hora_inicio, hora_fin, estado
FROM public.citas
WHERE barberia_id = 185
  AND cliente_tel LIKE '300RC2%'
ORDER BY id DESC;

SELECT id, barberia_id, nombre, telefono
FROM public.clientes_finales
WHERE barberia_id = 185
  AND telefono LIKE '300RC2%'
ORDER BY id DESC;
```

Resultado observado antes del cleanup final de la ultima corrida productiva:

```json
{
  "citas": [
    {
      "id": 176,
      "barberia_id": 185,
      "barbero_id": 400,
      "servicio_id": 435,
      "cliente_id": 142,
      "cliente_nombre": "RC2 QA Cliente",
      "cliente_tel": "300RC20007",
      "fecha": "2026-06-10",
      "hora_inicio": "08:00:00",
      "hora_fin": "08:30:00",
      "estado": "confirmada"
    },
    {
      "id": 175,
      "barberia_id": 185,
      "barbero_id": 400,
      "servicio_id": 435,
      "cliente_id": 141,
      "cliente_nombre": "RC2 QA Cliente",
      "cliente_tel": "300RC20001",
      "fecha": "2026-06-10",
      "hora_inicio": "08:00:00",
      "hora_fin": "08:30:00",
      "estado": "cancelada"
    }
  ],
  "clientes_finales": [
    {
      "id": 142,
      "barberia_id": 185,
      "nombre": "RC2 QA Cliente",
      "telefono": "300RC20007"
    },
    {
      "id": 141,
      "barberia_id": 185,
      "nombre": "RC2 QA Cliente",
      "telefono": "300RC20001"
    }
  ]
}
```

Cleanup final:

- Las citas creadas por la ultima prueba (`175`, `176`) fueron marcadas como `cancelada`.
- El descanso temporal usado para la prueba fue eliminado.

## Conclusion

RC-2 reservas publicas queda mitigado para produccion:

- No hay 200 vacio en casos cubiertos por la bateria.
- Los fallos del nodo PostgreSQL quedan cubiertos con respuesta JSON controlada.
- `slots` rechaza servicio/barbero ajeno.
- `create` inserta por RPC transaccional y responde errores tipados.
- Los solapes se bloquean por validacion previa y por la restriccion de PostgreSQL.

Pendiente recomendado post-produccion:

- Agregar monitoreo de errores n8n para detectar cualquier ejecucion `status=error`.
- Revisar si el endpoint debe devolver HTTP 409 para `slot_ocupado`; actualmente devuelve 400 tipado.
