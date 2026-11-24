"""Sky job: airliners, the Navy in San Diego Bay and the landmark bridges in the Scout Engine.
   python3 -I port_sky.py <in.js> <out.js>
Reads the engine as the earlier ports left it (or la_engine.js itself) and writes it with SE.SKY_DATA, SE.SkyModel,
SE.SkyShapes and SE.SkyKit (sky_data.js, sky_model.js, sky_shapes.js, sky_engine.js, sky_more.js if present) and the
world's wiring. Every anchor must occur exactly once. Touched in the world builder: the 'update' handler (one call),
state(), graphics(), setGraphics() and the returned controls. recenter is not touched: the kit watches S.gen itself."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
def rd(n):
    p = os.path.join(HERE, n)
    return open(p, encoding='utf-8').read() if os.path.exists(p) else ''
kit = rd('sky_data.js') + rd('sky_model.js') + rd('sky_shapes.js') + rd('sky_engine.js') + rd('sky_more.js')
assert 'SE.SkyKit = SkyKit;' in kit and 'SE.SKY_DATA' in kit
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:110])
    s = s.replace(a, b)

BANNER = "  /* ==== rooftop scout on the engine: the neighborhood, streamed around the camera ==== */\n"
rep(BANNER, kit + BANNER)
# the kit, made beside the others; S.deckAt is published by it
rep("    engine.on('update', dt => {\n",
    "    /* the sky and the harbour (SE.SkyKit): airliners on the real approaches, the Navy in San Diego Bay, the landmark bridges. It publishes S.deckAt(x, z). */\n"
    "    const SKY = SE.SkyKit(engine, S, { need, onError: (w, e) => { try { console.warn('sky kit: ' + w, e); } catch (x) { /* no console */ } } });\n"
    "    engine.on('update', dt => {\n")
# one call a frame, after the camera is placed
rep("placeCamera(); pump();\n",
    "placeCamera(); pump();\n"
    "      if (SKY.update(dt, cam.entity.transform.position, { night: smoothstep(2, -6, S.sunAlt), moving: engine.playing && engine.awake && engine.live, on: gfx.air !== false })) need();\n")
rep("built: S.built, roads: S.roads.length,", "air: SKY.state(), built: S.built, roads: S.roads.length,")
rep("live: engine.live, gpu: dev.caps.gpu,", "air: gfx.air !== false, live: engine.live, gpu: dev.caps.gpu,")
rep("        saveGfx(); need(3); return graphics();", "        if (o.air != null && !!o.air !== (gfx.air !== false)) { gfx.air = !!o.air; SKY.set(gfx.air); }\n        saveGfx(); need(3); return graphics();")
rep("      dropCrate, engine, canvas: cv,", "      /* the sky and the harbour: sky.info() says the nearest airport, the runways in use and what is in the air */\n      sky: SKY,\n      dropCrate, engine, canvas: cv,")
open(dst, 'w', encoding='utf-8').write(s)
print('sky ok', len(s))
