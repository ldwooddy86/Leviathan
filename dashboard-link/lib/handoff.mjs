/* Files that cross between an agent and the dashboard, in the forms the dashboard's own controls read and write.

   To the dashboard
     a plan for the Campaign Desk     module 08, ⤒ Load. The desk keeps the keys it knows, checks every one and drops what
                                      it does not recognise without a word. deskPlan() applies the same checks first and
                                      says what the desk would drop, so nothing is lost silently.
     pages for Publish                module 16, the import box. A file whose `pages` list holds FORGE blueprints: each is
                                      compiled there by the Site Forge compiler and lands in the list as a draft.

   From the dashboard
     the plan the desk holds          ⤓ Save on the Campaign Desk (campaign-desk-plan.json)
     the competitor ledger            Competitor Watch, the JSON export (competitor-watch-ledger.json)
     account results                  Accounts, the JSON export (actuals.json)

   Every file an agent writes carries a `handoff` note: who made it, when, and for which dashboard build. The desk and
   Publish ignore the note; a person or another agent can read it. */
import fs from 'node:fs';

export const HANDOFF = 'leviathan.handoff';
const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && (d => !Number.isNaN(+d) && d.toISOString().slice(0, 10) === s)(new Date(s + 'T12:00:00Z'));
const fin = v => typeof v === 'number' && Number.isFinite(v);
const has = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

export function note(agent, connection, extra = {}) {
  const i = (connection && connection.identity) || {};
  return Object.assign({ format: HANDOFF, v: 1, agent, made: new Date().toISOString(), atlas: { name: i.atlas || '', build: i.build || null, sha256: i.sha256 ? i.sha256.slice(0, 16) : null } }, extra);
}

/* ---------- to the Campaign Desk ---------- */
export const DESK_NUMBERS = ['budget', 'weeks', 'n', 'minhh', 'alpha', 'spanTh', 'bookRate', 'jobVal'];
export const DESK_STRINGS = ['brand', 'lic', 'phone', 'url', 'city', 'pay'];
const ASM_FIELDS = ['cost', 'ctr', 'cvr', 'min'];

/* A plan as the Campaign Desk will hold it after Load, and what it would drop or replace on the way: {plan, problems,
   notes}. pack is the paid pack (lines, angles, platforms, defaults); model the connected ZIP model. A plan with any
   problem should be fixed before it is handed over, because the desk drops what it does not accept without saying so. */
export function deskPlan(input, { pack, model }) {
  const p = {}, problems = [], notes = [], d = pack.defaults || {}, plats = pack.platforms.order, src = input && typeof input === 'object' ? input : {};
  const zipOk = new Set((model ? model.zips : []).map(z => z.zip)), fipsOk = new Set((model ? model.counties : []).map(c => c.fips)), angleOk = new Set(pack.angles.map(a => a.id));
  if (!has(pack.lines, src.line)) problems.push(`line "${src.line}" is not a Campaign Desk line. The desk would open the plan on "${d.line || 'replace'}". Lines: ${Object.keys(pack.lines).join(', ')}`); else p.line = src.line;
  if (!isDay(src.start)) problems.push(`start "${src.start}" is not a date written YYYY-MM-DD. The desk would start the flight on the coming Monday.`); else p.start = src.start;
  for (const k of DESK_NUMBERS) { if (!has(src, k)) continue; if (!fin(src[k])) problems.push(`${k} must be a number; the desk would use ${d[k]}`); else p[k] = src[k]; }
  if (fin(p.weeks) && (p.weeks < 1 || p.weeks > 52)) { problems.push(`weeks ${p.weeks} is outside 1 to 52; the desk would clamp it`); p.weeks = Math.max(1, Math.min(52, p.weeks)); }
  if (fin(p.budget) && p.budget <= 0) problems.push('budget must be a positive number of dollars a month');
  for (const k of DESK_STRINGS) { if (!has(src, k)) continue; if (typeof src[k] !== 'string') problems.push(`${k} must be text`); else p[k] = src[k]; }
  if (has(src, 'scope')) { if (!['top', 'county', 'picks'].includes(src.scope)) problems.push(`scope "${src.scope}" is not top, county or picks; the desk would use top`); else p.scope = src.scope; }
  if (has(src, 'picks')) { const list = Array.isArray(src.picks) ? [...new Set(src.picks.map(String))] : []; const bad = list.filter(z => !zipOk.has(z)); if (bad.length) problems.push(`${bad.length} ZIP${bad.length === 1 ? '' : 's'} the dashboard does not score as a market and the desk would drop: ${bad.slice(0, 12).join(', ')}`); p.picks = list.filter(z => zipOk.has(z)); }
  if (has(src, 'counties')) { const list = Array.isArray(src.counties) ? src.counties.map(String) : []; const bad = list.filter(f => !fipsOk.has(f)); if (bad.length) problems.push(`county codes the desk would drop (it takes five digit FIPS codes): ${bad.join(', ')}`); p.counties = list.filter(f => fipsOk.has(f)); }
  if (p.scope === 'picks' && !(p.picks || []).length) problems.push('scope is picks and no ZIP is picked: the desk would buy nothing');
  if (p.scope === 'county' && !(p.counties || []).length) problems.push('scope is county and no county is named: the desk would fall back to the metro');
  if (has(src, 'angles')) { const list = Array.isArray(src.angles) ? [...new Set(src.angles)] : []; const bad = list.filter(a => !angleOk.has(a)); if (bad.length) problems.push(`angles the desk would drop: ${bad.join(', ')}`); p.angles = list.filter(a => angleOk.has(a)); if (!p.angles.length) problems.push('no service angle is left, so the desk would write no ad groups'); }
  if (has(src, 'mix')) {
    const m = src.mix && typeof src.mix === 'object' ? src.mix : {}, out = {};
    for (const k of Object.keys(m)) if (!plats.includes(k)) problems.push(`mix names "${k}", which is not one of the desk's platforms (${plats.join(', ')}); the desk would ignore it`);
    for (const k of plats) { if (!has(m, k)) { out[k] = 0; continue; } if (!fin(m[k]) || m[k] < 0) { problems.push(`mix.${k} must be a number of 0 or more`); out[k] = 0; } else out[k] = m[k]; }
    const tot = plats.reduce((s, k) => s + out[k], 0); if (tot <= 0) problems.push('mix adds up to nothing'); else if (Math.abs(tot - 100) > 0.5) notes.push(`mix adds up to ${Math.round(tot * 10) / 10}; the desk rescales the shares to 100`);
    p.mix = out;
  }
  if (has(src, 'asm')) {
    const a = src.asm && typeof src.asm === 'object' ? src.asm : {}, out = {};
    for (const k of Object.keys(a)) { if (!plats.includes(k)) { problems.push(`asm names "${k}", which is not one of the desk's platforms`); continue; } const o = {}; for (const f of Object.keys(a[k] || {})) { if (!ASM_FIELDS.includes(f)) { if (!['basis', 'g', 'src'].includes(f)) notes.push(`asm.${k}.${f} is not a field the desk reads`); continue; } if (!fin(a[k][f])) problems.push(`asm.${k}.${f} must be a number`); else o[f] = a[k][f]; } if (Object.keys(o).length) out[k] = o; }
    if (Object.keys(out).length) p.asm = out;
  }
  if (has(src, 'bids') && src.bids != null) {
    const b = src.bids && typeof src.bids === 'object' ? src.bids : {}, out = {};
    for (const [z, v] of Object.entries(b)) { if (!zipOk.has(z)) { problems.push(`bids names ZIP ${z}, which is not a market`); continue; } if (!fin(+v)) { problems.push(`bids.${z} must be a number of percent`); continue; } if (+v < -90 || +v > 900) problems.push(`bids.${z} is ${v}%: a location bid adjustment runs from minus 90% to plus 900%`); out[z] = +v; }
    if (p.scope !== 'picks') notes.push('bids are read only for hand picked ZIPs: set scope to picks'); p.bids = out;
  }
  if (has(src, 'remarket')) p.remarket = !!src.remarket;
  if (d.v != null) p.v = d.v;
  for (const k of Object.keys(src)) if (!['line', 'start', 'scope', 'picks', 'counties', 'angles', 'mix', 'asm', 'bids', 'remarket', 'v', 'handoff', ...DESK_NUMBERS, ...DESK_STRINGS].includes(k)) notes.push(`"${k}" is not a key the desk keeps`);
  return { plan: p, problems, notes };
}
/* the file to hand over: the plan with its note */
export function deskPlanFile(plan, handoff) { return JSON.stringify(Object.assign({}, plan, { handoff }), null, 1) + '\n'; }

/* ---------- to Publish ---------- */
export const isBlueprint = o => !!o && typeof o === 'object' && !!o.page && typeof o.page === 'object' && Array.isArray(o.sections);
/* {file, problems}: a pages file from blueprints. Publish reads `pages`; a blueprint needs a slug and a title to be listed. */
export function pagesFile(blueprints, handoff) {
  const problems = [], pages = [];
  (blueprints || []).forEach((b, i) => {
    if (!isBlueprint(b)) { problems.push(`item ${i + 1} is not a FORGE blueprint (it needs a page object and a sections list)`); return; }
    if (!b.page.slug) problems.push(`blueprint ${i + 1} has no page.slug, so Publish would not list it`);
    if (!b.page.title && !b.page.h1) problems.push(`blueprint ${i + 1} (${b.page.slug || 'no slug'}) has no title`);
    pages.push(b);
  });
  const slugs = pages.map(p => p.page.slug).filter(Boolean), twice = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (twice.length) problems.push(`two pages share a slug, and Publish keeps only the last one: ${[...new Set(twice)].join(', ')}`);
  return { file: JSON.stringify({ handoff, pages }, null, 1) + '\n', problems, count: pages.length };
}

/* ---------- from the dashboard ---------- */
/* what kind of file a dashboard wrote: 'desk-plan', 'pages', 'ledger', 'actuals' or '' */
export function kindOf(o) {
  if (!o || typeof o !== 'object') return '';
  if (Array.isArray(o.obs) && (has(o, 'meta') || has(o, 'atlas') || has(o, 'seeded'))) return 'ledger';
  if (o.actuals && typeof o.actuals === 'object' && !Array.isArray(o.actuals)) return 'actuals';
  if (Array.isArray(o.pages) || isBlueprint(o)) return 'pages';
  if (['line', 'budget', 'start', 'weeks', 'mix', 'picks'].filter(k => has(o, k)).length >= 2) return 'desk-plan';
  return '';
}
export function readFile(file) {
  let o; try { o = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { throw new Error(`${file} is not JSON: ${e.message}`); }
  return { kind: kindOf(o), value: o };
}

/* The competitor ledger as an agent reads it: who advertises what, at what price, on which line. Seeded rows are website
   intel from the roster date; the rest are what a person logged or imported. An empty ledger for a company means nothing
   was logged, not that nothing runs. */
export function ledger(o) {
  const obs = Array.isArray(o.obs) ? o.obs : [], live = x => x.status === 'active' || (x.status === 'unknown' && Date.now() - Date.parse(x.last || '') <= 60 * 864e5);
  const logged = obs.filter(x => x.src !== 'seed'), ads = logged.filter(x => x.kind === 'ad');
  const tally = (list, f) => { const m = {}; for (const x of list) { const k = f(x); if (k) m[k] = (m[k] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n })); };
  const offers = obs.filter(x => x.offer && x.offer.type && x.offer.type !== 'none').map(x => ({ company: x.compName || x.comp, line: x.line || '', type: x.offer.type, text: x.offer.text || x.text || '', price: fin(x.offer.price) ? x.offer.price : null, financing: x.offer.fin || '', seen: x.last || x.first || '', seeded: x.src === 'seed', flags: x.lint || [] }));
  return {
    exported: o.exported || null, entries: obs.length, seeded: obs.filter(x => x.src === 'seed').length, logged: logged.length, ads: ads.length, liveAds: ads.filter(live).length,
    byCompany: tally(ads.filter(live), x => x.compName || x.comp), byPlatform: tally(ads.filter(live), x => x.platform), byLine: tally(obs, x => x.line), byHook: tally(logged, x => x.hook),
    offers, prices: offers.filter(x => x.price != null).sort((a, b) => a.price - b.price), financing: offers.filter(x => x.type === 'financing'),
    lastLogged: logged.map(x => x.last || '').sort().pop() || null,
  };
}

/* Account results by service line and platform: spend, clicks, leads and calls, and the rates they give. Only daily ad
   rows and lead rows count, as in the dashboard's own totals. A rate from under 50 clicks or 3 leads is marked thin. */
export function actuals(o, { days = 90 } = {}) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10), cells = new Map(); let n = 0, from = '', to = '';
  for (const [key, e] of Object.entries(o.actuals || {})) for (const r of (e && e.rows) || []) {
    if (!r || !r.date || r.date < since) continue; const ads = r.kind === 'ads' && r.hour == null, lead = r.kind === 'lead'; if (!ads && !lead) continue;
    const src = r.src || key.replace(/^import:/, ''), line = r.line || 'unmapped', id = line + '|' + src; let c = cells.get(id);
    if (!c) cells.set(id, c = { line, platform: src, spend: 0, impressions: 0, clicks: 0, leads: 0, calls: 0 });
    if (ads) { c.spend += +r.spend || 0; c.impressions += +r.imp || 0; c.clicks += +r.clicks || 0; }
    c.leads += +r.leads || 0; c.calls += +r.calls || 0; n++; if (!from || r.date < from) from = r.date; if (r.date > to) to = r.date;
  }
  const rate = c => { const got = c.leads + c.calls; return Object.assign(c, { spend: Math.round(c.spend * 100) / 100, cpc: c.clicks ? Math.round(c.spend / c.clicks * 100) / 100 : null, cpl: got ? Math.round(c.spend / got * 100) / 100 : null, leadRate: c.clicks ? Math.round(got / c.clicks * 1000) / 10 : null, thin: c.clicks < 50 || got < 3 }); };
  const rows = [...cells.values()].map(rate).sort((a, b) => b.spend - a.spend);
  return { exported: o.exported || null, days, from, to, rowsRead: n, rows, unmapped: rows.filter(r => r.line === 'unmapped').reduce((s, r) => s + r.spend, 0) };
}
