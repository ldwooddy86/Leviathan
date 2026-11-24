#!/usr/bin/env node
// Legion · end to end: the built Legion.html in headless Chromium.
//
//   node tests/e2e/run.mjs                 build, then test desktop (1440 x 900) and phone (390 x 844)
//   node tests/e2e/run.mjs --no-build      test the existing Legion.html
//   node tests/e2e/run.mjs --density=0.025 run the crowd at another density (default 0.005 keeps software WebGL quick)
//   node tests/e2e/run.mjs --headed        watch it
//
// Checks: boot without page errors; the map canvas draws pixels; '/' focuses search and '94110' flies the map to
// the Mission and opens the Place panel (San Francisco); a resident opens the NPC panel on Profile with a name and
// an age; every tab renders; the theme toggles both ways; Settings opens with density, theme, Claude and network
// and closes on Escape; Space pauses the clock; Escape closes the panels; the phone layout has no horizontal
// scroll and shows the panels as sheets. Screenshots: tests/e2e/app.png and tests/e2e/app-phone.png.
// Works with the provisional crowd stub (0 agents) and with the real crowd. Exits 1 on any failure.

import fs from 'node:fs';
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

async function boot(page) {
  await page.goto(pathToFileURL(PAGE).href);
  await page.waitForFunction(() => ['ready', 'error'].includes(document.documentElement.dataset.state), null, { timeout: 90000 });
  const state = await page.evaluate(() => document.documentElement.dataset.state);
  if (state !== 'ready') {
    const why = await page.evaluate(() => (document.querySelector('.boot-error') || {}).textContent || 'unknown');
    throw new Error(`boot failed: ${why}`);
  }
}

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
    return `12 residents; fidelity bars ${fidelity ? 'shown' : 'hidden (the population reports none)'}`;
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

  await step('desktop: no page errors', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); return 'none'; });
  await context.close();
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
    await phone(browser);
  } finally {
    await browser.close();
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed (${((Date.now() - t0) / 1000).toFixed(1)} s, density ${DENSITY})`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
