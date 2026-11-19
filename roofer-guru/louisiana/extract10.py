"""Extract the Rooftop Scout blocks (by element id) of a DFW build into a folder, each with its opening and closing tag,
as build.py's part() expects. python3 -I extract10.py <file.html> <outdir>"""
import sys, re, os, hashlib
s = open(sys.argv[1], encoding='utf-8').read(); out = sys.argv[2]
names = {'scout-leaflet-css': 'leaflet.css', 'scout-style': 'scout-style.css', 'scout-engine-style': 'engine-style.css', 'scout-leaflet': 'leaflet.js',
         'scout-three': 'three.js', 'scout-data': 'data.js', 'scout-ort-wasm': 'ort-wasm.js', 'scout-ort-webgpu': 'ort-webgpu.js', 'scout-trace': 'trace.js',
         'scout-tf': 'tf.js', 'scout-sr': 'sr.js', 'scout-3d': 'scout3d.js', 'scout-engine': 'engine.js', 'scout-js': 'scout.js'}
for m in re.finditer(r'<(script|style) id="(scout-[a-z0-9-]+)">', s):
    tag, i = m.group(1), m.group(2)
    end = s.find('</' + tag + '>', m.end()) + len('</' + tag + '>')
    blk = s[m.start():end] + '\n'
    f = names[i]; open(os.path.join(out, f), 'w', encoding='utf-8').write(blk)
    print(f'{i:22} {f:18} {len(blk):>9} sha1 {hashlib.sha1(blk.encode()).hexdigest()[:12]}')
a = s.find('<!-- rooftop-scout:start'); b = s.find('<!-- rooftop-scout:end')
print('block', a, b, 'order:', [m.group(2) for m in re.finditer(r'<(script|style) id="(scout-[a-z0-9-]+)">', s)])
