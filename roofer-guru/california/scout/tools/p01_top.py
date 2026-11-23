"""California: the head of scout.js (names, storage keys, services, the state's box, addresses)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import F
f = F()
f.block('/* Module 18, Rooftop Scout:', '(function () {', f.blk('b01_head.js'))
f.rep("const KEY = 'rooftops', STORE = 'up.scout.v1', CHECKS = 'up.scout.checks.v1', VERSION = 1;", "const KEY = 'rooftops', STORE = 'cg.scout.v1', CHECKS = 'cg.scout.checks.v1', VERSION = 1;")
f.block('  /* ---------- public services: every one keyless', '  /* ---------- settings, kept in this browser ---------- */', f.blk('b02_ep.js') + '\n')
f.rep("""  /* green and orange cut points, set from the atlas's own roof ages (module 17): the average Louisiana roof scores about 21,
     so orange starts a little under the typical roof and green a fifth above it (the proportions of the sibling DFW atlas), green needs
     evidence of an older roof (a known roof of about 14 years or more) or open storm damage, and red needs evidence of a
     newer one (a storm rebuild, a permit or a young building) */""",
"""  /* green and orange cut points, set from the atlas's own roof ages (module 17): orange starts a little under the score of
     the average California roof and green a fifth above it (the method's note gives the average as the page computes it),
     so green needs evidence of an older roof or open damage, and red needs evidence of a newer one (a rebuild after a
     fire, a permit or a young building) */""")
f.rep("if (s.view && isN(s.view.lat) && isN(s.view.lon) && isN(s.view.z) && Math.abs(s.view.lat - 31) < 2.6 && Math.abs(s.view.lon + 91.5) < 3.6) o.view", "if (s.view && isN(s.view.lat) && isN(s.view.lon) && isN(s.view.z) && s.view.lat > G0.maxy - G0.H / G0.sx - 0.5 && s.view.lat < G0.maxy + 0.5 && s.view.lon > G0.minx - 0.5 && s.view.lon < G0.minx + G0.W / (G0.kx * G0.sx) + 0.5) o.view")
f.rep("const CUES = [['tarp', 'Blue tarp or a temporary patch', 'g'], ['missing', 'Missing, lifted or creased shingles', 'g'], ['worn', 'Worn: curling, bare spots, dark streaks or moss', 'g'], ['hail', 'Hail marks: bruised shingles, dented vents or gutters', 'g'], ['ponding', 'Flat roof: ponding, blisters or open seams', 'g'], ['rust', 'Metal roof: rust or backed out fasteners', 'g'], ['new', 'New roof: clean, even colour, fresh flashing', 'r'], ['work', 'Work underway, or a dumpster in the drive', '']];",
      "const CUES = [['tarp', 'Tarp or a temporary patch', 'g'], ['missing', 'Missing, lifted or creased shingles', 'g'], ['worn', 'Worn: curling, bare spots, dark streaks or moss', 'g'], ['tile', 'Tile: broken, slipped or missing tiles, open ridge or hip mortar', 'g'], ['shake', 'Wood shakes: split, cupped or missing', 'g'], ['ponding', 'Flat roof: ponding, blisters or open seams', 'g'], ['rust', 'Metal roof: rust or backed out fasteners', 'g'], ['burn', 'Fire: scorched, melted or burned roof, or a cleared lot', 'g'], ['debris', 'Leaves or needles in the valleys and gutters', ''], ['solar', 'Solar panels on the roof (a re-roof means a detach and reset)', ''], ['new', 'New roof: clean, even colour, fresh flashing', 'r'], ['work', 'Work underway, or a dumpster in the drive', '']];")
f.rep("/* ---------- the atlas's ZIP and parish shapes, back to latitude and longitude ---------- */", "/* ---------- the atlas's ZIP and county shapes, back to latitude and longitude ---------- */")
f.rep("const CTY = Object.entries(G0.parish || {}).map(", "const CTY = Object.entries(G0.parish || G0.county || {}).map(")   # the data keeps the key 'parish' for the 58 counties (SCHEMA.md, decision 1)
f.rep("  const LA_BOUNDS = [[G0.maxy - G0.H / G0.sx, G0.minx], [G0.maxy, G0.minx + G0.W / (G0.kx * G0.sx)]];",
"""  /* the box the atlas's map is drawn in (California with its neighbours' edges), the state's own outline, and whether a point is in the state */
  const ST_BOX = { s: G0.maxy - G0.H / G0.sx, w: G0.minx, n: G0.maxy, e: G0.minx + G0.W / (G0.kx * G0.sx) };
  const ST_BOUNDS = [[ST_BOX.s, ST_BOX.w], [ST_BOX.n, ST_BOX.e]];
  const ST_RINGS = (() => { try { return pathRings(G0.outline); } catch (e) { return []; } })();
  const ST_BB = ST_RINGS.length ? bboxOf(ST_RINGS) : [ST_BOX.s, ST_BOX.w, ST_BOX.n, ST_BOX.e];
  const inState = (la, lo) => isN(la) && isN(lo) && la >= ST_BB[0] - 0.02 && la <= ST_BB[2] + 0.02 && lo >= ST_BB[1] - 0.02 && lo <= ST_BB[3] + 0.02 && (!ST_RINGS.length || inRings(la, lo, ST_RINGS) || !!zipAt(la, lo));
  /* for the address search: the state's box, and its middle */
  const GEO_EXT = [ST_BB[1] - 0.05, ST_BB[0] - 0.05, ST_BB[3] + 0.05, ST_BB[2] + 0.05].map(v => v.toFixed(2)).join(','), GEO_MID = ((ST_BB[1] + ST_BB[3]) / 2).toFixed(2) + ',' + ((ST_BB[0] + ST_BB[2]) / 2).toFixed(2);""")
f.rep("""  /* ---------- addresses: one key for FEMA, the parcel roll and the two permit files ---------- */
  /* "632 WOODGATE BLVD", "2718 Saint Ann St", "435 E WOODGATE CT BATON ROUGE LA 70808" and "1030 Crete St Apt B" all come
     down to number|core name: suffixes and directions dropped, units and cities cut off. A New Orleans double's range
     ("2824-26 St Ann St", "2616/18 St Philip St") keys on its first number, as FEMA and the parcel roll do. */""",
"""  /* ---------- addresses: one key for the parcel rolls, the permit files and CAL FIRE's inspections ---------- */
  /* "200 N SPRING ST", "200 North Spring Street, Los Angeles, CA 90012", "627 E CALAVERAS ST, ALTADENA, CA 91001" and
     "1030 Larkin St Apt B" all come down to number|core name: suffixes and directions dropped, units, cities and ZIPs
     cut off. A range ("2824-26 Mission St", "2616/18 Folsom St") keys on its first number, and so does a half number
     ("1234 1/2 W 5th St": a rear unit, common in Los Angeles). A city written after the street with no comma is cut
     off when the caller names it (the parcel rolls give it in its own field). */""")
f.rep("""  function addrParts(s) {
    let t = String(s == null ? '' : s).toUpperCase().split(',')[0].replace(/^\\s*(\\d+)[A-Z]?\\s*[-\\/&]\\s*\\d+[A-Z]?\\b/, '$1').replace(/\\s+(BATON ROUGE|NEW ORLEANS|LAFAYETTE|BAKER|ZACHARY|CENTRAL|SCOTLANDVILLE)\\s+LA\\b.*$/, ' ').replace(/\\bLA\\s+\\d{5}(-\\d{4})?\\s*$/, ' ').replace(""",
"""  function addrParts(s, city) {
    let t = String(s == null ? '' : s).toUpperCase().split(',')[0].replace(/^\\s*(\\d+)\\s+\\d\\/\\d\\b/, '$1').replace(/^\\s*(\\d+)[A-Z]?\\s*[-\\/&]\\s*\\d+[A-Z]?\\b/, '$1').replace(/\\s+CA(LIFORNIA)?\\s+9\\d{4}(-\\d{4})?\\s*$/, ' ').replace(/\\s+9\\d{4}(-\\d{4})?\\s*$/, ' ');
    if (city) { const c = String(city).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\\s+/g, ' ').trim(); if (c && t.replace(/\\s+/g, ' ').trim().endsWith(' ' + c)) t = t.replace(/\\s+/g, ' ').trim().slice(0, -c.length); }
    t = t.replace(""")
f.block("  /* parishes whose parcel roll carries a year built in the public parcel layer", "  function ingest(fc, t) {", "")
f.save()
