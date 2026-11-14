/* ==== src/dr/11_dr_elementor.js ==== */
/* ==== dr_elementor ==== */
"use strict";
/* ============================ Dr. HVAC: the Elementor toolkit ============================
   Elementor keeps a page as a tree of elements: {id, elType, settings, elements, widgetType?}. A template export
   (Templates, Saved Templates, Export) wraps that tree as {content, page_settings, version, title, type}; a page keeps
   it in the _elementor_data post meta. Two generations exist and both are read here: flex containers (elType
   "container", nested freely) and the older section, column, widget stack.
   What this file does with a tree, without WordPress:
     parse and validate   take any of the shapes above (or a FORGE bundle or compile result), report what is wrong
     outline and slots    show the structure, and every place content lives, each with a stable reference
     apply                a list of edits: set a slot, replace text, urls or colors everywhere, remove, duplicate, move,
                          insert raw elements, edit repeater rows, regenerate ids
     diff                 what changed between two trees, in words, for the approval card and the report
     toHtml               an approximate, semantic rendering: the preview, the HTML fallback a page ships with, and the
                          text the compliance and audit checks read
     toTemplate, toBundle the export file, and the bundle the FORGE bridge imports
   A slot reference is "<element id>.<path>", for example "3f2a9c1.title", "3f2a9c1.link.url", "77be012.tabs[2].tab_content".
   Dynamic tags (__dynamic__) and global styles (__globals__) are kept as they are and reported: a slot driven by a
   dynamic tag is filled by WordPress at render time, so an edit to its static value changes nothing on the site.
   No DOM, no app helpers: the same file runs in the page and in the Node tests. */
DRHVAC.elementor = (() => {
  const D = DRHVAC;
  const HEX = '0123456789abcdef';
  const eid = () => { let s = ''; for (let i = 0; i < 7; i++) s += HEX[Math.floor(Math.random() * 16)]; return s; };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const strip = h => String(h == null ? '' : h).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/\s+/g, ' ').trim();
  const isObj = D.isObj; const clone = D.clone;
  const ELTYPES = ['container', 'section', 'column', 'widget'];

  /* Widgets that ship with Elementor Pro (as of the 3.x line). A type in neither list is reported as unknown, never guessed. */
  const PRO = new Set(['form', 'posts', 'portfolio', 'slides', 'nav-menu', 'animated-headline', 'price-list', 'price-table', 'flip-box', 'call-to-action', 'media-carousel', 'testimonial-carousel', 'reviews', 'countdown', 'share-buttons', 'blockquote', 'template', 'login', 'lottie', 'hotspot', 'paypal-button', 'stripe-button', 'progress-tracker', 'mega-menu', 'loop-grid', 'loop-carousel', 'table-of-contents', 'off-canvas', 'search', 'search-form', 'sitemap', 'breadcrumbs', 'post-navigation', 'author-box', 'post-comments', 'post-info', 'facebook-button', 'facebook-comments', 'facebook-embed', 'facebook-page', 'code-highlight', 'video-playlist', 'gallery', 'taxonomy-filter']);
  const CORE = new Set(['heading', 'image', 'text-editor', 'video', 'button', 'divider', 'spacer', 'google_maps', 'icon', 'image-box', 'icon-box', 'star-rating', 'rating', 'image-carousel', 'image-gallery', 'icon-list', 'counter', 'progress', 'testimonial', 'tabs', 'accordion', 'toggle', 'social-icons', 'alert', 'audio', 'shortcode', 'html', 'menu-anchor', 'sidebar', 'read-more', 'text-path', 'nested-tabs', 'nested-accordion', 'wp-widget-text', 'inner-section']);
  const isPro = t => PRO.has(t) || /^(theme-|woocommerce-|wc-|archive-|post-|loop-)/.test(String(t || ''));

  /* ---------- where content lives, by widget ----------
     [path, kind, label]; a path part ending in [] is a repeater. Kinds: text (plain or light inline HTML), html (rich
     HTML), link (a url), image ({url,id,alt}), number, address, video, shortcode, field (a form field label). */
  const W = {
    heading: [['title', 'text', 'Heading'], ['link.url', 'link', 'Heading link']],
    'text-editor': [['editor', 'html', 'Text']],
    button: [['text', 'text', 'Button label'], ['link.url', 'link', 'Button link']],
    image: [['image', 'image', 'Image'], ['caption', 'text', 'Caption'], ['link.url', 'link', 'Image link']],
    'image-box': [['image', 'image', 'Image'], ['title_text', 'text', 'Title'], ['description_text', 'text', 'Description'], ['link.url', 'link', 'Link']],
    'icon-box': [['title_text', 'text', 'Title'], ['description_text', 'text', 'Description'], ['link.url', 'link', 'Link']],
    'icon-list': [['icon_list[].text', 'text', 'List item'], ['icon_list[].link.url', 'link', 'List item link']],
    accordion: [['tabs[].tab_title', 'text', 'Question'], ['tabs[].tab_content', 'html', 'Answer']],
    toggle: [['tabs[].tab_title', 'text', 'Title'], ['tabs[].tab_content', 'html', 'Content']],
    tabs: [['tabs[].tab_title', 'text', 'Tab'], ['tabs[].tab_content', 'html', 'Tab content']],
    'nested-accordion': [['items[].item_title', 'text', 'Item title']],
    'nested-tabs': [['tabs[].tab_title', 'text', 'Tab']],
    testimonial: [['testimonial_content', 'text', 'Quote'], ['testimonial_name', 'text', 'Name'], ['testimonial_job', 'text', 'Role'], ['testimonial_image', 'image', 'Photo']],
    counter: [['ending_number', 'number', 'Number'], ['prefix', 'text', 'Prefix'], ['suffix', 'text', 'Suffix'], ['title', 'text', 'Label']],
    progress: [['title', 'text', 'Label'], ['percent.size', 'number', 'Percent'], ['inner_text', 'text', 'Inner text']],
    'star-rating': [['rating', 'number', 'Rating'], ['title', 'text', 'Label']],
    rating: [['rating_value', 'number', 'Rating']],
    alert: [['alert_title', 'text', 'Title'], ['alert_description', 'text', 'Description']],
    video: [['youtube_url', 'video', 'YouTube URL'], ['vimeo_url', 'video', 'Vimeo URL'], ['hosted_url', 'image', 'Hosted video'], ['external_url.url', 'video', 'Video URL'], ['image_overlay', 'image', 'Poster']],
    google_maps: [['address', 'address', 'Address']],
    html: [['html', 'html', 'HTML']],
    shortcode: [['shortcode', 'shortcode', 'Shortcode']],
    'menu-anchor': [['anchor', 'text', 'Anchor id']],
    'image-carousel': [['carousel[]', 'image', 'Slide image']],
    'image-gallery': [['wp_gallery[]', 'image', 'Gallery image']],
    'social-icons': [['social_icon_list[].link.url', 'link', 'Profile link']],
    'call-to-action': [['title', 'text', 'Title'], ['description', 'text', 'Description'], ['button', 'text', 'Button label'], ['link.url', 'link', 'Link'], ['bg_image', 'image', 'Background image'], ['ribbon_title', 'text', 'Ribbon']],
    'flip-box': [['title_text_a', 'text', 'Front title'], ['description_text_a', 'text', 'Front text'], ['title_text_b', 'text', 'Back title'], ['description_text_b', 'text', 'Back text'], ['button_text', 'text', 'Button label'], ['link.url', 'link', 'Link']],
    'animated-headline': [['before_text', 'text', 'Before'], ['highlighted_text', 'text', 'Highlighted'], ['rotating_text', 'text', 'Rotating lines'], ['after_text', 'text', 'After'], ['link.url', 'link', 'Link']],
    blockquote: [['blockquote_content', 'text', 'Quote'], ['author_name', 'text', 'Author']],
    'price-table': [['heading', 'text', 'Heading'], ['sub_heading', 'text', 'Sub heading'], ['price', 'text', 'Price'], ['period', 'text', 'Period'], ['features_list[].item_text', 'text', 'Feature'], ['button_text', 'text', 'Button label'], ['link.url', 'link', 'Link'], ['footer_additional_info', 'text', 'Footer note']],
    'price-list': [['price_list[].title', 'text', 'Item'], ['price_list[].price', 'text', 'Price'], ['price_list[].item_description', 'text', 'Description'], ['price_list[].link.url', 'link', 'Link']],
    slides: [['slides[].heading', 'text', 'Slide heading'], ['slides[].description', 'text', 'Slide text'], ['slides[].button_text', 'text', 'Slide button'], ['slides[].link.url', 'link', 'Slide link'], ['slides[].background_image', 'image', 'Slide image']],
    'testimonial-carousel': [['slides[].content', 'text', 'Quote'], ['slides[].name', 'text', 'Name'], ['slides[].title', 'text', 'Role'], ['slides[].image', 'image', 'Photo']],
    reviews: [['slides[].content', 'text', 'Review'], ['slides[].name', 'text', 'Name'], ['slides[].title', 'text', 'Source'], ['slides[].rating', 'number', 'Rating'], ['slides[].image', 'image', 'Photo']],
    form: [['form_name', 'text', 'Form name'], ['form_fields[].field_label', 'field', 'Field label'], ['form_fields[].placeholder', 'text', 'Placeholder'], ['button_text', 'text', 'Submit label'], ['email_to', 'text', 'Send leads to'], ['email_subject', 'text', 'Email subject'], ['success_message', 'text', 'Success message']],
    countdown: [['due_date', 'text', 'Due date']],
    template: [['template_id', 'number', 'Saved template id']],
  };
  /* every element can carry these */
  const COMMON = [['background_image', 'image', 'Background image'], ['background_overlay_image', 'image', 'Overlay image'], ['link.url', 'link', 'Wrapper link']];
  const GUESS_TEXT = /(^|_)(title|text|heading|description|content|label|caption|subtitle|sub_heading|name|quote|button)($|_)/;

  /* ---------- parsing ---------- */
  function normEl(e, problems, path) {
    if (!isObj(e)) { problems.push(`${path}: not an element object`); return null; }
    const out = { id: typeof e.id === 'string' && e.id ? e.id : eid(), elType: e.elType, settings: isObj(e.settings) ? e.settings : {}, elements: [], isInner: !!e.isInner };
    if (e.widgetType != null) out.widgetType = e.widgetType;
    if (!(typeof e.id === 'string' && e.id)) problems.push(`${path}: element had no id; one was assigned`);
    if (typeof e.elType !== 'string' || !e.elType) problems.push(`${path}: no elType`); else if (!ELTYPES.includes(e.elType)) problems.push(`${path}: element type "${e.elType}" is not one this toolkit knows; it is kept as it is`);
    (Array.isArray(e.elements) ? e.elements : []).forEach((c, i) => { const n = normEl(c, problems, `${path} › ${i}`); if (n) out.elements.push(n); });
    return out;
  }
  /* parse(input): a JSON string or object in any of the shapes named at the top → {ok, doc:{title,type,version,page_settings,elements}, problems} */
  function parse(input) {
    const problems = []; let j = input;
    if (typeof input === 'string') { try { j = JSON.parse(input.replace(/^﻿/, '')); } catch (e) { return { ok: false, doc: null, problems: ['Not JSON: ' + e.message] }; } }
    let els = null, meta = {};
    if (Array.isArray(j)) els = j;
    else if (isObj(j)) {
      if (Array.isArray(j.content)) { els = j.content; meta = { title: j.title, type: j.type, version: j.version, page_settings: j.page_settings }; }
      else if (Array.isArray(j.elementor_data)) { els = j.elementor_data; meta = { title: j.title || j.post_title, type: j.post_type === 'post' ? 'post' : 'page', page_settings: j.page_settings }; }
      else if (typeof j.elementor_data === 'string') { try { els = JSON.parse(j.elementor_data); } catch (e) { problems.push('elementor_data is a string that is not JSON'); } meta = { title: j.title, page_settings: j.page_settings }; }
      else if (isObj(j.template) && Array.isArray(j.template.content)) return parse(j.template);
      else if (isObj(j.elementor) && Array.isArray(j.elementor.data)) { els = j.elementor.data; meta = { title: j.title, type: j.type, page_settings: j.elementor.page_settings }; }
      else if (j.elType) els = [j];
    }
    if (!Array.isArray(els)) return { ok: false, doc: null, problems: problems.concat(['No Elementor element tree found. Expected a template export ({content: [...]}), a raw element array, or a bundle with elementor_data.']) };
    const elements = els.map((e, i) => normEl(e, problems, String(i))).filter(Boolean);
    const ps = isObj(meta.page_settings) ? meta.page_settings : {};
    return { ok: true, doc: { title: String(meta.title || ''), type: String(meta.type || 'page'), version: String(meta.version || '0.4'), page_settings: ps, elements }, problems };
  }

  /* ---------- walking ---------- */
  function walk(elements, fn, parent, depth) { depth = depth || 0; (elements || []).forEach((e, i) => { if (fn(e, parent || null, i, depth) === false) return; walk(e.elements, fn, e, depth + 1); }); }
  function find(elements, id) { let hit = null; (function rec(list, parent) { for (let i = 0; i < list.length && !hit; i++) { const e = list[i]; if (e.id === id) { hit = { el: e, parent, index: i, list }; return; } rec(e.elements || [], e); } })(elements || [], null); return hit; }
  const typeName = e => e.elType === 'widget' ? (e.widgetType || 'widget') : e.elType;

  /* ---------- setting paths: "a.b[2].c" ---------- */
  const parts = p => String(p).split('.').flatMap(seg => { const m = seg.match(/^([^[\]]+)((?:\[\d+\])*)$/); if (!m) return [seg]; const idx = [...m[2].matchAll(/\[(\d+)\]/g)].map(x => +x[1]); return [m[1], ...idx]; });
  function getPath(o, p) { let c = o; for (const k of parts(p)) { if (c == null) return undefined; c = c[k]; } return c; }
  function setPath(o, p, v) { const ks = parts(p); let c = o; for (let i = 0; i < ks.length - 1; i++) { const k = ks[i], nk = ks[i + 1]; if (c[k] == null || typeof c[k] !== 'object') c[k] = typeof nk === 'number' ? [] : {}; c = c[k]; } c[ks[ks.length - 1]] = v; }
  const splitRef = ref => { const s = String(ref || ''); const i = s.indexOf('.'); return i < 0 ? { id: s, path: '' } : { id: s.slice(0, i), path: s.slice(i + 1) }; };

  /* ---------- slots ---------- */
  function expand(settings, spec) {            /* a spec path with [] becomes one concrete path per repeater row */
    const out = []; const [path, kind, label] = spec; const i = path.indexOf('[]');
    if (i < 0) { out.push([path, kind, label, null]); return out; }
    const head = path.slice(0, i), tail = path.slice(i + 2).replace(/^\./, ''); const rows = getPath(settings, head);
    if (Array.isArray(rows)) rows.forEach((_, n) => out.push([`${head}[${n}]${tail ? '.' + tail : ''}`, kind, `${label} ${n + 1}`, n]));
    return out;
  }
  function slotValue(v, kind) {
    if (kind === 'image') { if (isObj(v) && (v.url || v.id)) return { url: v.url || '', id: v.id || 0, alt: v.alt || '' }; return null; }
    if (v == null || v === '') return null; if (isObj(v) || Array.isArray(v)) return null; return v;
  }
  /* slots(elements, {kinds, el, max}) → [{ref, el, widget, kind, label, value, text?, dynamic, global, guess}] */
  function slots(elements, o) {
    o = o || {}; const out = []; let scope = elements || [];
    if (o.el) { const h = find(scope, o.el); if (!h) return []; scope = [h.el]; }      /* that element and everything inside it */
    walk(scope, e => {
      const s = e.settings || {}; const dyn = isObj(s.__dynamic__) ? s.__dynamic__ : {}; const glob = isObj(s.__globals__) ? s.__globals__ : {};
      const specs = e.elType === 'widget' ? (W[e.widgetType] || null) : [];
      const add = (path, kind, label, guess) => {
        const v = slotValue(getPath(s, path), kind); const root = parts(path)[0]; const isDyn = dyn[root] != null || dyn[path] != null;
        if (v == null && !isDyn) return; if (o.kinds && !o.kinds.includes(kind)) return;
        out.push({ ref: `${e.id}.${path}`, el: e.id, widget: typeName(e), kind, label, value: v, text: kind === 'html' ? strip(v) : undefined, dynamic: isDyn, global: glob[root] != null, guess: !!guess });
      };
      if (specs) specs.forEach(sp => expand(s, sp).forEach(([p, k, l]) => add(p, k, l)));
      else {                                                             /* a widget this file has no map for: offer what looks like content, marked as a guess */
        Object.keys(s).forEach(k => { const v = s[k]; if (typeof v === 'string' && v.trim() && GUESS_TEXT.test(k) && !/^(#|rgba?\()/.test(v) && !/_(color|size|align|type|tag|style|position|animation)$/.test(k)) add(k, /<\w+[^>]*>/.test(v) ? 'html' : 'text', k, true); else if (isObj(v) && typeof v.url === 'string' && v.url && k !== 'link') add(v.id !== undefined ? k : k + '.url', v.id !== undefined ? 'image' : 'link', k, true); });
      }
      const own = new Set((specs || []).map(x => x[0]));
      COMMON.forEach(sp => { if (!own.has(sp[0])) expand(s, sp).forEach(([p, k, l]) => add(p, k, l)); });
    });
    return o.max ? out.slice(0, o.max) : out;
  }
  const text = elements => slots(elements, { kinds: ['text', 'html', 'field'] }).map(s => (s.kind === 'html' ? s.text : String(s.value))).filter(Boolean).join('\n');
  const words = elements => (text(elements).match(/\S+/g) || []).length;
  function images(elements) { return slots(elements, { kinds: ['image'] }).map(s => ({ ref: s.ref, url: s.value.url, id: s.value.id, alt: s.value.alt, widget: s.widget })); }
  /* the image ids of a tree belong to the site it came from. Before a tree goes to another site they are cleared, so
     Elementor renders by url and never by a number that names someone else's attachment. */
  function detachMedia(elements) { const out = clone(elements); let n = 0; walk(out, e => { (function rec(o) { if (Array.isArray(o)) return o.forEach(rec); if (!isObj(o)) return; if (typeof o.url === 'string' && o.id !== undefined && o.id !== '' && o.id !== 0) { o.id = ''; if (o.source) o.source = 'url'; n++; } Object.keys(o).forEach(k => { if (k !== 'elements') rec(o[k]); }); })(e.settings); }); return { elements: out, cleared: n }; }

  /* ---------- validate ---------- */
  function validate(elements) {
    const errors = [], warnings = []; const ids = new Map(); const byWidget = {}; let depth = 0, sections = 0, containers = 0, columns = 0, widgets = 0, dynamic = 0, globals = 0;
    const pro = new Set(), unknown = new Set(), otherTypes = new Set();
    if (!Array.isArray(elements)) return { ok: false, errors: ['The element tree is not an array.'], warnings, stats: {} };
    walk(elements, (e, parent, i, d) => {
      depth = Math.max(depth, d + 1); ids.set(e.id, (ids.get(e.id) || 0) + 1);
      if (typeof e.elType !== 'string' || !e.elType) errors.push(`${e.id}: an element without an elType`); else if (!ELTYPES.includes(e.elType)) { warnings.push(`${e.id}: element type "${e.elType}" is not one this toolkit knows (a newer Elementor or another plugin); it is kept as it is and cannot be edited by slot`); otherTypes.add(e.elType); }
      if (e.elType === 'widget') { widgets++; if (!e.widgetType) errors.push(`${e.id}: a widget without a widgetType`); else { byWidget[e.widgetType] = (byWidget[e.widgetType] || 0) + 1; if (isPro(e.widgetType)) pro.add(e.widgetType); else if (!CORE.has(e.widgetType)) unknown.add(e.widgetType); } if ((e.elements || []).length && !/^nested-/.test(e.widgetType || '')) warnings.push(`${e.id}: a ${e.widgetType} widget with child elements`); }
      if (e.elType === 'section') { sections++; if (parent && parent.elType !== 'column') errors.push(`${e.id}: a section inside a ${parent.elType} (sections sit at the top, or inside a column as an inner section)`); (e.elements || []).forEach(c => { if (c.elType !== 'column') errors.push(`${c.id}: a ${typeName(c)} directly inside a section (sections hold columns)`); }); }
      if (e.elType === 'column') { columns++; if (!parent || parent.elType !== 'section') errors.push(`${e.id}: a column outside a section`); }
      if (e.elType === 'container') containers++;
      if (!parent && e.elType === 'widget') errors.push(`${e.id}: a widget at the top level (wrap it in a container)`);
      if (!parent && e.elType === 'column') errors.push(`${e.id}: a column at the top level`);
      if (!/^[a-z0-9]{6,12}$/i.test(e.id)) warnings.push(`${e.id}: an unusual element id`);
      const s = e.settings || {}; if (isObj(s.__dynamic__)) dynamic += Object.keys(s.__dynamic__).length; if (isObj(s.__globals__)) globals += Object.keys(s.__globals__).filter(k => s.__globals__[k]).length;
    });
    const dup = [...ids.entries()].filter(([, n]) => n > 1).map(([id]) => id); if (dup.length) errors.push(`duplicate element ids: ${dup.slice(0, 8).join(', ')}${dup.length > 8 ? ' and more' : ''}`);
    if (sections && containers) warnings.push('The tree mixes sections and containers; it works, but new sections should use containers when the site has them on.');
    if (depth > 8) warnings.push(`Nesting is ${depth} levels deep; deep nesting slows the editor and the page.`);
    if (pro.size) warnings.push(`Needs Elementor Pro on the site: ${[...pro].join(', ')}.`);
    if (unknown.size) warnings.push(`Widgets from another plugin or a newer Elementor, not checked here: ${[...unknown].join(', ')}.`);
    let bytes = 0; try { bytes = JSON.stringify(elements).length; } catch (e) { bytes = 0; }
    return { ok: !errors.length, errors, warnings, stats: { top: elements.length, sections, containers, columns, widgets, depth, byWidget, ids: ids.size, bytes, legacy: sections > 0, usesContainers: containers > 0, pro: [...pro], unknown: [...unknown], otherTypes: [...otherTypes], dynamic, globals, words: words(elements), images: images(elements).length } };
  }

  /* ---------- outline ---------- */
  function label(e) {
    const s = e.settings || {}; const t = typeName(e); const first = (W[e.widgetType] || []).map(sp => expand(s, sp)[0]).filter(Boolean).map(([p, k]) => ({ v: slotValue(getPath(s, p), k), k })).find(x => x.v != null && (x.k === 'text' || x.k === 'html' || x.k === 'field'));
    const bits = [];
    if (e.elType === 'container') { bits.push(s.container_type === 'grid' ? 'grid' : (s.flex_direction || 'column')); if (s.content_width === 'boxed') bits.push('boxed'); }
    if (e.elType === 'column' && s._column_size) bits.push(s._column_size + '%');
    if (e.widgetType === 'heading') bits.push(s.header_size || 'h2');
    if (s._element_id) bits.push('#' + s._element_id); if (s.css_classes) bits.push('.' + String(s.css_classes).trim().split(/\s+/).join('.'));
    if (s.background_background) bits.push('bg ' + (s.background_color || (s.background_image && s.background_image.url ? 'image' : s.background_background)));
    const txt = first ? D.clip(strip(first.v), 70, 'text').split('\n')[0] : '';
    return `${t}${bits.length ? ' (' + bits.join(', ') + ')' : ''}${txt ? ' "' + txt + '"' : ''}`;
  }
  /* outline(elements, {depth, max}) → an indented text tree, one line per element: "  [id] heading (h1) "AC Repair in Frisco"" */
  function outline(elements, o) {
    o = o || {}; const maxDepth = o.depth || 99, max = o.max || 400; const lines = []; let skipped = 0;
    walk(elements, (e, parent, i, d) => { if (d >= maxDepth) { skipped++; return false; } if (lines.length >= max) { skipped++; return false; } const kids = (e.elements || []).length; lines.push(`${'  '.repeat(d)}[${e.id}] ${label(e)}${d === maxDepth - 1 && kids ? ` … ${kids} inside` : ''}`); });
    if (skipped) lines.push(`… ${skipped} more elements not shown (raise depth or max, or outline one element).`);
    return lines.join('\n');
  }

  /* ---------- colors and fonts in use ---------- */
  function design(elements, pageSettings) {
    const colors = {}, fonts = {}, globalsUsed = {};
    const scan = o => { if (Array.isArray(o)) return o.forEach(scan); if (!isObj(o)) return; Object.keys(o).forEach(k => { const v = o[k]; if (k === 'elements') return; if (k === '__globals__' && isObj(v)) { Object.values(v).forEach(g => { if (g) globalsUsed[g] = (globalsUsed[g] || 0) + 1; }); return; } if (typeof v === 'string') { if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) && /color/i.test(k)) colors[v.toLowerCase()] = (colors[v.toLowerCase()] || 0) + 1; else if (/font_family$/.test(k) && v) fonts[v] = (fonts[v] || 0) + 1; } else scan(v); }); };
    walk(elements, e => scan(e.settings)); if (isObj(pageSettings)) scan(pageSettings);
    const top = m => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ value: k, count: n }));
    return { colors: top(colors), fonts: top(fonts), globals: top(globalsUsed) };
  }

  /* ---------- edits ---------- */
  function reid(list) { walk(list, e => { e.id = eid(); const s = e.settings || {}; Object.values(s).forEach(v => { if (Array.isArray(v)) v.forEach(r => { if (isObj(r) && typeof r._id === 'string') r._id = eid(); }); }); }); return list; }
  const allIds = elements => { const s = new Set(); walk(elements, e => s.add(e.id)); return s; };
  /* every string value of a settings object that is content (not a control value), for replace_text */
  function eachText(e, fn) { const specs = (W[e.widgetType] || []).concat([]); const s = e.settings || {}; const seen = new Set(); specs.forEach(sp => expand(s, sp).forEach(([p, k]) => { if (k !== 'text' && k !== 'html' && k !== 'field' && k !== 'address') return; const v = getPath(s, p); if (typeof v === 'string' && v) { seen.add(p); const nv = fn(v, p, k); if (nv !== v) setPath(s, p, nv); } })); if (!W[e.widgetType] && e.elType === 'widget') Object.keys(s).forEach(k => { const v = s[k]; if (typeof v === 'string' && v && GUESS_TEXT.test(k) && !seen.has(k) && !/^(#|rgba?\()/.test(v)) { const nv = fn(v, k, 'text'); if (nv !== v) s[k] = nv; } }); }
  function eachString(o, fn) { if (Array.isArray(o)) { o.forEach((v, i) => { if (typeof v === 'string') o[i] = fn(v, String(i)); else eachString(v, fn); }); return; } if (!isObj(o)) return; Object.keys(o).forEach(k => { if (k === 'elements') return; const v = o[k]; if (typeof v === 'string') o[k] = fn(v, k); else eachString(v, fn); }); }
  const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* apply(elements, ops) → {elements (a new tree), log:[{op, ok, note}], changed}. One failed op does not stop the rest;
     each line of the log says what happened, so the model can correct a wrong reference. Ops:
       {op:'set', ref, value}                       a slot: text, html, a url, a number, or {url, id, alt} for an image
       {op:'set_setting', el, key, value}           any setting by path (layout, colors, classes), value of any JSON type
       {op:'replace_text', find, replace, el?, regex?}    in every text and html slot (inside el when given)
       {op:'replace_url', find, replace}            in every link, image and background url
       {op:'replace_color', find, replace}          every color setting equal to find (hex, case ignored)
       {op:'remove', el}   {op:'duplicate', el}     {op:'move', el, parent:'root'|id, index}
       {op:'insert', parent:'root'|id, index, elements:[...]}     raw Elementor elements (ids are regenerated)
       {op:'list_add', el, key, item, index?}  {op:'list_remove', el, key, index}  {op:'list_move', el, key, from, to}
       {op:'regen_ids'} */
  function apply(elements, ops) {
    const out = clone(elements || []); const log = []; let changed = 0;
    const done = (op, ok, note) => { log.push({ op: op.op, ok, note }); if (ok) changed++; };
    (Array.isArray(ops) ? ops : []).forEach(op => {
      try {
        if (!isObj(op) || !op.op) return done({ op: '?' }, false, 'not an op');
        if (op.op === 'set') {
          const { id, path } = splitRef(op.ref); const h = find(out, id); if (!h) return done(op, false, `no element ${id}`); if (!path) return done(op, false, 'the ref needs a path, for example ' + id + '.title');
          const s = h.el.settings; const root = parts(path)[0]; const dyn = isObj(s.__dynamic__) && s.__dynamic__[root] != null;
          const cur = getPath(s, path); let v = op.value;
          if (isObj(cur) && cur.url !== undefined && typeof v === 'string') v = Object.assign({}, cur, { url: v }, cur.id !== undefined ? { id: '', source: cur.source ? 'url' : undefined } : {});
          else if (isObj(cur) && isObj(v)) v = Object.assign({}, cur, v);
          setPath(s, path, v); return done(op, true, `${typeName(h.el)} ${path} set${dyn ? ' (note: this setting has a dynamic tag, so WordPress fills it at render time and the static value is only a fallback)' : ''}`);
        }
        if (op.op === 'set_setting') { const h = find(out, op.el); if (!h) return done(op, false, `no element ${op.el}`); if (!op.key) return done(op, false, 'key is required'); if (op.value === null) { const ks = parts(op.key); if (ks.length === 1) delete h.el.settings[ks[0]]; else setPath(h.el.settings, op.key, undefined); return done(op, true, `${typeName(h.el)} ${op.key} cleared`); } setPath(h.el.settings, op.key, op.value); return done(op, true, `${typeName(h.el)} ${op.key} set`); }
        if (op.op === 'replace_text') {
          if (!op.find) return done(op, false, 'find is empty'); const re = op.regex ? new RegExp(op.find, 'g') : new RegExp(reEsc(op.find), 'g'); let n = 0; const scope = op.el ? find(out, op.el) : null; if (op.el && !scope) return done(op, false, `no element ${op.el}`);
          walk(scope ? [scope.el] : out, e => eachText(e, v => { const nv = v.replace(re, () => { n++; return String(op.replace == null ? '' : op.replace); }); return nv; }));
          return done(op, n > 0, n ? `${n} replacement${n === 1 ? '' : 's'}` : `"${op.find}" not found in any text`);
        }
        if (op.op === 'replace_url') { if (!op.find) return done(op, false, 'find is empty'); let n = 0; walk(out, e => eachString(e.settings, (v, k) => { if ((k === 'url' || /_url$/.test(k) || k === 'shortcode' || k === 'html' || k === 'editor') && v.includes(op.find)) { n += v.split(op.find).length - 1; return v.split(op.find).join(String(op.replace || '')); } return v; })); return done(op, n > 0, n ? `${n} url${n === 1 ? '' : 's'} changed` : `"${op.find}" not found in any url`); }
        if (op.op === 'replace_color') { const f = String(op.find || '').toLowerCase(); if (!/^#[0-9a-f]{3,8}$/.test(f)) return done(op, false, 'find must be a hex color'); let n = 0; walk(out, e => eachString(e.settings, v => { if (v.toLowerCase() === f) { n++; return String(op.replace); } return v; })); return done(op, n > 0, n ? `${n} color value${n === 1 ? '' : 's'} changed` : `${op.find} is not used as a color here (it may come from a global style)`); }
        if (op.op === 'remove') { const h = find(out, op.el); if (!h) return done(op, false, `no element ${op.el}`); h.list.splice(h.index, 1); return done(op, true, `${typeName(h.el)} removed`); }
        if (op.op === 'duplicate') { const h = find(out, op.el); if (!h) return done(op, false, `no element ${op.el}`); const c = reid([clone(h.el)])[0]; h.list.splice(h.index + 1, 0, c); return done(op, true, `${typeName(h.el)} duplicated as ${c.id}`); }
        if (op.op === 'move') { const h = find(out, op.el); if (!h) return done(op, false, `no element ${op.el}`); const dest = op.parent && op.parent !== 'root' ? find(out, op.parent) : null; if (op.parent && op.parent !== 'root' && !dest) return done(op, false, `no element ${op.parent}`); if (dest && (dest.el.id === h.el.id || find(h.el.elements || [], dest.el.id))) return done(op, false, 'cannot move an element into itself'); h.list.splice(h.index, 1); const list = dest ? dest.el.elements : (op.parent === 'root' ? out : h.list); const idx = Math.max(0, Math.min(list.length, op.index == null ? list.length : +op.index)); list.splice(idx, 0, h.el); return done(op, true, `${typeName(h.el)} moved to ${dest ? dest.el.id : (op.parent === 'root' ? 'the top level' : 'the same parent')} at ${idx}`); }
        if (op.op === 'insert') { const p = parse(op.elements); if (!p.ok || !p.doc.elements.length) return done(op, false, 'elements is not an Elementor element list: ' + p.problems.join('; ')); const shape = []; walk(p.doc.elements, e => { if (typeof e.elType !== 'string' || !e.elType) shape.push('an element without an elType'); else if (e.elType === 'widget' && !e.widgetType) shape.push('a widget without a widgetType'); }); if (shape.length) return done(op, false, 'not inserted: ' + [...new Set(shape)].join('; ')); const add = reid(p.doc.elements); const dest = op.parent && op.parent !== 'root' ? find(out, op.parent) : null; if (op.parent && op.parent !== 'root' && !dest) return done(op, false, `no element ${op.parent}`); const list = dest ? dest.el.elements : out; const idx = Math.max(0, Math.min(list.length, op.index == null ? list.length : +op.index)); list.splice(idx, 0, ...add); return done(op, true, `${add.length} element${add.length === 1 ? '' : 's'} inserted at ${idx}: ${add.map(e => e.id).join(', ')}`); }
        if (op.op === 'list_add' || op.op === 'list_remove' || op.op === 'list_move') {
          const h = find(out, op.el); if (!h) return done(op, false, `no element ${op.el}`); let rows = getPath(h.el.settings, op.key); if (rows == null && op.op === 'list_add') { rows = []; setPath(h.el.settings, op.key, rows); } if (!Array.isArray(rows)) return done(op, false, `${op.key} is not a list on this ${typeName(h.el)}`);
          if (op.op === 'list_add') { const item = Object.assign({}, isObj(op.item) ? op.item : {}, { _id: eid() }); const idx = Math.max(0, Math.min(rows.length, op.index == null ? rows.length : +op.index)); rows.splice(idx, 0, item); return done(op, true, `row added to ${op.key} at ${idx}`); }
          if (op.op === 'list_remove') { if (!(op.index >= 0 && op.index < rows.length)) return done(op, false, `${op.key} has ${rows.length} rows`); rows.splice(op.index, 1); return done(op, true, `row ${op.index} removed from ${op.key}`); }
          if (!(op.from >= 0 && op.from < rows.length)) return done(op, false, `${op.key} has ${rows.length} rows`); const [r] = rows.splice(op.from, 1); rows.splice(Math.max(0, Math.min(rows.length, +op.to || 0)), 0, r); return done(op, true, `row moved in ${op.key}`);
        }
        if (op.op === 'regen_ids') { reid(out); return done(op, true, 'every element id regenerated'); }
        return done(op, false, `unknown op "${op.op}"`);
      } catch (e) { done(op, false, 'failed: ' + ((e && e.message) || e)); }
    });
    return { elements: out, log, changed };
  }

  /* ---------- diff ---------- */
  function diff(a, b) {
    const A = new Map(), B = new Map(); walk(a || [], (e, p) => A.set(e.id, { e, p: p ? p.id : 'root' })); walk(b || [], (e, p) => B.set(e.id, { e, p: p ? p.id : 'root' }));
    const added = [], removed = [], changed = [], moved = [];
    B.forEach((x, id) => { if (!A.has(id)) added.push(`${typeName(x.e)} ${id}`); });
    A.forEach((x, id) => { const y = B.get(id); if (!y) return removed.push(`${typeName(x.e)} ${id}`); if (x.p !== y.p) moved.push(`${typeName(x.e)} ${id}`); const sa = x.e.settings || {}, sb = y.e.settings || {}; const keys = [...new Set(Object.keys(sa).concat(Object.keys(sb)))].filter(k => JSON.stringify(sa[k]) !== JSON.stringify(sb[k])); if (keys.length) changed.push({ id, what: typeName(x.e), keys, sample: keys.slice(0, 2).map(k => `${k}: ${D.clip(strip(typeof sa[k] === 'string' ? sa[k] : JSON.stringify(sa[k] == null ? null : sa[k])), 60, 'value').split('\n')[0]} → ${D.clip(strip(typeof sb[k] === 'string' ? sb[k] : JSON.stringify(sb[k] == null ? null : sb[k])), 60, 'value').split('\n')[0]}`) }); });
    const lines = []; if (added.length) lines.push(`Added ${added.length}: ${added.slice(0, 6).join(', ')}${added.length > 6 ? ' …' : ''}`); if (removed.length) lines.push(`Removed ${removed.length}: ${removed.slice(0, 6).join(', ')}${removed.length > 6 ? ' …' : ''}`); if (moved.length) lines.push(`Moved ${moved.length}: ${moved.slice(0, 6).join(', ')}`); changed.slice(0, 12).forEach(c => lines.push(`Changed ${c.what} ${c.id}: ${c.sample.join('; ')}${c.keys.length > 2 ? ` (+${c.keys.length - 2} more settings)` : ''}`)); if (changed.length > 12) lines.push(`… and ${changed.length - 12} more changed elements`);
    return { added, removed, moved, changed, same: !added.length && !removed.length && !moved.length && !changed.length, summary: lines.join('\n') || 'No differences.' };
  }

  /* ---------- an approximate rendering ---------- */
  const unit = (v, d) => { if (v == null || v === '') return ''; if (isObj(v)) { if (v.size === '' || v.size == null) return ''; return v.size + (v.unit || d || 'px'); } return String(v); };
  const box = v => { if (!isObj(v) || [v.top, v.right, v.bottom, v.left].every(x => x === '' || x == null)) return ''; const u = v.unit || 'px'; return [v.top, v.right, v.bottom, v.left].map(x => (x === '' || x == null ? 0 : x) + u).join(' '); };
  const linkOf = l => (isObj(l) && l.url ? l.url : '');
  function styleOf(e, kit) {
    const s = e.settings || {}; const st = [];
    const color = (k, g) => s[k] || (isObj(s.__globals__) && s.__globals__[k] ? (kit && kit[s.__globals__[k]]) || `var(--e-${String(s.__globals__[k]).split('id=').pop()})` : g || '');
    if (s.background_background === 'classic' || s.background_color) { const c = color('background_color'); if (c) { st.push('background-color:' + c); if (isDark(c)) st.push('color:#fff'); } if (isObj(s.background_image) && s.background_image.url) st.push(`background-image:url('${String(s.background_image.url).replace(/'/g, '%27')}');background-size:${s.background_size || 'cover'};background-position:${s.background_position || 'center'}`); }
    const pad = box(s.padding); if (pad) st.push('padding:' + pad); const mar = box(s.margin); if (mar) st.push('margin:' + mar);
    const mh = unit(s.min_height); if (mh) st.push('min-height:' + mh);
    const br = box(s.border_radius); if (br) st.push('border-radius:' + br);
    return st;
  }
  const ROWISH = d => /^row/.test(String(d || ''));
  /* toHtml(elements, {kit}) → {html, css}. Approximate by design: Elementor and the theme render the real page. */
  function toHtml(elements, o) {
    o = o || {}; const kit = o.kit || null; let hasForm = false;
    const kids = e => (e.elements || []).map(render).join('');
    const attrs = (e, cls, st) => { const s = e.settings || {}; const c = [cls].concat(s.css_classes ? String(s.css_classes).trim().split(/\s+/) : []).filter(Boolean).join(' '); return `${s._element_id ? ` id="${esc(s._element_id)}"` : ''} class="${esc(c)}" data-el="${esc(e.id)}"${st && st.length ? ` style="${esc(st.join(';'))}"` : ''}`; };
    function widget(e) {
      const s = e.settings || {}; const t = e.widgetType; const align = s.align || s.text_align; const al = align && /^(left|center|right|justify)$/.test(align) ? `text-align:${align}` : '';
      const wrap = (inner, extra) => `<div${attrs(e, 'e-w e-w-' + t, [al].concat(extra || []).filter(Boolean))}>${inner}</div>`;
      const a = (url, inner, cls) => url ? `<a${cls ? ` class="${cls}"` : ''} href="${esc(url)}">${inner}</a>` : inner;
      const img = (m, alt) => isObj(m) && m.url ? `<img src="${esc(m.url)}" alt="${esc(m.alt || alt || '')}" loading="lazy" decoding="async">` : '';
      switch (t) {
        case 'heading': { const tag = /^h[1-6]$/.test(s.header_size || '') ? s.header_size : (s.header_size === 'div' || s.header_size === 'span' || s.header_size === 'p' ? s.header_size : 'h2'); const c = s.title_color ? `color:${s.title_color}` : ''; return wrap(`<${tag}${c ? ` style="${esc(c)}"` : ''}>${a(linkOf(s.link), s.title || '')}</${tag}>`); }
        case 'text-editor': return wrap(String(s.editor || ''), s.text_color ? ['color:' + s.text_color] : []);
        case 'button': return wrap(`<a class="e-btn" href="${esc(linkOf(s.link) || '#')}"${s.background_color ? ` style="background:${esc(s.background_color)};color:${esc(s.button_text_color || '#fff')}"` : ''}>${esc(s.text || '')}</a>`);
        case 'image': return wrap(a(linkOf(s.link), img(s.image)) + (s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ''));
        case 'image-box': return wrap(`${img(s.image, s.title_text)}<h3>${a(linkOf(s.link), esc(s.title_text || ''))}</h3><p>${esc(s.description_text || '')}</p>`);
        case 'icon-box': return wrap(`<h3>${a(linkOf(s.link), esc(s.title_text || ''))}</h3><p>${esc(s.description_text || '')}</p>`);
        case 'icon-list': return wrap('<ul class="e-list">' + (s.icon_list || []).map(i => `<li>${a(linkOf(i.link), esc(i.text || ''))}</li>`).join('') + '</ul>');
        case 'accordion': case 'toggle': return wrap((s.tabs || []).map(i => `<details class="e-faq"><summary><${/^h[1-6]$/.test(s.title_html_tag || '') ? s.title_html_tag : 'h3'}>${esc(i.tab_title || '')}</${/^h[1-6]$/.test(s.title_html_tag || '') ? s.title_html_tag : 'h3'}></summary>${String(i.tab_content || '')}</details>`).join(''));
        case 'tabs': return wrap((s.tabs || []).map(i => `<section class="e-tab"><h3>${esc(i.tab_title || '')}</h3>${String(i.tab_content || '')}</section>`).join(''));
        case 'testimonial': return wrap(`<blockquote><p>${esc(s.testimonial_content || '')}</p><footer>${esc(s.testimonial_name || '')}${s.testimonial_job ? ', ' + esc(s.testimonial_job) : ''}</footer></blockquote>`);
        case 'counter': return wrap(`<div class="e-count"><b>${esc(s.prefix || '')}${esc(s.ending_number == null ? '' : s.ending_number)}${esc(s.suffix || '')}</b><span>${esc(s.title || '')}</span></div>`);
        case 'star-rating': case 'rating': return wrap(`<p class="e-rating" aria-label="Rated ${esc(s.rating || s.rating_value || '')} out of 5">${esc(s.title || '')} ${esc(s.rating || s.rating_value || '')}/5</p>`);
        case 'video': { const u = s.youtube_url || s.vimeo_url || linkOf(s.external_url) || linkOf(s.hosted_url); const m = String(u || '').match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/); return wrap(m ? `<div class="e-video"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${esc(m[1])}" title="Video" allowfullscreen></iframe></div>` : u ? `<p><a href="${esc(u)}">Video</a></p>` : ''); }
        case 'google_maps': return wrap(`<p class="e-address">${esc(s.address || '')}</p>`);
        case 'html': return wrap(String(s.html || ''));
        case 'shortcode': return wrap(`<p class="e-shortcode">${esc(s.shortcode || '')}</p>`);
        case 'divider': return wrap('<hr>');
        case 'spacer': return `<div${attrs(e, 'e-w e-w-spacer', ['height:' + (unit(s.space) || '40px')])}></div>`;
        case 'alert': return wrap(`<p role="status"><strong>${esc(s.alert_title || '')}</strong> ${esc(s.alert_description || '')}</p>`);
        case 'menu-anchor': return `<span id="${esc(s.anchor || '')}"></span>`;
        case 'call-to-action': return wrap(`<h2>${esc(s.title || '')}</h2><p>${esc(s.description || '')}</p>${s.button ? `<a class="e-btn" href="${esc(linkOf(s.link) || '#')}">${esc(s.button)}</a>` : ''}`);
        case 'blockquote': return wrap(`<blockquote><p>${esc(s.blockquote_content || '')}</p><footer>${esc(s.author_name || '')}</footer></blockquote>`);
        case 'form': { hasForm = true; const rows = (s.form_fields || []).map(f => { const id = 'f-' + e.id + '-' + (f.custom_id || f._id || ''); if (f.field_type === 'acceptance') return `<label class="e-consent"><input type="checkbox" name="${esc(f.custom_id || 'consent')}"${f.required ? ' required' : ''}> ${esc(f.field_label || f.acceptance_text || '')}</label>`; const tag = f.field_type === 'textarea' ? `<textarea id="${esc(id)}" name="${esc(f.custom_id || '')}"${f.required ? ' required' : ''}></textarea>` : `<input id="${esc(id)}" type="${esc(/^(email|tel|url|number|date|time|text)$/.test(f.field_type || '') ? f.field_type : 'text')}" name="${esc(f.custom_id || '')}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}${f.required ? ' required' : ''}>`; return `<label for="${esc(id)}">${esc(f.field_label || f.placeholder || f.custom_id || '')}</label>${tag}`; }).join(''); return wrap(`<form class="e-form">${rows}<button type="submit" class="e-btn">${esc(s.button_text || 'Send')}</button></form>`); }
        default: { const sl = slots([e]); const body = sl.filter(x => x.kind === 'text' || x.kind === 'html').map(x => x.kind === 'html' ? String(x.value) : `<p>${esc(x.value)}</p>`).join('') + sl.filter(x => x.kind === 'image').map(x => img(x.value)).join(''); return wrap(body || `<p class="e-unknown">[${esc(t)} widget]</p>`) + kids(e); }
      }
    }
    function render(e) {
      const s = e.settings || {};
      if (e.elType === 'widget') return widget(e);
      const st = styleOf(e, kit); const tag = /^(section|header|footer|main|article|aside|nav|div)$/.test(s.html_tag || '') ? s.html_tag : (e.elType === 'section' ? 'section' : 'div');
      if (e.elType === 'section') return `<${tag}${attrs(e, 'e-sec', st)}><div class="e-row">${kids(e)}</div></${tag}>`;
      if (e.elType === 'column') { const w = s._column_size || s._inline_size; return `<div${attrs(e, 'e-col', st.concat(w ? ['flex:0 0 ' + w + '%', 'max-width:' + w + '%'] : ['flex:1']))}>${kids(e)}</div>`; }
      const dir = s.flex_direction || 'column'; const gap = isObj(s.flex_gap) ? (s.flex_gap.size != null && s.flex_gap.size !== '' ? s.flex_gap.size + (s.flex_gap.unit || 'px') : (s.flex_gap.row || s.flex_gap.column ? `${s.flex_gap.row || 0}${s.flex_gap.unit || 'px'} ${s.flex_gap.column || 0}${s.flex_gap.unit || 'px'}` : '')) : '';
      const fl = ['flex-direction:' + dir]; if (gap) fl.push('gap:' + gap); if (s.flex_wrap) fl.push('flex-wrap:' + s.flex_wrap); if (s.flex_justify_content) fl.push('justify-content:' + s.flex_justify_content); if (s.flex_align_items) fl.push('align-items:' + s.flex_align_items);
      const w = isObj(s.width) && s.width.size !== '' && s.width.size != null ? s.width.size + (s.width.unit || '%') : ''; const own = st.slice(); if (w) own.push(`flex:0 1 ${w}`, `max-width:${w}`, 'width:100%');
      const cls = 'e-con' + (ROWISH(dir) ? ' e-row-dir' : '') + (ROWISH(s.flex_direction_mobile) ? '' : ' e-stack');
      if (s.content_width === 'boxed') { const bw = unit(s.boxed_width) || '1140px'; return `<${tag}${attrs(e, cls + ' e-boxed', own)}><div class="e-con-inner" style="${esc(['max-width:' + bw].concat(fl).join(';'))}">${kids(e)}</div></${tag}>`; }
      return `<${tag}${attrs(e, cls, own.concat(fl))}>${kids(e)}</${tag}>`;
    }
    const html = (elements || []).map(render).join('\n');
    return { html, css: PREVIEW_CSS, hasForm };
  }
  /* is a hex color dark enough that text on it must be light? Text colors usually come from the site's global styles,
     which a template file does not carry, so the rendering picks the legible default. */
  const isDark = c => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim()); if (!m) return false; const h = m[1].length === 3 ? m[1].replace(/./g, x => x + x) : m[1]; const ch = i => { const v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4) < 0.2; };
  const PREVIEW_CSS = '.e-con,.e-con-inner{display:flex;box-sizing:border-box;min-width:0}.e-con{width:100%}.e-con-inner{width:100%;margin:0 auto}.e-sec{box-sizing:border-box}.e-row{display:flex;flex-wrap:wrap;max-width:1140px;margin:0 auto}.e-col{display:flex;flex-direction:column;gap:16px;box-sizing:border-box;padding:10px;min-width:0}.e-w{min-width:0;max-width:100%}.e-w a:not(.e-btn){color:inherit}.e-w img{max-width:100%;height:auto;border-radius:8px}.e-w h1,.e-w h2,.e-w h3,.e-w h4{margin:0 0 .4em;line-height:1.15}.e-w p{margin:0 0 .8em}.e-btn{display:inline-block;padding:13px 22px;border-radius:8px;background:var(--e-primary,#13243a);color:#fff;font-weight:700;text-decoration:none;border:0;cursor:pointer;font:inherit;font-weight:700}.e-list{list-style:none;padding:0;margin:0;display:grid;gap:6px}.e-list li:before{content:"\\2713\\00a0";font-weight:700}.e-faq{border-bottom:1px solid #e3e1da;padding:10px 0}.e-faq summary{cursor:pointer}.e-faq summary h3,.e-faq summary h4{display:inline;font-size:18px}.e-count{display:grid;text-align:center}.e-count b{font-size:38px;line-height:1.1}.e-video{position:relative;aspect-ratio:16/9}.e-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:10px}.e-form{display:grid;gap:8px;max-width:560px}.e-form input,.e-form textarea{padding:11px;border:1px solid #c3c0b7;border-radius:8px;font:inherit}.e-form label{font-weight:600}.e-consent{font-weight:400!important;font-size:13px}.e-unknown,.e-shortcode{font:12px/1.4 ui-monospace,monospace;color:#6b7280;border:1px dashed #c3c0b7;border-radius:6px;padding:8px}blockquote{margin:0}@media(max-width:767px){.e-stack,.e-stack>.e-con-inner{flex-direction:column!important}.e-stack>*,.e-stack>.e-con-inner>*{max-width:100%!important;flex-basis:auto!important}.e-row{flex-direction:column}.e-col{max-width:100%!important;flex-basis:auto!important}}';

  /* ---------- exports ---------- */
  const toTemplate = doc => ({ content: doc.elements, page_settings: isObj(doc.page_settings) && Object.keys(doc.page_settings).length ? doc.page_settings : [], version: doc.version || '0.4', title: doc.title || 'Template', type: doc.type || 'page' });
  /* the bundle the FORGE bridge's import route reads (same keys as FORGE_COMPILE.bundle); page carries the WordPress side */
  function toBundle(doc, page) {
    page = page || {}; const r = toHtml(doc.elements); const ps = Object.assign({}, isObj(doc.page_settings) ? doc.page_settings : {}); if (page.template) ps.template = page.template; if (ps.hide_title == null) ps.hide_title = 'yes';
    return { slug: page.slug || D.slugify(page.title || doc.title || 'page'), title: page.title || doc.title || '', post_title: page.h1 || page.title || doc.title || '', status: page.status === 'publish' ? 'publish' : 'draft', post_type: page.post_type === 'post' ? 'post' : 'page', template: ps.template || 'default', elementor_data: doc.elements, page_settings: ps, content_html: `<style>${r.css}</style>${r.html}`, seo: page.seo || { title: page.title || doc.title || '', description: page.meta_description || '', canonical: page.canonical || '', noindex: !!page.noindex }, schema: page.schema || null, summary: page.summary || '', excerpt: page.summary || '', featured_media: 0 };
  }

  return { PRO, CORE, isPro, W, eid, parse, walk, find, typeName, getPath, setPath, splitRef, slots, text, words, images, detachMedia, validate, outline, design, apply, diff, toHtml, PREVIEW_CSS, toTemplate, toBundle, strip };
})();
