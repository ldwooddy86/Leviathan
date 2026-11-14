/* The Campaign Desk model against the running Campaign Desk. Needs Playwright with Chromium; without them this file
   says so and passes.

   Two things are tested.

   1. Parity, on a build this toolkit claims to mirror (lib/desk.mjs: CHECKED). Ten plans go into the real desk through
      its Load button; the desk's markets, angles, mix, forecast by platform, flight and floors are compared with the
      port's, and the desk's own exported files with the port's files in mirror mode, byte for byte. The console's atlas
      is Build 4, which is not a checked build, so this part runs only when ATLAS_HTML names one (Build 6). Nothing of
      that file is printed but counts.

   2. Honesty, on any build. The whole command line runs against a dashboard with a browser: connect, plan, draft,
      build. Build screens the copy with the running dashboard's own rules and loads the plan through the desk's own
      Load button. Where the desk agrees with the port the report says so; where it does not, the report must say that
      instead, and never claim a match. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, atlasFile, sandbox, run, gitState, BRAND } from '../_t.mjs';
import * as live from '../../../dashboard-link/lib/live.mjs';
import { library, model as readModel, brandRaw, identity } from '../../../dashboard-link/lib/read.mjs';
import { brandFor } from '../../../dashboard-link/lib/connect.mjs';
import * as desk from '../../lib/desk.mjs';

const av = await live.available();
if (!av.ok) { console.log('skip  no browser here, so the running Campaign Desk was not tested: ' + av.why); process.exit(0); }
const before = gitState(), J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const targets = [{ label: 'the console\'s atlas', file: atlasFile(), own: true }];
if (process.env.ATLAS_HTML) targets.push({ label: 'ATLAS_HTML', file: path.resolve(process.env.ATLAS_HTML), own: false });

/* ---------- 1. parity on a checked build ---------- */
for (const { label, file } of targets) {
  const text = fs.readFileSync(file, 'utf8'), id = identity(text, file), lib = library(text), mdl = readModel(text, lib), B = brandRaw(text), brand = B ? brandFor(B, 'dfw') : null;
  const pack = { lines: lib.lines, angles: lib.angles, negatives: lib.negatives, platforms: lib.platforms, defaults: lib.defaults, desk: lib.desk, service: lib.service, rules: lib.rules }, port = desk.ported(pack);
  if (!port.same) { ok(port.same === false && /Build 6/.test(port.why), `${label} (Build ${id.build}): not a build the model was checked against, and the model says so; parity is not claimed for it`); continue; }
  const collin = mdl.counties.find(c => c.name === 'Collin').fips, tarrant = mdl.counties.find(c => c.name === 'Tarrant').fips, v = lib.defaults.v, full = part => Object.fromEntries(lib.platforms.order.map(k => [k, part[k] || 0]));
  const heat = lib.lines.heat.angles.slice(0, 3), top6 = mdl.zips.slice().sort((a, b) => b.effb - a.effb).slice(0, 6).map(z => z.zip);
  const plans = {
    default: { line: 'replace', start: '2026-11-23' },
    heatPicks: { line: 'heat', budget: 12000, start: '2026-11-23', weeks: 8, scope: 'picks', picks: top6, bids: { [top6[0]]: 20, [top6[1]]: 10, [top6[5]]: -15 }, mix: full({ google: 50, lsa: 30, microsoft: 5, meta: 15 }), angles: heat },
    partialMix: { v, line: 'heat', budget: 8000, start: '2026-12-07', weeks: 6, n: 10, mix: { google: 70, lsa: 30 } },
    maintCounty: { line: 'maint', budget: 6000, start: '2026-10-05', weeks: 20, scope: 'county', counties: [collin, tarrant], n: 12, minhh: 5000 },
    repairSpanish: { line: 'repair', budget: 20000, start: '2027-06-07', weeks: 13, spanTh: 10, alpha: 2, n: 18 },
    b2b: { line: 'b2b', budget: 4000, start: '2027-03-01', weeks: 6, n: 8 },
    recruit: { line: 'recruit', budget: 3000, start: '2027-01-11', weeks: 4, n: 5 },
    iaqAsm: { line: 'iaq', budget: 9000, start: '2027-02-01', weeks: 10, n: 22, asm: { google: { cost: 7.5, cvr: 5 }, meta: { cost: 18, ctr: 0.9 } }, bookRate: 40, jobVal: 1500 },
    heatVersioned: { v, line: 'heat', budget: 12000, start: '2026-11-23', weeks: 8, scope: 'picks', picks: top6.slice(0, 3), angles: heat.slice(0, 2) },
    oldStart: { line: 'repair', start: '2026-10-01', n: 6 },
    blendMin: { line: 'blend', budget: 2500, start: '2026-12-07', weeks: 52, n: 40, minhh: 0, alpha: 0.5 },
  };
  const seasons = await live.withDashboard(file, async s => { const snap = await live.snapshot(s); return snap.slm ? Object.fromEntries(snap.slm.lines.map(l => [l.id, l.months])) : null; });
  const ctx = { pack, model: mdl, brand, seasons, mirror: true }, N = x => Math.round(x).toLocaleString('en-US');
  let n = 0; const bad = [];
  const diff = (what, a, b) => { n++; if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(what); };
  const lineOf = (mine, theirs) => { const a = mine.split('\n'), b = (theirs || '').split('\n'); let i = 0; while (i < a.length && a[i] === b[i]) i++; return `line ${i + 1} of ${a.length} and ${b.length}`; };
  for (const [name, plan] of Object.entries(plans)) {
    const R = desk.read(plan, ctx), pf = live.scratch('campaign-desk-plan.json', JSON.stringify(plan));
    const d = await live.withDashboard(file, s => live.desk(s, pf, { files: true }));
    if (!d.accepted) { bad.push(name + ': the desk refused the plan'); continue; }
    diff(name + ' markets', R.markets.map(m => m.z.zip), d.plan.zips); diff(name + ' angles', R.P.angles, d.plan.angles); diff(name + ' mix', R.P.mix, d.plan.mix); diff(name + ' start', R.P.start, d.plan.start);
    const k = Object.fromEntries(Object.entries(d.kpis).map(([a, b]) => [a, b.value]));
    diff(name + ' clicks', N(R.totals.clicks), k['Clicks a month']); diff(name + ' leads', N(R.totals.leads), k['Leads a month']); diff(name + ' booked', N(R.totals.booked), k['Booked jobs']); diff(name + ' media', '$' + N(R.totals.spend), k['Monthly media']); diff(name + ' market count', N(R.markets.length), k['Markets bought']);
    diff(name + ' cost a booked job', '$' + N(R.totals.spend / Math.max(1e-9, R.totals.booked)), k['Cost per booked job']);
    diff(name + ' by platform', pack.platforms.order.filter(p => R.forecast[p].spend > 0).map(p => [pack.platforms.labels[p], Math.round(R.forecast[p].spend), Math.round(R.forecast[p].clicks), Math.round(R.forecast[p].leads), +R.forecast[p].booked.toFixed(1)]), d.platforms.map(x => [x.platform, x.spend, x.clicks, x.leads, x.booked]));
    diff(name + ' flight', R.flight.map(x => [x.days, +x.idx.toFixed(0), Math.round(x.spend)]), d.flight.map(x => [x.days, x.index, x.media]));
    diff(name + ' floors', R.floors.length, d.warnings.length);
    const F = Object.fromEntries(d.files.map(f => [f.name.replace(/_.*$/, '').replace(/\.csv$/, ''), f.text])), camps = desk.searchDraft(R, ctx);
    for (const [plat, key] of [['google', 'google-ads-editor'], ['microsoft', 'microsoft-ads']]) { n++; const mine = desk.toCSV(desk.GH, desk.searchRows(camps, plat, R, ctx)); if (mine !== F[key]) bad.push(`${name} ${plat} file, ${lineOf(mine, F[key])}`); }
    for (const [plat, key] of [['meta', 'meta-ads-import'], ['dg', 'demand-gen-build-sheet'], ['nextdoor', 'nextdoor-build-sheet'], ['yelp', 'yelp-build-sheet']]) { n++; const rows = desk.socialRows(desk.socialDraft(R, plat, ctx), plat, R, ctx), mine = desk.toCSV(rows.length ? Object.keys(rows[0]) : ['Campaign Name'], rows); if (mine !== F[key]) bad.push(`${name} ${plat} sheet, ${lineOf(mine, F[key])}`); }
  }
  ok(bad.length === 0, `${label} (Build ${id.build}): ${Object.keys(plans).length} plans through the running desk, ${n} comparisons of markets, angles, mix, forecast, flight and exported files: the model says what the desk says`, bad.slice(0, 8));
}

/* ---------- 2. the command line against a running dashboard ---------- */
for (const { label, file, own } of targets) {
  const { home, env } = sandbox({ live: true }), CLI = 'paid-ads/cli.mjs', at = (...p) => path.join(home, ...p), go = (args, o) => run(CLI, args, env, o);
  const T = s => `${label}: ${s}`;
  let r = go(['connect', file], { json: true });
  const conn = r.json, hasHeat = conn && conn.modules.some(m => m.key === 'heat');
  ok(r.code === 0 && conn.live.ok && fs.existsSync(at('dashboard', 'live.json')), T('connect opens the dashboard and keeps its computed model'), r.err.split('\n')[0]);
  if (own) fs.writeFileSync(at('content-strategist', 'brand.json'), JSON.stringify(BRAND));   /* the console's atlas has a placeholder brand */
  const where = go(['where'], { json: true }).json, checked = where.deskModel.same;
  ok(where.dashboard.runsHere === true && where.brand.license === 'set' && typeof checked === 'boolean', T(`where: the dashboard runs here; its Campaign Desk is ${checked ? 'a build the model was checked against' : 'not a build the model was checked against'}`));
  r = go(['lines', 'heat']); ok(r.code === 0 && /As the running dashboard computes it: [\d,]+ jobs a year in the metro/.test(r.out) && /Cost a lead by platform:/.test(r.out) && /Season \(100 is an average month\): Jan \d+/.test(r.out), T('lines: the computed economics and season are read from the running dashboard'));
  r = go(['markets', '--line', 'heat', '--n', '6'], { json: true });
  ok(r.code === 0 && /campaign priority for/.test(r.json.rankedBy) && r.json.markets.length === 6 && r.json.markets[0].priority >= r.json.markets[5].priority && typeof r.json.markets[0].quiet === 'boolean' && Object.keys(r.json.bids).length === 6, T('markets by service line: priority, quiet auctions and that line\'s bids come from the computed model'));
  const planArgs = hasHeat ? ['plan', '--line', 'heat', '--budget', '12000', '--start', '2026-11-23', '--weeks', '10', '--from-heat'] : ['plan', '--line', 'heat', '--budget', '9000', '--start', '2026-11-23', '--weeks', '10', '--by-line', 'heat', '--n', '6'];
  r = go(planArgs.concat(['--out', at('plan.json')]), { json: true });
  const planText = go(planArgs.concat(['--out', at('plan.json')])).out;
  ok(r.code === 0 && r.json.markets.length > 0 && r.json.plan.scope === 'picks' && r.json.plan.bids && Object.keys(r.json.plan.bids).length === r.json.plan.picks.length && (hasHeat ? /the Heat Desk's plan for/.test(r.json.from) && /Where the two differ on heating, quote the Heat Desk/.test(r.json.from) : /by campaign priority for/.test(r.json.from)) && /Flight \(paced by the service line model, as the running dashboard computes it\)/.test(planText) && (J(at('plan.json')).plan || J(at('plan.json'))).picks.length === r.json.markets.length && (hasHeat ? /The Heat Desk's own reading of these \d+ ZIPs/.test(planText) && J(at('plan.json')).heat.zips > 0 && r.json.heat.month : true), T(hasHeat ? 'plan --from-heat: the Heat Desk\'s own markets, bids and platform shares, paced by the service line model' : 'plan --by-line: markets and bids from the service line model, the flight paced by it'), r.err.split('\n')[0]);
  if (!hasHeat) { r = go(['plan', '--line', 'heat', '--from-heat']); ok(r.code === 2 && /This dashboard has no Heat Desk/.test(r.err), T('plan --from-heat on a build without a Heat Desk says so')); }
  r = go(['draft', at('plan.json'), '--out', at('campaign.json')]); ok(r.code === 0 && fs.existsSync(at('campaign.json')), T('draft'), r.err.split('\n')[0]);
  /* a draft cannot be built: the library copy stands in for rewritten copy here, with its note taken off */
  { const c = J(at('campaign.json')); ok(go(['build', at('campaign.json'), '--out', at('built')]).code === 1 && !fs.existsSync(at('built')), T('a draft is not built, with or without a browser')); delete c.draft; fs.writeFileSync(at('campaign.json'), JSON.stringify(c, null, 1)); }
  r = go(['build', at('campaign.json'), '--out', at('built')], { json: true });
  const b = r.json, dash = b && b.dashboard;
  ok(r.code === 0 && b.ok && dash.ran && dash.screen && !dash.screen.error && dash.screen.sets > 0 && dash.screen.agrees === true && !b.findings.some(f => f.rule.startsWith('dashboard:') && f.rule !== 'dashboard:forecast'), T(`build: ${dash && dash.screen ? dash.screen.sets : 0} ad sets screened by the running dashboard's own rules, which flag nothing the toolkit's port did not`), r.err.split('\n')[0] || (b && b.findings.filter(f => f.rule.startsWith('dashboard:')).map(f => f.rule + ' ' + f.excerpt).slice(0, 3)));
  ok(dash.desk && !dash.desk.error && dash.desk.accepted && dash.desk.verdict === 'Plan loaded' && dash.desk.markets === J(at('built', 'campaign-desk-plan.json')).picks.length, T('build: the plan file went in through the desk\'s own Load button and the desk holds its markets'), dash.desk && (dash.desk.error || dash.desk.verdict));
  const agrees = dash.desk.agrees, forecastWarn = b.findings.some(f => f.rule === 'dashboard:forecast' && f.severity === 'warn'), buildWarn = b.findings.find(f => f.rule === 'desk-build');
  const text = go(['build', at('campaign.json'), '--out', at('built')]).out, readme = fs.readFileSync(at('built', 'README.md'), 'utf8'), rep = J(at('built', 'report.json'));
  if (agrees) ok(!forecastWarn && (checked ? !buildWarn : buildWarn && buildWarn.severity === 'note' && /reads this plan the same/.test(buildWarn.message)) && /its forecast matches this one figure for figure/.test(text), T('build: the desk\'s forecast matches the model\'s, and the report says so' + (checked ? '' : ' while noting the build was never checked')));
  else ok(forecastWarn && !/matches this one figure for figure/.test(text) && /Its forecast differs: see the warning/.test(text) && /Quote the dashboard's figures/.test(b.findings.find(f => f.rule === 'dashboard:forecast').message) && (checked || (buildWarn && buildWarn.severity === 'warn')), T('build: the desk reads the plan differently from the model, and the report says that instead of claiming a match'));
  ok(checked ? agrees : true, T(checked ? 'on a build the model was checked against, the two agree' : 'on a build it was not checked against, either outcome is reported truthfully'));
  ok(rep.dashboard.ran === true && rep.dashboard.desk.accepted === true && /This was tried against the running dashboard when the folder was built: the desk took the plan and showed/.test(readme) && fs.readdirSync(at('built')).some(n => /^google-ads-editor_/.test(n)), T('the report and the README record that the plan was tried on the running dashboard, with the desk\'s own figures'));
  r = go(['check', at('built', 'campaign-desk-plan.json')]); ok(r.code === 0 && /ACCEPTED by the Campaign Desk \("Plan loaded"\)/.test(r.out), T('check: the built plan file, handed to the desk again on its own, is taken'));
  r = go(['heat']); ok(hasHeat ? r.code === 0 && /Heat Desk plan for \w+: \$[\d,]+ of \$[\d,]+ placed in \d+ ZIPs/.test(r.out) && /Campaigns \(all paused\)/.test(r.out) : r.code === 0 && /no Heat Desk/.test(r.out), T(hasHeat ? 'heat: the Heat Desk\'s plan, every campaign paused' : 'heat: no Heat Desk in this build'));
}
ok(before !== null && gitState() === before, 'the repository is as it was');
done();
