# Bug Config Editor Barberos Fuente de Verdad

Fecha: 2026-06-11
Estado: `BUG BARBEROS EDITOR - IMPLEMENTACION ENTREGADA`

## Causa raiz

El flujo `Dashboard -> Configuracion -> Registro Barberias mode=edit -> Seguir a la plantilla -> landing_editor_v2` ya generaba la seed desde el `draft` local hidratado, pero la rama de barberos seguia siendo fragil por dos razones:

1. En `persistLandingSeed`, cuando `data.barberos` no existia, se rellenaba desde `payload.collections_patch.barberos.upsert`. Ese array representa cambios parciales del PATCH, no la coleccion canonica completa. Por lo tanto podia desplazar a la fuente real hidratada desde `/api/dashboard/state`.
2. El editor `landing_editor_v2_unico_vscode.html` leia `seed.barberos`, pero su normalizador solo reconocia `photo`, `foto` y `picture_url`; no reconocia `foto_url`, que es la clave canonica que viene desde `dashboard/state` y desde el draft local de `registrobarberia.html`.

## Estructura real desde dashboard/state

La evidencia historica de produccion para `barberia_id=198` muestra barberos reales en `dashboard/state` / PostgreSQL con esta forma:

```json
[
  { "id": 439, "nombre": "Barbero prueba 4", "activo": true },
  { "id": 440, "nombre": "Barbero Prueba 4.1", "activo": true },
  { "id": 445, "nombre": "barber3", "activo": false },
  { "id": 446, "nombre": "Barbero de Test", "activo": false },
  { "id": 447, "nombre": "Barbero de Test", "activo": false }
]
```

El workflow de `dashboard/state` normaliza barberos como:

```json
{
  "id": 439,
  "barberia_id": 198,
  "nombre": "Barbero prueba 4",
  "activo": true,
  "usuario_id": null,
  "foto_url": "..."
}
```

## Estructura que se estaba guardando

Antes del fix, la seed podia quedar con:

```json
{
  "barberos": []
}
```

o con barberos provenientes de `collections_patch.barberos.upsert`, que es una lista parcial de cambios y no la coleccion canonica.

## Estructura esperada por el editor

El editor lee:

- `seed.barberos`
- `source.barberos`
- `source.inherited.barberos`
- `source.data.barberos`

Y normaliza cada barbero para mostrar chips heredados usando `name` o `nombre`. Para imagen usa ahora:

- `photo`
- `foto`
- `foto_url`
- `picture_url`

## Fix aplicado

Archivos modificados:

- `project/templates/plantillas/registrobarberia.html`
- `project/templates/editor/landing_editor_v2_unico_vscode.html`

### Registro Barberias

`persistLandingSeed` ahora resuelve barberos con prioridad segura:

1. `data.barberos` si trae elementos reales.
2. `data.barberProfiles` si trae elementos reales.
3. `sourceDraft.barberos` hidratado desde `/api/dashboard/state`.
4. `sourceDraft.barberProfiles`.
5. `sourceDraft.accesos.barberos` solo como fallback.
6. `payload.collections_patch.barberos.upsert` como ultimo recurso.
7. `[]` solo al final.

Ademas normaliza cada barbero publico con:

- `id`
- `usuario_id`
- `nombre`
- `name`
- `activo`
- `foto`
- `foto_url`
- `photo`
- `picture_url`
- `especialidad`
- `rol`

No se copian emails ni passwords como fuente publica de barberos.

### Landing Editor

`normalizeInheritedBarbers()` ahora reconoce y conserva:

- `foto_url`
- `activo`
- `especialidad`
- `rol`
- `picture_url`

Esto alinea el formato escrito por `registrobarberia.html` con el formato leido por `landing_editor_v2`.

## Validaciones realizadas

### Estaticas

- `node --check` del JavaScript extraido desde `registrobarberia.html`: PASS.
- `diff --check` sobre archivos modificados: PASS.
- Se valido el normalizador del editor de forma aislada con:

```json
{ "id": 439, "nombre": "Barbero prueba 4", "activo": true, "foto_url": "https://x/foto.jpg" }
```

Resultado:

```json
{
  "id": 439,
  "name": "Barbero prueba 4",
  "nombre": "Barbero prueba 4",
  "activo": true,
  "photo": "https://x/foto.jpg",
  "foto": "https://x/foto.jpg",
  "foto_url": "https://x/foto.jpg",
  "picture_url": "https://x/foto.jpg"
}
```

Nota: `node --check` del editor completo no se uso como evidencia porque el archivo contiene un identificador mojibake preexistente (`queryBarberÃ­aId`) que impide el parseo completo fuera del navegador. El bloque modificado fue validado de forma aislada.

### HTTP sin cookie

Comando:

```bash
curl -i "https://barberagency-app.gymh5g.easypanel.host/api/dashboard/state?barberia_id=198&slug=barberia-prueba-4"
```

Resultado:

```json
{"ok":false,"message":"Sesion no valida"}
```

Status: `401 Unauthorized`.

Esto confirma que la lectura privada sigue bloqueando acceso anonimo. No se ejecuto prueba autenticada end-to-end porque el cambio debe copiarse primero a WordPress para probar el flujo real en navegador.

## Validaciones pendientes tras copiar a WordPress

1. Abrir `/registro-barberias/?mode=edit&barberia_id=198&slug=barberia-prueba-4` con sesion valida.
2. Confirmar `/api/dashboard/state = 200`.
3. Confirmar que `dashboard/state` trae barberos reales.
4. Pulsar `Seguir a la plantilla`.
5. Confirmar que no llama `/api/configuracion/update`.
6. Confirmar que `ba_landing_seed.barberos` contiene barberos reales.
7. Confirmar que `landing_editor_v2` muestra barberos heredados.
8. Confirmar que servicios siguen hidratando.
9. Confirmar que horarios siguen hidratando.
10. Confirmar que crear barberia nueva no se rompe.
11. Confirmar que usuario ajeno sigue bloqueado.
12. Confirmar que slug mismatch sigue bloqueado.
13. Confirmar consola sin errores JS.

## Alcance respetado

- No se toco DB.
- No se toco n8n.
- No se toco EasyPanel.
- No se toco Bloque 10.
- No se toco CI.
- No se toco POS.
- No se tocaron reservas.
- No se tocaron permisos.
- No se toco la llamada `/api/configuracion/update`.
- No se toco logica de sesion.
- No se rompio creacion de barberia nueva.

## WordPress

Requiere copiar HTML completo a WordPress:

- `project/templates/plantillas/registrobarberia.html`
- `project/templates/editor/landing_editor_v2_unico_vscode.html`

