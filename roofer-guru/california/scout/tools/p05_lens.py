"""California: the roof views (Covering, Shingle style, Thermal, Wear, Weather, Fire, Solar and cool roof, Time)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import F
f = F()
f.block("  /* ---------- the roof views of the Scout Engine: heat, wear, and the next fifteen years, plane by plane ---------- */", "  /* ============================ the module ============================ */", f.blk('b10_lens1.js') + f.blk('b10_lens2.js'))
f.rep("        /* the flood the engine lays over the ground in a Category 3 to 5 near the Gulf: a picture, not a forecast (LENS.surge) */\n        surge: (la, lo, level) => LENS.surge(la, lo, level),\n", "")
f.rep("picture's age: FEMA's USA Structures (in Louisiana traced mostly from lidar of 2008 to 2012 and later imagery; it", "picture's age: FEMA's USA Structures (in California traced from lidar of 2010 to 2012 in the metros and from imagery of\n           2014 to 2024 elsewhere; it")
f.save()
