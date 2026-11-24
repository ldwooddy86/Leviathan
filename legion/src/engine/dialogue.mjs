// Legion · dialogue: the offline dialogue engine.
//
// How every NPC talks when no Claude key is set. A Conversation listens (intents and entities from keywords,
// patterns and the mind's appraisal), plans (content from the persona, the mind and the world pack: the weather and
// the forecast, alerts, fires, storms, records, highways named the local way, landmarks, Census facts about the
// neighborhood), realizes (a large template library, first person, many variants per intent and topic, the
// dialect's own lines), and styles (register, verbosity, slang, humor, mood, the relationship, code-switching into
// the home language with an English gloss). It never says the same line twice in a conversation, and the mind
// remembers what was talked about, so a returning player hears about it.
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
import { Picker, findBrands, BRAND_BLACKLIST } from './lexicon.mjs';
import { Mind } from './mind.mjs';
import { makeVoice, refreshVoice } from './dialogue/voice.mjs';
import { understand, INTENTS as INTENT_ORDER, TOPICAL } from './dialogue/understand.mjs';
import { PLANNERS, compose, answerPending, smallChild, say, baseSlots, EN, SPANISH, tagHash, memoryFact } from './dialogue/plan.mjs';
import { fireFacts } from './dialogue/ground.mjs';
import { bark, barkBetween, BARK_EN, BARK_ES, BARK_SITUATIONS } from './dialogue/bark.mjs';
import { isNum, lintText, slotNames, cleanText, capFirst } from './dialogue/core.mjs';
import { fireLabel } from './lexicon.mjs';

export { bark, barkBetween, BARK_SITUATIONS, understand };

/** Bumped when the engine's behavior or Line shape changes. */
export const DIALOGUE_VERSION = 1;

/** The intents the engine understands (Line.intent is one of these). */
export const INTENTS = Object.freeze(['greeting', 'how-are-you', 'name', 'about-them', 'job', 'family', 'home', 'neighborhood', 'weather', 'traffic', 'fire', 'storm', 'heat', 'housing', 'rent', 'insurance', 'earthquake', 'food', 'place', 'directions', 'history', 'opinion', 'compliment', 'insult', 'joke', 'thanks', 'apology', 'smalltalk', 'goodbye', 'unknown']);

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

/** The fact a topic memory should name: the fire or road the line was about, said the local way. */
function topicFromFacts(intent, facts, line) {
  const fire = facts.find(f => /^fire:/.test(f));
  if (intent === 'fire' && fire) {
    const [, name, year] = fire.split(':');
    const label = fireLabel(name);
    if (label) return [`${label} in ${year}`, `el incendio ${name.replace(/\s+(Fire|Complex)$/i, '')} de ${year}`, fire];
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

function topicOfMemory(m) {
  const x = /^The player asked me about (.+)\.$/.exec(String(m.text || ''));
  if (!x) return null;
  const es = (m.tags || []).find(t => t.startsWith('es:'));
  return { topic: x[1], topicEs: es ? es.slice(3).replace(/_/g, ' ') : null, intent: (m.tags || []).find(t => INTENTS.includes(t)) || null, facts: (m.tags || []).filter(t => TOPIC_TAGS.test(t)) };
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
    this.picker = new Picker(hash2(this.rngSeed, 0x70696b));
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
      depth: {}, lastIntent: null, lastAsked: false, mentionedPrev: false, calledBack: new Set(), convTag, cs: null, pivotIntent: null,
      prev: prev.length ? topicOfMemory(prev[0]) : null,
    };
    if (this.st.prev && !this.st.prev.topic) this.st.prev = null;
    // the name index and voice caches warm here, so the first reply is as quick as the rest
    understand('hello', { world, home: this.voice.home });
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
      v, rng, picker: this.picker, st: this.st, mind: this.mind, base: baseSlots(v), world: this.world,
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
    const rng = new Rng(hashAll(this.rngSeed, st.turn, kind, text || ''));
    if (kind === 'reply') this.mind.observe({ kind: 'utterance', from: 'player', text, t: this.t });
    else if (kind === 'greet') this.mind.observe({ kind: 'meet', from: 'player', t: this.t });
    refreshVoice(v, this.mind, { metBefore: !!st.prev });
    const S = this._session(rng);
    let u = null, intent, line;
    if (kind === 'reply') {
      u = understand(text, { world: this.world, mind: this.mind, home: v.home, fires: fireFacts(v).map(f => ({ name: f.name })), lastIntent: st.pivotIntent || st.lastIntent, pending: st.pending });
      intent = u.intent;
    } else intent = kind === 'greet' ? 'greeting' : 'goodbye';

    if (v.age < 5) {
      const text0 = smallChild(S, intent);
      line = { text: text0, gloss: null, facts: [], ask: null };
      return this._finish(kind, text, intent, line, u, { topics: [], emotion: null });
    }
    let plan = null;
    if (u) {
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
    const cb = kind === 'reply' ? this._callback(S, intent, u) : null;
    if (cb) plan.parts.unshift(cb);
    line = compose(S, intent, plan, u);
    // never the same line twice: if planning landed on a line already said, plan again with a fresh draw
    for (let k = 1; k <= 3 && st.said.has(line.text); k++) {
      const S2 = this._session(new Rng(hashAll(this.rngSeed, st.turn, kind, text || '', k)));
      const again = (PLANNERS[intent] || PLANNERS.unknown)(S2, u || { norm: '', text: '', entities: { years: [], fires: [], roads: [], places: [], routine: [] }, flags: {}, topics: [], scores: {}, appraisal: { facts: [], sentiment: 0, toxicity: 0, intents: [] } }, kind === 'greet' ? { initiated: true } : {});
      line = compose(S2, intent, again, u);
    }
    if (st.said.has(line.text)) line = Object.assign({}, line, repeatLine(v, line));
    return this._finish(kind, text, intent, line, u, plan);
  }

  _callback(S, intent, u) {
    const st = this.st, v = this.voice;
    if (!TOPICAL.has(intent) || st.calledBack.has(intent) || (st.mentionedPrev && st.prev && st.prev.intent === intent)) return null;
    let hits = [];
    try { hits = this.mind.recall(`${u.text} ${intent} ${u.topics.join(' ')}`, 8, { t: this.t, kinds: ['conversation'], background: false }); } catch { hits = []; }
    const m = hits.find(x => x.tags.includes('asked') && x.tags.includes(intent) && !x.tags.includes(st.convTag));
    if (!m) return null;
    const topic = topicOfMemory(m);
    if (!topic) return null;
    st.calledBack.add(intent);
    st.mentionedPrev = true;
    return say(S, 'recall.prev', { prevTopic: topic.topic, prevTopicEs: topic.topicEs }, topic.facts.map(f => f.replace(/^fire:([^:]+)/, (a, n) => `fire:${n.replace(/\b\w/g, c => c.toUpperCase())}`)));
  }

  _finish(kind, text, intent, line, u, plan) {
    const st = this.st, v = this.voice;
    const topics = [...new Set([...(plan.topics || []), ...((u && u.topics) || [])])].filter(Boolean);
    const emotion = plan.emotion || this.mind.emotion || 'neutral';
    const out = { text: line.text, gloss: line.gloss || null, intent, topics, emotion, facts: line.facts || [] };
    st.said.add(out.text);
    st.pending = line.ask || null;
    st.lastAsked = !!line.ask;
    if (TOPICAL.has(intent)) { st.lastIntent = intent; st.depth[intent] = (st.depth[intent] || 0) + 1; }
    st.prevIntent = intent;
    if (!(plan && plan.parts && plan.parts.some(p => p && /^pivot/.test(p.key || '')))) st.pivotIntent = null;
    if (plan.learnedName) S_learnName(this, plan.learnedName);
    const tAt = this.t;
    if (text !== null) this.history.push({ role: 'player', text, intent, t: tAt });
    this.history.push({ role: 'npc', text: out.text, gloss: out.gloss, intent, topics, emotion, facts: out.facts.slice(), t: tAt });
    this.mind.observe({ kind: 'utterance', from: 'self', text: out.text, t: tAt, tags: [intent] });
    if (kind === 'reply' && TOPICAL.has(intent) && TOPIC_PHRASE[intent]) {
      const tp = topicFromFacts(intent, out.facts, out);
      if (tp) {
        const tags = ['player', 'asked', intent, st.convTag, `es:${tp[1].replace(/\s+/g, '_')}`, ...(tp[2] ? [tp[2].toLowerCase()] : []), ...topics];
        this.mind.remember(`The player asked me about ${tp[0]}.`, HEAVY_IMPORTANCE[intent] || 0.45, tags, { t: tAt, kind: 'conversation' });
      }
    }
    return out;
  }
}

/** A line said a second time, owned as such: "Like I said, ..." in the speaker's language. */
function repeatLine(v, line) {
  const low = s => (/^(I|I'm|I've|I'd|I'll)\b/.test(s) || /^\p{Lu}\p{Lu}/u.test(s) ? s : s[0].toLowerCase() + s.slice(1));
  if (v.lang.mode === 'es') return { text: `${v.lang.usted ? 'Como le decía' : 'Como te decía'}, ${low(line.text)}`, gloss: `Like I was saying, ${low(line.gloss || line.text)}` };
  return { text: `Like I said, ${low(line.text)}`, gloss: line.gloss ? `Like I said, ${low(line.gloss)}` : null };
}

const HEAVY_IMPORTANCE = { fire: 0.7, storm: 0.6, earthquake: 0.6, insurance: 0.6, history: 0.55, family: 0.55, job: 0.5, rent: 0.55, housing: 0.5 };

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

export { BRAND_BLACKLIST, slotNames, cleanText, capFirst, memoryFact };

/**
 * @typedef {Object} Line
 * @property {string} text      what the NPC says
 * @property {string|null} gloss the English meaning when the line (or part of it) is in another language
 * @property {string} intent    the intent the line answers (INTENTS)
 * @property {string[]} topics  what it was about (weather, traffic, fire, housing, rent, insurance, job, family, food, sports, school, neighborhood, history, self, …)
 * @property {string} emotion   how the NPC feels saying it (EMOTIONS)
 * @property {string[]} facts   ids of the pack facts and record fields used
 */
