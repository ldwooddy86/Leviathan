/* Reading grade. Flesch-Kincaid over the prose of a page (paragraphs, not headings), with the sentences that push the
   grade up listed so the writer knows which ones to shorten. The syllable count is a heuristic with a list of the common
   words it would get wrong; across a page its errors cancel to within a few tenths of a grade. */

const DOT = '․';   /* stands in for a period that does not end a sentence */
const ABBR = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'St', 'Ave', 'Blvd', 'Rd', 'Ste', 'Hwy', 'No', 'Inc', 'Co', 'Corp', 'Ltd', 'vs', 'etc', 'approx', 'Lic', 'Dept', 'Est', 'Fig', 'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec', 'Mt', 'Ft'];
const ABBR_RE = new RegExp('\\b(' + ABBR.join('|') + ')\\.', 'g');

/* the sentences of a text */
export function sentences(text) {
  let s = String(text).replace(/\r/g, '');
  s = s.replace(ABBR_RE, '$1' + DOT)
    .replace(/\b([A-Za-z])\.(?=[A-Za-z]\.)/g, '$1' + DOT).replace(new RegExp(DOT + '([A-Za-z])\\.', 'g'), DOT + '$1' + DOT)   /* U.S., a.m., e.g. */
    .replace(/(\d)\.(?=\d)/g, '$1' + DOT)
    .replace(/\.(?=[a-z0-9-]+\.[a-z]{2,}\b)|(?<=\b[a-z0-9-]+)\.(?=(com|org|net|gov|edu|io|co|us)\b)/gi, DOT);
  const out = [];
  for (const para of s.split(/\n+/)) {
    for (const piece of para.split(/(?<=[.!?]["'”’)\]]?)\s+(?=["'“‘(\[]?[A-Z0-9])/)) {
      const t = piece.replace(new RegExp(DOT, 'g'), '.').trim();
      if (t && /[A-Za-z0-9]/.test(t)) out.push(t);
    }
  }
  return out;
}

/* the words of a text; a number with its commas and decimals is one word, and so is a hyphenated compound */
export const words = text => String(text).match(/\d[\d,.]*\d|[A-Za-z0-9]+(?:['’][A-Za-z]+)*(?:-[A-Za-z0-9]+(?:['’][A-Za-z]+)*)*/g) || [];

const FIXED = {
  area: 3, areas: 3, idea: 3, ideas: 3, create: 2, creates: 2, created: 3, creating: 3, real: 1, really: 2, every: 2, everything: 3, everyone: 3, everywhere: 3,
  people: 2, business: 2, businesses: 3, maybe: 2, beyond: 2, anyone: 3, anything: 3, anywhere: 3, layer: 2, layers: 2, quiet: 2, quieter: 3, quietly: 3, science: 2,
  client: 2, clients: 2, diet: 2, friend: 1, friends: 1, friendly: 2, element: 3, elements: 3, supplement: 3, implement: 3, cement: 2, tier: 1, pier: 1,
  being: 2, doing: 2, going: 2, seeing: 2, evening: 2, different: 3, difference: 3, family: 3, families: 3, comfortable: 4, vehicle: 3, poem: 2, lion: 2,
  ac: 2, hvac: 2, seer: 1, btu: 3, diy: 3, faq: 3, llc: 3, tx: 2, dfw: 3, usa: 3, ok: 2, tv: 2, co2: 3, r22: 3, r410a: 5, r454b: 5, r32: 3, a2l: 3, uv: 2,
  heat: 1, heater: 2, heating: 2, air: 1, their: 1, there: 1, where: 1, here: 1, were: 1, are: 1, our: 1, hour: 1, hours: 1, fire: 1, tire: 1, tired: 1, wire: 1, wired: 1, entire: 2,
  size: 1, sized: 1, sizes: 2, use: 1, used: 1, uses: 2, house: 1, houses: 2, cause: 1, causes: 2, caused: 1, price: 1, prices: 2, priced: 1, service: 2, services: 3, serviced: 2,
  mile: 1, miles: 1, file: 1, while: 1, whole: 1, sale: 1, rule: 1, rules: 1, role: 1, style: 1, cycle: 2, cycles: 2, mobile: 2, style_: 1,
  safety: 2, ninety: 2, surely: 2, lovely: 2, movement: 2, statement: 2, basement: 2, pavement: 2, something: 2, sometimes: 2, somewhere: 2, someone: 2, somehow: 2,
  homeowner: 3, homeowners: 3, household: 2, households: 2, lifetime: 2, anytime: 3, therefore: 2, forehead: 2, careful: 2, carefully: 3, useful: 2, useless: 2, hopeful: 2,
  evaporator: 5, refrigerant: 4, thermostat: 3, compressor: 3, condenser: 3, furnace: 2, furnaces: 3, capacitor: 4, variable: 4, reliable: 4, available: 4,
  experience: 4, experienced: 4, convenient: 3, efficient: 3, efficiency: 4, ancient: 2, patient: 2, patients: 2, science_: 2, interior: 4, exterior: 4, superior: 4, prior: 2, period: 3, priority: 4,
  ratio: 3, radio: 3, patio: 3, audio: 3, studio: 3, video: 3, videos: 3, museum: 3, theater: 3, react: 2, reaction: 3, reality: 4, realize: 3, realtor: 3, ideal: 3, usually: 4, actually: 4, casual: 3, annual: 3, manual: 3, gradual: 3, usual: 3, visual: 3,
  licensed: 2, insured: 2, advised: 2, replaced: 2, installed: 2, repaired: 2, inspected: 3, tested: 2, needed: 2, wanted: 2, heated: 2, cooled: 1, rated: 2, dated: 2, limited: 3, trusted: 2, certified: 3, qualified: 3,
  texas: 2, dallas: 2, plano: 2, frisco: 2, irving: 2, mesquite: 2, arlington: 3, garland: 2, mckinney: 3, denton: 2, carrollton: 3, louisiana: 5, orleans: 2,
};

/* the syllables of one word */
export function syllables(word) {
  const w = String(word).toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (w.includes('-')) return w.split('-').filter(Boolean).reduce((n, p) => n + syllables(p), 0) || 1;
  if (FIXED[w]) return FIXED[w];
  if (/^\d/.test(w) || !/[a-z]/.test(w)) return 1;
  if (w.length <= 3) return 1;
  let s = w, n = 0;
  if (/[^aeiou]ed$/.test(s) && !/[td]ed$/.test(s)) s = s.slice(0, -2);                      /* replaced, cooled; heated keeps its ending */
  else if (/[^aeiou]es$/.test(s) && !/(s|x|z|ch|sh|c|g)es$/.test(s)) s = s.slice(0, -2);    /* homes, rates; fixes and changes keep theirs */
  else if (/e$/.test(s) && !/[^aeiou]le$/.test(s) && !/(ee|ie|ue|oe|ye)$/.test(s)) s = s.slice(0, -1);   /* home; table keeps its ending */
  n = (s.match(/[aeiouy]+/g) || []).length;
  if (/[^ct]ia/.test(w)) n++;                 /* media, material; special and initial stay */
  if (/[^qg]ua/.test(w)) n++;                 /* actual, manual; quality and guard stay */
  if (/[^ctx]ious$/.test(w)) n++;             /* various, serious */
  if (/io$|rio(?!$|us)/.test(w)) n++;            /* ratio, period, interior */
  if (/[^ct]ien/.test(w)) n++;                /* convenient, experience */
  if (/[aeiouy]ing$/.test(w)) n++;            /* trying, seeing */
  if (/[a-z]{2}ier$|iest$/.test(w)) n++;      /* carrier, easiest */
  if (/eo(?!u)/.test(w) && !/geo|people/.test(w)) n++;   /* video */
  if (/[^aeioul]ement$/.test(w)) n--;         /* replacement, requirement */
  else if (/[^aeiou]e(?:ful|fully|less|ness|ly|ments?|ty|times?|thing|where|owners?|holds?|works?|ware|lines?|side|ways?|back)$/.test(w)) n--;   /* safely, careful, homeowner */
  return Math.max(1, n);
}

const fk = (w, s, sy) => (w && s) ? 0.39 * (w / s) + 11.8 * (sy / w) - 15.59 : 0;
const one = x => Math.round(x * 10) / 10;

/* the reading statistics of a text */
export function grade(text) {
  const S = sentences(text); let W = 0, SY = 0, long = 0, hard = 0;
  const per = S.map(s => { const ws = words(s), sy = ws.reduce((n, w) => n + syllables(w), 0); W += ws.length; SY += sy; if (ws.length > 25) long++; hard += ws.filter(w => syllables(w) >= 3).length; return { text: s, words: ws.length, grade: one(fk(ws.length, 1, sy)) }; });
  const g = fk(W, S.length, SY);
  return {
    sentences: S.length, words: W, syllables: SY, grade: one(g), ease: one(W && S.length ? 206.835 - 1.015 * (W / S.length) - 84.6 * (SY / W) : 0),
    wordsPerSentence: one(S.length ? W / S.length : 0), syllablesPerWord: Math.round((W ? SY / W : 0) * 100) / 100, longSentences: long, longWordShare: one(W ? 100 * hard / W : 0), per,
  };
}

/* the sentences that raise the grade most: long ones first, then ones heavy with long words */
export function hardest(stats, n = 6, over = 9) {
  return stats.per.filter(s => s.words >= 8 && s.grade > over).sort((a, b) => b.grade - a.grade).slice(0, n);
}
