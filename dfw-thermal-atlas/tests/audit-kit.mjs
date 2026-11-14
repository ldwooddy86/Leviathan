// Shared by the audit sweeps (tests/audit-*.test.mjs): a fake clock, a stand in for the public services that answers
// from the recorded answers (shaped to the date asked for where a collector checks dates), and one run of one collector.
// Not a test file: tests/run.mjs picks up *.test.mjs only.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { context, liveFiles, ROOT, APP } from './helpers/load.mjs';

const scripts = {}, LIVE = liveFiles().filter(f => f !== 'live/page.js');

export const FX = join(ROOT, 'tests', 'fixtures');
const cache = {};
export const raw = n => cache[n] || (cache[n] = readFileSync(join(FX, n), 'utf8'));
export const fx = n => JSON.parse(raw(n));
export const DAY = 864e5;
export const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const parts = ms => FMT.formatToParts(new Date(ms)).reduce((o, x) => (o[x.type] = x.value, o), {});
export const localDay = ms => { const p = parts(ms); return `${p.year}-${p.month}-${p.day}`; };
/* '2027-03-14 05:00' on the wall clock in Dallas → epoch milliseconds (daylight saving included) */
export function dallas(s) {
  const want = s.length === 10 ? s + ' 12:00' : s, guess = Date.parse(want.replace(' ', 'T') + ':00Z');
  for (const off of [5, 6]) { const t = guess + off * 36e5, p = parts(t); if (`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` === want) return t; }
  throw new Error('no such wall clock time in Dallas: ' + s);
}

/* The live layer in a fresh context on a simulated clock: Date starts at `start` and moves only when the code under test
   waits. Timers wait in a queue; whenever nothing else is left to do the earliest one fires and the clock jumps to its time,
   so pauses, retries and timeouts happen in their real order while a run that would take minutes takes milliseconds, and
   the time it believes it took can be read back (W.ms()). */
export function world(start, files) {
  let now = +start, seq = 0, kicked = false;
  const RealDate = Date, q = [];
  class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } }
  const kick = () => { if (!kicked && q.length) { kicked = true; setImmediate(pump); } };
  const pump = () => { kicked = false; if (!q.length) return; q.sort((a, b) => a.due - b.due || a.id - b.id); const t = q.shift(); now = Math.max(now, t.due); try { t.fn(); } finally { kick(); } };
  const st = (fn, ms) => { const t = { id: ++seq, due: now + Math.max(0, +ms || 0), fn }; q.push(t); kick(); return t; };
  const ct = t => { const i = q.indexOf(t); if (i >= 0) q.splice(i, 1); };
  const ctx = context({ Date: FakeDate, setTimeout: st, clearTimeout: ct });
  for (const f of files || LIVE) (scripts[f] || (scripts[f] = new vm.Script(readFileSync(join(APP, f), 'utf8'), { filename: f }))).runInContext(ctx);       /* compiled once, run in every world */
  return { ctx, L: ctx.TDA_LIVE, start: +start, now: () => now, ms: () => now - +start, set: t => { now = +t; }, timers: q };
}

/* A fetch double over [[test(url, init) → bool | RegExp, answer(url, init) → string | object | {status, body} | Error | HANG]].
   Every call is recorded with the simulated time it was made at. HANG never answers: the request ends when the caller aborts it. */
export const HANG = Symbol('hang');
export function fetcher(W, routes) {
  const calls = [];
  const f = (url, init) => new Promise((res, rej) => {
    url = String(url); calls.push({ url, init, at: W.now() });
    const r = routes.find(([m]) => (typeof m === 'function' ? m(url, init) : m.test(url)));
    const first = r ? (typeof r[1] === 'function' ? r[1](url, init, calls) : r[1]) : { status: 404, body: 'no route' };
    /* a request the caller gives up on ends as it does in a browser, whether the answer was never coming (HANG) or only slow (a promise) */
    const sig = init && init.signal; if (sig) sig.addEventListener('abort', () => { const e = new Error('The operation was aborted'); e.name = 'AbortError'; rej(e); });
    const done = a => {
      if (a === HANG) return;
      if (a instanceof Error) return rej(a);
      if (typeof a === 'string') a = { status: 200, body: a }; else if (!a || typeof a.status !== 'number') a = { status: 200, body: JSON.stringify(a) };
      const body = typeof a.body === 'string' ? a.body : JSON.stringify(a.body);
      res({ status: a.status, ok: a.status >= 200 && a.status < 300, url, text: async () => body, headers: { get: () => null } });
    };
    if (first && typeof first.then === 'function') first.then(done, rej); else done(first);
  });
  f.calls = calls;
  return f;
}
/* one run of one collector the way the runner calls it (real pauses and retries, on the fake clock); never throws */
export async function runOnce(W, id, fetch, prev, more) {
  const L = W.L, s = L.BY_ID[id], http = L.makeHttp({ fetch, chains: {} }), t0 = W.now();
  try { const data = await s.run(Object.assign({ http, now: new W.ctx.Date(t0), prev: prev == null ? null : JSON.parse(JSON.stringify(prev)), key: null, settings: {}, env: 'node', geo: L.geo }, more || {})); return { data: JSON.parse(JSON.stringify(data)), calls: fetch.calls, ms: W.now() - t0, http }; }
  catch (error) { return { error, calls: fetch.calls, ms: W.now() - t0, http }; }
}

/* ---------- the forecast grid of api.weather.gov, written for a table of lows ---------- */
const f2c = f => (f - 32) * 5 / 9;
/* lowOf(d) and highOf(d): °F for the night that begins on the evening of d and for the day d; nights from the one in progress
   at `now` (when it is before 8 am in Dallas) through six nights ahead, as the Fort Worth office's grid carries them */
export function gridFor(now, lowOf, highOf) {
  const today = localDay(now), nights = [], days = [];
  for (let i = -1; i <= 6; i++) { const d = addDays(today, i); nights.push({ validTime: addDays(d, 1) + 'T01:00:00+00:00/PT13H', value: f2c(lowOf(d)) }); }
  for (let i = 0; i <= 7; i++) { const d = addDays(today, i); days.push({ validTime: d + 'T13:00:00+00:00/PT12H', value: f2c(highOf ? highOf(d) : lowOf(d) + 20) }); }
  return { properties: { updateTime: new Date(now - 36e5).toISOString().replace('.000Z', '+00:00'), minTemperature: { values: nights }, maxTemperature: { values: days }, apparentTemperature: { values: [] }, windChill: { values: [] }, snowfallAmount: { values: [] }, iceAccumulation: { values: [] }, weather: { values: [] } } };
}

/* ---------- the public services, answering from the recorded answers ---------- */
export const ALL = ['nws_cold', 'cpsc_recalls', 'acis_season', 'iem_cold', 'cpc_outlook', 'nbm_extended', 'ercot_grid', 'permits_dallas', 'permits_fortworth', 'tdlr_licenses', 'census_acs', 'fedreg_rules'];
export const REC = '2026-11-13';                                     /* the day the answers were recorded */
export const dayDiff = (a, b) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / DAY);
export const shiftDates = (text, n) => text.replace(/(?<!\d)20\d\d-\d\d-\d\d(?!\d)/g, m => addDays(m, n));
export const addMonths = (ym, k) => { const t = (+ym.slice(0, 4)) * 12 + (+ym.slice(5, 7)) - 1 + k; return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0'); };
/* a normal low for the calendar day, °F: enough for a forecast that looks like the season */
const LOWS = [34, 38, 46, 54, 63, 71, 75, 75, 68, 56, 45, 36];
export const seasonalLow = d => LOWS[+d.slice(5, 7) - 1];
export const bodyOf = init => { try { return JSON.parse((init && init.body) || '{}'); } catch (e) { return {}; } };
export const formOf = init => Object.fromEntries(new URLSearchParams(String((init && init.body) || '')));
const NOT_FOUND = { status: 404, body: 'Not Found' };

/* [kind, test(url, init), answer(url, init, W)] in the order they are tried */
const ROUTES = [
  ['nws.alerts', u => /api\.weather\.gov\/alerts\/active/.test(u), () => raw('nws/alerts-active-tx-2026-11-13.json')],
  ['nws.grid', u => /api\.weather\.gov\/gridpoints\//.test(u), (u, i, W) => gridFor(W.start, seasonalLow)],
  ['nws.points', u => /api\.weather\.gov\/points\//.test(u), () => raw('nws/points-denton.json')],
  ['cpc.mrd', u => /products\/types\/PMD\/locations\/MRD/.test(u), () => raw('outlook/pmd-mrd-2026-11-13.json')],
  ['cpc.thr', u => /products\/types\/PMD\/locations\/THR/.test(u), () => raw('outlook/pmd-thr-2026-11-13.json')],
  ['cpc.ens', u => /products\/types\/PMD\/locations\/ENS/.test(u), () => raw('outlook/pmd-ens-2026-11-13.json')],
  ...[['610', 'cpc_6_10_day_outlk'], ['814', 'cpc_8_14_day_outlk']].flatMap(([k, svc]) => [
    ['cpc.multi' + k, u => u.includes(svc + '/MapServer/0/') && /Multipoint/.test(u), () => raw(`outlook/cpc-${k}-temp-multipoint-2026-11-13.json`)],
    ['cpc.point' + k, u => u.includes(svc + '/MapServer/0/'), () => raw(`outlook/cpc-${k}-temp-point-2026-11-13.json`)],
    ['cpc.pcp' + k, u => u.includes(svc + '/MapServer/1/'), () => raw(`outlook/cpc-${k}-precip-point-2026-11-13.json`)]]),
  ...[1, 3, 4, 6].flatMap(id => [
    ['cpc.hazMulti' + id, u => u.includes(`cpc_weather_hazards/MapServer/${id}/`) && /Multipoint/.test(u), () => (id === 4 ? raw('outlook/hazards-L4-multipoint-12-counties-2026-11-14.json') : { features: [] })],
    ['cpc.hazAll' + id, u => u.includes(`cpc_weather_hazards/MapServer/${id}/`), () => raw(`outlook/hazards-L${id}-national-2026-11-13.json`)]]),
  ...[1, 2].map(id => ['cpc.wssi' + id, u => u.includes(`wpc_wssi_p/MapServer/${id}/`), () => raw(`outlook/wssi-p-L${id}-multipoint-mountain-points-2026-11-13.json`)]),
  ['cpc.month', u => u.includes('cpc_mthly_temp_outlk'), () => raw('outlook/cpc-month-temp-point-2026-11-13.json')],
  ['cpc.season', u => u.includes('cpc_sea_temp_outlk'), () => raw('outlook/cpc-season-temp-identify-2026-11-13.json')],
  ...[['furnace', 'furnace'], ['heat pump', 'heat-pump'], ['boiler', null], ['heater', 'space-heater'], ['carbon monoxide alarm', null]].map(([term, file]) =>
    ['cpsc.' + term, u => u.includes('saferproducts.gov') && u.includes('RecallTitle=' + encodeURIComponent(term) + '&'), () => (file ? raw(`cpsc/recall-title-${file}-2026-11-13.json`) : '[]')]),
  /* ACIS: every answer is shaped to the dates asked for */
  ['acis.W1', (u, i) => /MultiStnData/.test(u) && !!bodyOf(i).sids, (u, i) => { const q = bodyOf(i), n = dayDiff(q.edate, q.sdate) + 1, j = fx('acis/w1-airports-daily-2026-11-13.json'); return { data: j.data.map(r => ({ meta: r.meta, data: Array.from({ length: n }, (_, k) => r.data[Math.min(k, r.data.length - 1)]) })) }; }],
  ['acis.W2', (u, i) => /MultiStnData/.test(u) && !!bodyOf(i).date, () => raw('acis/w2-station-reductions-2026-11-13.json')],
  ['acis.W3', u => /MultiStnData/.test(u), () => raw('acis/w3-same-span-1991-2020-2026-11-13.json')],
  ['acis.G1', (u, i) => /GridData/.test(u) && +String(bodyOf(i).sdate).slice(0, 4) > 2021, (u, i) => { const q = bodyOf(i), j = fx('acis/g1-prism-season-to-date-2026-11-13.json'), n = dayDiff(q.edate, q.sdate) + 1; return { data: Array.from({ length: n }, (_, k) => [addDays(q.sdate, k)].concat((k < n - 1 ? j.data[1] : j.data[2]).slice(1))) }; }],
  ['acis.G2', u => /GridData/.test(u), () => raw('acis/g2-prism-30-fall-mean-2026-11-13.json')],
  ['nbm.mos', u => /mesonet\.agron\.iastate\.edu\/api\/1\/mos\.json/.test(u), (u, i, W) => shiftDates(raw('outlook/iem-mos-nbe-six-airports-2026-11-13.json'), dayDiff(localDay(W.start), REC) - 1)],
  /* the cold products: the two seasons recorded as they are; any other winter that has ended is the 2025 one moved to its years (every
     winter has its products); a season still running at the clock and not recorded has none yet */
  ['iem.season', u => /watchwarn\.py/.test(u), (u, i, W) => { const s = +/sts=(\d{4})-07-01/.exec(u)[1], t = localDay(W.start), S = +t.slice(0, 4) - (t.slice(5, 7) < '07' ? 1 : 0), r25 = raw('iem/watchwarn-fwd-season-2025-2026-11-13.csv'); if (s === 2025) return r25; if (s === 2026 && S === 2026) return raw('iem/watchwarn-fwd-season-2026-2026-11-13.csv'); if (s >= S) return r25.split('\n')[0] + '\n'; return r25.split('\n').map((l, k) => (k ? l.replace(/(?<![\d-])20(25|26)(?=-\d\d-\d\d |$)/g, y => String(+y + s - 2025)) : l)).join('\n'); }],
  ['ercot.cond', u => /daily-prc\.json/.test(u), (u, i, W) => { const j = fx('outlook/ercot-daily-prc-2026-11-13.json'); j.current_condition.datetime = Math.floor(W.start / 1000) - 600; j.lastUpdated = new Date(W.start - 6 * 36e5 - 3e5).toISOString().slice(0, 19).replace('T', ' ') + '-0600'; return j; }],
  ['ercot.days', u => /supply-demand\.json/.test(u), (u, i, W) => shiftDates(raw('outlook/ercot-supply-demand-2026-11-13.json'), dayDiff(localDay(W.start), REC))],
  ['ercot.zone', u => /actual_loads_of_weather_zones/.test(u), u => { const m = /(\d{4})(\d\d)(\d\d)_actual/.exec(u); return raw('outlook/ercot-zones-20261112-2026-11-13.html').split('11/12/2026').join(`${m[2]}/${m[3]}/${m[1]}`); }],
  /* Dallas: the newest permit is yesterday's; the months run to this one, a later year repeating the last recorded one */
  ['pd.newest', u => /dallasopendata/.test(u) && /max\(/.test(decodeURIComponent(u)), (u, i, W) => { const t = addDays(localDay(W.start), -1); return [{ kmax: t.slice(2, 4) + t.slice(5, 7) + t.slice(8, 10), n: '18742' }]; }],
  ['pd.months', u => /dallasopendata/.test(u) && /\$group=ym/.test(decodeURIComponent(u)), (u, i, W) => { const rows = fx('permits_dallas/months-2026-11-13.json'), by = {}, cur = addDays(localDay(W.start), -1).slice(0, 7), out = []; rows.forEach(r => { by[r.ym] = r; }); for (let m = '2024-05'; m <= cur; m = addMonths(m, 1)) { let src = m; while (!by[src] || src === '2026-11') src = addMonths(src, -12); out.push(Object.assign({}, m === cur ? by['2026-11'] : by[src], { ym: m })); } return out; }],
  ['pd.zips', u => /dallasopendata/.test(u), () => raw('permits_dallas/zips-2026-11-13.json')],
  /* Fort Worth: months and dates moved with the clock */
  ['fw.months', (u, i) => /services5\.arcgis\.com/.test(u) && /EXTRACT/.test(formOf(i).groupByFieldsForStatistics || ''), (u, i, W) => { const j = fx('permits/fortworth-months-2026-11-13.json'), t = localDay(W.start), k = (+t.slice(0, 4) - 2026) * 12 + (+t.slice(5, 7) - 11), dd = dayDiff(t, REC); j.features.forEach(f => { const a = f.attributes, m = addMonths(a.EXPR_1 + '-' + String(a.EXPR_2).padStart(2, '0'), k); a.EXPR_1 = +m.slice(0, 4); a.EXPR_2 = +m.slice(5, 7); a.mx += dd * DAY; }); j.features[j.features.length - 1].attributes.mx = Date.parse(addDays(t, -1) + 'T00:00:00Z'); return j; }],
  ['fw.multi', (u, i) => /services5\.arcgis\.com/.test(u) && !!formOf(i).having, (u, i, W) => { const j = fx('permits/fortworth-multi-2026-11-13.json'), dd = dayDiff(localDay(W.start), REC); j.features.forEach(f => { f.attributes.d += dd * DAY; }); return j; }],
  ['fw.zips', u => /services5\.arcgis\.com/.test(u), () => raw('permits/fortworth-zips-2026-11-13.json')],
  /* the license file: dated two days before the clock, its dates moved with it */
  ['tdlr.meta', u => /data\.texas\.gov\/api\/views\/metadata/.test(u), (u, i, W) => ({ dataUpdatedAt: new Date(W.start - 2 * DAY).toISOString().slice(0, 19) + '+0000' })],
  ['tdlr.counts', u => /data\.texas\.gov\/resource/.test(u) && /license_subtype%2Ccount/.test(u), () => raw('tdlr/counts-by-county-november-file-2026-11-13.json')],
  ['tdlr.texas', u => /data\.texas\.gov\/resource/.test(u) && /as%20n0/.test(u), () => raw('tdlr/texas-totals-november-file-2026-11-13.json')],
  ['tdlr.entrants', u => /data\.texas\.gov\/resource/.test(u) && /as%20lo/.test(u), (u, i, W) => { const dd = dayDiff(localDay(W.start - 2 * DAY), REC), j = fx('tdlr/entrants-by-county-november-file-2026-11-13.json'); j.forEach(r => { if (/^\d{8}$/.test(r.lo || '')) r.lo = addDays(`${r.lo.slice(0, 4)}-${r.lo.slice(4, 6)}-${r.lo.slice(6)}`, dd).replace(/-/g, ''); }); return j; }],
  ['tdlr.newest', u => /data\.texas\.gov\/resource/.test(u), (u, i, W) => { const dd = dayDiff(localDay(W.start - 2 * DAY), REC); return raw('tdlr/newest-november-file-2026-11-13.json').replace(/\b(\d\d)\/(\d\d)\/(\d{4})\b/g, (m, a, b, y) => { const d = addDays(`${y}-${a}-${b}`, dd); return `${d.slice(5, 7)}/${d.slice(8)}/${d.slice(0, 4)}`; }); }],
  /* the Census: the 2024 file is there, nothing newer */
  ['census.listing', u => /api\.census\.gov\/data\/\d{4}\/acs\/acs5\.json/.test(u), u => (/\/2024\//.test(u) ? raw('census/acs5-listing-2024-2026-11-13.json') : { status: 404, body: raw('census/acs5-listing-2025-not-found-2026-11-13.html') })],
  ['census.file', u => /www2\.census\.gov/.test(u), u => (/\/2024\//.test(u) ? { status: 200, body: '' } : NOT_FOUND)],
  ['census.var', u => /api\.census\.gov\/data\/\d{4}\/acs\/acs5\/variables\/(B\d+)_001E/.test(u), u => raw(`census/variable-${/variables\/(B\d+_001E)/.exec(u)[1]}-2024-2026-11-13.json`)],
  ['fedreg.standing', u => /federalregister\.gov\/api\/v1\/documents\/\d{4}-/.test(u), () => raw('fedreg/documents-standing-2026-11-13.json')],
  ['fedreg.equipment', u => /federalregister/.test(u) && /energy-department/.test(u), () => raw('fedreg/search-equipment-2026-11-13.json')],
  ['fedreg.refrigerant', u => /federalregister/.test(u) && /environmental-protection-agency/.test(u), () => raw('fedreg/search-refrigerant-2026-11-13.json')],
  ['fedreg.advertising', u => /federalregister/.test(u) && /federal-trade-commission/.test(u), () => raw('fedreg/search-advertising-2026-11-13.json')],
  ['fedreg.credit', u => /federalregister/.test(u), () => raw('fedreg/search-credit-2026-11-13.json')],
];
export const KINDS = ROUTES.map(r => r[0]);
/* A fetch for one world. opt.over: { kind: (good, url, init, kind) → answer } replaces the answer of one kind of request ('*': of
   every kind); good() is the recorded answer. Every call is recorded as { kind, url, init, at }. */
export function service(W, opt) {
  const over = (opt && opt.over) || {};
  return fetcher(W, [[() => true, (url, init, calls) => {
    const r = ROUTES.find(x => x[1](url, init)), kind = r ? r[0] : 'unknown'; calls[calls.length - 1].kind = kind;
    const good = () => (r ? r[2](url, init, W) : NOT_FOUND), o = over[kind] || over['*'];
    return o ? o(good, url, init, kind) : good();
  }]]);
}
