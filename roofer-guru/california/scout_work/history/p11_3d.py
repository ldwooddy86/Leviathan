"""California: the 3D street view (scout3d.js) and the tracing (trace.js): storage key, words, roof pitch, the geoid."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import F, HERE
f = F('scout3d.js')
f.rep("const GFX_KEY = 'up.scout.gfx.v1',", "const GFX_KEY = 'cg.scout.gfx.v1',")
f.rep("'The sun is down in Louisiana now, so the scene is lit as at sundown.'", "'The sun is down in California now, so the scene is lit as at sundown.'")
f.rep("""    /* Over Baton Rouge, New Orleans and Shreveport no public 3D survey is that new (USGS lidar of 2018 over most of Baton
       Rouge, 2021 over New Orleans, 2018 over Shreveport; FEMA's footprints there come mostly from NGA lidar of 2008 to
       2012), and no lidar shapes them elsewhere either, so the buildings and trees are checked
       against, and drawn from, the newest photo Esri serves here when it was taken in 2024 or later (Vantor's January 16,
       2026 picture over Baton Rouge, for one). The photo leans""",
"""    /* FEMA's California footprints are older than the picture (lidar of 2010 to 2012 in the metros, imagery of 2014 to
       2024 elsewhere) and no lidar shapes the trees, so the buildings and trees are checked
       against, and drawn from, the newest photo Esri serves here when it was taken in 2024 or later (Vantor's November 26,
       2025 picture over central Los Angeles, for one). The photo leans""")
f.rep("""               Louisiana homes pitch steeper than a Texas ranch: up to about 7 in 12 on houses and apartments where the recorded
               height leaves a window high eave (2.8 m), and at least 5 in 12 unless the 2.5 m eave guard below flattens a low
               house; 5 in 12 on the rest */""",
"""               California homes pitch low (the ranch house, and the tile roofed tracts, at about 4 in 12): up to 5 in 12 on houses
               and apartments where the recorded height leaves a window high eave (2.8 m), and at least 4 in 12 unless the
               2.5 m eave guard below flattens a low house; 4 in 12 on the rest (a judgment: no survey of roof pitch was found) */""")
f.rep("rise = cls === 'sf' || cls === 'mf' ? Math.max(d * 0.42, Math.min(d * 0.58, hRaw - 2.8)) : d * 0.42;", "rise = cls === 'sf' || cls === 'mf' ? Math.max(d * 0.333, Math.min(d * 0.42, hRaw - 2.8)) : d * 0.333;")
f.rep("/* zoom 20 only where Esri has a 15 cm layer: across Louisiana its zoom 20 tile reads \"Map data not yet available\" */", "/* zoom 20 only where Esri has a fine layer: past its finest zoom its tile reads \"Map data not yet available\" */")
f.rep("generator: 'Uplift Louisiana Roofing Atlas, Rooftop Scout',", "generator: 'California Roofer Guru, Rooftop Scout',")
f.rep("legend: { green: 'likely needs roof work (a reroof, a repair, or wind or hail work)', orange: 'maybe', red: 'not likely' },", "legend: { green: 'likely needs roof work (a re-roof, a tile relay, a repair, or wind, hail or fire work)', orange: 'maybe', red: 'not likely' },")
# the geoid: NGS GEOID18 on a half degree grid over California, read from the survey's own service
gp = os.path.join(HERE, 'geoid_ca.json')
G = json.load(open(gp))
h = G['h']; nlat, nlon = G['nlat'], G['nlon']
vals = [v for r in h for v in r if v is not None]
assert len(vals) > 0.6 * nlat * nlon, 'too few geoid points: ' + str(len(vals))
# ocean cells past the model's edge take the nearest value, so the blend never meets a hole
def near(i, j):
    best = None
    for r in range(1, 8):
        for a in range(max(0, i - r), min(nlat, i + r + 1)):
            for b in range(max(0, j - r), min(nlon, j + r + 1)):
                if h[a][b] is not None:
                    d = (a - i) ** 2 + (b - j) ** 2
                    if best is None or d < best[0]: best = (d, h[a][b])
        if best: return best[1]
    return sum(vals) / len(vals)
grid = [[(h[i][j] if h[i][j] is not None else near(i, j)) for j in range(nlon)] for i in range(nlat)]
flat = ','.join('%.1f' % v for r in grid for v in r)
f.block("    /* the geoid over Louisiana (NGS GEOID18):", "    const PR = { on: !!gfx.photo,", """    /* the geoid over California (NGS GEOID18): sea level lies about %d m (the Sierra crest and the eastern deserts) to %d m (the
       coast) below the WGS84 ellipsoid here, so the elevation service's heights above sea level are turned into the ellipsoid
       heights Google's tiles use. GEOID18 as the National Geodetic Survey's own service gives it on a half degree grid from
       32 to 42 north and 125 to 114 west (%d points; cells past the model's edge at sea take the nearest value), blended
       between the four corners: good to about a metre in steep country; the calibration against Google's own ground takes the rest. */
    const GEOID_G = [%s];
    const GEOID = (la, lo) => { const NLAT = %d, NLON = %d, fi = Math.min(NLAT - 1.001, Math.max(0, (la - %.1f) / %.1f)), fj = Math.min(NLON - 1.001, Math.max(0, (lo - (%.1f)) / %.1f)), i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, g = (y, x) => GEOID_G[y * NLON + x]; return g(i, j) * (1 - a) * (1 - b) + g(i, j + 1) * (1 - a) * b + g(i + 1, j) * a * (1 - b) + g(i + 1, j + 1) * a * b; };
""" % (round(-max(vals)), round(-min(vals)), len(vals), flat, nlat, nlon, G['lat0'], G['step'], G['lon0'], G['step']))
f.rep("GEOID(S.lat0 || 30.45, S.lon0 || -91.19);   /* without the grid, a typical Louisiana ground of 10 m */", "GEOID(S.lat0 || 34.05, S.lon0 || -118.25);   /* without the grid, a ground of 10 m */")
f.save()

t = F('trace.js')
t.block("/* No public 3D survey of Baton Rouge, New Orleans or Shreveport is newer than 2021", "   the outline of whatever it is pointed at, SlimSAM", """/* FEMA's California footprints are older than the picture over them: drawn from NGA lidar of 2010 to 2012 in the metros
   (Los Angeles, the Bay Area, San Diego, Sacramento) and from ORNL imagery of 2014 to 2024 elsewhere; no lidar shapes the
   buildings or trees, so the 3D view is traced from the newest satellite photo Esri serves for the place, if it was
   captured in 2024 or later: Vantor's November 26, 2025 picture over central Los Angeles (Vivid Advanced, 34 cm), for
   one, or its May 26, 2026 picture over San Francisco. An AI model that finds
""")
t.rep("resolution for Vantor's 31 to 34 cm captures (Shreveport, for one), finer than its 50 cm ones (Baton Rouge, New Orleans),", "resolution for Vantor's 31 to 34 cm captures (Los Angeles and San Francisco, for two), finer than its 50 cm ones (Sacramento, Truckee),")
t.save()
