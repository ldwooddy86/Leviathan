/* Connects the agents to a dashboard.

   connect(file) reads a Thermal Debt atlas once and leaves behind everything both agents work from:

     in the repository (shared by a vertical, scanned for withheld names before it is written, never a brand)
       content-strategist/verticals/<id>.json   the content strategist's deep pack
       paid-ads/packs/<id>.json                 the paid library: angles with keywords and ad copy, lines, negatives, the
                                                platform book, the service lines' stated economics, the advertising rules

     outside the repository, under ~/.leviathan (this client's)
       dashboard/connection.json                what was connected, when, and what it can do
       dashboard/atlas.html                     a copy of the dashboard file, for the checks that run it
       dashboard/model.json                     the ZIP by ZIP paid model, counties, cities, seasons
       dashboard/competitors.json               the competitor roster with its website intel
       dashboard/live.json                      what the running dashboard computes (when a browser is on this machine)
       content-strategist/brand.json            the brand the dashboard was built for, shared by both agents

   A pack in the repository is rewritten only when the dashboard file differs from the one it was read from, so
   connecting the same file twice changes nothing under git. */
import fs from 'node:fs';
import path from 'node:path';
import { deepPack, brandProfile, writePack, scrub, loadPack as loadContentPack, PACKS as CONTENT_PACKS } from '../../content-strategist/lib/atlas.mjs';
import { identity, titleClient, modules, doors, library, model, competitors, brandRaw, isThermalDebt, READER } from './read.mjs';
import { drift } from './satchel.mjs';
import * as live from './live.mjs';
import { REPO, LINK, CS_LOCAL, outside, readJson, writeJson } from './paths.mjs';

export const FORMAT = 1;
/* PA_PACKS moves the paid packs (and CS_PACKS the content packs), so a test can connect without touching the repository's */
export const PAID_PACKS = process.env.PA_PACKS ? path.resolve(process.env.PA_PACKS) : path.join(REPO, 'paid-ads', 'packs');
export const F = {
  connection: () => path.join(LINK, 'connection.json'), atlas: () => path.join(LINK, 'atlas.html'), model: () => path.join(LINK, 'model.json'),
  competitors: () => path.join(LINK, 'competitors.json'), live: () => path.join(LINK, 'live.json'),
  brand: () => process.env.CS_BRAND || path.join(CS_LOCAL, 'brand.json'),
};

export class NotConnected extends Error { }

/* ---------- the paid pack ---------- */
export function paidPackFile(id) { return path.join(PAID_PACKS, id + '.json'); }
export function loadPaidPack(id) {
  const p = paidPackFile(id); if (!fs.existsSync(p)) throw new Error(`no paid pack "${id}" in paid-ads/packs. Connect a dashboard first: node paid-ads/cli.mjs connect <atlas.html>`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
export function listPaidPacks() { return fs.existsSync(PAID_PACKS) ? fs.readdirSync(PAID_PACKS).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort() : []; }

function paidPack(lib, id, ident) {
  return {
    format: FORMAT, id, depth: 'paid', vertical: 'HVAC', atlas: ident.atlas + (ident.build ? ' · Build ' + ident.build : ''), scope: 'Dallas Fort Worth, Texas: 12 counties',
    source: { file: ident.name, build: ident.build, compiled: ident.compiled, sha256: ident.sha256.slice(0, 16), reader: READER, extracted: new Date().toISOString().slice(0, 10) },
    note: 'The atlas holds no keyword volumes and no auction prices. Keywords are its own library per service angle. Every cost, rate and benchmark here is an assumption the atlas states with a grade (A measured to D assumed): quote the grade with the number.',
    lines: lib.lines, angles: lib.angles, negatives: lib.negatives, platforms: lib.platforms, defaults: lib.defaults, desk: lib.desk, service: lib.service, rules: lib.rules,
  };
}
/* writes a paid pack unless the one on disk came from the same dashboard file, read by this same reader:
   {written, dropped, checked, file} */
async function writePaidPack(pack) {
  const file = paidPackFile(pack.id), have = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (have && have.format === FORMAT && have.source && have.source.sha256 === pack.source.sha256 && have.source.reader === pack.source.reader) return { written: false, dropped: 0, checked: true, file };
  const s = await scrub(pack);
  /* a rule whose cite named a withheld party keeps its place, with the cite gone */
  for (const r of (s.value.rules || {}).rules || []) { if (r.cite == null) r.cite = r.enforcer === 'House style' ? 'House style' : ''; if (r.fix == null) r.fix = ''; if (r.name == null) r.name = r.id; }
  fs.mkdirSync(PAID_PACKS, { recursive: true }); fs.writeFileSync(file, JSON.stringify(s.value, null, 1) + '\n');
  return { written: true, dropped: s.dropped, checked: s.checked, file };
}

/* ---------- the brand, for both agents ---------- */
/* The content strategist's brand profile, with what paid copy also draws on: the current promotion and the proof points
   the dashboard holds, each of them a claim to confirm with the person before it runs in an ad. */
export function brandFor(B, id) {
  const b = Object.assign({ vertical: id }, brandProfile(B));
  b.offer = { promotion: B.promo || '', plan: B.plan || '', financing: B.financing || '' };
  b.proof = { reviews: B.reviews && typeof B.reviews === 'object' ? { rating: B.reviews.rating ?? null, count: B.reviews.count ?? null, asOf: B.reviews.asOf || '', source: B.reviews.source || '' } : null, guarantee: B.guarantee || '', experience: B.experience || '', since: B.since || '', founded: B.founded ?? null, dealer: B.dealer || [] };
  return b;
}
function writeBrand(B, id) {
  const file = F.brand(); outside(path.dirname(file), 'The brand file\'s folder');
  const b = brandFor(B, id), keep = readJson(file, {}) || {};
  if (keep.social) b.social = Object.assign(b.social, Object.fromEntries(Object.entries(keep.social).filter(([, v]) => v)));
  writeJson(file, b); return file;
}
export function loadBrand() {
  const f = F.brand(); if (fs.existsSync(f)) return Object.assign(readJson(f), { _file: f });
  if (process.env.CS_BRAND_JSON) { try { return Object.assign(JSON.parse(process.env.CS_BRAND_JSON), { _file: 'CS_BRAND_JSON' }); } catch (e) { throw new Error('CS_BRAND_JSON is not valid JSON: ' + e.message); } }
  return null;
}

/* ---------- what each agent can do with this dashboard ---------- */
function capabilities({ lib, mdl, mods, drs, comp, brand, driftList, liveOk, snap }) {
  const has = k => mods.some(m => m.key === k), door = id => drs.some(d => d.id === id), n = v => (v || []).length;
  const row = (ok, what, detail) => ({ ok: !!ok, what, detail: detail || '' });
  const copyN = lib.angles.filter(a => n(a.copy.h) && n(a.copy.d)).length, kwN = lib.angles.reduce((s, a) => s + n(a.keywords.core) + n(a.keywords.city) + n(a.keywords.questions), 0);
  const paid = [
    row(n(lib.angles), 'Service angles with keywords', `${n(lib.angles)} angles, ${kwN} keywords, ${Object.values(lib.negatives).reduce((s, v) => s + v.length, 0)} negatives`),
    row(copyN, 'Ad copy library', `${copyN} angles with headlines and descriptions, ${lib.angles.filter(a => a.copy.es).length} in Spanish, ${lib.angles.filter(a => a.copy.social).length} with social copy`),
    row(n(lib.platforms.order), 'Platform book', `${n(lib.platforms.order)} platforms with benchmark assumptions, the mix each line starts with and the build rules`),
    row(n(mdl.zips), 'Paid model by ZIP', `${n(mdl.zips)} ZIPs scored for opportunity, efficiency, relative click cost, tier and starting bid`),
    row(lib.service && n(lib.service.lines), 'Service line economics', lib.service ? `${n(lib.service.lines)} lines: ticket, margin, close rate, cost per lead, platform fit, hooks, negatives, triggers` : 'not in this build'),
    row(n(lib.rules.rules), 'Advertising rules', `${n(lib.rules.rules)} rules` + (driftList.length ? `; ${driftList.length} not covered by this toolkit's own tests: ${driftList.map(d => d.id).join(', ')}` : ', each matched by this toolkit\'s tests')),
    row(door('desk.plan.in'), 'Campaign Desk takes a plan file', door('desk.plan.in') ? 'module 08, ⤒ Load' : 'this build has no plan loader'),
    row(has('heat'), 'Heat Desk', has('heat') ? (liveOk ? 'its plan and its reading of the week can be read from the running dashboard' : 'present; reading its plan needs a browser on this machine') : 'not in this build'),
    row(n(comp.companies), 'Competitor roster', `${comp.companies.filter(c => !c.self).length} companies, ${comp.companies.filter(c => c.intel).length} with offer and financing intel` + (comp.asOf ? `, as of ${comp.asOf}` : '')),
    row(snap && snap.slm, 'Computed model (seasons, unit economics, priority by ZIP and line)', snap && snap.slm ? 'read from the running dashboard' : 'not read: ' + (liveOk ? 'the dashboard has no service line model' : 'no browser on this machine; the Campaign Desk\'s fallback seasons are used')),
    row(brand && brand.lic, 'Brand with a license number', brand ? (brand.lic ? 'on file' : 'no license number in the dashboard') : 'the dashboard carries no brand'),
  ];
  const content = [
    row(n(lib.angles), 'Deep pack', 'service angles by demand, city facts, the Site Forge\'s page plan, the advertising rules'),
    row(door('publish.pages.in'), 'Publish takes a pages file', door('publish.pages.in') ? 'module 16, the import box: blueprints are compiled there and land as drafts' : 'this build has no page import'),
    row(door('forge.blueprint.in'), 'Site Forge takes a blueprint', door('forge.blueprint.in') ? 'module 09, page studio, Blueprint view' : 'this build has no blueprint view'),
    row(brand && brand.name, 'Brand', brand ? 'on file' : 'the dashboard carries no brand'),
  ];
  return { paid, content };
}

/* ---------- connect ---------- */
/* opts: id (the pack id; "dfw" for the DFW atlas), copy (keep a copy of the file, default true), live ('auto' | false) */
export async function connect(file, opts = {}) {
  const abs = path.resolve(file); if (!fs.existsSync(abs)) throw new Error('no file at ' + abs);
  const text = fs.readFileSync(abs, 'utf8');
  if (!isThermalDebt(text)) throw new Error('This file is not a Thermal Debt atlas (no data block with service angles). A deep connection needs one; keyword packs for the other atlases in the console come from: node content-strategist/cli.mjs harvest');
  outside(LINK, 'The dashboard link folder (LEVIATHAN_DASHBOARD)');
  const ident = identity(text, abs);
  const id = opts.id || (/^DFW\b/i.test(ident.atlas) ? 'dfw' : '');
  if (!id) throw new Error(`This atlas is "${ident.atlas}". Name the pack it should write, so it does not replace another market's: connect <file> --id <short id>`);
  if (!/^[a-z][a-z0-9_]{1,23}$/.test(id)) throw new Error('A pack id is 2 to 24 lowercase letters, digits or underscores, starting with a letter.');

  const mods = modules(text), drs = doors(text, mods), lib = library(text), mdl = model(text, lib), comp = competitors(text), B = brandRaw(text);
  const driftList = drift(lib.rules.rules);

  /* the repository packs */
  const cp = deepPack(text, { id, file: abs }); let content;
  { let have = null; try { have = loadContentPack(id); } catch { have = null; }
    if (have && have.depth === 'deep' && have.source && have.source.sha256 === cp.pack.source.sha256) content = { written: false, dropped: 0, checked: true, row: null };
    else content = Object.assign({ written: true }, await writePack(cp.pack)); }
  const paid = await writePaidPack(paidPack(lib, id, ident));

  /* this client's files */
  fs.mkdirSync(LINK, { recursive: true });
  let copy = null; if (opts.copy !== false) { copy = F.atlas(); if (path.resolve(copy) !== abs) fs.copyFileSync(abs, copy); }
  writeJson(F.model(), Object.assign({ id, sha256: ident.sha256 }, mdl));
  writeJson(F.competitors(), Object.assign({ id, sha256: ident.sha256 }, comp));
  const brandFile = B ? writeBrand(B, id) : null;

  /* what the running dashboard computes */
  let liveState = { ok: false, why: 'not asked for', at: null }, snap = null;
  if (opts.live !== false) {
    const av = await live.available();
    if (!av.ok) liveState = { ok: false, why: av.why, at: null };
    else {
      try { snap = await live.withDashboard(copy || abs, s => live.snapshot(s)); liveState = { ok: true, why: '', at: snap.at }; writeJson(F.live(), Object.assign({ id, sha256: ident.sha256 }, snap)); }
      catch (e) { liveState = { ok: false, why: 'the dashboard did not open: ' + String(e.message || e).split('\n')[0], at: null }; }
    }
  }
  if (!snap && fs.existsSync(F.live())) { const old = readJson(F.live(), null); if (!old || old.sha256 !== ident.sha256) fs.rmSync(F.live(), { force: true }); }

  const caps = capabilities({ lib, mdl, mods, drs, comp, brand: B, driftList, liveOk: liveState.ok, snap });
  const connection = {
    v: FORMAT, id, connectedAt: new Date().toISOString(), file: abs, copy,
    identity: { atlas: ident.atlas, build: ident.build, compiled: ident.compiled, sha256: ident.sha256, bytes: ident.bytes, zips: ident.zips, counties: ident.counties, cities: ident.cities },
    client: titleClient(text) || (B && B.short) || '', modules: mods, doors: drs, live: liveState, drift: driftList, brandFile,
    packs: { content: { file: path.join(CONTENT_PACKS, id + '.json'), written: content.written, dropped: content.dropped || 0 }, paid: { file: paid.file, written: paid.written, dropped: paid.dropped || 0 }, scanned: !!paid.checked },
    counts: { angles: lib.angles.length, zips: mdl.zips.length, rules: lib.rules.rules.length, lines: lib.service ? lib.service.lines.length : 0, competitors: comp.companies.filter(c => !c.self).length },
    capabilities: caps,
  };
  writeJson(F.connection(), connection);
  return connection;
}

/* ---------- what is connected now ---------- */
/* {connected, connection, problems: [...]}: the record, checked against what is on disk */
export function status() {
  const c = readJson(F.connection(), null); if (!c) return { connected: false, connection: null, problems: [] };
  const problems = [];
  if (c.v !== FORMAT) problems.push('The connection was made by another version of the link. Connect the dashboard again.');
  if (c.copy && !fs.existsSync(c.copy)) problems.push('The copy of the dashboard file is gone, so nothing can be checked against the running dashboard. Connect the dashboard again.');
  if (!fs.existsSync(F.model())) problems.push('The ZIP model is missing. Connect the dashboard again.');
  for (const [name, p] of Object.entries(c.packs || {})) { if (!p || !p.file) continue; if (!fs.existsSync(p.file)) { problems.push(`The ${name} pack (${path.relative(REPO, p.file)}) is missing. Connect the dashboard again.`); continue; } const src = (readJson(p.file, {}) || {}).source || {}; if (src.sha256 && src.sha256 !== c.identity.sha256.slice(0, 16)) problems.push(`The ${name} pack in the repository was read from another dashboard file (Build ${src.build || '?'}). Connect the dashboard you mean to work with.`); }
  return { connected: true, connection: c, problems };
}
/* the connection, or an error that says how to make one */
export function requireConnection() {
  const s = status();
  if (!s.connected) throw new NotConnected('No dashboard is connected on this machine. Ask for the dashboard file (the atlas as one .html file) and connect it:\n  node paid-ads/cli.mjs connect <atlas.html>');
  return s;
}
export const loadModel = () => readJson(F.model(), null);
export const loadCompetitors = () => readJson(F.competitors(), null);
export const loadLive = () => readJson(F.live(), null);
/* the dashboard file the live checks run: the kept copy, else the file that was connected */
export function atlasFile() { const s = status(); if (!s.connected) return null; const c = s.connection; return c.copy && fs.existsSync(c.copy) ? c.copy : (fs.existsSync(c.file) ? c.file : null); }
