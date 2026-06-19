# Plan de Pruebas Unitarias — wp-config Helper

Este plan de pruebas describe los escenarios unitarios diseñados para validar el comportamiento del script de ayuda CLI `wp-config-helper.php`.

---

## 🧪 Casos de Prueba Unitarios

### 1. Inyección de Constantes y Configuración
*   **Caso UT-WCH-01 (Escritura simple)**: Validar que ejecutar `php wp-config-helper.php setup v2` escriba la constante `BA_TEMPLATE_RUNTIME_ALLOWED_TEMPLATES` con valor exacto `"v2"`.
*   **Caso UT-WCH-02 (Escritura múltiple)**: Validar que `php wp-config-helper.php setup v2,v3` actualice la constante a `"v2,v3"`.
*   **Caso UT-WCH-03 (Configuración actual)**: Validar que `php wp-config-helper.php setup v2,v3,v4` escriba `"v2,v3,v4"`.
*   **Caso UT-WCH-04 (Configuración futura V5)**: Validar que `php wp-config-helper.php setup v2,v3,v4,v5` escriba `"v2,v3,v4,v5"`.

### 2. Robustez y Prevención de Corrupción
*   **Caso UT-WCH-05 (No duplicidad)**: Validar que ejecuciones sucesivas del script no dupliquen los bloques PHP inyectados en `wp-config.php`.
*   **Caso UT-WCH-06 (Creación de Backups)**: Validar que antes de realizar cualquier escritura física, el script cree una copia de respaldo limpia (ej: `wp-config.php.bak`) en el mismo directorio.
*   **Caso UT-WCH-07 (Preservación de contenido)**: Validar que el script modifique únicamente las constantes especificadas y conserve intactas el resto de definiciones (credenciales de base de datos, llaves de sal, etc.) de `wp-config.php`.
*   **Caso UT-WCH-08 (Rollback Seguro)**: Validar que ante cualquier fallo, el script pueda revertir al estado seguro de producción ejecutando el comando setup con `"v2,v3,v4"`.
*   **Caso UT-WCH-09 (Validación de argumentos)**: Validar que el envío de argumentos inválidos, caracteres especiales o strings vacíos no modifique ni corrompa `wp-config.php`, arrojando un error de uso CLI adecuado.

### 🛡️ 3. Aislamiento y Entorno de Ejecución
*   **Caso UT-WCH-10 (Restricción CLI)**: Validar que si el script es invocado desde un navegador web vía protocolo HTTP, aborte inmediatamente arrojando un status HTTP 403 Forbidden o 404 Not Found, evitando ejecución no autorizada.
