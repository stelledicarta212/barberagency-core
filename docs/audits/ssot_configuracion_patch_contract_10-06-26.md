# SSOT Configuracion mode=edit - Contrato PATCH

Fecha: 2026-06-10

## Diagnostico

La causa raiz era arquitectonica: `mode=edit` reutilizaba payloads completos de onboarding (`draft`, `barberia`, `servicios`, `barberos`, `horarios`, `accesos`). Ese contrato permite que valores incompletos o vacios del frontend sobrescriban PostgreSQL.

Regla corregida:

- PostgreSQL es la fuente de verdad.
- `dashboard/state` es el contrato oficial de lectura.
- El frontend solo envia intencion de cambio.
- Toda mutacion de Configuracion usa PATCH explicito y merge server-side.
- Payload completo de onboarding en `mode=edit` se rechaza con `400 contrato_invalido`.

## Contrato oficial

```json
{
  "mode": "edit",
  "barberia_id": "<BARBERIA_ID>",
  "slug": "<SLUG_VALIDADO>",
  "patch": {
    "telefono": "3106974573"
  },
  "collections_patch": {
    "servicios": {
      "upsert": [],
      "deactivate": []
    },
    "barberos": {
      "upsert": [],
      "deactivate": []
    },
    "horarios": {
      "upsert": []
    }
  }
}
```

## Campos permitidos

`patch` permite:

- `nombre`
- `telefono`
- `whatsapp`
- `email_contacto`
- `direccion`
- `ciudad`
- `instagram`
- `tiktok`
- `politicas`
- `logo_url`
- `cover_url`
- `moneda`
- `acepta_efectivo`
- `acepta_digital`
- `timezone`
- `slot_min`

Nota: `timezone` queda aceptado por contrato, pero no se persiste mientras no exista columna en `public.barberias`.

## Campos prohibidos

Se rechazan:

- `id`
- `owner_id`
- `created_at`
- `deleted_at`
- `estado`
- `role`
- `admin`
- `password`
- `miembros`
- `accesos`
- `usuarios`
- payloads legacy con `draft`, `barberia`, `servicios`, `barberos` u `horarios` raiz.

## Colecciones

Servicios:

- `upsert` explicito por `id` o `nombre`.
- `deactivate` explicito.
- Arrays vacios no borran ni desactivan.

Barberos:

- `upsert` solo datos operativos: `id`, `nombre`, `activo`, `foto_url`.
- Prohibido `email`, `password`, `usuario_id`, accesos o roles.
- `deactivate` explicito.
- Barberos existentes conservan email/password.

Horarios:

- `upsert` explicito por `dia_semana`.
- El backend garantiza 7 dias.
- Arrays vacios no borran horarios.

## Implementacion

- Panel Next: `POST /api/configuracion/update` valida contrato PATCH, lee cookie `ba_session` same-origin y reenvia a n8n server-side.
- n8n: `/webhook/barberagency/configuracion/update` autentica JWT y llama RPC.
- PostgreSQL: `public.ba_configuracion_update_patch(p_user_id integer, p_auth_ok boolean, p_payload jsonb)` valida contrato, permisos y hace merge transaccional.

## Evidencia de pruebas

El contrato es global para cualquier barberia autorizada. La barberia `198` (`barberia-prueba-4`) se uso solo como tenant QA para evidencia de produccion; no existe hardcode de ese ID en RPC, n8n ni proxy.

Pruebas HTTP contra produccion QA `barberia_id=198`, `slug=barberia-prueba-4`:

- Sin cookie: `401 sesion_no_valida`.
- Usuario sin acceso: `403 sin_permiso`.
- Payload viejo onboarding: `400 contrato_invalido`.
- Patch vacio: `200 configuracion_actualizada`.
- Cambiar solo telefono: `200`, solo telefono cambia.
- Cambiar solo politicas: `200`, solo politicas cambia.
- `telefono:""`: `200`, telefono se conserva.
- Intento `owner_id`: `400 contrato_invalido`.
- Intento `barberos.password`: `400 contrato_invalido`.
- `collections_patch` vacio: `200`, no borra servicios/barberos/horarios.
- Barberos existentes conservaron email y `password_hash`.
- Horarios quedaron en 7 dias.
- No se creo nueva barberia.
- `dashboard/state` reflejo el cambio aplicado.

Cleanup QA realizado:

- `public.barberias.id=198`: `telefono='3106974573'`, `politicas=NULL`, `owner_id=7`.
- Servicios activos restaurados: `Corte Clasico`, `Barba`, `Corte + Cejas`.
- Barberos activos restaurados: `id=439`, `id=440`.
- Credenciales conservadas: emails presentes y `password_hash_len=60`.
- Horarios: 7 dias.
