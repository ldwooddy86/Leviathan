import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('html_00.html', [
 ('.mapsvg{max-height:calc(100vh - 96px);min-height:380px}',
  '.mapsvg{max-height:calc(100vh - 96px);min-height:380px}\n.mapsvg .lab.wtl{font-family:var(--sans);font-style:italic;font-weight:500;font-size:11.5px;fill:var(--ink-3);letter-spacing:.04em}\n.mapsvg .lab.wtl.big{font-size:15px;letter-spacing:.12em}'),
])
