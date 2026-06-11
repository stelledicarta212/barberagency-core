# Bug formulario reservas - fuente de verdad

Fecha: 2026-06-11

## Causa raiz

El formulario de reservas de las plantillas publicas no estaba consumiendo toda la fuente de verdad publicada con el mismo contrato que las secciones visibles.

Problemas confirmados:

1. `normalizeSeedHour(item)` solo aceptaba dias textuales (`dia`, `day`, `nombre_dia`) y descartaba horarios reales cuando la fuente publica enviaba `dia_semana` entero `0-6`.
2. Al quedar `horarios` vacio, el formulario podia caer en horarios fallback/hardcodeados.
3. Los payloads de reserva solo enviaban identidad dentro de `citas.id_barberia`, sin `slug`/`biz_slug` canonicos en raiz ni dentro de `citas`.
4. Los normalizadores de servicios y barberos no preservaban todos los campos reales y podian crear ids por indice si faltaba id.
5. `getCurrentBarberiaId()` priorizaba query params antes del estado canonico hidratado.

## Alcance real del fix

Se corrigieron las plantillas publicas que tienen formulario de reservas o normalizacion de colecciones:

- `project/templates/plantillas/index_unicov7.html`
- `project/templates/plantillas/index_unico_v2.html`
- `project/templates/plantillas/index_unico_v3_nueva.html`
- `project/templates/plantillas/index_unico_v4_editorial.html`
- `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html`
- `project/templates/plantillas/index_unico_v6_negro_dorado.html`
- `project/templates/plantillas/pruebas.html`

No se modifico `registrobarberia.html` en esta tarea.

## Servicios: fuente vs formulario

Antes:

- `normalizeSeedService()` podia crear `id_servicio` con `idx + 1`.
- No exponia tambien `servicio_id`.
- No preservaba campos adicionales del servicio original.
- No filtraba servicios inactivos si la fuente enviaba `activo=false` o `active=false`.

Despues:

- Cada servicio conserva `...item`.
- Usa id real desde `id_servicio`, `servicio_id`, `id` o `idServicio`.
- Si no existe id real, el servicio no entra al formulario.
- Conserva `id_servicio` y `servicio_id`.
- Conserva `nombre` y `name`.
- Filtra inactivos (`activo=false`, `active=false`, `deleted=true`, `deleted_at`).
- Mantiene precio y duracion real normalizados.

Resultado esperado:

- Count servicios activos en fuente = count servicios en formulario.
- IDs servicios activos en fuente = IDs del selector `servicio`.

## Barberos: fuente vs formulario

Antes:

- `normalizeSeedBarber()` podia crear `id_barbero` con `idx + 1`.
- No exponia tambien `barbero_id`.
- No preservaba campos adicionales.
- No filtraba barberos inactivos si la fuente enviaba `activo=false` o `active=false`.

Despues:

- Cada barbero conserva `...item`.
- Usa id real desde `id_barbero`, `barbero_id`, `id` o `idBarbero`.
- Si no existe id real, el barbero no entra al formulario.
- Conserva `id_barbero` y `barbero_id`.
- Conserva `nombre` y `name`.
- Filtra inactivos (`activo=false`, `active=false`, `deleted=true`, `deleted_at`).
- Conserva `foto_url`, `foto`, rol/especialidad y campos adicionales.

Resultado esperado:

- Count barberos activos en fuente = count barberos en formulario.
- IDs barberos activos en fuente = IDs del selector `barbero`.
- No se usan accesos/admins como barberos publicos.

## Horarios: fuente vs formulario

Antes:

- `dia_semana` numerico era descartado.
- El formulario podia usar fallback si la fuente real traia horarios validos.

Despues:

- `normalizeSeedHour()` soporta:
  - `dia`
  - `day`
  - `nombre_dia`
  - `nombreDia`
  - `dia_semana`
  - `diaSemana`
  - `weekday`
- Mapeo aplicado:
  - `0 = domingo`
  - `1 = lunes`
  - `2 = martes`
  - `3 = miercoles`
  - `4 = jueves`
  - `5 = viernes`
  - `6 = sabado`
- Conserva `...item`.
- Expone `dia`, `abre`, `cierra`, `hora_abre`, `hora_cierra`, `activo` y `dia_semana`.
- Respeta inactivos (`activo=false`, `active=false`, `cerrado=true`).

Resultado esperado:

- Dias activos en fuente = dias disponibles en formulario.
- Hora abre/cierra real no se reemplaza por fallback si existe fuente valida.

## Payload reserva antes vs despues

Antes:

```json
{
  "clientes_finales": {},
  "citas": {
    "id_barberia": 198,
    "id_servicio": 1,
    "id_barbero": 2,
    "fecha": "2026-06-11",
    "hora": "10:00"
  }
}
```

Despues:

```json
{
  "barberia_id": 198,
  "id_barberia": 198,
  "slug": "barberia-prueba-4",
  "biz_slug": "barberia-prueba-4",
  "servicio_id": 10,
  "id_servicio": 10,
  "barbero_id": 20,
  "id_barbero": 20,
  "fecha": "2026-06-11",
  "hora": "10:00",
  "cliente_nombre": "QA Cliente",
  "cliente_tel": "3000000000",
  "cliente_email": "qa@example.com",
  "clientes_finales": {
    "nombre_completo": "QA Cliente",
    "telefono": "3000000000",
    "email": "qa@example.com"
  },
  "citas": {
    "barberia_id": 198,
    "id_barberia": 198,
    "slug": "barberia-prueba-4",
    "biz_slug": "barberia-prueba-4",
    "servicio_id": 10,
    "id_servicio": 10,
    "barbero_id": 20,
    "id_barbero": 20,
    "fecha": "2026-06-11",
    "hora": "10:00",
    "hora_inicio": "10:00",
    "estado": "confirmada"
  }
}
```

La identidad del payload ahora se toma de `runtimeLandingState` / seed publicado / contexto canonico antes de query params.

## Cambios en normalizadores

- `normalizeSeedHour()` ahora entiende `dia_semana` entero y variantes camelCase.
- `normalizeSeedService()` conserva campos reales, exige id real y filtra inactivos.
- `normalizeSeedBarber()` conserva campos reales, exige id real y filtra inactivos.
- `getCurrentBarberiaId()` prioriza fuente canonica y deja query params como ultimo recurso.
- Se agrego `getCanonicalLandingSlug()` para payloads y URLs que necesiten slug real.

## Validaciones realizadas

- Busqueda global de `normalizeSeedHour`, `normalizeSeedService`, `normalizeSeedBarber`, `buildPayload`, `payloadFromMain` y `buildReservationPayload`.
- Verificado que todas las plantillas modificadas contienen soporte `dia_semana`.
- Verificado que todas las plantillas modificadas incluyen `slug`/`biz_slug` en raiz y dentro de `citas`.
- Verificado que todas las plantillas modificadas incluyen `servicio_id`/`barbero_id` reales en raiz y dentro de `citas`.
- Extraidos scripts embebidos de los 7 HTML modificados.
- `node --check` PASS para los 7 scripts extraidos.
- `git diff --check` PASS.

## Confirmaciones de alcance

- DB: no tocada.
- n8n: no tocado.
- EasyPanel: no tocado.
- Bloque 10: no tocado.
- POS: no tocado.
- permisos/sesion: no tocado.
- dashboard: no tocado.
- editor publish backend: no tocado.
- configuracion update: no tocado.

## Riesgos

- La validacion live en produccion sigue pendiente: debe confirmar conteos e IDs contra `ba_get_landing_publica` o endpoint publico real.
- Si alguna plantilla publicada en WordPress no se actualiza copiando el HTML nuevo, seguira usando el contrato anterior.
- Si el endpoint publico entrega barberos sin id real, ahora el formulario los excluye para evitar reservas con ids inventados.

## HTML a copiar a WordPress

Copiar el archivo completo de la plantilla publica que este usando cada landing:

- `project/templates/plantillas/index_unicov7.html`
- `project/templates/plantillas/index_unico_v2.html`
- `project/templates/plantillas/index_unico_v3_nueva.html`
- `project/templates/plantillas/index_unico_v4_editorial.html`
- `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html`
- `project/templates/plantillas/index_unico_v6_negro_dorado.html`

`pruebas.html` tambien fue actualizado como plantilla de prueba, pero no deberia copiarse a WordPress productivo salvo que se use expresamente como origen de una landing.

## Decision

BUG FORMULARIO RESERVAS - IMPLEMENTACION ENTREGADA
