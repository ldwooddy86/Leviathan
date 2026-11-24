/* Where a street build's time goes: the terrain kit's cutting, the ribbons, the mesh builds. The build is started again
   by switching the aircraft kit off and on (which re-heights the roads).  node t_roadcost.js <page.html> "<address>" */
const L = require('./lib.js');
(async () => {
  const T = await L.start(process.argv[2], process.argv[3] || '1000 Lombard St, San Francisco, CA', { maxMs: 600000 });
  console.log('ready', JSON.stringify(await T.ready(120000))); await T.wait(5000); await T.settle(40);
  const r = await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, SE = window.__SCOUT_ENGINE__, out = [];
    const tm = {}, wrap = (obj, name, tag) => { const f = obj[name]; if (typeof f !== 'function') return; obj[name] = function () { const t0 = performance.now(); try { return f.apply(this, arguments); } finally { const d = performance.now() - t0, e = tm[tag] || (tm[tag] = { ms: 0, n: 0 }); e.ms += d; e.n++; } }; };
    ['drape', 'drapeTri', 'drapeQuad', 'drapePoly', 'cuts', 'dense', 'gy', 'center'].forEach(k => wrap(S.terr, k, 'terr.' + k));
    if (S.traffic) { wrap(S.traffic, 'regrade', 'traffic.regrade'); wrap(S.traffic, 'take', 'traffic.take'); wrap(S.traffic, 'streetCars', 'traffic.streetCars'); }
    wrap(en.street, 'build', 'street.build'); wrap(en.street.traffic, 'populate', 'street.populate'); wrap(en.street.traffic, 'setNetwork', 'street.setNetwork'); wrap(en.street.traffic, 'setParked', 'street.setParked');
    if (SE.MeshBuilder) wrap(SE.MeshBuilder.prototype, 'build', 'MeshBuilder.build');
    for (const life of [true, false]) { en.setGraphics({ life }); for (let k = 0; k < 2; k++) { for (const key in tm) delete tm[key]; const t0 = performance.now(); en.setGraphics({ air: k === 0 ? false : true }); const ms = performance.now() - t0; out.push({ life, ms: Math.round(ms), cost: S.roadCost && { ms: Math.round(S.roadCost.ms), ribbons: Math.round(S.roadCost.ribbons), street: Math.round(S.roadCost.street), lamps: Math.round(S.roadCost.lamps) }, parts: Object.fromEntries(Object.entries(tm).map(([k2, v]) => [k2, Math.round(v.ms) + ' ms / ' + v.n])), roads: S.roads.length, stats: en.street.stats }); } }
    en.setGraphics({ life: true }); return out; });
  r.forEach(x => console.log(JSON.stringify(x)));
  await T.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
