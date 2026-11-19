---

# B. WHAT CALIFORNIA ROOFS ARE MADE OF

## B1. Shares by material: the one statewide count found

**Source.** U.S. Energy Information Administration, 2020 Residential Energy Consumption Survey (RECS), public microdata file version 7. https://www.eia.gov/consumption/residential/data/2020/csv/recs2020_public_v7.csv with the codebook https://www.eia.gov/consumption/residential/data/2020/xls/RECS%202020%20Codebook%20for%20Public%20File%20-%20v7.xlsx . Variable ROOFTYPE, "Major roofing material; 'Not applicable' applies to apartment buildings with 5 or more units". California sample: 1,152 households standing for 13,180,886. I weighted by NWEIGHT. Script `recs_roof.py`, output `frag/recs_roof_output.txt`. **Status of every number in B1: DERIVED.**

**Limits.** The occupant reports the material, so clay and concrete tile are easily confused, and there is no category for built-up, modified bitumen or single-ply roofs: a flat roof will be reported as "composition" or "other". Sample sizes are in the tables; small cells are unreliable. The survey is from 2020.

| Material | California single-family (detached and attached), n=837 | California all units asked (no apartments in 5+ unit buildings), n=945 | United States single-family, n=14,070 |
|---|---|---|---|
| Shingles (composition or asphalt) | 61.9% | 61.8% | 79.3% |
| Ceramic or clay tiles | 18.1% | 16.2% | 5.0% |
| Concrete tiles | 9.3% | 8.8% | 2.0% |
| **Tile total** | **27.4%** | **25.0%** | **7.0%** |
| Wood shingles or shakes | 5.4% | 6.5% | 4.3% |
| Metal | 2.2% | 3.5% | 7.3% |
| Other | 2.0% | 2.1% | 1.1% |
| Slate or synthetic slate | 0.9% | 1.1% | 1.1% |
| Weighted homes | 8.55 million | 10.10 million | 84.5 million |

**By era built (California single-family).** This is the table that shows the tile era.

| Built | n | Shingles | Clay tile | Concrete tile | Tile total | Wood | Metal | Other |
|---|---|---|---|---|---|---|---|---|
| Before 1960 | 235 | 74.9% | 6.0% | 0.8% | 6.8% | 8.5% | 4.6% | 3.8% |
| 1960 to 1979 | 239 | 75.4% | 11.5% | 5.9% | 17.4% | 3.1% | 1.5% | 1.8% |
| 1980 to 1999 | 218 | 48.7% | 25.9% | 17.1% | 43.0% | 5.6% | 1.0% | 0.9% |
| 2000 to 2020 | 145 | 32.9% | 42.1% | 20.1% | 62.2% | 3.0% | 0.6% | 0.6% |

**By climate (California single-family).** RECS gives the Building America climate zone, not the Energy Commission's 16 zones. "Hot-Dry" covers most of Southern California and the Central Valley; "Marine" covers the coast from about Santa Barbara County north, including the Bay Area. That mapping is my description, not the survey's.

| Climate | n | Weighted homes | Shingles | Clay tile | Concrete tile | Wood | Metal | Other |
|---|---|---|---|---|---|---|---|---|
| Hot-Dry | 601 | 6.31 million | 60.3% | 20.3% | 10.6% | 5.6% | 1.4% | 1.0% |
| Marine | 215 | 2.04 million | 65.8% | 12.1% | 6.2% | 5.7% | 3.6% | 5.5% |
| Mixed-Dry | 14 | 0.14 million | too few to report | | | | | |
| Cold (mountains) | 7 | 0.07 million | too few to report | | | | | |

**Housing mix (all California households):** single-family detached 57.5%; apartments in buildings of 5 or more 23.4%; apartments in buildings of 2 to 4 units 8.3%; single-family attached 7.4%; mobile homes 3.5%.

**What I could not get:** counts by roofing material for Los Angeles, the Bay Area, San Diego, Sacramento, the Inland Empire or the Central Valley separately. The American Housing Survey does not appear to publish roofing material; I found no table (NOT FOUND). RECS does not identify metro areas in the public file.

## B2. Local evidence that fills the gaps

| Fact | Value | Short quote | Source | Status |
|---|---|---|---|---|
| Roofs inside the January 2025 Los Angeles fire perimeters | Asphalt shingles on more than 57 percent of structures in the Palisades perimeter and 74 percent in the Eaton perimeter (Altadena); tile next. About 90 percent had Class A coverings by CAL FIRE's inspection data | "more than 57% of structures in the Palisades Fire perimeter and 74% in the Eaton Fire perimeter had asphalt shingle roofs, with tile as the next most frequent category. After re-categorizing the data into broader bins, approximately 80% of the structures evaluated in detail by IBHS had Class A roof coverings, compared to 90% in the DINS dataset." | Insurance Institute for Business & Home Safety, "The 2025 LA Conflagrations". https://ibhs1.wpenginepowered.com/wp-content/uploads/FINAL-compressed-The-2025-LA-Conflagrations-IBHS.pdf (linked from https://ibhs.org/2025laconflagrations/ ) | VERIFIED |
| San Francisco is a low-slope membrane city | Of 13,914 re-roof permits filed 2023 to 2026, 2,502 name a material. Of those: modified bitumen, torch-down or cap sheet 74.9 percent; composition shingles 15.8 percent; single-ply 4.8 percent; built-up 1.7 percent; tile or slate 1.3 percent | Typical description: "reroofing- install class a modified bitumen roofing system 3800 sq ft. (hot work torch down)." | City and County of San Francisco open data, Building Permits (dataset i98e-djp9). https://data.sf.gov/resource/i98e-djp9.json . Script `sf_reroof.py`, output `frag/sf_reroof_output.txt` | DERIVED (keyword match on free text; 82 percent of permits name no material) |
| San Francisco re-roofs are mostly on two-unit buildings and houses | Existing use: 2-family dwelling 6,946; 1-family dwelling 4,045; apartments 2,323 (of 13,914) | n/a | Same | DERIVED |
| City of Los Angeles re-roofs are almost all lightweight coverings | 53,066 of 53,434 re-roof permits (2023 to mid-November 2026) use the standard "weighing less than 6 pounds per sq. ft." description; 406 mention tile | "Re-roof with Class A or B roof covering material weighing less than 6 pounds per sq. ft. over existing solid sheathing" | City of Los Angeles open data, building permits (dataset pi9x-tg5x). https://data.lacity.org/resource/pi9x-tg5x.json . Script `la_reroof.py`, output `frag/la_reroof_output.txt` | DERIVED. The lightweight form covers shingles and membranes alike, so it does not split steep from flat |
| Typical Los Angeles house roof size | Median 22 squares (2,200 square feet of roof) for one- and two-family re-roofs, the same in each of 2023, 2024, 2025 and 2026 (about 8,300 to 10,400 permits a year state a size). Apartments: median 34 squares. Commercial: 50 squares | n/a | Same | DERIVED |
| Typical San Francisco roof size | Median 13 to 15 squares for one- and two-family buildings where the permit states an area (39 to 128 permits a year) | n/a | San Francisco data (above) | DERIVED (small sample) |
| New sheathing | 10,408 of 53,434 Los Angeles re-roof permits (19.5 percent) say "over new solid sheathing"; 42,386 say "over existing solid sheathing" | "over new solid sheathing 13 Squares" | Los Angeles data (above) | DERIVED |
| Wood shake stock | 5.4 percent of California single-family homes report wood shingles or shakes (about 466,000 homes), highest in pre-1960 homes (8.5 percent). New wood roofs are banned in Los Angeles and San Diego and restricted statewide (A10c) | n/a | RECS tabulation (B1); A10c | DERIVED |

## B3. Tile outlives its underlayment: the "lift and relay" market

| Fact | Value | Short quote | Source | Status |
|---|---|---|---|---|
| The building code allows tile to be taken up and relaid | Yes, except damaged tile | "Existing slate, clay or cement tile shall be permitted for reinstallation, except that damaged, cracked or broken slate or tile shall not be reinstalled." | 2022 California Residential Code R908.5 (A8) | VERIFIED (transcription host) |
| What a lift and relay is | Lift the tile, strip the underlayment, inspect the deck, new underlayment, relay the tile | "A lift and relay is when a properly trained and licensed roofer lifts the tile and removes the underlayment. A thorough inspection of the wood deck is completed and then a new high-quality underlayment is relayed onto the wood decking. Once the underlayment is replaced, the tile is properly reinstalled." | RoofersCoffeeShop, "The best way to repair a tile roof system is to do a lift and relay". https://www.rooferscoffeeshop.com/post/best-way-repair-tile-roof-system-lift-relay (opened 19 Nov 2026) | VERIFIED (trade site) |
| Underlayment life under tile | About 25 years for standard underlayment (reserve-study consultant); older systems "failing at 20 to 30 years" (trade site) | "Standard underlayment has a general useful life of about 25 years" and "In the past, substandard underlayment was used and in some cases, installation procedures were not clearly defined so the systems are failing at 20 to 30 years." | Carl A. Brown, "Lifetime Tile Roofs: Fact or Fiction", May 2012 (URL in A12); RoofersCoffeeShop (above) | VERIFIED for what these two sources say. Neither is a test or a field study. A Tile Roofing Industry Alliance figure: NOT FOUND |
| Tile breakage in a relay | About 30 percent, by one consultant's planning figure | "to replace the 30% that are likely to get broken in the process." | Brown 2012 | VERIFIED (one consultant's figure) |
| When to expect the work | Tile roofs over 25 years old should be assessed; "at minimum" a re-set with new underlayment and flashings | "If your association has tile roofs that are over 25 years old, they should be carefully evaluated ... Your roofs will at minimum need a tile re-set with all new underlayment and flashings, reusing the old tile." | Brown 2012 | VERIFIED |
| Size of the opportunity | 43 percent of California single-family homes built 1980 to 1999 have tile (about 939,000 homes: 2.18 million weighted homes times 43.0 percent). At 25 years and more, that whole cohort is at or past the stated underlayment life in 2026 | n/a | RECS tabulation (B1) with the 25-year figure above | DERIVED and JUDGMENT (the age claim rests on a consultant's figure, not a study) |
| Cool roof rule and tile | Roofs weighing at least 25 pounds per square foot are exempt from the reflectance rule (A9d). Los Angeles permits state for a tile relay: "Cool roof compliance is not required" | "Remove existing roof tiles, apply new underlayment and reset roof tiles (Cool roof compliance is not required)" | Los Angeles permit descriptions (dataset above) | VERIFIED (a city's permit wording) |
| Tile underlayment in fire zones | A 72 pound cap sheet or a Class A rated underlayment under tile on a wood deck, with bird stops (A10b). A relay of 50 percent or more of the roof in 12 months triggers it (A10a) | n/a | A10 | VERIFIED (transcription host) |

## B4. Service lives in California's climates

| Fact | Value | Source | Status |
|---|---|---|---|
| Asphalt shingle life inland and in the desert (heat and ultraviolet) | No California field study found. A trade article for Phoenix (not California) reports 15 to 18 years as the contractor-reported replacement cycle against 25 to 30 years claimed by makers | Search summary only | SECONDARY (snippet), and not California. Treat as a lead |
| Asphalt shingle life on the coast (marine air) | NOT FOUND | n/a | NOT FOUND |
| Tile itself | "can last over 100 years" (trade site claim); a consultant warns that "lifetime" depends on underlayment and flashings | RoofersCoffeeShop; Brown 2012 (above) | VERIFIED as claims, not measurements |
| Low-slope membranes, by type | See the earlier file `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/research/damage_evidence.md`, Item 5 ("Low slope membrane roofs: service lives, failure modes ..."). It was written for a hot humid climate; no California-specific membrane life study was found | Earlier evidence file (not re-opened here) | SECONDARY (cross-reference) |
| Metal near salt water | See the same file, Item 6 ("Metal roofing near the coast": warranty exclusions by distance from salt water). No California-specific source was added | Earlier evidence file | SECONDARY (cross-reference) |
| Snow country (Sierra) | Design is governed by local ground snow loads (C5); no service-life figure found | n/a | NOT FOUND |
| Field-applied coatings | The Energy Code assumes a field-applied coating keeps 65 percent of its initial reflectance gain over 0.20 after three years, against 70 percent for other products (A9b). A coating life in years: NOT FOUND | 2025 Energy Code Table 110.8-B | VERIFIED for the soiling factor; life NOT FOUND |
| Makers' data sheets, NRCA and WSRCA life tables | Not obtained (the WSRCA magazine site was down; no maker sheet with a California life claim was opened) | n/a | NOT FOUND |
