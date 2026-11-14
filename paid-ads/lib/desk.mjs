/* The Campaign Desk's model, outside the dashboard.

   The dashboard's Campaign Desk (module 08) turns a plan into a media buy: it picks ZIP markets from the paid model,
   splits the money across platforms, forecasts clicks, leads and booked jobs from stated benchmarks, paces the flight by
   season, fills ad copy from the angle library to each platform's limits and writes bulk files with every campaign
   and ad paused. This file is that model, ported line for line from Build 6 of the DFW Thermal Debt Atlas, so that a
   plan an agent makes here says what the desk will say when the plan is loaded there. Where the desk's own files would
   not do what the plan intends (a bid strategy that ignores the plan's ZIP adjustments, an end date a day late, a
   sitelink with no tracking), the files written outside mirror mode differ, and each difference is marked below.

   It is a port, so it can fall behind a later build. Three things guard that: the pack carries a fingerprint of the
   desk's own code, and ported() says when it is not one this file was checked against; the tests run the same plans
   through the running dashboard and compare every figure and every exported row (tests/e2e); and `build` hands each
   finished plan to the real desk and reports any difference before it goes to a person.

   Inputs come from the dashboard link: `pack` is the paid pack (paid-ads/packs/<id>.json), `model` the connected ZIP
   model, `seasons` the twelve month index of each service line as the running dashboard computes it (or null). */

/* The Campaign Desks this file was checked against, figure for figure and row for row, by the fingerprint of the desk's
   own code (dashboard-link/lib/read.mjs: deskCode) and the build that carried it. Add a build here only after
   tests/e2e passes against it. */
export const CHECKED = { e4d378638463: '6' };
/* {same, build, why}: is the connected dashboard's Campaign Desk one this model was checked against? */
export function ported(pack) {
  const d = pack && pack.desk, builds = [...new Set(Object.values(CHECKED))].join(', ');
  if (!d || !d.code) return { same: false, build: null, why: `the pack does not say which Campaign Desk it was read from; this model was checked against Build ${builds}` };
  const b = CHECKED[d.code];
  return b ? { same: true, build: b, why: '' } : { same: false, build: null, why: `the Campaign Desk in this dashboard is not the one this model was checked against (Build ${builds})` };
}

/* ---------- house style and small helpers (src/00_core.js) ---------- */
export const DASH_RE = /[‐-―−\-]/;
export function houseClean(s) {
  if (s == null) return s;
  return String(s)
    .replace(/(\d)\s*[–-]\s*(\$?\d)/g, '$1 to $2')
    .replace(/\s*[—–―]\s*/g, ', ')
    .replace(/\bR-?(22|410A|454B|32|407C)\b/gi, (m, g) => 'R' + g.toUpperCase())
    .replace(/(\w)-(\w)/g, '$1 $2')
    .replace(/[‐-―−-]/g, ' ')
    .replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}
export const phoneFmt = p => { const d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7)}`; if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6)}`; return String(p || ''); };
const isN = v => v != null && !Number.isNaN(+v) && Number.isFinite(+v);
const sum = a => a.reduce((s, x) => s + (isN(x) ? +x : 0), 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = v => typeof v === 'number' && Number.isFinite(v);
const has = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

/* the dashboard's CSV: a cell that could be read as a formula gets an apostrophe; a .csv file is saved with a byte order mark */
export const csvQ = v => { let s = v == null ? '' : String(v); if (typeof v !== 'number' && /^[=@\t\r]|^[+-](?!\$?[\d.,]*%?$)/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function toCSV(header, rows, note) { return (note ? note.split('\n').map(l => '# ' + l).join('\n') + '\n' : '') + header.map(csvQ).join(',') + '\n' + rows.map(r => (Array.isArray(r) ? r : header.map(h => r[h])).map(csvQ).join(',')).join('\n') + '\n'; }
export const BOM = '﻿';

/* a copy template with its placeholders filled, cleaned to house style; null when it does not fit or a placeholder is left */
export function fillCopy(t, ctx, limit) {
  let s = String(t).replace(/\{(\w+)\}/g, (m, k) => ctx[k] != null && ctx[k] !== '' ? ctx[k] : m);
  s = houseClean(s);
  if (limit && s.length > limit) { const alt = String(t).replace(/\{city\}/g, ctx.short || ctx.county || 'DFW').replace(/\{(\w+)\}/g, (m, k) => ctx[k] != null && ctx[k] !== '' ? ctx[k] : m); s = houseClean(alt); if (s.length > limit) return null; }
  return /\{\w+\}/.test(s) ? null : s;
}

/* ---------- the plan ---------- */
const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && (d => !Number.isNaN(+d) && d.toISOString().slice(0, 10) === s)(new Date(s + 'T12:00:00Z'));
/* the Monday after today, the day a new plan starts on */
export function comingMonday(now = new Date()) { const d = new Date(now); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
/* the angles a line starts with: its own, and on the maintenance line the heating tune up as well in the heating season */
export function anglesOf(pack, line, start) {
  const L = pack.lines[line]; if (!L) return [];
  return L.angles.concat(line === 'maint' && pack.angles.some(a => a.id === 'heattune') && /-(09|1[0-2]|0[12])-/.test(start) ? ['heattune'] : []);
}
/* The plan as the desk holds it after a load (its cleanPlan): defaults, then every known key that passes its check. `brand`
   fills the name, license, phone, site and home city the desk would take from the dashboard's own brand. */
export function fullPlan(input, { pack, model, brand = null, now = new Date() }) {
  const s = input && typeof input === 'object' ? input : {}, D = pack.defaults || {}, PL = pack.platforms, ANG = new Set(pack.angles.map(a => a.id));
  const zipOk = new Set(model.zips.map(z => z.zip)), fipsOk = new Set(model.counties.map(c => c.fips));
  const d = { line: D.line || 'replace', budget: D.budget ?? 15000, start: comingMonday(now), weeks: D.weeks ?? 13, scope: D.scope || 'top', counties: [], picks: [], n: D.n ?? 30, minhh: D.minhh ?? 2000, alpha: D.alpha ?? 1.2, spanTh: D.spanTh ?? 20,
    brand: (brand && (brand.short || brand.name)) || 'Your Company', lic: (brand && brand.license) || 'TACLA12345C', phone: (brand && brand.phone) || '', url: (brand && brand.url) || 'https://www.example.com', city: (brand && brand.address && brand.address.city) || 'Dallas', pay: D.pay || '', bookRate: D.bookRate ?? 55, jobVal: D.jobVal ?? 3400, remarket: D.remarket ?? true };
  const p = Object.assign({}, d); if (D.v != null) p.v = D.v;
  for (const k of Object.keys(d).concat('bids')) if (has(s, k)) p[k] = s[k];
  /* A build whose plans carry a version reads a plan without one as kept from an older build, and updates it: the old fixed
     start date moves to the coming Monday, and a heating plan gains the heating angles the older build did not have. A plan
     an agent hands over always carries the version, so neither happens to it. */
  const old = D.v != null && !has(s, 'v');
  if (!has(pack.lines, p.line)) p.line = d.line; if (!isDay(p.start) || (old && p.start === '2026-10-01')) p.start = d.start; if (!['top', 'county', 'picks'].includes(p.scope)) p.scope = d.scope;
  for (const k of ['budget', 'weeks', 'n', 'minhh', 'alpha', 'spanTh', 'bookRate', 'jobVal']) if (!fin(p[k])) p[k] = d[k];
  p.weeks = clamp(p.weeks, 1, 52);
  for (const k of ['brand', 'lic', 'phone', 'url', 'city', 'pay']) if (typeof p[k] !== 'string') p[k] = d[k];
  p.picks = (Array.isArray(p.picks) ? p.picks : []).filter(z => zipOk.has(z)); p.counties = (Array.isArray(p.counties) ? p.counties : []).filter(f => fipsOk.has(f));
  p.angles = Array.isArray(s.angles) ? s.angles.filter(a => ANG.has(a)) : anglesOf(pack, p.line, p.start);
  if (old && p.line === 'heat' && Array.isArray(s.angles)) { const add = ['heatrepair', 'eheat', 'heattune'], own = pack.lines.heat.angles; p.angles = own.filter(a => add.includes(a) || p.angles.includes(a)).concat(p.angles.filter(a => !own.includes(a))); }
  const oa = s.asm || {}, om = s.mix || {};
  p.asm = Object.fromEntries(PL.order.map(k => [k, Object.assign({}, PL.assumptions[k], Object.fromEntries(['cost', 'ctr', 'cvr', 'min'].filter(f => oa[k] && fin(oa[k][f])).map(f => [f, oa[k][f]])))]));
  p.mix = Object.fromEntries(PL.order.map(k => [k, fin(om[k]) ? om[k] : ((PL.mix[p.line] || {})[k] || 0)]));
  if (p.bids && typeof p.bids !== 'object') p.bids = null;
  return p;
}

/* ---------- markets, forecast, flight ---------- */
const angleMap = pack => Object.fromEntries(pack.angles.map(a => [a.id, a]));
/* the markets a plan buys: [{z, share, spend, es, angles: [angle]}] */
export function markets(P, { pack, model }) {
  const ZR = model.zips, ZI = Object.fromEntries(ZR.map(z => [z.zip, z])), ANG = angleMap(pack);
  let pool = ZR.filter(z => z.occ >= P.minhh);
  if (P.scope === 'county' && P.counties.length) pool = pool.filter(z => P.counties.includes(z.fips));
  if (P.scope === 'picks') { const ok = new Set(ZR.map(z => z.zip)); pool = [...new Set(P.picks)].filter(zp => ok.has(zp)).map(zp => ZI[zp]); }
  else pool = pool.sort((a, b) => b.effb - a.effb).slice(0, P.n);
  const w = pool.map(z => Math.pow(Math.max(1, z.opp_usd), P.alpha)), ws = sum(w) || 1;
  const lead = ANG[((pack.lines[P.line] || {}).angles || []).find(id => P.angles.includes(id))];
  return pool.map((z, i) => { const fired = (z.fires || []).filter(id => P.angles.includes(id)).map(id => ANG[id]); return { z, share: w[i] / ws, spend: P.budget * w[i] / ws, es: z.span_sh >= P.spanTh, angles: fired.length ? fired : (lead ? [lead] : []) }; });
}
/* by platform: {spend, clicks, leads, booked} a month */
export function forecast(P, M, { pack }) {
  const PL = pack.platforms.order, out = {}, tot = Math.max(1, sum(PL.map(q => P.mix[q] || 0)));
  for (const p of PL) {
    const A = P.asm[p], spend = P.budget * (P.mix[p] || 0) / tot; if (!spend) { out[p] = { spend: 0, clicks: 0, leads: 0, booked: 0 }; continue; }
    const cm = sum(M.map(m => m.share * m.z.cpc_rel)) || 1; let clicks = 0, leads = 0;
    if (A.basis === 'CPC') { clicks = spend / (A.cost * (p === 'google' || p === 'microsoft' ? cm : 1)); leads = clicks * A.cvr / 100; }
    else if (A.basis === 'CPM') { const imp = spend / A.cost * 1000; clicks = imp * A.ctr / 100; leads = clicks * A.cvr / 100; }
    else { leads = spend / A.cost; clicks = leads; }
    const book = p === 'lsa' ? Math.min(90, P.bookRate * 1.3) : p === 'linkedin' ? 0 : P.bookRate;
    out[p] = { spend, clicks, leads, booked: leads * book / 100 };
  }
  return out;
}
export function totals(FC) { const v = Object.values(FC); return { spend: sum(v.map(x => x.spend)), clicks: sum(v.map(x => x.clicks)), leads: sum(v.map(x => x.leads)), booked: sum(v.map(x => x.booked)) }; }
/* the months a flight touches: [{m, y, days}] */
export function monthsOf(P) {
  const s = new Date(P.start + 'T12:00:00'), out = [], end = new Date(s.getTime() + P.weeks * 7 * 864e5); let d = new Date(s);
  while (d < end) { const m = d.getMonth(), nx = new Date(d.getFullYear(), m + 1, 1), segEnd = nx < end ? nx : end; out.push({ m, y: d.getFullYear(), days: Math.round((segEnd - d) / 864e5) }); d = nx; }
  return out;
}
/* which service line's season a desk line paces by */
export const SEASON_OF = { repair: 'repair', replace: 'replace', heat: 'heat', maint: 'maint', b2b: 'landlord', recruit: null, blend: 'replace', iaq: 'iaq', ductless: 'ductless', commercial: 'commercial', landlord: 'landlord' };
/* The season index a line paces by, and where it came from: the service line model when the running dashboard was read,
   else the fallback the desk itself uses when that model is out of reach. */
export function seasonFor(P, { model, seasons }) {
  const id = SEASON_OF[P.line]; if (id && seasons && Array.isArray(seasons[id]) && seasons[id].length === 12) return { index: seasons[id], from: 'the service line model, as the running dashboard computes it' };
  const S = model.seasons || {};
  if (P.line === 'heat' && S.hdd) return { index: S.hdd.map(v => 40 + v / 5), from: 'heating degree day normals (the desk\'s fallback; the service line model was not read)' };
  if (P.line === 'maint') return { index: [110, 100, 120, 130, 110, 80, 70, 70, 90, 120, 110, 90], from: 'a spring and fall tune up curve (the desk\'s fallback)' };
  return { index: S.permits || Array(12).fill(100), from: 'the Fort Worth permit season (the desk\'s fallback)' };
}
/* the flight month by month: [{m, y, days, idx, spend}] */
export function pacing(P, ctx) {
  const seas = seasonFor(P, ctx).index, mm = monthsOf(P), w = mm.map(x => seas[x.m] * x.days), ws = sum(w) || 1, total = P.budget * P.weeks / 4.345;
  return mm.map((x, i) => Object.assign({}, x, { idx: seas[x.m], spend: total * w[i] / ws }));
}

/* ---------- copy from the library ---------- */
export const cityName = (z, P) => { const c = String((z && z.city) || '').replace(/\s*\((?:CDP|unincorporated)\)\s*/gi, '').trim(); return c || P.city; };
export function ctxFor(z, P) { const city = cityName(z, P); return { city, short: city.length > 12 ? 'DFW' : city, county: (z && z.county) || '', brand: P.brand.slice(0, 25), lic: P.lic, pay: P.pay, phone: phoneFmt(P.phone) }; }
/* the responsive search ad the desk writes for an angle: up to 15 headlines of 30 and 4 descriptions of 90, the license in one */
export function rsaFor(a, z, lang, P) {
  const ctx = ctxFor(z, P), src = lang === 'es' && a.copy.es ? a.copy.es : a.copy;
  const hs = [], seen = new Set();
  (src.h || []).concat(lang === 'es' ? ['Técnicos con Licencia', 'Llame Hoy', 'Servicio en {county}'] : ['Call {brand}', 'Serving {county} County', 'Licensed HVAC Team']).forEach(h => { const t = fillCopy(h, ctx, 30); if (t && !seen.has(t.toLowerCase()) && hs.length < 15) { seen.add(t.toLowerCase()); hs.push(t); } });
  const ds = []; (src.d || []).forEach(d => { const t = fillCopy(d, ctx, 90); if (t && !ds.includes(t) && ds.length < 4) ds.push(t); });
  if (!ds.some(d => d.includes(P.lic))) { const t = fillCopy(lang === 'es' ? 'Contratista con licencia en Texas. Lic {lic}.' : 'Licensed Texas air conditioning contractor. Lic {lic}.', ctx, 90); if (t) { if (ds.length >= 4) ds[3] = t; else ds.push(t); } }
  if (ds.length < 2) (lang === 'es' ? ['Llame a {brand} hoy. Precio por escrito antes de empezar.', 'Servimos {city} y ciudades cercanas con técnicos con licencia.'] : ['Call {brand} for a written price before any work starts.', 'Serving {city} and nearby with licensed local technicians.']).forEach(x => { const t = fillCopy(x, ctx, 90); if (t && !ds.includes(t) && ds.length < 2) ds.push(t); });
  return { h: hs, d: ds };
}
export const addLic = (t, P) => (t || '').includes(P.lic) ? (t || '') : (t || '') + ' Lic ' + P.lic + '.';
/* the campaign level negatives of a plan */
export function negs(P, { pack }) {
  const N = pack.negatives || {};
  return P.line === 'recruit' ? (N.NEG_RECRUIT || []) : P.line === 'heat' || P.angles.includes('heattune') ? [...new Set((N.NEG_CUSTOMER || []).concat(N.NEG_HEAT || []))] : (N.NEG_CUSTOMER || []);
}
/* A campaign bids on a keyword from one ad group: where two angles list the same keyword, the angle that comes first in
   the library keeps it. {angleId: {core, city, questions}} */
export function kwOwn(angs, { pack }) {
  const order = pack.angles.map(a => a.id), used = new Set(), own = {};
  angs.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).forEach(a => {
    const free = ks => ks.filter(k => !used.has(k)), core = free(a.keywords.core), city = free(a.keywords.city), questions = free(a.keywords.questions);
    core.concat(city, questions).forEach(k => used.add(k)); own[a.id] = { core, city, questions };
  });
  return own;
}
export const bidOf = (z, P) => (P.bids && isN(P.bids[z.zip])) ? +P.bids[z.zip] : z.bid;
/* the service line id a campaign name carries, so the dashboard's Accounts module can file its results under the right
   line (it reads DFW_<LINE>_ from the name, letters only: b2b would not be read, landlord is) */
export const NAME_LINE = { b2b: 'landlord' };
export const campName = (P, plat, lang) => `DFW_${(NAME_LINE[P.line] || P.line).toUpperCase()}_${plat.toUpperCase()}_${lang.toUpperCase()}_${P.start.replace(/-/g, '')}`;
/* the name the desk itself gives the campaign (the same except on the b2b line) */
export const deskCampName = (P, plat, lang) => `DFW_${P.line.toUpperCase()}_${plat.toUpperCase()}_${lang.toUpperCase()}_${P.start.replace(/-/g, '')}`;
/* the day after the flight's last day, which is what the desk writes as the end date */
export const endDate = P => { const s = new Date(P.start + 'T12:00:00'); return new Date(s.getTime() + P.weeks * 7 * 864e5).toISOString().slice(0, 10); };
/* the flight's last day: a ten week flight from a Monday ends on a Sunday */
export const lastDay = P => { const s = new Date(P.start + 'T12:00:00'); return new Date(s.getTime() + (P.weeks * 7 - 1) * 864e5).toISOString().slice(0, 10); };
/* minutes from the shop to a ZIP by the Heat Desk's rule of thumb: five to roll and a minute a straight line kilometre */
export function minutesFrom(shop, z) {
  if (!shop || shop.lat == null || shop.lon == null || !z || z.lat == null || z.lon == null) return null;
  const rad = d => d * Math.PI / 180, a = Math.sin(rad(z.lat - shop.lat) / 2) ** 2 + Math.cos(rad(shop.lat)) * Math.cos(rad(z.lat)) * Math.sin(rad(z.lon - shop.lon) / 2) ** 2;
  return Math.round(5 + 6371 * 2 * Math.asin(Math.sqrt(a)));
}

/* ---------- the whole reading of a plan ---------- */
/* {P, markets, forecast, totals, flight, season, languages, angles, negatives, floors}: what the desk shows for a plan */
export function read(input, ctx) {
  const P = fullPlan(input, ctx), M = markets(P, ctx), FC = forecast(P, M, ctx), T = totals(FC), PL = ctx.pack.platforms;
  const ids = [...new Set(M.flatMap(m => m.angles.map(a => a.id)))];
  const floors = PL.order.filter(p => FC[p].spend > 0 && FC[p].spend / 30.4 < P.asm[p].min).map(p => ({ platform: p, label: PL.labels[p] || p, daily: FC[p].spend / 30.4, min: P.asm[p].min }));
  return { P, markets: M, forecast: FC, totals: T, flight: pacing(P, ctx), season: seasonFor(P, ctx), languages: ['en'].concat(M.some(m => m.es) ? ['es'] : []), angles: ids, negatives: negs(P, ctx), floors,
    costPerBooked: T.booked > 0 ? T.spend / T.booked : null, bookedValue: T.booked * P.jobVal, households: sum(M.map(m => m.z.occ)), targetCostPerBooked: P.jobVal * 0.18 };
}

/* ---------- the search build, as the desk writes it ---------- */
export const GH = ['Campaign', 'Campaign Type', 'Networks', 'Budget', 'Budget type', 'Languages', 'Bid Strategy Type', 'Start Date', 'End Date', 'Campaign Status', 'Location', 'ID', 'Bid Modifier', 'Criterion Type', 'Status', 'Ad Group', 'Ad Group Type', 'Max CPC', 'Ad Group Status', 'Keyword', 'Ad type']
  .concat([...Array(15)].map((_, i) => 'Headline ' + (i + 1))).concat([...Array(4)].map((_, i) => 'Description ' + (i + 1)))
  .concat(['Path 1', 'Path 2', 'Final URL', 'Callout text', 'Sitelink text', 'Description line 1', 'Description line 2', 'Sitelink final URL', 'Header', 'Snippet values', 'Phone number', 'Country code']);
export const pathOne = a => a.path.split('/')[1].replace(/^(.{1,15})(?:-.*)?$|^(.{15}).*$/, '$1$2');
export const pathTwo = (z, P) => cityName(z, P).toLowerCase().replace(/[^a-z]/g, '').slice(0, 15);

/* The search campaigns of a plan as data: one per language, each with its callouts, sitelinks, snippet, negatives and three
   ad groups per angle (Core in exact and phrase, Questions in phrase, Local with city names in phrase), every group with
   the one responsive search ad the desk writes. This is the starting draft an agent rewrites. */
export function searchDraft(R, ctx) {
  const { P, markets: MKT } = R, ANG = angleMap(ctx.pack), out = [];
  for (const lang of R.languages) {
    const ms = lang === 'es' ? MKT.filter(m => m.es) : MKT; if (!ms.length) continue;
    const angs = [...new Set(ms.flatMap(m => m.angles.map(a => a.id)))].map(id => ANG[id]).filter(Boolean), own = kwOwn(angs, ctx), z0 = ms[0].z;
    const cities = [...new Set(ms.map(m => cityName(m.z, P)))].slice(0, 10);
    const snip = P.line === 'heat' ? (lang === 'es' ? ['Reparación de Calefacción', 'Bombas de Calor', 'Calefacción Eléctrica', 'Cambio de Calefacción', 'Revisión de Calefacción'] : ['Furnace Repair', 'Heat Pump Repair', 'Electric Heat Repair', 'Furnace Replacement', 'Heating Tune Ups']) : angs.slice(0, 8).map(a => a.short);
    const c = { lang, callouts: (lang === 'es' ? ['Técnicos con Licencia', 'Precio Claro', 'Servicio Local'] : ['Licensed Texas Contractor', 'Upfront Pricing', 'Local Crews', 'Matched Systems']).map(houseClean),
      sitelinks: angs.slice(0, 4).map(a => ({ text: a.short.slice(0, 25), d1: lang === 'es' ? 'Técnicos con licencia' : 'Licensed Texas crews', d2: lang === 'es' ? 'Precio por escrito' : 'Written quotes', path: a.path })),
      snippets: snip.length >= 3 ? { header: lang === 'es' ? 'Servicios' : 'Services', values: snip } : null, negatives: R.negatives.slice(), adGroups: [] };
    for (const a of angs) {
      const src = own[a.id];
      const groups = [['Core', src.core, ['exact', 'phrase']], ['Questions', src.questions, ['phrase']], ['Local', src.city.flatMap(k => cities.map(cc => k.replace('{city}', cc.toLowerCase()))), ['phrase']]];
      for (const [kind, kws, match] of groups) {
        if (!kws.length) continue; const seen = new Set(), keywords = [];
        for (const k of kws) { const kk = k.toLowerCase().trim(); if (seen.has(kk)) continue; seen.add(kk); for (const mt of match) keywords.push({ text: kk, match: mt }); }
        const r = rsaFor(a, kind === 'Local' ? z0 : null, lang, P);
        c.adGroups.push({ name: a.short + ' ' + kind, angle: a.id, kind: kind.toLowerCase(), keywords, negatives: [], ad: { headlines: r.h, descriptions: r.d, path1: pathOne(a), path2: pathTwo(z0, P), url: a.path } });
      }
    }
    out.push(c);
  }
  return out;
}

/* The rows of a Google Ads Editor file (or Microsoft's import of the same sheet) for search campaigns written as in
   searchDraft. Every campaign and every ad is paused. A position column is added only where an asset is pinned.

   With ctx.mirror the rows are the desk's own, column for column, which is what the tests compare against the running
   dashboard. Without it, three things follow Google Ads Editor's documented columns where the desk's differ: a
   sitelink's page goes in Final URL (the desk writes a "Sitelink final URL" column Editor does not list), the call
   asset's country goes in Country of phone (the desk writes "Country code"), and campaigns take the name the
   dashboard's Accounts module can read back. */
export const COLS = { desk: { siteUrl: 'Sitelink final URL', country: 'Country code' }, editor: { siteUrl: 'Final URL', country: 'Country of phone' } };
/* How a campaign bids. The desk writes "Maximize conversions" beside ZIP bid adjustments and a Max CPC, and Google's Smart
   Bidding strategies do not use manual bid adjustments (support.google.com/google-ads/answer/2732132, read 2026-11-14).
   Outside mirror mode a campaign therefore runs on Maximize clicks with a maximum CPC bid limit, where the plan's ZIP
   adjustments are in force, unless the campaign file names another strategy. */
export const BIDDING = { clicks: 'Maximize clicks', conversions: 'Maximize conversions', manual: 'Manual CPC' };
export const biddingOf = c => BIDDING[String((c && c.bidding) || 'clicks').toLowerCase().replace(/^maximize\s+/, '').replace(/\s*cpc$/, '')] || BIDDING.clicks;
/* The share of a platform's search money each language's campaign gets. The desk gives a Spanish campaign 30% and the
   English one the rest; a campaign file may set "share" (0 to 1) on the Spanish campaign to change that. */
export function languageShares(campaigns, R) {
  const live = campaigns.filter(c => (c.lang === 'es' ? R.markets.some(m => m.es) : R.markets.length > 0)), es = live.find(c => c.lang === 'es'), en = live.find(c => c.lang !== 'es');
  const given = es && typeof es.share === 'number' && es.share > 0 && es.share < 1 ? es.share : null, esShare = es ? (en ? (given ?? 0.3) : 1) : 0;
  return { es: esShare, en: en ? (es ? (given != null ? 1 - given : (R.languages.length > 1 ? 0.7 : 1)) : (R.languages.length > 1 ? 0.7 : 1)) : 0 };
}
export function searchRows(campaigns, plat, R, ctx) {
  const { P, markets: MKT, forecast: FC, languages } = R, rows = [], spend = FC[plat].spend, name = ctx.mirror ? deskCampName : campName, K = ctx.mirror ? COLS.desk : COLS.editor;
  const txt = x => (typeof x === 'string' ? x : x && x.text), pin = x => (x && typeof x === 'object' && x.pin ? x.pin : 0), shares = ctx.mirror ? null : languageShares(campaigns, R);
  for (const c of campaigns) {
    const lang = c.lang, ms = lang === 'es' ? MKT.filter(m => m.es) : MKT; if (!ms.length) continue;
    const cn = name(P, plat, lang) + (plat === 'microsoft' ? '_MS' : ''), monthly = ctx.mirror ? (lang === 'es' ? spend * 0.3 : spend * (languages.length > 1 ? 0.7 : 1)) : spend * (lang === 'es' ? shares.es : shares.en);
    const cmx = sum(ms.map(m => m.share * (m.z.cpc_rel || 1))) / (sum(ms.map(m => m.share)) || 1), maxcpc = (P.asm[plat].cost * cmx).toFixed(2), strategy = ctx.mirror ? BIDDING.conversions : biddingOf(c);
    const camp = { 'Campaign': cn, 'Campaign Type': 'Search', 'Networks': ctx.mirror ? 'Google search' : plat === 'google' ? 'Google Search' : '', 'Budget': (monthly / 30.4).toFixed(2), 'Budget type': 'Daily', 'Languages': lang === 'es' ? 'Spanish' : 'English', 'Bid Strategy Type': strategy, 'Start Date': P.start, 'End Date': ctx.mirror ? endDate(P) : lastDay(P), 'Campaign Status': 'Paused' };
    if (!ctx.mirror && strategy === BIDDING.clicks) camp['Maximum CPC bid limit'] = maxcpc;
    rows.push(camp);
    ms.forEach(m => rows.push({ 'Campaign': cn, 'Location': `${m.z.zip}, Texas, United States`, 'ID': plat === 'google' ? (m.z.gid || '') : '', 'Bid Modifier': (bidOf(m.z, P) >= 0 ? '+' : '') + bidOf(m.z, P) + '%', 'Criterion Type': 'Location', 'Status': 'Enabled' }));
    (c.negatives || []).forEach(k => rows.push({ 'Campaign': cn, 'Keyword': k, 'Criterion Type': 'Negative Phrase', 'Status': 'Enabled' }));
    (c.callouts || []).forEach(t => rows.push({ 'Campaign': cn, 'Callout text': t, 'Status': 'Enabled' }));
    (c.sitelinks || []).forEach(s => rows.push({ 'Campaign': cn, 'Sitelink text': s.text, 'Description line 1': s.d1, 'Description line 2': s.d2, [K.siteUrl]: ctx.mirror ? (/^https?:/i.test(s.path || '') ? s.path : P.url.replace(/\/$/, '') + (s.path || '')) : finalUrl(P, s.path || '', { source: plat, campaign: cn, content: 'sitelink' }), 'Status': 'Enabled' }));
    if (c.snippets && (c.snippets.values || []).length >= 3) rows.push({ 'Campaign': cn, 'Header': c.snippets.header, 'Snippet values': c.snippets.values.join('; '), 'Status': 'Enabled' });
    if (P.phone) rows.push({ 'Campaign': cn, 'Phone number': phoneFmt(P.phone), [K.country]: 'US', 'Status': 'Enabled' });
    for (const g of c.adGroups || []) {
      if (!(g.keywords || []).length) continue;
      /* an ad group may bid under or over the campaign's click cost: "bid": 0.5 halves it (research searches), "maxCpc" sets dollars */
      const own = ctx.mirror ? maxcpc : (typeof g.maxCpc === 'number' && g.maxCpc > 0 ? g.maxCpc.toFixed(2) : typeof g.bid === 'number' && g.bid > 0 ? (+maxcpc * g.bid).toFixed(2) : maxcpc);
      rows.push({ 'Campaign': cn, 'Ad Group': g.name, 'Ad Group Type': 'Standard', 'Max CPC': own, 'Ad Group Status': 'Enabled' });
      for (const k of g.keywords) rows.push({ 'Campaign': cn, 'Ad Group': g.name, 'Keyword': k.text, 'Criterion Type': k.match === 'exact' ? 'Exact' : k.match === 'broad' ? 'Broad' : 'Phrase', 'Status': 'Enabled' });
      for (const k of g.negatives || []) rows.push({ 'Campaign': cn, 'Ad Group': g.name, 'Keyword': typeof k === 'string' ? k : k.text, 'Criterion Type': typeof k === 'object' && k.match === 'exact' ? 'Negative Exact' : 'Negative Phrase', 'Status': 'Enabled' });
      const ad = g.ad || {}, o = { 'Campaign': cn, 'Ad Group': g.name, 'Ad type': 'Responsive search ad', 'Path 1': ad.path1 || '', 'Path 2': ad.path2 || '', 'Final URL': finalUrl(P, ad.url || '', { source: plat, campaign: cn, content: g.angle }), 'Status': 'Paused' };
      (ad.headlines || []).forEach((h, i) => { o['Headline ' + (i + 1)] = txt(h); if (pin(h)) o['Headline ' + (i + 1) + ' position'] = pin(h); });
      (ad.descriptions || []).forEach((d, i) => { o['Description ' + (i + 1)] = txt(d); if (pin(d)) o['Description ' + (i + 1) + ' position'] = pin(d); });
      rows.push(o);
    }
  }
  return rows;
}
/* the header for a set of rows: the desk's columns (or Editor's, see searchRows), with a position column after each pinned
   headline or description */
export function searchHeader(rows, mirror = false) {
  const limit = !mirror && rows.some(r => r['Maximum CPC bid limit'] != null);
  const base = mirror ? GH : GH.filter(h => h !== COLS.desk.siteUrl).flatMap(h => (h === COLS.desk.country ? [COLS.editor.country] : h === 'Bid Strategy Type' && limit ? [h, 'Maximum CPC bid limit'] : [h]));
  const pinned = new Set(rows.flatMap(r => Object.keys(r).filter(k => / position$/.test(k))));
  if (!pinned.size) return base;
  return base.flatMap(h => (pinned.has(h + ' position') ? [h, h + ' position'] : [h]));
}
/* a landing URL: the site, the page path (or a full URL as given), and the desk's tracking parameters */
export function finalUrl(P, pathOrUrl, { source, campaign, content }) {
  const base = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : P.url.replace(/\/$/, '') + (pathOrUrl.startsWith('/') || !pathOrUrl ? pathOrUrl : '/' + pathOrUrl);
  return base + (base.includes('?') ? '&' : '?') + `utm_source=${source}&utm_medium=cpc&utm_campaign=${encodeURIComponent(campaign)}&utm_content=${content}`;
}

/* ---------- the social build, as the desk writes it ---------- */
export const SOCIAL_COLS = ['Campaign Name', 'Campaign Objective', 'Special Ad Categories', 'Ad Set Name', 'Zip', 'Radius', 'Ad Name', 'Title', 'Body', 'Link', 'Call to Action', 'Status'];
/* financing in the copy moves a Meta ad into the Financial products special ad category: no ZIP targeting there */
export const isFinancing = (angle, text) => /financ/i.test(text || '') || angle === 'financing';
/* The wider test this toolkit uses for its own files: any talk of credit, not only the word "financing". ("Tax credit" is
   not credit, and "apr" must stand alone: the desk's rule reads it inside "Aproveche".) */
export const talksCredit = (angle, text) => isFinancing(angle, text) || /\bapr\b|(?<!tax )\bcredit\b|\bloans?\b|\bmonthly payments?\b|\bno interest\b|\bdeferred interest\b|\b0% |\bcr[eé]dito\b|\bpagos mensuales\b/i.test(text || '');
/* the ads the desk would write for a social platform, one per angle and language, as data an agent rewrites */
export function socialDraft(R, plat, ctx) {
  const { P, markets: MKT } = R, ANG = angleMap(ctx.pack), out = [];
  const angs = [...new Set(MKT.flatMap(m => m.angles.map(a => a.id)))].map(id => ANG[id]).filter(Boolean);
  for (const a of angs) for (const lang of R.languages) {
    const ms = lang === 'es' ? MKT.filter(m => m.es) : MKT, c = ctxFor(ms[0] && ms[0].z, P), s = a.copy.social || {};
    out.push({ channel: plat, angle: a.id, lang, name: a.short + ' ' + lang.toUpperCase(), headline: fillCopy(lang === 'es' && a.copy.es && a.copy.es.h[0] ? a.copy.es.h[0] : s.headline, c, 40) || a.short,
      primary: addLic(fillCopy(lang === 'es' && a.copy.es ? a.copy.es.d[0] : s.primary, c), P), description: lang === 'es' ? '' : (fillCopy(s.description, c, 30) || ''), cta: 'Get Quote', url: a.path });
  }
  return out;
}
/* The rows of a social build sheet. With ctx.mirror they are the desk's own, column for column. Without it three things
   change, because the sheet is built by hand from: the ads of a language share one ad set (the desk names one ad set an
   ad, which splits a small budget into ad sets too thin to learn), every row says its language, the landing link carries
   the tracking parameters, and an ad that talks of credit in any words goes to the special ad category campaign. */
export const SOCIAL_COLS_OUT = SOCIAL_COLS.slice(0, 4).concat(['Language'], SOCIAL_COLS.slice(4));
export function socialRows(ads, plat, R, ctx) {
  const { P, markets: MKT } = R, ANG = angleMap(ctx.pack), name = ctx.mirror ? deskCampName : campName;
  return ads.filter(x => x.channel === plat).map(x => {
    const lang = x.lang || 'en', ms = lang === 'es' ? MKT.filter(m => m.es) : MKT, a = ANG[x.angle] || {}, said = [x.primary, x.headline, x.description].join(' ');
    const finance = isFinancing(x.angle, (a.copy && a.copy.social && a.copy.social.primary) || '') || isFinancing(x.angle, said) || (!ctx.mirror && talksCredit(x.angle, said));
    const sac = finance && plat === 'meta', cn = name(P, plat, lang) + (finance ? '_SAC' : ''), own = x.name || ((a.short || x.angle) + ' ' + lang.toUpperCase()), page = x.url || a.path || '';
    const row = { 'Campaign Name': cn, 'Campaign Objective': 'Leads', 'Special Ad Categories': sac ? 'Financial products and services' : '', 'Ad Set Name': ctx.mirror ? own : `${lang.toUpperCase()} ${sac ? 'radius' : 'ZIP list'}`, 'Zip': sac ? '' : ms.map(m => 'US:' + m.z.zip).join(', '), 'Radius': sac ? '15 mi around ' + (P.city || 'Dallas') + ', TX' : '', 'Ad Name': own, 'Title': x.headline || '', 'Body': x.primary || '', 'Link': ctx.mirror ? (/^https?:/i.test(page) ? page : P.url.replace(/\/$/, '') + page) : finalUrl(P, page, { source: plat, campaign: cn, content: x.angle || 'ad' }), 'Call to Action': x.cta || 'Get Quote', 'Status': 'Paused' };
    if (!ctx.mirror) row.Language = lang === 'es' ? 'Spanish' : 'English';
    return row;
  });
}
