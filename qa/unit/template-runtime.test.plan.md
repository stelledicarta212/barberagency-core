# Plan de Pruebas Unitarias — Template Runtime

Este plan de pruebas describe los escenarios unitarios críticos para el validador del motor de renderizado y el parser de plantillas permitidas.

---

## 🧪 Casos de Prueba Unitarios

### 1. Validación de Plantillas Permitidas (Allowed List)
*   **Caso UT-TR-01 (Permitidas básicas)**: Validar que el parser permita resolver `v2`, `v3` y `v4` cuando `BA_TEMPLATE_RUNTIME_ALLOWED_TEMPLATES` está configurado como `"v2,v3,v4"`.
*   **Caso UT-TR-02 (Plantillas restringidas)**: Validar que el parser devuelva falso (bloquee la ejecución de runtime) para `v5` cuando no esté listada explícitamente en `BA_TEMPLATE_RUNTIME_ALLOWED_TEMPLATES`.
*   **Caso UT-TR-03 (Soporte de espacios)**: Validar que espacios en blanco o saltos de línea en el string de configuración (ej: `"v2, v3 ,  v4"`) sean saneados automáticamente (trim) y no rompan la validación de la lista permitida.

### 2. Control de Interruptores (Flags & Fallbacks)
*   **Caso UT-TR-04 (Runtime deshabilitado)**: Validar que si `BA_TEMPLATE_RUNTIME_ENABLED` está configurado como `false`, el sistema aborte la ejecución de runtime inmediatamente y devuelva redirección/renderizado en modo `legacy`.
*   **Caso UT-TR-05 (Plantilla no permitida)**: Validar que si un tenant solicita una plantilla válida pero no autorizada en el allowed_list, el sistema caiga graciosamente a la plantilla por defecto o modo `legacy`.

### 3. Integridad de Metadatos y Manifests
*   **Caso UT-TR-06 (Manifest inexistente)**: Validar que si el archivo `manifest.json` no existe en el disco o la ruta relativa de la plantilla, el motor de runtime retorne fallback / modo `legacy` sin arrojar errores fatal de PHP.
*   **Caso UT-TR-07 (Manifest malformado o vacío)**: Validar que si el JSON del `manifest.json` contiene errores de sintaxis o está completamente vacío, el parser capture la excepción graciosamente y caiga a modo `legacy`.
