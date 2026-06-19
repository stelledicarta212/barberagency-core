# Plan de Pruebas Unitarias — Sincronización de Plantillas

Este plan de pruebas describe los escenarios unitarios para validar el script de sincronización de plantillas públicas `sync-templates.php`.

---

## 🧪 Casos de Prueba Unitarios

### 1. Seguridad de Ejecución
*   **Caso UT-ST-01 (Solo CLI)**: Validar que el script únicamente se ejecute en el entorno de línea de comandos (CLI) de PHP.
*   **Caso UT-ST-02 (HTTP Bloqueado)**: Validar que cualquier llamada a través de un servidor web (HTTP/S) sea bloqueada inmediatamente (código 403 o 404).

### 2. Descarga y Verificación
*   **Caso UT-ST-03 (Descarga de Manifest)**: Validar la descarga correcta del archivo de manifiesto remoto de plantillas (`manifest.json`) y su parseo de estructura.
*   **Caso UT-ST-04 (Descarga de Plantillas)**: Validar que se descarguen físicamente las plantillas especificadas en el manifest hacia la carpeta local del plugin.
*   **Caso UT-ST-05 (Tamaño Mínimo)**: Validar que el script compruebe el tamaño de los archivos descargados. Si un archivo HTML descargado pesa menos de un umbral mínimo (ej: 5KB), debe marcarse como corrupto/fallido.

### 3. Integridad y Respaldo (Backup/Rollback)
*   **Caso UT-ST-06 (Creación de Backup)**: Validar que el script cree una copia de seguridad temporal de los directorios de plantillas actuales antes de sobreescribir.
*   **Caso UT-ST-07 (Preservación de Permisos)**: Validar que los archivos descargados y creados conserven los permisos correctos del servidor web (ej: `www-data` u `octeto 644/755`).
*   **Caso UT-ST-08 (Rollback por Fallo)**: Validar que si la descarga de alguna plantilla candidata falla, se dispare un rollback automático restaurando el backup temporal para no dejar el sitio en estado roto.
*   **Caso UT-ST-09 (No destrucción parcial)**: Validar que si la descarga falla a mitad del proceso, no se eliminen ni limpien las plantillas estables previas que ya estaban funcionando correctamente.
