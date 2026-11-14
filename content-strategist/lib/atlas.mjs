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
const fact = (value, label, src, grade) => ({ value, label, source: SRC[src], grade, estimate: src === 'est' });

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
    };
  }).sort((a, b) => b.demand.replacementsPerYear - a.demand.replacementsPerYear);
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
    hours: B.hours, hoursSchema: B.hoursSchema, founded: B.founded, logo: B.logoUrl, colors: B.colors || {}, fonts: B.fonts || {},
    services: B.services || [], serviceCities: B.serviceCities || [], plan: B.plan, financing: B.financing,
    sameAs: [s.facebook, s.instagram, s.youtube, s.linkedin, s.tiktok, s.x, s.yelp, s.maps].filter(Boolean),
    social: { facebookPageId: s.facebookPageId || '', gbpAccountId: '', gbpLocationId: '' },
  };
}

/* ---------- writing packs ---------- */
export const PACKS = path.join(HERE, 'verticals');
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
