"""California: fixes from the first browser runs (sunshine share, the fire pace's cap, inspection addresses)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import F
f = F()
# the sky's clear share: California's rain falls in winter and says little about its summers; the hazard job's marine layer class does
f.block("     sky clear a share of the time that falls with the place's rain:", "  const clearShare = (la, lo) =>", """     sky clear a share of the time set by the ZIP's marine layer class (the hazard job's rule from distance to the sea,
     height and the normal July maximum: 0 none, 3 the fog belt): 0.80, 0.72, 0.64 and 0.56 (a judgment, grade D: no
     sunshine or cloud record is in the page's data, and California's yearly rain, which falls in winter, says little
     about its summers). No shade is counted: the yearly rate knows the plane's slope, its bearing and the roof's
     colour, not the trees round it. */
""")
f.rep("const clearShare = (la, lo) => { const zp = zipAt(la, lo), r = zp && ZI[zp] ? wxCol(ZI[zp], 'rainIn') : null; return r == null ? 0.7 : clamp(0.9 - r / 100, 0.5, 0.9); };",
      "const clearShare = (la, lo) => { const zp = zipAt(la, lo), m = zp && ZI[zp] ? wxCol(ZI[zp], 'marine') : null; return m == null ? 0.75 : [0.8, 0.72, 0.64, 0.56][clamp(Math.round(m), 0, 3)]; };")
f.rep("    hd1: ['hd1', 'hail_d1'], hd175: ['hd175'], coast: ['coast_km'],", "    hd1: ['hd1', 'hail_d1'], hd175: ['hd175'], hail1n: ['hail1_n25'], coast: ['coast_km'], marine: ['marine_cls'], salt: ['salt_cls'],")
f.rep("with the sky clear a share of the time that falls with the place's rain (a judgment);", "with the sky clear a share of the time set by the ZIP's marine layer class (0.80 inland to 0.56 in the fog belt: a judgment);")
# the fire pace: a town that burned in the record does not burn again at that pace
f.rep("    fireFrom: 2013, fireTo: 2025, nearKm: 40, own: 0.6, dmgW: 0.5,", "    fireFrom: 2013, fireTo: 2025, nearKm: 40, own: 0.6, dmgW: 0.5,\n    /* and the pace is capped: 1.5 percent of a ZIP's structures a year, 2 percent after the zone's turn. A town that\n       burned in the record (Paradise lost nine homes in ten in 2018) would otherwise read as burning again within\n       the outlook, and what burned is not there to burn at that pace again (judgment, grade D) */\n    fireCap: 0.015, fireCapSite: 0.02,")
f.rep("const fireRate = clamp(near ? OC.own * own + (1 - OC.own) * nb : own, 0, 0.2),", "const fireRaw = near ? OC.own * own + (1 - OC.own) * nb : own, fireRate = clamp(fireRaw, 0, OC.fireCap),")
f.rep("fire: { rate: fireRate, own, nb, near, rep: fireRep, dest, dmg: dm },", "fire: { rate: fireRate, raw: fireRaw, capped: fireRaw > OC.fireCap, own, nb, near, rep: fireRep, dest, dmg: dm },")
f.rep("const fr = clamp(hz.fire.rate * fk * T.fire, 0, 0.3),", "const fr = clamp(hz.fire.rate * fk * T.fire, 0, OC.fireCapSite),")
f.rep("turned ' + D(O.fk, 2) + ' times for this building\\'s zone' : ''}, fire damage or loss by", "turned ' + D(O.fk, 2) + ' times for this building\\'s zone' : ''}${hz.fire.capped ? ' and capped at 1.5 percent of structures a year (what burned in the record is not there to burn at that pace again)' : ''}, fire damage or loss by")
f.rep("turned up to four times for a building inside a High or Very High zone and halved for one outside every zone;", "capped at 1.5 percent of structures a year; turned up to four times for a building inside a High or Very High zone and halved for one outside every zone, and never over 2 percent a year;")
# CAL FIRE's site address comes with or without commas: "627 E CALAVERAS ST, ALTADENA, CA 91001", "5718 ALMOND ST PARADISE CA 95969"
f.rep("      if (!best.addr && /^\\d/.test(p.addr)) { best.addr = p.addr.split(',')[0]; best.addrSrc = 'dins'; const a = addrParts(p.addr); best.akey = a.key; best.street = a.street; if (!best.city) best.city = (p.addr.split(',')[1] || '').trim().toUpperCase(); } });",
      "      if (!best.addr && /^\\d/.test(p.addr)) { const zc = best.z && best.z.city ? String(best.z.city).toUpperCase() : '', m = /^(.*?)[,\\s]+([A-Z][A-Z .'-]*?)[,\\s]+CA(?:LIFORNIA)?[,\\s]+9\\d{4}(?:-\\d{4})?\\s*$/i.exec(p.addr); let st = p.addr.split(',')[0].trim(), city = (p.addr.split(',')[1] || '').trim().toUpperCase();\n        if (!/,/.test(p.addr)) { st = p.addr.replace(/[,\\s]+CA(LIFORNIA)?[,\\s]+9\\d{4}(-\\d{4})?\\s*$/i, '').trim(); city = ''; if (zc && st.toUpperCase().endsWith(' ' + zc)) { st = st.slice(0, -zc.length).trim(); city = zc; } else if (m && isSuf((m[1].trim().split(' ').pop() || '').toUpperCase())) { st = m[1].trim(); city = m[2].trim().toUpperCase(); } }\n        best.addr = st; best.addrSrc = 'dins'; const a = addrParts(st, city); best.akey = a.key; best.street = a.street; if (!best.city && city) best.city = city; } });")
# the wind statement: the Enhanced Fujita scale's anchors, as the hazard job's roof model gives them
f.rep("     count behind it: California's reports say \"countless roofs\" (October 21, 2007, gusts over 70 mph) and give no\n     number. Grade D. */", "     count behind it: California's reports say \"countless roofs\" (October 21, 2007, gusts over 70 mph) and give no\n     number. The Enhanced Fujita scale's own anchors sit beside it: visible damage to a house from a 3 second gust of\n     about 65 mph (53 to 80), up to a fifth of the roof covering lost near 79 mph (63 to 97). Grade D. */")
f.rep("an extrapolation past 75) by covering and age;", "an extrapolation past 75; the Enhanced Fujita scale puts the first visible damage to a house near 65 mph and the loss of up to a fifth of its roof covering near 79) by covering and age;")
f.save()
