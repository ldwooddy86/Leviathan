// Legion · live weather: an optional refresh from the National Weather Service API, off unless Settings allows it.
//
// The pack carries an NWS snapshot (world.weatherAt). When the player turns on "Live NWS weather", the page asks
// api.weather.gov about the ZIP it is showing: /points/{lat},{lon} for the forecast office and grid, then that
// grid's hourly forecast (and its 12-hour periods, for the "Tonight: ..." text the snapshot also has), and
// /alerts/active?point={lat},{lon}. The answer is adapted into exactly the shape world.weatherAt returns, so every
// reader (the Place panel, the persona, the offline dialogue, the Claude situation note) takes it unchanged.
//
// Each ZIP is cached for 15 minutes (the grid lookup for the session). A live forecast describes the real present:
// it answers only for simulation times its hours cover; any other time, and any failure (offline, a timeout, an
// HTTP error, an answer that does not parse), falls back to the snapshot with a short note saying why.
//
// LiveWeather.world() is the world as live-aware readers see it: the same World with weatherAt answering from
// the live cache where it can. A new one is made each time the cache changes, so caches the engine keeps per
// world object (persona.mjs keys its weather by world and time) never hold a superseded answer.
//
// No DOM here and fetch is injectable, so Node runs it too (the tests pass a fake fetch; nothing reaches the
// network unless a caller enables it and gives it a real fetch).

/** The NWS API origin. */
export const NWS_API = 'https://api.weather.gov';

/** How long a ZIP's live answer is kept before it is fetched again (15 minutes). */
export const LIVE_TTL_MS = 15 * 60 * 1000;

/** How long one request may take before it counts as a failure. */
export const LIVE_TIMEOUT_MS = 9000;

// a simulation time this close to an hourly row reads that hour (the snapshot's own rule in world.weatherAt)
const HOUR_SLACK_MS = 90 * 60 * 1000;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Degrees F from an NWS temperature and its unit ('F', 'C', or a WMO unit code). */
export function toF(value, unit) {
  const v = num(value);
  if (v === null) return null;
  return /C$|degC/i.test(String(unit || '')) ? Math.round(v * 9 / 5 + 32) : Math.round(v);
}

/** The value of an NWS quantitative field ({value, unitCode}) or a bare number; null when missing. */
function quantity(q) { return isObj(q) ? num(q.value) : num(q); }

/** An hourly forecast period as the pack's hourly row: [time, tempF, rh, pop, wind, short, isDay]. */
export function hourlyRow(p) {
  if (!isObj(p) || !str(p.startTime)) return null;
  return [p.startTime, toF(p.temperature, p.temperatureUnit), quantity(p.relativeHumidity), quantity(p.probabilityOfPrecipitation) ?? 0,
    str(p.windSpeed), str(p.shortForecast), p.isDaytime ? 1 : 0];
}

/** A 12-hour forecast period in the pack's period shape: {name, start, end, isDay, tempF, short, pop, wind, detail}. */
export function periodOf(p) {
  if (!isObj(p) || !str(p.startTime) || !str(p.endTime)) return null;
  return {
    name: str(p.name) || '', start: p.startTime, end: p.endTime, isDay: !!p.isDaytime, tempF: toF(p.temperature, p.temperatureUnit),
    short: str(p.shortForecast) || '', pop: quantity(p.probabilityOfPrecipitation) ?? 0, wind: str(p.windSpeed) || '', detail: str(p.detailedForecast) || '',
  };
}

/** An active alert (a GeoJSON feature of /alerts/active) in the pack's alert shape. */
export function alertOf(f) {
  const a = isObj(f) && isObj(f.properties) ? f.properties : f;
  if (!isObj(a) || !str(a.event)) return null;
  return {
    event: a.event, severity: str(a.severity) || 'Unknown', headline: str(a.headline) || a.event,
    onset: str(a.onset) || str(a.effective) || null, ends: str(a.ends) || str(a.expires) || null,
    description: str(a.description) || '', instruction: str(a.instruction) || '',
  };
}

/**
 * The parts of a live answer, adapted: the office and place the grid belongs to, the hourly rows, the 12-hour
 * periods and the alerts. Throws when the hourly forecast is missing or empty (the one part every reader needs).
 * @param {{points: object, hourly: object, forecast?: object|null, alerts?: object|null}} raw the API's JSON bodies
 * @param {number} fetched epoch ms of the request
 * @returns {{office: string|null, point: string|null, zone: string|null, fetched: string, hourly: Array, periods: object[], alerts: object[]}}
 */
export function adaptLive(raw, fetched) {
  const pp = raw && isObj(raw.points) && isObj(raw.points.properties) ? raw.points.properties : {};
  const rel = isObj(pp.relativeLocation) && isObj(pp.relativeLocation.properties) ? pp.relativeLocation.properties : {};
  const hp = raw && isObj(raw.hourly) && isObj(raw.hourly.properties) ? raw.hourly.properties : {};
  const hourly = (Array.isArray(hp.periods) ? hp.periods : []).map(hourlyRow).filter(r => r && r[1] !== null)
    .sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]));
  if (!hourly.length) throw new Error('the hourly forecast came back empty');
  const fp = raw && isObj(raw.forecast) && isObj(raw.forecast.properties) ? raw.forecast.properties : {};
  const periods = (Array.isArray(fp.periods) ? fp.periods : []).map(periodOf).filter(Boolean);
  const features = raw && isObj(raw.alerts) && Array.isArray(raw.alerts.features) ? raw.alerts.features : [];
  const alerts = features.map(alertOf).filter(Boolean).filter((a, k, all) => all.findIndex(b => b.event === a.event) === k);
  const zoneURL = str(pp.forecastZone);
  return {
    office: str(pp.gridId) || str(pp.cwa), point: str(rel.city), zone: zoneURL ? zoneURL.split('/').pop() : null,
    fetched: new Date(fetched).toISOString(), hourly, periods, alerts,
  };
}

/** [first hour, end of the last hour] the live rows cover (epoch ms), or null. */
export function liveCoverage(live) {
  if (!live || !Array.isArray(live.hourly) || !live.hourly.length) return null;
  const from = Date.parse(live.hourly[0][0]), last = Date.parse(live.hourly[live.hourly.length - 1][0]);
  return Number.isFinite(from) && Number.isFinite(last) ? { from, to: last + 3600000 } : null;
}

/**
 * The world.weatherAt answer for time t from a live record (adaptLive output), or null when the live hours do
 * not cover t. Fields the API does not give (the observing station, the forecast office's key messages, the SPC
 * and WPC outlooks) come from the snapshot answer when one is passed for the same time and place, else neutral.
 * @param {object} live adaptLive output
 * @param {number} t epoch ms (simulation time)
 * @param {object|null} [snapshot] world.weatherAt(zi, t), for the fields the live API lacks
 * @returns {object|null}
 */
export function liveWeatherAt(live, t, snapshot = null) {
  if (!live || !Number.isFinite(t)) return null;
  let best = null, bestDt = Infinity;
  for (const row of live.hourly) { const dt = Math.abs(Date.parse(row[0]) - t); if (dt < bestDt) { bestDt = dt; best = row; } }
  if (!best || bestDt > HOUR_SLACK_MS) return null;
  const periods = live.periods || [];
  const cur = periods.find(p => Date.parse(p.start) <= t && t < Date.parse(p.end)) || null;
  const idx = cur ? periods.indexOf(cur) : -1;
  const alerts = (live.alerts || []).filter(a => {
    const on = a.onset ? Date.parse(a.onset) : -Infinity, end = a.ends ? Date.parse(a.ends) : Infinity;
    return t <= end && t >= on - 36 * 3600000;
  }).map(a => ({ ...a }));
  const snap = isObj(snapshot) ? snapshot : {};
  return {
    source: `NWS ${live.office || ''} live ${live.fetched}`.replace(/\s+/g, ' '),
    fetched: live.fetched, point: live.point || snap.point || null, office: live.office || snap.office || null, stale: false, live: true,
    now: { tempF: best[1], rh: best[2], pop: best[3], wind: best[4], short: best[5], isDay: !!best[6], time: best[0] },
    period: cur ? { ...cur } : null,
    next: idx >= 0 ? periods.slice(idx + 1, idx + 4).map(p => ({ ...p })) : [],
    obs: snap.obs || null,
    alerts,
    keyMessages: [],
    fireWeather: { level: 0, name: 'None' },
    excessiveRain: { level: 0, name: 'None' },
  };
}

/** "Nov 24, 3 PM" in Pacific time, for the notes. */
function shortTime(ms) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric' }).format(new Date(ms));
  } catch { return new Date(ms).toISOString().slice(0, 16).replace('T', ' '); }
}

/**
 * The live NWS layer. One per world. Off until setEnabled(true); refresh(zi) fetches a ZIP (deduplicated, cached
 * LIVE_TTL_MS); weatherAt(zi, t) answers from the cache or returns null; world() is the live-aware world.
 */
export class LiveWeather {
  /**
   * @param {{world: object, fetch?: Function, enabled?: boolean, ttlMs?: number, timeoutMs?: number, now?: () => number,
   *   userAgent?: string, api?: string}} options
   *   fetch: defaults to globalThis.fetch; now: the wall clock (Date.now) used for the cache's age; userAgent: sent
   *   where the runtime allows it (Node; browsers send their own)
   */
  constructor({ world, fetch: fetchFn = null, enabled = false, ttlMs = LIVE_TTL_MS, timeoutMs = LIVE_TIMEOUT_MS, now = () => Date.now(), userAgent = null, api = NWS_API } = {}) {
    if (!world || typeof world.weatherAt !== 'function') throw new Error('LiveWeather needs a world');
    this.base = world;
    this.fetchFn = fetchFn || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
    this.enabled = !!enabled;
    this.ttlMs = ttlMs; this.timeoutMs = timeoutMs; this.now = now; this.userAgent = userAgent; this.api = api.replace(/\/+$/, '');
    this.entries = new Map();     // zi -> {live, at, error, errorAt, pending}
    this.points = new Map();      // zi -> points JSON (the grid of a place does not change)
    this.generation = 0;
    this._world = null; this._worldGen = -1;
    this._listeners = new Set();
  }

  /** Turn the layer on or off; off forgets nothing but answers nothing. */
  setEnabled(on) {
    const next = !!on;
    if (next === this.enabled) return;
    this.enabled = next;
    this._changed(null);
  }

  /** Listen to changes (a ZIP refreshed, failed, the layer switched); returns the unsubscribe function. */
  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  _changed(zi) {
    this.generation++;
    for (const fn of [...this._listeners]) { try { fn({ zi, generation: this.generation, enabled: this.enabled }); } catch { /* a listener must not break the layer */ } }
  }

  /** The cached live record of a ZIP (adaptLive output), or null. */
  live(zi) { const e = this.entries.get(zi); return e && e.live ? e.live : null; }

  _fresh(e) { return !!(e && e.live && this.now() - e.at < this.ttlMs); }

  async _get(url) {
    if (!this.fetchFn) throw new Error('this runtime has no fetch');
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), this.timeoutMs) : null;
    const headers = { accept: 'application/geo+json' };
    if (this.userAgent) headers['user-agent'] = this.userAgent;
    try {
      const res = await this.fetchFn(url, { headers, signal: ctl ? ctl.signal : undefined, cache: 'no-store' });
      if (!res || !res.ok) throw new Error(`api.weather.gov answered ${res ? res.status : 'nothing'}`);
      return await res.json();
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('api.weather.gov did not answer in time');
      throw e;
    } finally { if (timer) clearTimeout(timer); }
  }

  /**
   * Fetch a ZIP's live weather unless a fresh answer is cached (or a request is already on its way). Never
   * throws: the result is the ZIP's status().
   * @param {number} zi ZIP index
   * @param {{force?: boolean}} [opts]
   * @returns {Promise<object>} status(zi)
   */
  async refresh(zi, { force = false } = {}) {
    if (!this.enabled || !(zi >= 0 && zi < this.base.N)) return this.status(zi);
    let e = this.entries.get(zi);
    if (!e) this.entries.set(zi, e = { live: null, at: 0, error: null, errorAt: 0, pending: null });
    if (e.pending) return e.pending;
    if (!force && this._fresh(e)) return this.status(zi);
    // a failure is not retried for a minute (a page that redraws must not hammer the API)
    if (!force && e.error && this.now() - e.errorAt < 60000) return this.status(zi);
    e.pending = (async () => {
      const z = this.base.z, lat = num(z.tlat && z.tlat[zi]) ?? z.lat[zi], lon = num(z.tlon && z.tlon[zi]) ?? z.lon[zi];
      const at = this.now();
      try {
        let points = this.points.get(zi);
        if (!points) { points = await this._get(`${this.api}/points/${lat.toFixed(4)},${lon.toFixed(4)}`); this.points.set(zi, points); }
        const pp = isObj(points) && isObj(points.properties) ? points.properties : {};
        if (!str(pp.forecastHourly)) throw new Error('api.weather.gov has no forecast grid for this place');
        const [hourly, forecast, alerts] = await Promise.all([
          this._get(pp.forecastHourly),
          str(pp.forecast) ? this._get(pp.forecast).catch(() => null) : null,
          this._get(`${this.api}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`).catch(() => null),
        ]);
        e.live = adaptLive({ points, hourly, forecast, alerts }, at);
        e.at = at; e.error = null; e.errorAt = 0;
      } catch (err) {
        e.error = err && err.message ? err.message : String(err);
        e.errorAt = at;
      } finally {
        e.pending = null;
      }
      this._changed(zi);
      return this.status(zi);
    })();
    return e.pending;
  }

  /**
   * The weather for ZIP zi at time t from the live cache (world.weatherAt's shape, with live: true), or null when
   * the layer is off, nothing is cached, or the cached hours do not cover t.
   */
  weatherAt(zi, t) {
    if (!this.enabled) return null;
    const live = this.live(zi);
    if (!live) return null;
    const snap = (() => { try { return this.base.weatherAt(zi, t); } catch { return null; } })();
    return liveWeatherAt(live, t, snap);
  }

  /**
   * Where the weather of ZIP zi at time t comes from, in words, for the panels: {state, note, fetched, covers}.
   * state: 'off' | 'loading' | 'live' | 'outside' (live hours do not cover t) | 'error' | 'idle' (not fetched yet).
   */
  status(zi, t = null) {
    if (!this.enabled) return { state: 'off', note: null, fetched: null, covers: null };
    const e = this.entries.get(zi);
    if (e && e.pending && !e.live) return { state: 'loading', note: 'Fetching live weather from api.weather.gov…', fetched: null, covers: null };
    if (e && e.live) {
      const covers = liveCoverage(e.live);
      const outside = Number.isFinite(t) && covers && (t < covers.from - HOUR_SLACK_MS || t > covers.to + HOUR_SLACK_MS);
      if (outside) {
        return { state: 'outside', fetched: e.live.fetched, covers,
          note: `The live forecast covers ${shortTime(covers.from)} to ${shortTime(covers.to)}; the clock is at ${shortTime(t)}, so this is the pack's snapshot.` };
      }
      const failed = e.error ? ` (the last refresh failed: ${e.error})` : '';
      return { state: 'live', fetched: e.live.fetched, covers, note: `Live from api.weather.gov, ${shortTime(e.at)}${failed}.` };
    }
    if (e && e.error) return { state: 'error', fetched: null, covers: null, note: `Live weather is unavailable (${e.error}); showing the pack's NWS snapshot.` };
    return { state: 'idle', note: null, fetched: null, covers: null };
  }

  /**
   * The world as live-aware readers see it: the base World, with weatherAt answering from the live cache where it
   * can (else the snapshot). The same object until the cache changes; the base world itself while the layer is off.
   */
  world() {
    if (!this.enabled) return this.base;
    if (this._world && this._worldGen === this.generation) return this._world;
    this._world = liveWorld(this.base, (zi, t) => this.weatherAt(zi, t));
    this._worldGen = this.generation;
    return this._world;
  }
}

/**
 * A view of `world` whose weatherAt(zi, t) asks `source(zi, t)` first and falls back to the world's own answer.
 * Everything else reads and writes through to the world itself (its lazily built indexes are shared), and its
 * methods run on the world, so the view costs nothing beyond the weather.
 * @param {object} world a World
 * @param {(zi: number, t: number) => object|null} source
 * @returns {object}
 */
export function liveWorld(world, source) {
  const bound = new Map();
  const weatherAt = (zi, t = world.snapshotTime) => {
    let w = null;
    try { w = source(zi, t); } catch { w = null; }
    return w || world.weatherAt(zi, t);
  };
  return new Proxy(world, {
    get(target, prop) {
      if (prop === 'weatherAt') return weatherAt;
      if (prop === 'liveBase') return target;
      const v = target[prop];
      if (typeof v !== 'function' || prop === 'constructor') return v;
      let b = bound.get(prop);
      if (!b) bound.set(prop, b = v.bind(target));
      return b;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}
