"""California: the CSV, the method, the caveats, the gaps and the source register."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import F
f = F()
f.block("        const header = ['status',", "      }\n\n      /* ---------- the method, settings", f.blk('b13_csv.js'))
f.block("      /* for the method's text: the wind hazard a covering takes", "      $('#scMeth', root).innerHTML = method();", f.blk('b14_method.js'))
f.block("      $('#scCav', root).innerHTML = proseTable([", "      /* ---------- the map's events and the first view ---------- */", f.blk('b15_docs.js'))
f.save()
