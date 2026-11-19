# D. San Francisco traffic

Hour-by-hour speeds for San Francisco are in the table in C3 (TomTom 2025). In short: city-centre streets average 10 mph all day and 8 mph in the evening rush; the whole metro averages 18 mph at 5 p.m. against 39 mph at 4 a.m.

## D1. The two big bridges as traffic

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| **Bay Bridge** volume | 231,000 vehicles a day at the toll plaza (both directions), 2024 | "080 ALA 1.989 SAN FRANCISCO-OAKLAND BAY BRIDGE TOLL PLAZA ... BACK_PEAK_HOUR 15400 ... BACK_AADT 231000 ... AHEAD_AADT 231000" | Caltrans "2024 AADT DATA" workbook (URL in C1) | VERIFIED (data) |
| Bay Bridge, west span legs | 114,000 to 118,000 a day on each deck between Fremont/Harrison and Yerba Buena Island | "080 SF 7.719 TREASURE ISLAND; YERBA BUENA ISLAND ... 115000 ... 114000" (one alignment) and "... 118000 ... 117000" (the other) | Same | VERIFIED (data) |
| Bay Bridge peak flow | 9,368 vehicles an hour westbound in the morning peak; 8,542 eastbound in the afternoon | Peak hours row "04 080 ALA 1.989 ... W 9368 ... 4.73 ... E 8542 ... 6.21 ... 58.38" | Caltrans "2024 PEAK HOURS REPORT" (URL in C2) | VERIFIED (data). About 1,870 per lane per hour westbound (DERIVED) |
| Bay Bridge lanes | Five each way: westbound on the upper deck, eastbound on the lower (west span and tunnel); side-by-side decks on the east span | "Traffic Lanes: Five lanes in each direction"; "The upper deck was dedicated to westbound traffic, and the lower deck was dedicated to eastbound" (Wikipedia) | MTC, https://mtc.ca.gov/operations/programs-projects/bridges/san-francisco-oakland-bay-bridge ; deck assignment from https://en.wikipedia.org/wiki/San_Francisco%E2%80%93Oakland_Bay_Bridge | VERIFIED (lanes); SECONDARY (which deck) |
| Bay Bridge toll | Westbound only, collected in Oakland; $8.50 for cars in 2026 | "Collection: One way, westbound, in Oakland"; "Auto Toll: $8.50"; "FY 2022-23 Total Toll-Paid Vehicles: 42,753,377" | MTC, same page | VERIFIED. 42.75 million a year is 117,000 a day westbound (DERIVED) |
| Bay Bridge trucks | 2.5 to 2.6 per cent | "080 ALA 1.989 ... 231000 ... 5960 ... 2.58" | Caltrans "Truck AADTs 2024" | VERIFIED (data) |
| **Golden Gate Bridge** volume | 93,000 a day (Caltrans 2024); 34,293,000 crossings in fiscal 2026, which is 94,000 a day; the District's own page still says "about 112,000" | "101 MRN 0 GOLDEN GATE BRIDGE ... AHEAD_PEAK_HOUR 7500 ... AHEAD_AADT 93000"; table row "FY 2026 17,146,500 34,293,000" (southbound only, and total as about twice southbound); "carries about 112,000 vehicles per day" | Caltrans 2024 workbook; Golden Gate Bridge District, https://www.goldengate.org/bridge/history-research/statistics-data/annual-vehicle-crossings-toll-revenues/ and https://www.goldengate.org/bridge/bridge-operations/ | VERIFIED. Use 93,000 to 94,000; the 112,000 is pre-2020 (fiscal 2019 was 40.0 million, 110,000 a day) |
| Golden Gate lanes | Six, split by a movable barrier: 3 and 3 off-peak and at weekends; 4 southbound in the weekday morning; 4 northbound in the weekday evening | "The barrier is typically positioned to allow three lanes of traffic southbound and three lanes northbound on weekends and during the day on weekdays. During weekday commute periods, the barrier is shifted to four lanes southbound into San Francisco in the morning and to four lanes northbound during the evening commute." | https://www.goldengate.org/bridge/bridge-operations/moveable-median-barrier/ | VERIFIED |
| Barrier move | A "zipper" truck shifts it about ten feet in about thirty minutes | "The truck picks up the barrier on one end and offsets the barrier by about ten feet on the other end. The lane change operation typically takes about thirty minutes to complete." | Same | VERIFIED |
| Golden Gate toll | Southbound only (into the city), all electronic, no booths to stop at | "Tolls are collected in one direction only — in the southbound direction into San Francisco. Toll rates are effective July 1, 2026." | https://www.goldengate.org/bridge/tolls-payment/ | VERIFIED |
| Golden Gate speed limit and lane widths | 45 mph; 25 mph through the toll plaza southbound. Kerb lanes 11 ft, others 10 ft | "The speed limit on the Bridge is 45 miles per hour (MPH)." and "The curb lanes (right lane, in both directions) are wider than other lanes - 11 feet wide versus 10 feet wide." | https://www.goldengate.org/bridge/bridge-operations/ | VERIFIED |
| Golden Gate trucks | 1.3 per cent | "101 MRN 0 leg A GOLDEN GATE BRIDGE ... 93000 ... 1237 ... 1.33" | Caltrans "Truck AADTs 2024" | VERIFIED (data) |

## D2. Freeways and main streets inside the city

All rows: Caltrans "2024 AADT DATA" (VERIFIED (data)); lanes from FHWA HPMS 2024 `through_lanes`, both directions (VERIFIED (data), same caveat as C1).

| Segment | AADT 2024 | Through lanes | Row quoted |
|---|---|---|---|
| US-101 Bayshore Fwy at I-280 / Cesar Chavez (Army St) | 215,000 to 226,000 | 8 to 10 | "101 SF 1.976 SAN FRANCISCO, JCT. RTE. 280 ... 215000 ... 226000" |
| US-101 at I-80 (Central Fwy split) | 193,000 | n/a | "101 SF 4.241 SAN FRANCISCO, JCT. RTE. 80 ... 193000" |
| I-80 at 7th/8th Streets (Bay Bridge approach) | 178,000 to 200,000 | n/a | "080 SF 4.4 SAN FRANCISCO, 7th/8th STREETS ... 178000 ... 200000" |
| I-280 at Geneva / Ocean | 157,000 to 169,000 | 8 | "280 SF R1.768 SAN FRANCISCO, GENEVA/ OCEAN AVENUES ... 157000 ... 169000" |
| Van Ness Avenue (US-101 on city streets) at California St | 39,500 to 42,500 | 4 general lanes plus 2 centre bus lanes | "101 SF 5.94 SAN FRANCISCO, CALIFORNIA STREET ... 40500 ... 39500"; HPMS "through_lanes 4, managed 2" |
| Lombard Street (US-101) at Broderick | 42,500 to 45,000 | n/a | "101 SF 7.8 SAN FRANCISCO, BRODERICK STREET ... 42500 ... 45000" |

Peak-hour factors in the city (Caltrans 2024 peak hours report, VERIFIED (data)): US-101 at Third Street, morning southbound 7,202 veh/h, K 6.95, D 55.7, hour ending 8; evening northbound 6,754, K 7.0, D 51.9, hour ending 17. I-280 at Alemany, morning northbound 6,548, K 6.9, D 61.1, hour 7; evening southbound 7,360, K 7.78, D 60.9, hour 16.

## D3. One-way streets

| Item | Figure | How obtained | Source | Status |
|---|---|---|---|---|
| Citywide share of street centreline that is coded one-way | 25 per cent of segments, 27 per cent of length (1,040 miles of active streets in the `STREETS` layer) | Count of `oneway` = F or T against B, weighted by segment length | DataSF, "Streets – Active and Retired", data as of 18 Nov 2026. https://data.sf.gov/resource/3psu-pn9h.json ; script `engine_scripts/sf_oneway.py` | DERIVED from published data. **Upper bound**: divided two-way boulevards (Sunset, Geary, Van Ness) are drawn as two one-way lines, which inflates the figure outside downtown |
| Downtown (Financial District/South Beach, South of Market, Tenderloin, Chinatown, Nob Hill) | 61 per cent of segments, 65 per cent of length | Same | Same | DERIVED |
| By neighbourhood | Tenderloin 76 per cent of length; South of Market 65; Financial District/South Beach 64; Nob Hill 61; Chinatown 57; Western Addition 54; Hayes Valley 45 | Same | Same | DERIVED |
| By street class | Class 3 (arterials) 83 per cent; class 4 (collectors) 43; class 5 (residential) 13 | Same, by `classcode` | Same | DERIVED (the arterial figure is inflated by divided roads) |
| A published official figure for the share of one-way streets | None found | n/a | n/a | NOT FOUND |

## D4. Muni buses, light rail and cable cars

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Colours of buses and trains | Silver (grey) with red stripes on every modern bus and rail car | "Today, every bus and rail car in the system, excluding historic vehicles, uses the silver and red look." | SFMTA, "Muni color schemes through the years". https://www.sfmta.com/blog/muni-color-schemes-through-years | VERIFIED |
| Fleet mix | About 550 hybrid buses, 300 electric trolleybuses (40 ft and 60 ft articulated), 219 Siemens light rail cars on order with 172 in service by Aug 2025, 40 cable cars | "As of 2022, Muni operates a fleet of roughly 550 diesel-electric hybrid buses and 300 electric trolleybuses"; "By August 2025, 172 cars had entered service." | Wikipedia, "San Francisco Municipal Railway fleet". https://en.wikipedia.org/wiki/San_Francisco_Municipal_Railway_fleet | SECONDARY |
| Bus lengths | 30 to 60 ft; trolleybuses 40 ft standard and 60 ft articulated | "coaches ranging from thirty to sixty feet in length" | Same | SECONDARY |
| Light rail car dimensions (Siemens LRV4) | NOT FOUND in the sources opened | n/a | n/a | NOT FOUND |
| Steepest grades by vehicle type | Bus 23.1 per cent; trolleybus 22.8; cable car 21; streetcar 9 | "Bus: 23.1% for 67-Bernal Heights on Alabama between Ripley and Esmeralda. Trolley Bus: 22.8% for 24-Divisadero on Noe between 26th and Cesar Chavez Cable Car: 21% for Powell-Hyde line on Hyde between Bay and Francisco. Streetcar: 9% for J-Church on private right-of-way in Dolores Park." | SFMTA archive, "Muni Trivia" (page copyright 2000-2013). https://archives.sfmta.com/cms/rhomemu/genmuinfo.htm | VERIFIED (old page) |
| **Cable car lines** | Three: Powell-Hyde and Powell-Mason from Powell and Market to the Fisherman's Wharf area; California from California and Market to Van Ness | "Choose from three cable car lines - two start at Powell and Market and continue to the Fisherman's Wharf area; one starts at California and Market and continues to Van Ness Avenue." Terminals named on the page: "Powell & Market, Bay & Taylor and Hyde & Beach Streets" | SFMTA. https://www.sfmta.com/getting-around/muni/cable-cars | VERIFIED |
| Cable car speed | A constant 9.5 mph, uphill and down | "enable the cable cars to move along at a nice 9.5 miles per hour constant speed, even on steep grades" | Cable Car Museum, "The Brakes". https://www.cablecarmuseum.org/the-brakes.html | VERIFIED |
| Powell cars (single-ended, turned on turntables) | 27 ft 6 in long, 8 ft wide, 10 ft 4 in high, 15,500 lb, 29 seats, 60 with standees; 28 cars | "Number of Operating Cars 28 \| Lenth of Car 27'-6" \| Width ofCars 8' \| Height of Car 10'-4" \| Weight of Cars 15,500 lbs. \| Capacity Seating 29 \| Total Capacity Seating / Standing 60" | Cable Car Museum. https://www.cablecarmuseum.org/car-powell.html | VERIFIED |
| California cars (double-ended, no turntable) | 30 ft 3 in long, 8 ft wide, 10 ft 2 in high, 16,800 lb, 34 seats, 68 total; 12 cars | "Number of Operating Cars 12 \| Lenth of Car 30'-3" \| Width ofCars 8' \| Height of Car 10'-2" \| Weight of Cars 16,800 lbs. \| Capacity Seating 34 \| Total Capacity Seating / Standing 68" | https://www.cablecarmuseum.org/car-california.html | VERIFIED |
| Cars on the street | 27 on weekdays (20 Powell, 7 California); 25 at weekends | "During the week, 27 cars are operated (20 Powell + 7 California) and on weekends, 25 cars are operated (20 Powell + 5 California)." | https://www.cablecarmuseum.org/cablecars.html | VERIFIED |
| Cables | Four loops, 1.25 in thick: California 21,700 ft, Hyde 16,000 ft, Mason 10,300 ft, Powell 9,300 ft; four 510 hp motors | "measures 1 1/4 inches in diameter ... the California (21,700 feet), Hyde (16,000 feet), Mason (10,300 feet), and Powell (9,300 feet)"; "four 510 horsepower engines were installed, one for each cable" | https://www.cablecarmuseum.org/the-cables.html ; https://www.cablecarmuseum.org/the-powerhouse.html | VERIFIED |
| Longest cable route | Powell-Hyde, 2.1 miles | "The longest cable car route is the Powell-Hyde at 2.1 miles." | SFMTA archive (URL above) | VERIFIED (old page) |
| Powell car colours | Maroon and light blue (since the 1982-84 rebuild); a few cars wear historic liveries (green and cream, blue and yellow, green with red trim) | "Powell Car 3 was left in the green and cream livery when all the other Powell cars were repainted maroon and light blue during the rebuilding of 1982-84." | Market Street Railway. https://www.streetcar.org/cablecars/3-No-3-Muni-greencream/ | VERIFIED |
| California car colours | Maroon, with grey and tan | "repainted back to traditional Cal Cable maroon, gray and tan" (car 55) | https://www.cablecarmuseum.org/car-california.html | VERIFIED |
| Where two cables cross | Powell at California; the Powell car lets go of its cable and coasts across | "the only intersection where cables cross is at the crest of Powell Street, at California" | https://www.cablecarmuseum.org/below-the-streets.html | VERIFIED |

## D5. Steep and crooked streets

| Street | Grade | Quote | Source | Status |
|---|---|---|---|---|
| Filbert, Leavenworth to Hyde | 31.5 per cent | "1. Filbert between Leavenworth and Hyde (31.5% grade) 2. 22nd between Church and Vicksburg (31.5% grade) 3. Jones between Union and Filbert (29% grade) 4. Duboce between Buena Vista and Alpine (27.9% grade) 5. Jones between Green and Union (26% grade) 6. Webster between Vallejo and Broadway (26% grade)" | 7x7, reproducing "the SF Bureau of Engineering's outdated list". https://www.7x7.com/the-real-top-10-list-of-steepest-streets-in-san-francisco-1786501295.html ; confirmed by ABC7: "According to the city's bureau of engineering, the steepest is Filbert between Leavenworth and Hyde. The road has a grade of 31.5 percent." https://abc7news.com/post/steepest-streets-in-san-francisco/5400145/ | SECONDARY (the city list itself was not found online) |
| 22nd Street, Church to Vicksburg | 31.5 per cent | Same list | Same | SECONDARY |
| Steeper short blocks found by a later survey | Bradford above Tompkins 41 per cent; Romolo 37.5; Prentiss 37; Nevada 35; Baden 34 | "1. Bradford above Tompkins (41% grade) 2. Romolo between Vallejo and Fresno (37.5% grade) 3. Prentiss between Chapman and Powhattan (37% grade)" | 7x7 (its own analysis of elevation data) | SECONDARY |
| Lombard Street, the crooked block (Hyde to Leavenworth) | Natural grade 27 per cent; eight turns; about 600 ft of roadway over 412.5 ft straight-line; one-way downhill (eastbound); red brick; advised 5 mph | "has eight sharp turns ... intended to reduce the hill's natural 27 percent grade ... The crooked block is about 600 feet (180 m) long (412.5 feet (125.7 m) straight line), is one-way (downhill) and is paved with red bricks. The sign at the top recommends 5 mph (8 km/h)." | Wikipedia, "Lombard Street (San Francisco)". https://en.wikipedia.org/wiki/Lombard_Street_(San_Francisco) | SECONDARY (the county transportation authority's reports returned 403 or were too large to open) |
| Lombard visitors and queues | About 2 million visitors a year; cars may wait up to 45 minutes | "drawing approximately 2 million visitors each year"; image caption "cars may wait up to 45 minutes" | San Francisco County Transportation Authority. https://www.sfcta.org/projects/lombard-crooked-street | VERIFIED (fetch tool) |

## D6. Street widths

| Item | Finding | Source | Status |
|---|---|---|---|
| Typical San Francisco street right-of-way and roadway widths | Not found in a source I could open. (The figures usually quoted, 68 ft 9 in for streets north of Market, 82 ft 6 in south of Market and 120 ft for Market Street, were seen only as my own search terms, not confirmed by any result.) | Searches of the Better Streets Plan pages | NOT FOUND |
| What is verified nearby | Golden Gate Bridge roadway 62 ft kerb to kerb for six lanes (10 and 11 ft lanes); Van Ness carries four general lanes plus two bus lanes | D1, D2 | VERIFIED |

---

