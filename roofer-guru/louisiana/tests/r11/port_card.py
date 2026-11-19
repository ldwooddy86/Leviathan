"""Round 10, step 4: the card's 15 year outlook and the roof views' styles. Runs after port_engine.py, on build/scout.js and
build/engine-style.css as they then stand. Every anchor must occur exactly once.  python3 -I tests/r11/port_card.py"""
import os
SP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(SP, 'build', 'scout.js')
s = open(P, encoding='utf-8').read()
card = open(os.path.join(SP, 'tests', 'r11', 'card_block.js'), encoding='utf-8').read()


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:100])
    s = s.replace(a, b)


assert 'function outlookCard' not in s, 'the card block is already in build/scout.js: run port_engine.py first'
rep("      function detail() {\n", card + "      function detail() {\n")
a = "mobile homes, condominiums and recently built homes are not eligible (module 03) ${G('B')}</p>` : ''}</div>\n"
rep(a, a + "          ${hasRoof ? outlookCard(b) : ''}\n")
a = "        $('#scSv1', dt).onclick = () => { open3D({ lat: b.lat, lon: b.lon, street: b.street, b }); mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); };\n"
rep(a, a + "        outlookWire(b);\n")
open(P, 'w', encoding='utf-8').write(s)

# the roof views' key and the year control, in the engine's style sheet (from build 12's, less its heating and cooling panel, plus these)
C = os.path.join(SP, 'build', 'engine-style.css')
c = open(os.path.join(SP, 'dfw12', 'engine-style.css'), encoding='utf-8').read()
# build 12's panel of heating and cooling evidence is not carried: its rules go, the scrolling key stays
i0, j0 = c.index('.sc .se-leg-grid{display:grid'), c.index('@media (max-width:620px){.sc .se-hud-keys{display:none}')
assert i0 < j0
c = c[:i0] + c[j0:]
a = ".sc .se-leg-cur{margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,.18);color:#e9f0f3} .sc .se-leg-cur b{display:block;color:#fff}\n"
assert c.count(a) == 1
c = c.replace(a, ".sc .se-leg-cur{margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,.18);color:#e9f0f3} .sc .se-leg-cur b{color:#fff} .sc .se-leg-cur>b:first-child{display:block}\n"
    + "/* the roof views: the scale under each view's name, the marks, the year of the Time view, the outlook in the card */\n"
    + ".sc .se-legend{width:min(336px,calc(100% - 20px))}\n"
    + ".sc .se-ramp{display:block;height:9px;border-radius:3px;margin:3px 0 1px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}\n"
    + ".sc .se-ticks{display:flex;justify-content:space-between;font-size:10px;color:#c5d0d5;margin-bottom:3px;font-variant-numeric:tabular-nums} .sc .se-ticks i{font-style:normal}\n"
    + ".sc .se-leg-row b{margin-left:auto;color:#fff;font-variant-numeric:tabular-nums}\n"
    + ".sc .se-leg-marks{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:center;color:#c5d0d5;font-size:10.5px;margin-top:2px}\n"
    + ".sc .se-leg-marks span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap} .sc .se-leg-marks i{display:inline-block;width:13px;height:8px;border-radius:2px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.3)}\n"
    + ".sc .se-leg-marks .m1{background:repeating-linear-gradient(90deg,#0a0d12 0 4px,#8fa3ad 4px 6px)} .sc .se-leg-marks .m2{background:radial-gradient(circle,#fff 0 2px,#55606a 2.6px)} .sc .se-leg-marks .m3{background:#3a2a26} .sc .se-leg-marks .m4{background:linear-gradient(180deg,#0c2a0c,#4f8a3a)} .sc .se-leg-marks .m5{background:#8a2a12}\n"
    + ".sc .se-leg-cur .se-leg-note{display:block;margin:3px 0 0}\n"
    + ".sc .sc-enyear{display:inline-flex;gap:7px;align-items:center;flex:0 1 340px} .sc .sc-enyear input[type=range]{flex:1 1 130px;min-width:90px} .sc .sc-enyear output{font-variant-numeric:tabular-nums;font-size:11.5px;min-width:122px;color:var(--ink-2)}\n"
    + ".sc .sc-outch{display:block;width:100%;height:auto;margin:6px 0 2px}\n"
    + ".sc .sc-outkey{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:11.5px;color:var(--ink-2);margin-bottom:6px} .sc .sc-outkey i{display:inline-block;width:14px;height:3px;border-radius:2px;vertical-align:middle;margin-right:5px} .sc .sc-outkey b{color:var(--ink);font-variant-numeric:tabular-nums}\n"
    + ".sc .sc-outt{width:100%;max-width:100%;min-width:0;table-layout:fixed;border-collapse:collapse;font-size:11.5px;margin:6px 0 2px} .sc .sc-outt th,.sc .sc-outt td{padding:3px 4px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;white-space:normal;overflow-wrap:anywhere;min-width:0} .sc .sc-outt th{font-weight:600;color:var(--ink-3);font-size:10.5px;letter-spacing:0;text-transform:none;line-height:1.2} .sc .sc-outt th:first-child{width:36%} .sc .sc-outt .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;overflow-wrap:normal} .sc .sc-outwhy{display:block;color:var(--ink-3);font-size:10.5px;line-height:1.3}\n"
    + ".sc .sc-outmore{margin:6px 0 4px} .sc .sc-outmore summary{cursor:pointer;font-size:12px;color:var(--ink-2)} .sc .sc-outkind{margin:8px 0 2px;font-size:12px} .sc .sc-outdo{margin:0 0 4px;padding-left:16px;font-size:11.5px;line-height:1.4;color:var(--ink-2);overflow-wrap:anywhere} .sc .sc-outdo li{margin:3px 0} .sc .sc-outdo b{color:var(--ink);font-weight:600}\n"
    + ".sc .sc-outctl{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin-top:8px}\n")
c = c.replace("/* the drone's instruments and the x-ray's key: plain text over the picture, on a dark plate so they read on any sky */",
              "/* the drone's instruments and the roof views' key: plain text over the picture, on a dark plate so they read on any sky */")
c = c.replace("/* ==== rooftop scout: the Scout Engine's view and its editor ==== */", "/* ==== rooftop scout: the Scout Engine's view, its roof views and its editor ==== */")
open(C, 'w', encoding='utf-8').write(c)
print('ok', len(s), len(c))
