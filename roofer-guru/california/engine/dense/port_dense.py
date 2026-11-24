"""California Roofer Guru, Scout Engine: frames paced to what the graphics side can draw (the "dense downtowns" job).

   python3 -I port_dense.py <in.js> <out.js>

The fault it answers: at 200 N Spring St, Los Angeles, the headless test browser "closed". It did not crash. The engine
handed frames to the GPU process far faster than the software renderer drew them, the queue of undrawn frames grew
without bound, and the page froze whenever anything waited for the picture; the test's own time limit then closed the
browser. NOTES.md has the measurements. Nothing in it is special to dense downtowns, so no building geometry is changed.

What is applied, by anchored replacements (each anchor must occur exactly once):
  Engine._frame          the draw is held while frames are still on their way (Engine._held); the update still runs
  Engine._frame          a fence is left after each drawn frame (Engine._fence); the frame rate and the quality tuning
                         are given the true time between drawn frames
  Engine._watch          the black-picture watch reads its nine points through a pixel buffer and a fence, not straight
                         back (Engine._watchAsk, Engine._watchRead); the straight read stays as the fallback
  WorldKit cvs()         the canvases of photographs and masks are made for reading back (willReadFrequently), so
                         the tree reader's getImageData does not wait for the GPU process
  Engine constructor     a lost context clears the fences and marks the engine as not drawing
  the world              the lost and the returned context are said in the view (dense_world.js)
New code: dense_engine.js (methods of class Engine), dense_world.js. It applies to la_engine.js alone and at the end of
the stack (after views, before build/finish_engine.py)."""
import os, sys, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
eng = open(os.path.join(HERE, 'dense_engine.js'), encoding='utf-8').read()
wld = open(os.path.join(HERE, 'dense_world.js'), encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, ('anchor count', s.count(a), a[:110])
    s = s.replace(a, b)
assert '_held(now)' not in s, 'port_dense is already applied'

# ---- Engine._frame: hold the draw, not the world ----
a = "      if (this._settle > 0) {\n"
assert s.count(a) == 1 and s.split(a)[1].lstrip().startswith("if (live || busy) T.now += sim; T.dt = dt;"), 'Engine._frame is not as expected'
rep(a, "      if (this._settle > 0 && this._held(now)) { if (live || busy) T.now += sim; }   /* frames are still on their way: nothing more is handed over, the world has moved all the same */\n"
       "      else if (this._settle > 0) {\n")
rep("this._bad = 0; this._watch(); }", "this._bad = 0; this._watch(); this._fence(); }")
rep("T.fps * 0.9 + (1 / dt) * 0.1", "T.fps * 0.9 + (1 / ((this._gate && this._gate.dt) || dt)) * 0.1")
rep("this._drs(dt); this._tune(dt);", "const rd = (this._gate && this._gate.dt) || dt; this._drs(rd); this._tune(Math.min(rd, 0.25));")

# ---- Engine._watch: the nine points read without waiting ----
rep("const W = this._watchS || (this._watchS = { n: 0, black: 0, left: 12, stage: 0 }); if (W.left <= 0",
    "const W = this._watchS || (this._watchS = { n: 0, black: 0, left: 12, stage: 0 }); let lit = false;\n"
    "      if (W.pend) { lit = this._watchRead(W); if (lit === null) return; } else { if (W.left <= 0")
rep("px = new Uint8Array(4); let lit = false; dev.bind(null);\n", "px = new Uint8Array(4); dev.bind(null);\n      if (this._watchAsk(W, w, h)) return;   /* the answer comes on a later frame */\n")
rep("if (px[0] + px[1] + px[2] > 0) lit = true; }\n", "if (px[0] + px[1] + px[2] > 0) lit = true; } }\n")

# ---- the new methods of class Engine ----
rep("    /* on Auto: frames that run long for a while step the quality down once, and say so */\n",
    eng + "    /* on Auto: frames that run long for a while step the quality down once, and say so */\n")

# ---- the photographs and masks the engine reads back are kept in memory, not on the card ----
# K.detectTrees and the wider city's tree reader call getImageData on these canvases. On a canvas the browser keeps on
# the card that call waits for the GPU process: 7.8 s of 8.6 s of frame time while 14 cells' trees were read at
# 600 W Broadway, San Diego, on the software renderer (out/g_sd.log). The browser's own advice for a canvas that is
# read back is willReadFrequently; the option counts only at the first getContext, so it is given where the canvas is made.
rep("c.width = w; c.height = h || w; if (fill) { const g = c.getContext('2d');",
    "c.width = w; c.height = h || w; c.getContext('2d', { willReadFrequently: true }); if (fill) { const g = c.getContext('2d');")

# ---- a lost context ----
rep("onLost: () => this.emit('lost'), onRestored: () => { this.emit('restored'); }",
    "onLost: () => { this._ctxGone(); this.emit('lost'); }, onRestored: () => { this._ctxGone(); this.broken = this._ctxDead = 'the graphics context was lost, and what the engine had built on the card went with it.'; this.emit('restored'); }")
rep("    engine.on('fatal', msg => {", wld + "    engine.on('fatal', msg => {")
# a quality change clears "broken" (a new try with fewer effects); not after a lost context, where nothing is left to draw with
rep("this.quality = q; this.broken = null;", "this.quality = q; this.broken = this._ctxDead || null;")

open(out, 'w', encoding='utf-8').write(s)
# the new parts parse as methods of a class and as statements, and so does the whole (which may sit in its <script> tag)
def parses(text, what):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(text); tmp = f.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True); os.unlink(tmp)
    assert r.returncode == 0, ('does not parse', what, r.stderr[:400])
parses('class X {\n' + eng + '}\nfunction w(engine, note, alarm, env, graphics) {\n' + wld + '}\n', 'the new parts')
L = s.split('\n')
if L and L[0].startswith('<script'): L = L[1:]
while L and L[-1].strip() == '': L.pop()
if L and L[-1].startswith('</script>'): L.pop()
parses('\n'.join(L) + '\n', out)
print('port_dense: applied to', os.path.basename(src), '->', out, len(s.encode('utf-8')), 'bytes')
