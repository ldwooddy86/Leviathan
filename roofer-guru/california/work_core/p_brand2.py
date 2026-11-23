import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('01_brand.js', [
 ('<path d="M20 5.5v3.2M17.6 7.2 20 4.8l2.4 2.4" fill="none" stroke="${S2}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  '<circle cx="30.5" cy="9" r="3.1" fill="${S2}"/>'),
])
