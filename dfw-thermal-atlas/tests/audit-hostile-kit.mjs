// The hostile answers of the audit (tests/audit-hostile.test.mjs): what a public service can send instead of the answer it
// documents. Each variant takes the recorded answer as text and the kind of request, and returns the hostile answer (text,
// { status, body }, an Error, or HANG), or null where the variant has no meaning for that kind of answer.
// After the sweep the first auditor of Build 5 ran by hand (2,109 runs); kept here so it runs with the suite.
import { HANG, ALL, world, service, runOnce, dallas } from './audit-kit.mjs';

const HTML = '<!DOCTYPE html><html><head><title>Site maintenance</title></head><body><h1>We will be back soon</h1></body></html>';
const isCsv = k => k === 'iem.season', isHtml = k => k === 'ercot.zone', isText = k => isCsv(k) || isHtml(k) || k === 'census.file';
const deep = (x, fn, d) => { d = d || 0; x = fn(x, d); if (Array.isArray(x)) return x.map(v => deep(v, fn, d + 1)); if (x && typeof x === 'object') { const o = {}; for (const k of Object.keys(x)) o[k] = deep(x[k], fn, d + 1); return o; } return x; };
const json = (b, f) => { let j; try { j = JSON.parse(b); } catch (e) { return null; } return JSON.stringify(f(j)); };
export const textOf = a => (typeof a === 'string' ? a : a && typeof a.status === 'number' ? (typeof a.body === 'string' ? a.body : JSON.stringify(a.body)) : JSON.stringify(a));
export const VARIANTS = {
  /* HTTP 200 with an error document */
  err200: (b, k) => (isCsv(k) ? 'ERROR: could not connect to the database' : isHtml(k) ? '<html><body>Error 500</body></html>' : '{"error":{"code":500,"message":"Service is unavailable","details":[]}}'),
  /* HTML where the answer is expected */
  html: () => HTML,
  truncated: b => b.slice(0, Math.floor(b.length * 0.6)),
  emptyBody: () => '',
  emptyList: (b, k) => (isCsv(k) ? b.split('\n')[0] + '\n' : isHtml(k) ? b.replace(/<tr>\s*<td class="labelClassCenter">[\s\S]*?<\/tr>/g, '') : json(b, j => deep(j, (x, d) => (Array.isArray(x) && d <= 3 ? [] : x)))),
  renamedAll: (b, k) => (isCsv(k) ? b.split('\n').map((l, i) => (i ? l : l.split(',').map(h => h + '_x').join(','))).join('\n') : isHtml(k) ? b.replace(/NORTH_C/g, 'NORTH_CENTRAL').replace(/Hour Ending/g, 'Hour') : json(b, function ren(x) { if (Array.isArray(x)) return x.map(ren); if (x && typeof x === 'object') { const o = {}; for (const key of Object.keys(x)) o[key + '_x'] = ren(x[key]); return o; } return x; })),
  numStrings: (b, k) => (isText(k) ? null : json(b, j => deep(j, x => (typeof x === 'number' ? String(x) : x)))),
  stringNums: (b, k) => (isText(k) ? null : json(b, j => deep(j, x => (typeof x === 'string' && /^-?\d+(\.\d+)?$/.test(x) ? +x : x)))),
  nullRows: (b, k) => (isText(k) ? null : json(b, j => deep(j, (x, d) => (Array.isArray(x) && d <= 3 && x.length ? x.map(() => null) : x)))),
  nullObjects: (b, k) => (isText(k) ? null : json(b, j => { if (Array.isArray(j)) return j.map(r => (r && typeof r === 'object' ? Object.fromEntries(Object.keys(r).map(key => [key, r[key] && typeof r[key] === 'object' ? null : r[key]])) : r)); const o = {}; for (const key of Object.keys(j || {})) o[key] = j[key] && typeof j[key] === 'object' ? null : j[key]; return o; })),
  nullBody: (b, k) => (isText(k) ? null : 'null'),
  /* an answer ten times larger than recorded */
  tenfold: (b, k) => (isCsv(k) ? b.split('\n')[0] + '\n' + Array(10).fill(b.split('\n').slice(1).join('\n')).join('\n') : isHtml(k) ? b.replace(/(<tr>\s*<td class="labelClassCenter">[\s\S]*<\/tr>)/, m => Array(10).fill(m).join('\n')) : json(b, j => deep(j, (x, d) => (Array.isArray(x) && d <= 1 && x.length ? [].concat(...Array(10).fill(x)) : x)))),
  s429: () => ({ status: 429, body: 'Too Many Requests' }),
  s503: () => ({ status: 503, body: 'Service Unavailable' }),
  s500: () => ({ status: 500, body: HTML }),
  s404: () => ({ status: 404, body: 'Not Found' }),
  s403: () => ({ status: 403, body: 'Forbidden' }),
  hang: () => HANG,
  netfail: () => new TypeError('Failed to fetch'),
};
/* the variants in which the service did not answer the question at all: the record must say so, or the run must fail */
export const FAILURES = ['err200', 'html', 'truncated', 'emptyBody', 'nullBody', 's429', 's503', 's500', 's403', 'hang', 'netfail'];
/* does a record say that part of it is not this run's? */
export const MARKS = {
  nws_cold: d => d.failed > 0 || !!d.alertsErr, cpsc_recalls: d => d.failed > 0, acis_season: d => Object.keys(d.stale || {}).length + Object.keys(d.errs || {}).length > 0,
  iem_cold: d => !!d.staleWhy || Object.keys(d.stale || {}).length + Object.keys(d.bad || {}).length > 0, cpc_outlook: d => Object.keys(d.errs || {}).length > 0, nbm_extended: () => false,
  ercot_grid: d => !!d.condStale || !!d.daysStale || Object.keys(d.errs || {}).length > 0, permits_dallas: d => (d.stale || []).length > 0, permits_fortworth: d => (d.stale || []).length > 0,
  tdlr_licenses: d => (d.stale || []).length > 0 || !!d.waiting, census_acs: d => (d.stale || []).length > 0 || d.published === null || (d.years || []).some(y => y.published === null), fedreg_rules: d => d.failed > 0,
};
/* a reason nobody should have to read: a JavaScript error text in place of a plain sentence */
export const UGLY = /is not a function|is not iterable|Cannot read prop|of undefined|of null|undefined|\[object Object\]|NaN|Unexpected token|is not defined|Invalid time value|Cannot convert/;
export const junk = x => { let bad = null; (function walk(v, path) { if (bad) return; if (typeof v === 'number' && !Number.isFinite(v)) bad = path + ' = ' + v; else if (typeof v === 'string' && /undefined|NaN|\[object Object\]/.test(v)) bad = path + ' = ' + v.slice(0, 60); else if (Array.isArray(v)) v.forEach((y, i) => walk(y, path + '[' + i + ']')); else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], path + '.' + k); })(x, ''); return bad; };
/* a record without the stamps of the run that made it */
export const strip = d => { const o = JSON.parse(JSON.stringify(d)); for (const k of ['fetched', 'checked', 'alertsAt', 'updated', 'oldest', 'day']) delete o[k]; return JSON.stringify(o); };

/* The sweep: every kind of request each collector makes ('*': all of them at once for the variants in which a whole site is
   down) times every variant, on a Monday 06:00 with the record of the Monday before as the previous one (withPrev) or as a
   first read. Returns one row a run: { id, kind, v, cls ('same' | 'marked' | 'reject' | 'ugly' | 'unmarked'), flags, note, n, s }. */
export const WHEN = '2027-01-11 06:00', BEFORE = '2027-01-04 06:00';
export async function sweep(withPrev, only) {
  const rows = [];
  for (const id of ALL) {
    if (only && id !== only) continue;
    let prev = null;
    if (withPrev) { const W0 = world(dallas(BEFORE)), p = await runOnce(W0, id, service(W0)); if (p.error) throw new Error(id + ': the run of the week before failed: ' + p.error.message); prev = p.data; }
    const Wg = world(dallas(WHEN)), good = await runOnce(Wg, id, service(Wg), prev); if (good.error) throw new Error(id + ': the good run failed: ' + good.error.message);
    const limit = Wg.L.BY_ID[id].timeoutMs || 120000, gtext = strip(good.data), gsize = JSON.stringify(good.data).length;
    for (const kind of [...new Set(good.calls.map(c => c.kind))].concat(['*'])) for (const v of Object.keys(VARIANTS)) {
      if (kind === '*' ? !['hang', 's503', 's429', 'netfail', 'html', 'err200', 'emptyBody'].includes(v) : VARIANTS[v]('{}', kind) === null) continue;
      const W = world(dallas(WHEN)), over = (ok, url, init, k) => { const out = VARIANTS[v](textOf(ok()), k); return out === null ? ok() : out; };
      const r = await runOnce(W, id, service(W, { over: { [kind]: over } }), prev), flags = []; let cls, note = '';
      if (r.ms > limit) flags.push('OVER BUDGET ' + Math.round(r.ms / 1000) + ' s of ' + limit / 1000);
      if (r.calls.length > Math.max(8, good.calls.length * 3)) flags.push('MANY REQUESTS ' + r.calls.length + ' against ' + good.calls.length);
      if (r.error) { const m = String((r.error && r.error.message) || ''); cls = typeof (r.error && r.error.message) !== 'string' || !m || UGLY.test(m) ? 'ugly' : 'reject'; note = m.slice(0, 160); }
      else {
        const d = r.data, size = JSON.stringify(d).length, j = junk(d);
        if (j) flags.push('JUNK ' + j); if (size > gsize * 3 + 2000) flags.push('HUGE ' + size + ' B against ' + gsize);
        try { const dj = junk(JSON.parse(JSON.stringify(W.L.BY_ID[id].digest(d)))); if (dj) flags.push('DIGEST JUNK ' + dj); } catch (e) { flags.push('DIGEST THREW ' + e.message); }
        cls = strip(d) === gtext ? 'same' : MARKS[id](d) ? 'marked' : 'unmarked';
        if (cls !== 'same') note = Object.keys(Object.assign({}, d, good.data)).filter(k => JSON.stringify(d[k]) !== JSON.stringify(good.data[k]) && !['fetched', 'checked', 'alertsAt', 'day'].includes(k)).join(',') + ' ' + size + ' B against ' + gsize;
      }
      rows.push({ id, kind, v, cls, flags, note, n: r.calls.length, s: Math.round(r.ms / 1000) });
    }
  }
  return rows;
}
/* An answer with no usable row where the stored record holds rows that cannot have gone away: the record must say so (or the run fail). */
export const NO_ROWS = ['emptyList', 'renamedAll', 'nullRows'];
export const MUST_HOLD = ['cpsc.furnace', 'cpsc.heat pump', 'cpsc.heater', 'fedreg.equipment', 'fedreg.refrigerant', 'fedreg.advertising', 'fedreg.standing', 'fw.zips', 'tdlr.newest'];
/* Reviewed and left as they are, each with its reason */
export const ACCEPTED = [
  { kind: 'census.file', v: ['err200', 'html', 'truncated', 'emptyBody'], why: 'The file server is asked with HEAD and only the status is read, so the sweep turning its 404 for the next vintage into a 200 reads as published. That a file can be posted before the catalogue lists it is a tested rule of the collector (tests/live-census.test.mjs). A file server that answered 200 for a file it does not have would read as a newer vintage: the status is all a HEAD gives.' },
];
/* what the sweep must never show; returns the offending rows as lines */
export function violations(rows, withPrev) {
  const bad = r => r.cls === 'ugly' || r.flags.length > 0 || (r.cls === 'unmarked' && !ACCEPTED.some(a => a.kind === r.kind && a.v.includes(r.v)) && (FAILURES.includes(r.v) || (NO_ROWS.includes(r.v) && MUST_HOLD.includes(r.kind) && (withPrev || !/^(cpsc|fedreg)\./.test(r.kind)))));
  return rows.filter(bad).map(r => [r.id, r.kind, r.v, r.cls, r.n + ' req', r.s + ' s', r.flags.join('; '), r.note].join(' | '));
}
