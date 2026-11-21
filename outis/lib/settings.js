/* Settings: defaults, validation and the mapping from settings to the files of the page script.
   Everything lives in chrome.storage.local under "settings"; the popup and the settings page write there and the
   background re-applies on every change. Nothing is synced to a Google account. */
import { PLACES, placeById } from './places.js';
import { normalizeSite } from './sites.js';

export const VERSION = 1;

export const DEFAULTS = Object.freeze({
  version: VERSION,
  enabled: true,
  /* who */
  trackers: true,     // static ruleset of tracker domains, plus Chrome's ad topics, ad measurement and link pings off
  cookies: true,      // third-party cookies and related-website sets off
  links: true,        // strip tracking parameters from addresses
  gpc: true,          // Global Privacy Control: Sec-GPC header and navigator.globalPrivacyControl
  canvas: true,       // canvas, WebGL and WebGPU readouts noised, graphics card masked
  audio: true,        // audio readouts noised
  device: true,       // cores, memory, client hints, network, voices, keyboard, fonts, disk
  screen: true,       // screen size and window position
  /* where */
  place: 'nowhere',   // lib/places.js
  location: 'block',  // block | fake | off
  language: true,     // en-US to requests and scripts
  webrtc: true,       // WebRTC can't leak local addresses (or go around the proxy)
  referrer: true,     // no referrer on cross-site navigation
  proxy: Object.freeze({ on: false, scheme: 'socks5', host: '127.0.0.1', port: 9150, user: '', pass: '' }),
  /* when */
  timezone: true,     // time zone and clock of the place
  activity: true,     // idle detection blocked, battery reported full and charging
  forget: true,       // clear a site's cookies and storage when its last tab closes
  forgetDelay: 15,    // seconds after the last tab closes; -1: at the next browser start
  /* safety */
  https: true,        // upgrade http to https; warn before a site with no secure version
  malware: true,      // static ruleset of malware, scam-ad and cryptomining hosts
  safeBrowsing: true, // keep Chrome's Safe Browsing on
  downloads: true,    // stop disguised, page-built, fake-update and click-to-run downloads; no automatic downloads
  clipboard: true,    // keep hidden commands off the clipboard; sites may not read it
  appLinks: true,     // block links that open Windows tools (search-ms:, ms-msdt:, ms-appinstaller: ...)
  notifications: true,// refuse notification requests, except trusted sites
  harden: true,       // sites not trusted: no WebGPU, no keyboard lock
  wasm: false,        // sites not trusted: no WebAssembly either (strict, breaks some apps)
  /* sites */
  paused: Object.freeze([]),   // protection off
  kept: Object.freeze([])      // trusted: not forgotten, fewer safety limits
});

export const LOCATION_MODES = ['block', 'fake', 'off'];
export const PROXY_SCHEMES = ['socks5', 'http', 'https'];
export const FORGET_DELAYS = [15, 60, 600, -1];
const BOOLEANS = ['enabled', 'trackers', 'cookies', 'links', 'gpc', 'canvas', 'audio', 'device', 'screen', 'language',
  'webrtc', 'referrer', 'timezone', 'activity', 'forget', 'https', 'malware', 'safeBrowsing', 'downloads', 'clipboard', 'appLinks',
  'notifications', 'harden', 'wasm'];

/* Fill in defaults and drop anything malformed, so a bad write can never switch protection off by accident. */
export function normalize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const s = {};
  for (const k of BOOLEANS) s[k] = typeof r[k] === 'boolean' ? r[k] : DEFAULTS[k];
  s.version = VERSION;
  s.place = PLACES.some(p => p.id === r.place) ? r.place : DEFAULTS.place;
  s.location = LOCATION_MODES.includes(r.location) ? r.location : DEFAULTS.location;
  s.forgetDelay = FORGET_DELAYS.includes(r.forgetDelay) ? r.forgetDelay : DEFAULTS.forgetDelay;
  const p = r.proxy && typeof r.proxy === 'object' ? r.proxy : {};
  const port = Number(p.port);
  s.proxy = {
    on: p.on === true,
    scheme: PROXY_SCHEMES.includes(p.scheme) ? p.scheme : DEFAULTS.proxy.scheme,
    host: typeof p.host === 'string' && /^[a-zA-Z0-9.:\[\]_-]{1,253}$/.test(p.host.trim()) ? p.host.trim() : DEFAULTS.proxy.host,
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULTS.proxy.port,
    user: typeof p.user === 'string' ? p.user.slice(0, 256) : '',
    pass: typeof p.pass === 'string' ? p.pass.slice(0, 256) : ''
  };
  s.paused = siteList(r.paused);
  s.kept = siteList(r.kept);
  return s;
}

function siteList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const x of v) { if (typeof x !== 'string') continue; const n = normalizeSite(x); if (n && !out.includes(n)) out.push(n); }
  return out.slice(0, 2000);
}

/* ---- storage ---- */
export async function load() {
  const got = await chrome.storage.local.get('settings');
  return normalize(got.settings);
}

export async function save(s) {
  const n = normalize(s);
  await chrome.storage.local.set({ settings: n });
  return n;
}

/* Read, change, write: patch is an object merged on top, or a function that edits a copy. */
export async function update(patch) {
  const cur = await load();
  const next = typeof patch === 'function' ? (patch(structuredClone(cur)) || cur) : Object.assign({}, cur, patch);
  return save(next);
}

/* ---- the page script ----
   The shield (inject/shield.js) runs in the page's own world before the page's scripts, so it cannot wait for
   storage. Instead its registration lists small generated files ahead of it: one per switched-off module and one
   for the place. FLAGS names those files; tools/build.mjs writes them. */
export const FLAGS = ['no-canvas', 'no-audio', 'no-device', 'no-screen', 'no-timezone', 'no-language', 'no-referrer',
  'no-activity', 'no-gpc', 'geo-fake', 'geo-off', 'no-clipboard', 'no-applinks', 'no-harden', 'wasm-off', 'trusted'];

export function shieldFlags(s) {
  const f = [];
  if (!s.canvas) f.push('no-canvas');
  if (!s.audio) f.push('no-audio');
  if (!s.device) f.push('no-device');
  if (!s.screen) f.push('no-screen');
  if (!s.timezone) f.push('no-timezone');
  if (!s.language) f.push('no-language');
  if (!s.referrer) f.push('no-referrer');
  if (!s.activity) f.push('no-activity');
  if (!s.gpc) f.push('no-gpc');
  if (s.location === 'fake') f.push('geo-fake');
  if (s.location === 'off') f.push('geo-off');
  if (!s.clipboard) f.push('no-clipboard');
  if (!s.appLinks) f.push('no-applinks');
  if (!s.harden) f.push('no-harden');
  if (s.wasm) f.push('wasm-off');
  return f;
}

/* trusted: the files for the registration that covers trusted (kept) sites, where the hardening is off. */
export function shieldFiles(s, trusted = false) {
  const flags = shieldFlags(s);
  if (trusted) flags.push('trusted');
  return [...flags.map(f => `inject/opt/${f}.js`), `inject/places/${placeById(s.place).id}.js`, 'inject/shield.js'];
}

/* Does the page script have anything to do? */
export function shieldNeeded(s) {
  return s.enabled && (s.canvas || s.audio || s.device || s.screen || s.timezone || s.language || s.referrer ||
    s.activity || s.gpc || s.location !== 'off' || s.clipboard || s.appLinks || s.harden || s.wasm);
}
