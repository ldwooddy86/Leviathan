// End-to-end test of the statewide map and the GPU crowd in a real browser: `node tests/e2e/crowd.e2e.mjs` from legion/.
//
// Serves legion/ over http, opens src/world/dev.html at a low rate (software WebGL copes), sets Tuesday 8:00, saves
// tests/e2e/crowd.png, and checks: many lit crowd pixels around Los Angeles and the Bay Area; a pick at a lit pixel
// returns a valid NPC id of a person on the move; the vertex shader (read back with transform feedback) agrees with
// the JS position function on every agent; stats peak at 8:00 against 3:00; no Worker message handler holds the main
// thread for long while the crowd streams in (the population check runs in idle time); the map's colors, night
// shade and pointer events. Then the other build paths: the main-thread fallback (?worker=0) builds the same agents;
// the single-file hand-off (the worker bundled as an IIFE string in window.__LEGION_WORKER_SRC__, the pack as base64
// in window.__LEGION_PACK__) runs from a Blob URL; a build replaced while the Worker is still decoding the pack stays
// in the Worker; and a Worker population that differs from the page's is caught and rebuilt on the main thread.

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

/** Time every Worker message handler of the page from its first message: window.__workerMsgs = [[type, ms], …]. */
function timeWorkerHandlers() {
  window.__workerMsgs = [];
  const desc = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
  Object.defineProperty(Worker.prototype, 'onmessage', {
    configurable: true,
    get() { return desc.get.call(this); },
    set(fn) {
      desc.set.call(this, fn && (e => {
        const t0 = performance.now();
        try { return fn.call(this, e); } finally { window.__workerMsgs.push([e.data && e.data.type, performance.now() - t0]); }
      }));
    },
  });
}

/**
 * Open the dev page and collect page errors and warnings. By default wait for its crowd build; with build=0 in the
 * query, wait until the page is ready to build (window.__legionDev.build).
 */
async function openDev(query, init) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errors = [], warnings = [];
  page.on('pageerror', e => errors.push(String(e && e.stack || e)));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
    else if (m.type() === 'warning' && !/GL Driver Message|GPU stall/.test(m.text())) warnings.push(m.text());
  });
  if (init) await page.addInitScript(init.script, init.arg);
  await page.goto(`${base}/src/world/dev.html?${query}`);
  const idle = /(^|&)build=0(&|$)/.test(query);
  await page.waitForFunction(idle ? () => window.__legionDev && (window.__legionDev.build || window.__legionDev.error) : () => window.__legionDev && (window.__legionDev.done || window.__legionDev.error), null, { timeout: 240000 });
  const err = await page.evaluate(() => window.__legionDev.error);
  assert.equal(err, null, `dev page failed: ${err}`);
  return { page, errors, warnings };
}

test('the crowd lights up Los Angeles and the Bay Area at 8:00 on a Tuesday, and picking finds the people', { timeout: 300000 }, async () => {
  const { page, errors } = await openDev(`rate=${RATE}&keep=1`, { script: timeWorkerHandlers });
  const summary = await page.evaluate(() => window.__legionDev.summary);
  assert.equal(summary.mode, 'worker', 'built in the Worker');
  assert.ok(summary.agents > 100000, `agents ${summary.agents}`);
  // memory: the 32-byte record plus the pick index, well under 40 bytes per agent on the main thread
  assert.equal(summary.bytesPerAgent, 32);
  assert.ok(summary.pickBytesPerAgent > 0 && summary.pickBytesPerAgent < 6, `pick index ${summary.pickBytesPerAgent} B/agent`);
  assert.ok(summary.mainBytesPerAgent < 38, `${summary.mainBytesPerAgent} B/agent`);

  // the cold start: the Worker's population was checked against the page's, in idle-time steps, and no message
  // handler held the main thread (the check used to run inside the first chunk's handler, 180-230 ms)
  assert.equal(summary.verified, 6, 'six agents checked against the page population');
  assert.ok(summary.verifyMaxMs < 150, `longest check step ${summary.verifyMaxMs} ms`);
  const handlers = await page.evaluate(() => {
    const by = {};
    for (const [type, ms] of window.__workerMsgs) by[type] = Math.max(by[type] || 0, ms);
    return { by, chunks: window.__workerMsgs.filter(([t]) => t === 'chunk').length };
  });
  assert.ok(handlers.chunks >= 10, `${handlers.chunks} chunks streamed`);
  assert.ok(handlers.by.chunk < 50, `longest chunk handler ${handlers.by.chunk.toFixed(1)} ms`);

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

  // clicking that pixel: the dev panel names the person and their commute mode (not how they move right now)
  const click = await page.evaluate(({ best, dpr }) => {
    const { map, crowd } = window.__legionDev, r = map.container.getBoundingClientRect();
    const px = (best[0] + 0.5) / dpr, py = (best[1] + 0.5) / dpr, w = map.screenToWorld(px, py);
    return { x: r.left + px, y: r.top + py, hit: crowd.pick(w.x, w.y, 6 / map.camera.zoom) };
  }, { best: probe.la.best, dpr: probe.dpr });
  assert.ok(click.hit, 'an agent under the click');
  await page.mouse.click(click.x, click.y);
  await page.waitForFunction(id => document.getElementById('pick').textContent.includes(id), click.hit.id, { timeout: 60000 });
  const panel = await page.evaluate(() => document.getElementById('pick').textContent);
  assert.ok(panel.includes(`commute mode: ${click.hit.commuteMode || 'none'}`), panel);
  // Saturday noon: someone who commutes by other means, driving to an errand. The panel says how they move now and
  // how they commute, which differ
  const errand = await page.evaluate(async () => {
    const CB = await import('/src/world/crowd-build.mjs');
    const d = window.__legionDev, { map, crowd, world } = d;
    d.setTime(d.atPacific(2026, 11, 28, 12, 0));
    const P = CB.newPhase();
    let id = null;
    for (const c of crowd.chunks) {
      for (let i = 0; i < c.count && !id; i++) {
        const code = c.mode[i] & 15;
        if (!code || CB.MODES[code] === 'drive' || ((c.errand[i] >>> 25) & 1) !== 1) continue;
        if (CB.agentPhase(c, i, crowd.minute, crowd.dow, P) === CB.S_EOUT) id = CB.decodeId(c, i, world).id;
      }
      if (id) break;
    }
    const pos = crowd.positionOf(id);
    map.setCamera(pos.x, pos.y, 60);
    map.render();
    const sp = map.worldToScreen(pos.x, pos.y), r = map.container.getBoundingClientRect();
    return { id, x: r.left + sp.px, y: r.top + sp.py, travel: pos.travel, commuteMode: pos.commuteMode };
  });
  assert.ok(errand.id && errand.travel === 'drive' && errand.commuteMode !== 'drive', JSON.stringify(errand));
  await page.mouse.click(errand.x, errand.y);
  await page.waitForFunction(id => document.getElementById('pick').textContent.includes(id), errand.id, { timeout: 60000 });
  const errandPanel = await page.evaluate(() => document.getElementById('pick').textContent);
  assert.ok(errandPanel.includes('to-errand by drive') && errandPanel.includes(`commute mode: ${errand.commuteMode}`), errandPanel);
  await page.evaluate(() => window.__legionDev.map.fitState(0));

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

  // colors: any CSS color, alpha straight (not premultiplied, not divided twice)
  const colors = await page.evaluate(async () => {
    const { parseColor } = await import('/src/world/map.mjs');
    const cases = ['rgba(255, 0, 0, 0.5)', 'hsl(210 50% 40% / 0.25)', 'color-mix(in srgb, #3366cc 50%, transparent)', 'rgb(1, 2, 3)', '#3366cc80', 'rebeccapurple', 'not-a-color'];
    return cases.map(v => parseColor(v));
  });
  const near = (got, want, tol = 0.006) => got && want.every((w, k) => Math.abs(got[k] - w) <= tol);
  assert.ok(near(colors[0], [1, 0, 0, 0.5]), `rgba: ${colors[0]}`);
  assert.ok(near(colors[1], [0.2, 0.4, 0.6, 0.25]), `hsl with alpha: ${colors[1]}`);
  assert.ok(near(colors[2], [0.2, 0.4, 0.8, 0.5]), `color-mix: ${colors[2]}`);
  assert.ok(near(colors[3], [1 / 255, 2 / 255, 3 / 255, 1]), `rgb(1, 2, 3): ${colors[3]}`);
  assert.ok(near(colors[4], [0.2, 0.4, 0.8, 128 / 255]), `hex with alpha: ${colors[4]}`);
  assert.ok(near(colors[5], [0.4, 0.2, 0.6, 1]), `named: ${colors[5]}`);
  assert.equal(colors[6], null);

  // the legend swatches follow the theme (the light theme's drivers heading out are dark, not near-white)
  const swatches = await page.evaluate(() => {
    const drive = () => getComputedStyle(document.querySelectorAll('#kinds .sw')[1]).backgroundImage;
    const out = { dark: drive() };
    document.getElementById('theme').click(); out.light = drive();
    document.getElementById('theme').click(); out.back = drive();
    return out;
  });
  assert.match(swatches.dark, /rgb\(242, 245, 255\) 50%, rgb\(255, 59, 48\) 50%/);
  assert.match(swatches.light, /rgb\(29, 36, 51\) 50%, rgb\(214, 47, 47\) 50%/);
  assert.equal(swatches.back, swatches.dark);

  // the night shade follows the theme at once, without waiting for the clock to move
  const shade = await page.evaluate(() => {
    const d = window.__legionDev, { map, crowd } = d;
    d.setTime(d.atPacific(2026, 11, 24, 21, 0));
    const out = { night: crowd.night, dark: map.shade };
    map.setTheme('light'); out.light = map.shade;
    map.setTheme('dark'); out.back = map.shade;
    return out;
  });
  assert.ok(shade.night > 0.9, `night ${shade.night}`);
  assert.ok(Math.abs(shade.dark - 0.3 * shade.night) < 1e-6 && Math.abs(shade.light - 0.16 * shade.night) < 1e-6 && Math.abs(shade.back - shade.dark) < 1e-6, JSON.stringify(shade));

  // pointer: 'hover' always carries a point, leaving the map is its own 'leave' event (the tooltip hides)
  await page.evaluate(() => {
    const d = window.__legionDev;
    Object.assign(d, { hovers: 0, badHovers: 0, leaves: 0 });
    d.map.on('hover', h => { d.hovers++; if (!h || !Number.isFinite(h.x) || !Number.isFinite(h.y) || !Number.isFinite(h.px)) d.badHovers++; });
    d.map.on('leave', e => { d.leaves++; d.leftAt = e; });
  });
  await page.mouse.move(600, 480);
  await page.mouse.move(640, 500, { steps: 5 });
  await page.waitForFunction(() => window.__legionDev.hovers > 0, null, { timeout: 60000 });
  await page.evaluate(() => { document.getElementById('tip').style.display = 'block'; });
  await page.mouse.move(640, 8, { steps: 3 });
  await page.waitForFunction(() => window.__legionDev.leaves > 0, null, { timeout: 60000 });
  const pointer = await page.evaluate(() => {
    const d = window.__legionDev;
    return { bad: d.badHovers, leftAt: d.leftAt, tip: getComputedStyle(document.getElementById('tip')).display };
  });
  assert.equal(pointer.bad, 0, 'every hover has a point');
  assert.ok(Number.isFinite(pointer.leftAt.px) && Number.isFinite(pointer.leftAt.py));
  assert.equal(pointer.tip, 'none', 'the dev tooltip hides on leave');
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

test('a build replaced while the Worker is still decoding the pack stays in the Worker', { timeout: 300000 }, async () => {
  const { page, errors, warnings } = await openDev('rate=0.002&keep=1&build=0');
  const runs = await page.evaluate(async () => {
    const d = window.__legionDev, Crowd = d.crowd.constructor, pack = d.crowd.packSource;
    d.crowd.destroy();
    // a fresh crowd each time: its first build starts the Worker and hands it the pack; the second arrives while the
    // pack is still being decoded (right away, or 30 ms later)
    const race = async delay => {
      const c = new Crowd(d.map, { world: d.world, population: d.pop, rate: 0.002, seed: 1, pack });
      const first = c.build({ rate: 0.002 });
      if (delay) await new Promise(r => setTimeout(r, delay));
      const second = c.build({ rate: 0.003 });
      const [a, b] = await Promise.all([first, second]);
      const out = { delay, firstCancelled: !!a.cancelled, mode: b.mode, agents: b.agents, rate: b.rate, verified: b.verified, count: c.count };
      c.destroy();
      return out;
    };
    return [await race(0), await race(30)];
  });
  for (const r of runs) {
    assert.ok(r.firstCancelled, `the first build gave way (delay ${r.delay} ms)`);
    assert.equal(r.mode, 'worker', `the replacing build stayed in the Worker (delay ${r.delay} ms)`);
    assert.equal(r.rate, 0.003);
    assert.ok(r.agents > 80000 && r.count === r.agents, `${r.agents} agents`);
    assert.equal(r.verified, 6);
  }
  assert.deepEqual(warnings.filter(w => /worker build failed|no world pack/.test(w)), []);
  assert.deepEqual(errors, []);
  await page.close();
});

test('a Worker population that differs from the page population is caught and rebuilt on the main thread', { timeout: 300000 }, async () => {
  const { page, errors, warnings } = await openDev('rate=0.0005&keep=1&build=0');
  const r = await page.evaluate(async () => {
    const d = window.__legionDev, pop = d.pop, own = pop.householdCore.bind(pop);
    // the page's population no longer matches the one the Worker generates: here everyone commutes by ferry
    pop.householdCore = (zi, h) => { const core = own(zi, h); for (const m of core.members) m.mode = 'ferry'; return core; };
    const s = await d.build(0.0005);
    let ferry = 0, n = 0;
    for (const c of d.crowd.chunks) for (let i = 0; i < c.count; i++, n++) if ((c.mode[i] & 15) === 5) ferry++;
    return { mode: s.mode, agents: s.agents, n, ferry };
  });
  assert.equal(r.mode, 'main', 'rebuilt on the main thread');
  assert.ok(r.agents > 10000 && r.n === r.agents, `${r.agents} agents`);
  assert.equal(r.ferry, r.n, 'the crowd is the page population');
  assert.ok(warnings.some(w => /differs from the main thread population/.test(w)), warnings.join('\n'));
  assert.deepEqual(errors, []);
  await page.close();
});
