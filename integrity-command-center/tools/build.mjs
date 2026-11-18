#!/usr/bin/env node
/* Builds the Integrity Air Conditioning & Heating Command Center: one dashboard file made from

     --base       the dashboard with the current graphics engine (Rooftop Scout 12, Scout Engine)
     --campaigns  the paid ads package      (the folder that holds campaign-files/, pages/, page-files/)
     --city       the city pages package    (the folder that holds for-the-dashboard/handoff.json)
     --service    the service area package  (the folder that holds pages/, manifest.csv, checks.json)
     --out        the file to write

   What it does to the base, and nothing else:
     1. names the dashboard (title, header, footer note);
     2. puts the six heating campaigns and the sourced city pages on the Agent Desk (#lvp-data), keeping what was there;
     3. adds the Paid Ads Strategist module (src/paid-ads-strategist.*) with its own data (#lvs-data);
     4. gives the Content Strategist's Pages view the 410 service area heating pages (#lvc-heat, gzip) and marks the
        works those pages answer as built (#lvc-data);
     5. checks that every inline script still parses and that every page file comes back out byte for byte.

   No package is run: the inputs are read as text. Node 18 or newer, no dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? a.concat([[x.slice(2), all[i + 1]]]) : a), []));
for (const k of ['base', 'campaigns', 'city', 'service', 'out']) if (!args[k]) { console.error(`missing --${k}`); process.exit(2); }
const NAME = 'Integrity Air Conditioning & Heating Command Center';
const NOW = args.now || new Date().toISOString();
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const readJson = (...p) => JSON.parse(read(...p).replace(/^\uFEFF/, ''));
const fail = msg => { console.error('BUILD FAILED: ' + msg); process.exit(1); };
const must = (ok, msg) => { if (!ok) fail(msg); };
/* JSON that can sit inside a script element: no "<" to end the element early, no line separators */
const safeJson = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unHtml = s => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const num = s => +String(s).replace(/[^0-9.\-]/g, '');

/* ---------- a small CSV reader (quoted fields, doubled quotes, line breaks inside quotes) ---------- */
function csv(text) {
  const rows = []; let row = [], cell = '', q = false; text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift(); return rows.filter(r => r.length > 1 || r[0] !== '').map(r => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? '' : r[i]])));
}

/* ---------- the base file, edited in place by exact anchors ---------- */
let html = read(args.base);
const count = (s, needle) => s.split(needle).length - 1;
function swap(from, to, times = 1) { const n = count(html, from); must(n === times, `expected ${times} of ${JSON.stringify(from.slice(0, 90))}, found ${n}`); html = html.split(from).join(to); }
/* the text of a script or style element found by a string inside it */
function block(marker, tag) {
  const at = html.indexOf(marker); must(at >= 0 && html.indexOf(marker, at + 1) < 0, `one "${marker.slice(0, 60)}" expected`);
  const open = html.lastIndexOf('<' + tag, at), start = html.indexOf('>', open) + 1, end = html.indexOf('</' + tag + '>', at);
  must(open >= 0 && start > 0 && end > start, `no <${tag}> around "${marker.slice(0, 60)}"`);
  return { open, start, end, close: end + tag.length + 3, text: html.slice(start, end) };
}
const setBlock = (b, text) => { html = html.slice(0, b.start) + text + html.slice(b.end); };
const dataBlock = id => { const m = `id="${id}">`, at = html.indexOf(m); must(at >= 0, `no #${id}`); const start = at + m.length, end = html.indexOf('</script>', start); return { start, end, text: html.slice(start, end) }; };

/* ============================ 1. the name ============================ */
swap('<title>Integrity Air · DFW Thermal Debt Atlas · Build 6</title>', `<title>${escHtml(NAME)}</title>`);
swap('<div class="nm">DFW Thermal Debt Atlas</div>', `<div class="nm">${escHtml(NAME)}</div>`);
swap('<div class="nm">${esc(BRAND.name)}</div>', '<div class="nm">${esc(BRAND.name)} Command Center</div>');
swap('document.title = `${BRAND.short} · DFW Thermal Debt Atlas`;', 'document.title = `${BRAND.name} Command Center`;');
swap('<span>No keyword or Ahrefs data was pulled for this build.</span>', `<span>No keyword or Ahrefs data was pulled for this build.</span><span>Command Center, November 18, 2026: the Scout Engine of Rooftop Scout 12 (steadier and sharper 3D), the Paid Ads Strategist with six heating campaigns and their landing pages, and the Content Strategist's 70 rewritten city pages and 410 heating pages for the service areas, with their Census sources linked.</span>`);

/* ============================ 2. the Agent Desk ============================ */
const FILL = { rating: '4.9', floor: '900', source: 'Google', asOf: 'November 2026', line: '4.9 from over 900 Google reviews' };
/* copy carries tokens for the review score, and every build fills them from the one figure on file */
const fill = v => (typeof v === 'string' ? v.replace(/\{reviews\.(\w+)\}/g, (m, k) => { must(FILL[k] != null, `no figure on file for ${m}`); return FILL[k]; }) : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v);
const section = (md, title) => { const m = new RegExp('^## ' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\n([\\s\\S]*?)(?=^## |\\s*$(?![\\s\\S]))', 'm').exec(md); return m ? m[1] : ''; };
const bullets = text => text.split('\n').filter(l => /^- /.test(l)).map(l => l.slice(2).trim());
const WHAT = {
  'README.md': 'What to do with this folder, and what to check before anything is switched on.',
  'campaign-desk-plan.json': 'The plan file the Campaign Desk loads: module 08, ⤒ Load. The Agent Desk loads this same plan with one button.',
  'campaign.json': 'The campaign file this folder was built from: the plan, the copy and every confirmed claim. The strategist builds from it again after a change.',
};
const ANGLE_LABEL = { heatrepair: 'Heating Repair', furnace: 'Furnace', heatpump: 'Heat Pump', eheat: 'Electric Heat', heattune: 'Heating Tune Up', ductless: 'Ductless' };
const lvc = dataBlock('lvc-data'), LVC = JSON.parse(lvc.text);
const LINE_NAME = Object.fromEntries(LVC.lines.map(l => [l.id, l.name]));

const review = read(args.campaigns, 'ad-copy-for-review.html');
const ORDER = [...review.matchAll(/<section class="camp" id="c\d">[\s\S]*?<h2>([\s\S]*?)<\/h2><p class="lede">([\s\S]*?)<\/p>[\s\S]*?href="pages\/([^"]+)\.html"[\s\S]*?<code>([\s\S]*?)<\/code>/g)].map(m => ({ label: unHtml(m[1]), name: unHtml(m[2]), lp: m[3], google: unHtml(m[4]) }));
must(ORDER.length === 6, `six campaigns expected in ad-copy-for-review.html, found ${ORDER.length}`);

function paidBundle(dir) {
  const at = path.join(args.campaigns, 'campaign-files', dir), names = fs.readdirSync(at).sort();
  const planFile = readJson(at, 'campaign-desk-plan.json'), C = readJson(at, 'campaign.json'), md = read(at, 'README.md');
  const note = planFile.handoff || {}, plan = Object.assign({}, planFile); delete plan.handoff;
  must(note.agent === 'paid-ads-specialist' && C.name === note.campaign, `${dir}: the plan's hand-off note does not match campaign.json`);
  const fc = /Forecast a month[^:]*:\s*([\d,.]+) leads, ([\d,.]+) booked jobs, \$([\d,.]+) a booked job/.exec(md), span = /for (\d+) weeks from (\d{4}-\d\d-\d\d) to (\d{4}-\d\d-\d\d)/.exec(md), target = /Target cost a booked job: \$([\d,]+)/.exec(md), pace = /paces this flight by season \(([^)]+)\):\s*([^.]+)\./.exec(md);
  must(fc && span, `${dir}: README.md has no forecast or no dates`);
  must(+span[1] === plan.weeks && span[2] === plan.start, `${dir}: README.md dates differ from the plan`);
  const markets = csv(read(at, names.find(n => /^campaign-plan_/.test(n)))).map(r => ({ zip: r.zip, city: r.city, county: r.county, minutes: num(r.minutes_from_shop), bid: num(r.bid_modifier), spend: num(r.desk_monthly_usd), es: r.spanish === 'yes', angles: r.angles_with_demand ? r.angles_with_demand.split(/\s*;\s*/) : [] }));
  must(markets.length === plan.picks.length && markets.every(m => plan.picks.includes(m.zip)), `${dir}: the market sheet and the plan name different ZIPs`);
  const what = Object.assign({}, WHAT, Object.fromEntries(bullets(section(md, 'The files')).map(l => /^`([^`]+)`:\s*(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]])));
  const first = ['README.md'], last = ['campaign-desk-plan.json', 'campaign.json'];
  const files = first.concat(names.filter(n => !first.includes(n) && !last.includes(n)), last).map(n => ({ name: n, what: what[n] || '', text: read(at, n) }));
  const search = fill(C.search || []), ads = fill(C.ads || []), h = C.heat || null;
  must(!/\{reviews\./.test(JSON.stringify([search, ads])), `${dir}: a review token was left unfilled`);
  /* the filled copy must be the copy in the sheet the specialist built */
  const creative = read(at, names.find(n => /^creative_/.test(n)));
  for (const c of search) for (const g of c.adGroups || []) for (const x of (g.ad.headlines || []).concat(g.ad.descriptions || [])) { const t = typeof x === 'string' ? x : x.text; must(creative.includes(t.replace(/"/g, '""')), `${dir}: "${t}" is not in the creative sheet`); }
  const month = pace ? pace[2].split(',').map(s => /([A-Z][a-z]{2})\s*\$([\d,]+) a day/.exec(s)).filter(Boolean).map(m => ({ month: m[1], daily: num(m[2]), stub: false })) : [];
  return {
    format: 'leviathan.handoff.bundle', v: 1, id: 'paid:' + dir, agent: note.agent, made: note.made, title: C.name, client: plan.brand || 'Integrity Air', atlas: note.atlas || null,
    paid: {
      plan,
      summary: { line: plan.line, lineLabel: LINE_NAME[plan.line] || plan.line, budget: plan.budget, start: plan.start, end: span[3], weeks: plan.weeks, bookRate: plan.bookRate, jobVal: plan.jobVal, angles: (plan.angles || []).map(a => ANGLE_LABEL[a] || a), markets: markets.length, totals: { leads: num(fc[1]), booked: num(fc[2]), costPerBooked: num(fc[3]), target: target ? num(target[1]) : null }, flight: month, pacedBy: pace ? pace[1] : '', extra: [], extraTotal: 0, deskModel: '', heat: h ? { month: h.month, zips: h.zips, spent: h.spent, leads: h.leads, jobs: h.jobs, costPerJob: h.costPerJob, grade: h.grade, same: /This campaign changed that plan/.test(md) ? false : null } : null },
      markets, search, ads, confirmed: C.confirmed || [], channels: { meta: 'Meta (Facebook and Instagram)' },
      stats: { campaigns: search.length + (ads.some(a => a.channel === 'meta') ? 1 : 0), adGroups: search.reduce((n, c) => n + (c.adGroups || []).length, 0), keywords: search.reduce((n, c) => n + (c.adGroups || []).reduce((k, g) => k + (g.keywords || []).length, 0), 0), ads: search.reduce((n, c) => n + (c.adGroups || []).length, 0) + ads.length, extraMonthly: 0 },
      before: bullets(section(md, 'Before anything is switched on')), running: bullets(section(md, 'Running it')), files,
    },
  };
}
const DIRS = fs.readdirSync(path.join(args.campaigns, 'campaign-files')).filter(d => fs.statSync(path.join(args.campaigns, 'campaign-files', d)).isDirectory());
const PAID = ORDER.map(o => { const b = DIRS.map(paidBundle).find(x => x.title === o.name); must(b, `no campaign folder for "${o.name}"`); return b; });
must(PAID.length === 6 && new Set(PAID.map(b => b.id)).size === 6, 'six campaigns expected');

const CITY = readJson(args.city, 'for-the-dashboard', 'handoff.json');
must(CITY.format === 'leviathan.handoff.bundle' && CITY.id === 'content:pages' && CITY.content.pages.length === 70, 'the city pages hand-off is not the 70 page bundle');

const lvp = dataBlock('lvp-data'), LVP = JSON.parse(lvp.text);
const kept = LVP.bundles.filter(b => b.id !== CITY.id && !PAID.some(p => p.id === b.id));
const lvpNew = { v: LVP.v, installed: NOW, atlas: { name: NAME, build: LVP.atlas.build, sha256: '' }, repairs: LVP.repairs, bundles: [...PAID, CITY, ...kept] };
html = html.slice(0, lvp.start) + safeJson(lvpNew) + html.slice(lvp.end);

/* the desk's words for the agent, and the build it reads when the title no longer carries one */
{
  const b = block('/* The Agent Desk: a module added to a Thermal Debt atlas', 'script'); let js = b.text;
  const n = count(js, 'specialist'); must(n > 10, 'the Agent Desk script is not the one expected');
  js = js.replace(/specialist/g, 'strategist').replace(/paid-ads-strategist/g, 'paid-ads-specialist');
  const from = "return { name: t.find(p => /atlas/i.test(p)) || '', build: (/\\bBuild\\s+(\\d+(?:\\.\\d+)*)/i.exec(document.title) || [])[1] || '', sha256: embedded.atlas.sha256 || '' };";
  must(count(js, from) === 1, 'the Agent Desk no longer reads its build from the title this way');
  js = js.replace(from, "return { name: t.find(p => /atlas/i.test(p)) || embedded.atlas.name || '', build: (/\\bBuild\\s+(\\d+(?:\\.\\d+)*)/i.exec(document.title) || [])[1] || String(embedded.atlas.build || ''), sha256: embedded.atlas.sha256 || '' };");
  setBlock(b, js);
}

/* ============================ 3. the Paid Ads Strategist ============================ */
const CSS_MARK = '/*__PAGE_CSS__*/';
/* a page file with its shared stylesheet taken out, and the check that it goes back in byte for byte */
function lift(text, css, name) { const open = text.indexOf('<style>'), close = text.indexOf('</style>'); must(open >= 0 && text.slice(open + 7, close) === css && !text.includes(CSS_MARK), `${name}: not the shared stylesheet`); const out = text.slice(0, open + 7) + CSS_MARK + text.slice(close); must(out.split(CSS_MARK).join(css) === text, `${name}: does not rebuild`); return out; }
const cssOf = text => text.slice(text.indexOf('<style>') + 7, text.indexOf('</style>'));
const lpNames = ORDER.map(o => o.lp), lpCss = cssOf(read(args.campaigns, 'pages', lpNames[0] + '.html'));
const LP = ORDER.map((o, i) => {
  const text = read(args.campaigns, 'pages', o.lp + '.html'), chk = readJson(args.campaigns, 'page-files', o.lp, 'checks.json').page.check;
  const g = re => (re.exec(text) || [])[1] || '';
  return { slug: o.lp, campaign: PAID[i].id, title: unHtml(g(/<title>([\s\S]*?)<\/title>/)), h1: unHtml(g(/<h1[^>]*>([\s\S]*?)<\/h1>/)), desc: unHtml(g(/<meta name="description" content="([^"]*)"/)), noindex: /<meta name="robots" content="[^"]*noindex/.test(text), words: chk.words, score: chk.audit.score, grade: chk.audit.grade, left: chk.audit.findings || [], sources: [...text.matchAll(/<a href="(https:\/\/data\.census\.gov\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m => ({ url: m[1].replace(/&amp;/g, '&'), text: unHtml(m[2]) })), html: lift(text, lpCss, o.lp) };
});
const pageFiles = [{ name: 'page-files/landing-page-styles.css', text: read(args.campaigns, 'page-files', 'landing-page-styles.css') }].concat(lpNames.flatMap(n => ['blueprint.json', 'checks.json', 'content.html', 'schema.json'].map(f => ({ name: `page-files/${n}/${f}`, text: read(args.campaigns, 'page-files', n, f) }))));
const confirmAt = review.indexOf('id="confirm"'); must(confirmAt > 0, 'no "to confirm" list in ad-copy-for-review.html');
const CONFIRM = [...review.slice(confirmAt).matchAll(/<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g)].map(m => ({ t: unHtml(m[1]), d: unHtml(m[2]) }));
must(CONFIRM.length >= 8, 'the "to confirm" list is shorter than expected');
const LVS = {
  format: 'integrity.paid-ads', v: 1, made: PAID.map(b => b.made).sort().pop(), installed: NOW, reviews: FILL,
  campaigns: ORDER.map((o, i) => ({ id: PAID[i].id, label: o.label, lp: o.lp, google: o.google })),
  pages: { css: lpCss, mark: CSS_MARK, list: LP }, pageFiles, confirm: CONFIRM,
  notes: { readme: read(args.campaigns, 'READ-ME-FIRST.txt'), reviews: read(args.campaigns, 'REVIEW-SCORE-TEMPLATE.txt') },
};

/* ============================ 4. the Content Strategist ============================ */
const MAN = csv(read(args.service, 'manifest.csv')), CHECKS = readJson(args.service, 'checks.json');
const SERVICES = [['heating-repair', 'Heating repair'], ['furnace-replacement', 'Furnace replacement'], ['heat-pump-repair', 'Heat pump repair'], ['electric-furnace-repair', 'Electric furnace repair'], ['heating-tune-up', 'Heating tune up'], ['ductless-mini-splits', 'Ductless mini splits']];
const DEMAND = { 'trigger present': 'found', 'no trigger: low priority': 'low', 'not in the dashboard': 'none' };
const pageDir = path.join(args.service, 'pages'), pageNames = fs.readdirSync(pageDir).filter(n => /\.html$/.test(n)).sort();
const heatCss = cssOf(read(pageDir, pageNames[0])), heatHtml = {};
for (const n of pageNames) heatHtml[n.replace(/\.html$/, '')] = lift(read(pageDir, n), heatCss, n);
const rows = MAN.map(r => {
  must(SERVICES.some(s => s[0] === r.service), `manifest.csv: unknown service ${r.service}`);
  must(/^https:\/\/www\.integrityairconditioning\.com\/[a-z0-9\/-]*$/.test(r.address), `manifest.csv: ${r.address} is not an address on the site`);
  if (r.status !== 'new page') return { c: r.city, s: r.service, live: r.address, kw: r.keyword, note: r.note };
  const slug = r.address.replace(/\/$/, '').split('/').pop(); must(heatHtml[slug], `manifest.csv names ${slug}, and there is no such page file`);
  must(DEMAND[r['demand in the dashboard']], `manifest.csv: unknown demand "${r['demand in the dashboard']}"`);
  return { c: r.city, s: r.service, slug, u: r.address, kw: r.keyword, t: r.title, w: num(r.words), g: num(r['reading grade']), chk: r['dr hvac page check'], fig: r['local figures'] === 'yes', d: DEMAND[r['demand in the dashboard']], note: r.note };
});
const written = rows.filter(r => r.slug);
must(written.length === pageNames.length && written.length === CHECKS.pages, `the manifest lists ${written.length} new pages, the folder holds ${pageNames.length}, checks.json says ${CHECKS.pages}`);
const tally = k => written.filter(r => r.d === k).length;
const HEAT_SUMMARY = { made: CHECKS.made, pages: written.length, cities: new Set(rows.map(r => r.c)).size, live: rows.length - written.length, services: SERVICES.map(([id, label]) => ({ id, label, pages: written.filter(r => r.s === id).length })), demand: { found: tally('found'), low: tally('low'), none: tally('none') }, words: written.reduce((n, r) => n + r.w, 0), links: CHECKS.links, score100: CHECKS.drHvac.score100, likeness: CHECKS.likeness };
const HEAT = { format: 'integrity.heating-pages', v: 1, made: CHECKS.made, css: heatCss, mark: CSS_MARK, services: SERVICES.map(([id, label]) => ({ id, label })), rows, html: heatHtml, checks: CHECKS,
  files: ['READ-ME-FIRST.txt', 'manifest.csv', 'links-to-add.csv', 'city-page-link-blocks.html', 'checks.json'].map(n => ({ name: n, text: read(args.service, n) })) };
const heatB64 = zlib.gzipSync(Buffer.from(JSON.stringify(HEAT), 'utf8'), { level: 9 }).toString('base64');

/* the plan: the city pages as handed over now, and every work a new page answers word for word marked as built */
LVC.built = CITY.content.info.map(i => ({ slug: i.slug, url: i.url, city: i.city, keyword: i.keyword, title: i.title, words: i.words, grade: i.grade }));
const rawScore = w => 0.5 * w.val + 0.3 * w.pri + 0.2 * (100 - w.prs);
const scored = w => w.val != null && w.pri != null && w.prs != null;
must(LVC.works.every(w => !scored(w) || Math.abs(Math.round(rawScore(w) * LVC.mark[w.st]) - w.sc) <= 1), 'the plan no longer scores a work the way this build assumes');
let marked = 0;
for (const r of written) {
  const w = LVC.works.find(x => x.t === 'service-city' && x.c === r.c && x.kw === r.kw); if (!w || (w.st !== 'gap' && w.st !== 'hub')) continue;
  w.st = 'built'; w.u = r.u; if (scored(w)) w.sc = Math.round(rawScore(w) * LVC.mark.built); marked++;
}
LVC.reads.built = LVC.built.length + written.length;
LVC.heat = HEAT_SUMMARY; LVC.cityPages = { made: CITY.made, sources: count(JSON.stringify(CITY.content.pages), '_blank'), census: count(JSON.stringify(CITY.content.pages), 'data.census.gov') };
{ const b = dataBlock('lvc-data'); html = html.slice(0, b.start) + safeJson(LVC) + html.slice(b.end); }

/* the Pages view, rewritten to hold both sets */
{
  const b = block('/* The Content Strategist: a module of its own in a Thermal Debt atlas', 'script'); let js = b.text;
  const a = js.indexOf('      /* ----- the pages the agent has built ----- */'), z = js.indexOf('      /* ----- what the plan reads ----- */');
  must(a > 0 && z > a, 'the Content Strategist has no Pages view where one is expected');
  js = js.slice(0, a) + read(HERE, 'src', 'strategist-pages.js') + js.slice(z);
  const built = "`${N(arr(S.built).length)} built pages, with what the gate measured.`";
  must(count(js, built) === 1, 'the Content Strategist counts its built pages differently now');
  js = js.replace(built, "`${N(arr(S.built).length + (obj(S.heat).pages || 0))} built pages, with what the gate measured.`");
  const st = "built: arr(S.built).length,"; must(count(js, st) === 1, 'the Content Strategist reports its state differently now');
  js = js.replace(st, "built: arr(S.built).length, heat: obj(S.heat).pages || 0,");
  setBlock(b, js);
}
{ const b = block('/* Styles for the Content Strategist module.', 'style'); setBlock(b, b.text + read(HERE, 'src', 'strategist-pages.css')); }

/* the new module and the two data blocks go in ahead of the Content Strategist, so the rail reads Agent Desk, Paid Ads
   Strategist, Content Strategist */
{
  const at = html.indexOf('<style id="lvc-style">'); must(at > 0 && html.indexOf('<style id="lvc-style">', at + 1) < 0, 'no Content Strategist style block to stand before');
  const add = `<style id="lvs-style">${read(HERE, 'src', 'paid-ads-strategist.css')}</style>\n<script type="application/json" id="lvs-data">${safeJson(LVS)}</script>\n<script>${read(HERE, 'src', 'paid-ads-strategist.js')}</script>\n<script type="application/octet-stream" id="lvc-heat">${heatB64}</script>\n`;
  must(!/<\/script/i.test(read(HERE, 'src', 'paid-ads-strategist.js')) && !/<\/script/i.test(read(HERE, 'src', 'strategist-pages.js')), 'a module source would end its own script element');
  html = html.slice(0, at) + add + html.slice(at);
}

/* ============================ 5. checks ============================ */
/* every script element in document order; a "<script" inside a script is text, as it is to a browser */
const scripts = []; { const low = html.toLowerCase(); let p = low.indexOf('<body'); for (;;) { const o = low.indexOf('<script', p); if (o < 0) break; const s = low.indexOf('>', o) + 1, e = low.indexOf('</script', s); must(e > 0, 'a script element is not closed'); scripts.push({ attrs: html.slice(o + 7, s - 1), text: html.slice(s, e) }); p = e + 9; } }
let parsed = 0, data = 0;
for (const s of scripts) {
  const type = (/type\s*=\s*"([^"]*)"/i.exec(s.attrs) || [])[1] || '';
  if (!type || /javascript/i.test(type)) { try { new vm.Script(s.text); parsed++; } catch (e) { fail(`an inline script does not parse (${s.text.slice(0, 70).replace(/\s+/g, ' ')}): ${e.message}`); } }
  else if (/json/i.test(type)) { try { JSON.parse(s.text); data++; } catch (e) { fail(`a data block is not JSON (${s.attrs}): ${e.message}`); } }
}
{ const back = JSON.parse(zlib.gunzipSync(Buffer.from(heatB64, 'base64')).toString('utf8')); for (const n of pageNames) must(back.html[n.replace(/\.html$/, '')].split(back.mark).join(back.css) === read(pageDir, n), `${n} does not come back out of the dashboard as it went in`); }
for (const o of ORDER) must(LVS.pages.list.find(p => p.slug === o.lp).html.split(CSS_MARK).join(lpCss) === read(args.campaigns, 'pages', o.lp + '.html'), `${o.lp} does not come back out as it went in`);

fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
fs.writeFileSync(args.out, html);
const mb = n => (n / 1048576).toFixed(1) + ' MB';
console.log(JSON.stringify({
  out: args.out, size: mb(Buffer.byteLength(html)), base: mb(fs.statSync(args.base).size), scripts: { parsed, data },
  agentDesk: lvpNew.bundles.map(b => `${b.id} (${b.paid ? 'paid' : b.content.pages.length + ' pages'})`),
  paid: { campaigns: PAID.length, monthly: PAID.reduce((n, b) => n + b.paid.plan.budget, 0), adGroups: PAID.reduce((n, b) => n + b.paid.stats.adGroups, 0), keywords: PAID.reduce((n, b) => n + b.paid.stats.keywords, 0), metaAds: PAID.reduce((n, b) => n + b.paid.ads.filter(a => a.channel === 'meta').length, 0), localServicesProfiles: PAID.reduce((n, b) => n + b.paid.ads.filter(a => a.channel !== 'meta').length, 0), landingPages: LP.map(p => `${p.slug} ${p.score}`), confirm: CONFIRM.length },
  content: { cityPages: LVC.built.length, citySourceLinks: LVC.cityPages.sources, heatingPages: HEAT_SUMMARY.pages, leftToLivePages: HEAT_SUMMARY.live, demand: HEAT_SUMMARY.demand, sourceLinks: CHECKS.links.toSources, worksMarkedBuilt: marked, heatBlock: mb(heatB64.length) },
}, null, 1));
