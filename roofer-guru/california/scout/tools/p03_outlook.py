"""California: the fifteen year outlook from the state's weather and fire record."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import F
f = F()
f.block("  /* ---------- the next fifteen years: what each kind of roof is likely to suffer where it stands ---------- */", "  /* Louisiana's roofs by age today (module 17), as shares", f.blk('b08_out1.js'))
f.rep("  /* Louisiana's roofs by age today (module 17), as shares: what a storm year's count is an average over */", "  /* California's roofs by age today (module 17), as shares: what the wind and hail rates are an average over */")
f.block("  /* a storm year that replaced the share d of the roofs standing", "  const windAgeK = ", "")
f.block("  /* the Gulf's shore, from the atlas's own outline", "  /* salt air on steel:", f.blk('b08_coast.js'))
f.block("  /* The record a ZIP's outlook draws on.", "  /* One kind of roof at one ZIP, fifteen years on", f.blk('b08_haz.js'))
f.block("  /* One kind of roof at one ZIP, fifteen years on", "  function count(type, zip, d0in, o) {", """  /* One kind of roof at one ZIP, fifteen years on, from a spread of chances over the roof's age today (d0). o.fk: the fire
     zone's turn on the ZIP's pace of fire losses (fireK); o.st: stories; o.heat: how hard the sun works this roof
     against the average California roof of its kind (1: the same; the place's normals and the Scout Engine's reading
     of the roof's planes supply it, held between 0.5 and 1.6): its life shortens or stretches by the square root of
     that, because heat is one of several things that age a roof (judgment).
     The building is followed, not the roof stock: every case is a spread of chances over the age of the roof then on the
     building, and a replacement by anything puts it back at age zero. Beside every case (dist) the count keeps the cases
     where today's roof is still on (own), those where no roofer has been called (clean) and, cause by cause, those the
     cause has not touched yet (nc), has not replaced yet (nr) and has not repaired yet (nf). Out come, for each year 0 to
     15: the chance by then of each cause at least once (C), of a replacement by it (R) and of a repair after it (F); of
     any replacement (rep, one minus keep), of any call for a roofer (any), of today's roof still being on (keep); the
     mean age of the roof then in place (age), and the slow marks on that roof (alg; rust for each step of salt air).
     The count is linear in d0, so a building's many possible clock starts are blended into one spread for each covering
     first (outlookOf) and counted once. */
""" + f.blk('b08_chances.js'))
f.rep("const rec = o.rec || CFG.outRec || 'mid'", "const rec = fkKey(o.fk)", 2)
f.rep("f = count(type, zip, d0, { rec, st, heat });", "f = count(type, zip, d0, { fk: o.fk, st, heat });")
f.block("  /* algae on a roof of age a (a chance its streaks show).", "  /* one kind of roof of a given age at a ZIP, with no building under it", f.blk('b08_out3.js'))
f.rep(", ai: true, outRec: 'mid' };", ", ai: true };")
f.rep("    if (['mid', 'recent', 'long'].includes(s.outRec)) o.outRec = s.outRec;\n", "")
f.save()
