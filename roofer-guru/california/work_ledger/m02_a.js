/* ==== 14_m02_storms.js ==== */
/* ==== m02 Weather and Fire Ledger ==== */
"use strict";
/* ============================ record helpers shared by modules 02, 04, 11 and 14 ============================ */
const ZIX = {}; Z.forEach((z, i) => ZIX[z.zip] = i);
const kmLL = (a, b, c, d) => { const x = (d - b) * Math.cos((a + c) / 2 * Math.PI / 180), y = c - a; return Math.sqrt(x * x + y * y) * 111.32; };
const routeCopy = r => String(r || '');
const routeQuery = r => String(r || '').toLowerCase();
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const hourLab = h => h < 0 ? 'hour unknown' : h === 0 ? '12 a.m.' : h < 12 ? h + ' a.m.' : h === 12 ? '12 p.m.' : (h - 12) + ' p.m.';
const listAnd = a => a.length <= 1 ? (a[0] || '') : a.length === 2 ? a[0] + ' and ' + a[1] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const cap1 = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
/* atmospheric river days of AR2 or stronger: the sum of the rank columns when the data does not carry the total (HAZARD_SCHEMA.md 1b) */
Z.forEach(z => { if (z.ar_days == null && isN(z.ar2d)) z.ar_days = +((+z.ar2d || 0) + (+z.ar3d || 0) + (+z.ar4d || 0) + (+z.ar5d || 0)).toFixed(2); });
const zHas = c => ZC.includes(c) || Z.some(z => z[c] != null);
/* located report kinds (the data's own list when it carries one): 0 hail (inches), 1 thunderstorm wind (mph), 2 tornado (EF), 3 flood,
   4 flash flood, 5 debris flow, 6 heavy rain (inches), 7 wind gust outside thunderstorms (mph) */
const KIND_L = (() => { const d = ['Hail', 'Thunderstorm wind', 'Tornado', 'Flood', 'Flash flood', 'Debris flow', 'Heavy rain', 'Wind gust']; (DATA.ptkinds || []).forEach(o => { if (o && isN(o.k) && o.name) d[o.k] = cap1(String(o.name)); }); return d; })();
const isWindK = k => k === 1 || k === 7;
/* report filters over the located points: t = counts toward the filter; clim = the ZIP column that says how often it happens near a ZIP */
const SF = {
  all: { l: 'All located reports', s: 'located reports', t: () => true, clim: 'stress' },
  w58: { l: 'Wind 58 mph or more (any kind)', s: 'reports of wind 58 mph or more', t: p => isWindK(p.k) && (ptHas(p, 'w58') || p.mag >= 58), clim: 'wd58', line: 'storm' },
  w75: { l: 'Wind 75 mph or more (any kind)', s: 'reports of wind 75 mph or more', t: p => isWindK(p.k) && (ptHas(p, 'w75') || p.mag >= 75), clim: 'wd75', line: 'storm' },
  gust: { l: 'Wind gusts outside thunderstorms', s: 'wind gust reports', t: p => p.k === 7, clim: 'wd58', line: 'storm' },
  wind: { l: 'Thunderstorm wind', s: 'thunderstorm wind reports', t: p => p.k === 1, clim: 'tsw_n25' },
  rain: { l: 'Heavy rain (3 inches or more)', s: 'heavy rain reports', t: p => p.k === 6, clim: 'rain_d1', line: 'repair' },
  flood: { l: 'Flood', s: 'flood records', t: p => p.k === 3, clim: 'flood_n10' },
  ff: { l: 'Flash flood', s: 'flash flood records', t: p => p.k === 4, clim: 'flood_n10' },
  debris: { l: 'Debris flow', s: 'debris flow records', t: p => p.k === 5, clim: 'flood_n10' },
  burn: { l: 'Flash flood or debris flow below a burn scar', s: 'burn scar flood and debris flow records', t: p => ptHas(p, 'burn'), clim: 'burn_sh' },
  hail: { l: 'Hail, any size', s: 'hail reports', t: p => p.k === 0, clim: 'hd1' },
  h1: { l: 'Hail 1 inch or larger', s: 'reports of hail 1 inch or larger', t: p => p.k === 0 && (ptHas(p, 'h1') || p.mag >= 1), clim: 'hd1' },
  torn: { l: 'Tornado, any strength', s: 'tornadoes', t: p => p.k === 2, clim: 'tor_n25' },
  ef1: { l: 'Tornado EF1 or stronger', s: 'tornadoes rated EF1 or stronger', t: p => p.k === 2 && (ptHas(p, 'ef1') || p.mag >= 1), clim: 'tor_n25' },
  dmg: { l: 'Property damage of $10,000 or more', s: 'reports with $10,000 or more in damage', t: p => ptHas(p, 'dmg') || p.dmg >= 10, clim: 'stress' },
  night: { l: 'After dark (8 p.m. to 6 a.m.)', s: 'reports after dark', t: p => ptHas(p, 'night') || (p.h >= 20 || (p.h >= 0 && p.h < 6)), clim: 'stress' },
};
const sfOk = (k, p) => (SF[k] || SF.all).t(p);
const CLIM_L = { stress: 'Roof weather stress score (0 to 100)', wd58: 'Days a year a gust of 58 mph or more was measured within 25 miles', wd75: 'Days a year a gust of 75 mph or more was measured within 25 miles', tsw_n25: 'Thunderstorm wind reports within 25 miles, 1955 to 2025', rain_d1: 'Days a year with 1 inch of rain or more', flood_n10: 'Located flood, flash flood and debris flow records within 10 km, 1996 to 2025', burn_sh: 'Share of the ZIP inside a fire perimeter since 2000 (%)', hd1: 'Hail days a year, 1 inch or larger within 25 miles', tor_n25: 'Tornado start points within 25 miles, 1950 to 2025' };
/* the atmospheric river scale (CW3E, Ralph and others 2019) as colors and names; index 0 is "below AR1". catColor keeps its name for the modules that call it */
const CATC_L = ['#8d8578', '#7fb0c9', '#4f93b8', '#d0892a', '#b84a1c', '#741c35', '#4f2366'];
const CATC_D = ['#9a9184', '#a2c9e1', '#64a0c4', '#f0b45c', '#f07a4a', '#e0466f', '#c77dd8'];
const catColor = c => (isDark() ? CATC_D : CATC_L)[Math.max(0, Math.min(6, (isN(c) ? Math.round(c) : 0)))];
const CAT_SHORT = ['Below AR1', 'AR1 weak', 'AR2 moderate', 'AR3 strong', 'AR4 extreme', 'AR5 exceptional'];
const AR_WORD = ['', 'weak, primarily beneficial', 'moderate, mostly beneficial, also hazardous', 'strong, a balance of beneficial and hazardous', 'extreme, mostly hazardous, also beneficial', 'exceptional, primarily hazardous'];
const kindColor = k => { const g = ramp('green'), t = ramp('teal'), d = isDark(); return [t[d ? 6 : 5], g[d ? 6 : 5], catColor(5), t[d ? 4 : 3], t[d ? 7 : 7], '#8b5a2b', t[d ? 5 : 4], g[d ? 5 : 4]][k] || cssv('--ink-3'); };
/* wind event kinds */
const WKIND = { santa_ana: 'Santa Ana', diablo: 'Diablo', sundowner: 'Sundowner', mono: 'Mono wind', winter: 'Winter storm wind', other: 'Other high wind' };
const wkindColor = k => { const g = ramp('green'), t = ramp('teal'); return ({ santa_ana: g[6], diablo: g[4], sundowner: '#b07a1f', mono: catColor(5), winter: t[5], other: cssv('--ink-3') })[k] || cssv('--ink-3'); };
/* California has no storm tracks. The names below were the track helpers of the first edition of this atlas; other modules may still
   call them, so they stay defined and answer with nothing. The event record is LEDG. */
const stormKind = () => 'Event';
const stormName = r => r ? String(r.name || r.r || '') : '';
const SIDX = {};
function stormFoot() { return {}; }
const dmgShare = () => 0;
function footStats() { return { n34: 0, n50: 0, n64: 0, hu50: 0, hu64: 0, est: 0, vmax: 0 }; }
const RTS = {};
const hailTxt = v => String(Math.round(v * 100) / 100);
const ptMag = p => p.k === 0 ? (p.mag > 0 ? hailTxt(p.mag) + ' inch hail' : 'hail') : isWindK(p.k) ? (p.mag >= 20 ? N(p.mag) + ' mph ' + (p.k === 7 ? 'gust' : 'thunderstorm wind') : 'damaging wind') : p.k === 2 ? (p.mag >= 1 ? 'EF' + p.mag + ' tornado' : 'EF0 or unrated tornado') : p.k === 6 ? (p.mag > 0 ? hailTxt(p.mag) + ' inches of rain' : 'heavy rain') : String(KIND_L[p.k] || 'report').toLowerCase();
/* dates: YYYY-MM-DD or YYYYMMDD to "Jan 7, 2025" */
const hzDate = v => { const s = String(v == null ? '' : v); const m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/); return m ? `${MON3[+m[2] - 1]} ${+m[3]}, ${m[1]}` : s; };
/* nearest labeled place to a point: each place gets a radius that grows with population; the place with the smallest distance to radius ratio wins */
function nearPlace(lat, lon, maxKm) { let best = null, bq = 1e9, bd = 0; PLACES.forEach(c => { if (!isN(c.lat)) return; const d = kmLL(lat, lon, c.lat, c.lon), rad = 1.2 * Math.sqrt(Math.max(2500, c.pop) / 2000), q = d / rad; if (q < bq) { bq = q; best = c; bd = d; } }); if (!best) return null; return bq <= 1 ? { name: best.name, km: bd, inside: true } : bd <= (maxKm || 18) ? { name: best.name, km: bd, inside: false } : null; }
/* fixed breaks for small counts: at most five classes, the darkest steps of a ramp */
function stretchClasses(max) { const b = [...new Set([1, Math.ceil(max * 0.15), Math.ceil(max * 0.3), Math.ceil(max * 0.55)].filter(x => x >= 1 && x < max))].sort((a, b2) => a - b2); b.push(Infinity); return b.slice(-5); }
const stretchIdx = (b, v) => { let i = 0; while (i < b.length - 1 && v > b[i]) i++; return i; };
function stretchColors(b, rn) { const R = ramp(rn || 'green'); return b.map((_, i) => R[7 - (b.length - 1 - i)]); }
const stretchLab = (b, i, d) => { const lo = i === 0 ? 0 : b[i - 1]; const hi = b[i]; const f = v => d ? D(v, 1) : N(v); if (hi === Infinity) return 'over ' + f(lo); if (i === 0) return d ? 'up to ' + f(hi) : (hi === 1 ? '1' : '1 to ' + f(hi)); return d ? f(lo) + ' to ' + f(hi) : (lo + 1 === hi ? f(hi) : f(lo + 1) + ' to ' + f(hi)); };
/* structures destroyed classes for a fire outline: null (no inspection record), 0, 1 to 9, 10 to 99, 100 to 999, 1,000 to 4,999, 5,000 or more */
const FIRE_B = [0, 9, 99, 999, 4999, Infinity]; const FIRE_BL = ['none', '1 to 9', '10 to 99', '100 to 999', '1,000 to 4,999', '5,000 or more'];
const fireClass = d => d == null ? -1 : FIRE_B.findIndex(b => d <= b);
const fireColor = d => { const c = fireClass(d); return c < 0 ? cssv('--ink-3') : ramp('green')[2 + c]; };

/* ============================ LEDG: the event ledger (wildfires, atmospheric river landfalls, wind events) ============================ */
/* Read once from the hazard block of the data (HAZARD_SCHEMA.md section 2). Every list is empty when the data does not carry it. */
const LEDG = (() => {
  const H = DATA.hz || DATA.hazard || DATA.hazard_events || {};
  const fires = (H.fires || []).map((f, i) => Object.assign({}, f, { i, label: `${f.name || 'Unnamed'} ${f.year}`, fips: f.fips || [], dr: f.dr || [] }));
  const FI = {}; fires.forEach(f => { FI[f.id] = f; });
  const byLabel = {}; fires.forEach(f => { const k = f.label.toLowerCase(); if (!byLabel[k] || (f.dest || 0) > (byLabel[k].dest || 0)) byLabel[k] = f; });
  const find = x => { if (x == null) return null; if (typeof x === 'number') return fires[x] || null; const s = String(x); return FI[s] || byLabel[s.toLowerCase()] || byLabel[s.toLowerCase().replace(/ fire\b/, '')] || fires.filter(f => String(f.name).toLowerCase() === s.toLowerCase()).sort((a, b) => (b.dest || 0) - (a.dest || 0))[0] || null; };
  const ZF = H.zfire || {};
  const zfire = zip => (ZF[zip] || []).map(a => ({ f: fires[a[0]], dest: a[1] || 0, dmg: a[2] || 0, km: a[3], pct: a[4] || 0 })).filter(o => o.f);
  /* the ZIPs of a fire: those it burned into or damaged structures in (built once by turning the per ZIP lists round) */
  let FZ = null;
  const fireZips = i => { if (!FZ) { FZ = {}; Object.entries(ZF).forEach(([zip, a]) => a.forEach(r => { if ((r[1] || 0) + (r[2] || 0) > 0 || (r[4] || 0) > 0 || r[3] === 0) (FZ[r[0]] = FZ[r[0]] || []).push({ zip, dest: r[1] || 0, dmg: r[2] || 0, km: r[3], pct: r[4] || 0 }); })); } return FZ[i] || []; };
  const zdins = zip => (H.zdins || {})[zip] || {};
  /* atmospheric rivers */
  const arPts = (H.ar_pts || []).slice().sort((a, b) => a.lat - b.lat);
  const coastLon = lat => { if (!arPts.length) return -122; if (lat <= arPts[0].lat) return arPts[0].lon; for (let i = 1; i < arPts.length; i++) { if (lat <= arPts[i].lat) { const a = arPts[i - 1], b = arPts[i]; const t = (lat - a.lat) / ((b.lat - a.lat) || 1); return a.lon + t * (b.lon - a.lon); } } return arPts[arPts.length - 1].lon; };
  const wyOf = (y, m) => m >= 10 ? y + 1 : y;
  const ar = (H.ar || []).map((a, i) => { const y = +String(a[0]).slice(0, 4), m = +String(a[0]).slice(5, 7); return { i, start: a[0], y, m, wy: wyOf(y, m), hours: a[1], rank: a[2], ivt: a[3], lat: a[4], s: a[5], n: a[6] }; });
  const arBig = (H.ar_big || []).map((a, i) => Object.assign({}, a, { i, label: `AR${a.rank} of ${hzDate(a.start)}` }));
  /* a ZIP's rank in a big landfall: the digit of its coast point in the event's string of ranks */
  const arRankAt = (ev, z) => { const p = z && isN(z.ar_pt) ? +z.ar_pt : null; const s = String(ev.pr || ''); return p != null && s.length > p ? +s[p] || 0 : null; };
  /* wind events and the forecast zones that tie them to ZIPs */
  const wind = (H.wind || []).map((w, i) => Object.assign({}, w, { i, fips: w.fips || [], zn: w.zn || [], label: `${WKIND[w.kind] || 'High wind'} of ${hzDate(w.start)}` }));
  const zones = H.zones || [];
  let ZZ = null;
  const zipZones = zip => { if (!ZZ) { ZZ = {}; zones.forEach(z => (z.zips || []).forEach(q => { (ZZ[q] = ZZ[q] || new Set()).add(z.i); })); } return ZZ[zip] || new Set(); };
  const zipWind = zip => { const zs = zipZones(zip); return zs.size ? wind.filter(w => w.zn.some(n => zs.has(n))) : []; };
  const TS = DATA.ts || {};
  const fema = H.fema || TS.fema_decl || [];
  return { H, has: fires.length > 0 || ar.length > 0 || wind.length > 0, fires, FI, find, zfire, fireZips, zdins, arPts, coastLon, ar, arBig, arRankAt, wind, zones, zipWind, roof: H.roof || null, fhsz: H.fhsz || null, fema };
})();
