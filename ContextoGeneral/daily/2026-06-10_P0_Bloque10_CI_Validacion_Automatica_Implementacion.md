# P0 Bloque 10 - CI y Guardrails - Implementacion

Fecha: 2026-06-10
Alcance: panel de barberia y documentacion core.
Estado: PASS con reservas menores por warnings existentes de lint.

## Objetivo

Implementar validacion automatica para evitar regresiones de SSOT en el panel:

- CI en GitHub Actions.
- Scripts estandar `typecheck`, `test` y `ci`.
- Guardrails Vitest para rutas canonicas, secretos, endpoints privados y ejecucion dinamica.
- Eliminacion de fallbacks hardcodeados hacia n8n en rutas server-side.
- Variables server-only documentadas en `.env.local.example`.

## Cambios implementados en panel_de_barberia

- `.github/workflows/ci.yml`: workflow de CI para `principal` y `main`.
- `package.json` / `package-lock.json`: agregado Vitest y scripts:
  - `lint`
  - `typecheck`
  - `test`
  - `ci`
- `tests/security-guardrails.test.ts`: 7 pruebas de seguridad:
  - no hardcodear host productivo de n8n en source.
  - no usar `NEXT_PUBLIC_*` para endpoints operativos privados.
  - no permitir webhooks directos desde cliente.
  - no permitir `eval`, `new Function` o `Function(` en source.
  - no trackear `.env`, `.env.local`, `.next`, `tsconfig.tsbuildinfo` o logs.
  - validar presencia de rutas API criticas.
  - validar recuperacion de password con variables server-only.
- `Dockerfile`: removidas variables `NEXT_PUBLIC_*` peligrosas del build/runtime.
- `.env.local.example`: documentadas variables server-only sin valores reales.
- Rutas API actualizadas para no usar fallback hardcodeado a n8n y devolver 500 JSON si falta configuracion:
  - `src/app/api/session/login/route.ts`
  - `src/app/api/session/me/route.ts`
  - `src/app/api/dashboard/state/route.ts`
  - `src/app/api/configuracion/update/route.ts`
  - `src/app/api/editor/draft/route.ts`
  - `src/app/api/editor/publish/route.ts`
  - `src/app/api/editor/auth.ts`
  - `src/app/api/dashboard/barberos/route.ts`
  - `src/app/api/dashboard/citas/route.ts`
  - `src/app/api/pos/route.ts`

## Contrato reforzado

Las rutas server-side ya no deben depender de URLs embebidas ni de variables publicas para endpoints privados. Si falta una variable requerida, la ruta responde:

- HTTP 500.
- JSON con `ok=false`.
- `code` especifico de configuracion faltante.

Esto evita que produccion use rutas de emergencia invisibles o que el navegador vea endpoints privados.

## Evidencia local

Ejecutado en `_work_panel_de_barberia`:

- `npm run lint`: PASS con 15 warnings existentes, 0 errores.
- `npm run typecheck`: PASS.
- `npm run test`: PASS, 7/7 guardrails.
- `npm run build`: PASS.
- `npm run ci`: PASS.

Busqueda estatica en `src`:

- `barberagency-n8n.gymh5g.easypanel.host`: sin resultados.
- `/webhook/`: sin resultados.
- `NEXT_PUBLIC_DASHBOARD`: sin resultados.
- `NEXT_PUBLIC_POS`: sin resultados.
- `eval(`, `new Function`, `Function(`: sin resultados.

## Reservas

- `npm run lint` sigue mostrando warnings existentes de imagenes `<img>`, hooks y una variable no usada en `finanzas/page.tsx`; no bloquean CI porque son warnings, no errores.
- No se modifico UI/UX, reservas, publicacion, POS avanzado, n8n ni base de datos.

## Decision

Bloque 10 queda implementado en codigo y validado localmente.

Pendiente operativo:

- Verificar GitHub Actions despues del push en la rama `principal` del panel.
- Confirmar que EasyPanel tenga configuradas las variables server-only requeridas antes de redeploy productivo.
