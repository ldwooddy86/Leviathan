// Legion · dialogue · plan: what to say, and how to put it.
//
// A planner per intent chooses content from the persona (job, family, home, commute, interests, worries,
// memories), the mind (mood, the relationship and what the player told them) and the world (ground.mjs), and
// asks the realizer for sentences by template key with the slots filled. The realizer (say) picks a template the
// speaker can say (tags), in their language mode, never one already used in this conversation (the lexicon's
// Picker), and fills it; lex() does the same for the dialect's regional lines. compose() then styles the reply:
// how many sentences (verbosity), an opener, the player's name now and then, a mood aside, a follow-up question
// (extraversion and agreeableness), a word or phrase in the home language at the persona's rate (with the English
// in the gloss), and the facts used.

import { pickLine, phrasesFor, codeSwitch, templateSlots, linesFor, slangFor, resolveLanguage, roadNames, LANGUAGES, fill as lexFill, glossOf } from '../lexicon.mjs';
import { hashStr } from '../rng.mjs';
import { OCCUPATION_CATALOG } from '../occupations.mjs';
import { wherePhrase } from '../persona.mjs';
import { PEOPLE } from './en-people.mjs';
import { PLACE } from './en-place.mjs';
import { SPANISH } from './es.mjs';
import {
  isNum, num, str, capFirst, withArticle, listJoin, numWord, fillLine, tagsHold, cleanText, fitsLife, lexiconLineFits, lintText, terminate, tidy,
  cleanGloss, fullDate, monthYear, partOfMonth, mesAno, parseDate, MONTHS, MESES, approx, compass, slotNames,
  sentencesOf, sentenceKey, contentWords, nearlySame,
} from './core.mjs';
import * as G from './ground.mjs';
import { employerPhrase } from './voice.mjs';
import { screenValue } from './probe.mjs';
import { everydayLine, reactionLine } from './understand.mjs';
import { HOLIDAYS, holidayWhen, holidaySoon, worksHoliday } from './holiday.mjs';
import {
  interestTalk, CONCERN_WORDS, jobSpanish, feelKey, SCHOOL_WORDS, DIR_ES, LANG_ES, shareVerbEs, cieloEs, cuandoEs, mesEs, millasEs, approxEs, employerEs,
  placeEs, heritageLabelEs, trailEs, decadeEs,
} from './life.mjs';

const NO_BRANDS = () => [];

/** Every English template bank by key (people and place). */
export const EN = Object.freeze(Object.assign({}, PEOPLE, PLACE));
export { SPANISH };

const HEAVY = new Set(['fire', 'storm', 'earthquake', 'insurance']);

// ------------------------------------------------------------------ the realizer

// A template's frame and a memory's own words saying the same thing twice ("I remember that day. I remember ...").
const ECHO = /\b(I remember|I'll never forget|I was here for)\b[\s\S]*\b\1\b/i;

/**
 * True when no sentence of a candidate line was said in this conversation (st.sentences, st.sentWords) or is
 * already planned for this reply (S.planned), word for word or nearly (nearlySame): the realizer then takes another
 * variant, and a part with nothing new to say is left out.
 * @param {object} S the session
 * @param {string} text
 * @returns {boolean}
 */
export function freshText(S, text) {
  const st = S.st;
  const name = S.v.relq ? S.v.relq.name : null;
  for (const s of sentencesOf(text)) {
    // within one reply any sentence counts ("It's California." twice); across the conversation, three words or more
    const k1 = sentenceKey(s, name, 1);
    if (k1 && S.planned && S.planned.has(k1)) return false;
    const k = sentenceKey(s, name);
    if (!k) continue;
    if (st.sentences && st.sentences.has(k)) return false;
    const cw = contentWords(k);
    if (cw.size < 4) continue;
    if (st.sentWords) for (const prev of st.sentWords) if (nearlySame(cw, prev)) return false;
    if (S.plannedWords) for (const prev of S.plannedWords) if (nearlySame(cw, prev)) return false;
  }
  return true;
}

/** Hold a chosen line's sentences for the rest of this reply, so no other part says them again. */
function holdSentences(S, text) {
  if (!S.planned) S.planned = new Set();
  if (!S.plannedWords) S.plannedWords = [];
  const name = S.v.relq ? S.v.relq.name : null;
  for (const s of sentencesOf(text)) {
    const k1 = sentenceKey(s, name, 1);
    if (k1) S.planned.add(k1);
    const k = sentenceKey(s, name);
    if (!k) continue;
    const cw = contentWords(k);
    if (cw.size >= 4) S.plannedWords.push(cw);
  }
}

/**
 * One sentence from a template bank for the speaker's language mode, or null.
 * @param {object} S the session
 * @param {string} key
 * @param {object} [slots]
 * @param {string[]} [facts]
 * @returns {{text: string, gloss: string|null, facts: string[], key: string}|null}
 */
export function say(S, key, slots = {}, facts = []) {
  const v = S.v;
  const mode = v.lang.mode;
  const list = (mode === 'en' ? EN : SPANISH)[key];
  if (!list || !list.length) return null;
  // wordplay that only works in Spanish (@es) is for Spanish speakers; in plain English it is nonsense
  // slots._prefer: variants that answer the question asked ("is it hard?" → the lines about how hard it is), when any fit
  // slots._avoid: variants that would say again what the reply just said ("nice to meet you" twice)
  const fitting = list.filter(l => tagsHold(l, v) && !(slots._avoid && slots._avoid.test(mode === 'en' ? l.text : (l.gloss || l.text))));
  const preferred = slots._prefer ? fitting.filter(l => slots._prefer.test(mode === 'en' ? l.text : (l.gloss || l.text))) : [];
  const usable = preferred.length ? preferred : fitting;
  if (!usable.length) return null;
  const all = Object.assign({}, S.base, slots);
  if (all.very === undefined && mode === 'en' && usable.some(l => l.text.includes('{very'))) all.very = intensifier(S);
  const hit = S.picker.pickWhere(`${mode === 'en' ? 'en' : 'es'}:${key}`, usable, line => {
    // "a pretty pretty day": an intensifier never doubles the word after it
    const next = mode === 'en' && all.very ? /\{very\??\}\s+([A-Za-z]+)/.exec(line.text) : null;
    const sl = next && next[1].toLowerCase() === String(all.very).toLowerCase() ? Object.assign({}, all, { very: 'really' }) : all;
    if (mode === 'en') {
      const a = fillLine(line.text, sl);
      if (!a || !cleanText(a.text) || !fitsLife(a.gloss, v) || ECHO.test(a.text) || !freshText(S, a.text)) return null;
      return { text: a.text, gloss: a.foreign ? a.gloss : null, line };
    }
    const es = fillLine(line.text, spanishSlots(sl)), en = fillLine(line.gloss, sl);
    if (!es || !en || !cleanText(es.text) || !cleanText(en.text) || !fitsLife(en.text, v)) return null;
    es.text = contractEs(es.text);
    if (!freshText(S, mode === 'es' ? es.text : en.text)) return null;
    if (mode === 'es') return { text: es.text, gloss: en.text, line };
    return { text: en.text, gloss: null, line };
  }, S.rng);
  if (!hit) return null;
  holdSentences(S, hit.value.text);
  return { text: hit.value.text, gloss: hit.value.gloss, facts: factsOfTemplate(facts, hit.value.line), key };
}

// Slots that hold a place of birth or a homeland, said the Spanish way on the Spanish side of a line.
const PLACE_SLOTS = ['birthplace', 'country', 'homeland'];

/** The slots for the Spanish side of a line: places of birth by their Spanish names ("la Ciudad de México"). */
function spanishSlots(sl) {
  if (!PLACE_SLOTS.some(k => typeof sl[k] === 'string')) return sl;
  const out = Object.assign({}, sl);
  for (const k of PLACE_SLOTS) if (typeof out[k] === 'string') out[k] = placeEs(out[k]);
  return out;
}

/** "de el Estado de México" → "del Estado de México": the article contractions a filled name can leave. */
function contractEs(text) {
  return text.replace(/\b([Dd]e|[Aa]) el\b/g, (m, w) => (w[0] === 'D' ? 'Del' : w[0] === 'd' ? 'del' : w[0] === 'A' ? 'Al' : 'al'));
}

/**
 * The facts a chosen template states. facts is a list (every one is stated, whatever the variant) or a map from
 * slot name to fact id(s), with '' for the facts every variant states: a slot's facts count only when the chosen
 * variant uses that slot (or its Cap / Es forms), so a line that never names the town carries no fact for it.
 * @param {string[]|Record<string, string|string[]|null>} facts
 * @param {{text: string, gloss: string|null}} line the compiled template
 * @returns {string[]}
 */
export function factsOfTemplate(facts, line) {
  if (Array.isArray(facts)) return facts.filter(Boolean);
  if (!facts || typeof facts !== 'object') return [];
  const used = new Set([...slotNames(line.text), ...(line.gloss ? slotNames(line.gloss) : [])]);
  const out = [];
  for (const [slot, ids] of Object.entries(facts)) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (!list.length) continue;
    if (slot === '' || [...used].some(u => u === slot || u === `${slot}Cap` || u === `${slot}Es` || u === `${slot}CapEs`)) out.push(...list);
  }
  return [...new Set(out)];
}

// Intensifiers that go before an adjective ("hella cold", "real hot", "way too much"), not sentence adverbs.
const BAD_INTENSIFIERS = new Set(['lowkey', 'highkey', 'literally', 'totally', 'basically']);

/** An intensifier in the speaker's voice: "very" or "really" when formal, the dialect's own otherwise ("hella"). */
export function intensifier(S) {
  const v = S.v;
  if (v.reg === 'formal' || v.lang.mode !== 'en') return S.rng.pick(['very', 'really']);
  const opts = Object.assign({}, v.context, { speaker: v.speaker, age: v.age });
  for (let i = 0; i < 3; i++) {
    const hit = pickLine(v.key, 'intensifiers', S.rng, opts);
    if (hit && !BAD_INTENSIFIERS.has(hit.text) && /^[a-z]+$/.test(hit.text)) return hit.text;
  }
  return S.rng.pick(['really', 'so', 'pretty']);
}

// The dialect categories that have Spanish variants (lexicon ES_CATEGORIES, and the weather lines).
const LEX_ES = new Set(['food', 'traffic', 'prideLines', 'complaintLines', 'weather']);

/**
 * A regional line from the speaker's dialect (lexicon), filtered by the situation and the speaker's life: English
 * for English speakers, and for a Spanish speaker the dialect's Spanish variant with its English gloss (food,
 * traffic, pride, complaints, the weather), so the places where most people speak Spanish keep their own lines.
 * Greetings that presume the player is known (@met) come only once they have met. extra overrides the lexicon's slot
 * values (with their fact ids in extraFacts).
 */
export function lex(S, category, extra = {}, extraFacts = {}) {
  const v = S.v;
  const es = v.lang.mode === 'es';
  if (v.lang.mode !== 'en' && !(es && LEX_ES.has(category))) return null;
  const slots = Object.assign({}, v.lex.values, extra);
  // a dialect line never states an estimated temperature as a fact
  if (exactTemp(v) === null && !('temp' in extra)) slots.temp = null;
  const met = !!((v.relq && v.relq.known) || (S.st && S.st.prev));
  const opts = Object.assign({}, v.context, { speaker: v.speaker, slots, picker: S.picker, regionalShare: 0.65, age: v.age, met }, es ? { lang: 'es' } : {});
  for (let i = 0; i < 6; i++) {
    let hit = null;
    try { hit = pickLine(v.key, category, S.rng, opts); } catch { hit = null; }
    if (!hit) return null;
    // (a Spanish line is judged by its English: what it assumes of the speaker and the moment)
    const en = es ? hit.gloss : hit.text;
    if (es && (!en || !cleanText(en))) continue;
    // the dialect's lines carry a few tags; what they still assume (a commute, today's sky, a pier, a crash on the
    // freeway right now) is checked against the speaker's record and the world here
    if (!cleanText(hit.text) || !fitsLife(en, v) || !lexiconLineFits(en, v, category) || S.st.said.has(hit.text) || !freshText(S, hit.text)) continue;
    // the engine's own style rules hold for borrowed lines too: no "gonna", no mock foreign words, no brands
    if (lintText(en, NO_BRANDS, { english: true }).length || (es && lintText(hit.text, NO_BRANDS, { english: false }).length)) continue;
    const facts = templateSlots(hit.template).map(s => extraFacts[s] || (v.lex.facts && v.lex.facts[s]) || null).filter(Boolean);
    if (templateSlots(hit.template).includes('temp')) facts.push('weather.now');
    holdSentences(S, hit.text);
    return { text: hit.text, gloss: es ? en : null, facts, key: `lex:${category}` };
  }
  return null;
}

/** Spanish second-person forms: tú with friends and the young, usted with strangers and elders. */
export const TU_FORMS = /\b(te|tú|tu|ti|contigo|estás|eres|vos|andás|hacés)\b|Cuídate|Abrígate|Pásale/i;
/** Spanish usted forms. */
export const USTED_FORMS = /\b(usted|le|lo bendiga|la bendiga)\b|Cuídese/i;

/** A phrase gloss that says who it is said to ("Hello (to an elder)"): the player's age and sex are unknown. */
export const AUDIENCE_NOTE = /\((to a (man|woman|boy|girl|friend|child|younger|elder|stranger)|to someone|said when|to an |when leaving|to customers)/i;

/**
 * A phrase in the speaker's home language for an intent ({text, gloss}), or null when the language has nothing that
 * fits (the caller then stays in English). Phrases tied to the listener's gender are skipped: the player's is unknown.
 */
export function homePhrase(S, intent, fits = null, avoid = null) {
  const v = S.v, lang = v.lang.cs ? v.lang.cs.lang : v.lang.known;
  if (!lang || !LANGUAGES[lang]) return null;
  const opts = { sex: v.sex, t: v.t, variety: v.lang.variety, faith: v.lang.faith, register: v.lang.usted ? 'respect' : undefined };
  const ok = e => !!e && !e.to && !AUDIENCE_NOTE.test(e.gloss)
    && (v.lang.faith || !/\bGod\b|\bbless/i.test(e.gloss))
    && (lang !== 'spanish' || (v.lang.usted ? !TU_FORMS.test(e.text) : !USTED_FORMS.test(e.text)))
    && (!fits || fits.test(e.gloss)) && (!avoid || !avoid.test(e.gloss));
  // the lexicon's own choice first (it honors gender, variety, faith, register and the hour), kept when it fits
  // this listener and topic and has not been said yet; else a fitting phrase from the same filtered bank
  let e = codeSwitch(lang, intent, S.rng, Object.assign({ picker: S.picker }, opts));
  if (!ok(e)) {
    const list = (phrasesFor(lang, intent, opts) || []).filter(ok);
    e = list.length ? S.picker.pick(`cs:${lang}:${intent}:fit`, list, S.rng) : null;
  }
  if (!e) return null;
  const alts = String(e.gloss).replace(/\s*\([^)]*\)/g, '').split(' / ').map(x => x.trim()).filter(Boolean);
  const gloss = (fits && alts.find(a => fits.test(a))) || cleanGloss(e.gloss);
  return { text: e.text, gloss, roman: e.roman || null };
}

// The everyday English for a family relation, which the home word's gloss should start with ("mamá" is "mom").
const EVERYDAY_RELATION = { mother: /^(mom|mommy|mama)\b/i, father: /^(dad|daddy|papa)\b/i, grandmother: /^(grandma|grandmother|granny)\b/i, grandfather: /^(grandpa|grandfather)\b/i };
// the everyday names of a relation, as the lexicon's family terms key it
const RELATION_OF = { mom: 'mother', dad: 'father', grandma: 'grandmother', grandpa: 'grandfather' };

/**
 * A family word in the home language as a {t, g} slot value ("mamá" / "mom"), or null. Whether this speaker says
 * it at all is decided once per relation and conversation, at their code-switching rate; the word is the everyday
 * one ("mamá", not the formal "madre"; never a word that names which side of the family, which the record does not
 * know), and it stays the same word for the whole conversation.
 * @param {object} S the planner's session (voice, rng, conversation state)
 * @param {string} relation0 'mother', 'father', 'grandmother' or 'grandfather' (or mom, dad, grandma, grandpa)
 * @param {string} english the English word, kept as the gloss
 * @returns {{t: string, g: string}|null}
 */
export function homeWord(S, relation0, english) {
  const v = S.v, lang = v.lang.cs ? v.lang.cs.lang : null;
  if (!lang || v.lang.mode !== 'en') return null;
  const relation = RELATION_OF[relation0] || relation0;
  const st = S.st;
  if (!st.homeWords) st.homeWords = new Map();
  if (st.homeWords.has(relation)) { const w = st.homeWords.get(relation); return w ? { t: w.t, g: english } : null; }
  let word = null;
  if (S.rng.chance(v.lang.cs.rate)) {
    const opts = { sex: v.sex, variety: v.lang.variety, faith: v.lang.faith, register: v.lang.usted ? 'respect' : undefined };
    const pool = (phrasesForFamily(lang, relation, opts) || []).filter(e => e && !e.to && !AUDIENCE_NOTE.test(e.gloss)
      && !/\bformal\b|\bpaternal\b|\bmaternal\b|father's|mother's|\bnorthern\b|\brural\b/i.test(e.gloss));
    const everyday = EVERYDAY_RELATION[relation];
    const best = everyday ? pool.filter(e => everyday.test(e.gloss)) : pool;
    const list = best.length ? best : pool;
    // the persona's own word, the same in every conversation
    const e = list.length ? list[hashStr(`${v.p.id}:famword:${relation}`) % list.length] : null;
    if (e) word = { t: e.roman || e.text };
  }
  st.homeWords.set(relation, word);
  return word ? { t: word.t, g: english } : null;
}

/** Every family term a language has for a relation that this speaker could use (familyTerm's filtering, no draw). */
function phrasesForFamily(lang, relation, opts) {
  const key = resolveLanguage(lang, 0);
  const L = key && LANGUAGES[key];
  if (!L || !L.family) return null;
  const rel = { grandma: 'grandmother', grandpa: 'grandfather', mom: 'mother', dad: 'father' }[relation] || relation;
  const list = L.family[rel];
  if (!Array.isArray(list)) return null;
  // the lexicon's own choice decides what this speaker can say; collect every entry it will return
  return list.filter(e => {
    if (e.sex && e.sex !== opts.sex) return false;
    if (e.region) { const vr = opts.variety === undefined ? L.defaultVariety : opts.variety; if (!vr || !e.region.includes(vr)) return false; }
    if (e.faith && e.faith !== opts.faith) return false;
    if ((opts.register === 'respect' || opts.register === 'formal') && e.register === 'casual') return false;
    return true;
  });
}

// ------------------------------------------------------------------ slots

const PARENT_WORDS = { F: 'mom', M: 'dad' };

/**
 * Whether the speaker came to a home the household already had (a spouse or relative who joined later): their own
 * year in the ZIP is after the household's move-in year.
 */
function joinedLater(v) {
  const res = v.res || {};
  return isNum(res.zipSince) && isNum(v.hh.yearMoved) && res.zipSince > v.hh.yearMoved + 1;
}

/** The household's owner as the speaker names them ("my husband", "my wife"): the partner, else the family. */
function ownerWords(v) {
  const p = v.rel.partner;
  const w = p ? (p.role === 'partner' || v.npc.role === 'partner' ? 'partner' : p.sex === 'F' ? 'wife' : 'husband') : null;
  return {
    owner: w ? `my ${w}` : 'my family', ownerPos: w ? `my ${w}'s` : "my family's",
    ownerEs: w ? `mi ${w === 'partner' ? 'pareja' : w === 'wife' ? 'esposa' : 'esposo'}` : 'mi familia',
  };
}

/**
 * The slots every template may use: names, place, home, the Spanish gender ending. The years are the speaker's own:
 * yearMoved and yearsHere are when they came to this home (never before they came to the ZIP: someone who joined the
 * household later says their own year), zipSince and zipYears their years in the ZIP, and hhYear the household's
 * move-in year, for what the household did then (bought the place).
 */
export function baseSlots(v) {
  const res = v.res || {};
  const year = v.P.year;
  const hhYear = isNum(v.hh.yearMoved) ? v.hh.yearMoved : null;
  const zipSince = isNum(res.zipSince) ? res.zipSince : null;
  const yearMoved = hhYear !== null && zipSince !== null ? Math.max(hhYear, zipSince) : hhYear !== null ? hhYear : zipSince;
  const zipYears = zipSince !== null && year - zipSince >= 1 ? year - zipSince : null;
  return {
    first: v.first, given: v.given, full: v.full, display: v.display, nick: v.nick, place: v.lex.values.place || v.z.city, city: v.z.city, county: v.z.countyName,
    region: v.lex.values.region, homeWord: v.homeWord, aHome: withArticle(v.homeWord === 'apartment' && v.hh.dwelling === 'small-apartment' ? 'small apartment' : v.homeWord),
    unHomeEs: { house: 'una casa', apartment: 'un apartamento', 'mobile home': 'una casa móvil', place: 'una casa' }[v.homeWord] || 'una casa',
    yearMoved, yearsHere: isNum(yearMoved) && year - yearMoved >= 1 ? numWord(year - yearMoved) : null,
    yearsNum: isNum(yearMoved) && year - yearMoved >= 1 ? year - yearMoved : null, hhYear,
    zipSince, zipYears: zipYears !== null ? numWord(zipYears) : null, zipYearsNum: zipYears,
    countySince: isNum(res.countySince) ? res.countySince : null,
    age: v.age, nextAge: v.age + 1, o: v.sex === 'F' ? 'a' : 'o',
    // (an estimated temperature is said only by the weather lines that hedge it: "probably around 45")
    temp: exactTemp(v), month: MONTHS[v.P.month - 1], mesEs: mesEs(v.P.month),
    team: v.team ? v.team.label : null, teamName: v.team ? v.team.name : null,
    teamEs: v.team ? (/^the /.test(v.team.label) ? v.team.label.replace(/^the /, 'los ') : v.team.label) : null,
    player: v.relq.name,
    // their own practice's place ("services", "the gurdwara") and day, never a church unless the record says so
    worship: v.worship ? v.worship.en : null, worshipEs: v.worship ? v.worship.es : null,
    worshipDay: v.worship ? v.worship.day : null, worshipDayEs: v.worship ? v.worship.dayEs : null,
  };
}

function parentsWords(S) {
  const v = S.v, ps = v.rel.parents;
  if (!ps.length) return null;
  if (ps.length >= 2) return { en: 'parents', es: 'mis papás' };
  const p = ps[0];
  const en = PARENT_WORDS[p.sex] || 'parent';
  return { en, es: p.sex === 'F' ? 'mi mamá' : 'mi papá', rel: p.sex === 'F' ? 'mother' : 'father' };
}

function siblingWords(list) {
  if (!list.length) return null;
  if (list.length === 1) {
    const s = list[0];
    const w = s.sex === 'F' ? 'sister' : 'brother';
    return { en: s.name ? `my ${w}, ${s.name}` : `my ${w}`, es: s.sex === 'F' ? 'mi hermana' : 'mi hermano' };
  }
  const girls = list.every(s => s.sex === 'F');
  return { en: `${numWord(list.length)} ${girls ? 'sisters' : list.every(s => s.sex === 'M') ? 'brothers' : 'siblings'}`, es: girls ? 'mis hermanas' : 'mis hermanos' };
}

/** The temperature now when it is the ZIP's own forecast (world.weatherAt approx false), else null. */
export function exactTemp(v) {
  return v && v.wx && (v.wx.stale || v.wx.approx === true) ? null : v ? v.tempF : null;
}

/**
 * A roof that is not the original: "we redid the roof" only when it was done after the household moved in; one
 * redone before they bought the place was the last owner's work.
 */
function roofLine(S, roof) {
  const moved = S.v.hh && isNum(S.v.hh.yearMoved) ? S.v.hh.yearMoved : null;
  const ours = moved === null || roof.installed >= moved;
  return say(S, ours ? 'home.roofNew' : 'home.roofBefore', { roofYear: roof.installed }, ['persona.roof', 'npc.household']);
}

/** A record's station as slots: "the record at Lodgepole, about 70 miles away" (station, stationDist, stationDistEs). */
function stationSlots(rec) {
  const d = rec && isNum(rec.distKm) ? G.miles(rec.distKm) : null;
  return { station: rec ? rec.station : null, stationDist: d, stationDistEs: d ? millasEs(d) : null };
}

/** The speaker's main fact ids from their own record. */
const REC = { job: 'npc.occupation', commute: 'npc.commute', home: 'npc.household', residence: 'npc.residence', origin: 'npc.origin' };

/** Fact id of a persona memory, from its source. */
export function memoryFact(m) {
  const s = String(m && m.source || '');
  let x;
  if ((x = /^firesOf\([^)]*\): (.+) (\d{4})$/.exec(s))) return `fire:${x[1]}:${x[2]}`;
  if ((x = /^arsOf\([^)]*\): (\S+)/.exec(s))) return `ar:${x[1]}`;
  if ((x = /^windsOf\([^)]*\): (\S+) (\S+)/.exec(s))) return `wind:${x[1]}:${x[2]}`;
  if ((x = /^femaOf\([^)]*\): (\S+)/.exec(s))) return `fema:${x[1]}`;
  if ((x = /^zip \d+: (heat_rec_f|rain_rec_in|gust_max)/.exec(s))) return { heat_rec_f: 'record.heat', rain_rec_in: 'record.rain', gust_max: 'record.gust' }[x[1]];
  if (/arrivalYear/.test(s)) return 'npc.origin';
  if (/occupation/.test(s)) return 'npc.occupation';
  if (/status/.test(s)) return 'npc.status';
  if (/marital|members|yearMoved/.test(s)) return 'npc.household';
  if (/countySince/.test(s)) return 'npc.residence';
  if (/roof/.test(s)) return 'persona.roof';
  return 'persona.memory';
}

/** The part, marked as telling a persona memory (compose and the conversation then count it as told). */
function withMem(p, m) {
  if (p && m && m.source) p.mem = m.source;
  return p;
}

/**
 * The part, marked as continuing the part before it ("Plus three siblings.", "Y también mis hermanos."): compose
 * leaves it out whenever the part before it is left out, so it never stands alone.
 */
function dependent(p) {
  if (p) p.dep = true;
  return p;
}

/**
 * A memory's title as said in a sentence: a federal declaration's "the winter storms 2005" becomes "the winter
 * storms of 2005"; other titles stay as the persona wrote them.
 */
export function memTitleOf(m) {
  const t = String((m && (m.title || m.text)) || '');
  // a fire is named the way people say it ("the Nelson (W-1) Fire in 2012" is "the Nelson Fire in 2012")
  const fx = /^firesOf\([^)]*\): (.+) (\d{4})$/.exec(String((m && m.source) || ''));
  if (fx) { const label = G.fireName(fx[1]); if (label) return `${label} in ${fx[2]}`; }
  // only a raw declaration title ("the winter storms 2005") is rewritten; one already said in full ("the storms of
  // January to April 2023", "the record rain of January 2010") stays as it is
  if (!/\d{4}$/.test(t) || /\b(of|in)\b/.test(t)) return t;
  return `the ${G.femaTitle(t)}`;
}

/** A memory's title in Spanish (the persona's titles are English). */
function memoryEs(m) {
  const dt = parseDate(m.date) || { y: m.year, m: null };
  const name = /^firesOf/.test(m.source || '') ? G.cleanFireName(String(m.source).replace(/^firesOf\([^)]*\): /, '').replace(/ \d{4}$/, '')).replace(/\s+(Fire|Complex)$/i, '') : null;
  if (m.kind === 'fire' && name) return `el incendio ${name} de ${m.year}`;
  if (m.kind === 'fire') return `los incendios de ${m.year}`;
  if (m.kind === 'storm') {
    const x = /^the (?:storms|fires) of (.+)$/.exec(String(m.title || ''));
    if (x) return `las tormentas de ${datesEs(x[1])}`;
    const y = /^the atmospheric river of (.+)$/.exec(String(m.title || ''));
    // (a declaration's title carries the storm's own date; the memory's date may be the declaration's)
    if (y) return `el río atmosférico de ${datesEs(y[1])}`;
    const w = titleWhen(m.title) || (m.year ? { y: m.year, m: null } : null);
    return w ? `las tormentas de ${w.m ? mesAno({ y: w.y, m: w.m }) : w.y}` : `las tormentas de ${mesAno(dt)}`;
  }
  if (m.kind === 'wind') return `los vientos de ${mesAno(dt)}`;
  if (m.kind === 'quake') return `el terremoto de ${m.year}`;
  if (m.kind === 'heat') return `el calor récord de ${m.year}`;
  if (m.kind === 'rain') return `la lluvia récord de ${mesAno(dt)}`;
  if (m.kind === 'gust') return `el viento récord de ${mesAno(dt)}`;
  return `lo que pasó en ${m.year}`;
}

// A storm declaration in Spanish by its kind: "las tormentas", "las inundaciones".
const FEMA_KIND_ES = { Flood: 'las inundaciones', 'Mud/Landslide': 'los deslaves', 'Winter Storm': 'las tormentas de invierno', Snowstorm: 'las nevadas', 'Severe Ice Storm': 'las heladas', 'Coastal Storm': 'las tormentas en la costa', 'Tropical Storm': 'la tormenta tropical', Hurricane: 'el huracán' };

/**
 * When a declared disaster happened, from its title ("Winter storms and mudslides 2023" → 2023, "… January 2025" →
 * enero de 2025): {y, m} or null. The declaration's own date is not the storm's (a January storm declared in February).
 */
function titleWhen(title) {
  const m = /(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(\d{4})\s*$/.exec(String(title || '').trim());
  return m ? { y: +m[2], m: m[1] ? MONTHS.indexOf(m[1]) + 1 : null } : null;
}

/** A storm declaration said in Spanish with its own date ("las tormentas de enero de 2024"), or without one. */
function femaEs(f) {
  const what = FEMA_KIND_ES[f && f.kind] || 'las tormentas';
  const w = titleWhen(f && f.title);
  return w ? `${what} de ${w.m ? mesAno({ y: w.y, m: w.m }) : w.y}` : `${what} que hubo`;
}

/** "es" or "son", agreeing with a Spanish noun phrase ("son los incendios", "es el incendio Bobcat"). */
export function copulaEs(phrase) {
  return /^(?:los|las|mis|sus|tus|unos|unas)\s/i.test(String(phrase || '').trim()) ? 'son' : 'es';
}

/** "January to April 2023" → "enero a abril de 2023". */
function datesEs(s) {
  let out = String(s);
  MONTHS.forEach((m, i) => { out = out.replace(new RegExp(`\\b${m}\\b`, 'g'), MESES[i]); });
  return out.replace(/ to /g, ' a ').replace(/ (\d{4})$/, ' de $1');
}

/** "el incendio Woolsey" from a fire name (cleaned the way it is said in English: "Parker2" is "Parker 2"). */
function fireEs(name) { return `incendio ${G.cleanFireName(String(name).replace(/^the\s+/i, '')).replace(/\s+(Fire|Complex)$/i, '')}`; }

/** Year of a life memory with this source ("npc.occupation" → the year they started the job). */
function lifeYear(v, source) {
  const m = (v.p.memories || []).find(x => x && x.kind === 'life' && String(x.source) === source);
  return m && isNum(m.year) ? m.year : null;
}

// ------------------------------------------------------------------ planners

const P = {};

// Words that hand a sentence back to an earlier subject ("Anyway, ...", "En fin, ..."): nothing came before an opener.
const RESUMING = /^(?:anyway|anyhow|by the way|so|oh,? and|en fin|bueno|y bueno)[,.]?\s+/i;

/** A part as the first thing said: without an "Anyway," that would hand back to a subject nobody raised. */
function freshStart(p) {
  if (!p || !RESUMING.test(p.text)) return p;
  const strip = s => (s ? capFirst(String(s).replace(RESUMING, '')) : s);
  return Object.assign({}, p, { text: strip(p.text), gloss: p.gloss ? strip(p.gloss) : p.gloss });
}

/** "¡Buenas tardes!": the time of day's greeting in Spanish, for a "Buenos días" from the player. */
function saludoParts(S) {
  const h = S.v.hour;
  const [es, en] = h >= 5 && h < 12 ? ['Buenos días', 'Good morning'] : h >= 12 && h < 19 ? ['Buenas tardes', 'Good afternoon'] : ['Buenas noches', 'Good evening'];
  return say(S, 'greet.saludo', { saludoEs: es, saludo: en });
}

/** "Happy Thanksgiving!": the wish back, as near or as far off as the holiday is. Null for any other greeting. */
function holidayGreeting(S, u) {
  if (!u || !u.flags || !u.flags.holidayGreeting || !u.entities.holiday) return null;
  const when = holidayWhen(u.entities.holiday, S.v.t);
  if (!when) return null;
  const H = HOLIDAYS[when.key], soon = holidaySoon(when.days);
  const slots = { holiday: H.en, holidayEs: H.es, holidayEsHappy: H.esHappy, holidaySoon: soon[0], holidaySoonEs: soon[1] };
  const key = when.days < -1 ? 'greet.holidayLate' : when.days > 2 ? 'greet.holidayEarly' : 'greet.holiday';
  const p = say(S, key, slots) || say(S, 'greet.holiday', slots);
  return p ? { p, slots } : null;
}

/**
 * The player said hello in another language ("안녕하세요!", "Bonjour!"): {speaks, name}. A speaker whose own language it
 * is answers with a phrase of it; anyone else says hello back in English and that they don't speak it. Null for a
 * hello in English or Spanish.
 */
function foreignHello(S, u) {
  const langs = u && u.entities && u.entities.foreignLangs;
  if (!langs || !langs.length) return null;
  const v = S.v;
  const chinese = l => l === 'mandarin' || l === 'cantonese' || l === 'chinese';
  const own = [v.lang.known, v.lang.cs && v.lang.cs.lang].filter(Boolean);
  const speaks = langs.some(l => own.includes(l) || (chinese(l) && own.some(chinese)));
  const L = LANGUAGES[langs[0]];
  const name = langs.some(chinese) ? 'Chinese' : L ? String(L.name).replace(/\s*\(.*\)$/, '') : capFirst(langs[0]);
  return { speaks, name, nameEs: LANG_ES[name] || name.toLowerCase() };
}

P.greeting = (S, u, opts = {}) => {
  const v = S.v, st = S.st, parts = [];
  const fh = !opts.initiated ? foreignHello(S, u) : null;
  if (fh) {
    st.greeted = true; st.playerGreeted = true;
    if (fh.speaks) { st.cs = 'greeting'; parts.push(say(S, st.npcOpened ? 'greet.ack' : 'greet.first')); }
    else { st.cs = false; parts.push(say(S, 'greet.foreign', { langName: fh.name, langNameEs: fh.nameEs })); }
    return { parts, topics: [], ask: 'howAreYou', askBoost: 0.2, forceCs: fh.speaks };
  }
  const hol = !opts.initiated ? holidayGreeting(S, u) : null;
  if (hol) {
    st.greeted = true; st.playerGreeted = true;
    return { parts: [hol.p], topics: [], ask: 'holiday', askBoost: 0.3, askSlots: { holiday: hol.slots.holiday, holidayEs: hol.slots.holidayEs } };
  }
  // "¡Buenos días!" from the player is answered in kind, with the hour's own greeting
  const saludo = !opts.initiated && u && u.flags && u.flags.spanish && v.lang.mode === 'es' && /\bbuen[oa]s\b/i.test(u.text || '') ? saludoParts(S) : null;
  if (st.greeted && !opts.initiated && !st.playerGreeted && st.npcOpened) {
    st.playerGreeted = true;
    parts.push(saludo || say(S, 'greet.ack'));
    return { parts, topics: [], ask: 'visiting', askBoost: 0.2 };
  }
  if (st.greeted && !opts.initiated) {
    parts.push(say(S, 'greet.repeat'));
    if (S.rng.chance(0.6)) parts.push(pivot(S));
    return { parts, topics: [], noAsk: false };
  }
  st.greeted = true;
  if (opts.initiated) st.npcOpened = true; else st.playerGreeted = true;
  const known = !!(st.prev || v.relq.known);
  if (v.relq.guarded) parts.push(say(S, 'greet.cool'));
  else if (saludo) parts.push(saludo);
  else if (known) parts.push(say(S, 'greet.again') || say(S, 'greet.first'));
  else if (v.lang.mode === 'en' && S.rng.chance(0.5)) parts.push(lex(S, 'greetings') || say(S, 'greet.first'));
  else parts.push(say(S, 'greet.first'));
  if (!v.relq.guarded) {
    if (st.prev && !st.mentionedPrev && S.rng.chance(0.9)) {
      const p = say(S, 'greet.prev', { prevTopic: st.prev.topic, prevTopicEs: st.prev.topicEs }, st.prev.facts);
      if (p) { parts.push(p); st.mentionedPrev = true; }
    } else if (known && v.relq.facts.length && S.rng.chance(0.5)) {
      const from = v.relq.facts.find(f => f.key === 'lives' || f.key === 'from');
      const job = v.relq.facts.find(f => f.key === 'job' && f.value !== 'retired');
      const slots = { playerPlace: from ? from.value : null, aPlayerJob: job ? withArticle(job.value) : null };
      parts.push(say(S, 'greet.prevFact', slots));
    }
    if (!known && !st.gaveName && (v.big5.E >= 0.55 || (opts.initiated && S.rng.chance(0.3)) || v.stage === 'kid')) {
      const p = say(S, 'greet.intro');
      if (p) { parts.push(p); st.gaveName = true; }
    }
    if (opts.initiated && S.rng.chance(0.45)) parts.push(activityLine(S));
    else if (opts.initiated && S.rng.chance(0.4)) parts.push(freshStart(pivot(S, { only: ['weather'] })));
  }
  return { parts, topics: [], ask: known ? 'howAreYou' : (opts.initiated ? 'visiting' : 'howAreYou'), askBoost: 0.15 };
};

P['how-are-you'] = (S, u) => {
  const v = S.v, m = v.mood, parts = [];
  const temp = v.tempF;
  const justOff = !!(v.activity && v.activity.kind === 'commute' && v.activity.leg === 'back' && !(v.npc.school && v.age < 18));
  const nice = v.sky === 'clear' && isNum(temp) && temp >= 60 && temp <= 84;
  let key, reasons = [];
  if (m.tired) {
    key = 'hay.tired';
    const a = v.activity;
    if (a && a.kind === 'commute' && a.leg === 'back') reasons.push('why.shiftDone');
    if (v.flags.nights) reasons.push('why.nights');
    if (v.flags.early) reasons.push('why.early');
    if (v.flags.littleKids) reasons.push('why.littleKids');
    if (v.flags.commuter && num(v.commute.minutes) >= 45) reasons.push('why.commute');
    reasons.push('why.lowEnergy');
  } else if (m.tense && v.alerts.length) { key = 'hay.tense'; reasons.push('why.alert'); }
  else if (isNum(temp) && temp >= 92 && (m.valence < 0.2 || v.big5.N > 0.55)) { key = 'hay.hot'; reasons.push('why.heat'); }
  else if (m.valence >= 0.15) {
    key = 'hay.good';
    if (justOff) reasons.push('why.shiftDone');
    if (nice) reasons.push('why.niceWeather');
    if (v.flags.retired) reasons.push('why.retired');
    if (v.weekend && v.age >= 18) reasons.push('why.weekend');
    if (v.speaker.works && !worksToday(v)) reasons.push('why.dayOff');
  } else if (m.valence <= -0.12) {
    key = 'hay.down';
    if (m.needs && num(m.needs.money, 1) < 0.3) reasons.push('why.money');
    if (m.needs && num(m.needs.social, 1) < 0.25) reasons.push('why.lonely');
    if (v.alerts.length) reasons.push('why.alert');
  } else {
    key = 'hay.ok';
    // "long day?" to someone on the way home from work: the shift is the answer
    if (justOff) reasons.push('why.shiftDone');
    if (v.stage === 'kid' && !v.weekend) reasons.push('why.school');
    if (nice) reasons.push('why.niceWeather');
  }
  // asked in another language: a hello back in theirs when it is the speaker's own, else a word that they don't speak it
  const fh = foreignHello(S, u);
  if (fh && !fh.speaks) parts.push(say(S, 'greet.foreign', { langName: fh.name, langNameEs: fh.nameEs }));
  parts.push(say(S, key, {}, key === 'hay.hot' ? ['weather.now'] : []));
  // "you look tired, long day?" asks for the why: it is always given
  const askedWhy = !!(u && /\b(long|rough|busy|hard|tough) (day|shift|week|night)\b|\b(look|seem|sound)s? (tired|beat|exhausted|worn out|stressed)\b/.test(u.norm));
  if (reasons.length && (askedWhy || S.rng.chance(0.75))) {
    const r = reasons[0];
    const slots = { commuteMin: v.commute.minutes, alert: v.alerts[0] && v.alerts[0].event, sky: G.skyWords(v.wx.now && v.wx.now.short) };
    const facts = r === 'why.heat' || r === 'why.niceWeather' ? ['weather.now'] : r === 'why.alert' ? [`alert:${slots.alert}`] : r === 'why.commute' ? [REC.commute] : [];
    parts.push(say(S, r, slots, facts) || (reasons[1] ? say(S, reasons[1], slots) : null));
  }
  S.st.cs = fh ? (fh.speaks ? 'greeting' : false) : m.tired ? 'tired' : (v.speaker.works && worksToday(v) && v.hour >= 9 && v.hour < 17 && key !== 'hay.good' ? 'busy' : false);
  return { parts, topics: ['self'], ask: 'howAreYou', askBoost: 0.35, forceCs: !!(fh && fh.speaks) };
};

/**
 * Whether today is one of their working days: commute.workDays (working from home or the farm included), not the
 * commute days, which are none for someone who works where they live.
 */
function worksToday(v) {
  // (someone the schedule has at work right now is working today, whatever the week's pattern says)
  if (v.activity && v.activity.kind === 'work') return true;
  const days = num(v.commute.workDays, num(v.commute.days, 0));
  return !!(days & (1 << v.P.dow));
}

/**
 * Their name, as they would give it: the one they go by, and when that is a nickname, the one on paper with it
 * ("Jung-ho, but most people call me James"; "Dot. Dorothy Smith-Hunter, if you want the whole thing").
 */
function giveName(S, slots) {
  const v = S.v;
  const nick = v.nick && v.given && v.nick !== v.given;
  return (nick ? say(S, 'name.giveNick', slots) : null) || say(S, 'name.give', slots);
}

P.name = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  const given = u.appraisal.facts.find(f => f.key === 'name');
  if (given && screenValue(given.value, 'name')) {
    // a crude or hateful "name" is neither learned nor said back
    parts.push(say(S, 'name.rude'));
    S.st.cs = false;
    return { parts, topics: [], noAsk: true, emotion: 'annoyed' };
  }
  if (given) {
    const first = String(given.value).split(/\s+/)[0];
    parts.push(say(S, 'name.meet', { player: first }) || say(S, 'react.name', { player: first }));
    // ("I'm Marcus. What's your name?" is answered, even when the greeting already gave it)
    const asked = /\bwhat'?s your name\b|\bwhat is your name\b|\byour name\?|\bwho are you\b|\band you\?/.test(u.norm);
    if (!st.gaveName || asked) { parts.push(giveName(S, { _avoid: /\b(?:meet|pleasure|pleased)\b/i }) || giveName(S)); st.gaveName = true; }
    return { parts, topics: ['self'], noAsk: true, learnedName: first };
  }
  if (/remember my name|what'?s my name|who am i/.test(u.norm)) {
    parts.push(v.relq.name ? say(S, 'name.yours') : say(S, 'name.forgot'));
    return { parts, topics: ['self'], ask: v.relq.name ? null : 'name', askBoost: 0.6 };
  }
  if (st.gaveName) parts.push(say(S, 'name.again'));
  else if (v.relq.guarded) parts.push(say(S, 'name.guarded'));
  else parts.push(giveName(S));
  st.gaveName = true;
  return { parts, topics: ['self'], ask: v.relq.name ? null : 'name', askBoost: 0.4 };
};

// The player's job as a field of work in Spanish ("trabaja en enfermería"): a field has no gender, and the player's
// is unknown. A job not on the list is said in the player's own word, quoted.
const JOB_FIELD_ES = [
  [/\bnurs(?:e|es|ing)\b/, 'en enfermería'], [/\b(?:teacher|teaching|professor|tutor)\b/, 'en la enseñanza'], [/\b(?:doctor|physician|surgeon|dentist|pharmacist|paramedic|emt)\b/, 'en la salud'],
  [/\b(?:software|developer|programmer|coder|it|tech|computer)\b/, 'en tecnología'], [/\bengineer\b/, 'en ingeniería'], [/\b(?:accountant|bookkeeper|banker|teller)\b/, 'en finanzas'],
  [/\b(?:construction|carpenter|roofer|builder|laborer|electrician|plumber|welder|painter|contractor)\b/, 'en la construcción'], [/\b(?:cook|chef|baker|line cook)\b/, 'en la cocina'],
  [/\b(?:driver|trucker|truck driver|courier|delivery)\b/, 'en el transporte'], [/\b(?:farmer|farmworker|farm worker|rancher|picker)\b/, 'en el campo'],
  [/\b(?:lawyer|attorney|paralegal|judge)\b/, 'en leyes'], [/\b(?:sales|salesperson|salesman|saleswoman|cashier|clerk|retail)\b/, 'en ventas'],
  [/\b(?:cleaner|janitor|housekeeper)\b/, 'en la limpieza'], [/\bmechanic\b/, 'en un taller mecánico'], [/\b(?:server|waiter|waitress|bartender|barista)\b/, 'en un restaurante'],
  [/\b(?:police|officer|cop|deputy|firefighter|guard)\b/, 'en seguridad pública'], [/\b(?:caregiver|nanny|aide)\b/, 'cuidando a otros'],
];

/**
 * What the NPC knows of the player as sentence slots: aPlayerJob ("a nurse"), playerPlace, playerFacts ("a nurse from
 * Fresno"), and the Spanish ("trabaja en enfermería y es de Fresno", usted and tú).
 */
function playerFactSlots(job, from, lives) {
  const retired = !!job && /^retired$/i.test(job);
  const aJob = job ? (retired ? 'retired' : withArticle(job.replace(/^(?:an?|the)\s+/i, ''))) : null;
  const field = job ? (JOB_FIELD_ES.find(([re]) => re.test(job.toLowerCase())) || [])[1] : null;
  const jobEs = job ? (retired ? null : field || `como «${job.replace(/^(?:an?|the)\s+/i, '')}»`) : null;
  const place = from || lives || null;
  const where = from ? `from ${from}` : lives ? `living in ${lives}` : null;
  const facts = aJob && where ? `${aJob}${retired ? ',' : ''} ${where}` : aJob || where;
  const es = [retired ? 'está jubilado' : jobEs ? `trabaja ${jobEs}` : null, from ? `es de ${from}` : lives ? `vive en ${lives}` : null].filter(Boolean);
  const tu = [retired ? 'estás jubilado' : jobEs ? `trabajas ${jobEs}` : null, from ? `eres de ${from}` : lives ? `vives en ${lives}` : null].filter(Boolean);
  return {
    aPlayerJob: aJob, playerJob: job, playerJobEs: jobEs, playerPlace: place, playerFacts: facts,
    playerFactsEs: es.length ? es.join(' y ') : null, playerFactsTu: tu.length ? tu.join(' y ') : null, retired,
  };
}

/**
 * "Do you remember me?", "What's my name?", "What do I do?", "Where am I from?", "What did I tell you?": answered from
 * what the mind keeps of the player (relationship facts, never a crude or joke value) and the last conversation. A
 * stranger says honestly that they don't think they have met; a fact never told is said to be unknown.
 */
P['about-me'] = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  const sub = (u && u.entities && u.entities.player) || 'remember';
  let R = null;
  try { R = S.mind && typeof S.mind.relationship === 'function' ? S.mind.relationship('player') : null; } catch { R = null; }
  const facts = (R && Array.isArray(R.facts) ? R.facts : []).filter(f => f && typeof f.key === 'string' && str(f.value) && !screenValue(f.value, f.key));
  const fact = k => { const f = facts.find(x => x.key === k); return f ? String(f.value).trim() : null; };
  const name = fact('name') ? fact('name').split(/\s+/)[0] : null;
  const prev = st.prev && st.prev.topic ? st.prev : null;
  const met = !!prev || num(R && R.met, 0) >= 2 || facts.length > 0;
  const fs = playerFactSlots(fact('job'), fact('from'), fact('lives'));
  const slots = Object.assign({ player: name, prevTopic: prev ? prev.topic : null, prevTopicEs: prev ? prev.topicEs : null }, fs);
  st.cs = false;
  const plan = (ask = null) => ({ parts, topics: ['self'], ask, askBoost: ask ? 0.5 : 0, keep: 3, noOpener: true });
  if (sub === 'name') { parts.push(name ? say(S, 'name.yours', slots) : say(S, 'name.forgot')); return plan(name ? null : 'name'); }
  if (!met) { parts.push(say(S, 'me.notMet')); return plan(sub === 'job' ? 'job' : sub === 'from' ? 'from' : sub === 'lives' ? 'lives' : 'name'); }
  if (sub === 'job') { parts.push(fs.aPlayerJob ? say(S, 'me.job', Object.assign({ _avoid: fs.retired ? /work as|trabaja/i : null }, slots)) : say(S, 'me.jobUnknown')); return plan(fs.aPlayerJob ? null : 'job'); }
  if (sub === 'from' || sub === 'lives') {
    const have = sub === 'from' ? fact('from') : fact('lives');
    parts.push(have ? say(S, sub === 'from' ? 'me.from' : 'me.lives', Object.assign({}, slots, { playerPlace: have })) : say(S, sub === 'from' ? 'me.fromUnknown' : 'me.livesUnknown'));
    return plan(have ? null : sub);
  }
  // "do you remember me?", "what did I tell you?": who they are, what they said, what the last talk was about
  if (sub === 'remember') parts.push(name ? say(S, 'me.remember', slots) : say(S, 'me.rememberNoName'));
  else if (name) parts.push(say(S, 'me.name', slots));
  if (fs.playerFacts) parts.push(say(S, 'me.facts', slots));
  if (prev) { const p = say(S, 'me.lastTime', slots, prev.facts || []); if (p) { parts.push(p); st.mentionedPrev = true; } }
  if (sub === 'told' && !name && !fs.playerFacts) parts.push(say(S, 'me.toldNothing'));
  return plan(name ? null : 'name');
};

/** "a baby", "little", "seven": how old they were when the family came, as said after "when I was". */
function arrivalAgeWords(age) {
  if (!isNum(age) || age < 0) return null;
  if (age <= 1) return { en: 'a baby', es: 'bebé' };
  if (age <= 5) return { en: 'little', es: null };
  return { en: numWord(age), es: null };
}

// Places English names with "the" ("the Philippines", "the State of Mexico").
const THE_PLACE = /^(?:(?:State|Republic|Province|Kingdom|Federation|Commonwealth) of .+|Philippines|Netherlands|Bahamas|Dominican Republic|Czech Republic|Gambia|United Kingdom|United States|United Arab Emirates|Central African Republic|Maldives|Seychelles|Comoros|.+ Islands)$/;

/**
 * The country or state a birthplace names last, as said after "in" or "from": "Toluca, State of Mexico" → "the State
 * of Mexico", "Majuro, Marshall Islands" → "the Marshall Islands".
 * @param {string} birthplace
 * @returns {string|null}
 */
export function homelandOf(birthplace) {
  const last = str(birthplace) ? String(birthplace).split(',').map(x => x.trim()).filter(Boolean).pop() : null;
  if (!last) return null;
  return THE_PLACE.test(last) ? `the ${last}` : last;
}

/** "Most of my family is still back in Michoacán": the family abroad, marked so a later question does not repeat it. */
function abroadLine(S, homeland) {
  const p = say(S, 'fam.abroad', { homeland }, [REC.origin]);
  if (p) p.mark = ['home:abroad'];
  return p;
}

/**
 * "Do you miss home?", "do you go back?", "is your family still there?": the place they come from, from the record.
 * Born abroad: the family there (from the persona's worry about them, when they have it), missing it, visiting, going
 * back. Born elsewhere in the country: that place. Born here: this is home. Null when the question is better heard as
 * one about the household (someone from here asked whether their family is "still there").
 */
function homelandParts(S, kind) {
  const v = S.v, npc = v.npc, res = v.res || {}, facts = [REC.origin];
  const birthplace = str(npc.birthplace);
  const homeland = homelandOf(birthplace);
  const foreign = npc.nativity === 'foreign' && !!homeland && !/California/.test(homeland);
  if (foreign) {
    const worried = (v.p.concerns || []).some(c => c && c.topic === 'family abroad');
    // the family there is said once; asked again, the line comes from the other side of the question
    const abroad = worried && !S.st.used.has('home:abroad') ? abroadLine(S, homeland) : null;
    // (once "most of my family is still back in Guanajuato" was said, a "some relatives, yes" would contradict it)
    if (kind === 'family') return [abroad || say(S, S.st.used.has('home:abroad') ? 'home.familyThereAgain' : 'home.familyThere', { homeland }, facts) || say(S, 'home.familyThere', { homeland }, facts)];
    if (kind === 'miss') return [say(S, 'home.missSome', { homeland }, facts), abroad];
    if (kind === 'visit') return [say(S, 'home.visitBack', { homeland }, facts)];
    return [say(S, 'home.stayHere', {}, facts)];
  }
  const local = res.bornHere || (res.grewUpHere && v.flags.bornInCounty) || !birthplace || (/California$/.test(birthplace) && res.grewUpHere);
  if (local) return kind === 'family' ? null : [say(S, 'home.isHere', {}, facts)];
  const from = birthplace.replace(/, California$/, '');
  if (kind === 'family') return null;
  if (kind === 'return') return [say(S, 'home.stayHere', {}, facts)];
  if (kind === 'visit') return [say(S, 'home.visitBack', { homeland: from }, facts)];
  return [say(S, 'home.missUS', { birthplace: from }, facts)];
}

/**
 * Where they're from, in their own words: born here, born elsewhere and raised here, or come from somewhere else.
 * opts.country: the question was about coming to this country ("how long have you been in the US?"), so their years
 * in this town are left for another question.
 */
function originParts(S, opts = {}) {
  const v = S.v, res = v.res || {}, npc = v.npc, out = [];
  const facts = [REC.origin, REC.residence];
  const birthplace = str(npc.birthplace);
  const foreign = npc.nativity === 'foreign';
  if (res.bornHere) out.push(say(S, 'about.bornHere', {}, facts));
  else if (res.grewUpHere && v.flags.bornInCounty) out.push(say(S, 'about.grewUpCounty', {}, facts));
  else if (res.grewUpHere && birthplace) {
    // born somewhere else, raised here: never "born and raised"
    out.push(say(S, 'about.bornElsewhere', { birthplace: birthplace.replace(/, California$/, '') }, facts));
    const age = foreign && isNum(npc.arrivalYear) && isNum(npc.birthYear) ? npc.arrivalYear - npc.birthYear : null;
    const w = arrivalAgeWords(age);
    if (w) out.push(say(S, 'about.arrivedKid', { arrivalYear: npc.arrivalYear, arrivalAgeWords: w.en, arrivalAgeEs: w.es, arrivalAgeNum: age >= 2 ? age : null }, facts));
  } else if (res.grewUpHere) out.push(say(S, 'about.grewUpOnly', {}, facts));
  else if (foreign && birthplace) {
    out.push(say(S, 'about.fromAbroad', { birthplace }, facts));
    if (isNum(npc.arrivalYear)) out.push(say(S, 'about.arrived', { arrivalYear: npc.arrivalYear }, facts));
  } else if (birthplace) {
    out.push(say(S, 'about.fromUS', { birthplace: birthplace.replace(/, California$/, '') }, facts));
    if (isNum(res.countySince)) out.push(say(S, 'about.cameHere', {}, facts));
  }
  // how long here, unless the arrival just said it ("we came in 1998", then "I've lived here since 1998")
  const toldYear = isNum(res.zipSince) && out.some(p => p && /about\.(arrived|arrivedKid)/.test(p.key || '') && p.text.includes(String(res.zipSince)));
  // (raised in San Francisco County, or there since 2014, they have not "lived in San Francisco since 2015": the
  // neighborhood has had them that long)
  const countyTown = String(v.z.countyName || '').toLowerCase() === String(v.lex.values.place || v.z.city || '').toLowerCase()
    && out.some(p => p && /^about\.(grewUpCounty|cameHere)$/.test(p.key || ''));
  if (!res.bornHere && isNum(res.zipSince) && !toldYear && !opts.country && S.rng.chance(0.5)) out.push(say(S, countyTown ? 'about.yearsHood' : v.flags.newcomer ? 'about.newHere' : 'about.years', {}, [REC.residence]));
  if (out.some(Boolean)) S.st.used.add('origin');
  return out.filter(Boolean);
}

/** True when an interest is the speaker's own practice (persona.practice.interest: "Sunday services", …). */
function isPractice(v, name) {
  const pr = v.p && v.p.practice;
  return !!pr && (name === pr.interest || name === pr.label || /^church on Sundays$/i.test(String(name)));
}

/** One or two interests as sentences, not repeating within the conversation. */
function interestParts(S, n = 1) {
  const v = S.v, out = [];
  const list = v.interests.filter(i => !S.st.usedInterests.has(i));
  for (const name of list) {
    if (out.length >= n) break;
    const detail = (v.p.interestDetails || []).find(d => d.name === name);
    if (detail && detail.tradition) {
      if (S.rng.chance(0.5)) { out.push(say(S, 'about.tradition', { tradition: name }, ['persona.interests'])); S.st.usedInterests.add(name); }
      continue;
    }
    // their own practice, by its place ("I go to services every Sunday"), never as a church
    if (isPractice(v, name)) { out.push(say(S, 'about.worship', {}, ['persona.practice'])); S.st.usedInterests.add(name); continue; }
    const talk = interestTalk(name);
    if (!talk) continue;
    const line = S.rng.pick(talk.en);
    if (/really into/.test(talk.en[0]) && S.rng.chance(0.5)) continue;
    const es = S.rng.pick(talk.es);
    const p = say(S, 'about.interestsIntro', { interestLine: line, doingThing: talk.doing, interestEs: es[0], interestEn: es[1] }, ['persona.interests']);
    if (p) { out.push(p); S.st.usedInterests.add(name); }
  }
  return out;
}

/** The languages they speak, from the record: English only, English and a home language, or mostly the home language. */
function languageParts(S, asked) {
  const v = S.v, L = v.npc.languages || {}, facts = ['npc.languages'];
  const home = str(L.home) || 'english';
  const langName = v.lang.known && LANGUAGES[v.lang.known] ? String(LANGUAGES[v.lang.known].name).replace(/\s*\(.*\)$/, '') : home !== 'english' ? capFirst(home) : null;
  // the languages on their record, resolved the way the voice resolves its own ("chinese" may be Cantonese)
  const theirs = new Set(['english', ...[home, ...(Array.isArray(L.list) ? L.list : [])].map(x => resolveLanguage(x, v.npc.seed >>> 0) || String(x).toLowerCase())]);
  if (v.lang.spanish) theirs.add('spanish');
  const want = asked === 'chinese' ? ['cantonese', 'mandarin', 'chinese'] : [asked];
  const speaksAsked = asked !== 'any' && want.some(x => theirs.has(x));
  const askedName = asked && asked !== 'any' ? capFirst(asked) : null;
  if (home === 'english' || !langName) {
    if (asked === 'any' || asked === 'english') return [say(S, 'lang.englishOnly', {}, facts)];
    if (speaksAsked) return [say(S, 'lang.someOther', { askedName }, facts)];
    return [say(S, 'lang.notThat', { askedName }, facts)];
  }
  if (L.english === 'limited') return [say(S, 'lang.limited', { langName, langEs: LANG_ES[langName] || langName.toLowerCase() }, facts)];
  const langEs = LANG_ES[langName] || langName.toLowerCase();
  if (asked === 'english') return [say(S, 'lang.yesEnglish', { langName, langEs }, facts)];
  if (asked === 'any' || speaksAsked) return [say(S, 'lang.both', { langName, langEs }, facts)];
  return [say(S, 'lang.notThatBoth', { askedName, langName }, facts)];
}

// Spanish for the Latin American backgrounds, as "mi familia es ___" (feminine, after familia).
const HERITAGE_ES = {
  Mexican: 'mexicana', Salvadoran: 'salvadoreña', Guatemalan: 'guatemalteca', Honduran: 'hondureña', Nicaraguan: 'nicaragüense', Cuban: 'cubana',
  'Puerto Rican': 'puertorriqueña', Dominican: 'dominicana', Colombian: 'colombiana', Peruvian: 'peruana', Ecuadorian: 'ecuatoriana', Venezuelan: 'venezolana',
  Argentinian: 'argentina', Argentine: 'argentina', Chilean: 'chilena', Bolivian: 'boliviana', 'Costa Rican': 'costarricense', Panamanian: 'panameña', Spanish: 'española',
  Uruguayan: 'uruguaya', Paraguayan: 'paraguaya', Belizean: 'beliceña', Brazilian: 'brasileña', Filipino: 'filipina', Vietnamese: 'vietnamita',
  Chinese: 'china', Korean: 'coreana', Japanese: 'japonesa', Italian: 'italiana', Irish: 'irlandesa', German: 'alemana', Portuguese: 'portuguesa',
  French: 'francesa', Armenian: 'armenia', English: 'inglesa', Polish: 'polaca', Russian: 'rusa', Greek: 'griega', Dutch: 'holandesa',
  Jamaican: 'jamaiquina', Haitian: 'haitiana', Lebanese: 'libanesa', Iranian: 'iraní', Indian: 'india',
};

// The country a heritage's immigrants were born in, as a player names it ("have you been to Mexico?").
const COUNTRY_OF = {
  mexican: 'mexico', salvadoran: 'el salvador', guatemalan: 'guatemala', honduran: 'honduras', nicaraguan: 'nicaragua', filipino: 'philippines',
  vietnamese: 'vietnam', chinese: 'china', korean: 'korea', indian: 'india', iranian: 'iran', armenian: 'armenia', japanese: 'japan', cuban: 'cuba',
};

// Labels that are a whole name for a background ("African American"), not "<country> American".
const WHOLE_LABELS = /^(African American|Native American|Asian American|Pacific Islander|Native Hawaiian|Alaska Native|Latino|Latina|Hispanic)$/i;

// Broad groups as the record's race field holds them, for "are you Asian?"-style questions.
const RACE_WORDS = { asian: 'asian', black: 'black', 'african american': 'black', white: 'white', latino: 'hispanic', latina: 'hispanic', hispanic: 'hispanic', native: 'aian', 'native american': 'aian' };

/** Whether "are you X?" is true of them: true, false, or null when the record cannot say plainly (mixed families). */
function heritageAnswer(npc, word) {
  const w = String(word || '').toLowerCase();
  if (!w) return null;
  if (w === 'american') return npc.nativity === 'native' ? true : null;
  if (w === 'mixed' || w === 'biracial') return npc.race === 'multi' || /multiracial/i.test(String(npc.heritageLabel || ''));
  if (npc.race === 'multi' || /multiracial/i.test(String(npc.heritageLabel || ''))) return null;
  if (RACE_WORDS[w]) return npc.race === RACE_WORDS[w];
  const label = String(npc.heritageLabel || '').toLowerCase(), her = String(npc.heritage || '').toLowerCase();
  return label.includes(w) || her === w;
}

/** Their family's background, plainly, from the record (a modest answer to a direct question, never more). */
function heritageParts(S, u) {
  const v = S.v, npc = v.npc, facts = ['npc.heritage'];
  if (v.relq.guarded) return [say(S, 'about.heritageGuarded')];
  const asked = u ? /\b(?:are you|you'?re|is your family|are your parents) (?:a |an )?(african american|native american|[a-z]+)\b/.exec(u.norm) : null;
  const yes = asked ? heritageAnswer(npc, asked[1]) : null;
  return [yes === null ? null : say(S, yes ? 'about.heritageYes' : 'about.heritageNo', {}, facts), ...heritageLines(S)].filter(Boolean);
}

/** The background lines themselves: born abroad, American a long way back, mixed, or the family's heritage. */
function heritageLines(S) {
  const v = S.v, npc = v.npc, facts = ['npc.heritage'];
  const label = str(npc.heritageLabel);
  const birthplace = str(npc.birthplace);
  const country = npc.nativity === 'foreign' && birthplace ? homelandOf(birthplace) : null;
  if (country && !/California/.test(country)) {
    return [say(S, 'about.heritageFrom', { country, arrivalYear: isNum(npc.arrivalYear) ? npc.arrivalYear : null }, [...facts, REC.origin])];
  }
  if (!label || /^(American|Other)$/i.test(label)) return [say(S, 'about.heritageAmerican', {}, facts)];
  if (/^(Multiracial|Mixed)$/i.test(label)) return [say(S, 'about.heritageMixed', {}, facts)];
  const word = WHOLE_LABELS.test(label) ? null : label.replace(/\s+American$/, '');
  return [(word ? say(S, 'about.heritage', { heritageWord: word, heritageLabel: label, heritageWordEs: HERITAGE_ES[word] || null }, facts) : null)
    || say(S, 'about.heritageWhole', { heritageLabel: label, heritageLabelEs: heritageLabelEs(label, v.sex) }, facts)];
}

// Schooling by the record's education level (ACS B15003 groups), as said.
const EDU_KEYS = { nohs: 'edu.nohs', hs: 'edu.hs', somecollege: 'edu.somecollege', associate: 'edu.associate', bachelor: 'edu.bachelor', master: 'edu.master', professional: 'edu.professional', doctorate: 'edu.doctorate' };

/** How far they went in school, from the record; students and children answer with the school they are in. */
function educationParts(S) {
  const v = S.v, npc = v.npc;
  const key = EDU_KEYS[npc.education];
  if (key) return [say(S, key, {}, ['npc.education'])];
  if (npc.school && npc.school !== 'college' && npc.school !== 'grad') {
    const w = SCHOOL_WORDS[npc.school] || SCHOOL_WORDS.elementary;
    return [say(S, 'job.k12', { school: w[0], schoolEs: w[1] }, ['npc.school'])];
  }
  if (npc.school === 'college' || npc.school === 'grad') return [say(S, npc.school === 'grad' ? 'job.grad' : 'job.college', {}, ['npc.school'])];
  return [say(S, 'unk.aboutMe')];
}

P['about-them'] = (S, u) => {
  const v = S.v, parts = [];
  const q = u.norm;
  let ask = 'from';
  if (u.entities.favorite) { const fav = favoriteParts(S, u); if (fav) return { parts: fav, topics: ['self'], ask: null, noOpener: true }; }
  if (u.entities.langAsked) return { parts: languageParts(S, u.entities.langAsked), topics: ['self'], ask: 'from', askBoost: 0.1, noOpener: true };
  if (u.entities.heritage) return { parts: heritageParts(S, u), topics: ['self'], ask: null, noAsk: !!v.relq.guarded, noOpener: true };
  if (u.entities.homeland) {
    const home = homelandParts(S, u.entities.homeland);
    if (home) return { parts: home, topics: ['self'], ask: null };
    return P.family(S, u);
  }
  // "did you see the Warriors game?" asks about a game, not about following the team
  if (GAME_Q.test(q)) return P.smalltalk(S, Object.assign({}, u, { norm: `${u.norm} game` }));
  if (u.entities.ownInterest && !(u.entities.interest && /\bdo you\b|\bare you\b/.test(q))) {
    // their own interest, named: "how's the harvest going?"
    const name = u.entities.ownInterest;
    if (isPractice(v, name)) return { parts: [say(S, 'about.worship', {}, ['persona.practice'])], topics: ['self'], ask: 'weekend' };
    const talk = interestTalk(name);
    if (talk) {
      const es = S.rng.pick(talk.es);
      parts.push(say(S, 'about.interestYes', { interestLine: S.rng.pick(talk.en), doingThing: talk.doing, interestEs: es[0], interestEn: es[1] }, ['persona.interests']));
      S.st.usedInterests.add(name);
      if (/harvest|farm/.test(name) && S.rng.chance(0.6)) parts.push(say(S, 'job.feel.farming'));
      return { parts, topics: ['self'], ask: 'weekend' };
    }
  }
  // "are you a morning person?": the schedule says it when it can (an early or a night shift), else their nature
  if (/\b(morning person|night owl|early riser|early bird|night person)\b/.test(q)) {
    const key = v.flags.nights ? 'about.nightOwl' : v.flags.early ? 'about.morningYes' : v.big5.C >= 0.6 ? 'about.morningNature' : 'about.morningNot';
    return { parts: [say(S, key, {}, v.flags.nights || v.flags.early ? [REC.commute] : [])], topics: ['self'], ask: null };
  }
  // "have you been to Mexico?": someone born there says so; for anyone else it is a light non-answer
  const been = /\bhave you (?:ever )?been (?:back )?to ([a-z .']+?)\s*[?.!]*$/.exec(q);
  if (been) {
    const country = COUNTRY_OF[String(v.npc.heritage || '')];
    if (v.npc.nativity === 'foreign' && country && been[1].replace(/^the /, '').startsWith(country)) {
      return { parts: [say(S, 'home.bornThere', { birthplace: str(v.npc.birthplace) || capFirst(country) }, [REC.origin])], topics: ['self'], ask: null };
    }
    return { parts: [say(S, 'unk.aboutMeYesNo', { aux: 'have' })], topics: ['self'], ask: null };
  }
  if (/how old|your age/.test(q)) {
    parts.push(say(S, 'about.age', {}, ['npc.age']));
    ask = 'job';
  } else if (/where did you go to (school|college|high school)|did you go to college|what did you study|did you finish (school|high school|college)|how far did you go in school|your education/.test(q)) {
    parts.push(...educationParts(S));
    ask = 'job';
  } else if (/where are you from|grow up|grew up|born|originally|come from|from here|from around here|from california|always lived|lived here (your whole|all your) life|immigra|when did you (come|get here|arrive|move)|brought you|end(?:ed)? up|wind up|wound up|come here|came here|moved here|in the us\b|in the u\.s\.|in this country|in america|the states\b|are you (?:a )?local|raised (?:here|in)/.test(q)) {
    // a yes-or-no about being from here, of someone who isn't: no, first
    const local = v.res && (v.res.bornHere || (v.res.grewUpHere && v.flags.bornInCounty));
    if (!local && /\bdid you grow up (?:here|around here|out here|nearby)\b|\bare you from (?:here|around here|this area|the area)\b|\bwere you born here\b|\bare you (?:a )?local\b/.test(q)) parts.push(say(S, 'about.notLocal'));
    const country = /\b(?:the us|the u\.s\.|this country|america|the states|the united states|estados unidos)\b/.test(q);
    // "what brought you here?" once they've said where they're from: not the same answer again, and no reason the
    // record doesn't hold (work, family): the year they came, and that they stayed
    const res = v.res || {};
    const year = country ? v.npc.arrivalYear : isNum(res.countySince) ? res.countySince : isNum(res.zipSince) ? res.zipSince : v.npc.arrivalYear;
    const why = /brought you|end(?:ed)? up|wind up|wound up/.test(q);
    // ("when did you come to the US?" right after "Quezon City, and I came in 2013": the year, not the whole story again)
    const when = /\bwhen did you (?:come|get here|arrive|move)\b|\bwhat year did you\b|\bhow long have you been in (?:the us|the u\.s\.|this country|america|the states|the united states)\b/.test(q);
    if ((why || when) && S.st.used.has('origin') && !(country && v.npc.nativity !== 'foreign') && (local || isNum(year))) {
      parts.push(local && !country ? say(S, 'about.whyHereLocal', {}, [REC.origin])
        : say(S, when ? 'about.cameWhen' : 'about.whyHere', { cameYear: year }, [REC.origin, REC.residence]));
    } else parts.push(...originParts(S, { country }));
    ask = 'from';
  } else if (u.entities.interest && /\bdo you\b|\bare you\b/.test(q)) {
    const key = u.entities.interest;
    const has = v.interests.find(i => (key !== 'church' && i.toLowerCase().includes(key)) || (key === 'skiing' && /ski/.test(i)) || (key === 'gaming' && /game|gaming/.test(i)) || (key === 'cars' && /car/.test(i)) || (key === 'church' && isPractice(v, i)) || (key === 'biking' && /bik/.test(i)) || (key === 'music' && /music|concert/.test(i)));
    if (has && isPractice(v, has)) {
      // "do you go to church?": yes, to their own services, said as the practice names them
      parts.push(say(S, 'about.doYes'), say(S, 'about.worship', {}, ['persona.practice']));
      S.st.usedInterests.add(has);
    } else if (key === 'church' && v.p.practice) {
      parts.push(say(S, 'about.doYes'), say(S, 'about.worship', {}, ['persona.practice']));
    } else if (has) {
      parts.push(say(S, 'about.doYes'));
      const talk = interestTalk(has);
      if (talk) {
        const es = S.rng.pick(talk.es);
        parts.push(say(S, 'about.interestMore', { interestLine: S.rng.pick(talk.en), doingThing: talk.doing, interestEs: es[0], interestEn: es[1], interestEsLow: G.lowerFirst(es[0]), interestEnLow: G.lowerFirst(es[1]) }, ['persona.interests']));
        S.st.usedInterests.add(has);
      }
    } else {
      parts.push(say(S, 'about.doNo'));
      const trad = new Set((v.p.interestDetails || []).filter(d => d.tradition).map(d => d.name));
      const other = v.interests.find(i => !trad.has(i) && !isPractice(v, i) && !S.st.usedInterests.has(i));
      const talk = other ? interestTalk(other) : null;
      if (talk) { const es = S.rng.pick(talk.es); parts.push(say(S, 'about.instead', { interestShort: talk.short, interestEs: es[0], interestEn: es[1] }, ['persona.interests'])); S.st.usedInterests.add(other); }
    }
    ask = 'weekend';
  } else if (u.entities.team || /\bfan\b|\bfollow\b|\broot for\b/.test(q)) {
    return P.smalltalk(S, Object.assign({}, u, { norm: `${u.norm} sports` }));
  } else if (/hobb|for fun|free time|spare time|into|like to do|enjoy|weekend|days? off|sundays?|saturdays?/.test(q)) {
    // "what do you do on Sundays?": services first, for someone who goes (on their practice's own day)
    const worshipDay = v.worship ? v.worship.day.toLowerCase() : null;
    if (worshipDay && new RegExp(`\\b${worshipDay}s?\\b`).test(q)) {
      parts.push(say(S, 'about.worship', {}, ['persona.practice']));
      for (const i of v.interests) if (isPractice(v, i) || /service|gurdwara|worship/i.test(i)) S.st.usedInterests.add(i);
    }
    parts.push(...interestParts(S, 2));
    // the team, unless one of the interests just said was the team
    const teamSaid = v.team && [...S.st.usedInterests].some(i => String(i).toLowerCase().includes(String(v.team.name || '').toLowerCase()));
    if (v.team && !teamSaid && S.rng.chance(0.5)) parts.push(say(S, 'about.team', {}, ['persona.teams']));
    ask = 'weekend';
  } else {
    if (!S.st.gaveName) { parts.push(giveName(S)); S.st.gaveName = true; }
    const job = P.job(S, u, { brief: true });
    parts.push(...job.parts.slice(0, 1));
    parts.push(...originParts(S).slice(0, 1));
    parts.push(...interestParts(S, 1));
    ask = 'job';
  }
  if (!parts.filter(Boolean).length) parts.push(...interestParts(S, 1));
  return { parts, topics: ['self'], ask };
};

/** "9:10", "5:40 in the morning", "noon": a minute of the day to the nearest five minutes, as said after "around". */
function clockSaid(min) {
  if (!isNum(min)) return null;
  const m = ((Math.round(min / 5) * 5) % 1440 + 1440) % 1440;
  if (m === 720) return 'noon';
  if (m === 0) return 'midnight';
  const base = G.clockWords(m).replace(/ (AM|PM)$/, '');
  const h = m / 60;
  const part = h < 12 ? (h < 8 ? 'in the morning' : '') : h < 17 ? 'in the afternoon' : h < 21 ? 'in the evening' : 'at night';
  return part ? `${base} ${part}` : base;
}

/** "las 9:10", "las 5:40 de la mañana", "mediodía": clockSaid in Spanish, after "como a". */
function clockSaidEs(min) {
  if (!isNum(min)) return null;
  const m = ((Math.round(min / 5) * 5) % 1440 + 1440) % 1440;
  if (m === 720) return 'mediodía';
  if (m === 0) return 'medianoche';
  const h = Math.floor(m / 60), mm = m % 60, h12 = ((h + 11) % 12) + 1;
  const part = h < 12 ? 'de la mañana' : h < 19 ? 'de la tarde' : 'de la noche';
  return `${h12 === 1 ? 'la' : 'las'} ${h12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${part}`;
}

/** The employer as they would name it, first person: "a regional hospital", "my own orchard", or null. */
function employerSaid(occ) {
  const e = str(occ && occ.employer);
  if (!e || /^a local employer$/i.test(e)) return null;
  return e.replace(/^their own\b/i, 'my own').replace(/^their family\b/i, "my family's").replace(/^their\b/i, 'my');
}

/** Follow-ups about the work: which place, since when, what hours, the pay. Null when the question is not one of them. */
function jobSub(S, sub, u = null) {
  const v = S.v, npc = v.npc, occ = v.occ, c = v.commute || {}, facts = [REC.job];
  S.uNorm = u ? u.norm : '';
  const workCity = c.workCity && c.workCity !== v.z.city ? c.workCity : null;
  if (sub === 'which' || sub === 'where') {
    const emp = employerSaid(occ);
    if (v.flags.onFarm) return [say(S, 'job.whichFarm', { employer: emp }, facts)];
    if (v.flags.wfh) return [say(S, 'job.whichHome', { employer: emp }, [REC.job, REC.commute])];
    const empSlots = { employer: emp, employerCap: capFirst(emp), employerEs: employerEs(occ && occ.employer), workCity };
    if (emp && sub === 'where') return [say(S, 'job.whereAt', empSlots, { '': facts, workCity: REC.commute }) || say(S, 'job.which', empSlots, { '': facts, workCity: REC.commute })];
    if (emp) return [say(S, 'job.which', empSlots, { '': facts, workCity: REC.commute })];
    return [say(S, workCity ? 'job.whereCity' : 'job.whereHere', { workCity }, [REC.commute])];
  }
  if (sub === 'howLong') {
    const started = lifeYear(v, 'npc.occupation');
    if (isNum(started)) {
      const years = v.P.year - started;
      return [years <= 0 ? say(S, 'job.new', { jobYear: started }, facts) : say(S, 'job.since', { jobYear: started, jobYears: years >= 2 ? years : null }, facts)];
    }
    return [say(S, 'job.sinceVague')];
  }
  if (sub === 'hours') {
    const dep = isNum(c.departMin) && c.mode !== 'wfh' ? c.departMin : null;
    if (dep === null) return [say(S, v.flags.onFarm ? 'job.hoursFarm' : 'job.hoursHome')];
    // "what time do you get off?": out the door, there and back, done
    if (S.uNorm && /\bget off|\bfinish|\bdone for the day|\boff work|\bget home\b/.test(S.uNorm) && isNum(c.dwellMin) && isNum(c.minutes)) {
      const off = dep + c.minutes + c.dwellMin;
      return [say(S, 'job.hoursOff', { offClock: clockSaid(off), offClockEs: clockSaidEs(off) }, [REC.commute])];
    }
    const hours = isNum(c.dwellMin) ? Math.round(c.dwellMin / 60) : null;
    const out = [say(S, v.flags.nights ? 'job.hoursNight' : 'job.hours', { departClock: clockSaid(dep), departClockEs: clockSaidEs(dep) }, [REC.commute])];
    if (isNum(hours) && hours >= 3) out.push(say(S, 'job.hoursLong', { dwellHours: numWord(hours), dwellHoursNum: hours }, [REC.commute]));
    if (v.flags.early && S.rng.chance(0.6)) out.push(say(S, 'job.early', {}, [REC.commute]));
    return out;
  }
  if (sub === 'days') {
    const days = num(c.workDays !== undefined ? c.workDays : c.days, 0);
    if (!days) return [say(S, v.flags.wfh ? 'job.daysHome' : 'job.sinceVague')];
    const weekend = (days & 1) || (days & 64), weekdays = [1, 2, 3, 4, 5].filter(d => days & (1 << d)).length;
    return [say(S, weekend ? 'job.daysWeekend' : weekdays >= 5 ? 'job.daysWeek' : 'job.daysSome', { dayCount: numWord(weekdays + ((days & 1) ? 1 : 0) + ((days & 64) ? 1 : 0)) }, [REC.commute])];
  }
  // "are you working today?": the work days on the record, and what they are doing right now
  if (sub === 'today') {
    const a = v.activity;
    if (!worksToday(v)) return [say(S, 'job.todayOff', {}, [REC.commute])];
    if (a && a.kind === 'work') return [say(S, 'job.todayNow', {}, [REC.commute, 'schedule.activity'])];
    if (a && a.kind === 'commute' && a.leg === 'back') return [say(S, 'job.todayDone', {}, ['schedule.activity'])];
    if (a && a.kind === 'commute') return [say(S, 'job.todayHeading', {}, ['schedule.activity'])];
    return [say(S, 'job.todayYes', {}, [REC.commute])];
  }
  // "do you work at a liquor store?", "do you own a nail salon?": yes when it is their work, else no and what they do
  if (sub === 'workAt') {
    const title = String((occ && occ.title) || '').replace(/\s*\([^)]*\)\s*$/, '');
    const theirs = !!(v.vocab && v.vocab.job && u && v.vocab.job.test(u.norm));
    if (!title) return null;
    return [say(S, theirs ? 'job.workAtYes' : 'job.workAtNo', { aJob: withArticle(title), employer: employerSaid(occ) }, facts)];
  }
  if (sub === 'before') return [say(S, 'job.before')];
  // "do you work from home or go into the office?": the record says how they get to work
  if (sub === 'wfh') {
    if (v.flags.onFarm) return [say(S, 'job.onFarm', {}, [REC.commute])];
    if (v.flags.wfh) return [say(S, 'job.wfhYes', {}, [REC.commute])];
    if (isNum(c.minutes) && c.minutes > 0) return [say(S, 'job.goIn', { workCity, commuteMin: c.minutes }, { '': [REC.commute] })];
    return null;
  }
  // "how many head of cattle?": a number the record does not hold, answered the way people do, without one
  if (sub === 'howMany') return [say(S, v.flags.onFarm || /\b(ranch|farm|orchard|vineyard|dairy|cattle)\b/i.test(`${occ && occ.title} ${occ && occ.employer}`) ? 'job.howManyFarm' : 'job.howMany')];
  if (sub === 'pay') {
    const inc = num(npc.income, null);
    return [say(S, isNum(inc) && inc < 35000 ? 'job.payLow' : isNum(inc) && inc >= 150000 ? 'job.payHigh' : 'job.pay', {}, isNum(inc) ? ['npc.income'] : [])];
  }
  return null;
}

/** Whether a name (a town, a road) was said in an earlier sentence of this conversation. */
function toldName(S, name) {
  const n = sentenceKey(String(name || ''), null, 1);
  if (!n || !S.st.sentences) return false;
  for (const k of S.st.sentences) if (k.includes(n)) return true;
  return false;
}

P.job = (S, u, opts = {}) => {
  const v = S.v, npc = v.npc, occ = v.occ, parts = [];
  const facts = [REC.job];
  const school = npc.school;
  const sub = !opts.brief && u && u.flags ? u.flags.sub : null;
  const likeIt = !!(u && u.flags && u.flags.likeIt);
  if (v.stage === 'toddler' || school === 'preschool') { parts.push(say(S, 'job.preschool')); return { parts, topics: ['school'] }; }
  if (v.age < 18 && school && school !== 'college') {
    const w = SCHOOL_WORDS[school] || SCHOOL_WORDS.elementary;
    if (likeIt) return { parts: [say(S, v.age < 13 ? 'job.kidFeel' : 'job.teenFeel')], topics: ['school'], ask: null };
    if ((sub === 'hours' || sub === 'howLong') && isNum(v.commute.departMin)) return { parts: [say(S, 'job.schoolHours', { departClock: clockSaid(v.commute.departMin), departClockEs: clockSaidEs(v.commute.departMin) }, [REC.commute])], topics: ['school'], ask: null };
    parts.push(say(S, 'job.k12', { school: w[0], schoolEs: w[1] }, ['npc.school']));
    if (!opts.brief) parts.push(say(S, v.age < 13 ? 'job.kidFeel' : 'job.teenFeel'));
    if (occ && occ.title && v.age >= 14) parts.push(say(S, 'job.studentWorks', { aJob: withArticle(String(occ.title).replace(/\s*\([^)]*\)\s*$/, '')) }, facts));
    return { parts, topics: ['school'], ask: v.age >= 13 ? 'school' : null };
  }
  if (school === 'college' || school === 'grad' || (npc.status === 'student' && v.age >= 18)) {
    if (likeIt) return { parts: [say(S, 'job.collegeFeel')], topics: ['school'], ask: 'job' };
    if (occ && occ.title && ['which', 'where', 'hours', 'pay', 'days', 'wfh', 'today', 'workAt'].includes(sub)) { const p = jobSub(S, sub, u); if (p && p.filter(Boolean).length) return { parts: p, topics: ['job'], ask: null }; }
    parts.push(say(S, school === 'grad' ? 'job.grad' : 'job.college', {}, ['npc.school']));
    if (occ && occ.title) parts.push(say(S, 'job.studentWorks', { aJob: withArticle(String(occ.title).replace(/\s*\([^)]*\)\s*$/, '')) }, facts));
    return { parts, topics: ['school'], ask: 'job' };
  }
  if (npc.status === 'retired') {
    const year = lifeYear(v, 'npc.status');
    if (sub === 'howLong') return { parts: [year ? say(S, 'job.retiredSince', { retireYear: year }, ['npc.status']) : say(S, 'job.retiredVague')], topics: ['job'], ask: null };
    if (sub === 'hours') return { parts: [say(S, 'job.hoursRetired')], topics: ['job'], ask: null };
    if (sub === 'pay') return { parts: [say(S, 'job.payRetired')], topics: ['job'], ask: null };
    if (likeIt) return { parts: [say(S, 'why.retired')], topics: ['job'], ask: 'job' };
    parts.push(say(S, 'job.retired', { retireYear: year }, ['npc.status']));
    if (!opts.brief) parts.push(...interestParts(S, 1));
    return { parts, topics: ['job'], ask: 'job' };
  }
  if (npc.status === 'unemployed') {
    if (sub === 'howLong' || sub === 'pay') return { parts: [say(S, 'job.unemployedMore')], topics: ['job'], ask: null, emotion: 'down' };
    if (sub === 'hours' || sub === 'days') return { parts: [say(S, 'job.unemployed', {}, ['npc.status'])], topics: ['job'], ask: null, emotion: 'down' };
    parts.push(say(S, 'job.unemployed', {}, ['npc.status'])); return { parts, topics: ['job'], ask: 'job', emotion: 'down' };
  }
  if (npc.status === 'military' && !(occ && occ.title)) { parts.push(say(S, 'job.military', {}, ['npc.status'])); return { parts, topics: ['job'], ask: 'job' }; }
  if (!occ || !occ.title) {
    // home with the kids only while there are kids under 18 at home; past 65 with grown kids, they are retired
    const homemaker = v.age >= 18 && (npc.status === 'homemaker' || v.flags.minorKids) && !(v.age >= 65 && !v.flags.minorKids);
    if (sub === 'howLong' && homemaker) return { parts: [say(S, 'job.homemakerSince')], topics: ['job'], ask: null };
    if (homemaker) parts.push(say(S, 'job.homemaker', {}, ['npc.status']));
    else parts.push(say(S, v.age >= 65 ? 'job.retired' : 'job.notWorking', {}, ['npc.status']));
    return { parts, topics: ['job'], ask: 'job' };
  }
  if (sub && sub !== 'like') {
    const p = jobSub(S, sub, u);
    if (p && p.filter(Boolean).length) return { parts: p, topics: ['job'], ask: null };
  }
  const titleRaw = String(occ.title).trim();
  const detail = /\(([^)]+)\)\s*$/.exec(titleRaw);
  const title = titleRaw.replace(/\s*\([^)]*\)\s*$/, '');
  // "a preschool teacher at a preschool": an employer that only repeats the title adds nothing
  const titleWords = new Set(title.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 4));
  const empWords = String(occ.employer || '').toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 5);
  const emp = empWords.some(w => titleWords.has(w) || titleWords.has(w.replace(/s$/, ''))) ? null : employerPhrase(occ.employer);
  const workCity = v.commute.workCity && v.commute.workCity !== v.z.city ? v.commute.workCity : null;
  const where = emp ? ` ${emp}` : workCity && v.commute.mode !== 'wfh' ? ` in ${workCity}` : '';
  const [jobEs, jobEn] = jobSpanish(v.occKey, title, v.sex);
  const feel = feelKey(v.occKey, title, occ.employer);
  if (((S.st.depth.job || 0) > 0 || likeIt || sub === 'like') && !opts.brief) {
    // "is it hard?": the lines about how hard it is, when the job has any
    const hardQ = !!(u && /\b(hard|tough|tiring|exhausting|stressful|rough|difficult|easy|dangerous|physical|heavy|pesado|duro|dificil)\b/.test(u.norm));
    const pref = hardQ ? { _prefer: /\b(hard|tough|rough|long|back|heat|tired|easy|worth|honest work|on (?:your|my) feet|exhausting|heavy|demanding|a lot)\b/i } : {};
    const more = [say(S, feel, pref) || say(S, 'job.feel.any', pref)];
    if (workCity && num(v.commute.minutes) >= 20 && !v.flags.wfh && !toldName(S, workCity)) more.push(say(S, 'job.commute', { workCity, commuteMin: v.commute.minutes }, [REC.commute]));
    if (v.flags.nights) more.push(say(S, 'job.nights', {}, facts)); else if (v.flags.early) more.push(say(S, 'job.early', {}, [REC.commute]));
    if (more.filter(Boolean).length) return { parts: more, topics: ['job'], ask: 'job' };
  }
  // their own farm or business: "I run my own orchard", not "I'm a farmer on my orchard"
  const own = v.flags.selfEmployed && /^their\b/i.test(String(occ.employer || '')) ? employerSaid(occ) : null;
  if (own) parts.push(say(S, 'job.own', { aJob: withArticle(title), aJobCap: capFirst(withArticle(title)), ownPlace: own, jobEs, jobEn }, facts));
  if (!own || !parts.filter(Boolean).length) parts.push(say(S, 'job.title', { aJob: withArticle(title), job: title, where, employer: occ.employer ? String(occ.employer).replace(/^their /, 'my ') : null, workCity, jobEs, jobEn }, facts));
  if (detail && v.lang.mode === 'en') parts.push({ text: `Mostly ${detail[1]}.`, gloss: null, facts, key: 'job.detail' });
  if (opts.brief) return { parts, topics: ['job'] };
  const extra = [];
  if (v.flags.onFarm) extra.push(say(S, 'job.onFarm', {}, [REC.commute]));
  else if (v.flags.wfh) extra.push(say(S, 'job.wfh', {}, [REC.commute]));
  else if (v.flags.nights) extra.push(say(S, 'job.nights', {}, facts));
  else if (v.flags.early) extra.push(say(S, 'job.early', {}, [REC.commute]));
  const started = lifeYear(v, 'npc.occupation');
  if (isNum(started)) {
    const years = v.P.year - started;
    extra.push(years <= 0 ? say(S, 'job.new', { jobYear: started }, facts) : say(S, 'job.since', { jobYear: started, jobYears: years >= 2 ? years : null }, facts));
  }
  extra.push(say(S, feel) || say(S, 'job.feel.any'));
  if (workCity && num(v.commute.minutes) >= 20 && !v.flags.wfh && !toldName(S, workCity)) extra.push(say(S, 'job.commute', { workCity, commuteMin: v.commute.minutes }, [REC.commute]));
  for (const x of S.rng.shuffle(extra.filter(Boolean))) parts.push(x);
  return { parts, topics: ['job'], ask: 'job' };
};

/** School level by age, as said: "elementary school", "high school", or null for the youngest and the grown. */
function schoolOfAge(age) {
  if (!isNum(age) || age < 5) return null;
  if (age <= 10) return SCHOOL_WORDS.elementary;
  if (age <= 13) return SCHOOL_WORDS.middle;
  if (age <= 17) return SCHOOL_WORDS.high;
  return null;
}

/** "Maria's 14 and Jose's 9": names with ages, from the household record. */
function agesSaid(list) {
  // "Doris is 71", not "Doris's 71": a name ending in s takes the full verb
  return listJoin(list.map(k => (k.name ? `${k.name}${/[sxz]$/i.test(k.name) ? ' is' : "'s"} ${num(k.age) < 1 ? 'just a baby' : k.age}` : null)).filter(Boolean));
}

/**
 * Whom a family follow-up names in its own words ("how old are your grandkids?", "what does your mom do?"): the
 * group ('kids', 'grandkids', 'partner', 'parents', 'grandparents', 'siblings', 'roommates' or null) and the sex the
 * words point at ('F', 'M' or null).
 * @param {string} q the line, normalized
 * @returns {[string|null, 'F'|'M'|null]}
 */
export function askedGroup(q) {
  const s = String(q || '');
  const sex = /\b(daughters?|girls?|granddaughters?|sisters?|mom|mother|mama|mommy|grandma|grandmother|granny|wife|she|her|hers)\b/.test(s) ? 'F'
    : /\b(sons?|boys?|grandsons?|brothers?|dad|father|papa|daddy|grandpa|grandfather|husband|he|him|his)\b/.test(s) ? 'M' : null;
  if (/\bgrand(?:kids?|children|sons?|daughters?|babies|baby)\b|\bgrandchild\b/.test(s)) return ['grandkids', sex];
  if (/\bgrand(?:ma|pa|mother|father|parents)\b|\bgranny\b/.test(s)) return ['grandparents', sex];
  if (/\b(?:kids?|children|child|sons?|daughters?|boys?|girls?|babies|baby)\b/.test(s)) return ['kids', sex];
  if (/\b(?:wife|husband|partner|spouse)\b/.test(s)) return ['partner', sex];
  if (/\b(?:parents|mom|dad|mother|father|mama|papa|mommy|daddy|folks)\b/.test(s)) return ['parents', sex];
  if (/\b(?:siblings?|brothers?|sisters?)\b/.test(s)) return ['siblings', sex];
  if (/\broommates?\b/.test(s)) return ['roommates', sex];
  return [null, sex];
}

/** Nobody of a group lives with them, said plainly ("No grandkids at home.", "They don't live with us."). */
function noneOf(S, group) {
  const v = S.v, R = v.rel, facts = [REC.home];
  if (group === 'kids') return v.age < 18 ? say(S, 'fam.kidSelfNo') : say(S, R.grandkids.length ? 'fam.noKidsHome' : 'fam.noKids', {}, facts);
  if (group === 'grandkids') return say(S, v.age < 40 ? 'fam.noGrandkidsYoung' : 'fam.noGrandkids', {}, facts);
  if (group === 'parents') return say(S, 'fam.parentsElsewhere', {}, facts);
  if (group === 'grandparents') return say(S, 'fam.noGrandparents', {}, facts);
  if (group === 'siblings') return say(S, 'fam.noSiblings', {}, facts);
  if (group === 'partner') return notMarried(S);
  return say(S, 'fam.namesNone', {}, facts);
}

/** What one parent does, from the household's record: "My mom's a teaching assistant.", "My dad's retired." */
function parentJobPart(S, parent) {
  const job = partnerJob(S, parent);
  const slots = {
    parentPronoun: parent.sex === 'F' ? 'She' : 'He', parentObj: parent.sex === 'F' ? 'her' : 'him', parentO: parent.sex === 'F' ? 'a' : 'o',
    parentWord: parent.sex === 'F' ? 'mom' : 'dad', parentEs: parent.sex === 'F' ? 'mi mamá' : 'mi papá', aParentJob: job.title ? withArticle(job.title) : null,
    elloEs: parent.sex === 'F' ? 'Ella' : 'Él', parentJobEs: job.title ? jobEsThird(job.group, job.title, parent.sex) : null,
  };
  const titled = job.title ? say(S, 'fam.parentJob', slots, ['npc.household', 'household.occupation']) : null;
  if (titled) return titled;
  if (job.worker || job.title) return say(S, 'fam.parentWorks', slots, [REC.home]);
  return say(S, num(parent.age) >= 65 ? 'fam.parentRetired' : 'fam.parentHome', slots, [REC.home]);
}

/**
 * Follow-ups about the household: names, ages, boys or girls, what someone does, their schools, how long married.
 * Whom it is about comes from the question's own words first ("your grandkids", "your mom"), then whoever the talk
 * was just about (S.st.familyFocus), then the people this speaker lives with by life stage (a parent's kids, a
 * teenager's brothers and sisters); "he" or "she" narrows it. A group named with nobody in it at home is said so.
 * Sets S.subFocus to the group answered, so the next "how old are they?" stays on it.
 */
function familySub(S, sub, u) {
  const v = S.v, R = v.rel, facts = [REC.home], q = u ? u.norm : '';
  const byAge = list => list.slice().sort((a, b) => num(b.age) - num(a.age));
  const p = R.partner;
  const pron = x => (x && x.sex === 'F' ? 'She' : 'He');
  const partnerWord = p ? (p.role === 'partner' || v.npc.role === 'partner' ? 'partner' : p.sex === 'F' ? 'wife' : 'husband') : null;
  const partnerEs = p ? (partnerWord === 'partner' ? 'pareja' : p.sex === 'F' ? 'esposa' : 'esposo') : null;
  const [named, nameSex] = askedGroup(q);
  // "he" and "she" point at someone of that sex: "how old is he?" after the son is the son, not the wife
  const saidSex = /\b(she|her|hers)\b/.test(q) ? 'F' : /\b(he|him|his)\b/.test(q) ? 'M' : null;
  const sexOf = nameSex || saidSex;
  const groups = { kids: byAge(R.kids), grandkids: byAge(R.grandkids), parents: R.parents, grandparents: R.grandparents, siblings: byAge(R.siblings), roommates: R.roommates };
  const focus = S.st.familyFocus;
  const focusList = focus && groups[focus] && groups[focus].length ? groups[focus] : null;
  const aboutPartner = !!p && (named === 'partner'
    || (!named && saidSex && p.sex === saidSex && !(focus !== 'partner' && focusList && focusList.some(k => k.sex === saidSex)))
    || (!named && !saidSex && (focus === 'partner' || (!focusList && !R.kids.length && !/\b(they|them|their)\b/.test(q)))));
  S.subFocus = aboutPartner ? 'partner' : null;
  if (named === 'partner' && !p && sub !== 'howLong') return [notMarried(S)];
  // the people asked about
  const order = v.age < 18 ? ['siblings', 'parents', 'grandparents', 'kids', 'roommates'] : ['kids', 'grandkids', 'parents', 'siblings', 'roommates', 'grandparents'];
  const groupKey = named && named !== 'partner' ? named : focusList ? focus : order.find(k => groups[k].length) || null;
  let others = groupKey ? groups[groupKey] : [];
  if (named && named !== 'partner' && !others.length && !aboutPartner && sub !== 'howLong') return [noneOf(S, named)];
  if (!aboutPartner && sexOf && others.some(x => x.sex === sexOf)) others = others.filter(x => x.sex === sexOf);
  if (!aboutPartner) S.subFocus = groupKey;
  // what a parent does ("what does your mom do?", "what do your parents do?", "what does she do?" after the parents)
  if (sub === 'parentJob' || (!aboutPartner && groupKey === 'parents' && (sub === 'partnerJob' || sub === 'kidsDo'))) {
    const want = sub === 'parentJob' ? (/\b(mom|mother|mama|mommy)\b/.test(q) ? 'F' : /\b(dad|father|papa|daddy|old man)\b/.test(q) ? 'M' : saidSex) : sexOf;
    const list = R.parents.filter(x => !want || x.sex === want);
    S.subFocus = 'parents';
    if (!list.length) return [say(S, 'fam.parentsElsewhere', {}, facts)];
    return list.slice(0, 2).map(x => parentJobPart(S, x));
  }
  if (sub === 'partnerJob' && (aboutPartner || !others.length)) {
    if (!p) return [say(S, v.flags.widowed ? 'fam.widowed' : 'fam.noPartner', { lostWord: v.sex === 'F' ? 'husband' : 'wife' }, facts)];
    const job = partnerJob(S, p);
    const slots = { partnerPronoun: pron(p), partnerWord, partnerEs, aPartnerJob: job.title ? withArticle(job.title) : null, elloEs: p.sex === 'F' ? 'Ella' : 'Él' };
    if (job.title) return [say(S, 'fam.partnerJob', slots, ['npc.household', 'household.occupation'])];
    if (job.worker) return [say(S, 'fam.partnerWorks', slots, facts)];
    return [say(S, num(p.age) >= 65 ? 'fam.partnerRetired' : 'fam.partnerHome', slots, facts)];
  }
  if (sub === 'names') {
    if (aboutPartner) return [say(S, 'fam.partnerName', { partnerName: p.name, partnerWord, partnerEs }, facts)];
    const withName = others.filter(x => x.name);
    if (!withName.length) return [say(S, 'fam.namesNone', {}, facts)];
    if (withName.length === 1) return [say(S, 'fam.oneName', { otherName: withName[0].name, otherPronoun: pron(withName[0]) }, facts)];
    const names = withName.map(x => x.name);
    return [say(S, 'fam.names', { namesList: listJoin(names), namesListEs: listJoin(names, /^h?i(?![aeiou])/i.test(names[names.length - 1]) ? 'e' : 'y') }, facts)];
  }
  if (sub === 'ages') {
    if (aboutPartner && isNum(p.age)) return [say(S, 'fam.partnerAge', { partnerWord, partnerEs, partnerAge: p.age, partnerPronoun: pron(p) }, facts)];
    const aged = others.filter(x => isNum(x.age));
    if (!aged.length) return [say(S, 'fam.namesNone', {}, facts)];
    if (aged.length === 1) return [num(aged[0].age) < 1 ? say(S, 'fam.oneBaby', { otherPronoun: pron(aged[0]) }, facts) : say(S, 'fam.oneAge', { otherPronoun: pron(aged[0]), otherAge: aged[0].age, otherName: aged[0].name }, facts)];
    const said = agesSaid(aged);
    const nums = { agesNums: listJoin(aged.map(x => String(x.age))), agesNumsEs: listJoin(aged.map(x => String(x.age)), 'y') };
    return [said ? say(S, 'fam.ages', Object.assign({ agesList: said, agesListCap: capFirst(said) }, nums), facts) : say(S, 'fam.agesNums', nums, facts)];
  }
  if (sub === 'sexes') {
    const kin = groupKey === 'grandkids' || groupKey === 'siblings' ? others : groups.kids;
    if (!kin.length) return [noneOf(S, groupKey === 'grandkids' || groupKey === 'siblings' ? groupKey : 'kids')];
    const girls = kin.filter(k => k.sex === 'F').length, boys = kin.length - girls;
    const part = (n, one, many) => (n ? `${n === 1 ? 'one' : numWord(n)} ${n === 1 ? one : many}` : null);
    const NUM_ES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
    const parte = (n, one, many) => (n ? `${n === 1 ? (one === 'niña' ? 'una' : 'un') : NUM_ES[n] || n} ${n === 1 ? one : many}` : null);
    const kidsSexes = listJoin([part(girls, 'girl', 'girls'), part(boys, 'boy', 'boys')]);
    return [say(S, 'fam.sexes', { kidsSexes, kidsSexesCap: capFirst(kidsSexes), kidsSexesEs: listJoin([parte(girls, 'niña', 'niñas'), parte(boys, 'niño', 'niños')], 'y') }, facts)];
  }
  if (sub === 'kidsDo' || sub === 'partnerJob') {
    if (!others.length) return [noneOf(S, groupKey || 'kids')];
    const members = (v.routine && v.routine.household && v.routine.household.members) || [];
    const doing = k => {
      const m = members.find(x => x && x.m === k.m) || {};
      if (num(k.age) < 5) return ['still little', 'todavía está chiquit' + (k.sex === 'F' ? 'a' : 'o')];
      const w = schoolOfAge(k.age);
      if (w) return [`in ${w[0]}`, `va a la ${w[1]}`];
      if (m.student === 'college' || m.student === 'grad') return ['in college', 'va a la universidad'];
      if (m.worker) return ['working', 'trabaja'];
      if (num(k.age) >= 65) return ['retired', 'ya está jubilad' + (k.sex === 'F' ? 'a' : 'o')];
      return ['home with us', 'está en la casa'];
    };
    const withName = others.filter(k => k.name);
    if (!withName.length) return [say(S, 'fam.kidsMany', { kidCount: numWord(others.length) }, facts)];
    const en = withName.map(k => `${k.name}'s ${doing(k)[0]}`), es = withName.map(k => `${k.name} ${doing(k)[1]}`);
    return [say(S, 'fam.kidsDo', { kidsDoing: listJoin(en), kidsDoingCap: capFirst(listJoin(en)), kidsDoingEs: listJoin(es, 'y') }, ['npc.household', 'household.members'])];
  }
  if (sub === 'howLong' && /\bmarried\b|\btogether\b/.test(q)) {
    S.subFocus = 'partner';
    if (!p || (/\bmarried\b/.test(q) && !v.flags.married)) return [notMarried(S)];
    const wed = (v.p.memories || []).find(m => m.kind === 'life' && /got married in (\d{4})/.test(m.text || ''));
    return [wed ? say(S, 'fam.married', { partnerName: p.name, weddingYear: wed.year }, ['npc.household']) : say(S, 'fam.togetherLong', { partnerWord, partnerEs }, facts)];
  }
  if (sub === 'school') {
    const inSchool = others.map(k => ({ k, w: schoolOfAge(k.age) })).filter(x => x.w);
    if (!inSchool.length) return [say(S, others.length ? 'fam.noneInSchool' : groupKey === 'kids' || !groupKey ? 'fam.noKids' : 'fam.noneInSchool', {}, facts)];
    if (inSchool.length === 1) return [say(S, 'fam.oneSchool', { otherPronoun: pron(inSchool[0].k), school: inSchool[0].w[0], schoolEs: inSchool[0].w[1] }, facts)];
    const levels = [...new Set(inSchool.map(x => x.w[0]))];
    const count = l => inSchool.filter(x => x.w[0] === l).length;
    const schoolsList = listJoin(levels.map(l => `${count(l) === 1 ? 'one' : numWord(count(l))} in ${l}`));
    const NUM_ES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho'];
    const inSchoolEs = levels.map(l => { const n = count(l); const w = inSchool.find(x => x.w[0] === l).w[1]; return `${NUM_ES[n] || n} en la ${w}`; });
    const slots = { school: levels[0], schoolCap: capFirst(levels[0]), allWord: inSchool.length === 2 ? 'both' : 'all', schoolsList, schoolsListCap: capFirst(schoolsList), schoolsListEs: listJoin(inSchoolEs, 'y'), schoolsListEsCap: capFirst(listJoin(inSchoolEs, 'y')), schoolEs: inSchool[0].w[1] };
    // (some of them are past school: "four in high school; the rest are done with school")
    if (inSchool.length < others.length) return [say(S, 'fam.someInSchool', slots, facts)];
    return [say(S, levels.length === 1 ? 'fam.sameSchool' : 'fam.schools', slots, facts)];
  }
  return null;
}

/** Not married, as the record says it: never married, divorced, separated, widowed, or living with a partner. */
function notMarried(S) {
  const v = S.v, R = v.rel, marital = v.npc.marital, facts = ['npc.marital'];
  if (R.partner) return say(S, 'fam.partnerUnmarried', { partnerName: R.partner.name }, ['npc.household']);
  if (marital === 'widowed' || v.flags.widowed) return say(S, 'fam.widowed', { lostWord: v.sex === 'F' ? 'husband' : 'wife' }, facts);
  if (marital === 'divorced') return say(S, 'fam.divorced', {}, facts);
  if (marital === 'absent') return say(S, 'fam.spouseAway', {}, facts);
  if (marital === 'separated') return say(S, 'fam.separated', {}, facts);
  return say(S, 'fam.neverMarried', {}, facts);
}

/**
 * What a member of the household does, from the household's record: {title, worker, group}. The population, when the
 * conversation has one, gives the title and the Census occupation group.
 */
function partnerJob(S, p) {
  const v = S.v;
  let title = null, worker = null, group = null;
  const pop = S.population;
  if (pop && typeof pop.person === 'function' && Number.isInteger(v.npc.zi) && Number.isInteger(v.npc.h)) {
    try {
      const rec = pop.person(v.npc.zi, v.npc.h, p.m);
      if (rec && rec.occupation && rec.occupation.title) title = String(rec.occupation.title).replace(/\s*\([^)]*\)\s*$/, '');
      if (rec) worker = rec.status === 'employed' || rec.status === 'military' || !!rec.occupation;
      const core = typeof pop.householdCore === 'function' ? pop.householdCore(v.npc.zi, v.npc.h) : null;
      const cm = core && Array.isArray(core.members) ? core.members.find(x => x && x.m === p.m) : null;
      group = cm && cm.occ ? cm.occ : null;
    } catch { title = null; }
  }
  if (worker === null) {
    const m = ((v.routine && v.routine.household && v.routine.household.members) || []).find(x => x && x.m === p.m);
    worker = m ? !!m.worker : null;
  }
  return { title, worker, group };
}

// Spanish verbs of the work lines (life.mjs, first person) in the third person, for what a parent does.
const ES_THIRD = { Soy: 'es', Trabajo: 'trabaja', Manejo: 'maneja', Hago: 'hace', Cuido: 'cuida', Lavo: 'lava', Preparo: 'prepara', Recibo: 'recibe', Limpio: 'limpia', Instalo: 'instala', Ayudo: 'ayuda', Acomodo: 'acomoda', Recojo: 'recoge', Vendo: 'vende', Tengo: 'tiene' };

/** "ayuda en una escuela", "es enfermera": someone else's job in Spanish, said in the third person; null when it can't be. */
function jobEsThird(group, title, sex) {
  const [es] = jobSpanish(group, title, sex);
  const m = /^(\p{Lu}\p{Ll}+)\s+(.*?)[.!]?$/u.exec(String(es || ''));
  if (!m || !ES_THIRD[m[1]]) return null;
  return `${ES_THIRD[m[1]]} ${m[2]}`.replace(/\bmi propio\b/, 'su propio');
}

P.family = (S, u) => {
  const v = S.v, R = v.rel, parts = [];
  const facts = [REC.home];
  const stranger = !v.relq.known;
  if (v.relq.guarded || (stranger && v.big5.E < 0.3 && v.big5.A < 0.4 && S.rng.chance(0.6) && !(u && u.flags && u.flags.followUp))) {
    parts.push(say(S, 'fam.guarded'));
    return { parts, topics: ['family'], noAsk: true };
  }
  const sub = u && u.flags ? u.flags.sub : null;
  // a follow-up ("how old are they?", "what does your mom do?") is answered about the people it asks about, at any age
  if (sub && ['names', 'ages', 'sexes', 'partnerJob', 'parentJob', 'school', 'kidsDo', 'howLong'].includes(sub)) {
    S.subFocus = undefined;
    const sp = familySub(S, sub, u);
    if (sp && sp.filter(Boolean).length) {
      return { parts: sp, topics: ['family'], ask: sub === 'partnerJob' && S.subFocus === 'partner' ? 'job' : v.age >= 18 ? 'kids' : null, familyFocus: S.subFocus === undefined ? S.st.familyFocus : S.subFocus };
    }
  }
  const q0 = u ? u.norm : '';
  // what the question is about, so "what are their names?" next means them
  const familyFocus = /\bgrand(kids|children|sons?|daughters?|babies)\b/.test(q0) ? 'grandkids' : /\b(kids?|children|sons?|daughters?)\b/.test(q0) ? 'kids'
    : /\b(wife|husband|partner|spouse|married)\b/.test(q0) ? 'partner' : /\b(parents|mom|dad|mother|father)\b/.test(q0) ? 'parents' : null;
  if (v.age >= 18) {
    // the question asked, answered first: married? grandkids? where are your parents?
    if (/\bare you (married|single|seeing anyone|dating anyone)\b|\bis there a (mr|mrs)\b/.test(q0) && (!R.partner || !v.flags.married)) return { parts: [notMarried(S)], topics: ['family'], ask: 'kids' };
    if (/\bgrand(kids|children|sons?|daughters?|babies)\b/.test(q0) && !R.grandkids.length) {
      const p = [say(S, v.age < 40 ? 'fam.noGrandkidsYoung' : 'fam.noGrandkids', {}, facts)];
      return { parts: p, topics: ['family'], ask: 'kids' };
    }
    if (familyFocus === 'grandkids' && R.grandkids.length) {
      // "do you have grandkids?": the grandkids under their roof, by name, then the rest of the family
      const gk = R.grandkids.slice().sort((a, b) => num(a.age) - num(b.age));
      const one = gk.length === 1 ? gk[0] : null;
      const names = gk.map(x => x.name).filter(Boolean);
      const gp = [say(S, 'fam.grandkidsHere', {
        gkWord: one ? (one.sex === 'F' ? 'granddaughter' : 'grandson') : null, gkName: one ? one.name : null, gkAge: one && isNum(one.age) ? one.age : null,
        gkCount: gk.length > 1 ? numWord(gk.length) : null, gkNames: gk.length > 1 && names.length === gk.length ? listJoin(names) : null,
        gkNamesEs: gk.length > 1 && names.length === gk.length ? listJoin(names, /^h?i(?![aeiou])/i.test(names[names.length - 1]) ? 'e' : 'y') : null,
        nietoEs: one ? (one.sex === 'F' ? 'mi nieta' : 'mi nieto') : null, gkCountEs: gk.length > 1 ? (['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis'][gk.length] || String(gk.length)) : null,
      }, facts)];
      if (R.kids.length && S.rng.chance(0.6)) {
        const k = R.kids[0];
        gp.push(say(S, 'fam.kidOne', { kidWord: k.sex === 'F' ? 'daughter' : 'son', kidName: k.name, kidAge: k.age, kidPronoun: k.sex === 'F' ? 'She' : 'He', unKidEs: k.sex === 'F' ? 'una hija' : 'un hijo' }, facts));
      }
      return { parts: gp, topics: ['family'], ask: 'kids', familyFocus: 'grandkids' };
    }
    if (/\byour (parents|mom|dad|mother|father|folks)\b/.test(q0) && !/\bkids?\b|\bchildren\b/.test(q0)) {
      const pw = parentsWords(S);
      if (pw) return { parts: [say(S, 'fam.parentsHere', { parentsWord: pw.en, parentsEs: pw.es }, facts)], topics: ['family'], ask: null };
      const abroad = (v.p.concerns || []).some(c => c.topic === 'family abroad') && v.npc.nativity === 'foreign';
      const homeland = abroad ? homelandOf(v.npc.birthplace) : null;
      return { parts: [homeland ? abroadLine(S, homeland) : say(S, 'fam.parentsElsewhere', {}, facts)], topics: ['family'], ask: null };
    }
  }
  const pw = parentsWords(S);
  const sib = siblingWords(R.siblings);
  const q = u ? u.norm : '';
  let sibSaid = false;
  if (/\b(brothers?|sisters?|siblings?)\b/.test(q)) {
    if (sib) parts.push(say(S, 'fam.siblingsAnswer', { sibWords: sib.en, sibEs: sib.es }, facts));
    else parts.push(say(S, 'fam.noSiblings', {}, facts));
    sibSaid = true;
  }
  if (v.age < 18) {
    if (/\b(do you have|have any|got any) (kids|children)\b|\bare you married\b/.test(q)) parts.push(say(S, 'fam.kidSelfNo'));
    // who they live with: the parents, the grandparents, then the brothers and sisters as "plus ...", which goes only
    // right after what it adds to; a question about brothers and sisters is answered about them alone
    if (!sibSaid) {
      let lead = null;
      if (pw) {
        const term = pw.rel ? homeWord(S, pw.rel, pw.en) : null;
        lead = say(S, 'fam.parents', { parentsWord: term || pw.en, parentsEs: pw.es }, facts);
        parts.push(lead);
      }
      if (R.grandparents.length) { const g = say(S, 'fam.grandparents', gpSlots(S, R.grandparents), facts); parts.push(g); lead = lead || g; }
      if (sib) parts.push(lead ? dependent(say(S, 'fam.siblings', { sibWords: sib.en, sibEs: sib.es }, facts)) : say(S, 'fam.siblingsAnswer', { sibWords: sib.en, sibEs: sib.es }, facts));
    }
    return { parts, topics: ['family'], ask: null, familyFocus: sib ? 'siblings' : pw ? 'parents' : R.grandparents.length ? 'grandparents' : null };
  }
  // the partner and the kids, in the order the question asked about them
  const partnerParts = [], kidParts = [];
  if (R.partner) {
    const p = R.partner;
    const partnerWord = p.role === 'partner' || v.npc.role === 'partner' ? 'partner' : p.sex === 'F' ? 'wife' : 'husband';
    const partnerEs = partnerWord === 'partner' ? 'pareja' : p.sex === 'F' ? 'esposa' : 'esposo';
    partnerParts.push(say(S, 'fam.partner', { partnerWord, partnerEs, partnerName: p.name }, facts));
    const wed = (v.p.memories || []).find(m => m.kind === 'life' && /got married in (\d{4})/.test(m.text || ''));
    if (wed && S.rng.chance(0.6)) partnerParts.push(say(S, 'fam.married', { partnerName: p.name, weddingYear: wed.year }, ['npc.household']));
  }
  const kids = R.kids.slice().sort((a, b) => num(a.age) - num(b.age));
  const askedKids = /\bkids?\b|\bchildren\b|\b(sons?|daughters?)\b/.test(q);
  if (!kids.length && askedKids) kidParts.push(say(S, R.grandkids.length ? 'fam.noKidsHome' : 'fam.noKids', {}, facts));
  if (kids.length === 1) {
    const k = kids[0];
    kidParts.push(say(S, 'fam.kidOne', {
      kidWord: k.sex === 'F' ? 'daughter' : 'son', kidName: k.name, kidAge: k.age, kidPronoun: k.sex === 'F' ? 'She' : 'He',
      unKidEs: k.sex === 'F' ? 'una hija' : 'un hijo',
    }, facts));
  } else if (kids.length > 1) {
    const names = kids.map(k => k.name).filter(Boolean);
    kidParts.push(say(S, 'fam.kidsMany', {
      kidCount: numWord(kids.length), kidNames: names.length === kids.length ? listJoin(names) : null,
      // Spanish "y" turns to "e" before an i sound: "Jessica e Isabel"
      kidNamesEs: names.length === kids.length ? listJoin(names, /^h?i(?![aeiou])/i.test(names[names.length - 1]) ? 'e' : 'y') : null,
      kidCountEs: ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho'][kids.length] || String(kids.length),
      hijosEs: kids.every(k => k.sex === 'F') ? 'hijas' : 'hijos',
    }, facts));
  }
  if (kids.length) {
    const young = num(kids[0].age, 10), old = num(kids[kids.length - 1].age, 10);
    // grown kids still at home alongside school-age ones are their own case, not "they're adults now"
    const band = young < 2 ? 'baby' : old >= 18 && young < 18 ? 'mixed' : old >= 18 ? 'grown' : young >= 13 ? 'teens' : 'small';
    const one = kids.length === 1 && band !== 'baby';
    const oldest = kids[kids.length - 1], youngest = kids[0];
    kidParts.push(say(S, one ? `fam.kidFeel.${band}` : `fam.kidsFeel.${band}`, one ? { kidPronoun: kids[0].sex === 'F' ? 'She' : 'He', adultoEs: kids[0].sex === 'F' ? 'adulta' : 'adulto' } : {
      youngOne: youngest.age >= 13 ? 'a teenager' : youngest.age >= 5 ? 'one in school' : 'a little one',
      mayorEs: oldest.sex === 'F' ? 'La mayor' : 'El mayor', adultoEs: oldest.sex === 'F' ? 'adulta' : 'adulto', menorEs: youngest.sex === 'F' ? 'la menor' : 'el menor',
    }));
  }
  const askedPartner = /\b(married|wife|husband|partner|spouse|single|dating|girlfriend|boyfriend)\b/.test(q);
  const focus = askedKids && !askedPartner ? 'kids' : askedPartner && !askedKids ? 'partner' : sibSaid ? 'siblings' : null;
  const order = focus === 'kids' ? [['kids', kidParts], ['partner', partnerParts]] : [['partner', partnerParts], ['kids', kidParts]];
  for (const [k, ps] of order) {
    // what they already told, and not what was asked now, is not told again
    if (!ps.length || (focus && focus !== k && S.st.used.has(`fam:${k}`))) continue;
    parts.push(...ps);
    S.st.used.add(`fam:${k}`);
  }
  if (R.grandkids.length) parts.push(say(S, 'fam.grandkids', {}, facts));
  if (!R.partner && !kids.length) {
    if (pw) {
      const term = pw.rel ? homeWord(S, pw.rel, pw.en) : null;
      // a householder's parents moved in with them, and at middle age it is the child who looks after them
      const care = v.npc.role === 'householder' || v.age >= 45;
      const them = pw.rel ? { themWord: pw.rel === 'mother' ? 'her' : 'him', cuidoEs: pw.rel === 'mother' ? 'la cuido' : 'lo cuido' } : { themWord: 'them', cuidoEs: 'los cuido' };
      parts.push(say(S, care ? 'fam.parentsCare' : 'fam.parentsAdult', Object.assign({ parentsWord: term || pw.en, parentsEs: pw.es }, them), facts));
      if (sib && !sibSaid) parts.push(dependent(say(S, 'fam.siblings', { sibWords: sib.en, sibEs: sib.es }, facts)));
    } else if (v.flags.alone) parts.push(say(S, v.flags.widowed ? 'fam.widowed' : 'fam.alone', { lostWord: v.sex === 'F' ? 'husband' : 'wife' }, facts));
    else if (R.roommates.length) parts.push(say(S, 'fam.roommates', { roomWords: R.roommates.length === 1 ? 'a roommate' : `${numWord(R.roommates.length)} roommates` }, facts));
    else if (R.relatives.length || R.siblings.length) parts.push(say(S, 'fam.relatives', {}, facts));
  }
  if (R.grandparents.length && v.age >= 18) parts.push(say(S, 'fam.grandparents', gpSlots(S, R.grandparents), facts));
  const abroad = (v.p.concerns || []).find(c => c.topic === 'family abroad');
  if (abroad && v.npc.nativity === 'foreign') {
    const homeland = homelandOf(v.npc.birthplace);
    if (homeland && !/California/.test(homeland)) parts.push(abroadLine(S, homeland));
  }
  if (!parts.filter(Boolean).length) parts.push(say(S, 'fam.alone', {}, facts));
  return { parts, topics: ['family'], ask: 'kids', familyFocus: familyFocus || (R.kids.length ? 'kids' : null) };
};

function gpSlots(S, gps) {
  const g = gps[0];
  const en = g.sex === 'F' ? 'grandmother' : 'grandfather';
  const term = homeWord(S, en, en);
  return { gpWord: term || en, gpEs: g.sex === 'F' ? 'abuela' : 'abuelo', gpPronoun: g.sex === 'F' ? 'She' : 'He' };
}

P.home = (S, u) => {
  const v = S.v, parts = [];
  const facts = [REC.home];
  if (v.relq.guarded) { parts.push(say(S, 'home.guarded')); return { parts, topics: ['housing'], noAsk: true }; }
  const q = u.norm;
  const head = ['householder', 'spouse', 'partner'].includes(v.npc.role) && v.age >= 18;
  const res = v.res || {};
  if (/how long|when did you move|since when|have you always|\b(?:lived|been living|been) (?:here|around here|in town|in the area|in [a-z .']+) (?:long|a long time|for long|for a while|very long)\b/.test(q)) {
    if (res.bornHere) parts.push(say(S, 'about.bornHere', {}, [REC.residence]));
    else parts.push(say(S, 'home.since', {}, facts) || say(S, 'about.years', {}, [REC.residence]));
    if (res.grewUpHere && !res.bornHere) parts.push(say(S, 'about.grewUpCounty', {}, [REC.residence]));
    // the year was just said: how it has changed, without saying it again
    if (!res.bornHere && num(v.P.year - num(res.zipSince, v.P.year)) >= 5) parts.push(say(S, 'hood.change', { zipSince: null }, [REC.residence]));
    return { parts, topics: ['housing', 'history'], ask: 'lives' };
  }
  // "do you live around here?": yes first; "do you like your place?": how they feel about it, first
  if (/\bdo you live (?:out |around |over |up |down |right )?(?:here|there|nearby|close by|close|near here|in (?:town|the area|this area|this neighborhood))\b/.test(q)) parts.push(say(S, 'home.yesHere'));
  if (/\b(?:do you |how do you )?(?:like|love) (?:your|the) (?:house|home|place|apartment|mobile home|trailer)\b/.test(q)) {
    parts.push(say(S, v.flags.apartment ? 'home.feelApt' : v.flags.mobile ? 'home.mobile' : 'home.feelHouse'));
    if (head && v.hh.tenure === 'own' && S.rng.chance(0.5)) parts.push(say(S, 'home.since', {}, [REC.home, REC.residence]));
    return { parts, topics: ['housing'], ask: 'lives' };
  }
  if (/where do you live|where'?s your/.test(q)) parts.push(say(S, 'home.where'));
  // (a spouse who moved in later did not buy the place: the owner did, and their own year follows)
  if (head && v.hh.tenure === 'own') parts.push(joinedLater(v) ? say(S, 'home.ownJoined', ownerWords(v), [REC.home, REC.residence]) : say(S, v.flags.house ? 'home.ownHouse' : v.flags.mobile ? 'home.mobile' : 'home.ownOther', {}, facts));
  else if (head || v.npc.role === 'roommate') parts.push(say(S, 'home.rent', {}, facts));
  else {
    const pw = parentsWords(S);
    parts.push(say(S, 'home.family', { parentsWord: pw ? pw.en : null }, facts));
    if (res.bornHere && v.age >= 13) parts.push(say(S, 'home.childhood', {}, [REC.residence]));
  }
  if (head && S.rng.chance(0.5) && !parts.some(p => p && S.base.yearMoved && p.text.includes(String(S.base.yearMoved)))) parts.push(say(S, 'home.since', {}, [REC.home, REC.residence]));
  if (v.flags.house && head) {
    const roof = v.p.roof;
    if (isNum(v.hh.yearBuilt) && S.rng.chance(0.5)) parts.push(say(S, 'home.built', { yearBuilt: v.hh.yearBuilt }, facts));
    if (roof && !roof.original && isNum(roof.installed)) parts.push(roofLine(S, roof));
    else if (roof && roof.original && num(roof.age) >= 18) parts.push(say(S, 'home.roofOld', {}, ['persona.roof']));
    if (roof && roof.solar) parts.push(say(S, 'home.solar', {}, ['persona.roof']));
  }
  // (a mobile home is said once: "It's a mobile home, but it's ours" needs no second line about the mobile home)
  if (!parts.some(p => p && p.key === 'home.mobile')) parts.push(say(S, v.flags.apartment ? 'home.feelApt' : v.flags.mobile ? 'home.mobile' : 'home.feelHouse'));
  return { parts, topics: ['housing'], ask: 'lives' };
};

P.neighborhood = (S, u) => {
  const v = S.v, parts = [];
  const q = u.norm;
  const census = G.censusFacts(v);
  if (u.entities && u.entities.demographic) {
    // "do a lot of Vietnamese people live here?": the languages heard on the block, the way a neighbor knows them
    const want = u.entities.demographic;
    const lang = want === 'any' ? census.langs.find(l => l.key !== 'english') : census.langs.find(l => l.key === want);
    const shareOf = census.langShare || {};
    if (lang) {
      parts.push(say(S, 'hood.lang', { langName: lang.name, langNameCap: lang.name, share: G.shareWords(lang.share), shareVerbEs: shareVerbEs(lang.share), langEs: LANG_ES[lang.name] }, [lang.id]));
      S.st.used.add(lang.id);
    } else if (want !== 'any' && isNum(shareOf[want])) {
      const name = { spanish: 'Spanish', chinese: 'Chinese', vietnamese: 'Vietnamese', tagalog: 'Tagalog', korean: 'Korean', arabic: 'Arabic' }[want];
      parts.push(say(S, 'hood.langFew', { langName: name, langEs: LANG_ES[name] }, [`acs.lang.${want}`]));
    } else if (isNum(shareOf.english) && shareOf.english >= 0.7) parts.push(say(S, 'hood.langEnglish', {}, ['acs.lang.english']));
    else parts.push(say(S, 'hood.mixed', {}, ['acs.lang']));
    parts.push(say(S, v.flags.urban ? 'hood.urban' : v.flags.rural ? 'hood.rural' : 'hood.suburban', {}, ['acs.density']));
    return { parts, topics: ['neighborhood'], ask: 'lives' };
  }
  if (/safe/.test(q)) parts.push(say(S, 'hood.safe'));
  // a question about crime, danger or a "bad" area is never answered with who lives here: no languages, no heritage
  const crimeQ = /\b(?:crimes?|criminals?|safe|safety|unsafe|dangerous|danger|gangs?|violen\w*|sketchy|rough|shady|bad (?:neighborhood|area|part)|break-?ins?|robber\w*|theft|thieves|stolen)\b/.test(q);
  // "do you like living here?": a yes and what they like; the crowds and the noise are for another question
  const likeQ = /do you like|best|love/.test(q) || !!u.flags.likeIt;
  if (likeQ) parts.push(say(S, 'hood.like'), lex(S, 'prideLines'));
  if (/worst|hate|bad|problem/.test(q)) parts.push(lex(S, 'complaintLines') || say(S, 'hood.like'));
  if (!likeQ) parts.push(say(S, v.flags.urban ? 'hood.urban' : v.flags.rural ? 'hood.rural' : 'hood.suburban', {}, ['acs.density']));
  const lang = crimeQ ? null : census.langs.find(l => l.share >= 0.15 && !S.st.used.has(l.id));
  if (lang && S.rng.chance(0.7)) {
    const p = say(S, 'hood.lang', { langName: lang.name, langNameCap: lang.name, share: G.shareWords(lang.share), shareVerbEs: shareVerbEs(lang.share), langEs: LANG_ES[lang.name] }, [lang.id]);
    if (p) { parts.push(p); S.st.used.add(lang.id); }
  }
  if (census.yb && S.rng.chance(0.4)) parts.push(census.yb.before1940 ? say(S, 'hood.oldPrewar', {}, [census.yb.id]) : say(S, 'hood.old', { decade: census.yb.decade, decadeEs: decadeEs(census.yb.decade) }, [census.yb.id]));
  if (v.lex.values.peak && S.rng.chance(0.4)) parts.push(say(S, 'hood.landmark', { peak: v.lex.values.peak }, [v.lex.facts.peak]));
  if (v.flags.longtime && !v.res.bornHere && isNum(v.res.zipSince) && S.rng.chance(0.5)) parts.push(say(S, 'hood.change', {}, [REC.residence]));
  if (S.rng.chance(0.5)) parts.push(!likeQ && (v.mood.valence < -0.1 || v.big5.A < 0.4) ? lex(S, 'complaintLines') : lex(S, 'prideLines'));
  if (v.lex.values.region && v.lex.values.region !== v.lex.values.place && S.rng.chance(0.25)) parts.push(say(S, 'hood.region', { region: v.lex.values.region }));
  return { parts, topics: ['neighborhood'], ask: 'lives' };
};

/**
 * Past the end of the forecast the NPC has no forecast to quote: the temperature is the world's rough climate
 * estimate (hedged), and the rest is the climate the pack does know (the wettest month, the July average).
 */
function staleWeather(S, W, ahead) {
  const v = S.v, parts = [];
  parts.push(say(S, 'wx.stale', { temp: W.temp }, [W.ids.now]));
  if (ahead) parts.push(say(S, 'wx.noForecast'));
  const C = G.climateFacts(v);
  const wet = isNum(v.z.rain_wet_m) && v.z.rain_wet_m >= 1 && v.z.rain_wet_m <= 12 ? v.z.rain_wet_m : null;
  if (wet && (wet === v.P.month || wet === (v.P.month % 12) + 1)) parts.push(say(S, wet === v.P.month ? 'wx.climate.wetNow' : 'wx.climate.wetNext', { wetMonth: MONTHS[wet - 1], wetMonthEs: MESES[wet - 1] }, ['clim.wetMonth']));
  else if (isNum(C.tjul) && v.P.month >= 6 && v.P.month <= 9) parts.push(say(S, 'wx.climate.tjul', { tjul: Math.round(C.tjul) }, ['clim.tjul']));
  else if (isNum(C.rain)) parts.push(say(S, 'wx.climate.rain', { rainIn: Math.round(C.rain) }, ['clim.rain']));
  return { parts, topics: ['weather'], ask: 'weather', keep: 1 };
}

// "is it going to rain?", "any rain tomorrow?": a question about the forecast's rain (not the climate's)
const RAIN_Q = /\b(rain|raining|rainy|showers?|drizzle|umbrella)\b|\bllover|\blluvia/;
const CLIMATE_RAIN_Q = /\bhow much rain\b|\brain (much|a lot)\b|\b(every|a|per) year\b|\busually\b|\brainy season\b|\bwinters?\b|\bnormally\b/;

/** Alerts not yet told, as parts (marked told). */
function alertsOf(S, W) {
  const alert = W.alerts.find(a => !S.st.used.has(a.id));
  if (!alert) return [];
  S.st.used.add(alert.id);
  return [alert.until ? say(S, 'wx.alert', { alert: alert.event, until: alert.until }, [alert.id]) : say(S, 'wx.alertNoEnd', { alert: alert.event }, [alert.id])];
}

// "Is it always this foggy?": the player's word for the weather, checked against the sky and the thermometer.
const CLAIM_Q = /\b(?:this|so|that|pretty|really|very|too)\s+(foggy|rainy|windy|hot|cold|cloudy|sunny|humid|smoky|chilly|warm|muggy|gray|grey)\b|\b(foggy|rainy|hot|cold|cloudy|humid|smoky|chilly|muggy) (?:today|out|outside|here)\b/;

/** True when the sky and the temperature bear the player's word out, false when they do not, null when they cannot say. */
function claimHolds(word, W) {
  const sky = String(W.short || '').toLowerCase(), t = W.temp;
  switch (word) {
    case 'foggy': return /fog|haze|mist/.test(sky);
    case 'rainy': return /rain|shower|drizzle|storm/.test(sky);
    case 'smoky': return /smoke/.test(sky);
    case 'cloudy': case 'gray': case 'grey': return /cloud|overcast|fog/.test(sky) && !/mostly sunny|mostly clear/.test(sky);
    case 'sunny': return /sun|clear/.test(sky) && !/mostly cloudy/.test(sky);
    case 'hot': return isNum(t) ? t >= 85 : null;
    case 'warm': case 'muggy': case 'humid': return isNum(t) ? t >= 75 : null;
    case 'cold': return isNum(t) ? t <= 52 : null;
    case 'chilly': return isNum(t) ? t <= 60 : null;
    default: return null;
  }
}

P.weather = (S, u) => {
  const v = S.v, W = G.weatherFacts(v), parts = [];
  const q = u.norm;
  const nowFacts = [W.ids.now];
  const aheadQ = u.flags.sub === 'ahead' || /tomorrow|tonight|weekend|forecast|later|will it|going to|this week|thanksgiving/.test(q);
  if (W.stale && !/\bair\b|\bsmog\b|\baqi\b|\bsmoke\b|\bsnow/.test(q)) return staleWeather(S, W, aheadQ);
  if (W.stale) parts.push(say(S, 'wx.stale', { temp: W.temp }, nowFacts));
  else if (W.approx) {
    // a forecast borrowed from a city nearby, carried to this height: an estimate, said as one
    const ce = cieloEs(W.short);
    parts.push(say(S, 'wx.nowApprox', { temp: W.temp, sky: W.sky || G.skyWords(W.short), cieloEs: ce[0] }, nowFacts) || say(S, 'wx.stale', { temp: W.temp }, nowFacts));
  } else {
    const ce = cieloEs(W.short);
    parts.push(say(S, W.sky ? 'wx.now' : 'wx.nowPlain', { temp: W.temp, sky: W.sky, skyAdj: G.skyAdj(W.sky), cieloEs: ce[0] }, nowFacts) || say(S, 'wx.nowPlain', { temp: W.temp }, nowFacts));
  }
  // the player's word for the weather that the sky does not bear out: "Foggy? Not right now. It's 55 and sunny."
  const claim = W.stale ? null : CLAIM_Q.exec(q);
  const claimWord = claim ? claim[1] || claim[2] : null;
  if (claimWord && claimHolds(claimWord, W) === false) {
    const ce = cieloEs(W.short);
    const p = say(S, 'wx.notReally', { claimWord, claimWordCap: capFirst(claimWord), temp: W.tempExact, sky: W.sky || G.skyWords(W.short), cieloEs: ce[0] }, nowFacts);
    if (p) parts.splice(0, parts.length, p);
  }
  if (/\bair\b|\bsmog\b|\baqi\b|\bsmoke\b/.test(q)) {
    const aq = W.alerts.find(a => /air quality|smoke/i.test(a.event));
    const smoke = (v.p.concerns || []).find(c => c.topic === 'smoke');
    const ap = [];
    if (aq) ap.push(say(S, aq.until ? 'wx.alert' : 'wx.alertNoEnd', { alert: aq.event, until: aq.until }, [aq.id]));
    else ap.push(say(S, v.sky === 'smoke' ? 'wx.feel.smoke' : 'wx.airOkay', {}, ['weather.now']));
    if (smoke && smoke.weight >= 0.15) ap.push(say(S, 'wx.airSmoke', {}, ['persona.concerns']));
    return { parts: ap, topics: ['weather', 'fire'], ask: null };
  }
  if (/\bsnow/.test(q) && !/\b(today|now|right now)\b/.test(q)) {
    const C = G.climateFacts(v);
    const sp = [];
    // snowfall where the pack has it; where it does not, the roofs' design snow load says how snowy a place is
    if (isNum(C.snow) && C.snow >= 5) sp.push(say(S, 'wx.climate.snow', { snowIn: Math.round(C.snow) }, ['clim.snow']));
    else if (!isNum(C.snow) && num(C.snowLoad) >= 100) sp.push(say(S, 'wx.climate.snowLoad', { psf: Math.round(C.snowLoad) }, ['clim.snowLoad']));
    else if (!isNum(C.snow) && num(C.snowLoad) >= 30) sp.push(say(S, 'wx.climate.someSnow', {}, ['clim.snowLoad']));
    else sp.push(say(S, 'wx.climate.noSnow', { peak: v.lex.values.peak }, v.lex.values.peak ? [v.lex.facts.peak, 'clim.snow'] : ['clim.snow']));
    if (v.sky === 'snow') sp.push(say(S, 'wx.feel.snow'));
    return { parts: sp, topics: ['weather'], ask: 'weather' };
  }
  const ahead = aheadQ;
  const fc = [];
  const night = W.periods.find(p => !p.isDay && p.when === 'tonight');
  const day = W.periods.find(p => p.isDay && p.when !== 'later today');
  // each forecast period is told once: "what about tomorrow?" after tonight's low gets tomorrow
  // (a city's forecast borrowed for this ZIP is told as that city's: "the forecast for Fresno says ..."; once the city
  // is named, the next forecast sentence takes a hedged variant instead of naming it again)
  const from = W.borrowed ? 'From' : '';
  const fcSlots = W.borrowed ? { fcPlace: W.fcPlace } : {};
  let named = false;
  const fcKey = k => (W.borrowed && !named ? `${k}From` : k);
  const fcHedge = () => (W.borrowed && named ? { _prefer: /\b(?:around|or so|about|probably)\b/i } : {});
  if (night && isNum(night.temp) && !S.st.used.has('fc:tonight')) { const p = say(S, fcKey('wx.tonight'), Object.assign({ low: night.temp, nextSky: night.sky }, fcSlots, fcHedge()), [W.ids.next]); if (p) { p.mark = ['fc:tonight']; fc.push(p); if (/From$/.test(p.key)) named = true; } }
  if (day && isNum(day.temp) && day.sky && !S.st.used.has(`fc:${day.when}`)) {
    const ce = cieloEs(day.sky.replace(/^a (slight )?chance of /, 'chance '));
    const p = say(S, fcKey('wx.next'), Object.assign({ when: day.when, whenCap: capFirst(day.when), nextSky: day.sky, nextSkyAdj: G.skyAdj(day.sky), high: day.temp, nextCieloEs: ce[1], cuandoEs: capFirst(cuandoEs(day.when)), cuandoEsLow: cuandoEs(day.when) }, fcSlots, fcHedge()), [W.ids.next]);
    if (p) { p.mark = [`fc:${day.when}`]; fc.push(p); if (/From$/.test(p.key)) named = true; }
  }
  const wet = W.periods.find(p => isNum(p.pop) && p.pop >= 30);
  // "is it going to rain?": the forecast's answer comes first, yes or no, and a dry forecast says so
  // (a rainy forecast is never answered "no": when its lines are all told, the usual answer follows instead)
  const rainAsked = RAIN_Q.test(q) && !CLIMATE_RAIN_Q.test(q) && W.periods.length > 0;
  const rainKey = !wet ? null : W.borrowed ? (wet.pop >= 70 ? 'wx.rainLikelyFrom' : 'wx.rainChanceFrom') : wet.pop >= 70 ? (rainAsked ? 'wx.rainLikely' : 'wx.rainLikelyFc') : 'wx.rainChance';
  const rainLine = wet ? say(S, rainKey, Object.assign({ pop: wet.pop, when: wet.when, cuandoEs: cuandoEs(wet.when) }, fcSlots), [W.ids.next]) : null;
  if (rainLine) fc.push(rainLine);
  const rainAnswer = rainAsked ? (wet ? rainLine : say(S, `wx.noRain${from}`, fcSlots, [W.ids.next])) : null;
  if (rainAnswer) {
    const rest = fc.filter(p => p && p !== rainLine);
    S.st.cs = wet ? 'weather_rain' : false;
    return { parts: [rainAnswer, ...rest.slice(0, 1), ...alertsOf(S, W)], topics: ['weather'], ask: 'weather', keep: 2 };
  }
  // a headline or a sentence that opens with a name goes after "I saw the forecast." (keyMsg is null then)
  if (W.key && S.rng.chance(ahead ? 0.7 : 0.35)) fc.push(say(S, 'wx.keyMsg', { keyMsg: W.keyLower, keyMsgCap: W.key }, [W.ids.key]));
  const alert = W.alerts.find(a => !S.st.used.has(a.id));
  const alertParts = [];
  if (alert) {
    alertParts.push(alert.until ? say(S, 'wx.alert', { alert: alert.event, until: alert.until }, [alert.id]) : say(S, 'wx.alertNoEnd', { alert: alert.event }, [alert.id]));
    alertParts.push(alert.coastal ? say(S, 'wx.coastalAlert') : say(S, 'wx.alertFeel'));
    S.st.used.add(alert.id);
  }
  const feel = [];
  const cond = W.cond || (/cloud|overcast/i.test(String(W.short)) ? 'cloudy' : null);
  if (cond && S.rng.chance(0.6)) feel.push(lex(S, 'weather') || say(S, `wx.feel.${cond}`));
  else if (cond) feel.push(say(S, `wx.feel.${cond}`));
  if (W.fireOutlook) feel.push(say(S, 'wx.fireOutlook', { fireOutlook: W.fireOutlook }, [W.ids.fire]));
  const climate = [];
  if (claimWord === 'foggy' && /always|usually|typical|normal|every|a lot|much/.test(q)) {
    const C = G.climateFacts(v);
    // the marine layer: the coast with a cool July is where the summer fog is
    if (v.flags.coast && isNum(C.tjul) && C.tjul < 76) climate.push(say(S, 'wx.climate.fog', {}, ['clim.tjul']));
  }
  if (/always|usually|typical|normal|summer|winter|every year|year round|year-round/.test(q)) {
    const C = G.climateFacts(v);
    if (isNum(C.tjul)) climate.push(say(S, 'wx.climate.tjul', { tjul: Math.round(C.tjul) }, ['clim.tjul']));
    if (isNum(C.rain)) climate.push(say(S, 'wx.climate.rain', { rainIn: Math.round(C.rain) }, ['clim.rain']));
    if (isNum(C.snow) && C.snow >= 10) climate.push(say(S, 'wx.climate.snow', { snowIn: Math.round(C.snow) }, ['clim.snow']));
  }
  const again = (S.st.depth.weather || 0) > 0 && !/\b(today|now|right now|outside)\b/.test(q);
  if (again && !climate.length) {
    const C = G.climateFacts(v);
    if (isNum(C.tjul)) climate.push(say(S, 'wx.climate.tjul', { tjul: Math.round(C.tjul) }, ['clim.tjul']));
    if (isNum(C.rain)) climate.push(say(S, 'wx.climate.rain', { rainIn: Math.round(C.rain) }, ['clim.rain']));
  }
  const climateQ = /always|usually|typical|normal|summer|winter|every year|year round|year-round/.test(q);
  // "how cold does it get?": a winter's morning, as the climate estimate has it, ahead of tonight's low
  if (/\bhow cold\b|\bget (really )?cold\b|\bcold (in|does it get)\b|\bwinters?\b/.test(q) && !/\bsummer/.test(q)) {
    const wf = G.winterFacts(v);
    if (wf) climate.unshift(say(S, 'wx.climate.winter', { winterLow: wf.low, winterHigh: wf.high }, [wf.id]));
    const C = G.climateFacts(v);
    if (isNum(C.snow) && C.snow >= 5) climate.push(say(S, 'wx.climate.snow', { snowIn: Math.round(C.snow) }, ['clim.snow']));
    else if (!isNum(C.snow) && num(C.snowLoad) >= 30) climate.push(say(S, 'wx.climate.someSnow', {}, ['clim.snowLoad']));
    for (let i = climate.length - 1; i >= 0; i--) if (climate[i] && /^wx\.climate\.tjul$/.test(climate[i].key)) climate.splice(i, 1);
    if (wf) { parts.splice(0, parts.length); parts.push(...climate, ...fc.slice(0, 1)); S.st.cs = 'weather_cold'; return { parts, topics: ['weather'], ask: 'weather', keep: 2 }; }
  }
  if (again) { parts.splice(0, parts.length); if (climateQ) parts.push(...climate, ...fc, ...alertParts, ...feel); else parts.push(...fc, ...alertParts, ...climate, ...feel); if (!parts.filter(Boolean).length) parts.push(say(S, 'wx.nowPlain', { temp: W.temp }, nowFacts)); }
  else if (ahead && fc.filter(Boolean).length) { const now = parts.splice(0, parts.length); parts.push(...fc, ...alertParts, ...now.slice(0, 1), ...feel); }
  else if (ahead) parts.push(...alertParts, ...feel);
  else if (climate.length) parts.push(...climate, ...alertParts, ...feel);
  else parts.push(...alertParts, ...feel, ...fc);
  S.st.cs = cond === 'heat' ? 'weather_hot' : cond === 'cold' ? 'weather_cold' : cond === 'rain' ? 'weather_rain' : false;
  return { parts, topics: ['weather'], ask: 'weather', keep: 1 };
};

/** Commute and road talk. */
P.traffic = (S, u) => {
  const v = S.v, parts = [];
  const roads = G.roadFacts(v);
  const c = v.commute || {};
  const mode = c.mode;
  const commuteRoad = roads.find(r => r.commute) || null;
  const mainRoad = roads[0] || null;
  const rd = r => ({ road: r.name, roadEs: roadEs(r.name), roadQ: r.name });
  // follow-ups: which road, what time they leave
  const sub = u.flags && u.flags.sub;
  if (sub === 'which' && v.age >= 16 && (commuteRoad || mainRoad)) {
    const r = commuteRoad || mainRoad;
    return { parts: [say(S, commuteRoad && ['drive', 'carpool', 'motorcycle', 'taxi'].includes(mode) ? 'tr.whichMine' : 'tr.which', rd(r), [r.id])], topics: ['traffic'], ask: null };
  }
  if (sub === 'car') {
    if (v.age < 16) return { parts: [say(S, 'tr.teenDrive')], topics: ['traffic'], ask: null };
    if (num(v.hh.vehicles, 1) === 0) return { parts: [say(S, 'tr.noCar', {}, [REC.home])], topics: ['traffic'], ask: null };
    return { parts: [say(S, v.speaker.drives === true ? 'tr.car' : 'tr.carShared', {}, [REC.home])], topics: ['traffic'], ask: 'drive' };
  }
  if (sub === 'farWork') {
    const work = c.work && isNum(c.work.x) ? c.work : null;
    if (v.flags.wfh) return { parts: [say(S, v.flags.onFarm ? 'job.onFarm' : 'job.wfh', {}, [REC.commute])], topics: ['traffic'], ask: null };
    if (!work || !isNum(c.minutes) || !c.minutes) return { parts: [say(S, v.flags.retired ? 'tr.retired' : 'job.notWorking', mainRoad ? rd(mainRoad) : {}, mainRoad ? [mainRoad.id] : ['npc.status'])].filter(Boolean), topics: ['traffic'], ask: null };
    const R = G.routeTo(v, work);
    const school = v.npc.school && v.age < 18;
    return { parts: [say(S, school ? 'tr.farSchool' : 'tr.farWork', { miles: R.miles, milesEs: millasEs(R.miles), commuteMin: c.minutes, workCity: c.workCity && c.workCity !== v.z.city ? c.workCity : null }, [REC.commute])], topics: ['traffic'], ask: 'drive' };
  }
  if (sub === 'hours' && v.flags.commuter && isNum(c.departMin)) {
    return { parts: [say(S, 'tr.leave', { departClock: clockSaid(c.departMin), departClockEs: clockSaidEs(c.departMin), commuteMin: c.minutes }, [REC.commute])], topics: ['traffic'], ask: null };
  }
  // "is it hard to get around without a car?": how they get around, from the household's cars and their own driving
  if (/\bget(ting)? around\b|\bwithout (a car|driving|wheels)\b|\bpublic transit\b|\bpublic transportation\b/.test(u.norm || '') && !u.entities.roads.length) {
    const cars = num(v.hh.vehicles, 1);
    const first = v.age < 18 ? (kidRide(S) || say(S, 'tr.getAroundRide', {}, [REC.home]))
      : cars === 0 ? say(S, 'tr.noCar', {}, [REC.home]) : v.speaker.drives === true ? say(S, 'tr.getAroundDrive', {}, [REC.home]) : say(S, 'tr.getAroundRide', {}, [REC.home]);
    const gp = [first];
    const M = G.censusFacts(v).modes;
    const transit = M.bus && M.rail ? { share: M.bus.share + M.rail.share, id: M.rail.share > M.bus.share ? M.rail.id : M.bus.id, rail: M.rail.share > M.bus.share } : null;
    if (transit && transit.share >= 0.1 && !S.st.used.has('acs.comm')) {
      const t = transitWord(v, transit.rail ? 'rail' : 'bus');
      gp.push(say(S, 'tr.transitShare', { share: G.shareWords(transit.share), transit: t.en }, [transit.id]));
      S.st.used.add('acs.comm');
    }
    S.st.cs = false;
    return { parts: gp, topics: ['traffic'], ask: 'drive' };
  }
  // a road the player named
  if (u.entities.roads.length) {
    const want = u.entities.roads[0];
    const near = v.world.roadsNear(v.home.x, v.home.y, 25).find(r => r.route === want.route && (!want.kind || r.kind === want.kind));
    if (near) {
      const name = G.localRoad(v, near);
      parts.push(say(S, 'tr.roadQueryNear', { roadQ: name, roadQEs: roadEs(name) }, [`road:${near.name}`]));
      const aadt = G.aadtWords(near.aadt);
      if (aadt) parts.push(say(S, 'tr.road', { road: name, roadEs: roadEs(name), aadt, aadtEs: approxEs(approx(near.aadt)) }, [`road:${near.name}`, `aadt:${near.name}`]));
      parts.push(say(S, 'tr.roadFeel', { road: name, roadEs: roadEs(name) }, [`road:${near.name}`]));
      return { parts, topics: ['traffic'], ask: 'drive', keep: 1 };
    }
    const any = v.world.roads.find(r => r.r === want.route && (!want.kind || r.kind === want.kind));
    if (any) {
      const name = G.localRoad(v, { name: any.name, route: any.r, kind: any.kind });
      parts.push(say(S, 'tr.roadQueryFar', { roadQ: name, roadQEs: roadEs(name) }, [`road:${any.name}`]));
    }
  }
  const trafficAgain = (S.st.depth.traffic || 0) > 0;
  let teenRide = null;
  if (trafficAgain) {
    // already told about their own commute: the big road, a named stretch, how the neighbors get around
  } else if (v.age < 13) {
    parts.push(kidRide(S) || say(S, 'tr.kid'));
  } else if (v.age < 16) {
    parts.push(kidRide(S) || say(S, 'tr.teenDrive'));
  } else if (v.age < 18 && !v.flags.commuter && (teenRide = kidRide(S))) {
    parts.push(teenRide);
  } else if (v.flags.wfh && mainRoad) {
    parts.push(say(S, v.flags.onFarm ? 'tr.onFarm' : 'tr.wfh', rd(mainRoad), [mainRoad.id, REC.commute]));
  } else if (v.flags.commuter) {
    const min = c.minutes, workCity = c.workCity && c.workCity !== v.z.city ? c.workCity : null;
    // a student's trip is to school and a service member's to the base: no line about "work" for them
    const school = v.npc.status === 'student', base = v.npc.status === 'military';
    const notWork = school || base ? { _avoid: /\b(?:work|job|office)\b|\btrabaj/i } : {};
    if (['drive', 'taxi', 'motorcycle'].includes(mode) || (mode === 'carpool')) {
      if (mode === 'carpool' && workCity) parts.push(say(S, 'tr.carpool', { workCity, commuteMin: min }, [REC.commute]));
      else if (mode === 'carpool') parts.push(say(S, 'tr.carpoolLocal', Object.assign({ commuteMin: min }, notWork), [REC.commute]) || say(S, 'tr.driveTown', Object.assign({ commuteMin: min }, notWork), [REC.commute]));
      else if (mode === 'motorcycle' && workCity) parts.push(say(S, 'tr.motorcycle', { workCity, commuteMin: min }, [REC.commute]));
      // a highway named as the way to work only when the record has one: never a road that does not serve the trip
      else if (workCity && commuteRoad) parts.push(say(S, 'tr.drive', Object.assign({ workCity, commuteMin: min }, rd(commuteRoad)), [commuteRoad.id, REC.commute]));
      else if (workCity) parts.push(say(S, 'tr.driveTo', Object.assign({ workCity, commuteMin: min }, notWork), [REC.commute]));
      // "work's close" only when it is: a half-hour drive across town is not a short one
      else parts.push(say(S, num(min, 0) <= 20 ? 'tr.driveLocal' : 'tr.driveTown', Object.assign({ commuteMin: min }, notWork), [REC.commute]));
    } else if (['bus', 'rail', 'ferry'].includes(mode)) {
      const t = transitWord(v, mode);
      parts.push(say(S, 'tr.transit', { transit: t.en, transitCap: capFirst(t.en), transitEs: t.es, workCity: workCity || (school ? 'school' : base ? 'the base' : 'work'), commuteMin: min }, [REC.commute]));
    } else if (mode === 'bike') parts.push(say(S, 'tr.bike', { commuteMin: isNum(min) && min <= 75 ? min : null }, [REC.commute]));
    else if (mode === 'walk') parts.push(say(S, 'tr.walk', { commuteMin: isNum(min) && min <= 50 ? min : null }, [REC.commute]));
  } else if (v.flags.retired && mainRoad) {
    parts.push(say(S, 'tr.retired', rd(mainRoad), [mainRoad.id]));
  } else if (num(v.hh.vehicles, 1) === 0) {
    parts.push(say(S, 'tr.noCar', {}, [REC.home]));
  } else parts.push(say(S, 'tr.nonDriver'));
  // the big road nearby, as locals say it, with its traffic count (a kid on the way to school has no use for it)
  const mentioned = parts.filter(Boolean).some(p => roads.some(r => p.text.includes(r.name) || (p.gloss || '').includes(r.name)));
  // the road that matters most near home, by its own traffic over its own distance (ground.roadScore)
  const big = v.age >= 16 ? roads.filter(r => r.aadt && !r.commute).sort((a, b) => G.roadScore(b) - G.roadScore(a))[0] || roads.find(r => r.aadt) || mainRoad : null;
  if (big && (!mentioned || trafficAgain || S.rng.chance(0.5)) && !(trafficAgain && S.st.used.has(`aadt:${big.road.name}`))) {
    S.st.used.add(`aadt:${big.road.name}`);
    const aadt = G.aadtWords(big.aadt);
    // you can hear a freeway from your street only when it runs a few blocks away, and it is "the main way in and out"
    // only within a few miles; one farther out is the nearest highway, that far off
    const far = !isNum(big.distKm) || big.distKm > 5;
    const roadKey = isNum(big.distKm) && big.distKm <= 1.2 ? 'tr.roadNear' : far ? 'tr.roadFar' : 'tr.road';
    const rs = Object.assign({ aadt, aadtEs: aadt ? approxEs(approx(big.aadt)) : null, roadDist: isNum(big.distKm) ? G.miles(big.distKm) : null, roadDistEs: isNum(big.distKm) ? millasEs(G.miles(big.distKm)) : null }, rd(big));
    const facts = aadt ? [big.id, `aadt:${big.road.name}`] : [big.id];
    parts.push(far ? say(S, aadt ? 'tr.roadFar' : 'tr.roadFarSmall', rs, facts)
      : aadt ? (say(S, roadKey, rs, facts) || say(S, 'tr.road', rs, facts)) : say(S, 'tr.roadSmall', rs, facts));
  }
  if ((v.lang.mode === 'en' || v.lang.mode === 'es') && v.age >= 16 && v.speaker.drives === true && S.rng.chance(0.55)) {
    const r = commuteRoad || big || mainRoad;
    parts.push(r ? lex(S, 'traffic', { road: r.name }, { road: r.id }) : lex(S, 'traffic'));
  }
  const stretch = (commuteRoad && commuteRoad.stretch) || (big && big.stretch);
  if (stretch && v.age >= 16 && S.rng.chance(trafficAgain ? 0.8 : 0.4)) parts.push(say(S, 'tr.stretch', { stretch }, [`stretch:${stretch}`]));
  if (trafficAgain && v.age >= 16 && S.rng.chance(0.5)) { const r = big || mainRoad; parts.push(say(S, 'op.traffic', { road: r ? r.name : null }, r ? [r.id] : [])); }
  // how the neighbors get to work, once per conversation
  if (!S.st.used.has('acs.comm') && S.rng.chance(0.35)) {
    const M = G.censusFacts(v).modes;
    const transit = M.bus && M.rail ? { share: M.bus.share + M.rail.share, id: M.rail.share > M.bus.share ? M.rail.id : M.bus.id, rail: M.rail.share > M.bus.share } : null;
    if (transit && transit.share >= 0.1) {
      const t = transitWord(v, transit.rail ? 'rail' : 'bus');
      parts.push(say(S, 'tr.transitShare', { share: G.shareWords(transit.share), transit: t.en }, [transit.id]));
      S.st.used.add('acs.comm');
    } else if (M.wfh && M.wfh.share >= 0.2) {
      parts.push(say(S, 'tr.wfhShare', { share: G.shareWords(M.wfh.share) }, [M.wfh.id]));
      S.st.used.add('acs.comm');
    }
  }
  if ((v.age >= 16 && S.rng.chance(0.3)) || !parts.filter(Boolean).length) parts.push(say(S, 'tr.feel') || say(S, 'op.traffic', { road: mainRoad ? mainRoad.name : null }, mainRoad ? [mainRoad.id] : []));
  // "the traffic was horrible" goes with a complaint that is said, or a long drive; never before "work's close"
  S.st.cs = 'traffic_bad';
  const csWith = num(c.minutes, 0) >= 45 ? /^(tr\.(feel|roadFeel|stretch|drive)|op\.traffic|lex:traffic)$/ : /^(tr\.(feel|roadFeel|stretch)|op\.traffic|lex:traffic)$/;
  return { parts, topics: ['traffic'], ask: 'drive', keep: 1, csWith };
};

function roadEs(name) {
  const n = String(name || '');
  if (/^PCH$/.test(n)) return 'la PCH';
  if (/^Pacific Coast Highway$/.test(n)) return 'la Pacific Coast Highway';
  const m = /(\d{1,3})/.exec(n);
  if (/Freeway|Nimitz|Bayshore|Eastshore|MacArthur|toll road/.test(n)) return m ? `la ${m[1]}` : `la ${n.replace(/^the /, '')}`;
  return m ? `la ${m[1]}` : n.replace(/^the /, 'la ');
}

function transitWord(v, mode) {
  const words = v.D && v.D.words ? Object.entries(v.D.words).filter(([, w]) => w.kind === 'transit').map(([k]) => k) : [];
  if (mode === 'rail') {
    const rail = words.find(w => /BART|Caltrain|Metrolink|Coaster|light rail|the Metro|Muni|ACE|Sprinter|trolley|Expo/i.test(w));
    // the Spanish takes its article from the line ("Tomo el {transitEs}"), so the name carries none
    if (rail) return { en: /^the /i.test(rail) || /^(BART|Caltrain|Metrolink|Muni|ACE)$/.test(rail) ? rail : `the ${rail}`, es: rail.replace(/^the /i, '') };
    return { en: 'the train', es: 'tren' };
  }
  if (mode === 'ferry') return { en: 'the ferry', es: 'ferry' };
  return { en: 'the bus', es: 'autobús' };
}

function kidRide(S) {
  const v = S.v, c = v.commute || {};
  if (!v.npc.school || v.npc.school === 'college') return null;
  if (c.mode === 'walk') return say(S, 'tr.kidWalk', { commuteMin: isNum(c.minutes) && c.minutes > 0 && c.minutes <= 40 ? c.minutes : null }, [REC.commute]);
  if (c.mode === 'bus') return say(S, 'tr.kidBus', {}, [REC.commute]);
  if (c.mode === 'bike') return say(S, 'tr.kidBike', { commuteMin: isNum(c.minutes) && c.minutes > 0 && c.minutes <= 60 ? c.minutes : null }, [REC.commute]);
  const ride = v.routine && v.routine.ride;
  const driver = ride && Number.isInteger(ride.driver) ? (v.npc.household.members || []).find(m => m.m === ride.driver) : null;
  if (driver) {
    const rel = v.rel.parents.find(p => p.m === driver.m) ? (driver.sex === 'F' ? 'mom' : 'dad')
      : v.rel.grandparents.find(p => p.m === driver.m) ? (driver.sex === 'F' ? 'grandma' : 'grandpa')
        : v.rel.siblings.find(p => p.m === driver.m) ? (driver.sex === 'F' ? 'sister' : 'brother') : null;
    if (rel) {
      const es = { mom: 'mamá', dad: 'papá', grandma: 'abuela', grandpa: 'abuelo', sister: 'hermana', brother: 'hermano' }[rel];
      return say(S, 'tr.kidRide', { driverWord: rel, driverEs: es }, [REC.commute]);
    }
  }
  return null;
}

P.fire = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  const fires = G.fireFacts(v);
  const W = G.weatherFacts(v);
  const depth = st.depth.fire || 0;
  if (v.age < 10) {
    const pw = parentsWords(S);
    const f = G.mainFire(v, fires);
    if (depth > 0) { parts.push(say(S, 'fire.kidMore', { parentWord: pw ? pw.en : 'mom', parentEs: pw ? pw.es : 'mi mamá' })); return { parts, topics: ['fire'], noAsk: true }; }
    if (f && f.lived) parts.push(say(S, 'fire.livedChild', fireSlots(f), [f.id]));
    else if (f) parts.push(say(S, 'fire.kid', { parentWord: pw ? pw.en : 'mom', parentEs: pw ? pw.es : 'mi mamá' }, [f.id]));
    else parts.push(say(S, 'fire.none'));
    return { parts, topics: ['fire'], noAsk: true };
  }
  const named = u.entities.fires.length ? fires.find(f => u.entities.fires.some(x => x.name === f.name)) : null;
  // follow-ups on the fire just talked about: which one it was, and what it did to them
  const sub = u.flags && u.flags.sub;
  const last = fires.filter(f => st.used.has(f.id));
  if (sub === 'which' && last.length) {
    const f = last[last.length - 1];
    return { parts: [say(S, 'fire.which', fireSlots(f), [f.id])], topics: ['fire'], ask: null };
  }
  if (sub === 'impact') {
    const f = named || last.find(x => x.memory && x.memory.experience) || G.mainFire(v, fires);
    if (f && f.memory && f.memory.experience && v.lang.mode === 'en' && !st.usedMemories.has(f.memory.source)) {
      st.usedMemories.add(f.memory.source);
      st.used.add(f.id);
      return { parts: [withMem(say(S, 'fire.impact', Object.assign({ exp: f.memory.experience }, fireSlots(f)), [f.id, 'persona.memory']), f.memory)], topics: ['fire'], ask: 'fire', emotion: 'wistful', keep: 2 };
    }
    if (f && f.before) return { parts: [say(S, 'fire.beforeMe', fireSlots(f), [f.id, REC.residence])], topics: ['fire'], ask: null };
  }
  const unused = fires.filter(f => !st.used.has(f.id));
  const f = named || (depth === 0 ? G.mainFire(v, fires) : null) || unused.find(x => x.memory) || unused[0] || null;
  if (f) {
    st.used.add(f.id);
    const slots = fireSlots(f);
    const ageThen = f.year - (v.npc.birthYear || (v.P.year - v.age));
    const here = f.destInZip > 0 || f.pct > 0 || f.km <= 1;
    const childMemory = f.memory && ageThen < 18;
    const exp = f.memory && f.memory.experience && v.lang.mode === 'en' ? f.memory.experience : null;
    // their own words follow; when those already say "I remember", the line before does not
    const remember = (exp && /\bI remember\b/i.test(exp) ? 'fire.named' : 'fire.remember') + (here ? '' : 'Away');
    // the memory of the fire is told here: the history planner does not tell it again
    if (childMemory && !exp) parts.push(withMem(say(S, ageThen < 10 ? 'fire.livedChild' : 'fire.livedTeen', Object.assign({ ageThen }, slots), [f.id]), f.memory));
    else if (childMemory) parts.push(withMem(say(S, remember, slots, [f.id]), f.memory));
    else if (f.memory && f.lived && here) parts.push(withMem(say(S, 'fire.lived', slots, [f.id]), f.memory));
    else if (f.memory || !f.before) parts.push(withMem(say(S, remember, slots, [f.id]), f.memory));
    // (a small fire before their time is not one "people still talk about")
    else parts.push(say(S, 'fire.before', Object.assign({}, slots, f.destInZip >= 10 || f.acres >= 1000 ? {} : { _avoid: /still talk|still see where/i }), [f.id]));
    if (exp) parts.push({ text: exp, gloss: null, facts: ['persona.memory'], key: 'memory', mem: f.memory.source });
    if (f.destInZip > 0) parts.push(say(S, f.lived ? 'fire.toll' : 'fire.tollThere', slots, [f.id]));
    else if (!here && f.km < 60) parts.push(say(S, 'fire.distance', slots, [f.id]));
    else if (f.acres > 0 && !parts.some(p => p && slots.acres && p.text.includes(slots.acres))) parts.push(say(S, 'fire.size', slots, [f.id]));
    const other = fires.find(x => x !== f && !st.used.has(x.id) && (x.destInZip > 0 || x.acres >= 5000));
    if (other && S.rng.chance(depth > 0 ? 0.7 : 0.35)) { parts.push(say(S, 'fire.other', fireSlots(other), [other.id])); st.used.add(other.id); }
  } else {
    const near = G.nearestFire(v);
    if (near && isNum(near.km) && !st.used.has(near.id)) { parts.push(say(S, 'fire.near', { fire: near.label, fireEs: fireEs(near.label.replace(/^the /, '')), year: near.year, miles: G.miles(near.km) }, [near.id])); st.used.add(near.id); }
    else if (depth > 0) parts.push(say(S, 'fire.nothingMore'));
    // a fire the records name only by a number or a code is still a fire: never "fire's not a thing here"
    else if (v.world.firesOf(v.zi).length || v.z.fire_near) parts.push(say(S, 'fire.unnamed'));
    else parts.push(say(S, 'fire.none'));
  }
  const hz = G.hazardWords(num(v.z.fhsz_vh));
  if (hz && !st.used.has('fhsz') && (depth > 0 || S.rng.chance(0.4))) {
    const es = { 'nearly all of': 'Casi todo', 'most of': 'La mayor parte de', 'about half of': 'Como la mitad de', 'a good part of': 'Una buena parte de', 'some of': 'Parte de' }[hz];
    parts.push(say(S, 'fire.zone', { hazard: hz, hazardEs: es }, ['fhsz']));
    st.used.add('fhsz');
  }
  if (v.offshore) parts.push(say(S, 'fire.offshore', { offName: { santa_ana: 'Santa Ana', diablo: 'Diablo', sundowner: 'sundowner' }[v.offshore], offEs: { santa_ana: 'vientos de Santa Ana', diablo: 'vientos del Diablo', sundowner: 'vientos sundowner' }[v.offshore] }, ['weather.next']));
  const fa = W.alerts.find(a => a.fire);
  if (fa) parts.push(say(S, 'fire.alert', { alert: fa.event }, [fa.id]));
  const concern = (v.p.concerns || []).find(c => c.topic === 'fire' || c.topic === 'smoke');
  if (v.flags.fireZone || (concern && concern.weight >= 0.3)) parts.push(say(S, depth > 0 ? 'fire.prep' : (S.rng.chance(0.5) ? 'fire.feel' : 'fire.prep')));
  else if ((v.p.concerns || []).some(c => c.topic === 'smoke') && S.rng.chance(0.5)) parts.push(say(S, 'fire.smoke'));
  st.cs = f && (f.destInZip > 0 || f.memory) ? 'frustration' : false;
  const worried = concern && concern.weight >= 0.5;
  return { parts, topics: ['fire'], ask: 'fire', emotion: worried ? 'worried' : null, keep: f && f.memory ? 2 : 1 };
};

function fireSlots(f) {
  return {
    fire: f.label, fireEs: fireEs(f.name), year: f.year, month: f.month, when: monthYear(f.dt), mesAnoEs: mesAno(f.dt),
    dest: G.destWords(f.destInZip), destEs: approxEs(G.destWords(f.destInZip) || '').replace(/homes and buildings/, 'casas y edificios').replace(/^(one|two|three|four|five|six|seven|eight|nine) /, ''),
    acres: G.acresWords(f.acres), acresEs: approxEs(G.acresWords(f.acres) || ''),
    miles: G.miles(f.km), milesEs: millasEs(G.miles(f.km)),
  };
}

P.storm = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  const q = u.norm;
  const W = G.weatherFacts(v);
  const C = G.climateFacts(v);
  const rec = G.recordFacts(v);
  if (/wind|santa ana|diablo|gust/.test(q)) {
    // the offshore wind they asked about, as it is here: the Santa Anas in the south, the Diablo winds in the Bay Area
    const off = v.z.off_kind || '';
    const askedSa = /santa ana/.test(q), askedDi = /diablo/.test(q);
    if ((askedSa && off !== 'sa') || (askedDi && off !== 'di')) {
      parts.push(say(S, off === 'sa' ? 'storm.offshoreSa' : off === 'di' ? 'storm.offshoreDi' : 'storm.noOffshore', { offAsked: askedSa ? 'the Santa Anas' : 'the Diablo winds', offAskedCap: askedSa ? 'The Santa Anas' : 'The Diablo winds' }, ['clim.offKind']));
    }
    // a county's windstorm peaked somewhere in it: the gust is said with the place it was measured, and only when that
    // place is near enough to count as theirs; never as if it blew here (the ZIP's own record is a separate fact)
    const winds = G.windFacts(v).filter(x => !st.used.has(x.id) && isNum(x.gust));
    const wantKind = askedSa ? 'santa_ana' : askedDi ? 'diablo' : null;
    const w = (wantKind && winds.find(x => x.kind === wantKind)) || winds.find(x => isNum(x.km) && x.km <= 120) || winds[0];
    if (w) {
      const windWhere = w.where && isNum(w.km) && w.km <= 120 ? wherePhrase(w.where) || null : null;
      const slots = {
        windName: w.name.replace(/^the /, ''), windNameCap: capFirst(w.name), when: monthYear(w.dt), gust: w.gust, windWhere, mesAnoEs: mesAno(w.dt),
        windEs: { santa_ana: 'vientos de Santa Ana', diablo: 'vientos del Diablo', sundowner: 'vientos sundowner', mono: 'vientos Mono', winter: 'vientos del temporal', other: 'vientos' }[w.kind] || 'vientos',
        windWhereEs: windWhere && /^near /.test(windWhere) ? windWhere.replace(/^near /, 'cerca de ') : null,
      };
      const exp = w.memory && w.memory.experience && v.lang.mode === 'en' ? w.memory.experience : null;
      const lived = exp ? say(S, 'storm.windLived', Object.assign({ exp }, slots), [w.id, 'persona.memory']) : null;
      if (lived) { parts.push(lived); if (w.memory.source) st.usedMemories.add(w.memory.source); }
      // after their own memory of it, the gust and where it blew, without saying the date again
      if (lived && slots.windWhere) parts.push(say(S, 'storm.windGust', slots, [w.id]));
      else if (!lived) parts.push((slots.windWhere ? say(S, 'storm.wind', slots, [w.id]) : null) || say(S, 'storm.windCounty', slots, [w.id]));
      st.used.add(w.id);
    }
    if (rec.gust && !st.used.has(rec.gust.id)) { parts.push(say(S, rec.gust.local ? 'storm.gustRecord' : 'storm.gustRecordAt', Object.assign({ gust: rec.gust.value, when: monthYear(rec.gust.dt), mesAnoEs: mesAno(rec.gust.dt) }, stationSlots(rec.gust)), [rec.gust.id])); st.used.add(rec.gust.id); }
    // a question about the wind is answered about the wind
    if (parts.filter(Boolean).length) {
      if (S.rng.chance(0.4)) parts.push(say(S, 'storm.prep'));
      return { parts, topics: ['weather'], ask: 'weather' };
    }
  }
  const ar = G.arFacts(v).filter(a => !st.used.has(a.id)).sort((a, b) => (b.memory ? 1 : 0) - (a.memory ? 1 : 0) || b.rank - a.rank || (b.start > a.start ? 1 : -1))[0];
  if (ar && (C.ar === null || C.ar >= 1)) {
    st.used.add(ar.id);
    // a river is a landfall event: it peaked somewhere on the coast ("a category 5 at Point Reyes"), and it is "a
    // category N here" only for the rank it had here (never above the ZIP's own strongest, ar_max)
    const peaked = ar.peakRank > ar.rank;
    const arSlots = { when: partOfMonth(ar.dt), whenCap: capFirst(partOfMonth(ar.dt)), rank: ar.rank, peakRank: ar.peakRank, peakAt: ar.peakAt, mesAnoEs: mesAno(ar.dt) };
    if (ar.memory && ar.memory.experience && v.lang.mode === 'en') {
      parts.push(withMem(say(S, 'storm.arLived', { when: monthYear(ar.dt), exp: ar.memory.experience }, [ar.id, 'persona.memory']), ar.memory));
      parts.push(say(S, peaked ? (ar.peakAt ? 'storm.arPeakAfter' : 'storm.arPeakCoastAfter') : 'storm.arRank', arSlots, [ar.id]));
    } else if (peaked) {
      parts.push(say(S, ar.peakAt ? 'storm.arPeak' : 'storm.arPeakCoast', arSlots, [ar.id]));
      parts.push(dependent(say(S, 'storm.arHere', arSlots, [ar.id])));
    } else parts.push(say(S, 'storm.ar', arSlots, [ar.id]));
  }
  const fema = G.femaFacts(v).storms.filter(f => !st.used.has(f.id))[0];
  if (fema && fema.title) {
    st.used.add(fema.id);
    const title = G.femaTitle(fema.title);
    // after another storm they lived through, the next one is told as "then", not as another "I remember"
    const after = parts.some(p => p && p.mem);
    if (fema.memory && fema.memory.experience && v.lang.mode === 'en') parts.push(withMem(say(S, after ? 'storm.femaLivedThen' : 'storm.femaLived', { title, exp: fema.memory.experience }, [fema.id, 'persona.memory']), fema.memory));
    else parts.push(say(S, 'storm.fema', { title, femaEs: femaEs(fema) }, [fema.id]));
  }
  if (rec.rain && !st.used.has(rec.rain.id) && S.rng.chance(0.5)) { parts.push(withMem(say(S, rec.rain.local ? 'storm.rainRecord' : 'storm.rainRecordAt', Object.assign({ rainRec: rec.rain.value, when: monthYear(rec.rain.dt), mesAnoEs: mesAno(rec.rain.dt) }, stationSlots(rec.rain)), [rec.rain.id]), rec.rain.memory)); st.used.add(rec.rain.id); }
  if (isNum(C.flood) && C.flood >= 10 && !st.used.has('clim.flood')) {
    const words = C.flood >= 100 ? 'more than a hundred' : C.flood >= 24 ? 'dozens of' : 'a fair number of';
    parts.push(say(S, 'storm.flood', { floodWords: words }, ['clim.flood']));
    st.used.add('clim.flood');
  }
  if (isNum(C.rain) && C.rain < 8 && !parts.filter(Boolean).length) parts.push(say(S, 'storm.dry', { rainIn: Math.round(C.rain) }, ['clim.rain']));
  const wet = W.periods.find(p => isNum(p.pop) && p.pop >= 30);
  if (wet) parts.push(say(S, 'storm.now', { when: wet.when, cuandoEs: cuandoEs(wet.when) }, [W.ids.next]));
  const fa = W.alerts.find(a => a.flood || a.winter || a.coastal);
  if (fa && !st.used.has(fa.id)) { parts.push(say(S, fa.until ? 'wx.alert' : 'wx.alertNoEnd', { alert: fa.event, until: fa.until }, [fa.id])); st.used.add(fa.id); }
  if (S.rng.chance(0.4)) parts.push(say(S, 'storm.prep'));
  if (!parts.filter(Boolean).length) parts.push(say(S, 'storm.none'));
  S.st.cs = v.sky === 'rain' ? 'weather_rain' : false;
  return { parts, topics: ['weather'], ask: 'weather' };
};

P.heat = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  const C = G.climateFacts(v);
  const rec = G.recordFacts(v);
  const W = G.weatherFacts(v);
  const tjul = isNum(C.tjul) ? Math.round(C.tjul) : null;
  if ((st.depth.heat || 0) > 0) {
    parts.push(say(S, 'heat.cope'));
    if (isNum(C.h90) && C.h90 >= 5 && !st.used.has('clim.h90')) { parts.push(say(S, 'heat.days90', { h90: Math.round(C.h90) }, ['clim.h90'])); st.used.add('clim.h90'); }
    if (isNum(W.tempExact)) parts.push(say(S, 'heat.now', { temp: W.tempExact }, [W.ids.now]));
    return { parts, topics: ['weather'], ask: 'weather' };
  }
  if (isNum(C.h100) && C.h100 >= 5) {
    parts.push(say(S, 'heat.days', { h100: Math.round(C.h100) }, ['clim.h100']));
    if (isNum(C.h90) && S.rng.chance(0.4)) parts.push(say(S, 'heat.days90', { h90: Math.round(C.h90) }, ['clim.h90']));
  } else if (isNum(tjul) && tjul < 80 && num(C.h90) < 5) parts.push(say(S, 'heat.coast', { tjul }, ['clim.tjul']));
  else if (isNum(tjul)) parts.push(say(S, 'heat.mild', { tjul }, ['clim.tjul']));
  if (isNum(tjul) && isNum(C.h100) && C.h100 >= 5 && S.rng.chance(0.4)) parts.push(say(S, 'heat.jul', { tjul }, ['clim.tjul']));
  if (rec.heat && !st.used.has(rec.heat.id)) {
    st.used.add(rec.heat.id);
    const dt = rec.heat.dt;
    const dateEs = dt.m ? `${dt.d} de ${MESES[dt.m - 1]} de ${dt.y}` : String(dt.y);
    // (a station farther away, or far above or below, is named with its distance: its record is not "here")
    parts.push(say(S, rec.heat.local ? 'heat.record' : 'heat.recordAt', Object.assign({ recTemp: rec.heat.value, recDate: fullDate(dt), recDateEs: dateEs }, stationSlots(rec.heat)), [rec.heat.id]));
    if (rec.heat.local && rec.heat.memory && rec.heat.memory.experience && v.lang.mode === 'en') parts.push(withMem(say(S, 'heat.recordLived', { exp: rec.heat.memory.experience }, [rec.heat.id, 'persona.memory']), rec.heat.memory));
  }
  if (isNum(W.tempExact) && (W.tempExact >= 85 || /\b(today|right now|now)\b/.test(u.norm))) parts.push(say(S, 'heat.now', { temp: W.tempExact }, [W.ids.now]));
  const ha = W.alerts.find(a => a.heat);
  if (ha) parts.push(say(S, 'heat.alert', { alert: ha.event }, [ha.id]));
  if (num(C.h90) >= 10 || v.flags.outdoor) parts.push(say(S, 'heat.cope'));
  S.st.cs = v.sky === 'heat' ? 'weather_hot' : false;
  return { parts, topics: ['weather'], ask: 'weather' };
};

P.housing = (S, u, opts = {}) => {
  const v = S.v, parts = [];
  const census = G.censusFacts(v);
  const head = ['householder', 'spouse', 'partner'].includes(v.npc.role) && v.age >= 18;
  const pw = parentsWords(S);
  const value = census.value ? say(S, 'house.value', { value: census.value.words, valueEs: valueEs(census.value.value) }, [census.value.id]) : null;
  if (v.age < 18) { parts.push(say(S, 'house.minor', { parentsWord: pw ? pw.en : 'parents', parentsEs: pw ? pw.es : 'mis papás' })); S.st.cs = false; return { parts, topics: ['housing'], noAsk: true }; }
  const rent = opts.rent || u.intent === 'rent';
  if (head && v.hh.tenure === 'own') {
    const side = rent ? say(S, 'rent.ownerSide', {}, [REC.home]) : null;
    if (side) parts.push(side);
    const years = v.P.year - num(v.hh.yearMoved, v.P.year);
    // ("we own, luckily" is not followed by "we were lucky to buy")
    const lucky = side && /\b(luck\w*|suerte)\b/i.test(`${side.text} ${side.gloss || ''}`) ? { _avoid: /\b(luck\w*|suerte)\b/i } : {};
    parts.push(joinedLater(v) ? say(S, 'house.boughtJoined', ownerWords(v), [REC.home])
      : say(S, years >= 20 ? 'house.boughtLong' : 'house.bought', lucky, [REC.home]) || say(S, 'house.bought', lucky, [REC.home]));
    parts.push(value);
    if (v.flags.kids && v.speaker.nativeHere !== false && S.rng.chance(0.5)) parts.push(say(S, 'house.kidsFuture'));
  } else if (head || v.npc.role === 'roommate') {
    parts.push(say(S, 'rent.feel', {}, [REC.home]));
    if (rent && /how much|what do you pay|what'?s (the )?rent/.test(u.norm)) parts.push(say(S, 'rent.noNumber'));
    parts.push(value);
  } else {
    if (pw) parts.push(say(S, 'house.young', { parentsWord: pw.en, parentsEs: pw.es }, [REC.home]));
    else if (rent) parts.push(say(S, 'rent.family', {}, [REC.home]));
    parts.push(value);
  }
  if (census.own) {
    if (census.own.share < 0.4 && S.rng.chance(0.6)) parts.push(say(S, 'house.renters', {}, [census.own.id]));
    else if (census.own.share >= 0.7 && S.rng.chance(0.5)) parts.push(say(S, 'house.owners', {}, [census.own.id]));
  }
  if (u.flags.opinion || S.rng.chance(0.45)) parts.push(say(S, 'house.opinion'));
  S.st.cs = !census.value || census.value.value >= 450000 ? 'its_expensive' : false;
  return { parts, topics: rent ? ['rent', 'housing'] : ['housing'], ask: 'housing' };
};

function valueEs(n) {
  if (!isNum(n)) return null;
  if (n >= 2000001) return 'más de dos millones de dólares';
  if (n >= 1000000) return `como ${String((Math.round(n / 50000) * 50000 / 1e6).toFixed(2)).replace(/0$/, '').replace(/\.0$/, '')} millones de dólares`;
  return `como $${String(Math.round(n / 1000) * 1000).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

P.rent = (S, u) => P.housing(S, u, { rent: true });

P.insurance = (S, u) => {
  const v = S.v, parts = [];
  const I = G.insuranceFacts(v);
  const head = ['householder', 'spouse', 'partner'].includes(v.npc.role) && v.age >= 18;
  const pw = parentsWords(S);
  if (v.age < 18) { parts.push(say(S, 'ins.minor', { parentWord: pw ? pw.en : 'parents' })); S.st.cs = false; return { parts, topics: ['insurance'], noAsk: true }; }
  const fair = I.fair && I.fair.per100 >= 5 ? I.fair : null;
  const nonren = I.nonren && I.nonren.pct >= 8 ? I.nonren : null;
  if (!(head && v.hh.tenure === 'own')) {
    parts.push(head || v.npc.role === 'roommate' ? say(S, 'ins.renter', {}, [REC.home])
      : pw ? say(S, 'ins.family', { parentWord: pw.en }, [REC.home]) : say(S, 'ins.notMine', {}, [REC.home]));
    if (fair) parts.push(say(S, 'ins.fair', fairSlots(fair), [fair.id]));
    S.st.cs = fair ? 'its_expensive' : false;
    return { parts, topics: ['insurance'], ask: 'housing' };
  }
  if (!fair && !nonren) {
    parts.push(say(S, 'ins.low', {}, [I.fair && I.fair.id, I.nonren && I.nonren.id].filter(Boolean)));
    if (I.prem) parts.push(say(S, 'ins.prem', { prem: I.prem.words }, [I.prem.id]));
    S.st.cs = false; // not a complaint, so no "¡Está carísimo!"
    return { parts, topics: ['insurance'], ask: 'housing' };
  }
  if (fair) parts.push(say(S, 'ins.fair', fairSlots(fair), [fair.id]));
  if (nonren) parts.push(say(S, 'ins.nonren', { nonren: G.oneIn(nonren.pct), nonrenCap: capFirst(G.oneIn(nonren.pct)) }, [nonren.id]));
  if (I.prem && S.rng.chance(0.6)) parts.push(say(S, 'ins.prem', { prem: I.prem.words }, [I.prem.id]));
  parts.push(say(S, 'ins.mine'));
  if (v.flags.fireZone) parts.push(say(S, 'ins.feel'));
  S.st.cs = 'its_expensive';
  return { parts, topics: ['insurance'], ask: 'housing', emotion: v.big5.N > 0.55 ? 'worried' : null };
};

function fairSlots(fair) {
  const n = Math.round(fair.per100);
  return { fair: n, fairWords: `about ${n} in every 100`, fairWordsCap: `About ${n} in every 100` };
}

P.earthquake = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  const quakes = G.femaFacts(v).quakes.filter(q => !st.used.has(q.id));
  const q = quakes[0];
  if (q && q.title) {
    st.used.add(q.id);
    const title = G.femaTitle(q.title);
    if (q.memory && q.memory.experience && v.lang.mode === 'en') {
      parts.push(withMem(say(S, 'quake.lived', { title, exp: q.memory.experience, year: q.dt.y }, [q.id, 'persona.memory']), q.memory));
      parts.push(say(S, 'quake.femaAfter', { year: q.dt.y }, [q.id]));
    } else parts.push(say(S, 'quake.fema', { title, titleCap: capFirst(title), year: q.dt.y }, [q.id]));
  } else {
    // The pack's disaster declarations start in 2003 and cover a few counties: no record is not "nothing happened".
    // A quake the player names, or one older than the records, gets the speaker's own years here, and no claim.
    const year = u.entities.years[0];
    if (isNum(year)) parts.push(residenceInYear(S, year));
    else if (/\b(remember|were you|did you feel|have you felt|been through|lived through)\b/.test(u.norm)) parts.push(residenceLine(S));
    parts.push(say(S, 'quake.none'));
  }
  const first = S.rng.chance(0.5) ? 'quake.prep' : 'quake.feel';
  parts.push(say(S, first));
  if (S.rng.chance(0.4)) parts.push(say(S, first === 'quake.prep' ? 'quake.feel' : 'quake.prep'));
  return { parts, topics: ['neighborhood'], ask: 'from' };
};

// Dishes a player names when asking where to eat: [pattern, English, Spanish, the heritages whose home cooking it is,
// bought rather than cooked at home (a shop food: boba, pizza, donuts), how the dialect's food lines name it].
const DISHES = [
  [/\btamales?\b/, 'tamales', 'tamales', /mexican|salvadoran|guatemalan|honduran/, false, /\btamales?\b/],
  [/\bpupusas?\b/, 'pupusas', 'pupusas', /salvadoran|honduran/, false, /\bpupusa/],
  [/\btacos?\b/, 'tacos', 'tacos', /mexican/, false, /\btacos?\b/],
  [/\bburritos?\b/, 'burritos', 'burritos', null, true, /\bburritos?\b/],
  [/\bbirria\b/, 'birria', 'birria', /mexican/, false, /\bbirria\b/], [/\bmenudo\b/, 'menudo', 'menudo', /mexican/, false, /\bmenudo\b/],
  [/\bpozole\b/, 'pozole', 'pozole', /mexican/, false, /\bpozole\b/], [/\bmariscos\b/, 'mariscos', 'mariscos', null, true, /\bmariscos|\bseafood|\bfish tacos|\bshrimp|\bceviche/],
  [/\btortas?\b/, 'tortas', 'tortas', null, true, /\btortas?\b/], [/\bpan dulce\b/, 'pan dulce', 'pan dulce', null, true, /\bpan dulce|\bpanader/],
  [/\bramen\b/, 'ramen', 'ramen', null, true, /\bramen\b/], [/\bsushi\b/, 'sushi', 'sushi', null, true, /\bsushi\b/],
  [/\bpho\b/, 'pho', 'pho', /vietnamese/, false, /\bpho\b/], [/\bbanh mi\b/, 'banh mi', 'banh mi', null, true, /\bbanh mi\b/],
  [/\bdim sum\b/, 'dim sum', 'dim sum', null, true, /\bdim sum\b/], [/\blumpia\b/, 'lumpia', 'lumpia', /filipino/, false, /\blumpia\b/],
  [/\bkorean (bbq|barbecue)\b/, 'Korean barbecue', 'carne coreana', null, true, /\bkorean (bbq|barbecue)\b/],
  [/\b(bbq|barbecue|tri-?tip)\b/, 'barbecue', 'carne asada', null, false, /\b(bbq|barbecue|tri-?tip|carne asada)\b/i],
  [/\bpizza\b/, 'pizza', 'pizza', null, true, /\bpizza\b/], [/\bburgers?\b/, 'burgers', 'hamburguesas', null, true, /\bburgers?\b/],
  [/\b(donuts?|doughnuts?)\b/, 'donuts', 'donas', null, true, /\b(donuts?|doughnuts?)\b/], [/\bice cream\b/, 'ice cream', 'helado', null, true, /\bice cream\b/],
  [/\bseafood\b/, 'seafood', 'mariscos', null, true, /\b(seafood|fish tacos|crab|oysters?|chowder|shrimp|mariscos)\b/i], [/\bboba\b/, 'boba', 'boba', null, true, /\bboba\b/],
  [/\bcoffee\b/, 'coffee', 'café', null, true, /\bcoffee\b/], [/\b(beer|brewery|breweries)\b/, 'beer', 'cerveza', null, true, /\b(beer|brewer(y|ies)|brewpub)\b/],
];

/** The dish a food question names ("where can I get good tamales?"), or null. */
function dishOf(q) {
  const d = DISHES.find(([re]) => re.test(String(q || '')));
  return d ? { en: d[1], es: d[2], home: d[3], shop: d[4], lex: d[5] } : null;
}

// A dialect food line that says where ("Pho in Little Saigon is the best anywhere.", "Tacos in Barrio Logan."): a
// named place, or a kind of place (a truck, a stand, a bakery).
const FOOD_WHERE = /\b(?:in|at|on|by|from|near|outside|off|up|down)\s+(?:the\s+)?[A-Z]|\b(?:trucks?|stands?|carts?|shops?|spots?|places?|bakery|bakeries|markets?|corner|block|joint|window|counter|hole-in-the-wall|street|downtown|the pier|the beach|the game)\b/;

/**
 * Where to get a dish, in the dialect's own words: one of its food lines that names the dish and a where, filled and
 * checked like any regional line. Null when the dialect has none (English mode only; the lines are English).
 */
function dishWhere(S, dish) {
  const v = S.v;
  const es = v.lang.mode === 'es';
  if ((v.lang.mode !== 'en' && !es) || !dish || !dish.lex) return null;
  const ctx = Object.assign({}, v.context, { speaker: v.speaker, age: v.age }, es ? { lang: 'es' } : {});
  // (a Spanish line is matched and checked by its English gloss)
  const en = t => (es ? (typeof glossOf === 'function' ? glossOf(t) : null) : t);
  let pool = [];
  try { pool = es ? linesFor(v.key, 'food', ctx) : [...new Set([...linesFor(v.key, 'food', Object.assign({ regional: true }, ctx)), ...linesFor(v.key, 'food', ctx)])]; } catch { pool = []; }
  for (const t of S.rng.shuffle(pool.filter(x => en(x) && dish.lex.test(en(x)) && FOOD_WHERE.test(en(x))))) {
    const text = lexFill(t, v.lex.values), gloss = es ? lexFill(en(t), v.lex.values) : null;
    const check = es ? gloss : text;
    if (!text || !check || !cleanText(text) || !fitsLife(check, v) || !lexiconLineFits(check, v, 'food') || S.st.said.has(text) || !freshText(S, text)) continue;
    if (lintText(check, NO_BRANDS, { english: true }).length) continue;
    holdSentences(S, text);
    return { text, gloss, facts: templateSlots(t).map(s => (v.lex.facts && v.lex.facts[s]) || null).filter(Boolean), key: 'lex:food' };
  }
  return null;
}

P.food = (S, u) => {
  const v = S.v, parts = [];
  const census = G.censusFacts(v);
  // "where can I get tamales?": the where first, for everyone (the dialect's own line about that dish and where to get
  // it, else a plain tip; no restaurant is made up), then how many places to eat there are, by the Census count. A
  // word about making it at home comes only from someone who cooks, or now and then from an older generation whose
  // family's dish it is (a modest chance that falls with each generation, never for food people buy: boba, pizza).
  // "what's your favorite restaurant?": a spot as the dialect names one (a kind of place, never a business's name)
  if (u && /\bfavou?rite (?:restaurant|place to eat|spot to eat|food place|taco (?:truck|place|spot)|lunch spot)\b|\bwhere do you (?:like to|usually|always) eat\b/.test(u.norm)) {
    const spot = dishWhere(S, { lex: /[a-z]/ });
    parts.push(spot || say(S, 'food.tip'));
    if (spot && census.food && S.rng.chance(0.4)) parts.push(say(S, 'food.some', {}, [census.food.id]));
    return { parts, topics: ['food'], ask: 'food' };
  }
  const dish = u && /\bwhere\b|\bany good\b|\brecommend\b|\bbest\b|\bget\b|\bknow any\b/.test(u.norm) ? dishOf(u.norm) : null;
  if (dish) {
    const slots = { dish: dish.en, dishEs: dish.es };
    parts.push(dishWhere(S, dish) || say(S, 'food.dishAsk', slots));
    if (census.food && S.rng.chance(0.6)) {
      const F = census.food;
      const key = F.per10k >= 40 || F.perSqmi >= 60 ? 'food.lots' : F.per10k >= 12 || F.perSqmi >= 10 ? 'food.some' : v.flags.rural ? 'food.few' : 'food.fewCity';
      const near = (v.p.knowledge && v.p.knowledge.nearbyPlaces || []).slice().sort((a, b) => num(b.pop) - num(a.pop))[0];
      parts.push(say(S, key, { nearTown: near ? near.name : null }, { '': [F.id], nearTown: near ? `place:${near.name}` : null }));
    }
    if (!dish.shop && v.age >= 13) {
      const cooks = v.interests.includes('cooking');
      const gen = num(v.npc.generation, 3);
      const family = !!(dish.home && dish.home.test(`${v.npc.heritage || ''} ${v.npc.heritageLabel || ''}`.toLowerCase()));
      if (cooks && S.rng.chance(0.5)) parts.push(say(S, 'food.dishCook', slots, ['persona.interests']));
      else if (!cooks && family && gen <= 2 && S.rng.chance(gen <= 1 ? 0.3 : 0.15)) parts.push(say(S, 'food.dishHome', slots));
    }
    if (parts.filter(Boolean).length) return { parts, topics: ['food'], ask: null };
  }
  // "where should I get tacos?" asks for a where: a tip comes first; then the dialect's own line and the Census count
  // of places to eat (kept within the sentence budget: it is what the answer knows about the place)
  const whereQ = !!(u && /\bwhere\b|\bany good\b|\brecommend\b|\bbest\b/.test(u.norm));
  if (whereQ) { const tip = say(S, 'food.tip'); if (tip) parts.push(tip); }
  if (v.age >= 13) parts.push(lex(S, 'food'));
  if (census.food && S.rng.chance(0.85)) {
    const F = census.food;
    const near = (v.p.knowledge && v.p.knowledge.nearbyPlaces || []).slice().sort((a, b) => num(b.pop) - num(a.pop))[0];
    // by area as well as by head: South LA has few restaurants per resident and plenty per block; "out here" is for
    // the countryside only
    const key = F.per10k >= 40 || F.perSqmi >= 60 ? 'food.lots' : F.per10k >= 12 || F.perSqmi >= 10 ? 'food.some' : v.flags.rural ? 'food.few' : 'food.fewCity';
    const p = say(S, key, { nearTown: near ? near.name : null }, { '': [F.id], nearTown: near ? `place:${near.name}` : null });
    if (p) { p.keep = true; parts.push(p); }
  }
  if (v.interests.includes('cooking') && S.rng.chance(0.5)) parts.push(say(S, 'food.cook', {}, ['persona.interests']));
  else parts.push(say(S, S.rng.chance(0.3) && v.age >= 13 ? 'food.good' : 'food.mine') || say(S, 'food.mine'));
  const lang = v.lang.cs ? v.lang.cs.lang : null;
  const gen = num(v.npc.generation, 3);
  if (lang && LANGUAGES[lang] && LANGUAGES[lang].food.length && gen <= 2 && S.rng.chance(0.4)) {
    const opts = { sex: v.sex, variety: v.lang.variety, faith: v.lang.faith };
    const dishes = (phrasesFor(lang, 'food', opts) || []);
    const d = S.picker.pick(`food:${lang}`, dishes, S.rng);
    if (d) {
      const name = d.roman || d.text;
      const dish = v.lang.mode === 'en' ? { t: name, g: cleanGloss(d.gloss) } : name;
      parts.push(say(S, 'food.heritage', { dish, dishGloss: cleanGloss(d.gloss) }, ['persona.heritage']));
    }
  }
  if (!whereQ && S.rng.chance(0.4)) { const tip = say(S, 'food.tip'); if (tip) parts.push(tip); }
  return { parts, topics: ['food'], ask: 'food' };
};

/**
 * The nearest town big enough to be "the big town" from here (Census places, by population): a city of 100,000 when
 * they asked for a city, else 10,000, and in either case half again as big as their own. Null when their own town
 * is that town.
 */
// A Census place's point is its internal point, which can sit far from where its people live (San Francisco's is out
// past the Golden Gate, pulled west by the Farallon Islands). A place whose point is more than 15 km from the middle
// of the ZIPs that carry its name (their town points, weighted by population) is placed at that middle instead.
const PLACE_POINTS = new WeakMap();
function placePoint(world, p) {
  let m = PLACE_POINTS.get(world);
  if (!m) {
    const z = world.z, acc = new Map();
    for (let i = 0; i < world.N; i++) {
      const w = Math.max(1, num(z.pop[i]));
      for (const nm of new Set([z.city && z.city[i], z.place && z.place[i]].filter(Boolean))) {
        const a = acc.get(nm) || { x: 0, y: 0, w: 0 };
        a.x += z.tx[i] * w; a.y += z.ty[i] * w; a.w += w;
        acc.set(nm, a);
      }
    }
    m = new Map([...acc].map(([nm, a]) => [nm, { x: a.x / a.w, y: a.y / a.w }]));
    PLACE_POINTS.set(world, m);
  }
  const c = m.get(p.name);
  return c && world.distKm(p.x, p.y, c.x, c.y) > 15 ? c : p;
}

/**
 * The big town or city people around the speaker go to, or {here: name} when their own town (found by name, wherever
 * its point is) has 400,000 people or more and is the city itself. Among places half again their own size (10,000 at
 * least for a town, 50,000 for a city) the one with the biggest pull is it: population over distance cubed for "the
 * closest big town" (near, but San Jose over the suburb next door), squared for "the city"; and in the Bay Area "the
 * city" is San Francisco, as people there say it.
 */
function bigTownNear(v, city, theCity = false) {
  const W = v.world;
  const own = [v.z.city, v.z.place].filter(Boolean).map(s => s.toLowerCase());
  const mine = W.places.filter(p => own.includes(String(p.name).toLowerCase())).sort((a, b) => num(b.pop) - num(a.pop));
  const ownPop = mine.length ? num(mine[0].pop) : 0;
  // (an East LA address that reads "Los Angeles" is in the city: the big one of their names is the town)
  if (ownPop >= 400000) return { here: mine[0].name };
  const want = Math.max(city ? 50000 : 10000, ownPop * 1.5);
  let best = null;
  for (const p of W.places) {
    if (num(p.pop) < want || own.includes(String(p.name).toLowerCase())) continue;
    const pt = placePoint(W, p);
    const km = W.distKm(v.home.x, v.home.y, pt.x, pt.y);
    if (km > 260) continue;
    const d = km + 10;
    const score = theCity && p.name === 'San Francisco' && km <= 100 ? Infinity : num(p.pop) / (city ? d * d : d * d * d);
    if (!best || score > best.score) best = { name: p.name, km, x: pt.x, y: pt.y, pop: p.pop, ownPop, score };
  }
  return best;
}

P.place = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  // "what's the closest big town?", "do you ever go to the city?": the nearest one big enough, from the pack's Census places
  const cityTrip = !!(u && /\b(?:go|get|head|drive|come) (?:in|into|down|up|over)? ?to the city\b|\bgo into (?:the )?(?:city|town)\b|\bgo to town\b/.test(u.norm));
  if (u && (cityTrip || /\b(closest|nearest|next) (big |bigger |real |major )?(town|city)\b|\bbig (town|city)\b/.test(u.norm))) {
    let town = bigTownNear(v, /\bcity\b/.test(u.norm), /\bthe city\b/.test(u.norm));
    const here = town && town.here;
    if (here) town = null;
    if (town && cityTrip) {
      const R = G.routeTo(v, town);
      parts.push(say(S, 'place.cityTrips', { town: town.name, miles: R.miles, milesEs: millasEs(R.miles), dir: R.dir || 'away', dirEs: R.dir ? DIR_ES[R.dir] : 'lejos' }, [`place:${town.name}`]));
      if (R.km >= 60) parts.push(say(S, 'place.bigTownFar'));
      return { parts, topics: ['neighborhood'], ask: 'visiting' };
    }
    if (town) {
      const R = G.routeTo(v, town);
      parts.push(say(S, 'place.bigTown', { town: town.name, miles: R.miles, milesEs: millasEs(R.miles), dir: R.dir || 'away', dirEs: R.dir ? DIR_ES[R.dir] : 'lejos', road: R.road, roadEs: R.road ? roadEs(R.road) : null }, { '': [`place:${town.name}`], road: R.roadId }));
      if (R.km >= 60) parts.push(say(S, 'place.bigTownFar'));
    } else parts.push(say(S, 'place.bigTownHere', here ? { place: here } : {}, [`place:${here || v.z.city}`]));
    return { parts, topics: ['neighborhood'], ask: 'visiting' };
  }
  const F = G.placeFacts(v);
  // candidates by kind: a question about hikes or beaches is answered with those first, and only those that fit
  const cands = [];
  const add = (kind, f) => cands.push({ kind, f });
  if (F.beach) add('beach', () => say(S, 'place.beach', { beach: F.beach.label, miles: G.miles(F.beach.distKm), milesEs: millasEs(G.miles(F.beach.distKm)) }, [`place:${F.beach.label}`]));
  if (F.trail) add('trail', () => say(S, 'place.trail', { trail: F.trail.label, trailEs: trailEs(F.trail.label), miles: G.miles(F.trail.distKm), milesEs: millasEs(G.miles(F.trail.distKm)) }, [`landmark:${F.trail.name}`]));
  for (const l of F.landmarks.filter(l => l.rank <= 2 || (l.kind === 'peak' && num(l.elev) >= 500)).slice(0, 2)) add(l.kind === 'peak' || l.kind === 'range' ? 'peak' : 'landmark', () => say(S, 'place.landmark', { landmark: l.label }, [l.id]));
  // a bay's landmark point can be miles offshore: no distance for open water
  if (F.water) {
    const open = /\b(Bay|Ocean|Sea|Channel|Strait|Sound)\b/.test(F.water.label);
    add('water', () => say(S, 'place.water', { water: F.water.label, waterEs: String(F.water.label).replace(/^the /i, ''), miles: open ? null : G.miles(F.water.distKm), milesEs: open ? null : millasEs(G.miles(F.water.distKm)) }, [`landmark:${F.water.name}`]));
  }
  if (F.game && v.team) add('game', () => say(S, 'place.game', {}, ['persona.teams']));
  const spots = [F.beach, F.water, F.park, F.trail].filter(Boolean).map(x => String(x.label || ''));
  for (const t of F.towns.filter(t => num(t.pop) >= 15000 && !spots.some(l => l.includes(t.name))).slice(0, 2)) {
    const p = v.world.places.find(x => x.name === t.name);
    const dir = p ? compass(p.x - v.home.x, p.y - v.home.y) : null;
    if (dir) add('town', () => say(S, 'place.town', { town: t.name, miles: G.miles(t.distKm), milesEs: millasEs(G.miles(t.distKm)), dir, dirEs: DIR_ES[dir] }, [t.id]));
  }
  const fav = v.interests.find(i => !st.usedInterests.has(i) && !isPractice(v, i) && interestTalk(i) && interestTalk(i).place);
  if (fav && v.age >= 13) {
    const talk = interestTalk(fav), es = S.rng.pick(talk.es);
    add(/hik|trail|walk/.test(fav) ? 'trail' : /beach|surf/.test(fav) ? 'beach' : 'mine', () => say(S, 'place.mine', { doingThing: talk.doing, interestEs: es ? es[0] : null, interestEn: es ? es[1] : null }, ['persona.interests']));
  }
  const q = u ? u.norm : '';
  const want0 = /\bhik(e|es|ing)\b|\btrails?\b|\bwalks?\b|\bnature\b|\boutdoors?\b/.test(q) ? ['trail', 'peak', 'water']
    : /\bbeach(es)?\b|\bocean\b|\bsurf/.test(q) ? ['beach', 'water'] : null;
  // nothing of the kind known: the usual answer, never "there's none"
  const want = want0 && cands.some(c => want0.includes(c.kind)) ? want0 : null;
  const park = F.park ? { kind: 'park', f: () => say(S, 'place.park') } : null;
  const ordered = want
    ? [...cands.filter(c => want.includes(c.kind)).sort((a, b) => want.indexOf(a.kind) - want.indexOf(b.kind)), ...(park ? [park] : [])]
    : [...S.rng.shuffle(cands), ...(park ? [park] : [])];
  for (const c of ordered) { if (parts.filter(Boolean).length >= (want ? 2 : 3)) break; parts.push(c.f()); }
  if (!parts.filter(Boolean).length) parts.push(say(S, 'place.none'));
  return { parts, topics: ['neighborhood'], ask: 'visiting' };
};

P.directions = (S, u) => {
  const v = S.v, parts = [];
  const pw = parentsWords(S);
  if (v.age < 10) { parts.push(say(S, 'dir.kid', { parentWord: pw ? pw.en : 'mom', parentEs: pw ? pw.es : 'mi mamá' })); return { parts, topics: ['directions'], noAsk: true }; }
  const F = G.placeFacts(v);
  const place = u.entities.places[0];
  let target = null, label = null, id = null, labelEs = null;
  if (place) {
    const own = [v.z.city, v.z.place, v.lex.values.place].filter(Boolean).map(s => s.toLowerCase());
    if (place.kind === 'town' && own.includes(place.name.toLowerCase())) { parts.push(say(S, 'dir.here')); return { parts, topics: ['directions'], ask: 'visiting' }; }
    target = { x: place.x, y: place.y }; label = place.name;
    id = place.kind === 'landmark' ? `landmark:${place.name}` : `place:${place.name}`;
  } else if (u.entities.routine.length) {
    const k = u.entities.routine[0];
    const errand = F.errands.find(e => e.kind === k);
    if (errand) {
      if (errand.zi === v.zi) parts.push(say(S, 'dir.errandHere', { word: errand.word, wordEs: errandEs(errand.kind) }, [`place:${errand.city}`]));
      else parts.push(say(S, 'dir.errand', { word: errand.word, wordEs: errandEs(errand.kind), city: errand.city, miles: G.miles(errand.distKm), milesCap: capFirst(G.miles(errand.distKm)), milesEs: millasEs(G.miles(errand.distKm)) }, [`place:${errand.city}`]));
      return { parts, topics: ['directions'], ask: null };
    }
    const spot = { beach: F.beach, park: F.park, trail: F.trail, water: F.water, gym: F.gym, church: F.church, game: F.game }[k];
    if (spot) { target = spot; label = spot.label || k; id = `place:${spot.label || k}`; }
    else if (k === 'downtown') {
      const big = (v.p.knowledge && v.p.knowledge.nearbyPlaces || []).slice().sort((a, b) => num(b.pop) - num(a.pop))[0];
      const p = big ? v.world.places.find(x => x.name === big.name) : null;
      if (p) { target = p; label = `downtown ${p.name}`; labelEs = `el centro de ${p.name}`; id = `place:${p.name}`; }
    } else if (k === 'freeway') {
      const r = G.roadFacts(v)[0];
      if (r) { parts.push(say(S, 'dir.near', { miles: G.miles(r.distKm), milesCap: capFirst(G.miles(r.distKm)), dir: 'from here', milesEs: millasEs(G.miles(r.distKm)), dirEs: 'de aquí' }, [r.id])); parts.push(say(S, 'dir.road', { road: r.name, roadEs: roadEs(r.name) }, [r.id])); return { parts, topics: ['directions'] }; }
    }
  }
  if (!target) {
    parts.push(say(S, 'dir.unknown'));
    return { parts, topics: ['directions'], ask: null };
  }
  const R = G.routeTo(v, target);
  const slots = { target: label, targetEs: labelEs || label, miles: R.miles, milesCap: capFirst(R.miles || ''), dir: R.dir || 'from here', dirEs: R.dir ? DIR_ES[R.dir] : 'de aquí', milesEs: millasEs(R.miles), road: R.road, roadEs: R.road ? roadEs(R.road) : null };
  if (R.km < 3) parts.push(say(S, 'dir.near', slots, [id]));
  else if (R.km > 160) parts.push(say(S, 'dir.far', slots, [id]));
  else parts.push(say(S, 'dir.place', slots, [id]));
  const roadSaid = !!(R.road && R.km <= 160);
  if (roadSaid) parts.push(say(S, 'dir.road', slots, [R.roadId]));
  if (R.km >= 3 && (R.km > 160 || S.rng.chance(0.4))) parts.push(say(S, roadSaid ? 'dir.map' : 'dir.mapAll'));
  return { parts, topics: ['directions'], ask: 'visiting' };
};

function errandEs(kind) {
  return { grocery: 'tienda', pharmacy: 'farmacia', laundromat: 'lavandería', hardware: 'ferretería', 'post-office': 'oficina de correos' }[kind] || 'tienda';
}

/**
 * A life memory of the persona ("Bianca was born in 1963.") in Spanish, for a Spanish speaker; null for a sentence
 * of a kind not covered. The household record gives a grandchild's sex.
 */
function lifeEs(v, text) {
  const t = String(text || '').trim().replace(/\.$/, '');
  const sexOf = name => { const m = (v.npc.household && v.npc.household.members || []).find(x => String(x.name || '').split(' ')[0] === name); return m ? m.sex : null; };
  let m;
  if ((m = /^I came to the US in (\d{4})(?: from (.+))?$/.exec(t))) return `Llegué a Estados Unidos en ${m[1]}${m[2] ? `, de ${m[2]}` : ''}.`;
  if ((m = /^(We|I) moved into this (house|apartment|mobile home|place|home) in (\d{4})$/.exec(t))) {
    const where = { house: 'esta casa', apartment: 'este apartamento', 'mobile home': 'esta casa móvil', place: 'esta casa', home: 'esta casa' }[m[2]];
    return `${m[1] === 'We' ? 'Nos cambiamos' : 'Me cambié'} a ${where} en ${m[3]}.`;
  }
  if (/^I have lived in this \w+(?: \w+)? my whole life$/.test(t)) return 'He vivido en esta casa toda mi vida.';
  if ((m = /^I grew up in (.+) County$/.exec(t))) return `Crecí en el condado de ${m[1]}.`;
  if ((m = /^My grandchild (\S+) was born in (\d{4})$/.exec(t))) return `${sexOf(m[1]) === 'F' ? 'Mi nieta' : 'Mi nieto'} ${m[1]} nació en ${m[2]}.`;
  if ((m = /^My (granddaughter|grandson|daughter|son) was born in (\d{4})$/.exec(t))) return `${{ granddaughter: 'Mi nieta', grandson: 'Mi nieto', daughter: 'Mi hija', son: 'Mi hijo' }[m[1]]} nació en ${m[2]}.`;
  if ((m = /^(\S+) was born in (\d{4})$/.exec(t))) return `${m[1]} nació en ${m[2]}.`;
  if ((m = /^(My wife|My husband|\S+) and I got married in (\d{4})$/.exec(t))) return `${{ 'My wife': 'Mi esposa', 'My husband': 'Mi esposo' }[m[1]] || m[1]} y yo nos casamos en ${m[2]}.`;
  if ((m = /^I retired in (\d{4})$/.exec(t))) return `Me jubilé en ${m[1]}.`;
  if ((m = /^I started .+ in (\d{4})$/.exec(t))) return `Empecé en mi trabajo en ${m[1]}.`;
  if ((m = /^(We|I) had the roof redone in (\d{4})( and put solar on it)?$/.exec(t))) return `${m[1] === 'We' ? 'Arreglamos' : 'Arreglé'} el techo en ${m[2]}${m[3] ? ' y le pusimos paneles solares' : ''}.`;
  return null;
}

// Questions about long ago: the oldest memories answer them, not the latest storm.
const OLD_DAYS = /\bold days\b|\bback in the day\b|\bback then\b|\bused to be\b|\byears ago\b|\bwhen you were (young|a kid|little|growing up)\b|\bgrowing up\b|\bthe way it (was|used to be)\b|\bold times\b|\bwhen you first (came|moved|got|arrived)\b/;

P.history = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  if (v.age < 12) { parts.push(say(S, 'hist.kid')); return { parts, topics: ['history'], noAsk: true }; }
  const year = u.entities.years[0];
  if (isNum(year)) {
    const ev = eventsOfYear(v, year);
    // "were you here in 1994?" is about them: their record answers it
    const here = /\b(were|was) (you|ya) (here|around|living|in|alive|born)\b|\bdid you (live|grow up) (here|around)\b|\bwhere were you\b/.test(u.norm);
    if (here || !ev) parts.push(residenceInYear(S, year));
    // a year the records hold an event for; for any other year nothing is claimed either way
    if (ev) parts.push(say(S, 'hist.yearHit', { year, event: ev.en, eventEs: ev.es }, [ev.id]));
    else if (!here) parts.push(say(S, 'hist.yearMiss', { year }));
    return { parts, topics: ['history'], ask: null };
  }
  const res = v.res || {};
  const q = u.norm || '';
  const oldDays = OLD_DAYS.test(q);
  // "what was it like when you first came here?": the year they came, and what it was like to be new
  if (/\bwhen (you|ya) (first )?(came|got here|arrived|moved (here|in))\b|\bwhen you first (came|got|moved|arrived)\b/.test(q) && !res.bornHere) {
    const abroad = v.npc.nativity === 'foreign' && isNum(v.npc.arrivalYear);
    const year = abroad ? v.npc.arrivalYear : isNum(res.countySince) ? res.countySince : isNum(res.zipSince) ? res.zipSince : null;
    if (isNum(year)) {
      const born = isNum(v.npc.birthYear) ? v.npc.birthYear : v.P.year - v.age;
      const fp = [say(S, year - born < 10 ? 'hist.firstCameKid' : 'hist.firstCame', { year }, [abroad ? REC.origin : REC.residence])];
      if (S.rng.chance(0.6)) fp.push(say(S, 'hist.then'));
      st.used.add('hist.residence');
      return { parts: fp, topics: ['history'], ask: 'from', emotion: 'wistful', keep: 2 };
    }
  }
  // where they come from, once, and not when they already told it (their origin, a few turns back)
  if (!st.used.has('hist.residence') && !(st.saidFacts && st.saidFacts.has(REC.origin))) {
    st.used.add('hist.residence');
    if (res.grewUpHere) parts.push(say(S, 'hist.grew', {}, [REC.residence]));
    else if (v.npc.nativity === 'foreign' && isNum(v.npc.arrivalYear)) parts.push(say(S, 'hist.arrival', { arrivalYear: v.npc.arrivalYear }, [REC.origin]));
    else if (isNum(res.zipSince)) parts.push(say(S, 'hist.since', {}, [REC.residence]));
  }
  const mems = (v.p.memories || []).filter(m => m && (m.kind === 'life' ? !st.usedMemories.has(m.source + m.year) && m.source !== 'npc.arrivalYear' : !st.usedMemories.has(m.source)));
  // long ago means the oldest of them; otherwise the event they feel most
  const pickFrom = oldDays ? mems.slice().sort((a, b) => num(a.year, 9999) - num(b.year, 9999)) : mems.filter(m => m.kind !== 'life').concat(mems.filter(m => m.kind === 'life'));
  for (const m of pickFrom) {
    if (parts.filter(Boolean).length >= 2) break;
    if (m.kind === 'life') {
      const es = lifeEs(v, m.text);
      if (v.lang.mode === 'es' && !es) continue;
      const p = say(S, 'hist.life', { lifeLine: String(m.text).replace(/\.?$/, '.'), lifeEs: es }, [memoryFact(m)]);
      if (p) { parts.push(p); st.usedMemories.add(m.source + m.year); }
      continue;
    }
    const id = memoryFact(m);
    const title = memTitleOf(m);
    const memEs = memoryEs(m), esSon = copulaEs(memEs);
    const p = say(S, 'hist.event', { memTitle: title, memTitleCap: capFirst(title), exp: m.experience || null, memEs, esSon }, [id, 'persona.memory'])
      || say(S, 'hist.event', { memTitle: title, memTitleCap: capFirst(title), exp: '', memEs, esSon }, [id]);
    if (p) { p.mem = m.source; parts.push(p); st.usedMemories.add(m.source); if (id) st.used.add(id); }
  }
  if (oldDays && S.rng.chance(0.6)) parts.push(say(S, 'hist.then'));
  if (!parts.filter(Boolean).length) { parts.push(say(S, 'hist.more')); parts.push(pivot(S)); }
  if (v.flags.longtime && !res.bornHere && S.rng.chance(0.3)) parts.push(say(S, 'hist.change', {}, [REC.residence]));
  return { parts, topics: ['history'], ask: 'from', emotion: 'wistful', keep: 2 };
};

/** Where they were in a given year, from the record: not born yet, here already, in the county, or not here yet. */
function residenceInYear(S, year) {
  const v = S.v, npc = v.npc, res = v.res || {};
  const born = isNum(npc.birthYear) ? npc.birthYear : v.P.year - v.age;
  const slots = { year, zipSince: isNum(res.zipSince) ? res.zipSince : null, countySince: isNum(res.countySince) ? res.countySince : null, arrivalYear: isNum(npc.arrivalYear) ? npc.arrivalYear : null };
  if (year < born) return say(S, 'hist.yearUnborn', slots, ['npc.age']);
  if (res.bornHere || (isNum(res.zipSince) && year >= res.zipSince)) return say(S, res.bornHere ? 'hist.yearHereAlways' : 'hist.yearHere', slots, [REC.residence]);
  if (isNum(res.countySince) && year >= res.countySince) return say(S, 'hist.yearCounty', slots, [REC.residence]);
  if (npc.nativity === 'foreign' && isNum(npc.arrivalYear) && year < npc.arrivalYear) return say(S, 'hist.yearAbroad', slots, [REC.origin]);
  return say(S, 'hist.yearAway', slots, [REC.residence]);
}

/** How long they have lived around here, for a question about something that happened before the records. */
function residenceLine(S) {
  const v = S.v, res = v.res || {};
  if (res.bornHere || v.flags.bornInCounty) return say(S, 'quake.residenceLife', {}, [REC.residence]);
  if (isNum(res.countySince)) return say(S, 'quake.residence', { countySince: res.countySince }, [REC.residence]);
  return null;
}

function eventsOfYear(v, year) {
  for (const f of G.fireFacts(v)) if (f.year === year) return { en: f.label, es: fireEs(f.name), id: f.id };
  for (const a of G.arFacts(v)) if (a.dt.y === year) return { en: `the atmospheric river in ${monthYear(a.dt)}`, es: `río atmosférico de ${mesAno(a.dt)}`, id: a.id };
  for (const f of [...G.femaFacts(v).storms, ...G.femaFacts(v).quakes]) if (f.dt.y === year && f.title) return { en: `the ${G.femaTitle(f.title)}`, es: f.kind === 'Earthquake' ? 'terremoto' : 'temporal de ese año', id: f.id };
  const rec = G.recordFacts(v);
  for (const k of ['heat', 'rain', 'gust']) if (rec[k] && rec[k].local && rec[k].dt.y === year) return { en: k === 'heat' ? `the record heat, ${rec[k].value} degrees` : k === 'rain' ? `the record rain, ${rec[k].value} inches in a day` : `the record wind, ${rec[k].value} miles an hour`, es: k === 'heat' ? 'calor récord' : k === 'rain' ? 'aguacero récord' : 'viento récord', id: rec[k].id };
  return null;
}

// Worries a persona can carry that have no planner of their own, by concern topic: the bank key for a speaker who
// worries about it, and the grounded fact that can follow.
const CONCERN_KEYS = { water: 'concern.water', 'power shutoffs': 'concern.power', roof: 'concern.roof', jobs: 'concern.jobs', health: 'concern.health', schools: 'concern.schools', 'family abroad': 'concern.abroad' };

/** A local worry, in the speaker's own words, with what the pack knows about it. */
function concernTalk(S, topic) {
  const v = S.v, parts = [];
  const c = (v.p.concerns || []).find(x => x && x.topic === topic);
  const key = CONCERN_KEYS[topic] || 'concern.health';
  parts.push((c ? say(S, key, {}, ['persona.concerns']) : null) || say(S, `${key}.calm`) || say(S, key, {}, ['persona.concerns']));
  if (topic === 'water') {
    const C = G.climateFacts(v);
    if (isNum(C.rain) && S.rng.chance(0.7)) parts.push(say(S, 'wx.climate.rain', { rainIn: Math.round(C.rain) }, ['clim.rain']));
  } else if (topic === 'roof' && v.flags.house && v.speaker.tenure === 'own') {
    const roof = v.p.roof;
    if (roof && !roof.original && isNum(roof.installed)) parts.push(roofLine(S, roof));
    else if (roof && num(roof.age) >= 15) parts.push(say(S, 'home.roofOld', {}, ['persona.roof']));
  } else if (topic === 'family abroad' && v.npc.nativity === 'foreign') {
    const homeland = homelandOf(v.npc.birthplace);
    if (homeland && !/California/.test(homeland)) parts.push(abroadLine(S, homeland));
  } else if (topic === 'jobs' && v.npc.status === 'unemployed') parts.push(say(S, 'job.unemployed', {}, ['npc.status']));
  return { parts, topics: [topic === 'jobs' ? 'job' : topic === 'schools' ? 'school' : topic === 'health' ? 'health' : 'neighborhood'], ask: null, emotion: c && c.weight >= 0.4 ? 'worried' : null };
}

/**
 * "What worries you?": their own top worry (persona.concerns, by weight), said in their words, with what the pack
 * knows about it from the planner of its subject when there is one.
 */
function worryTalk(S, u) {
  const v = S.v, st = S.st;
  // "any worries about the schools?": the worry named
  if (u.entities && u.entities.concern && CONCERN_KEYS[u.entities.concern]) return concernTalk(S, u.entities.concern);
  const c = (v.p.concerns || []).filter(x => x && x.topic).slice().sort((a, b) => num(b.weight) - num(a.weight))[0];
  if (!c) return { parts: [say(S, 'worry.none')], topics: ['opinion'], ask: null };
  const words = CONCERN_WORDS[c.topic] || [c.topic, null];
  const parts = [say(S, 'worry.top', { concern: words[0], concernCap: capFirst(words[0]), concernEs: words[1], esSon: copulaEs(words[1]) }, ['persona.concerns'])];
  const area = { fire: 'fire', smoke: 'fire', insurance: 'insurance', rent: 'rent', housing: 'housing', commute: 'traffic', heat: 'heat', storms: 'storm', flooding: 'storm', wind: 'storm', earthquakes: 'earthquake' }[c.topic]
    || { fire: 'fire', insurance: 'insurance', rent: 'rent', housing: 'housing', traffic: 'traffic', heat: 'heat', storm: 'storm', earthquake: 'earthquake' }[c.area] || null;
  if (area && P[area]) {
    const more = P[area](S, Object.assign({}, u, { intent: area, flags: Object.assign({}, u.flags, { sub: null, followUp: false }) }));
    const fact = (more.parts || []).find(p => p && (p.facts || []).length);
    if (fact) parts.push(fact);
    st.depth[area] = (st.depth[area] || 0);
  } else if (CONCERN_KEYS[c.topic]) return concernTalk(S, c.topic);
  for (const h of v.p.hookDetails || []) if (h.kind === 'concern' && h.topic === c.area) st.hooksUsed.add(`${h.kind}:${h.text}`);
  return { parts, topics: [c.area || 'opinion'], ask: null, emotion: num(c.weight) >= 0.4 ? 'worried' : null };
}

P.opinion = (S, u) => {
  const v = S.v, parts = [];
  if (u.flags && u.flags.worry) return worryTalk(S, u);
  if (u.entities && u.entities.concern && !u.flags.politics) return concernTalk(S, u.entities.concern);
  if (u.flags.politics) { parts.push(say(S, 'op.politics')); parts.push(pivot(S, { prefer: ['concern'] })); return { parts, topics: ['opinion'], noAsk: true }; }
  if (u.flags.aboutPlayer) {
    const f = v.relq.feelings;
    parts.push(say(S, f === 'fond' || f === 'warm' ? 'op.playerGood' : f === 'neutral' ? 'op.playerMeh' : 'op.playerBad'));
    return { parts, topics: ['self'], noAsk: true };
  }
  if (u.flags.religion) { parts.push(say(S, v.flags.churchgoer ? 'op.religion' : 'op.religionNone')); return { parts, topics: ['opinion'], noAsk: true }; }
  if (u.topics.includes('weather')) parts.push(say(S, 'op.weather'));
  else if (u.topics.includes('traffic')) { const r = G.roadFacts(v)[0]; parts.push(say(S, 'op.traffic', { road: r ? r.name : null }, r ? [r.id] : [])); }
  else parts.push(say(S, 'op.generic'));
  parts.push(pivot(S));
  return { parts, topics: ['opinion'], ask: null };
};

P.compliment = (S, u) => {
  const v = S.v, parts = [];
  if (v.relq.guarded) parts.push(say(S, 'comp.guarded'));
  else {
    parts.push(say(S, 'comp.thanks'));
    if ((v.big5.A >= 0.5 || v.big5.E >= 0.55) && S.rng.chance(0.6)) parts.push(say(S, 'comp.back'));
  }
  S.st.cs = 'thanks';
  return { parts, topics: ['self'], emotion: 'pleased', ask: null };
};

// Hostile probes, by kind: what the NPC says back. An accusation gets a plain no and a word about the question.
const PROBE_HOSTILE = { group: 'probe.hostile', status: 'probe.statusHostile', leave: 'probe.leave', hate: 'probe.hate', slur: 'probe.slur', accuse: 'probe.accuse' };

P.insult = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  st.insults += 1;
  const tox = u.appraisal.toxicity;
  if (st.ended) { parts.push(say(S, 'insult.after') || say(S, 'insult.end')); return { parts, topics: [], noAsk: true, emotion: 'angry' }; }
  const pr = u.flags && u.flags.probe;
  if (pr) {
    // a stereotype, a status probe, "go back", a slur, a declared hate: pushed back on, never played along with;
    // the worst of them end the conversation at once
    st.cs = false;
    const key = pr.kind === 'accuse' && pr.group ? 'probe.accuseGroup' : PROBE_HOSTILE[pr.kind] || 'probe.hostile';
    parts.push(say(S, key) || say(S, PROBE_HOSTILE[pr.kind] || 'probe.hostile') || say(S, 'probe.hostile'));
    const severe = ['slur', 'hate', 'leave'].includes(pr.kind);
    if (severe || st.insults >= 2) { parts.push(say(S, 'insult.end')); st.ended = true; }
    return { parts, topics: [], noAsk: true, emotion: severe || st.insults >= 2 ? 'angry' : v.big5.A >= 0.55 ? 'hurt' : 'annoyed' };
  }
  if (/\b(f+u+c+k|shit|bitch|ass(hole)?|damn|crap|dick|bastard)\w*/i.test(u.text) && S.rng.chance(0.5)) parts.push(say(S, 'insult.language'));
  const feelings = v.relq.feelings;
  if (st.insults >= 2 || tox >= 0.8) { parts.push(say(S, 'insult.end')); st.ended = true; return { parts, topics: [], noAsk: true, emotion: feelings === 'hurt' ? 'hurt' : 'angry' }; }
  if (v.humor >= 0.6 && v.big5.A >= 0.55 && tox < 0.5 && S.rng.chance(0.4)) parts.push(say(S, 'insult.shrug'));
  else parts.push(say(S, feelings === 'hurt' || v.big5.A >= 0.55 ? 'insult.hurt' : 'insult.annoyed'));
  return { parts, topics: [], noAsk: true, emotion: feelings === 'hurt' || v.big5.A >= 0.55 ? 'hurt' : 'annoyed' };
};

/**
 * A question that sorts people into groups, asks about immigration status or prejudice: the NPC declines and pushes
 * back, in their own register, and moves on; a player who keeps at it loses the conversation.
 */
P.probe = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  const pr = (u && u.flags && u.flags.probe) || { kind: 'group' };
  st.probes = (st.probes || 0) + 1;
  st.cs = false;
  if (st.probes >= 3) {
    st.insults += 1;
    parts.push(say(S, 'probe.again'));
    if (st.insults >= 2) { parts.push(say(S, 'insult.end')); st.ended = true; }
    return { parts, topics: [], noAsk: true, emotion: 'annoyed' };
  }
  const key = pr.kind === 'status' ? 'probe.status' : pr.kind === 'bias' ? 'probe.bias' : pr.kind === 'selfBias' ? 'probe.selfBias' : pr.positive ? 'probe.groupPositive' : 'probe.group';
  parts.push(say(S, key) || say(S, 'probe.group'));
  if (st.probes === 1 && !v.relq.guarded && pr.kind !== 'status' && S.rng.chance(0.5)) parts.push(pivot(S));
  return { parts, topics: [], noAsk: true, emotion: pr.kind === 'status' ? 'tense' : null };
};

P.joke = (S, u) => {
  const v = S.v, parts = [];
  if (v.relq.guarded) { parts.push(say(S, 'joke.decline')); return { parts, topics: [], noAsk: true }; }
  if (v.age < 13) { parts.push(say(S, 'joke.kid')); return { parts, topics: ['joke'], emotion: 'amused', noAsk: true }; }
  if (v.humor < 0.3 && S.rng.chance(0.6)) { parts.push(say(S, 'joke.decline')); if (S.rng.chance(0.5)) parts.push(say(S, 'joke.pun')); return { parts, topics: ['joke'], noAsk: true }; }
  const opts = [];
  const r = G.roadFacts(v)[0];
  if (r && (v.flags.commuter || v.speaker.drives)) opts.push(['joke.local.traffic', { road: r.name }, [r.id]]);
  if (v.flags.coast && num(v.z.tjul, 80) < 75) opts.push(['joke.local.coast', {}, ['clim.tjul']]);
  if (v.flags.hotPlace) {
    // the number in the joke is a real one: the July average high when it is that hot, else the record
    const tj = isNum(v.z.tjul) ? Math.round(v.z.tjul) : null;
    const rh0 = G.recordFacts(v).heat, rh = rh0 && rh0.local ? rh0 : null;
    const hot = tj !== null && tj >= 98 ? { temp: tj, id: 'clim.tjul' } : rh ? { temp: rh.value, id: rh.id } : null;
    opts.push(['joke.local.heat', { temp: hot ? hot.temp : null }, hot ? [hot.id] : []]);
  }
  if (v.speaker.tenure === 'rent') opts.push(['joke.local.rent', {}, []]);
  if (v.speaker.tenure === 'own' && v.flags.house) opts.push(['joke.local.house', {}, []]);
  if (v.humorStyle === 'dry' || v.humorStyle === 'wry') opts.push(['joke.dry', {}, []]);
  opts.push(['joke.pun', {}, []], ['joke.pun', {}, []]);
  for (const [k, s, f] of S.rng.shuffle(opts.slice())) { const p = say(S, k, s, f); if (p) { parts.push(p); break; } }
  if (S.rng.chance(0.4)) parts.push(say(S, 'joke.laugh'));
  return { parts, topics: ['joke'], emotion: 'amused', noAsk: true };
};

P.thanks = (S, u) => {
  const parts = [say(S, 'thanks.reply')];
  S.st.cs = 'polite';
  return { parts, topics: [], emotion: 'pleased', ask: null };
};

P.apology = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  if (st.insults > 0 || v.relq.grievance > 0) {
    if (v.big5.A >= 0.5) { parts.push(say(S, 'apology.forgive')); st.ended = false; st.insults = 0; }
    else { parts.push(say(S, 'apology.grudging')); st.ended = false; st.insults = Math.max(0, st.insults - 1); }
  } else parts.push(say(S, 'apology.none'));
  S.st.cs = 'no_problem';
  return { parts, topics: [], noAsk: true };
};

// Interests that are a sport someone plays (not one they watch), as they say it: [English, Spanish].
const PLAYED = {
  'soccer practice': ['I play soccer.', 'Juego fútbol.'], 'Little League': ['I play Little League.', 'Juego béisbol en la liga infantil.'],
  basketball: ['I play basketball.', 'Juego básquetbol.'], 'school sports': ["I'm on a team at school.", 'Estoy en un equipo de la escuela.'],
  tennis: ['I play tennis.', 'Juego tenis.'], golf: ['I play golf.', 'Juego golf.'], running: ['I run.', 'Salgo a correr.'], surfing: ['I surf.', 'Surfeo.'],
  skateboarding: ['I skate.', 'Ando en patineta.'], 'skiing and snowboarding': ['I ski in the winter.', 'Esquío en el invierno.'],
  'biking around town': ['I ride my bike a lot.', 'Ando mucho en bicicleta.'], 'the gym': ['Mostly I just go to the gym.', 'Más que nada voy al gimnasio.'],
};

// The teams a player names, as said in a sentence.
const TEAM_LABELS = {
  dodgers: 'the Dodgers', giants: 'the Giants', lakers: 'the Lakers', warriors: 'the Warriors', '49ers': 'the 49ers', niners: 'the Niners', rams: 'the Rams',
  padres: 'the Padres', angels: 'the Angels', kings: 'the Kings', sharks: 'the Sharks', clippers: 'the Clippers', chargers: 'the Chargers', ducks: 'the Ducks',
  galaxy: 'the Galaxy', lafc: 'LAFC', "a's": "the A's", athletics: 'the Athletics', 'fresno state': 'Fresno State', ucla: 'UCLA', usc: 'USC', 'san diego fc': 'San Diego FC',
};

// "Did you see the game last night?", "you catch the Niners game?"
const GAME_Q = /\b(did|do)? ?(you|ya) (see|catch|watch) (the|that|last night'?s?|yesterday'?s?|their|our)\b.*\b(game|match)\b|\b(see|catch|watch) the game\b/;

// The months a league plays, regular season through the finals (first and last month, wrapping the new year).
const SEASONS = { basketball: [10, 6], hockey: [10, 6], baseball: [3, 10], football: [9, 2], soccer: [2, 12] };

/** Whether a sport's season is on in this month (1-12); true for a sport the table does not know. */
function inSeason(sport, month) {
  const s = SEASONS[sport];
  if (!s || !isNum(month)) return true;
  const [a, b] = s;
  return a <= b ? month >= a && month <= b : month >= a || month <= b;
}

/**
 * "What are you doing for Thanksgiving?", "are you working on Thanksgiving?", "are you cooking a turkey?": the day as
 * the record has it. On the schedule that day (their work days, and work that goes on through holidays) or off; then
 * who they will be with, from the household (a full house to host, dinner with the family, the two of them, a quiet
 * one alone); the cooking from someone who likes to cook. No trip, guest or relative is made up.
 */
function holidayPlans(S, u) {
  const v = S.v, R = v.rel, parts = [];
  const when = holidayWhen(u.entities.holiday, v.t);
  if (!when) return null;
  const H = HOLIDAYS[when.key];
  const slots = { holiday: H.en, holidayCap: capFirst(H.en), holidayEs: H.es, holidayEsCap: capFirst(H.es) };
  const q = u.norm;
  const kind = /\bwork(?:ing)?\b|\boff\b|\bshift\b/.test(q) ? 'work' : /\bturkey|\bcook|\bbak(?:e|ing)\b|\bmak(?:e|ing) (?:dinner|the food)\b/.test(q) ? 'cook'
    : /\b(?:go|going|travel\w*|fly|flying|drive|driving|visit\w*|anywhere|out of town|head(?:ing)? (?:out|home))\b/.test(q) ? 'travel' : 'plans';
  const works = worksHoliday(v, when);
  if (works) parts.push(say(S, v.flags.onFarm ? 'hol.farm' : 'hol.working', slots, [REC.commute]));
  else if (kind === 'work' && v.speaker.works === true) parts.push(say(S, 'hol.off', slots, [REC.commute]));
  if (kind === 'travel' && !works) parts.push(say(S, 'hol.stay', slots, [REC.home]));
  const head = ['householder', 'spouse', 'partner'].includes(v.npc.role) && v.age >= 18;
  const others = R.kids.length + R.grandkids.length + R.parents.length + R.siblings.length + R.relatives.length + R.grandparents.length;
  const key = v.age < 18 ? 'hol.kid' : v.flags.alone ? 'hol.alone' : R.roommates.length && !R.partner && !others ? 'hol.roommates'
    : head && others >= 2 ? 'hol.hosting' : R.partner && !others ? 'hol.couple' : 'hol.family';
  // (on the schedule that day, the family meal waits for the shift; a farm's chores come first, then dinner)
  const shift = works && !v.flags.onFarm;
  if (!(works && kind === 'work')) parts.push(say(S, shift ? 'hol.after' : key, slots, [REC.home]));
  const cooks = v.interests.includes('cooking') && !shift;
  if (cooks && v.age >= 16 && (kind === 'cook' || S.rng.chance(0.5))) parts.push(say(S, 'hol.cook', slots, ['persona.interests']));
  else if (kind === 'cook') parts.push(say(S, v.flags.alone ? 'hol.notCookAlone' : 'hol.notCook', slots));
  S.st.cs = false;
  return { parts, topics: ['holiday'], ask: 'holiday', askSlots: { holiday: H.en, holidayEs: H.es } };
}

P.smalltalk = (S, u) => {
  const v = S.v, parts = [];
  const q = u.norm;
  // (asked again with nothing new to add, the answer is owned as a repeat, not swapped for the weekend's plans)
  if (u.entities && u.entities.holiday && u.flags.holidayAsk) { const hp = holidayPlans(S, u); if (hp) return hp; }
  if (/what are you (up to|doing)|what'?re you (up to|doing)|where are you (going|headed|off to)|what brings you|what'?s going on/.test(q) && !/weekend|tonight|tomorrow|later|plans/.test(q)) {
    parts.push(activityLine(S));
    return { parts, topics: ['self'], ask: 'howAreYou' };
  }
  if (u.entities.team || /\b(game|team|season|playoffs?|sports?|baseball|basketball|football|soccer|hockey)\b/.test(q)) {
    // "do you play any sports?" is about playing; a team they follow is for watching
    if (/\b(do|did) (you|ya) play\b|\b(you|ya) play (any|a|some)\b|\bplay any sports\b/.test(q)) {
      const plays = v.interests.find(i => PLAYED[i]);
      const line = plays ? PLAYED[plays] : null;
      parts.push(line ? say(S, 'small.playYes', { sportLine: line[0], sportLineEs: line[1] }, ['persona.interests'])
        : say(S, 'small.playNo', {}, v.team ? ['persona.teams'] : []));
      return { parts, topics: ['sports'], ask: v.team && !plays ? 'team' : null };
    }
    // "do you like the 49ers?" of someone who roots for another team, or for none: said so
    const askedTeam = u.entities.team ? String(u.entities.team).toLowerCase() : null;
    if (askedTeam && !GAME_Q.test(q)) {
      const bare = askedTeam.replace(/^the /, '');
      const mine = v.team && (String(v.team.name).toLowerCase().includes(bare) || bare.includes(String(v.team.name).toLowerCase().replace(/^the /, '')));
      if (!mine) {
        const label = TEAM_LABELS[bare] || bare;
        parts.push(say(S, v.team ? 'small.otherTeamFan' : 'small.notAFan', { askedTeam: label, askedTeamEs: label.replace(/^the /, 'los ') }, v.team ? ['persona.teams'] : []));
        return { parts, topics: ['sports'], ask: null };
      }
    }
    // "did you see the game last night?": their team's game, in its season; another team's; or no team at all
    if (GAME_Q.test(q)) {
      const asked = u.entities.team ? String(u.entities.team).toLowerCase() : null;
      const mine = v.team && (!asked || String(v.team.name).toLowerCase().includes(asked.replace(/^the /, '')) || asked.includes(String(v.team.name).toLowerCase()));
      if (v.team && mine) {
        const sport = ((v.p.teams || []).find(t => t && t.name === v.team.name) || {}).sport;
        parts.push(say(S, inSeason(sport, v.P.month) ? 'small.sawGame' : 'small.offSeason', {}, ['persona.teams']));
      } else parts.push(say(S, v.team ? 'small.otherTeam' : 'small.noGame', {}, v.team ? ['persona.teams'] : []));
      return { parts, topics: ['sports'], ask: null };
    }
    parts.push(v.team ? say(S, 'small.sports', {}, ['persona.teams']) : say(S, 'small.noSports'));
    return { parts, topics: ['sports'], ask: v.team ? 'team' : null };
  }
  if (/weekend|plans|tonight|tomorrow/.test(q)) {
    const trad = new Set((v.p.interestDetails || []).filter(d => d.tradition).map(d => d.name));
    const fav = v.interests.find(i => !trad.has(i) && !isPractice(v, i) && !/church|services|gurdwara|baby|picture books|stuffed/.test(i));
    const talk = fav ? interestTalk(fav) : null;
    parts.push(talk ? say(S, 'small.weekendPlan', { interestShort: talk.short }, ['persona.interests']) : say(S, 'small.new'));
    return { parts, topics: ['self'], ask: 'weekend' };
  }
  parts.push(say(S, 'small.new'));
  parts.push(pivot(S));
  return { parts, topics: ['self'], ask: null };
};

P.goodbye = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  st.closed = true;
  if (v.relq.guarded || st.ended) { parts.push(say(S, 'bye.guarded') || say(S, 'bye.say')); return { parts, topics: [], noAsk: true }; }
  const a = v.activity;
  const reason = a && a.kind === 'work' ? 'bye.work'
    : v.flags.littleKids && v.hour >= 14 && v.hour < 16 ? 'bye.kids'
      : v.hour >= 20 || v.hour < 5 ? 'bye.late'
        : a && a.kind === 'commute' ? 'bye.commute' : null;
  if (reason && S.rng.chance(0.5)) parts.push(say(S, reason));
  const named = v.relq.name && S.rng.chance(0.5) ? say(S, 'bye.name') : null;
  parts.push(named || (v.lang.mode === 'en' && S.rng.chance(0.4) ? lex(S, 'farewells') : null) || say(S, 'bye.say') || lex(S, 'farewells'));
  if (v.relq.affinity >= 0.15 && S.rng.chance(0.5)) parts.push(say(S, 'bye.next'));
  S.st.cs = S.rng.chance(0.5) ? 'farewell' : 'take_care';
  return { parts, topics: [], noAsk: true };
};

P.unknown = (S, u) => {
  const v = S.v, parts = [];
  const letters = (u.text.match(/\p{L}/gu) || []).length;
  // a laugh after their joke is understood in any language
  if (!u.question && S.st.prevIntent === 'joke' && (u.appraisal.sentiment >= 0.1 || /\b(ha|haha|lol|lmao|funny|hilarious|good one)\b/.test(u.norm))) { S.st.cs = false; return { parts: [say(S, 'joke.thanks')], topics: ['joke'], emotion: 'amused', ask: null }; }
  if (letters < 2 || u.flags.unclear || (v.lang.limited && !u.flags.spanish && S.rng.chance(0.6))) {
    parts.push(say(S, u.flags.spanish && v.lang.mode === 'es' ? 'unk.confusedEs' : 'unk.confused'));
    parts.push(pivot(S));
    return { parts, topics: [], ask: null };
  }
  const short = u.norm.split(' ').length <= 6;
  if (!u.question && S.st.prevIntent === 'joke' && (u.appraisal.sentiment >= 0.1 || /\b(ha|haha|lol|lmao|funny|hilarious|good one)\b/.test(u.norm))) { S.st.cs = false; return { parts: [say(S, 'joke.thanks')], topics: ['joke'], emotion: 'amused', ask: null }; }
  if (!u.question && short && u.appraisal.sentiment >= 0.25) { parts.push(say(S, 'react.positive') || say(S, 'unk.statement')); if (S.rng.chance(0.5)) parts.push(pivot(S)); return { parts, topics: [], ask: null }; }
  const fav = favoriteParts(S, u);
  if (fav) return { parts: fav, topics: ['self'], ask: null };
  if (u.question && u.flags.aboutYou) {
    // a question about their own life the engine has no reading for: they deflect and move on; they never claim
    // not to know their own life. A yes-or-no question gets a light non-answer or is turned back ("Why, do you?"),
    // never "that's a long story" or "why do you ask?", which would read as hiding something; nor is anything
    // unkind turned back.
    const aux = /^(do|does|did|are|is|were|was|have|has|can|could|would|will)\s+you\b/.exec(u.norm);
    const AUX = { does: 'do', is: 'are', was: 'were', has: 'have' };
    const kind = u.appraisal.sentiment > -0.1 && !(u.appraisal.toxicity > 0);
    parts.push(aux ? say(S, 'unk.aboutMeYesNo', { aux: kind ? AUX[aux[1]] || aux[1] : null }) : say(S, 'unk.aboutMe'));
    const p = pivot(S);
    if (p) parts.push(p);
    S.st.cs = false;
    return { parts, topics: [], ask: p ? null : 'visiting' };
  }
  if (u.question) parts.push(say(S, 'unk.question'));
  else if (u.appraisal.sentiment <= -0.25) parts.push(say(S, 'hay.answerBad'));
  else if (u.appraisal.sentiment >= 0.3 && v.lang.mode === 'en' && S.rng.chance(0.5)) parts.push(lex(S, 'agreement') || say(S, 'unk.statement'));
  else parts.push((v.lang.mode === 'en' && S.rng.chance(0.3) ? lex(S, 'surprise') : null) || say(S, 'unk.statement'));
  if (S.rng.chance(0.75)) parts.push(pivot(S));
  // a reaction in the home language only to news worth one: never "how outrageous!" after a plain remark
  S.st.cs = u.question ? false : u.appraisal.sentiment >= 0.3 ? 'delight' : /\b(really|no way|can you believe|guess what|wow)\b/.test(u.norm) ? 'surprise' : false;
  return { parts, topics: [], ask: S.rng.chance(0.5) ? null : 'visiting' };
};

// Favorite things are tastes, the speaker's own: drawn from their id so they never change, and from their life where it
// says something (their team's sport, their family's holidays). No titles, so no brands.
const FAVORITES = {
  color: ['blue', 'green', 'red', 'purple', 'yellow', 'orange', 'black', 'gray', 'brown', 'teal'],
  animal: ['dogs', 'cats', 'horses', 'birds', 'elephants', 'otters', 'turtles', 'owls'],
  holiday: ['Thanksgiving', 'the Fourth of July', "New Year's", 'Halloween'],
  season: ['spring', 'summer', 'fall', 'winter'],
};
const TEAM_SPORT = /Dodgers|Giants|Padres|Angels|Athletics|A's/i;
const FAV_RE = /\bfavou?rite (colou?r|animal|holiday|season|time of year|sport|music|song|band|movie|film|show|tv show|book|singer|artist|thing to do)\b/;

/** An answer to "what's your favorite ___?", or null. */
function favoriteParts(S, u) {
  const m = FAV_RE.exec(u.norm);
  const asked = m ? m[1] : u.entities && u.entities.favorite;
  if (!asked) return null;
  S.st.cs = false;
  const v = S.v, kind = asked.replace(/colour/, 'color').replace(/time of year/, 'season').replace(/tv show|^shows$|^tv$/, 'show').replace(/^movies$|^films$/, 'movie').replace(/^books$/, 'book');
  const pick = list => list[hashStr(`${v.p.id}:fav:${kind}`) % list.length];
  if (kind === 'sport') {
    if (!v.team) return [say(S, 'small.noSports')];
    const sport = TEAM_SPORT.test(v.team.name) ? 'baseball' : /Lakers|Warriors|Clippers|Kings$|Sacramento Kings/i.test(v.team.name) && !/LA Kings/.test(v.team.name) ? 'basketball' : /Rams|Chargers|49ers|Niners/i.test(v.team.name) ? 'football' : /Sharks|Ducks|LA Kings/i.test(v.team.name) ? 'hockey' : /Galaxy|LAFC|FC/i.test(v.team.name) ? 'soccer' : null;
    return [sport ? say(S, 'fav.sport', { fav: sport }, ['persona.teams']) : say(S, 'about.team', {}, ['persona.teams'])];
  }
  if (kind === 'holiday') {
    const trad = (v.p.interestDetails || []).find(d => d.tradition);
    if (trad) return [say(S, 'fav.thing', { fav: trad.name, favCap: capFirst(trad.name) }, ['persona.interests'])];
  }
  if (FAVORITES[kind]) {
    const fav = pick(FAVORITES[kind]);
    return [say(S, `fav.${kind}`, { fav, favCap: capFirst(fav) }) || say(S, 'fav.thing', { fav, favCap: capFirst(fav) }) || say(S, 'fav.taste')];
  }
  return [say(S, 'fav.taste')];
}

// A place an errand or an outing takes them to, in Spanish, by its kind: [article, noun]. A place not here is said
// without its name ("Ando haciendo mandados"), never as another place ("Voy a la tienda" on the way to the laundromat).
const PLACE_ES = {
  grocery: ['la', 'tienda'], pharmacy: ['la', 'farmacia'], laundromat: ['la', 'lavandería'], hardware: ['la', 'ferretería'],
  'post-office': ['el', 'correo'], park: ['el', 'parque'], gym: ['el', 'gimnasio'], beach: ['la', 'playa'], stadium: ['el', 'estadio'],
};

/**
 * "al parque", "de la farmacia", "en la lavandería": a place's Spanish slots. A place known by its own name ("Lake
 * Casitas", "Santa Monica Bay") is said by it in Spanish too; in plain English only the English side is shown, so any
 * place will do there. {} when the place has no Spanish here.
 */
function placeEsSlots(place, mode) {
  const e = place && PLACE_ES[place.kind];
  if (e) {
    const [art, noun] = e;
    return { placeAEs: art === 'el' ? `al ${noun}` : `a la ${noun}`, placeDeEs: art === 'el' ? `del ${noun}` : `de la ${noun}`, placeEnEs: `en ${art} ${noun}` };
  }
  const label = place && place.kind !== 'home' ? str(place.label) : null;
  if (label && (mode === 'simple' || (/^[A-Z]/.test(label) && !/^The\b/.test(label)))) return { placeAEs: `a ${label}`, placeDeEs: `de ${label}`, placeEnEs: `en ${label}` };
  return {};
}

/** "Just heading to the grocery store", "I'm at the laundromat": what they are doing right now, at the place they are. */
export function activityLine(S) {
  const v = S.v, a = v.activity;
  if (!a) return say(S, 'act.home');
  const back = a.traveling && a.place && a.place.kind === 'home';
  const label = String(back ? a.label || '' : (a.place && a.place.label) || a.label || '').replace(/^home from /, '');
  const slots = { placeLabel: label, placeLabelCap: capFirst(label), city: a.place && a.place.city ? a.place.city : (str(label) && /^family in (.+)$/.exec(label) || [])[1] || null };
  // the place by name in Spanish (and in plain English, which reads the Spanish lines' glosses)
  const es = v.lang.mode !== 'en' ? placeEsSlots(back ? a.from : a.place, v.lang.mode) : {};
  Object.assign(slots, es);
  const facts = ['schedule.activity'];
  // there already ("I'm at the laundromat"), on the way ("Heading to the park"), or on the way back
  const at = !a.traveling && !back && label && a.place && a.place.kind !== 'home';
  const named = (key, fallback) => (es.placeAEs || (v.lang.mode === 'en' && at) ? say(S, key, slots, facts) : null) || say(S, fallback, slots, facts);
  switch (a.kind) {
    case 'commute': return a.leg === 'back' ? say(S, a.place && a.place.kind === 'home' && v.npc.school && v.age < 18 ? 'act.schoolBack' : 'act.commuteBack', slots, facts)
      : say(S, v.npc.school && v.age < 18 ? 'act.schoolOut' : 'act.commuteOut', slots, facts);
    case 'work': return say(S, a.place && a.place.kind === 'home' ? (v.flags.onFarm ? 'act.onFarm' : 'act.wfh') : 'act.work', slots, facts);
    case 'school': return say(S, 'act.school', slots, facts);
    case 'errand': return back ? named('act.errandBackAt', 'act.errandBack') : named(at ? 'act.errandHere' : 'act.errandAt', 'act.errand');
    case 'leisure': return back ? named('act.errandBackAt', 'act.errandBack') : named(at ? 'act.leisureHere' : 'act.leisureAt', 'act.leisure');
    case 'exercise': return say(S, back ? 'act.exerciseBack' : 'act.exercise', slots, facts);
    case 'worship': return say(S, 'act.worship', slots, facts);
    case 'visit': return say(S, 'act.visit', slots, facts) || say(S, 'act.leisure', slots, facts);
    case 'sleep': return say(S, 'act.sleep', slots, facts);
    default: return say(S, 'act.home', slots, facts);
  }
}

/**
 * Something on their mind, from the persona's hooks (an alert or the weather, a worry, an interest, a memory, the
 * family), not one already brought up in this conversation. Sets the topic so "tell me more" follows it.
 */
export function pivot(S, opts = {}) {
  const v = S.v, st = S.st;
  const covered = h => {
    if (h.kind === 'memory') { const m = (v.p.memories || []).find(x => (x.title || x.text) === h.text); return !!m && (st.usedMemories.has(m.source) || st.used.has(memoryFact(m))); }
    if (h.kind === 'concern') return !!(st.depth[{ fire: 'fire', insurance: 'insurance', rent: 'rent', housing: 'housing', traffic: 'traffic', weather: 'weather' }[h.topic]]);
    if (h.kind === 'weather') return !!st.depth.weather;
    if (h.kind === 'family') return !!st.depth.family;
    return false;
  };
  const hooks = (v.p.hookDetails || []).filter(h => !st.hooksUsed.has(`${h.kind}:${h.text}`) && !covered(h));
  const pool = opts.only ? hooks.filter(h => opts.only.includes(h.kind)) : hooks;
  const order = opts.prefer ? pool.slice().sort((a, b) => (opts.prefer.includes(b.kind) ? 1 : 0) - (opts.prefer.includes(a.kind) ? 1 : 0)) : pool;
  for (const h of order) {
    st.hooksUsed.add(`${h.kind}:${h.text}`);
    let p = null;
    if (h.kind === 'weather') {
      const a = v.alerts[0];
      p = a ? say(S, 'pivot.alert', { alert: a.event }, [`alert:${a.event}`]) : say(S, 'pivot.weather', { temp: exactTemp(v), sky: G.skyWords(v.wx.now && v.wx.now.short) }, ['weather.now']);
      if (p) st.pivotIntent = 'weather';
    } else if (h.kind === 'concern') {
      const c = (v.p.concerns || []).find(x => (CONCERN_WORDS[x.topic] || [])[0] === h.text || x.area === h.topic);
      const words = c && CONCERN_WORDS[c.topic] ? CONCERN_WORDS[c.topic] : [h.text, null];
      // ("lo que me preocupa son los incendios": the verb agrees with a plural worry)
      p = say(S, 'pivot.concern', { concern: words[0], concernCap: capFirst(words[0]), concernEs: words[1], esSon: copulaEs(words[1]) }, ['persona.concerns']);
      if (p) st.pivotIntent = { fire: 'fire', insurance: 'insurance', rent: 'rent', housing: 'housing', traffic: 'traffic', weather: 'weather', job: 'job', family: 'family', neighborhood: 'neighborhood' }[h.topic] || null;
    } else if (h.kind === 'interest') {
      const det = (v.p.interestDetails || []).find(d => d.name === h.text);
      // (their own practice is not a pastime to wish for: "I'd rather be at Sunday services" is not said)
      const talk = (det && det.tradition) || isPractice(v, h.text) ? null : interestTalk(h.text);
      if (talk) {
        const es = S.rng.pick(talk.es);
        p = say(S, 'pivot.interest', { interestShort: talk.short, interestShortCap: capFirst(talk.short), interestEs: es[0], interestEn: es[1] }, ['persona.interests']);
      }
      if (p) st.pivotIntent = 'about-them';
    } else if (h.kind === 'memory') {
      const m = (v.p.memories || []).find(x => (x.title || x.text) === h.text);
      if (m) { const memEs = memoryEs(m); p = say(S, 'pivot.memory', { memTitle: memTitleOf(m), memEs, esSon: copulaEs(memEs) }, [memoryFact(m)]); if (p) st.usedMemories.add(m.source); }
      if (p) st.pivotIntent = m && m.kind === 'fire' ? 'fire' : 'history';
    } else if (h.kind === 'family') {
      p = say(S, 'pivot.family', {}, [REC.home]);
      if (p) st.pivotIntent = 'family';
    } else if (h.kind === 'place') {
      p = say(S, 'pivot.place');
      if (p) st.pivotIntent = 'neighborhood';
    }
    if (p) return p;
  }
  return null;
}

/** The planner table. */
export const PLANNERS = P;

// ------------------------------------------------------------------ answers to the NPC's own questions

// Jobs a player can name, from the occupation catalog (titles and their head nouns) plus the everyday ones.
const EVERYDAY_JOBS = ('nurse teacher doctor physician surgeon dentist pharmacist therapist counselor lawyer attorney paralegal judge engineer developer '
  + 'programmer coder designer architect scientist researcher professor librarian accountant bookkeeper cashier server waiter waitress bartender '
  + 'barista cook chef baker driver trucker pilot mechanic electrician plumber carpenter roofer painter welder machinist firefighter officer cop '
  + 'deputy detective guard soldier sailor marine farmer farmworker rancher gardener landscaper janitor housekeeper cleaner nanny caregiver aide '
  + 'assistant receptionist secretary technician tech emt paramedic hygienist contractor builder laborer foreman inspector writer reporter '
  + 'journalist editor photographer artist musician actor actress dancer animator entrepreneur owner freelancer student homemaker housewife '
  + 'hairstylist stylist barber butcher fisherman logger longshoreman stocker courier salesperson salesman saleswoman pastor priest minister '
  + 'rabbi imam chaplain veterinarian vet tutor coach trainer lifeguard dispatcher operator picker principal translator interpreter manager '
  + 'supervisor director administrator consultant analyst realtor agent broker banker teller clerk retired').split(' ');
let JOB_WORDS = null;

/** True for a job a person could have ("registered nurse", "farm worker", "teacher"), not an evaluation or a joke. */
export function knownJob(job) {
  if (!JOB_WORDS) {
    JOB_WORDS = new Set(EVERYDAY_JOBS);
    for (const list of Object.values(OCCUPATION_CATALOG || {})) for (const o of list || []) {
      const t = String(o && o.title || '').toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
      if (t) { JOB_WORDS.add(t); JOB_WORDS.add(t.split(/\s+/).pop()); }
    }
  }
  const j = String(job || '').toLowerCase().trim().replace(/^(a|an)\s+/, '').replace(/[.!?]+$/, '');
  if (!j || /^(good|bad|great|terrible|awful|amazing|decent|hard|real|true|proud|big|huge|total|complete|better|worse|best|worst|nice|cool|lucky|happy|sad|tired|bored|busy)\b/.test(j)) return false;
  return JOB_WORDS.has(j) || JOB_WORDS.has(j.split(/\s+/).pop()) || /^stay-at-home (mom|dad|parent|mother|father)$/.test(j);
}

/** The NPC's own answer to the question they just asked, when the player turns it back ("good, and you?"). */
function answerBack(S, key, u) {
  const v = S.v;
  const take = (plan, n = 1) => (plan && plan.parts ? plan.parts.filter(Boolean).slice(0, n) : []);
  switch (key) {
    case 'howAreYou': return take(P['how-are-you'](S, u));
    case 'from': return originParts(S).slice(0, 1);
    case 'lives': return [say(S, 'home.where')];
    case 'job': return take(P.job(S, null, { brief: true }));
    case 'kids': return take(P.family(S, Object.assign({}, u, { norm: 'do you have kids', flags: Object.assign({}, u.flags, { sub: null }) })), 2);
    case 'weekend': return interestParts(S, 1);
    case 'food': return [say(S, 'food.mine')];
    case 'team': return v.team ? [say(S, 'about.team', {}, ['persona.teams'])] : [say(S, 'small.noSports')];
    case 'name': return S.st.gaveName ? [] : [giveName(S)];
    default: return [];
  }
}

const TURNED_BACK = /\b(?:and|how about|what about) (?:you|yourself|u)\b[?.!]*$|^(?:you|and you|u)\?*$/;

// "Tell me about ...", "Describe ...", "What about your ...": a request, never an answer to the NPC's question.
const REQUEST = /^(?:(?:so|and|now|ok|okay|well),? )?(?:(?:can|could|would|will) you |please )?(?:tell (?:me|us)|talk(?: to me)?|describe|explain|say (?:more|something)|what about your)\b/;
// The NPC's own life, named in a line: family, kids, neighborhood, job, home, town, school.
const TOPIC_NOUN = /\byour (?:family|kids|children|neighborhood|neighbors|job|work|house|home|place|town|city|school|street|life|parents|wife|husband|partner)\b/;
const TOPIC_NOUN_INTENTS = new Set(['family', 'job', 'home', 'neighborhood', 'about-them', 'housing']);

// Places outside California a player may say they come from: the other states, countries and regions, and big cities
// whose names no California town shares (Dublin, Ontario, Richmond and Lancaster are towns here too).
const FAR_PLACE = new RegExp(`\\b(?:${[
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  'Mexico', 'Canada', 'China', 'Taiwan', 'Hong Kong', 'Japan', 'South Korea', 'Korea', 'the Philippines', 'Philippines', 'Vietnam', 'Thailand', 'Cambodia', 'Laos',
  'India', 'Pakistan', 'Bangladesh', 'Afghanistan', 'Iran', 'Iraq', 'Syria', 'Lebanon', 'Israel', 'Armenia', 'Russia', 'Ukraine', 'Poland', 'Germany', 'France',
  'Italy', 'Spain', 'Portugal', 'England', 'Scotland', 'Ireland', 'Britain', 'the UK', 'the Netherlands', 'Sweden', 'Norway', 'Denmark', 'Greece', 'Turkey',
  'Egypt', 'Ethiopia', 'Eritrea', 'Nigeria', 'Kenya', 'Ghana', 'Brazil', 'Argentina', 'Chile', 'Peru', 'Colombia', 'Venezuela', 'Ecuador', 'Bolivia', 'Cuba',
  'Puerto Rico', 'Jamaica', 'Haiti', 'the Dominican Republic', 'El Salvador', 'Guatemala', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panama', 'Australia',
  'New Zealand', 'Samoa', 'Tonga', 'Fiji', 'Indonesia', 'Malaysia', 'Singapore', 'Myanmar', 'Burma', 'Europe', 'Asia', 'Africa', 'South America',
  'Central America', 'the Midwest', 'the East Coast', 'back East', 'New York City', 'Chicago', 'Boston', 'Seattle', 'Las Vegas', 'Vegas', 'Denver', 'Dallas',
  'Houston', 'Miami', 'Atlanta', 'Philadelphia', 'Detroit', 'Phoenix', 'Mexico City', 'Tijuana', 'Guadalajara', 'Manila', 'Seoul', 'Tokyo', 'Beijing',
  'Shanghai', 'Hanoi', 'Saigon', 'Taipei', 'London', 'Paris',
].sort((a, b) => b.length - a.length).join('|')})\\b`);

/**
 * When the NPC asked the player something last turn and the player answers it, react to the answer and
 * remember it (never a crude, hateful or joke value). Returns a plan, or null when the player's line is not an answer.
 * @param {object} S the session
 * @param {object} u understand() output
 * @returns {object|null}
 */
export function answerPending(S, u) {
  const plan = answerPending0(S, u);
  if (!plan || !S.st.pendingAsked) return plan;
  // "Good, and you?": the NPC answers its own question too
  if (TURNED_BACK.test(u.norm)) plan.parts.push(...answerBack(S, S.st.pendingAsked, u));
  return plan;
}

function answerPending0(S, u) {
  const v = S.v, st = S.st;
  st.pendingAsked = st.pending;
  // a hello in another language, or "Happy Thanksgiving!", answers no question: it is a greeting of its own
  if (u.entities && (u.entities.foreignLangs || (u.entities.holiday && u.flags.holidayGreeting))) return null;
  let key = st.pending;
  if (!key) {
    // "I'm from Fresno", "I'm a nurse": volunteered, not asked, but worth the same reaction
    const told = u.appraisal.facts.find(f => f.key === 'from' || f.key === 'lives' || f.key === 'job');
    const topical = Object.entries(u.scores).some(([k, sc]) => sc >= 3.5 && !['greeting', 'thanks', 'apology', 'compliment', 'name'].includes(k));
    if (!told || u.question || topical) return null;
    key = told.key === 'job' ? 'job' : told.key;
  }
  const strong = Object.entries(u.scores).some(([k, s]) => s >= 3.5 && !['greeting', 'thanks', 'apology', 'compliment', 'name'].includes(k));
  if (strong && !(key === 'job' && u.appraisal.facts.some(f => f.key === 'job'))) return null;
  // a request ("Tell me about your family.", "Describe your neighborhood.") or a topic of theirs named plainly asks
  // something new: it answers nothing
  if (REQUEST.test(u.norm) || (TOPIC_NOUN.test(u.norm) && Object.entries(u.scores).some(([k, s]) => s >= 1.5 && TOPIC_NOUN_INTENTS.has(k)))) return null;
  if (u.intent === 'insult' || u.intent === 'probe' || u.intent === 'goodbye' || u.flags.more) return null;
  const words = u.norm.split(' ').length;
  const parts = [];
  const learn = (k, value, text) => S.learn(k, value, text);
  if (key === 'name') {
    const f = u.appraisal.facts.find(x => x.key === 'name');
    const bare = /^([A-Z][a-z'-]{1,20})[.!]?$/.exec(u.text.trim());
    // ("Cool." or "Nice!" answers nothing; a name like Grace or Will is a name)
    const nm = f ? String(f.value).split(/\s+/)[0] : bare && !/^(Yes|No|Yeah|Nope|Sure|Hi|Hey|Hello|Thanks|Okay|Ok)$/i.test(bare[1]) && !reactionLine(bare[1]) ? bare[1] : null;
    if (!nm) return null;
    if (screenValue(f ? f.value : nm, 'name')) { parts.push(say(S, 'name.rude')); st.cs = false; return { parts, topics: [], intent: 'name', ask: null, emotion: 'annoyed' }; }
    if (!f) learn('name', nm, `Their name is ${nm}.`);
    parts.push(say(S, 'react.name', { player: nm }));
    return { parts, topics: ['self'], intent: 'name', learnedName: nm, ask: null };
  }
  if (key === 'from' || key === 'lives') {
    // a place outside California ("Ohio", "Nice, in France") is that place, not a California town of the same name
    const far = FAR_PLACE.exec(u.text);
    const pl0 = u.entities.places.find(p => p.kind === 'town' || p.kind === 'county');
    const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // "Nice, in France": the town named with its country; "I live in Fresno, but I'm from Texas": the place they're from
    const adjacent = !!far && !!pl0 && !!pl0.said && new RegExp(`\\b${esc(pl0.said)}\\b,?\\s+(?:in\\s+)?${esc(far[0])}`, 'i').test(u.text);
    const farWins = !!far && !!pl0 && (adjacent
      || (key === 'from' && new RegExp(`\\b(?:from|grew up in|born in|raised in)\\s+${esc(far[0])}`, 'i').test(u.text) && !new RegExp(`\\b(?:from|grew up in|born in|raised in)\\s+${esc(pl0.said || pl0.name)}`, 'i').test(u.text)));
    const pl = pl0 && !farWins ? pl0 : null;
    if (!pl && far && !u.question) {
      const town = adjacent ? (new RegExp(`\\b${esc(pl0.said)}\\b`, 'i').exec(u.text) || [capFirst(pl0.said)])[0] : null;
      const place = `${town ? `${town}, ` : ''}${far[0]}`;
      if (screenValue(place, 'from')) { parts.push(say(S, 'react.notBuying')); st.cs = false; return { parts, topics: [], intent: 'smalltalk', ask: null, emotion: 'annoyed' }; }
      learn(key === 'from' ? 'from' : 'lives', place, key === 'from' ? `They are from ${place}.` : `They live in ${place}.`);
      parts.push(say(S, 'react.from.away', { playerPlace: place }) || say(S, 'react.from.unknown'));
      return { parts, topics: ['neighborhood'], intent: 'smalltalk', ask: null };
    }
    // "I'm from here", "right here": a neighbor
    if (/^(?:oh,? )?(?:i'?m |i am |i live |we'?re )?(?:from |born and raised |right )?(?:here|around here|right here|this neighborhood|this town|nearby|close by|down the street)\b/.test(u.norm) && !u.question) {
      learn(key === 'from' ? 'from' : 'lives', v.z.city, key === 'from' ? `They are from ${v.z.city}.` : `They live in ${v.z.city}.`);
      parts.push(say(S, 'react.from.here'));
      return { parts, topics: ['neighborhood'], intent: 'smalltalk', ask: null };
    }
    if (pl) {
      const ownCity = [v.z.city, v.lex.values.place].filter(Boolean).map(s => s.toLowerCase());
      learn(key === 'from' ? 'from' : 'lives', pl.name, key === 'from' ? `They are from ${pl.name}.` : `They live in ${pl.name}.`);
      if (ownCity.includes(pl.name.toLowerCase())) parts.push(say(S, 'react.from.here'));
      else {
        const R = G.routeTo(v, pl);
        const slots = { playerPlace: pl.name, miles: R.miles, dir: R.dir || 'away', milesEs: millasEs(R.miles), dirEs: R.dir ? DIR_ES[R.dir] : 'lejos' };
        parts.push(say(S, R.km < 25 ? 'react.from.near' : 'react.from.far', slots, [`place:${pl.name}`]));
      }
      return { parts, topics: ['neighborhood'], intent: 'smalltalk', ask: null };
    }
    if (key === 'lives' && (u.flags.yes || u.flags.no)) { parts.push(say(S, u.flags.yes ? 'react.yes' : 'react.no')); return { parts, topics: ['neighborhood'], intent: 'smalltalk', ask: u.flags.no ? 'visiting' : null }; }
    // a bare capitalized answer the gazetteer does not know ("Timbuktu."): learned as said, unless it is only a
    // reaction or an everyday word ("Cool.", "Nice!", "Likely."), which answers nothing
    if (words <= 4 && !u.question && /^[A-Z][A-Za-z'-]*(\s+[A-Z][A-Za-z'-]*)*[.!]?$/.test(u.text.trim()) && !/^(Yes|No|Yeah|Nope|Sure|Okay|Ok|Thanks|Hi|Hey|Hello|Tell|What|Why|How|Where|Who)\b/.test(u.text.trim())
      && !everydayLine(u.text)) {
      const place = u.text.trim().replace(/[.!]$/, '');
      if (screenValue(place, 'from')) { parts.push(say(S, 'react.notBuying')); st.cs = false; return { parts, topics: [], intent: 'smalltalk', ask: null, emotion: 'annoyed' }; }
      learn('from', place, `They are from ${place}.`);
      parts.push(say(S, 'react.from.unknown'));
      return { parts, topics: ['neighborhood'], intent: 'smalltalk', ask: null };
    }
    const told = u.appraisal.facts.find(x => x.key === 'from' || x.key === 'lives');
    if (told && screenValue(told.value, told.key)) { parts.push(say(S, 'react.notBuying')); st.cs = false; return { parts, topics: [], intent: 'smalltalk', ask: null, emotion: 'annoyed' }; }
    // "I'm from Lisbon": a place the mind heard that no gazetteer here knows (the mind keeps it; the NPC says so)
    if (told && !u.question && !everydayLine(told.value)) { parts.push(say(S, 'react.from.unknown')); return { parts, topics: ['neighborhood'], intent: 'smalltalk', ask: null }; }
    return null;
  }
  if (key === 'job') {
    const f = u.appraisal.facts.find(x => x.key === 'job');
    let job = f ? f.value : null;
    if (!job && words <= 4 && !u.question) {
      const m = /^(?:i'?m |i am )?(?:an? )?([a-z][a-z -]{2,30})[.!]?$/.exec(u.norm);
      if (m && !/^(yes|no|nothing|not much|good|fine|okay|ok|sure|nope|yeah)$/.test(m[1])) job = m[1].trim();
    }
    if (!job) return null;
    // a hateful or crude "job" is not learned, praised or repeated; one that is no job they know gets a plain nod
    if (screenValue(job, 'job')) { parts.push(say(S, 'react.notBuying')); st.cs = false; return { parts, topics: [], intent: 'job', ask: null, emotion: 'annoyed' }; }
    const known = job === 'retired' || knownJob(job);
    if (!f && known) learn('job', job, `They work as ${withArticle(job)}.`);
    if (job === 'retired') parts.push(say(S, 'react.retired'));
    else if (known && v.occ && v.occ.title && v.occ.title.toLowerCase().includes(job.toLowerCase())) parts.push(say(S, 'react.jobSame'));
    else if (known) parts.push(say(S, 'react.job', { aPlayerJob: withArticle(job), aPlayerJobCap: capFirst(withArticle(job)) }));
    else parts.push(say(S, 'react.jobOther'));
    return { parts, topics: ['job'], intent: 'job', ask: null };
  }
  if (key === 'howAreYou') {
    if (u.question && !/\b(good|great|fine|well|okay|ok|alright|not bad|tired|busy|rough)\b/.test(u.norm)) return null;
    const s = u.appraisal.sentiment;
    const bad = s <= -0.15 || /\b(tired|bad|rough|terrible|awful|sick|stressed|not (great|good|well))\b/.test(u.norm);
    const good = !bad && (s >= 0.15 || /\b(good|great|fine|well|okay|ok|alright|not bad)\b/.test(u.norm));
    if (!good && !bad && words > 6) return null;
    parts.push(say(S, bad ? 'hay.answerBad' : good ? 'hay.answerGood' : 'hay.answerMeh'));
    return { parts, topics: ['self'], intent: 'how-are-you', ask: null };
  }
  if (!(u.flags.yes || u.flags.no || words <= 6) || (u.question && words > 3)) return null;
  // "Boys or girls?" asks something back; only a yes, a no or a statement answers the NPC
  if (u.question && !u.flags.yes && !u.flags.no && !TURNED_BACK.test(u.norm)) return null;
  const R = { kids: ['react.kidsYes', 'react.kidsNo', 'family'], team: ['react.teamYes', 'react.teamNo', 'smalltalk'], drive: ['react.drive', 'react.drive', 'traffic'], food: ['react.food', 'react.food', 'food'] }[key];
  if (key === 'visiting') {
    if (/visit|vacation|trip|passing|tourist|just here|holiday|seeing family|in town/.test(u.norm)) parts.push(say(S, 'react.visiting'));
    else if (/moved|new here|just moved|live here|living here|relocated|new in town/.test(u.norm)) parts.push(say(S, 'react.moved'));
    else return null;
    return { parts, topics: ['neighborhood'], intent: 'smalltalk', ask: null };
  }
  if (R) {
    if (key === 'kids' && (u.flags.yes || u.flags.no)) learn('kids', u.flags.yes ? 'yes' : 'no', u.flags.yes ? 'They have kids.' : 'They do not have kids.');
    parts.push(say(S, u.flags.no ? R[1] : R[0]));
    return { parts, topics: [R[2] === 'smalltalk' ? 'sports' : R[2]], intent: R[2], ask: null };
  }
  if (u.flags.yes || u.flags.no) { parts.push(say(S, u.flags.yes ? 'react.yes' : 'react.no')); return { parts, topics: [], intent: 'smalltalk', ask: null }; }
  return null;
}

// ------------------------------------------------------------------ composition

const ASK_KEYS = { howAreYou: 'ask.howAreYou', name: 'ask.name', from: 'ask.from', lives: 'ask.lives', job: 'ask.job', kids: 'ask.kids', visiting: 'ask.visiting', weather: 'ask.weather', drive: 'ask.drive', food: 'ask.food', team: 'ask.team', fire: 'ask.fire', weekend: 'ask.weekend', housing: 'ask.housing', school: 'ask.school', holiday: 'ask.holiday' };

// What a player already told the NPC makes some questions pointless.
const ANSWERED_BY = { name: 'name', from: 'from', lives: 'lives', job: 'job', kids: 'kids' };

function askRate(v) {
  const r = 0.12 + 0.38 * v.big5.E + 0.18 * v.big5.A;
  return r * (v.mood.tired ? 0.6 : 1) * (v.relq.guarded ? 0.3 : 1) * (v.lang.mode === 'en' ? 1 : 0.7) * (v.age < 13 ? 0.6 : 1);
}

// Words a sentence can start with that are not names, so "Well, it's ..." may lower-case them.
const COMMON_STARTERS = new Set("it it's its that that's there there's the this these those we we're they they're a an my our you your some most about around nothing everybody everyone people lots if when right today tonight not just so yes yeah no one two i'd honestly".split(' '));
function startsCommon(text) {
  const w = String(text || '').split(/[\s,.!?]/)[0].toLowerCase();
  return COMMON_STARTERS.has(w);
}

const FILLER_STARTS = /^(I mean|you know|honestly|well|so|anyway|like|basically|actually|to be fair|the thing is|I'll tell you|I tell you|let me tell you|mind you|anyhow|look|dude|bro|so yeah)$/i;
const YOUNG_FILLERS = /^(like|dude|bro|so yeah|basically)$/i;
// A sentence that already opens with a discourse word takes no other in front of it ("Honestly, honestly, ...").
const DISCOURSE_START = /^(?:oh|ah|well|so|hmm|um|uh|good question|you know|honestly|anyway|anyhow|actually|look|basically|i mean|like|to be fair|the thing is|let me tell you|i'll tell you|i tell you|mind you|let's see|let me think|okay|ok|sure|yes|yeah|yep|no|nope|nah|ha|pues|bueno|a ver|la verdad|mire|mira|ay)\b/i;

/** Now and then a sentence opens with one of the speaker's fillers ("Honestly, it's ..."). */
function fillerUp(S, parts, intent) {
  const v = S.v, rng = S.rng;
  // (nor before plain facts of their own life: "Honestly, one son, Diego")
  if (['greeting', 'goodbye', 'thanks', 'insult', 'name', 'joke', 'probe', 'family', 'about-them'].includes(intent)) return parts;
  // one discourse word per reply: an opener ("Well, let's see.") already took the slot
  if (parts.some(p => p && /^(well|oh|hmm|good question|so|honestly|you know|anyway|look|let me|let's see|don't get me started|that's a big one)\b/i.test(p.text))) return parts;
  const st = S.st;
  // a filler is a habit, not a refrain: the same one comes once in a conversation, and not two turns running
  if (st.fillerTurn === st.turn - 1) return parts;
  if (!rng.chance(0.06 + 0.22 * v.verb + (v.reg === 'casual' ? 0.06 : 0))) return parts;
  if (!st.fillersSaid) st.fillersSaid = new Set();
  const opened = f => { const w = f.toLowerCase(); for (const o of st.openings || []) if (o === w || o.startsWith(`${w} `)) return true; return false; };
  const unsaid = f => !st.fillersSaid.has(f.toLowerCase()) && !opened(f);
  const own = v.fillers.filter(f => FILLER_STARTS.test(f) && unsaid(f));
  const local = v.reg === 'formal' ? [] : (linesForSafe(v, 'fillers').filter(f => FILLER_STARTS.test(f) && (!YOUNG_FILLERS.test(f) || v.age < 35) && unsaid(f)));
  const pool = own.length && rng.chance(0.7) ? own : local.length ? local : own;
  const f = rng.pick(pool);
  if (!f) return parts;
  const later = /^(anyway|anyhow|mind you|so yeah|to be fair|actually|the thing is)$/i.test(f);
  const fRe = new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  // (a reply that already says it somewhere, "I'm not the best one to ask, honestly", takes no second one)
  if (parts.some(p => p && fRe.test(p.text))) return parts;
  // never on a question (the NPC's own question back included), never on a sentence that already opens with a
  // discourse word, never on one that already says the same filler ("most of it is meetings, honestly")
  // (nor on a plain yes or no: "You know, not that I've seen" is no answer)
  const i = parts.findIndex((p, k) => p && (!later || k > 0) && !/\?/.test(p.text) && !/^ask\./.test(p.key || '') && startsCommon(p.text)
    && !DISCOURSE_START.test(p.text) && !fRe.test(p.text) && !/^(yes|yeah|yep|no|nope|nah|not|doesn'?t|don'?t|never)\b/i.test(p.text));
  if (i < 0) return parts;
  const p = parts[i];
  const word = f[0].toUpperCase() + f.slice(1);
  const out = parts.slice();
  out[i] = Object.assign({}, p, { text: `${word}, ${G.lowerFirst(p.text)}`, gloss: p.gloss ? `${word}, ${G.lowerFirst(p.gloss)}` : null });
  st.fillersSaid.add(f.toLowerCase());
  st.fillerTurn = st.turn;
  return out;
}

function linesForSafe(v, category) {
  try { return linesFor(v.key, category, Object.assign({}, v.context, { speaker: v.speaker, age: v.age })); } catch { return []; }
}

// Slang the speaker's age and dialect allow (lexicon.slangFor), worked into a sentence where it fits.
const SLANG_GOOD = new Set(['fire', 'dope', 'rad', 'goated', 'gnarly']);
function slangUp(S, parts, intent) {
  const v = S.v, rng = S.rng, st = S.st;
  if (v.age >= 45 || v.reg === 'formal' || st.slangTurn === st.turn - 1 || !rng.chance(Math.min(0.5, v.slang * 0.45))) return parts;
  if (['insult', 'probe', 'name', 'goodbye'].includes(intent)) return parts;
  for (let k = 0; k < 4; k++) {
    const sl = slangFor(v.key, v.age, rng);
    if (!sl) return parts;
    const t = sl.term;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p || p.gloss) continue;
      let text = null;
      if (SLANG_GOOD.has(t)) text = p.text.replace(/\b(is|are|was|were|'s) (so |really |super |pretty )?(good|great|amazing|awesome)\b/, `$1 ${t}`);
      else if (t === 'bussin' && /food|eat|taco|burrito/.test(p.text)) text = p.text.replace(/\b(is|are) (so |really )?(good|great|delicious)\b/, '$1 bussin');
      else if (t === 'stoked') text = p.text.replace(/\b(I'm|I am) (so |really )?(excited|happy|glad)\b/, '$1 $2stoked');
      else if (t === 'no cap' && /\.$/.test(p.text) && !/\?/.test(p.text) && p.text.length < 90 && /^(best|nothing|the best|you can't|you won't|there's (nothing|no)|it's (the best|so|really|super|hella|pretty|actually)|honestly)\b/i.test(p.text)) text = p.text.replace(/\.$/, ', no cap.');
      else if ((t === 'lowkey' || t === 'highkey') && /^I (love|like|want|miss|need)\b/.test(p.text)) text = p.text.replace(/^I /, `I ${t} `);
      else if ((t === 'dude' || t === 'bro' || t === 'brah') && i === 0 && /\.$/.test(p.text) && p.text.split(' ').length <= 9 && !/,/.test(p.text)) text = p.text.replace(/\.$/, `, ${t}.`);
      else if (t === 'hella' && /\b(so|really|very) (good|hot|cold|busy|crowded|expensive|nice)\b/.test(p.text)) text = p.text.replace(/\b(so|really|very) (good|hot|cold|busy|crowded|expensive|nice)\b/, 'hella $2');
      if (text && text !== p.text) {
        const out = parts.slice();
        out[i] = Object.assign({}, p, { text });
        st.slangTurn = st.turn;
        return out;
      }
    }
  }
  return parts;
}

/** Gentle speakers soften an opinion with "I think". */
function hedge(S, parts) {
  const v = S.v;
  if (v.direct >= 0.42 || !S.rng.chance(0.6)) return parts;
  // (never before a discourse word: "I think honestly, ..." is not how anyone talks)
  return parts.map(p => (p && /^(op\.|house\.opinion|rent\.feel)/.test(p.key || '') && startsCommon(p.text) && !/^I /.test(p.text) && !DISCOURSE_START.test(p.text) ? Object.assign({}, p, { text: `I think ${G.lowerFirst(p.text)}` }) : p));
}

/** A part that says something about this place: a fact of the pack about it, or the dialect's own line. */
const placeful = p => !!p && (/^lex:/.test(p.key || '') || (p.facts || []).some(f => PLACE_FACT.test(f) || /^(?:weather\.|road:|alert:)/.test(f)));

/**
 * The parts that fit the sentence budget, in order. A part marked keep (a planner's fact) is never cut for an
 * optional part after the first; nor is a reply's only part about the place (a fact of the pack, the dialect's own
 * line) cut for a generic one ("the best places don't look like much"): the last generic part gives way instead.
 */
function fitBudget(parts, n) {
  if (parts.length <= n) return parts;
  const chosen = parts.slice(0, n).map((p, i) => i);
  // (a greeting, a word about the last conversation or a plain answer about themselves is never the one to go)
  const swapIn = k => {
    for (let j = chosen.length - 1; j >= 0; j--) {
      const p = parts[chosen[j]];
      if (!p.keep && !p.dep && !placeful(p) && !/^(?:greet\.|recall\.|hay\.|name\.|react\.|me\.|safe\.)/.test(p.key || '')) { chosen.splice(j, 1); chosen.push(k); chosen.sort((a, b) => a - b); return true; }
    }
    return false;
  };
  for (let k = n; k < parts.length; k++) if (parts[k].keep && !parts[k].dep) swapIn(k);
  if (!chosen.some(i => placeful(parts[i]))) {
    const k = parts.findIndex((p, i) => i >= n && !chosen.includes(i) && !p.dep && placeful(p));
    if (k >= 0) swapIn(k);
  }
  return chosen.map(i => parts[i]);
}

/** Sentences a reply may have: verbosity, life stage, language mode, mood and the relationship. */
function budgetOf(v, intent, plan) {
  let n = 1 + Math.round(v.verb * 3);
  if (v.lang.mode !== 'en') n = Math.min(n, 2);
  if (v.age < 8) n = Math.min(n, 1);
  else if (v.age < 13) n = Math.min(n, 2);
  if (v.relq.guarded) n = Math.min(n, 2);
  if (v.mood.tired) n -= 1;
  if (['greeting', 'thanks', 'goodbye', 'compliment', 'apology', 'insult'].includes(intent)) n = Math.min(n, 3);
  if (plan.keep) n = Math.max(n, plan.keep);
  return Math.max(1, Math.min(n, 5));
}

// The meaning a code-switched phrase must have for a topic ("¡Está carísimo!" fits insurance; "La renta está
// carísima" does not).
const CS_FITS = {
  insurance: /^(it'?s )?(so |very |too )?expensive|^everything is|prices/i, housing: /expensive|rent|hous|prices/i, rent: /expensive|rent|prices/i,
  thanks: /welcome|mention|pleasure|problem|nothing/i,
};

const CS_INTENT = { greeting: 'greeting', 'how-are-you': null, thanks: 'no_problem', compliment: 'thanks', goodbye: 'farewell', apology: 'no_problem', traffic: 'traffic_bad', housing: 'its_expensive', rent: 'its_expensive', insurance: 'its_expensive', unknown: 'surprise' };

// Reactions ("No way!", "That makes me so mad!") are said about something: never before a recollection of the last
// conversation, an opener, a deflection or a plain "I couldn't say".
const REACTIONS = new Set(['surprise', 'frustration', 'delight']);
const NOT_AFTER_REACTION = /^(recall\.|greet\.prev|open\.|unk\.|dir\.unknown|dir\.kid|hay\.answer|react\.|repeat\.)/;

// Facts that state something about the place (a share, a count, a record, a forecast): told once, they are not
// told again as an aside in a later answer.
// (The forecast's ids cover every period, so a forecast part is judged by its sentences, not its fact.)
const PLACE_FACT = /^(acs\.|aadt:|clim\.|record\.|ins\.|biz\.|fhsz$|stretch:|landmark:|place:|fire:|ar:|fema:|wind:)/;

/** True when a line's text or gloss names what a fact id points to (a place, a landmark, a fire, a road). */
function factNamed(id, said, v = null) {
  let m;
  if ((m = /^(?:place|landmark):(.+)$/.exec(id))) {
    const name = foldText(m[1]).replace(/\s+\d{5}$/, '');
    return said.includes(name) || said.includes(name.replace(/^(?:mount|mt\.?) /, '')) || said.includes(name.replace(/ (?:mountain|mountains|range|peak|lake|river|creek|bay)$/, ''));
  }
  if ((m = /^fire:(.+):(\d{4})$/.exec(id))) {
    const core = foldText(G.cleanFireName(m[1])).replace(/\s+(fire|complex)$/, '').replace(/\s+lightning$/, '');
    return said.includes(core) || said.includes(foldText(m[1]).replace(/\s+(fire|complex)$/, ''));
  }
  if ((m = /^(?:road|aadt):(.+)$/.exec(id))) {
    const num = /(\d{1,3})/.exec(m[1]);
    if (num && new RegExp(`(?<!\\d)${num[1]}(?!\\d)`).test(said)) return true;
    // a road said by its local name ("PCH", "the Nimitz") is named too
    const r = /^(I|US|SR)[- ]?(\d{1,3})$/.exec(m[1].trim());
    if (r && v) {
      let names = [];
      try { names = roadNames({ name: m[1], route: +r[2], kind: r[1] }, v.key, { world: v.world, zi: v.zi }) || []; } catch { names = []; }
      if (names.some(n => said.includes(foldText(n)))) return true;
    }
    return !num && said.includes(foldText(m[1]));
  }
  if ((m = /^stretch:(.+)$/.exec(id))) return said.includes(foldText(m[1]));
  return true;
}

const foldText = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '');

/**
 * Style a plan into one line: sentence budget, opener, the player's name, a mood aside, a follow-up question and
 * code-switching. Nothing said earlier in the conversation is said again (a part that repeats a sentence, or that
 * only restates a fact about the place told before, is left out), and only the facts the line names are cited.
 * Returns {text, gloss, facts, ask, keys, answered, mems}: ask is the pending question key or null; answered is
 * false when nothing the planner offered was left to say (the conversation then owns the repeat); mems are the
 * persona memories the line told.
 */
export function compose(S, intent, plan, u) {
  const v = S.v, st = S.st, rng = S.rng;
  // a part with a sentence already said in this conversation, or twice in this reply, is left out; so is an aside that
  // only restates facts about the place told in an earlier turn; and a continuation ("Plus three siblings.") goes
  // only with the part it continues
  const name = v.relq ? v.relq.name : null;
  const seen = new Set();
  let parts = [];
  let prevKept = false;
  for (const p of plan.parts) {
    if (!p || !p.text || (p.dep && !prevKept)) { prevKept = false; continue; }
    const ss = sentencesOf(p.text);
    const inLine = ss.map(s => sentenceKey(s, name, 1)).filter(Boolean);
    const keys = ss.map(s => sentenceKey(s, name)).filter(Boolean);
    const repeated = inLine.some(k => seen.has(k)) || keys.some(k => st.sentences && st.sentences.has(k));
    const restated = parts.length > 0 && !!st.saidFacts && !!(p.facts && p.facts.length && p.facts.every(f => PLACE_FACT.test(f) && st.saidFacts.has(f)));
    if (repeated || restated) { prevKept = false; continue; }
    for (const k of inLine) seen.add(k);
    parts.push(p);
    prevKept = true;
  }
  const answered = parts.length > 0;
  const budget = budgetOf(v, intent, plan);
  const all0 = parts;
  parts = fitBudget(parts, budget);
  // the last conversation, mentioned in a greeting that the sentence budget then cut: it has not been mentioned
  if (all0.some(p => p.key === 'greet.prev') && !parts.some(p => p.key === 'greet.prev')) st.mentionedPrev = false;
  // the player's name, now and then, at the end of the first sentence
  // (people say a name now and then, not in reply after reply: a few turns pass before it comes again)
  const sinceName = isNum(st.nameTurn) ? st.turn - st.nameTurn : Infinity;
  if (v.relq.name && parts.length && !['insult', 'probe'].includes(intent) && sinceName >= 4 && (st.nameUses === 0 ? rng.chance(0.5) : rng.chance(0.12)) && !parts[0].text.includes(v.relq.name)) {
    const p = parts[0];
    const add = s => s.replace(/([.!?]+)?$/, (m0, pun) => `, ${v.relq.name}${pun || '.'}`);
    if (!/[,:;]$/.test(p.text) && p.text.split(/[.!?]/).filter(Boolean).length === 1) { parts[0] = Object.assign({}, p, { text: add(p.text), gloss: p.gloss ? add(p.gloss) : null }); st.nameUses += 1; }
  }
  // an opener before an answer to a question
  // (a question about their own life, their family, work or commute, needs no "Good question" or "let me think",
  // and two turns in a row never open the same way)
  if (u && u.question && parts.length && !plan.noOpener && !/^(?:(?:ha|oh|no|nope|yes|yeah|yep|not|well|hmm|um|i am|sure|just)\b|kids\?)/i.test(parts[0].text) && rng.chance(0.22) && v.age >= 13 && !plan.noAsk && !(v.age < 18 && HEAVY.has(intent))
    && st.openerTurn !== st.turn - 1 && !['goodbye', 'greeting', 'thanks', 'insult', 'name', 'smalltalk', 'unknown', 'how-are-you', 'compliment', 'joke', 'apology', 'family', 'job', 'traffic', 'about-them', 'home'].includes(intent)) {
    const light = /none|nothingMore|beforeMe|noOffshore|\.low$|\.calm$/.test(parts[0].key || '');
    const o = say(S, HEAVY.has(intent) && !light ? 'open.heavy' : 'open.question');
    if (o) st.openerTurn = st.turn;
    if (o) {
      if (/,$/.test(o.text)) {
        if (startsCommon(parts[0].text) && !DISCOURSE_START.test(parts[0].text)) parts[0] = Object.assign({}, parts[0], { text: `${o.text} ${G.lowerFirst(parts[0].text)}`, gloss: parts[0].gloss ? `${o.gloss || o.text} ${G.lowerFirst(parts[0].gloss)}` : null });
      } else parts.unshift(o);
    }
  }
  // a mood aside, once in a while and once per conversation
  if (!st.moodSaid && v.age >= 13 && !['insult', 'probe', 'goodbye', 'thanks'].includes(intent) && rng.chance(0.18)) {
    const m = v.mood;
    const key = m.tired ? 'mood.tired' : v.alerts.length && m.tense ? 'mood.alert' : isNum(v.tempF) && v.tempF >= 95 && m.valence < 0.1 ? 'mood.hot' : m.valence >= 0.45 ? 'mood.happy' : m.valence <= -0.35 ? 'mood.down' : null;
    const p = key ? say(S, key, { alert: v.alerts[0] && v.alerts[0].event, temp: exactTemp(v) }) : null;
    if (p) { parts.push(p); st.moodSaid = true; }
  }
  if (!parts.length) { const p = pivot(S) || say(S, 'unk.statement'); if (p) parts.push(p); }
  // a question back, unless the reply already asks one ("Did you catch the game?")
  let ask = null;
  if (!plan.noAsk && plan.ask !== null && st.turn < 60 && !parts.some(p => /\?["')]*$/.test(p.text.trim()))) {
    const known = new Set(v.relq.facts.map(f => f.key));
    const early = st.turn <= 6 ? ['from', 'job', 'name', 'visiting'] : [];
    const cands = [plan.ask, ...early].filter(Boolean)
      .filter(k => ASK_KEYS[k] && !st.asked.has(k) && !(ANSWERED_BY[k] && known.has(ANSWERED_BY[k])) && !(k === 'name' && v.relq.name) && !(k === 'team' && !v.team)
        // (someone they have met before is not "just passing through")
        && !(k === 'visiting' && (v.relq.known || st.prev)));
    const rate = Math.min(0.85, askRate(v) + num(plan.askBoost, 0) - (st.lastAsked ? 0.2 : 0));
    if (cands.length && rng.chance(rate)) {
      const k = cands[0];
      // "How about you?" follows the NPC's own answer to how they are; without one it is "How are you doing?"
      const key = k === 'howAreYou' && !parts.some(p => /^(hay\.|why\.)/.test(p.key || '')) ? 'ask.howAreYouFresh' : ASK_KEYS[k];
      const q = say(S, key, Object.assign({ placeName: v.z.city }, plan.askSlots || {}));
      if (q) { parts.push(q); ask = k; st.asked.add(k); }
    }
  }
  if (!parts.length) parts.push(say(S, 'unk.statement') || { text: '...', gloss: null, facts: [] });
  if (v.lang.mode === 'en' && v.age >= 13) {
    parts = hedge(S, parts);
    parts = fillerUp(S, parts, intent);
    parts = slangUp(S, parts, intent);
    // warmth for someone they like, once a conversation
    if (!st.warmSaid && ['fond', 'warm'].includes(v.relq.feelings) && !['insult', 'probe', 'goodbye'].includes(intent) && rng.chance(0.2)) {
      const w = say(S, 'warm.aside');
      if (w) { parts.push(w); st.warmSaid = true; }
    }
  }
  // the home language
  let pre = null, post = null;
  // st.cs: the planner's choice of phrase meaning; false (or null) means the answer is no occasion for one, and
  // undefined leaves it to the intent's usual phrase
  const csIntent = st.cs === false || st.cs === null ? null : st.cs || CS_INTENT[intent] || null;
  st.cs = undefined;
  const fits = CS_FITS[intent] || null;
  // "the rent is too high" is a renter's complaint: someone whose family owns says prices are high, not the rent
  const avoid = csIntent === 'its_expensive' && v.hh.tenure === 'own' ? /\brent/i : null;
  // a phrase meant for a complaint goes with one: "the traffic was horrible" never before "it's a short drive"
  const backed = !plan.csWith || parts.some(p => plan.csWith.test(p.key || ''));
  const reactionOk = !(REACTIONS.has(csIntent) && parts[0] && NOT_AFTER_REACTION.test(parts[0].key || ''));
  if (csIntent && backed && reactionOk) {
    // a phrase in the home language is said once in a conversation, like any other sentence
    if (!st.csSaid) st.csSaid = new Set();
    const fresh = ph => (ph && !st.csSaid.has(ph.text) ? ph : null);
    // (plan.forceCs: the player spoke the speaker's own language, so the answer opens in it)
    if (plan.forceCs || (v.lang.mode === 'simple' && rng.chance(0.85))) pre = fresh(homePhrase(S, csIntent, fits, avoid));
    else if (v.lang.mode === 'en' && v.lang.cs && rng.chance(Math.min(0.85, v.lang.cs.rate * 1.2))) {
      const ph = fresh(homePhrase(S, csIntent, fits, avoid));
      if (ph) { if (intent === 'goodbye') post = ph; else pre = ph; }
    }
    for (const ph of [pre, post]) if (ph) st.csSaid.add(ph.text);
  }
  if (pre && intent === 'greeting' && parts.length > 1 && /^(greet\.(first|again|repeat)|lex:greetings)$/.test(parts[0].key || '')) parts = parts.slice(1);
  // "Aquí estoy a gusto. Aquí se habla mucho español.": the second sentence drops its "Aquí"
  if (v.lang.mode === 'es') {
    for (let i = 1; i < parts.length; i++) {
      if (parts[i - 1] && parts[i] && /^Aquí(?=[\s,.!?])/.test(parts[i - 1].text) && /^Aquí,?\s+\S/.test(parts[i].text)) {
        parts[i] = Object.assign({}, parts[i], { text: capFirst(parts[i].text.replace(/^Aquí,?\s+/, '')) });
      }
    }
  }
  const all = [pre, ...parts, post].filter(Boolean);
  const text = tidy(all.map(p => terminate(p.text)).join(' '));
  const foreign = all.some(p => p.gloss);
  const gloss = foreign ? tidy(all.map(p => terminate(p.gloss || p.text)).join(' ')) : null;
  // only the facts the line names: a place, landmark, fire or road the words never mention is not cited
  const said = foldText(`${text} ${gloss || ''}`);
  const facts = [...new Set(all.flatMap(p => p.facts || []).filter(Boolean))].filter(f => factNamed(f, said, v));
  const mems = [...new Set(all.map(p => p.mem).filter(Boolean))];
  // what a surviving part says is now told (a forecast period, for one)
  for (const p of all) for (const k of p.mark || []) st.used.add(k);
  if (v.relq.name && text.includes(v.relq.name)) st.nameTurn = st.turn;
  // how each sentence opened ("honestly i'm a"), and the discourse words said anywhere ("..., honestly."), so a
  // filler is not added where the speaker already said it
  if (!st.openings) st.openings = new Set();
  for (const x of sentencesOf(gloss || text)) { const w = x.toLowerCase().match(/[\p{L}']+/gu); if (w) st.openings.add(w.slice(0, 3).join(' ')); }
  if (!st.fillersSaid) st.fillersSaid = new Set();
  for (const m of String(gloss || text).toLowerCase().matchAll(FILLER_SCAN)) st.fillersSaid.add(m[1]);
  return { text, gloss, facts, ask, keys: all.map(p => p.key).filter(Boolean), answered, mems };
}

// Discourse words a speaker can say once in a conversation without it turning into a tic.
const FILLER_SCAN = /\b(honestly|basically|actually|literally|you know|i mean|let me tell you|i tell you|no cap|for real|to be honest)\b/g;

/** Nonverbal "lines" for babies, and the tiny talk of toddlers (two to four). */
export function smallChild(S, intent) {
  const v = S.v, rng = S.rng;
  const he = v.sex === 'F' ? 'She' : 'He', his = v.sex === 'F' ? 'her' : 'his';
  const carer = v.rel.parents[0] || v.rel.grandparents[0] || v.rel.siblings.find(x => num(x.age) >= 12) || null;
  const role = carer ? (v.rel.parents.includes(carer) ? (carer.sex === 'F' ? 'mom' : 'dad') : v.rel.grandparents.includes(carer) ? (carer.sex === 'F' ? 'grandma' : 'grandpa') : (carer.sex === 'F' ? 'big sister' : 'big brother')) : null;
  const who = role ? `${his} ${role}` : 'the nearest grown-up';
  const mine = role ? `my ${role}` : 'my family';
  if (v.age < 2) {
    // a baby's "lines" are what they do: one or two small actions, never the same pair twice in a conversation
    const acts = ['smiles at you', 'kicks ' + his + ' feet', 'babbles something', 'reaches for your hand', 'stares at you with big eyes', 'giggles',
      'grabs at your sleeve', 'yawns', `hides ${his} face against ${who}`, 'waves a chubby hand', 'blows a raspberry', `chews on ${his} fist`,
      'coos', 'claps ' + his + ' hands', 'squeals', 'drops ' + his + ' toy', 'looks at you very seriously', 'sneezes'];
    const pool = [];
    for (let i = 0; i < acts.length; i++) { pool.push(`(${he} ${acts[i]}.)`); for (let j = 0; j < acts.length; j++) if (i !== j && (i + j) % 3 === 0) pool.push(`(${he} ${acts[i]} and ${acts[j]}.)`); }
    return S.picker.pick('baby', pool, rng);
  }
  const hot = isNum(v.tempF) && v.tempF >= 85, cold = isNum(v.tempF) && v.tempF <= 50, rain = v.sky === 'rain';
  const sib = v.rel.siblings[0];
  const lines = {
    greeting: ['Hi!', 'Hiii!', `(${he} waves.)`, 'Hello!', `(${he} hides behind ${who}, then peeks out.)`],
    'how-are-you': v.mood.tired ? ["I'm sleepy.", `(${he} rubs ${his} eyes.)`] : ['Good!', "I'm hungry.", 'Good! I have a snack.', 'I got a sticker today!'],
    name: [`I'm ${v.first}!`, `${v.first}!`, `My name is ${v.first}.`],
    'about-them': [`I'm ${v.age}!`, `(${he} holds up ${v.age} fingers.)`, `I'm ${v.age}. I'm big.`],
    weather: hot ? ["It's hot!", 'I want to go in the pool.'] : cold ? ["It's cold!", 'I have a jacket.'] : rain ? ['Rain!', 'I like puddles.'] : ["It's sunny!", 'I see the sun!'],
    family: [`That's ${mine}.`, ...(sib && sib.name ? [`${sib.name} is my ${sib.sex === 'F' ? 'sister' : 'brother'}.`] : []), `(${he} points at ${who}.)`],
    job: v.npc.school === 'preschool' ? ['I go to preschool!', 'I go to school. Preschool.'] : ['I play!', 'I play with my toys.'],
    food: ['Mac and cheese!', 'I like noodles.', 'Can I have a cookie?'],
    joke: ['Knock knock!', `(${he} giggles and won't stop.)`, 'Banana!'],
    compliment: ['Thank you!', `(${he} smiles really big.)`],
    insult: ["That's mean!", `(${he} runs to ${who}.)`],
    thanks: ["You're welcome!", 'Okay!'],
    apology: ['Okay.', `(${he} nods.)`],
    directions: ["I don't know.", `Ask ${mine}.`],
    goodbye: ['Bye-bye!', 'Bye!', `(${he} waves bye-bye.)`],
  };
  const says = ['I like the slide!', 'Why?', 'I want to go to the park.', 'Look!', 'I have a snack.', 'Is that your car?', 'I can jump really high.', 'My shoes light up.', 'I like dogs.', 'Where are you going?', 'I saw a bird.', 'I want juice.'];
  const does = [`(${he} looks up at ${who}.)`, `(${he} hides behind ${who}.)`, `(${he} shows you a rock.)`, `(${he} thinks about it, then shrugs.)`, `(${he} spins in a circle.)`, `(${he} tugs on ${who}'s hand.)`, `(${he} giggles.)`];
  const any = [...says, ...does];
  for (const d of does) for (const w of says) if ((d.length + w.length) % 4 === 0) any.push(`${d} ${w}`);
  const own = lines[intent] ? lines[intent].filter(x => !S.st.said.has(x)) : [];
  const pool = own.length ? own : any;
  return S.picker.pick(`toddler:${own.length ? intent : 'any'}`, pool, rng);
}

/** Stable short hash for tags. */
export const tagHash = s => (hashStr(String(s)) >>> 0).toString(36);

