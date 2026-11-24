// Legion · the app's event bus.
//
// Panels, the map, the clock and the settings talk through named events rather than holding references to each
// other, so a module can be added (the street view, the dialogue engine) or replaced without touching its
// neighbours. A listener that throws is reported and skipped; it never stops the others from hearing the event.

/**
 * The events the app emits (CONTRACTS.md section 10) and their payloads:
 * - `npc:select` `{id, source}`: an NPC was chosen (map click, resident list, search, street view); `id` null clears.
 * - `npc:hover` `{id, mode}`: the pointer is over an agent (`id` null when it leaves).
 * - `view:change` `{mode, x, y, zoom}`: the camera moved (`mode` 'map' or 'street').
 * - `time:change` `{t, speed, playing}`: the simulation clock changed (epoch ms).
 * - `settings:change` `{settings, changed}`: settings changed (the API key is never in the payload).
 * - `place:select` `{zi, kind, key}`: a place was chosen (`zi` for a ZIP; `kind` 'zip' | 'city' | 'county' | 'region').
 * - `weather:change` `{zi, status?}`: live NWS weather for ZIP zi arrived or failed (status: services.weatherStatus), or
 *   the live layer was switched on or off (`zi` -1).
 */
export const EVENTS = Object.freeze({
  NPC_SELECT: 'npc:select',
  NPC_HOVER: 'npc:hover',
  VIEW_CHANGE: 'view:change',
  TIME_CHANGE: 'time:change',
  SETTINGS_CHANGE: 'settings:change',
  PLACE_SELECT: 'place:select',
  WEATHER_CHANGE: 'weather:change',
});

/**
 * Create an independent bus.
 * @param {{onError?: (error: unknown, event: string) => void}} [options] where listener errors go (default console.error)
 * @returns {{on: (event: string, fn: Function) => () => void, off: (event: string, fn: Function) => void,
 *   once: (event: string, fn: Function) => () => void, emit: (event: string, payload?: any) => number,
 *   count: (event?: string) => number, clear: () => void}}
 */
export function createBus({ onError } = {}) {
  const listeners = new Map();
  const report = onError || ((error, event) => { if (typeof console !== 'undefined') console.error(`[legion] listener for ${event} failed`, error); });

  /** Subscribe; returns the unsubscribe function. `'*'` hears every event as (payload, event). */
  function on(event, fn) {
    if (typeof fn !== 'function') throw new TypeError('bus.on needs a function');
    let set = listeners.get(event);
    if (!set) listeners.set(event, set = new Set());
    set.add(fn);
    return () => off(event, fn);
  }

  /** Unsubscribe a listener added with on() or once(). */
  function off(event, fn) {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(fn);
    for (const wrapped of set) if (wrapped.__original === fn) set.delete(wrapped);
    if (!set.size) listeners.delete(event);
  }

  /** Subscribe for one delivery only. */
  function once(event, fn) {
    const wrapped = (payload, name) => { off(event, wrapped); fn(payload, name); };
    wrapped.__original = fn;
    return on(event, wrapped);
  }

  /** Deliver payload to the event's listeners, then to '*' listeners. Returns how many were called. */
  function emit(event, payload) {
    let n = 0;
    for (const key of [event, '*']) {
      const set = listeners.get(key);
      if (!set) continue;
      for (const fn of [...set]) {
        n++;
        try { fn(payload, event); } catch (error) { report(error, event); }
      }
    }
    return n;
  }

  /** Number of listeners for one event, or for all events. */
  function count(event) {
    if (event !== undefined) return listeners.has(event) ? listeners.get(event).size : 0;
    let n = 0; for (const set of listeners.values()) n += set.size; return n;
  }

  /** Remove every listener. */
  function clear() { listeners.clear(); }

  return { on, off, once, emit, count, clear };
}

/** The app's shared bus. */
export const bus = createBus();

/** Subscribe to the shared bus; returns the unsubscribe function. */
export const on = bus.on;
/** Unsubscribe from the shared bus. */
export const off = bus.off;
/** Subscribe to the shared bus for one delivery. */
export const once = bus.once;
/** Emit on the shared bus. */
export const emit = bus.emit;
