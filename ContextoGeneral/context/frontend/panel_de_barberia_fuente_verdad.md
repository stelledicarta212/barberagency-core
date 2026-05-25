# Panel de Barberia - Fuente de verdad

## Regla principal

El dashboard real de produccion no vive dentro de `barberagency-core`.

La fuente de verdad del panel es:

- Ruta local: `C:\Users\calvi\OneDrive\n8n\Visual studio\panel_de_barberia`
- GitHub: `https://github.com/stelledicarta212/panel_de_barberia.git`
- Rama: `principal`
- EasyPanel: servicio `barberagency / app`
- URL publica: `https://barberagency-app.gymh5g.easypanel.host/barberia`

## Uso de cada repo

### barberagency-core

Usar para:

- plantillas publicas;
- documentacion y contexto;
- tareas diarias;
- pruebas de plantillas;
- logica base del proyecto.

No usar para cambios del dashboard.

### panel_de_barberia

Usar para:

- dashboard real;
- cambios del panel;
- deploy de EasyPanel;
- rutas `/barberia`, `/citas`, `/clientes`, `/barberos`, `/servicios`, `/inventario`, `/finanzas`, `/configuracion`, `/soporte`.

## Evidencia

El dashboard fue reparado y desplegado desde `panel_de_barberia`.

Commit validado:

- `6363d00 Prepare dashboard for EasyPanel Docker deploy`

Validaciones:

- `cmd /c npm run build` paso correctamente en `panel_de_barberia`.
- EasyPanel desplego correctamente el servicio `app`.
- El navegador cargo `https://barberagency-app.gymh5g.easypanel.host/barberia`.
- La pantalla mostro `Barberia 58`, `id: 101`, `slug: barberia-58`.

## Limpieza realizada

- Se elimino `apps/dashboard` dentro de `barberagency-core`.
- Se removio el panel del tracking del core.
- Se agrego `_tmp_panel_de_barberia/` al `.gitignore` del core para evitar confusiones.
- El panel queda como repo hermano en `..\panel_de_barberia`.
