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
        $legacy_path = self::template_legacy_path_map()[$template_id] ?? '';
        if ($legacy_path === '') {
            self::set_404();
            return;
        }

        $legacy_url = add_query_arg('slug', rawurlencode($slug), home_url($legacy_path));
        $html = self::fetch_legacy_html($legacy_url);
        if ($html === null) {
            self::set_404();
            return;
        }

        status_header(200);
        nocache_headers();
        header('Content-Type: text/html; charset=' . get_bloginfo('charset'));
        echo self::inject_route_context($html, $payload);
        exit;
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
        return sanitize_title((string) get_query_var(self::QUERY_VAR));
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
