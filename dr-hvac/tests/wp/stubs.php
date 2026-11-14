<?php
/* A small stand in for WordPress, enough to run the connector's route handlers under plain PHP: posts, post meta, options,
   capabilities, the REST request and error objects. It mirrors the behaviours the plugin depends on: wp_insert_post and
   update_post_meta strip one level of slashes (which is why the plugin calls wp_slash), wp_update_post stamps the modified
   time, a missing meta key reads as an empty string. It is not WordPress: what passes here still has to pass on a real
   site (tests/wp/README.md). */
define( 'ABSPATH', __DIR__ . '/' );
$GLOBALS['wp_version'] = '6.8.2';
$GLOBALS['T'] = [ 'posts' => [], 'meta' => [], 'options' => [], 'types' => [ 'page' => 1, 'post' => 1, 'attachment' => 1 ], 'routes' => [], 'caps' => [], 'deny_posts' => [], 'next' => 100, 'clock' => 1763100000, 'hooks' => [], 'terms' => [], 'user' => 'admin', 'thumb' => [], 'did' => [] ];
function T() { return $GLOBALS['T']; }

class WP_Error { public $code; public $message; public $data; function __construct( $c = '', $m = '', $d = '' ) { $this->code = $c; $this->message = $m; $this->data = $d; } function get_error_code() { return $this->code; } function get_error_message() { return $this->message; } function get_error_data() { return $this->data; } }
function is_wp_error( $x ) { return $x instanceof WP_Error; }
class WP_REST_Request implements ArrayAccess { public $params; public $json; function __construct( $p = [], $j = null ) { $this->params = $p; $this->json = $j; } function get_param( $k ) { return $this->params[ $k ] ?? null; } function get_json_params() { return $this->json; }
	#[\ReturnTypeWillChange] function offsetExists( $k ) { return isset( $this->params[ $k ] ); } #[\ReturnTypeWillChange] function offsetGet( $k ) { return $this->params[ $k ] ?? null; } #[\ReturnTypeWillChange] function offsetSet( $k, $v ) { $this->params[ $k ] = $v; } #[\ReturnTypeWillChange] function offsetUnset( $k ) { unset( $this->params[ $k ] ); } }

/* hooks: init and rest_api_init run when the harness boots */
function add_action( $h, $cb ) { $GLOBALS['T']['hooks'][ $h ][] = $cb; }
function add_filter( $h, $cb ) { $GLOBALS['T']['hooks'][ $h ][] = $cb; }
function do_action( $h ) { $GLOBALS['T']['did'][] = $h; foreach ( $GLOBALS['T']['hooks'][ $h ] ?? [] as $cb ) { call_user_func( $cb ); } }
function register_rest_route( $ns, $route, $args ) { $GLOBALS['T']['routes'][] = [ $ns, $route, isset( $args['methods'] ) ? [ $args ] : $args ]; }
function register_post_type( $pt, $args = [] ) { $GLOBALS['T']['types'][ $pt ] = $args; }
function post_type_exists( $pt ) { return isset( $GLOBALS['T']['types'][ $pt ] ); }
function get_post_type_object( $pt ) { if ( ! post_type_exists( $pt ) ) { return null; } $page = in_array( $pt, [ 'page', 'elementor_library', 'drhvac_backup' ], true ); return (object) [ 'name' => $pt, 'cap' => (object) [ 'publish_posts' => $page ? 'publish_pages' : 'publish_posts', 'edit_posts' => $page ? 'edit_pages' : 'edit_posts' ] ]; }

/* capabilities */
function current_user_can( $cap, $id = null ) { if ( 'edit_post' === $cap ) { return in_array( 'edit_pages', $GLOBALS['T']['caps'], true ) && ! in_array( (int) $id, $GLOBALS['T']['deny_posts'], true ); } return in_array( $cap, $GLOBALS['T']['caps'], true ); }
function wp_get_current_user() { return (object) [ 'user_login' => $GLOBALS['T']['user'], 'ID' => 1 ]; }
function get_userdata( $id ) { return (object) [ 'user_login' => $GLOBALS['T']['user'] ]; }
function count_users() { return [ 'avail_roles' => [ 'administrator' => 2 ] ]; }

/* slashes, the way WordPress treats them */
function wp_slash( $v ) { if ( is_array( $v ) ) { return array_map( 'wp_slash', $v ); } return is_string( $v ) ? addslashes( $v ) : $v; }
function wp_unslash( $v ) { if ( is_array( $v ) ) { return array_map( 'wp_unslash', $v ); } return is_string( $v ) ? stripslashes( $v ) : $v; }
function wp_json_encode( $v ) { return json_encode( $v ); }

/* posts */
function tick() { $GLOBALS['T']['clock'] += 61; return gmdate( 'Y-m-d H:i:s', $GLOBALS['T']['clock'] ); }
function wp_insert_post( $a, $wp_error = false ) {
	$a = wp_unslash( $a ); $id = $GLOBALS['T']['next']++; $now = tick();
	if ( empty( $a['post_title'] ) && empty( $a['post_content'] ) && ( $a['post_type'] ?? '' ) !== 'drhvac_backup' ) { return $wp_error ? new WP_Error( 'empty_content', 'Content, title, and excerpt are empty.' ) : 0; }
	$GLOBALS['T']['posts'][ $id ] = (object) [ 'ID' => $id, 'post_type' => $a['post_type'] ?? 'post', 'post_title' => $a['post_title'] ?? '', 'post_name' => $a['post_name'] ?? sanitize_title( $a['post_title'] ?? '' ), 'post_status' => $a['post_status'] ?? 'draft', 'post_content' => $a['post_content'] ?? '', 'post_excerpt' => $a['post_excerpt'] ?? '', 'post_parent' => (int) ( $a['post_parent'] ?? 0 ), 'post_author' => 1, 'post_modified_gmt' => $now, 'post_date_gmt' => $now ];
	return $id;
}
function wp_update_post( $a, $wp_error = false ) { $a = wp_unslash( $a ); $id = (int) ( $a['ID'] ?? 0 ); if ( ! isset( $GLOBALS['T']['posts'][ $id ] ) ) { return $wp_error ? new WP_Error( 'invalid_post', 'Invalid post ID.' ) : 0; } foreach ( $a as $k => $v ) { if ( 'ID' !== $k ) { $GLOBALS['T']['posts'][ $id ]->$k = $v; } } $GLOBALS['T']['posts'][ $id ]->post_modified_gmt = tick(); return $id; }
function wp_delete_post( $id, $force = false ) { unset( $GLOBALS['T']['posts'][ (int) $id ], $GLOBALS['T']['meta'][ (int) $id ] ); return true; }
function get_post( $id ) { $p = $GLOBALS['T']['posts'][ (int) $id ] ?? null; return $p ? clone $p : null; }
function get_post_status( $id ) { $p = get_post( $id ); return $p ? $p->post_status : false; }
function clean_post_cache( $id ) { }
function query_posts_stub( $a ) {
	$types = (array) ( $a['post_type'] ?? 'post' ); $st = $a['post_status'] ?? 'publish'; $out = [];
	foreach ( $GLOBALS['T']['posts'] as $p ) {
		if ( ! in_array( $p->post_type, $types, true ) ) { continue; }
		if ( 'any' !== $st && ! in_array( $p->post_status, (array) $st, true ) ) { continue; }
		if ( isset( $a['post_parent'] ) && (int) $p->post_parent !== (int) $a['post_parent'] ) { continue; }
		if ( ! empty( $a['s'] ) && false === stripos( $p->post_title . ' ' . $p->post_content, $a['s'] ) ) { continue; }
		if ( ! empty( $a['name'] ) && $p->post_name !== $a['name'] ) { continue; }
		if ( ! empty( $a['meta_query'] ) ) { $ok = true; foreach ( $a['meta_query'] as $m ) { if ( get_post_meta( $p->ID, $m['key'], true ) !== $m['value'] ) { $ok = false; } } if ( ! $ok ) { continue; } }
		$out[] = clone $p;
	}
	$by = $a['orderby'] ?? 'date'; $desc = 'ASC' !== ( $a['order'] ?? 'DESC' );
	usort( $out, function ( $x, $y ) use ( $by, $desc ) { $c = 'ID' === $by ? $x->ID <=> $y->ID : strcmp( $x->post_modified_gmt, $y->post_modified_gmt ); return $desc ? -$c : $c; } );
	return $out;
}
function get_posts( $a ) { $all = query_posts_stub( $a ); $n = (int) ( $a['posts_per_page'] ?? 5 ); $all = $n > 0 ? array_slice( $all, 0, $n ) : $all; return 'ids' === ( $a['fields'] ?? '' ) ? array_map( function ( $p ) { return $p->ID; }, $all ) : $all; }
class WP_Query { public $posts; public $found_posts; public $max_num_pages; function __construct( $a ) { $all = query_posts_stub( $a ); $per = (int) ( $a['posts_per_page'] ?? 10 ); $page = max( 1, (int) ( $a['paged'] ?? 1 ) ); $this->found_posts = count( $all ); $this->max_num_pages = (int) ceil( count( $all ) / $per ); $this->posts = array_slice( $all, ( $page - 1 ) * $per, $per ); } }

/* meta: stored unslashed, a missing key reads as '' */
function update_post_meta( $id, $k, $v ) { $GLOBALS['T']['meta'][ (int) $id ][ $k ] = wp_unslash( $v ); return true; }
function get_post_meta( $id, $k = '', $single = false ) { return $GLOBALS['T']['meta'][ (int) $id ][ $k ] ?? ''; }
function delete_post_meta( $id, $k ) { unset( $GLOBALS['T']['meta'][ (int) $id ][ $k ] ); return true; }
function get_post_thumbnail_id( $id ) { return $GLOBALS['T']['thumb'][ (int) $id ] ?? 0; }
function wp_get_attachment_url( $id ) { return 'https://site.test/wp-content/uploads/a' . (int) $id . '.webp'; }
function wp_set_object_terms( $id, $term, $tax ) { $GLOBALS['T']['terms'][ (int) $id ][ $tax ] = $term; }

/* options, urls, site */
function get_option( $k, $d = false ) { return $GLOBALS['T']['options'][ $k ] ?? $d; }
function update_option( $k, $v ) { $GLOBALS['T']['options'][ $k ] = $v; }
function home_url( $p = '' ) { return 'https://site.test' . $p; }
function site_url( $p = '' ) { return 'https://site.test' . $p; }
function untrailingslashit( $s ) { return rtrim( $s, '/' ); }
function get_permalink( $id ) { $p = get_post( $id ); return $p ? 'https://site.test/' . $p->post_name . '/' : false; }
function get_edit_post_link( $id, $ctx = 'display' ) { return 'https://site.test/wp-admin/post.php?post=' . (int) $id . '&action=edit'; }
function get_bloginfo( $k ) { return 'Northside Comfort'; }
function get_locale() { return 'en_US'; }
function wp_timezone_string() { return 'America/Chicago'; }
function is_ssl() { return true; }
function is_multisite() { return false; }
function wp_max_upload_size() { return 67108864; }
function wp_upload_dir() { return [ 'basedir' => __DIR__, 'baseurl' => 'https://site.test/wp-content/uploads' ]; }
function wp_count_posts( $pt ) { $o = (object) [ 'publish' => 0, 'draft' => 0, 'private' => 0, 'pending' => 0, 'inherit' => 7 ]; foreach ( $GLOBALS['T']['posts'] as $p ) { if ( $p->post_type === $pt && isset( $o->{$p->post_status} ) ) { $o->{$p->post_status}++; } } return $o; }
function wp_using_ext_object_cache() { return false; }
function wp_cache_flush() { $GLOBALS['T']['did'][] = 'wp_cache_flush'; return true; }
function _get_cron_array() { return [ 1 => [], 2 => [] ]; }
function has_blocks( $c ) { return false !== strpos( (string) $c, '<!-- wp:' ); }
class Theme_Stub { function get( $k ) { return 'Name' === $k ? 'Hello Elementor' : '3.4.1'; } function get_template() { return 'hello-elementor'; } function get_stylesheet() { return 'hello-elementor-child'; } }
function wp_get_theme() { return new Theme_Stub(); }
function wp_get_themes() { return [ 1, 2 ]; }
function get_plugins() { return [ 'elementor/elementor.php' => [ 'Name' => 'Elementor', 'Version' => '3.32.0' ], 'wp-mail-smtp/wp_mail_smtp.php' => [ 'Name' => 'WP Mail SMTP', 'Version' => '4.5' ], 'old/old.php' => [ 'Name' => 'Old Slider', 'Version' => '1.0' ] ]; }
function is_plugin_active( $f ) { return 'old/old.php' !== $f; }
function get_mu_plugins() { return []; }
function get_dropins() { return [ 'advanced-cache.php' => [] ]; }
function get_nav_menu_locations() { return [ 'primary' => 5 ]; }
function wp_get_nav_menus() { return [ (object) [ 'term_id' => 5, 'name' => 'Main' ] ]; }
function wp_get_nav_menu_items( $id ) { return [ (object) [ 'ID' => 9, 'menu_item_parent' => 0, 'title' => 'AC Repair', 'url' => 'https://site.test/ac-repair/', 'target' => '' ] ]; }

/* sanitizers */
function sanitize_key( $k ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $k ) ); }
function sanitize_title( $t ) { return trim( preg_replace( '/[^a-z0-9]+/', '-', strtolower( strip_tags( (string) $t ) ) ), '-' ); }
function sanitize_text_field( $s ) { return trim( preg_replace( '/\s+/', ' ', strip_tags( (string) $s ) ) ); }
function wp_strip_all_tags( $s ) { return trim( strip_tags( (string) $s ) ); }
function wp_kses_post( $s ) { return preg_replace( '#<script\b[^>]*>.*?</script>#is', '', (string) $s ); }
function esc_url_raw( $u ) { return filter_var( $u, FILTER_VALIDATE_URL ) ? $u : ''; }

/* the database handle the inventory reads */
class Wpdb_Stub { public $prefix = 'wp_'; public $charset = 'utf8mb4'; public $collate = 'utf8mb4_unicode_520_ci'; public $options = 'wp_options'; public $postmeta = 'wp_postmeta'; public $posts = 'wp_posts'; public $queries = [];
	function get_var( $q ) { $this->queries[] = $q; if ( false !== strpos( $q, 'SUM(data_length' ) ) { return '48234496'; } if ( false !== strpos( $q, 'information_schema' ) ) { return '37'; } if ( false !== strpos( $q, 'wp_options' ) ) { return '14'; } if ( false !== strpos( $q, 'wp_postmeta' ) ) { return '912'; } return '55'; }
	function prepare( $q, ...$a ) { foreach ( $a as $v ) { $q = preg_replace( '/%s/', "'" . addslashes( $v ) . "'", $q, 1 ); } return $q; }
	function esc_like( $s ) { return addcslashes( $s, '_%\\' ); } function db_version() { return '10.11.9'; } function db_server_info() { return '10.11.9-MariaDB'; } }
$GLOBALS['wpdb'] = new Wpdb_Stub();

/* the harness: boot the plugin, then call(method, route, query, json) runs the permission callback and the handler */
function boot() { do_action( 'init' ); do_action( 'rest_api_init' ); }
function call( $method, $route, $query = [], $json = null ) {
	foreach ( $GLOBALS['T']['routes'] as $rt ) {
		if ( ! preg_match( '#^' . $rt[1] . '$#', $route, $m ) ) { continue; }
		foreach ( $rt[2] as $h ) {
			if ( strtoupper( $h['methods'] ) !== $method ) { continue; }
			if ( ! call_user_func( $h['permission_callback'] ) ) { return new WP_Error( 'rest_forbidden', 'Sorry, you are not allowed to do that.', [ 'status' => 401 ] ); }
			$params = $query; foreach ( $m as $k => $v ) { if ( ! is_int( $k ) ) { $params[ $k ] = $v; } }
			$res = call_user_func( $h['callback'], new WP_REST_Request( $params, $json ) );
			return is_wp_error( $res ) ? $res : json_decode( json_encode( $res ) ); // what the client would receive: the JSON round trip
		}
	}
	return new WP_Error( 'rest_no_route', 'No route was found matching the URL and request method.', [ 'status' => 404 ] );
}
