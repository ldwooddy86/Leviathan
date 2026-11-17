/* The manufacturers a page or an ad names, held against the client's own site.

   A page that says "we repair Trane, Lennox and Goodman" is a claim about what the company works on, and the place to
   check it is the company's own site. The content strategist reads the site's sitemap into an inventory; this reads that
   inventory for every manufacturer and sorts what it finds:

     page      the site has a page of its own that names the make: a service page, a product page, a case study, a
               gallery. That shows the company works with it.
     article   the make turns up only in blog posts. A post about a maker's award shows the site wrote about it, not
               that the company services it.
     (nothing) the sitemap does not show the make at all.

   A make may be named in copy when the brand file vouches for it (a dealer credential the dashboard holds, or the
   brand file's `makes` list, which the owner fills) or when the site shows it on a page of its own. Anything else is
   an error at the gate: ask the owner, and add the make to the brand file's `makes` if they service it.

   A sitemap lists addresses, not what a page says. A make the site names only inside a page's text is not seen here,
   which is what the brand file's `makes` list is for. */

import fs from 'node:fs';
import path from 'node:path';
import { CS_LOCAL } from './paths.mjs';

/* The client's site as the content strategist last read its sitemap: {file, ageHours, pages: [{path, kind, key}]}, or
   null when it has not been read on this machine. */
export function siteOf(brand, dir = path.join(CS_LOCAL, 'sitemap')) {
  if (!brand || !brand.url) return null;
  let host = ''; try { host = new URL(brand.url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
  const f = path.join(dir, host + '.json'); if (!fs.existsSync(f)) return null;
  try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return { file: f, ageHours: Math.max(0, Math.round((Date.now() - Date.parse(j.fetched)) / 36e5)), pages: (j.pages || []).map(p => ({ path: p.path || '', kind: p.kind || '', key: p.key || '' })) }; } catch { return null; }
}

/* HVAC equipment makers a contractor's copy is likely to name. `slug` is how the make reads in a page address; `also`
   are other ways copy writes it. */
export const MAKES = [
  { name: 'Carrier', slug: ['carrier'] },
  { name: 'Mitsubishi Electric', slug: ['mitsubishi'], also: ['Mitsubishi'] },
  { name: 'Trane', slug: ['trane'] },
  { name: 'American Standard', slug: ['american-standard', 'americanstandard'] },
  { name: 'Lennox', slug: ['lennox'] },
  { name: 'Goodman', slug: ['goodman'] },
  { name: 'Amana', slug: ['amana'] },
  { name: 'Daikin', slug: ['daikin'] },
  { name: 'Rheem', slug: ['rheem'] },
  { name: 'Ruud', slug: ['ruud'] },
  { name: 'York', slug: ['york'], strict: true },
  { name: 'Bryant', slug: ['bryant'], strict: true },
  { name: 'Payne', slug: ['payne'], strict: true },
  { name: 'Heil', slug: ['heil'] },
  { name: 'Tempstar', slug: ['tempstar'] },
  { name: 'Comfortmaker', slug: ['comfortmaker'] },
  { name: 'Coleman', slug: ['coleman'], strict: true },
  { name: 'Luxaire', slug: ['luxaire'] },
  { name: 'Armstrong Air', slug: ['armstrong-air', 'armstrong'], strict: true },
  { name: 'Ducane', slug: ['ducane'] },
  { name: 'Maytag', slug: ['maytag'] },
  { name: 'Frigidaire', slug: ['frigidaire'] },
  { name: 'Nordyne', slug: ['nordyne'] },
  { name: 'Fujitsu', slug: ['fujitsu'] },
  { name: 'LG', slug: ['lg'], strict: true },
  { name: 'Gree', slug: ['gree'], strict: true },
  { name: 'Samsung', slug: ['samsung'] },
  { name: 'Panasonic', slug: ['panasonic'] },
  { name: 'Bosch', slug: ['bosch'] },
  { name: 'Navien', slug: ['navien'] },
  { name: 'Weil McLain', slug: ['weil-mclain', 'weilmclain'], also: ['Weil-McLain'] },
  { name: 'Burnham', slug: ['burnham'] },
  { name: 'Lochinvar', slug: ['lochinvar'] },
  { name: 'WaterFurnace', slug: ['waterfurnace'] },
  { name: 'ClimateMaster', slug: ['climatemaster'] },
  { name: 'Rinnai', slug: ['rinnai'] },
];
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const spellings = m => [m.name, ...(m.also || [])];

/* The makes a text names, each once, in the order met. Copy writes a maker's name with its capital, and several makes
   are also plain words or other names (a carrier, New York, Coleman Street), so the match keeps the capital, and a make
   marked strict must also stand near a trade word (a furnace, a repair). `loose` is for keywords, which people type in
   lower case. */
const TRADE = /\b(?:furnace|heat pump|heater|heating|air condition\w*|a\/?c|hvac|mini split|ductless|unit|system|repair|service|install\w*|dealer|parts?|thermostat|boiler|compressor|condenser|coil)\b/i;
export function makesIn(text, { loose = false } = {}) {
  const t = String(text || ''), out = [];
  for (const m of MAKES) {
    let hit = null;
    for (const s of spellings(m)) {
      const words = esc(s).replace(/\\ |\\-|[ -]/g, '[ -]?');
      const re = loose ? new RegExp('(^|[^a-z0-9])' + words + '($|[^a-z0-9])', 'i') : new RegExp('(^|[^A-Za-z0-9])' + words + '($|[^A-Za-z0-9])');
      const x = re.exec(t); if (!x) continue;
      if (m.strict && !TRADE.test(loose ? t : t.slice(Math.max(0, x.index - 200), x.index + 200))) continue;
      if (!loose && m.name === 'York' && /New\s+$/.test(t.slice(0, x.index + x[1].length))) continue;
      hit = { at: x.index + x[1].length, said: t.slice(x.index + x[1].length, x.index + x[0].length - x[2].length) }; break;
    }
    if (hit) out.push({ make: m.name, said: hit.said, at: hit.at });
  }
  return out.sort((a, b) => a.at - b.at);
}

/* a page address as words: "/case-studies/carrier-infinity-systems/" -> ["case", "studies", "carrier", ...] */
const pathWords = p => String(p || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const hasRun = (words, run) => { for (let i = 0; i + run.length <= words.length; i++) if (run.every((w, j) => words[i + j] === w)) return true; return false; };
/* is this inventory page an article? A case study or a gallery is filed as a post or as media, and is not one. */
const isArticle = p => (p.kind === 'post' || p.kind === 'taxonomy') && !/^\/(?:case-studies?|projects?|portfolio|gallery|rl_gallery|our-work)\//.test(String(p.path || ''));

/* What the site shows for every make: {make: {grade: 'page' | 'article', pages: [path], articles: [path]}}. `pages` is
   the sitemap inventory's page list (each {path, kind}). */
export function makesOnSite(pages) {
  const out = {};
  for (const p of pages || []) {
    const w = pathWords(p.path); if (!w.length) continue;
    for (const m of MAKES) {
      if (!m.slug.some(s => hasRun(w, s.split('-')))) continue;
      const e = out[m.name] || (out[m.name] = { grade: 'article', pages: [], articles: [] });
      if (isArticle(p)) { if (!e.articles.includes(p.path)) e.articles.push(p.path); } else { if (!e.pages.includes(p.path)) e.pages.push(p.path); e.grade = 'page'; }
    }
  }
  return out;
}

/* the makes the brand file vouches for: the dealer credentials the dashboard holds, and the owner's own list */
export function makesVouched(brand) {
  const b = brand || {}, creds = [].concat(b.dealer || [], (b.proof && b.proof.dealer) || []).map(String), own = [].concat(b.makes || []).map(String), out = {};
  for (const m of MAKES) {
    const named = list => list.find(s => spellings(m).some(x => new RegExp('(^|[^a-z0-9])' + esc(x).replace(/\\ |[ -]/g, '[ -]?') + '($|[^a-z0-9])', 'i').test(s)));
    const c = named(creds), o = named(own);
    if (c) out[m.name] = { by: 'dealer credential', said: c }; else if (o) out[m.name] = { by: 'the owner\'s list', said: o };
  }
  return out;
}

/* One line a person can read for each make that matters: what the brand file says and what the site shows.
   site: {pages: [{path, kind}], ageHours} or null when the sitemap has not been read. */
export function makesReport({ brand = null, site = null } = {}) {
  const on = site ? makesOnSite(site.pages) : {}, v = makesVouched(brand), rows = [];
  for (const m of MAKES) {
    const s = on[m.name], b = v[m.name]; if (!s && !b) continue;
    rows.push({ make: m.name, ok: !!b || (!!s && s.grade === 'page'), vouched: b || null, grade: s ? s.grade : '', pages: s ? s.pages : [], articles: s ? s.articles : [] });
  }
  return { rows, siteRead: !!site, ageHours: site ? site.ageHours : null, pageCount: site ? (site.pages || []).length : 0 };
}

/* The gate's check. Returns findings {severity, rule: 'make', make, message, excerpt} for every make the text names
   that neither the brand file nor a page of the site stands behind. */
export function checkMakes(text, { brand = null, site = null, loose = false, where = '' } = {}) {
  const named = makesIn(text, { loose }); if (!named.length) return [];
  const on = site ? makesOnSite(site.pages) : {}, v = makesVouched(brand), F = [];
  const read = site ? `the sitemap as read ${site.ageHours} hour${site.ageHours === 1 ? '' : 's'} ago (${(site.pages || []).length} addresses)` : '';
  for (const n of named) {
    if (v[n.make]) continue;
    const s = on[n.make]; if (s && s.grade === 'page') continue;
    const at = String(text).slice(Math.max(0, n.at - 40), n.at + n.said.length + 40).replace(/\s+/g, ' ').trim();
    let message;
    if (!site) message = `${where ? where + ' names' : 'Names'} ${n.make}, and the client's sitemap has not been read on this machine, so nothing shows the company works on it. Read the sitemap first (the content strategist's sitemap command), or have the owner vouch for it in the brand file's makes list.`;
    else if (s) message = `${where ? where + ' names' : 'Names'} ${n.make}, which the client's site shows only in articles (${s.articles.slice(0, 3).join(', ')}). An article about a maker does not show the company services it. Cut the name, or ask the owner and add it to the brand file's makes list.`;
    else message = `${where ? where + ' names' : 'Names'} ${n.make}, and nothing in ${read} shows the company works on it; the brand file does not vouch for it either. Cut the name, or ask the owner and add it to the brand file's makes list.`;
    F.push({ severity: 'error', rule: 'make', make: n.make, message, excerpt: at });
  }
  return F;
}
