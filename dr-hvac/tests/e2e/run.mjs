/* End to end run of Dr. HVAC inside the built atlas, in headless Chromium (Playwright), against a scripted stand in
   for the Claude API. Nothing here reaches Anthropic or a website: api.anthropic.com is answered by this file, with
   the same event streams the Messages API sends, and each scripted reply is written the way a model would write it,
   from the tool results in the request it answers.

     node tests/e2e/run.mjs --html <built single file> [--app <built browser app .zip or folder>] [--shots <folder>]

   The built atlas is not in this repository (it carries the client's data), so the paths are arguments; with none
   given the run is skipped. Screenshots show the client's brand, so --shots must be outside the repository too.

   Single file edition
     1. Loads from disk with no console or page error; nineteen modules; the footer names Build 6.
     2. No key: the module says so. Settings: a wrong key is refused by "Test the key", the right one is accepted and saved.
     3. A landing page, start to finish: the model reads the atlas, writes a blueprint from the facts it was given,
        runs the checks and reports in Markdown. Checked: the request (model, tools, system prompt, the dashboard state
        block, the module the person came from), every tool result going back, the tool cards, the rendered reply,
        the page in the workbench preview, the audit, and the handoff to the Publish module.
     4. Gates: a live change raises a red approval card and "No" stops it; a draft write raises its own card, and
        approving it runs the tool, which reports that no WordPress site is connected.
     5. An Elementor template attached as a file: loaded, edited slot by slot, a compiled section inserted, turned
        into a page. A question card (ask_user) is answered by a click.
     6. A hosting move: the runbook lands in the Files tab and downloads; the connector plugin downloads as a zip
        whose PHP passes `php -l` when PHP is installed.
     7. An API failure is shown as a note and leaves the conversation usable.
     8. A reload brings back the conversation, its usage and the workshop; History lists both conversations.
     9. At phone width nothing overflows and the header button is the way in.
   Browser app (when --app is given)
    10. The unpacked extension loads; the page runs under its script-src 'self' policy with no violation; the agent
        answers through the same SDK; settings land in extension storage; a website the extension has no access to
        raises the site access card; the popup lists module 19 and has the Ask Dr. HVAC button. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { messageEvents } from '../lib/load.mjs';
import { readZip } from '../../lib/zip.mjs';
import { checkOut, readApp } from '../../build.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = {}; { const a = process.argv.slice(2); for (let i = 0; i < a.length; i++) { const m = /^--(html|app|shots)(?:=(.*))?$/.exec(a[i]); if (!m) { console.error('Unknown argument: ' + a[i]); process.exit(2); } args[m[1]] = m[2] != null ? m[2] : a[++i]; } }
const HTML = args.html || process.env.DRHVAC_E2E_HTML || '', APP = args.app || process.env.DRHVAC_E2E_APP || '';
if (!HTML && !APP) { console.log('e2e skipped: give --html <built single file> and/or --app <built browser app> (build them with build.mjs, outside the repository).'); process.exit(0); }
const SHOTS = checkOut(args.shots || fs.mkdtempSync(path.join(os.tmpdir(), 'drhvac-e2e-')));
fs.mkdirSync(SHOTS, { recursive: true });
let chromium; try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch (e) { ({ chromium } = await import('playwright')); }

const checks = []; let failed = 0;
const ok = (cond, label, extra) => { checks.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== undefined && (!cond || process.env.VERBOSE) ? '  (' + String(extra).replace(/\s+/g, ' ').slice(0, 400) + ')' : ''}`); if (!cond) failed++; return !!cond; };
const section = t => checks.push('\n' + t);
const KEY = 'sk-ant-e2e-0000', FIXTURE = path.join(HERE, '..', 'fixture', 'elementor-service-landing.json');
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const text = t => ({ type: 'text', text: t });

/* ---------- the stand in for api.anthropic.com ---------- */
function claude(script = []) {
  const calls = []; const problems = [];
  const sse = events => events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  const handler = async route => {
    const req = route.request(), url = new URL(req.url()), n = calls.length + 1;
    const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': '*', 'request-id': 'req_e2e_' + n };
    try {
      if (req.method() === 'OPTIONS') return await route.fulfill({ status: 204, headers: Object.assign({ 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' }, cors) });
      const key = (req.headers().authorization || '').replace(/^Bearer\s+/i, '') || req.headers()['x-api-key'] || '';
      if (key !== KEY) return await route.fulfill({ status: 401, contentType: 'application/json', headers: cors, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
      if (req.method() === 'GET' && /^\/v1\/models\//.test(url.pathname)) return await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ type: 'model', id: url.pathname.split('/').pop(), display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' }) });
      if (req.method() === 'POST' && url.pathname === '/v1/messages') {
        const body = req.postDataJSON(); calls.push({ body, headers: req.headers() });
        const step = script.shift();
        if (!step) { problems.push('the script ran out at request ' + n); return await route.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'e2e: the script ran out' } }) }); }
        if (step.status) return await route.fulfill({ status: step.status, contentType: 'application/json', headers: cors, body: JSON.stringify({ type: 'error', error: { type: step.errType || 'overloaded_error', message: step.message || 'Overloaded' } }) });
        let blocks; try { blocks = typeof step === 'function' ? await step(body, calls) : (step.blocks || step); } catch (e) { problems.push(`request ${n}: the scripted reply could not be written: ${e.message}`); blocks = [text('The script failed: ' + e.message)]; }
        return await route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'text/event-stream' }, cors), body: sse(messageEvents(blocks, { usageStart: { input_tokens: 4200, cache_read_input_tokens: n > 1 ? 18000 : 0, cache_creation_input_tokens: n > 1 ? 600 : 18000 }, usageEnd: { output_tokens: 380 } })) });
      }
      return await route.fulfill({ status: 404, contentType: 'application/json', headers: cors, body: '{}' });
    } catch (e) { problems.push('route: ' + e.message); try { await route.abort(); } catch (x) { } }
  };
  return { handler, calls, problems, say: (...steps) => script.push(...steps), left: () => script.length };
}
/* what a tool sent back, read from the request the way the model reads it */
function resultOf(body, id) {
  for (const m of body.messages) if (m.role === 'user' && Array.isArray(m.content)) for (const b of m.content) if (b.type === 'tool_result' && b.tool_use_id === id) return { error: !!b.is_error, text: typeof b.content === 'string' ? b.content : (b.content || []).map(x => x.text || '').join('') };
  throw new Error('no tool_result for ' + id + ' in the request');
}
const jsonOf = (body, id) => JSON.parse(resultOf(body, id).text);
const lastUserText = body => { const m = body.messages[body.messages.length - 1]; return (Array.isArray(m.content) ? m.content : [{ type: 'text', text: m.content }]).filter(b => b.type === 'text').map(b => b.text).join('\n'); };

/* ---------- page helpers ---------- */
function watch(page, errors, ignore) {
  page.on('console', m => { if (m.type() !== 'error') return; const t = m.text(); if (ignore && ignore.test(t)) return; errors.push('console: ' + t.slice(0, 300)); });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.stack || e.message).slice(0, 400)));
}
/* requests to the public data sources the atlas refreshes may fail in a sandbox; they are not this test's subject */
const NOISE = /Failed to load resource|net::ERR_|ERR_TUNNEL|fonts\.g(oogleapis|static)|status of 40[134]|status of 500/;
async function hook(page) { await page.waitForFunction(() => window.DRHVAC && DRHVAC.agent && typeof MODI !== 'undefined' && MODI.drhvac, null, { timeout: 20000 }); await page.evaluate(() => { if (window.__dr) return; window.__dr = { turns: 0, ends: [] }; DRHVAC.bus.on('agent', e => { if (e.type === 'turn_end') { window.__dr.turns++; window.__dr.ends.push(e.end); } }); }); }
const turns = page => page.evaluate(() => window.__dr.turns);
/* the module is open and its storage has loaded */
const opened = page => page.waitForFunction(() => MODI.drhvac.mounted && DRHVAC.agent.current(), null, { timeout: 20000 });
async function sendAndWait(page, message, o = {}) {
  const before = await turns(page);
  await page.fill('#d19In', message); await page.click('#d19Send');
  if (o.during) await o.during();
  await page.waitForFunction(n => window.__dr.turns > n, before, { timeout: o.timeout || 30000 });
  await page.waitForTimeout(120);
}
const logText = page => page.evaluate(() => document.getElementById('d19Log').innerText);
const shot = async (page, name) => { try { await page.screenshot({ path: path.join(SHOTS, name), fullPage: false }); } catch (e) { } };

/* ---------- the scripted model: one conversation per job, each reply written from what the tools returned ---------- */
const landingScript = () => [
  [{ type: 'thinking', thinking: 'A furnace repair landing page for Frisco. Read the city and the furnace angle first.' }, text('I will read Frisco\'s numbers and the furnace angle before writing anything.'), use('tu_place', 'atlas_place', { city: 'Frisco' }), use('tu_angle', 'atlas_service', { angle: 'furnace' })],
  body => {
    const place = jsonOf(body, 'tu_place'), angle = jsonOf(body, 'tu_angle');
    const fact = k => place.printable_facts.find(f => f.key === k); const furn = fact('c_furn20'), gas = fact('c_gas');
    if (!furn || !gas || !angle.page_copy) throw new Error('the atlas did not return the facts the page needs');
    return [use('tu_create', 'page_create', { kind: 'blueprint', page: { slug: 'furnace-repair-frisco', title: 'Furnace Repair in Frisco, TX | Licensed Technicians', h1: 'Furnace Repair in Frisco, TX', meta_description: 'Furnace not lighting or blowing cold air in Frisco? A licensed technician checks the burners, flame sensor and heat exchanger and gives a written price first.', archetype: 'landing', noindex: true, summary: 'Furnace repair for Frisco homes with a written price before work starts.' }, sections: [
      { type: 'hero', h1: 'Furnace Repair in Frisco, TX', lede: 'No heat, a burner that will not light, or a furnace past 20 years. A licensed technician tells you plainly what it needs and gives you the price in writing first.', cta: ['primary', 'secondary'], trust: true, layout: 'center' },
      { type: 'answer', heading: 'How old are the furnaces in Frisco?', body: `An estimated ${furn.value} ${furn.label.replace(/^gas furnaces/, 'gas furnaces')}, and ${gas.value} ${gas.label}. A furnace that age should have its burners and heat exchanger checked before the first cold night.` },
      { type: 'key_facts', heading: 'Frisco heating at a glance', items: [furn, gas].map(f => ({ value: f.value, label: f.label, source: f.source })) },
      { type: 'steps', heading: 'What happens on a furnace repair visit', steps: [{ title: 'We listen first', text: 'Tell us what the furnace is doing and when it started.' }, { title: 'We test before we quote', text: 'Burners, igniter, flame sensor, venting and heat exchanger are checked.' }, { title: 'You get the price in writing', text: 'You approve the repair before any work starts.' }] },
      { type: 'faq', heading: 'Furnace questions from Frisco homeowners', items: [{ q: 'Why is my furnace blowing cold air?', a: 'The usual causes are a dirty flame sensor, a failed igniter or a tripped limit switch. A technician can tell which in one visit.' }, { q: 'Do you give a price before the repair?', a: 'Yes. You get the price in writing and approve it before work starts.' }, { q: 'Is a furnace that smells like gas safe to run?', a: 'No. Leave the house, call the gas utility from outside, and have the furnace inspected before it runs again.' }, { q: 'How often should a gas furnace be checked?', a: 'Once a year, before the heating season, and sooner if the flame is yellow or the furnace cycles on and off.' }] },
      { type: 'form', heading: 'Book a furnace repair in Frisco', text: 'Tell us what the furnace is doing and we will call you back to set a time.' }] })];
  },
  body => { const made = jsonOf(body, 'tu_create'); if (made.slug !== 'furnace-repair-frisco') throw new Error('page_create answered ' + JSON.stringify(made).slice(0, 200)); return [use('tu_check', 'page_check', { id: made.id })]; },
  body => { const c = jsonOf(body, 'tu_check'); return [text(`## The Frisco furnace page is ready to review\n\nIt is in the workbench preview on the right, as a **noindex** landing page at \`/furnace-repair-frisco/\`.\n\n- ${c.words} words, one h1, an answer block, four questions and the lead form\n- Audit score: **${c.audit.score} of 100** (${c.audit.counts.block} blocking, ${c.audit.counts.warn} warnings)\n- Every figure names its public source\n\n| Check | Result |\n| --- | --- |\n| Compliance | ${c.checks.block} blocking |\n| Verdict | ${c.verdict} |\n\n1. Read the preview\n2. Press *Send to Publish* when you are happy\n\nThe TDLR rule it follows is [16 TAC 75.71](https://www.law.cornell.edu/regulations/texas/16-Tex-Admin-Code-SS-75-71). A link like [this](javascript:alert(1)) is not made clickable, and <b>markup</b> in a reply is shown as text.`)]; },
];

const elementorScript = () => [
  body => { const m = /file id (\S+): "elementor-service-landing\.json"/.exec(lastUserText(body)); if (!m) throw new Error('the attached file is not listed in the message'); return [text('Loading the template you attached.'), use('tu_load', 'elementor_load', { source: 'file', file_id: m[1], name: 'Service landing' })]; },
  body => { const d = jsonOf(body, 'tu_load'); if (!d.valid) throw new Error('the template did not validate'); return [use('tu_ask', 'ask_user', { question: 'Which city is this page for?', options: ['Frisco', 'McKinney'] })]; },
  body => {
    const city = jsonOf(body, 'tu_ask').answer, doc = jsonOf(body, 'tu_load').doc; if (!city) throw new Error('no city was chosen');
    return [use('tu_edit', 'elementor_edit', { doc, ops: [{ op: 'replace_text', find: 'Plano', replace: city }, { op: 'set', ref: 'a1b2c303.title', value: `Furnace Repair in ${city}, TX` }, { op: 'replace_text', find: 'AC repair', replace: 'furnace repair' }, { op: 'set', ref: 'a1b2c305.text', value: 'Book furnace repair' },
      { op: 'insert_section', after: 'b1b2c301', section: { type: 'steps', heading: 'How a furnace visit works', steps: [{ title: 'We listen', text: 'Tell us what the furnace is doing.' }, { title: 'We test', text: 'Burners, igniter and heat exchanger are checked.' }, { title: 'You approve the price', text: 'In writing, before any work starts.' }] } }] })];
  },
  body => { const e = jsonOf(body, 'tu_edit'), doc = jsonOf(body, 'tu_load').doc; if (!e.valid || e.changed < 5) throw new Error('the edit did not apply: ' + JSON.stringify(e.log)); return [use('tu_page', 'elementor_to_page', { doc, page: { slug: 'furnace-repair-frisco-template', title: 'Furnace Repair in Frisco, TX', h1: 'Furnace Repair in Frisco, TX', meta_description: 'Furnace repair in Frisco from licensed technicians who put the price in writing before any work starts. Call or book a visit online today.', noindex: true }, detach_media: true })]; },
  body => { const p = jsonOf(body, 'tu_page'); return [text(`The page **${p.title}** is built on your template and is in the preview. The template shows a placeholder license number, so the brand's own number still has to go on the page before it is published.`)]; },
];

/* =================================================================================================================== */
const browser = HTML ? await chromium.launch() : null;
if (HTML) {
  const file = path.resolve(HTML); const raw = fs.readFileSync(file, 'utf8');
  section('Single file edition: ' + path.basename(file));
  ok(/Build 6<\/title>/.test(raw.slice(0, 2000)) && raw.includes('<!-- drhvac:js') && raw.includes('/* ==== src/33_m19_drhvac.js ==== */'), 'the file is the Build 6 single file with the Dr. HVAC blocks');
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: Number(process.env.DRHVAC_E2E_DPR) || 1, acceptDownloads: true });   /* DRHVAC_E2E_DPR=2 for screenshots a person will look at */
  const api = claude(); await context.route('https://api.anthropic.com/**', api.handler);
  const page = await context.newPage(); const errors = []; watch(page, errors, NOISE);
  try {

  /* 1. loads */
  await page.goto('file://' + file + '#index', { waitUntil: 'load' }); await hook(page);
  const boot = await page.evaluate(() => ({ tabs: document.querySelectorAll('#rail button').length, tab: !!document.getElementById('tab-drhvac'), btn: !!document.getElementById('drBtn'), btnShown: getComputedStyle(document.getElementById('drBtn')).display !== 'none', env: DRHVAC.ENV, tools: DRHVAC.tools.list().length, sdk: (window.AnthropicSDK || {}).VERSION, foot: document.querySelector('.shell-foot').textContent, mounted: !!MODI.drhvac.mounted, first: MODS[0].key, num: MODI.drhvac.num }));
  ok(boot.tabs === 19 && boot.tab && boot.num === '19' && boot.first === 'index', 'nineteen modules in the rail, Dr. HVAC the nineteenth', JSON.stringify(boot).slice(0, 200));
  ok(boot.env === 'file' && boot.tools === 50 && /^\d+\.\d+\.\d+$/.test(boot.sdk || ''), 'the agent, its 50 tools and the Claude SDK are loaded from the one file', `${boot.env} ${boot.tools} ${boot.sdk}`);
  ok(/Build 6 November 14, 2026 adds Dr\. HVAC/.test(boot.foot) && /Build 5 November 13, 2026/.test(boot.foot), 'the footer keeps the build history and adds Build 6');
  ok(boot.mounted === false && boot.btn && boot.btnShown === false, 'the module does no work until it is opened; on a wide screen the tab is the way in');

  /* 2. no key, settings */
  await page.click('#tab-drhvac'); await opened(page); await page.waitForSelector('#d19Log .dr-empty');
  ok(/Connect Dr\. HVAC to Claude first/.test(await logText(page)) && await page.isDisabled('#d19Send') === false, 'with no key the conversation says what is missing');
  await page.click('#d19Log [data-open-settings]'); await page.waitForSelector('#d19SetPanel');
  await page.fill('#d19Key', 'sk-ant-wrong'); await page.click('#d19KeyTest'); await page.waitForFunction(() => /not accepted|rejected|invalid|401|key/i.test(document.getElementById('d19KeyMsg').textContent) && !document.getElementById('d19KeyTest').disabled);
  const bad = await page.textContent('#d19KeyMsg'); ok(!/works/.test(bad), 'a wrong key is refused by Test the key, in words', bad);
  await page.fill('#d19Key', KEY); await page.click('#d19KeyTest'); await page.waitForFunction(() => /works/.test(document.getElementById('d19KeyMsg').textContent));
  ok(/The key works\. Claude Opus 5\.5 is available/.test(await page.textContent('#d19KeyMsg')), 'the right key is accepted');
  await page.click('#d19SetSave'); await page.waitForSelector('#d19SetPanel', { state: 'detached' });
  await page.waitForSelector('#d19Log .dr-starts button');
  const st = await page.evaluate(() => ({ starts: document.querySelectorAll('#d19Log .dr-starts button').length, transport: DRHVAC.transport(), kpi: document.querySelector('#d19Kpis').innerText, stored: !!DRHVAC.settings().apiKey, env: document.getElementById('d19Env').innerText }));
  ok(st.starts === 6 && st.transport === 'api' && st.stored && /CONNECTED/i.test(st.kpi), 'the key is saved and the six starting points appear', st.kpi.slice(0, 120));

  /* 3. a landing page from the atlas */
  api.say(...landingScript());
  await page.click('#tab-heat'); await page.waitForTimeout(150); await page.click('#tab-drhvac');
  await sendAndWait(page, 'Build a furnace repair landing page for Frisco and check it.');
  ok(api.problems.length === 0 && api.left() === 0 && api.calls.length === 4, 'four requests, each answered from the tool results in it', api.problems.join(' | ') + ' calls ' + api.calls.length);
  const r1 = api.calls[0].body, h1 = api.calls[0].headers;
  ok(r1.model === 'claude-opus-5-5' && r1.stream === true && r1.max_tokens === 64000 && r1.thinking.type === 'adaptive' && r1.output_config.effort === 'high', 'the request: Opus 5.5, streamed, adaptive thinking, high effort');
  ok(r1.tools.length === 52 && r1.tools.filter(t => t.input_schema).length === 50 && r1.tools.some(t => t.type === 'web_search_20260209') && r1.tools.some(t => t.type === 'web_fetch_20260209'), 'fifty tools of its own plus web search and web fetch', String(r1.tools.length));
  ok(Array.isArray(r1.system) && /Dr\. HVAC/.test(r1.system[0].text) && r1.system[0].text.length > 8000 && r1.system[0].cache_control && h1.authorization === 'Bearer ' + KEY && h1['anthropic-version'], 'the system prompt is one cached block; the key travels as a bearer credential');
  const state = r1.messages[0].content[0].text;
  ok(/^<dashboard_state>/.test(state) && /Module on screen before Dr\. HVAC: Heat Desk/.test(state) && /Atlas running as: a downloaded file/.test(state) && /TDLR license on file/.test(state) && /Workshop: 0 pages/.test(state), 'the dashboard state block tells the model where it is and what the person was looking at', state.replace(/Brand: [^\n]*/, 'Brand: …').slice(0, 300));
  const place = resultOf(api.calls[1].body, 'tu_place'), made = jsonOf(api.calls[2].body, 'tu_create'), chk = jsonOf(api.calls[3].body, 'tu_check');
  ok(!place.error && /"printable_facts"/.test(place.text) && !resultOf(api.calls[1].body, 'tu_angle').error, 'both atlas tools ran and their results went back in one user turn');
  ok(made.kind === 'blueprint' && made.h1 === 'Furnace Repair in Frisco, TX' && made.noindex === true && made.checks.block === 0 && made.words > 250, 'page_create built the blueprint with the Site Forge compiler: no blocking findings', JSON.stringify(made).slice(0, 300));
  ok(chk.audit && chk.audit.score >= 85 && chk.audit.counts.block === 0 && /No blocking findings/.test(chk.verdict), 'page_check: compliance clean and the audit scores the page', `${chk.audit && chk.audit.score} ${JSON.stringify(chk.audit && chk.audit.findings).slice(0, 300)}`);
  const ui = await page.evaluate(() => { const log = document.getElementById('d19Log'); const md = log.querySelector('.dr-msg.bot:last-of-type .dr-md:last-of-type') || [...log.querySelectorAll('.dr-md')].pop(); const fr = document.getElementById('d19Frame'); return {
    user: log.querySelectorAll('.dr-msg.user').length, tools: [...log.querySelectorAll('details.dr-tool')].map(t => t.querySelector('.dr-tn').textContent + ':' + t.querySelector('.dr-dot').className.replace('dr-dot ', '')), think: log.querySelectorAll('.dr-think').length,
    h: md.querySelectorAll('h4,h5').length, li: md.querySelectorAll('li').length, table: md.querySelectorAll('table tr').length, strong: md.querySelectorAll('strong').length, code: md.querySelectorAll('code').length, links: [...md.querySelectorAll('a')].map(a => a.getAttribute('href')), rawTag: md.querySelectorAll('b').length, mdText: md.innerText.slice(0, 2000),
    stage: (() => { const s = document.getElementById('d19Stage'); const f = fr ? fr.getBoundingClientRect() : null; return s && f ? { w: fr.style.width, fits: Math.abs(f.width - s.clientWidth) <= 3, sticky: /forge-sticky/.test(fr.getAttribute('srcdoc')), pubCss: /--forge-p:/.test(fr.getAttribute('srcdoc')) } : null; })(),
    frame: fr ? fr.getAttribute('srcdoc').length : 0, frameHas: fr ? /Furnace Repair in Frisco, TX/.test(fr.getAttribute('srcdoc')) : false, frameScripts: fr ? (fr.getAttribute('srcdoc').match(/<script(?![^>]*ld\+json)/gi) || []).length : -1, sandbox: fr ? fr.getAttribute('sandbox') : '',
    kpi: document.getElementById('d19Kpis').innerText, state: DRHVAC.agent.state(), ws: DRHVAC.tools.summary() }; });
  ok(ui.user === 1 && ui.tools.length === 4 && ui.tools.every(t => /:ok$/.test(t)) && ui.think >= 1, 'the conversation shows the message, the thinking and four finished tool cards', ui.tools.join(' '));
  ok(ui.h >= 1 && ui.li >= 5 && ui.table === 3 && ui.strong >= 2 && ui.code >= 1, 'the reply is rendered: heading, lists, table, bold, code', JSON.stringify([ui.h, ui.li, ui.table, ui.strong, ui.code]));
  ok(ui.links.length === 1 && /^https:\/\/www\.law\.cornell\.edu/.test(ui.links[0]) && ui.rawTag === 0 && /<b>markup<\/b>/.test(ui.mdText), 'only an https link became a link; a javascript: link and raw markup stayed text', JSON.stringify(ui.links));
  ok(ui.frameHas && ui.frame > 5000 && ui.frameScripts === 0 && ui.sandbox === 'allow-same-origin', 'the page is in the workbench preview, in a sandboxed frame with no script', `${ui.frame} ${ui.frameScripts} ${ui.sandbox}`);
  ok(ui.stage && ui.stage.w === '1280px' && ui.stage.fits && ui.stage.pubCss && ui.stage.sticky, 'the preview is the published markup under the published stylesheet, laid out at desktop width and scaled to fit', JSON.stringify(ui.stage));
  ok(/1 PAGE/i.test(ui.kpi) && /4 model requests/.test(ui.kpi) && /\$\d/.test(ui.kpi) && ui.state === 'idle' && ui.ws.pages === 1, 'the tiles show the workshop and what the conversation has used', ui.kpi.replace(/\s+/g, ' ').slice(0, 260));
  await page.click('#d19Chk'); await page.waitForSelector('#d19Find .dr-score');
  const find = await page.evaluate(() => ({ score: document.querySelector('#d19Find .dr-score').textContent, n: document.querySelectorAll('#d19Find .issue').length, t: document.getElementById('d19Find').innerText }));
  ok(/^\d+of100/.test(find.score.replace(/\s+/g, '')) && find.n >= 2, 'Run the checks shows the audit score and the findings with their fixes', find.score + ' / ' + find.n);
  await shot(page, '1-landing-page.png');
  await page.click('#d19ToPub'); await page.waitForTimeout(300); await page.click('#tab-publish'); await page.waitForTimeout(300);
  const pub = await page.evaluate(() => document.getElementById('mod-publish').innerText);
  ok(/furnace-repair-frisco/i.test(pub) && /Dr\. HVAC/.test(pub), 'Send to Publish puts the page in the Publish module\'s list', pub.replace(/\s+/g, ' ').slice(0, 200));
  await page.click('#tab-drhvac');

  /* 4. gates */
  api.say([text('Publishing it live.'), use('tu_live', 'page_publish', { ids: ['furnace-repair-frisco'], mode: 'deploy', live: true })],
    body => { const r = resultOf(body, 'tu_live'); if (!r.error || !/declined/.test(r.text)) throw new Error('the live change was not declined: ' + r.text.slice(0, 200)); return [text('Understood. Nothing was published.')]; });
  await sendAndWait(page, 'Publish it live now.', { during: async () => { await page.waitForSelector('.dr-ask.live'); const card = await page.evaluate(() => { const c = document.querySelector('.dr-ask.live'); return { k: c.querySelector('.dr-ak').textContent, t: c.querySelector('.dr-at').textContent, state: DRHVAC.agent.state(), waiting: document.getElementById('d19State').textContent }; }); ok(/Live change/.test(card.k) && card.state === 'waiting' && /Waiting for your answer/.test(card.waiting), 'a live change stops at a red approval card that names it', JSON.stringify(card)); await page.waitForTimeout(700); const seen = await page.evaluate(() => { const c = document.querySelector('.dr-ask.live').getBoundingClientRect(), l = document.getElementById('d19Log').getBoundingClientRect(); const t = document.querySelector('#d19Log details.dr-tool:last-of-type .dr-ts'); return { inLog: c.top >= l.top - 1 && c.bottom <= l.bottom + 1, tool: [...document.querySelectorAll('#d19Log details.dr-tool .dr-ts')].pop().textContent, dot: [...document.querySelectorAll('#d19Log details.dr-tool .dr-dot')].pop().className }; }); ok(seen.inLog && /waiting for your answer/.test(seen.tool) && /wait/.test(seen.dot), 'the card is scrolled into view and the tool it belongs to shows it is waiting', JSON.stringify(seen)); await shot(page, '2-live-approval.png'); await page.click('.dr-ask.live [data-no]'); } });
  ok(/Nothing was published/.test(await logText(page)) && (await page.locator('.dr-ask').count()) === 0, 'No stops it: the model is told, and says so');
  api.say([use('tu_draft', 'wp_create', { title: 'Furnace Repair in Frisco, TX', slug: 'furnace-repair-frisco', type: 'page' })],
    body => { const r = resultOf(body, 'tu_draft'); if (!r.error || !/No WordPress site is connected/.test(r.text) || !/Publish module/.test(r.text)) throw new Error('unexpected wp_create result: ' + r.text.slice(0, 200)); return [text('No WordPress site is connected yet. Fill in the WordPress card in the Publish module and I will create the draft.')]; });
  await sendAndWait(page, 'Then create it as a draft on the site.', { during: async () => { await page.waitForSelector('.dr-ask:not(.live)'); const k = await page.textContent('.dr-ask .dr-ak'); const hasAll = await page.locator('.dr-ask [data-yes-all]').count(); ok(/Draft/.test(k) && hasAll === 1, 'a draft write raises its own card, with the choice to stop asking for drafts', k); await page.click('.dr-ask [data-yes]'); } });
  ok(/Fill in the WordPress card/.test(await logText(page)), 'approved, the tool runs and reports that no site is connected, with where the credentials go');
  api.say([use('tu_brand', 'brand_update', { patch: { tagline: 'Comfort you can count on' } })],
    body => { const r = jsonOf(body, 'tu_brand'); if (r.changed.join() !== 'tagline') throw new Error('brand_update answered ' + JSON.stringify(r)); return [text('The tagline is changed.')]; });
  await sendAndWait(page, 'Change our tagline to Comfort you can count on.', { during: async () => { await page.waitForSelector('.dr-ask'); const c = await page.evaluate(() => ({ k: document.querySelector('.dr-ask .dr-ak').textContent, t: document.querySelector('.dr-ask .dr-at').textContent, d: document.querySelector('.dr-ask .dr-ad').textContent, yes: document.querySelector('.dr-ask [data-yes]').textContent, all: document.querySelectorAll('.dr-ask [data-yes-all]').length })); ok(/Atlas setting/.test(c.k) && /brand settings/.test(c.t) && /tagline: .+ → Comfort you can count on/.test(c.d) && c.yes === 'Change it' && c.all === 0, 'a change to the brand is shown, old value and new, and asks every time', JSON.stringify(c).slice(0, 260)); await page.click('.dr-ask [data-yes]'); } });
  ok((await page.evaluate(() => BRAND.tagline + ' | ' + document.querySelector('.brandmark .sb').textContent)).split('Comfort you can count on').length === 3, 'approved, the brand changes across the atlas: the header shows the new tagline');

  /* 5. an Elementor template, and a question */
  api.say(...elementorScript());
  await page.setInputFiles('#d19FileIn', FIXTURE); await page.waitForSelector('#d19Att .dr-file');
  ok(/elementor-service-landing\.json/.test(await page.textContent('#d19Att')), 'the attached template shows as a chip under the message box');
  await sendAndWait(page, 'Build a furnace repair page from this template.', { during: async () => { await page.waitForSelector('.dr-ask [data-opt]'); const q = await page.evaluate(() => ({ t: document.querySelector('.dr-ask .dr-at').textContent, o: [...document.querySelectorAll('.dr-ask [data-opt]')].map(b => b.textContent) })); ok(q.t === 'Which city is this page for?' && q.o.join() === 'Frisco,McKinney', 'ask_user shows the question with its options', JSON.stringify(q)); await page.click('.dr-ask [data-opt="0"]'); } });
  ok(api.problems.length === 0 && api.left() === 0, 'the Elementor conversation ran to its end', api.problems.join(' | '));
  const el = await page.evaluate(() => { const W = DRHVAC.tools.WS; const p = Object.values(W.pages).find(x => x.slug === 'furnace-repair-frisco-template'); const d = Object.values(W.docs)[0]; const fr = document.getElementById('d19Frame'); const texts = []; DRHVAC.elementor.walk(p.doc.elements, e => { if (e.widgetType === 'heading') texts.push(e.settings.title); }); return { kind: p && p.kind, heads: texts, docHeads: DRHVAC.elementor.text(d.elements).slice(0, 80), frame: fr ? /Furnace Repair in Frisco, TX/.test(fr.getAttribute('srcdoc')) && /How a furnace visit works/.test(fr.getAttribute('srcdoc')) : false, pages: Object.keys(W.pages).length, files: Object.values(W.files).map(f => f.kind + ':' + f.name), sel: document.getElementById('d19Pg').value === p.id }; });
  ok(el.kind === 'elementor' && el.heads[0] === 'Furnace Repair in Frisco, TX' && el.heads.includes('How a furnace visit works') && !el.heads.some(h => /Plano/.test(h)), 'the template became a Frisco page: every Plano gone, the compiled section inserted', el.heads.join(' | '));
  ok(el.frame && el.sel && el.pages === 2 && el.files.includes('attachment:elementor-service-landing.json'), 'the new page is the one on screen; the attachment is kept in Files');
  await page.click('#d19Tabs [data-v="elementor"]'); const tree = await page.textContent('#d19Pane');
  ok(/heading \(h1\) "Furnace Repair in Frisco, TX"/.test(tree) && /needs Elementor Pro for form/.test(tree), 'the Elementor tab shows the document tree and what the site must have', tree.slice(0, 160));
  await page.click('#d19Tabs [data-v="pages"]'); const rows = await page.locator('#d19Pane tbody tr').count(); ok(rows === 2, 'the Pages tab lists both pages', String(rows));
  await shot(page, '3-elementor-pages.png');

  /* 6. a hosting move, downloads */
  api.say([text('I will write the runbook from what you told me.'), use('tu_plan', 'migration_plan', { domain: 'northside-comfort.test', from: 'a shared host', to: 'a managed WordPress host', platform: 'wordpress', email_on_domain: true, forms: true, launch_date: '2026-12-02' })],
    body => { const p = jsonOf(body, 'tu_plan'); if (!p.open_questions.length || p.phases.length < 6) throw new Error('thin plan'); return [text(`The runbook has ${p.phases.length} phases. Before any DNS change: ${p.open_questions[0]}`)]; });
  await sendAndWait(page, 'We are moving northside-comfort.test to a new host on December 2. Mail is on the domain.');
  await page.click('#d19Tabs [data-v="files"]'); await page.waitForSelector('#d19Pane tbody tr');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#d19Pane tr', { hasText: 'hosting-move-runbook' }).locator('[data-a="dl"]').click()]);
  const runbook = fs.readFileSync(await dl.path(), 'utf8');
  ok(dl.suggestedFilename() === 'hosting-move-runbook-northside-comfort.test.md' && /^# Hosting move runbook: northside-comfort\.test/.test(runbook) && /## Phase 1/.test(runbook) && /rollback/i.test(runbook) && /MX/.test(runbook) && runbook.length > 8000, 'the runbook is in Files and downloads as Markdown: phases, mail records, rollback', `${dl.suggestedFilename()} ${runbook.length}`);
  { const lt = await logText(page); ok(/Before any DNS change: Blocking:/.test(lt), 'the open question that blocks the cutover reaches the person', lt.slice(-500)); }
  const [dz] = await Promise.all([page.waitForEvent('download'), page.click('#d19Plugin')]);
  const zip = readZip(fs.readFileSync(await dz.path())), php = zip.find(e => /drhvac-connector\.php$/.test(e.name));
  ok(dz.suggestedFilename() === 'drhvac-connector.zip' && php && /Plugin Name:\s*Dr\. HVAC Connector/.test(php.data.toString('utf8')) && zip.every(e => e.name.startsWith('drhvac-connector/')), 'the connector plugin downloads as an installable zip', zip.map(e => e.name).join(', '));
  if (php) { const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'drhvac-php-')), 'c.php'); fs.writeFileSync(tmp, php.data); const lint = spawnSync('php', ['-l', tmp], { encoding: 'utf8' }); if (lint.error) checks.push('NOTE  php is not installed here: the plugin from the zip was not linted'); else ok(lint.status === 0, 'the PHP in the downloaded zip passes php -l', (lint.stdout || '') + (lint.stderr || '')); }

  /* 7. an API failure */
  api.say({ status: 529, errType: 'overloaded_error', message: 'Overloaded' }, { status: 529 }, { status: 529 }, { status: 529 });
  const before = await page.evaluate(() => DRHVAC.agent.current().messages.length);
  await sendAndWait(page, 'One more thing.', { timeout: 60000 });
  const fail = await page.evaluate(() => ({ note: [...document.querySelectorAll('#d19Log .dr-note')].pop().innerText, cls: [...document.querySelectorAll('#d19Log .dr-note')].pop().className, n: DRHVAC.agent.current().messages.length, state: DRHVAC.agent.state(), end: window.__dr.ends[window.__dr.ends.length - 1] }));
  ok(/dr-note error/.test(fail.cls) && fail.note.length > 20 && fail.state === 'idle', 'an overloaded API ends the turn with a plain note, and the conversation stays usable', `${fail.end}: ${fail.note}`);
  api.say([text('Yes, still here.')]); await sendAndWait(page, 'Are you still there?');
  ok(/Yes, still here\./.test(await logText(page)) && api.problems.length === 0, 'the next message goes through', `${before} → ${fail.n}`);
  /* the failed turn left the person's message in the history (the API joins consecutive user turns); what must hold is that every tool call still has its result right after it */
  const hist0 = await page.evaluate(() => { const M = DRHVAC.agent.current().messages; const dangling = []; M.forEach((m, i) => { if (m.role !== 'assistant') return; const ids = m.content.filter(b => b.type === 'tool_use').map(b => b.id); if (!ids.length) return; const nx = M[i + 1]; const got = nx && nx.role === 'user' ? nx.content.filter(b => b.type === 'tool_result').map(b => b.tool_use_id) : []; ids.forEach(id => { if (!got.includes(id)) dangling.push(id); }); }); return { dangling, roles: M.map(m => m.role[0]).join(''), first: M[0].role, aa: /aa/.test(M.map(m => m.role[0]).join('')) }; });
  ok(hist0.dangling.length === 0 && hist0.first === 'user' && !hist0.aa, 'the stored history is still one the API accepts: every tool call has its result, no two assistant turns in a row', JSON.stringify(hist0));

  /* 8. reload, history */
  const usageBefore = await page.evaluate(() => DRHVAC.agent.current().usage.requests);
  await page.waitForTimeout(700); await page.reload({ waitUntil: 'load' }); await hook(page); await opened(page); await page.waitForFunction(() => DRHVAC.agent.transcript().length > 0 && document.querySelectorAll('#d19Log .dr-msg').length > 0);
  const back = await page.evaluate(() => ({ msgs: document.querySelectorAll('#d19Log .dr-msg.user').length, tools: document.querySelectorAll('#d19Log details.dr-tool').length, usage: DRHVAC.agent.current().usage.requests, ws: DRHVAC.tools.summary(), key: !!DRHVAC.settings().apiKey, frame: !!document.getElementById('d19Frame'), where: DRHVAC.big.where() }));
  ok(back.msgs === 8 && back.tools >= 11 && back.usage === usageBefore && back.ws.pages === 2 && back.ws.docs === 1 && back.key && back.frame, 'a reload brings back the conversation, its usage, the workshop and the preview', JSON.stringify(back));
  await page.click('#d19New'); await page.waitForSelector('#d19Log .dr-starts');
  api.say([text('Three service lines matter most in December: heating repair, furnace replacement and maintenance.')]); await sendAndWait(page, 'Which service lines matter in December?');
  await page.click('#d19Hist'); await page.waitForSelector('#d19HistPanel tbody tr');
  const hist = await page.evaluate(() => [...document.querySelectorAll('#d19HistPanel tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ').slice(0, 60)));
  ok(hist.length === 2 && /Which service lines matter in December/.test(hist[0]) && /open/i.test(hist[0]) && /Build a furnace repair landing page/.test(hist[1]), 'History lists both conversations, newest first, titled by their first message', hist.join(' || '));
  await page.locator('#d19HistPanel tbody tr', { hasText: 'Build a furnace repair' }).locator('[data-a="open"]').click(); await page.waitForSelector('#d19HistPanel', { state: 'detached' });
  ok((await page.locator('#d19Log .dr-msg.user').count()) === 8, 'opening the earlier conversation shows it again');
  await page.keyboard.press('Escape');

  /* 9. phone width, dark theme */
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250);
  const phone = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, btn: getComputedStyle(document.getElementById('drBtn')).display, cols: getComputedStyle(document.querySelector('.dr-work')).gridTemplateColumns.split(' ').length }));
  ok(phone.over <= 1 && phone.btn !== 'none' && phone.cols === 1, 'at phone width the page does not scroll sideways, the layout is one column and the header button shows', JSON.stringify(phone));
  await shot(page, '4-phone.png');
  await page.setViewportSize({ width: 1440, height: 950 }); await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; window.scrollTo(0, 0); }); await page.waitForTimeout(200); await shot(page, '5-dark.png');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; document.getElementById('d19Log').scrollIntoView(); }); await page.waitForTimeout(150); await shot(page, '6-conversation.png');
  ok(errors.length === 0, 'no console or page error in the whole run', errors.join(' || '));
  } catch (e) {
    let where = ''; try { where = await page.evaluate(() => JSON.stringify({ state: DRHVAC.agent.state(), transcript: DRHVAC.agent.transcript().length, hash: location.hash, log: (document.getElementById('d19Log') || {}).innerText || '' }).slice(0, 700)); } catch (x) { where = 'page not readable: ' + x.message; }
    ok(false, 'the single file run stopped: ' + String(e.message).split('\n')[0], where + ' | errors: ' + errors.join(' || ') + ' | script: ' + api.problems.join(' | ')); await shot(page, 'stopped.png');
  } finally { await context.close(); }
}
if (browser) await browser.close();

/* =================================================================================================================== */
if (APP) {
  section('Browser app: ' + path.basename(APP));
  /* unpack outside the repository; Chromium loads an extension from a folder */
  const dir = checkOut(fs.mkdtempSync(path.join(os.tmpdir(), 'drhvac-app-'))); const A = readApp(path.resolve(APP));
  for (const [name, data] of A.files) { const p = path.join(dir, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); }
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  ok(man.version === '6.0.0' && man.manifest_version === 3 && man.host_permissions.includes('https://api.anthropic.com/*') && man.optional_host_permissions.includes('https://*/*') && man.content_security_policy.extension_pages === "script-src 'self'; object-src 'self'", 'the manifest: version 6.0.0, Claude among the hosts, websites optional, the script policy unchanged');
  const base = { headless: true, args: ['--headless=new', '--disable-extensions-except=' + dir, '--load-extension=' + dir, '--no-sandbox'], viewport: { width: 1440, height: 950 } };
  let context; try { context = await chromium.launchPersistentContext('', Object.assign({ channel: 'chromium' }, base)); } catch (e) { context = await chromium.launchPersistentContext('', base); }
  try {
    let sw = context.serviceWorkers()[0]; if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
    const id = new URL(sw.url()).host; ok(/^[a-p]{32}$/.test(id), 'the extension loads and its service worker starts', id);
    const api = claude(); await context.route('https://api.anthropic.com/**', api.handler);
    const page = await context.newPage(); const errors = []; watch(page, errors, NOISE);
    const csp = []; page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 200)); });
    await page.goto(`chrome-extension://${id}/atlas.html#drhvac`, { waitUntil: 'load' }); await hook(page); await opened(page);
    const boot = await page.evaluate(() => ({ env: DRHVAC.ENV, tabs: document.querySelectorAll('#rail button').length, tools: DRHVAC.tools.list().length, sdk: (window.AnthropicSDK || {}).VERSION, shown: !document.getElementById('mod-drhvac').hidden, runs: document.querySelector('#mod-drhvac .mast').innerText, css: getComputedStyle(document.querySelector('.dr-work')).display }));
    ok(boot.env === 'chrome' && boot.tabs === 19 && boot.tools === 50 && boot.sdk && boot.shown && boot.css === 'grid', 'atlas.html#drhvac opens the module inside the extension, stylesheet applied', JSON.stringify(boot).slice(0, 160));
    ok(csp.length === 0, 'nothing is refused by the script-src \'self\' policy (no eval, no inline script)', csp.join(' | '));
    await page.evaluate(k => DRHVAC.saveSettings({ apiKey: k }), KEY); await page.waitForFunction(() => DRHVAC.transport() === 'api');
    const stored = await sw.evaluate(async () => (await chrome.storage.local.get('tda.drhvac.v1'))['tda.drhvac.v1']);
    ok(stored && stored.apiKey === KEY && stored.model === 'claude-opus-5-5', 'the settings live in the extension\'s own storage');
    api.say([use('tu_o', 'atlas_overview', {}), use('tu_f', 'fetch_url', { url: 'https://www.northside-comfort.test/' })],
      body => { const o = jsonOf(body, 'tu_o'), f = resultOf(body, 'tu_f'); if (!o.cities || !f.error || !/did not allow access/.test(f.text)) throw new Error('unexpected: ' + f.text.slice(0, 200)); return [text(`The atlas models ${o.cities} cities. I could not read the site because access was not allowed.`)]; });
    await sendAndWait(page, 'What does the atlas cover, and what is on our home page?', { during: async () => { await page.waitForSelector('.dr-ask'); const c = await page.evaluate(() => ({ k: document.querySelector('.dr-ask .dr-ak').textContent, t: document.querySelector('.dr-ask .dr-at').textContent, d: document.querySelector('.dr-ask .dr-ad').textContent })); ok(/Site access/.test(c.k) && /www\.northside-comfort\.test and northside-comfort\.test/.test(c.t), 'a site the extension has no access to raises one card for the site and its www twin', JSON.stringify(c).slice(0, 240)); await page.click('.dr-ask [data-no]'); } });
    ok(api.problems.length === 0 && /could not read the site because access was not allowed/.test(await logText(page)), 'declined, the fetch never runs and the model is told; the atlas tool ran beside it', api.problems.join(' | '));
    ok(api.calls[0].headers.authorization === 'Bearer ' + KEY && api.calls[0].body.tools.every(t => !t.input_schema || t.eager_input_streaming === true), 'the request leaves the extension page through the SDK, tools marked for eager input streaming');
    await shot(page, '7-browser-app.png');
    ok(errors.length === 0, 'no console or page error in the extension page', errors.join(' || '));
    const pop = await context.newPage(); const perr = []; watch(pop, perr, NOISE);
    await pop.goto(`chrome-extension://${id}/popup.html`, { waitUntil: 'load' }); await pop.waitForSelector('#list .row');
    const pv = await pop.evaluate(() => ({ btn: (document.getElementById('goDr') || {}).textContent, rows: document.querySelectorAll('#list .row').length, last: [...document.querySelectorAll('#list .row .t')].pop().textContent, ver: document.getElementById('ver').textContent }));
    ok(/Ask Dr\. HVAC/.test(pv.btn || '') && pv.rows === 19 && pv.last === 'Dr. HVAC' && /Build 6\.0\.0/.test(pv.ver) && perr.length === 0, 'the popup has the Ask Dr. HVAC button, lists nineteen modules and shows Build 6.0.0', JSON.stringify(pv) + perr.join(' '));
    await pop.fill('#q', 'dr hvac'); await pop.waitForTimeout(100); ok(/Dr\. HVAC/.test(await pop.textContent('#list .row .t')), 'the popup search finds Dr. HVAC (the address bar keyword uses the same list)');
    await shot(pop, '8-popup.png');
  } finally { await context.close(); }
}

console.log(checks.join('\n'));
console.log(`\n${checks.filter(c => c.startsWith('PASS')).length} passed, ${failed} failed. Screenshots: ${SHOTS}`);
process.exit(failed ? 1 : 0);
