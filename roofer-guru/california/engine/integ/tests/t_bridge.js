/* The M3 driven by script across a landmark bridge with the traffic on the deck.
   node t_bridge.js <page.html> cor|gg [tiger]      (tiger: no saved OpenStreetMap answer, the Census fallback) */
const L = require('./lib.js'), path = require('path');
const FILE = process.argv[2], WHICH = process.argv[3] || 'cor', TIGER = process.argv[4] === 'tiger', TAG = WHICH + (TIGER ? '_tiger' : '');
const PLAN = {
  cor: { addr: '1100 Orange Ave, Coronado, CA', at: [32.68905, -117.16560, 115], prefer: 'CA 75|Route 75|4th|I 5', mph: 55, done: a => a.road === 'I 5' && a.lon > -117.1402, maxT: 260, mid: a => a.lon > -117.1560 && a.lon < -117.1535, name: 'San Diego-Coronado Bridge', side: [32.6855, -117.1500, 320, -4], minTop: 55 },
  gg: { addr: 'Golden Gate Bridge Welcome Center, San Francisco, CA', at: [37.80650, -122.47470, 320], prefer: 'US 101|Golden Gate', mph: 45, done: a => a.lat > 37.8345, maxT: 330, mid: a => a.lat > 37.8190 && a.lat < 37.8200, name: 'Golden Gate Bridge', side: [37.8105, -122.4690, 330, 2], minTop: 60 }
}[WHICH];
(async () => {
  const T = await L.start(FILE, PLAN.addr, { osm: !TIGER, maxMs: 2400000, w: 860, h: 620 }), ok = L.ok;
  await T.page.addScriptTag({ path: path.join(__dirname, 'pilot.js') });
  await T.ev(a => MODI.rooftops.api.en().open(a[0], a[1], a[2], {}), PLAN.at); await T.wait(4000);
  console.log('ready', JSON.stringify(await T.ready(120000)));
  await T.ev(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'low', sun: 15, life: true, wide: true }); }); await T.wait(6000); await T.settle(60);
  /* what the kits say about the deck, before the car moves */
  const st = await T.ev(name => { const en = MODI.rooftops.api.en(), S = en.world, TF = S.traffic, gy = S.gy, out = { y0: S.y0, tiger: null, fw: 0, sky: 0, skyPts: 0, worst: 0, top: -1e9, streetsSky: 0, raised: 0, ends: [] };
    const all = (TF.roads || []).concat(S.roads); out.fw = (TF.roads || []).length;
    all.forEach(r => { if (!r.sky) return; out.sky++; if (S.roads.includes(r)) out.streetsSky++; r.pts.forEach((p, i) => { if (!r.sk[i]) return; out.skyPts++; const d = S.deckAt(p[0], p[1], { info: true }); if (!d) return; const y = gy(p[0], p[1]) + r.dk[i], e = Math.min(Math.abs(y - d.y), d.lower ? Math.abs(y - d.y + d.lower) : 1e9); if (e > out.worst) out.worst = e; if (y + S.y0 > out.top) out.top = y + S.y0; }); });
    out.raised = all.filter(r => r.up && !r.sky).length; out.top = +out.top.toFixed(1); out.worst = +out.worst.toFixed(3); out.air = en.air.info().bridges; out.stats = TF.stats; out.pieces = TF.flow.segs.filter(s => s.sk && s.sk.some(v => v)).length; return out; }, PLAN.name);
  console.log('decks', JSON.stringify(st));
  ok(st.sky > 0 && st.skyPts > 20, 'roads ride the landmark deck', { roads: st.sky, points: st.skyPts, pieces: st.pieces });
  ok(st.worst < 0.05, 'their heights are the deck\'s', st.worst); ok(st.top > PLAN.minTop, 'the deck is high over the water (m above sea level)', st.top);
  /* the car, by script */
  await T.ev(() => { const en = MODI.rooftops.api.en(); en.engine.stop(); en.setHeight('m3'); }); await T.settle(20);
  const car0 = await T.ev(() => { const en = MODI.rooftops.api.en(), c = en.state().car, S = en.world; return { lat: +c.lat.toFixed(5), lon: +c.lon.toFixed(5), yaw: +c.yaw.toFixed(0), onRoad: c.onRoad, y: +c.y.toFixed(2), ground: +S.gy(en.car.state.x, en.car.state.z).toFixed(2) }; });
  console.log('car out', JSON.stringify(car0));
  let dyAt = null, t = 0, shotMid = false, done = false, hits = 0, offRoad = 0, lost = 0, maxDy = 0, minDeck = 1e9, maxDeck = -1e9, onDeck = 0, steps = 0, names = [], gens = new Set(), deckCars = 0, maxAsl = 0, slow = 0, maxMs = 0;
  while (t < PLAN.maxT && !done) {
    const r = await T.ev(a => PILOT.run(4, { mph: a.mph, prefer: a.prefer, every: 60 }), { mph: PLAN.mph, prefer: PLAN.prefer }); t += 4;
    hits += r.hits; offRoad += r.offRoad; lost += r.lost; steps += r.steps; if (r.maxDy > maxDy) { maxDy = r.maxDy; dyAt = r.dyAt; } r.gens.forEach(g => gens.add(g)); slow += r.slow; maxMs = Math.max(maxMs, r.maxMs); r.names.forEach(n => { if (names[names.length - 1] !== n) names.push(n); });
    for (const s of r.samples) { if (s.deck != null) { onDeck++; minDeck = Math.min(minDeck, s.deck); maxDeck = Math.max(maxDeck, s.deck); } maxAsl = Math.max(maxAsl, s.asl); }
    const s = r.samples[r.samples.length - 1]; if (t % 12 === 0 || r.hits) console.log(' t', t, JSON.stringify(s), r.hits ? 'HIT ' + JSON.stringify(r.hitInfo) : '');
    await T.wait(250); await T.settle(6, 0);
    if (!shotMid && PLAN.mid(s)) { shotMid = true;
      const tr = await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, F = S.traffic.flow, a = en.car.state; let n = 0, near = 0, worst = 0; for (const c of F.cars) { if (!c.seg.sk) continue; const d = S.deckAt(c.x, c.z, { info: true }); if (!d) continue; n++; const y = S.traffic.yOn(c), e = Math.min(Math.abs(y - d.y), d.lower ? Math.abs(y - d.y + d.lower) : 1e9); if (e > worst) worst = e; if (Math.hypot(c.x - a.x, c.z - a.z) < 300) near++; } return { onDeck: n, within300m: near, worstHeightError: +worst.toFixed(3), all: F.cars.length, street: S.traffic.debug().street.cars }; });
      console.log('traffic on the deck', JSON.stringify(tr)); deckCars = tr.onDeck; ok(tr.onDeck > 0 && tr.worstHeightError < 0.05, 'traffic is on the deck at the deck\'s height', tr);
      await T.shot(TAG + '_chase.png'); await T.ev(() => { const en = MODI.rooftops.api.en(); en.world.cchase.yaw = -70; en.world.cchase.pitch = -12; en.world.cchase.dist = 16; }); await T.shot(TAG + '_side_car.png'); await T.ev(() => { const en = MODI.rooftops.api.en(); en.world.cchase.yaw = 0; en.world.cchase.pitch = -9; en.world.cchase.dist = 7.2; }); }
    done = PLAN.done(s) || r.steps < 200;
  }
  const end = await T.ev(() => { const en = MODI.rooftops.api.en(), c = en.state().car; return { lat: +c.lat.toFixed(5), lon: +c.lon.toFixed(5), mph: +c.mph.toFixed(1), onRoad: c.onRoad, odo: Math.round(c.odo), hits: c.hits, y: +c.y.toFixed(2), elev: en.state().elev }; });
  console.log('end', JSON.stringify(end), 'roads driven:', names.join(' > '));
  console.log('drive', JSON.stringify({ t, steps, hits, offRoadSteps: offRoad, lostSteps: lost, biggestStepInHeight: maxDy, onDeckSamples: onDeck, carOverDeck: [minDeck, maxDeck], maxAsl, origins: [...gens], slowUpdates: slow, maxUpdateMs: maxMs }));
  ok(done, 'the car reached the far side', end); ok(shotMid, 'it crossed the middle of the bridge'); ok(onDeck > 10 && minDeck > -0.05 && maxDeck < 0.6, 'on the bridge the car stood on the deck', [minDeck, maxDeck]);
  ok(maxAsl > PLAN.minTop, 'it climbed to the deck\'s height', maxAsl); ok(maxDy < 0.6, 'no jump in height from one step to the next', [maxDy, dyAt]); ok(offRoad < steps * 0.03, 'it stayed on the road', offRoad + ' of ' + steps); ok(hits === 0, 'it struck nothing', hits);
  /* the bridge from the side, from the air */
  await T.ev(a => { const en = MODI.rooftops.api.en(); en.setHeight('bird'); en.open(a[0], a[1], a[2], {}); en.world.pitch = a[3]; en.setGraphics({ sun: 15 }); }, PLAN.side); await T.wait(1500); await T.settle(30);
  await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world; for (let i = 0; i < 900; i++) S.traffic.flow.step(1 / 30, [S.x, S.z]); });
  await T.shot(TAG + '_from_air.png');
  await T.close(); console.log(L.bad() ? L.bad() + ' FAILED' : 'all pass'); process.exit(L.bad() ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
