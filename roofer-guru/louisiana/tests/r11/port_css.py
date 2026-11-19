"""Round 11: the styles the new bar, the storm scale, gravity warp and the warning over the view need, added to
build/engine-style.css as port_card.py left it.   python3 -I tests/r11/port_css.py"""
import os
SP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
C = os.path.join(SP, 'build', 'engine-style.css')
c = open(C, encoding='utf-8').read()
assert 'sc-roofview' not in c
assert c.rstrip().endswith('</style>')
c = c.rstrip()[:-len('</style>')].rstrip('\n') + """
/* round 11: the bar in rows with Roof View first, the aircraft, gravity warp, the storm scale, and a warning laid over the view */
.sc .sc-enrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;min-width:0}
.sc .sc-enrow .seg button{padding:4px 9px}
.sc .sc-enlab{flex:0 0 auto;min-width:84px;font:700 10.5px/1.2 var(--sans);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}
.sc .sc-roofview{padding:8px 10px;border:1.5px solid #c9801f;border-radius:10px;background:linear-gradient(90deg,rgba(255,179,71,.2),rgba(255,179,71,.05))}
.sc .sc-roofview .sc-enlab{color:#9a5200;font-size:12.5px;min-width:84px}
.sc .sc-roofview .seg button{font-weight:650;padding:6px 11px;font-size:12.5px}
.sc .sc-roofview .seg button[aria-pressed="true"]{background:#c9801f;color:#fff;border-color:#c9801f}
.sc .sc-ldot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:-1px;box-shadow:0 0 0 1px rgba(0,0,0,.28)}
.sc .sc-ldot.l-cover{background:linear-gradient(135deg,#93a5cc 0 33%,#62d6f0 33% 66%,#f38d4c 66%)}
.sc .sc-ldot.l-style{background:linear-gradient(135deg,#82abff 50%,#ffc85c 50%)}
.sc .sc-ldot.l-thermal{background:linear-gradient(135deg,#5b1392,#f0752a,#fde96a)}
.sc .sc-ldot.l-wear{background:linear-gradient(135deg,#4f9a4a,#f0c53a,#d94a2a)}
.sc .sc-ldot.l-storm{background:linear-gradient(135deg,#235a7a,#d9c23a,#cf2a22)}
.sc .sc-ldot.l-time{background:linear-gradient(135deg,#58c0ff,#c08cff,#ffb347)}
.sc .sc-enhint{flex:1 1 280px;min-width:0}
.sc .sc-craft button{font-weight:650}
.sc .sc-craft button.nofly{text-decoration:line-through;opacity:.72}
.sc .sc-stormw{display:inline-flex;flex-direction:column;gap:1px;flex:0 1 470px;min-width:250px}
.sc .sc-stormw input[type=range]{width:100%;margin:0;accent-color:#b3261e}
.sc .sc-stormt{display:grid;grid-template-columns:repeat(10,1fr);font:10px/1.25 var(--sans);color:var(--ink-3);text-align:center}
.sc .sc-stormt i{font-style:normal;white-space:nowrap;overflow:hidden}
.sc .sc-stormt i.on{font-weight:700;color:#b3261e}
.sc .sc-storm output{flex:1 1 300px;min-width:0;font:12px/1.4 var(--sans);color:var(--ink-2)}
.sc .sc-fly{font:700 11px/1 var(--sans);padding:5px 9px;border-radius:999px;white-space:nowrap}
.sc .sc-fly.ok{background:rgba(31,138,76,.16);color:#17663a}
.sc .sc-fly.no{background:rgba(179,38,30,.16);color:#9c1c12}
.sc .sc-warp{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0;min-width:0}
.sc .sc-warp label{font:700 10.5px/1.2 var(--sans);letter-spacing:.06em;text-transform:uppercase;color:#5a32a3}
.sc .sc-warp input{width:min(290px,58vw);padding:5px 8px;border:1px solid var(--line-strong);border-radius:7px;font:12.5px var(--sans);background:var(--card);color:var(--ink)}
.sc .sc-warp select{max-width:130px;padding:5px 6px;border:1px solid var(--line-strong);border-radius:7px;font:12.5px var(--sans);background:var(--card);color:var(--ink)}
.sc .se-warn{position:absolute;left:50%;top:20%;transform:translateX(-50%);z-index:5;width:max-content;max-width:min(620px,calc(100% - 30px));padding:14px 22px;border-radius:12px;background:#b3261e;color:#fff;font:800 20px/1.3 var(--sans);text-align:center;box-shadow:0 6px 26px rgba(0,0,0,.55);border:2px solid #ffd9d4;pointer-events:none}
.sc .se-warn[hidden]{display:none}
.sc .se-hud-row span.se-hud-warp{padding:0 8px;border-radius:6px;background:#5a32a3;color:#fff;font-weight:800;letter-spacing:.08em;animation:se-pulse .5s ease-in-out infinite alternate}
@keyframes se-pulse{from{opacity:.6}to{opacity:1}}
.sc .se-warp{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 50%,#fff 0,#e8f6ff 18%,rgba(190,225,255,.78) 42%,rgba(120,170,255,0) 80%),repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,.55) 0 1.2deg,rgba(255,255,255,0) 1.2deg 5deg)}
.sc .se-warp.go{opacity:1;transition:opacity .34s ease-in}
.sc .se-warp.in{opacity:0;transition:opacity .9s ease-out}
@media (prefers-reduced-motion:reduce){.sc .se-warp.go{opacity:.35}.sc .se-hud-row span.se-hud-warp{animation:none}}
@media (max-width:620px){.sc .sc-enlab{min-width:0}.sc .se-warn{font-size:15px;top:15%;padding:10px 14px}.sc .sc-stormt{font-size:8.5px}}
</style>
"""
open(C, 'w', encoding='utf-8').write(c)
print('css ok', len(c))
