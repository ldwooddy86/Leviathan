#!/usr/bin/env node
/* The paid ads specialist's toolkit. Node 22, no packages.

   node paid-ads/cli.mjs <command>

   Where things stand
     where                              the dashboard connected, the brand on file, where client files go
     connect <atlas.html> [--id dfw]    connect a dashboard (the same connection the content strategist uses)
     dashboard                          what is connected, its doors, and what each agent can do with it

   What the dashboard knows
     lines [id]                         the service lines: what a job is worth, what a lead costs by platform, season, fit
     markets [--line id] [--n 30] [--county names] [--city name] [--zips a,b] [--within minutes]
                                        ZIP markets ranked as the dashboard ranks them, with minutes from the shop, tier,
                                        bid and audience levers; --within holds them to a drive time
     keywords <angle | --line id> [--city name] [--find text]
                                        the keyword set by ad group: match types, intent, negatives
     rules                              the advertising rules that bind the buy, the license format, the consent text
     competitors [--find name] [--n 20] who else is in the market and what they offer
     heat [--budget n] [--month 1..12] [--lsa]
                                        the Heat Desk's plan and its reading of the week (runs the dashboard)

   The channel book
     channels [id] [--find text] [--for emergency|considered|maintenance|b2b|recruiting]
                                        every paid channel in the United States: use, buying, limits, rules, and whether
                                        a home service contractor can buy it at all

   The work
     plan --line id --budget n [--start YYYY-MM-DD] [--weeks n] [--n 30 | --zips a,b | --county names]
          [--within minutes] [--mix google=50,lsa=30,...] [--angles a,b] [--job-value n] [--book-rate pct]
          [--by-line id] [--from-heat [--month 1..12] [--lsa]] [--out file]
                                        a media plan on the Campaign Desk's own model: markets, split, forecast, flight.
                                        --within holds the markets to a drive time from the shop. --from-heat takes the
                                        Heat Desk's markets and bids for the month the flight mostly runs in.
     draft <plan.json> [--out campaign.json] [--force]
                                        a campaign file started from the dashboard's library, for you to rewrite. It
                                        will not write over a campaign file someone has already rewritten.
     lint <campaign.json> [--allow rule,rule]
                                        the gate, writing nothing
     build <campaign.json> [--allow rule,rule] [--out folder] [--no-live] [--force]
                                        the gate; then the bulk files (every campaign and ad paused), the plan file the
                                        Campaign Desk loads and the report. With a browser here, the copy is also screened
                                        by the running dashboard and the plan is loaded through the desk's own Load button.
                                        A draft cannot be built. --allow sets a rule aside by name where that is possible
                                        (a platform limit, a rule of law or a contradicted claim never is), and is recorded.
     check <file>                       hand a plan file to the running dashboard and report what it made of it
     read <file>                        a file saved from the dashboard: the desk's plan, the competitor ledger, account results

   Common options: --json
   Client files (the brand, the ZIP model, plans, built campaigns) live outside the repository, under ~/.leviathan;
   PA_LOCAL and PA_OUT move the paid ads folders. Nothing here reaches an ad account: every file is for a person to import. */
import fs from 'node:fs';
import path from 'node:path';
import { status, requireConnection, loadPaidPack, listPaidPacks, loadModel, loadLive, loadCompetitors, loadBrand, atlasFile, NotConnected } from '../dashboard-link/lib/connect.mjs';
import { runConnect, runStatus, runCheck, runHeat, runRead } from '../dashboard-link/cli.mjs';
import * as live from '../dashboard-link/lib/live.mjs';
import { note as handoffNote } from '../dashboard-link/lib/handoff.mjs';
import { PA_LOCAL, CS_LOCAL, outside, inRepo, rel, readJson } from '../dashboard-link/lib/paths.mjs';
import { drift } from '../dashboard-link/lib/satchel.mjs';
import * as desk from './lib/desk.mjs';
import * as kw from './lib/keywords.mjs';
import * as camp from './lib/campaign.mjs';
import { text as adText } from './lib/copy.mjs';
import { CHANNELS, LAW, byId, READ as BOOK_READ } from './channels/book.mjs';

const OUT = path.resolve(process.env.PA_OUT || path.join(PA_LOCAL, 'out')), DRAFTS = path.join(PA_LOCAL, 'drafts');
for (const [name, p] of [['PA_LOCAL', PA_LOCAL], ['PA_OUT', OUT]]) if (inRepo(p)) console.error(`Warning: ${name} (${p}) is inside the repository. The console's withheld name scan reads every file there; keep client files outside it.`);

/* ---------- arguments ---------- */
const BOOL = new Set(['json', 'help', 'no-live', 'no-copy', 'lsa', 'from-heat', 'force']);
function args(argv) { const o = { _: [] }; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (BOOL.has(k) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) o[k] = true; else o[k] = argv[++i]; } else o._.push(a); } return o; }
const A = args(process.argv.slice(2)), cmd = A._.shift() || 'help';
const opt = k => (A[k] && A[k] !== true ? String(A[k]) : '');
const list = v => (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : []);
const out = (v, t) => console.log(A.json ? JSON.stringify(v, null, 1) : (t != null ? t : JSON.stringify(v, null, 1)));
const die = (msg, code = 2) => { console.error(msg); process.exit(code); };
/* the options each command takes: one it does not know is an error, never something to ignore without a word */
const OPTS = { help: [], where: [], connect: ['id', 'no-live', 'no-copy'], dashboard: [], check: ['files'], read: [], heat: ['budget', 'month', 'lsa'], lines: ['pack'], markets: ['line', 'n', 'county', 'city', 'zips', 'within'], keywords: ['line', 'city', 'find', 'pack'], rules: ['pack'], competitors: ['find', 'n'], channels: ['find', 'for'],
  plan: ['line', 'budget', 'start', 'weeks', 'n', 'zips', 'county', 'mix', 'angles', 'by-line', 'from-heat', 'out', 'within', 'month', 'lsa', 'job-value', 'book-rate'], draft: ['out', 'force'], lint: ['allow'], build: ['allow', 'out', 'no-live', 'force'] };
if (OPTS[cmd]) { const bad = Object.keys(A).filter(k => k !== '_' && k !== 'json' && k !== 'help' && !OPTS[cmd].includes(k)); if (bad.length) die(`${cmd} does not take ${bad.map(k => '--' + k).join(', ')}.${OPTS[cmd].length ? ' It takes: ' + OPTS[cmd].map(k => '--' + k).join(', ') + '.' : ' It takes no options.'}`); }
/* an option that must be a number in a range, or a real date: a bad value stops the command */
function numOpt(k, { min = -Infinity, max = Infinity, int = false, what = '' } = {}) {
  if (A[k] == null) return null; const v = A[k] === true ? NaN : Number(A[k]);
  if (!Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) die(`--${k} takes ${what || (int ? 'a whole number' : 'a number')}${min > -Infinity ? ' from ' + min : ''}${max < Infinity ? ' to ' + max : ''}; "${A[k] === true ? '' : A[k]}" is not one.`);
  return v;
}
function dayOpt(k) { if (A[k] == null) return null; const s = opt(k), d = new Date(s + 'T12:00:00Z'); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(+d) || d.toISOString().slice(0, 10) !== s) die(`--${k} takes a date as YYYY-MM-DD; "${s}" is not one.`); return s; }
const $ = n => '$' + Math.round(n || 0).toLocaleString('en-US');
const pad = (s, n) => String(s == null ? '' : s).padEnd(n), lpad = (s, n) => String(s == null ? '' : s).padStart(n);

/* ---------- what is on file ---------- */
/* the pack alone: enough for the library commands on a machine with no dashboard connected */
function packOnly() {
  const s = status(); if (s.connected) return loadPaidPack(s.connection.id);
  const ids = listPaidPacks(), id = opt('pack') || (ids.length === 1 ? ids[0] : '');
  if (!id) die(ids.length ? `Several paid packs are on file (${ids.join(', ')}). Name one: --pack <id>` : 'No paid pack is on file. Connect a dashboard first:\n  node paid-ads/cli.mjs connect <atlas.html>');
  return loadPaidPack(id);
}
/* everything: the pack, this client's model and brand, what the running dashboard computed */
function context() {
  const s = requireConnection(), pack = loadPaidPack(s.connection.id), model = loadModel();
  if (!model || !Array.isArray(model.zips)) throw new NotConnected('The ZIP model of the connected dashboard is missing. Connect the dashboard again:\n  node paid-ads/cli.mjs connect <atlas.html>');
  const snap = loadLive(), comp = loadCompetitors(), brand = loadBrand();
  return { connection: s.connection, problems: s.problems, pack, model, brand, snapshot: snap, seasons: snap && snap.slm ? Object.fromEntries(snap.slm.lines.map(l => [l.id, l.months])) : null, competitors: comp ? comp.companies.filter(c => !c.self).map(c => c.name.replace(/\s*(,? (inc|llc|co|corp)\.?|& sons?)$/i, '')) : [], roster: comp, site: siteOf(brand),
    /* LEVIATHAN_TODAY (YYYY-MM-DD) pins "today" for the coming Monday and for the start date check, so a test reads the same on any day */
    now: /^\d{4}-\d{2}-\d{2}$/.test(process.env.LEVIATHAN_TODAY || '') ? new Date(process.env.LEVIATHAN_TODAY + 'T12:00:00') : undefined };
}
/* The live pages of the client's site, when the content strategist has read its sitemap on this machine (its `sitemap`
   command keeps the inventory beside the brand file). The gate checks every landing page against it. */
function siteOf(brand) {
  if (!brand || !brand.url) return null;
  const f = path.join(CS_LOCAL, 'sitemap', camp.hostOf(brand.url) + '.json'); if (!fs.existsSync(f)) return null;
  try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return { file: f, ageHours: Math.max(0, Math.round((Date.now() - Date.parse(j.fetched)) / 36e5)), paths: new Set((j.pages || []).map(p => camp.normPath(p.path || ''))) }; } catch { return null; }
}
const lineOfAngle = (pack, id) => Object.entries(pack.lines).filter(([, v]) => v.angles.includes(id)).map(([k]) => k);

/* ---------- commands ---------- */
const C = {
  help() { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\* ?/, '')); },

  where() {
    const s = status(), brand = loadBrand(), c = s.connection;
    const pk = c && listPaidPacks().includes(c.id) ? loadPaidPack(c.id) : null;
    const res = { local: PA_LOCAL, drafts: DRAFTS, out: OUT, connected: s.connected, dashboard: c ? { atlas: c.identity.atlas, build: c.identity.build, sha256: c.identity.sha256.slice(0, 16), connectedAt: c.connectedAt, runsHere: c.live.ok } : null, deskModel: pk ? desk.ported(pk) : null, problems: s.problems, brand: brand ? { name: brand.name, license: brand.license ? 'set' : 'MISSING', phone: brand.phone ? 'set' : 'MISSING', site: brand.url || 'MISSING', hours: brand.hours || 'not on file', promotion: (brand.offer || {}).promotion || 'none on file', reviewsAsOf: ((brand.proof || {}).reviews || {}).asOf || 'none on file' } : null, packs: listPaidPacks() };
    out(res, [
      c ? `Dashboard: ${c.identity.atlas} · Build ${c.identity.build}, connected ${String(c.connectedAt).slice(0, 16).replace('T', ' ')} UTC. ${c.live.ok ? 'It runs on this machine, so plans and copy can be checked against it.' : 'It cannot be run on this machine (' + c.live.why + '), so checks against it are skipped.'}` : `Dashboard: none connected. Ask for the dashboard file and run: node paid-ads/cli.mjs connect <atlas.html>${res.packs.length ? `\n  The library pack "${res.packs.join(', ')}" is on file, so channels, keywords, lines and rules still answer. Markets, plans and builds need the connection.` : ''}`,
      ...s.problems.map(p => 'PROBLEM  ' + p),
      ...(res.deskModel && !res.deskModel.same ? [`Forecasts: ${res.deskModel.why}. Plans still load there, but quote the figures the desk itself shows: build loads each plan through the running desk and says whether the two agree.`] : []),
      brand ? `Brand: ${brand.name} · license ${res.brand.license} · phone ${res.brand.phone} · ${res.brand.site} · hours "${res.brand.hours}" · promotion on file: ${res.brand.promotion} · reviews as of ${res.brand.reviewsAsOf}   (${brand._file})` : 'Brand: none on file. It comes with the dashboard connection.',
      `Client files: ${PA_LOCAL}   (outside the repository; plans and campaign files in ${DRAFTS}, built campaigns in ${OUT})`,
    ].join('\n'));
  },

  async connect() { const f = A._[0] || die('connect <atlas.html> [--id dfw] [--no-live] [--no-copy]'); const r = await runConnect(f, { id: opt('id') || undefined, live: A['no-live'] ? false : 'auto', copy: !A['no-copy'] }); out(r.value, r.text); },
  dashboard() { const r = runStatus(); out(r.value, r.text); if (r.value.connected && r.value.problems.length) process.exitCode = 1; },
  async check() { const f = A._[0] || die('check <campaign-desk-plan.json> [--files folder]'); const r = await runCheck(f, { filesTo: opt('files') }); out(r.value, r.text); if (!r.ok) process.exitCode = 1; },
  read() { const f = A._[0] || die('read <file saved from the dashboard>'); const r = runRead(f); out(r.value, r.text); },
  async heat() { const P = {}; if (opt('budget')) P.budget = +opt('budget'); if (opt('month')) P.month = +opt('month') - 1; if (A.lsa) P.lsaLive = true; const r = await runHeat(P); out(r.value, r.text); },

  lines() {
    const pack = packOnly(), sv = pack.service; if (!sv) die('This dashboard build carries no service line model.');
    const snap = status().connected ? loadLive() : null, L = snap && snap.slm ? Object.fromEntries(snap.slm.lines.map(l => [l.id, l])) : {}, m = new Date().getMonth(), mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const id = A._[0];
    if (id) {
      const l = sv.lines.find(x => x.id === id) || die(`"${id}" is not a service line. Lines: ${sv.lines.map(x => x.id).join(', ')}`), E = l.economics || {}, X = L[id], dp = sv.dayparts[l.dayparts];
      const res = { line: l, computed: X || null, dayparts: dp || null, blocks: sv.blocks };
      out(res, [
        `${l.name}  (${l.id}; Campaign Desk line "${l.desk}"; season grade ${l.g})`, `  Intent: ${l.intent}`,
        `  Stated economics (grade D unless the dashboard says otherwise): ticket ${E.ticket ? $(E.ticket) : 'the ZIP\'s replacement ticket'}, gross margin ${E.margin}%, click to lead ${E.cvr}%, lead to booked ${E.close}%, ${E.pipe}% of jobs become a replacement sale within a year, click cost ${E.cpcMult}x the account average, Local Services ${E.lsaCpl ? $(E.lsaCpl) + ' a lead' : 'not offered'}, Meta ${$(E.metaCpl)} a lead`,
        X ? `  As the running dashboard computes it: ${Math.round(X.totals.jobs).toLocaleString('en-US')} jobs a year in the metro, ${$(X.unit.ticket)} a job, ${$(X.unit.gpPerJob)} gross profit a job with the pipeline, blended cost a lead ${$(X.unit.cpl)}, cost a booked job ${$(X.unit.cac)}, break even cost a lead ${$(X.unit.breakEvenCpl)}, gross profit ${X.unit.gpRoas}x the ad cost` : '  Computed economics: not read (no browser was available when the dashboard was connected).',
        X ? `  Cost a lead by platform: ${Object.entries(X.cplByPlatform).filter(([, v]) => v != null).map(([k, v]) => `${pack.platforms.labels[k] || k} ${$(v)}`).join(', ')}` : '',
        `  Platform fit (0 to 3): ${Object.entries(l.fit).map(([k, v]) => `${pack.platforms.labels[k] || k} ${v}`).join(', ')}`,
        X ? `  Season (100 is an average month): ${X.months.map((v, i) => `${mo[i]} ${Math.round(v)}`).join(', ')}` : `  Season: ${l.seasonSrc}`, `  Season source: ${l.seasonSrc}`,
        dp ? `  Bid by hour (${l.dayparts}; ${sv.blocks.join(' | ')}): weekdays ${dp.weekday.join(', ')}; Saturday ${dp.saturday.join(', ')}; Sunday ${dp.sunday.join(', ')}  (grade C: replace with the account's hour of day report)` : '',
        `  Mobile share of searches: ${l.mobile}%. ${l.mobile >= 70 ? 'Ask for the phone call.' : l.mobile >= 55 ? 'Ask for a call or a form.' : 'Ask for a form or a quote request.'}`,
        '  Hooks the dashboard suggests:', ...l.hooks.map(h => '    ' + h), '  Triggers that move its budget:', ...l.triggers.map(h => '    ' + h), `  Negatives beyond the customer list: ${l.negs.join(', ')}`,
      ].filter(Boolean).join('\n'));
      return;
    }
    const rows = sv.lines.map(l => { const E = l.economics || {}, X = L[l.id]; return { id: l.id, name: l.short, desk: l.desk, ticket: X ? X.unit.ticket : E.ticket, close: E.close, cpl: X ? X.unit.cpl : null, breakEven: X ? X.unit.breakEvenCpl : null, gpRoas: X ? X.unit.gpRoas : null, seasonNow: X ? X.months[m] : null, seasonNext: X ? X.months[(m + 1) % 12] : null, fit: l.fit }; });
    out(rows, [`Service lines of the ${pack.atlas}. Economics are the dashboard's stated assumptions (grade D unless it says otherwise); season is an index where 100 is an average month.`, `${pad('id', 11)} ${pad('line', 20)} ${pad('desk', 11)} ${lpad('ticket', 8)} ${lpad('close', 6)} ${lpad('lead', 6)} ${lpad('b/even', 7)} ${lpad('gp x', 5)} ${lpad(mo[m], 5)} ${lpad(mo[(m + 1) % 12], 5)}  best platforms`,
      ...rows.map(r => `${pad(r.id, 11)} ${pad(r.name, 20)} ${pad(r.desk, 11)} ${lpad(r.ticket ? $(r.ticket) : 'ZIP', 8)} ${lpad(r.close + '%', 6)} ${lpad(r.cpl ? $(r.cpl) : 'n/a', 6)} ${lpad(r.breakEven ? $(r.breakEven) : 'n/a', 7)} ${lpad(r.gpRoas ?? 'n/a', 5)} ${lpad(r.seasonNow != null ? Math.round(r.seasonNow) : 'n/a', 5)} ${lpad(r.seasonNext != null ? Math.round(r.seasonNext) : 'n/a', 5)}  ${Object.entries(r.fit).filter(([, v]) => v >= 3).map(([k]) => pack.platforms.labels[k] || k).join(', ') || Object.entries(r.fit).filter(([, v]) => v === 2).map(([k]) => pack.platforms.labels[k] || k).join(', ')}`),
      '', '"lead" is the blended cost a lead at the dashboard\'s platform fit, "b/even" the cost a lead at which the job only pays for its ads, "gp x" gross profit over ad cost. One line in full: lines <id>'].join('\n'));
  },

  markets() {
    const X = context(), { pack, model, snapshot } = X, n = numOpt('n', { min: 1, max: 500, int: true }) || 30, within = numOpt('within', { min: 5, max: 600, what: 'minutes of drive, a number' });
    const line = opt('line'), sl = pack.service && pack.service.lines.find(l => l.id === line), deskLine = pack.lines[line] ? line : sl ? sl.desk : '';
    if (line && !deskLine) die(`"${line}" is neither a service line nor a Campaign Desk line. Service lines: ${(pack.service ? pack.service.lines.map(l => l.id) : []).join(', ')}. Desk lines: ${Object.keys(pack.lines).join(', ')}`);
    let pool = model.zips.slice(); const zl = snapshot && snapshot.slm ? snapshot.slm.zips : null, F = snapshot && snapshot.slm ? snapshot.slm.zipFields : [];
    if (opt('county')) { const want = list(opt('county')).map(s => s.toLowerCase()); pool = pool.filter(z => want.includes(String(z.county).toLowerCase())); if (!pool.length) die(`No market in "${opt('county')}". Counties: ${model.counties.map(c => c.name).join(', ')}`); }
    if (opt('city')) { const c = opt('city').toLowerCase(); pool = pool.filter(z => String(z.city).toLowerCase() === c); if (!pool.length) die(`No ZIP market is in "${opt('city')}".`); }
    if (opt('zips')) { const want = new Set(list(opt('zips'))); pool = pool.filter(z => want.has(z.zip)); }
    const byLine = sl && zl, cell = z => { const c = zl && zl[z.zip] && zl[z.zip].lines[sl ? sl.id : '']; return c ? Object.fromEntries(F.map((k, i) => [k, c[i]])) : null; };
    const shop = X.brand && X.brand.geo && X.brand.geo.lat != null ? X.brand.geo : null, minutes = z => desk.minutesFrom(shop, z);
    if (within != null) { if (!shop) die('The brand file holds no location for the shop, so drive time cannot be reckoned.'); pool = pool.filter(z => minutes(z) <= within); if (!pool.length) die(`No ZIP market is within ${within} minutes of the shop.`); }
    const rows = pool.map(z => { const c = byLine ? cell(z) : null, lev = zl && zl[z.zip] ? zl[z.zip].levers : null; return { zip: z.zip, city: z.city, county: z.county, households: Math.round(z.occ), minutes: minutes(z), tier: z.tier, quadrant: ['Anchor', 'Whitespace', 'Niche', 'Avoid'][z.quad] || '', efficiency: z.effb, clickCost: z.cpc_rel, bid: c ? c.bid : z.bid, priority: c ? c.priorityPct : null, jobs: c ? c.jobs : null, pressure: c ? c.pressurePct : z.comp_pct, quiet: c ? !!c.quiet : null, spanishShare: z.span_sh, levers: lev ? lev.tags : [], fires: z.fires }; })
      .sort((a, b) => byLine ? (b.priority - a.priority) : (b.efficiency - a.efficiency)).slice(0, n);
    const res = { rankedBy: byLine ? `campaign priority for ${sl.name} (the service line model, module 12: gross profit pool per relative click cost, discounted by competitor paid pressure; grade C)` : 'efficiency percentile (the paid model, module 05: opportunity per relative click cost; grade C)', line: line || null, deskLine: deskLine || null, within: within ?? null, markets: rows, picks: rows.map(r => r.zip), bids: Object.fromEntries(rows.map(r => [r.zip, r.bid])) };
    const spanTh = (pack.defaults || {}).spanTh ?? 20, planOpts = `${within != null ? ' --within ' + within : ''}${opt('county') ? ' --county ' + opt('county') : ''}`;
    out(res, [`${rows.length} ZIP markets${within != null ? ` within ${within} minutes of the shop` : ''} ranked by ${res.rankedBy}.`, `${pad('zip', 6)} ${pad('city', 18)} ${pad('county', 9)} ${lpad('homes', 7)} ${lpad('min', 4)} ${pad('tier', 4)} ${byLine ? lpad('prio', 4) + ' ' : ''}${lpad('bid', 5)} ${lpad('click', 6)} ${lpad('press', 6)} ${lpad('span', 5)} ${pad(byLine ? 'quiet' : 'quadrant', 11)} levers`,
      ...rows.map(r => `${pad(r.zip, 6)} ${pad(r.city, 18)} ${pad(r.county, 9)} ${lpad(r.households.toLocaleString('en-US'), 7)} ${lpad(r.minutes ?? '', 4)} ${pad(r.tier, 4)} ${byLine ? lpad(Math.round(r.priority), 4) + ' ' : ''}${lpad((r.bid >= 0 ? '+' : '') + r.bid + '%', 5)} ${lpad(r.clickCost + 'x', 6)} ${lpad(Math.round(r.pressure), 6)} ${lpad(Math.round(r.spanishShare) + '%', 5)} ${pad(byLine ? (r.quiet ? 'quiet' : '') : r.quadrant, 11)} ${r.levers.join('; ')}`),
      '', `"min" is minutes from the shop by the Heat Desk's rule of thumb (grade C), "tier" the paid model's grade of the market, "bid" the starting adjustment${byLine ? ' for this service line' : ''}, "click" the ZIP's click cost against the metro (grade D), "press" the competition percentile, "span" the share of households that speak Spanish at home: the Campaign Desk adds its Spanish campaign where that is ${spanTh}% or more, whatever a lever's own figure says.`,
      'A lever changes the creative, the language or the call to action. It never takes anyone out of reach: the English campaign runs in every market.',
      within == null ? 'These rankings score the market, not the drive. A job 50 minutes out costs a truck two hours: add --within <minutes>, or for heating take the Heat Desk\'s plan, which weighs the drive (plan --from-heat).' : '',
      byLine ? `For a plan with these markets and bids: plan --line ${deskLine} --by-line ${sl.id} --n ${n}${planOpts}` : `For a plan with these markets: plan --line ${deskLine || '<line>'} --n ${n}${planOpts}`,
      zl ? '' : 'Priority by service line, quiet auctions and audience levers were not read (no browser when the dashboard was connected).'].filter(Boolean).join('\n'));
  },

  keywords() {
    const pack = packOnly(), city = opt('city'), find = opt('find').toLowerCase(), line = opt('line'), id = A._[0];
    let angles = pack.angles;
    if (line) { if (!pack.lines[line]) die(`"${line}" is not a Campaign Desk line. Lines: ${Object.keys(pack.lines).join(', ')}`); angles = pack.lines[line].angles.map(a => pack.angles.find(x => x.id === a)).filter(Boolean); }
    else if (id) { angles = pack.angles.filter(a => a.id === id); if (!angles.length) die(`"${id}" is not a service angle. Angles: ${pack.angles.map(a => a.id).join(', ')}`); }
    if (find) angles = angles.filter(a => JSON.stringify([a.label, a.keywords]).toLowerCase().includes(find));
    const own = desk.kwOwn(angles, { pack }), fill = k => (city ? k.replace(/\{city\}/g, city.toLowerCase()) : k);
    /* a keyword two angles list stays with the one that comes first: say which keyword, and where it went */
    const keeper = t => angles.find(x => { const ox = own[x.id]; return ox.core.includes(t) || ox.city.includes(t) || ox.questions.includes(t); });
    const rows = angles.map(a => { const o = own[a.id], mine = new Set([...o.core, ...o.city, ...o.questions]), held = [...a.keywords.core, ...a.keywords.city, ...a.keywords.questions].filter(t => !mine.has(t)).map(t => ({ keyword: fill(t), keptBy: (keeper(t) || {}).id || '' }));
      const k = t => ({ text: fill(t), intent: kw.intent(t) }); return { id: a.id, label: a.label, lines: lineOfAngle(pack, a.id), page: a.path, when: a.why, localServicesJobTypes: a.lsa, heldByAnEarlierAngle: held,
        adGroups: [{ name: a.short + ' Core', match: ['exact', 'phrase'], keywords: o.core.map(k) }, { name: a.short + ' Questions', match: ['phrase'], keywords: o.questions.map(k) }, { name: a.short + ' Local', match: ['phrase'], keywords: o.city.map(k) }].filter(g => g.keywords.length) }; });
    const P = { line: line || (angles[0] && lineOfAngle(pack, angles[0].id)[0]) || 'replace', angles: angles.map(a => a.id) }, negatives = desk.negs(P, { pack });
    const res = { atlas: pack.atlas, note: pack.note, angles: rows, negatives, intents: kw.INTENT };
    const T = [`${pack.atlas} · keyword library${city ? ' · ' + city : ''}`, pack.note, ''];
    if (!rows.length) T.push('No angle matches.');
    for (const r of rows) {
      T.push(`${r.id}  ${r.label}   page ${r.page}   desk line${r.lines.length === 1 ? '' : 's'}: ${r.lines.join(', ') || 'none'}`, `   runs where: ${r.when}`);
      for (const g of r.adGroups) T.push(`   ${g.name}  [${g.match.join(' and ')}]`, ...g.keywords.map(k => `      ${pad(k.text, 46)} ${k.intent}`));
      if (r.heldByAnEarlierAngle.length) T.push(`   Shared with an earlier angle, which keeps it so that a campaign bids on it from one ad group: ${r.heldByAnEarlierAngle.map(h => `${h.keyword} (${h.keptBy})`).join(', ')}.`);
      if (r.localServicesJobTypes.length) T.push('   Local Services job types: ' + r.localServicesJobTypes.join(', '));
      T.push('');
    }
    T.push(`Campaign negatives for the ${P.line} line (${negatives.length}): ${negatives.join(', ')}`, '', 'Intent, and what to do with it:', ...Object.values(kw.INTENT).map(i => `   ${pad(i.label, 10)} ${i.note} Bid: ${i.bid}.`),
      '', city ? '' : 'Add --city <name> to fill the city into the local terms.', 'Keywords you add yourself (Spanish terms, a symptom the library lacks) are yours, not the dashboard\'s: say so in the hand back.');
    out(res, T.filter(x => x !== '' || true).join('\n'));
  },

  rules() {
    const pack = packOnly(), R = pack.rules, brand = loadBrand(), lic = brand && brand.license ? brand.license : '<number>', d = drift(R.rules);
    const gate = r => ({ block: 'fails the build', warn: 'warning', note: 'note' })[r.severity] || 'note';
    const res = { license: { everyAd: R.rules.some(r => r.id === 'TDLR1'), writeItAs: `Lic ${lic}` }, notice: R.notice, consent: R.consent, rules: R.rules.map(r => ({ id: r.id, gate: gate(r), enforcer: r.enforcer, name: r.name, cite: r.cite, fix: r.fix, appliesTo: r.scope || 'all copy', read: r.read })), controls: R.controls, platforms: Object.fromEntries(Object.entries(pack.platforms.book).map(([k, v]) => [k, v.policy])), unitedStates: LAW, notCovered: d };
    out(res, [`${pack.atlas}: the rules that bind an ad (rule pack of ${R.version || 'no stated date'})`, '',
      `License: in every ad, written "Lic ${lic}". A responsive search ad shows it in every impression only when the description that carries it is pinned to position 1, or when every description carries it.`,
      'House style, which fails a build like any other rule: no hyphen and no dash of any kind in copy; no placeholder or note left in it.', '',
      ...res.rules.map(r => `${pad(r.id, 7)} ${pad(r.gate, 16)} ${r.name}\n         ${r.enforcer}; ${r.cite}${r.read === 'primary' ? '' : ' (the dashboard read this second hand: verify before relying on it)'}\n         fix: ${r.fix}`), '',
      'Keep on file before launch:', ...R.controls.map(c => `   ${c.label}  (for ${c.rules.map(id => { const w = (R.web || []).find(x => x.id === id); return w ? `${id}, a rule for web pages: ${w.name}` : id; }).join('; ')})`), '',
      'Consent text under any form that takes a phone number (word for word):', '   ' + (R.consent || 'none on file'), '',
      'United States rules behind these, read at the source on ' + BOOK_READ + ':', ...LAW.map(l => `   ${l.rule}\n      ${l.cite}`),
      ...(d.length ? ['', 'This toolkit has no test of its own for: ' + d.map(x => `${x.id} (${x.why})`).join('; ') + '. Lean on the running dashboard\'s screen for these (build does when a browser is here).'] : []),
      '', 'A rule that only warns still needs an answer: confirm the claim with the person and record it under "confirmed" in the campaign file, or cut it.'].join('\n'));
  },

  competitors() {
    const X = context(), R = X.roster; if (!R) die('The competitor roster is missing. Connect the dashboard again.');
    const find = opt('find').toLowerCase(), n = +opt('n') || 20;
    let rows = R.companies.filter(c => !c.self); if (find) rows = rows.filter(c => (c.name + ' ' + c.domain).toLowerCase().includes(find));
    rows = rows.slice(0, n).map(c => ({ name: c.name, domain: c.domain, tier: c.tier, cities: c.cities, reviews: c.reviews, rating: c.rating, paidSearchSeen: c.paidKeywords > 0, intel: c.intel }));
    out({ asOf: R.asOf, companies: rows }, [`${R.companies.filter(c => !c.self).length} competitors on the dashboard's roster, as of ${R.asOf || 'an unstated date'}. Offers and financing are what each company's website said then: check before you answer one in an ad.`, '',
      ...rows.map(c => `${c.name}  (${c.domain || 'no site'}; ${c.cities.join(', ')}; ${c.reviews.toLocaleString('en-US')} reviews${c.rating ? ' at ' + c.rating : ''}${c.paidSearchSeen ? '; paid search seen' : ''})${c.intel ? `\n   says: ${c.intel.tagline || 'no tagline'}\n   offers: ${c.intel.promos || 'none seen'}\n   financing: ${c.intel.financing || 'none seen'}\n   plan: ${c.intel.membership || 'none seen'}` : ''}`),
      '', 'Never name a competitor in ad copy. Their offers tell you what the market already hears, so yours can say something else.'].join('\n'));
  },

  channels() {
    const id = A._[0], find = opt('find').toLowerCase(), kind = opt('for');
    if (id) {
      const c = byId(id) || die(`"${id}" is not a channel in the book. Channels: ${CHANNELS.map(x => x.id).join(', ')}`);
      out(c, [`${c.name}  (${c.id}; ${c.group}${c.desk ? `; Campaign Desk platform "${c.desk}"` : '; not planned by the Campaign Desk'})`, c.status === 'closed' ? 'CLOSED to this kind of business.' : '', `  For: ${c.for}`, c.buy ? `  Bought: ${c.buy}` : '', c.geo ? `  Targets: ${c.geo}` : '', c.floor ? `  Entry: ${c.floor}` : '',
        c.formats.length ? '  Formats:' : '', ...c.formats.flatMap(f => [`    ${f.name}  (format "${f.id}")${f.seconds ? ', seconds: ' + f.seconds.join(', ') : ''}`, ...Object.entries(f.fields).map(([k, s]) => `      ${pad(k, 14)} ${pad(s.label, 20)} ${s.max ? 'limit ' + s.max : 'no stated limit'}${s.rec ? ', about ' + s.rec + ' show' : ''}${s.count ? `, ${s.count[0]} to ${s.count[1]} of them` : ''}  (grade ${s.grade})`), ...(f.headers ? ['      headers: ' + f.headers.join(', ')] : []), ...(f.cta ? ['      buttons: ' + f.cta.join(', ')] : []), ...(f.notes || []).map(x => '      ' + x)]),
        c.cta ? `  Buttons worth using: ${c.cta.join(', ')}${c.ctaFree ? ' (free text)' : ''}` : '', ...(c.rules.length ? ['  Rules:', ...c.rules.map(r => '    ' + r)] : []), c.measure ? `  Measure: ${c.measure}` : '',
        `  Fit (0 to 3, judgment): ${Object.entries(c.fits).map(([k, v]) => `${k} ${v}`).join(', ')}`, c.read.length ? `  Read on ${BOOK_READ}:` : '  Nothing here was read at a source: treat every figure as memory.', ...c.read.map(r => `    ${r.what}: ${r.url}`)].filter(Boolean).join('\n'));
      return;
    }
    let rows = CHANNELS; if (find) rows = rows.filter(c => JSON.stringify(c).toLowerCase().includes(find));
    if (kind) { if (!(kind in CHANNELS[0].fits)) die(`--for takes: ${Object.keys(CHANNELS[0].fits).join(', ')}`); rows = rows.filter(c => c.fits[kind] >= 2).sort((a, b) => b.fits[kind] - a.fits[kind]); }
    const groups = [...new Set(rows.map(c => c.group))], row = c => `  ${pad(c.id, 17)} ${pad(c.name, 30)} ${c.desk ? pad('desk:' + c.desk, 15) : pad('', 15)} ${c.for.split('. ')[0].replace(/\.$/, '')}.`;
    out(rows.map(c => ({ id: c.id, name: c.name, group: c.group, desk: c.desk, status: c.status, for: c.for, fits: c.fits })), [`The channel book: ${CHANNELS.length} paid channels in the United States, read at their sources on ${BOOK_READ}.`, 'Limits carry a grade: A read on the platform\'s own page, B seen as an excerpt, D from memory. One channel in full: channels <id>', '',
      /* asked what fits a kind of work: one list, best fit first, with the score, which is judgment and not a measurement */
      ...(kind ? [`Channels that fit ${kind} work, best first (fit 3 is first money, 2 is worth a share; judgment, not a measurement):`, ...rows.map(c => `  fit ${c.fits[kind]}${row(c)}`), '', 'Left out: ' + CHANNELS.filter(c => c.status === 'open' && c.fits[kind] < 2).map(c => `${c.id} (${c.fits[kind]})`).join(', ') + '.'] : groups.flatMap(gp => [gp, ...rows.filter(c => c.group === gp).map(row), '']))].join('\n'));
  },

  async plan() {
    const X = context(), { pack, snapshot, model } = X, line = opt('line') || die('plan --line <line> --budget <dollars a month> ...   Lines: ' + Object.keys(pack.lines).join(', '));
    if (!pack.lines[line]) die(`"${line}" is not a Campaign Desk line. Lines: ${Object.keys(pack.lines).join(', ')}`);
    const budget = numOpt('budget', { min: 1, what: 'dollars a month, a positive number' }), weeks = numOpt('weeks', { min: 1, max: 52, int: true }), n = numOpt('n', { min: 1, max: 500, int: true }), within = numOpt('within', { min: 5, max: 600, what: 'minutes of drive, a number' });
    const start = dayOpt('start'), jobVal = numOpt('job-value', { min: 1, what: 'dollars, a positive number' }), bookRate = numOpt('book-rate', { min: 1, max: 100, what: 'a percentage' }), month = numOpt('month', { min: 1, max: 12, int: true });
    if (month != null && !A['from-heat']) die('--month chooses the month the Heat Desk plans for, so it goes with --from-heat.');
    const P = { line }; if (budget != null) P.budget = budget; if (start) P.start = start; if (weeks != null) P.weeks = weeks; if (n != null) P.n = n; if (jobVal != null) P.jobVal = jobVal; if (bookRate != null) P.bookRate = bookRate;
    if (opt('angles')) { P.angles = list(opt('angles')); const bad = P.angles.filter(a => !pack.angles.some(x => x.id === a)); if (bad.length) die(`--angles names ${bad.join(', ')}, which the dashboard does not have. Angles: ${pack.angles.map(a => a.id).join(', ')}`); }
    let mixGiven = null;
    if (opt('mix')) { mixGiven = Object.fromEntries(pack.platforms.order.map(k => [k, 0])); for (const kv of list(opt('mix'))) { const [k, v] = kv.split('='); if (!(k in mixGiven)) die(`--mix names "${k}". The Campaign Desk's platforms: ${pack.platforms.order.join(', ')}`); if (!(Number(v) >= 0)) die(`--mix ${k}=${v}: a share is a number, zero or more.`); mixGiven[k] = +v; } if (!Object.values(mixGiven).some(v => v > 0)) die('--mix gives every platform nothing.'); P.mix = mixGiven; }
    const notes = [], shop = X.brand && X.brand.geo && X.brand.geo.lat != null ? X.brand.geo : null, minutes = z => desk.minutesFrom(shop, z), ZI = Object.fromEntries(model.zips.map(z => [z.zip, z]));
    if (within != null && !shop) die('The brand file holds no location for the shop, so drive time cannot be reckoned.');
    if (budget == null && !A['from-heat']) notes.push(`No --budget was given, so this is the Campaign Desk's opening figure of ${$((pack.defaults || {}).budget)} a month.`);
    if (!start) notes.push('No --start was given, so the plan starts on the coming Monday, as the desk\'s own does.');
    let from = '', heat = null, heatRows = [];
    if (A['from-heat']) {
      for (const k of ['zips', 'county', 'by-line', 'n']) if (A[k] != null) die(`--from-heat takes its markets from the Heat Desk, so it cannot be combined with --${k}. Use --within to hold its markets to a drive time.`);
      /* the Heat Desk plans a month: the one the flight mostly runs in, unless one is named */
      const mm = desk.monthsOf(desk.fullPlan(P, X)), main = month != null ? month - 1 : mm.slice().sort((a, b) => b.days - a.days)[0].m;
      const h = (await runHeat(Object.assign({ month: main }, budget != null ? { budget } : {}, A.lsa ? { lsaLive: true } : {}))).value; if (!h) die('This dashboard has no Heat Desk.');
      const d = h.deskPayload, hz = Object.fromEntries((h.zips || []).map(z => [z.zip, z])); let zips = d.zips.slice();
      if (month == null && mm.length > 1) notes.push(`The Heat Desk plans one month at a time. This is its plan for ${h.month}, where most of the flight's days fall; --month picks another.`);
      if (within != null) { const keep = zips.filter(z => ZI[z] && minutes(ZI[z]) <= within); if (!keep.length) die(`None of the Heat Desk's ${zips.length} ZIPs is within ${within} minutes of the shop.`); if (keep.length < zips.length) notes.push(`--within ${within} dropped ${zips.length - keep.length} of the Heat Desk's ${zips.length} ZIPs, so its own figures below are for a larger plan than this one.`); zips = keep; }
      const heatMix = Object.fromEntries(pack.platforms.order.map(k => [k, Math.round(1000 * (d.mix[k] || 0)) / 10]));
      P.line = d.line; P.scope = 'picks'; P.picks = zips; P.bids = Object.fromEntries(zips.filter(z => d.bids[z] != null).map(z => [z, d.bids[z]])); if (budget == null) P.budget = d.budget;
      if (mixGiven) notes.push('The platform split is the one given with --mix, not the Heat Desk\'s, so its own figures below are for another split.'); else P.mix = heatMix;
      heat = { month: h.month, budget: h.totals.budget, spent: h.totals.spent, zips: h.totals.zips, leads: h.totals.leads, jobs: h.totals.jobs, cpl: h.totals.cpl, costPerJob: h.totals.costPerJob, grade: h.grades.leads, within20: h.totals.within20min, farthest: h.totals.farthestMin, reserve: h.settings.reserve, picks: d.zips.slice(), mix: heatMix };
      heatRows = zips.map(z => hz[z]).filter(Boolean);
      from = `the Heat Desk's plan for ${h.month}: ${zips.length} ZIPs with its bid adjustments${mixGiven ? '' : ' and the platform shares that run after its minimums'}.\nThe Heat Desk's own model for its plan (${h.totals.zips} ZIPs, ${$(h.totals.spent)}): ${h.totals.leads} leads at ${$(h.totals.cpl)}, ${h.totals.jobs} booked jobs at ${$(h.totals.costPerJob)} (grade ${h.grades.leads}); ${h.totals.within20min}% of the money within 20 minutes of the shop, the farthest ZIP ${h.totals.farthestMin} minutes out. It weighs drive time, cold exposure and competitor pressure by ZIP; the Campaign Desk's forecast below is a cruder benchmark sum. Where the two differ on heating, quote the Heat Desk${h.settings.reserve ? `.\nThe Heat Desk also holds back ${Math.round(h.settings.reserve * 100)}% of the month as a freeze reserve, to be released when a hard freeze is forecast (heat reads the week). The files here carry the whole budget flat: decide with the owner whether to hold the reserve back` : ''}`;
    } else {
      if (opt('county')) { const want = list(opt('county')).map(s => s.toLowerCase()), f = model.counties.filter(c => want.includes(c.name.toLowerCase())); if (f.length !== want.length) die(`A county was not found. Counties: ${model.counties.map(c => c.name).join(', ')}`); P.scope = 'county'; P.counties = f.map(c => c.fips); }
      if (opt('zips')) {
        P.scope = 'picks'; P.picks = list(opt('zips')); const unknown = P.picks.filter(z => !ZI[z]); if (unknown.length) die(`--zips names ${unknown.join(', ')}, which the dashboard does not score.`);
        if (within != null) { const farOut = P.picks.filter(z => minutes(ZI[z]) > within); if (farOut.length) die(`--within ${within}: ${farOut.map(z => `${z} (${minutes(ZI[z])} minutes)`).join(', ')} ${farOut.length === 1 ? 'is' : 'are'} farther than that. Drop ${farOut.length === 1 ? 'it' : 'them'} or drop --within.`); }
      }
      if (opt('by-line')) {
        const sl = pack.service && pack.service.lines.find(l => l.id === opt('by-line')); if (!sl) die(`--by-line takes a service line: ${(pack.service ? pack.service.lines.map(l => l.id) : []).join(', ')}`);
        if (opt('zips')) die('--by-line ranks the markets itself, so it cannot be combined with --zips.');
        if (!(snapshot && snapshot.slm)) die('Priority by service line was not read from the dashboard (no browser when it was connected). Use --n, --zips or --county.');
        const i = snapshot.slm.zipFields.indexOf('priorityPct'), b = snapshot.slm.zipFields.indexOf('bid'), cnty = P.counties ? new Set(P.counties) : null;
        const ranked = model.zips.filter(z => (!cnty || cnty.has(z.fips)) && (within == null || minutes(z) <= within)).map(z => ({ z, c: (snapshot.slm.zips[z.zip] || { lines: {} }).lines[sl.id] })).filter(x => x.c).sort((a, b2) => b2.c[i] - a.c[i]).slice(0, P.n || 30);
        if (!ranked.length) die(`No market is left${within != null ? ` within ${within} minutes` : ''}.`);
        P.scope = 'picks'; P.picks = ranked.map(x => x.z.zip); P.bids = Object.fromEntries(ranked.map(x => [x.z.zip, x.c[b]])); delete P.counties; from = `the top ${ranked.length} ZIPs by campaign priority for ${sl.name}${within != null ? `, within ${within} minutes of the shop` : ''}, with that line's starting bid adjustments (module 12)`;
      } else if (within != null && !opt('zips')) {
        /* the desk's own ranking, held to the drive */
        const probe = desk.fullPlan(P, X); let pool = model.zips.filter(z => z.occ >= probe.minhh && minutes(z) <= within); if (probe.scope === 'county') pool = pool.filter(z => probe.counties.includes(z.fips));
        pool = pool.sort((a, b) => b.effb - a.effb).slice(0, probe.n); if (!pool.length) die(`No market is within ${within} minutes of the shop.`);
        P.scope = 'picks'; P.picks = pool.map(z => z.zip); delete P.counties; from = `the top ${pool.length} ZIPs by efficiency within ${within} minutes of the shop (the paid model's ranking, held to the drive)`;
      }
    }
    const R = desk.read(P, X), full = { line: R.P.line, budget: R.P.budget, start: R.P.start, weeks: R.P.weeks, scope: 'picks', picks: R.markets.map(m => m.z.zip), mix: R.P.mix, angles: R.P.angles, bookRate: R.P.bookRate, jobVal: R.P.jobVal };
    if (R.P.bids) full.bids = R.P.bids;
    const file = opt('out') ? path.resolve(opt('out')) : path.join(DRAFTS, `plan-${R.P.line}-${R.P.start}.json`); outside(path.dirname(file), 'The folder for the plan');
    const replaced = fs.existsSync(file); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(heat ? { plan: full, heat } : full, null, 1) + '\n');
    const heatTable = heatRows.length ? ['', `The Heat Desk's own reading of these ${heatRows.length} ZIPs (its dollars steer by bid adjustment; the dollars by ZIP above are the Campaign Desk's):`, `  ${pad('zip', 6)} ${pad('city', 18)} ${lpad('min', 4)} ${pad('tier', 8)} ${lpad('heat $', 7)} ${lpad('bid', 5)}  why`, ...heatRows.map(z => `  ${pad(z.zip, 6)} ${pad(z.city, 18)} ${lpad(z.minutes, 4)} ${pad(z.tier, 8)} ${lpad($(z.dollars), 7)} ${lpad((z.bid >= 0 ? '+' : '') + z.bid + '%', 5)}  ${String(z.why || '').slice(0, 110)}`)] : [];
    out({ plan: full, heat, file, from, notes, totals: R.totals, forecast: R.forecast, flight: R.flight, floors: R.floors, markets: R.markets.map(m => ({ zip: m.z.zip, city: m.z.city, county: m.z.county, minutes: minutes(m.z), spend: Math.round(m.spend), spanish: m.es, angles: m.angles.map(a => a.id) })) },
      [from ? 'Markets from ' + from + '.' : '', ...notes, camp.planText(R, X), ...heatTable, '', `Plan  ->  ${rel(file)}${replaced ? '   (replaced the plan that was there)' : ''}`, `Next: node paid-ads/cli.mjs draft ${rel(file)}`].filter((x, i, a) => !(x === '' && (i === 0 || a[i - 1] === ''))).join('\n'));
  },

  draft() {
    const f = A._[0] || die('draft <plan.json> [--out campaign.json] [--force]'), X = context(), src = readJson(path.resolve(f)) || die('No plan at ' + f);
    const c = camp.draft(src.plan && typeof src.plan === 'object' ? src.plan : src, X); if (src.heat && typeof src.heat === 'object') c.heat = src.heat;
    const file = opt('out') ? path.resolve(opt('out')) : path.join(DRAFTS, `campaign-${c.plan.line}-${c.plan.start}.json`); outside(path.dirname(file), 'The folder for the campaign file');
    /* a campaign file someone has worked on is never written over without being told to */
    let replaced = false;
    if (fs.existsSync(file)) { let was = null; try { was = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { was = null; } if ((!was || !was.draft) && !A.force) die(`${rel(file)} is already there and is no longer a draft: someone has rewritten it. Write this draft elsewhere with --out <file>, or pass --force to replace it.`); replaced = true; }
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(c, null, 1) + '\n');
    const groups = c.search.reduce((s, x) => s + x.adGroups.length, 0);
    out({ file, name: c.name, searchCampaigns: c.search.length, adGroups: groups, ads: c.ads.length, replaced }, `${c.name}\n${c.search.length} search campaign${c.search.length === 1 ? '' : 's'} (${c.search.map(s => s.lang).join(', ')}), ${groups} ad groups, ${c.ads.length} other ads: all of it the dashboard's own library copy.\nCampaign file  ->  ${rel(file)}${replaced ? '   (replaced the draft that was there)' : ''}\nThis is a draft and cannot be built as it is. Rewrite the copy, delete the "draft" key, then: node paid-ads/cli.mjs lint ${rel(file)}`);
  },

  lint() {
    const f = A._[0] || die('lint <campaign.json> [--allow rule,rule]'), X = context(), c = readJson(path.resolve(f)) || die('No campaign file at ' + f);
    if (A.allow === true) die('--allow takes the rules to set aside, by name: --allow draft,kw-theme');
    const g = camp.gate(c, X, { allow: list(opt('allow')) }); badAllow(g);
    out({ ok: g.ok, counts: g.counts, stats: g.stats, findings: g.findings, claims: g.claims, allowed: g.allowed, notLifted: g.notLifted }, camp.report(g, rel(path.resolve(f))) + liftText(g)); if (!g.ok) process.exitCode = 1;
  },

  async build() {
    const f = A._[0] || die('build <campaign.json> [--allow rule,rule] [--out folder] [--no-live] [--force]'), X = context(), src = path.resolve(f), c = readJson(src) || die('No campaign file at ' + f);
    if (A.allow === true) die('--allow takes the rules to set aside, by name: --allow kw-theme');
    const g = camp.gate(c, X, { allow: list(opt('allow')) }), name = rel(src); badAllow(g);
    const fail = extra => { out({ ok: false, counts: g.counts, findings: g.findings, claims: g.claims, allowed: g.allowed, notLifted: g.notLifted }, camp.report(g, name) + liftText(g) + `\n\nNot written. ${extra || `Fix the ${g.counts.error} error${g.counts.error === 1 ? '' : 's'} and build again.`}`); process.exitCode = 1; };
    if (!g.ok) return fail();
    /* where it goes: a folder a different campaign was built into is not written over without being told to */
    const dir = opt('out') ? path.resolve(opt('out')) : path.join(OUT, camp.slug(`${g.reading.P.line}-${g.reading.P.start}${c.slug ? '-' + c.slug : ''}`)); outside(dir, 'The output folder');
    const before = path.join(dir, 'campaign.json'); if (fs.existsSync(before) && !A.force) { let was = null; try { was = JSON.parse(fs.readFileSync(before, 'utf8')); } catch { was = null; } if (!was || (was.name || '') !== (c.name || '')) die(`${rel(dir)} already holds another campaign${was && was.name ? ` ("${was.name}")` : ''}. Give this one a "slug" in its campaign file so it gets its own folder, pass --out <folder>, or pass --force to replace what is there.`); }
    /* the running dashboard's own screen, where a browser is here */
    const atlas = atlasFile(), av = A['no-live'] || !atlas ? { ok: false, why: A['no-live'] ? '--no-live was passed' : 'the dashboard file is gone from this machine' } : await live.available();
    const dash = { ran: av.ok, why: av.ok ? '' : av.why, screen: null, desk: null };
    const lic = (X.brand && X.brand.license) || g.reading.P.lic, sets = [], recount = () => { g.findings.sort((a, b) => ({ error: 0, warn: 1, note: 2 })[a.severity] - ({ error: 0, warn: 1, note: 2 })[b.severity]); g.counts = { error: g.findings.filter(x => x.severity === 'error').length, warn: g.findings.filter(x => x.severity === 'warn').length, note: g.findings.filter(x => x.severity === 'note').length }; g.ok = g.counts.error === 0; };
    for (const s of c.search || []) for (const gp of s.adGroups || []) if (gp.ad) sets.push({ where: `search ${String(s.lang || 'en').toUpperCase()} · ${gp.name}`, texts: (gp.ad.headlines || []).concat(gp.ad.descriptions || []).map(adText), platform: 'google', lic, search: true });
    for (const a of c.ads || []) { const ch = byId(a.channel), fm = ch && (ch.formats.find(x => x.id === a.format) || ch.formats[0]); if (!fm) continue; const texts = Object.keys(fm.fields).flatMap(k => (Array.isArray(a[k]) ? a[k] : a[k] == null ? [] : [a[k]])).map(adText).filter(Boolean); if (texts.length && a.angle !== 'recruit') sets.push({ where: `${a.channel}: ${a.name || a.angle || ''}`, texts, platform: ch.desk === 'meta' ? 'meta' : (ch.desk || ch.id), lic, search: false }); }
    if (av.ok && sets.length) {
      try {
        /* a rule set aside by name is set aside for the dashboard's screen as well, on the same terms */
        const found = await live.withDashboard(atlas, s => live.lint(s, sets)), rules = Object.fromEntries(X.pack.rules.rules.map(r => [r.id, r])), mine = new Set(g.findings.filter(x => x.rule.startsWith('rule:')).map(x => x.where + '|' + x.rule.slice(5))), lifted = new Set(g.allowed.filter(a => a.startsWith('rule:')).map(a => a.slice(5)));
        let extra = 0; found.forEach((list2, i) => { for (const x of list2) { if (x.id === 'GGL1' && !sets[i].search) continue; if (mine.has(sets[i].where + '|' + x.id) || lifted.has(x.id)) continue; const r = rules[x.id] || { severity: 'warn', name: x.id, enforcer: '', cite: '', fix: '' }; g.findings.push({ severity: ({ block: 'error', warn: 'warn', note: 'note' })[r.severity] || 'warn', rule: 'dashboard:' + x.id, where: sets[i].where, message: `The running dashboard's own screen flags this and this toolkit's did not: ${r.name} (${r.enforcer}; ${r.cite}).`, excerpt: x.ev, fix: r.fix }); extra++; } });
        recount(); dash.screen = { sets: sets.length, agrees: extra === 0, extra };
      } catch (e) { dash.screen = { error: String(e.message || e).split('\n')[0] }; }
      if (!g.ok) return fail('The running dashboard\'s screen found what this toolkit\'s missed. Fix it and build again.');
    }
    /* the files */
    const made = camp.files(c, g, X, handoffNote('paid-ads-specialist', X.connection, { campaign: c.name || '', campaigns: (c.search || []).length, ads: g.stats.ads, extra: (c.extra || []).map(e => ({ channel: e.channel, monthly: e.monthly })) }));
    fs.mkdirSync(dir, { recursive: true }); for (const [n, body] of Object.entries(made)) fs.writeFileSync(path.join(dir, n), body);
    /* the plan through the Campaign Desk's own Load button */
    if (av.ok) {
      try {
        const d = await live.withDashboard(atlas, s => live.desk(s, path.join(dir, 'campaign-desk-plan.json'))), T = g.reading.totals, N = v => Math.round(v).toLocaleString('en-US');
        /* the desk also counts the campaigns and ads of its own build, written from its library: that is not this campaign */
        const kpis = Object.fromEntries(Object.entries(d.kpis || {}).filter(([k2]) => k2 !== 'Campaign objects')), k = Object.fromEntries(Object.entries(kpis).map(([a, b]) => [a, b.value]));
        /* the same markets (in whatever order the desk lists them) and the same three figures */
        const same = d.accepted && k['Leads a month'] === N(T.leads) && k['Booked jobs'] === N(T.booked) && k['Clicks a month'] === N(T.clicks) && JSON.stringify((d.plan.zips || []).slice().sort()) === JSON.stringify(g.reading.markets.map(m => m.z.zip).sort());
        dash.desk = { accepted: d.accepted, verdict: d.verdict, kpis, agrees: same, markets: d.plan && d.plan.zips ? d.plan.zips.length : 0 };
        if (!d.accepted) g.findings.push({ severity: 'warn', rule: 'dashboard:desk', where: 'plan', message: `The running Campaign Desk did not take the plan file ("${d.verdict}"). Do not hand it over until that is understood.`, excerpt: '', fix: '' });
        else if (!same) g.findings.push({ severity: 'warn', rule: 'dashboard:forecast', where: 'plan', message: `The running Campaign Desk reads this plan differently from this toolkit: it shows ${k['Clicks a month']} clicks, ${k['Leads a month']} leads and ${k['Booked jobs']} booked jobs a month on ${dash.desk.markets} markets, where this toolkit reckons ${N(T.clicks)}, ${N(T.leads)} and ${N(T.booked)} on ${g.reading.markets.length}. Quote the dashboard's figures: this toolkit's model was written from another build of the desk.`, excerpt: '', fix: '' });
        /* a desk this model was not checked against, which reads this plan the same, is no longer a warning */
        if (d.accepted && same) for (const x of g.findings) if (x.rule === 'desk-build') { x.severity = 'note'; x.message = 'The Campaign Desk in this dashboard is not a build this toolkit was checked against, but the running desk reads this plan the same: clicks, leads, booked jobs and markets all match.'; }
        recount();
      } catch (e) { dash.desk = { error: String(e.message || e).split('\n')[0] }; }
    }
    const names = Object.keys(made).concat(['report.json', 'README.md']), R = g.reading;
    const reportJson = { built: new Date().toISOString(), name: c.name || '', atlas: { name: X.connection.identity.atlas, build: X.connection.identity.build, sha256: X.connection.identity.sha256.slice(0, 16) }, plan: g.plan, forecast: { totals: R.totals, byPlatform: R.forecast, costPerBooked: R.costPerBooked, flight: R.flight, pacedBy: R.season.from }, heatDesk: c.heat || null, outsideTheDesk: (c.extra || []).filter(e => e && +e.monthly > 0), stats: g.stats, counts: g.counts, rulesSetAside: g.allowed, rulesNotLifted: g.notLifted, findings: g.findings, claims: g.claims, landingPagesChecked: X.site ? { against: 'the site\'s sitemap', ageHours: X.site.ageHours, pages: X.site.paths.size } : null, dashboard: dash, files: names };
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(reportJson, null, 1) + '\n');
    fs.writeFileSync(path.join(dir, 'README.md'), camp.readme(c, g, X, names, dash.desk && !dash.desk.error ? dash.desk : null));
    const dl = dash.ran ? [dash.screen ? (dash.screen.error ? `  The dashboard's screen could not be run: ${dash.screen.error}` : `  Screened by the running dashboard: ${dash.screen.sets} ad sets, ${dash.screen.agrees ? 'it flags nothing this toolkit did not' : dash.screen.extra + ' more findings, listed above'}.`) : '', dash.desk ? (dash.desk.error ? `  The plan could not be tried on the dashboard: ${dash.desk.error}` : dash.desk.accepted ? `  Loaded through the Campaign Desk's own Load button: taken ("${dash.desk.verdict}"), ${dash.desk.markets} markets${dash.desk.agrees ? ', and its forecast matches this one figure for figure.' : '. Its forecast differs: see the warning.'}` : `  The Campaign Desk refused the plan file: "${dash.desk.verdict}".`) : ''].filter(Boolean) : [`  Not checked against the running dashboard: ${dash.why}.`];
    out({ ok: true, dir, files: names, counts: g.counts, stats: g.stats, findings: g.findings, claims: g.claims, allowed: g.allowed, notLifted: g.notLifted, dashboard: dash, forecast: reportJson.forecast },
      [camp.report(g, name) + liftText(g), '', `Built ${c.name || ''}`.trim(), ...dl, X.site ? `  Landing pages were checked against the site's sitemap, read ${X.site.ageHours} hour${X.site.ageHours === 1 ? '' : 's'} ago.` : '  Landing pages were not checked: the site\'s sitemap has not been read here.', `  Every campaign and every ad in these files is paused. Nothing was sent to an ad account.`, ...names.map(n => '  ' + rel(path.join(dir, n))), '', `For the dashboard: Campaign Desk (module 08), ⤒ Load, choose ${rel(path.join(dir, 'campaign-desk-plan.json'))}`].join('\n'));
  },
};
/* --allow: a name that is no rule stops the command; what was set aside and what could not be is said after the report */
function badAllow(g) { if (g.unknownAllow.length) die(`--allow names ${g.unknownAllow.join(', ')}, which ${g.unknownAllow.length === 1 ? 'is not a rule' : 'are not rules'} the gate gives. A rule is named as the report prints it in brackets: draft, kw-theme, rule:HOUSE1, claim:hours.`); }
function liftText(g) { return (g.allowed.length ? `\n\nSet aside because it was asked for: ${g.allowed.join(', ')}. The build records this, and so does the README.` : '') + (g.notLifted.length ? `\nNot set aside, whatever was asked: ${g.notLifted.join(', ')}.` : ''); }

if (A.help || !C[cmd]) { C.help(); if (!C[cmd] && cmd !== 'help') process.exitCode = 2; }
else Promise.resolve().then(() => C[cmd]()).catch(e => { console.error(e instanceof NotConnected || e instanceof live.Unavailable ? e.message : (process.env.PA_DEBUG && e && e.stack) || 'Error: ' + (e && e.message ? e.message : e)); process.exit(e instanceof live.Unavailable ? 3 : 2); });
