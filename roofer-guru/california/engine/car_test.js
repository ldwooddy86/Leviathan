/* Node test for car_physics.js. Run:  node car_test.js
   Drives the model through each manoeuvre at 60 frames a second, prints what it measured next to the
   published figure, and asserts. Every state number is checked for NaN after every frame of every test.
   Exit code 0 only if every assertion passes. */
'use strict';
const { CarPhysics } = require('./car_physics.js');
const MPH = 0.44704, G = 9.80665, DEG = Math.PI / 180, FT = 0.3048, DT = 1 / 60;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const f = (x, n) => (x === null || x === undefined || !isFinite(x)) ? String(x) : x.toFixed(n === undefined ? 2 : n);
const pct = (a, b) => ((a / b - 1) * 100 >= 0 ? '+' : '') + ((a / b - 1) * 100).toFixed(1) + '%';

let passed = 0, failed = 0, frames = 0, nanSeen = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) passed++; else { failed++; failures.push(name + (detail ? '  [' + detail + ']' : '')); }
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   (' + detail + ')' : ''));
}
function section(t) { console.log('\n=== ' + t + ' ==='); }
function finite(car) {
  const s = car.state, keys = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'vx', 'vy', 'vz', 'speed', 'mph', 'rpm', 'gear', 'throttle', 'brake', 'steer'];
  for (const k of keys) if (!Number.isFinite(s[k])) return false;
  if (!Number.isFinite(s.g.long) || !Number.isFinite(s.g.lat)) return false;
  for (const w of s.wheels) for (const k of ['x', 'y', 'z', 'steer', 'spin', 'omega', 'slip', 'slipAngle', 'load', 'travel']) if (!Number.isFinite(w[k])) return false;
  return true;
}
// One frame: update, count it, check every number.
function tick(car, env, dt) {
  const moving = car.update(dt || DT, env);
  frames++;
  if (!finite(car)) nanSeen++;
  return moving;
}
const flat = grip => ({ ground: () => 0, grip: grip === undefined ? 1 : grip });
function setIn(car, o) { Object.assign(car.input, { throttle: 0, brake: 0, steer: 0, handbrake: 0, reverse: false, tc: true, sc: true }, o || {}); }
const dist = car => Math.hypot(car.state.x, car.state.z);

// The three cars used. PUB_AWD and PUB_RWD carry the published engine so they can be compared with magazine tests.
const PUB = CarPhysics().SPEC.published;
const mkTop = o => CarPhysics(o);                                       // the car as delivered: engine sized for 251 mph
const mkPubAwd = () => CarPhysics({ engine: { tune: 'published' } });   // current M3 Competition xDrive: 390 kW, 1780 kg
const mkPubRwd = () => CarPhysics({ drive: 'rwd', engine: { tune: 'published', powerKW: PUB.rwd.powerKW, torqueRpmHi: PUB.rwd.torqueRpmHi },
  mass: { kerb: PUB.rwd.kerb, frontFraction: PUB.rwd.frontFraction } }); // rear-drive M3 Competition: 375 kW, 1730 kg, 53.1 % front

/* ---------------------------------------------------------------- 0. the car */
section('0. The car and the power assumed for 251 mph');
const top = mkTop();
{
  const a = top.SPEC.assumed.topSpeedPower;
  console.log('  ' + top.SPEC.name);
  console.log('  mass with driver ' + top.derived.mass + ' kg, cd x A ' + top.SPEC.aero.cd + ' x ' + top.SPEC.aero.area + ' m2, tyre radius front/rear ' + f(top.derived.radiusFront, 4) + '/' + f(top.derived.radiusRear, 4) + ' m');
  console.log('  ' + a.note);
  console.log('  ' + top.SPEC.assumed.gearing);
  console.log('  understeer gradient of the linear tyre model: ' + f(top.derived.understeerGradient * G / DEG, 2) + ' deg/g');
  check('SPEC.topSpeedMph is 251 and cannot be overridden', top.SPEC.topSpeedMph === 251 && CarPhysics({ topSpeedMph: 300 }).SPEC.topSpeedMph === 251);
  check('power for 251 mph is recorded in SPEC.assumed', a.peakKW > 600 && a.peakKW < 1100 && /ASSUMED/.test(a.note), a.peakKW + ' kW, ' + a.peakHp + ' hp, ' + a.peakTorqueNm + ' Nm');
  check('published gearing allows 251 mph below the redline', top.derived.topGearRpmAtTopSpeed < top.SPEC.engine.redline, f(top.derived.topGearRpmAtTopSpeed, 0) + ' rpm in 8th');
}

/* ---------------------------------------------------------------- 1. acceleration */
function accelRun(car, seconds, opts) {
  car.place(0, 0, 0); setIn(car, Object.assign({ throttle: 1 }, opts || {}));
  const env = flat(); let t = 0; const r = { t60: null, t100: null, tq: null, trap: 0, tRoll: null, vmax: 0, maxSlip: 0, tcSeen: false, t30: null };
  while (t < seconds) {
    tick(car, env); t += DT; const s = car.state, d = dist(car);
    if (r.tRoll === null && d >= FT) r.tRoll = t;
    if (r.t30 === null && s.mph >= 30) r.t30 = t;
    if (r.t60 === null && s.mph >= 60) r.t60 = t;
    if (r.t100 === null && s.mph >= 100) r.t100 = t;
    if (r.tq === null && d >= 402.336) { r.tq = t; r.trap = s.mph; }
    r.vmax = Math.max(r.vmax, s.mph); r.maxSlip = Math.max(r.maxSlip, s.wheels[2].slip, s.wheels[3].slip); r.tcSeen = r.tcSeen || s.tcOn;
    if (r.tq !== null && r.t100 !== null && seconds < 60) break;
  }
  return r;
}
section('1. Acceleration at the PUBLISHED power, against published figures (within about 10 %)');
console.log('  Car and Driver and MotorTrend time from a one-foot rollout; BMW and Edmunds from a standstill. Both are printed.');
{
  const a = accelRun(mkPubAwd(), 30), P = PUB.awd;
  console.log('  M3 Competition xDrive, 390 kW, 1855 kg with driver:');
  console.log('    0-60 mph   ' + f(a.t60) + ' s from rest, ' + f(a.t60 - a.tRoll) + ' s with rollout   | published ' + P.zeroTo60Standstill + ' s from rest (Edmunds), ' + P.zeroTo60Bmw + ' s (BMW), ' + P.zeroTo60Rollout + ' s rollout (Car and Driver)');
  console.log('    0-100 mph  ' + f(a.t100) + ' s from rest, ' + f(a.t100 - a.tRoll) + ' s with rollout   | no published xDrive figure found in a source that could be opened');
  console.log('    1/4 mile   ' + f(a.tq) + ' s from rest, ' + f(a.tq - a.tRoll) + ' s with rollout at ' + f(a.trap, 1) + ' mph   | published ' + P.quarter + ' s at ' + P.trapMph + ' mph (Car and Driver), 11.1 at 124 (Edmunds), 11.1 at 124.7 (MotorTrend)');
  check('xDrive 0-60 from rest within 10 % of Edmunds 3.2 s', Math.abs(a.t60 / P.zeroTo60Standstill - 1) <= 0.10, f(a.t60) + ' s, ' + pct(a.t60, P.zeroTo60Standstill));
  check('xDrive 0-60 with rollout within 12 % of Car and Driver 2.8 s', Math.abs((a.t60 - a.tRoll) / P.zeroTo60Rollout - 1) <= 0.12, f(a.t60 - a.tRoll) + ' s, ' + pct(a.t60 - a.tRoll, P.zeroTo60Rollout));
  check('xDrive quarter mile (rollout) within 10 % of 11.0 s', Math.abs((a.tq - a.tRoll) / P.quarter - 1) <= 0.10, f(a.tq - a.tRoll) + ' s, ' + pct(a.tq - a.tRoll, P.quarter));
  check('xDrive trap speed within 10 % of 124 mph', Math.abs(a.trap / P.trapMph - 1) <= 0.10, f(a.trap, 1) + ' mph, ' + pct(a.trap, P.trapMph));
  check('xDrive 0-100 mph plausible (6 to 8 s)', a.t100 > 6 && a.t100 < 8, f(a.t100) + ' s');

  const b = accelRun(mkPubRwd(), 30), Q = PUB.rwd;
  console.log('  M3 Competition rear drive, 375 kW, 1805 kg with driver:');
  console.log('    0-60 mph   ' + f(b.t60) + ' s from rest, ' + f(b.t60 - b.tRoll) + ' s with rollout   | published ' + Q.zeroTo60Bmw + ' s (BMW, from rest), ' + Q.zeroTo60Rollout + ' s rollout (Car and Driver, MotorTrend)');
  console.log('    0-100 mph  ' + f(b.t100) + ' s from rest, ' + f(b.t100 - b.tRoll) + ' s with rollout   | published ' + Q.zeroTo100Rollout + ' s rollout (Car and Driver)');
  console.log('    1/4 mile   ' + f(b.tq) + ' s from rest, ' + f(b.tq - b.tRoll) + ' s with rollout at ' + f(b.trap, 1) + ' mph   | published ' + Q.quarter + ' s at ' + Q.trapMph + ' mph (Car and Driver), 11.58 s at 125.0 mph (The Citizen)');
  check('rear-drive 0-60 from rest within 10 % of BMW 3.8 s', Math.abs(b.t60 / Q.zeroTo60Bmw - 1) <= 0.10, f(b.t60) + ' s, ' + pct(b.t60, Q.zeroTo60Bmw));
  check('rear-drive 0-100 (rollout) within 10 % of 7.6 s', Math.abs((b.t100 - b.tRoll) / Q.zeroTo100Rollout - 1) <= 0.10, f(b.t100 - b.tRoll) + ' s, ' + pct(b.t100 - b.tRoll, Q.zeroTo100Rollout));
  check('rear-drive quarter mile (rollout) within 10 % of 11.6 s', Math.abs((b.tq - b.tRoll) / Q.quarter - 1) <= 0.10, f(b.tq - b.tRoll) + ' s, ' + pct(b.tq - b.tRoll, Q.quarter));
  check('rear-drive trap speed within 10 % of 124 mph', Math.abs(b.trap / Q.trapMph - 1) <= 0.10, f(b.trap, 1) + ' mph, ' + pct(b.trap, Q.trapMph));

  const c = accelRun(mkTop(), 30);
  console.log('  The car as delivered (' + top.SPEC.assumed.topSpeedPower.peakKW + ' kW for 251 mph), all-wheel drive, traction control on:');
  console.log('    0-60 ' + f(c.t60) + ' s (' + f(c.t60 - c.tRoll) + ' rollout), 0-100 ' + f(c.t100) + ' s (' + f(c.t100 - c.tRoll) + '), 1/4 mile ' + f(c.tq) + ' s (' + f(c.tq - c.tRoll) + ') at ' + f(c.trap, 1) + ' mph');
  check('251-mph engine is quicker than the published engine everywhere', c.t60 < a.t60 && c.t100 < a.t100 && c.tq < a.tq && c.trap > a.trap);
}

/* ---------------------------------------------------------------- 2. top speed */
section('2. Top speed on a long level straight (fixed by the user: 251 mph, within 1 mph, and no more)');
let topCar = mkTop();
{
  topCar.place(0, 0, 0); setIn(topCar, { throttle: 1 });
  const env = flat(); let t = 0, vmax = 0, t200 = null, t250 = null, d250 = 0, lastMinute = 0, xDev = 0;
  while (t < 240) {
    tick(topCar, env); t += DT; const s = topCar.state; vmax = Math.max(vmax, s.mph);
    if (t200 === null && s.mph >= 200) t200 = t;
    if (t250 === null && s.mph >= 250) { t250 = t; d250 = dist(topCar); }
    if (t > 180) lastMinute = Math.max(lastMinute, s.mph);
    xDev = Math.max(xDev, Math.abs(s.x));
  }
  const s = topCar.state;
  console.log('  reached ' + f(vmax, 2) + ' mph; speed after 240 s ' + f(s.mph, 2) + ' mph in gear ' + s.gear + ' at ' + f(s.rpm, 0) + ' rpm; 200 mph in ' + f(t200, 1) + ' s, 250 mph in ' + f(t250, 1) + ' s and ' + f(d250 / 1000, 2) + ' km; distance run ' + f(dist(topCar) / 1000, 1) + ' km');
  check('top speed is 251 mph within 1 mph', Math.abs(vmax - 251) <= 1, f(vmax, 2) + ' mph');
  check('and no more: speed in the last minute never above 252 mph', lastMinute <= 252 && s.mph >= 250, f(lastMinute, 2) + ' mph');
  check('ran straight at top speed (sideways drift under 1 cm)', xDev < 0.01, f(xDev, 5) + ' m');
  const p = mkPubAwd(); p.place(0, 0, 0); setIn(p, { throttle: 1 }); let vp = 0; for (t = 0; t < 150; t += DT) { tick(p, env); vp = Math.max(vp, p.state.mph); }
  console.log('  for comparison the published 390 kW engine, with no speed limiter, tops out at ' + f(vp, 1) + ' mph in this model (BMW limits the real car to 155 or 180 mph)');
  check('published engine cannot reach 251 mph (the extra power is really needed)', vp < 215, f(vp, 1) + ' mph');
}

/* ---------------------------------------------------------------- 3. stability at 250 mph */
section('3. At 251 mph: a steering tap, 60 frames a second');
{
  const env = flat(); let t, maxYr = 0, maxSlipA = 0;
  setIn(topCar, { throttle: 1, steer: 0.3 }); for (t = 0; t < 0.2; t += DT) tick(topCar, env);
  setIn(topCar, { throttle: 1 });
  for (t = 0; t < 6; t += DT) { tick(topCar, env); maxYr = Math.max(maxYr, Math.abs(topCar.state.yawRate)); maxSlipA = Math.max(maxSlipA, Math.abs(topCar.state.slipAngleRear)); }
  console.log('  peak yaw rate ' + f(maxYr, 2) + ' deg/s, peak rear slip angle ' + f(maxSlipA / DEG, 2) + ' deg, yaw rate 6 s later ' + f(topCar.state.yawRate, 4) + ' deg/s, speed ' + f(topCar.state.mph, 1) + ' mph');
  check('settles after a steering tap at top speed', Math.abs(topCar.state.yawRate) < 0.05 && maxSlipA < 3 * DEG && topCar.state.mph > 240, 'yaw rate ' + f(topCar.state.yawRate, 4) + ' deg/s');
}

/* ---------------------------------------------------------------- 4. braking */
function brakeTest(car, grip, dt, fromMph) {
  const env = flat(grip); car.place(0, 0, 0); setIn(car, { throttle: 1 }); let t = 0; fromMph = fromMph || 60;
  while (car.state.mph < fromMph + 3 && t < 60) { tick(car, env, dt); t += dt || DT; }
  setIn(car, {}); while (car.state.mph > fromMph && t < 90) { tick(car, env, dt); t += dt || DT; }
  const d0 = dist(car), v0 = car.state.mph; setIn(car, { brake: 1 }); let tb = 0, abs = false, gmax = 0, moving = true, yawDev = 0;
  while (moving && tb < 30) { moving = tick(car, env, dt); tb += dt || DT; abs = abs || car.state.absOn; gmax = Math.max(gmax, -car.state.g.long); yawDev = Math.max(yawDev, Math.abs(wrap(car.state.yaw * DEG))); }
  return { d: dist(car) - d0, v0, tb, abs, gmax, yawDev, rest: !moving };
}
section('4. Braking 60-0 mph (published: 108 ft, Edmunds 2025 xDrive)');
let dryBrake;
{
  const b = dryBrake = brakeTest(mkTop(), 1);
  console.log('  dry: ' + f(b.d, 2) + ' m = ' + f(b.d / FT, 1) + ' ft from ' + f(b.v0, 1) + ' mph in ' + f(b.tb, 2) + ' s, peak ' + f(b.gmax, 2) + ' g, mean ' + f(Math.pow(b.v0 * MPH, 2) / (2 * b.d) / G, 2) + ' g, anti-lock ' + (b.abs ? 'worked' : 'idle'));
  check('60-0 within 10 % of 108 ft', Math.abs(b.d / FT / PUB.awd.brake60Ft - 1) <= 0.10, f(b.d / FT, 1) + ' ft, ' + pct(b.d / FT, PUB.awd.brake60Ft));
  check('anti-lock active and no wheel left locked above walking pace; car stays straight and comes fully to rest', b.abs && b.rest && b.yawDev < 0.5 * DEG, 'heading change ' + f(b.yawDev / DEG, 3) + ' deg');
  const b30 = brakeTest(mkTop(), 1, 1 / 30), b120 = brakeTest(mkTop(), 1, 1 / 120);
  console.log('  same stop stepped at 30 and 120 frames a second: ' + f(b30.d / FT, 1) + ' ft and ' + f(b120.d / FT, 1) + ' ft');
  check('result does not depend on the frame rate (within 3 %)', Math.abs(b30.d / b.d - 1) < 0.03 && Math.abs(b120.d / b.d - 1) < 0.03);
  const noAbs = brakeTest(CarPhysics({ brakes: { abs: false } }), 1);
  console.log('  with anti-lock removed (wheels lock): ' + f(noAbs.d / FT, 1) + ' ft');
  check('anti-lock shortens the stop', noAbs.d > b.d);
  const b150 = brakeTest(mkTop(), 1, DT, 150);
  console.log('  150-0 mph: ' + f(b150.d, 1) + ' m in ' + f(b150.tb, 2) + ' s');
  check('150-0 mph stop is straight and complete', b150.rest && b150.yawDev < 0.5 * DEG && b150.d > 160 && b150.d < 240, f(b150.d, 1) + ' m');
}

/* ---------------------------------------------------------------- 5. wet grip */
section('5. Wet road (grip factor from outside)');
{
  const w6 = brakeTest(mkTop(), 0.6), w35 = brakeTest(mkTop(), 0.35);
  console.log('  60-0 mph: dry ' + f(dryBrake.d / FT, 1) + ' ft, grip 0.6 ' + f(w6.d / FT, 1) + ' ft, grip 0.35 ' + f(w35.d / FT, 1) + ' ft');
  check('wet braking is longer, roughly in proportion to the grip factor', w6.d > 1.4 * dryBrake.d && w6.d < 2.0 * dryBrake.d && w35.d > 2.3 * dryBrake.d && w35.d < 3.6 * dryBrake.d,
    'x' + f(w6.d / dryBrake.d, 2) + ' and x' + f(w35.d / dryBrake.d, 2));
  check('wet stops stay straight and finish at rest', w6.rest && w35.rest && w6.yawDev < DEG && w35.yawDev < DEG);
  const a = accelRun(mkTop(), 12), b = (() => { const c = mkTop(); c.place(0, 0, 0); setIn(c, { throttle: 1 }); const env = flat(0.5); let t = 0, t60 = null; while (t < 20 && t60 === null) { tick(c, env); t += DT; if (c.state.mph >= 60) t60 = t; } return t60; })();
  console.log('  0-60 mph: dry ' + f(a.t60) + ' s, grip 0.5 ' + f(b) + ' s');
  check('wet launch is slower', b > 1.5 * a.t60);
}

/* ---------------------------------------------------------------- 6. skidpad and understeer */
// Drives a clockwise circle of the given radius, raising speed slowly, with a steering controller on the path error.
function circleRun(car, R, grip, opts) {
  opts = opts || {}; const env = flat(grip); car.place(0, 0, 0); setIn(car, opts.inputs);
  const cx = R, cz = 0, L = car.SPEC.body.wheelbase; let t = 0, integ = 0, vT = 2, thrI = 0;
  const rows = []; let maxG = 0, vAtMax = 0, maxRearSlip = 0, spun = false, win = [];
  while (t < 400) {
    const s = car.state, dx = s.x - cx, dz = s.z - cz, rad = Math.hypot(dx, dz), e = rad - R;
    const phi = Math.atan2(dx, -dz), psiE = wrap(s.yaw * DEG - (phi + Math.PI / 2));
    const u = s.forwardSpeed, ay = u * u / R;
    integ = clamp(integ + e * DT * 0.004, -0.1, 0.1);
    const dDes = L / R + car.derived.understeerGradient * ay + 0.02 * e - 0.9 * psiE + integ;
    car.input.steer = clamp(dDes / car.steerRange(u), -1, 1);
    vT = Math.min(vT + (opts.rate || 0.25) * DT, opts.vMax || 60);
    const ev = vT - u; thrI = clamp(thrI + ev * DT * 0.15, 0, 1);
    car.input.throttle = clamp(0.25 * ev + thrI, 0, 1); car.input.brake = 0;
    tick(car, env); t += DT;
    const gLat = s.speed * Math.abs(s.yawRate * DEG) / G;
    win.push(gLat); if (win.length > 120) win.shift();
    const mean = win.reduce((a, b) => a + b, 0) / win.length;
    if (Math.abs(e) < 1.5 && win.length === 120 && mean > maxG) { maxG = mean; vAtMax = s.mph; }
    maxRearSlip = Math.max(maxRearSlip, Math.abs(s.slipAngleRear));
    if (Math.abs(s.slipAngleRear) > 35 * DEG) spun = true;
    rows.push({ t, g: gLat, steer: s.steer, e, mph: s.mph, rear: s.slipAngleRear });
    if (e > 4 || vT - u > 4 || spun) break;
  }
  return { rows, maxG, vAtMax, maxRearSlip, spun, endErr: rows[rows.length - 1].e };
}
function steerAt(rows, g) { const sel = rows.filter(r => Math.abs(r.g - g) < 0.02 && Math.abs(r.e) < 1); return sel.length ? sel.reduce((a, r) => a + r.steer, 0) / sel.length : NaN; }
section('6. Steady cornering on a 100 m radius circle (published skidpad: 1.03 g Car and Driver, 1.07 g Edmunds)');
{
  const c = circleRun(mkTop(), 100, 1);
  const ack = top.SPEC.body.wheelbase / 100 / DEG;
  console.log('  greatest steady lateral acceleration held on the line: ' + f(c.maxG, 3) + ' g at ' + f(c.vAtMax, 1) + ' mph');
  check('cornering grip near the published skidpad (0.98 to 1.12 g)', c.maxG >= 0.98 && c.maxG <= 1.12, f(c.maxG, 3) + ' g');
  console.log('  steering needed as speed rises (geometric angle for this circle is ' + f(ack, 2) + ' deg):');
  const gs = [0.2, 0.4, 0.6, 0.8, 0.9, 1.0], st = gs.map(g => steerAt(c.rows, g) / DEG);
  gs.forEach((g, i) => console.log('    ' + f(g, 1) + ' g  (' + f(Math.sqrt(g * G * 100) / MPH, 1) + ' mph)   road wheel angle ' + f(st[i], 2) + ' deg'));
  const grad = (st[2] - st[0]) / 0.4, gradHi = (st[4] - st[3]) / 0.1;
  console.log('  understeer gradient ' + f(grad, 2) + ' deg/g between 0.2 and 0.6 g, rising to ' + f(gradHi, 2) + ' deg/g between 0.8 and 0.9 g');
  check('understeers: steering angle rises with speed, gently at first and faster near the limit', grad > 0.1 && grad < 3 && gradHi > grad && st[0] > ack * 0.9 && st[4] > st[2] && st[2] > st[0],
    f(grad, 2) + ' then ' + f(gradHi, 2) + ' deg/g');
  console.log('  at the limit the car ran wide by ' + f(c.endErr, 1) + ' m with the rear slip angle never above ' + f(c.maxRearSlip / DEG, 1) + ' deg');
  check('limit behaviour is understeer (runs wide, does not spin)', !c.spun && c.maxRearSlip < 12 * DEG);
  const w = circleRun(mkTop(), 100, 0.6);
  console.log('  same circle with grip 0.6: ' + f(w.maxG, 3) + ' g');
  check('wet cornering grip is lower, roughly in proportion', w.maxG < 0.72 * c.maxG && w.maxG > 0.5 * c.maxG, 'x' + f(w.maxG / c.maxG, 2));
}

/* ---------------------------------------------------------------- 7. step steer */
function holdSpeed(car, vTarget, st) { const ev = vTarget - car.state.forwardSpeed; st.i = clamp((st.i || 0) + ev * DT * 0.2, 0, 1); car.input.throttle = clamp(0.3 * ev + st.i, 0, 1); }
function toSpeed(car, env, v) { const st = {}; let t = 0; while (t < 60 && (Math.abs(car.state.forwardSpeed - v) > 0.15 || t < 6)) { holdSpeed(car, v, st); tick(car, env); t += DT; } return st; }
section('7. Step steer at 60 mph');
{
  const car = mkTop(), env = flat(), v = 60 * MPH; car.place(0, 0, 0); setIn(car);
  const st = toSpeed(car, env, v);
  const dWant = 0.4 * G * (car.SPEC.body.wheelbase / (v * v) + car.derived.understeerGradient), sIn = dWant / car.steerRange(v);
  const yr = []; let t;
  for (t = 0; t < 6; t += DT) { car.input.steer = sIn; holdSpeed(car, v, st); tick(car, env); yr.push(car.state.yawRate); }
  const last = yr.slice(-60), mean = last.reduce((a, b) => a + b, 0) / 60, sd = Math.sqrt(last.reduce((a, b) => a + (b - mean) * (b - mean), 0) / 60);
  const peak = Math.max.apply(null, yr), t90 = yr.findIndex(x => x >= 0.9 * mean) * DT, gSS = car.state.speed * mean * DEG / G;
  console.log('  steering input ' + f(sIn, 3) + ' (' + f(car.state.steer / DEG, 2) + ' deg at the wheels): yaw rate settles at ' + f(mean, 2) + ' deg/s (' + f(gSS, 2) + ' g), peak ' + f(peak, 2) + ' deg/s (overshoot ' + f((peak / mean - 1) * 100, 1) + ' %), 90 % in ' + f(t90, 2) + ' s, ripple over the last second ' + f(sd, 4) + ' deg/s');
  check('step steer settles to a steady turn, no divergence', mean > 3 && sd < 0.02 * mean && peak < 1.5 * mean && Math.abs(car.state.slipAngleRear) < 5 * DEG && gSS > 0.25 && gSS < 0.6);
}

/* ---------------------------------------------------------------- 8. lane change */
function laneChange(car, mph, opts) {
  const env = flat(opts && opts.grip), v = mph * MPH; car.place(0, 0, 0); setIn(car, opts && opts.inputs);
  const st = toSpeed(car, env, v); const d0 = dist(car), W = 3.5, LEN = (opts && opts.len) || 80, Tp = 0.6;
  const path = d => d <= 0 ? 0 : (d >= LEN ? W : W * 0.5 * (1 - Math.cos(Math.PI * d / LEN)));
  const r = { maxRear: 0, maxYr: 0, maxX: 0, sc: false, minMph: 1e9 }; let t;
  for (t = 0; t < 8; t += DT) {
    const s = car.state, d = -s.z - d0 - 30, u = s.forwardSpeed, psi = wrap(s.yaw * DEG);
    const err = path(d + u * Tp) - (s.x + Math.sin(psi) * u * Tp);
    car.input.steer = clamp(0.012 * err / car.steerRange(u), -1, 1);
    holdSpeed(car, v, st); tick(car, env);
    r.maxRear = Math.max(r.maxRear, Math.abs(s.slipAngleRear)); r.maxYr = Math.max(r.maxYr, Math.abs(s.yawRate)); r.maxX = Math.max(r.maxX, s.x); r.sc = r.sc || s.scOn; r.minMph = Math.min(r.minMph, s.mph);
  }
  r.endX = car.state.x; r.endYaw = wrap(car.state.yaw * DEG) / DEG; r.endYr = car.state.yawRate; r.W = W; return r;
}
section('8. Lane change at 100 mph, stability control on (3.5 m across in 80 m)');
{
  const a = laneChange(mkTop(), 100);
  console.log('  peak yaw rate ' + f(a.maxYr, 1) + ' deg/s, peak rear slip angle ' + f(a.maxRear / DEG, 2) + ' deg, overshoot ' + f(a.maxX - a.W, 2) + ' m, ends ' + f(a.endX - a.W, 3) + ' m off the new lane centre, heading ' + f(a.endYaw, 3) + ' deg, yaw rate ' + f(a.endYr, 3) + ' deg/s, stability control ' + (a.sc ? 'stepped in' : 'not needed'));
  check('stays stable: small slip angle, settles in the new lane', a.maxRear < 5 * DEG && a.maxX - a.W < 0.7 && Math.abs(a.endX - a.W) < 0.15 && Math.abs(a.endYaw) < 0.3 && Math.abs(a.endYr) < 0.3);
  const b = laneChange(mkTop(), 100, { len: 45 });
  console.log('  violent version (3.5 m in 45 m): peak rear slip ' + f(b.maxRear / DEG, 2) + ' deg, overshoot ' + f(b.maxX - b.W, 2) + ' m, ends ' + f(b.endX - b.W, 3) + ' m off, stability control ' + (b.sc ? 'stepped in' : 'not needed'));
  check('violent lane change at 100 mph still recovers', b.maxRear < 10 * DEG && Math.abs(b.endX - b.W) < 0.5 && Math.abs(b.endYr) < 1);
  const w = laneChange(mkTop(), 100, { grip: 0.5 });
  console.log('  on a wet road (grip 0.5): peak rear slip ' + f(w.maxRear / DEG, 2) + ' deg, ends ' + f(w.endX - w.W, 3) + ' m off, stability control ' + (w.sc ? 'stepped in' : 'not needed'));
  check('wet lane change at 100 mph stays stable', w.maxRear < 10 * DEG && Math.abs(w.endX - w.W) < 0.6 && Math.abs(w.endYr) < 1.5);
}

/* ---------------------------------------------------------------- 9. traction control off, rear drive */
section('9. Full throttle from rest, traction control off, rear-drive mode');
{
  const run = (tc, kick) => {
    const car = mkTop({ drive: 'rwd' }), env = flat(); car.place(0, 0, 0); setIn(car, { throttle: 1, tc: tc, sc: false });
    const r = { maxSlip: 0, tcOn: false, maxX: 0, maxYaw: 0, t60: null, spinSeconds: 0, vEnd: 0 }; let t;
    for (t = 0; t < 6; t += DT) {
      const s = car.state, psi = wrap(s.yaw * DEG);
      // a simple driver: steer against heading error and drift from the lane, after a deliberate disturbance
      car.input.steer = (kick && t > 0.6 && t < 0.9) ? 0.5 : clamp(-(2.5 * psi + 0.05 * s.x) / car.steerRange(s.forwardSpeed), -1, 1);
      tick(car, env);
      const slip = Math.max(s.wheels[2].slip, s.wheels[3].slip);
      r.maxSlip = Math.max(r.maxSlip, slip); if (slip > 0.3) r.spinSeconds += DT; r.tcOn = r.tcOn || s.tcOn;
      r.maxX = Math.max(r.maxX, Math.abs(s.x)); r.maxYaw = Math.max(r.maxYaw, Math.abs(psi));
      if (r.t60 === null && s.mph >= 60) r.t60 = t + DT;
    }
    r.vEnd = car.state.mph;
    setIn(car, { tc: tc, sc: false }); let tGrip = null;
    for (t = 0; t < 3; t += DT) { car.input.steer = clamp(-(2.5 * wrap(car.state.yaw * DEG)) / car.steerRange(car.state.forwardSpeed), -1, 1); tick(car, env); if (tGrip === null && Math.abs(car.state.wheels[2].slip) < 0.05 && Math.abs(car.state.wheels[3].slip) < 0.05) tGrip = t + DT; }
    r.tGrip = tGrip; r.yawAfter = wrap(car.state.yaw * DEG);
    return r;
  };
  const off = run(false, true), on = run(true, false);
  console.log('  off: rear slip ratio up to ' + f(off.maxSlip, 1) + ', wheels spinning (slip over 0.3) for ' + f(off.spinSeconds, 1) + ' of 6 s, 60 mph in ' + f(off.t60) + ' s, ' + f(off.vEnd, 0) + ' mph after 6 s');
  console.log('       after a half-lock steering jab at 0.6 s the driver model kept it within ' + f(off.maxX, 2) + ' m of the lane centre and ' + f(off.maxYaw / DEG, 1) + ' deg of straight; grip back ' + f(off.tGrip, 2) + ' s after lifting');
  console.log('  on:  rear slip ratio up to ' + f(on.maxSlip, 2) + ', 60 mph in ' + f(on.t60) + ' s');
  check('traction control off: heavy wheelspin', off.maxSlip > 1 && off.spinSeconds > 1 && !off.tcOn);
  check('still controllable: stays in the lane, and lifting restores grip', off.maxX < 2.5 && off.maxYaw < 25 * DEG && off.tGrip !== null && off.tGrip < 1.5 && off.vEnd > 45);
  check('traction control on: slip held near the peak and the launch is quicker', on.maxSlip < 0.25 && on.tcOn && on.t60 < off.t60);
}

/* ---------------------------------------------------------------- 10. oversteer and drift with the aids off */
section('10. Power oversteer with traction and stability control off (rear drive), and the same with them on');
{
  const run = (aids) => {
    const car = mkTop({ drive: 'rwd' }), env = flat(); car.place(0, 0, 0); setIn(car, { tc: aids, sc: aids });
    const st = toSpeed(car, env, 18); const r = { maxRear: 0, drift: 0, n: 0, spun: false }; let t;
    for (t = 0; t < 8; t += DT) {
      const s = car.state, b = Math.abs(s.slipAngleRear);
      // aids on: half steering and full throttle. Aids off: a driver holding a slide of about 25 degrees with steering and throttle.
      car.input.steer = aids ? 0.55 : clamp(0.55 - 4 * (b - 25 * DEG), -1, 1);
      car.input.throttle = t < 1 ? 0.3 : (aids ? 1 : clamp(0.4 + 2.0 * (25 * DEG - b), 0.05, 1));
      tick(car, env);
      if (t > 1) { r.maxRear = Math.max(r.maxRear, b); r.n++; if (s.drifting) r.drift++; if (b > 70 * DEG) r.spun = true; }
    }
    r.frac = r.drift / r.n; r.mph = car.state.mph; return r;
  };
  const off = run(false), on = run(true);
  console.log('  aids off: rear slip angle up to ' + f(off.maxRear / DEG, 1) + ' deg, state.drifting true for ' + f(off.frac * 100, 0) + ' % of 7 s, ' + (off.spun ? 'SPUN' : 'no spin') + ', ' + f(off.mph, 0) + ' mph at the end');
  console.log('  aids on:  rear slip angle up to ' + f(on.maxRear / DEG, 1) + ' deg at full throttle');
  check('with the aids off it oversteers under power and holds a drift', off.maxRear > 12 * DEG && off.frac > 0.5 && !off.spun);
  check('with the aids on the same throttle does not slide the tail', on.maxRear < 8 * DEG);
  // handbrake
  const car = mkTop(), env = flat(); car.place(0, 0, 0); setIn(car, { sc: false }); toSpeed(car, env, 22); let t, locked = false, maxB = 0;
  setIn(car, { sc: false, steer: 0.5, handbrake: 1 });
  for (t = 0; t < 1.5; t += DT) { tick(car, env); if (Math.abs(car.state.wheels[2].omega) < 0.5 && Math.abs(car.state.wheels[3].omega) < 0.5 && car.state.speed > 5) locked = true; maxB = Math.max(maxB, Math.abs(car.state.slipAngleRear)); }
  console.log('  handbrake at 49 mph with half steering: rear wheels ' + (locked ? 'locked' : 'not locked') + ', rear slip angle reached ' + f(maxB / DEG, 1) + ' deg');
  check('handbrake locks the rear wheels and swings the tail', locked && maxB > 15 * DEG);
}

/* ---------------------------------------------------------------- 11. hill */
section('11. A 10 percent hill: hold, roll back, climb');
{
  const env = { ground: (x, z) => -0.10 * z, grip: 1 };   // rises to the north, the way the car faces
  const car = mkTop(); car.place(0, 0, 0); setIn(car, { brake: 1 }); let t, moved = 0, x0, z0, yaw0, any = false;
  tick(car, env); x0 = car.state.x; z0 = car.state.z; yaw0 = car.state.yaw;
  for (t = 0; t < 10; t += DT) { any = tick(car, env) || any; moved = Math.max(moved, Math.abs(car.state.x - x0), Math.abs(car.state.z - z0), Math.abs(car.state.yaw - yaw0)); }
  console.log('  pitch reported on the hill ' + f(car.state.pitch, 2) + ' deg (10 % is 5.71 deg), front/rear axle load ' + f((car.state.wheels[0].load + car.state.wheels[1].load) / G, 0) + '/' + f((car.state.wheels[2].load + car.state.wheels[3].load) / G, 0) + ' kg');
  check('holds on the brake for 10 s without moving at all', moved === 0 && !any && car.state.speed === 0, 'moved ' + moved + ' m');
  check('slope is reported in the pitch', Math.abs(car.state.pitch - 5.71) < 0.4);
  setIn(car, { handbrake: 1 }); for (t = 0; t < 1; t += DT) tick(car, env);   // pedal eases off over a few frames while the handbrake takes over
  let m2 = 0; const zh = car.state.z; for (t = 0; t < 5; t += DT) { tick(car, env); m2 = Math.max(m2, Math.abs(car.state.z - zh)); }
  check('holds on the handbrake alone', m2 === 0 && Math.abs(car.state.z - z0) < 0.02, 'moved ' + m2 + ' m');
  setIn(car, {}); for (t = 0; t < 3; t += DT) tick(car, env);
  const back = car.state.z - z0;
  console.log('  brakes released, no throttle: rolled back ' + f(back, 2) + ' m in 3 s, ' + f(car.state.forwardSpeed, 2) + ' m/s (free roll would be about ' + f(0.5 * 0.0995 * G * 9 * 0.93, 1) + ' m)');
  check('released, it rolls back down the hill', back > 2 && car.state.forwardSpeed < -1.5);
  setIn(car, { brake: 1 }); for (t = 0; t < 4; t += DT) tick(car, env);
  check('brake stops it again and it holds', car.state.speed === 0 && car.state.atRest);
  const zs = car.state.z; setIn(car, { throttle: 0.35 }); let roll = 0; for (t = 0; t < 4; t += DT) { tick(car, env); roll = Math.max(roll, car.state.z - zs); }
  console.log('  hill start on 35 % throttle: rolled back ' + f(roll * 100, 1) + ' cm before pulling away, ' + f(car.state.mph, 1) + ' mph after 4 s');
  check('hill start pulls away with almost no roll-back', roll < 0.10 && car.state.forwardSpeed > 3);
  const c2 = mkTop(); c2.place(0, 0, 0); setIn(c2, { throttle: 1 }); let t60 = null; for (t = 0; t < 8 && t60 === null; t += DT) { tick(c2, env); if (c2.state.mph >= 60) t60 = t + DT; }
  const c3 = mkPubAwd(); c3.place(0, 0, 0); setIn(c3, { throttle: 1 }); let p60 = null; for (t = 0; t < 12 && p60 === null; t += DT) { tick(c3, env); if (c3.state.mph >= 60) p60 = t + DT; }
  const pf = accelRun(mkPubAwd(), 12);
  console.log('  full-throttle climb: 0-60 mph in ' + f(t60) + ' s (published engine: ' + f(p60) + ' s uphill against ' + f(pf.t60) + ' s on the level); climbing ' + f(c2.state.vy, 2) + ' m/s vertically at ' + f(c2.state.mph, 0) + ' mph');
  check('climbs, slower than on the level, and reports vertical speed', t60 !== null && p60 > pf.t60 && c2.state.vy > 2 && Math.abs(c2.state.y - (-0.10 * c2.state.z)) < 0.05);
  // across the slope: parked sideways on a 10 % bank
  const c4 = mkTop(), bank = { ground: (x, z) => 0.10 * x, grip: 1 }; c4.place(0, 0, 0); setIn(c4, {}); let m4 = 0; tick(c4, bank);
  for (t = 0; t < 5; t += DT) { tick(c4, bank); m4 = Math.max(m4, Math.abs(c4.state.x), Math.abs(c4.state.z)); }
  check('parked across a 10 % bank with no brake it does not slide sideways', m4 === 0 && Math.abs(c4.state.roll) > 4, 'roll ' + f(c4.state.roll, 2) + ' deg');
}

/* ---------------------------------------------------------------- 12. standing still and low speed */
section('12. Standing still and low speed');
{
  const car = mkTop(), env = flat(); car.place(12.5, -7.25, 37); setIn(car);
  const x0 = car.state.x, z0 = car.state.z, y0 = car.state.y, yaw0 = car.state.yaw; let t, moved = false, any = false;
  for (t = 0; t < 10; t += DT) { any = tick(car, env) || any; const s = car.state; if (s.x !== x0 || s.z !== z0 || s.y !== y0 || s.yaw !== yaw0 || s.speed !== 0 || s.wheels.some(w => w.omega !== 0)) moved = true; }
  check('10 s at rest with no input: position, height, heading and wheels exactly unchanged, update() returns false', !moved && !any, 'x ' + car.state.x + ' z ' + car.state.z + ' yaw ' + car.state.yaw);
  for (t = 0; t < 4; t += DT) { car.input.steer = Math.sin(t * 5); car.input.brake = t > 2 ? 1 : 0; any = tick(car, env) || any; if (car.state.x !== x0 || car.state.z !== z0 || car.state.yaw !== yaw0) moved = true; }
  check('steering lock to lock and braking at rest do not move it', !moved && !any && Math.abs(car.state.steer) > 0.1);
  // creep away, coast, brake gently to a stop
  car.place(0, 0, 0); setIn(car, { throttle: 0.12 }); let rev = 0, signFlips = 0, lastA = 0, vPrev = 0, maxRise = 0, stopped = null, vmax = 0;
  for (t = 0; t < 30; t += DT) {
    car.input.throttle = t < 3 ? 0.12 : 0; car.input.brake = t > 6 ? 0.12 : 0;
    const mv = tick(car, env), s = car.state; vmax = Math.max(vmax, s.forwardSpeed);
    if (s.forwardSpeed < -1e-9) rev++;
    if (t > 6.2) { const a = s.forwardSpeed - vPrev; if (a > 1e-6) maxRise = Math.max(maxRise, a); if (a * lastA < 0) signFlips++; lastA = a || lastA; }
    vPrev = s.forwardSpeed;
    if (stopped === null && t > 6 && !mv) stopped = t;
  }
  const zStop = car.state.z; let drift = 0; for (t = 0; t < 5; t += DT) { tick(car, env); drift = Math.max(drift, Math.abs(car.state.z - zStop)); }
  console.log('  gentle start to ' + f(vmax / MPH, 1) + ' mph, coast, then a light brake: at rest ' + f(stopped - 6, 2) + ' s after braking began; speed went backwards on ' + rev + ' frames; speed rose on a braking frame by at most ' + f(maxRise, 6) + ' m/s; drift in the next 5 s ' + drift + ' m');
  check('gentle stop: no reversing, no jitter, then exactly still', rev === 0 && stopped !== null && maxRise < 1e-3 && signFlips <= 2 && drift === 0);
  // coasting to rest with no brake at all
  car.place(0, 0, 0); setIn(car, { throttle: 0.2 }); for (t = 0; t < 1.5; t += DT) tick(car, env); setIn(car); let tRest = null, back = 0;
  for (t = 0; t < 240 && tRest === null; t += DT) { if (!tick(car, env)) tRest = t; if (car.state.forwardSpeed < -1e-9) back++; }
  check('coasting with no brake rolls to a stop and stays there (no creep, no reversing)', tRest !== null && back === 0 && car.state.speed === 0, 'at rest after ' + f(tRest, 1) + ' s');
  // full lock circle at walking pace against the published turning circle
  car.place(0, 0, 0); setIn(car, { steer: 1 }); const st = {}; let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (t = 0; t < 40; t += DT) { holdSpeed(car, 2.0, st); car.input.throttle *= 0.2; tick(car, env); if (t > 8) { const w = car.state.wheels[0]; minX = Math.min(minX, w.x); maxX = Math.max(maxX, w.x); minZ = Math.min(minZ, w.z); maxZ = Math.max(maxZ, w.z); } }
  const dia = (maxX - minX + maxZ - minZ) / 2;
  console.log('  full lock at ' + f(car.state.mph, 1) + ' mph: outer front wheel traces a circle of ' + f(dia, 2) + ' m (published turning circle 12.6 m), wheel angles ' + f(car.state.wheels[0].steer / DEG, 1) + ' and ' + f(car.state.wheels[1].steer / DEG, 1) + ' deg');
  check('turning circle within 5 % of the published 12.6 m', Math.abs(dia / 12.6 - 1) < 0.05, f(dia, 2) + ' m');
}

/* ---------------------------------------------------------------- 13. reverse */
section('13. Reverse');
{
  const car = mkTop(), env = flat(); car.place(0, 0, 0); setIn(car, { reverse: true, throttle: 0.5 }); let t, vmin = 0;
  for (t = 0; t < 4; t += DT) { tick(car, env); vmin = Math.min(vmin, car.state.forwardSpeed); }
  const g = car.state.gear, zBack = car.state.z;
  console.log('  reverse selected, half throttle for 4 s: gear ' + g + ', ' + f(-car.state.forwardSpeed / MPH, 1) + ' mph backwards, moved ' + f(zBack, 2) + ' m south');
  check('drives backwards in reverse gear', g === -1 && car.state.forwardSpeed < -3 && zBack > 5 && Math.abs(car.state.x) < 0.01);
  setIn(car, { reverse: true, throttle: 0.3, steer: 0.6 }); for (t = 0; t < 2; t += DT) tick(car, env);
  check('steering right while reversing swings the tail to the right (east)', car.state.x > 0.3 && wrap(car.state.yaw * DEG) < -0.05, 'x ' + f(car.state.x, 2) + ' m, yaw ' + f(wrap(car.state.yaw * DEG) / DEG, 1) + ' deg');
  setIn(car, { reverse: true, brake: 1 }); let moving = true; for (t = 0; t < 6 && moving; t += DT) moving = tick(car, env);
  check('brakes to rest from reverse', !moving && car.state.speed === 0);
  setIn(car, { throttle: 0.5 }); for (t = 0; t < 3; t += DT) tick(car, env);
  check('back to drive: moves forward again in a forward gear', car.state.gear >= 1 && car.state.forwardSpeed > 3);
  setIn(car, { throttle: 1, reverse: true }); for (t = 0; t < 1; t += DT) tick(car, env);
  check('asking for reverse at speed does nothing until the car has stopped', car.state.gear >= 1 && car.state.forwardSpeed > 5);
  const ar = CarPhysics({ controls: { autoReverse: true } }); ar.place(0, 0, 0); setIn(ar, { brake: 1 }); for (t = 0; t < 3; t += DT) tick(ar, env);
  check('optional mode: holding the brake at rest backs the car up', ar.state.gear === -1 && ar.state.forwardSpeed < -2);
  setIn(ar, { throttle: 1 }); for (t = 0; t < 4; t += DT) tick(ar, env);
  check('optional mode: throttle then stops it and drives forward', ar.state.gear >= 1 && ar.state.forwardSpeed > 3);
}

/* ---------------------------------------------------------------- 14. walls */
// A thin wall through (wx, wz) with unit normal (nx, nz) pointing to the side the car comes from. The test is swept, as the
// engine's would be: a circle that started in front of the wall and ends closer than its radius, or beyond, is a hit.
function wallEnv(wx, wz, nx, nz) {
  return { ground: () => 0, grip: 1, hits: 0, hit(x0, z0, x1, z1, rad) { const s0 = (x0 - wx) * nx + (z0 - wz) * nz, s1 = (x1 - wx) * nx + (z1 - wz) * nz; if (s0 < 0 || s1 >= rad) return null; this.hits++; return { nx, nz, depth: rad - s1 }; } };
}
function wallRun(mph, angleDeg, keepThrottle) {
  // The car drives north; the wall's normal is turned angleDeg from head-on.
  const a = angleDeg * DEG, nx = Math.sin(a), nz = Math.cos(a), car = mkTop(), wz = -(mph > 100 ? 4000 : 150), env = wallEnv(0, wz, nx, nz);
  car.place(0, 0, 0); setIn(car); const st = {}, v = mph * MPH, half = car.SPEC.body.length / 2, hw = car.SPEC.body.width / 2;
  const r = { vImpact: 0, minClear: 1e9, maxYr: 0, vAfter: null, maxV: 0, hit: false }; let t = 0, tHit = null;
  while (t < 200) {
    if (tHit === null) { if (mph > 100) car.input.throttle = 1; else holdSpeed(car, v, st); } else { car.input.throttle = keepThrottle ? 1 : 0; car.input.brake = (keepThrottle || angleDeg) ? 0 : 1; }   // the driver lifts and brakes after a head-on hit
    const vBefore = car.state.speed; tick(car, env); t += DT; const s = car.state, psi = s.yaw * DEG;
    if (s.hit && tHit === null) { tHit = t; r.vImpact = vBefore; r.hit = true; }
    // signed distance from the wall of the four body corners (negative = through the wall)
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const cx = s.x + Math.sin(psi) * half * sx + Math.cos(psi) * hw * sy, cz = s.z - Math.cos(psi) * half * sx + Math.sin(psi) * hw * sy;
      r.minClear = Math.min(r.minClear, (cx - 0) * nx + (cz - wz) * nz);
    }
    if (tHit !== null) { r.maxYr = Math.max(r.maxYr, Math.abs(s.yawRate)); r.maxV = Math.max(r.maxV, s.speed); if (r.vAfter === null && t - tHit > 0.5) r.vAfter = s.speed; if (t - tHit > 4) break; }
  }
  r.vEnd = car.state.speed; r.vInto = -(car.state.vx * nx + car.state.vz * nz); r.yawEnd = wrap(car.state.yaw * DEG) / DEG; r.hits = env.hits; return r;
}
section('14. Wall strikes');
{
  const a = wallRun(40, 0, false);
  console.log('  head-on at ' + f(a.vImpact / MPH, 1) + ' mph: ' + f(a.vAfter / MPH, 1) + ' mph half a second later, ' + f(a.vEnd / MPH, 2) + ' mph after 4 s; deepest corner ' + f(a.minClear, 3) + ' m from the wall plane (negative would be through it); peak yaw rate ' + f(a.maxYr, 1) + ' deg/s');
  check('head-on at 40 mph: stops, never passes through, nothing blows up', a.hit && Math.abs(a.vImpact / MPH - 40) < 1.5 && a.minClear > -0.05 && a.maxV <= a.vImpact + 0.01 && a.vAfter < 0.35 * a.vImpact && a.vEnd < 1 && a.maxYr < 60);
  const b = wallRun(40, 60, false);
  console.log('  glancing at 40 mph (30 deg to the wall): ' + f(b.vAfter / MPH, 1) + ' mph half a second later, speed into the wall at the end ' + f(b.vInto, 2) + ' m/s, heading turned ' + f(b.yawEnd, 1) + ' deg, deepest corner ' + f(b.minClear, 3) + ' m, peak yaw rate ' + f(b.maxYr, 0) + ' deg/s');
  check('glancing blow at 40 mph: deflects along the wall, keeps most of its speed, never passes through', b.hit && b.minClear > -0.35 && b.vAfter > 0.4 * b.vImpact && b.maxV <= b.vImpact + 0.01 && b.vInto < 0.5 && b.maxYr < 400 && Math.abs(b.yawEnd) > 5);
  const c = wallRun(40, 0, true);
  console.log('  head-on at 40 mph with the throttle held: ends at ' + f(c.vEnd / MPH, 2) + ' mph, deepest corner ' + f(c.minClear, 3) + ' m, ' + c.hits + ' contacts');
  check('throttle held against the wall: still does not pass through', c.minClear > -0.05 && c.vEnd < 3);
  const d = wallRun(251, 0, false);
  console.log('  head-on at ' + f(d.vImpact / MPH, 0) + ' mph (' + f(d.vImpact * DT, 2) + ' m per frame): deepest corner ' + f(d.minClear, 3) + ' m, ' + f(d.vEnd / MPH, 2) + ' mph after 4 s');
  check('head-on at top speed: no tunnelling, no explosion', d.hit && d.vImpact / MPH > 240 && d.minClear > -0.05 && d.maxV <= d.vImpact + 0.01 && d.vEnd < 1 && d.maxYr < 60);
}

/* ---------------------------------------------------------------- 15. odd inputs */
section('15. Bad inputs and odd frame times');
{
  const car = mkTop(); car.place(0, 0, 0); let t; const env = { ground: () => NaN, grip: NaN };
  setIn(car, { throttle: NaN, brake: undefined, steer: 7, handbrake: -3 }); for (t = 0; t < 1; t += DT) tick(car, env);
  setIn(car, { throttle: 5, steer: -9 }); for (t = 0; t < 2; t += DT) tick(car, env);
  tick(car, flat(), 0); tick(car, flat(), -1); tick(car, flat(), 5); tick(car, flat(), NaN); tick(car, undefined, DT); tick(car, { grip: 1 }, 0.001);
  for (t = 0; t < 2; t += 0.047) tick(car, flat(), 0.047);
  check('garbage inputs, a NaN ground and grip, zero, negative, huge and NaN frame times are all survived', finite(car) && car.state.speed > 1);
  const bumpy = { ground: (x, z) => 0.3 * Math.sin(x * 0.2) + 0.3 * Math.cos(z * 0.15), grip: 0.8 }; const c2 = mkTop(); c2.place(0, 0, 0); setIn(c2, { throttle: 0.6 });
  let maxPitch = 0; for (t = 0; t < 20; t += DT) { c2.input.steer = 0.3 * Math.sin(t * 0.7); tick(c2, bumpy); maxPitch = Math.max(maxPitch, Math.abs(c2.state.pitch)); }
  check('rolling ground with steering and throttle for 20 s: stays finite and follows the ground', finite(c2) && Math.abs(c2.state.y - (c2.state.wheels.reduce((a, w) => a + bumpy.ground(w.x, w.z), 0) / 4)) < 0.05 && maxPitch < 12);
}

/* ---------------------------------------------------------------- summary */
section('NaN check');
check('no state value was NaN or infinite on any of the ' + frames + ' frames run', nanSeen === 0, nanSeen + ' bad frames');
console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) { console.log('FAILED:'); failures.forEach(x => console.log('  - ' + x)); }
process.exit(failed ? 1 : 0);
