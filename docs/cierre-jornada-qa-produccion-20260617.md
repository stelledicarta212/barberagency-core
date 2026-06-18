# Cierre jornada QA / Produccion - BarberAgency - 2026-06-17

## 1. Resumen ejecutivo

Durante la jornada se estabilizaron y validaron varias piezas criticas del flujo publico y privado de BarberAgency:

- Pagina publica V2 `/b/barberia-prueba-4`.
- Plantilla WordPress ID `1558`, slug `index_unico_v2`.
- Pagina de registro produccion `/registro-barberias/`.
- Pagina QA hidratacion ID `3921`.
- Editor `landing_editor_v2`.
- Boton `Configuracion` del dashboard.
- Sesion `ba_session` entre hosts.
- Publicacion desde editor V2.
- Hidratacion de imagenes reales R2 para servicios y barberos.

Estado final reportado:

- `/b/barberia-prueba-4`: PASS.
- Servicios/barberos con imagenes R2: PASS.
- `/registro-barberias/`: PASS visual/tecnico basico.
- Boton `Configuracion`: PASS despues de fix y redeploy.
- `landing_editor_v2`: PASS hidratacion.
- Publicar desde editor: PASS despues de fix de cookie y login nuevo.

## 2. Contexto inicial

El punto de partida tuvo varios problemas encadenados entre WordPress, el panel Next.js, el editor V2 y la publicacion:

- Desde movil/landing publica se veian datos reales parcialmente.
- Dashboard y editor tenian problemas de rutas, hidratacion y publicacion.
- La landing publica mostraba servicios/barberos reales, pero con imagenes demo, Pexels, WordPress local o fallbacks.
- El boton `Configuracion` enviaba al host incorrecto `barberagency-app.gymh5g.easypanel.host/registro-barberias`, generando 404.
- El editor V2 hidrataba, pero al publicar devolvia `401 Sesion requerida para publicar`.

## 3. Hallazgos sobre WordPress y plantillas

### 3.1 Pagina ID 1558 - `index_unico_v2`

- Es la plantilla publica usada por `/b/barberia-prueba-4` cuando `template_id = "v2"`.
- Estaba desactualizada en WordPress.
- No contenia `pickFirstImage` ni `normalizeImageUrl`.
- Se sincronizo desde `project/templates/plantillas/index_unico_v2.html`.
- Se reemplazo HTML viejo por el HTML nuevo del repo.
- Se protegio como bloque Gutenberg Custom HTML:

```html
<!-- wp:html -->
...
<!-- /wp:html -->
```

Causa de rotura visual tras primera sincronizacion:

- `wpautop` inyectaba `<p>` dentro de `<style>` y `<script>`.
- `wptexturize` alteraba operadores `&&` y rompia JS.

Solucion aplicada:

- Envolver como bloque `wp:html`.
- Codificar JS inline sensible en Base64 usando `Function(atob(...))();`.

Estado final:

- HTML publico contiene `pickFirstImage`.
- HTML publico contiene `normalizeImageUrl`.
- CSS y JS renderizan correctamente.
- Cards de servicios y barberos aparecen.

### 3.2 Pagina ID 3921 - `registro-barberias-qa-hidratacion`

- Es solo diagnostico tecnico.
- No debe promoverse a produccion.
- Contiene el bloque `QA HIDRATACION - NO USAR EN PRODUCCION FINAL`.
- Se detecto un problema previo donde CSS publico `post-3921.css` llego a contener HTML corrupto.
- La solucion fue actualizar desde Elementor para regenerar CSS.

Estado:

- PASS visual/tecnico como pagina diagnostica.
- `/registro-barberias-qa/` no existe como fuente real separada; redirige 301 a QA hidratacion.

### 3.3 Pagina produccion ID 3759 - `/registro-barberias/`

- Editor: Elementor.
- Template: `elementor_canvas`.
- Widget HTML: `f310631`.
- `settings.html` coincide con `project/templates/plantillas/registrobarberia.html`.
- `settings.custom_css` coincide con `project/templates/base/registro.css`.
- `custom_css` no contiene HTML, `<script>`, `<section>` ni `<div>`.
- CSS publico `post-3759.css` contiene CSS del wizard y no HTML incrustado.
- No se aplicaron cambios a produccion porque ya estaba sincronizada.

Backup generado:

```text
scratch/wp_page_registro_barberias_backup_20260617_1910.json
```

Validacion manual reportada:

- `hasWizard: true`.
- `hasQuestion: true`.
- `hasReset: true`.
- `hasQaPanel: false`.
- Visualmente correcto en produccion.

## 4. Hidratacion de imagenes R2

### 4.1 Problema

- Servicios/barberos reales aparecian, pero sus imagenes no coincidian con la fuente real.
- Se veian imagenes Pexels, WordPress local, avatars antiguos o fallbacks.
- Inicialmente se esperaban archivos `file-427726`, etc., pero luego se confirmo que esas referencias antiguas daban 404 en R2.

### 4.2 Causa raiz

- Las URLs antiguas de R2 ya no eran validas.
- El patron real de n8n genera archivos como `logos/file-{executionId}.{extension}`.
- El lote funcional real era `593422` a `593431`.
- Las URLs canonicas en PostgreSQL debian apuntar a los archivos R2 funcionales.

### 4.3 Mapeo final funcional

Logo:

- `file-593484.jpg`.

Barberos:

- ID `439` -> `file-593422.jpg`.
- ID `440` -> `file-593426.jpg`.
- ID `445` -> `file-593427.jpg`.

Servicios:

- ID `489` -> `file-593425.jpg`.
- ID `490` -> `file-593424.png`.
- ID `491` -> `file-593423.png`.

### 4.4 Validacion en navegador

En `/b/barberia-prueba-4`, consola mostro imagenes R2 cargadas:

- `file-593484`.
- `file-593422`.
- `file-593426`.
- `file-593427`.
- `file-593425`.
- `file-593424`.
- `file-593423`.

Todas con dimensiones reales `naturalWidth > 0` y `naturalHeight > 0`.

Nota:

- Quedo una imagen Pexels de interior/cover, pero no afecta el PASS principal de servicios/barberos.
- Pendiente opcional: decidir si tambien se migra cover/hero a R2.

## 5. Fix del boton Configuracion del dashboard

Repo:

- `panel_de_barberia`.

Archivo:

- `src/components/dashboard-shell.tsx`.

Problema:

- El boton `Configuracion` del dashboard enviaba a `https://barberagency-app.gymh5g.easypanel.host/registro-barberias?...`.
- Esa ruta no existe en el host app y daba 404.

Solucion:

```ts
const REGISTRO_BASE_URL = "https://barberagency-barberagency.gymh5g.easypanel.host";
```

El boton ahora arma:

```text
https://barberagency-barberagency.gymh5g.easypanel.host/registro-barberias/?mode=edit&barberia_id=198&slug=barberia-prueba-4
```

Commit:

- `d2f3e0b8a1b905e6966bb9bd24bf0622442fd3da`
- `fix(dashboard): point settings link to WordPress registration page`

Estado:

- Pushed a `origin/principal`.
- Validado despues de redeploy.

## 6. Fix de sesion `ba_session` entre hosts

Repo:

- `panel_de_barberia`.

Problema:

- El editor V2 en `barberagency-barberagency.gymh5g.easypanel.host` hidrataba bien.
- Al publicar devolvia `401 Unauthorized` / `Sesion requerida para publicar`.
- La cookie `ba_session` se creaba como host-only en `barberagency-app.gymh5g.easypanel.host`.
- Al abrir editor en el host WordPress, `/api/editor/publish` no recibia la cookie.

Solucion:

Normalizar `Set-Cookie` de `ba_session` en proxies de sesion para usar dominio compartido:

```text
Domain=.gymh5g.easypanel.host
Path=/
SameSite=Lax
Secure
HttpOnly
```

Archivos modificados:

- `src/app/api/session/cookies.ts`.
- `src/app/api/session/login/route.ts`.
- `src/app/api/session/me/route.ts`.

Commit:

- `ace3d6e75bc9536c1bfddaff05e9ada987806b2d`
- `fix(session): share auth cookie across app and WordPress hosts`

Validacion:

- Requirio redeploy del panel Next.
- Requirio abrir incognito nuevo e iniciar sesion de nuevo.
- Despues del login nuevo, publicar desde `landing_editor_v2` funciono.
- Nota: `ba_session` es `HttpOnly`, por lo tanto no aparece en `document.cookie`. Se valida en Network en el request `/api/editor/publish`.

## 7. Validaciones finales realizadas

### `/registro-barberias/`

- Wizard visible.
- Sin panel QA.
- Sin layout roto.
- `hasWizard: true`.
- `hasQuestion: true`.
- `hasReset: true`.
- `hasQaPanel: false`.

### `/b/barberia-prueba-4`

- Landing publica renderiza.
- Logo R2 visible.
- Servicios reales visibles.
- Barberos reales visibles.
- Imagenes R2 cargadas.
- QR visible.
- Layout V2 correcto.

### `landing_editor_v2`

- Hidrata barberia `198`.
- Preview correcto.
- Imagenes correctas.
- Publicacion funciona despues del fix de sesion.

### Dashboard

- `Configuracion` abre URL correcta en host WordPress.
- No abre mas `barberagency-app/.../registro-barberias`.

## 8. Commits relevantes

### `barberagency-core`

- `8926860375e8d6923e99d8632cfe86520dc630d3`
  `fix(editor): preserve barber and service media through publish flow`

- `f5d0be360773ed911dc38db276f95ac20cd4dbaa`
  `fix(editor): preserve media fields through hot production publish flow`

- `5162730`
  `fix(n8n): include service image urls in public landing payload`

- `1d3ca8c`
  `fix(templates): render service images from public payload`

- `0723cb4`
  `fix(editor): preserve canonical service ids in publish payload`

### `panel_de_barberia`

- `d2f3e0b8a1b905e6966bb9bd24bf0622442fd3da`
  `fix(dashboard): point settings link to WordPress registration page`

- `ace3d6e75bc9536c1bfddaff05e9ada987806b2d`
  `fix(session): share auth cookie across app and WordPress hosts`

## 9. Pendientes conocidos

- `npm run typecheck` completo en `panel_de_barberia` sigue fallando por errores existentes de tipos de Vitest en tests, no relacionados con estos fixes.
- Cover/hero aun puede usar imagen Pexels; pendiente opcional si se desea que todo sea R2.
- Revisar mas adelante si conviene reemplazar URL hardcoded `REGISTRO_BASE_URL` por variable de entorno tipo `NEXT_PUBLIC_WORDPRESS_BASE_URL`.
- Limpiar archivos temporales/no versionados:
  - Backups en `scratch/`.
  - Reportes temporales si no se van a versionar.
  - Capturas temporales.
- Revocar Application Password temporal usada por agentes si ya no se necesita.
- No actualizar plugins hasta tener backup/ventana de mantenimiento.

Archivos no versionados observados en `barberagency-core` al cierre y no incluidos en este commit:

- `docs/cierre-registro-barberias-produccion.md`.
- `docs/dx-trazabilidad-media-editor-publicacion.md`.
- `editor_landing.html`.
- `n8n_response.json`.
- `public_landing.html`.
- `response.json`.

## 10. Recomendacion operativa

Dejar congelado el estado actual como punto estable.

No tocar produccion hoy salvo validaciones.

Antes de nuevos cambios:

- Backup.
- QA primero.
- Commit/push.
- Redeploy.
- Validacion en navegador real.

