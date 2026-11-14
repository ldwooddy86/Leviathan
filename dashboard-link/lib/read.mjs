/* Reads a dashboard file as text. Nothing in it is run.

   A Thermal Debt atlas is one HTML file: a data block, the shared layers (service angles with their keywords and ad
   copy, the advertising rules, the brand it was built for) and one script per module. This reader lifts out what an agent
   needs to work with it: what the dashboard is, which modules it carries, which doors it has for work coming back, the
   paid library the Campaign Desk writes from and the ZIP by ZIP model it buys from.

   The only code evaluated is the one line trigger of each service angle, through the content strategist's whitelist
   (content-strategist/lib/atlas.mjs: trigger). Everything else is read as a literal. */
import crypto from 'node:crypto';
import path from 'node:path';
import { fields, elements, plain, matchClose, declared, skipString } from '../../content-strategist/lib/literal.mjs';
import { atlasData, trigger, isThermalDebt } from '../../content-strategist/lib/atlas.mjs';

export { isThermalDebt };

/* ---------- literals ---------- */
/* A value as data, nested: objects, arrays, strings, numbers, booleans. A function, an expression or a template that
   interpolates is undefined and is left out of whatever holds it. `raw` lists keys to bring back as source text. */
export function deep(t, start, end, raw = []) {
  while (start < end && /\s/.test(t[start])) start++;
  const c = t[start];
  if (c === '{') {
    const e = matchClose(t, start); if (e === -1 || t.slice(e + 1, end).trim()) return undefined;
    const o = {};
    for (const f of fields(t, start, e)) {
      if (raw.includes(f.key)) { o[f.key] = t.slice(f.start, f.end).trim(); continue; }
      const v = deep(t, f.start, f.end, raw); if (v !== undefined) o[f.key] = v;
    }
    return o;
  }
  if (c === '[') {
    const e = matchClose(t, start); if (e === -1 || t.slice(e + 1, end).trim()) return undefined;
    return elements(t, start, e).map(x => deep(t, x.start, x.end, raw)).filter(v => v !== undefined);
  }
  return plain(t, start, end);
}
/* the literal a declaration opens (const NAME = [ ... ] or { ... }), or undefined */
export function literal(t, name, raw = [], from = 0) {
  const open = declared(t, name, from); if (open === -1) return undefined;
  const close = matchClose(t, open); if (close === -1) return undefined;
  return deep(t, open, close + 1, raw);
}
/* a template literal with its interpolations filled from `fill` (source text of the expression -> value); an expression
   that is not in `fill` becomes an ellipsis */
export function template(t, start, fill = {}) {
  if (t[start] !== '`') return undefined;
  const end = skipString(t, start); let out = '', i = start + 1;
  while (i < end - 1) {
    if (t[i] === '\\') { out += t[i + 1]; i += 2; continue; }
    if (t[i] === '$' && t[i + 1] === '{') { const e = matchClose(t, i + 1); if (e === -1) break; const src = t.slice(i + 2, e).trim(); out += src in fill ? String(fill[src]) : '…'; i = e + 1; continue; }
    out += t[i++];
  }
  return out;
}

const sha = (s, n = 12) => crypto.createHash('sha256').update(s).digest('hex').slice(0, n);
const median = a => { const s = a.filter(x => typeof x === 'number' && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

/* ---------- what the file is ---------- */
/* The page title reads "<client> · <atlas name> · Build <n>". The client part stays out of what this returns unless asked
   for, because identity is printed and saved in places a client name must not reach. */
export function identity(text, file = '') {
  const title = ((/<title>([^<]*)<\/title>/.exec(text.slice(0, 6000)) || [])[1] || '').trim();
  const parts = title.split('·').map(s => s.trim()).filter(Boolean);
  const atlas = parts.find(p => /atlas/i.test(p)) || '';
  const build = (/\bBuild\s+(\d+(?:\.\d+)*)/i.exec(title) || [])[1] || null;
  const D = atlasData(text), M = (D && D.meta) || {};
  return {
    file: file ? path.resolve(file) : '', name: file ? path.basename(file) : '', bytes: Buffer.byteLength(text),
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
    atlas: atlas || (isThermalDebt(text) ? 'Thermal Debt Atlas' : ''), build, compiled: M.compiled || null,
    family: isThermalDebt(text) ? 'thermal-debt' : 'unknown',
    zips: D && D.zrows ? D.zrows.length : 0, counties: D && D.counties ? D.counties.length : 0, cities: D && D.cities ? D.cities.length : 0,
  };
}
/* the client part of the title, for local files only */
export function titleClient(text) {
  const title = ((/<title>([^<]*)<\/title>/.exec(text.slice(0, 6000)) || [])[1] || '').trim();
  const parts = title.split('·').map(s => s.trim()).filter(Boolean);
  return parts.length > 1 && !/atlas|build/i.test(parts[0]) ? parts[0] : '';
}

/* ---------- its modules ---------- */
const MOD = /registerModule\(\{\s*key:\s*'([a-z0-9_]+)',\s*num:\s*'(\d+)',\s*title:\s*'((?:[^'\\]|\\.)*)',\s*desc:\s*'((?:[^'\\]|\\.)*)'/g;
const un = s => s.replace(/\\(.)/g, '$1');
export function modules(text) {
  const out = []; let m; MOD.lastIndex = 0;
  while ((m = MOD.exec(text))) out.push({ key: m[1], num: m[2], title: un(m[3]), desc: un(m[4]) });
  return out;
}

/* ---------- its doors ----------
   What the dashboard, as shipped, takes in from outside and gives out, each found by the code that implements it. A door
   an agent uses must be one the person can open with the dashboard's own controls. */
const DOORS = [
  { id: 'desk.plan.in', module: 'desk', dir: 'in', agent: 'paid', what: 'A campaign plan file', how: 'Campaign Desk, ⤒ Load: choose the plan .json. The desk keeps the keys it knows, checks each one and rebuilds.', needs: ["dkLoad", 'That file is not a desk plan', "'tda.desk.v1'"] },
  { id: 'desk.plan.out', module: 'desk', dir: 'out', agent: 'paid', what: 'The plan the desk holds now', how: 'Campaign Desk, ⤓ Save: writes campaign-desk-plan.json.', needs: ["'campaign-desk-plan.json'"] },
  { id: 'desk.bulk.out', module: 'desk', dir: 'out', agent: 'paid', what: 'The desk\'s own bulk files and build sheets, every campaign and ad paused', how: 'Campaign Desk, the ↓ buttons: Google Ads Editor, Microsoft, Meta, LSA, Demand Gen, Nextdoor, Yelp, LinkedIn, creative, keywords.', needs: ['google-ads-editor_', 'meta-ads-import_'] },
  { id: 'publish.pages.in', module: 'publish', dir: 'in', agent: 'content', what: 'Pages: a blueprint, a list of blueprints, or a complete HTML page', how: 'Publish, "What to publish": drop the .json or .html file on the import box. A blueprint is compiled there by the Site Forge compiler; every page lands as a draft.', needs: ['p16iDrop', 'Array.isArray(o.pages)', 'FORGE_COMPILE.compile(o'] },
  { id: 'forge.blueprint.in', module: 'forge', dir: 'in', agent: 'content', what: 'One page as a FORGE blueprint', how: 'Site Forge, page studio, Blueprint view: paste the blueprint and choose Use edited blueprint.', needs: ['Use edited blueprint'] },
  { id: 'satchel.lint.in', module: 'satchel', dir: 'in', agent: 'both', what: 'Copy to screen against the advertising rules', how: 'Emergency Satchel: paste the copy and run the batteries.', needs: ['function satchelLint'] },
  { id: 'watch.ledger.in', module: 'watch', dir: 'in', agent: 'paid', what: 'Competitor ads for the ledger', how: 'Competitor Watch: import a ledger file or paste rows.', needs: ["'tda.watch"] },
];
export function doors(text, mods = modules(text)) {
  const have = new Set(mods.map(m => m.key));
  return DOORS.filter(d => have.has(d.module) && d.needs.every(n => text.includes(n))).map(({ needs, ...d }) => d);
}

/* ---------- the paid library ---------- */
/* Raised whenever what library() returns changes shape, so a pack read by an older reader is written again from the
   same dashboard file instead of standing as it is. */
export const READER = 2;
/* The Campaign Desk's own code, fingerprinted: the script block that registers module 08. A toolkit that mirrors the
   desk's arithmetic can tell from this when a build changed the desk, and stop presenting its figures as the desk's.
   Null when the atlas has no Campaign Desk. */
export function deskCode(text) {
  const m = /registerModule\(\{\s*key:\s*'desk'/.exec(text); if (!m) return null;
  const s = text.lastIndexOf('<script', m.index), e = text.indexOf('</script>', m.index); if (s === -1 || e === -1) return null;
  const body = text.slice(text.indexOf('>', s) + 1, e);
  return { code: sha(body), bytes: body.length };
}
const hasCity = k => k.includes('{city}');
/* everything the Campaign Desk writes from that is not tied to one client: service angles with keywords and ad copy,
   the lines, the negatives, the platform book and its assumptions, the advertising rules */
export function library(text) {
  if (!isThermalDebt(text)) throw new Error('this file is not a Thermal Debt atlas (no data block with service angles)');
  const D = atlasData(text) || {}, zN = (D.zrows || []).length, gidAt = (D.zcols || []).indexOf('gid'), gidN = gidAt === -1 ? 0 : D.zrows.filter(r => r[gidAt]).length;

  const angles = (literal(text, 'ANGLES', ['trig']) || []).filter(a => a && a.id && a.label).map(a => ({
    id: a.id, short: a.short || a.label, label: a.label, line: a.line || '', path: a.path || '', lsa: a.lsa || [], why: a.why || '', trig: typeof a.trig === 'string' ? a.trig : '',
    keywords: { core: (a.kw || []).filter(k => !hasCity(k)), city: (a.kw || []).filter(hasCity), questions: a.kwq || [] },
    copy: { h: a.h || [], d: a.d || [], es: a.es ? { h: a.es.h || [], d: a.es.d || [] } : null, social: a.meta ? { primary: a.meta.p || '', headline: a.meta.h || '', description: a.meta.d || '' } : null },
  }));
  const lines = {}; for (const [k, v] of Object.entries(literal(text, 'LINES') || {})) if (v && v.l) lines[k] = { label: v.l, angles: v.angles || [], objective: v.obj || '' };
  const negatives = {}; { const re = /\b(?:const|let|var)\s+(NEG\w*)\s*=\s*\[/g; let m; while ((m = re.exec(text))) { const v = literal(text, m[1], [], Math.max(0, m.index - 1)); if (Array.isArray(v) && v.every(x => typeof x === 'string')) negatives[m[1]] = v; } }

  /* the platform book: order, labels, benchmark assumptions, the mix each line starts with, the build rules per platform */
  const order = literal(text, 'PLATS') || [], labels = literal(text, 'PLAB') || {}, asm = literal(text, 'ASM0') || {}, mix = literal(text, 'MIX0') || {}, book = literal(text, 'PBOOK') || {};
  /* a line of the book written as a template is filled from the data and put back where it was declared, so the book
     reads key for key as the running page holds it */
  { const at = declared(text, 'PBOOK'); if (at !== -1) for (const f of fields(text, at)) { if (text[f.start] !== '{' || !book[f.key]) continue; const was = book[f.key], o = {};
      for (const g of fields(text, f.start)) { if (text[g.start] === '`' && was[g.key] === undefined) o[g.key] = template(text, g.start, { 'Z.filter(z => z.gid).length': gidN, 'Z.length': zN }); else if (g.key in was) o[g.key] = was[g.key]; }
      for (const k of Object.keys(was)) if (!(k in o)) o[k] = was[k]; book[f.key] = o; } }

  /* what a new plan opens with */
  const defaults = (() => { const at = text.indexOf('const defaults = () => ('); if (at === -1) return {}; const open = text.indexOf('{', at); const o = deep(text, open, matchClose(text, open) + 1) || {}; return Object.fromEntries(Object.entries(o).filter(([, v]) => ['number', 'string', 'boolean'].includes(typeof v))); })();

  /* the Satchel: each rule with a fingerprint of its test, so a port of the tests can tell when a build changed one */
  const rules = [], web = [], controls = []; let version = null;
  const sat = declared(text, 'SAT');
  if (sat !== -1) {
    const S = deep(text, sat, matchClose(text, sat) + 1, ['test']) || {}; version = S.version || null;
    for (const r of S.rules || []) if (r.id && r.name) rules.push({ id: r.id, enforcer: r.fam || '', severity: r.sev || 'note', name: r.name, cite: r.cite || '', read: r.v === '✔' ? 'primary' : 'secondary', scope: r.scope || '', fix: r.fix || '', route: r.route || '', test: sha(String(r.test || '').replace(/\s+/g, ' ')) });
    for (const r of S.web || []) if (r.id && r.name) web.push({ id: r.id, severity: r.sev || 'note', name: r.name, cite: r.cite || '', fix: r.fix || '' });
    for (const c of S.controls || []) if (Array.isArray(c) && c.length >= 3) controls.push({ id: c[0], label: c[1], rules: c[2] });
  }
  const one = name => (new RegExp('const ' + name + "\\s*=\\s*'((?:[^'\\\\]|\\\\.)*)'").exec(text) || [])[1] || null;
  return {
    angles, lines, negatives,
    platforms: { order, labels, assumptions: asm, mix, book },
    defaults, desk: deskCode(text), service: serviceLines(text),
    rules: { version, rules, web, controls, notice: one('NOTICE') && un(one('NOTICE')), consent: one('CONSENT') && un(one('CONSENT')) },
  };
}

/* The service line model's stated side (module 12): the lines a contractor sells, each with its economics as the atlas
   assumes them (ticket, margin, close rate, cost per lead: grade D unless the atlas says otherwise), where it fits by
   platform (0 to 3), its intent, hooks, negatives and the weather or calendar triggers that move its budget. What the
   model computes from these (seasons, priority by ZIP, unit economics) is not here: that is read from the running
   dashboard (lib/live.mjs: snapshot). Null when the atlas has no service line model. */
export function serviceLines(text) {
  const at = text.search(/\bconst SLM\s*=\s*\(/); if (at === -1) return null;
  const DEF = literal(text, 'DEF', [], at) || {}, raw = literal(text, 'LINES', [], at);
  if (!Array.isArray(raw)) return null;
  const KEEP = ['id', 'short', 'name', 'kind', 'of', 'desk', 'angle', 'season', 'seasonSrc', 'g', 'dayparts', 'mobile', 'intent', 'poolL', 'jobsL', 'fit', 'svc', 'hooks', 'negs', 'triggers'];
  const lines = raw.filter(l => l && l.id).map(l => { const o = {}; for (const k of KEEP) if (l[k] !== undefined) o[k] = l[k]; o.economics = (DEF.lines || {})[l.id] || null; return o; });
  const dayparts = {}; { const d = declared(text, 'DAYPARTS', at); if (d !== -1) { const body = text.slice(d, matchClose(text, d) + 1), nums = s => s.split(',').map(x => +x.trim()), re = /(\w+)\s*:\s*dp\(\s*\[([^\]]*)\]\s*,\s*\[([^\]]*)\]\s*,\s*\[([^\]]*)\]\s*\)/g; let m; while ((m = re.exec(body))) dayparts[m[1]] = { weekday: nums(m[2]), saturday: nums(m[3]), sunday: nums(m[4]) }; } }
  return {
    assumptions: { cpc: DEF.cpc ?? null, budget: DEF.budget ?? null, alpha: DEF.alpha ?? null, rates: DEF.rates || {} },
    lines, dayparts, blocks: literal(text, 'BLOCKS', [], at) || [], platforms: literal(text, 'PLAT_FIT_KEYS', [], at) || [],
  };
}

/* ---------- the competitors it maps (for local files only) ----------
   One row per company from the roster the atlas carries: where it is, how large its review base is, whether paid search
   was seen for it, and the website intel the Competitor Watch seeds its ledger with (tagline, financing, promotions,
   membership). The business the atlas is built for is in the roster too, marked `self`. */
export function competitors(text) {
  const D = atlasData(text); if (!D || !Array.isArray(D.comp)) return { asOf: null, companies: [] };
  const by = new Map();
  D.comp.forEach(l => {
    const key = l.domain || l.name; if (!key) return;
    let c = by.get(key);
    if (!c) by.set(key, c = { key, name: String(l.name || '').replace(/\s*\((?:Frisco|Dallas|Irving|Fort Worth|Waxahachie|Plano|Arlington|Denton|McKinney)\)\s*$/, ''), domain: l.domain || '', self: false, tier: l.tier || '', cities: [], zips: [], reviews: 0, rating: l.rating ?? null, paidKeywords: 0, services: [], brands: [], intel: null, scope: l.scope || '' });
    if (l.tier === 'integrity') c.self = true; else if (l.tier === 'top40' && c.tier !== 'top40' && !c.self) c.tier = 'top40';
    if (l.city && !c.cities.includes(l.city)) c.cities.push(l.city); if (l.zip && !c.zips.includes(l.zip)) c.zips.push(l.zip);
    c.reviews += l.reviews || 0; c.paidKeywords = Math.max(c.paidKeywords, l.paid_kw || 0);
    for (const s of l.services || []) if (!c.services.includes(s)) c.services.push(s);
    for (const s of l.brands || []) if (!c.brands.includes(s)) c.brands.push(s);
    if (!c.intel && l.intel) c.intel = { tagline: l.intel.tagline || '', financing: l.intel.financing || '', promos: l.intel.promos || '', membership: l.intel.membership || '', adSignals: l.intel.ad_signals || '' };
  });
  const companies = [...by.values()].map(c => { if (c.self) c.tier = 'self'; return c; }).sort((a, b) => b.reviews - a.reviews);
  return { asOf: D.comp_generated || null, companies };
}

/* ---------- the model ---------- */
const ZIP_COLS = ['zip', 'city', 'lat', 'lon', 'pop', 'occ', 'own_sf_sh', 'rent_sf_sh', 'own65_sh', 'own_recent_sh', 'span_sh', 'inc', 'value', 'medyr', 'density',
  'gas_sh', 'sys', 'rep', 'ge15_sh', 'origwin_sh', 'r22_sh', 'furn20_sh', 'hp_sh', 'repairs', 'ticket', 'opp_usd', 'value_idx', 'comp_pct', 'cpc_rel', 'eff_usd', 'oppb', 'effb', 'quad', 'tier', 'bid', 'gid', 'est_8km', 'idx'];
/* The ZIPs the dashboard scores, each with the paid model's fields and the service angles its data triggers; the
   counties and cities; the seasons the desk paces by when the service line model is not in reach. */
export function model(text, lib = library(text)) {
  const D = atlasData(text); if (!D) throw new Error('no atlas data block (window.__ATLAS_DATA__) in this file');
  const fips = (D.counties || []).map(c => c.fips), cname = Object.fromEntries((D.counties || []).map(c => [c.fips, c.name]));
  const Z = D.zrows.map(r => { const o = {}; D.zcols.forEach((c, i) => { o[c] = r[i]; }); o.fips = o.ci != null ? fips[o.ci] : null; o.cty = cname[o.fips] || ''; return o; });
  const ZR = Z.filter(z => z.occ >= 200 && z.idx != null);
  const MED = { inc: median(ZR.map(z => z.inc)), value: median(ZR.map(z => z.value)) };
  const trigs = lib.angles.filter(a => a.id !== 'recruit').map(a => [a.id, trigger(a.trig, MED)]);
  const unread = trigs.filter(([, f]) => !f).map(([id]) => id);
  const zips = ZR.map(z => { const o = {}; for (const c of ZIP_COLS) if (c in z) o[c] = z[c]; o.fips = z.fips; o.county = z.cty; o.fires = trigs.filter(([, f]) => f && f(z)).map(([id]) => id); return o; });
  const M = D.meta || {}, N = (D.climate || {}).normals || {};
  return {
    zips, all: Z.length, median: MED, triggersUnread: unread,
    counties: (D.counties || []).map(c => ({ fips: c.fips, name: c.name, pop: c.pop, sys: c.sys, rep: c.rep, ge15: c.ge15 })),
    cities: (D.cities || []).filter(c => c.sys > 0).map(c => ({ name: c.name, county: c.cty, zips: c.zips || [], pop: c.pop, sys: c.sys, rep: c.rep, lat: c.lat, lon: c.lon })),
    seasons: { permits: M.season_fw || null, hdd: N.hdd || null, cdd: N.cdd || null, d100: N.d100 || null },
    market: { sys: M.sys, ge15: M.ge15, rep: M.rep, opp_usd: M.opp_usd, compiled: M.compiled || null },
  };
}

/* ---------- the brand it was built for (for local files only) ---------- */
export function brandRaw(text) {
  const at = declared(text, 'BRAND_DEFAULT'); if (at === -1) return null;
  return deep(text, at, matchClose(text, at) + 1) || null;
}
