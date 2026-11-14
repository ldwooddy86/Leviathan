/* Module 17 Heat Desk, the page. The answer block says what the tables say; every control changes the plan and survives a
   reload; a routed ZIP opens its card; every file downloads and reads back; no visible string is hyphenated or broken; the
   page stands with no live record at all, with the forecast alone and with every record present; the Campaign Desk gets
   the ZIPs. Engine numbers are never written here: each check compares the page with what HEATX returns in the same page.
   The live reads are checked twice: with hand made records dated from today (so the checks never age), and on the recorded
   day, with every record made by its own collector from the recorded answers under tests/fixtures and the page's clock held
   at that afternoon; there each read is also checked with its record taken out. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { context, load, fakeFetch, plain, ROOT, liveFiles } from '../helpers/load.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const DASH = /[A-Za-zÀ-ɏ][-‐-―−][A-Za-zÀ-ɏ]/;     // a letter, a hyphen or dash of any kind, a letter
const MARK = /[‐-―−]/;                                                 // a typographic dash or a minus sign
const BROKEN = /undefined|NaN|\[object Object\]/;
const IDENT = /^[("']*(?:https?:\/\/\S+|[\w.-]+\.(?:csv|json|html|js|mjs|zip|txt))[)"'.,;:]*$/i;   // file names and links are identifiers, not prose
const around = (text, re) => (text.match(new RegExp('.{0,30}(?:' + re.source + ').{0,20}', 'g')) || []).slice(0, 5);
/* RFC 4180, enough to read what the atlas writes: quoted fields, doubled quotes, line breaks inside quotes */
function csv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c; }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return { rows: rows.filter(r => !(r.length === 1 && r[0] === '')), open: q };
}
/* a stored (uncompressed) zip read back from its central directory */
function unzip(buf) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--; if (e < 0) return null;
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const files = [];
  for (let i = 0; i < n; i++) { if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nl);
    if (buf.readUInt32LE(off) !== 0x04034b50 || method !== 0) return null; const ds = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    files.push({ name, buf: buf.subarray(ds, ds + size), text: buf.toString('utf8', ds, ds + size) }); p += 46 + nl + xl + cl; }
  return files;
}
let BASE = Date.now();                                                     // the moment "now" for the hand made records: the page's clock, once the test has set it
const iso = n => new Date(BASE - n * 864e5).toISOString();                 // n days ago (negative: ahead)
const ymd = n => iso(n).slice(0, 10);
const rec = (id, data, daysOld) => ({ v: 1, id, ok: true, at: iso(daysOld == null ? 0.05 : daysOld), ms: 5, n: 1, bytes: 100, data, digest: null });

/* hand made records in the shapes the collectors store (prefix synthetic: none of this is a recorded answer) */
export function synthetic(counties) {
  const COLS = ['hdd', 'hddNorm', 'hddOct', 'missOct', 'hdd7', 'miss7', 'hdd7Norm', 'hdd30', 'miss30', 'hdd30Norm', 'fr32', 'fr25', 'firstFreeze', 'lastFreeze', 'minT', 'minDate', 'min7', 'missJul', 'ok'];
  const lows = k => Array.from({ length: 14 }, (_, i) => 52 - k - (i % 5) * 3), highs = k => lows(k).map(v => v + 19);
  const acis = { v: 1, season: +ymd(0).slice(0, 4) - (+ymd(0).slice(5, 7) < 7 ? 1 : 0), through: ymd(1), blocks: { W1: ymd(1), W2: ymd(1) },
    stations: { 29755: { name: 'DALLAS FORT WORTH AP', label: 'DFW Airport', icao: 'KDFW', ghcn: 'USW00003927', fips: '48439', lat: 32.8974, lon: -97.022, elev: 560 }, 90001: { name: 'DALLAS LOVE FIELD', label: 'Dallas Love Field', icao: 'KDAL', fips: '48113', lat: 32.8542, lon: -96.8551, elev: 440 }, 90002: { name: 'TERRELL MUNI AP', label: 'Terrell', icao: 'KTRL', fips: '48257', lat: 32.7136, lon: -96.2683, elev: 470 } },
    std: { cols: COLS, 29755: [212, 240, 180, 0, 61, 0, 55, 190, 0, 200, 0, 0, null, null, 38, ymd(3), 38, 0, 1], 90001: [198, 228, 170, 0, 57, 0, 52, 180, 0, 190, 0, 0, null, null, 40, ymd(3), 40, 0, 1], 90002: [230, 250, 195, 0, 66, 0, 58, 205, 0, 212, 0, 0, null, null, 35, ymd(3), 35, 0, 1] },
    daily: { start: ymd(14), tn: { 29755: lows(0), 90001: lows(-2), 90002: lows(3) }, tx: { 29755: highs(0), 90001: highs(-2), 90002: highs(3) } }, stale: {}, errs: {} };
  const win = (issued, a, b, cat, prob, idx) => ({ issued: ymd(issued), start: ymd(-a), end: ymd(-b), file: iso(issued), cat, prob, uniform: true, bands: [{ cat, prob }], counties: null, load: { days: b - a + 1, normHdd: 10.2, expHdd: 10.2 * idx / 100, idx, coldBelowF: 53.7, coldHdd: 16.8 } });
  const cpc = { v: 1, ext: { d610: win(1, 6, 10, 'Below', 40, 128), d814: win(1, 8, 14, 'Above', 33, 97) }, haz: { file: {}, national: [], metro: [] }, winter: { file: null, minor: [], moderate: [] }, text: {}, long: null, hist: [{ issued: ymd(1), d610: 'B40', d814: 'A33' }], errs: {} };
  const recalls = { since: '2019-01-01', failed: 0, recalls: [
    { id: 9001, no: '27-001', d: ymd(40), title: 'Synthetic Heating Co. Recalls Gas Furnaces Due to Fire Hazard – Sold Under the Comfort-Aire Name', url: 'https://www.cpsc.gov/Recalls/2027/synthetic', product: 'Gas furnaces', units: 12400, kind: 'furnace', hazards: ['fire'], hazard: 'The burner can overheat.', maker: 'Synthetic Heating Co.' },
    { id: 9002, no: '26-700', d: ymd(200), title: 'Synthetic Air Recalls Heat Pumps Due to Shock Hazard', url: 'https://www.cpsc.gov/Recalls/2026/synthetic', product: 'Heat pumps', units: 3100, kind: 'heatpump', hazards: ['shock'], hazard: 'x', maker: 'Synthetic Air' },
    { id: 9003, no: '26-650', d: ymd(90), title: 'Synthetic Recalls Space Heaters Due to Burn Hazard', url: '', product: 'Space heaters', units: 900, kind: 'room', hazards: ['burn'], hazard: 'x', maker: 'Synthetic' },
    { id: 9004, no: '24-100', d: ymd(900), title: 'Synthetic Recalls Boilers Due to Carbon Monoxide Hazard', url: '', product: 'Boilers', units: 500, kind: 'boiler', hazards: ['carbon monoxide'], hazard: 'x', maker: 'Synthetic' }] };
  const rules = { v: 1, through: ymd(0), since: ymd(730), failed: 0, stale: [], docs: [
    { id: '2027-00001', d: ymd(12), type: 'Rule', agency: 'DOE', title: 'Energy Conservation Program: Test Procedure for Consumer Furnaces (synthetic)', url: 'https://www.federalregister.gov/documents/synthetic-1', topic: 'furnace', effective: ymd(-45), comments: null, action: 'Final rule.' },
    { id: '2027-00002', d: ymd(30), type: 'Proposed Rule', agency: 'FTC', title: 'Rule on Unfair or Deceptive Fees (synthetic)', url: 'https://www.federalregister.gov/documents/synthetic-2', topic: 'advertising', effective: null, comments: ymd(-20), action: 'Proposed rule.' },
    { id: '2025-00003', d: ymd(400), type: 'Rule', agency: 'EPA', title: 'Phasedown of Hydrofluorocarbons (synthetic)', url: '', topic: 'refrigerant', effective: ymd(380), comments: null, action: 'Final rule.' }] };
  const lic = { v: 1, asOf: iso(25), asOfDay: ymd(25), checked: iso(0), basis: 'synthetic', badDates: 0, stale: [], texas: null, entrants: null, before: null,
    counties: counties.map((c, i) => ({ name: c.name, fips: c.fips, contractors: 40 + i * 37, classA: 20 + i * 10, comfort: 38 + i * 30, techs: 300 + i * 90, certified: 100 + i * 20, expiring90: 5 + i, lapsed: 3 + i, new12: 4 + i, contractorsPer10kHomes: null })), total: { contractors: 0 } };
  const months = Array.from({ length: 36 }, (_, i) => { const d = new Date(Date.UTC(+ymd(0).slice(0, 4), +ymd(0).slice(5, 7) - 37 + i, 1)); return { m: d.toISOString().slice(0, 7), mech: 700 + (i % 12) * 40, heat: null, heatOnly: null }; });
  const permits = { v: 1, city: 'Fort Worth', through: ymd(2), months, byZip12: { 76102: [120, null], 76244: [340, null], 76116: [210, null], 76179: [185, null] }, zipMonths: [months[24].m, months[35].m], recent: { weeks: 8, from: ymd(58), to: ymd(2), mech: 1300, heat: null, sameWeeksLastYear: { from: ymd(422), to: ymd(366), mech: 1210, heat: null } }, described: { n: 3, of: 100 }, multi: 0, rule: '', what: 'synthetic', residentialOnly: false, stale: [] };
  const prices = { through: ymd(30).slice(0, 7), series: { electricity: { id: 'SYN1', points: [{ p: ymd(395).slice(0, 7), v: 200 }, { p: ymd(30).slice(0, 7), v: 208.4 }] }, gas: { id: 'SYN2', points: [{ p: ymd(395).slice(0, 7), v: 150 }, { p: ymd(30).slice(0, 7), v: 148.1 }] } }, yoy: { electricity: 4.2, gas: -1.3 } };
  const nbm = { v: 1, model: 'NBE', run: iso(0.2), from: 6, th: { freeze: 32, cold: 40, hard: 25 }, stations: [{ id: 'KDTO', name: 'Denton', county: 'Denton', run: iso(0.2), nights: [6, 7, 8, 9, 10, 11].map(k => ({ m: ymd(-k), d: ymd(1 - k), lead: k, lowF: 44 - (k % 3), sd: 7, p32: 6 + k, p40: 30, p25: 1, ext: k >= 8 })), days: [] }] };
  const grid = { v: 1, day: ymd(0), cond: { state: 'normal', level: 1, name: 'Normal conditions', title: 'Normal Conditions', note: 'There is enough power for current demand.', eea: 0, prcMw: 9000, at: iso(0.1), updated: iso(0.1), since: iso(2) }, condStale: false, days: [], daysStale: false, zone: [], errs: {} };
  return { acis_season: rec('acis_season', acis), cpc_outlook: rec('cpc_outlook', cpc), nbm_extended: rec('nbm_extended', nbm), ercot_grid: rec('ercot_grid', grid), cpsc_recalls: rec('cpsc_recalls', recalls), fedreg_rules: rec('fedreg_rules', rules), tdlr_licenses: rec('tdlr_licenses', lic), permits_fortworth: rec('permits_fortworth', permits), bls_energy: rec('bls_energy', prices) };
}

/* The recorded day. Every live record as its collector stores it, made by running the collectors themselves (in Node, through the live layer's
   own refresh) on the recorded answers of 2026-11-13 under tests/fixtures: no network, no hand made shape. The forecast record is the one the
   cold collector stored that afternoon. `now` is the moment the page's clock is held at while these records are in its store. */
export const RECORDED_NOW = '2026-11-13T18:40:00Z';
export async function recorded() {
  const FX = join(ROOT, 'tests', 'fixtures'), D = '2026-11-13', raw = (dir, n) => readFileSync(join(FX, dir, n), 'utf8'), o = (dir, n) => raw(dir, `${n}-${D}.json`);
  const L = load(context({ setTimeout: (fn, ms, ...a) => setTimeout(fn, ms >= 20000 ? ms : 0, ...a) }), ...liveFiles().filter(f => f !== 'live/page.js')).TDA_LIVE;
  /* which recorded answer a request is asking for */
  const acis = init => { const b = JSON.parse(init.body); return b.sids ? 'w1-airports-daily' : b.grid ? (b.elems.some(e => e.smry) ? 'g2-prism-30-fall-mean' : 'g1-prism-season-to-date') : b.date ? 'w2-station-reductions' : 'w3-same-span-1991-2020'; };
  const fortWorth = init => { const q = new URLSearchParams(init.body); return q.get('having') ? 'multi' : /^EXTRACT/.test(q.get('groupByFieldsForStatistics') || '') ? 'months' : 'zips'; };
  const dallas = u => { const q = new URL(u).searchParams.get('$select') || ''; return /^max\(/.test(q) ? 'newest' : /^zip_code as z/.test(q) ? 'zips' : 'months'; };
  const routes = [
    [/www\.ercot\.com/, u => (u.endsWith('/daily-prc.json') ? o('outlook', 'ercot-daily-prc') : u.endsWith('/supply-demand.json') ? o('outlook', 'ercot-supply-demand') : u.includes('20261112_actual') ? raw('outlook', `ercot-zones-20261112-${D}.html`) : { status: 404, body: 'x' })],
    ['mesonet.agron.iastate.edu/api/1/mos.json', o('outlook', 'iem-mos-nbe-six-airports')], ['/locations/MRD/latest', o('outlook', 'pmd-mrd')], ['/locations/THR/latest', o('outlook', 'pmd-thr')], ['/locations/ENS/latest', o('outlook', 'pmd-ens')],
    [/cpc_6_10_day_outlk\/MapServer\/0\/query/, o('outlook', 'cpc-610-temp-multipoint')], [/cpc_8_14_day_outlk\/MapServer\/0\/query/, o('outlook', 'cpc-814-temp-multipoint')], [/cpc_6_10_day_outlk\/MapServer\/1\/query/, o('outlook', 'cpc-610-precip-point')], [/cpc_8_14_day_outlk\/MapServer\/1\/query/, o('outlook', 'cpc-814-precip-point')],
    [/cpc_mthly_temp_outlk/, o('outlook', 'cpc-month-temp-point')], [/cpc_sea_temp_outlk\/MapServer\/identify/, o('outlook', 'cpc-season-temp-identify')], [/cpc_weather_hazards\/MapServer\/(\d)\/query\?where/, u => o('outlook', `hazards-L${/MapServer\/(\d)/.exec(u)[1]}-national`)], [/cpc_weather_hazards/, '{"features":[]}'], [/wpc_wssi_p/, '{"features":[]}'],
    [/^https:\/\/data\.rcc-acis\.org\/(MultiStnData|GridData)$/, (u, init) => o('acis', acis(init))],
    ['/api/views/metadata/v1/7358-krk7', o('tdlr', 'metadata-november-file')], ['$select=license_type%2Cbusiness_county', o('tdlr', 'counts-by-county-november-file')], ['$select=license_type%2Ccount', o('tdlr', 'texas-totals-november-file')], ['$select=business_county%2Ccount', o('tdlr', 'entrants-by-county-november-file')], ['$select=license_number', o('tdlr', 'newest-november-file')],
    [/\/documents\/\d{4}-\d+,/, o('fedreg', 'documents-standing')], [/energy-department/, o('fedreg', 'search-equipment')], [/environmental-protection-agency/, o('fedreg', 'search-refrigerant')], [/federal-trade-commission/, o('fedreg', 'search-advertising')], [/home%20improvement/, o('fedreg', 'search-credit')],
    [/RecallTitle=furnace/, o('cpsc', 'recall-title-furnace')], [/RecallTitle=heat%20pump/, o('cpsc', 'recall-title-heat-pump')], [/RecallTitle=heater/, o('cpsc', 'recall-title-space-heater')], [/RecallTitle=/, '[]'],
    [/^https:\/\/www\.dallasopendata\.com\/resource\/e7gq-4sah\.json\?/, u => o('permits_dallas', dallas(u))],
    [/3ddLCBXe1bRt7mzj.*\/FeatureServer\/0\/query$/, (u, init) => o('permits', 'fortworth-' + fortWorth(init))],
  ];
  const ids = ['cpc_outlook', 'nbm_extended', 'ercot_grid', 'acis_season', 'tdlr_licenses', 'fedreg_rules', 'cpsc_recalls', 'permits_dallas', 'permits_fortworth'], store = L.memoryStore(), fetch = fakeFetch(routes);
  const r = await L.refresh({ scope: ids, store, fetch, env: 'node', force: true, now: () => new Date(RECORDED_NOW), http: { backoffMs: 1, gapMs: 0 } });
  const recs = { nws_cold: JSON.parse(raw('nwsx', `live-nws-cold-${D}.json`)) }; delete recs.nws_cold.prev;
  for (const id of ids) { const x = await store.get(L.K.src(id)); if (x) recs[id] = plain(x); }
  return { now: RECORDED_NOW, ids: ['nws_cold'].concat(ids), recs, failed: plain(r.failed).map(f => f.id + ': ' + f.msg), calls: fetch.calls.length };
}
/* the season record with a first freeze written into the station rows of two outer counties (Wise and Hunt) five days before the recording: DFW Airport has none yet */
export function frozenRim(season) {
  const d = JSON.parse(JSON.stringify(season)), ix = k => d.data.std.cols.indexOf(k);
  for (const [uid, st] of Object.entries(d.data.stations)) if ((st.fips === '48497' || st.fips === '48231') && d.data.std[uid]) { const row = d.data.std[uid]; row[ix('firstFreeze')] = '2026-11-08'; row[ix('fr32')] = 2; row[ix('minT')] = 29; row[ix('minDate')] = '2026-11-08'; }
  return d;
}

export default async function (page, t, ctx) {
  /* Storage for the next document is seeded inside that document, before any page script runs: it travels in window.name. In this
     headless browser a document opened right after a localStorage write in the one before it can still read the older state
     (measured: about one load in three), so writing first and loading after is not a reliable way to set a page up.
     The same script lets a test load the page without the baked live baseline or without the climate baseline. */
  await page.addInitScript(() => { try {
    if (typeof window.name === 'string' && window.name.indexOf('tda-seed:') === 0) { const s = JSON.parse(window.name.slice(9)); window.name = ''; localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); }
    const off = (flag, name) => { if (localStorage.getItem(flag)) Object.defineProperty(window, name, { get: () => null, set: () => { }, configurable: true }); }; off('tda.test.nolive', '__LIVE_BASELINE__'); off('tda.test.noclim', '__CLIMATE_BASE__'); } catch (e) { } });
  const wait = ms => page.waitForTimeout(ms);
  const show = async (key, payload) => { await ctx.show(key || 'heat', payload); await wait(350); };          // the lower blocks of the page are drawn a moment after the upper ones
  const load = async entries => { await page.evaluate(s => { window.name = 'tda-seed:' + JSON.stringify(s); }, entries); await page.goto(ctx.url, { waitUntil: 'load' }); await show(); };
  const fresh = storage => { const s = { 'tda.live.settings': JSON.stringify({ auto: false }) }; for (const k in (storage || {})) s[k] = typeof storage[k] === 'string' ? storage[k] : JSON.stringify(storage[k]); return load(s); };
  const reload = async () => load(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))));          // a new document on exactly what this one stored
  const press = async sel => { const e = page.locator(sel).first(); await e.evaluate(x => x.scrollIntoView({ block: 'center' })); await e.click(); await wait(120); };
  /* The clock. The page's clock is held 25 minutes after the forecast baked into the build was taken, so that forecast is always fresh here and
     no check ages with the calendar (without this the test passes only within 36 hours of a bake, and loses the forecast altogether after a week).
     The hand made records are dated from the same moment. Timers keep running: only the date stands still. */
  const bakedAt = await page.evaluate(() => { try { const r = LIVE.baseline && LIVE.baseline.records && LIVE.baseline.records.nws_cold; return r && r.at ? r.at : null; } catch (e) { return null; } });
  if (bakedAt && !Number.isNaN(+new Date(bakedAt))) { BASE = +new Date(bakedAt) + 25 * 60000; await page.clock.setFixedTime(new Date(BASE)); await page.goto(ctx.url, { waitUntil: 'load' }); }
  t.ok(!!bakedAt && await page.evaluate(b => Math.abs(Date.now() - b) < 1000 && Math.abs(+new Date() - b) < 1000, BASE), 'the page\'s clock is held 25 minutes after the baked forecast was taken, so the checks do not age with the calendar', bakedAt);
  const names = await page.evaluate(() => COMP.map(l => l.name));
  /* everything a person can read in the module: the text on screen with every drawer opened, and the texts that show on hover or to a screen reader */
  const visible = async sel => page.evaluate(([q, drop]) => { const r = document.querySelector(q || '#mod-heat'); r.querySelectorAll('details').forEach(d => { d.open = true; }); let s = r.innerText + '\n' + [...r.querySelectorAll('[title],[aria-label],[placeholder],[alt]')].map(e => [e.getAttribute('title'), e.getAttribute('aria-label'), e.getAttribute('placeholder'), e.getAttribute('alt')].filter(Boolean).join('\n')).join('\n'); /* the publisher's own words (a forecaster's sentence, the title of a recall or of a rule) are shown as published and marked data-asis: they are not the atlas's prose */
    for (const n of [...r.querySelectorAll('[data-asis]')].map(e => e.innerText.trim()).filter(Boolean).sort((a, b) => b.length - a.length)) s = s.split(n).join(' ');
    for (const n of drop) s = s.split(n).join(' '); return s; }, [sel || null, names]);
  /* a file the page saves: its bytes, and its text without the byte order mark every CSV download starts with (the shared saveFile adds it so a spreadsheet reads the degree sign and Spanish text) */
  const dl = async click => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), click()]); const buf = readFileSync(await d.path()), raw = buf.toString('utf8'), bom = raw.charCodeAt(0) === 0xFEFF; return { name: d.suggestedFilename(), buf, bom, text: bom ? raw.slice(1) : raw }; };
  const strip = x => (x.charCodeAt(0) === 0xFEFF ? x.slice(1) : x);
  const clean = async (label, sel) => { const s = await visible(sel); const words = [...new Set(s.split(/\s+/).filter(w => DASH.test(w) && !IDENT.test(w)))]; t.ok(!words.length && !MARK.test(s) && !BROKEN.test(s), `${label}: no visible string holds undefined, NaN, a hyphen between letters or a dash`, { hyphenated: words.slice(0, 8), dash: around(s, MARK), broken: around(s, BROKEN) }); return s; };
  /* what the engine returns for the settings the page has stored */
  const engine = () => page.evaluate(() => { const P = HEATX.params((store.get('tda.heat.v1', {}) || {}).P || {}), plan = HEATX.plan(P), F = HEATX.forecast(new Date()), wk = HEATX.week(P, F), usd = v => '$' + N(v);
    return { P: { budget: P.budget, month: P.month, mode: P.mode, bidding: P.bidding }, zips: plan.T.zips, zipList: plan.zips.map(r => r.zip), spent: usd(plan.T.spent), share20: Math.round(plan.T.share20 * 100) + '%', farthest: N(plan.T.farthest), month: plan.monthName, counties: plan.counties.filter(c => c.dollars > 0).map(c => c.county), all12: CO.map(c => c.name),
      lead: plan.lines.slice().sort((a, b) => b.dollars - a.dollars)[0], lines: plan.lines.filter(l => l.dollars > 0).map(l => ({ name: l.name, dollars: usd(l.dollars) })), unspent: plan.T.unspent > 0.5 ? usd(plan.T.unspent) : null, crew: !!wk.crew, wkMonth: wk.monthName, top: plan.zips[0] ? { zip: plan.zips[0].zip, city: plan.zips[0].city, dollars: usd(plan.zips[0].dollars) } : null,
      wk: { src: wk.src, week: usd(wk.T.week), normal: usd(wk.T.normal), first: (wk.list[0] || {}).text || '', steps: wk.list.length, headline: (wk.head || {}).headline || '', trigger: wk.trigger }, hand: HEATX.hand(plan, 'all'), source: plan.exposure.source, forecast: !!F, held: HEATX.held(plan).map(h => h.zip), bench: plan.bench.map(b => b.zip) }; });
  const pageSays = () => page.evaluate(() => { const q = s => document.querySelector('#mod-heat ' + s), tx = s => (q(s) ? q(s).innerText : ''), kpi = {}; document.querySelectorAll('#h17Kpis .kpi').forEach(k => { kpi[k.querySelector('.kl span').textContent] = { v: k.querySelector('.kv').textContent, d: k.querySelector('.kd').textContent }; });
    return { where: tx('[data-a="where"]'), what: tx('[data-a="what"]'), week: tx('[data-a="week"]'), monday: tx('[data-a="monday"]'), kpi, rows: [...document.querySelectorAll('#h17Tbl tbody tr:not(.hd-benchrow)')].map(r => r.dataset.id), meta: tx('.mast .meta'), weekTotal: [...document.querySelectorAll('#h17Week tr.hd-total td')].map(td => td.innerText), lineRows: [...document.querySelectorAll('#h17LinesT tbody tr')].map(r => [...r.cells].map(c => c.innerText.split('\n')[0])), todo: [...document.querySelectorAll('#h17Week ol.hd-monday li')].map(li => li.innerText), own: (q('.hd-col.own') || {}).innerText || '', cty: [...document.querySelectorAll('#h17Cty tbody tr')].map(r => [...r.cells].map(c => c.innerText)), ctyHead: [...document.querySelectorAll('#h17Cty thead th')].map(h => h.innerText.replace(/\s+/g, ' ')), miss: tx('#h17Miss'), gate: tx('#h17Gate') }; });
  const agree = async label => { const E = await engine(), S = await pageSays(); const m = /buys (\d+) ZIPs?/.exec(S.where), said = S.where.replace(/\([^)]*\)/g, ''), named = E.all12.filter(c => new RegExp('\\b' + c + '\\b').test(said)).sort((a, b) => said.search(new RegExp('\\b' + a + '\\b')) - said.search(new RegExp('\\b' + b + '\\b')));
    t.ok(m && +m[1] === E.zips && S.rows.length === E.zips && S.kpi['ZIPs in the plan'].v === String(E.zips) && S.meta.includes(`${E.zips} ZIP`), `${label}: the answer, the headline number, the mast and the ranked table agree on ${E.zips} ZIPs`, { answer: m && m[1], rows: S.rows.length, kpi: S.kpi['ZIPs in the plan'], engine: E.zips });
    t.eq(S.rows.slice().sort(), E.zipList.slice().sort(), `${label}: the ranked table lists the ZIPs of the plan`);
    t.ok(named.length >= 1 && named.every(c => E.counties.includes(c)) && named[0] === E.counties[0] && S.where.indexOf(E.counties[0] + ' County') >= 0, `${label}: the answer names real counties, each one funded, the largest first`, { named, funded: E.counties });
    t.ok(S.where.includes(E.share20 + ' of the money within 20 minutes') && S.kpi['Within 20 minutes'].v === E.share20 && S.where.includes(`nothing past ${E.farthest} minutes`) && S.where.includes(`in ${E.month}`) && S.where.includes(E.top.zip) && S.where.includes(E.top.dollars), `${label}: its share within 20 minutes, farthest drive, month and largest ZIP are the engine's`, { where: S.where, E: [E.share20, E.farthest, E.month, E.top] });
    t.ok(S.what.startsWith(E.lead.name + (E.lines.length > 1 ? ' leads with' : ' takes')) && E.lines.every(l => S.what.includes(l.dollars)) && S.lineRows.some(r => r[0] === E.lead.name && E.lines.some(l => l.name === r[0] && l.dollars === r[2])), `${label}: the line that leads and every line's dollars match the line table`, { what: S.what.slice(0, 200), rows: S.lineRows.map(r => r.slice(0, 3)) });
    t.ok(S.kpi['Monthly heating media'].v === E.spent && S.lineRows[S.lineRows.length - 1][2] === E.spent, `${label}: the money placed is the same in the headline number and the line total`, [S.kpi['Monthly heating media'].v, E.spent]);
    t.ok(S.week.includes(E.wk.src === 'normal' ? E.wk.normal : E.wk.week) && S.week.includes(E.wk.normal) && S.weekTotal[1] === E.wk.normal && S.weekTotal[2] === E.wk.week, `${label}: this week's dollars in the answer are the totals of the week table`, { week: S.week, total: S.weekTotal });
    t.ok(S.monday.startsWith(E.wk.first.slice(0, 60)) && S.todo.length === E.wk.steps && S.todo[0].startsWith(E.wk.first.slice(0, 60)), `${label}: the Monday line is the first step of the Monday list`, { monday: S.monday.slice(0, 120), first: E.wk.first.slice(0, 120), steps: [S.todo.length, E.wk.steps] });
    return { E, S }; };

  /* ---------- the registry literal the build scrapes, and the mount ---------- */
  const src = readFileSync(join(HERE, '..', '..', 'app', 'js', '31_m17_heat.js'), 'utf8');
  t.ok(/registerModule\(\{\s*key: 'heat', num: '17', title: 'Heat Desk', desc: '[^']{10,}'/.test(src), 'registerModule opens with key, num, title and desc as single quoted literals, in that order');
  t.ok(!/\beval\(|new Function\(|<\/script/i.test(src) && !/\son[a-z]+="/.test(src), 'the source holds no eval, no Function constructor, no inline event handler attribute');
  await show();
  const m0 = await page.evaluate(() => { const s = document.getElementById('mod-heat'), c = s.querySelector('.callout .ct'); return { reg: MODI.heat && [MODI.heat.num, MODI.heat.title], failed: !!(c && /failed to load/i.test(c.textContent)), empty: ['h17Answer', 'h17Kpis', 'h17Week', 'h17Plan', 'h17Map', 'h17Leg', 'h17Zip', 'h17Tbl', 'h17Held', 'h17LinesT', 'h17Camps', 'h17Plats', 'h17Lsa', 'h17Files', 'h17Cty', 'h17LadC', 'h17Cols', 'h17Rules', 'h17RuleEd', 'h17SeasT', 'h17SeasLive', 'h17Sig', 'h17Sure', 'h17Sens', 'h17Meth', 'h17Judg', 'h17Not', 'h17Cav', 'h17Src'].filter(id => !document.getElementById(id) || document.getElementById(id).innerHTML.trim().length < 40),
    inline: s.querySelectorAll('[onclick],[onchange],[oninput],[onkeydown],[onsubmit],script').length, untyped: [...s.querySelectorAll('.wrap button')].filter(b => b.type !== 'button').length, unnamed: [...s.querySelectorAll('.wrap button')].filter(b => !(b.innerText.trim() || b.getAttribute('aria-label') || b.title)).length,
    unlabeled: [...s.querySelectorAll('.wrap input, .wrap select')].filter(e => !(e.getAttribute('aria-label') || (e.id && s.querySelector(`label[for="${e.id}"]`)) || e.closest('label'))).map(e => e.id || e.dataset.p || e.type), order: [...s.querySelectorAll('.wrap > *')].slice(0, 4).map(e => e.id || e.className), h2: s.querySelector('#h17Answer h2').textContent,
    dupIds: (ids => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))])([...s.querySelectorAll('[id]')].map(e => e.id)), bareDetails: [...s.querySelectorAll('details')].filter(d => !d.firstElementChild || d.firstElementChild.tagName !== 'SUMMARY' || !d.firstElementChild.textContent.trim() || d.parentElement.closest('details')).length, drawers: [...s.querySelectorAll('details > summary')].map(x => x.textContent.trim()) }; });
  t.ok(!m0.failed && !m0.empty.length && !ctx.errors.length, 'the module mounts and every block has content', { m0, errors: ctx.errors.slice(0, 4) });
  t.eq(m0.reg, ['17', 'Heat Desk'], 'it registers as module 17, Heat Desk');
  t.ok(m0.order[1] === 'h17Answer' && /answer/i.test(m0.h2), 'the answer is the first block under the mast', m0.order);
  t.ok(m0.inline === 0 && m0.untyped === 0 && m0.unnamed === 0 && !m0.unlabeled.length, 'no inline handler or script in the markup; every button is a typed, named button and every field has a label', m0);
  t.ok(!m0.dupIds.length && m0.bareDetails === 0 && m0.drawers.some(x => /^Advanced/.test(x)), 'no id is used twice and every drawer opens from its own named summary', { dup: m0.dupIds, bare: m0.bareDetails, drawers: m0.drawers });

  /* ---------- the answer says what the tables say ---------- */
  const A = await agree('at the defaults');
  t.ok(A.E.forecast && A.E.wk.src === 'live' && A.S.week.includes(A.E.wk.headline.split(/[-‐-―]/)[0].trim().slice(0, 30)), 'with the forecast baked into the build, the answer carries the headline of the cold picture', { week: A.S.week.slice(0, 160), headline: A.E.wk.headline });
  t.ok(/Measured:/.test(await page.evaluate(() => document.querySelector('#h17Answer .hd-fine').innerText)) && /Stated:/.test(await page.evaluate(() => document.querySelector('#h17Answer .hd-fine').innerText)), 'and one closing sentence says what is measured and what is stated');
  t.ok(A.S.own.includes(`${A.E.zips} ·`) && A.S.own.includes(A.E.spent), 'the owner\'s column of what a budget buys repeats the plan', A.S.own.slice(0, 200));
  await clean('at the defaults');

  /* ---------- every control changes the plan, is stored, and survives a reload ---------- */
  /* what the plan, this week and the week of an arctic outbreak come to, for the settings stored: one string to compare */
  await page.evaluate(() => { window.__heatSig = () => { const P = HEATX.params((store.get('tda.heat.v1', {}) || {}).P || {}), plan = HEATX.plan(P), F = HEATX.forecast(new Date()), wk = w => JSON.stringify([w.T, w.lines.map(l => [l.week, l.mult, l.paused]), w.days.map(d => [d.repair, d.capUp]), w.rules.map(x => [x.threshold, x.budget, x.bids, x.size, x.fired, x.off]), w.schedule.map(s => [s.day, s.start, s.end, s.adj]), w.list.map(x => x.text), w.crew && w.crew.text]);
    return JSON.stringify([plan.T, plan.lines.map(l => [l.dollars, l.leads, l.cpl, l.platDollars]), plan.zips.map(z => [z.zip, Math.round(z.dollars), z.bid]), plan.campaigns.map(c => [c.name, c.budget, c.daily, c.maxCpc, c.targetCpa]), plan.platforms.map(x => [x.dollars, (x.folded || []).length]), plan.notes.map(n => n.text)]) + wk(HEATX.week(P, F)) + wk(HEATX.week(P, HEATX.scenario(F, 'arctic'))); }; });
  const dump = () => page.evaluate(() => { const o = {}; document.querySelectorAll('#mod-heat [data-p]').forEach(e => { o[e.dataset.p] = e.type === 'checkbox' ? e.checked : e.value; }); o['#month'] = document.getElementById('h17Month').value; o['#bid'] = (document.querySelector('#h17Bid [aria-pressed="true"]') || {}).dataset.v; o['#mode'] = (document.querySelector('#h17Mode [aria-pressed="true"]') || {}).dataset.v; o['#mix'] = [...document.querySelectorAll('#h17Mix input')].map(i => i.value).join(' '); o['#pins'] = document.getElementById('h17Pins').innerText; o['#blocks'] = document.getElementById('h17Blocks').innerText; o['#layer'] = document.getElementById('h17Layer').value; o['#bench'] = document.getElementById('h17Bench').checked; return o; });
  const D0 = await dump(), base = await page.evaluate(() => window.__heatSig()), paths = Object.keys(D0).filter(k => k[0] !== '#');
  t.ok(paths.length >= 60 && paths.includes('budget') && paths.includes('half.heat') && paths.includes('paid.heat') && paths.includes('cap') && paths.includes('pipeCredit') && paths.includes('gamma') && paths.includes('hurdle') && paths.includes('nightW.3') && paths.includes('resp.furnace') && !paths.some(p => /income|race|ethnic|age\b/i.test(p)), `the plan, the advanced drawer and the cold rules hold ${paths.length} controls, none of them about who lives in a ZIP`, paths.join(' '));
  /* one control at a time from the defaults: a step, or the far end of its range when a step is too small to matter */
  const dead = [], unsaved = [];
  for (const p of paths) {
    const r = await page.evaluate(async ([path, before]) => { const el = document.querySelector(`#mod-heat [data-p="${path}"]`), R = HEATX.RANGES[path] || {}, k = R.pct ? 100 : 1, fire = () => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      const saved = () => HEATX.get(HEATX.params((store.get('tda.heat.v1', {}) || {}).P || {}), path), tries = [];
      if (el.type === 'checkbox') tries.push(!el.checked);
      const cur = el.type === 'checkbox' || el.value === '' ? null : +el.value; if (el.type !== 'checkbox') { const step = (R.step || 1) * k, mx = R.max != null ? R.max * k : cur + 10 * step, mn = R.min != null ? R.min * k : 0; if (cur == null) tries.push(3); else { tries.push(cur + step <= mx + 1e-9 ? cur + step : cur - step); tries.push(Math.abs(mx - cur) > 1e-9 ? mx : mn); tries.push(Math.abs(mn - cur) > 1e-9 ? mn : mx); } }
      for (const v of tries) { if (el.type === 'checkbox') el.checked = v; else el.value = String(+(+v).toFixed(6)); fire(); await new Promise(z => setTimeout(z, 20));
        const got = saved(), want = el.type === 'checkbox' ? v : v / k, ok = el.type === 'checkbox' ? got === want && el.checked === got : /^plat\./.test(path) ? Math.abs(+el.value - got) < 0.06 && Math.abs(got - cur) > 0.5 : Math.abs(got - want) < 1e-6 && Math.abs(+el.value / k - got) < 1e-6;
        const now = window.__heatSig();
        if (ok && now !== before) return { saved: true, changed: true, v };
        if (!ok) return { saved: false, changed: now !== before, v, got }; }
      return { saved: true, changed: false, v: tries[tries.length - 1] }; }, [p, base]);
    if (!r.saved) unsaved.push([p, r.v, r.got]); if (!r.changed) dead.push(p);
    await page.evaluate(() => document.getElementById('h17Reset').click()); await wait(15);
  }
  /* the Local Services minimum can only matter once Local Services is live */
  const lsaOnly = dead.filter(p => p === 'platMin.lsa');
  t.ok(!unsaved.length, 'every control writes the value it shows into tda.heat.v1, as the engine accepts it', unsaved.slice(0, 8));
  t.ok(dead.filter(p => p !== 'platMin.lsa').length === 0, 'every control changes the month plan, this week or the week of an arctic outbreak', dead);
  if (lsaOnly.length) { const moved = await page.evaluate(async () => { const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, q = p => document.querySelector(`#mod-heat [data-p="${p}"]`), set = async (p, v) => { const el = q(p); if (el.type === 'checkbox') el.checked = v; else el.value = String(v); fire(el); await new Promise(z => setTimeout(z, 20)); };
      await set('lsaLive', true); await set('budget', HEATX.RANGES.budget.min); await set('platMin.lsa', HEATX.RANGES['platMin.lsa'].min); const a = window.__heatSig(); await set('platMin.lsa', HEATX.RANGES['platMin.lsa'].max); const b = window.__heatSig(); document.getElementById('h17Reset').click(); return a !== b; });
    t.ok(moved, 'the Local Services minimum changes the plan once Local Services is live and the budget is small enough for it to bind'); }
  t.eq(await dump(), D0, 'Reset every setting brings every control back to its default');
  t.eq(await page.evaluate(() => (store.get('tda.heat.v1', {}) || {}).P), {}, 'and leaves an empty patch in tda.heat.v1');

  /* now all of them together, then a reload */
  await page.evaluate(async () => { const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    for (const el of document.querySelectorAll('#mod-heat [data-p]')) { const R = HEATX.RANGES[el.dataset.p] || {}, k = R.pct ? 100 : 1; if (el.type === 'checkbox') el.checked = !el.checked; else { const cur = el.value === '' ? null : +el.value, step = (R.step || 1) * k, mx = R.max != null ? R.max * k : Infinity; el.value = String(cur == null ? 4 : +(cur + step <= mx + 1e-9 ? cur + step : cur - step).toFixed(6)); } fire(el); }
    const m = document.getElementById('h17Month'); m.value = '0'; m.dispatchEvent(new Event('change', { bubbles: true })); });
  await press('#h17Bid [data-v="smart"]'); await press('#h17Mode [data-v="replace"]');
  await page.fill('#h17Mix_heat', '31'); await page.locator('#h17Mix_heat').dispatchEvent('change'); await wait(60);
  await page.fill('#h17PinIn', '75150'); await press('#mod-heat [data-act="addpin"]'); await page.fill('#h17BlkIn', '75217'); await page.keyboard.press('Enter'); await wait(120);
  await page.selectOption('#h17Layer', 'conf'); await page.locator('#h17Bench').check(); await wait(400);
  const D1 = await dump(), stored1 = await page.evaluate(() => localStorage.getItem('tda.heat.v1'));
  const moved = paths.filter(p => String(D1[p]) !== String(D0[p]));
  t.ok(moved.length >= paths.length - 6 && D1['#month'] === '0' && D1['#bid'] === 'smart' && D1['#mode'] === 'custom' && D1['#mix'].split(' ')[0] === '31' && /75150/.test(D1['#pins']) && /75217/.test(D1['#blocks']) && D1['#layer'] === 'conf' && D1['#bench'] === true, 'every kind of control takes a new value: numbers, sliders, boxes, month, bidding, mix, pins, blocks, layer, bench', { same: paths.filter(p => !moved.includes(p)), D1: [D1['#month'], D1['#bid'], D1['#mode'], D1['#mix'], D1['#pins'], D1['#blocks']] });
  t.eq(D1['#mix'].split(' ').reduce((a, b) => a + +b, 0), 100, 'a custom share rescales the other three so the four add to 100');
  const B1 = await agree('with every control moved');
  t.ok(B1.E.P.month === 0 && B1.E.P.bidding === 'smart' && B1.E.P.mode === 'custom' && !B1.E.zipList.includes('75217') && B1.S.where.includes('in January'), 'the plan on the page is the plan of the moved controls: January, Smart Bidding, custom mix, 75217 blocked', B1.E.P);
  t.ok(await page.evaluate(() => [...document.querySelectorAll('#h17Camps tbody tr')].some(r => /Core|Ring|Far/i.test(r.cells[2].innerText)) && /Smart Bidding mode/.test(document.getElementById('h17Camps').innerText)), 'Smart Bidding builds campaigns by drive tier');
  await clean('with every control moved');
  await reload();
  const D2 = await dump();
  t.ok(JSON.stringify(D2) === JSON.stringify(D1), 'after a reload every control shows what was set', Object.keys(D1).filter(k => String(D1[k]) !== String(D2[k])).map(k => [k, D1[k], D2[k]]));
  t.eq(await page.evaluate(() => localStorage.getItem('tda.heat.v1')), stored1, 'and tda.heat.v1 is unchanged by the reload');
  await agree('after the reload');
  t.ok(await page.evaluate(() => document.querySelectorAll('#h17Tbl tr.hd-benchrow').length > 0 && /Unblock/.test(document.getElementById('h17Held').innerText)), 'the bench rows and the blocked ZIP are back on the page after the reload');
  await press('#h17Reset'); await wait(350);
  t.eq(Object.assign({}, await dump(), { '#layer': D0['#layer'], '#bench': D0['#bench'] }), D0, 'Reset clears the settings again (the map layer and the bench switch are view choices and stay)');
  await page.locator('#h17Bench').uncheck(); await page.selectOption('#h17Layer', 'share');

  /* typing is never blocked: the box keeps what is typed and the plan follows */
  await page.locator('#h17c_budget').evaluate(x => x.scrollIntoView({ block: 'center' })); await page.click('#h17c_budget'); await page.fill('#h17c_budget', ''); await page.type('#h17c_budget', '12500', { delay: 35 });
  t.eq(await page.inputValue('#h17c_budget'), '12500', 'the budget box keeps every key typed while the plan recomputes');
  await wait(500);
  const typed = await pageSays();
  t.ok(typed.where.includes('At $12,500 a month') && typed.kpi['Monthly heating media'].d.includes('$12,500'), 'and the answer follows the typed budget', typed.where.slice(0, 120));
  await agree('at a typed budget');
  await press('#h17Reset'); await wait(350);

  /* ---------- settings at their edges: nothing breaks and the answer still says what the tables say ---------- */
  const edge = async (label, set) => { const before = ctx.errors.length; await press('#h17Reset'); await page.evaluate(set); await wait(450); const r = await agree(label); await clean(label); t.ok(ctx.errors.length === before, `${label}: no page error`, ctx.errors.slice(before, before + 3)); return r; };
  await page.evaluate(() => { window.__set = (p, v) => { const el = document.querySelector(`#mod-heat [data-p="${p}"]`); if (el.type === 'checkbox') el.checked = v; else el.value = String(v === 'max' ? el.max : v === 'min' ? el.min : v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }; });
  let X = await edge('at the largest budget', () => window.__set('budget', 'max'));
  t.ok(!X.E.unspent || (X.S.where.includes(`${X.E.unspent} of the $100,000 stays unspent`) && X.S.kpi['Monthly heating media'].d.includes(`${X.E.unspent} of`) && /hurdle of \$3\.00/.test(X.S.kpi['Monthly heating media'].d)), 'money the hurdle leaves unspent is named in the answer and in the headline number', { unspent: X.E.unspent, where: X.S.where.slice(-260), kpi: X.S.kpi['Monthly heating media'].d });
  X = await edge('at the smallest budget', () => window.__set('budget', 'min'));
  X = await edge('with the plan set to July', () => { const m = document.getElementById('h17Month'); m.value = '6'; m.dispatchEvent(new Event('change', { bubbles: true })); });
  t.ok(X.E.month === 'July' && X.E.wkMonth !== 'July' && X.S.week.includes(`planned on ${X.E.wkMonth}`) && X.S.week.includes('not on the July the plan is set to') && !X.S.what.startsWith('Heating repair leads'), 'out of season the answer says which line leads and that the week is planned on the month of the forecast', { what: X.S.what.slice(0, 120), week: X.S.week.slice(-140) });
  X = await edge('with all the money on repair', async () => { document.querySelector('#h17Mode [data-v="custom"]').click(); await new Promise(z => setTimeout(z, 40)); const i = document.getElementById('h17Mix_heat'); i.value = '100'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  t.ok(X.E.P.mode === 'custom' && X.E.lines.length === 1 && /custom mix/.test(X.S.what), 'a custom mix is named as the owner\'s own split', X.S.what);
  X = await edge('with the hurdle at its highest', () => window.__set('hurdle', 'max'));
  X = await edge('with the reach at its shortest', () => ['half.heat', 'half.furnace', 'half.maint'].forEach(p => window.__set(p, 'min')));
  X = await edge('with Local Services live, Smart Bidding and a crew cap', () => { window.__set('lsaLive', true); document.querySelector('#h17Bid [data-v="smart"]').click(); window.__set('crewCap', 3); });
  t.ok(!X.E.crew || /crew cap of 3 paid booked jobs a week/.test(X.S.week), 'a crew cap that binds is named in the answer', X.S.week);
  await press('#h17Reset'); await wait(350);

  /* ---------- pins, blocks, the bench, the map layers, the search box ---------- */
  const E0 = await engine();
  await page.evaluate(z => { const b = [...document.querySelectorAll('#h17Held [data-act="pin"]')].find(x => x.dataset.zip === z); b.scrollIntoView({ block: 'center' }); b.click(); }, E0.held[0]); await wait(200);
  const pin = await page.evaluate(z => ({ stored: (store.get('tda.heat.v1', {}).P || {}).pins, chip: document.getElementById('h17Pins').innerText, pinned: HEATX.plan(HEATX.params(store.get('tda.heat.v1', {}).P)).at[z].pinned }), E0.held[0]);
  t.ok(pin.stored.includes(E0.held[0]) && pin.chip.includes(E0.held[0]) && pin.pinned, 'Pin on a held back ZIP pins it: stored, shown as a chip, and the engine sees it', pin);
  await page.evaluate(() => document.querySelector('#h17Pins [data-act="unpin"]').click()); await wait(150);
  t.eq(await page.evaluate(() => (store.get('tda.heat.v1', {}).P || {}).pins), [], 'the chip\'s remove button unpins it');
  await page.fill('#h17PinIn', '00000'); await press('#mod-heat [data-act="addpin"]');
  t.eq(await page.evaluate(() => (store.get('tda.heat.v1', {}).P || {}).pins), [], 'a number that is not a ZIP of the atlas is refused');
  await page.locator('#h17Bench').check(); await wait(150);
  const bench = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#h17Tbl tr.hd-benchrow')].map(r => r.dataset.id), note: document.getElementById('h17TblN').innerText, saved: store.get('tda.heat.v1', {}).bench }));
  t.ok(bench.rows.length === E0.bench.length && bench.rows.length > 0 && bench.saved === true && /on the bench/.test(bench.note), 'the bench toggle adds the next ZIPs to enter, with the budget at which each does', bench);
  await page.locator('#h17Bench').uncheck(); await wait(100);
  const layers = await page.evaluate(async () => { const sel = document.getElementById('h17Layer'), out = []; for (const o of sel.options) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(z => setTimeout(z, 10)); out.push([o.value, document.getElementById('h17Leg').innerText.length, [...document.querySelectorAll('#h17Map svg path')].filter(p => p.style.fill).length]); } sel.value = 'share'; sel.dispatchEvent(new Event('change', { bubbles: true })); return out; });
  t.ok(layers.length >= 10 && layers.every(l => l[1] > 30) && ['share', 'bid', 'tier', 'conf', 'reach', 'jobs', 'furn20', 'fuel', 'cold', 'wx'].every(k => layers.some(l => l[0] === k)), 'the map offers the ten layers of the spec and each draws a legend', layers);
  await page.fill('#h17Find', 'Mesquite'); await page.locator('#h17Find').press('Enter'); await wait(250);
  t.ok(/Mesquite/.test(await page.evaluate(() => document.getElementById('h17ZName').textContent)), 'the search box finds a city and opens the card of its largest ZIP');

  /* ---------- a routed ZIP opens its card ---------- */
  await page.evaluate(() => { location.hash = '#heat.75150'; }); await wait(450);
  const card = () => page.evaluate(() => ({ name: document.getElementById('h17ZName').textContent, sub: document.getElementById('h17ZSub').textContent, body: document.getElementById('h17Zip').innerText, shown: !document.getElementById('mod-heat').hidden, sel: (document.querySelector('#h17Tbl tr.sel') || {}).dataset ? document.querySelector('#h17Tbl tr.sel').dataset.id : null }));
  let c = await card();
  t.ok(c.shown && c.name === '75150 · Mesquite' && /Dallas County/.test(c.sub) && /The four lines this month/i.test(c.body) && /Gas furnaces/.test(c.body) && /Pin 75150/.test(c.body), '#heat.75150 opens the card of 75150 Mesquite with its four lines, its homes and its buttons', c);
  /* a cold start: the new document is seeded with exactly what this one stored (see the note on storage at the top), so it cannot open on an older state */
  const kept = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  await page.goto('about:blank'); await page.evaluate(x => { window.name = 'tda-seed:' + JSON.stringify(x); }, kept); await page.goto(ctx.url + '#heat.75043', { waitUntil: 'load' }); await wait(700);
  c = await card();
  t.ok(c.shown && c.name.startsWith('75043') && c.sel === (await engine()).zipList.find(z => z === '75043'), 'a cold start on #heat.75043 mounts the module and opens that card', c);
  await ctx.show('index'); await ctx.show('heat', { zip: '75149' }); await wait(300);
  t.ok((await card()).name.startsWith('75149'), 'receive({ zip }) from another module opens that ZIP\'s card');
  await page.evaluate(() => MODI.heat.fromRoute('99999')); await wait(200);
  c = await card();
  t.ok(/99999/.test(c.name) && /not one of the/.test(c.body) && !ctx.errors.length, 'a ZIP that is not on the map says so in the card and breaks nothing', c);
  await clean('with a ZIP card open', '#h17ZipCard');
  await page.evaluate(() => MODI.heat.receive({ zip: '75150' })); await wait(200);
  await clean('with the 75150 card open', '#h17ZipCard');

  /* ---------- the Campaign Desk hand off ---------- */
  await page.evaluate(() => { const go = window.goModule; window.__sent = []; window.goModule = (k, p) => { window.__sent.push([k, JSON.parse(JSON.stringify(p || null))]); return go(k, p); }; });
  const EH = await engine();
  await press('#h17Desk'); await wait(300);
  const hand = await page.evaluate(() => ({ sent: window.__sent[window.__sent.length - 1], hash: location.hash, desk: MODI.desk.plan() }));
  t.ok(hand.sent[0] === 'desk' && JSON.stringify(hand.sent[1].zips) === JSON.stringify(EH.hand.zips) && hand.sent[1].line === EH.hand.line && JSON.stringify(hand.sent[1].bids) === JSON.stringify(EH.hand.bids), 'Campaign Desk is sent the plan\'s ZIPs, its line and the bid adjustments', { n: hand.sent[1].zips.length, line: hand.sent[1].line });
  t.ok(hand.hash === '#desk' && hand.desk.scope === 'picks' && hand.desk.picks.slice().sort().join() === EH.zipList.slice().sort().join() && hand.desk.line === EH.hand.line && hand.desk.bids && Object.keys(hand.desk.bids).length === EH.zipList.length, 'and the hand off arrives: the desk plan holds those ZIPs as its picks, with the bids', { hash: hand.hash, picks: hand.desk.picks.length, line: hand.desk.line });
  await show();
  for (const [id, key] of [['h17Lines', 'lines'], ['h17Wx', 'weather'], ['h17Live', 'live']]) { await press('#' + id); t.eq(await page.evaluate(() => location.hash), '#' + key, `the ${key} button opens that module`); await show(); }

  /* ---------- this week: scenarios are simulations and say so ---------- */
  const live0 = await pageSays();
  await press('#h17Scn [data-v="arctic"]'); await wait(350);
  const sim = await page.evaluate(() => ({ gate: document.getElementById('h17Gate').innerText, ans: document.querySelector('#h17Answer [data-a="week"]').innerText, week: document.getElementById('h17Week').innerText, kpiL: [...document.querySelectorAll('#h17Kpis .kl span')].map(x => x.textContent), rules: document.getElementById('h17Rules').innerText, zips: document.querySelectorAll('#h17Tbl tbody tr').length }));
  t.ok(/Simulation, not a forecast/i.test(sim.gate) && /^SIMULATION/i.test(sim.ans.trim()) && /SIMULATION/i.test(sim.week) && sim.kpiL.includes('Coldest low, simulated') && /In this simulation/i.test(sim.rules), 'an arctic outbreak is labeled a simulation above the answer, in the answer, in the week card, in the headline numbers and in the rules table', { gate: sim.gate.slice(0, 80), ans: sim.ans.slice(0, 60) });
  t.ok(sim.zips === live0.rows.length && /draw/i.test(sim.ans) && /paused/i.test(sim.week), 'the simulated week draws on the reserve and pauses tune ups, and the month plan does not move', { zips: [sim.zips, live0.rows.length], ans: sim.ans });
  const simCsv = await dl(() => press('#mod-heat [data-csv="week"]'));
  t.ok(/^# .*SIMULATION/m.test(simCsv.text), 'the week table of a simulation says SIMULATION in its file note', simCsv.text.slice(0, 160));
  await clean('in the arctic simulation');
  await press('#mod-heat [data-act="live"]'); await wait(300);
  t.ok(!(await page.evaluate(() => document.getElementById('h17Gate').innerText)).trim() && (await pageSays()).week === live0.week, 'Back to the live forecast restores the week');

  /* ---------- every file downloads and reads back ---------- */
  const want = await page.evaluate(() => { const P = HEATX.params({}), plan = HEATX.plan(P), wk = HEATX.week(P, HEATX.forecast(new Date())), ex = HEATX.exports(plan, wk, P), o = {}; Object.keys(ex).forEach(k => { o[k] = { name: ex[k].name, len: ex[k].text.length, main: ex[k].main }; }); return { ex: o, pack: HEATX.pack(ex).name, zips: plan.zips.map(r => r.zip) }; });
  const fileKeys = await page.evaluate(() => [...document.querySelectorAll('#h17Files [data-x]')].map(b => b.dataset.x));
  const need = ['googleLocations', 'googleCampaigns', 'week', 'lsa', 'meta', 'microsoft', 'nextdoor', 'exclusions', 'zipList', 'planByZip', 'valueRules', 'assumptions'];
  t.ok(fileKeys[0] === 'pack' && need.every(k => fileKeys.includes(k)), 'the files card offers the Monday pack and the twelve files of the spec', fileKeys);
  const checkFile = (label, f, o) => { const kind = /\.csv$/.test(f.name) ? 'csv' : /\.json$/.test(f.name) ? 'json' : /\.zip$/.test(f.name) ? 'zip' : 'txt'; let ok = f.text.length > 0 && !BROKEN.test(f.text) && f.bom === (kind === 'csv'), detail = { name: f.name, len: f.text.length, broken: around(f.text, BROKEN), bom: f.bom };
    if (kind === 'csv') { const p = csv(f.text.split('\n').filter(l => !/^#/.test(l)).join('\n')), w = p.rows.length ? p.rows[0].length : 0, ragged = p.rows.filter(r => r.length !== w).length; ok = ok && !p.open && w >= 1 && p.rows.length >= 1 && ragged === 0 && p.rows[0].every(h => h.trim().length > 0); Object.assign(detail, { rows: p.rows.length, cols: w, ragged, open: p.open }); if (o && o.rows) ok = ok && p.rows.length > 1; f.rows = p.rows; }
    if (kind === 'json') { try { f.json = JSON.parse(f.text); ok = ok && f.json && typeof f.json === 'object'; } catch (e) { ok = false; detail.json = e.message; } }
    t.ok(ok, `${label} downloads as ${f.name}, reads back as ${kind}${kind === 'csv' ? ' behind its byte order mark' : ''} and holds no undefined, NaN or [object Object]`, detail); return f; };
  const got = {};
  for (const k of fileKeys.filter(x => x !== 'pack')) { const f = await dl(() => press(`#h17Files [data-x="${k}"]`)); t.ok(f.name === want.ex[k].name && f.text.length === want.ex[k].len, `the ${k} button saves the engine's own text under the engine's file name`, [f.name, want.ex[k].name, f.text.length, want.ex[k].len]); got[k] = checkFile(`file ${k}`, f, { rows: !['nextdoor', 'lsa'].includes(k) }); }
  t.ok(got.googleCampaigns.rows.slice(1).every(r => r[r.length - 1] === 'Paused') && got.googleCampaigns.rows.length > 1, 'every campaign in the Google campaigns file is paused', got.googleCampaigns.rows.slice(0, 3));
  t.eq([...new Set(got.googleLocations.rows.slice(1).map(r => r[1].slice(0, 5)))].sort(), want.zips.slice().sort(), 'the Google locations file carries exactly the ZIPs of the plan');
  t.eq(got.zipList.text.trim().split('\n').sort(), want.zips.slice().sort(), 'and so does the plain ZIP list');
  t.ok(got.assumptions.json && JSON.stringify(got.assumptions.json).includes('"budget"'), 'the assumptions file is JSON and carries the controls');
  t.ok(Object.values(want.ex).filter(x => /\d{4}-\d{2}-\d{2}/.test(x.name)).length >= 10, 'file names carry the date', Object.values(want.ex).map(x => x.name));
  const pk = await dl(() => press('#h17Files [data-x="pack"]')), inside = unzip(pk.buf);
  t.ok(pk.name === want.pack && inside && inside.length === Object.keys(want.ex).length && inside.every(f => want.ex[Object.keys(want.ex).find(k => want.ex[k].name === f.name)] && strip(f.text).length === want.ex[Object.keys(want.ex).find(k => want.ex[k].name === f.name)].len && !BROKEN.test(f.text)), `the Monday pack is a zip that reads back: ${inside ? inside.length : 0} files, each the engine's own text`, { name: pk.name, files: inside && inside.map(f => f.name) });
  const packCsv = inside ? inside.filter(f => /\.csv$/.test(f.name)) : [], twins = Object.keys(got).map(k => [got[k], inside && inside.find(x => x.name === got[k].name)]);
  t.ok(packCsv.length >= 9 && inside.every(f => (f.text.charCodeAt(0) === 0xFEFF) === /\.csv$/.test(f.name)) && twins.length >= 12 && twins.every(([a, b]) => b && Buffer.compare(a.buf, b.buf) === 0), `every CSV inside the Monday pack starts with the byte order mark, and all ${twins.length} files that have a button of their own are byte for byte the file that button saves`, { csv: packCsv.length, differ: twins.filter(([a, b]) => !b || Buffer.compare(a.buf, b.buf) !== 0).map(([a]) => a.name) });
  t.ok(inside && inside.some(f => /read-me\.txt$/.test(f.name) && /paused/i.test(f.text)), 'with a read me that says every campaign is paused');
  for (const [id, k] of [['h17XPack', null], ['h17XGoogle', 'googleLocations'], ['h17XWeek', 'week'], ['h17XPlan', 'planByZip']]) { const f = await dl(() => press('#' + id)); t.ok(k ? f.name === want.ex[k].name && f.text.length === want.ex[k].len : f.name === want.pack && !!unzip(f.buf), `the ${id.slice(4)} button of the action bar saves the same file`, f.name); }
  /* the tables' own CSV files */
  await press('#h17SensGo'); await page.waitForFunction(() => document.querySelectorAll('#h17Sens tbody tr').length > 10, null, { timeout: 20000 });
  const sens = await page.evaluate(() => ({ rows: document.querySelectorAll('#h17Sens tbody tr').length, text: document.getElementById('h17Sens').innerText.slice(0, 400), btn: document.getElementById('h17SensGo').innerText }));
  t.ok(sens.rows >= 20 && /What would change the plan most/.test(sens.text) && /again/.test(sens.btn), 'the one at a time table runs on its button and says what would change the plan most', sens);
  const csvKeys = await page.evaluate(() => [...new Set([...document.querySelectorAll('#mod-heat [data-csv]')].map(b => b.dataset.csv))]);
  t.ok(['week', 'zips', 'held', 'lines', 'camps', 'plats', 'counties', 'ladder', 'rules', 'season', 'ranges', 'sens'].every(k => csvKeys.includes(k)), 'every table has a CSV button', csvKeys);
  for (const k of csvKeys) { const f = checkFile(`table ${k}`, await dl(() => press(`#mod-heat [data-csv="${k}"]`)), { rows: true }); t.ok(/^heat-desk_[a-z-]+_\d{4}-\d{2}-\d{2}\.csv$/.test(f.name) && /^# DFW Thermal Debt Atlas, module 17 Heat Desk\./.test(f.text) && !DASH.test(f.text.split('\n').filter(l => /^#/.test(l)).join(' ')) && !MARK.test(f.text), `table ${k}: dated file name, a note that names the module and the grades, no dash`, { name: f.name, note: f.text.split('\n')[0].slice(0, 140), dash: around(f.text, MARK) }); if (k === 'zips') t.eq(f.rows.slice(1).map(r => r[1]).sort(), want.zips.slice().sort(), 'the ranked ZIP file lists the ZIPs of the plan'); }
  await clean('with the one at a time table open');

  /* ---------- both themes, 1440 and 390 wide ---------- */
  for (const [w, h, theme] of [[1440, 900, 'light'], [1440, 900, 'dark'], [390, 844, 'light'], [390, 844, 'dark']]) {
    await page.setViewportSize({ width: w, height: h }); const before = ctx.errors.length;
    await fresh({ 'tda.theme': JSON.stringify(theme) });
    const r = await page.evaluate(() => { const s = document.getElementById('mod-heat'), c = s.querySelector('.callout .ct'), box = e => e.getBoundingClientRect(); return { theme: document.documentElement.dataset.theme, dark: isDark(), failed: !!(c && /failed to load/i.test(c.textContent)), overflow: document.documentElement.scrollWidth - innerWidth, wide: [...document.querySelectorAll('#mod-heat > .wrap > *, #mod-heat .hd-answer, #mod-heat .hd-nights, #mod-heat .hd-plan, #mod-heat .hd-files, #mod-heat .hd-cols3')].filter(e => box(e).right > innerWidth + 1 || box(e).left < -1).map(e => e.id || e.className).slice(0, 6), answer: box(document.getElementById('h17Answer')).width, map: box(document.querySelector('#h17Map svg')).width, bg: getComputedStyle(document.getElementById('h17Answer')).backgroundColor, ink: getComputedStyle(document.querySelector('#h17Answer dd')).color, fills: new Set([...document.querySelectorAll('#h17Map svg path')].map(p => p.style.fill).filter(Boolean)).size, stored: localStorage.getItem('tda.theme'), href: location.href.slice(-12), charts: document.querySelectorAll('#h17LadC svg.chart, #h17SeasT svg.chart').length, thin: [...document.querySelectorAll('#mod-heat svg.chart')].map(c => { const w = c.getBoundingClientRect().width, vb = +(c.getAttribute('viewBox') || '').split(/\s+/)[2]; return [c.parentElement.id, +(11 * w / vb).toFixed(1)]; }).filter(x => x[1] < 7.9) }; });
    t.ok(!r.failed && ctx.errors.length === before && r.theme === theme && r.dark === (theme === 'dark'), `${w} wide, ${theme}: the module mounts with no page error`, { r, errors: ctx.errors.slice(before, before + 3) });
    t.ok(r.overflow <= 0 && !r.wide.length && r.answer > 300 && r.map > 250 && r.fills > 4 && r.charts === 2 && !r.thin.length, `${w} wide, ${theme}: no sideways page scroll, the answer, the map and the charts are drawn, chart axis text at 8 px or more`, r);
    await agree(`${w} wide, ${theme}`);
    if (theme === 'dark') { const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]; }; t.ok(lum(r.bg) < 80 && lum(r.ink) > 170, `${w} wide, dark: the answer is light ink on a dark card, through the shared tokens`, [r.bg, r.ink]); await clean(`${w} wide, dark`); }
  }
  /* the theme button repaints what is colored in code */
  await page.setViewportSize({ width: 1440, height: 900 }); await fresh();
  /* a window that shrinks to phone width gets the ladder chart drawn again for that width */
  const vb = () => page.evaluate(() => { const c = document.querySelector('#h17LadS svg.chart'); return [+(c.getAttribute('viewBox') || '').split(/\s+/)[2], +(11 * c.getBoundingClientRect().width / +(c.getAttribute('viewBox') || '').split(/\s+/)[2]).toFixed(1), document.documentElement.scrollWidth - innerWidth]; });
  const wide = await vb(); await page.setViewportSize({ width: 390, height: 844 }); await wait(500); const narrow = await vb(); await page.setViewportSize({ width: 1440, height: 900 }); await wait(500);
  t.ok(narrow[0] < wide[0] && narrow[1] >= 7.9 && narrow[2] <= 0 && (await vb())[0] === wide[0], 'resizing to phone width redraws the ladder chart with readable axis text, and back', { wide, narrow });
  const paint = () => page.evaluate(() => [[...document.querySelectorAll('#h17Map svg path')].slice(0, 400).map(p => p.style.fill).join(), (document.querySelector('#h17LadS svg path[stroke]') || { getAttribute: () => '' }).getAttribute('stroke'), [...document.querySelectorAll('#h17SeasC svg rect[fill]')].slice(0, 4).map(p => p.getAttribute('fill')).join()]);
  const p1 = await paint(); await page.evaluate(() => toggleTheme()); await wait(200); const p2 = await paint(); await page.evaluate(() => toggleTheme()); await wait(200);
  t.ok(p1[0] !== p2[0] && p1[1] !== p2[1] && p1[2] !== p2[2] && JSON.stringify(await paint()) === JSON.stringify(p1), 'switching the theme repaints the map and both charts, and switching back restores them');

  /* ---------- no live record at all ---------- */
  let before = ctx.errors.length;
  await fresh({ 'tda.test.nolive': '1' });
  const none = await page.evaluate(() => ({ recs: Object.keys(LIVE.all()), F: HEATX.forecast(new Date()), failed: /failed to load/i.test(document.getElementById('mod-heat').innerText), miss: document.getElementById('h17Miss').innerText, ans: document.querySelector('#h17Answer [data-a="week"]').innerText, week: document.getElementById('h17Week').innerText, kpi: [...document.querySelectorAll('#h17Kpis .kpi')].map(k => k.innerText).pop(), scn: [...document.querySelectorAll('#h17Scn button')].map(b => b.disabled), sig: document.getElementById('h17Sig').innerText, seas: document.getElementById('h17SeasLive').innerText, out: document.getElementById('h17Outlook').innerHTML, cty: [...document.querySelectorAll('#h17Cty thead th')].length, m4: document.getElementById('h17M4').innerText, src: document.getElementById('h17Src').innerText, wxLayer: (() => { const s = document.getElementById('h17Layer'); s.value = 'wx'; s.dispatchEvent(new Event('change', { bubbles: true })); return document.getElementById('h17Leg').innerText; })() }));
  t.ok(none.recs.length === 0 && none.F === null && !none.failed && ctx.errors.length === before, 'with localStorage cleared and the baked baseline removed there is no live record, and the module still mounts with no error', { recs: none.recs, errors: ctx.errors.slice(before, before + 3) });
  t.ok(/What is missing right now/i.test(none.miss) && /The forecast\./.test(none.miss) && /Records not stored yet/.test(none.miss) && /Open Live Data/.test(none.miss), 'the page says what is missing: the forecast and the records not stored yet, with the way to Live Data', none.miss);
  t.ok(/No forecast is stored/.test(none.ans) && /normal \w+ week/.test(none.ans) && /No forecast is stored/.test(none.week) && /n\/a/.test(none.kpi) && /No usable forecast/.test(none.kpi) && none.m4 === 'Forecast not stored yet', 'the answer, the week card and the headline numbers say the week runs as a normal week', { ans: none.ans, kpi: none.kpi });
  t.eq(none.scn, [false, true, true, true], 'the simulations are switched off without a forecast to build them on');
  t.ok(/No signal record is stored/.test(none.sig) && /not stored in this browser yet|no season to date collector/.test(none.seas) && none.out === '' && /calendar/.test(none.seas) && /not stored yet/.test(none.src) && /No ZIP carries a value|Gray everywhere/.test(none.wxLayer), 'signals, season, outlooks and the week layer of the map say they have nothing, or hide', { sig: none.sig, seas: none.seas.slice(0, 200), wx: none.wxLayer });
  const N1 = await agree('with no live record');
  t.ok(N1.E.wk.src === 'normal' && N1.S.weekTotal[1] === N1.S.weekTotal[2], 'and the week table shows a normal week: this week equals the normal week', N1.S.weekTotal);
  for (const k of ['week', 'planByZip']) checkFile(`with no live record, file ${k}`, await dl(() => press(`#h17Files [data-x="${k}"]`)));
  await clean('with no live record');
  await page.evaluate(() => document.getElementById('h17Miss').querySelector('[data-act="golive"]').click()); await wait(200);
  t.eq(await page.evaluate(() => location.hash), '#live', 'Open Live Data goes to the Live Data module');
  /* a forecast older than 36 hours is named as stale and the week runs at normal */
  await fresh();
  const baked = await page.evaluate(() => JSON.parse(JSON.stringify(LIVE.baseline.records.nws_cold)));
  before = ctx.errors.length;
  await fresh({ 'tda.test.nolive': '1', 'tda.live.src.nws_cold': Object.assign({}, baked, { at: iso(40 / 24) }) });
  const old = await page.evaluate(() => { const F = HEATX.forecast(new Date()); return { F: F && { stale: F.stale, age: Math.round(F.ageH) }, miss: document.getElementById('h17Miss').innerText, ans: document.querySelector('#h17Answer [data-a="week"]').innerText, week: document.getElementById('h17Week').innerText, total: [...document.querySelectorAll('#h17Week tr.hd-total td')].map(td => td.innerText), stale: (document.getElementById('h17Rules').innerText.match(/Stale forecast[^\n]*(\n[^\n]*){0,12}/) || [''])[0] }; });
  t.ok(old.F && old.F.stale && old.F.age === 40 && ctx.errors.length === before && /A fresh forecast\./.test(old.miss) && /more than 36 hours old/.test(old.miss) && /more than 36 hours old/.test(old.ans) && /normal \w+ week/.test(old.ans) && old.total[1] === old.total[2] && /fired/i.test(old.stale), 'a stored forecast 40 hours old is called stale: the answer, the missing list and the rules table say so and the week runs at normal', old);
  await clean('with a stale forecast');
  /* and without the climate baseline: the page names the source of the cold exposure it falls back to */
  before = ctx.errors.length;
  await fresh({ 'tda.test.nolive': '1', 'tda.test.noclim': '1' });
  const bare = await page.evaluate(() => ({ source: HEATX.exposure().source, label: HEATX.exposure().label, seas: document.getElementById('h17SeasLive').innerText, miss: document.getElementById('h17Miss').innerText, src: document.getElementById('h17Src').innerText, cty: [...document.querySelectorAll('#h17Cty thead th')].map(h => h.innerText.replace(/\s+/g, ' ')), failed: /failed to load/i.test(document.getElementById('mod-heat').innerText) }));
  t.ok(!bare.failed && ctx.errors.length === before && bare.source !== 'grid' && (bare.source === 'none' ? /Normal cold by ZIP/.test(bare.miss) && /cold exposure is 1 in every ZIP/.test(bare.seas) : bare.seas.includes(bare.label.slice(0, 40))) && !bare.cty.some(h => /Freeze nights/i.test(h)), `without the climate baseline too the module mounts, names its fallback for cold exposure (${bare.source}) and drops the freeze nights column`, { bare, errors: ctx.errors.slice(before, before + 3) });
  await agree('with no live record and no climate baseline'); await clean('with no live record and no climate baseline');

  /* ---------- the forecast alone, then every record present ---------- */
  /* These states are built in the page's store with the baked baseline left out, so they hold whatever the baseline of the build carries:
     today that is the forecast alone, after a full bake it is every record, and neither may move what is checked here. */
  const ALONE = { 'tda.test.nolive': '1', 'tda.live.src.nws_cold': baked };
  await fresh(ALONE);
  const only = await page.evaluate(() => ({ recs: Object.keys(LIVE.all()), cols: [...document.querySelectorAll('#h17Cty thead th')].map(h => h.innerText.replace(/\s+/g, ' ')), sig: document.querySelectorAll('#h17Sig .hd-sig').length, out: document.getElementById('h17Outlook').innerHTML.length, miss: document.getElementById('h17Miss').innerText }));
  t.ok(only.recs.join() === 'nws_cold' && !only.cols.some(h => /Licensed|permits/i.test(h)) && only.sig === 0 && only.out === 0 && !/The forecast\./.test(only.miss) && /Records not stored yet/.test(only.miss), 'with the forecast alone: no license or permit column, no signal row, no outlook, and the missing list names the records, not the forecast', only);
  const geo = await page.evaluate(() => TDA_LIVE.geo.counties.map(c => ({ name: c.name, fips: c.fips }))), SY = synthetic(geo), store = {};
  Object.keys(SY).filter(id => id !== 'bls_energy').forEach(id => { store['tda.live.src.' + id] = SY[id]; });
  const otherCities = await page.evaluate(() => Object.keys(TDA_LIVE.BY_ID).filter(id => /^permits_/.test(id) && id !== 'permits_fortworth').map(id => [id, (TDA_LIVE.BY_ID[id].config || {}).city || id]));
  otherCities.forEach(([id, city], i) => { store['tda.live.src.' + id] = rec(id, Object.assign({}, SY.permits_fortworth.data, { city, byZip12: { [['75217', '75150'][i % 2]]: [90 + i, 12] } })); });
  before = ctx.errors.length;
  await fresh(Object.assign({}, ALONE, store));
  /* a price record arrives later, from a collector this build may not carry: the page picks it up on the live event, with no reload */
  const had = await page.evaluate(() => ({ registered: Object.keys(TDA_LIVE.BY_ID), sig: [...document.querySelectorAll('#h17Sig .hd-sig .hd-chip')].map(c => c.textContent) }));
  await page.evaluate(async r => { if (!TDA_LIVE.BY_ID.bls_energy) TDA_LIVE.register({ id: 'bls_energy', name: 'Energy price indexes (synthetic)', publisher: 'Synthetic publisher', page: 'https://www.bls.gov/', grade: 'A', run: async () => r.data }); localStorage.setItem('tda.live.src.bls_energy', JSON.stringify(r)); await LIVE.reload(); }, SY.bls_energy);
  await wait(700);
  const full = await page.evaluate(() => { const tx = id => document.getElementById(id).innerText; return { recs: Object.keys(LIVE.all()).sort(), failed: /failed to load/i.test(tx('mod-heat')), F: (() => { const F = HEATX.forecast(new Date()); return { observed: !!(F && F.observed), ff: F && F.firstFreeze && F.firstFreeze.src }; })(), cols: [...document.querySelectorAll('#h17Cty thead th')].map(h => h.innerText.replace(/\s+/g, ' ')), cty: [...document.querySelectorAll('#h17Cty tbody tr')].map(r => [...r.cells].map(c => c.innerText)), ctyN: tx('h17CtyN'), seas: tx('h17SeasLive'), out: tx('h17Outlook'), o: (o => ({ ok: o.ok, tier: o.tier, headline: o.headline, use: o.use }))(TDA_LIVE.derive.outlook(LIVE.all(), new Date())), asis: [...document.querySelectorAll('#mod-heat [data-asis]')].map(e => [e.tagName, e.innerText]), sig: [...document.querySelectorAll('#h17Sig .hd-sig')].map(r => r.innerText), sigLinks: [...document.querySelectorAll('#h17Sig a')].map(a => [a.getAttribute('href'), a.target, a.rel]), miss: tx('h17Miss'), src: tx('h17Src'), week: tx('h17Week'), rules: tx('h17Rules'), zip: (() => { MODI.heat.receive({ zip: '76244' }); return tx('h17Zip'); })() }; });
  t.ok(!full.failed && ctx.errors.length === before && ['acis_season', 'cpc_outlook', 'nbm_extended', 'ercot_grid', 'cpsc_recalls', 'fedreg_rules', 'tdlr_licenses', 'permits_fortworth', 'bls_energy', 'nws_cold'].concat(otherCities.map(c => c[0])).every(id => full.recs.includes(id)), 'with every record present the module mounts with no error', { recs: full.recs, errors: ctx.errors.slice(before, before + 3) });
  t.ok(!had.sig.includes('Prices') && full.sig.some(s => /^PRICES/i.test(s)), 'a record that arrives while the page is open shows up on the live event, without a reload', { before: had.sig, after: full.sig.map(s => s.slice(0, 20)) });
  const li = full.cols.findIndex(h => /Licensed contractors per 10,000 households/i.test(h)), pi = full.cols.findIndex(h => /permits/i.test(h)), tar = full.cty.find(r => r[0] === 'Tarrant'), dal = full.cty.find(r => r[0] === 'Dallas');
  const tarP = String(await page.evaluate(z => Object.keys(z).filter(k => ZI[k] && ZI[k].cty === 'Tarrant').reduce((a, k) => a + z[k][0], 0), SY.permits_fortworth.data.byZip12));
  const hh = await page.evaluate(() => { const p = HEATX.plan(HEATX.params({})); return Object.fromEntries(p.counties.map(c => [c.county, c.households])); }), licN = Object.fromEntries(SY.tdlr_licenses.data.counties.map(c => [c.name, c.contractors]));
  t.ok(li > 0 && pi > 0 && tar && dal && tar[li] === (licN.Tarrant / hh.Tarrant * 1e4).toFixed(1) && dal[li] === (licN.Dallas / hh.Dallas * 1e4).toFixed(1), 'the counties table gains licensed contractors per 10,000 households, computed from the license record', { cols: full.cols.slice(-3), tar: tar && tar.slice(-3), want: (licN.Tarrant / hh.Tarrant * 1e4).toFixed(1) });
  t.ok(tar && +tarP > 0 && tar[pi] === tarP && dal && (otherCities.length ? /^\d+$/.test(dal[pi]) : dal[pi] === 'none published') && full.cty.some(r => r[pi] === 'none published') && /Permits count heating and cooling work together/.test(full.ctyN), 'and observed mechanical permits where a city publishes them (Fort Worth, in Tarrant County), "none published" elsewhere', { tar: tar && tar[pi], dal: dal && dal[pi] });
  t.ok(/Mechanical permits here/i.test(full.zip) && /340/.test(full.zip), 'the card of a Fort Worth ZIP shows its own permits');
  t.ok(/Reserve stance\./.test(full.seas) && /within 25% of normal or ahead of it \(212 heating degree days against a normal 240 to this date \(88%\)\)/.test(full.seas) && /moves no budget on it/.test(full.seas), 'a season within a quarter of normal argues for no carry over of the reserve, and the page says so as a stance, not a budget move', (full.seas.match(/Reserve stance\.[^\n]*/) || [''])[0]);
  t.ok(/212 heating degree days at DFW Airport/.test(full.seas) && /against a normal 240/.test(full.seas) && /First freeze/.test(full.seas) && /not yet/.test(full.seas) && /Observed through/.test(full.seas), 'the season card shows the season to date against normal and the first freeze status from the season record', full.seas.slice(0, 400));
  t.ok(full.F.observed && !/Off: the season record has no observed lows|the season record has no observed lows/.test(full.rules), 'observed lows from the season record switch the week after a freeze rule on', { F: full.F, rule: (full.rules.match(/Week after a freeze[^\n]*\n[^\n]*/) || [''])[0] });
  t.ok(/The two weeks ahead: stage, do not spend/i.test(full.out) && /6 TO 10 DAYS|6 to 10 days/i.test(full.out) && /below normal temperatures favored at 40%/.test(full.out) && /128% of the normal heating load/.test(full.out) && /above normal temperatures favored at 33%/.test(full.out) && /never moves a dollar/.test(full.out) && /What it is for\./.test(full.out) && full.o.ok && full.out.includes(full.o.headline) && full.out.includes(full.o.use) && (full.o.tier >= 1 ? /keep the freeze reserve whole/.test(full.out) : /leave the reserve alone/.test(full.out)), 'the two weeks ahead show the live layer\'s own reading (its tier, its headline, what the tier is for), both windows with their lean and load, as a reason to stage and never to spend', { out: full.out, o: full.o });
  t.ok(full.o.tier >= 1 ? /Two weeks ahead:/.test(full.week) && full.week.includes(full.o.headline) && /Hold the freeze reserve/.test(full.week) && /moves no budget/.test(full.week) : !/Two weeks ahead:/.test(full.week), 'a cold lean in the outlook is named where the reserve is shown, as a reason to hold it; without a cold lean the week card says nothing of the outlook', { tier: full.o.tier, line: (full.week.match(/Two weeks ahead:[^\n]*/) || [''])[0] });
  t.ok(/Blend guidance/i.test(full.out) && /Best freeze chance six days out or later: \d+%/.test(full.out) && /Texas grid: Normal conditions/.test(full.out), 'with the blend guidance and the grid reading as two more pieces of evidence', full.out.slice(-500));
  t.ok(full.sig.length === 3 && /^RECALLS/i.test(full.sig[0]) && /2 recalls of central heating equipment in the last 12 months/.test(full.sig[0]) && /Comfort-Aire/.test(full.sig[0]) && full.asis.some(a => a[0] === 'CITE' && /– Sold Under the Comfort-Aire Name$/.test(a[1])) && /In the ad:/.test(full.sig[0]) && /never tell a homeowner/.test(full.sig[0]) && /^PRICES/i.test(full.sig[1]) && /electricity up 4\.2%/.test(full.sig[1]) && /piped gas down 1\.3%/.test(full.sig[1]) && /Never print a savings figure/.test(full.sig[1]) && /^RULES/i.test(full.sig[2]) && /2 federal documents in the last 90 days/.test(full.sig[2]) && /Next date/.test(full.sig[2]), 'signals: one line each for recalls, prices and rules, with what to say in the ad and the grade; a recall title is shown as published, hyphen and dash kept, and marked as the publisher\'s words', full.sig);
  t.ok(full.sigLinks.length >= 2 && full.sigLinks.every(a => /^https:\/\/(www\.cpsc\.gov|www\.federalregister\.gov)\//.test(a[0]) && a[1] === '_blank' && /noopener/.test(a[2])), 'the publisher links open in a new tab with noopener', full.sigLinks);
  t.ok(!full.miss.trim() && !/not stored yet/.test(full.src) && (full.src.match(/fetched/g) || []).length >= 9, 'nothing is listed as missing and the source register gives the age of every record', { miss: full.miss, src: full.src.slice(-400) });
  await agree('with every record present'); await clean('with every record present');
  const ctyCsv = checkFile('with every record present, table counties', await dl(() => press('#mod-heat [data-csv="counties"]')), { rows: true });
  t.ok(ctyCsv.rows[0].includes('licensed_contractors_per_10k_households') && ctyCsv.rows.find(r => r[0] === 'Tarrant')[ctyCsv.rows[0].indexOf('mechanical_permits_12_months')] === tarP, 'the counties file carries the license and permit columns');
  /* records of the wrong shape hide their rows and break nothing */
  before = ctx.errors.length;
  const junk = {}; ['acis_season', 'cpc_outlook', 'cpsc_recalls', 'fedreg_rules', 'tdlr_licenses', 'permits_fortworth'].forEach((id, i) => { junk['tda.live.src.' + id] = rec(id, [{ v: 2, nothing: true }, 'text', { recalls: 'no' }, { docs: [{}] }, { counties: [null, 7] }, { city: 'X', months: [], byZip12: { 76102: 'x' } }][i]); });
  await fresh(Object.assign({}, ALONE, junk));
  const odd = await page.evaluate(() => ({ failed: /failed to load/i.test(document.getElementById('mod-heat').innerText), sig: document.querySelectorAll('#h17Sig .hd-sig').length, out: document.querySelectorAll('#h17Outlook .hd-sig').length, outSays: document.getElementById('h17Outlook').innerText, perm: document.getElementById('h17Perm').innerHTML.length, cols: [...document.querySelectorAll('#h17Cty thead th')].map(h => h.innerText.replace(/\s+/g, ' ')).filter(h => /Licensed|permits/i.test(h)), seas: document.getElementById('h17SeasLive').innerText.slice(0, 80) }));
  t.ok(!odd.failed && ctx.errors.length === before && odd.sig === 0 && odd.out === 0 && odd.perm === 0 && !odd.cols.length && /could not be read|Refresh the live data/.test(odd.outSays) && /no budget ever moves/.test(odd.outSays), 'records of an unexpected shape hide their rows and columns and throw nothing; an outlook record that cannot be read says so in one line', { odd, errors: ctx.errors.slice(before, before + 3) });
  await agree('with records of an unexpected shape'); await clean('with records of an unexpected shape');

  /* ---------- money left unspent is explained where it shows: what the hurdle is, that it counts pipeline value, which control to change ---------- */
  const setCtl = async (path, v) => { await page.evaluate(([q, x]) => { const el = document.querySelector(`#mod-heat [data-p="${q}"]`); if (el.type === 'checkbox') el.checked = x; else el.value = String(x); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [path, v]); await wait(450); };
  /* the plan month is set to November here and in the next block, so the figures do not move with the month the test runs in */
  const NOV = { 'tda.heat.v1': { v: 1, P: { month: 10 } } };
  await fresh(NOV); await setCtl('pipeCredit', 0);
  const U = await page.evaluate(() => { const P = HEATX.params(store.get('tda.heat.v1', {}).P), pl = HEATX.plan(P), full = HEATX.plan(HEATX.set(P, 'pipeCredit', 1), { lite: true }), usd = v => '$' + N(v), why = document.getElementById('h17Why');
    return { credit: P.pipeCredit, unspent: usd(pl.T.unspent), atHurdle: pl.T.atHurdle, share: pl.T.unspent / pl.T.budget, fullUnspent: full.T.unspent, title: (why.querySelector('.ct') || {}).textContent || '', why: why.innerText, where: document.querySelector('#h17Answer [data-a="where"]').innerText, kpi: document.querySelector('#h17Kpis .kpi .kd').textContent, note: document.getElementById('h17LinesT').innerText, order: [...document.querySelectorAll('#mod-heat .wrap > *')].map(e => e.id).slice(0, 6), judg: document.getElementById('h17Judg').innerText }; });
  t.ok(U.credit === 0 && U.atHurdle && U.share > 0.5 && U.fullUnspent < 0.5, 'with the pipeline credit at 0 the plan leaves most of $10,000 unspent and full credit places it all again: the arithmetic the page has to explain', { unspent: U.unspent, share: U.share, full: U.fullUnspent });
  t.ok(U.title === `Why ${U.unspent} of $10,000 stays unspent` && U.order.indexOf('h17Why') === U.order.indexOf('h17Kpis') + 1, 'the explanation sits right under the headline numbers, under a title that names the money', { title: U.title, order: U.order });
  t.ok(/less than \$3\.00 of gross profit/.test(U.why) && /first ticket plus the pipeline credit/.test(U.why) && /the pipeline credit is 0%/.test(U.why) && /on first tickets alone almost no ZIP clears the hurdle/.test(U.why) && /not a fault/.test(U.why) && /With the pipeline credit at 100% the same plan would place all \$10,000/.test(U.why) && /raise the pipeline credit, lower the hurdle, or raise the line trust/.test(U.why) && /Advanced in The plan/.test(U.why),
    'it says what the hurdle is, that it counts pipeline value, why a credit of 0 strands the money, what full credit would do, and the three controls that change it', U.why);
  t.ok(U.where.includes(`${U.unspent} of the $10,000 stays unspent`) && /pipeline credit at 0%/.test(U.where) && /Advanced in The plan/.test(U.where) && U.kpi.includes(`${U.unspent} of $10,000 left unspent`) && /pipeline credit 0% counted/.test(U.kpi) && /is left unspent/.test(U.note) && /pipeline credit at 0 most of a budget stays unspent/.test(U.judg), 'the answer, the headline number, the line notes and the judgment calls each name the unspent money and its cause', { where: U.where.slice(-330), kpi: U.kpi });
  await press('#h17Why [data-act="adv"]');
  t.ok(await page.evaluate(() => document.getElementById('h17Adv').open && !!document.activeElement && document.activeElement.dataset.p === 'pipeCredit'), 'its button opens the advanced drawer on the pipeline credit');
  await agree('with the pipeline credit at 0'); await clean('with the pipeline credit at 0');
  await setCtl('pipeCredit', 25);
  t.ok(await page.evaluate(() => HEATX.plan(HEATX.params(store.get('tda.heat.v1', {}).P)).T.unspent === 0 && document.getElementById('h17Why').innerHTML === ''), 'with the money placed again there is nothing to explain and the note is gone');
  /* money that cannot be placed for another reason is not blamed on the hurdle: every ZIP blocked */
  before = ctx.errors.length; await fresh({ 'tda.heat.v1': { v: 1, P: { blocks: await page.evaluate(() => ZR.map(z => z.zip)) } } });
  const blk = await page.evaluate(() => { const pl = HEATX.plan(HEATX.params(store.get('tda.heat.v1', {}).P)); return { zips: pl.T.zips, atHurdle: pl.T.atHurdle, note: (pl.notes.find(n => n.kind === 'block') || {}).text || '', why: document.getElementById('h17Why').innerText, where: document.querySelector('#h17Answer [data-a="where"]').innerText, kpi: document.querySelector('#h17Kpis .kpi .kd').textContent, rows: document.querySelectorAll('#h17Tbl tbody tr').length, adv: !!document.querySelector('#h17Why [data-act="adv"]') }; });
  t.ok(ctx.errors.length === before && blk.zips === 0 && !blk.atHurdle && blk.note.length > 20 && blk.why.includes(blk.note) && !/hurdle/i.test(blk.why) && !blk.adv && /No ZIP clears the plan/.test(blk.where) && /clear the blocked ZIPs/.test(blk.where) && /nothing more can be bought/.test(blk.kpi) && blk.rows === 0, 'with every ZIP blocked the page mounts, says in the engine\'s words why nothing is placed, and does not blame the hurdle', blk);
  await clean('with every ZIP blocked');

  /* ---------- the answer says only what the numbers beside it bear (found by the review of the finished page) ---------- */
  /* what the answer says, with the engine's own figures for the same saved settings */
  const told = () => page.evaluate(() => { const P = HEATX.params((store.get('tda.heat.v1', {}) || {}).P || {}), pl = HEATX.plan(P), F = HEATX.forecast(new Date()), wk = HEATX.week(P, F), q = s => (document.querySelector('#mod-heat ' + s) || {}).innerText || '', usd = v => '$' + N(v);
    return { where: q('[data-a="where"]'), what: q('[data-a="what"]'), week: q('[data-a="week"]'), monday: q('[data-a="monday"]'), why: q('#h17Why'), miss: q('#h17Miss'), head: [...document.querySelectorAll('#h17Week .dsec')].map(e => e.innerText).join(' | '), reserve: [...document.querySelectorAll('#h17Week .hd-reserve')].map(e => e.innerText).join(' | '), kpiCold: [...document.querySelectorAll('#h17Kpis .kpi')].pop().innerText.replace(/\s+/g, ' '), linesNote: q('#h17LinesT') + ' ' + q('#h17Plats'), guards: q('#h17Meth'),
      E: { share20: pl.T.share20, lines: pl.lines.map(l => ({ id: l.id, name: l.name, dollars: l.dollars, win: N(l.winnable), per: l.gpPerDollar, perPlan: l.gpPerDollarPlanned, run: !!l.runWhy })), floor: pl.T.floor, floorUsd: usd(pl.T.floor.dollars), floorPer: pl.T.floor.dollars > 0 ? '$' + D(pl.T.floor.gp / pl.T.floor.dollars, 2) : '', spent: usd(pl.T.spent), hurdle: pl.T.hurdle, gamma: D(P.gamma, 2), season: N(pl.line.heat.season), shop: wk.wx.origin.min, metro: F ? F.head.minLow : null, wkLines: wk.lines.map(l => ({ id: l.id, name: l.name, normal: l.normal })), rs: { none: wk.reserve.none, back: usd(wk.reserve.back), wanted: usd(wk.reserve.wanted), month: usd(wk.reserve.month), share: Math.round(wk.reserve.share * 100) + '%' }, from: wk.from, to: wk.to, today: wk.today, monday: wk.monday, first: (wk.list.find(x => x.k !== 'sim') || {}).text || '', days: wk.days.map(d => d.label) } }; });
  await fresh(NOV); let TL = await told();
  { const tu = TL.E.lines.find(l => l.id === 'maint'), fu = TL.E.lines.filter(l => l.dollars > 0 && l.run && l.per < TL.E.hurdle - 0.005 && !(l.perPlan < TL.E.hurdle - 0.005));
    t.ok(TL.where.startsWith('Spend it close to the shop.') && TL.E.share20 >= 0.595, 'at the defaults most of the money is close and the answer opens on that', [TL.where.slice(0, 40), TL.E.share20]);
    t.ok(!/fill up first/.test(TL.what) && TL.what.includes(`repair season index ${TL.E.season}`) && TL.what.includes(`about ${TL.E.lines[0].win} repair jobs this month against ${TL.E.lines[1].win} furnace and ${TL.E.lines[2].win} heat pump replacements`) && TL.what.includes(`believes only ${TL.E.gamma} of that modeled gap`) && +TL.E.lines[0].win.replace(/,/g, '') > +TL.E.lines[1].win.replace(/,/g, ''), 'why repair leads is said with the plan\'s own figures: the season index, the jobs paid ads can win inside the reach by line, and the line trust in force', TL.what);
    t.ok(fu.length >= 1 && fu.some(l => l.id === 'maint') && fu.every(l => TL.what.includes(`brings back $${l.per.toFixed(2)}`)) && /One caution: at the platforms that run at this budget, the money in tune ups brings back/.test(TL.what) && TL.what.includes('under the $3.00 hurdle') && TL.linesNote.includes(`brings back $${tu.per.toFixed(2)} of gross profit per ad dollar at the platforms that run`) && /platform minimums never move ZIP money/.test(TL.linesNote), 'a line whose money returns under the hurdle at the platforms that run is named in the answer itself, with the same figure as the line notes', { what: TL.what.slice(-260), fu });
    t.ok(TL.kpiCold.includes(`${Math.round(TL.E.metro)}°F`) && (Math.round(TL.E.shop) === Math.round(TL.E.metro) ? /The next rule at the shop is /.test(TL.kpiCold) : TL.kpiCold.includes(`Coldest across the metro; ${Math.round(TL.E.shop)}°F at the shop, where the next rule is `)), 'the coldest low is the metro\'s, and the next rule is named where the rules are read: at the shop', TL.kpiCold);
    t.ok(TL.reserve.includes(`What a normal week spends: ${100 - parseInt(TL.E.rs.share, 10)}% of the month's pace`) && TL.reserve.includes(`The other ${TL.E.rs.share}, ${TL.E.rs.month}, is the freeze reserve`) && /count the whole budget/.test(TL.reserve), 'the week card says a normal week spends the month less the reserve, so the month\'s headline numbers are not read as a normal month', TL.reserve.slice(0, 400));
    t.ok(/the one place the hurdle does not rule/.test(TL.guards) && /No ZIP takes more than 15% of the budget\./.test(TL.guards), 'the guards name the home turf floor as the exception to the hurdle, and the ZIP cap as a share of the budget', TL.guards.slice(0, 80));
    /* one figure a day: the night strip, the first Monday step and the week sheet all carry the repair search campaigns' budget of that day */
    const strip = await page.evaluate(() => { const wk = HEATX.week(HEATX.params((store.get('tda.heat.v1', {}) || {}).P || {}), HEATX.forecast(new Date())), ex = HEATX.exports(wk.season, wk, wk.plan.P), rep = wk.plan.campaigns.filter(c => c.kind === 'search' && c.lines[0] === 'heat').map(c => c.name), rows = ex.week.text.split('\n').filter(l => l.startsWith('budget,')).map(l => l.split(','));
      return [...document.querySelectorAll('#h17Week .hd-night')].map((n, i) => ({ label: n.querySelector('.hd-nd').innerText, shown: n.querySelector('.hd-nb').innerText, sheet: rows.filter(r => r[3] === wk.days[i].date && rep.includes(r[1])).reduce((a, r) => a + +r[4], 0), answered: wk.days[i].answered })); });
    t.ok(strip.length === 7 && strip.every(d => d.shown.startsWith('$' + Math.round(d.sheet).toLocaleString('en-US') + ' repair campaigns') && (d.answered ? TL.E.first.includes(`${d.label} $${Math.round(d.sheet).toLocaleString('en-US')}`) : d.sheet === 0)), 'the night strip shows for each day the figure the Monday list and the week sheet carry for the repair campaigns', strip.slice(0, 3)); }
  /* a stored forecast with no reading time is called that: never "from January 1", the date an empty time reads as */
  { const noAt = JSON.parse(JSON.stringify(baked)); delete noAt.at; await fresh({ 'tda.test.nolive': '1', 'tda.live.src.nws_cold': noAt, 'tda.heat.v1': { v: 1, P: { month: 10 } } }); const S0 = await told();
    t.ok(/The stored forecast carries no reading time, so the week runs as a normal November week/.test(S0.week) && /carries no reading time/.test(S0.miss) && !/January 1|1970|36 hours old/.test(S0.miss + S0.week) && !/today's forecast/.test(S0.monday) && /Today is \w+: the list covers /.test(S0.monday), 'a forecast stored without a reading time is called that, and a week at normal does not speak of today\'s forecast', { week: S0.week.slice(0, 160), miss: S0.miss.slice(0, 220), monday: S0.monday.slice(-160) }); }
  await fresh(NOV); TL = await told();
  /* the clock here is a Friday: the list covers the seven days from tomorrow, says so, and its days carry their dates */
  { const dow = new Date(TL.E.today + 'T12:00:00Z').getUTCDay(), wd = d => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(d + 'T12:00:00Z').getUTCDay()];
    t.ok(TL.E.days.filter(l => !/^Sun/.test(l)).every(l => TL.E.first.includes(l + ' $')) && /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d+$/.test(TL.E.days[0]), 'the first Monday step dates every day it budgets', TL.E.first.slice(0, 200));
    if (dow !== 0 && dow !== 1) t.ok(TL.head.includes(`DO THIS NOW, FOR ${wd(TL.E.from).toUpperCase()}`) && !/DO THIS ON MONDAY/.test(TL.head) && TL.monday.includes(`Today is ${wd(TL.E.today)}`) && TL.monday.includes(`covers ${wd(TL.E.from)}`) && /On Monday [A-Z][a-z]+ \d+ the page writes it again/.test(TL.monday), 'on a day that is not a Sunday or a Monday the list is headed by the seven days it covers, and the answer says when it is written again', { head: TL.head, monday: TL.monday.slice(-200) });
    else t.ok(/DO THIS ON MONDAY, /.test(TL.head) && !/Today is/.test(TL.monday), 'on a Sunday or a Monday the list is headed for that Monday', TL.head); }
  /* the same page on a Monday: the forecast record moved three days on, the clock held on Monday November 16 */
  { const mon = JSON.parse(JSON.stringify(baked)), sh = d => new Date(Date.parse(d + 'T12:00:00Z') + 3 * 864e5).toISOString().slice(0, 10); mon.at = '2026-11-16T15:00:00.000Z'; mon.data.points.forEach(p => { (p.nights || []).forEach(n => { n.d = sh(n.d); if (n.m) n.m = sh(n.m); }); (p.days || []).forEach(d => { if (d.d) d.d = sh(d.d); }); });
    await page.clock.setFixedTime(new Date('2026-11-16T15:25:00Z')); await fresh({ 'tda.test.nolive': '1', 'tda.live.src.nws_cold': mon, 'tda.heat.v1': { v: 1, P: { month: 10 } } }); const M = await told();
    t.ok(M.E.today === '2026-11-16' && M.E.from === '2026-11-17' && M.E.to === '2026-11-23' && M.head.includes('DO THIS ON MONDAY, NOVEMBER 16, 2026') && !/Today is/.test(M.monday) && M.E.first.includes('Tue Nov 17 $') && M.E.first.includes('Mon Nov 23 $') && M.monday.includes('Tue Nov 17 $'), 'on a Monday the list is headed for that Monday and budgets the seven days from Tuesday, each dated', { head: M.head, first: M.E.first.slice(0, 160), today: M.E.today });
    const wkName = await page.evaluate(() => HEATX.exports(null, HEATX.week(HEATX.params({ month: 10 }), HEATX.forecast(new Date())), HEATX.params({ month: 10 })).week.name);
    t.eq(wkName, 'heat-desk_week_2026-11-17_to_2026-11-23.csv', 'and the week sheet is named for those seven days');
    await page.clock.setFixedTime(new Date(BASE)); }
  /* a large budget on a wide reach: most of the money is not close, and the answer does not say it is */
  await fresh({ 'tda.heat.v1': { v: 1, P: { month: 10, budget: 100000, half: { heat: 60, furnace: 90, heatpump: 90, maint: 45 } } } }); TL = await told();
  t.ok(TL.E.share20 < 0.445 && TL.where.startsWith('At this budget most of the money goes farther than 20 minutes from the shop.') && !/Spend it close to the shop/.test(TL.where) && TL.where.includes(Math.round(TL.E.share20 * 100) + '% of the money within 20 minutes'), 'with a fifth of the money within 20 minutes the answer does not open on "close to the shop"', [TL.where.slice(0, 200), TL.E.share20]);
  await agree('at $100,000 on the widest reach');
  /* a small budget: no furnace ZIP is bought, so the answer may not say the replacement ZIPs fill up first; it says what holds the line out */
  await fresh({ 'tda.heat.v1': { v: 1, P: { month: 10, budget: 1000 } } }); TL = await told();
  { const zero = TL.E.lines.filter(l => !(l.dollars > 0));
    t.ok(zero.some(l => l.id === 'furnace') && !/fill up first/.test(TL.what) && /Furnace replacement gets nothing at this budget: no ZIP would hold the minimum of half a lead a month there\./.test(TL.what) && !TL.what.includes('furnace replacement 0'), 'at $1,000 furnace replacement has no money, and the answer says why instead of saying its ZIPs filled up first', TL.what); }
  await agree('at $1,000');
  /* a hurdle of $10: all that is placed is the home turf floor, and the answer and the note say so with the engine's figures */
  await fresh({ 'tda.heat.v1': { v: 1, P: { month: 10, hurdle: 10 } } }); TL = await told();
  t.ok(TL.E.floor.dollars > 100 && TL.what.includes(`Most of what is placed is the home turf floor: the ${TL.E.floor.zips} ZIPs within 12 minutes of the shop stay in repair and tune ups whatever they return`) && !/volume/.test(TL.what) && TL.why.includes(`Of the ${TL.E.spent} that is placed, ${TL.E.floorUsd} is the home turf floor`) && TL.why.includes(`brings back ${TL.E.floorPer} of gross profit per ad dollar, under the cut`) && /Set Home turf to 0 under Advanced/.test(TL.why), 'with a hurdle of $10 the answer says the money is the home turf floor and the note counts it and what it returns', { what: TL.what, floor: TL.E.floor });
  /* the pipeline credit at 0: the repair money that returns under the hurdle is the floor, and the page does not blame the platform folds for it */
  await fresh({ 'tda.heat.v1': { v: 1, P: { month: 10, pipeCredit: 0 } } }); TL = await told();
  { const h = TL.E.lines[0];
    t.ok(h.per < TL.E.hurdle && h.perPlan < TL.E.hurdle && TL.why.includes('The exception.') && TL.why.includes(`${TL.E.floorUsd} is the home turf floor`) && TL.why.includes(`brings back ${TL.E.floorPer}`) && !/One caution/.test(TL.what) && !TL.linesNote.includes('Heating repair brings back'), 'with no pipeline credit the repair money under the hurdle is named as the home turf floor in the note, not put down to a platform fold', { why: TL.why.slice(-420), heat: h }); }
  /* every dollar on tune ups: the week sentence follows the line that has the money */
  await fresh({ 'tda.heat.v1': { v: 1, P: { month: 10, mode: 'custom', mix: { heat: 0, furnace: 0, heatpump: 0, maint: 100 } } } }); TL = await told();
  t.ok(TL.E.wkLines[0].normal === 0 && !/Heating repair runs/.test(TL.week) && /Tune up and safety check runs \d+% (over|under) a normal November week|Tune up and safety check runs level with a normal November week/.test(TL.week) && TL.what.startsWith('Tune up and safety check takes 100% of the money'), 'with no money on repair the week sentence follows tune ups, the line that has it', TL.week);
  /* no freeze reserve: nothing is returned to one */
  await fresh({ 'tda.heat.v1': { v: 1, P: { month: 10, reserve: 0 } } }); TL = await told();
  t.ok(TL.E.rs.none === true && !/to the freeze reserve|from the freeze reserve|reserve of \$0/.test(TL.week + TL.reserve + TL.E.first) && TL.week.includes(`leaving ${TL.E.rs.back} unspent: no freeze reserve is set`) && /No freeze reserve is set/.test(TL.reserve) && !/What a normal week spends/.test(TL.reserve), 'with the freeze reserve at 0 the answer and the week card say the money is left unspent, not returned to a reserve', { week: TL.week, reserve: TL.reserve });
  await clean('with no freeze reserve');
  /* a larger budget lifts tune ups over its platform minimums: the caution is gone */
  await fresh({ 'tda.heat.v1': { v: 1, P: { month: 10, budget: 25000 } } }); TL = await told();
  t.ok(TL.E.lines.every(l => !(l.dollars > 0) || l.per >= TL.E.hurdle - 0.005 || !l.run) && !/One caution/.test(TL.what), 'at $25,000 no line returns under the hurdle at the platforms that run, and the answer carries no caution', TL.what.slice(-200));
  await fresh(NOV);

  /* ---------- honest outcomes: every figure the page shows is priced at the platforms that run after the minimums ---------- */
  await fresh(NOV);
  const outcomes = () => page.evaluate(() => { const PQ = HEATX.params(store.get('tda.heat.v1', {}).P), pl = HEATX.plan(PQ), usd = v => '$' + N(v), cells = sel => [...document.querySelectorAll(sel + ' tbody tr')].map(r => [...r.cells].map(c => c.innerText.split('\n')[0].trim())), kpi = {}; document.querySelectorAll('#h17Kpis .kpi').forEach(k => { kpi[k.querySelector('.kl span').textContent] = [k.querySelector('.kv').textContent, k.querySelector('.kd').textContent]; });
    return { leads: N(pl.T.leads), cpl: usd(pl.T.cpl), jobs: D(pl.T.jobs, 1), gpd: usd(pl.T.gpDirect), planned: pl.T.leadsPlanned, T: pl.T.leads, over: pl.T.leadsOver, kpi, rows: cells('#h17LinesT'), camps: cells('#h17Camps'),
      lines: pl.lines.map(l => ({ name: l.name, leads: D(l.leads, 1), cpl: usd(l.cpl), run: HEATX.PLATS.filter(q => l.platRun[q] > 0.004).map(q => `${HEATX.PLAT_NAMES[q]} ${P0(l.platRun[q])}`).join(', '), why: !!l.runWhy })), campE: pl.campaigns.map(c => [c.name, D(c.leads, 1), c.targetCpa == null ? '' : usd(c.targetCpa)]),
      plat: document.getElementById('h17Plats').innerText, runs: [...document.querySelectorAll('#h17Plats .hd-runs li')].map(li => li.innerText), money: JSON.stringify(pl.zips.map(r => [r.zip, r.dollars, r.bid])), own: (document.querySelector('.hd-col.own') || {}).innerText || '', sure: document.getElementById('h17Sure').innerText };
    function P0(f) { return P(f * 100, 0); } });
  const HO = await outcomes();
  t.ok(HO.kpi['Leads a month'][0] === HO.leads && HO.kpi['Leads a month'][1].includes(HO.cpl + ' a lead') && /priced at the platforms that run/.test(HO.kpi['Leads a month'][1]) && HO.kpi['Booked jobs a month'][0] === HO.jobs && HO.kpi['Gross profit, direct'][0] === HO.gpd && HO.planned > HO.T + 1 && HO.over === 0 && HO.own.includes(`${HO.leads} · ${HO.cpl}`),
    'the headline leads, cost per lead, booked jobs and gross profit are the engine\'s figures at the platforms that run, and the budget column repeats them', { kpi: HO.kpi['Leads a month'], engine: [HO.leads, HO.cpl, HO.jobs, HO.gpd], planned: HO.planned });
  t.ok(HO.lines.every(l => { const r = HO.rows.find(x => x[0] === l.name); return r && r[4] === l.leads && r[5] === l.cpl && r[11] === l.run; }) && (HO.rows.find(r => /^Tune up/.test(r[0])) || [])[11] === 'Google Search 100%', 'the line table shows each line\'s leads, its cost per lead and the platforms it actually runs on: tune up on Google Search alone at the defaults', HO.rows.map(r => [r[0], r[4], r[5], r[11]]));
  t.ok(HO.runs.length >= HO.lines.filter(l => l.why).length && HO.runs.some(x => /Tune up and safety check runs on Google Search alone/.test(x)) && HO.runs.some(x => /Tune up and safety check brings back \$\d\.\d\d of gross profit per ad dollar at the platforms that run, under the \$3\.00 hurdle/.test(x)) && /priced at the platforms that actually run/.test(HO.plat) && /fewer leads a month than the planned mix would show/.test(HO.plat) && !/count about/i.test(HO.plat), 'under Platforms the page names the lines that run dearer than planned and says every outcome is already priced that way: nothing is left for the reader to subtract', { runs: HO.runs, note: (HO.plat.match(/Minimums are fold notes[^\n]*/) || [''])[0] });
  t.ok(HO.campE.length >= 4 && HO.campE.every(c => { const r = HO.camps.find(x => x[0] === c[0]); return r && r[11] === c[1] && r[8] === c[2]; }), 'each campaign row carries its own leads and first target, at its own platform\'s lead cost', { page: HO.camps.map(r => [r[0], r[8], r[11]]), engine: HO.campE });
  for (const q of ['lsa', 'microsoft', 'meta', 'nextdoor']) await setCtl('platMin.' + q, 0);
  const HF = await outcomes();
  t.ok(HF.money === HO.money && HF.runs.length === 0 && !/priced at the platforms/.test(HF.plat + HF.kpi['Leads a month'][1]) && Math.abs(HF.T - HO.planned) < 1e-6 && HF.T === HF.planned && HF.kpi['Leads a month'][0] === N0(HO.planned), 'with every platform minimum at 0 nothing folds: the ZIP money is the same to the cent, and the page shows the leads the planned mix buys', { leads: [HO.T, HO.planned, HF.T], runs: HF.runs });
  function N0(v) { return Math.round(v).toLocaleString('en-US'); }
  await agree('with no platform minimum'); await press('#h17Reset'); await wait(350);

  /* ---------- the neighbours' events: service line assumptions, the brand's dispatch point ---------- */
  await fresh();
  const o0 = await pageSays();
  await page.evaluate(() => { BRANDX.save({ lat: 32.7555, lon: -97.3308 }); }); await wait(600);
  const o1 = await pageSays(), e1 = await engine();
  t.ok(o1.where !== o0.where && e1.counties[0] === 'Tarrant' && /Tarrant County/.test(o1.where), 'a new dispatch point in the brand panel redraws the plan from there (downtown Fort Worth leads with Tarrant County)', o1.where.slice(0, 200));
  await agree('from a Fort Worth dispatch point');
  await page.evaluate(() => { BRANDX.reset(); }); await wait(600);
  t.eq((await pageSays()).where, o0.where, 'and resetting the brand brings the Mesquite plan back');
  const slBefore = ctx.errors.length; await page.evaluate(() => BUS.emit('sl')); await wait(500);
  t.ok(ctx.errors.length === slBefore && (await pageSays()).where === o0.where, 'a service line recompute event redraws without error');
  /* hidden, the module waits; shown again, it catches up */
  await ctx.show('index'); await page.evaluate(() => { BRANDX.save({ lat: 32.7555, lon: -97.3308 }); }); await wait(500);
  const stale = await page.evaluate(() => document.querySelector('#h17Answer [data-a="where"]').innerText);
  await show(); const caught = await pageSays();
  t.ok(stale === o0.where && /Tarrant County/.test(caught.where), 'a change while another module is shown is drawn when the Heat Desk is shown again');
  await page.evaluate(() => { BRANDX.reset(); }); await wait(500);
  /* ================= the recorded day =================
     Every live record as its own collector stores it (see recorded() above), the clock held at that afternoon, the baseline baked into the build
     left out so a later bake cannot move a number. Each read is checked with its record in the store, then with it taken out. */
  const RD = await recorded();
  t.ok(!RD.failed.length && RD.ids.length === 10 && RD.ids.every(id => RD.recs[id] && RD.recs[id].ok !== false && RD.recs[id].data), `the collectors run on the recorded answers of 2026-11-13 and store ${RD.ids.length} records, with no network (${RD.calls} recorded answers served)`, RD.failed);
  await page.clock.setFixedTime(new Date(RD.now));
  const dayOf = (drop, patch, extra) => { const st = Object.assign({ 'tda.test.nolive': '1' }, extra || {}); RD.ids.forEach(id => { if (!(drop || []).includes(id)) st['tda.live.src.' + id] = (patch && patch[id]) || RD.recs[id]; }); return fresh(st); };
  const snap = () => page.evaluate(() => { const tx = id => document.getElementById(id).innerText, pl = HEATX.plan(HEATX.params({})), F = HEATX.forecast(new Date());
    return { failed: /failed to load/i.test(tx('mod-heat')), recs: Object.keys(LIVE.all()).sort(), out: document.getElementById('h17Outlook').innerHTML.length, outText: tx('h17Outlook'), outSig: document.querySelectorAll('#h17Outlook .hd-sig').length, week: tx('h17Week'), miss: tx('h17Miss'), perm: tx('h17Perm'), permLen: document.getElementById('h17Perm').innerHTML.length,
      cities: (tb => (tb ? [...tb.tBodies[0].rows].map(r => r.cells[0].innerText.split('\n')[0].trim()) : []))(document.querySelector('#h17Perm table')), cols: [...document.querySelectorAll('#h17Cty thead th')].map(h => h.innerText.replace(/\s+/g, ' ')), sig: [...document.querySelectorAll('#h17Sig .hd-sig > .hd-chip')].map(c => c.textContent.toUpperCase()), sigText: tx('h17Sig'), seas: tx('h17SeasLive'), src: tx('h17Src'),
      ff: F && F.firstFreeze ? F.firstFreeze : null, money: JSON.stringify(pl.zips.map(r => [r.zip, r.dollars, r.bid])), ctyRows: [...document.querySelectorAll('#h17Cty tbody tr')].map(r => [...r.cells].map(c => c.innerText.trim())) }; });
  before = ctx.errors.length; await dayOf();
  const all = await snap();
  t.ok(!all.failed && ctx.errors.length === before && all.recs.join() === RD.ids.slice().sort().join() && !all.miss.trim() && !/not stored yet/.test(all.src) && (all.src.match(/fetched/g) || []).length >= 10, 'on the recorded day the page holds all ten records, mounts with no error, lists nothing as missing and gives every record its age', { recs: all.recs, miss: all.miss, errors: ctx.errors.slice(before, before + 3) });
  const audit = await page.evaluate(() => { const s = document.getElementById('mod-heat'); return { inline: s.querySelectorAll('[onclick],[onchange],[oninput],[onkeydown],[onsubmit],script').length, untyped: [...s.querySelectorAll('.wrap button')].filter(b => b.type !== 'button').length, unnamed: [...s.querySelectorAll('.wrap button')].filter(b => !(b.innerText.trim() || b.getAttribute('aria-label') || b.title)).length,
    unlabeled: [...s.querySelectorAll('.wrap input, .wrap select')].filter(e => !(e.getAttribute('aria-label') || (e.id && s.querySelector(`label[for="${e.id}"]`)) || e.closest('label'))).length, dupIds: (ids => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))])([...s.querySelectorAll('[id]')].map(e => e.id)), csv: [...new Set([...s.querySelectorAll('[data-csv]')].map(b => b.dataset.csv))],
    heads: [...s.querySelectorAll('#h17Perm table, #h17SeasLive table')].every(tb => tb.tHead && [...tb.tHead.querySelectorAll('th')].every(h => h.scope === 'col')), links: [...s.querySelectorAll('#h17Sig a, #h17Outlook a, #h17Perm a')].every(a => /^https:\/\//.test(a.getAttribute('href')) && a.target === '_blank' && /noopener/.test(a.rel)) }; });
  t.ok(audit.inline === 0 && audit.untyped === 0 && audit.unnamed === 0 && audit.unlabeled === 0 && !audit.dupIds.length && audit.heads && audit.links && ['permits', 'gas', 'freeze'].every(k => audit.csv.includes(k)), 'with every record on the page: no inline handler, every button typed and named, every field labeled, no id used twice, the new tables have column heads and a CSV button each, and every publisher link opens in a new tab with noopener', audit);
  const RR = await page.evaluate(() => { const tx = id => document.getElementById(id).innerText, now = new Date(), recs = LIVE.all(), o = TDA_LIVE.derive.outlook(recs, now), ps = TDA_LIVE.permits.summary(recs), g = TDA_LIVE.permitsDallas.gasTests(LIVE.data('permits_dallas')), st = TDA_LIVE.climate.status(LIVE.data('acis_season'), null, now), pl = HEATX.plan(HEATX.params({})), usd = v => '$' + N(v);
    const hh = Object.fromEntries(pl.counties.map(c => [c.county, c.households])), lic = TDA_LIVE.tdlr.byCounty(LIVE.data('tdlr_licenses'), hh), up = TDA_LIVE.fedreg.upcoming(LIVE.data('fedreg_rules'), now), rows = tb => (tb ? [...tb.tBodies[0].rows].map(r => [...r.cells].map(c => c.innerText.replace(/\s+/g, ' ').trim())) : []), pt = document.querySelectorAll('#h17Perm table'), by = {};
    Object.keys(ps.byZip).forEach(z => { if (ZI[z]) by[ZI[z].cty] = (by[ZI[z].cty] || 0) + ps.byZip[z].mech12; });
    return { today: TDA_LIVE.derive.localDay(now, TDA_LIVE.geo.tz), o: { ok: o.ok, tier: o.tier, tierName: o.tierName, headline: o.headline, use: o.use, quote: (o.evidence.find(e => e.quote) || {}).quote || '', p32: o.blend && o.blend.freeze && o.blend.freeze.p32, at: o.blend && o.blend.freeze && o.blend.freeze.name, grid: o.grid && o.grid.name },
      out: tx('h17Outlook'), quotes: [...document.querySelectorAll('#h17Outlook q[data-asis]')].map(q => q.innerText), chip: (document.querySelector('#h17Outlook .hd-statline .hd-chip') || {}).textContent, week: tx('h17Week'),
      cities: ps.cities.map(c => ({ city: c.city, mech: N(c.last12.mech), heat: c.last12.heat == null ? null : N(c.last12.heat), r8: N(c.recent.mech), was: N(c.recent.sameWeeksLastYear.mech), note: c.heatNote })), permT: rows(pt[0]), gasT: rows(pt[1]), permText: tx('h17Perm'), permTitles: [...document.querySelectorAll('#h17Perm th')].map(h => h.title).filter(Boolean),
      gasM: [...document.querySelectorAll('#h17Perm .hd-gasm > div b')].map(b => b.textContent), gasAria: (document.querySelector('#h17Perm .hd-gasm') || { getAttribute: () => '' }).getAttribute('aria-label') || '', g: { tests: N(g.last12.tests), recent: N(g.recent.tests), was: N(g.recent.sameWeeksLastYear.tests), top: g.topZips.map(z => [z.zip, N(z.tests12)]), months: g.months.slice(-12).map(m => N(m.tests)) },
      planOf: Object.fromEntries(g.topZips.map(z => [z.zip, pl.at[z.zip] && pl.at[z.zip].inPlan ? usd(pl.at[z.zip].dollars) + ' rank ' + pl.at[z.zip].rank : 'not in the plan'])),
      ctyHead: [...document.querySelectorAll('#h17Cty thead th')].map(h => h.innerText.replace(/\s+/g, ' ')), ctyTitle: [...document.querySelectorAll('#h17Cty thead th')].map(h => h.title), cty: rows(document.querySelector('#h17Cty table')), ctyN: tx('h17CtyN'), permCounty: by, lic: Object.fromEntries(Object.keys(lic).map(k => [k, lic[k].contractorsPer10kHomes])),
      seas: tx('h17SeasLive'), headline: TDA_LIVE.climate.headline(st), ffT: rows(document.querySelector('#h17SeasLive table')), medians: st.counties.map(c => [c.name, c.firstFreeze && c.firstFreeze.median]).sort((a, b) => String(a[1]).localeCompare(String(b[1]))), freeze: st.freeze,
      sig: [...document.querySelectorAll('#h17Sig .hd-sig')].map(r => r.innerText), asis: [...document.querySelectorAll('#mod-heat [data-asis]')].map(e => [e.tagName, e.innerText, !!e.closest('#h17Outlook, #h17Sig')]), up: up.map(u => [u.what, u.on, u.recheck, u.title]), warn: document.querySelectorAll('#h17Sig .hd-chip.warn').length, links: [...document.querySelectorAll('#h17Sig a')].map(a => a.getAttribute('href')),
      recall: (LIVE.data('cpsc_recalls').recalls.find(r => /DR-HSH015/.test(r.title)) || {}).title || '' }; });
  t.eq(RR.today, '2026-11-13', 'the page\'s clock is held at the afternoon of the recording');
  /* (a) the two weeks ahead */
  t.ok(RR.o.ok && RR.o.tier === 1 && /^lean cold$/i.test(RR.chip || '') && RR.out.includes(RR.o.headline) && RR.out.includes(RR.o.use) && /The two weeks ahead: stage, do not spend/i.test(RR.out) && /never moves a dollar on this page/.test(RR.out) && /keep the freeze reserve whole/.test(RR.out), 'the two weeks ahead: the live layer\'s own tier, headline and use, as a reason to stage creative and hold the reserve, never to spend', { o: RR.o, out: RR.out.slice(0, 400) });
  t.ok(RR.o.quote.length > 40 && /[A-Za-z]-[A-Za-z]/.test(RR.o.quote) && RR.quotes.length === 1 && RR.quotes[0] === RR.o.quote && /In the forecaster's own words/.test(RR.out), 'the forecaster\'s sentence is shown as a quotation, word for word with its own hyphens, and marked as the publisher\'s words', { quote: RR.o.quote, shown: RR.quotes });
  t.ok(RR.out.includes(`Best freeze chance six days out or later: ${RR.o.p32}% at ${RR.o.at}`) && RR.out.includes(`Texas grid: ${RR.o.grid}`) && /6 TO 10 DAYS/i.test(RR.out) && /8 TO 14 DAYS/i.test(RR.out) && /above normal temperatures favored at 50%/.test(RR.out), 'with the two outlook windows, the blend guidance and the grid reading as evidence, each with its grade', RR.out.slice(-700));
  t.ok(/Two weeks ahead:/.test(RR.week) && RR.week.includes(RR.o.headline) && /Hold the freeze reserve/.test(RR.week) && /moves no budget/.test(RR.week), 'and the week card names the cold lean where the reserve is shown');
  /* (b) permits */
  const dalP = RR.permT.find(r => /^Dallas/.test(r[0])), fwP = RR.permT.find(r => /^Fort Worth/.test(r[0])), dalC = RR.cities.find(c => c.city === 'Dallas'), fwC = RR.cities.find(c => c.city === 'Fort Worth');
  t.ok(dalP && fwP && dalC && fwC && dalP[1] === dalC.mech && dalP[1] === '6,742' && dalP[3] === dalC.heat && dalP[3] === '1,067' && dalP[4] === dalC.r8 && dalP[5] === dalC.was && fwP[1] === fwC.mech && fwP[1] === '4,610' && fwP[4] === fwC.r8 && fwP[5] === fwC.was, 'observed permits: Dallas and Fort Worth with their 12 months, the permits naming heating, and the last 8 weeks against the same weeks a year earlier, as the live layer reads them', RR.permT);
  t.ok(fwC.heat === null && /unknown, not zero/.test(fwP[3]) && !/^0$/.test(fwP[3]) && fwC.note && RR.permText.includes(fwC.note) && RR.permText.includes(dalC.note), 'Fort Worth\'s heating count is unknown, not zero, and the collector\'s own sentence says why', { cell: fwP[3], note: fwC.note });
  t.ok(/Observed permits in the cities that publish them\s*B/i.test(RR.permText) && /Permit counts\s*B\s*permits that name heating\s*C/.test(RR.permText) && /Gas tests in Dallas: homes putting gas heat back in service\s*C/i.test(RR.permText) && RR.permTitles.some(x => /Mechanical permits/.test(x) && /\(grade B\)/.test(x)) && RR.permTitles.some(x => /names heating/.test(x) && /\(grade C\)/.test(x)) && !RR.permTitles.some(x => /permit|gas test/i.test(x) && /grade A/.test(x)) && RR.ctyTitle.some(x => /permits/i.test(x) && /\(grade B\)/.test(x)) && !RR.ctyTitle.some(x => /permits/i.test(x) && /grade A/.test(x)), 'grade B stands beside permit counts and grade C beside heating counts and gas tests; no permit figure is called grade A');
  t.ok(RR.g.tests === '2,789' && RR.permText.includes(`${RR.g.tests} gas tests in the 12 full months through October 2026`) && RR.g.recent === '417' && RR.g.was === '635' && RR.permText.includes('417 in the last 8 weeks') && RR.permText.includes('the 635 of the same weeks a year earlier') && /34% under/.test(RR.permText), 'gas tests: the 12 months, and the last 8 weeks against the same weeks a year earlier', (RR.permText.match(/[\d,]+ gas tests in the 12 full months[^\n]*/) || [''])[0]);
  t.eq(RR.gasM, RR.g.months, 'the twelve months of gas tests are drawn month by month');
  t.ok(RR.gasM.length === 12 && /Gas tests by month: November 2025 393, December 2025 440/.test(RR.gasAria), 'and the strip reads out to a screen reader', RR.gasAria.slice(0, 120));
  t.ok(RR.gasT.length === 10 && RR.gasT.slice(0, 4).map(r => r[0]).join() === '75217,75216,75228,75227' && RR.gasT.every((r, i) => r[0] === RR.g.top[i][0] && r[2] === RR.g.top[i][1] && r[7].replace(/\s+/g, ' ') === RR.planOf[r[0]].replace(/\s+/g, ' ')) && /The ZIP codes with the most are 75217, 75216, 75228 and 75227/.test(RR.permText), 'the ZIP codes with the most gas tests are 75217, 75216, 75228 and 75227, next to the shop, each with what the plan spends there', RR.gasT.map(r => [r[0], r[2], r[7]]));
  const pIx = RR.ctyHead.findIndex(h => /Mechanical permits/i.test(h)), lIx = RR.ctyHead.findIndex(h => /Licensed contractors per 10,000 households/i.test(h)), cRow = n => RR.cty.find(r => r[0] === n);
  t.ok(pIx > 0 && cRow('Dallas')[pIx] === N0(RR.permCounty.Dallas) && cRow('Tarrant')[pIx] === N0(RR.permCounty.Tarrant) && cRow('Hood')[pIx] === 'none published' && /which is not zero work/.test(RR.ctyN), 'the counties table sums the permits of each county\'s ZIP codes and says "none published" where no city publishes', { dallas: cRow('Dallas')[pIx], tarrant: cRow('Tarrant')[pIx] });
  /* (d) licenses */
  t.ok(lIx > 0 && ['Dallas', 'Tarrant', 'Collin', 'Wise'].every(n => RR.lic[n] != null && +cRow(n)[lIx] === RR.lic[n]), 'licensed contractors per 10,000 households match the license collector\'s own read, county by county', ['Dallas', 'Tarrant', 'Collin', 'Wise'].map(n => [n, cRow(n)[lIx], RR.lic[n]]));
  /* (c) the season record */
  t.ok(/Reserve stance\. The season is running behind: 29 heating degree days against a normal 157 to this date \(18%\)\. If it is still 25% or more under normal at midmonth, plan to carry what is left of the freeze reserve into next month instead of releasing it/.test(RR.seas) && /the desk keeps no ledger and moves no budget on it/.test(RR.seas), 'a season running far behind normal (18% on the recorded day) gives the reserve stance: carry it over, do not release it', (RR.seas.match(/Reserve stance\.[^\n]*/) || [''])[0]);
  t.ok(RR.headline.length > 40 && RR.seas.includes(RR.headline) && /29 against a normal 157 \(18%\)/.test(RR.seas) && /First freeze at DFW Airport/.test(RR.seas) && /not yet; the median first freeze is November 24, 2026/.test(RR.seas), 'the season so far is the season record\'s own headline and figures', RR.seas.slice(0, 300));
  t.ok(RR.ffT.length === 12 && RR.ffT.map(r => r[0]).join() === RR.medians.map(m => m[0]).join() && RR.ffT[0][0] === 'Wise' && RR.ffT[0][2] === 'November 2' && RR.ffT[11][0] === 'Dallas' && RR.ffT[11][2] === 'November 25' && RR.ffT.every(r => r[1] === 'not yet' && r[7] === 'on for the first freezing night') && /Outer counties freeze first: the median first freeze runs from November 2 in Wise County to November 25 in Dallas County, and DFW Airport's is November 24/.test(RR.seas) && /none of the 12 counties has had a freeze yet/.test(RR.seas) && /None of the 12 counties have a freeze on record/.test(RR.seas),
    'first freeze by county: twelve rows, the earliest median first (Wise, three weeks before Dallas), none frozen yet on the recorded day, so the bonus is still on everywhere', RR.ffT.map(r => [r[0], r[1], r[2], r[7]]));
  /* (d) rules and recalls */
  const ruleRow = RR.sig.find(x => /^RULES/i.test(x)) || '', recallRow = RR.sig.find(x => /^RECALLS/i.test(x)) || '', gasRow = RR.sig.find(x => /^GAS TESTS/i.test(x)) || '', cp = RR.up.find(u => u[0] === 'compliance');
  t.ok(cp && cp[1] === '2028-12-18' && cp[2] === false && ruleRow.includes('has its compliance date on December 18, 2028') && /nothing to recheck/.test(ruleRow) && RR.warn === 0 && RR.asis.some(a => a[0] === 'CITE' && a[1] === cp[3]) && RR.links.some(h => /^https:\/\/www\.federalregister\.gov\/documents\/2023\/12\/18\/2023-25514\//.test(h)), 'federal rules: the furnace standard\'s compliance date, December 18, 2028, under its published title, with nothing to recheck on the recorded day', ruleRow);
  t.ok(RR.recall && recallRow.includes(RR.recall) && RR.asis.some(a => a[0] === 'CITE' && a[1] === RR.recall) && /No recall of central heating equipment in the last 12 months/.test(recallRow), 'recalls: the newest title is shown as published, product code and hyphen kept (DR-HSH015)', recallRow.slice(0, 300));
  t.ok(/417 Dallas homes had a gas line tested in the last 8 weeks/.test(gasRow) && /75217, 75216, 75228 and 75227/.test(gasRow) && /In the ad:/.test(gasRow) && /never write as if a home's own permit were known/.test(gasRow), 'gas tests have their line among the signals, with what to say in the ad', gasRow);
  t.ok(RR.asis.length >= 3 && RR.asis.every(a => (a[0] === 'Q' || a[0] === 'CITE') && a[1].trim().length > 10 && a[2]), 'only quotations and published titles are exempt from the house style, each inside a q or cite element in the outlook or the signals', RR.asis.map(a => [a[0], a[1].slice(0, 40)]));
  await page.evaluate(() => MODI.heat.receive({ zip: '75217' })); await wait(300);
  const zc = await page.evaluate(() => document.getElementById('h17Zip').innerText.replace(/\s+/g, ' '));
  t.ok(/Mechanical permits here, last 12 full months · Dallas B/.test(zc) && /Of them, permits that name heating C 64/.test(zc) && /Gas tests here, 12 months C 228/.test(zc) && /Last 8 weeks · same weeks a year earlier C 30 · 45/.test(zc), 'the card of 75217 shows its own permits (B), the permits that name heating (C) and its gas tests (C)', (zc.match(/Mechanical permits here.{0,200}/) || [''])[0]);
  await agree('on the recorded day'); await clean('on the recorded day');
  for (const k of ['permits', 'gas', 'freeze', 'counties']) { const f = checkFile(`on the recorded day, table ${k}`, await dl(() => press(`#mod-heat [data-csv="${k}"]`)), { rows: true }); t.ok(/^# DFW Thermal Debt Atlas, module 17 Heat Desk\./.test(f.text) && !MARK.test(f.text) && /grade [A-D]/.test(f.text.split('\n')[0]), `table ${k}: a note with the grades, no dash`, f.text.split('\n')[0].slice(0, 160));
    if (k === 'gas') t.ok(f.rows.filter(r => r[0] === 'month').length === 12 && f.rows.filter(r => /^zip/.test(r[0])).slice(0, 4).map(r => r[1]).join() === '75217,75216,75228,75227', 'the gas test file carries the twelve months and the ZIP codes in order');
    if (k === 'permits') t.ok(f.rows.find(r => r[0] === 'Fort Worth')[f.rows[0].indexOf('permits_naming_heating_12_months')] === 'unknown', 'the permit file writes unknown, not 0, for Fort Worth\'s heating count'); }
  /* nothing in these records moves money: the month plan is the plan of the forecast alone */
  await dayOf(RD.ids.filter(id => id !== 'nws_cold'));
  const bare2 = await snap();
  t.ok(bare2.money === all.money && bare2.recs.join() === 'nws_cold', 'outlooks, permits, licenses, rules, recalls and the season record move no money: the month plan is to the cent the plan of the forecast alone');
  /* each record taken out: its block hides or says what is missing, nothing throws, the money stays */
  const absent = [
    [['cpc_outlook', 'nbm_extended', 'ercot_grid'], 'the outlook family', r => r.out === 0 && !/Two weeks ahead/.test(r.week) && /the two week cold outlook/.test(r.miss)],
    [['cpc_outlook'], 'the outlook maps alone', r => r.out > 0 && /stage, do not spend/i.test(r.outText) && !/6 TO 10 DAYS/i.test(r.outText) && !/the two week cold outlook/.test(r.miss)],
    [['permits_dallas'], 'the Dallas permits', r => !/Gas tests in/i.test(r.perm) && r.cities.join() === 'Fort Worth' && !r.sig.includes('GAS TESTS') && /mechanical permits of Dallas/.test(r.miss) && r.ctyRows.find(x => x[0] === 'Dallas').includes('none published')],
    [['permits_dallas', 'permits_fortworth'], 'both permit records', r => r.permLen === 0 && !r.cols.some(h => /permits/i.test(h)) && /mechanical permits of Dallas and Fort Worth/.test(r.miss)],
    [['tdlr_licenses'], 'the license record', r => !r.cols.some(h => /Licensed/i.test(h)) && /contractor licenses by county/.test(r.miss)],
    [['fedreg_rules'], 'the federal rules', r => !r.sig.includes('RULES') && /federal rules/.test(r.miss) && r.sig.includes('RECALLS')],
    [['cpsc_recalls'], 'the recalls', r => !r.sig.includes('RECALLS') && /heating equipment recalls/.test(r.miss) && r.sig.includes('RULES')],
    [['acis_season'], 'the season record', r => /not stored in this browser yet/.test(r.seas) && /calendar/.test(r.seas) && r.ff && r.ff.src === 'calendar' && !/First freeze by county/i.test(r.seas) && /the heating season to date/.test(r.miss)],
  ];
  for (const [drop, label, hidden] of absent) { before = ctx.errors.length; await dayOf(drop); const r = await snap();
    t.ok(!r.failed && ctx.errors.length === before && drop.every(id => !r.recs.includes(id)) && r.money === all.money && hidden(r), `without ${label}: its block hides or says what is missing, nothing throws and the plan's money does not move`, { errors: ctx.errors.slice(before, before + 3), miss: r.miss.slice(0, 260), sig: r.sig, cities: r.cities, out: r.outText.slice(0, 160) }); }
  await clean('without the season record');
  /* first freeze by place: two outer counties have frozen, DFW Airport has not */
  await dayOf(null, { acis_season: frozenRim(RD.recs.acis_season) });
  const rim = await page.evaluate(() => ({ ff: HEATX.forecast(new Date()).firstFreeze, seas: document.getElementById('h17SeasLive').innerText, rows: [...document.querySelectorAll('#h17SeasLive table tbody tr')].map(r => [r.cells[0].innerText, r.cells[1].innerText, r.cells[7].innerText, r.className]), rule: (document.getElementById('h17Rules').innerText.match(/First freeze of the season[^\n]*\n[^\n]*/) || [''])[0] }));
  t.ok(rim.ff.src === 'season' && rim.ff.done === false && rim.ff.byCounty.Wise === true && rim.ff.byCounty.Hunt === true && rim.ff.byCounty.Dallas === false && Object.keys(rim.ff.byCounty).length === 12, 'with a freeze on record in Wise and Hunt and none at DFW Airport, the engine holds those two counties as frozen and the other ten as not', rim.ff);
  t.ok(rim.rows.filter(r => r[1] === 'November 8, 2026' && r[2] === 'off: already frozen' && /hd-fired/.test(r[3])).map(r => r[0]).sort().join() === 'Hunt,Wise' && rim.rows.filter(r => r[2] === 'on for the first freezing night').length === 10 && /asks each ZIP's own county: (Wise and Hunt|Hunt and Wise) have had their first freeze, so a freezing night there no longer gets the bonus; in the other 10 counties the first freezing night still does/.test(rim.seas) && /2 of the 12 counties have a freeze on record this season, the first on November 8, 2026 in Wise County/.test(rim.seas) && /ZIP's own county/.test(rim.rule),
    'the season card and the cold rules say the first freeze bonus asks each ZIP\'s own county: off in Wise and Hunt, still on in the other ten', { rows: rim.rows.filter(r => r[2] !== 'on for the first freezing night'), rule: rim.rule });
  await clean('with a freeze on the rim');
  /* a newer final rule on furnaces: the compliance date gets its recheck flag (the read looks at publication dates, not at the clock) */
  const newer = JSON.parse(JSON.stringify(RD.recs.fedreg_rules)); newer.data.docs.unshift({ id: '2026-99001', d: '2026-11-17', type: 'Rule', agency: 'DOE', title: 'Energy Conservation Program: Energy Conservation Standards for Consumer Furnaces; Extension of Compliance Date (synthetic)', url: 'https://www.federalregister.gov/documents/2026/11/17/2026-99001/synthetic', topic: 'furnace', effective: '2027-01-16', comments: null, action: 'Final rule.' });
  await dayOf(null, { fedreg_rules: newer });
  const rc = await page.evaluate(() => ({ up: TDA_LIVE.fedreg.upcoming(LIVE.data('fedreg_rules'), new Date()).filter(u => u.what === 'compliance').map(u => u.recheck), row: ([...document.querySelectorAll('#h17Sig .hd-sig')].find(r => /^RULES/i.test(r.innerText)) || { innerText: '' }).innerText, chip: [...document.querySelectorAll('#h17Sig .hd-chip.warn')].map(c => c.textContent) }));
  t.ok(rc.up.join() === 'true' && rc.chip.join() === 'recheck' && /compliance date on December 18, 2028\s*recheck/i.test(rc.row) && /it may have moved, so read the newer rule before quoting the date/.test(rc.row), 'once a newer final rule on furnaces is published, recheck stands beside the furnace rule\'s compliance date', rc.row.slice(0, 420));
  /* phone width, both themes, with every record on the page */
  for (const theme of ['light', 'dark']) { await page.setViewportSize({ width: 390, height: 844 }); before = ctx.errors.length; await dayOf(null, null, { 'tda.theme': JSON.stringify(theme) });
    const ph = await page.evaluate(() => { document.querySelectorAll('#mod-heat details').forEach(d => { d.open = true; }); const box = e => e.getBoundingClientRect(); return { overflow: document.documentElement.scrollWidth - innerWidth, wide: [...document.querySelectorAll('#mod-heat > .wrap > *, #h17Perm > *, #h17Outlook > *, #h17SeasLive > *, #h17Sig > *, #h17Why > *, #mod-heat .hd-gasm')].filter(e => box(e).right > innerWidth + 1 || box(e).left < -1).map(e => e.id || e.className).slice(0, 6), perm: document.querySelectorAll('#h17Perm table').length, gas: box(document.querySelector('#h17Perm .hd-gasm')).width, dark: isDark() }; });
    t.ok(ctx.errors.length === before && ph.overflow <= 0 && !ph.wide.length && ph.perm === 2 && ph.gas > 200 && ph.dark === (theme === 'dark'), `390 wide, ${theme}, every record present: no sideways page scroll, the permit tables scroll inside their own boxes`, ph); }
  await page.setViewportSize({ width: 1440, height: 900 });
  t.ok(!ctx.errors.length, 'no page error or console error in the whole run', ctx.errors.slice(0, 6));
}
