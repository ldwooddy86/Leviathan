/* Reads Leviathan atlases into vertical packs, the files the content strategist works from.

   Two depths. Every atlas in the console keeps a keyword library beside its ad copy (kw, kwq, kwEs and the negatives), so
   harvest() lifts those out of any of them: that is the keyword pack. A Thermal Debt atlas (the HVAC family) carries much
   more, and deepPack() reads it all: where each service angle has demand, ZIP by ZIP and city by city, the sourced local
   facts the Site Forge prints, the pages the Forge plans, the Satchel's advertising rules and the brand.

   Nothing in an atlas is run except the one line triggers of the service angles (z => z.ge15_sh >= 19), each checked
   against a whitelist first and evaluated in an empty context. A pack never carries a name on the console's withheld
   list: the brand goes to a local file that git ignores, and the pack is scanned before it is written. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fields, elements, plain, record, matchClose, ownerOf, declared } from './literal.mjs';
import { sayShare, sayNumber } from './voice.mjs';

export const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(HERE, '..');

/* ---------- the withheld list (kept encoded in chrome-app/lib/scrub.mjs; absent outside the repository) ---------- */
let withheldP = null;
export function withheld() {
  if (!withheldP) withheldP = import(pathToFileURL(path.join(REPO, 'chrome-app', 'lib', 'scrub.mjs')).href).then(m => m.findWithheld, () => null);
  return withheldP;
}
/* drops every string that carries a withheld name from a JSON value; returns how many went */
export async function scrub(value) {
  const find = await withheld(); let n = 0; if (!find) return { value, dropped: 0, checked: false };
  const walk = v => {
    if (typeof v === 'string') { if (find(v, 1).length) { n++; return undefined; } return v; }
    if (Array.isArray(v)) return v.map(walk).filter(x => x !== undefined);
    if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) { const y = walk(x); if (y !== undefined) o[k] = y; } return o; }
    return v;
  };
  return { value: walk(value), dropped: n, checked: true };
}

/* ---------- the console's payloads ---------- */
const isB64 = c => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 43 || c === 47 || c === 61;
/* the gzip and base64 payloads of a console file: [{id, text}] */
export function payloads(text) {
  const out = []; let i = 0;
  while ((i = text.indexOf('H4sI', i)) !== -1) {
    let j = i; while (j < text.length && isB64(text.charCodeAt(j))) j++;
    if (j - i >= 24) {
      try {
        const body = zlib.gunzipSync(Buffer.from(text.slice(i, j), 'base64')).toString('utf8');
        const head = text.slice(Math.max(0, i - 120), i);
        const m = /id="lvp-([^"]+)">\s*$/.exec(head) || /__LVP\["([^"]+)"\]="$/.exec(head);
        out.push({ id: m ? m[1] : 'blob@' + i, text: body });
      } catch { /* not a payload */ }
    }
    i = j;
  }
  return out;
}
export const CONSOLE_FILES = ['leviathan/Leviathan.html', 'leviathan/Leviathan-data.js', 'leviathan/Leviathan-data-2.js'];
export function consolePayloads(repo = REPO) {
  const out = [];
  for (const f of CONSOLE_FILES) { const p = path.join(repo, f); if (fs.existsSync(p)) for (const x of payloads(fs.readFileSync(p, 'utf8'))) out.push(Object.assign(x, { file: f })); }
  return out;
}
/* the console registry: {modules: [{id, wing, wingLabel, vertical, short, name, title, sub, scope}]} */
export function registry(repo = REPO) {
  const p = path.join(repo, 'chrome-app', 'registry.js'); if (!fs.existsSync(p)) return { modules: [] };
  const box = { globalThis: {} }; vm.runInNewContext(fs.readFileSync(p, 'utf8'), box, { timeout: 2000 });
  return box.globalThis.LV_REGISTRY || box.LV_REGISTRY || { modules: [] };
}

/* ---------- the keyword library of any atlas ---------- */
const KEY = /(["']?)\b(kw[A-Za-z]{0,8}|neg[A-Za-z]{0,10})\1\s*:\s*([[{])/g;
const HEAD = ['id', 'key', 'short', 'label', 'name', 'title', 'line', 'path', 'slug', 'lang', 'why', 'cat', 'group', 'practice', 'service'];
const NAMED = ['id', 'label', 'short', 'name', 'title', 'path', 'slug'];
const LANG = { es: 'es', sp: 'es', spanish: 'es', en: 'en', english: 'en' };
const clean = s => s.trim().toLowerCase().replace(/^[["+]+|[\]"]+$/g, '').replace(/\s+/g, ' ');
const looksLikeTerms = list => list.length > 0 && list.every(x => x.length > 1 && x.length <= 90) && list.reduce((a, x) => a + x.length, 0) / list.length <= 48;

/* a list of terms: plain strings, or [term, match type] pairs as the shell atlases write them; null when it is neither */
function terms(text, open) {
  const close = matchClose(text, open); if (close === -1) return null; const out = [];
  for (const e of elements(text, open, close)) {
    let v = plain(text, e.start, e.end); if (Array.isArray(v)) v = v[0];
    if (typeof v !== 'string') return null; out.push(clean(v));
  }
  const list = [...new Set(out.filter(Boolean))]; return looksLikeTerms(list) ? list : null;
}
const head = (text, at) => { const r = record(text, at), o = {}; for (const k of HEAD) if (typeof r[k] === 'string' && r[k] && r[k].length <= 160) o[k] = r[k]; return o; };

/* every object that carries a keyword list: [{id, label, ..., lists: {kw: [...], kwq: [...], 'kw:es': [...]}}], in atlas
   order. A list inside a language block (es: {kw: [...]}) is filed under the angle that holds the block. */
export function harvest(text) {
  const groups = new Map(); let m; KEY.lastIndex = 0;
  while ((m = KEY.exec(text))) {
    const open = m.index + m[0].length - 1, found = {};
    if (text[open] === '[') { const l = terms(text, open); if (l) found[m[2]] = l; }
    else for (const f of fields(text, open)) if (text[f.start] === '[' && LANG[f.key.toLowerCase()]) { const l = terms(text, f.start); if (l) found[m[2] + ':' + LANG[f.key.toLowerCase()]] = l; }
    if (!Object.keys(found).length) continue;
    let owner = ownerOf(text, m.index, Math.max(0, m.index - 600000)); if (owner === -1) continue;
    let h = head(text, owner), lang = '';
    if (!NAMED.some(k => h[k])) {                                  /* a language block: file it under its angle */
      const up = ownerOf(text, owner, Math.max(0, owner - 600000));
      const f = up === -1 ? null : fields(text, up).find(x => x.start === owner);
      if (f && LANG[f.key.toLowerCase()]) { const hu = head(text, up); if (NAMED.some(k => hu[k])) { lang = LANG[f.key.toLowerCase()]; owner = up; h = hu; } }
    }
    let g = groups.get(owner); if (!g) groups.set(owner, g = Object.assign({ at: owner, lists: {} }, h));
    for (const [k, l] of Object.entries(found)) { const kk = lang && !k.includes(':') ? k + ':' + lang : k; g.lists[kk] = [...new Set([...(g.lists[kk] || []), ...l])]; }
  }
  return [...groups.values()].sort((a, b) => a.at - b.at).map(({ at, ...g }) => g);
}
/* the negative lists an atlas declares at the top level: {NEG_CUSTOMER: [...]} */
export function negatives(text) {
  const out = {}; const re = /\b(?:const|let|var)\s+(NEG\w*)\s*=\s*\[/g; let m;
  while ((m = re.exec(text))) { const l = terms(text, m.index + m[0].length - 1); if (l) out[m[1]] = l; }
  return out;
}

/* which list a key names: core terms, question terms, Spanish terms, a state's terms (kwTX), negatives */
function kindOf(k) {
  const [key, lang] = k.split(':');
  if (/^neg/i.test(key)) return 'negatives';
  if (lang === 'es' || /es$/i.test(key.slice(2))) return 'spanish';
  if (key === 'kw') return 'core';
  if (key === 'kwq') return 'questions';
  return key.slice(2).toLowerCase();
}
const titled = s => String(s).replace(/^\/+/, '').replace(/[-_/]+/g, ' ').replace(/^./, c => c.toUpperCase());
/* harvested groups as the angles of a pack; groups that repeat an id are merged */
export function anglesFrom(groups) {
  const byId = new Map(), out = [];
  for (const g of groups) {
    const kw = {}; for (const [k, v] of Object.entries(g.lists)) { const kind = kindOf(k); kw[kind] = [...new Set([...(kw[kind] || []), ...v])]; }
    if (!Object.keys(kw).some(k => k !== 'negatives')) continue;
    const name = g.label || g.name || g.title || g.short || (g.path ? titled(g.path) : '') || g.id; if (!name) continue;
    const id = String(g.id || g.key || g.slug || g.path || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'angle';
    let a = byId.get(id);
    if (!a) { a = { id, label: name }; for (const k of ['short', 'line', 'path', 'why', 'practice']) if (g[k]) a[k] = g[k]; a.keywords = {}; byId.set(id, a); out.push(a); }
    for (const [k, v] of Object.entries(kw)) a.keywords[k] = [...new Set([...(a.keywords[k] || []), ...v])];
  }
  return out;
}

/* ---------- the deep pack of a Thermal Debt atlas ---------- */
const round = (n, sig = 3) => { if (!n) return 0; const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.abs(n))) + 1 - sig)); return Math.round(n / p) * p; };
const N = n => Math.round(n).toLocaleString('en-US');
const median = a => { const s = a.filter(x => typeof x === 'number' && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

/* the atlas data block: window.__ATLAS_DATA__ = {...} on one line */
export function atlasData(text) {
  const at = text.indexOf('window.__ATLAS_DATA__'); if (at === -1) return null;
  const open = text.indexOf('{', at), end = text.indexOf('\n', open);
  const raw = text.slice(open, end === -1 ? undefined : end).replace(/;?\s*(<\/script>)?\s*$/, '');
  try { return JSON.parse(raw); } catch { const close = matchClose(text, open); return close === -1 ? null : JSON.parse(text.slice(open, close + 1)); }
}

/* a service angle's trigger as a function of a ZIP row, or null when it is not a plain comparison */
const SAFE = /^z\s*=>[\sA-Za-z0-9_.()[\]|&<>=!?:+\-*/%,]+$/;
export function trigger(src, MED) {
  if (typeof src !== 'string' || !SAFE.test(src)) return null;
  const ids = src.replace(/\.\s*[A-Za-z_]\w*/g, '').match(/[A-Za-z_]\w*/g) || [];
  if (ids.some(w => !['z', 'MED', 'Math', 'true', 'false'].includes(w))) return null;
  try { const f = vm.runInNewContext('(' + src + ')', { MED, Math }, { timeout: 200 }); return z => { try { return !!f(z); } catch { return false; } }; } catch { return null; }
}

/* objects of a literal array or object, each read as a record: [{...}] */
function recordsOf(text, open, raw = []) {
  if (open === -1) return [];
  const close = matchClose(text, open); if (close === -1) return [];
  if (text[open] === '[') return elements(text, open, close).filter(e => text[e.start] === '{').map(e => record(text, e.start, raw));
  return fields(text, open, close).filter(f => text[f.start] === '{').map(f => Object.assign({ _key: f.key }, record(text, f.start, raw)));
}

const SRC = {
  acs: 'U.S. Census Bureau, American Community Survey 2020 to 2024',
  est: 'Estimate from Census housing data and EIA RECS 2020 equipment ages',
  recs: 'Lifetime fit to the EIA Residential Energy Consumption Survey 2020, Texas homes',
  irv: 'City of Irving mechanical permits, 2022 to 2025',
  epa: 'U.S. Environmental Protection Agency',
};
/* a fact as the page may print it: the figure, what it counts, its source in full and in plain words, and the figure as a
   person would say it ("about one in five") */
const sayPct = sayShare, sayCount = x => sayNumber(x);
function sayValue(v) {
  const s = String(v), n = parseFloat(s.replace(/[$,]/g, ''));
  if (/%$/.test(s)) return sayPct(n);
  if (/years$/.test(s)) { const w = Math.floor(n), f = n - w; return f < 0.25 ? `about ${w} years` : f < 0.75 ? `about ${w} and a half years` : `about ${w + 1} years`; }
  if (/^\$/.test(s)) return 'about $' + sayCount(n).replace('about ', '');
  if (/^\d{4}$/.test(s)) return s;
  return Number.isFinite(n) ? sayCount(n) : s;
}
const fact = (value, label, src, grade) => ({ value, say: sayValue(value), label, source: SRC[src], plainSource: PLAIN_SOURCE[src] || '', grade, estimate: src === 'est' });


/* ---------- what each area needs, read from the heatmaps ---------- */
/* The dashboard draws its ZIP heatmaps from one catalog of layers (LAYERS: the age of the systems, the housing stock, the
   heating fuel, hail, who owns the homes). A need is a layer running hot in a ZIP, said twice: once for the homeowner,
   in the words a technician would use at the door, and once for the writer, with the parts and faults behind it. `hot`
   tests a ZIP row; pct is that ZIP's percentile on a layer among the metro's residential ZIPs. `copy: false` marks
   knowledge for planning that must not be said to a reader (never address a person's age or what they own). */
export const NEEDS = [
  { id: 'aging-systems', layers: ['ge15_sh', 'meanage'], angles: ['replace', 'repair'], title: 'A large share of systems past 15 years', hot: (z, p) => p.ge15_sh >= 75,
    owner: 'Once an air conditioner passes about 15 years, repairs come closer together and parts get harder to match. That is the age to price a replacement next to any big repair, so the choice is yours and not the weather\'s.',
    tech: 'Past the Texas median replacement age of about 15 years. Expect hard starting compressors, pitted contactors, weak capacitors, evaporator coil leaks, and indoor coils that match no condenser sold today.' },
  { id: 'past-twenty', layers: ['ge20_sh'], angles: ['replace', 'r22'], title: 'Many systems 20 years or older', hot: (z, p) => p.ge20_sh >= 80,
    owner: 'A system past 20 is on borrowed time. Most of them use the old R22 refrigerant, and a new outdoor unit will not pair with the old indoor coil, so one major failure usually means replacing both halves.',
    tech: 'R22 charge, mismatched coils, fixed orifice metering, single stage compressors past rated life. A compressor or coil failure is a full system replacement, not a part swap.' },
  { id: 'r22', layers: ['r22_sh'], angles: ['r22', 'replace'], title: 'R22 era systems still running', hot: (z, p) => p.r22_sh >= 75,
    owner: 'Systems put in before 2010 run on R22. Nobody makes it any more, so a leak means paying for a shrinking supply of reclaimed refrigerant or replacing the system. The data plate on the outdoor unit tells you which refrigerant you have.',
    tech: 'New R22 equipment ended in 2010 and production ended in 2020; only reclaimed stock remains. No drop in: R410A and the A2L refrigerants (R454B, R32) need their own coil, metering device and oil.' },
  { id: 'builder-original', layers: ['origwin_sh', 'first5_per1k'], angles: ['firstwave', 'replace', 'repair'], title: 'Builder original systems, 10 to 25 years old', hot: (z, p) => p.origwin_sh >= 75,
    owner: 'Many homes here still run the system the builder put in. Those tend to fail in a known order: the capacitor, then the contactor, then the indoor coil. The first replacement is also your one chance to get the size right.',
    tech: 'Builder grade equipment in its first failure window. Often oversized: short cycling, poor humidity control, hot upstairs rooms. Replacement should start from a load calculation (Manual J), not the old tonnage.' },
  { id: 'flex-duct', layers: ['yb_duct'], angles: ['duct'], title: 'Homes from the 1980s and 1990s: aging flexible duct', hot: (z, p) => p.yb_duct >= 75,
    owner: 'Homes built in the 1980s and 1990s got flexible duct in the attic. After 27 to 46 Texas summers it sags, leaks at the joints and sheds its insulation, so some rooms never catch up. A new system on leaky ducts will disappoint you.',
    tech: 'The flex duct generation, in attics that reach 140 degrees: torn inner liners, crushed runs, loose boots and plenums, high static pressure. Test the ducts whenever equipment is replaced.' },
  { id: 'before-1980', layers: ['yb_pre1980'], angles: ['ductless', 'duct', 'replace'], title: 'Homes built before 1980', hot: (z, p) => p.yb_pre1980 >= 75,
    owner: 'Many homes here went up before 1980, when central air often came later as an add on. Ducts can be too small, a few rooms may have none, and an older electrical panel can limit your choices for a heat pump.',
    tech: 'Retrofit central air: undersized returns, long duct runs through tight framing, 100 amp panels that cannot carry strip heat or a large heat pump. Ductless mini splits suit additions and rooms the ducts never reached.' },
  { id: 'boom-2000s', layers: ['yb_2000_09'], angles: ['firstwave', 'replace'], title: 'Homes from the 2000 to 2009 building boom', hot: (z, p) => p.yb_2000_09 >= 75,
    owner: 'A big share of homes here went up between 2000 and 2009. Their original systems are now 17 to 26 years old, which puts them squarely in replacement age.',
    tech: 'The first Dallas Fort Worth builder boom. R22 on the early years, R410A after; 10 and 13 SEER condensers; original furnaces nearing heat exchanger age.' },
  { id: 'homes-2010s', layers: ['yb_2010_19'], angles: ['repair', 'maint'], title: 'Homes from the 2010s: first parts failing', hot: (z, p) => p.yb_2010_19 >= 75,
    owner: 'Homes from the 2010s have reached the age when the first parts give out: a capacitor, a contactor, sometimes the indoor coil. Most of these are repairs, not replacements.',
    tech: 'R410A systems 7 to 16 years old: capacitor and contactor wear, early evaporator coil leaks, condensate switch trips. Worth a repair in nearly every case.' },
  { id: 'new-homes', layers: ['yb_2020p'], angles: ['maint', 'newowner'], title: 'Homes built since 2020', hot: (z, p) => p.yb_2020p >= 75,
    owner: 'Newer homes here are young enough that the maker\'s parts warranty may still apply. What matters now is upkeep, clean filters and fixing weak airflow early, before a small flaw from the build wears the equipment.',
    tech: 'Warranty territory: maintenance and airflow corrections, not replacements. Common build flaws: kinked flex runs, undersized returns, low refrigerant charge from the factory line set length.' },
  { id: 'older-furnaces', layers: ['furn20_sh', 'gas_sh'], angles: ['furnace', 'heatrepair', 'heattune'], title: 'Gas furnaces 20 years or older', hot: (z, p) => p.furn20_sh >= 75 && z.gas_sh >= 30,
    owner: 'A good share of gas furnaces here are past 20 years. At that age the heat exchanger and the flame safety parts deserve a look every fall, before the first cold night.',
    tech: 'Heat exchanger cracks, flame rollout, tired inducer motors, dirty flame sensors and worn ignitors. Carbon monoxide risk rises with exchanger age. Texas gas furnaces are typically replaced at about 18 years.' },
  { id: 'gas-heat', layers: ['gas_sh'], angles: ['heatrepair', 'furnace'], title: 'Most homes heat with gas', hot: z => z.gas_sh >= 60,
    owner: 'Most homes here heat with gas, so a winter call is usually a furnace call: a burner that will not light, or a furnace that starts and then quits.',
    tech: 'Gas furnace faults: ignitor, flame sensor, pressure switch, inducer, limit switch, control board. A furnace that lights and shuts off is protecting itself.' },
  { id: 'electric-heat', layers: ['elec_sh', 'hp_sh'], angles: ['heatpump', 'eheat', 'heatrepair'], title: 'Most homes heat with electricity', hot: z => z.elec_sh >= 60,
    owner: 'Most homes here heat with electricity, through a heat pump or an electric furnace with heat strips. When a heat pump falls behind, the strips cover for it, and you see it on the bill before you feel it in the house.',
    tech: 'Heat pumps (reversing valve, defrost control, low charge) and air handlers with strip heat (sequencers, elements, breakers). Auxiliary heat that never shuts off points to a heat pump that is not keeping up.' },
  { id: 'heat-pumps', layers: ['hp_sh'], angles: ['heatpump'], title: 'Heat pumps are common', hot: z => z.hp_sh >= 35,
    owner: 'Heat pumps are common here. One runs all year, cooling in summer and heating in winter, so it wears faster than an air conditioner that rests half the year.',
    tech: 'Year round duty cycle. Texas heat pumps are typically replaced at about 13 and a half years. Watch defrost boards, reversing valves and outdoor fan motors.' },
  { id: 'hail', layers: ['hail175_8km', 'hail_recent', 'hail1_8km'], angles: ['hail'], title: 'Large hail falls here often', hot: (z, p) => p.hail175_8km >= 75 || z.hail_recent >= 6,
    owner: 'Large hail falls here more often than in most of the metro. It flattens the thin fins on the outdoor unit, and a unit can keep running for months with less cooling and a higher bill before anyone looks.',
    tech: 'Golf ball size hail crushes condenser fins: less airflow, higher head pressure, shorter compressor life. Fins can be combed straight when the tubes are sound; a split tube means a coil. The insurer decides coverage; never offer to handle a claim.' },
  { id: 'new-owners', layers: ['own_recent_sh'], angles: ['newowner', 'maint'], title: 'Many owners bought since 2020', hot: (z, p) => p.own_recent_sh >= 75,
    owner: 'Many owners here bought since 2020. If that is you, the system came with the house and no history. Learn its age and its refrigerant before the first hot week.',
    tech: 'No maintenance record. The serial number on the data plate usually codes the year of manufacture; the plate also names the refrigerant. A first visit sets a baseline.' },
  { id: 'larger-homes', layers: ['rooms', 'value'], angles: ['premium', 'ductless'], title: 'Larger homes', hot: (z, p) => p.rooms >= 80 || p.value >= 85,
    owner: 'Homes here run larger than most, which usually means more cooling capacity and often a second system for the upstairs. Rooms far from the unit are the first to run warm.',
    tech: 'Median rooms is a tonnage proxy: multiple systems, zoning dampers, long duct runs. Variable speed and two stage equipment hold temperature and humidity more evenly in large floor plans.', inferred: true },
  { id: 'rentals', layers: ['rent_sf_sh'], angles: ['landlord'], title: 'Many single family homes are rentals', hot: (z, p) => p.rent_sf_sh >= 75, copy: false,
    owner: '', tech: 'A tenant makes the call and an owner or manager decides. Plan a page for property managers instead of addressing renters on a homeowner page.' },
  { id: 'older-owners', layers: ['own65_sh'], angles: ['maint'], title: 'Many owners are 65 or older', hot: (z, p) => p.own65_sh >= 75, copy: false,
    owner: '', tech: 'Heat is a health risk here, not only a comfort issue. Lead with planning ahead and maintenance. Never address a reader\'s age in copy.' },
  { id: 'spanish', layers: ['span_sh'], angles: [], title: 'Many Spanish speaking households', hot: z => z.span_sh >= 25, copy: false,
    owner: '', tech: 'Consider a Spanish page written natively, not translated. The dashboard\'s Site Forge builds one from the same plan.' },
];
const LAYER_USE = ['idx', 'ge15_sh', 'ge20_sh', 'meanage', 'rep_per1k', 'origwin_sh', 'first5_per1k', 'r22_sh', 'furn20_sh', 'medyr', 'yb_pre1980', 'yb_duct', 'yb_2000_09', 'yb_2010_19', 'yb_2020p', 'gas_sh', 'elec_sh', 'hp_sh', 'hail1_8km', 'hail175_8km', 'hail_recent', 'own_recent_sh', 'own65_sh', 'rent_sf_sh', 'span_sh', 'rooms', 'value', 'inc'];
/* the layers a page may draw a ZIP's figures from */
const AREA_VALUES = ['idx', 'ge15_sh', 'ge20_sh', 'r22_sh', 'origwin_sh', 'furn20_sh', 'yb_pre1980', 'yb_duct', 'yb_2000_09', 'yb_2010_19', 'yb_2020p', 'gas_sh', 'elec_sh', 'hp_sh', 'hail175_8km', 'hail_recent', 'own_recent_sh'];
export const PLAIN_SOURCE = { acs: 'Census figures', est: 'by one estimate', recs: 'federal energy surveys', irv: 'city permit records', epa: 'EPA rules', storm: 'storm reports' };
export const miles = (a, b) => { const R = 3958.8, r = x => x * Math.PI / 180, dl = r(b.lat - a.lat), dn = r(b.lon - a.lon), h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

/* the layer catalog as the pack carries it, and every residential ZIP read against it: {layers, zips: Map(zip -> {values, pct, needs})} */
export function readHeatmaps(text, ZR) {
  const at = declared(text, 'LAYERS'), layers = {};
  if (at !== -1) for (const f of fields(text, at)) { if (text[f.start] !== '{' || !LAYER_USE.includes(f.key)) continue; const r = record(text, f.start); layers[f.key] = { label: r.l || f.key, group: r.grp || '', grade: r.g || '', note: typeof r.note === 'string' ? r.note : '' }; }
  for (const k of LAYER_USE) if (!layers[k] && ZR.some(z => typeof z[k] === 'number')) layers[k] = { label: k, group: '', grade: '', note: '' };
  const sorted = {}; for (const k of Object.keys(layers)) sorted[k] = ZR.map(z => z[k]).filter(v => typeof v === 'number' && !Number.isNaN(v)).sort((a, b) => a - b);
  const pctOf = (k, v) => { const s = sorted[k]; if (!s || !s.length || typeof v !== 'number') return null; let lo = 0, hi = s.length; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < v) lo = m + 1; else hi = m; } let up = lo; while (up < s.length && s[up] === v) up++; return Math.round(100 * ((lo + up) / 2) / s.length); };
  const zips = new Map();
  for (const z of ZR) {
    const pct = {}, values = {}; for (const k of Object.keys(layers)) { if (typeof z[k] !== 'number') continue; values[k] = Math.round(z[k] * 10) / 10; pct[k] = pctOf(k, z[k]); }
    if (pct.medyr != null) pct.medyr = 100 - pct.medyr;                                           /* older stock reads hotter */
    zips.set(z.zip, { values, pct, needs: NEEDS.filter(n => { try { return !!n.hot(z, pct); } catch { return false; } }).map(n => n.id) });
  }
  return { layers, zips };
}

/* what the whole market looks like on each layer (a mean weighted by systems), so a city can be read against it,
   and the share of the market's systems that sit in ZIPs where a need runs hot */
function baseline(HM, ZR) {
  const out = {};
  for (const [k, l] of Object.entries(HM.layers)) { let n = 0, w = 0; for (const z of ZR) if (typeof z[k] === 'number' && z.sys > 0) { n += z[k] * z.sys; w += z.sys; } out[k] = Object.assign({}, l, { metro: w ? Math.round(10 * n / w) / 10 : null }); }
  return out;
}
function metroShare(id, HM, ZR) { let hot = 0, all = 0; for (const z of ZR) { const s = z.sys || 0; all += s; if ((HM.zips.get(z.zip) || { needs: [] }).needs.includes(id)) hot += s; } return all ? Math.round(100 * hot / all) : 0; }

/* one city read against the heatmaps: its ZIPs with what runs hot in each, and its needs in order.
   A need counts for the city when it is hot in ZIPs that hold a third of the city's systems; one that is hot in less is
   still listed, with the ZIPs it belongs to, because that is what lets a page speak to one part of town. */
function areaNeeds(c, rows, HM, NEED) {
  const total = rows.reduce((n, z) => n + (z.sys || 0), 0) || 1;
  const areas = rows.map(z => { const h = HM.zips.get(z.zip) || { values: {}, pct: {}, needs: [] }, v = h.values, keep = k => AREA_VALUES.includes(k);
    return { zip: z.zip, share: Math.round(100 * (z.sys || 0) / total), builtAround: v.medyr ? Math.round(v.medyr) : null, needs: h.needs,
      values: Object.fromEntries(Object.entries(v).filter(([k]) => keep(k))), heat: Object.fromEntries(Object.entries(h.pct).filter(([k]) => keep(k))) };
  }).sort((a, b) => b.share - a.share);
  const needs = Object.keys(NEED).map(id => { const z = areas.filter(a => a.needs.includes(id)), share = z.reduce((n, a) => n + a.share, 0); return { id, share: Math.min(100, share), zips: z.map(a => a.zip), citywide: share >= 34 }; })
    .filter(n => n.zips.length).sort((a, b) => b.share - a.share);
  return { areas, needs };
}

/* how the Satchel's copy rules are tested here: the patterns are this toolkit's own reading of each rule, matched by id */
const RULE_TESTS = {
  TDLR2: { pattern: '\\b(proposals?|estimates?|invoices?|contracts?|financ\\w+)\\b', unless: 'Texas Department of Licensing and Regulation', per: 'page' },
  TAX1: { pattern: '(tax credit|\\b25C\\b|federal rebate|IRA rebate|inflation reduction act)', unless: '(ended|expired|lapsed|no longer|not available|terminated|does not qualify)', per: 'sentence' },
  REGZ1: { pattern: '(\\b\\d{1,3}\\s*(monthly\\s*)?payments?\\b|\\$\\s?\\d[\\d,]*\\s*(\\/|a|per)\\s*(mo|month)\\b|\\d+(\\.\\d+)?%\\s*(apr|interest|financing)|down payment|no interest|interest free|\\d+\\s*months?\\s*(no|0%|same as cash))', unless: '\\bAPR\\b[\\s\\S]*\\b(terms|approval)\\b|\\b(terms|approval)\\b[\\s\\S]*\\bAPR\\b', per: 'page' },
  FREE1: { pattern: '\\bfree\\b[^.]{0,40}' },
  GUAR1: { pattern: '\\b(guarantee[ds]?|guaranteed|warrant(y|ies)|lifetime (warranty|guarantee|coverage|protection|service))\\b[^.]{0,40}', unless: '(terms|details|conditions)', per: 'page' },
  SUP1: { pattern: '(#\\s?1\\b|number one|\\bbest (hvac |ac |a\\/c |heat pump |heating |cooling |furnace |air conditioning )?(repair|service|company|contractor|team|prices?|installers?|technicians?|techs?)\\b|\\bbest (hvac|ac|price|in )|lowest price|cheapest|top rated|highest rated|most trusted|beat any price)' },
  REV1: { pattern: '(\\d[\\d,]{2,}\\+?\\s*(five|5)\\s*star|\\b[45](\\.\\d)?\\s*stars?\\b|five star rated|5 star rated)' },
  URG1: { pattern: '(only \\d+ (spots|slots|units|left)|offer ends in|today only|act now|last chance|expires tonight)' },
  R22A: { pattern: '(r[\\s-]?22|r[\\s-]?410a|freon)[^.]{0,40}(illegal|banned to use|must be replaced|outlawed|no longer legal)' },
  INS1: { pattern: "(we (will |can |)(handle|negotiate|manage|settle) (your |the )?(insurance )?claim|deal with your insurance( company)?|work(s)? directly with your insurance|we'?ll handle the claim|waive (your |the )?deductible|pay (your |the )?deductible)" },
  EFF1: { pattern: '\\b(seer2?|eer2?|hspf2?|afue)\\b\\s*(of|rating of|:)?\\s*\\d{1,2}(\\.\\d)?(?!\\d)|\\b\\d{1,2}(\\.\\d)?\\s*(seer2?|eer2?|hspf2?)\\b' },
  ES1: { pattern: 'energy\\s?star' },
  LIC2: { pattern: '(licensed (and|&) insured|bonded|nate certified|epa certified|factory authori[sz]ed|elite dealer|diamond contractor)' },
  AVL1: { pattern: '(24\\/7|24 hours|around the clock|same day|open 7 days)' },
  SMS1: { pattern: "(text you|we'?ll text|send you texts|sms updates|text message offers)", unless: '(consent|stop to opt out|reply stop|not a condition)', per: 'page' },
  META1: { pattern: '(your (credit|debt|finances)|bad credit|are you (broke|struggling)|behind on bills)', scope: 'social' },
};

export function isThermalDebt(text) { return text.includes('window.__ATLAS_DATA__') && /\bconst ANGLES\s*=\s*\[/.test(text) && /"zcols"\s*:/.test(text); }

/* {pack, brand}: the vertical pack and the brand the atlas was built for (the brand never goes into the pack) */
export function deepPack(text, { id = 'dfw', file = '' } = {}) {
  const D = atlasData(text); if (!D) throw new Error('no atlas data block (window.__ATLAS_DATA__) in this file');
  const Z = D.zrows.map(r => { const o = {}; D.zcols.forEach((c, i) => { o[c] = r[i]; }); return o; });
  const ZR = Z.filter(z => (z.sys || 0) > 0 && z.idx != null);
  const MED = { inc: median(ZR.map(z => z.inc)), value: median(ZR.map(z => z.value)) };
  const title = ((/<title>([^<]*)<\/title>/.exec(text) || [])[1] || '').trim();
  const build = (/\bBuild\s+(\d+)/i.exec(title) || [])[1] || null;

  /* the service angles, with where each one has demand */
  const forge = {}; for (const r of recordsOf(text, declared(text, 'AC', text.indexOf('const FCOPY')))) if (r._key && r.slug) forge[r._key] = r;
  const angles = recordsOf(text, declared(text, 'ANGLES'), ['trig']).map(a => {
    const fn = trigger(a.trig, MED), hit = fn ? ZR.filter(fn) : [];
    const F = forge[a.id] || {};
    const o = { id: a.id, label: a.label, short: a.short, line: a.line, path: a.path, page: F.slug ? { slug: F.slug, h1: F.h1n, h1City: F.h1 } : null, why: a.why,
      keywords: { core: (a.kw || []).filter(k => !k.includes('{city}')), city: (a.kw || []).filter(k => k.includes('{city}')), questions: a.kwq || [] }, lsa: a.lsa || [] };
    if (fn) o.reach = { zips: hit.length, of: ZR.length, systems: round(hit.reduce((s, z) => s + (z.sys || 0), 0)), replacementsPerYear: round(hit.reduce((s, z) => s + (z.rep || 0), 0)) };
    o._hit = new Set(hit.map(z => z.zip));
    return o;
  }).filter(a => a.id && a.label);
  const lines = {}; for (const r of recordsOf(text, declared(text, 'LINES'))) if (r._key) lines[r._key] = { label: r.l, angles: r.angles || [], objective: r.obj };

  /* the cities: sourced facts as the Site Forge prints them, and the angles with demand there */
  const HM = readHeatmaps(text, ZR), NEED = Object.fromEntries(NEEDS.map(n => [n.id, n]));
  const cities = (D.cities || []).filter(c => c.sys > 0).map(c => {
    const zs = (c.zips || []).filter(z => ZR.some(r => r.zip === z)), pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
    const ge15 = pct(c.ge15, c.sys), orig = pct(c.orig_win, c.sys);
    const mine = ZR.filter(z => zs.includes(z.zip)), sum = k => mine.reduce((n, z) => n + (z[k] || 0), 0), hp = pct(sum('sys_hp'), sum('sys'));
    return {
      name: c.name, county: c.cty, pop: c.pop, housingUnits: c.hu, zips: c.zips || [], lat: c.lat, lon: c.lon,
      demand: { systems: round(c.sys), aged15: round(c.ge15), aged15Share: ge15, replacementsPerYear: round(c.rep), r22: round(c.r22), opportunityUsd: round(c.opp_usd) },
      facts: [
        fact(N(round(c.sys)), `central systems estimated in ${c.name} homes`, 'est', 'C'),
        fact(ge15 + '%', `of ${c.name} central systems are 15 years or older, about ${N(round(c.ge15))}`, 'est', 'C'),
        fact(N(round(c.rep)), `system replacements a year expected in ${c.name} at typical Texas lifetimes`, 'est', 'C'),
        fact(N(round(c.r22)), `systems in ${c.name} installed before 2010, the R22 era`, 'est', 'C'),
        fact(orig + '%', `of ${c.name} systems are the builder original, now 10 to 25 years old`, 'est', 'C'),
        fact(N(round(c.furn20)), `gas furnaces in ${c.name} estimated at 20 years or older`, 'est', 'C'),
        fact(String(c.medyr), `median year ${c.name} homes were built`, 'acs', 'A'),
        fact(c.gas_sh + '%', `of ${c.name} homes heat with natural gas`, 'acs', 'A'),
        hp ? fact(hp + '%', `of ${c.name} central systems estimated to be heat pumps`, 'est', 'C') : null,
      ].filter(f => f && f.value && f.value !== '0' && f.value !== '0%'),
      angles: zs.length ? angles.map(a => ({ id: a.id, share: Math.round(100 * zs.filter(z => a._hit.has(z)).length / zs.length) })).filter(x => x.share > 0).sort((x, y) => y.share - x.share) : [],
      ...areaNeeds(c, mine, HM, NEED),
    };
  }).sort((a, b) => b.demand.replacementsPerYear - a.demand.replacementsPerYear);
  /* the cities next door, nearest first */
  for (const c of cities) c.neighbors = cities.filter(o => o !== c && o.lat && c.lat).map(o => ({ name: o.name, miles: Math.round(miles(c, o)) })).sort((a, b) => a.miles - b.miles).slice(0, 6);
  for (const a of angles) { a.topCities = cities.filter(c => c.angles.some(x => x.id === a.id && x.share >= 50)).slice(0, 12).map(c => c.name); delete a._hit; }

  const M = D.meta || {}, W = (M.weib_all || {}), T = D.tickets || {};
  const market = {
    name: 'Dallas Fort Worth', state: 'TX', counties: (D.counties || []).map(c => ({ name: c.name, pop: c.pop, systems: round(c.sys), aged15: round(c.ge15), replacementsPerYear: round(c.rep) })),
    facts: [
      fact(N(round(M.sys)), 'central systems estimated in Dallas Fort Worth homes', 'est', 'C'),
      fact(N(round(M.ge15)), 'central systems in Dallas Fort Worth homes estimated at 15 years or older', 'est', 'C'),
      fact(N(round(M.r22)), 'Dallas Fort Worth systems installed before 2010, the R22 era', 'est', 'C'),
      fact(N(round(M.rep)), 'central system replacements a year expected across the 12 county area', 'est', 'C'),
      W.AC_TX && fact(W.AC_TX.median + ' years', 'median age at replacement for a Texas central air conditioner', 'recs', 'B'),
      W.GasFurn_TX && fact(W.GasFurn_TX.median + ' years', 'median age at replacement for a Texas gas furnace', 'recs', 'B'),
      W.HP_TX && fact(W.HP_TX.median + ' years', 'median age at replacement for a Texas heat pump', 'recs', 'B'),
      T.median && fact('$' + N(T.median), `median declared value on ${N(T.n)} full system replacement permits in Irving, 2022 to 2025`, 'irv', 'B'),
      fact('2020', 'the year R22 production and import ended in the United States', 'epa', 'A'),
      fact('2025', 'new split systems made since January 1 use A2L refrigerants such as R454B or R32', 'epa', 'A'),
    ].filter(Boolean),
  };

  /* the pages the Site Forge plans: they own their keywords before they are live */
  const guides = recordsOf(text, declared(text, 'GUIDES', text.indexOf('const FCOPY'))).filter(g => g.id && g.h1).map(g => ({ id: g.id, scope: g.scope, label: g.label, h1: g.h1, title: g.title }));
  const sitePlan = {
    service: angles.filter(a => a.page).map(a => ({ angle: a.id, slug: a.page.slug, h1: a.page.h1 })),
    patterns: { city: '{city}-hvac', county: '{county}-county-hvac', landing: 'lp-{service}-{city} (campaign pages, noindex)', guide: 'the guide headline as a slug' },
    guides,
  };

  /* the Satchel: who enforces what on copy that leaves the atlas */
  const sat = declared(text, 'SAT'); const rules = [];
  if (sat !== -1) { const f = fields(text, sat).find(x => x.key === 'rules'); if (f) for (const r of recordsOf(text, f.start)) { if (!r.id || !r.name || r.fam === 'House style') continue; const o = { id: r.id, enforcer: r.fam, severity: r.sev, name: r.name, cite: r.cite, fix: r.fix }; if (r.scope) o.scope = r.scope; if (RULE_TESTS[r.id]) o.test = RULE_TESTS[r.id]; rules.push(o); } }
  const notice = (/const NOTICE\s*=\s*'([^']+)'/.exec(text) || [])[1] || null, consent = (/const CONSENT\s*=\s*'([^']+)'/.exec(text) || [])[1] || null;

  const brandAt = declared(text, 'BRAND_DEFAULT'), B = brandAt === -1 ? null : record(text, brandAt);
  if (B) for (const f of fields(text, brandAt)) if (text[f.start] === '{') B[f.key] = record(text, f.start);

  const pack = {
    id, depth: 'deep', vertical: 'HVAC', wing: 'home', atlas: 'DFW Thermal Debt Atlas' + (build ? ' · Build ' + build : ''), scope: 'Dallas Fort Worth, Texas: 12 counties',
    source: { file: path.basename(file || ''), build, compiled: M.compiled || null, sha256: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16), extracted: new Date().toISOString().slice(0, 10) },
    schemaType: 'HVACBusiness', licenseLabel: 'TDLR',
    note: 'No keyword volumes are in the atlas. Keywords are the atlas\'s own library per service angle; an angle ranks by where the model finds demand for it (reach, and each city\'s share of ZIPs that trigger it).',
    lines, angles, negatives: negatives(text), market, cities, sitePlan,
    layers: baseline(HM, ZR), needs: NEEDS.map(n => ({ id: n.id, title: n.title, layers: n.layers, angles: n.angles, owner: n.owner, tech: n.tech, copy: n.copy !== false, inferred: !!n.inferred, metro: metroShare(n.id, HM, ZR) })),
    compliance: { licenseInEveryAsset: rules.some(r => r.id === 'TDLR1'), licensePattern: 'TAC\\s?L\\s?[A-Z]\\s?\\d{4,}', notice, consent, rules },
  };
  return { pack, brand: B };
}

/* the brand as the toolkit reads it, from an atlas's BRAND_DEFAULT */
export function brandProfile(B) {
  if (!B) return null; const s = B.social || {};
  return {
    name: B.name, short: B.short, legalName: B.legal, tagline: B.tagline, phone: B.phone, url: B.url, domain: B.domain, email: B.email || '',
    license: B.lic, licenseLabel: 'TDLR', address: { street: B.street, city: B.city, state: B.state, zip: B.zip }, geo: { lat: B.lat, lon: B.lon },
    hours: B.hours, hoursSchema: B.hoursSchema, founded: B.founded, since: B.since || '', dealer: B.dealer || [], logo: B.logoUrl, colors: B.colors || {}, fonts: B.fonts || {},
    services: B.services || [], serviceCities: B.serviceCities || [], plan: B.plan, financing: B.financing,
    sameAs: [s.facebook, s.instagram, s.youtube, s.linkedin, s.tiktok, s.x, s.yelp, s.maps].filter(Boolean),
    social: { facebookPageId: s.facebookPageId || '', gbpAccountId: '', gbpLocationId: '' },
  };
}

/* ---------- writing packs ---------- */
/* CS_PACKS moves the packs, so that a test can connect a dashboard without rewriting the ones in the repository */
export const PACKS = process.env.CS_PACKS ? path.resolve(process.env.CS_PACKS) : path.join(HERE, 'verticals');
export function loadPack(id) { const p = path.join(PACKS, id + '.json'); if (!fs.existsSync(p)) throw new Error(`no vertical pack "${id}" (run: node content-strategist/cli.mjs verticals)`); return JSON.parse(fs.readFileSync(p, 'utf8')); }
export function listPacks() { const p = path.join(PACKS, 'index.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { packs: [] }; }
export async function writePack(pack) {
  const s = await scrub(pack); fs.mkdirSync(PACKS, { recursive: true });
  fs.writeFileSync(path.join(PACKS, pack.id + '.json'), JSON.stringify(s.value, null, 1) + '\n');
  const idx = listPacks(), row = { id: pack.id, depth: pack.depth, vertical: pack.vertical, wing: pack.wing, atlas: pack.atlas, scope: pack.scope || '', angles: pack.angles.length, keywords: pack.angles.reduce((n, a) => n + Object.entries(a.keywords).filter(([k]) => k !== 'negatives').reduce((m, [, v]) => m + v.length, 0), 0) };
  idx.packs = [...(idx.packs || []).filter(x => x.id !== pack.id), row].sort((a, b) => (a.wing + a.id).localeCompare(b.wing + b.id));
  fs.writeFileSync(path.join(PACKS, 'index.json'), JSON.stringify(idx, null, 1) + '\n');
  return { dropped: s.dropped, checked: s.checked, row };
}

/* a keyword pack for each atlas in the console */
export async function harvestConsole(repo = REPO) {
  const reg = registry(repo), out = [];
  for (const p of consolePayloads(repo)) {
    const mod = (reg.modules || []).find(m => m.id === p.id); if (!mod || mod.wing === 'core') continue;
    const have = path.join(PACKS, p.id + '.json');                 /* a deep pack built from a newer atlas file stands */
    if (fs.existsSync(have) && JSON.parse(fs.readFileSync(have, 'utf8')).depth === 'deep') { out.push({ pack: { id: p.id }, kept: 'deep' }); continue; }
    const angles = anglesFrom(harvest(p.text));
    const pack = { id: p.id, depth: 'keywords', vertical: mod.vertical || mod.short, wing: mod.wing, atlas: mod.title || mod.short, scope: mod.scope || '', source: { file: p.file + '#' + p.id, compiled: reg.compiled || null, extracted: new Date().toISOString().slice(0, 10) },
      note: 'Keyword library lifted from the atlas\'s ad and page copy. No keyword volumes are in the atlas.', angles, negatives: negatives(p.text) };
    out.push(Object.assign({ pack }, await writePack(pack)));
  }
  return out;
}
