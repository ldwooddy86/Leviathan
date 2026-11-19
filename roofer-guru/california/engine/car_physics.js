/* ============================================================================================
   CarPhysics: a standalone vehicle dynamics model for one drivable car (a black 2027 BMW M3).
   Plain JavaScript, no DOM, no WebGL, no globals. Works in Node and in the browser.

   ENGINE AXES   x east, y up, z south. Heading `yaw` is in degrees, 0 = north (toward -z),
                 increasing clockwise seen from above, so forward = (sin yaw, -cos yaw) in (x, z)
                 and the car's right-hand side = (cos yaw, sin yaw).
   BODY AXES     u = speed forward, v = speed to the right, r = yaw rate, clockwise positive.
                 Steering, slip angles and lateral forces are positive to the right.

   WHERE THE FIGURES COME FROM (full list with URLs and what was opened: car_figures.md)
     S1  BMW Media Information "Specifications. BMW M3 Sedan. M3 Competition with M xDrive", 05/2021
         (opened): length/width/height 4794/1903/1434 mm, wheelbase 2857, track 1617/1605,
         turning circle 12.6 m, kerb weight 1780 kg DIN (1855 EU), cd x A = 0.34 x 2.34,
         375 kW at 6250 rpm, 650 Nm at 2750-5500 rpm, tyres 275/35 ZR19 and 285/30 ZR20,
         gears 5.000 3.200 2.143 1.720 1.313 1.000 0.823 0.640, reverse 3.478, final 3.154,
         steering ratio 14.6, 0-100 km/h 3.5 s, top speed 250 (290) km/h.
     S2  BMW USA "2022 M3 Competition xDrive" release (opened): 3,990 lb, 0-60 mph 3.4 s.
     S3  BMW USA "2021 M3 Sedan and M4 Coupe" release (opened): rear-drive Competition 3,890 lb,
         53.1/46.9 % front/rear, redline 7,200 rpm, 0-60 mph 3.8 s, discs 380/370 mm.
     S4  auto-data.net, 2024 facelift xDrive (opened): 530 PS (390 kW) at 6250, 650 Nm 2750-5730.
     S10-S15 magazine tests (Car and Driver, MotorTrend, Edmunds through secondary reports,
         The Citizen directly): see SPEC.published and car_figures.md.
   ONE FIGURE IS FIXED BY THE USER: top speed 251 mph. A real M3 cannot reach it. The model reaches
   it honestly: when it is built it solves for the engine power that balances this car's real
   drag, rolling resistance, driveline loss and tyre slip at 251 mph in top gear, and multiplies
   the published torque curve by that one factor. The number is written to SPEC.assumed.
   ============================================================================================ */
function CarPhysics(specOverrides) {
  'use strict';
  var PI = Math.PI, DEG = PI / 180, MPH = 0.44704, GRAV = 9.80665;
  var abs = Math.abs, min = Math.min, max = Math.max, sqrt = Math.sqrt, sin = Math.sin, cos = Math.cos,
      tan = Math.tan, atan = Math.atan, atan2 = Math.atan2;
  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function sgn(x) { return x > 0 ? 1 : (x < 0 ? -1 : 0); }
  function num(x, d) { x = +x; return isFinite(x) ? x : d; }
  function merge(dst, src) {
    for (var k in src) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]);
      else dst[k] = src[k];
    }
    return dst;
  }

  /* ------------------------------------------------------------------------------------------
     SPEC: every figure in one object so it can be revised (pass overrides to CarPhysics()).
     SI units unless the name says otherwise. Each line names its source (S1..S15 above) or says
     "assumed"; everything assumed is also listed in words under SPEC.assumed.
     ------------------------------------------------------------------------------------------ */
  var SPEC = {
    name: '2027 BMW M3 (figures of the G80 M3 Competition with M xDrive, 2024 facelift)',
    paint: '#050505',                 // black
    topSpeedMph: 251,                 // FIXED BY THE USER. Not a BMW figure (BMW: 155 mph limited, 180 with M Driver's Package, S1 S2).
    drive: 'awd',                     // 'awd' = M xDrive, rear biased (S2). 'rwd' = rear drive only (the car's own 2WD mode).
    body: {
      length: 4.794, width: 1.903, height: 1.434,   // S1
      wheelbase: 2.857, trackFront: 1.617, trackRear: 1.605,   // S1
      groundClearance: 0.122, turningCircle: 12.6   // S1 (turning circle is the kerb-to-kerb diameter)
    },
    mass: {
      kerb: 1780,                     // kg, DIN unladen, xDrive (S1). US curb weight 3,990 lb = 1810 kg (S2).
      driver: 75,                     // kg, the EU convention: 1855 kg EU - 1780 kg DIN (S1)
      frontFraction: 0.540,           // assumed for xDrive (BMW: "tbd", S2). Rear-drive car published 0.531 (S3).
      cgHeight: 0.51,                 // m, assumed
      yawInertiaFactor: 0.92          // assumed: Izz = factor x mass x a x b
    },
    tyre: {
      front: { width: 275, aspect: 35, rim: 19 },   // 275/35 ZR19 100Y XL (S1)
      rear:  { width: 285, aspect: 30, rim: 20 },   // 285/30 ZR20 99Y XL (S1)
      rollingRadiusFactor: 0.985,     // assumed: rolling radius / radius from the size
      muX: 1.32,                      // assumed peak longitudinal grip at the reference load (tuned to launch and braking figures)
      muY: 1.23,                      // assumed peak lateral grip at the reference load (tuned to the 1.03-1.07 g skidpad figures)
      rearGripFactor: 1.02,           // assumed: the wider rear tyre
      refLoad: 4800,                  // N, load at which muX and muY apply (assumed)
      loadSens: 0.12,                 // assumed: grip falls 12 % for each extra reference load (load sensitivity)
      peakSlip: 0.10,                 // assumed slip ratio at peak longitudinal force
      peakAngleFrontDeg: 9.0,         // assumed slip angle at peak lateral force, front (includes steering compliance)
      peakAngleRearDeg: 7.5,          // assumed, rear
      peakAngleLoadGain: 0.15,        // assumed: peak slip angle grows 15 % per extra reference load
      shapeC: 1.4, shapeCx: 1.55, shapeE: 0.0,   // magic-formula shape factors, lateral and longitudinal, and curvature (assumed, typical dry
                                      // road values: a sliding tyre keeps about 80 % of its peak grip sideways, about 70 % when locked or spinning)
      wetFalloff: 1.5,                // assumed: on a wet road the loss of grip past the peak is this much steeper per unit wetness
      lowSpeed: 1.0,                  // m/s: below this the slip definitions use this speed (keeps them finite at rest)
      rollRes0: 0.010,                // assumed rolling resistance coefficient at low speed
      rollResSpeed: 85,               // m/s, assumed: coefficient = rollRes0 x (1 + (V / rollResSpeed)^2)
      inertiaFront: 1.8, inertiaRear: 2.0   // kg m2 per wheel with tyre and disc, assumed
    },
    engine: {
      tune: 'topSpeed',               // 'topSpeed' = torque curve scaled so the car does exactly SPEC.topSpeedMph (the default).
                                      // 'published' = the published curve, used by the test to compare with magazine figures.
      powerKW: 390, powerRpm: 6250,   // 530 PS at 6250 rpm (S4). 2021-24 cars and the rear-drive car: 375 kW (S1 S3).
      torqueNm: 650, torqueRpmLo: 2750, torqueRpmHi: 5730,   // S4. 2021-24 and rear drive: plateau ends at 5500 (S1).
      redline: 7200,                  // S3
      idle: 800,                      // assumed
      launchRpm: 2800,                // assumed: engine speed held by the converter/clutch on a full-throttle start
      powerAtRedline: 0.93,           // assumed: power at the redline as a fraction of peak
      lowCurve: [[800, 0.50], [1000, 0.55], [1500, 0.72], [2000, 0.86], [2400, 0.96]],   // assumed fraction of peak torque below the plateau
      inertia: 0.25,                  // kg m2, engine and converter, assumed
      frictionNm: 20, frictionPerRpm: 0.0085   // assumed engine braking torque = frictionNm + frictionPerRpm x rpm
    },
    gearbox: {
      ratios: [5.000, 3.200, 2.143, 1.720, 1.313, 1.000, 0.823, 0.640],   // S1 (ZF 8HP76)
      reverse: 3.478, finalDrive: 3.154,   // S1
      efficiencyAwd: 0.90, efficiencyRwd: 0.92,   // assumed
      shiftTime: 0.15, shiftTorque: 0.4,   // assumed: seconds per shift and fraction of torque passed during it
      shiftGap: 0.35,                 // s, least time between shifts (assumed)
      upRpmLow: 1900, upRpmHigh: 7000 // assumed shift schedule: upshift speed at zero and at full throttle
    },
    awd: {
      maxFront: 0.5,                  // the clutch can send at most half the torque forward (assumed)
      rearUse: 0.9,                   // torque goes forward once the rear tyres are at this share of their grip (assumed)
      lag: 0.06                       // s, clutch response (assumed)
    },
    diff: {                           // limited-slip effect. Rear: Active M Differential (S1). Front: open, brake-assisted.
      rearPreload: 80, rearLock: 0.35, rearMax: 2500, rearStiff: 600,   // Nm, fraction of axle torque, Nm, Nm per rad/s (assumed)
      frontPreload: 20, frontLock: 0.10, frontMax: 600, frontStiff: 150 // assumed
    },
    aero: {
      cd: 0.34, area: 2.34,           // S1
      liftFront: -0.02, liftRear: -0.06,   // assumed: a little downforce, more at the rear
      airDensity: 1.225               // kg/m3, standard atmosphere
    },
    brakes: {
      maxDecelG: 1.5,                 // assumed: full pedal asks for this much braking torque (more than the tyres can use)
      frontBias: 0.68,                // assumed share of braking torque on the front axle
      abs: true, absSlip: 0.055, absEfficiency: 0.85, absStiff: 1500, absMinSpeed: 2.5,   // assumed anti-lock behaviour
      handbrakeNm: 3000,              // per rear wheel, assumed (enough to lock them)
      lag: 0.04                       // s, pressure build-up (assumed)
    },
    steering: {
      maxAngleDeg: 30.8,              // mean front wheel angle at full lock, derived from the 12.6 m turning circle (S1), wheelbase and track
      ratio: 14.6,                    // S1 (for a steering wheel animation: wheel angle = ratio x road wheel angle)
      latAccelG: 1.2, latAccelHighG: 0.5,   // full input asks for this lateral acceleration, tapering between 50 and 115 m/s (assumed)
      extraDeg: 2.0,                  // extra angle so full input reaches the tyre's peak (assumed)
      timeIn: 0.22, timeOut: 0.15,    // s for a digital (keyboard) input to reach full range, and to return (assumed)
      maxRateDeg: 80,                 // deg/s at the road wheels, a quick pair of hands (assumed)
      linearity: 1.0,                 // exponent on an analog input; 1.4 gives a finer centre on a gamepad stick
      counterSteerAssist: 0.7         // 0..1: the wheels follow a slide the way a released steering wheel casters into it (assumed)
    },
    suspension: {
      rollStiffFront: 0.58,           // share of roll stiffness at the front (assumed)
      rollGradDeg: 2.6, pitchGradDeg: 1.2,   // body roll and pitch per g (assumed)
      rideHz: 2.0, damping: 0.7,      // body attitude natural frequency and damping ratio (assumed)
      travel: 0.08,                   // m, bump and rebound travel limit used for the drawn wheel travel (assumed)
      loadLag: 0.06                   // s, how quickly weight transfer follows the forces (assumed)
    },
    tc: { slip: 0.09, stiff: 3000, brakeNm: 1500 },   // traction control: target slip, gain, brake torque it may use (assumed)
    sc: { yawGain: 40000, slipGain: 80000, slipDeadband: 0.10, maxBrakeNm: 3500, minSpeed: 5 },   // stability control (assumed)
    collision: { restitution: 0.10, friction: 0.3 },   // wall strikes: bounce and scrape (assumed)
    controls: { autoReverse: false }, // true: holding the brake at rest for 0.4 s selects reverse and swaps the pedals
    sim: { substepHz: 600, maxDt: 0.1 },
    published: {                      // figures the test compares against (sources in car_figures.md)
      awd: { zeroTo60Bmw: 3.4, zeroTo60Rollout: 2.8, zeroTo60Standstill: 3.2, quarter: 11.0, trapMph: 124, brake60Ft: 108, skidpadG: 1.07 },
      rwd: { kerb: 1730, frontFraction: 0.531, powerKW: 375, torqueRpmHi: 5500, zeroTo60Bmw: 3.8, zeroTo60Rollout: 3.5,
             zeroTo100Rollout: 7.6, quarter: 11.6, trapMph: 124, skidpadG: 1.03 }
    },
    assumed: {}                       // filled in below
  };
  merge(SPEC, specOverrides || {});
  SPEC.topSpeedMph = 251;             // the user's fixed figure: an override cannot change it

  /* ---------------------------------- derived constants ---------------------------------- */
  var L = SPEC.body.wheelbase, TF = SPEC.body.trackFront, TR = SPEC.body.trackRear;
  var M = SPEC.mass.kerb + SPEC.mass.driver;
  var FF = SPEC.mass.frontFraction;
  var A = L * (1 - FF), Bq = L * FF;                 // centre of gravity to front axle and to rear axle
  var HCG = SPEC.mass.cgHeight;
  var IZ = SPEC.mass.yawInertiaFactor * M * A * Bq;
  var CG_OFF = L / 2 - A;                            // the centre of gravity is this far ahead of the wheelbase midpoint
  function tyreRadius(t) { return (t.rim * 25.4 / 2 + t.width * t.aspect / 100) / 1000 * SPEC.tyre.rollingRadiusFactor; }
  var RF = tyreRadius(SPEC.tyre.front), RR = tyreRadius(SPEC.tyre.rear);
  // Wheel order everywhere: 0 front left, 1 front right, 2 rear left, 3 rear right.
  var WX = [A, A, -Bq, -Bq], WY = [-TF / 2, TF / 2, -TR / 2, TR / 2];
  var WR = [RF, RF, RR, RR];
  var WI = [SPEC.tyre.inertiaFront, SPEC.tyre.inertiaFront, SPEC.tyre.inertiaRear, SPEC.tyre.inertiaRear];
  var DMAX = SPEC.steering.maxAngleDeg * DEG;
  var NG = SPEC.gearbox.ratios.length;
  var VTOP = SPEC.topSpeedMph * MPH;

  /* -------------------------------------- tyre model --------------------------------------
     A magic-formula curve F(rho) = sin(C atan(B rho - E (B rho - atan(B rho)))) gives the share of
     peak grip used at a combined slip rho. rho is the length of the vector (slip ratio / its peak
     value, tan(slip angle) / its peak value), so pure braking, pure cornering and any mix lie on
     one friction ellipse. B is solved so the peak sits at rho = 1. The shape factor C is blended
     between its lateral and longitudinal values by the direction of the slip, because a locked or
     spinning tyre loses more of its grip than one sliding sideways. */
  var TE_ = SPEC.tyre.shapeE;
  function solveB(C) {
    var target = tan(PI / (2 * C)), lo = 0.1, hi = 50, mid, i;
    for (i = 0; i < 60; i++) { mid = (lo + hi) / 2; if (mid - TE_ * (mid - atan(mid)) < target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  var TC_ = SPEC.tyre.shapeC, TB_ = solveB(TC_), TCX = SPEC.tyre.shapeCx, TBX = solveB(TCX);
  var tyreOut = { Fx: 0, Fy: 0, dFx: 0, Fmax: 0 };
  function tyre(i, kappa, tanA, Fz, grip) {
    var T = SPEC.tyre, o = tyreOut;
    if (Fz <= 1) { o.Fx = 0; o.Fy = 0; o.dFx = 0; o.Fmax = 0; return o; }
    var rel = Fz / T.refLoad - 1;
    var ls = clamp(1 - T.loadSens * rel, 0.75, 1.15) * (i > 1 ? T.rearGripFactor : 1);   // load sensitivity
    var mux = T.muX * grip * ls, muy = T.muY * grip * ls;
    var tanP = tan((i > 1 ? T.peakAngleRearDeg : T.peakAngleFrontDeg) * DEG * (1 + T.peakAngleLoadGain * clamp(rel, -0.5, 1)));
    var sx = kappa / T.peakSlip, sy = tanA / tanP, rho = sqrt(sx * sx + sy * sy);
    o.Fmax = mux * Fz;
    if (rho < 1e-6) { o.Fx = mux * Fz * TBX * TCX * sx; o.Fy = -muy * Fz * TB_ * TC_ * sy; o.dFx = mux * Fz * TBX * TCX / T.peakSlip; return o; }
    var c = sx / rho, s = sy / rho, c2 = c * c, Cc = TC_ + (TCX - TC_) * c2, Bc = TB_ + (TBX - TB_) * c2;
    var x = Bc * rho, inner = x - TE_ * (x - atan(x)), ang = Cc * atan(inner);
    var F = sin(ang), dF = cos(ang) * Cc / (1 + inner * inner) * Bc * (1 - TE_ * x * x / (1 + x * x));
    if (rho > 1 && grip < 1) { var kw = 1 + T.wetFalloff * (1 - grip); F = max(0.3, 1 - (1 - F) * kw); dF *= kw; }   // a wet road lets go more sharply
    o.Fx = mux * Fz * F * c;
    o.Fy = -muy * Fz * F * s;                                    // opposes the sideways motion of the contact patch
    o.dFx = mux * Fz * (dF * c * c + F / rho * s * s) / T.peakSlip;   // slope of Fx against slip ratio, used by the wheel solver
    return o;
  }
  // Understeer gradient (rad per m/s2) of the linear tyre at static load: used by the steering range and by stability control.
  var KUS = (function () {
    var T = SPEC.tyre;
    function stiff(i, Fz) {
      var rel = Fz / T.refLoad - 1, ls = clamp(1 - T.loadSens * rel, 0.75, 1.15) * (i > 1 ? T.rearGripFactor : 1);
      var tanP = tan((i > 1 ? T.peakAngleRearDeg : T.peakAngleFrontDeg) * DEG * (1 + T.peakAngleLoadGain * clamp(rel, -0.5, 1)));
      return T.muY * ls * Fz * TB_ * TC_ / tanP;
    }
    var cf = 2 * stiff(0, M * GRAV * FF / 2), cr = 2 * stiff(2, M * GRAV * (1 - FF) / 2);
    return max(0, M * FF / cf - M * (1 - FF) / cr);
  })();

  /* ------------------------------------ engine torque curve ------------------------------------
     Published: 650 Nm from torqueRpmLo to torqueRpmHi and peak power at powerRpm. Between the end of
     the plateau and the power peak the curve holds power; past the peak power falls to
     powerAtRedline at the redline; below the plateau torque follows lowCurve (assumed shape).
     torqueScale multiplies the whole curve (1 for the published engine). */
  var torqueScale = 1;
  function wotTorque(rpm) {
    var E = SPEC.engine, lc = E.lowCurve, i;
    if (rpm < E.torqueRpmLo) {
      var r0 = lc[0][0], f0 = lc[0][1];
      if (rpm <= r0) return E.torqueNm * f0;
      for (i = 1; i <= lc.length; i++) {
        var r1 = i < lc.length ? lc[i][0] : E.torqueRpmLo, f1 = i < lc.length ? lc[i][1] : 1;
        if (rpm <= r1) return E.torqueNm * (f0 + (f1 - f0) * (rpm - r0) / (r1 - r0));
        r0 = r1; f0 = f1;
      }
    }
    if (rpm <= E.torqueRpmHi) return E.torqueNm;
    var w = rpm * PI / 30, pHi = E.torqueNm * E.torqueRpmHi * PI / 30, pPk = E.powerKW * 1000;
    if (rpm <= E.powerRpm) return (pHi + (pPk - pHi) * (rpm - E.torqueRpmHi) / max(1, E.powerRpm - E.torqueRpmHi)) / w;
    return pPk * (1 - (1 - E.powerAtRedline) * (rpm - E.powerRpm) / max(1, E.redline - E.powerRpm)) / w;
  }
  function peakPowerKW() {
    var best = 0, rpm;
    for (rpm = 1000; rpm <= SPEC.engine.redline; rpm += 10) best = max(best, torqueScale * wotTorque(rpm) * rpm * PI / 30);
    return best / 1000;
  }

  /* ------------------------------------------ state ------------------------------------------ */
  var input = { throttle: 0, brake: 0, steer: 0, handbrake: 0, reverse: false, tc: true, sc: true };
  var state = {
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, vx: 0, vy: 0, vz: 0, speed: 0, mph: 0, rpm: SPEC.engine.idle, gear: 1,
    throttle: 0, brake: 0, steer: 0, wheels: [], g: { long: 0, lat: 0 }, absOn: false, tcOn: false, scOn: false,
    drifting: false, atRest: true, frontShare: 0, hit: false
  };
  (function () { for (var i = 0; i < 4; i++) state.wheels.push({ x: 0, y: 0, z: 0, steer: 0, spin: 0, omega: 0, slip: 0, slipAngle: 0, load: 0, travel: 0, onGround: true }); })();

  var px = 0, pz = 0, psi = 0, u = 0, v = 0, r = 0;          // centre of gravity position, heading (rad), body speeds, yaw rate
  var om = [0, 0, 0, 0], spin = [0, 0, 0, 0];                // wheel speeds (rad/s) and rotation angles
  var Fz = [0, 0, 0, 0], dl = [0, 0, 0, 0], vlo = [0, 0, 0, 0], kap = [0, 0, 0, 0], tanAl = [0, 0, 0, 0];
  var Fx = [0, 0, 0, 0], Fy = [0, 0, 0, 0], dFw = [0, 0, 0, 0], Fmx = [0, 0, 0, 0];
  var Tdem = [0, 0, 0, 0], Tdrv = [0, 0, 0, 0], Tcou = [0, 0, 0, 0], Tvis = [0, 0, 0, 0], Kx = [0, 0, 0, 0], scT = [0, 0, 0, 0];
  var Adiag = [0, 0, 0, 0], rhs = [0, 0, 0, 0], dOm = [0, 0, 0, 0];
  var steerS = 0, delta = 0, thr = 0, brk = 0, hb = 0;
  var gear = 1, shiftT = 0, shiftCool = 0, autoRev = false, autoRevT = 0;
  var axF = 0, ayF = 0;                                      // tyre force per unit mass, lagged: drives weight transfer
  var rollB = 0, rollBd = 0, pitchB = 0, pitchBd = 0;        // body roll and pitch on the suspension, and their rates
  var frontShare = 0, rRef = 0, scCut = 1, rpmShown = SPEC.engine.idle, rpmNow = SPEC.engine.idle;
  var atRest = true, absOn = false, tcOn = false, scOn = false, thrEff = 0, hitFlag = false;
  var grip = 1, hgt = [0, 0, 0, 0], pitchG = 0, rollG = 0, gFwd = 0, gRight = 0, gNorm = GRAV, yRef = 0, haveGround = false, yPlaced = null;
  var netAx = 0;                                             // net forward acceleration of the last sub-step (used by the top-speed solver)

  /* ----------------------------------------- ground -----------------------------------------
     The ground height is sampled under the four wheels once per frame. The front-to-rear and
     left-to-right height differences give the slope the car stands on; gravity is then split
     into a part along the car, a part across it and a part pressing it onto the road. */
  function sampleGround(env) {
    var sp = sin(psi), cp = cos(psi), i, any = env && typeof env.ground === 'function';
    for (i = 0; i < 4; i++) {
      var wx = px + sp * WX[i] + cp * WY[i], wz = pz - cp * WX[i] + sp * WY[i];
      var h = any ? +env.ground(wx, wz) : 0;
      if (isFinite(h)) hgt[i] = h;
      state.wheels[i].x = wx; state.wheels[i].z = wz;
    }
    pitchG = atan2((hgt[0] + hgt[1]) / 2 - (hgt[2] + hgt[3]) / 2, L);            // nose up positive
    rollG = atan2((hgt[0] + hgt[2]) / 2 - (hgt[1] + hgt[3]) / 2, (TF + TR) / 2); // right side low positive
    gFwd = -GRAV * sin(pitchG);
    gRight = GRAV * sin(rollG) * cos(pitchG);
    gNorm = GRAV * cos(pitchG) * cos(rollG);
    yRef = (hgt[0] + hgt[1] + hgt[2] + hgt[3]) / 4;
    haveGround = true;
  }

  /* ------------------------------------- speed-sensitive steering -------------------------------------
     Full input asks for a set lateral acceleration (latAccelG, less at very high speed), turned
     into a road wheel angle with the car's own geometry and understeer gradient, plus a little extra
     to reach the tyre's peak. At parking speeds that is more than full lock, so full lock applies. */
  function steerRange(V) {
    var S = SPEC.steering, t = clamp((V - 50) / 65, 0, 1), f = t * t * (3 - 2 * t);
    var aReq = GRAV * (S.latAccelG - (S.latAccelG - S.latAccelHighG) * f);
    var vv = max(V, 1);
    return min(DMAX, aReq * (L / (vv * vv) + KUS) + S.extraDeg * DEG * (1 - 0.7 * f));
  }

  /* --------------------------------- one axle's two wheel speeds ---------------------------------
     Solves the left and right wheel speeds at the end of a sub-step. The tyre force, the
     traction-control and anti-lock terms and the limited-slip coupling are taken at the end of the
     step (implicitly), which keeps the stiff wheel dynamics stable at any speed, including rest.
     inertiaB is the engine and gearbox inertia seen through the gears, shared by the two wheels.
     Friction-brake torque (Tcou) is dry friction: it opposes the wheel's rotation and can stop a
     wheel but never turn it backwards, so a wheel it would reverse is held at exactly zero. */
  function solveAxle(iL, iR, inertiaB, Taxle, pre, lock, tmax, stiff, h) {
    var dw = om[iL] - om[iR], Tl = stiff * dw, lim = min(tmax, pre + lock * abs(Taxle)), C = h * stiff;
    if (Tl > lim) { Tl = lim; C = 0; } else if (Tl < -lim) { Tl = -lim; C = 0; }   // the differential's clutches slip beyond their locking torque
    var a11 = Adiag[iL] + inertiaB + C, a22 = Adiag[iR] + inertiaB + C, a12 = inertiaB - C;
    var b1 = rhs[iL] - h * Tl, b2 = rhs[iR] + h * Tl, det = a11 * a22 - a12 * a12;
    var w1 = om[iL] + (b1 * a22 - a12 * b2) / det, w2 = om[iR] + (a11 * b2 - a12 * b1) / det;   // without the friction brakes
    var T1 = Tcou[iL], T2 = Tcou[iR];
    if (T1 > 0 || T2 > 0) {
      var s1 = sgn(w1), s2 = sgn(w2), c1 = b1 - h * T1 * s1, c2 = b2 - h * T2 * s2;
      w1 = om[iL] + (c1 * a22 - a12 * c2) / det; w2 = om[iR] + (a11 * c2 - a12 * c1) / det;
      var k1 = T1 > 0 && w1 * s1 <= 0, k2 = T2 > 0 && w2 * s2 <= 0;
      if (k1 && !k2) { w1 = 0; w2 = om[iR] + (c2 + a12 * om[iL]) / a22; k2 = T2 > 0 && w2 * s2 <= 0; }
      else if (k2 && !k1) { w2 = 0; w1 = om[iL] + (c1 + a12 * om[iR]) / a11; k1 = T1 > 0 && w1 * s1 <= 0; }
      if (k1) w1 = 0;
      if (k2) w2 = 0;
    }
    dOm[iL] = w1 - om[iL]; dOm[iR] = w2 - om[iR];
  }

  /* ============================================ one sub-step ============================================
     dyno = true holds the body speed fixed (used once, when the car is built, to find the power for 251 mph). */
  function step(h, dyno) {
    var T = SPEC.tyre, E = SPEC.engine, GB = SPEC.gearbox, BR = SPEC.brakes, i;

    /* 1. Driver inputs. Pedals get a short lag (pedal travel, pressure build-up). */
    var thIn = clamp(num(input.throttle, 0), 0, 1), brIn = clamp(num(input.brake, 0), 0, 1), hbIn = clamp(num(input.handbrake, 0), 0, 1);
    var wantRev = !!input.reverse;
    if (SPEC.controls.autoReverse && !wantRev) {
      // Optional game convention: hold the brake at rest to back up. The pedals swap while reversing.
      if (!autoRev) {
        autoRevT = (abs(u) < 0.3 && brIn > 0.5 && thIn < 0.05) ? autoRevT + h : 0;
        if (autoRevT > 0.4) autoRev = true;
      } else if (abs(u) < 0.3 && thIn > 0.1 && brIn < 0.05) { autoRev = false; autoRevT = 0; }
      if (autoRev) { wantRev = true; var sw = thIn; thIn = brIn; brIn = sw; }
    }
    if (dyno) { thr = 1; brk = 0; hb = 0; }
    else {
      thr += (thIn - thr) * min(1, h / 0.06);
      brk += (brIn - brk) * min(1, h / BR.lag);
      hb += (hbIn - hb) * min(1, h / 0.05);
    }
    if (!dyno) {
      if (wantRev && gear > 0 && u < 1.0) { gear = -1; shiftT = 0; }       // reverse engages only when nearly stopped
      else if (!wantRev && gear < 0 && u > -1.0) { gear = 1; shiftT = 0; }
    }
    var dir = gear < 0 ? -1 : 1;
    var V = sqrt(u * u + v * v);

    /* 2. Steering: rate-limited input (so a key press ramps in), speed-sensitive range, and a term
          that turns the wheels into a slide in proportion to the rear axle's slip angle. */
    if (!dyno) {
      var S = SPEC.steering, sIn = clamp(num(input.steer, 0), -1, 1);
      sIn = sgn(sIn) * Math.pow(abs(sIn), S.linearity);
      var away = abs(sIn) > abs(steerS) && sIn * steerS >= 0;
      var ds = sIn - steerS, dsMax = h / (away ? S.timeIn : S.timeOut);
      steerS += clamp(ds, -dsMax, dsMax);
      var assist = 0;
      if (u > 3 && S.counterSteerAssist > 0) {
        var bRear = atan2(v - Bq * r, u), ex = abs(bRear) - 0.04;
        if (ex > 0) assist = S.counterSteerAssist * sgn(bRear) * ex * clamp((u - 3) / 3, 0, 1);
      }
      var dTarget = clamp(steerS * steerRange(abs(u)) + assist, -DMAX, DMAX), dMax = S.maxRateDeg * DEG * h;
      delta += clamp(dTarget - delta, -dMax, dMax);
    }
    // Ackermann geometry: the inner wheel turns more than the outer so both roll about one centre.
    if (abs(delta) > 1e-5) {
      var rt = L / tan(abs(delta)), dIn = atan(L / max(0.5, rt - TF / 2)), dOut = atan(L / (rt + TF / 2));
      if (delta > 0) { dl[1] = dIn; dl[0] = dOut; } else { dl[0] = -dIn; dl[1] = -dOut; }
    } else { dl[0] = delta; dl[1] = delta; }

    /* 3. Wheel loads: static split, plus aerodynamic load, plus longitudinal and lateral weight
          transfer from the centre of gravity height, wheelbase and track. The transfer is driven by
          the tyre forces themselves, so drag at speed and gravity on a slope are included. */
    var q = 0.5 * SPEC.aero.airDensity * SPEC.aero.area * V * V;
    var downF = -SPEC.aero.liftFront * q, downR = -SPEC.aero.liftRear * q;
    var transL = M * axF * HCG / L;
    var FzF = max(0, M * gNorm * FF - transL + downF), FzRr = max(0, M * gNorm * (1 - FF) + transL + downR);
    var lam = SPEC.suspension.rollStiffFront;
    var tLatF = M * ayF * HCG * lam / TF, tLatR = M * ayF * HCG * (1 - lam) / TR;
    Fz[0] = clamp(FzF / 2 + tLatF, 0, FzF); Fz[1] = FzF - Fz[0];
    Fz[2] = clamp(FzRr / 2 + tLatR, 0, FzRr); Fz[3] = FzRr - Fz[2];

    /* 4. Contact patch speeds, slip ratio, slip angle and tyre forces for each wheel. */
    for (i = 0; i < 4; i++) {
      var vxb = u - r * WY[i], vyb = v + r * WX[i], cd = cos(dl[i]), sd = sin(dl[i]);
      var vl = vxb * cd + vyb * sd, vt = -vxb * sd + vyb * cd, vden = max(abs(vl), T.lowSpeed);
      vlo[i] = vl;
      kap[i] = (om[i] * WR[i] - vl) / vden;
      tanAl[i] = vt / vden;
      var o = tyre(i, kap[i], tanAl[i], Fz[i], grip);
      Fx[i] = o.Fx; Fy[i] = o.Fy; Fmx[i] = o.Fmax;
      dFw[i] = max(0, o.dFx) * WR[i] / vden;                 // slope of Fx against wheel speed
    }

    /* 5. Gearbox: automatic shifting. Upshift speed rises with throttle (redline at full throttle).
          Downshift, several gears at once if needed, whenever a lower gear would still sit below
          85 % of the upshift speed: at full throttle that is the kickdown. */
    var gearRatio = gear < 0 ? GB.reverse : GB.ratios[gear - 1];
    var wCar = (om[2] + om[3]) / 2;                           // rear differential carrier speed
    if (!dyno && gear > 0) {
      shiftCool -= h;
      if (shiftCool <= 0) {
        var rpmD = abs(wCar) * gearRatio * GB.finalDrive * 30 / PI;
        var up = GB.upRpmLow + (GB.upRpmHigh - GB.upRpmLow) * Math.pow(thr, 1.5), ng = gear, g2;
        // Like the real gearbox, hold the gear in a hard corner or while the driven wheels spin: no early upshift mid-slide.
        if (abs(ayF) > 0.45 * GRAV || kap[2] > 0.2 || kap[3] > 0.2) up = max(up, GB.upRpmHigh - 100);
        if (rpmD >= up && gear < NG && brk < 0.05 && rpmD * GB.ratios[gear] / gearRatio >= 1150) ng = gear + 1;
        else {
          var dn = brk > 0.3 ? max(0.85 * up, 3800) : 0.85 * up;   // keep the revs up when braking for a corner
          for (g2 = gear - 1; g2 >= 1; g2--) { if (rpmD * GB.ratios[g2 - 1] / gearRatio < dn) ng = g2; else break; }
        }
        if (ng !== gear) { gear = ng; shiftT = GB.shiftTime; shiftCool = GB.shiftGap; gearRatio = GB.ratios[gear - 1]; }
      }
    }
    if (shiftT > 0) shiftT -= h;

    /* 6. Engine and clutch. Below the launch speed the converter slips: the engine sits at the launch
          speed for the throttle given and passes its torque on (no creep at zero throttle). Above it
          the engine is locked to the rear axle and adds its inertia and its braking torque. */
    var Gt = dir * gearRatio * GB.finalDrive;                 // engine turns per wheel turn, negative in reverse
    var eta = SPEC.drive === 'awd' ? GB.efficiencyAwd : GB.efficiencyRwd;
    var wDrive = Gt * wCar, wLaunch = (E.idle + (E.launchRpm - E.idle) * thr) * PI / 30;
    var open = hb > 0.3;                                      // pulling the handbrake frees the driveline
    var locked = !open && wDrive >= wLaunch;
    var we = locked ? wDrive : wLaunch, rpm = we * 30 / PI;
    rpmNow = rpm;
    var lim = clamp((E.redline - rpm) / 120, 0, 1);           // rev limiter
    var Twot = torqueScale * wotTorque(rpm), Tfr = E.frictionNm + E.frictionPerRpm * rpm;
    var Te = locked ? thr * Twot * lim - (1 - thr * lim) * Tfr : thr * Twot;
    if (Te > 0) { if (shiftT > 0) Te *= GB.shiftTorque; Te *= scCut; }
    if (open) Te = 0;
    var Tout = Te * Gt * (Te > 0 ? eta : 1);                  // torque at the axles, signed (negative drives backwards)
    var inertiaB = locked ? E.inertia * Gt * Gt / 4 : 0;

    /* 7. All-wheel drive: the rear axle is driven directly; a clutch sends forward the torque the
          rear tyres cannot use (up to half), with a short lag. Rear drive: nothing goes forward. */
    var shareT = 0;
    if (SPEC.drive === 'awd' && Te > 0) {
      var latUse = min(1, abs(ayF) / (T.muY * grip * GRAV));
      var cap = SPEC.awd.rearUse * T.muX * grip * (Fz[2] + Fz[3]) * RR * sqrt(max(0.2, 1 - 0.5 * latUse * latUse));
      shareT = clamp((abs(Tout) - cap) / max(1, abs(Tout)), 0, SPEC.awd.maxFront);
    }
    frontShare += (shareT - frontShare) * min(1, h / SPEC.awd.lag);
    var over = dir * ((om[0] + om[1]) / 2 * RF - wCar * RR);  // a clutch cannot push the front axle faster than the rear
    var Tfront = Te > 0 ? Tout * frontShare * clamp(1 - over / 0.6, 0, 1) : 0, Trear = Tout - Tfront;
    Tdem[0] = Tdem[1] = Tfront / 2; Tdem[2] = Tdem[3] = Trear / 2;

    /* 8. Stability control: compares the yaw rate with what the steering asks for and the body's
          slip angle with a limit, then brakes one wheel to turn the car back (outer front against
          oversteer, inner rear against understeer) and trims engine torque. */
    var scOnNow = false, Mreq = 0;
    if (!dyno && input.sc !== false && u > SPEC.sc.minSpeed && hb < 0.05) {
      var muEst = T.muY * grip, rss = clamp(u * delta / (L + KUS * u * u), -0.95 * muEst * GRAV / u, 0.95 * muEst * GRAV / u);
      rRef += (rss - rRef) * min(1, h / 0.10);
      var e = r - rRef, db = 0.03 + 0.08 * abs(rRef), ee = abs(e) > db ? e - sgn(e) * db : 0;
      var beta = atan2(v, u), bb = abs(beta) > SPEC.sc.slipDeadband ? beta - sgn(beta) * SPEC.sc.slipDeadband : 0;
      Mreq = -SPEC.sc.yawGain * ee + SPEC.sc.slipGain * bb;    // corrective yaw moment wanted, clockwise positive
    } else rRef = r;
    var scW = -1, scTq = 0;
    if (Mreq !== 0) {
      var overs = Mreq * r < 0 || abs(r) < 0.02;              // the correction opposes the turn: the car is oversteering
      scW = Mreq > 0 ? (overs ? 1 : 3) : (overs ? 0 : 2);     // right-side wheels turn the car clockwise
      scTq = min(SPEC.sc.maxBrakeNm, abs(Mreq) * WR[scW] / (TF / 2));
      scOnNow = scTq > 50;
    }
    for (i = 0; i < 4; i++) scT[i] += ((i === scW ? scTq : 0) - scT[i]) * min(1, h / 0.04);
    scCut += ((1 - min(0.85, abs(Mreq) / 6000)) - scCut) * min(1, h / 0.05);
    scOn = scOnNow;

    /* 9. Brakes. Pedal torque is split front/rear by the bias. Anti-lock: above walking pace each
          wheel's torque is capped so the wheel is held near the slip of peak grip; the cap rises as
          the wheel speeds up and falls as it slows, which is what a pressure modulator does.
          Traction control does the same for drive torque. The handbrake works the rear wheels only. */
    var Tbmax = BR.maxDecelG * M * GRAV * (RF + RR) / 2, absNow = false, tcNow = false, sumDrv = 0, sumDem = 0;
    var latU = min(1, abs(ayF) / (T.muY * grip * GRAV));
    var tcSlip = SPEC.tc.slip * (1 - 0.5 * latU), tcFF = 0.98 * (1 - 0.4 * latU * latU);
    for (i = 0; i < 4; i++) {
      var front = i < 2, vd = max(abs(vlo[i]), T.lowSpeed);
      var Treq = brk * Tbmax * (front ? BR.frontBias : 1 - BR.frontBias) / 2 + scT[i];
      Tcou[i] = front ? 0 : hb * BR.handbrakeNm; Tvis[i] = 0; Kx[i] = 0; Tdrv[i] = Tdem[i];
      if (Treq > 0) {
        if (BR.abs && abs(vlo[i]) > BR.absMinSpeed) {
          var sv = sgn(vlo[i]), wt = abs(vlo[i]) * (1 - BR.absSlip) / WR[i];
          var Tl = max(0, BR.absEfficiency * Fmx[i] * WR[i] + BR.absStiff * (sv * om[i] - wt));
          if (Treq > Tl) { Tvis[i] = -sv * Tl; if (Tl > 0) Kx[i] += BR.absStiff; absNow = absNow || brk > 0.05; }
          else Tcou[i] += Treq;
        } else Tcou[i] += Treq;
      }
      if (!dyno && input.tc !== false && dir * Tdem[i] > 1) {
        var wtt = (dir * vlo[i] + tcSlip * vd) / WR[i];
        var Tlim = tcFF * Fmx[i] * WR[i] + SPEC.tc.stiff * (wtt - dir * om[i]), floor = Tlim < -SPEC.tc.brakeNm;
        if (floor) Tlim = -SPEC.tc.brakeNm;
        if (dir * Tdem[i] > Tlim) { Tdrv[i] = dir * Tlim; if (!floor) Kx[i] += SPEC.tc.stiff; if (Tlim < 0.95 * dir * Tdem[i]) tcNow = true; }
      }
      sumDrv += dir * Tdrv[i]; sumDem += dir * Tdem[i];
    }
    absOn = absNow; tcOn = tcNow;
    thrEff = sumDem > 1 ? thr * clamp(sumDrv / sumDem, 0, 1) * (shiftT > 0 ? GB.shiftTorque : 1) * scCut : thr * (Te > 0 ? 1 : 0);

    /* 10. Standing still. A slip-based tyre cannot hold a car at rest (it needs sliding to make
           force), so rest is handled as true static friction: when the car is all but stopped and
           the brakes, the rolling resistance and the tyres can together balance gravity on the slope
           and whatever drive torque is applied, every speed is set to exactly zero and the car does
           not move until that stops being true. This is what prevents creep and jitter. */
    var crr = T.rollRes0 * (1 + (V / T.rollResSpeed) * (V / T.rollResSpeed));
    if (!dyno && V < 0.10 && abs(r) < 0.05) {
      var needL = -M * gFwd, needT = -M * gRight, fmin = 0, fmaxS = 0, cap2 = 0, held = true;
      for (i = 0; i < 4; i++) {
        var hold = Tcou[i] + crr * Fz[i] * WR[i];             // brake and handbrake torque plus rolling resistance hold this wheel
        if (abs(Tdem[i]) > hold || abs(om[i] * WR[i]) > 0.3) { held = false; break; }
        var fcap = T.muX * grip * Fz[i];
        fmin += clamp((Tdem[i] - hold) / WR[i], -fcap, fcap);
        fmaxS += clamp((Tdem[i] + hold) / WR[i], -fcap, fcap);
        cap2 += T.muY * grip * Fz[i];
      }
      if (held && needL >= fmin && needL <= fmaxS && abs(needT) <= 0.95 * cap2) {
        u = 0; v = 0; r = 0; om[0] = om[1] = om[2] = om[3] = 0; atRest = true; netAx = 0;
        var kf = min(1, h / SPEC.suspension.loadLag);
        axF += (needL / M - axF) * kf; ayF += (needT / M - ayF) * kf;      // the tyres carry the slope force
        attitude(h);
        rpmShown += (rpm - rpmShown) * min(1, h / 0.08);
        return;
      }
    }
    atRest = false;

    /* 11. Wheel speeds. Each wheel: drive torque, tyre reaction, the anti-lock or traction term,
           then the two wheels of an axle are solved together with the limited-slip coupling and,
           at the rear, the engine's inertia. Friction-brake torque can stop a wheel but never turn it
           backwards (a locked wheel stays exactly locked). */
    for (i = 0; i < 4; i++) {
      Adiag[i] = WI[i] + h * WR[i] * dFw[i] + h * Kx[i];
      rhs[i] = h * (Tdrv[i] + Tvis[i] - WR[i] * Fx[i]);
    }
    var D = SPEC.diff;
    solveAxle(0, 1, 0, Tfront, D.frontPreload, D.frontLock, D.frontMax, D.frontStiff, h);
    solveAxle(2, 3, inertiaB, Trear, D.rearPreload, D.rearLock, D.rearMax, D.rearStiff, h);
    var sumFX = 0, sumFY = 0, Mz = 0;
    for (i = 0; i < 4; i++) {
      var wNew = om[i] + dOm[i];
      var fx = clamp(Fx[i] + dFw[i] * (wNew - om[i]), -Fmx[i], Fmx[i]);   // the force that goes with the new wheel speed
      om[i] = wNew;
      spin[i] += wNew * h; if (spin[i] > 1e4 || spin[i] < -1e4) spin[i] %= 2 * PI;
      Fx[i] = fx;
      // Rolling resistance acts along the wheel, against its motion, and fades smoothly to nothing at rest.
      var fxr = fx - crr * Fz[i] * Math.tanh(vlo[i] / 0.25);
      var c2 = cos(dl[i]), s2 = sin(dl[i]), FXb = fxr * c2 - Fy[i] * s2, FYb = fxr * s2 + Fy[i] * c2;
      sumFX += FXb; sumFY += FYb; Mz += WX[i] * FYb - WY[i] * FXb;
    }

    /* 12. The body: tyre forces, aerodynamic drag (0.5 rho cd A V^2 against the motion) and gravity
           along the slope accelerate the rigid chassis forward, sideways and in yaw. */
    var drag = SPEC.aero.cd * q, dragX = V > 1e-6 ? -drag * u / V : 0, dragY = V > 1e-6 ? -drag * v / V : 0;
    var ax = (sumFX + dragX) / M + gFwd, ay = (sumFY + dragY) / M + gRight;
    netAx = ax;
    var kf2 = min(1, h / SPEC.suspension.loadLag);
    axF += (sumFX / M - axF) * kf2; ayF += (sumFY / M - ayF) * kf2;
    if (!dyno) {
      u += ax * h; v += ay * h;
      var ang = r * h, ca = cos(ang), sa = sin(ang), u2 = u * ca + v * sa;      // the body axes turn with the car
      v = -u * sa + v * ca; u = u2;
      r += Mz / IZ * h;
      psi += r * h;
      var sp = sin(psi), cp = cos(psi), cpi = cos(pitchG), cro = cos(rollG);
      px += (sp * u * cpi + cp * v * cro) * h;
      pz += (-cp * u * cpi + sp * v * cro) * h;
    }
    attitude(h);
    rpmShown += (rpm - rpmShown) * min(1, h / 0.08);
  }

  /* Body roll and pitch on the springs: quasi-static angles (degrees per g) reached through a damped
     second-order response so the body leans and settles rather than snapping. For drawing only. */
  function attitude(h) {
    var Sx = SPEC.suspension, wn = 2 * PI * Sx.rideHz, z = Sx.damping;
    var rollT = -Sx.rollGradDeg * DEG * ayF / GRAV, pitchT = Sx.pitchGradDeg * DEG * axF / GRAV;
    rollBd += (wn * wn * (rollT - rollB) - 2 * z * wn * rollBd) * h; rollB += rollBd * h;
    pitchBd += (wn * wn * (pitchT - pitchB) - 2 * z * wn * pitchBd) * h; pitchB += pitchBd * h;
  }

  /* --------------------------- the power needed for the fixed top speed ---------------------------
     Holds the car at exactly SPEC.topSpeedMph in top gear on level ground at full throttle, lets
     the wheels and weight transfer settle, and reads the net forward force. The torque scale is
     adjusted until that force is zero: drag + rolling resistance = thrust. The result is the
     engine the car needs; it is reported in SPEC.assumed. */
  function resetDynamic() {
    u = v = r = 0; om[0] = om[1] = om[2] = om[3] = 0; steerS = delta = thr = brk = hb = 0; gear = 1; shiftT = shiftCool = 0;
    axF = ayF = 0; rollB = rollBd = pitchB = pitchBd = 0; frontShare = 0; rRef = 0; scCut = 1; atRest = true;
    autoRev = false; autoRevT = 0; scT[0] = scT[1] = scT[2] = scT[3] = 0; rpmShown = rpmNow = SPEC.engine.idle;
    absOn = tcOn = scOn = false; thrEff = 0; netAx = 0;
  }
  function dynoAccel(scale) {
    var i, h = 1 / SPEC.sim.substepHz, acc = 0, n = 0;
    resetDynamic(); torqueScale = scale; grip = 1; gFwd = 0; gRight = 0; gNorm = GRAV; pitchG = rollG = 0;
    u = VTOP; gear = NG; for (i = 0; i < 4; i++) om[i] = VTOP / WR[i];
    for (i = 0; i < 900; i++) { step(h, true); if (i >= 600) { acc += netAx; n++; } }
    return acc / n;
  }
  var topGearRpm = VTOP / RR * SPEC.gearbox.ratios[NG - 1] * SPEC.gearbox.finalDrive * 30 / PI;
  var gearingNote = 'Top gear at ' + SPEC.topSpeedMph + ' mph turns the engine at about ' + Math.round(topGearRpm) +
    ' rpm, under the ' + SPEC.engine.redline + ' rpm redline, so the published gears and final drive allow it.';
  if (topGearRpm > 0.97 * SPEC.engine.redline) {
    // Only if a revised SPEC makes the gearing too short: lengthen the final drive so top speed falls at the power peak.
    var fdOld = SPEC.gearbox.finalDrive;
    SPEC.gearbox.finalDrive = fdOld * SPEC.engine.powerRpm / topGearRpm;
    gearingNote = 'The gearing in SPEC was too short for ' + SPEC.topSpeedMph + ' mph; the final drive was lengthened from ' +
      fdOld + ' to ' + SPEC.gearbox.finalDrive.toFixed(3) + '.';
  }
  var publishedPeakKW = peakPowerKW();
  if (SPEC.engine.tune === 'topSpeed') {
    var k0 = 1, k1 = 3, f0 = dynoAccel(k0), f1 = dynoAccel(k1), it, k2, f2;
    for (it = 0; it < 30 && abs(f1) > 1e-6; it++) {
      k2 = clamp(k1 - f1 * (k1 - k0) / (f1 - f0 || 1e-9), 0.2, 20); f2 = dynoAccel(k2);
      k0 = k1; f0 = f1; k1 = k2; f1 = f2;
    }
    torqueScale = k1;
  } else torqueScale = 1;
  (function () {
    var q = 0.5 * SPEC.aero.airDensity * SPEC.aero.area * VTOP * VTOP;
    var pk = peakPowerKW();
    SPEC.assumed = {
      topSpeedPower: {
        peakKW: Math.round(pk), peakHp: Math.round(pk / 0.7457), peakPS: Math.round(pk / 0.7355),
        peakTorqueNm: Math.round(torqueScale * SPEC.engine.torqueNm), torqueScale: +torqueScale.toFixed(4),
        publishedPeakKW: Math.round(publishedPeakKW), dragKWatTopSpeed: Math.round(SPEC.aero.cd * q * VTOP / 1000),
        active: SPEC.engine.tune === 'topSpeed',
        note: SPEC.engine.tune === 'topSpeed'
          ? 'ASSUMED. The user fixed top speed at ' + SPEC.topSpeedMph + ' mph. Aerodynamic drag alone at that speed (cd x A = ' + SPEC.aero.cd + ' x ' + SPEC.aero.area +
            ' m2, air ' + SPEC.aero.airDensity + ' kg/m3) takes ' + Math.round(SPEC.aero.cd * q * VTOP / 1000) + ' kW at the wheels; with rolling resistance, driveline loss and tyre slip the engine must make ' +
            Math.round(pk) + ' kW (' + Math.round(pk / 0.7457) + ' hp) at its peak, against ' + Math.round(publishedPeakKW) + ' kW published. The published torque curve is multiplied by ' +
            torqueScale.toFixed(3) + ' (peak torque ' + Math.round(torqueScale * SPEC.engine.torqueNm) + ' Nm); rev range, gears and final drive are unchanged.'
          : 'Published engine in use (SPEC.engine.tune = "published"): the car will not reach ' + SPEC.topSpeedMph + ' mph.'
      },
      gearing: gearingNote,
      list: [
        'engine power for the fixed top speed (see topSpeedPower)',
        'air density 1.225 kg/m3 (standard atmosphere)',
        'rolling resistance 0.010 rising with speed squared (tyre.rollRes0, tyre.rollResSpeed)',
        'driveline efficiency 0.90 all-wheel drive, 0.92 rear drive',
        'front weight fraction 0.540 for xDrive (BMW publishes 53.1 % for the rear-drive car only)',
        'driver 75 kg, centre of gravity height 0.51 m, yaw inertia 0.92 m a b',
        'wheel and engine inertias, tyre rolling radius factor 0.985',
        'all tyre friction and curve-shape numbers (SPEC.tyre), tuned to the published skidpad, braking and launch figures',
        'roll stiffness split, roll and pitch gradients, ride frequency (SPEC.suspension)',
        'a little downforce: lift coefficients -0.02 front, -0.06 rear',
        'brake torque, 68 % front bias, anti-lock and handbrake numbers (SPEC.brakes)',
        'idle and launch speed, torque below 2750 rpm, power between 6250 and 7200 rpm',
        'shift time, shift schedule, all-wheel-drive clutch and differential numbers',
        'steering range, rates and counter-steer assist (the 30.8 degree lock is derived from the published turning circle)',
        'traction and stability control gains, wall bounce and scrape'
      ]
    };
  })();

  /* ----------------------------------------- outputs ----------------------------------------- */
  function writeState() {
    var sp = sin(psi), cp = cos(psi), i, w, Sx = SPEC.suspension;
    var q = 0.5 * SPEC.aero.airDensity * SPEC.aero.area * (u * u + v * v);
    var heave = (SPEC.aero.liftFront + SPEC.aero.liftRear) * q / (M * Math.pow(2 * PI * Sx.rideHz, 2));
    state.x = px - sp * CG_OFF; state.z = pz + cp * CG_OFF;              // wheelbase midpoint at ground level
    state.y = (haveGround ? yRef : (yPlaced === null ? 0 : yPlaced)) + heave;
    state.yaw = psi / DEG;
    state.pitch = (pitchG + pitchB) / DEG;                               // degrees, nose up positive
    state.roll = (rollG + rollB) / DEG;                                  // degrees, right side down positive
    var cpi = cos(pitchG), cro = cos(rollG);
    state.vx = sp * u * cpi + cp * v * cro; state.vz = -cp * u * cpi + sp * v * cro;
    state.vy = u * sin(pitchG) - v * sin(rollG);
    state.speed = sqrt(u * u + v * v); state.mph = state.speed / MPH;
    state.forwardSpeed = u; state.yawRate = r / DEG;
    state.rpm = rpmShown; state.gear = gear; state.throttle = thrEff; state.brake = brk; state.steer = delta;
    state.g.long = atRest ? 0 : netAx / GRAV; state.g.lat = atRest ? 0 : (ayF + gRight) / GRAV;
    state.absOn = absOn && !atRest; state.tcOn = tcOn && !atRest; state.scOn = scOn && !atRest; state.atRest = atRest;
    state.frontShare = frontShare; state.hit = hitFlag;
    var bRear = abs(u) > 4 ? atan2(v - Bq * r, abs(u)) : 0;
    state.slipAngleRear = bRear;
    state.drifting = state.drifting ? abs(bRear) > 0.07 : abs(bRear) > 0.12;   // rear axle sliding more than about 7 degrees
    for (i = 0; i < 4; i++) {
      w = state.wheels[i];
      w.x = px + sp * WX[i] + cp * WY[i]; w.z = pz - cp * WX[i] + sp * WY[i];
      w.y = hgt[i] + WR[i];
      w.steer = i < 2 ? dl[i] : 0; w.spin = spin[i]; w.omega = om[i];
      w.slip = atRest ? 0 : kap[i]; w.slipAngle = atRest ? 0 : atan(tanAl[i]);
      w.load = Fz[i]; w.onGround = Fz[i] > 20;
      w.travel = clamp(-(heave + WX[i] * tan(pitchB) - WY[i] * tan(rollB)), -Sx.travel, Sx.travel);   // metres, compression positive
    }
  }

  /* ----------------------------------------- walls -----------------------------------------
     Three circles (nose, middle, tail) are swept from where they were at the start of the frame to
     where they are now. A hit pushes the car out along the wall normal and takes away the speed
     into the wall at that point (with a small bounce), which also turns the car when the nose or
     tail strikes at an angle. A little of the sliding speed along the wall is lost too. */
  var CR = SPEC.body.width / 2, COFF = [SPEC.body.length / 2 - CR, 0, -(SPEC.body.length / 2 - CR)];
  var cx0 = [0, 0, 0], cz0 = [0, 0, 0];
  function circleStart() {
    var sp = sin(psi), cp = cos(psi), i;
    for (i = 0; i < 3; i++) { var d = COFF[i] - CG_OFF; cx0[i] = px + sp * d; cz0[i] = pz - cp * d; }
  }
  function collide(env) {
    var i, pass, any = false;
    for (pass = 0; pass < 2; pass++) for (i = 0; i < 3; i++) {
      var sp = sin(psi), cp = cos(psi), d = COFF[i] - CG_OFF, x1 = px + sp * d, z1 = pz - cp * d;
      var hit = env.hit(cx0[i], cz0[i], x1, z1, CR);
      if (!hit) continue;
      var nx = +hit.nx, nz = +hit.nz, depth = +hit.depth, nl = sqrt(nx * nx + nz * nz);
      if (!isFinite(nl) || nl < 1e-9 || !isFinite(depth) || depth <= 0) continue;
      nx /= nl; nz /= nl; depth = min(depth, 20);
      px += nx * depth; pz += nz * depth; any = true;
      cx0[i] = x1 + nx * depth; cz0[i] = z1 + nz * depth;     // the sweep of a second pass starts from the corrected place
      var vwx = sp * u + cp * v, vwz = -cp * u + sp * v;       // velocity of the centre of gravity, world axes
      var vpx = vwx + cp * r * d, vpz = vwz + sp * r * d;      // velocity of the circle's centre
      var vn = vpx * nx + vpz * nz;
      if (vn < 0) {
        var lever = d * (nx * cp + nz * sp);                   // yaw moment arm of a push along the normal
        var J = -(1 + SPEC.collision.restitution) * vn / (1 / M + lever * lever / IZ);
        vwx += nx * J / M; vwz += nz * J / M; r += lever * J / IZ;
        var tx = -nz, tz = nx, vtan = vwx * tx + vwz * tz, Jt = clamp(-vtan * M, -SPEC.collision.friction * J, SPEC.collision.friction * J);
        vwx += tx * Jt / M; vwz += tz * Jt / M;
        u = vwx * sp - vwz * cp; v = vwx * cp + vwz * sp;
        r = clamp(r, -6, 6);
      }
    }
    if (any) {
      // The wheels are set rolling at the car's new speed so the tyres do not fight the bounce.
      for (i = 0; i < 4; i++) om[i] = ((u - r * WY[i]) * cos(dl[i]) + (v + r * WX[i]) * sin(dl[i])) / WR[i];
      atRest = false;
    }
    return any;
  }

  /* ------------------------------------------ interface ------------------------------------------ */
  // Put the car at rest. (x, z) is the wheelbase midpoint, yaw in degrees, y optional (used until the ground is known).
  function place(x, z, yaw, y) {
    resetDynamic();
    psi = num(yaw, 0) * DEG;
    px = num(x, 0) + sin(psi) * CG_OFF; pz = num(z, 0) - cos(psi) * CG_OFF;
    yPlaced = (y === undefined || y === null) ? null : num(y, 0);
    haveGround = false; pitchG = rollG = 0; gFwd = gRight = 0; gNorm = GRAV;
    hgt[0] = hgt[1] = hgt[2] = hgt[3] = yPlaced === null ? 0 : yPlaced; yRef = hgt[0];
    spin[0] = spin[1] = spin[2] = spin[3] = 0; hitFlag = false; state.drifting = false;
    Fz[0] = Fz[1] = M * GRAV * FF / 2; Fz[2] = Fz[3] = M * GRAV * (1 - FF) / 2;
    writeState();
  }
  // Advance by dt seconds (one frame). Returns true while the car is moving.
  function update(dt, env) {
    env = env || {};
    dt = num(dt, 0);
    if (dt <= 0) { writeState(); return !atRest; }
    dt = min(dt, SPEC.sim.maxDt);
    grip = clamp(num(env.grip, 1), 0.05, 1.2);                // wetness factor from outside: 1 dry, 0.35 soaked
    if (!haveGround) sampleGround(env);
    var n = clamp(Math.ceil(dt * SPEC.sim.substepHz - 1e-9), 1, 80), h = dt / n, i;
    var canHit = typeof env.hit === 'function';
    if (canHit) circleStart();
    for (i = 0; i < n; i++) step(h, false);
    hitFlag = canHit && !atRest ? collide(env) : false;
    if (!(isFinite(px) && isFinite(pz) && isFinite(psi) && isFinite(u) && isFinite(v) && isFinite(r))) {
      // Last line of defence: never hand NaN to the renderer. Stop the car where it last was.
      px = state.x; pz = state.z; psi = state.yaw * DEG; if (!isFinite(px)) px = 0; if (!isFinite(pz)) pz = 0; if (!isFinite(psi)) psi = 0;
      resetDynamic();
    }
    if (!atRest || hitFlag) sampleGround(env);
    writeState();
    return !atRest;
  }

  place(0, 0, 0);
  return {
    SPEC: SPEC, state: state, input: input, place: place, update: update,
    steerRange: function (speed) { return steerRange(abs(num(speed, abs(u)))); },   // rad at the road wheels for full steering input
    torqueAt: function (rpm) { return torqueScale * wotTorque(rpm); },              // full-throttle engine torque, Nm
    derived: { mass: M, cgToFront: A, cgToRear: Bq, yawInertia: IZ, radiusFront: RF, radiusRear: RR, understeerGradient: KUS,
               torqueScale: torqueScale, peakPowerKW: peakPowerKW(), topGearRpmAtTopSpeed: topGearRpm }
  };
}
if (typeof module !== 'undefined') module.exports = { CarPhysics };
