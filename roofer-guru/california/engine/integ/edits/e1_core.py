"""Integration edit 1 on traffic_core.js: road prep takes the landmark bridges' decks (S.deckAt) as given heights,
   and a bridge stays straight between its abutments where the ground falls away under it. Run once:
   python3 -I e1_core.py"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, '..', '..', 'traffic', 'traffic_core.js')
s = open(p, encoding='utf-8').read()
def rep(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:80])
    s = s.replace(a, b)

rep("    P.prep = list => {", "    P.prep = (list, o) => {")
rep("      P.decks(out); return out; };", "      P.decks(out, o); return out; };")

i0 = s.index("    P.decks = roads => {")
i1 = s.index("    /* a long bridge that the map names as a bridge")
new = r"""    /* o.sky(x, z, hx, hz) (optional): where a landmark bridge is built as a structure of its own (the aircraft, ships and bridges
       kit: S.deckAt), the height of its deck above the ground at that point for a road running along it, else null. Such points
       are given: nothing here raises or lowers them, the road is marked r.sky (r.sk[i] = 1 at each such point), and the roads
       that lead on from the deck's end come away from its height at a grade (up to their own bridge's level, or down to the ground). */
    P.decks = (roads, o) => {
      const sky = o && o.sky, N = new Map(), FX = new Map(), drive = r => r.kind !== 'path' && r.kind !== 'cable';
      const skyOn = r => { const P2 = r.pts, n = P2.length; let any = 0, run = 0, best = 0; const sk = new Uint8Array(n); for (let i = 0; i < n; i++) { const a = P2[Math.max(0, i - 1)], b = P2[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, v = sky(P2[i][0], P2[i][1], (b[0] - a[0]) / l, (b[1] - a[1]) / l); if (v != null) { r.dk[i] = v; sk[i] = 1; any++; run++; if (run > best) best = run; } else run = 0; } r.sk = best >= 2 ? sk : null; r.sky = best >= 2; if (!r.sky && any) for (let i = 0; i < n; i++) if (sk[i]) r.dk[i] = r.span ? r.lv * LEVEL : 0; };
      roads.forEach(r => { r.dk = r.pts.map(() => (r.span ? r.lv * LEVEL : 0)); r.sky = false; r.sk = null; if (sky && r.kind !== 'cable') skyOn(r); if (!drive(r)) return;
        r.pts.forEach((p, i) => { const k = key(p); if (r.sk && r.sk[i]) { FX.set(k, r.dk[i]); N.set(k, r.dk[i]); return; } if (FX.has(k)) return; const v = N.get(k); if (v === undefined || r.dk[i] > v) N.set(k, r.dk[i]); }); });
      for (let pass = 0, ch = true; ch && pass < 12; pass++) { ch = false; roads.forEach(r => { if (!drive(r)) return; const g = r.kind === 'freeway' || r.kind === 'ramp' ? 0.06 : 0.08, n = r.pts.length, h = r.dk, sk = r.sk;
          for (let i = 0; i < n; i++) { if (sk && sk[i]) continue; const k = key(r.pts[i]), f = FX.get(k); if (f !== undefined) { if (h[i] !== f) { h[i] = f; ch = true; } continue; } const v = N.get(k); if (v > h[i] + 0.01) { h[i] = v; ch = true; } }
          for (let i = 1; i < n; i++) { if (sk && sk[i]) continue; if (FX.has(key(r.pts[i]))) continue; const v = h[i - 1] - g * Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); if (v > h[i] + 0.01) { h[i] = v; ch = true; } }
          for (let i = n - 2; i >= 0; i--) { if (sk && sk[i]) continue; if (FX.has(key(r.pts[i]))) continue; const v = h[i + 1] - g * Math.hypot(r.pts[i][0] - r.pts[i + 1][0], r.pts[i][1] - r.pts[i + 1][1]); if (v > h[i] + 0.01) { h[i] = v; ch = true; } }
          for (let i = 0; i < n; i++) { const k = key(r.pts[i]); if (!FX.has(k) && h[i] > N.get(k) + 0.01) { N.set(k, h[i]); ch = true; } } }); }
      /* away from a given deck's end a road may not stand higher than the grade allows: a viaduct that carries on from a landmark bridge meets it, and does not step up to its own level */
      if (FX.size) { const C = new Map(FX); for (let pass = 0, ch = true; ch && pass < 12; pass++) { ch = false; roads.forEach(r => { if (!drive(r)) return; const g = r.kind === 'freeway' || r.kind === 'ramp' ? 0.06 : 0.08, n = r.pts.length, h = r.dk, c = new Float64Array(n); let any = false;
            for (let i = 0; i < n; i++) { const v = C.get(key(r.pts[i])); c[i] = v === undefined ? 1e9 : v; if (v !== undefined) any = true; } if (!any) return;
            for (let i = 1; i < n; i++) c[i] = Math.min(c[i], c[i - 1] + g * Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1])); for (let i = n - 2; i >= 0; i--) c[i] = Math.min(c[i], c[i + 1] + g * Math.hypot(r.pts[i][0] - r.pts[i + 1][0], r.pts[i][1] - r.pts[i + 1][1]));
            for (let i = 0; i < n; i++) { if (c[i] > 40) continue; if (!(r.sk && r.sk[i]) && h[i] > c[i] + 0.01) h[i] = c[i]; if (i === 0 || i === n - 1) { const k = key(r.pts[i]), v = C.get(k); if (v === undefined || v > c[i] + 0.01) { C.set(k, c[i]); ch = true; } } } }); } }
      /* a tunnel dips under the ground from its two mouths */
      roads.forEach(r => { if (r.lv >= 0 || r.kind === 'path' || r.kind === 'cable' || r.sky) return; const n = r.pts.length, a = [0]; for (let i = 1; i < n; i++) a.push(a[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1])); for (let i = 0; i < n; i++) r.dk[i] = -LEVEL * Math.min(1, Math.min(a[i], a[n - 1] - a[i]) / 40); });
      roads.forEach(r => { r.up = r.sky || r.dk.some(v => v > 0.3); r.own = r.kind === 'freeway' || r.kind === 'ramp' || r.kind === 'cable' || r.up || r.lv < 0; });
      /* long gaps between points are filled, so a rise is a slope and not a step, and a deck can follow the ground */
      roads.forEach(r => { if (!r.own) return; const p2 = [r.pts[0]], d2 = [r.dk[0]]; for (let i = 1; i < r.pts.length; i++) { const a = r.pts[i - 1], b = r.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.min(24, Math.floor(l / 16)); for (let j = 1; j <= m; j++) { const t = j / (m + 1); p2.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); d2.push(r.dk[i - 1] + (r.dk[i] - r.dk[i - 1]) * t); } p2.push(b); d2.push(r.dk[i]); } r.pts = p2; r.dk = d2;
        /* on a given deck every point is read again: its profile is a curve, not a line between the map's points */
        if (r.sky) { const n = p2.length, sk = new Uint8Array(n); for (let i = 0; i < n; i++) { const a = p2[Math.max(0, i - 1)], b = p2[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, v = sky(p2[i][0], p2[i][1], (b[0] - a[0]) / l, (b[1] - a[1]) / l); if (v != null) { d2[i] = v; sk[i] = 1; } } r.sk = sk; } }); };
    /* A bridge is straight from one abutment to the other: where the ground falls away under it (a river, a canyon, a cutting) its
       deck does not follow the ground down. gy(x, z): the ground's height. Bridge ways that meet end to end are taken together; where
       they meet other roads (or stop) the deck stands at its level over the ground there; between, heights run evenly, and no point
       of the deck comes lower over the ground than its level. Points on a given deck (r.sk) are left as they are. */
    P.level = (roads, gy) => { const sp = roads.filter(r => r.span && r.kind !== 'path' && r.kind !== 'cable' && r.pts.length > 1); if (!sp.length) return 0; const other = new Set(); roads.forEach(r => { if (r.span || r.kind === 'path' || r.kind === 'cable') return; other.add(key(r.pts[0])); other.add(key(r.pts[r.pts.length - 1])); });
      const ND = new Map(), nd = (p, h) => { const k = key(p); let n = ND.get(k); if (!n) ND.set(k, n = { y: gy(p[0], p[1]) + h, e: [], fix: other.has(k), deg: 0 }); n.deg++; return n; };
      const E = sp.map(r => { const n = r.pts.length; let len = 0; const acc = [0]; for (let i = 1; i < n; i++) { len += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); acc.push(len); } const a = nd(r.pts[0], r.dk[0]), b = nd(r.pts[n - 1], r.dk[n - 1]), w = 1 / Math.max(len, 1); a.e.push([b, w]); b.e.push([a, w]); if (r.sk && r.sk[0]) a.fix = true; if (r.sk && r.sk[n - 1]) b.fix = true; return { r, a, b, acc, len }; });
      const free = []; ND.forEach(n => { if (n.deg < 2) n.fix = true; if (!n.fix) free.push(n); });
      for (let it = 0; it < 80 && free.length; it++) { let mv = 0; for (const n of free) { let sw = 0, sy = 0; for (const [m, w] of n.e) { sw += w; sy += w * m.y; } const y = sy / sw; mv = Math.max(mv, Math.abs(y - n.y)); n.y = y; } if (mv < 0.02) break; }
      let ch = 0; E.forEach(({ r, a, b, acc, len }) => { for (let i = 0; i < r.pts.length; i++) { if (r.sk && r.sk[i]) continue; const v = a.y + (b.y - a.y) * (len ? acc[i] / len : 0) - gy(r.pts[i][0], r.pts[i][1]); if (v > r.dk[i] + 0.05) { r.dk[i] = v; ch++; } } if (ch) r.up = r.up || r.dk.some(v => v > 0.3); }); return ch; };
"""
s = s[:i0] + new + s[i1:]
rep("const sp = roads.filter(r => r.span && /bridge/i.test(r.name || '') && (r.kind === 'freeway' || r.kind === 'major'))", "const sp = roads.filter(r => r.span && !r.sky && /bridge/i.test(r.name || '') && (r.kind === 'freeway' || r.kind === 'major'))")
# the pieces of the freeway model carry the marks
rep("let pts = r.pts.slice(a, b + 1), dk = r.dk.slice(a, b + 1); if (rev) { pts.reverse(); dk.reverse(); }", "let pts = r.pts.slice(a, b + 1), dk = r.dk.slice(a, b + 1), sk = r.sk ? Array.from(r.sk.slice(a, b + 1)) : null; if (rev) { pts.reverse(); dk.reverse(); if (sk) sk.reverse(); }")
rep("const ln = r.ow ? r.ln : Math.max(1, Math.floor(r.ln / 2)), s = { id: segs.length, r, kind: r.kind, pts, dk, acc,", "const ln = r.ow ? r.ln : Math.max(1, Math.floor(r.ln / 2)), s = { id: segs.length, r, kind: r.kind, pts, dk, sk, acc,")
open(p, 'w', encoding='utf-8').write(s)
print('ok', len(s))
