"""Builds the bare test page for Legion as a library.
   python3 -I build_test.py <port out dir> <leaflet dir> <out.html>
The page is a stand-in for the dashboard: it has its own stylesheet with global rules, its own Leaflet map in an element
with id `map`, elements with ids Legion also uses (`stage`, `toasts`, `topbar`), its own hash and its own localStorage
key, and a 900 by 600 host for Legion's view. Legion comes in as the block the port wrote (legion.embed.html)."""
import os, sys
out, lf, dst = sys.argv[1], sys.argv[2], sys.argv[3]
rd = lambda p: open(p, encoding='utf-8').read()
embed = rd(os.path.join(out, 'legion.embed.html'))
lcss, ljs = rd(os.path.join(lf, 'leaflet.css')), rd(os.path.join(lf, 'leaflet.js'))
assert ljs.lstrip().startswith('<script') and lcss.lstrip().startswith('<style')   # the dashboard's own copies, tags and all: Leaflet is kept as window.__SCOUT_LEAFLET__
page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Host page (test) for Legion as a library</title>
''' + lcss + '''
<style>
/* the host's own global rules: Legion's stylesheet must not reach these, nor these reach Legion */
html, body { margin: 0; background: #f4efe6; color: #1c1b19; font: 15px/1.4 Georgia, serif; }
h1 { font-size: 22px; margin: 10px 16px; color: #7a2e12; }
button { font: inherit; background: #7a2e12; color: #fff; border: 0; padding: 4px 10px; }
#topbar { padding: 6px 16px; background: #e6dcc9; }
#stage { display: flex; gap: 12px; padding: 12px 16px; }
#map { width: 420px; height: 600px; border: 2px solid #7a2e12; }
#legion-host { width: 900px; height: 600px; border: 2px solid #1c1b19; }
#toasts { position: fixed; right: 8px; bottom: 8px; }
.panel { background: #fff8e8; }
</style></head>
<body>
<div id="topbar"><h1 id="host-title">Host page</h1> <button id="host-button" type="button">Host button</button> <span id="host-note" class="panel">host panel text</span></div>
<div id="stage"><div id="map"></div><div id="legion-host"></div></div>
<div id="toasts"></div>
''' + ljs + '''
<script>
localStorage.setItem('cg.host.v1', JSON.stringify({ kept: true }));
window.HOST = { errors: [], keys: 0 };
window.addEventListener('error', function (e) { HOST.errors.push(String(e.message)); });
document.addEventListener('keydown', function () { HOST.keys++; });
var LF = window.__SCOUT_LEAFLET__; HOST.L = LF;
HOST.map = LF.map('map', { zoomControl: true, attributionControl: false }).setView([34.0522, -118.2437], 15);
HOST.layer = LF.layerGroup().addTo(HOST.map);
</script>
''' + embed + '''
</body></html>
'''
open(dst, 'w', encoding='utf-8', newline='').write(page)
print('test page', dst, len(page.encode('utf-8')), 'bytes')
