"""Integration edit 3 on car_world.js: the car knows the freeways the traffic kit keeps, rides the decks the kit draws
   (the same line between the same points) and the landmark bridges' decks (S.deckAt), whose rails are walls.
   python3 -I e3_car.py"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, '..', '..', 'car', 'car_world.js'); s = open(p, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)

# the road pieces near the car: the surface streets, and the freeways, ramps and raised streets the traffic kit builds
rep("      for (const r of S.roads) { if (r.kind === 'path' || r.kind === 'cable') continue; const sp2 = carRoadSpec(r), P = r.pts; for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1]; if (Math.min(a[0], b[0]) > x + R2 || Math.max(a[0], b[0]) < x - R2 || Math.min(a[1], b[1]) > z + R2 || Math.max(a[1], b[1]) < z - R2) continue; segs.push([a[0], a[1], b[0] - a[0], b[1] - a[1], sp2[0], sp2[1], r, r.dk ? +r.dk[i] || 0 : 0, r.dk ? +r.dk[i + 1] || 0 : 0]); } }",
    "      /* a piece: [x, z, dx, dz, half width, thickness, road, deck height over the land at each end, on a landmark deck?, and for a road the traffic kit\n"
    "         draws (a freeway, a ramp, a street on a bridge) the height of its drawn surface at each end: the car rides that line, as the traffic does] */\n"
    "      const take = (r, own) => { if (r.kind === 'path' || r.kind === 'cable' || r.pts.length < 2) return; const sp2 = carRoadSpec(r), P = r.pts, dk = r.dk, sk = r.sk; for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1]; if (Math.min(a[0], b[0]) > x + R2 || Math.max(a[0], b[0]) < x - R2 || Math.min(a[1], b[1]) > z + R2 || Math.max(a[1], b[1]) < z - R2) continue; const d0 = dk ? Math.max(0, +dk[i] || 0) : 0, d1 = dk ? Math.max(0, +dk[i + 1] || 0) : 0; segs.push([a[0], a[1], b[0] - a[0], b[1] - a[1], sp2[0], own ? 0.11 : sp2[1], r, d0, d1, sk && sk[i] && sk[i + 1] ? 1 : 0, own ? carLand(a[0], a[1]) + d0 + 0.11 : null, own ? carLand(b[0], b[1]) + d1 + 0.11 : null]); } };\n"
    "      for (const r of S.roads) take(r, !!r.up); if (S.traffic && S.traffic.roads) for (const r of S.traffic.roads) take(r, true);")
rep("function carRoadAt(x, z) { let best = null, bd = 1e9; const cur = CARW.lift || 0; for (const s of CARW.segs) { const l2 = s[2] * s[2] + s[3] * s[3], t = l2 ? clamp(((x - s[0]) * s[2] + (z - s[1]) * s[3]) / l2, 0, 1) : 0, d = Math.hypot(x - s[0] - s[2] * t, z - s[1] - s[3] * t); if (d > s[4]) continue; const lift = s[5] + s[7] + (s[8] - s[7]) * t, e = Math.abs(lift - cur); if (e < bd) { bd = e; best = [lift, s[6]]; } } return best; }\n"
    "    const carGround = (x, z) => { const r = carRoadAt(x, z); return carLand(x, z) + (r ? r[0] : 0); };",
    "function carRoadAt(x, z) { let best = null, bd = 1e9; const cur = CARW.lift || 0, land = carLand(x, z); for (const s of CARW.segs) { const l2 = s[2] * s[2] + s[3] * s[3], t = l2 ? clamp(((x - s[0]) * s[2] + (z - s[1]) * s[3]) / l2, 0, 1) : 0, d = Math.hypot(x - s[0] - s[2] * t, z - s[1] - s[3] * t); if (d > s[4]) continue; const lift = s[10] != null ? Math.max(0.02, s[10] + (s[11] - s[10]) * t - land) : s[5] + s[7] + (s[8] - s[7]) * t, e = Math.abs(lift - cur); if (e < bd) { bd = e; best = [lift, s[6], s]; } } return best; }\n"
    "    /* a landmark bridge's deck under the car (S.deckAt, from the aircraft, ships and bridges kit): the car is on it when it is at the deck's height\n"
    "       (it drove on at the end), not when it passes far beneath; when the car is being set down, when the road it is set on runs on the deck */\n"
    "    const CARDQ = { info: true };\n"
    "    function carDeck(x, z, r) { if (!S.deckAt) return null; const d = S.deckAt(x, z, CARDQ); if (!d) return null; const ref = CARW.placing ? (r && r[2][9] ? 1e9 : -1e9) : (CAR ? CAR.state.y : 0) + 1.6; if (d.y <= ref) return d.y + 0.03; if (d.lower && d.y - d.lower <= ref) return d.y - d.lower + 0.03; return null; }\n"
    "    const carGround = (x, z) => { const r = carRoadAt(x, z), d = carDeck(x, z, r); return d != null ? d : carLand(x, z) + (r ? r[0] : 0); };\n"
    "    const carGroundAt = (x, z) => { CARW.placing = true; try { return carGround(x, z); } finally { CARW.placing = false; } };")
# set down: on the road's own deck
rep("CAR.place(L.x, L.z, L.yaw, carGround(L.x, L.z))", "CAR.place(L.x, L.z, L.yaw, carGroundAt(L.x, L.z))", 3)
rep("CAR.place(q.x, q.z, q.yaw, carGround(q.x, q.z))", "CAR.place(q.x, q.z, q.yaw, carGroundAt(q.x, q.z))")
# the lane the car is set on: the deck height never below the ground (a tunnel is driven over, not under)
rep("dk = r.dk ? (+r.dk[o.si] || 0) + ((+r.dk[o.si + 1] || 0) - (+r.dk[o.si] || 0)) * o.t : 0;",
    "dk = r.dk ? Math.max(0, (+r.dk[o.si] || 0) + ((+r.dk[o.si + 1] || 0) - (+r.dk[o.si] || 0)) * o.t) : 0;")
rep("const list = S.roads.filter(r => r.kind !== 'path' && r.kind !== 'drive' && r.kind !== 'cable' && r.pts.length > 1), o = nearestOnRoads(x, z, maxD || 120, list);",
    "const list = S.roads.concat((S.traffic && S.traffic.roads) || []).filter(r => r.kind !== 'path' && r.kind !== 'drive' && r.kind !== 'cable' && r.pts.length > 1), o = nearestOnRoads(x, z, maxD || 120, list);")
# the rails of a landmark bridge are walls
rep("        let nx = (cx - q[0]) / (d || 1), nz = (cz - q[1]) / (d || 1); if (d < 1e-4 && len > 1e-4) { nx = -dx / len; nz = -dz / len; } CARW.what = q[2] > 0.11 ? 'a tree' : 'a lamp post'; return { nx, nz, depth: Math.max(0.002, rr - d + (cx - x1) * nx + (cz - z1) * nz) }; }\n",
    "        let nx = (cx - q[0]) / (d || 1), nz = (cz - q[1]) / (d || 1); if (d < 1e-4 && len > 1e-4) { nx = -dx / len; nz = -dz / len; } CARW.what = q[2] > 0.11 ? 'a tree' : 'a lamp post'; return { nx, nz, depth: Math.max(0.002, rr - d + (cx - x1) * nx + (cz - z1) * nz) }; }\n"
    "      if (S.deckAt) { const d1 = S.deckAt(x1, z1, CARDQ); if (d1) { const yd = d1.lower && cy < d1.y - d1.lower + 2.2 ? d1.y - d1.lower : d1.y, m = d1.half - 0.45 - r, al = Math.abs(d1.lat); if (Math.abs(yd - cy) < 2.2 && al > m && d1.s > 1 && d1.s < d1.L - 1) { const sg = d1.lat > 0 ? -1 : 1; CARW.what = 'the bridge rail'; return { nx: sg * -d1.tz, nz: sg * d1.tx, depth: Math.max(0.002, al - m) }; } } }\n")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
