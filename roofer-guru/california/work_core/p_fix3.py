import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('16_m04_drivers.js', [
 ("(roof weighted mean of the regions' station normals). ", "(the mean of the ZIP normals, weighted by housing units). "),
 ("The regions differ: the north coast is wet for seven months, the desert for none, and module 12 shows each region's own year.", "The regions differ in how long and how hard the wet season runs; module 12 shows each region's own year."),
 ("between 8 p.m. and 6 a.m.`).join('. ')}. California's roof weather keeps no office hours: fronts and atmospheric rivers run through the night and offshore wind peaks before dawn, so the damage is found at first light.", "between 8 p.m. and 6 a.m.`).join('; ')} (Pacific Standard Time). California's roof weather keeps no office hours: a winter front or an atmospheric river can blow and rain all night, so much of the damage is found at first light."),
])
patch('24_m12_lines.js', [
 ("an atmospheric river rains for a day or two and the wind often peaks at night, so owners find the leak in the morning.", "an atmospheric river rains for a day or two, through the night as well, so owners often find the leak in the morning."),
])
patch('13_m01_index.js', [("<option value=\"\">All ${nl === numWord(NREG) ? '' : ''}${numWord(NREG)} regions</option>", "<option value=\"\">All ${numWord(NREG)} regions</option>")])
