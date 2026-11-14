/* A page as the toolkit reads it: front matter and a list of blocks, parsed from the Markdown the strategist writes or
   from any HTML page (a live page under audit). The same blocks feed the linter, the schema builder and the renderer. */

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d', bull: '\u2022', copy: '\u00a9', reg: '\u00ae', trade: '\u2122', deg: '\u00b0' };
export const decode = s => String(s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : m));
export const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const stripTags = s => decode(String(s).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
export const slugify = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

/* ---------- front matter: key: value lines; a value that opens with [ { or " is read as JSON, else as text ---------- */
export function frontMatter(src) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src); if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const k = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line); if (!k) continue; let v = k[2].trim();
    if (/^[[{"]/.test(v)) { try { v = JSON.parse(v); } catch { if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean); } }
    else if (/^'.*'$/.test(v)) v = v.slice(1, -1);
    else if (v === 'true') v = true; else if (v === 'false') v = false;
    meta[k[1]] = v;
  }
  return { meta, body: src.slice(m[0].length) };
}

/* ---------- inline Markdown: {html, text, links, marks} ---------- */
export function inline(md) {
  const links = [], images = [], marks = { bold: [] };
  let s = String(md), html = '';
  const re = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|`([^`]+)`|<[^>]+>|!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g; let last = 0, m;
  let text = '';
  while ((m = re.exec(s))) {
    if (m[1] != null && s[m.index - 1] === '!') continue;          /* an image: the next alternative takes it */
    const before = s.slice(last, m.index); html += esc(decode(before)); text += decode(before); last = m.index + m[0].length;
    if (m[8] != null) { images.push({ alt: m[7], src: m[8] }); html += `<img src="${esc(m[8])}" alt="${esc(m[7])}" loading="lazy" decoding="async">`; }
    else if (m[1] != null) { const a = inline(m[1]); links.push({ anchor: a.text, href: m[2] }); html += `<a href="${esc(m[2])}">${a.html}</a>`; text += a.text; }
    else if (m[3] != null || m[4] != null) { const b = inline(m[3] != null ? m[3] : m[4]); marks.bold.push({ text: b.text, at: text.length }); html += `<strong>${b.html}</strong>`; text += b.text; }
    else if (m[5] != null) { const b = inline(m[5]); html += `<em>${b.html}</em>`; text += b.text; }
    else if (m[6] != null) { html += `<code>${esc(m[6])}</code>`; text += m[6]; }
    else { const a = /^<a\b[^>]*href=["']([^"']+)["']/i.exec(m[0]); if (a) links.push({ anchor: '', href: a[1], rawHtml: true }); html += m[0]; }
  }
  html += esc(decode(s.slice(last))); text += decode(s.slice(last));
  return { html, text: text.replace(/\s+/g, ' ').trim(), links, images, marks };
}

/* ---------- Markdown to blocks ---------- */
export function parseMarkdown(src) {
  const { meta, body } = frontMatter(src); const blocks = []; const lines = body.split(/\r?\n/);
  let para = [], verbatim = false, fence = false;
  const flush = () => { if (!para.length) return; const raw = para.join(' ').trim(); para = []; if (!raw) return; const i = inline(raw); blocks.push({ type: verbatim ? 'verbatim' : (!i.text && i.images.length ? 'img' : 'p'), raw, text: i.text, html: i.html, links: i.links, images: i.images, marks: i.marks }); };
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    if (/^\s*(```|~~~)/.test(line)) { flush(); fence = !fence; continue; }
    if (fence) continue;
    if (/^\s*<!--\s*verbatim\s*-->\s*$/i.test(line)) { flush(); verbatim = true; continue; }
    if (/^\s*<!--\s*\/verbatim\s*-->\s*$/i.test(line)) { flush(); verbatim = false; continue; }
    if (/^\s*<!--.*-->\s*$/.test(line)) { flush(); continue; }
    if (!line.trim()) { flush(); continue; }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) { flush(); const i = inline(h[2]); blocks.push({ type: 'h' + h[1].length, raw: h[2], text: i.text, html: i.html, links: i.links, marks: i.marks }); continue; }
    const li = /^\s*(?:([-*+\u2022\u25e6\u25aa\u2023\u2043])|(\d{1,3})[.)])\s+(.*)$/.exec(line);
    if (li && !verbatim) { flush(); const i = inline(li[3]); blocks.push({ type: 'li', list: li[1] ? 'ul' : 'ol', marker: li[1] || li[2], raw: li[3], text: i.text, html: i.html, links: i.links, marks: i.marks }); continue; }
    if (/^\s*>/.test(line)) { flush(); const i = inline(line.replace(/^\s*>\s?/, '')); blocks.push({ type: 'quote', raw: line, text: i.text, html: i.html, links: i.links, marks: i.marks }); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); blocks.push({ type: 'hr', raw: line, text: '', html: '', links: [], marks: { bold: [] } }); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) { flush(); if (!/^\s*\|[\s:|-]+\|\s*$/.test(line)) { const i = inline(line.replace(/^\s*\||\|\s*$/g, '').replace(/\|/g, ' ')); blocks.push({ type: 'table', raw: line, text: i.text, html: i.html, links: i.links, marks: i.marks }); } continue; }
    para.push(line.trim());
  }
  flush();
  return finish({ format: 'markdown', meta, blocks, jsonld: [], src });
}

/* ---------- HTML to blocks ---------- */
export function parseHtml(src) {
  const jsonld = []; const meta = {};
  let s = String(src).replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, (m, j) => { jsonld.push(j.trim()); return ''; });
  s = s.replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const t = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(s); if (t) meta.title = stripTags(t[1]);
  const d = /<meta\b[^>]*name=["']description["'][^>]*>/i.exec(s); if (d) { const c = /content=["']([^"']*)["']/i.exec(d[0]); if (c) meta.description = decode(c[1]); }
  const c = /<link\b[^>]*rel=["']canonical["'][^>]*>/i.exec(s); if (c) { const hrefm = /href=["']([^"']*)["']/i.exec(c[0]); if (hrefm) meta.canonical = hrefm[1]; }
  const lists = { ul: (s.match(/<ul\b/gi) || []).length, ol: (s.match(/<ol\b/gi) || []).length, details: (s.match(/<details\b/gi) || []).length };
  const body = (/<body\b[^>]*>([\s\S]*)<\/body>/i.exec(s) || [null, s])[1].replace(/<(nav|header|footer|form)\b[\s\S]*?<\/\1>/gi, ' ');
  const blocks = []; const re = /<(h[1-6]|p|li|blockquote|summary|dt|dd|figcaption)\b([^>]*)>([\s\S]*?)<\/\1>/gi; let m;
  const olAt = []; { const r = /<(\/?)(ul|ol)\b/gi; let x; while ((x = r.exec(body))) olAt.push({ at: x.index, open: !x[1], kind: x[2].toLowerCase() }); }
  const listAt = at => { const st = []; for (const x of olAt) { if (x.at > at) break; if (x.open) st.push(x.kind); else st.pop(); } return st[st.length - 1] || 'ul'; };
  while ((m = re.exec(body))) {
    const tag = m[1].toLowerCase(), inner = m[3], text = stripTags(inner); if (!text) continue;
    const links = []; inner.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (x, href, a) => { links.push({ anchor: stripTags(a), href: decode(href) }); return x; });
    const bold = []; inner.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (x, tg, b) => { bold.push({ text: stripTags(b), at: stripTags(inner.slice(0, inner.indexOf(x))).length }); return x; });
    const verbatim = /\b(data-verbatim|class=["'][^"']*\b(legal|verbatim)\b)/i.test(m[2]);
    const type = verbatim ? 'verbatim' : tag === 'li' ? 'li' : tag === 'blockquote' ? 'quote' : /^h[1-6]$/.test(tag) ? tag : tag === 'summary' ? 'summary' : 'p';
    const b = { type, raw: inner, text, html: inner.trim(), links, marks: { bold } }; if (type === 'li') b.list = listAt(m.index);
    blocks.push(b);
  }
  return finish({ format: 'html', meta, blocks, jsonld, lists, src });
}

function finish(doc) {
  const B = doc.blocks; const h1 = B.find(b => b.type === 'h1');
  doc.h1 = h1 ? h1.text : '';
  doc.links = B.flatMap(b => b.links.map(l => Object.assign({ in: b.type }, l)));
  doc.images = B.flatMap(b => b.images || []);
  doc.headings = B.filter(b => /^h[1-6]$/.test(b.type)).map(b => ({ level: +b.type[1], text: b.text }));
  /* the lede: the paragraphs between the h1 and the first h2, the direct answer a search or AI result quotes */
  const i1 = B.findIndex(b => b.type === 'h1'), i2 = B.findIndex((b, i) => i > i1 && /^h[2-6]$/.test(b.type));
  doc.lede = B.slice(i1 + 1, i2 === -1 ? B.length : i2).filter(b => b.type === 'p').map(b => b.text);
  doc.prose = B.filter(b => b.type === 'p' || b.type === 'li' || b.type === 'quote').map(b => b.text).join('\n');
  doc.words = (doc.prose.match(/[A-Za-z0-9][A-Za-z0-9'\u2019-]*/g) || []).length;
  return doc;
}

export function parse(src, file = '') { return /\.html?$/i.test(file) || /^\s*<(!doctype|html|body|main|article|section|div|h1)\b/i.test(src) ? parseHtml(src) : parseMarkdown(src); }

/* ---------- blocks to HTML ---------- */
/* the page body: semantic HTML with the first lede paragraph marked as the answer (the speakable selector points at it) */
export function renderBody(doc) {
  const out = []; let list = null, answered = false, seenH1 = false, section = false;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const b of doc.blocks) {
    if (b.type !== 'li') close();
    if (b.type === 'h1') { out.push(`<h1>${b.html}</h1>`); seenH1 = true; }
    else if (/^h[2-6]$/.test(b.type)) { if (b.type === 'h2') { if (section) out.push('</section>'); out.push(`<section id="${slugify(b.text)}">`); section = true; } out.push(`<${b.type}>${b.html}</${b.type}>`); }
    else if (b.type === 'p') { if (seenH1 && !section && !answered) { out.push(`<p class="answer forge-answer">${b.html}</p>`); answered = true; } else out.push(`<p>${b.html}</p>`); }
    else if (b.type === 'verbatim') out.push(`<p class="legal" data-verbatim>${b.html}</p>`);
    else if (b.type === 'img') out.push(`<figure>${b.html}</figure>`);
    else if (b.type === 'li') { if (list !== b.list) { close(); out.push(`<${b.list}>`); list = b.list; } out.push(`<li>${b.html}</li>`); }
    else if (b.type === 'quote') out.push(`<blockquote><p>${b.html}</p></blockquote>`);
    else if (b.type === 'table') out.push(`<p>${b.html}</p>`);
  }
  close(); if (section) out.push('</section>');
  return out.join('\n');
}

/* a whole document around the body: title, description, canonical, the JSON-LD graph in the head */
export function renderPage(doc, { schema, url, lang = 'en-US', noindex = false } = {}) {
  const m = doc.meta, ld = schema ? `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>` : '';
  return `<!DOCTYPE html>
<html lang="${esc(lang.slice(0, 2))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(m.title || doc.h1)}</title>
<meta name="description" content="${esc(m.description || '')}">
${url ? `<link rel="canonical" href="${esc(url)}">\n` : ''}${noindex ? '<meta name="robots" content="noindex">\n' : ''}${ld}
</head>
<body>
<main>
${renderBody(doc)}
</main>
</body>
</html>
`;
}
