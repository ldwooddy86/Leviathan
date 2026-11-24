// Tests for src/engine/names.mjs: pools, determinism, frequencies, generations, customs and safeguards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/engine/rng.mjs';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import {
  NAME_HERITAGES, surname, givenName, nickname, nameFor, middleName, adaptSurname, eraOf, givenPool, surnamePool,
  nicknameCandidates, isReservedName, normName, GIVEN, SURNAMES, NICKNAMES, PET_NAMES, MIDDLE_NAMES, EXCLUDED_SURNAMES,
  RESERVED_NAMES, JOKE_NAMES, BLOCKED_NAMES,
} from '../src/engine/names.mjs';

const CONTRACT_KEYS = ('mexican salvadoran guatemalan honduran nicaraguan puertorican cuban dominican southamerican spanish latino ' +
  'chinese filipino vietnamese korean japanese indian hmong cambodian lao thai pakistani bangladeshi sikh afghan burmese indonesian asian ' +
  'african-american ethiopian nigerian caribbean african armenian iranian arab assyrian russian ukrainian polish irish italian german ' +
  'english scottish french portuguese dutch scandinavian greek european american native pacific multiracial other').split(' ');
const ERA_YEARS = [1948, 1971, 1990, 2012];
const NAME_RE = /^\p{L}[\p{L}'’.\- ]*\p{L}\.?$|^\p{L}$/u;
const draw = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const share = (arr, pred) => arr.filter(pred).length / arr.length;
// The names of a pool string, without weights ("Nguyen:38"), boosts ("José*3") or nickname markers ("Bill+", "Lupita@F~").
const namesOf = (str) => String(str || '').split(',').map(s => s.trim().replace(/[:*][\d.]+$/, '').replace(/(@[MF])?[+\-~^]?$/, '')).filter(Boolean);
const generalSet = (sex, era) => new Set(givenPool('other', sex, era, 3).map(x => x.name));
const nicks = (given, opts) => nicknameCandidates(given, opts).map(c => c.nick);
// Heritages whose immigrant cohorts really are dominated by one name (José, María, Muhammad, Maria, Georgios),
// marked in the pools with "Name*k" or a steeper curve.
const DOMINANT_HEAD = new Set('mexican salvadoran guatemalan honduran nicaraguan puertorican cuban dominican southamerican spanish latino filipino portuguese pakistani bangladeshi afghan arab irish italian greek'.split(' '));

// Every name string the module can emit, with where it lives: given-name lists (origin, US-born, base),
// surname lists, nickname customs (including the adopted English names), pet names and middle names.
function everyNameString() {
  const out = [];
  for (const [t, T] of Object.entries(GIVEN)) {
    for (const sx of ['M', 'F']) {
      (T[sx] || []).forEach((s, e) => out.push([`GIVEN.${t}.${sx}${e}`, s]));
      if (T.us && T.us[sx]) T.us[sx].forEach((s, e) => out.push([`GIVEN.${t}.us.${sx}${e}`, s]));
      if (T.base && T.base[sx]) out.push([`GIVEN.${t}.base.${sx}`, T.base[sx]]);
    }
  }
  for (const [k, s] of Object.entries(SURNAMES)) if (typeof s === 'string') out.push([`SURNAMES.${k}`, s]);
  for (const [c, M] of Object.entries(NICKNAMES)) {
    for (const m of (c === 'vi' || c === 'ko' ? [M.M, M.F] : [M])) for (const [k, v] of Object.entries(m)) out.push([`NICKNAMES.${c}.${k}`, v]);
  }
  for (const [c, P] of Object.entries(PET_NAMES)) for (const sx of ['M', 'F']) out.push([`PET_NAMES.${c}.${sx}`, P[sx]]);
  for (const [k, v] of Object.entries(MIDDLE_NAMES)) for (const s of (typeof v === 'string' ? [v] : Object.values(v))) out.push([`MIDDLE_NAMES.${k}`, s]);
  return out;
}

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

test('pools: 40 given names per sex for every era of every naming tradition, 40 surnames per distinct pool', () => {
  let traditions = 0;
  for (const [trad, T] of Object.entries(GIVEN)) {
    if (T.mix) continue;   // a mix of other traditions (Chinese, Indian, Scottish, Latino, Asian, European)
    traditions++;
    for (const sex of ['M', 'F']) {
      const base = namesOf(T.base && T.base[sex]);
      if (base.length) assert.ok(base.length >= 40, `${trad} ${sex} era-neutral list: ${base.length} names`);
      for (let era = 0; era < 4; era++) {
        const own = namesOf((T[sex] || [])[era]);
        // the era's own list carries the weight; a tradition with an era-neutral list may add era favorites to it
        if (base.length) assert.ok(own.length === 0 || own.length >= 20, `${trad} ${sex} era ${era}: ${own.length} era names`);
        else assert.ok(own.length >= 40, `${trad} ${sex} era ${era}: ${own.length} names`);
        if (T.us) assert.ok(namesOf(T.us[sex][era]).length >= 20, `${trad} ${sex} era ${era}: ${namesOf(T.us[sex][era]).length} US-born names`);
      }
    }
  }
  assert.ok(traditions > 40);
  for (const heritage of NAME_HERITAGES) {
    for (const sex of ['F', 'M']) {
      for (let era = 0; era < 4; era++) {
        const pool = givenPool(heritage, sex, era, 1);
        assert.ok(pool.length >= 40, `${heritage} ${sex} era ${era}: ${pool.length} names`);
        assert.ok(Math.abs(pool.reduce((a, x) => a + x.weight, 0) - 1) < 1e-9);
        assert.ok(pool.every(x => !/[*:]/.test(x.name)), 'weight and boost markers never leak into names');
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

test('no name, name part, nickname, pet name or middle name reads as a slur or crude word', () => {
  const blocked = new Set(BLOCKED_NAMES);
  for (const w of ['kike', 'sambo', 'bimbo', 'dick', 'chink', 'gook', 'wetback']) assert.ok(blocked.has(w), `${w} is on the blocklist`);
  let checked = 0;
  for (const [label, s] of everyNameString()) {
    for (const name of namesOf(s)) {
      const f = normName(name);
      for (const w of [f, ...f.split(' ')]) assert.ok(!blocked.has(w), `"${name}" in ${label}`);
      checked++;
    }
  }
  assert.ok(checked > 20000, `${checked} names checked`);
  // the reviewed cases: Quique for Enrique, no Dick for Richard, Bola for Abimbola, no Sambo among Khmer names
  assert.ok(nicks('Enrique', { heritage: 'mexican', age: 30 }).includes('Quique'));
  assert.ok(!nicks('Enrique', { heritage: 'mexican', age: 30 }).includes('Kike'));
  for (const heritage of ['english', 'american', 'african-american', 'irish']) assert.ok(!nicks('Richard', { heritage, age: 75, sex: 'M' }).includes('Dick'), heritage);
  assert.deepEqual(nicks('Abimbola', { heritage: 'nigerian', age: 40, sex: 'F' }), ['Bola']);
  for (let era = 0; era < 4; era++) assert.ok(!givenPool('cambodian', 'M', era, 1).some(x => x.name === 'Sambo'));
  // and nothing drawn end to end carries one
  const rng = new Rng(103);
  for (let i = 0; i < 20000; i++) {
    const n = nameFor(rng, { heritage: NAME_HERITAGES[i % NAME_HERITAGES.length], sex: i % 2 ? 'F' : 'M', birthYear: 1935 + (i % 90), generation: 1 + (i % 3) });
    for (const w of normName(`${n.full} ${n.display}`).split(' ')) assert.ok(!blocked.has(w), n.full);
  }
});

test('deterministic: the same rng seed gives the same names, and only the rng passed in is used', () => {
  const run = (seed) => {
    const rng = new Rng(seed), out = [];
    for (let i = 0; i < 300; i++) {
      const heritage = NAME_HERITAGES[i % NAME_HERITAGES.length], sex = i % 2 ? 'F' : 'M';
      const last = surname(rng, heritage), first = givenName(rng, { heritage, sex, birthYear: 1930 + (i % 90), generation: 1 + (i % 3), surname: last });
      out.push(first, last, nickname(rng, first, { heritage, age: 20 + (i % 60), sex, surname: last }), JSON.stringify(nameFor(rng, { heritage, sex, birthYear: 1950 + (i % 70), generation: 1 + (i % 3) })));
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

test('surname frequencies: no single name dominates where a culture\'s surnames are diverse', () => {
  // Lao and Thai surnames are particular to families, Ethiopian ones are fathers' given names, and the Nigerian,
  // other African and Pacific pools mix many peoples: the commonest name is a few percent at most.
  for (const heritage of ['lao', 'thai', 'ethiopian', 'nigerian', 'african', 'pacific']) {
    const pool = surnamePool(heritage);
    assert.ok(pool[0].weight <= 0.04, `${heritage}: ${pool[0].name} ${(100 * pool[0].weight).toFixed(1)}%`);
    assert.ok(pool.length >= 100, `${heritage}: ${pool.length} surnames`);
  }
  // Vietnamese, Korean and Hmong surnames really are concentrated (Nguyen, Kim, the 18 clans); nowhere else
  // does one surname reach a tenth of a heritage
  for (const heritage of NAME_HERITAGES) {
    if (heritage === 'vietnamese' || heritage === 'korean' || heritage === 'hmong') continue;
    const top = surnamePool(heritage)[0];
    assert.ok(top.weight < 0.1, `${heritage}: ${top.name} ${(100 * top.weight).toFixed(1)}%`);
  }
  const kim = surnamePool('korean')[0], vang = surnamePool('hmong')[0];
  assert.ok(kim.name === 'Kim' && kim.weight > 0.18 && kim.weight < 0.28, `Kim ${kim.weight}`);
  assert.ok(vang.weight > 0.1 && vang.weight < 0.2, `${vang.name} ${vang.weight}`);
  // the draws follow the pool: in 30,000 Lao surnames none comes up more than 3% of the time
  const rng = new Rng(105), counts = new Map();
  for (let i = 0; i < 30000; i++) { const s = surname(rng, 'lao'); counts.set(s, (counts.get(s) || 0) + 1); }
  assert.ok(Math.max(...counts.values()) / 30000 < 0.03);
});

test('given-name frequencies: the top name of a cohort holds a realistic share', () => {
  const top = (heritage, sex, era, generation) => givenPool(heritage, sex, era, generation)[0];
  const pct = x => `${x.name} ${(100 * x.weight).toFixed(1)}%`;
  // the general California pool: Robert, Mary, Michael, Jennifer ... at about their share of births by cohort
  const bounds = [0.06, 0.05, 0.045, 0.035];
  for (const sex of ['M', 'F']) for (let era = 0; era < 4; era++) { const t = top('other', sex, era, 3); assert.ok(t.weight < bounds[era], `general ${sex} ${era}: ${pct(t)}`); }
  assert.equal(top('other', 'M', 1, 3).name, 'Michael');
  assert.equal(top('other', 'F', 1, 3).name, 'Jennifer');
  // the reviewed cases: Korea-born and Vietnam-born cohorts
  for (const [heritage, sex, era] of [['korean', 'F', 1], ['korean', 'M', 1], ['vietnamese', 'M', 1], ['vietnamese', 'F', 0]]) {
    const t = top(heritage, sex, era, 1);
    assert.ok(t.weight < 0.05, `${heritage} ${sex} ${era}: ${pct(t)}`);
  }
  // countries whose names are diverse never put one name above 5%; no tradition without a dominant name above 7.5%
  for (const heritage of NAME_HERITAGES) {
    for (const sex of ['M', 'F']) {
      for (let era = 0; era < 4; era++) {
        const t1 = top(heritage, sex, era, 1), t2 = top(heritage, sex, era, 2);
        if (['korean', 'chinese', 'japanese', 'vietnamese', 'indian', 'thai', 'lao', 'cambodian', 'nigerian', 'ethiopian'].includes(heritage)) assert.ok(t1.weight <= 0.05, `${heritage} ${sex} ${era}: ${pct(t1)}`);
        if (DOMINANT_HEAD.has(heritage)) assert.ok(t1.weight <= 0.25, `${heritage} ${sex} ${era}: ${pct(t1)}`);
        else assert.ok(t1.weight <= 0.075, `${heritage} ${sex} ${era}: ${pct(t1)}`);
        assert.ok(t2.weight <= (DOMINANT_HEAD.has(heritage) ? 0.2 : 0.1), `${heritage} ${sex} ${era} US-born: ${pct(t2)}`);
      }
    }
  }
  // where one name does dominate a cohort it leads by a wide margin: José and María among Mexico-born
  // Californians born before 1960, Muhammad among Pakistan-born men, Georgios and Maria among Greeks
  const mx = givenPool('mexican', 'F', 0, 1);
  assert.equal(mx[0].name, 'María');
  assert.ok(mx[0].weight > 0.12 && mx[0].weight > 3 * mx.find(x => x.name === 'Guadalupe').weight);
  assert.equal(top('mexican', 'M', 0, 1).name, 'José');
  assert.equal(top('pakistani', 'M', 2, 1).name, 'Muhammad');
  assert.ok(top('greek', 'M', 1, 1).name === 'Georgios' && top('greek', 'M', 1, 1).weight > 0.06);
  // and the draws follow the pools: 30,000 Korea-born women of the 1960s and 70s, none sharing a name above 5%
  const rng = new Rng(107), counts = new Map();
  for (let i = 0; i < 30000; i++) { const n = givenName(rng, { heritage: 'korean', sex: 'F', birthYear: 1962 + (i % 16), generation: 1 }); counts.set(n, (counts.get(n) || 0) + 1); }
  assert.ok(Math.max(...counts.values()) / 30000 < 0.05);
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
  // Taiwan's Wade-Giles spelling has no pinyin q, x, zh or ji (its j is pinyin r, as in Jung-hua)
  for (const sex of ['M', 'F']) for (const n of GIVEN['chinese-tw'][sex].flatMap(namesOf)) assert.ok(!/(^|-)(q|x|zh|ji)/i.test(n), `pinyin in a Taiwanese name: ${n}`);
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
  // Paddy is an Irish family's nickname (elsewhere in American English it reads as an ethnic label)
  assert.ok(nicks('Patrick', { heritage: 'irish', age: 60, sex: 'M' }).includes('Paddy'));
  for (const heritage of ['american', 'english', 'african-american', 'filipino']) {
    const got = nicks('Patrick', { heritage, age: 60, sex: 'M' });
    assert.ok(got.includes('Pat') && !got.includes('Paddy'), `${heritage}: ${got}`);
  }
  // a modest share of people go by a nickname, and only by one their custom allows
  const rng = new Rng(21);
  const got = draw(4000, () => nickname(rng, 'Roberto', { heritage: 'mexican', age: 45 }));
  const rate = share(got, n => n !== null);
  assert.ok(rate > 0.15 && rate < 0.45, `rate ${rate}`);
  assert.ok(got.every(n => n === null || ['Beto', 'Bob'].includes(n)));
  assert.equal(nickname(rng, '', { heritage: 'mexican', age: 30 }), null);
});

test('famous full names and stock joke names are avoided when the surname is known', () => {
  assert.ok(isReservedName('Michael', 'Jordan') && isReservedName('César', 'Chávez') && isReservedName('Kar-wai', 'Wong'));
  assert.ok(!isReservedName('Michael', 'Jordon') && !isReservedName('Maria', 'Chavez'));
  for (const [f, l] of [['Rodney', 'King'], ['Mujibur', 'Rahman'], ['Ziaur', 'Rahman'], ['Pat', 'Brown'], ['Ted', 'Williams'], ['Bill', 'Walsh'], ['Pancho', 'Villa'], ['Hugo', 'Chávez'], ['Ne', 'Win']]) assert.ok(isReservedName(f, l), `${f} ${l}`);
  for (const [f, l] of [['Mike', 'Hunt'], ['Wayne', 'Kerr'], ['Harry', 'Cox']]) assert.ok(isReservedName(f, l), `${f} ${l}`);
  assert.ok(RESERVED_NAMES.length > 400 && JOKE_NAMES.length >= 10);
  const rng = new Rng(23);
  const free = draw(3000, () => givenName(rng, { heritage: 'african-american', sex: 'M', birthYear: 1975, generation: 3 }));
  assert.ok(free.includes('Michael'), 'Michael is common for this cohort');
  const withJordan = draw(3000, () => givenName(rng, { heritage: 'african-american', sex: 'M', birthYear: 1975, generation: 3, surname: 'Jordan' }));
  assert.ok(!withJordan.includes('Michael'));
  // the reviewed cases, each common enough to come up thousands of times statewide without the check
  const never = (opts, name, n = 20000) => { for (let i = 0; i < n; i++) assert.notEqual(givenName(rng, opts), name, `${name} ${opts.surname}`); };
  never({ heritage: 'mexican', sex: 'F', birthYear: 1985, generation: 2, surname: 'Lopez' }, 'Jennifer');
  never({ heritage: 'african-american', sex: 'M', birthYear: 1968, generation: 3, surname: 'King' }, 'Rodney');
  never({ heritage: 'bangladeshi', sex: 'M', birthYear: 1950, generation: 1, surname: 'Rahman' }, 'Mujibur');
  never({ heritage: 'scottish', sex: 'M', birthYear: 1950, generation: 3, surname: 'Kerr' }, 'Wayne', 5000);
  for (let i = 0; i < 3000; i++) {
    assert.notEqual(nickname(rng, 'Patrick', { heritage: 'american', age: 60, sex: 'M', surname: 'Brown' }), 'Pat');
    assert.notEqual(nickname(rng, 'Theodore', { heritage: 'american', age: 70, sex: 'M', surname: 'Williams' }), 'Ted');
    assert.notEqual(nickname(rng, 'Michael', { heritage: 'american', age: 50, sex: 'M', surname: 'Hunt' }), 'Mike');
  }
  for (let i = 0; i < 20000; i++) {
    const n = nameFor(rng, { heritage: NAME_HERITAGES[i % NAME_HERITAGES.length], sex: i % 2 ? 'F' : 'M', birthYear: 1940 + (i % 80), generation: 1 + (i % 3) });
    assert.ok(!isReservedName(n.first, n.last) && !(n.nick && isReservedName(n.nick, n.last)), n.full);
    assert.notEqual(normName(n.first), normName(n.last));
  }
});

test('the population\'s call pattern: a household surname, then each member\'s given name and nickname with it', () => {
  // population.mjs draws the surname once per household and passes it (with sex) to givenName and nickname
  const rng = new Rng(41);
  let people = 0;
  for (const heritage of NAME_HERITAGES) {
    for (let h = 0; h < 150; h++) {
      const last = surname(rng, heritage);
      for (let m = 0; m < 4; m++) {
        const sex = (h + m) % 2 ? 'F' : 'M', birthYear = 1935 + ((h * 7 + m * 23) % 88), generation = 1 + ((h + m) % 3);
        const first = givenName(rng, { heritage, sex, birthYear, generation, nativity: generation === 1 ? 'foreign' : 'native', surname: last });
        const nick = nickname(rng, first, { heritage, age: 2026 - birthYear, sex, surname: last });
        assert.ok(!isReservedName(first, last) && !(nick && isReservedName(nick, last)), `${nick || first} ${last}`);
        assert.notEqual(normName(first.split(' ')[0]), normName(last), `${first} ${last}`);
        people++;
      }
    }
  }
  assert.equal(people, NAME_HERITAGES.length * 600);
});

test('integration: Population\'s NPCs carry names that respect the safeguards, with realistic surname spreads', async () => {
  // imported here so that the rest of this file still runs if population.mjs is mid-edit
  const { Population, LEGION_SEED } = await import('../src/engine/population.mjs');
  const world = await loadDefaultWorld();
  const pop = new Population(world, { seed: LEGION_SEED });
  // Los Angeles, San Francisco, Westminster, Glendale, Yuba City, Fresno, Sacramento, Hawthorne, Hayward
  let people = 0;
  const bad = [];
  for (const zip of ['90011', '94134', '92683', '90043', '91205', '95993', '93727', '95828', '90250', '94544']) {
    const zi = world.indexOf(zip);
    for (let h = 0; h < 600; h++) {
      for (let m = 0; m < pop.householdSize(zi, h); m++) {
        const { first, last, nick, display } = pop.person(zi, h, m).name;
        people++;
        if (isReservedName(first, last) || (nick && isReservedName(nick, last)) || normName(first.split(' ')[0]) === normName(last)) bad.push(`${zip}-${h}-${m} ${display}`);
        for (const w of normName(display).split(' ')) if (BLOCKED_NAMES.includes(w)) bad.push(`${zip}-${h}-${m} ${display}`);
      }
    }
  }
  assert.ok(people > 15000, `${people} people`);
  assert.deepEqual(bad, [], `${bad.length} of ${people} NPCs: ${bad.slice(0, 8).join('; ')}`);
  // households by surname, in the communities the review looked at: Sacramento's Lao families, LA's Ethiopian
  // families, Hawthorne's Nigerian families and Hayward's Pacific Islanders share no surname beyond a few percent,
  // while a third of Westminster's Vietnamese households are Nguyens
  const spread = (zip, heritage, households) => {
    const zi = world.indexOf(zip), counts = new Map();
    let n = 0;
    for (let h = 0; h < Math.min(households, world.z.hh[zi]); h++) {
      if (pop.householdCore(zi, h).heritage !== heritage) continue;
      const last = pop.person(zi, h, 0).name.last;
      counts.set(last, (counts.get(last) || 0) + 1);
      n++;
    }
    const [name, top] = [...counts].sort((a, b) => b[1] - a[1])[0];
    return { n, name, share: top / n };
  };
  for (const [zip, heritage] of [['95828', 'lao'], ['90018', 'ethiopian'], ['90250', 'nigerian'], ['94544', 'pacific']]) {
    const s = spread(zip, heritage, Infinity);
    assert.ok(s.n >= 100, `${zip} ${heritage}: ${s.n} households`);
    assert.ok(s.share < 0.06, `${zip} ${heritage}: ${s.name} ${(100 * s.share).toFixed(1)}% of ${s.n} households`);
  }
  const vn = spread('92683', 'vietnamese', 3000);
  assert.ok(vn.name === 'Nguyen' && vn.share > 0.28 && vn.share < 0.45, `Westminster: ${vn.name} ${vn.share}`);
});

test('feminine surname forms for immigrant women of Slavic and Greek families', () => {
  assert.equal(adaptSurname('Ivanov', { heritage: 'russian', sex: 'F' }), 'Ivanova');
  assert.equal(adaptSurname('Nikitin', { heritage: 'russian', sex: 'F' }), 'Nikitina');
  assert.equal(adaptSurname('Kowalski', { heritage: 'polish', sex: 'F' }), 'Kowalska');
  assert.equal(adaptSurname('Papadopoulos', { heritage: 'greek', sex: 'F' }), 'Papadopoulou');
  assert.equal(adaptSurname('Kovalenko', { heritage: 'ukrainian', sex: 'F' }), 'Kovalenko');
  assert.equal(adaptSurname('Ivanov', { heritage: 'russian', sex: 'M' }), 'Ivanov');
  assert.equal(adaptSurname('Garcia', { heritage: 'mexican', sex: 'F' }), 'Garcia');
  // Greek patronymics in -idis, -iadis and -adis take -idou, -iadou, -adou; -akis and other -is endings take -i
  assert.equal(adaptSurname('Georgiadis', { heritage: 'greek', sex: 'F' }), 'Georgiadou');
  assert.equal(adaptSurname('Michailidis', { heritage: 'greek', sex: 'F' }), 'Michailidou');
  assert.equal(adaptSurname('Papadakis', { heritage: 'greek', sex: 'F' }), 'Papadaki');
  assert.equal(adaptSurname('Pappas', { heritage: 'greek', sex: 'F' }), 'Pappa');
  assert.equal(adaptSurname('Georgiou', { heritage: 'greek', sex: 'F' }), 'Georgiou');
  // the feminine form is final: applying it again changes nothing (population.mjs may adapt a name twice)
  for (const [name, heritage] of [['Ivanov', 'russian'], ['Tolstoy', 'russian'], ['Kowalski', 'polish'], ['Shevchenko', 'ukrainian'], ['Kovalskyi', 'ukrainian'], ['Georgiadis', 'greek'], ['Papadakis', 'greek']]) {
    const once = adaptSurname(name, { heritage, sex: 'F' });
    assert.equal(adaptSurname(once, { heritage, sex: 'F' }), once, name);
  }
  const rng = new Rng(25);
  const women = draw(2000, () => surname(rng, 'russian', { sex: 'F', generation: 1 }));
  assert.ok(women.filter(s => /(ov|ev|in)a$/.test(s)).length > 1000 && women.every(s => !/(ov|ev)$/.test(s)));
  const greek = draw(20000, () => surname(rng, 'greek', { sex: 'F', generation: 1 }));
  assert.ok(greek.some(s => /idou$/.test(s)) && greek.every(s => !/i?adi$|idi$/.test(s)), 'no Georgiadi or Michailidi');
});

test('keys that only exist on Object.prototype fall back like any unknown key instead of crashing', () => {
  const rng = new Rng(43);
  for (const key of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf']) {
    assert.ok(NAME_RE.test(givenName(rng, { heritage: key, sex: 'M', birthYear: 1970 })), key);
    assert.ok(NAME_RE.test(surname(rng, key)), key);
    const n = nameFor(rng, { heritage: key, sex: 'F', birthYear: 1990, parents: ['constructor', '__proto__', key] });
    assert.ok(NAME_RE.test(n.first) && NAME_RE.test(n.last), key);
    assert.equal(typeof middleName(rng, { heritage: key, sex: 'F', birthYear: 1990 }), 'string');
    const nick = nickname(rng, 'William', { heritage: key, age: 50 });
    assert.ok(nick === null || NAME_RE.test(nick), key);
    assert.equal(adaptSurname('Ivanov', { heritage: key, sex: 'F' }), 'Ivanov');
    assert.ok(givenPool(key, 'M', 1).length >= 40 && surnamePool(key).length >= 40, key);
  }
  for (const given of ['Constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    for (const heritage of ['mexican', 'vietnamese', 'korean', 'sikh', 'filipino', 'thai']) {
      assert.ok(Array.isArray(nicknameCandidates(given, { heritage, age: 50, sex: 'M' })), `${given} ${heritage}`);
    }
  }
  // and options may be left out or null
  assert.ok(NAME_RE.test(givenName(rng, null)) && NAME_RE.test(givenName(rng)));
  assert.ok(nickname(rng, 'José', null) === null || typeof nickname(rng, 'José', null) === 'string');
  assert.ok(NAME_RE.test(nameFor(rng, null).first));
  assert.equal(adaptSurname('Georgiadis', null), 'Georgiadis');
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
    const heritage = NAME_HERITAGES[i % NAME_HERITAGES.length], sex = i & 1 ? 'F' : 'M';
    const last = surname(rng, heritage);
    const first = givenName(rng, { heritage, sex, birthYear: 1930 + (i % 95), generation: 1 + (i % 3), surname: last });
    chars += first.length + last.length + (nickname(rng, first, { heritage, age: i % 90, sex, surname: last }) || '').length;
  }
  const perPerson = (performance.now() - t0) * 1000 / 100000;
  assert.ok(chars > 0 && perPerson < 20, `${perPerson.toFixed(2)} µs per person`);
});
