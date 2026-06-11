# Bug Config Editor Barberos Fuente de Verdad - Final

Fecha: 2026-06-11
Estado: `BUG BARBEROS EDITOR - IMPLEMENTACION FINAL ENTREGADA`

## Causa raiz exacta

En `project/templates/plantillas/registrobarberia.html`, dentro de `persistLandingSeed()`, `finalBarberSource` priorizaba `data.barberos` antes de `sourceDraft.barberos`.

Eso no respetaba la fuente de verdad porque `data.barberos` puede ser una semilla parcial, un patch transportado o un estado incompleto de navegacion. La fuente canonica del flujo de configuracion es:

```txt
/api/dashboard/state -> draft local hidratado -> sourceDraft.barberos
```

En el codigo, `barberProfiles` corresponde a `sourceDraft.barberos`:

```js
const barberProfiles = Array.isArray(sourceDraft.barberos)
  ? sourceDraft.barberos
  : [];
```

Por lo tanto, `barberProfiles` debe ser la primera fuente.

## Nuevo orden de prioridad

Orden aplicado en `persistLandingSeed()`:

```js
const finalBarberSource =
  (hasPublicBarbers(barberProfiles) && barberProfiles) ||
  (hasPublicBarbers(sourceBarberProfiles) && sourceBarberProfiles) ||
  (hasPublicBarbers(data.barberos) && data.barberos) ||
  (hasPublicBarbers(dataBarberProfiles) && dataBarberProfiles) ||
  (hasPublicBarbers(patchBarbers) && patchBarbers) ||
  (hasPublicBarbers(barberAccesses) && barberAccesses) ||
  [];
```

Notas:

- `barberProfiles` es `sourceDraft.barberos`, hidratado desde `/api/dashboard/state`.
- `collections_patch.barberos.upsert` queda despues de las fuentes canónicas.
- `barberAccesses` queda como ultimo recurso absoluto porque son accesos/credenciales, no la coleccion publica canonica de barberos.

## Validacion manual de conteos e IDs

Se ejecuto una simulacion local con:

- `sourceDraft.barberos`: 4 barberos canonicos.
- `data.barberos`: 1 barbero parcial no canonico.
- `collections_patch.barberos.upsert`: 1 barbero parcial.
- `sourceDraft.accesos.barberos`: 1 acceso no canonico.

Resultado:

```json
{
  "source_count": 4,
  "source_ids": [439, 440, 445, 446],
  "seed_count": 4,
  "seed_ids": [439, 440, 445, 446]
}
```

Conclusion: `ba_landing_seed.barberos` conserva el conteo y los IDs de `sourceDraft.barberos`, incluso si `data.barberos` trae una lista parcial.

## IDs reales de referencia

Evidencia historica de produccion para `barberia_id=198`:

```json
[
  { "id": 439, "nombre": "Barbero prueba 4", "activo": true },
  { "id": 440, "nombre": "Barbero Prueba 4.1", "activo": true },
  { "id": 445, "nombre": "barber3", "activo": false },
  { "id": 446, "nombre": "Barbero de Test", "activo": false },
  { "id": 447, "nombre": "Barbero de Test", "activo": false }
]
```

La validacion local uso una muestra de 4 barberos para comprobar la prioridad. Tras copiar a WordPress, la validacion live debe confirmar que el conteo completo de `sourceDraft.barberos` coincide con `ba_landing_seed.barberos`.

## Archivos modificados

- `project/templates/plantillas/registrobarberia.html`
- `ContextoGeneral/daily/2026-06-11_Bug_Config_Editor_Barberos_Fuente_Verdad_Final.md`

No fue necesario modificar `project/templates/editor/landing_editor_v2_unico_vscode.html` en esta correccion final; el cambio anterior ya permite leer `foto_url`, `activo`, `especialidad` y `rol`.

## Validaciones ejecutadas

- `node --check` del JavaScript extraido de `registrobarberia.html`: PASS.
- Simulacion local de prioridad canonical-first: PASS.
- `sourceDraft.barberos` de muestra: 4.
- `ba_landing_seed.barberos` simulado: 4.
- IDs de source: `[439, 440, 445, 446]`.
- IDs de seed: `[439, 440, 445, 446]`.

## Validaciones pendientes tras copiar a WordPress

1. Abrir `/registro-barberias/?mode=edit&barberia_id=198&slug=barberia-prueba-4` con sesion valida.
2. Confirmar `/api/dashboard/state = 200`.
3. En consola, inspeccionar `draft.barberos.length` antes de `persistLandingSeed`.
4. Pulsar `Seguir a la plantilla`.
5. Confirmar que no llama `/api/configuracion/update`.
6. Confirmar `JSON.parse(sessionStorage.getItem('ba_landing_seed')).barberos.length`.
7. Confirmar IDs de `ba_landing_seed.barberos`.
8. Confirmar que el editor renderiza el mismo conteo de barberos heredados.
9. Confirmar que no renderiza accesos como barberos publicos.
10. Confirmar que no inventa barberos.

## Alcance respetado

- No se toco DB.
- No se toco n8n.
- No se toco EasyPanel.
- No se toco Bloque 10.
- No se toco POS.
- No se tocaron reservas.
- No se tocaron permisos.
- No se toco sesion.
- No se toco `/api/configuracion/update`.

## WordPress

Requiere copiar HTML completo a WordPress:

- `project/templates/plantillas/registrobarberia.html`

Si WordPress aun no tiene el commit anterior de editor, copiar tambien:

- `project/templates/editor/landing_editor_v2_unico_vscode.html`

