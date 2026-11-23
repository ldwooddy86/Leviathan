"""California: the roof clock, the likely roof, the hazard columns, reading a building, the store and the fetches."""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import F
f = F()
# getJSON can post a form (Riverside's table, Sacramento's permits: long lists of parcel numbers)
f.rep("const r = await fetch(url, { signal: ctl.signal, credentials: 'omit' });",
      "const r = await fetch(url, o.post ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs(o.post), signal: ctl.signal, credentials: 'omit' } : { signal: ctl.signal, credentials: 'omit' });")
f.block("  /* ---------- roof life: module 17's Weibull roof life and the storms that reset roofs (module 02) ---------- */", "  /* ---------- when a building was built, when its year is not on file ---------- */", f.blk('b03_clock.js'))
f.rep("""  /* The ZIP's ACS year built mix (the same ten bins module 17 draws), sharpened for a house by its footprint: an old
     neighborhood's big footprint is more likely a rebuild, a small one more likely original. The footprint medians are a
     judgment call, set wide (a log spread of 0.38) so they lean, not decide. */""",
"""  /* The ZIP's ACS year built mix (the same ten bins module 17 draws; for a house the one unit homes by decade, where the
     data carries them), sharpened for a house by its footprint: an old neighborhood's big footprint is more likely a
     rebuild, a small one more likely original. The footprint medians are a judgment call, set wide (a log spread of
     0.38) so they lean, not decide. This is what stands in wherever no assessor publishes a year built. */""")
f.rep("    const z = b.z; let w = z ? YBK.map(k => Math.max(0, +z[k] || 0)) : null;",
      "    const z = b.z; let w = z ? YBK.map(k => Math.max(0, +z[k] || 0)) : null;\n    if (z && (b.cls === 'sf' || b.cls === 'garage' || b.cls === 'shed')) { const o1 = OBK.map(k => Math.max(0, +z[k] || 0)); if (sum(o1) > 0) w = o1; }")
f.block("  /* ---------- the likely roof ---------- */", "  /* ---------- the storm record around each building: NOAA reports of the last three years ---------- */", f.blk('b04_roof.js'))
f.block("  /* ---------- the storm record around each building: NOAA reports of the last three years ---------- */", "  /* ---------- reading a building ---------- */", f.blk('b06_wx.js'))
f.block("  /* the weight a permit carries for one building: its text's weight", "  function statusOf(b) {", f.blk('b05_read.js'))
f.block("  /* ---------- the store of buildings and tiles ---------- */", "  /* A permit joins the main building at its address.", f.blk('b07_store.js'))
s = f.s
# the permit reader: words that belong to another state's houses and programs go; the lessons stay
for a, b in [("|CAMEL.?BACK", ""), ("SHOTGUN|CREOLE|", ""), ("|SHOTGUN(?! (?:HOUSE|HOME|RESIDENCE|DWELLING|COTTAGE|DOUBLE|SINGLE)S?\\b)", ""), ("SHOTGUN|", ""), ("|FORTIFI|", "|"), ("LEAN|CAMEL|ATTACHED", "LEAN|ATTACHED")]:
    assert a in s, a
    s = s.replace(a, b)
for w in ['SHOTGUN', 'CREOLE', 'CAMEL']:
    assert w not in s, w
f.s = s
f.rep("a lean to, a camelback or an attached shed) on any permit but a reroof permit.", "a lean to or an attached shed) on any permit but a reroof permit.")
f.rep("     a camelback or an attached shed, or the first clause names a lean to,", "     or an attached shed, or the first clause names a lean to,")
f.rep("     dormer, a lean to, a camelback or an attached shed, unless the text goes on to the house or the main roof, or such a part's own", "     dormer, a lean to or an attached shed, unless the text goes on to the house or the main roof, or such a part's own")
f.rep("    if (p.kind === 'newc') return 1;\n    if (p.kind === 'mh') return 0.5;", "    if (p.kind === 'newc') return 1;\n    if (p.kind === 'mh') return 0.5;\n    if (p.kind === 'rebuild') return p.w || 0;")
# joining permits: by address, by assessor's parcel number, by map point
f.rep("and names that building when FEMA gave it no address (New Orleans footprints carry none).", "and names that building when it has no address yet (FEMA's California footprints carry none). A permit with a parcel\n     number and no address match joins the buildings on that parcel (Sacramento and San Jose give no map point at all).")
f.rep("     manufactured home permit is mostly for a building FEMA's footprints (2008 to 2012 lidar in the cities) do not have", "     manufactured home permit is mostly for a building FEMA's footprints (2010 to 2012 lidar in the metros) do not have")
f.rep("  /* New Orleans' 2012 import tail ('Historical Import Type: Permits Residential Single ...') names the permit's class, not the building */\n", "")
f.rep("const accOnly = u => { const v = u.replace(/\\s*HISTORICAL IMPORT TYPE:.*$/, '').replace(ACC_PLACE, ' ');", "const accOnly = u => { const v = u.replace(ACC_PLACE, ' ');")
f.rep("    const bs = [...t.ids].map(id => B.get(id)).filter(Boolean), byKey = new Map();\n", "    const bs = [...t.ids].map(id => B.get(id)).filter(Boolean), byKey = new Map(), byApn = new Map();\n    bs.forEach(b => { const a = b.parcel && b.parcel.apn ? digits(b.parcel.apn) : ''; if (a.length >= 6) { const g = byApn.get(a) || []; g.push(b); byApn.set(a, g); } });\n")
f.rep("const nw = isNew(p), at = (p.key && byKey.get(p.key)) || [], main = at.filter(b => b.cls !== 'garage' && b.cls !== 'shed');", "const nw = isNew(p); let at = (p.key && byKey.get(p.key)) || []; if (!at.length && p.apn) at = byApn.get(p.apn) || []; if (!at.length && p.byApn) return; const main = at.filter(b => b.cls !== 'garage' && b.cls !== 'shed');")
f.rep("best.addr = String(p.addr).replace(/\\s+(BATON ROUGE|NEW ORLEANS)\\s+LA\\b.*$/i, ''); best.addrSrc = 'permit';", "best.addr = String(p.addr).split(',')[0].trim(); best.addrSrc = 'permit';")
f.rep("const o = bs.find(b => b.parcel && digits(b.parcel.apn) === b2);", "const o = bs.filter(b => b.parcel && digits(b.parcel.apn) === b2).sort((x, y) => y.sqft - x.sqft)[0];")
f.rep("      if (!best || bd > (nw ? 2 : 20)) return;", "      if (!best || bd > (nw ? 2 : 20) || p.byApn) return;")
f.save()
