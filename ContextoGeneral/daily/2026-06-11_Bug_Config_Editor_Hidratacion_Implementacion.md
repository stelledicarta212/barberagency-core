# Bug Config Editor Hidratacion - Implementacion

Fecha: 2026-06-11
Estado: `BUG HIDRATACION EDITOR - IMPLEMENTACION ENTREGADA`

## Causa raiz

En `project/templates/plantillas/registrobarberia.html`, la funcion `persistLandingSeed(payload, data)` tomaba el estado del formulario con:

```js
const sourceDraft = (payload && payload.draft) || window.draft || {};
```

En `mode=edit`, `buildPatchPayload()` no incluye `payload.draft`. Ademas, `draft` esta declarado como variable local del IIFE principal con `let draft`, por lo que `window.draft` es `undefined`.

Resultado: `sourceDraft` quedaba como `{}` y la seed `ba_landing_seed` se escribia sin servicios, barberos, horarios ni datos completos de barberia.

## Fix aplicado

Archivo modificado:

- `project/templates/plantillas/registrobarberia.html`

Cambios:

1. Se reemplazo `window.draft` por la variable local `draft`.

```js
const sourceDraft = (payload && payload.draft) || draft || {};
```

2. Se agrego resolucion segura de colecciones finales:

```js
const finalServices = Array.isArray(data?.servicios) && data.servicios.length
  ? data.servicios
  : (Array.isArray(sourceDraft.servicios) ? sourceDraft.servicios : []);

const finalHours = Array.isArray(data?.horarios) && data.horarios.length
  ? data.horarios
  : (Array.isArray(sourceDraft.horarios) ? sourceDraft.horarios : []);

const finalBarbers = Array.isArray(data?.barberos) && data.barberos.length
  ? data.barberos
  : (barberProfiles.length ? barberProfiles : barberAccesses);
```

3. `data.servicios`, `data.horarios` y `data.barberos` se normalizan con esas colecciones finales antes de escribir `onboarding_result`.

## Estructura final de seed

La seed `ba_landing_seed` queda escrita con:

- `barberia_id`
- `id_barberia`
- `id`
- `slug`
- `nombre`
- `ciudad`
- `direccion`
- `maps_url`
- `telefono`
- `slot_min`
- `barberia`
- `servicios: finalServices`
- `horarios: finalHours`
- `barberos: finalBarbers`
- `barber_photos`
- `accesos`
- `onboarding_result`

Regla aplicada:

1. Primero usa colecciones validas desde `data`.
2. Si `data` no trae colecciones, usa el `draft` local ya hidratado desde `/api/dashboard/state`.
3. Nunca depende de `window.draft`.
4. No inventa arrays vacios cuando ya existen datos en `draft`.

## Validaciones ejecutadas

### Codigo

- Busqueda confirmo que la linea ahora usa `draft` local:
  - `const sourceDraft = (payload && payload.draft) || draft || {};`
- Busqueda confirmo presencia de:
  - `finalServices`
  - `finalHours`
  - `finalBarbers`
- `node --check` sobre el JavaScript extraido desde `registrobarberia.html`: PASS.

### Flujo sin mutacion

- Se confirmo por codigo que `postOnboardingPayload(payload)` en `mode=edit` con PATCH vacio retorna `local-empty-patch` y no llama `postConfiguracionUpdate(payload)`.
- Se confirmo por codigo que `submitDraftAndContinue()` persiste seed y redirige al editor.

### HTTP produccion sin cookie

Comando ejecutado:

```bash
curl -i "https://barberagency-app.gymh5g.easypanel.host/api/dashboard/state?barberia_id=198&slug=barberia-prueba-4"
```

Resultado:

```json
{"ok":false,"message":"Sesion no valida"}
```

Status: `401 Unauthorized`.

Esto confirma que el endpoint sigue bloqueando acceso anonimo. No se ejecuto prueba autenticada end-to-end porque este fix vive en la plantilla fuente del repo y requiere copiar el HTML actualizado a WordPress antes de probar el flujo real en navegador.

## Validaciones pendientes tras copiar a WordPress

1. Abrir `/registro-barberias/?mode=edit&barberia_id=198&slug=barberia-prueba-4` con sesion valida.
2. Confirmar que `/api/dashboard/state` responde `200`.
3. Pulsar `Seguir a la plantilla`.
4. Confirmar que no llama `/api/configuracion/update` cuando no hay cambios.
5. Confirmar que no aparece error JS `Cannot read properties of undefined (reading 'barberia')`.
6. Confirmar que el editor abre e hidrata:
   - datos de barberia
   - servicios
   - barberos
   - horarios
   - slug
   - barberia_id
   - branding/imagenes si existen
7. Confirmar que crear nueva barberia no se rompe.
8. Confirmar que usuario ajeno sigue bloqueado.
9. Confirmar que slug mismatch sigue bloqueado.
10. Confirmar que `admin_email` manual no da permisos.

## Alcance respetado

- No se toco DB.
- No se toco n8n.
- No se toco EasyPanel.
- No se toco Bloque 10.
- No se toco CI.
- No se toco POS.
- No se tocaron reservas.
- No se relajo seguridad.
- No se uso `admin_email` como autoridad.
- No se uso query params como autoridad.
- No se modifico `landing_editor_v2_unico_vscode.html` porque el problema se corrige desde la seed.

## WordPress

Requiere copiar el HTML completo actualizado a WordPress:

`project/templates/plantillas/registrobarberia.html`

