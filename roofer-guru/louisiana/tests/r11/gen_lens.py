"""Round 11: the roof views' module code. Reads tests/r11/lens_block.pre_r11.js (round 10's, as shipped) and
tests/r11/views_block.js, writes tests/r11/lens_block.js with three more views: Covering, Shingle style and Storm.
Every anchor must occur exactly once.   python3 -I tests/r11/gen_lens.py"""
import os
D = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(D, 'lens_block.pre_r11.js'), encoding='utf-8').read()
views = open(os.path.join(D, 'views_block.js'), encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:110])
    s = s.replace(a, b)

# ---- colours ----
rep("  const LENS_ROW = { thermal: 0, wear: 1, hur: 2, ts: 2, hail: 3, wear_t: 4, leak: 5, rust: 6, algae: 7 };",
    "  const LENS_ROW = { thermal: 0, wear: 1, hur: 2, ts: 2, hail: 3, wear_t: 4, leak: 5, rust: 6, algae: 7, shingle: 8, metal: 9, tile: 10, low: 11, lowW: 12, mh: 13, mbldg: 14, tab3: 15, lam: 16, other: 17, storm: 18 };")
rep("    ['#16260f', '#35591f', '#5d9134', '#9fd06a', '#e9ffd4'],                                                            /* algae */\n",
    "    ['#16260f', '#35591f', '#5d9134', '#9fd06a', '#e9ffd4'],                                                            /* algae */\n"
    "    ['#2b3140', '#56627a', '#93a5cc'],                                                                                  /* covering: asphalt shingles */\n"
    "    ['#0f3340', '#1f7f9a', '#62d6f0'],                                                                                  /* covering: metal on a house */\n"
    "    ['#40180c', '#a8451f', '#f38d4c'],                                                                                  /* covering: tile or slate */\n"
    "    ['#2a2233', '#5d4a78', '#a98fd6'],                                                                                  /* covering: a dark membrane */\n"
    "    ['#5a5f66', '#b4bcc6', '#f5f8fb'],                                                                                  /* covering: a white membrane */\n"
    "    ['#33300f', '#7d7526', '#d9ce58'],                                                                                  /* covering: a manufactured home roof */\n"
    "    ['#0f3326', '#218a63', '#63e0b0'],                                                                                  /* covering: metal building panels */\n"
    "    ['#101c3a', '#2a57c0', '#82abff'],                                                                                  /* shingle style: three tab */\n"
    "    ['#3a2408', '#c07a14', '#ffc85c'],                                                                                  /* shingle style: laminated */\n"
    "    ['#1c1f24', '#3b4048', '#6a717c'],                                                                                  /* not shingles */\n"
    "    ['#10202c', '#235a7a', '#d9c23a', '#ea7a28', '#cf2a22', '#7e1040'],                                                 /* a storm: untouched to stripped */\n")

# ---- the helpers ----
rep("  /* what the lens holds for one building: everything that does not change from corner to corner */\n", views + "  /* what the lens holds for one building: everything that does not change from corner to corner */\n")
rep("R = { lens, b, types, opt, low, year, zip, la, lo, ref, hr, canopy: +ctx.canopy || 0, lum: ctx.lum, planes: [] };",
    "R = { lens, b, types, opt, low, year, zip, la, lo, ref, hr, canopy: +ctx.canopy || 0, lum: ctx.lum, planes: [], storm: clamp(Math.round(+ctx.storm || 0), 0, 9), step: ctx.stormStep || null, surgeNote: ctx.surgeNote || '' };")

# ---- the readings ----
rep("    if (R.lens === 'thermal') return R;\n    R.out = outlookOf(R.b, { heat: R.heat });",
    """    if (R.lens === 'thermal') return R;
    if (R.lens === 'cover') {
      /* the covering the building most likely carries (its kind, size and height, and its ZIP's share of metal roofs: the
         card's own odds), in that covering's colour, stronger the surer it is, with its pattern drawn at real size */
      const top = R.types[0], k = top[0], W = R.types.reduce((s, x) => s + x[1], 0) || 1, share = top[1] / W, C = COVER[k] || COVER.shingle, white = coverRow(k, R.lum) === 12;
      /* shingles are drawn in the style their likely years make more probable, as in the Shingle style view */
      const sty = k === 'shingle' ? styleOf(R.b, outlookOf(R.b, { heat: R.heat })) : null;
      R.cover = { k, share, white, lam: sty ? sty.lam : null, pat: k === 'shingle' ? (sty.lam >= 0.5 ? 8 : 7) : white ? 13 : C.pat }; const cv = [clamp(0.2 + 0.8 * (share - 0.3) / 0.7, 0.2, 1), 1, R.cover.pat, coverRow(k, R.lum)];
      R.vertex = () => cv; return R;
    }
    R.out = outlookOf(R.b, { heat: R.heat });
    if (R.lens === 'style') {
      /* which shingle: three tab or laminated, by the years the roof may have gone on (the share of each sold that year);
         a roof that is most likely not shingles is drawn grey, with its own pattern */
      const top = R.types[0], k = top[0], W = R.types.reduce((s, x) => s + x[1], 0) || 1, shS = (R.types.find(x => x[0] === 'shingle') || [0, 0])[1] / W, sty = styleOf(R.b, R.out); R.style = Object.assign({ shingle: shS, top: k }, sty);
      const lam = sty.lam >= 0.5, sure = lam ? sty.lam : 1 - sty.lam, C = COVER[k] || COVER.shingle;
      const cv = k === 'shingle' ? [clamp(0.25 + 1.5 * (sure - 0.5), 0.25, 1), 1, lam ? 8 : 7, lam ? LENS_ROW.lam : LENS_ROW.tab3] : [0.55, 1, coverRow(k, R.lum) === 12 ? 13 : C.pat, LENS_ROW.other];
      R.vertex = () => cv; return R;
    }
    if (R.lens === 'storm') {
      /* the storm on the scale, on this roof: the chance it needs a roofer, hardest at the ridge and hips and a little at
         the edges, as in the Time view; in rain without wind, the chance it calls with a leak this year */
      const S0 = stormOnRoof(R.b, R.out, R.storm, R.step); R.st = S0;
      if (S0.kind === 'rain') { const v = clamp(S0.leak / 0.1, 0, 1); R.vertex = (n, zone) => [clamp(v * (0.6 + 0.6 * zone.edge + 0.5 * zone.ridge), 0, 1), v * 0.5, 6, LENS_ROW.leak]; }
      else { const a = S0.any; R.vertex = (n, zone) => { const zk = 0.2 * zone.edge + 0.1 * zone.corner + 0.5 * zone.ridge, v = clamp(a * (0.78 + zk), 0, 1); return [v, clamp(v * 1.1, 0, 1), 1, LENS_ROW.storm]; }; }
      return R;
    }""")

# ---- the key beside the view ----
rep("    /* time */\n    const y = R ? R.year : clamp(Math.round(+ctx.year || 0), 0, OUT_Y),",
    """    const chip = (row, l, extra) => `<span class="se-leg-row"><i style="background:${LENS_PAL[row][LENS_PAL[row].length - 1]}"></i>${esc(l)}${extra || ''}</span>`;
    if (lens === 'cover') {
      let h = `<b>Covering: what each roof is most likely made of</b><span class="se-leg-note">Each roof takes its covering's colour, stronger the surer it is, and its pattern at a common size of that covering: fly close and the courses, seams and ribs show.</span>${COVER_KEY.map(([k, l]) => chip(LENS_ROW[k], l)).join('')}`;
      if (R && R.cover) { const C = COVER[R.cover.k] || COVER.shingle, pw = photoWord(R.lum);
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>Most likely <b>${esc(C.l.toLowerCase())}</b> (${pct(R.cover.share)})${R.types.length > 1 ? '; else ' + esc(R.types.slice(1).filter(x => x[1] >= 0.02).map(([k, w]) => `${(COVER[k] || COVER.shingle).s} ${pct(w)}`).join(', ')) : ''}${C.d ? '<br>' + esc(C.d.charAt(0).toUpperCase() + C.d.slice(1)) + '.' : ''}${pw ? `<br>It shows ${pw} in the satellite photo${(R.cover.k === 'low' || R.cover.k === 'lowmf') ? (R.cover.white ? ': drawn as a white membrane or coating' : ': drawn as a dark membrane') : ''}.` : ''}</span>`; }
      else h += '<span class="se-leg-cur">Click a building to read its roof.</span>';
      return h + '<span class="se-leg-note">The odds are the card\\'s: from the building\\'s kind, size and height and its ZIP\\'s share of metal roofs. No one has looked at the roof.</span>';
    }
    if (lens === 'style') {
      let h = `<b>Shingle style: three tab or laminated</b><span class="se-leg-note">Laminated (architectural) shingles were 7% of those sold in 1984, 46% in 2000, about 70% in 2010 and 95% in 2025 (makers' filings and investor reports; Fine Homebuilding for 2010; national). Each shingle roof takes the style its likely years of roofing make more probable.</span>${chip(LENS_ROW.tab3, 'Three tab strip: 12 inch tabs, 5 inch exposure')}${chip(LENS_ROW.lam, 'Laminated: uneven tabs, 5 5/8 inch exposure')}${chip(LENS_ROW.other, 'Most likely not shingles (its own pattern)')}`;
      if (R && R.style) { const s = R.style;
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${s.top === 'shingle' ? `By its likely age the shingles went on around <b>${s.year}</b><br>Laminated <b>${pct(s.lam)}</b> · three tab <b>${pct(1 - s.lam)}</b>${s.shingle < 0.97 ? `<br>If it is shingles at all (${pct(s.shingle)})` : ''}` : `Most likely ${esc((COVER[s.top] || COVER.shingle).s)}, not shingles${s.shingle > 0.02 ? ` (shingles ${pct(s.shingle)}: if so, laminated ${pct(s.lam)})` : ''}`}</span>`; }
      else h += '<span class="se-leg-cur">Click a building to read its roof.</span>';
      return h + '<span class="se-leg-note">From the roof\\'s likely age and national sales, not from the photo. No split for Louisiana was found, and older roofs here may be three tab more often than national sales suggest.</span>';
    }
    if (lens === 'storm') {
      const lv = R ? R.storm : clamp(Math.round(+ctx.storm || 0), 0, 9), sp = (R && R.step) || ctx.stormStep || null, nm = sp ? sp.l : 'No storm';
      let h = `<b>Storm: ${esc(nm)}${sp && sp.mph ? `, ${sp.range ? (sp.range[1] ? sp.range[0] + ' to ' + sp.range[1] : sp.range[0] + ' and up') : 'about ' + sp.mph} mph` : ''}</b>`;
      if (lv === 0) h += '<span class="se-leg-note">Slide the storm scale off Dry to see what each step would do to each roof.</span>';
      else if (lv <= 2) h += `<span class="se-leg-note">Rain without wind does not take roofs. It finds the leaks they have: each roof shows its chance of a leak call this year, from the repair line's calls at its age.</span>${ramp(LENS_ROW.leak, 0, 0, ['0', '', '5%', '', '10% a year'])}`;
      else h += `<span class="se-leg-note">${lv === 3 ? 'One severe thunderstorm with 58 mph gusts: the atlas\\'s stated rate for such a day, about 3 roofs in 10,000 within 25 miles.' : `A wind like this replaces about <b>${pc1(stormShare(sp.kt))}</b> of a ZIP's roofs: the atlas's damage curve, scaled to what FEMA's counts have come to${lv >= 8 ? ', and carried past Category 3 on one survey after Andrew: a judgment' : ''}.`} Each roof shows its own chance of needing a roofer, by its covering and age.</span>${ramp(LENS_ROW.storm, 0, 0, ['untouched', '', 'half', '', 'near certain'])}<span class="se-leg-marks"><span><i class="m1"></i>cover lost at ridge, hips and edges</span></span>`;
      if (R && R.st && lv > 0) { const s = R.st, T0 = RTYPE[R.types[0][0]] || RTYPE.shingle, tw = topWind(R.zip);
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${esc(kinds)}<br>${s.kind === 'rain' ? `A leak call this year: <b>${pc1(s.leak)}</b>` : `Needs a roofer <b>${pc1(s.any)}</b> · replaced <b>${pc1(s.rep)}</b> · repaired ${pc1(s.fix)}${lv >= 4 ? '<br>' + esc(T0.does.hur) + '.' : ''}`}${tw && lv >= 4 ? `<br>The strongest wind on record at this ZIP since ${OC.recFrom}: ${ktMph0(tw.kt)} mph, ${esc(stormName(SIDS[tw.si]))}.` : ''}${R.surgeNote ? '<br>' + esc(R.surgeNote) : ''}</span>`; }
      else if (lv > 0) h += '<span class="se-leg-cur">Click a building to read its roof.</span>';
      return h + '<span class="se-leg-note">Odds from records and stated judgments, not a forecast of a storm, and not an inspection.</span>';
    }
    /* time */
    const y = R ? R.year : clamp(Math.round(+ctx.year || 0), 0, OUT_Y),""")

# ---- the list ----
rep("names: { thermal: 'Thermal', wear: 'Wear', time: 'Time' },", "names: { cover: 'Covering', style: 'Shingle style', thermal: 'Thermal', wear: 'Wear', storm: 'Storm', time: 'Time' },")
rep("    list: [['off', 'Off', 'The scene as it looks'],\n", "    list: [['off', 'Off', 'The scene as it looks'],\n"
    "      ['cover', 'Covering', 'What each roof is most likely made of: asphalt shingles, metal, tile or slate, a membrane, a manufactured home roof or metal building panels, each in its colour with its pattern drawn at a common size of that covering'],\n"
    "      ['style', 'Shingle style', 'Three tab strips or laminated (architectural) shingles: which is more likely on each shingle roof, from the years it may have gone on and the share of each sold then, with the courses drawn at their size'],\n")
rep("      ['time', 'Time', 'The next 15 years:", "      ['storm', 'Storm', 'What the storm on the storm scale would do to each roof: its chance of needing a roofer, by its covering and age, from the atlas\\'s damage record; in rain without wind, its chance of a leak call'],\n      ['time', 'Time', 'The next 15 years:")
rep("    label: (lens, R) => { if (!R) return ''; if (lens === 'thermal')", "    label: (lens, R) => { if (!R) return ''; if (lens === 'cover') return R.cover ? (R.cover.white ? 'White membrane' : (COVER[R.cover.k] || COVER.shingle).l.replace(' on a house', '')) + ' ' + pct(R.cover.share) : ''; if (lens === 'style') return R.style ? (R.style.top !== 'shingle' ? 'Not shingles' : R.style.lam >= 0.5 ? 'Laminated ' + pct(R.style.lam) : 'Three tab ' + pct(1 - R.style.lam)) : ''; if (lens === 'storm') return R.st ? (R.st.kind === 'dry' ? '' : R.st.kind === 'rain' ? 'Leak ' + pc1(R.st.leak) : pc1(R.st.any)) : ''; if (lens === 'thermal')")
rep("    begin: lensBegin, ready: lensReady, legend: lensLegend,", "    begin: lensBegin, ready: lensReady, legend: lensLegend, surge: surgeAt, stormShare, stormOnRoof, styleOf, lamAt, cover: COVER,")

open(os.path.join(D, 'lens_block.js'), 'w', encoding='utf-8').write(s)
print('lens ok', len(s))
