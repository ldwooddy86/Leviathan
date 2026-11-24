// Legion · street view tests (Node, no DOM): the procedural network, routing, residents, the simulation, the
// fallback planner, light and weather, OpenStreetMap parsing and caching, and chatter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Population } from '../src/engine/population.mjs';
import { Rng, hash2 } from '../src/engine/rng.mjs';
import { atPacific, pacific } from '../src/engine/clock.mjs';
import { buildScene, sceneContext } from '../src/world/street-scene.mjs';
import { StreetNet, buildNet, Router, dijkstra, pathCost, pathIsContiguous, components, netFingerprint, finishNet, signalState } from '../src/world/street-net.mjs';
import { StreetSim, stepLen } from '../src/world/street-sim.mjs';
import { createFallbackPlanner, isTravel, normalizeActivity } from '../src/world/street-plan.mjs';
import { sunPosition, lightAt, weatherEffects, pointSegDist, clipToSquare, Frame, groundGrid, seaNear, GROUND } from '../src/world/street-geo.mjs';
import { createNamer, ordinal, shortName, spanishStreet } from '../src/world/street-names.mjs';
import { parseOSM, overpassQuery, readCache, writeCache, tilesFor, viewBox, clearMemoryCache, wayClass, fetchOSM, STORE_PREFIX } from '../src/world/street-osm.mjs';
import { vegetation } from '../src/world/street-lots.mjs';
import { parkName, schoolName } from '../src/world/street-gen.mjs';

const world = await loadDefaultWorld();
const pop = new Population(world);
const at = (zip, dx = 0, dy = 0) => { const zi = world.indexOf(zip); return [world.z.tx[zi] + dx, world.z.ty[zi] + dy]; };
const scenes = new Map();
const sceneOf = (zip, dx = 0, dy = 0) => {
  const k = `${zip}:${dx}:${dy}`;
  if (!scenes.has(k)) scenes.set(k, buildScene(world, pop, ...at(zip, dx, dy)));
  return scenes.get(k);
};
// the rural view: open country a few kilometers west of Truckee's town point
const RURAL = ['96161', -12, 6];

// ---------------------------------------------------------------- the network

test('the procedural network is deterministic for a location', () => {
  const a = buildScene(world, pop, ...at('94110'));
  const b = buildScene(world, pop, ...at('94110'));
  assert.equal(netFingerprint(a.net), netFingerprint(b.net));
  assert.equal(a.net.edges.length, b.net.edges.length);
  assert.deepEqual(a.net.edges.map(e => e.name), b.net.edges.map(e => e.name));
  assert.equal(a.buildings.length, b.buildings.length);
  assert.deepEqual(a.buildings.slice(0, 50).map(x => [Math.round(x.cx * 10), Math.round(x.cy * 10), x.kind, x.roof.mat]), b.buildings.slice(0, 50).map(x => [Math.round(x.cx * 10), Math.round(x.cy * 10), x.kind, x.roof.mat]));
  // and a different place is a different network
  assert.notEqual(netFingerprint(a.net), netFingerprint(sceneOf('92620').net));
});

test('street names are stable and look like California: numbered grid streets, plausible suffixes', () => {
  const sc = sceneOf('94110');
  const names = new Set(sc.net.edges.map(e => e.name).filter(Boolean));
  assert.ok(names.size > 10, `names ${names.size}`);
  const again = buildScene(world, pop, ...at('94110'));
  assert.deepEqual([...new Set(again.net.edges.map(e => e.name).filter(Boolean))].sort(), [...names].sort());
  // overlapping views of one ZIP share their lattice and so their street names
  const shifted = buildScene(world, pop, ...at('94110', 0.6, 0));
  const shared = [...new Set(shifted.net.edges.map(e => e.name))].filter(n => names.has(n));
  assert.ok(shared.length >= names.size * 0.5, `shared ${shared.length} of ${names.size}`);
  assert.equal(ordinal(1), '1st'); assert.equal(ordinal(22), '22nd'); assert.equal(ordinal(13), '13th');
  assert.equal(shortName('Valencia Street'), 'Valencia St');
  const namer = createNamer(world, world.indexOf('92620'), 'curvi');
  const cul = namer.street(12345, 'local', 'culdesac');
  assert.match(cul, /(Court|Place|Circle|Lane|^Via |^Calle |^Camino |^Paseo )/);
});

test('the surface network is one connected component; freeways cross the view', () => {
  for (const key of [['94110'], ['92620'], RURAL, ['95536'], ['90001']]) {
    const sc = sceneOf(...key);
    const surface = components(sc.net, e => !e.freeway && e.cls !== 'ramp');
    assert.equal(surface.count, 1, `${key} has ${surface.count} components`);
    assert.ok(sc.net.exits().length >= 2, `${key} exits`);
    for (const e of sc.net.edges) {
      assert.ok(e.len > 0.5 && Number.isFinite(e.len));
      for (const v of e.pts) assert.ok(Number.isFinite(v));
    }
  }
});

test('network style differs: pre-war grid (94110), post-1980 suburb (92620), rural (96161 outside town)', () => {
  const grid = sceneOf('94110'), sub = sceneOf('92620'), rural = sceneOf(...RURAL);
  assert.equal(grid.style, 'grid'); assert.equal(sub.style, 'curvi'); assert.equal(rural.style, 'rural');
  const g = grid.metrics, s = sub.metrics, r = rural.metrics;
  // the old grid: four-way intersections, alleys mid-block, many intersections per km2
  assert.ok(g.fourWayShare > 0.8, `grid 4-way ${g.fourWayShare}`);
  assert.ok(g.alleyShare > 0.05, `grid alleys ${g.alleyShare}`);
  assert.ok(g.intersectionsPerKm2 > 60, `grid intersections ${g.intersectionsPerKm2}`);
  assert.equal(g.culdesacs, 0);
  // the subdivision: cul-de-sacs, T-junctions, curving streets, fewer intersections
  assert.ok(s.culdesacs >= 10, `suburb cul-de-sacs ${s.culdesacs}`);
  assert.ok(s.fourWayShare < 0.6, `suburb 4-way ${s.fourWayShare}`);
  assert.ok(s.sinuosity > g.sinuosity + 0.02, `suburb sinuosity ${s.sinuosity}`);
  assert.ok(s.intersectionsPerKm2 < g.intersectionsPerKm2 * 0.5);
  assert.equal(s.alleyShare, 0);
  // the country: rural roads and lanes, scattered homes on their own sites, very few intersections
  assert.ok((r.byClassKm.rural || 0) > 0.5, 'rural roads');
  assert.ok(r.intersectionsPerKm2 < g.intersectionsPerKm2 * 0.2, `rural intersections ${r.intersectionsPerKm2}`);
  assert.ok(r.streetKmPerKm2 < g.streetKmPerKm2 * 0.3, `rural density ${r.streetKmPerKm2}`);
  assert.ok(rural.buildings.some(b => b.loose && b.rural), 'homes on their own sites with driveways');
  // a small town keeps its grid core inside rural roads (Ferndale)
  const town = sceneOf('95536');
  assert.equal(town.mode, 'rural');
  assert.ok((town.metrics.byClassKm.local || 0) > 2 && (town.metrics.byClassKm.rural || 0) > 0.5);
});

test('the place shapes the scene: roofs from roof data, shops from establishments, water at the coast', () => {
  const sub = sceneOf('92620'), grid = sceneOf('94110');
  const tileShare = sc => { const r = sc.buildings.filter(b => b.kind === 'house'); return r.filter(b => b.roof.mat === 'tile').length / r.length; };
  // Irvine's roofs are half tile (tile_sh 52), the Mission's mostly not (8.3)
  assert.ok(tileShare(sub) > 0.35 && tileShare(grid) < 0.2, `tile ${tileShare(sub)} vs ${tileShare(grid)}`);
  const solar = sub.buildings.filter(b => b.kind === 'house' && b.roof.solar).length / sub.buildings.filter(b => b.kind === 'house').length;
  assert.ok(solar > 0.08 && solar < 0.3, `solar ${solar}`);
  const shops = grid.buildings.filter(b => b.kind === 'commercial').length;
  assert.ok(shops > 40, `storefronts ${shops}`);
  assert.ok(sub.pools.length > grid.pools.length, 'pools where Julys are hot');
  // Ocean Beach: the view touches the ocean; no street runs into the water
  const beach = sceneOf('94122', -10, 0);
  assert.ok(beach.ground.hasOcean && beach.water.length > 0);
  let wet = 0, n = 0;
  for (const e of beach.net.edges) { if (e.freeway || e.bridge) continue; for (let i = 0; i < e.pts.length; i += 6) { n++; if (!beach.ground.isLand(e.pts[i], e.pts[i + 1])) wet++; } }
  assert.ok(wet / n < 0.02, `street points in water ${wet}/${n}`);
});

test('ground in no ZIP: land inland (desert, campus), river channels stay water, the coast keeps its ocean', () => {
  const ground = (lat, lon, zip) => {
    let px, py;
    if (zip) { const zi = world.indexOf(zip); px = world.z.tx[zi]; py = world.z.ty[zi]; } else { const p = world.project(lat, lon); px = p.x; py = p.y; }
    const f = new Frame(world, px, py);
    const g = groundGrid(world, f, 600, { cell: 10, seed: 1, margin: 40 });
    const c = [0, 0, 0, 0]; for (const k of g.kind) c[k]++;
    return { g, f, ocean: c[GROUND.OCEAN] / g.kind.length, lake: c[GROUND.LAKE] / g.kind.length };
  };
  // Independence (the Owens Valley, half the view outside any ZIP) and Riverside's campus hole were drawn as sea
  for (const zip of ['93526', '92507', '95375']) {
    const { g, f, ocean } = ground(0, 0, zip);
    assert.equal(ocean, 0, `${zip} ocean ${ocean}`);
    assert.equal(g.hasOcean, false);
    assert.equal(seaNear(world, f, 3140), false);
  }
  assert.ok(ground(0, 0, '93526').g.landShare > 0.99);
  // a channel of the Delta that no ZIP covers is still water (inland water, not ocean)
  const delta = ground(38.0735, -121.6850);
  assert.ok(delta.lake > 0.2 && delta.ocean === 0, `delta lake ${delta.lake} ocean ${delta.ocean}`);
  // the coast is unchanged: Laguna Beach and Ocean Beach have their ocean
  const laguna = ground(0, 0, '92651');
  assert.ok(laguna.ocean > 0.1 && laguna.g.hasOcean, `laguna ocean ${laguna.ocean}`);
  assert.equal(seaNear(world, laguna.f, 3140), true);
  // and a desert view's streets are not cut at a shore that is not there
  const owens = sceneOf('93526');
  assert.equal(owens.ground.hasOcean, false);
  assert.ok(!owens.net.edges.some(e => e.bridge && !e.freeway), 'no bridges over dry land');
});

test('names and plants: Spanish forms agree, place names keep their stems, the high desert is not a forest', () => {
  // Camino and Paseo are masculine: their adjectives agree (Camino Corto), nouns in apposition stay (Paseo Luna)
  assert.equal(spanishStreet('Camino', 'Corta'), 'Camino Corto');
  assert.equal(spanishStreet('Paseo', 'Hermosa'), 'Paseo Hermoso');
  assert.equal(spanishStreet('Calle', 'Serena'), 'Calle Serena');
  assert.equal(spanishStreet('Paseo', 'Luna'), 'Paseo Luna');
  assert.equal(spanishStreet('Camino', 'Verde'), 'Camino Verde');
  const wrong = /^(Camino|Paseo) (Corta|Larga|Bonita|Hermosa|Linda|Serena|Fresca)$/;
  for (const zip of ['92620', '92651', '91910']) {
    const namer = createNamer(world, world.indexOf(zip), 'curvi');
    let spanish = 0;
    for (let k = 0; k < 4000; k++) {
      const n = namer.street(k * 7919 + 1, 'local', 'culdesac');
      if (/^(Calle|Via|Camino|Paseo) /.test(n)) spanish++;
      assert.ok(!wrong.test(n), `${zip}: ${n}`);
    }
    assert.ok(spanish > 200, `${zip}: Spanish street names ${spanish}`);
    // park and school names are a stem and a word, never a bare prefix ("Calle Park", "Via Elementary School")
    const ctx = { namer };
    for (let h = 1; h < 600; h++) {
      for (const name of [parkName(ctx, h), schoolName(ctx, h)]) assert.ok(!/^(Calle|Via|Camino|Paseo) (Park|Playground|Commons|Green|Community|Recreation|Elementary|Middle|High|K-8)\b/.test(name), name);
    }
  }
  // climate zone 16 in the rain shadow (Independence 5.4 in, Bishop 6.3 in) is sagebrush; Truckee (31.6 in) is forest
  const veg = zip => vegetation({ z: world.zip(world.indexOf(zip)), zseed: 1, style: 'tract', mode: 'rural', reliefPerKm: 10 });
  for (const zip of ['93526', '93514', '96101']) assert.equal(veg(zip).open, 4, `${zip} scrub`);
  for (const zip of ['96161', '96150']) assert.equal(veg(zip).open, 1, `${zip} conifers`);
});

// ---------------------------------------------------------------- routing

test('pathfinding finds shortest paths (A* against Dijkstra, contiguous, cost recomputed)', () => {
  for (const zip of ['94110', '92620']) {
    const net = sceneOf(zip).net, router = new Router(net);
    const rng = new Rng(hash2(7, zip.length));
    for (const mode of ['car', 'foot']) {
      for (let k = 0; k < 12; k++) {
        const a = rng.int(net.nodes.length), dist = dijkstra(net, mode, a);
        for (let j = 0; j < 6; j++) {
          const b = rng.int(net.nodes.length);
          const p = router.path(mode, { node: a }, { node: b });
          if (!Number.isFinite(dist[b])) { assert.equal(p, null); continue; }
          if (a === b) continue;
          assert.ok(p, `${zip} ${mode} ${a}->${b}`);
          assert.ok(Math.abs(p.cost - dist[b]) < 1e-6, `${zip} ${mode} ${p.cost} vs ${dist[b]}`);
          assert.ok(pathIsContiguous(net, p));
          assert.ok(Math.abs(pathCost(net, mode, p) - p.cost) < 1e-6);
          // a reverse tree gives the same cost to that node
          const tree = router.tree(mode, b);
          assert.ok(Math.abs(tree.dist[a] - dist[b]) < 1e-6);
        }
      }
    }
  }
  // a hand-made graph: the diagonal shortcut wins, one-way edges are respected by cars only
  const strokes = [
    { pts: Float64Array.from([-100, -100, 100, -100]), cls: 'local' },
    { pts: Float64Array.from([100, -100, 100, 100]), cls: 'local' },
    { pts: Float64Array.from([100, 100, -100, 100]), cls: 'local' },
    { pts: Float64Array.from([-100, 100, -100, -100]), cls: 'local' },
    { pts: Float64Array.from([-100, -100, 100, 100]), cls: 'local', oneway: true },
  ];
  const net = buildNet(strokes, 300);
  const router = new Router(net);
  const nearest = (x, y) => net.nodes.reduce((b, n) => (Math.hypot(n.x - x, n.y - y) < Math.hypot(net.nodes[b].x - x, net.nodes[b].y - y) ? n.id : b), 0);
  const A = nearest(-100, -100), C = nearest(100, 100);
  const go = router.path('car', { node: A }, { node: C }), back = router.path('car', { node: C }, { node: A }), walk = router.path('foot', { node: C }, { node: A });
  assert.ok(Math.abs(go.length - Math.hypot(200, 200)) < 1, `diagonal ${go.length}`);
  assert.ok(Math.abs(back.length - 400) < 1, `one-way respected ${back.length}`);
  assert.ok(Math.abs(walk.length - Math.hypot(200, 200)) < 1, 'pedestrians ignore one-way signs');
});

test('paths to a place a few centimeters past a corner end at the corner (no sliver steps), and stay contiguous', () => {
  const net = sceneOf('94110').net, router = new Router(net);
  let checked = 0;
  for (const E of net.edges) {
    if (checked >= 40 || E.len < 20 || !E.foot) continue;
    const far = net.nodes.find(n => Math.hypot(n.x - net.nodes[E.a].x, n.y - net.nodes[E.a].y) > 300);
    for (const s of [0.05, 0.3, E.len - 0.2]) {
      const p = router.path('foot', { node: far.id }, { e: E.id, s });
      if (!p) continue;
      checked++;
      assert.ok(pathIsContiguous(net, p));
      p.steps.forEach((st, k) => assert.ok(k === 0 || stepLen(st) >= 0.5 || Math.abs(stepLen(st) - net.edges[st.e].len) < 1e-9, `step ${k} of ${stepLen(st).toFixed(2)} m`));
      assert.ok(Math.abs(p.length - p.steps.reduce((a, st) => a + stepLen(st), 0)) < 1e-6);
    }
  }
  assert.ok(checked >= 40);
});

test('intersections are controlled: signals where arterials cross, stop signs elsewhere, phases alternate', () => {
  const net = sceneOf('94110').net;
  const signals = net.nodes.filter(n => n.ctrl === 'signal');
  assert.ok(signals.length > 3 && net.nodes.some(n => n.ctrl === 'stop' || n.ctrl === 'twoway'));
  for (const n of signals) {
    const cls = n.adj.map(a => net.edges[a.e].cls);
    assert.ok(cls.filter(c => c === 'arterial' || c === 'highway').length >= 2);
    // the two phase groups are never green together
    for (let t = 0; t < n.signal.cycle * 1000; t += 997) {
      const g0 = signalState(n.signal, 0, t), g1 = signalState(n.signal, 1, t);
      assert.ok(!(g0 === 'green' && g1 === 'green'));
    }
  }
});

// ---------------------------------------------------------------- residents

test('residents: homes inside the view, every household in a building, every person resolvable', () => {
  const sc = sceneOf('90001');
  const R = sc.R, f = sc.frame;
  const hh = sc.households.filter(Boolean);
  assert.equal(hh.length, sc.ctx.households.residents.length, 'every household placed');
  // the households are exactly those whose layer-0 home is in the square
  let expect = 0;
  for (const zi of sc.ctx.households.zips) for (let h = 0; h < world.z.hh[zi]; h++) { const p = world.homeFor(zi, h); const x = (p.x - f.cx) * f.fx, y = (p.y - f.cy) * f.fy; if (Math.abs(x) <= R && Math.abs(y) <= R) expect++; }
  assert.equal(hh.length, expect);
  for (const x of hh) {
    assert.ok(Math.abs(x.home.x) <= R && Math.abs(x.home.y) <= R);
    const core = pop.householdCore(x.zi, x.h);
    assert.ok(Math.abs((core.home.x - f.cx) * f.fx - x.home.x) < 1e-6);
    const b = sc.buildings[x.b];
    assert.ok(b && ['house', 'small-apartment', 'apartment', 'mobile-home'].includes(b.kind));
    assert.ok(Math.hypot(b.cx - x.home.x, b.cy - x.home.y) < 400, 'snapped to a building nearby');
    assert.ok(b.access, 'the building is reached from a street');
  }
  // dwelling types are honored where buildings of the type exist
  const match = hh.filter(x => sc.buildings[x.b].kind === x.core.dwelling).length / hh.length;
  assert.ok(match > 0.6, `dwelling match ${match}`);
  const rng = new Rng(3);
  for (let k = 0; k < 120; k++) {
    const r = sc.residents[rng.int(sc.residents.length)];
    const npc = pop.get(r.id);
    assert.ok(npc, r.id);
    assert.equal(npc.hid, `${world.zips[r.zi]}-${r.h}`);
  }
});

// ---------------------------------------------------------------- the planner

test('fallback planner follows layer 0 and answers in the contract shape', () => {
  const plan = createFallbackPlanner(world, pop);
  const t = atPacific(2026, 11, 24, 8, 0);         // a Tuesday
  const zi = world.indexOf('94110');
  let checked = 0;
  for (let h = 0; h < 400 && checked < 60; h++) {
    const core = pop.householdCore(zi, h);
    for (const m of core.members) {
      if (m.departMin == null || !m.work || m.mode === 'wfh' || !(m.days & (1 << pacific(t).dow))) continue;
      const items = plan.dayPlan(`94110-${h}-${m.m}`, t);
      const out = items.find(it => it.kind === 'commute' && it.purpose !== 'home');
      assert.ok(out, 'a commute out');
      const dep = (out.start - atPacific(2026, 11, 24, 0, 0)) / 60000;
      assert.ok(Math.abs(dep - m.departMin) <= 8.01, `depart ${dep} vs ${m.departMin}`);
      assert.equal(Math.round((out.end - out.start) / 60000), Math.max(4, m.commuteMin));
      assert.equal(out.mode, m.mode);
      checked++;
    }
  }
  assert.ok(checked >= 30);
  // the day is tiled without gaps or overlaps and every activity has the contract's fields
  const items = plan.dayPlan('94110-12-0', t);
  for (let i = 1; i < items.length; i++) assert.ok(items[i].start >= items[i - 1].end - 1);
  const act = plan('94110-12-0', t + 3 * 3600000);
  for (const k of ['kind', 'place', 'start', 'end', 'progress']) assert.ok(k in act, k);
  assert.ok('x' in act.place && 'y' in act.place && 'kind' in act.place && 'label' in act.place);
  assert.equal(isTravel({ kind: 'home', traveling: false, position: { x: 0, y: 0 } }), false);
  assert.equal(isTravel({ kind: 'errand', travel: true }), true);
  const norm = normalizeActivity({ kind: 'work', start: 480, end: 1020, place: { x: 0, y: 0 } }, t);
  assert.equal(pacific(norm.start).hour, 8);
});

// ---------------------------------------------------------------- the simulation

function checkSim(sim, { gap = true } = {}) {
  const net = sim.net;
  for (const a of sim.agents) {
    const p = sim.pose(a);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.hx) && Number.isFinite(p.hy), `NaN ${a.kind} ${a.phase}`);
    assert.ok(Math.abs(p.x) <= sim.R + 30 && Math.abs(p.y) <= sim.R + 30, 'inside the view');
    if (a.phase !== 'route' || !a.path) continue;
    // on the network: within the right of way of its edge (or the next or previous one, around corners)
    const near = [a.k - 1, a.k, a.k + 1].filter(k => k >= 0 && k < a.path.steps.length).map(k => net.edges[a.path.steps[k].e]);
    let best = Infinity, half = 0;
    for (const E of near) { half = Math.max(half, E.half); for (let i = 0; i + 3 < E.pts.length; i += 2) best = Math.min(best, pointSegDist(p.x, p.y, E.pts[i], E.pts[i + 1], E.pts[i + 2], E.pts[i + 3]).d); }
    assert.ok(best <= half + 3, `${a.kind} off the street by ${best.toFixed(1)} (half ${half})`);
    assert.ok(a.d >= -1e-9 && a.d <= stepLen(a.path.steps[a.k]) + 1e-6);
  }
  if (gap) for (const q of sim.queues.values()) for (let i = 1; i < q.length; i++) {
    const g = sim._along(q[i - 1]) - q[i - 1].len - sim._along(q[i]);
    assert.ok(g >= 1.0 - 1e-6, `gap ${g.toFixed(2)} between ${q[i - 1].kind} and ${q[i].kind}`);
  }
}

test('simulation: twenty minutes of a Mission District morning stay on the streets, cars keep their distance, plans are honored', () => {
  const sc = sceneOf('94110');
  const sim = new StreetSim(sc, { world, population: pop });
  const t0 = atPacific(2026, 11, 24, 7, 45);
  sim.reset(t0);
  sim.scanCommuters(Infinity);
  const s0 = sim.stats();
  assert.ok(s0.agents > 200 && s0.walk > 50 && s0.car > 50, JSON.stringify(s0));
  checkSim(sim);
  const plan = createFallbackPlanner(world, pop);
  let moving = 0;
  for (let i = 0; i < 6000; i++) {
    sim.step();
    if (i % 60 === 0) {
      checkSim(sim);
      for (const a of sim.agents) {
        if (a.person < 0 || !a.act) continue;
        // the agent's trip is the planner's activity: same kind and times, and it is a trip (or a park stay)
        const now = plan(a.id, a.act.start + 1000);
        assert.equal(now.kind, a.act.kind);
        assert.equal(now.start, a.act.start);
        assert.ok(isTravel(a.act) || a.phase === 'wander');
        assert.ok(sim.t <= a.act.end + 30 * 60000, 'not long past its trip');
      }
      moving = Math.max(moving, sim.stats().moving);
    }
  }
  assert.ok(moving > 300, `moving ${moving}`);
  const s1 = sim.stats();
  assert.ok(s1.finished > 500 && s1.spawned > s1.finished, JSON.stringify(s1));
  assert.ok((s1.gaveUp || 0) < s1.finished * 0.05, `vehicles giving up ${s1.gaveUp}`);
  assert.ok(s1.commuters > 0, 'in-commuters from nearby ZIPs');
  // every visible person is a real NPC
  for (const a of sim.agents.slice(0, 150)) assert.ok(pop.get(a.id), a.id);
});

test('simulation: jumps (fast clock) place everyone by schedule and keep the invariants; residents come and go', () => {
  const sc = sceneOf('92620');
  const sim = new StreetSim(sc, { world, population: pop });
  const t0 = atPacific(2026, 11, 24, 16, 30);
  sim.reset(t0);
  for (let i = 0; i < 600; i++) sim.step();
  checkSim(sim);
  const r = sim.advance(sim.t + 8 * 60000, { maxSteps: 10 });
  assert.equal(r.jumped, true);
  checkSim(sim);
  for (let i = 0; i < 900; i++) sim.step();
  checkSim(sim);
  // parked cars track their drivers: some household cars leave and come back over the evening
  const parkedBefore = sim.stats().parked;
  sim.advance(atPacific(2026, 11, 24, 23, 30), {});
  checkSim(sim);
  assert.ok(sim.stats().parked >= parkedBefore - 5, 'cars come home by night');
  // a backwards jump resets cleanly
  const back = sim.advance(t0, {});
  assert.equal(back.jumped, true);
  checkSim(sim);
});

test('simulation: an external planner (planFor) decides who is out, after the layer-0 head start hands over', () => {
  const sc = sceneOf('90001');
  const fallback = createFallbackPlanner(world, pop);
  let calls = 0;
  // a planner that keeps everyone at home except people whose id ends in 1 (who follow layer 0)
  const planFor = (id, t) => { calls++; const a = fallback(id, t); if (!id.endsWith('1') && isTravel(a)) return Object.assign({}, a, { kind: 'home', traveling: false, travel: false, position: null, origin: null }); return a; };
  const sim = new StreetSim(sc, { world, population: pop, planner: planFor });
  const t0 = atPacific(2026, 11, 24, 7, 50);
  sim.reset(t0);
  while (!sim.upgrade(50)) { /* hand everyone over */ }
  assert.ok(calls > 0);
  for (let i = 0; i < 300; i++) sim.step();
  const residents = sim.agents.filter(a => a.role === 'resident');
  assert.ok(residents.length > 0);
  for (const a of residents) assert.ok(a.id.endsWith('1'), `only people the plan puts out: ${a.id}`);
  checkSim(sim);
});

test('simulation: through traffic, buses and parked cars at night (90001, 22:00) and a rural noon', () => {
  const night = new StreetSim(sceneOf('90001'), { world, population: pop });
  night.reset(atPacific(2026, 11, 24, 22, 0));
  for (let i = 0; i < 900; i++) night.step();
  const s = night.stats();
  assert.ok(s.car > 5 && s.parked > 500, JSON.stringify(s));
  // at 22:00 most household cars are home, and every one of them is drawn (looks are uint32 hashes: none may read as empty)
  const spaces = night.scene.households.reduce((n, hh) => n + (hh ? hh.spots.length : 0), 0);
  assert.ok(s.parked >= 0.8 * spaces, `${s.parked} parked of ${spaces} household spaces`);
  for (const v of night.spotCar) assert.ok(v === -1 || v === -2 || (Number.isInteger(v) && v >= 0 && v < 2 ** 32));
  checkSim(night);
  const rural = new StreetSim(sceneOf(...RURAL), { world, population: pop });
  rural.reset(atPacific(2026, 11, 24, 12, 0));
  for (let i = 0; i < 900; i++) rural.step();
  checkSim(rural);
  assert.ok(rural.stats().agents < 200, 'rural roads are quiet');
});

test('simulation: mornings in a subdivision and a small town run without a fault or a gridlock (92620, 95536)', () => {
  // walkers on loop walks from homes at dead ends once ran past the end of their path (Irvine at 7:15, Ferndale at
  // 7:31); side streets at two-way stops once held each other up until a thousand cars stood still at 8:30
  for (const [zip, h0, h1] of [['95536', 6, 9], ['92620', 7, 8.5]]) {
    const sim = new StreetSim(sceneOf(zip), { world, population: pop });
    sim.reset(atPacific(2026, 11, 24, h0, 0));
    const end = atPacific(2026, 11, 24, Math.floor(h1), (h1 % 1) * 60);
    let peak = 0, loops = 0;
    for (let i = 0; sim.t < end; i++) {
      sim.step();
      if (i % 900 === 0) { checkSim(sim); peak = Math.max(peak, sim.agents.length); loops += sim.agents.filter(a => a.trip && a.trip.loop).length; }
    }
    const s = sim.stats();
    assert.equal(s.faults || 0, 0, `${zip} faults: ${JSON.stringify(sim.lastFault)}`);
    assert.ok((s.gaveUp || 0) <= Math.max(3, s.finished * 0.005), `${zip}: ${s.gaveUp} vehicles gave up of ${s.finished}`);
    assert.ok(loops > 0, `${zip}: people out for walks`);
    if (zip === '92620') assert.ok(peak < 800, `92620 peak ${peak} agents (a gridlock piles up thousands)`);
  }
  // a loop walk is never a path of zero-length steps, and a walker covering several steps in one tick stops at the end
  const sim = new StreetSim(sceneOf('95536'), { world, population: pop });
  sim.reset(atPacific(2026, 11, 24, 6, 0));
  const net = sim.net, t0 = atPacific(2026, 11, 24, 6, 30);
  let deadEnd = 0;
  for (const p of sim.persons) {
    const b = sim.scene.buildings[p.b];
    if (!b || !b.access) continue;
    const E = net.edges[b.access.e];
    const atEnd = [[E.a, 0], [E.b, E.len]].some(([n, s]) => net.nodes[n].adj.length === 1 && Math.abs(b.access.s - s) < 0.3);
    if (!atEnd) continue;
    deadEnd++;
    const trip = sim._loopTrip(p, { start: t0, end: t0 + 30 * 60000, kind: 'exercise', loop: true }, t0);
    if (trip) {
      assert.ok(trip.path.length >= 30, `loop of ${trip.path.length} m`);
      trip.path.steps.forEach((st, k) => assert.ok(k === 0 || stepLen(st) >= 0.5 || Math.abs(stepLen(st) - net.edges[st.e].len) < 1e-9, 'no sliver steps after the first'));
    }
    if (deadEnd > 25) break;
  }
  assert.ok(deadEnd > 0, 'homes at the end of lanes');
  const home = sim.scene.buildings.find(b => b.access && b.kind === 'house');
  const st = { e: home.access.e, dir: 1, from: home.access.s, to: home.access.s };
  const a = sim._newAgent({ kind: 'walk', role: 'resident', id: sim.persons[0].id, person: -1, path: { steps: [st, Object.assign({}, st), Object.assign({}, st)], length: 0, cost: 0 }, trip: { dIn: true, toB: home, enterDur: 4, oIn: false, t0: sim.t, vNom: 1.3, path: null }, vmax: 1.3 });
  a.trip.path = a.path; a.phase = 'route';
  assert.doesNotThrow(() => sim._move(a, 0.2));
  assert.equal(a.phase, 'enter');
  assert.equal(a.k, 2);
});

test('simulation: a failure in one agent takes it off the street and the clock keeps going', () => {
  const sim = new StreetSim(sceneOf('90001'), { world, population: pop });
  sim.reset(atPacific(2026, 11, 24, 8, 0));
  const victim = sim.agents.find(a => a.phase === 'route' && a.kind === 'walk' && a.path);
  victim.k = victim.path.steps.length + 5;          // a route state that does not read
  const t0 = sim.t, n0 = sim.agents.length;
  assert.doesNotThrow(() => { for (let i = 0; i < 50; i++) sim.step(); });
  assert.equal(sim.stats().faults, 1);
  assert.equal(sim.lastFault.id, victim.id);
  assert.ok(!sim.agents.includes(victim));
  assert.ok(sim.t > t0 && sim.agents.length > n0 * 0.5);
  checkSim(sim);
  // a car in a queue: the queues read it before its own update does; the sweep still takes it off
  const car = sim.agents.find(a => a.kind === 'car' && a.phase === 'route' && a.q !== null && sim.queues.get(a.q).length > 1);
  car.k = car.path.steps.length + 5;
  assert.doesNotThrow(() => { for (let i = 0; i < 20; i++) sim.step(); });
  assert.ok(!sim.agents.includes(car) && sim.stats().faults >= 2);
  checkSim(sim);
});

test('bus riders: after a reset or a jump nobody waits for a bus that has already come, and buses are on their routes', () => {
  const sim = new StreetSim(sceneOf('94110'), { world, population: pop });
  assert.ok(sim.busRoutes.length > 0 && sim.stops.length > 0);
  for (const t of [atPacific(2026, 11, 24, 8, 0), atPacific(2026, 11, 24, 8, 10)]) {
    if (sim.t === 0) sim.reset(t); else sim.advance(t, { maxSteps: 4 });
    const now = sim.t / 1000;
    const waiting = sim.agents.filter(a => a.phase === 'wait');
    for (const a of waiting) {
      assert.ok(a.wait >= 0 && a.wait <= 25 * 60, `waited ${a.wait}`);
      assert.ok(sim._nextBusAt(a.busStop, now - a.wait) > now, 'their bus is still to come');
    }
    // before, everyone who had walked to a stop in the past two hours stood there (258 at 8:00) with no bus in view
    assert.ok(waiting.length < 80, `${waiting.length} waiting`);
    assert.ok(sim.agents.some(a => a.kind === 'bus'), 'buses already on their routes');
    checkSim(sim);
  }
  // a timetable: the next bus at a stop comes within one headway, never in the hours without service
  const stop = sim.stops[0], route = sim.busRoutes[stop.route];
  const t8 = atPacific(2026, 11, 24, 8, 0) / 1000, t3 = atPacific(2026, 11, 24, 3, 0) / 1000;
  assert.ok(sim._nextBusAt(stop.id, t8) - t8 <= route.headway + 1e-6);
  assert.ok(sim._nextBusAt(stop.id, t3) >= atPacific(2026, 11, 24, 5, 0) / 1000);
});

test('streams: arrivals are spread in time, nobody is on two agents, and shoppers do not outlive a reset', () => {
  const sim = new StreetSim(sceneOf('94110'), { world, population: pop, trafficScale: 3.5 });
  const unique = (label) => {
    const seen = new Map();
    for (const a of sim.agents) seen.set(a.id, (seen.get(a.id) || 0) + 1);
    const dup = [...seen].filter(([, n]) => n > 1);
    assert.equal(dup.length, 0, `${label}: ${dup.slice(0, 3).map(([id, n]) => id + ' x' + n).join(', ')}`);
    for (const a of sim.agents) if (a.person < 0) assert.ok(!sim.personIds.has(a.id), `${label}: a resident drawn as through traffic`);
  };
  let t = atPacific(2026, 11, 24, 8, 0);
  sim.reset(t);
  unique('reset');
  // the arrival lists of an entry: no two arrivals at one instant, and the count near the rate
  const en = sim.entries.reduce((b, e) => (e.perHour > b.perHour ? e : b));
  const minute = Math.floor(t / 60000);
  let total = 0, expect = 0;
  for (let m = minute - 30; m < minute + 30; m++) {
    const list = en.arr.minute(m);
    for (let i = 1; i < list.length; i++) assert.ok(list[i] > list[i - 1]);
    total += list.length; expect += sim._rate(en, m * 60000 + 30000) * 60;
  }
  assert.ok(Math.abs(total - expect) < 4 * Math.sqrt(expect) + 3, `${total} arrivals for ${expect.toFixed(0)} expected`);
  for (let i = 0; i < 1500; i++) sim.step();
  unique('stepping');
  // a fast clock: thirty seconds a frame; each jump places a bounded number of new arrivals
  let most = 0;
  t = sim.t;
  for (let f = 0; f < 40; f++) { const s0 = sim.stats0.spawned; t += 30000; sim.advance(t, { maxSteps: 4 }); most = Math.max(most, sim.stats0.spawned - s0); }
  unique('jumping');
  assert.ok(most < 450, `${most} placed in one jump`);
  // shoppers in a store when the clock is set back come out of nowhere no more
  sim.reset(atPacific(2026, 11, 24, 12, 0));
  for (let i = 0; i < 3000; i++) sim.step();
  assert.ok(sim._pendingReturns.length > 20, 'shoppers in the stores');
  const t7 = atPacific(2026, 11, 24, 7, 0);
  sim.advance(t7);
  // noon's shoppers (back out at 12:20 and later) are gone; whoever is in a store now came in this morning
  assert.ok(sim._pendingReturns.every(x => x.t > t7 && x.t < t7 + 65 * 60000), 'only shoppers of the new hour');
  for (const x of sim._pendingReturns) assert.ok(sim.shoppers.has(x.prev.id));
  assert.equal(sim.shoppers.size, new Set(sim._pendingReturns.map(x => x.prev.id)).size);
  sim.advance(atPacific(2026, 11, 24, 8, 30));
  sim.step();
  const leaving = sim.agents.filter(a => a.role === 'visitor' && a.kind === 'car' && a.phase === 'exit').length;
  assert.ok(leaving < 15, `${leaving} shoppers pulling out at once`);
  unique('after resets');
  checkSim(sim);
});

test('parking: a car leaves from where it was parked, at home or in a stall where its driver went', () => {
  const sim = new StreetSim(sceneOf('94110'), { world, population: pop });
  sim.reset(atPacific(2026, 11, 24, 11, 0));
  const p = sim.persons.find(q => q.role === 'resident' && q.veh >= 0 && q.spot >= 0 && !q.agent);
  const shop = sim.shops.find(b => Math.hypot(b.cx - sim.scene.buildings[p.b].cx, b.cy - sim.scene.buildings[p.b].cy) > 200 && sim._freeSpotNear(b));
  assert.ok(p && shop, 'a driver at home and a store with a free stall');
  // the driver arrives at the store and parks
  const arrive = sim.router.path('car', { node: sim.carExits[0] }, { e: shop.access.e, s: shop.access.s });
  const a = sim._newAgent({ kind: 'car', role: 'resident', id: p.id, person: p.pid, path: arrive, trip: { path: arrive, t0: sim.t, vNom: 10, oIn: false, dIn: true, toB: shop, exitDur: 7, enterDur: 7, dur: 60 }, lookH: sim._carLookId(p), len: 4.7 });
  p.agent = a;
  sim._toEnd(a); a.phase = 'enter'; sim._beginEnter(a); a.pu = 1;
  const stall = a.toSpot;
  assert.ok(stall >= 0 && sim.spotCar[stall] === -2, 'a stall reserved');
  sim._move(a, 0.2);
  sim._finish(a, sim.agents.indexOf(a));
  assert.equal(sim.spotCar[stall], sim._carLookId(p), 'parked in the stall');
  assert.equal(p.awaySpot, stall);
  // the next trip from the store starts from that stall (not from the space at home) and empties it
  const home = sim.scene.buildings[p.b];
  const back = sim.router.path('car', { e: shop.access.e, s: shop.access.s }, { e: home.access.e, s: home.access.s });
  const b = sim._newAgent({ kind: 'car', role: 'resident', id: p.id, person: p.pid, path: back, trip: { path: back, t0: sim.t, vNom: 10, oIn: true, dIn: true, fromB: shop, toB: home, exitDur: 7, enterDur: 7, dur: 60 }, len: 4.7 });
  sim._beginExit(b, p, b.trip);
  const sp = sim.scene.spots[stall];
  assert.ok(Math.hypot(b.from.x - sp.x, b.from.y - sp.y) < 1e-6, 'pulls out of the stall');
  assert.equal(sim.spotCar[stall], -1);
  assert.equal(p.awaySpot, -1);
});

test('performance: a step with two thousand agents fits a frame', () => {
  // Nob Hill at the morning rush with six times the data-calibrated through traffic and every in-commuter
  const sim = new StreetSim(sceneOf('94109'), { world, population: pop, trafficScale: 6 });
  sim.reset(atPacific(2026, 11, 24, 7, 50));
  sim.scanCommuters(Infinity);
  for (let i = 0; i < 3000 && sim.agents.length < 2000; i++) sim.step();
  assert.ok(sim.agents.length >= 2000, `agents ${sim.agents.length}`);
  const t = performance.now();
  for (let i = 0; i < 100; i++) sim.step();
  const ms = (performance.now() - t) / 100;
  assert.ok(ms < 8, `step ${ms.toFixed(2)} ms with ${sim.agents.length} agents`);
  checkSim(sim);
});

test('chatter: residents passing each other trade lines through bark, rate-limited', () => {
  const sim = new StreetSim(sceneOf('94110'), { world, population: pop });
  sim.reset(atPacific(2026, 11, 24, 12, 0));
  const walkers = sim.agents.filter(a => a.kind === 'walk' && a.role === 'resident' && a.phase === 'route');
  assert.ok(walkers.length >= 2);
  // put two of them side by side
  const [a, b] = walkers;
  sim.pose(a); b.phase = 'wander'; b.x = a.x + 1; b.y = a.y; b.until = sim.t + 600000; b.park = -1;
  const lines = [];
  const bark = (ida, idb, ctx) => { lines.push([ida, idb, ctx]); return { text: 'Cold one today, huh?', gloss: null }; };
  const first = sim.chatter(1000, bark, { minGapMs: 1500 });
  assert.ok(first, 'a pair talked');
  assert.equal(lines.length, 1);
  assert.equal(lines[0][2].kind, 'passing');
  assert.ok(sim.bubbles.length >= 1 && (a.bubble || b.bubble));
  assert.equal(sim.chatter(1200, bark, { minGapMs: 1500 }), null, 'rate limited');
  const again = sim.chatter(5000, bark, { minGapMs: 1500 });
  const pair = r => [r.a, r.b].sort().join('|');
  assert.ok(again === null || pair(again) !== pair(first), 'the same two do not repeat');
});

// ---------------------------------------------------------------- light and weather

test('sun and light: solar position, day and night', () => {
  const sf = { lat: 37.75, lon: -122.42 };
  const noonJune = sunPosition(Date.parse('2026-06-21T20:10:00Z'), sf.lat, sf.lon);
  assert.ok(noonJune.elevation > 70 && noonJune.elevation < 78, `June noon ${noonJune.elevation}`);
  assert.ok(Math.abs(noonJune.azimuth - 180) < 15);
  const midnight = sunPosition(Date.parse('2026-11-24T08:00:00Z'), sf.lat, sf.lon);
  assert.ok(midnight.elevation < -40);
  // sunrise in San Francisco on Nov 24 is a little after 7:00 a.m.
  const before = sunPosition(atPacific(2026, 11, 24, 6, 50), sf.lat, sf.lon).elevation, after = sunPosition(atPacific(2026, 11, 24, 7, 20), sf.lat, sf.lon).elevation;
  assert.ok(before < 0 && after > 0, `${before} ${after}`);
  assert.equal(lightAt(atPacific(2026, 11, 24, 12, 0), sf.lat, sf.lon).night, 0);
  assert.equal(lightAt(atPacific(2026, 11, 24, 22, 0), 33.97, -118.25).night, 1);
});

test('weather effects read the NWS words: rain, fog, smoke from fire weather', () => {
  assert.ok(weatherEffects({ now: { short: 'Rain Showers Likely', pop: 70 } }).rain > 0.5);
  assert.ok(weatherEffects({ now: { short: 'Patchy Fog' } }).fog > 0.3);
  assert.equal(weatherEffects({ now: { short: 'Sunny' } }).rain, 0);
  assert.ok(weatherEffects({ now: { short: 'Sunny' }, fireWeather: { level: 2 } }).smoke > 0.4);
  assert.ok(weatherEffects({ now: { short: 'Light Snow' } }).snow > 0);
  const wx = world.weatherAt(world.indexOf('94110'), atPacific(2026, 11, 24, 8, 0));
  const fx = weatherEffects(wx);
  for (const k of ['rain', 'snow', 'fog', 'cloud', 'smoke']) assert.ok(fx[k] >= 0 && fx[k] <= 1, k);
});

// ---------------------------------------------------------------- OpenStreetMap

function osmFixture(frame) {
  // a 3x3 street grid (shared node ids at the crossings), a freeway bridge over it with no shared nodes, buildings
  const toLL = (x, y) => { const w = frame.toWorld(x, y); return world.unproject(w.x, w.y); };
  const nid = (i, j) => 1000 + i * 10 + j;
  const els = [];
  let wid = 1;
  for (let i = 0; i < 3; i++) {
    const g = [], n = [];
    for (let j = 0; j < 3; j++) { const ll = toLL(-150 + j * 150, -150 + i * 150); g.push({ lat: ll.lat, lon: ll.lon }); n.push(nid(i, j)); }
    els.push({ type: 'way', id: wid++, tags: { highway: i === 1 ? 'primary' : 'residential', name: `Row ${i}`, lanes: i === 1 ? '4' : undefined }, geometry: g, nodes: n });
  }
  for (let j = 0; j < 3; j++) {
    const g = [], n = [];
    for (let i = 0; i < 3; i++) { const ll = toLL(-150 + j * 150, -150 + i * 150); g.push({ lat: ll.lat, lon: ll.lon }); n.push(nid(i, j)); }
    els.push({ type: 'way', id: wid++, tags: { highway: 'residential', name: `Col ${j}`, oneway: j === 2 ? 'yes' : undefined }, geometry: g, nodes: n });
  }
  // the bridge runs diagonally across the whole view and beyond it
  const b0 = toLL(-900, -40), b1 = toLL(900, 40);
  els.push({ type: 'way', id: wid++, tags: { highway: 'motorway', name: 'Bayshore Freeway', bridge: 'yes', layer: '1' }, geometry: [{ lat: b0.lat, lon: b0.lon }, { lat: b1.lat, lon: b1.lon }], nodes: [9001, 9002] });
  for (let k = 0; k < 6; k++) {
    const cx = -110 + k * 40, cy = -110;
    const ring = [[cx - 6, cy - 7], [cx + 6, cy - 7], [cx + 6, cy + 7], [cx - 6, cy + 7], [cx - 6, cy - 7]].map(([x, y]) => toLL(x, y));
    els.push({ type: 'way', id: 5000 + k, tags: { building: k === 5 ? 'apartments' : 'house' }, geometry: ring.map(p => ({ lat: p.lat, lon: p.lon })) });
  }
  return els;
}

test('OpenStreetMap: ways become a graph at shared nodes (the bridge does not cross-connect), buildings are classified', () => {
  const [x, y] = at('94110');
  const ctx = sceneContext(world, pop, x, y);
  const els = osmFixture(ctx.frame);
  const { net, buildings } = parseOSM(els, world, ctx.frame, ctx.R);
  assert.ok(net && buildings.length === 6);
  const surface = net.edges.filter(e => !e.freeway);
  // 3 rows and 3 columns split at the 9 crossings: 12 edges between crossings
  assert.equal(surface.length, 12);
  const free = net.edges.filter(e => e.freeway);
  assert.equal(free.length, 1, 'the bridge is one edge, joined to nothing in the grid');
  for (const n of net.nodes) if (n.adj.some(a => net.edges[a.e].freeway)) assert.ok(n.adj.every(a => net.edges[a.e].freeway));
  const row1 = net.edges.find(e => e.name === 'Row 1');
  assert.equal(row1.cls, 'arterial'); assert.equal(row1.lanesF, 2);
  assert.equal(net.edges.find(e => e.name === 'Col 2').oneway, true);
  assert.equal(wayClass({ highway: 'service', service: 'driveway' }), null);
  assert.equal(wayClass({ highway: 'footway' }).cls, 'path');
  // a whole scene on these ways: households go into the real buildings
  const sc = buildScene(world, pop, x, y, { osmElements: els });
  assert.equal(sc.source, 'osm');
  assert.ok(sc.buildings.every(b => b.osm));
  assert.ok(sc.households.filter(Boolean).every(h => sc.buildings[h.b].osm));
  // unusable data falls back to the procedural streets
  const fallback = buildScene(world, pop, x, y, { osmElements: els.slice(0, 1) });
  assert.equal(fallback.source, 'procedural');
  assert.match(overpassQuery(37.7, -122.5, 37.8, -122.4), /way\["highway"\]\(37\.700000,-122\.500000,37\.800000,-122\.400000\);way\["building"\]/);
});

test('OpenStreetMap: the query asks for node ids; a response without them still joins the ways where they share a vertex', async () => {
  assert.match(overpassQuery(37.7, -122.5, 37.8, -122.4), /out body geom;$/);
  assert.ok(!/out geom tags/.test(overpassQuery(37.7, -122.5, 37.8, -122.4)), 'the tags verbosity drops node ids');
  const [x, y] = at('94110');
  const ctx = sceneContext(world, pop, x, y);
  const stripped = osmFixture(ctx.frame).map(el => { const c = Object.assign({}, el); delete c.nodes; return c; });
  const { net } = parseOSM(stripped, world, ctx.frame, ctx.R);
  assert.equal(net.edges.filter(e => !e.freeway).length, 12, 'the grid joins at its crossings');
  assert.equal(components(net, e => !e.freeway).count, 1);
  for (const n of net.nodes) if (n.adj.some(a => net.edges[a.e].freeway)) assert.ok(n.adj.every(a => net.edges[a.e].freeway), 'the bridge still joins nothing');
  assert.equal(buildScene(world, pop, x, y, { osmElements: stripped }).source, 'osm');
  // a fetch answered in that shape goes through to OSM streets; the cache is the v2 one and the old tiles are gone
  clearMemoryCache();
  const store = new Map([['legion.osm.v1.3774_-12242', '{"t":1,"w":[]}']]);
  const fake = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: k => store.delete(k), key: i => [...store.keys()][i] ?? null, get length() { return store.size; } };
  let body = '';
  const fetchImpl = async (url, init) => { body = decodeURIComponent(init.body); return { ok: true, json: async () => ({ elements: stripped }) }; };
  const r = await fetchOSM(world, new Frame(world, x, y), 600, { fetchImpl, store: fake });
  assert.ok(r && r.elements.length === stripped.length && !r.cached);
  assert.match(body, /out body geom;/);
  assert.ok([...store.keys()].some(k => k.startsWith(STORE_PREFIX)) && STORE_PREFIX === 'legion.osm.v2.');
  assert.ok(![...store.keys()].some(k => k.startsWith('legion.osm.v1.')), 'v1 tiles (no node ids) are dropped');
  assert.equal(buildScene(world, pop, x, y, { osmElements: r.elements }).source, 'osm');
  clearMemoryCache();
});

test('OpenStreetMap cache: tiles round-trip through storage, a full storage never throws', () => {
  clearMemoryCache();
  const store = new Map();
  const fake = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: k => store.delete(k), key: i => [...store.keys()][i] ?? null, get length() { return store.size; } };
  const [x, y] = at('94110');
  const frame = new Frame(world, x, y);
  const els = osmFixture(frame);
  const keys = tilesFor(viewBox(world, frame, 600));
  assert.ok(keys.length >= 1);
  writeCache(els, keys, fake);
  assert.ok(store.size >= 1);
  clearMemoryCache();
  const back = readCache(keys, fake);
  assert.ok(back && back.length === els.length, `${back && back.length}`);
  const way = back.find(e => e.id === 1);
  assert.deepEqual(way.nodes, els[0].nodes);
  assert.ok(Math.abs(way.geometry[1].lat - els[0].geometry[1].lat) < 2e-6);
  // a storage that refuses everything: no exception, memory still serves
  clearMemoryCache();
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {}, key: () => null, length: 0 };
  writeCache(els, keys, full);
  assert.ok(readCache(keys, full));
  clearMemoryCache();
});

test('geometry helpers: clipping to the view square keeps cut flags', () => {
  const pieces = clipToSquare(Float64Array.from([-200, 0, 0, 0, 200, 0]), 100);
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].startCut, true); assert.equal(pieces[0].endCut, true);
  assert.deepEqual([...pieces[0].pts].map(v => Math.round(v)), [-100, 0, 0, 0, 100, 0]);
  const net = finishNet(Object.assign(new StreetNet(100), {}));
  assert.equal(net.edges.length, 0);
});
