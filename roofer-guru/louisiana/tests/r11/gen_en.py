"""Round 11: the Scout Engine's bar in the dashboard. Reads tests/r11/en_block.pre_r11.js (round 10's, as shipped) and
writes tests/r11/en_block.js: the bar in rows with Roof View first and plain to see, the three aircraft, gravity warp to
an address or coordinates in Louisiana, and the storm scale. Every anchor must occur exactly once.
  python3 -I tests/r11/gen_en.py"""
import os
D = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(D, 'en_block.pre_r11.js'), encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:110])
    s = s.replace(a, b)
def line(prefix):
    """the one whole line that starts with prefix"""
    L = [x for x in s.split('\n') if x.startswith(prefix)]
    assert len(L) == 1, (len(L), prefix[:80])
    return L[0]

# ---- what the view is, said under the switch ----
rep(line("      const EN_NOTE = '"),
    "      const EN_NOTE = 'The neighborhood in the Scout Engine: every building the dashboard holds on its FEMA footprint at its recorded height (a usual one for its kind where none is on file) under a physical sky, the city going on to the skyline. Roof View reads every roof six ways: what covers it, which shingle it is, how hot it runs, how worn it is, what the storm on the storm scale would do to it, and the damage most likely over the next 15 years. The storm scale runs from light rain to a Category 5 hurricane. Walk, circle a building or fly an Alta X; past light rain the Alta X stays on the ground, and the flying saucer and the Tic Tac fly instead and warp to any address or coordinates in Louisiana. Window grids, cars, signals, sidewalks, rooftop equipment, the weather and the two craft are generated, not observed; the roof views are a model, not an inspection.';")

# ---- what the engine asks of the module ----
rep("        label: b => `${STS[b.status]} · ${b.sc.score}`,\n",
    "        label: b => `${STS[b.status]} · ${b.sc.score}`,\n"
    "        /* the flood the engine lays over the ground in a Category 3 to 5 near the Gulf: a picture, not a forecast (LENS.surge) */\n"
    "        surge: (la, lo, level) => LENS.surge(la, lo, level),\n"
    "        /* gravity warp: once the craft is there the building at the place is picked as its tiles arrive; G in the view asks where to */\n"
    "        onWarp: stage => { if (stage === 'there') setTimeout(tryPending, 700); if (stage === 'done') { warping = false; clearTimeout(warpT); renderEnBar(); } },\n"
    "        onWarpAsk: () => { const i = $('#scWarp', enBar); if (i) { i.focus(); i.select(); } },\n")

# ---- where you are ----
rep(": ''}` : 'Circling';", ": ''}` : st.mode === 'saucer' || st.mode === 'tictac' ? `In ${st.mode === 'saucer' ? 'the flying saucer' : 'the Tic Tac'}${st.uap ? ' (' + esc(st.uap.mode.toLowerCase()) + ', ' + N(Math.round(st.uap.alt)) + ' m up, ' + N(Math.round(st.uap.speed * 2.237)) + ' mph)' : ''}` : 'Circling';")
rep("        const keys = st.mode === 'alta' ? ", "        const keys = st.mode === 'saucer' || st.mode === 'tictac' ? 'Drag to look round it; <b>W</b> <b>S</b> <b>A</b> <b>D</b> fly (faster the higher it is, and faster still on <b>Shift</b>), <b>←</b> <b>→</b> turn, <b>↑</b> <b>↓</b> climb and descend, <b>C</b> its camera, <b>X</b> the roof views, <b>G</b> gravity warp; click the ground to go there, double click a roof to hang over it.' : st.mode === 'alta' ? ")
rep("return `${on}, looking ${compass(st.yaw)} · <b>${N(st.built)}</b> buildings", "return `${on}, looking ${compass(st.yaw)}${g && g.storm ? ' · <b>' + esc(g.stormInfo.name) + '</b>' + (g.surgeNote ? ': ' + esc(g.surgeNote) : '') : ''} · <b>${N(st.built)}</b> buildings")
rep("$$('#scEnPad .sc-enalt', root).forEach(x => { x.hidden = stNow.mode !== 'alta'; });", "$$('#scEnPad .sc-enalt', root).forEach(x => { x.hidden = !(stNow.mode === 'alta' || stNow.mode === 'saucer' || stNow.mode === 'tictac'); });")
rep("if (en.state().mode === 'alta') { en.hold(k, true);", "if (['alta', 'saucer', 'tictac'].includes(en.state().mode)) { en.hold(k, true);")
rep("      let enGfxOpen = false, enPlayT = 0;\n", """      let enGfxOpen = false, enPlayT = 0, warping = false, warpT = 0, warpQ = '', enSound = false;
      /* the storm scale's steps, short, for under its slider; and what the step in force is, in a line */
      const STORM_T = ['Dry', 'Light', 'Heavy', 'T-storm', 'Tropical', 'Cat 1', 'Cat 2', 'Cat 3', 'Cat 4', 'Cat 5'];
      const stormText = g => { const x = g && g.stormInfo; if (!x || !x.level) return '<b>No storm</b> · the weather is the Scene menu\\'s. Slide right for rain, wind and hurricanes.';
        return `<b>${esc(x.name)}</b> · wind ${x.range ? (x.range[1] ? x.range[0] + ' to ' + x.range[1] : x.range[0] + ' and up') : 'about ' + x.mph} mph${x.level >= 3 ? ', gusts near ' + x.gust : ''} · rain drawn at ${x.rain} mm an hour${x.level >= 7 ? (g.surge > 0.05 ? ` · surge drawn ${D(g.surge * 3.281, 0)} ft deep here (a picture, not a flood map)` : ' · no surge drawn here (the picture\\'s edge, not the water\\'s)') : x.level >= 5 ? ' · no flood is drawn below Category 3, though such storms bring surge too' : ''}`; };
      /* gravity warp: places it will go. Louisiana only: the state's outline is the atlas's own */
      const WARP_TO = [['New Orleans', 29.9511, -90.0715], ['Baton Rouge', 30.4515, -91.1871], ['Shreveport', 32.5252, -93.7502], ['Lafayette', 30.2241, -92.0198], ['Lake Charles', 30.2266, -93.2174], ['Houma', 29.5958, -90.7195], ['Monroe', 32.5093, -92.1193], ['Alexandria', 31.3113, -92.4451], ['Slidell', 30.2752, -89.7812], ['Hammond', 30.5044, -90.4612], ['Grand Isle', 29.2366, -89.9873], ['Cameron', 29.7977, -93.3252]];
      const LA_RINGS = (() => { try { return pathRings(G0.outline); } catch (e) { return []; } })();
      const inLouisiana = (la, lo) => isN(la) && isN(lo) && la > 28.8 && la < 33.1 && lo > -94.1 && lo < -88.7 && (!LA_RINGS.length || inRings(la, lo, LA_RINGS));
      async function warpGo(q, city) {
        if (!en || warping || !q) return; const st0 = en.state(); if (!st0 || !st0.uap) { toast('Take out the flying saucer or the Tic Tac first'); return; }
        let la, lo, label; const m = /^\\s*(-?\\d{1,3}(?:\\.\\d+)?)\\s*°?\\s*([NnSs])?\\s*[,;\\s]\\s*(-?\\d{1,3}(?:\\.\\d+)?)\\s*°?\\s*([WwEe])?\\s*$/.exec(q);
        if (city) { la = city[1]; lo = city[2]; label = city[0]; }
        else if (m) { la = +m[1]; lo = +m[3]; const ns = (m[2] || '').toUpperCase(), ew = (m[4] || '').toUpperCase(); if (!ns && !ew && Math.abs(la) > 60 && Math.abs(lo) < 60) { const t2 = la; la = lo; lo = t2; } if (ns === 'S') la = -Math.abs(la); if (ew === 'W') lo = -Math.abs(lo); else if (ew === 'E') lo = Math.abs(lo); else if (lo > 0) lo = -lo; label = la.toFixed(4) + ', ' + lo.toFixed(4); }
        else { if (VIEWER) { toast('Address search needs the network'); return; }
          try { const j = await getJSON(EP.geocode + '?' + qs({ f: 'json', singleLine: q, maxLocations: 1, outFields: 'Match_addr,Addr_type', searchExtent: '-94.1,28.9,-88.8,33.1', location: '-91.6,30.9', countryCode: 'USA' }), { timeout: 15000 });
            const c = (j.candidates || [])[0]; if (!c || c.score < 75 || !c.location) { toast('No match in Louisiana for that address'); return; } la = c.location.y; lo = c.location.x; label = c.address; }
          catch (err) { toast('Address search failed: ' + why(err)); return; } }
        if (!inLouisiana(la, lo)) { toast('Louisiana roofs only: that place is outside the state'); return; }
        if (!en || !en.uap.warp(la, lo, { cur: null })) { toast('It cannot warp just now'); return; }
        pendingPick = { lat: la, lon: lo }; warping = true; warpQ = ''; clearTimeout(warpT); warpT = setTimeout(() => { warping = false; renderEnBar(); }, 25000); toast('Gravity warp: ' + label); renderEnBar(); try { en.canvas.focus({ preventScroll: true }); } catch (e) { /* fine */ }
      }
""")

# ---- the Scene menu: the dry weathers, the engine's tools, and what a settled view is ----
rep("['overcast', 'Overcast'], ['rain', 'Rain'], ['haze', 'Haze']", "['overcast', 'Overcast'], ['haze', 'Haze']")
rep("        const g = en ? en.graphics() : null; if (!g) return '';\n        const seg = ", "        const g = en ? en.graphics() : null; if (!g) return ''; const ed = !!(en && en.editing);\n        const seg = ")
rep('            <p class="mini">Ultra and High:', '            <div class="sc-gfxr"><span class="mini">Engine tools</span><button type="button" class="ibtn" data-a="editor" aria-pressed="${ed}" title="The engine\'s editor: outliner, details, world settings, gizmos, buffer views, profiler">${ed ? \'Close editor\' : \'Editor\'}</button><button type="button" class="ibtn" data-a="crate" title="Throw a crate from the camera: it falls, tumbles and comes to rest on the ground or a roof">Throw a crate</button></div>\n            <p class="mini">The weather here is the dry kinds: rain and storms are on the storm scale. A view at rest settles: each pixel averages the frames it has gathered, so edges, window bars and pavement hold still instead of shimmering, and sharpens over about a second after you stop. Ultra and High:')

# ---- the bar ----
L_prev = line('            ${b && svList.length > 1 ? `<button type="button" class="ibtn" data-a="prev"')
L_move = line('            <span class="seg" role="group" aria-label="How you move">')
L_lens = line('            <span class="seg sc-lens" role="group" aria-label="Roof view">')
L_year = line("            ${lens === 'time' ? `<span class=\"sc-enyear\">")
L_day = line("            ${lens === 'thermal' && gNow ? `<span class=\"seg\" role=\"group\" aria-label=\"Day of the year\">")
L_alta = line("            ${mode === 'alta' ? `<span class=\"seg\" role=\"group\" aria-label=\"The Alta X\">")
L_face = line("            ${b ? '<button type=\"button\" class=\"ibtn\" data-a=\"face\"")
L_ck = line('            ${b ? `<span class="seg sc-svck" role="group" aria-label="Your field check">')
L_menu = line('            ${enMenu()}')
L_ed = line('            <button type="button" class="ibtn" data-a="editor"')
L_crate = line('            <button type="button" class="ibtn" data-a="crate"')
L_full = line('            <button type="button" class="ibtn" data-a="full">')
L_classic = line('            <button type="button" class="ibtn" data-a="classic"')
L_map = line('            <button type="button" class="btn sm" data-a="map">')
old = '\n'.join(['          <div class="sc-svctl">', L_prev, L_move, L_lens, L_year, L_day, L_alta, L_face, L_ck, L_menu, L_ed, L_crate, L_full, L_classic, L_map, '          </div>'])
new = '\n'.join([
    '          <div class="sc-enrow sc-roofview" role="group" aria-label="Roof View">',
    '            <span class="sc-enlab" title="Read every roof in view. X in the view steps through them">Roof View</span>',
    '            <span class="seg sc-lens">${LENS.list.map(([k, l, tip]) => `<button type="button" data-lens="${k}" aria-pressed="${lens === k}" title="${esc(tip)}">${k === \'off\' ? \'\' : `<i class="sc-ldot l-${k}" aria-hidden="true"></i>`}${l}</button>`).join(\'\')}</span>',
    L_year, L_day,
    '            <span class="mini sc-enhint">${lens === \'off\' ? \'Off. Pick a view to read every roof round you: what covers it, which shingle, its heat, its wear, what a storm would do to it, and the years ahead. <b>X</b> in the view steps through them.\' : esc((LENS.list.find(x => x[0] === lens) || [0, 0, \'\'])[2]) + \'.\'}</span>',
    '          </div>',
    '          <div class="sc-enrow" role="group" aria-label="How you move">',
    '            <span class="sc-enlab">Move</span>',
    '            <span class="seg">${[[\'street\', \'Street\', \'Along the streets and alleys\'], [\'walk\', \'Walk\', \'On foot anywhere, stopped by walls\'], [\'drone\', \'Drone\', \'38 m up: the height a roof inspection drone flies\'], [\'bird\', \'Bird\', \'120 m up\'], [\'metro\', \'Metro\', \'1,400 m up: the city for kilometres round, to the skyline\'], [\'orbit\', \'Orbit\', \'Circle the building\']].map(([k, l, tip]) => `<button type="button" data-h="${k}" aria-pressed="${mode === k}" title="${tip}">${l}</button>`).join(\'\')}</span>',
    '            <span class="seg sc-craft" role="group" aria-label="Aircraft">${[[\'alta\', \'Alta X\', fly ? \'Fly a Freefly Alta X Gen2, built to its published dimensions: it takes off, holds position, lands on roofs, and runs its batteries down in the published time. It flies dry or in light rain only\' : \'The atlas keeps the Alta X down in this weather: Freefly designs it to withstand light rain (IP43) and publishes no limit beyond that\'], [\'saucer\', \'Flying saucer\', \'Drawn after the classic flying saucer of the 1950s photographs; here it flies in any weather, faster the higher it is, and warps to an address or coordinates in Louisiana, standing on its edge first\'], [\'tictac\', \'The Tic Tac\', \'Drawn after the white object Navy pilots from the Nimitz reported in 2004; here it flies in any weather and warps to an address or coordinates in Louisiana without turning on its side\']].map(([k, l, tip]) => `<button type="button" data-h="${k}" aria-pressed="${mode === k}" class="${k === \'alta\' && !fly ? \'nofly\' : \'\'}" title="${esc(tip)}">${l}</button>`).join(\'\')}</span>',
    L_alta,
    '            ${isU ? `<span class="seg" role="group" aria-label="The craft"><button type="button" data-ua="camera" title="Look down from under it, or from behind it (C)">${gNow && gNow.uapCam === \'belly\' ? \'Chase view\' : \'Look down\'}</button></span><form class="sc-warp" id="scWarpF" autocomplete="off"><label for="scWarp">Gravity warp to</label><input type="search" id="scWarp" placeholder="An address in Louisiana, or 29.9511, -90.0715" value="${esc(warpQ)}"${warping ? \' disabled\' : \'\'}><select id="scWarpTo" aria-label="Or a Louisiana city"${warping ? \' disabled\' : \'\'}><option value="">or a city</option>${WARP_TO.map(c => `<option>${c[0]}</option>`).join(\'\')}</select><button type="submit" class="btn sm"${warping ? \' disabled\' : \'\'}>${warping ? \'Warping\' : \'Warp\'}</button></form>` : \'\'}',
    '          </div>',
    '          <div class="sc-enrow sc-storm" role="group" aria-label="Storm scale">',
    '            <span class="sc-enlab">Storm scale</span>',
    '            <span class="sc-stormw"><input type="range" id="scEnStorm" min="0" max="9" step="1" value="${lv}" aria-label="Storm scale: dry, light rain, heavy rain, severe thunderstorm, tropical storm, then hurricane Categories 1 to 5" aria-valuetext="${esc(gNow && gNow.stormInfo ? gNow.stormInfo.name : \'No storm\')}"><span class="sc-stormt" aria-hidden="true">${STORM_T.map((x, k) => `<i class="${k === lv ? \'on\' : \'\'}">${x}</i>`).join(\'\')}</span></span>',
    '            <output id="scEnStormO" for="scEnStorm">${stormText(gNow)}</output>',
    '            <span class="sc-fly ${fly ? \'ok\' : \'no\'}">${fly ? \'Alta X can fly\' : \'Alta X grounded\'}</span>',
    '            <button type="button" class="ibtn" data-a="sound" aria-pressed="${enSound}" title="The rain, the wind and the thunder, which comes later by its distance">${enSound ? \'Sound on\' : \'Sound off\'}</button>',
    '          </div>',
    '          <div class="sc-svctl">',
    L_prev, L_face, L_ck, L_menu, L_full, L_classic, L_map,
    '          </div>'])
rep(old, new)
rep("ed = !!(en && en.editing), gNow = en ? en.graphics() : null, lens = gNow ? gNow.lens : 'off';", "ed = !!(en && en.editing), gNow = en ? en.graphics() : null, lens = gNow ? gNow.lens : 'off', lv = gNow ? gNow.storm || 0 : 0, fly = !gNow || !gNow.stormInfo || gNow.stormInfo.fly, isU = mode === 'saucer' || mode === 'tictac';")

# ---- what the new controls do ----
rep("          else if (a === 'play' && en) { enPlay(!enPlayT); renderEnBar(); }", "          else if (a === 'play' && en) { enPlay(!enPlayT); renderEnBar(); }\n          else if (a === 'sound' && en) { enSound = !!en.sound(!enSound); renderEnBar(); }")
rep("        const gd = $('#scEnGfx', enBar); if (gd) gd.addEventListener('toggle', () => { enGfxOpen = gd.open; });",
    """        const gd = $('#scEnGfx', enBar); if (gd) gd.addEventListener('toggle', () => { enGfxOpen = gd.open; });
        $$('[data-ua]', enBar).forEach(x => x.onclick = () => { if (en) { en.uap.camera(); renderEnBar(); focusEn(); } });
        const wf = $('#scWarpF', enBar); if (wf) { const wi = $('#scWarp', enBar), ws = $('#scWarpTo', enBar); wf.onsubmit = e => { e.preventDefault(); warpGo(wi.value.trim()); }; wi.oninput = () => { warpQ = wi.value; }; ws.onchange = () => { const c = WARP_TO.find(x => x[0] === ws.value); if (c) warpGo(c[0], c); }; }
        /* the storm scale slides without the bar being drawn again under the hand */
        const sr = $('#scEnStorm', enBar); if (sr) { sr.oninput = () => { if (!en) return; const v = +sr.value, g2 = en.setGraphics({ storm: v }), ok = !g2.stormInfo || g2.stormInfo.fly, f = $('.sc-fly', enBar); $('#scEnStormO', enBar).innerHTML = stormText(g2); sr.setAttribute('aria-valuetext', g2.stormInfo ? g2.stormInfo.name : 'No storm'); $$('.sc-stormt i', enBar).forEach((x, k) => x.classList.toggle('on', k === v)); if (f) { f.className = 'sc-fly ' + (ok ? 'ok' : 'no'); f.textContent = ok ? 'Alta X can fly' : 'Alta X grounded'; } }; sr.onchange = () => { const had = document.activeElement === sr; renderEnBar(); const n2 = $('#scEnStorm', enBar); if (had && n2) { try { n2.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }; }""")

open(os.path.join(D, 'en_block.js'), 'w', encoding='utf-8').write(s)
print('en ok', len(s))
