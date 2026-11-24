/* The kit's governor, checked against the physics alone in Node: full throttle on the level and down a 6 % and a 12 % grade.
   The governor is the three lines of M3Kit.update copied here. node governor.js */
const path = require('path'), { CarPhysics } = require(path.join(__dirname, '..', '..', 'car_physics.js'));
const MPH = 0.44704, VMAX = 251 * MPH, clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
function run(grade, secs) {
  const car = CarPhysics({ controls: { autoReverse: true } }), env = { ground: (x, z) => grade * z, grip: 1 }; car.place(0, 0, 0); const gov = { v: null, dt: 1 / 60 }; let mx = 0, t = 0, tTop = null;
  for (let i = 0; i < secs * 60; i++) { let thr = 1, brk = 0; const dt = 1 / 60, v = car.state.speed, acc = gov.v != null ? clamp((v - gov.v) / gov.dt, -5, 20) : 0, vp = v + Math.max(0, acc) * 0.3, vT = VMAX - 0.0006; gov.v = v; gov.dt = dt;
    if (vp > vT - 0.002) { thr = Math.min(thr, clamp((vT - vp) / 0.002, 0, 1)); brk = Math.max(brk, clamp((v - vT) * 400, 0, 1)); }
    car.input.throttle = thr; car.input.brake = brk; car.update(1 / 60, env); t += 1 / 60; if (car.state.mph > mx) mx = car.state.mph; if (tTop === null && car.state.mph > 250.5) tTop = t; }
  return { grade, end: car.state.mph, max: mx, tTop };
}
let ok = true;
for (const g of [0, 0.06, 0.12]) { const r = run(g, g ? 150 : 400); const pass = r.max <= 251.0000001 && r.end > (g ? 250.7 : 250.95); ok = ok && pass; console.log((pass ? 'PASS' : 'FAIL') + '  grade ' + (g * 100) + ' % down: ends at ' + r.end.toFixed(3) + ' mph, greatest ' + r.max.toFixed(4) + ' mph, passed 250.5 mph at ' + (r.tTop == null ? 'never' : r.tTop.toFixed(1) + ' s')); }
process.exit(ok ? 0 : 1);
