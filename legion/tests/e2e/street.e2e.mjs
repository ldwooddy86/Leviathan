// End-to-end test of the street view in a real browser: `node tests/e2e/street.e2e.mjs` from legion/.
//
// Serves legion/ over http and opens src/world/street-dev.html twice: the Mission District (94110) on a weekday at
// 8:00 and Florence-Graham (90001) at 22:00. Each run waits for the scene, lets the street settle, saves a screenshot
// (tests/e2e/street-day.png, tests/e2e/street-night.png) and checks: many people moving; no page errors; the
// canvas is drawn; then a click on an agent selects a real NPC (the population resolves the id and the select
// event carries it). Day and night must differ clearly in mean brightness.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
