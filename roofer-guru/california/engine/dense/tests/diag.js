/* Dense downtowns: open the test page at an address and watch how it dies (or does not).
   node diag.js <page.html> "<address>" <log.txt> [steps] [shot.png]
   steps: comma list run in order after the engine has opened, each followed by a wait:
     q:low | q:medium | sun | life:0 | wide:0 | wide:1 | h:drone | h:bird | h:street | h:metro | all:<mode> | wait:<s> | cells | shot
   Listens for a renderer crash, a browser disconnect and console errors; samples process memory (ps) and the page's
   JS heap once a second; every line goes to the log file at once, so a restart keeps the evidence.
   One browser, capped, with a hard stop. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), cp = require('child_process');
const FILE = path.resolve(process.argv[2]), ADDR = process.argv[3], LOG = path.resolve(process.argv[4] || 'diag.log');
const STEPS = (process.argv[5] || 'all:drone').split(',').filter(Boolean), SHOT = process.argv[6] ? path.resolve(process.argv[6]) : null;
const HARD = +(process.env.HARD_MS || 420000), HEAP = +(process.env.HEAP_MB || 2048);
const wait = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now();
const log = (...a) => { const s = ((Date.now() - T0) / 1000).toFixed(1).padStart(6) + ' ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); fs.appendFileSync(LOG, s + '\n'); console.log(s); };
fs.writeFileSync(LOG, '# ' + new Date().toISOString() + ' ' + FILE + ' | ' + ADDR + ' | ' + STEPS.join(',') + '\n');
const procs = () => { try { const out = cp.execSync("ps -eo pid,ppid,rss,args --no-headers", { encoding: 'utf8' }); const rows = out.split('\n').map(l => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean).map(m => ({ pid: +m[1], pp: +m[2], rss: +m[3], a: m[4] })); const mine = new Set([process.pid]); for (let k = 0; k < 6; k++) rows.forEach(r => { if (mine.has(r.pp)) mine.add(r.pid); }); const r = {}; rows.forEach(x => { if (!mine.has(x.pid) || x.pid === process.pid || !/chrome/.test(x.a)) return; const t = (x.a.match(/--type=([a-z-]+)/) || [0, 'browser'])[1]; if (t === 'zygote') return; const k = t === 'utility' ? 'util' : t === 'gpu-process' ? 'gpu' : t === 'renderer' ? 'rend' : t; r[k] = (r[k] || 0) + Math.round(x.rss / 1024); }); return r; } catch (e) { return {}; } };
const freeMb = () => { try { return +cp.execSync("free -m | awk '/Mem:/{print $7}'", { encoding: 'utf8' }).trim(); } catch (e) { return -1; } };
let browser = null, dead = false;
const hard = setTimeout(async () => { log('HARD STOP after', HARD, 'ms'); try { if (browser) await browser.close(); } catch (e) {} process.exit(3); }, HARD);
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--max-old-space-size=' + HEAP, '--enable-logging=stderr', '--v=0'];
  if (process.env.EXTRA_ARGS) args.push(...process.env.EXTRA_ARGS.split(' '));
  browser = await chromium.launch({ proxy, args });
  browser.on('disconnected', () => { dead = true; log('EVENT browser disconnected'); });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('crash', () => { dead = true; log('EVENT page crash (renderer process gone)'); });
  page.on('close', () => { log('EVENT page close'); });
  page.on('pageerror', e => log('PAGEERROR', String(e && e.stack || e).slice(0, 600)));
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /^\[dense\]|WebGL|CONTEXT|context/i.test(t)) log('CONSOLE', m.type(), t.slice(0, 500)); });
  let mem = null, memOn = true;
  const sampler = (async () => { while (memOn && !dead) { const p = procs(); let h = null; try { h = await Promise.race([page.evaluate(() => { const m = performance.memory, en = typeof MODI !== "undefined" && MODI.rooftops && MODI.rooftops.api.en && MODI.rooftops.api.en(); let d = null; try { if (en) { const s = en.state(); d = { built: s.built, q: s.queued, cells: s.cells, mode: s.mode, fr: en.engine.time.frame, ms: Math.round(en.engine.time.ms), lost: en.engine.device && en.engine.device.gl && en.engine.device.gl.isContextLost() }; } } catch (e) { d = { err: String(e) }; } return { heap: Math.round(m.usedJSHeapSize / 1048576), tot: Math.round(m.totalJSHeapSize / 1048576), d }; }), wait(2500).then(() => 'busy')]); } catch (e) { h = 'evalfail ' + String(e).slice(0, 80); } mem = { p, h, free: freeMb() }; log('MEM', mem); await wait(1000); } })();
  const ev = async (fn, arg, ms) => { try { return await Promise.race([page.evaluate(fn, arg), wait(ms || 60000).then(() => 'TIMEOUT')]); } catch (e) { return 'EVALERR ' + String(e).slice(0, 200); } };
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  log('loaded');
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); const st = await settle(150000); await wait(2500);
  log('scout status', st && { tiles: st.tiles.length, ok: st.tiles.filter(t => t.st === 'ok').length, err: st.tiles.filter(t => t.st === 'err').length });
  await page.evaluate(() => document.querySelector('#scMode button[data-v="eng"]').click());
  let s = null, last = -1, same = 0;
  for (let i = 0; i < 30 && !dead; i++) { await wait(3000); s = await ev(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads, lat: st.lat, lon: st.lon, mode: st.mode, cells: st.cells }; }, null, 20000); if (s && s.built === last) same++; else same = 0; last = s && s.built; if (s && s.built > 0 && !s.queued && s.roads && same >= 2) break; }
  log('engine', s);
  const cells = async () => { const d = await ev(() => { const en = MODI.rooftops.api.en(), g = en.debug(); return { cells: g.cells.length, built: g.cells.filter(c => c.built).length, n: g.cells.reduce((a, c) => a + c.n, 0), parts: g.cells.reduce((a, c) => a + c.parts, 0), top: g.cells.slice().sort((a, b) => b.n - a.n).slice(0, 4), far: g.far, prisms: g.prisms, stats: g.stats, programs: g.programs, textures: g.textures, buffers: g.buffers, quality: g.quality, err: g.err, dense: window.__DENSE__ || null }; }, null, 30000); log('CELLS', d); return d; };
  const shot = async (p) => { if (dead) return; try { const box = await page.evaluate(() => { const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }); await wait(1000); await page.screenshot({ path: p, timeout: 150000, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(1100, box.width), height: Math.min(800, box.height) } }); log('SHOT saved', p); } catch (e) { log('SHOT failed', String(e).slice(0, 300)); } };
  for (const stp of STEPS) {
    if (dead) break; const [k, v] = stp.split(':'); log('STEP', stp);
    if (k === 'cells') { await cells(); continue; }
    if (k === 'wait') { await wait(1000 * (+v || 5)); continue; }
    if (k === 'shot') { await shot(SHOT ? SHOT.replace(/\.png$/, (v ? '_' + v : '') + '.png') : LOG.replace(/\.[a-z]+$/, '') + (v ? '_' + v : '') + '.png'); continue; }
    if (k === 'prof') { const n = +v || 3, c = await ctx.newCDPSession(page); await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 500 }); await c.send('Profiler.start');
      const fr = await ev(async n => { const en = MODI.rooftops.api.en(), E = en.engine, o = []; E.stop(); for (let i = 0; i < n; i++) { const t0 = performance.now(); E.emit('input', 1 / 30); E.emit('update', 1 / 30); E.scene.lateUpdate(1 / 30); const t1 = performance.now(); E.renderer.render(E.scene, E.camera, E.time.now, 1 / 30); E.time.frame++; o.push([Math.round(t1 - t0), Math.round(performance.now() - t1)]); await new Promise(r => setTimeout(r, 20)); } E.start(); return o; }, n, 240000);
      const { profile } = await c.send('Profiler.stop'); log('  frames [update ms, draw ms]', fr);
      const by = new Map(), id = new Map(); profile.nodes.forEach(nd => id.set(nd.id, nd)); const dts = profile.timeDeltas, self = new Map(); profile.samples.forEach((sid, i) => self.set(sid, (self.get(sid) || 0) + (dts[i] || 0)));
      const par = new Map(); profile.nodes.forEach(nd => (nd.children || []).forEach(ch => par.set(ch, nd.id)));
      const nm = nd => (nd.callFrame.functionName || '(anon)') + ' @' + (nd.callFrame.lineNumber + 1) + ':' + (nd.callFrame.columnNumber + 1);
      const tot = new Map(); self.forEach((us, sid) => { const nd = id.get(sid), k = nm(nd); by.set(k, (by.get(k) || 0) + us); const seen = new Set(); for (let x = sid; x != null; x = par.get(x)) { const kk = nm(id.get(x)); if (seen.has(kk)) continue; seen.add(kk); tot.set(kk, (tot.get(kk) || 0) + us); } });
      const top = m => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22).map(e => Math.round(e[1] / 1000) + 'ms ' + e[0]);
      log('  SELF', top(by)); log('  TOTAL', top(tot)); fs.writeFileSync(LOG.replace(/\.[a-z]+$/, '') + '.cpuprofile', JSON.stringify(profile)); continue; }
    if (k === 'profon') { global.__c = await ctx.newCDPSession(page); await global.__c.send('Profiler.enable'); await global.__c.send('Profiler.setSamplingInterval', { interval: 1000 }); await global.__c.send('Profiler.start'); log('  profiler on'); continue; }
    if (k === 'profoff') { const { profile } = await Promise.race([global.__c.send('Profiler.stop'), wait(120000).then(() => ({ profile: null }))]); if (!profile) { log('  profiler did not stop'); continue; }
      const by = new Map(), id = new Map(); profile.nodes.forEach(nd => id.set(nd.id, nd)); const dts = profile.timeDeltas, self = new Map(); profile.samples.forEach((sid, i) => self.set(sid, (self.get(sid) || 0) + (dts[i] || 0)));
      const par = new Map(); profile.nodes.forEach(nd => (nd.children || []).forEach(ch => par.set(ch, nd.id)));
      const nm = nd => (nd.callFrame.functionName || '(anon)') + ' @' + (nd.callFrame.lineNumber + 1) + ':' + (nd.callFrame.columnNumber + 1);
      const tot = new Map(); self.forEach((us, sid) => { const nd = id.get(sid), kk0 = nm(nd); by.set(kk0, (by.get(kk0) || 0) + us); const seen = new Set(); for (let x = sid; x != null; x = par.get(x)) { const kk = nm(id.get(x)); if (seen.has(kk)) continue; seen.add(kk); tot.set(kk, (tot.get(kk) || 0) + us); } });
      const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(e => Math.round(e[1] / 1000) + 'ms ' + e[0]);
      log('  SELF'); top(by, 30).forEach(x => log('     ' + x)); log('  TOTAL'); top(tot, 45).forEach(x => log('     ' + x)); fs.writeFileSync(LOG.replace(/\.[a-z]+$/, '') + '.cpuprofile', JSON.stringify(profile)); continue; }
    let r;
    if (k === 'q') r = await ev(q => { const g = MODI.rooftops.api.en().setGraphics({ q }); return { tier: g.tier, refused: g.refused, broken: g.broken }; }, v);
    else if (k === 'sun') r = await ev(() => { MODI.rooftops.api.en().setGraphics({ sun: 15, weather: 'clear' }); return 'ok'; });
    else if (k === 'life') r = await ev(x => { MODI.rooftops.api.en().setGraphics({ life: x === '1' }); return 'ok'; }, v);
    else if (k === 'wide') r = await ev(x => { MODI.rooftops.api.en().setGraphics({ wide: x === '1' }); return 'ok'; }, v);
    else if (k === 'h') r = await ev(h => { const en = MODI.rooftops.api.en(); en.setHeight(h); return en.state().mode; }, v);
    else if (k === 'all') r = await ev(h => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'low', sun: 15, weather: 'clear', life: false, wide: false }); en.setHeight(h); return en.state().mode; }, v);
    else if (k === 'js') r = await ev(new Function('return (' + fs.readFileSync(path.resolve(v), 'utf8') + ')()'), null, 420000);
    else if (k === 'set') r = await ev(x => { const [n, val] = x.split('='); window[n] = isNaN(+val) ? val : +val; return n; }, v);
    log('  ->', r); for (let i = 0; i < 12 && !dead; i++) await wait(1000);
  }
  if (!dead && SHOT && !STEPS.some(x => x.startsWith('shot'))) await shot(SHOT);
  if (!dead) await cells();
  memOn = false; await wait(1200);
  log(dead ? 'RESULT dead' : 'RESULT alive');
  clearTimeout(hard); try { await browser.close(); } catch (e) {}
  process.exit(dead ? 1 : 0);
})().catch(async e => { log('ERROR', String(e && e.stack || e).slice(0, 600)); try { if (browser) await browser.close(); } catch (x) {} process.exit(2); });
