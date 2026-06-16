# Plan de Pruebas de Hidratación de Registro / Onboarding en Producción (Same-Origin)

Este documento detalla el procedimiento para realizar la validación de QA de la hidratación del onboarding en producción sin alterar la página real de los usuarios, utilizando la solución same-origin implementada.

---

## 1. Objetivo de la Prueba

Validar que el asistente de configuración (`registrobarberia.html`) hidrate correctamente datos reales desde la API del panel:
```
/api/dashboard/state?barberia_id=198&slug=barberia-prueba-4
```
bajo un mismo origen común (same-origin), sin errores de CORS y garantizando que el navegador envíe automáticamente la cookie de sesión `ba_session`.

---

## 2. Archivo de Prueba Creado

* **Ubicación en el repositorio:** `project/templates/qa/registro-barberias-qa-hidratacion.html`
* **Características especiales:**
  * Incluye un bloque visual de diagnóstico al inicio para verificar variables en tiempo real en la UI.
  * Emite logs detallados de depuración en la consola bajo el prefijo `[QA-HIDRATACION]`.
  * Realiza la llamada asíncrona mediante URLs relativas y la directiva `credentials: "include"`.

---

## 3. Instrucciones de Despliegue en WordPress (Entorno de QA)

Para instalar y habilitar la página de pruebas en WordPress:

1. Acceder al panel de administración de WordPress en producción.
2. Ir a **Páginas** -> **Añadir nueva página**.
3. Configurar el título como: `Registro Barberías QA`.
4. En el enlace permanente (permalink) o slug, configurar exactamente:
   ```
   registro-barberias-qa
   ```
5. Cambiar el modo de edición de WordPress a **Editor de Código (o HTML personalizado)**.
6. Copiar el contenido completo del archivo local:
   👉 [registro-barberias-qa-hidratacion.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/qa/registro-barberias-qa-hidratacion.html)
7. Pegar todo el código en el editor de la página.
8. **Publicar** la página.
9. **IMPORTANTE:** No modifiques ni toques la página principal `/registro-barberias/` hasta que finalice y apruebe esta prueba de QA.

---

## 4. URL de Prueba en Producción

Una vez publicada la página, abrir la siguiente URL en modo incógnito (debes estar logueado previamente en el panel en la misma sesión del navegador):

👉 [URL de Prueba](https://barberagency-barberagency.gymh5g.easypanel.host/registro-barberias-qa/?mode=edit&barberia_id=198&slug=barberia-prueba-4)

---

## 5. Validaciones en DevTools (Network)

Al cargar la URL de prueba, abrir las herramientas de desarrollo del navegador (**F12**) y verificar en la pestaña **Network (Red)**:

1. Filtrar por: `state` o `/api/dashboard/state`.
2. Seleccionar la solicitud HTTP y verificar:
   * **Request URL:** Debe ser exactamente `https://barberagency-barberagency.gymh5g.easypanel.host/api/dashboard/state?barberia_id=198&slug=barberia-prueba-4`.
   * **Status Code:** `200 OK`.
   * **Request Headers:** Debe contener la cookie `ba_session` en el campo `Cookie`.
   * **CORS:** No debe existir ningún error de tipo CORS en la consola de red.
   * **Sin Redirecciones Externas:** No debe haber llamadas directas a `https://barberagency-app.gymh5g.easypanel.host/api/dashboard/state`.

---

## 6. Validaciones en Interfaz de Usuario (UI)

El bloque visual superior de diagnóstico de QA en la página debe mostrar:

* **Modo actual:** `EDIT (Edición)`
* **Barbería ID detectado:** `198`
* **Slug detectado:** `barberia-prueba-4`
* **HTTP Status Code:** `200`
* **Response OK (data.ok):** `true` (en color verde)
* **Servicios cargados:** `> 0`
* **Barberos cargados:** `> 0`
* **Horarios cargados:** `> 0`
* **stateUrl final calculada:** `/api/dashboard/state?barberia_id=198&slug=barberia-prueba-4`
* **Error detectado:** (Debe estar oculto o vacío).

---

## 7. Tabla de Diagnóstico y Casos de Error

| Código/Síntoma | Causa Probable | Diagnóstico / Mitigación |
| :--- | :--- | :--- |
| **HTTP 404** | El reverse proxy de EasyPanel no enruta `/api/*` a Next.js. | Validar la directiva `location` de Nginx en la app de WordPress en EasyPanel. |
| **HTTP 401** | La cookie `ba_session` no se está enviando o no hay sesión activa. | Asegurarse de que el usuario haya iniciado sesión previamente. Validar que la cabecera `credentials: "include"` esté presente en el fetch. |
| **HTTP 403** | El usuario autenticado no es propietario de la barbería ID 198. | La sesión no corresponde a la barbería solicitada. Intentar con una identidad propia del usuario. |
| **HTTP 502 / 504** | El contenedor Next.js (`barberagency-app`) está caído o inaccesible. | Validar en EasyPanel que el contenedor esté corriendo y respondiendo. |
| **HTTP 200 pero conteos en 0** | El backend respondió ok, pero no existen datos o el formato JSON cambió. | Revisar la respuesta JSON en Network para verificar si `servicios`, `barberos` o `seed/merged.hours` tienen nombres diferentes. |
| **Llamada a host absoluto** | La página sigue consultando al subdominio `barberagency-app.gymh5g.easypanel.host`. | El HTML cargado en WordPress no es el de QA, o la variable `window.BA_PANEL_API_BASE_URL` se definió de forma absoluta en WordPress. |

---

## 8. Criterio de Aceptación para Producción

La solución se considerará **lista para producción real** únicamente cuando se cumplan los siguientes puntos sin excepciones:

1. Status HTTP de la consulta `/api/dashboard/state` sea `200`.
2. La cookie `ba_session` sea enviada automáticamente en los Request Headers del fetch.
3. El JSON devuelto retorne `ok: true`.
4. Se hidraten los campos del formulario con los valores correctos de servicios, barberos y horarios en la UI.
5. Cero errores de CORS en la pestaña Consola de DevTools.

---

## 9. Siguiente Paso tras Aprobación de QA

Una vez superado el proceso de QA en la página `/registro-barberias-qa/`:

1. Copiar el contenido HTML del archivo oficial actualizado `project/templates/plantillas/registrobarberia.html`.
2. Pegarlo en la página real de producción:
   ```
   /registro-barberias/
   ```
3. Ejecutar una última prueba rápida de confirmación en la página real usando una URL con parámetros correspondientes a una barbería activa.
