#!/usr/bin/env node
/* The content strategist's toolkit. Node 22, no packages.

   node content-strategist/cli.mjs <command>

   Where things stand
     where                                the brand on file, the sitemap inventory, where client files go

   What the vertical knows
     verticals                            the packs: one per atlas in the console
     keywords <vertical> [--angle id] [--city name] [--find text]
     market <vertical> [--city name]      sourced local facts for a page
     extract <atlas.html> [--id dfw]      rebuild a deep pack (and the local brand file) from a Thermal Debt atlas
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

   Social
     social lint <post.json>
     social post <post.json> --platform facebook|gbp|all [--confirm]
     social whoami

   Common options: --vertical id, --brand file, --json
   Client files (brand, sitemap inventory, built pages, post ledger) live in ~/.leviathan/content-strategist, outside the
   repository; CS_LOCAL, CS_OUT, CS_BRAND and CS_BRAND_JSON move them. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { HERE, REPO, listPacks, loadPack, deepPack, brandProfile, writePack, harvestConsole, isThermalDebt } from './lib/atlas.mjs';
import { parse, parseMarkdown, renderBody, renderPage, slugify } from './lib/doc.mjs';
import { lint, report } from './lib/lint.mjs';
import { crawl, fromFile, inventory, deepen, cannibal, linkTargets, Blocked } from './lib/sitemap.mjs';
import { buildSchema, validate, blueprint, pageUrl } from './lib/schema.mjs';
import * as social from './lib/social.mjs';

/* Everything that names the client lives outside the repository: the brand file, the sitemap inventory, the finished pages
   and the ledger of posts. The console's build scans every file under the repository, ignored or not, and refuses it
   while a withheld name is anywhere in it. */
const LOCAL = path.resolve(process.env.CS_LOCAL || path.join(os.homedir(), '.leviathan', 'content-strategist'));
const OUT = path.resolve(process.env.CS_OUT || path.join(LOCAL, 'out'));
const inRepo = p => !path.relative(REPO, p).startsWith('..') && fs.existsSync(path.join(REPO, '.git'));
for (const [name, p] of [['CS_LOCAL', LOCAL], ['CS_OUT', OUT]]) if (inRepo(p)) console.error(`Warning: ${name} (${p}) is inside the repository. The console's withheld name scan reads every file there; keep client files outside it.`);

/* ---------- arguments ---------- */
const BOOL = new Set(['json', 'deep', 'confirm', 'no-sitemap', 'help', 'all', 'add']);
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
  if (required) die(`No brand file at ${f}. The brand (name, site, phone, license, address) stays out of the repository.\nMake it one of three ways:\n  node content-strategist/cli.mjs extract <atlas.html>     reads the brand an atlas was built for\n  mkdir -p ${path.dirname(f)} && cp content-strategist/brand.example.json ${f}     then fill it in\n  set CS_BRAND_JSON to the same JSON in the environment, so every session has it`);
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
    const brand = loadBrand(), inv = loadInventory(brand), res = { local: LOCAL, out: OUT, drafts: path.join(LOCAL, 'drafts'), brandFile: brand ? brand._file : null, brand: brand ? { name: brand.name, site: brand.url, vertical: brand.vertical || null, license: brand.license ? 'set' : 'MISSING', phone: brand.phone ? 'set' : 'MISSING', facebookPage: (brand.social || {}).facebookPageId ? 'set' : 'not set', businessProfile: (brand.social || {}).gbpAccountId && (brand.social || {}).gbpLocationId ? 'set' : 'not set' } : null, sitemap: inv ? { pages: inv.pages.length, ageHours: inv.ageHours, file: inv._file } : null };
    out(res, [`Client files: ${LOCAL}   (outside the repository; drafts in ${res.drafts}, built pages in ${OUT})`, brand ? `Brand: ${brand.name} · ${brand.url} · vertical ${brand.vertical || 'not set'} · license ${res.brand.license} · phone ${res.brand.phone} · Facebook Page ${res.brand.facebookPage} · Business Profile ${res.brand.businessProfile}   (${brand._file})` : `Brand: none yet. Run extract on an atlas, copy brand.example.json to ${brandFile()}, or set CS_BRAND_JSON.`, inv ? `Sitemap: ${inv.pages.length} live URLs, read ${inv.ageHours}h ago` : 'Sitemap: not read yet. Run: sitemap'].join('\n'));
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
    if (C0) { const share = Object.fromEntries(C0.angles.map(x => [x.id, x.share])); angles = angles.filter(a => share[a.id]).map(a => Object.assign({}, a, { demandShare: share[a.id] })).sort((x, y) => y.demandShare - x.demandShare); }
    if (find) angles = angles.filter(a => JSON.stringify([a.label, a.keywords]).toLowerCase().includes(find));
    const fill = k => city ? k.replace(/\{city\}/gi, city) : k;
    const rows = angles.map(a => ({ id: a.id, label: a.label, line: a.line, page: a.page ? a.page.slug : a.path || '', why: a.why, demandShare: a.demandShare, reach: a.reach, topCities: a.topCities, keywords: Object.fromEntries(Object.entries(a.keywords).map(([k, v]) => [k, v.map(fill)])) }));
    const res = { vertical: pack.id, atlas: pack.atlas, note: pack.note, city: C0 ? { name: C0.name, county: C0.county, demand: C0.demand } : undefined, angles: rows, negatives: A.angle ? undefined : pack.negatives };
    const T = [`${pack.atlas} · ${pack.vertical}${C0 ? ' · ' + C0.name + ' (' + C0.county + ' County)' : ''}`, pack.note || '', ''];
    for (const r of rows) {
      T.push(`${r.id}  ${r.label}${r.page ? '   page: ' + r.page : ''}${r.demandShare != null ? `   demand in ${r.demandShare}% of ${city}'s ZIPs` : r.reach ? `   demand in ${r.reach.zips} of ${r.reach.of} ZIPs` : ''}`);
      if (r.why) T.push('   when: ' + r.why);
      for (const [k, v] of Object.entries(r.keywords)) if (v.length) T.push(`   ${k.padEnd(10)} ${v.join(' | ')}`);
      if (r.topCities && r.topCities.length && !C0) T.push('   strongest  ' + r.topCities.join(', '));
      T.push('');
    }
    if (res.negatives) for (const [k, v] of Object.entries(res.negatives)) T.push(`${k}: ${v.slice(0, 40).join(', ')}${v.length > 40 ? ', ...' : ''}`);
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

  async extract() {
    const f = A._[0] || die('extract <atlas.html> [--id dfw]'); const text = fs.readFileSync(f, 'utf8');
    if (!isThermalDebt(text)) die('This file is not a Thermal Debt atlas (no atlas data block with service angles). Keyword packs for the other atlases come from: harvest');
    const { pack, brand } = deepPack(text, { id: A.id && A.id !== true ? A.id : 'dfw', file: f }), w = await writePack(pack);
    const res = { pack: w.row, withheldStringsDropped: w.dropped, withheldListChecked: w.checked };
    if (brand) { const b = Object.assign({ vertical: pack.id }, brandProfile(brand)), bf = brandFile(); const keep = fs.existsSync(bf) ? JSON.parse(fs.readFileSync(bf, 'utf8')) : {}; if (keep.social) b.social = Object.assign(b.social, Object.fromEntries(Object.entries(keep.social).filter(([, v]) => v))); fs.mkdirSync(path.dirname(bf), { recursive: true }); fs.writeFileSync(bf, JSON.stringify(b, null, 1) + '\n'); res.brand = rel(bf); }
    out(res, `Pack ${w.row.id}: ${w.row.angles} angles, ${w.row.keywords} keywords, ${pack.cities.length} cities, ${pack.compliance.rules.length} advertising rules  ->  ${rel(path.join(HERE, 'verticals', pack.id + '.json'))}\n${w.checked ? `Withheld names: ${w.dropped} string${w.dropped === 1 ? '' : 's'} dropped from the pack.` : 'Withheld list not found; the pack was not scanned.'}${res.brand ? `\nBrand  ->  ${res.brand} (local, ignored by git)` : ''}`);
  },

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
    const r = linkTargets(kw, inv.pages, { pack, brand, n: +A.n || 6, type: A.type && A.type !== true ? A.type : 'landing', selfUrl: A.url && A.url !== true ? A.url : '' });
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
    if (!inv) push('sitemap', 'warn', 'Built without the sitemap: links were not checked against live URLs and the keyword was not checked for cannibalization.');
    else if (inv.ageHours > 72) push('sitemap', 'warn', `The sitemap inventory is ${inv.ageHours} hours old. Read it again before publishing.`);
    const schema = buildSchema({ doc, brand, pack, type, url, slug, date, allow }), v = validate(schema, { doc, url, allow });
    for (const e of v.errors) push('schema', 'error', 'Schema: ' + e); for (const w of v.warnings) push('schema', 'note', 'Schema: ' + w);
    if (!r.ok) { out({ ok: false, url, report: r }, report(r, rel(f)) + `\n\nNot written. Fix the ${r.counts.error} error${r.counts.error === 1 ? '' : 's'} and build again.`); process.exitCode = 1; return; }
    const dir = path.join(A.out && A.out !== true ? path.resolve(A.out) : OUT, slug); fs.mkdirSync(dir, { recursive: true });
    const bp = blueprint({ doc, brand, pack, schema, type, slug, url }), files = { 'page.md': src, 'page.html': renderPage(doc, { schema, url, lang: m.language || 'en-US' }), 'body.html': renderBody(doc) + '\n', 'schema.json': JSON.stringify(schema, null, 1) + '\n', 'blueprint.json': JSON.stringify(bp, null, 1) + '\n', 'report.json': JSON.stringify({ built: new Date().toISOString(), url, type, keyword: m.keyword, stats: r.stats, counts: r.counts, findings: r.findings, cannibalization: can && { verdict: can.verdict, neighbors: can.neighbors.map(n => n.url) }, schemaTypes: schema['@graph'].map(n => n['@type']) }, null, 1) + '\n' };
    for (const [n, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), body);
    out({ ok: true, url, dir: rel(dir), files: Object.keys(files), report: r, schemaTypes: schema['@graph'].map(n => n['@type']) }, report(r, rel(f)) + `\n\nBuilt ${url}\n  schema: ${schema['@graph'].map(n => n['@type']).join(', ')}\n  ${Object.keys(files).map(n => rel(path.join(dir, n))).join('\n  ')}`);
  },

  validate() {
    const f = A._[0] || die('validate <schema.json> [--page page.md]'), schema = JSON.parse(fs.readFileSync(f, 'utf8')), doc = A.page && A.page !== true ? parse(fs.readFileSync(A.page, 'utf8'), A.page) : null;
    const v = validate(schema, { doc, allow: list(A.allow) });
    out(v, `${v.ok ? 'VALID' : 'INVALID'}  ${rel(f)}  ·  ${(schema['@graph'] || []).map(n => n['@type']).join(', ')}\n${v.errors.map(e => 'ERROR  ' + e).join('\n')}${v.warnings.length ? '\n' + v.warnings.map(e => 'note   ' + e).join('\n') : ''}`); if (!v.ok) process.exitCode = 1;
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
    out(res, res.map(x => x.sent ? `SENT  ${x.platform}  ${x.scheduled ? 'scheduled  ' : ''}${x.id}  ${x.url || ''}` : x.error ? `FAILED  ${x.platform}  ${x.error}` : x.duplicate ? `SKIPPED  ${x.platform}  ${x.note}` : `DRY RUN  ${x.platform}\n  ${x.request.method} ${x.request.url}\n  ${JSON.stringify(x.request.body, null, 1).split('\n').join('\n  ')}\n  ${x.note}`).join('\n\n'));
  },
};

if (A.help || !C[cmd]) { C.help(); if (!C[cmd] && cmd !== 'help') process.exitCode = 2; }
else Promise.resolve().then(() => C[cmd]()).catch(e => { console.error(e && e.stack && process.env.CS_DEBUG ? e.stack : 'Error: ' + (e && e.message ? e.message : e)); process.exit(2); });
