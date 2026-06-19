# Checklist Template Runtime

Este checklist estructurado debe completarse para validar cualquier cambio de configuración, activación de plantillas o actualizaciones en el motor del public enrutador.

---

## 🔍 1. Antes de Activar
*   [ ] **Confirmar estado actual**: Ejecutar grep de las variables `BA_TEMPLATE_RUNTIME` en `wp-config.php` para validar el estado base actual.
*   [ ] **Confirmar fallback activo**: Verificar que `BA_TEMPLATE_RUNTIME_FALLBACK_ENABLED` esté seteado en `true`.
*   [ ] **Confirmar plantilla candidata**: Asegurar que la plantilla a activar esté en modo `legacy` en base de datos antes de habilitar el runtime.
*   [ ] **Confirmar endpoint ba_ping**: Realizar una petición ping (`/?ba_ping=1`) y corroborar respuesta HTTP 200 exitosa.
*   [ ] **Confirmar plan de rollback**: Verificar que el comando CLI de rollback a `v2,v3,v4` esté claro y documentado.
*   [ ] **Confirmar no alteración**: Asegurar y validar que el cambio planificado no afectará las bases de datos de producción ni flujos de n8n.

---

## 🚀 2. Activación
*   [ ] **Ejecutar helper CLI**: Ejecutar `wp-config-helper.php` en la terminal del contenedor con la lista correcta de `allowed_templates` (ej: `setup v2,v3,v4,v5`).
*   [ ] **Verificar wp-config.php**: Comprobar que los bloques inyectados en `wp-config.php` se hayan guardado limpiamente sin duplicarse.
*   [ ] **No usar endpoints HTTP**: Todo setup o rollback se realiza vía terminal CLI, nunca mediante endpoints web expuestos públicamente.
*   [ ] **No usar git push --force**: Toda sincronización de código en repositorios debe ser limpia e incremental.

---

## 🌐 3. Validación de Headers HTTP
*   [ ] **HTTP 200**: Todas las landings activas devuelven status HTTP 200 OK.
*   [ ] **Header X-BarberAgency-Runtime**: Comprobar que devuelva `physical_registry` para las plantillas permitidas.
*   [ ] **Header X-BarberAgency-Template-Id**: Validar que devuelva el ID correcto de la plantilla en el response header.
*   [ ] **Retrocompatibilidad**: Comprobar que las plantillas de versiones anteriores no se rompen ni cambian su comportamiento.
*   [ ] **Aislamiento**: Las plantillas no listadas explícitamente en `allowed_templates` deben seguir resolviendo en modo `legacy` o fallback.

---

## 🎨 4. Validación Visual (Desktop & Mobile)
*   [ ] **Logo visible**: El logotipo del tenant carga correctamente sin imágenes rotas.
*   [ ] **Servicios visibles**: Se listan los servicios activos con sus respectivos fallbacks de icono/foto.
*   [ ] **Barberos visibles**: Los barberos activos cargan con su foto o avatar correspondiente.
*   [ ] **Botón Reservar**: El botón interactivo despliega correctamente el modal o carga el calendario de turnos.
*   [ ] **WhatsApp**: El botón de contacto/WhatsApp tiene la URL correcta con el teléfono configurado en base de datos.
*   [ ] **Mapa y Dirección**: La sección de ubicación e iframe de Google Maps carga correctamente la dirección física.
*   [ ] **Mobile First**: Validar responsive y scrolls en emulador móvil.
*   [ ] **Tema Claro / Oscuro**: Verificar contraste de tipografías al cambiar de esquema cromático.
*   [ ] **Sin errores de JS**: Abrir consola del desarrollador y validar la ausencia de excepciones de JavaScript críticas.

---

## 🛡️ 5. Seguridad y Robustez
*   [ ] **Endpoints protegidos**: Validar que los endpoints del helper CLI o de sincronización no sean accesibles vía web (retornar 403/404).
*   [ ] **Ausencia de 500**: Ninguna landing válida debe arrojar errores HTTP 500 Internal Server Error.
*   [ ] **Sin bucles**: Corroborar que no existan bucles de redirección infinita entre Next.js proxy y WordPress.
*   [ ] **Sin path traversal**: Probar slugs maliciosos (ej: `../`, `..%2F`) y validar su mitigación por el enrutador.
*   [ ] **Fallback operando**: Si la plantilla arroja un error fatal de disco o lectura, el enrutador cae graciosamente a la plantilla por defecto.

---

## 📝 6. Cierre de Fase
*   [ ] **Crear reporte**: Escribir el reporte correspondiente en la carpeta `qa/reports/`.
*   [ ] **Estatus explícito**: Registrar con estatus **PASS** o **BLOCKED** la fase actual.
*   [ ] **Recomendación**: Proveer la sugerencia formal para proceder con la siguiente fase de desarrollo.
