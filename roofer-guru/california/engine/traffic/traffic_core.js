  /* ==== California traffic: what is measured, and what is generated from it ==== */
  /* Measured (and carried here): the hour-by-hour weekday speed and congestion of Los Angeles, San Francisco and San
     Diego (TomTom Traffic Index 2025, all roads, Monday to Friday averages), each metro's freeway and street speeds at
     free flow and in the two rush hours (same source), and Caltrans' 2024 count of vehicles a day at the nearest count
     point on the state highways (SE.AADT). Chosen, and said so: the share of a day's traffic that falls in each hour
     (a standard weekday curve whose busiest hour is 7 per cent of the day, as Caltrans' K factors for Los Angeles
     are; the hourly counts themselves sit behind a login), truck shares by route (Caltrans truck counts, rounded),
     and how a freeway's load turns the metro's speed into its own. Generated: every single car. */
  SE.TrafficData = (() => {
    const D = {}, MPH = 0.44704;
    D.METRO = {
      la: { name: 'Los Angeles', box: [33.3, 34.5, -119.0, -117.3], v: [41, 42, 44, 47, 50, 44, 34, 25, 23, 27, 28, 28, 27, 26, 24, 21, 20, 19, 23, 28, 32, 35, 37, 39], c: [7, 5, 4, 3, 3, 14, 37, 61, 68, 54, 46, 45, 49, 54, 65, 80, 87, 90, 70, 44, 29, 22, 17, 12], fwy: [68, 45, 36, 30], st: [25, 17, 16, 14], cycle: [90, 120], bus: 0.012 },
      sf: { name: 'San Francisco', box: [37.2, 38.1, -122.7, -121.7], v: [30, 30, 31, 36, 39, 36, 30, 24, 20, 22, 23, 23, 22, 22, 21, 20, 19, 18, 19, 22, 24, 25, 26, 27], c: [12, 9, 8, 5, 4, 12, 23, 39, 52, 44, 38, 38, 39, 39, 44, 52, 59, 66, 51, 35, 28, 25, 21, 17], fwy: [63, 48, 40, 36], st: [20, 14, 13, 12], cycle: [60, 90], bus: 0.035 },
      sd: { name: 'San Diego', box: [32.5, 33.3, -117.4, -116.8], v: [43, 45, 47, 50, 50, 47, 42, 33, 32, 36, 36, 35, 34, 34, 32, 28, 27, 28, 32, 35, 36, 38, 40, 42], c: [7, 6, 6, 4, 4, 9, 20, 42, 44, 29, 26, 28, 31, 31, 41, 59, 62, 58, 38, 26, 22, 18, 13, 10], fwy: [70, 58, 50, 42], st: [29, 21, 20, 18], cycle: [80, 110], bus: 0.01 }
    };
    /* the share of a weekday's traffic in each hour (a choice: see above); sums to 1 */
    const SH = [0.9, 0.6, 0.5, 0.5, 0.9, 2.2, 4.6, 6.4, 6.3, 5.4, 5.2, 5.4, 5.6, 5.8, 6.3, 6.9, 7.2, 7.0, 5.8, 4.6, 3.9, 3.4, 2.6, 1.7], SHT = SH.reduce((a, b) => a + b, 0);
    const lerpH = (A, h) => { h = ((h % 24) + 24) % 24; const i = Math.floor(h), f = h - i; return A[i] + (A[(i + 1) % 24] - A[i]) * f; };
    D.share = h => lerpH(SH, h) / SHT;
    D.metroOf = (la, lo) => { for (const k in D.METRO) { const b = D.METRO[k].box; if (la > b[0] && la < b[1] && lo > b[2] && lo < b[3]) return k; } return null; };
    /* the hour of the day by the sun at a longitude (within a quarter of an hour of Pacific Standard Time in the three metros) */
    D.hourOf = (date, lon) => { const t = date instanceof Date ? date : new Date(date); return (((t.getUTCHours() + t.getUTCMinutes() / 60 + lon / 15) % 24) + 24) % 24; };
    /* trucks' share of a freeway's traffic, by route (Caltrans Truck AADT 2024, rounded; 4 per cent where not looked up) */
    const TRUCK = { la: { 5: 0.065, 710: 0.085, 10: 0.034, 405: 0.03, 101: 0.033, 110: 0.04, 105: 0.05 }, sf: { 80: 0.025, 101: 0.02, 280: 0.02 }, sd: { 5: 0.045, 8: 0.028, 163: 0.033, 15: 0.035, 75: 0.028 } };
    D.truck = (route, metro) => (TRUCK[metro] && TRUCK[metro][route]) || (metro ? 0.035 : 0.07);
    /* the nearest count point: the same route within 4 km if there is one, else any within 1.5 km */
    let PT = null;
    const decode = () => { const s = (SE.AADT && SE.AADT.d) || '', n = s.length / 10; PT = { n, la: new Float32Array(n), lo: new Float32Array(n), a: new Float32Array(n), r: new Int16Array(n) }; for (let i = 0; i < n; i++) { const o = i * 10; PT.la[i] = 32 + parseInt(s.substr(o, 3), 36) / 1000; PT.lo[i] = -125 + parseInt(s.substr(o + 3, 3), 36) / 1000; PT.a[i] = parseInt(s.substr(o + 6, 2), 36) * 1000; PT.r[i] = parseInt(s.substr(o + 8, 2), 36); } };
    D.near = (la, lo, route) => { if (!PT) decode(); const kx = 111.32 * Math.cos(la * Math.PI / 180), ky = 110.9; let best = null, bd = 1e9; for (let i = 0; i < PT.n; i++) { const dy = (PT.la[i] - la) * ky; if (dy > 4 || dy < -4) continue; const dx = (PT.lo[i] - lo) * kx, d = Math.hypot(dx, dy), same = route && PT.r[i] === route; if (d > (same ? 4 : 1.5)) continue; const sc = d + (same || !route ? 0 : 8); if (sc < bd) { bd = sc; best = { aadt: PT.a[i], route: PT.r[i], km: d, same: !!same }; } } return best; };
    D.routeOf = ref => { const m = /(\d+)/.exec(ref || ''); return m ? +m[1] : 0; };
    /* a freeway carriageway at an hour: the speed it runs at (m/s) and the cars on a kilometre of each lane.
       o: { metro, hour, aadt (both directions, or 0 if no count is near), lanes (this carriageway), vff (its limit, m/s), kOf(v, v0) } */
    D.freeway = o => { const M = D.METRO[o.metro], per = o.aadt ? o.aadt / 2 / Math.max(1, o.lanes) : (M ? 26000 : 6000), q = per * D.share(o.hour), vff = o.vff; let v = vff;
      if (M) { const vmax = Math.max.apply(null, M.v), ratio = Math.pow(lerpH(M.v, o.hour) / vmax, 0.85), load = clamp(per / 30000, 0.2, 1.1); v = vff * (1 - (1 - ratio) * Math.min(1, Math.pow(load, 1.5))); }
      else if (q > 2000) v = vff * clamp(2000 / q, 0.3, 1);
      const kFree = q / (v * 3.6), k = v < 0.82 * vff ? o.kOf(v, vff) : Math.max(0.6, Math.min(kFree, o.kOf(0.82 * vff, vff)));
      return { v, k, q, per, truck: D.truck(o.route, o.metro) * (o.hour > 6 && o.hour < 19 ? 1 : 1.6) }; };
    /* surface streets at an hour: cars on a kilometre of lane, and the signals' cycle */
    D.street = (metro, hour, centre) => { const M = D.METRO[metro]; if (!M) { const s = D.share(hour) / (7.2 / SHT); return { k: 1 + 13 * s, cycle: 70, cong: s * 0.5, bus: 0.006 }; } const c = lerpH(M.c, hour) / 100, peak = (hour >= 6 && hour < 10) || (hour >= 15 && hour < 19); return { k: 1 + 26 * c * (centre ? 1.15 : 1), cycle: M.cycle[peak ? 1 : 0], cong: c, bus: M.bus }; };
    D.MPH = MPH; return D;
  })();

  /* ==== roads as the traffic needs them ==== */
  /* Takes what the dashboard hands over (class, lanes, one-way, limit, bridge, tunnel, layer where OpenStreetMap has them)
     and fills what is missing with a default by class, said here: a freeway carriageway four lanes and 65 mph (Vehicle
     Code 22349), a ramp one lane and 45 mph, an arterial 35 mph, other streets 25 mph (Vehicle Code 22352), lanes 12 ft
     on freeways (Highway Design Manual 301.1). A bridge with no layer is one level up; a level is taken as 6.5 m (an
     assumption: 15 ft of clearance and a deck). Roads rise to a bridge at 6 per cent. */
  SE.RoadPrep = (() => {
    const P = {}, LW = 3.66, LEVEL = 6.5, key = p => Math.round(p[0] * 2) + ':' + Math.round(p[1] * 2);
    const DEF = { motorway: [4, 29.06], motorway_link: [1, 20.1], trunk: [4, 24.6], trunk_link: [1, 15.6], primary: [4, 15.65], primary_link: [1, 13.4], secondary: [4, 15.65], secondary_link: [1, 13.4], tertiary: [2, 13.4], tertiary_link: [1, 11.2], residential: [2, 11.2], unclassified: [2, 11.2], living_street: [2, 6.7], road: [2, 11.2] };
    P.LW = LW; P.LEVEL = LEVEL;
    /* list: [{ name, kind, pts: [[x, z]...] (local metres), hw, lanes, oneway, maxspeed (m/s), layer, bridge, tunnel, ref, id, hov }] */
    P.prep = list => {
      const out = [];
      for (const r0 of list) { if (!r0.pts || r0.pts.length < 2) continue; const r = Object.assign({}, r0), fw = r.kind === 'freeway' || r.kind === 'ramp', d = DEF[r.hw] || (fw ? DEF[r.kind === 'ramp' ? 'motorway_link' : 'motorway'] : r.kind === 'major' ? DEF.primary : DEF.residential);
        r.ow = r.oneway === -1 ? -1 : (r.oneway === 1 || (fw && r.oneway !== 0) || r.kind === 'cable') ? 1 : 0; if (r.ow < 0) { r.pts = r.pts.slice().reverse(); r.ow = 1; }
        r.ln = r.lanes > 0 ? Math.min(9, r.lanes) : r.ow && !fw && d[0] > 2 ? Math.ceil(d[0] / 2) : d[0]; if (!r.ow && fw) r.ln = Math.max(2, r.ln);
        r.sp = r.maxspeed > 2 ? r.maxspeed : d[1]; r.lv = r.tunnel ? Math.min(-1, r.layer || -1) : r.bridge ? Math.max(1, r.layer || 1) : 0; r.span = r.lv > 0;
        if (fw) r.w = r.ln * LW + (r.kind === 'ramp' ? 3.6 : 4.8); else if (r.kind === 'cable') r.w = 0; else if (r.kind === 'major') r.w = clamp(r.ln * 3.25 + 1.2, 9.5, 27); else if (r.kind === 'street' && r.ln > 2) r.w = clamp(r.ln * 3.1 + 2.6, 8.2, 20);
        out.push(r); }
      P.decks(out); return out; };
    /* how high each point of each road stands above the ground: a bridge at its level, and the roads that lead to it rising at a grade */
    P.decks = roads => {
      const N = new Map(); roads.forEach(r => { r.dk = r.pts.map(() => (r.span ? r.lv * LEVEL : 0)); if (r.kind === 'path' || r.kind === 'cable') return; r.pts.forEach((p, i) => { const k = key(p), v = N.get(k); if (v === undefined || r.dk[i] > v) N.set(k, r.dk[i]); }); });
      for (let pass = 0, ch = true; ch && pass < 12; pass++) { ch = false; roads.forEach(r => { if (r.kind === 'path' || r.kind === 'cable') return; const g = r.kind === 'freeway' || r.kind === 'ramp' ? 0.06 : 0.08, n = r.pts.length, h = r.dk;
          for (let i = 0; i < n; i++) { const v = N.get(key(r.pts[i])); if (v > h[i] + 0.01) { h[i] = v; ch = true; } }
          for (let i = 1; i < n; i++) { const v = h[i - 1] - g * Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); if (v > h[i] + 0.01) { h[i] = v; ch = true; } }
          for (let i = n - 2; i >= 0; i--) { const v = h[i + 1] - g * Math.hypot(r.pts[i][0] - r.pts[i + 1][0], r.pts[i][1] - r.pts[i + 1][1]); if (v > h[i] + 0.01) { h[i] = v; ch = true; } }
          for (let i = 0; i < n; i++) { const k = key(r.pts[i]); if (h[i] > N.get(k) + 0.01) { N.set(k, h[i]); ch = true; } } }); }
      /* a tunnel dips under the ground from its two mouths */
      roads.forEach(r => { if (r.lv >= 0 || r.kind === 'path' || r.kind === 'cable') return; const n = r.pts.length, a = [0]; for (let i = 1; i < n; i++) a.push(a[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1])); for (let i = 0; i < n; i++) r.dk[i] = -LEVEL * Math.min(1, Math.min(a[i], a[n - 1] - a[i]) / 40); });
      roads.forEach(r => { r.up = r.dk.some(v => v > 0.3); r.own = r.kind === 'freeway' || r.kind === 'ramp' || r.kind === 'cable' || r.up || r.lv < 0; });
      /* long gaps between points are filled, so a rise is a slope and not a step, and a deck can follow the ground */
      roads.forEach(r => { if (!r.own) return; const p2 = [r.pts[0]], d2 = [r.dk[0]]; for (let i = 1; i < r.pts.length; i++) { const a = r.pts[i - 1], b = r.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.min(12, Math.floor(l / 28)); for (let j = 1; j <= m; j++) { const t = j / (m + 1); p2.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); d2.push(r.dk[i - 1] + (r.dk[i] - r.dk[i - 1]) * t); } p2.push(b); d2.push(r.dk[i]); } r.pts = p2; r.dk = d2; }); };
    /* a long bridge that the map names as a bridge (the Coronado, the Bay Bridge, the Golden Gate) climbs to let ships under:
       up to 55 m at the middle of its length (the Coronado's deck is 61 m over the channel). Viaducts over land stay at their level. */
    P.high = roads => { const sp = roads.filter(r => r.span && /bridge/i.test(r.name || '') && (r.kind === 'freeway' || r.kind === 'major')), par = sp.map((r, i) => i), find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }, ends = new Map();
      sp.forEach((r, i) => [r.pts[0], r.pts[r.pts.length - 1]].forEach(p => { const k = key(p), j = ends.get(k); if (j === undefined) ends.set(k, i); else par[find(i)] = find(j); }));
      const G = new Map(); sp.forEach((r, i) => { const g = find(i); let o = G.get(g); if (!o) G.set(g, o = { len: 0, rs: [], pts: [] }); for (let q = 1; q < r.pts.length; q++) o.len += Math.hypot(r.pts[q][0] - r.pts[q - 1][0], r.pts[q][1] - r.pts[q - 1][1]); o.rs.push(r); o.pts.push(r.pts[0], r.pts[r.pts.length - 1]); });
      G.forEach(o => { if (o.len < 900) return; let A = o.pts[0], B = o.pts[1], bd = 0; for (const p of o.pts) for (const q of o.pts) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > bd) { bd = d; A = p; B = q; } } const hm = clamp((o.len - 600) / 45, 0, 55), ux = (B[0] - A[0]) / bd, uz = (B[1] - A[1]) / bd;
        o.rs.forEach(r => { r.dk = r.dk.map((v, i) => v + hm * Math.sin(Math.PI * clamp(((r.pts[i][0] - A[0]) * ux + (r.pts[i][1] - A[1]) * uz) / bd, 0, 1))); r.high = true; }); }); };
    /* a ramp that ends on a surface street comes down to the ground there */
    P.ground = roads => { const use = new Map(); roads.forEach(r => { if (r.kind !== 'freeway' && r.kind !== 'ramp') return; [r.pts[0], r.pts[r.pts.length - 1]].forEach(p => use.set(key(p), (use.get(key(p)) || 0) + 1)); r.pts.slice(1, -1).forEach(p => use.set(key(p), (use.get(key(p)) || 0) + 2)); });
      roads.forEach(r => { if (r.kind !== 'ramp' || r.span) return; const n = r.pts.length; [[0, 1], [n - 1, -1]].forEach(([e, sd]) => { if (use.get(key(r.pts[e])) > 1) return; let d = 0; for (let i = e; i >= 0 && i < n; i += sd) { if (i !== e) d += Math.hypot(r.pts[i][0] - r.pts[i - sd][0], r.pts[i][1] - r.pts[i - sd][1]); r.dk[i] = Math.min(r.dk[i], 0.09 * d); } }); }); };
    /* the Census file has no direction: of two freeway lines running side by side, each is taken to run with the other on its left */
    P.pairDirs = roads => { const F = roads.filter(r => r.kind === 'freeway' && r.oneway == null); F.forEach(r => { const m = r.pts[Math.floor(r.pts.length / 2)], a = r.pts[Math.max(0, Math.floor(r.pts.length / 2) - 1)], hx = m[0] - a[0], hz = m[1] - a[1], hl = Math.hypot(hx, hz) || 1; let best = 0, bd = 70;
        for (const o of F) { if (o === r) continue; for (const q of o.pts) { const dx = q[0] - m[0], dz = q[1] - m[1], d = Math.hypot(dx, dz); if (d < bd && d > 4) { const side = (dx * -hz + dz * hx) / hl; if (Math.abs(side) > d * 0.7) { bd = d; best = side; } } } }
        r.oneway = best < 0 ? 1 : best > 0 ? -1 : 0; if (r.oneway && !r.lanes) r.lanes = 4; }); };
    return P;
  })();

  /* ==== freeway traffic: lanes, car following, lane changes, merges ==== */
  /* Each carriageway is cut where ramps leave and join, and each piece has lanes, numbered from the left. A car keeps to
     a lane, follows the car ahead by the Intelligent Driver Model (with the slow acceleration, about 1 m/s2, at which
     dense traffic breaks into stop-and-go waves by itself), and changes lane when that gains it something and
     endangers nobody (the rule known as MOBIL), or because its lane ends or its exit is on the other side. Where a ramp
     joins, the two streams take turns into the shared lane by who is nearer the nose. Trucks keep to the two right
     lanes and 55 mph (Vehicle Code 22406); the carpool lane, where the map marks one, takes one car in seven.
     Every car only ever looks at the car ahead in its lane and its neighbours in the next, so a step costs the same per
     car however many there are. */
  SE.Flow = function Flow() {
    const F = { segs: [], cars: [], time: 0, actors: [], events: { changes: 0, reroutes: 0, forced: 0, spawned: 0, left: 0 }, cap: 600, pool: [], _gen: 1 };
    const LW = SE.RoadPrep.LW, key = p => Math.round(p[0] * 2) + ':' + Math.round(p[1] * 2), R = rng(4711);
    const A_CAR = 1.1, A_TRUCK = 0.55, B = 2.0, S0 = 2.2, TH = 1.25;
    /* cars on a kilometre of lane when all drive at v on a road whose free speed is v0 (the model's own equilibrium) */
    F.kOf = (v, v0) => { const x = Math.min(0.985, v / v0), se = (S0 + v * TH) / Math.sqrt(1 - x * x * x * x); return 1000 / (se + 4.9); };
    const idm = (c, v0, gap, dv) => { const am = c.am, x = c.v / Math.max(v0, 0.5); let a = am * (1 - x * x * x * x); if (a < -2.4) a = -2.4; if (gap < 1e8) { const ss = S0 + Math.max(0, c.v * c.th + c.v * dv / (2 * Math.sqrt(am * B))), g = ss / Math.max(gap, 0.3); a -= am * g * g; } return a < -8 ? -8 : a; };

    /* ---------- the network ---------- */
    F.setRoads = roads => {
      const use = new Map(), ways = roads.filter(r => (r.kind === 'freeway' || r.kind === 'ramp' || r.kind === 'cable') && r.pts.length > 1);
      ways.forEach(r => r.pts.forEach((p, i) => { const k = key(p); use.set(k, (use.get(k) || 0) + (i === 0 || i === r.pts.length - 1 ? 1 : 2)); }));
      const segs = [], mk = (r, a, b, rev) => { let pts = r.pts.slice(a, b + 1), dk = r.dk.slice(a, b + 1); if (rev) { pts.reverse(); dk.reverse(); } const n = pts.length, acc = [0]; for (let i = 1; i < n; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); if (acc[n - 1] < 0.6) return;
        const ln = r.ow ? r.ln : Math.max(1, Math.floor(r.ln / 2)), s = { id: segs.length, r, kind: r.kind, pts, dk, acc, len: acc[n - 1], n: ln, lim: r.kind === 'cable' ? 4.25 : r.sp, hov: !!r.hov && ln > 2, hide: r.lv < 0, from: key(pts[0]), to: key(pts[n - 1]), ins: [], outs: [], conn: [], L: [], nx: [], nz: [], vc: new Float32Array(n), act: true, e0: 0, e1: 0, b0: 1, b1: 1, k: 8, vt: r.sp, truck: 0.04, feed: null, shiftX: r.ow ? 0 : (r.ln / 4) * LW };
        for (let i = 0; i < ln; i++) s.L.push([]);
        for (let i = 0; i < n; i++) { const p = pts[Math.max(0, i - 1)], q = pts[Math.min(n - 1, i + 1)], a0 = pts[i]; let ax = a0[0] - p[0], az = a0[1] - p[1], bx = q[0] - a0[0], bz = q[1] - a0[1]; const al = Math.hypot(ax, az), bl = Math.hypot(bx, bz); if (al > 1e-6) { ax /= al; az /= al; } if (bl > 1e-6) { bx /= bl; bz /= bl; } if (al <= 1e-6) { ax = bx; az = bz; } if (bl <= 1e-6) { bx = ax; bz = az; }
          let mx = -(az + bz), mz = ax + bx; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; const cs = Math.max(0.6, mx * -az + mz * ax); s.nx.push(mx / cs); s.nz.push(mz / cs);
          const th = Math.acos(clamp(ax * bx + az * bz, -1, 1)), Rr = th > 0.01 ? Math.max(0.5, (al + bl) / 2) / th : 1e5; s.vc[i] = Math.max(6, Math.sqrt((r.kind === 'ramp' ? 3.4 : 3.0) * Rr)); }
        segs.push(s); };
      ways.forEach(r => { let a = 0; for (let i = 1; i < r.pts.length; i++) if (i === r.pts.length - 1 || use.get(key(r.pts[i])) > 2) { mk(r, a, i, false); if (!r.ow && r.kind !== 'cable') mk(r, a, i, true); a = i; } });
      const N = new Map(), node = k => { let n = N.get(k); if (!n) N.set(k, n = { ins: [], outs: [] }); return n; };
      segs.forEach(s => { node(s.from).outs.push(s); node(s.to).ins.push(s); });
      const hd = (s, end) => { const P = s.pts, n = P.length, a = end ? P[Math.max(0, n - 1 - Math.min(3, n - 1))] : P[0], b = end ? P[n - 1] : P[Math.min(3, n - 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
      N.forEach(nd => { if (!nd.ins.length || !nd.outs.length) return; let rx = 0, rz = 0; nd.ins.forEach(s => { const h = hd(s, 1); s._h = h; rx += h[0]; rz += h[1]; }); nd.outs.forEach(s => { const h = hd(s, 0); s._h = h; rx += h[0]; rz += h[1]; }); const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
        /* left to right across the road, seen along the way the traffic runs */
        const ins = nd.ins.slice().sort((a, b) => (a._h[0] * -rz + a._h[1] * rx) - (b._h[0] * -rz + b._h[1] * rx)).reverse(), outs = nd.outs.slice().sort((a, b) => (a._h[0] * -rz + a._h[1] * rx) - (b._h[0] * -rz + b._h[1] * rx));
        const TI = ins.reduce((a, s) => a + s.n, 0), TO = outs.reduce((a, s) => a + s.n, 0), T = Math.max(Math.min(TI, TO), Math.max.apply(null, ins.concat(outs).map(s => s.n)));
        const starts = (list, tot) => { let cum = 0; return list.map(s => { const v = tot === s.n ? 0 : Math.round(cum * (T - s.n) / (tot - s.n)); cum += s.n; return v; }); }, si = starts(ins, TI), so = starts(outs, TO);
        /* each piece is drawn over at its end so that its lanes meet the lanes they lead to: a ramp comes in beside the lane it joins, not through the middle of the road */
        ins.forEach((a, i) => { a.e1 = (si[i] + (a.n - 1) / 2 - (T - 1) / 2) * LW; a.b1 = Math.min(a.len * 0.85, Math.max(20, Math.abs(a.e1) * 12)); }); outs.forEach((b, j) => { b.e0 = (so[j] + (b.n - 1) / 2 - (T - 1) / 2) * LW; b.b0 = Math.min(b.len * 0.85, Math.max(20, Math.abs(b.e0) * 12)); });
        ins.forEach((a, i) => outs.forEach((b, j) => { if (a.r === b.r && a.from === b.to && a.to === b.from) return;   /* not back along the same road */
          if (a._h[0] * b._h[0] + a._h[1] * b._h[1] < -0.3) return; if ((a.kind === 'cable') !== (b.kind === 'cable')) return;
          const lo = Math.max(0, so[j] - si[i]), hi = Math.min(a.n - 1, so[j] + b.n - 1 - si[i]); if (lo > hi) return; a.conn.push({ out: b, lo, hi, shift: si[i] - so[j] }); if (!a.outs.includes(b)) a.outs.push(b); if (!b.ins.includes(a)) b.ins.push(a);
          for (let l = lo; l <= hi; l++) { const f = b.feed || (b.feed = []); (f[l + si[i] - so[j]] || (f[l + si[i] - so[j]] = [])).push([a, l]); } })); });
      /* the speed a bend allows is reached by braking gently before it, also from the piece before */
      for (let pass = 0; pass < 3; pass++) for (let q = segs.length - 1; q >= 0; q--) { const s = segs[q], n = s.pts.length; let nxt = 1e9; if (pass) { nxt = 0; s.conn.forEach(c => { nxt = Math.max(nxt, c.out.vc[0]); }); if (!s.conn.length) nxt = 1e9; } if (!s.conn.length && s.kind === 'ramp') nxt = 10; if (nxt < 1e8) s.vc[n - 1] = Math.min(s.vc[n - 1], nxt); for (let i = n - 2; i >= 0; i--) s.vc[i] = Math.min(s.vc[i], Math.sqrt(s.vc[i + 1] * s.vc[i + 1] + 2 * 1.3 * (s.acc[i + 1] - s.acc[i]))); }
      const lp = (s, lane, d, o2) => { const A = s.acc; let i = 0; while (i < A.length - 2 && A[i + 1] < d) i++; const t = clamp((d - A[i]) / (A[i + 1] - A[i] || 1), 0, 1), off = (lane - (s.n - 1) / 2) * LW + F.shiftAt(s, d); o2[0] = s.pts[i][0] + s.nx[i] * off + (s.pts[i + 1][0] + s.nx[i + 1] * off - s.pts[i][0] - s.nx[i] * off) * t; o2[1] = s.pts[i][1] + s.nz[i] * off + (s.pts[i + 1][1] + s.nz[i + 1] * off - s.pts[i][1] - s.nz[i] * off) * t; return o2; }, qa = [0, 0], qb = [0, 0]; F.lanePos = lp;
      segs.forEach(s => { if (s.feed) s.feed.forEach(fd => { if (!fd || fd.length < 2) return; let Z = 8; for (let i = 0; i < fd.length; i++) for (let j = i + 1; j < fd.length; j++) for (let d = 8; d <= 90; d += 6) { const a = fd[i], b = fd[j]; if (d > a[0].len || d > b[0].len) break; lp(a[0], a[1], a[0].len - d, qa); lp(b[0], b[1], b[0].len - d, qb); if (Math.hypot(qa[0] - qb[0], qa[1] - qb[1]) < 2.7) Z = Math.max(Z, d + 6); } fd.Z = Z; }); });
      segs.forEach(s => { s.src = !s.ins.length; s.sink = !s.conn.length; s.x0 = Math.min.apply(null, s.pts.map(p => p[0])); s.x1 = Math.max.apply(null, s.pts.map(p => p[0])); s.z0 = Math.min.apply(null, s.pts.map(p => p[1])); s.z1 = Math.max.apply(null, s.pts.map(p => p[1])); });
      /* cars already on the road stay on it where the new map has the same road under them */
      const old = F.cars; F.segs = segs; F.cars = []; F.laneKm = segs.reduce((a, s) => a + s.len * s.n, 0) / 1000;
      old.forEach(c => { if (c.actor) return; const hit = F.locate(c.x, c.z, c.hx, c.hz, c.dk); if (hit && hit.lat < 1.2 && !c.seg.hide) { c.seg = hit.seg; c.lane = hit.lane; c.s = hit.s; c.i = 0; c.ci = -1; c.lat = 0; hit.seg.L[hit.lane].push(c); F.cars.push(c); } });
      segs.forEach(s => s.L.forEach(a => a.sort((p, q) => p.s - q.s))); F.cars.forEach(c => pose(c));
    };
    /* the lane under a point: { seg, lane, s, lat (how far off the lane's middle) } */
    F.locate = (x, z, hx, hz, dk) => { let best = null, bd = 9; for (const s of F.segs) { if (x < s.x0 - 14 || x > s.x1 + 14 || z < s.z0 - 14 || z > s.z1 + 14) continue; const P = s.pts; for (let i = 1; i < P.length; i++) { const a = P[i - 1], dx = P[i][0] - a[0], dz = P[i][1] - a[1], l2 = dx * dx + dz * dz || 1, u = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1), l = Math.sqrt(l2), px = x - a[0] - dx * u, pz = z - a[1] - dz * u, side = (px * -dz + pz * dx) / l - s.shiftX, d = Math.hypot(px, pz);
          if (d > s.n * LW / 2 + s.shiftX + 1.5) continue; if (hx != null && (hx * dx + hz * dz) / l < 0.3) continue; if (dk != null && Math.abs((s.dk[i - 1] + (s.dk[i] - s.dk[i - 1]) * u) - dk) > 3.5) continue;
          const lf = side / LW + (s.n - 1) / 2, lane = clamp(Math.round(lf), 0, s.n - 1), lat = Math.abs(lf - lane) * LW, sc = lat + (Math.abs(lf - lane) > 0.5 ? 3 : 0); if (sc < bd) { bd = sc; best = { seg: s, lane, s: s.acc[i - 1] + u * l, lat, side: (lf - lane) * LW }; } } } return best; };

    /* ---------- where a car is ---------- */
    function pose(c) { const s = c.seg, A = s.acc; let i = c.i || 0; if (i > A.length - 2) i = A.length - 2; while (i > 0 && A[i] > c.s) i--; while (i < A.length - 2 && A[i + 1] < c.s) i++; c.i = i;
      const t = clamp((c.s - A[i]) / (A[i + 1] - A[i] || 1), 0, 1), off = (c.lane - (s.n - 1) / 2) * LW + F.shiftAt(s, c.s) + c.lat, a = s.pts[i], b = s.pts[i + 1], ax = a[0] + s.nx[i] * off, az = a[1] + s.nz[i] * off, bx = b[0] + s.nx[i + 1] * off, bz = b[1] + s.nz[i + 1] * off;
      let hx = bx - ax, hz = bz - az; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl; if (c.lat) { const sk = clamp(-c.latV / Math.max(c.v, 3), -0.25, 0.25); const rx = -hz, rz = hx; hx += rx * sk; hz += rz * sk; const l2 = Math.hypot(hx, hz); hx /= l2; hz /= l2; }
      c.x = ax + (bx - ax) * t; c.z = az + (bz - az) * t; c.hx = hx; c.hz = hz; c.yaw = Math.atan2(hx, hz); c.dk = s.dk[i] + (s.dk[i + 1] - s.dk[i]) * t; c.vcap = s.vc[i] + (s.vc[i + 1] - s.vc[i]) * t; }
    F.shiftAt = (s, d) => s.shiftX + (s.e0 ? s.e0 * (1 - smoothstep(0, s.b0, d)) : 0) + (s.e1 ? s.e1 * smoothstep(s.len - s.b1, s.len, d) : 0);
    F.pose = pose;
    const TYPE = { car: [4.8, 1.86, A_CAR, TH], truck: [20.4, 2.6, A_TRUCK, 1.8], box: [8.2, 2.5, 0.8, 1.6], bus: [12.2, 2.6, 0.8, 1.6], cable: [8.4, 2.44, 0.6, 2.0] };
    F.TYPE = TYPE;
    function make(s, lane, at, v) { const c = F.pool.pop() || {}, rr = R(), kind = s.kind === 'cable' ? 'cable' : rr < s.truck * s.n / Math.min(2, s.n) && lane >= s.n - 2 && s.kind === 'freeway' ? (R() < 0.62 ? 'truck' : 'box') : rr > 0.992 && s.kind === 'freeway' ? 'bus' : 'car', t = TYPE[kind];
      c.kind = kind; c.len = kind === 'car' && F.carLen ? F.carLen(c, R) : t[0]; if (kind !== 'car') { c.ty = -1; c.wid = t[1]; } c.hl = c.len / 2; c.hw = (c.wid || t[1]) / 2; c.am = t[2] * (0.85 + R() * 0.3); c.th = t[3] * (0.8 + R() * 0.45); c.top = kind === 'car' ? 0.9 + R() * 0.22 : 0.94 + R() * 0.1; c.vmax = kind === 'truck' || kind === 'box' ? 24.6 : 99;
      c.hov = R() < 0.15 || kind === 'bus'; c.seg = s; c.lane = lane; c.s = at; c.v = v; c.a = 0; c.lat = 0; c.latV = 0; c.i = 0; c.ci = -1; c.lc = 1 + R() * 3; c.wait = 0; c.brake = 0; c.actor = false; c.gone = false; c.id = (F._id = (F._id || 0) + 1); c.tint = R(); return c; }
    const route = c => { const s = c.seg, C = s.conn; c.ci = -1; if (!C.length) return; if (C.length === 1) { c.ci = 0; return; } let tot = 0; const w = C.map(k => { const reach = c.lane >= k.lo - 1 && c.lane <= k.hi + 1, exit = k.out.kind === 'ramp' && s.kind !== 'ramp'; let v = k.out.n * (exit ? (c.kind === 'car' ? 0.3 : 0.08) : 1) * (reach ? 1 : 0.02) * (k.out.act ? 1 : 0.3); tot += v; return v; }); let r = R() * tot; for (let i = 0; i < C.length; i++) { r -= w[i]; if (r <= 0) { c.ci = i; return; } } c.ci = 0; };
    /* may this car drive in that lane of that piece? */
    const allowed = (c, s, lane) => lane >= 0 && lane < s.n && !(s.hov && lane === 0 && !c.hov) && !((c.kind === 'truck' || c.kind === 'box') && s.n > 2 && lane < s.n - 2);

    /* ---------- who is ahead, who is behind ---------- */
    const LD = { gap: 1e9, v: 0, wall: false };
    /* the first car in lane `lane` of piece s beyond position at (idx: where to start looking in the lane's list) */
    function lead(c, s, lane, at, idx, hl) { LD.gap = 1e9; LD.v = 0; LD.wall = false; const arr = s.L[lane]; for (let i = idx; i < arr.length; i++) { const o = arr[i]; if (o !== c && o.s > at) { LD.gap = o.s - o.hl - at - hl; LD.v = o.v; break; } }
      const own = LD.gap < 1e8; if (own && s.len - at > 170) return; let dist = s.len - at, cur = s, ln = lane, ci = c.seg === s ? c.ci : -1;
      for (let hop = 0; hop < 7 && dist < 260; hop++) { const C = cur.conn; if (!C.length) { if (own) return; /* the end of what is loaded: the road beyond runs as this piece is meant to */ if (cur.kind === 'ramp') { LD.gap = dist + 14; LD.v = 9; } else { LD.gap = dist + 1000 / cur.k - 4.9; LD.v = cur.vt; } return; }
        let k = ci >= 0 ? C[ci] : null; if (!k || ln < k.lo || ln > k.hi) { k = null; for (const q of C) if (ln >= q.lo && ln <= q.hi && (!k || q.out.n > k.out.n)) k = q; if (ci >= 0 && cur === s) k = C[ci].lo <= ln && ln <= C[ci].hi ? C[ci] : null; }
        if (!k) { if (dist - hl - 1 < LD.gap) { LD.gap = dist - hl - 1; LD.v = 0; LD.wall = true; } return; }   /* this lane does not go where the car is going: it ends here */
        const o2 = k.out, l2 = ln + k.shift, a2 = o2.L[l2];
        /* a lane two roads feed: the other stream's cars nearer the nose come first */
        const fd = o2.feed && o2.feed[l2]; if (fd && fd.length > 1 && dist < 170) for (const f of fd) { if (f[0] === cur) continue; const ar = f[0].L[f[1]]; for (let i = ar.length - 1; i >= 0; i--) { const o = ar[i], dB = f[0].len - o.s; if (dB > dist + 3) break; if (dB < dist - 0.5 || o.id < c.id) { const Z = fd.Z || 30, raw = dist - dB - o.hl - hl; let g = raw + 0.45 * Math.max(0, dB - Z), v = o.v; /* side by side with it short of where the two lanes become one: wait there */ if (raw < 1.5 && dist > Z + hl && dist - Z - hl - 0.5 < g) { g = dist - Z - hl - 0.5; v = 0; } if (g < LD.gap) { LD.gap = g; LD.v = v; } } } }
        if (own) return; if (a2.length) { const o = a2[0], g = dist + o.s - o.hl - hl; if (g < LD.gap) { LD.gap = g; LD.v = o.v; } return; } if (LD.gap < 1e8) return;
        dist += o2.len; cur = o2; ln = l2; ci = -1; } }
    const FL = { gap: 1e9, c: null };
    function follow(s, lane, at, hl) { FL.gap = 1e9; FL.c = null; const arr = s.L[lane]; let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].s < at) lo = m + 1; else hi = m; } FL.idx = lo; if (lo > 0) { const o = arr[lo - 1]; FL.gap = at - hl - o.s - o.hl; FL.c = o; return; }
      if (at < 90) for (const p of s.ins) for (const k of p.conn) { if (k.out !== s) continue; const l0 = lane - k.shift; if (l0 < k.lo || l0 > k.hi) continue; const ar = p.L[l0]; if (ar.length) { const o = ar[ar.length - 1], g = at - hl + (p.len - o.s) - o.hl; if (g < FL.gap) { FL.gap = g; FL.c = o; } } } }

    /* ---------- one step ---------- */
    F.step = (dt, eye) => {
      F.time += dt; const segs = F.segs;
      /* other actors (the user's car) take their place in the lanes for this step */
      const ghosts = []; for (const a of F.actors) { const hit = F.locate(a.x, a.z, null, null, a.dk); if (!hit) continue; const al = (a.hx * (hit.seg.pts[1][0] - hit.seg.pts[0][0]) + a.hz * (hit.seg.pts[1][1] - hit.seg.pts[0][1])); const put = (lane) => { const g = { actor: true, seg: hit.seg, lane, s: hit.s, v: Math.max(0, a.v * (al >= 0 ? 1 : -0.2)), hl: a.hl + 0.4, hw: a.hw, len: a.hl * 2, id: 0, lat: 0, am: 2, th: 1 }; const arr = hit.seg.L[lane]; let i = 0; while (i < arr.length && arr[i].s < g.s) i++; arr.splice(i, 0, g); ghosts.push(g); }; put(hit.lane); if (Math.abs(hit.side) > 0.75) { const l2 = hit.lane + (hit.side > 0 ? 1 : -1); if (l2 >= 0 && l2 < hit.seg.n) put(l2); } }
      for (const s of segs) { if (!s.act) continue; for (let ln = 0; ln < s.n; ln++) { const arr = s.L[ln]; for (let i = arr.length - 1; i >= 0; i--) { const c = arr[i]; if (c.actor) continue; if (c.ci < 0 && s.conn.length) route(c);
            lead(c, s, ln, c.s, i + 1, c.hl); let gap = LD.gap, dv = c.v - LD.v; const wall = LD.wall; let v0 = Math.min(s.lim * c.top, c.vcap || 99, c.vmax) * (s.hov && ln === 0 ? 1.05 : 1); if (c.ci >= 0) { const vn = s.conn[c.ci].out.vc[0]; if (vn < v0) v0 = Math.min(v0, Math.sqrt(vn * vn + 2.6 * (s.len - c.s))); }
            let a = idm(c, v0, gap, dv);
            /* --- a change of lane: because it must, or because it pays --- */
            c.lc -= dt; if (c.lc <= 0 && s.n > 1 && c.kind !== 'cable') { c.lc = 0.5 + R() * 0.4; const k = c.ci >= 0 ? s.conn[c.ci] : null, dEnd = s.len - c.s; let need = 0; if (k) need = ln < k.lo ? 1 : ln > k.hi ? -1 : 0; else if (s.conn.length) need = 0; if (!need && !allowed(c, s, ln)) need = 1;
              const urge = need ? clamp(1.3 - dEnd / (220 + 60 * Math.abs(k ? (need > 0 ? k.lo - ln : ln - k.hi) : 1)), 0.15, 1.3) : 0; let bestG = -1e9, bestD = 0;
              for (const d of [-1, 1]) { const t = ln + d; if (t < 0 || t >= s.n) continue; if (!need && !allowed(c, s, t)) continue; if (need && d !== need) continue; if (!need && k && (t < k.lo || t > k.hi) && dEnd < 400) continue;
                follow(s, t, c.s, c.hl); const fo = FL.c, gF = FL.gap, idx = FL.idx; lead(c, s, t, c.s, idx, c.hl); const gL = LD.gap, aNew = idm(c, v0, gL, c.v - LD.v), safe = need ? -3.2 - 2 * urge : -2.2; if (gL < 1.2 || gF < 1.2 || aNew < safe) continue;
                let aF = 0; if (fo && !fo.actor) { aF = idm(fo, Math.min(fo.seg.lim * fo.top, fo.vmax), gF, fo.v - c.v); if (aF < safe) continue; } else if (fo && gF < 4 + fo.v * 0.6) continue;
                const g = aNew - a + (need ? 0.6 + 3.5 * urge : (d > 0 ? 0.08 : -0.12) - 0.2 * Math.max(0, -aF) - 0.3); if (g > bestG) { bestG = g; bestD = d; } }
              if (bestD && bestG > 0) { arr.splice(i, 1); const t = ln + bestD, ar2 = s.L[t]; let j = 0; while (j < ar2.length && ar2[j].s < c.s) j++; ar2.splice(j, 0, c); c.lane = t; c.lat -= bestD * LW; c.lc = 3.5 + R() * 3; F.events.changes++; lead(c, s, t, c.s, j + 1, c.hl); gap = LD.gap; a = idm(c, v0, gap, c.v - LD.v); c.wait = 0; }
              else if (wall && c.v < 0.4) { c.wait += 0.7; if (c.wait > 5) { /* waited at the end of its lane long enough: it takes the way this lane does go, or squeezes over */ let alt = -1; s.conn.forEach((q, qi) => { if (ln >= q.lo && ln <= q.hi) alt = qi; }); if (alt >= 0) { c.ci = alt; F.events.reroutes++; } else { const d = k && ln < k.lo ? 1 : -1, t = clamp(ln + d, 0, s.n - 1); follow(s, t, c.s, c.hl); if (t !== ln && FL.gap > 0.6) { lead(c, s, t, c.s, FL.idx, c.hl); if (LD.gap > 0.6) { arr.splice(i, 1); s.L[t].splice(FL.idx, 0, c); c.lane = t; c.lat -= d * LW; F.events.forced++; } } } c.wait = 0; } } }
            if (gap < 0.4 && a > 0) a = 0; c.a = a; }
        } }
      /* --- move --- */
      for (const s of segs) for (let ln = 0; ln < s.n; ln++) { const arr = s.L[ln]; for (let i = arr.length - 1; i >= 0; i--) { const c = arr[i]; if (c.actor || c.seg !== s || c.moved === F.time) continue; c.moved = F.time; const v1 = Math.max(0, c.v + c.a * dt); c.s += (c.v + v1) / 2 * dt; c.v = v1; { const o = arr[i + 1]; if (o && o.seg === s && c.s + c.hl > o.s - o.hl - 0.05) { c.s = o.s - o.hl - c.hl - 0.05; c.v = Math.min(c.v, o.v); F.events.held = (F.events.held || 0) + 1; } } c.brake = c.a < -0.7 || (v1 < 0.3) ? 1 : 0;
            if (c.lat) { const st = Math.min(Math.abs(c.lat), (0.9 + c.v * 0.035) * dt); c.latV = -Math.sign(c.lat) * st / dt; c.lat -= Math.sign(c.lat) * st; if (Math.abs(c.lat) < 1e-3) { c.lat = 0; c.latV = 0; } }
            if (c.s >= s.len) { const k = c.ci >= 0 ? s.conn[c.ci] : null; arr.splice(i, 1); if (!k || ln < k.lo || ln > k.hi || !k.out.act) { if (k && k.out.act) { /* could not get over in time: held at the end */ c.s = s.len - 0.01; c.v = 0; arr.push(c); continue; } c.gone = true; F.events.left++; continue; }
              const o = k.out, l2 = ln + k.shift, offA = (ln - (s.n - 1) / 2) * LW + s.shiftX + s.e1, offB = (l2 - (o.n - 1) / 2) * LW + o.shiftX + o.e0; c.s -= s.len; c.seg = o; c.lane = l2; c.lat += offA - offB; c.i = 0; c.ci = -1; const a2 = o.L[l2]; let j = 0; while (j < a2.length && a2[j].s < c.s) j++; a2.splice(j, 0, c); if (j < a2.length - 1 && a2[j + 1].s - a2[j + 1].hl < c.s + c.hl + 0.3) { c.s = Math.max(0, a2[j + 1].s - a2[j + 1].hl - c.hl - 0.3); c.v = Math.min(c.v, a2[j + 1].v); } c.moved = F.time; }
            pose(c); } }
      ghosts.forEach(g => { const arr = g.seg.L[g.lane], i = arr.indexOf(g); if (i >= 0) arr.splice(i, 1); });
      if (F.cars.some(c => c.gone)) { F.cars = F.cars.filter(c => { if (c.gone) F.pool.push(c); return !c.gone; }); }
      /* --- the roads that come in from beyond what is loaded bring cars at the spacing the hour gives --- */
      if (F.cars.length < F.cap) for (const s of segs) { if (!s.act || !s.entry) continue; const sp = 1000 / s.k, ve = Math.min(s.vt, s.kind === 'ramp' ? 13 : 99, s.vc[0]); for (let ln = 0; ln < s.n; ln++) { const arr = s.L[ln], f = arr[0], room = f ? f.s - f.hl : 1e9; if (s.kind === 'ramp') { s.meterT = (s.meterT || 0) - dt / s.n; if (s.meterT > 0 || room < 14) continue; s.meterT = s.meter || Math.max(2.2, sp / Math.max(ve, 3)) * (0.6 + R() * 0.8); } else if (room < sp * (0.8 + 0.5 * R())) continue;
          const c = make(s, ln, 2.6, f ? Math.min(ve, f.v + 2) : ve); if (!allowed(c, s, ln)) { F.pool.push(c); continue; } c.s = c.hl + 0.2; if (room < c.len + 2) { F.pool.push(c); continue; } arr.unshift(c); F.cars.push(c); pose(c); F.events.spawned++; if (F.cars.length >= F.cap) break; } }
    };

    /* ---------- how full each piece should be: set from the hour and the counts, and the fleet laid down to match ---------- */
    /* fn(seg) -> { k (cars per km of lane), v (m/s), truck (share) }; eye: [x, z]; within: only pieces this near carry traffic */
    F.setDemand = (fn, eye, within) => { for (const s of F.segs) { const d = fn(s); s.k = Math.max(0.3, d.k); s.vt = d.v; s.truck = d.truck || 0; s.meter = d.meter || 0; if (s.kind === 'cable') { s.k = 1.6; s.vt = 4.25; }
        const cx = clamp(eye[0], s.x0, s.x1), cz = clamp(eye[1], s.z0, s.z1); s.dEye = Math.hypot(cx - eye[0], cz - eye[1]); }
      /* within the budget of cars: the nearest roads first, as far out as the budget reaches */
      const ord = F.segs.slice().sort((a, b) => a.dEye - b.dEye); let sum = 0, lim = within || 1e9; for (const s of ord) { sum += s.len * s.n * s.k / 1000; if (sum > F.cap * 0.92) { lim = Math.min(lim, Math.max(350, s.dEye)); break; } }
      F.within = lim; for (const s of F.segs) { const was = s.act; s.act = s.dEye <= lim; if (was && !s.act) s.L.forEach(a => { a.forEach(c => { c.gone = true; }); a.length = 0; }); }
      for (const s of F.segs) s.entry = s.act && (!s.ins.length || s.ins.every(p => !p.act));
      F.cars = F.cars.filter(c => { if (c.gone) F.pool.push(c); return !c.gone; }); };
    F.fill = () => { for (const s of F.segs) { if (!s.act || s._filled === F._gen) continue; s._filled = F._gen; if (s.L.some(a => a.length)) continue; const sp = 1000 / s.k; for (let ln = 0; ln < s.n; ln++) { let at = sp * R(); while (at < s.len - 1 && F.cars.length < F.cap) { const c = make(s, ln, at, Math.min(s.vt, s.vc[0]) * (0.92 + R() * 0.12)); if (allowed(c, s, ln)) { s.L[ln].push(c); F.cars.push(c); pose(c); c.v = Math.min(c.v, c.vcap || 99); } else F.pool.push(c); at += sp * (0.7 + R() * 0.6) + (c.len - 4.8); } } } };
    F.clear = () => { F.cars.length = 0; F.segs.forEach(s => { s.L.forEach(a => { a.length = 0; }); s._filled = -1; }); F._gen = (F._gen || 0) + 1; };
    /* how many of the cars' boxes overlap right now (for the tests), and the nearest car whose box meets a given box */
    F.overlaps = ov => { let n = 0; const G = new Map(), kf = (x, z) => Math.floor(x / 24) + ':' + Math.floor(z / 24); F.cars.forEach(c => { const k = kf(c.x, c.z); (G.get(k) || (G.set(k, []), G.get(k))).push(c); });
      F.cars.forEach(c => { const cx = Math.floor(c.x / 24), cz = Math.floor(c.z / 24); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const cell = G.get((cx + i) + ':' + (cz + j)); if (cell) for (const o of cell) if (o.id > c.id && Math.abs(o.dk - c.dk) < 3 && ov(c.x, c.z, c.hx, c.hz, c.hl, c.hw, o.x, o.z, o.hx, o.hz, o.hl, o.hw) > 0.05) n++; } }); return n; };
    return F;
  };
