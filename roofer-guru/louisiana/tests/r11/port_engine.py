"""Round 10, step 1: port build 10's dashboard changes (the Scout Engine mode) onto the Louisiana module.
Reads tests/r10/scout_pre_r10.js, writes build/scout.js. Every anchor must occur exactly once.
python3 -I tests/r11/port_engine.py"""
import os
SP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
s = open(os.path.join(SP, 'tests', 'r10', 'scout_pre_r10.js'), encoding='utf-8').read()
blk = open(os.path.join(SP, 'tests', 'r11', 'en_block.js'), encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)
# the wider city's second record
rep("    mly: 'https://graph.mapillary.com/images',\n", "    mly: 'https://graph.mapillary.com/images',\n    osmBldg: 'https://services6.arcgis.com/Do88DoK2xjTUCXd1/arcgis/rest/services/OSM_NA_Buildings/FeatureServer/0/query',\n")
# the mode button and the engine's place in the card
rep('<button type="button" data-v="3d" aria-pressed="false">Street view (3D)</button><button type="button" data-v="sv" aria-pressed="false">Google photos</button>',
    '<button type="button" data-v="3d" aria-pressed="false">Street view (3D)</button><button type="button" data-v="eng" aria-pressed="false" title="The neighborhood drawn by the Scout Engine: a renderer written for this page, with a physical sky, bounced light, reflections and traffic, and the roof views: heat, weather wear and the next 15 years">Scout Engine (3D)</button><button type="button" data-v="sv" aria-pressed="false">Google photos</button>')
a = '<div class="sc-3dattr">Imagery: Esri, Vantor · Buildings: FEMA · Streets: © OpenStreetMap contributors, U.S. Census</div></div></div>\n'
rep(a, a + '            <div class="sc-3dw sc-enw" id="scEnW" hidden><div class="sc-svbar" id="scEnBar"></div><div class="sc-3d sc-en" id="scEn"><div class="sc-3dnote" id="scEnNote"></div><div class="sc-3dpad" id="scEnPad" role="group" aria-label="Move and turn"><span></span><button type="button" data-k="fwd" title="Forward (W)" aria-label="Forward">▲</button><span></span><button type="button" data-k="left" title="Turn left (A)" aria-label="Turn left">◀</button><button type="button" data-k="back" title="Back (S)" aria-label="Back">▼</button><button type="button" data-k="right" title="Turn right (D)" aria-label="Turn right">▶</button><button type="button" data-k="up" class="sc-enalt" title="Climb (R or the up arrow)" aria-label="Climb" hidden>⤒</button><span class="sc-enalt" hidden></span><button type="button" data-k="down" class="sc-enalt" title="Descend (F or the down arrow)" aria-label="Descend" hidden>⤓</button></div><div class="sc-3dattr">Imagery: Esri, Vantor · Buildings: FEMA USA Structures, © OpenStreetMap contributors · Streets: © OpenStreetMap contributors, U.S. Census · Windows, cars, signals, sidewalks and rooftop equipment are generated, not observed · The roof views are a model, not an inspection</div></div></div>\n')
rep("        if (d3Mode) refresh3D();\n", "        if (d3Mode) refresh3D(); if (enMode) refreshEn();\n")
rep("if (svMode) drawSoon(); if (d3Mode) refresh3D();\n", "if (svMode) drawSoon(); if (d3Mode) refresh3D(); if (enMode) refreshEn();\n")
rep("const curBounds = () => ((svMode || d3Mode) && viewBounds ? viewBounds : map.getBounds());", "const curBounds = () => ((svMode || d3Mode || enMode) && viewBounds ? viewBounds : map.getBounds());")
rep("detail(); street(t); if (d3Mode) { if (o && o.noSV) { d3Target = t; if (d3) d3.setCurrent(b.id); render3DBar(); } else open3D(t); }",
    "detail(); street(t); if (enMode) { if (o && o.noSV) { enTarget = t; if (en) en.setCurrent(b.id); renderEnBar(); } else openEngine(t); } else if (d3Mode) { if (o && o.noSV) { d3Target = t; if (d3) d3.setCurrent(b.id); render3DBar(); } else open3D(t); }")
rep("detail(); street(t); if (d3Mode) open3D(t); else if (svMode) showSV(t); refreshSoon();", "detail(); street(t); if (enMode) openEngine(t); else if (d3Mode) open3D(t); else if (svMode) showSV(t); refreshSoon();")
rep("const was = viewMode; viewMode = m; svMode = m === 'sv'; d3Mode = m === '3d';", "const was = viewMode; viewMode = m; svMode = m === 'sv'; d3Mode = m === '3d'; enMode = m === 'eng';")
rep("        if (!d3Mode && d3) d3.stop();\n", "        if (!d3Mode && d3) d3.stop();\n        if (!enMode && en) { en.stop(); enPlay(false); }\n")
rep("host.hidden = m !== 'map'; svw.hidden = !svMode; d3w.hidden = !d3Mode; hideTip();", "host.hidden = m !== 'map'; svw.hidden = !svMode; d3w.hidden = !d3Mode; enw.hidden = !enMode; hideTip();")
rep("Walk the streets and alleys, or rise to drone and bird height for the roofs.' : 'Pick a building, then Street view to stand in the street in front of it (or double click the building).';\n        if (m === 'map') { if (svFull) full(false); const t = was === '3d' ? d3Target : svTarget;",
    "Walk the streets and alleys, or rise to drone and bird height for the roofs.' : enMode ? EN_NOTE : 'Pick a building, then Street view to stand in the street in front of it (or double click the building).';\n        if (m === 'map') { if (svFull) full(false); const t = was === '3d' ? d3Target : was === 'eng' ? enTarget : svTarget;")
rep("        if (d3Mode && d3) d3.start();\n      }\n", "        if (d3Mode && d3) d3.start();\n        if (enMode && en) en.start();\n      }\n")
rep("if (svMode) { renderSvBar(); drawSoon(); } if (d3Mode) render3DBar(); }", "if (svMode) { renderSvBar(); drawSoon(); } if (d3Mode) render3DBar(); if (enMode) renderEnBar(); }")
rep("        else if (viewMode === '3d' && d3) { const s2 = d3.state(); t = { lat: s2.lat, lon: s2.lon, street: '', b: null }; }\n",
    "        else if (viewMode === '3d' && d3) { const s2 = d3.state(); t = { lat: s2.lat, lon: s2.lon, street: '', b: null }; }\n        else if (viewMode === 'eng' && en) { const s2 = en.state(); t = { lat: s2.lat, lon: s2.lon, street: '', b: null }; }\n")
rep("        if (v === '3d') open3D(t); else showSV(t);\n", "        if (v === '3d') open3D(t); else if (v === 'eng') openEngine(t); else showSV(t);\n")
rep("      var d3 = null, d3Mode = false, d3Target = null, d3St = null, viewMode = 'map';\n", "      var d3 = null, d3Mode = false, d3Target = null, d3St = null, viewMode = 'map';\n      var en = null, enMode = false, enTarget = null, enSt = null;\n")
# the engine's button in the three.js view's bar
a = "            <button type=\"button\" class=\"ibtn\" data-a=\"export\" title=\"Download this area as a 3D model"
rep(a, "            <button type=\"button\" class=\"ibtn\" data-a=\"engine\" title=\"The same neighborhood in the Scout Engine: a physical sky, bounced light, reflections, traffic, and the roof views (heat, weather wear, the next 15 years)\">Scout Engine</button>\n" + a)
rep("          else if (a === 'photos') { const s2 = d3 ? d3.state() : null; showSV(",
    "          else if (a === 'engine') { const s2 = d3 ? d3.state() : null; openEngine(b ? { lat: b.lat, lon: b.lon, street: b.street, b } : s2 ? { lat: s2.lat, lon: s2.lon, street: '', b: null } : t); }\n          else if (a === 'photos') { const s2 = d3 ? d3.state() : null; showSV(")
# the engine's own part of the module
rep("      /* ---------- imagery: which pictures are under the centre of the map ---------- */\n", blk + "      /* ---------- imagery: which pictures are under the centre of the map ---------- */\n")
# what other code may call
rep("d3: () => d3, open3D: t => open3D(t),", "d3: () => d3, open3D: t => open3D(t), en: () => en, openEngine: t => openEngine(t),")
# ---- step 2: the outlook and the roof views' readings ----
out_blk = open(os.path.join(SP, 'tests', 'r11', 'outlook_block.js'), encoding='utf-8').read()
lens_blk = open(os.path.join(SP, 'tests', 'r11', 'lens_block.js'), encoding='utf-8').read()
# the clock keeps its spread of ages, for the years ahead
rep("    const o = { pOrig: dist[T], pOld15, pOld20, p5: clamp(p5, 0, 1), p1: clamp(p1, 0, 1), rep, age, t: T, storms };\n",
    "    const o = { pOrig: dist[T], pOld15, pOld20, p5: clamp(p5, 0, 1), p1: clamp(p1, 0, 1), rep, age, t: T, storms, dist };\n")
# a building's clock as the list it is mixed from: covering, start year, weight
rep("    let st = stateFrom(starts);\n",
    "    let st = stateFrom(starts);\n    /* the same mix as a list (covering, the year the clock started, weight), for the outlook's years ahead */\n    const mixOf = list => list.flatMap(([y, w]) => keys.map(([k, kw]) => [k, Math.min(THIS_YEAR, Math.round(y)), w * kw])); let mix = mixOf(starts);\n")
rep("o.storms = [...sy.values()].sort((a, c) => c.share - a.share).slice(0, 3); st = o; });\n",
    "o.storms = [...sy.values()].sort((a, c) => c.share - a.share).slice(0, 3); st = o; mix = mixOf([[Math.floor(p.y), 1]]).map(m => [m[0], m[1], m[2] * w]).concat(mix.map(m => [m[0], m[1], m[2] * (1 - w)])); });\n")
rep("    b.state = st; b.last = last; b.lastW = last ? permitE(last) : null; b.strong = strong;\n",
    "    b.state = st; b.last = last; b.lastW = last ? permitE(last) : null; b.strong = strong;\n    { const m = new Map(); mix.forEach(([k, y, w]) => { if (w > 1e-5) m.set(k + '|' + y, (m.get(k + '|' + y) || 0) + w); }); b.mix = [...m].map(([k, w]) => { const [kk, y] = k.split('|'); return [kk, +y, w]; }); }\n")
rep("  /* ============================ the module ============================ */\n", out_blk + lens_blk + "  /* ============================ the module ============================ */\n")
rep("d3: () => d3, open3D: t => open3D(t), en: () => en, openEngine: t => openEngine(t),", "d3: () => d3, open3D: t => open3D(t), en: () => en, openEngine: t => openEngine(t), outlook: (b, o) => outlookOf(b, o), outlookType, hazardAt, stormOn, hurByAge, eventsFor, bandMeans, yearsOf, curveK, ageShares: () => AGEW, lens: LENS, heat: { surfaceC, airC, sunAt, clearSky, heatRate, heatRef, reflectOf, climOf, coastKm },")
rep("show: { g: true, o: true, r: true }, kind: 'all', view: null, ai: true };", "show: { g: true, o: true, r: true }, kind: 'all', view: null, ai: true, outRec: 'mid' };")
rep("    if (typeof s.ai === 'boolean') o.ai = s.ai;\n", "    if (typeof s.ai === 'boolean') o.ai = s.ai;\n    if (['mid', 'recent', 'long'].includes(s.outRec)) o.outRec = s.outRec;\n")
open(os.path.join(SP, 'build', 'scout.js'), 'w', encoding='utf-8').write(s)
print('ok', len(s))
