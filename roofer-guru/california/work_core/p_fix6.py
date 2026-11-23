import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('09_sl_model.js', [("and the figures of the nine lines Louisiana also had are", "and the figures of the nine lines the first edition also had are")])
patch('02_map.js', [
 ("""   Data keys that keep their first names (SCHEMA.md section 0.1): geo.parish = the 58 county shapes by FIPS, geo.pcent =
   county label points. On screen a county is always a County. */""",
  """   Two data keys keep the names the first edition gave them (SCHEMA.md section 0.1): the county shapes by FIPS, read
   below into GEO_COUNTY, and geo.pcent, the county label points. Everything in code and on screen says county. */"""),
 ("""const PARISH_LABEL = COUNTY_LABEL;   /* first name, kept for any reader that still uses it */\n""", ""),
 ("""    /* options under their first names are honoured: other modules pass them */
    if (opts && opts['parishLabels'] != null) this.o.countyLabels = !!opts['parishLabels'];
    if (opts && opts['onParish'] && !this.o.onCounty) this.o.onCounty = opts['onParish'];
    if (opts && opts['onParishHover'] && !this.o.onCountyHover) this.o.onCountyHover = opts['onParishHover'];
""", ""),
 ("""/* methods under their first names, for the modules that still call them (they act on counties) */
[['fitParishes', 'fitCounties'], ['fillParish', 'fillCounty'], ['dimParish', 'dimCounty'], ['selectParish', 'selectCounty'], ['setParishLabels', 'setCountyLabels']].forEach(([a, b]) => { ZipMap.prototype[a] = ZipMap.prototype[b]; });
""", ""),
 ("""const parishTip = countyTip;   /* first name, kept for the modules that still call it */\n""", ""),
])
