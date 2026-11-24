/* The crowd through the library: counts in four boxes at 03:00, 08:00, 12:00 and 17:30 (Monday 23 November 2026),
   the same answer twice, costs, and the statewide sample against the original app's own count.
   arg: { base: true|false } */
const T = () => performance.now(), out = { boxes: {}, cost: {} };
const L = await window.__LEGION_LOAD__(); await L.ready();
const BOX = { 'Los Angeles, Civic Center and Chinatown (90012)': [-118.252, 34.050, -118.236, 34.064], 'Mammoth Lakes (93546)': [-118.995, 37.635, -118.955, 37.655],
  'Twentynine Palms (92277)': [-116.085, 34.125, -116.035, 34.150], 'San Francisco, Mission (94110)': [-122.425, 37.748, -122.408, 37.765] };
const HOURS = ['03:00', '08:00', '12:00', '17:30'];
const mem0 = performance.memory && performance.memory.usedJSHeapSize;
for (const [name, b] of Object.entries(BOX)) {
  const o = out.boxes[name] = { hours: {} };
  let t = T(); const first = await L.crowd(b, L.timeAt('08:00'), { max: 300 }); o.buildMs = Math.round(T() - t);
  o.zips = first.zips; o.rates = first.rates;
  for (const h of HOURS) {
    const tm = L.timeAt(h); t = T(); const r = await L.crowd(b, tm, { max: 300 }); const ms = T() - t;
    const r2 = await L.crowd(b, tm, { max: 300 });
    const mv = r.people.filter(p => p.moving);
    o.hours[h] = { found: r.found, counts: r.counts, ms: +ms.toFixed(1), same: JSON.stringify(r) === JSON.stringify(r2), returned: r.people.length, truncated: r.truncated,
      inBox: r.people.every(p => p.lon >= b[0] && p.lon <= b[2] && p.lat >= b[1] && p.lat <= b[3]), movers: mv.length, headings: mv.every(p => p.heading == null || (p.heading >= 0 && p.heading < 360)),
      kmh: mv.length ? [Math.min(...mv.map(p => p.kmh || 0)), Math.max(...mv.map(p => p.kmh || 0))] : null, ids: new Set(r.people.map(p => p.id)).size === r.people.length };
    if (h === '08:00') o.sample = mv.slice(0, 3).concat(r.people.filter(p => !p.moving).slice(0, 1));
  }
  /* only the people who are out, and a person followed through a commute */
  const mvOnly = L.crowdNow(b, L.timeAt('08:00'), { only: 'moving', max: 50 }); o.movingOnly = { found: mvOnly.found, all: mvOnly.people.every(p => p.moving) };
  const who = mvOnly.people.find(p => p.state === 'to-work' && !p.visitor);
  if (who) { const w = L.whereIs(who.id, L.timeAt('08:00')), tr = L.trip(who.id); o.follow = { id: who.id, crowd: [who.state, who.mode, who.lat, who.lon, who.heading, who.kmh], dayPlan: w && [w.text, w.lat, w.lon], crowdAgain: w && w.crowd && [w.crowd.state, w.crowd.lat, w.crowd.lon], trip: tr && [tr.mode, tr.departMin, tr.minutes, tr.dwellMin, tr.days.join('')] }; }
}
/* cost of an answer once built: the Los Angeles box, 200 calls a minute apart */
{ const b = Object.values(BOX)[0], t0 = L.timeAt('07:30'); let t = T(), n = 0; for (let i = 0; i < 200; i++) n += L.crowdNow(b, t0 + i * 60000, { max: 500, only: 'moving' }).people.length; out.cost.crowdNowMs = +((T() - t) / 200).toFixed(2); out.cost.avgMovers = Math.round(n / 200);
  t = T(); for (let i = 0; i < 200; i++) L.crowdNow(b, t0 + i * 60000, { max: 0 }); out.cost.countOnlyMs = +((T() - t) / 200).toFixed(2); }
out.stats1 = L.stats(); out.mem1 = performance.memory && performance.memory.usedJSHeapSize - mem0;
/* homes and the tie to buildings: made-up footprints on a grid in one cell, twice, and in another order */
{ const c = L.cellOf(34.0585, -118.2390), hs = L.homesIn(c.bbox, { max: 1e6 }); const bl = [];
  for (let i = 0; i < 60; i++) { const fx = (i % 10 + 0.5) / 10, fy = (Math.floor(i / 10) + 0.5) / 6; bl.push({ id: 'b' + i, lat: c.bbox[1] + fy * (c.bbox[3] - c.bbox[1]), lon: c.bbox[0] + fx * (c.bbox[2] - c.bbox[0]), kind: i % 7 === 0 ? 'apartment' : i % 5 === 0 ? 'small-apartment' : 'house', area: i % 7 === 0 ? 900 : 140, levels: i % 7 === 0 ? 4 : 1 }); }
  const h1 = L.housing(c.key, bl), h2 = L.housing(c.key, bl.slice().reverse()), h3 = L.housing(c.key, bl, { strict: true });
  const over = Object.values(h1.byBuilding).filter(v => v.over).length, houses = bl.filter(x => x.kind === 'house').map(x => h1.byBuilding[x.id].households.length);
  out.housing = { cell: c, homes: hs.total, mix: hs.households.reduce((a, h) => (a[h.dwelling] = (a[h.dwelling] || 0) + 1, a), {}), units: h1.units, housed: h1.housed, unhoused: h1.unhoused.length, vacant: h1.vacant, sameAgain: JSON.stringify(h1) === JSON.stringify(L.housing(c.key, bl)),
    sameAnyOrder: JSON.stringify(h1.byHousehold) === JSON.stringify(h2.byHousehold), housesHoldAtMostOne: houses.every(n => n <= 1), buildingsOver: over, strict: { housed: h3.housed, unhoused: h3.unhoused.length, noneOver: Object.values(h3.byBuilding).every(v => !v.over && v.households.length <= v.units) },
    example: Object.entries(h1.byBuilding).slice(0, 3).map(([k, v]) => [k, v.units, v.households.slice(0, 3)]) }; }
if (arg && arg.base) {
  let t = T(); out.base = await L.crowdBase({ rate: 0.025 }); out.base.wallMs = Math.round(T() - t);
  const CA = [-124.6, 32.4, -114.0, 42.1]; out.state = {};
  for (const h of HOURS.concat(['14:44'])) { const tm = L.timeAt(h); t = T(); const r = L.crowdNow(CA, tm, { max: 0 }); out.state[h] = { t: tm, counts: r.counts, ms: Math.round(T() - t) }; }
  const b = Object.values(BOX)[0]; out.withVisitors = {};
  for (const h of HOURS) { const r = L.crowdNow(b, L.timeAt(h), { max: 300 }); out.withVisitors[h] = { found: r.found, counts: r.counts, estimate: r.estimate, visitors: r.people.filter(p => p.visitor).length }; }
  out.stats2 = L.stats(); out.mem2 = performance.memory && performance.memory.usedJSHeapSize - mem0;
}
out.hostMap = !!HOST.map.getCenter(); out.hostErrors = HOST.errors;
return out;
