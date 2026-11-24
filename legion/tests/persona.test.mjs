// Persona: determinism, the representation rules, data grounding on real ZIPs, memory eligibility, speech,
// knowledge and the 3 ms budget. Runs against whatever population.mjs is in place (stub or calibrated).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Population, LEGION_SEED } from '../src/engine/population.mjs';
import {
  persona, personality, traitBasis, big5Prior, traitWords, codeSwitchOf, archetypeOf, valuesOf,
  SCHWARTZ_VALUES, PROTECTED_FIELDS, REF_YEAR,
} from '../src/engine/persona.mjs';
import { Rng } from '../src/engine/rng.mjs';

const world = await loadDefaultWorld();
const pop = new Population(world, { seed: LEGION_SEED });
const SPREAD = ['94110', '90001', '90265', '96161', '92262', '95521', '93721', '92101', '95014', '96001', '93901', '92243', '91342', '95814', '93117', '92335', '94501', '96150'];

/** People of a ZIP, household by household, that satisfy pred (up to n, scanning at most maxHH households). */
function peopleOf(zip, n, pred = () => true, maxHH = 4000) {
  const zi = world.indexOf(zip), H = world.z.hh[zi] || 0, out = [];
  for (let h = 0; h < Math.min(H, maxHH) && out.length < n; h++) {
    const core = pop.householdCore(zi, h);
    for (let m = 0; m < core.size && out.length < n; m++) { const npc = pop.person(zi, h, m); if (npc && pred(npc)) out.push(npc); }
  }
  return out;
}
const adults = (zip, n, pred = () => true) => peopleOf(zip, n, p => p.age >= 25 && pred(p));
const P = npc => persona(world, npc, { population: pop });
const strip = p => { const { npc, routine, ...rest } = p; return JSON.parse(JSON.stringify(rest)); };

test('persona is deterministic and has the contract shape', () => {
  const sample = SPREAD.flatMap(zip => peopleOf(zip, 3));
  assert.ok(sample.length >= 40);
  const other = new Population(world, { seed: LEGION_SEED }); // a second instance: no hidden state between them
  for (const npc of sample) {
    const a = P(npc);
    const b = persona(world, structuredClone(npc), { population: other });
    assert.deepEqual(strip(a), strip(b), npc.id);
    assert.equal(a.id, npc.id);
    assert.equal(a.npc, npc);
    for (const k of ['O', 'C', 'E', 'A', 'N']) assert.ok(a.big5[k] >= 0 && a.big5[k] <= 1, `${npc.id} big5.${k}`);
    assert.ok(a.traits.length >= 3 && a.traits.length <= 5 && new Set(a.traits).size === a.traits.length, `${npc.id} traits ${a.traits}`);
    assert.ok(typeof a.archetype === 'string' && a.archetype.length > 2);
    assert.equal(a.values.length, 3);
    assert.equal(new Set(a.values).size, 3);
    for (const v of a.values) assert.ok(SCHWARTZ_VALUES.includes(v), v);
    assert.ok(a.interests.length >= 3 && a.interests.length <= 6, `${npc.id} interests ${a.interests}`);
    assert.ok(a.interests.every(i => typeof i === 'string' && i.length > 1));
    for (const c of a.concerns) {
      assert.ok(typeof c.topic === 'string' && c.weight >= 0 && c.weight <= 1, JSON.stringify(c));
      assert.ok(typeof c.why === 'string' && /\(\w+[\w ,]*\)|\(ACS|\(NWS|\(Caltrans/.test(c.why), `why names its datum: ${c.why}`);
    }
    for (const m of a.memories) {
      assert.ok(Number.isInteger(m.year) && typeof m.kind === 'string' && typeof m.text === 'string' && typeof m.source === 'string');
      assert.ok(m.weight >= 0 && m.weight <= 1);
      assert.ok(m.date === null || /^\d{4}-\d{2}-\d{2}$/.test(m.date), m.date);
    }
    const k = a.knowledge;
    assert.equal(k.neighborhood, world.zip(npc.zi).placeName);
    assert.equal(k.county, world.zip(npc.zi).countyName);
    assert.ok(k.landmarks.length <= 5 && k.landmarks.every(l => l.name && Number.isFinite(l.distKm)));
    assert.ok(Array.isArray(k.roads) && Array.isArray(k.nearbyPlaces));
    const s = a.speech;
    assert.ok(['casual', 'neutral', 'formal'].includes(s.register));
    for (const f of ['verbosity', 'slang', 'humor', 'directness']) assert.ok(s[f] >= 0 && s[f] <= 1, f);
    assert.ok(Array.isArray(s.fillers) && Array.isArray(s.catchphrases));
    const sentences = a.bio.split(/(?<=\.)\s+(?=[A-Z])/);
    assert.ok(sentences.length >= 2 && sentences.length <= 3, a.bio);
    assert.ok(a.hooks.length >= 3 && a.hooks.length <= 5, `${npc.id} hooks ${a.hooks}`);
    assert.equal(a.hooks.length, a.hookDetails.length);
  }
});

test('personality never reads race, heritage, nativity, languages, religion or names', () => {
  const basis = traitBasis(world, pop.person(world.indexOf('94110'), 3, 0));
  assert.deepEqual(Object.keys(basis).sort(), ['age', 'density', 'seed', 'sex']);
  for (const f of PROTECTED_FIELDS) assert.ok(!(f in basis), f);
  // the functions that decide character do not even mention the protected fields
  for (const fn of [personality, big5Prior, traitWords, archetypeOf, valuesOf]) {
    assert.ok(!/\b(race|heritage|nativity|languages?|religion|birthplace|arrivalYear|generation)\b|\.name\b/.test(fn.toString()), fn.name);
  }
  const variants = [
    { race: 'asian', heritage: 'vietnamese', heritageLabel: 'Vietnamese American', nativity: 'foreign', generation: 1, arrivalYear: 1995, birthplace: 'Saigon, Vietnam', languages: { home: 'vietnamese', english: 'limited', list: ['vietnamese', 'english'] }, name: { first: 'Linh', last: 'Nguyen', full: 'Linh Nguyen', display: 'Linh Nguyen', nick: null }, religion: 'buddhist' },
    { race: 'hispanic', heritage: 'mexican', heritageLabel: 'Mexican American', nativity: 'native', generation: 2, arrivalYear: null, birthplace: 'Fresno, California', languages: { home: 'spanish', english: 'very well', list: ['spanish', 'english'] }, name: { first: 'Rosa', last: 'Garcia', full: 'Rosa Garcia', display: 'Rosa Garcia', nick: 'Rosie' }, religion: 'catholic' },
    { race: 'white', heritage: 'armenian', heritageLabel: 'Armenian American', nativity: 'foreign', generation: 1, arrivalYear: 2004, birthplace: 'Yerevan, Armenia', languages: { home: 'armenian', english: 'very well', list: ['armenian', 'english'] }, name: { first: 'Aram', last: 'Petrosyan', full: 'Aram Petrosyan', display: 'Aram Petrosyan', nick: null } },
    { race: 'black', heritage: 'african-american', heritageLabel: 'African American', nativity: 'native', generation: 3, arrivalYear: null, birthplace: 'Ohio', languages: { home: 'english', english: 'only', list: ['english'] }, name: { first: 'Dana', last: 'Brooks', full: 'Dana Brooks', display: 'Dana Brooks', nick: null } },
  ];
  const sample = SPREAD.flatMap(zip => peopleOf(zip, 4));
  for (const npc of sample) {
    const base = P(npc);
    for (const v of variants) {
      const other = Object.assign(structuredClone(npc), structuredClone(v));
      const q = P(other);
      assert.deepEqual(q.big5, base.big5, `${npc.id} big5`);
      assert.deepEqual(q.traits, base.traits, `${npc.id} traits`);
      assert.deepEqual(q.values, base.values, `${npc.id} values`);
      assert.equal(q.archetype, base.archetype, `${npc.id} archetype`);
    }
  }
});

test('Big Five priors follow age and sex as the literature says, with an individual spread', () => {
  const mean = (basis, k, n = 4000) => { let s = 0; for (let i = 0; i < n; i++) s += personality(Object.assign({ seed: 1000 + i }, basis)).big5[k]; return s / n; };
  const sd = (basis, k, n = 4000) => { const xs = []; for (let i = 0; i < n; i++) xs.push(personality(Object.assign({ seed: 1000 + i }, basis)).big5[k]); const m = xs.reduce((a, b) => a + b) / n; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / n); };
  const at = (age, sex = null, density = 2000) => ({ age, sex, density });
  assert.ok(mean(at(55), 'C') - mean(at(15), 'C') > 0.06, 'conscientiousness rises from the teens to middle age');
  assert.ok(mean(at(15), 'C') < mean(at(10), 'C'), 'teens dip in conscientiousness');
  assert.ok(mean(at(70), 'A') - mean(at(20), 'A') > 0.04, 'agreeableness rises with age');
  assert.ok(mean(at(20), 'N') - mean(at(68), 'N') > 0.04, 'neuroticism falls with age');
  assert.ok(mean(at(35), 'O') - mean(at(80), 'O') > 0.02, 'openness eases in later life');
  assert.ok(mean(at(25), 'E') - mean(at(80), 'E') > 0.02, 'extraversion eases in later life');
  const dA = mean(at(40, 'F'), 'A') - mean(at(40, 'M'), 'A'), dN = mean(at(40, 'F'), 'N') - mean(at(40, 'M'), 'N');
  assert.ok(dA > 0.03 && dA < 0.08, `women slightly more agreeable on average: ${dA}`);
  assert.ok(dN > 0.04 && dN < 0.09, `women slightly higher in neuroticism on average: ${dN}`);
  const dO = mean(at(40, null, 20000), 'O') - mean(at(40, null, 100), 'O'), dC = mean(at(40, null, 100), 'C') - mean(at(40, null, 20000), 'C');
  assert.ok(dO > 0.008 && dO < 0.025, `dense cores slightly more open: ${dO}`);
  assert.ok(dC > 0.004 && dC < 0.02, `rural slightly more conscientious: ${dC}`);
  const s = sd(at(40), 'E');
  assert.ok(s > 0.12 && s < 0.17, `individual spread about 0.15: ${s}`);
});

test('traits are the adjectives of the strongest deviations', () => {
  const r = () => new Rng(5);
  const t1 = traitWords({ O: 0.5, C: 0.95, E: 0.5, A: 0.5, N: 0.05 }, r());
  assert.ok(t1.some(w => ['organized', 'dependable', 'punctual', 'hardworking', 'meticulous', 'driven', 'perfectionist'].includes(w)), t1.join());
  assert.ok(t1.some(w => ['calm', 'steady', 'unflappable', 'even-keeled', 'stoic', 'gentle'].includes(w)), t1.join());
  const t2 = traitWords({ O: 0.5, C: 0.5, E: 0.05, A: 0.5, N: 0.5 }, r());
  assert.ok(t2.some(w => ['reserved', 'quiet', 'private', 'reflective'].includes(w)), t2.join());
  assert.ok(t2.length >= 3 && t2.length <= 5);
});

test('a long-time Malibu homeowner remembers the Woolsey Fire and worries about fire and insurance', () => {
  const owners = adults('90265', 25, p => p.household && p.household.tenure === 'own' && ['householder', 'spouse', 'partner'].includes(p.role));
  assert.ok(owners.length >= 10, `owners found: ${owners.length}`);
  let checked = 0, both = 0;
  for (const npc of owners) {
    const p = P(npc);
    if (p.residence.zipSince > 2017 || npc.birthYear > 2010) continue;
    checked++;
    const woolsey = p.memories.find(m => m.kind === 'fire' && /Woolsey/.test(m.text));
    assert.ok(woolsey, `${npc.id} (since ${p.residence.zipSince}) remembers Woolsey: ${p.memories.map(m => m.title).join(' | ')}`);
    assert.equal(woolsey.year, 2018);
    assert.equal(woolsey.date, '2018-11-08');
    assert.match(woolsey.text, /1,203 structures/);
    const topics = p.concerns.map(c => c.topic);
    if (topics.includes('fire') && topics.includes('insurance')) both++;
    const fire = p.concerns.find(c => c.topic === 'fire');
    assert.ok(fire && /fhsz_vh/.test(fire.why), `${npc.id} fire concern`);
    const ins = p.concerns.find(c => c.topic === 'insurance');
    if (ins) assert.match(ins.why, /nonren_sh.*fair_sh/);
  }
  assert.ok(checked >= 8, `long-time owners checked: ${checked}`);
  assert.ok(both / checked >= 0.8, `fire and insurance for ${both}/${checked}`);
});

test('Truckee has snow, Palm Springs heat, Arcata rain and storms', () => {
  const share = (zip, pred, n = 40) => { const ps = adults(zip, n).map(P); return ps.filter(pred).length / ps.length; };
  const snowy = p => p.concerns.some(c => c.topic === 'snow' && /snowfall_in|snow_psf/.test(c.why));
  assert.ok(share('96161', snowy) >= 0.85, 'Truckee adults worry about snow');
  assert.ok(share('96161', p => p.interests.some(i => /ski|snowshoe/.test(i))) >= 0.3, 'Truckee adults ski');
  const hot = p => p.concerns.some(c => c.topic === 'heat' && /h100/.test(c.why));
  assert.ok(share('92262', hot) >= 0.9, 'Palm Springs adults worry about the heat');
  assert.ok(share('92262', p => p.concerns.slice(0, 2).some(c => c.topic === 'heat')) >= 0.65, 'and for most it is a top worry');
  const wet = p => p.concerns.some(c => (c.topic === 'storms' || c.topic === 'flooding') && /ar_n/.test(c.why));
  assert.ok(share('95521', wet) >= 0.85, 'Arcata adults worry about storms');
  const arcata = adults('95521', 40).map(P).filter(p => p.residence.countySince <= 2015);
  assert.ok(arcata.length >= 5);
  assert.ok(arcata.filter(p => p.memories.some(m => m.kind === 'storm')).length / arcata.length >= 0.8, 'long-time Arcata residents remember the storms');
});

test('nobody remembers an event from before they lived in the county (unless they grew up there)', () => {
  const sample = SPREAD.flatMap(zip => peopleOf(zip, 25));
  assert.ok(sample.length >= 300);
  let events = 0;
  for (const npc of sample) {
    const p = P(npc), res = p.residence, born = npc.birthYear ?? REF_YEAR - npc.age;
    assert.ok(res.countySince <= res.zipSince && res.countySince >= born && res.zipSince <= REF_YEAR, `${npc.id} ${JSON.stringify(res)}`);
    if (npc.nativity === 'foreign' && Number.isFinite(npc.arrivalYear)) assert.ok(res.countySince >= Math.min(npc.arrivalYear, REF_YEAR));
    for (const m of p.memories) {
      assert.ok(m.year <= REF_YEAR, `${npc.id} ${m.title}`);
      if (m.kind === 'life') { assert.ok(m.year >= born, `${npc.id} life ${m.text}`); continue; }
      events++;
      assert.ok(m.year >= res.countySince, `${npc.id} remembers ${m.title} (${m.year}) but has lived in the county since ${res.countySince}`);
      assert.ok(m.year - born >= 7, `${npc.id} remembers ${m.title} at age ${m.year - born}`);
      if (m.scope === 'zip') assert.ok(m.year >= res.zipSince, `${npc.id} ${m.title}`);
    }
    for (const m of p.memories.filter(x => /was born in/.test(x.text) && x.source === 'household.members')) assert.ok(m.year - born >= 15, `${npc.id} parent at ${m.year - born}: ${m.text}`);
  }
  assert.ok(events > 200, `event memories checked: ${events}`);
  // a newcomer who arrived in 2020 does not remember the 2018 fire; someone who grew up in the county does
  const base = adults('90265', 1, p => p.household && p.household.tenure === 'own')[0];
  const newcomer = Object.assign(structuredClone(base), { nativity: 'foreign', generation: 1, arrivalYear: 2020, birthplace: 'Toronto, Canada' });
  newcomer.household.yearMoved = 2021;
  const pn = P(newcomer);
  assert.ok(pn.residence.countySince >= 2020);
  assert.ok(!pn.memories.some(m => /Woolsey/.test(m.text)), pn.memories.map(m => m.title).join(' | '));
  const local = Object.assign(structuredClone(base), { nativity: 'native', generation: 3, arrivalYear: null, birthplace: 'Malibu, California', age: 34, birthYear: REF_YEAR - 34 });
  local.household.yearMoved = 2021;
  const pl = P(local);
  assert.equal(pl.residence.grewUpHere, true);
  const w = pl.memories.find(m => /Woolsey/.test(m.text));
  // they lived elsewhere in the county then: a county-scope memory, told from across the county, not an evacuation
  assert.ok(w && w.scope === 'county' && /county/i.test(w.experience) && !/evacuat/.test(w.experience), pl.memories.map(m => m.text).join(' | '));
});

test('facts in memories and concerns come from the pack', () => {
  for (const zip of ['90265', '95521', '92262', '96001', '94110']) {
    const zi = world.indexOf(zip), z = world.zip(zi);
    const fires = world.firesOf(zi), ars = world.arsOf(zi, 12), fema = world.femaOf(zi);
    for (const npc of adults(zip, 15)) {
      for (const m of P(npc).memories) {
        if (m.source.startsWith('firesOf')) assert.ok(fires.some(f => m.text.includes(f.name.replace(/\s+/g, ' ')) && f.year === m.year && (f.start || null) === m.date), m.text);
        if (m.source.startsWith('arsOf')) assert.ok(ars.some(a => a.start === m.date && m.text.includes(`category ${a.rank}`)), m.text);
        if (m.source.startsWith('femaOf')) assert.ok(fema.some(f => f[0] === m.date && m.text.includes(f[2].replace(/\s+/g, ' '))), m.text);
        if (m.kind === 'heat') assert.ok(m.text.includes(`${z.heat_rec_f}°F`), m.text);
        if (m.kind === 'rain') assert.ok(m.text.includes(`${z.rain_rec_in} inches`), m.text);
        if (m.kind === 'gust') assert.ok(m.text.includes(`${z.gust_max} mph`), m.text);
      }
    }
  }
});

test('speech: code-switching only for non-English home languages, rates ordered by generation', () => {
  const mk = (home, english, generation) => ({ languages: { home, english, list: [home, 'english'] }, generation, nativity: generation === 1 ? 'foreign' : 'native' });
  assert.equal(codeSwitchOf(mk('english', 'only', 3), 1), null);
  assert.equal(codeSwitchOf({}, 1), null);
  const rates = { g1lim: [], g1well: [], g2: [], g3: [] };
  for (let s = 0; s < 300; s++) {
    rates.g1lim.push(codeSwitchOf(mk('spanish', 'limited', 1), s).rate);
    rates.g1well.push(codeSwitchOf(mk('tagalog', 'very well', 1), s).rate);
    rates.g2.push(codeSwitchOf(mk('vietnamese', 'very well', 2), s).rate);
    rates.g3.push(codeSwitchOf(mk('armenian', 'very well', 3), s).rate);
  }
  const lo = a => Math.min(...a), hi = a => Math.max(...a);
  assert.ok(lo(rates.g1lim) > hi(rates.g1well), 'limited English switches most');
  assert.ok(lo(rates.g1well) > hi(rates.g2), 'first generation more than second');
  assert.ok(lo(rates.g2) > hi(rates.g3), 'second generation more than third');
  assert.ok(hi(rates.g3) <= 0.05, 'third generation almost never');
  assert.ok(lo(rates.g1lim) >= 0.5, 'first generation with limited English mostly speaks their language');
  const npc = structuredClone(adults('90001', 1)[0]);
  Object.assign(npc, mk('spanish', 'limited', 1), { arrivalYear: 2001, birthplace: 'Guadalajara, Jalisco' });
  const p = P(npc);
  assert.deepEqual(Object.keys(p.speech.codeSwitch).sort(), ['lang', 'rate']);
  assert.equal(p.speech.codeSwitch.lang, 'spanish');
  assert.ok(p.concerns.some(c => c.topic === 'family abroad' && /arrivalYear/.test(c.why)));
  assert.ok(p.memories.some(m => m.text === 'I came to the US in 2001 from Guadalajara, Jalisco.'));
  Object.assign(npc, mk('english', 'only', 3));
  assert.equal(P(npc).speech.codeSwitch, null);
});

test('the dialect comes from opts.dialectFor, else the region key', () => {
  const npc = adults('90265', 1)[0];
  assert.equal(persona(world, npc, { population: pop, dialectFor: (w, zi) => `test-${w.zips[zi]}` }).speech.dialect, 'test-90265');
  assert.equal(P(npc).speech.dialect, 'la');
  assert.equal(persona(world, npc, { population: pop, dialectFor: () => { throw new Error('boom'); } }).speech.dialect, 'la');
});

test('knowledge covers the neighborhood, landmarks and the roads near home and on the commute', () => {
  let commuters = 0, withCommuteRoad = 0;
  for (const zip of ['91342', '95014', '92101', '93721']) {
    for (const npc of adults(zip, 30, p => p.commute && p.commute.mode === 'drive' && p.commute.minutes >= 25)) {
      const p = P(npc);
      commuters++;
      if (p.knowledge.roads.some(r => r.commute)) withCommuteRoad++;
      assert.ok(p.knowledge.roads.every(r => typeof r.name === 'string'));
      assert.ok(p.knowledge.landmarks.length > 0);
      assert.ok(p.knowledge.nearbyPlaces.every(x => x.name !== p.knowledge.neighborhood));
    }
  }
  assert.ok(commuters >= 10, `drivers: ${commuters}`);
  assert.ok(withCommuteRoad / commuters >= 0.6, `commute roads known by ${withCommuteRoad}/${commuters}`);
  const tahoe = P(adults('96161', 1)[0]);
  assert.ok(tahoe.knowledge.landmarks.some(l => /Donner/.test(l.name)), tahoe.knowledge.landmarks.map(l => l.name).join());
  assert.ok(tahoe.knowledge.roads.some(r => r.name === 'I-80'));
});

test('a cultural tradition is a modest, generation-modulated extra, never the main thing', () => {
  const people = SPREAD.flatMap(zip => peopleOf(zip, 40, p => p.age >= 10));
  const rate = gen => {
    let n = 0, hits = 0;
    for (const npc of people) {
      const p = P(Object.assign(structuredClone(npc), { heritage: 'vietnamese', heritageLabel: 'Vietnamese American', generation: gen, nativity: gen === 1 ? 'foreign' : 'native' }));
      const at = p.interestDetails.findIndex(d => d.tradition);
      n++;
      if (at >= 0) { hits++; assert.ok(at >= 2, `${npc.id}: the tradition is never one of the first two interests (${p.interests})`); }
    }
    return hits / n;
  };
  const g1 = rate(1), g2 = rate(2), g3 = rate(3);
  assert.ok(g1 > g2 && g2 > g3, `${g1} ${g2} ${g3}`);
  assert.ok(g1 < 0.45 && g3 < 0.16 && g3 > 0, `${g1} ${g3}`);
});

test('missing optional fields never throw', () => {
  const npc = adults('93721', 1)[0];
  const bare = { id: npc.id, zip: npc.zip, h: npc.h, m: npc.m, age: npc.age, sex: npc.sex };
  const p = persona(world, bare, {});
  assert.ok(p.big5 && p.bio && p.hooks.length >= 3);
  const odd = Object.assign(structuredClone(npc), { occupation: null, commute: null, household: null, name: null, languages: null, birthYear: undefined, seed: undefined, place: null, status: undefined });
  const q = persona(world, odd, { population: pop });
  assert.ok(q.traits.length >= 3 && q.concerns.length >= 1);
  assert.throws(() => persona(world, { id: 'x', zip: '00000' }), /no ZIP/);
});

test('performance: persona under 3 ms on average over 500 NPCs', () => {
  const sample = pop.sampleState(520, 11).filter(Boolean);
  for (const npc of sample.slice(0, 20)) P(npc); // first calls build the world's spatial indexes
  const run = sample.slice(20, 520);
  assert.ok(run.length >= 450);
  const t0 = performance.now();
  for (const npc of run) P(npc);
  const avg = (performance.now() - t0) / run.length;
  assert.ok(avg < 3, `persona ${avg.toFixed(3)} ms`);
});

// ---------------------------------------------------------------- robustness: every contract field, varied

const STATUSES = ['employed', 'unemployed', 'retired', 'student', 'homemaker', 'child', 'military', 'not working', undefined];
const OCCS = ['management', 'business', 'computer', 'engineering', 'science', 'social', 'legal', 'education', 'arts', 'practitioner', 'healthtech', 'healthsupport', 'firefighting', 'police', 'food', 'cleaning', 'personalcare', 'sales', 'office', 'farming', 'construction', 'repair', 'production', 'transport', 'moving'];
const TITLES = ['Registered nurse', 'Heavy and tractor-trailer truck driver', 'Farmworker', 'Line cook', 'Software developer', 'Elementary school teacher', 'Janitor', 'Landscaper', 'Bus driver', 'Paralegal', 'Cashier', 'Carpenter', 'Police officer'];
const SHIFTS = ['day', 'night', 'early', 'evening', 'swing', 'graveyard', 'rotating', 'split', '', null, undefined];
const MODES = ['drive', 'carpool', 'bus', 'rail', 'ferry', 'taxi', 'motorcycle', 'bike', 'walk', 'other', 'wfh', null];
const HOMES = ['english', 'spanish', 'chinese', 'vietnamese', 'tagalog', 'korean', 'arabic', 'armenian', 'farsi', 'russian', 'punjabi', 'hindi', 'hmong', 'khmer', 'lao', 'japanese', 'portuguese', 'other'];
const HERITAGES = ['mexican', 'salvadoran', 'filipino', 'vietnamese', 'chinese', 'korean', 'armenian', 'iranian', 'sikh', 'hmong', 'cambodian', 'african-american', 'ethiopian', 'irish', 'italian', 'native', 'pacific', 'multiracial', 'other', 'american', 'latino', 'asian'];
const BIRTHPLACES = ['Guadalajara, Jalisco', 'Fresno, California', 'Los Angeles, California', 'Ohio', 'Manila, Philippines', 'Yerevan, Armenia', 'Saigon, Vietnam', null, '', 'Malibu, California', 'Texas'];

/** A contract-valid but varied copy of an NPC (what the calibrated population can produce). */
function vary(npc, r) {
  const v = structuredClone(npc);
  const pick = a => a[r.int(a.length)];
  v.status = pick(STATUSES);
  if (r.chance(0.6)) {
    v.occupation = { key: pick(OCCS), title: pick(TITLES), sector: 'private', employer: r.chance(0.5) ? 'a local employer' : 'the county hospital', shift: pick(SHIFTS), wfh: r.chance(0.15), wage: 20000 + r.int(150000) };
  } else v.occupation = r.chance(0.5) ? null : undefined;
  v.school = pick([null, 'preschool', 'elementary', 'middle', 'high', 'college', 'grad', undefined]);
  v.education = pick(['nohs', 'hs', 'somecollege', 'associate', 'bachelor', 'master', 'professional', 'doctorate', 'in school', 'child', undefined]);
  const foreign = r.chance(0.3);
  Object.assign(v, {
    heritage: pick(HERITAGES), heritageLabel: 'Somewhere American', race: pick(['hispanic', 'white', 'black', 'asian', 'aian', 'nhpi', 'multi', 'other']),
    nativity: foreign ? 'foreign' : 'native', generation: foreign ? 1 : 1 + r.int(3) + (r.chance(0.5) ? 1 : 0),
    arrivalYear: foreign ? (r.chance(0.9) ? Math.max(v.birthYear ?? 1990, 1950 + r.int(76)) : null) : null, birthplace: pick(BIRTHPLACES),
    languages: r.chance(0.1) ? undefined : { home: pick(HOMES), english: pick(['only', 'very well', 'limited']), list: ['english'] },
    name: r.chance(0.1) ? undefined : { first: 'Pat', last: 'Doe', full: 'Pat Doe', display: r.chance(0.2) ? '' : 'Pat Doe', nick: null },
    marital: pick(['never', 'married', 'separated', 'absent', 'widowed', 'divorced', undefined]), veteran: r.chance(0.08),
    income: r.chance(0.8) ? r.int(200000) : undefined, householdIncome: r.chance(0.9) ? 5000 + r.int(400000) : null,
  });
  if (v.household) {
    v.household.yearMoved = r.chance(0.9) ? 1960 + r.int(67) : undefined;
    v.household.yearBuilt = r.chance(0.9) ? 1900 + r.int(127) : null;
    v.household.dwelling = pick(['house', 'small-apartment', 'apartment', 'mobile-home', undefined]);
    v.household.tenure = pick(['own', 'rent', undefined]);
    v.household.members = (v.household.members || []).map(x => Object.assign({}, x, { name: r.chance(0.5) ? x.name : r.chance(0.5) ? { first: 'Kim', display: 'Kim Doe' } : undefined }));
  }
  if (v.commute && r.chance(0.5)) {
    const mode = pick(MODES);
    v.commute = Object.assign({}, v.commute, {
      mode, minutes: mode === 'wfh' ? 0 : r.int(120), departMin: mode && mode !== 'wfh' ? (r.chance(0.2) ? 18 * 60 + r.int(6 * 60) : 240 + r.int(600)) : r.chance(0.5) ? null : 480,
      dwellMin: r.int(700), days: pick([62, 124, 126, 65, 0, 127, 30]), road: r.chance(0.5) ? { name: 'I-5', route: 5, kind: 'I', distKm: 2, aadt: 200000 } : r.chance(0.5) ? 'US 101' : null,
    });
  }
  return v;
}

test('robustness: varied, contract-valid records never break the persona or the plan', async () => {
  const { dayPlan } = await import('../src/engine/schedule.mjs');
  const { atPacific } = await import('../src/engine/clock.mjs');
  const days = [atPacific(2026, 11, 24, 12, 0), atPacific(2026, 11, 29, 12, 0)];
  const r = new Rng(2026);
  const bad = /undefined|NaN|\bnull\b|\[object|\s{2,}|\s[,.;:]|,,/;
  let n = 0;
  for (const zip of SPREAD) for (const base of peopleOf(zip, 12)) for (let k = 0; k < 3; k++) {
    const npc = vary(base, r);
    const p = persona(world, npc, { population: r.chance(0.5) ? pop : undefined });
    n++;
    const res = p.residence, born = npc.birthYear ?? REF_YEAR - npc.age;
    assert.ok(res.countySince <= res.zipSince && res.countySince >= born, `${npc.id} ${JSON.stringify(res)}`);
    for (const m of p.memories) {
      assert.ok(m.year <= REF_YEAR && m.year >= born, `${npc.id} ${m.text}`);
      if (m.kind !== 'life') assert.ok(m.year >= res.countySince && m.year - born >= 7, `${npc.id} ${m.title} ${JSON.stringify(res)}`);
    }
    const strings = [p.bio, p.archetype, ...p.hooks, ...p.traits, ...p.interests, ...p.memories.map(m => m.text), ...p.concerns.map(c => c.why), ...p.speech.catchphrases];
    for (const s of strings) assert.ok(typeof s === 'string' && s.length && !bad.test(s), `${npc.id}: "${s}"`);
    assert.ok(p.hooks.length >= 3 && p.hooks.length <= 5 && p.traits.length >= 3 && p.values.length === 3);
    if (p.speech.codeSwitch) assert.ok(npc.languages && npc.languages.home !== 'english' && p.speech.codeSwitch.lang === npc.languages.home);
    for (const t of days) {
      const plan = dayPlan(npc, p, t);
      for (let i = 1; i < plan.length; i++) assert.equal(plan[i].start, plan[i - 1].end, `${npc.id} plan tiles`);
      assert.ok(plan.every(it => it.end > it.start && Number.isFinite(it.place.x)), `${npc.id} plan items`);
    }
  }
  assert.ok(n >= 500, `varied records: ${n}`);
});

test('every pack column a concern or interest cites exists for that ZIP (no invented statistics)', () => {
  const cols = new Set(world.pack.zcols);
  // ZIPs with households and null premium, roof, year-built, value, $1M-share, non-renewal or income columns
  const zips = ['90010', '90013', '94104', '93227', '96078', '90742', '91931', '93437', '94129', '92518', '95903', '92275', '92309', ...SPREAD];
  let cited = 0;
  for (const zip of zips) {
    const zi = world.indexOf(zip), z = world.zip(zi);
    for (const npc of peopleOf(zip, 12, p => p.age >= 18)) {
      for (const v of [true, false]) {
        const rec = structuredClone(npc);
        if (rec.household) rec.household.tenure = v ? 'own' : 'rent';
        const p = P(rec);
        const whys = [...p.concerns.map(c => c.why), ...p.interestDetails.map(d => d.why)];
        for (const why of whys) {
          for (const group of why.match(/\(([^)]*)\)/g) || []) {
            for (const tok of group.slice(1, -1).split(/[\s,:]+/)) {
              if (!cols.has(tok)) continue;
              cited++;
              assert.ok(z[tok] !== null && z[tok] !== undefined, `${npc.id} cites ${tok}, which is null in ${zip}: ${why}`);
            }
          }
          assert.ok(!/\bnull\b|undefined|NaN/.test(why), why);
        }
      }
    }
  }
  assert.ok(cited > 500, `column citations checked: ${cited}`);
});

test('county-wide coastal alerts reach only people near the shore', async () => {
  const { relevantAlerts } = await import('../src/engine/persona.mjs');
  const alerts = [{ event: 'Coastal Flood Advisory', severity: 'Minor' }, { event: 'Wind Advisory', severity: 'Moderate' }];
  assert.deepEqual(relevantAlerts(alerts, 2).map(a => a.event), ['Coastal Flood Advisory', 'Wind Advisory']);
  assert.deepEqual(relevantAlerts(alerts, 40).map(a => a.event), ['Wind Advisory']);
  // the snapshot has a Coastal Flood Advisory for Los Angeles County: Malibu hears of it, Glendale does not
  const malibu = adults('90265', 8).map(P), glendale = adults('91205', 8).map(P);
  assert.ok(malibu.some(p => p.hooks.some(h => /Coastal Flood/.test(h)) || p.concerns.some(c => /Coastal Flood/.test(c.why))));
  assert.ok(!glendale.some(p => p.hooks.some(h => /Coastal/.test(h)) || p.concerns.some(c => /Coastal/.test(c.why))));
  assert.equal(glendale[0].knowledge.coastKm, world.zip('91205').coast_km);
});

// ---------------------------------------------------------------- review regressions (real population)

test('work is read by Census group from layer 0: the life roles of the brief appear', () => {
  const zips = ['93230', '93721', '90210', '95991', '92335', '94110', '90001', '93901', '95814', '92101', '96161', '91342'];
  const roles = new Map();
  let workers = 0, outdoorHeat = 0;
  for (const zip of zips) {
    for (const npc of peopleOf(zip, 220, p => p.status === 'employed', 2500)) {
      const core = pop.householdCore(npc.zi, npc.h).members[npc.m];
      const p = P(npc);
      workers++;
      assert.equal(p.routine.occKey, core.occ, `${npc.id}: the group is layer 0's (${core.occ}), not the job key ${npc.occupation && npc.occupation.key}`);
      roles.set(p.archetype, (roles.get(p.archetype) || 0) + 1);
      if (core.occ === 'farming' && core.departMin < 390 && !/logger|forestry|fishing|deckhand/.test(npc.occupation.title)) assert.equal(p.archetype, 'farmworker on the morning crew', npc.id);
      const heat = p.concerns.find(c => c.topic === 'heat');
      if (p.routine.outdoor && heat) { assert.match(heat.why, /works outdoors/, npc.id); outdoorHeat++; }
      if (p.routine.outdoor !== undefined) assert.equal(typeof p.routine.outdoor, 'boolean');
    }
  }
  assert.ok(workers > 1500, `workers: ${workers}`);
  for (const r of ['farmworker on the morning crew', 'teacher', 'nurse', 'long-haul trucker', 'early-shift regular', 'remote worker', 'line cook', 'mechanic']) {
    assert.ok(roles.get(r) > 0, `${r} occurs: ${[...roles].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
  assert.ok((roles.get('nine-to-fiver') || 0) / workers < 0.1, `nine-to-fivers ${roles.get('nine-to-fiver')}/${workers}`);
  assert.ok(outdoorHeat > 20, `outdoor workers who worry about the heat because of it: ${outdoorHeat}`);
});

test('without a population the group comes from the job catalog, then the title; titles are kept unless placeholders', () => {
  const base = adults('93721', 1, p => p.status === 'employed' && p.occupation)[0];
  const as = occupation => Object.assign(structuredClone(base), { occupation: Object.assign({ sector: 'x', employer: 'a regional hospital', shift: 'day', wfh: false, wage: 60000 }, occupation) });
  const free = npc => persona(world, npc, {});
  assert.equal(free(as({ key: 'registered-nurse', title: 'registered nurse' })).routine.occKey, 'practitioner', 'catalog key');
  assert.equal(free(as({ key: 'tractor-driver', title: 'tractor driver' })).routine.occKey, 'farming', 'catalog key');
  assert.equal(free(as({ key: 'no-such-job', title: 'Registered Nurse' })).routine.occKey, 'practitioner', 'title');
  assert.equal(free(as({ key: 'no-such-job', title: 'loan officer' })).routine.occKey, 'business', 'a loan officer is not police');
  assert.equal(free(as({ key: 'construction', title: 'construction' })).routine.occKey, 'construction', 'a group as the key');
  // a one-word title equal to its key is a real title; a Census group label standing in for one is not
  const pastor = free(as({ key: 'pastor', title: 'pastor', employer: 'a church' }));
  assert.match(pastor.bio, /works as a pastor/);
  assert.ok(pastor.memories.some(m => /started working as a pastor at a church/.test(m.text)), pastor.memories.map(m => m.text).join(' | '));
  const placeholder = free(as({ key: 'office', title: 'office', employer: 'a local employer' }));
  assert.ok(!/works as an office\b/.test(placeholder.bio), placeholder.bio);
  // employers are written in the first person in their own memories
  const farmer = free(as({ key: 'farmer', title: 'farmer', employer: 'their family farm' }));
  const job = farmer.memories.find(m => /started working/.test(m.text));
  assert.ok(job && /on my family's farm/.test(job.text) && !/\btheir\b/.test(job.text), job && job.text);
  assert.equal(farmer.routine.occKey, 'management');
  assert.ok(farmer.concerns.some(c => c.topic === 'water' && /farmer \(occupation\)/.test(c.why)) || farmer.concerns.length >= 6, 'a farmer worries about water');
});

test('concern reasons say what the pack\'s statistics measure', () => {
  const malibu = adults('90265', 40, p => p.household && p.household.tenure === 'own' && ['householder', 'spouse'].includes(p.role)).map(P);
  const ins = malibu.map(p => p.concerns.find(c => c.topic === 'insurance')).filter(Boolean);
  assert.ok(ins.length >= 5);
  for (const c of ins) {
    assert.match(c.why, /FAIR Plan home policies per 100 homes here \(fair_sh\)/);
    assert.match(c.why, /% of residential policies up for renewal in 90265 were not renewed in 2023 \(nonren_sh\)/);
    assert.ok(!/% of policies here are with the FAIR Plan|insurers non-renewed/.test(c.why), c.why);
  }
  const wet = adults('94110', 40).map(P).flatMap(p => p.concerns.filter(c => /flood_n10/.test(c.why)));
  assert.ok(wet.length > 0);
  for (const c of wet) assert.match(c.why, /located flood, flash-flood and debris-flow reports? within 10 km since 1996 \(flood_n10\)/);
  // "only N% own" is said only where owners are the minority
  for (const zip of ['94110', '92262', '93230', '95014']) {
    const own = world.zip(zip).own_sh;
    for (const p of adults(zip, 30, x => x.household && x.household.tenure === 'rent').map(P)) {
      const rent = p.concerns.find(c => c.topic === 'rent');
      if (rent && own >= 50) assert.ok(!/only .*own_sh/.test(rent.why), rent.why);
    }
  }
  const truckee = adults('96161', 30, p => p.household && p.household.tenure === 'own' && ['householder', 'spouse'].includes(p.role)).map(P);
  const snow = truckee.map(p => p.concerns.find(c => c.topic === 'snow')).filter(Boolean);
  assert.ok(snow.length > 5 && snow.every(c => !/the roof carries/.test(c.why)) && snow.some(c => /designed for a \d+ psf ground snow load \(snow_psf\)/.test(c.why)));
});

test('the household agrees: when the family came to the county, the wedding year, who goes to church', () => {
  let kids = 0, couples = 0, churchHouseholds = 0;
  for (const zip of ['94110', '90001', '93721', '92335', '95814', '90265', '93230', '91342', '95521', '92101']) {
    const zi = world.indexOf(zip);
    for (let h = 0; h < 160; h++) {
      const core = pop.householdCore(zi, h);
      const ms = core.members.map(x => { const npc = pop.person(zi, h, x.m); return { npc, p: P(npc) }; });
      const parents = ms.filter(x => ['householder', 'spouse', 'partner'].includes(x.npc.role));
      for (const kid of ms.filter(x => x.npc.role === 'child' && x.npc.age < 18)) {
        if (!parents.length) continue;
        kids++;
        const first = Math.min(...parents.map(x => x.p.residence.countySince));
        assert.ok(kid.p.residence.countySince >= first, `${kid.npc.id} came to the county (${kid.p.residence.countySince}) before both parents (${first})`);
        for (const m of kid.p.memories) if (m.kind !== 'life') assert.ok(m.year >= first, `${kid.npc.id} remembers ${m.title} from before the family came`);
      }
      const hh = ms.find(x => x.npc.role === 'householder'), sp = ms.find(x => x.npc.role === 'spouse');
      if (hh && sp) {
        const wed = x => (x.p.memories.find(m => /got married in/.test(m.text)) || {}).year ?? null;
        if (wed(hh) !== null || wed(sp) !== null) { couples++; assert.equal(wed(hh), wed(sp), `${core.id}: the couple married in one year`); }
      }
      const goers = ms.filter(x => x.p.practice).map(x => x.npc);
      if (goers.length) {
        churchHouseholds++;
        if (goers.some(x => x.age < 13)) assert.ok(goers.some(x => x.age >= 18), `${core.id}: children go to church with a grown-up`);
        const churches = new Set(ms.filter(x => x.p.practice).map(x => `${x.p.routine.places.church && x.p.routine.places.church.x}`));
        assert.equal(churches.size, 1, `${core.id}: one church for the household`);
      }
    }
  }
  assert.ok(kids > 200 && couples > 100 && churchHouseholds > 20, JSON.stringify({ kids, couples, churchHouseholds }));
});

test('memories do not repeat themselves, and merge the declarations of one disaster', () => {
  let people = 0, merged = 0;
  for (const zip of ['90265', '95521', '93721', '92262', '96161', '94110', '92101', '95814']) {
    const zi = world.indexOf(zip), fema = world.femaOf(zi);
    for (const npc of peopleOf(zip, 120, p => p.age >= 18)) {
      const p = P(npc);
      people++;
      const exps = p.memories.map(m => m.experience).filter(Boolean);
      assert.equal(new Set(exps).size, exps.length, `${npc.id} repeats an experience: ${exps.join(' | ')}`);
      const decl = p.memories.filter(m => m.source.startsWith('femaOf'));
      for (let i = 0; i < decl.length; i++) for (let j = i + 1; j < decl.length; j++) {
        if (decl[i].kind !== decl[j].kind) continue;
        assert.ok(Math.abs(Date.parse(decl[i].date) - Date.parse(decl[j].date)) > 120 * 86400000, `${npc.id}: ${decl[i].title} and ${decl[j].title}`);
      }
      for (const m of decl) {
        const parts = m.source.replace(/^femaOf\(\d+\): /, '').split(' + ');
        if (parts.length > 1) { merged++; assert.match(m.fact, /^Federal disaster declarations for/); }
        for (const part of parts) assert.ok(fema.some(f => part === `${f[0]} ${f[2].replace(/\s+/g, ' ')}` && m.fact.includes(f[2].replace(/\s+/g, ' '))), `${npc.id}: ${part}`);
      }
      for (const m of p.memories) assert.ok(!/\btheir (own|family)\b/.test(m.text), `${npc.id}: ${m.text}`);
    }
  }
  assert.ok(people > 600 && merged > 50, JSON.stringify({ people, merged }));
});
