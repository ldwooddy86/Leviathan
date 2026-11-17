/* The gate a page or a post passes before it leaves: reading grade, passive voice, the tropes, the page's own search
   basics (title, one h1, the opening answer, the keyword, internal links that are live and well anchored) and the
   vertical's advertising rules. An error fails the gate; a warning is the writer's call; a note is for the record. */
import { grade, hardest, words } from './readability.mjs';
import { passives } from './passive.mjs';
import { tropes, phrases } from './tropes.mjs';
import { voice } from './voice.mjs';
import { covers, key, tokens, norm } from './terms.mjs';
import { checkMakes } from '../../dashboard-link/lib/makes.mjs';
import { check as checkReviews } from '../../dashboard-link/lib/reviews.mjs';

export const LIMITS = { grade: 9, floor: 6, title: 60, h1: 70, descMin: 120, descMax: 158, lede: 80, sentence: 30, minLinks: { landing: 2, blog: 3, page: 3 }, minWords: { landing: 300, blog: 600, page: 400 } };
const GENERIC = /^(?:click here|here|learn more|read more|more|this page|this link|this|link|website|our website|page|find out more|see more|details|more info|more information|check it out|go here|visit)$/i;
const SEV = { block: 'error', warn: 'warn', note: 'note' };

/* a dollar amount, a percentage, or a count written with a thousands comma: the kinds of number a page must be able to source */
const FIGURE = /\$\s?\d+(?:,\d{3})*(?:\.\d+)?|\b\d+(?:\.\d+)?\s?%|\b\d{1,3}(?:,\d{3})+\b/g;
/* The figures a pack vouches for: every number in the market's facts and in the page's city's facts, and the ZIP figures
   behind the city's heatmaps. A figure on the page is backed when it is one of those, or one of them rounded the way a
   person would say it: a count or a dollar amount within 6 in 100 of a vouched one, a percentage within a point of a
   vouched one, or to the nearest five. */
function vouched(pack, city) {
  const exact = new Set(), counts = [], pcts = [], num = s => parseFloat(String(s).replace(/[$,%\s]/g, '')), add = s => (String(s == null ? '' : s).match(/\d[\d,]*(?:\.\d+)?/g) || []).forEach(x => exact.add(x.replace(/,/g, '')));
  for (const f of [...((pack.market && pack.market.facts) || []), ...((city && city.facts) || [])]) {
    add(f.value); add(f.label); add(f.say); const v = String(f.value), x = num(v); if (!Number.isFinite(x)) continue;
    if (/%$/.test(v)) pcts.push(x); else if (/,|^\$/.test(v) || (x >= 100 && !/^\d{4}$/.test(v))) counts.push(x);
    for (const m of String(f.label).match(/\b\d{1,3}(?:,\d{3})+\b/g) || []) counts.push(num(m));
  }
  for (const v of Object.values((city && city.own) || {})) { add(v); pcts.push(v); }
  for (const a of (city && city.areas) || []) { add(a.builtAround); for (const [k, v] of Object.entries(a.values || {})) { add(v); if (!/^(idx|hail)/.test(k)) pcts.push(v); } }
  return { exact, counts, pcts };
}
function backed(fig, known) {
  const raw = fig.replace(/[$,%\s]/g, ''); if (known.exact.has(raw)) return true;
  const x = parseFloat(raw); if (!Number.isFinite(x)) return false;
  if (/%/.test(fig)) return known.pcts.some(v => Math.abs(x - v) < 1 || (x % 5 === 0 && Math.abs(x - v) <= 2.5));
  return known.counts.some(v => Math.abs(x - v) <= 0.06 * v);
}

/* a URL as the inventory keys it: host without www, path without a trailing slash, no query or fragment */
export function urlKey(u, base) {
  try { const x = new URL(u, base || 'https://example.invalid'); return x.hostname.replace(/^www\./, '').toLowerCase() + (x.pathname.replace(/\/+$/, '') || '/').toLowerCase(); } catch { return String(u).toLowerCase(); }
}
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

/* lint(doc, options): options are {type, keyword, slug, url, site, allow, maxGrade, pack, brand, live (a Set of urlKeys), avoid,
   inventory (the client's site as its sitemap was read: {pages, ageHours}, or null when it was not; pass it and every
   manufacturer the page names is held against it), reviews (the review figure in force, or null; pass it and every
   review claim is held against it)} */
export function lint(doc, o = {}) {
  const F = [], add = (rule, severity, message, excerpt = '', fix = '') => F.push(fix ? { rule, severity, message, excerpt, fix } : { rule, severity, message, excerpt });
  const m = doc.meta || {}, type = o.type || m.type || 'page', social = type === 'social', keyword = o.keyword || m.keyword || '';
  const site = o.site || (o.brand && o.brand.url) || '', domain = site ? hostOf(site) : (o.brand && o.brand.domain) || '';
  const body = doc.blocks.filter(b => b.type !== 'verbatim');
  const text = body.map(b => b.text).join('\n');
  const max = o.maxGrade != null ? o.maxGrade : LIMITS.grade;

  /* how it reads */
  /* a post's license tag and hashtags are not sentences */
  const stats = grade(social ? doc.prose.replace(/(^|\s)#[A-Za-z]\w*/g, ' ').replace(/\b(?:TDLR\s+)?(?:Lic(?:ense)?\.?\s+)?TAC\s?L\s?[A-Z]\s?\d{4,}[A-Z]?\b\.?/gi, ' ') : doc.prose);
  if (stats.words >= 30 && stats.grade > max) add('reading-grade', 'error', `Reading grade ${stats.grade} (Flesch-Kincaid); the ceiling is ${max}. Split the sentences below and trade long words for short ones.`, hardest(stats, 5, max).map(s => `[grade ${s.grade}, ${s.words} words] ${s.text}`).join('\n'));
  else if (stats.words >= 120 && stats.grade < LIMITS.floor) add('reading-grade', 'warn', `Reading grade ${stats.grade} is under the ${LIMITS.floor} to ${max} target. Join a few short sentences so the page does not read choppy.`);
  for (const s of stats.per.filter(s => s.words > LIMITS.sentence).slice(0, 4)) add('long-sentence', 'warn', `A ${s.words} word sentence. Split it.`, s.text);
  const P = passives(text);
  for (const p of P.slice(0, 25)) add('passive', 'error', `Passive voice: "${p.phrase}". Name who does it and lead with them.`, p.sentence, p.hint || '');
  if (P.length > 25) add('passive', 'error', `${P.length - 25} more passive constructions.`, '');
  F.push(...tropes(doc));
  F.push(...voice(doc, { social, brand: o.brand }));

  if (!social) {
    /* what the page says it is */
    const title = String(m.title || ''), desc = String(m.description || ''), slug = String(o.slug || m.slug || '');
    if (!title) add('title', 'error', 'No title. Add `title:` to the front matter, 60 characters or fewer.');
    else if (title.length > LIMITS.title) add('title', 'warn', `The title is ${title.length} characters; aim for ${LIMITS.title} or fewer.`, title);
    if (!desc) add('description', 'error', `No meta description. Add \`description:\` to the front matter, ${LIMITS.descMin} to ${LIMITS.descMax} characters.`);
    else if (desc.length < LIMITS.descMin || desc.length > LIMITS.descMax) add('description', 'warn', `The meta description is ${desc.length} characters; aim for ${LIMITS.descMin} to ${LIMITS.descMax}.`, desc);
    F.push(...phrases(title, 'title'), ...phrases(desc, 'meta description'));
    const h1 = doc.headings.filter(h => h.level === 1);
    if (h1.length !== 1) add('h1', 'error', `The page has ${h1.length} h1 headings. It needs exactly one.`);
    else if (h1[0].text.length > LIMITS.h1) add('h1', 'warn', `The h1 is ${h1[0].text.length} characters; aim for ${LIMITS.h1} or fewer.`, h1[0].text);
    for (let i = 1; i < doc.headings.length; i++) if (doc.headings[i].level > doc.headings[i - 1].level + 1) { add('heading-order', 'warn', `Heading level jumps from h${doc.headings[i - 1].level} to h${doc.headings[i].level}.`, doc.headings[i].text); break; }
    if (!doc.lede.length) add('answer', 'error', 'No opening answer. Put two to four sentences between the h1 and the first h2 that answer the search outright; search and AI results quote that paragraph.');
    else { const n = words(doc.lede[0]).length; if (n > LIMITS.lede) add('answer', 'warn', `The opening answer runs ${n} words. Keep the first paragraph under ${LIMITS.lede} so a result can quote it whole.`, doc.lede[0].slice(0, 140)); }
    const cityName = String(m.city || '').toLowerCase(), h2 = doc.headings.filter(h => h.level === 2);
    if (cityName && h2.length >= 3 && h2.filter(h => h.text.toLowerCase().includes(cityName)).length < 2) add('heading-place', 'warn', `Fewer than two h2 headings name ${m.city}. On a page for one place, let the section headings say the service and the place ("Heat pump repair in ${m.city}").`);
    if (LIMITS.minWords[type] && doc.words < LIMITS.minWords[type]) add('length', 'warn', `${doc.words} words. A ${type} page here runs ${LIMITS.minWords[type]} or more.`);
    for (const im of doc.images || []) if (!String(im.alt || '').trim()) add('alt-text', 'warn', 'An image has no alt text. Describe what the photo shows.', im.src);

    /* the keyword the page is for */
    if (keyword) {
      const inTitle = covers(title, keyword), inH1 = covers(doc.h1, keyword);
      if (!inTitle && !inH1) add('keyword', 'error', `Neither the title nor the h1 carries the primary keyword "${keyword}".`);
      else { if (!inTitle) add('keyword', 'warn', `The title does not carry "${keyword}".`, title); if (!inH1) add('keyword', 'warn', `The h1 does not carry "${keyword}".`, doc.h1); }
      if (doc.lede.length && !covers(doc.lede.join(' '), keyword)) add('keyword', 'warn', `The opening answer does not carry "${keyword}".`);
      if (desc && !covers(desc, keyword)) add('keyword', 'warn', `The meta description does not carry "${keyword}".`);
      if (slug && !covers(slug.replace(/-/g, ' '), keyword)) add('keyword', 'note', `The slug "${slug}" does not carry every word of "${keyword}".`);
      const k = norm(keyword).trim(), hits = k ? norm(text).split(k).length - 1 : 0, dens = doc.words ? 100 * hits * k.split(/\s+/).length / doc.words : 0;
      if (hits > 3 && dens > 2.5) add('keyword-stuffing', 'warn', `"${keyword}" appears ${hits} times, ${dens.toFixed(1)}% of the words. Use it where it reads naturally and vary the phrasing.`);
      for (const a of o.avoid || []) if (a.keyword && key(a.keyword) === key(keyword) && (!a.url || !o.url || urlKey(a.url) !== urlKey(o.url)))
        add('cannibalization', 'error', `"${keyword}" already belongs to ${a.url || 'another page'}. Improve that page or pick a keyword it does not hold.`);
    }

    /* where it links */
    const self = o.url ? urlKey(o.url) : '';
    const internal = doc.links.filter(l => /^\//.test(l.href) || (domain && hostOf(l.href) === domain) || (!/^[a-z][a-z0-9+.-]*:/i.test(l.href) && !l.href.startsWith('#')));
    const want = LIMITS.minLinks[type] || 2;
    if (!internal.length) add('internal-links', 'error', 'No internal links. Run `links` for this keyword and link to live pages from the sitemap.');
    else if (internal.length < want) add('internal-links', 'warn', `${internal.length} internal link${internal.length === 1 ? '' : 's'}; a ${type} page here carries ${want} or more.`);
    const byAnchor = new Map(), kk = keyword ? key(keyword) : '';
    for (const l of internal) {
      const a = String(l.anchor || '').trim(), u = urlKey(l.href, site || undefined);
      if (!a) add('anchor', 'error', `A link to ${l.href} has no anchor text.`);
      else if (GENERIC.test(a)) add('anchor', 'error', `Generic anchor "${a}". Name what the linked page is about.`, l.href);
      else if (kk && key(a) === kk && u !== self) add('anchor-own-keyword', 'error', `The anchor "${a}" is this page's own keyword, pointed at another page. That tells search the other page should rank for it.`, l.href);
      if (o.live && u !== self && !o.live.has(u)) add('dead-link', 'error', `${l.href} is not in the sitemap. Link only to live URLs.`, a);
      if (a) { const k2 = norm(a); if (byAnchor.has(k2) && byAnchor.get(k2) !== u) add('anchor', 'warn', `The anchor "${a}" points at two different pages.`, l.href); byAnchor.set(k2, u); }
    }
    if (!(doc.jsonld || []).length && doc.format === 'html' && o.expectSchema) add('schema', 'error', 'No JSON-LD in the page.');
  }

  /* what the page claims about its angle, its city and its numbers */
  if (o.pack && !social) {
    const pk = o.pack, angle = m.angle ? (pk.angles || []).find(a => a.id === m.angle) : null;
    if (m.angle && !angle) add('angle', 'error', `The front matter names the angle "${m.angle}", which the ${pk.id} pack does not have. See: keywords ${pk.id}`);
    const city = m.city && pk.cities ? pk.cities.find(c => c.name.toLowerCase() === String(m.city).toLowerCase()) : null;
    if (m.city && pk.cities && !city) add('city', 'warn', `"${m.city}" is not a city in the ${pk.id} pack, so the atlas has no facts and no demand read for it.`);
    if (city && angle && !city.angles.some(x => x.id === angle.id)) add('demand', 'warn', `The atlas finds no demand trigger for "${angle.label}" in ${city.name}${angle.why ? ` (its trigger: ${angle.why.replace(/\.$/, '')})` : ''}. Say so in the hand back and let the person decide whether the page is worth building.`);
    const known = vouched(pk, city), odd = [...new Set((text.match(FIGURE) || []).map(x => x.trim()).filter(x => !backed(x, known)))];
    if (odd.length) add('figure', 'warn', `${odd.length === 1 ? 'A figure' : 'Figures'} the atlas does not vouch for: ${odd.slice(0, 8).join(', ')}. Each needs a source from the person, or cut it.`);
  }

  /* the vertical's advertising rules */
  const C = o.pack && o.pack.compliance, lic = o.brand && o.brand.license, everything = doc.blocks.map(b => b.text).join('\n');
  if (C) {
    if (C.licenseInEveryAsset && !((lic && everything.includes(lic)) || (C.licensePattern && new RegExp(C.licensePattern, 'i').test(everything)))) {
      const rule = (C.rules || []).find(r => r.id === 'TDLR1'), cite = rule ? ` (${rule.cite})` : '';
      if (social) add('license', 'error', `The license number is missing. Every ad and post carries it${cite}.`, '', lic ? `Add "${o.pack.licenseLabel || ''} Lic ${lic}".`.replace('" Lic', '"Lic') : 'Set the license in the brand file.');
      else add('license', 'warn', `The license number is not in the page copy${cite}. Fine when the site footer prints it on every page; otherwise add it.`);
    }
    for (const r of C.rules || []) {
      const t = r.test; if (!t || (t.scope === 'social' && !social)) continue;
      const re = new RegExp(t.pattern, 'i'), un = t.unless ? new RegExp(t.unless, 'i') : null; let hit = null;
      if (t.per === 'sentence') { const s = text.split(/(?<=[.!?])\s+/).find(x => re.test(x) && !(un && un.test(x))); if (s) hit = s; }
      else { const x = re.exec(text); if (x && !(un && un.test(everything))) hit = x[0]; }
      if (hit) add('rule:' + r.id, SEV[r.severity] || 'note', `${r.name} (${r.enforcer}; ${r.cite}).`, String(hit).trim().slice(0, 160), r.fix || '');
    }
  }

  /* what the page claims about the company: the makers it names, and its review score */
  const claimed = [m.title, m.description, doc.h1, text].filter(Boolean).join('\n');
  for (const k of o.unfilled || []) add('reviews', 'error', `The page carries {reviews.${k}} and the review figure on file cannot fill it. Run the reviews command to see what is on file.`);
  if ('inventory' in o) for (const f of checkMakes(claimed, { brand: o.brand || null, site: o.inventory || null })) add('make', f.severity, f.message, f.excerpt);
  if ('reviews' in o) for (const f of checkReviews(claimed, o.reviews || null)) add('reviews', f.severity, f.message, f.excerpt);
  const allow = new Set(o.allow || []), kept = F.filter(f => !allow.has(f.rule)), count = s => kept.filter(f => f.severity === s).length;
  return { ok: count('error') === 0, type, keyword, stats: { grade: stats.grade, ease: stats.ease, words: doc.words, sentences: stats.sentences, wordsPerSentence: stats.wordsPerSentence, passive: P.length }, counts: { error: count('error'), warn: count('warn'), note: count('note') }, allowed: [...allow], findings: kept };
}

/* a lint result as text */
export function report(r, name = '') {
  const L = [`${r.ok ? 'PASS' : 'FAIL'}${name ? '  ' + name : ''}  ·  grade ${r.stats.grade} (ceiling ${LIMITS.grade})  ·  ${r.stats.words} words, ${r.stats.wordsPerSentence} a sentence  ·  passive ${r.stats.passive}  ·  ${r.counts.error} error${r.counts.error === 1 ? '' : 's'}, ${r.counts.warn} warning${r.counts.warn === 1 ? '' : 's'}, ${r.counts.note} note${r.counts.note === 1 ? '' : 's'}`];
  for (const sev of ['error', 'warn', 'note']) for (const f of r.findings.filter(x => x.severity === sev)) {
    L.push(`${sev === 'error' ? 'ERROR' : sev === 'warn' ? 'warn ' : 'note '}  [${f.rule}] ${f.message}`);
    if (f.excerpt) for (const line of String(f.excerpt).split('\n')) L.push('         > ' + line);
    if (f.fix) L.push('         fix: ' + f.fix);
  }
  return L.join('\n');
}
