"""Integration edit 2 on traffic_kit.js (and one line of traffic_core.js): the kit reads the landmark bridges' decks,
   draws no second structure there, keeps its cars on them, and is graded again when the ground under it changes.
   python3 -I e2_kit.py"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
T = os.path.join(HERE, '..', '..', 'traffic')
p = os.path.join(T, 'traffic_kit.js'); s = open(p, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)

rep("    const GY = (x, z) => (S.gy ? S.gy(x, z) : 0), RAD = Math.PI / 180;\n",
    "    const GY = (x, z) => (S.gy ? S.gy(x, z) : 0), RAD = Math.PI / 180;\n"
    "    /* The landmark bridges are built by the aircraft, ships and bridges kit, which gives their decks' heights (S.deckAt). A road that\n"
    "       runs along such a deck rides it: skyY is the deck's height in local y under (x, z) for a road heading (hx, hz), or null (no deck,\n"
    "       or a road that only passes under it). Where a bridge has two decks, traffic heading east takes the lower one (the Bay Bridge's west span). */\n"
    "    const SKQ = { info: true }, skyY = (x, z, hx, hz) => { if (!S.deckAt) return null; const d = S.deckAt(x, z, SKQ); if (!d) return null; if (hx != null && Math.abs(hx * d.tx + hz * d.tz) < 0.8) return null; return d.lower && hx > 0.15 ? d.y - d.lower : d.y; };\n"
    "    const PREP = { sky: (x, z, hx, hz) => { const y = skyY(x, z, hx, hz); return y == null ? null : y - GY(x, z); } };\n"
    "    /* where a vehicle of the freeway model stands: on the landmark deck if its piece runs on one, else on its own deck over the ground */\n"
    "    const yOn = c => { if (c.seg && c.seg.sk) { const y = skyY(c.x, c.z, c.hx, c.hz); if (y != null) return y; } return GY(c.x, c.z) + c.dk; };\n"
    "    TF.skyY = skyY; TF.yOn = yOn;\n")

# the surface streets and the freeways: prepared with the decks, bridges levelled over the ground
rep("pts: r.pts.map(p => S.toL(p[0], p[1])) })).filter(r => r.pts.length >= 2), roads = RP.prep(loc);",
    "pts: r.pts.map(p => S.toL(p[0], p[1])) })).filter(r => r.pts.length >= 2), roads = RP.prep(loc, PREP); RP.level(roads, GY); gradeV = gradeNow();")
rep("      const roads = RP.prep(loc); RP.high(roads); RP.ground(roads); F.setRoads(roads);",
    "      const roads = RP.prep(loc, PREP); RP.high(roads); RP.ground(roads); RP.level(roads, GY); F.setRoads(roads);")
rep("+ ':' + (TF.streets ? TF.streets.filter(r => r.up).length : 0); if (key === fwyKey) return false; fwyKey = key;",
    "+ ':' + (TF.streets ? TF.streets.filter(r => r.up).length : 0) + ':' + gradeV; if (key === fwyKey) return false; fwyKey = key;")
# graded again: called by the world at the head of its street build (which runs again when the ground's data arrives)
rep("    /* what the world's street builder gets:",
    "    /* The ground firms up as its tiles arrive, the datum moves, and the landmark bridges can be switched off: the heights of the decks over\n"
    "       the ground are worked out again then, on the roads as they stand (the world calls this at the head of its street build). */\n"
    "    let gradeV = ''; const gradeNow = () => (S.roadTV || 0) + '/' + (S.y0 || 0) + '/' + (S.deckAt && S.deckAt(0, 0, { on: true }) ? 1 : 0);\n"
    "    TF.regrade = () => { const v = gradeNow(); if (v === gradeV || !TF.streets) return false; gradeV = v; RP.decks(TF.streets, PREP); RP.level(TF.streets, GY); fwyKey = ''; rebuild(); return true; };\n"
    "    /* what the world's street builder gets:")

# no second structure where the landmark deck is: the strip, the slab, the parapets and the piers are left out there
rep("const strip = (B, P, N, Y, a, b, lift, col, aux, d0, d1, acc) => { for (let i = 0; i + 1 < P.length; i++) { if (acc && (acc[i + 1] < d0 || acc[i] > d1)) continue;",
    "const strip = (B, P, N, Y, a, b, lift, col, aux, d0, d1, acc, sk) => { for (let i = 0; i + 1 < P.length; i++) { if (acc && (acc[i + 1] < d0 || acc[i] > d1)) continue; if (sk && sk[i] && sk[i + 1]) continue;")
rep("      if (!o.hide) strip(Bd, P, N, Y, L, Rr, 0.11, null, AX);",
    "      const sk = o.sk || null; if (!o.hide) strip(Bd, P, N, Y, L, Rr, 0.11, null, AX, undefined, undefined, null, sk);")
rep("const up = DK[i] > 1.2 || DK[i + 1] > 1.2, sl = [P[i], P[i + 1]]",
    "const up = (DK[i] > 1.2 || DK[i + 1] > 1.2) && !(sk && sk[i] && sk[i + 1]), sl = [P[i], P[i + 1]]")
rep("const Y = deck(Bd, Bs, Pt, P, N, s.dk, hw + sho, sh, { hide: s.hide, surf: s.r.span ? 'concrete' : 'asphalt' }); if (s.hide) return;",
    "const Y = deck(Bd, Bs, Pt, P, N, s.dk, hw + sho, sh, { hide: s.hide, sk: s.sk, surf: s.r.span ? 'concrete' : 'asphalt' }); if (s.hide) return;")
rep("const Y = deck(Bd, Bs, Pt, P, N, r.dk, hw, () => 0, { surf: r.span ? 'concrete' : 'asphalt' }); if (r.kind === 'major' && !r.ow) {",
    "if (r.kind === 'path') return;   /* a footway on a landmark bridge: the bridge's own deck is all there is to draw */\n"
    "        const Y = deck(Bd, Bs, Pt, P, N, r.dk, hw, () => 0, { sk: r.sk, surf: r.span ? 'concrete' : 'asphalt' }); if (r.kind === 'major' && !r.ow && !r.sky) {")

# vehicles: on the deck; nose up or down with the deck's own slope as well as the ground's
rep("const dx = c.x - eye[0], dz = c.z - eye[1], y = GY(c.x, c.z) + c.dk, d = Math.sqrt(dx * dx + dz * dz + (ey - y) * (ey - y));",
    "const dx = c.x - eye[0], dz = c.z - eye[1], y = yOn(c), d = Math.sqrt(dx * dx + dz * dz + (ey - y) * (ey - y));")
rep("const sp = d < 400 ? (S.gy && c.dk < 0.3 ? pitchOf(c, c.hl) : c.dkS || 0) : 0;",
    "const sp = d < 400 ? (c.dk < 0.3 && !c.seg.sk ? (S.gy ? pitchOf(c, c.hl) : 0) : deckPitch(c)) : 0;")
rep("    /* the street traffic's cars are placed through here too",
    "    /* on a deck: the slope of the deck itself, from the two points of its piece the vehicle is between */\n"
    "    const deckPitch = c => { const s = c.seg, i = c.gi; if (!s || i == null || i + 1 >= s.pts.length) return 0; const a = s.pts[i], b = s.pts[i + 1], l = s.acc[i + 1] - s.acc[i] || 1; return clamp((GY(b[0], b[1]) + s.dk[i + 1] - GY(a[0], a[1]) - s.dk[i]) / l, -0.4, 0.4); };\n"
    "    /* the street traffic's cars are placed through here too")
# street cars (the older model) and its buses: a car on a street that runs along a landmark deck is on that deck
rep("SE.carPut = (ib, Sx, c, alpha) => { if (ib._onGround) ib.add(c.x, c.dk ? GY(c.x, c.z) + c.dk : 0, c.z, c.yaw, 1, 1, 1, c.col[0], c.col[1], c.col[2], alpha); else put(ib, c.x, GY(c.x, c.z) + (c.dk || 0), c.z, c.hx, c.hz, c.dk > 0.3 ? 0 : pitchOf(c, c.hl || 2.4), c.col, alpha); };",
    "const yStreet = c => { if (c.dk > 0.3 && S.deckAt) { const y = skyY(c.x, c.z, c.hx, c.hz); if (y != null) return y; } return GY(c.x, c.z) + (c.dk || 0); };\n"
    "    SE.carPut = (ib, Sx, c, alpha) => { if (ib._onGround && !(c.dk > 0.3)) ib.add(c.x, 0, c.z, c.yaw, 1, 1, 1, c.col[0], c.col[1], c.col[2], alpha); else put(ib, c.x, yStreet(c), c.z, c.hx, c.hz, c.dk > 0.3 ? 0 : pitchOf(c, c.hl || 2.4), c.col, alpha); };")
rep("for (const c of ST.bigCars) put(big.bus, c.x, GY(c.x, c.z) + (c.dk || 0), c.z,", "for (const c of ST.bigCars) put(big.bus, c.x, yStreet(c), c.z,")
open(p, 'w', encoding='utf-8').write(s)

p = os.path.join(T, 'traffic_core.js'); s = open(p, encoding='utf-8').read()
rep("c.dk = s.dk[i] + (s.dk[i + 1] - s.dk[i]) * t; c.vcap =", "c.dk = s.dk[i] + (s.dk[i + 1] - s.dk[i]) * t; c.gi = i; c.vcap =")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
