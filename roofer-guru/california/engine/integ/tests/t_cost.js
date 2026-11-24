/* Frame cost by part at one busy place per metro, everything on, at low and high quality: the update's milliseconds per
   kit (stepped by hand), and draws and triangles with each part switched off in turn (the difference is that part's).
   Software rendering: the counts are exact, the milliseconds only compare with each other.
   node t_cost.js <page.html> [la,sf,sd] [low,high] */
const L = require('./lib.js');
const PL = (process.argv[3] || 'sd,sf,la').split(','), QS = (process.argv[4] || 'low,high').split(',');
const AT = { la: ['Wilshire Blvd at the 405, Los Angeles (Westwood)', 34.0563, -118.4490, 80], sf: ['Market St at 4th St, San Francisco', 37.7858, -122.4059, 45], sd: ['Interstate 5 at Broadway, San Diego', 32.7157, -117.1612, 330] };
(async () => {
  const T = await L.start(process.argv[2], '1100 Orange Ave, Coronado, CA', { maxMs: 3300000, w: 860, h: 620, osm: true });
  console.log('ready', JSON.stringify(await T.ready(120000)));
  for (const k of PL) { const [name, la, lo, yaw] = AT[k];
    for (const q of QS) {
      await T.ev(a => { const en = MODI.rooftops.api.en(); en.engine.start(); en.setHeight('drone'); en.open(a[0], a[1], a[2], {}); en.world.pitch = -14; en.setGraphics({ q: a[3], sun: 17, life: true, wide: true, air: true, trees: true, lamps: true, weather: 'clear' }); en.storm('dry'); }, [la, lo, yaw, q]); await T.wait(10000); await T.ready(240000); await T.wait(q === 'high' ? 25000 : 10000); await T.settle(80);
      /* the update by part: each kit's update wrapped with a timer, 150 steps of 1/30 s */
      const up = await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, G = en.engine, tm = {}, undo = [];
        const wrap = (obj, name, tag) => { const f = obj && obj[name]; if (typeof f !== 'function') return; obj[name] = function () { const t0 = performance.now(); try { return f.apply(this, arguments); } finally { const e = tm[tag] || (tm[tag] = { ms: 0, n: 0 }); e.ms += performance.now() - t0; e.n++; } }; undo.push(() => { obj[name] = f; }); };
        wrap(S.traffic, 'update', 'traffic kit (freeways, far lamps)'); wrap(en.street, 'update', 'street life (street cars, signals)'); wrap(en.air, 'update', 'aircraft, ships, bridges'); wrap(en.stormKit, 'update', 'weather'); wrap(S.terr, 'pump', 'terrain pump'); wrap(en.wideKit, 'update', 'wider city'); wrap(G.physics, 'step', 'physics');
        G.stop(); G.playing = true; for (let i = 0; i < 30; i++) G.emit('update', 1 / 30); for (const key in tm) { tm[key].ms = 0; tm[key].n = 0; } const N = 150, t0 = performance.now(); for (let i = 0; i < N; i++) G.emit('update', 1 / 30); const all = (performance.now() - t0) / N; undo.forEach(f => f());
        const out = { 'whole update': +all.toFixed(2) }; let sum = 0; for (const key in tm) { out[key] = +(tm[key].ms / N).toFixed(2); sum += tm[key].ms / N; } out['the rest (camera, cells, labels, roof views)'] = +(all - sum).toFixed(2); const d = S.traffic.debug(); out.counts = { flowCars: d.cars, streetCars: d.street.cars, flights: en.state().air.flights, roads: S.roads.length, fwyPieces: d.stats && d.stats.pieces, built: en.state().built }; return out; });
      console.log(k, q, name); console.log('  update ms per step:', JSON.stringify(up));
      /* draws and triangles: all on, then one part off at a time */
      const frame = async () => { await T.ev(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ playing: false }); en.engine.start(); }); const f0 = await T.ev(() => MODI.rooftops.api.en().engine.time.frame); for (let i = 0; i < 60; i++) { await T.wait(1500); await T.page.mouse.move(300 + (i % 5), 300); const f = await T.ev(() => MODI.rooftops.api.en().engine.time.frame); if (f - f0 >= 3) break; } const g = await T.ev(() => { const en = MODI.rooftops.api.en(), g2 = en.graphics(), st = en.engine.renderer.stats; return { draws: st.draws, tris: st.tris, instances: st.instances, shadowDraws: st.shadowDraws, lights: st.lights, ms: g2.ms }; }); await T.ev(() => { const en = MODI.rooftops.api.en(); en.engine.stop(); en.setGraphics({ playing: true }); en.engine.stop(); }); return g; };
      const all = await frame(), rows = [['everything on', all]];
      for (const [label, off, on] of [['aircraft, ships, bridges', { air: false }, { air: true }], ['street life and traffic', { life: false }, { life: true }], ['wider city and far ground', { wide: false }, { wide: true }], ['trees', { trees: false }, { trees: true }], ['lamp posts', { lamps: false }, { lamps: true }]]) { await T.ev(o => MODI.rooftops.api.en().setGraphics(o), off); await T.settle(12); const f = await frame(); rows.push([label + ' off', f, { draws: all.draws - f.draws, tris: all.tris - f.tris }]); await T.ev(o => MODI.rooftops.api.en().setGraphics(o), on); await T.settle(12); }
      await T.ev(() => MODI.rooftops.api.en().storm('ar3')); await T.step(90, 1 / 30); const rain = await frame(); rows.push(['an AR3 on top', rain, { draws: all.draws - rain.draws, tris: all.tris - rain.tris }]); await T.ev(() => MODI.rooftops.api.en().storm('dry'));
      rows.forEach(r => console.log('  ' + r[0].padEnd(32), JSON.stringify(r[1]), r[2] ? 'that part: ' + JSON.stringify(r[2]) : ''));
      if (q === 'low') await T.shot('cost_' + k + '.png');
    } }
  await T.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
