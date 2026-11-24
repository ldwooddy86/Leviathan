// Tests for src/world/crowd-build.mjs (and the map's triangulator): run with `node --test tests/crowd-build.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Population, LEGION_SEED } from '../src/engine/population.mjs';
import { atPacific } from '../src/engine/clock.mjs';
import {
  buildAgents, buildRoadNet, planHighway, roadAt, agentPosition, agentPhase, agentGLSL, countStates, pickNearest,
  decodeId, commuteTiming, modeCode, simTime, rushFactor, errTravel, newPhase, lodValue, zipOrder,
  MODES, MODE_KIND, KINDS, STATES, CROWD, AGENT_BYTES, NO_DEPART, STUDENT_BIT,
  K_DRIVE, K_WALK, K_ERRAND, K_HOME, S_HOME, S_OUT, S_WORK, S_BACK, S_EOUT, S_EAT, S_EBACK,
} from '../src/world/crowd-build.mjs';
import { triangulate, buildFill, cleanRing } from '../src/world/map.mjs';

const world = await loadDefaultWorld();
const pop = new Population(world, { seed: LEGION_SEED });
const net = buildRoadNet(world);
const REGION = world.zipsOfRegion('sd');
const RATE = 0.02, SEED = 7;
const A = buildAgents(world, pop, { rate: RATE, seed: SEED, zips: REGION, roadNet: net });
const W = world.proj.W, H = world.proj.H, uk = world.unitKm;
const homeOf = (c, i) => [c.home[2 * i] / 65535 * W, c.home[2 * i + 1] / 65535 * H];
const destOf = (c, i) => [c.dest[2 * i] / 65535 * W, c.dest[2 * i + 1] / 65535 * H];
const ARRAYS = ['home', 'dest', 'timing', 'days', 'mode', 'route', 'errand', 'eoff', 'ids'];
const TUESDAY = (h, m = 0) => simTime(atPacific(2026, 11, 24, h, m));
const memberOf = (core, m) => core.members.find((x, k) => (x.m == null ? k : x.m) === m);

/** A one-agent chunk for hand-built cases (home and dest in units). */
function oneAgent({ home = [2000, 3000], dest = [2040, 3030], dep = 480, com = 30, dwl = 480, days = 0b0111110, mode = 'walk', route = [0, 0, 0], errand = 0, eoff = [0, 0] }) {
  const q = (v, e) => Math.round(v / e * 65535);
  return {
    count: 1, start: 0, W, H, unitKm: uk,
    home: Uint16Array.of(q(home[0], W), q(home[1], H)), dest: Uint16Array.of(q(dest[0], W), q(dest[1], H)),
    timing: Uint16Array.of(dep, com, dwl), days: Uint8Array.of(days), mode: Uint8Array.of(modeCode(mode)),
    route: Uint16Array.from(route), errand: Uint32Array.of(errand), eoff: Int8Array.from(eoff), ids: Uint32Array.of(0), overflow: new Uint32Array(0),
  };
}

test('a region at a given rate builds the same agents every time, and chunked builds match the single build', () => {
  assert.ok(A.count > 20000, `agents ${A.count}`);
  const B = buildAgents(world, pop, { rate: RATE, seed: SEED, zips: REGION, roadNet: buildRoadNet(world) });
  for (const k of ARRAYS) assert.deepEqual(B[k], A[k], k);
  const parts = [];
  buildAgents(world, pop, { rate: RATE, seed: SEED, zips: REGION, roadNet: net, chunkTarget: 5000, onChunk: c => parts.push(c) });
  assert.ok(parts.length > 3, 'several chunks');
  let start = 0;
  for (const c of parts) { assert.equal(c.start, start); start += c.count; }
  for (const k of ARRAYS) {
    const total = parts.reduce((n, c) => n + c[k].length, 0), cat = new A[k].constructor(total);
    let o = 0;
    for (const c of parts) { cat.set(c[k], o); o += c[k].length; }
    assert.deepEqual(cat, A[k], k);
  }
  // another seed changes the crowd's own choices (errands, lanes) but not who is in it or how they commute
  const C = buildAgents(world, pop, { rate: RATE, seed: SEED + 1, zips: REGION, roadNet: net });
  assert.deepEqual(C.ids, A.ids); assert.deepEqual(C.timing, A.timing); assert.deepEqual(C.mode, A.mode);
  assert.notDeepEqual(C.errand, A.errand);
});

test('the record is 32 bytes per agent and the summary adds up', () => {
  const bytes = ARRAYS.reduce((n, k) => n + A[k].byteLength, 0);
  assert.equal(bytes / A.count, AGENT_BYTES);
  assert.equal(AGENT_BYTES, 32);
  const s = A.summary;
  assert.equal(s.agents, A.count);
  assert.equal(Object.values(s.byMode).reduce((a, b) => a + b, 0), A.count);
  assert.equal(Object.values(s.byKind).reduce((a, b) => a + b, 0), A.count);
  assert.ok(s.highway > 0 && s.highway < s.commuters && s.errands > 0);
  assert.equal(s.overflow, A.overflow.length / 3);
});

test('ids decode to valid people whose householdCore matches the stored mode and timing', () => {
  const seen = new Set();
  let checked = 0;
  for (let i = 0; i < A.count; i += 3) {
    const d = decodeId(A, i, world);
    assert.match(d.id, /^\d{5}-\d+-\d+$/);
    assert.ok(REGION.includes(d.zi), 'ZIP in the region');
    assert.ok(d.h < pop.householdCount(d.zi));
    assert.ok(pop.includes(d.zi, d.h, RATE), 'the household is in the sample');
    const core = pop.householdCore(d.zi, d.h), mem = memberOf(core, d.m);
    assert.ok(mem, `member ${d.id}`);
    assert.equal(A.mode[i] & 15, modeCode(mem.mode), d.id);
    assert.deepEqual([A.timing[3 * i], A.timing[3 * i + 1], A.timing[3 * i + 2]], commuteTiming(mem), d.id);
    assert.equal((A.mode[i] & STUDENT_BIT) !== 0, !!(mem.student && mem.work));
    if (A.days[i]) {
      assert.equal(A.days[i], mem.days & 127);
      assert.ok(mem.work && mem.departMin != null && MODE_KIND[modeCode(mem.mode)] >= 0);
      const [dx, dy] = destOf(A, i);
      assert.ok(Math.abs(dx - mem.work.x) < 0.1 && Math.abs(dy - mem.work.y) < 0.1, 'destination is the workplace or school');
    }
    const [hx, hy] = homeOf(A, i);
    assert.ok(Math.abs(hx - core.home.x) < 0.1 && Math.abs(hy - core.home.y) < 0.1, 'home within the fixed-point step');
    assert.ok(!seen.has(d.id)); seen.add(d.id);
    checked++;
  }
  assert.ok(checked > 5000);
  // commuteTiming keeps a commute day shorter than a day and marks "never departs"
  assert.deepEqual(commuteTiming({ departMin: null, commuteMin: 0, dwellMin: 0 }), [NO_DEPART, 0, 0]);
  assert.deepEqual(commuteTiming({ departMin: 1500, commuteMin: 400, dwellMin: 900 }), [60, 360, 710]);
});

test('every member of a sampled household is an agent, and nothing else is', () => {
  const byHousehold = new Map();
  for (let i = 0; i < A.count; i++) { const d = decodeId(A, i, world); const k = `${d.zi}:${d.h}`; byHousehold.set(k, (byHousehold.get(k) || 0) + 1); }
  let households = 0;
  for (const zi of REGION.slice(0, 40)) {
    for (let h = 0; h < pop.householdCount(zi); h++) {
      const inSample = pop.includes(zi, h, RATE);
      assert.equal(byHousehold.get(`${zi}:${h}`) || 0, inSample ? pop.householdSize(zi, h) : 0);
      if (inSample) households++;
    }
  }
  assert.ok(households > 50);
});

test('homes lie inside their ZIP (world.zipAt), exactly as the unquantized homes do', () => {
  let inside = 0;
  for (let i = 0; i < A.count; i++) {
    const d = decodeId(A, i, world), [x, y] = homeOf(A, i);
    if (world.zipAt(x, y) === d.zi) inside++;
  }
  assert.ok(inside / A.count > 0.995, `${inside}/${A.count}`);
  for (let i = 0; i < A.count; i += 97) {
    const d = decodeId(A, i, world), core = pop.householdCore(d.zi, d.h), [x, y] = homeOf(A, i);
    assert.equal(world.zipAt(x, y), world.zipAt(core.home.x, core.home.y));
  }
});

test('long drives take a highway leg whose arc lengths lie within the polyline', () => {
  let legs = 0, long = 0, longWithLeg = 0;
  const ra = { x: 0, y: 0, dx: 0, dy: 0, k: 0 }, rb = { ...ra };
  for (let i = 0; i < A.count; i++) {
    const line = A.route[3 * i];
    const [hx, hy] = homeOf(A, i), [dx, dy] = destOf(A, i);
    const km = world.distKm(hx, hy, dx, dy), drive = A.days[i] && MODE_KIND[A.mode[i] & 15] === K_DRIVE;
    if (drive && km > 25) { long++; if (line) longWithLeg++; }
    if (!line) continue;
    legs++;
    assert.ok(drive, 'only drivers take the freeway');
    assert.ok(Math.hypot(dx - hx, dy - hy) * uk >= CROWD.highwayMinKm - 1e-9, 'only trips over the minimum');
    const l = line - 1, L = net.lines[4 * l + 2];
    assert.ok(l < net.L && L > 0);
    const s0 = A.route[3 * i + 1] / 65535 * L, s1 = A.route[3 * i + 2] / 65535 * L;
    assert.ok(s0 >= 0 && s0 <= L && s1 >= 0 && s1 <= L && s0 !== s1, 'arc lengths within the polyline');
    roadAt(net, l, s0, ra); roadAt(net, l, s1, rb);
    const rampMax = CROWD.rampMaxKm / uk + 0.5;
    assert.ok(Math.hypot(ra.x - hx, ra.y - hy) <= rampMax && Math.hypot(rb.x - dx, rb.y - dy) <= rampMax, 'ramps near both ends');
  }
  assert.ok(legs > 1000, `legs ${legs}`);
  assert.ok(longWithLeg / long > 0.6, `${longWithLeg}/${long} long drives on a freeway`);
  // the planner itself: a San Diego to Los Angeles drive rides I-5 most of the way; a short hop takes none
  const sd = world.project(32.72, -117.16), la = world.project(34.05, -118.24);
  const leg = planHighway(net, sd.x, sd.y, la.x, la.y);
  assert.ok(leg && net.info[leg.line].name === 'I-5', leg && net.info[leg.line].name);
  assert.ok(Math.abs(leg.s1 - leg.s0) * uk > 150, 'most of the 180 km on the freeway');
  assert.equal(planHighway(net, sd.x, sd.y, sd.x + 10, sd.y + 10), null);
});

test('rush hour shows: Tuesday 8:00 against 3:00, and the evening return', () => {
  const am = TUESDAY(8), night = TUESDAY(3), pm = TUESDAY(17, 30);
  const s8 = countStates([A], am.minute, am.dow), s3 = countStates([A], night.minute, night.dow), s17 = countStates([A], pm.minute, pm.dow);
  for (const s of [s8, s3, s17]) assert.equal(s.atHome + s.atWork + s.atErrand + s.movingTotal, A.count);
  assert.ok(s8.movingTotal > 0.05 * A.count, `moving at 8:00 ${s8.movingTotal}`);
  assert.ok(s8.movingTotal > 5 * Math.max(1, s3.movingTotal), `8:00 ${s8.movingTotal} vs 3:00 ${s3.movingTotal}`);
  assert.ok(s8.moving.drive > 5 * Math.max(1, s3.moving.drive));
  assert.ok(s8.toWork > s8.toHome, 'mornings head out');
  assert.ok(s17.toHome > s17.toWork, 'evenings head home');
  assert.ok(s8.atHome < s3.atHome && s3.atHome > 0.9 * A.count);
  // weekends: far fewer commuters, errands instead
  const sat = simTime(atPacific(2026, 11, 28, 12, 0)), ss = countStates([A], sat.minute, sat.dow);
  assert.ok(ss.moving.errand > 0 && ss.toWork < s8.toWork / 3);
});

test('the position function matches the expected point at trip midpoints, on separate sides each way', () => {
  const P = newPhase(), o = { state: 0, kind: 0, x: 0, y: 0 }, o2 = { ...o };
  let straight = 0, highway = 0;
  for (let i = 0; i < A.count && (straight < 400 || highway < 200); i++) {
    if (!A.days[i]) continue;
    const dep = A.timing[3 * i], com = A.timing[3 * i + 1], dwl = A.timing[3 * i + 2];
    let dow = 0; while (!((A.days[i] >> dow) & 1)) dow++;
    const day = (m, d) => (m >= 1440 ? [m - 1440, (d + 1) % 7] : [m, d]);
    const [mOut, dOut] = day(dep + com / 2, dow), [mBack, dBack] = day(dep + com + dwl + com / 2, dow), [mWork, dWork] = day(dep + com + dwl / 2, dow);
    agentPosition(A, i, mWork, dWork, net, o);
    assert.equal(o.state, S_WORK); assert.equal(o.kind, -1);
    const [hx, hy] = homeOf(A, i), [dx, dy] = destOf(A, i);
    assert.ok(Math.abs(o.x - dx) < 1e-9 && Math.abs(o.y - dy) < 1e-9, 'at work = at the destination');
    agentPosition(A, i, mOut, dOut, net, o);
    agentPosition(A, i, mBack, dBack, net, o2);
    assert.equal(o.state, S_OUT); assert.equal(o2.state, S_BACK);
    const jit = A.errand[i] >>> 26, lane = (jit & 7) / 7, cv = ((jit >> 3) & 7) / 7 * 2 - 1;
    const kind = MODE_KIND[A.mode[i] & 15];
    const laneOff = kind === K_DRIVE ? CROWD.laneDrive0 + CROWD.laneDrive1 * lane : CROWD.laneOther0 + CROWD.laneOther1 * lane;
    assert.equal(o.kind, kind < 0 ? K_WALK : kind);
    if (!A.route[3 * i]) {
      // quadratic Bezier at t = 0.5: the chord's midpoint pushed out by half the control offset, plus the lane
      const vx = dx - hx, vy = dy - hy, len = Math.hypot(vx, vy);
      if (len < 1e-6) continue;
      const k = 0.5 * cv * CROWD.curve;
      const ex = (hx + dx) / 2 - vy * (k + laneOff / len), ey = (hy + dy) / 2 + vx * (k + laneOff / len);
      assert.ok(Math.hypot(o.x - ex, o.y - ey) < 1e-6, `outbound midpoint ${i}`);
      const bx = (hx + dx) / 2 - vy * (k - laneOff / len), by = (hy + dy) / 2 + vx * (k - laneOff / len);
      assert.ok(Math.hypot(o2.x - bx, o2.y - by) < 1e-6, `return midpoint ${i}`);
      assert.ok(Math.abs(Math.hypot(o.x - o2.x, o.y - o2.y) - 2 * laneOff) < 1e-6, 'the two directions keep two lane offsets apart');
      straight++;
    } else {
      // a freeway driver mid-trip is on the polyline (or on a ramp leg) within one lane offset
      const l = A.route[3 * i] - 1, L = net.lines[4 * l + 2];
      const s0 = A.route[3 * i + 1] / 65535 * L, s1 = A.route[3 * i + 2] / 65535 * L;
      const a = roadAt(net, l, s0, { x: 0, y: 0, dx: 0, dy: 0, k: 0 }), b = roadAt(net, l, s1, { x: 0, y: 0, dx: 0, dy: 0, k: 0 });
      const segs = [[hx, hy, a.x, a.y], [b.x, b.y, dx, dy]];
      const lo = Math.min(a.k, b.k), hi = Math.max(a.k, b.k) + 1;
      for (let k = lo; k < hi; k++) segs.push([net.verts[4 * k], net.verts[4 * k + 1], net.verts[4 * k + 4], net.verts[4 * k + 5]]);
      const dist = (px, py) => Math.min(...segs.map(([x0, y0, x1, y1]) => {
        const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / l2)) : 0;
        return Math.hypot(px - x0 - vx * t, py - y0 - vy * t);
      }));
      assert.ok(dist(o.x, o.y) <= laneOff + 1e-6 && dist(o2.x, o2.y) <= laneOff + 1e-6, `on the route ${i}`);
      highway++;
    }
  }
  assert.ok(straight >= 400 && highway >= 200, `${straight} straight, ${highway} highway`);
});

test('a freeway trip spends its time by distance and speed, slower in rush hour', () => {
  const sd = world.project(32.72, -117.16), la = world.project(34.05, -118.24);
  const leg = planHighway(net, sd.x, sd.y, la.x, la.y), L = net.lines[4 * leg.line + 2];
  const route = [leg.line + 1, Math.round(leg.s0 / L * 65535), Math.round(leg.s1 / L * 65535)];
  const progressAt = (dep, u) => {
    const c = oneAgent({ home: [sd.x, sd.y], dest: [la.x, la.y], dep, com: 120, dwl: 300, days: 0b0111110, mode: 'drive', route });
    const o = agentPosition(c, 0, dep + u, 2, net);
    assert.equal(o.state, S_OUT);
    return o;
  };
  // the same moment of a 2-hour drive is farther along at 11:00 than in the 7:45 rush (streets take a larger share)
  const rush = progressAt(465, 60), free = progressAt(660, 60);
  const along = p => Math.hypot(p.x - sd.x, p.y - sd.y);
  assert.ok(rushFactor(465, 2) < 0.6 && rushFactor(660, 2) > 0.9 && rushFactor(465, 0) > 0.95);
  assert.ok(along(rush) < along(free), 'rush hour slows the freeway leg');
  // and the trip starts at home and ends at the destination
  const c = oneAgent({ home: [sd.x, sd.y], dest: [la.x, la.y], dep: 600, com: 120, dwl: 300, mode: 'drive', route });
  const start = agentPosition(c, 0, 600, 2, net), end = agentPosition(c, 0, 600 + 119.999, 2, net);
  assert.ok(Math.hypot(start.x - sd.x, start.y - sd.y) < 0.5 && Math.hypot(end.x - la.x, end.y - la.y) < 0.6);
});

test('trips that cross midnight wrap into the next day', () => {
  // a Monday night shift: leaves 23:20, an hour's drive, 6 hours at work (00:20-6:20 Tuesday), home by 7:20
  const c = oneAgent({ dep: 1400, com: 60, dwl: 360, days: 1 << 1, mode: 'drive' });
  const at = (m, dow) => agentPhase(c, 0, m, dow, newPhase());
  assert.equal(at(1390, 1), S_HOME);
  assert.equal(at(1430, 1), S_OUT);
  assert.equal(at(10, 2), S_OUT);
  assert.equal(at(25, 2), S_WORK);
  assert.equal(at(375, 2), S_WORK);
  assert.equal(at(390, 2), S_BACK);
  assert.equal(at(435, 2), S_BACK);
  assert.equal(at(445, 2), S_HOME);
  assert.equal(at(10, 3), S_HOME, 'no shift Tuesday night');
  const P = newPhase();
  agentPhase(c, 0, 10, 2, P);
  assert.equal(P.u, 50, 'fifty minutes into the drive at 00:10');
  assert.equal(P.day, 1, 'the trip belongs to Monday');
});

test('errands: near home, on land, inside the day, and never during the commute', () => {
  const P = newPhase();
  let n = 0;
  for (let i = 0; i < A.count; i++) {
    const e = A.errand[i], eDays = (e >>> 18) & 127;
    if (!eDays) continue;
    n++;
    const [hx, hy] = homeOf(A, i), ex = hx + A.eoff[2 * i] * 0.25, ey = hy + A.eoff[2 * i + 1] * 0.25;
    assert.ok(world.zipAt(ex, ey) >= 0, 'errand point on land');
    assert.ok(Math.hypot(ex - hx, ey - hy) * uk < 6.5, 'within a few km');
    const start = e & 2047, dwell = ((e >>> 11) & 127) * 2, tt = errTravel(A.eoff[2 * i] * 0.25, A.eoff[2 * i + 1] * 0.25, (e >>> 25) & 1, uk);
    assert.ok(start + 2 * tt + dwell <= 1440, 'home before midnight');
    if (n % 7) continue;
    // at the errand's midpoint the person is out on it, unless a commute (theirs, from that day or the night before) claims the time
    for (let d = 0; d < 7; d++) {
      if (!((eDays >> d) & 1)) continue;
      const s = agentPhase(A, i, start + tt + dwell / 2, d, P);
      assert.ok(s === S_EAT || s === S_OUT || s === S_WORK || s === S_BACK, STATES[s]);
      if (A.days[i] && ((A.days[i] >> d) & 1)) {
        const dep = A.timing[3 * i], span = 2 * A.timing[3 * i + 1] + A.timing[3 * i + 2];
        assert.ok(start >= dep + span || start + 2 * tt + dwell <= dep, 'an errand on a commute day avoids the commute');
      }
    }
  }
  assert.ok(n > A.count * 0.4, `${n} errand plans`);
  const kids = [];
  for (let i = 0; i < A.count && kids.length < 50; i++) {
    const d = decodeId(A, i, world), mem = memberOf(pop.householdCore(d.zi, d.h), d.m);
    if (mem.age < 12) kids.push(i);
  }
  for (const i of kids) assert.equal((A.errand[i] >>> 18) & 127, 0, 'young children run no errands of their own');
});

test('errand trips move, then wait, then come back', () => {
  // start 10:00, dwell 30 min, Wednesdays, on foot, 1.5 units east
  const word = (600 | (15 << 11) | ((1 << 3) << 18) | (0 << 25) | (9 << 26)) >>> 0;
  const c = oneAgent({ days: 0, mode: null, errand: word, eoff: [6, 0] });
  const tt = errTravel(1.5, 0, 0, uk), P = newPhase(), o = { state: 0, kind: 0, x: 0, y: 0 };
  assert.equal(agentPhase(c, 0, 599, 3, P), S_HOME);
  assert.equal(agentPhase(c, 0, 600 + tt / 2, 3, P), S_EOUT);
  assert.equal(agentPhase(c, 0, 600 + tt + 15, 3, P), S_EAT);
  assert.equal(agentPhase(c, 0, 600 + 1.5 * tt + 30, 3, P), S_EBACK);
  assert.equal(agentPhase(c, 0, 600 + 2 * tt + 31, 3, P), S_HOME);
  assert.equal(agentPhase(c, 0, 600 + tt / 2, 4, P), S_HOME, 'not on Thursday');
  agentPosition(c, 0, 600 + tt / 2, 3, net, o);
  assert.equal(o.kind, K_ERRAND);
  const hx = c.home[0] / 65535 * W;
  assert.ok(o.x > hx + 0.5 && o.x < hx + 1.2, 'halfway along');
  agentPosition(c, 0, 900, 3, net, o);
  assert.equal(o.state, S_HOME); assert.equal(o.kind, K_HOME);
});

test('picking returns the nearest drawn agent with a valid id, and respects visibility', () => {
  const am = TUESDAY(8, 5), P = newPhase(), o = { state: 0, kind: 0, x: 0, y: 0 };
  A.start = 0;
  let tried = 0;
  for (let i = 0; i < A.count && tried < 60; i += 211) {
    const s = agentPhase(A, i, am.minute, am.dow, P);
    if (s !== S_OUT) continue;
    agentPosition(A, i, am.minute, am.dow, net, o);
    const hit = pickNearest([A], net, o.x, o.y, 0.5, am.minute, am.dow);
    assert.ok(hit, 'found');
    assert.ok(hit.dist < 1e-6, 'an agent exactly there');
    const d = decodeId(A, hit.i, world);
    assert.match(d.id, /^\d{5}-\d+-\d+$/);
    tried++;
  }
  assert.ok(tried > 20);
  // nobody is drawn at 3:00 unless the population layer (people at home) is on
  const night = TUESDAY(3), [hx, hy] = homeOf(A, 0);
  assert.equal(pickNearest([A], net, hx, hy, 0.5, night.minute, night.dow, { mask: 31 }), null);
  const home = pickNearest([A], net, hx, hy, 0.5, night.minute, night.dow, { mask: 63 });
  assert.ok(home && home.kind === K_HOME && home.dist < 1e-6);
  // a level-of-detail share hides the same agents the shader hides
  const keep = 0.3, all = pickNearest([A], net, hx, hy, 50, night.minute, night.dow, { mask: 63, keep });
  assert.ok(all && lodValue(all.chunk.start + all.i) < keep);
});

test('the GLSL twin is generated from the same constants and steps as the JS function', () => {
  const src = agentGLSL(net);
  for (const [name, v] of [['VS', CROWD.streetKmh], ['VH', CROWD.highwayKmh], ['DETOUR', CROWD.detour], ['LANE_D0', CROWD.laneDrive0], ['CURVE', CROWD.curve], ['ERR_CURVE', CROWD.errCurve]]) {
    assert.match(src, new RegExp(`const float ${name} = ${String(v).replace('.', '\\.')}(\\.0)?;`), name);
  }
  assert.match(src, new RegExp(`const float UNIT_KM = ${String(uk).replace('.', '\\.')};`));
  assert.match(src, /int agentEval\(vec2 home, vec2 dest, uvec3 tm, uint days, uint mode, uvec3 route, uint ew, vec2 eoff, float minute, int dow, out vec2 pos, out int kind\)/);
  assert.match(src, /tday = \(dow \+ 6\) % 7;/, 'yesterday wraps like the JS');
  assert.match(src, /bump\(m, 465\.0, 110\.0\)/, 'same rush hours as rushFactor');
  MODE_KIND.forEach((k, code) => { if (k >= 0) assert.ok(src.includes(`if (code == ${code}u) return ${k};`), `mode ${MODES[code]}`); });
  assert.ok(!/undefined|NaN/.test(src));
  assert.equal(net.texV.width * net.texV.height * 4, net.verts.length);
  assert.equal(net.texL.width * net.texL.height * 4, net.lines.length);
});

test('road network: cumulative arc lengths, and the binary search walks the polyline', () => {
  const r = { x: 0, y: 0, dx: 0, dy: 0, k: 0 };
  for (let l = 0; l < net.L; l += 7) {
    const off = net.lines[4 * l], cnt = net.lines[4 * l + 1], L = net.lines[4 * l + 2];
    assert.equal(net.verts[4 * off + 2], 0);
    for (let k = off + 1; k < off + cnt; k++) assert.ok(net.verts[4 * k + 2] > net.verts[4 * k - 2], 'strictly increasing');
    assert.equal(net.verts[4 * (off + cnt - 1) + 2], L);
    roadAt(net, l, L / 2, r);
    assert.ok(r.k >= off && r.k < off + cnt - 1 && Math.abs(Math.hypot(r.dx, r.dy) - 1) < 1e-6);
    roadAt(net, l, 0, r); assert.ok(Math.abs(r.x - net.verts[4 * off]) < 1e-3);
    roadAt(net, l, L, r); assert.ok(Math.abs(r.x - net.verts[4 * (off + cnt - 1)]) < 1e-3);
  }
  assert.ok(net.info.some(x => x.name === 'I-405') && net.info.some(x => x.name === 'SR 99'));
});

test('build order: by region, nearest to a focus first', () => {
  const all = zipOrder(world);
  assert.equal(all.length, world.N);
  assert.equal(new Set(all).size, world.N);
  const la = world.project(34.05, -118.24), ordered = zipOrder(world, { focus: la });
  assert.equal(world.z.region[ordered[0]], 'la');
  assert.deepEqual(zipOrder(world, { regions: ['sd'] }), REGION);
  assert.ok(STATES.length === 7 && KINDS.length === 6);
});

test('map fills: ear clipping covers simple rings exactly; others go to the stencil path', () => {
  const area = r => { let a = 0; const n = r.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) a += r[2 * j] * r[2 * i + 1] - r[2 * i] * r[2 * j + 1]; return Math.abs(a / 2); };
  for (const ring of world.outlineRings()) {
    const r = cleanRing(ring), idx = triangulate(r);
    let t = 0;
    for (let k = 0; k < idx.length; k += 3) {
      const [i, j, l] = [idx[k], idx[k + 1], idx[k + 2]];
      t += Math.abs((r[2 * j] - r[2 * i]) * (r[2 * l + 1] - r[2 * i + 1]) - (r[2 * j + 1] - r[2 * i + 1]) * (r[2 * l] - r[2 * i])) / 2;
    }
    assert.ok(Math.abs(t - area(r)) <= area(r) * 1e-9 + 1e-9, 'triangles tile the ring');
  }
  assert.deepEqual([...triangulate([0, 0, 4, 0, 4, 4, 0, 4])].length, 6);
  assert.equal(cleanRing([0, 0, 2, 0, 4, 0, 4, 4, 4, 6, 4, 4, 0, 4]).length / 2, 4, 'collinear points and spikes drop');
  const f = buildFill(world.waterRings().flat());
  assert.ok(f.tris.length > 0 && f.fans.length > 0 && f.cover.length === 12);
});

test('a million agents statewide build in seconds', () => {
  const rate = 1e6 / world.totalPop;
  for (let zi = 0; zi < world.N; zi += 50) pop.householdCore(zi, 0);
  const t0 = performance.now();
  let n = 0;
  for (let zi = 0; zi < world.N; zi++) { const H = pop.householdCount(zi); for (let h = 0; h < H; h++) if (pop.includes(zi, h, rate)) n += pop.householdCore(zi, h).members.length; }
  const core = performance.now() - t0;
  const t1 = performance.now();
  let chunks = 0;
  const { summary } = buildAgents(world, pop, { rate, seed: 1, roadNet: buildRoadNet(world), chunkTarget: 131072, onChunk: () => { chunks++; } });
  const total = performance.now() - t1;
  console.log(`statewide: ${summary.agents} agents in ${Math.round(total)} ms (population householdCore alone: ${Math.round(core)} ms; crowd work: ${Math.round(total - core)} ms; ${chunks} chunks)`);
  assert.equal(summary.agents, n);
  assert.ok(summary.agents > 850000);
  assert.ok(total - core < 1500, `crowd work ${Math.round(total - core)} ms`);
  assert.ok(total < 6000, `total ${Math.round(total)} ms`);
});
