import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('02_map.js', [
 ("""    return { name, pop, tier, seat: !!c.seat, lat: c.lat, lon: c.lon }; }).sort(""",
  """    /* the dot sits where the people are: the population weighted centre of the postal city of the same name when the data
       has one nearby (a Census internal point can fall offshore: San Francisco's place includes the Farallon Islands) */
    const pc = CITYI[name] || CITYI[c.name]; const usePc = pc && isN(pc.lat) && isN(pc.lon) && Math.abs(pc.lat - c.lat) < 0.5 && Math.abs(pc.lon - c.lon) < 0.5;
    return { name, pop, tier, seat: !!c.seat, lat: usePc ? pc.lat : c.lat, lon: usePc ? pc.lon : c.lon }; }).sort("""),
])
