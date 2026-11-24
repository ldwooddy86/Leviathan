// Legion · dialogue: the offline dialogue engine.
//
// How every NPC talks when no Claude key is set. A Conversation listens (intents and entities from keywords,
// patterns and the mind's appraisal), plans (content from the persona, the mind and the world pack: the weather and
// the forecast, alerts, fires, storms, records, highways named the local way, landmarks, Census facts about the
// neighborhood), realizes (a large template library, first person, many variants per intent and topic, the
// dialect's own lines), and styles (register, verbosity, slang, humor, mood, the relationship, code-switching into
// the home language with an English gloss). It never says the same line twice in a conversation, and the mind
// remembers what was talked about, so a returning player hears about it. A player may also speak Spanish: a
// Spanish speaker answers that turn in Spanish (with the English gloss), anyone else gets the everyday words
// (hola, gracias, ¿cómo está?) and says so for the rest. A hello in another language ("안녕하세요!") is answered in
// kind by someone whose language it is, and kindly in English by anyone else. Holidays ("Happy Thanksgiving!", "what
// are you doing for Thanksgiving?") are answered from the calendar, the household and the work schedule.
//
// Some things an NPC will not do. A line that sorts people into groups, probes immigration status, tells them to
// leave or accuses them of a crime on a stereotype (dialogue/probe.mjs) is declined or denied and pushed back on,
// never met with a coy "why do you ask?", and a hostile one costs the player like an insult. A crude, hateful or joke
// name, job or hometown is never learned or said back, nor is a reaction ("Cool.") taken for a hometown. A follow-up
// ("how old are they?", "which hospital?", "what does your mom do?") is answered from the NPC's own record about the
// people it names, never with "I don't know". The NPC says "you asked me that already" only when the player did. No
// claim rests on missing data: no record of an earthquake is not "nothing happened here", and past the forecast
// window the weather is an estimate and nothing more.
//
// Lines: {text, gloss, intent, topics, emotion, facts}. gloss is the English meaning when the line (or part of it)
// is in another language, null otherwise. facts lists the ids of the pack facts the line used (see
// dialogue/ground.mjs), so tests and the UI can show provenance.
//
// Deterministic given (rngSeed, history) and the mind's state; no network; a reply takes a few milliseconds.
//
//   const conv = new Conversation({ world, persona: p, mind, t, rngSeed: 7 });
//   conv.greet();                       // {text: 'Hey there. I'm Rosa.', intent: 'greeting', ...}
//   conv.reply('How was the fire?');    // {text: 'The Woolsey Fire, in 2018. ...', facts: ['fire:Woolsey:2018', ...]}
//   conv.farewell();
//   bark(world, p, { t, other: q, situation: 'pass' });   // {text: 'Morning!', gloss: null}

import { Rng, hashAll, hash2 } from './rng.mjs';
import { Picker, findBrands } from './lexicon.mjs';
import { Mind, appraise } from './mind.mjs';
import { makeVoice, refreshVoice } from './dialogue/voice.mjs';
import { understand, TOPICAL } from './dialogue/understand.mjs';
import { PLANNERS, compose, answerPending, smallChild, say, baseSlots, EN, SPANISH, tagHash, pivot, memoryFact } from './dialogue/plan.mjs';
import { fireFacts, weatherFacts, fireName, cleanFireName } from './dialogue/ground.mjs';
import { bark, barkBetween, BARK_EN, BARK_ES, BARK_SITUATIONS } from './dialogue/bark.mjs';
import { isNum, lintText, fitsLife, lexiconLineFits, sentencesOf, sentenceKey, contentWords, tidy, terminate, capFirst } from './dialogue/core.mjs';
import { screenValue } from './dialogue/probe.mjs';

export { bark, barkBetween, BARK_SITUATIONS, understand };

/** Bumped when the engine's behavior or Line shape changes. */
export const DIALOGUE_VERSION = 1;

/**
 * The intents the engine understands (Line.intent is one of these). 'probe' is a line that sorts people into groups,
 * asks about immigration status or prejudice: the NPC declines and pushes back (a hostile one is an 'insult').
 */
export const INTENTS = Object.freeze(['greeting', 'how-are-you', 'name', 'about-them', 'job', 'family', 'home', 'neighborhood', 'weather', 'traffic', 'fire', 'storm', 'heat', 'housing', 'rent', 'insurance', 'earthquake', 'food', 'place', 'directions', 'history', 'opinion', 'compliment', 'insult', 'probe', 'joke', 'thanks', 'apology', 'smalltalk', 'goodbye', 'unknown']);

/** Line.emotion values: the mind's emotion labels plus a few the content sets (amused, pleased, hurt, annoyed, worried, wistful). */
export const EMOTIONS = Object.freeze(['tired', 'excited', 'happy', 'cheerful', 'relaxed', 'content', 'tense', 'calm', 'neutral', 'irritated', 'anxious', 'bored', 'down', 'angry', 'upset', 'sad', 'amused', 'pleased', 'hurt', 'annoyed', 'worried', 'wistful']);

// What the player asked about, as the NPC would later say it ("you asked me about ___"), English and Spanish.
const TOPIC_PHRASE = {
  weather: ['the weather', 'el clima'], traffic: ['the traffic', 'el tráfico'], fire: ['the fires around here', 'los incendios'],
  storm: ['the big storms', 'las tormentas'], heat: ['the heat', 'el calor'], housing: ['what houses cost here', 'lo cara que está la vivienda'],
  rent: ['the rent', 'la renta'], insurance: ['home insurance', 'el seguro de la casa'], earthquake: ['earthquakes', 'los temblores'],
  food: ['where to eat', 'dónde comer'], place: ['things to do around here', 'qué visitar por aquí'], directions: ['how to get around', 'cómo llegar a un lugar'],
  history: ['the old days', 'los tiempos de antes'], job: ['my work', 'mi trabajo'], family: ['my family', 'mi familia'], home: ['my place', 'mi casa'],
  neighborhood: ['the neighborhood', 'el barrio'], 'about-them': ['my life', 'mi vida'], opinion: ['what I think about things', 'lo que pienso'],
};

const TOPIC_TAGS = /^(fire|road|landmark|place):/;

// Lines that run every reading pattern once, for the constructor's warm-up. (One carries accents: a folded line is a
// two-byte string, and V8 compiles each pattern separately for those.)
const WARM_UP = ['hello', 'Hi! How old are they? What do you think about immigrants? Which one?', 'Are Mexicans lazy? Do you have papers? How far is your work? Where are you from?',
  'Buenos días, ¿cómo está? Ça va.'];

// What anyone in California understands in Spanish, whatever languages they speak.
const EVERYDAY_SPANISH = new Set(['greeting', 'how-are-you', 'name', 'thanks', 'goodbye', 'apology', 'insult']);

/** The fact a topic memory should name: the fire the line was about, else the topic in general. */
function topicFromFacts(intent, facts) {
  const fire = facts.find(f => /^fire:/.test(f));
  if (intent === 'fire' && fire) {
    const [, name, year] = fire.split(':');
    const label = fireName(name);
    if (label) return [`${label} in ${year}`, `el incendio ${cleanFireName(name).replace(/\s+(Fire|Complex)$/i, '')} de ${year}`, fire];
  }
  const p = TOPIC_PHRASE[intent];
  return p ? [p[0], p[1], null] : null;
}

/** Memories of earlier conversations with the player ("The player asked me about X."), latest first. */
function earlierTopics(mind, convTag) {
  const mem = mind && mind.state && Array.isArray(mind.state.memory) ? mind.state.memory : [];
  return mem.filter(m => m && m.kind === 'conversation' && Array.isArray(m.tags) && m.tags.includes('asked') && !m.tags.includes(convTag))
    .sort((a, b) => (b.t ?? 0) - (a.t ?? 0) || b.id - a.id);
}

const titleWords = s => String(s).replace(/\b\p{Ll}/gu, c => c.toUpperCase());

/** What an earlier conversation was about, from its memory: {topic, topicEs, intent, facts}. */
function topicOfMemory(m) {
  const x = /^The player asked me about (.+)\.$/.exec(String(m.text || ''));
  if (!x) return null;
  const tags = m.tags || [];
  const intent = tags.find(t => INTENTS.includes(t)) || null;
  // tags are stored in lower case: names come back in title case ("fire:woolsey:2018" is the Woolsey Fire)
  const facts = tags.filter(t => TOPIC_TAGS.test(t)).map(t => t.replace(/^(fire|road|landmark|place):([^:]+)/, (a, k, n) => `${k}:${k === 'road' ? n.toUpperCase() : titleWords(n)}`));
  const fire = facts.find(f => f.startsWith('fire:'));
  const topicEs = fire ? `el incendio ${fire.split(':')[1].replace(/\s+(Fire|Complex)$/i, '')} de ${fire.split(':')[2]}` : intent && TOPIC_PHRASE[intent] ? TOPIC_PHRASE[intent][1] : null;
  return { topic: x[1], topicEs, intent, facts };
}

/**
 * A conversation with one NPC. Feed it the player's lines with reply(); greet() and farewell() let the NPC open
 * and close. The mind (a Mind; one is created when none is given) hears everything and remembers the conversation.
 */
export class Conversation {
  /**
   * @param {{world: import('./world.mjs').World, persona: object, mind?: Mind|null, t?: number, rngSeed?: number, population?: object}} opts
   *   persona: persona(world, npc, {population, dialectFor}); t: epoch ms of the conversation (default the
   *   persona's time, then the NWS snapshot); rngSeed: the seed (default from the persona id and the minute)
   */
  constructor(opts = {}) {
    const { world, persona } = opts || {};
    if (!world || !persona || !persona.npc) throw new Error('new Conversation({world, persona}): a world and a persona are required');
    this.world = world;
    this.persona = persona;
    this.population = opts.population || null;
    this.t = isNum(opts.t) ? opts.t : isNum(persona.t) ? persona.t : world.snapshotTime;
    this.rngSeed = (isNum(opts.rngSeed) ? opts.rngSeed : hashAll(persona.id || '', Math.floor(this.t / 60000))) >>> 0;
    this.mind = opts.mind || new Mind(persona, { t: this.t });
    /** The turns: {role: 'player'|'npc', text, intent, t} plus, for the NPC, {gloss, topics, emotion, facts}. */
    this.history = [];
    // the speaker's id goes into every draw, so two people given the same seed still talk differently
    this.idHash = hashAll(persona.id || '');
    this.picker = new Picker(hash2(this.rngSeed ^ this.idHash, 0x70696b));
    this.voice = makeVoice(world, persona, { t: this.t });
    const st = this.mind.state || {};
    if (typeof this.mind.tick === 'function' && (st.lastTick === null || st.lastTick === undefined || this.t >= st.lastTick)) {
      this.mind.tick(this.t, { weather: this.voice.wx, activity: this.voice.activity });
    }
    const seq = st.seq || 0;
    const convTag = `conv-${tagHash(`${this.rngSeed}:${this.t}:${seq}:${persona.id}`)}`;
    const prev = earlierTopics(this.mind, convTag);
    this.st = {
      turn: 0, said: new Set(), used: new Set(), usedMemories: new Set(), usedInterests: new Set(), hooksUsed: new Set(), asked: new Set(),
      pending: null, nameUses: 0, moodSaid: false, greeted: false, gaveName: false, ended: false, closed: false, insults: 0,
      depth: {}, lastIntent: null, lastAsked: false, mentionedPrev: false, calledBack: new Set(), convTag, cs: undefined, pivotIntent: null, noSpanish: 0,
      prev: prev.length ? topicOfMemory(prev[0]) : null,
      // what has been said: every sentence (as sentenceKey), their content words, the facts told, the repeats owned
      sentences: new Set(), sentWords: [], saidFacts: new Set(), repeats: 0, homeWords: new Map(), familyFocus: null,
    };
    if (this.st.prev && !this.st.prev.topic) this.st.prev = null;
    // the name index, the voice caches and the big patterns warm here (V8 compiles a pattern to native code on its
    // second use), so the first reply is as quick as the rest
    for (let k = 0; k < 2; k++) {
      for (const w of WARM_UP) understand(w, { world, home: this.voice.home, self: this.voice.vocab, lastIntent: 'family' });
      weatherFacts(this.voice);
      for (const w of WARM_UP) { fitsLife(w, this.voice); lexiconLineFits(w, this.voice, 'weather'); }
    }
  }

  /** The NPC opens the conversation. @returns {Line} */
  greet() {
    return this._turn('greet', null);
  }

  /**
   * The NPC's answer to the player's line.
   * @param {string} text what the player said
   * @returns {Line}
   */
  reply(text) {
    return this._turn('reply', String(text === undefined || text === null ? '' : text).slice(0, 2000));
  }

  /** The NPC closes the conversation. @returns {Line} */
  farewell() {
    const line = this._turn('farewell', null);
    const topics = [...new Set(this.history.filter(h => h.role === 'npc').flatMap(h => h.topics || []))].filter(x => x !== 'self');
    this.mind.remember(topics.length ? `I talked with the player about ${topics.slice(0, 4).join(', ')}.` : 'I talked with the player for a bit.', 0.35, ['player', 'conversation', this.st.convTag, ...topics], { t: this.t, kind: 'conversation' });
    return line;
  }

  /** Serializable summary of the conversation so far (history and the engine's state, without the mind). */
  toJSON() {
    return {
      v: DIALOGUE_VERSION, id: this.persona.id, t: this.t, rngSeed: this.rngSeed, history: this.history.map(h => Object.assign({}, h)),
      picker: this.picker.toJSON(), turn: this.st.turn, pending: this.st.pending, convTag: this.st.convTag,
    };
  }

  _session(rng) {
    const v = this.voice;
    return {
      v, rng, picker: this.picker, st: this.st, mind: this.mind, base: baseSlots(v), world: this.world, population: this.population,
      learn: (key, value, text) => {
        const r = typeof this.mind.relationship === 'function' ? this.mind.relationship('player') : null;
        if (!r) return;
        const have = r.facts.find(f => f.key === key);
        if (have) Object.assign(have, { value, t: this.t, text });
        else r.facts.push({ key, value, t: this.t, text });
      },
    };
  }

  _turn(kind, text) {
    const st = this.st, v = this.voice;
    st.turn += 1;
    const rng = new Rng(hashAll(this.rngSeed, this.idHash, st.turn, kind, text || ''));
    if (kind === 'reply') {
      // the mind learns what the player says about themselves; a crude, hateful or joke value is taken back out
      const before = playerFacts(this.mind);
      this.mind.observe({ kind: 'utterance', from: 'player', text, t: this.t });
      sentenceName(this.mind, text, this.t);
      scrubFacts(this.mind, before);
    } else if (kind === 'greet') this.mind.observe({ kind: 'meet', from: 'player', t: this.t });
    refreshVoice(v, this.mind, { metBefore: !!st.prev });
    const S = this._session(rng);
    let u = null, intent, line;
    if (kind === 'reply') {
      // (recent: the topic was the last turn's, so "really?" or "wow" still means it; several turns on, it doesn't)
      u = understand(text, { world: this.world, mind: this.mind, home: v.home, fires: fireFacts(v).map(f => ({ name: f.name, alias: cleanFireName(f.name) })), lastIntent: st.pivotIntent || st.lastIntent, recent: !!st.pivotIntent || !st.prevIntent || st.prevIntent === st.lastIntent, pending: st.pending, self: v.vocab });
      intent = u.intent;
      // a hostile probe stings like an insult, though the mind's appraisal hears no swearing in it
      if (u.flags.probe && u.flags.probe.hostile) affront(this.mind, this.t, ['slur', 'hate', 'leave'].includes(u.flags.probe.kind) ? 1.4 : 1);
    } else intent = kind === 'greet' ? 'greeting' : 'goodbye';

    // A line in Spanish: a Spanish speaker answers that turn in Spanish; one who speaks none says so, except for
    // the everyday words everybody here knows (hola, gracias, adiós, ¿cómo está?).
    const mode0 = v.lang.mode;
    const switchEs = !!(u && u.flags.spanish && v.lang.spanish && mode0 !== 'es');
    const noSpanish = !!(u && u.flags.spanish && !v.lang.spanish && !EVERYDAY_SPANISH.has(intent));
    if (switchEs) v.lang.mode = 'es';
    try {
      if (v.age < 5) {
        const text0 = smallChild(S, intent);
        line = { text: text0, gloss: null, facts: [], ask: null };
        return this._finish(kind, text, intent, line, u, { topics: [], emotion: null });
      }
      let plan = null;
      if (noSpanish) {
        intent = 'unknown';
        st.noSpanish += 1;
        plan = { parts: [say(S, st.noSpanish > 2 ? 'unk.noSpanishAgain' : 'unk.noSpanish') || say(S, 'unk.noSpanish')], topics: [], noAsk: true };
      } else if (u) {
        plan = answerPending(S, u);
        if (plan && plan.intent) intent = plan.intent;
      }
      if (!plan) {
        if (st.ended && kind === 'reply' && !['apology', 'insult', 'goodbye'].includes(intent)) plan = { parts: [say(S, 'insult.after')], topics: [], noAsk: true, emotion: 'annoyed' };
        else if (kind === 'greet') plan = PLANNERS.greeting(S, null, { initiated: true });
        else if (kind === 'farewell') plan = PLANNERS.goodbye(S, null);
        else plan = (PLANNERS[intent] || PLANNERS.unknown)(S, u);
      }
      if (u && u.flags.greeted && intent !== 'greeting' && !st.greeted && v.lang.mode === 'en') {
        st.greeted = true;
        plan.parts.unshift(say(S, 'greet.first'));
      }
      const cb = kind === 'reply' && !noSpanish ? this._callback(S, intent, u) : null;
      if (cb) plan.parts.unshift(cb);
      line = compose(S, intent, plan, u);
      // never the same line twice, nor a sentence said before: when planning landed on a line already said, or had
      // nothing new left to say, plan again with a fresh draw
      const stale = l => st.said.has(l.text) || (kind === 'reply' && !l.answered);
      for (let k = 1; k <= 3 && stale(line); k++) {
        const S2 = this._session(new Rng(hashAll(this.rngSeed, this.idHash, st.turn, kind, text || '', k)));
        const again = noSpanish ? { parts: [say(S2, st.noSpanish > 2 ? 'unk.noSpanishAgain' : 'unk.noSpanish')], topics: [], noAsk: true }
          : (PLANNERS[intent] || PLANNERS.unknown)(S2, u || { norm: '', text: '', entities: { years: [], fires: [], roads: [], places: [], routine: [] }, flags: {}, topics: [], scores: {}, appraisal: { facts: [], sentiment: 0, toxicity: 0, intents: [] } }, kind === 'greet' ? { initiated: true } : {});
        line = compose(S2, intent, again, u);
      }
      // still nothing new: the NPC owns the repeat ("Like I said, ..."), then says so and moves on, then lets it go
      if (stale(line)) line = this._repeat(intent, line, rng, u, plan);
      return this._finish(kind, text, intent, line, u, plan);
    } finally {
      v.lang.mode = mode0;
    }
  }

  /**
   * A reply with nothing new left in it. First the earlier answer, owned as a repeat ("Like I said, ..."), each way
   * of owning it once; then a word that it was asked already and a move to something else; then, when even those
   * are used up, a small gesture. Never a line or a sentence said before in this conversation.
   */
  _repeat(intent, line, rng, u = null, plan = null) {
    const st = this.st, v = this.voice;
    st.repeats += 1;
    const S = this._session(new Rng(hashAll(this.rngSeed, this.idHash, st.turn, 'repeat', st.repeats)));
    const base = { facts: [], ask: null, answered: true, mems: [], keys: [] };
    const topics = (plan && plan.topics) || [];
    const restate = !NO_RESTATE.has(intent) || topics.some(t => RESTATE_TOPICS.has(t));
    if (restate) {
      const before = [...this.history].reverse().find(h => h.role === 'npc' && h.intent === intent && h.text && !h.repeat && (!NO_RESTATE.has(intent) || (h.topics || []).some(t => topics.includes(t))));
      const core = before ? restatable(before, v.relq.name) : null;
      const r = core ? repeatLine(v, core, st) : null;
      if (r) return Object.assign({}, line, base, r, { facts: before.facts.slice(), repeat: true });
    }
    // "You asked me that already" only when the player did ask it already; a new question with nothing left to say
    // gets something else on their mind, or a gesture
    const ack = askedAgain(this.history, intent, u) ? say(S, 'repeat.ack') : null;
    const lead = ack || gesture(v, st, rng);
    // (after a conversation ended in anger, nothing more is offered: no new subject)
    const p = st.ended || (ack && !rng.chance(0.6)) ? null : pivot(S);
    const parts = [lead, p && !st.said.has(p.text) ? p : null].filter(Boolean);
    const text = tidy(parts.map(x => terminate(x.text)).join(' '));
    const gloss = parts.some(x => x.gloss) ? tidy(parts.map(x => terminate(x.gloss || x.text)).join(' ')) : null;
    if (!st.said.has(text)) return Object.assign({}, line, base, { text, gloss, facts: parts.flatMap(x => x.facts || []), repeat: true });
    return Object.assign({}, line, base, gesture(v, st, rng), { repeat: true });
  }

  _callback(S, intent, u) {
    const st = this.st;
    if (!TOPICAL.has(intent) || st.calledBack.has(intent) || (st.mentionedPrev && st.prev && st.prev.intent === intent)) return null;
    let hits = [];
    try { hits = this.mind.recall(`${u.text} ${intent} ${u.topics.join(' ')}`, 8, { t: this.t, kinds: ['conversation'], background: false }); } catch { hits = []; }
    const m = hits.find(x => x.tags.includes('asked') && x.tags.includes(intent) && !x.tags.includes(st.convTag));
    if (!m) return null;
    const topic = topicOfMemory(m);
    if (!topic) return null;
    st.calledBack.add(intent);
    st.mentionedPrev = true;
    return say(S, 'recall.prev', { prevTopic: topic.topic, prevTopicEs: topic.topicEs }, topic.facts);
  }

  _finish(kind, text, intent, line, u, plan) {
    const st = this.st;
    const topics = [...new Set([...(plan.topics || []), ...((u && u.topics) || [])])].filter(Boolean);
    const emotion = plan.emotion || this.mind.emotion || 'neutral';
    const out = { text: line.text, gloss: line.gloss || null, intent, topics, emotion, facts: line.facts || [] };
    st.said.add(out.text);
    // every sentence said, the facts told and the memories recounted: none of them is said again
    const name = this.voice.relq ? this.voice.relq.name : null;
    for (const s of sentencesOf(out.text)) {
      const k = sentenceKey(s, name);
      if (!k) continue;
      st.sentences.add(k);
      const cw = contentWords(k);
      if (cw.size >= 4) st.sentWords.push(cw);
    }
    for (const f of out.facts) st.saidFacts.add(f);
    for (const m of line.mems || []) st.usedMemories.add(m);
    for (const m of this.persona.memories || []) {
      if (!m || m.kind === 'life') continue;
      const id = memoryFact(m);
      if (id && TOLD_EVENT.test(id) && out.facts.includes(id)) st.usedMemories.add(m.source);
    }
    if (plan && plan.familyFocus !== undefined) st.familyFocus = plan.familyFocus;
    st.pending = line.ask || null;
    st.lastAsked = !!line.ask;
    if (TOPICAL.has(intent)) { st.lastIntent = intent; st.depth[intent] = (st.depth[intent] || 0) + 1; }
    st.prevIntent = intent;
    if (!(plan && plan.parts && plan.parts.some(p => p && /^pivot/.test(p.key || '')))) st.pivotIntent = null;
    if (plan.learnedName) S_learnName(this, plan.learnedName);
    const tAt = this.t;
    if (text !== null) this.history.push(Object.assign({ role: 'player', text, intent, t: tAt }, u && u.flags && u.flags.sub ? { sub: u.flags.sub } : {}));
    this.history.push(Object.assign({ role: 'npc', text: out.text, gloss: out.gloss, intent, topics, emotion, facts: out.facts.slice(), t: tAt }, line.repeat ? { repeat: true } : {}));
    this.mind.observe({ kind: 'utterance', from: 'self', text: out.text, t: tAt, tags: [intent] });
    if (kind === 'reply' && TOPICAL.has(intent) && TOPIC_PHRASE[intent]) {
      const tp = topicFromFacts(intent, out.facts);
      if (tp) {
        const tags = ['player', 'asked', intent, st.convTag, ...(tp[2] ? [tp[2]] : []), ...topics];
        this.mind.remember(`The player asked me about ${tp[0]}.`, HEAVY_IMPORTANCE[intent] || 0.45, tags, { t: tAt, kind: 'conversation' });
      }
    }
    return out;
  }
}

// A sentence that only continues the one before it ("Plus three siblings.", "Y también mis hermanos.").
const CONTINUATION = /^(?:plus|also|oh, and|and also|and|y también|también|ah, y|además)\b/i;

// Intents whose earlier answer is not worth restating ("Like I said, thanks" is not a thing people say).
const NO_RESTATE = new Set(['unknown', 'greeting', 'goodbye', 'thanks', 'apology', 'compliment', 'insult', 'probe', 'joke', 'smalltalk']);
// Topics of those intents whose answers are worth restating all the same ("Like I said, dinner with the family").
const RESTATE_TOPICS = new Set(['holiday']);

/**
 * Whether the player asked this before: an earlier line of theirs with the same intent that says the same thing, word
 * for word or nearly (the same content words), or the same sub-question.
 */
function askedAgain(history, intent, u) {
  if (!u) return false;
  const key = sentenceKey(u.norm || u.text || '', null, 1);
  const words = contentWords(key);
  for (const h of history) {
    if (h.role !== 'player' || h.intent !== intent || !h.text) continue;
    const k = sentenceKey(String(h.text).toLowerCase(), null, 1);
    if (k && k === key) return true;
    const cw = contentWords(k);
    if (words.size && cw.size) {
      let both = 0;
      for (const x of words) if (cw.has(x)) both++;
      if (both / (words.size + cw.size - both) >= 0.6) return true;
    }
    if (u.flags && u.flags.sub && h.sub && h.sub === u.flags.sub) return true;
  }
  return false;
}
// Fact ids of events a memory can be about: the line that tells the event tells the memory.
const TOLD_EVENT = /^(fire|ar|wind|fema):|^record\./;

/**
 * The sentence of an earlier answer worth saying again: its first sentence of three or more words, with the
 * matching sentence of the gloss. Null when there is none.
 */
function restatable(h, name) {
  const ts = sentencesOf(h.text), gs = h.gloss ? sentencesOf(h.gloss) : [];
  // (never a continuation: "Like I said, plus three siblings" says nothing)
  const i = ts.findIndex(s => sentenceKey(s, name) && !/\?$/.test(s) && !CONTINUATION.test(s));
  if (i < 0) return null;
  return { text: ts[i], gloss: h.gloss ? (gs.length === ts.length ? gs[i] : gs.find(s => sentenceKey(s, name)) || null) : null };
}

/**
 * A line said a second time, owned as such: "Like I said, ..." in the speaker's language, each way of owning it at
 * most once (st: the conversation state, with the lines and sentences already said). Null when every way is used.
 */
function repeatLine(v, line, st) {
  const low = s => (/^(I|I'm|I've|I'd|I'll)\b/.test(s) || /^\p{Lu}\p{Lu}/u.test(s) ? s : s[0].toLowerCase() + s.slice(1));
  const ways = v.lang.mode === 'es'
    ? [[v.lang.usted ? 'Como le decía' : 'Como te decía', 'Like I was saying'], [v.lang.usted ? 'Ya le dije' : 'Ya te dije', 'I already told you'], ['Otra vez', 'Again'], ['Lo repito', "I'll say it again"]]
      .map(([es, en]) => ({ text: `${es}, ${low(line.text)}`, gloss: `${en}, ${low(line.gloss || line.text)}` }))
    : ['Like I said', 'Like I told you', 'Again', 'As I said'].map(w => ({ text: `${w}, ${low(line.text)}`, gloss: line.gloss ? `${w}, ${low(line.gloss)}` : null }));
  const name = v.relq ? v.relq.name : null;
  return ways.find(x => !st.said.has(x.text) && !sentencesOf(x.text).some(s => { const k = sentenceKey(s, name); return k && st.sentences.has(k); })) || null;
}

// Small gestures, when there is truly nothing left to say: English for English and plain-English speakers, Spanish
// with its English for Spanish speakers. {his} is the speaker's possessive.
const GESTURES_EN = ['shrugs', 'smiles', 'laughs a little', 'nods', 'raises an eyebrow', 'waits for you to go on', 'glances at the time', 'gives you a long look',
  'chuckles', 'shakes {his} head, smiling', 'tilts {his} head', 'looks down the street', 'checks {his} phone', 'folds {his} arms', 'scratches {his} chin',
  'lets out a little sigh', 'smiles politely', 'looks at you, amused', 'waves a hand', 'leans back'];
const GESTURES_ES = [['se encoge de hombros', 'shrugs'], ['sonríe', 'smiles'], ['se ríe un poco', 'laughs a little'], ['asiente', 'nods'], ['levanta una ceja', 'raises an eyebrow'],
  ['se queda esperando', 'waits'], ['mira la hora', 'glances at the time'], ['se queda pensando', 'thinks it over'], ['niega con la cabeza, sonriendo', 'shakes {his} head, smiling'],
  ['ladea la cabeza', 'tilts {his} head'], ['mira hacia la calle', 'looks down the street'], ['revisa su teléfono', 'checks {his} phone'], ['se cruza de brazos', 'folds {his} arms'],
  ['suspira', 'sighs'], ['sonríe con cortesía', 'smiles politely'], ['hace un gesto con la mano', 'waves a hand']];

// What part of a person a gesture uses: two of the same never go together ("shakes her head and nods").
const GESTURE_PART = g => (/\b(nods?|head|asiente|cabeza)\b/i.test(g) ? 'head' : /\b(smiles?|laughs?|chuckles|sonr[ií]e|r[ií]e)\b/i.test(g) ? 'face'
  : /\b(looks?|glances|eyebrow|ceja|mira)\b/i.test(g) ? 'eyes' : /\b(arms|hand|phone|brazos|mano|tel[eé]fono)\b/i.test(g) ? 'hands' : g);

/** A gesture not made before in this conversation: one action, or two that go together ("She shrugs and smiles."). */
function gesture(v, st, rng) {
  const he = v.sex === 'F' ? 'She' : 'He', his = v.sex === 'F' ? 'her' : 'his';
  const es = v.lang.mode === 'es';
  const acts = (es ? GESTURES_ES : GESTURES_EN.map(a => [a, a])).map(([a, g]) => [a, g.replace(/\{his\}/g, his)]);
  const cands = [];
  for (let i = 0; i < acts.length; i++) {
    cands.push([acts[i]]);
    for (let j = 0; j < acts.length; j++) if (j !== i && GESTURE_PART(acts[i][1]) !== GESTURE_PART(acts[j][1])) cands.push([acts[i], acts[j]]);
  }
  const order = rng.shuffle(cands.map((c, k) => k));
  for (const k of order) {
    const c = cands[k];
    const en = `(${he} ${c.map(x => x[1]).join(' and ')}.)`;
    const text = es ? `(${capFirst(c.map(x => x[0]).join(' y '))}.)` : en;
    if (!st.said.has(text)) return { text, gloss: es ? en : null };
  }
  return { text: `(${he} says nothing.)`, gloss: null };
}

const HEAVY_IMPORTANCE = { fire: 0.7, storm: 0.6, earthquake: 0.6, insurance: 0.6, history: 0.55, family: 0.55, job: 0.5, rent: 0.55, housing: 0.5 };

/** The player's facts in the mind as {key: value}, before a turn (to restore what a crude value overwrote). */
function playerFacts(mind) {
  const r = mind && typeof mind.relationship === 'function' ? mind.relationship('player') : null;
  return r && Array.isArray(r.facts) ? r.facts.map(f => Object.assign({}, f)) : [];
}

/**
 * The name in one sentence of a longer line ("I'm Marcus. What's your name?"), which the mind's reading of the whole
 * line misses: read by the mind's own appraisal, a sentence at a time, and kept as the mind keeps it.
 */
function sentenceName(mind, text, t) {
  const r = mind && typeof mind.relationship === 'function' ? mind.relationship('player') : null;
  if (!r || !Array.isArray(r.facts) || r.facts.some(f => f && f.key === 'name')) return;
  const parts = String(text || '').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length < 2) return;
  for (const s of parts) {
    const f = (appraise(s).facts || []).find(x => x && x.key === 'name');
    if (f) { r.facts.push({ key: 'name', value: f.value, t: isNum(t) ? t : null, text: `Their name is ${f.value}.` }); return; }
  }
}

/** Take back any fact the mind just learned whose value is crude, hateful or a joke, restoring what it replaced. */
function scrubFacts(mind, before) {
  const r = mind && typeof mind.relationship === 'function' ? mind.relationship('player') : null;
  if (!r || !Array.isArray(r.facts)) return;
  for (let i = r.facts.length - 1; i >= 0; i--) {
    const f = r.facts[i];
    if (!f || !screenValue(f.value, f.key)) continue;
    const prev = before.find(b => b.key === f.key && !screenValue(b.value, b.key));
    if (prev) r.facts[i] = prev; else r.facts.splice(i, 1);
  }
}

/** What an insult does to the relationship (the mind's own rule), for a hostile line its appraisal does not catch. */
function affront(mind, t, weight = 1) {
  const r = mind && typeof mind.relationship === 'function' ? mind.relationship('player') : null;
  if (!r) return;
  const N = mind.persona && mind.persona.big5 && isNum(mind.persona.big5.N) ? mind.persona.big5.N : 0.5;
  const sting = (0.7 + 0.6 * N) * weight;
  const clamp1 = x => Math.max(-1, Math.min(1, Math.round(x * 1000) / 1000));
  r.affinity = clamp1((r.affinity || 0) - 0.2 * sting);
  r.trust = clamp1((r.trust || 0) - 0.15 * sting);
  r.grievance = Math.max(0, Math.min(2, Math.round(((r.grievance || 0) + 0.3 * weight) * 1000) / 1000));
  if (isNum(t)) r.lastInsult = t;
}

function S_learnName(conv, name) {
  const r = typeof conv.mind.relationship === 'function' ? conv.mind.relationship('player') : null;
  if (r && !r.facts.some(f => f.key === 'name')) r.facts.push({ key: 'name', value: name, t: conv.t, text: `Their name is ${name}.` });
}

/**
 * Every template the engine can say, for tools and lints: [{bank, key, text, gloss, tags}].
 * @returns {Array<{bank: string, key: string, text: string, gloss: string|null, tags: string[]}>}
 */
export function templates() {
  const out = [];
  for (const bank of [EN, SPANISH, BARK_EN, BARK_ES]) for (const [key, list] of Object.entries(bank)) for (const l of list) out.push({ bank: l.bank, key, text: l.text, gloss: l.gloss, tags: l.tags.map(([neg, t]) => (neg ? '!' : '') + t) });
  return out;
}

/**
 * Lint every template: brand names, accent spelling and mock foreign words in the English text and glosses,
 * unbalanced braces. Returns the problems found (empty when clean).
 * @returns {Array<{bank: string, key: string, text: string, problem: string}>}
 */
export function lintTemplates() {
  const out = [];
  for (const tpl of templates()) {
    const english = tpl.bank !== 'es' && tpl.bank !== 'bark-es';
    for (const problem of lintText(tpl.text, findBrands, { english })) out.push({ bank: tpl.bank, key: tpl.key, text: tpl.text, problem });
    if (tpl.gloss) for (const problem of lintText(tpl.gloss, findBrands, { english: true })) out.push({ bank: tpl.bank, key: tpl.key, text: tpl.gloss, problem });
  }
  return out;
}


/**
 * @typedef {Object} Line
 * @property {string} text      what the NPC says
 * @property {string|null} gloss the English meaning when the line (or part of it) is in another language
 * @property {string} intent    the intent the line answers (INTENTS)
 * @property {string[]} topics  what it was about (weather, traffic, fire, housing, rent, insurance, job, family, food, sports, school, neighborhood, history, self, …)
 * @property {string} emotion   how the NPC feels saying it (EMOTIONS)
 * @property {string[]} facts   ids of the pack facts and record fields used
 */
