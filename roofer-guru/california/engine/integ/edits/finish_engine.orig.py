"""Last step on the stacked engine: settle what two jobs named alike, and take Louisiana out of what no job owned.
   python3 -I finish_engine.py <stacked.js> <engine.js> <style in> <style out>"""
import sys, re
src, out, cin, cout = sys.argv[1:5]
s = open(src, encoding='utf-8').read()
def sub(a, b, n=1, must=True):
    global s
    c = s.count(a)
    if c == 0 and not must: return
    assert c == n, ('anchor count', c, a[:90])
    s = s.replace(a, b)
# the weather job's en.sky(id) sets the sky state; the aircraft, ships and bridges kit is en.air
if 'SE.SkyKit(engine, S' in s:
    m = re.findall(r'\bsky: SKY\b', s)
    assert len(m) == 1, ('sky: SKY', len(m))
    s = re.sub(r'\bsky: SKY\b', 'air: SKY', s)
# the engine's saved graphics settings are California's own
sub("const GFX_KEY = 'up.scout.engine.v1'", "const GFX_KEY = 'cg.scout.engine.v1'")
# roof pitch on houses and apartments: Louisiana's 5 to 7 in 12 becomes 4 to 5 in 12 (the Scout module's stated choice)
sub("Louisiana homes pitch steeper than a Texas ranch: up to about 7 in 12 on houses\n       and apartments where the recorded height leaves a window high eave (2.8 m), 5 in 12 on the rest.",
    "California houses are drawn at 4 in 12, up to about 5 in 12 on houses\n       and apartments where the recorded height leaves a window high eave (2.8 m): a choice, as no statewide survey of roof\n       pitch was found.")
sub("Math.max(d * 0.42, Math.min(d * 0.58, hRaw - 2.8)) : d * 0.42;", "Math.max(d * 0.333, Math.min(d * 0.42, hRaw - 2.8)) : d * 0.333;")
# comments in parts no job owned
sub("In the Louisiana Roofing Atlas the layer\n   that is seen through walls", "In California Roofer Guru the layer\n   that is seen through walls")
sub("the kinds of vehicle that fill Louisiana's streets", "the kinds of vehicle that fill American streets")
sub("In the\n     Louisiana Roofing Atlas only what stands out of doors is drawn", "In\n     California Roofer Guru only what stands out of doors is drawn")
sub("is left out of the Louisiana engine:", "is left out of this engine:")
sub("most often carries in the Gulf South (as a card would give it", "most often carries (as a card would give it")
sub("the mix of cars on California's roads is not Louisiana's: fewer full-size pickups", "the mix of cars on California's roads: fewer full-size pickups than the engine's first edition drew", must=False)
open(out, 'w', encoding='utf-8').write(s)
left = {w: len(re.findall(w, s)) for w in ['Louisiana', 'Gulf', 'hurricane', 'Hurricane', 'surge', 'parish', 'Baton Rouge', 'New Orleans']}
print('engine', len(s.encode('utf-8')), 'bytes; words left', {k: v for k, v in left.items() if v})
c = open(cin, encoding='utf-8').read()
# the storm scale's tick row: nine steps in California (the weather job left the stylesheet alone)
if '.sc-stormt' in c:
    n = c.count('repeat(10,1fr)') + c.count('repeat(10, 1fr)')
    print('style: ten-step grids found', n)
    c = c.replace('repeat(10,1fr)', 'repeat(9,1fr)').replace('repeat(10, 1fr)', 'repeat(9, 1fr)')
open(cout, 'w', encoding='utf-8').write(c)
