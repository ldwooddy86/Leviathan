/* debugging aid: where a street build spends its time on terrain (counts and milliseconds of the draping) */
const L = require('./lib.js'), { wait } = L;
(async () => {
  const T = await L.start(process.argv[2], '1000 Filbert St, San Francisco, CA', { gfx: { q: 'high', life: true, trees: false, lamps: true, wide: false } });
  await T.open(37.80016, -122.41857, 81, { mode: 'street' }); await wait(15000); await T.ready(120000, true);
  const r = await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, TR = S.terr, K = en.kit, E = en.engine, out = {}; E.stop();
    const wrap = (o, k, name) => { const f = o[k], c = out[name] = { n: 0, ms: 0 }; let depth = 0; o[k] = function () { const t0 = depth++ ? 0 : performance.now(); try { return f.apply(this, arguments); } finally { c.n++; if (!--depth) c.ms += performance.now() - t0; } }; return () => { o[k] = f; }; };
    const un = [wrap(TR, 'drape', 'drape'), wrap(TR, 'cuts', 'cuts'), wrap(TR, 'dense', 'dense'), wrap(TR, 'block', 'block'), wrap(K, 'ribbon', 'ribbon'), wrap(S, 'gy', 'gy'), wrap(TR, 'gyL', 'gyL')];
    const MB = window.__SCOUT_ENGINE__.MeshBuilder.prototype, b0 = MB.build, t0 = MB.tri; out.build = { n: 0, ms: 0, tris: 0 }; out.tri = { n: 0 };
    MB.build = function () { const a = performance.now(), m = b0.apply(this, arguments); out.build.n++; out.build.ms += performance.now() - a; out.build.tris += this.tris; return m; }; MB.tri = function () { out.tri.n++; return t0.apply(this, arguments); };
    let a = performance.now(); en.setGraphics({ life: false }); out.plainMs = performance.now() - a; out.plain = JSON.parse(JSON.stringify(out)); for (const k in out) if (out[k] && out[k].n != null) { out[k].n = 0; out[k].ms = 0; if (out[k].tris != null) out[k].tris = 0; }
    a = performance.now(); en.setGraphics({ life: true }); out.lifeMs = performance.now() - a; un.forEach(f => f()); MB.build = b0; MB.tri = t0; out.roads = S.roads.length; out.pts = S.roads.reduce((s, r2) => s + r2.pts.length, 0); out.km = S.roads.reduce((s, r2) => { let l = 0; for (let i = 1; i < r2.pts.length; i++) l += Math.hypot(r2.pts[i][0] - r2.pts[i - 1][0], r2.pts[i][1] - r2.pts[i - 1][1]); return s + l; }, 0) / 1000; out.street = en.street.stats; en.start(); return out; });
  const f = o => Object.keys(o).filter(k => o[k] && o[k].n != null).map(k => k + ' ' + o[k].n + (o[k].ms ? ' ' + o[k].ms.toFixed(0) + 'ms' : '') + (o[k].tris ? ' ' + o[k].tris + ' tris' : '')).join(' | ');
  console.log('roads', r.roads, 'points', r.pts, 'km', r.km.toFixed(1), JSON.stringify(r.street));
  console.log('life off:', r.plainMs.toFixed(0), 'ms |', f(r.plain)); console.log('life on :', r.lifeMs.toFixed(0), 'ms |', f(r));
  await T.browser.close(); process.exit(0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
