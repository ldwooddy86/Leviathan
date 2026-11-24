    /* ---------- the M3: a car to drive (SE.M3Kit), mode 'm3' ----------
       What the world gives the car: the height of the ground under each wheel (S.gy where the terrain is there, plus
       the thickness of the road it stands on), the grip of the surface (less in the wet, less off the road), and
       walls (the buildings of the detailed cells, lamp posts and tree trunks, and the traffic through
       S.trafficHit). What the car gives the world: its place, as the camera's (so the streets, the cells and the
       origin follow it), and S.hero for the traffic.
       S.hero = { x, z, yaw, speed, len, wid, on } is the one thing the traffic reads: x, z in local metres (the
       middle of the car), yaw in degrees clockwise from north, speed in m/s along its heading (negative backing
       up), len 4.8 and wid 1.9 metres, on true while somebody is driving it (false: parked). It is null when no car
       is out. S.trafficHit(x, z, yaw), if the traffic provides it, is asked once a frame with the same x, z, yaw and
       answers null or { nx, nz, depth } (a unit push in plan away from the car it struck, and how far), optionally
       with x, z of the car struck. */
    const CARW = { segs: [], poles: [], at: null, ver: -1, pr: [], hitN: 0, tHit: null, snap: false, loading: false, loadT: 0, script: null, drive: false, padWas: [], els: null, hudT: 0, lastNote: '' };
    const carLand = (x, z) => (S.gy ? +S.gy(x, z) || 0 : 0);
    /* a road's half width and the height of its surface over the land (the traffic job may give a road its own; else by kind) */
    const carRoadSpec = r => { const k = K.ROADW[r.kind] || K.ROADW.street, own = r.kind === 'freeway' || r.kind === 'ramp'; return [own && r.ln ? r.ln * 3.66 / 2 + 1.2 : (r.width || k[0]) / 2, k[1]]; };
    /* the road pieces, lamp posts and tree trunks near the car, gathered again every dozen metres */
    function carNear(x, z, sp) {
      const reach = 45 + sp * 0.6; if (CARW.at && CARW.ver === S.roadsVer && Math.hypot(x - CARW.at[0], z - CARW.at[1]) < 12 && reach <= CARW.at[2]) return;
      CARW.at = [x, z, reach + 20]; CARW.ver = S.roadsVer; const segs = CARW.segs = [], poles = CARW.poles = [], R2 = reach + 20;
      for (const r of S.roads) { if (r.kind === 'path' || r.kind === 'cable') continue; const sp2 = carRoadSpec(r), P = r.pts; for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1]; if (Math.min(a[0], b[0]) > x + R2 || Math.max(a[0], b[0]) < x - R2 || Math.min(a[1], b[1]) > z + R2 || Math.max(a[1], b[1]) < z - R2) continue; segs.push([a[0], a[1], b[0] - a[0], b[1] - a[1], sp2[0], sp2[1], r, r.dk ? +r.dk[i] || 0 : 0, r.dk ? +r.dk[i + 1] || 0 : 0]); } }
      /* a post or a trunk that the generated street furniture stood on a carriageway (it happens at junctions) is not solid */
      const clear = (px, pz) => { for (const s of segs) { const l2 = s[2] * s[2] + s[3] * s[3], t = l2 ? clamp(((px - s[0]) * s[2] + (pz - s[1]) * s[3]) / l2, 0, 1) : 0; if (Math.hypot(px - s[0] - s[2] * t, pz - s[1] - s[3] * t) <= s[4] + 0.3) return false; } return true; };
      for (const s of LAMP.spots) if (Math.abs(s[0] - x) < R2 && Math.abs(s[1] - z) < R2 && clear(s[0], s[1])) poles.push([s[0], s[1], 0.1]);
      CELLS.forEach(c => { if (!c.trees || !c.trees.list || Math.hypot(c.cx - x, c.cz - z) > R2 + 140) return; for (const t of c.trees.list) if (Math.abs(t.x - x) < R2 && Math.abs(t.z - z) < R2 && clear(t.x, t.z)) poles.push([t.x, t.z, clamp((t.r || 2) * 0.09, 0.12, 0.4)]); });
    }
    /* the road under a point: null off the road, else [height of its surface over the land, the road] */
    /* where roads cross on bridges (the traffic's decks, r.dk) the one nearest the height the car is at is the one it is on */
    function carRoadAt(x, z) { let best = null, bd = 1e9; const cur = CARW.lift || 0; for (const s of CARW.segs) { const l2 = s[2] * s[2] + s[3] * s[3], t = l2 ? clamp(((x - s[0]) * s[2] + (z - s[1]) * s[3]) / l2, 0, 1) : 0, d = Math.hypot(x - s[0] - s[2] * t, z - s[1] - s[3] * t); if (d > s[4]) continue; const lift = s[5] + s[7] + (s[8] - s[7]) * t, e = Math.abs(lift - cur); if (e < bd) { bd = e; best = [lift, s[6]]; } } return best; }
    const carGround = (x, z) => { const r = carRoadAt(x, z); return carLand(x, z) + (r ? r[0] : 0); };
    /* walls: a circle swept from (x0, z0) to (x1, z1). The answer pushes the circle's END place out of what it struck. */
    function carHit(x0, z0, x1, z1, r) {
      const idx = CARW.hitN++ % 3, dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(len / (r * 0.5))), cy = CAR ? CAR.state.y : 0;
      const T = CARW.tHit; if (T && CARW.hitN <= 3 && idx === T.at) { CARW.tHit = null; CARW.what = 'traffic'; return { nx: T.nx, nz: T.nz, depth: T.depth }; }
      const prisms = phys.prismsIn(Math.min(x0, x1) - r, Math.min(z0, z1) - r, Math.max(x0, x1) + r, Math.max(z0, z1) + r, CARW.pr);
      if (prisms.length) for (let i = len < 1e-4 ? n : 1; i <= n; i++) { const t = i / n, x = x0 + dx * t, z = z0 + dz * t; for (const p of prisms) { if (p.y1 < cy + 0.3 || p.y0 > cy + 1.5) continue; const h = phys._prismSide(p, x, z, r); if (h) { CARW.what = 'a building'; return { nx: h[0], nz: h[1], depth: Math.max(0.002, h[2] + (x - x1) * h[0] + (z - z1) * h[1]) }; } } }
      for (const q of CARW.poles) { const rr = r + q[2]; if (Math.min(x0, x1) - rr > q[0] || Math.max(x0, x1) + rr < q[0] || Math.min(z0, z1) - rr > q[1] || Math.max(z0, z1) + rr < q[1]) continue;
        const l2 = len * len, t = l2 > 1e-8 ? clamp(((q[0] - x0) * dx + (q[1] - z0) * dz) / l2, 0, 1) : 1, cx = x0 + dx * t, cz = z0 + dz * t, d = Math.hypot(cx - q[0], cz - q[1]); if (d >= rr) continue;
        let nx = (cx - q[0]) / (d || 1), nz = (cz - q[1]) / (d || 1); if (d < 1e-4 && len > 1e-4) { nx = -dx / len; nz = -dz / len; } CARW.what = q[2] > 0.11 ? 'a tree' : 'a lamp post'; return { nx, nz, depth: Math.max(0.002, rr - d + (cx - x1) * nx + (cz - z1) * nz) }; }
      return null;
    }
    /* the nearest lane a car may stand in: its middle, and the way it runs (the side of the road traffic keeps to, turned the way the camera looks) */
    function carLane(x, z, yaw, maxD) {
      const list = S.roads.filter(r => r.kind !== 'path' && r.kind !== 'drive' && r.kind !== 'cable' && r.pts.length > 1), o = nearestOnRoads(x, z, maxD || 120, list); if (!o) return null;
      const r = list[o.ri], a = r.pts[o.si], b = r.pts[o.si + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, y = Rd(yaw), one = r.ow || r.oneway === true || r.oneway === 1 || r.oneway === 'yes' ? 1 : r.oneway === -1 ? -1 : 0, dk = r.dk ? (+r.dk[o.si] || 0) + ((+r.dk[o.si + 1] || 0) - (+r.dk[o.si] || 0)) * o.t : 0;
      const dir = one || ((dx * Math.sin(y) - dz * Math.cos(y)) >= 0 ? 1 : -1), hx = dx / l * dir, hz = dz / l * dir, hw = carRoadSpec(r)[0], off = one ? 0 : Math.min(hw * 0.5, Math.max(1.6, hw - 1.9));
      /* the street map and the footprints do not always agree: where a wall stands in the lane the car is put nearer the middle, or over it */
      const free = q => { for (const d of [1.45, 0, -1.45]) { const x = o.x - hz * q + hx * d, z = o.z + hx * q + hz * d; for (const p of phys.prismsIn(x - 1.3, z - 1.3, x + 1.3, z + 1.3, CARW.pr)) if (p.y1 > 0.5 && phys._prismSide(p, x, z, 1.25)) return false; } return true; };
      let use = off; for (const q of [off, off * 0.5, 0, -off * 0.5, -off]) if (free(q)) { use = q; break; }
      return { x: o.x - hz * use, z: o.z + hx * use, yaw: (DEG * Math.atan2(hx, -hz) + 360) % 360, road: r, lift: carRoadSpec(r)[1] + dk };
    }
    function carMake() { if (!CAR) { CAR = SE.M3Kit(engine); R.warm && R.warm(Object.values(CAR.materials)); } return CAR; }
    /* take the car out: where it stands if it is near, else on the nearest lane to the camera */
    function carEnter(yaw, fresh) {
      carMake(); const near = !fresh && CAR.out && Math.hypot(CAR.state.x - S.x, CAR.state.z - S.z) < 60;
      if (!near) { const L = carLane(S.x, S.z, yaw != null ? yaw : S.yaw, 140); CARW.at = null; if (L) { CARW.lift = L.lift; carNear(L.x, L.z, 0); CAR.place(L.x, L.z, L.yaw, carGround(L.x, L.z)); CARW.snap = false; } else { CAR.place(S.x, S.z, yaw != null ? yaw : S.yaw, carLand(S.x, S.z)); CARW.snap = true; } }
      CAR.show(true); CARW.drive = true; CARW.script = null; S.cchase.yaw = 0; S.cchase.oyaw = (CAR.state.yaw + 150) % 360; if (S.cchase.pitch < -60) S.cchase.pitch = -9; S.x = CAR.state.x; S.z = CAR.state.z; S.on = null; S.fov = 65; engine.playing = true; engine.wake(); carHero(); need(3);
    }
    /* leave it where it is: it brakes to rest by itself and stays there, solid for the traffic */
    function carLeave() { CARW.drive = false; CARW.script = null; if (CAR) { CAR.cabin(false); CAR.quiet(); const I = CAR.input; I.throttle = I.brake = I.steer = I.handbrake = 0; } if (S.fast) { S.fast = false; ensureAt = null; } }
    function carHero() { if (!CAR || !CAR.out) { S.hero = null; return; } const a = CAR.state, h = S.hero || (S.hero = { x: 0, z: 0, yaw: 0, speed: 0, len: 4.8, wid: 1.9, on: true }); h.x = a.x; h.z = a.z; h.yaw = a.yaw; h.speed = a.forward; h.len = 4.8; h.wid = 1.9; h.on = true; h.driving = CARW.drive; h.y = a.y; }
    function carEnv() {
      const a = CAR.state, wet = clamp(scene.env.wetness || 0, 0, 1), sn = SE.STORM[S.storm] || {}, heavy = SK.now && SK.now.rain ? clamp(SK.now.rain, 0, 1) : 0, road = carRoadAt(a.x, a.z);
      let grip = sn.grip != null ? +sn.grip : clamp(1 - 0.4 * wet - 0.12 * heavy * heavy, 0.35, 1); if (!road) grip *= 0.62;
      CARW.lift = road ? road[0] : 0; return { ground: carGround, grip, hit: carHit, night: smoothstep(2, -6, S.sunAlt), wet, onRoad: !!road, road: road ? road[1] : null, live: CARW.drive };
    }
    /* what the driver asks for: keys while the view has the focus, the on-screen pad (S.keys), a game pad, or a script (en.car.drive) */
    function carInput() {
      const k = S.keys, I = engine.input, foc = document.activeElement === cv, A = CAR.input, sc = CARW.script; if (sc) { A.throttle = +sc.throttle || 0; A.brake = +sc.brake || 0; A.steer = +sc.steer || 0; A.handbrake = +sc.handbrake || 0; if (sc.reverse != null) A.reverse = !!sc.reverse; return true; }
      let thr = (k.fwd ? 1 : 0) + (foc && (I.key('KeyW') || I.key('ArrowUp')) ? 1 : 0), brk = (k.back ? 1 : 0) + (foc && (I.key('KeyS') || I.key('ArrowDown')) ? 1 : 0), steer = (k.right ? 1 : 0) - (k.left ? 1 : 0) + (foc ? I.axis('KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight') : 0), hb = (k.down ? 1 : 0) + (foc && I.key('Space') ? 1 : 0);
      const g = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
      if (g) { const b = g.buttons, v = i => (b[i] ? (b[i].value != null ? b[i].value : b[i].pressed ? 1 : 0) : 0), dz = x => (Math.abs(x) < 0.12 ? 0 : (x - Math.sign(x) * 0.12) / 0.88), was = CARW.padWas, hit = i => { const on = !!(b[i] && b[i].pressed), w = was[i]; was[i] = on; return on && !w; };
        thr += v(7); brk += v(6); steer += dz(g.axes[0] || 0); hb += v(0); const rx = dz(g.axes[2] || 0), ry = dz(g.axes[3] || 0); if (rx || ry) { S.cchase.yaw = clamp(S.cchase.yaw + rx * 2.2, -180, 180); S.cchase.pitch = clamp(S.cchase.pitch + ry * 1.2, -80, 12); }
        if (hit(3)) carKey('KeyC'); if (hit(2)) carKey('KeyT'); if (hit(1)) carKey('KeyR'); }
      A.throttle = clamp(thr, 0, 1); A.brake = clamp(brk, 0, 1); A.steer = clamp(steer, -1, 1); A.handbrake = clamp(hb, 0, 1); return thr > 0 || brk > 0 || steer !== 0 || hb > 0;
    }
    /* the streets ahead of a fast car: asked for round a point some seconds ahead, one answer at a time */
    function carRoads() {
      const a = CAR.state, sp = a.speed; if (sp < 28 || CARW.loading || !S.roadsAt) return; const now = performance.now(); if (now - CARW.loadT < 1500) return;
      const lead = clamp(sp * 3.6, 0, 420), tx = a.x + a.vx / sp * lead, tz = a.z + a.vz / sp * lead; if (Math.hypot(tx - S.roadsAt[0], tz - S.roadsAt[1]) < (sp > 60 ? 330 : 240)) return;
      CARW.loading = true; CARW.loadT = now; const kx = S.x, kz = S.z; let p = null; S.x = tx; S.z = tz; try { p = loadRoads(); } finally { S.x = kx; S.z = kz; } const done = () => { CARW.loading = false; }; Promise.resolve(p).then(done, done);
    }
    /* one step of the car while it is being driven */
    function carStep(dt) {
      if (!CAR) return false; const a = CAR.state, px = a.x, pz = a.z;
      if (CARW.snap && S.roads.length) { const L = carLane(a.x, a.z, a.yaw, 140); if (L && a.atRest) { CARW.lift = L.lift; CARW.at = null; carNear(L.x, L.z, 0); CAR.place(L.x, L.z, L.yaw, carGround(L.x, L.z)); } CARW.snap = false; }
      const asked = carInput(); carNear(a.x, a.z, a.speed);
      CARW.hitN = 0; CARW.tHit = null; if (S.trafficHit) { let t = null; try { t = S.trafficHit(a.x, a.z, a.yaw); } catch (e) { t = null; } if (t && t.nx == null && isFinite(t.x) && isFinite(t.z)) { const y = Rd(a.yaw), fx = Math.sin(y), fz = -Math.cos(y), ex = a.x - t.x, ez = a.z - t.z, d = Math.hypot(ex, ez) || 1, nx = ex / d, nz = ez / d, ohx = t.hx != null ? t.hx : 0, ohz = t.hz != null ? t.hz : 1, eo = Math.abs(nx * ohx + nz * ohz) * (t.hl || 2.4) + Math.abs(-nx * ohz + nz * ohx) * (t.hw || 0.95), eh = Math.abs(nx * fx + nz * fz) * 2.4 + Math.abs(-nx * fz + nz * fx) * 0.95; t = { nx, nz, depth: clamp(eo + eh - d, 0.03, 1.5), x: t.x, z: t.z }; }
      if (t && isFinite(t.nx) && isFinite(t.nz) && t.depth > 0) { let at = 1; if (isFinite(t.x) && isFinite(t.z)) { const y = Rd(a.yaw), along = (t.x - a.x) * Math.sin(y) - (t.z - a.z) * Math.cos(y); at = along > 0.8 ? 0 : along < -0.8 ? 2 : 1; } CARW.tHit = { nx: +t.nx, nz: +t.nz, depth: Math.min(+t.depth, 3), at }; } }
      const moving = engine.playing ? CAR.update(dt, carEnv()) : false; S.x = a.x; S.z = a.z;
      const was = S.fast; S.fast = was ? a.speed > 45 : a.speed > 60; if (was && !S.fast) { plan(); ensureAt = null; }
      carRoads(); carHero(); { const d = Math.hypot(a.x - px, a.z - pz); if (moving || d > 1e-4) after(d < 0.02); }
      if (moving || asked) { engine.wake(); need(); }
      return moving;
    }
    /* every frame the car is out but nobody is in it: it comes to rest, and the traffic is told where it is */
    function carIdle(dt) { if (!CAR || !CAR.out || S.mode === 'm3') return; const a = CAR.state; if (!a.atRest && engine.playing) { carNear(a.x, a.z, a.speed); CARW.hitN = 0; CARW.tHit = null; CAR.update(dt, carEnv()); need(); } carHero(); }
    function carCamera(t) {
      const a = CAR.state, kind = S.carCam; S.x = a.x; S.z = a.z; CAR.cabin(kind === 'cockpit');
      const v = CAR.view(kind, kind === 'orbit' ? { yaw: S.cchase.oyaw, pitch: S.cchase.pitch, dist: S.cchase.dist * 1.2 } : kind === 'chase' ? S.cchase : { yaw: S.cchase.yaw, pitch: S.cchase.pitch + 9, dist: 0 }, carGround);
      if (kind === 'chase' || kind === 'orbit') {   /* a building between the car and the camera: the camera comes in to this side of it */
        const o = [a.x, a.y + 1.25, a.z], dx = v.pos[0] - o[0], dy = v.pos[1] - o[1], dz = v.pos[2] - o[2], d = Math.hypot(dx, dy, dz) || 1, h = phys.raycast(o, [dx / d, dy / d, dz / d], d + 0.5);
        if (h && h.prism && h.t < d + 0.5) { const k = Math.min(1, Math.max(2.6, h.t - 0.6) / d); v.pos = [o[0] + dx * k, o[1] + dy * k + (1 - k) * 1.1, o[2] + dz * k]; v.near = 0.2; } }
      S.yaw = ((v.yaw % 360) + 360) % 360; S.pitch = v.pitch; t.setPosition(v.pos[0], v.pos[1], v.pos[2]); Q.fromEuler(t.rotation, Rd(v.pitch), -Rd(v.yaw), Rd(v.roll || 0)); t.dirty(); cam.fov = v.fov; cam.near = v.near;
      const sd = (QUALITY[engine.quality] || QUALITY.high).shadowDistance * (a.speed > 60 ? 1.5 : 1); if (R.settings.shadowDistance !== sd) R.settings.shadowDistance = sd;
    }
    const CAR_KEYS = 'W or ↑ throttle · S or ↓ brake, held at rest it backs up · A D or ← → steer · Space handbrake · R reverse · T traction control · C camera · B back onto the road · X roof views';
    const CAR_NOTE = 'A black 2027 BMW M3: the US model-year 2027 car, the M3 Competition xDrive (G80), built to BMW\'s published size, weight and gearing. The electric M3 revealed for 2027 has no published figures. 251 mph is this dashboard\'s own top speed, far above the real car\'s 155 mph limiter: the engine\'s torque is scaled to reach it.';
    const CAR_SHORT = 'M3 Competition xDrive (G80), the US model-year 2027 car. 251 mph is this dashboard\'s figure, not BMW\'s (the real car is limited to 155): the torque is scaled to reach it.';
    function carHud() {
      if (hudEl.hidden) hudEl.hidden = false; const now = performance.now(); if (now - CARW.hudT < 66) return; CARW.hudT = now; const a = CAR.state;
      let E = CARW.els; if (!E || hudEl._h !== '\u0001m3') {
        hudEl.innerHTML = `<span class="se-hud-row" title="${esc(CAR_NOTE)}"><b>2027 BMW M3</b><i data-c="st"></i><span>SPD <b data-c="mph" style="display:inline-block;min-width:3.2ch;text-align:right"></b> mph</span><span>GEAR <b data-c="gear"></b></span><span>RPM <b data-c="rpm" style="display:inline-block;min-width:4.2ch;text-align:right"></b> <span aria-hidden="true" style="display:inline-block;vertical-align:middle;width:92px;height:7px;border:1px solid currentColor;border-radius:3px;overflow:hidden;opacity:.9"><span data-c="bar" style="display:block;height:100%;width:0;background:currentColor"></span></span></span><span>G <b data-c="g"></b></span><span>TC <b data-c="tc"></b></span><span>ROAD <b data-c="road"></b></span><span>CAM <b data-c="cam"></b></span></span><span class="se-hud-keys">${esc(CAR_KEYS)}</span><span class="se-hud-keys">${esc(CAR_SHORT)}</span>`;
        hudEl._h = '\u0001m3'; E = CARW.els = {}; hudEl.querySelectorAll('[data-c]').forEach(el => { E[el.getAttribute('data-c')] = el; });
      }
      const set = (k, v) => { if (E[k]._t !== v) { E[k].textContent = v; E[k]._t = v; } }, gr = a.grip, red = a.rpm > 6900;
      set('st', !CARW.drive ? 'parked' : a.hit ? 'struck ' + (CARW.what || 'something') : a.drifting ? 'sliding' : a.governed ? 'at its top speed' : a.atRest ? 'standing' : a.reverse ? 'backing up' : 'driving');
      set('mph', String(Math.round(a.mph))); set('gear', a.reverse ? 'R' : String(a.gear)); set('rpm', String(Math.round(a.rpm / 10) * 10));
      const w = Math.round(clamp(a.rpm / 7200, 0, 1) * 100) + '%'; if (E.bar._w !== w) { E.bar.style.width = w; E.bar._w = w; } if (E.bar._r !== red) { E.bar.style.background = red ? '#ff5a3c' : 'currentColor'; E.bar._r = red; }
      set('g', Math.hypot(a.gLong, a.gLat).toFixed(2) + (Math.abs(a.gLat) > 0.15 ? (a.gLat > 0 ? ' right' : ' left') : a.gLong < -0.15 ? ' braking' : ''));
      set('tc', a.tcMode === 'off' ? 'off' : a.tcMode === 'working' ? 'working' + (a.abs ? ' · ABS' : '') : a.abs ? 'on · ABS' : 'on');
      set('road', (a.onRoad ? (gr < 0.95 ? 'wet' : 'dry') : (gr < 0.6 ? 'off the road, wet' : 'off the road')) + ' · grip ' + gr.toFixed(2)); set('cam', S.carCam);
    }
    function carKey(code) {
      if (!CAR) return; if (code === 'KeyC') { S.carCam = CAR.CAMS[(CAR.CAMS.indexOf(S.carCam) + 1) % CAR.CAMS.length]; S.cchase.yaw = 0; if (S.carCam === 'orbit') S.cchase.oyaw = (CAR.state.yaw + 150) % 360; if (env.onGraphics) env.onGraphics(graphics()); }
      else if (code === 'KeyR') CAR.input.reverse = !CAR.input.reverse; else if (code === 'KeyT') CAR.input.tc = CAR.input.tc === false;
      else if (code === 'KeyB') { const a = CAR.state, L = carLane(a.x, a.z, a.yaw, 400); if (L) { CARW.lift = L.lift; CARW.at = null; carNear(L.x, L.z, 0); CAR.place(L.x, L.z, L.yaw, carGround(L.x, L.z)); S.x = L.x; S.z = L.z; after(); } }
      engine.playing = true; engine.wake(); need();
    }
    const carState = () => { if (!CAR || !CAR.out) return null; const a = CAR.state, ll = toLL(a.x, a.z); return { mph: a.mph, speed: a.speed, gear: a.reverse ? -1 : a.gear, rpm: a.rpm, throttle: a.throttle, brake: a.brake, steer: a.steer, gLong: a.gLong, gLat: a.gLat, tc: a.tcMode, abs: a.abs, drifting: a.drifting, hit: a.hit, hits: a.hits, struck: a.hit ? CARW.what || '' : '', atRest: a.atRest, onRoad: a.onRoad, grip: a.grip, wet: a.wet, lamps: !!a.lamps, braking: !!a.braking, yaw: a.yaw, lat: ll[0], lon: ll[1], y: a.y, odo: a.odo, topMph: a.topMph, top: 251, driving: CARW.drive, cam: S.carCam, fast: S.fast }; };
    /* the public handle (en.car) */
    const carApi = { get craft() { return CAR; }, get state() { return CAR ? CAR.state : null; }, get input() { return CAR ? CAR.input : null; }, spec: () => carMake().SPEC, keys: CAR_KEYS, note: CAR_NOTE, short: CAR_SHORT, cams: ['chase', 'bonnet', 'cockpit', 'orbit'],
      /* put the car at a latitude and longitude, heading yaw (degrees from north); snapped to the nearest lane unless o.exact */
      place(lat, lon, yaw, o) { carMake(); const p = toL(lat, lon), L = o && o.exact ? null : carLane(p[0], p[1], yaw != null ? yaw : CAR.state.yaw, 60), q = L || { x: p[0], z: p[1], yaw: yaw != null ? yaw : CAR.state.yaw }; CARW.lift = L ? L.lift : 0; CARW.at = null; carNear(q.x, q.z, 0); CAR.place(q.x, q.z, q.yaw, carGround(q.x, q.z)); CAR.show(true); CARW.snap = false; if (S.mode === 'm3') { S.x = q.x; S.z = q.z; after(); } carHero(); need(3); return carState(); },
      camera(c) { if (!CAR) return S.carCam; if (c && CAR.CAMS.includes(c)) { S.carCam = c; S.cchase.yaw = 0; } else if (!c) carKey('KeyC'); need(); return S.carCam; },
      reset() { carKey('KeyB'); }, tc(on) { if (CAR) CAR.input.tc = on == null ? CAR.input.tc === false : !!on; return CAR ? CAR.input.tc !== false : true; }, reverse(on) { if (CAR) CAR.input.reverse = on == null ? !CAR.input.reverse : !!on; },
      /* a script at the wheel: { throttle, brake, steer, handbrake, reverse }, or null to give the wheel back */
      drive(o) { CARW.script = o || null; if (o) { engine.playing = true; engine.wake(); need(); } },
      /* for tests: n steps of dt seconds without waiting for frames */
      step(dt, n) { let m = false; if (S.mode !== 'm3' || !CAR) return null; for (let i = 0; i < (n || 1); i++) m = carStep(dt || 1 / 60); need(); return carState(); },
      put() { if (CAR) { CAR.show(false); S.hero = null; } } };

