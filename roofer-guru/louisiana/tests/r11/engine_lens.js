    /* ---------- the roof views: each roof's heat, its wear and the years ahead, laid on the roofs round the camera ---------- */
    /* The module reads the roofs (env.lens). The view cuts each roof near the camera into small triangles, asks the module
       for a reading at every corner, and draws them in the layer that is seen through trees and walls. What the view adds
       is the place: how near a corner is to an eave, a roof corner or a ridge (where wind pulls hardest), what shades it at
       this hour (tree crowns and the buildings round it), whether a crown hangs over it, and how light the roof shows in
       the photograph. */
    const LV = env.lens || null, LROWS = LV ? LV.pal.length : 1, LNEAR = []; let palT = null, lensT = 0, lensKey = '', lensKind = '', lensGen = 1, lensLeft = 0, lensPrev = 0; S.year = 5;
    function lensPal() { if (palT) return palT; const c = K.cvs(256, LROWS), g = c.getContext('2d'); (LV ? LV.pal : [['#000000', '#ffffff']]).forEach((stops, r) => { const gr = g.createLinearGradient(0, 0, 256, 0); stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s)); g.fillStyle = gr; g.fillRect(0, r, 256, 1); }); palT = dev.imageTexture(c, { srgb: false, mips: false, wrap: 'clamp', aniso: 0, name: 'roof view colours' }); return palT; }
    XR.o.sets = () => ({ u_pal: lensPal(), u_rows: LROWS });
    const lensCap = () => ({ ultra: 170, high: 130, medium: 90, low: 45 }[engine.quality] || 90);
    function lensClear() { XM.forEach(m => { if (m.item) XR.remove(m.item); if (m.mesh) m.mesh.dispose(); }); XM.clear(); }
    const DAYS = { today: null, summer: [6, 21, 'July 21'], fall: [9, 21, 'October 21'], winter: [0, 21, 'January 21'], spring: [3, 21, 'April 21'] }, WLAB = { clear: 'clear sky', cloudy: 'broken cloud', overcast: 'overcast', rain: 'rain', haze: 'haze' };
    function lensCtx() { const ll = toLL(S.x, S.z), sol = LV.solar(S.sunTime || new Date(), ll[1]), sd = scene.env.sunDir; return { year: S.year, weather: gfx.weather, month: sol.month, hour: sol.hour, sunAlt: S.sunAlt, sun: { alt: S.sunAlt, dir: [sd[0], sd[1], sd[2]] }, dayLabel: DAYS[gfx.day] ? DAYS[gfx.day][2] : 'Today', weatherLabel: WLAB[gfx.weather] || gfx.weather }; }
    const segD = (x, z, A, B2) => { const dx = B2[0] - A[0], dz = B2[1] - A[1], L2 = dx * dx + dz * dz, t = L2 ? clamp(((x - A[0]) * dx + (z - A[1]) * dz) / L2, 0, 1) : 0; return Math.hypot(x - A[0] - t * dx, z - A[1] - t * dz); };
    /* a roof cut small: triangles with, at each corner, its zones and whether a crown hangs over it; the trees near enough to shade it */
    function lensGeom(b) {
      const RP = K.roofPlanes(b); if (!RP || !RP.planes.length) return null;
      const maxE = clamp(Math.sqrt(RP.area) / 7, 1.5, 7), cap = 900, tris = [], mid = (a, c) => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], d3 = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
      const sub = (a, c, d, n, depth) => { const l = Math.max(d3(a, c), d3(c, d), d3(d, a)); if (l <= maxE || depth >= 5 || tris.length > cap) { tris.push({ p: [a, c, d], n }); return; } const ab = mid(a, c), bc = mid(c, d), ca = mid(d, a); sub(a, ab, ca, n, depth + 1); sub(ab, c, bc, n, depth + 1); sub(ca, bc, d, n, depth + 1); sub(ab, bc, ca, n, depth + 1); };
      RP.planes.forEach(pl => pl.tris.forEach(t => sub(t[0], t[1], t[2], pl.n, 0)));
      const trees = [], bb = RP.bb, cells = [], treeRefs = [], ca = cellOf(bb[0] - 30, bb[1] - 30), cb = cellOf(bb[2] + 30, bb[3] + 30);
      /* every cell within 30 m, there yet or not: its crowns, or that it has none yet, are what this roof was cut with */
      for (let cx = Math.min(ca[0], cb[0]); cx <= Math.max(ca[0], cb[0]); cx++) for (let cy = Math.min(ca[1], cb[1]); cy <= Math.max(ca[1], cb[1]); cy++) { const key = cx + '/' + cy, c = CELLS.get(key); cells.push(key); treeRefs.push((c && c.trees) || null); if (!c || !c.trees || !c.trees.list) continue; for (const t of c.trees.list) if (t.x > bb[0] - 28 && t.x < bb[2] + 28 && t.z > bb[1] - 28 && t.z < bb[3] + 28) trees.push(t); }
      const zoneAt = (x, z) => { let dE = 1e9, dC = 1e9, dR = 1e9, hip = false; for (const rg of RP.rings) { const P = rg.P, n = P.length; for (let i = 0; i < n; i++) { const A = P[i], B2 = P[(i + 1) % n]; dE = Math.min(dE, segD(x, z, A, B2)); dC = Math.min(dC, Math.hypot(x - A[0], z - A[1])); if (rg.Q && rg.Q.length === n) { hip = true; dR = Math.min(dR, segD(x, z, rg.Q[i], rg.Q[(i + 1) % n]), segD(x, z, A, rg.Q[i])); } } } const a = RP.a; return { edge: clamp(1 - dE / a, 0, 1), corner: clamp(1 - dC / (a * 1.2), 0, 1), ridge: hip ? clamp(1 - dR / (a * 0.6), 0, 1) : 0 }; };
      let un = 0, vn = 0; tris.forEach(t => { t.zone = t.p.map(p => zoneAt(p[0], p[2])); t.under = t.p.map(p => { let u = 0; for (const tr of trees) if (tr.h > p[1] + 0.5 && Math.hypot(p[0] - tr.x, p[2] - tr.z) < tr.r * 0.95) { u = 1; break; } un += u; vn++; return u; }); });
      return { tris, planes: RP.planes.map(p => ({ n: p.n, area: p.area })), rings: RP.rings.map(r => r.P), bb, cx: (bb[0] + bb[2]) / 2, cz: (bb[1] + bb[3]) / 2, trees, cells, treeRefs, canopy: vn ? un / vn : 0, sig: String(Math.round(env.height(b) * 4)) };
    }
    /* the trees round a roof are the ones it was cut with: the same cells, each with the same crowns */
    const treesSame = G => { for (let i = 0; i < G.cells.length; i++) { const c = CELLS.get(G.cells[i]); if (((c && c.trees) || null) !== G.treeRefs[i]) return false; } return true; };
    /* the picture under a roof has all arrived */
    const lumReady = G => { const [cX, cY] = cellOf(G.cx, G.cz), c = CELLS.get(cX + '/' + cY); return !!(c && c.img && c.img.ok >= 4); };
    /* a roof read with what was there then is read again when more is: its crowns grown or gone, its picture arrived, or the dashboard has read the building again (a permit or a parcel joined: its mix is a new list) */
    const lensStale = (id, m) => { const b = env.byId(id); if (!b) return false; if (m.mix !== b.mix) return true; const G = m.G; if (!G) return false; if (!G.lumDone && lumReady(G)) return true; return !treesSame(G); };
    /* how light the roof shows in the photograph (0 to 1 as displayed): the cell's picture under the footprint, once all of it has arrived */
    function roofLum(G) {
      const [cX, cY] = cellOf(G.cx, G.cz), c = CELLS.get(cX + '/' + cY); if (!c || !c.img || c.img.ok < 4) return null;
      const r = c.rect, N = c.img.c.width, px = x => (x - r.x0) / (r.x1 - r.x0) * N, pz = z => (z - r.zN) / (r.zS - r.zN) * N;
      const x0 = clamp(Math.floor(px(G.bb[0])), 0, N - 2), x1 = clamp(Math.ceil(px(G.bb[2])), x0 + 1, N), y0 = clamp(Math.floor(pz(G.bb[1])), 0, N - 2), y1 = clamp(Math.ceil(pz(G.bb[3])), y0 + 1, N), w = x1 - x0, h = y1 - y0; if (w < 2 || h < 2) return null;
      let data; try { data = c.img.g.getImageData(x0, y0, w, h).data; } catch (e) { return null; }
      let s = 0, n = 0; const step = Math.max(1, Math.floor(Math.min(w, h) / 16));
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) { const X = r.x0 + (x0 + x + 0.5) / N * (r.x1 - r.x0), Zc = r.zN + (y0 + y + 0.5) / N * (r.zS - r.zN); if (!G.rings.some(P => Poly.contains(P, X, Zc))) continue; const i = (y * w + x) * 4; s += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255; n++; }
      return n >= 4 ? s / n : null;
    }
    /* the share of the direct sun a corner loses at this hour: 0.8 through a tree's crown, all of it behind another building */
    const shadeAt = (p, n, sd, G, self) => {
      if (n[0] * sd[0] + n[1] * sd[1] + n[2] * sd[2] <= 0.02) return 0;
      const ox = p[0] + n[0] * 0.2, oy = p[1] + n[1] * 0.2, oz = p[2] + n[2] * 0.2;
      for (const q of [1.5, 3, 5, 8, 12, 17, 24, 33, 45, 60]) { const x = ox + sd[0] * q, y = oy + sd[1] * q, z = oz + sd[2] * q; if (y > 70) break; for (const pr of phys.prismsIn(x, z, x, z, LNEAR)) { if (pr.userData && pr.userData.id === self) continue; if (y < pr.y1 && Poly.contains(pr.ring, x, z)) return 1; } }
      for (const t of G.trees) { const ky = t.r / Math.max(0.34 * t.h, 0.5), cx = t.x - ox, cy = (0.66 * t.h - oy) * ky, cz = t.z - oz, dy = sd[1] * ky, dl = Math.hypot(sd[0], dy, sd[2]) || 1, tca = (cx * sd[0] + cy * dy + cz * sd[2]) / dl; if (tca < 0) continue; if (cx * cx + cy * cy + cz * cz - tca * tca < t.r * t.r * 0.81) return 0.8; }
      return 0;
    };
    function lensBuild(id, old) {
      const b = env.byId(id); if (!b) return null; let G = old && old.G; if (G && (G.sig !== String(Math.round(env.height(b) * 4)) || !treesSame(G))) { const lum = G.lum, done = G.lumDone; G = null; try { G = lensGeom(b); } catch (e) { G = null; } if (G) { G.lum = lum; G.lumDone = done; } }
      else if (!G) { try { G = lensGeom(b); } catch (e) { G = null; } } if (!G) return { G: null, mesh: null, item: null, R: null, gen: lensGen, mix: b.mix };
      if (!G.lumDone && lumReady(G)) { G.lum = roofLum(G); G.lumDone = true; }
      const ctx = lensCtx(); ctx.lum = G.lum; ctx.canopy = G.canopy; ctx.trees = G.trees.length;
      let R = null; try { R = LV.begin(gfx.lens, b, ctx); if (R) { R.setPlanes(G.planes); R = LV.ready(R) || null; } } catch (e) { R = null; }
      if (!R || !R.vertex) return { G, mesh: null, item: null, R: null, gen: lensGen, mix: b.mix };
      const thermal = gfx.lens === 'thermal', sd = scene.env.sunDir, sunUp = S.sunAlt > 0.5, Bd = new MeshBuilder({ aux: true });
      for (const t of G.tris) { const v = [0, 1, 2].map(i => R.vertex(t.n, t.zone[i], thermal && sunUp ? shadeAt(t.p[i], t.n, sd, G, id) : 0, t.under[i])); let top = v[0]; if (v[1][0] > top[0]) top = v[1]; if (v[2][0] > top[0]) top = v[2];
        Bd.tri(t.p[0], t.p[1], t.p[2], t.n, null, null, null, null, [v[0][0], v[0][1], top[2], top[3]], [v[1][0], v[1][1], top[2], top[3]], [v[2][0], v[2][1], top[2], top[3]]); }
      const mesh = Bd.empty ? null : Bd.build(dev, { name: 'roof view ' + id });
      return { G, mesh, item: mesh ? XR.add(mesh) : null, R, gen: lensGen, mix: b.mix };
    }
    function lensSync(force) {
      const on = !!LV && gfx.lens !== 'off'; XR.on = on; if (!on) { if (XM.size) lensClear(); lensLeft = 0; return; } const now = performance.now(), frame = lensPrev ? now - lensPrev : 16; lensPrev = now; if (!force && now - lensT < (lensLeft > 0 ? 34 : 180)) { if (lensLeft > 0) need(1); return; } lensT = now;   /* while roofs wait, the frames keep coming: a still scene is drawn only on demand */
      /* another view: the old one's paint comes off at once. A new hour, sky or year makes every roof be read again, the old picture standing until the new one is ready */
      if (gfx.lens !== lensKind) { lensKind = gfx.lens; lensClear(); }
      const key = gfx.lens + '|' + (gfx.lens === 'thermal' ? Math.round((S.sunTime ? S.sunTime.getTime() : 0) / 3e5) + gfx.weather : gfx.lens === 'time' ? S.year : ''); if (key !== lensKey) { lensKey = key; lensGen++; }
      const fx = S.mode === 'orbit' ? S.orbit.at[0] : S.x, fz = S.mode === 'orbit' ? S.orbit.at[2] : S.z, R0 = S.mode === 'bird' || S.mode === 'metro' ? 380 : S.mode === 'street' || S.mode === 'walk' ? 200 : 290, list = [];
      CELLS.forEach(c => { if (!c.built || Math.hypot(c.cx - fx, c.cz - fz) > R0 + 100) return; for (const l of c.labels) { const d = Math.hypot(l.x - fx, l.z - fz); if (d < R0 || l.id === S.cur) list.push([l.id, l.id === S.cur ? -1 : d]); } });
      list.sort((a, b) => a[1] - b[1]); const order = list.slice(0, lensCap()).map(a => a[0]), keep = new Set(order), t0 = performance.now(), ms8 = lensLeft > 0 ? clamp(frame * 0.25, 7, 60) : 11, cap8 = ms8 > 20 ? 40 : gfx.lens === 'thermal' ? 8 : 16; let made = 0, left = 0;   /* a few milliseconds a pass, every other frame while roofs wait; on a machine whose frames are slow, a quarter of a frame's time, so the roofs do not wait on the picture */
      for (const id of order) { const m = XM.get(id); if (m && m.gen === lensGen && !lensStale(id, m)) continue; if (made >= cap8 || performance.now() - t0 > ms8) { left++; continue; } let nm = null; try { nm = lensBuild(id, m); } catch (e) { nm = null; } if (m) { if (m.item) XR.remove(m.item); if (m.mesh) m.mesh.dispose(); } const b0 = env.byId(id); XM.set(id, nm || { G: null, mesh: null, item: null, R: null, gen: lensGen, mix: b0 ? b0.mix : undefined }); made++; }   /* a roof that could not be read is left alone until the view or its building changes */
      XM.forEach((m, id) => { if (!keep.has(id)) { if (m.item) XR.remove(m.item); if (m.mesh) m.mesh.dispose(); XM.delete(id); } }); lensLeft = left; if (made || left) need(2);
    }
    const lensOf = id => { const m = id != null ? XM.get(id) : null; return m && m.R && m.gen === lensGen ? m.R : null; };
    let legT = 0;
    function drawLegend() {
      const on = !!LV && gfx.lens !== 'off'; if (legEl.hidden !== !on) legEl.hidden = !on; if (!on) return; const now = performance.now(); if (now - legT < 300) return; legT = now;
      let h = ''; try { h = LV.legend(gfx.lens, lensOf(S.cur), lensCtx()); } catch (e) { h = ''; }
      if (legEl._h !== h) { legEl.innerHTML = h; legEl._h = h; }
    }
