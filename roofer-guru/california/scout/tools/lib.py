"""Helpers for the one-off edits of scout.js (anchored replacements; every anchor asserted)."""
import os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
SC = os.path.dirname(HERE)
class F:
    def __init__(self, name='scout.js'):
        self.p = os.path.join(SC, name); self.s = open(self.p, encoding='utf-8').read(); self.n = 0
    def rep(self, a, b, n=1):
        c = self.s.count(a)
        assert c == n, (c, a[:140])
        self.s = self.s.replace(a, b); self.n += 1
    def block(self, start, end, new, keep_end=True):
        """replace from the start anchor up to (not including) the end anchor"""
        assert self.s.count(start) == 1, (self.s.count(start), start[:120])
        i = self.s.index(start); j = self.s.index(end, i + len(start))
        assert self.s.count(end, i + len(start)) >= 1, end[:120]
        self.s = self.s[:i] + new + self.s[j if keep_end else j + len(end):]; self.n += 1
    def blk(self, name):
        return open(os.path.join(SC, 'blocks', name), encoding='utf-8').read()
    def save(self):
        check_text(self.s, self.p)
        open(self.p, 'w', encoding='utf-8').write(self.s); print('saved', os.path.basename(self.p), len(self.s), 'edits', self.n)
def check_text(s, label=''):
    t = s
    if t.startswith('<script'):
        t = t[t.index('\n') + 1:]
        k = t.rstrip().rfind('</script>'); t = t[:k]
    fd, tmp = tempfile.mkstemp(suffix='.js'); os.write(fd, t.encode('utf-8')); os.close(fd)
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True); os.unlink(tmp)
    if r.returncode != 0:
        print(r.stderr[:3000]); raise SystemExit('does not parse: ' + label)
