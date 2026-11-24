// Schedule: plans tile the Pacific day, agree with layer 0, carry night shifts across midnight, drive young
// children to school, put errands in nearby shopping ZIPs, and activityAt moves along the segment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Population, LEGION_SEED } from '../src/engine/population.mjs';
import { persona } from '../src/engine/persona.mjs';
import { dayPlan, activityAt, dayInfo, rhythmOf, familyOutings, busyIntervals, PLAN_KINDS } from '../src/engine/schedule.mjs';
import { atPacific, pacific } from '../src/engine/clock.mjs';

const world = await loadDefaultWorld();
const pop = new Population(world, { seed: LEGION_SEED });
const ZIPS = ['94110', '90001', '91342', '95014', '92101', '93721', '95521', '96161', '92262', '93901', '95814', '92335'];
const TUE = atPacific(2026, 11, 24, 12, 0), SAT = atPacific(2026, 11, 28, 12, 0), SUN = atPacific(2026, 11, 29, 12, 0), MON = atPacific(2026, 11, 23, 12, 0);

function people(zip, n, pred = () => true, maxHH = 3000) {
  const zi = world.indexOf(zip), H = world.z.hh[zi] || 0, out = [];
  for (let h = 0; h < Math.min(H, maxHH) && out.length < n; h++) {
    const core = pop.householdCore(zi, h);
    for (let m = 0; m < core.size && out.length < n; m++) { const npc = pop.person(zi, h, m); if (npc && pred(npc, core.members[m], core)) out.push(npc); }
  }
  return out;
}
const P = npc => persona(world, npc, { population: pop });

function assertTiles(plan, t, id) {
  const d = dayInfo(t);
  assert.ok(plan.length >= 1, id);
  assert.equal(plan[0].start, d.start, `${id} starts at midnight`);
  assert.equal(plan[plan.length - 1].end, d.end, `${id} ends at the next midnight`);
  for (let i = 0; i < plan.length; i++) {
    const it = plan[i];
    assert.ok(it.end > it.start, `${id} item ${i} ${it.kind} has length`);
    if (i) assert.equal(it.start, plan[i - 1].end, `${id} no gap or overlap before item ${i} (${it.kind})`);
    assert.ok(PLAN_KINDS.includes(it.kind), it.kind);
    assert.ok(Number.isFinite(it.place.x) && Number.isFinite(it.place.y) && typeof it.place.label === 'string' && typeof it.place.kind === 'string');
    if (it.travel) assert.ok(it.from && Number.isFinite(it.from.x) && typeof it.mode === 'string', `${id} travel item has from and mode`);
    else assert.equal(it.mode, null);
  }
}

test('plans tile the Pacific day with no gaps or overlaps', () => {
  const sample = ZIPS.flatMap(zip => people(zip, 25));
  assert.ok(sample.length >= 250);
  for (const npc of sample) {
    const p = P(npc);
    for (const t of [MON, TUE, SAT, SUN]) assertTiles(dayPlan(npc, p, t), t, `${npc.id} ${pacific(t).dayName}`);
  }
});

test('daylight-saving days still tile exactly', () => {
  const sample = ZIPS.slice(0, 4).flatMap(zip => people(zip, 10));
  for (const t of [atPacific(2026, 3, 8, 12, 0), atPacific(2026, 11, 1, 12, 0)]) {
    const d = dayInfo(t);
    assert.notEqual(d.end - d.start, 86400000);
    for (const npc of sample) assertTiles(dayPlan(npc, P(npc), t), t, `${npc.id} DST`);
  }
});

test('the commute agrees with layer 0 (departMin, commuteMin, dwellMin, days)', () => {
  let checked = 0;
  for (const zip of ZIPS) {
    for (const npc of people(zip, 30, (n, core) => core && core.work && core.departMin !== null && core.mode && core.mode !== 'wfh' && core.commuteMin > 0 && core.departMin + 2 * core.commuteMin + core.dwellMin < 1440)) {
      const core = pop.householdCore(npc.zi, npc.h).members[npc.m];
      const p = P(npc);
      for (const t of [MON, TUE, SAT, SUN]) {
        const dow = pacific(t).dow, plan = dayPlan(npc, p, t);
        const out = plan.find(it => it.anchor === 'layer0' && it.leg === 'out');
        if (core.days & (1 << dow)) {
          assert.ok(out, `${npc.id} commutes on dow ${dow}`);
          assert.equal(out.startMin, core.departMin);
          assert.equal(out.endMin - out.startMin, core.commuteMin);
          assert.equal(out.mode, core.mode);
          const i = plan.indexOf(out), stay = plan[i + 1], back = plan[i + 2];
          assert.ok(stay.kind === 'work' || stay.kind === 'school');
          assert.equal(stay.endMin - stay.startMin, core.dwellMin);
          assert.equal(back.leg, 'back');
          assert.equal(back.endMin - back.startMin, core.commuteMin);
          assert.ok(Math.abs(out.place.x - core.work.x) < 1e-9 && Math.abs(out.place.y - core.work.y) < 1e-9, 'goes to the layer 0 workplace');
          checked++;
        } else {
          assert.ok(!plan.some(it => it.anchor === 'layer0'), `${npc.id} no commute on dow ${dow}`);
        }
      }
    }
  }
  assert.ok(checked >= 150, `commute days checked: ${checked}`);
});

test('night shifts run across midnight', () => {
  const base = people('91342', 1, n => n.age >= 30 && n.age < 60)[0];
  const npc = structuredClone(base);
  npc.commute = Object.assign({}, npc.commute, { mode: 'drive', minutes: 30, departMin: 22 * 60, dwellMin: 510, days: 62, workZi: npc.zi, work: { x: npc.household.home.x + 40, y: npc.household.home.y + 10 } });
  npc.occupation = { key: 'healthsupport', title: 'Nursing assistant', shift: 'night' };
  npc.status = 'employed';
  const p = persona(world, npc, {}); // no population: the routine comes from the NPC's own commute record
  assert.equal(p.routine.shift, 'night');
  const tue = dayPlan(npc, p, TUE);
  assert.equal(tue[0].kind, 'work', 'Tuesday opens on the tail of Monday night\'s shift');
  assert.equal(tue[0].endMin, 22 * 60 + 30 + 510 - 1440);
  assert.equal(tue[1].kind, 'commute');
  assert.equal(tue[1].endMin - tue[1].startMin, 30);
  const sleep = tue.find(it => it.kind === 'sleep');
  assert.ok(sleep && sleep.startMin > 7 * 60 && sleep.endMin < 22 * 60, 'sleeps through the day');
  const tonight = tue.filter(it => it.startMin >= 22 * 60);
  assert.deepEqual(tonight.map(it => it.kind), ['commute', 'work']);
  assert.equal(tue[tue.length - 1].kind, 'work');
  const mon = dayPlan(npc, p, MON);
  assert.notEqual(mon[0].kind, 'work', 'Sunday night is off, so Monday morning is not at work');
  assert.equal(dayPlan(npc, p, SAT)[0].kind, 'work', 'Friday night\'s shift spills into Saturday');
  assert.ok(!dayPlan(npc, p, SUN).some(it => it.kind === 'work' || it.kind === 'commute'), 'Sunday off');
});

test('weekends differ from weekdays', () => {
  let n = 0;
  for (const npc of ZIPS.flatMap(zip => people(zip, 8, (x, core) => core && core.days === 62 && core.departMin !== null && core.mode && core.mode !== 'wfh' && core.departMin + 2 * core.commuteMin + core.dwellMin < 1440))) {
    const p = P(npc);
    assert.ok(dayPlan(npc, p, TUE).some(it => it.kind === 'work' || it.kind === 'school'));
    assert.ok(!dayPlan(npc, p, SAT).some(it => it.kind === 'work' || it.kind === 'school' || it.kind === 'commute'));
    n++;
  }
  assert.ok(n >= 30, `weekday commuters: ${n}`);
});

// Every member of a household with children, with persona and the plans of a whole week (Sunday 22 .. Saturday 28).
const WEEK = [0, 1, 2, 3, 4, 5, 6].map(d => atPacific(2026, 11, 22 + d, 12, 0));
function householdsWithKids(zips, maxHH, maxAge = 11) {
  const out = [];
  for (const zip of zips) {
    const zi = world.indexOf(zip);
    for (let h = 0; h < Math.min(maxHH, world.z.hh[zi] || 0); h++) {
      const core = pop.householdCore(zi, h);
      if (!core.members.some(x => x.age < maxAge)) continue;
      const ms = core.members.map(x => { const npc = pop.person(zi, h, x.m); return { npc, p: P(npc), core: x }; });
      out.push({ core, ms, week: WEEK.map(t => new Map(ms.map(x => [x.npc.m, dayPlan(x.npc, x.p, t)]))) });
    }
  }
  return out;
}
const HOUSEHOLDS = householdsWithKids(['94110', '90001', '91342', '93721', '92335', '95814', '93230', '92101', '96161', '95521'], 220);

test('school runs: every ride is in the driver\'s plan all week, siblings ride together, work at home steps aside', () => {
  let rides = 0, merged = 0, walking = 0, busStop = 0, wfhDrivers = 0, together = 0;
  for (const { core, ms, week } of HOUSEHOLDS) {
    for (let dow = 0; dow < 7; dow++) {
      const plans = week[dow];
      for (const kid of ms) {
        const ride = kid.p.routine.ride;
        if (!ride) continue;
        for (const leg of ride.legs) {
          if (!(leg.days & (1 << dow))) continue;
          rides++;
          const items = plans.get(leg.driver).filter(it => it.run === leg.kind && it.escort && it.escort.includes(kid.npc.m));
          assert.ok(items.length, `${kid.npc.id}: ${leg.kind} by member ${leg.driver} on day ${dow} is in the driver's plan`);
          if (leg.kind === 'drop-off') {
            const first = items[0];
            assert.ok(first.startMin <= kid.core.departMin && first.startMin >= kid.core.departMin - 15, `${kid.npc.id} leaves with the run (${first.startMin} vs ${kid.core.departMin})`);
            const { from, place } = first, w = kid.core.work;
            // to the school, or to the bus stop on the child's own way there
            const cross = (w.x - from.x) * (place.y - from.y) - (w.y - from.y) * (place.x - from.x);
            assert.ok(Math.abs(cross) < 1e-6 * Math.max(1, (w.x - from.x) ** 2 + (w.y - from.y) ** 2), 'the run heads for the child\'s school');
            if (first.escort.length >= 2) merged++;
            if (leg.mode === 'walk') walking++;
            if (leg.mode === 'bus-stop') busStop++;
          }
        }
      }
      for (const adult of ms) {
        const plan = plans.get(adult.npc.m);
        // what the routine says this adult takes today, the plan holds; never on top of their own layer 0 day
        for (const run of adult.p.routine.schoolRuns) {
          if (!(run.days & (1 << dow))) continue;
          assert.ok(plan.some(it => it.run === run.kind && it.escort && run.children.every(c => it.escort.includes(c))), `${adult.npc.id} ${run.kind} on day ${dow}`);
          for (const it of plan.filter(x => x.run)) for (const [a, b] of busyIntervals(adult.core, dow)) assert.ok(!(it.startMin < b && it.endMin > a), `${adult.npc.id} runs while at work`);
        }
        const drops = plan.filter(it => it.run === 'drop-off' && it.travel && it.place.kind === 'school');
        for (let i = 1; i < drops.length; i++) assert.ok(!(drops[i].place.x === drops[i - 1].place.x && drops[i].startMin - drops[i - 1].startMin < 15), `${adult.npc.id}: siblings at one school ride together`);
        if (plan.some(it => it.label === 'working from home') && plan.some(it => it.run)) wfhDrivers++;
      }
      // a walking escort and the child move together
      for (const kid of ms) {
        const leg = kid.p.routine.ride && kid.p.routine.ride.legs.find(l => l.kind === 'drop-off' && l.mode === 'walk' && (l.days & (1 << dow)));
        if (!leg) continue;
        const own = plans.get(kid.npc.m).find(it => it.anchor === 'layer0' && it.leg === 'out');
        const esc = plans.get(leg.driver).find(it => it.run === 'drop-off' && it.travel && it.escort.includes(kid.npc.m));
        if (!own || own.startMin !== esc.startMin) continue; // a sibling leaving a few minutes after the lead
        const t = Math.floor((own.start + own.end) / 2);
        const a = activityAt(kid.npc, kid.p, t).position, b = activityAt(ms.find(x => x.npc.m === leg.driver).npc, ms.find(x => x.npc.m === leg.driver).p, t).position;
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6, `${kid.npc.id} walks with ${leg.driver}`);
        together++;
      }
    }
  }
  assert.ok(rides >= 400, `ride-days checked: ${rides}`);
  assert.ok(merged > 0 && walking > 0 && busStop > 0 && wfhDrivers > 0 && together > 0, JSON.stringify({ merged, walking, busStop, wfhDrivers, together }));
});

test('children under ten go out only to school and with a grown-up of the household, who has the same outing', () => {
  let legs = 0, churches = 0, school = 0;
  for (const { ms, week } of HOUSEHOLDS) {
    for (let dow = 0; dow < 7; dow++) {
      const plans = week[dow];
      for (const kid of ms.filter(x => x.npc.age < 10)) {
        for (const it of plans.get(kid.npc.m)) {
          if (!it.travel) continue;
          if (it.anchor === 'layer0') { school++; continue; }
          assert.ok(it.together, `${kid.npc.id} goes to ${it.label} on day ${dow} on their own`);
          const grown = ms.filter(a => a.npc.age >= 18 && it.escort.includes(a.npc.m));
          assert.ok(grown.length, `${kid.npc.id} ${it.label}: a grown-up goes`);
          for (const a of grown) {
            const same = plans.get(a.npc.m).find(x => x.together === it.together && x.startMin === it.startMin && x.endMin === it.endMin);
            assert.ok(same && same.place.x === it.place.x && same.place.y === it.place.y && same.mode === it.mode, `${a.npc.id} has ${kid.npc.id}'s ${it.label}`);
            for (const [s, e] of busyIntervals(a.core, dow)) assert.ok(!(it.startMin < e && it.endMin > s), `${a.npc.id} is free for ${it.label}`);
          }
          legs++;
          if (it.kind === 'worship') { assert.equal(dow, 0, 'church is on Sunday'); churches++; }
        }
      }
    }
  }
  assert.ok(legs > 200 && school > 200 && churches > 0, JSON.stringify({ legs, school, churches }));
  // every member's persona describes the same household: the same outings, drawn from any member
  for (const { ms } of HOUSEHOLDS.slice(0, 60)) {
    for (const t of WEEK) {
      const views = ms.map(x => JSON.stringify(familyOutings(x.p.routine.household, t)));
      assert.ok(views.every(v => v === views[0]), `${ms[0].npc.hid} household outings agree`);
    }
  }
});

test('errands go to nearby ZIPs with stores, and the faithful go to church on Sunday', () => {
  let faithful = 0, worship = 0, errandsSeen = 0;
  for (const zip of ZIPS) {
    for (const npc of people(zip, 30, n => n.age >= 18)) {
      const p = P(npc);
      for (const e of p.routine.places.errands) {
        assert.ok((world.z.retail[e.zi] || 0) + (world.z.food[e.zi] || 0) > 0, `${e.kind} in ${world.zips[e.zi]} has stores`);
        assert.ok(e.distKm <= 70, `${e.kind} ${e.distKm} km away`);
      }
      for (const t of [TUE, SAT]) for (const it of dayPlan(npc, p, t)) if (it.kind === 'errand' && !it.travel && it.place.kind !== 'school') {
        errandsSeen++;
        assert.ok(p.routine.places.errands.some(e => e.x === it.place.x && e.y === it.place.y), 'errands go to the routine\'s stores');
      }
      if (p.practice && p.routine.places.church) {
        faithful++;
        for (let w = 0; w < 4; w++) if (dayPlan(npc, p, SUN + w * 7 * 86400000).some(it => it.kind === 'worship')) worship++;
        assert.ok(![MON, TUE, SAT].some(t => dayPlan(npc, p, t).some(it => it.kind === 'worship')), 'church is on Sunday');
      }
    }
  }
  assert.ok(errandsSeen > 50, `errands seen: ${errandsSeen}`);
  assert.ok(faithful >= 5, `churchgoers: ${faithful}`);
  assert.ok(worship / (faithful * 4) >= 0.6, `Sunday services attended ${worship}/${faithful * 4}`);
});

test('activityAt: the current item, its progress and a position on the segment while traveling', () => {
  let travel = 0;
  for (const npc of ZIPS.flatMap(zip => people(zip, 6, n => n.age >= 16))) {
    const p = P(npc);
    for (const it of dayPlan(npc, p, TUE)) {
      for (const f of [0.1, 0.5, 0.9]) {
        const t = Math.floor(it.start + f * (it.end - it.start));
        const a = activityAt(npc, p, t);
        assert.equal(a.start, it.start);
        assert.equal(a.kind, it.kind);
        assert.ok(a.progress >= 0 && a.progress <= 1);
        if (it.travel) {
          travel++;
          const { from, place } = it, { x, y } = a.position;
          const cross = (place.x - from.x) * (y - from.y) - (place.y - from.y) * (x - from.x);
          const len2 = (place.x - from.x) ** 2 + (place.y - from.y) ** 2;
          assert.ok(Math.abs(cross) <= 1e-6 * Math.max(1, len2), 'on the line');
          const u = len2 ? ((x - from.x) * (place.x - from.x) + (y - from.y) * (place.y - from.y)) / len2 : 0;
          assert.ok(u >= -1e-9 && u <= 1 + 1e-9, 'between the two places');
          assert.ok(Math.abs(u - a.progress) < 1e-6 || len2 === 0, 'moves with progress');
          assert.equal(a.traveling, true);
        } else {
          assert.deepEqual(a.position, { x: it.place.x, y: it.place.y });
          assert.equal(a.traveling, false);
        }
      }
    }
  }
  assert.ok(travel > 100, `travel samples: ${travel}`);
});

test('deterministic, with a chronotype from personality and age', () => {
  const other = new Population(world, { seed: LEGION_SEED });
  for (const npc of ZIPS.flatMap(zip => people(zip, 3))) {
    const a = dayPlan(npc, P(npc), SAT), b = dayPlan(structuredClone(npc), persona(world, structuredClone(npc), { population: other }), SAT);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), npc.id);
  }
  const npc = people('94110', 1, n => n.age >= 20)[0];
  const lark = { big5: { O: 0.3, C: 0.9, E: 0.4, A: 0.5, N: 0.5 }, npc: Object.assign({}, npc, { age: 68 }) };
  const owl = { big5: { O: 0.8, C: 0.15, E: 0.8, A: 0.5, N: 0.5 }, npc: Object.assign({}, npc, { age: 21 }) };
  const rl = rhythmOf(lark.npc, lark), ro = rhythmOf(owl.npc, owl);
  assert.ok(ro.freeWakeMin - rl.freeWakeMin > 90, `owls rise later: ${rl.freeWakeMin} vs ${ro.freeWakeMin}`);
  assert.ok(ro.freeBedMin - rl.freeBedMin > 60);
  const teen = rhythmOf(Object.assign({}, npc, { age: 16 }), { big5: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 } });
  assert.ok(teen.needMin >= 8 * 60, 'teens need more sleep');
  // the plan is frozen, and errands vary from day to day
  const p = P(npc);
  assert.ok(Object.isFrozen(dayPlan(npc, p, TUE)) && Object.isFrozen(dayPlan(npc, p, TUE)[0]));
  const shapes = new Set();
  for (let d = 0; d < 14; d++) shapes.add(dayPlan(npc, p, TUE + d * 86400000).map(it => it.kind).join(','));
  assert.ok(shapes.size >= 4, `distinct day shapes over two weeks: ${shapes.size}`);
});

test('a persona without a routine still gets a full day from the NPC\'s own commute record', () => {
  const npc = people('91342', 1, (n, core) => core && core.mode === 'drive' && core.departMin !== null && core.commuteMin > 0 && core.departMin + 2 * core.commuteMin + core.dwellMin < 1440)[0];
  assert.ok(npc);
  const { routine, ...bare } = P(npc);
  const plan = dayPlan(npc, bare, TUE);
  assertTiles(plan, TUE, npc.id);
  const out = plan.find(it => it.leg === 'out');
  assert.ok(out && out.startMin === npc.commute.departMin && out.endMin - out.startMin === npc.commute.minutes);
  assertTiles(dayPlan(npc, null, SAT), SAT, `${npc.id} with no persona`);
});

test('24-hour shifts on back-to-back days stay at work and keep layer 0 timing', () => {
  const base = people('91342', 1, n => n.age >= 25 && n.age < 60)[0];
  const npc = structuredClone(base);
  const work = { x: npc.household.home.x + 25, y: npc.household.home.y - 15 };
  npc.commute = Object.assign({}, npc.commute, { mode: 'drive', minutes: 20, departMin: 420, dwellMin: 1440, days: (1 << 0) | (1 << 3) | (1 << 6), workZi: npc.zi, work });
  npc.occupation = { key: 'firefighting', title: 'Firefighter', shift: 'h24' };
  npc.status = 'employed';
  const p = persona(world, npc, {});
  assert.equal(p.archetype, 'firefighter');
  const sat = dayPlan(npc, p, SAT), sun = dayPlan(npc, p, SUN), mon = dayPlan(npc, p, atPacific(2026, 11, 30, 12, 0));
  for (const [plan, t] of [[sat, SAT], [sun, SUN], [mon, atPacific(2026, 11, 30, 12, 0)]]) assertTiles(plan, t, `${npc.id} h24`);
  // Saturday: leaves at 7:00, on shift through midnight
  assert.equal(sat.find(it => it.leg === 'out').startMin, 420);
  assert.equal(sat[sat.length - 1].kind, 'work');
  // Sunday: Saturday's shift runs into Sunday's; the 7:00 departure still stands, as a leg that never leaves work
  const out = sun.find(it => it.leg === 'out');
  assert.equal(sun[0].kind, 'work');
  assert.equal(sun[0].endMin, 420);
  assert.ok(out && out.startMin === 420 && out.endMin === 440);
  assert.deepEqual([out.from.x, out.from.y], [work.x, work.y], 'already at work');
  assert.ok(!sun.some(it => it.kind === 'sleep' || it.kind === 'home'), 'a 48-hour stretch at the station');
  // Monday: Sunday's shift ends at 7:20, the drive home, then sleep
  assert.equal(mon[0].kind, 'work');
  assert.equal(mon[0].endMin, 440);
  assert.equal(mon[1].leg, 'back');
  assert.ok(mon.some(it => it.kind === 'sleep' && it.startMin >= 460 && it.startMin < 600));
  // positions never jump: at 6:59 and 7:01 on Sunday the firefighter is at the station
  const at = (h, mi) => activityAt(npc, p, atPacific(2026, 11, 29, h, mi)).position;
  for (const pos of [at(6, 59), at(7, 1), at(7, 30)]) assert.deepEqual([pos.x, pos.y], [work.x, work.y]);
});
