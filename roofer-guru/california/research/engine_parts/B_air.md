# B. Airliners and airports

## B1. Airliner dimensions and approach speeds

Source for the whole table: FAA Aircraft Characteristics Database (spreadsheet `aircraft_data`, sheet ACD_Data; page "Last updated: Tuesday, January 7, 2025"). https://www.faa.gov/airports/engineering/aircraft_char_database and https://www.faa.gov/airports/engineering/aircraft_char_database/aircraft_data . Status **VERIFIED (data)**: each row below is the row read from the file. "Approach speed" is the FAA's "Approach Speed to the runway at Maximum Allowable Landing Weight", so everyday approaches are a few knots slower. Tail height is at operating empty weight.

| Type (ICAO code) | Length ft (m) | Wingspan ft (m) | Tail height ft (m) | Approach speed kt | Max take-off weight lb | Wake class | US tower operations FY2024 |
|---|---|---|---|---|---|---|---|
| Airbus A320 (A320) | 123.3 (37.6) | 111.9 without sharklets, 117.5 with (34.1 / 35.8) | 39.6 (12.1) | 136 | 171,961 | Large | 1,397,404 |
| Airbus A320neo (A20N) | 123.3 (37.6) | 117.5 (35.8) | 39.6 (12.1) | 137 | 174,165 | Large | 540,276 |
| Airbus A321 (A321) | 146.0 (44.5) | 111.9 / 117.5 (34.1 / 35.8) | 39.7 (12.1) | 142 | 200,621 | Large | 1,364,686 |
| Airbus A321neo (A21N) | 146.0 (44.5) | 117.5 (35.8) | 39.7 (12.1) | 136 | 209,439 | Large | 307,984 |
| Boeing 737-800 (B738) | 129.5 (39.5) | 112.6 without winglets, 117.4 with (34.3 / 35.8) | 41.4 (12.6) | 144 | 174,200 | Large | 2,484,764 |
| Boeing 737 MAX 8 (B38M) | 129.7 (39.5) | 117.8 (35.9) | 40.3 (12.3) | 145 | 181,200 | Large | 1,020,032 |
| Boeing 737-700 (B737) | 110.3 (33.6) | 112.6 / 117.4 | 41.6 (12.7) | 130 | 154,500 | Large | 1,720,060 |
| Embraer 175 (E75L) | 106.0 (32.3) | 101.7 (31.0) | 32.4 (9.9) | 126 | 85,517 | Large | 1,262,322 |
| Boeing 777-300ER (B77W) | 242.3 (73.9) | 212.6 (64.8) | 61.8 (18.8) | 149 | 775,000 | Heavy | 170,308 |
| Boeing 787-9 (B789) | 206.1 (62.8) | 197.3 (60.1) | 56.1 (17.1) | 144 | 560,000 | Heavy | 160,374 |
| Airbus A350-900 (A359) | 218.54 (66.6) | 212.43 (64.7) | 57.3 (17.5) | 140 | 617,295 | Heavy | 83,162 |
| Airbus A380-800 (A388) | 238.6 (72.7) | 261.7 (79.8) | 79.0 (24.1) | 138 | 1,267,658 | Super | 27,682 |

Metric values in brackets are DERIVED (feet times 0.3048).

Makers' own figures, which agree to within rounding (all VERIFIED):

| Type | Maker's figures | Quote | Source |
|---|---|---|---|
| A320neo | 37.57 m long, 35.80 m span, 11.76 m high, Mmo 0.82 | "Overall length 37.57 m 123 ft 3 in"; "Wing span (geometric) 35.80 m 117 ft 5 in"; "Height 11.76 m 38 ft 7 in"; "Mmo 0.82" | https://aircraft.airbus.com/en/aircraft/a320-family/a320neo |
| A321neo | 44.51 m long, 35.80 m span, 11.76 m high, Mmo 0.82 | "Overall length 44.51 m"; "Wing span (geometric) 35.80 m"; "Height 11.76 m" | https://aircraft.airbus.com/en/aircraft/a320-family/a321neo |
| A350-900 | 66.80 m long, 64.75 m span, 17.05 m high, cruise Mach 0.85 | "Cruise Mach 0.85"; "Overall length 66.80 m 219 ft 1.9 in"; "Wing span (geometric) 64.75 m 212 ft 5.2 in"; "Height 17.05 m 55 ft 11.2 in" | https://aircraft.airbus.com/en/aircraft/a350/a350-900 |
| 737 MAX 8 | 39.5 m long, 35.9 m span, 12.3 m high | "Length ... 39.5 m (129 ft 6 in)"; "Wingspan 35.9 m (117 ft 10 in)"; "Height 12.3 m (40 ft 4 in)" | https://www.boeing.com/commercial/737max |
| 777-300ER | 73.9 m long, 64.8 m span, 18.5 m high | "73.9 m (242 ft 4 in)"; "64.8 m (212 ft 7 in)"; "18.5 m (60 ft 8 in)" | https://www.boeing.com/commercial/777 |
| 787-9 | 62.8 m long, 60.1 m span, 17.0 m high | "62.8 m (206 ft, 1 in)"; "60.1 m (197 ft, 3 in)"; "17.0 m (55 ft 10 in)" | https://www.boeing.com/commercial/787 |
| A380 | Maker's page redirected to an empty stub | n/a | NOT FOUND on airbus.com; FAA row above stands |

## B2. Rules that set speeds, heights and spacing in the scene

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Speed below 10,000 ft | 250 knots indicated | "no person may operate an aircraft below 10,000 feet MSL at an indicated airspeed of more than 250 knots (288 m.p.h.)" | 14 CFR 91.117(a). https://www.law.cornell.edu/cfr/text/14/91.117 | VERIFIED |
| Speed under the Class B shelf | 200 knots | "at an indicated airspeed of more than 200 knots (230 mph)" (airspace underlying Class B) | 14 CFR 91.117(c) | VERIFIED |
| Minimum height over a city | 1,000 ft above the highest obstacle within 2,000 ft | "Over any congested area of a city, town, or settlement ... an altitude of 1,000 feet above the highest obstacle within a horizontal radius of 2,000 feet of the aircraft." | 14 CFR 91.119(b). https://www.law.cornell.edu/cfr/text/14/91.119 | VERIFIED (does not apply to take-off and landing) |
| Cruising levels | Eastbound odd (FL290, 310, 330, 350, 370, 390, 410); westbound even (FL300 to 400) | "any odd flight level, at 2,000-foot intervals beginning at and including flight level 290 (such as flight level 290, 310, 330, 350, 370, 390, 410)" and "any even flight level, at 2000-foot intervals beginning at and including flight level 300 (such as 300, 320, 340, 360, 380, 400)" | 14 CFR 91.179(b)(4). https://www.law.cornell.edu/cfr/text/14/91.179 | VERIFIED |
| Cruise speed | About Mach 0.78 to 0.85 | A350-900 "Cruise Mach 0.85"; A320neo "Mmo 0.82" (a limit, cruise is lower) | Airbus pages above | VERIFIED for those two. A cruise Mach for the Boeing types was NOT FOUND on the pages opened |
| Radar separation, terminal | 3 miles; 2.5 NM on final inside 10 NM | "Fusion target symbol – 3 miles." and "2.5 nautical miles (NM) separation is authorized between aircraft established on the final approach course within 10 NM of the landing runway" when "An average runway occupancy time of 50 seconds or less is documented" | FAA Order JO 7110.65, para 5-5-4. https://www.faa.gov/air_traffic/publications/atpubs/atc_html/chap5_section_5.html | VERIFIED |
| Wake spacing | Behind a heavy: heavy 4, large or small 5 miles. Behind a super: heavy 6, large 7, small 8. Small landing behind large 4, behind heavy 6 | "Behind heavy: Heavy - 4 miles. Large or small - 5 miles." and "Heavy - 6 miles. Large - 7 miles. Small - 8 miles." and "Small behind large - 4 miles. Small behind heavy - 6 miles." | Same | VERIFIED |
| Close parallels count as one runway for wake | Under 2,500 ft apart | "Consider parallel runways less than 2,500 feet apart as a single runway because of the possible effects of wake turbulence." | Same | VERIFIED |
| Glide path geometry | 3.00 degrees is 318 ft per NM; 3.50 degrees is 372 ft per NM; 2.85 degrees is 302 ft per NM | tan(angle) times 6,076 ft | Arithmetic | DERIVED |
| Time between landings | 3 NM at 140 kt is 77 s; 2.5 NM is 64 s; 5 NM is 129 s | distance over ground speed | Arithmetic | DERIVED |

## B3. Contrails

| Item | Finding | Quote | Source | Status |
|---|---|---|---|---|
| What they are | Ice-crystal line clouds behind jets at cruise height | "Contrails are line-shaped clouds or "condensation trails," composed of ice particles, that are visible behind jet aircraft engines, typically at cruise altitudes in the upper atmosphere." | EPA, "Aircraft Contrails Factsheet", EPA430-F-00-005, Sept 2000 (FAA-hosted copy). https://www.faa.gov/sites/faa.gov/files/regulations_policies/policy_guidance/envir_policy/contrails.pdf | VERIFIED |
| What they need | Cold air; humidity decides how long they last | "contrails evaporate quickly (if the humidity is low) or persist and grow (if the humidity is high)" | Same | VERIFIED |
| Where they start | About one wingspan behind the aircraft | "Typically, contrails become visible within roughly a wingspan distance behind the aircraft." | Same (figure caption) | VERIFIED |
| Persistent ones | Last hours; kilometres wide, 200 to 400 m deep | "Persistent contrails can last for hours while growing to several kilometers in width and 200 to 400 meters in height." | Same | VERIFIED |
| Example height | 35,100 ft | "cruising at an altitude of 35,100 ft (10.7 km)" (photo caption) | Same | VERIFIED |
| Temperature | Very cold upper air | "Since air temperatures at these high atmospheric levels are very cold (as cold as -70 °F), only a small amount of humidity is necessary for condensation to occur." and "Contrails will not form if the air at the airplane's altitude is too warm or too dry." | FAA, "Contrails" fact sheet. https://www.faa.gov/contrails/fact-sheet | VERIFIED |
| A hard threshold (often quoted as colder than about minus 40 C, above about 8 km or 26,000 ft) | Not in either official factsheet; the NASA Langley page that states it could not be reached (gateway 502) | n/a | Search summary only | SECONDARY (snippet) |

For the scene: draw trails only on aircraft in cruise (roughly FL300 to FL410), never on aircraft climbing out of or descending into the three airports; start the trail about a wingspan behind the engines; make length a weather variable (short on dry days, sky-crossing on humid days).

## B4. Los Angeles International (LAX)

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Field elevation | 127.8 ft | "Elevation: 127.8 ft. / 39.0 m (surveyed)" | AirNav KLAX, "FAA INFORMATION EFFECTIVE 29 OCTOBER 2026". https://www.airnav.com/airport/KLAX | VERIFIED |
| Runways | Four parallel east-west runways in two pairs. North: 6L/24R 8,926 x 150 ft and 6R/24L 10,885 x 150 ft. South: 7L/25R 12,923 x 150 ft and 7R/25L 11,095 x 200 ft. All heading 251 magnetic (263 true) westbound | "Runway 7L/25R Dimensions: 12923 x 150 ft."; "Runway 7R/25L ... 11095 x 200 ft."; "Runway 6R/24L ... 10885 x 150 ft."; "Runway 6L/24R ... 8926 x 150 ft."; "Runway heading: 071 magnetic, 083 true \| 251 magnetic, 263 true" | Same | VERIFIED |
| Usual flow | West flow: land from the east over Inglewood, take off west over the ocean | "Westerly operations is the normal traffic pattern used at LAX during the daytime hours (6:30 a.m. to midnight) throughout the year. Aircraft approach the airport from the east and depart the Airport to the west due to the prevailing westerly wind. ... arriving aircraft fly from the east to the west over the communities on the eastside of LAX, including the Cities of Los Angeles and Inglewood, and the communities of Athens and Lennox." | LAWA, "Preferential Runway Use Report", 26 Jun 2023. https://www.lawa.org/sites/lawa/files/2025-03/Preferential%20Runway%20Use%20Report%206-26-23.pdf | VERIFIED |
| How often | The four-runway west configuration about 96 per cent of visual-weather hours | "This is LAX's dominant configuration. The airport operates in variations of this configuration approximately 96% of the time in Visual weather conditions (totaling 76% annually)." | FAA, LAX Airport Capacity Profile, 2014. https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/profiles/LAX-Airport-Capacity-Profile-2014.pdf | VERIFIED |
| Which runways land and which depart | Arrivals mainly on the outer pair (24R and 25L); departures mainly on the inner pair (24L and 25R) | "The majority of LAX's arrivals occur on Runways 24R and 25L." and "The majority of LAX's departures occur on Runways 24L and 25R." | Same | VERIFIED |
| Adherence | 2019 to 2022: 91 to 95 per cent of arrivals on outboard runways; 93 to 99 per cent of departures on inboard | "the average percentage of arrivals occurring on the outboard runways of the North Airfield Complex was 91 percent and South Airfield Complex was 95 percent" | LAWA Preferential Runway Use Report | VERIFIED |
| Night | Midnight to 6:30 a.m. both arrivals and departures over the ocean | "From midnight to 6:30 a.m., all aircraft arriving at LAX must approach from over the ocean, unless FAA Air Traffic Control determines that weather or airport/air traffic operational conditions make it unsafe" | LAWA. https://www.lawa.org/lawa-environment/noise-management/lawa-noise-management-lax/efforts-to-reduce-or-limit-aircraft-noise-at-lax | VERIFIED |
| East flow | Rain and Santa Ana winds only | "Easterly operations are implemented when wind conditions (generally during rainstorms and Santa Ana winds) require reversing the traffic flow" | LAWA Preferential Runway Use Report | VERIFIED |
| Glide path | 3.00 degrees on all eight runway ends | "4-light PAPI on left (3.00 degrees glide path)"; chart "GS 3.00° TCH 55" (24R) and "GS 3.00°", "TCH 54" (25L) | AirNav; FAA charts "ILS or LOC RWY 24R" (Amdt 26C) and "ILS or LOC RWY 25L", cycle 29 Oct to 26 Nov 2026. https://aeronav.faa.gov/d-tpp/2611/00237IL24R.PDF , https://aeronav.faa.gov/d-tpp/2611/00237IL25L.PDF | VERIFIED (chart) |
| Final approach, runway 24R | Course 251. Step-down fixes by distance from the localizer DME: 10,000 ft at 37.3, 9,000 at 33.7, 8,000 at 30.1, 7,000 at 26.5, 6,000 at 22.6, 5,000 at 19.4, 4,000 at 16.2, glide slope intercept 2,200 ft at 8.3 (6.4 NM from the threshold). Touchdown zone 122 ft | Chart labels "SKOLL I-OSS 37.3 ... 10000", "MERCE I-OSS 16.2 ... 4000", "KOBEE I-OSS 8.3 ... 2200", "FAF to MAP 6.4 NM", "TDZE 122" | FAA chart ILS or LOC RWY 24R | VERIFIED (chart) |
| Heights over the city (west flow) | On a 3 degree path: about 2,200 ft at 6.4 NM, 1,450 ft at 4 NM, 1,130 ft at 3 NM, 810 ft at 2 NM, 500 ft at 1 NM (above sea level, 24R) | 318 ft per NM plus 122 ft touchdown elevation plus 55 ft crossing height | Arithmetic from the chart | DERIVED |
| Visual pattern heights | Downwind at or above 5,000 ft; base at or above 3,500; cross the 24 centreline at or above 2,500; turn final at or above 2,000 ft east of Hollywood Park | "Remain at 5000 feet or above until passing LAX 009-degree radial on downwind leg. Start turn to base leg at or above 3500 feet. Fly base leg over or just east of the Harbor Freeway. When assigned Runways 25, cross the extended centerline of Runways 24 at or above 2500 feet. Turn final approach at or above 2000 feet, east of the Hollywood Park Casino." | LAX Rules and Regulations, Section 13 Noise Abatement (Rev. 5/9/2025). https://www.lawa.org/sites/lawa/files/documents/Section%2013%20-%20Noise%20Abatement.pdf | VERIFIED |
| Departures | Straight out to the shoreline; 3,000 ft before a left turn, 4,000 ft before a right turn | "Maintain runway heading until past the shoreline and reach 4000 feet before making a right turn." and "reach 3000 feet before making a left turn" | Same | VERIFIED |
| Movements, 2025 | 580,996 (air carrier 546,465; air taxi 22,041; general aviation 12,234; military 256). That is 1,592 a day | "FAA Aircraft Movement ... Total 49,747 49,848 -0.20 % 580,996 581,779 -0.13 %" | LAWA Traffic Comparison (TCOM), Dec 2025, dated 22 Jan 2026. https://www.lawa.org/sites/lawa/files/2026-01/Tcom%201225.pdf | VERIFIED (per day is DERIVED) |
| Movements, Sept 2026 | 46,360 in the month (1,545 a day); 426,534 January to September | "Total 46,360 46,509 -0.32 % 426,534 435,604 -2.08 %" | LAWA TCOM Sept 2026. https://www.lawa.org/sites/lawa/files/2026-10/Tcom%200926.pdf | VERIFIED |
| Passengers, 2025 | 73,709,594 (domestic 50.1 million, international 23.6 million) | "Total 6,312,331 6,540,642 -3.49 % 73,709,594 76,585,861 -3.76 %" | LAWA TCOM Dec 2025 | VERIFIED |
| Hourly capacity | 167 to 176 movements an hour in good weather | "The capacity rate range in Visual conditions is currently 167-176 operations per hour." | FAA LAX Capacity Profile 2014 | VERIFIED |
| Arrival interval | In a busy hour roughly 40 landings on each of two arrival runways, one every 90 s per runway | half of 167 to 176, split over two arrival runways | Arithmetic | DERIVED |
| Airlines (share of scheduled domestic flights, June 2026) | SkyWest 21, Delta 20, American 17, United 16, Southwest 14, Alaska 6, JetBlue 4, Frontier 3 per cent | BTS carrier codes OO, DL, AA, UA, WN, AS, B6, F9 | My count from BTS On-Time Performance, June 2026 (see B7) | DERIVED. Foreign airlines and cargo are not in that file |
| Aircraft types at LAX | No published type mix for LAX was found. Nationally the commonest airliners by tower operations are the 737-800, 737-700, A320, A321, E175 and 737 MAX 8 (table B1) | n/a | FAA database column TMFS_Operations_FY24 | NOT FOUND for LAX; national figures VERIFIED (data) |

## B5. San Francisco International (SFO)

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Field elevation | 13.1 ft | "Elevation: 13.1 ft. / 4.0 m (surveyed)" | AirNav KSFO, FAA information effective 29 Oct 2026. https://www.airnav.com/airport/KSFO | VERIFIED |
| Runways | Two crossing pairs. 10L/28R 11,870 x 200 ft and 10R/28L 11,381 x 200 ft (heading 284 magnetic, 298 true). 1R/19L 8,650 x 200 ft and 1L/19R 7,650 x 200 ft (heading 014 magnetic, 028 true) | "Runway 10L/28R Dimensions: 11870 x 200 ft."; "Runway 10R/28L ... 11381 x 200 ft."; "Runway 1R/19L ... 8650 x 200 ft."; "Runway 1L/19R ... 7650 x 200 ft." | Same | VERIFIED |
| Spacing of the parallels | 750 ft between centrelines | "SFO's runways are only 750 feet apart, so aircraft must arrive single-file" in low visibility | SFO, "Runway Constraints, Flight Patterns, and Operations". https://www.flysfo.com/about/airport-operations/policies-regulations/runway-constraints | VERIFIED |
| Usual flow ("West Plan") | Land on 28L and 28R over the bay, depart on 1L and 1R, 95 to 98 per cent of the time | "95-98% of the time, winds blow from the west or north at SFO." and "primary departure runways are 1L/R facing north. primary arrival runways are 28L/R facing west." | Same | VERIFIED |
| Paired arrivals | Two aircraft side by side, slightly staggered | "Arrivals to Runways 28L and 28R are paired, meaning the planes fly a slight wingtip to wingtip stagger on final approach. Pairs are visually separated from one another." | FAA, SFO Airport Capacity Profile, 2019. https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/profiles/SFO-Airport-Capacity-Profile-2019.pdf | VERIFIED |
| Departures | 1L and 1R released together, between arrival pairs; heavy long-haul departures use 28L | "Departures are released from Runways 01L and 01R simultaneously." and "Runway 28L is used as a departure runway for long-haul, heavy jet departures only." | Same | VERIFIED |
| In cloud | Same-runway spacing 5 NM, stagger 2.5 NM between runways (or 1.5 NM under the closely-spaced procedure) | "Arrivals to the same runway are separated by 5 NM. Arrivals to parallel runways are staggered 2.5 NM." ; SFO: "Arriving aircraft are separated by 1.5 nautical miles." | FAA profile; SFO page | VERIFIED |
| Other flow | Southeast Plan under 5 per cent: land 19L/19R, depart 10L/10R | "primary departure runways are 10L/R facing east. primary arrival runways are 19L/R facing south." | SFO page | VERIFIED |
| Glide path | 28R 3.00 degrees; 28L 2.85 degrees | 28R chart "GS 3.00° TCH 55"; 28L chart "GS 2.85°", "TCH 53"; AirNav "4-light PAPI on left (2.85 degrees glide path)" for 28L | FAA charts ILS or LOC RWY 28R (Amdt 15B) and RWY 28L, cycle 2611. https://aeronav.faa.gov/d-tpp/2611/00375IL28R.PDF , https://aeronav.faa.gov/d-tpp/2611/00375IL28L.PDF | VERIFIED (chart) |
| Final approach, 28R | Course 284. 4,000 ft at 16.1 DME (DUMBA), 3,000 ft at 12 DME (CEPIN), glide slope intercept 1,800 ft at 7.4 DME (AXMUL), which is 5.4 NM from the threshold; touchdown zone 13 ft | Chart labels "CEPIN INT I-GWQ 12 ... 3000", "AXMUL INT I-GWQ 7.4 ... 1800", "FAF to MAP 5.4 NM", "TDZE 28R 13" | Same | VERIFIED (chart) |
| Visual approach up the bay | Quiet Bridge Visual 28R: 7,000 ft at ARCHI, 6,000 ft east of the salt ponds, 4,000 ft, 3,000 ft 3.8 NM south-east of the San Mateo Bridge, 1,800 ft at the San Mateo Bridge, 914 ft off Coyote Point, 399 ft 1 NM from the runway; courses 278 then 276 | "RAACL 0.1 NM SOUTHEAST OF SAN MATEO BRIDGE 1800"; "SAPPP 1 NM SOUTHEAST OF SFO RUNWAY 28R 399"; "NOTE: Closely spaced parallel approaches may be in progress to Runway 28L utilizing I-SFO." | FAA chart "QUIET BRIDGE VISUAL RWY 28R" (Orig, 9 Jul 2026). https://aeronav.faa.gov/d-tpp/2611/00375QUIETBRIDGE_VIS28R.PDF | VERIFIED (chart) |
| Movements, 2025 | 416,288 tower operations (air carrier 380,130; air taxi 26,705; civil 7,313; military 2,140). That is 1,141 a day | "Air Traffic Control Tower Operations Count 34,453 34,259 0.6% 416,288 386,507 7.7%" | SFO, Comparative Traffic Report, Dec 2025. https://www.flysfo.com/sites/default/files/2026-02/Dec%202025%20and%20CYTD%20SFO%20Air%20Traffic%20Summary.pdf | VERIFIED (per day is DERIVED) |
| Passengers, 2025 | 54,532,613 | "Total Airport Passengers 4,555,168 4,599,267 -1.0% 54,532,613 52,288,098 4.3%" | Same | VERIFIED |
| Hourly capacity | 104 to 107 movements an hour in good weather; 83 to 85 when staggered | "The capacity rate range in Visual conditions for 28/01 Side-Byes is currently 104-107 operations per hour." | FAA SFO profile | VERIFIED |
| Arrival rate | About 45 an hour in fair weather, 36 in low visibility | "In fair weather, currently, SFO can accommodate approximately 45 arrivals per hour." and "approximately 36 per hour" | SFO page | VERIFIED |
| Airlines (share of scheduled domestic flights, June 2026) | United 42, SkyWest 19, Delta 9, American 9, Alaska 7, Southwest 7, JetBlue 3, Frontier 3 per cent | BTS codes UA, OO, DL, AA, AS, WN, B6, F9 | My count from BTS (B7) | DERIVED |
| Aircraft types at SFO | NOT FOUND as a published table (the airport's dashboard is interactive only) | n/a | https://noise.flysfo.com/data-reports/data-operational/ | NOT FOUND |

## B6. San Diego International (SAN)

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Field elevation | 16.8 ft | "Elevation: 16.8 ft. / 5 m (estimated)" | AirNav KSAN, FAA information effective 29 Oct 2026. https://www.airnav.com/airport/KSAN | VERIFIED |
| Runway | One runway, 9/27, 9,401 x 200 ft, heading 275 magnetic (286 true) on 27 | "Runway 9/27 Dimensions: 9401 x 200 ft. / 2865 x 61 m"; "Runway heading: 095 magnetic, 106 true \| 275 magnetic, 286 true" | Same | VERIFIED |
| Usual flow | Land and take off on 27 (from the east, towards the ocean) | Table 7, April to June 2025: runway 27 total 582 of 585 average daily airline movements; runway 9 arrivals 2, departures 1 | San Diego County Regional Airport Authority, Quarterly Noise Report 2Q 2025, Table 7. https://www.san.org/wp-content/uploads/2025/10/2Q_QNR_2025-Signed.pdf | VERIFIED (99.5 per cent is DERIVED) |
| Steep approach to 27 | 3.50 degrees, against the usual 3.00 | "4-light PAPI on right (3.50 degrees glide path)" for runway 27; chart "3.50° TCH 65" | AirNav; FAA chart "RNAV (GPS) Y RWY 27" (Amdt 4A). https://aeronav.faa.gov/d-tpp/2611/00373RY27.PDF | VERIFIED (chart) |
| Displaced threshold | Landing threshold of 27 is 1,810 ft in from the runway end; landing distance 7,591 ft | "Displaced threshold: 1000 ft. \| 1810 ft."; "LDA:7591"; chart "Rwy Ldg 7591" | AirNav; chart | VERIFIED |
| No ILS on 27 | Localizer and GPS approaches only; ILS is on runway 9 | "Instrument approach: ILS/DME \| LOC/DME" | AirNav | VERIFIED |
| Why | High ground and buildings east and north of the field | "TERRAIN & BLDGS TO 500' MSL N & E WITHIN 1 1/2 MI."; chart obstacle "501" beside the final approach course; "Straight-in Rwy 27 at night, operational VGSI required, remain on or above VGSI glidepath until threshold." | AirNav remarks; chart notes | VERIFIED |
| Final approach, 27 | Course 275. 4,000 ft at 12.9 NM from the threshold (VYDDA), 3,600 ft at 10.9 NM (OKAIN), 2,700 ft at 7.4 NM (CIJHI), final fix 2,000 ft at 5.2 NM (REEBO), then 3.50 degrees to cross the displaced threshold at 65 ft; touchdown zone 17 ft | Chart profile "VYDDA 4000", "OKAIN 3600", "CIJHI 2700", "REEBO ... 2000", distances "5.2 NM", "2.2 NM", "3.5 NM", "2 NM" | FAA chart RNAV (GPS) Y RWY 27 | VERIFIED (chart) |
| Heights on short final | On 3.50 degrees: about 825 ft at 2 NM, 450 ft at 1 NM, 270 ft at half a mile from the displaced threshold | 372 ft per NM plus 17 ft plus 65 ft | Arithmetic | DERIVED |
| Neighbourhood under the final approach (Bankers Hill) | See E7 | | | |
| Curfew | No departures 11:30 p.m. to 6:30 a.m.; arrivals allowed | "DEP CURFEW IN EFCT. DEPS PROHIBITED 2330-0630." ; "prohibits departures between 11:30 p.m. and 6:30 a.m." | AirNav remarks; https://www.san.org/aircraft-noise/ | VERIFIED |
| Movements | April to June 2025: 59,770 (air carrier 54,164; air taxi 3,593; general aviation 1,877; military 136). That is 657 a day | "Total number of Airport Operations during the Calendar Quarter: 59,770" | SAN Quarterly Noise Report 2Q 2025 | VERIFIED (per day is DERIVED) |
| Day, evening, night split | Runway 27 arrivals 198 by day (7:00 to 18:59), 57 in the evening (19:00 to 21:59), 37 at night (22:00 to 6:59); departures 206, 44 and 40 | Table 7 "Total 198 57 37 206 44 40 2 0 0 1 0 0 585" | Same | VERIFIED |
| Hourly capacity | 48 to 57 movements an hour | "The capacity rate range in Visual conditions is currently 48-57 operations per hour." | FAA, SAN Airport Capacity Profile, 2014. https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/profiles/SAN-Airport-Capacity-Profile-2014.pdf | VERIFIED |
| Aircraft types, average a day (April to June 2025) | 737-700 135; Embraer 175 93; A321 73; 737-800 70; 737 MAX 8 48; 737-900 38; A321neo 34; 737 MAX 9 34; A320neo 11; 767-300 8; 757-200 6; A220-300 6; CRJ900 5; wide-bodies (A330, A350, 777, 787) about 2 each | Table 7 rows "B737 ... 135", "E75L ... 93", "A321 ... 73", "B738 ... 70", "B38M ... 48", "B739 ... 38", "A21N ... 34", "B39M ... 34" | SAN Quarterly Noise Report 2Q 2025, Table 7 | VERIFIED |
| Airlines (share of scheduled domestic flights, June 2026) | Southwest 40, SkyWest 15, Alaska 14, United 10, American 10, Delta 9 per cent | BTS codes WN, OO, AS, UA, AA, DL | My count from BTS (B7) | DERIVED |

## B7. Flights by hour of day (weekday, scheduled domestic flights of US reporting airlines, June 2026)

Status **DERIVED** from a published dataset: US Bureau of Transportation Statistics, "Reporting Carrier On-Time Performance", June 2026 file (607,577 flights, 30 days, 22 weekdays), https://transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_2026_6.zip . I counted scheduled departures by `CRSDepTime` hour and scheduled arrivals by `CRSArrTime` hour, Monday to Friday, and divided by 22. Script: `engine_scripts/bts_hourly.py`; output: `engine_txt/bts_ontime_2026_06_hourly.json`. The file leaves out foreign airlines, cargo and private aircraft, so totals are below the tower counts (LAX 1,123 a day here against about 1,550 tower movements); use the shape, and scale to the tower totals in B4 to B6.

| Hour (local) | LAX dep | LAX arr | SFO dep | SFO arr | SAN dep | SAN arr | LAX % of day | SFO % of day | SAN % of day |
|---|---|---|---|---|---|---|---|---|---|
| 00 | 4.5 | 13.1 | 4.9 | 12.8 | 0.0 | 1.3 | 1.6 | 2.0 | 0.2 |
| 01 | 1.0 | 0.2 | 0.0 | 2.4 | 0.0 | 0.0 | 0.1 | 0.3 | 0.0 |
| 02 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| 03 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| 04 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| 05 | 11.7 | 5.9 | 12.4 | 1.0 | 0.0 | 2.0 | 1.6 | 1.5 | 0.3 |
| 06 | 27.7 | 8.9 | 20.6 | 5.0 | 29.2 | 1.3 | 3.3 | 2.8 | 5.0 |
| 07 | 35.5 | 27.7 | 19.8 | 26.5 | 18.7 | 18.4 | 5.6 | 5.1 | 6.1 |
| 08 | 47.3 | 45.7 | 40.1 | 21.2 | 23.3 | 16.7 | 8.3 | 6.8 | 6.6 |
| 09 | 50.7 | 42.1 | 17.1 | 39.1 | 19.9 | 22.0 | 8.3 | 6.2 | 6.9 |
| 10 | 44.0 | 27.8 | 45.4 | 21.9 | 21.2 | 17.9 | 6.4 | 7.4 | 6.4 |
| 11 | 25.4 | 29.7 | 13.5 | 28.8 | 18.0 | 18.4 | 4.9 | 4.7 | 6.0 |
| 12 | 32.1 | 25.9 | 34.7 | 24.7 | 17.4 | 18.2 | 5.2 | 6.6 | 5.8 |
| 13 | 25.4 | 27.4 | 24.8 | 18.4 | 19.0 | 14.0 | 4.7 | 4.8 | 5.4 |
| 14 | 27.0 | 24.7 | 19.2 | 13.9 | 15.9 | 15.8 | 4.6 | 3.7 | 5.2 |
| 15 | 21.3 | 27.5 | 18.0 | 37.3 | 15.3 | 17.9 | 4.3 | 6.1 | 5.4 |
| 16 | 27.7 | 19.9 | 35.5 | 12.6 | 15.0 | 14.0 | 4.2 | 5.3 | 4.8 |
| 17 | 28.9 | 39.0 | 13.3 | 28.8 | 15.7 | 13.5 | 6.1 | 4.7 | 4.8 |
| 18 | 35.1 | 23.8 | 28.2 | 17.1 | 14.3 | 20.0 | 5.2 | 5.0 | 5.6 |
| 19 | 23.2 | 36.7 | 15.5 | 31.1 | 15.5 | 22.0 | 5.3 | 5.2 | 6.2 |
| 20 | 20.0 | 38.4 | 16.6 | 32.8 | 13.8 | 24.0 | 5.2 | 5.5 | 6.2 |
| 21 | 25.8 | 46.9 | 26.6 | 38.8 | 18.0 | 17.0 | 6.5 | 7.2 | 5.7 |
| 22 | 28.6 | 24.2 | 24.0 | 23.6 | 14.4 | 15.3 | 4.7 | 5.3 | 4.9 |
| 23 | 18.4 | 26.4 | 20.8 | 14.8 | 0.0 | 15.2 | 4.0 | 3.9 | 2.5 |
| Weekday total | 561 | 562 | 451 | 453 | 305 | 305 | 100 | 100 | 100 |

What the table shows: all three are quiet from 1 to 5 a.m.; LAX peaks at 8 to 10 a.m. with a second arrival peak at 9 p.m.; SFO runs in alternating departure and arrival banks (United's hub waves) with peaks at 10 a.m. and 9 p.m.; San Diego opens with a rush of about 29 departures in the 6 a.m. hour (the curfew ends at 6:30) and has no departures after 11:30 p.m.

## B8. The other airline airports, one line each

All runway data: AirNav pages (FAA information effective 29 Oct 2026), https://www.airnav.com/airport/KBUR and the same pattern for KLGB, KSNA, KONT, KOAK, KSJC, KSMF. Status VERIFIED. Flights a day and airline shares are DERIVED from the BTS June 2026 file (scheduled domestic departures a day, all days).

| Airport | Elevation | Runways | Scheduled domestic departures a day | Main airlines |
|---|---|---|---|---|
| Hollywood Burbank (BUR) | 778 ft | 15/33 6,886 x 150 ft; 8/26 5,802 x 150 ft (crossing) | 84 | Southwest 58 per cent, Alaska 11, SkyWest 11, United 10 |
| Long Beach (LGB) | 60 ft | 12/30 10,000 x 200 ft; 8L/26R 6,192 x 150 ft; 8R/26L 3,918 x 100 ft | 39 | Southwest 87 per cent |
| John Wayne, Orange County (SNA) | 56 ft | 2L/20R 5,700 x 150 ft (the only airline runway); 2R/20L 2,886 x 75 ft | 127 | Southwest 32 per cent, American 15, United 14, SkyWest 13 |
| Ontario (ONT) | 944 ft | 8L/26R 12,197 x 150 ft; 8R/26L 10,200 x 150 ft (parallel) | 77 | Southwest 44 per cent, American 13, Frontier 10 |
| Oakland (OAK) | 9 ft | 12/30 10,520 x 150 ft (airline runway); 10R/28L 6,213 ft; 10L/28R 5,457 ft; 15/33 3,376 ft | 87 | Southwest 86 per cent |
| San Jose (SJC) | 62 ft | 12L/30R and 12R/30L, both 11,000 x 150 ft (parallel) | 127 | Southwest 60 per cent, SkyWest 13, Alaska 9, Delta 9 |
| Sacramento (SMF) | 27 ft | 17L/35R 8,605 x 150 ft; 17R/35L 8,598 x 150 ft (parallel) | 163 | Southwest 57 per cent, SkyWest 14, United 8 |

---

