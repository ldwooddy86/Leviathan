"""California engine job "car": a black 2027 BMW M3 to drive, as mode `m3` beside street, walk, drone, alta, saucer, tictac.

   python3 -I port_car.py <in.js> <out.js>

Reads an engine file (the Louisiana engine, or that engine as the terrain, weather and traffic ports left it) and writes
it with: the vehicle dynamics (../car_physics.js, as it is), the body (car_body.js), the kit (car_engine.js, SE.M3Kit),
the world's side of the car (car_world.js, inside the world builder) and the small hooks below. Every anchor must occur
exactly once. Nothing else in the engine is changed.

Functions of the world builder touched (one short insertion each unless said): HEIGHT (a mode), the craft handles,
drawHud, placeCamera, the update handler (the pad test, a branch for the mode, one call before placeCamera), lookNow,
the drag handler, the click handler, the wheel handler, the key handler, faceAt, setHeight, state, graphics,
setGraphics, recenter (two insertions), after (the distance at which a fast car's origin moves), open, and the public
object (car: carApi). Added and new: everything in car_world.js (carLand, carRoadSpec, carNear, carRoadAt, carGround,
carHit, carLane, carMake, carEnter, carLeave, carHero, carEnv, carInput, carRoads, carStep, carIdle, carCamera,
carHud, carKey, carState, carApi, CARW). Not touched: loadRoads, setRoads, buildRoads, plan, reach, the traffic's call
(ST.update), the storm, the shaders, Input, Physics."""
import os, sys, re
HERE = os.path.dirname(os.path.abspath(__file__))
def rd(*p):
    with open(os.path.join(HERE, *p), encoding='utf-8') as f: return f.read()
if len(sys.argv) != 3: sys.exit(__doc__)
s = open(sys.argv[1], encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, ('anchor count', s.count(a), a[:110])
    s = s.replace(a, b)
def strip_exports(t):
    t2 = re.sub(r"\nif \(typeof module !== 'undefined'\) module\.exports = [^\n]*\n", "\n", t)
    assert t2 != t, 'module.exports line not found'
    return t2
assert 'SE.M3Kit' not in s, 'the car is already in this engine'
physics = strip_exports(rd('..', 'car_physics.js')); body = strip_exports(rd('car_body.js')); kit = rd('car_engine.js'); world = rd('car_world.js')

# ---- the kit, before the world builder ----
MARK = "  /* ==== rooftop scout on the engine: the neighborhood, streamed around the camera ==== */\n"
rep(MARK, "  /* ==== the M3's dynamics (CarPhysics), its shape (M3Body) and its kit (M3Kit) ==== */\n" + physics + body + kit + MARK)

# ---- a mode, and the car's handle ----
rep("tictac: { eye: 60, pitch: -12 } };", "tictac: { eye: 60, pitch: -12 }, m3: { eye: 1.2, pitch: -9 } };")
rep("S.uapCam = 'chase'; S.fast = false;",
    "S.uapCam = 'chase'; S.fast = false;\n"
    "    /* the M3 (SE.M3Kit): made the first time it is asked for. S.cchase: the chase and orbit cameras as the pointer leaves them. S.hero: what the traffic reads (see carHero) */\n"
    "    let CAR = null; S.cchase = { yaw: 0, pitch: -9, dist: 7.2, oyaw: 0 }; S.carCam = 'chase'; S.hero = null;")

# ---- the world's side of the car ----
rep("    /* ---------- the camera ---------- */\n", world + "    /* ---------- the camera ---------- */\n")

# ---- read-out, camera, controls ----
rep("      const on = S.mode === 'alta' && !!ALTA; if (hudEl.hidden !== !on)", "      if (S.mode === 'm3' && CAR) { carHud(); return; }\n      const on = S.mode === 'alta' && !!ALTA; if (hudEl.hidden !== !on)")
rep("      if (m === 'alta' && ALTA) { const a = ALTA.state; S.x = a.x; S.z = a.z; let cx, cy, cz;", "      if (m === 'm3' && CAR) { carCamera(t); return; }\n      if (m === 'alta' && ALTA) { const a = ALTA.state; S.x = a.x; S.z = a.z; let cx, cy, cz;")
rep("if (pad && S.mode !== 'alta' && !isUap(S.mode)) {", "if (pad && S.mode !== 'alta' && S.mode !== 'm3' && !isUap(S.mode)) {")
rep("      else if (S.mode === 'orbit') { if (turn) { S.orbit.yaw = (S.orbit.yaw + turn * 50 * dt", "      else if (S.mode === 'm3' && CAR) carStep(dt);\n      else if (S.mode === 'orbit') { if (turn) { S.orbit.yaw = (S.orbit.yaw + turn * 50 * dt")
rep("      placeCamera(); pump();", "      carIdle(dt); placeCamera(); pump();")
rep("const lookNow = () => (S.mode === 'orbit' ? [S.orbit.yaw, S.orbit.pitch] : ", "const lookNow = () => (S.mode === 'orbit' ? [S.orbit.yaw, S.orbit.pitch] : S.mode === 'm3' && CAR ? [S.carCam === 'orbit' ? S.cchase.oyaw : S.cchase.yaw, S.cchase.pitch] : ")
rep("        else if (S.mode === 'orbit') { S.orbit.yaw = (drag.yaw - dx * 0.3 + 3600) % 360;",
    "        else if (S.mode === 'm3' && CAR) { if (S.carCam === 'orbit') S.cchase.oyaw = (drag.yaw - dx * 0.3 + 3600) % 360; else S.cchase.yaw = clamp(drag.yaw - dx * 0.3, -180, 180); S.cchase.pitch = clamp(drag.pitch + dy * 0.25, -80, 12); }\n"
    "        else if (S.mode === 'orbit') { S.orbit.yaw = (drag.yaw - dx * 0.3 + 3600) % 360;")
rep("else if (h.ground && S.mode !== 'orbit') goTo(", "else if (h.ground && S.mode !== 'orbit' && S.mode !== 'm3') goTo(")
rep("else S.fov = clamp(S.fov * (1 + dy * 0.0011), 22, 95); need(); });", "else if (S.mode === 'm3' && CAR) { if (S.carCam === 'chase' || S.carCam === 'orbit') S.cchase.dist = clamp(S.cchase.dist * (1 + dy * 0.0011), 3.6, 60); } else S.fov = clamp(S.fov * (1 + dy * 0.0011), 22, 95); need(); });")
rep("if (S.mode === 'alta' && ALTA) { if (code === 'KeyC') { S.altaCam = ", "if (S.mode === 'm3' && CAR) { carKey(code); return; } if (S.mode === 'alta' && ALTA) { if (code === 'KeyC') { S.altaCam = ")
rep("      if (S.mode === 'alta' && ALTA) { const a = ALTA.state; a.yaw = (DEG * Math.atan2(x - a.x, -(z - a.z)) + 360) % 360;",
    "      if (S.mode === 'm3' && CAR) { const a = CAR.state, by = (DEG * Math.atan2(x - a.x, -(z - a.z)) + 360) % 360; if (S.carCam === 'orbit') S.cchase.oyaw = by; else S.cchase.yaw = clamp(((by - a.yaw + 540) % 360) - 180, -150, 150); need(); if (env.onMove) env.onMove(state()); return; }\n"
    "      if (S.mode === 'alta' && ALTA) { const a = ALTA.state; a.yaw = (DEG * Math.atan2(x - a.x, -(z - a.z)) + 360) % 360;")

# ---- getting in, getting out ----
rep("      if (was === 'alta' && ALTA) ALTA.show(false);\n", "      if (was === 'alta' && ALTA) ALTA.show(false);\n      if (was === 'm3') carLeave();\n      if (m === 'm3') carEnter();\n")
rep("[S.x, S.z] = toL(lat, lon); S.on = null; S.tween = null;", "[S.x, S.z] = toL(lat, lon); S.on = null; S.tween = null; if (S.mode === 'm3') carEnter(yaw, true);")

# ---- what the dashboard reads ----
rep("alta: S.mode === 'alta' && ALTA ? { mode: ALTA.state.mode,", "car: carState(), alta: S.mode === 'alta' && ALTA ? { mode: ALTA.state.mode,")
rep("altaCam: S.altaCam, uapCam: S.uapCam,", "altaCam: S.altaCam, uapCam: S.uapCam, carCam: S.carCam,")
rep("if (o.altaCam && (o.altaCam === 'chase' || o.altaCam === 'payload')) S.altaCam = o.altaCam;", "if (o.carCam && carApi.cams.includes(o.carCam)) S.carCam = o.carCam; if (o.altaCam && (o.altaCam === 'chase' || o.altaCam === 'payload')) S.altaCam = o.altaCam;")
rep("      alta: { get craft() { return ALTA; },", "      /* the M3: its state, and what its buttons do */\n      car: carApi,\n      alta: { get craft() { return ALTA; },")

# ---- the origin moves under the car ----
rep("S.gen++; SK.reset();", "const carLL = CAR && CAR.out ? toLL(CAR.state.x, CAR.state.z) : null; S.gen++; SK.reset();")
rep(" S.on = null; S.roadsAt = null; S.roads = []; S.graph = [];", " if (carLL) { const q = toL(carLL[0], carLL[1]); CAR.shift(q[0] - CAR.state.x, q[1] - CAR.state.z); CARW.at = null; } S.on = null; S.roadsAt = null; S.roads = []; S.graph = [];")
rep("(S.fast ? 90000 : 12000)", "(S.fast ? (S.mode === 'm3' ? 30000 : 90000) : 12000)")

with open(sys.argv[2], 'w', encoding='utf-8') as f: f.write(s)
print('wrote', sys.argv[2], len(s.encode('utf-8')), 'bytes')
