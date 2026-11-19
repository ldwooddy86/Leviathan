"""Round 11: the README's line for the roofing atlas takes the dashboard's new name and file, and says what is new.
   python3 -I readme_update.py /home/user/Leviathan/README.md"""
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
L = s.split('\n')
i = [k for k, x in enumerate(L) if x.startswith('| `uplift-louisiana-roofing-atlas.html` |')]
assert len(i) == 1, i
old = L[i[0]]
a = '| `uplift-louisiana-roofing-atlas.html` | The Uplift Louisiana Roofing Atlas (single file) with module 18, **Rooftop Scout**, the DFW atlas\'s Rooftop Scout rebuilt for roofs:'
assert old.startswith(a), old[:200]
b = old[len(a):]
cut = ' It also carries the **Scout Engine**,'
assert b.count(cut) == 1, b.count(cut)
keep = b[:b.index(cut)]
new = ('| `louisiana-roofer-guru.html` | **Louisiana Roofer Guru**: the Uplift Louisiana Roofing Atlas (single file) with module 18, formerly Rooftop Scout, '
       'the DFW atlas\'s Rooftop Scout rebuilt for roofs:' + keep +
       ' It also carries the **Scout Engine** (now the DFW atlas\'s build 12 engine, steadier and sharper at rest), a WebGL2 view of the same neighborhood with a **Roof View** of six readings '
       '(Covering and Shingle style, each drawn on the roof as its pattern; Thermal; Wear; Storm, what the storm on the storm scale would do to each roof; and Time, the damage most likely over the next 15 years), '
       'a **storm scale** from light rain to a Category 5 hurricane (rain, wind, lightning, and from Category 3 a picture of surge near the Gulf), an Alta X that flies only up to light rain, '
       'and a flying saucer and the Tic Tac, which fly in any weather and warp to any address or coordinates in Louisiana; and a 15 year outlook on each building\'s card, by kind of roof. |')
L[i[0]] = new
open(p, 'w', encoding='utf-8').write('\n'.join(L))
print('readme ok')
