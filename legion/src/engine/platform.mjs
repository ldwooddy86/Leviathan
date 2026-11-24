// Legion · the platform: every Californian through one object, in Node and in the browser.
//
//   import { createLegion } from './src/engine/platform.mjs';
//   const legion = await createLegion();                        // Node: data/world.json.gz; or {pack, seed, store}
//   const [npc] = legion.sample('Oakland', 1);                  // a ZIP, city, county, region key, or 'CA'
//   const p = legion.persona(npc.id);                           // Big Five, values, concerns, memories, voice
//   const conv = legion.conversation(npc.id);                   // the offline dialogue engine, with the NPC's mind
//   conv.greet().text; conv.reply('How was the fire?').text; conv.farewell(); legion.saveMind(npc.id);
//   const voice = legion.voice({ apiKey });                     // Claude (llm.ClaudeVoice), the world passed in
//   legion.dayPlan(npc.id, Date.UTC(2026, 10, 24, 16));        // the NPC's day, minute by minute
//   legion.weather('94110');                                    // the NWS snapshot for a ZIP
//
// Everything is the engine's own modules behind CONTRACTS section 11: the world (world.mjs), the population with
// its seed (population.mjs), personas with the lexicon's dialects (persona.mjs, lexicon.mjs), minds kept in a
// pluggable store (mind.mjs: MemoryStore by default, FileStore in Node, LocalStorageStore in a page), schedules,
// the offline dialogue engine and the Claude bridge. It is deterministic like the engine: the same pack and seed
// give the same people, personas, plans and offline lines; times default to the NWS snapshot, never the clock.

import { loadPack, createWorld, loadDefaultWorld } from './world.mjs';
import { Population, LEGION_SEED, parseId } from './population.mjs';
import { persona as buildPersona } from './persona.mjs';
import { Mind, MemoryStore } from './mind.mjs';
import { dayPlan as planDay, activityAt as activityOf } from './schedule.mjs';
import { Conversation, bark as barkLine, barkBetween } from './dialogue.mjs';
import { ClaudeVoice, systemBlocks, systemPrompt, exportPersona as exportFor, situation as situationNote, recallFor } from './llm.mjs';
import { dialectFor } from './lexicon.mjs';
import { Rng, Alias, hashAll } from './rng.mjs';
import * as clock from './clock.mjs';

/** Bumped when the facade's shape changes. */
export const PLATFORM_VERSION = 1;

const HOUR = 3600000;
const isNode = () => typeof process !== 'undefined' && !!(process.versions && process.versions.node);
const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * What a place name or key refers to: {kind: 'zip'|'city'|'place'|'county'|'region'|'state', key, title, zis}.
 * Accepts a ZIP ('94110' or its index), 'CA' / 'California' (the whole state), a region key or name ('ba', 'Bay
 * Area'), a county FIPS or name ('06001', 'Alameda', 'Alameda County'), a postal city ('Oakland') or a Census place
 * ('East Los Angeles'). A name that is both a city and a county is the city unless it says "County".
 * @param {import('./world.mjs').World} world
 * @param {string|number} where
 * @returns {{kind: string, key: string, title: string, zis: number[]} | null}
 */
export function resolvePlace(world, where) {
  if (where === null || where === undefined || where === '') return null;
  if (typeof where === 'number' && Number.isInteger(where) && where >= 0 && where < world.N) return { kind: 'zip', key: world.zips[where], title: world.z.city[where], zis: [where] };
  const raw = String(where).trim(), q = norm(raw);
  if (/^\d{5}$/.test(raw)) {
    const zi = world.indexOf(raw);
    if (zi >= 0) return { kind: 'zip', key: raw, title: `${world.z.city[zi]} ${raw}`, zis: [zi] };
    if (/^06\d{3}$/.test(raw)) {
      const c = world.countyByFips.get(raw);
      if (c) return { kind: 'county', key: c.fips, title: `${c.name} County`, zis: world.zipsOfCounty(c.index) };
    }
    return null;
  }
  if (['ca', 'california', 'state', 'all', 'statewide'].includes(q)) return { kind: 'state', key: 'CA', title: 'California', zis: Array.from({ length: world.N }, (_, i) => i) };
  const region = world.regions.find(r => r.key === q || norm(r.name) === q || norm(r.the) === q);
  if (region) return { kind: 'region', key: region.key, title: region.name, zis: world.zipsOfRegion(region.key) };
  const countyName = q.replace(/\s+county$/, '');
  const saysCounty = /\scounty$/.test(q);
  const county = world.counties.find(c => norm(c.name) === countyName);
  if (county && saysCounty) return { kind: 'county', key: county.fips, title: `${county.name} County`, zis: world.zipsOfCounty(county.index) };
  const city = (world.pack.cities || []).find(c => c && norm(c[0]) === q);
  if (city) {
    const zis = (city[3] || []).map(z => world.indexOf(z)).filter(i => i >= 0);
    if (zis.length) return { kind: 'city', key: city[0], title: city[0], zis };
  }
  const placeZips = [];
  for (let i = 0; i < world.N; i++) if (norm(world.z.place[i]) === q || norm(world.z.city[i]) === q) placeZips.push(i);
  if (placeZips.length) return { kind: 'place', key: raw, title: raw, zis: placeZips };
  if (county) return { kind: 'county', key: county.fips, title: `${county.name} County`, zis: world.zipsOfCounty(county.index) };
  return null;
}

/**
 * Create the platform: a world, a population, and every engine module behind one object.
 * @param {{pack?: object|string|Uint8Array|ArrayBuffer, world?: object, seed?: number, store?: {get: Function, put: Function},
 *   t?: number}} [options]
 *   pack: anything world.loadPack takes (a parsed pack, JSON text, gzip bytes, base64 gzip, a path or URL); omitted,
 *   the page's inline pack (window.__LEGION_PACK__) in a browser, data/world.json.gz in Node. world: an already
 *   created World instead. seed: the population seed (default LEGION_SEED, 1849). store: where minds persist
 *   (mind.mjs MemoryStore by default; FileStore in Node, LocalStorageStore in a page). t: the default time of every
 *   call that takes one (default the NWS snapshot time).
 * @returns {Promise<Legion>}
 */
export async function createLegion(options = {}) {
  const o = options && typeof options === 'object' ? options : {};
  let world = o.world && typeof o.world.zip === 'function' ? o.world : null;
  if (!world) {
    let pack = o.pack;
    if (pack === undefined || pack === null) {
      const inline = typeof globalThis !== 'undefined' ? globalThis.__LEGION_PACK__ : undefined;
      if (typeof inline === 'string' && inline) pack = inline;
      else if (isNode()) world = await loadDefaultWorld();
      else throw new Error('createLegion: pass {pack} (the world pack: an object, bytes, base64 or a URL) in a browser');
    }
    if (!world) world = createWorld(await loadPack(pack));
  }
  return new Legion(world, o);
}

/**
 * The facade createLegion returns (CONTRACTS section 11). Methods that take an id throw a clear Error for an id
 * that names no one; npc() returns null instead.
 */
export class Legion {
  /**
   * @param {import('./world.mjs').World} world
   * @param {{seed?: number, store?: {get: Function, put: Function}, t?: number}} [options]
   */
  constructor(world, { seed = LEGION_SEED, store = null, t = null } = {}) {
    /** The World. */
    this.world = world;
    /** The Population. */
    this.population = new Population(world, { seed });
    /** The population seed. */
    this.seed = this.population.seed;
    /** Where minds persist (MindStore: get(id), put(id, state)). */
    this.store = store && typeof store.get === 'function' && typeof store.put === 'function' ? store : new MemoryStore();
    /** The default time of every call (epoch ms). */
    this.t = Number.isFinite(t) ? t : world.snapshotTime;
    /** Pacific time helpers (clock.mjs). */
    this.clock = clock;
    this._personas = new Map();
    this._minds = new Map();
  }

  _time(t) { return Number.isFinite(t) ? t : this.t; }

  _need(id) {
    const npc = this.npc(id);
    if (!npc) throw new Error(`No NPC has the id ${id}: ids look like "94110-123-0" (ZIP, household, member)`);
    return npc;
  }

  /** The NPC (layer 1, CONTRACTS section 5) for an id "94110-123-0" (a household id gives its householder), or null. */
  npc(id) {
    try { return id ? this.population.get(String(id)) : null; } catch { return null; }
  }

  /** {zip, zi, h, m} of an id, or null. */
  parseId(id) { return parseId(id, this.world); }

  /**
   * The persona of an NPC for the hour holding t (CONTRACTS section 6): persona(world, npc, {population, dialectFor,
   * t}). Cached per id and hour; the weather and alerts of that hour shape its concerns and hooks.
   * @param {string} id
   * @param {{t?: number}} [opts]
   */
  persona(id, { t } = {}) {
    const npc = this._need(id);
    const hour = Math.floor(this._time(t) / HOUR) * HOUR;
    const key = `${npc.id}|${hour}`;
    let p = this._personas.get(key);
    if (p) { this._personas.delete(key); this._personas.set(key, p); return p; }
    p = buildPersona(this.world, npc, { population: this.population, dialectFor, t: hour });
    this._personas.set(key, p);
    if (this._personas.size > 512) this._personas.delete(this._personas.keys().next().value);
    return p;
  }

  /**
   * The NPC's Mind (CONTRACTS section 6), restored from the store on first use and kept live for this platform;
   * call saveMind(id) to persist it. With t, the mind is advanced to that time (weather and activity there).
   * @param {string} id
   * @param {{t?: number}} [opts]
   * @returns {Mind}
   */
  mind(id, { t } = {}) {
    const npc = this._need(id);
    let m = this._minds.get(npc.id);
    if (!m) {
      const p = this.persona(npc.id, { t });
      let state = null;
      try { state = this.store.get(npc.id); } catch { state = null; }
      m = new Mind(p, state ? { state } : { t: this._time(t) });
      this._minds.set(npc.id, m);
      if (this._minds.size > 256) { const [old] = this._minds.keys(); this.saveMind(old); this._minds.delete(old); }
    }
    if (Number.isFinite(t)) {
      try { m.tick(t, { weather: this.world.weatherAt(npc.zi, t), activity: this.activityAt(npc.id, t) }); } catch { /* the stored state stands */ }
    }
    return m;
  }

  /** Persist an NPC's live mind to the store; true when saved. */
  saveMind(id) {
    const m = this._minds.get(String(id));
    if (!m) return false;
    try { return this.store.put(String(id), m.toJSON()) !== false; } catch { return false; }
  }

  /** Forget an NPC's mind, live and stored. */
  forgetMind(id) {
    this._minds.delete(String(id));
    if (typeof this.store.delete === 'function') this.store.delete(String(id));
  }

  /**
   * A new offline Conversation (CONTRACTS section 7) with the NPC's mind, at time t: greet(), reply(text) and
   * farewell() give Lines {text, gloss, intent, topics, emotion, facts}. Save the mind afterwards to remember it.
   * @param {string} id
   * @param {{t?: number, rngSeed?: number}} [opts]
   */
  conversation(id, { t, rngSeed } = {}) {
    const npc = this._need(id);
    const time = this._time(t);
    const persona = this.persona(npc.id, { t: time });
    const mind = this.mind(npc.id, { t: time });
    return new Conversation({ world: this.world, persona, mind, t: time, rngSeed: rngSeed ?? hashAll(npc.id, Math.floor(time / 60000)), population: this.population });
  }

  /**
   * A Claude voice (llm.ClaudeVoice) with this world: options as ClaudeVoice takes them ({apiKey, model, effort,
   * proxyURL, client, ...}). In Node without an apiKey the SDK finds the credential itself (ANTHROPIC_API_KEY, or a
   * profile from `ant auth login`). Then voice.stream(legion.persona(id), legion.mind(id), history, text, {t, weather}).
   * @param {object} [options]
   * @returns {ClaudeVoice}
   */
  voice(options = {}) { return new ClaudeVoice({ ...(options || {}), world: this.world }); }

  /**
   * After a Claude conversation: the NPC reflects on it (voice.reflect, structured output) and the mind stores what
   * they made of it (Mind.applyReflection), then the mind is saved. Resolves with the reflection.
   * @param {string} id
   * @param {ClaudeVoice} voice
   * @param {object} transcript a llm.History (or the messages array a voice kept)
   * @param {{t?: number, signal?: AbortSignal}} [opts]
   */
  async reflect(id, voice, transcript, { t, signal } = {}) {
    const time = this._time(t);
    const p = this.persona(id, { t: time });
    const r = await voice.reflect(p, transcript, signal ? { signal } : {});
    this.mind(p.id).applyReflection(r, time);
    this.saveMind(p.id);
    return r;
  }

  /**
   * The Claude system prompt of an NPC: {blocks (llm.systemBlocks, with their cache breakpoints), text, situation}
   * where situation is the note a turn at time t would carry.
   * @param {string} id
   * @param {{t?: number}} [opts]
   */
  prompt(id, { t } = {}) {
    const time = this._time(t);
    const p = this.persona(id, { t: time }), npc = p.npc;
    const blocks = systemBlocks(p, this.world);
    return {
      blocks, text: systemPrompt(p, this.world),
      situation: situationNote(p, this._minds.get(npc.id) || null, { t: time, weather: this.world.weatherAt(npc.zi, time), activity: this.activityAt(npc.id, time), world: this.world }),
    };
  }

  /**
   * The situation note of one turn with an NPC at time t (llm.situation), for an engine that runs the turns itself:
   * the local time, what they are doing (their day plan), the weather and alerts, their mood and how they feel about
   * the player, and the memories the player's words bring up (opts.said, read through their mind). The same note
   * prompt(id, {t}).situation carries.
   * @param {string} id
   * @param {number} [t]
   * @param {{said?: string}} [opts]
   * @returns {string}
   */
  situation(id, t, { said } = {}) {
    const time = this._time(t);
    const p = this.persona(id, { t: time }), npc = p.npc;
    const mind = this._minds.get(npc.id) || null;
    const recalled = mind && typeof said === 'string' && said.trim() ? recallFor(mind, said, time) : [];
    return situationNote(p, mind, { t: time, weather: this.world.weatherAt(npc.zi, time), activity: this.activityAt(npc.id, time), recalled, world: this.world });
  }

  /**
   * The game-engine export of an NPC (llm.exportPersona: persona, system prompt, request defaults, voice, and for the
   * day holding options.t, default the platform's time, the day plan, the mind's initial state and the situation
   * template).
   */
  exportPersona(id, options = {}) {
    const o = options && typeof options === 'object' ? options : {};
    const time = this._time(o.t);
    return exportFor(this.persona(id, { t: time }), this.world, { ...o, t: time });
  }

  /**
   * n distinct NPCs of a place, uniform over its people: a ZIP, a postal city or Census place, a county, a region
   * key or name, or 'CA' (see resolvePlace). Deterministic for (where, n, seed); a smaller n is not always a
   * prefix of a larger one across several ZIPs.
   * @param {string|number} where
   * @param {number} [n]
   * @param {{seed?: number}} [opts]
   * @returns {object[]} NPCs
   */
  sample(where, n = 10, { seed = 1 } = {}) {
    const scope = resolvePlace(this.world, where);
    if (!scope) throw new Error(`Unknown place "${where}": use a ZIP, a city, a county, a region key (${this.world.regions.map(r => r.key).join(' ')}) or CA`);
    const count = Math.max(0, Math.floor(Number(n) || 0));
    if (!count) return [];
    const pop = this.population;
    if (scope.kind === 'state') return pop.sampleState(count, seed);
    if (scope.zis.length === 1) return pop.sample(scope.zis[0], count, seed);
    // ZIPs in proportion to their household population, then a person of the ZIP, each distinct
    const zis = scope.zis.filter(i => pop.householdCount(i) > 0);
    if (!zis.length) return [];
    // a ZIP whose household size the pack leaves out still has people: weigh it by its households at the scope's
    // mean size rather than not at all
    const expected = zis.map(i => pop.expectedPersons(i));
    let persons = 0, households = 0;
    zis.forEach((i, k) => { if (expected[k] > 0) { persons += expected[k]; households += pop.householdCount(i); } });
    const meanSize = households > 0 ? persons / households : 2.8;
    const alias = new Alias(zis.map((i, k) => (expected[k] > 0 ? expected[k] : pop.householdCount(i) * meanSize)));
    const rng = new Rng(hashAll('legion.sample', scope.kind, scope.key, seed));
    const out = [], seen = new Set();
    for (let tries = 0; out.length < count && tries < count * 20 + 50; tries++) {
      const zi = zis[alias.draw(rng)];
      const [npc] = pop.sample(zi, 1, rng.next());
      if (npc && !seen.has(npc.id)) { seen.add(npc.id); out.push(npc); }
    }
    return out;
  }

  /** What a place name refers to (resolvePlace). */
  resolve(where) { return resolvePlace(this.world, where); }

  /** The NPC's plan for the Pacific day holding t (schedule.dayPlan). */
  dayPlan(id, t) {
    const npc = this._need(id);
    return planDay(npc, this.persona(npc.id, { t }), this._time(t));
  }

  /** What the NPC is doing at t, with their position while traveling (schedule.activityAt). */
  activityAt(id, t) {
    const npc = this._need(id);
    return activityOf(npc, this.persona(npc.id, { t }), this._time(t));
  }

  /**
   * The weather of a ZIP at time t (world.weatherAt: the NWS snapshot, a climate estimate past the forecast).
   * @param {string|number} zip a ZIP code or index
   * @param {number} [t]
   */
  weather(zip, t) {
    const zi = typeof zip === 'number' ? zip : this.world.indexOf(String(zip).trim());
    if (!(zi >= 0 && zi < this.world.N)) throw new Error(`Unknown ZIP "${zip}"`);
    return this.world.weatherAt(zi, this._time(t));
  }

  /**
   * A street-corner exchange between two NPCs (dialogue.barkBetween): [what A says, what B answers], either null.
   * With one id, a line on their own (dialogue.bark).
   */
  bark(idA, idB = null, { t, situation } = {}) {
    const time = this._time(t);
    const a = this.persona(idA, { t: time });
    if (!idB) return barkLine(this.world, a, { t: time, situation });
    return barkBetween(this.world, a, this.persona(idB, { t: time }), { t: time, situation });
  }
}
