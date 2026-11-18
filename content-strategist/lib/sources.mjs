/* Where a page's figures come from, as links a reader can open.

   A page that says "Census figures show two in three homes here heat with gas" owes the reader the table. This file
   knows which public page stands behind each source the copy names in plain words, builds the address for the place the
   sentence is about, and writes the link around the words that name the source. A link out of the site opens in another
   tab (doc.mjs renders it so), and the gate fails a page that names a source and links nothing.

   Only a named source gets a link. "By one estimate" names none: the dashboard worked that figure out itself, and no
   public page shows it, so there is nothing honest to point at.

   For the Census the link goes to the table that holds the figure, for the very place the sentence names: the city, any
   ZIP codes named beside it, or the metro when the page has no city. Which table depends on what the sentence says, so
   the sentence is read: what homes heat with (B25040), the year the typical home went up (B25035), how many went up in
   which years (B25034), when owners moved in (B25038). These are the tables the dashboard's own layers name. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), PACKS = path.join(HERE, '..', 'verticals');
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

/* ---------- the Census: one address for a table and the places it should show ---------- */
export const CENSUS = { base: 'https://data.census.gov/table/', host: 'data.census.gov', survey: 'ACSDT5Y2024', label: 'American Community Survey, 2020 to 2024' };
/* Asked in this order of the clause that makes the claim: a clause about who moved in is not about fuel, and "the
   typical home went up in 1993" is the median year, not the count by decade. */
export const TOPICS = [
  { id: 'movedIn', table: 'B25038', title: 'Tenure by Year Householder Moved Into Unit', find: /\bmoved in\b/i },
  { id: 'fuel', table: 'B25040', title: 'House Heating Fuel', find: /\b(?:natural gas|gas|propane|electric(?:ity)?|power|heat(?:s|ed)? with)\b/i },
  { id: 'medianYear', table: 'B25035', title: 'Median Year Structure Built', find: /\b(?:typical(?:ly)?|median)\b/i },
  { id: 'yearBuilt', table: 'B25034', title: 'Year Structure Built', find: /\b(?:went up|built|dates? (?:to|from)|(?:before|since|after) (?:19|20)\d\d|(?:19|20)\d0s|or later)\b/i },
];
export const topic = id => TOPICS.find(t => t.id === id) || null;
/* place codes are seven digits (state and place), ZIP codes five; several of a kind share one prefix, kinds join with _ */
export function censusUrl(table, { places = [], zips = [], metro = '' } = {}, survey = CENSUS.survey) {
  const g = []; if (places.length) g.push('160XX00US' + places.join(',')); if (zips.length) g.push('860XX00US' + zips.join(',')); if (!g.length && metro) g.push(metro);
  if (!g.length) return '';
  return `${CENSUS.base}${survey}.${table}?g=${g.join('_')}`;
}

/* the Census Bureau's code for each city of a pack, and the metro (verticals/<pack>.places.json) */
export function loadPlaces(packId) {
  const f = path.join(PACKS, `${packId}.places.json`); if (!packId || !fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

/* ---------- the sources a page may name, in the plain words the writer uses ---------- */
const EPA = [
  { find: /\bR ?22\b|HCFC|\b2020\b|stopped (?:producing|making)|out of production|ended\b.*\bproduction/i, url: 'https://www.epa.gov/ods-phaseout/phaseout-class-ii-ozone-depleting-substances', title: 'Phaseout of Class II Ozone-Depleting Substances' },
  { find: /\b2025\b|\bA2L\b|\bR ?454B\b|\bR ?32\b|\bR ?410A\b|newer (?:type of )?refrigerant/i, url: 'https://www.epa.gov/hfcs/technology-transitions-hfc-restrictions-sector', title: 'Technology Transitions: HFC Restrictions by Sector' },
];
export const SOURCES = [
  { id: 'acs', says: 'Census figures', name: 'U.S. Census Bureau, ' + CENSUS.label, host: CENSUS.host, find: /\bCensus (?:Bureau )?(?:figures|data|numbers|counts|tables?)\b/g },
  { id: 'recs', says: 'federal energy surveys', name: 'U.S. Energy Information Administration, Residential Energy Consumption Survey 2020', host: 'eia.gov', find: /\bfederal energy surveys?\b/gi,
    url: 'https://www.eia.gov/consumption/residential/data/2020/', title: 'Residential Energy Consumption Survey, 2020 data' },
  { id: 'storm', says: 'storm reports', name: 'NOAA National Centers for Environmental Information, Storm Events Database', host: 'ncei.noaa.gov', find: /\bstorm reports\b/gi,
    url: 'https://www.ncei.noaa.gov/access/storm-events-database/', title: 'Storm Events Database' },
  { id: 'epa', says: 'EPA rules', name: 'U.S. Environmental Protection Agency', host: 'epa.gov', find: /\bEPA rules?\b/g, pick: EPA },
];
const hostIs = (href, host) => { const h = hostOf(href); return h === host || h.endsWith('.' + host); };

/* ---------- reading a sentence ---------- */
const LINK = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
/* the same line with every Markdown link reduced to its words, at the same positions, so a web address never reads as copy */
const maskLinks = line => line.replace(LINK, (m, t) => ' ' + t + ' '.repeat(m.length - t.length - 1)).replace(/<a\b[^>]*>|<\/a>/gi, m => ' '.repeat(m.length));
const linkSpans = line => { const out = []; let m; const re = new RegExp(LINK.source, 'g'); while ((m = re.exec(line))) out.push([m.index, m.index + m[0].length, m[2]]); const ra = /<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi; while ((m = ra.exec(line))) out.push([m.index, m.index + m[0].length, m[1]]); return out; };
const sentenceAt = (text, at) => { const cuts = [0]; const re = /[.!?]["')\]]?\s+(?=[A-Z0-9"'(\[])/g; let m; while ((m = re.exec(text))) cuts.push(m.index + m[0].length); cuts.push(text.length); let i = 0; while (i < cuts.length - 2 && cuts[i + 1] <= at) i++; return { start: cuts[i], end: cuts[i + 1], prev: i > 0 ? text.slice(cuts[i - 1], cuts[i]) : '' }; };
const BOUND = /,\s+(?:and|but|so|while|yet|which)\b|;\s+/g;
const LEADS = /^\s*(?:(?:going by|according to|by|per|from|in|under|look at|as)\s+)?(?:the\s+)?(?:same\s+)?$/i;
/* the part of the sentence that makes the claim: what follows the source when it opens its clause ("Census figures
   show ..."), what comes before when it closes one ("..., going by Census figures"). Then the rest of the sentence. */
function claimParts(sentence, from, to) {
  let a = 0, b = sentence.length, m; const re = new RegExp(BOUND.source, 'g');
  while ((m = re.exec(sentence))) { if (m.index + m[0].length <= from) a = m.index + m[0].length; else if (m.index >= to) { b = m.index; break; } }
  const before = sentence.slice(a, from), after = sentence.slice(to, b);
  return LEADS.test(before) ? [after, before, sentence] : [before, after, sentence];
}
const topicIn = text => TOPICS.find(t => t.find.test(text)) || null;
export function topicOf(sentence, from, to, prev = '') {
  for (const part of claimParts(sentence, from, to)) { const t = topicIn(part); if (t) return t; }
  return prev ? topicIn(prev) : null;
}

/* the places a sentence names: pack cities by name, else the page's own city; and any of the pack's ZIP codes */
function placesIn(sentence, ctx) {
  let s = sentence; for (const n of ctx.mask || []) s = s.replace(new RegExp('\\b' + escRe(n) + '\\b', 'gi'), m => ' '.repeat(m.length));
  const named = []; for (const name of ctx.names || []) { const re = new RegExp('(?<![A-Za-z])' + escRe(name) + '(?![A-Za-z])', 'g'); if (re.test(s)) { named.push(name); s = s.replace(re, m => ' '.repeat(m.length)); } }
  const cities = named.length ? named.slice(0, 4) : (ctx.city && ctx.places[ctx.city] ? [ctx.city] : []);
  const zips = [...new Set((sentence.match(/\b\d{5}\b/g) || []).filter(z => (ctx.zips ? ctx.zips.has(z) : true)))].slice(0, 6);
  return { cities, zips };
}

/* what a pack and a page give the linker to work with */
export function context({ pack = null, city = '' } = {}) {
  const P = pack ? loadPlaces(pack.id) : null, cities = (pack && pack.cities) || [];
  /* a pack names an unincorporated place "Savannah (CDP)"; the copy says "Savannah" */
  const places = Object.fromEntries(Object.entries((P && P.places) || {}).map(([n, code]) => [n.replace(/ \(CDP\)$/, ''), code]));
  const canon = city ? (Object.keys(places).find(n => n.toLowerCase() === String(city).replace(/ \(CDP\)$/, '').toLowerCase()) || '') : '';
  return { places, city: canon, metro: (P && P.metro && P.metro.geo) || '', metroName: (P && P.metro && P.metro.name) || '', survey: (P && P.survey) || CENSUS.survey,
    names: Object.keys(places).sort((a, b) => b.length - a.length),
    zips: cities.length ? new Set(cities.flatMap(c => c.zips || [])) : null, mask: pack && pack.market && pack.market.name ? [pack.market.name, 'Dallas Fort Worth'] : ['Dallas Fort Worth'] };
}

/* where one mention should point: {url, title, shows} or {why} when the sentence does not say enough */
export function resolve(source, sentence, from, to, ctx, o = {}) {
  if (source.url) return { url: source.url, title: source.title, shows: source.name };
  if (source.pick) { const hit = source.pick.find(p => p.find.test(sentence)) || (o.prev ? source.pick.find(p => p.find.test(o.prev)) : null); return hit ? { url: hit.url, title: hit.title, shows: source.name } : { why: 'the sentence does not say which rule' }; }
  const t = o.topic ? topic(o.topic) : topicOf(sentence, from, to, o.prev || '');
  if (!t) return { why: 'the sentence does not say what the figure is about (heating fuel, the year homes went up, or when owners moved in)' };
  const { cities, zips } = placesIn(sentence, ctx), geo = { places: cities.map(c => ctx.places[c]).filter(Boolean), zips, metro: ctx.metro };
  const url = censusUrl(t.table, geo, ctx.survey);
  if (!url) return { why: 'no Census place is on file for this page (verticals/<pack>.places.json)' };
  const shows = [...cities, ...zips.map(z => 'ZIP ' + z)]; return { url, title: `${t.table}, ${t.title}`, table: t.table, topic: t.id, shows: shows.length ? shows.join(', ') : ctx.metroName || 'the metro' };
}

/* ---------- the linker: a Markdown page in, the same page with each named source linked ---------- */
export function linkSources(src, { pack = null, city = '', topics = null } = {}) {
  const fm = /^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(src), head = fm ? fm[0] : '', body = src.slice(head.length);
  const ctx = context({ pack, city: city || ((/^city:\s*(.+)$/m.exec(head) || [])[1] || '').trim().replace(/^["']|["']$/g, '') });
  const linked = [], open = [], kept = []; let fence = false;
  const lines = body.split('\n').map(line => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return line; }
    if (fence || /^\s*#{1,6}\s/.test(line) || /^\s*<!--/.test(line) || !line.trim()) return line;
    const masked = maskLinks(line), spans = linkSpans(line), edits = [];
    for (const S of SOURCES) { const re = new RegExp(S.find.source, S.find.flags); let m;
      while ((m = re.exec(masked))) { const from = m.index, to = from + m[0].length, inside = spans.find(sp => from >= sp[0] && to <= sp[1]);
        const sen = sentenceAt(masked, from), sentence = masked.slice(sen.start, sen.end), clean = sentence.replace(/\s+/g, ' ').trim();
        if (inside) { (hostIs(inside[2], S.host) ? kept : open).push({ source: S.id, says: m[0], url: inside[2], sentence: clean, why: hostIs(inside[2], S.host) ? '' : `it sits inside a link to ${hostOf(inside[2]) || inside[2]}, not to ${S.host}` }); continue; }
        const r = resolve(S, sentence, from - sen.start, to - sen.start, ctx, { prev: sen.prev, topic: topics && topics[S.id] });
        if (r.url) { edits.push([from, to, r.url]); linked.push({ source: S.id, says: m[0], url: r.url, title: r.title, shows: r.shows, sentence: clean }); }
        else open.push({ source: S.id, says: m[0], sentence: clean, why: r.why });
      } }
    let out = line; for (const [from, to, url] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, from) + '[' + out.slice(from, to) + '](' + url + ')' + out.slice(to);
    return out;
  });
  return { text: head + lines.join('\n'), linked, kept, open, changed: linked.length > 0 };
}

/* the same for a run of HTML copy (a paragraph a page builder puts together): each named source becomes a link that
   opens in another tab. `topic` settles the Census table when the builder already knows what the sentence states. */
export function linkHtml(html, { pack = null, city = '', ctx = null, topic: fixed = '' } = {}) {
  const C = ctx || context({ pack, city }), linked = [], open = [];
  const tagMask = s => s.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, m => '\u0000'.repeat(m.length)).replace(/<[^>]+>/g, m => ' '.repeat(m.length));
  const masked = tagMask(String(html)), edits = [];
  for (const S of SOURCES) { const re = new RegExp(S.find.source, S.find.flags); let m;
    while ((m = re.exec(masked))) { const from = m.index, to = from + m[0].length, sen = sentenceAt(masked, from), sentence = masked.slice(sen.start, sen.end).replace(/\u0000/g, ' '), clean = sentence.replace(/\s+/g, ' ').trim();
      const r = resolve(S, sentence, from - sen.start, to - sen.start, C, { prev: sen.prev.replace(/\u0000/g, ' '), topic: S.id === 'acs' ? fixed : '' });
      if (r.url) { edits.push([from, to, r.url]); linked.push({ source: S.id, says: m[0], url: r.url, title: r.title, shows: r.shows, sentence: clean }); } else open.push({ source: S.id, says: m[0], sentence: clean, why: r.why });
    } }
  let out = String(html); for (const [from, to, url] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, from) + `<a href="${url.replace(/&/g, '&amp;')}" target="_blank" rel="noopener">` + out.slice(from, to) + '</a>' + out.slice(to);
  return { html: out, linked, open };
}

/* ---------- the gate: every named source in the copy sits inside a link to that source ---------- */
export function checkSources(doc) {
  const out = [];
  for (const b of doc.blocks || []) { if (!['p', 'li', 'quote', 'table'].includes(b.type)) continue;
    for (const S of SOURCES) { const said = b.text.match(new RegExp(S.find.source, S.find.flags)) || []; if (!said.length) continue;
      const links = (b.links || []).filter(l => hostIs(l.href, S.host) && new RegExp(S.find.source, S.find.flags.replace('g', '')).test(l.anchor || ''));
      if (said.length > links.length) out.push({ kind: 'unlinked', source: S.id, says: said[0], count: said.length - links.length, message: `"${said[0]}" names a source and links nothing${said.length - links.length > 1 ? ` (${said.length - links.length} times in this paragraph)` : ''}. Link the words to ${S.name}: \`sources <file> --write\` does it.`, excerpt: b.text.slice(0, 200) });
    } }
  return out;
}
