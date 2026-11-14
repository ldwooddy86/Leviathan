/* The site as its sitemap lists it. The strategist never links to a URL that is not here and never aims a new page at a
   keyword a page here already holds.

   crawl() finds the sitemaps (robots.txt, then the usual names), follows an index into its children and returns every
   URL. inventory() reads each URL: what kind of page it is, the place it names, the service angle it belongs to, the
   keyword it stands for. cannibal() weighs a proposed keyword against that inventory; linkTargets() picks the live pages
   a new page should link to and the anchor for each. A site that answers with a bot challenge is reported as such: save
   the sitemap from a browser and pass the file instead. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { decode } from './doc.mjs';
import { tokens, key, jaccard, places as placesOf, locate, angleOf, anglesHeld, isQuestion, norm } from './terms.mjs';
import { urlKey } from './lint.mjs';

const UA = 'Mozilla/5.0 (compatible; sitemap-reader/1.0)';
export class Blocked extends Error { constructor(msg, o) { super(msg); this.name = 'Blocked'; Object.assign(this, o || {}); } }

/* one URL as text; a gzip body is inflated. Rejects Blocked when the site answers with a challenge instead of content. */
export async function get(url, { timeout = 20000, accept = 'application/xml,text/xml,text/plain,text/html;q=0.8,*/*;q=0.5' } = {}) {
  let r;
  try { r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept }, signal: AbortSignal.timeout(timeout) }); }
  catch (e) { throw new Blocked(`could not reach ${url}: ${(e.cause && (e.cause.code || e.cause.message)) || e.message}`, { url, code: 'network' }); }
  const buf = Buffer.from(await r.arrayBuffer());
  const text = (buf[0] === 0x1f && buf[1] === 0x8b) ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  const isMap = /<(urlset|sitemapindex)\b/i.test(text), walled = /sgcaptcha|cf-chl|challenge-platform|captcha|Just a moment\.\.\.|Access Denied|Attention Required/i.test(text.slice(0, 3000));
  if (!isMap && (walled || [202, 401, 403, 406, 429, 503].includes(r.status)))
    throw new Blocked(`${new URL(url).hostname} answered with a bot challenge (HTTP ${r.status}), not the page`, { url, status: r.status, code: 'challenge' });
  return { status: r.status, ok: r.ok, url: r.url || url, text, type: r.headers.get('content-type') || '' };
}

/* a sitemap body: {kind: 'index' | 'urlset' | 'list' | 'none', sitemaps: [url], urls: [{loc, lastmod}]} */
export function parseSitemap(text) {
  const t = String(text || ''), pick = (block, tag) => { const m = new RegExp('<' + tag + '\\b[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</' + tag + '>', 'i').exec(block); return m ? decode(m[1].trim()) : ''; };
  if (/<sitemapindex\b/i.test(t)) return { kind: 'index', sitemaps: (t.match(/<sitemap\b[\s\S]*?<\/sitemap>/gi) || []).map(b => pick(b, 'loc')).filter(Boolean), urls: [] };
  if (/<urlset\b/i.test(t)) return { kind: 'urlset', sitemaps: [], urls: (t.match(/<url\b[\s\S]*?<\/url>/gi) || []).map(b => ({ loc: pick(b, 'loc'), lastmod: pick(b, 'lastmod').slice(0, 10) })).filter(u => u.loc) };
  /* a plain list: one URL a line, or "anchor | URL" as the Site Forge takes it */
  const urls = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const m = /(https?:\/\/\S+)/.exec(l); return m ? { loc: m[1].replace(/[),.;]+$/, ''), lastmod: '' } : null; }).filter(Boolean);
  return urls.length ? { kind: 'list', sitemaps: [], urls } : { kind: 'none', sitemaps: [], urls: [] };
}

/* every URL a site's sitemaps list: {site, sitemaps: [{url, kind, urls}], urls: [{loc, lastmod, source}], errors} */
export async function crawl(site, { max = 20000, fetcher = get } = {}) {
  const origin = new URL(/^https?:/i.test(site) ? site : 'https://' + site).origin, out = { site: origin, fetched: new Date().toISOString(), sitemaps: [], urls: [], errors: [] };
  let start = [];
  if (/\.(xml|txt)(\.gz)?(\?.*)?$/i.test(site)) start = [site];
  else {
    try { const r = await fetcher(origin + '/robots.txt', { accept: 'text/plain,*/*' }); start = [...r.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]); }
    catch (e) { if (e.code === 'challenge') throw e; out.errors.push(e.message); }
    if (!start.length) start = ['/sitemap_index.xml', '/sitemap.xml', '/wp-sitemap.xml', '/sitemap-index.xml'].map(p => origin + p);
  }
  const seen = new Set(), queue = [...start], urls = new Map(); let found = false;
  while (queue.length && seen.size < 300) {
    const u = queue.shift(); if (seen.has(u)) continue; seen.add(u);
    let r; try { r = await fetcher(u); } catch (e) { if (e.code === 'challenge' && !found) throw e; out.errors.push(e.message); continue; }
    if (!r.ok) { out.errors.push(`${u} answered ${r.status}`); continue; }
    const p = parseSitemap(r.text); if (p.kind === 'none') { out.errors.push(`${u} is not a sitemap`); continue; }
    found = true; out.sitemaps.push({ url: u, kind: p.kind, urls: p.urls.length });
    for (const s of p.sitemaps) queue.push(s);
    for (const x of p.urls) { if (urls.size >= max) break; if (!urls.has(x.loc)) urls.set(x.loc, { loc: x.loc, lastmod: x.lastmod, source: u.split('/').pop().split('?')[0] }); }
    if (found && p.kind !== 'index' && start.length > 1 && !/robots/.test(u) && queue.every(q => start.includes(q))) queue.length = 0;   /* one of the usual names answered: do not ask the others */
  }
  out.urls = [...urls.values()];
  if (!found) throw new Blocked(`no sitemap found for ${origin} (${out.errors.slice(0, 3).join('; ') || 'nothing answered'})`, { code: 'none' });
  return out;
}
/* the same result from a saved file: sitemap XML, or a list of URLs */
export function fromFile(file, site = '') {
  const p = parseSitemap(fs.readFileSync(file, 'utf8')); if (p.kind === 'none' || p.kind === 'index') throw new Error(`${file} holds no page URLs${p.kind === 'index' ? ' (it is a sitemap index: save the page and post sitemaps it lists)' : ''}`);
  const origin = site ? new URL(/^https?:/i.test(site) ? site : 'https://' + site).origin : new URL(p.urls[0].loc).origin;
  return { site: origin, fetched: new Date().toISOString(), sitemaps: [{ url: file, kind: p.kind, urls: p.urls.length }], urls: p.urls.map(u => Object.assign(u, { source: file.split('/').pop() })), errors: [] };
}

/* ---------- reading the URLs ---------- */
const ACRONYM = { ac: 'AC', hvac: 'HVAC', r22: 'R22', dfw: 'DFW', tx: 'TX', la: 'LA', seer: 'SEER', uv: 'UV', iaq: 'IAQ', dwi: 'DWI', dui: 'DUI', faq: 'FAQ', usa: 'USA', llc: 'LLC', cpa: 'CPA' };
const phraseOf = seg => decodeURIComponent(seg).replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
export const display = (s, placeList = []) => { let t = ' ' + String(s).toLowerCase() + ' '; for (const p of placeList) t = t.replace(new RegExp(' ' + p.words.join(' ') + ' ', 'g'), ' ' + p.name + ' '); return t.trim().split(' ').map(w => ACRONYM[w] || w).join(' '); };

function kindOf(path, source, segs, loc, angle, many) {
  if (!segs.length) return 'home';
  const last = segs[segs.length - 1], p = '/' + segs.join('/') + '/';
  if (/\/(category|categories|tag|author|topics?)\/|\/page\/\d+\/|\/feed\//.test(p) || /(category|tag|author)-sitemap/.test(source)) return 'taxonomy';
  if (/gallery|attachment|media-sitemap/.test(source) || /\/(\w+_)?gallery\//.test(p)) return 'media';
  if (/^(privacy|terms|sitemap|thank-?you|accessibility|cookie|disclaimer|legal|site-?map|site-search|search)/.test(last) || /(privacy-policy|terms-of|terms-and)/.test(last)) return 'legal';
  if (/^lp-/.test(last) || /\/(lp|landing|promo)\//.test(p)) return 'landing';
  if (/^(contact|contact-us|schedul|book|booking|request|get-a-quote|free-estimate|estimate)/.test(last)) return 'contact';
  if (/^(about|about-us|our-team|team|careers|jobs|reviews|testimonials|gallery|coupons|specials|offers|financing|blog|news|resources|service-areas?|areas-we-serve|locations?|services|case-studies|projects|portfolio|categories)$/.test(last)) return 'hub';
  if (/post-sitemap|news-sitemap|case-stud/.test(source) || /\/(blog|news|articles?|resources|tips|learn|guides?|case-studies|projects)\//.test(p) || /\/\d{4}\/\d{2}\//.test(p)) return 'post';
  if (/\/(our-team|team|staff)\/[^/]+\/$/.test(p)) return 'page';
  if (loc.place && many) return 'location';                         /* one page for several services in a city is that city's page */
  if (loc.place && angle) return 'service-location';
  if (loc.place) return 'location';
  if (angle) return 'service';
  return 'page';
}

const STATE = /\b(tx|texas|la|louisiana)\b/g, AREA = /^(service-areas?|areas-we-serve|areas|locations?|cities|communities)$/;
const titled = s => s.split(' ').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
/* the place a URL names when the pack does not know it: the segment under /service-area/, or what follows "in" before the state */
function guessPlace(segs) {
  const i = segs.findIndex(s => AREA.test(s)); let cand = '';
  if (i !== -1 && segs[i + 1]) { const s = phraseOf(segs[i + 1]), m = / in (.+)$/.exec(' ' + s); cand = (m ? m[1] : s).replace(STATE, ' ').replace(/\bhvac\b/g, ' '); }
  else { const m = / in ([a-z ]+?) (?:tx|texas|la|louisiana)$/.exec(' ' + (segs.length ? phraseOf(segs[segs.length - 1]) : '')); if (m) cand = m[1]; }
  cand = cand.replace(/\s+/g, ' ').trim();
  return cand && cand.split(' ').length <= 4 && !/\d/.test(cand) ? titled(cand) : null;
}
/* the places an inventory names, added to the ones the pack knows, so a keyword for a town outside the pack still finds its page */
function allPlaces(P, inv) {
  const seen = new Set(P.map(p => p.words.join(' '))), out = P.slice();
  for (const p of inv) if (p.place) { const w = (norm(p.place).match(/[a-z0-9]+/g) || []), k = w.join(' '); if (w.length && !seen.has(k)) { seen.add(k); out.push({ name: p.place, kind: p.placeKind || 'city', words: w }); } }
  return out.sort((a, b) => b.words.length - a.words.length || b.name.length - a.name.length);
}

/* [{url, key, path, kind, keyword, topic, tokens, place, placeKind, angle, angles, mode, lastmod, source, title?, h1?}] */
export function inventory(crawled, { pack = null, brand = null } = {}) {
  const P = placesOf(pack, brand);
  return crawled.urls.map(u => {
    let x; try { x = new URL(u.loc); } catch { return null; }
    const segs = x.pathname.split('/').filter(Boolean), last = segs.length ? phraseOf(segs[segs.length - 1]) : '';
    const whole = segs.map(phraseOf).join(' '), loc = locate(last, P), known = loc.place ? loc : locate(whole, P), guess = known.place ? null : guessPlace(segs);
    const locAll = known.place ? known : { place: guess, kind: guess ? 'city' : null, rest: whole };
    let topic = (loc.place ? loc.rest : last) || '';
    if (guess) topic = (' ' + topic + ' ').replace(' ' + norm(guess) + ' ', ' ');
    topic = topic.replace(STATE, ' ').replace(/\s+/g, ' ').trim().replace(/ (in|and|for|of)$/, '').trim();
    if (locAll.place && norm(topic) === norm(locAll.place)) topic = '';
    const a = angleOf(topic, pack), held = anglesHeld(topic, pack);          /* a page stands for its own slug, not for the section it sits in */
    const kind = kindOf(x.pathname, u.source || '', segs, locAll, a, held.length >= 2);
    const mode = kind === 'post' ? (isQuestion(last) ? 'answer' : 'article') : 'service';
    return { url: u.loc, key: urlKey(u.loc), path: x.pathname, kind, keyword: last, topic, tokens: [...new Set(tokens(topic))], place: locAll.place, placeKind: locAll.kind, angle: a ? a.id : null, angles: held, mode, lastmod: u.lastmod || '', source: u.source || '' };
  }).filter(Boolean);
}

/* reads each page's own title and h1 (and whether it asks not to be indexed) to sharpen the keyword the URL stands for */
export async function deepen(inv, { pack = null, brand = null, limit = 200, concurrency = 6, fetcher = get } = {}) {
  const P = placesOf(pack, brand), todo = inv.filter(p => !['taxonomy', 'legal'].includes(p.kind)).slice(0, limit); let i = 0, done = 0, failed = 0;
  const strip = t => String(t).split(/\s+[|–—·]\s+|\s+-\s+/)[0].trim();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < todo.length) {
      const p = todo[i++];
      try {
        const r = await fetcher(p.url, { accept: 'text/html,*/*;q=0.5', timeout: 15000 }); if (!r.ok) { failed++; continue; }
        const t = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(r.text), h = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(r.text);
        if (t) p.title = decode(t[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
        if (h) p.h1 = decode(h[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
        if (/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(r.text)) p.noindex = true;
        const head = p.h1 || (p.title ? strip(p.title) : '');
        if (head) { const loc = locate(head, P), a = angleOf(loc.rest, pack); if (a && (!p.angle || a.score >= 0.75)) p.angle = a.id; if (loc.place && !p.place) { p.place = loc.place; p.placeKind = loc.kind; } p.headTokens = [...new Set(tokens(loc.rest))]; if (isQuestion(head) && p.kind === 'post') p.mode = 'answer'; }
        done++;
      } catch { failed++; }
    }
  }));
  return { read: done, failed };
}

/* ---------- cannibalization ---------- */
/* words a question is built from; they say nothing about its subject */
const WEAK = new Set(['how', 'why', 'what', 'when', 'where', 'which', 'who', 'can', 'should', 'will', 'could', 'need', 'know', 'possibl', 'up', 'into', 'here', 'heres', 'about', 'thing', 'tip', 'sign', 'reason', 'way', 'benefit', 'top', 'common', 'most', 'best', 'much', 'many', 'get', 'make', 'not', 'never', 'always', 'still']);
/* how much of a topic's subject a page's slug carries: the share of its telling words found there (0 when it has fewer than two) */
export function cover(T, p) {
  const strong = T.filter(t => !WEAK.has(t) && !/^\d+$/.test(t)); if (strong.length < 2) return 0;
  const have = new Set([...(p.tokens || []), ...(p.headTokens || [])]); return strong.filter(t => have.has(t)).length / strong.length;
}
const same = (a, b) => norm(a || '') === norm(b || '');
const RANKING = new Set(['home', 'service', 'service-location', 'location', 'post', 'page', 'hub']);

/* weighs a proposed keyword against the live pages: {verdict: 'clear' | 'conflict', want, conflicts, neighbors, planned, avoid, advice} */
export function cannibal(keyword, inv, { pack = null, brand = null, type = 'landing', selfUrl = '' } = {}) {
  const P = allPlaces(placesOf(pack, brand), inv), loc = locate(keyword, P), a = angleOf(loc.rest, pack), T = [...new Set(tokens(loc.rest))];
  const asks = isQuestion(keyword) || (a && a.kind === 'questions' && a.score >= 0.75), mode = type === 'blog' ? (asks ? 'answer' : 'article') : (asks ? 'answer' : 'service');
  const want = { keyword, tokens: T, place: loc.place, placeKind: loc.kind, angle: a ? a.id : null, angleLabel: a ? a.label : null, mode, type };
  const self = selfUrl ? urlKey(selfUrl) : '', conflicts = [], neighbors = [];
  for (const p of inv) {
    if (!RANKING.has(p.kind) || p.key === self || p.noindex) continue;
    const sim = Math.max(jaccard(T, p.tokens), p.headTokens ? jaccard(T, p.headTokens) : 0), samePlace = same(want.place, p.place), sameAngle = !!want.angle && (p.angle === want.angle || (p.angles || []).includes(want.angle)), several = (p.angles || []).length >= 2;
    const row = { url: p.url, kind: p.kind, keyword: display(((p.topic != null ? p.topic : p.keyword) + (p.place ? ' ' + p.place : '')).trim() || p.keyword, P), holds: p.h1 || p.title || display(p.keyword, P), place: p.place, angle: p.angle, similarity: Math.round(sim * 100) / 100 };
    const pServes = p.mode === 'service' && p.kind !== 'post';
    if (samePlace && sim >= 0.999) { conflicts.push(Object.assign(row, { why: 'the same keyword' })); continue; }
    if (mode !== 'service' && p.kind === 'post') {                  /* a post on the same subject in other words */
      const cv = cover(T, p);
      if (cv === 1) { conflicts.push(Object.assign(row, { why: 'a post that already covers this subject' })); continue; }
      if (cv >= 0.6) { neighbors.push(Object.assign(row, { relation: 'a post on a close topic', close: true, similarity: Math.max(row.similarity, Math.round(cv * 100) / 100) })); continue; }
    }
    if (sameAngle && samePlace) {
      if (mode === 'service' && pServes) { conflicts.push(Object.assign(row, several ? { why: `one page that covers ${p.angles.length} services${want.place ? ' for ' + want.place : ''}, this one among them`, shared: true } : { why: `already the ${want.angleLabel} page${want.place ? ' for ' + want.place : ''}` })); continue; }
      if (mode === 'article' && pServes && sim >= 0.5) { conflicts.push(Object.assign(row, { why: 'a blog post aimed at a service page\'s own term' })); continue; }
      if (mode !== 'service' && !pServes && sim >= 0.6) { conflicts.push(Object.assign(row, { why: 'a post that already answers this' })); continue; }
      neighbors.push(Object.assign(row, { relation: pServes ? 'the service page this topic supports' : 'a related post' })); continue;
    }
    const otherAngle = !!want.angle && !!p.angle && !sameAngle;            /* the atlas treats them as two services: a sister page, not a rival */
    if (samePlace && sim >= 0.6 && (mode === 'service') === pServes && !otherAngle) { conflicts.push(Object.assign(row, { why: 'a near match on the same topic' })); continue; }
    if (otherAngle && samePlace && sim >= 0.5) { neighbors.push(Object.assign(row, { relation: 'a sister service' })); continue; }
    if (sameAngle) { neighbors.push(Object.assign(row, { relation: p.kind === 'post' ? 'a post on the same service' : !p.place ? (want.place ? 'the parent service page' : 'the service page this topic supports') : !want.place ? 'a city version of this service' : 'the same service in another place' })); continue; }
    if (want.place && same(want.place, p.place) && (p.kind === 'location' || p.kind === 'service-location')) { neighbors.push(Object.assign(row, { relation: p.kind === 'location' ? `the ${p.place} city page` : `another ${p.place} page` })); continue; }
    if (sim >= 0.34) neighbors.push(Object.assign(row, { relation: 'a related topic' }));
  }
  /* pages the Site Forge plans but has not published */
  const planned = [];
  if (pack && pack.sitePlan && want.angle && mode === 'service') {
    const sp = pack.sitePlan.service.find(s => s.angle === want.angle), liveSlugs = new Set(inv.map(p => p.path.split('/').filter(Boolean).pop()));
    if (sp && !want.place && !liveSlugs.has(sp.slug) && !conflicts.length) planned.push({ slug: sp.slug, h1: sp.h1, note: 'the Site Forge plans this service page; write it as that page, not beside it' });
  }
  if (pack && pack.sitePlan && mode !== 'service') for (const g of pack.sitePlan.guides || []) if (jaccard(T, tokens(g.h1)) >= 0.5 || jaccard(T, tokens(g.label)) >= 0.6) planned.push({ guide: g.id, h1: g.h1, note: 'the Site Forge plans a guide on this; write it as that guide, not beside it' });
  const first = pack && want.angle ? ((pack.angles || []).find(x => x.id === want.angle) || {}) : {}, canon = first.keywords && first.keywords.core && first.keywords.core[0] ? key(first.keywords.core[0]) : '';
  const lead = r => (canon && key(r.keyword) === canon ? 0.005 : 0);
  conflicts.sort((x, y) => (y.similarity + lead(y)) - (x.similarity + lead(x))); neighbors.sort((x, y) => (y.similarity + lead(y)) - (x.similarity + lead(x)));
  const avoid = [...conflicts, ...neighbors.filter(n => (n.angle && n.angle === want.angle) || /city page/.test(n.relation))].map(r => ({ keyword: r.keyword, url: r.url }));
  const advice = [];
  if (conflicts.length && conflicts.every(c => c.shared)) advice.push(`"${keyword}" already belongs to ${conflicts[0].url} (${conflicts[0].why}). Improve that page's section on it, or ask the person whether to split this service out as its own page under that one. A split means that page gives up the term and links down to the new one; build it with --allow cannibalization only once they agree.`);
  else if (conflicts.length) advice.push(`Do not write a new page for "${keyword}". ${(conflicts.find(c => !c.shared) || conflicts[0]).url} holds it (${(conflicts.find(c => !c.shared) || conflicts[0]).why}). Improve that page, or choose a keyword it does not hold.`);
  else advice.push(`"${keyword}" is clear: no live page holds it.`);
  const parent = neighbors.find(n => /parent service|service page this topic/.test(n.relation)); if (parent && !conflicts.length) advice.push(`Link to ${parent.url} and leave its head term to it: this page targets "${keyword}", not "${parent.keyword}".`);
  const close = neighbors.filter(n => n.close); if (close.length && !conflicts.length) advice.push(`Close topics already on the blog: ${close.slice(0, 3).map(n => n.url).join(', ')}. Read them first. If one answers the same question, update it instead of writing a new post.`);
  const hub = neighbors.find(n => /city page/.test(n.relation)); if (hub && !conflicts.length && mode === 'service') advice.push(`${hub.url} already covers ${want.place} in general. Go deeper on this one service than that page does, and link the two to each other.`);
  if (want.place && !inv.some(p => same(p.place, want.place))) advice.push(`No live page names ${want.place} yet. This page will be the first; make it specific to ${want.place}.`);
  if (!want.angle && pack) advice.push('The keyword matches no service angle in the vertical pack. Check `keywords` for the angle it belongs to, or treat it as a new topic.');
  for (const p of planned) advice.push(p.note + ` ("${p.h1}").`);
  if (want.place && !conflicts.length && mode === 'service') {
    const like = inv.find(p => p.kind === 'service-location' && same(p.place, want.place)) || inv.find(p => p.kind === 'service-location'), ang = pack && (pack.angles || []).find(x => x.id === want.angle);
    if (like) advice.push(`Slug: the site's city pages look like ${like.path}. Follow that pattern.`);
    if (ang && ang.page && ang.page.h1City) advice.push(`The Site Forge heads this kind of page "${ang.page.h1City.replace(/\{city\}/g, want.place)}".`);
  }
  return { verdict: conflicts.length ? 'conflict' : 'clear', want, conflicts: conflicts.slice(0, 8), neighbors: neighbors.slice(0, 12), planned, avoid: avoid.slice(0, 20), advice };
}

/* ---------- internal links ---------- */
/* the live pages a new page should link to: [{url, anchor, why, score}] */
export function linkTargets(keyword, inv, { pack = null, brand = null, n = 6, selfUrl = '', type = 'landing' } = {}) {
  const P = allPlaces(placesOf(pack, brand), inv), c = cannibal(keyword, inv, { pack, brand, type, selfUrl }), W = c.want, self = selfUrl ? urlKey(selfUrl) : '';
  /* two angles are sisters when the atlas sells them on one service line (the full service blend does not count) */
  const lines = pack && pack.lines ? Object.entries(pack.lines).filter(([k]) => k !== 'blend').map(([, l]) => l.angles || []) : [];
  const sisters = (a, b) => !!a && !!b && a !== b && lines.some(l => l.includes(a) && l.includes(b));
  const INTENT = [['maintain', /mainten|tune|plan\b|inspect|check/], ['replace', /replac|install|new\b|upgrade/], ['repair', /repair|fix|not (work|cool|heat)|broken|emergency/]];
  const intentOf = s => (INTENT.find(([, re]) => re.test(norm(s))) || [''])[0], my = intentOf(keyword), fit = p => { const pi = intentOf(p.topic || p.keyword); return (pi && pi === my ? 1.5 : 0) + (my === 'repair' && pi === 'maintain' ? 1 : 0); };
  const mine = key(keyword), used = new Set(), ang0 = pack && W.angle ? ((pack.angles || []).find(x => x.id === W.angle) || {}) : {}, canon = ang0.keywords && ang0.keywords.core && ang0.keywords.core[0] ? key(ang0.keywords.core[0]) : '';
  const rows = [];
  for (const p of inv) {
    if (p.key === self || p.noindex || ['taxonomy', 'legal', 'landing', 'home', 'media'].includes(p.kind)) continue;
    if (c.conflicts.some(x => x.url === p.url && !x.shared)) continue;
    const sim = Math.max(jaccard(W.tokens, p.tokens), p.headTokens ? jaccard(W.tokens, p.headTokens) : 0), cv = p.kind === 'post' ? cover(W.tokens, p) : 0; let score = 2.5 * sim + 3 * cv, why = '';
    const sameAngle = W.angle && (p.angle === W.angle || (p.angles || []).includes(W.angle)), samePlace = W.place && same(W.place, p.place);
    if (W.place && p.place && !samePlace) continue;                /* a Plano page does not send its reader to Frisco */
    if (sameAngle && !p.place && p.kind === 'service') { score += 5 + (canon && key(p.topic || p.keyword) === canon ? 0.5 : 0); why = 'the parent service page'; }
    else if (samePlace && p.kind === 'location') { score += 4; why = `the ${p.place} page`; }
    else if (p.kind === 'post' && cv >= 0.6) { score += 2; why = 'a post on a close topic'; }
    else if (sameAngle && p.kind === 'post') { score += 2; why = 'a post on the same service'; }
    else if (sameAngle && !W.place && p.kind === 'service-location') { score += 2; why = `the ${p.place} version of this service`; }
    else if (sisters(W.angle, p.angle) && !p.place && p.kind === 'service') { score += 1.5 + fit(p); why = 'a sister service'; }
    else if (samePlace && p.kind === 'service-location') { score += 1.5; why = `another service in ${p.place}`; }
    else if (samePlace && p.kind === 'post') { score += 2.5; why = `a post or job from ${p.place}`; }
    else if (p.kind === 'service' && !p.place && p.angle) { score += 1 + fit(p); why = 'a related service'; }
    else if (p.kind === 'contact') { score += 2; why = 'the next step for the reader'; }
    else if (p.kind === 'hub' && /financ|review|about/.test(p.path)) { score += 0.8; why = 'proof or terms the reader may want'; }
    else if (sim >= 0.34) why = 'a related topic';
    if (!why) continue;
    const phrase = p.kind === 'location' ? `heating and air in ${p.place}` : p.kind === 'service-location' ? `${display(p.topic || p.keyword, P)} in ${p.place}` : p.kind === 'post' ? display(p.keyword, P) : display(p.topic || p.keyword, P);
    rows.push({ url: p.url, kind: p.kind, score: Math.round(score * 100) / 100, why, base: p.h1 && p.h1.length <= 60 ? p.h1 : phrase, place: p.place });
  }
  rows.sort((a, b) => b.score - a.score);
  let parent = false; for (const r of rows) if (r.why === 'the parent service page') { if (parent) { r.why = 'another page on the same service'; r.score = Math.round((r.score - 3.5) * 100) / 100; } parent = true; }      /* one parent; the rest rank as related */
  rows.sort((a, b) => b.score - a.score);
  const out = [];
  const step = rows.find(r => r.kind === 'contact'), room = step ? Math.max(1, n - 1) : n;      /* the last place goes to the next step */
  for (const r of [...rows.filter(r => r.kind !== 'contact'), ...(step ? [step] : [])]) {
    if (out.length >= (r.kind === 'contact' ? n : room)) { if (r.kind !== 'contact') continue; break; }
    let anchor = r.kind === 'contact' ? 'schedule a visit' : r.base.replace(/\s+/g, ' ').trim();
    if (key(anchor) === mine) anchor = r.why === 'the parent service page' && W.angleLabel ? W.angleLabel.toLowerCase() : 'our ' + anchor;
    if (used.has(norm(anchor))) continue; used.add(norm(anchor));
    out.push({ url: r.url, anchor, why: r.why, kind: r.kind, score: r.score });
  }
  return { want: W, verdict: c.verdict, targets: out, rule: 'Use each anchor once, in a sentence that would read fine without the link. Reword an anchor to fit the sentence, but never anchor another page with this page\'s own keyword.' };
}
