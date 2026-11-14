<?php
/* Runs the connector plugin's routes against the stand in for WordPress in stubs.php and checks what comes back.
   `php tests/wp/run.php` (WITH_ELEMENTOR=0 runs it as a site without Elementor). tests/connector.test.mjs runs both. */
error_reporting( E_ALL ); ini_set( 'display_errors', '1' );
$PHP_NOTES = [];
set_error_handler( function ( $no, $str, $file, $line ) { $GLOBALS['PHP_NOTES'][] = basename( $file ) . ':' . $line . ' ' . $str; return true; } ); // a warning or a notice from the plugin fails the run
require __DIR__ . '/stubs.php';
$WITH_EL = '0' !== getenv( 'WITH_ELEMENTOR' );
if ( $WITH_EL ) {
	define( 'ELEMENTOR_VERSION', '3.32.0' ); define( 'ELEMENTOR_PRO_VERSION', '3.32.0' );
	register_post_type( 'elementor_library' );
	eval( 'namespace Elementor; class Experiments_Stub { function get_features( $f ) { return null; } function is_feature_active( $f ) { return true; } } class Files_Stub { public $cleared = 0; function clear_cache() { $this->cleared++; } } class Plugin { public static $instance; public $experiments; public $files_manager; }' );
	\Elementor\Plugin::$instance = new \Elementor\Plugin(); \Elementor\Plugin::$instance->experiments = new \Elementor\Experiments_Stub(); \Elementor\Plugin::$instance->files_manager = new \Elementor\Files_Stub();
}
define( 'WPSEO_VERSION', '25.0' ); // the site runs Yoast
require __DIR__ . '/../../src/connector/drhvac-connector.php';
boot();

$fails = 0;
function ok( $c, $label, $extra = null ) { global $fails; echo ( $c ? 'ok  ' : 'FAIL' ) . ' ' . $label . ( null !== $extra ? '  (' . substr( is_string( $extra ) ? $extra : json_encode( $extra ), 0, 300 ) . ')' : '' ) . "\n"; if ( ! $c ) { $fails++; } }
function err( $x, $code, $status ) { return is_wp_error( $x ) && $x->get_error_code() === $code && ( $x->get_error_data()['status'] ?? 0 ) === $status; }
$ADMIN = [ 'edit_pages', 'edit_posts', 'publish_pages', 'publish_posts', 'unfiltered_html', 'manage_options' ];
$EDITOR = [ 'edit_pages', 'edit_posts', 'publish_pages', 'publish_posts' ];
$AUTHOR = [ 'edit_posts' ];
$as = function ( $caps ) { $GLOBALS['T']['caps'] = $caps; };
$TREE = [ [ 'id' => 'aaa0001', 'elType' => 'container', 'settings' => [ 'flex_direction' => 'column' ], 'elements' => [ [ 'id' => 'aaa0002', 'elType' => 'widget', 'widgetType' => 'heading', 'settings' => [ 'title' => "It's \"quoted\" \\ and <b>bold</b>", 'header_size' => 'h1' ], 'elements' => [] ] ], 'isInner' => false ] ];

/* ---- routes and permissions ---- */
ok( count( T()['routes'] ) === 9 && post_type_exists( 'drhvac_backup' ) && false === T()['types']['drhvac_backup']['public'] && false === T()['types']['drhvac_backup']['show_in_rest'], 'nine routes registered; the backup type is private and not in REST' );
$as( [] ); ok( err( call( 'GET', '/status' ), 'rest_forbidden', 401 ) && err( call( 'GET', '/documents' ), 'rest_forbidden', 401 ) && err( call( 'POST', '/documents', [], [ 'title' => 'x' ] ), 'rest_forbidden', 401 ), 'a user without edit_pages reaches nothing' );
$as( $AUTHOR ); ok( err( call( 'GET', '/status' ), 'rest_forbidden', 401 ), 'an author (posts only) reaches nothing' );
$as( $EDITOR ); ok( err( call( 'GET', '/inventory' ), 'rest_forbidden', 401 ) && err( call( 'POST', '/cache/clear' ), 'rest_forbidden', 401 ), 'inventory and cache clearing are for administrators' );

/* ---- status ---- */
$as( $ADMIN ); $s = call( 'GET', '/status' );
ok( $s->connector === '1.0.0' && $s->wp === '6.8.2' && $s->site_name === 'Northside Comfort' && $s->theme->name === 'Hello Elementor' && $s->theme->child === true && $s->seo_plugin === 'yoast' && $s->user === 'admin' && $s->can->unfiltered_html === true && $s->bridge === false, 'status reports versions, theme, SEO plugin, user and capabilities', $s );
ok( $WITH_EL ? ( $s->elementor === '3.32.0' && $s->elementor_pro === '3.32.0' && $s->containers === true ) : ( $s->elementor === null && $s->containers === false ), 'status reports Elementor ' . ( $WITH_EL ? 'and containers' : 'as absent' ) );
$as( $EDITOR ); $s = call( 'GET', '/status' ); ok( $s->can->unfiltered_html === false && $s->can->manage_options === false && $s->can->publish_pages === true, 'an editor sees what it may not do' );

/* ---- create ---- */
$as( $ADMIN );
$c = call( 'POST', '/documents', [], [ 'title' => 'AC Repair <b>Frisco</b>', 'slug' => 'LP AC Frisco!', 'elementor_data' => $TREE, 'page_settings' => [ 'hide_title' => 'yes' ], 'template' => 'elementor_canvas', 'seo' => [ 'title' => 'AC Repair in Frisco', 'description' => 'Same day.', 'noindex' => true ] ] );
$id = $c->id; $p = get_post( $id );
ok( $c->status === 'draft' && $c->type === 'page' && $p->post_title === 'AC Repair Frisco' && $p->post_name === 'lp-ac-frisco' && $c->link === 'https://site.test/lp-ac-frisco/', 'a new page is a draft with a clean title and slug', $c );
ok( get_post_meta( $id, '_elementor_edit_mode', true ) === 'builder' && get_post_meta( $id, '_elementor_template_type', true ) === 'wp-page' && get_post_meta( $id, '_wp_page_template', true ) === 'elementor_canvas' && get_post_meta( $id, '_elementor_page_settings', true ) === [ 'hide_title' => 'yes' ] && ( $WITH_EL ? get_post_meta( $id, '_elementor_version', true ) === '3.32.0' : get_post_meta( $id, '_elementor_version', true ) === '' ), 'the Elementor meta, page settings and canvas template are set' );
ok( json_decode( get_post_meta( $id, '_elementor_data', true ), true ) === $TREE, 'the stored tree is byte faithful through the slashing (quotes, backslash, markup)' );
ok( get_post_meta( $id, '_yoast_wpseo_title', true ) === 'AC Repair in Frisco' && get_post_meta( $id, '_yoast_wpseo_meta-robots-noindex', true ) === '1' && get_post_meta( $id, '_forge_seo', true ) === '', 'SEO fields go to the active SEO plugin' );
ok( err( call( 'POST', '/documents', [], [ 'slug' => 'x' ] ), 'drhvac_bad', 400 ) && err( call( 'POST', '/documents', [], [ 'title' => 'x', 'elementor_data' => 'not an array' ] ), 'drhvac_bad', 400 ), 'a missing title or a tree that is not an array is refused' );
$as( $EDITOR );
ok( err( call( 'POST', '/documents', [], [ 'title' => 'E', 'elementor_data' => $TREE ] ), 'drhvac_caps', 403 ), 'an editor cannot write Elementor data (no unfiltered_html)' );
$e = call( 'POST', '/documents', [], [ 'title' => 'Editor page', 'content_html' => '<p>Hi</p><script>alert(1)</script>' ] );
ok( ! is_wp_error( $e ) && get_post( $e->id )->post_content === '<p>Hi</p>', 'an editor can create a plain page; its HTML is filtered' );
$GLOBALS['T']['caps'] = [ 'edit_pages' ]; ok( err( call( 'POST', '/documents', [], [ 'title' => 'P', 'status' => 'publish' ] ), 'drhvac_publish', 403 ), 'publishing needs the publish capability' );

/* ---- list and read ---- */
$as( $ADMIN ); $l = call( 'GET', '/documents', [ 'type' => 'page' ] );
ok( $l->total === 2 && $l->items[0]->title === 'Editor page' && $l->items[1]->builder === 'elementor' && $l->items[0]->builder === 'classic' && $l->items[1]->seo->title === 'AC Repair in Frisco' && $l->items[1]->template === 'elementor_canvas', 'the list is newest first with builder, template and SEO title', $l );
ok( call( 'GET', '/documents', [ 'builder' => 'elementor' ] )->total === 1 && call( 'GET', '/documents', [ 'search' => 'editor' ] )->total === 1 && call( 'GET', '/documents', [ 'slug' => 'lp-ac-frisco' ] )->items[0]->id === $id && call( 'GET', '/documents', [ 'status' => 'publish' ] )->total === 0 && call( 'GET', '/documents', [ 'per_page' => 1, 'page' => 2 ] )->items[0]->id === $id, 'filters: builder, search, slug, status, paging' );
$GLOBALS['T']['deny_posts'] = [ $id ]; ok( count( call( 'GET', '/documents', [ 'type' => 'page' ] )->items ) === 1 && err( call( 'GET', '/documents/' . $id ), 'drhvac_forbidden', 403 ), 'a document the user may not edit is left out of the list and refused by id' ); $GLOBALS['T']['deny_posts'] = [];
$d = call( 'GET', '/documents/' . $id );
ok( $d->id === $id && $d->elementor->data[0]->elements[0]->settings->title === "It's \"quoted\" \\ and <b>bold</b>" && $d->elementor->page_settings->hide_title === 'yes' && $d->elementor->edit_mode === 'builder' && $d->seo->noindex === true && $d->seo->source === 'yoast' && $d->backups === 0 && $d->featured_media === null && $d->edit !== '', 'reading returns the tree, page settings, SEO and counts', $d->seo );
$d2 = call( 'GET', '/documents/' . $id, [ 'parts' => 'meta' ] ); ok( ! isset( $d2->elementor ) && ! isset( $d2->content ) && $d2->slug === 'lp-ac-frisco', 'parts=meta leaves the tree and the content out' );
ok( err( call( 'GET', '/documents/99999' ), 'drhvac_not_found', 404 ) && is_object( $d->elementor->page_settings ), 'an unknown id is a 404' );
$plain = call( 'GET', '/documents/' . $e->id ); ok( $plain->elementor === null && $plain->builder === 'classic' && $plain->content === '<p>Hi</p>', 'a page without Elementor reads with elementor: null' );

/* ---- write: backup first, staleness, capabilities ---- */
$read = $d->modified; $T2 = $TREE; $T2[0]['elements'][0]['settings']['title'] = 'Furnace Repair in Frisco';
$w = call( 'POST', '/documents/' . $id, [], [ 'elementor_data' => $T2, 'seo' => [ 'title' => 'Furnace Repair in Frisco' ], 'expect_modified' => $read, 'note' => 'Headline change' ] );
ok( ! is_wp_error( $w ) && $w->changed === [ 'elementor_data', 'seo' ] && $w->status === 'draft' && $w->modified !== $read && $w->backup_id > 0, 'a write returns what changed, the new modified time and the backup it took', $w );
ok( json_decode( get_post_meta( $id, '_elementor_data', true ), true ) === $T2 && get_post_meta( $id, '_yoast_wpseo_title', true ) === 'Furnace Repair in Frisco' && get_post_meta( $id, '_yoast_wpseo_metadesc', true ) === 'Same day.' && get_post_meta( $id, '_yoast_wpseo_meta-robots-noindex', true ) === '1', 'the tree is replaced; only the SEO keys that were sent changed' );
$bk = get_post( $w->backup_id ); $st = json_decode( get_post_meta( $w->backup_id, '_drhvac_state', true ), true );
ok( $bk->post_type === 'drhvac_backup' && $bk->post_status === 'private' && $bk->post_parent === $id && $bk->post_title === 'Headline change' && $st['elementor_data'] === $TREE && $st['seo']['title'] === 'AC Repair in Frisco' && $st['status'] === 'draft' && $st['template'] === 'elementor_canvas', 'the backup holds the state from before the write, exactly' );
ok( err( call( 'POST', '/documents/' . $id, [], [ 'title' => 'Late', 'expect_modified' => $read ] ), 'drhvac_stale', 409 ) && get_post( $id )->post_title === 'AC Repair Frisco', 'a write based on an old read is refused with 409 and changes nothing' );
$n = count( get_posts( [ 'post_type' => 'drhvac_backup', 'post_parent' => $id, 'post_status' => 'any', 'posts_per_page' => 50 ] ) ); ok( $n === 1, 'a refused write takes no backup', $n );
ok( err( call( 'POST', '/documents/' . $id, [], [ 'status' => 'trash' ] ), 'drhvac_bad', 400 ) && err( call( 'POST', '/documents/' . $id, [], [ 'elementor_data' => 'x' ] ), 'drhvac_bad', 400 ), 'a bad status or tree is refused' );
$as( $EDITOR ); ok( err( call( 'POST', '/documents/' . $id, [], [ 'elementor_data' => $T2 ] ), 'drhvac_caps', 403 ), 'an editor cannot write the tree of an existing page' );
$GLOBALS['T']['caps'] = [ 'edit_pages' ]; ok( err( call( 'POST', '/documents/' . $id, [], [ 'status' => 'publish' ] ), 'drhvac_publish', 403 ), 'publishing an existing page needs the publish capability' );
$as( $ADMIN ); $pub = call( 'POST', '/documents/' . $id, [], [ 'status' => 'publish', 'title' => 'Furnace Repair in Frisco, TX', 'excerpt' => 'Short.', 'template' => 'default', 'page_settings' => [ 'hide_title' => '' ] ] );
ok( $pub->status === 'publish' && $pub->changed === [ 'title', 'status', 'excerpt', 'page_settings', 'template' ] && get_post_meta( $id, '_wp_page_template', true ) === '' && get_post( $id )->post_excerpt === 'Short.', 'title, status, excerpt, page settings and template in one write; the default template clears the meta' );
for ( $i = 0; $i < 12; $i++ ) { call( 'POST', '/documents/' . $id, [], [ 'excerpt' => 'v' . $i ] ); }
$bl = call( 'GET', '/documents/' . $id . '/backups' );
ok( count( $bl ) === 10 && $bl[0]->backup_id > $bl[9]->backup_id && $bl[0]->by === 'admin' && $bl[0]->bytes > 100 && call( 'GET', '/documents/' . $id, [ 'parts' => 'meta' ] )->backups === 10, 'only the last ten backups are kept, newest first', count( $bl ) );

/* ---- restore ---- */
$before = get_post( $id ); $target = $bl[9];
$tstate = json_decode( get_post_meta( $target->backup_id, '_drhvac_state', true ), true );
$r = call( 'POST', '/documents/' . $id . '/restore', [], [ 'backup_id' => $target->backup_id ] );
ok( ! is_wp_error( $r ) && $r->restored_from === $target->backup_id && $r->backup_id > $bl[0]->backup_id && get_post( $id )->post_excerpt === $tstate['excerpt'] && json_decode( get_post_meta( $id, '_elementor_data', true ), true ) === $tstate['elementor_data'], 'restore puts a backup back and backs up the state it replaced', $r );
ok( err( call( 'POST', '/documents/' . $id . '/restore', [], [ 'backup_id' => 424242 ] ), 'drhvac_not_found', 404 ) && err( call( 'POST', '/documents/' . $e->id . '/restore', [], [ 'backup_id' => $target->backup_id ] ), 'drhvac_not_found', 404 ), 'a backup of another document, or none, is refused' );
$as( $EDITOR ); ok( err( call( 'POST', '/documents/' . $id . '/restore', [], [ 'backup_id' => $bl[5]->backup_id ] ), 'drhvac_caps', 403 ), 'restoring needs unfiltered_html' ); $as( $ADMIN );
/* a backup of a page that had no Elementor data restores to no Elementor data */
$w2 = call( 'POST', '/documents/' . $e->id, [], [ 'elementor_data' => $TREE ] ); $r2 = call( 'POST', '/documents/' . $e->id . '/restore', [], [ 'backup_id' => $w2->backup_id ] );
ok( get_post_meta( $e->id, '_elementor_data', true ) === '' && get_post_meta( $e->id, '_elementor_edit_mode', true ) === '' && get_post( $e->id )->post_content === '<p>Hi</p>', 'restoring a pre Elementor backup removes the Elementor data again' );

/* ---- clone and templates ---- */
$cl = call( 'POST', '/documents', [], [ 'clone_of' => $id, 'title' => 'Furnace Repair in Plano, TX', 'slug' => 'lp-furnace-plano' ] );
ok( $cl->status === 'draft' && $cl->cloned_from === $id && json_decode( get_post_meta( $cl->id, '_elementor_data', true ), true ) === json_decode( get_post_meta( $id, '_elementor_data', true ), true ) && get_post_meta( $cl->id, '_elementor_page_settings', true ) === get_post_meta( $id, '_elementor_page_settings', true ) && get_post( $id )->post_status === 'publish', 'a clone of a published page is a draft with the same tree and settings', $cl );
$tp = call( 'POST', '/documents', [], [ 'type' => 'template', 'title' => 'Landing template', 'elementor_data' => $TREE, 'template_type' => 'page' ] );
if ( $WITH_EL ) {
	ok( ! is_wp_error( $tp ) && $tp->type === 'template' && get_post( $tp->id )->post_type === 'elementor_library' && get_post_meta( $tp->id, '_elementor_template_type', true ) === 'page' && T()['terms'][ $tp->id ]['elementor_library_type'] === 'page' && get_post( $tp->id )->post_status === 'publish', 'a template is saved to the Elementor library with its type' );
	$tl = call( 'GET', '/documents', [ 'type' => 'template' ] ); ok( $tl->total === 1 && $tl->items[0]->type === 'template' && $tl->items[0]->el_type === 'page' && call( 'GET', '/documents/' . $tp->id )->elementor->template_type === 'page', 'templates list and read like any document' );
	$fromTpl = call( 'POST', '/documents', [], [ 'clone_of' => $tp->id, 'type' => 'page', 'title' => 'From template' ] ); ok( get_post( $fromTpl->id )->post_type === 'page' && get_post_meta( $fromTpl->id, '_elementor_template_type', true ) === 'wp-page' && $fromTpl->status === 'draft', 'a page cloned from a template is a draft page, typed as a page' );
} else {
	ok( err( $tp, 'drhvac_noel', 409 ) && call( 'GET', '/documents', [ 'type' => 'template' ] )->total === 0, 'without Elementor there is no template library, and the route says so' );
}

/* ---- kit, menus, inventory, cache ---- */
ok( call( 'GET', '/kit' )->kit_id === 0, 'no kit: kit_id 0' );
$kit = wp_insert_post( [ 'post_type' => 'page', 'post_title' => 'Kit' ] ); update_option( 'elementor_active_kit', $kit ); update_post_meta( $kit, '_elementor_page_settings', [ 'system_colors' => [ [ '_id' => 'primary', 'title' => 'Primary', 'color' => '#173A69' ] ], 'container_width' => [ 'unit' => 'px', 'size' => 1140 ], 'secret_thing' => 'x', 'custom_css' => 'y' ] );
$k = call( 'GET', '/kit' ); ok( $k->kit_id === $kit && $k->system_colors[0]->color === '#173A69' && $k->container_width->size === 1140 && ! isset( $k->secret_thing ) && $k->other_settings === 2, 'the kit returns the global colors and widths, and only the listed keys', $k );
$m = call( 'GET', '/menus' ); ok( $m[0]->name === 'Main' && $m[0]->locations === [ 'primary' ] && $m[0]->items[0]->title === 'AC Repair', 'menus with their locations and items' );
$inv = call( 'GET', '/inventory' ); $json = json_encode( $inv );
ok( $inv->db->size_bytes === 48234496 && $inv->db->tables === 37 && $inv->db->prefix === 'wp_' && $inv->db->version === '10.11.9' && count( $inv->plugins ) === 3 && $inv->plugins[2]->active === false && $inv->mail_plugins === [ 'WP Mail SMTP' ] && $inv->cache->advanced_cache_dropin === true && $inv->counts->administrators === 2 && $inv->https === true && $inv->uploads->count === 7 && is_int( $inv->uploads->bytes ) && ! isset( $inv->url_rows ), 'the inventory covers database, uploads, plugins, mail, caches and limits', $inv->db );
ok( false === strpos( $json, __DIR__ ) && false === stripos( $json, 'password' ) && false === stripos( $json, 'DB_' ) && false === stripos( $json, 'salt' ), 'no server path, credential or salt appears in the inventory' );
$deep = call( 'GET', '/inventory', [ 'deep' => 1 ] ); ok( $deep->url_rows->options === 14 && $deep->url_rows->postmeta === 912 && preg_match( "/LIKE '%https:\/\/site\.test%'/", end( $GLOBALS['wpdb']->queries ) ), 'deep=1 adds the number of rows a search and replace would touch', $deep->url_rows );
$cc = call( 'POST', '/cache/clear' ); ok( in_array( 'object cache', $cc->cleared, true ) && in_array( 'wp_cache_flush', T()['did'], true ) && ( $WITH_EL ? ( in_array( 'Elementor CSS', $cc->cleared, true ) && \Elementor\Plugin::$instance->files_manager->cleared === 1 ) : ! in_array( 'Elementor CSS', $cc->cleared, true ) ) && false !== strpos( $cc->note, 'CDN' ), 'cache clearing reports what it cleared and what it cannot reach', $cc->cleared );

ok( ! $PHP_NOTES, 'PHP raised no warning, notice or deprecation while the routes ran', implode( ' | ', array_slice( $PHP_NOTES, 0, 4 ) ) );
echo $fails ? "\n$fails failed\n" : '';
exit( $fails ? 1 : 0 );
