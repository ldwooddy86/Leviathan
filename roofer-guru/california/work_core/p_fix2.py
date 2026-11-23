import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('00_core.js', [("(no tropical cyclones)", "(the first edition drew storm tracks from them)")])
patch('13_m01_index.js', [
 ("so roofs here run older than in a hurricane state.", "so roofs here run older than in a state where storms replace them."),
 ("note: 'Hurricane force gusts at the same station:", "note: 'Gusts of 75 mph or more at the same station:"),
 ("leaves a clean roof damage record the way a hurricane does,", "leaves a clean roof damage record the way a landfalling storm does elsewhere,"),
 ("; gray means ${scoredNote}${nn ?", "; gray means ${scoredNote}, open land with no ZIP${nn ?"),
])
patch('16_m04_drivers.js', [
 ("this atlas has no claim driven line the size of a hurricane state's;", "this atlas has no claim driven line the size of the one in its first edition;"),
 ("reset roofs after every hurricane.", "reset roofs after every major storm."),
])
patch('02_map.js', [
 ("""      this.gN.appendChild(svgEl('rect', { x: W - 1, y: -2 * H, width: 4 * W, height: 5 * H, class: 'nb' }));
      this.gN.appendChild(svgEl('rect', { x: xo, y: -2 * H, width: W - xo + 1, height: 2 * H + 1, class: 'nb' }));
      this.gN.appendChild(svgEl('rect', { x: xm, y: H - 1, width: W - xm + 1, height: 2 * H, class: 'nb' }));
    }
    nbs.forEach(d => this.gN.appendChild(svgEl('path', { d, class: 'nb' })));""",
  """      this.gN.appendChild(svgEl('rect', { x: W - 1, y: -2 * H, width: 4 * W, height: 5 * H, class: 'nb', style: 'stroke:none' }));
      this.gN.appendChild(svgEl('rect', { x: xo, y: -2 * H, width: W - xo + 1, height: 2 * H + 1, class: 'nb', style: 'stroke:none' }));
      this.gN.appendChild(svgEl('rect', { x: xm, y: H - 1, width: W - xm + 1, height: 2 * H, class: 'nb', style: 'stroke:none' }));
    }
    nbs.forEach(d => this.gN.appendChild(svgEl('path', { d, class: 'nb' })));
    /* the state itself under the ZIPs: desert, forest and high country that no ZIP covers reads as land, not as sea */
    this.gN.appendChild(svgEl('path', { d: GEO.outline, class: 'land' }));"""),
])
patch('html_00.html', [
 (".mapsvg .lab.wtl.big{font-size:15px;letter-spacing:.12em}", ".mapsvg .lab.wtl.big{font-size:15px;letter-spacing:.12em}\n.mapsvg .land{fill:var(--nodata);stroke:none;pointer-events:none}"),
])
patch('31_m17_stock.js', [("Eight quantile classes across the ZIPs with 500 or more residents; gray ZIPs have fewer.", "Eight quantile classes across the ZIPs with 500 or more residents; gray ZIPs have fewer, and gray land with no ZIP is open country.")])
