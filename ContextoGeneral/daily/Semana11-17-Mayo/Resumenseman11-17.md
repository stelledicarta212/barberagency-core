# Resumen Semanal: 11 al 17 de Mayo de 2026

Este documento consolida los avances, decisiones tecnicas, hallazgos y estado real de cierre de la semana para BarberAgency.

## 1. Evolucion del Dashboard
- Se avanzo en el dashboard administrativo con interfaz oscura/dorada y ajustes de responsividad en movil y desktop.
- Se trabajaron los modulos de panel, citas, clientes, barberos, servicios, lealtad y caja/POS.
- Ante la ausencia temporal del workflow `dashboard/state`, se mantuvo un fallback de frontend para evitar caidas de interfaz.

## 2. Base de Datos y Persistencia Canonica
- Se verificaron permisos de lectura con rol `anon` para `barberos` y `servicios`.
- Se consolido la sincronizacion canonica de registro:
  - upsert de `barberos`, `servicios` y `horarios`;
  - bajas logicas para elementos eliminados;
  - uso del `barberia_id` real como identidad de persistencia.
- Se confirmo el uso de identificadores publicos estables:
  - `slug`;
  - `qr_code`;
  - `qr_links`;
  - RPC auxiliares para resolucion y publicacion.

## 3. Arquitectura Publica E2E
- Se implemento `ba_publicar_landing_completa` como RPC central de publicacion.
- Se consolido `ba_get_landing_publica` como contrato publico unico por `slug`.
- Se mantuvo `ba_resolver_qr` para resolver `/q/{qr_code}` hacia la landing canonica.
- Se desarrollo el router de WordPress para servir `/b/{slug}` usando la fuente publica publicada.

## 4. Hallazgos Relevantes de la Semana

### 4.1 Fuente de verdad publica
- El problema principal era que varias plantillas seguian mezclando:
  - datos canonicos de BD;
  - semillas viejas;
  - `localStorage`;
  - endpoints legacy.
- Se corrigio la estrategia para que las rutas publicas `/b/{slug}` usen `BA_LANDING_ROUTE_CONTEXT` como entrada de render y mantengan la BD como unica fuente de verdad.

### 4.2 Sincronizacion de colecciones
- Se valido con pruebas en Postman que la RPC central:
  - inserta nuevos barberos;
  - inserta nuevos servicios;
  - desactiva logicamente los eliminados;
  - conserva correctamente los elementos vigentes.
- Se probaron escenarios mixtos con altas y bajas simultaneas.

### 4.3 Flujo del editor
- Se corrigio el editor para que no publique colecciones antiguas por encima de cambios recientes.
- Se endurecio el boton `Ver landing publicada`:
  - abre en pestana nueva;
  - usa solo la `public_landing_url` devuelta por la publicacion actual;
  - no reutiliza seeds ni URLs reconstruidas localmente.

### 4.4 Router publico de WordPress
- Se detecto que el router nuevo podia terminar enviando `/b/{slug}` a `/inicio/`.
- La causa estaba en la capa del plugin router, no en la RPC ni en el editor.
- Solucion final:
  - plugin `BarberAgency Public Router v5`;
  - version tecnica `0.5.0`;
  - bloqueo de `redirect_canonical` para landings publicas validas;
  - prioridad alta en `template_redirect`;
  - contexto publico inyectado desde la fuente de verdad.

## 5. Estado de Plantillas al Cierre

### Validadas para produccion
- `v2`
  - hidrata correctamente desde la fuente publica;
  - QR y URL publica correctos;
  - ya no queda en `Cargando enlace...`.
- `v3`
  - hidrata correctamente;
  - muestra `nombre_publico` en vez del nombre tecnico;
  - queda alineada con la logica canonica.
- `v5`
  - hidrata correctamente;
  - fue la plantilla de referencia para validar servicios, barberos, QR y URL;
  - quedo probada con altas y bajas logicas.

### Pendientes
- Replicar la misma logica ya validada en:
  - `v4`
  - `v6`
  - `v7`
- Luego ejecutar las mismas pruebas:
  1. publicar barberia nueva;
  2. cambiar plantilla;
  3. agregar y eliminar barberos;
  4. agregar y eliminar servicios;
  5. validar QR, URL, nombre publico, branding y datos visibles;
  6. confirmar primero en Postman y despues en WordPress.

## 6. Estado Final de Semana
- La arquitectura publica ya tiene una ruta clara y productiva:
  - publicacion por RPC;
  - lectura publica por RPC;
  - resolucion de QR;
  - router WordPress canonico;
  - editor alineado con fuente de verdad.
- Quedan listas para produccion:
  - `v2`
  - `v3`
  - `v5`
- Quedan pendientes de homologacion:
  - `v4`
  - `v6`
  - `v7`

## 7. Siguiente Paso
1. Homologar `v4`, `v6` y `v7` con la misma logica validada en `v2`, `v3` y `v5`.
2. Repetir pruebas E2E en Postman y WordPress.
3. Solo despues de pasar esas pruebas, marcar las seis plantillas como listas para produccion.
