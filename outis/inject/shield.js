/* Outis page shield.
   Runs in the page's own JavaScript world at document_start, in every frame, before any of the page's scripts:
   chrome.scripting registers it with small generated files ahead of it (inject/opt/*.js, inject/places/*.js) that
   leave the settings in globalThis.__outis_cfg, which this script reads and deletes before a page script can see it.
   inject/key.js, registered just ahead in the extension's isolated world, leaves a per-site, per-browser-session seed
   on <html> for an instant; this script takes it and removes it.
   What it changes, by module (each can be switched off in settings):
     timezone  Date, Intl and Temporal report the chosen place's time zone and wall clock.
     language  navigator.language(s) and the default locale of Intl and toLocale* are en-US.
     geo       navigator.geolocation is refused, or answers with the place's coordinates.
     canvas    canvas, OffscreenCanvas and WebGL readouts carry faint per-site noise; WebGL and WebGPU report a
               common graphics card.
     audio     Web Audio readouts carry faint per-site noise.
     device    cores, memory, OS version and model hints, network quality, voices, keyboard layout, local fonts and
               disk quota are reported as common values or refused.
     screen    the screen is reported as the size of the window and the window as sitting at 0,0.
     activity  idle detection is refused and the battery is reported full and charging.
     referrer  document.referrer is empty after arriving from another site.
     gpc       navigator.globalPrivacyControl is true.
   Safety modules:
     clipboard a command the page did not show you never reaches your clipboard, and a page cannot swap what you
               copy for one (the "paste this into Run / Terminal" trick).
     applinks  links and window.open to Windows tools (search-ms:, ms-msdt:, ms-appinstaller: ...) are blocked.
     harden    on sites you have not trusted: no WebGPU, no keyboard lock, and (if chosen) no WebAssembly.
   Replaced functions keep their names, lengths and native-looking source text. Nothing leaves the page. */
(function outisShield() {
  'use strict';
  const G = globalThis;
  let CFG = {};
  try { CFG = G.__outis_cfg || {}; } catch (e) { /* ignore */ }
  try { delete G.__outis_cfg; } catch (e) { /* ignore */ }

  const { apply, construct } = Reflect;
  const { defineProperty, getOwnPropertyDescriptor, getPrototypeOf, create, freeze } = Object;
  const ObjectCtor = Object;
  const { floor, abs, max, imul, cos, PI } = Math;
  const NumberCtor = Number;
  const ProxyCtor = Proxy;
  const WM = WeakMap, wmGet = WeakMap.prototype.get, wmSet = WeakMap.prototype.set;
  const PromiseCtor = Promise, promiseThen = Promise.prototype.then, promiseReject = Promise.reject, promiseResolve = Promise.resolve;
  const DOMExceptionCtor = G.DOMException;
  const setTimeoutFn = G.setTimeout;
  const isArray = Array.isArray;
  const isView = ArrayBuffer.isView;
  const U8 = Uint8Array;

  /* ---- the per-site seed from inject/key.js ---- */
  const SEED_ATTR = 'data-outis-seed', MARK_ATTR = 'data-outis-shield';
  function takeSeed() {
    /* key.js normally runs first and leaves the seed; if it ever runs second, the mark tells it not to. */
    try {
      const E = G.Element && G.Element.prototype;
      const root = G.document && G.document.documentElement;
      if (!E || !root) return '';
      const v = apply(E.getAttribute, root, [SEED_ATTR]);
      if (v) { apply(E.removeAttribute, root, [SEED_ATTR]); return v; }
      apply(E.setAttribute, root, [MARK_ATTR, '']);
    } catch (e) { /* ignore */ }
    return '';
  }
  const seedText = takeSeed();
  const DONE = Symbol.for('outis.shield');
  if (G[DONE]) return;   // this window was already shielded (document.open on a frame re-runs content scripts)
  try { defineProperty(G, DONE, { value: true }); } catch (e) { /* ignore */ }

  let S0, S1;
  {
    let n = NumberCtor(seedText);
    if (!(n > 0 && n <= 9007199254740991)) {
      const a = new Uint32Array(2);
      try { G.crypto.getRandomValues(a); } catch (e) { a[0] = Date.now() >>> 0; a[1] = (Math.random() * 4294967296) >>> 0; }
      n = a[0] * 2097152 + (a[1] >>> 11) + 1;
    }
    S0 = (n % 4294967296) >>> 0;
    S1 = floor(n / 4294967296) >>> 0;
  }
  const fmix = h => { h ^= h >>> 16; h = imul(h, 0x85ebca6b); h ^= h >>> 13; h = imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
  const hash2 = (a, b) => fmix((imul(a ^ S0, 0x9e3779b1) + fmix(((b ^ S1) + 0x7f4a7c15) | 0)) | 0);

  const ON = name => !CFG['no-' + name];
  const PLACE = CFG.place && typeof CFG.place.tz === 'string' ? CFG.place : { id: 'nowhere', tz: 'UTC' };

  /* ---- replacing functions without looking replaced ---- */
  const fnToString = Function.prototype.toString;
  const disguised = new WM();
  const disguise = (fn, like) => { apply(wmSet, disguised, [fn, like]); return fn; };
  {
    const d = getOwnPropertyDescriptor(Function.prototype, 'toString');
    const replacement = {
      toString() {
        const like = apply(wmGet, disguised, [this]);
        if (typeof like === 'string') return like;
        return apply(fnToString, like !== undefined ? like : this, []);
      }
    }.toString;
    disguise(replacement, fnToString);
    defineProperty(Function.prototype, 'toString', { value: replacement, writable: d.writable, enumerable: d.enumerable, configurable: d.configurable });
  }
  function owner(obj, name) {
    for (let o = obj; o; o = getPrototypeOf(o)) if (getOwnPropertyDescriptor(o, name)) return o;
    return null;
  }
  /* make(original) returns the new behaviour; the installed function has the original's name and length. */
  function wrapMethod(obj, name, make) {
    if (!obj) return null;
    const d = getOwnPropertyDescriptor(obj, name);
    if (!d || typeof d.value !== 'function') return null;
    const orig = d.value;
    const impl = make(orig);
    const fn = { [name](...args) { return apply(impl, this, args); } }[name];
    defineProperty(fn, 'length', { value: orig.length });
    disguise(fn, orig);
    defineProperty(obj, name, { value: fn, writable: d.writable, enumerable: d.enumerable, configurable: d.configurable });
    return orig;
  }
  function wrapGetter(obj, name, make) {
    if (!obj) return null;
    const d = getOwnPropertyDescriptor(obj, name);
    if (!d || typeof d.get !== 'function') return null;
    const orig = d.get;
    const impl = make(orig);
    const g = getOwnPropertyDescriptor({ get [name]() { return apply(impl, this, []); } }, name).get;
    disguise(g, orig);
    defineProperty(obj, name, { get: g, set: d.set, enumerable: d.enumerable, configurable: d.configurable });
    return orig;
  }
  /* A getter that calls the real one first (so a wrong receiver still throws "Illegal invocation"), then lies. */
  const fixed = value => orig => function () { apply(orig, this, []); return value; };
  /* Swap a constructor for a proxy that rewrites its arguments; prototype.constructor follows. */
  function proxyCtor(holder, name, fix) {
    const d = holder && getOwnPropertyDescriptor(holder, name);
    if (!d || typeof d.value !== 'function') return null;
    const C = d.value;
    const P = new ProxyCtor(C, {
      apply(t, self, args) { return apply(t, self, fix(args)); },
      construct(t, args, nt) { return construct(t, fix(args), nt); }
    });
    disguise(P, C);
    defineProperty(holder, name, { value: P, writable: d.writable, enumerable: d.enumerable, configurable: d.configurable });
    const pd = C.prototype && getOwnPropertyDescriptor(C.prototype, 'constructor');
    if (pd && pd.value === C) defineProperty(C.prototype, 'constructor', { value: P, writable: pd.writable, enumerable: pd.enumerable, configurable: pd.configurable });
    return C;
  }
  const copyArgs = args => { const a = []; for (let i = 0; i < args.length; i++) a[i] = args[i]; return a; };
  const rejectWith = (message, name) => apply(promiseReject, PromiseCtor, [new DOMExceptionCtor(message, name)]);

  /* ---- sites (for the referrer): registrable domain with the common multi-label suffixes ---- */
  /*@suffixes*/const SUFFIXES = 'co.uk org.uk ac.uk gov.uk me.uk ltd.uk plc.uk net.uk sch.uk nhs.uk police.uk com.au net.au org.au edu.au gov.au asn.au id.au co.nz net.nz org.nz govt.nz ac.nz co.jp ne.jp or.jp ac.jp go.jp gr.jp ed.jp lg.jp co.kr or.kr ne.kr go.kr ac.kr com.br net.br org.br gov.br edu.br com.mx org.mx gob.mx edu.mx com.ar com.co com.pe com.ve com.ec com.uy com.py com.bo co.in net.in org.in gov.in ac.in firm.in gen.in ind.in com.cn net.cn org.cn gov.cn edu.cn com.hk org.hk net.hk edu.hk gov.hk com.tw org.tw net.tw edu.tw gov.tw com.sg org.sg net.sg edu.sg gov.sg com.my org.my net.my edu.my gov.my co.id or.id ac.id go.id web.id co.th or.th ac.th go.th in.th com.ph org.ph net.ph gov.ph edu.ph com.vn net.vn org.vn gov.vn edu.vn com.tr org.tr net.tr gov.tr edu.tr gen.tr co.za org.za net.za gov.za ac.za web.za com.ng org.ng gov.ng edu.ng co.ke or.ke go.ke ac.ke com.eg org.eg gov.eg edu.eg com.sa org.sa gov.sa edu.sa co.il org.il gov.il ac.il net.il com.ua org.ua net.ua gov.ua in.ua com.pl net.pl org.pl gov.pl edu.pl com.ru org.ru net.ru msk.ru spb.ru co.at or.at gv.at ac.at com.es org.es nom.es gob.es edu.es com.pt org.pt gov.pt edu.pt com.gr org.gr gov.gr edu.gr github.io gitlab.io pages.dev workers.dev netlify.app vercel.app herokuapp.com web.app firebaseapp.com appspot.com blogspot.com azurewebsites.net myshopify.com glitch.me surge.sh neocities.org fly.dev onrender.com';/*@end*/
  const MULTI = create(null);
  for (const s of SUFFIXES.split(' ')) MULTI[s] = 1;
  function siteOf(host) {
    const h = String(host || '').toLowerCase().replace(/\.+$/, '');
    if (!h || h[0] === '[' || h.indexOf(':') >= 0 || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)) return h;
    const l = h.split('.');
    if (l.length <= 2) return h;
    const two = l[l.length - 2] + '.' + l[l.length - 1];
    return MULTI[two] ? l[l.length - 3] + '.' + two : two;
  }

  const LANGON = ON('language');
  const TZON = ON('timezone');
  const LOCALE = 'en-US';
  const fixLocales = LANGON ? (l => (l === undefined ? LOCALE : l)) : (l => l);

  /* ================= time zone ================= */
  const OrigDate = Date;
  const DP = OrigDate.prototype;
  const dGetTime = DP.getTime, dSetTime = DP.setTime, DateUTC = OrigDate.UTC, DateParse = OrigDate.parse, DateNow = OrigDate.now;
  const realTZO = DP.getTimezoneOffset, uSetFullYear = DP.setUTCFullYear;
  const uGet = {
    FullYear: DP.getUTCFullYear, Month: DP.getUTCMonth, Date: DP.getUTCDate, Day: DP.getUTCDay,
    Hours: DP.getUTCHours, Minutes: DP.getUTCMinutes, Seconds: DP.getUTCSeconds, Milliseconds: DP.getUTCMilliseconds
  };
  const OrigDTF = G.Intl && Intl.DateTimeFormat;
  const dtfFormatToParts = OrigDTF && OrigDTF.prototype.formatToParts;
  const dtfResolved = OrigDTF && OrigDTF.prototype.resolvedOptions;
  const dtfFormatGet = OrigDTF && getOwnPropertyDescriptor(OrigDTF.prototype, 'format').get;
  let TZ = PLACE.tz, TZID = TZ, FIXED = null;
  if (TZON && OrigDTF) {
    try { TZID = apply(dtfResolved, new OrigDTF('en-US', { timeZone: TZ }), []).timeZone; } catch (e) { TZ = TZID = 'UTC'; }
    FIXED = /^(?:UTC|Etc\/UTC|Etc\/GMT|GMT|Etc\/Universal|Etc\/Zulu|Etc\/UCT|UCT|Zulu|Universal)$/.test(TZID) ? 0 : null;
  }
  const scratch = new OrigDate(0);
  const tv = d => apply(dGetTime, d, []);          // throws for a non-Date receiver, as the real methods do
  const sett = (d, t) => apply(dSetTime, d, [t]);
  const get = (name, d) => apply(uGet[name], d, []);
  const mod = (a, b) => ((a % b) + b) % b;
  /* Date.UTC without the 0-99 → 1900s rule (the 400-year Gregorian cycle is exactly 146097 days). */
  const utcNoMap = (y, mo, d, h, mi, s, ms) => (y >= 0 && y <= 99)
    ? DateUTC(y + 400, mo, d, h, mi, s, ms) - 12622780800000
    : DateUTC(y, mo, d, h, mi, s, ms);

  let offFmt = null;
  const offCache = create(null);
  let offCount = 0;
  /* Milliseconds to add to a UTC instant to get the place's wall clock. Zone changes fall on quarter hours,
     so the answer is cached per 15-minute bucket. */
  function offsetAt(t) {
    if (FIXED !== null) return FIXED;
    const k = floor(t / 900000);
    const hit = offCache[k];
    if (hit !== undefined) return hit;
    if (!offFmt) offFmt = new OrigDTF('en-US', { timeZone: TZ, hourCycle: 'h23', era: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    const parts = apply(dtfFormatToParts, offFmt, [t]);
    let y = 1970, mo = 1, d = 1, h = 0, mi = 0, s = 0, bc = false;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], v = p.value;
      switch (p.type) {
        case 'year': y = +v; break;
        case 'month': mo = +v; break;
        case 'day': d = +v; break;
        case 'hour': h = +v; break;
        case 'minute': mi = +v; break;
        case 'second': s = +v; break;
        case 'era': bc = v === 'BC' || v === 'B'; break;
        default: break;
      }
    }
    if (bc) y = 1 - y;
    const o = utcNoMap(y, mo - 1, d, h, mi, s, 0) - (t - mod(t, 1000));
    if (++offCount > 8192) { for (const key in offCache) delete offCache[key]; offCount = 1; }
    offCache[k] = o;
    return o;
  }
  /* A wall-clock time in the place back to UTC, the way ECMAScript does it: in a repeated hour the earlier instant,
     in a skipped hour the offset from before the change. */
  function localToUtc(L) {
    if (!(L === L) || L === Infinity || L === -Infinity) return NaN;
    if (FIXED !== null) return L - FIXED;
    const oB = offsetAt(L - 86400000), oA = offsetAt(L + 86400000);
    const tB = L - oB, tA = L - oA;
    const vB = offsetAt(tB) === oB, vA = offsetAt(tA) === oA;
    if (vB && vA) return tB < tA ? tB : tA;
    if (vB) return tB;
    if (vA) return tA;
    return tB;
  }
  const wall = t => t + offsetAt(t);

  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p2 = n => (n < 10 ? '0' : '') + n;
  const yr = y => { let s = '' + abs(y); while (s.length < 4) s = '0' + s; return (y < 0 ? '-' : '') + s; };
  let nameFmt = null;
  const nameCache = create(null);
  let nameCount = 0;
  function zoneName(t) {
    const k = floor(t / 900000);
    let n = nameCache[k];
    if (n !== undefined) return n;
    if (!nameFmt) nameFmt = new OrigDTF(LANGON ? LOCALE : undefined, { timeZone: TZ, timeZoneName: 'long' });
    n = '';
    const parts = apply(dtfFormatToParts, nameFmt, [t]);
    for (let i = 0; i < parts.length; i++) if (parts[i].type === 'timeZoneName') n = parts[i].value;
    if (++nameCount > 4096) { for (const key in nameCache) delete nameCache[key]; nameCount = 1; }
    nameCache[k] = n;
    return n;
  }
  function zoneString(t) {
    const o = offsetAt(t), a = abs(o);
    return 'GMT' + (o >= 0 ? '+' : '-') + p2(floor(a / 3600000)) + p2(floor((a % 3600000) / 60000)) + ' (' + zoneName(t) + ')';
  }
  function dateString(L) { sett(scratch, L); return WD[get('Day', scratch)] + ' ' + MO[get('Month', scratch)] + ' ' + p2(get('Date', scratch)) + ' ' + yr(get('FullYear', scratch)); }
  function timeString(L) { sett(scratch, L); return p2(get('Hours', scratch)) + ':' + p2(get('Minutes', scratch)) + ':' + p2(get('Seconds', scratch)); }
  function fullString(t) { if (!(t === t)) return 'Invalid Date'; const L = wall(t); return dateString(L) + ' ' + timeString(L) + ' ' + zoneString(t); }

  /* Options with the place's time zone added unless the caller chose one. */
  function withTZ(options) {
    if (options === undefined) return { timeZone: TZ };
    if (options === null || (typeof options !== 'object' && typeof options !== 'function')) return options;
    let has = false;
    try { has = options.timeZone !== undefined; } catch (e) { return options; }
    return has ? options : create(options, { timeZone: { value: TZ, enumerable: true } });
  }

  /* A date string that names no zone means local time: re-read its wall clock in the place. */
  const ISO_LOCAL = /^\s*([+-]\d{6}|\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?\s*$/;
  const ISO_DATE = /^\s*([+-]\d{6}|\d{4})(?:-\d{2}(?:-\d{2})?)?\s*$/;
  const ISO_ZONED = /^\s*([+-]\d{6}|\d{4})-\d{2}-\d{2}[Tt]\d{2}:\d{2}(?::\d{2}(?:[.,]\d{1,9})?)?\s*(?:[Zz]|[+-]\d{2}(?::?\d{2})?)\s*$/;
  const NAMES_ZONE = /(?:\b(?:GMT|UTC|UT)\b|\d[Zz]\b|\s[Zz]\b|\d{1,2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?\s*[+-]\d{2}:?\d{2}\b|\b[ECMP][SD]T\b)/i;
  function parseDate(str) {
    const s = '' + str;
    const native = apply(DateParse, OrigDate, [s]);
    if (!(native === native)) return NaN;
    if (TZID === realZone) return native;
    if (ISO_DATE.test(s) || ISO_ZONED.test(s)) return native;
    const m = ISO_LOCAL.exec(s);
    if (m) {
      const ms = m[7] ? +(m[7] + '00').slice(0, 3) : 0;
      return localToUtc(utcNoMap(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0, ms));
    }
    if (NAMES_ZONE.test(s.replace(/\([^)]*\)/g, ''))) return native;
    sett(scratch, native);
    return localToUtc(native - apply(realTZO, scratch, []) * 60000);
  }
  let realZone = '';
  try { realZone = apply(dtfResolved, new OrigDTF(), []).timeZone; } catch (e) { /* ignore */ }

  function toPrimitive(v) {
    if (v === null || (typeof v !== 'object' && typeof v !== 'function')) return v;
    const ex = v[Symbol.toPrimitive];
    if (ex !== undefined && ex !== null) {
      const r = apply(ex, v, ['default']);
      if (r !== null && (typeof r === 'object' || typeof r === 'function')) throw new TypeError('Cannot convert object to primitive value');
      return r;
    }
    for (const m of ['valueOf', 'toString']) {
      const f = v[m];
      if (typeof f === 'function') { const r = apply(f, v, []); if (r === null || (typeof r !== 'object' && typeof r !== 'function')) return r; }
    }
    throw new TypeError('Cannot convert object to primitive value');
  }
  function isDate(v) {
    if (v === null || typeof v !== 'object') return false;
    try { tv(v); return true; } catch (e) { return false; }
  }

  if (TZON && OrigDTF) {
    /* local getters */
    const LG = { getFullYear: 'FullYear', getMonth: 'Month', getDate: 'Date', getDay: 'Day', getHours: 'Hours', getMinutes: 'Minutes', getSeconds: 'Seconds', getMilliseconds: 'Milliseconds' };
    for (const name in LG) {
      const field = LG[name];
      wrapMethod(DP, name, () => function () { const t = tv(this); if (!(t === t)) return NaN; sett(scratch, wall(t)); return get(field, scratch); });
    }
    wrapMethod(DP, 'getYear', () => function () { const t = tv(this); if (!(t === t)) return NaN; sett(scratch, wall(t)); return get('FullYear', scratch) - 1900; });
    wrapMethod(DP, 'getTimezoneOffset', () => function () { const t = tv(this); if (!(t === t)) return NaN; return (-offsetAt(t) / 60000) || 0; });
    /* local setters: apply the same change to the wall clock, then map back */
    const LS = { setMilliseconds: DP.setUTCMilliseconds, setSeconds: DP.setUTCSeconds, setMinutes: DP.setUTCMinutes, setHours: DP.setUTCHours, setDate: DP.setUTCDate, setMonth: DP.setUTCMonth, setFullYear: DP.setUTCFullYear };
    for (const name in LS) {
      const utcSet = LS[name];
      wrapMethod(DP, name, () => function (...args) {
        const t = tv(this);
        const L = t === t ? wall(t) : (name === 'setFullYear' ? 0 : NaN);
        sett(scratch, L);
        const L2 = apply(utcSet, scratch, args);
        return sett(this, L2 === L2 ? localToUtc(L2) : NaN);
      });
    }
    wrapMethod(DP, 'setYear', () => function (year) {
      const t = tv(this);
      const y = +year;
      if (!(y === y)) return sett(this, NaN);
      const yi = y < 0 ? -floor(-y) : floor(y);
      const full = yi >= 0 && yi <= 99 ? 1900 + yi : y;
      sett(scratch, t === t ? wall(t) : 0);
      const L2 = apply(uSetFullYear, scratch, [full]);
      return sett(this, L2 === L2 ? localToUtc(L2) : NaN);
    });
    /* strings */
    wrapMethod(DP, 'toString', () => function () { return fullString(tv(this)); });
    wrapMethod(DP, 'toDateString', () => function () { const t = tv(this); return t === t ? dateString(wall(t)) : 'Invalid Date'; });
    wrapMethod(DP, 'toTimeString', () => function () { const t = tv(this); return t === t ? timeString(wall(t)) + ' ' + zoneString(t) : 'Invalid Date'; });

    /* the Date constructor and Date.parse */
    const DateProxy = new ProxyCtor(OrigDate, {
      apply() { return fullString(apply(DateNow, OrigDate, [])); },
      construct(target, args, nt) {
        const n = args.length;
        if (n === 0) return construct(target, [], nt);
        if (n === 1) {
          let v = args[0];
          if (isDate(v)) return construct(target, [tv(v)], nt);
          v = toPrimitive(v);
          return construct(target, [typeof v === 'string' ? parseDate(v) : v], nt);
        }
        return construct(target, [localToUtc(apply(DateUTC, OrigDate, copyArgs(args)))], nt);
      }
    });
    disguise(DateProxy, OrigDate);
    wrapMethod(OrigDate, 'parse', () => function (s) { return parseDate(s); });
    {
      const d = getOwnPropertyDescriptor(G, 'Date');
      defineProperty(G, 'Date', { value: DateProxy, writable: d.writable, enumerable: d.enumerable, configurable: d.configurable });
      const pd = getOwnPropertyDescriptor(DP, 'constructor');
      defineProperty(DP, 'constructor', { value: DateProxy, writable: pd.writable, enumerable: pd.enumerable, configurable: pd.configurable });
    }

    /* Temporal */
    const T = G.Temporal;
    if (T && T.Now) {
      wrapMethod(T.Now, 'timeZoneId', () => function () { return TZID; });
      for (const n of ['zonedDateTimeISO', 'plainDateTimeISO', 'plainDateISO', 'plainTimeISO']) {
        wrapMethod(T.Now, n, orig => function (...args) { const a = copyArgs(args); if (a[0] === undefined) a[0] = TZID; return apply(orig, this, a); });
      }
      if (T.Instant) wrapMethod(T.Instant.prototype, 'toLocaleString', orig => function (locales, options) { return apply(orig, this, [fixLocales(locales), withTZ(options)]); });
    }
  }

  /* Intl.DateTimeFormat and Date's toLocale*String: the place's zone and, with language on, en-US */
  if ((TZON || LANGON) && OrigDTF) {
    const fixDTF = args => {
      const a = copyArgs(args);
      a[0] = fixLocales(a[0]);
      if (TZON) a[1] = withTZ(a[1]);
      return a;
    };
    proxyCtor(G.Intl, 'DateTimeFormat', fixDTF);
    const DEFAULTS = {
      toLocaleString: { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' },
      toLocaleDateString: { year: 'numeric', month: 'numeric', day: 'numeric' },
      toLocaleTimeString: { hour: 'numeric', minute: 'numeric', second: 'numeric' }
    };
    for (const name in DEFAULTS) {
      let quick = null;   // the formatter for the common no-argument call, made once
      wrapMethod(DP, name, orig => function (...args) {
        const t = tv(this);
        if (!(t === t)) return apply(orig, this, args);
        if (args.length === 0 || (args[0] === undefined && args[1] === undefined)) {
          if (!quick) { const o = DEFAULTS[name]; if (TZON) o.timeZone = TZ; quick = apply(dtfFormatGet, new OrigDTF(fixLocales(undefined), o), []); }
          return quick(t);
        }
        return apply(orig, this, [fixLocales(args[0]), TZON ? withTZ(args[1]) : args[1]]);
      });
    }
  }

  /* ================= language ================= */
  if (LANGON) {
    const NP = G.Navigator && Navigator.prototype;
    const LANGS = freeze(['en-US', 'en']);
    wrapGetter(NP, 'language', fixed(LOCALE));
    wrapGetter(NP, 'languages', fixed(LANGS));
    const fix0 = args => { const a = copyArgs(args); a[0] = fixLocales(a[0]); return a; };
    for (const n of ['NumberFormat', 'Collator', 'PluralRules', 'RelativeTimeFormat', 'ListFormat', 'Segmenter', 'DisplayNames', 'DurationFormat']) proxyCtor(G.Intl, n, fix0);
    const loc1 = orig => function (...args) { const a = copyArgs(args); a[0] = fixLocales(a[0]); return apply(orig, this, a); };
    wrapMethod(Number.prototype, 'toLocaleString', loc1);
    if (G.BigInt) wrapMethod(BigInt.prototype, 'toLocaleString', loc1);
    wrapMethod(String.prototype, 'toLocaleUpperCase', loc1);
    wrapMethod(String.prototype, 'toLocaleLowerCase', loc1);
    wrapMethod(String.prototype, 'localeCompare', orig => function (that, locales, options) { return apply(orig, this, [that, fixLocales(locales), options]); });
    if (!TZON && G.Temporal && Temporal.Instant) wrapMethod(Temporal.Instant.prototype, 'toLocaleString', loc1);
    if (G.Temporal) for (const n of ['ZonedDateTime', 'PlainDateTime', 'PlainDate', 'PlainTime', 'PlainYearMonth', 'PlainMonthDay', 'Duration']) if (Temporal[n]) wrapMethod(Temporal[n].prototype, 'toLocaleString', loc1);
  }

  /* ================= location ================= */
  const GEO = CFG['geo-off'] ? 'off' : (CFG['geo-fake'] && typeof PLACE.lat === 'number') ? 'fake' : 'block';
  if (GEO !== 'off' && G.Geolocation) {
    const GP = Geolocation.prototype;
    const PosErr = G.GeolocationPositionError, Pos = G.GeolocationPosition, Coords = G.GeolocationCoordinates;
    const denied = () => create(PosErr ? PosErr.prototype : ObjectCtor.prototype, {
      code: { value: 1, enumerable: true }, message: { value: 'User denied Geolocation', enumerable: true }
    });
    const later = (fn, arg) => { apply(setTimeoutFn, G, [() => apply(fn, undefined, [arg]), 3 + (hash2(DateNow() & 0xffff, 9) % 20)]); };
    const origClear = GP.clearWatch;
    if (GEO === 'fake') {
      const jit = i => hash2(0x67656f, i) / 4294967296 - 0.5;
      const lat = PLACE.lat + jit(1) * 0.012;
      const lon = PLACE.lon + jit(2) * 0.012 / max(0.2, cos(PLACE.lat * PI / 180));
      const acc = 30 + (hash2(0x67656f, 3) % 70);
      const coordsJSON = () => ({ accuracy: acc, latitude: lat, longitude: lon, altitude: null, altitudeAccuracy: null, heading: null, speed: null });
      const position = () => {
        const c = create(Coords ? Coords.prototype : ObjectCtor.prototype, {
          accuracy: { value: acc, enumerable: true }, latitude: { value: lat, enumerable: true }, longitude: { value: lon, enumerable: true },
          altitude: { value: null, enumerable: true }, altitudeAccuracy: { value: null, enumerable: true },
          heading: { value: null, enumerable: true }, speed: { value: null, enumerable: true },
          toJSON: { value: disguise({ toJSON() { return coordsJSON(); } }.toJSON, 'function toJSON() { [native code] }') }
        });
        const ts = apply(DateNow, OrigDate, []);
        return create(Pos ? Pos.prototype : ObjectCtor.prototype, {
          coords: { value: c, enumerable: true }, timestamp: { value: ts, enumerable: true },
          toJSON: { value: disguise({ toJSON() { return { coords: coordsJSON(), timestamp: ts }; } }.toJSON, 'function toJSON() { [native code] }') }
        });
      };
      let nextId = 0;
      const ours = create(null);
      wrapMethod(GP, 'getCurrentPosition', orig => function (success, error, options) {
        if (typeof success !== 'function') return apply(orig, this, [success, error, options]);
        apply(origClear, this, [0]);
        later(success, position());
      });
      wrapMethod(GP, 'watchPosition', orig => function (success, error, options) {
        if (typeof success !== 'function') return apply(orig, this, [success, error, options]);
        apply(origClear, this, [0]);
        const id = ++nextId;
        ours[id] = 1;
        later(success, position());
        return id;
      });
      wrapMethod(GP, 'clearWatch', orig => function (id) { if (ours[id]) { delete ours[id]; return; } return apply(orig, this, [id]); });
      if (G.Permissions) {
        wrapMethod(Permissions.prototype, 'query', orig => function (desc) {
          const p = apply(orig, this, [desc]);
          let geo = false;
          try { geo = !!desc && desc.name === 'geolocation'; } catch (e) { /* ignore */ }
          if (!geo) return p;
          return apply(promiseThen, p, [st => { try { defineProperty(st, 'state', { value: 'granted', configurable: true, enumerable: true }); } catch (e) { /* ignore */ } return st; }]);
        });
      }
    } else {
      /* Chrome is set to refuse location to every site; should a site be allowed anyway, it still gets no position. */
      const refuse = (success, error) => (typeof success === 'function'
        ? function () { if (typeof error === 'function') apply(error, undefined, [denied()]); }
        : success);
      wrapMethod(GP, 'getCurrentPosition', orig => function (success, error, options) { return apply(orig, this, [refuse(success, error), error, options]); });
      wrapMethod(GP, 'watchPosition', orig => function (success, error, options) { return apply(orig, this, [refuse(success, error), error, options]); });
    }
  }

  /* ================= fingerprint: canvas and graphics ================= */
  /* Noise: about one in 32 pixels that differ from a neighbour (text edges, gradients, curves: where graphics stacks
     differ) moves by one step in one channel. Flat areas, and reads of a single pixel, are untouched, so colour
     pickers and hit-testing still work. Positions come from the per-site seed: the same canvas reads the same on one
     site all session, and differently on every other site and after a browser restart. */
  const NOISE_MAX = 4194304;
  function noiseRGBA(px, w, h, x0, y0, flipH) {
    const n = w * h;
    if (!(n >= 2) || n > NOISE_MAX || px.length < n * 4) return;
    const todo = [];
    let m = 0;
    const same = (a, b) => px[a] === px[b] && px[a + 1] === px[b + 1] && px[a + 2] === px[b + 2] && px[a + 3] === px[b + 3];
    for (let y = 0; y < h; y++) {
      const cy = flipH ? flipH - 1 - (y0 + y) : y0 + y;
      const ry = imul(cy ^ S1, 0x85ebca6b);
      for (let x = 0; x < w; x++) {
        /* two multiplications pick about one pixel in 32; only those get the full hash */
        if ((imul(((x0 + x) ^ S0) + ry, 0x9e3779b1) >>> 27) !== 0) continue;
        const hv = hash2(x0 + x, cy);
        const k = (y * w + x) * 4;
        if (px[k + 3] === 0) continue;
        if ((x > 0 && !same(k, k - 4)) || (x < w - 1 && !same(k, k + 4)) || (y > 0 && !same(k, k - w * 4)) || (y < h - 1 && !same(k, k + w * 4))) {
          todo[m++] = k; todo[m++] = hv;
        }
      }
    }
    for (let i = 0; i < m; i += 2) {
      const k = todo[i], hv = todo[i + 1];
      const a = px[k + 3], up = (hv >>> 7) & 1;
      if (a === 255) {
        const c = k + ((hv >>> 5) & 3) % 3;
        const v = px[c];
        px[c] = v === 255 ? 254 : v === 0 ? 1 : (up ? v + 1 : v - 1);
      } else {
        px[k + 3] = a === 254 ? 253 : a === 1 ? 2 : (up ? a + 1 : a - 1);
      }
    }
  }

  if (ON('canvas')) {
    const CVP = G.HTMLCanvasElement && HTMLCanvasElement.prototype;
    const C2D = G.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    const IDP = G.ImageData && ImageData.prototype;
    if (CVP && C2D && IDP) {
      const getter = (o, n) => { const d = getOwnPropertyDescriptor(o, n); return d && d.get; };
      const setter = (o, n) => { const d = getOwnPropertyDescriptor(o, n); return d && d.set; };
      const cvW = getter(CVP, 'width'), cvH = getter(CVP, 'height'), cvWs = setter(CVP, 'width'), cvHs = setter(CVP, 'height');
      const getContext = CVP.getContext;
      const drawImage = C2D.drawImage, putImageData = C2D.putImageData;
      const idData = getter(IDP, 'data'), idW = getter(IDP, 'width'), idH = getter(IDP, 'height');
      const createElement = Document.prototype.createElement;
      const origGetImageData = wrapMethod(C2D, 'getImageData', orig => function (...args) {
        const img = apply(orig, this, args);
        try {
          let x0 = +args[0], y0 = +args[1];
          if (+args[2] < 0) x0 += +args[2];
          if (+args[3] < 0) y0 += +args[3];
          noiseRGBA(apply(idData, img, []), apply(idW, img, []), apply(idH, img, []), floor(x0) | 0, floor(y0) | 0, 0);
        } catch (e) { /* ignore */ }
        return img;
      });
      const noisedCopy = cv => {
        const w = apply(cvW, cv, []), h = apply(cvH, cv, []);
        if (!w || !h || w * h > NOISE_MAX) return null;
        const s = apply(createElement, G.document, ['canvas']);
        apply(cvWs, s, [w]); apply(cvHs, s, [h]);
        const ctx = apply(getContext, s, ['2d', { willReadFrequently: true }]);
        if (!ctx) return null;
        apply(drawImage, ctx, [cv, 0, 0]);
        const img = apply(origGetImageData, ctx, [0, 0, w, h]);
        noiseRGBA(apply(idData, img, []), w, h, 0, 0, 0);
        apply(putImageData, ctx, [img, 0, 0]);
        return s;
      };
      for (const name of ['toDataURL', 'toBlob']) {
        wrapMethod(CVP, name, orig => function (...args) {
          let c = null;
          try { c = noisedCopy(this); } catch (e) { c = null; }
          return apply(orig, c || this, args);
        });
      }
      const OC = G.OffscreenCanvas, OCP = OC && OC.prototype, O2D = G.OffscreenCanvasRenderingContext2D && OffscreenCanvasRenderingContext2D.prototype;
      if (OCP && O2D) {
        const ocW = getter(OCP, 'width'), ocH = getter(OCP, 'height'), ocGetContext = OCP.getContext;
        const oDraw = O2D.drawImage, oPut = O2D.putImageData;
        const oGet = wrapMethod(O2D, 'getImageData', orig => function (...args) {
          const img = apply(orig, this, args);
          try {
            let x0 = +args[0], y0 = +args[1];
            if (+args[2] < 0) x0 += +args[2];
            if (+args[3] < 0) y0 += +args[3];
            noiseRGBA(apply(idData, img, []), apply(idW, img, []), apply(idH, img, []), floor(x0) | 0, floor(y0) | 0, 0);
          } catch (e) { /* ignore */ }
          return img;
        });
        wrapMethod(OCP, 'convertToBlob', orig => function (...args) {
          let c = null;
          try {
            const w = apply(ocW, this, []), h = apply(ocH, this, []);
            if (w && h && w * h <= NOISE_MAX) {
              c = new OC(w, h);
              const ctx = apply(ocGetContext, c, ['2d', { willReadFrequently: true }]);
              apply(oDraw, ctx, [this, 0, 0]);
              const img = apply(oGet, ctx, [0, 0, w, h]);
              noiseRGBA(apply(idData, img, []), w, h, 0, 0, 0);
              apply(oPut, ctx, [img, 0, 0]);
            }
          } catch (e) { c = null; }
          return apply(orig, c || this, args);
        });
      }
    }
    /* WebGL: a common graphics card in the unmasked vendor and renderer, and the same noise on readPixels */
    const PLATFORM = (() => {
      try { const d = G.navigator && navigator.userAgentData; if (d && d.platform) return d.platform; } catch (e) { /* ignore */ }
      const ua = (G.navigator && navigator.userAgent) || '';
      return /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'Chrome OS' : /Linux/.test(ua) ? 'Linux' : '';
    })();
    const GPU = PLATFORM === 'macOS' ? ['Google Inc. (Apple)', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)']
      : PLATFORM === 'Android' ? ['Google Inc. (Qualcomm)', 'ANGLE (Qualcomm, Adreno (TM) 650, OpenGL ES 3.2)']
      : (PLATFORM === 'Linux' || PLATFORM === 'Chrome OS') ? ['Google Inc. (Intel)', 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)']
      : ['Google Inc. (Intel)', 'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)'];
    for (const C of [G.WebGLRenderingContext, G.WebGL2RenderingContext]) {
      const P = C && C.prototype;
      if (!P) continue;
      const dbh = getOwnPropertyDescriptor(P, 'drawingBufferHeight');
      const dbhGet = dbh && dbh.get;
      wrapMethod(P, 'getParameter', orig => function (pname) {
        const v = apply(orig, this, [pname]);
        if (typeof v === 'string') { if (pname === 0x9245) return GPU[0]; if (pname === 0x9246) return GPU[1]; }
        return v;
      });
      wrapMethod(P, 'readPixels', orig => function (...args) {
        const r = apply(orig, this, args);
        try {
          const x = args[0] | 0, y = args[1] | 0, w = args[2] | 0, h = args[3] | 0, dst = args[6];
          if (args[4] === 0x1908 && args[5] === 0x1401 && dst && typeof dst === 'object' && isView(dst) && dst.BYTES_PER_ELEMENT === 1 && w > 0 && h > 0) {
            const off = (args[7] >>> 0) || 0;
            const view = new U8(dst.buffer, dst.byteOffset + off, w * h * 4);
            noiseRGBA(view, w, h, x, y, dbhGet ? apply(dbhGet, this, []) : 0);
          }
        } catch (e) { /* ignore */ }
        return r;
      });
    }
    const GAI = G.GPUAdapterInfo && GPUAdapterInfo.prototype;
    for (const k of ['vendor', 'architecture', 'device', 'description']) wrapGetter(GAI, k, fixed(''));
  }

  /* ================= fingerprint: audio ================= */
  if (ON('audio')) {
    const ABP = G.AudioBuffer && AudioBuffer.prototype;
    const noiseSamples = (arr, salt, scale, additive) => {
      const n = arr.length;
      if (n > NOISE_MAX) return;
      for (let i = 0; i < n; i++) {
        const v = arr[i];
        if (v === 0 || v !== v || v === Infinity || v === -Infinity) continue;
        const r = (hash2(i, salt) / 4294967296 - 0.5) * scale;
        arr[i] = additive ? v + r : v + v * r;
      }
    };
    if (ABP) {
      const touched = new WM();
      wrapMethod(ABP, 'getChannelData', orig => function (ch) {
        const arr = apply(orig, this, [ch]);
        try {
          const c = ch >>> 0, bits = apply(wmGet, touched, [this]) | 0;
          if (c < 32 && !(bits & (1 << c))) { apply(wmSet, touched, [this, bits | (1 << c)]); noiseSamples(arr, 0x61750000 + c, 4e-7, false); }
        } catch (e) { /* ignore */ }
        return arr;
      });
      const noisedGCD = ABP.getChannelData;
      wrapMethod(ABP, 'copyFromChannel', orig => function (...args) {
        try { apply(noisedGCD, this, [args[1]]); } catch (e) { /* ignore: the real call reports bad arguments */ }
        return apply(orig, this, args);
      });
    }
    const ANP = G.AnalyserNode && AnalyserNode.prototype;
    if (ANP) {
      wrapMethod(ANP, 'getFloatFrequencyData', orig => function (arr) { const r = apply(orig, this, [arr]); try { noiseSamples(arr, 0x616e0001, 2e-4, true); } catch (e) { /* ignore */ } return r; });
      wrapMethod(ANP, 'getFloatTimeDomainData', orig => function (arr) { const r = apply(orig, this, [arr]); try { noiseSamples(arr, 0x616e0002, 4e-7, false); } catch (e) { /* ignore */ } return r; });
    }
  }

  /* ================= fingerprint: device ================= */
  if (ON('device')) {
    const NP = G.Navigator && Navigator.prototype;
    wrapGetter(NP, 'hardwareConcurrency', fixed(8));
    wrapGetter(NP, 'deviceMemory', fixed(8));
    const UAD = G.NavigatorUAData && NavigatorUAData.prototype;
    if (UAD) {
      const VERSION = { Windows: '10.0.0', macOS: '10.15.7', 'Chrome OS': '14541.0.0', Android: '10.0.0', Linux: '' };
      const scrub = v => {
        if (!v || typeof v !== 'object') return v;
        const major = s => String(s).split('.')[0] + '.0.0.0';
        if ('platformVersion' in v) v.platformVersion = VERSION[v.platform] !== undefined ? VERSION[v.platform] : '';
        if ('architecture' in v) v.architecture = v.platform === 'Android' ? '' : 'x86';
        if ('bitness' in v) v.bitness = v.platform === 'Android' ? '' : '64';
        if ('model' in v) v.model = '';
        if ('wow64' in v) v.wow64 = false;
        if ('uaFullVersion' in v) v.uaFullVersion = major(v.uaFullVersion);
        if (isArray(v.fullVersionList)) v.fullVersionList = v.fullVersionList.map(b => ({ brand: b.brand, version: major(b.version) }));
        if (isArray(v.formFactors)) v.formFactors = [v.mobile ? 'Mobile' : 'Desktop'];
        return v;
      };
      wrapMethod(UAD, 'getHighEntropyValues', orig => function (hints) { return apply(promiseThen, apply(orig, this, [hints]), [scrub]); });
    }
    const NIP = G.NetworkInformation && NetworkInformation.prototype;
    wrapGetter(NIP, 'effectiveType', fixed('4g'));
    wrapGetter(NIP, 'rtt', fixed(50));
    wrapGetter(NIP, 'downlink', fixed(10));
    wrapGetter(NIP, 'saveData', fixed(false));
    const SSP = G.SpeechSynthesis && SpeechSynthesis.prototype, SVP = G.SpeechSynthesisVoice && SpeechSynthesisVoice.prototype;
    const localService = SVP && getOwnPropertyDescriptor(SVP, 'localService');
    if (SSP && localService && localService.get) {
      /* The voices installed on the computer name its OS and language packs; Chrome's own online voices are the
         same for everyone, so only those are listed. */
      wrapMethod(SSP, 'getVoices', orig => function () {
        const list = apply(orig, this, []), out = [];
        for (let i = 0; i < list.length; i++) { try { if (!apply(localService.get, list[i], [])) out[out.length] = list[i]; } catch (e) { /* ignore */ } }
        return out;
      });
    }
    const KBP = G.Keyboard && Keyboard.prototype;
    wrapMethod(KBP, 'getLayoutMap', () => function () { return rejectWith('getLayoutMap() must be called from a top-level browsing context or allowed by the permission policy.', 'SecurityError'); });
    const qlf = owner(G, 'queryLocalFonts');
    wrapMethod(qlf, 'queryLocalFonts', () => function () { return rejectWith('Permission not granted', 'NotAllowedError'); });
    const SMP = G.StorageManager && StorageManager.prototype;
    wrapMethod(SMP, 'estimate', orig => function () {
      return apply(promiseThen, apply(orig, this, []), [r => { try { if (r && typeof r.usage === 'number') r.quota = max(2147483648, floor(r.usage * 2)); } catch (e) { /* ignore */ } return r; }]);
    });
  }

  /* ================= fingerprint: screen ================= */
  if (ON('screen') && G.Screen) {
    const SP = Screen.prototype;
    const wGet = n => { const o = owner(G, n), d = o && getOwnPropertyDescriptor(o, n); return d && d.get; };
    const iw = wGet('innerWidth'), ih = wGet('innerHeight'), ow = wGet('outerWidth'), oh = wGet('outerHeight');
    const num = (g) => { try { return g ? apply(g, G, []) | 0 : 0; } catch (e) { return 0; } };
    const W = () => max(num(ow), num(iw)) || 1280, H = () => max(num(oh), num(ih)) || 720;
    const live = f => orig => function () { apply(orig, this, []); return f(); };
    wrapGetter(SP, 'width', live(W));
    wrapGetter(SP, 'height', live(H));
    wrapGetter(SP, 'availWidth', live(W));
    wrapGetter(SP, 'availHeight', live(H));
    wrapGetter(SP, 'availLeft', fixed(0));
    wrapGetter(SP, 'availTop', fixed(0));
    wrapGetter(SP, 'colorDepth', fixed(24));
    wrapGetter(SP, 'pixelDepth', fixed(24));
    wrapGetter(SP, 'isExtended', fixed(false));
    for (const n of ['screenX', 'screenY', 'screenLeft', 'screenTop']) wrapGetter(owner(G, n), n, fixed(0));
  }

  /* ================= when you're active ================= */
  if (ON('activity')) {
    const BMP = G.BatteryManager && BatteryManager.prototype;
    wrapGetter(BMP, 'charging', fixed(true));
    wrapGetter(BMP, 'chargingTime', fixed(0));
    wrapGetter(BMP, 'dischargingTime', fixed(Infinity));
    wrapGetter(BMP, 'level', fixed(1));
    if (G.IdleDetector) {
      wrapMethod(IdleDetector, 'requestPermission', () => function () { return apply(promiseResolve, PromiseCtor, ['denied']); });
      wrapMethod(IdleDetector.prototype, 'start', () => function () { return rejectWith('Idle detection permission denied', 'NotAllowedError'); });
    }
  }

  /* ================= where you came from ================= */
  if (ON('referrer') && G.Document) {
    let top = false;
    try { top = G.top === G; } catch (e) { top = false; }
    if (top) {
      wrapGetter(Document.prototype, 'referrer', orig => function () {
        const r = apply(orig, this, []);
        if (!r) return r;
        try {
          const from = siteOf(new URL(r).hostname), here = siteOf(G.location.hostname);
          if (from && here && from !== here) return '';
        } catch (e) { /* ignore */ }
        return r;
      });
    }
  }

  /* ================= Global Privacy Control ================= */
  if (ON('gpc') && G.Navigator) {
    const NP = Navigator.prototype;
    const d = getOwnPropertyDescriptor(NP, 'globalPrivacyControl');
    if (d && d.get) wrapGetter(NP, 'globalPrivacyControl', fixed(true));
    else if (!d) {
      const brand = getOwnPropertyDescriptor(NP, 'userAgent');
      const g = getOwnPropertyDescriptor({ get globalPrivacyControl() { if (brand && brand.get) apply(brand.get, this, []); return true; } }, 'globalPrivacyControl').get;
      disguise(g, 'function get globalPrivacyControl() { [native code] }');
      defineProperty(NP, 'globalPrivacyControl', { get: g, set: undefined, enumerable: true, configurable: true });
    }
  }

  /* ================= safety ================= */
  /* Guards against what pages try to do to you rather than learn about you: commands slipped onto the clipboard, links
     that open Windows tools, and (on sites you have not trusted) browser features that new attacks favour. The
     patterns come from lib/safety.js (tools/build.mjs copies them in). Everything the guards depend on was captured
     here, before any page script ran, so a hostile page cannot blind them by replacing built-in functions later. */
  /*@safety*/const SAFETY = {"commands":[["\\b(?:powershell|pwsh)(?:\\.exe)?\\s+(?:-\\w|\\/\\w|[\"']|iex\\b|i[rw][rm]\\b)","i"],["\\bcmd(?:\\.exe)?[\"']?\\s+\\/[ckr]\\b","i"],["\\b(?:mshta|rundll32|regsvr32|certutil|bitsadmin|wscript|cscript|cmstp|msbuild|installutil|regasm|regsvcs|odbcconf|forfiles|schtasks|wmic)(?:\\.exe)?[\"']?\\s","i"],["\\bmsiexec(?:\\.exe)?\\s+\\/[iqxa]","i"],["\\bconhost(?:\\.exe)?\\s+--headless\\b","i"],["(?:^|[\\s;|(&])(?:iex|iwr|irm)(?:\\s|\\(|$)","i"],["\\b(?:Invoke-Expression|Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|DownloadString|DownloadFile|FromBase64String|EncodedCommand)\\b","i"],["\\bNet\\.WebClient\\b","i"],["\\bDavWWWRoot\\b","i"],["\\\\\\\\[\\w.-]+@(?:SSL|\\d+)\\\\","i"],["\\bosascript\\s+-e\\b","i"],["\\bxattr\\s+-[a-z]*[cdr]","i"],["\\bbase64\\s+(?:-d|-D|--decode)\\b",""],["(?:curl|wget)\\b[^|\\n]{0,400}\\|\\s*(?:sudo\\s+)?(?:ba|z|da|k|c)?sh\\b","i"],["\\b(?:bash|sh|zsh|dash)\\s+-c\\b","i"],["\\$\\(\\s*(?:curl|wget)\\b","i"],["`\\s*(?:curl|wget)\\b","i"],["\\/dev\\/tcp\\/","i"],["\\bpython[0-9.]*\\s+-c\\s","i"],["\\bperl\\s+-e\\s","i"]],"schemes":["search-ms","search","ms-search","ms-msdt","ms-officecmd","ms-cxh","ms-cxh-full","ms-appinstaller","mk","its","ms-its","mhtml","hcp","vbscript","jscript","shell"],"office":["ms-word","ms-excel","ms-powerpoint","ms-visio","ms-access","ms-project","ms-publisher","ms-spd","ms-infopath","ms-onenote"],"microsoft":["sharepoint.com","sharepoint-df.com","sharepoint.us","onedrive.live.com","live.com","office.com","office.net","office365.com","microsoft.com","microsoftonline.com","svc.ms","1drv.ms","cloud.microsoft"]};/*@end*/
  const TRUSTED = !!CFG.trusted;
  if (G.document && G.Document && G.Element && G.HTMLElement) {
    const StringCtor = String;
    const reExec = RegExp.prototype.exec;
    const sIndexOf = String.prototype.indexOf, sSlice = String.prototype.slice, sLower = String.prototype.toLowerCase, sCode = String.prototype.charCodeAt;
    const lower = s => apply(sLower, s, []);
    const find = (s, t) => apply(sIndexOf, s, [t]);
    const getterOf = (o, n) => { const x = o && owner(o, n); const d = x && getOwnPropertyDescriptor(x, n); return d ? d.get : undefined; };
    const D = Document.prototype, E = Element.prototype, EVP = Event.prototype;
    const createElement = D.createElement, appendChild = Node.prototype.appendChild, removeEl = E.remove, attachShadow = E.attachShadow;
    const getAttribute = E.getAttribute, closest = E.closest;
    const addListener = EventTarget.prototype.addEventListener, dispatch = EventTarget.prototype.dispatchEvent;
    const preventDefault = EVP.preventDefault, stopImmediate = EVP.stopImmediatePropagation;
    const evType = getterOf(EVP, 'type'), evTarget = getterOf(EVP, 'target');
    const docEl = getterOf(D, 'documentElement'), docBody = getterOf(D, 'body'), activeEl = getterOf(D, 'activeElement');
    const innerText = getterOf(HTMLElement.prototype, 'innerText');
    const textSet = (getOwnPropertyDescriptor(Node.prototype, 'textContent') || {}).set;
    const styleGet = getterOf(HTMLElement.prototype, 'style');
    const cssTextSet = G.CSSStyleDeclaration && (getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText') || {}).set;
    const localName = getterOf(E, 'localName');
    const TA = G.HTMLTextAreaElement && HTMLTextAreaElement.prototype, IN = G.HTMLInputElement && HTMLInputElement.prototype;
    const field = { textarea: [getterOf(TA, 'value'), getterOf(TA, 'selectionStart'), getterOf(TA, 'selectionEnd')], input: [getterOf(IN, 'value'), getterOf(IN, 'selectionStart'), getterOf(IN, 'selectionEnd')] };
    const gsOwner = owner(G, 'getSelection');
    const getSelection = gsOwner && gsOwner.getSelection;
    const selToString = G.Selection && Selection.prototype.toString;
    const eventGet = getterOf(G, 'event');
    const CustomEventCtor = G.CustomEvent;
    const URLCtor = G.URL, urlHost = G.URL && getterOf(URL.prototype, 'hostname');

    /* Text as it reads: invisible characters dropped, runs of whitespace as one space. */
    const norm = v => {
      const s = StringCtor(v);
      let out = '', gap = false;
      for (let i = 0; i < s.length; i++) {
        const c = apply(sCode, s, [i]);
        if (c === 0x200b || c === 0x200c || c === 0x200d || c === 0x2060 || c === 0xfeff) continue;
        if (c <= 32 || c === 0x85 || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000) { gap = out.length > 0; continue; }
        if (gap) { out += ' '; gap = false; }
        out += s[i];
      }
      return out;
    };
    const CMD = [];
    for (const pair of SAFETY.commands || []) { try { CMD[CMD.length] = new RegExp(pair[0], pair[1]); } catch (e) { /* skip */ } }
    const isCommand = t => {
      if (typeof t !== 'string' || t.length < 6 || t.length > 20000) return false;
      for (let i = 0; i < CMD.length; i++) if (apply(reExec, CMD[i], [t]) !== null) return true;
      return false;
    };
    /* Was this text on the page for the person to see? A "copy" button next to a visible command passes; a hidden
       payload does not. */
    const visible = text => {
      let t = norm(text);
      if (t.length > 1 && (t[0] === '$' || t[0] === '>' || t[0] === '#' || t[0] === '%') && t[1] === ' ') t = apply(sSlice, t, [2]);
      if (!t) return true;
      let page = '';
      try { const b = apply(docBody, G.document, []); if (b) page = norm(apply(innerText, b, [])); } catch (e) { page = ''; }
      return find(page, t) >= 0;
    };
    const selectedText = () => {
      try {
        const a = apply(activeEl, G.document, []);
        const tag = a ? apply(localName, a, []) : '';
        const f = field[tag];
        if (f && f[0]) {
          const v = apply(f[0], a, []), s = apply(f[1], a, []), e = apply(f[2], a, []);
          if (typeof s === 'number' && typeof e === 'number' && e > s) return apply(sSlice, v, [s, e]);
        }
      } catch (e) { /* an input type without a selection */ }
      try { const sel = getSelection ? apply(getSelection, G, []) : null; return sel && selToString ? apply(selToString, sel, []) : ''; } catch (e) { return ''; }
    };

    /* Tell the person, on the page and on the toolbar button (inject/key.js passes the event on). */
    const TEXT = {
      clipboard: ['A hidden command was kept off your clipboard', "This page tried to copy a command it didn't show you. Pages that ask you to paste something into Run, PowerShell or Terminal are a common way to install malware. Don't paste it anywhere."],
      pastejack: ['This page tried to change what you copied', 'It tried to swap the text you copied for a command. Only what you selected was copied, or nothing.'],
      applink: ['A link that opens a Windows tool was blocked', "Links like this open programs on your computer, or show an attacker's files as if they were your own."]
    };
    let raised = 0, shown = 0;
    const css = (el, text) => { if (styleGet && cssTextSet) apply(cssTextSet, apply(styleGet, el, []), [text]); };
    const make = (tag, text, style) => { const el = apply(createElement, G.document, [tag]); if (text) apply(textSet, el, [text]); if (style) css(el, style); return el; };
    function banner(kind) {
      const root = apply(docEl, G.document, []);
      if (!root || shown >= 3 || !attachShadow) return;
      shown++;
      try {
        const host = make('outis-alert', '', 'all: initial; position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 2147483647; width: min(470px, calc(100vw - 28px)); display: block;');
        const shadow = apply(attachShadow, host, [{ mode: 'closed' }]);
        const box = make('div', '', 'display: block; box-sizing: border-box; font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #eef5f2; background: #13241f; border: 1px solid #2f6b5d; border-left: 5px solid #e0b341; border-radius: 12px; padding: 12px 14px; box-shadow: 0 10px 30px rgba(0,0,0,.4); text-align: left;');
        const brand = make('div', 'Outis stopped something', 'font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #7fe6c4; font-weight: 700; margin: 0 0 4px;');
        const t = TEXT[kind] || ['Outis stopped something on this page', ''];
        const title = make('div', t[0], 'font-weight: 700; font-size: 15px; margin: 0 0 4px; color: #ffffff;');
        const body = make('div', t[1], 'margin: 0 0 10px; color: #d4e2dd;');
        const ok = make('button', 'OK', 'all: initial; font: 600 13px system-ui, sans-serif; color: #0c1a16; background: #7fe6c4; border-radius: 8px; padding: 6px 14px; cursor: pointer;');
        apply(appendChild, box, [brand]); apply(appendChild, box, [title]); apply(appendChild, box, [body]); apply(appendChild, box, [ok]);
        apply(appendChild, shadow, [box]);
        const close = () => { try { apply(removeEl, host, []); } catch (e) { /* already gone */ } };
        apply(addListener, ok, ['click', close]);
        apply(appendChild, root, [host]);
        apply(setTimeoutFn, G, [close, 30000]);
      } catch (e) { /* the page's markup refused it; the toolbar button still says */ }
    }
    function raise(kind, detail) {
      if (++raised > 20) return;
      try { apply(dispatch, G.document, [new CustomEventCtor('outis-alert', { detail: kind + '\n' + apply(sSlice, StringCtor(detail || ''), [0, 160]) })]); } catch (e) { /* ignore */ }
      banner(kind);
    }

    if (ON('clipboard')) {
      const CP = G.Clipboard && Clipboard.prototype;
      wrapMethod(CP, 'writeText', orig => function (...args) {
        if (!args.length) return apply(orig, this, args);
        const text = StringCtor(args[0]);
        if (isCommand(text) && !visible(text)) { raise('clipboard', text); return rejectWith('Write permission denied.', 'NotAllowedError'); }
        return apply(orig, this, [text]);
      });
      const CIP = G.ClipboardItem && ClipboardItem.prototype;
      const itemTypes = getterOf(CIP, 'types'), itemGetType = CIP && CIP.getType, blobText = G.Blob && Blob.prototype.text;
      /* The plain text of each item is read first; the real write happens only if none of it is a hidden command. */
      const hiddenCommandIn = async items => {
        if (!items || typeof items.length !== 'number' || !itemTypes || !itemGetType || !blobText) return false;
        for (let i = 0; i < items.length; i++) {
          const types = apply(itemTypes, items[i], []);
          let plain = false;
          for (let k = 0; k < types.length; k++) if (types[k] === 'text/plain') plain = true;
          if (!plain) continue;
          const text = await apply(blobText, await apply(itemGetType, items[i], ['text/plain']), []);
          if (isCommand(text) && !visible(text)) { raise('clipboard', text); return true; }
        }
        return false;
      };
      wrapMethod(CP, 'write', orig => function (...args) {
        const self = this;
        return (async () => {
          let stop = false;
          try { stop = await hiddenCommandIn(args[0]); } catch (e) { stop = false; }
          if (stop) throw new DOMExceptionCtor('Write permission denied.', 'NotAllowedError');
          return apply(orig, self, args);
        })();
      });
      wrapMethod(D, 'execCommand', orig => function (...args) {
        let cmd = '';
        try { cmd = lower(StringCtor(args[0])); } catch (e) { cmd = ''; }
        if (cmd === 'copy' || cmd === 'cut') {
          const text = selectedText();
          if (isCommand(text) && !visible(text)) { raise('clipboard', text); return false; }
        }
        return apply(orig, this, args);
      });
      const DTP = G.DataTransfer && DataTransfer.prototype;
      wrapMethod(DTP, 'setData', orig => function (...args) {
        if (args.length < 2) return apply(orig, this, args);
        const fmt = lower(StringCtor(args[0])), data = StringCtor(args[1]);
        try {
          const ev = eventGet ? apply(eventGet, G, []) : undefined;
          const type = ev && evType ? apply(evType, ev, []) : '';
          if ((type === 'copy' || type === 'cut') && (fmt === 'text' || fmt === 'text/plain' || fmt === 'url' || fmt === 'text/uri-list')) {
            /* What the page adds to (or puts in place of) the person's own selection. */
            const sel = norm(selectedText()), d = norm(data);
            const at = sel ? find(d, sel) : -1;
            const added = at >= 0 ? apply(sSlice, d, [0, at]) + ' ' + apply(sSlice, d, [at + sel.length]) : d;
            if (d !== sel && isCommand(added)) { raise('pastejack', data); return undefined; }
          }
        } catch (e) { /* not in a copy event */ }
        return apply(orig, this, [args[0], data]);
      });
    }

    if (ON('applinks')) {
      const SCHEMES = create(null), OFFICE = create(null), MS = SAFETY.microsoft || [];
      for (const x of SAFETY.schemes || []) SCHEMES[x] = 1;
      for (const x of SAFETY.office || []) OFFICE[x] = 1;
      /* The scheme that makes a link dangerous, or '' (the same rules as dangerousLink in lib/safety.js). */
      const danger = href => {
        const s = StringCtor(href === null || href === undefined ? '' : href);
        let i = 0;
        while (i < s.length && apply(sCode, s, [i]) <= 32) i++;
        let j = i;
        while (j < s.length) {
          const c = apply(sCode, s, [j]);
          if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (j > i && ((c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46))) j++;
          else break;
        }
        if (j === i || j >= s.length || s[j] !== ':') return '';
        const scheme = lower(apply(sSlice, s, [i, j]));
        if (SCHEMES[scheme]) return scheme;
        if (!OFFICE[scheme]) return '';
        const k = find(s, '|u|');
        let host = '';
        if (k >= 0) {
          let rest = apply(sSlice, s, [k + 3]);
          const bar = find(rest, '|');
          if (bar >= 0) rest = apply(sSlice, rest, [0, bar]);
          try { host = lower(apply(urlHost, new URLCtor(rest), [])); } catch (e) { host = ''; }
        }
        if (host) {
          for (let n = 0; n < MS.length; n++) {
            const d = MS[n];
            if (host === d || (host.length > d.length && apply(sSlice, host, [host.length - d.length - 1]) === '.' + d)) return '';
          }
        }
        return scheme;
      };
      const guard = attr => e => {
        try {
          const t = apply(evTarget, e, []);
          const el = t && (attr === 'href' ? apply(closest, t, ['a[href],area[href]']) : t);
          if (!el) return;
          const bad = danger(apply(getAttribute, el, [attr]));
          if (!bad) return;
          apply(preventDefault, e, []);
          apply(stopImmediate, e, []);
          raise('applink', bad + ':');
        } catch (err) { /* not an element */ }
      };
      apply(addListener, G, ['click', guard('href'), true]);
      apply(addListener, G, ['auxclick', guard('href'), true]);
      apply(addListener, G, ['submit', guard('action'), true]);
      wrapMethod(owner(G, 'open'), 'open', orig => function (...args) {
        const a = copyArgs(args);
        if (a.length && a[0] !== undefined) {
          a[0] = StringCtor(a[0]);
          const bad = danger(a[0]);
          if (bad) { raise('applink', bad + ':'); return null; }
        }
        return apply(orig, this, a);
      });
    }
  }

  /* Sites you have not trusted lose the newest, least-tested graphics and input features: a large share of new browser
     attacks go through code like this, and fake "virus alert" pages use keyboard lock to keep you from pressing Esc. */
  if (ON('harden') && !TRUSTED) {
    wrapGetter(G.Navigator && Navigator.prototype, 'gpu', fixed(undefined));
    wrapMethod(G.Keyboard && Keyboard.prototype, 'lock', () => function () { return rejectWith('Keyboard lock is not allowed on this site.', 'NotAllowedError'); });
  }
  if (CFG['wasm-off'] && !TRUSTED) {
    try { delete G.WebAssembly; } catch (e) { /* ignore */ }
  }
})();
