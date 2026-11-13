// Build the static climate baseline the app ships with: app/data/climate-base.js (window.__CLIMATE_BASE__).
// It holds what does not move week to week: the official 1991 to 2020 normals of the 45 stations in the metro box (NCEI),
// the daily normals at DFW Airport, 30 seasons of freeze statistics and the last ten seasons per station (ACIS), the 4 km
// normals grid and county normals (PRISM through ACIS) and, sampled from that grid, the cold exposure of every atlas ZIP.
//   node tools/climate-base.mjs                pull the seven requests, check them, write the file
//   node tools/climate-base.mjs --dry          pull and report, write nothing
//   node tools/climate-base.mjs --cache <dir>  keep each raw answer in <dir> and read it from there on the next run
// Run it each July, when a heating season has closed (the last ten seasons move on by one), and at release time. Seven
// requests, about 250 KB read, under a minute: each of the two grid requests takes the server 12 to 17 s. All or nothing:
// when a request fails nothing is written and the file in the tree stays as it is.
// Node 22, no packages. Behind an HTTPS proxy the script restarts itself with NODE_USE_ENV_PROXY=1 so fetch honours it.
import vm from 'node:vm';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit', env: Object.assign({}, process.env, { NODE_USE_ENV_PROXY: '1' }) });
  process.exit(r.status ?? 1);
}
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app'), OUT = join(APP, 'data', 'climate-base.js');
const a = process.argv.slice(2), has = k => a.includes(k), val = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const cache = val('--cache') ? resolve(val('--cache')) : null; if (cache) mkdirSync(cache, { recursive: true });

/* A generic client string: it names what the client does, never the project, the account or a contact. */
const UA = 'public-data-refresh/1.0 (weekly refresh of public datasets)';
/* the live layer: its polite http helper, the ACIS call with its three error modes, its number rules and the grid sampler the page uses */
const ctx = vm.createContext({ console, setTimeout, clearTimeout, URL, URLSearchParams, AbortController, TextEncoder, TextDecoder, Intl, fetch: (u, i) => fetch(u, Object.assign({}, i, { headers: Object.assign({ 'User-Agent': UA }, (i && i.headers) || {}) })) });
ctx.globalThis = ctx; ctx.self = ctx;
for (const f of ['live/core.js', 'live/geo.js', 'live/sources/acis_season.js', 'live/climate.js']) vm.runInContext(readFileSync(join(APP, f), 'utf8'), ctx, { filename: f });
const L = ctx.TDA_LIVE, A = L.acis, http = L.makeHttp({});
const r1 = v => Math.round(v * 10) / 10, r3 = v => Math.round(v * 1000) / 1000;
const fail = m => { console.error('climate baseline NOT written: ' + m); process.exit(1); };

/* ---------- the requests ---------- */
const NCEI = 'https://www.ncei.noaa.gov/access/services/data/v1';
/* the 45 stations in the box with 1991 to 2020 temperature normals (GHCN daily ids; the list is fixed until the next normals) */
const STN = 'USC00410206,USC00410337,USC00410404,USC00410518,USC00410691,USC00410984,USC00411063,USC00411246,USC00411800,USC00412019,USC00412334,USC00412404,USC00413133,USC00413285,USC00413289,USC00413675,USC00413691,USC00413734,USC00414182,USC00414517,USC00414597,USC00414705,USC00414980,USC00415094,USC00415766,USC00417028,USC00417388,USC00417588,USC00419522,USC00419532,USC00419800,USW00003927,USW00003969,USW00003971,USW00003991,USW00013911,USW00013960,USW00013961,USW00053907,USW00053909,USW00053911,USW00053912,USW00053914,USW00093904,USW00093985';
const DFW_GHCN = 'USW00003927', DEC = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const N1_TYPES = ['ANN-HTDD-NORMAL', 'SON-HTDD-NORMAL', 'DJF-HTDD-NORMAL', 'MAM-HTDD-NORMAL', 'ANN-TMIN-AVGNDS-LSTH032', 'ANN-TMIN-AVGNDS-LSTH020', ...DEC.map(p => 'ANN-TMIN-PRBFST-T32FP' + p), 'ANN-TMIN-PRBFST-T28FP50', 'ANN-TMIN-PRBLST-T32FP50', 'ANN-TMIN-PRBLST-T32FP10', 'ANN-TMIN-PRBOCC-LSTH020', 'ANN-TMIN-PRBOCC-LSTH016'];
const BOX = A.BOX, Y07 = { interval: [1, 0, 0], duration: 'std', season_start: '07-01' }, Y10 = { interval: [1, 0, 0], duration: 'std', season_start: '10-01' }, MC = r => ({ reduce: r, add: 'mcnt' });
const SM = { smry: 'mean', smry_only: 1 }, CM = { area_reduce: 'county_mean', smry: 'mean', smry_only: 1 }, el = (name, base, reduce, more) => Object.assign({ name }, base, { reduce }, more || {});
/* the last heating season that has closed ends on the latest June 30 behind us */
const today = A.localDate(new Date()), endYear = +today.slice(0, 4) - (today.slice(5) > '06-30' ? 0 : 1);
const BODY = {
  /* 30 seasons 1991-92 to 2020-21, October 1 to April 30 of each, so the missing day count covers the cold half only */
  S1: { bbox: BOX, sdate: '1992-04-30', edate: '2021-04-30', meta: 'name,sids,ll,elev,county,uid', elems: [el('mint', Y10, MC('cnt_le_32')), el('mint', Y10, 'cnt_le_25'), el('mint', Y10, 'first_le_32'), el('mint', Y10, 'last_le_32'), el('mint', Y10, 'min')] },
  S2: { bbox: BOX, sdate: (endYear - 9) + '-06-30', edate: endYear + '-06-30', meta: 'name,sids,ll,elev,county,uid', elems: [el('hdd', Y07, MC('sum')), el('mint', Y07, MC('cnt_le_32')), el('mint', Y07, 'cnt_le_25'), el('mint', Y07, 'first_le_32'), el('mint', Y07, 'last_le_32'), el('mint', Y07, { reduce: 'min', add: 'date' })] },
  G0: { bbox: BOX, grid: '21', sdate: '1992-06-30', edate: '2021-06-30', meta: 'll,elev', elems: [el('hdd', Y07, 'sum', SM), el('mint', Y07, 'cnt_le_32', SM), el('mint', Y07, 'cnt_le_25', SM)] },
  G0c: { bbox: BOX, grid: '21', sdate: '1992-06-30', edate: '2021-06-30', elems: [el('hdd', Y07, 'sum', CM), el('mint', Y07, 'cnt_le_32', CM), el('mint', Y07, 'cnt_le_25', CM)] },
};
const URLS = {
  N1: `${NCEI}?dataset=normals-annualseasonal-1991-2020&stations=${STN}&dataTypes=${N1_TYPES.join(',')}&format=json&includeStationName=true&includeStationLocation=1`,
  N2: `${NCEI}?dataset=normals-monthly-1991-2020&stations=${STN}&dataTypes=MLY-HTDD-NORMAL,MLY-TMIN-AVGNDS-LSTH032,MLY-TMIN-PRBOCC-LSTH032&format=csv`,
  /* the placeholder dates are required; one station is enough for the pacing curve */
  N3: `${NCEI}?dataset=normals-daily-1991-2020&stations=${DFW_GHCN}&dataTypes=DLY-HTDD-NORMAL,DLY-TMIN-NORMAL&startDate=0001-01-01&endDate=9996-12-31&format=csv`,
};
async function pull(id, fn) {
  const file = cache ? join(cache, id + '.txt') : null;
  if (file && existsSync(file)) { console.log(`  ${id.padEnd(4)} read from the cache`); return readFileSync(file, 'utf8'); }
  const t0 = Date.now(); let text;
  try { text = await fn(); } catch (e) { fail(`${id} failed: ${String((e && e.message) || e).slice(0, 200)}`); }
  if (file) writeFileSync(file, text);
  console.log(`  ${id.padEnd(4)} ${String(text.length).padStart(7)} bytes  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return text;
}
const ncei = id => pull(id, () => http.text(URLS[id], { gapMs: 1000, retries: 2, timeoutMs: 60000 }));
const acis = (id, path) => pull(id, async () => JSON.stringify(await A.call(http, id, path, BODY[id], { timeoutMs: 90000, retries: 1 })));

/* ---------- parsers ---------- */
/* NCEI pads its values with spaces. Special codes: -7777 is a value that rounds to zero; -9999, -8888, -6666 and -4444 are missing or undefined. */
const nv = s => { const v = parseFloat(String(s == null ? '' : s).trim()); return Number.isNaN(v) ? null : v === -7777 ? 0 : v <= -4000 ? null : v; };
const nd = s => { const t = String(s == null ? '' : s).trim(); return /^\d\d\/\d\d$/.test(t) ? t : null; };
const csv = text => { const rows = text.trim().split(/\r?\n/).map(l => l.split(',').map(c => c.replace(/^"|"$/g, ''))), head = rows.shift(); return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]]))); };

console.log(`climate baseline: seven requests${cache ? ' (cache ' + cache + ')' : ''} …`);
const n1 = JSON.parse(await ncei('N1')), n2 = csv(await ncei('N2')), n3 = csv(await ncei('N3'));
const s1 = JSON.parse(await acis('S1', 'MultiStnData')), s2 = JSON.parse(await acis('S2', 'MultiStnData')), g0 = JSON.parse(await acis('G0', 'GridData')), g0c = JSON.parse(await acis('G0c', 'GridData'));

/* ---------- N1, N2: official normals by GHCN id ---------- */
const fipsOf = {}; for (const r of [...(s1.data || []), ...(s2.data || [])]) { const g = A.sidOf(r.meta, 6); if (g && r.meta.county) fipsOf[g] = r.meta.county; }
const nceiOut = {};
for (const r of n1) {
  const id = r.STATION; if (!id) continue;
  nceiOut[id] = { name: String(r.NAME || '').trim(), label: A.nice(String(r.NAME || '').trim(), id), lat: nv(r.LATITUDE), lon: nv(r.LONGITUDE), fips: fipsOf[id] || null,
    hdd: nv(r['ANN-HTDD-NORMAL']), hddSON: nv(r['SON-HTDD-NORMAL']), hddDJF: nv(r['DJF-HTDD-NORMAL']), hddMAM: nv(r['MAM-HTDD-NORMAL']), d32: nv(r['ANN-TMIN-AVGNDS-LSTH032']), d20: nv(r['ANN-TMIN-AVGNDS-LSTH020']),
    first32: DEC.map(p => nd(r['ANN-TMIN-PRBFST-T32FP' + p])), first28p50: nd(r['ANN-TMIN-PRBFST-T28FP50']), last32p50: nd(r['ANN-TMIN-PRBLST-T32FP50']), last32p10: nd(r['ANN-TMIN-PRBLST-T32FP10']), p20: nv(r['ANN-TMIN-PRBOCC-LSTH020']), p16: nv(r['ANN-TMIN-PRBOCC-LSTH016']),
    mHdd: Array(12).fill(null), mD32: Array(12).fill(null), mP32: Array(12).fill(null) };
}
for (const r of n2) { const s = nceiOut[r.STATION], m = +r.DATE - 1; if (!s || !(m >= 0 && m < 12)) continue; s.mHdd[m] = nv(r['MLY-HTDD-NORMAL']); s.mD32[m] = nv(r['MLY-TMIN-AVGNDS-LSTH032']); s.mP32[m] = nv(r['MLY-TMIN-PRBOCC-LSTH032']); }

/* ---------- N3: daily normals at DFW Airport, January 1 first, February 29 included ---------- */
const dly = n3.filter(r => r.STATION === DFW_GHCN).sort((x, y) => (x.DATE < y.DATE ? -1 : 1));
const dailyNormHdd = { station: DFW_GHCN, byDay: dly.map(r => nv(r['DLY-HTDD-NORMAL'])) }, dailyNormTmin = { station: DFW_GHCN, byDay: dly.map(r => nv(r['DLY-TMIN-NORMAL'])) };

/* ---------- S1: 30 seasons of freeze statistics by ACIS station number (index 0 is the fall of 1991) ---------- */
/* A season with more than 10 missing days between October 1 and April 30 is null: ACIS counts whatever days it has. */
const stations = {}, freeze = {};
for (const r of s1.data || []) {
  const u = r.meta && r.meta.uid, d = r.data || []; if (u == null || d.length !== 30) continue;
  const o = { fr32: [], fr25: [], first: [], last: [], minT: [], miss: [] };
  for (const y of d) { const [v, m] = A.pair(y[0]), ok = A.num(m) != null && m <= 10 && A.num(v) != null; o.miss.push(A.num(m)); o.fr32.push(ok ? A.num(v) : null); o.fr25.push(ok ? A.num(y[1]) : null); o.first.push(ok ? A.day(y[2]) : null); o.last.push(ok ? A.day(y[3]) : null); o.minT.push(ok ? A.num(y[4]) : null); }
  if (o.fr32.filter(v => v != null).length < 10) continue;
  freeze[u] = o; stations[u] = A.stationOf(r.meta);
}

/* ---------- S2: the last ten closed seasons (the official normal runs well above them: show both) ---------- */
const last10 = { seasons: Array.from({ length: 10 }, (_, i) => endYear - 10 + i) };
for (const r of s2.data || []) {
  const u = r.meta && r.meta.uid, d = r.data || []; if (u == null || d.length !== 10) continue;
  const o = { hdd: [], fr32: [], fr25: [], first: [], last: [], minT: [] };
  for (const y of d) { const [h, hm] = A.pair(y[0]), [f, fm] = A.pair(y[1]), [t] = A.pair(y[5]), okH = A.num(hm) != null && hm <= 10, okM = A.num(fm) != null && fm <= 10 && A.num(f) != null; o.hdd.push(okH ? A.num(h) : null); o.fr32.push(okM ? A.num(f) : null); o.fr25.push(okM ? A.num(y[2]) : null); o.first.push(okM ? A.day(y[3]) : null); o.last.push(okM ? A.day(y[4]) : null); o.minT.push(okM ? A.num(t) : null); }
  if (o.hdd.filter(v => v != null).length < 5) continue;
  last10[u] = o; stations[u] = stations[u] || A.stationOf(r.meta);
}

/* ---------- G0, G0c: the normals grid and the county normals ---------- */
const M = g0.meta || {}, lat = M.lat || [], lon = M.lon || [], G = A.GEOM;
if (!(Array.isArray(g0.smry) && g0.smry.length === 3)) fail('G0 did not return three grids');
if (!(lat.length === G.ny && lon.length === G.ny && lon[0].length === G.nx && Math.abs(lat[0][0] - G.lat0) < 1e-4 && Math.abs(lon[0][0] - G.lon0) < 1e-4 && Math.abs(lat[1][0] - lat[0][0] - 1 / 24) < 1e-4 && Math.abs(lon[0][1] - lon[0][0] - 1 / 24) < 1e-4)) fail('the PRISM grid no longer has the geometry the app assumes (40 by 62 from 32.0, -98.333333, 1/24 degree)');
const prism = Object.assign({}, G, { hdd: A.flat(g0.smry[0]), fr32: A.flat(g0.smry[1]), fr25: A.flat(g0.smry[2]) });
const prismCounty = {}; for (const f of Object.keys((g0c.smry || [])[0] || {})) prismCounty[f] = { hdd: r1(g0c.smry[0][f]), fr32: r1(g0c.smry[1][f]), fr25: r1(g0c.smry[2][f]) };

/* ---------- per ZIP: the grid at the centroid, against the housing unit weighted metro mean ---------- */
const raw = readFileSync(join(APP, 'data', 'atlas-data.js'), 'utf8'), D = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
const col = k => { const i = D.zcols.indexOf(k); if (i < 0) fail('the atlas ZIP rows have no column ' + k); return i; }, zi = col('zip'), la = col('lat'), lo = col('lon'), hu = col('hu'), ci = col('ci');
const fipsByName = {}; L.geo.counties.forEach(c => { fipsByName[c.name] = c.fips; });
const zs = D.zrows.map(r => ({ zip: String(r[zi]), hu: +r[hu] || 0, fips: fipsByName[(D.counties[r[ci]] || {}).name] || null, h: L.climate.sample(prism.hdd, r[la], r[lo], prism), f: L.climate.sample(prism.fr32, r[la], r[lo], prism) }));
if (zs.some(z => z.h == null || z.f == null)) fail('ZIP centroids outside the grid: ' + zs.filter(z => z.h == null || z.f == null).map(z => z.zip).join(', '));
const wmean = (list, k) => { const w = list.reduce((s, z) => s + z.hu, 0); return w ? list.reduce((s, z) => s + z.hu * z[k], 0) / w : null; };
const metroH = wmean(zs, 'h'), metroF = wmean(zs, 'f');
const zip = {}; for (const z of zs) zip[z.zip] = { hdd: Math.round(z.h), fr32: r1(z.f), ratio: r3(z.h / metroH) };
/* the same ratio by county, weighted by where the housing units are (the county mean of the grid weights empty land the same as a subdivision) */
const homes = {}; for (const c of L.geo.counties) { const list = zs.filter(z => z.fips === c.fips), h = wmean(list, 'h'), f = wmean(list, 'f'); if (h != null) homes[c.fips] = { hdd: r1(h), fr32: r1(f), ratio: r3(h / metroH), hu: list.reduce((s, z) => s + z.hu, 0), zips: list.length }; }

const base = { v: 1, built: today, normalsPeriod: '1991 to 2020', lastSeason: endYear - 1,
  credit: { ncei: 'NOAA National Centers for Environmental Information, U.S. Climate Normals 1991 to 2020', acis: 'NOAA Regional Climate Centers, ACIS', prism: 'PRISM Climate Group, Oregon State University, https://prism.oregonstate.edu, accessed ' + today },
  metro: { hdd: r1(metroH), fr32: r1(metroF), hu: zs.reduce((s, z) => s + z.hu, 0), zips: zs.length },
  ncei: nceiOut, dailyNormHdd, dailyNormTmin, stations, freeze, last10, prism, prismCounty, homes, zip };

/* ---------- checks: refuse to write a baseline that is not whole ---------- */
const dfw = nceiOut[DFW_GHCN], bad = [];
if (Object.keys(nceiOut).length !== 45) bad.push(`NCEI returned ${Object.keys(nceiOut).length} stations, not 45`);
if (!dfw || !(dfw.hdd > 1800 && dfw.hdd < 2700) || dfw.first32.some(x => !x) || dfw.mHdd.some(v => v == null)) bad.push('the DFW Airport normals are incomplete');
if (dailyNormHdd.byDay.length !== 366 || dailyNormHdd.byDay.some(v => v == null)) bad.push(`the daily normals hold ${dailyNormHdd.byDay.length} days, not 366`);
if (dfw && Math.abs(dailyNormHdd.byDay.reduce((s, v) => s + v, 0) - dailyNormHdd.byDay[59] - dfw.hdd) > 25) bad.push('the daily normals do not add up to the annual normal');
if (!freeze['29755'] || !last10['29755']) bad.push('DFW Airport is missing from the freeze statistics or the last ten seasons');
if (prism.hdd.some(v => v == null) || prism.fr32.some(v => v == null)) bad.push('the normals grid has missing cells');
for (const c of L.geo.counties) if (!prismCounty[c.fips] || !homes[c.fips]) bad.push('no county normal for ' + c.name);
if (zs.length !== D.zrows.length || !(metroH > 1500 && metroH < 3500)) bad.push('the ZIP block is incomplete');
const body = JSON.stringify(base);
if (/<\/script/i.test(body)) bad.push('the baseline holds a literal </script');
if (body.length >= 250 * 1024) bad.push(`the baseline is ${Math.round(body.length / 1024)} KB, over the 250 KB budget`);

/* ---------- report ---------- */
const kb = o => (JSON.stringify(o).length / 1024).toFixed(1).padStart(6) + ' KB';
console.log(`ncei          ${kb(nceiOut)}  ${Object.keys(nceiOut).length} stations; DFW Airport ${dfw && dfw.hdd} heating degree days a year, ${dfw && dfw.d32} freeze nights, first freeze 10/50/90 percent ${dfw && [dfw.first32[0], dfw.first32[4], dfw.first32[8]].join(' ')}`);
console.log(`daily normals ${kb([dailyNormHdd, dailyNormTmin])}  ${dailyNormHdd.byDay.length} days; July 1 to November 12 adds up to ${r1(dailyNormHdd.byDay.slice(182, 317).reduce((s, v) => s + v, 0))}`);
console.log(`freeze        ${kb(freeze)}  ${Object.keys(freeze).length} stations with at least 10 usable seasons of 30`);
console.log(`last10        ${kb(last10)}  ${Object.keys(last10).length - 1} stations, seasons ${last10.seasons[0]} to ${last10.seasons[9]}; DFW Airport ${last10['29755'] ? last10['29755'].hdd.join(' ') : ''}`);
console.log(`stations      ${kb(stations)}  ${Object.keys(stations).length} named`);
console.log(`prism         ${kb(prism)}  ${prism.ny} by ${prism.nx}; heating degree days ${Math.min(...prism.hdd)} to ${Math.max(...prism.hdd)}, freeze nights ${Math.min(...prism.fr32)} to ${Math.max(...prism.fr32)}`);
console.log(`counties      ${kb([prismCounty, homes])}  ${L.geo.counties.map(c => c.name + ' ' + (prismCounty[c.fips] || {}).hdd + '/' + (homes[c.fips] || {}).ratio).join(', ')}`);
const zr = Object.keys(zip).sort((x, y) => zip[x].ratio - zip[y].ratio);
console.log(`zip           ${kb(zip)}  ${zr.length} ZIPs; metro mean ${r1(metroH)} heating degree days and ${r1(metroF)} freeze nights; exposure ${zr[0]} ${zip[zr[0]].ratio} to ${zr[zr.length - 1]} ${zip[zr[zr.length - 1]].ratio}; 75149 ${JSON.stringify(zip['75149'])}`);
console.log(`total         ${(body.length / 1024).toFixed(1).padStart(6)} KB; ${http.stats.n} requests, ${Math.round(http.stats.bytes / 1024)} KB read`);
if (bad.length) fail(bad.join('; '));
if (has('--dry')) { console.log('dry run: nothing written'); process.exit(0); }
writeFileSync(OUT, `/* ==== climate-base.js ==== */\n/* The static climate baseline (1991 to 2020 normals, freeze climatology, the normals grid), written by tools/climate-base.mjs. */\nwindow.__CLIMATE_BASE__ = ${body};\n`);
console.log('wrote app/data/climate-base.js');
