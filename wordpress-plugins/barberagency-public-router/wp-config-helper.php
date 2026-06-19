<?php
/**
 * BarberAgency - wp-config.php Feature Flags Manager (Phase 6A)
 */

function ba_set_wp_config_flags(string $allowed_templates = 'v2,v3'): array {
    $wp_config_path = dirname(dirname(dirname(__DIR__))) . '/wp-config.php';
    if (!file_exists($wp_config_path)) {
        return ['error' => 'wp-config.php no encontrado en ' . $wp_config_path];
    }

    $backup_path = $wp_config_path . '.bak';
    if (!copy($wp_config_path, $backup_path)) {
        return ['error' => 'No se pudo crear backup de wp-config.php'];
    }

    $content = file_get_contents($wp_config_path);
    if ($content === false) {
        return ['error' => 'Error al leer wp-config.php'];
    }

    // 1. Remover cualquier configuración previa de Feature Flags de BarberAgency
    $content = preg_replace('/\/\/ ==========================================\s*\/\/ FEATURE FLAGS DE TEMPLATE RUNTIME\s*\/\/ ==========================================[\s\S]*?\/\/ === END FEATURE FLAGS ===/s', '', $content);

    // 2. Definir el bloque de constantes permanente
    $flags_block = "\n// ==========================================\n// FEATURE FLAGS DE TEMPLATE RUNTIME\n// ==========================================\n";
    $flags_block .= "if (!defined('BA_TEMPLATE_RUNTIME_BASE_PATH')) {\n    define('BA_TEMPLATE_RUNTIME_BASE_PATH', '/var/www/barberagency-templates');\n}\n";
    $flags_block .= "if (!defined('BA_TEMPLATE_RUNTIME_ENABLED')) {\n    define('BA_TEMPLATE_RUNTIME_ENABLED', true);\n}\n";
    $flags_block .= "if (!defined('BA_TEMPLATE_RUNTIME_ALLOWED_TEMPLATES')) {\n    define('BA_TEMPLATE_RUNTIME_ALLOWED_TEMPLATES', '{$allowed_templates}');\n}\n";
    $flags_block .= "if (!defined('BA_TEMPLATE_RUNTIME_FALLBACK_ENABLED')) {\n    define('BA_TEMPLATE_RUNTIME_FALLBACK_ENABLED', true);\n}\n";
    $flags_block .= "// === END FEATURE FLAGS ===\n";

    // 3. Insertar justo antes del cierre de edición o al final
    $insert_point = "/* That's all, stop editing! Happy publishing. */";
    if (strpos($content, $insert_point) !== false) {
        $content = str_replace($insert_point, $flags_block . "\n" . $insert_point, $content);
    } else {
        $content .= "\n" . $flags_block;
    }

    if (file_put_contents($wp_config_path, $content) === false) {
        copy($backup_path, $wp_config_path);
        return ['error' => 'Fallo al escribir en wp-config.php. Se restauro el backup.'];
    }

    return ['success' => true, 'backup_created' => true];
}

function ba_disable_wp_config_flags(): array {
    $wp_config_path = dirname(dirname(dirname(__DIR__))) . '/wp-config.php';
    if (!file_exists($wp_config_path)) {
        return ['error' => 'wp-config.php no encontrado en ' . $wp_config_path];
    }

    $backup_path = $wp_config_path . '.bak';
    if (!copy($wp_config_path, $backup_path)) {
        return ['error' => 'No se pudo crear backup para deshabilitar.'];
    }

    $content = file_get_contents($wp_config_path);
    if ($content === false) {
        return ['error' => 'Error al leer wp-config.php'];
    }

    $content = preg_replace('/\/\/ ==========================================\s*\/\/ FEATURE FLAGS DE TEMPLATE RUNTIME\s*\/\/ ==========================================[\s\S]*?\/\/ === END FEATURE FLAGS ===/s', '', $content);

    if (file_put_contents($wp_config_path, $content) === false) {
        copy($backup_path, $wp_config_path);
        return ['error' => 'Error al deshabilitar flags en wp-config.php. Se restauro el backup.'];
    }

    return ['success' => true, 'disabled' => true];
}

// Habilitar ejecución directa por CLI dentro del contenedor
if (php_sapi_name() === 'cli') {
    $action = isset($argv[1]) ? trim($argv[1]) : '';
    if ($action === 'setup') {
        $allowed = isset($argv[2]) ? trim($argv[2]) : 'v2,v3';
        $res = ba_set_wp_config_flags($allowed);
        echo json_encode($res, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
        exit(isset($res['success']) ? 0 : 1);
    } elseif ($action === 'rollback') {
        $res = ba_disable_wp_config_flags();
        echo json_encode($res, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
        exit(isset($res['success']) ? 0 : 1);
    } else {
        echo "Uso: php wp-config-helper.php [setup|rollback] [allowed_templates]\n";
        exit(1);
    }
}
