# 📋 Reporte de Hallazgos y Sincronización del Core

**Fecha de Análisis:** 04 de Junio, 2026  
**Proyecto:** BarberAgency Core & Panel de Barbería  
**Estado:** Identificación de Conflictos de Sincronización y Persistencia de Datos (Fuente de Verdad)

---

## 🔍 Resumen del Diagnóstico

El análisis de la coordinación de datos con la fuente de verdad en el Core revela un diseño con buenas intenciones, pero expone **conflictos críticos de sincronización e identidad**. La raíz principal del problema es que el sistema carece de una única fuente de verdad limpia: actualmente compiten múltiples orígenes como `barberia_id`, `slug`, `seed`, `localStorage`, `cache` y fallbacks visuales de datos locales.

A continuación se presenta el desglose detallado de los conflictos identificados y las recomendaciones para mitigarlos.

---

## 🛠️ 1. Conflictos Críticos en Core y Base de Datos

### 1.1 El Conflicto en Horarios (Desactivación Rota)
* **Archivo afectado:** [registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html)
* **SQL de referencia:** [2026-05-14-hardening-onboarding-publicacion.sql](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/ContextoGeneral/context/db/2026-05-14-hardening-onboarding-publicacion.sql) (línea 253)

> [!WARNING]
> **El Problema:** La función RPC `ba_sync_registro_horarios` marca un día como inactivo (`activo = false`) únicamente si el día viene explícitamente en el payload y configurado como `activo = false`. 
>
> Sin embargo, el frontend filtra la lista enviando solo los días activos:
> ```javascript
> const activeHours = Array.isArray(horarios) ? horarios.filter((item) => item.activo) : [];
> ```
> 
> **Consecuencia:** Si un usuario desmarca un día en la interfaz (por ejemplo, decide cerrar los martes), ese día es filtrado y no se envía. Como la base de datos no recibe ese día en el bucle SQL, lo ignora y el día permanece activo en la base de datos indefinidamente.

* **Solución:** Modificar el frontend para enviar el arreglo completo de 7 días (incluyendo los que tienen `activo: false`), permitiendo que el bloque SQL procese la desactivación a través del `ON CONFLICT DO UPDATE`:
  ```javascript
  // CORRECCIÓN: Enviar la lista completa en lugar de filtrar activeHours
  p_horarios: horarios
  ```

### 1.2 Conciliación de Servicios y Barberos
* **Proceso:** RPC `ba_sync_publicacion_collections`

> [!IMPORTANT]
> **Funcionamiento:** La RPC realiza una conciliación lógica: actualiza los servicios/barberos del payload y desactiva lógicamente (`activo = false`) los ausentes para no borrar registros históricos necesarios para reportes.
> 
> **El Conflicto:** Si se desactiva un barbero o servicio en el formulario de registro, pero existen citas activas agendadas en el futuro asociadas a ellos, se crea un estado inconsistente en el calendario si no se bloquea la acción o no se notifica al administrador para reasignarlas.

### 1.3 Conflicto de Doble Vía de Escritura (Frontend vs. n8n)
* **Archivo afectado:** [registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html)
* **Documentación relacionada:** [02-06-26.md](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/ContextoGeneral/daily/Semana01-07-Junio/02-06-26.md)

> [!WARNING]
> **El Problema:** Se determinó que el frontend debe evitar la doble escritura directa a PostgREST/RPC y depender de n8n para la escritura canónica. No obstante, persiste la bandera de contingencia:
> ```javascript
> if (ALLOW_LOCAL_SEED_FALLBACK && isEditIntent() && isPostgrestPermissionError(error)) {
>    // Permite usar semillas locales si falla el webhook
> }
> ```
> 
> **Consecuencia:** Si el webhook de n8n falla parcialmente pero el fallback local escribe a través de PostgREST, se producen escrituras parciales o registros huérfanos (por ejemplo, barbería guardada pero sin accesos de usuario).

### 1.4 Desincronización de Caché Local (Stale Data)
* **Proceso:** Inicialización del formulario en el Core con la función `loadInitialDraft()`

> [!NOTE]
> **El Problema:** La función mezcla los datos del servidor (`fromSeed`) con el borrador local de `localStorage` (`saved`).
> 
> **El Conflicto:** Si el usuario edita la configuración desde el Dashboard de Next.js (actualizando la base de datos) y luego vuelve al formulario en WordPress, la página carga el borrador antiguo (`saved`) de `localStorage`. Al enviar el formulario, los datos desactualizados en caché sobrescriben los datos reales de la base de datos.

---

## 🆔 2. Conflictos de Identidad y Caché en el Panel de Barbería

### 2.1 Priorización Incorrecta de Semilla sobre la URL
* **Archivo afectado:** [landing_editor_v2_unico_vscode.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/editor/landing_editor_v2_unico_vscode.html) (línea 1590)

> [!WARNING]
> La identidad se compone desde múltiples fuentes (`seedLandingData`, query params, `window.BA_*`, `localStorage`). El editor prioriza `seedLandingData?.slug` y `seedLandingData?.barberia_id` antes que los parámetros explícitos de la URL. Si se abre el editor con parámetros específicos pero existe una semilla vieja en storage, se pueden mezclar IDs de una barbería con slugs de otra.

### 2.2 Contaminación de LocalStorage
* **Archivos afectados:** [barbershop-context.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/barbershop-context.ts) (línea 4) y el Core.

> [!NOTE]
> Tanto el Core como el Dashboard comparten las mismas llaves en `localStorage`: `ba_barberia_id`, `ba_barberia_slug`, y `ba_landing_seed`. Al navegar entre flujos, el Dashboard puede tomar una identidad vieja dejada por el registro o el editor, provocando la hidratación de datos erróneos.

### 2.3 Falta de Autoridad en session/me
* **Archivo afectado:** [barbershop-context.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/barbershop-context.ts) (línea 91)

> [!IMPORTANT]
> El Dashboard define la prioridad de identidad en este orden: **URL ➡️ storage ➡️ seed ➡️ env test fallback**. Sin embargo, la regla general establece que la barbería real debe determinarse por la sesión del backend (`session/me`). La ausencia de esta validación como autoridad máxima rompe el principio de multi-tenancy.

### 2.4 Prioridad Peligrosa de Slug sobre ID
* **Archivo afectado:** [dashboard-api.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/dashboard-api.ts) (línea 122)

> [!WARNING]
> La función `buildIdentityQuery()` envía prioritariamente el `slug` y solo usa `barberia_id` como fallback. Si la URL tiene un `barberia_id` válido pero un `slug` antiguo, se hidratará el panel con los datos correspondientes al slug obsoleto, comprometiendo la seguridad entre tenants.

### 2.5 Fallbacks con Datos Ficticios (Mockups)
* **Archivo afectado:** [dashboard-api.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/dashboard-api.ts) (línea 222)

> [!CAUTION]
> Si falla la llamada a `dashboard/state`, el sistema consulta las tablas directamente por PostgREST. Si no encuentra barberos, genera datos artificiales (p. ej., "Alex M.", "James V.") en el frontend. Esto oculta fallos reales de permisos o de base de datos y rompe la regla de **"no datos inventados"**.

### 2.6 Ocultación de Errores con Caché Local
* **Archivo afectado:** [dashboard-context.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/store/dashboard-context.tsx) (línea 257)

> [!NOTE]
> Si la carga remota falla, el Dashboard recurre a la caché del storage y ejecuta `setError(null)`. Para el usuario, el panel parece funcional y sin problemas, pero en realidad podría estar visualizando información obsoleta.

### 2.7 Escalada de Permisos por Defecto
* **Archivo afectado:** [dashboard-access.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/dashboard-access.ts) (línea 80)

> [!CAUTION]
> Si no se detecta un rol válido en el estado del usuario, el sistema devuelve `"admin"` por defecto. Además, si no hay un usuario identificado, toma `rawState?.identity?.barberia_id` como `userId`. Esto es un fallo de seguridad crítico en entornos multi-tenant.

### 2.8 Plantillas Públicas priorizan el Slug
* **Archivo afectado:** [index_unico_v5_1_azul_rojo_elegante.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html) (línea 2437)

> [!NOTE]
> La plantilla pública consulta por `slug` si está disponible, y si no, usa `barberia_id`. Al igual que en el Dashboard, esto produce hidrataciones incorrectas en landings públicas si se recibe una combinación desactualizada.

---

## 💾 3. Hallazgos Críticos de Persistencia

> [!IMPORTANT]
> **Hallazgo Mayor:** El módulo de Citas y la administración de Servicios están funcionando de manera aislada en el estado local de la aplicación, sin persistencia directa en la base de datos PostgreSQL.

### 3.1 Citas en LocalStorage
* **Archivo afectado:** [src/app/citas/page.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/citas/page.tsx)

* **Problema:** Al registrar o editar una cita, la aplicación ejecuta `setRequests(...)` y persiste únicamente en `localStorage` usando la llave `ba_dashboard_reservas`. No existe ninguna llamada a PostgREST, RPC ni webhook de n8n para guardarlas en la tabla `public.citas`.

### 3.2 Mezcla de Reservas Fantasma
* **Archivo afectado:** [dashboard-editor.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/components/dashboard-editor.tsx)

* **Problema:** La vista del editor lee los registros de citas guardados en la caché local (`localStorage`) y, si `merged.appointments` trae datos del servidor, mezcla ambos. Esto genera citas "fantasma" que el usuario visualiza en pantalla pero que no existen físicamente en la base de datos PostgreSQL.

### 3.3 Servicios no Persistidos
* **Archivo afectado:** [src/app/servicios/page.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/servicios/page.tsx)

* **Problema:** Lee del estado unificado `merged.services`, pero los botones para crear, editar o eliminar servicios no ejecutan ninguna mutación remota. Son puramente interactivos en el frontend.

---

## 🎯 4. Plan de Acción y Recomendaciones

Para blindar la arquitectura y asegurar que PostgreSQL sea la única fuente de verdad real (`barberias`, `servicios`, `barberos`, `horarios`, `clientes_finales`, `citas`, `pagos`), se deben priorizar las siguientes acciones:

1. **Jerarquía Única de Identidad:**
   * La sesión autenticada (`session/me` en el backend) debe ser la autoridad de identidad máxima, seguida por la consulta directa a base de datos.
   * Evitar el uso de `localStorage` o `cache` local como fuentes autoritativas; solo deben servir como cachés de lectura temporal con expiración.
2. **Corrección de Horarios:**
   * Remover el `.filter((item) => item.activo)` en el frontend del core ([registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html)) para enviar siempre los 7 días completos al backend.
3. **Validación Cruzada ID-Slug:**
   * En el Dashboard y el editor de landing, si se reciben tanto `barberia_id` como `slug`, validar que correspondan al mismo registro antes de hidratar los datos. Si no coinciden, invalidar el caché.
4. **Remoción de Fallbacks Artificiales:**
   * Eliminar la creación de barberos artificiales en producción si la base de datos retorna vacío.
   * Mostrar mensajes de error claros en lugar de cargar datos antiguos ocultando el error.
5. **Persistencia Directa de Citas y Servicios:**
   * Conectar las acciones de creación/edición en [src/app/citas/page.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/citas/page.tsx) y [src/app/servicios/page.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/servicios/page.tsx) con la API REST de Supabase/PostgREST o el webhook de n8n para asegurar almacenamiento en PostgreSQL.









   posibles Soluciones  de Codex antigravitycli y chatgpt 

   - las soluciones debes ser para desarrollo 

   # 📋 Diagnóstico General de BarberAgency

## Consolidación de Hallazgos (Codex + Antigravity CLI + Gemini + Revisión Técnica)

**Fecha:** 04 de Junio de 2026

**Proyecto:** BarberAgency

**Objetivo del análisis:** Identificar la causa raíz de los problemas de sincronización, identidad, persistencia y seguridad en la arquitectura actual.

---

# 🎯 Resumen Ejecutivo

Después de consolidar los hallazgos obtenidos por Codex, Antigravity CLI, Gemini y la revisión técnica del repositorio, la conclusión es clara:

> BarberAgency no posee actualmente una Fuente Única de Verdad (Single Source of Truth - SSOT) completamente implementada.

Aunque PostgreSQL fue diseñado para ser la fuente principal de datos, actualmente existen múltiples mecanismos que compiten con ella:

```text
PostgreSQL
session/me
dashboard/state
localStorage
seedLandingData
query params
slug
barberia_id
fallbacks visuales
cache local
```

Como consecuencia, diferentes módulos del sistema pueden:

* Mostrar información distinta para la misma barbería.
* Hidratar datos incorrectos.
* Mantener información obsoleta.
* Generar inconsistencias entre Dashboard, Registro, Editor y Landing Pública.
* Exponer riesgos de seguridad multi-tenant.

---

# 🔴 Hallazgo 1: Crisis de Identidad Multi-Tenant

## Situación Actual

Actualmente la identidad de una barbería puede resolverse desde múltiples fuentes:

```text
URL
localStorage
seedLandingData
sessionStorage
slug
barberia_id
window.BA_*
session/me
```

Dependiendo de la pantalla o flujo utilizado.

---

## Riesgos

### Contaminación entre Barberías

Un usuario puede abrir varias barberías simultáneamente en distintas pestañas.

Ejemplo:

```text
Pestaña A → Barbería Alpha
Pestaña B → Barbería Beta
```

El localStorage compartido puede provocar:

```text
Dashboard Alpha
↓
Carga seed de Beta
↓
Datos mezclados
```

---

### Hidratación Incorrecta

Actualmente existen casos donde:

```text
slug = barberia-61
barberia_id = 198
```

y el sistema intenta decidir cuál utilizar.

Esto puede provocar:

* Carga de barbería equivocada.
* Modificación de datos incorrectos.
* Publicación sobre otra barbería.
* Fuga de información entre tenants.

---

## Conclusión

La identidad debe construirse únicamente desde:

```text
session/me
+
barberia_id validado por backend
```

Todo lo demás debe ser información auxiliar.

---

# 🔴 Hallazgo 2: Persistencia Incompleta

## Situación Actual

Existen módulos que trabajan únicamente en frontend sin persistencia real.

---

## Caso 1: Citas

Actualmente:

```text
Formulario
↓
Estado React
↓
localStorage
```

en lugar de:

```text
Formulario
↓
API
↓
PostgreSQL
```

---

### Consecuencias

* Citas desaparecen al limpiar caché.
* Citas no visibles desde otros dispositivos.
* Calendarios inconsistentes.
* Reservas fantasma.

---

## Caso 2: Servicios

Existen operaciones visuales que no generan mutaciones reales.

El usuario puede creer que:

```text
Servicio creado
```

cuando realmente:

```text
No existe en PostgreSQL
```

---

## Conclusión

Toda operación CRUD debe terminar obligatoriamente en:

```text
PostgreSQL
```

No debe existir lógica de negocio persistida únicamente en:

```text
localStorage
estado React
cache local
```

---

# 🔴 Hallazgo 3: Fallbacks Ocultan Problemas Reales

## Situación Actual

Para evitar errores visuales se implementaron fallbacks como:

```text
Barberos ficticios
Datos simulados
Cache antigua
Seeds antiguas
setError(null)
```

---

## Problema

Cuando la base de datos falla:

```text
Usuario ve datos
```

aunque:

```text
Backend caído
Dashboard desconectado
Datos obsoletos
```

---

## Consecuencias

El sistema aparenta funcionar correctamente.

Los errores reales quedan ocultos.

El administrador no sabe que está trabajando sobre datos inválidos.

---

## Conclusión

En producción:

```text
Error real
↓
Mensaje claro
```

Nunca:

```text
Error real
↓
Datos inventados
```

---

# 🔴 Hallazgo 4: Riesgo Crítico de Seguridad

## Problema Detectado

En determinadas rutas existe lógica similar a:

```ts
return "admin";
```

cuando el sistema no puede resolver correctamente el rol.

---

## Riesgo

Un error de red, caché o hidratación podría derivar en:

```text
Usuario sin rol válido
↓
Admin por defecto
```

---

## Impacto

Riesgo de:

* Escalada de privilegios.
* Acceso a información sensible.
* Ruptura del aislamiento multi-tenant.

---

## Conclusión

Aplicar Principio de Menor Privilegio:

```text
Sin rol válido
=
Sin acceso
```

Nunca:

```text
Sin rol válido
=
Admin
```

---

# 🔴 Hallazgo 5: Sincronización Incorrecta de Horarios

## Situación Actual

El frontend filtra únicamente los horarios activos:

```javascript
horarios.filter(item => item.activo)
```

---

## Problema

La RPC nunca recibe:

```text
activo = false
```

por lo que no puede desactivar correctamente días.

---

## Consecuencia

Un día que fue habilitado puede permanecer abierto indefinidamente.

Ejemplo:

```text
Martes abierto
↓
Usuario intenta cerrarlo
↓
Frontend no lo envía
↓
BD nunca lo desactiva
```

---

## Conclusión

Siempre enviar:

```text
Los 7 días completos
```

incluyendo:

```text
activo = true
activo = false
```

---

# 🏗️ Causa Raíz Arquitectónica

Todos los hallazgos apuntan a una misma causa:

> Existen múltiples fuentes compitiendo por la autoridad de los datos.

Actualmente:

```text
PostgreSQL
localStorage
seedLandingData
cache
slug
query params
```

compiten entre sí.

---

## Lo Correcto

La arquitectura debería funcionar así:

```text
Usuario autenticado
↓
session/me
↓
barberia_id validado
↓
dashboard/state
↓
PostgreSQL
↓
Render UI
```

---

## Lo Incorrecto

```text
URL
↓
slug
↓
cache vieja
↓
seed antigua
↓
fallback
↓
render
```

---

# 🎯 Arquitectura Objetivo

## Autoridad de Identidad

```text
session/me
```

---

## Autoridad de Barbería

```text
barberia_id validado por backend
```

---

## Autoridad de Datos

```text
dashboard/state
```

---

## Autoridad de Persistencia

```text
PostgreSQL
```

---

## Caché

Permitido únicamente para:

```text
UX
performance
borradores temporales
```

Nunca para:

```text
identidad
roles
permisos
datos canónicos
```

---

# 🚀 Plan de Implementación Priorizado

## P0 — Crítico

### 1. Seguridad

* Eliminar admin por defecto.
* Bloquear acceso sin rol válido.

### 2. Identidad

Implementar:

```text
session/me
```

como autoridad única.

### 3. Validación

Validar siempre:

```text
barberia_id ↔ slug
```

Si no coinciden:

```text
403
No hidratar
No usar cache
```

---

## P1 — Alta Prioridad

### 4. Eliminar Fallbacks Artificiales

Eliminar:

* Barberos mock.
* Datos ficticios.
* Correcciones silenciosas.

### 5. Corregir Horarios

Enviar siempre:

```text
7 días completos
```

### 6. Limpiar Cachés

Invalidar:

```text
ba_landing_seed
ba_barberia_id
ba_barberia_slug
```

cuando cambie la barbería activa.

---

## P2 — Persistencia Real

### 7. Servicios

CRUD conectado a backend.

### 8. Citas

CRUD conectado a PostgreSQL.

### 9. Revalidación

Después de cada mutación:

```text
dashboard/state
```

debe recargarse.

---

# ✅ Resultado Esperado

Una vez implementado:

```text
Usuario real
↓
session/me

Barbería real
↓
barberia_id validado

Estado real
↓
dashboard/state

Persistencia real
↓
PostgreSQL

Cache
↓
solo temporal
```

---

# Conclusión Final

BarberAgency posee una base sólida y una arquitectura multi-tenant bien encaminada. Sin embargo, todavía conserva mecanismos heredados de desarrollo (seeds, localStorage, fallbacks y estados locales) que compiten con PostgreSQL como fuente de verdad.

La solución no consiste en corregir pantallas individuales.

La solución consiste en establecer una jerarquía única de autoridad para identidad, permisos, hidratación y persistencia.

Una vez implementada esta jerarquía, el sistema tendrá:

* Consistencia de datos.
* Seguridad multi-tenant.
* Persistencia real.
* Trazabilidad.
* Escalabilidad para producción.
* Menor complejidad de mantenimiento.

Y PostgreSQL pasará a ser, finalmente, la única fuente de verdad del negocio.

---

## 📝 Registro de Validación: Paso 1 (Backend de Identidad)
**Fecha:** 04 de Junio de 2026  
**Cambio:** Refactorización del nodo `Code - build response` en el workflow `BarberAgency - Session Me v2` para evitar la escalación de privilegios a admin por defecto.

### Cambios Aplicados en n8n:
* Se reemplazó la lógica que asignaba `"admin"` por defecto al rol si no existía `current_barberia`.
* Se implementó la resolución del rol como:
  ```javascript
  role: currentBarberia?.role ?? null
  ```
* Se inyectó el objeto de permisos (`permissions: {}`) a nivel raíz de la respuesta exitosa para que sea integrado correctamente por el frontend.

### Resultados de las Pruebas de Sincronización:
1. **Prueba Sin Cookie:**
   * **Método:** `GET /webhook/barberagency/session/me` sin cabecera de cookie.
   * **Resultado:** `401 Unauthorized` con el cuerpo `{"ok":false,"message":"Sesion no valida","next_action":"login"}`. **(Estado: PASS ✅)**
2. **Prueba Con Cookie Válida:**
   * **Resultado:** Devuelve la identidad del usuario, su listado de `barberias[]`, la `current_barberia`, el `role` real y el objeto `permissions: {}` a nivel raíz. **(Estado: PASS ✅)**
3. **Prueba Sin `current_barberia`:**
   * **Resultado:** Si el usuario no tiene barberías o no hay una activa, el campo `role` se evalúa como `null` (en lugar de admin), lo que restringe el acceso de forma segura. **(Estado: PASS ✅)**



SOLUCION 
# 📋 BarberAgency - Plan Maestro de Fuente Única de Verdad (SSOT)

## Versión Producción

**Fecha:** Junio 2026

**Objetivo Principal:**

Implementar una arquitectura donde exista una única fuente de verdad para identidad, permisos, hidratación y persistencia.

Toda corrección futura deberá construirse sobre esta base.

---

# 🎯 Principio Rector

La prioridad NO es arreglar citas.

La prioridad NO es arreglar servicios.

La prioridad NO es arreglar horarios.

La prioridad NO es arreglar QR.

La prioridad es implementar primero una Fuente Única de Verdad (SSOT).

Una vez exista la SSOT, los demás módulos se conectarán a ella.

---

# 🏗️ Arquitectura Objetivo

## Autoridad de Identidad

```text
session/me
```

Responsable de determinar:

```text
usuario autenticado
roles
barberías permitidas
barbería activa
permisos
```

---

## Autoridad de Tenant

```text
barberia_id validado por backend
```

Responsable de determinar:

```text
qué barbería se carga
qué datos puede ver el usuario
qué datos puede modificar
```

---

## Autoridad de Estado

```text
dashboard/state
```

Responsable de entregar:

```text
servicios
barberos
horarios
citas
branding
estadísticas
```

---

## Autoridad de Persistencia

```text
PostgreSQL
```

Tablas oficiales:

```text
usuarios
barberias
servicios
barberos
horarios
clientes_finales
citas
pagos
productos
gastos
```

---

# ❌ Lo que deja de ser autoridad

Estas fuentes pueden existir únicamente como cache temporal:

```text
localStorage
sessionStorage
seedLandingData
window.BA_*
slug
estado React
cache de dashboard
drafts locales
```

Nunca podrán decidir:

```text
qué barbería cargar
qué usuario es
qué rol tiene
qué datos son reales
```

---

# 🚨 FASE 1 — Construcción de la Fuente de Verdad

## Objetivo

Crear la base sobre la que se construirá todo el sistema.

Sin esta fase terminada no se deben corregir módulos funcionales.

---

# 1. Backend de Identidad

## Canal afectado

```text
n8n
PostgreSQL
Dashboard
```

---

## Crear endpoint oficial

```text
GET /webhook/barberagency/session/me
```

Debe devolver:

```json
{
  "user": {},
  "role": "admin",
  "current_barberia": {},
  "barberias": []
}
```

---

## Validaciones

Debe validar:

```text
cookie JWT
usuario
owner_id
estado de barbería
rol
```

---

## Pruebas Postman

### Caso 1

Usuario autenticado.

Resultado esperado:

```text
200
```

---

### Caso 2

Usuario sin cookie.

Resultado esperado:

```text
401
```

---

### Caso 3

Usuario con varias barberías.

Resultado esperado:

```text
lista completa
```

---

# 2. Dashboard deja de usar localStorage como autoridad

## Canal afectado

```text
Dashboard Next.js
```

---

## Archivos

```text
src/lib/barbershop-context.ts
src/store/dashboard-context.tsx
src/lib/dashboard-api.ts
```

---

## Eliminar autoridad de

```text
localStorage
sessionStorage
seedLandingData
window.BA_*
env fallback
```

---

## Nueva jerarquía

```text
session/me
↓
barberia_id validado
↓
dashboard/state
↓
render
```

---

# 3. Seguridad de Roles

## Canal afectado

```text
Dashboard
```

---

## Archivo

```text
src/lib/dashboard-access.ts
```

---

## Corregir

Eliminar cualquier lógica:

```ts
return "admin";
```

---

## Regla definitiva

```text
sin rol válido
=
sin acceso
```

---

## Pruebas

Simular:

```text
rol vacío
rol inválido
sin sesión
```

Resultado:

```text
403
```

---

# 4. Validación Universal barberia_id + slug

## Canales afectados

```text
Dashboard
Editor
Landing pública
Registro edición
```

---

## Implementar

```ts
validateBarbershopIdentity()
```

---

## Regla

Si llegan:

```text
barberia_id
slug
```

ambos deben pertenecer al mismo registro.

---

## Si no coinciden

```text
403
sin hidratación
sin cache
sin corrección automática
```

---

## Pruebas Postman

```text
ID correcto + slug correcto
ID correcto + slug incorrecto
ID inexistente
slug inexistente
```

---

# 5. Eliminar Fallbacks Productivos

## Canales afectados

```text
Dashboard
Editor
Landing
```

---

## Eliminar

```text
Alex M.
James V.
barberos ficticios
servicios ficticios
cache silenciosa
setError(null)
```

---

## Nuevo comportamiento

Si falla:

```text
dashboard/state
```

Mostrar:

```text
No se pudo cargar la fuente de verdad.
```

---

# 🚨 FASE 2 — Consolidación de Persistencia

IMPORTANTE:

No iniciar esta fase hasta completar Fase 1.

---

# 6. Horarios

## Canal afectado

```text
Plantillas Core
RPC PostgreSQL
```

---

## Archivo

```text
registrobarberia.html
```

---

## Corregir

Eliminar:

```js
horarios.filter(item => item.activo)
```

Enviar:

```js
p_horarios: horarios
```

---

## Validar

```sql
SELECT *
FROM horarios
WHERE barberia_id = ?
```

---

# 7. Servicios

## Canales afectados

```text
Dashboard
n8n
PostgreSQL
```

---

## Crear endpoints

```text
/dashboard/servicios/upsert
/dashboard/servicios/delete
```

---

## Persistencia

Tabla:

```text
public.servicios
```

---

## Postman

Crear.

Editar.

Eliminar.

Validar en BD.

---

# 8. Barberos

## Canales afectados

```text
Dashboard
n8n
PostgreSQL
```

---

## Crear endpoints

```text
/dashboard/barberos/upsert
/dashboard/barberos/delete
```

---

## Persistencia

Tabla:

```text
public.barberos
```

---

## Postman

Crear.

Editar.

Desactivar.

Validar en BD.

---

# 9. Citas

## Canales afectados

```text
Dashboard
n8n
PostgreSQL
```

---

## Eliminar

```text
ba_dashboard_reservas
```

como fuente de verdad.

---

## Crear endpoints

```text
/dashboard/citas/upsert
/dashboard/citas/cancel
```

---

## Persistencia

Tabla:

```text
public.citas
```

---

## Validaciones

```text
barbero
servicio
fecha
hora
tenant
solape
```

---

## Postman

Crear.

Editar.

Cancelar.

Verificar en BD.

---

# 🚨 FASE 3 — Limpieza Final

# 10. Limpieza de Seeds

## Canales afectados

```text
Editor
Dashboard
Landing
```

---

## Revisar

```text
ba_landing_seed
ba_barberia_id
ba_barberia_slug
ba_dashboard_cache
```

---

## Regla

Cache:

```text
permitida
```

Autoridad:

```text
prohibida
```

---

# 11. Limpieza de Editor

## Archivo

```text
landing_editor_v2_unico_vscode.html
```

---

## Nuevo orden

```text
session/me
↓
query válida
↓
cache compatible
↓
error
```

---

# 🚨 FASE 4 — Certificación Producción

La implementación NO se considera terminada hasta completar:

---

## Test Seguridad

```text
usuario sin rol
usuario sin sesión
usuario sin barbería
```

---

## Test Multi-Tenant

```text
barbería A
barbería B
```

en pestañas simultáneas.

---

## Test Identidad

```text
slug incorrecto
barberia_id correcto
```

Debe bloquear.

---

## Test Horarios

Activar.

Desactivar.

Verificar en PostgreSQL.

---

## Test Servicios

CRUD completo.

Verificar PostgreSQL.

---

## Test Barberos

CRUD completo.

Verificar PostgreSQL.

---

## Test Citas

CRUD completo.

Verificar PostgreSQL.

---

# ✅ Criterio Final de Éxito

BarberAgency solo se considera estabilizado cuando:

```text
session/me decide identidad
barberia_id decide tenant
dashboard/state decide datos
PostgreSQL decide persistencia
```

Y ninguna otra capa del sistema puede actuar como fuente de verdad.

En ese momento:

```text
Dashboard
n8n
PostgreSQL
Plantillas
Editor
Landing
```

trabajarán sobre una única realidad de datos, eliminando definitivamente conflictos de sincronización, contaminación de tenants y datos fantasma.

---

# 📌 Cierre obligatorio de cada tarea

Al finalizar cada tarea o fase, el agente debe guardar los cambios en GitHub con un commit claro y descriptivo. Antes de hacer commit debe ejecutar las pruebas correspondientes, documentar qué se modificó, qué archivos fueron tocados, qué endpoints se probaron en Postman y qué validaciones se realizaron en PostgreSQL/pgAdmin. El commit debe incluir solo cambios relacionados con la tarea actual, evitando mezclar correcciones de otras fases. Después del commit, el agente debe dejar un resumen breve con: objetivo de la tarea, archivos modificados, pruebas ejecutadas, resultado obtenido, riesgos pendientes y hash del commit generado.

---

## 📝 Registro de Validación: Paso 2 (Quitar localStorage como Autoridad de Identidad)
**Fecha:** 04 de Junio de 2026  
**Proyecto:** Panel de Barbería Next.js  
**Rama:** `principal`  
**Commit Hash Principal:** `361d26c09ad4ab38a9742072f215b3d5a9d2e933`  
**Commit Hash Correcciones (Blockers):** `a6ca125ace936c953af3f8492f70b313435c77bf`

### Lógica anterior eliminada:
* Se eliminó el fallback de identidad basado en semillas (`fromSeed`) y variables de entorno fallback (`testBarberiaId` / `testBarberiaSlug`) en el flujo de producción.
* Se eliminó la lectura de `localStorage` y `sessionStorage` como fuentes autoritativas de identidad de la barbería en `resolveBarbershopIdentity()`.
* Se eliminó la resolución de rol `'admin'` por defecto ante valores inválidos en `normalizeRole()` en `dashboard-access.ts`, mapeándose ahora al nuevo rol `'guest'` con `NO_PERMISSIONS`.
* Se eliminó la recuperación silenciosa de errores con datos en caché obsoletos en `loadState()` (ya no silencia errores con `setError(null)`).

### Bloqueadores Corregidos:
1. **Remoción de Admin y ALL_PERMISSIONS por defecto**: Si el rol recibido de `session/me` es nulo o inválido, el fallback de seguridad del dashboard se asigna a `"guest"` y los permisos a `NO_PERMISSIONS`.
2. **Validación de URL Estricta (AND)**: Si llegan tanto `barberia_id` como `slug`, el sistema valida que ambos pertenezcan al mismo registro en `barberias[]` de `session/me`, en lugar de usar un operador `OR` que permitía cruces de identidades.
3. **No fallback automático sin current_barberia**: Si el backend no devuelve una barbería activa (`current_barberia`) y el usuario tiene barberías disponibles, se detiene la carga solicitando al usuario una selección explícita con el mensaje `"Por favor, selecciona una barbería para continuar."`, en lugar de asignar por defecto el primer elemento.

### Nueva Jerarquía de Identidad:
```text
session/me (Autoridad de Identidad)
↓
URL (Candidata Validada contra barberias[])
↓
current_barberia (Autoridad de Tenant)
↓
dashboard/state (Autoridad de Estado/Datos)
↓
Render UI
```

### Validación de URL contra `session/me`:
1. Se busca el `barberia_id` o `slug` de la URL en la lista de `barberias` retornada por `session/me`.
2. Si se encuentra correspondencia exacta, se establece como la identidad activa.
3. Si no se encuentra (mismatch o intento de acceso a otra barbería), se aborta la carga, se limpia la sesión, y se muestra un error **403 visual** en el Dashboard.

### Resultados de las Pruebas de Sincronización:
1. **Prueba Sin Cookie:**
   * **Comportamiento:** El dashboard se inicia en estado bloqueado, borra cualquier referencia vieja e indica al usuario que inicie sesión. **(Estado: PASS ✅)**
2. **Prueba Con Cookie Válida y Sin URL:**
   * **Comportamiento:** Carga exitosamente `current_barberia` de la sesión de `session/me`. **(Estado: PASS ✅)**
3. **Prueba Con Cookie Válida + URL Autorizada:**
   * **Comportamiento:** Carga y valida correctamente la barbería solicitada por la URL en base a la lista `barberias[]`. **(Estado: PASS ✅)**
4. **Prueba Con Cookie Válida + URL No Autorizada (403):**
   * **Comportamiento:** El sistema detecta el mismatch y muestra el error `"403 - No tienes permisos para acceder a esta barbería."` de forma visual, bloqueando cualquier render e hidratación de datos. **(Estado: PASS ✅)**
5. **Prueba Con LocalStorage Contaminado:**
   * **Comportamiento:** Al alterar `ba_barberia_id` en `localStorage` con un ID falso y refrescar la página, el sistema lo ignora por completo y resuelve la barbería real a través de `session/me`. **(Estado: PASS ✅)**
6. **Prueba con URL con ID Válido + Slug de otra Barbería:**
   * **Comportamiento:** La validación estricta (AND) falla debido al mismatch de slug. Bloquea e informa del error 403. **(Estado: PASS ✅)**
7. **Prueba con Usuario sin Rol/Permisos:**
   * **Comportamiento:** Se le asigna el rol `"guest"` y permisos `NO_PERMISSIONS`, denegando acceso visual. **(Estado: PASS ✅)**

---

## 📝 Registro de Validación: Paso 3 (Eliminar Fallbacks Productivos y Datos Ficticios)
**Fecha:** 04 de Junio de 2026  
**Proyecto:** Panel de Barbería Next.js  
**Rama:** `principal`  
**Commit Hash:** `af3314fb1720bef036517fe70f24329b344eda10`

### Cambios Aplicados en la API del Dashboard:
* **Propagación del Error Real**: En `getDashboardState()` (`dashboard-api.ts`), si la llamada remota falla y `env.disableRemoteFetch` es falso, la API lanza directamente el error original sin aplicar fallbacks.
* **Mocks Restringidos a Desarrollo**: Se restringieron los barberos mock ("Alex M.", "James V.") y servicios mock para que solo se utilicen cuando `env.disableRemoteFetch` sea estrictamente `true`.
* **Cero Silenciamiento de Errores**: Al fallar `dashboard/state`, el dashboard limpia los datos en memoria (`EMPTY_MERGED`) y muestra el mensaje claro `"No se pudo cargar la fuente de verdad"`, sin invocar la caché vieja silenciosamente con `setError(null)`.

### Resultados de las Pruebas de Sincronización:
1. **Simulación de Error 500 en dashboard/state:**
   * **Comportamiento:** La UI no maquilla el error y muestra de forma clara el bloqueo `"No se pudo cargar la fuente de verdad."`. **(Estado: PASS ✅)**
2. **Simulación de Respuesta Vacía:**
   * **Comportamiento:** Detiene la carga, limpia la memoria y presenta el error controlado. **(Estado: PASS ✅)**
3. **Simulación de Barbería sin Barberos (Vacia):**
   * **Comportamiento:** Carga la barbería con `merged.barbers` vacío (`[]`) en lugar de inventar barberos. La interfaz muestra 0 barberos de forma correcta. **(Estado: PASS ✅)**
4. **Confirmación de No Datos Falsos en Producción:**
   * **Comportamiento:** Ningún barbero mock o servicio mock es inyectado. **(Estado: PASS ✅)**

---

## 📝 Registro de Validación: Paso 4 (Corregir Sincronización Completa de Horarios)
**Fecha:** 04 de Junio de 2026  
**Proyecto:** Core (Onboarding y Registro) & PostgreSQL  
**Rama:** `main`  
**Commit Hash:** `c5a702e5c0399d1e269e373afbdaa339079b7688`

### Lógica anterior eliminada:
* Se eliminó el filtro `.filter((item) => item.activo)` en el frontend (`registrobarberia.html` -> `syncCanonicalHours`) que impedía el envío de los días inactivos a la RPC.
* Se actualizó la lógica SQL en `ba_sync_registro_horarios` que anteriormente omitía la actualización de horas (`hora_abre`, `hora_cierra`) al cambiar un día a inactivo.

### Nuevas Reglas Aplicadas:
1. **Envío Completo**: Se transmiten siempre los 7 días de la semana en el payload de sincronización de horarios.
2. **Estructura Requerida**: Cada día enviado a la RPC incluye obligatoriamente `dia_semana`, `hora_abre`, `hora_cierra` y `activo`.
3. **Persistencia Total**: La base de datos es ahora capaz de registrar la desactivación de días previamente activos, actualizar horarios de días activos, y guardar cambios de horas incluso para días inactivos sin alterar la integridad de los datos.

### Resultados de las Pruebas de Sincronización:
1. **Prueba 1: Abrir martes:**
   * **Comportamiento:** Martes (`dia_semana: 2`) se marca como `activo = true` con horario `09:00` - `18:00`. La base de datos actualiza el registro de forma correcta. **(Estado: PASS ✅)**
2. **Prueba 2: Cerrar martes:**
   * **Comportamiento:** Martes (`dia_semana: 2`) se cambia a `activo = false`. La base de datos recibe el día y aplica `activo = false` correctamente a través de `ON CONFLICT DO UPDATE`. **(Estado: PASS ✅)**
3. **Prueba 3: Cambiar horario de apertura:**
   * **Comportamiento:** Se modifica el horario de apertura y cierre del martes (`10:30` - `21:30`) y se guarda. La base de datos realiza la actualización de las horas en PostgreSQL de manera inmediata. **(Estado: PASS ✅)**
4. **Prueba 4: Verificar que los 7 días llegan al payload:**
   * **Comportamiento:** Se comprueba que los 7 días (dia_semana 0 a 6) son sincronizados y persisten de manera estructurada en la tabla `public.horarios`. **(Estado: PASS ✅)**
5. **Prueba 5: Verificación de compilación (npx tsc):**
   * **Comportamiento:** Compilación del frontend del dashboard se ejecuta sin problemas ni errores. **(Estado: PASS ✅)**

---

## 📝 Registro de Validación: Paso 6 (Persistencia Real de Citas)
**Fecha:** 05 de Junio de 2026  
**Proyecto:** Core (Citas, Clientes) & Panel de Barbería Next.js & n8n Webhook & PostgreSQL  
**Rama:** `main` (Core) / `principal` (Panel)

### Cambios Aplicados en la Persistencia de Citas:
* **Workflow n8n de Citas**: Se actualizó el endpoint `/webhook/barberagency/dashboard/citas` (`jRi8fOiFwBGziCX5`) para validar cookies de sesión (`ba_session`), token JWT, pertenencia de barbería, rol autorizado, y la correspondencia de `barbero_id` / `servicio_id` con la barbería del usuario.
* **Inserción/Upsert de Clientes**: En `add_cita`, el workflow ahora busca clientes en `public.clientes_finales` por `barberia_id` + `telefono`. Si existe, reutiliza el `cliente_id`, y si no, realiza un INSERT y asocia el nuevo `cliente_id` a la cita.
* **Borrado Lógico**: La acción `cancel_cita` realiza un `UPDATE` en la tabla `public.citas` fijando `estado = 'cancelada'`, sin borrar físicamente el registro.
* **Reglas de Negocio en Base de Datos**: PostgreSQL se mantiene como la única autoridad para validar horarios, slot_min, pertenencia de servicios/barberos, y colisiones de horarios mediante la restricción de exclusión `ex_citas_no_solape`.
* **Frontend sin LocalStorage**: En `citas/page.tsx`, se removió la clave `ba_dashboard_reservas` y `ba_locally_paid_appointments` de `localStorage` como fuentes de persistencia. El estado local y los renders se nutren únicamente del servidor mediante el hook `useDashboard()`, y se ejecuta `refresh()` tras cada operación CRUD exitosa para mantener el panel sincronizado en tiempo real.

### Resultados de las Pruebas de Persistencia y CRUD (Postman + Integration Script):
1. **Test 1: Sin Cookie (401 Unauthorized)**
   * **Comportamiento:** Retorna código HTTP 401 y el mensaje `"Sesion no valida"`. **(Estado: PASS ✅)**
2. **Test 2: Cookie Válida + Barbería Ajena (403 Forbidden)**
   * **Comportamiento:** Retorna código HTTP 403 y el mensaje `"No tienes permisos para esta barberia"`. **(Estado: PASS ✅)**
3. **Test 3: Crear Cita Válida**
   * **Comportamiento:** Retorna código HTTP 200, guarda el registro en `public.citas` asociándolo con el cliente final creado. **(Estado: PASS ✅)**
4. **Test 4: Verificar en Postgres (Creación)**
   * **Comportamiento:** Verifica que el registro de la cita y el del cliente final existan físicamente en PostgreSQL y estén vinculados correctamente. **(Estado: PASS ✅)**
5. **Test 5: Crear Cita con Barbero Ajeno**
   * **Comportamiento:** Retorna código HTTP 400 y el mensaje `"El barbero no pertenece a esta barberia o no existe"`. **(Estado: PASS ✅)**
6. **Test 6: Crear Cita con Servicio Ajeno**
   * **Comportamiento:** Retorna código HTTP 400 y el mensaje `"El servicio no pertenece a esta barberia o no existe"`. **(Estado: PASS ✅)**
7. **Test 7: Crear Cita Solapada (Double Booking)**
   * **Comportamiento:** La restricción `ex_citas_no_solape` lanza un error en PostgreSQL. N8n lo intercepta y responde con código HTTP 400 y el mensaje limpio `"El barbero seleccionado ya tiene una cita agendada en ese horario."`. **(Estado: PASS ✅)**
8. **Test 8: Cancelar Cita (Soft Delete)**
   * **Comportamiento:** Retorna código HTTP 200 y establece el estado de la cita en `'cancelada'`. **(Estado: PASS ✅)**
9. **Test 9: Verificar en Postgres (Cancelación)**
   * **Comportamiento:** Se comprueba en PostgreSQL que la cita persiste físicamente pero tiene `estado = 'cancelada'`. **(Estado: PASS ✅)**
10. **Test 10: Slot Cancelado Queda Libre**
    * **Comportamiento:** Al re-agendar una cita en el mismo slot previamente cancelado, la base de datos lo permite exitosamente ya que la exclusión solo aplica a estados activos (`confirmada`/`pendiente`). **(Estado: PASS ✅)**
11. **Test 11: Editar Cita**
    * **Comportamiento:** Modifica la hora de inicio y el nombre del cliente de la cita recién creada, retornando código HTTP 200. **(Estado: PASS ✅)**
12. **Test 12: Verificar en Postgres (Edición)**
    * **Comportamiento:** Comprueba que los cambios persistan en la base de datos PostgreSQL de forma correcta. **(Estado: PASS ✅)**

### Evidencia de Registros en PostgreSQL:

**Consulta de Citas en public.citas:**
```json
[
  {
    "id": 167,
    "barberia_id": 1,
    "barbero_id": 2,
    "servicio_id": 1,
    "cliente_id": 134,
    "cliente_nombre": "Test-Cita-Cliente-Modificado",
    "cliente_tel": "3009876545",
    "fecha": "2026-06-08T00:00:00.000Z",
    "hora_inicio": "11:00:00",
    "hora_fin": "11:30:00",
    "estado": "confirmada"
  },
  {
    "id": 165,
    "barberia_id": 1,
    "barbero_id": 2,
    "servicio_id": 1,
    "cliente_id": 132,
    "cliente_nombre": "Test-Cita-Cliente",
    "cliente_tel": "3009876543",
    "fecha": "2026-06-08T00:00:00.000Z",
    "hora_inicio": "10:00:00",
    "hora_fin": "10:30:00",
    "estado": "cancelada"
  }
]
```

**Consulta de Clientes en public.clientes_finales:**
```json
[
  {
    "id": 134,
    "barberia_id": 1,
    "nombre": "Test-Cita-Cliente-Modificado",
    "telefono": "3009876545"
  },
  {
    "id": 132,
    "barberia_id": 1,
    "nombre": "Test-Cita-Cliente",
    "telefono": "3009876543"
  }
]
```



