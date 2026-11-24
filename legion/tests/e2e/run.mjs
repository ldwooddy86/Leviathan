#!/usr/bin/env node
// Legion · end to end: the built Legion.html in headless Chromium.
//
//   node tests/e2e/run.mjs                 build, then test desktop (1440 x 900) and phone (390 x 844)
//   node tests/e2e/run.mjs --no-build      test the existing Legion.html
//   node tests/e2e/run.mjs --density=0.025 run the crowd at another density (default 0.005 keeps software WebGL quick)
//   node tests/e2e/run.mjs --headed        watch it
//
// Checks: boot without page errors; the map canvas draws pixels; '/' focuses search and '94110' flies the map to
// the Mission and opens the Place panel (San Francisco); Census versus generated reads in words (key figures, six
// tables, the rest folded, no raw keys); a resident opens the NPC panel on Profile with a name and an age; every tab
// renders; Talk (the real offline engine) greets, keeps its conversation when the open NPC is chosen again, and its
// starters are the NPC's own; Claude errors speak as Legion; the Mind tab shows the Big Five in words, concerns with
// their data and memories with their year and source; five offline exchanges, the weather answer stating the Place
// panel's temperature; a Spanish speaker with limited English answers with a gloss; the street view opens from the
// NPC panel following them, its people move, and clicking one opens their profile; a failed copy says so and the
// JSON size counts bytes; the theme toggles both ways; Settings opens with density, theme, Claude and network (live
// weather off by default, every engine module ready) and closes on Escape; Space pauses the clock; Escape closes
// the panels; search finds counties by name and Census places by their own ZIPs. A damaged inline pack fails with a
// plain message at the step that failed. Served by server/serve.mjs with and without a key, the page uses the proxy
// the server advertises only when it holds a key; with a fake Anthropic upstream behind the server, a Claude reply
// streams into the Talk tab and the conversation is reflected into the NPC's mind. The phone layout has no
// horizontal scroll, shows the panels as sheets and keeps the legend inside the screen.
// Screenshots: tests/e2e/app.png and tests/e2e/app-phone.png. Works with the provisional crowd stub (0 agents) and
// with the real crowd. Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEGION = path.resolve(HERE, '../..');
const PAGE = path.join(LEGION, 'Legion.html');
const args = process.argv.slice(2);
const densityArg = args.find(a => a.startsWith('--density='));
const DENSITY = densityArg ? Number(densityArg.split('=')[1]) : 0.005;

const results = [];
let failed = 0;
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
async function step(name, fn) {
  const t0 = Date.now();
  const took = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
  try { const detail = await fn(); record(name, true, [typeof detail === 'string' ? detail : '', took()].filter(Boolean).join(' · ')); return true; } catch (e) { record(name, false, `${e && e.message ? e.message.split('\n')[0] : String(e)} · ${took()}`); return false; }
}
function expect(cond, message) { if (!cond) throw new Error(message); }

// ------------------------------------------------------------------ a small PNG reader (8-bit RGB/RGBA, as Chromium writes)

function decodePNG(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('not a PNG');
  let off = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), kind = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (kind === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (type !== 2 && type !== 6)) throw new Error(`unsupported PNG (depth ${depth}, type ${type}, interlace ${interlace})`);
  const bpp = type === 6 ? 4 : 3, stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return { width, height, bpp, data: out };
}

/** Pixels that differ clearly from the image's most common color. */
function inkedPixels(png) {
  const counts = new Map();
  const { data, bpp } = png, n = png.width * png.height;
  for (let i = 0; i < n; i += 7) { const k = (data[i * bpp] << 16) | (data[i * bpp + 1] << 8) | data[i * bpp + 2]; counts.set(k, (counts.get(k) || 0) + 1); }
  let bg = 0, best = -1;
  for (const [k, c] of counts) if (c > best) { best = c; bg = k; }
  const br = bg >> 16, bgG = (bg >> 8) & 255, bb = bg & 255;
  let inked = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(data[i * bpp] - br) + Math.abs(data[i * bpp + 1] - bgG) + Math.abs(data[i * bpp + 2] - bb);
    if (d > 40) inked++;
  }
  return { inked, total: n };
}

// ------------------------------------------------------------------ helpers

async function loadPlaywright() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  try { return await import('playwright'); } catch { return import('/opt/node22/lib/node_modules/playwright/index.mjs'); }
}

async function openPage(browser, { viewport, mobile = false }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  // a light crowd keeps software WebGL quick; set once, before the page reads it
  await context.addInitScript(density => {
    try { if (!localStorage.getItem('legion.settings.v1')) localStorage.setItem('legion.settings.v1', JSON.stringify({ density })); } catch { /* storage blocked: defaults */ }
  }, DENSITY);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /legion/i.test(m.text())) errors.push(m.text()); });
  return { context, page, errors };
}

/** Open a page and wait until it is ready or has failed; returns 'ready' or 'error'. */
async function settle(page, url = pathToFileURL(PAGE).href) {
  await page.goto(url);
  await page.waitForFunction(() => ['ready', 'error'].includes(document.documentElement.dataset.state), null, { timeout: 90000 });
  return page.evaluate(() => document.documentElement.dataset.state);
}

async function boot(page, url) {
  if (await settle(page, url) !== 'ready') {
    const why = await page.evaluate(() => (document.querySelector('.boot-error') || {}).textContent || 'unknown');
    throw new Error(`boot failed: ${why}`);
  }
}

// Text the panels must never show: the population's raw keys (review: 'Hisp', 'Rent1', '150 200k', 'M35 39' ...)
const RAW_KEYS = /\b(?:Hisp|Lep|OccM|OccF|Vet|Nilf|Southam|Puertorican|Otherasian|Rent\d|Own\d|[MF]\d+ \d+|[MF] never|[MF] married|G\d \d|\w+ lep)\b|\b\d+ \d+k\b/;

async function waitForCrowd(page, timeout = 60000) {
  await page.waitForFunction(() => window.legion && window.legion.stage && !window.legion.stage.build.building && window.legion.stage.build.agents !== null, null, { timeout });
  return page.evaluate(() => window.legion.stage.build);
}

// ------------------------------------------------------------------ desktop

async function desktop(browser) {
  const { context, page, errors } = await openPage(browser, { viewport: { width: 1440, height: 900 } });
  if (!await step('desktop: boots to ready', async () => { const t0 = Date.now(); await boot(page); return `${Date.now() - t0} ms`; })) { await context.close(); return; }

  await step('desktop: the crowd builds at the configured density', async () => {
    const b = await waitForCrowd(page);
    expect(!b.error, `build error: ${b.error && b.error.message}`);
    expect(Math.abs(b.rate - DENSITY) < 1e-9, `rate ${b.rate}`);
    // the top bar refreshes twice a second; it must show the built crowd, not a placeholder
    await page.waitForFunction(n => document.getElementById('count-agents').textContent === n.toLocaleString('en-US'), b.agents, { timeout: 5000 });
    const counts = await page.evaluate(() => [document.getElementById('count-agents').textContent, document.getElementById('count-moving').textContent]);
    return `${b.agents} agents in ${Math.round(b.ms)} ms; top bar shows ${counts[0]} simulated, ${counts[1]} moving`;
  });

  await step('desktop: Space pauses the clock, and a paused page stops moving', async () => {
    // a key press does not wait for animation frames, which software WebGL renders slowly while the crowd moves
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    expect(await page.evaluate(() => window.legion.clock.playing) === true, 'the clock should start playing');
    await page.keyboard.press(' ');
    const after = await page.evaluate(() => [window.legion.clock.playing, document.querySelector('.play-btn').getAttribute('aria-pressed'), document.querySelector('.play-btn').getAttribute('aria-label')]);
    expect(after[0] === false && after[1] === 'false' && /Play/.test(after[2]), `after Space ${JSON.stringify(after)}`);
    const t0 = await page.evaluate(() => window.legion.clock.t);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.legion.clock.t) === t0, 'the paused clock moved');
    return 'paused';
  });

  await step('desktop: the map canvas is drawn', async () => {
    const canvas = await page.evaluate(() => [...document.querySelectorAll('#map canvas')].map(c => [c.width, c.height]));
    expect(canvas.length > 0 && canvas.every(([w, h]) => w > 0 && h > 0), `canvases ${JSON.stringify(canvas)}`);
    // hide the page's own layers so only the map (and crowd) can produce the pixels
    const style = await page.addStyleTag({ content: '.map-ui, .overlay, .counts-mobile, .panel { visibility: hidden !important; }' });
    await page.waitForTimeout(250);
    const png = decodePNG(await page.locator('#map').screenshot());
    await style.evaluate(el => el.remove());
    const { inked, total } = inkedPixels(png);
    expect(inked > 400 && inked / total > 0.0005, `only ${inked} of ${total} pixels differ from the background`);
    return `${inked} drawn pixels of ${total}`;
  });

  await step("desktop: '/' focuses search, '94110' flies there and opens the Place panel", async () => {
    await page.locator('#map').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await page.keyboard.press('/');
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id === 'search-input'), '/ did not focus the search box');
    await page.keyboard.type('94110');
    await page.locator('#search-list [role=option]').first().waitFor({ timeout: 5000 });
    const option = await page.locator('#search-list [role=option]').first().textContent();
    expect(/94110/.test(option), `first option is ${option}`);
    await page.keyboard.press('Enter');
    const panel = page.locator('#place-panel');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    const title = await panel.locator('.panel-title').textContent();
    const sub = await panel.locator('.panel-sub').textContent();
    expect(/San Francisco/.test(title), `title ${title}`);
    expect(/94110/.test(sub), `subtitle ${sub}`);
    // the map flies until the ZIP's town point sits inside the visible map
    await page.waitForFunction(() => {
      const L = window.legion, m = L.map; if (!m) return true;
      const i = L.world.indexOf('94110'), p = m.worldToScreen(L.world.z.tx[i], L.world.z.ty[i]);
      const r = document.getElementById('map').getBoundingClientRect();
      return p.px > 0 && p.px < r.width && p.py > 0 && p.py < r.height && L.stage.scale() > 5;
    }, null, { timeout: 5000 });
    const scale = await page.evaluate(() => window.legion.stage.scale());
    expect(await page.evaluate(() => location.hash) === '#zip=94110', 'the deep link was not written');
    return `${title.trim()} · ${sub.trim()} · ${scale.toFixed(1)} px/unit`;
  });

  await step('desktop: the Place panel shows languages, heritage, the commute and twelve residents', async () => {
    const panel = page.locator('#place-panel');
    const text = await panel.textContent();
    for (const word of ['People', 'Households', 'Income', 'Home value', 'Languages at home', 'Spanish', 'Heritage', 'Getting to work', 'Meet the residents']) expect(text.includes(word), `missing "${word}"`);
    const n = await panel.locator('.resident').count();
    expect(n === 12, `${n} residents`);
    const fidelity = await panel.locator('.fidelity').count();
    return `12 residents; fidelity bars ${fidelity ? 'shown' : 'not drawn yet (they render when the page is idle)'}`;
  });

  await step('desktop: Census versus generated reads in words: key figures, six tables, the rest folded', async () => {
    const panel = page.locator('#place-panel');
    const reports = await page.evaluate(() => typeof window.legion.services.population.validate === 'function');
    if (!reports) return 'skipped: this population has no validate()';
    const section = panel.locator('.fidelity');
    await section.waitFor({ state: 'attached', timeout: 15000 });
    const head = (await section.locator('.section-head').textContent()).trim();
    expect(/Census versus generated\s*600 households · [\d,]+ people/.test(head), `header "${head}"`);
    const figures = await section.locator('.fid-fig:not(.fid-fig-head) .fid-fig-label').allTextContents();
    expect(['Household size', 'Median age', 'Under 18', '65 and over', 'Born abroad', 'Owners'].every(f => figures.includes(f)), `key figures ${figures}`);
    const shown = await section.locator(':scope > .fid-table h4').allTextContents();
    expect(JSON.stringify(shown) === JSON.stringify(['Household type', 'Tenure', 'Race and ethnicity', 'Language at home', 'Commute mode', 'Education']), `featured ${JSON.stringify(shown)}`);
    const more = section.locator('details.fid-more');
    expect(await more.count() === 1 && !(await more.evaluate(d => d.open)), 'the other tables are not folded away');
    await more.locator('summary').click();
    const folded = await more.locator('.fid-table h4').allTextContents();
    for (const want of ['Hispanic origin', 'Asian group', 'Limited English', 'Occupation, men', 'Occupation, women', 'Veterans', 'Household income', 'Age']) expect(folded.includes(want), `missing "${want}" in ${folded.join(', ')}`);
    const text = await section.textContent();
    const raw = RAW_KEYS.exec(text);
    expect(!raw, `raw key "${raw && raw[0]}" in the fidelity section`);
    for (const label of ['$150k–200k', 'Owners · 2 vehicles', '30–34 min', 'Not in the labor force']) expect(text.includes(label), `missing row "${label}"`);
    const ages = await more.locator('.fid-table[data-dim="age"] .paired-label').allTextContents();
    expect(ages[0] === 'Under 18' && ages.at(-1) === '75 and over', `age rows ${ages}`);
    await more.locator('summary').click();
    return `${figures.length} key figures, ${shown.length} tables shown, ${folded.length} folded; no raw keys`;
  });

  await step('desktop: clicking a resident opens Profile with a name and an age', async () => {
    const first = page.locator('#place-panel .resident').first();
    const id = await first.getAttribute('data-id');
    await first.click();
    const panel = page.locator('#npc-panel');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    const name = (await panel.locator('.npc-name').textContent()).trim();
    const age = (await panel.locator('.npc-age').textContent()).trim();
    expect(name.length >= 3, `name "${name}"`);
    expect(/^\d{1,3}$/.test(age), `age "${age}"`);
    expect(await panel.locator('#npc-tab-profile').getAttribute('aria-selected') === 'true', 'Profile is not the selected tab');
    const text = await panel.locator('#npc-tabpanel-profile').textContent();
    for (const word of ['Born', 'Household', 'Lives in']) expect(text.includes(word), `profile is missing "${word}"`);
    expect((await panel.locator('.npc-id').textContent()).trim() === id, 'the panel shows another NPC');
    return `${name}, ${age} (${id})`;
  });

  await step('desktop: Mind, Talk, Prompt and JSON render (content or a clear placeholder)', async () => {
    const out = [];
    for (const tab of ['mind', 'talk', 'prompt', 'json']) {
      await page.click(`#npc-tab-${tab}`);
      const body = page.locator(`#npc-tabpanel-${tab}`);
      await body.waitFor({ state: 'visible' });
      const text = (await body.textContent()).trim();
      expect(text.length > 20, `${tab} is empty`);
      out.push(`${tab}: ${(await body.locator('.placeholder').count()) ? 'placeholder' : 'content'}`);
    }
    const json = await page.locator('#npc-tabpanel-json pre').textContent();
    const record = JSON.parse(json);
    expect(record.npc && record.npc.id && Number.isFinite(record.npc.age), 'JSON has no NPC record');
    expect(await page.locator('#npc-tabpanel-json button', { hasText: 'Download' }).count() === 1, 'no download button');
    await page.click('#npc-tab-profile');
    return out.join(', ');
  });

  await step('desktop: screenshot tests/e2e/app.png', async () => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(HERE, 'app.png') });
    return 'written';
  });

  // The Talk tab with the real engine: the offline Conversation greets, answers and keeps its lines when the NPC
  // already open is chosen again; Claude, not allowed yet, answers through a Legion note, never the NPC's voice.
  const reopenNpc = async id => {
    await page.evaluate(() => window.legion.bus.emit('npc:select', { id: null }));
    await page.locator(`#place-panel .resident[data-id="${id}"]`).click();
    await page.locator('#npc-panel').waitFor({ state: 'visible', timeout: 5000 });
  };
  const talkBubbles = () => page.locator('#npc-tabpanel-talk .talk-log .bubble').count();
  const say = async text => {
    const before = await page.locator('#npc-tabpanel-talk .talk-log .bubble.from-npc').count();
    await page.locator('#npc-tabpanel-talk .talk-input').fill(text);
    await page.locator('#npc-tabpanel-talk .talk-input').press('Enter');
    await page.waitForFunction(n => document.querySelectorAll('#npc-tabpanel-talk .talk-log .bubble.from-npc').length > n, before, { timeout: 5000 });
    return (await page.locator('#npc-tabpanel-talk .talk-log .bubble.from-npc .bubble-text').last().textContent()).trim();
  };

  await step('desktop: Talk keeps the conversation when the open NPC is chosen again', async () => {
    const id = await page.evaluate(() => window.legion.npcPanel.id);
    await page.click('#npc-tab-talk');
    // the offline engine greets as the tab opens, and says which engine is speaking
    await page.locator('#npc-tabpanel-talk .bubble.from-npc').first().waitFor({ timeout: 5000 });
    const engine = (await page.locator('#npc-tabpanel-talk .talk-engine').textContent()).trim();
    expect(/offline engine/.test(engine), `engine line "${engine}"`);
    await say('How is the fog today?');
    expect(await talkBubbles() === 3, `${await talkBubbles()} bubbles after one exchange`);
    // the same NPC again: from the resident list, from their dot on the map, and from search
    await page.locator(`#place-panel .resident[data-id="${id}"]`).click();
    await page.evaluate(i => window.legion.bus.emit('npc:select', { id: i, source: 'map' }), id);
    await page.evaluate(i => window.legion.bus.emit('npc:select', { id: i, source: 'search' }), id);
    const after = await page.evaluate(() => [window.legion.npcPanel.tab, window.legion.npcPanel.talk && window.legion.npcPanel.talk.lines.length]);
    expect(after[0] === 'talk' && after[1] === 3, `after choosing the same NPC again: tab ${after[0]}, ${after[1]} lines`);
    expect(await talkBubbles() === 3, `${await talkBubbles()} bubbles shown`);
    // the starters are this NPC's: the Mission has no fire and no snow in the pack, so none asks about either
    const starters = await page.locator('#npc-tabpanel-talk .starters .chip').allTextContents();
    expect(starters.length >= 5 && !starters.some(s => /fire|snow/i.test(s)), `starters ${starters.join(' | ')}`);
    expect(starters.includes('How long have you lived here?'), `starters ${starters.join(' | ')}`);
    return `3 lines kept; starters: ${starters.join(' | ')}`;
  });

  await step('desktop: Claude errors speak as Legion, not as the NPC', async () => {
    const id = await page.evaluate(() => window.legion.npcPanel.id);
    await reopenNpc(id);
    await page.click('#npc-tab-talk');
    await page.click('label[for="talk-engine-claude"]');
    const engine = (await page.locator('#npc-tabpanel-talk .talk-engine').textContent()).trim();
    expect(/Allow the Claude API in Settings/.test(engine), `engine line "${engine}"`);
    await page.locator('#npc-tabpanel-talk .talk-input').fill('Hi');
    await page.locator('#npc-tabpanel-talk .talk-input').press('Enter');
    const system = page.locator('#npc-tabpanel-talk .bubble.from-system');
    await system.first().waitFor({ timeout: 3000 });
    const said = (await system.first().textContent()).trim();
    expect(/^Legion:\s*Allow the Claude API in Settings/.test(said), `system line "${said}"`);
    const npcSays = await page.locator('#npc-tabpanel-talk .bubble.from-npc').allTextContents();
    expect(!npcSays.some(t => /Allow the Claude API/.test(t)), 'the error was put in the NPC’s mouth');
    await page.click('label[for="talk-engine-offline"]');
    await page.click('#npc-tab-profile');
    return `"${said.replace(/\s+/g, ' ')}"`;
  });

  await step('desktop: the Mind tab shows the Big Five in words, concerns with their data, memories with year and source', async () => {
    await page.click('#npc-tab-mind');
    const panel = page.locator('#npc-tabpanel-mind');
    await panel.locator('.big5 .meter').first().waitFor({ timeout: 5000 });
    const meters = await panel.locator('.big5 .meter').evaluateAll(ms => ms.map(m => [m.getAttribute('aria-label'), m.getAttribute('aria-valuetext')]));
    expect(meters.length === 5 && meters.map(m => m[0]).join() === 'Openness,Conscientiousness,Extraversion,Agreeableness,Neuroticism', `meters ${JSON.stringify(meters)}`);
    expect(meters.every(([, v]) => /^\d{1,3}: (very )?[a-z]|in between/.test(v || '')), `plain words ${JSON.stringify(meters)}`);
    const text = await panel.textContent();
    for (const word of ['Traits', 'Values', 'Interests', 'Concerns', 'Memories', 'Right now', 'Needs', 'With you']) expect(text.includes(word), `Mind is missing "${word}"`);
    const years = await panel.locator('.timeline').first().locator('.tl-year').allTextContents();
    expect(years.length > 0 && years.every(y => /^\d{4}$/.test(y.trim())), `memory years ${years.join(',')}`);
    const sources = await panel.locator('.timeline').first().locator('.tl-source').allTextContents();
    expect(sources.length === years.length && sources.every(s => s.trim().length > 3), `memory sources ${sources.join(' | ')}`);
    const dataLines = await panel.locator('.concern-src').allTextContents();
    expect(dataLines.length > 0 && dataLines.every(d => /^Data: /.test(d)), `concern sources ${dataLines.join(' | ')}`);
    // the player has been talking to them: the mind counts the meeting
    expect(/Feels \w+ toward you; you have met/.test(text), 'the relationship does not show the meeting');
    await page.click('#npc-tab-profile');
    return `${meters.map(m => m[1]).join(' · ')}; ${years.length} memories (${sources[0]}); ${dataLines.length} concerns with data`;
  });

  await step('desktop: Talk offline, five exchanges; the weather answer states the Place panel’s temperature', async () => {
    await page.evaluate(() => window.legion.clock.pause());
    const zip = await page.evaluate(() => window.legion.npcPanel.npc.zip);
    // the Place panel of the NPC's own ZIP, at this (paused) moment
    await page.evaluate(z => window.legion.place(z), zip);
    await page.locator('#place-panel .wx-temp').waitFor({ timeout: 5000 });
    // an estimate (a forecast borrowed from a point nearby, or the climate) reads "≈52°F"; the number is the same
    const temp = (await page.locator('#place-panel .wx-temp').textContent()).trim().replace('°F', '').replace(/^≈/, '');
    expect(/^\d{1,3}$/.test(temp), `Place panel temperature "${temp}"`);
    const id = await page.evaluate(() => window.legion.npcPanel.id);
    // a fresh conversation (a new visit) at the paused time
    await reopenNpc(id);
    await page.click('#npc-tab-talk');
    await page.locator('#npc-tabpanel-talk .bubble.from-npc').first().waitFor({ timeout: 5000 });
    const replies = [];
    for (const q of ['Hi! I’m Sam.', 'How’s the weather today?', 'What do you do for work?', 'How long have you lived here?', 'Where should I eat around here?']) replies.push(await say(q));
    expect(replies.length === 5 && replies.every(r => r.length > 1), `replies ${JSON.stringify(replies)}`);
    expect(new Set(replies).size === 5, 'a line was repeated');
    expect(replies[1].includes(temp), `the weather reply "${replies[1]}" does not say ${temp}°F`);
    // each line shows where its facts come from
    const facts = await page.locator('#npc-tabpanel-talk .bubble.from-npc .fact-btn').count();
    expect(facts >= 1, 'no line shows its facts');
    const firstFacts = await page.locator('#npc-tabpanel-talk .bubble.from-npc .fact-btn').first().getAttribute('title');
    expect(/^From the data: /.test(firstFacts || ''), `facts title "${firstFacts}"`);
    return `${temp}°F in "${replies[1].slice(0, 90)}"; ${facts} lines with facts (${firstFacts.slice(0, 80)})`;
  });

  await step('desktop: someone in crisis gets a note from Legion with 988; a threat ends the conversation for good', async () => {
    const id = await page.evaluate(() => window.legion.npcPanel.id);
    await reopenNpc(id);
    await page.click('#npc-tab-talk');
    await page.locator('#npc-tabpanel-talk .bubble.from-npc').first().waitFor({ timeout: 5000 });
    await say('I want to kill myself.');
    const note = page.locator('#npc-tabpanel-talk .bubble.from-system.is-note');
    await note.first().waitFor({ timeout: 3000 });
    const noteText = (await note.first().textContent()).trim();
    expect(/^Legion:/.test(noteText) && /988/.test(noteText) && /911/.test(noteText), `note "${noteText}"`);
    const npcSays = await page.locator('#npc-tabpanel-talk .bubble.from-npc .bubble-text').allTextContents();
    expect(!npcSays.some(t => /Suicide & Crisis Lifeline/.test(t)), 'the note was put in the NPC’s mouth');
    expect(await page.locator('#npc-tabpanel-talk .talk-input').isEnabled(), 'a crisis line does not end the conversation');
    await say('I am going to burn your house down.');
    await page.waitForFunction(() => { const i = document.querySelector('#npc-tabpanel-talk .talk-input'); return i && i.disabled; }, null, { timeout: 3000 });
    const left = (await page.locator('#npc-tabpanel-talk .talk-left').textContent()).trim();
    expect(/has left the conversation/.test(left), `foot "${left}"`);
    expect(await page.locator('#npc-tabpanel-talk .talk-foot .btn').count() === 0, 'no "Talk again" after the NPC left');
    await reopenNpc(id);
    await page.click('#npc-tab-profile');
    return `note "${noteText.slice(0, 70)}…"; then "${left}"`;
  });

  await step('desktop: a Spanish speaker with limited English answers in Spanish, with the English gloss', async () => {
    const id = await page.evaluate(() => {
      const L = window.legion, w = L.world;
      for (const zip of ['90011', '90255', '93235', '90001', '92335']) {
        const zi = w.indexOf(zip);
        if (zi < 0) continue;
        const n = L.services.population.sample(zi, 80, 1).find(x => x.age >= 25 && x.languages.home === 'spanish' && x.languages.english === 'limited');
        if (n) return n.id;
      }
      return null;
    });
    expect(id, 'no Spanish speaker with limited English found');
    await page.evaluate(i => window.legion.bus.emit('npc:select', { id: i, source: 'link' }), id);
    await page.locator('#npc-panel').waitFor({ state: 'visible', timeout: 5000 });
    await page.click('#npc-tab-talk');
    await page.locator('#npc-tabpanel-talk .bubble.from-npc').first().waitFor({ timeout: 5000 });
    const reply = await say('How are you doing today?');
    const gloss = await page.locator('#npc-tabpanel-talk .bubble.from-npc .bubble-gloss').allTextContents();
    expect(gloss.length >= 1 && gloss.every(g => /^\[.+\]$/.test(g.trim())), `glosses ${JSON.stringify(gloss)}`);
    return `${id}: "${reply.slice(0, 70)}" ${gloss.at(-1).slice(0, 70)}`;
  });

  await step('desktop: while you talk the clock runs in real time, and your speed comes back when you leave the tab', async () => {
    const id = await page.evaluate(() => window.legion.npcPanel.id);
    const start = await page.evaluate(() => window.legion.clock.t);
    await page.click('#npc-tab-profile');
    // the player's speed is 600x; the clock plays only while the Talk tab is open (the later steps keep their hour)
    await page.evaluate(() => { window.legion.clock.pause(); window.legion.clock.setSpeed(600); });
    try {
      await page.click('#npc-tab-talk');
      await page.locator('#npc-tabpanel-talk .talk-clock').waitFor({ timeout: 3000 });
      await page.evaluate(() => window.legion.clock.play());
      const held = await page.evaluate(() => [window.legion.clock.rate, window.legion.clock.speed, document.querySelector('.speeds').classList.contains('is-held'), document.querySelector('.speeds input:checked').value]);
      expect(held[0] === 1 && held[1] === 600 && held[2] && held[3] === '1', `talking: rate ${held[0]}, speed ${held[1]}, marked ${held[2]}, checked ${held[3]}`);
      const t0 = await page.evaluate(() => window.legion.clock.t);
      await page.waitForTimeout(1000);
      const ran = await page.evaluate(t => window.legion.clock.t - t, t0);
      await page.evaluate(() => window.legion.clock.pause());
      expect(ran > 200 && ran < 5000, `the clock ran ${ran} ms in a second of talking`);
      await page.click('#npc-tab-profile');
      const back = await page.evaluate(() => [window.legion.clock.rate, document.querySelector('.speeds input:checked').value]);
      expect(back[0] === 600 && back[1] === '600', `after leaving the tab: rate ${back[0]}, checked ${back[1]}`);
      return `${id}: 1× while talking (${Math.round(ran)} ms in 1 s), 600× again after`;
    } finally {
      await page.evaluate(t => { const c = window.legion.clock; c.pause(); c.setSpeed(60); c.set(t); }, start);
    }
  });

  await step('desktop: a Claude reply cut short by opening someone else stays with its own conversation', async () => {
    const id = await page.evaluate(() => window.legion.npcPanel.id);
    const other = await page.evaluate(i => { const L = window.legion, n = L.services.npc(i); return L.services.residents({ kind: 'zip', zi: n.zi, zis: [n.zi], key: n.zip, title: n.zip }, 3, 4).map(x => x.id).find(x => x !== i); }, id);
    expect(other, 'no second NPC in the ZIP');
    await page.evaluate(() => {
      const svc = window.legion.services;
      window.__realVoice = svc.voice;
      // a voice whose reply streams a few words, then waits until it is cancelled
      const fake = {
        stream(p, m, hist, text, o) {
          return new Promise((resolve, reject) => {
            let said = '', k = 0;
            const words = ['Well, ', 'let me ', 'think '];
            const tick = setInterval(() => { if (k < words.length) { said += words[k++]; o.onText(words[k - 1], said); } }, 80);
            o.signal.addEventListener('abort', () => { clearInterval(tick); const e = new Error('The reply was cancelled.'); e.code = 'aborted'; reject(e); });
          });
        },
        reflect: async () => ({ summary: 'We talked.', facts_about_player: [], affinity_delta: 0, trust_delta: 0, mood: 'neutral', memorable_line: '', follow_up: '' }),
      };
      svc.voice = () => ({ ok: true, value: fake });
    });
    try {
      await page.click('#npc-tab-talk');
      await page.click('label[for="talk-engine-claude"]');
      await page.locator('#npc-tabpanel-talk .talk-input').fill('Hello there, what is new?');
      await page.locator('#npc-tabpanel-talk .talk-input').press('Enter');
      await page.waitForFunction(() => { const b = document.querySelector('#npc-tabpanel-talk .bubble.from-npc.is-streaming .bubble-text'); return b && b.textContent.length > 3; }, null, { timeout: 5000 });
      // the player opens someone else mid-reply
      await page.evaluate(i => window.legion.bus.emit('npc:select', { id: i, source: 'place' }), other);
      await page.waitForFunction(i => window.legion.npcPanel.id === i, other, { timeout: 5000 });
      await page.waitForTimeout(400);
      const now = await page.evaluate(() => ({
        bubbles: [...document.querySelectorAll('#npc-tabpanel-talk .bubble')].map(b => b.textContent),
        lines: (window.legion.npcPanel.talk ? window.legion.npcPanel.talk.lines : []).map(l => `${l.who}: ${l.text}`),
      }));
      expect(!now.bubbles.some(t => /cancelled|let me/.test(t)) && !now.lines.some(t => /cancelled|let me/.test(t)), `the new conversation shows ${JSON.stringify(now)}`);
      return `${other}'s Talk tab: ${now.bubbles.length} bubbles, none from ${id}'s cancelled reply`;
    } finally {
      await page.evaluate(() => { const svc = window.legion.services; if (window.__realVoice) svc.voice = window.__realVoice; });
      await page.evaluate(i => window.legion.bus.emit('npc:select', { id: i, source: 'place' }), id).catch(() => {});
      await page.click('#npc-tab-talk').catch(() => {});
      await page.click('label[for="talk-engine-offline"]').catch(() => {});
      await page.click('#npc-tab-profile').catch(() => {});
    }
  });

  // Close the street view if a failed step left it open, so one failure cannot cascade into the steps after it.
  const leaveStreet = async () => {
    await page.evaluate(() => { const b = document.querySelector('.street-back'); if (b) b.click(); }).catch(() => {});
    await page.waitForFunction(() => !window.legion.street && !document.querySelector('.street-layer'), null, { timeout: 5000 }).catch(() => {});
  };
  /** Calls the page makes to stage.frame (the statewide map and crowd) during `ms` of real time. */
  const mapFramesDuring = ms => page.evaluate(wait => new Promise(resolve => {
    const s = window.legion.stage, own = Object.prototype.hasOwnProperty.call(s, 'frame'), orig = s.frame;
    let n = 0;
    s.frame = function (...a) { n++; return orig.apply(this, a); };
    setTimeout(() => { if (own) s.frame = orig; else delete s.frame; resolve(n); }, wait);
  }), ms);

  await step('desktop: the street view opens from the NPC panel, agents move, and picking one opens its profile', async () => {
    const id = await page.evaluate(() => window.legion.npcPanel.id);
    await page.click('#npc-tab-profile');
    await page.click('.walk-btn');
    try {
      await page.locator('.street-layer').waitFor({ timeout: 5000 });
      await page.waitForFunction(() => { const v = window.legion.street; return v && v.scene && v.stats().agents > 0; }, null, { timeout: 60000 });
      const followed = await page.evaluate(() => window.legion.street.selectedId);
      expect(followed === id, `the view follows ${followed}, not ${id}`);
      // the clock runs: people move on the street
      await page.evaluate(() => { window.legion.clock.setSpeed(60); window.legion.clock.play(); });
      const before = await page.evaluate(() => window.legion.street.agentsOnScreen().map(a => [a.id, a.px, a.py]));
      // meanwhile the statewide map under the street view is neither advanced nor drawn
      const hiddenFrames = await mapFramesDuring(1500);
      const after = await page.evaluate(() => window.legion.street.agentsOnScreen().map(a => [a.id, a.px, a.py]));
      const moved = after.filter(([aid, x, y]) => { const b = before.find(q => q[0] === aid); return b && Math.hypot(b[1] - x, b[2] - y) > 1; }).length;
      const when = await page.evaluate(() => { const c = window.legion.clock; return `${c.parts().label} at ${c.rate}x${c.playing ? '' : ' (paused)'}`; });
      expect(after.length > 0 && moved > 0, `${after.length} agents on screen, ${moved} moved (${when})`);
      expect(hiddenFrames === 0, `the hidden map was drawn ${hiddenFrames} times under the street view`);
      // a note about someone away never takes a click meant for the people under it
      const noteBlocks = await page.evaluate(() => { const n = document.querySelector('.street-presence'); return n && !n.hidden ? getComputedStyle(n).pointerEvents : 'none'; });
      expect(noteBlocks === 'none', `the presence note takes clicks (pointer-events ${noteBlocks})`);
      // a click on another person there opens their profile (the clock paused so they stand still for the click)
      await page.evaluate(() => window.legion.clock.pause());
      await page.waitForTimeout(200);
      // the person the click must open is whoever the view picks at that point (people overlap: a family walking
      // together, a car's length around its driver), among the people a click can reach: not under a panel, the
      // street bar or a note
      const target = await page.evaluate(sel => {
        const v = window.legion.street, r = v.canvas.getBoundingClientRect();
        for (const a of v.agentsOnScreen()) {
          if (a.id === sel) continue;
          const x = r.left + a.px, y = r.top + a.py;
          if (document.elementFromPoint(x, y) !== v.canvas) continue;
          const hit = v.agentAt(a.px, a.py);
          if (hit && hit.id !== sel) return { id: a.id, pick: hit.id, x, y };
        }
        return null;
      }, id);
      if (!target) return `followed ${id}; ${moved} of ${after.length} agents moved; map frames under the street view ${hiddenFrames}; no second agent a click can reach`;
      await page.mouse.click(target.x, target.y);
      await page.waitForFunction(want => window.legion.npcPanel.id === want, target.pick, { timeout: 5000 }).catch(() => {});
      const opened = await page.evaluate(() => [window.legion.npcPanel.id, window.legion.street.selectedId]);
      expect(opened[0] === target.pick && opened[1] === target.pick && /^\d{5}-\d+-\d+$/.test(opened[0]),
        `clicked at ${target.id} (picks ${target.pick}); panel ${opened[0]}, street ${opened[1]}`);
      expect(await page.locator('#npc-tab-profile').getAttribute('aria-selected') === 'true', 'the profile is not the tab shown');
      // and the way back: the map is drawn again at once
      await page.click('.street-back');
      await page.waitForFunction(() => !window.legion.street && !document.querySelector('.street-layer'), null, { timeout: 5000 });
      await page.evaluate(() => window.legion.clock.play());
      const shownFrames = await mapFramesDuring(800);
      await page.evaluate(() => window.legion.clock.pause());
      expect(shownFrames > 0, 'the map was not drawn again after the street view closed');
      return `followed ${id}; ${moved} of ${after.length} agents moved; map frames under the street view ${hiddenFrames}, after ${shownFrames}; clicked ${target.pick}${target.pick === target.id ? '' : ` (beside ${target.id})`} → panel ${opened[0]}`;
    } finally {
      await page.evaluate(() => window.legion.clock.pause()).catch(() => {});
      await leaveStreet();
    }
  });

  await step('desktop: Escape in the street view goes back to the map, from the canvas, with someone selected', async () => {
    const id = await page.evaluate(() => window.legion.npcPanel.id);
    expect(id && await page.locator('#place-panel').isVisible(), 'an NPC and a place are open');
    await page.click('#place-panel .walk-streets');
    try {
      await page.waitForFunction(() => { const v = window.legion.street; return v && v.scene; }, null, { timeout: 60000 });
      // the NPC panel's person is the one selected there; the canvas has the focus
      await page.waitForFunction(i => window.legion.street.selectedId === i, id, { timeout: 5000 });
      expect(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('street-canvas')), 'the street canvas does not have the focus');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !window.legion.street && !document.querySelector('.street-layer'), null, { timeout: 3000 });
      const after = await page.evaluate(() => [window.legion.npcPanel.isOpen(), window.legion.npcPanel.id, document.activeElement && document.activeElement.id]);
      expect(after[0] && after[1] === id, `after Escape the NPC panel shows ${after[1]}`);
      // a second visit, nobody selected: Escape still goes back
      await page.evaluate(() => window.legion.npcPanel.close());
      await page.click('#place-panel .walk-streets');
      await page.waitForFunction(() => { const v = window.legion.street; return v && v.scene; }, null, { timeout: 60000 });
      await page.locator('.street-canvas').focus();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !window.legion.street, null, { timeout: 3000 });
      expect(await page.locator('#place-panel').isVisible(), 'Escape in the street view closed the Place panel too');
      // put the NPC back for the steps after this one
      await page.evaluate(i => window.legion.bus.emit('npc:select', { id: i, source: 'place' }), id);
      await page.locator('#npc-panel').waitFor({ state: 'visible', timeout: 5000 });
      return `back to the map with ${id} still open; then with no one selected`;
    } finally { await leaveStreet(); }
  });

  await step('desktop: the Place panel weather reads clean, and shore-only alerts stay on the coast', async () => {
    const id = await page.evaluate(() => window.legion.npcPanel.id);
    try {
      // Truckee's forecast point has a template placeholder in the snapshot's period text
      await page.evaluate(() => window.legion.place('96161'));
      await page.locator('#place-panel .wx-detail').waitFor({ timeout: 5000 });
      const truckee = (await page.locator('#place-panel .wx-detail').textContent()).trim();
      expect(!/\{\{|\}\}|\.\s*\./.test(truckee) && /Calm wind/.test(truckee), `Truckee reads "${truckee}"`);
      // Lancaster is 81 km inland: the county's coastal alerts are not its weather
      await page.evaluate(() => window.legion.place('93534'));
      await page.locator('#place-panel .wx-temp').waitFor({ timeout: 5000 });
      const alerts = await page.locator('#place-panel .wx-alerts li').allTextContents();
      expect(!alerts.some(a => /coastal|surf|rip current|beach/i.test(a)), `Lancaster lists ${alerts.join(', ')}`);
      return `Truckee: "${truckee}"; Lancaster alerts: ${alerts.join(', ') || 'none'}`;
    } finally {
      await page.evaluate(i => { const L = window.legion, n = L.services.npc(i); if (n) L.place(n.zip); L.bus.emit('npc:select', { id: i, source: 'place' }); }, id).catch(() => {});
      await page.locator('#npc-panel').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    }
  });

  await step('desktop: a failed copy says so, and the JSON size counts bytes', async () => {
    await page.click('#npc-tab-json');
    // no clipboard at all: the async API refuses and the textarea fallback fails
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
      document.execCommand = () => false;
    });
    await page.locator('#npc-tabpanel-json button', { hasText: 'Copy' }).click();
    const toast = page.locator('#toasts .toast').last();
    await toast.waitFor({ timeout: 3000 });
    const kind = await toast.evaluate(el => [el.className, el.textContent]);
    expect(/is-error/.test(kind[0]) && /Copy failed/.test(kind[1]), `toast ${JSON.stringify(kind)}`);
    const size = await page.evaluate(() => {
      const text = document.querySelector('#npc-tabpanel-json pre').textContent;
      return [document.querySelector('#npc-tabpanel-json .json-size').textContent, new TextEncoder().encode(text).length];
    });
    expect(size[0] === `${size[1].toLocaleString('en-US')} bytes`, `size label "${size[0]}" for ${size[1]} bytes`);
    await page.click('#npc-tab-profile');
    return `error toast; ${size[0]}`;
  });

  await step('desktop: the theme toggles to light and back', async () => {
    const before = await page.evaluate(() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor]);
    expect(before[0] === 'dark', `starts ${before[0]}`);
    await page.click('#theme-button');
    const light = await page.evaluate(() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor, JSON.parse(localStorage.getItem('legion.settings.v1')).theme]);
    expect(light[0] === 'light' && light[1] !== before[1] && light[2] === 'light', `after toggle ${JSON.stringify(light)}`);
    await page.click('#theme-button');
    const dark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(dark === 'dark', `toggled back to ${dark}`);
    return `${before[1]} → ${light[1]} → back`;
  });

  await step('desktop: Settings opens with density, theme, Claude and network, and Escape closes it', async () => {
    await page.click('#settings-button');
    const dialog = page.locator('#settings-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 3000 });
    const text = await dialog.textContent();
    for (const word of ['Crowd density', 'agents', 'Theme', 'Claude', 'API key', 'Remember the key on this device', 'Model', 'Effort', 'Network', 'Claude API', 'Live NWS weather', 'OpenStreetMap streets']) expect(text.includes(word), `missing "${word}"`);
    expect(await dialog.locator('input[name=density]').count() === 5, 'five densities');
    const models = await dialog.locator('select option').evaluateAll(o => o.map(x => x.value));
    expect(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'].every(m => models.includes(m)), `models ${models}`);
    expect(await dialog.locator('select').inputValue() === 'claude-opus-5-5', 'Opus is not the default');
    const efforts = await dialog.locator('input[name=effort]').evaluateAll(o => o.filter(x => x.checked).map(x => x.value));
    expect(efforts[0] === 'low', `effort ${efforts}`);
    // live weather is real now: allowed by its own switch, off until the player turns it on
    const nws = dialog.locator('.toggle-row', { hasText: 'Live NWS weather' });
    const nwsState = await nws.evaluate(row => [row.classList.contains('is-pending'), row.querySelector('input').disabled, row.querySelector('input').checked, row.textContent]);
    expect(!nwsState[0] && !nwsState[1] && !nwsState[2] && /api\.weather\.gov/.test(nwsState[3]), `NWS switch ${JSON.stringify(nwsState)}`);
    const modules = await dialog.locator('.module-list li').evaluateAll(li => li.map(x => [x.querySelector('.module-name').textContent, x.querySelector('.module-state').textContent]));
    expect(modules.length === 7 && modules.every(m => m[1] === 'Ready'), `engine modules ${JSON.stringify(modules)}`);
    expect(await dialog.locator('.toggle-row', { hasText: 'OpenStreetMap streets' }).locator('input').isEnabled(), 'the OpenStreetMap switch is disabled');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('settings-dialog').open, null, { timeout: 2000 });
    return `${models.length} models`;
  });

  await step('desktop: the play button and Space start and stop the clock; the speeds switch', async () => {
    await page.click('.play-btn');
    const a = await page.evaluate(() => [window.legion.clock.playing, document.querySelector('.play-btn').getAttribute('aria-pressed')]);
    expect(a[0] === true && a[1] === 'true', `after the play button ${JSON.stringify(a)}`);
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await page.keyboard.press(' ');
    expect(await page.evaluate(() => window.legion.clock.playing) === false, 'Space did not pause');
    await page.click('label[for="speed-3600"]');
    expect(await page.evaluate(() => window.legion.clock.speed) === 3600, 'speed 3600x not chosen');
    await page.click('label[for="speed-60"]');
    const c = await page.evaluate(() => window.legion.clock.speed);
    expect(c === 60, `speed ${c}`);
    // the speed radio keeps focus after a click, the scrubber after a drag: Space still plays and pauses (ux-1005)
    const wasPlaying = await page.evaluate(() => window.legion.clock.playing);
    await page.keyboard.press(' ');
    expect(await page.evaluate(() => window.legion.clock.playing) === !wasPlaying, 'Space after choosing a speed');
    await page.locator('.clock .scrubber').focus();
    await page.keyboard.press(' ');
    expect(await page.evaluate(() => window.legion.clock.playing) === wasPlaying, 'Space with the scrubber focused');
    if (await page.evaluate(() => window.legion.clock.playing)) await page.evaluate(() => window.legion.clock.pause());
    const label = await page.locator('.clock-time').textContent();
    expect(/\d{1,2}:\d{2} [AP]M/.test(label), `clock shows ${label}`);
    return `clock ${label}`;
  });

  await step('desktop: Escape closes the NPC panel, then the Place panel', async () => {
    await page.keyboard.press('Escape');
    expect(await page.locator('#npc-panel').isHidden(), 'NPC panel still open');
    expect(await page.locator('#place-panel').isVisible(), 'Place panel closed too early');
    await page.keyboard.press('Escape');
    expect(await page.locator('#place-panel').isHidden(), 'Place panel still open');
    return 'both closed';
  });

  await step('desktop: clicking the map where no one stands selects the ZIP under the cursor', async () => {
    const target = await page.evaluate(() => {
      const L = window.legion, m = L.map, w = L.world, r = document.getElementById('map').getBoundingClientRect();
      if (!m) return null;
      const scale = L.stage.scale();
      for (let gy = 0.35; gy < 0.8; gy += 0.03) for (let gx = 0.3; gx < 0.75; gx += 0.03) {
        const px = Math.round(r.width * gx), py = Math.round(r.height * gy), p = m.screenToWorld(px, py);
        const zi = w.zipAt(p.x, p.y);
        if (zi < 0) continue;
        const hit = L.crowd && typeof L.crowd.pick === 'function' ? L.crowd.pick(p.x, p.y, 16 / scale) : null;
        if (!hit) return { px, py, zip: w.zips[zi] };
      }
      return null;
    });
    expect(target, 'no empty spot over a ZIP');
    await page.locator('#map').click({ position: { x: target.px, y: target.py } });
    const panel = page.locator('#place-panel');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    const sub = await panel.locator('.panel-sub').textContent();
    expect(sub.includes(target.zip), `opened "${sub}", expected ${target.zip}`);
    return `ZIP ${target.zip}`;
  });

  await step('desktop: clicking an agent opens that NPC', async () => {
    const target = await page.evaluate(() => {
      const L = window.legion, m = L.map, crowd = L.crowd, r = document.getElementById('map').getBoundingClientRect();
      if (!m || !crowd || typeof crowd.pick !== 'function' || !(L.stage.build.agents > 0)) return { none: true };
      const scale = L.stage.scale();
      for (let gy = 0.2; gy < 0.9; gy += 0.04) for (let gx = 0.35; gx < 0.9; gx += 0.04) {
        const p = m.screenToWorld(r.width * gx, r.height * gy);
        const hit = crowd.pick(p.x, p.y, 40 / scale);
        if (!hit || !Number.isFinite(hit.x)) continue;
        const sp = m.worldToScreen(hit.x, hit.y);
        if (sp.px < 420 || sp.px > r.width - 460 || sp.py < 40 || sp.py > r.height - 80) continue;   // clear of the panels and legend
        const id = typeof hit.id === 'string' ? hit.id : `${hit.zip}-${hit.h}-${hit.m}`;
        return { px: Math.round(sp.px), py: Math.round(sp.py), id };
      }
      return { none: true, agents: L.stage.build.agents };
    });
    if (target.none) return target.agents ? 'no agent in view to click' : 'skipped: the crowd has no agents (provisional stub)';
    await page.locator('#map').click({ position: { x: target.px, y: target.py } });
    const panel = page.locator('#npc-panel');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    const id = (await panel.locator('.npc-id').textContent()).trim();
    expect(/^\d{5}-\d+-\d+$/.test(id), `panel shows "${id}"`);
    return id === target.id ? `opened ${id}` : `opened ${id} (the agent nearest the click; aimed at ${target.id})`;
  });

  await step('desktop: search finds a county by name, and a Census place opens its own ZIPs', async () => {
    const choose = async (query, wantFirst) => {
      await page.locator('#search-input').fill('');
      await page.locator('#search-input').focus();
      await page.keyboard.type(query);
      const first = page.locator('#search-list [role=option]').first();
      await first.waitFor({ timeout: 5000 });
      const options = await page.locator('#search-list [role=option] .opt-main').allTextContents();
      const tags = await page.locator('#search-list [role=option] .opt-kind').allTextContents();
      expect(options[0] === wantFirst, `"${query}" offers ${options.join(' | ')}`);
      expect(new Set(options).size === options.length || query === 'Sacramento', `"${query}" repeats a row: ${options.join(' | ')}`);
      await page.keyboard.press('Enter');
      const place = page.locator('#place-panel');
      await place.waitFor({ state: 'visible', timeout: 5000 });
      return { options, tags, eyebrow: (await place.locator('.eyebrow').first().textContent()).trim(), title: (await place.locator('.panel-title').textContent()).trim(), sub: (await place.locator('.panel-sub').textContent()).trim() };
    };
    const county = await choose('Los Angeles County', 'Los Angeles County');
    expect(county.eyebrow === 'County' && county.title === 'Los Angeles County', `opened ${county.eyebrow} ${county.title}`);
    const eastLA = await choose('East Los', 'East Los Angeles');
    expect(eastLA.tags[0] === 'Community', `East Los Angeles is tagged ${eastLA.tags[0]}`);
    expect(eastLA.eyebrow === 'Community' && eastLA.title === 'East Los Angeles' && /2 ZIPs/.test(eastLA.sub), `opened ${eastLA.eyebrow} ${eastLA.title} (${eastLA.sub})`);
    const sac = await choose('Sacramento', 'Sacramento');
    expect(sac.options.includes('Sacramento County'), `Sacramento offers ${sac.options.join(' | ')}`);
    expect(sac.tags[0] === 'City' && sac.tags[1] === 'Postal city', `Sacramento rows are tagged ${sac.tags.join(' | ')}`);
    expect(sac.eyebrow === 'City' && /17 ZIPs/.test(sac.sub), `opened ${sac.eyebrow} ${sac.title} (${sac.sub})`);
    const hash = await page.evaluate(() => location.hash);
    expect(new URLSearchParams(hash.slice(1)).get('place') === 'Sacramento', `the deep link is ${hash}`);
    await page.keyboard.press('Escape');
    return `${county.title}; ${eastLA.title} (${eastLA.sub}); ${sac.title} (${sac.sub}) of ${sac.options.join(' | ')}`;
  });

  await step('desktop: no page errors', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); return 'none'; });

  // The finished crowd is kept on the device (IndexedDB, under this build of Legion.html): the next visit loads it
  // instead of fitting every ZIP's models again, after the same spot check against the page's population.
  await step('desktop: a second visit loads the crowd kept on this device, the same agents', async () => {
    const first = await page.evaluate(async () => {
      const L = window.legion, kept = L.crowd && L.crowd.cacheWrite ? await L.crowd.cacheWrite : false;
      return { kept, agents: L.stage.build.agents, ms: L.stage.build.ms, mode: L.stage.build.summary && L.stage.build.summary.mode };
    });
    expect(first.kept === true, `the first build was not kept (${JSON.stringify(first)})`);
    const t0 = Date.now();
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.state === 'ready', null, { timeout: 90000 });
    const b = await waitForCrowd(page);
    const took = Date.now() - t0;
    const s = await page.evaluate(() => { const x = window.legion.stage.build.summary || {}; return { mode: x.mode, cached: x.cached, verified: x.verified, agents: window.legion.crowd.count }; });
    expect(s.mode === 'cache' && s.cached === true && s.verified > 0, `second visit built in mode ${s.mode} (${JSON.stringify(s)})`);
    expect(b.agents === first.agents && s.agents === first.agents, `${b.agents} agents now, ${first.agents} the first time`);
    // the kept crowd is the crowd: a pick works on it
    const picked = await page.evaluate(() => {
      const c = window.legion.crowd, ch = c.chunks.find(x => x.count && !(x.ids[0] & 0x80000000));
      if (!ch) return null;
      const u = ch.ids[0] >>> 0, id = `${window.legion.world.zips[u >>> 20]}-${(u >>> 4) & 0xffff}-${u & 15}`, p = c.positionOf(id);
      return p && p.id === id ? id : `none for ${id}`;
    });
    expect(picked && !/^none/.test(picked), `the kept crowd cannot find its own agent: ${picked}`);
    await page.evaluate(() => window.legion.clock.pause());
    return `${first.agents} agents in ${Math.round(first.ms)} ms the first time (${first.mode}); ${Math.round(b.ms)} ms from this device the second (page ready to crowd: ${took} ms)`;
  });
  await step('desktop: no page errors after the second visit', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); return 'none'; });
  await context.close();
}

// ------------------------------------------------------------------ a damaged file

/** Copies of Legion.html whose inline pack was cut short or had bytes changed (an incomplete download). */
function damagedCopies(dir) {
  const html = fs.readFileSync(PAGE, 'utf8');
  const m = /window\.__LEGION_PACK__="([A-Za-z0-9+/=]+)"/.exec(html);
  if (!m) throw new Error('Legion.html has no inline pack');
  const b64 = m[1], mid = Math.floor(b64.length / 2);
  const variants = {
    truncated: b64.slice(0, mid - (mid % 4)),
    altered: b64.slice(0, mid) + 'A'.repeat(4000) + b64.slice(mid + 4000),
    'not base64': `${b64.slice(0, mid)}%%%%${b64.slice(mid + 4)}`,
  };
  return Object.entries(variants).map(([name, pack]) => {
    const file = path.join(dir, `${name.replace(/\W+/g, '-')}.html`);
    fs.writeFileSync(file, html.replace(m[0], () => `window.__LEGION_PACK__="${pack}"`));
    return { name, file };
  });
}

async function damaged(browser) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-e2e-'));
  try {
    for (const { name, file } of damagedCopies(dir)) {
      await step(`damaged file (${name} pack): says the pack is damaged, at the step that failed`, async () => {
        const { context, page } = await openPage(browser, { viewport: { width: 1024, height: 768 } });
        try {
          const state = await settle(page, pathToFileURL(file).href);
          expect(state === 'error', `the page reached "${state}"`);
          const err = await page.evaluate(() => [document.querySelector('.boot-error p').textContent, document.querySelector('.boot-error p + p') && document.querySelector('.boot-error p + p').textContent]);
          expect(/world pack inside this file is damaged/.test(err[0]), `message "${err[0]}"`);
          expect(/Download Legion\.html again/.test(err[1] || ''), `hint "${err[1]}"`);
          const failed = await page.locator('#boot-steps li.is-failed').allTextContents();
          expect(failed.length === 1 && /Unpacking the world pack/.test(failed[0]), `failed steps ${JSON.stringify(failed)}`);
          return err[0];
        } finally { await context.close(); }
      });
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ------------------------------------------------------------------ served by the Legion server

/**
 * The page opened from server/serve.mjs, once with an Anthropic key on the server and once without: it must use the
 * proxy path the server advertises only when the server holds a key, and otherwise keep the player's own key. A
 * fake ClaudeVoice records what services would hand the real one; no request reaches Anthropic.
 */
async function served(browser) {
  const { createServer } = await import(pathToFileURL(path.join(LEGION, 'server/serve.mjs')).href);
  for (const [label, env] of [['a server with a key', { ANTHROPIC_API_KEY: 'sk-ant-e2e-placeholder' }], ['a server without a key', {}]]) {
    const server = createServer({ root: LEGION, env, log: () => {} });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const { context, page, errors } = await openPage(browser, { viewport: { width: 1280, height: 800 } });
    try {
      await step(`served by ${label}: Claude goes where /api/health says`, async () => {
        await boot(page, `${origin}/`);
        await page.evaluate(() => window.legion.clock.pause());   // a still map keeps software WebGL from slowing every click
        const health = await page.evaluate(async () => (await fetch('/api/health')).json());
        expect(health.service === 'legion' && typeof health.proxy === 'string', `health ${JSON.stringify(health)}`);
        await page.evaluate(() => {
          window.legion.services.wire({ llm: { ClaudeVoice: class { constructor(o) { window.__voiceOptions = { apiKey: o.apiKey || null, proxyURL: o.proxyURL || null }; } } } });
          window.legion.settings.setApiKey('sk-ant-player-key');
          window.legion.settings.set({ network: { claude: true } });
        });
        await page.waitForFunction(() => window.legion.settings.server !== null, null, { timeout: 5000 });
        const s = await page.evaluate(() => {
          const L = window.legion;
          const v = L.services.voice(L.settings.get());
          return { proxyURL: L.settings.proxyURL, keyConfigured: L.settings.server.keyConfigured, voice: v.ok ? window.__voiceOptions : v.message };
        });
        await page.click('#settings-button');
        const line = (await page.locator('#settings-dialog .set-help[aria-live]').first().textContent()).trim();
        await page.keyboard.press('Escape');
        if (health.keyConfigured) {
          expect(s.proxyURL === health.proxy && s.keyConfigured, `proxy "${s.proxyURL}" for a server that advertises "${health.proxy}"`);
          expect(s.voice && s.voice.proxyURL === health.proxy && !s.voice.apiKey, `the voice got ${JSON.stringify(s.voice)}`);
          expect(/Legion server’s Claude proxy/.test(line), `Settings says "${line}"`);
          // the advertised path is the one the server routes (a 400 for an empty body, not a 404)
          const status = await page.evaluate(async p => (await fetch(`${p}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, s.proxyURL);
          expect(status === 400, `POST ${s.proxyURL}/v1/messages answered ${status}`);
          return `proxy ${s.proxyURL}; the player's key stays in the page`;
        }
        expect(s.proxyURL === '' && s.keyConfigured === false, `proxy "${s.proxyURL}" for a server without a key`);
        expect(s.voice && s.voice.apiKey === 'sk-ant-player-key' && !s.voice.proxyURL, `the voice got ${JSON.stringify(s.voice)}`);
        expect(/server has no Anthropic key/.test(line), `Settings says "${line}"`);
        return 'no proxy; the player’s own key is used';
      });
      await step(`served by ${label}: no page errors`, async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); return 'none'; });
    } finally {
      await context.close();
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
}

// ------------------------------------------------------------------ Claude through the Legion server

/** A fake Anthropic upstream for server/serve.mjs: streams a reply slowly, answers the reflection, records requests. */
function fakeUpstream() {
  const calls = [];
  const chunks = ['Hey there! ', 'The fog rolled in early today, ', 'but it should burn off ', 'by noon.'];
  const reflection = { summary: 'A visitor named Sam asked me about the fog.', facts_about_player: ['is named Sam'], affinity_delta: 0.1, trust_delta: 0.05, mood: 'content', memorable_line: 'Will the fog burn off?', follow_up: 'Ask Sam how the visit went.' };
  async function* events(model) {
    yield { type: 'message_start', message: { id: 'msg_e2e', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 41, output_tokens: 1, cache_read_input_tokens: 1300, cache_creation_input_tokens: 0 } } };
    yield { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } };
    for (const c of chunks) { await new Promise(r => setTimeout(r, 350)); yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: c } }; }
    yield { type: 'content_block_stop', index: 0 };
    yield { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 18 } };
    yield { type: 'message_stop' };
  }
  return {
    calls, reply: chunks.join(''), reflection,
    factory: () => ({
      beta: { messages: { create: async params => {
        calls.push(params);
        if (params.stream) return events(params.model);
        return { id: 'msg_r', type: 'message', role: 'assistant', model: params.model, content: [{ type: 'text', text: JSON.stringify(reflection) }], stop_reason: 'end_turn', usage: { input_tokens: 30, output_tokens: 60 } };
      } } },
      models: { retrieve: async id => ({ id, type: 'model', display_name: id }) },
    }),
  };
}

async function claude(browser) {
  const { createServer } = await import(pathToFileURL(path.join(LEGION, 'server/serve.mjs')).href);
  const up = fakeUpstream();
  // the key in the server's environment only makes /api/health report one; the fake upstream answers every request
  const server = createServer({ root: LEGION, env: { ANTHROPIC_API_KEY: 'sk-ant-e2e-placeholder' }, clientFactory: up.factory, log: () => {} });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { context, page, errors } = await openPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await step('Claude through the Legion server: the reply streams into the Talk tab, and the mind keeps the conversation', async () => {
      await boot(page, `${origin}/`);
      await page.evaluate(() => { window.legion.clock.pause(); window.legion.settings.set({ network: { claude: true } }); });
      await page.waitForFunction(() => window.legion.settings.proxyURL === '/api/anthropic', null, { timeout: 5000 });
      await page.evaluate(() => window.legion.place('94110'));
      await page.locator('#place-panel .resident').first().click();
      await page.locator('#npc-panel').waitFor({ state: 'visible', timeout: 5000 });
      const id = await page.evaluate(() => window.legion.npcPanel.id);
      await page.click('#npc-tab-talk');
      await page.click('label[for="talk-engine-claude"]');
      const engine = (await page.locator('#npc-tabpanel-talk .talk-engine').textContent()).trim();
      expect(/Claude Opus 5\.5, through the Legion server/.test(engine), `engine line "${engine}"`);
      await page.locator('#npc-tabpanel-talk .talk-input').fill('Hi, I’m Sam. Will the fog burn off?');
      await page.locator('#npc-tabpanel-talk .talk-input').press('Enter');
      // mid-stream: part of the reply is on screen while the bubble is still streaming
      const partial = await page.waitForFunction(full => {
        const b = document.querySelector('#npc-tabpanel-talk .bubble.from-npc.is-streaming .bubble-text');
        const t = b ? b.textContent : '';
        return t && t.length < full.length ? t : null;
      }, up.reply, { timeout: 10000 }).then(h => h.jsonValue());
      await page.waitForFunction(full => {
        const b = [...document.querySelectorAll('#npc-tabpanel-talk .bubble.from-npc')].pop();
        return b && !b.classList.contains('is-streaming') && b.querySelector('.bubble-text').textContent === full;
      }, up.reply, { timeout: 15000 });
      const meta = (await page.locator('#npc-tabpanel-talk .bubble.from-npc .bubble-meta').last().textContent()).trim();
      expect(/claude-opus-5-5/.test(meta), `meta "${meta}"`);
      // what reached Anthropic: three cache breakpoints, the situation after the player's line, no key from the page
      const turn = up.calls.find(c => c.stream);
      expect(turn && turn.system.length === 2 && turn.system.every(b => b.cache_control), 'the system blocks');
      expect(JSON.stringify(turn).match(/"cache_control"/g).length === 3, 'three cache breakpoints');
      expect(turn.messages.at(-1).role === 'system' && /Situation for this turn/.test(turn.messages.at(-1).content), 'the situation note');
      // a second turn carries the first as history
      await page.locator('#npc-tabpanel-talk .talk-input').fill('Thanks!');
      await page.locator('#npc-tabpanel-talk .talk-input').press('Enter');
      await page.waitForFunction(() => document.querySelectorAll('#npc-tabpanel-talk .bubble.from-npc:not(.is-streaming)').length >= 2 && !document.querySelector('#npc-tabpanel-talk .is-streaming'), null, { timeout: 15000 });
      const turns = up.calls.filter(c => c.stream);
      expect(turns.length === 2 && turns[1].messages.length === turns[0].messages.length + 3, 'the history of the first turn');
      // leaving reflects the conversation into the NPC's mind (llm.reflect, stored through the mind)
      await page.click('#npc-panel [aria-label="Close NPC"]');
      await page.waitForFunction(i => {
        const m = window.legion.services.mind(i);
        return m.ok && m.value.toJSON().memory.some(x => x.text === 'A visitor named Sam asked me about the fog.');
      }, id, { timeout: 10000 });
      const mind = await page.evaluate(i => { const m = window.legion.services.mind(i).value; return { facts: m.relationship('player').facts.map(f => f.text), heard: m.toJSON().memory.filter(x => /The player said/.test(x.text)).length }; }, id);
      expect(mind.facts.includes('is named Sam'), `facts ${JSON.stringify(mind.facts)}`);
      expect(mind.heard >= 2, 'the player\'s lines are not in the mind');
      expect(up.calls.some(c => !c.stream && c.output_config && c.output_config.format), 'no reflection request');
      return `streamed "${partial}" … "${up.reply}"; ${turns.length} turns; reflected into ${id}`;
    });
    await step('Claude through the Legion server: no page errors', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); return 'none'; });
  } finally {
    await context.close();
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

// ------------------------------------------------------------------ phone

async function phone(browser) {
  const { context, page, errors } = await openPage(browser, { viewport: { width: 390, height: 844 }, mobile: true });
  if (!await step('phone: boots to ready', async () => { await boot(page); return 'ready'; })) { await context.close(); return; }
  await waitForCrowd(page).catch(() => {});
  await page.keyboard.press(' ');   // pause: a still page keeps software WebGL from slowing every tap
  await step('phone: 390 px wide with no horizontal scroll, and the legend inside the screen', async () => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(w[0] <= 390 && w[1] === 390, `scrollWidth ${w[0]}, innerWidth ${w[1]}`);
    const chips = await page.locator('.legend .legend-chip').evaluateAll(cs => cs.map(c => { const r = c.getBoundingClientRect(); return [c.textContent.trim(), Math.round(r.left), Math.round(r.right)]; }));
    expect(chips.length >= 5 && chips.every(([, l, r]) => l >= 0 && r <= 390), `legend chips ${JSON.stringify(chips)}`);
    return `${w[0]} px; ${chips.length} legend chips inside`;
  });
  await step('phone: search opens the Place sheet and a resident opens the NPC sheet', async () => {
    await page.locator('#search-input').tap();
    await page.keyboard.type('94110');
    await page.locator('#search-list [role=option]').first().waitFor({ timeout: 5000 });
    await page.keyboard.press('Enter');
    const place = page.locator('#place-panel');
    await place.waitFor({ state: 'visible', timeout: 5000 });
    const box = await place.boundingBox();
    expect(box && box.x <= 1 && box.width >= 388 && box.y > 200, `place sheet at ${JSON.stringify(box)}`);
    await place.locator('.resident').first().tap();
    const npc = page.locator('#npc-panel');
    await npc.waitFor({ state: 'visible', timeout: 5000 });
    expect(/^\d{1,3}$/.test((await npc.locator('.npc-age').textContent()).trim()), 'no age');
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w <= 390, `scrollWidth ${w} with the sheets open`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(HERE, 'app-phone.png') });
    return 'tests/e2e/app-phone.png written';
  });
  await step('phone: no page errors', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); return 'none'; });
  await context.close();
}

// ------------------------------------------------------------------ main

async function main() {
  if (!args.includes('--no-build')) {
    const { build } = await import(pathToFileURL(path.join(LEGION, 'tools/build.mjs')).href);
    const r = await build({ quiet: true });
    console.log(`built Legion.html (${(r.bytes / 1048576).toFixed(2)} MB, build ${r.id}${r.worker ? ', with the crowd worker' : ''})`);
  }
  if (!fs.existsSync(PAGE)) { console.error(`${PAGE} does not exist; run node tools/build.mjs`); process.exit(1); }
  const pw = await loadPlaywright();
  const { chromium } = pw.default || pw;
  const browser = await chromium.launch({
    headless: !args.includes('--headed'),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const t0 = Date.now();
  try {
    await desktop(browser);
    await damaged(browser);
    await served(browser);
    await claude(browser);
    await phone(browser);
  } finally {
    await browser.close();
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed (${((Date.now() - t0) / 1000).toFixed(1)} s, density ${DENSITY})`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
