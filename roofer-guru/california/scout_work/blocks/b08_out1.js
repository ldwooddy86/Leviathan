  /* ---------- the next fifteen years: what each kind of roof is likely to suffer where it stands ---------- */
  /* An outlook built from California's own record, year by year for fifteen years, for one kind of roof at one ZIP whose
     age today is known as a spread of chances (the clock above). Each year a roof in place can:
       wear out          its Weibull life (module 17: one life for every covering but tile, refitted to the American
                         Housing Survey's West region; for tile the life of the underlayment), shortened or stretched
                         by the heat it takes where it stands (the Thermal reading below) against the average
                         California roof of its kind;
       take the wind     the days a year with a gust of 58 mph and of 75 mph at the ZIP's nearest screened station
                         (Santa Ana, Diablo and sundowner days and winter storm days alike), at the atlas's stated
                         rates of roofs damaged on such a day, turned for each covering and its age;
       leak in the rain  the repair line's calls a year, shaped by the roof's age (the shape is a judgment), leaned by
                         how much heavy rain the ZIP takes against the state: its days with an inch of rain and its
                         atmospheric river days of rank 3 and up, and a little more in snow country (ice dams);
       burn              the pace at which CAL FIRE's damage inspections record structures destroyed or damaged in
                         the ZIP and those within 40 km, 2013 to 2025, turned by the Fire Hazard Severity Zone the
                         building stands in and, slightly, by the covering;
       take hail         the days a year with 1 inch and 1.75 inch hail within 25 miles where the data counts them
                         (rare: 349 reports of an inch or more in California since 1951), at the atlas's stated rates;
     and two slower things are told beside them: moss and algae where it is wet, and rust on metal near salt water. A
     roof that is replaced starts again at age zero and stays in the count. What comes out is a chance, for the
     building's kind of roof at its ZIP, of each kind of damage by each year: the odds if the next fifteen years bring
     weather and fire at the pace of the record, not a forecast of a storm or a fire. Every rate that is a judgment is
     marked in OC. */
  const OUT_Y = 15;
  const AW = (ANCH.wind && ANCH.wind.length >= 2 ? ANCH.wind : null);
  const OC = {
    /* gust days: roofs damaged on a day with a 58 mph gust and on a day with a 75 mph gust (the atlas's stated rates
       where the data carries them, else 3 and 15 roofs in 10,000: a judgment, grade D; forecasters' reports in
       California first name roof damage at gusts of about 60 to 70 mph), and the share of that damage that is a
       replacement, not a repair (judgment). A station on a ridge or in a pass can count far more days than the
       streets below it take: days are capped at 25 and 5 a year. */
    wind: [[+(AW && AW[0]) || 0.0003, 0.2], [+(AW && AW[1]) || 0.0015, 0.4]], capG58: 25, capG75: 5,
    /* hail: roofs damaged per day with 1 inch hail, and a further share per day with 1.75 inch hail (stated rates), with the share replaced (judgment) */
    hail: [[0.0022, 0.6], [0.004, 0.9]],
    /* A roof's age against the wind, as a multiple of the hazard (before scaling: the average California roof is 1).
       Shingles hold for their first years and then let go: the University of Florida found no unsealed shingles on roofs
       under four years old, under 1 percent of strips at six years, 12 percent at 7 to 13 and 30 percent at 14 to 20,
       with hip and ridge caps unsealed at every age (Dixon and others 2013); in a survey of 623 homes after a 2020
       coastal windstorm, 40 percent of two to three year old shingle roofs were damaged against 97 percent of those 14 to 15
       years old, with a break near eight years (NIST 2026); in the 2020 Midwest derecho a roof over ten years old was
       five times as likely to show damage as one of three to six (IBHS 2023). None of these is a California study:
       none was found. The multiple below is drawn through them (judgment, grade D) and scaled so that California's
       roofs at their ages today (module 17) average 1. */
    age: a => (a <= 3 ? 0.08 : a <= 6 ? 0.08 + (a - 3) * 0.26 / 3 : a <= 9 ? 0.34 + (a - 6) * 0.22 : a <= 15 ? 1 + (a - 9) * 0.4 / 6 : a <= 20 ? 1.4 + (a - 15) * 0.04 : 1.6),
    /* Metal and tile age another way: in a Florida survey of 768 roofs damage on them rose negligibly until the roof was
       past ten (University of Florida and Auburn 2023). Their multiple stays low for ten years and rises after, as
       fasteners back out and underlayment and battens age (the rise is a judgment). Scaled the same way. */
    ageHard: a => (a <= 10 ? 0.4 : a <= 25 ? 0.4 + (a - 10) * 0.1 : 1.9),
    /* and against hail: weathered shingles and membranes grow brittle (RICOWI's Dallas survey rated shingles over 9 years
       old at twice the damage of newer ones; Haag); tile and steel do not change with age */
    hailAge: a => (a <= 5 ? 0.6 : a < 9 ? 0.6 + (a - 5) * 0.1 : a < 15 ? 1 + (a - 9) * 0.5 / 6 : 1.5),
    /* wind at the roof: taller buildings stand in faster air (ASCE 7 exposure coefficients, judgment on the step) */
    tall: st => (st >= 3 ? 1.2 : st === 2 ? 1.1 : 1),
    /* the fire record: the years CAL FIRE's digital damage inspections cover; each ZIP's own record is steadied by the
       ZIPs within 40 km, by their homes, because where a fire ran is partly luck; a damaged structure counts half */
    fireFrom: 2013, fireTo: 2025, nearKm: 40, own: 0.6, dmgW: 0.5,
    /* rain's lean on leaks: the square root of the ZIP's heavy rain against the state's, held between 0.6 and 1.6 (a roof
       leaks when it rains, but repair calls do not double where rain does: judgment, grade D); snow country adds up to 30 percent */
    rainLo: 0.6, rainHi: 1.6, snowLeak: 0.3,
  };
  /* the kinds of roof the outlook tells apart. life: the clock's key (LIFE); wind: against shingles; ageK: how much of
     the shingles' ageing against wind the covering shares, or 'hard' for metal and tile, which follow OC.ageHard (their
     wind factors are a judgment from the Florida survey above, about a fifth to a third of the shingles' hazard past
     five years; nothing was found on wood shakes, which are taken a little worse than shingles); hail: against shingles
     on a 1 inch day and on a 1.75 inch day, from Haag Engineering's threshold sizes; hailK: how much of the shingles'
     ageing against hail it shares; leak: repair calls against the survey's rate (judgment); fire: the relative risk of
     destruction in the 2013 to 2018 fires by roof material (Syphard and Keeley 2019, statewide: asphalt 1.05, tile
     0.88, concrete 0.89, metal 0.97, wood 1.00 and not significant: roof material "did not explain substantial
     variation", because most roofs were already fire resistant and embers got in at eaves, vents and windows); cls:
     the fire class the covering most likely carries as an assembly [A, B, C, unrated] when new or re-roofed since the
     class rules, and old (see the Fire view); what each cause does to it. */
  const RTYPE = {
    shingle: { l: 'Asphalt shingles', s: 'shingles', life: 'shingle', wind: 1, ageK: 1, hail: [1, 1], hailK: 1, leak: 1, algae: 1, rust: 0, fire: 1.05,
      does: { wind: 'Hip and ridge caps go first; tabs lift, crease and blow off, in the middle of a slope about as often as along its edges; limbs come through the deck', rain: 'Leaks at pipe boots, wall and chimney flashing, valleys and nail pops; a long atmospheric river finds every one of them', fire: 'Most asphalt shingle roofs are Class A assemblies and do not ignite from embers alone; fires get in at open eaves, vents wider than 1/8 inch, gutters full of needles and the gap at the roof edge', hail: 'Bruises that crack the mat under the granules, granule loss in spatters; dents in vents and flashing mark the size', wear: 'Granules wash off, the asphalt dries and cracks, tabs curl and blister; the south and west slopes go first, and faster in the valleys and deserts', algae: 'Dark algae streaks and moss, first on the north and shaded slopes', rust: '' } },
    tile: { l: 'Tile (clay or concrete), or slate', s: 'tile', life: 'tile', wind: 0.3, ageK: 'hard', hail: [0.1, 0.85], hailK: 0, leak: 1.1, algae: 0.5, rust: 0, fire: 0.88,
      does: { wind: 'Tiles lift, slide and break at the eaves, hips and ridge; loose pieces break more; mortar set ridge and hip tiles fail first', rain: 'Water gets under tile by design; the underlayment sheds it. Leaks come where the underlayment has worn through, at valleys, flashings and slipped pieces, and show in the first long storm of a wet winter', fire: 'Clay and concrete tile do not burn, but the air space under them lets embers reach the underlayment and deck: in a fire zone the code wants bird stops at the eaves, mudded hips and ridges and a 72 pound cap sheet or a Class A underlayment under the tile', hail: 'Cracked and broken tiles from hail of 1.5 to 1.75 inches and up; corners and exposed edges go first', wear: 'The tile outlasts the underlayment and the fasteners under it: about 25 years for standard underlayment by the trade\'s figures, then slipped pieces, rusted nails and felt that no longer sheds water. The job is a lift and relay: new underlayment under the same tile', algae: 'Moss, lichen and mildew on shaded slopes', rust: '' } },
    wood: { l: 'Wood shakes or shingles', s: 'wood shakes', life: 'wood', wind: 1.1, ageK: 1, hail: [0.9, 1], hailK: 1, leak: 1.2, algae: 1.3, rust: 0, fire: 1,
      does: { wind: 'Split and loosened shakes lift and blow off; ridge caps go first', rain: 'Cupped, split and missing shakes let water to the interlayment; moss holds water against the wood', fire: 'An untreated wood roof is the one covering the older fires single out: in the 1990 Painted Cave fire 70 percent of homes with nonflammable roofs survived against 19 percent with flammable ones. No untreated wood roofing may be sold or applied in California, and Los Angeles and San Diego allow no wood re-roof', hail: 'Splits along the grain from the larger stones', wear: 'Shakes split, cup and curl in the sun and rot where they stay wet; the interlayment felt ages with them', algae: 'Moss and lichen, heavy where it is wet and shaded', rust: '' } },
    flat: { l: 'Low slope roof on a house', s: 'low slope roofs', life: 'flat', wind: 0.6, ageK: 0.6, hail: [0.15, 0.6], hailK: 0.8, leak: 1.5, algae: 0.3, rust: 0, fire: 1,
      does: { wind: 'A cap sheet or membrane peels from the edge once the edge metal or a flashing lets go; gravel scours', rain: 'Ponding at clogged scuppers and drains, open laps and blisters, flashings pulled from parapets and skylights: a flat roof shows its age in the first atmospheric river of the season', fire: 'A cap sheet or a gravel surfaced built up roof is usually a Class A assembly; embers collect in leaf litter at parapets and scuppers', hail: 'Fractured or punctured membrane, sooner when weathered', wear: 'The sun dries the asphalt and takes the granules; seams open, the sheet shrinks and blisters; ponding speeds all of it', algae: 'Dirt and growth where water stands', rust: '' } },
    metal: { l: 'Metal (standing seam or panels)', s: 'metal', life: 'metal', wind: 0.3, ageK: 'hard', hail: [0.03, 0.15], hailK: 0, leak: 0.7, algae: 0.15, rust: 1, fire: 0.97,
      does: { wind: 'Panels peel at the eaves, rakes and ridge where clips or screws let go; ridge caps and trim strip', rain: 'Leaks at screws, laps, ridge and pipe boots', fire: 'Metal does not burn; the deck under it can, where debris packs the ribs at the eave or the edge is open', hail: 'Dents that leave the coating whole; it takes hail of about 2.5 inches to split a panel', wear: 'On exposed fastener roofs screws back out and their washers dry and split; paint chalks and fades; sealant at laps fails', algae: 'Dirt and mildew film on shaded panels', rust: 'Red rust at cut edges, laps, scratches and fasteners; salt air off the Pacific and the bays speeds it, and makers do not warrant the coating close to salt water' } },
    mh: { l: 'Manufactured home roof', s: 'manufactured home roofs', life: 'mh', wind: 1.3, ageK: 1, hail: [0.8, 0.9], hailK: 0.6, leak: 1.3, algae: 0.6, rust: 0.6, fire: 1.05,
      does: { wind: 'Metal roof sheets peel from the edges and a roof over lifts; on pitched double wides shingles strip as on a house, sooner, because the decks are lighter', rain: 'Leaks at seams, vents and the marriage line', fire: 'Light roofs over light walls: in the fires of 2017 to 2020 whole parks were lost', hail: 'Dented sheet metal, cracked coatings', wear: 'Seams and fasteners open, coatings chalk and crack, the roof over sags and ponds', algae: 'Mildew and algae on coatings and shingles', rust: 'Rust at seams, fasteners and edges of sheet metal roofs' } },
    low: { l: 'Low slope membrane', s: 'low slope membranes', life: 'low', wind: 0.7, ageK: 0.6, hail: [0.15, 0.6], hailK: 0.8, leak: 1.4, algae: 0.3, rust: 0, fire: 1,
      does: { wind: 'The membrane peels from the corners and edges once the edge metal or a flashing lets go; gravel scours; rooftop units shift and tear their curbs', rain: 'Leaks at seams, drains, curbs and wall flashings; ponding where drains clog; wet insulation under the membrane', fire: 'Most membranes and cap sheets are Class A assemblies; embers gather at parapets, rooftop units and skylights', hail: 'Fractured or punctured membrane, crushed insulation under it, split base flashing', wear: 'Seams open, flashings pull from walls and curbs, the membrane shrinks, cracks and blisters; a white membrane soils and loses reflectance (the Energy Code counts on about 70 percent of its gain over 0.20 lasting three years)', algae: 'Dirt and growth that darken a white membrane and raise its temperature', rust: '' } },
    mbldg: { l: 'Metal building roof', s: 'metal building roofs', life: 'mbldg', wind: 0.7, ageK: 'hard', hail: [0.03, 0.15], hailK: 0, leak: 1.2, algae: 0.1, rust: 1, fire: 0.97,
      does: { wind: 'Panels peel from the eave and rake, ridge caps and gutters strip, skylight panels shatter', rain: 'Leaks at fasteners, laps, ridge, skylight panels and around units', fire: 'Steel panels do not burn; plastic skylight panels and what is stored under the roof do', hail: 'Dents that leave the coating whole; fractured skylight panels', wear: 'Fasteners back out, washers and lap sealant fail, panels move at the laps', algae: 'Dirt film', rust: 'Rust at eaves, laps, around units and at every scratch; faster in salt air' } },
  };
  RTYPE.lowmf = Object.assign({}, RTYPE.low, { life: 'lowmf', wind: 0.8 });
  const CAUSES = [['wind', 'Wind'], ['rain', 'Rain and leaks'], ['fire', 'Wildfire'], ['hail', 'Hail'], ['wear', 'Heat, sun and age']];
  const CAUSE_L = Object.fromEntries(CAUSES);
