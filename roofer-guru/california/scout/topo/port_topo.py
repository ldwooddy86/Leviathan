"""Puts the terrain block into the Scout module.

   python3 -I port_topo.py <scout.js in> <scout.js out> [<scout-style.css in> <scout-style.css out>]

   The block's own files (this folder) go in front of the Scout script as scripts of their own:
     topo_grid.js (statewide grid), topo_prov.js (provinces, coast), topo_gaz.js (names), topo_extra_data.js and
     topo_extra.js when they exist (climate zones, snow load, profile tool, province notes), topo_block.js.
   Five anchored replacements in scout.js, each asserted to occur exactly once:
     1. the file's opening  <script id="scout-js">           : the block's scripts are put in front of it
     2. LF.control.scale(                                     : the one init call (var TOPO) and the CSV helper, before it
     3. function detail() {                                   : wrapped, so the card gets its terrain section after each draw
     4. $('#scCsv', root).onclick = () => exportCSV();        : the terrain tiles under the view are fetched before the export
     5. toCSV(header, rows,                                   : the terrain columns and their note are added
   and one in the stylesheet: its closing </style>.
   Running it on a file that already carries the block is refused."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
def rd(p):
    with open(p, encoding='utf-8') as f: return f.read()
if len(sys.argv) not in (3, 5): sys.exit(__doc__)
src = rd(sys.argv[1])
if '__SCOUT_TOPO__' in src: sys.exit('this scout.js already carries the terrain block')

def once(text, anchor, new, what):
    n = text.count(anchor)
    assert n == 1, 'anchor for %s occurs %d times, wanted 1: %r' % (what, n, anchor)
    return text.replace(anchor, new)

parts = ['topo_grid.js', 'topo_prov.js', 'topo_gaz.js', 'topo_extra_data.js', 'topo_extra.js', 'topo_block.js']
blk = ''
for p in parts:
    fp = os.path.join(HERE, p)
    if not os.path.exists(fp):
        assert p.startswith('topo_extra'), 'missing ' + p
        continue
    t = rd(fp)
    assert '</script' not in t.lower(), p + ' holds a closing script tag'
    blk += '<script id="scout-%s">\n%s%s</script>\n' % (p[:-3].replace('_', '-'), t, '' if t.endswith('\n') else '\n')

A1 = '<script id="scout-js">'
assert src.startswith(A1), 'scout.js does not open with ' + A1
src = once(src, A1, blk + A1, 'the block scripts')

A2 = 'LF.control.scale('
INIT = ("/* terrain: relief, names and the ground under each building (scout/topo) */\n"
        "      var TOPO = null; try { TOPO = window.__SCOUT_TOPO__ ? window.__SCOUT_TOPO__.init({ map, LF, root, G: typeof G === 'function' ? G : null, zipAt: (a, b) => zipAt(a, b), zi: z => ZI[z] }) : null; } catch (e) { TOPO = null; }\n"
        "      const TOPO_CSV = (h, r, bs, note) => { const hr = TOPO ? TOPO.csv(h, r, bs) : [h, r]; return toCSV(hr[0], hr[1], note + (TOPO ? '\\n' + TOPO.csvNote : '')); };\n"
        "      ")
src = once(src, A2, INIT + A2, 'the init call')

A3 = 'function detail() {'
src = once(src, A3, "function detail() { detail0(); if (TOPO) { try { TOPO.card(sel, sel && sel.id != null ? B.get(sel.id) : null, $('#scDetail', root)); } catch (e) { } } }\n      function detail0() {", 'the card hook')

A4 = "$('#scCsv', root).onclick = () => exportCSV();"
src = once(src, A4, "$('#scCsv', root).onclick = () => { if (TOPO) TOPO.ready().then(() => exportCSV(), () => exportCSV()); else exportCSV(); };", 'the export button')

A5 = 'toCSV(header, rows, '
src = once(src, A5, 'TOPO_CSV(header, rows, bs, ', 'the CSV columns')

with open(sys.argv[2], 'w', encoding='utf-8') as f: f.write(src)
print('scout.js: block of %d bytes and 5 replacements -> %s (%d bytes)' % (len(blk.encode()), sys.argv[2], len(src.encode())))
if len(sys.argv) == 5:
    css = rd(sys.argv[3])
    if 'scout topo' in css: sys.exit('this stylesheet already carries the terrain styles')
    css = once(css, '</style>', rd(os.path.join(HERE, 'topo-style.css')) + '</style>', 'the stylesheet end')
    with open(sys.argv[4], 'w', encoding='utf-8') as f: f.write(css)
    print('scout-style.css -> %s' % sys.argv[4])
