  /* ==== rooftop scout on the engine: a black 2027 BMW M3 to drive ==== */
  /* Which car this is. "2027 M3" names two cars: the US model-year 2027 M3, which is still the sixth-generation petrol
     car (G80: twin-turbo straight six, four tail pipes), and the electric Neue Klasse M3 that BMW reveals in 2027 and
     for which it has published no power, weight, size or speed. Only the first has a full set of published figures, so
     this is that one: the M3 Competition with M xDrive. Its dimensions, weights, gearing and tyres are BMW's (see
     CarPhysics.SPEC and car_figures.md). The body is a likeness made from those dimensions and the car's known look
     (two tall grille openings, flared arches, four tail pipes, a carbon roof, 19 inch wheels in front and 20 behind);
     every shape the sheet does not give is assumed (M3Body). The paint is black, after BMW's Black Sapphire metallic.
     The one figure that is not BMW's is the top speed: 251 mph is this dashboard's own. The real car is limited to
     155 mph (180 with the M Driver's Package). The model reaches 251 by multiplying the published torque curve by one
     factor (about 2.2, 872 kW at the peak), solved from this car's own drag, rolling resistance and driveline loss;
     a governor here holds it at 251 on a downgrade, so it is never exceeded.
     The kit knows nothing of the world: the ground, the grip and the walls come in through env, and the world reads
     state. The dynamics are CarPhysics, used as it is. */
  function M3Kit(engine) {
    const dev = engine.device, scene = engine.scene, A = {}, MPH = 0.44704, VMAX = 251 * MPH;
    const PH = CarPhysics({ controls: { autoReverse: true } }), B = M3Body(), D = B.dims, PS = PH.state;
    A.physics = PH; A.dims = D;
    A.SPEC = { name: '2027 BMW M3 Competition xDrive (G80), black', paint: 'Black Sapphire metallic (a likeness)', topSpeedMph: 251,
      what: 'The US model-year 2027 M3 is the sixth-generation petrol car (G80). The electric Neue Klasse M3 revealed for 2027 has no published figures, so it is not the one modelled.',
      topSpeedNote: '251 mph is this dashboard\'s own figure. The real car is limited to 155 mph (180 with the M Driver\'s Package). It is reached here by scaling the published torque curve by ' + PH.derived.torqueScale.toFixed(2) + ' (' + Math.round(PH.derived.peakPowerKW) + ' kW at the peak).',
      lengthM: D.L, widthM: D.W, heightM: D.H, wheelbaseM: D.wb, physics: PH.SPEC,
      assumed: { body: 'every shape not on BMW\'s sheet: overhangs, roof line, belt line, grille, lamps, pipes, mirrors, wheels, cabin', frontOverhangM: D.fo, lamps: 'white daytime running lights, head lamps after dark and in rain, red tail and brake lamps, white reversing lamps', sound: 'a synthesised six-cylinder note, not a recording' } };
    /* ---------- meshes and materials ---------- */
    const meshOf = (g, name) => new Mesh(dev, { name, positions: g.positions, normals: g.normals, uvs: new Float32Array(g.positions.length / 3 * 2), colors: new Uint8Array(g.positions.length / 3 * 4).fill(255), indices: g.indices });
    const lamp = (name, lens, glow) => new Material({ name: 'M3: ' + name, albedo: lens, roughness: 0.12, metallic: 0.2, emissive: glow, emissiveIntensity: 0, wet: 0 });
    const M = A.materials = {
      paint: new Material({ name: 'M3: black paint', albedo: '#0b0c10', roughness: 0.17, metallic: 0.35, wet: 0 }),
      gloss: new Material({ name: 'M3: gloss black and carbon', albedo: '#08080a', roughness: 0.26, metallic: 0, wet: 0 }),
      matte: new Material({ name: 'M3: black plastic', albedo: '#0a0a0a', roughness: 0.8, metallic: 0, wet: 0 }),
      glass: new Material({ name: 'M3: glass', albedo: '#2b3036', model: 'glass', roughness: 0.045, metallic: 0, wet: 0 }),
      pipe: new Material({ name: 'M3: tail pipes', albedo: '#6f7073', roughness: 0.25, metallic: 1, wet: 0 }),
      plate: new Material({ name: 'M3: plate', albedo: '#d9d8d2', roughness: 0.5, metallic: 0, wet: 0 }),
      head: lamp('head lamps', '#8a8d92', '#fff3dc'), drl: lamp('daytime running lights', '#c9ccd2', '#f4f8ff'), tail: lamp('tail lamps', '#3a0606', '#ff1408'), chmsl: lamp('third brake lamp', '#2a0505', '#ff1408'), rev: lamp('reversing lamps', '#9a9c9f', '#ffffff'),
      tyre: new Material({ name: 'M3: tyres', albedo: '#0e0e0e', roughness: 0.9, metallic: 0, wet: 0 }),
      rim: new Material({ name: 'M3: wheels, dark', albedo: '#101113', roughness: 0.4, metallic: 0.8, wet: 0 }),
      bright: new Material({ name: 'M3: wheels, machined faces', albedo: '#9a9da2', roughness: 0.3, metallic: 1, wet: 0 }),
      brake: new Material({ name: 'M3: brake discs', albedo: '#5a5b5e', roughness: 0.45, metallic: 1, wet: 0 }),
      calliper: new Material({ name: 'M3: brake callipers (blue)', albedo: '#10307a', roughness: 0.35, metallic: 0.2, wet: 0 }),
      dark: new Material({ name: 'M3: cabin', albedo: '#0d0d0e', roughness: 0.7, metallic: 0, wet: 0, twoSided: true }),
      screen: new Material({ name: 'M3: display', albedo: '#000000', emissive: '#3a6cff', emissiveIntensity: 0.6, wet: 0 }),
      wheel: new Material({ name: 'M3: steering wheel', albedo: '#101010', roughness: 0.55, metallic: 0, wet: 0 }),
      skid: new Material({ name: 'M3: tyre marks', albedo: '#050505', alpha: 0.5, blend: 'alpha', vertexColors: true, depthWrite: false, castShadow: false, roughness: 0.9, wet: 0, polygonOffset: [-2, -4] }) };
    A.meshes = [];
    /* ---------- the car in the scene: a root on the ground, the body on its springs, four wheels on the ground ---------- */
    const root = scene.createEntity('2027 BMW M3 (black)', { transient: true }), bodyE = scene.createEntity('Body', { parent: root, transient: true });
    const part = (name, g, mat, parent, shadow) => { const mesh = meshOf(g, 'M3 ' + name); A.meshes.push(mesh); const e = scene.createEntity(name, { parent: parent || bodyE, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat; mr.pickable = false; if (shadow === false) mr.castShadow = false; return e; };
    const NAMES = { paint: 'Painted body', gloss: 'Carbon roof and gloss black trim', matte: 'Grille, intakes, diffuser, wheel wells', glass: 'Glass', pipe: 'Four tail pipes', plate: 'Plate', head: 'Head lamps', drl: 'Daytime running lights', tail: 'Tail lamps', chmsl: 'Third brake lamp', rev: 'Reversing lamps' };
    Object.keys(B.parts).forEach(k => part(NAMES[k] || k, B.parts[k], M[k] || M.matte, bodyE, k === 'paint' || k === 'glass' || k === 'gloss' || k === 'matte'));
    const cabinE = scene.createEntity('Cabin', { parent: bodyE, transient: true }); part('Dash, pillars and doors', B.cabin.dark, M.dark, cabinE, false); part('Display', B.cabin.screen, M.screen, cabinE, false);
    const swE = part('Steering wheel', B.cabin.wheel, M.wheel, cabinE, false); swE.transform.setPosition(D.steeringWheel[0], D.steeringWheel[1], D.steeringWheel[2]); cabinE.setActive(false);
    /* wheels: 0 front left, 1 front right, 2 rear left, 3 rear right (the order the physics uses) */
    const WX = [D.wb / 2, D.wb / 2, -D.wb / 2, -D.wb / 2], WY = [-D.trackF / 2, D.trackF / 2, -D.trackR / 2, D.trackR / 2], WR = [D.rF, D.rF, D.rR, D.rR];
    const wheels = [0, 1, 2, 3].map(i => { const W = i < 2 ? B.wheelF : B.wheelR, kn = scene.createEntity('Wheel ' + ['front left', 'front right', 'rear left', 'rear right'][i], { parent: root, transient: true }), sp = scene.createEntity('Turning', { parent: kn, transient: true });
      part('Tyre', W.tyre, M.tyre, sp); part('Rim', W.rim, M.rim, sp, false); part('Spokes', W.bright, M.bright, sp, false); part('Brake disc', W.brake, M.brake, kn, false); part('Calliper', W.calliper, M.calliper, kn, false);
      return { kn, sp, left: WY[i] < 0 }; });
    /* lamps that light the road after dark, and the glow of the tail on what is behind */
    const beams = [-1, 1].map(sg => { const e = scene.createEntity('Head lamp beam', { parent: bodyE, transient: true }); e.add('Light', { type: 'spot', color: [1, 0.95, 0.86], intensity: 0, range: 70, angle: 62, blend: 0.55 }); e.transform.setPosition(sg * 0.62, 0.68, -(D.nose - 0.12)); e.transform.setEuler(-5, 0, 0); e.setActive(false); return e; });
    const glowE = scene.createEntity('Tail lamp glow', { parent: bodyE, transient: true }); glowE.add('Light', { type: 'point', color: [1, 0.08, 0.04], intensity: 0, range: 9 }); glowE.transform.setPosition(0, 0.9, -D.tail + 0.5); glowE.setActive(false);
    /* smoke from a sliding tyre, and spray off a wet road: one emitter at each wheel's foot */
    const fx = [0, 1, 2, 3].map(i => { const mk = (name, o) => { const e = scene.createEntity(name, { parent: root, transient: true }), ps = e.add('ParticleSystem'); Object.assign(ps, o); ps.emitting = false; ps.rate = 0; e.transform.setPosition(WY[i], 0.08, -WX[i] + 0.25); return ps; };
      return { smoke: mk('Tyre smoke', { max: 260, life: [0.9, 2.2], speed: [0.3, 1.6], spread: 50, gravity: -0.7, drag: 1.4, size: [0.3, 2.4], colorA: [0.86, 0.86, 0.88, 0.34], colorB: [0.92, 0.92, 0.94, 0], blend: 'alpha', lit: 1, wispy: true, radius: 0.14, turbulence: 0.9, soft: 0.6, direction: [0, 0.6, 1] }),
        spray: mk('Road spray', { max: 220, life: [0.45, 1.0], speed: [1.5, 4.5], spread: 28, gravity: 2.5, drag: 1.0, size: [0.25, 1.5], colorA: [0.82, 0.86, 0.92, 0.2], colorB: [0.9, 0.93, 0.97, 0], blend: 'alpha', lit: 1, wispy: true, radius: 0.12, turbulence: 0.5, soft: 0.6, direction: [0, 0.75, 1] }) }; });
    /* the marks sliding tyres leave: short dark strips kept in a ring, drawn as instances of one flat square */
    const skidB = new MeshBuilder(); skidB.quad([-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [0, 1, 0], null, [1, 1, 1, 1]);
    const skidMesh = skidB.build(dev, { name: 'M3 tyre mark' }), skidIB = new InstanceBuffer(dev, 64), skidE = scene.createEntity('Tyre marks', { transient: true }), skidR = skidE.add('InstancedRenderer');
    skidR.instances = skidIB; skidR.mesh = skidMesh; skidR.material = M.skid; skidR.castShadow = false; skidR.maxDistance = 400; skidE.setActive(false);
    const SKID = { list: [], max: 520, last: [null, null, null, null], dirty: false };
    A.clearMarks = () => { SKID.list.length = 0; SKID.last = [null, null, null, null]; skidIB.clear(); skidE.setActive(false); };
    root.setActive(false); A.root = root; A.out = false;

    /* ---------- state ---------- */
    /* The physics keeps its own frame; (ox, oz) carries it into the world's local metres, so the world can move its
       origin under a car that is going (A.shift) without the dynamics being touched. */
    let ox = 0, oz = 0, cabinOn = false;
    const st = A.state = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, vx: 0, vz: 0, speed: 0, mph: 0, forward: 0, yawRate: 0, rpm: 800, gear: 1, throttle: 0, brake: 0, steer: 0, gLong: 0, gLat: 0, abs: false, tc: false, sc: false, tcMode: 'on', drifting: false, atRest: true, hit: false, hits: 0, reverse: false,
      grip: 1, onRoad: true, wet: 0, night: 0, slide: 0, odo: 0, topMph: 0, governed: false, wheels: [0, 1, 2, 3].map(() => ({ x: 0, y: 0, z: 0, steer: 0, spin: 0, slip: 0, slipAngle: 0, load: 0, travel: 0, sliding: 0 })) };
    A.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0, reverse: false, tc: true };
    const CAMS = A.CAMS = ['chase', 'bonnet', 'cockpit', 'orbit'];
    const cam = A.cam = { yaw: 0, dist: 7.2, pull: 0, look: 0 };
    function read() {
      st.x = PS.x + ox; st.z = PS.z + oz; st.y = PS.y; st.yaw = ((PS.yaw % 360) + 360) % 360; st.pitch = PS.pitch; st.roll = PS.roll; st.vx = PS.vx; st.vz = PS.vz; st.speed = PS.speed; st.mph = Math.min(251, PS.mph); st.forward = PS.forwardSpeed || 0; st.yawRate = PS.yawRate || 0;
      st.rpm = PS.rpm; st.gear = PS.gear; st.throttle = PS.throttle; st.brake = PS.brake; st.steer = PS.steer; st.gLong = PS.g.long; st.gLat = PS.g.lat; st.abs = PS.absOn; st.tc = PS.tcOn; st.sc = PS.scOn; st.drifting = PS.drifting; st.atRest = PS.atRest; st.hit = PS.hit; st.reverse = PS.gear < 0;
      st.tcMode = A.input.tc === false ? 'off' : (PS.tcOn || PS.scOn ? 'working' : 'on'); if (st.mph > st.topMph) st.topMph = st.mph;
      for (let i = 0; i < 4; i++) { const w = PS.wheels[i], o = st.wheels[i]; o.x = w.x + ox; o.z = w.z + oz; o.y = w.y; o.steer = w.steer; o.spin = w.spin; o.slip = w.slip; o.slipAngle = w.slipAngle; o.load = w.load; o.travel = w.travel; }
    }
    /* put the car down at rest: (x, z) the middle of the wheelbase in the world's local metres, yaw in degrees clockwise from north */
    A.place = (x, z, yaw, y) => { ox = 0; oz = 0; PH.place(x, z, yaw || 0, y); A.input.throttle = A.input.brake = A.input.steer = A.input.handbrake = 0; A.input.reverse = false; read(); cam.yaw = st.yaw; cam.pull = 0; cam.look = 0; SKID.last = [null, null, null, null]; st.hits = 0; pose(0); };
    A.show = on => { root.setActive(!!on); A.out = !!on; if (!on) { A.clearMarks(); A.quiet(); } };
    /* the world moved its origin by (dx, dz): everything held in local metres follows */
    A.shift = (dx, dz) => { ox += dx; oz += dz; A.clearMarks(); read(); pose(0); };
    A.cabin = on => { on = !!on; if (on !== cabinOn) { cabinOn = on; cabinE.setActive(on); } };

    function pose(dt) {
      const w = PS.wheels, hF = (w[0].y + w[1].y) / 2 - D.rF, hR = (w[2].y + w[3].y) / 2 - D.rR, hL = (w[0].y - D.rF + w[2].y - D.rR) / 2, hRt = (w[1].y - D.rF + w[3].y - D.rR) / 2;
      const pg = Math.atan2(hF - hR, D.wb), rg = Math.atan2(hL - hRt, (D.trackF + D.trackR) / 2), yRef = (hF + hR) / 2, tp = Math.tan(pg), tr = Math.tan(rg);
      root.transform.setPosition(st.x, yRef, st.z); Q.fromEuler(root.transform.rotation, pg, -PS.yaw * RAD, -rg); root.transform.dirty();
      const pb = clamp(PS.pitch * RAD - pg, -0.12, 0.12), rb = clamp(PS.roll * RAD - rg, -0.14, 0.14); bodyE.transform.setPosition(0, PS.y - yRef, 0); Q.fromEuler(bodyE.transform.rotation, pb, 0, -rb); bodyE.transform.dirty();
      for (let i = 0; i < 4; i++) { const W = wheels[i], fit = yRef + WX[i] * tp - WY[i] * tr, dy = clamp(w[i].y - WR[i] - fit, -0.12, 0.12);
        W.kn.transform.setPosition(WY[i], WR[i] + dy, -WX[i]); Q.fromEuler(W.kn.transform.rotation, 0, -w[i].steer + (W.left ? Math.PI : 0), 0); W.kn.transform.dirty();
        Q.fromEuler(W.sp.transform.rotation, W.left ? w[i].spin : -w[i].spin, 0, 0); W.sp.transform.dirty(); }
      if (cabinOn) { Q.fromEuler(swE.transform.rotation, -D.steeringRake * RAD, 0, -PS.steer * PH.SPEC.steering.ratio); swE.transform.dirty(); }
      void dt;
    }
    A.pose = pose;
    /* a point of the body (model metres: x right, y up, z to the rear) in the world */
    A.point = p => V3.transform([0, 0, 0], p, bodyE.transform.world);

    /* ---------- lamps ---------- */
    function lamps(env) {
      const night = clamp(env.night || 0, 0, 1), dark = Math.max(night, (env.wet || 0) > 0.5 ? 0.6 : 0), braking = PS.brake > 0.04 && !(PS.gear < 0 && PS.throttle > 0.05), on = A.out;
      M.drl.emissiveIntensity = on ? 9 + 16 * dark : 0; M.head.emissiveIntensity = on ? 0.15 + 30 * dark : 0; M.tail.emissiveIntensity = on ? 0.5 + 3.5 * dark + (braking ? 16 : 0) : 0; M.chmsl.emissiveIntensity = on && braking ? 22 : 0; M.rev.emissiveIntensity = on && PS.gear < 0 ? 16 : 0;
      M.screen.emissiveIntensity = 0.5 + 0.8 * dark;
      const lit = dark > 0.25 && on; beams.forEach(e => { if (e.active !== lit) e.setActive(lit); if (lit) e.get('Light').intensity = 420 * dark; });
      const gl = on && (dark > 0.25 || braking) && dark > 0.1; if (glowE.active !== gl) glowE.setActive(gl); if (gl) glowE.get('Light').intensity = (braking ? 26 : 5) * dark;
      st.braking = braking; st.lamps = lit;
    }
    /* ---------- smoke, spray and marks ---------- */
    function marks(dt, env) {
      let worst = 0; const wet = clamp(env.wet || 0, 0, 1), V = PS.speed;
      for (let i = 0; i < 4; i++) { const w = PS.wheels[i], o = st.wheels[i], grounded = w.onGround !== false && w.load > 400;
        const sl = grounded && V > 2.5 ? Math.max(smoothstep(0.16, 0.45, Math.abs(w.slip)), smoothstep(0.17, 0.4, Math.abs(w.slipAngle))) : (grounded && Math.abs(w.omega || 0) * WR[i] > 6 && V < 2.5 ? 1 : 0);
        o.sliding = sl; if (sl > worst) worst = sl; const F = fx[i], smokeRate = sl * (1 - wet * 0.85) * (env.onRoad === false ? 0.25 : 1) * 46, sprayRate = wet * smoothstep(4, 40, V) * (i > 1 ? 70 : 34);
        F.smoke.rate = smokeRate; F.smoke.emitting = smokeRate > 1; F.spray.rate = sprayRate; F.spray.emitting = sprayRate > 1;
        /* a mark while the tyre slides on a hard road */
        if (sl > 0.3 && env.onRoad !== false) { const L = SKID.last[i]; if (!L) SKID.last[i] = [o.x, o.z, o.y - WR[i]]; else { const dx = o.x - L[0], dz = o.z - L[1], d = Math.hypot(dx, dz); if (d > 0.3) { if (d < 4) { SKID.list.push([(o.x + L[0]) / 2, (o.y - WR[i] + L[2]) / 2 + 0.018, (o.z + L[1]) / 2, Math.atan2(dx, dz), (i < 2 ? D.twF : D.twR) * 0.82, d + 0.06, 0.35 + 0.65 * sl]); if (SKID.list.length > SKID.max) SKID.list.splice(0, SKID.list.length - SKID.max); SKID.dirty = true; } SKID.last[i] = [o.x, o.z, o.y - WR[i]]; } } }
        else SKID.last[i] = null; }
      st.slide = worst;
      if (SKID.dirty) { SKID.dirty = false; skidIB.clear(); for (const m of SKID.list) skidIB.add(m[0], m[1], m[2], m[3], m[4], 1, m[5], 1, 1, 1, m[6]); if (!skidE.active) skidE.setActive(true); }
      void dt;
    }
    /* ---------- sound: the engine from its speed and the throttle, the tyres when they slide, the wind and the road ---------- */
    let SND = null;
    function soundMake() {
      const au = engine.audio; if (!au || !au.ctx || !au.master || !au.on) return null; const c = au.ctx, out = c.createGain(); out.gain.value = 0; out.connect(au.master);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.7; const eg = c.createGain(); eg.gain.value = 0; lp.connect(eg); eg.connect(out);
      const osc = [['sawtooth', 0.5, 0.5], ['sawtooth', 1, 0.34], ['square', 1.5, 0.1], ['triangle', 0.25, 0.42]].map(([type, mult, g]) => { const o = c.createOscillator(), og = c.createGain(); o.type = type; og.gain.value = g; o.connect(og); og.connect(lp); o.start(); return { o, mult }; });
      const noise = (type, f, q) => { const n = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); n.buffer = au._noise(); n.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; n.connect(fl); fl.connect(g); g.connect(out); n.start(); return { n, fl, g }; };
      return { c, out, lp, eg, osc, wind: noise('lowpass', 520, 0.4), road: noise('bandpass', 170, 0.7), squeal: noise('bandpass', 1250, 7) };
    }
    function sound(live) {
      const au = engine.audio; if (!au || !au.on) { return; } if (!SND || SND.c !== au.ctx) SND = soundMake(); if (!SND) return; const t = SND.c.currentTime, k = 0.05, thr = clamp(PS.throttle, 0, 1), rpm = PS.rpm, f = rpm / 60 * 3, v = PS.speed;
      SND.out.gain.setTargetAtTime(live ? 1 : 0, t, 0.12);
      SND.osc.forEach(o => o.o.frequency.setTargetAtTime(Math.max(12, f * o.mult), t, 0.03));
      SND.lp.frequency.setTargetAtTime(260 + rpm * 0.16 + 2600 * thr * thr, t, k); SND.eg.gain.setTargetAtTime(0.05 + 0.2 * thr + 0.05 * rpm / 7200, t, k);
      SND.wind.g.gain.setTargetAtTime(0.55 * Math.pow(Math.min(1, v / VMAX), 2), t, 0.1); SND.wind.fl.frequency.setTargetAtTime(380 + 900 * v / VMAX, t, 0.2);
      SND.road.g.gain.setTargetAtTime(0.22 * Math.min(1, v / 60), t, 0.1);
      SND.squeal.g.gain.setTargetAtTime(0.28 * st.slide * (1 - 0.7 * st.wet) * (st.onRoad ? 1 : 0.15), t, 0.06); SND.squeal.fl.frequency.setTargetAtTime(1050 + 500 * Math.min(1, v / 50), t, 0.1);
    }
    A.quiet = () => { if (SND) { try { SND.out.gain.setTargetAtTime(0, SND.c.currentTime, 0.1); } catch (e) { /* the sound was closed */ } } };

    /* ---------- one frame ----------
       env: { ground(x, z) -> height of the road or the land there, grip (1 dry), hit(x0, z0, x1, z1, r) -> null or
       { nx, nz, depth }, night 0..1, wet 0..1, onRoad, live (false: parked, nobody at the wheel) }. Returns true while it moves. */
    A.update = (dt, env) => {
      env = env || {}; dt = Math.min(Math.max(dt || 0, 0), 0.1); const I = A.input, P = PH.input, live = env.live !== false;
      let thr = live ? clamp(+I.throttle || 0, 0, 1) : 0, brk = live ? clamp(+I.brake || 0, 0, 1) : (PS.atRest ? 0 : 0.6);
      /* the governor: 251 mph and no more, whatever the slope */
      const over = PS.speed - (VMAX - 0.03); st.governed = over > 0; if (over > 0) { thr = 0; brk = Math.max(brk, clamp(over * 6, 0, 1)); }
      P.throttle = thr; P.brake = brk; P.steer = live ? clamp(+I.steer || 0, -1, 1) : 0; P.handbrake = live ? clamp(+I.handbrake || 0, 0, 1) : (PS.atRest ? 1 : 0); P.reverse = live && !!I.reverse; P.tc = I.tc !== false; P.sc = I.tc !== false;
      const g = env.ground, h = env.hit, px = st.x, pz = st.z;
      const moving = PH.update(dt, { ground: g ? (x, z) => g(x + ox, z + oz) : null, grip: env.grip == null ? 1 : env.grip, hit: h ? (x0, z0, x1, z1, r) => h(x0 + ox, z0 + oz, x1 + ox, z1 + oz, r) : null });
      read(); if (PS.hit) st.hits++; st.odo += Math.hypot(st.x - px, st.z - pz); st.grip = env.grip == null ? 1 : env.grip; st.onRoad = env.onRoad !== false; st.wet = env.wet || 0; st.night = env.night || 0; st.live = live;
      pose(dt); lamps(env); marks(dt, env); chase(dt); sound(live);
      return moving;
    };
    /* ---------- the chase camera's spring: it follows the way the car is going, looks a little into the turn, drops back with speed ---------- */
    function chase(dt) {
      const wrap = a => ((a + 540) % 360) - 180, v = PS.speed, fwd = st.forward; let want = PS.yaw;
      if (v > 4) { const vy = Math.atan2(PS.vx, -PS.vz) * DEG + (fwd < -1 ? 180 : 0); want += clamp(wrap(vy - PS.yaw), -40, 40) * 0.45; }
      want += clamp(st.yawRate * 0.22, -13, 13); const back = fwd < -2.5 ? 180 : 0; cam.look += (back - cam.look) * Math.min(1, dt * 3);
      cam.yaw += wrap(want - cam.yaw) * (1 - Math.exp(-dt * 5.5)); cam.yaw = ((cam.yaw % 360) + 360) % 360;
      cam.pull += (clamp(st.gLong, -1.4, 1.2) * 0.55 - cam.pull) * Math.min(1, dt * 3);
    }
    /* where a camera goes: { pos, yaw, pitch, roll, fov, near }. user: { yaw, pitch, dist } from the pointer; ground(x, z) keeps it out of the land */
    A.view = (kind, user, ground) => {
      const v = PS.speed, k = smoothstep(8, VMAX, v); user = user || { yaw: 0, pitch: -9, dist: 7.2 };
      if (kind === 'bonnet' || kind === 'cockpit') { const p = A.point(kind === 'cockpit' ? D.eye : D.bonnetCam); return { pos: p, yaw: PS.yaw + clamp(user.yaw, -150, 150) + (kind === 'cockpit' ? clamp(PS.steer * DEG * 0.35, -9, 9) : 0), pitch: PS.pitch + clamp(user.pitch + (kind === 'cockpit' ? 6 : 5), -40, 40), roll: -PS.roll, fov: (kind === 'cockpit' ? 72 : 68) + 12 * k, near: kind === 'cockpit' ? 0.1 : 0.16 }; }
      const orbit = kind === 'orbit', yw = (orbit ? user.yaw : cam.yaw + cam.look + user.yaw), pt = clamp(user.pitch, -80, 12), y = yw * RAD, pp = pt * RAD, d = user.dist * (orbit ? 1 : 1 + 0.42 * k) + (orbit ? 0 : cam.pull);
      const fxx = Math.sin(y) * Math.cos(pp), fy = Math.sin(pp), fz = -Math.cos(y) * Math.cos(pp), cx = st.x - fxx * d, cz = st.z - fz * d; let cy = st.y + 1.2 - fy * d; const gy = ground ? ground(cx, cz) : 0; if (cy < gy + 0.4) cy = gy + 0.4;
      return { pos: [cx, cy, cz], yaw: yw, pitch: pt, roll: 0, fov: (orbit ? 55 : 60) + (orbit ? 0 : 17 * k), near: 0.3 };
    };
    A.dispose = () => { root.destroy(); skidE.destroy(); skidIB.dispose(); skidMesh.dispose(); A.meshes.forEach(m => m.dispose()); if (SND) { try { SND.out.disconnect(); } catch (e) { /* gone */ } SND = null; } };
    read(); pose(0);
    return A;
  }
  SE.M3Kit = M3Kit; SE.CarPhysics = CarPhysics; SE.M3Body = M3Body;

