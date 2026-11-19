# C. Los Angeles traffic

## C1. Freeway volumes, lanes and trucks

Sources for the three data columns:

- **Volume**: Caltrans Traffic Census, "2024 AADT DATA" workbook, https://dot.ca.gov/-/media/dot-media/programs/traffic-operations/documents/census/2024/2024-traffic-volumes-ca-a11y.xlsx (index page https://dot.ca.gov/programs/traffic-operations/census). AADT is both directions added together, vehicles a day ("All traffic volume figures listed include traffic in both directions"). Caltrans: "Back AADT, Peak Month, and Peak Hour usually represents traffic South or West of the count location. Ahead AADT, Peak Month, and Peak Hour usually represents traffic North or East of the count location." and "In urban and suburban areas, the peak hour normally occurs every weekday, and 200 or more hours will all be about the same." (https://dot.ca.gov/programs/traffic-operations/census/traffic-volumes). The same numbers are served by Caltrans' GIS layer https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/Traffic_AADT/FeatureServer/0 . Status VERIFIED (data).
- **Trucks**: Caltrans "Truck AADTs 2024" workbook, https://dot.ca.gov/-/media/dot-media/programs/traffic-operations/documents/census/2024/2024-truck-aadt-a11y.xlsx . Status VERIFIED (data). The truck percentages at many sites are estimates carried forward from an older classification count (the workbook's `EST_YEAR` column), so treat them as approximate.
- **Lanes**: FHWA Highway Performance Monitoring System, California 2024 submission, field `through_lanes`, queried at the location, https://geo.dot.gov/server/rest/services/Hosted/HPMS_FULL_CA_2024/FeatureServer/0 . Status VERIFIED (data). I read `through_lanes` as the total for both directions including carpool lanes (it is 10 on the Bay Bridge, which has five each way), but I did not open the HPMS field manual to confirm that definition. `managed_lanes` is the carpool or express lane count within that total.

| Segment (Caltrans count point) | AADT 2024 | Peak-hour volume, both directions | Through lanes, both directions (of which carpool or express) | Trucks | Row quoted |
|---|---|---|---|---|---|
| **I-405 at I-10** (West Los Angeles), south leg | **329,000** | 20,400 | 10 (2) | 2.8 per cent (9,212 a day) | "405 LA 29.538 LOS ANGELES, JCT. RTE. 10 ... BACK_PEAK_HOUR 20400 ... BACK_AADT 329000 ... AHEAD_PEAK_HOUR 18700 ... AHEAD_AADT 302000" |
| I-405 at I-10, north leg | 302,000 | 18,700 | 12 (2) | 3.5 per cent (10,449) | same row; truck row "405 LA 29.538 leg A ... 302000 ... 10449 ... 3.46" |
| I-405 at Santa Monica Blvd (SR-2), south leg | 326,000 | 20,200 | not queried | n/a | "405 LA 30.856 LOS ANGELES, JCT. RTE. 2 ... 20200 ... 326000" |
| I-405 Sepulveda Pass (Getty Center Dr to Mulholland) | 281,000 to 284,000 | 17,400 to 17,600 | not queried | n/a | "405 LA 34.764 LOS ANGELES, GETTY CENTER DRIVE ... 284000 ... 281000" |
| I-405 at US-101, south leg | 282,000 | 17,500 | not queried | 3.5 per cent | "405 LA 39.432 LOS ANGELES, JCT. RTE. 101 ... 282000 ... 223000" |
| **I-10 Santa Monica Fwy** at Vermont to Hoover | **345,000** (the busiest count in this set) | 20,900 | 8 (0) | 3.4 per cent at SR-110 (11,492) | "010 LA R13.803 LOS ANGELES, VERMONT AVENUE ... 344000 ... 345000"; "010 LA 14.25 LOS ANGELES, HOOVER STREET ... 345000 ... 340000" |
| I-10 at I-405, east leg | 243,000 | 14,700 | not queried | 3.4 per cent | "010 LA R5.454 LOS ANGELES, JCT. RTE. 405 ... 231000 ... 243000" |
| I-10 at La Brea | 272,000 to 286,000 | 16,500 to 17,300 | not queried | n/a | "010 LA R10.43 LOS ANGELES, LA BREA AVENUE ... 272000 ... 286000" |
| **US-101 Hollywood Fwy** at Glendale Blvd | 269,000 to 293,000 | 16,500 to 18,000 | 8 (0) | 3.3 per cent at SR-110 and at SR-2 | "101 LA 2.483 LOS ANGELES, GLENDALE BOULEVARD ... 269000 ... 293000" |
| US-101 at Silver Lake Blvd / Vermont | 241,000 to 262,000 | 14,800 to 16,100 | 8 (0) | n/a | "101 LA 3.76 LOS ANGELES, SILVER LAKE BOULEVARD ... 262000 ... 241000" |
| US-101 at Sunset / Hollywood Blvd | 199,000 to 221,000 | 12,200 to 13,500 | not queried | n/a | "101 LA 6.38 LOS ANGELES, SUNSET/HOLLYWOOD BOULEVARDS ... 221000 ... 199000" |
| US-101 Ventura Fwy at Havenhurst (Encino), busiest US-101 point in the county | 323,000 | 19,800 | not found by the query | n/a | "101 LA 18.607 LOS ANGELES, HAVENHURST AVENUE ... 323000 ... 311000" |
| **I-5 Golden State Fwy** at Stadium Way | 262,000 to 266,000 | 16,700 to 16,900 | 8 to 9 (0) | n/a | "005 LA 21.83 LOS ANGELES, STADIUM WAY ... 266000 ... 262000" |
| I-5 at I-10 (East LA interchange) | 215,000 to 220,000 | 13,700 to 14,000 | not queried | **6.3 to 6.8 per cent**, more than half of them five-axle | "005 LA 18.452 leg B ... 215000 ... 14577 ... 6.78 ... 5+ axle 55.7" |
| I-5 at I-710 (Commerce) | 214,000 to 230,000 | 13,600 to 14,600 | not queried | 6.4 to 7.9 per cent | "005 LA 13.784 leg B ... 214000 ... 16863 ... 7.88" |
| I-5 at Osborne St (Pacoima), busiest I-5 point in the county | 289,000 | 18,400 | not found by the query | n/a | "005 LA 37.409 LOS ANGELES, OSBORNE STREET ... 275000 ... 289000" |
| **SR-110 Harbor Fwy** at Century / Manchester | 317,000 | 19,000 | 12 to 14 (2 managed) | 4.5 to 5.7 per cent at I-105 | "110 LA 14.967 LOS ANGELES, CENTURY BOULEVARD ... 295000 ... 317000" |
| SR-110 downtown, I-10 to US-101 | 271,000 to 293,000 | 16,300 to 17,600 | 13 as coded (includes collector lanes) | 2.7 to 4.5 per cent | "110 LA 22.123 LOS ANGELES, OLYMPIC BOULEVARD ... 280000 ... 293000" |
| SR-110 Arroyo Seco Parkway north of US-101 | 162,000 to 185,000 | 9,700 to 11,100 | not queried | n/a | "110 LA 24.31 LOS ANGELES, HILL STREET/STADIUM WAY ... 171000 ... 185000" |
| **I-105 Century Fwy** at Crenshaw to Vermont | 283,000 | 17,300 | 9 (2) | 5.0 to 5.4 per cent at SR-110 | "105 LA R4.705 INGLEWOOD, CRENSHAW BOULEVARD ... 258000 ... 283000" |
| I-710 Long Beach Fwy at I-105 and at I-5 (port trucks) | 227,000 to 241,000 | n/a | not queried | **8.4 to 8.7 per cent**, about half five-axle | "710 LA R15.692 leg B LYNWOOD, JCT. RTE. 105 ... 227000 ... 19817 ... 8.73" |

Derived from the table: 329,000 vehicles a day on the ten lanes of I-405 south of I-10 is about 33,000 per lane per day, and the 20,400 two-way peak hour is only 6.2 per cent of the day (about 2,000 vehicles per lane per hour). Truck shares on the west-side and downtown freeways are 3 to 5 per cent; on I-5 and I-710 they are 6 to 9 per cent.

## C2. How peaked the day is (Caltrans K and D factors)

Definitions: "The K factor is the percentage of AADT during the peak hour for both directions of travel. The D factor is the percentage of the peak hour travel in the peak direction." Caltrans, "Peak Hour Volume Data", https://dot.ca.gov/-/media/dot-media/programs/traffic-operations/documents/census/peak-hour/f0017710-peak-hour-definitions-k-and-d-factors.pdf . VERIFIED.

Rows from the Caltrans "2024 PEAK HOURS REPORT" workbook, https://dot.ca.gov/-/media/dot-media/programs/traffic-operations/documents/census/2024/2024-ca-peak-hours-a11y.xlsx . VERIFIED (data). The report covers only Caltrans' permanent count stations, so few central Los Angeles sites appear. "Hour" is the hour ending.

| Station | AM peak: direction, one-way volume, K, D, hour | PM peak: direction, one-way volume, K, D, hour |
|---|---|---|
| I-405, Los Angeles County postmile 0.4 (Long Beach) | N, 8,443 veh/h, K 6.2, D 57.5, hour 6 | N, 8,544, K 6.57, D 55.0, hour 15 |
| I-405, postmile 42.9 (north San Fernando Valley) | S, 7,596, K 4.85, D 72.0, hour 5 | N, 7,851, K 6.58, D 54.8, hour 15 |
| I-10, postmile 47.11 (Pomona) | W, 7,817, K 6.9, D 53.3, hour 7 | E, 7,822, K 7.27, D 50.6, hour 17 |
| I-5, postmile 12 (Downey / Norwalk) | N, 6,880, K 6.01, D 52.0, hour 7 | N, 6,534, K 5.75, D 51.6, hour 13 |
| I-5, postmile 41 (Sylmar) | S, 5,993, K 6.4, D 65.3, hour 6 | N, 5,692, K 6.75, D 58.9, hour 15 |
| For contrast, I-405 Orange County postmile 4.75 | N, 9,624, K 7.91, D 51.6, hour 7 | N, 8,869, K 7.45, D 50.5, hour 14 |

Reading: on Los Angeles freeways the busiest hour carries only about 6 to 7 per cent of the day's traffic and the split between directions is close to even (51 to 58 per cent) except at the edges of the basin. Demand is flat and high from before dawn to evening; the road is full for many hours rather than peaking sharply. Directional flow of 7,500 to 8,500 vehicles an hour on four or five lanes is 1,700 to 2,000 per lane per hour (DERIVED).

A full 24-hour volume curve (per cent of daily traffic in each hour) for California freeways was NOT FOUND in an open source: Caltrans' PeMS, which holds it, needs a login. Use the speed and congestion profile in C3, anchored to the K factors above.

## C3. Speeds by hour of day, for all three metros (the time-of-day profile)

Source: TomTom Traffic Index 2025, city pages, https://www.tomtom.com/traffic-index/city/los-angeles-ca/ , https://www.tomtom.com/traffic-index/city/san-francisco-ca/ , https://www.tomtom.com/traffic-index/city/san-diego-ca/ . The pages embed, for each hour of each day of the week, the average speed, the free-flow speed and the "congestion level" for two areas: "the larger metropolitan area ("metro") and central city area ("city")". Status **VERIFIED (data)** for the embedded numbers; the Monday-to-Friday averages below are **DERIVED** (script `engine_scripts/tomtom.py`, output `engine_txt/tomtom_2025_weekhours.json`). Speeds are averages over all roads driven, freeways and streets together, converted from km/h. "Centre" is TomTom's "city" area.

| Hour | LA metro mph | LA metro congestion % | LA centre mph | SF metro mph | SF metro congestion % | SF centre mph | SD metro mph | SD metro congestion % | SD centre mph | LA metro weekend mph | SF metro weekend mph | SD metro weekend mph |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 00 | 41 | 7 | 39 | 30 | 12 | 18 | 43 | 7 | 41 | 39 | 26 | 42 |
| 01 | 42 | 5 | 39 | 30 | 9 | 18 | 45 | 6 | 43 | 40 | 27 | 43 |
| 02 | 44 | 4 | 40 | 31 | 8 | 19 | 47 | 6 | 46 | 41 | 27 | 44 |
| 03 | 47 | 3 | 44 | 36 | 5 | 23 | 50 | 4 | 49 | 43 | 31 | 46 |
| 04 | 50 | 3 | 47 | 39 | 4 | 25 | 50 | 4 | 45 | 46 | 36 | 47 |
| 05 | 44 | 14 | 40 | 36 | 12 | 24 | 47 | 9 | 42 | 46 | 37 | 46 |
| 06 | 34 | 37 | 28 | 30 | 23 | 19 | 42 | 20 | 41 | 45 | 35 | 47 |
| 07 | 25 | 61 | 21 | 24 | 39 | 15 | 33 | 42 | 35 | 42 | 33 | 44 |
| 08 | 23 | 68 | 20 | 20 | 52 | 12 | 32 | 44 | 32 | 39 | 30 | 41 |
| 09 | 27 | 54 | 22 | 22 | 44 | 12 | 36 | 29 | 36 | 36 | 28 | 39 |
| 10 | 28 | 46 | 24 | 23 | 38 | 13 | 36 | 26 | 36 | 33 | 25 | 37 |
| 11 | 28 | 45 | 25 | 23 | 38 | 13 | 35 | 28 | 35 | 30 | 23 | 35 |
| 12 | 27 | 49 | 24 | 22 | 39 | 12 | 34 | 31 | 34 | 28 | 22 | 34 |
| 13 | 26 | 54 | 23 | 22 | 39 | 12 | 34 | 31 | 35 | 27 | 21 | 35 |
| 14 | 24 | 65 | 20 | 21 | 44 | 11 | 32 | 41 | 32 | 27 | 21 | 35 |
| 15 | 21 | 80 | 18 | 20 | 52 | 10 | 28 | 59 | 26 | 27 | 21 | 36 |
| 16 | 20 | 87 | 16 | 19 | 59 | 10 | 27 | 62 | 25 | 28 | 21 | 36 |
| 17 | 19 | 90 | 16 | 18 | 66 | 9 | 28 | 58 | 27 | 28 | 21 | 36 |
| 18 | 23 | 70 | 19 | 19 | 51 | 11 | 32 | 38 | 32 | 29 | 21 | 36 |
| 19 | 28 | 44 | 25 | 22 | 35 | 12 | 35 | 26 | 35 | 31 | 23 | 37 |
| 20 | 32 | 29 | 30 | 24 | 28 | 14 | 36 | 22 | 35 | 33 | 24 | 38 |
| 21 | 35 | 22 | 33 | 25 | 25 | 15 | 38 | 18 | 36 | 35 | 25 | 39 |
| 22 | 37 | 17 | 34 | 26 | 21 | 16 | 40 | 13 | 38 | 37 | 27 | 41 |
| 23 | 39 | 12 | 37 | 27 | 17 | 16 | 42 | 10 | 39 | 39 | 27 | 42 |

Freeways and streets separately (TomTom 2025 annual averages, same pages; VERIFIED (data), converted to mph):

| Area | Freeways: free-flow / all-day / morning rush / evening rush mph | Streets: free-flow / all-day / morning rush / evening rush mph |
|---|---|---|
| Los Angeles metro | 68 / 45 / 36 / 30 | 25 / 17 / 16 / 14 |
| Los Angeles centre | 64 / 35 / 26 / 21 | 23 / 16 / 14 / 12 |
| San Francisco metro | 63 / 48 / 40 / 36 | 20 / 14 / 13 / 12 |
| San Francisco centre | 57 / 32 / 33 / 18 | 15 / 10 / 9 / 8 |
| San Diego metro | 70 / 58 / 50 / 42 | 29 / 21 / 20 / 18 |
| San Diego centre | 68 / 55 / 46 / 37 | 29 / 21 / 21 / 17 |

Quoted on the Los Angeles page itself (VERIFIED): "Average congestion level 59.8%"; "Average speed on highways 56.8km/h"; "Average speed during rush hour 27.6km/h"; morning rush "Time taken to travel 10 km 19 min 14 s ... 31.2 km/h Average speed"; evening rush "24 min 12 s ... 24.8 km/h"; "Time lost due to traffic in rush hour in 2025 83 hours"; worst day "October 16, Thursday ... 143% Congestion level at 5pm".

What the profile shows (DERIVED):
- **Los Angeles**: the morning slowdown starts in the 5 a.m. hour, is at its worst at 8 a.m. (23 mph, all roads), never really clears at midday (26 to 28 mph), and the evening peak is the worse of the two: it builds from 2 p.m., bottoms at 5 p.m. (19 mph metro, 16 mph centre) and has cleared by 8 p.m. Free flow returns only from about 10 p.m. to 5 a.m.
- **San Francisco**: the same two peaks an hour later in the morning (8 a.m.), and the city centre is slow all day (10 to 13 mph from 8 a.m. to 7 p.m.).
- **San Diego**: lighter everywhere; a short morning peak at 7 to 8 a.m. and an evening peak from 3 to 6 p.m. (27 mph); freeways average 58 mph all day.
- **Weekends**: no morning peak; a single broad midday-to-evening plateau.

## C4. Carpool lanes and ramp meters

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Carpool lane hours, Southern California | All day, every day, behind a painted buffer | "In Southern California, HOV lanes are generally separated from other lanes by a buffer zone. The HOV lanes are in effect 24 hours a day, 7 days a week, referred to as full-time operation." | Caltrans, "High-Occupancy Vehicle Systems". https://dot.ca.gov/programs/traffic-operations/hov | VERIFIED |
| Carpool lane hours, Northern California | Weekday peaks only | "In Northern California, HOV lanes are only operational on Monday through Friday during posted peak congestion hours. For example, between 6 a.m. to 10 a.m. and 3 p.m. to 7 p.m." | Same | VERIFIED |
| Who may use them | Two or more people, motorcycles, buses; three or more on some routes | "Motorcycles, mass transit, and vehicles with two or more (2+) occupants are allowed" and "I-80 and I-880 in the San Francisco Bay Area, the I-10 Il Monte Busway (during peak hour) in Los Angeles, I-5 San Ysidro in San Diego require three or more (3+)" | Same | VERIFIED |
| Electric cars alone | No longer allowed | "The exemption that allows for clean-air vehicles with the appropriate decals to operate in the HOV lane without meeting the occupancy requirement expired on September 30, 2025." | Same | VERIFIED |
| Where they are (this file's segments) | Managed (carpool or express) lanes are coded on I-405, I-105 and SR-110 south of downtown (2 at each point, which I read as one each way); none on the I-10 Santa Monica Fwy, US-101 Hollywood Fwy or I-5 at Stadium Way | HPMS `managed_lanes` values in C1 | FHWA HPMS 2024 | VERIFIED (data) |
| Ramp meters, number | Los Angeles and Ventura (District 7) 1,029 existing; Bay Area (District 4) 734; San Diego (District 11) 322; Orange (District 12) 331; "over 2,200" statewide | Map labels "1029 Existing 200 Planned" (District 7), "734 Existing 612 Planned" (District 4), "322 Existing 199 Planned" (District 11); "The Department has installed over 2,200 ramp meters throughout the State." | Caltrans, 2017 Ramp Metering Development Plan map, https://dot.ca.gov/-/media/dot-media/programs/traffic-operations/documents/ramp-metering/ramp-meter-statewide-map-a11y.pdf ; Caltrans Ramp Metering Design Manual, 2022, https://dot.ca.gov/-/media/dot-media/programs/traffic-operations/documents/ramp-metering/202210-rmdm-a11y.pdf | VERIFIED (chart for the map) |
| Ramp meter rate | One car per green; 240 to 900 vehicles an hour per lane (one car every 4 to 15 s) | "For a typical one vehicle per green operation, a ramp meter has practical lower and upper output limits of 240 and 900 vehicles per hour (VPH) per lane, respectively." | Ramp Metering Design Manual, section 1.2 | VERIFIED (interval is DERIVED) |
| Ramp layout | Often two metered lanes, or one plus a carpool bypass lane | "two general purpose (GP) lanes may be considered ... when entrance ramp peak hour volumes exceed 500 VPH"; figure titles "Typical 2-Lane Metered Connector (1 GP Lane + 1 HOV Preferential Lane)" | Same | VERIFIED |

## C5. Signals, speed limits, lane and street widths

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Signal cycle length | Typically 90 to 120 s; a few up to 180 s | "Most signalized intersections have a cycle length, typically 90 to 120 seconds, with a few as high as 180 seconds." | LADOT, "Los Angeles Signal Synchronization" fact sheet, 14 Feb 2016. https://ladot.lacity.gov/sites/default/files/documents/ladot-atsac-signals-_-fact-sheet-2-14-2016.pdf | VERIFIED |
| Peak timing plans | Weekdays 6 to 10 a.m. and 3 to 7 p.m. | "Most intersections have different signal timing during weekday peak hours (i.e. Monday-Friday, 6 a.m.-10 a.m. and 3 p.m.-7 p.m.)" | Same | VERIFIED |
| Size of the system | Over 4,900 signals, 26,000 detectors, 590 cameras | "over 4,900 signalized intersections that control over 7,500 miles of city streets. The system includes over 26,000 vehicle detectors and over 590 CCTV cameras." | LADOT, ATSAC fact sheet, 2018. https://ladot.lacity.gov/sites/default/files/documents/atsac-fact-sheet-2018-rev-1124.pdf | VERIFIED |
| How it adapts | Green time follows measured volume | "the system monitors traffic volumes in real time and changes the signal timing as traffic conditions change" | Same | VERIFIED |
| Transit priority | Up to a tenth of the cycle | "holding the train or bus signal green longer, generally for up to ten percent of the cycle, e.g. 12 seconds for a 120 second cycle" | Same | VERIFIED |
| Effect of synchronisation | Speed up 13 per cent, delay down 32 to 43 per cent | "Travel speed (mph): +13% (increase) Travel time (delay): -32% to -43% (decrease)" | Same (citing Texas A&M, 2013) | VERIFIED |
| Freeway speed limit | 65 mph; 70 where posted | "no person may drive a vehicle upon a highway at a speed greater than 65 miles per hour" and "No person shall drive a vehicle upon that highway at a speed greater than 70 miles per hour, as posted." | California Vehicle Code sections 22349 and 22356 (text read at https://california.public.law/codes/vehicle_code_section_22349 and ..._22356; the legislature's own site returned 403) | VERIFIED (third-party host) |
| Two-lane roads | 55 mph | "no person may drive a vehicle upon a two-lane, undivided highway at a speed greater than 55 miles per hour unless ... posted for a higher speed" | CVC 22349(b) | VERIFIED (third-party host) |
| Trucks and trailers | 55 mph | "No person may drive any of the following vehicles on a highway at a speed in excess of 55 miles per hour: A motortruck or truck tractor having three or more axles or any motortruck or truck tractor drawing any other vehicle." | CVC 22406. https://california.public.law/codes/vehicle_code_section_22406 | VERIFIED (third-party host) |
| City streets | 25 mph in business and residential districts unless posted; 15 mph in alleys | "Twenty-five miles per hour: On any highway in any business or residence district unless a different speed is determined by local authority" and "Fifteen miles per hour: ... On any alley." | CVC 22352. https://california.public.law/codes/vehicle_code_section_22352 | VERIFIED (third-party host) |
| Posted limits on Los Angeles arterials (commonly 35 to 45 mph) | Not looked up street by street | n/a | n/a | NOT FOUND |
| Freeway lane width | 12 ft | "The minimum lane width on two-lane and multilane highways, ramps, collector-distributor roads, and other appurtenant roadways shall be 12 feet" | Caltrans Highway Design Manual, Index 301.1 (chapter dated July 1, 2020). https://dot.ca.gov/-/media/dot-media/programs/design/documents/chp0300-a11y.pdf | VERIFIED |
| Urban main-street lanes on state routes | 11 ft minimum | "the minimum lane width shall be 11 feet. The preferred lane width is 12 feet." (speeds of 40 mph or less, low truck volume) | Same | VERIFIED |
| Los Angeles street cross-sections (right-of-way / kerb-to-kerb roadway) | Boulevard I 136 / 100 ft; Boulevard II 110 / 80; Avenue I 100 / 70; Avenue II 86 / 56; Avenue III 72 / 46; Collector 66 / 40; Local Standard 60 / 36; Local Limited 50 / 30; Hillside Local 44 / 36 | Table "Previous and Current Designations of Arterial Streets": "Boulevard I (136'/100')", "Boulevard II (110'/80')", "Avenue I (100'/70')", "Avenue II (86'/56')", "Avenue III (72'/46')"; "Collector Street (66'/40')"; "Local Standard (60'/36')" | City of Los Angeles, Bureau of Engineering, Complete Street Design Manual, E 211. https://completestreetdesignmanual.engineering.lacity.gov/e-200-general-design-street-improvement-projects/e-210-street-classifications/e-211-213-street | VERIFIED |
| Caveat on those widths | Many real streets differ | "many existing streets may not match the standard right-of-way, roadway, and/or border dimensions set in Standard Plan S-470-1" | Same | VERIFIED |

---

