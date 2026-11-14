/* ==== src/dr/10_dr_html.js ==== */
/* ==== dr_html ==== */
"use strict";
/* ============================ Dr. HVAC: the page and site toolkit ============================
   What a senior web developer does with a page before signing off on it, as code: read the markup, say what is wrong
   and how to fix it, and package finished pages as a site that can be uploaded as it is.
     tokens, parse      one small tolerant tokenizer, and a single pass over it that collects what a review needs:
                        head tags, headings, images, links, forms, scripts, styles, JSON-LD, landmarks, visible text
     outline            the page in a few dozen lines, for a model's context
     audit              findings in seven areas (seo, a11y, perf, cro, content, schema, security), each with the
                        evidence it rests on and a concrete fix, and a score
     contrast, design   WCAG contrast for the color pairs the markup resolves, and the look of a page as tokens
     sanitize           scripts and inline handlers out, for previews
     sitemapParse, redirectMap, redirectFormat      the URL side of a rebuild or a hosting move
     siteBundle         finished pages as a static site: shared header and footer, one stylesheet, sitemap, robots,
                        a 404 page, redirect files and a README
   A finding is only raised on what the markup shows. Where something cannot be known from the markup (a color that
   comes from a stylesheet on another host, the rendered size of a link) the result says so instead of guessing.
   No DOM: the same file runs in the page, in the background worker and in the Node tests. The sequences that open or
   close a script element or an HTML comment are never written out in this file, because the single file edition of
   the atlas carries it inline. */
DRHVAC.html = (() => {
  const D = DRHVAC;
  const esc = D.escHtml;
  const LT = '<', CMT = LT + '!--', SCR = 'scr' + 'ipt';
  const squash = s => String(s == null ? '' : s).replace(/[\s ]+/g, ' ').trim();
  const cut = (s, n) => { s = squash(s); return s.length > (n || 120) ? s.slice(0, (n || 120) - 1) + '…' : s; };
  const uniq = a => [...new Set(a)];
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  /* ---------- entities ---------- */
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', deg: '°', middot: '·', bull: '•', times: '×', frac12: '½' };
  const decode = s => String(s == null ? '' : s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === '#') { const n = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; } catch (err) { return m; } }
    const k = e.toLowerCase(); return has(ENT, k) ? ENT[k] : m; });

  /* ---------- the tokenizer ----------
     tokens(html) → [{t, pos, end, ...}] in source order; html.slice(pos, end) is the token's own source.
       open     {name, attrs, self}   attrs lower cased names, decoded values, the first of a repeated name wins
       close    {name}
       text     {text}                decoded; inside script and style the text is raw and carries raw: true
       comment  {text}     doctype  {text}
     Tolerant the way browsers are: a "<" that opens nothing is text, a tag that never closes runs to the end, quoted
     attribute values may hold ">" and unquoted ones end at white space or ">". script, style, textarea and title are
     read as raw text up to their own closing tag. */
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const RAWTEXT = new Set([SCR, 'style', 'textarea', 'title']);
  const WS = /\s/;
  function tokens(html) {
    const s = String(html == null ? '' : html), n = s.length, out = []; let i = 0;
    const text = (a, b) => { if (b > a) out.push({ t: 'text', text: decode(s.slice(a, b)), pos: a, end: b }); };
    while (i < n) {
      const lt = s.indexOf(LT, i);
      if (lt === -1) { text(i, n); break; }
      const c = s[lt + 1];
      if (s.startsWith(CMT, lt)) { text(i, lt); const e = s.indexOf('-->', lt + 4), end = e === -1 ? n : e + 3; out.push({ t: 'comment', text: s.slice(lt + 4, e === -1 ? n : e), pos: lt, end }); i = end; continue; }
      if (c === '!' || c === '?') { text(i, lt); const e = s.indexOf('>', lt), end = e === -1 ? n : e + 1; out.push({ t: /^.!doctype/i.test(s.slice(lt, lt + 9)) ? 'doctype' : 'comment', text: s.slice(lt + 2, e === -1 ? n : e).trim(), pos: lt, end }); i = end; continue; }
      if (c === '/') {
        const e = s.indexOf('>', lt), end = e === -1 ? n : e + 1; const nm = (/^\s*([a-zA-Z][^\s>\/]*)/.exec(s.slice(lt + 2, end)) || [])[1];
        if (!nm) { text(i, lt + 1); i = lt + 1; continue; }
        text(i, lt); out.push({ t: 'close', name: nm.toLowerCase(), pos: lt, end }); i = end; continue;
      }
      if (!c || !/[a-zA-Z]/.test(c)) { text(i, lt + 1); i = lt + 1; continue; }     /* a bare "<" is text */
      text(i, lt);
      let j = lt + 1; while (j < n && !WS.test(s[j]) && s[j] !== '>' && s[j] !== '/') j++;
      const name = s.slice(lt + 1, j).toLowerCase(), attrs = {}; let self = false;
      while (j < n) {
        while (j < n && WS.test(s[j])) j++;
        if (j >= n) break;
        if (s[j] === '>') { j++; break; }
        if (s[j] === '/') { if (s[j + 1] === '>') { self = true; j += 2; break; } j++; continue; }
        let k = j; while (k < n && !WS.test(s[k]) && s[k] !== '=' && s[k] !== '>' && s[k] !== '/') k++;
        const an = s.slice(j, k).toLowerCase(); if (k === j && s[j] !== '=') { j++; continue; }
        j = k; while (j < n && WS.test(s[j])) j++;
        let av = '';
        if (s[j] === '=') {
          j++; while (j < n && WS.test(s[j])) j++;
          const q = s[j];
          if (q === '"' || q === "'") { const e = s.indexOf(q, j + 1), end = e === -1 ? n : e; av = s.slice(j + 1, end); j = Math.min(n, end + 1); }
          else { let e = j; while (e < n && !WS.test(s[e]) && s[e] !== '>') e++; av = s.slice(j, e); j = e; }
        }
        if (an && !has(attrs, an)) attrs[an] = decode(av);
      }
      const rawText = RAWTEXT.has(name);     /* browsers ignore a self closing slash on these: the text still runs to the closing tag */
      out.push({ t: 'open', name, attrs, self: !rawText && (self || VOID.has(name)), pos: lt, end: j }); i = j;
      if (rawText) {
        const re = new RegExp(LT + '/' + name + '\\s*>', 'gi'); re.lastIndex = i; const m = re.exec(s), end = m ? m.index : n;
        if (end > i) { const raw = name === SCR || name === 'style'; out.push(raw ? { t: 'text', text: s.slice(i, end), pos: i, end, raw: true } : { t: 'text', text: decode(s.slice(i, end)), pos: i, end }); }
        if (m) { out.push({ t: 'close', name, pos: end, end: end + m[0].length }); i = end + m[0].length; } else i = n;
      }
    }
    return out;
  }
  /* a tag written back out; only used where a tag had to change (sanitize), everything else is copied from the source */
  const attrText = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const openTag = (name, attrs, self) => LT + name + Object.keys(attrs).map(k => ' ' + k + '="' + attrText(attrs[k]) + '"').join('') + (self && !VOID.has(name) ? ' /' : '') + '>';

  /* ---------- colors and contrast ---------- */
  const NAMED = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', gray: '#808080', grey: '#808080', silver: '#c0c0c0', navy: '#000080', teal: '#008080', maroon: '#800000', purple: '#800080', olive: '#808000', lime: '#00ff00', aqua: '#00ffff', cyan: '#00ffff', fuchsia: '#ff00ff', magenta: '#ff00ff', pink: '#ffc0cb', brown: '#a52a2a', gold: '#ffd700', whitesmoke: '#f5f5f5', lightgray: '#d3d3d3', lightgrey: '#d3d3d3', darkgray: '#a9a9a9', darkgrey: '#a9a9a9', dimgray: '#696969', gainsboro: '#dcdcdc', ivory: '#fffff0', beige: '#f5f5dc', crimson: '#dc143c', tomato: '#ff6347', royalblue: '#4169e1', steelblue: '#4682b4', darkblue: '#00008b', midnightblue: '#191970', slategray: '#708090', firebrick: '#b22222', darkred: '#8b0000', darkgreen: '#006400', forestgreen: '#228b22', seagreen: '#2e8b57', skyblue: '#87ceeb', dodgerblue: '#1e90ff' };
  const c255 = v => Math.max(0, Math.min(255, Math.round(v)));
  const c01 = v => Number.isNaN(v) ? 1 : Math.max(0, Math.min(1, v));
  /* parseColor(str) → {r, g, b, a} or null: hex in 3, 4, 6 or 8 digits, rgb(), rgba(), hsl(), hsla() and the common names */
  function parseColor(str) {
    if (str && typeof str === 'object' && 'r' in str) return str;
    let s = String(str == null ? '' : str).trim().toLowerCase(); if (!s) return null;
    if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (has(NAMED, s)) s = NAMED[s];
    let m = /^#([0-9a-f]{3,8})$/.exec(s);
    if (m) { let h = m[1]; if (h.length === 3 || h.length === 4) h = h.split('').map(x => x + x).join(''); if (h.length !== 6 && h.length !== 8) return null; return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? Math.round(parseInt(h.slice(6, 8), 16) / 255 * 1000) / 1000 : 1 }; }
    const num = v => /%$/.test(v) ? parseFloat(v) * 2.55 : parseFloat(v), alpha = v => v == null ? 1 : c01(/%$/.test(v) ? parseFloat(v) / 100 : parseFloat(v));
    m = /^rgba?\(([^)]+)\)$/.exec(s);
    if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean); if (p.length < 3) return null; const v = [num(p[0]), num(p[1]), num(p[2])]; return v.some(Number.isNaN) ? null : { r: c255(v[0]), g: c255(v[1]), b: c255(v[2]), a: alpha(p[3]) }; }
    m = /^hsla?\(([^)]+)\)$/.exec(s);
    if (m) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean); if (p.length < 3) return null;
      const h = ((parseFloat(p[0]) % 360) + 360) % 360, sat = parseFloat(p[1]) / 100, l = parseFloat(p[2]) / 100; if ([h, sat, l].some(Number.isNaN)) return null;
      const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs((h / 60) % 2 - 1)), k = l - c / 2;
      const t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
      return { r: c255((t[0] + k) * 255), g: c255((t[1] + k) * 255), b: c255((t[2] + k) * 255), a: alpha(p[3]) };
    }
    return null;
  }
  const toHex = c => c ? '#' + [c.r, c.g, c.b].map(v => c255(v).toString(16).padStart(2, '0')).join('') : '';
  const over = (top, under) => top.a >= 1 ? top : { r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const WHITE = { r: 255, g: 255, b: 255, a: 1 }, BLACK = { r: 0, g: 0, b: 0, a: 1 };
  /* contrast(fg, bg) → {ratio, aa, aaLarge, aaa, fg, bg} by WCAG 2.x, or null when either color cannot be read.
     A see through background is laid over white first, a see through text color over the background. */
  function contrast(fg, bg) {
    let f = parseColor(fg), b = parseColor(bg); if (!f || !b) return null;
    if (b.a < 1) b = over(b, WHITE); if (f.a < 1) f = over(f, b);
    const a = lum(f), c = lum(b), ratio = Math.round(((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05)) * 100) / 100;
    return { ratio, aa: ratio >= 4.5, aaLarge: ratio >= 3, aaa: ratio >= 7, fg: toHex(f), bg: toHex(b) };
  }
  /* the first color in a CSS value (a background shorthand, a border), or null; image marks a url() or a gradient */
  function colorIn(value) {
    const raw = String(value || ''), v = raw.replace(/url\([^)]*\)/gi, ' ');
    const image = /url\(|gradient\(/i.test(raw);
    const m = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/i.exec(image ? v.replace(/[a-z-]*gradient\((?:[^()]|\([^()]*\))*\)/gi, ' ') : v);
    let color = m ? parseColor(m[0]) : null;
    if (!color) for (const w of v.toLowerCase().split(/[\s,\/]+/)) { if (has(NAMED, w) || w === 'transparent') { color = parseColor(w); break; } }
    return { color, image };
  }

  /* ---------- a small CSS reader ----------
     Enough to follow the colors a page sets on itself: rules and their declarations, one level of @media, custom
     properties on :root, html and body, var() with fallbacks, and selectors made of tags, classes and ids joined by
     descendant or child steps. Anything else (pseudo classes, attribute selectors, siblings) is read for the design
     tokens and left out of the cascade, which is why a result can say "could not be determined". */
  function decls(body) {
    const out = {}; let depth = 0, q = '', start = 0; body = String(body || '');
    const push = seg => { const k = seg.indexOf(':'); if (k > 0) { const p = seg.slice(0, k).trim().toLowerCase(); if (p) out[p] = seg.slice(k + 1).trim(); } };
    for (let i = 0; i < body.length; i++) { const ch = body[i]; if (q) { if (ch === q && body[i - 1] !== '\\') q = ''; continue; } if (ch === '"' || ch === "'") q = ch; else if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1); else if (ch === ';' && !depth) { push(body.slice(start, i)); start = i + 1; } }
    push(body.slice(start)); return out;
  }
  function cssRules(css) {
    const s = String(css || '').replace(/\/\*[\s\S]*?\*\//g, ''); const rules = [], fontFaces = [], imports = [];
    (function read(from, to, media) {
      let i = from;
      while (i < to) {
        const b = s.indexOf('{', i);
        const pre = s.slice(i, b === -1 || b >= to ? to : b); (pre.match(/@import\s+[^;]+;/gi) || []).forEach(x => imports.push(x.trim()));
        if (b === -1 || b >= to) break;
        const head = pre.slice(pre.lastIndexOf(';') + 1).trim();
        let depth = 1, j = b + 1; while (j < to && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
        const inner = depth ? j : j - 1;
        if (/^@(media|supports|layer|container)\b/i.test(head)) read(b + 1, inner, /^@media/i.test(head) ? squash(head.replace(/^@media/i, '')) || 'all' : media);
        else if (/^@font-face/i.test(head)) fontFaces.push(decls(s.slice(b + 1, inner)));
        else if (head && head[0] !== '@') rules.push({ selectors: head.split(',').map(squash).filter(Boolean), decls: decls(s.slice(b + 1, inner)), media: media || '' });
        i = j;
      }
    })(0, s.length, '');
    return { rules, fontFaces, imports };
  }
  function parseSelector(sel) {
    if (/[\[\]:+~*]/.test(sel)) return null;
    const out = [];
    for (const p of sel.replace(/\s*>\s*/g, ' ').trim().split(/\s+/)) {
      const m = /^([a-z][a-z0-9-]*)?((?:[.#][\w-]+)*)$/i.exec(p); if (!m || !p) return null;
      const cls = [], ids = []; (m[2].match(/[.#][\w-]+/g) || []).forEach(x => (x[0] === '.' ? cls : ids).push(x.slice(1)));
      out.push({ tag: (m[1] || '').toLowerCase(), cls, id: ids[0] || '' });
    }
    return out;
  }
  function resolveVars(v, vars, depth) {
    depth = depth || 0; if (depth > 6 || v.indexOf('var(') === -1) return v;
    return resolveVars(v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g, (m, name, fb) => has(vars, name) ? vars[name] : (fb != null ? fb.trim() : '')), vars, depth + 1);
  }
  const cssVal = (v, vars) => resolveVars(String(v == null ? '' : v).replace(/\s*!important\s*$/i, ''), vars);
  /* every style block of a page (and any css handed in beside it) as one index the cascade can be read from */
  function styleIndex(cssList) {
    const idx = { rules: [], fontFaces: [], imports: [], vars: {}, byKey: new Map() }; let order = 0;
    (cssList || []).forEach(css => { const r = cssRules(css); idx.rules.push(...r.rules); idx.fontFaces.push(...r.fontFaces); idx.imports.push(...r.imports); });
    idx.rules.forEach(r => { if (!r.media && r.selectors.some(x => /^(:root|html|body)$/i.test(x))) for (const k in r.decls) if (k.startsWith('--')) idx.vars[k] = r.decls[k]; });
    idx.rules.forEach(r => {
      order++; if (r.media) return;
      r.selectors.forEach(text => {
        const c = parseSelector(text); if (!c) return; const last = c[c.length - 1];
        const spec = c.reduce((t, x) => t + (x.id ? 10000 : 0) + x.cls.length * 100 + (x.tag ? 1 : 0), 0);
        const key = last.cls.length ? '.' + last.cls[0] : last.id ? '#' + last.id : last.tag;
        if (!idx.byKey.has(key)) idx.byKey.set(key, []); idx.byKey.get(key).push({ c, last, spec, order, decls: r.decls });
      });
    });
    return idx;
  }
  const STYLE_PROPS = ['color', 'background', 'background-color', 'display', 'visibility', 'font-size', 'position'];
  const fits = (c, el) => (!c.tag || c.tag === el.name) && (!c.id || c.id === el.id) && c.cls.every(x => el.cls.has(x));
  /* what the page's own rules and the element's style attribute declare for one element; stack holds its open ancestors */
  function declared(el, stack, idx) {
    const hits = [], seen = new Set();
    const take = key => (idx.byKey.get(key) || []).forEach(r => { if (seen.has(r) || !fits(r.last, el)) return; seen.add(r); let k = r.c.length - 2; for (let a = stack.length - 1; a >= 0 && k >= 0; a--) if (fits(r.c[k], stack[a])) k--; if (k < 0) hits.push(r); });
    el.cls.forEach(x => take('.' + x)); if (el.id) take('#' + el.id); take(el.name);
    const out = {};
    hits.sort((a, b) => a.spec - b.spec || a.order - b.order).forEach(r => { for (const p of STYLE_PROPS) if (r.decls[p] != null) out[p] = cssVal(r.decls[p], idx.vars); });
    for (const p of STYLE_PROPS) if (el.style[p] != null) out[p] = cssVal(el.style[p], idx.vars);
    return out;
  }

  /* ---------- parse: one pass over the tokens ----------
     parse(html, {url, domain, css, fragment, canvas, ink}) → the facts a review needs.
     url or domain says which links are internal; css is styling kept beside the markup (a portable page's scoped css);
     fragment forces or forbids reading the markup as a piece of a page (by default: no html, head or body tag).
     canvas and ink are the page background and the body text color when the caller knows them (a blank canvas
     template is white); without them a fragment's surroundings are unknown and contrast against them is not judged.
     A whole document with no stylesheet on another URL is read against the browser's own white and black.
     "fold" on links, images and buttons means "inside the first section", the nearest thing markup has to "above the
     fold": everything up to the end of the first section element, or the first 700 characters of text when the page
     has no sections. */
  const NOTEXT = new Set([SCR, 'style', 'noscript', 'template', 'head', 'title', 'svg', 'select', 'textarea', 'iframe', 'object']);
  const INLINE = new Set(['a', 'span', 'strong', 'b', 'em', 'i', 'u', 'small', 'sup', 'sub', 'code', 'abbr', 'mark', 'label', 'font', 'cite', 'q', 's', 'time', 'var', 'kbd', 'bdi', 'bdo', 'data', 'dfn', 'ins', 'del']);
  const ROLE = { main: 'main', banner: 'header', navigation: 'nav', contentinfo: 'footer' };
  const CAPTURE = new Set(['a', 'button', 'label', 'summary', 'title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'option']);
  const CONSENT = /consent|agree|terms|opt.?in|tcpa|privacy|acepto/i;
  /* a block of required small print (a license notice, a disclaimer): the numbers in it belong to a regulator, not the business */
  const FINE = /(^|[\s_-])(notice|legal|disclaimer|fine-?print)([\s_-]|$)/i;
  const px = (v, parent) => { const m = /^([\d.]+)(px|rem|em|pt)?$/.exec(String(v || '').trim()); if (!m) return null; const n = parseFloat(m[1]); return m[2] === 'rem' ? n * 16 : m[2] === 'em' ? n * (parent || 16) : m[2] === 'pt' ? n * 4 / 3 : n; };
  function parse(html, o) {
    o = o || {}; const src = String(html == null ? '' : html), T = tokens(src);
    const isDoc = T.some(t => t.t === 'open' && (t.name === 'html' || t.name === 'head' || t.name === 'body'));
    const fragment = o.fragment != null ? !!o.fragment : !isDoc;
    /* the page's own css first, so every element can be resolved as it opens */
    const cssList = []; let sheets = 0;
    T.forEach((t, i) => { if (t.t === 'open' && t.name === 'style' && T[i + 1] && T[i + 1].raw) cssList.push(T[i + 1].text); if (t.t === 'open' && t.name === 'link' && /\bstylesheet\b/i.test(t.attrs.rel || '')) sheets++; });
    if (o.css) cssList.push(String(o.css));
    const idx = styleIndex(cssList); const canvas = !fragment && sheets === 0, paper = o.canvas ? parseColor(o.canvas) : null, ink = o.ink ? parseColor(o.ink) : null;
    const P = { lang: '', title: '', metas: {}, canonical: '', robots: '', links: [], headings: [], images: [], anchors: [], forms: [], buttons: [], scripts: [], styles: [], iframes: [], media: [], details: [], jsonld: [], jsonldErrors: [], landmarks: { main: 0, header: 0, nav: 0, footer: 0 }, sections: 0, text: '', words: 0, viewport: '', charset: '', ids: { count: 0, dupes: [] }, tabindexPositive: 0, inlineStyleCount: 0, domNodes: 0, bytes: D.bytesOf(src), fragment, contrast: { pairs: [], checked: 0, undetermined: 0 } };
    const ids = {}, labelFor = {}, loose = [], text = [], outside = [], pairs = new Map();
    const root = { name: '#root', cls: new Set(), id: '', style: {}, hidden: false, color: ink || (canvas ? BLACK : null), bg: paper || (canvas ? WHITE : null), explicit: false, font: 16 };
    const stack = [root]; let textLen = 0, fold = true, foldDepth = -1, sawSection = false, lastScript = null, lastStyle = null;
    const top = () => stack[stack.length - 1];
    const up = name => { for (let i = stack.length - 1; i > 0; i--) if (stack[i].name === name) return stack[i]; return null; };
    const sayTo = s => { for (let i = stack.length - 1; i > 0; i--) if (stack[i].cap) stack[i].cap.push(s); };
    function finish(e) {
      const txt = e.cap ? squash(e.cap.join('')) : '', a = e.attrs || {};
      if (/^h[1-6]$/.test(e.name)) P.headings.push({ level: +e.name[1], text: txt, id: e.id });
      else if (e.name === 'title' && !P.title && !up('svg')) P.title = txt;
      else if (e.name === 'a') { const href = a.href == null ? null : String(a.href).trim(); P.anchors.push({ href, text: txt, rel: a.rel || '', target: a.target || '', ariaLabel: a['aria-label'] || '', title: a.title || '', alts: e.alts || [], cls: a.class || '', btn: /btn|button|cta/i.test(a.class || '') || a.role === 'button' || !!e.ownBg, fold: e.fold, kind: '' }); }
      else if (e.name === 'button') { const b = { text: txt, type: (a.type || '').toLowerCase(), ariaLabel: a['aria-label'] || '', title: a.title || '', alts: e.alts || [], fold: e.fold, inForm: !!e.form }; P.buttons.push(b); if (e.form && b.type !== 'button' && b.type !== 'reset' && !e.form.submitText) e.form.submitText = txt || b.ariaLabel; }
      else if (e.name === 'label') { (e.fields || []).forEach(f => { if (!f.label) f.label = txt; }); if (a.for) labelFor[a.for] = txt; }
      else if (e.name === 'summary') { const d = up('details'); if (d && d.det) { d.det.summary = txt; d.det.hasSummary = true; } }
      else if (e.name === 'section' && stack.length === foldDepth) fold = false;
    }
    for (let ti = 0; ti < T.length; ti++) {
      const t = T[ti];
      if (t.t === 'text') {
        const p = top();
        if (t.raw) { if (p.name === SCR && lastScript) { if (/ld\+json/i.test(lastScript.type)) { try { P.jsonld.push(JSON.parse(t.text)); } catch (e) { P.jsonldErrors.push(cut(String(e.message), 100)); } } else lastScript.inlineBytes = D.bytesOf(t.text); } else if (p.name === 'style' && lastStyle) lastStyle.inlineBytes = D.bytesOf(t.text); continue; }
        sayTo(t.text);
        if (p.hidden || stack.some(e => NOTEXT.has(e.name))) continue;
        text.push(t.text); if (!stack.some(e => e.tel || e.fine)) outside.push(t.text);
        const vis = squash(t.text); if (!vis) continue;
        textLen += vis.length; if (!sawSection && textLen > 700) fold = false;
        if (p.explicit) {
          if (p.color && p.bg && !p.bg.image) { const large = p.font >= 24 || stack.some(e => e.name === 'h1' || e.name === 'h2'); const c = contrast(p.color, p.bg), key = c.fg + c.bg + large; if (!pairs.has(key)) pairs.set(key, { fg: c.fg, bg: c.bg, ratio: c.ratio, large, pass: c.ratio >= (large ? 3 : 4.5), sample: cut(vis, 60), tag: p.name, runs: 0 }); pairs.get(key).runs++; P.contrast.checked++; }
          else P.contrast.undetermined++;
        }
        continue;
      }
      if (t.t === 'close') { let k = stack.length - 1; while (k > 0 && stack[k].name !== t.name) k--; if (k > 0) while (stack.length > k) finish(stack.pop()); if (!INLINE.has(t.name)) { text.push(' '); outside.push(' '); sayTo(' '); } continue; }
      if (t.t !== 'open') continue;
      const a = t.attrs, name = t.name, par = top(); P.domNodes++;
      if (!INLINE.has(name)) { text.push(' '); outside.push(' '); sayTo(' '); }
      if (a.id) ids[a.id] = (ids[a.id] || 0) + 1;
      if (a.style) P.inlineStyleCount++;
      if (+a.tabindex > 0) P.tabindexPositive++;
      const e = { name, attrs: a, cls: new Set(String(a.class || '').split(/\s+/).filter(Boolean)), id: a.id || '', style: a.style ? decls(a.style) : {} };
      const own = declared(e, stack, idx);
      e.hidden = par.hidden || a.hidden != null || own.display === 'none' || own.visibility === 'hidden';
      e.font = px(own['font-size'], par.font) || par.font;
      const fg = own.color ? parseColor(own.color) : null, bgv = own['background-color'] || own.background, bgc = bgv ? colorIn(bgv) : null;
      e.color = fg || par.color; e.bg = par.bg; e.explicit = par.explicit || !!fg;
      if (bgc && bgc.image && !bgc.color) { e.bg = { image: true }; e.explicit = true; e.ownBg = true; }
      else if (bgc && bgc.color && bgc.color.a > 0) { e.bg = bgc.color.a < 1 ? (par.bg && !par.bg.image ? over(bgc.color, par.bg) : null) : bgc.color; e.explicit = true; e.ownBg = true; }
      e.form = name === 'form' ? null : par.form; e.tel = par.tel; e.fold = fold; e.fine = par.fine || FINE.test((a.id || '') + ' ' + (a.class || ''));
      const role = ROLE[(a.role || '').toLowerCase()]; const lm = has(P.landmarks, name) ? name : role; if (lm) P.landmarks[lm]++;
      if (name === 'html') P.lang = a.lang || '';
      else if (name === 'meta') { if (a.charset) P.charset = a.charset; const k = (a.name || a.property || a['http-equiv'] || '').toLowerCase(); if (k && !has(P.metas, k)) P.metas[k] = a.content || ''; if (k === 'content-type' && /charset=([\w-]+)/i.test(a.content || '')) P.charset = P.charset || RegExp.$1; }
      else if (name === 'link') { const rel = (a.rel || '').toLowerCase(); P.links.push({ rel, href: a.href || '', as: a.as || '', type: a.type || '', media: a.media || '', hreflang: a.hreflang || '' }); if (/\bcanonical\b/.test(rel) && !P.canonical) P.canonical = a.href || ''; if (/\bstylesheet\b/.test(rel)) P.styles.push({ href: a.href || '', media: a.media || '', inlineBytes: 0, inHead: !!up('head') }); }
      else if (name === 'section') { P.sections++; if (!sawSection) { sawSection = true; foldDepth = stack.length; } }
      else if (name === 'img') { const im = { src: a.src || a['data-src'] || '', alt: a.alt || '', hasAlt: a.alt != null, width: a.width || '', height: a.height || '', loading: (a.loading || '').toLowerCase(), fetchpriority: (a.fetchpriority || '').toLowerCase(), decoding: a.decoding || '', inPicture: !!up('picture'), srcset: !!a.srcset, decorative: a.role === 'presentation' || a['aria-hidden'] === 'true', fold, hidden: e.hidden }; P.images.push(im); if (im.alt) for (let i = stack.length - 1; i > 0; i--) if (stack[i].alts) stack[i].alts.push(im.alt); }
      else if (name === 'form') { e.form = { action: a.action || '', method: (a.method || 'get').toLowerCase(), fields: [], hasConsent: false, consentPrechecked: false, submitText: '', id: a.id || '', fold }; P.forms.push(e.form); }
      else if (name === 'input' || name === 'select' || name === 'textarea') {
        const type = name === 'input' ? (a.type || 'text').toLowerCase() : name;
        if (type === 'submit' || type === 'image' || type === 'button' || type === 'reset') { if (type !== 'button' && type !== 'reset') { P.buttons.push({ text: a.value || a.alt || '', type, ariaLabel: a['aria-label'] || '', title: a.title || '', alts: [], fold, inForm: !!e.form }); if (e.form && !e.form.submitText) e.form.submitText = a.value || a.alt || 'Submit'; } }
        else { const f = { tag: name, type, name: a.name || '', id: a.id || '', label: '', required: a.required != null || a['aria-required'] === 'true', autocomplete: a.autocomplete || '', placeholder: a.placeholder || '', ariaLabel: a['aria-label'] || (a['aria-labelledby'] ? '#' + a['aria-labelledby'] : ''), title: a.title || '', checked: a.checked != null, offscreen: e.hidden || type === 'hidden' || a.tabindex === '-1' || /left:\s*-\d{3,}px/.test(a.style || '') }; (e.form ? e.form.fields : loose).push(f); const lab = up('label'); if (lab) lab.fields.push(f); }
      }
      else if (name === SCR) { lastScript = { src: a.src || '', async: a.async != null, defer: a.defer != null, type: (a.type || '').toLowerCase(), module: (a.type || '').toLowerCase() === 'module', inlineBytes: 0, inHead: !!up('head') }; if (!/ld\+json/i.test(lastScript.type) || a.src) P.scripts.push(lastScript); }
      else if (name === 'style') { lastStyle = { href: '', media: a.media || '', inlineBytes: 0, inHead: !!up('head') }; P.styles.push(lastStyle); }
      else if (name === 'iframe') P.iframes.push({ src: a.src || '', title: a.title || '', loading: (a.loading || '').toLowerCase(), fold });
      else if (name === 'video' || name === 'audio') P.media.push({ tag: name, autoplay: a.autoplay != null, muted: a.muted != null, controls: a.controls != null, src: a.src || '' });
      else if (name === 'details') { e.det = { summary: '', hasSummary: false, cls: a.class || '' }; P.details.push(e.det); }
      else if (name === 'a') { e.tel = e.tel || /^tel:/i.test(String(a.href || '').trim()); }
      if (CAPTURE.has(name)) { e.cap = []; if (name === 'a' || name === 'button') e.alts = []; if (name === 'label') e.fields = []; }
      if (!t.self) stack.push(e); else finish(e);
    }
    while (stack.length > 1) finish(stack.pop());
    /* what could only be settled once the whole page was read */
    const fields = P.forms.reduce((all, f) => all.concat(f.fields), loose.slice());
    fields.forEach(f => { if (!f.label && f.id && labelFor[f.id]) f.label = labelFor[f.id]; });
    P.forms.forEach(f => { const c = f.fields.filter(x => x.type === 'checkbox' && CONSENT.test(x.name + ' ' + x.id + ' ' + x.label)); f.hasConsent = c.length > 0; f.consentPrechecked = c.some(x => x.checked); });
    P.looseFields = loose;
    const base = D.bareDomain(o.url || o.domain || P.canonical || P.metas['og:url'] || '');
    P.anchors.forEach(x => { const h = x.href; x.kind = h == null || h === '' || h === '#' || /^javascript:/i.test(h) ? 'empty' : /^tel:/i.test(h) ? 'tel' : /^mailto:/i.test(h) ? 'mailto' : /^(sms|whatsapp|skype|facetime):/i.test(h) ? 'other' : h[0] === '#' ? 'anchor' : /^(https?:)?\/\//i.test(h) ? (base && D.bareDomain(h.replace(/^\/\//, 'https://')) === base ? 'internal' : 'external') : 'internal'; });
    P.canonical = P.canonical.trim(); P.robots = (P.metas.robots || '').toLowerCase(); P.viewport = P.metas.viewport || '';
    P.text = squash(text.join('')); P.words = (P.text.match(/\S+/g) || []).length;
    P.ids = { count: Object.keys(ids).length, dupes: Object.keys(ids).filter(k => ids[k] > 1) };
    P.contrast.pairs = [...pairs.values()];
    Object.defineProperty(P, '_x', { enumerable: false, value: { idx, idset: ids, outside: squash(outside.join('')), sheets, canvas, isDoc, tokens: T, src } });
    return P;
  }
  const textOf = html => parse(html).text;
  const words = html => parse(html).words;

  /* ---------- outline: a long page in a few dozen lines ----------
     Landmarks and sections in order, each heading with the words under it, and where the images, forms, phone links and
     calls to action sit. Written for a model's context: a 3,000 word page comes back in well under a hundred lines. */
  const BLOCKS = new Set(['header', 'nav', 'main', 'section', 'article', 'aside', 'footer', 'form']);
  function outline(html, o) {
    o = o || {}; const P = parse(html, o), T = P._x.tokens, lines = [], maxLines = o.maxLines || 140;
    if (P.title) lines.push(`title: ${cut(P.title, 90)} (${P.title.length} characters)`);
    if (P.metas.description) lines.push(`meta description: ${cut(P.metas.description, 150)} (${P.metas.description.length} characters)`);
    if (P.fragment) lines.push('a page fragment: no html, head or body element in this markup');
    const stack = []; let depth = 0, cur = null, formN = 0, mute = 0;
    const ind = () => '  '.repeat(Math.min(depth, 6));
    const open = () => cur || (cur = { head: '', words: 0, bits: [], links: 0, more: 0 });
    const bit = s => { const c = open(); if (c.bits.length < 7) c.bits.push(s); else c.more++; };
    const flush = () => { if (cur && (cur.head || cur.words || cur.links || cur.bits.length)) lines.push(ind() + [cur.head || (cur.words ? 'text' : ''), cur.words ? `${cur.words} words` : '', cur.links ? plural(cur.links, 'link') : ''].concat(cur.bits, cur.more ? [`and ${cur.more} more`] : []).filter(Boolean).join(' · ')); cur = null; };
    for (const t of T) {
      if (t.t === 'text') { if (mute || t.raw) continue; const top = stack[stack.length - 1]; for (const e of stack) if (e.cap) e.cap.push(t.text); if (!top || !/^h[1-6]$/.test(top.name)) open().words += (squash(t.text).match(/\S+/g) || []).length; continue; }
      if (t.t === 'close') {
        let k = stack.length - 1; while (k >= 0 && stack[k].name !== t.name) k--; if (k < 0) continue;
        while (stack.length > k) {
          const e = stack.pop(), txt = e.cap ? squash(e.cap.join('')) : '';
          if (NOTEXT.has(e.name)) mute--;
          if (/^h[1-6]$/.test(e.name)) { flush(); cur = { head: `${e.name} "${cut(txt, 90)}"`, words: 0, bits: [], links: 0, more: 0 }; const sm = stack.find(x => x.name === 'summary'); if (sm) sm.headed = true; }
          else if (e.name === 'summary') { if (!e.headed && txt) { open().head = `question "${cut(txt, 90)}"`; cur.words = 0; } }
          else if (e.name === 'a') { const h = String(e.attrs.href || ''), nav = stack.find(x => x.name === 'nav'); if (/^tel:/i.test(h)) bit(`phone link "${cut(txt, 40)}"`); else if (/btn|button|cta/i.test(e.attrs.class || '')) bit(`button "${cut(txt, 40)}" to ${cut(h, 60) || '(no href)'}`); else if (nav) nav.nav.push(cut(txt, 24) || '(no text)'); else open().links++; }
          else if (e.name === 'button') bit(`button "${cut(txt || e.attrs['aria-label'] || '', 40)}"`);
          else if (e.name === 'form') { const f = P.forms[e.formN]; flush(); if (f) lines.push(ind() + `fields: ${f.fields.filter(x => !x.offscreen).map(x => (x.label || x.ariaLabel || x.name || x.type) + (x.required ? '*' : '')).map(x => cut(x, 30)).join(', ') || 'none'}${f.hasConsent ? ' · consent checkbox' + (f.consentPrechecked ? ' (prechecked)' : '') : ''}${f.submitText ? ` · submit "${cut(f.submitText, 40)}"` : ''}`); }
          if (e.name === 'nav' && e.nav.length) { cur = null; lines.push(ind() + 'links: ' + e.nav.slice(0, 12).join(', ') + (e.nav.length > 12 ? ` and ${e.nav.length - 12} more` : '')); }
          if (BLOCKS.has(e.name)) { flush(); depth = Math.max(0, depth - 1); }
        }
        continue;
      }
      if (t.t !== 'open') continue;
      const a = t.attrs, name = t.name;
      if (NOTEXT.has(name)) { if (name === 'iframe' && !mute) bit(`iframe ${cut(where(a.src) || '(no src)', 40)}`); if (!t.self) { mute++; stack.push({ name, attrs: a }); } continue; }
      if (mute) { if (!t.self) stack.push({ name, attrs: a }); continue; }
      if (BLOCKS.has(name)) { flush(); const e = { name, attrs: a, nav: [] }; lines.push(ind() + `[${name}${a.id ? '#' + a.id : ''}${a.class ? '.' + a.class.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : ''}${name === 'form' ? ' action ' + (a.action || '(none)') : ''}]`); if (name === 'form') e.formN = formN++; depth++; stack.push(e); continue; }
      if (name === 'img') bit(a.alt ? `image "${cut(a.alt, 50)}"` : a.alt != null ? 'image (decorative, empty alt)' : `image without alt (${cut((a.src || '').split('/').pop(), 30)})`);
      else if (name === 'video' || name === 'audio') bit(name);
      else if (name === 'summary') flush();
      if (!t.self) stack.push({ name, attrs: a, cap: CAPTURE.has(name) ? [] : null });
    }
    flush();
    const kinds = k => P.anchors.filter(x => x.kind === k).length, types = jsonldTypes(P.jsonld);
    lines.push(`totals: ${P.words} words · ${P.headings.length} headings · ${P.images.length} images (${P.images.filter(i => !i.hasAlt).length} without alt) · links: ${kinds('internal')} internal, ${kinds('external')} external, ${kinds('tel')} phone · ${P.forms.length} forms${types.length ? ' · JSON-LD: ' + types.join(', ') : ''}`);
    if (lines.length > maxLines) { const keep = Math.floor(maxLines / 2); lines.splice(keep, lines.length - maxLines + 1, `… ${lines.length - maxLines + 1} lines left out of the middle …`); }
    return lines.join('\n');
  }
  /* every node of every JSON-LD block, @graph opened up, and the list of their types */
  function jsonldNodes(list) { const out = []; const walk = n => { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; if (Array.isArray(n['@graph'])) n['@graph'].forEach(walk); if (n['@type']) out.push(n); }; (list || []).forEach(walk); return out; }
  const typesOf = n => [].concat(n['@type'] || []).map(String);
  const jsonldTypes = list => uniq(jsonldNodes(list).reduce((a, n) => a.concat(typesOf(n)), []));

  /* ---------- sanitize: a page made safe to show in a preview frame ----------
     Scripts go (JSON-LD stays: it is data), inline event handlers go, javascript: links are neutralized, a meta refresh
     and an iframe srcdoc are dropped. Everything untouched is copied from the source byte for byte.
     sanitize(html, {scripts: true}) keeps scripts, {handlers: true} keeps handlers. */
  function sanitize(html, o) {
    o = Object.assign({ scripts: false, handlers: false }, o || {}); const s = String(html == null ? '' : html); let out = '', skip = '';
    for (const t of tokens(s)) {
      if (skip) { if (t.t === 'close' && t.name === skip) skip = ''; continue; }
      if (t.t === 'open') {
        const a = t.attrs;
        if (!o.scripts && t.name === SCR && !/ld\+json/i.test(a.type || '')) { skip = SCR; continue; }
        if (!o.handlers) {
          if (t.name === 'meta' && /refresh/i.test(a['http-equiv'] || '')) continue;
          let changed = false; const b = {};
          for (const k of Object.keys(a)) { if (/^on/.test(k) || k === 'srcdoc') { changed = true; continue; } if (/^(href|src|action|formaction|xlink:href|data|poster)$/.test(k) && /^\s*(javascript|vbscript):/i.test(a[k])) { changed = true; b[k] = '#'; continue; } b[k] = a[k]; }
          if (changed) { out += openTag(t.name, b, s[t.end - 2] === '/'); continue; }
        }
      }
      out += s.slice(t.pos, t.end);
    }
    return out;
  }

  /* ---------- design: the look of a page as tokens ----------
     Colors with how often and where they are used, font families, sizes, corner radii, content widths and what the
     buttons look like, from the style blocks and style attributes (and css passed beside the markup). What sits in a
     stylesheet on another host is not read, and the notes say so. */
  const GENERIC = /^(serif|sans-serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|cursive|fantasy|inherit|initial|unset|revert|-apple-system|blinkmacsystemfont|emoji|math)$/i;
  function design(html, o) {
    o = o || {}; const P = parse(html, o), X = P._x, idx = X.idx;
    const colors = new Map(), fonts = new Map(), sizes = new Map(), radii = new Map(), widths = new Map(), buttons = [], vars = {};
    const bump = (m, k) => { k = squash(k); if (k) m.set(k, (m.get(k) || 0) + 1); };
    const addColor = (c, role) => { if (!c || c.a === 0) return; const hex = toHex(c), r = colors.get(hex) || { hex, count: 0, roles: {} }; r.count++; r.roles[role] = (r.roles[role] || 0) + 1; colors.set(hex, r); };
    const eat = (d, sel) => {
      const v = k => d[k] == null ? '' : cssVal(d[k], idx.vars);
      for (const k of Object.keys(d)) {
        if (k.startsWith('--')) { const c = parseColor(cssVal(d[k], idx.vars)); if (c) { vars[k] = toHex(c); addColor(c, 'token'); } continue; }
        if (k === 'color') addColor(parseColor(v(k)), 'text');
        else if (k === 'background' || k === 'background-color') addColor(colorIn(v(k)).color, 'background');
        else if (/^(border|outline)(-(top|right|bottom|left))?(-color)?$/.test(k) || k === 'fill' || k === 'stroke') addColor(colorIn(v(k)).color, 'border');
        else if (k === 'font-family') v(k).split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(x => x && !GENERIC.test(x)).slice(0, 2).forEach(x => bump(fonts, x));
        else if (k === 'font-size') bump(sizes, v(k)); else if (k === 'border-radius') bump(radii, v(k)); else if (k === 'max-width') bump(widths, v(k));
      }
      const bg = colorIn(v('background-color') || v('background')).color;
      if (bg && bg.a > 0 && /btn|button|cta/i.test(sel)) { const fg = parseColor(v('color')), c = fg ? contrast(fg, bg) : null; buttons.push({ selector: cut(sel, 60), bg: toHex(bg), color: fg ? toHex(fg) : '', radius: v('border-radius'), contrast: c ? c.ratio : null }); }
    };
    idx.rules.forEach(r => eat(r.decls, r.selectors.join(', ')));
    X.tokens.forEach(t => { if (t.t === 'open' && t.attrs.style) eat(decls(t.attrs.style), t.name + (t.attrs.class ? '.' + t.attrs.class.split(/\s+/).join('.') : '')); });
    P.links.forEach(l => { const m = /fonts\.googleapis\.com\/css2?\?(.*)$/.exec(l.href); if (m) (m[1].match(/family=([^&:]+)/g) || []).forEach(f => bump(fonts, decodeURIComponent(f.slice(7)).replace(/\+/g, ' '))); });
    const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, count]) => ({ value, count }));
    const btnBg = buttons.length ? buttons[0].bg : '';
    const list = [...colors.values()].sort((a, b) => b.count - a.count).slice(0, 16).map(c => { const role = Object.keys(c.roles).sort((a, b) => c.roles[b] - c.roles[a])[0]; return { hex: c.hex, count: c.count, role: c.hex === btnBg ? 'button background' : role === 'token' ? 'brand token' : role }; });
    const notes = [];
    if (X.sheets) notes.push(`${X.sheets} stylesheet${X.sheets === 1 ? '' : 's'} on other URLs ${X.sheets === 1 ? 'was' : 'were'} not read; the colors and fonts set there are not in this list.`);
    if (idx.imports.length) notes.push(`${idx.imports.length} @import rule${idx.imports.length === 1 ? '' : 's'} not followed.`);
    if (!list.length && !fonts.size) notes.push('No colors or fonts are set in this markup itself.');
    return { colors: list, fonts: top(fonts, 8).map(x => ({ family: x.value, count: x.count })), fontSizes: top(sizes, 10), radii: top(radii, 6), maxWidths: top(widths, 6), buttons: buttons.slice(0, 8), vars, notes };
  }

  /* ---------- audit ----------
     audit(html, {url, kind, brand:{name, phone, lic, domain}, headers, fragment, css, schema, skipAreas}) →
       {score, grade, counts:{block, warn, note}, areas:{seo, a11y, perf, cro, content, schema, security}, findings, facts,
        kind, fragment, skipped}
     A finding is {id, area, sev, msg, evidence, fix}; one marked info: true reports something worth knowing that is
     not a fault and costs no points. Scoring: a block costs 12 points, a warning 4, a note 1, and a page with any block
     cannot score above 69. css is styling kept beside the markup and schema a JSON-LD object kept beside it (the
     dashboard's portable pages carry both that way); headers are the response headers, lower cased. */
  const AREAS = ['seo', 'a11y', 'perf', 'cro', 'content', 'schema', 'security'];
  const THIN = { landing: 150, service: 400, city: 400, home: 300, article: 600, other: 200 };
  const VAGUE = /^(click here|here|read more|learn more|more|this|link|details|more info|info|go|continue)$/i;
  const PHONE = /(?:\+?1[\s.\-]?)?\(?\b\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/g;
  const PEN = { block: 12, warn: 4, note: 1 };
  const BIZ = /^(HVACBusiness|LocalBusiness|Organization|HomeAndConstructionBusiness|Plumber|Electrician|RoofingContractor|GeneralContractor|ProfessionalService)$/;
  const loose = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const ABS = /^(https?:)?\/\//i;
  /* the host of an absolute URL, or the path as written when it is relative */
  const where = u => ABS.test(u || '') ? D.hostOf(String(u).replace(/^\/\//, 'https://')) : String(u || '');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  function audit(html, o) {
    o = o || {}; const kind = has(THIN, o.kind) ? o.kind : 'other', brand = o.brand || {};
    const P = parse(html, Object.assign({}, o, { domain: o.domain || brand.domain })), X = P._x, frag = P.fragment, F = [], skipped = [];
    const add = (id, sev, msg, evidence, fix, info) => { const f = { id, area: id.split('.')[0], sev, msg, evidence: evidence == null ? '' : cut(evidence, 220), fix: fix || '' }; if (info) f.info = true; F.push(f); };
    const sales = kind === 'landing' || kind === 'service' || kind === 'city' || kind === 'home', soft = s => kind === 'other' ? 'note' : s;
    const hd = o.headers || null, url = String(o.url || '');

    /* the document: head tags a CMS sets for a fragment, so a fragment is not marked down for lacking them */
    const title = P.title, desc = P.metas.description || '';
    if (frag) { skipped.push('title', 'meta description', 'canonical', 'robots', 'lang', 'viewport', 'Open Graph', 'main landmark'); add('seo.fragment_scope', 'note', 'Checked as a piece of a page: the title, meta description, canonical, language, viewport and Open Graph tags are set by the site around it and were not checked.', '', '', true); }
    else {
      if (!title) add('seo.title_missing', 'block', 'The page has no title.', '', 'Add a title of 30 to 60 characters that leads with the service and the city.');
      else if (title.length < 30 || title.length > 60) add('seo.title_length', 'warn', `The title is ${title.length} characters; search results show about 60.`, title, title.length > 60 ? 'Cut it to 60 characters or fewer and keep the service and the city first.' : 'Use 30 to 60 characters: the service, the city, then the brand.');
      if (!desc) add('seo.meta_missing', 'warn', 'No meta description.', '', 'Write 120 to 158 characters that say what the page offers and what happens next.');
      else if (desc.length < 70 || desc.length > 160) add('seo.meta_length', 'warn', `The meta description is ${desc.length} characters.`, desc, 'Aim for 120 to 158 characters.');
      if (!P.viewport) add('seo.viewport_missing', 'block', 'No viewport meta tag, so phones lay the page out at desktop width.', '', 'Add <meta name="viewport" content="width=device-width,initial-scale=1">.');
      else { const ms = /maximum-scale\s*=\s*([\d.]+)/i.exec(P.viewport); if (/user-scalable\s*=\s*(no|0)/i.test(P.viewport) || (ms && parseFloat(ms[1]) < 2)) add('a11y.zoom_blocked', 'block', 'The viewport tag stops people from zooming in.', P.viewport, 'Remove user-scalable=no and any maximum-scale below 5.'); }
      if (!P.lang) add('a11y.lang_missing', 'warn', 'The html element has no lang attribute.', '', 'Add lang="en" (or "es" on Spanish pages) so screen readers and search engines read the page in the right language.');
      if (!P.charset) add('seo.charset_missing', 'note', 'No character set is declared.', '', 'Add <meta charset="utf-8"> first in the head.');
      const noindex = /noindex/.test(P.robots) || /noindex/i.test((hd || {})['x-robots-tag'] || '');
      if (!P.canonical) { if (!noindex) add('seo.canonical_missing', 'warn', 'No canonical link.', '', 'Add <link rel="canonical"> with the full URL of this page.'); }
      else if (!/^https?:\/\//i.test(P.canonical)) add('seo.canonical_relative', 'warn', 'The canonical URL is not a full URL.', P.canonical, 'Write it with https and the host.');
      if (noindex) { if (kind === 'landing') add('seo.noindex', 'note', 'The page is set to noindex, as a campaign landing page usually is.', P.robots || 'x-robots-tag header', 'Leave it unless this page should rank in search.', true); else add('seo.noindex', sales || kind === 'article' ? 'block' : 'warn', 'The page tells search engines not to index it.', P.robots || 'x-robots-tag header', 'Remove noindex before launch if this page should be found in search.'); }
      const og = [!P.metas['og:title'] && 'title', !P.metas['og:image'] && 'image'].filter(Boolean);
      if (og.length) add('seo.og_missing', 'note', `No Open Graph ${og.join(' or ')}: a shared link shows without ${og.includes('image') ? 'a picture' : 'its own title'}.`, '', 'Add og:title, og:description and og:image (1200 by 630 pixels).');
      if (!P.landmarks.main) add('a11y.main_missing', 'warn', 'No main landmark.', '', 'Wrap the page content in one main element so keyboard and screen reader users can jump to it.');
    }

    /* headings */
    const H = P.headings, h1 = H.filter(h => h.level === 1);
    if (!h1.length) add('seo.h1_missing', 'block', 'No h1 heading.', '', 'Give the page one h1 that names the service and the place.');
    else if (h1.length > 1) add('seo.h1_multiple', 'warn', `${h1.length} h1 headings; a page should have one.`, h1.map(h => h.text).join(' | '), 'Keep one h1 and make the others h2.');
    if (h1.length && H[0].level !== 1) add('seo.heading_order', 'warn', `The first heading is an h${H[0].level}, ahead of the h1.`, H[0].text, 'Put the h1 first; a line above it (an eyebrow) should be a paragraph, not a heading.');
    const si = H.findIndex((h, i) => i > 0 && h.level > H[i - 1].level + 1);
    if (si > 0) add('a11y.heading_skip', 'warn', `Heading levels skip: an h${H[si].level} follows an h${H[si - 1].level}.`, H[si].text, 'Step down one level at a time so the outline reads in order.');
    const emptyH = H.filter(h => !h.text).length; if (emptyH) add('a11y.heading_empty', 'warn', `${plural(emptyH, 'heading')} with no text.`, '', 'Remove empty headings or give them text.');

    /* images */
    const imgs = P.images.filter(i => !i.hidden), noAlt = imgs.filter(i => !i.hasAlt), file = i => (i.src || '').split(/[?#]/)[0].split('/').pop() || '(no src)', real = i => !/^data:/i.test(i.src);
    if (noAlt.length) add('a11y.img_alt', 'warn', `${noAlt.length} of ${plural(imgs.length, 'image')} ${noAlt.length === 1 ? 'has' : 'have'} no alt attribute: a screen reader reads the file name, and image search has nothing to index.`, noAlt.slice(0, 4).map(file).join(', '), 'Say what each photo shows; give purely decorative images alt="".');
    const noDim = imgs.filter(i => real(i) && !(i.width && i.height));
    if (noDim.length) add('perf.img_dimensions', 'warn', `${noDim.length} of ${plural(imgs.length, 'image')} ${noDim.length === 1 ? 'has' : 'have'} no width and height, so the page jumps as they load.`, noDim.slice(0, 4).map(file).join(', '), 'Put the real pixel width and height on every img; CSS can still scale it.');
    const hero = imgs.length && imgs[0].fold && real(imgs[0]) ? imgs[0] : null;
    if (hero && hero.loading === 'lazy') add('perf.hero_lazy', 'warn', 'The first image is lazy loaded, and it is likely the largest thing on the first screen.', file(hero), 'Remove loading="lazy" from the hero image and add fetchpriority="high".');
    else if (hero && hero.fetchpriority !== 'high') add('perf.hero_priority', 'note', 'The first image has no fetchpriority="high".', file(hero), 'Add fetchpriority="high" so the browser fetches the hero image ahead of the others.');
    const eager = imgs.filter(i => !i.fold && real(i) && i.loading !== 'lazy');
    if (eager.length >= 2) add('perf.img_not_lazy', 'note', `${eager.length} images below the first section load at once.`, eager.slice(0, 4).map(file).join(', '), 'Add loading="lazy" to images below the first screen.');
    const legacy = imgs.filter(i => /\.(jpe?g|png|gif)$/i.test((i.src || '').split(/[?#]/)[0]) && !i.inPicture);
    if (legacy.length) add('perf.img_format', 'note', `${plural(legacy.length, 'image')} served as JPEG, PNG or GIF.`, legacy.slice(0, 4).map(file).join(', '), 'Serve WebP or AVIF (converted files, or a picture element with a fallback); they are usually a quarter to a half smaller.');

    /* links and buttons */
    const A = P.anchors, tel = A.filter(a => a.kind === 'tel'), internal = A.filter(a => a.kind === 'internal'), nameOf = x => x.text || x.ariaLabel || x.title || (x.alts || []).join(' ');
    const unnamed = A.filter(a => a.href != null && !nameOf(a));
    if (unnamed.length) add('a11y.link_name', 'warn', `${plural(unnamed.length, 'link')} with no text a screen reader can read.`, unnamed.slice(0, 3).map(a => a.href || '(empty href)').join(', '), 'Give each link text, or an aria-label when it only holds an icon.');
    const unBtn = P.buttons.filter(b => !nameOf(b));
    if (unBtn.length) add('a11y.button_name', 'warn', `${plural(unBtn.length, 'button')} with no text a screen reader can read.`, '', 'Give each button text or an aria-label.');
    const vague = A.filter(a => VAGUE.test(a.text) && !a.ariaLabel);
    if (vague.length) add('seo.link_text', 'warn', `${plural(vague.length, 'link')} with text that says nothing out of context.`, vague.slice(0, 3).map(a => `"${a.text}" to ${a.href}`).join(', '), 'Name the destination in the link text: "AC repair in Plano", not "click here".');
    const dead = A.filter(a => a.kind === 'empty' && a.href != null);
    if (dead.length) add('content.empty_links', 'warn', `${plural(dead.length, 'link')} that ${dead.length === 1 ? 'goes' : 'go'} nowhere.`, dead.slice(0, 3).map(a => `"${a.text}" (${a.href || 'empty href'})`).join(', '), 'Point each at its page or remove it.');
    const lost = A.filter(a => { if (a.kind !== 'anchor' || /^#(top)?$/i.test(a.href)) return false; let id = a.href.slice(1); try { id = decodeURIComponent(id); } catch (e) { } return !has(X.idset, id); });
    if (lost.length) add('content.broken_anchor', frag ? 'note' : 'warn', `${plural(lost.length, 'link')} to an id that is not ${frag ? 'in this markup (it may sit elsewhere on the finished page)' : 'on the page'}.`, uniq(lost.map(a => a.href)).slice(0, 4).join(', '), 'Add the id to the section the link should jump to, or fix the link.');
    if (!internal.length && kind !== 'landing') add('seo.no_internal_links', soft('warn'), 'No links to other pages of the site in this markup.', '', 'Link to the related service and city pages that are live; it helps visitors and search engines move through the site.');
    if (P.words < THIN[kind]) add('seo.thin_content', 'warn', `${plural(P.words, 'word')} of text; a ${kind === 'other' ? 'page' : kind + ' page'} usually needs ${THIN[kind]} or more to answer the visitor.`, '', 'Add what the visitor came for: what the work involves, what it costs, how long it takes, and answers to the questions people ask.');
    if (P.ids.dupes.length) add('a11y.duplicate_ids', 'warn', `${plural(P.ids.dupes.length, 'id')} used more than once.`, P.ids.dupes.slice(0, 5).join(', '), 'Make every id unique; labels, anchors and scripts all rely on it.');
    if (P.tabindexPositive) add('a11y.tabindex_positive', 'warn', `${plural(P.tabindexPositive, 'element')} with a tabindex above zero, which pulls the keyboard out of reading order.`, '', 'Use tabindex="0" or none and let the markup order set the tab order.');

    /* media, frames, expandable items, form fields */
    const loud = P.media.filter(m => m.autoplay && !m.muted), quiet = P.media.filter(m => m.autoplay && m.muted);
    if (loud.length) add('a11y.autoplay', 'warn', `${plural(loud.length, 'video or audio element')} set to play with sound as the page loads.`, '', 'Remove autoplay, or mute it and give it controls.');
    else if (quiet.length) add('a11y.autoplay', 'note', `${plural(quiet.length, 'muted video')} set to autoplay.`, '', 'Keep controls on it and stop it for people who ask for reduced motion.');
    const untitled = P.iframes.filter(f => !f.title);
    if (untitled.length) add('a11y.iframe_title', 'warn', `${plural(untitled.length, 'iframe')} without a title.`, untitled.slice(0, 3).map(f => where(f.src) || '(no src)').join(', '), 'Add a title that says what the frame holds, such as "Service area map".');
    const eagerFrames = P.iframes.filter(f => !f.fold && f.loading !== 'lazy');
    if (eagerFrames.length) add('perf.iframe_not_lazy', 'note', `${plural(eagerFrames.length, 'iframe')} below the first section ${eagerFrames.length === 1 ? 'loads' : 'load'} with the page.`, eagerFrames.slice(0, 3).map(f => where(f.src)).join(', '), 'Add loading="lazy" to maps and video embeds.');
    const bare = P.details.filter(d => !d.hasSummary || !d.summary);
    if (bare.length) add('a11y.details_summary', 'warn', `${plural(bare.length, 'expandable item')} with no summary text.`, '', 'Give every details element a summary that states the question or the topic.');
    const fields = P.forms.reduce((all, f) => all.concat(f.fields), P.looseFields.slice()).filter(f => !f.offscreen);
    const unlabeled = fields.filter(f => !f.label && !f.ariaLabel && !f.title);
    if (unlabeled.length) add('a11y.field_label', 'warn', `${plural(unlabeled.length, 'form field')} with no label${unlabeled.some(f => f.placeholder) ? ' (a placeholder is not a label: it disappears as soon as someone types)' : ''}.`, unlabeled.slice(0, 4).map(f => f.name || f.id || f.type).join(', '), 'Give each field a label element, wrapped around it or tied to it with for and id.');

    /* contrast: only pairs the markup itself resolves */
    const C = P.contrast, failing = C.pairs.filter(p => !p.pass);
    if (failing.length) add('a11y.contrast', 'warn', `${plural(failing.length, 'color pair')} below the WCAG AA contrast minimum.`, failing.slice(0, 3).map(p => `"${p.sample}" ${p.fg} on ${p.bg} is ${p.ratio} to 1 (needs ${p.large ? '3' : '4.5'})`).join('; '), 'Darken or lighten one side until normal text reaches 4.5 to 1 and large headings 3 to 1.');
    if (!C.checked) add('a11y.contrast_unknown', 'note', `Text contrast could not be determined: ${X.sheets ? 'the colors come from stylesheets this check does not read' : 'this markup sets no colors of its own' + (frag ? ' (pass the page\'s css to have it checked)' : '')}.`, '', '', true);
    else if (C.undetermined) add('a11y.contrast_unknown', 'note', `Contrast was checked on ${plural(C.checked, 'run')} of text; ${C.undetermined} more could not be determined (a background image, a gradient, or colors set elsewhere).`, '', '', true);
    if (tel.length && !tel.some(a => a.btn)) add('a11y.tap_target', 'note', 'The phone links are plain text links; their tap size cannot be read from the markup.', tel[0].text || tel[0].href, 'Make the main call link a button at least 44 by 44 CSS pixels.', true);

    /* delivery */
    const pageHost = D.bareDomain(url || P.canonical || brand.domain || ''), ext = P.scripts.filter(s => s.src);
    const blocking = ext.filter(s => s.inHead && !s.async && !s.defer && !s.module && !/json|template|text\/plain/i.test(s.type));
    if (blocking.length) add('perf.blocking_scripts', 'warn', `${plural(blocking.length, 'script')} in the head ${blocking.length === 1 ? 'loads' : 'load'} without async or defer and ${blocking.length === 1 ? 'holds' : 'hold'} up the first paint.`, blocking.slice(0, 4).map(s => where(s.src) + '/' + file(s)).join(', '), 'Add defer (async for independent tags such as analytics), or move them to the end of the body.');
    const sum = (list, k) => list.reduce((t, x) => t + (x[k] || 0), 0), inlineJs = sum(P.scripts, 'inlineBytes'), inlineCss = sum(P.styles, 'inlineBytes');
    if (inlineCss > 100000 || inlineJs > 60000) add('perf.inline_bytes', 'warn', `${D.fmtBytes(inlineCss)} of CSS and ${D.fmtBytes(inlineJs)} of script are inline, sent again with every page view.`, '', 'Move shared CSS and script into cached files and keep only the critical CSS inline.');
    const third = uniq(ext.filter(s => ABS.test(s.src)).map(s => D.bareDomain(s.src.replace(/^\/\//, 'https://'))).filter(h => h && h !== pageHost));
    if (third.length > 3) add('perf.third_party', third.length > 8 ? 'warn' : 'note', `Scripts load from ${third.length} other hosts.`, third.slice(0, 8).join(', '), 'Each host costs a connection and runs code you do not control; drop the tags nobody reads and load the rest through one tag manager, deferred.');
    const gf = P.links.filter(l => /\bstylesheet\b/.test(l.rel) && /fonts\.googleapis\.com/i.test(l.href)), fontNotes = [];
    if (gf.some(l => !/display=swap/i.test(l.href))) fontNotes.push('a Google Fonts link without display=swap');
    if (gf.length && !P.links.some(l => /preconnect/.test(l.rel) && /fonts\.gstatic\.com/i.test(l.href))) fontNotes.push('no preconnect to fonts.gstatic.com');
    const noSwap = X.idx.fontFaces.filter(f => !f['font-display']).length; if (noSwap) fontNotes.push(`${plural(noSwap, '@font-face rule')} without font-display`);
    if (fontNotes.length) add('perf.fonts', 'note', `Web fonts: ${fontNotes.join('; ')}.`, '', 'Use font-display: swap and preconnect to the font host so text shows at once in a fallback font.');
    if (P.domNodes > 800) add('perf.dom_size', P.domNodes > 1500 ? 'warn' : 'note', `${P.domNodes} elements in the markup.`, '', 'Flatten wrappers that only exist for layout; page builders nest far deeper than the design needs.');
    const cssFiles = P.styles.filter(s => s.href && s.inHead).length;
    if (cssFiles > 4) add('perf.css_requests', 'note', `${cssFiles} stylesheets in the head, each one blocking the first paint.`, '', 'Combine them, and load what the first screen does not need with media or after load.');

    /* conversion */
    if (kind !== 'article') {
      if (!tel.length) add('cro.phone_missing', soft('warn'), 'No phone link on the page.', '', 'Add a tel: link with the number as its text near the top; most HVAC calls start on a phone.');
      else if (!tel.some(a => a.fold)) add('cro.phone_not_first', soft('warn'), 'The phone link is not in the first section.', tel[0].text || tel[0].href, 'Put a call button in the first section so a phone visitor can call without scrolling.');
      if (!A.some(a => a.fold && (a.kind === 'tel' || a.btn)) && !P.buttons.some(b => b.fold)) add('cro.cta_missing_first', soft('warn'), 'The first section has no call to action.', '', 'Add one clear button to the first section: call, or book service.');
      const rivals = uniq(A.filter(a => a.fold && a.btn && a.kind !== 'tel').map(a => a.href));
      if (rivals.length > 2) add('cro.competing_ctas', 'note', `${rivals.length} different buttons compete in the first section.`, rivals.slice(0, 5).join(', '), 'Keep one primary action and at most one secondary.');
    }
    if (kind === 'landing' && !P.forms.length) add('cro.form_missing', 'warn', 'A landing page with no form: a visitor who will not call has no way to respond.', '', 'Add a short request form (name, phone, what happened) or a booking link.');
    P.forms.forEach(f => {
      const asked = f.fields.filter(x => !x.offscreen && x.type !== 'checkbox' && x.type !== 'radio');
      if (asked.length > 5) add('cro.form_fields', asked.length > 8 ? 'warn' : 'note', `The form asks for ${asked.length} things.`, asked.map(x => x.label || x.name || x.type).slice(0, 10).join(', '), 'Ask for what the first call needs (name, phone, what happened) and collect the rest on the call.');
      if (f.consentPrechecked) add('cro.consent_prechecked', 'block', 'The consent checkbox is ticked before the visitor touches it.', (f.fields.find(x => x.type === 'checkbox' && x.checked) || {}).label || '', 'Remove the checked attribute: consent to calls and texts has to be the visitor\'s own act.');
      if (!f.hasConsent && f.fields.some(x => x.type === 'tel' || /phone|tel|mobile|cell/i.test(x.name + ' ' + x.label))) add('cro.consent_missing', 'warn', 'The form asks for a phone number without a consent checkbox for calls and texts.', '', 'Add an unchecked consent checkbox with the contact wording beside it.');
      if (/^(submit|send|go|ok|enter)$/i.test(squash(f.submitText))) add('cro.submit_label', 'note', `The submit button says "${squash(f.submitText)}".`, '', 'Say what happens next: "Request service", "Get my quote".');
    });
    if (brand.lic && !loose(P.text).includes(loose(brand.lic))) add('cro.trust_license', 'warn', `The license number ${brand.lic} is not on the page.`, '', 'Print it in the trust strip or the footer; Texas requires the contractor license number in advertising (16 TAC 75.71).');
    if (brand.name && !loose(P.text).includes(loose(brand.name))) add('cro.trust_name', 'note', `The business name "${brand.name}" does not appear in the text.`, '', 'Name the business in the copy, not only in the logo.');
    if (sales && !/\b(hours|open|24\/7|24 hours|monday|sunday|weekdays|[ap]\.?m\.?)\b/i.test(P.text)) add('cro.trust_hours', 'note', 'No opening hours or availability in the text.', '', 'Say when the phones are answered.', true);
    const sticky = /forge-sticky|sticky-call|sticky-bar|mobile-bar|call-bar/i.test(X.src);
    if (sticky) add('cro.sticky_bar', 'note', 'A sticky mobile call bar is in the markup.', '', '', true);

    /* structured data, in the markup or handed in beside it */
    const nodes = jsonldNodes(P.jsonld.concat(o.schema ? [o.schema] : [])), types = uniq(nodes.reduce((a, n) => a.concat(typesOf(n)), []));
    P.jsonldErrors.forEach(e => add('schema.invalid_json', 'warn', 'A JSON-LD block does not parse, so search engines ignore all of it.', e, 'Fix the JSON.'));
    const biz = nodes.filter(n => typesOf(n).some(t => BIZ.test(t)));
    if (!nodes.length) { if (frag && !o.schema) add('schema.not_in_markup', 'note', 'No JSON-LD in this markup; a portable page carries its schema beside the markup.', '', 'Pass the schema with the page to have it checked.', true); else if (!P.jsonldErrors.length) add('schema.business_missing', sales ? 'warn' : 'note', 'No structured data on the page.', '', 'Add JSON-LD with an HVACBusiness node: name, telephone, address, opening hours, area served.'); }
    else if (!biz.length) { if (kind !== 'article') add('schema.business_missing', soft('warn'), 'The structured data names no business.', types.join(', '), 'Add an HVACBusiness (or LocalBusiness) node with name, telephone and address.'); }
    else { const b = biz.find(n => !typesOf(n).includes('Organization')) || biz[0], miss = ['name', 'telephone', 'address'].filter(k => !b[k]); if (miss.length) add('schema.business_fields', 'warn', `The ${typesOf(b)[0]} node has no ${miss.join(', ')}.`, '', 'Fill them in exactly as they appear on the page and on the Google Business Profile.'); }
    const rated = nodes.find(n => (n.aggregateRating || n.review) && typesOf(n).some(t => BIZ.test(t)));
    if (rated) add('schema.self_review', 'warn', 'Review markup sits on the business\'s own entity.', `${typesOf(rated)[0]} with ${rated.aggregateRating ? 'aggregateRating' : 'review'}`, 'Google does not show stars for reviews a local business publishes about itself, and treats the markup as self serving; remove it and show real reviews as ordinary content.');
    const priced = nodes.find(n => typesOf(n).some(t => t === 'Product' || t === 'Offer') && (n.price != null || [].concat(n.offers || []).some(x => x && x.price != null)));
    if (priced) add('schema.price_claim', 'note', 'The structured data states a price.', typesOf(priced)[0], 'A price in schema is a price claim: it has to be on the page, current, and available to everyone who asks.');
    const faq = nodes.find(n => typesOf(n).includes('FAQPage')), asked = uniq(P.details.filter(d => d.summary).map(d => d.summary).concat(H.filter(h => /\?\s*$/.test(h.text)).map(h => h.text)));
    if (faq) { const qs = [].concat(faq.mainEntity || []).map(q => squash(q && q.name)).filter(Boolean), seen = new Set(asked.map(loose)), gone = qs.filter(q => !seen.has(loose(q))); if (gone.length) add('schema.faq_mismatch', 'warn', `${gone.length} of ${plural(qs.length, 'question')} in the FAQ markup ${gone.length === 1 ? 'is' : 'are'} not on the page.`, gone[0], 'FAQ markup has to match questions and answers a visitor can read; add them to the page or take them out of the markup.'); }
    else if (nodes.length && asked.length >= 2 && P.details.length >= 2) add('schema.faq_missing', 'note', `${asked.length} questions are on the page without FAQPage markup.`, asked[0], 'Add a FAQPage node that repeats the visible questions and answers word for word.');

    /* transport, when the response is known */
    if (/^http:\/\//i.test(url)) add('security.not_https', 'block', 'The page is served over plain http.', url, 'Serve it over https and redirect http to it.');
    if (hd) {
      if (/^https:/i.test(url) && !hd['strict-transport-security']) add('security.hsts_missing', 'note', 'No Strict-Transport-Security header.', '', 'Send max-age of at least six months once every subdomain works over https.');
      if (!/nosniff/i.test(hd['x-content-type-options'] || '')) add('security.nosniff_missing', 'note', 'No X-Content-Type-Options: nosniff header.', '', 'Add it at the server or the CDN.');
      if (!hd['x-frame-options'] && !/frame-ancestors/i.test(hd['content-security-policy'] || '')) add('security.frame_options', 'note', 'Nothing stops other sites from framing this page.', '', 'Send X-Frame-Options: SAMEORIGIN or a frame-ancestors policy.');
    }
    if (/^https:/i.test(url) || (hd && !/^http:/i.test(url))) { const mixed = uniq(imgs.map(i => i.src).concat(ext.map(s => s.src), P.styles.map(s => s.href), P.iframes.map(f => f.src)).filter(u => /^http:\/\//i.test(u || ''))); if (mixed.length) add('security.mixed_content', 'warn', `${plural(mixed.length, 'asset')} referenced over http on an https page.`, mixed.slice(0, 3).join(', '), 'Use https URLs; browsers block scripts and frames loaded this way and warn on images.'); }

    /* content */
    const stub = /lorem ipsum|\[\[\s*verify|\bTODO\b|placeholder text|\bTBD\b|your (company|business) name here/i.exec(P.text);
    if (stub) add('content.placeholder', 'block', 'Placeholder text is still on the page.', P.text.slice(Math.max(0, stub.index - 40), stub.index + 60), 'Replace it with the real copy before anything ships.');
    const stray = uniq((X.outside.match(PHONE) || []).map(squash));
    if (stray.length) add('content.phone_not_linked', 'warn', `${plural(stray.length, 'phone number')} in the text ${stray.length === 1 ? 'is' : 'are'} not a link.`, stray.slice(0, 3).join(', '), 'Wrap each in a tel: link so a tap dials it.');

    /* the score */
    /* an area the caller cannot judge from this markup (speed, when a page builder writes the real markup) is left out, and says so */
    const skipA = (Array.isArray(o.skipAreas) ? o.skipAreas : []).filter(a => AREAS.includes(a));
    if (skipA.length) { for (let i = F.length - 1; i >= 0; i--) if (skipA.includes(F[i].area)) F.splice(i, 1); skipA.forEach(a => skipped.push(a + ' (not scored)')); }
    const order = { block: 0, warn: 1, note: 2 }, areas = {}, counts = { block: 0, warn: 0, note: 0 }; let minus = 0;
    AREAS.forEach(a => { areas[a] = skipA.includes(a) ? { score: null, findings: 0, skipped: true } : { score: 100, findings: 0 }; });
    F.forEach(f => { counts[f.sev]++; areas[f.area].findings++; const p = f.info ? 0 : PEN[f.sev]; minus += p; areas[f.area].score = Math.max(0, areas[f.area].score - p * 3); });
    F.sort((a, b) => order[a.sev] - order[b.sev] || (a.info ? 1 : 0) - (b.info ? 1 : 0) || AREAS.indexOf(a.area) - AREAS.indexOf(b.area));
    let score = Math.max(0, Math.round(100 - minus)); if (counts.block) score = Math.min(score, 69);
    const kinds = k => A.filter(x => x.kind === k).length;
    const facts = { title, titleLength: title.length, metaDescriptionLength: desc.length, canonical: P.canonical, robots: P.robots, lang: P.lang, h1: h1.map(h => h.text), headings: H.length, words: P.words, images: imgs.length, imagesWithoutAlt: noAlt.length, altCoverage: imgs.length ? Math.round(100 * (imgs.length - noAlt.length) / imgs.length) : null, links: { internal: kinds('internal'), external: kinds('external'), phone: tel.length, email: kinds('mailto'), empty: dead.length }, phoneInFirstSection: tel.some(a => a.fold), forms: P.forms.length, formFields: fields.length, scripts: { external: ext.length, blockingInHead: blocking.length, inlineBytes: inlineJs, otherHosts: third }, styles: { files: P.styles.filter(s => s.href).length, inlineBytes: inlineCss }, domNodes: P.domNodes, bytes: P.bytes, jsonldTypes: types, stickyBar: sticky, contrast: { checked: C.checked, failing: failing.length, undetermined: C.undetermined } };
    return { score, grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F', counts, areas, findings: F, facts, kind, fragment: frag, skipped };
  }

  /* ---------- sitemaps ----------
     sitemapParse(text) → {kind: 'index' | 'urlset' | 'list' | 'empty', urls: [{loc, lastmod}], sitemaps: [loc]}
     Reads a sitemap index, a urlset, or a plain list of URLs, one per line (an "anchor | URL" line keeps the URL). */
  function sitemapParse(text) {
    const s = String(text == null ? '' : text), urls = [], sitemaps = [], seen = new Set();
    if (/<(urlset|sitemapindex)\b/i.test(s) || /<loc\b/i.test(s)) {
      let cur = null, cap = '', buf = '';
      for (const t of tokens(s)) {
        if (t.t === 'open') { if (t.name === 'url' || t.name === 'sitemap') cur = { kind: t.name, loc: '', lastmod: '' }; else if (t.name === 'loc' || t.name === 'lastmod') { cap = t.name; buf = ''; } }
        else if (t.t === 'text' && cap) buf += t.text;
        else if (t.t === 'comment' && cap && /^\[CDATA\[/.test(t.text)) buf += t.text.replace(/^\[CDATA\[|\]\]$/g, '');
        else if (t.t === 'close') {
          if (t.name === cap) { const v = squash(buf); if (cur) cur[cap] = v; else if (cap === 'loc' && v && !seen.has(v)) { seen.add(v); urls.push({ loc: v, lastmod: '' }); } cap = ''; }
          else if (cur && t.name === cur.kind) { if (cur.loc && !seen.has(cur.loc)) { seen.add(cur.loc); if (cur.kind === 'sitemap') sitemaps.push(cur.loc); else urls.push({ loc: cur.loc, lastmod: cur.lastmod }); } cur = null; }
        }
      }
      return { kind: sitemaps.length && !urls.length ? 'index' : urls.length || sitemaps.length ? 'urlset' : 'empty', urls, sitemaps };
    }
    s.split(/\r?\n/).forEach(line => { const v = squash(line.split('|').pop()); if (!v || v[0] === '#') return; if (!/^(https?:\/\/|\/)\S+$/i.test(v) && !/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return; if (seen.has(v)) return; seen.add(v); if (/\.xml(\.gz)?([?#].*)?$/i.test(v)) sitemaps.push(v); else urls.push({ loc: v, lastmod: '' }); });
    return { kind: urls.length ? 'list' : sitemaps.length ? 'index' : 'empty', urls, sitemaps };
  }

  /* ---------- redirects: old URLs mapped onto new ones ----------
     redirectMap(oldUrls, newUrls, {threshold}) → {rows: [{from, to, score, how, same}], unmatched: [from], unused: [to]}
       exact    the same path once case, a trailing slash, index files and .html, .php, .aspx endings are set aside
       slug     the last path segment is the same and the folders above it moved
       similar  the words of the two paths overlap by at least the threshold (0.5 unless given); always read these
     same marks a row whose path did not change at all: nothing to redirect, and redirectFormat leaves it out.
     to is a path when both lists are on one host, a full URL when the new list is on another. */
  const STOPW = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'for', 'to', 'our', 'your', 'page', 'index', 'html', 'php', 'www']);
  function urlParts(u) {
    let host = '', path = String(u == null ? '' : (u.loc || u)).trim(), query = '';
    const m = /^(?:https?:)?\/\/([^\/?#]+)(.*)$/i.exec(path); if (m) { host = m[1].toLowerCase().replace(/^www\./, ''); path = m[2] || '/'; }
    path = path.split('#')[0]; const q = path.indexOf('?'); if (q !== -1) { query = path.slice(q + 1); path = path.slice(0, q); }
    if (path[0] !== '/') path = '/' + path;
    let norm = path; try { norm = decodeURIComponent(path); } catch (e) { }
    norm = norm.toLowerCase().replace(/\/(index|default)\.(html?|php|aspx?)$/, '/').replace(/\.(html?|php|aspx?)$/, '').replace(/\/+$/, '') || '/';
    const segs = norm.split('/').filter(Boolean), slug = segs[segs.length - 1] || '';
    const toks = norm.split(/[^a-z0-9]+/).filter(w => w && !STOPW.has(w));
    return { host, path, query, norm: norm + (query ? '?' + query : ''), slug: query ? '' : slug, toks, slugToks: new Set(slug.split(/[^a-z0-9]+/).filter(Boolean)) };
  }
  function redirectMap(oldUrls, newUrls, o) {
    o = o || {}; const th = o.threshold == null ? 0.5 : +o.threshold;
    const N = uniq((newUrls || []).map(u => String(u && u.loc || u || '').trim()).filter(Boolean)).map(u => Object.assign(urlParts(u), { raw: u }));
    const O = uniq((oldUrls || []).map(u => String(u && u.loc || u || '').trim()).filter(Boolean)).map(u => Object.assign(urlParts(u), { raw: u }));
    const byNorm = new Map(), bySlug = new Map(); N.forEach(n => { if (!byNorm.has(n.norm)) byNorm.set(n.norm, n); if (n.slug) { if (!bySlug.has(n.slug)) bySlug.set(n.slug, []); bySlug.get(n.slug).push(n); } });
    const overlap = (a, b) => { const A = new Set(a.toks), B = new Set(b.toks); if (!A.size || !B.size) return 0; let hit = 0, w = 0, all = 0; new Set([...A, ...B]).forEach(t => { const k = (a.slugToks.has(t) || b.slugToks.has(t)) ? 2 : 1; all += k; if (A.has(t) && B.has(t)) hit += k; }); w = hit / all; return Math.round(w * 100) / 100; };
    const rows = [], unmatched = [], used = new Set();
    const target = (a, n) => (n.host && a.host && n.host !== a.host) || (n.host && !a.host) ? (/^https?:/i.test(n.raw) ? n.raw.split('#')[0] : 'https://' + n.host + n.path) : n.path + (n.query ? '?' + n.query : '');
    O.forEach(a => {
      const from = a.path + (a.query ? '?' + a.query : ''); let n = byNorm.get(a.norm), how = 'exact', score = 1;
      if (!n && a.slug && bySlug.has(a.slug)) { const c = bySlug.get(a.slug); n = c.length === 1 ? c[0] : c.map(x => [x, overlap(a, x)]).sort((x, y) => y[1] - x[1])[0][0]; how = 'slug'; score = 0.9; }
      if (!n) { let best = null, bs = 0; N.forEach(x => { const s = overlap(a, x); if (s > bs) { bs = s; best = x; } }); if (best && bs >= th) { n = best; how = 'similar'; score = bs; } }
      if (!n) { unmatched.push(from); return; }
      used.add(n.raw); const to = target(a, n), row = { from, to, score, how }; if (to === from) row.same = true; rows.push(row);
    });
    return { rows, unmatched, unused: N.filter(n => !used.has(n.raw)).map(n => n.raw) };
  }
  /* redirectFormat(rows, format) → text. Formats: 'htaccess' (Apache), 'nginx', 'netlify' (a _redirects file, also read
     by Cloudflare Pages) and 'csv' (source, target, regex, code: the columns the Redirection plugin for WordPress
     imports). Every rule is a 301. Rows that did not change are left out; a source with a query string is matched on
     the query where the format can do it and is listed as a comment where it cannot. */
  function redirectFormat(rows, format) {
    const R = (rows || []).filter(r => r && r.from && r.to && !r.same && r.from !== r.to), rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), out = [];
    const split = r => { const q = r.from.indexOf('?'); return q === -1 ? { path: r.from, query: '' } : { path: r.from.slice(0, q), query: r.from.slice(q + 1) }; };
    const bare = p => p.length > 1 ? p.replace(/\/+$/, '') : p;
    if (format === 'htaccess') {
      out.push('# 301 redirects. Place above the WordPress block if there is one.', 'RewriteEngine On');
      R.forEach(r => { const s = split(r), p = rx(bare(s.path).replace(/^\//, '')); if (s.query) out.push(`RewriteCond %{QUERY_STRING} ^${rx(s.query)}$`, `RewriteRule ^${p}/?$ ${r.to}? [R=301,L]`); else out.push(`RewriteRule ^${p}/?$ ${r.to} [R=301,L]`); });
    } else if (format === 'nginx') {
      out.push('# 301 redirects. Place inside the server block.');
      R.forEach(r => { const s = split(r); if (s.query) out.push(`# ${r.from} -> ${r.to} : match on the query string with a map of $request_uri`); else out.push(`location ~ ^${rx(bare(s.path))}/?$ { return 301 ${r.to}; }`); });
    } else if (format === 'netlify') {
      R.forEach(r => { const s = split(r); out.push(`${bare(s.path)}${s.query ? ' ' + s.query.split('&').join(' ') : ''}  ${r.to}  301`); });
    } else if (format === 'csv') {
      const q = v => '"' + String(v).replace(/"/g, '""') + '"'; out.push('source,target,regex,code');
      R.forEach(r => out.push(`${q(r.from)},${q(r.to)},0,301`));
    } else throw new Error('Unknown redirect format "' + format + '". Use htaccess, nginx, netlify or csv.');
    return out.join('\n') + '\n';
  }

  /* ---------- siteBundle: finished pages as a static site ----------
     siteBundle({site: {name, url, lang, phone, brand: {primary, accent, dark, fontHeading, fontBody}}, pages: [{slug, title,
       html, css, schema, seo: {title, description, canonical, noindex, og_image}, isHome, navLabel}], nav: [{label, href}],
       footerHtml, headHtml, redirects: [{from, to}], notes}) → [{name, data}], ready for the zip writer.
     One index.html per page in a folder named by its slug (the home page at the root), a shared header with a skip
     link, the navigation and a call button, a shared footer, one stylesheet, sitemap.xml without the noindex pages,
     robots.txt, 404.html, the redirect files when redirects are given, and a README.txt that says how to put it online
     and what to check first. Links between the pages are written relative and to index.html by name, so the site also
     works opened from a folder on disk. The returned array carries a report property (not listed in a loop): the pages
     as written, links that point outside the bundle, forms and where they post, images that are not in the bundle. */
  const SYS_FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  function siteBundle(o) {
    o = o || {}; const site = o.site || {}, brand = site.brand || {}, src = (o.pages || []).filter(p => p && typeof p.html === 'string');
    if (!src.length) throw new Error('siteBundle needs at least one page with html.');
    const base = String(site.url || '').trim().replace(/\/+$/, ''), host = D.bareDomain(base), lang = String(site.lang || 'en'), name = String(site.name || 'Home');
    const homeP = src.find(p => p.isHome) || src.find(p => /^(home|index)$/i.test(String(p.slug || ''))) || src[0], taken = new Set();
    const pages = src.map(p => {
      const isHome = p === homeP, slug = isHome ? '' : String(p.slug || p.title || '').replace(/^\/+|\/+$/g, '').split('/').map(D.slugify).filter(Boolean).join('/');
      if (!isHome && !slug) throw new Error('A page has neither a slug nor a title to name its folder.');
      if (taken.has(slug)) throw new Error(`Two pages share the address /${slug}/.`); taken.add(slug);
      return { p, isHome, slug, depth: slug ? slug.split('/').length : 0, path: slug ? '/' + slug + '/' : '/', file: (slug ? slug + '/' : '') + 'index.html', seo: p.seo || {} };
    });
    const byPath = new Map(pages.map(g => [g.path, g])), report = { home: homeP.slug || '', pages: pages.map(g => ({ slug: g.slug, path: g.path, file: g.file, noindex: !!g.seo.noindex })), outside: [], forms: [], images: [] };
    const up = d => '../'.repeat(d);
    /* an href as written → the href to write on a page at this depth: pages of the bundle become relative file links */
    function link(href, depth, loosely) {
      let h = String(href == null ? '' : href).trim(); if (!h || /^(#|tel:|mailto:|sms:|javascript:|data:)/i.test(h)) return h;
      if (ABS.test(h)) { if (!host || D.bareDomain(h.replace(/^\/\//, 'https://')) !== host) return h; h = h.replace(/^(https?:)?\/\/[^\/?#]+/i, '') || '/'; }
      else if (h[0] !== '/') { if (!loosely) return h; h = '/' + h; }
      const m = /^([^?#]*)(.*)$/.exec(h); let path = m[1].replace(/index\.html?$/i, ''); if (!/\/$/.test(path) && !/\.[a-z0-9]{2,5}$/i.test(path)) path += '/';
      if (byPath.has(path)) return up(depth) + path.slice(1) + 'index.html' + m[2];
      if (/^\/assets\//.test(path)) return up(depth) + h.slice(1);
      if (!loosely && !report.outside.includes(path)) report.outside.push(path);
      return loosely ? String(href).trim() : h;
    }
    /* a page body with its links to other pages of the bundle rewritten; everything else is copied as written */
    function body(g) {
      const s = g.p.html; let out = '';
      for (const t of tokens(s)) {
        if (t.t === 'open') {
          const a = t.attrs;
          if (t.name === 'a' && a.href != null) { const h = link(a.href, g.depth); if (h !== a.href) { out += openTag('a', Object.assign({}, a, { href: h }), false); continue; } }
          else if (t.name === 'form') report.forms.push({ page: g.path, action: a.action || '(none)', wordpress: /wp-json|admin-ajax|wp-admin/i.test(a.action || '') });
          else if (t.name === 'img' && a.src && !ABS.test(a.src) && !/^data:/i.test(a.src)) report.images.push({ page: g.path, src: a.src });
        }
        out += s.slice(t.pos, t.end);
      }
      return out;
    }
    const color = (v, d) => { const c = parseColor(v); return c ? toHex(c) : d; }, font = f => String(f || '').replace(/[^\w \-]/g, '').trim();
    const primary = color(brand.primary, '#13243a'), accent = color(brand.accent, '#0b6f6d'), dark = color(brand.dark, '#0e1a26');
    const on = bg => contrast('#ffffff', bg).ratio >= contrast('#111111', bg).ratio ? '#ffffff' : '#111111';
    const fb = font(brand.fontBody), fh = font(brand.fontHeading);
    const LAYOUT = `:root{--site-primary:${primary};--site-accent:${accent};--site-dark:${dark};--site-on-dark:${on(dark)};--site-on-accent:${on(accent)};--site-font-b:${fb ? "'" + fb + "'," : ''}${SYS_FONT};--site-font-h:${fh ? "'" + fh + "'," : fb ? "'" + fb + "'," : ''}${SYS_FONT}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
body{margin:0;font-family:var(--site-font-b);font-size:1rem;line-height:1.6;color:#1b1b1a;background:#fff}
h1,h2,h3{font-family:var(--site-font-h);line-height:1.15}
img,video{max-width:100%;height:auto}
:focus-visible{outline:3px solid var(--site-accent);outline-offset:2px}
.site-skip{position:absolute;left:-9999px;top:0;z-index:10000;background:#fff;color:#111;padding:10px 14px;border-radius:0 0 8px 0}
.site-skip:focus{left:0}
.site-header,.site-footer{background:var(--site-dark);color:var(--site-on-dark)}
.site-in{max-width:1140px;margin:0 auto;padding:12px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 24px}
.site-name{margin-right:auto;font-family:var(--site-font-h);font-weight:700;font-size:1.25rem;color:inherit;text-decoration:none}
.site-nav ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:0 18px}
.site-nav a{display:inline-block;padding:10px 2px;color:inherit;text-decoration:none}
.site-nav a:hover,.site-nav a[aria-current="page"]{text-decoration:underline;text-underline-offset:5px}
.site-call{display:inline-flex;align-items:center;min-height:44px;padding:10px 18px;border-radius:8px;background:var(--site-accent);color:var(--site-on-accent);font-weight:700;text-decoration:none}
.site-footer .site-in{padding:26px 20px;font-size:.9rem}
.site-footer a{color:inherit}
.site-404{max-width:720px;margin:0 auto;padding:72px 20px}
`;
    const css = LAYOUT + uniq(pages.map(g => String(g.p.css || '').trim()).filter(Boolean)).join('\n') + '\n';
    const digits = String(site.phone || '').replace(/\D/g, ''), telHref = digits.length === 10 ? 'tel:+1' + digits : digits.length === 11 && digits[0] === '1' ? 'tel:+' + digits : digits ? 'tel:' + digits : '';
    const navItems = (Array.isArray(o.nav) && o.nav.length ? o.nav : pages.filter(g => g.isHome || !g.seo.noindex).slice(0, 8).map(g => ({ label: g.isHome ? 'Home' : g.p.navLabel || g.p.title || g.slug, href: g.path }))).filter(n => n && n.label);
    /* the site path a navigation entry points at, or '' when it leaves the site (another host, a phone link, an anchor) */
    const navPath = n => { const h = String(n.href || '').trim(); if (!h || /^(#|tel:|mailto:|sms:|javascript:)/i.test(h) || (ABS.test(h) && (!host || D.bareDomain(h.replace(/^\/\//, 'https://')) !== host))) return ''; const p = (ABS.test(h) ? h.replace(/^(https?:)?\/\/[^\/?#]+/i, '') || '/' : h[0] === '/' ? h : '/' + h).split(/[?#]/)[0]; return /\/$/.test(p) || /\.[a-z0-9]{2,5}$/i.test(p) ? p : p + '/'; };
    const chrome = (depth, here, rooted) => {
      const to = n => { const h = String(n.href || '').trim(), np = navPath(n); return rooted ? (np ? np + ((/[?#].*$/.exec(h) || [''])[0]) : h) : link(h, depth, true); };
      const nav = navItems.length ? `<nav class="site-nav" aria-label="Main"><ul>${navItems.map(n => `<li><a href="${esc(to(n))}"${here && navPath(n) === here ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`).join('')}</ul></nav>` : '';
      return { head: `<a class="site-skip" href="#main">Skip to content</a>\n<header class="site-header"><div class="site-in"><a class="site-name" href="${esc(rooted ? '/' : link('/', depth))}">${esc(name)}</a>${nav}${telHref ? `<a class="site-call" href="${esc(telHref)}">Call ${esc(site.phone)}</a>` : ''}</div></header>`,
        foot: `<footer class="site-footer"><div class="site-in">${o.footerHtml != null ? o.footerHtml : `<p>${esc(name)}${telHref ? ` · <a href="${esc(telHref)}">${esc(site.phone)}</a>` : ''}</p>`}</div></footer>` };
    };
    const ld = schema => schema ? `${LT}${SCR} type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}${LT}/${SCR}>` : '';
    const doc = (g, title, desc, head, main, rooted) => { const c = chrome(g ? g.depth : 0, g ? g.path : '', rooted); return `<!doctype html>\n<html lang="${esc(lang)}">\n<head>\n${head.filter(Boolean).join('\n')}\n</head>\n<body>\n${c.head}\n<main id="main">\n${main}\n</main>\n${c.foot}\n</body>\n</html>\n`; };
    const out = [];
    pages.forEach(g => {
      const seo = g.seo, title = seo.title || g.p.title || name, desc = seo.description || '', canon = base ? base + g.path : '';
      out.push({ name: g.file, data: doc(g, title, desc, ['<meta charset="utf-8">', '<meta name="viewport" content="width=device-width,initial-scale=1">', `<title>${esc(title)}</title>`, desc && `<meta name="description" content="${esc(desc)}">`, canon && `<link rel="canonical" href="${esc(canon)}">`, seo.noindex && '<meta name="robots" content="noindex,follow">', '<meta property="og:type" content="website">', `<meta property="og:title" content="${esc(title)}">`, desc && `<meta property="og:description" content="${esc(desc)}">`, canon && `<meta property="og:url" content="${esc(canon)}">`, seo.og_image && !/^data:/i.test(seo.og_image) && `<meta property="og:image" content="${esc(seo.og_image)}">`, `<meta property="og:site_name" content="${esc(name)}">`, `<link rel="stylesheet" href="${up(g.depth)}assets/site.css">`, o.headHtml || '', ld(g.p.schema)], body(g), false) });
    });
    out.push({ name: 'assets/site.css', data: css });
    out.push({ name: '404.html', data: doc(null, 'Page not found | ' + name, '', ['<meta charset="utf-8">', '<meta name="viewport" content="width=device-width,initial-scale=1">', `<title>${esc('Page not found | ' + name)}</title>`, '<meta name="robots" content="noindex">', '<link rel="stylesheet" href="/assets/site.css">'], `<div class="site-404"><h1>Page not found</h1><p>That address is not on this site. Start again from the <a href="/">home page</a>${telHref ? ` or call <a href="${esc(telHref)}">${esc(site.phone)}</a>` : ''}.</p></div>`, true) });
    const indexed = pages.filter(g => !g.seo.noindex);
    if (base) out.push({ name: 'sitemap.xml', data: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexed.map(g => `  <url><loc>${esc(base + g.path)}</loc></url>`).join('\n')}\n</urlset>\n` });
    out.push({ name: 'robots.txt', data: `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}` });
    const reds = (o.redirects || []).filter(r => r && r.from && r.to).map(r => ({ from: urlParts(r.from).path + (urlParts(r.from).query ? '?' + urlParts(r.from).query : ''), to: String(r.to) })).filter(r => r.from !== r.to);
    if (reds.length) { out.push({ name: '_redirects', data: redirectFormat(reds, 'netlify') }); out.push({ name: '.htaccess', data: 'DirectoryIndex index.html\nErrorDocument 404 /404.html\n' + redirectFormat(reds, 'htaccess') }); }
    const wpForms = report.forms.filter(f => f.wordpress), L = [];
    L.push(`${name}: a static site of ${plural(pages.length, 'page')}, built by Dr. HVAC in the DFW Thermal Debt Atlas.`, '', 'FILES', ...pages.map(g => `  ${g.file}  ${g.isHome ? '(home page)' : g.path}${g.seo.noindex ? '  noindex, left out of the sitemap' : ''}`), '  assets/site.css  the one stylesheet every page shares', '  404.html  the page a host should serve for an address that does not exist', base ? '  sitemap.xml, robots.txt' : '  robots.txt (no sitemap.xml: the site URL was not given)', reds.length ? `  _redirects and .htaccess  ${plural(reds.length, 'redirect')}, each a 301` : '', '');
    L.push('PUT IT ONLINE', '  Any static host: upload everything in this folder to the web root, keeping the folders.', '  Netlify or Cloudflare Pages: drag the folder in, or connect a repository that holds it. They read _redirects and serve 404.html by themselves.', '  Apache hosting (cPanel and the like): upload into public_html. The .htaccess file, when present, carries the redirects and the 404 page; otherwise set the 404 page in the control panel.', '  Amazon S3 or a similar bucket: set the index document to index.html and the error document to 404.html.', '  To look at it first, open index.html from this folder in a browser. The 404 page uses addresses from the site root, so it only looks right once it is online.', '');
    L.push('CHECK BEFORE IT GOES LIVE', base ? `  The canonical tags and the sitemap use ${base}. Change them if the site goes live on another address.` : '  No site URL was given, so the pages have no canonical tags and there is no sitemap. Build again with the URL before launch.');
    if (report.forms.length) L.push(`  Forms: ${report.forms.map(f => `${f.page} posts to ${f.action}`).join('; ')}.`);
    if (wpForms.length) L.push('  A form here posts to a WordPress address. A static host has no WordPress: point the form at a form service or the host\'s own form handling, and send a test lead.');
    if (report.outside.length) L.push(`  Links to addresses that are not in this bundle (they must exist on the host or they will end on the 404 page): ${report.outside.join(', ')}.`);
    if (report.images.length) L.push(`  Images referenced by a relative path are not in this bundle; upload them beside the pages: ${uniq(report.images.map(i => i.src)).slice(0, 12).join(', ')}.`);
    if (fb || fh) L.push(`  The stylesheet names the font${fb && fh && fb !== fh ? 's' : ''} ${uniq([fh, fb].filter(Boolean)).join(' and ')} but does not load ${fb && fh && fb !== fh ? 'them' : 'it'}; add the font link to the head or host the font files, or the system font shows.`);
    L.push('  Read every page on a phone, tap the call button, send the form, and check the page titles in a search preview.', '');
    if (o.notes) L.push('NOTES', '  ' + String(o.notes).split('\n').join('\n  '), '');
    out.push({ name: 'README.txt', data: L.join('\n').replace(/\n{3,}/g, '\n\n') });
    Object.defineProperty(out, 'report', { enumerable: false, value: report });
    return out;
  }

  return { tokens, decode, parse, outline, audit, AREAS, contrast, parseColor, toHex, design, cssRules, textOf, words, sanitize, jsonldNodes, sitemapParse, redirectMap, redirectFormat, siteBundle };
})();
