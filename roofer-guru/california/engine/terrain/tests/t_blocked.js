/* No elevation tiles (every request to the tile server refused): the world still builds, on the carried grid in California
   and flat at 0 where there is no grid (Baton Rouge, as Louisiana's page was); nothing throws; and when the tiles are
   let through again the ground catches up.
   node t_blocked.js <page.html> <shots dir> */
const L = require('./lib.js'), { ok, wait } = L;
const FILE = process.argv[2], SH = process.argv[3] || '.';
(async () => {
  const T = await L.start(FILE, '200 N Spring St, Los Angeles, CA', { blockElevation: true });
  const read = () => T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, st = en.state(), d = en.debug(); let lo = 1e9, hi = -1e9; for (let i = 0; i < 200; i++) { const y = S.gy(S.x + (i % 20 - 10) * 60, S.z + ((i / 20 | 0) - 5) * 60); if (y < lo) lo = y; if (y > hi) hi = y; }
    return { t: st.terrain, y0: S.y0, ground: st.ground, agl: st.agl, elev: st.elev, lo, hi, cells: d.cells.length, cellsBuilt: d.cells.filter(c => c.built).length, built: st.built, far: d.far }; });
  await T.open(34.0537, -118.2427, 0, { mode: 'street' }); await wait(14000); await T.ready(40000, true);
  const a = await read(); console.log('LA, tiles refused', JSON.stringify(a));
  ok(a.t.ok === 0 && a.t.failed > 0, 'no elevation tile arrived (' + a.t.failed + ' refused)');
  ok(a.cellsBuilt === a.cells && a.built > 20, 'every cell was built all the same (' + a.cellsBuilt + ' cells, ' + a.built + ' buildings)');
  ok(a.t.grid && Math.abs(a.ground - 93) < 60, 'the ground is the carried grid\'s: ' + a.ground.toFixed(0) + ' m at City Hall (93 m with tiles)');
  ok(Math.abs(a.agl - 1.7) < 0.05, 'the eye is 1.7 m over it', a.agl);
  await T.shot(SH + '/la_tiles_blocked_grid.png', 9000);
  /* outside the grid, with no tiles: flat at 0, as the Louisiana page was */
  await T.open(30.4515, -91.1871, 0, { mode: 'street' }); await wait(14000); await T.ready(40000, true);
  const b = await read(); console.log('Baton Rouge, tiles refused', JSON.stringify(b));
  ok(b.y0 === 0 && b.lo === 0 && b.hi === 0 && Math.abs(b.ground) < 1e-9, 'Baton Rouge: the ground is flat at 0 for 600 m round, datum 0', [b.y0, b.lo, b.hi]);
  ok(Math.abs(b.elev - 1.7) < 0.01 && b.cellsBuilt === b.cells && b.far > 50, 'the eye is at 1.7 m, the cells and the far ground are built', [b.elev, b.cellsBuilt, b.far]);
  await T.shot(SH + '/batonrouge_flat_no_tiles.png', 9000);
  /* back to Los Angeles; the tiles are let through; the ground catches up by itself */
  await T.open(34.0537, -118.2427, 0, { mode: 'street' }); await wait(8000);
  await T.ctx.unroute(/elevation-tiles-prod/); const t0 = Date.now(); let c = null;
  for (let i = 0; i < 100; i++) { await wait(2000); c = await read(); if (c.t.ok > 8 && !c.t.loading && !c.t.queue && Math.abs(c.ground - 93) < 6) break; }
  console.log('LA, tiles let through', ((Date.now() - t0) / 1000).toFixed(0) + ' s', JSON.stringify(c));
  ok(c.t.ok > 8 && Math.abs(c.ground - 93) < 6, 'with the tiles let through the ground came right by itself in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s: ' + c.ground.toFixed(1) + ' m');
  ok(Math.abs(c.agl - 1.7) < 0.05 && c.cellsBuilt === c.cells, 'and the eye and the cells went with it', [c.agl, c.cellsBuilt, c.cells]);
  ok(!T.errs.length, 'no page errors', T.errs.slice(0, 3));
  await T.browser.close(); process.exit(L.bad() ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
