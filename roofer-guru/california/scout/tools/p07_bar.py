"""California: the engine bar (Roof View, Move with the M3, Weather with the rain scale, the dry wind scale and the sky)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import F
f = F()
f.block("      function whereEn(st) {", "      const whereEnSoon = debounce(", f.blk('b12_bar2.js'))
f.rep("x.hidden = !(stNow.mode === 'alta' || stNow.mode === 'saucer' || stNow.mode === 'tictac'); }); } }, 120);", "x.hidden = !(stNow.mode === 'alta' || stNow.mode === 'saucer' || stNow.mode === 'tictac'); }); const wo = $('#scEnStormO', root); if (wo) { wxSync(); wo.innerHTML = wxLine(); } } }, 120);")
f.block("      /* the storm scale's steps, short, for under its slider; and what the step in force is, in a line */", "      /* gravity warp: places it will go", f.blk('b12_bar1.js'))
f.rep("""<div class="sc-gfxr"><span class="mini">Weather</span>${seg('weather', g.weather, [['clear', 'Clear'], ['cloudy', 'Cloudy'], ['overcast', 'Overcast'], ['haze', 'Haze']])}</div>""",
      """<div class="sc-gfxr"><span class="mini">Clouds</span>${seg('weather', g.weather, [['clear', 'Clear'], ['cloudy', 'Cloudy'], ['overcast', 'Overcast'], ['haze', 'Haze']])}</div>""")
f.rep("<p class=\"mini\">The weather here is the dry kinds: rain and storms are on the storm scale. A view at rest settles:", "<p class=\"mini\">The clouds here are the dry kinds: rain, atmospheric rivers, offshore wind, the marine layer, tule fog and smoke are in the Weather row. A view at rest settles:")
f.rep("Buildings stand on their FEMA footprints at their recorded heights with Esri's imagery on their roofs;", "Buildings stand on their FEMA footprints at their recorded heights (a usual height for the building's kind where FEMA has none, which is most of California outside the metros) with Esri's imagery on their roofs;")
f.rep("lens = gNow ? gNow.lens : 'off', lv = gNow ? gNow.storm || 0 : 0, fly = !gNow || !gNow.stormInfo || gNow.stormInfo.fly, isU = mode === 'saucer' || mode === 'tictac';",
      "lens = gNow ? gNow.lens : 'off', H = enHas(), wxn = wxSync(), fly = altaFly(), isU = mode === 'saucer' || mode === 'tictac', isCar = mode === 'm3', ri = Math.max(0, WX_RAIN.findIndex(x => x.id === wxn.rain)), wi = Math.max(0, WX_WIND.findIndex(x => x.id === wxn.wind));")
f.rep("'Off. Pick a view to read every roof round you: what covers it, which shingle, its heat, its wear, what a storm would do to it, and the years ahead. <b>X</b> in the view steps through them.'",
      "'Off. Pick a view to read every roof round you: what covers it, which shingle, its heat, its wear, what the weather on the scales would do to it, its fire class and zone, its sun and cool roof rule, and the years ahead. <b>X</b> in the view steps through them.'")
f.block("          <div class=\"sc-enrow\" role=\"group\" aria-label=\"How you move\">", "          <div class=\"sc-svctl\">", f.blk('b12_bar3.js').replace("reported off San Diego in 2004", "reported in 2004"))
f.rep("$$('[data-h]', enBar).forEach(x => x.onclick = () => { if (en) { en.setHeight(x.dataset.h); renderEnBar(); focusEn(); } });",
      "$$('[data-h]', enBar).forEach(x => x.onclick = () => { if (!en) return; if (x.dataset.h === 'alta' && !altaFly()) toast(NOFLY); en.setHeight(x.dataset.h); renderEnBar(); focusEn(); });\n        $$('[data-car]', enBar).forEach(x => x.onclick = () => { if (!en || !en.car) return; const a = x.dataset.car; try { if (a === 'camera') en.car.camera(); else if (a === 'reset') en.car.reset(); else if (a === 'tc') toast('Traction control ' + (en.car.tc() ? 'on' : 'off')); } catch (e) { /* the car is not out */ } setTimeout(renderEnBar, 60); focusEn(); });")
f.block("        /* the storm scale slides without the bar being drawn again under the hand */", "        $$('[data-eg]', enBar).forEach(", """        /* the scales slide without the bar being drawn again under the hand */
        const scale = (sel0, list, set) => { const sr = $(sel0, enBar); if (!sr) return; sr.oninput = () => { const v = clamp(Math.round(+sr.value), 0, list.length - 1); set(list[v].id); const ok = altaFly(), fl = $('.sc-fly', enBar), ab = $('[data-h="alta"]', enBar); $('#scEnStormO', enBar).innerHTML = wxLine(); sr.setAttribute('aria-valuetext', list[v].l); $$('.sc-stormt i', sr.parentNode).forEach((x, k) => x.classList.toggle('on', k === v)); if (fl) { fl.className = 'sc-fly ' + (ok ? 'ok' : 'no'); fl.textContent = ok ? 'Alta X can fly' : 'Alta X grounded'; fl.title = ok ? 'Freefly designs the Alta X to withstand light rain (IP43)' : NOFLY; } if (ab) ab.classList.toggle('nofly', !ok); };
          sr.onchange = () => { const had = document.activeElement === sr; renderEnBar(); const n2 = $(sel0, enBar); if (had && n2) { try { n2.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }; };
        scale('#scEnRain', WX_RAIN, setRain); scale('#scEnWind', WX_WIND, setWind);
        $$('[data-sky]', enBar).forEach(x => x.onclick = () => { setSky(x.dataset.sky); renderEnBar(); });
""")
f.rep("en.setGraphics(k === 'trees' || k === 'life' || k === 'live' || k === 'wide' || k === 'roofKit' ? { [k]: v === 'on' } : { [k]: v }); renderEnBar(); });", "en.setGraphics(k === 'trees' || k === 'life' || k === 'live' || k === 'wide' || k === 'roofKit' || k === 'air' ? { [k]: v === 'on' } : { [k]: v }); renderEnBar(); });")
f.rep("if (['alta', 'saucer', 'tictac'].includes(en.state().mode)) { en.hold(k, true);", "if (['alta', 'saucer', 'tictac', 'm3'].includes(en.state().mode)) { en.hold(k, true);")
f.save()
