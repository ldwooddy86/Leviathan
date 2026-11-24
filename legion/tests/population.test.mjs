// Population (CONTRACTS section 5): ids, determinism, the two layers, sampling, performance, calibration to the
// Census tables of thirteen ZIPs, heritage from the tables, household structure, commutes and occupations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Population, parseId, LEGION_SEED, HERITAGE_KEYS } from '../src/engine/population.mjs';
import { pickOccupation, OCCUPATION_CATALOG, OCC_GROUPS, GROUP_PROFILES, EDUCATION_LEVELS } from '../src/engine/occupations.mjs';
import { Rng, hash3, u01 } from '../src/engine/rng.mjs';

const world = await loadDefaultWorld();
const pop = new Population(world, { seed: LEGION_SEED });
const zi = zip => world.indexOf(zip);
const ZIPS = ['94110', '90001', '96161', '91205', '92683', '93727', '95993', '90813', '92617', '94015', '92252', '95501', '92101'];
const HISPANIC = new Set(['mexican', 'salvadoran', 'guatemalan', 'honduran', 'nicaraguan', 'puertorican', 'cuban', 'dominican', 'southamerican', 'spanish', 'latino']);
const ASIAN = new Set(['chinese', 'filipino', 'vietnamese', 'korean', 'japanese', 'indian', 'hmong', 'cambodian', 'lao', 'thai', 'pakistani', 'bangladeshi', 'sikh', 'afghan', 'burmese', 'indonesian', 'asian']);
const WHITE = new Set(['armenian', 'iranian', 'arab', 'assyrian', 'russian', 'ukrainian', 'polish', 'irish', 'italian', 'german', 'english', 'scottish', 'french', 'portuguese', 'dutch', 'scandinavian', 'greek', 'european', 'american']);
const tvd = (a = {}, b = {}) => { let s = 0; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) s += Math.abs((a[k] || 0) - (b[k] || 0)); return s / 2; };
const pts = x => (100 * x).toFixed(1);

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
    const z = zi(zip);
    let persons = 0;
    for (let h = 0; h < 2000; h++) { const c = pop.householdCore(z, h); assert.equal(pop.householdSize(z, h), c.size); assert.equal(c.members.length, c.size); persons += c.size; }
    const expected = 2000 * world.z.hhsize[z];
    assert.ok(Math.abs(persons - expected) / expected < 0.04, `${zip}: ${persons} persons in 2000 households, ACS ${world.z.hhsize[z]} per household`);
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
        assert.deepEqual([p.commute.mode, p.commute.minutes, p.commute.departMin, p.commute.dwellMin, p.commute.days, p.commute.workZi], [pc.mode, pc.commuteMin, pc.departMin, pc.dwellMin, pc.days, pc.workZi], `${p.id} commute`);
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
        if (p.veteran) assert.ok(p.age >= 18 && !pc.military);
        // origin, language and nativity
        assert.ok(['hispanic', 'white', 'black', 'asian', 'aian', 'nhpi', 'multi', 'other'].includes(p.race));
        if (HISPANIC.has(p.heritage)) assert.equal(p.race, 'hispanic');
        if (ASIAN.has(p.heritage)) assert.equal(p.race, 'asian');
        assert.equal(p.languages.english === 'only', p.languages.home === 'english');
        assert.ok(p.languages.list.includes(p.languages.home));
        if (p.nativity === 'foreign') { assert.equal(p.generation, 1); assert.ok(p.arrivalYear >= p.birthYear && p.arrivalYear <= 2026); } else assert.ok([1, 2, 3].includes(p.generation));
        assert.ok(p.name.full === `${p.name.first} ${p.name.last}` && p.name.display.length > 0);
        assert.equal(p.household.members[m].name, p.name.display);
        assert.equal(p.place.zip, zip);
        assert.ok(Number.isInteger(p.seed) && p.seed >= 0);
      });
      // children of immigrants who were born here are second generation
      const kids = core.members.filter(x => x.role === 'child').map(x => pop.person(z, h, x.m));
      const parentsAbroad = pop.person(z, h, 0).nativity === 'foreign';
      if (parentsAbroad) for (const k of kids) if (k.nativity === 'native' && k.age < 2026 - pop.person(z, h, 0).arrivalYear) assert.equal(k.generation, 2);
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

test('performance: householdCore under 5 microseconds, person under 0.3 ms', () => {
  const zs = ZIPS.map(zi);
  world.raster(); world.placesIn(zs[0]);           // the world's one-time indexes
  for (const z of zs) pop.householdCore(z, 0);      // the per-ZIP models (built once, about a millisecond each)
  let t0 = performance.now(), acc = 0;
  const N = 50000;
  for (let k = 0; k < N; k++) acc += pop.householdCore(zs[k % zs.length], 1000 + Math.floor(k / zs.length)).size;
  const core = (performance.now() - t0) * 1000 / N;
  // people: the ZIPs' layer-1 models exist; every person is new to the cache
  for (const z of zs) pop.person(z, 0, 0);
  t0 = performance.now();
  let np = 0;
  for (let k = 0; k < 2600; k++) { const z = zs[k % zs.length], h = 5000 + Math.floor(k / zs.length) * 3; if (h >= world.z.hh[z]) continue; acc += pop.person(z, h, 0).age; np++; }
  const person = (performance.now() - t0) / np;
  console.log(`householdCore ${core.toFixed(2)} us on average over ${N} households; person ${(1000 * person).toFixed(1)} us over ${np}`);
  assert.ok(acc > 0);
  assert.ok(core < 5, `householdCore ${core.toFixed(2)} us`);
  assert.ok(person < 0.3, `person ${person.toFixed(3)} ms`);
});

const fits = new Map();
const fidelity = zip => { if (!fits.has(zip)) fits.set(zip, pop.validate(zi(zip), 3000)); return fits.get(zip); };

test('calibration: households, ages, race, work and commutes match the Census tables', () => {
  for (const zip of ZIPS) {
    const v = fidelity(zip), g = v.generated, a = v.acs, t = v.target, s = v.scalars, gq = v.gq.share > 0.2;
    const at = `${zip} ${v.city}`;
    for (const k of Object.keys(a.hht)) assert.ok(Math.abs((g.hht[k] || 0) - a.hht[k]) < 0.04, `${at} household type ${k}: ${pts(g.hht[k] || 0)} vs ${pts(a.hht[k])}`);
    assert.ok(Math.abs(s.hhsize.generated - s.hhsize.acs) < 0.08, `${at} mean household size ${s.hhsize.generated.toFixed(2)} vs ${s.hhsize.acs}`);
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

test('households are realistic: spouses near in age, children younger, roommates young, living alone older', () => {
  const gap = [], child = [], alone = [], rooms = [];
  let big = 0, bigMulti = 0, small = 0, smallMulti = 0;
  for (const zip of ['90001', '94110', '92617', '93727', '92683']) {
    const z = zi(zip);
    for (let h = 0; h < 2500; h++) {
      const c = pop.householdCore(z, h), hd = c.members[0];
      if (c.type === 'alone') alone.push(hd.age);
      const multi = c.members.some(p => p.role === 'parent' || p.role === 'grandchild');
      if (c.size >= 5) { big++; if (multi) bigMulti++; } else if (c.size >= 3) { small++; if (multi) smallMulti++; }
      for (const p of c.members) {
        if (p.role === 'spouse') gap.push(Math.abs(p.age - hd.age));
        if (p.role === 'child') child.push(hd.age - p.age);
        if (p.role === 'roommate' && zip === '92617') rooms.push(p.age);
      }
    }
  }
  const share = (a, f) => a.filter(f).length / a.length, mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(share(gap, g => g <= 12) > 0.95, 'spouses within 12 years');
  assert.ok(Math.min(...child) >= 15, 'children at least 15 years younger than the householder');
  assert.ok(share(rooms, a => a >= 18 && a < 35) > 0.7, 'roommates near a campus are young adults');
  assert.ok(mean(alone) > mean(rooms) + 15, 'people living alone are older than roommates');
  assert.ok(bigMulti / big > 1.5 * smallMulti / small, 'parents and grandchildren live in the larger family households');
});

test('commutes: distance fits mode and time; departures fit the job; children go to school on weekdays', () => {
  const dep = {}, walk = [], longDrive = [];
  let kids = 0;
  for (const zip of ['90001', '94110', '93727', '92683', '95993']) {
    const z = zi(zip);
    for (let h = 0; h < 2500; h++) {
      const c = pop.householdCore(z, h);
      for (const p of c.members) {
        if (p.student === 'k12') {
          kids++;
          assert.equal(p.days, 62, 'school Monday to Friday');
          assert.ok(p.departMin >= 420 && p.departMin <= 500, `leaves for school at ${p.departMin}`);
          assert.equal(p.workZi, z, 'school in the home ZIP');
          continue;
        }
        if (!p.worker || p.mode === 'wfh') continue;
        const km = world.distKm(c.home.x, c.home.y, p.work.x, p.work.y);
        if (p.mode === 'walk') walk.push(km);
        if ((p.mode === 'drive' || p.mode === 'carpool') && p.commuteMin >= 45) longDrive.push(km);
        (dep[p.occ || 'military'] = dep[p.occ || 'military'] || []).push(p.departMin);
        if (p.shift === 'h24') assert.equal(p.dwellMin, 1440);
      }
    }
  }
  const med = a => [...a].sort((x, y) => x - y)[a.length >> 1], share = (a, f) => a.filter(f).length / a.length;
  assert.ok(kids > 2000);
  assert.ok(share(walk, d => d < 6) > 0.9, `walkers within 6 km: ${pts(share(walk, d => d < 6))}%`);
  assert.ok(share(longDrive, d => d > 10) > 0.75, `drives of 45+ minutes go far: ${pts(share(longDrive, d => d > 10))}%`);
  assert.ok(med(dep.construction) < med(dep.office) - 60 && med(dep.farming) < med(dep.office) - 60, 'builders and farmworkers leave early');
  assert.ok(med(dep.office) >= 400 && med(dep.office) <= 540, 'offices start 7 to 9');
  const late = a => share(a, d => d >= 13 * 60);
  assert.ok(late(dep.food) > 0.25 && late(dep.healthsupport) > 0.2 && late(dep.office) < 0.1, 'food and care work evenings and nights');
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
  for (const g of [...OCC_GROUPS, 'military']) {
    assert.ok(GROUP_PROFILES[g] && OCCUPATION_CATALOG[g].length >= 6, g);
    for (const t of OCCUPATION_CATALOG[g]) assert.ok(t.title && t.sector && t.employers.length && t.wage[0] > 15000 && t.wage[1] >= t.wage[0] && t.shifts.length, `${g} ${t.key}`);
    const o = pickOccupation(r, { group: g, world, zi: zi('92683') });
    assert.ok(o.wage > 10000 && o.wage < 600000 && typeof o.employer === 'string');
  }
});
