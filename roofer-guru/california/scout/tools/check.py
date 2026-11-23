import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import check_text, SC
for n in ['scout.js', 'scout3d.js', 'trace.js']:
    check_text(open(os.path.join(SC, n), encoding='utf-8').read(), n); print('ok', n)
