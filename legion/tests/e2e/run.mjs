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
// renders; with small fake engine modules wired, Talk keeps its conversation when the open NPC is chosen again, its
// starters are the NPC's own, and Claude errors speak as Legion; a failed copy says so and the JSON size counts
// bytes; the theme toggles both ways; Settings opens with density, theme, Claude and network (live weather shown as
// a later build) and closes on Escape; Space pauses the clock; Escape closes the panels; search finds counties by
// name and Census places by their own ZIPs. A damaged inline pack fails with a plain message at the step that
// failed. Served by server/serve.mjs with and without a key, the page uses the proxy the server advertises only
// when it holds a key. The phone layout has no horizontal scroll and shows the panels as sheets.
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

  // The page's dialogue and Claude modules arrive with a later build; services.wire plugs small fakes in for these
  // steps (and unplugs them after), so the Talk tab runs its real code against them.
  const reopenNpc = async id => {
    await page.evaluate(() => window.legion.bus.emit('npc:select', { id: null }));
    await page.locator(`#place-panel .resident[data-id="${id}"]`).click();
    await page.locator('#npc-panel').waitFor({ state: 'visible', timeout: 5000 });
  };
  const talkBubbles = () => page.locator('#npc-tabpanel-talk .talk-log .bubble').count();

  await step('desktop: Talk keeps the conversation when the open NPC is chosen again', async () => {
    const id = await page.evaluate(() => window.legion.npcPanel.id);
    await page.evaluate(() => window.legion.services.wire({
      persona: { persona: (world, npc) => ({ id: npc.id, npc }) },
      dialogue: { Conversation: class { greet() { return { text: 'Hey, good to meet you.', intent: 'greeting' }; } reply(text) { return { text: `You said: ${text}`, intent: 'unknown' }; } farewell() { return { text: 'Take care.' }; } } },
    }));
    await reopenNpc(id);
    await page.click('#npc-tab-talk');
    await page.locator('#npc-tabpanel-talk .talk-input').fill('How is the fog today?');
    await page.locator('#npc-tabpanel-talk .talk-input').press('Enter');
    expect(await talkBubbles() === 3, `${await talkBubbles()} bubbles after one exchange`);
    // the same NPC again: from the resident list, from their dot on the map, and from search
    await page.locator(`#place-panel .resident[data-id="${id}"]`).click();
    await page.evaluate(i => window.legion.bus.emit('npc:select', { id: i, source: 'map' }), id);
    await page.evaluate(i => window.legion.bus.emit('npc:select', { id: i, source: 'search' }), id);
    const after = await page.evaluate(() => [window.legion.npcPanel.tab, window.legion.npcPanel.talk && window.legion.npcPanel.talk.lines.length]);
    expect(after[0] === 'talk' && after[1] === 3, `after choosing the same NPC again: tab ${after[0]}, ${after[1]} lines`);
    expect(await talkBubbles() === 3, `${await talkBubbles()} bubbles shown`);
    // the starters are this NPC's: the Mission has no fire in the pack, so none asks about one
    const starters = await page.locator('#npc-tabpanel-talk .starters .chip').allTextContents();
    expect(starters.length >= 5 && !starters.some(s => /fire/i.test(s)), `starters ${starters.join(' | ')}`);
    expect(starters.includes('How long have you lived here?'), `starters ${starters.join(' | ')}`);
    return `3 lines kept; starters: ${starters.join(' | ')}`;
  });

  await step('desktop: Claude errors speak as Legion, not as the NPC', async () => {
    const id = await page.evaluate(() => window.legion.npcPanel.id);
    await page.evaluate(() => window.legion.services.wire({ llm: { ClaudeVoice: class { async stream() { return { text: 'unused' }; } } } }));
    await reopenNpc(id);
    await page.click('#npc-tab-talk');
    await page.click('label[for="talk-engine-claude"]');
    await page.locator('#npc-tabpanel-talk .talk-input').fill('Hi');
    await page.locator('#npc-tabpanel-talk .talk-input').press('Enter');
    const system = page.locator('#npc-tabpanel-talk .bubble.from-system');
    await system.first().waitFor({ timeout: 3000 });
    const said = (await system.first().textContent()).trim();
    expect(/^Legion:\s*Allow the Claude API in Settings/.test(said), `system line "${said}"`);
    const npcSays = await page.locator('#npc-tabpanel-talk .bubble.from-npc').allTextContents();
    expect(!npcSays.some(t => /Allow the Claude API/.test(t)), 'the error was put in the NPC’s mouth');
    await page.evaluate(() => window.legion.services.wire({ persona: null, dialogue: null, llm: null }));
    await reopenNpc(id);
    await page.click('#npc-tab-profile');
    return `"${said.replace(/\s+/g, ' ')}"`;
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
    // nothing in this build refreshes the weather live, so its switch says so instead of pretending
    const nws = dialog.locator('.toggle-row', { hasText: 'Live NWS weather' });
    const nwsState = await nws.evaluate(row => [row.classList.contains('is-pending'), row.querySelector('input').disabled, row.querySelector('input').checked, row.textContent]);
    expect(nwsState[0] && nwsState[1] && !nwsState[2] && /later build/i.test(nwsState[3]), `NWS switch ${JSON.stringify(nwsState)}`);
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

// ------------------------------------------------------------------ phone

async function phone(browser) {
  const { context, page, errors } = await openPage(browser, { viewport: { width: 390, height: 844 }, mobile: true });
  if (!await step('phone: boots to ready', async () => { await boot(page); return 'ready'; })) { await context.close(); return; }
  await waitForCrowd(page).catch(() => {});
  await page.keyboard.press(' ');   // pause: a still page keeps software WebGL from slowing every tap
  await step('phone: 390 px wide with no horizontal scroll', async () => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(w[0] <= 390 && w[1] === 390, `scrollWidth ${w[0]}, innerWidth ${w[1]}`);
    return `${w[0]} px`;
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
    await phone(browser);
  } finally {
    await browser.close();
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed (${((Date.now() - t0) / 1000).toFixed(1)} s, density ${DENSITY})`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
