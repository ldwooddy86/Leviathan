import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('02_map.js', [
 ("""      const xo = proj(-124.25, 42)[0], xm = proj(-117.12, 32.5)[0];
      this.gN.appendChild(svgEl('rect', { x: W - 1, y: -2 * H, width: 4 * W, height: 5 * H, class: 'nb', style: 'stroke:none' }));
      this.gN.appendChild(svgEl('rect', { x: xo, y: -2 * H, width: W - xo + 1, height: 2 * H + 1, class: 'nb', style: 'stroke:none' }));""",
  """      /* east of longitude 114.08 west everything in the frame is Nevada, Arizona or Sonora (California ends at 114.13),
         and north of latitude 42.005 everything east of the coast is Oregon: the rectangles reach that far into the frame
         so no sliver of sea shows where a neighbor's outline stops short of the frame's edge */
      const xo = proj(-124.25, 42)[0], xm = proj(-117.12, 32.5)[0], xe = proj(-114.08, 37)[0], yn = proj(-120, 42.005)[1];
      this.gN.appendChild(svgEl('rect', { x: xe, y: -2 * H, width: 4 * W, height: 5 * H, class: 'nb', style: 'stroke:none' }));
      this.gN.appendChild(svgEl('rect', { x: xo, y: -2 * H, width: W - xo + 1, height: 2 * H + yn, class: 'nb', style: 'stroke:none' }));"""),
])
