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

import { pickLine, phrasesFor, codeSwitch, familyTerm, templateSlots, linesFor, slangFor, resolveLanguage, LANGUAGES } from '../lexicon.mjs';
import { hashStr } from '../rng.mjs';
import { OCCUPATION_CATALOG } from '../occupations.mjs';
import { wherePhrase } from '../persona.mjs';
import { PEOPLE } from './en-people.mjs';
import { PLACE } from './en-place.mjs';
import { SPANISH } from './es.mjs';
import {
  isNum, num, str, capFirst, withArticle, listJoin, numWord, fillLine, tagsHold, cleanText, fitsLife, lexiconLineFits, lintText, terminate, tidy,
  cleanGloss, fullDate, monthYear, partOfMonth, mesAno, parseDate, MONTHS, MESES, approx, compass,
} from './core.mjs';
import * as G from './ground.mjs';
import { employerPhrase } from './voice.mjs';
import { screenValue } from './probe.mjs';
import {
  interestTalk, CONCERN_WORDS, jobSpanish, feelKey, SCHOOL_WORDS, DIR_ES, LANG_ES, shareVerbEs, cieloEs, cuandoEs, mesEs, millasEs, approxEs,
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
  const usable = list.filter(l => tagsHold(l, v));
  if (!usable.length) return null;
  const all = Object.assign({}, S.base, slots);
  if (all.very === undefined && mode === 'en' && usable.some(l => l.text.includes('{very'))) all.very = intensifier(S);
  const hit = S.picker.pickWhere(`${mode === 'en' ? 'en' : 'es'}:${key}`, usable, line => {
    if (mode === 'en') {
      const a = fillLine(line.text, all);
      if (!a || !cleanText(a.text) || !fitsLife(a.gloss, v) || ECHO.test(a.text)) return null;
      return { text: a.text, gloss: a.foreign ? a.gloss : null };
    }
    const es = fillLine(line.text, all), en = fillLine(line.gloss, all);
    if (!es || !en || !cleanText(es.text) || !cleanText(en.text) || !fitsLife(en.text, v)) return null;
    if (mode === 'es') return { text: es.text, gloss: en.text };
    return { text: en.text, gloss: null };
  }, S.rng);
  return hit ? { text: hit.value.text, gloss: hit.value.gloss, facts: facts.filter(Boolean), key } : null;
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

/**
 * A regional line from the speaker's dialect (lexicon), filtered by the situation and the speaker's life; English
 * mode only. extra overrides the lexicon's slot values (with their fact ids in extraFacts).
 */
export function lex(S, category, extra = {}, extraFacts = {}) {
  const v = S.v;
  if (v.lang.mode !== 'en') return null;
  const slots = Object.assign({}, v.lex.values, extra);
  const opts = Object.assign({}, v.context, { speaker: v.speaker, slots, picker: S.picker, regionalShare: 0.65, age: v.age });
  for (let i = 0; i < 6; i++) {
    const hit = pickLine(v.key, category, S.rng, opts);
    if (!hit) return null;
    // the dialect's lines carry a few tags; what they still assume (a commute, today's sky, a pier, a crash on the
    // freeway right now) is checked against the speaker's record and the world here
    if (!cleanText(hit.text) || !fitsLife(hit.text, v) || !lexiconLineFits(hit.text, v, category) || S.st.said.has(hit.text)) continue;
    // the engine's own style rules hold for borrowed lines too: no "gonna", no mock foreign words
    if (lintText(hit.text, NO_BRANDS, { english: true }).length) continue;
    const facts = templateSlots(hit.template).map(s => extraFacts[s] || (v.lex.facts && v.lex.facts[s]) || null).filter(Boolean);
    if (templateSlots(hit.template).includes('temp')) facts.push('weather.now');
    return { text: hit.text, gloss: null, facts, key: `lex:${category}` };
  }
  return null;
}

// Spanish second-person forms: tú with friends and the young, usted with strangers and elders.
const TU_FORMS = /\b(te|tú|tu|ti|contigo|estás|eres|vos|andás|hacés)\b|Cuídate|Abrígate|Pásale/i;
const USTED_FORMS = /\b(usted|le|lo bendiga|la bendiga)\b|Cuídese/i;

const AUDIENCE_NOTE = /\((to a (man|woman|boy|girl|friend|child|younger|elder|stranger)|to someone|said when|to an |when leaving|to customers)/i;

/**
 * A phrase in the speaker's home language for an intent ({text, gloss}), or null when the language has nothing that
 * fits (the caller then stays in English). Phrases tied to the listener's gender are skipped: the player's is unknown.
 */
export function homePhrase(S, intent, fits = null) {
  const v = S.v, lang = v.lang.cs ? v.lang.cs.lang : v.lang.known;
  if (!lang || !LANGUAGES[lang]) return null;
  const opts = { sex: v.sex, t: v.t, variety: v.lang.variety, faith: v.lang.faith, register: v.lang.usted ? 'respect' : undefined };
  const ok = e => !!e && !e.to && !AUDIENCE_NOTE.test(e.gloss)
    && (v.lang.faith || !/\bGod\b|\bbless/i.test(e.gloss))
    && (lang !== 'spanish' || (v.lang.usted ? !TU_FORMS.test(e.text) : !USTED_FORMS.test(e.text)))
    && (!fits || fits.test(e.gloss));
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

/** A family word in the home language as a {t, g} slot value ("abuela" / "grandmother"), or null. */
export function homeWord(S, relation, english) {
  const v = S.v, lang = v.lang.cs ? v.lang.cs.lang : null;
  if (!lang || v.lang.mode !== 'en') return null;
  const opts = { sex: v.sex, variety: v.lang.variety, faith: v.lang.faith, register: v.lang.usted ? 'respect' : undefined };
  const e = familyTerm(lang, relation, S.rng, opts);
  if (!e || e.to || AUDIENCE_NOTE.test(e.gloss)) return null;
  return { t: e.roman || e.text, g: english };
}

// ------------------------------------------------------------------ slots

const PARENT_WORDS = { F: 'mom', M: 'dad' };

/** The slots every template may use: names, place, home, the Spanish gender ending. */
export function baseSlots(v) {
  const res = v.res || {};
  const year = v.P.year;
  const yearMoved = isNum(v.hh.yearMoved) ? v.hh.yearMoved : (isNum(res.zipSince) ? res.zipSince : null);
  return {
    first: v.first, full: v.full, nick: v.nick, place: v.lex.values.place || v.z.city, city: v.z.city, county: v.z.countyName,
    region: v.lex.values.region, homeWord: v.homeWord, aHome: withArticle(v.homeWord === 'apartment' && v.hh.dwelling === 'small-apartment' ? 'small apartment' : v.homeWord),
    unHomeEs: { house: 'una casa', apartment: 'un apartamento', 'mobile home': 'una casa móvil', place: 'una casa' }[v.homeWord] || 'una casa',
    yearMoved, yearsHere: isNum(yearMoved) && year - yearMoved >= 1 ? numWord(year - yearMoved) : null,
    yearsNum: isNum(yearMoved) && year - yearMoved >= 1 ? year - yearMoved : null,
    zipSince: isNum(res.zipSince) ? res.zipSince : null, countySince: isNum(res.countySince) ? res.countySince : null,
    age: v.age, nextAge: v.age + 1, o: v.sex === 'F' ? 'a' : 'o',
    temp: v.tempF, month: MONTHS[v.P.month - 1], mesEs: mesEs(v.P.month),
    team: v.team ? v.team.label : null, teamName: v.team ? v.team.name : null,
    teamEs: v.team ? (/^the /.test(v.team.label) ? v.team.label.replace(/^the /, 'los ') : v.team.label) : null,
    player: v.relq.name,
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

/**
 * A memory's title as said in a sentence: a federal declaration's "the winter storms 2005" becomes "the winter
 * storms of 2005"; other titles stay as the persona wrote them.
 */
export function memTitleOf(m) {
  const t = String((m && (m.title || m.text)) || '');
  if (!/\d{4}$/.test(t) || /\b(of|in)\s+((January|February|March|April|May|June|July|August|September|October|November|December)\s+)?\d{4}$/.test(t)) return t;
  return `the ${G.femaTitle(t)}`;
}

/** A memory's title in Spanish (the persona's titles are English). */
function memoryEs(m) {
  const dt = parseDate(m.date) || { y: m.year, m: null };
  const name = /^firesOf/.test(m.source || '') ? String(m.source).replace(/^firesOf\([^)]*\): /, '').replace(/ \d{4}$/, '').replace(/\s+(Fire|Complex)$/i, '') : null;
  if (m.kind === 'fire' && name) return `el incendio ${name} de ${m.year}`;
  if (m.kind === 'fire') return `los incendios de ${m.year}`;
  if (m.kind === 'storm') {
    const x = /^the (?:storms|fires) of (.+)$/.exec(String(m.title || ''));
    if (x) return `las tormentas de ${datesEs(x[1])}`;
    const y = /^the atmospheric river of (.+)$/.exec(String(m.title || ''));
    return y ? `el río atmosférico de ${datesEs(y[1])}` : `las tormentas de ${mesAno(dt)}`;
  }
  if (m.kind === 'wind') return `los vientos de ${mesAno(dt)}`;
  if (m.kind === 'quake') return `el terremoto de ${m.year}`;
  if (m.kind === 'heat') return `el calor récord de ${m.year}`;
  if (m.kind === 'rain') return `la lluvia récord de ${mesAno(dt)}`;
  if (m.kind === 'gust') return `el viento récord de ${mesAno(dt)}`;
  return `lo que pasó en ${m.year}`;
}

/** "January to April 2023" → "enero a abril de 2023". */
function datesEs(s) {
  let out = String(s);
  MONTHS.forEach((m, i) => { out = out.replace(new RegExp(`\\b${m}\\b`, 'g'), MESES[i]); });
  return out.replace(/ to /g, ' a ').replace(/ (\d{4})$/, ' de $1');
}

/** "el incendio Woolsey" from a fire name. */
function fireEs(name) { return `incendio ${String(name).replace(/\s+(Fire|Complex)$/i, '')}`; }

/** Year of a life memory with this source ("npc.occupation" → the year they started the job). */
function lifeYear(v, source) {
  const m = (v.p.memories || []).find(x => x && x.kind === 'life' && String(x.source) === source);
  return m && isNum(m.year) ? m.year : null;
}

// ------------------------------------------------------------------ planners

const P = {};

P.greeting = (S, u, opts = {}) => {
  const v = S.v, st = S.st, parts = [];
  if (st.greeted && !opts.initiated && !st.playerGreeted && st.npcOpened) {
    st.playerGreeted = true;
    parts.push(say(S, 'greet.ack'));
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
    else if (opts.initiated && S.rng.chance(0.4)) parts.push(pivot(S, { only: ['weather'] }));
  }
  return { parts, topics: [], ask: known ? 'howAreYou' : (opts.initiated ? 'visiting' : 'howAreYou'), askBoost: 0.15 };
};

P['how-are-you'] = (S, u) => {
  const v = S.v, m = v.mood, parts = [];
  const temp = v.tempF;
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
    if (v.stage === 'kid' && !v.weekend) reasons.push('why.school');
    if (nice) reasons.push('why.niceWeather');
  }
  parts.push(say(S, key, {}, key === 'hay.hot' ? ['weather.now'] : []));
  if (reasons.length && S.rng.chance(0.75)) {
    const r = reasons[0];
    const slots = { commuteMin: v.commute.minutes, alert: v.alerts[0] && v.alerts[0].event, sky: G.skyWords(v.wx.now && v.wx.now.short) };
    const facts = r === 'why.heat' || r === 'why.niceWeather' ? ['weather.now'] : r === 'why.alert' ? [`alert:${slots.alert}`] : r === 'why.commute' ? [REC.commute] : [];
    parts.push(say(S, r, slots, facts) || (reasons[1] ? say(S, reasons[1], slots) : null));
  }
  S.st.cs = m.tired ? 'tired' : (v.speaker.works && worksToday(v) && v.hour >= 9 && v.hour < 17 && key !== 'hay.good' ? 'busy' : null);
  return { parts, topics: ['self'], ask: 'howAreYou', askBoost: 0.35 };
};

function worksToday(v) {
  const days = num(v.commute.days, 0);
  return !!(days & (1 << v.P.dow));
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
    if (!st.gaveName) { parts.push(say(S, 'name.give')); st.gaveName = true; }
    return { parts, topics: ['self'], noAsk: true, learnedName: first };
  }
  if (/remember my name|what'?s my name|who am i/.test(u.norm)) {
    parts.push(v.relq.name ? say(S, 'name.yours') : say(S, 'name.forgot'));
    return { parts, topics: ['self'], ask: v.relq.name ? null : 'name', askBoost: 0.6 };
  }
  if (st.gaveName) parts.push(say(S, 'name.again'));
  else if (v.relq.guarded) parts.push(say(S, 'name.guarded'));
  else {
    parts.push(say(S, 'name.give'));
    if (v.nick && v.nick !== v.first) parts.push(say(S, 'name.nick'));
  }
  st.gaveName = true;
  return { parts, topics: ['self'], ask: v.relq.name ? null : 'name', askBoost: 0.4 };
};

/** "a baby", "little", "seven": how old they were when the family came, as said after "when I was". */
function arrivalAgeWords(age) {
  if (!isNum(age) || age < 0) return null;
  if (age <= 1) return { en: 'a baby', es: 'bebé' };
  if (age <= 5) return { en: 'little', es: null };
  return { en: numWord(age), es: null };
}

/** Where they're from, in their own words: born here, born elsewhere and raised here, or come from somewhere else. */
function originParts(S) {
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
  if (!res.bornHere && isNum(res.zipSince) && S.rng.chance(0.5)) out.push(say(S, v.flags.newcomer ? 'about.newHere' : 'about.years', {}, [REC.residence]));
  return out.filter(Boolean);
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
    if (name === 'church on Sundays') { out.push(say(S, 'about.church', {}, ['persona.interests'])); S.st.usedInterests.add(name); continue; }
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
  if (asked === 'english') return [say(S, 'lang.yesEnglish', { langName }, facts)];
  if (asked === 'any' || speaksAsked) return [say(S, 'lang.both', { langName }, facts)];
  return [say(S, 'lang.notThatBoth', { askedName, langName }, facts)];
}

// Spanish for the Latin American backgrounds, as "mi familia es ___" (feminine, after familia).
const HERITAGE_ES = {
  Mexican: 'mexicana', Salvadoran: 'salvadoreña', Guatemalan: 'guatemalteca', Honduran: 'hondureña', Nicaraguan: 'nicaragüense', Cuban: 'cubana',
  'Puerto Rican': 'puertorriqueña', Dominican: 'dominicana', Colombian: 'colombiana', Peruvian: 'peruana', Ecuadorian: 'ecuatoriana', Venezuelan: 'venezolana',
  Argentinian: 'argentina', Argentine: 'argentina', Chilean: 'chilena', Bolivian: 'boliviana', 'Costa Rican': 'costarricense', Panamanian: 'panameña', Spanish: 'española',
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
  const country = npc.nativity === 'foreign' && birthplace ? birthplace.split(',').map(x => x.trim()).pop() : null;
  if (country && !/California/.test(country)) {
    return [say(S, 'about.heritageFrom', { country, arrivalYear: isNum(npc.arrivalYear) ? npc.arrivalYear : null }, [...facts, REC.origin])];
  }
  if (!label || /^(American|Other)$/i.test(label)) return [say(S, 'about.heritageAmerican', {}, facts)];
  if (/^(Multiracial|Mixed)$/i.test(label)) return [say(S, 'about.heritageMixed', {}, facts)];
  const word = WHOLE_LABELS.test(label) ? null : label.replace(/\s+American$/, '');
  return [(word ? say(S, 'about.heritage', { heritageWord: word, heritageLabel: label, heritageWordEs: HERITAGE_ES[word] || null }, facts) : null) || say(S, 'about.heritageWhole', { heritageLabel: label }, facts)];
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
  if (u.entities.ownInterest && !(u.entities.interest && /\bdo you\b|\bare you\b/.test(q))) {
    // their own interest, named: "how's the harvest going?"
    const name = u.entities.ownInterest;
    const talk = interestTalk(name);
    if (talk) {
      const es = S.rng.pick(talk.es);
      parts.push(say(S, 'about.interestYes', { interestLine: S.rng.pick(talk.en), doingThing: talk.doing, interestEs: es[0], interestEn: es[1] }, ['persona.interests']));
      S.st.usedInterests.add(name);
      if (/harvest|farm/.test(name) && S.rng.chance(0.6)) parts.push(say(S, 'job.feel.farming'));
      return { parts, topics: ['self'], ask: 'weekend' };
    }
  }
  if (/how old|your age/.test(q)) {
    parts.push(say(S, 'about.age', {}, ['npc.age']));
    ask = 'job';
  } else if (/where did you go to (school|college|high school)|did you go to college|what did you study|did you finish (school|high school|college)|how far did you go in school|your education/.test(q)) {
    parts.push(...educationParts(S));
    ask = 'job';
  } else if (/where are you from|grow up|grew up|born|originally|come from|from here|from around here|from california|always lived|lived here (your whole|all your) life|immigra|when did you (come|get here|arrive|move)/.test(q)) {
    parts.push(...originParts(S));
    ask = 'from';
  } else if (u.entities.interest && /\bdo you\b|\bare you\b/.test(q)) {
    const key = u.entities.interest;
    const has = v.interests.find(i => i.toLowerCase().includes(key) || (key === 'skiing' && /ski/.test(i)) || (key === 'gaming' && /game|gaming/.test(i)) || (key === 'cars' && /car/.test(i)) || (key === 'church' && /church/.test(i)) || (key === 'biking' && /bik/.test(i)) || (key === 'music' && /music|concert/.test(i)));
    if (has) {
      parts.push(say(S, 'about.doYes'));
      const talk = interestTalk(has);
      if (talk) { const es = S.rng.pick(talk.es); parts.push(say(S, 'about.interestYes', { interestLine: S.rng.pick(talk.en), doingThing: talk.doing, interestEs: es[0], interestEn: es[1] }, ['persona.interests'])); S.st.usedInterests.add(has); }
    } else {
      parts.push(say(S, 'about.doNo'));
      const trad = new Set((v.p.interestDetails || []).filter(d => d.tradition).map(d => d.name));
      const other = v.interests.find(i => !trad.has(i) && !S.st.usedInterests.has(i));
      const talk = other ? interestTalk(other) : null;
      if (talk) { const es = S.rng.pick(talk.es); parts.push(say(S, 'about.instead', { interestShort: talk.short, interestEs: es[0], interestEn: es[1] }, ['persona.interests'])); S.st.usedInterests.add(other); }
    }
    ask = 'weekend';
  } else if (u.entities.team || /\bfan\b|\bfollow\b|\broot for\b/.test(q)) {
    return P.smalltalk(S, Object.assign({}, u, { norm: `${u.norm} sports` }));
  } else if (/hobb|for fun|free time|spare time|into|like to do|enjoy|weekend|days? off/.test(q)) {
    parts.push(...interestParts(S, 2));
    // the team, unless one of the interests just said was the team
    const teamSaid = v.team && [...S.st.usedInterests].some(i => String(i).toLowerCase().includes(String(v.team.name || '').toLowerCase()));
    if (v.team && !teamSaid && S.rng.chance(0.5)) parts.push(say(S, 'about.team', {}, ['persona.teams']));
    ask = 'weekend';
  } else {
    if (!S.st.gaveName) { parts.push(say(S, 'name.give')); S.st.gaveName = true; }
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
    if (emp) return [say(S, 'job.which', { employer: emp, employerCap: capFirst(emp), workCity }, workCity ? [REC.job, REC.commute] : facts)];
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
  if (sub === 'before') return [say(S, 'job.before')];
  if (sub === 'pay') {
    const inc = num(npc.income, null);
    return [say(S, isNum(inc) && inc < 35000 ? 'job.payLow' : isNum(inc) && inc >= 150000 ? 'job.payHigh' : 'job.pay', {}, isNum(inc) ? ['npc.income'] : [])];
  }
  return null;
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
    if (occ && occ.title && ['which', 'where', 'hours', 'pay', 'days'].includes(sub)) { const p = jobSub(S, sub, u); if (p) return { parts: p, topics: ['job'], ask: null }; }
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
    if (sub === 'howLong' && v.flags.kids && v.age >= 18) return { parts: [say(S, 'job.homemakerSince')], topics: ['job'], ask: null };
    if (v.flags.kids && v.age >= 18) parts.push(say(S, 'job.homemaker', {}, ['npc.status']));
    else parts.push(say(S, 'job.notWorking', {}, ['npc.status']));
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
  const feel = feelKey(v.occKey, title);
  if (((S.st.depth.job || 0) > 0 || likeIt) && !opts.brief) {
    const more = [say(S, feel) || say(S, 'job.feel.any')];
    if (workCity && num(v.commute.minutes) >= 20 && !v.flags.wfh) more.push(say(S, 'job.commute', { workCity, commuteMin: v.commute.minutes }, [REC.commute]));
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
  if (workCity && num(v.commute.minutes) >= 20 && !v.flags.wfh) extra.push(say(S, 'job.commute', { workCity, commuteMin: v.commute.minutes }, [REC.commute]));
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
  return listJoin(list.map(k => (k.name ? `${k.name}'s ${num(k.age) < 1 ? 'just a baby' : k.age}` : null)).filter(Boolean));
}

/** Follow-ups about the household: names, ages, boys or girls, what the partner does, the kids' schools. */
function familySub(S, sub, u) {
  const v = S.v, R = v.rel, facts = [REC.home], q = u ? u.norm : '';
  const kids = R.kids.slice().sort((a, b) => num(b.age) - num(a.age));
  const p = R.partner;
  const pron = x => (x && x.sex === 'F' ? 'She' : 'He');
  const partnerWord = p ? (p.role === 'partner' || v.npc.role === 'partner' ? 'partner' : p.sex === 'F' ? 'wife' : 'husband') : null;
  const partnerEs = p ? (partnerWord === 'partner' ? 'pareja' : p.sex === 'F' ? 'esposa' : 'esposo') : null;
  const aboutPartner = !!p && (/\b(wife|husband|partner|spouse|she|her|he|his|him)\b/.test(q) || (!kids.length && !/\b(kids|children|they|them|their)\b/.test(q)));
  // the people "they" means: the kids, else whoever else lives with them
  const others = kids.length ? kids : R.grandkids.length ? R.grandkids : R.parents.length ? R.parents : R.siblings.length ? R.siblings : R.roommates;
  if (sub === 'partnerJob') {
    if (!p) return [say(S, v.flags.widowed ? 'fam.widowed' : 'fam.noPartner', { lostWord: v.sex === 'F' ? 'husband' : 'wife' }, facts)];
    const job = partnerJob(S, p);
    const slots = { partnerPronoun: pron(p), partnerWord, partnerEs, aPartnerJob: job.title ? withArticle(job.title) : null, elloEs: p.sex === 'F' ? 'Ella' : 'Él' };
    if (job.title) return [say(S, 'fam.partnerJob', slots, ['npc.household', 'household.occupation'])];
    if (job.worker) return [say(S, 'fam.partnerWorks', slots, facts)];
    return [say(S, num(p.age) >= 65 ? 'fam.partnerRetired' : 'fam.partnerHome', slots, facts)];
  }
  if (sub === 'names') {
    if (/\b(wife|husband|spouse|partner)\b/.test(q) && !p) return [notMarried(S)];
    if (aboutPartner) return [say(S, 'fam.partnerName', { partnerName: p.name, partnerWord, partnerEs }, facts)];
    const named = others.filter(x => x.name);
    if (!named.length) return [say(S, 'fam.namesNone', {}, facts)];
    if (named.length === 1) return [say(S, 'fam.oneName', { otherName: named[0].name, otherPronoun: pron(named[0]) }, facts)];
    const names = named.map(x => x.name);
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
    if (!kids.length) return [say(S, R.grandkids.length ? 'fam.noKidsHome' : 'fam.noKids', {}, facts)];
    const girls = kids.filter(k => k.sex === 'F').length, boys = kids.length - girls;
    const part = (n, one, many) => (n ? `${n === 1 ? 'one' : numWord(n)} ${n === 1 ? one : many}` : null);
    const NUM_ES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
    const parte = (n, one, many) => (n ? `${n === 1 ? (one === 'niña' ? 'una' : 'un') : NUM_ES[n] || n} ${n === 1 ? one : many}` : null);
    const kidsSexes = listJoin([part(girls, 'girl', 'girls'), part(boys, 'boy', 'boys')]);
    return [say(S, 'fam.sexes', { kidsSexes, kidsSexesCap: capFirst(kidsSexes), kidsSexesEs: listJoin([parte(girls, 'niña', 'niñas'), parte(boys, 'niño', 'niños')], 'y') }, facts)];
  }
  if (sub === 'kidsDo') {
    if (!kids.length) return [say(S, R.grandkids.length ? 'fam.noKidsHome' : 'fam.noKids', {}, facts)];
    const members = (v.routine && v.routine.household && v.routine.household.members) || [];
    const doing = k => {
      const m = members.find(x => x && x.m === k.m) || {};
      if (num(k.age) < 5) return ['still little', 'todavía está chiquit' + (k.sex === 'F' ? 'a' : 'o')];
      const w = schoolOfAge(k.age);
      if (w) return [`in ${w[0]}`, `va a la ${w[1]}`];
      if (m.student === 'college' || m.student === 'grad') return ['in college', 'va a la universidad'];
      if (m.worker) return ['working', 'trabaja'];
      return ['home with us', 'está en la casa'];
    };
    const named = kids.filter(k => k.name);
    if (!named.length) return [say(S, 'fam.kidsMany', { kidCount: numWord(kids.length) }, facts)];
    const en = named.map(k => `${k.name}'s ${doing(k)[0]}`), es = named.map(k => `${k.name} ${doing(k)[1]}`);
    return [say(S, 'fam.kidsDo', { kidsDoing: listJoin(en), kidsDoingCap: capFirst(listJoin(en)), kidsDoingEs: listJoin(es, 'y') }, ['npc.household', 'household.members'])];
  }
  if (sub === 'howLong' && /\bmarried\b|\btogether\b/.test(q)) {
    if (!p || (/\bmarried\b/.test(q) && !v.flags.married)) return [notMarried(S)];
    const wed = (v.p.memories || []).find(m => m.kind === 'life' && /got married in (\d{4})/.test(m.text || ''));
    return [wed ? say(S, 'fam.married', { partnerName: p.name, weddingYear: wed.year }, ['npc.household']) : say(S, 'fam.togetherLong', { partnerWord, partnerEs }, facts)];
  }
  if (sub === 'school') {
    const inSchool = kids.map(k => ({ k, w: schoolOfAge(k.age) })).filter(x => x.w);
    if (!inSchool.length) return [say(S, kids.length ? 'fam.noneInSchool' : 'fam.noKids', {}, facts)];
    if (inSchool.length === 1) return [say(S, 'fam.oneSchool', { otherPronoun: pron(inSchool[0].k), school: inSchool[0].w[0], schoolEs: inSchool[0].w[1] }, facts)];
    const levels = [...new Set(inSchool.map(x => x.w[0]))];
    const count = l => inSchool.filter(x => x.w[0] === l).length;
    const schoolsList = listJoin(levels.map(l => `${count(l) === 1 ? 'one' : numWord(count(l))} in ${l}`));
    return [say(S, levels.length === 1 ? 'fam.sameSchool' : 'fam.schools', { school: levels[0], schoolCap: capFirst(levels[0]), allWord: inSchool.length === 2 ? 'both' : 'all', schoolsList, schoolEs: inSchool[0].w[1] }, facts)];
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

/** What their partner does, from the household's record: {title, worker}. The population, when the conversation has one, gives the title. */
function partnerJob(S, p) {
  const v = S.v;
  let title = null, worker = null;
  const pop = S.population;
  if (pop && typeof pop.person === 'function' && Number.isInteger(v.npc.zi) && Number.isInteger(v.npc.h)) {
    try {
      const rec = pop.person(v.npc.zi, v.npc.h, p.m);
      if (rec && rec.occupation && rec.occupation.title) title = String(rec.occupation.title).replace(/\s*\([^)]*\)\s*$/, '');
      if (rec) worker = rec.status === 'employed' || rec.status === 'military' || !!rec.occupation;
    } catch { title = null; }
  }
  if (worker === null) {
    const m = ((v.routine && v.routine.household && v.routine.household.members) || []).find(x => x && x.m === p.m);
    worker = m ? !!m.worker : null;
  }
  return { title, worker };
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
  if (sub && v.age >= 18 && ['names', 'ages', 'sexes', 'partnerJob', 'school', 'kidsDo', 'howLong'].includes(sub)) {
    const sp = familySub(S, sub, u);
    if (sp && sp.filter(Boolean).length) return { parts: sp, topics: ['family'], ask: sub === 'partnerJob' ? 'job' : 'kids' };
  }
  const q0 = u ? u.norm : '';
  if (v.age >= 18) {
    // the question asked, answered first: married? grandkids? where are your parents?
    if (/\bare you (married|single|seeing anyone|dating anyone)\b|\bis there a (mr|mrs)\b/.test(q0) && (!R.partner || !v.flags.married)) return { parts: [notMarried(S)], topics: ['family'], ask: 'kids' };
    if (/\bgrand(kids|children|sons?|daughters?|babies)\b/.test(q0) && !R.grandkids.length) {
      const p = [say(S, v.age < 40 ? 'fam.noGrandkidsYoung' : 'fam.noGrandkids', {}, facts)];
      return { parts: p, topics: ['family'], ask: 'kids' };
    }
    if (/\byour (parents|mom|dad|mother|father|folks)\b/.test(q0) && !/\bkids?\b|\bchildren\b/.test(q0)) {
      const pw = parentsWords(S);
      if (pw) return { parts: [say(S, 'fam.parentsHere', { parentsWord: pw.en, parentsEs: pw.es }, facts)], topics: ['family'], ask: null };
      const abroad = (v.p.concerns || []).some(c => c.topic === 'family abroad') && v.npc.nativity === 'foreign';
      const homeland = abroad && str(v.npc.birthplace) ? String(v.npc.birthplace).split(',').map(x => x.trim()).pop() : null;
      return { parts: [homeland ? say(S, 'fam.abroad', { homeland }, [REC.origin]) : say(S, 'fam.parentsElsewhere', {}, facts)], topics: ['family'], ask: null };
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
    if (pw) {
      const term = pw.rel ? homeWord(S, pw.rel, pw.en) : null;
      parts.push(say(S, sibSaid ? 'fam.parentsToo' : 'fam.parents', { parentsWord: term || pw.en, parentsEs: pw.es }, facts));
    } else if (R.grandparents.length) parts.push(say(S, 'fam.grandparents', gpSlots(S, R.grandparents), facts));
    if (sib && !sibSaid) parts.push(say(S, 'fam.siblings', { sibWords: sib.en, sibEs: sib.es }, facts));
    return { parts, topics: ['family'], ask: null };
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
      if (sib && !sibSaid) parts.push(say(S, 'fam.siblings', { sibWords: sib.en, sibEs: sib.es }, facts));
    } else if (v.flags.alone) parts.push(say(S, v.flags.widowed ? 'fam.widowed' : 'fam.alone', { lostWord: v.sex === 'F' ? 'husband' : 'wife' }, facts));
    else if (R.roommates.length) parts.push(say(S, 'fam.roommates', { roomWords: R.roommates.length === 1 ? 'a roommate' : `${numWord(R.roommates.length)} roommates` }, facts));
    else if (R.relatives.length || R.siblings.length) parts.push(say(S, 'fam.relatives', {}, facts));
  }
  if (R.grandparents.length && v.age >= 18) parts.push(say(S, 'fam.grandparents', gpSlots(S, R.grandparents), facts));
  const abroad = (v.p.concerns || []).find(c => c.topic === 'family abroad');
  if (abroad && v.npc.nativity === 'foreign') {
    const homeland = str(v.npc.birthplace) ? String(v.npc.birthplace).split(',').map(s => s.trim()).pop() : null;
    if (homeland && !/California/.test(homeland)) parts.push(say(S, 'fam.abroad', { homeland }, [REC.origin]));
  }
  if (!parts.filter(Boolean).length) parts.push(say(S, 'fam.alone', {}, facts));
  return { parts, topics: ['family'], ask: 'kids' };
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
  if (/how long|when did you move|since when|have you always/.test(q)) {
    if (res.bornHere) parts.push(say(S, 'about.bornHere', {}, [REC.residence]));
    else parts.push(say(S, 'home.since', {}, facts) || say(S, 'about.years', {}, [REC.residence]));
    if (res.grewUpHere && !res.bornHere) parts.push(say(S, 'about.grewUpCounty', {}, [REC.residence]));
    if (!res.bornHere && num(v.P.year - num(res.zipSince, v.P.year)) >= 5) parts.push(say(S, 'hood.change', {}, [REC.residence]));
    return { parts, topics: ['housing', 'history'], ask: 'lives' };
  }
  if (/where do you live|where'?s your/.test(q)) parts.push(say(S, 'home.where'));
  if (head && v.hh.tenure === 'own') parts.push(say(S, v.flags.house ? 'home.ownHouse' : v.flags.mobile ? 'home.mobile' : 'home.ownOther', {}, facts));
  else if (head || v.npc.role === 'roommate') parts.push(say(S, 'home.rent', {}, facts));
  else {
    const pw = parentsWords(S);
    parts.push(say(S, 'home.family', { parentsWord: pw ? pw.en : null }, facts));
    if (res.bornHere && v.age >= 13) parts.push(say(S, 'home.childhood', {}, [REC.residence]));
  }
  if (head && S.rng.chance(0.5) && !parts.some(p => p && S.base.yearMoved && p.text.includes(String(S.base.yearMoved)))) parts.push(say(S, 'home.since', {}, facts));
  if (v.flags.house && head) {
    const roof = v.p.roof;
    if (isNum(v.hh.yearBuilt) && S.rng.chance(0.5)) parts.push(say(S, 'home.built', { yearBuilt: v.hh.yearBuilt }, facts));
    if (roof && !roof.original && isNum(roof.installed)) parts.push(say(S, 'home.roofNew', { roofYear: roof.installed }, ['persona.roof']));
    else if (roof && roof.original && num(roof.age) >= 18) parts.push(say(S, 'home.roofOld', {}, ['persona.roof']));
    if (roof && roof.solar) parts.push(say(S, 'home.solar', {}, ['persona.roof']));
  }
  parts.push(say(S, v.flags.apartment ? 'home.feelApt' : v.flags.mobile ? 'home.mobile' : 'home.feelHouse'));
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
  if (/do you like|best|love/.test(q) || u.flags.likeIt) parts.push(say(S, 'hood.like'), lex(S, 'prideLines'));
  if (/worst|hate|bad|problem/.test(q)) parts.push(lex(S, 'complaintLines') || say(S, 'hood.like'));
  parts.push(say(S, v.flags.urban ? 'hood.urban' : v.flags.rural ? 'hood.rural' : 'hood.suburban', {}, ['acs.density']));
  const lang = census.langs.find(l => l.share >= 0.15 && !S.st.used.has(l.id));
  if (lang && S.rng.chance(0.7)) {
    const p = say(S, 'hood.lang', { langName: lang.name, langNameCap: lang.name, share: G.shareWords(lang.share), shareVerbEs: shareVerbEs(lang.share), langEs: LANG_ES[lang.name] }, [lang.id]);
    if (p) { parts.push(p); S.st.used.add(lang.id); }
  }
  if (census.yb && S.rng.chance(0.4)) parts.push(say(S, 'hood.old', { decade: census.yb.decade }, [census.yb.id]));
  if (v.lex.values.peak && S.rng.chance(0.4)) parts.push(say(S, 'hood.landmark', { peak: v.lex.values.peak }, [v.lex.facts.peak]));
  if (v.flags.longtime && !v.res.bornHere && isNum(v.res.zipSince) && S.rng.chance(0.5)) parts.push(say(S, 'hood.change', {}, [REC.residence]));
  if (S.rng.chance(0.5)) parts.push(v.mood.valence < -0.1 || v.big5.A < 0.4 ? lex(S, 'complaintLines') : lex(S, 'prideLines'));
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

P.weather = (S, u) => {
  const v = S.v, W = G.weatherFacts(v), parts = [];
  const q = u.norm;
  const nowFacts = [W.ids.now];
  const aheadQ = u.flags.sub === 'ahead' || /tomorrow|tonight|weekend|forecast|later|will it|going to|this week|thanksgiving/.test(q);
  if (W.stale && !/\bair\b|\bsmog\b|\baqi\b|\bsmoke\b|\bsnow/.test(q)) return staleWeather(S, W, aheadQ);
  if (W.stale) parts.push(say(S, 'wx.stale', { temp: W.temp }, nowFacts));
  else {
    const ce = cieloEs(W.short);
    parts.push(say(S, W.sky ? 'wx.now' : 'wx.nowPlain', { temp: W.temp, sky: W.sky, skyAdj: G.skyAdj(W.sky), cieloEs: ce[0] }, nowFacts) || say(S, 'wx.nowPlain', { temp: W.temp }, nowFacts));
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
  if (night && isNum(night.temp)) fc.push(say(S, 'wx.tonight', { low: night.temp, nextSky: night.sky }, [W.ids.next]));
  if (day && isNum(day.temp) && day.sky) {
    const ce = cieloEs(day.sky.replace(/^a (slight )?chance of /, 'chance '));
    fc.push(say(S, 'wx.next', { when: day.when, whenCap: capFirst(day.when), nextSky: day.sky, nextSkyAdj: G.skyAdj(day.sky), high: day.temp, nextCieloEs: ce[1], cuandoEs: capFirst(cuandoEs(day.when)) }, [W.ids.next]));
  }
  const wet = W.periods.find(p => isNum(p.pop) && p.pop >= 30);
  if (wet) fc.push(say(S, 'wx.rainChance', { pop: wet.pop, when: wet.when, cuandoEs: cuandoEs(wet.when) }, [W.ids.next]));
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
  if (again) { parts.splice(0, parts.length); if (climateQ) parts.push(...climate, ...fc, ...alertParts, ...feel); else parts.push(...fc, ...alertParts, ...climate, ...feel); if (!parts.filter(Boolean).length) parts.push(say(S, 'wx.nowPlain', { temp: W.temp }, nowFacts)); }
  else if (ahead && fc.filter(Boolean).length) { const now = parts.splice(0, parts.length); parts.push(...fc, ...alertParts, ...now.slice(0, 1), ...feel); }
  else if (ahead) parts.push(...alertParts, ...feel);
  else if (climate.length) parts.push(...climate, ...alertParts, ...feel);
  else parts.push(...alertParts, ...feel, ...fc);
  S.st.cs = cond === 'heat' ? 'weather_hot' : cond === 'cold' ? 'weather_cold' : cond === 'rain' ? 'weather_rain' : null;
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
  if (trafficAgain) {
    // already told about their own commute: the big road, a named stretch, how the neighbors get around
  } else if (v.age < 13) {
    parts.push(kidRide(S) || say(S, 'tr.kid'));
  } else if (v.age < 16) {
    parts.push(kidRide(S) || say(S, 'tr.teenDrive'));
  } else if (v.flags.wfh && mainRoad) {
    parts.push(say(S, v.flags.onFarm ? 'tr.onFarm' : 'tr.wfh', rd(mainRoad), [mainRoad.id, REC.commute]));
  } else if (v.flags.commuter) {
    const min = c.minutes, workCity = c.workCity && c.workCity !== v.z.city ? c.workCity : null;
    if (['drive', 'taxi', 'motorcycle'].includes(mode) || (mode === 'carpool')) {
      const r = commuteRoad || mainRoad;
      if (mode === 'carpool' && workCity) parts.push(say(S, 'tr.carpool', { workCity, commuteMin: min }, [REC.commute]));
      else if (mode === 'motorcycle' && workCity) parts.push(say(S, 'tr.motorcycle', { workCity, commuteMin: min }, [REC.commute]));
      else if (workCity && r) parts.push(say(S, 'tr.drive', Object.assign({ workCity, commuteMin: min }, rd(r)), [r.id, REC.commute]));
      else parts.push(say(S, 'tr.driveLocal', { commuteMin: min }, [REC.commute]));
    } else if (['bus', 'rail', 'ferry'].includes(mode)) {
      const t = transitWord(v, mode);
      parts.push(say(S, 'tr.transit', { transit: t.en, transitCap: capFirst(t.en), transitEs: t.es, workCity: workCity || 'work', commuteMin: min }, [REC.commute]));
    } else if (mode === 'bike') parts.push(say(S, 'tr.bike', { commuteMin: isNum(min) && min <= 75 ? min : null }, [REC.commute]));
    else if (mode === 'walk') parts.push(say(S, 'tr.walk', { commuteMin: isNum(min) && min <= 50 ? min : null }, [REC.commute]));
  } else if (v.flags.retired && mainRoad) {
    parts.push(say(S, 'tr.retired', rd(mainRoad), [mainRoad.id]));
  } else if (num(v.hh.vehicles, 1) === 0) {
    parts.push(say(S, 'tr.noCar', {}, [REC.home]));
  } else parts.push(say(S, 'tr.nonDriver'));
  // the big road nearby, as locals say it, with its traffic count
  const mentioned = parts.filter(Boolean).some(p => roads.some(r => p.text.includes(r.name) || (p.gloss || '').includes(r.name)));
  const big = roads.filter(r => r.aadt).sort((a, b) => b.aadt - a.aadt)[0] || mainRoad;
  if (big && (!mentioned || trafficAgain || S.rng.chance(0.5)) && !(trafficAgain && S.st.used.has(`aadt:${big.road.name}`))) {
    S.st.used.add(`aadt:${big.road.name}`);
    const aadt = G.aadtWords(big.aadt);
    parts.push(aadt ? say(S, 'tr.road', Object.assign({ aadt, aadtEs: approxEs(approx(big.aadt)) }, rd(big)), [big.id, `aadt:${big.road.name}`]) : say(S, 'tr.roadSmall', rd(big), [big.id]));
  }
  if (v.lang.mode === 'en' && v.age >= 16 && v.speaker.drives === true && S.rng.chance(0.55)) {
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
  if (S.rng.chance(0.3) || !parts.filter(Boolean).length) parts.push(say(S, 'tr.feel') || say(S, 'op.traffic', { road: mainRoad ? mainRoad.name : null }, mainRoad ? [mainRoad.id] : []));
  S.st.cs = 'traffic_bad';
  return { parts, topics: ['traffic'], ask: 'drive', keep: 1 };
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
    if (rail) return { en: /^the /i.test(rail) || /^(BART|Caltrain|Metrolink|Muni|ACE)$/.test(rail) ? rail : `the ${rail}`, es: rail.replace(/^the /i, 'el ') };
    return { en: 'the train', es: 'tren' };
  }
  if (mode === 'ferry') return { en: 'the ferry', es: 'ferry' };
  return { en: 'the bus', es: 'autobús' };
}

function kidRide(S) {
  const v = S.v, c = v.commute || {};
  if (!v.npc.school || v.npc.school === 'college') return null;
  if (c.mode === 'walk') return say(S, 'tr.kidWalk', {}, [REC.commute]);
  if (c.mode === 'bus') return say(S, 'tr.kidBus', {}, [REC.commute]);
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
      return { parts: [say(S, 'fire.impact', Object.assign({ exp: f.memory.experience }, fireSlots(f)), [f.id, 'persona.memory'])], topics: ['fire'], ask: 'fire', emotion: 'wistful', keep: 2 };
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
    if (childMemory && !exp) parts.push(say(S, ageThen < 10 ? 'fire.livedChild' : 'fire.livedTeen', Object.assign({ ageThen }, slots), [f.id]));
    else if (childMemory) parts.push(say(S, remember, slots, [f.id]));
    else if (f.memory && f.lived && here) parts.push(say(S, 'fire.lived', slots, [f.id]));
    else if (f.memory || !f.before) parts.push(say(S, remember, slots, [f.id]));
    else parts.push(say(S, 'fire.before', slots, [f.id]));
    if (exp) parts.push({ text: exp, gloss: null, facts: ['persona.memory'], key: 'memory' });
    if (f.destInZip > 0) parts.push(say(S, f.lived ? 'fire.toll' : 'fire.tollThere', slots, [f.id]));
    else if (!here && f.km < 60) parts.push(say(S, 'fire.distance', slots, [f.id]));
    else if (f.acres > 0 && !parts.some(p => p && slots.acres && p.text.includes(slots.acres))) parts.push(say(S, 'fire.size', slots, [f.id]));
    const other = fires.find(x => x !== f && !st.used.has(x.id) && (x.destInZip > 0 || x.acres >= 5000));
    if (other && S.rng.chance(depth > 0 ? 0.7 : 0.35)) { parts.push(say(S, 'fire.other', fireSlots(other), [other.id])); st.used.add(other.id); }
  } else {
    const near = G.nearestFire(v);
    if (near && isNum(near.km) && !st.used.has(near.id)) { parts.push(say(S, 'fire.near', { fire: near.label, fireEs: fireEs(near.label.replace(/^the /, '')), year: near.year, miles: G.miles(near.km) }, [near.id])); st.used.add(near.id); }
    else if (depth > 0) parts.push(say(S, 'fire.nothingMore'));
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
  st.cs = f && (f.destInZip > 0 || f.memory) ? 'frustration' : null;
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
    if (rec.gust && !st.used.has(rec.gust.id)) { parts.push(say(S, 'storm.gustRecord', { gust: rec.gust.value, when: monthYear(rec.gust.dt) }, [rec.gust.id])); st.used.add(rec.gust.id); }
    // a question about the wind is answered about the wind
    if (parts.filter(Boolean).length) {
      if (S.rng.chance(0.4)) parts.push(say(S, 'storm.prep'));
      return { parts, topics: ['weather'], ask: 'weather' };
    }
  }
  const ar = G.arFacts(v).filter(a => !st.used.has(a.id)).sort((a, b) => (b.memory ? 1 : 0) - (a.memory ? 1 : 0) || b.rank - a.rank || (b.start > a.start ? 1 : -1))[0];
  if (ar && (C.ar === null || C.ar >= 1)) {
    st.used.add(ar.id);
    if (ar.memory && ar.memory.experience && v.lang.mode === 'en') {
      parts.push(say(S, 'storm.arLived', { when: monthYear(ar.dt), exp: ar.memory.experience }, [ar.id, 'persona.memory']));
      parts.push(say(S, 'storm.arRank', { rank: ar.rank }, [ar.id]));
    } else parts.push(say(S, 'storm.ar', { when: partOfMonth(ar.dt), whenCap: capFirst(partOfMonth(ar.dt)), rank: ar.rank, mesAnoEs: mesAno(ar.dt) }, [ar.id]));
  }
  const fema = G.femaFacts(v).storms.filter(f => !st.used.has(f.id))[0];
  if (fema && fema.title) {
    st.used.add(fema.id);
    const title = G.femaTitle(fema.title);
    if (fema.memory && fema.memory.experience && v.lang.mode === 'en') parts.push(say(S, 'storm.femaLived', { title, exp: fema.memory.experience }, [fema.id, 'persona.memory']));
    else parts.push(say(S, 'storm.fema', { title, when: monthYear(fema.dt), mesAnoEs: mesAno(fema.dt) }, [fema.id]));
  }
  if (rec.rain && !st.used.has(rec.rain.id) && S.rng.chance(0.5)) { parts.push(say(S, 'storm.rainRecord', { rainRec: rec.rain.value, when: monthYear(rec.rain.dt), mesAnoEs: mesAno(rec.rain.dt) }, [rec.rain.id])); st.used.add(rec.rain.id); }
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
  S.st.cs = v.sky === 'rain' ? 'weather_rain' : null;
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
    if (isNum(W.temp)) parts.push(say(S, 'heat.now', { temp: W.temp }, [W.ids.now]));
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
    parts.push(say(S, 'heat.record', { recTemp: rec.heat.value, recDate: fullDate(dt), recDateEs: dateEs }, [rec.heat.id]));
    if (rec.heat.memory && rec.heat.memory.experience && v.lang.mode === 'en') parts.push(say(S, 'heat.recordLived', { exp: rec.heat.memory.experience }, [rec.heat.id, 'persona.memory']));
  }
  if (isNum(W.temp) && (W.temp >= 85 || /\b(today|right now|now)\b/.test(u.norm))) parts.push(say(S, 'heat.now', { temp: W.temp }, [W.ids.now]));
  const ha = W.alerts.find(a => a.heat);
  if (ha) parts.push(say(S, 'heat.alert', { alert: ha.event }, [ha.id]));
  if (num(C.h90) >= 10 || v.flags.outdoor) parts.push(say(S, 'heat.cope'));
  S.st.cs = v.sky === 'heat' ? 'weather_hot' : null;
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
    if (rent) parts.push(say(S, 'rent.ownerSide', {}, [REC.home]));
    const years = v.P.year - num(v.hh.yearMoved, v.P.year);
    parts.push(say(S, years >= 20 ? 'house.boughtLong' : 'house.bought', {}, [REC.home]) || say(S, 'house.bought', {}, [REC.home]));
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
      parts.push(say(S, 'quake.lived', { title, exp: q.memory.experience, year: q.dt.y }, [q.id, 'persona.memory']));
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

P.food = (S, u) => {
  const v = S.v, parts = [];
  const census = G.censusFacts(v);
  if (v.age >= 13) parts.push(lex(S, 'food'));
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
  if (census.food && (!parts[0] || S.rng.chance(0.45))) {
    const per = census.food.per10k;
    const near = (v.p.knowledge && v.p.knowledge.nearbyPlaces || []).slice().sort((a, b) => num(b.pop) - num(a.pop))[0];
    parts.push(per >= 40 ? say(S, 'food.lots', {}, [census.food.id]) : per >= 12 ? say(S, 'food.some', {}, [census.food.id]) : say(S, 'food.few', { nearTown: near ? near.name : null }, [census.food.id, near ? `place:${near.name}` : null]));
  }
  if (S.rng.chance(0.4)) parts.push(say(S, 'food.tip'));
  return { parts, topics: ['food'], ask: 'food' };
};

P.place = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  const F = G.placeFacts(v);
  const cands = [];
  if (F.beach) cands.push(() => say(S, 'place.beach', { beach: F.beach.label, miles: G.miles(F.beach.distKm), milesEs: millasEs(G.miles(F.beach.distKm)) }, [`place:${F.beach.label}`]));
  if (F.trail) cands.push(() => say(S, 'place.trail', { trail: F.trail.label, miles: G.miles(F.trail.distKm) }, [`landmark:${F.trail.name}`]));
  for (const l of F.landmarks.filter(l => l.rank <= 2 || (l.kind === 'peak' && num(l.elev) >= 500)).slice(0, 2)) cands.push(() => say(S, 'place.landmark', { landmark: l.label }, [l.id]));
  // a bay's landmark point can be miles offshore: no distance for open water
  if (F.water) cands.push(() => say(S, 'place.water', { water: F.water.label, miles: /\b(Bay|Ocean|Sea|Channel|Strait|Sound)\b/.test(F.water.label) ? null : G.miles(F.water.distKm) }, [`landmark:${F.water.name}`]));
  if (F.game && v.team) cands.push(() => say(S, 'place.game', {}, ['persona.teams']));
  for (const t of F.towns.filter(t => num(t.pop) >= 15000).slice(0, 2)) {
    const p = v.world.places.find(x => x.name === t.name);
    const dir = p ? compass(p.x - v.home.x, p.y - v.home.y) : null;
    if (dir) cands.push(() => say(S, 'place.town', { town: t.name, miles: G.miles(t.distKm), milesEs: millasEs(G.miles(t.distKm)), dir, dirEs: DIR_ES[dir] }, [t.id]));
  }
  const fav = v.interests.find(i => !st.usedInterests.has(i) && interestTalk(i) && interestTalk(i).place);
  if (fav && v.age >= 13) { const talk = interestTalk(fav); cands.push(() => say(S, 'place.mine', { doingThing: talk.doing }, ['persona.interests'])); }
  if (F.park) cands.push(() => say(S, 'place.park'));
  const ordered = [...S.rng.shuffle(cands.slice(0, Math.max(0, cands.length - (F.park ? 1 : 0)))), ...(F.park ? [cands[cands.length - 1]] : [])];
  for (const f of ordered) { if (parts.filter(Boolean).length >= 3) break; parts.push(f()); }
  if (!parts.filter(Boolean).length) parts.push(say(S, 'place.none'));
  return { parts, topics: ['neighborhood'], ask: 'visiting' };
};

P.directions = (S, u) => {
  const v = S.v, parts = [];
  const pw = parentsWords(S);
  if (v.age < 10) { parts.push(say(S, 'dir.kid', { parentWord: pw ? pw.en : 'mom', parentEs: pw ? pw.es : 'mi mamá' })); return { parts, topics: ['directions'], noAsk: true }; }
  const F = G.placeFacts(v);
  const place = u.entities.places[0];
  let target = null, label = null, id = null;
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
      if (p) { target = p; label = `downtown ${p.name}`; id = `place:${p.name}`; }
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
  const slots = { target: label, miles: R.miles, milesCap: capFirst(R.miles || ''), dir: R.dir || 'from here', dirEs: R.dir ? DIR_ES[R.dir] : 'de aquí', milesEs: millasEs(R.miles), road: R.road, roadEs: R.road ? roadEs(R.road) : null };
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
  if (!st.used.has('hist.residence')) {
    st.used.add('hist.residence');
    if (res.grewUpHere) parts.push(say(S, 'hist.grew', {}, [REC.residence]));
    else if (v.npc.nativity === 'foreign' && isNum(v.npc.arrivalYear)) parts.push(say(S, 'hist.arrival', { arrivalYear: v.npc.arrivalYear }, [REC.origin]));
    else if (isNum(res.zipSince)) parts.push(say(S, 'hist.since', {}, [REC.residence]));
  }
  const events = (v.p.memories || []).filter(m => m.kind !== 'life' && !st.usedMemories.has(m.source));
  const m = events[0];
  if (m) {
    st.usedMemories.add(m.source);
    const id = memoryFact(m);
    if (id) st.used.add(id);
    const title = memTitleOf(m);
    parts.push(say(S, 'hist.event', { memTitle: title, memTitleCap: capFirst(title), exp: m.experience || null, memEs: memoryEs(m) }, [id, 'persona.memory'])
      || say(S, 'hist.event', { memTitle: title, memTitleCap: capFirst(title), exp: '', memEs: memoryEs(m) }, [id]));
  } else {
    const life = (v.p.memories || []).filter(x => x.kind === 'life' && !st.usedMemories.has(x.source + x.year));
    if (life[0] && v.lang.mode === 'en') { st.usedMemories.add(life[0].source + life[0].year); parts.push(say(S, 'hist.life', { lifeLine: life[0].text }, [memoryFact(life[0])])); }
    else { parts.push(say(S, 'hist.more')); parts.push(pivot(S)); }
  }
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
  for (const k of ['heat', 'rain', 'gust']) if (rec[k] && rec[k].dt.y === year) return { en: k === 'heat' ? `the record heat, ${rec[k].value} degrees` : k === 'rain' ? `the record rain, ${rec[k].value} inches in a day` : `the record wind, ${rec[k].value} miles an hour`, es: k === 'heat' ? 'calor récord' : k === 'rain' ? 'aguacero récord' : 'viento récord', id: rec[k].id };
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
    if (roof && !roof.original && isNum(roof.installed)) parts.push(say(S, 'home.roofNew', { roofYear: roof.installed }, ['persona.roof']));
    else if (roof && num(roof.age) >= 15) parts.push(say(S, 'home.roofOld', {}, ['persona.roof']));
  } else if (topic === 'family abroad' && v.npc.nativity === 'foreign') {
    const homeland = str(v.npc.birthplace) ? String(v.npc.birthplace).split(',').map(x => x.trim()).pop() : null;
    if (homeland && !/California/.test(homeland)) parts.push(say(S, 'fam.abroad', { homeland }, [REC.origin]));
  } else if (topic === 'jobs' && v.npc.status === 'unemployed') parts.push(say(S, 'job.unemployed', {}, ['npc.status']));
  return { parts, topics: [topic === 'jobs' ? 'job' : topic === 'schools' ? 'school' : topic === 'health' ? 'health' : 'neighborhood'], ask: null, emotion: c && c.weight >= 0.4 ? 'worried' : null };
}

P.opinion = (S, u) => {
  const v = S.v, parts = [];
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

// Hostile probes, by kind: what the NPC says back.
const PROBE_HOSTILE = { group: 'probe.hostile', status: 'probe.statusHostile', leave: 'probe.leave', hate: 'probe.hate', slur: 'probe.slur' };

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
    parts.push(say(S, PROBE_HOSTILE[pr.kind] || 'probe.hostile') || say(S, 'probe.hostile'));
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
    const rh = G.recordFacts(v).heat;
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

P.smalltalk = (S, u) => {
  const v = S.v, parts = [];
  const q = u.norm;
  if (/what are you (up to|doing)|what'?re you (up to|doing)|where are you (going|headed|off to)|what brings you|what'?s going on/.test(q) && !/weekend|tonight|tomorrow|later|plans/.test(q)) {
    parts.push(activityLine(S));
    return { parts, topics: ['self'], ask: 'howAreYou' };
  }
  if (u.entities.team || /\b(game|team|season|playoffs?|sports?|baseball|basketball|football|soccer|hockey)\b/.test(q)) {
    parts.push(v.team ? say(S, 'small.sports', {}, ['persona.teams']) : say(S, 'small.noSports'));
    return { parts, topics: ['sports'], ask: v.team ? 'team' : null };
  }
  if (/weekend|plans|tonight|tomorrow/.test(q)) {
    const trad = new Set((v.p.interestDetails || []).filter(d => d.tradition).map(d => d.name));
    const fav = v.interests.find(i => !trad.has(i) && !/church|baby|picture books|stuffed/.test(i));
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
  if (letters < 2 || u.flags.unclear || (v.lang.limited && !u.flags.spanish && S.rng.chance(0.6))) {
    parts.push(say(S, u.flags.spanish && v.lang.mode === 'es' ? 'unk.confusedEs' : 'unk.confused'));
    parts.push(pivot(S));
    return { parts, topics: [], ask: null };
  }
  const short = u.norm.split(' ').length <= 6;
  if (!u.question && S.st.prevIntent === 'joke' && (u.appraisal.sentiment >= 0.1 || /\b(ha|haha|lol|lmao|funny|hilarious|good one)\b/.test(u.norm))) return { parts: [say(S, 'joke.thanks')], topics: ['joke'], emotion: 'amused', ask: null };
  if (!u.question && short && u.appraisal.sentiment >= 0.25) { parts.push(say(S, 'react.positive') || say(S, 'unk.statement')); if (S.rng.chance(0.5)) parts.push(pivot(S)); return { parts, topics: [], ask: null }; }
  const fav = favoriteParts(S, u);
  if (fav) return { parts: fav, topics: ['self'], ask: null };
  if (u.question && u.flags.aboutYou) {
    // a question about their own life the engine has no reading for: they deflect and move on; they never claim
    // not to know their own life. A yes-or-no question gets turned back ("Why, do you?").
    const aux = /^(do|does|did|are|is|were|was|have|has|can|could|would|will)\s+you\b/.exec(u.norm);
    const AUX = { does: 'do', is: 'are', was: 'were', has: 'have' };
    parts.push((aux ? say(S, 'unk.aboutMeYesNo', { aux: AUX[aux[1]] || aux[1] }) : null) || say(S, 'unk.aboutMe'));
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
  S.st.cs = u.question ? false : 'surprise';
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
  if (!m) return null;
  S.st.cs = false;
  const v = S.v, kind = m[1].replace(/colour/, 'color').replace(/time of year/, 'season').replace(/tv show/, 'show');
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

/** "Just heading to the grocery store": what they are doing right now. */
export function activityLine(S) {
  const v = S.v, a = v.activity;
  if (!a) return say(S, 'act.home');
  const back = a.traveling && a.place && a.place.kind === 'home';
  const label = String(back ? a.label || '' : (a.place && a.place.label) || a.label || '').replace(/^home from /, '');
  const slots = { placeLabel: label, placeLabelCap: capFirst(label), city: a.place && a.place.city ? a.place.city : (str(label) && /^family in (.+)$/.exec(label) || [])[1] || null };
  const facts = ['schedule.activity'];
  switch (a.kind) {
    case 'commute': return a.leg === 'back' ? say(S, a.place && a.place.kind === 'home' && v.npc.school && v.age < 18 ? 'act.schoolBack' : 'act.commuteBack', slots, facts)
      : say(S, v.npc.school && v.age < 18 ? 'act.schoolOut' : 'act.commuteOut', slots, facts);
    case 'work': return say(S, a.place && a.place.kind === 'home' ? (v.flags.onFarm ? 'act.onFarm' : 'act.wfh') : 'act.work', slots, facts);
    case 'school': return say(S, 'act.school', slots, facts);
    case 'errand': return say(S, back ? 'act.errandBack' : 'act.errand', slots, facts);
    case 'leisure': return say(S, back ? 'act.errandBack' : 'act.leisure', slots, facts);
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
      p = a ? say(S, 'pivot.alert', { alert: a.event }, [`alert:${a.event}`]) : say(S, 'pivot.weather', { temp: v.tempF, sky: G.skyWords(v.wx.now && v.wx.now.short) }, ['weather.now']);
      if (p) st.pivotIntent = 'weather';
    } else if (h.kind === 'concern') {
      const c = (v.p.concerns || []).find(x => (CONCERN_WORDS[x.topic] || [])[0] === h.text || x.area === h.topic);
      const words = c && CONCERN_WORDS[c.topic] ? CONCERN_WORDS[c.topic] : [h.text, null];
      p = say(S, 'pivot.concern', { concern: words[0], concernCap: capFirst(words[0]), concernEs: words[1] }, ['persona.concerns']);
      if (p) st.pivotIntent = { fire: 'fire', insurance: 'insurance', rent: 'rent', housing: 'housing', traffic: 'traffic', weather: 'weather', job: 'job', family: 'family', neighborhood: 'neighborhood' }[h.topic] || null;
    } else if (h.kind === 'interest') {
      const det = (v.p.interestDetails || []).find(d => d.name === h.text);
      const talk = det && det.tradition ? null : interestTalk(h.text);
      if (talk) {
        const es = S.rng.pick(talk.es);
        p = say(S, 'pivot.interest', { interestShort: talk.short, interestShortCap: capFirst(talk.short), interestEs: es[0], interestEn: es[1] }, ['persona.interests']);
      }
      if (p) st.pivotIntent = 'about-them';
    } else if (h.kind === 'memory') {
      const m = (v.p.memories || []).find(x => (x.title || x.text) === h.text);
      if (m) { p = say(S, 'pivot.memory', { memTitle: memTitleOf(m), memEs: memoryEs(m) }, [memoryFact(m)]); if (p) st.usedMemories.add(m.source); }
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
    case 'name': return S.st.gaveName ? [] : [say(S, 'name.give')];
    default: return [];
  }
}

const TURNED_BACK = /\b(?:and|how about|what about) (?:you|yourself|u)\b[?.!]*$|^(?:you|and you|u)\?*$/;

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
  if (u.intent === 'insult' || u.intent === 'probe' || u.intent === 'goodbye' || u.flags.more) return null;
  const words = u.norm.split(' ').length;
  const parts = [];
  const learn = (k, value, text) => S.learn(k, value, text);
  if (key === 'name') {
    const f = u.appraisal.facts.find(x => x.key === 'name');
    const bare = /^([A-Z][a-z'-]{1,20})[.!]?$/.exec(u.text.trim());
    const nm = f ? String(f.value).split(/\s+/)[0] : bare && !/^(Yes|No|Yeah|Nope|Sure|Hi|Hey|Hello|Thanks|Okay|Ok)$/i.test(bare[1]) ? bare[1] : null;
    if (!nm) return null;
    if (screenValue(f ? f.value : nm, 'name')) { parts.push(say(S, 'name.rude')); st.cs = false; return { parts, topics: [], intent: 'name', ask: null, emotion: 'annoyed' }; }
    if (!f) learn('name', nm, `Their name is ${nm}.`);
    parts.push(say(S, 'react.name', { player: nm }));
    return { parts, topics: ['self'], intent: 'name', learnedName: nm, ask: null };
  }
  if (key === 'from' || key === 'lives') {
    const pl = u.entities.places.find(p => p.kind === 'town' || p.kind === 'county');
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
    if (words <= 4 && !u.question && /^[A-Z][A-Za-z'-]*(\s+[A-Z][A-Za-z'-]*)*[.!]?$/.test(u.text.trim()) && !/^(Yes|No|Yeah|Nope|Sure|Okay|Ok|Thanks|Hi|Hey|Hello|Tell|What|Why|How|Where|Who)\b/.test(u.text.trim())) {
      const place = u.text.trim().replace(/[.!]$/, '');
      if (screenValue(place, 'from')) { parts.push(say(S, 'react.notBuying')); st.cs = false; return { parts, topics: [], intent: 'smalltalk', ask: null, emotion: 'annoyed' }; }
      learn('from', place, `They are from ${place}.`);
      parts.push(say(S, 'react.from.unknown'));
      return { parts, topics: ['neighborhood'], intent: 'smalltalk', ask: null };
    }
    const told = u.appraisal.facts.find(x => x.key === 'from' || x.key === 'lives');
    if (told && screenValue(told.value, told.key)) { parts.push(say(S, 'react.notBuying')); st.cs = false; return { parts, topics: [], intent: 'smalltalk', ask: null, emotion: 'annoyed' }; }
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

const ASK_KEYS = { howAreYou: 'ask.howAreYou', name: 'ask.name', from: 'ask.from', lives: 'ask.lives', job: 'ask.job', kids: 'ask.kids', visiting: 'ask.visiting', weather: 'ask.weather', drive: 'ask.drive', food: 'ask.food', team: 'ask.team', fire: 'ask.fire', weekend: 'ask.weekend', housing: 'ask.housing', school: 'ask.school' };

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

/** Now and then a sentence opens with one of the speaker's fillers ("Honestly, it's ..."). */
function fillerUp(S, parts, intent) {
  const v = S.v, rng = S.rng;
  if (['greeting', 'goodbye', 'thanks', 'insult', 'name', 'joke', 'probe'].includes(intent)) return parts;
  // one discourse word per reply: an opener ("Well, let's see.") already took the slot
  if (parts.some(p => p && /^(well|oh|hmm|good question|so|honestly|you know|anyway|look|let me|let's see|don't get me started|that's a big one)\b/i.test(p.text))) return parts;
  if (!rng.chance(0.06 + 0.22 * v.verb + (v.reg === 'casual' ? 0.06 : 0))) return parts;
  const own = v.fillers.filter(f => FILLER_STARTS.test(f));
  const local = v.reg === 'formal' ? [] : (linesForSafe(v, 'fillers').filter(f => FILLER_STARTS.test(f) && (!YOUNG_FILLERS.test(f) || v.age < 35)));
  const pool = own.length && rng.chance(0.7) ? own : local.length ? local : own;
  const f = rng.pick(pool);
  if (!f) return parts;
  const later = /^(anyway|anyhow|mind you|so yeah|to be fair|actually|the thing is)$/i.test(f);
  // never on a sentence that already opens with a discourse word ("You know, you know what's been on my mind?")
  const i = parts.findIndex((p, k) => p && (!later || k > 0) && !/\?$/.test(p.text) && startsCommon(p.text) && !/^(oh|well|so|hmm|good question|you know|honestly|anyway|actually|look|basically|i mean|like|to be fair|the thing is)\b/i.test(p.text) && !/^(no|yes|yeah|nope|yep|nah)[,.!]/i.test(p.text));
  if (i < 0) return parts;
  const p = parts[i];
  const word = f[0].toUpperCase() + f.slice(1);
  const out = parts.slice();
  out[i] = Object.assign({}, p, { text: `${word}, ${G.lowerFirst(p.text)}`, gloss: p.gloss ? `${word}, ${G.lowerFirst(p.gloss)}` : null });
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
  return parts.map(p => (p && /^(op\.|house\.opinion|rent\.feel)/.test(p.key || '') && startsCommon(p.text) && !/^I /.test(p.text) ? Object.assign({}, p, { text: `I think ${G.lowerFirst(p.text)}` }) : p));
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

/**
 * Style a plan into one line: sentence budget, opener, the player's name, a mood aside, a follow-up question and
 * code-switching. Returns {text, gloss, facts, ask} (ask: the pending question key, or null).
 */
export function compose(S, intent, plan, u) {
  const v = S.v, st = S.st, rng = S.rng;
  let parts = plan.parts.filter(p => p && p.text);
  const budget = budgetOf(v, intent, plan);
  const all0 = parts;
  parts = parts.slice(0, budget);
  // the last conversation, mentioned in a greeting that the sentence budget then cut: it has not been mentioned
  if (all0.some(p => p.key === 'greet.prev') && !parts.some(p => p.key === 'greet.prev')) st.mentionedPrev = false;
  // the player's name, now and then, at the end of the first sentence
  if (v.relq.name && parts.length && !['insult', 'probe'].includes(intent) && (st.nameUses === 0 ? rng.chance(0.5) : rng.chance(0.1)) && !parts[0].text.includes(v.relq.name)) {
    const p = parts[0];
    const add = s => s.replace(/([.!?]+)?$/, (m0, pun) => `, ${v.relq.name}${pun || '.'}`);
    if (!/[,:;]$/.test(p.text) && p.text.split(/[.!?]/).filter(Boolean).length === 1) { parts[0] = Object.assign({}, p, { text: add(p.text), gloss: p.gloss ? add(p.gloss) : null }); st.nameUses += 1; }
  }
  // an opener before an answer to a question
  if (u && u.question && parts.length && !plan.noOpener && !/^(?:(?:ha|oh|no|nope|yes|yeah|yep|not|well|hmm|um|i am|sure|just)\b|kids\?)/i.test(parts[0].text) && rng.chance(0.22) && v.age >= 13 && !plan.noAsk && !(v.age < 18 && HEAVY.has(intent)) && !['goodbye', 'greeting', 'thanks', 'insult', 'name', 'smalltalk', 'unknown', 'how-are-you', 'compliment', 'joke', 'apology'].includes(intent)) {
    const light = /none|nothingMore|beforeMe|noOffshore|\.low$|\.calm$/.test(parts[0].key || '');
    const o = say(S, HEAVY.has(intent) && !light ? 'open.heavy' : 'open.question');
    if (o) {
      if (/,$/.test(o.text)) {
        if (startsCommon(parts[0].text)) parts[0] = Object.assign({}, parts[0], { text: `${o.text} ${G.lowerFirst(parts[0].text)}`, gloss: parts[0].gloss ? `${o.gloss || o.text} ${G.lowerFirst(parts[0].gloss)}` : null });
      } else parts.unshift(o);
    }
  }
  // a mood aside, once in a while and once per conversation
  if (!st.moodSaid && v.age >= 13 && !['insult', 'probe', 'goodbye', 'thanks'].includes(intent) && rng.chance(0.18)) {
    const m = v.mood;
    const key = m.tired ? 'mood.tired' : v.alerts.length && m.tense ? 'mood.alert' : isNum(v.tempF) && v.tempF >= 95 && m.valence < 0.1 ? 'mood.hot' : m.valence >= 0.45 ? 'mood.happy' : m.valence <= -0.35 ? 'mood.down' : null;
    const p = key ? say(S, key, { alert: v.alerts[0] && v.alerts[0].event, temp: v.tempF }) : null;
    if (p) { parts.push(p); st.moodSaid = true; }
  }
  if (!parts.length) { const p = pivot(S) || say(S, 'unk.statement'); if (p) parts.push(p); }
  // a question back
  let ask = null;
  if (!plan.noAsk && plan.ask !== null && st.turn < 60) {
    const known = new Set(v.relq.facts.map(f => f.key));
    const early = st.turn <= 6 ? ['from', 'job', 'name', 'visiting'] : [];
    const cands = [plan.ask, ...early].filter(Boolean)
      .filter(k => ASK_KEYS[k] && !st.asked.has(k) && !(ANSWERED_BY[k] && known.has(ANSWERED_BY[k])) && !(k === 'name' && v.relq.name) && !(k === 'team' && !v.team));
    const rate = Math.min(0.85, askRate(v) + num(plan.askBoost, 0) - (st.lastAsked ? 0.2 : 0));
    if (cands.length && rng.chance(rate)) {
      const k = cands[0];
      const q = say(S, ASK_KEYS[k], { placeName: v.z.city });
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
  // st.cs: the planner's choice of phrase meaning; false means the answer is no occasion for one
  const csIntent = st.cs === false ? null : st.cs || CS_INTENT[intent] || null;
  st.cs = null;
  const fits = CS_FITS[intent] || null;
  if (v.lang.mode === 'simple' && csIntent && rng.chance(0.85)) pre = homePhrase(S, csIntent, fits);
  else if (v.lang.mode === 'en' && v.lang.cs && csIntent && rng.chance(Math.min(0.85, v.lang.cs.rate * 1.2))) {
    const ph = homePhrase(S, csIntent, fits);
    if (ph) { if (intent === 'goodbye') post = ph; else pre = ph; }
  }
  if (pre && intent === 'greeting' && parts.length > 1 && /^(greet\.(first|again|repeat)|lex:greetings)$/.test(parts[0].key || '')) parts = parts.slice(1);
  const all = [pre, ...parts, post].filter(Boolean);
  const text = tidy(all.map(p => terminate(p.text)).join(' '));
  const foreign = all.some(p => p.gloss);
  const gloss = foreign ? tidy(all.map(p => terminate(p.gloss || p.text)).join(' ')) : null;
  const facts = [...new Set(all.flatMap(p => p.facts || []).filter(Boolean))];
  return { text, gloss, facts, ask, keys: all.map(p => p.key).filter(Boolean) };
}

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

