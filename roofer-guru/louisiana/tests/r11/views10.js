/* live views (cached answers), committed build against the working build: datings, shared permits, statuses, and every
   building whose status or year changes. node views.js [place,...] */
const H = require('../../review/fixcheck/mv_harness.js'), path = require('path');
const ALL = [['bayou', 29.9716, -90.0829], ['gentilly', 30.0045, -90.0535], ['frenchq', 29.9590, -90.0650], ['uptown', 29.9300, -90.1050], ['woodgate', 30.3859, -91.1431], ['alvin', 30.398, -91.178], ['samuels', 30.6335, -91.2433], ['coursey', 30.4107, -91.0365], ['pasteur', 30.01976, -90.06367], ['pocahontas', 30.001766, -90.042257], ['mithra', 30.01255, -90.077775]];
const want = process.argv[2] ? process.argv[2].split(',') : null, places = ALL.filter(p => !want || want.includes(p[0]));
const BASE = path.join(__dirname, '..', 'r10', 'scout_pre_r10.js'), NEW = path.join(__dirname, '..', '..', 'build', 'scout.js');
async function load(S, la, lo) {
  const x0 = S.lon2x(lo, S.TILE_Z), y0 = S.lat2y(la, S.TILE_Z);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const x = x0 + dx, y = y0 + dy, k = x + '/' + y; let t = S.T.get(k);
    if (!t) { t = { k, x, y, box: S.tileBox(S.TILE_Z, x, y), ids: new Set(), st: 'idle', at: 0 }; S.T.set(k, t); }
    const bs = S.ingest(await S.fetchBuildings(t.box, 0), t); bs.forEach(b => S.read(b));
    const fips = [...new Set(bs.map(b => b.fips).filter(Boolean))];
    if (fips.some(f => S.PCOV[f] === 'yes')) { try { S.joinParcels(t, await S.fetchParcels(t.box, 0)); } catch (e) { } }
    if (fips.some(f => S.PFILE[f])) { const pr = await S.fetchPermits(t); S.joinPermits(t, pr); }
    t.ids.forEach(id => { const b = S.B.get(id); if (b) S.read(b); });
  }
}
const stats = S => { const bs = [...S.B.values()], st = { g: 0, o: 0, r: 0 }; bs.forEach(b => st[b.status]++);
  const dated = bs.filter(b => b.ybSrc === 'permit'), far = dated.filter(b => { const nc = b.permits.filter(p => p.kind === 'newc' && (p.via === 'addr' || p.via === 'in')).sort((x, y) => x.y - y.y)[0]; return nc && S.edgeMeters(nc.lat, nc.lon, b) > 2; });
  const hold = new Map(); bs.forEach(b => b.permits.forEach(p => hold.set(p, (hold.get(p) || 0) + 1)));
  return { n: bs.length, dated: dated.length, datedFar: far.length, spread: [...hold.values()].filter(v => v > 1).length, st }; };
(async () => {
  for (const [nm, la, lo] of places) {
    const O = H(BASE), N = H(NEW); await load(O, la, lo); await load(N, la, lo);
    const so = stats(O), sn = stats(N); const ex = [];
    N.B.forEach((b, id) => { const q = O.B.get(id); if (!q) return; if (b.status !== q.status || b.yb !== q.yb) ex.push(`${b.cls} ${Math.round(b.sqft)} "${b.addr || ''}" ${q.status}${q.sc.score} yb ${q.yb || '-'} -> ${b.status}${b.sc.score} yb ${b.yb || '-'} | ${b.permits.slice(0, 3).map(p => `${p.d.slice(0, 7)} ${p.kind} w${p.w}${p.share < 1 ? 'x' + p.share.toFixed(2) : ''} ${p.via || ''} ${p.desc.slice(0, 50)}`).join(' ; ')}`); });
    console.log(`== ${nm}: ${sn.n} buildings | dated by permit ${so.dated} -> ${sn.dated} (point over 2 m outside: ${so.datedFar} -> ${sn.datedFar}) | permits on 2+ buildings ${so.spread} -> ${sn.spread} | status ${JSON.stringify(so.st)} -> ${JSON.stringify(sn.st)} | changed ${ex.length}`);
    ex.slice(0, +(process.env.NEX || 8)).forEach(e => console.log('    ', e.slice(0, 330)));
  }
})().catch(e => { console.error('ERROR', e); process.exit(1); });
