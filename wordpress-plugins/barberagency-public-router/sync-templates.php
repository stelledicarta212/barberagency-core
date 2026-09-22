<?php
/**
 * BarberAgency - Template Synchronization & Cryptographic Verification Tool
 * 
 * Supply-Chain Hardened:
 * 1. Requires immutable 40-character Git commit SHA pinning (strictly rejects mutable 'main' or wildcards).
 * 2. Downloads all artifacts to an isolated temporary staging directory first.
 * 3. Enforces strict SHA-256 cryptographic integrity verification against the manifest before deployment.
 * 4. Fails closed on any HTTP failure, corrupt download, missing template, or hash mismatch.
 * 5. Performs atomic replacement only after 100% of artifacts pass verification.
 * 6. Preserves existing known-good production files completely intact on any failure.
 */

// 1. Restricciones de acceso y seguridad: Estrictamente ejecutable solo vía CLI
if (php_sapi_name() !== 'cli') {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['error' => 'No autorizado. Este script solo puede ejecutarse mediante la CLI del contenedor.']);
    exit(1);
}

// Release default immutable commit SHA (can be overridden via CLI, ENV, or constant)
if (!defined('BA_DEFAULT_PINNED_COMMIT_SHA')) {
    define('BA_DEFAULT_PINNED_COMMIT_SHA', '31ca570b8bc1edbf52dd120028a9fceec2488a4a');
}

// 2. Parse CLI options
$options = getopt('', [
    'commit::',
    'base-dir::',
    'manifest-url::',
    'source-base-url::',
    'verify-only',
    'help'
]);

if (isset($options['help'])) {
    echo "Uso: php sync-templates.php [opciones]\n";
    echo "  --commit=<sha>            Commit SHA inmutable de 40 caracteres (prohibido 'main')\n";
    echo "  --base-dir=<path>         Directorio base destino (defecto: /var/www/barberagency-templates)\n";
    echo "  --manifest-url=<url>      URL personalizada del manifest.json (para testing/mock)\n";
    echo "  --source-base-url=<url>   URL base origen de plantillas (para testing/mock)\n";
    echo "  --verify-only             Verifica la integridad SHA-256 de las plantillas existentes sin descargar\n";
    exit(0);
}

// 3. Resolver directorio base
$base_dir = $options['base-dir'] ?? (defined('BA_TEMPLATE_RUNTIME_BASE_PATH') ? BA_TEMPLATE_RUNTIME_BASE_PATH : '/var/www/barberagency-templates');
$backup_dir = $base_dir . '.bak';
$staging_dir = null;

$log = [
    'status' => 'iniciado',
    'timestamp' => gmdate('c'),
    'base_dir' => $base_dir
];

// 4. Modo --verify-only: Validar integridad de las plantillas ya instaladas localmente
if (isset($options['verify-only'])) {
    $manifest_path = $base_dir . '/project/templates/manifest.json';
    if (!file_exists($manifest_path)) {
        $manifest_path = $base_dir . '/manifest.json';
    }

    if (!file_exists($manifest_path)) {
        fwrite(STDERR, "[ERROR] Manifest no encontrado en {$base_dir}\n");
        echo json_encode(['success' => false, 'error' => "Manifest no encontrado en {$base_dir}"], JSON_PRETTY_PRINT);
        exit(1);
    }

    $manifest = json_decode(file_get_contents($manifest_path), true);
    if (!is_array($manifest)) {
        fwrite(STDERR, "[ERROR] Manifest invalido en {$manifest_path}\n");
        echo json_encode(['success' => false, 'error' => "Manifest invalido"], JSON_PRETTY_PRINT);
        exit(1);
    }

    $verified = [];
    $all_valid = true;

    foreach ($manifest as $template_id => $info) {
        if (empty($info['active'])) {
            continue;
        }

        $filename = basename($info['file'] ?? '');
        $expected_hash = strtolower($info['sha256'] ?? '');
        $target_file = $base_dir . '/plantillas/' . $filename;

        if (!file_exists($target_file)) {
            $target_file = $base_dir . '/project/templates/plantillas/' . $filename;
        }

        if (!file_exists($target_file)) {
            $verified[$template_id] = ['status' => 'missing', 'file' => $filename];
            $all_valid = false;
            continue;
        }

        $actual_hash = hash_file('sha256', $target_file);
        $matches = hash_equals($expected_hash, strtolower($actual_hash));

        $verified[$template_id] = [
            'file' => $filename,
            'expected_sha256' => $expected_hash,
            'actual_sha256' => $actual_hash,
            'integrity' => $matches ? 'PASS' : 'FAIL'
        ];

        if (!$matches) {
            $all_valid = false;
        }
    }

    echo json_encode(['success' => $all_valid, 'verified' => $verified], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
    exit($all_valid ? 0 : 1);
}

try {
    // 5. Determinar y validar commit SHA inmutable
    $commit_sha = $options['commit'] ?? (getenv('BA_TEMPLATE_COMMIT') ?: (defined('BA_TEMPLATE_SYNC_COMMIT') ? BA_TEMPLATE_SYNC_COMMIT : BA_DEFAULT_PINNED_COMMIT_SHA));
    $commit_sha = trim($commit_sha);

    // Validación estricta: debe ser un hash hexadecimal exacto de 40 caracteres
    // Prohibido 'main', 'master', 'HEAD', wildcards o cadenas mutables
    if (!preg_match('/^[0-9a-f]{40}$/i', $commit_sha)) {
        throw new Exception("Violacion de seguridad en cadena de suministro: El commit objetivo debe ser un SHA de Git inmutable de 40 caracteres hexadecimales. Ramas mutables como 'main' y wildcards estan estrictamente prohibidas.");
    }

    $log['commit_sha'] = $commit_sha;

    // 6. Construir URLs origen basadas en commit inmutable
    $manifest_url = $options['manifest-url'] ?? "https://raw.githubusercontent.com/stelledicarta212/barberagency-core/{$commit_sha}/project/templates/manifest.json";
    $raw_base_url = $options['source-base-url'] ?? "https://raw.githubusercontent.com/stelledicarta212/barberagency-core/{$commit_sha}/project/templates/plantillas/";
    if (substr($raw_base_url, -1) !== '/') {
        $raw_base_url .= '/';
    }

    $log['manifest_url'] = $manifest_url;
    $log['source_base_url'] = $raw_base_url;

    // 7. Crear directorio de staging aislado para staging atomico
    $staging_id = bin2hex(random_bytes(6));
    $staging_dir = $base_dir . '.stage_' . $staging_id;

    if (file_exists($staging_dir)) {
        self_delete_directory($staging_dir);
    }

    $dirs = [
        $staging_dir,
        $staging_dir . '/plantillas',
        $staging_dir . '/project',
        $staging_dir . '/project/templates',
        $staging_dir . '/project/templates/plantillas'
    ];
    foreach ($dirs as $dir) {
        if (!mkdir($dir, 0755, true)) {
            throw new Exception("Error al crear directorio de staging: {$dir}");
        }
    }

    // 8. Descargar y validar manifest.json en staging
    $manifest_data = self_fetch_url($manifest_url, $manifest_http_code);
    if ($manifest_data === null || trim($manifest_data) === '') {
        throw new Exception("Error al descargar manifest.json desde {$manifest_url} (HTTP {$manifest_http_code}). Falla cerrada.");
    }

    $manifest = json_decode($manifest_data, true);
    if (!is_array($manifest) || empty($manifest)) {
        throw new Exception("El manifest.json descargado desde {$manifest_url} no es un JSON valido o esta vacio.");
    }

    // Guardar manifest temporal en staging
    file_put_contents($staging_dir . '/manifest.json', $manifest_data);
    file_put_contents($staging_dir . '/project/templates/manifest.json', $manifest_data);
    $log['manifest'] = 'descargado_y_validado';

    // 9. Descargar y verificar criptográficamente cada plantilla activa
    $log['templates'] = [];
    $active_count = 0;

    foreach ($manifest as $template_id => $info) {
        // Ignorar plantillas inactivas
        if (empty($info['active'])) {
            $log['templates'][$template_id] = [
                'status' => 'ignorado_inactivo'
            ];
            continue;
        }

        $relative_file = $info['file'] ?? '';
        if ($relative_file === '') {
            throw new Exception("Plantilla activa '{$template_id}' no define archivo en manifest.json.");
        }

        $filename = basename($relative_file);
        $expected_sha256 = strtolower(trim($info['sha256'] ?? ''));

        // REQUISITO DE INTEGRIDAD: Cada plantilla activa DEBE tener hash SHA-256 esperado
        if (!preg_match('/^[0-9a-f]{64}$/i', $expected_sha256)) {
            throw new Exception("Violacion de integridad: La plantilla activa '{$template_id}' ({$filename}) no contiene un hash SHA-256 valido de 64 caracteres en el manifest.");
        }

        $template_url = $raw_base_url . $filename;
        $temp_download_file = $staging_dir . '/plantillas/' . $filename . '.tmp';

        // Descargar a archivo temporal
        $template_html = self_fetch_url($template_url, $tpl_http_code);
        if ($template_html === null || trim($template_html) === '') {
            throw new Exception("Error al descargar plantilla '{$template_id}' desde {$template_url} (HTTP {$tpl_http_code}). Falla cerrada.");
        }

        file_put_contents($temp_download_file, $template_html);

        // Validación 1: Tamaño no vacío y superior a umbral mínimo
        $filesize = filesize($temp_download_file);
        if ($filesize < 1000) {
            throw new Exception("La plantilla descargada '{$template_id}' es demasiado pequeña ({$filesize} bytes). Posible error o archivo incompleto.");
        }

        // Validación 2: Sintaxis básica HTML
        if (strpos($template_html, '</html>') === false && strpos($template_html, '</div>') === false) {
            throw new Exception("La plantilla descargada '{$template_id}' no contiene estructura HTML valida.");
        }

        // Validación 3: VERIFICACIÓN CRIPTOGRÁFICA SHA-256
        $actual_sha256 = hash_file('sha256', $temp_download_file);
        if (!hash_equals($expected_sha256, strtolower($actual_sha256))) {
            throw new Exception("FALLO DE INTEGRIDAD CRIPTOGRAFICA: Discrepancia SHA-256 para plantilla '{$template_id}' ({$filename}). Esperado: {$expected_sha256}, Obtenido: {$actual_sha256}. Abortando despliegue y preservando produccion intacta.");
        }

        // Si la verificación pasa: mover archivo verificado a su ubicación final en staging
        $final_staged_file = $staging_dir . '/plantillas/' . $filename;
        if (!rename($temp_download_file, $final_staged_file)) {
            throw new Exception("Error al posicionar plantilla verificada '{$template_id}' en staging.");
        }

        // Replicar en subdirectorio anidado project/templates/plantillas
        copy($final_staged_file, $staging_dir . '/project/templates/plantillas/' . $filename);

        $log['templates'][$template_id] = [
            'filename' => $filename,
            'size' => $filesize,
            'sha256' => $actual_sha256,
            'integrity' => 'PASS',
            'status' => 'verificado_y_preparado'
        ];
        $active_count++;
    }

    if ($active_count === 0) {
        throw new Exception("El manifest no contiene ninguna plantilla activa para sincronizar.");
    }

    // 10. REEMPLAZO ATÓMICO: Todas las plantillas fueron 100% verificadas
    // Crear backup del directorio de producción actual si existe
    if (file_exists($base_dir)) {
        if (file_exists($backup_dir)) {
            self_delete_directory($backup_dir);
        }
        if (!rename($base_dir, $backup_dir)) {
            throw new Exception("Fallo al mover produccion a backup previo a reemplazo atomico.");
        }
        $log['backup'] = 'creado_atomicamente';
    } else {
        $log['backup'] = 'no_requerido_primer_despliegue';
    }

    // Reemplazo atómico: mover staging a base_dir
    if (!rename($staging_dir, $base_dir)) {
        // En caso de fallo en el rename, restaurar backup inmediatamente
        if (file_exists($backup_dir)) {
            rename($backup_dir, $base_dir);
        }
        throw new Exception("Fallo en reemplazo atomico de staging a {$base_dir}. Estado previo restaurado.");
    }

    $staging_dir = null; // Staging ya fue promovido con éxito
    $log['status'] = 'exito';
    $log['templates_synced'] = $active_count;

    echo json_encode([
        'success' => true,
        'commit_sha' => $commit_sha,
        'log' => $log
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
    exit(0);

} catch (Exception $e) {
    // 11. MANEJO DE FALLO CERRADO Y PRESERVACIÓN DE CONOCIDO-BUENO
    $log['status'] = 'fallido';
    $log['error'] = $e->getMessage();

    // Eliminar staging temporal si existe
    if ($staging_dir !== null && file_exists($staging_dir)) {
        self_delete_directory($staging_dir);
    }

    // Si base_dir no existe pero backup_dir existe, restaurar inmediatamente el estado conocido-bueno
    if (!file_exists($base_dir) && file_exists($backup_dir)) {
        rename($backup_dir, $base_dir);
        $log['rollback'] = 'restaurado_estado_previo_conocido_bueno';
    } else {
        $log['rollback'] = 'produccion_preservada_intacta';
    }

    fwrite(STDERR, "[FATAL] " . $e->getMessage() . "\n");
    echo json_encode([
        'success' => false,
        'commit_sha' => $commit_sha ?? null,
        'error' => $e->getMessage(),
        'log' => $log
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
    exit(1);
}

// ==========================================
// FUNCIONES AUXILIARES DE COPIA Y DESCARGA
// ==========================================

function self_fetch_url(string $url, ?int &$http_code = null): ?string {
    $http_code = 0;

    // Soporte para esquemas file:// en pruebas unitarias/locales
    if (strpos($url, 'file://') === 0) {
        $local_path = substr($url, 7);
        if (file_exists($local_path)) {
            $http_code = 200;
            return file_get_contents($local_path);
        } else {
            $http_code = 404;
            return null;
        }
    }

    if (function_exists('wp_remote_get')) {
        $response = wp_remote_get($url, [
            'timeout' => 25,
            'redirection' => 3,
            'sslverify' => true,
            'user-agent' => 'BarberAgency-Template-Sync/2.0'
        ]);
        if (is_wp_error($response)) {
            $http_code = 500;
            return null;
        }
        $http_code = wp_remote_retrieve_response_code($response);
        if ($http_code !== 200) {
            return null;
        }
        return wp_remote_retrieve_body($response);
    } else {
        // Fallback nativo cURL
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 25);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_USERAGENT, 'BarberAgency-Template-Sync/2.0');
        $output = curl_exec($ch);
        $http_code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($http_code === 200) ? $output : null;
    }
}

function self_delete_directory(string $dir): bool {
    if (!file_exists($dir)) {
        return true;
    }
    if (!is_dir($dir)) {
        return unlink($dir);
    }
    foreach (scandir($dir) as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        if (!self_delete_directory($dir . DIRECTORY_SEPARATOR . $item)) {
            return false;
        }
    }
    return rmdir($dir);
}
