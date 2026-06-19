<?php
/**
 * BarberAgency - Template Synchronization & Verification Tool
 * 
 * Este script descarga de forma segura las plantillas y el manifiesto actualizados desde GitHub
 * y los guarda en el directorio persistente del contenedor de WordPress (/var/www/barberagency-templates).
 * Implementa control de rollback automático, validación de integridad y seguridad de acceso.
 */

// 1. Restricciones de acceso y seguridad
$is_cli = (php_sapi_name() === 'cli');
$is_authorized = false;

if ($is_cli || (defined('BA_TEMPLATE_SYNC_BYPASS') && BA_TEMPLATE_SYNC_BYPASS === true)) {
    $is_authorized = true;
} else {
    // Si se accede via web, requiere cargar el entorno de WordPress y validar un token seguro
    $wp_load_path = dirname(dirname(dirname(__DIR__))) . '/wp-load.php';
    if (file_exists($wp_load_path)) {
        require_once $wp_load_path;
    }

    $secret_token = defined('BA_TEMPLATE_SYNC_TOKEN') ? BA_TEMPLATE_SYNC_TOKEN : '';
    if ($secret_token !== '' && isset($_GET['token']) && hash_equals($secret_token, $_GET['token'])) {
        $is_authorized = true;
    }
}

if (!$is_authorized) {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['error' => 'No autorizado. Se requiere acceso CLI o un token de sincronizacion valido.']);
    exit(1);
}

// 2. Definición de directorios y configuración
$base_dir = defined('BA_TEMPLATE_RUNTIME_BASE_PATH') ? BA_TEMPLATE_RUNTIME_BASE_PATH : '/var/www/barberagency-templates';
$backup_dir = $base_dir . '.bak';

$log = [];
$log['status'] = 'iniciado';
$log['base_dir'] = $base_dir;

// URLs origen de GitHub
$manifest_url = 'https://raw.githubusercontent.com/stelledicarta212/barberagency-core/main/project/templates/manifest.json';
$raw_base_url = 'https://raw.githubusercontent.com/stelledicarta212/barberagency-core/main/project/templates/plantillas/';

try {
    // 3. Crear Backup del estado actual si existe
    if (file_exists($base_dir)) {
        // Eliminar backup viejo si existe
        if (file_exists($backup_dir)) {
            self_delete_directory($backup_dir);
        }
        
        // Copiar recursivamente a backup
        if (self_copy_directory($base_dir, $backup_dir)) {
            $log['backup'] = 'creado';
        } else {
            throw new Exception("No se pudo crear el backup en " . $backup_dir);
        }
    } else {
        $log['backup'] = 'no_requerido_directorio_nuevo';
    }

    // 4. Crear estructura de directorios necesaria
    $dirs = [
        $base_dir,
        $base_dir . '/plantillas',
        $base_dir . '/project',
        $base_dir . '/project/templates',
        $base_dir . '/project/templates/plantillas'
    ];
    foreach ($dirs as $dir) {
        if (!file_exists($dir)) {
            if (!mkdir($dir, 0755, true)) {
                throw new Exception("Error al crear el directorio: " . $dir);
            }
        }
    }

    // 5. Descargar manifest.json
    $manifest_data = self_fetch_url($manifest_url);
    if ($manifest_data === null || trim($manifest_data) === '') {
        throw new Exception("Error al descargar manifest.json de " . $manifest_url);
    }
    
    $manifest = json_decode($manifest_data, true);
    if (!is_array($manifest)) {
        throw new Exception("El manifest.json descargado no es un JSON valido.");
    }

    // Guardar manifest.json
    file_put_contents($base_dir . '/manifest.json', $manifest_data);
    file_put_contents($base_dir . '/project/templates/manifest.json', $manifest_data);
    $log['manifest'] = 'sincronizado';

    // 6. Descargar plantillas asociadas
    $log['templates'] = [];
    foreach ($manifest as $template_id => $info) {
        $relative_file = $info['file'] ?? '';
        if ($relative_file === '') {
            continue;
        }

        $filename = basename($relative_file);
        $template_url = $raw_base_url . $filename;

        $template_html = self_fetch_url($template_url);
        if ($template_html === null || trim($template_html) === '') {
            throw new Exception("Error al descargar plantilla '{$template_id}' desde " . $template_url);
        }

        // Validación sintáctica básica de HTML/script
        if (strpos($template_html, '</html>') === false && strpos($template_html, '</div>') === false) {
            throw new Exception("La plantilla '{$template_id}' parece estar corrupta o incompleta.");
        }

        // Guardar plantilla en ambas ubicaciones
        file_put_contents($base_dir . '/plantillas/' . $filename, $template_html);
        file_put_contents($base_dir . '/project/templates/plantillas/' . $filename, $template_html);
        
        $log['templates'][$template_id] = [
            'filename' => $filename,
            'size' => strlen($template_html),
            'status' => 'sincronizado'
        ];
    }

    $log['status'] = 'exito';
    
    // Limpieza: si todo fue exitoso, eliminar el backup viejo
    if (file_exists($backup_dir)) {
        self_delete_directory($backup_dir);
    }

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'log' => $log], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit(0);

} catch (Exception $e) {
    // 7. Rollback automático ante cualquier fallo
    $log['status'] = 'fallido';
    $log['error'] = $e->getMessage();
    
    if (file_exists($backup_dir)) {
        $log['rollback'] = 'iniciado';
        // Restaurar base dir
        self_delete_directory($base_dir);
        rename($backup_dir, $base_dir);
        $log['rollback'] = 'completado_restaurado_estado_anterior';
    } else {
        $log['rollback'] = 'no_posible_sin_backup';
    }

    header('Content-Type: application/json; charset=utf-8', true, 500);
    echo json_encode(['success' => false, 'log' => $log], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit(1);
}

// ==========================================
// FUNCIONES AUXILIARES DE COPIA Y DESCARGA
// ==========================================

function self_fetch_url(string $url): ?string {
    if (function_exists('wp_remote_get')) {
        $response = wp_remote_get($url, ['timeout' => 15]);
        if (is_wp_error($response)) {
            return null;
        }
        return wp_remote_retrieve_body($response);
    } else {
        // Fallback nativo de PHP si WP no esta cargado
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        $output = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($http_code === 200) ? $output : null;
    }
}

function self_copy_directory(string $src, string $dst): bool {
    if (!file_exists($src)) {
        return false;
    }
    if (!file_exists($dst)) {
        mkdir($dst, 0755, true);
    }
    $dir = opendir($src);
    while (false !== ($file = readdir($dir))) {
        if (($file != '.') && ($file != '..')) {
            if (is_dir($src . '/' . $file)) {
                self_copy_directory($src . '/' . $file, $dst . '/' . $file);
            } else {
                copy($src . '/' . $file, $dst . '/' . $file);
            }
        }
    }
    closedir($dir);
    return true;
}

function self_delete_directory(string $dir): bool {
    if (!file_exists($dir)) {
        return true;
    }
    if (!is_dir($dir)) {
        return unlink($dir);
    }
    foreach (scandir($dir) as $item) {
        if ($item == '.' || $item == '..') {
            continue;
        }
        if (!self_delete_directory($dir . DIRECTORY_SEPARATOR . $item)) {
            return false;
        }
    }
    return rmdir($dir);
}
