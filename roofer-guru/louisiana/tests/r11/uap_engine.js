  /* ==== rooftop scout on the engine: two craft that fly in any weather, a flying saucer and the Tic Tac ==== */
  /* The Alta X stays on the ground past light rain. These two do not care: they are the way to a roof in a hurricane, and
     the way across the state.
       The flying saucer is the classic one of the photographs and files of the late 1940s to the 1960s: a polished metal
       disc with a flange round its rim, a low cabin on top ringed by round ports under a dome, and three half spheres
       under it. The flange and the silver with a touch of bronze, more bronze underneath, are the McMinnville, Oregon
       object of 1950 as the University of Colorado's study for the Air Force described it (Condon Report, case 46); the
       dome, the eight ports of about 18 inches and the three balls are George Adamski's, photographed in 1952 and
       described in his book of 1955; the wobble like a
       gyroscope and the light under the middle are Rex Heflin's of 1965 (case 52). It is 35.3 ft (10.76 m) across, the
       size of the disc the Air Force itself had Avro design (Project 1794: Avro's report of 1956, among records the
       National Archives posted in 2012), and polished like Avro's Avrocar.
       The Tic Tac is the object the Nimitz carrier group met off California on 14 November 2004, as Commander David
       Fravor described it under oath to the House Oversight Committee in 2023: 40 ft long, "perfectly white, smooth, no
       windows", "no seams", no wings, no rotors and no exhaust, hanging over the water and "moving very abruptly ...
       like a ping pong ball"; a "giant flying propane tank". No witness gave its thickness: a third of its length is
       assumed.
     Nothing is known of how either would fly, so the flying is invented and kept simple: they go where the sticks point
     with no run up, faster the higher they are (to about 3,600 mph at 1,400 m: the speed implied by what Commander Fravor
     testified the ship's controller told him, that the object was at his CAP point "roughly 60 miles away in less than
     a minute"; three times that held on Shift), and stop dead. Gravity warp: given
     a place, the craft turns to it, and is there. The saucer first stands up on its edge, its underside to where it is
     going; the Tic Tac goes as it is. */
  function UapKit(engine) {
    const dev = engine.device, scene = engine.scene, U = {};
    U.SPEC = { saucer: { name: 'Flying saucer', acrossM: 10.76, tallM: 3.5, look: 'polished metal disc, domed, ported, three spheres under it' }, tictac: { name: 'The Tic Tac', longM: 12.2, acrossM: 4.0, look: 'smooth white capsule, featureless' },
      assumed: { ceilingM: 1400, speedPerMetreUp: 1.15, speedMin: 40, speedMax: 1610, boost: 3, climb: 0.5, hoverM: 60, everything: 'how they fly, the lamps and the glow' } };
    const SP = U.SPEC, AS = SP.assumed;
    /* a shape turned on a lathe: rings of a profile [radius, height] from the bottom up, with smooth normals; crease: indices where the surface breaks */
    function lathe(D, prof, seg, col, at, crease) {
      at = at || [0, 0, 0]; crease = crease || []; const n = prof.length, nOf = (a, b) => { const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1; return [dy / l, -dr / l]; };   /* outward of a profile that climbs: (dy, -dr) */
      const ring = (p, t) => { const start = D.P.length / 3, cc = p[2] || col; for (let k = 0; k <= seg; k++) { const th = k / seg * TAU, c = Math.cos(th), s = Math.sin(th); D.P.push(at[0] + c * p[0], at[1] + p[1], at[2] + s * p[0]); D.N.push(c * t[0], t[1], s * t[0]); D.U.push(k / seg, 0); D.C.push(cc[0], cc[1], cc[2], 255); } return start; };
      const lo = [], hi = [];   /* for each point of the profile: the ring that ends the band below it and the ring that starts the band above (two at a crease, one where it is smooth) */
      for (let i = 0; i < n; i++) { const a = prof[Math.max(0, i - 1)], b = prof[Math.min(n - 1, i + 1)], q = prof[i]; if (crease.includes(i) && i > 0 && i < n - 1) { lo.push(ring(q, nOf(a, q))); hi.push(ring(q, nOf(q, b))); } else { const r = ring(q, nOf(a, b)); lo.push(r); hi.push(r); } }
      for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) { const a = hi[i] + k, b = lo[i + 1] + k; D.I.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const meshOf = (D, name) => new Mesh(dev, { name, positions: new Float32Array(D.P), normals: new Float32Array(D.N), uvs: new Float32Array(D.U), colors: new Uint8Array(D.C), indices: D.P.length / 3 > 65535 ? new Uint32Array(D.I) : new Uint16Array(D.I), keep: true });
    const fresh = () => ({ P: [], N: [], U: [], C: [], I: [] });
    const part = (name, mesh, mat, parent) => { const e = scene.createEntity(name, { parent, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat; mr.pickable = false; return e; };
    const M = {
      metal: new Material({ name: 'Saucer: polished metal', vertexColors: true, roughness: 0.2, metallic: 1, wet: 0 }), glass: new Material({ name: 'Saucer: ports and dome glass', albedo: '#0b0f14', roughness: 0.06, metallic: 0, wet: 0 }),
      port: new Material({ name: 'Saucer: lit ports (assumed)', albedo: '#000000', emissive: '#ffd9a0', emissiveIntensity: 6, model: 'unlit', castShadow: false }), rim: new Material({ name: 'Saucer: rim lamps (assumed)', albedo: '#000000', emissive: '#ffb347', emissiveIntensity: 20, model: 'unlit', castShadow: false }),
      glow: new Material({ name: 'Saucer: the glow under it (assumed)', albedo: '#000000', emissive: '#8fd8ff', emissiveIntensity: 5, model: 'unlit', castShadow: false }),
      white: new Material({ name: 'Tic Tac: white, smooth', albedo: '#f1f1ec', roughness: 0.62, metallic: 0, wet: 0 }) };
    U.materials = M;
    /* ---------- the flying saucer ---------- */
    const sRoot = scene.createEntity('Flying saucer', { transient: true }), sBody = scene.createEntity('Saucer hull', { parent: sRoot, transient: true }), sSpin = scene.createEntity('Saucer rim', { parent: sBody, transient: true });
    { const R0 = SP.saucer.acrossM / 2, al = [232, 234, 238], al2 = [214, 205, 188], dk = [168, 152, 128], D = fresh();   /* silver on top, a touch of bronze underneath */
      /* from the hub underneath, out along the belly to the rim's flange, back in over the top to the cabin wall and its roof */
      lathe(D, [[0, -0.98, dk], [0.95, -0.98, dk], [1.05, -0.9, al2], [2.0, -0.86, al2], [3.55, -0.56], [4.75, -0.2], [R0 - 0.06, -0.035], [R0, 0], [R0 - 0.06, 0.035], [4.7, 0.2], [3.3, 0.6], [2.42, 0.92], [2.3, 1.0], [2.22, 1.08], [2.08, 1.62], [2.0, 1.7], [1.72, 1.98], [1.2, 2.28], [0.6, 2.46], [0, 2.52]], 72, al, null, [1, 7, 12, 15]);
      /* three half spheres under it, a third of a turn apart */
      for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + 0.5, r = 0.78, pr = []; for (let j = 0; j <= 7; j++) { const t = j / 7 * Math.PI / 2; pr.push([Math.sin(t) * r, -Math.cos(t) * r]); } lathe(D, pr, 24, al2, [Math.cos(a) * 2.55, -0.7, Math.sin(a) * 2.55]); }
      part('Hull', meshOf(D, 'Flying saucer hull'), M.metal, sBody);
      /* round ports in the cabin wall: a dark glass, and behind every other one a light */
      const G = new MeshBuilder(), Lp = new MeshBuilder(), disc = (Bd, c, nx, nz, r, col) => { const ux = -nz, uz = nx; for (let i = 0; i < 12; i++) { const a0 = i / 12 * TAU, a1 = (i + 1) / 12 * TAU, p = a => [c[0] + ux * Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + uz * Math.cos(a) * r]; Bd.tri(c, p(a0), p(a1), [nx, 0.12, nz], null, null, null, col); } };
      for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU, c = Math.cos(a), s = Math.sin(a), rr = 2.165; disc(k % 2 ? G : Lp, [c * rr, 1.36, s * rr], c, s, 0.23, [1, 1, 1, 1]); }
      part('Ports', G.build(dev, { name: 'Saucer ports' }), M.glass, sBody); part('Lit ports', Lp.build(dev, { name: 'Saucer lit ports' }), M.port, sBody).get('MeshRenderer').castShadow = false;
      /* lamps round the rim, which turns slowly, and the ring that glows on the belly */
      const Lr = new MeshBuilder(); for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; Lr.box(Math.cos(a) * (R0 - 0.2), -0.07, Math.sin(a) * (R0 - 0.2), 0.07, 0.03, 0.12, -a, [1, 1, 1, 1]); } part('Rim lamps', Lr.build(dev, { name: 'Saucer rim lamps' }), M.rim, sSpin).get('MeshRenderer').castShadow = false;
      const Gl = fresh(); lathe(Gl, [[1.08, -0.905], [1.5, -0.895], [1.95, -0.885]], 48, [255, 255, 255]); part('Glow', meshOf(Gl, 'Saucer glow ring'), M.glow, sBody).get('MeshRenderer').castShadow = false;
    }
    const sLight = scene.createEntity('Saucer light', { parent: sRoot, transient: true }); sLight.add('Light', { type: 'point', color: [0.56, 0.85, 1], intensity: 0, range: 46 }); sLight.transform.setPosition(0, -2.2, 0);
    /* ---------- the Tic Tac ---------- */
    const tRoot = scene.createEntity('The Tic Tac', { transient: true }), tBody = scene.createEntity('Tic Tac hull', { parent: tRoot, transient: true });
    { const D = fresh(), r = SP.tictac.acrossM / 2, half = SP.tictac.longM / 2 - r, pr = [], n = 12; for (let j = 0; j <= n; j++) { const t = j / n * Math.PI / 2; pr.push([Math.sin(t) * r, -half - Math.cos(t) * r]); } for (let j = 0; j <= n; j++) { const t = j / n * Math.PI / 2; pr.push([Math.cos(t) * r, half + Math.sin(t) * r]); }
      lathe(D, pr, 48, [255, 255, 255]); const e = part('Hull', meshOf(D, 'Tic Tac hull'), M.white, tBody); e.transform.setEuler(90, 0, 0); }   /* turned on the lathe standing up, then laid along its length */
    sRoot.setActive(false); tRoot.setActive(false); U.kind = 'saucer'; U.root = sRoot;
    /* ---------- flight ---------- */
    const st = U.state = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, tilt: 0, lean: 0, bank: 0, mode: 'Hover', target: null, warp: null, odo: 0, pan: 0, gimbal: -55, t: 0, jig: [0, 0, 0], jigTo: [0, 0, 0], jigAt: 0, glow: 0 };
    U.input = { fwd: 0, right: 0, up: 0, yaw: 0, boost: false };
    U.use = kind => { U.kind = kind === 'tictac' ? 'tictac' : 'saucer'; U.root = U.kind === 'tictac' ? tRoot : sRoot; sRoot.setActive(U.shown && U.kind === 'saucer'); tRoot.setActive(U.shown && U.kind === 'tictac'); pose(); };
    U.show = on => { U.shown = !!on; sRoot.setActive(U.shown && U.kind === 'saucer'); tRoot.setActive(U.shown && U.kind === 'tictac'); };
    U.cancel = () => { const W = st.warp; st.warp = null; st.tilt = 0; st.jig = [0, 0, 0]; st.glow = 0; if (st.mode === 'Gravity warp') st.mode = 'Hover'; return W; };   /* a warp given up: the craft is level and still where it is */
    U.place = (x, z, yaw, y) => { U.cancel(); st.x = x; st.z = z; st.y = y; st.vx = st.vy = st.vz = 0; if (yaw != null) st.yaw = yaw; st.target = null; st.mode = 'Hover'; pose(); };
    U.goTo = (x, z, y) => { if (st.warp) return; st.target = [x, z, y]; st.mode = 'Go to'; };
    U.speedMax = agl => clamp(agl * AS.speedPerMetreUp, AS.speedMin, AS.speedMax);
    /* gravity warp: o.yaw the bearing to go on, o.onJump() moves the world, o.onDone() when it has arrived */
    U.warp = o => { if (st.warp) return false; st.warp = Object.assign({ phase: 'turn', t: 0, yaw0: st.yaw }, o); st.target = null; st.mode = 'Gravity warp'; st.vx = st.vy = st.vz = 0; return true; };
    /* where it is put down by the world after a jump, and the point the camera hangs behind (which is not the craft while it jumps) */
    U.arriveAt = (x, y, z) => { if (st.warp) st.warp.to = [x, y, z]; st.x = x; st.y = y; st.z = z; };
    U.anchor = () => { const W = st.warp; return W && W.phase === 'jump' ? W.from : W && W.phase === 'arrive' && W.to ? W.to : [st.x, st.y, st.z]; };
    function pose() {
      const r = U.root.transform, j = st.jig; r.setPosition(st.x + j[0], st.y + j[1], st.z + j[2]); Q.fromEuler(r.rotation, 0, -st.yaw * RAD, 0); r.dirty();
      if (U.kind === 'saucer') { const wob = (1 - st.tilt) * 2.2, b = sBody.transform; Q.fromEuler(b.rotation, (st.tilt * 90 + st.lean + Math.sin(st.t * 1.9) * wob) * RAD, 0, (st.bank + Math.cos(st.t * 1.9) * wob) * RAD); b.dirty(); Q.fromEuler(sSpin.transform.rotation, 0, st.t * 0.9, 0); sSpin.transform.dirty();
        M.glow.emissiveIntensity = 4 + st.glow * 60; M.rim.emissiveIntensity = 14 + st.glow * 40; sLight.get('Light').intensity = 40 + st.glow * 900; }
    }
    /* env: { floor(x, z), block(x, z, y) } */
    U.update = (dt, env) => {
      dt = Math.min(dt, 0.05); st.t += dt; const I = U.input, yr = st.yaw * RAD, fx = Math.sin(yr), fz = -Math.cos(yr), rx = Math.cos(yr), rz = Math.sin(yr), floor = env.floor(st.x, st.z), agl = Math.max(0, st.y - floor), W = st.warp; let glow = 0;
      if (W) {
        W.t += dt;
        if (W.phase === 'turn') { const dy = ((W.yaw - st.yaw + 540) % 360) - 180, step = 260 * dt; st.yaw = (st.yaw + clamp(dy, -step, step) + 360) % 360; if (st.y < floor + 45) st.y += 60 * dt; glow = 0.15; if (Math.abs(dy) < 0.5 && W.t > 0.3) { W.phase = U.kind === 'saucer' ? 'tilt' : 'charge'; W.t = 0; } }
        else if (W.phase === 'tilt') { const u = Math.min(1, W.t / 1.25); st.tilt = u * u * (3 - 2 * u); glow = 0.15 + 0.35 * u; if (u >= 1) { W.phase = 'charge'; W.t = 0; } }
        else if (W.phase === 'charge') { const u = Math.min(1, W.t / (U.kind === 'saucer' ? 0.55 : 0.28)); glow = 0.5 + 0.5 * u; st.jig = [(Math.random() - 0.5) * 0.12 * u, (Math.random() - 0.5) * 0.12 * u, (Math.random() - 0.5) * 0.12 * u]; if (u >= 1) { W.phase = 'jump'; W.t = 0; st.jig = [0, 0, 0]; W.from = [st.x, st.y, st.z]; if (W.onStart) W.onStart(); } }
        /* it leaves faster than the eye follows: the camera stays where it was, then is where it went, and the craft comes in to a stop there */
        else if (W.phase === 'jump') { const u = Math.min(1, W.t / 0.36), d = 2400 * u * u * u; st.x = W.from[0] + fx * d; st.z = W.from[2] + fz * d; st.y = W.from[1] + d * 0.03; W.out = u; glow = 1; if (u >= 1) { W.phase = 'arrive'; W.t = 0; W.to = null; if (W.onJump) W.onJump(); if (!W.to) W.to = [st.x, st.y, st.z]; st.vx = st.vy = st.vz = 0; } }
        else { const u = Math.min(1, W.t / 0.95), e = 1 - Math.pow(1 - u, 3), back = 1500 * (1 - e); st.x = W.to[0] - fx * back; st.z = W.to[2] - fz * back; st.y = W.to[1] + back * 0.03; W.out = 1 - e; st.tilt = U.kind === 'saucer' ? 1 - e : 0; glow = 1 - e; if (u >= 1) { st.x = W.to[0]; st.y = W.to[1]; st.z = W.to[2]; st.tilt = 0; const done = W.onDone; st.warp = null; st.mode = 'Hover'; if (done) done(); } }
        st.glow = glow; pose(); return true;
      }
      let wantX = 0, wantZ = 0, wantY = 0; const vmax = U.speedMax(agl) * (I.boost ? AS.boost : 1), sticks = Math.abs(I.fwd) + Math.abs(I.right) + Math.abs(I.up) > 0.02;
      if (sticks && st.target) { st.target = null; st.mode = 'Hover'; }
      if (st.target) { const t = st.target, dx = t[0] - st.x, dz = t[1] - st.z, d = Math.hypot(dx, dz), sp = Math.min(Math.max(vmax, 120), d * 2.2 + 2); if (d > 0.6) { wantX = dx / d * sp; wantZ = dz / d * sp; const ty = DEG * Math.atan2(dx, -dz), dy = ((ty - st.yaw + 540) % 360) - 180; if (d > 8) st.yaw = (st.yaw + clamp(dy, -200 * dt, 200 * dt) + 360) % 360; } else if (t[2] == null || Math.abs(t[2] - st.y) < 0.8) { st.target = null; st.mode = 'Hover'; } if (t[2] != null) wantY = clamp((t[2] - st.y) * 1.5, -80, 80); }
      else { wantX = (fx * I.fwd + rx * I.right) * vmax; wantZ = (fz * I.fwd + rz * I.right) * vmax; wantY = I.up * clamp(agl * AS.climb, 12, 400); }
      st.yaw = (st.yaw + I.yaw * 80 * dt + 360) % 360;
      const k = 1 - Math.exp(-dt / 0.28); st.vx += (wantX - st.vx) * k; st.vz += (wantZ - st.vz) * k; st.vy += (wantY - st.vy) * (1 - Math.exp(-dt / 0.2));
      let nx = st.x + st.vx * dt, nz = st.z + st.vz * dt, ny = clamp(st.y + st.vy * dt, 0, AS.ceilingM);
      if (ny < 90 && env.block(nx, nz, ny - 1)) { if (!env.block(nx, st.z, ny - 1)) { nz = st.z; st.vz = 0; } else if (!env.block(st.x, nz, ny - 1)) { nx = st.x; st.vx = 0; } else { nx = st.x; nz = st.z; st.vx = st.vz = 0; } if (st.target) { st.target = null; st.mode = 'Hover'; } }
      const f2 = env.floor(nx, nz) + 1.6; if (ny < f2) { ny = f2; if (st.vy < 0) st.vy = 0; }
      st.odo += Math.hypot(nx - st.x, nz - st.z); st.x = nx; st.z = nz; st.y = ny;
      const sp = Math.hypot(st.vx, st.vz); st.mode = st.target ? 'Go to' : sp > 3 || Math.abs(st.vy) > 2 ? 'Flying' : 'Hover';
      /* how it carries itself: the saucer dips its edge a little the way it goes; the Tic Tac never leans, but hanging still it jumps about like a ball off a wall, as the pilots said */
      const kk = Math.min(1, dt * 5); st.lean += (clamp(-(st.vx * fx + st.vz * fz) / Math.max(40, vmax) * 9, -12, 12) - st.lean) * kk; st.bank += (clamp((st.vx * rx + st.vz * rz) / Math.max(40, vmax) * 9, -12, 12) - st.bank) * kk;
      if (U.kind === 'tictac' && sp < 4 && Math.abs(st.vy) < 2) { if (st.t > st.jigAt) { st.jigAt = st.t + 0.35 + Math.random() * 1.3; st.jigTo = [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3]; } const q = Math.min(1, dt * 22); st.jig = st.jig.map((v, i) => v + (st.jigTo[i] - v) * q); } else st.jig = st.jig.map(v => v * Math.max(0, 1 - dt * 8));
      st.glow += (clamp(sp / Math.max(60, vmax) * 0.5 + (I.boost ? 0.3 : 0), 0, 1) - st.glow) * Math.min(1, dt * 4);
      pose(); return true;
    };
    U.dispose = () => { sRoot.destroy(); tRoot.destroy(); };
    return U;
  }
  SE.UapKit = UapKit;

