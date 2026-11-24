// Tests for src/engine/names.mjs: pools, determinism, frequencies, generations, customs and safeguards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/engine/rng.mjs';
import {
  NAME_HERITAGES, surname, givenName, nickname, nameFor, middleName, adaptSurname, eraOf, givenPool, surnamePool,
  nicknameCandidates, isReservedName, normName, GIVEN, SURNAMES, EXCLUDED_SURNAMES,
} from '../src/engine/names.mjs';

const CONTRACT_KEYS = ('mexican salvadoran guatemalan honduran nicaraguan puertorican cuban dominican southamerican spanish latino ' +
  'chinese filipino vietnamese korean japanese indian hmong cambodian lao thai pakistani bangladeshi sikh afghan burmese indonesian asian ' +
  'african-american ethiopian nigerian caribbean african armenian iranian arab assyrian russian ukrainian polish irish italian german ' +
  'english scottish french portuguese dutch scandinavian greek european american native pacific multiracial other').split(' ');
const ERA_YEARS = [1948, 1971, 1990, 2012];
const NAME_RE = /^\p{L}[\p{L}'’.\- ]*\p{L}\.?$|^\p{L}$/u;
const draw = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const share = (arr, pred) => arr.filter(pred).length / arr.length;
const namesOf = (str) => String(str || '').split(',').map(s => s.trim().replace(/[:*][\d.]+$/, '')).filter(Boolean);
const generalSet = (sex, era) => new Set(givenPool('other', sex, era, 3).map(x => x.name));

test('every contract heritage key is covered, with nothing extra', () => {
  assert.deepEqual([...NAME_HERITAGES].sort(), [...CONTRACT_KEYS].sort());
});

test('every heritage gives plausible names for both sexes, all eras and generations', () => {
  const rng = new Rng(101);
  for (const heritage of NAME_HERITAGES) {
    for (const sex of ['F', 'M']) {
      for (const birthYear of ERA_YEARS) {
        for (const generation of [1, 2, 3]) {
          for (let k = 0; k < 5; k++) {
            const first = givenName(rng, { heritage, sex, birthYear, generation });
            assert.ok(NAME_RE.test(first), `${heritage} ${sex} ${birthYear} g${generation}: "${first}"`);
            if (heritage !== 'sikh') assert.ok(!/\s/.test(first), `single given name expected: "${first}" (${heritage})`);
          }
        }
      }
    }
    for (let k = 0; k < 20; k++) {
      const last = surname(rng, heritage);
      assert.ok(NAME_RE.test(last), `${heritage} surname "${last}"`);
    }
  }
});

test('pools: at least 40 given names per sex for every era of every heritage, 40 surnames per distinct pool', () => {
  for (const heritage of NAME_HERITAGES) {
    for (const sex of ['F', 'M']) {
      for (let era = 0; era < 4; era++) {
        const pool = givenPool(heritage, sex, era, 1);
        assert.ok(pool.length >= 40, `${heritage} ${sex} era ${era}: ${pool.length} names`);
        const sum = pool.reduce((a, x) => a + x.weight, 0);
        assert.ok(Math.abs(sum - 1) < 1e-9);
        assert.ok(givenPool(heritage, sex, era, 2).length >= 20, `${heritage} ${sex} era ${era} US-born pool`);
      }
    }
    const sur = surnamePool(heritage);
    // Hmong surnames are the clan names: 18 clans and their usual spellings, and no others.
    assert.ok(sur.length >= (heritage === 'hmong' ? 18 : 40), `${heritage}: ${sur.length} surnames`);
  }
  const hmong = new Set(surnamePool('hmong').map(x => x.name));
  for (const clan of 'Chang Cheng Chu Fang Hang Her Khang Kong Kue Lee Lor Moua Pha Thao Vang Vue Xiong Yang'.split(' ')) assert.ok(hmong.has(clan), clan);
});

test('no duplicate entries inside any pool, no excluded surnames anywhere', () => {
  const lists = [];
  for (const [trad, T] of Object.entries(GIVEN)) {
    for (const sex of ['M', 'F']) {
      (T[sex] || []).forEach((s, e) => lists.push([`${trad} ${sex} ${e}`, s]));
      if (T.us && T.us[sex]) T.us[sex].forEach((s, e) => lists.push([`${trad} us ${sex} ${e}`, s]));
      if (T.base && T.base[sex]) lists.push([`${trad} base ${sex}`, T.base[sex]]);
    }
  }
  const surnameLists = Object.entries(SURNAMES).filter(([, s]) => typeof s === 'string' && s.includes(','));
  assert.ok(lists.length > 400 && surnameLists.length > 50);
  for (const [label, s] of [...lists, ...surnameLists]) {
    const names = namesOf(s).map(normName);
    assert.equal(new Set(names).size, names.length, `duplicate in ${label}: ${names.filter((n, i) => names.indexOf(n) !== i)}`);
  }
  const excluded = new Set(EXCLUDED_SURNAMES.map(normName));
  for (const [key, s] of surnameLists) for (const n of namesOf(s)) assert.ok(!excluded.has(normName(n)), `${n} in ${key}`);
});

test('deterministic: the same rng seed gives the same names, and only the rng passed in is used', () => {
  const run = (seed) => {
    const rng = new Rng(seed), out = [];
    for (let i = 0; i < 300; i++) {
      const heritage = NAME_HERITAGES[i % NAME_HERITAGES.length], sex = i % 2 ? 'F' : 'M';
      const last = surname(rng, heritage), first = givenName(rng, { heritage, sex, birthYear: 1930 + (i % 90), generation: 1 + (i % 3) });
      out.push(first, last, nickname(rng, first, { heritage, age: 20 + (i % 60) }), JSON.stringify(nameFor(rng, { heritage, sex, birthYear: 1950 + (i % 70), generation: 1 + (i % 3) })));
    }
    return out;
  };
  const realRandom = Math.random, realNow = Date.now;
  Math.random = () => { throw new Error('Math.random used'); };
  Date.now = () => { throw new Error('Date.now used'); };
  let a, b, c;
  try { a = run(42); b = run(42); c = run(43); } finally { Math.random = realRandom; Date.now = realNow; }
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('Vietnamese surnames: Nguyen first by a wide margin, then Tran and Le', () => {
  const rng = new Rng(7);
  const counts = new Map();
  for (let i = 0; i < 20000; i++) { const s = surname(rng, 'vietnamese'); counts.set(s, (counts.get(s) || 0) + 1); }
  const ranked = [...counts].sort((x, y) => y[1] - x[1]);
  assert.equal(ranked[0][0], 'Nguyen');
  const nguyen = ranked[0][1] / 20000;
  assert.ok(nguyen > 0.32 && nguyen < 0.42, `Nguyen ${nguyen}`);
  assert.ok(ranked[0][1] > 2.5 * ranked[1][1], `${ranked[1][0]} too close`);
  assert.deepEqual(ranked.slice(1, 3).map(r => r[0]).sort(), ['Le', 'Tran']);
  const korean = surnamePool('korean');
  assert.deepEqual(korean.slice(0, 3).map(x => x.name), ['Kim', 'Lee', 'Park']);
});

test('Sikh men carry Singh and women Kaur, never the other', () => {
  const rng = new Rng(9);
  for (const [sex, own, other] of [['M', 'Singh', 'Kaur'], ['F', 'Kaur', 'Singh']]) {
    const firsts = draw(2000, i => givenName(rng, { heritage: 'sikh', sex, birthYear: 1950 + (i % 60), generation: 1 }));
    assert.ok(share(firsts, f => f.endsWith(` ${own}`)) > 0.9, `${sex} given names with ${own}`);
    assert.ok(firsts.every(f => !f.includes(other)));
    const full = draw(1000, i => nameFor(rng, { heritage: 'sikh', sex, birthYear: 1960 + (i % 50), generation: 1 + (i % 3) }));
    for (const n of full) {
      assert.ok(n.middle === own || n.last === own, `${n.full}`);
      assert.ok(!n.full.includes(other), n.full);
    }
    const lasts = draw(2000, () => surname(rng, 'sikh', { sex }));
    assert.ok(lasts.includes(own) && !lasts.includes(other));
  }
  // the household's family name, drawn without a sex, is never Singh or Kaur, and is a Punjabi family name
  const family = draw(3000, () => surname(rng, 'sikh'));
  assert.ok(family.every(s => s !== 'Singh' && s !== 'Kaur'));
  for (const s of ['Sandhu', 'Gill', 'Dhillon', 'Sidhu', 'Grewal']) assert.ok(family.includes(s), s);
  // a Sikh whose surname already is Singh does not get it twice
  assert.ok(draw(500, () => givenName(rng, { heritage: 'sikh', sex: 'M', birthYear: 1980, generation: 1, surname: 'Singh' })).every(f => !f.includes('Singh')));
});

test('generations: US-born children carry more general-pool names than immigrants; grandchildren more still', () => {
  const rng = new Rng(11);
  for (const heritage of ['mexican', 'vietnamese', 'korean', 'chinese', 'armenian', 'indian', 'sikh', 'iranian', 'hmong']) {
    const generalShare = (generation) => {
      let hits = 0;
      for (let i = 0; i < 3000; i++) {
        const sex = i % 2 ? 'F' : 'M', birthYear = 1985 + (i % 35);
        const first = givenName(rng, { heritage, sex, birthYear, generation, religiousName: false });
        if (generalSet(sex, eraOf(birthYear)).has(first)) hits++;
      }
      return hits / 3000;
    };
    const g1 = generalShare(1), g2 = generalShare(2), g3 = generalShare(3);
    assert.ok(g2 > g1 + 0.2, `${heritage}: g1 ${g1} g2 ${g2}`);
    assert.ok(g3 >= g2 - 0.02, `${heritage}: g2 ${g2} g3 ${g3}`);
  }
  // nativity stands in for generation when it is missing
  const imm = draw(400, () => givenName(rng, { heritage: 'vietnamese', sex: 'F', birthYear: 1965, nativity: 'foreign' }));
  assert.ok(share(imm, f => givenPool('vietnamese', 'F', 1, 1).some(x => x.name === f)) > 0.9);
});

test('Mexican American children born after 2000: Sofia, Valentina, Mateo, Santiago, and also Jayden and Ashley', () => {
  const rng = new Rng(13);
  const girls = new Set(draw(6000, () => givenName(rng, { heritage: 'mexican', sex: 'F', birthYear: 2010, generation: 2 })));
  const boys = new Set(draw(6000, () => givenName(rng, { heritage: 'mexican', sex: 'M', birthYear: 2010, generation: 2 })));
  for (const n of ['Sofia', 'Valentina', 'Ashley']) assert.ok(girls.has(n), n);
  for (const n of ['Mateo', 'Santiago', 'Jayden']) assert.ok(boys.has(n), n);
  assert.ok(!girls.has('Sofía'), 'US-born children are written without accents');
  const immigrants = new Set(draw(3000, () => givenName(rng, { heritage: 'mexican', sex: 'M', birthYear: 1965, generation: 1 })));
  assert.ok(immigrants.has('José') && immigrants.has('Jesús'), 'immigrants keep their accents');
  assert.ok(givenPool('mexican', 'F', 0, 1).some(x => x.name === 'María'));
});

test('romanization: Vietnamese without tone marks, Korean hyphenated, Chinese by origin and surname', () => {
  const rng = new Rng(15);
  const vn = draw(2000, i => givenName(rng, { heritage: 'vietnamese', sex: i % 2 ? 'F' : 'M', birthYear: 1950 + (i % 60), generation: 1 }));
  assert.ok(vn.every(n => /^[A-Za-z]+$/.test(n)), 'plain ASCII');
  const ko = draw(2000, i => givenName(rng, { heritage: 'korean', sex: i % 2 ? 'F' : 'M', birthYear: 1950 + (i % 60), generation: 1 }));
  assert.ok(share(ko, n => /^[A-Z][a-z]+-[a-z]+$/.test(n)) > 0.9, 'Ji-hoon style');
  const cmn = new Set(GIVEN['chinese-cmn'].M.flatMap(namesOf));
  const yue = new Set(GIVEN['chinese-yue'].M.flatMap(namesOf)), tw = new Set(GIVEN['chinese-tw'].M.flatMap(namesOf));
  // a Wong born in 1955 is named in Cantonese (or carries an English name, as many Hong Kong people do)
  const wong = draw(1500, () => givenName(rng, { heritage: 'chinese', sex: 'M', birthYear: 1955, generation: 1, surname: 'Wong' }));
  assert.ok(share(wong, n => yue.has(n)) > 0.6);
  assert.ok(share(wong, n => cmn.has(n) && !yue.has(n)) < 0.02);
  // a Zhang born in 1992 has a pinyin name, a Hsu a Taiwanese one
  const zhang = draw(1500, () => givenName(rng, { heritage: 'chinese', sex: 'M', birthYear: 1992, generation: 1, surname: 'Zhang' }));
  assert.ok(share(zhang, n => cmn.has(n)) > 0.9);
  // (Taiwan-born people often carry English legal names too, so about a third of a Hsu's names are English)
  const hsu = draw(1500, () => givenName(rng, { heritage: 'chinese', sex: 'M', birthYear: 1975, generation: 1, surname: 'Hsu' }));
  assert.ok(share(hsu, n => tw.has(n)) > 0.5);
  assert.ok(share(hsu, n => (cmn.has(n) || yue.has(n)) && !tw.has(n)) < 0.02);
  // without a surname, the 1950s cohort is mostly Cantonese and the 1990s cohort mostly pinyin
  const old = draw(2000, () => givenName(rng, { heritage: 'chinese', sex: 'M', birthYear: 1950, generation: 1 }));
  const young = draw(2000, () => givenName(rng, { heritage: 'chinese', sex: 'M', birthYear: 1995, generation: 1 }));
  assert.ok(share(old, n => yue.has(n)) > share(old, n => cmn.has(n)) && share(young, n => cmn.has(n)) > 0.5);
});

test('India by region: the surname picks the regional naming tradition', () => {
  const rng = new Rng(17);
  const south = new Set(GIVEN['indian-south'].M.slice(0, 3).flatMap(namesOf)), west = new Set(GIVEN['indian-west'].M.slice(0, 3).flatMap(namesOf));
  const reddy = draw(1000, () => givenName(rng, { heritage: 'indian', sex: 'M', birthYear: 1970, generation: 1, surname: 'Reddy' }));
  const patel = draw(1000, () => givenName(rng, { heritage: 'indian', sex: 'M', birthYear: 1970, generation: 1, surname: 'Patel' }));
  assert.ok(share(reddy, n => south.has(n)) > 0.9);
  assert.ok(share(patel, n => west.has(n)) > 0.9);
});

test('birth cohorts: names follow their era', () => {
  const rng = new Rng(19);
  const old = draw(5000, () => givenName(rng, { heritage: 'irish', sex: 'F', birthYear: 1950, generation: 3 }));
  const young = draw(5000, () => givenName(rng, { heritage: 'irish', sex: 'F', birthYear: 2012, generation: 3 }));
  const count = (arr, n) => arr.filter(x => x === n).length;
  assert.ok(count(old, 'Linda') > 40 && count(young, 'Linda') < 10);
  assert.ok(count(young, 'Sophia') > 40 && count(old, 'Sophia') === 0);
  assert.deepEqual([1959, 1960, 1979, 1980, 1999, 2000].map(eraOf), [0, 1, 1, 2, 2, 3]);
});

test('surname pools carry each heritage\'s own names', () => {
  const pool = h => new Set(surnamePool(h).map(x => x.name));
  const mexican = pool('mexican'), salvadoran = pool('salvadoran'), guatemalan = pool('guatemalan');
  for (const s of ['Portillo', 'Argueta', 'Menjivar', 'Orellana']) assert.ok(salvadoran.has(s) && !mexican.has(s), s);
  for (const s of ['Tzul', 'Choc', 'Ixcoy', 'Cifuentes']) assert.ok(guatemalan.has(s) && !mexican.has(s), s);
  const filipino = surnamePool('filipino');
  assert.deepEqual(filipino.slice(0, 3).map(x => x.name), ['Santos', 'Reyes', 'Cruz']);
  for (const s of ['Manalo', 'Dimaculangan', 'Macaraeg']) assert.ok(filipino.some(x => x.name === s), s);
  const armenian = surnamePool('armenian');
  assert.ok(armenian.filter(x => /(ian|yan)$/.test(x.name)).reduce((a, x) => a + x.weight, 0) > 0.97);
  const chinese = pool('chinese');
  for (const s of ['Wong', 'Chan', 'Lam', 'Ng', 'Leung', 'Cheung', 'Fong', 'Louie', 'Chin', 'Eng', 'Wang', 'Zhang', 'Liu', 'Chen']) assert.ok(chinese.has(s), s);
  const portuguese = pool('portuguese');
  for (const s of ['Medeiros', 'Avila', 'Bettencourt', 'Furtado']) assert.ok(portuguese.has(s), s);
  const native = surnamePool('native');
  assert.ok(native.filter(x => mexican.has(x.name) || pool('american').has(x.name)).reduce((a, x) => a + x.weight, 0) > 0.6, 'mostly Spanish or English surnames');
});

test('nicknames map to the right diminutives, by custom and age', () => {
  const nicks = (given, opts) => nicknameCandidates(given, opts).map(c => c.nick);
  assert.ok(nicks('Roberto', { heritage: 'mexican', age: 45 }).includes('Beto'));
  assert.ok(nicks('Guadalupe', { heritage: 'mexican', age: 60, sex: 'F' }).includes('Lupe'));
  const francisco = nicks('Francisco', { heritage: 'salvadoran', age: 50 });
  assert.ok(francisco.includes('Pancho') && francisco.includes('Paco'));
  assert.ok(nicks('Jesús', { heritage: 'mexican', age: 30 }).includes('Chuy'));
  assert.ok(nicks('José', { heritage: 'mexican', age: 60 }).includes('Pepe'));
  assert.ok(nicks('William', { heritage: 'english', age: 65 }).includes('Bill'));
  const youngWill = nicks('William', { heritage: 'irish', age: 25 });
  assert.ok(youngWill.includes('Will') && !youngWill.includes('Bill'));
  assert.ok(nicks('Katherine', { heritage: 'american', age: 30 }).includes('Kate'));
  assert.ok(nicks('Tuan', { heritage: 'vietnamese', age: 50 }).includes('Tony'));
  assert.ok(nicks('Ji-hoon', { heritage: 'korean', age: 40 }).includes('Jay'));
  assert.ok(nicks('Harpreet Singh', { heritage: 'sikh', age: 40, sex: 'M' }).includes('Harry'));
  // Harpreet is given to girls too: Harry only for men, and not when the sex is unknown
  assert.ok(!nicks('Harpreet Kaur', { heritage: 'sikh', age: 40, sex: 'F' }).includes('Harry'));
  assert.deepEqual(nicks('Harpreet', { heritage: 'sikh', age: 40 }).filter(n => n === 'Harry'), []);
  assert.ok(nicks('Harpreet', { heritage: 'sikh', age: 40 }).includes('Preet'));
  assert.ok(nicks('Takashi', { heritage: 'japanese', age: 80 }).includes('Tak'));
  assert.ok(nicks('Ekaterina', { heritage: 'russian', age: 40 }).includes('Katya'));
  assert.ok(nicks('Konstantinos', { heritage: 'greek', age: 50 }).includes('Gus'));
  assert.deepEqual(nicks('Tuan', { heritage: 'vietnamese', age: 8 }), [], 'children keep their own names');
  // a modest share of people go by a nickname, and only by one their custom allows
  const rng = new Rng(21);
  const got = draw(4000, () => nickname(rng, 'Roberto', { heritage: 'mexican', age: 45 }));
  const rate = share(got, n => n !== null);
  assert.ok(rate > 0.15 && rate < 0.45, `rate ${rate}`);
  assert.ok(got.every(n => n === null || ['Beto', 'Bob'].includes(n)));
  assert.equal(nickname(rng, '', { heritage: 'mexican', age: 30 }), null);
});

test('famous full names are avoided when the surname is known', () => {
  assert.ok(isReservedName('Michael', 'Jordan') && isReservedName('César', 'Chávez') && isReservedName('Kar-wai', 'Wong'));
  assert.ok(!isReservedName('Michael', 'Jordon') && !isReservedName('Maria', 'Chavez'));
  const rng = new Rng(23);
  const free = draw(3000, () => givenName(rng, { heritage: 'african-american', sex: 'M', birthYear: 1975, generation: 3 }));
  assert.ok(free.includes('Michael'), 'Michael is common for this cohort');
  const withJordan = draw(3000, () => givenName(rng, { heritage: 'african-american', sex: 'M', birthYear: 1975, generation: 3, surname: 'Jordan' }));
  assert.ok(!withJordan.includes('Michael'));
  for (let i = 0; i < 20000; i++) {
    const n = nameFor(rng, { heritage: NAME_HERITAGES[i % NAME_HERITAGES.length], sex: i % 2 ? 'F' : 'M', birthYear: 1940 + (i % 80), generation: 1 + (i % 3) });
    assert.ok(!isReservedName(n.first, n.last) && !(n.nick && isReservedName(n.nick, n.last)), n.full);
    assert.notEqual(normName(n.first), normName(n.last));
  }
});

test('feminine surname forms for immigrant women of Slavic and Greek families', () => {
  assert.equal(adaptSurname('Ivanov', { heritage: 'russian', sex: 'F' }), 'Ivanova');
  assert.equal(adaptSurname('Nikitin', { heritage: 'russian', sex: 'F' }), 'Nikitina');
  assert.equal(adaptSurname('Kowalski', { heritage: 'polish', sex: 'F' }), 'Kowalska');
  assert.equal(adaptSurname('Papadopoulos', { heritage: 'greek', sex: 'F' }), 'Papadopoulou');
  assert.equal(adaptSurname('Kovalenko', { heritage: 'ukrainian', sex: 'F' }), 'Kovalenko');
  assert.equal(adaptSurname('Ivanov', { heritage: 'russian', sex: 'M' }), 'Ivanov');
  assert.equal(adaptSurname('Garcia', { heritage: 'mexican', sex: 'F' }), 'Garcia');
  const rng = new Rng(25);
  const women = draw(2000, () => surname(rng, 'russian', { sex: 'F', generation: 1 }));
  assert.ok(women.filter(s => /(ov|ev|in)a$/.test(s)).length > 1000 && women.every(s => !/(ov|ev)$/.test(s)));
});

test('whole names: middle names by custom, full and display', () => {
  const rng = new Rng(27);
  const vn = draw(1000, () => nameFor(rng, { heritage: 'vietnamese', sex: 'F', birthYear: 1965, generation: 1 }));
  assert.ok(share(vn, n => n.middle === 'Thi') > 0.6);
  const filipinoSurnames = new Set(surnamePool('filipino').map(x => x.name));
  const fil = draw(1000, () => nameFor(rng, { heritage: 'filipino', sex: 'M', birthYear: 1970, generation: 1 }));
  assert.ok(share(fil, n => filipinoSurnames.has(n.middle)) > 0.75);
  for (const n of [...vn, ...fil]) {
    assert.equal(n.full, [n.first, n.middle, n.last].filter(Boolean).join(' '));
    assert.equal(n.display, `${n.nick || n.first} ${n.last}`);
  }
  const kept = nameFor(rng, { heritage: 'mexican', sex: 'M', age: 40, surname: 'Gonzalez' });
  assert.equal(kept.last, 'Gonzalez');
  assert.equal(typeof middleName(rng, { heritage: 'english', sex: 'F', birthYear: 1960, generation: 3 }), 'string');
});

test('multiracial and unknown heritages fall back sensibly', () => {
  const rng = new Rng(29);
  const multi = draw(3000, i => givenName(rng, { heritage: 'multiracial', sex: i % 2 ? 'F' : 'M', birthYear: 2005, generation: 2 }));
  assert.ok(share(multi, (n, i) => generalSet(i % 2 ? 'F' : 'M', 3).has(n)) > 0.6, 'mostly the general pool of the cohort');
  const hmongPool = new Set(givenPool('hmong', 'F', 2, 1).map(x => x.name));
  const withParent = draw(1000, () => givenName(rng, { heritage: 'multiracial', sex: 'F', birthYear: 1990, generation: 1, parents: ['hmong', 'irish'] }));
  assert.ok(share(withParent, n => hmongPool.has(n)) > 0.2, 'one parent\'s tradition');
  const unknown = draw(200, () => givenName(rng, { heritage: 'martian', sex: 'F', birthYear: 1980 }));
  assert.ok(unknown.every(n => NAME_RE.test(n)));
  assert.ok(NAME_RE.test(surname(rng, 'martian')) && NAME_RE.test(givenName(rng, {})));
});

test('fast enough for millions of people', () => {
  const rng = new Rng(31);
  let t0 = performance.now(), chars = 0;
  for (let i = 0; i < 100000; i++) {
    const heritage = NAME_HERITAGES[i % NAME_HERITAGES.length];
    const first = givenName(rng, { heritage, sex: i & 1 ? 'F' : 'M', birthYear: 1930 + (i % 95), generation: 1 + (i % 3) });
    chars += first.length + surname(rng, heritage).length + (nickname(rng, first, { heritage, age: i % 90 }) || '').length;
  }
  const perPerson = (performance.now() - t0) * 1000 / 100000;
  assert.ok(chars > 0 && perPerson < 20, `${perPerson.toFixed(2)} µs per person`);
});
