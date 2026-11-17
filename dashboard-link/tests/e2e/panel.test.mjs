/* The Agent Desk inside the running dashboard. Needs Playwright with Chromium; without them this file says so and passes.

   The two agents' own command lines do the work in a sandbox: the paid ads specialist builds a campaign, the content
   strategist hands over two pages. Each writes its hand-off and the copy of the dashboard with the Agent Desk in it.
   The copy is then opened headless and the Agent Desk is driven the way a person would drive it: its buttons, its
   tabs, its file box. What the Campaign Desk and Publish hold afterwards is read from them, not from the panel.

   It also checks what the panel must never do: change the dashboard around it, let text from a hand-off become markup,
   or claim something the dashboard no longer holds. Runs against the console's atlas (Build 4), and against ATLAS_HTML
   as well when set. Nothing of an ATLAS_HTML file is printed but counts. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, atlasFile, sandbox, run, gitState, REPO } from '../_t.mjs';
import * as live from '../../lib/live.mjs';
import { installPanel, stripPanel, isBundle, BUNDLE, ANSWERS } from '../../lib/panel.mjs';

const av = await live.available();
if (!av.ok) { console.log('skip  no browser here, so the Agent Desk was not tested in a dashboard: ' + av.why); process.exit(0); }
const FX = path.join(REPO, 'content-strategist', 'tests', 'fixtures'), PA = 'paid-ads/cli.mjs', CS = 'content-strategist/cli.mjs', LK = 'dashboard-link/cli.mjs', before = gitState();
const J = f => JSON.parse(fs.readFileSync(f, 'utf8')), read = f => fs.readFileSync(f, 'utf8');
const targets = [{ label: 'the console\'s atlas', file: atlasFile() }];
if (process.env.ATLAS_HTML) targets.push({ label: 'ATLAS_HTML', file: path.resolve(process.env.ATLAS_HTML) });

/* in the page */
const hand = (page, id) => page.evaluate(id => MODI.agents.handoffs().find(h => h.id === id) || null, id);
const toastSays = (page, re) => page.waitForFunction(src => new RegExp(src).test((document.querySelector('.toast') || {}).textContent || ''), re.source, { timeout: 20000 });
const saved = page => page.evaluate(() => window.__saved.slice());
const capture = page => page.evaluate(() => { window.__saved = []; saveFile = (name, content) => { window.__saved.push({ name: String(name), text: typeof content === 'string' ? content : null }); }; });
const reload = async page => { await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => typeof MODS !== 'undefined' && MODS.length > 0 && !!document.querySelector('#rail button')); await capture(page); await page.evaluate(() => showModule('agents')); };
const text = (page, sel) => page.evaluate(sel => (document.querySelector(sel) || {}).textContent || '', sel);
const pick = (page, id) => page.evaluate(id => { showModule('agents'); MODI.agents.receive({ open: id }); }, id);
const tab = (page, v) => page.click(`#lvpTabs button[data-v="${v}"]`);
/* markup that must never come out of a hand-off: an element that loads or runs something, or a handler attribute */
const injected = page => page.evaluate(() => ({ ran: window.__xss || 0, nodes: document.querySelectorAll('#mod-agents img, #mod-agents script, #mod-agents iframe, #mod-agents svg, #mod-agents object, #mod-agents [onerror], #mod-agents [onclick], #mod-agents [onload]').length }));

for (const { label, file } of targets) {
  const T = s => `${label}: ${s}`, { home, env } = sandbox({ live: true }), at = (...p) => path.join(home, ...p);
  const pa = (a, o) => run(PA, a, env, o), cs = (a, o) => run(CS, a, env, o), lk = (a, o) => run(LK, a, env, o);

  /* ---------- the agents do their work ---------- */
  let r = pa(['connect', file], { json: true });
  const build = r.json && r.json.identity.build, sha = r.json && r.json.identity.sha256;
  ok(r.code === 0 && r.json.live.ok && !r.json.panel, T(`connect (Build ${build}): the dashboard opens`), r.err.split('\n')[0]);
  const pristine = read(at('dashboard', 'atlas.html'));
  fs.copyFileSync(path.join(FX, 'brand.json'), at('content-strategist', 'brand.json'));   /* the made up brand the fixture pages are written for */
  pa(['plan', '--line', 'heat', '--budget', '9000', '--start', '2026-11-23', '--weeks', '10', '--zips', '75150,75149,75043', '--mix', 'google=50,lsa=20,meta=15,nextdoor=10,microsoft=5']);
  pa(['draft', at('paid-ads', 'drafts', 'plan-heat-2026-11-23.json')]);
  /* the library copy stands in for rewritten copy, with two claims added for the owner to answer */
  const campFile = at('paid-ads', 'drafts', 'campaign-heat-2026-11-23.json'), camp = J(campFile); delete camp.draft;
  camp.search[0].adGroups[0].ad.headlines.push('Same Day Furnace Repair', 'Free Second Opinion'); fs.writeFileSync(campFile, JSON.stringify(camp, null, 1));
  r = pa(['build', campFile]);
  const outDir = at('paid-ads', 'out', 'heat-2026-11-23'), copyName = `DFW_Thermal_Debt_Atlas_Build_${build}_Agent_Desk.html`, copy = at('dashboard', copyName);
  ok(r.code === 0 && new RegExp(`For the dashboard: open .*${copyName} and choose Agent Desk, the last module\\. This campaign is on it`).test(r.out) && /Opened headless to check it: the Agent Desk is module \d+ and lists 1 hand-off\./.test(r.out) && /By hand instead: Campaign Desk \(module 08\), ⤒ Load, choose .*campaign-desk-plan\.json/.test(r.out) && /handoff\.json/.test(r.out),
    T('build: the campaign is handed over to the Agent Desk, the copy of the dashboard is written and opened to see that it lists it, and the by hand route is still given'), r.err.split('\n')[0] || r.out.split('\n').slice(-6).join(' | '));
  const hb = fs.existsSync(path.join(outDir, 'handoff.json')) ? J(path.join(outDir, 'handoff.json')) : {}, planFile = J(path.join(outDir, 'campaign-desk-plan.json')), report = J(path.join(outDir, 'report.json')); delete planFile.handoff;
  ok(isBundle(hb) && hb.format === BUNDLE && hb.id === 'paid:heat-2026-11-23' && hb.agent === 'paid-ads-specialist' && hb.atlas.build === build && hb.atlas.sha256 === sha.slice(0, 16) && JSON.stringify(hb.paid.plan) === JSON.stringify(planFile) && hb.paid.summary.markets === 3 && hb.paid.markets.length === 3 && hb.paid.search.length === 2 && hb.paid.before.length >= 5 && hb.paid.running.length >= 4,
    T('handoff.json is the whole campaign as one file: the plan the desk loads, the markets, the copy, and the two lists a person acts on'));
  const made = fs.readdirSync(outDir).filter(n => n !== 'handoff.json').sort(), carried = hb.paid.files.map(f => f.name).sort();
  ok(JSON.stringify(made) === JSON.stringify(carried) && hb.paid.files.every(f => typeof f.text === 'string' && f.text === read(path.join(outDir, f.name)) && f.what) && hb.paid.files[0].name === 'README.md' && report.files.includes('handoff.json') && /`handoff\.json`: This whole folder as one file for the Agent Desk/.test(read(path.join(outDir, 'README.md'))) && read(path.join(outDir, 'README.md')).includes(`the dashboard copy named \`${copyName}\``),
    T('it carries every file of the folder, each with its text and what it is for, and the README says where the Agent Desk is'), carried.join(' '));
  ok(hb.paid.claims.some(c => /same day/i.test(c.said) && c.status === 'unconfirmed') && hb.paid.claims.some(c => /^free/i.test(c.said) && c.status === 'unconfirmed') && hb.paid.claims.every(c => c.where && c.in) && hb.paid.checked.dashboard.ran === true && hb.paid.checked.dashboard.desk.accepted === true,
    T('with every claim nobody has vouched for, where it is, and what the running dashboard made of the campaign when it was built'));

  ok(cs(['sitemap', path.join(FX, 'sitemap.xml')]).code === 0 && cs(['build', path.join(FX, 'landing.md'), '--date', '2026-11-14']).code === 0 && cs(['build', path.join(FX, 'blog.md'), '--date', '2026-11-14']).code === 0, T('two pages pass the content gate'));
  r = cs(['handoff']);
  const cb = fs.existsSync(at('content-strategist', 'out', 'handoff.json')) ? J(at('content-strategist', 'out', 'handoff.json')) : {};
  ok(r.code === 0 && /^2 pages {2}-> /.test(r.out) && /^Hand-off {2}-> .*handoff\.json$/m.test(r.out) && /These pages are on it, with what the gate measured, and one button sends them to Publish\./.test(r.out) && /Opened headless to check it: the Agent Desk is module \d+ and lists 2 hand-offs\./.test(r.out) && /By hand instead: Publish \(module 16\), "What to publish", Import\. Drop .*pages-for-publish\.json on the box\./.test(r.out) && /Tried on the running dashboard: ACCEPTED by Publish/.test(r.out),
    T('handoff: the pages are handed over to the Agent Desk as well, and the copy now lists both hand-offs'), r.err.split('\n')[0] || r.out.split('\n').slice(0, 5).join(' | '));
  ok(isBundle(cb) && cb.id === 'content:pages' && cb.agent === 'content-strategist' && cb.content.pages.length === 2 && cb.content.info.length === 2 && cb.content.info.every(i => i.words > 100 && i.grade > 0 && i.grade <= 9 && i.keyword && i.url && i.schemaTypes.length && Array.isArray(i.warnings)) && cb.content.checked.dashboard.ran === true && cb.content.checked.dashboard.accepted === true,
    T('its hand-off carries the blueprints Publish compiles and what the gate measured for each page'));

  r = lk(['panel'], { json: true });
  ok(r.code === 0 && r.json.ok && r.json.file === copy && r.json.bundles.length === 2 && r.json.bundles[0].kind === 'content' && r.json.bundles[1].kind === 'paid' && r.json.opened.present && r.json.opened.tab && r.json.opened.errors.length === 0 && r.json.slimmed.length === 0 && r.json.leftOut.length === 0 && r.json.modules.length === 1 && r.json.modules[0].key === 'strategist' && r.json.opened.extra.length === 1 && r.json.opened.extra[0].present && r.json.opened.extra[0].tab && !r.json.opened.extra[0].failed && r.json.opened.extra[0].state.works > 0, T('panel: the copy holds both hand-offs, newest first, and opens with the Agent Desk in its rail and the content strategist\'s own module after it'), r.err.split('\n')[0]);
  ok(stripPanel(read(copy)) === pristine && read(at('dashboard', 'atlas.html')) === pristine && (path.resolve(file) === at('dashboard', 'atlas.html') || read(file) === pristine), T('take the Agent Desk out of the copy and what is left is the connected dashboard, byte for byte; the connected file itself was never written to'));

  /* ---------- the copy, opened and driven ---------- */
  const s = await live.open(copy);
  try {
    const { page } = s; await page.setViewportSize({ width: 1440, height: 1000 });
    const p0 = await live.panel(s), mods = await page.evaluate(() => MODS.map(m => m.key));
    ok(p0.present && p0.tab && p0.shown && !p0.failed && p0.errors.length === 0 && p0.handoffs.length === 2 && p0.handoffs.every(h => h.origin === 'file' && h.state === 'new') && p0.num === String(mods.indexOf('agents') + 1).padStart(2, '0') && mods.slice(mods.indexOf('agents')).join() === 'agents,strategist', T(`the Agent Desk is module ${p0.num} of ${mods.length}, after the dashboard's own, and lists what the agents handed over; the content strategist's own module follows it`), p0.errors[0]);
    ok(await page.evaluate(() => location.hash === '#agents' && /Agent Desk/.test(document.querySelector('#tab-agents').textContent) && document.querySelector('#tab-agents').getAttribute('aria-selected') === 'true' && !!document.querySelector('#mod-agents .mast h1')), T('it has its tab in the rail, its address, and the dashboard\'s own masthead'));

    /* a campaign */
    await pick(page, hb.id);
    ok(await page.evaluate(() => [...document.querySelectorAll('#lvpTabs button')].map(b => b.dataset.v).join()) === 'plan,copy,claims,launch,files' && /\$9,000/.test(await text(page, '.lvp-kpis')) && (await page.$$('.lvp-tall tbody tr')).length === 3, T('a campaign opens on its plan: the money, the markets, the forecast by platform'));
    await tab(page, 'copy');
    const adsShown = await page.evaluate(() => { const ads = [...document.querySelectorAll('.lvp-ad')]; return { n: ads.length, flagged: ads.filter(a => a.querySelector('summary .pill')).length, lines: document.querySelectorAll('.lvp-ad .lvp-line').length }; });
    const groups = hb.paid.search.reduce((n, c) => n + c.adGroups.length, 0);
    ok(adsShown.n === groups + hb.paid.ads.length && adsShown.flagged >= groups && adsShown.lines > 20, T(`Ad copy: all ${adsShown.n} ads are there, and every search ad carries the verdict of the dashboard's own rules`), adsShown);
    /* the verdict shown is the dashboard's own, asked directly */
    const sameScreen = await page.evaluate(b => { const g = b.paid.search[0].adGroups[0], texts = g.ad.headlines.concat(g.ad.descriptions).map(x => (typeof x === 'string' ? x : x.text)); const own = satchelLint(texts.join(' \n '), { lic: b.paid.plan.lic, needLic: true, platform: 'google' }).map(x => x.rule.id).sort(); const shown = [...document.querySelector('.lvp-ad summary').querySelectorAll('.pill')].map(p => p.textContent.trim()); return { own, shown }; }, hb);
    ok(sameScreen.own.every(id => sameScreen.shown.includes(id)) && (sameScreen.own.length > 0 || /clean by this dashboard's rules/i.test(sameScreen.shown.join(' '))), T('and that verdict is what the dashboard\'s own screen gives for the same lines'), sameScreen);

    await tab(page, 'claims');
    const claimKeys = await page.evaluate(() => [...document.querySelectorAll('.lvp-claim')].map(c => c.dataset.k));
    const sameDay = claimKeys.find(k => /same day/i.test(k)), free = claimKeys.find(k => /\|free/i.test(k));
    ok(claimKeys.length >= 2 && sameDay && free && await page.evaluate(() => document.querySelector('#lvpAns').disabled), T(`Claims: the ${claimKeys.length} claims nobody has vouched for wait for an answer, and nothing can be saved before one is given`));
    await page.click(`.lvp-claim[data-k="${sameDay}"] .lvp-dec button[data-d="confirm"]`);
    await page.fill(`.lvp-claim[data-k="${sameDay}"] input[data-f="terms"]`, 'for calls before 2 pm, Monday to Saturday');
    await page.click(`.lvp-claim[data-k="${free}"] .lvp-dec button[data-d="cut"]`);
    ok(await page.evaluate(() => document.querySelector('#lvpAns').disabled && /Add your name/.test(document.querySelector('#lvpAnsNote').textContent)), T('a confirmation with no name behind it cannot be saved'));
    await page.fill('#lvpWho', 'Pat Example'); await page.click('#lvpAns');
    const ans = JSON.parse((await saved(page)).filter(f => f.name === 'owner-answers.json').pop().text);
    ok(ans.format === ANSWERS && ans.handoff === hb.id && ans.answers.length === 2 && ans.answers.some(a => a.decision === 'confirm' && /same day/i.test(a.claim) && a.by === 'Pat Example' && /^\d{4}-\d{2}-\d{2}$/.test(a.on) && /2 pm/.test(a.terms)) && ans.answers.some(a => a.decision === 'cut' && /^free/i.test(a.claim) && !a.by), T('the answers save as a file: what was confirmed, by whom, on what day and in what terms, and what to cut'));

    await tab(page, 'launch');
    ok(await page.evaluate(() => document.querySelectorAll('.lvp-check li').length) >= 9 && (await page.$$('.lvp-find tbody tr')).length > 0 && /Checked against the running dashboard when it was built/.test(await text(page, '#lvpTab')), T('Before launch: the checks to make before anything is switched on, what the gate left in, and how to run it'));
    await tab(page, 'files');
    await page.click('[data-file="0"]'); await page.click('#lvpZip');
    const sv = await saved(page);
    ok((await page.$$('[data-file]')).length === hb.paid.files.length && sv.some(f => f.name === 'README.md' && f.text === read(path.join(outDir, 'README.md'))) && sv.some(f => /^heat-2026-11-23\.zip$/.test(f.name)), T('Files: every file of the folder can be saved from the dashboard, one at a time or as a zip'));

    /* the plan, to the Campaign Desk */
    await tab(page, 'plan'); await page.click('#lvpApply');
    ok(await page.evaluate(() => !!document.querySelector('#lvpGo') && !!document.querySelector('#lvpKeep') && /This replaces the plan on the Campaign Desk/.test(document.querySelector('#mod-agents').textContent)) && (await hand(page, hb.id)).state === 'new', T('loading a plan asks first, because it replaces the one the desk holds'));
    await page.click('#lvpKeep');
    const kept = (await saved(page)).filter(f => f.name === 'campaign-desk-plan.json').pop();
    ok(kept && typeof JSON.parse(kept.text).line === 'string', T('and offers the desk\'s own Save for the plan that is there'));
    await page.click('#lvpNo'); ok(!(await page.$('#lvpGo')) && (await hand(page, hb.id)).state === 'new', T('Cancel leaves the desk alone'));
    await page.click('#lvpApply'); await page.click('#lvpGo'); await toastSays(page, /holds this plan|does not hold/);
    const h1 = await hand(page, hb.id), deskPlan = await page.evaluate(() => MODI.desk.plan()), agrees = report.dashboard.desk.agrees;
    ok(h1.state === 'held' && h1.applied.ok && h1.applied.how === 'load' && h1.applied.diffs.length === 0 && deskPlan.line === 'heat' && deskPlan.budget === 9000 && deskPlan.start === '2026-11-23' && deskPlan.weeks === 10 && deskPlan.zips.slice().sort().join() === '75043,75149,75150', T('Replace: the plan goes in through the Campaign Desk\'s own Load, and the desk, asked directly, holds it'), h1.applied.why || h1.applied.diffs);
    const said = await text(page, '#mod-agents .callout.lvp-ok');
    ok(/The desk took this plan .* and holds it now/.test(said) && (agrees ? /the same as the specialist reckoned/.test(said) : /quote the desk's figures/.test(said)) && /on the Campaign Desk/i.test(await text(page, `.lvp-item[data-id="${hb.id}"] .lvp-s`)), T(agrees ? 'the panel says so, and that the desk\'s forecast is the specialist\'s' : 'the panel says so, and that the desk\'s forecast is not the specialist\'s: quote the desk\'s'), said.slice(0, 200));
    /* the person changes the desk afterwards: the panel must not go on saying the desk holds this plan */
    const other = at('another-plan.json'); fs.writeFileSync(other, JSON.stringify({ line: 'heat', budget: 5000, start: '2026-11-23', weeks: 10 }));
    const loaded = await live.desk(s, other); await page.evaluate(() => showModule('agents'));
    const h2 = await hand(page, hb.id);
    ok(loaded.accepted && loaded.plan.budget === 5000, T('(another plan is loaded on the desk by hand, through its own Load)'), loaded.verdict);
    ok(h2.state === 'moved' && /the desk has changed since/i.test(await text(page, `.lvp-item[data-id="${hb.id}"] .lvp-s`)) && /monthly budget: the plan says 9000, the desk holds 5000/.test(await text(page, '#mod-agents .callout.judg')), T('when the desk is changed afterwards, the panel says the desk has changed and how, instead of repeating what it did'));
    await page.click('#lvpApply'); await page.click('#lvpGo'); await toastSays(page, /holds this plan/);
    ok((await hand(page, hb.id)).state === 'held', T('and loading it again puts the plan back'));

    /* pages, to Publish */
    await pick(page, cb.id);
    ok(/2/.test(await text(page, '.lvp-kpis .kv')) && (await page.$$('.lvp-pages tbody tr')).length === 2 && /ac-repair-plano-tx/.test(await text(page, '.lvp-pages')), T('pages open with what the gate measured: words, reading grade, schema, what was left in'));
    await page.click('#lvpSend'); await toastSays(page, /in Publish|did not take/);
    const c1 = await hand(page, cb.id), inPublish = await page.evaluate(() => MODI.publish.pages().map(p => ({ slug: p.slug, status: p.status, kind: p.kind })));
    ok(c1.state === 'held' && c1.applied.ok && c1.applied.listed.length === 2 && inPublish.length === 2 && inPublish.every(p => p.status === 'draft' && p.kind === 'blueprint') && inPublish.some(p => p.slug === 'ac-repair-plano-tx'), T('Send: the pages go onto Publish\'s own import box, are compiled there, and Publish, asked directly, lists both as drafts'), c1.applied.why);
    await page.click('#lvpSend');
    ok(await page.evaluate(() => /Publish already holds some of these/.test(document.querySelector('#mod-agents').textContent) && !!document.querySelector('#lvpGo')), T('sending again asks first, because it replaces pages Publish already holds'));
    await page.click('#lvpGo'); await toastSays(page, /in Publish/);
    ok((await hand(page, cb.id)).state === 'held' && (await page.evaluate(() => MODI.publish.pages().length)) === 2, T('and replaces them, without doubling them'));

    /* after the page is closed and opened again */
    await reload(page);
    const afterPaid = await hand(page, hb.id), afterContent = await hand(page, cb.id);
    ok(afterPaid.state === 'held' && afterContent.state === 'gone' && /sent before, not in Publish now/i.test(await text(page, `.lvp-item[data-id="${cb.id}"] .lvp-s`)), T('after a reload the plan is still on the desk, which keeps it, and the pages are said to be gone from Publish, which does not keep pages'));
    await pick(page, hb.id); await tab(page, 'claims');
    ok(await page.evaluate(k => document.querySelector(`.lvp-claim[data-k="${k}"] .lvp-dec button[data-d="confirm"]`).getAttribute('aria-pressed') === 'true' && document.querySelector('#lvpWho').value === 'Pat Example', sameDay), T('the owner\'s answers so far are still there'));

    /* every other module still opens, with the same errors as without the panel (none) */
    const errs = await page.evaluate(async () => { const out = []; for (const m of MODS) { try { showModule(m.key); } catch (e) { out.push(m.key + ': ' + e.message); } await new Promise(r => setTimeout(r, 60)); if (/This module failed to load/.test(document.querySelector('#mod-' + m.key).textContent)) out.push(m.key + ' failed to load'); } return out; });
    ok(errs.length === 0 && s.errors.length === 0, T(`all ${mods.length} modules of the copy open, and the page raised no error from start to finish`), errs.concat(s.errors).slice(0, 3));
  } finally { await s.close(); }

  /* ---------- the owner's answers, back to the specialist ---------- */
  const ansFile = at('owner-answers.json');
  fs.writeFileSync(ansFile, JSON.stringify({ format: ANSWERS, v: 1, handoff: hb.id, campaign: hb.title, made: new Date().toISOString(), answers: [{ claim: 'Same Day', type: 'response', decision: 'confirm', by: 'Pat Example', on: '2026-11-15', terms: 'for calls before 2 pm, Monday to Saturday' }, { claim: 'Free Second Opinion', type: 'free', decision: 'cut' }] }));
  r = pa(['answers', ansFile, campFile]);
  const after = J(campFile), rec = (after.confirmed || []).find(x => /same day/i.test(x.claim));
  ok(/2 answers|1 confirmed, 1 to cut/.test(r.out) && rec && rec.by === 'Pat Example' && rec.on === '2026-11-15' && /2 pm/.test(rec.terms) && rec.from === 'the Agent Desk' && /"Same Day" {2}by Pat Example: the gate takes it/.test(r.out) && /To cut\./.test(r.out) && /"Free Second Opinion" {2}in search EN · .*: Free Second Opinion/.test(r.out) && after.search[0].adGroups[0].ad.headlines.includes('Free Second Opinion'),
    T('answers: the confirmation is recorded in the campaign file in the owner\'s words, and the claim to cut is listed with the line that carries it, which is left for the writer'), r.err.split('\n')[0] || r.out.split('\n').slice(0, 6).join(' | '));
  r = pa(['lint', campFile], { json: true });
  ok(r.json && r.json.claims.filter(c => /same day/i.test(c.said)).every(c => c.status === 'confirmed') && r.json.claims.some(c => /^free/i.test(c.said) && c.status === 'unconfirmed'), T('the gate then takes the confirmed claim and still waits on the other'));

  /* ---------- a copy with nothing in it: hand-offs opened by hand ---------- */
  const empty = at('empty.html'); fs.writeFileSync(empty, installPanel(pristine, { bundles: [], atlas: hb.atlas }));
  const hostile = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
  const s2 = await live.open(empty);
  try {
    const { page } = s2; await page.evaluate(() => showModule('agents'));
    ok((await page.evaluate(() => MODI.agents.handoffs().length)) === 0 && /How work arrives/.test(await text(page, '#mod-agents')) && /0/.test(await text(page, '#mod-agents .mast .meta')), T('a copy with no hand-off in it says how work arrives'));
    const waitN = n => page.waitForFunction(n => MODI.agents.handoffs().length === n, n, { timeout: 15000 });
    await page.setInputFiles('#lvpFile', [path.join(outDir, 'handoff.json'), path.join(outDir, 'campaign-desk-plan.json'), path.join(outDir, 'campaign.json')]); await waitN(1);
    let list = await page.evaluate(() => MODI.agents.handoffs());
    ok(list.length === 1 && list[0].id === hb.id && list[0].origin === 'opened' && /opened/.test(await text(page, '#lvpLog')), T('a handoff.json chosen in the file box opens, and the plan file beside it, which it already carries, is not listed twice'), list.map(h => h.id));
    await page.setInputFiles('#lvpFile', at('content-strategist', 'out', 'pages-for-publish.json')); await waitN(2);
    list = await page.evaluate(() => MODI.agents.handoffs());
    const bare = list.find(h => h.kind === 'content');
    ok(bare && bare.agent === 'content-strategist' && /^content:ac-frozen-coil\+ac-repair-plano-tx/.test(bare.id) && bare.title === '2 pages', T('a pages file on its own opens too, as the pages it holds'));
    /* a folder dropped on the box: walked for the files a hand-off could be in */
    await page.evaluate(f => {
      const fileE = (name, t) => ({ isFile: true, isDirectory: false, name, file: ok => ok(new File([t], name, { type: 'application/json' })) });
      const dirE = (name, kids) => ({ isFile: false, isDirectory: true, name, createReader: () => { let gave = false; return { readEntries: ok => { if (gave) ok([]); else { gave = true; ok(kids); } } }; } });
      const tree = dirE('out', [fileE('handoff.json', f.handoff), fileE('pages-for-publish.json', f.pages), dirE('ac-repair-plano-tx', [fileE('blueprint.json', f.blueprint), fileE('report.json', '{}')]), fileE('notes.txt', 'not a hand-off')]);
      document.querySelector('#lvpDrop').ondrop({ preventDefault() { }, dataTransfer: { items: [{ webkitGetAsEntry: () => tree }], files: [] } });
    }, { handoff: read(at('content-strategist', 'out', 'handoff.json')), pages: read(at('content-strategist', 'out', 'pages-for-publish.json')), blueprint: read(at('content-strategist', 'out', 'ac-repair-plano-tx', 'blueprint.json')) });
    await waitN(3);
    list = await page.evaluate(() => MODI.agents.handoffs());
    ok(list.length === 3 && list.filter(h => h.id === cb.id).length === 1 && list[0].id === cb.id, T('a folder dropped on the box is walked, its hand-off opens, and the pages file and blueprints the hand-off already carries add nothing'), list.map(h => h.id));
    const viaApi = await page.evaluate(id => MODI.agents.apply(id), hb.id);
    ok(viaApi.ok && viaApi.how === 'load' && (await hand(page, hb.id)).state === 'held', T('a hand-off opened by hand loads on the Campaign Desk like one that came with the file'), viaApi.why);
    await reload(page);
    list = await page.evaluate(() => MODI.agents.handoffs());
    await pick(page, hb.id); await tab(page, 'files');
    ok(list.length === 3 && list.every(h => h.origin === 'opened') && (await page.$$('[data-file]')).length === 0 && /not kept here/.test(await text(page, '#lvpTab')) && (await page.evaluate(() => JSON.stringify(localStorage.getItem('lv.agentdesk.v1')).length)) < 700000, T('hand-offs opened by hand are still there after a reload, without the text of their bulk files and within the panel\'s share of the browser\'s storage'));
    await page.click('#lvpForget');
    ok((await page.evaluate(() => MODI.agents.handoffs().length)) === 2 && !(await hand(page, hb.id)), T('Forget it takes a hand-opened hand-off away again'));
    await page.setInputFiles('#lvpFile', path.join(outDir, 'campaign-desk-plan.json')); await waitN(3);
    const lone = (await page.evaluate(() => MODI.agents.handoffs())).find(h => h.kind === 'paid');
    ok(lone && lone.id === 'paid:plan:heat:2026-11-23' && lone.title === hb.title && (await page.evaluate(id => MODI.agents.apply(id), lone.id)).ok, T('a desk plan file on its own opens as a plan and loads'));
    await page.setInputFiles('#lvpFile', path.join(outDir, 'report.json')); await page.waitForFunction(() => /No hand-off in what was chosen/.test(document.querySelector('#lvpLog').textContent));
    ok((await page.evaluate(() => MODI.agents.handoffs().length)) === 3, T('a file that is no hand-off is said to be none, and nothing changes'));

    /* text from a hand-off never becomes markup */
    const evil = JSON.parse(JSON.stringify(hb)); evil.id = 'paid:evil'; evil.title = hostile; evil.agent = hostile; evil.atlas.build = hostile; evil.made = '2099-01-01T00:00:00.000Z';
    Object.assign(evil.paid.summary, { lineLabel: hostile, pacedBy: hostile, deskModel: hostile, start: hostile, end: hostile, angles: [hostile], extra: [{ name: hostile, monthly: 5 }], extraTotal: 5, heat: { month: hostile, zips: 3, spent: 1, leads: 1, jobs: 1, costPerJob: 1, grade: hostile, same: false } });
    evil.paid.summary.mix[0].label = hostile; evil.paid.summary.mix[0].basis = hostile; evil.paid.summary.mix[0].grade = hostile; evil.paid.summary.flight.forEach(f => { f.month = hostile; });
    evil.paid.markets[0] = Object.assign({}, evil.paid.markets[0], { zip: hostile, city: hostile, county: hostile, angles: [hostile] });
    const g0 = evil.paid.search[0].adGroups[0]; g0.name = hostile; g0.ad.headlines[0] = hostile; g0.ad.headlines[1] = { text: hostile, pin: hostile }; g0.ad.url = hostile; g0.keywords[0] = { text: hostile, match: hostile };
    evil.paid.search[0].bidding = hostile; evil.paid.search[0].callouts = [hostile]; evil.paid.search[0].sitelinks = [{ text: hostile, d1: hostile, d2: hostile, path: hostile }]; evil.paid.search[0].snippets = { header: hostile, values: [hostile] }; evil.paid.search[0].negatives = [hostile];
    evil.paid.ads.push({ channel: hostile, format: hostile, name: hostile, cta: hostile, url: hostile, jobTypes: [hostile], [hostile]: hostile, body: hostile }); evil.paid.channels = { [hostile]: hostile };
    evil.paid.claims = [{ type: hostile, said: hostile, status: 'unconfirmed', detail: hostile, where: hostile, in: hostile }, { type: 'reviews', said: hostile + '2', status: 'contradicts', detail: hostile, where: hostile, in: hostile }, { type: 'price', said: hostile + '3', status: 'confirmed', detail: hostile, where: hostile, in: hostile }];
    evil.paid.findings = [{ severity: hostile, rule: hostile, where: hostile, message: hostile, excerpt: hostile }, { severity: 'warn', rule: hostile, where: hostile, message: hostile + '2', excerpt: hostile }]; evil.paid.allowed = [hostile]; evil.paid.before = [hostile]; evil.paid.running = [hostile];
    evil.paid.checked = { dashboard: { ran: false, why: hostile }, landing: null }; evil.paid.files = [{ name: hostile, what: hostile, text: 'x' }];
    const evilPages = JSON.parse(JSON.stringify(cb)); evilPages.id = 'content:evil'; evilPages.title = hostile; evilPages.made = '2099-01-02T00:00:00.000Z';
    Object.assign(evilPages.content.pages[0].page, { h1: hostile, title: hostile, meta_description: hostile, archetype: hostile }); evilPages.content.info[0] = Object.assign({}, evilPages.content.info[0], { type: hostile, keyword: hostile, url: 'javascript:' + hostile, schemaTypes: [hostile], warnings: [hostile] }); evilPages.content.checked = { dashboard: { ran: true, accepted: false, verdict: hostile } };
    await page.evaluate(b => MODI.agents.receive({ bundle: b }), evil);
    for (const v of ['plan', 'copy', 'claims', 'launch', 'files']) { await tab(page, v); if (v === 'copy') await page.evaluate(() => document.querySelectorAll('.lvp-ad').forEach(d => { d.open = true; })); if (v === 'claims') { await page.click('.lvp-claim .lvp-dec button[data-d="confirm"]'); } }
    await page.evaluate(b => MODI.agents.receive({ bundle: b }), evilPages);
    /* and neither does what this browser's storage holds, whatever put it there */
    await page.evaluate(h => { const st = JSON.parse(localStorage.getItem('lv.agentdesk.v1')); st.applied['paid:evil'] = { at: h, made: h, ok: false, why: h, diffs: [h], kpis: { 'Leads a month': h, 'Booked jobs': h }, held: { line: h, start: h } }; st.applied['content:evil'] = { at: '2026-01-01T00:00:00Z', ok: false, why: h, verdict: h, listed: [{ slug: h, block: h, warn: h }] }; st.who = h; st.answers['paid:evil'] = { [h]: { decision: 'confirm', terms: h, basis: h } }; localStorage.setItem('lv.agentdesk.v1', JSON.stringify(st)); }, hostile);
    await reload(page); await pick(page, 'paid:evil'); for (const v of ['plan', 'claims', 'launch']) await tab(page, v); await pick(page, 'content:evil');
    const inj = await injected(page);
    ok(inj.ran === 0 && inj.nodes === 0 && (await text(page, '#mod-agents')).includes('<img src=x onerror=') && s2.errors.length === 0, T('a hand-off whose every line is an image tag with a handler shows as text on every tab, and so does the same text put into this browser\'s storage: nothing loads, nothing runs'), inj);
  } finally { await s2.close(); }

  /* ---------- the copy is the same dashboard to connect ---------- */
  const two = sandbox({ live: false });
  r = run(PA, ['connect', copy], two.env, { json: true });
  ok(r.code === 0 && r.json.identity.sha256 === sha && r.json.panel && r.json.panel.carried === 2 && r.json.panel.kept === 2 && read(path.join(two.home, 'dashboard', 'atlas.html')) === pristine && fs.readdirSync(path.join(two.home, 'dashboard', 'handoffs')).length === 2, T('connect takes the copy as the dashboard it is: the same fingerprint, the Agent Desk taken out of the kept file, and the hand-offs inside it put on file'), r.err.split('\n')[0]);
  r = run(LK, ['panel'], two.env, { json: true });
  ok(r.code === 0 && r.json.bundles.length === 2 && r.json.notOpened === 'LEVIATHAN_NO_LIVE is set' && stripPanel(read(r.json.file)) === pristine, T('and writes its own copy again with those hand-offs in it'));
}
ok(gitState() === before, 'the repository is as it was: nothing a command wrote landed in it');
done();
