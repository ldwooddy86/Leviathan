// Legion · services: the app's one door to the engine.
//
// The page never imports an engine module directly. It asks this registry, which holds the world, the
// population and the clock, builds the map and the crowd, and exposes named hooks for the modules that arrive
// with later builds (persona, mind, schedule, dialogue, the Claude bridge, the street view). Each hook returns a
// Result: `{ok: true, value}` or `{ok: false, reason, module, message}` with a sentence the UI can show as is,
// so every panel renders both states and wiring a module in is a one-line change below.

import { loadPack, createWorld } from '../engine/world.mjs';
import { Population, LEGION_SEED, parseId } from '../engine/population.mjs';
import * as clock from '../engine/clock.mjs';
import { hashAll } from '../engine/rng.mjs';
import { MapView } from '../world/map.mjs';
import { Crowd } from '../world/crowd.mjs';
import { MemoryMindStore } from './store.mjs';
import { fidelityTables, residentsOf } from './census.mjs';

// ------------------------------------------------------------------ integration point
// Each line is a module that arrives with a later build. To wire one in, replace its `null` line with the
// import in its comment (imports are hoisted, so the line can stay where it is). Nothing else changes: the hooks
// below check for the module and the UI already renders both states.
const personaModule = null;   // import * as personaModule from '../engine/persona.mjs';
const mindModule = null;      // import * as mindModule from '../engine/mind.mjs';
const scheduleModule = null;  // import * as scheduleModule from '../engine/schedule.mjs';
const dialogueModule = null;  // import * as dialogueModule from '../engine/dialogue.mjs';
const llmModule = null;       // import * as llmModule from '../engine/llm.mjs';
const streetModule = null;    // import * as streetModule from '../world/street.mjs';

/** The engine modules the app can use, what each gives the page, and the sentence shown until it is wired. */
export const ENGINE_MODULES = Object.freeze([
  { key: 'persona', file: 'src/engine/persona.mjs', title: 'Personality', provides: 'Big Five, values, interests, concerns, memories of local events, speech style, bio', pending: 'Personalities arrive with the next build.' },
  { key: 'mind', file: 'src/engine/mind.mjs', title: 'Mind', provides: 'mood, needs, a memory stream and the relationship with you', pending: 'Minds (mood, needs, memories) arrive with the next build.' },
  { key: 'schedule', file: 'src/engine/schedule.mjs', title: 'Daily schedule', provides: 'each NPC’s day plan and what they are doing right now', pending: 'Daily schedules arrive with the next build.' },
  { key: 'dialogue', file: 'src/engine/dialogue.mjs', title: 'Offline dialogue', provides: 'conversation in the NPC’s regional voice, no network needed', pending: 'The offline dialogue engine arrives with the next build.' },
  { key: 'llm', file: 'src/engine/llm.mjs', title: 'Claude bridge', provides: 'system prompts, streaming conversation with Claude, reflection into memory', pending: 'The Claude bridge arrives with the next build.' },
  { key: 'street', file: 'src/world/street.mjs', title: 'Street view', provides: 'the neighborhood up close: residents on the sidewalks and streets, chatting', pending: 'Street view arrives with the next build.' },
]);

/** Claude models offered in Settings (the Claude bridge's MODELS list replaces this once it is wired). */
export const CLAUDE_MODELS = Object.freeze([
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Default' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Faster' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'Fastest, lowest cost' },
  { id: 'claude-fable-5-2', label: 'Claude Fable 5.2', note: 'Most capable, slower' },
]);

/** Effort levels offered for conversation (low is the default). */
export const CLAUDE_EFFORTS = Object.freeze(['low', 'medium', 'high']);

const DEFAULT_MODULES = Object.freeze({
  persona: personaModule, mind: mindModule, schedule: scheduleModule, dialogue: dialogueModule, llm: llmModule, street: streetModule,
});

/** @typedef {{ok: true, value: any} | {ok: false, reason: 'missing'|'needs-key'|'needs-permission'|'not-found'|'error', module?: string, message: string}} Result */

const ok = value => ({ ok: true, value });
const fail = (reason, message, extra = {}) => ({ ok: false, reason, message, ...extra });

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
 *   PopulationClass?: Function, seed?: number}} [options]
 */
export function createServices(options = {}) {
  const mods = { ...DEFAULT_MODULES, ...(options.modules || {}) };
  const MapViewClass = options.MapViewClass || MapView;
  const CrowdClass = options.CrowdClass || Crowd;
  const PopulationClass = options.PopulationClass || Population;
  let world = null, population = null, store = options.mindStore || new MemoryMindStore();
  const personas = new Map();   // id -> persona (LRU)
  const minds = new Map();      // id -> live Mind for this session
  const voices = new Map();     // settings signature -> ClaudeVoice

  const pendingMessage = key => (ENGINE_MODULES.find(m => m.key === key) || {}).pending || `${key} is not available yet.`;
  const missing = key => fail('missing', pendingMessage(key), { module: key });
  const needWorld = () => { if (!world || !population) throw new Error('services: the world is not loaded yet'); };

  const svc = {
    clock,
    parseId,

    /** The loaded World (null before init). */
    get world() { return world; },
    /** The Population (null before init). */
    get population() { return population; },
    /** The population seed. */
    get seed() { return population ? population.seed : (options.seed ?? LEGION_SEED); },

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
      personas.clear(); minds.clear(); voices.clear();
      return { world, population };
    },

    /** Swap the MindStore (the app uses a localStorage one). */
    setMindStore(next) { if (next && typeof next.get === 'function' && typeof next.put === 'function') store = next; },

    /** Every engine module with whether it is wired: `[{key, file, title, provides, pending, available}]`. */
    status() { return ENGINE_MODULES.map(m => ({ ...m, available: !!mods[m.key] })); },

    /** True when the engine module `key` is wired. */
    available(key) { return !!mods[key]; },

    /** The statewide map (MapView) in a container. */
    createMap(container, { theme = 'dark' } = {}) { needWorld(); return new MapViewClass(container, { world, theme }); },

    /** The GPU crowd over a map. */
    createCrowd(map, { rate, seed } = {}) { needWorld(); return new CrowdClass(map, { world, population, rate, seed: seed ?? population.seed }); },

    /** The NPC (layer 1) for an id, or null. */
    npc(id) {
      needWorld();
      try { return id ? population.get(String(id)) : null; } catch { return null; }
    },

    /** n residents of a place scope (see census.residentsOf). */
    residents(scope, n = 12, seed = 1) { needWorld(); return residentsOf(population, world, scope, n, seed); },

    /** The weather for ZIP zi at time t, or null when the pack cannot say. */
    weather(zi, t) {
      needWorld();
      try { return world.weatherAt(zi, t); } catch { return null; }
    },

    /** Census versus generated tables for a ZIP, or null when the population reports none. */
    validate(zi, households = 600) {
      needWorld();
      if (typeof population.validate !== 'function') return null;
      try {
        const raw = population.validate(zi, households);
        const tables = fidelityTables(raw);
        return tables.length ? { tables, households, raw } : null;
      } catch { return null; }
    },

    /** The persona of an NPC (Result). */
    persona(id) {
      if (!mods.persona) return missing('persona');
      needWorld();
      if (personas.has(id)) { const p = personas.get(id); personas.delete(id); personas.set(id, p); return ok(p); }
      const npc = svc.npc(id);
      if (!npc) return fail('not-found', `No NPC has the id ${id}.`);
      try {
        const p = mods.persona.persona(world, npc, { population });
        personas.set(id, p);
        if (personas.size > 256) personas.delete(personas.keys().next().value);
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
        const p = svc.persona(id);
        if (!p.ok) return p;
        try {
          const state = store.get(id);
          m = new mods.mind.Mind(p.value, state ? { state } : (Number.isFinite(t) ? { t } : {}));
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

    /** A new offline Conversation with an NPC (Result). */
    conversation(id, { t = Date.now(), rngSeed } = {}) {
      if (!mods.dialogue) return missing('dialogue');
      const p = svc.persona(id);
      if (!p.ok) return p;
      const m = mods.mind ? svc.mind(id, { t }) : null;
      try {
        const conv = new mods.dialogue.Conversation({ world, persona: p.value, mind: m && m.ok ? m.value : null, t, rngSeed: rngSeed ?? hashAll(id, Math.floor(t / 60000)) });
        return ok(conv);
      } catch (e) { return fail('error', `The conversation could not start: ${errorText(e)}`, { module: 'dialogue' }); }
    },

    /**
     * A ClaudeVoice for the current settings (Result). Needs the Claude bridge, the Claude network permission and
     * an API key (or a local proxy URL).
     * @param {{claude?: {apiKey?: string, model?: string, effort?: string, proxyURL?: string}, network?: {claude?: boolean}}} settings
     */
    voice(settings = {}) {
      if (!mods.llm || typeof mods.llm.ClaudeVoice !== 'function') return missing('llm');
      const c = settings.claude || {}, net = settings.network || {};
      if (!net.claude) return fail('needs-permission', 'Allow the Claude API in Settings, under Network, to talk with Claude.', { module: 'llm' });
      if (!c.apiKey && !c.proxyURL) return fail('needs-key', 'Add your Claude API key in Settings to talk with Claude.', { module: 'llm' });
      const sig = [c.apiKey ? hashAll(c.apiKey) : 0, c.model, c.effort, c.proxyURL || ''].join('|');
      if (voices.has(sig)) return ok(voices.get(sig));
      try {
        const voice = new mods.llm.ClaudeVoice({ apiKey: c.apiKey || undefined, model: c.model, effort: c.effort, proxyURL: c.proxyURL || undefined, dangerouslyAllowBrowser: true, world });
        voices.clear(); voices.set(sig, voice);
        return ok(voice);
      } catch (e) { return fail('error', `Claude could not be set up: ${errorText(e)}`, { module: 'llm' }); }
    },

    /**
     * Reflect a finished Claude conversation into the NPC's mind (Result of the reflection). Uses the mind's own
     * applyReflection(result, t) when it has one, else applyReflection() below (public Mind methods only).
     */
    async reflect(id, transcript, settings, { t = Date.now() } = {}) {
      const v = svc.voice(settings);
      if (!v.ok) return v;
      if (typeof v.value.reflect !== 'function') return missing('llm');
      const p = svc.persona(id);
      if (!p.ok) return p;
      try {
        const result = await v.value.reflect(p.value, transcript);
        const m = mods.mind ? svc.mind(id) : null;
        if (m && m.ok && result) {
          if (typeof m.value.applyReflection === 'function') m.value.applyReflection(result, t);
          else applyReflection(m.value, result, t);
          svc.saveMind(id);
        }
        return ok(result);
      } catch (e) { return fail('error', errorText(e), { module: 'llm' }); }
    },

    /** The Claude system prompt for an NPC: `{blocks, text}` from llm.systemBlocks (Result). */
    prompt(id) {
      if (!mods.llm || typeof mods.llm.systemBlocks !== 'function') return missing('llm');
      const p = svc.persona(id);
      if (!p.ok) return p;
      try {
        const raw = mods.llm.systemBlocks(p.value, world);
        const blocks = (Array.isArray(raw) ? raw : [raw]).map(b => (typeof b === 'string' ? { type: 'text', text: b } : b)).filter(Boolean);
        return ok({ blocks, text: blocks.map(b => b.text || '').join('\n\n') });
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

    /** The NPC's plan for the Pacific day holding t (Result). */
    dayPlan(id, t) {
      if (!mods.schedule) return missing('schedule');
      const p = svc.persona(id);
      if (!p.ok) return p;
      try { return ok(mods.schedule.dayPlan(svc.npc(id), p.value, t)); } catch (e) { return fail('error', errorText(e), { module: 'schedule' }); }
    },

    /** What the NPC is doing at time t (Result). */
    activityAt(id, t) {
      if (!mods.schedule) return missing('schedule');
      const p = svc.persona(id);
      if (!p.ok) return p;
      try { return ok(mods.schedule.activityAt(svc.npc(id), p.value, t)); } catch (e) { return fail('error', errorText(e), { module: 'schedule' }); }
    },

    /**
     * A StreetView on a canvas (Result). Options pass through (getTime, allowNetwork, onSelect ...); the world,
     * population and the persona, schedule and dialogue modules are filled in.
     */
    streetView(canvas, opts = {}) {
      if (!mods.street || typeof mods.street.StreetView !== 'function') return missing('street');
      needWorld();
      try {
        return ok(new mods.street.StreetView(canvas, {
          world, population,
          persona: mods.persona ? mods.persona.persona : null,
          schedule: mods.schedule || null,
          dialogue: mods.dialogue || null,
          ...opts,
        }));
      } catch (e) { return fail('error', `Street view could not start: ${errorText(e)}`, { module: 'street' }); }
    },

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
  };
  return svc;
}

/** The app's shared registry. */
export const services = createServices();
