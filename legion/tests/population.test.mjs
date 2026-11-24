// Population (CONTRACTS section 5): ids, determinism, the two layers, sampling, performance, calibration to the
// Census tables of thirteen ZIPs (and of small, older and college ZIPs), heritage from the tables, household
// structure, trips that agree with their minutes, occupations, wages, education and origins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Population, parseId, LEGION_SEED, HERITAGE_KEYS } from '../src/engine/population.mjs';
import { pickOccupation, chooseTitle, titleWage, OCCUPATION_CATALOG, OCC_GROUPS, GROUP_PROFILES, EDUCATION_LEVELS, MIN_WAGE_HOURLY, MIN_WAGE_FULL_TIME } from '../src/engine/occupations.mjs';
import { Rng, hash3, u01 } from '../src/engine/rng.mjs';

const world = await loadDefaultWorld();
const pop = new Population(world, { seed: LEGION_SEED });
const zi = zip => world.indexOf(zip);
const ZIPS = ['94110', '90001', '96161', '91205', '92683', '93727', '95993', '90813', '92617', '94015', '92252', '95501', '92101'];
const HISPANIC = new Set(['mexican', 'salvadoran', 'guatemalan', 'honduran', 'nicaraguan', 'puertorican', 'cuban', 'dominican', 'southamerican', 'spanish', 'latino']);
const ASIAN = new Set(['chinese', 'filipino', 'vietnamese', 'korean', 'japanese', 'indian', 'hmong', 'cambodian', 'lao', 'thai', 'pakistani', 'bangladeshi', 'sikh', 'afghan', 'burmese', 'indonesian', 'asian']);
const WHITE = new Set(['armenian', 'iranian', 'arab', 'assyrian', 'russian', 'ukrainian', 'polish', 'irish', 'italian', 'german', 'english', 'scottish', 'french', 'portuguese', 'dutch', 'scandinavian', 'greek', 'european', 'american']);
const US_STATES = new Set(['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia']);
const TITLE = new Map();
for (const list of Object.values(OCCUPATION_CATALOG)) for (const t of list) TITLE.set(t.key, t);
const tvd = (a = {}, b = {}) => { let s = 0; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) s += Math.abs((a[k] || 0) - (b[k] || 0)); return s / 2; };
const pts = x => (100 * x).toFixed(1);
const popcount = m => { let n = 0; for (; m; m &= m - 1) n++; return n; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const share = (a, f) => a.filter(f).length / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
// B01001 bracket bounds and the bracket-interpolated median of an age block (46 counts, men then women)
const AGE_LO = [0, 5, 10, 15, 18, 20, 21, 22, 25, 30, 35, 40, 45, 50, 55, 60, 62, 65, 67, 70, 75, 80, 85];
const AGE_HI = [4, 9, 14, 17, 19, 20, 21, 24, 29, 34, 39, 44, 49, 54, 59, 61, 64, 66, 69, 74, 79, 84, 99];
const blockMedian = a => {
  const c = AGE_LO.map((_, b) => a[b] + a[23 + b]), t = c.reduce((x, y) => x + y, 0);
  let s = 0;
  for (let b = 0; b < 23; b++) { if (s + c[b] >= t / 2) return AGE_LO[b] + (t / 2 - s) / (c[b] || 1) * (AGE_HI[b] + 1 - AGE_LO[b]); s += c[b]; }
  return 0;
};
const blockShare = (a, lo, hi) => { let s = 0, t = 0; for (let b = 0; b < 23; b++) { const v = a[b] + a[23 + b]; t += v; if (AGE_LO[b] >= lo && AGE_HI[b] <= hi) s += v; } return s / (t || 1); };
const agesOf = (z, n) => { const out = []; for (let h = 0; h < n; h++) for (const p of pop.householdCore(z, h).members) out.push(p.age); return out; };

test('ids: parseId, get, members', () => {
  const i = zi('94110');
  assert.deepEqual(parseId('94110-123-0'), { zip: '94110', zi: i, h: 123, m: 0 });
  assert.deepEqual(parseId(' 94110-7 '), { zip: '94110', zi: i, h: 7, m: null });
  assert.deepEqual(parseId('99999-1-1'), { zip: '99999', zi: -1, h: 1, m: 1 });
  for (const bad of ['', null, undefined, '9411-1-0', '94110', '94110-x-1', '94110-1-2-3', 'abc']) assert.equal(parseId(bad), null, String(bad));
  const npc = pop.get('94110-123-1');
  const size = pop.householdSize(i, 123);
  if (size > 1) { assert.equal(npc.id, '94110-123-1'); assert.equal(npc.hid, '94110-123'); assert.equal(npc.m, 1); } else assert.equal(npc, null);
  assert.equal(pop.get('94110-123').id, '94110-123-0', 'a household id gives the householder');
  assert.equal(pop.get(`94110-${world.z.hh[i]}-0`), null, 'past the last household');
  assert.equal(pop.get(`94110-123-${size}`), null, 'past the last member');
  assert.equal(pop.get('00000-1-0'), null);
  const all = pop.members(i, 123);
  assert.equal(all.length, size);
  all.forEach((p, m) => assert.equal(p.id, `94110-123-${m}`));
});

test('householdSize equals the core size, and households add up to the household population', () => {
  for (const zip of ['94110', '90001', '92101', '93727', '96161']) {
    const z = zi(zip), sizes = [];
    for (let h = 0; h < 4000; h++) { const c = pop.householdCore(z, h); assert.equal(pop.householdSize(z, h), c.size); assert.equal(c.members.length, c.size); sizes.push(c.size); }
    // the model's mean size is exact; 4,000 households carry sampling noise of a few hundredths (three standard errors)
    const m = mean(sizes), sd = Math.sqrt(mean(sizes.map(s => (s - m) ** 2))), tol = 0.02 + 3 * sd / Math.sqrt(sizes.length);
    assert.ok(Math.abs(m - world.z.hhsize[z]) < tol, `${zip}: ${m.toFixed(3)} persons per household, ACS ${world.z.hhsize[z]} (tolerance ${tol.toFixed(3)})`);
  }
});

test('determinism: fresh instances give deep-equal households and NPCs in any order; the seed matters', () => {
  const ids = [];
  for (const zip of ['94110', '91205', '93727', '95501', '92617']) for (const h of [0, 17, 401, 1999]) { const n = pop.householdSize(zi(zip), h); for (let m = 0; m < n; m++) ids.push(`${zip}-${h}-${m}`); }
  const a = new Population(world, { seed: LEGION_SEED }), b = new Population(world, { seed: LEGION_SEED });
  // b touches other ZIPs and households first and walks the ids backwards
  b.sample(zi('90001'), 30, 3); b.householdCore(zi('96161'), 5);
  const fromB = new Map([...ids].reverse().map(id => [id, b.get(id)]));
  for (const id of ids) assert.deepEqual(a.get(id), fromB.get(id), id);
  for (const id of ids.slice(0, 12)) { const p = parseId(id); assert.deepEqual(a.householdCore(p.zi, p.h), b.householdCore(p.zi, p.h)); }
  const c = new Population(world, { seed: 7 });
  let differ = 0;
  for (let h = 0; h < 50; h++) if (JSON.stringify(c.householdCore(zi('94110'), h)) !== JSON.stringify(a.householdCore(zi('94110'), h))) differ++;
  assert.ok(differ > 45, `another seed gives other people (${differ}/50 differ)`);
});

test('layer 1 never contradicts layer 0', () => {
  let n = 0;
  for (const zip of ['94110', '90001', '92683', '95993', '93727', '92101']) {
    const z = zi(zip);
    for (let h = 0; h < 120; h++) {
      const core = pop.householdCore(z, h), hh = pop.household(z, h);
      assert.equal(hh.id, core.id); assert.equal(hh.size, core.size); assert.equal(hh.type, core.type); assert.equal(hh.tenure, core.tenure);
      assert.ok(hh.yearMoved >= hh.yearBuilt && hh.yearMoved <= 2026, `${core.id} moved ${hh.yearMoved} built ${hh.yearBuilt}`);
      core.members.forEach((pc, m) => {
        const p = pop.person(z, h, m);
        n++;
        for (const k of ['role', 'sex', 'age', 'heritage']) assert.equal(p[k], pc[k], `${p.id} ${k}`);
        assert.deepEqual([p.commute.mode, p.commute.minutes, p.commute.departMin, p.commute.dwellMin, p.commute.days, p.commute.workDays, p.commute.workZi], [pc.mode, pc.commuteMin, pc.departMin, pc.dwellMin, pc.days, pc.workDays, pc.workZi], `${p.id} commute`);
        assert.deepEqual(p.commute.work, pc.work);
        assert.equal(p.commute.workZip, pc.workZi >= 0 ? world.zips[pc.workZi] : null);
        assert.ok(p.birthYear === 2026 - p.age || p.birthYear === 2025 - p.age);
        assert.equal(p.pronouns, p.sex === 'F' ? 'she/her' : 'he/him');
        // work and status
        if (pc.worker) {
          assert.equal(p.status, pc.military ? 'military' : 'employed');
          assert.ok(p.occupation && OCCUPATION_CATALOG[pc.military ? 'military' : pc.occ].some(t => t.key === p.occupation.key), `${p.id} title fits ${pc.occ}`);
          assert.equal(p.occupation.wfh, pc.mode === 'wfh');
          if (pc.shift) assert.equal(p.occupation.shift, pc.shift);
          assert.ok(p.income >= p.occupation.wage - 100 && p.occupation.wage > 0);
          assert.ok(p.occupation.hours > 0 && p.occupation.hours <= 84, `${p.id} ${p.occupation.hours} hours`);
        } else {
          assert.equal(p.occupation, null);
          assert.ok(['unemployed', 'retired', 'student', 'homemaker', 'child', 'not working'].includes(p.status), p.status);
        }
        if (pc.student) { assert.ok(p.school); if (!pc.worker) assert.equal(p.status, p.age < 5 ? 'child' : 'student'); } else assert.equal(p.school, null);
        if (p.age < 25) assert.ok(['in school', 'child'].includes(p.education) || p.age >= 18, `${p.id} ${p.education}`);
        else assert.ok(EDUCATION_LEVELS.includes(p.education), p.education);
        if (pc.student === 'grad' && p.age >= 25) assert.ok(EDUCATION_LEVELS.indexOf(p.education) >= 4, 'graduate students hold a degree');
        // marriage follows the household
        if (core.type === 'married' && (pc.role === 'householder' || pc.role === 'spouse')) assert.equal(p.marital, 'married');
        if (pc.role === 'partner') assert.notEqual(p.marital, 'married');
        if (p.age < 15) assert.equal(p.marital, 'never');
        if (p.veteran) assert.ok(p.age >= 20 && !pc.military, `${p.id} a veteran at ${p.age}`);
        // origin, language and nativity
        assert.ok(['hispanic', 'white', 'black', 'asian', 'aian', 'nhpi', 'multi', 'other'].includes(p.race));
        if (HISPANIC.has(p.heritage)) assert.equal(p.race, 'hispanic');
        if (ASIAN.has(p.heritage)) assert.equal(p.race, 'asian');
        assert.equal(p.languages.english === 'only', p.languages.home === 'english');
        assert.ok(p.languages.list.includes(p.languages.home));
        if (p.nativity === 'foreign') { assert.equal(p.generation, 1); assert.ok(p.arrivalYear >= p.birthYear && p.arrivalYear <= 2026); assert.equal(p.mainlandYear, null); }
        else { assert.ok([2, 3].includes(p.generation), `${p.id} native born, generation ${p.generation}`); assert.equal(p.arrivalYear, null); }
        assert.ok(p.name.full === `${p.name.first} ${p.name.last}` && p.name.display.length > 0 && p.name.first !== p.name.last);
        assert.equal(p.household.members[m].name, p.name.display);
        assert.equal(p.place.zip, zip);
        assert.ok(Number.isInteger(p.seed) && p.seed >= 0);
      });
      // children of immigrants who were born here are second generation
      const kids = core.members.filter(x => x.role === 'child').map(x => pop.person(z, h, x.m));
      const head = pop.person(z, h, 0);
      if (head.nativity === 'foreign') for (const k of kids) if (k.nativity === 'native' && k.age < 2026 - head.arrivalYear) assert.equal(k.generation, 2);
    }
  }
  assert.ok(n > 1500);
});

test('includes is the hashed household sample the crowd uses', () => {
  const z = zi('90001');
  let inc = 0;
  for (let h = 0; h < 20000; h++) {
    const want = u01(hash3(LEGION_SEED ^ 0xC0, z, h)) < 0.1;
    assert.equal(pop.includes(z, h, 0.1), want);
    inc += want ? 1 : 0;
  }
  assert.ok(Math.abs(inc / 20000 - 0.1) < 0.01);
});

test('sample and sampleState: distinct, deterministic, uniform over persons', () => {
  const z = zi('93727');
  const s = pop.sample(z, 400, 11), ids = s.map(p => p.id);
  assert.equal(new Set(ids).size, 400);
  assert.ok(s.every(p => p.zi === z));
  assert.deepEqual(pop.sample(z, 50, 11).map(p => p.id), ids.slice(0, 50), 'a smaller sample is a prefix');
  assert.deepEqual(new Population(world).sample(z, 50, 11).map(p => p.id), ids.slice(0, 50));
  assert.notDeepEqual(pop.sample(z, 50, 12).map(p => p.id), ids.slice(0, 50));
  // uniform over persons means households are reached in proportion to their size
  let s1 = 0, s2 = 0;
  for (let h = 0; h < 6000; h++) { const n = pop.householdSize(z, h); s1 += n; s2 += n * n; }
  const want = s2 / s1, got = s.reduce((a, p) => a + p.household.size, 0) / s.length;
  assert.ok(Math.abs(got - want) < 0.35, `sampled people live in households of ${got.toFixed(2)}, expected ${want.toFixed(2)}`);
  const st = pop.sampleState(60, 3);
  assert.equal(st.length, 60);
  assert.equal(new Set(st.map(p => p.id)).size, 60);
  assert.ok(new Set(st.map(p => p.zip)).size > 30, 'statewide samples spread over many ZIPs');
  assert.deepEqual(pop.sampleState(20, 3).map(p => p.id), st.slice(0, 20).map(p => p.id));
});

test('performance: householdCore under 5 microseconds, person under 0.3 ms, a ZIP model in milliseconds', () => {
  const zs = ZIPS.map(zi);
  world.raster(); world.placesIn(zs[0]);           // the world's one-time indexes
  const fresh = new Population(world, { seed: LEGION_SEED });
  const others = []; for (let z = 3; z < world.N && others.length < 40; z += 41) if (fresh.householdCount(z) > 500) others.push(z);
  let t0 = performance.now();
  for (const z of others) fresh.householdSize(z, 0);   // the per-ZIP layer-0 models
  const build = (performance.now() - t0) / others.length;
  // warm up: the ZIPs' destination caches (school and workplace sites, distance bands) and the JIT, on other households
  let acc = 0;
  for (let k = 0; k < 13000; k++) acc += pop.householdCore(zs[k % zs.length], Math.floor(k / zs.length)).size;
  // three passes of 50,000 households each (other households every time); the median pass, so a collection of the
  // garbage earlier tests left behind does not decide the result
  const N = 50000, passes = [];
  for (let pass = 0; pass < 3; pass++) {
    t0 = performance.now();
    for (let k = 0; k < N; k++) acc += pop.householdCore(zs[k % zs.length], 1000 + 4000 * pass + Math.floor(k / zs.length)).size;
    passes.push((performance.now() - t0) * 1000 / N);
  }
  const core = median(passes);
  // people: the ZIPs' layer-1 models exist; every person is new to the cache
  for (const z of zs) pop.person(z, 0, 0);
  t0 = performance.now();
  let np = 0;
  for (let k = 0; k < 2600; k++) { const z = zs[k % zs.length], h = 5000 + Math.floor(k / zs.length) * 3; if (h >= world.z.hh[z]) continue; acc += pop.person(z, h, 0).age; np++; }
  const person = (performance.now() - t0) / np;
  console.log(`householdCore ${core.toFixed(2)} us on average over ${N} households (passes ${passes.map(x => x.toFixed(2)).join(', ')}); person ${(1000 * person).toFixed(1)} us over ${np}; a ZIP's layer-0 model ${build.toFixed(2)} ms`);
  assert.ok(acc > 0);
  assert.ok(core < 5, `householdCore ${core.toFixed(2)} us`);
  assert.ok(person < 0.3, `person ${person.toFixed(3)} ms`);
  assert.ok(build < 20, `a ZIP's layer-0 model ${build.toFixed(2)} ms`);
});

const fits = new Map();
const fidelity = zip => { if (!fits.has(zip)) fits.set(zip, pop.validate(zi(zip), 3000)); return fits.get(zip); };

test('calibration: households, ages, race, work and commutes match the Census tables', () => {
  for (const zip of ZIPS) {
    const v = fidelity(zip), g = v.generated, a = v.acs, t = v.target, s = v.scalars, gq = v.gq.share > 0.2;
    const at = `${zip} ${v.city}`;
    for (const k of Object.keys(a.hht)) assert.ok(Math.abs((g.hht[k] || 0) - a.hht[k]) < 0.04, `${at} household type ${k}: ${pts(g.hht[k] || 0)} vs ${pts(a.hht[k])}`);
    assert.ok(Math.abs(s.hhsize.generated - s.hhsize.acs) < 0.1, `${at} mean household size ${s.hhsize.generated.toFixed(2)} vs ${s.hhsize.acs}`);
    // ages: the household population (the Census pyramid less any group quarters); the same as B01001 where those are few
    assert.ok(Math.abs(s.medianAge.generated - s.medianAge.target) < 3, `${at} median age ${s.medianAge.generated.toFixed(1)} vs ${s.medianAge.target.toFixed(1)}`);
    if (v.gq.share < 0.05) assert.ok(Math.abs(s.medianAge.generated - s.medianAge.acs) < 3, `${at} median age vs B01001`);
    assert.ok(Math.abs(s.under18.generated - s.under18.target) < 0.05, `${at} under 18 ${pts(s.under18.generated)} vs ${pts(s.under18.target)}`);
    assert.ok(Math.abs(s.over65.generated - s.over65.target) < 0.05, `${at} 65+ ${pts(s.over65.generated)} vs ${pts(s.over65.target)}`);
    assert.ok(tvd(g.age, t.age) < 0.12, `${at} age-sex pyramid TVD ${tvd(g.age, t.age).toFixed(3)}`);
    for (const k of Object.keys(a.race)) assert.ok(Math.abs((g.race[k] || 0) - a.race[k]) < 0.04, `${at} race ${k}: ${pts(g.race[k] || 0)} vs ${pts(a.race[k])}`);
    assert.ok(Math.abs(s.own.generated - s.own.acs) < 0.04, `${at} owners ${pts(s.own.generated)} vs ${pts(s.own.acs)}`);
    assert.ok(tvd(g.veh, a.veh) < 0.08, `${at} vehicles by tenure TVD ${tvd(g.veh, a.veh).toFixed(3)}`);
    assert.ok(tvd(g.dwelling, a.dwelling) < 0.06, `${at} dwellings TVD ${tvd(g.dwelling, a.dwelling).toFixed(3)}`);
    // work: employment (B23025), commute mode (B08301) and time (B08303), occupation by sex (C24010)
    const wk = x => (x.employed || 0) + (x.military || 0);
    assert.ok(Math.abs(wk(g.emp) - wk(a.emp)) < 0.04, `${at} working 16+ ${pts(wk(g.emp))} vs ${pts(wk(a.emp))}`);
    assert.ok(Math.abs((g.emp.unemployed || 0) - a.emp.unemployed) < 0.03, `${at} unemployed ${pts(g.emp.unemployed || 0)} vs ${pts(a.emp.unemployed)}`);
    for (const k of Object.keys(a.comm)) assert.ok(Math.abs((g.comm[k] || 0) - a.comm[k]) < 0.04, `${at} commute ${k}: ${pts(g.comm[k] || 0)} vs ${pts(a.comm[k])}`);
    assert.ok(tvd(g.ctime, a.ctime) < 0.08, `${at} travel time TVD ${tvd(g.ctime, a.ctime).toFixed(3)}`);
    assert.ok(tvd(g.occM, a.occM) < 0.12 && tvd(g.occF, a.occF) < 0.12, `${at} occupations TVD ${tvd(g.occM, a.occM).toFixed(3)} / ${tvd(g.occF, a.occF).toFixed(3)}`);
    // school enrollment (B14001) among the household population
    assert.ok(tvd(g.sch, t.sch) < 0.06, `${at} school TVD ${tvd(g.sch, t.sch).toFixed(3)}`);
    if (!gq) assert.ok(tvd(g.sch, a.sch) < 0.06, `${at} school vs B14001`);
  }
});

test('calibration: nativity, language, English ability, education, marriage, veterans and income', () => {
  for (const zip of ZIPS) {
    const v = fidelity(zip), g = v.generated, a = v.acs, gq = v.gq.share > 0.2;
    const at = `${zip} ${v.city}`;
    assert.ok(Math.abs((g.nat.foreign || 0) - a.nat.foreign) < 0.04, `${at} foreign born ${pts(g.nat.foreign || 0)} vs ${pts(a.nat.foreign)}`);
    for (const k of Object.keys(a.lang)) assert.ok(Math.abs((g.lang[k] || 0) - a.lang[k]) < 0.05, `${at} language ${k}: ${pts(g.lang[k] || 0)} vs ${pts(a.lang[k])}`);
    const lep = o => Object.values(o).reduce((x, y) => x + y, 0);
    assert.ok(Math.abs(lep(g.lep) - lep(a.lep)) < 0.04, `${at} limited English ${pts(lep(g.lep))} vs ${pts(lep(a.lep))}`);
    assert.ok(tvd(g.hinc, a.hinc) < 0.12, `${at} household income TVD ${tvd(g.hinc, a.hinc).toFixed(3)}`);
    if (gq) continue;   // the Census person tables below count the dorm residents of a campus ZIP; its households are not them
    assert.ok(tvd(g.edu, a.edu) < 0.08, `${at} education TVD ${tvd(g.edu, a.edu).toFixed(3)}`);
    assert.ok(tvd(g.mar, a.mar) < 0.08, `${at} marital status TVD ${tvd(g.mar, a.mar).toFixed(3)}`);
    const vets = (o, sx) => Object.entries(o).filter(([k]) => k.startsWith(sx + '_vet')).reduce((x, [, y]) => x + y, 0);
    assert.ok(Math.abs(vets(g.vet, 'm') - vets(a.vet, 'm')) < 0.025 && Math.abs(vets(g.vet, 'f') - vets(a.vet, 'f')) < 0.01, `${at} veterans ${pts(vets(g.vet, 'm'))}/${pts(vets(a.vet, 'm'))}`);
  }
});

test('ages follow each ZIP: older towns keep their 55-64s, college towns their 18-21s, the median within 3 years', () => {
  // every ZIP with a median age of 50 or more, 800+ households and few group quarters: the median of 3,000
  // households against B01001 (bracket-interpolated)
  const errs = [];
  for (let z = 0; z < world.N; z++) {
    const H = world.z.hh[z] || 0, a = world.acs(z, 'age'), tot = a.reduce((x, y) => x + y, 0);
    if (H < 800 || !((world.z.age_med[z] || 0) >= 50) || Math.abs(tot - H * world.z.hhsize[z]) > 0.03 * tot) continue;
    const ages = agesOf(z, Math.min(H, 3000));
    errs.push([world.zips[z], median(ages) - blockMedian(a)]);
  }
  const within = share(errs, e => Math.abs(e[1]) <= 3), bias = mean(errs.map(e => e[1]));
  console.log(`older ZIPs: ${errs.length}, median within 3 years ${pts(within)}%, mean error ${bias.toFixed(2)} years; worst ${errs.sort((p, q) => Math.abs(q[1]) - Math.abs(p[1])).slice(0, 3).map(e => `${e[0]} ${e[1].toFixed(1)}`).join(', ')}`);
  assert.ok(errs.length > 80);
  assert.ok(within >= 0.95, `older ZIPs within 3 years of their median: ${pts(within)}%`);
  assert.ok(Math.abs(bias) < 1, `older ZIPs' median bias ${bias.toFixed(2)} years`);
  // college towns: the share of 18-21-year-olds of the household population (B01001 less the estimated dorms)
  for (const zip of ['94704', '93405', '95616']) {
    const v = pop.validate(zi(zip), 10), tgt = Object.entries(v.target.age).filter(([k]) => ['18-19', '20', '21'].includes(k.slice(1))).reduce((x, [, y]) => x + y, 0);
    const ages = agesOf(zi(zip), 5000), got = share(ages, x => x >= 18 && x <= 21);
    assert.ok(Math.abs(got - tgt) < 0.035, `${zip} ${v.city}: 18-21 ${pts(got)}% vs ${pts(tgt)}%`);
  }
  // and a ZIP's 55-64 share in the retirement towns the review named
  for (const zip of ['93449', '92861', '96067']) {
    const a = world.acs(zi(zip), 'age'), ages = agesOf(zi(zip), Math.min(world.z.hh[zi(zip)], 4000));
    const got = share(ages, x => x >= 55 && x <= 64), want = blockShare(a, 55, 64);
    assert.ok(Math.abs(got - want) < 0.025, `${zip}: 55-64 ${pts(got)}% vs ${pts(want)}%`);
  }
});

test('small ZIPs keep their own totals: no phantom group quarters, children in school, sizes that add up', () => {
  let n = 0, medErr = [], kids = 0, enrolled = 0, persons = 0, people = 0;
  const sizeErr = [];
  for (let z = 0; z < world.N; z++) {
    const a = world.acs(z, 'age'), tot = a.reduce((x, y) => x + y, 0), H = world.z.hh[z] || 0;
    if (!(tot < 500) || !H) continue;
    n++;
    const ages = [];
    let sz = 0;
    for (let h = 0; h < H; h++) for (const p of pop.householdCore(z, h).members) { sz++; ages.push(p.age); if (p.age >= 5 && p.age <= 17) { kids++; if (p.student === 'k12') enrolled++; } }
    persons += sz; people += tot;
    // the published size, or (none published) people per household when group quarters do not dominate
    const want = world.z.hhsize[z] > 0 ? world.z.hhsize[z] : tot / H <= 1.3 * 2.9 ? tot / H : null;
    if (want !== null && H >= 50) sizeErr.push(Math.abs(sz / H - want));
    const v = pop.validate(z, 0);   // the ZIP's model and Census tables (no households: the group-quarters estimate)
    if (Math.abs(tot - H * (world.z.hhsize[z] || tot / H)) <= Math.max(25, 0.02 * tot)) assert.equal(v.gq.persons, 0, `${world.zips[z]}: no group quarters when households hold everyone`);
    if (tot >= 100) medErr.push(Math.abs(median(ages) - blockMedian(a)));
  }
  console.log(`${n} ZIPs under 500 people: median age off by ${mean(medErr).toFixed(2)} years on average, K-12 ${pts(enrolled / kids)}% enrolled, household size off by ${mean(sizeErr).toFixed(3)}, ${persons} persons for ${people} in B01001`);
  assert.ok(n > 200);
  assert.ok(mean(medErr) < 4.5, `median age off by ${mean(medErr).toFixed(2)} years on average`);
  assert.ok(enrolled / kids > 0.9, `K-12 enrollment ${pts(enrolled / kids)}%`);
  assert.ok(mean(sizeErr) < 0.15, `household size off by ${mean(sizeErr).toFixed(3)} on average`);
  assert.ok(Math.abs(persons - people) / people < 0.1, `${persons} persons for ${people}`);
  // where every household is one person, every generated household is too
  const ryde = zi('95680');
  for (let h = 0; h < world.z.hh[ryde]; h++) assert.equal(pop.householdCore(ryde, h).size, 1);
});

test('heritage follows the tables: Armenian Glendale, Vietnamese Westminster, Filipino Daly City, Sikh Yuba City, Hmong Fresno', () => {
  const households = (zip, set) => {
    const z = zi(zip), c = {};
    let n = 0;
    for (let h = 0; h < world.z.hh[z]; h++) { const her = pop.householdCore(z, h).heritage; if (set.has(her)) { c[her] = (c[her] || 0) + 1; n++; } }
    return { n, share: k => (c[k] || 0) / n, top: Object.entries(c).sort((p, q) => q[1] - p[1])[0][0] };
  };
  const glendale = households('91205', WHITE);
  assert.ok(glendale.share('armenian') > 0.5, `Armenian among Glendale's white households ${pts(glendale.share('armenian'))}%`);
  const westminster = households('92683', ASIAN);
  assert.ok(westminster.share('vietnamese') > 0.7, `Vietnamese among Westminster's Asian households ${pts(westminster.share('vietnamese'))}%`);
  const daly = households('94015', ASIAN);
  assert.equal(daly.top, 'filipino'); assert.ok(daly.share('filipino') > 0.35);
  const fresno = households('93727', ASIAN);
  assert.ok(fresno.share('hmong') > 0.3, `Hmong among the Asian households of 93727 ${pts(fresno.share('hmong'))}%`);
  // Yuba City: Sikh residents (persons, every household) well above the state's share, and Punjabi the top language of Indian homes
  const z = zi('95993');
  let asian = 0, sikh = 0;
  const lang = {};
  for (let h = 0; h < world.z.hh[z]; h++) for (const p of pop.householdCore(z, h).members) if (ASIAN.has(p.heritage)) { asian++; if (p.heritage === 'sikh') sikh++; }
  for (let h = 0; h < 3000; h++) for (const p of pop.members(z, h)) if (p.heritage === 'indian' && p.languages.home !== 'english') lang[p.languages.home] = (lang[p.languages.home] || 0) + 1;
  assert.ok(sikh / asian > 0.01, `Sikh among Yuba City's Asian residents ${pts(sikh / asian)}%`);
  assert.equal(Object.entries(lang).sort((p, q) => q[1] - p[1])[0][0], 'punjabi');
  // and elsewhere the same code yields none of that
  const sf = households('94110', ASIAN);
  assert.ok(sf.share('sikh') === 0 && sf.share('hmong') < 0.02);
  assert.ok(HERITAGE_KEYS.length === 56 && HERITAGE_KEYS.includes('african-american'));
});

test('households are realistic: adults at the head, parents a couple, spouses near in age, children younger', () => {
  const gap = [], child = [], alone = [], rooms = [];
  let big = 0, bigMulti = 0, small = 0, smallMulti = 0, stepGap = 0, kids = 0;
  for (const zip of ['90001', '94110', '92617', '93727', '92683', '90011', '93245']) {
    const z = zi(zip);
    for (let h = 0; h < 2500; h++) {
      const c = pop.householdCore(z, h), hd = c.members[0];
      assert.equal(hd.role, 'householder');
      assert.ok(hd.age >= 18, `${c.id}: a householder of ${hd.age}`);
      if (c.type === 'alone') alone.push(hd.age);
      const parents = c.members.filter(p => p.role === 'parent');
      assert.ok(parents.length <= 2 && (parents.length < 2 || parents[0].sex !== parents[1].sex), `${c.id}: parents ${parents.map(p => p.sex).join('')}`);
      const sp = c.members.find(p => p.role === 'spouse' || p.role === 'partner');
      const multi = c.members.some(p => p.role === 'parent' || p.role === 'grandchild');
      if (c.size >= 5) { big++; if (multi) bigMulti++; } else if (c.size >= 3) { small++; if (multi) smallMulti++; }
      for (const p of c.members) {
        if (p.role === 'spouse') gap.push(Math.abs(p.age - hd.age));
        if (p.role === 'child') { child.push(hd.age - p.age); kids++; if (sp && p.age > sp.age - 15) stepGap++; }
        if (p.role === 'roommate' && zip === '92617') rooms.push(p.age);
        if (p.role === 'spouse' || p.role === 'partner' || p.role === 'roommate') assert.ok(p.age >= 18, `${c.id}: a ${p.role} of ${p.age}`);
      }
    }
  }
  assert.ok(share(gap, g => g <= 12) > 0.95, 'spouses within 12 years');
  assert.ok(Math.min(...child) >= 16, 'children at least 16 years younger than the householder');
  assert.ok(stepGap / kids < 0.002, `children nearly as old as the spouse: ${stepGap} of ${kids}`);
  assert.ok(share(rooms, a => a >= 18 && a < 35) > 0.7, 'roommates near a campus are young adults');
  assert.ok(mean(alone) > mean(rooms) + 15, 'people living alone are older than roommates');
  assert.ok(bigMulti / big > 1.5 * smallMulti / small, 'parents and grandchildren live in the larger family households');
});

test('trips agree with their minutes: no impossible speeds, the nearest school, a base for service members', () => {
  // straight-line speed limits: walking 7 km/h, a bike 25, everything else 110
  const LIM = { walk: 7, bike: 25 };
  const tally = {}, elementary = [], schoolDays = [];
  const add = (kind, ok) => { const t = tally[kind] || (tally[kind] = [0, 0]); t[0]++; if (ok) t[1]++; };
  for (let z = 0; z < world.N; z += 7) {
    const H = pop.householdCount(z);
    for (let h = 0; h < Math.min(H, 60); h++) {
      const c = pop.householdCore(z, h);
      for (const p of c.members) {
        if (p.mode === 'wfh') { assert.equal(p.days, 0); assert.equal(p.workZi, -1); assert.equal(p.work, null); assert.equal(p.departMin, null); assert.ok(p.workDays > 0); continue; }
        if (!p.mode || !p.work) continue;
        const km = world.distKm(c.home.x, c.home.y, p.work.x, p.work.y), kmh = km / (p.commuteMin / 60);
        const kind = p.student === 'k12' || p.student === 'preschool' ? 'school' : p.military ? 'military' : p.worker ? 'work' : 'college';
        add(kind, kmh <= (LIM[p.mode] || 110));
        assert.ok(p.commuteMin >= 1 && p.commuteMin <= 240, `${c.id}-${p.m} ${p.commuteMin} minutes`);
        if (p.student === 'k12') {
          assert.equal(p.days, 62, 'school Monday to Friday');
          assert.equal(p.workZi, z, 'school in the home ZIP');
          schoolDays.push(p.departMin + p.commuteMin);
          if (p.age <= 10) elementary.push(km);
          // the nearest school of the level (siblings share it)
          const level = p.age <= 10 ? 0 : p.age <= 13 ? 1 : 2, S = pop._schools(z)[level];
          let best = Infinity; for (let k = 0; k < S.length; k += 2) best = Math.min(best, world.distKm(c.home.x, c.home.y, S[k], S[k + 1]));
          assert.ok(km <= best * 1.01 + 1e-6, `${c.id}-${p.m} goes to a school ${km.toFixed(2)} km away, the nearest is ${best.toFixed(2)}`);
        }
      }
    }
  }
  for (const [kind, [n, ok]] of Object.entries(tally)) assert.ok(ok / n >= 0.99, `${kind} trips at a possible speed: ${pts(ok / n)}% of ${n}`);
  assert.ok(tally.school[0] > 3000 && tally.work[0] > 5000 && tally.military[0] > 20 && tally.college[0] > 300);
  assert.ok(median(elementary) < 2, `elementary school ${median(elementary).toFixed(2)} km away at the median`);
  assert.ok(share(schoolDays, m => m >= 450 && m <= 510) > 0.97, 'school starts 8:00 +/- 20 minutes (a few minutes early allowed)');
  // service members report to a base, not to the towns around it
  const reports = zip => { const z = zi(zip), c = {}; let n = 0; for (let h = 0; h < world.z.hh[z]; h++) for (const p of pop.householdCore(z, h).members) if (p.military && p.workZi >= 0) { n++; c[world.zips[p.workZi]] = (c[world.zips[p.workZi]] || 0) + 1; } return k => (c[k] || 0) / n; };
  assert.ok(reports('94535')('94535') > 0.9, 'Travis AFB residents serve at Travis');
  assert.ok(reports('95687')('94535') > 0.85 && reports('95687')('95687') < 0.1, 'Vacaville residents serve at Travis, not in Vacaville');
  assert.ok(reports('92058')('92055') > 0.5, 'Oceanside residents serve at Camp Pendleton');
});

test('commutes: departures fit the job; drives of 45 minutes go far', () => {
  const dep = {}, longDrive = [];
  for (const zip of ['90001', '94110', '93727', '92683', '95993']) {
    const z = zi(zip);
    for (let h = 0; h < 2500; h++) {
      const c = pop.householdCore(z, h);
      for (const p of c.members) {
        if (!p.worker || p.mode === 'wfh' || p.student === 'k12') continue;
        const km = world.distKm(c.home.x, c.home.y, p.work.x, p.work.y);
        if ((p.mode === 'drive' || p.mode === 'carpool') && p.commuteMin >= 45) longDrive.push(km);
        (dep[p.occ || 'military'] = dep[p.occ || 'military'] || []).push(p.departMin);
        if (p.shift === 'h24') assert.equal(p.dwellMin, 1440);
        assert.equal(p.days, p.workDays);
      }
    }
  }
  assert.ok(share(longDrive, d => d > 10) > 0.75, `drives of 45+ minutes go far: ${pts(share(longDrive, d => d > 10))}%`);
  assert.ok(median(dep.construction) < median(dep.office) - 60 && median(dep.farming) < median(dep.office) - 60, 'builders and farmworkers leave early');
  assert.ok(median(dep.office) >= 400 && median(dep.office) <= 540, 'offices start 7 to 9');
  const late = a => share(a, d => d >= 13 * 60);
  assert.ok(late(dep.food) > 0.25 && late(dep.healthsupport) > 0.2 && late(dep.office) < 0.1, 'food and care work evenings and nights');
});

test('jobs: minimum wage for the hours, licensed titles hold their degree, working from home in a remote job', () => {
  let workers = 0, wfh = 0, licensed = 0, adults = 0;
  for (let z = 0; z < world.N; z += 11) {
    const H = pop.householdCount(z);
    for (let h = 0; h < Math.min(H, 25); h++) {
      const c = pop.householdCore(z, h);
      for (const pc of c.members) {
        const p = pop.person(z, h, pc.m);
        if (!pc.worker) continue;
        workers++;
        const t = TITLE.get(p.occupation.key), e = EDUCATION_LEVELS.indexOf(p.education);
        // paid hours: the work days times the hours there (a student's after-school job: 12)
        const hours = pc.student === 'k12' ? 12 : popcount(pc.workDays) * Math.min(pc.dwellMin, 720) / 60;
        assert.equal(p.occupation.hours, Math.round(hours));
        assert.ok(p.occupation.wage >= MIN_WAGE_HOURLY * hours * 52 - 1, `${p.id} ${t.title} $${p.occupation.wage} for ${hours} hours a week`);
        if (t.licensed) { licensed++; assert.ok(e >= t.edu, `${p.id} ${t.title} with ${p.education}`); }
        if (p.age >= 25) { adults++; assert.ok(e >= t.edu, `${p.id} ${t.title} needs ${EDUCATION_LEVELS[t.edu]}, has ${p.education}`); }
        if (pc.mode === 'wfh') { wfh++; assert.ok(t.wfh >= 1, `${p.id} works from home as ${t.title}`); }
        else assert.ok(t.wfh < 3, `${p.id} commutes to a home-based job (${t.title})`);
        if (pc.age < 20) assert.ok(!['practitioner', 'police'].includes(pc.occ), `${p.id} a ${pc.occ} at ${pc.age}`);
      }
    }
  }
  assert.ok(workers > 5000 && wfh > 300 && licensed > 300 && adults > 4000);
  // groups none of whose titles can be done from home never work from home
  for (const g of [...OCC_GROUPS, 'military']) if (!OCCUPATION_CATALOG[g].some(t => t.wfh > 0)) assert.ok(['police', 'cleaning', 'farming', 'construction', 'repair', 'transport', 'moving', 'military'].includes(g), g);
});

test('origins: territories are native born, Hawaii is a state, Native heritage is Californian', () => {
  let pr = 0, prIsland = 0, pac = 0, hawaii = 0, hawaiiLimited = 0, hawaiian = 0, native = 0, navajo = 0, nativeForeign = 0, indigenousPlace = 0;
  // the 25 ZIPs with the most American Indian, Pacific Islander and Puerto Rican residents each
  const top = count => [...Array(world.N).keys()].filter(z => pop.householdCount(z) > 0).sort((a, b) => count(b) - count(a)).slice(0, 25);
  const zs = new Set([...top(z => world.acs(z, 'race')[2]), ...top(z => world.acs(z, 'race')[4]), ...top(z => world.acs(z, 'hisp')[1])]);
  for (const z of zs) {
    for (let h = 0; h < Math.min(pop.householdCount(z), 400); h++) {
      const c = pop.householdCore(z, h);
      if (!c.members.some(p => ['native', 'pacific', 'puertorican'].includes(p.heritage))) continue;
      for (const p of pop.members(z, h)) {
        const tail = p.birthplace.split(', ').pop();
        if (p.nativity === 'foreign') assert.ok(!US_STATES.has(tail) && !/Puerto Rico|Guam|American Samoa|Northern Mariana/.test(p.birthplace), `${p.id} foreign born in ${p.birthplace}`);
        if (p.heritage === 'puertorican') {
          pr++;
          if (/Puerto Rico$/.test(p.birthplace)) { prIsland++; assert.equal(p.nativity, 'native'); assert.equal(p.generation, 3); assert.equal(p.arrivalYear, null); assert.ok(p.mainlandYear >= p.birthYear); }
        } else if (p.heritage === 'pacific') {
          pac++;
          // born in Hawaii: born in a state, so native born and never an immigrant; a Native Hawaiian's English is a native speaker's
          if (/Hawaii$/.test(p.birthplace)) { hawaii++; assert.equal(p.nativity, 'native'); assert.notEqual(p.generation, 1); assert.equal(p.mainlandYear, null); if (p.languages.english === 'limited') hawaiiLimited++; }
          if (p.origin === 'nativehawaiian') assert.notEqual(p.languages.english, 'limited', `${p.id} a Native Hawaiian with limited English`);
          if (p.languages.home === 'hawaiian') hawaiian++;
        } else if (p.heritage === 'native') {
          native++;
          if (p.languages.home === 'navajo') navajo++;
          // born abroad: Indigenous Mexican and Maya immigrants (or a child who came along with an immigrant parent)
          if (p.nativity === 'foreign') { nativeForeign++; if (/Oaxaca|Guerrero|Guatemala/.test(p.birthplace)) indigenousPlace++; }
        }
      }
    }
  }
  console.log(`Puerto Ricans ${pr} (island born ${prIsland}), Pacific Islanders ${pac} (Hawaii born ${hawaii}), Native Americans ${native} (Navajo at home ${navajo}, born abroad ${nativeForeign})`);
  assert.ok(prIsland > 20 && hawaii > 20 && native > 2000 && nativeForeign > 20);
  assert.ok(indigenousPlace / nativeForeign > 0.8, `Native Americans born abroad in Oaxaca, Guerrero or Guatemala: ${indigenousPlace} of ${nativeForeign}`);
  assert.ok(navajo / native < 0.06, `Navajo spoken at home by ${pts(navajo / native)}% of Native Californians`);
  assert.ok(hawaiian / pac < 0.01, `Hawaiian spoken at home by ${pts(hawaiian / pac)}% of Pacific Islanders`);
  assert.ok(hawaiiLimited / hawaii < 0.03, `limited English among the Hawaii born: ${hawaiiLimited} of ${hawaii}`);
});

test('occupations fit the place and the person', () => {
  const titles = (group, zip, n = 1500, opts = {}) => {
    const r = new Rng(9), c = {};
    for (let k = 0; k < n; k++) { const o = pickOccupation(r, { group, world, zi: zi(zip), sex: k % 2 ? 'F' : 'M', age: 30 + (k % 30), education: 'hs', ...opts }); c[o.key] = (c[o.key] || 0) + 1; }
    return k => (c[k] || 0) / n;
  };
  const tulare = titles('farming', '93274');
  assert.ok(tulare('almond-worker') + tulare('vineyard-worker') + tulare('dairy-milker') + tulare('citrus-picker') > 0.5, 'San Joaquin Valley farmwork');
  const salinas = titles('farming', '93905');
  assert.ok(salinas('strawberry-picker') + salinas('lettuce-harvester') > 0.5, 'Central Coast strawberries and lettuce');
  const eureka = titles('farming', '95501');
  assert.ok(eureka('fishing-deckhand') + eureka('forestry-technician') + eureka('logger') > 0.3, 'North Coast fishing and forestry');
  assert.ok(titles('computer', '94043', 1500, { education: 'bachelor' })('software-developer') > titles('computer', '93727', 1500, { education: 'bachelor' })('software-developer') * 2, 'software in the Bay Area');
  assert.ok(titles('arts', '90028')('film-grip') > 0.2, 'film and TV in Los Angeles');
  assert.ok(titles('moving', '91761')('warehouse-associate') > 0.6, 'warehouses in the Inland Empire');
  assert.ok(titles('moving', '90744')('longshore-worker') > 0.1 && titles('moving', '91761')('longshore-worker') < 0.01, 'longshore work at the port');
  // the person: shift and working from home are honored, wages are California wages
  const r = new Rng(4);
  const nurse = pickOccupation(r, { group: 'practitioner', world, zi: zi('94110'), sex: 'F', age: 40, education: 'bachelor', shift: 'night' });
  assert.equal(nurse.shift, 'night');
  const remote = pickOccupation(r, { group: 'computer', world, zi: zi('94110'), sex: 'M', age: 30, education: 'bachelor', wfh: true });
  assert.equal(remote.wfh, true);
  assert.ok(TITLE.get(remote.key).wfh >= 1);
  // a licensed title needs its degree: a practitioner with a high school diploma is none of the licensed ones
  for (let k = 0; k < 200; k++) { const o = pickOccupation(r, { group: 'practitioner', world, zi: zi('94110'), age: 40, education: 'master' }); assert.ok(TITLE.get(o.key).edu <= 5, o.key); }
  for (let k = 0; k < 200; k++) { const x = chooseTitle(r, { group: 'legal', world, zi: zi('94110'), age: 40, education: 'bachelor' }); assert.notEqual(x.key, 'attorney'); assert.notEqual(x.key, 'judge'); }
  // the wage floor: a full-time minimum-wage salary in the lowest-paid county, for the least experienced
  assert.equal(MIN_WAGE_FULL_TIME, 35500);
  for (const g of [...OCC_GROUPS, 'military']) {
    assert.ok(GROUP_PROFILES[g] && OCCUPATION_CATALOG[g].length >= 6, g);
    for (const t of OCCUPATION_CATALOG[g]) {
      assert.ok(t.title && t.sector && t.employers.length && t.wage[0] >= 35200 && t.wage[1] > t.wage[0] && t.shifts.length, `${g} ${t.key}`);
      assert.ok(titleWage(t, { world, zi: zi('93234'), age: 18, education: 'nohs' }, 0) >= MIN_WAGE_FULL_TIME, `${g} ${t.key} pays the minimum`);
    }
    const o = pickOccupation(r, { group: g, world, zi: zi('92683') });
    assert.ok(o.wage >= MIN_WAGE_FULL_TIME && o.wage < 600000 && typeof o.employer === 'string');
  }
});
