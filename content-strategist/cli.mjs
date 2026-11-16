#!/usr/bin/env node
/* The content strategist's toolkit. Node 22, no packages.

   node content-strategist/cli.mjs <command>

   Where things stand
     where                                the dashboard connected, the brand on file, the sitemap inventory, where client files go
     connect <atlas.html> [--id dfw] [--pin]
                                          connect a dashboard (a Thermal Debt atlas as one file): rebuilds the deep pack and the
                                          brand file from it, for this agent and the paid ads specialist alike. `extract` is the
                                          older name for the same command. --pin makes this the only version of the dashboard
                                          the toolkit will take, in this and every later session, until the pin is moved.
     dashboard                            what is connected, the doors it has for pages coming back, what each agent can do

   What the vertical knows
     verticals                            the packs: one per atlas in the console
     keywords <vertical> [--angle id] [--city name] [--find text]
     market <vertical> [--city name]      sourced local facts for a page
     areas <vertical> [--need id]         every city by what runs hot there on the dashboard's heatmaps
     brief <city> [--keyword k] [--url u] the plan for one city page: who the reader is, what sets their part of town
                                          apart (by ZIP), what to tell the owner and the trade detail behind it, the
                                          figures as a person says them, the neighbors to name, the pages to link to
     rules <vertical>                     the advertising rules, the license format, the notice text
     harvest                              rebuild the keyword packs from the console in leviathan/

   What the site already has
     sitemap [site | file] [--deep] [--add]   read the sitemap into the inventory the next two commands use
                                          (--deep reads each page's title and h1; --add merges a second file)
     cannibal "<keyword>" [--type landing|blog|page]
     links "<keyword>" [--n 6]

   The gate
     lint <file> [--type t] [--keyword k] [--allow rule,rule]
     build <page.md> [--allow rule,rule] [--date YYYY-MM-DD] [--no-sitemap]
                                          lint, cannibalization, links and schema; writes the page only when all pass
     validate <schema.json> [--page page.md]
     compare <folder | files...> [--limit 0.15]
                                          how alike a set of pages is, place names masked: catches the same page with
                                          the city swapped, and sentences repeated from page to page

   The dashboard
     handoff [slug | folder ...] [--out file] [--no-live]
                                          one pages file for the dashboard's Publish module from the pages already built
                                          (all of them, or the ones named). With a browser here it is dropped on the running
                                          dashboard's import box first, and you are told what Publish made of it. It also
                                          writes handoff.json, the pages with what the gate measured, and writes the copy of
                                          the dashboard with the Agent Desk in it again, with these pages on it.
     panel [--out file] [--forget id|all] [--no-live] [--no-repairs | --repairs]
                                          write the copy of the dashboard with the Agent Desk in it again, and say what is on it
     check <pages.json | blueprint.json>  hand a file to the running dashboard's Publish module and report what it listed

   Social
     social lint <post.json>
     social post <post.json> --platform facebook|gbp|all [--confirm]
     social whoami

   Common options: --vertical id, --brand file, --json
   Client files (brand, sitemap inventory, built pages, post ledger) live in ~/.leviathan/content-strategist, outside the
   repository; CS_LOCAL, CS_OUT, CS_BRAND and CS_BRAND_JSON move them. The connected dashboard's own files sit beside
   them in ~/.leviathan/dashboard. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO, listPacks, loadPack, harvestConsole, isThermalDebt } from './lib/atlas.mjs';
import { parse, parseMarkdown, renderBody, renderPage, slugify } from './lib/doc.mjs';
import { lint, report, urlKey } from './lib/lint.mjs';
import { crawl, fromFile, inventory, deepen, cannibal, linkTargets, nearby, cityPage, Blocked } from './lib/sitemap.mjs';
import { buildSchema, validate, blueprint, pageUrl } from './lib/schema.mjs';
import * as social from './lib/social.mjs';
import { compare } from './lib/unique.mjs';
import { brief, briefText, areasTable } from './lib/brief.mjs';
/* the dashboard link, shared with the paid ads specialist: one connection, one brand file */
import { runConnect, runStatus, runCheck, runPanel, NoSuchHandoff } from '../dashboard-link/cli.mjs';
import { status as linkStatus, atlasFile, NotConnected, Pinned } from '../dashboard-link/lib/connect.mjs';
import { bundle as handoffBundle, registerBundle, joins as panelJoins } from '../dashboard-link/lib/panel.mjs';
import { pagesFile, note as handoffNote } from '../dashboard-link/lib/handoff.mjs';
import * as live from '../dashboard-link/lib/live.mjs';
import { CS_LOCAL } from '../dashboard-link/lib/paths.mjs';

/* Everything that names the client lives outside the repository: the brand file, the sitemap inventory, the finished pages
   and the ledger of posts. The console's build scans every file under the repository, ignored or not, and refuses it
   while a withheld name is anywhere in it. */
const LOCAL = CS_LOCAL;
const OUT = path.resolve(process.env.CS_OUT || path.join(LOCAL, 'out'));
const inRepo = p => !path.relative(REPO, p).startsWith('..') && fs.existsSync(path.join(REPO, '.git'));
for (const [name, p] of [['CS_LOCAL', LOCAL], ['CS_OUT', OUT]]) if (inRepo(p)) console.error(`Warning: ${name} (${p}) is inside the repository. The console's withheld name scan reads every file there; keep client files outside it.`);

/* ---------- arguments ---------- */
const BOOL = new Set(['json', 'deep', 'confirm', 'no-sitemap', 'help', 'all', 'add', 'no-live', 'no-copy', 'no-repairs', 'repairs', 'pin']);
function args(argv) { const o = { _: [] }; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (BOOL.has(k) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) o[k] = true; else o[k] = argv[++i]; } else o._.push(a); } return o; }
const A = args(process.argv.slice(2)), cmd = A._.shift() || 'help';
const list = v => (v && v !== true ? String(v).split(',').map(s => s.trim()).filter(Boolean) : []);
const out = (v, text) => { if (A.json) console.log(JSON.stringify(v, null, 1)); else console.log(text != null ? text : JSON.stringify(v, null, 1)); };
const die = (msg, code = 2) => { console.error(msg); process.exit(code); };
const rel = p => { const r = path.relative(process.cwd(), p) || '.'; return r.startsWith('..') ? p : r; };

/* Node's fetch reads the session proxy only when told to at start, so a network command runs itself again with that set */
function viaProxy() {
  if (!(process.env.HTTPS_PROXY || process.env.https_proxy) || process.env.NODE_USE_ENV_PROXY) return;
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: Object.assign({}, process.env, { NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' }) });
  process.exit(r.status == null ? 1 : r.status);
}

/* ---------- what is on file ---------- */
function brandFile() { return A.brand && A.brand !== true ? path.resolve(A.brand) : process.env.CS_BRAND || path.join(LOCAL, 'brand.json'); }
function loadBrand(required = false) {
  const f = brandFile();
  if (fs.existsSync(f)) return Object.assign(JSON.parse(fs.readFileSync(f, 'utf8')), { _file: f });
  if (process.env.CS_BRAND_JSON) { try { return Object.assign(JSON.parse(process.env.CS_BRAND_JSON), { _file: 'CS_BRAND_JSON' }); } catch (e) { die('CS_BRAND_JSON is not valid JSON: ' + e.message); } }
  if (required) die(`No brand file at ${f}. The brand (name, site, phone, license, address) stays out of the repository.\nMake it one of three ways:\n  node content-strategist/cli.mjs connect <atlas.html>     reads the brand the dashboard was built for\n  mkdir -p ${path.dirname(f)} && cp content-strategist/brand.example.json ${f}     then fill it in\n  set CS_BRAND_JSON to the same JSON in the environment, so every session has it`);
  return null;
}
function packFor(meta = {}, brand = null) {
  const id = (A.vertical && A.vertical !== true && A.vertical) || meta.vertical || (brand && brand.vertical) || '';
  if (id) return loadPack(id);
  const deep = (listPacks().packs || []).filter(p => p.depth === 'deep'); return deep.length === 1 ? loadPack(deep[0].id) : null;
}
const invFile = site => path.join(LOCAL, 'sitemap', new URL(/^https?:/i.test(site) ? site : 'https://' + site).hostname.replace(/^www\./, '') + '.json');
function loadInventory(brand) {
  const site = (A.site && A.site !== true && A.site) || (brand && brand.url) || ''; if (!site) return null;
  const f = invFile(site); if (!fs.existsSync(f)) return null;
  const j = JSON.parse(fs.readFileSync(f, 'utf8')); j._file = f; j.ageHours = Math.round((Date.now() - Date.parse(j.fetched)) / 36e5); return j;
}
const needInventory = brand => loadInventory(brand) || die(`No sitemap inventory${brand && brand.url ? ' for ' + brand.url : ''}. Read the site first:\n  node content-strategist/cli.mjs sitemap\nIf the site blocks the request, save its page and post sitemaps from a browser and pass the file:\n  node content-strategist/cli.mjs sitemap path/to/sitemap.xml`);

/* ---------- commands ---------- */
const C = {
  help() { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\* ?/, '')); },

  where() {
    const brand = loadBrand(), inv = loadInventory(brand), res = { local: LOCAL, out: OUT, drafts: path.join(LOCAL, 'drafts'), brandFile: brand ? brand._file : null, brand: brand ? { name: brand.name, site: brand.url, vertical: brand.vertical || null, license: brand.license ? 'set' : 'MISSING', phone: brand.phone ? 'set' : 'MISSING', facebookPage: (brand.social || {}).facebookPageId ? 'id on file' : 'no id', businessProfile: (brand.social || {}).gbpAccountId && (brand.social || {}).gbpLocationId ? 'ids on file' : 'no ids' } : null, sitemap: inv ? { pages: inv.pages.length, ageHours: inv.ageHours, file: inv._file } : null };
    const link = linkStatus(), lc = link.connection; res.dashboard = lc ? { atlas: lc.identity.atlas, build: lc.identity.build, sha256: lc.identity.sha256.slice(0, 16), connectedAt: lc.connectedAt, runsHere: lc.live.ok, pin: link.pin || null, problems: link.problems } : null;
    /* the pin is on the pack in the repository, so it is known before any dashboard is connected on this machine */
    const pinned = (link.pin) || (() => { try { const p = packFor({}, brand); return (p && p.source && p.source.pin) || null; } catch { return null; } })();
    res.pin = pinned;
    out(res, [lc ? `Dashboard: ${lc.identity.atlas} · Build ${lc.identity.build}, connected ${String(lc.connectedAt).slice(0, 16).replace('T', ' ')} UTC. ${lc.live.ok ? 'It runs on this machine, so a pages file can be tried on its Publish module before you hand it over.' : 'It cannot be run on this machine (' + lc.live.why + ').'}` : 'Dashboard: none connected. Ask for the dashboard file and run: connect <atlas.html>', ...link.problems.map(p => 'PROBLEM  ' + p), pinned ? `Pinned dashboard: ${pinned.file} (fingerprint ${pinned.sha256}, since ${pinned.since}). Use this version and no other; connect refuses a different file.` : 'Pinned dashboard: none. Any version can be connected.',
      `Client files: ${LOCAL}   (outside the repository; drafts in ${res.drafts}, built pages in ${OUT})`, brand ? `Brand: ${brand.name} · ${brand.url} · vertical ${brand.vertical || 'not set'} · license ${res.brand.license} · phone ${res.brand.phone} · Facebook Page ${res.brand.facebookPage} · Business Profile ${res.brand.businessProfile} (ids only; \`social whoami\` tests the credentials)   (${brand._file})` : `Brand: none yet. Connect the dashboard (connect <atlas.html>), copy brand.example.json to ${brandFile()}, or set CS_BRAND_JSON.`, inv ? `Sitemap: ${inv.pages.length} live URLs, read ${inv.ageHours}h ago` : 'Sitemap: not read yet. Run: sitemap'].join('\n'));
  },

  verticals() {
    const idx = listPacks();
    out(idx, (idx.packs || []).map(p => `${p.id.padEnd(12)} ${p.depth.padEnd(9)} ${String(p.vertical).padEnd(18)} ${String(p.scope || '').padEnd(38)} ${String(p.angles).padStart(3)} angles ${String(p.keywords).padStart(4)} keywords   ${p.atlas}`).join('\n') || 'No packs yet. Run: node content-strategist/cli.mjs harvest');
  },

  keywords() {
    const pack = loadPack(A._[0] || die('keywords <vertical>   (see: verticals)')), city = A.city && A.city !== true ? A.city : '', find = A.find && A.find !== true ? String(A.find).toLowerCase() : '';
    const C0 = city && (pack.cities || []).find(c => c.name.toLowerCase() === city.toLowerCase());
    if (city && pack.cities && !C0) die(`"${city}" is not a city in the ${pack.id} pack. Cities: ${(pack.cities || []).slice(0, 40).map(c => c.name).join(', ')}...`);
    let angles = pack.angles.filter(a => !A.angle || a.id === A.angle);
    if (C0) { const share = Object.fromEntries(C0.angles.map(x => [x.id, x.share])); angles = angles.map(a => Object.assign({}, a, { demandShare: share[a.id] || 0 })).sort((x, y) => y.demandShare - x.demandShare); }
    if (find) angles = angles.filter(a => JSON.stringify([a.label, a.keywords]).toLowerCase().includes(find));
    const fill = k => city ? k.replace(/\{city\}/gi, city) : k;
    const rows = angles.map(a => ({ id: a.id, label: a.label, line: a.line, page: a.page ? a.page.slug : a.path || '', why: a.why, demandShare: a.demandShare, reach: a.reach, topCities: a.topCities, keywords: Object.fromEntries(Object.entries(a.keywords).map(([k, v]) => [k, v.map(fill)])) }));
    const res = { vertical: pack.id, atlas: pack.atlas, note: pack.note, city: C0 ? { name: C0.name, county: C0.county, demand: C0.demand } : undefined, angles: rows, negatives: A.angle ? undefined : pack.negatives };
    const T = [`${pack.atlas} · ${pack.vertical}${C0 ? ' · ' + C0.name + ' (' + C0.county + ' County)' : ''}`, pack.note || '', ''];
    if (!rows.length) T.push(`No angle matches${A.angle ? ` the id "${A.angle}"` : ''}${find ? ` "${find}"` : ''}. Angles: ${pack.angles.map(a => a.id).join(', ')}`);
    let cut = false;
    for (const r of rows) {
      if (C0 && !r.demandShare && !cut) { cut = true; T.push(`No demand trigger in ${C0.name} for the angles below. The keywords still exist; the atlas's model just does not point here. Tell the person before you build one of these.`, ''); }
      T.push(`${r.id}  ${r.label}${r.page ? '   page: ' + r.page : ''}${r.demandShare != null ? (r.demandShare ? `   demand in ${r.demandShare}% of ${C0.name}'s ZIPs` : `   NO demand trigger in ${C0.name}`) : r.reach ? `   demand in ${r.reach.zips} of ${r.reach.of} ZIPs` : ''}`);
      if (r.why) T.push('   when: ' + r.why);
      for (const [k, v] of Object.entries(r.keywords)) if (v.length) T.push(`   ${k.padEnd(10)} ${v.join(' | ')}`);
      if (r.topCities && r.topCities.length && !C0) T.push('   strongest  ' + r.topCities.join(', '));
      T.push('');
    }
    if (res.negatives) for (const [k, v] of Object.entries(res.negatives)) T.push(`${k}${/RECRUIT|EMPLOYER/.test(k) ? ' (hiring ads only; ignore for customer pages)' : ' (searches the business does not want)'}: ${v.slice(0, 40).join(', ')}${v.length > 40 ? ', ...' : ''}`);
    out(res, T.join('\n'));
  },

  market() {
    const pack = loadPack(A._[0] || die('market <vertical> [--city name]')); if (!pack.market) die(`The ${pack.id} pack is a keyword pack; it carries no market facts. Only a deep pack does (see: extract).`);
    const city = A.city && A.city !== true ? (pack.cities || []).find(c => c.name.toLowerCase() === String(A.city).toLowerCase()) : null; if (A.city && A.city !== true && !city) die(`"${A.city}" is not a city in the ${pack.id} pack.`);
    const res = city ? { city: city.name, county: city.county, zips: city.zips, demand: city.demand, facts: city.facts, market: pack.market.facts } : { market: pack.market.name, counties: pack.market.counties, facts: pack.market.facts, cities: (pack.cities || []).slice(0, 30).map(c => ({ name: c.name, county: c.county, replacementsPerYear: c.demand.replacementsPerYear, aged15Share: c.demand.aged15Share })) };
    const line = f => `  ${String(f.value).padEnd(10)} ${f.label}\n             source: ${f.source} (grade ${f.grade})${f.estimate ? '. A model estimate: word it as one ("an estimated", "about").' : ''}`;
    const T = city ? [`${city.name}, ${city.county} County · ZIPs ${city.zips.join(' ')}`, '', ...city.facts.map(line), '', pack.market.name + ':', ...pack.market.facts.map(line)] : [pack.market.name, '', ...pack.market.facts.map(line), '', 'Cities by replacements a year: ' + res.cities.map(c => `${c.name} ${c.replacementsPerYear}`).join(', ')];
    out(res, T.join('\n'));
  },

  areas() {
    const pack = loadPack(A._[0] || die('areas <vertical> [--need id]')); if (!pack.needs) die(`The ${pack.id} pack carries no heatmaps. Only a deep pack read from a dashboard file does (see: connect).`);
    const need = A.need && A.need !== true ? String(A.need) : ''; if (need && !pack.needs.some(n => n.id === need)) die(`No need "${need}". Needs: ${pack.needs.map(n => n.id).join(', ')}`);
    const rows = areasTable(pack, { need });
    out({ vertical: pack.id, needs: pack.needs.map(n => ({ id: n.id, title: n.title, metro: n.metro, copy: n.copy })), cities: rows }, [`${pack.atlas}: what runs hot where, from the dashboard's heatmaps`, '', 'The needs (share of the market\'s systems in ZIPs where each runs hot):', ...pack.needs.map(n => `  ${n.id.padEnd(17)} ${String(n.metro).padStart(3)}%  ${n.title}${n.copy ? '' : '   (planning only; never said to a reader)'}`), '', ...rows.map(r => `${r.city.padEnd(22)} ${String(r.builtAround || '').padEnd(5)} ${r.needs.join(', ') || 'nothing citywide'}${r.pockets.length ? '   |  in part: ' + r.pockets.join('; ') : ''}`), '', 'The year is the typical home\'s. A city\'s whole plan: brief <city>'].join('\n'));
  },

  brief() {
    const name = A._.join(' ') || die('brief <city> [--keyword k] [--url page-url] [--type landing|blog|page]'), brand = loadBrand(), pack = packFor({}, brand) || die('No deep pack. Connect a dashboard first: connect <atlas.html>'), inv = loadInventory(brand);
    const b = brief({ pack, brand, inv: inv ? inv.pages : null, city: name, keyword: A.keyword && A.keyword !== true ? A.keyword : '', type: A.type && A.type !== true ? A.type : 'landing', selfUrl: A.url && A.url !== true ? A.url : '', n: +A.n || 8 });
    out(b, briefText(b) + (inv ? '' : '\n\nNo sitemap on file, so the brief has no links and no keyword check. Run: sitemap'));
  },

  rules() {
    const pack = loadPack(A._[0] || die('rules <vertical>')), C0 = pack.compliance; if (!C0) die(`The ${pack.id} pack is a keyword pack; it carries no advertising rules. Ask the person which rules bind this client's ads.`);
    const brand = loadBrand(), lic = brand && brand.license ? `${pack.licenseLabel || ''} Lic ${brand.license}`.trim() : `${pack.licenseLabel || ''} Lic <number>`.trim();
    const res = { vertical: pack.id, license: { everyAdAndPost: C0.licenseInEveryAsset, writeItAs: lic }, notice: C0.notice, consent: C0.consent, rules: C0.rules.map(r => ({ id: r.id, gate: r.id === 'TDLR1' ? 'fails a post' : r.test ? { block: 'fails the build', warn: 'warning', note: 'note' }[r.severity] : 'not tested here', enforcer: r.enforcer, name: r.name, cite: r.cite, fix: r.fix })) };
    out(res, [`${pack.atlas}: advertising rules`, '', `License: ${C0.licenseInEveryAsset ? 'on every ad and every post; on every page unless the site footer prints it.' : 'no rule on file.'} Write it as "${lic}".`, '', 'Notice for a page that talks about proposals, estimates, contracts or financing (put it in a verbatim block, word for word):', '  ' + (C0.notice || 'none on file'), '', 'Consent text under a form that collects a phone number:', '  ' + (C0.consent || 'none on file'), '', ...res.rules.map(r => `${r.id.padEnd(6)} ${r.gate.padEnd(16)} ${r.name}\n         ${r.enforcer}; ${r.cite}\n         fix: ${r.fix}`), '', 'A rule that only warns still needs an answer: confirm the claim with the person or cut it.'].join('\n'));
  },

  /* Connecting a dashboard is one act for both agents (dashboard-link): this agent's deep pack and the brand file are
     rebuilt from the atlas, the paid ads specialist's pack and the client's model beside them, and where a browser is
     here the dashboard is opened to see that it runs. */
  async connect() {
    const f = A._[0] || die('connect <atlas.html> [--id dfw] [--pin] [--no-live] [--no-copy]'); if (!fs.existsSync(f)) die('No file at ' + f);
    if (!isThermalDebt(fs.readFileSync(f, 'utf8'))) die('This file is not a Thermal Debt atlas (no atlas data block with service angles). Keyword packs for the other atlases come from: harvest');
    const r = await runConnect(f, { id: A.id && A.id !== true ? A.id : undefined, live: A['no-live'] ? false : 'auto', copy: !A['no-copy'], pin: !!A.pin }); out(r.value, r.text);
  },
  extract() { return C.connect(); },
  dashboard() { const r = runStatus(); out(r.value, r.text); if (r.value.connected && r.value.problems.length) process.exitCode = 1; },

  /* The built pages as one file the dashboard's Publish module takes: its import box reads a `pages` list of FORGE
     blueprints, compiles each with the Site Forge compiler and lists it as a draft. */
  async handoff() {
    const named = A._.length > 0, dirs = named ? A._.map(a => (fs.existsSync(a) ? path.resolve(a) : path.join(OUT, a))) : (fs.existsSync(OUT) ? fs.readdirSync(OUT).sort().map(e => path.join(OUT, e)).filter(p => fs.existsSync(path.join(p, 'blueprint.json'))) : []);
    if (!dirs.length) die('No built pages to hand over. A page is built with: build <page.md>');
    const folderOf = d => (fs.existsSync(d) && fs.statSync(d).isDirectory() ? d : path.dirname(d));
    const bps = dirs.map(d => { const p = fs.existsSync(d) && fs.statSync(d).isDirectory() ? path.join(d, 'blueprint.json') : d; if (!fs.existsSync(p)) die(`No blueprint at ${p}. Name a built page by its slug or its folder.`); return JSON.parse(fs.readFileSync(p, 'utf8')); });
    const link = linkStatus(), made = pagesFile(bps, handoffNote('content-strategist', link.connected ? link.connection : null, { pages: bps.map(b => b.page && b.page.slug) }));
    if (made.problems.length) die('The pages file was not written:\n  ' + made.problems.join('\n  '));
    const file = A.out && A.out !== true ? path.resolve(A.out) : path.join(OUT, 'pages-for-publish.json'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, made.file);
    let tried = null, why = '';
    if (!link.connected) why = 'no dashboard is connected (connect <atlas.html>)'; else if (A['no-live']) why = '--no-live was passed'; else { const av = await live.available(); if (!av.ok) why = av.why; else { try { tried = await runCheck(file); } catch (e) { why = String(e.message || e).split('\n')[0]; } } }
    /* The hand-off for the dashboard's Agent Desk: the same pages with what the gate measured for each, as one file beside
       the pages file, put on file for this client; then the copy of the dashboard that holds it is written again. */
    const info = bps.map((b, i) => { const folder = folderOf(dirs[i]); let r = null; if (path.basename(folder) === b.page.slug) { try { r = JSON.parse(fs.readFileSync(path.join(folder, 'report.json'), 'utf8')); } catch { r = null; } }
      return Object.assign({ slug: b.page.slug, title: b.page.h1 || b.page.title || '' }, r ? { url: r.url || '', type: r.type || '', keyword: r.keyword || '', words: (r.stats || {}).words ?? null, grade: (r.stats || {}).grade ?? null, schemaTypes: r.schemaTypes || [], warnings: (r.findings || []).filter(f => f.severity === 'warn').map(f => f.message) } : {}); });
    const hand = handoffBundle({ id: named ? 'content:' + bps.map(b => b.page.slug).sort().join('+').slice(0, 80) : 'content:pages', agent: 'content-strategist', title: bps.length === 1 ? (bps[0].page.h1 || bps[0].page.title || bps[0].page.slug) : `${bps.length} pages`, connection: link.connected ? link.connection : null,
      content: { pages: bps, info, checked: { dashboard: tried ? { ran: true, accepted: !!tried.ok, verdict: (tried.value && tried.value.verdict) || '' } : { ran: false, why } } } });
    const hf = /pages-for-publish\.json$/.test(file) ? path.join(path.dirname(file), 'handoff.json') : file.replace(/(\.json)?$/i, '.handoff.json'); fs.writeFileSync(hf, JSON.stringify(hand) + '\n');
    let panel = null, panelWhy = '';
    if (!link.connected) panelWhy = 'no dashboard is connected'; else { const src = atlasFile(), j = src ? panelJoins(fs.readFileSync(src, 'utf8')) : { ok: false, why: 'the dashboard file is gone from this machine' }; if (!j.ok) panelWhy = j.why; else { try { registerBundle(hand); panel = (await runPanel({ check: !A['no-live'] })).value; } catch (e) { panelWhy = String(e.message || e).split('\n')[0]; } } }
    const byHand = `Publish (module 16), "What to publish", Import. Drop ${rel(file)} on the box.`, drafts = 'Each page is compiled there by the Site Forge compiler and listed as a draft; nothing reaches a site until a person sends it.';
    out({ file, handoff: hf, pages: bps.map(b => b.page.slug), dashboard: tried ? tried.value : null, notTried: why || undefined, agentDesk: panel ? { file: panel.file, handoffs: panel.bundles.length, opened: panel.opened ? panel.ok : null, notOpened: panel.notOpened } : { file: null, why: panelWhy } },
      [`${made.count} page${made.count === 1 ? '' : 's'}  ->  ${rel(file)}`, `Hand-off  ->  ${rel(hf)}`,
        ...(panel ? [`For the dashboard: open ${rel(panel.file)} and choose Agent Desk, the last module. ${made.count === 1 ? 'This page is' : 'These pages are'} on it, with what the gate measured, and one button sends ${made.count === 1 ? 'it' : 'them'} to Publish. ${drafts}`, panel.opened ? (panel.ok ? `  Opened headless to check it: the Agent Desk is module ${panel.opened.num} and lists ${panel.opened.handoffs.length} hand-off${panel.opened.handoffs.length === 1 ? '' : 's'}.` : '  PROBLEM  Opened headless, and the Agent Desk did not come up as it should. Use the by hand route below and say so.') : `  That copy was not opened to check it: ${panel.notOpened}.`, '  By hand instead: ' + byHand]
          : [`The copy of the dashboard with the Agent Desk was not written: ${panelWhy}.`, `For the dashboard: ${byHand} ${drafts}`]),
        tried ? 'Tried on the running dashboard: ' + tried.text : `Not tried on the running dashboard: ${why}.`].join('\n'));
    if (tried && !tried.ok) process.exitCode = 1;
  },
  async panel() {
    if (A.forget === true) die('--forget takes the id of a hand-off as panel lists it, or "all".');
    if (A.repairs && A['no-repairs']) die('--repairs and --no-repairs cannot both be asked for.');
    const r = await runPanel({ out: A.out && A.out !== true ? A.out : '', check: !A['no-live'], forget: A.forget || '', repairs: A['no-repairs'] ? false : A.repairs ? true : undefined }); out(r.value, r.text); if (!r.ok) process.exitCode = 1;
  },
  async check() { const f = A._[0] || die('check <pages.json | blueprint.json>'); const r = await runCheck(path.resolve(f)); out(r.value, r.text); if (!r.ok) process.exitCode = 1; },

  async harvest() {
    const r = await harvestConsole(REPO);
    out(r.map(x => x.row || { id: x.pack.id, kept: x.kept }), r.map(x => x.kept ? `${x.pack.id.padEnd(12)} kept (a deep pack from a newer atlas file)` : `${x.row.id.padEnd(12)} ${String(x.row.angles).padStart(3)} angles ${String(x.row.keywords).padStart(4)} keywords${x.dropped ? `   (${x.dropped} withheld strings dropped)` : ''}`).join('\n'));
  },

  async sitemap() {
    const brand = loadBrand(), src = A._[0] || (brand && brand.url) || die('sitemap <site | file>   (or set url in the brand file)'), pack = packFor({}, brand);
    let c;
    if (fs.existsSync(src) && fs.statSync(src).isFile()) c = fromFile(src, (A.site && A.site !== true && A.site) || (brand && brand.url) || '');
    else { viaProxy(); try { c = await crawl(src); } catch (e) { if (e instanceof Blocked) die(`${e.message}.\nThe site will not serve its sitemap to this machine. Open ${new URL(/^https?:/i.test(src) ? src : 'https://' + src).origin}/sitemap_index.xml (or /sitemap.xml) in a browser, save the page and post sitemaps it lists, and pass the file:\n  node content-strategist/cli.mjs sitemap path/to/page-sitemap.xml\nA plain list of live URLs, one a line, works too.`, 3); throw e; } }
    const inv = inventory(c, { pack, brand }); let deep = null;
    if (A.deep) { viaProxy(); deep = await deepen(inv, { pack, brand }); }
    const f = invFile(c.site); let prev = [];
    if (A.add && fs.existsSync(f)) prev = JSON.parse(fs.readFileSync(f, 'utf8')).pages.filter(p => !inv.some(x => x.key === p.key));
    const pages = [...prev, ...inv]; fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ site: c.site, fetched: c.fetched, sitemaps: c.sitemaps, errors: c.errors, pages }, null, 1));
    const by = {}; for (const p of pages) by[p.kind] = (by[p.kind] || 0) + 1;
    out({ site: c.site, pages: pages.length, kinds: by, sitemaps: c.sitemaps, deep, file: rel(f), errors: c.errors }, `${c.site}: ${pages.length} live URLs  (${Object.entries(by).map(([k, v]) => `${v} ${k}`).join(', ')})\n${c.sitemaps.map(s => `  ${s.url}  ${s.kind}${s.urls ? ', ' + s.urls + ' URLs' : ''}`).join('\n')}${deep ? `\nRead ${deep.read} pages for their titles and h1 (${deep.failed} failed).` : ''}${c.errors.length ? '\nNotes: ' + c.errors.join('; ') : ''}\nInventory  ->  ${rel(f)}`);
  },

  cannibal() {
    const kw = A._.join(' ') || die('cannibal "<keyword>" [--type landing|blog|page]'), brand = loadBrand(), pack = packFor({}, brand), inv = needInventory(brand);
    const r = cannibal(kw, inv.pages, { pack, brand, type: A.type && A.type !== true ? A.type : 'landing', selfUrl: A.url && A.url !== true ? A.url : '' });
    const T = [`${r.verdict === 'conflict' ? 'CONFLICT' : 'CLEAR'}  "${kw}"  ·  angle: ${r.want.angleLabel || 'none matched'}  ·  place: ${r.want.place || 'none'}  ·  as a ${r.want.type} (${r.want.mode})  ·  sitemap read ${inv.ageHours}h ago`, ...r.advice.map(a => '  ' + a)];
    if (r.conflicts.length) { T.push('', 'Pages that hold it:'); for (const x of r.conflicts) T.push(`  ${x.url}\n     ${x.why}; stands for "${x.keyword}"`); }
    if (r.neighbors.length) { T.push('', 'Neighbors (link to them; do not take their keyword):'); for (const x of r.neighbors) T.push(`  ${x.url}\n     ${x.relation}; stands for "${x.keyword}"`); }
    if (r.avoid.length) T.push('', 'Keywords to leave alone: ' + r.avoid.map(a => `"${a.keyword}"`).join(', '));
    out(r, T.join('\n')); if (r.verdict === 'conflict') process.exitCode = 1;
  },

  links() {
    const kw = A._.join(' ') || die('links "<keyword>" [--n 6]'), brand = loadBrand(), pack = packFor({}, brand), inv = needInventory(brand);
    const r = linkTargets(kw, inv.pages, { pack, brand, n: +A.n || 6, type: A.type && A.type !== true ? A.type : 'landing', selfUrl: A.url && A.url !== true ? A.url : '', neighbors: A.neighbors != null && A.neighbors !== true ? +A.neighbors : 2 });
    out(r, [`Internal links for "${kw}"  ·  ${inv.pages.length} live URLs, sitemap read ${inv.ageHours}h ago`, ...r.targets.map(t => `  [${t.anchor}](${t.url})\n     ${t.why}`), r.targets.length ? '' : '  No live page relates to this keyword yet. Link to the home page and the contact page, and say so in the report.', r.rule].join('\n'));
  },

  lint() {
    const f = A._[0] || die('lint <file> [--type landing|blog|page|social] [--keyword k] [--allow rule,rule]'), doc = parse(fs.readFileSync(f, 'utf8'), f), brand = loadBrand(), pack = packFor(doc.meta, brand), inv = loadInventory(brand);
    const r = lint(doc, { type: A.type && A.type !== true ? A.type : undefined, keyword: A.keyword && A.keyword !== true ? A.keyword : undefined, allow: list(A.allow), pack, brand, live: inv ? new Set(inv.pages.map(p => p.key)) : null, maxGrade: A.grade ? +A.grade : undefined });
    out(r, report(r, rel(f))); if (!r.ok) process.exitCode = 1;
  },

  build() {
    const f = A._[0] || die('build <page.md> [--allow rule,rule] [--date YYYY-MM-DD] [--no-sitemap]'), src = fs.readFileSync(f, 'utf8'), doc = parseMarkdown(src), m = doc.meta;
    const brand = loadBrand(true), pack = packFor(m, brand), type = m.type, allow = list(A.allow), date = A.date && A.date !== true ? A.date : new Date().toISOString().slice(0, 10);
    if (!['landing', 'blog', 'page'].includes(type)) die('The front matter needs `type: landing`, `type: blog` or `type: page`.');
    if (!m.keyword) die('The front matter needs `keyword:`, the one primary keyword this page is for.');
    const slug = m.slug || slugify(doc.h1), inv = A['no-sitemap'] ? null : needInventory(brand);
    const blogBase = inv ? (() => { const c = {}; for (const p of inv.pages.filter(p => p.kind === 'post')) { const s = p.path.split('/').filter(Boolean); if (s.length > 1) c[s[0]] = (c[s[0]] || 0) + 1; } const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return top && top[1] >= 3 ? '/' + top[0] + '/' : '/'; })() : '/';
    const url = pageUrl(type === 'blog' && !m.path && !m.url ? Object.assign({}, m, { path: blogBase + slug + '/' }) : m, brand, slug);
    const can = inv ? cannibal(m.keyword, inv.pages, { pack, brand, type, selfUrl: url }) : null;
    const r = lint(doc, { type, allow, pack, brand, url, slug, live: inv ? new Set(inv.pages.map(p => p.key)) : null, avoid: can ? can.avoid : [] });
    const push = (rule, severity, message, excerpt = '') => { if (allow.includes(rule)) return; r.findings.push({ rule, severity, message, excerpt }); r.counts[severity]++; if (severity === 'error') r.ok = false; };
    if (can && can.verdict === 'conflict') push('cannibalization', 'error', can.advice[0], can.conflicts.map(c => c.url).join('\n'));
    if (inv && m.city && type !== 'blog') { const near = nearby(m.city, { pack, brand }).map(nb => cityPage(inv.pages, nb.name, url)).filter(Boolean), mine = new Set(doc.links.map(l => urlKey(l.href, brand.url))); if (near.length && !near.some(p => mine.has(p.key))) push('neighbor-links', 'warn', `The page names no neighboring city. Link one or two near the end ("We also serve ..."): ${near.slice(0, 3).map(p => `${p.place} ${p.url}`).join(', ')}.`); }
    if (!inv) push('sitemap', 'warn', 'Built without the sitemap: links were not checked against live URLs and the keyword was not checked for cannibalization.');
    else if (inv.ageHours > 72) push('sitemap', 'warn', `The sitemap inventory is ${inv.ageHours} hours old. Read it again before publishing.`);
    const schema = buildSchema({ doc, brand, pack, type, url, slug, date, allow }), v = validate(schema, { doc, url, allow });
    for (const e of v.errors) push('schema', 'error', 'Schema: ' + e); for (const w of v.warnings) push('schema', 'note', 'Schema: ' + w);
    if (!r.ok) { out({ ok: false, url, report: r }, report(r, rel(f)) + `\n\nNot written. Fix the ${r.counts.error} error${r.counts.error === 1 ? '' : 's'} and build again.`); process.exitCode = 1; return; }
    const dir = path.join(A.out && A.out !== true ? path.resolve(A.out) : OUT, slug); fs.mkdirSync(dir, { recursive: true });
    const bp = blueprint({ doc, brand, pack, schema, type, slug, url }), files = { 'page.md': src, 'page.html': renderPage(doc, { schema, url, lang: m.language || 'en-US' }), 'body.html': renderBody(doc) + '\n', 'schema.json': JSON.stringify(schema, null, 1) + '\n', 'blueprint.json': JSON.stringify(bp, null, 1) + '\n', 'report.json': JSON.stringify({ built: new Date().toISOString(), url, type, keyword: m.keyword, stats: r.stats, counts: r.counts, findings: r.findings, cannibalization: can && { verdict: can.verdict, neighbors: can.neighbors.map(n => n.url) }, schemaTypes: schema['@graph'].map(n => n['@type']) }, null, 1) + '\n' };
    for (const [n, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), body);
    out({ ok: true, url, dir: rel(dir), files: Object.keys(files), report: r, schemaTypes: schema['@graph'].map(n => n['@type']) }, report(r, rel(f)) + `\n\nBuilt ${url}\n  schema: ${schema['@graph'].map(n => n['@type']).join(', ')}\n  ${Object.keys(files).map(n => rel(path.join(dir, n))).join('\n  ')}\nFor the dashboard: \`handoff\` puts the built pages in one file for its Publish module and tries it there.`);
  },

  validate() {
    const f = A._[0] || die('validate <schema.json> [--page page.md]'), schema = JSON.parse(fs.readFileSync(f, 'utf8')), doc = A.page && A.page !== true ? parse(fs.readFileSync(A.page, 'utf8'), A.page) : null;
    const v = validate(schema, { doc, allow: list(A.allow) });
    out(v, `${v.ok ? 'VALID' : 'INVALID'}  ${rel(f)}  ·  ${(schema['@graph'] || []).map(n => n['@type']).join(', ')}\n${v.errors.map(e => 'ERROR  ' + e).join('\n')}${v.warnings.length ? '\n' + v.warnings.map(e => 'note   ' + e).join('\n') : ''}`); if (!v.ok) process.exitCode = 1;
  },

  compare() {
    const files = []; for (const a of A._.length ? A._ : [OUT]) { const p = path.resolve(a); if (!fs.existsSync(p)) die(`Not found: ${a}`); if (fs.statSync(p).isDirectory()) { for (const e of fs.readdirSync(p).sort()) { const f = fs.existsSync(path.join(p, e, 'page.md')) ? path.join(p, e, 'page.md') : /\.(md|html?)$/i.test(e) ? path.join(p, e) : null; if (f) files.push(f); } } else files.push(p); }
    if (files.length < 2) die('compare needs two or more pages: a folder of built pages, a folder of drafts, or a list of files.');
    const brand = loadBrand(), pk = packFor({}, brand), docs = files.map(f => { const d = parse(fs.readFileSync(f, 'utf8'), f); return { name: path.basename(f) === 'page.md' ? path.basename(path.dirname(f)) : path.basename(f), text: d.blocks.filter(b => ['p', 'li', 'quote'].includes(b.type) || /^h[2-6]$/.test(b.type)).map(b => b.text + (/[.!?]$/.test(b.text) ? '' : '.')).join('\n'), headings: d.blocks.filter(b => /^h[2-6]$/.test(b.type)).map(b => b.text), mask: [d.meta.city, ...(brand ? brand.serviceCities || [] : []), ...(pk && pk.cities ? pk.cities.map(c => c.name) : [])].filter(Boolean) }; });
    const r = compare(docs, { limit: A.limit ? +A.limit : undefined }), top = r.pages.slice().sort((a, b) => b.similarity - a.similarity);
    out(r, [`${r.ok ? 'UNIQUE' : 'TOO ALIKE'}  ${r.count} pages  ·  closest pair shares ${Math.round(100 * (top[0] ? top[0].similarity : 0))}% of its four word runs (limit ${Math.round(100 * r.limit)}%)  ·  ${r.repeated.length} sentence${r.repeated.length === 1 ? '' : 's'} on more than one page`,
      ...r.pairs.slice(0, 20).map(p => `PAIR   ${Math.round(100 * p.similarity)}%  ${p.a}  <>  ${p.b}`), ...r.headings.filter(x => x.pages.length >= 3).slice(0, 15).map(x => `${x.pages.length >= 4 ? 'HEADING' : 'heading'} on ${x.pages.length} pages: "${x.sentence}"  (${x.pages.slice(0, 4).join(', ')}${x.pages.length > 4 ? ', ...' : ''})`), ...r.repeated.slice(0, 25).map(x => `${x.pages.length >= 3 ? 'REPEAT' : 'twice '} on ${x.pages.length} pages: "${x.sentence.slice(0, 110)}"  (${x.pages.slice(0, 4).join(', ')}${x.pages.length > 4 ? ', ...' : ''})`)].join('\n'));
    if (!r.ok) process.exitCode = 1;
  },

  async social() {
    const sub = A._.shift() || die('social lint <post.json> | social post <post.json> --platform facebook|gbp|all [--confirm] | social whoami'), brand = loadBrand(sub !== 'lint'), pack = packFor({}, brand);
    if (sub === 'whoami') { viaProxy(); const w = await social.whoami({ brand }); out(w, [`Facebook: ${w.facebook.ok ? `Page "${w.facebook.name}" (${w.facebook.page}) ${w.facebook.link || ''}` : 'not ready: ' + w.facebook.error}`, `Google Business Profile: ${w.gbp.ok ? (w.gbp.locations.length ? w.gbp.locations.map(l => `\n  account ${l.account} (${l.accountName})  location ${l.location}  ${l.title}${l.city ? ', ' + l.city : ''}${l.account === w.gbp.set.account && l.location === w.gbp.set.location ? '   <- set in the brand file' : ''}`).join('') : 'the credential works but lists no locations') : 'not ready: ' + w.gbp.error}`].join('\n')); return; }
    const f = A._[0] || die(`social ${sub} <post.json>`), post = JSON.parse(fs.readFileSync(f, 'utf8')), inv = loadInventory(brand), live = inv ? new Set(inv.pages.map(p => p.key)) : null;
    const want = sub === 'post' ? (A.platform === 'all' || A.all ? social.platforms(post) : list(A.platform)) : social.platforms(post);
    if (!want.length) die(sub === 'post' ? 'Name the platform: --platform facebook, --platform gbp or --platform all.' : 'The post file has no "facebook" or "gbp" text.');
    const checks = want.map(p => { if (!post[p] || !post[p].text) die(`The post file has no "${p}" text.`); return social.check(post, p, { pack, brand, live }); }), bad = checks.filter(c => !c.ok);
    if (sub === 'lint' || bad.length) { out(checks, checks.map(c => report(c, `${rel(f)} · ${c.platform} · ${c.length} characters`)).join('\n\n') + (bad.length && sub === 'post' ? '\n\nNot sent. Fix the errors first.' : '')); if (bad.length) process.exitCode = 1; return; }
    if (sub !== 'post') die(`Unknown: social ${sub}`);
    if (A.confirm) viaProxy();
    const res = []; for (const p of want) { try { res.push(await social.send(post, p, { brand, confirm: !!A.confirm, dir: LOCAL })); } catch (e) { res.push({ sent: false, platform: p, error: e.message }); process.exitCode = 1; } }
    out(res, res.map(x => x.sent ? `SENT  ${x.platform}  ${x.scheduled ? 'scheduled  ' : ''}${x.id}  ${x.url || ''}` : x.error ? `FAILED  ${x.platform}  ${x.error}` : x.duplicate ? `SKIPPED  ${x.platform}  ${x.note}` : x.pending && !x.request ? `HELD  ${x.platform}  ${x.note}` : `DRY RUN  ${x.platform}${x.pending ? '  (PENDING: waits on a page that is not live)' : ''}\n  ${x.request.method} ${x.request.url}\n  ${JSON.stringify(x.request.body, null, 1).split('\n').join('\n  ')}\n  ${x.note}`).join('\n\n'));
  },
};

if (A.help || !C[cmd]) { C.help(); if (!C[cmd] && cmd !== 'help') process.exitCode = 2; }
/* no dashboard connected, or no browser to run it in, is a plain message; a missing browser has its own exit code (3) */
else Promise.resolve().then(() => C[cmd]()).catch(e => { const plain = e instanceof NotConnected || e instanceof live.Unavailable || e instanceof NoSuchHandoff || e instanceof Pinned; console.error(e && e.stack && process.env.CS_DEBUG ? e.stack : (plain ? '' : 'Error: ') + (e && e.message ? e.message : e)); process.exit(e instanceof live.Unavailable ? 3 : 2); });
