// End-to-end test of the street view in a real browser: `node tests/e2e/street.e2e.mjs` from legion/.
//
// Serves legion/ over http and opens src/world/street-dev.html: the Mission District (94110) on a weekday at 8:00
// and Florence-Graham (90001) at 22:00. Each run waits for the scene, lets the street settle, saves a screenshot
// (tests/e2e/street-day.png, tests/e2e/street-night.png) and checks: many people moving; no page errors; the
// canvas is drawn; then a click on an agent selects a real NPC (the population resolves the id and the select
// event carries it). Day and night must differ clearly in mean brightness. Then: Irvine (92620) runs through the
// morning at 60x without a page error (a walker once froze the view at 7:15); the frame stays within budget at
// 300x and 1800x; and with OpenStreetMap allowed, an Overpass answer in its real shape (ways without node ids)
// gives real streets and a v2 tile cache.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDefaultWorld } from '../../src/engine/world.mjs';
import { atPacific } from '../../src/engine/clock.mjs';
import { Frame } from '../../src/world/street-geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
let pw;
try { pw = await import('playwright'); } catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.gz': 'application/octet-stream' };
let server, base, browser;
const brightness = {};

before(async () => {
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await pw.chromium.launch();
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(r => server.close(r));
});

/** Open the street dev page at a ZIP and time, wait for the scene and for the street to fill. */
async function openStreet(query) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/src/world/street-dev.html?${query}`);
  await page.waitForFunction(() => window.__streetDev && (window.__streetDev.ready || window.__streetDev.error), null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__streetDev.error);
  assert.equal(err, null, `dev page failed: ${err}`);
  // let tiles render and the simulation run a few seconds of real time
  await page.waitForFunction(() => window.__street.renderer.lastStats.tilesRendered === 0 && window.__street.stats().agents > 0, null, { timeout: 60000, polling: 250 });
  await page.waitForTimeout(2500);
  return { page, errors };
}

/** Freeze the clock, find an agent on screen and click it; returns the selected id. */
async function clickAnAgent(page) {
  await page.evaluate(() => window.__streetDev.clock.setSpeed(0));
  await page.waitForTimeout(300);
  const box = await page.locator('#view canvas').boundingBox();
  const agents = await page.evaluate(() => window.__street.agentsOnScreen());
  assert.ok(agents.length > 0, 'agents on screen');
  // prefer a car standing clear of others so the click is unambiguous
  const clear = agents.filter(a => !agents.some(b => b !== a && Math.hypot(b.px - a.px, b.py - a.py) < 14));
  const pick = (clear.find(a => a.kind === 'car') || clear[0] || agents[0]);
  await page.mouse.click(box.x + pick.px, box.y + pick.py);
  await page.waitForTimeout(250);
  const selected = await page.evaluate(() => window.__streetDev.selected);
  const valid = await page.evaluate(id => { const npc = window.__streetDev.population.get(id); return !!(npc && npc.name && npc.name.display); }, selected);
  return { selected, valid, pick };
}

test('the Mission District on a weekday at 8:00: many people moving, a click selects a real NPC', { timeout: 240000 }, async () => {
  const { page, errors } = await openStreet('zip=94110&t=2026-11-24T08:00&speed=1');
  const stats = await page.evaluate(() => window.__street.stats());
  assert.ok(stats.moving >= 150, `moving ${stats.moving}`);
  assert.ok(stats.walk >= 50 && stats.car >= 50, JSON.stringify(stats));
  assert.equal(stats.style, 'grid');
  await page.screenshot({ path: path.join(HERE, 'street-day.png') });
  brightness.day = await page.evaluate(() => window.__street.brightness());
  assert.ok(brightness.day > 20, `drawn: brightness ${brightness.day}`);
  const conditions = await page.evaluate(() => window.__street.conditions());
  assert.equal(conditions.light.night, 0, 'daylight at 8:00 in late November');
  const { selected, valid, pick } = await clickAnAgent(page);
  assert.ok(selected, `a click on ${pick.kind} at ${pick.px.toFixed(0)},${pick.py.toFixed(0)} selects someone`);
  assert.match(selected, /^\d{5}-\d+-\d+$/);
  assert.ok(valid, `the population resolves ${selected}`);
  assert.deepEqual(errors, []);
  await page.close();
});

test('Florence-Graham at 22:00: night, street lights, traffic still moving', { timeout: 240000 }, async () => {
  const { page, errors } = await openStreet('zip=90001&t=2026-11-24T22:00&speed=1');
  const stats = await page.evaluate(() => window.__street.stats());
  assert.ok(stats.moving >= 15, `moving ${stats.moving}`);
  assert.ok(stats.parked > 300, `parked ${stats.parked}`);
  await page.screenshot({ path: path.join(HERE, 'street-night.png') });
  brightness.night = await page.evaluate(() => window.__street.brightness());
  const conditions = await page.evaluate(() => window.__street.conditions());
  assert.equal(conditions.light.night, 1, 'full night at 22:00');
  const { selected, valid } = await clickAnAgent(page);
  assert.ok(selected && valid, `night click selects a real NPC: ${selected}`);
  assert.deepEqual(errors, []);
  await page.close();
  assert.ok(brightness.day !== undefined, 'day measured first');
  assert.ok(brightness.day - brightness.night > 25, `day ${brightness.day.toFixed(1)} vs night ${brightness.night.toFixed(1)}`);
});

/** Record each frame's work (ms) and the gaps between frames while the page runs at `speed` for `ms`. */
async function frameTimes(page, speed, ms) {
  await page.evaluate(s => {
    const v = window.__street;
    window.__work = window.__work || []; window.__gaps = window.__gaps || [];
    if (!v.__timed) {
      v.__timed = v._frame.bind(v);
      v._frame = ts => { const t0 = performance.now(); v.__timed(ts); window.__work.push(performance.now() - t0); if (window.__ts) window.__gaps.push(ts - window.__ts); window.__ts = ts; };
    }
    window.__streetDev.clock.setSpeed(s);
  }, speed);
  await page.waitForTimeout(800);            // the clock rate settles; caches warm
  await page.evaluate(() => { window.__work = []; window.__gaps = []; window.__ts = 0; });
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    return { frames: window.__work.length, median: q(window.__work, 0.5), p95: q(window.__work, 0.95), gap: q(window.__gaps, 0.5), stats: window.__street.stats() };
  });
}

test('Irvine through the morning at 60x: past 7:15 with no page error and no fault', { timeout: 240000 }, async () => {
  const { page, errors } = await openStreet('zip=92620&t=2026-11-24T07:10&speed=60');
  const past = atPacific(2026, 11, 24, 7, 17);
  await page.waitForFunction(t => window.__street.sim && window.__street.sim.t >= t, past, { timeout: 60000, polling: 250 });
  const s = await page.evaluate(() => ({ stats: window.__street.stats(), lag: window.__streetDev.clock.now() - window.__street.sim.t }));
  assert.ok(s.stats.time >= past, 'simulated time moves on past 7:15');
  assert.ok(Math.abs(s.lag) < 60000, `the simulation keeps up with the clock (${s.lag} ms behind)`);
  assert.equal(s.stats.faults || 0, 0, 'no agent failed');
  assert.ok(s.stats.moving > 50, `moving ${s.stats.moving}`);
  assert.deepEqual(errors, []);
  await page.close();
});

test('a fast clock keeps the frame within budget at 300x and 1800x', { timeout: 240000 }, async () => {
  for (const traffic of [1, 3.5]) {
    const { page, errors } = await openStreet(`zip=94110&t=2026-11-24T08:00&speed=1&traffic=${traffic}`);
    // the gap between frames depends on the machine's load as much as on the view: measured against this browser's
    // own gap at real time a moment before (eng-56), so another busy process does not fail the test; the frame work
    // the view measures itself stays the strict bound
    const base = await frameTimes(page, 1, 1500);
    for (const speed of [300, 1800]) {
      const r = await frameTimes(page, speed, 3500);
      // headless Chromium draws the canvas in software: the bounds leave room for that and still catch the
      // per-frame bursts of hundreds of vehicles (once a 28 ms median and 96 ms p95 at 1800x with 3.5x traffic)
      assert.ok(r.frames > 120, `${speed}x traffic ${traffic}: ${r.frames} frames`);
      assert.ok(r.median < 12, `${speed}x traffic ${traffic}: median frame work ${r.median.toFixed(1)} ms`);
      assert.ok(r.p95 < 35, `${speed}x traffic ${traffic}: p95 frame work ${r.p95.toFixed(1)} ms`);
      assert.ok(r.gap < Math.max(20, 1.5 * base.gap + 4), `${speed}x traffic ${traffic}: median frame gap ${r.gap.toFixed(1)} ms (idle ${base.gap.toFixed(1)} ms)`);
      assert.deepEqual(errors, [], `${speed}x traffic ${traffic}`);
      assert.equal(r.stats.faults || 0, 0, `${speed}x traffic ${traffic}: ${JSON.stringify(r.stats.lastFault)}`);
    }
    await page.close();
  }
});

test('OpenStreetMap allowed: an Overpass answer without node ids still gives real streets and a v2 cache', { timeout: 240000 }, async () => {
  const world = await loadDefaultWorld();
  const zi = world.indexOf('94110');
  const frame = new Frame(world, world.z.tx[zi], world.z.ty[zi]);
  const ll = (x, y) => { const w = frame.toWorld(x, y); const p = world.unproject(w.x, w.y); return { lat: +p.lat.toFixed(7), lon: +p.lon.toFixed(7) }; };
  // a 9 x 9 grid of streets 120 m apart (crossing at shared vertices) and a row of houses, as Overpass prints them
  // with `out geom tags` (no node ids), the shape that once fell back to generated streets without a word
  const elements = [];
  let id = 1;
  for (let i = 0; i < 9; i++) {
    elements.push({ type: 'way', id: id++, tags: { highway: i === 4 ? 'primary' : 'residential', name: `Row ${i}` }, geometry: Array.from({ length: 9 }, (_, j) => ll(-480 + j * 120, -480 + i * 120)) });
    elements.push({ type: 'way', id: id++, tags: { highway: 'residential', name: `Column ${i}` }, geometry: Array.from({ length: 9 }, (_, j) => ll(-480 + i * 120, -480 + j * 120)) });
  }
  for (let k = 0; k < 8; k++) {
    const cx = -450 + k * 30, cy = -450;
    elements.push({ type: 'way', id: 9000 + k, tags: { building: 'house' }, geometry: [[cx - 6, cy - 7], [cx + 6, cy - 7], [cx + 6, cy + 7], [cx - 6, cy + 7], [cx - 6, cy - 7]].map(([x, y]) => ll(x, y)) });
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.stack || e)));
  let asked = '';
  await page.route('https://overpass-api.de/**', async route => {
    asked = decodeURIComponent(route.request().postData() || '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 0.6, elements }) });
  });
  await page.goto(`${base}/src/world/street-dev.html?zip=94110&t=2026-11-24T12:00&speed=1&net=1`);
  await page.waitForFunction(() => window.__streetDev && (window.__streetDev.ready || window.__streetDev.error), null, { timeout: 120000 });
  const summary = await page.evaluate(() => window.__streetDev.summary);
  assert.match(asked, /out body geom;/, 'the query asks for node ids');
  assert.equal(summary.source, 'osm', `streets from ${summary.source} (OpenStreetMap ${summary.osm})`);
  assert.equal(summary.osm, 'loaded');
  assert.ok(summary.streets >= 100, `${summary.streets} street edges`);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  assert.ok(keys.some(k => k.startsWith('legion.osm.v2.')) && !keys.some(k => k.startsWith('legion.osm.v1.')), keys.join(', '));
  await page.waitForTimeout(1500);
  const stats = await page.evaluate(() => window.__street.stats());
  assert.ok(stats.agents > 0 && (stats.faults || 0) === 0, JSON.stringify(stats));
  assert.deepEqual(errors, []);
  await page.close();
});
