<?php
/**
 * Plugin Name: Dr. HVAC Connector
 * Description: Lets the Dr. HVAC agent in the DFW Thermal Debt Atlas read and edit pages, posts and Elementor templates over the REST API, with a backup before every write and a restore route, and reports what a hosting move needs. Works beside the FORGE Bridge; it never publishes by itself.
 * Version: 1.0.0
 * Author: DFW Thermal Debt Atlas
 * Requires at least: 6.2
 * Requires PHP: 7.4
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/*
 * What this adds, under /wp-json/drhvac/v1 (Application Password over HTTPS, the same sign in the FORGE Bridge uses):
 *   GET  /status                        versions, theme, Elementor, what the signed in user may do
 *   GET  /documents                     pages, posts and Elementor templates the user can edit (type, search, status, builder, slug)
 *   GET  /documents/<id>                one document: meta, SEO fields, content, the Elementor tree and page settings
 *   POST /documents/<id>                change it (Elementor tree, page settings, title, slug, status, content, excerpt, SEO, template)
 *   POST /documents                     create a draft, or clone an existing document
 *   GET  /documents/<id>/backups        the backups this plugin took of that document
 *   POST /documents/<id>/restore        put a backup back (the current state is backed up first)
 *   GET  /kit                           the Elementor kit: global colors, fonts and layout widths
 *   GET  /menus                         navigation menus and their items
 *   GET  /inventory                     what a hosting move needs to know (administrators only)
 *   POST /cache/clear                   regenerate Elementor's CSS and purge the page caches this plugin knows
 * Rules it keeps: every route checks the user's capabilities, and each document is checked again one by one; writing an
 * Elementor tree needs unfiltered_html (an administrator on a single site), as in the bridge; publishing needs the publish
 * capability of that post type; a write takes a backup first and keeps the last ten per document; nothing here returns a
 * password, a salt, a database credential or a server path. Remove the plugin and the backups it took stay as private
 * posts of type drhvac_backup until you delete them.
 */
final class DrHvac_Connector {
	const NS      = 'drhvac/v1';
	const VER     = '1.0.0';
	const BACKUP  = 'drhvac_backup';
	const KEEP    = 10;
	const MAX_EL  = 6000000; // bytes of Elementor JSON accepted in one write

	public static function init() {
		add_action( 'init', [ __CLASS__, 'types' ] );
		add_action( 'rest_api_init', [ __CLASS__, 'routes' ] );
	}

	/* ---------- the backup store: private posts, never public, never in REST ---------- */
	public static function types() {
		register_post_type( self::BACKUP, [ 'label' => 'Dr. HVAC backups', 'public' => false, 'show_ui' => false, 'show_in_rest' => false, 'exclude_from_search' => true, 'supports' => [ 'title' ], 'capability_type' => 'page', 'map_meta_cap' => true ] );
	}

	/* ---------- capability ---------- */
	public static function can_edit() { return current_user_can( 'edit_pages' ); }
	public static function can_admin() { return current_user_can( 'manage_options' ); }
	private static function deny( $msg, $code = 'drhvac_forbidden', $status = 403 ) { return new WP_Error( $code, $msg, [ 'status' => $status ] ); }

	/* ---------- routes ---------- */
	public static function routes() {
		$edit = [ __CLASS__, 'can_edit' ]; $admin = [ __CLASS__, 'can_admin' ]; $id = '(?P<id>\d+)';
		register_rest_route( self::NS, '/status', [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'r_status' ], 'permission_callback' => $edit ] );
		register_rest_route( self::NS, '/documents', [
			[ 'methods' => 'GET', 'callback' => [ __CLASS__, 'r_list' ], 'permission_callback' => $edit ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'r_create' ], 'permission_callback' => $edit ],
		] );
		register_rest_route( self::NS, '/documents/' . $id, [
			[ 'methods' => 'GET', 'callback' => [ __CLASS__, 'r_read' ], 'permission_callback' => $edit ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'r_write' ], 'permission_callback' => $edit ],
		] );
		register_rest_route( self::NS, '/documents/' . $id . '/backups', [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'r_backups' ], 'permission_callback' => $edit ] );
		register_rest_route( self::NS, '/documents/' . $id . '/restore', [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'r_restore' ], 'permission_callback' => $edit ] );
		register_rest_route( self::NS, '/kit', [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'r_kit' ], 'permission_callback' => $edit ] );
		register_rest_route( self::NS, '/menus', [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'r_menus' ], 'permission_callback' => $edit ] );
		register_rest_route( self::NS, '/inventory', [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'r_inventory' ], 'permission_callback' => $admin ] );
		register_rest_route( self::NS, '/cache/clear', [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'r_cache' ], 'permission_callback' => $admin ] );
	}

	/* ---------- small helpers ---------- */
	/* the post types this plugin serves: 'template' is Elementor's library */
	private static function pt( $type ) {
		$type = sanitize_key( (string) $type );
		if ( 'template' === $type || 'elementor_library' === $type ) { return 'elementor_library'; }
		return 'post' === $type ? 'post' : 'page';
	}
	private static function type_name( $pt ) { return 'elementor_library' === $pt ? 'template' : $pt; }
	private static function served( $pt ) { return in_array( $pt, [ 'page', 'post', 'elementor_library' ], true ); }
	/* a document this user may edit, or a WP_Error */
	private static function doc( $id ) {
		$p = get_post( (int) $id );
		if ( ! $p || ! self::served( $p->post_type ) ) { return new WP_Error( 'drhvac_not_found', 'No page, post or template with that id.', [ 'status' => 404 ] ); }
		if ( ! current_user_can( 'edit_post', $p->ID ) ) { return self::deny( 'You may not edit this document.' ); }
		return $p;
	}
	private static function builder( $p ) {
		if ( 'builder' === get_post_meta( $p->ID, '_elementor_edit_mode', true ) ) { return 'elementor'; }
		return ( function_exists( 'has_blocks' ) && has_blocks( $p->post_content ) ) ? 'blocks' : 'classic';
	}
	/* the Elementor tree as stored: a JSON string in post meta (an array on very old sites) */
	private static function el_data( $id ) {
		$raw = get_post_meta( $id, '_elementor_data', true );
		if ( is_array( $raw ) ) { return $raw; }
		if ( ! is_string( $raw ) || '' === $raw ) { return null; }
		$j = json_decode( $raw, true );
		return is_array( $j ) ? $j : null;
	}
	private static function el_settings( $id ) {
		$s = get_post_meta( $id, '_elementor_page_settings', true );
		return is_array( $s ) ? $s : [];
	}

	/* ---------- SEO fields, from whichever plugin the site runs (the bridge's own meta when there is none) ---------- */
	private static function seo_plugin() {
		if ( defined( 'WPSEO_VERSION' ) ) { return 'yoast'; }
		if ( defined( 'RANK_MATH_VERSION' ) ) { return 'rankmath'; }
		if ( defined( 'SEOPRESS_VERSION' ) ) { return 'seopress'; }
		if ( defined( 'AIOSEO_VERSION' ) ) { return 'aioseo'; }
		return 'none';
	}
	private static function read_seo( $id ) {
		$out = [ 'title' => '', 'description' => '', 'canonical' => '', 'noindex' => false, 'source' => self::seo_plugin() ];
		switch ( $out['source'] ) {
			case 'yoast':
				$out['title'] = (string) get_post_meta( $id, '_yoast_wpseo_title', true ); $out['description'] = (string) get_post_meta( $id, '_yoast_wpseo_metadesc', true );
				$out['canonical'] = (string) get_post_meta( $id, '_yoast_wpseo_canonical', true ); $out['noindex'] = '1' === (string) get_post_meta( $id, '_yoast_wpseo_meta-robots-noindex', true );
				break;
			case 'rankmath':
				$out['title'] = (string) get_post_meta( $id, 'rank_math_title', true ); $out['description'] = (string) get_post_meta( $id, 'rank_math_description', true );
				$out['canonical'] = (string) get_post_meta( $id, 'rank_math_canonical_url', true ); $robots = get_post_meta( $id, 'rank_math_robots', true ); $out['noindex'] = is_array( $robots ) && in_array( 'noindex', $robots, true );
				break;
			case 'seopress':
				$out['title'] = (string) get_post_meta( $id, '_seopress_titles_title', true ); $out['description'] = (string) get_post_meta( $id, '_seopress_titles_desc', true );
				$out['canonical'] = (string) get_post_meta( $id, '_seopress_robots_canonical', true ); $out['noindex'] = 'yes' === (string) get_post_meta( $id, '_seopress_robots_index', true );
				break;
			default:
				$f = json_decode( (string) get_post_meta( $id, '_forge_seo', true ), true );
				if ( is_array( $f ) ) { $out['title'] = (string) ( $f['title'] ?? '' ); $out['description'] = (string) ( $f['description'] ?? '' ); $out['canonical'] = (string) ( $f['canonical'] ?? '' ); $out['noindex'] = ! empty( $f['noindex'] ); $out['source'] = 'forge'; }
		}
		return $out;
	}
	/* only the keys present in $seo are written; the bridge's own record is kept in step when the page has one or no plugin is active */
	private static function write_seo( $id, $seo ) {
		$has = function ( $k ) use ( $seo ) { return is_array( $seo ) && array_key_exists( $k, $seo ); };
		$t = $has( 'title' ) ? sanitize_text_field( $seo['title'] ) : null; $d = $has( 'description' ) ? sanitize_text_field( $seo['description'] ) : null;
		$c = $has( 'canonical' ) ? esc_url_raw( $seo['canonical'] ) : null; $n = $has( 'noindex' ) ? (bool) $seo['noindex'] : null;
		switch ( self::seo_plugin() ) {
			case 'yoast':
				if ( null !== $t ) { update_post_meta( $id, '_yoast_wpseo_title', $t ); } if ( null !== $d ) { update_post_meta( $id, '_yoast_wpseo_metadesc', $d ); }
				if ( null !== $c ) { update_post_meta( $id, '_yoast_wpseo_canonical', $c ); } if ( null !== $n ) { update_post_meta( $id, '_yoast_wpseo_meta-robots-noindex', $n ? '1' : '2' ); }
				break;
			case 'rankmath':
				if ( null !== $t ) { update_post_meta( $id, 'rank_math_title', $t ); } if ( null !== $d ) { update_post_meta( $id, 'rank_math_description', $d ); }
				if ( null !== $c ) { update_post_meta( $id, 'rank_math_canonical_url', $c ); } if ( null !== $n ) { update_post_meta( $id, 'rank_math_robots', $n ? [ 'noindex' ] : [ 'index' ] ); }
				break;
			case 'seopress':
				if ( null !== $t ) { update_post_meta( $id, '_seopress_titles_title', $t ); } if ( null !== $d ) { update_post_meta( $id, '_seopress_titles_desc', $d ); }
				if ( null !== $c ) { update_post_meta( $id, '_seopress_robots_canonical', $c ); } if ( null !== $n ) { update_post_meta( $id, '_seopress_robots_index', $n ? 'yes' : '' ); }
				break;
		}
		$f = json_decode( (string) get_post_meta( $id, '_forge_seo', true ), true );
		if ( is_array( $f ) || 'none' === self::seo_plugin() ) {
			$f = is_array( $f ) ? $f : [];
			if ( null !== $t ) { $f['title'] = $t; } if ( null !== $d ) { $f['description'] = $d; } if ( null !== $c ) { $f['canonical'] = $c; } if ( null !== $n ) { $f['noindex'] = $n; }
			update_post_meta( $id, '_forge_seo', wp_slash( wp_json_encode( $f ) ) );
		}
	}

	/* ---------- shapes ---------- */
	private static function row( $p ) {
		$seo = self::read_seo( $p->ID ); $tpl = get_post_meta( $p->ID, '_wp_page_template', true );
		return [
			'id' => $p->ID, 'type' => self::type_name( $p->post_type ), 'title' => $p->post_title, 'slug' => $p->post_name, 'status' => $p->post_status,
			'link' => get_permalink( $p->ID ), 'modified' => $p->post_modified_gmt, 'template' => $tpl ? $tpl : 'default', 'builder' => self::builder( $p ),
			'el_type' => (string) get_post_meta( $p->ID, '_elementor_template_type', true ), 'parent' => (int) $p->post_parent,
			'seo' => [ 'title' => $seo['title'], 'description' => $seo['description'] ],
		];
	}
	private static function count_backups( $id ) {
		$q = get_posts( [ 'post_type' => self::BACKUP, 'post_parent' => (int) $id, 'post_status' => 'any', 'posts_per_page' => 50, 'fields' => 'ids', 'no_found_rows' => true ] );
		return count( $q );
	}

	/* ---------- GET /status ---------- */
	public static function r_status() {
		global $wp_version;
		$theme = wp_get_theme(); $el = defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : null;
		$c = function ( $pt ) { if ( ! post_type_exists( $pt ) ) { return 0; } $n = wp_count_posts( $pt ); return (int) ( $n->publish ?? 0 ) + (int) ( $n->draft ?? 0 ) + (int) ( $n->private ?? 0 ) + (int) ( $n->pending ?? 0 ); };
		$media = wp_count_posts( 'attachment' );
		return [
			'connector' => self::VER, 'wp' => $wp_version, 'php' => PHP_VERSION, 'home' => home_url( '/' ), 'site_name' => get_bloginfo( 'name' ),
			'theme' => [ 'name' => $theme->get( 'Name' ), 'version' => $theme->get( 'Version' ), 'template' => $theme->get_template(), 'child' => $theme->get_stylesheet() !== $theme->get_template() ],
			'elementor' => $el, 'elementor_pro' => defined( 'ELEMENTOR_PRO_VERSION' ) ? ELEMENTOR_PRO_VERSION : null, 'containers' => $el ? self::containers_active() : false,
			'kit_id' => (int) get_option( 'elementor_active_kit' ), 'permalinks' => get_option( 'permalink_structure' ), 'seo_plugin' => self::seo_plugin(), 'multisite' => is_multisite(),
			'user' => wp_get_current_user()->user_login,
			'can' => [ 'edit_pages' => current_user_can( 'edit_pages' ), 'publish_pages' => current_user_can( 'publish_pages' ), 'unfiltered_html' => current_user_can( 'unfiltered_html' ), 'manage_options' => current_user_can( 'manage_options' ) ],
			'bridge' => class_exists( 'Forge_Bridge' ),
			'counts' => [ 'pages' => $c( 'page' ), 'posts' => $c( 'post' ), 'templates' => $c( 'elementor_library' ), 'media' => (int) ( $media->inherit ?? 0 ) ],
			'upload_max' => wp_max_upload_size(), 'memory_limit' => ini_get( 'memory_limit' ), 'max_execution_time' => (int) ini_get( 'max_execution_time' ),
		];
	}
	private static function containers_active() {
		if ( ! class_exists( '\Elementor\Plugin' ) ) { return false; }
		$ex = \Elementor\Plugin::$instance->experiments;
		return $ex->get_features( 'container' ) ? (bool) $ex->is_feature_active( 'container' ) : true; // the experiment retired into core means containers are on
	}

	/* ---------- GET /documents ---------- */
	public static function r_list( WP_REST_Request $r ) {
		$type = sanitize_key( (string) ( $r->get_param( 'type' ) ?: 'any' ) );
		$types = 'any' === $type ? [ 'page', 'post', 'elementor_library' ] : [ self::pt( $type ) ];
		$types = array_values( array_filter( $types, 'post_type_exists' ) );
		if ( ! $types ) { return [ 'total' => 0, 'pages' => 0, 'items' => [] ]; }
		$per = min( 100, max( 1, (int) ( $r->get_param( 'per_page' ) ?: 50 ) ) ); $page = max( 1, (int) ( $r->get_param( 'page' ) ?: 1 ) );
		$status = sanitize_key( (string) ( $r->get_param( 'status' ) ?: 'any' ) );
		$args = [ 'post_type' => $types, 'post_status' => in_array( $status, [ 'publish', 'draft', 'pending', 'private', 'future' ], true ) ? $status : [ 'publish', 'draft', 'pending', 'private', 'future' ], 'posts_per_page' => $per, 'paged' => $page, 'orderby' => 'modified', 'order' => 'DESC' ];
		$search = sanitize_text_field( (string) $r->get_param( 'search' ) ); if ( '' !== $search ) { $args['s'] = $search; }
		$slug = sanitize_title( (string) $r->get_param( 'slug' ) ); if ( '' !== $slug ) { $args['name'] = $slug; }
		if ( 'elementor' === sanitize_key( (string) $r->get_param( 'builder' ) ) ) { $args['meta_query'] = [ [ 'key' => '_elementor_edit_mode', 'value' => 'builder' ] ]; }
		$q = new WP_Query( $args ); $items = [];
		foreach ( $q->posts as $p ) { if ( current_user_can( 'edit_post', $p->ID ) ) { $items[] = self::row( $p ); } }
		return [ 'total' => (int) $q->found_posts, 'pages' => (int) $q->max_num_pages, 'items' => $items ];
	}

	/* ---------- GET /documents/<id> ---------- */
	public static function r_read( WP_REST_Request $r ) {
		$p = self::doc( $r['id'] ); if ( is_wp_error( $p ) ) { return $p; }
		$parts = array_filter( array_map( 'sanitize_key', explode( ',', (string) ( $r->get_param( 'parts' ) ?: 'meta,elementor,content' ) ) ) );
		$out = self::row( $p ); $out['edit'] = get_edit_post_link( $p->ID, 'raw' ); $out['seo'] = self::read_seo( $p->ID );
		$out['has_blueprint'] = '' !== (string) get_post_meta( $p->ID, '_forge_blueprint', true ); $out['backups'] = self::count_backups( $p->ID );
		$thumb = (int) get_post_thumbnail_id( $p->ID ); $out['featured_media'] = $thumb ? [ 'id' => $thumb, 'url' => wp_get_attachment_url( $thumb ) ] : null;
		if ( in_array( 'elementor', $parts, true ) ) {
			$data = self::el_data( $p->ID );
			$out['elementor'] = null === $data ? null : [ 'version' => (string) get_post_meta( $p->ID, '_elementor_version', true ), 'edit_mode' => (string) get_post_meta( $p->ID, '_elementor_edit_mode', true ), 'template_type' => (string) get_post_meta( $p->ID, '_elementor_template_type', true ), 'data' => $data, 'page_settings' => (object) self::el_settings( $p->ID ) ];
		}
		if ( in_array( 'content', $parts, true ) ) { $out['content'] = $p->post_content; $out['excerpt'] = $p->post_excerpt; }
		return $out;
	}

	/* ---------- the state a backup holds, and taking one ---------- */
	private static function state( $p ) {
		return [
			'title' => $p->post_title, 'slug' => $p->post_name, 'status' => $p->post_status, 'content' => $p->post_content, 'excerpt' => $p->post_excerpt, 'modified' => $p->post_modified_gmt,
			'template' => (string) get_post_meta( $p->ID, '_wp_page_template', true ), 'elementor_data' => self::el_data( $p->ID ), 'page_settings' => self::el_settings( $p->ID ),
			'edit_mode' => (string) get_post_meta( $p->ID, '_elementor_edit_mode', true ), 'template_type' => (string) get_post_meta( $p->ID, '_elementor_template_type', true ), 'seo' => self::read_seo( $p->ID ),
		];
	}
	private static function backup( $p, $note ) {
		$state = wp_json_encode( self::state( $p ) );
		$bid = wp_insert_post( wp_slash( [ 'post_type' => self::BACKUP, 'post_status' => 'private', 'post_parent' => $p->ID, 'post_title' => sanitize_text_field( $note ? $note : 'Before a Dr. HVAC change' ) ] ), true );
		if ( is_wp_error( $bid ) ) { return $bid; }
		// meta, not post_content: content is filtered for users without unfiltered_html and a backup must be exact
		update_post_meta( $bid, '_drhvac_state', wp_slash( $state ) ); update_post_meta( $bid, '_drhvac_bytes', strlen( $state ) );
		$old = get_posts( [ 'post_type' => self::BACKUP, 'post_parent' => $p->ID, 'post_status' => 'any', 'posts_per_page' => 50, 'orderby' => 'ID', 'order' => 'DESC', 'fields' => 'ids', 'no_found_rows' => true ] );
		foreach ( array_slice( $old, self::KEEP ) as $x ) { wp_delete_post( (int) $x, true ); }
		return (int) $bid;
	}

	/* ---------- applying a patch (shared by write and restore) ---------- */
	private static function put_elementor( $id, $data, $pt ) {
		update_post_meta( $id, '_elementor_data', wp_slash( wp_json_encode( $data ) ) );
		update_post_meta( $id, '_elementor_edit_mode', 'builder' );
		if ( '' === (string) get_post_meta( $id, '_elementor_template_type', true ) ) { update_post_meta( $id, '_elementor_template_type', 'post' === $pt ? 'wp-post' : ( 'elementor_library' === $pt ? 'page' : 'wp-page' ) ); }
		if ( defined( 'ELEMENTOR_VERSION' ) ) { update_post_meta( $id, '_elementor_version', ELEMENTOR_VERSION ); }
		delete_post_meta( $id, '_elementor_css' ); // Elementor writes this page's stylesheet again on its next view
	}
	private static function put_template( $id, $tpl ) {
		$tpl = sanitize_text_field( (string) $tpl );
		if ( in_array( $tpl, [ 'elementor_header_footer', 'elementor_canvas', 'elementor_theme' ], true ) || ( '' !== $tpl && 'default' !== $tpl && preg_match( '/^[A-Za-z0-9_\-\/\.]+\.php$/', $tpl ) ) ) { update_post_meta( $id, '_wp_page_template', $tpl ); }
		else { delete_post_meta( $id, '_wp_page_template' ); }
	}
	private static function may_publish( $pt ) { $o = get_post_type_object( $pt ); return $o && current_user_can( $o->cap->publish_posts ); }

	/* ---------- POST /documents/<id> ---------- */
	public static function r_write( WP_REST_Request $r ) {
		$p = self::doc( $r['id'] ); if ( is_wp_error( $p ) ) { return $p; }
		$b = $r->get_json_params(); if ( ! is_array( $b ) ) { return new WP_Error( 'drhvac_bad', 'Send a JSON object.', [ 'status' => 400 ] ); }
		// staleness: the caller says which version it read; a page edited since then is not overwritten
		if ( ! empty( $b['expect_modified'] ) && (string) $b['expect_modified'] !== (string) $p->post_modified_gmt ) {
			return new WP_Error( 'drhvac_stale', 'This document changed on the site after it was read (' . $p->post_modified_gmt . ' now, ' . sanitize_text_field( (string) $b['expect_modified'] ) . ' when read). Read it again before writing.', [ 'status' => 409, 'modified' => $p->post_modified_gmt ] );
		}
		$has_el = array_key_exists( 'elementor_data', $b );
		if ( $has_el ) {
			if ( ! current_user_can( 'unfiltered_html' ) ) { return self::deny( 'Writing Elementor data needs the unfiltered_html capability (an administrator on a single site).', 'drhvac_caps' ); }
			if ( ! is_array( $b['elementor_data'] ) ) { return new WP_Error( 'drhvac_bad', 'elementor_data must be the element array.', [ 'status' => 400 ] ); }
			if ( strlen( (string) wp_json_encode( $b['elementor_data'] ) ) > self::MAX_EL ) { return new WP_Error( 'drhvac_large', 'The Elementor data is larger than this route accepts.', [ 'status' => 413 ] ); }
		}
		$status = isset( $b['status'] ) ? sanitize_key( (string) $b['status'] ) : null;
		if ( null !== $status ) {
			if ( ! in_array( $status, [ 'draft', 'publish', 'pending', 'private' ], true ) ) { return new WP_Error( 'drhvac_bad', 'status must be draft, publish, pending or private.', [ 'status' => 400 ] ); }
			if ( in_array( $status, [ 'publish', 'private' ], true ) && $status !== $p->post_status && ! self::may_publish( $p->post_type ) ) { return self::deny( 'You may not publish this type of document.', 'drhvac_publish' ); }
		}
		$bid = self::backup( $p, isset( $b['note'] ) ? (string) $b['note'] : '' ); if ( is_wp_error( $bid ) ) { return $bid; }

		$changed = []; $args = [ 'ID' => $p->ID ];
		if ( isset( $b['title'] ) ) { $args['post_title'] = wp_strip_all_tags( (string) $b['title'] ); $changed[] = 'title'; }
		if ( isset( $b['slug'] ) ) { $args['post_name'] = sanitize_title( (string) $b['slug'] ); $changed[] = 'slug'; }
		if ( null !== $status ) { $args['post_status'] = $status; $changed[] = 'status'; }
		if ( isset( $b['content_html'] ) ) { $args['post_content'] = current_user_can( 'unfiltered_html' ) ? (string) $b['content_html'] : wp_kses_post( (string) $b['content_html'] ); $changed[] = 'content'; }
		if ( isset( $b['excerpt'] ) ) { $args['post_excerpt'] = wp_strip_all_tags( (string) $b['excerpt'] ); $changed[] = 'excerpt'; }
		if ( $has_el ) { self::put_elementor( $p->ID, $b['elementor_data'], $p->post_type ); $changed[] = 'elementor_data'; }
		if ( isset( $b['page_settings'] ) && is_array( $b['page_settings'] ) ) { update_post_meta( $p->ID, '_elementor_page_settings', $b['page_settings'] ); delete_post_meta( $p->ID, '_elementor_css' ); $changed[] = 'page_settings'; }
		if ( isset( $b['template'] ) ) { self::put_template( $p->ID, $b['template'] ); $changed[] = 'template'; }
		if ( isset( $b['seo'] ) && is_array( $b['seo'] ) ) { self::write_seo( $p->ID, $b['seo'] ); $changed[] = 'seo'; }
		// always through wp_update_post, even for a meta only change: it stamps the modified time the staleness check reads
		$res = wp_update_post( wp_slash( $args ), true ); if ( is_wp_error( $res ) ) { return $res; }
		clean_post_cache( $p->ID ); $n = get_post( $p->ID );
		return [ 'id' => $n->ID, 'status' => $n->post_status, 'link' => get_permalink( $n->ID ), 'edit' => get_edit_post_link( $n->ID, 'raw' ), 'backup_id' => $bid, 'changed' => $changed, 'modified' => $n->post_modified_gmt ];
	}

	/* ---------- POST /documents (create or clone; a draft unless told otherwise) ---------- */
	public static function r_create( WP_REST_Request $r ) {
		$b = $r->get_json_params(); if ( ! is_array( $b ) ) { return new WP_Error( 'drhvac_bad', 'Send a JSON object.', [ 'status' => 400 ] ); }
		$src = null;
		if ( ! empty( $b['clone_of'] ) ) { $src = self::doc( $b['clone_of'] ); if ( is_wp_error( $src ) ) { return $src; } }
		$pt = self::pt( isset( $b['type'] ) ? $b['type'] : ( $src ? $src->post_type : 'page' ) );
		if ( ! post_type_exists( $pt ) ) { return new WP_Error( 'drhvac_noel', 'Elementor is not active, so there is no template library on this site.', [ 'status' => 409 ] ); }
		$o = get_post_type_object( $pt ); if ( ! $o || ! current_user_can( $o->cap->edit_posts ) ) { return self::deny( 'You may not create this type of document.' ); }
		$title = wp_strip_all_tags( (string) ( $b['title'] ?? ( $src ? $src->post_title . ' (copy)' : '' ) ) );
		if ( '' === $title ) { return new WP_Error( 'drhvac_bad', 'title is required.', [ 'status' => 400 ] ); }
		$status = isset( $b['status'] ) ? sanitize_key( (string) $b['status'] ) : 'draft';
		if ( ! in_array( $status, [ 'draft', 'publish', 'pending', 'private' ], true ) ) { $status = 'draft'; }
		if ( 'elementor_library' === $pt ) { $status = 'publish'; } // a saved template is listed in the library only when published; it is not a public page
		elseif ( in_array( $status, [ 'publish', 'private' ], true ) && ! self::may_publish( $pt ) ) { return self::deny( 'You may not publish this type of document.', 'drhvac_publish' ); }
		$data = array_key_exists( 'elementor_data', $b ) ? $b['elementor_data'] : ( $src ? self::el_data( $src->ID ) : null );
		if ( null !== $data ) {
			if ( ! is_array( $data ) ) { return new WP_Error( 'drhvac_bad', 'elementor_data must be the element array.', [ 'status' => 400 ] ); }
			if ( ! current_user_can( 'unfiltered_html' ) ) { return self::deny( 'Writing Elementor data needs the unfiltered_html capability (an administrator on a single site).', 'drhvac_caps' ); }
			if ( strlen( (string) wp_json_encode( $data ) ) > self::MAX_EL ) { return new WP_Error( 'drhvac_large', 'The Elementor data is larger than this route accepts.', [ 'status' => 413 ] ); }
		}
		$content = isset( $b['content_html'] ) ? (string) $b['content_html'] : ( $src ? $src->post_content : '' );
		$args = [ 'post_type' => $pt, 'post_title' => $title, 'post_status' => $status, 'post_content' => current_user_can( 'unfiltered_html' ) ? $content : wp_kses_post( $content ) ];
		if ( ! empty( $b['slug'] ) ) { $args['post_name'] = sanitize_title( (string) $b['slug'] ); }
		if ( ! empty( $b['parent'] ) && 'page' === $pt ) { $args['post_parent'] = (int) $b['parent']; }
		$id = wp_insert_post( wp_slash( $args ), true ); if ( is_wp_error( $id ) ) { return $id; }
		if ( null !== $data ) { self::put_elementor( $id, $data, $pt ); }
		$ps = isset( $b['page_settings'] ) && is_array( $b['page_settings'] ) ? $b['page_settings'] : ( $src ? self::el_settings( $src->ID ) : [] );
		if ( $ps ) { update_post_meta( $id, '_elementor_page_settings', $ps ); }
		if ( 'elementor_library' === $pt ) {
			$tt = sanitize_key( (string) ( $b['template_type'] ?? ( $src ? get_post_meta( $src->ID, '_elementor_template_type', true ) : '' ) ) ); $tt = in_array( $tt, [ '', 'wp-page', 'wp-post' ], true ) ? 'page' : $tt;
			update_post_meta( $id, '_elementor_template_type', $tt ); wp_set_object_terms( $id, $tt, 'elementor_library_type' );
		} else {
			self::put_template( $id, isset( $b['template'] ) ? $b['template'] : ( $src ? get_post_meta( $src->ID, '_wp_page_template', true ) : '' ) );
		}
		if ( isset( $b['seo'] ) && is_array( $b['seo'] ) ) { self::write_seo( $id, $b['seo'] ); }
		return [ 'id' => (int) $id, 'type' => self::type_name( $pt ), 'status' => get_post_status( $id ), 'link' => get_permalink( $id ), 'edit' => get_edit_post_link( $id, 'raw' ), 'cloned_from' => $src ? $src->ID : null ];
	}

	/* ---------- backups ---------- */
	public static function r_backups( WP_REST_Request $r ) {
		$p = self::doc( $r['id'] ); if ( is_wp_error( $p ) ) { return $p; }
		$q = get_posts( [ 'post_type' => self::BACKUP, 'post_parent' => $p->ID, 'post_status' => 'any', 'posts_per_page' => 50, 'orderby' => 'ID', 'order' => 'DESC', 'no_found_rows' => true ] ); $out = [];
		foreach ( $q as $x ) { $u = get_userdata( (int) $x->post_author ); $out[] = [ 'backup_id' => $x->ID, 'at' => $x->post_date_gmt, 'by' => $u ? $u->user_login : '', 'note' => $x->post_title, 'bytes' => (int) get_post_meta( $x->ID, '_drhvac_bytes', true ) ]; }
		return $out;
	}
	public static function r_restore( WP_REST_Request $r ) {
		$p = self::doc( $r['id'] ); if ( is_wp_error( $p ) ) { return $p; }
		$b = $r->get_json_params(); $bid = (int) ( is_array( $b ) ? ( $b['backup_id'] ?? 0 ) : 0 ); $x = $bid ? get_post( $bid ) : null;
		if ( ! $x || self::BACKUP !== $x->post_type || (int) $x->post_parent !== (int) $p->ID ) { return new WP_Error( 'drhvac_not_found', 'No such backup for this document.', [ 'status' => 404 ] ); }
		$s = json_decode( (string) get_post_meta( $x->ID, '_drhvac_state', true ), true ); if ( ! is_array( $s ) ) { return new WP_Error( 'drhvac_bad', 'That backup cannot be read.', [ 'status' => 500 ] ); }
		if ( ! current_user_can( 'unfiltered_html' ) ) { return self::deny( 'Restoring needs the unfiltered_html capability (an administrator on a single site).', 'drhvac_caps' ); }
		if ( in_array( $s['status'] ?? '', [ 'publish', 'private' ], true ) && ( $s['status'] !== $p->post_status ) && ! self::may_publish( $p->post_type ) ) { return self::deny( 'You may not publish this type of document.', 'drhvac_publish' ); }
		$now = self::backup( $p, 'Before restoring backup ' . $x->ID ); if ( is_wp_error( $now ) ) { return $now; }
		if ( is_array( $s['elementor_data'] ?? null ) ) { self::put_elementor( $p->ID, $s['elementor_data'], $p->post_type ); update_post_meta( $p->ID, '_elementor_edit_mode', (string) ( $s['edit_mode'] ?? 'builder' ) ); }
		else { delete_post_meta( $p->ID, '_elementor_data' ); delete_post_meta( $p->ID, '_elementor_edit_mode' ); delete_post_meta( $p->ID, '_elementor_css' ); }
		if ( is_array( $s['page_settings'] ?? null ) && $s['page_settings'] ) { update_post_meta( $p->ID, '_elementor_page_settings', $s['page_settings'] ); } else { delete_post_meta( $p->ID, '_elementor_page_settings' ); }
		self::put_template( $p->ID, (string) ( $s['template'] ?? '' ) );
		if ( is_array( $s['seo'] ?? null ) ) { self::write_seo( $p->ID, $s['seo'] ); }
		$res = wp_update_post( wp_slash( [ 'ID' => $p->ID, 'post_title' => (string) ( $s['title'] ?? $p->post_title ), 'post_name' => (string) ( $s['slug'] ?? $p->post_name ), 'post_status' => in_array( $s['status'] ?? '', [ 'draft', 'publish', 'pending', 'private', 'future' ], true ) ? $s['status'] : $p->post_status, 'post_content' => (string) ( $s['content'] ?? '' ), 'post_excerpt' => (string) ( $s['excerpt'] ?? '' ) ] ), true );
		if ( is_wp_error( $res ) ) { return $res; }
		clean_post_cache( $p->ID ); $n = get_post( $p->ID );
		return [ 'id' => $n->ID, 'restored_from' => $x->ID, 'backup_id' => $now, 'status' => $n->post_status, 'modified' => $n->post_modified_gmt ];
	}

	/* ---------- GET /kit ---------- */
	public static function r_kit() {
		$kit = (int) get_option( 'elementor_active_kit' ); if ( ! $kit || ! get_post( $kit ) ) { return [ 'kit_id' => 0 ]; }
		$s = get_post_meta( $kit, '_elementor_page_settings', true ); $s = is_array( $s ) ? $s : [];
		$keep = [ 'system_colors', 'custom_colors', 'system_typography', 'custom_typography', 'container_width', 'container_padding', 'space_between_widgets', 'viewport_md', 'viewport_lg', 'viewport_mobile', 'viewport_tablet', 'default_generic_fonts', 'body_color', 'body_typography_font_family', 'link_normal_color', 'h1_typography_font_family', 'h2_typography_font_family', 'button_background_color', 'button_text_color', 'button_border_radius', 'site_name', 'site_description' ];
		$out = [ 'kit_id' => $kit ]; foreach ( $keep as $k ) { if ( isset( $s[ $k ] ) ) { $out[ $k ] = $s[ $k ]; } }
		$out['other_settings'] = count( array_diff( array_keys( $s ), $keep ) );
		return $out;
	}

	/* ---------- GET /menus ---------- */
	public static function r_menus() {
		$locs = get_nav_menu_locations(); $out = [];
		foreach ( wp_get_nav_menus() as $m ) {
			$items = []; foreach ( ( wp_get_nav_menu_items( $m->term_id ) ?: [] ) as $it ) { $items[] = [ 'id' => $it->ID, 'parent' => (int) $it->menu_item_parent, 'title' => $it->title, 'url' => $it->url, 'target' => $it->target ]; }
			$out[] = [ 'id' => $m->term_id, 'name' => $m->name, 'locations' => array_keys( array_filter( (array) $locs, function ( $v ) use ( $m ) { return (int) $v === (int) $m->term_id; } ) ), 'items' => $items ];
		}
		return $out;
	}

	/* ---------- GET /inventory: what a hosting move needs (administrators) ---------- */
	public static function r_inventory( WP_REST_Request $r ) {
		global $wpdb, $wp_version;
		if ( ! function_exists( 'get_plugins' ) ) { require_once ABSPATH . 'wp-admin/includes/plugin.php'; }
		$plugins = []; foreach ( get_plugins() as $file => $d ) { $plugins[] = [ 'name' => $d['Name'], 'version' => $d['Version'], 'file' => $file, 'active' => is_plugin_active( $file ) ]; }
		$mu = []; foreach ( ( function_exists( 'get_mu_plugins' ) ? get_mu_plugins() : [] ) as $file => $d ) { $mu[] = [ 'name' => $d['Name'], 'version' => $d['Version'], 'file' => $file ]; }
		$dropins = function_exists( 'get_dropins' ) ? array_keys( get_dropins() ) : [];
		$theme = wp_get_theme(); $up = wp_upload_dir(); $media = wp_count_posts( 'attachment' );
		$db_size = null; $tables = null;
		$v = $wpdb->get_var( 'SELECT SUM(data_length + index_length) FROM information_schema.TABLES WHERE table_schema = DATABASE()' ); if ( null !== $v ) { $db_size = (int) $v; }
		$t = $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM information_schema.TABLES WHERE table_schema = DATABASE() AND table_name LIKE %s', $wpdb->esc_like( $wpdb->prefix ) . '%' ) ); if ( null !== $t ) { $tables = (int) $t; }
		$out = [
			'wp' => $wp_version, 'php' => PHP_VERSION, 'os' => PHP_OS_FAMILY, 'server' => isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['SERVER_SOFTWARE'] ) ) : '',
			'site_url' => site_url(), 'home_url' => home_url(), 'https' => is_ssl(), 'multisite' => is_multisite(), 'permalinks' => get_option( 'permalink_structure' ), 'language' => get_locale(), 'timezone' => wp_timezone_string(),
			'db' => [ 'server' => method_exists( $wpdb, 'db_server_info' ) ? $wpdb->db_server_info() : '', 'version' => $wpdb->db_version(), 'prefix' => $wpdb->prefix, 'charset' => $wpdb->charset, 'collate' => $wpdb->collate, 'size_bytes' => $db_size, 'tables' => $tables ],
			'uploads' => self::uploads( $up, (int) ( $media->inherit ?? 0 ) ),
			'theme' => [ 'name' => $theme->get( 'Name' ), 'version' => $theme->get( 'Version' ), 'template' => $theme->get_template(), 'stylesheet' => $theme->get_stylesheet(), 'installed' => count( wp_get_themes() ) ],
			'plugins' => $plugins, 'mu_plugins' => $mu, 'dropins' => $dropins,
			'elementor' => [ 'version' => defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : null, 'pro' => defined( 'ELEMENTOR_PRO_VERSION' ) ? ELEMENTOR_PRO_VERSION : null, 'css_print_method' => (string) get_option( 'elementor_css_print_method', '' ), 'kit_id' => (int) get_option( 'elementor_active_kit' ) ],
			'cache' => [ 'object_cache' => (bool) wp_using_ext_object_cache(), 'wp_cache_constant' => defined( 'WP_CACHE' ) && WP_CACHE, 'advanced_cache_dropin' => in_array( 'advanced-cache.php', $dropins, true ), 'object_cache_dropin' => in_array( 'object-cache.php', $dropins, true ) ],
			'cron' => [ 'disabled' => defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON, 'events' => count( (array) _get_cron_array() ) ],
			'constants' => [ 'WP_DEBUG' => defined( 'WP_DEBUG' ) && WP_DEBUG, 'FORCE_SSL_ADMIN' => defined( 'FORCE_SSL_ADMIN' ) && FORCE_SSL_ADMIN, 'DISALLOW_FILE_EDIT' => defined( 'DISALLOW_FILE_EDIT' ) && DISALLOW_FILE_EDIT, 'WP_MEMORY_LIMIT' => defined( 'WP_MEMORY_LIMIT' ) ? WP_MEMORY_LIMIT : '' ],
			'limits' => [ 'memory_limit' => ini_get( 'memory_limit' ), 'upload_max_filesize' => ini_get( 'upload_max_filesize' ), 'post_max_size' => ini_get( 'post_max_size' ), 'max_execution_time' => (int) ini_get( 'max_execution_time' ), 'max_input_vars' => (int) ini_get( 'max_input_vars' ) ],
			'counts' => [ 'pages' => (int) ( wp_count_posts( 'page' )->publish ?? 0 ), 'posts' => (int) ( wp_count_posts( 'post' )->publish ?? 0 ), 'media' => (int) ( $media->inherit ?? 0 ), 'administrators' => (int) ( count_users()['avail_roles']['administrator'] ?? 0 ) ],
			'mail_plugins' => array_values( array_map( function ( $p ) { return $p['name']; }, array_filter( $plugins, function ( $p ) { return $p['active'] && preg_match( '/smtp|mail|sendgrid|postmark|ses\b/i', $p['name'] ); } ) ) ),
		];
		// how many rows carry the site URL: the size of the search and replace a move needs. A table scan, so only when asked.
		if ( $r->get_param( 'deep' ) ) {
			$like = '%' . $wpdb->esc_like( untrailingslashit( home_url() ) ) . '%';
			$out['url_rows'] = [
				'options' => (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_value LIKE %s", $like ) ),
				'postmeta' => (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_value LIKE %s", $like ) ),
				'posts' => (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_content LIKE %s", $like ) ),
			];
		}
		return $out;
	}
	/* the size of the uploads folder, walked for at most two seconds so a large library never times the request out */
	private static function uploads( $up, $count ) {
		$out = [ 'count' => $count, 'url' => isset( $up['baseurl'] ) ? $up['baseurl'] : '', 'bytes' => null, 'complete' => false ];
		$dir = isset( $up['basedir'] ) ? $up['basedir'] : ''; if ( ! $dir || ! is_dir( $dir ) || ! class_exists( 'RecursiveDirectoryIterator' ) ) { return $out; }
		$t0 = microtime( true ); $bytes = 0; $done = true;
		try {
			$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ) );
			foreach ( $it as $f ) { if ( $f->isFile() ) { $bytes += $f->getSize(); } if ( microtime( true ) - $t0 > 2 ) { $done = false; break; } }
		} catch ( Exception $e ) { $done = false; }
		$out['bytes'] = $bytes; $out['complete'] = $done;
		return $out;
	}

	/* ---------- POST /cache/clear ---------- */
	public static function r_cache() {
		$cleared = [];
		if ( class_exists( '\Elementor\Plugin' ) && isset( \Elementor\Plugin::$instance->files_manager ) ) { \Elementor\Plugin::$instance->files_manager->clear_cache(); $cleared[] = 'Elementor CSS'; }
		if ( function_exists( 'wp_cache_flush' ) ) { wp_cache_flush(); $cleared[] = 'object cache'; }
		if ( function_exists( 'rocket_clean_domain' ) ) { rocket_clean_domain(); $cleared[] = 'WP Rocket'; }
		if ( function_exists( 'w3tc_flush_all' ) ) { w3tc_flush_all(); $cleared[] = 'W3 Total Cache'; }
		if ( function_exists( 'wp_cache_clear_cache' ) ) { wp_cache_clear_cache(); $cleared[] = 'WP Super Cache'; }
		if ( function_exists( 'sg_cachepress_purge_cache' ) ) { sg_cachepress_purge_cache(); $cleared[] = 'SiteGround Optimizer'; }
		if ( class_exists( 'autoptimizeCache' ) ) { autoptimizeCache::clearall(); $cleared[] = 'Autoptimize'; }
		if ( defined( 'LSCWP_V' ) ) { do_action( 'litespeed_purge_all' ); $cleared[] = 'LiteSpeed Cache'; }
		return [ 'cleared' => $cleared, 'note' => 'A cache at the host or a CDN in front of the site is not reached from here; purge it there.' ];
	}
}
DrHvac_Connector::init();
