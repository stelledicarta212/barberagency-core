<?php
/**
 * Plugin Name: BarberAgency Public Router v5
 * Description: Resuelve landings publicas canonicas en /b/{slug} usando la fuente publica publicada.
 * Version: 0.5.0
 * Author: BarberAgency
 */

if (!defined('ABSPATH')) {
    exit;
}

final class BarberAgency_Public_Router {
    private const QUERY_VAR = 'ba_public_slug';
    private const RPC_URL = 'https://api.agencia2c.cloud/rpc/ba_get_landing_publica';

    public static function init(): void {
        add_action('init', [self::class, 'register_rewrite_rule']);
        add_filter('query_vars', [self::class, 'register_query_var']);
        add_filter('redirect_canonical', [self::class, 'disable_canonical_redirect_for_public_landing'], 10, 2);
        add_action('template_redirect', [self::class, 'maybe_render_public_landing'], 0);
        add_action('init', function() {
            if (isset($_GET['ba_ping'])) {
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['pong' => true, 'version' => '0.5.0-v5', 'time' => time()], JSON_PRETTY_PRINT);
                exit;
            }
        });
    }

    public static function activate(): void {
        self::register_rewrite_rule();
        flush_rewrite_rules();
    }

    public static function deactivate(): void {
        flush_rewrite_rules();
    }

    public static function register_rewrite_rule(): void {
        add_rewrite_rule(
            '^b/([^/]+)/?$',
            'index.php?' . self::QUERY_VAR . '=$matches[1]',
            'top'
        );
    }

    public static function register_query_var(array $vars): array {
        $vars[] = self::QUERY_VAR;
        return $vars;
    }

    public static function disable_canonical_redirect_for_public_landing($redirect_url, string $requested_url) {
        if (self::get_requested_slug() !== '') {
            return false;
        }

        return $redirect_url;
    }

    public static function maybe_render_public_landing(): void {
        $slug = self::get_requested_slug();
        if ($slug === '') {
            return;
        }

        $payload = self::get_public_payload($slug);
        if (!$payload || empty($payload['ok'])) {
            self::set_404();
            return;
        }

        $template_id = sanitize_key((string) ($payload['plantilla']['template_id'] ?? ''));

        // ==========================================
        // FEATURE FLAGS & CANARY DE TEMPLATE RUNTIME
        // ==========================================
        $use_new_runtime = false;

        $enabled = defined('BA_TEMPLATE_RUNTIME_ENABLED') ? BA_TEMPLATE_RUNTIME_ENABLED : false;
        $canary_enabled = defined('BA_TEMPLATE_RUNTIME_CANARY_ENABLED') ? BA_TEMPLATE_RUNTIME_CANARY_ENABLED : false;

        $allowed_slugs_raw = defined('BA_TEMPLATE_RUNTIME_ALLOWED_SLUGS') ? BA_TEMPLATE_RUNTIME_ALLOWED_SLUGS : '';
        $allowed_templates_raw = defined('BA_TEMPLATE_RUNTIME_ALLOWED_TEMPLATES') ? BA_TEMPLATE_RUNTIME_ALLOWED_TEMPLATES : '';

        $allowed_slugs = !empty($allowed_slugs_raw) ? array_map('trim', explode(',', $allowed_slugs_raw)) : [];
        $allowed_templates = !empty($allowed_templates_raw) ? array_map('trim', explode(',', $allowed_templates_raw)) : [];

        $fallback_enabled = defined('BA_TEMPLATE_RUNTIME_FALLBACK_ENABLED') ? BA_TEMPLATE_RUNTIME_FALLBACK_ENABLED : true;

        if ($enabled) {
            // Si el runtime global está activo, se valida si hay limitadores (slugs/templates)
            $slug_ok = empty($allowed_slugs) || in_array($slug, $allowed_slugs, true);
            $template_ok = empty($allowed_templates) || in_array($template_id, $allowed_templates, true);
            if ($slug_ok && $template_ok) {
                $use_new_runtime = true;
            }
        } elseif ($canary_enabled) {
            // Si el runtime global está apagado pero Canary está activo, probamos con la lista canary
            $slug_ok = !empty($allowed_slugs) && in_array($slug, $allowed_slugs, true);
            $template_ok = empty($allowed_templates) || in_array($template_id, $allowed_templates, true);
            if ($slug_ok && $template_ok) {
                $use_new_runtime = true;
            }
        }

        $html = null;
        $runtime_type = 'legacy';

        if ($use_new_runtime) {
            error_log("BarberAgency Runtime: Intentando cargar por nuevo runtime para slug '{$slug}' (template_id: '{$template_id}')");
            $html = self::fetch_physical_html_from_registry($template_id, $slug);
            if ($html !== null) {
                $runtime_type = 'physical_registry';
            } else {
                error_log("BarberAgency Runtime: Fallo en nuevo runtime. Fallback activo: " . ($fallback_enabled ? 'si' : 'no'));
                if (!$fallback_enabled) {
                    self::set_404();
                    return;
                }
            }
        }

        // Si no se usó el nuevo runtime, o si falló y el fallback está activo, usamos el legacy
        if ($html === null) {
            $legacy_path = self::template_legacy_path_map()[$template_id] ?? '';
            if ($legacy_path === '') {
                error_log("BarberAgency Runtime: Legacy Path no encontrado para template_id '{$template_id}'");
                self::set_404();
                return;
            }
            $legacy_url = add_query_arg('slug', rawurlencode($slug), home_url($legacy_path));
            error_log("BarberAgency Runtime: Cargando por legacy URL '{$legacy_url}' para slug '{$slug}'");
            $html = self::fetch_legacy_html($legacy_url);
            if ($html === null) {
                error_log("BarberAgency Runtime: Fallo al cargar legacy HTML para slug '{$slug}'");
                self::set_404();
                return;
            }
        }

        status_header(200);
        nocache_headers();
        header('Content-Type: text/html; charset=' . get_bloginfo('charset'));
        header("X-BarberAgency-Runtime: {$runtime_type}");
        header("X-BarberAgency-Template-Id: {$template_id}");
        echo self::inject_route_context($html, $payload);
        exit;
    }

    private static function fetch_physical_html_from_registry(string $template_id, string $slug): ?string {
        $base_path = defined('BA_TEMPLATE_RUNTIME_BASE_PATH') ? BA_TEMPLATE_RUNTIME_BASE_PATH : ABSPATH;
        $manifest_path = $base_path . '/project/templates/manifest.json';

        if (!file_exists($manifest_path)) {
            error_log("BarberAgency Runtime: Manifest no encontrado en " . $manifest_path);
            return null;
        }

        $manifest_data = file_get_contents($manifest_path);
        $manifest = json_decode($manifest_data, true);
        if (!is_array($manifest)) {
            error_log("BarberAgency Runtime: Manifest invalido.");
            return null;
        }

        if (!isset($manifest[$template_id])) {
            error_log("BarberAgency Runtime: template_id '{$template_id}' no registrado en el manifest.");
            return null;
        }

        $template_info = $manifest[$template_id];
        if (empty($template_info['active'])) {
            error_log("BarberAgency Runtime: template_id '{$template_id}' inactivo.");
            return null;
        }

        $relative_file = $template_info['file'] ?? '';
        if ($relative_file === '') {
            error_log("BarberAgency Runtime: No se especifico archivo para '{$template_id}'.");
            return null;
        }

        $real_base = realpath($base_path);
        $target_file = $real_base . '/' . $relative_file;
        $real_target = realpath($target_file);

        if ($real_target === false) {
            error_log("BarberAgency Runtime: Archivo de plantilla no existe fisicamente en " . $target_file);
            return null;
        }

        if (strpos($real_target, $real_base) !== 0) {
            error_log("BarberAgency Runtime: Intento de Path Traversal bloqueado para " . $real_target);
            return null;
        }

        if (pathinfo($real_target, PATHINFO_EXTENSION) !== 'html') {
            error_log("BarberAgency Runtime: Archivo no tiene extension .html para " . $real_target);
            return null;
        }

        $html = file_get_contents($real_target);
        if ($html === false || trim($html) === '') {
            error_log("BarberAgency Runtime: HTML leido de " . $real_target . " esta vacio.");
            return null;
        }

        error_log("BarberAgency Runtime: Plantilla '{$template_id}' cargada exitosamente de disco para slug '{$slug}'.");
        return $html;
    }

    private static function fetch_legacy_html(string $url): ?string {
        $response = wp_remote_get($url, [
            'timeout' => 15,
            'redirection' => 3,
        ]);

        if (is_wp_error($response)) {
            return null;
        }

        $status = (int) wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        if ($status !== 200 || $body === '') {
            return null;
        }

        return $body;
    }

    private static function inject_route_context(string $html, array $payload): string {
        $seed = self::build_legacy_seed($payload);
        $json = wp_json_encode(
            $seed,
            JSON_UNESCAPED_SLASHES |
            JSON_UNESCAPED_UNICODE |
            JSON_HEX_TAG |
            JSON_HEX_AMP |
            JSON_HEX_APOS |
            JSON_HEX_QUOT
        );
        if (!$json) {
            return $html;
        }

        $script = "<!-- BarberAgency Public Router v3 context -->\n";
        $script .= "<script>\n";
        $script .= "window.BA_LANDING_ROUTE_CONTEXT = {$json};\n";
        $script .= "window.BA_PUBLIC_LANDING_URL = window.BA_LANDING_ROUTE_CONTEXT.public_landing_url || '';\n";
        $script .= "window.BA_RESERVATION_URL = window.BA_LANDING_ROUTE_CONTEXT.reservation_url || '';\n";
        $script .= "window.BA_QR_URL = window.BA_LANDING_ROUTE_CONTEXT.qr_url || '';\n";
        $script .= "try { sessionStorage.setItem('ba_landing_seed', JSON.stringify(window.BA_LANDING_ROUTE_CONTEXT)); } catch (e) {}\n";
        $script .= "</script>\n";

        if (stripos($html, '</head>') !== false) {
            return preg_replace('/<\/head>/i', $script . '</head>', $html, 1);
        }

        return $script . $html;
    }

    private static function get_requested_slug(): string {
        $slug = sanitize_title((string) get_query_var(self::QUERY_VAR));
        if ($slug === '' && isset($_SERVER['REQUEST_URI'])) {
            $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
            if (preg_match('/^\/b\/([^\/]+)/', $path, $matches)) {
                $slug = sanitize_title($matches[1]);
            }
        }
        return $slug;
    }

    private static function get_public_payload(string $slug): ?array {
        $response = wp_remote_post(self::RPC_URL, [
            'timeout' => 10,
            'headers' => [
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ],
            'body' => wp_json_encode([
                'p_slug' => $slug,
            ]),
        ]);

        if (is_wp_error($response)) {
            return null;
        }

        $status = (int) wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        if ($status !== 200 || $body === '') {
            return null;
        }

        $json = json_decode($body, true);
        return is_array($json) ? $json : null;
    }

    private static function template_legacy_path_map(): array {
        return apply_filters('barberagency_public_template_legacy_path_map', [
            'v2' => '/index_unico_v2/',
            'v3' => '/index_unico_v3_nueva/',
            'v4' => '/index_unico_v4_editorial/',
            'v5' => '/index_unico_v5_1_azul_rojo_elegante/',
            'v6' => '/index_unico_v6_negro_dorado/',
            'v7' => '/index_unicov7/',
            'esencia-premium' => '/index_unico_v2/',
        ]);
    }

    private static function build_legacy_seed(array $payload): array {
        $barberia = is_array($payload['barberia'] ?? null) ? $payload['barberia'] : [];
        $perfil = is_array($payload['perfil_publico'] ?? null) ? $payload['perfil_publico'] : [];
        $branding = is_array($payload['branding'] ?? null) ? $payload['branding'] : [];
        $urls = is_array($payload['urls'] ?? null) ? $payload['urls'] : [];

        return [
            'barberia_id' => (int) ($barberia['id'] ?? 0),
            'slug' => (string) ($barberia['slug'] ?? ''),
            'barberia' => array_merge(
                $barberia,
                $perfil,
                $urls,
                [
                    'nombre' => (string) ($perfil['nombre_publico'] ?? $barberia['nombre'] ?? ''),
                ]
            ),
            'branding' => [
                'use_custom_palette' => true,
                'palette_primary' => (string) ($branding['primary_color'] ?? ''),
                'palette_secondary' => (string) ($branding['secondary_color'] ?? ''),
                'palette_text' => (string) ($branding['text_color'] ?? ''),
                'color_primary' => (string) ($branding['primary_color'] ?? ''),
                'color_secondary' => (string) ($branding['secondary_color'] ?? ''),
                'color_background' => (string) ($branding['background_color'] ?? ''),
                'color_text' => (string) ($branding['text_color'] ?? ''),
            ],
            'servicios' => array_values($payload['servicios'] ?? []),
            'barberos' => array_values($payload['barberos'] ?? []),
            'horarios' => array_values($payload['horarios'] ?? []),
            'public_landing_url' => (string) ($urls['public_landing_url'] ?? ''),
            'reservation_url' => (string) ($urls['reservation_url'] ?? ''),
            'qr_url' => (string) ($urls['qr_url'] ?? ''),
        ];
    }

    private static function set_404(): void {
        global $wp_query;

        if ($wp_query instanceof WP_Query) {
            $wp_query->set_404();
        }

        status_header(404);
        nocache_headers();
    }
}

BarberAgency_Public_Router::init();

register_activation_hook(__FILE__, [BarberAgency_Public_Router::class, 'activate']);
register_deactivation_hook(__FILE__, [BarberAgency_Public_Router::class, 'deactivate']);
