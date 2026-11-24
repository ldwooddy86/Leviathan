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

import { pickLine, phrasesFor, familyTerm, templateSlots, linesFor, slangFor, LANGUAGES } from '../lexicon.mjs';
import { pacific } from '../clock.mjs';
import { hashStr } from '../rng.mjs';
import { PEOPLE } from './en-people.mjs';
import { PLACE } from './en-place.mjs';
import { SPANISH } from './es.mjs';
import {
  isNum, num, str, capFirst, withArticle, listJoin, numWord, fillLine, tagsHold, cleanText, fitsLife, terminate, tidy,
  cleanGloss, fullDate, monthYear, partOfMonth, mesAno, parseDate, MONTHS, MESES, approx, compass,
} from './core.mjs';
import * as G from './ground.mjs';
import { employerPhrase, teamLabel } from './voice.mjs';
import {
  interestTalk, CONCERN_WORDS, jobSpanish, feelKey, SCHOOL_WORDS, DIR_ES, LANG_ES, shareVerbEs, cieloEs, cuandoEs, mesEs, millasEs, approxEs,
} from './life.mjs';

/** Every English template bank by key (people and place). */
export const EN = Object.freeze(Object.assign({}, PEOPLE, PLACE));
export { SPANISH };

const HEAVY = new Set(['fire', 'storm', 'earthquake', 'insurance']);

// ------------------------------------------------------------------ the realizer

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
      if (!a || !cleanText(a.text) || !fitsLife(a.gloss, v)) return null;
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
  for (let i = 0; i < 4; i++) {
    const hit = pickLine(v.key, category, S.rng, opts);
    if (!hit) return null;
    if (!cleanText(hit.text) || !fitsLife(hit.text, v) || S.st.said.has(hit.text)) continue;
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
  const list = (phrasesFor(lang, intent, opts) || []).filter(e => !e.to && !AUDIENCE_NOTE.test(e.gloss)
    && (v.lang.faith || !/\bGod\b|\bbless/i.test(e.gloss))
    && (lang !== 'spanish' || (v.lang.usted ? !TU_FORMS.test(e.text) : !USTED_FORMS.test(e.text)))
    && (!fits || fits.test(e.gloss)));
  if (!list.length) return null;
  const e = S.picker.pick(`cs:${lang}:${intent}`, list, S.rng);
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
  if (st.greeted && !opts.initiated) {
    parts.push(say(S, 'unk.statement') || null);
    parts.push(pivot(S));
    return { parts, topics: [], noAsk: false };
  }
  st.greeted = true;
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
  S.st.cs = m.tired ? 'tired' : (v.speaker.works && !v.weekend && v.hour >= 9 && v.hour < 17 ? 'busy' : null);
  return { parts, topics: ['self'], ask: 'howAreYou', askBoost: 0.35 };
};

function worksToday(v) {
  const days = num(v.commute.days, 0);
  return !!(days & (1 << v.P.dow));
}

P.name = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  const given = u.appraisal.facts.find(f => f.key === 'name');
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

/** Where they're from, in their own words. */
function originParts(S) {
  const v = S.v, res = v.res || {}, npc = v.npc, out = [];
  const facts = [REC.origin, REC.residence];
  const birthplace = str(npc.birthplace);
  if (res.bornHere) out.push(say(S, 'about.bornHere', {}, facts));
  else if (res.grewUpHere) out.push(say(S, 'about.grewUpCounty', {}, facts));
  else if (npc.nativity === 'foreign' && birthplace) {
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

P['about-them'] = (S, u) => {
  const v = S.v, parts = [];
  const q = u.norm;
  let ask = 'from';
  if (/how old|your age/.test(q)) {
    parts.push(say(S, 'about.age', {}, ['npc.age']));
    ask = 'job';
  } else if (/where are you from|grow up|grew up|born|originally|come from|from here|from around here|from california/.test(q)) {
    parts.push(...originParts(S));
    ask = 'from';
  } else if (u.entities.interest && /\bdo you\b|\bare you\b/.test(q)) {
    const key = u.entities.interest;
    const has = v.interests.find(i => i.toLowerCase().includes(key) || (key === 'skiing' && /ski/.test(i)) || (key === 'gaming' && /game|gaming/.test(i)) || (key === 'cars' && /car/.test(i)) || (key === 'church' && /church/.test(i)) || (key === 'biking' && /bik/.test(i)) || (key === 'music' && /music|concert/.test(i)));
    if (has) {
      parts.push(say(S, 'about.doYes'));
      const talk = interestTalk(has);
      if (talk) { const es = S.rng.pick(talk.es); parts.push(say(S, 'about.interestsIntro', { interestLine: S.rng.pick(talk.en), doingThing: talk.doing, interestEs: es[0], interestEn: es[1] }, ['persona.interests'])); S.st.usedInterests.add(has); }
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
  } else if (/hobb|for fun|free time|spare time|into|like to do|enjoy|weekend/.test(q)) {
    parts.push(...interestParts(S, 2));
    if (v.team && S.rng.chance(0.5)) parts.push(say(S, 'about.team', {}, ['persona.teams']));
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

P.job = (S, u, opts = {}) => {
  const v = S.v, npc = v.npc, occ = v.occ, parts = [];
  const facts = [REC.job];
  const school = npc.school;
  if (v.stage === 'toddler' || school === 'preschool') { parts.push(say(S, 'job.preschool')); return { parts, topics: ['school'] }; }
  if (v.age < 18 && school && school !== 'college') {
    const w = SCHOOL_WORDS[school] || SCHOOL_WORDS.elementary;
    if (u && u.flags && u.flags.likeIt) return { parts: [say(S, v.age < 13 ? 'job.kidFeel' : 'job.teenFeel')], topics: ['school'], ask: null };
    parts.push(say(S, 'job.k12', { school: w[0], schoolEs: w[1] }, ['npc.school']));
    if (!opts.brief) parts.push(say(S, v.age < 13 ? 'job.kidFeel' : 'job.teenFeel'));
    if (occ && occ.title && v.age >= 14) parts.push(say(S, 'job.studentWorks', { aJob: withArticle(occ.title) }, facts));
    return { parts, topics: ['school'], ask: v.age >= 13 ? 'school' : null };
  }
  if (school === 'college' || school === 'grad' || (npc.status === 'student' && v.age >= 18)) {
    if (u && u.flags && u.flags.likeIt) return { parts: [say(S, 'job.collegeFeel')], topics: ['school'], ask: 'job' };
    parts.push(say(S, school === 'grad' ? 'job.grad' : 'job.college', {}, ['npc.school']));
    if (occ && occ.title) parts.push(say(S, 'job.studentWorks', { aJob: withArticle(occ.title) }, facts));
    return { parts, topics: ['school'], ask: 'job' };
  }
  if (npc.status === 'retired') {
    parts.push(say(S, 'job.retired', { retireYear: lifeYear(v, 'npc.status') }, ['npc.status']));
    if (!opts.brief) parts.push(...interestParts(S, 1));
    return { parts, topics: ['job'], ask: 'job' };
  }
  if (npc.status === 'unemployed') { parts.push(say(S, 'job.unemployed', {}, ['npc.status'])); return { parts, topics: ['job'], ask: 'job', emotion: 'down' }; }
  if (npc.status === 'military' && !(occ && occ.title)) { parts.push(say(S, 'job.military', {}, ['npc.status'])); return { parts, topics: ['job'], ask: 'job' }; }
  if (!occ || !occ.title) {
    if (v.flags.kids && v.age >= 18) parts.push(say(S, 'job.homemaker', {}, ['npc.status']));
    else parts.push(say(S, 'job.notWorking', {}, ['npc.status']));
    return { parts, topics: ['job'], ask: 'job' };
  }
  const title = String(occ.title).trim();
  // "a preschool teacher at a preschool": an employer that only repeats the title adds nothing
  const titleWords = new Set(title.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 4));
  const empWords = String(occ.employer || '').toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 5);
  const emp = empWords.some(w => titleWords.has(w) || titleWords.has(w.replace(/s$/, ''))) ? null : employerPhrase(occ.employer);
  const workCity = v.commute.workCity && v.commute.workCity !== v.z.city ? v.commute.workCity : null;
  const where = emp ? ` ${emp}` : workCity && v.commute.mode !== 'wfh' ? ` in ${workCity}` : '';
  const [jobEs, jobEn] = jobSpanish(v.occKey, title, v.sex);
  if (((S.st.depth.job || 0) > 0 || (u && u.flags && u.flags.likeIt)) && !opts.brief) {
    const more = [say(S, feelKey(v.occKey)) || say(S, 'job.feel.any')];
    if (workCity && num(v.commute.minutes) >= 20 && !v.flags.wfh) more.push(say(S, 'job.commute', { workCity, commuteMin: v.commute.minutes }, [REC.commute]));
    if (v.flags.nights) more.push(say(S, 'job.nights', {}, facts)); else if (v.flags.early) more.push(say(S, 'job.early', {}, [REC.commute]));
    if (more.filter(Boolean).length) return { parts: more, topics: ['job'], ask: 'job' };
  }
  parts.push(say(S, 'job.title', { aJob: withArticle(title), job: title, where, employer: occ.employer ? String(occ.employer).replace(/^their /, 'my ') : null, workCity, jobEs, jobEn }, facts));
  if (opts.brief) return { parts, topics: ['job'] };
  const extra = [];
  if (v.flags.wfh) extra.push(say(S, 'job.wfh', {}, [REC.commute]));
  else if (v.flags.nights) extra.push(say(S, 'job.nights', {}, facts));
  else if (v.flags.early) extra.push(say(S, 'job.early', {}, [REC.commute]));
  const started = lifeYear(v, 'npc.occupation');
  if (isNum(started)) {
    const years = v.P.year - started;
    extra.push(years <= 0 ? say(S, 'job.new', { jobYear: started }, facts) : say(S, 'job.since', { jobYear: started, jobYears: years >= 2 ? years : null }, facts));
  }
  extra.push(say(S, feelKey(v.occKey)) || say(S, 'job.feel.any'));
  if (workCity && num(v.commute.minutes) >= 20 && !v.flags.wfh) extra.push(say(S, 'job.commute', { workCity, commuteMin: v.commute.minutes }, [REC.commute]));
  for (const x of S.rng.shuffle(extra.filter(Boolean))) parts.push(x);
  return { parts, topics: ['job'], ask: 'job' };
};

P.family = (S, u) => {
  const v = S.v, R = v.rel, parts = [];
  const facts = [REC.home];
  const stranger = !v.relq.known;
  if (v.relq.guarded || (stranger && v.big5.E < 0.3 && v.big5.A < 0.4 && S.rng.chance(0.6))) {
    parts.push(say(S, 'fam.guarded'));
    return { parts, topics: ['family'], noAsk: true };
  }
  const pw = parentsWords(S);
  const sib = siblingWords(R.siblings);
  if (/\b(brothers?|sisters?|siblings?)\b/.test(u ? u.norm : '')) {
    if (sib) parts.push(say(S, 'fam.siblings', { sibWords: sib.en, sibEs: sib.es }, facts));
    else parts.push(say(S, 'fam.noSiblings', {}, facts));
  }
  if (v.age < 18) {
    if (/\b(do you have|have any|got any) (kids|children)\b|\bare you married\b/.test(u ? u.norm : '')) parts.push(say(S, 'fam.kidSelfNo'));
    if (pw) {
      const term = pw.rel ? homeWord(S, pw.rel, pw.en) : null;
      parts.push(say(S, 'fam.parents', { parentsWord: term || pw.en, parentsEs: pw.es }, facts));
    } else if (R.grandparents.length) parts.push(say(S, 'fam.grandparents', gpSlots(S, R.grandparents), facts));
    if (sib) parts.push(say(S, 'fam.siblings', { sibWords: sib.en, sibEs: sib.es }, facts));
    return { parts, topics: ['family'], ask: v.age >= 13 ? 'kids' : null };
  }
  if (R.partner) {
    const p = R.partner;
    const partnerWord = p.role === 'partner' || v.npc.role === 'partner' ? 'partner' : p.sex === 'F' ? 'wife' : 'husband';
    const partnerEs = partnerWord === 'partner' ? 'pareja' : p.sex === 'F' ? 'esposa' : 'esposo';
    parts.push(say(S, 'fam.partner', { partnerWord, partnerEs, partnerName: p.name }, facts));
    const wed = (v.p.memories || []).find(m => m.kind === 'life' && /got married in (\d{4})/.test(m.text || ''));
    if (wed && S.rng.chance(0.6)) parts.push(say(S, 'fam.married', { partnerName: p.name, weddingYear: wed.year }, ['npc.household']));
  }
  const kids = R.kids.slice().sort((a, b) => num(a.age) - num(b.age));
  if (!kids.length && /\bkids?\b|\bchildren\b/.test(u ? u.norm : '')) parts.unshift(say(S, R.grandkids.length ? 'fam.noKidsHome' : 'fam.noKids', {}, facts));
  if (kids.length === 1) {
    const k = kids[0];
    parts.push(say(S, 'fam.kidOne', {
      kidWord: k.sex === 'F' ? 'daughter' : 'son', kidName: k.name, kidAge: k.age, kidPronoun: k.sex === 'F' ? 'She' : 'He',
      unKidEs: k.sex === 'F' ? 'una hija' : 'un hijo',
    }, facts));
  } else if (kids.length > 1) {
    const names = kids.map(k => k.name).filter(Boolean);
    parts.push(say(S, 'fam.kidsMany', {
      kidCount: numWord(kids.length), kidNames: names.length === kids.length ? listJoin(names) : null,
      kidCountEs: ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho'][kids.length] || String(kids.length),
      hijosEs: kids.every(k => k.sex === 'F') ? 'hijas' : 'hijos',
    }, facts));
  }
  if (kids.length) {
    const young = num(kids[0].age, 10), old = num(kids[kids.length - 1].age, 10);
    const band = young < 2 ? 'baby' : old >= 18 ? 'grown' : young >= 13 ? 'teens' : 'small';
    parts.push(say(S, `fam.kidsFeel.${band}`));
  }
  if (R.grandkids.length) parts.push(say(S, 'fam.grandkids', {}, facts));
  if (!R.partner && !kids.length) {
    if (pw) {
      const term = pw.rel ? homeWord(S, pw.rel, pw.en) : null;
      parts.push(say(S, 'fam.parentsAdult', { parentsWord: term || pw.en, parentsEs: pw.es }, facts));
      if (sib) parts.push(say(S, 'fam.siblings', { sibWords: sib.en, sibEs: sib.es }, facts));
    } else if (v.flags.alone) parts.push(say(S, v.flags.widowed ? 'fam.widowed' : 'fam.alone', { lostWord: v.sex === 'F' ? 'husband' : 'wife' }, facts));
    else if (R.roommates.length) parts.push(say(S, 'fam.roommates', { roomCount: numWord(R.roommates.length) }, facts));
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
  if (/how long/.test(q)) {
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
  if (head && S.rng.chance(0.5)) parts.push(say(S, 'home.since', {}, facts));
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

P.weather = (S, u) => {
  const v = S.v, W = G.weatherFacts(v), parts = [];
  const q = u.norm;
  const nowFacts = [W.ids.now];
  if (W.stale) parts.push(say(S, 'wx.stale', { temp: W.temp }, nowFacts));
  else {
    const ce = cieloEs(W.short);
    parts.push(say(S, W.sky ? 'wx.now' : 'wx.nowPlain', { temp: W.temp, sky: W.sky, cieloEs: ce[0] }, nowFacts) || say(S, 'wx.nowPlain', { temp: W.temp }, nowFacts));
  }
  const ahead = /tomorrow|tonight|weekend|forecast|later|will it|going to|this week|thanksgiving/.test(q);
  const fc = [];
  const night = W.periods.find(p => !p.isDay && p.when === 'tonight');
  const day = W.periods.find(p => p.isDay && p.when !== 'later today');
  if (night && isNum(night.temp)) fc.push(say(S, 'wx.tonight', { low: night.temp, nextSky: night.sky }, [W.ids.next]));
  if (day && isNum(day.temp) && day.sky) {
    const ce = cieloEs(day.sky.replace(/^a (slight )?chance of /, 'chance '));
    fc.push(say(S, 'wx.next', { when: day.when, whenCap: capFirst(day.when), nextSky: day.sky, high: day.temp, nextCieloEs: ce[1], cuandoEs: capFirst(cuandoEs(day.when)) }, [W.ids.next]));
  }
  const wet = W.periods.find(p => isNum(p.pop) && p.pop >= 30);
  if (wet) fc.push(say(S, 'wx.rainChance', { pop: wet.pop, when: wet.when, cuandoEs: cuandoEs(wet.when) }, [W.ids.next]));
  if (W.key && S.rng.chance(ahead ? 0.7 : 0.35)) fc.push(say(S, 'wx.keyMsg', { keyMsg: G.lowerFirst(W.key), keyMsgCap: W.key }, [W.ids.key]));
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
  const again = (S.st.depth.weather || 0) > 0 && !/today|now|right now|outside/.test(q);
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
    parts.push(say(S, 'tr.wfh', rd(mainRoad), [mainRoad.id, REC.commute]));
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
    } else if (mode === 'bike') parts.push(say(S, 'tr.bike', { commuteMin: min }, [REC.commute]));
    else if (mode === 'walk') parts.push(say(S, 'tr.walk', { commuteMin: min }, [REC.commute]));
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
  const unused = fires.filter(f => !st.used.has(f.id));
  const f = named || (depth === 0 ? G.mainFire(v, fires) : null) || unused.find(x => x.memory) || unused[0] || null;
  if (f) {
    st.used.add(f.id);
    const slots = fireSlots(f);
    const ageThen = f.year - (v.npc.birthYear || (v.P.year - v.age));
    const here = f.destInZip > 0 || f.pct > 0 || f.km <= 1;
    const childMemory = f.memory && ageThen < 18;
    if (childMemory && !(f.memory.experience && v.lang.mode === 'en')) parts.push(say(S, ageThen < 10 ? 'fire.livedChild' : 'fire.livedTeen', Object.assign({ ageThen }, slots), [f.id]));
    else if (childMemory) parts.push(say(S, 'fire.remember', slots, [f.id]));
    else if (f.memory && f.lived && here) parts.push(say(S, 'fire.lived', slots, [f.id]));
    else if (f.memory || !f.before) parts.push(say(S, 'fire.remember', slots, [f.id]));
    else parts.push(say(S, 'fire.before', slots, [f.id]));
    if (f.memory && f.memory.experience && v.lang.mode === 'en') parts.push({ text: f.memory.experience, gloss: null, facts: ['persona.memory'], key: 'memory' });
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
    const w = G.windFacts(v).find(x => !st.used.has(x.id) && isNum(x.gust));
    if (w) { parts.push(say(S, 'storm.wind', { windName: w.name.replace(/^the /, ''), when: monthYear(w.dt), gust: w.gust }, [w.id])); st.used.add(w.id); }
    if (rec.gust && !st.used.has(rec.gust.id)) { parts.push(say(S, 'storm.gustRecord', { gust: rec.gust.value, when: monthYear(rec.gust.dt) }, [rec.gust.id])); st.used.add(rec.gust.id); }
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
  if (isNum(W.temp) && (W.temp >= 85 || /today|right now|now/.test(u.norm))) parts.push(say(S, 'heat.now', { temp: W.temp }, [W.ids.now]));
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
  if (v.age < 18) { parts.push(say(S, 'house.minor', { parentsWord: pw ? pw.en : 'parents', parentsEs: pw ? pw.es : 'mis papás' })); return { parts, topics: ['housing'], noAsk: true }; }
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
    parts.push(value);
  }
  if (census.own) {
    if (census.own.share < 0.4 && S.rng.chance(0.6)) parts.push(say(S, 'house.renters', {}, [census.own.id]));
    else if (census.own.share >= 0.7 && S.rng.chance(0.5)) parts.push(say(S, 'house.owners', {}, [census.own.id]));
  }
  if (u.flags.opinion || S.rng.chance(0.45)) parts.push(say(S, 'house.opinion'));
  S.st.cs = 'its_expensive';
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
  if (v.age < 18) { parts.push(say(S, 'ins.minor', { parentWord: pw ? pw.en : 'parents', parentEs: 'papás' })); return { parts, topics: ['insurance'], noAsk: true }; }
  const fair = I.fair && I.fair.per100 >= 5 ? I.fair : null;
  const nonren = I.nonren && I.nonren.pct >= 8 ? I.nonren : null;
  if (!(head && v.hh.tenure === 'own')) {
    parts.push(head || v.npc.role === 'roommate' ? say(S, 'ins.renter', {}, [REC.home]) : say(S, 'ins.notMine', {}, [REC.home]));
    if (fair) parts.push(say(S, 'ins.fair', fairSlots(fair), [fair.id]));
    return { parts, topics: ['insurance'], ask: 'housing' };
  }
  if (!fair && !nonren) {
    parts.push(say(S, 'ins.low', {}, [I.fair && I.fair.id, I.nonren && I.nonren.id].filter(Boolean)));
    if (I.prem) parts.push(say(S, 'ins.prem', { prem: I.prem.words }, [I.prem.id]));
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
  } else parts.push(say(S, 'quake.none', {}, ['fema.county']));
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
  if (F.water) cands.push(() => say(S, 'place.water', { water: F.water.label, miles: G.miles(F.water.distKm) }, [`landmark:${F.water.name}`]));
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
    target = { x: place.x, y: place.y }; label = place.kind === 'landmark' ? (G.lowerFirst(place.name) === place.name ? place.name : place.name) : place.name;
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
  if (R.road) parts.push(say(S, 'dir.road', slots, [R.roadId]));
  if (R.km >= 3 && S.rng.chance(0.4)) parts.push(say(S, 'dir.map'));
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
    if (ev) parts.push(say(S, 'hist.yearHit', { year, event: ev.en, eventEs: ev.es }, [ev.id]));
    else parts.push(say(S, 'hist.yearMiss', { year }, ['fires.zip', 'ars.coast', 'fema.county']));
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
    parts.push(say(S, 'hist.event', { memTitle: m.title, memTitleCap: capFirst(m.title), exp: m.experience || null, memEs: memoryEs(m) }, [id, 'persona.memory'])
      || say(S, 'hist.event', { memTitle: m.title, memTitleCap: capFirst(m.title), exp: '', memEs: memoryEs(m) }, [id]));
  } else {
    const life = (v.p.memories || []).filter(x => x.kind === 'life' && !st.usedMemories.has(x.source + x.year));
    if (life[0] && v.lang.mode === 'en') { st.usedMemories.add(life[0].source + life[0].year); parts.push(say(S, 'hist.life', { lifeLine: life[0].text }, [memoryFact(life[0])])); }
    else { parts.push(say(S, 'hist.more')); parts.push(pivot(S)); }
  }
  if (v.flags.longtime && !res.bornHere && S.rng.chance(0.3)) parts.push(say(S, 'hist.change', {}, [REC.residence]));
  return { parts, topics: ['history'], ask: 'from', emotion: 'wistful', keep: 2 };
};

function eventsOfYear(v, year) {
  for (const f of G.fireFacts(v)) if (f.year === year) return { en: f.label, es: fireEs(f.name), id: f.id };
  for (const a of G.arFacts(v)) if (a.dt.y === year) return { en: `the atmospheric river in ${monthYear(a.dt)}`, es: `río atmosférico de ${mesAno(a.dt)}`, id: a.id };
  for (const f of [...G.femaFacts(v).storms, ...G.femaFacts(v).quakes]) if (f.dt.y === year && f.title) return { en: `the ${G.femaTitle(f.title)}`, es: f.kind === 'Earthquake' ? 'terremoto' : 'temporal de ese año', id: f.id };
  const rec = G.recordFacts(v);
  for (const k of ['heat', 'rain', 'gust']) if (rec[k] && rec[k].dt.y === year) return { en: k === 'heat' ? `the record heat, ${rec[k].value} degrees` : k === 'rain' ? `the record rain, ${rec[k].value} inches in a day` : `the record wind, ${rec[k].value} miles an hour`, es: k === 'heat' ? 'calor récord' : k === 'rain' ? 'aguacero récord' : 'viento récord', id: rec[k].id };
  return null;
}

P.opinion = (S, u) => {
  const v = S.v, parts = [];
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

P.insult = (S, u) => {
  const v = S.v, st = S.st, parts = [];
  st.insults += 1;
  const tox = u.appraisal.toxicity;
  if (st.ended) { parts.push(say(S, 'insult.after') || say(S, 'insult.end')); return { parts, topics: [], noAsk: true, emotion: 'angry' }; }
  if (/\b(f+u+c+k|shit|bitch|ass(hole)?|damn|crap|dick|bastard)\w*/i.test(u.text) && S.rng.chance(0.5)) parts.push(say(S, 'insult.language'));
  const feelings = v.relq.feelings;
  if (st.insults >= 2 || tox >= 0.8) { parts.push(say(S, 'insult.end')); st.ended = true; return { parts, topics: [], noAsk: true, emotion: feelings === 'hurt' ? 'hurt' : 'angry' }; }
  if (v.humor >= 0.6 && v.big5.A >= 0.55 && tox < 0.5 && S.rng.chance(0.4)) parts.push(say(S, 'insult.shrug'));
  else parts.push(say(S, feelings === 'hurt' || v.big5.A >= 0.55 ? 'insult.hurt' : 'insult.annoyed'));
  return { parts, topics: [], noAsk: true, emotion: feelings === 'hurt' || v.big5.A >= 0.55 ? 'hurt' : 'annoyed' };
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
  if (v.flags.hotPlace) opts.push(['joke.local.heat', { temp: Math.max(100, Math.round(num(v.z.tjul, 95))) }, ['clim.tjul']]);
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
  if (letters < 2 || u.flags.unclear || (v.lang.mode !== 'en' && S.rng.chance(0.6))) {
    parts.push(say(S, 'unk.confused'));
    parts.push(pivot(S));
    return { parts, topics: [], ask: null };
  }
  const short = u.norm.split(' ').length <= 6;
  if (!u.question && S.st.prevIntent === 'joke' && (u.appraisal.sentiment >= 0.1 || /\b(ha|haha|lol|lmao|funny|hilarious|good one)\b/.test(u.norm))) return { parts: [say(S, 'joke.thanks')], topics: ['joke'], emotion: 'amused', ask: null };
  if (!u.question && short && u.appraisal.sentiment >= 0.25) { parts.push(say(S, 'react.positive') || say(S, 'unk.statement')); if (S.rng.chance(0.5)) parts.push(pivot(S)); return { parts, topics: [], ask: null }; }
  if (u.question) parts.push(say(S, 'unk.question'));
  else if (u.appraisal.sentiment <= -0.25) parts.push(say(S, 'hay.answerBad'));
  else if (u.appraisal.sentiment >= 0.3 && v.lang.mode === 'en' && S.rng.chance(0.5)) parts.push(lex(S, 'agreement') || say(S, 'unk.statement'));
  else parts.push((v.lang.mode === 'en' && S.rng.chance(0.3) ? lex(S, 'surprise') : null) || say(S, 'unk.statement'));
  if (S.rng.chance(0.75)) parts.push(pivot(S));
  S.st.cs = u.question ? null : 'surprise';
  return { parts, topics: [], ask: S.rng.chance(0.5) ? null : 'visiting' };
};

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
    case 'work': return say(S, a.place && a.place.kind === 'home' ? 'act.wfh' : 'act.work', slots, facts);
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
      if (m) { p = say(S, 'pivot.memory', { memTitle: m.title || h.text, memEs: memoryEs(m) }, [memoryFact(m)]); if (p) st.usedMemories.add(m.source); }
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

/**
 * When the NPC asked the player something last turn and the player answers it, react to the answer and
 * remember it. Returns a plan, or null when the player's line is not an answer.
 */
export function answerPending(S, u) {
  const v = S.v, st = S.st;
  let key = st.pending;
  if (!key) {
    // "I'm from Fresno", "I'm a nurse": volunteered, not asked, but worth the same reaction
    const told = u.appraisal.facts.find(f => f.key === 'from' || f.key === 'lives' || f.key === 'job');
    const topical = Object.entries(u.scores).some(([k, sc]) => sc >= 3.5 && !['greeting', 'thanks', 'apology', 'compliment', 'name'].includes(k));
    if (!told || u.question || topical) return null;
    key = told.key === 'job' ? 'job' : told.key;
  }
  const strong = Object.entries(u.scores).some(([k, s]) => s >= 3.5 && !['greeting', 'thanks', 'apology', 'compliment', 'name'].includes(k));
  if (u.question && strong) return null;
  if (u.intent === 'insult' || u.intent === 'goodbye' || u.flags.more) return null;
  const words = u.norm.split(' ').length;
  const parts = [];
  const learn = (k, value, text) => S.learn(k, value, text);
  if (key === 'name') {
    const f = u.appraisal.facts.find(x => x.key === 'name');
    const bare = /^([A-Z][a-z'-]{1,20})[.!]?$/.exec(u.text.trim());
    const nm = f ? String(f.value).split(/\s+/)[0] : bare && !/^(Yes|No|Yeah|Nope|Sure|Hi|Hey|Hello|Thanks|Okay|Ok)$/i.test(bare[1]) ? bare[1] : null;
    if (!nm) return null;
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
    if (words <= 5 && !u.question && /^[A-Za-z .'-]+$/.test(u.text.trim())) {
      learn('from', u.text.trim().replace(/[.!]$/, ''), `They are from ${u.text.trim().replace(/[.!]$/, '')}.`);
      parts.push(say(S, 'react.from.unknown'));
      return { parts, topics: ['neighborhood'], intent: 'smalltalk', ask: null };
    }
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
    if (!f) learn('job', job, `They work as ${withArticle(job)}.`);
    if (job === 'retired') parts.push(say(S, 'react.retired'));
    else if (v.occ && v.occ.title && v.occ.title.toLowerCase().includes(job.toLowerCase())) parts.push(say(S, 'react.jobSame'));
    else parts.push(say(S, 'react.job', { aPlayerJob: withArticle(job), aPlayerJobCap: capFirst(withArticle(job)) }));
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
  if (['greeting', 'goodbye', 'thanks', 'insult', 'name', 'joke'].includes(intent)) return parts;
  if (!rng.chance(0.06 + 0.22 * v.verb + (v.reg === 'casual' ? 0.06 : 0))) return parts;
  const own = v.fillers.filter(f => FILLER_STARTS.test(f));
  const local = v.reg === 'formal' ? [] : (linesForSafe(v, 'fillers').filter(f => FILLER_STARTS.test(f) && (!YOUNG_FILLERS.test(f) || v.age < 35)));
  const pool = own.length && rng.chance(0.7) ? own : local.length ? local : own;
  const f = rng.pick(pool);
  if (!f) return parts;
  const i = parts.findIndex(p => p && startsCommon(p.text) && !/^(oh|well|so|hmm|good question)/i.test(p.text));
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
  if (['insult', 'name', 'goodbye'].includes(intent)) return parts;
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
      else if (t === 'no cap' && /\.$/.test(p.text) && !/\?/.test(p.text) && p.text.length < 90 && /^(best|nothing|the best|you can't|you won't|there's|it's|honestly)/i.test(p.text)) text = p.text.replace(/\.$/, ', no cap.');
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
  parts = parts.slice(0, budget);
  // the player's name, now and then, at the end of the first sentence
  if (v.relq.name && parts.length && !['insult'].includes(intent) && (st.nameUses === 0 ? rng.chance(0.5) : rng.chance(0.1)) && !parts[0].text.includes(v.relq.name)) {
    const p = parts[0];
    const add = s => s.replace(/([.!?]+)?$/, (m0, pun) => `, ${v.relq.name}${pun || '.'}`);
    if (!/[,:;]$/.test(p.text) && p.text.split(/[.!?]/).filter(Boolean).length === 1) { parts[0] = Object.assign({}, p, { text: add(p.text), gloss: p.gloss ? add(p.gloss) : null }); st.nameUses += 1; }
  }
  // an opener before an answer to a question
  if (u && u.question && parts.length && rng.chance(0.22) && v.age >= 13 && !plan.noAsk && !(v.age < 18 && HEAVY.has(intent)) && !['goodbye', 'greeting', 'thanks', 'insult', 'name'].includes(intent)) {
    const o = say(S, HEAVY.has(intent) ? 'open.heavy' : 'open.question');
    if (o) {
      if (/,$/.test(o.text)) {
        if (startsCommon(parts[0].text)) parts[0] = Object.assign({}, parts[0], { text: `${o.text} ${G.lowerFirst(parts[0].text)}`, gloss: parts[0].gloss ? `${o.gloss || o.text} ${G.lowerFirst(parts[0].gloss)}` : null });
      } else parts.unshift(o);
    }
  }
  // a mood aside, once in a while and once per conversation
  if (!st.moodSaid && v.age >= 13 && !['insult', 'goodbye', 'thanks'].includes(intent) && rng.chance(0.18)) {
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
    if (!st.warmSaid && ['fond', 'warm'].includes(v.relq.feelings) && !['insult', 'goodbye'].includes(intent) && rng.chance(0.2)) {
      const w = say(S, 'warm.aside');
      if (w) { parts.push(w); st.warmSaid = true; }
    }
  }
  // the home language
  let pre = null, post = null;
  const csIntent = st.cs || CS_INTENT[intent] || null;
  st.cs = null;
  const fits = CS_FITS[intent] || null;
  if (v.lang.mode === 'simple' && csIntent && rng.chance(0.85)) pre = homePhrase(S, csIntent, fits);
  else if (v.lang.mode === 'en' && v.lang.cs && csIntent && rng.chance(Math.min(0.85, v.lang.cs.rate * 1.2))) {
    const ph = homePhrase(S, csIntent, fits);
    if (ph) { if (intent === 'goodbye') post = ph; else pre = ph; }
  }
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

export { pacific };
