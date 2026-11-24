import sys
A = [
 "      if (this._settle > 0) {\n",
 "this._bad = 0; this._watch(); }",
 "this._drs(dt); this._tune(dt);",
 "T.fps * 0.9 + (1 / dt) * 0.1",
 "    _watch() {\n",
 "const W = this._watchS || (this._watchS = { n: 0, black: 0, left: 12, stage: 0 }); if (W.left <= 0",
 "px = new Uint8Array(4); let lit = false; dev.bind(null);\n",
 "if (px[0] + px[1] + px[2] > 0) lit = true; }\n",
 "    engine.on('fatal', msg => {",
 "onLost: () => this.emit('lost'), onRestored: () => { this.emit('restored'); }",
 "    /* on Auto: frames that run long for a while step the quality down once, and say so */\n",
 "    start() { if (this.running) return;",
]
for p in sys.argv[1:]:
    s = open(p, encoding='utf-8').read()
    print(p.split('/engine/')[-1], len(s), [s.count(a) for a in A])
