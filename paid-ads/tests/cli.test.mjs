/* The command line, start to finish, in a sandbox: connect, read what the dashboard knows, plan, draft, lint, build.
   No browser is used (tests/e2e covers the running dashboard) and nothing is written inside the repository. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, atlasFile, sandbox, run, gitState, BRAND, REPO } from './_t.mjs';
import { isBundle, embeddedData, stripPanel } from '../../dashboard-link/lib/panel.mjs';

const CLI = 'paid-ads/cli.mjs', before = gitState();
const { home, env } = sandbox(), file = atlasFile(), at = (...p) => path.join(home, ...p), J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const go = (args, opts) => run(CLI, args, env, opts);

/* ---- before a dashboard is connected ---- */
let r = go(['where']);
ok(r.code === 0 && /Dashboard: none connected\. Ask for the dashboard file and run: node paid-ads\/cli\.mjs connect <atlas\.html>/.test(r.out) && /Brand: none on file/.test(r.out) && r.out.includes(at('paid-ads')), 'where, with nothing connected: says so, says how, and shows where client files go');
r = go(['markets']); ok(r.code === 2 && /No dashboard is connected on this machine/.test(r.err) && !/\.mjs:\d+/.test(r.err), 'a command that needs the dashboard stops with a plain message');
r = go(['lines']); ok(r.code === 2 && /No paid pack is on file\. Connect a dashboard first/.test(r.err), 'so does one that needs the library');
r = go(['channels']); ok(r.code === 0 && /The channel book: \d+ paid channels in the United States, read at their sources on \d{4}-\d{2}-\d{2}/.test(r.out) && /google_search/.test(r.out) && /apple_maps/.test(r.out) && /desk:google/.test(r.out), 'the channel book needs no dashboard');
r = go(['channels', 'meta']); ok(r.code === 0 && /Meta \(Facebook and Instagram\) {2}\(meta; Social; Campaign Desk platform "meta"\)/.test(r.out) && /primary\s+Primary text\s+limit 1024, about 125 show {2}\(grade [A-D]\)/.test(r.out) && /Financial products and services/.test(r.out) && /Read on \d{4}/.test(r.out), 'one channel in full: formats, limits with their grade, rules, sources');
r = go(['channels', 'apple_maps']); ok(r.code === 0 && /CLOSED to this kind of business/.test(r.out), 'a closed channel says it is closed');
r = go(['channels', '--for', 'emergency'], { json: true }); ok(r.code === 0 && r.json.length > 3 && r.json.every(c => c.fits.emergency >= 2) && r.json[0].fits.emergency === 3 && go(['channels', '--for', 'nonsense']).code === 2 && go(['channels', 'myspace']).code === 2 && /eddm/.test(go(['channels', '--find', 'mailbox']).out), 'channels by the kind of work they fit, or by a word');
r = go(['nonsense']); ok(r.code === 2 && /node paid-ads\/cli\.mjs <command>/.test(r.out), 'an unknown command prints the help and fails');

/* ---- connect ---- */
r = go(['connect', file, '--no-live']);
ok(r.code === 0 && /Connected: DFW Thermal Debt Atlas · Build 4/.test(r.out) && /Paid ads specialist/.test(r.out) && /ok Campaign Desk takes a plan file: module 08, ⤒ Load/.test(r.out) && /-- Brand with a license number/.test(r.out) && /read as text only/.test(r.out), 'connect: the same connection the content strategist uses, with what the paid ads specialist can do with it', r.err);
fs.writeFileSync(at('content-strategist', 'brand.json'), JSON.stringify(BRAND));   /* the console's atlas carries a placeholder brand; give the client one with a license */
r = go(['where']);
ok(r.code === 0 && /Dashboard: DFW Thermal Debt Atlas · Build 4, connected .* UTC\. It cannot be run on this machine/.test(r.out) && /Brand: Example Air Conditioning & Heating · license set · phone set · https:\/\/www\.example-air\.test · hours "Monday to Saturday/.test(r.out) && /promotion on file: \$50 off a heating repair · reviews as of 2026-10-01/.test(r.out) && /Forecasts: the Campaign Desk in this dashboard is not the one this model was checked against \(Build 6\)/.test(r.out), 'where: the dashboard, whether it runs here, the brand on file, and a warning that this desk build is not one the forecast model was checked against');
r = go(['dashboard']); ok(r.code === 0 && /Doors: what this dashboard takes in and gives out/.test(r.out) && /263 ZIP markets/.test(r.out), 'dashboard: the connection in full');

/* ---- what the dashboard knows ---- */
r = go(['lines']); ok(r.code === 0 && /Service lines of the DFW Thermal Debt Atlas · Build 4/.test(r.out) && /^heat\s+/m.test(r.out) && /grade D unless/.test(r.out) && r.out.split('\n').filter(l => /^\w+\s+.*\d+%/.test(l)).length === 14, 'lines: the fourteen service lines with their stated economics');
r = go(['lines', 'heat']); ok(r.code === 0 && /Campaign Desk line "heat"/.test(r.out) && /Stated economics \(grade D unless the dashboard says otherwise\): ticket \$\d+/.test(r.out) && /Computed economics: not read \(no browser was available/.test(r.out) && /Platform fit \(0 to 3\)/.test(r.out) && /Hooks the dashboard suggests:/.test(r.out) && /Bid by hour/.test(r.out) && go(['lines', 'nope']).code === 2, 'one line in full, and what could not be computed without a browser is said, not guessed');
r = go(['markets', '--n', '5'], { json: true });
ok(r.code === 0 && r.json.markets.length === 5 && r.json.picks.length === 5 && /efficiency percentile/.test(r.json.rankedBy) && r.json.markets[0].efficiency >= r.json.markets[4].efficiency && typeof r.json.markets[0].minutes === 'number' && r.json.markets[0].priority === null && Array.isArray(r.json.markets[0].fires), 'markets: ranked as the dashboard ranks them, with minutes from the shop; no priority by line without the computed model');
r = go(['markets', '--county', 'collin', '--n', '8'], { json: true }); const collinOk = r.code === 0 && r.json.markets.length === 8 && r.json.markets.every(m => m.county === 'Collin');
r = go(['markets', '--within', '15'], { json: true }); const nearOk = r.code === 0 && r.json.markets.length > 0 && r.json.markets.every(m => m.minutes <= 15);
r = go(['markets', '--zips', '75150,75149'], { json: true }); const zipsOk = r.code === 0 && r.json.markets.map(m => m.zip).sort().join() === '75149,75150';
ok(collinOk && nearOk && zipsOk && go(['markets', '--city', 'Mesquite']).code === 0 && go(['markets', '--county', 'Narnia']).code === 2 && go(['markets', '--line', 'nope']).code === 2 && /were not read \(no browser/.test(go(['markets', '--line', 'heat', '--n', '3']).out), 'markets by county, by drive time, by ZIP or city; a place that does not exist is refused');
r = go(['keywords', 'furnace', '--city', 'Plano']);
ok(r.code === 0 && /furnace {2}.* page \/[\w-]+\/? {3}desk line/.test(r.out) && /Core {2}\[exact and phrase\]/.test(r.out) && /Local {2}\[phrase\]/.test(r.out) && /\bplano\b/.test(r.out) && !/\{city\}/.test(r.out.split('Campaign negatives')[0]) && /Campaign negatives for the heat line \(\d+\):/.test(r.out) && /Intent, and what to do with it:/.test(r.out) && /holds no keyword volumes/.test(r.out), 'keywords for an angle: ad groups with match types, each keyword with its intent, the city filled in, the negatives, and a plain statement that the dashboard holds no volumes', r.err);
r = go(['keywords', '--line', 'heat'], { json: true }); ok(r.code === 0 && r.json.angles.length >= 2 && r.json.angles.every(a => a.adGroups.every(g => g.keywords.every(k => k.intent))) && go(['keywords', 'nope']).code === 2 && go(['keywords', '--line', 'nope']).code === 2 && /No angle matches/.test(go(['keywords', '--find', 'zzzzqq']).out), 'keywords for a whole line; an angle or line that does not exist is refused');
r = go(['rules']); ok(r.code === 0 && /License: in every ad, written "Lic TACLA00000E"/.test(r.out) && /pinned to position 1/.test(r.out) && /TDLR1\s+fails the build/.test(r.out) && /HOUSE1\s+fails the build/.test(r.out) && /Consent text under any form/.test(r.out) && /United States rules behind these/.test(r.out) && !/has no test of its own/.test(r.out), 'rules: the license as it must be written, which rules stop a build, the consent text, the federal rules behind them');
r = go(['competitors', '--n', '3'], { json: true }); ok(r.code === 0 && r.json.companies.length === 3 && r.json.companies[0].reviews >= r.json.companies[2].reviews && /Never name a competitor in ad copy/.test(go(['competitors', '--n', '2']).out), 'competitors: the roster, largest first, with the warning that goes with it');

/* ---- plan ---- */
const planArgs = ['plan', '--line', 'heat', '--budget', '9000', '--start', '2026-11-23', '--weeks', '10', '--zips', '75150,75149,75043', '--mix', 'google=50,lsa=20,meta=15,nextdoor=10,microsoft=5'];
r = go(planArgs);
const planFile = at('paid-ads', 'drafts', 'plan-heat-2026-11-23.json');
ok(r.code === 0 && /Heating repair and furnace replacement: \$9,000 a month for 10 weeks from 2026-11-23, 3 ZIP markets/.test(r.out) && /not a promise/.test(r.out) && /NOTE The figures above are this toolkit's reading/.test(r.out) && /NOTE \$3,400 a job is the figure the desk opens every plan with/.test(r.out) && /The files carry a flat \$296 a day/.test(r.out) && r.out.includes('Next: node paid-ads/cli.mjs draft ') && fs.existsSync(planFile) && !/replaced the plan/.test(r.out), 'plan: the forecast on the desk\'s own arithmetic, called what it is, with the job value it assumed, and a plan file outside the repository', r.err);
const pj = J(planFile); ok(pj.line === 'heat' && pj.budget === 9000 && pj.scope === 'picks' && pj.picks.join() === '75150,75149,75043' && pj.mix.google === 50 && pj.mix.dg === 0 && Object.keys(pj.mix).length === 8 && pj.angles.length > 0, 'the plan file names every platform in its mix, so the desk fills nothing in');
r = go(planArgs.concat(['--job-value', '450', '--book-rate', '60'])); ok(r.code === 0 && /replaced the plan that was there/.test(r.out) && !/NOTE \$3,400 a job/.test(r.out) && /at 60% lead to booked/.test(r.out) && /18% of a \$450 job/.test(r.out) && J(planFile).jobVal === 450, 'plan again: the job value and booking rate can be set, and the file that was there is said to be replaced');
r = go(['plan', '--line', 'heat', '--budget', '9000', '--county', 'Collin', '--n', '6', '--start', '2026-11-23', '--out', at('p2.json')], { json: true });
ok(r.code === 0 && r.json.markets.length === 6 && r.json.markets.every(m => m.county === 'Collin') && Math.round(r.json.totals.spend) === 9000 && r.json.flight.length >= 3 && fs.existsSync(at('p2.json')), 'a plan by county, written where asked');
r = go(['plan', '--line', 'heat', '--budget', '9000', '--start', '2026-11-23', '--within', '20', '--n', '8', '--out', at('p3.json')], { json: true });
ok(r.code === 0 && r.json.markets.length === 8 && r.json.markets.every(m => m.minutes <= 20) && /within 20 minutes of the shop/.test(r.json.from) && r.json.plan.scope === 'picks', 'a plan held to a drive time: the desk\'s own ranking, among the markets within reach', r.err);
r = go(['plan', '--line', 'heat']);
ok(r.code === 0 && /No --budget was given, so this is the Campaign Desk's opening figure of \$15,000 a month\./.test(r.out) && /No --start was given, so the plan starts on the coming Monday/.test(r.out) && /from 2026-11-16/.test(r.out), 'a plan with no budget or start says which figures are the desk\'s own');
const E = a => go(a).err;
ok(/plan does not take --bogus\. It takes: --line/.test(E(planArgs.concat(['--bogus', '1']))) && /--budget takes dollars a month/.test(E(['plan', '--line', 'heat', '--budget', '-5'])) && /--start takes a date as YYYY-MM-DD; "2026-13-45" is not one/.test(E(['plan', '--line', 'heat', '--start', '2026-13-45'])) && /--weeks takes a whole number from 1 to 52/.test(E(['plan', '--line', 'heat', '--weeks', '80'])) && /--within takes minutes of drive/.test(E(['markets', '--within', 'abc'])) && /--zips names 99999, which the dashboard does not score/.test(E(['plan', '--line', 'heat', '--zips', '75150,99999'])) && /--angles names bogus/.test(E(['plan', '--line', 'heat', '--angles', 'bogus'])) && /--month chooses the month the Heat Desk plans for/.test(E(['plan', '--line', 'heat', '--month', '12'])),'an option the command does not know, a budget below zero, a date that does not exist, a ZIP or an angle the dashboard does not have: each stops the command and says why');
ok(/--within 15: \d{5} \(\d+ minutes\)/.test(E(['plan', '--line', 'heat', '--zips', '75150,76028', '--within', '15'])) && /cannot be combined with --zips/.test(E(['plan', '--line', 'heat', '--from-heat', '--zips', '75150'])), 'a ZIP named beyond the drive limit, or markets named beside the Heat Desk\'s, is refused, not ignored');
ok(go(['plan']).code === 2 && go(['plan', '--line', 'nope']).code === 2 && /--mix names "tiktok"/.test(E(['plan', '--line', 'heat', '--mix', 'tiktok=5'])) && /was not read from the dashboard/.test(E(['plan', '--line', 'heat', '--by-line', 'heat'])) && go(['plan', '--line', 'heat', '--from-heat']).code === 3 && /inside the repository/.test(E(['plan', '--line', 'heat', '--out', path.join(REPO, 'paid-ads', 'plan.json')])) && !fs.existsSync(path.join(REPO, 'paid-ads', 'plan.json')), 'plan refuses a line or platform the desk does not have, a ranking that was never read, the Heat Desk without a browser, and a file inside the repository');
go(planArgs);   /* back to the plan the rest of the test works from */

/* ---- draft, lint ---- */
r = go(['draft', planFile]);
const campFile = at('paid-ads', 'drafts', 'campaign-heat-2026-11-23.json');
ok(r.code === 0 && /2 search campaigns \(en, es\), \d+ ad groups, \d+ other ads: all of it the dashboard's own library copy/.test(r.out) && /This is a draft and cannot be built as it is\. Rewrite the copy, delete the "draft" key, then: node paid-ads\/cli\.mjs lint /.test(r.out) && fs.existsSync(campFile) && J(campFile).draft, 'draft: a campaign file started from the library, and told it cannot be built as it is', r.err);
r = go(['lint', campFile]);
ok(r.code === 1 && /^FAIL {2}/.test(r.out) && /ERROR {2}\[draft\] file: The file still carries its draft note/.test(r.out) && /\[desk-build\] plan:/.test(r.out) && /\[license-shows\]/.test(r.out) && /\[landing\] file: No landing page was checked/.test(r.out), 'lint: a draft fails the gate for being a draft, and writes nothing');
r = go(['build', campFile, '--no-live']); ok(r.code === 1 && /Not written/.test(r.out) && !fs.existsSync(at('paid-ads', 'out')), 'and build will not write it');
r = go(['draft', planFile]); ok(r.code === 0 && /replaced the draft that was there/.test(r.out), 'a draft that was never touched is replaced by a new one, and that is said');
/* the copy is rewritten: here the library copy stands in, with its note taken off */
const mine = J(campFile); delete mine.draft; fs.writeFileSync(campFile, JSON.stringify(mine, null, 1));
r = go(['draft', planFile]); ok(r.code === 2 && /is already there and is no longer a draft: someone has rewritten it/.test(r.err) && !J(campFile).draft, 'a campaign file someone has rewritten is not written over');
r = go(['draft', planFile, '--out', at('other-draft.json')]); ok(r.code === 0 && J(at('other-draft.json')).draft && go(['draft', planFile, '--force']).code === 0 && J(campFile).draft, 'unless a new file is named, or --force is passed');
fs.writeFileSync(campFile, JSON.stringify(mine, null, 1));
r = go(['lint', campFile]);
ok(r.code === 0 && /^PASS {2}/.test(r.out) && !/\[draft\]/.test(r.out) && /\[job-value\] plan:/.test(r.out), 'lint: with the note off, the library copy passes with warnings');
const c = J(campFile); c.search[0].adGroups[0].ad.headlines[0] = 'Up-front Furnace Pricing!'; c.search[0].adGroups[0].ad.headlines.push('Rated 4.9 Stars on Google'); const badFile = at('bad.json'); fs.writeFileSync(badFile, JSON.stringify(c));
r = go(['lint', badFile], { json: true });
ok(r.code === 1 && r.json.ok === false && r.json.findings.some(f => f.rule === 'rule:HOUSE1' && f.severity === 'error') && r.json.findings.some(f => f.rule === 'claim:reviews' && f.severity === 'error') && r.json.claims.some(x => x.status === 'contradicts') && /--allow/.test(go(['lint']).err) && go(['lint', at('missing.json')]).code === 2, 'lint fails a campaign with a hyphen in its copy and a rating the brand file contradicts');
r = go(['lint', badFile, '--allow', 'HOUSE1,claim:reviews,GGL1']);
ok(r.code === 1 && /Set aside because it was asked for: .*rule:HOUSE1/.test(r.out) && /Not set aside, whatever was asked: claim:reviews\./.test(r.out) && /\[claim:reviews\]/.test(r.out) && !/\[rule:HOUSE1\]/.test(r.out) && !/\[rule:GGL1\]/.test(r.out), 'house style can be set aside by name when asked; a claim the brand file contradicts cannot, and the report says which was which');
ok(/--allow names nosuchrule, which is not a rule the gate gives/.test(E(['lint', campFile, '--allow', 'nosuchrule'])) && /--allow takes the rules to set aside, by name/.test(E(['lint', campFile, '--allow'])), 'a name that is no rule stops the command');

/* ---- build ---- */
r = go(['build', badFile, '--no-live']);
ok(r.code === 1 && /^FAIL/.test(r.out) && /Not written\. Fix the 2 errors and build again\./.test(r.out) && !fs.existsSync(at('paid-ads', 'out')), 'build writes nothing when the gate fails');
r = go(['build', campFile, '--no-live']);
const outDir = at('paid-ads', 'out', 'heat-2026-11-23'), names = fs.existsSync(outDir) ? fs.readdirSync(outDir) : [];
ok(r.code === 0 && /^PASS/.test(r.out) && /Built Heating repair and furnace replacement: 3 markets/.test(r.out) && /Not checked against the running dashboard: --no-live was passed\./.test(r.out) && /Landing pages were not checked: the site's sitemap has not been read here\./.test(r.out) && /Every campaign and every ad in these files is paused\. Nothing was sent to an ad account\./.test(r.out) && /For the dashboard: open .*DFW_Thermal_Debt_Atlas_Build_4_Agent_Desk\.html and choose Agent Desk, the last module\. This campaign is on it/.test(r.out) && /That copy was not opened to check it: --no-live was passed\./.test(r.out) && /By hand instead: Campaign Desk \(module 08\), ⤒ Load, choose .*campaign-desk-plan\.json/.test(r.out), 'build: the gate, then the files, where the campaign now is in the dashboard, and what was not checked: the running dashboard, the copy with the Agent Desk, the landing pages', r.err || r.out.split('\n').slice(-3).join(' '));
ok(['campaign-desk-plan.json', 'campaign-plan_heat_2026-11-23.csv', 'google-ads-editor_heat_2026-11-23.csv', 'microsoft-ads_heat_2026-11-23.csv', 'meta-build-sheet_2026-11-23.csv', 'nextdoor-build-sheet_2026-11-23.csv', 'lsa-build-sheet_2026-11-23.csv', 'keywords_heat_2026-11-23.csv', 'creative_heat_2026-11-23.csv', 'campaign.json', 'report.json', 'README.md', 'handoff.json'].every(n => names.includes(n)), 'the folder holds the plan for the desk, a file for every channel, the ledgers, the report, a README and the hand-off for the Agent Desk', names);
const rep = J(path.join(outDir, 'report.json')), plan = J(path.join(outDir, 'campaign-desk-plan.json')), readme = fs.readFileSync(path.join(outDir, 'README.md'), 'utf8');
ok(rep.atlas.build === '4' && rep.dashboard.ran === false && rep.dashboard.why === '--no-live was passed' && rep.counts.error === 0 && Math.round(rep.forecast.totals.spend) === 9000 && rep.files.includes('README.md') && Array.isArray(rep.claims) && rep.rulesSetAside.length === 0 && rep.landingPagesChecked === null && plan.handoff.agent === 'paid-ads-specialist' && plan.handoff.atlas.build === '4' && plan.lic === BRAND.license && plan.brand === 'Example Air' && /was not tried against the running dashboard/.test(readme), 'the report records what was and was not checked; the plan file carries the brand and a note on who made it');
r = go(['build', campFile, '--no-live', '--allow', 'license-shows,kw-theme']);
ok(r.code === 0 && /Set aside because it was asked for: .*license-shows/.test(r.out) && J(path.join(outDir, 'report.json')).rulesSetAside.includes('license-shows') && /These rules were set aside for this build because someone asked: .*license-shows/.test(fs.readFileSync(path.join(outDir, 'README.md'), 'utf8')), 'a rule set aside at build is recorded where it cannot be missed: the output, the report and the README');
r = go(['build', campFile]); ok(r.code === 0 && /Not checked against the running dashboard: LEVIATHAN_NO_LIVE is set\./.test(r.out), 'with no browser on the machine, build says so and still writes the files');
r = go(['build', campFile, '--no-live', '--out', path.join(REPO, 'paid-ads', 'built')]); ok(r.code === 2 && /inside the repository/.test(r.err) && !fs.existsSync(path.join(REPO, 'paid-ads', 'built')), 'build will not write a client\'s campaign inside the repository');
/* another campaign for the same line and date */
const second = Object.assign(J(campFile), { name: 'Cold snap test' }); fs.writeFileSync(at('second.json'), JSON.stringify(second));
r = go(['build', at('second.json'), '--no-live']); ok(r.code === 2 && /already holds another campaign \("Heating repair and furnace replacement: 3 markets[^"]*"\)\. Give this one a "slug"/.test(r.err) && J(path.join(outDir, 'campaign.json')).name !== 'Cold snap test', 'a second campaign for the same line and date does not write over the first');
fs.writeFileSync(at('second.json'), JSON.stringify(Object.assign(second, { slug: 'Cold Snap Test' }))); r = go(['build', at('second.json'), '--no-live']);
ok(r.code === 0 && fs.existsSync(at('paid-ads', 'out', 'heat-2026-11-23-cold-snap-test', 'README.md')), 'given its own slug, it gets its own folder');
/* landing pages, once the content strategist has read the site */
fs.mkdirSync(at('content-strategist', 'sitemap'), { recursive: true });
const live = [...new Set(mine.search.flatMap(s => s.adGroups.map(g => g.ad.url)).filter(Boolean))], siteFile = at('content-strategist', 'sitemap', 'example-air.test.json');
fs.writeFileSync(siteFile, JSON.stringify({ site: BRAND.url, fetched: new Date().toISOString(), pages: live.slice(1).map(p => ({ url: BRAND.url + p, path: p })) }));
r = go(['lint', campFile]);
ok(r.code === 0 && /\[landing\] in \d+ places: The ad lands on .*, which is not in the site's sitemap as it was read 0 hours ago/.test(r.out) && !/No landing page was checked/.test(r.out), 'with the site\'s sitemap on file, a landing page that is not in it is called out, by reading what the content strategist read');
fs.rmSync(siteFile);

/* ---- the hand-off for the dashboard's Agent Desk ---- */
const hb = J(path.join(outDir, 'handoff.json')), deskCopy = at('dashboard', 'DFW_Thermal_Debt_Atlas_Build_4_Agent_Desk.html'), copyText = fs.existsSync(deskCopy) ? fs.readFileSync(deskCopy, 'utf8') : '', planOnly = J(path.join(outDir, 'campaign-desk-plan.json')); delete planOnly.handoff;
ok(isBundle(hb) && hb.id === 'paid:heat-2026-11-23' && hb.agent === 'paid-ads-specialist' && hb.atlas.build === '4' && JSON.stringify(hb.paid.plan) === JSON.stringify(planOnly) && hb.paid.summary.budget === 9000 && hb.paid.checked.dashboard.ran === false && !hb.paid.files.some(f => f.name === 'handoff.json') && hb.paid.files.some(f => f.name === 'README.md' && f.text === fs.readFileSync(path.join(outDir, 'README.md'), 'utf8')) && J(path.join(outDir, 'report.json')).files.includes('handoff.json'),
  'build also writes handoff.json: the plan the desk loads, the copy, the claims, the findings and every file of the folder, as one file for the Agent Desk');
const inCopy = copyText ? embeddedData(copyText) : null;
ok(inCopy && inCopy.bundles.map(b => b.id).sort().join() === 'paid:heat-2026-11-23,paid:heat-2026-11-23-cold-snap-test' && stripPanel(copyText) === fs.readFileSync(at('dashboard', 'atlas.html'), 'utf8') && fs.readFileSync(file, 'utf8') === fs.readFileSync(at('dashboard', 'atlas.html'), 'utf8') && /the dashboard copy named `DFW_Thermal_Debt_Atlas_Build_4_Agent_Desk\.html`/.test(fs.readFileSync(path.join(outDir, 'README.md'), 'utf8')),
  'and writes the copy of the dashboard with the Agent Desk in it again, holding both campaigns; the dashboard that was connected is not written to, and the README says where the copy is');
r = go(['panel', '--no-live']);
ok(r.code === 0 && /The dashboard with the Agent Desk in it {2}-> .*DFW_Thermal_Debt_Atlas_Build_4_Agent_Desk\.html/.test(r.out) && /2 hand-offs in it, newest first:/.test(r.out) && /Not opened to check it: --no-live was passed\./.test(r.out) && /does not take --bogus/.test(E(['panel', '--bogus'])), 'panel: the same command the link has, from the specialist\'s own command line');
r = go(['panel', '--no-live', '--forget', 'paid:heat-2026-11-23-cold-snap-test']);
ok(r.code === 0 && /^Forgotten: paid:heat-2026-11-23-cold-snap-test\./.test(r.out) && /1 hand-off in it/.test(r.out) && fs.existsSync(at('paid-ads', 'out', 'heat-2026-11-23-cold-snap-test', 'handoff.json')) && /No hand-off "paid:nope" is on file/.test(E(['panel', '--forget', 'paid:nope'])), 'a hand-off that is finished with is forgotten by its id; the folder it came from stays');

/* ---- the owner's answers, from the Agent Desk ---- */
const claimed = J(campFile); claimed.search[0].adGroups[0].ad.headlines.push('Same Day Furnace Repair', 'Best Furnace Repair in Town'); const claimFile = at('claimed.json'); fs.writeFileSync(claimFile, JSON.stringify(claimed, null, 1));
const open = go(['lint', claimFile], { json: true }).json.claims.filter(c => c.status === 'unconfirmed'), sameDay = open.find(c => /same day/i.test(c.said)), best = open.find(c => c.type === 'superlative');
const answersFile = at('owner-answers.json'), answers = list => fs.writeFileSync(answersFile, JSON.stringify({ format: 'leviathan.owner-answers', v: 1, handoff: 'paid:heat-2026-11-23', campaign: claimed.name, made: '2026-11-15T10:00:00.000Z', answers: list }));
answers([{ claim: sameDay.said, type: sameDay.type, decision: 'confirm', by: 'Pat Example', on: '2026-11-15', terms: 'for calls before 2 pm' }, { claim: best.said, type: 'superlative', decision: 'cut' }, { claim: 'Lifetime Warranty', type: 'guarantee', decision: 'cut' }]);
r = go(['answers', answersFile, claimFile]);
const rec = (J(claimFile).confirmed || []).find(x => x.claim === sameDay.said);
ok(r.code === 0 && /^Answers from the Agent Desk for "Heating repair and furnace replacement: 3 markets[^"]*", saved 2026-11-15: 1 confirmed, 2 to cut\./.test(r.out) && rec && rec.by === 'Pat Example' && rec.on === '2026-11-15' && rec.terms === 'for calls before 2 pm' && rec.from === 'the Agent Desk' && new RegExp(`"${sameDay.said}" {2}by Pat Example: the gate takes it`).test(r.out),
  'answers: a confirmation is recorded in the campaign file in the owner\'s words, with who gave it and when, and the gate takes it', r.err || r.out.split('\n').slice(0, 4).join(' | '));
ok(/To cut\. The lines are yours to rewrite/.test(r.out) && new RegExp(`"${best.said}" {2}in search EN · .*: Best Furnace Repair in Town`).test(r.out) && /"Lifetime Warranty" {2}is no longer in the copy\./.test(r.out) && J(claimFile).search[0].adGroups[0].ad.headlines.includes('Best Furnace Repair in Town') && /Next: rewrite the lines to cut, then node paid-ads\/cli\.mjs lint /.test(r.out),
  'a claim to cut is listed with every line that carries it, and the copy is left for the writer to rewrite');
ok(go(['lint', claimFile], { json: true }).json.claims.filter(c => c.said === sameDay.said).every(c => c.status === 'confirmed'), 'the gate then reads the claim as confirmed');
answers([{ claim: sameDay.said, decision: 'confirm', by: 'Pat Example', on: '2026-11-16', terms: 'for calls before noon' }, { claim: best.said, type: 'superlative', decision: 'confirm', by: 'Pat Example', on: '2026-11-16' }, { claim: 'Open Sundays', decision: 'confirm', by: 'Pat Example' }, { claim: 'No Name Given', decision: 'confirm' }, { claim: 'Undecided', decision: '' }]);
r = go(['answers', answersFile, claimFile], { json: true });
const conf = J(claimFile).confirmed;
ok(r.code === 1 && conf.filter(x => x.claim === sameDay.said).length === 1 && conf.find(x => x.claim === sameDay.said).terms === 'for calls before noon' && r.json.recorded.find(x => x.claim === best.said).taken === false && /not a basis/.test(r.json.recorded.find(x => x.claim === best.said).why) && r.json.recorded.find(x => x.claim === 'Open Sundays').inCopy === false && !conf.some(x => x.claim === 'No Name Given') && r.json.notes.some(n => /confirmed by nobody named/.test(n)) && r.json.notes.some(n => /neither a confirmation nor a cut/.test(n)),
  'a later answer replaces the earlier one; a superlative confirmed with no basis is recorded and still not taken; one for a claim the copy no longer makes, one with no name and one with no decision are each said to be what they are');
answers([{ claim: sameDay.said, decision: 'cut' }]); fs.writeFileSync(at('other-name.json'), JSON.stringify(Object.assign(J(claimFile), { name: 'Another campaign' })));
r = go(['answers', answersFile, at('other-name.json')]);
ok(r.code === 0 && /NOTE {2}These answers were given for "Heating repair[^"]*" and this campaign file is "Another campaign"/.test(r.out) && /Nothing was recorded, and the campaign file was not written\./.test(r.out), 'answers given for another campaign are said to be, and a file with only cuts in it changes nothing on disk');
fs.writeFileSync(at('not-answers.json'), JSON.stringify({ answers: [] }));
ok(/is not an answers file from the dashboard's Agent Desk/.test(E(['answers', at('not-answers.json'), claimFile])) && /answers <owner-answers\.json> <campaign\.json>/.test(E(['answers', answersFile])) && /is not a campaign file/.test(E(['answers', answersFile, answersFile])) && /answers does not take --force/.test(E(['answers', answersFile, claimFile, '--force'])), 'a file that is not an answers file, a missing campaign file and an option it does not take each stop the command');

/* ---- files back from the dashboard, and what needs a browser ---- */
r = go(['read', path.join(outDir, 'campaign-desk-plan.json')]); ok(r.code === 0 && /A Campaign Desk plan: line heat, \$9000 a month, 10 weeks from 2026-11-23, scope picks, 3 ZIPs picked\. Made by paid-ads-specialist on \d{4}-\d{2}-\d{2}\./.test(r.out), 'read: the plan file, and who made it');
ok(go(['check', path.join(outDir, 'campaign-desk-plan.json')]).code === 3 && go(['heat']).code === 3, 'check and heat need a browser, and stop with their own exit code when there is none');
ok(before !== null && gitState() === before, 'the repository is as it was: nothing a command wrote landed in it');
done();
