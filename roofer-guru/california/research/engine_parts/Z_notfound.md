# Z. What was not found, and what is weak

## Not found (the engine value for each of these is an assumption and should be labelled so)

| Section | Item | Why |
|---|---|---|
| A | Electric 2027 M3: official power, torque, weight, 0-60, dimensions, wheelbase, track, weight distribution, drag | BMW had published none of them by 19 Nov 2026. Press figures from the prototype drive are in A2c |
| A | Centre of gravity height of the G80 | Not published by BMW. NHTSA's rollover figure exists for the ordinary 3 Series only, and its conversion formula is an image in the Federal Register notice |
| A | A full dyno torque curve for the S58 engine | Only the plateau end-points and the power peak are published |
| A | Measured tyre force data for the M3's own tyres | Not in an open source; generic Michelin and Magic Formula figures given instead |
| B | Aircraft type mix at LAX and SFO | LAX publishes none; SFO's is an interactive dashboard. San Diego's table is in B6 |
| B | A hard contrail threshold (temperature, altitude) from an official page | NASA Langley's page was unreachable; the two official factsheets give no number except "as cold as -70 °F" |
| B | Cruise Mach numbers for the Boeing types; Airbus A380 maker's page | Not on the pages opened |
| C | A 24-hour traffic volume curve for California freeways | Caltrans PeMS needs a login. Hour-by-hour speed and congestion (C3) and peak-hour factors (C2) are given instead |
| C | Posted speed limits on individual Los Angeles arterials; typical arterial lane widths in Los Angeles | Not looked up street by street; only the statutory limits and the city's kerb-to-kerb standards were found |
| C | HPMS lane counts at two points (US-101 at Havenhurst, I-5 at Osborne) and on I-15 at Miramar | The spatial query returned nothing at my coordinates |
| D | An official share of one-way streets in San Francisco | Derived from the city's street file instead, with a known upward bias |
| D | Typical San Francisco street widths | Not confirmed in any source opened |
| D | Siemens light rail car dimensions; a current official Muni fleet count | Not in the sources opened |
| D | The city's own steepest-streets list and Lombard Street geometry from a city source | The Bureau of Engineering list survives only in press reproductions; the county authority's PDFs returned 403 or were too large |
| E | Anything from official Navy pages | navy.mil, cnic.navy.mil and nvr.navy.mil all refused automated fetches |
| E | Flight deck height above water, island and mast heights, hull paint colour and number placement for the four ship classes | Not in the pages opened |
| E | Number of carrier berths at North Island from an official source; published flight tracks and pattern altitudes over the bay | Navy noise study not reachable. FAA remarks on helicopter altitudes are in E1 |
| E | Coronado Bridge colour; Hotel del Coronado roof colour and turret shape | Not stated in the text opened |
| F | Vincent Thomas Bridge colour; Bay Bridge west span tower height and colour from an official source | Wikipedia only, or not stated |

## Weak or conflicting, use with care

- **Electric M3 model code**: BMWBlog says ZA0; evo once wrote JA1. BMW publishes neither.
- **Electric M3 weight**: journalists' guesses of 2.3 t and "the thick end of 2500kg" disagree.
- **Golden Gate daily traffic**: the District's operations page says "about 112,000"; its own crossing table and Caltrans both give about 93,000 to 94,000 for the latest year. Use the latter.
- **Vincent Thomas daily traffic**: Wikipedia 32,000 against Caltrans 63,000 (2024). Use Caltrans.
- **Truck percentages**: many Caltrans truck rows are estimates carried forward from older counts.
- **HPMS `through_lanes`**: read as both directions including carpool lanes; the field manual was not opened. The SR-110 downtown value of 13 and the Richmond-San Rafael value of 2 show the coding is not uniform.
- **One-way share in San Francisco**: 27 per cent citywide is an upper bound because divided boulevards are drawn as two one-way lines; the downtown figure of about 65 per cent is more trustworthy.
- **Carriers at North Island**: Abraham Lincoln is due to leave by the end of 2026; Carl Vinson's presence rests on Wikipedia alone.
- **TomTom speeds** are averages over all roads driven, not freeway-only, except where the freeway and street rows are given separately.
- **BTS hourly flight counts** cover US airlines' domestic flights only; they give the shape of the day, not the tower totals.
