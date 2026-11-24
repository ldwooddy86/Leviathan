/* The roof views, looked at: pictures of each view at a place, with the legend and the reading of the building picked.
   node views_shots.js <page.html> "<address>" <tag> <outdir> <plan.json>
   plan: [{ name, lens, rain, wind, sky, year, day, sun, dist, pitch, yaw, mode, pat (force a pattern number on every roof), q }]
   A step keeps what the step before set unless it names it. Writes <outdir>/<tag>_<name>.png and <outdir>/<tag>.json. */
const L = require('./lib.js'), path = require('path'), fs = require('fs');
const FILE = process.argv[2], ADDR = process.argv[3], TAG = process.argv[4], OUT = path.resolve(process.argv[5] || '.'), PLAN = JSON.parse(fs.readFileSync(process.argv[6], 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { page, errs, close } = await L.launch({ w: 960, h: 700, hard: +process.env.HARD || 24 }); const wait = L.wait, log = {};
  await L.openPage(page, FILE); const st = await L.find(page, ADDR);
  const picked = await page.evaluate(() => ({ name: document.querySelector('#scName').textContent, sub: document.querySelector('#scSub').textContent }));
  const s0 = await L.engine(page, { q: 'low' }); console.log(TAG, 'engine', JSON.stringify(s0), JSON.stringify(picked));
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'high', sun: 14, weather: 'clear', life: false, trees: true, wide: false }); en.engine.autoQuality = false; });
  await page.evaluate(() => { const b = document.querySelector('#scEnBar [data-a="full"]'); if (b) b.click(); }); await wait(2500);
  const ready = async (lens) => { let g = null; for (let i = 0; i < 45; i++) { await wait(2000); g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return { lens: g.lens, n: g.lensN, pend: g.lensPending, q: g.label, fps: g.fps }; }); if (lens === 'off' || (g.lens === lens && g.n > 0 && !g.pend)) break; } await wait(5000); return g; };
  let cur = {};
  for (const P of PLAN) {
    const t0 = Date.now();
    await page.evaluate(({ P, cur }) => { const api = MODI.rooftops.api, en = api.en(), w = en.world, L0 = api.lens;
      if (P.q) { en.setGraphics({ q: P.q }); en.engine.autoQuality = false; }
      if (P.mode && P.mode !== cur.mode) en.setHeight(P.mode);
      if ((P.mode || cur.mode) === 'orbit') { if (P.dist) w.orbit.dist = P.dist; if (P.pitch != null) w.orbit.pitch = P.pitch; if (P.yaw != null) w.orbit.yaw = P.yaw; w.orbitSpin = false; }
      else { if (P.yaw != null) w.yaw = P.yaw; if (P.pitch != null) w.pitch = P.pitch; }
      const G = {}; if (P.day) G.day = P.day; if (P.sun != null) G.sun = P.sun; if (P.year != null) G.year = P.year; if (P.trees != null) G.trees = P.trees; if (Object.keys(G).length) en.setGraphics(G);
      if (P.rain) api.setRain(P.rain); if (P.wind) api.setWind(P.wind); if (P.sky) api.setSky(P.sky);
      if ('pat' in P) { if (!L0._ready0) L0._ready0 = L0.ready; const kind = P.pat; L0.ready = !kind ? L0._ready0 : R => { const r = L0._ready0(R); if (r && R.lens === 'cover') { const row = kind === 15 ? L0.rows.tileC : kind === 16 || kind === 11 ? 10 : kind === 17 ? 19 : kind === 18 || kind === 14 ? 11 : kind === 13 ? 12 : kind >= 9 ? 9 : 8, cv = [0.9, 1, kind, row]; r.vertex = () => cv; } return r; }; }
    }, { P, cur });
    if (P.lens && P.lens !== cur.lens) { await page.evaluate(k => { const b = document.querySelector('#scEnBar [data-lens="' + k + '"]'); b.click(); }, P.lens); }
    else await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.lensRefresh(); });
    cur = Object.assign(cur, P);
    const g = await ready(cur.lens || 'off');
    const info = await page.evaluate(() => { const en = MODI.rooftops.api.en(), s = en.state(), e = document.querySelector('.se-legend, .se-leg'); const labs = [...document.querySelectorAll('.se-labels > *')].map(x => x.textContent).filter(Boolean).slice(0, 14);
      return { legend: e ? e.innerText.replace(/\n{2,}/g, '\n').slice(0, 2600) : '', labels: labs, state: { mode: s.mode, elev: s.elev != null ? Math.round(s.elev) : null, precip: s.precip, snowM: s.snowLevelM, stormKey: s.stormKey, windKey: s.windKey, sky: s.sky, skyOn: s.skyOn, gust: s.gustMph }, line: (document.querySelector('#scEnStormO') || {}).innerText.slice(0, 260) }; });
    const ok = await L.shot(page, path.join(OUT, TAG + '_' + P.name + '.png'));
    log[P.name] = Object.assign({ g, shot: ok, s: Math.round((Date.now() - t0) / 1000) }, info);
    console.log(TAG, P.name, JSON.stringify(g), Math.round((Date.now() - t0) / 1000) + ' s'); fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify({ addr: ADDR, picked, log, errs }, null, 1));
  }
  console.log('PAGE ERRORS:', errs.length ? errs.length + '\n' + [...new Set(errs)].slice(0, 8).join('\n') : 'none');
  await close(); process.exit(0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
