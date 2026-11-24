// End-to-end test of the statewide map and the GPU crowd in a real browser: `node tests/e2e/crowd.e2e.mjs` from legion/.
//
// Serves legion/ over http, opens src/world/dev.html at a low rate (software WebGL copes), sets Tuesday 8:00, saves
// tests/e2e/crowd.png, and checks: many lit crowd pixels around Los Angeles and the Bay Area; a pick at a lit pixel
// returns a valid NPC id of a person on the move; the vertex shader (read back with transform feedback) agrees with
// the JS position function on every agent; stats peak at 8:00 against 3:00. Then the two other build paths: the
// main-thread fallback (?worker=0) builds the same agents, and the single-file hand-off (the worker bundled as an IIFE
// string in window.__LEGION_WORKER_SRC__, the pack as base64 in window.__LEGION_PACK__) runs from a Blob URL.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SHOT = path.join(HERE, 'crowd.png');
const RATE = 0.005;

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
let pw;
try { pw = await import('playwright'); } catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.gz': 'application/octet-stream' };
let server, base, browser;

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
  browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(r => server.close(r));
});

/** Open the dev page, wait for the crowd build, and collect page errors. */
async function openDev(query, init) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (init) await page.addInitScript(init.script, init.arg);
  await page.goto(`${base}/src/world/dev.html?${query}`);
  await page.waitForFunction(() => window.__legionDev && (window.__legionDev.done || window.__legionDev.error), null, { timeout: 240000 });
  const err = await page.evaluate(() => window.__legionDev.error);
  assert.equal(err, null, `dev page failed: ${err}`);
  return { page, errors };
}

test('the crowd lights up Los Angeles and the Bay Area at 8:00 on a Tuesday, and picking finds the people', { timeout: 300000 }, async () => {
  const { page, errors } = await openDev(`rate=${RATE}&keep=1`);
  const summary = await page.evaluate(() => window.__legionDev.summary);
  assert.equal(summary.mode, 'worker', 'built in the Worker');
  assert.ok(summary.agents > 100000, `agents ${summary.agents}`);
  assert.equal(summary.bytesPerAgent, 32);

  // set a weekday 8:00, frame the state, and measure the crowd's own pixels (with it minus without it)
  const probe = await page.evaluate(() => {
    const d = window.__legionDev, { map, crowd, world } = d;
    d.setTime(d.atPacific(2026, 11, 24, 8, 0));
    map.fitState(0);
    const kinds = ['walk', 'drive', 'bike', 'transit', 'errand'];
    const gl = map.getGL(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const grab = () => { map.render(); const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    crowd.setVisible(kinds);
    const on = grab();
    crowd.setVisible([]);
    const off = grab();
    crowd.setVisible(kinds);
    map.render();
    const dpr = map.dpr;
    const box = (lat0, lon0, lat1, lon1) => {
      const a = world.project(lat1, lon0), b = world.project(lat0, lon1);
      const p = map.worldToScreen(a.x, a.y), q = map.worldToScreen(b.x, b.y);
      return [Math.floor(p.px * dpr), Math.floor(p.py * dpr), Math.ceil(q.px * dpr), Math.ceil(q.py * dpr)];
    };
    const count = ([x0, y0, x1, y1]) => {
      let lit = 0, best = null, bestD = 0;
      for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const k = 4 * ((H - 1 - y) * W + x);
        const dd = Math.abs(on[k] - off[k]) + Math.abs(on[k + 1] - off[k + 1]) + Math.abs(on[k + 2] - off[k + 2]);
        if (dd > 60) lit++;
        if (dd > bestD) { bestD = dd; best = [x, y]; }
      }
      return { lit, best, bestD };
    };
    const la = count(box(33.65, -118.7, 34.35, -117.65)), bay = count(box(37.2, -122.6, 38.05, -121.7)), desert = count(box(35.0, -116.9, 35.6, -116.2));
    return { la, bay, desert, dpr, zoom: map.camera.zoom, stats: crowd.stats() };
  });
  await page.screenshot({ path: SHOT });
  assert.ok(fs.statSync(SHOT).size > 50000, 'screenshot written');
  assert.ok(probe.la.lit > 400, `lit pixels around Los Angeles: ${probe.la.lit}`);
  assert.ok(probe.bay.lit > 250, `lit pixels around the Bay Area: ${probe.bay.lit}`);
  assert.ok(probe.la.lit > 10 * Math.max(1, probe.desert.lit), `the Mojave stays dark: ${probe.desert.lit}`);

  // pick the agent under the brightest crowd pixel near Los Angeles
  const pick = await page.evaluate(({ best, dpr }) => {
    const { map, crowd, pop, world } = window.__legionDev;
    const px = (best[0] + 0.5) / dpr, py = (best[1] + 0.5) / dpr, w = map.screenToWorld(px, py);
    const hit = crowd.pick(w.x, w.y, 3 / map.camera.zoom);
    if (!hit) return null;
    const core = pop.householdCore(hit.zi, hit.h);
    const member = core.members.find((x, k) => (x.m == null ? k : x.m) === hit.m);
    return { hit, member: member ? { mode: member.mode, age: member.age } : null, zip: world.zips[hit.zi], region: world.z.region[hit.zi] };
  }, { best: probe.la.best, dpr: probe.dpr });
  assert.ok(pick && pick.hit, 'an agent under a lit pixel');
  assert.match(pick.hit.id, /^\d{5}-\d+-\d+$/);
  assert.equal(pick.hit.id.split('-')[0], pick.zip);
  assert.ok(pick.member, 'the id resolves to a person');
  assert.ok(['to-work', 'to-home', 'to-errand', 'from-errand'].includes(pick.hit.state), pick.hit.state);
  assert.ok(pick.hit.kind !== 'home' && pick.hit.travel === pick.hit.mode);
  if (pick.hit.state === 'to-work' || pick.hit.state === 'to-home') assert.equal(pick.hit.mode, pick.member.mode);
  // following that NPC by id finds the same person at the same spot
  const follow = await page.evaluate(id => window.__legionDev.crowd.positionOf(id), pick.hit.id);
  assert.equal(follow.id, pick.hit.id);
  assert.ok(Math.hypot(follow.x - pick.hit.x, follow.y - pick.hit.y) < 1e-9);
  assert.equal(await page.evaluate(() => window.__legionDev.crowd.positionOf('90001-999999-0')), null);

  // stats: the morning commute against the middle of the night (counted with the shader's function)
  const statsAt = async (h, m) => {
    const t = await page.evaluate(([h, m]) => { const d = window.__legionDev, t = d.atPacific(2026, 11, 24, h, m); d.setTime(t); return t; }, [h, m]);
    // stats() reports the time it was computed for; they refresh a few times a second (in the Worker)
    await page.waitForFunction(t => window.__legionDev.crowd.stats().t === t, t, { timeout: 60000, polling: 100 });
    return page.evaluate(() => window.__legionDev.crowd.stats());
  };
  const st = { night: await statsAt(3, 0), morning: await statsAt(8, 0) };
  assert.equal(st.morning.agents, summary.agents);
  assert.ok(st.morning.movingTotal > 5 * Math.max(1, st.night.movingTotal), `8:00 ${st.morning.movingTotal} vs 3:00 ${st.night.movingTotal}`);
  assert.ok(st.morning.moving.drive > st.morning.moving.walk);

  // the GLSL twin: run the vertex shader with transform feedback and compare with the JS function on every agent
  const tf = await page.evaluate(async () => {
    const CB = await import('/src/world/crowd-build.mjs');
    const d = window.__legionDev, crowd = d.crowd, out = [];
    for (const [h, m, day] of [[8, 0, 24], [17, 40, 24], [12, 0, 28]]) {
      const { minute, dow } = CB.simTime(d.atPacific(2026, 11, day, h, m));
      let n = 0, stateMismatch = 0, moving = 0, maxErr = 0;
      const P = CB.newPhase(), o = { state: 0, kind: 0, x: 0, y: 0 };
      crowd.chunks.forEach((c, ci) => {
        const g = crowd.gpuEval(ci, minute, dow, 0, c.count);
        for (let i = 0; i < c.count; i++, n++) {
          CB.agentPosition(c, i, minute, dow, crowd.net, o, P);
          if (g[4 * i + 2] !== o.state || g[4 * i + 3] !== o.kind) { stateMismatch++; continue; }
          if (o.kind >= 0 && o.kind !== CB.K_HOME) { moving++; maxErr = Math.max(maxErr, Math.hypot(g[4 * i] - o.x, g[4 * i + 1] - o.y)); }
        }
      });
      out.push({ at: `${day}/${h}:${m}`, n, stateMismatch, moving, maxErr });
    }
    return out;
  });
  for (const r of tf) {
    assert.equal(r.n, summary.agents);
    assert.ok(r.stateMismatch <= r.n * 1e-4, `${r.at}: ${r.stateMismatch} state mismatches`);
    assert.ok(r.moving > 0 && r.maxErr < 0.05, `${r.at}: GPU and JS positions differ by ${r.maxErr} units`);
  }
  assert.deepEqual(errors, []);
  await page.close();
});

test('the main-thread fallback builds the same crowd', { timeout: 300000 }, async () => {
  const rate = 0.002;
  const a = await openDev(`rate=${rate}&keep=1&worker=0`);
  const b = await openDev(`rate=${rate}&keep=1`);
  const sig = page => page.evaluate(() => {
    const c = window.__legionDev.crowd, s = window.__legionDev.summary;
    let h = 0;
    for (const ch of c.chunks) for (const k of ['ids', 'home', 'dest', 'timing', 'route', 'errand']) { const v = ch[k]; for (let i = 0; i < v.length; i += 7) h = (Math.imul(h, 31) + v[i]) | 0; }
    return { mode: s.mode, agents: s.agents, highway: s.highway, h };
  });
  const [sa, sb] = [await sig(a.page), await sig(b.page)];
  assert.equal(sa.mode, 'main'); assert.equal(sb.mode, 'worker');
  assert.equal(sa.agents, sb.agents); assert.equal(sa.highway, sb.highway); assert.equal(sa.h, sb.h);
  assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
  await a.page.close(); await b.page.close();
});

test('single-file hand-off: an IIFE worker from window.__LEGION_WORKER_SRC__ and a base64 pack', { timeout: 300000 }, async () => {
  const esbuild = (await import('esbuild')).default;
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, 'src/world/crowd-worker.mjs')], bundle: true, format: 'iife', platform: 'browser', write: false, external: ['node:*'], logLevel: 'silent', target: 'es2020' });
  const workerSrc = out.outputFiles[0].text;
  const packB64 = fs.readFileSync(path.join(ROOT, 'data/world.json.gz')).toString('base64');
  // pack=0: the dev page keeps its fetched bytes to itself, so the Crowd hands the Worker window.__LEGION_PACK__
  const { page, errors } = await openDev('rate=0.002&keep=1&pack=0', {
    script: ({ src, pack }) => { window.__LEGION_WORKER_SRC__ = src; window.__LEGION_PACK__ = pack; },
    arg: { src: workerSrc, pack: packB64 },
  });
  const r = await page.evaluate(() => {
    const d = window.__legionDev;
    return { mode: d.summary.mode, pack: d.summary.pack, agents: d.summary.agents, url: d.crowd._workerUrl };
  });
  assert.equal(r.mode, 'worker');
  assert.equal(r.pack, 'window', 'the Worker got the base64 pack');
  assert.ok(r.agents > 50000);
  assert.equal(r.url, null, 'the Blob URL is revoked once the worker answers');
  assert.deepEqual(errors, []);
  await page.close();
});
