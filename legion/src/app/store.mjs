// Legion · storage that never throws.
//
// localStorage can be missing (Node), blocked (privacy modes, sandboxed frames: even reading the property throws),
// full, or holding something another version wrote. Every access goes through these helpers, each in try/catch,
// so a storage failure degrades to "not remembered" and never breaks the page.

function storage() {
  try { return typeof localStorage !== 'undefined' && localStorage ? localStorage : null; } catch { return null; }
}

/** Read and JSON-parse a key; `fallback` when missing, unreadable or unparsable. */
export function storageGet(key, fallback = null) {
  try {
    const s = storage(); if (!s) return fallback;
    const raw = s.getItem(key);
    return raw === null || raw === undefined ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

/** JSON-stringify and write a key; returns false when the write failed. */
export function storageSet(key, value) {
  try { const s = storage(); if (!s) return false; s.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

/** Remove a key; never throws. */
export function storageRemove(key) {
  try { const s = storage(); if (s) s.removeItem(key); } catch { /* storage unavailable: nothing to remove */ }
}

/** Keys that start with prefix (empty when storage is unavailable). */
export function storageKeys(prefix = '') {
  try {
    const s = storage(); if (!s) return [];
    const out = [];
    for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(prefix)) out.push(k); }
    return out;
  } catch { return []; }
}

/** True when a write and read-back succeed (storage is usable on this device). */
export function storageAvailable() {
  const probe = 'legion.probe';
  try { const s = storage(); if (!s) return false; s.setItem(probe, '1'); const ok = s.getItem(probe) === '1'; s.removeItem(probe); return ok; } catch { return false; }
}

/**
 * The in-memory MindStore (CONTRACTS section 6): `get(id)` returns the saved state or null, `put(id, state)` keeps it.
 */
export class MemoryMindStore {
  constructor() { this.map = new Map(); }
  /** Saved mind state for an NPC id, or null. */
  get(id) { return this.map.has(id) ? this.map.get(id) : null; }
  /** Keep the state; returns true. */
  put(id, state) { this.map.set(id, state); return true; }
  /** Forget one NPC's state. */
  delete(id) { this.map.delete(id); }
  /** Forget every state. */
  clear() { this.map.clear(); }
  /** Ids with saved state. */
  ids() { return [...this.map.keys()]; }
}

/**
 * The app's MindStore: NPC minds (mood, memories, the relationship with the player) kept in localStorage so a
 * conversation picks up where it left off. Keeps at most `limit` minds, evicting the least recently saved, and
 * falls back to memory when storage is unavailable or full.
 */
export class LocalMindStore {
  /** @param {{prefix?: string, limit?: number}} [options] */
  constructor({ prefix = 'legion.mind.', limit = 400 } = {}) {
    this.prefix = prefix;
    this.limit = limit;
    this.memory = new MemoryMindStore();
    this.indexKey = prefix + '__index';
  }
  _index() { const ix = storageGet(this.indexKey, []); return Array.isArray(ix) ? ix : []; }
  /** Saved mind state for an NPC id, or null. */
  get(id) {
    const mem = this.memory.get(id);
    if (mem) return mem;
    const saved = storageGet(this.prefix + id, null);
    if (saved) this.memory.put(id, saved);
    return saved;
  }
  /** Save the state (to storage when possible, always to memory); returns true when it reached storage. */
  put(id, state) {
    this.memory.put(id, state);
    const index = this._index().filter(k => k !== id);
    index.push(id);
    while (index.length > this.limit) storageRemove(this.prefix + index.shift());
    if (storageSet(this.prefix + id, state)) { storageSet(this.indexKey, index); return true; }
    // full: drop the oldest quarter and try once more
    const drop = index.splice(0, Math.max(1, Math.floor(index.length / 4)));
    for (const k of drop) if (k !== id) storageRemove(this.prefix + k);
    if (!index.includes(id)) index.push(id);
    const ok = storageSet(this.prefix + id, state);
    storageSet(this.indexKey, index);
    return ok;
  }
  /** Forget one NPC's state. */
  delete(id) { this.memory.delete(id); storageRemove(this.prefix + id); storageSet(this.indexKey, this._index().filter(k => k !== id)); }
  /** Forget every saved mind. */
  clear() { this.memory.clear(); for (const k of storageKeys(this.prefix)) storageRemove(k); }
  /** Ids with saved state (storage and memory). */
  ids() { return [...new Set([...this._index(), ...this.memory.ids()])]; }
}
