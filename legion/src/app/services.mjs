// Legion · services: the app's one door to the engine.
//
// The page never imports an engine module directly. It asks this registry, which holds the world, the
// population, the minds and the simulation clock's time, builds the map and the crowd, and exposes the engine
// through named hooks: personas, minds, schedules, the offline dialogue engine, the Claude bridge, the street view
// and the live NWS layer. Each hook returns a Result: `{ok: true, value}` or `{ok: false, reason, module, message}`
// with a sentence the UI can show as is, so every panel renders both states. Tests (and tools) can swap any
// module for a fake with services.wire.
//
// Time. Every hook that depends on the moment takes the simulation time; without one it reads the clock the page
// registered (setClock), and without that the NWS snapshot time, never the wall clock. Personas are rebuilt per
// simulated hour (their concerns and hooks mention the alerts and the weather of that hour); minds advance with the
// clock; a conversation happens at the moment it starts.
//
// Weather. With live NWS weather allowed (Settings), the live layer's world() replaces the pack's world for every
// reader that speaks about the weather (personas, conversations, barks, the Claude situation note, the Place panel);
// otherwise, and wherever the live forecast has nothing for the moment, the pack's NWS snapshot answers.

import { loadPack, createWorld } from '../engine/world.mjs';
import { Population, LEGION_SEED, parseId } from '../engine/population.mjs';
import * as clock from '../engine/clock.mjs';
import { hashAll } from '../engine/rng.mjs';
import * as personaModule from '../engine/persona.mjs';
import * as mindModule from '../engine/mind.mjs';
import * as scheduleModule from '../engine/schedule.mjs';
import * as dialogueModule from '../engine/dialogue.mjs';
import * as safetyModule from '../engine/dialogue/safety.mjs';
import * as llmModule from '../engine/llm.mjs';
import * as lexiconModule from '../engine/lexicon.mjs';
import * as streetModule from '../world/street.mjs';
import * as weatherModule from './nws-live.mjs';
import { MapView } from '../world/map.mjs';
import { Crowd, prewarmCrowd } from '../world/crowd.mjs';
import { MemoryMindStore } from './store.mjs';
import { fidelityTables, residentsOf } from './census.mjs';

/** The engine modules the app uses, what each gives the page, and the sentence shown if one is not loaded. */
export const ENGINE_MODULES = Object.freeze([
  { key: 'persona', file: 'src/engine/persona.mjs', title: 'Personality', provides: 'Big Five, values, interests, concerns, memories of local events, speech style, bio', pending: 'The personality module is not loaded in this page.' },
  { key: 'mind', file: 'src/engine/mind.mjs', title: 'Mind', provides: 'mood, needs, a memory stream and the relationship with you', pending: 'The mind module (mood, needs, memories) is not loaded in this page.' },
  { key: 'schedule', file: 'src/engine/schedule.mjs', title: 'Daily schedule', provides: 'each NPC’s day plan and what they are doing right now', pending: 'The schedule module is not loaded in this page.' },
  { key: 'dialogue', file: 'src/engine/dialogue.mjs', title: 'Offline dialogue', provides: 'conversation in the NPC’s regional voice, no network needed', pending: 'The offline dialogue engine is not loaded in this page.' },
  { key: 'llm', file: 'src/engine/llm.mjs', title: 'Claude bridge', provides: 'system prompts, streaming conversation with Claude, reflection into memory', pending: 'The Claude bridge is not loaded in this page.' },
  { key: 'street', file: 'src/world/street.mjs', title: 'Street view', provides: 'the neighborhood up close: residents on the sidewalks and streets, chatting', pending: 'The street view is not loaded in this page.' },
  { key: 'weather', file: 'src/app/nws-live.mjs', title: 'Live weather', provides: 'fresh NWS forecasts and alerts from api.weather.gov, when you allow it', pending: 'Live weather is not loaded in this page; the weather comes from the NWS snapshot in the pack.' },
]);

/**
 * A fire's name as people say it, with CAL FIRE unit codes in capitals: 'Camp' is "the Camp Fire", 'Scu Lightning
 * Complex' is "the SCU Lightning Complex" (the lexicon's fireLabel, the one the dialogue speaks with); null for an
 * unnamed or number-only fire.
 * @param {string|{name: string}} fire
 * @returns {string|null}
 */
export function fireLabel(fire) { return lexiconModule.fireLabel(fire); }

/** Claude models offered in Settings when the Claude bridge does not list its own. */
export const CLAUDE_MODELS = Object.freeze([
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Default' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Faster' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'Fastest, lowest cost' },
  { id: 'claude-fable-5-2', label: 'Claude Fable 5.2', note: 'Most capable, slower' },
]);

/** Effort levels offered for conversation (low is the default). */
export const CLAUDE_EFFORTS = Object.freeze(['low', 'medium', 'high']);

/** The kinds of line the offline engine steps out of the scene for (CONTRACTS section 7, Line.safety). */
const SAFETY_KINDS = new Set(['crisis', 'sexual', 'threat']);

/**
 * Where to find help, as a note from Legion when someone talking to an NPC says they are in crisis and the dialogue
 * engine gives no note of its own (988 is the Suicide & Crisis Lifeline: call or text, any time; it answers in
 * Spanish too).
 */
export const CRISIS_NOTE = 'If you are thinking about suicide or hurting yourself, or someone is hurting you, you can call or text 988 (the Suicide & Crisis Lifeline) any time, day or night; it answers in Spanish too. If you or someone else is in danger right now, call 911.';

const DEFAULT_MODULES = Object.freeze({
  persona: personaModule, mind: mindModule, schedule: scheduleModule, dialogue: dialogueModule, llm: llmModule, street: streetModule,
  weather: weatherModule,
});

/** @typedef {{ok: true, value: any} | {ok: false, reason: 'missing'|'needs-key'|'needs-permission'|'not-found'|'error', module?: string, message: string}} Result */

const ok = value => ({ ok: true, value });
const fail = (reason, message, extra = {}) => ({ ok: false, reason, message, ...extra });
const HOUR = 3600000;
/** How long (real ms) a street exchange's answer waits for the one it answers to be asked (the street asks after 1.4 s). */
const BARK_REPLY_MS = 10000;
/** Real time, for pairing street lines only (animation, never what an NPC is or says). */
const realNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

/** True for a Result that holds a value. */
export function isOk(result) { return !!(result && result.ok); }

const clamp1 = v => Math.max(-1, Math.min(1, v));

/**
 * Store a Claude reflection (llm.REFLECTION_SCHEMA: summary, facts_about_player, affinity_delta, trust_delta, mood,
 * memorable_line, follow_up) in a Mind through its public methods: the summary, the memorable line and the
 * follow-up become memories (remember), and the player relationship (relationship('player')) takes the deltas and
 * the new facts. Facts already known are not added twice.
 * @param {object} mind a Mind (CONTRACTS section 6)
 * @param {object} r the reflection
 * @param {number} t simulated epoch ms
 */
export function applyReflection(mind, r, t) {
  if (!mind || !r) return;
  const remember = (text, importance, tags, kind) => { if (text && typeof mind.remember === 'function') mind.remember(text, importance, tags, { t, kind }); };
  remember(r.summary, 0.6, ['conversation', 'player'], 'conversation');
  if (r.memorable_line) remember(`The player said: "${String(r.memorable_line).slice(0, 280)}"`, 0.55, ['player', 'quote'], 'dialogue');
  if (r.follow_up) remember(`Next time I see the player: ${r.follow_up}`, 0.5, ['player', 'follow-up'], 'intention');
  if (typeof mind.relationship !== 'function') return;
  const rel = mind.relationship('player');
  if (!rel || typeof rel !== 'object') return;
  if (Number.isFinite(r.affinity_delta)) rel.affinity = clamp1((Number(rel.affinity) || 0) + r.affinity_delta);
  if (Number.isFinite(r.trust_delta)) rel.trust = clamp1((Number(rel.trust) || 0) + r.trust_delta);
  if (Array.isArray(r.facts_about_player)) {
    if (!Array.isArray(rel.facts)) rel.facts = [];
    for (const f of r.facts_about_player) {
      const text = String(f || '').trim();
      if (text && !rel.facts.some(x => (x && (x.text || x.value)) === text)) rel.facts.push({ key: text.toLowerCase().slice(0, 48), value: text, t, text });
    }
  }
}

function errorText(e) { return (e && (e.message || String(e))) || 'Unknown error'; }

/**
 * An NPC id string from whatever the crowd's pick returns: an id string, or the packed
 * `zi << 20 | h << 4 | m` integer of crowd-build's ids array.
 */
export function npcIdFrom(world, id) {
  if (id === null || id === undefined) return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'number' && Number.isFinite(id)) {
    const u = id >>> 0, zi = u >>> 20, h = (u >>> 4) & 0xffff, m = u & 0xf;
    return zi < world.N ? `${world.zips[zi]}-${h}-${m}` : null;
  }
  if (typeof id === 'object' && id.id !== undefined) return npcIdFrom(world, id.id);
  return null;
}

/**
 * Create a services registry. The app uses the shared `services`; tests create their own with fake modules.
 * @param {{modules?: object, mindStore?: {get: Function, put: Function}, MapViewClass?: Function, CrowdClass?: Function,
 *   PopulationClass?: Function, seed?: number, fetch?: Function}} [options] fetch: what the live weather layer fetches
 *   with (default globalThis.fetch; it is only used once the player allows live weather)
 */
export function createServices(options = {}) {
  const mods = { ...DEFAULT_MODULES, ...(options.modules || {}) };
  const MapViewClass = options.MapViewClass || MapView;
  const CrowdClass = options.CrowdClass || Crowd;
  const PopulationClass = options.PopulationClass || Population;
  let world = null, population = null, store = options.mindStore || new MemoryMindStore();
  let live = null;              // the live NWS layer (nws-live LiveWeather) once a world is loaded
  let liveWanted = false;       // what Settings says, kept for a layer made after it was set
  let getTime = null;           // the simulation clock (setClock)
  const personas = new Map();   // id -> {key, persona} (LRU; key = simulated hour and live generation)
  const minds = new Map();      // id -> live Mind for this session
  const voices = new Map();     // settings signature -> ClaudeVoice
  const fidelity = new Map();   // `${zi}:${households}` -> validate() result (LRU; a check costs a few hundred ms)
  const barks = new Map();      // replies barkBetween produced, waiting for the street view to ask for them
  // Simulated time when a caller gives none: the page's clock, else the snapshot epoch, never the wall clock, so
  // the same call gives the same offline line and memories carry simulated timestamps.
  const simTime = t => {
    if (Number.isFinite(t)) return t;
    if (getTime) { const c = getTime(); if (Number.isFinite(c)) return c; }
    return world && Number.isFinite(world.snapshotTime) ? world.snapshotTime : 0;
  };

  const pendingMessage = key => (ENGINE_MODULES.find(m => m.key === key) || {}).pending || `${key} is not available.`;
  const missing = key => fail('missing', pendingMessage(key), { module: key });
  const needWorld = () => { if (!world || !population) throw new Error('services: the world is not loaded yet'); };
  /** The world weather readers see: live-aware when the layer is on. */
  const wxWorld = () => (live && live.enabled ? live.world() : world);
  const liveGen = () => (live && live.enabled ? live.generation : 0);

  function makeLive() {
    live = null;
    const W = mods.weather;
    if (!W || typeof W.LiveWeather !== 'function' || !world) return;
    try {
      live = new W.LiveWeather({ world, fetch: options.fetch || null, enabled: liveWanted });
      // a refreshed ZIP changes what personas say about the weather: drop the ones built on the old answer
      live.onChange(() => { personas.clear(); });
    } catch { live = null; }
  }

  const svc = {
    clock,
    parseId,

    /** The loaded World (null before init). */
    get world() { return world; },
    /** The world as weather readers see it: the live NWS layer's view when it is on, else the World. */
    get weatherWorld() { return world ? wxWorld() : null; },
    /** The Population (null before init). */
    get population() { return population; },
    /** The population seed. */
    get seed() { return population ? population.seed : (options.seed ?? LEGION_SEED); },
    /** The live NWS layer (nws-live LiveWeather), or null when the module is not wired. */
    get live() { return live; },

    /**
     * Load a world pack (base64 gzip string, bytes, URL or object) and create the population.
     * @returns {Promise<{world: object, population: object}>}
     */
    async load(src, { seed } = {}) { return svc.init(await loadPack(src), { seed }); },

    /** Decode a pack source (base64 gzip string, gzip or JSON bytes, URL or path) into the pack object. */
    async unpack(src) { return loadPack(src); },

    /** Use a pack object or an existing World. */
    init(packOrWorld, { seed } = {}) {
      world = packOrWorld && typeof packOrWorld.zip === 'function' && packOrWorld.N ? packOrWorld : createWorld(packOrWorld);
      population = new PopulationClass(world, { seed: seed ?? options.seed ?? LEGION_SEED });
      personas.clear(); minds.clear(); voices.clear(); fidelity.clear(); barks.clear();
      makeLive();
      return { world, population };
    },

    /** Register the simulation clock (a function returning epoch ms) that hooks read when given no time. */
    setClock(fn) { getTime = typeof fn === 'function' ? fn : null; },

    /** The current simulation time: the registered clock, else the snapshot time. */
    now() { return simTime(undefined); },

    /**
     * Wire engine modules at runtime: `{persona, mind, schedule, dialogue, llm, street, weather}` (any subset; null
     * unwires). The page wires the real modules by import; this is the same switch for tests and tools. Caches
     * that depend on the modules are dropped. Returns `status()`.
     * @param {Record<string, object|null>} modules
     */
    wire(modules) {
      for (const [key, mod] of Object.entries(modules || {})) {
        if (!ENGINE_MODULES.some(m => m.key === key)) throw new Error(`services.wire: unknown module "${key}"`);
        mods[key] = mod || null;
      }
      personas.clear(); minds.clear(); voices.clear(); barks.clear();
      if ('weather' in (modules || {}) && world) makeLive();
      return svc.status();
    },

    /** Swap the MindStore (the app uses a localStorage one). */
    setMindStore(next) { if (next && typeof next.get === 'function' && typeof next.put === 'function') store = next; },

    /** Every engine module with whether it is wired: `[{key, file, title, provides, pending, available}]`. */
    status() { return ENGINE_MODULES.map(m => ({ ...m, available: !!mods[m.key] })); },

    /** True when the engine module `key` is wired. */
    available(key) { return !!mods[key]; },

    /** The statewide map (MapView) in a container. */
    createMap(container, { theme = 'dark' } = {}) { needWorld(); return new MapViewClass(container, { world, theme }); },

    /**
     * Start the crowd's build Workers now, decoding their own copies of the pack while the page decodes its own, so
     * the crowd starts building the moment the map exists (the default Crowd only; returns the Workers started).
     * @param {string|Uint8Array} pack the pack source as the page read it (base64 gzip, or gzip bytes)
     */
    prewarmCrowd(pack) {
      if (CrowdClass !== Crowd) return 0;
      try { return prewarmCrowd({ pack, popSeed: (options.seed ?? LEGION_SEED) >>> 0 }); } catch { return 0; }
    },

    /** The GPU crowd over a map (extra options pass through to the Crowd: pack, workers ...). */
    createCrowd(map, { rate, seed, ...rest } = {}) { needWorld(); return new CrowdClass(map, { world, population, rate, seed: seed ?? population.seed, ...rest }); },

    /** The NPC (layer 1) for an id, or null. */
    npc(id) {
      needWorld();
      try { return id ? population.get(String(id)) : null; } catch { return null; }
    },

    /** n residents of a place scope (see census.residentsOf). */
    residents(scope, n = 12, seed = 1) { needWorld(); return residentsOf(population, world, scope, n, seed); },

    // ---------------------------------------------------------------- weather

    /**
     * The weather for ZIP zi at time t (world.weatherAt's shape): live from api.weather.gov when allowed and the
     * live forecast covers t (`live: true`), else the pack's NWS snapshot; null when the pack cannot say.
     */
    weather(zi, t) {
      needWorld();
      try { return wxWorld().weatherAt(zi, simTime(t)); } catch { return null; }
    },

    /** Turn the live NWS layer on or off (Settings, network.nws). */
    setLiveWeather(on) {
      liveWanted = !!on;
      if (live) live.setEnabled(liveWanted);
      personas.clear();
    },

    /**
     * Ask for a ZIP's live weather (when allowed); resolves with the layer's status for that ZIP and time, which
     * says in words where the weather shown comes from ({state, note}).
     */
    async refreshWeather(zi, t) {
      if (!live) return { state: 'off', note: null };
      await live.refresh(zi);
      return live.status(zi, simTime(t));
    },

    /** Where ZIP zi's weather at time t comes from: {state: 'off'|'idle'|'loading'|'live'|'outside'|'error', note}. */
    weatherStatus(zi, t) { return live ? live.status(zi, simTime(t)) : { state: 'off', note: null }; },

    /**
     * Census versus generated tables for a ZIP, or null when the population reports none. `households` and
     * `persons` count what was actually generated and compared: the population caps the sample at the ZIP's own
     * households (Bodega has 3). `gq` is the ZIP's group-quarters population (dorms, barracks, prisons, nursing
     * homes), which households do not cover, when the population reports it. Cached per ZIP and sample size.
     * @returns {{tables: object[], households: number, persons: number|null, gq: {persons: number, share: number}|null, raw: object} | null}
     */
    validate(zi, households = 600) {
      needWorld();
      if (typeof population.validate !== 'function') return null;
      const key = `${zi}:${households}`;
      if (fidelity.has(key)) return fidelity.get(key);
      let out = null;
      try {
        const raw = population.validate(zi, households);
        const tables = fidelityTables(raw);
        if (tables.length) {
          const compared = raw && Number.isFinite(raw.households) ? raw.households : Math.min(households, world.z.hh[zi] || 0);
          const gq = raw && raw.gq && Number.isFinite(raw.gq.share) ? { persons: Number(raw.gq.persons) || 0, share: raw.gq.share } : null;
          out = { tables, households: compared, persons: raw && Number.isFinite(raw.persons) ? raw.persons : null, gq, raw };
        }
      } catch (e) {
        console.error('[legion] validate failed', e);
        out = null;
      }
      fidelity.set(key, out);
      if (fidelity.size > 32) fidelity.delete(fidelity.keys().next().value);
      return out;
    },

    // ---------------------------------------------------------------- persona and mind

    /**
     * The persona of an NPC (Result): persona(world, npc, {population, dialectFor, t}) for the simulated hour holding
     * t (default the clock), so its concerns and hooks speak of that hour's weather and alerts. `{any: true}` takes
     * whatever persona is cached for the id, whatever its hour (the street view: its residents' days do not depend on
     * the hour's weather).
     * @param {string} id
     * @param {{t?: number, any?: boolean}} [opts]
     */
    persona(id, { t, any = false } = {}) {
      if (!mods.persona) return missing('persona');
      needWorld();
      const hour = Math.floor(simTime(t) / HOUR) * HOUR;
      const key = `${hour}|${liveGen()}`;
      const hit = personas.get(id);
      if (hit && (any || hit.key === key)) { personas.delete(id); personas.set(id, hit); return ok(hit.persona); }
      const npc = svc.npc(id);
      if (!npc) return fail('not-found', `No NPC has the id ${id}.`);
      try {
        const p = mods.persona.persona(wxWorld(), npc, { population, dialectFor: lexiconModule.dialectFor, t: hour });
        personas.set(id, { key, persona: p });
        if (personas.size > 512) personas.delete(personas.keys().next().value);
        return ok(p);
      } catch (e) { return fail('error', `The persona could not be built: ${errorText(e)}`, { module: 'persona' }); }
    },

    /**
     * The live Mind of an NPC, restored from the MindStore (Result). With `t` (simulated epoch ms) the mind is
     * first advanced to that time (mind.tick with the weather there and, when schedules are wired, the activity),
     * so mood and needs reflect the moment the page shows.
     */
    mind(id, { t } = {}) {
      if (!mods.mind) return missing('mind');
      let m = minds.get(id);
      if (!m) {
        const p = svc.persona(id, { t });
        if (!p.ok) return p;
        try {
          const state = store.get(id);
          m = new mods.mind.Mind(p.value, state ? { state } : { t: simTime(t) });
          minds.set(id, m);
          if (minds.size > 64) { const [oldId] = minds.keys(); svc.saveMind(oldId); minds.delete(oldId); }
        } catch (e) { return fail('error', `The mind could not be restored: ${errorText(e)}`, { module: 'mind' }); }
      }
      if (Number.isFinite(t) && typeof m.tick === 'function') {
        try {
          const npc = svc.npc(id);
          const a = mods.schedule ? svc.activityAt(id, t) : null;
          m.tick(t, { weather: npc ? svc.weather(npc.zi, t) : null, activity: a && a.ok ? a.value : null });
        } catch { /* a mind that cannot tick still shows its stored state */ }
      }
      return ok(m);
    },

    /** Persist an NPC's live mind to the MindStore; true when saved. */
    saveMind(id) {
      const m = minds.get(id);
      if (!m || typeof m.toJSON !== 'function') return false;
      try { return store.put(id, m.toJSON()) !== false; } catch { return false; }
    },

    /** Forget an NPC's mind (live and stored). */
    forgetMind(id) { minds.delete(id); if (typeof store.delete === 'function') store.delete(id); },

    /** Forget every mind (live and stored). */
    resetMinds() { minds.clear(); if (typeof store.clear === 'function') store.clear(); },

    /**
     * Something the NPC's mind takes in (mind.observe: what the player said, a meeting, an alert), then saved.
     * The Claude path records the player's lines through this; the offline Conversation hears them itself.
     * @returns {Result}
     */
    observe(id, event, { t } = {}) {
      const m = svc.mind(id);
      if (!m.ok) return m;
      try {
        const ev = typeof event === 'string' ? { kind: 'utterance', from: 'player', text: event } : { ...event };
        if (!Number.isFinite(ev.t)) ev.t = simTime(t);
        const r = m.value.observe(ev);
        svc.saveMind(id);
        return ok(r);
      } catch (e) { return fail('error', `The mind could not take that in: ${errorText(e)}`, { module: 'mind' }); }
    },

    /**
     * Consolidate an offline conversation into the NPC's mind (mind.reflect at simulated time t), then save it:
     * Result of the beliefs formed (empty when there was too little to think over).
     */
    reflectOffline(id, { t } = {}) {
      const m = svc.mind(id);
      if (!m.ok) return m;
      try {
        const beliefs = typeof m.value.reflect === 'function' ? m.value.reflect(simTime(t)) : [];
        svc.saveMind(id);
        return ok(beliefs);
      } catch (e) { return fail('error', `The conversation could not be stored: ${errorText(e)}`, { module: 'mind' }); }
    },

    // ---------------------------------------------------------------- talk

    /**
     * A new offline Conversation with an NPC (Result). `t` is the simulated time (epoch ms; default the clock); with
     * the NPC's id it seeds the engine, so the same id at the same minute gives the same lines. The conversation
     * hears the NPC's persisted Mind and the live weather when it is on.
     */
    conversation(id, { t, rngSeed } = {}) {
      if (!mods.dialogue) return missing('dialogue');
      const time = simTime(t);
      const p = svc.persona(id, { t: time });
      if (!p.ok) return p;
      const m = mods.mind ? svc.mind(id, { t: time }) : null;
      try {
        const conv = new mods.dialogue.Conversation({ world: wxWorld(), persona: p.value, mind: m && m.ok ? m.value : null, t: time, rngSeed: rngSeed ?? hashAll(id, Math.floor(time / 60000)), population });
        return ok(conv);
      } catch (e) { return fail('error', `The conversation could not start: ${errorText(e)}`, { module: 'dialogue' }); }
    },

    /**
     * What the offline engine's safety check makes of a player's line, for the Claude path (the offline engine acts
     * on it itself): `{kind: 'crisis'|'sexual'|'threat', note}` or null. For a crisis (suicide, self-harm, abuse, a
     * medical emergency) `note` is where to find help (988, 911), which the Talk tab shows as a note from Legion
     * under Claude's reply; the other kinds carry no note. Null when the dialogue engine is not wired or says nothing.
     * @param {string} text
     * @returns {{kind: string, note: string|null}|null}
     */
    safety(text, { age } = {}) {
      const D = mods.dialogue;
      if (!D) return null;
      try {
        // the dialogue engine's own reading (dialogue/safety.mjs), the one the offline conversation acts on
        const own = D === dialogueModule ? safetyModule : D;
        if (typeof own.safetyOf === 'function') {
          const r = own.safetyOf(String(text || ''), { age });
          if (!r || !SAFETY_KINDS.has(r.kind)) return null;
          const notes = own.SAFETY_NOTES || {};
          const key = r.kind === 'crisis' ? (r.sub === 'abuse' ? 'abuse' : r.sub === 'emergency' ? 'emergency' : 'crisis') : r.kind === 'threat' && r.sub === 'mass' ? 'mass' : null;
          const note = key ? (r.es && notes[`${key}Es`]) || notes[key] || (r.kind === 'crisis' ? CRISIS_NOTE : null) : null;
          return { kind: r.kind, sub: r.sub || null, note };
        }
        if (typeof D.understand !== 'function') return null;
        const u = D.understand(String(text || ''), {});
        const kind = u && (typeof u.safety === 'string' ? u.safety : SAFETY_KINDS.has(u.intent) ? u.intent : null);
        if (!kind || !SAFETY_KINDS.has(kind)) return null;
        return { kind, note: kind === 'crisis' ? (typeof u.note === 'string' && u.note) || CRISIS_NOTE : null };
      } catch { return null; }
    },

    /**
     * A ClaudeVoice for the current settings (Result). Needs the Claude bridge, the Claude network permission and
     * an API key (or the Legion server's proxy, found through its /api/health).
     * @param {{claude?: {apiKey?: string, model?: string, effort?: string, proxyURL?: string}, network?: {claude?: boolean}}} settings
     */
    voice(settings = {}) {
      if (!mods.llm || typeof mods.llm.ClaudeVoice !== 'function') return missing('llm');
      const c = settings.claude || {}, net = settings.network || {};
      if (!net.claude) return fail('needs-permission', 'Allow the Claude API in Settings, under Network, to talk with Claude.', { module: 'llm' });
      if (!c.apiKey && !c.proxyURL) return fail('needs-key', 'Add your Claude API key in Settings to talk with Claude.', { module: 'llm' });
      // through the Legion server's proxy the server holds the key: the player's own key never leaves this function
      const apiKey = c.proxyURL ? undefined : (c.apiKey || undefined);
      const sig = [apiKey ? hashAll(apiKey) : 0, c.model, c.effort, c.proxyURL || ''].join('|');
      if (voices.has(sig)) return ok(voices.get(sig));
      try {
        const voice = new mods.llm.ClaudeVoice({ apiKey, model: c.model, effort: c.effort, proxyURL: c.proxyURL || undefined, dangerouslyAllowBrowser: true, world });
        voices.clear(); voices.set(sig, voice);
        return ok(voice);
      } catch (e) { return fail('error', `Claude could not be set up: ${errorText(e)}`, { module: 'llm' }); }
    },

    /** A new append-only Claude conversation history (llm.History), or a plain array without the bridge. */
    history() { return mods.llm && typeof mods.llm.History === 'function' ? new mods.llm.History() : []; },

    /**
     * Reflect a finished Claude conversation into the NPC's mind (Result of the reflection): llm.reflect, then
     * applyReflection (the mind's own when it has one). `t` is the simulated time the memories carry.
     */
    async reflect(id, transcript, settings, { t } = {}) {
      const v = svc.voice(settings);
      if (!v.ok) return v;
      if (typeof v.value.reflect !== 'function') return missing('llm');
      const p = svc.persona(id, { t, any: true });
      if (!p.ok) return p;
      const time = simTime(t);
      try {
        const result = await v.value.reflect(p.value, transcript);
        const m = mods.mind ? svc.mind(id) : null;
        if (m && m.ok && result) {
          if (typeof m.value.applyReflection === 'function') m.value.applyReflection(result, time);
          else applyReflection(m.value, result, time);
          svc.saveMind(id);
        }
        return ok(result);
      } catch (e) { return fail('error', errorText(e), { module: 'llm' }); }
    },

    /**
     * The Claude system prompt for an NPC (Result): `{blocks, text, situation}`: llm.systemBlocks, the blocks as one
     * text, and the situation note a turn at time t would carry (after `said`, the player's last line, whose recalled
     * memories it lists).
     */
    prompt(id, { t, said = '' } = {}) {
      if (!mods.llm || typeof mods.llm.systemBlocks !== 'function') return missing('llm');
      const time = simTime(t);
      const p = svc.persona(id, { t: time });
      if (!p.ok) return p;
      try {
        const raw = mods.llm.systemBlocks(p.value, world);
        const blocks = (Array.isArray(raw) ? raw : [raw]).map(b => (typeof b === 'string' ? { type: 'text', text: b } : b)).filter(Boolean);
        let situation = '';
        if (typeof mods.llm.situation === 'function') {
          const npc = svc.npc(id);
          const m = mods.mind ? svc.mind(id, { t: time }) : null;
          const a = mods.schedule ? svc.activityAt(id, time) : null;
          const mind = m && m.ok ? m.value : null;
          const recalled = said && typeof mods.llm.recallFor === 'function' ? mods.llm.recallFor(mind, said, time) : [];
          situation = mods.llm.situation(p.value, mind, { t: time, weather: npc ? svc.weather(npc.zi, time) : null, activity: a && a.ok ? a.value : undefined, recalled, world });
        }
        return ok({ blocks, text: blocks.map(b => b.text || '').join('\n\n'), situation });
      } catch (e) { return fail('error', `The prompt could not be built: ${errorText(e)}`, { module: 'llm' }); }
    },

    /** The game-engine export of an NPC (persona, system prompt, voice settings), for the chosen model and effort (Result). */
    exportPersona(id, settings = {}) {
      if (!mods.llm || typeof mods.llm.exportPersona !== 'function') return missing('llm');
      const p = svc.persona(id);
      if (!p.ok) return p;
      const c = settings.claude || {};
      try { return ok(mods.llm.exportPersona(p.value, world, { model: c.model, effort: c.effort })); } catch (e) { return fail('error', errorText(e), { module: 'llm' }); }
    },

    /** Check the key (or proxy) and model without spending tokens: Result of `{model, label, latencyMs}`. */
    async pingVoice(settings) {
      const v = svc.voice(settings);
      if (!v.ok) return v;
      if (typeof v.value.ping !== 'function') return ok({ model: (settings.claude || {}).model, label: '', latencyMs: null });
      try {
        const r = await v.value.ping();
        return r && r.ok === false ? fail('error', r.message || 'Claude did not answer.', { module: 'llm', code: r.code }) : ok(r);
      } catch (e) { return fail('error', errorText(e), { module: 'llm' }); }
    },

    // ---------------------------------------------------------------- the day

    /** The NPC's plan for the Pacific day holding t (Result). */
    dayPlan(id, t) {
      if (!mods.schedule) return missing('schedule');
      const p = svc.persona(id, { t, any: true });
      if (!p.ok) return p;
      try { return ok(mods.schedule.dayPlan(svc.npc(id), p.value, simTime(t))); } catch (e) { return fail('error', errorText(e), { module: 'schedule' }); }
    },

    /** What the NPC is doing at time t (Result). */
    activityAt(id, t) {
      if (!mods.schedule) return missing('schedule');
      const p = svc.persona(id, { t, any: true });
      if (!p.ok) return p;
      try { return ok(mods.schedule.activityAt(svc.npc(id), p.value, simTime(t))); } catch (e) { return fail('error', errorText(e), { module: 'schedule' }); }
    },

    // ---------------------------------------------------------------- the street

    /**
     * A bubble line for the street view: what A says to B (context from the street simulation), or B's answer once A
     * has spoken (context.replyTo). An exchange comes from the dialogue's barkBetween, so the two lines agree (a
     * greeting gets a greeting, a question an answer, Spanish gets Spanish); the answer is kept until B is asked for
     * it. Falls back to bark() alone, and to null (a moment that passes in silence).
     * @returns {{text: string, gloss: string|null}|null}
     */
    bark(idA, idB, context = {}) {
      if (!mods.dialogue || !mods.persona) return null;
      const t = simTime(context.t);
      const minute = Math.floor(t / 60000);
      if (context.replyTo) {
        // the answer kept for this pair: B is asked a moment (in real time) after A spoke, and at 3600x a moment is
        // an hour of simulated time, so the pair is matched in real time, or by the simulated minute A spoke in
        const key = `${idA}|${idB}`;
        const kept = barks.get(key);
        barks.delete(key);
        if (kept && (realNow() - kept.at <= BARK_REPLY_MS || Math.abs(kept.minute - minute) <= 5)) return kept.line;
      }
      const a = svc.persona(idA, { t, any: true }), b = idB ? svc.persona(idB, { t, any: true }) : null;
      if (!a.ok) return null;
      const ctx = { t, situation: context.situation || (b && b.ok ? 'pass' : 'wait') };
      try {
        if (b && b.ok && typeof mods.dialogue.barkBetween === 'function' && !context.replyTo) {
          const [lineA, lineB] = mods.dialogue.barkBetween(wxWorld(), a.value, b.value, ctx);
          if (lineB) { barks.set(`${idB}|${idA}`, { minute, at: realNow(), line: lineB }); if (barks.size > 200) barks.delete(barks.keys().next().value); }
          if (lineA) return lineA;
          return null;
        }
        return typeof mods.dialogue.bark === 'function' ? mods.dialogue.bark(wxWorld(), a.value, Object.assign({ other: b && b.ok ? b.value : null }, ctx)) : null;
      } catch { return null; }
    },

    /**
     * A StreetView on a canvas (Result). The world and population, the plan of every resident (schedule.activityAt
     * with their persona), the bubbles (bark above) and the persona lookup are filled in; other options (getTime,
     * allowNetwork, onSelect, theme ...) pass through.
     */
    streetView(canvas, opts = {}) {
      if (!mods.street || typeof mods.street.StreetView !== 'function') return missing('street');
      needWorld();
      try {
        const personaOf = id => { const p = svc.persona(id, { any: true }); return p.ok ? p.value : null; };
        const planFor = mods.schedule && mods.persona ? (id, t) => {
          const npc = population.get(id), p = personaOf(id);
          return npc && p ? mods.schedule.activityAt(npc, p, t) : null;
        } : null;
        return ok(new mods.street.StreetView(canvas, {
          world, population,
          persona: mods.persona ? personaOf : null,
          planFor,
          bark: mods.dialogue && mods.persona ? (a, b, ctx) => svc.bark(a, b, ctx) : null,
          schedule: mods.schedule || null,
          dialogue: mods.dialogue || null,
          ...opts,
        }));
      } catch (e) { return fail('error', `Street view could not start: ${errorText(e)}`, { module: 'street' }); }
    },

    // ---------------------------------------------------------------- settings lists

    /**
     * Claude models for Settings: `[{id, label, note, description, price}]`. `note` is a short tag for the menu,
     * `description` the bridge's longer note and `price` its {input, output} dollars per million tokens, when wired.
     */
    models() {
      const list = mods.llm && mods.llm.MODELS;
      if (!list) return CLAUDE_MODELS.map(m => ({ ...m, description: '', price: null }));
      const known = new Map(CLAUDE_MODELS.map(m => [m.id, m]));
      const items = Array.isArray(list) ? list : Object.entries(list).map(([id, v]) => (v && typeof v === 'object' ? { id, ...v } : { id, label: String(v) }));
      return items.map(m => {
        const o = typeof m === 'object' && m ? m : {};
        const id = typeof m === 'string' ? m : (o.id || o.model);
        const base = known.get(id) || {};
        const description = typeof o.note === 'string' && o.note !== base.note ? o.note : '';
        return { id, label: o.label || o.name || o.displayName || base.label || id, note: base.note || '', description, price: o.price && Number.isFinite(o.price.input) ? { input: o.price.input, output: o.price.output } : null };
      }).filter(m => m.id);
    },

    /** Effort levels for Settings. */
    efforts() { return [...CLAUDE_EFFORTS]; },

    /** The name of a lexicon dialect key ('sfv' → 'San Fernando Valley'), or null for an unknown key. */
    dialectName(key) {
      const d = key && lexiconModule.DIALECTS && Object.hasOwn(lexiconModule.DIALECTS, key) ? lexiconModule.DIALECTS[key] : null;
      return d && d.name ? d.name : null;
    },
  };
  return svc;
}

/** The app's shared registry. */
export const services = createServices();
