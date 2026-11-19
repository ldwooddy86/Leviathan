---

# D. THE MARKET

## D1. How many roofers, and how much revenue

| Fact | Value | Short quote or field | Source | Status |
|---|---|---|---|---|
| C-39 licences | **5,602** currently renewed licences carry the C-39 class (all with status "CLEAR"), 19 November 2026 | Page: the list holds "Currently renewed licenses". Sheet dimension A1:N5603 | Contractors State License Board, Public Data Portal, "List by Classification", C-39. https://www.cslb.ca.gov/OnlineServices/DataPortal/ListByClassification (file `market/cslb_c39_list.xlsx`, downloaded 19 Nov 2026) | VERIFIED (count of rows) |
| By county of business address | Los Angeles 1,183; Orange 457; San Diego 419; Riverside 355; San Bernardino 311; Sacramento 287; Santa Clara 222; Alameda 205; Contra Costa 171; Ventura 168; Fresno 129; Placer 105; San Mateo 96; San Joaquin 90; Sonoma 89; Kern 87; Stanislaus 82; Santa Barbara 82; San Francisco 76; El Dorado 74; out-of-state address 154 | n/a | Same file; script `xlsx_rows.py` | DERIVED |
| By region | Los Angeles County 1,183; Bay Area (9 counties) 962; Inland Empire 666; San Joaquin Valley (8 counties) 500; Sacramento metro (Sacramento, Placer, El Dorado, Yolo) 494; Orange 457; San Diego 419; rest of California 767 | n/a | Same | DERIVED |
| Business form | Corporation 3,501; sole owner 1,678; limited liability company 361; partnership 61 | n/a | Same | DERIVED |
| Specialists against multi-trade firms | 3,764 hold C-39 only; 1,838 hold C-39 with other classes | n/a | Same | DERIVED |
| A young licence base | 40.4 percent of current C-39 licences were first issued in 2020 or later (2,261); 21.3 percent in 2010 to 2019; 9.4 percent before 1990 | n/a | Same (issue date field) | DERIVED |
| Revenue, 2022 | **$6.21 billion** for California roofing contractors (NAICS 238160): 2,762 firms, 2,781 establishments, 25,383 employees, payroll $1.59 billion | Fields RCPTOT 6,206,850; FIRM 2,762; ESTAB 2,781; EMP 25,383; PAYANN 1,588,092 (dollar fields in thousands) | U.S. Census Bureau, 2022 Economic Census, table EC2223BASIC (bulk file). https://www2.census.gov/programs-surveys/economic-census/data/2022/sector23/EC2223BASIC.zip | VERIFIED |
| California's share of the country | 8.9 percent of the $69.9 billion United States total. Texas $6.97 billion and Florida $6.92 billion are both larger | United States RCPTOT 69,906,202; Texas 6,969,560; Florida 6,919,274 | Same | VERIFIED; share DERIVED |
| Cost structure, 2022 | Materials $2.12 billion (34 percent of revenue); work subcontracted out $0.35 billion (5.6 percent); payroll 25.6 percent | CSTMPRT 2,115,814; CSTSCNT 346,456 | Same | VERIFIED; percentages DERIVED |
| Per firm and per worker | About $2.2 million revenue per establishment; about $245,000 per employee | n/a | Same | DERIVED |
| Establishments by size, 2023 | 2,926 establishments, 23,903 employees, payroll $1.72 billion. Fewer than 5 employees: 1,858 (63.5 percent); 5 to 9: 522; 10 to 19: 288; 20 to 49: 189; 50 to 99: 41; 100 to 249: 24 | Row "06","238160","-": emp 23903, ap 1721609, est 2926, n<5 1858, n5_9 522, n10_19 288, n20_49 189, n50_99 41, n100_249 24 | U.S. Census Bureau, County Business Patterns 2023, state file. https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23st.zip | VERIFIED |
| Licences against employers | 5,602 C-39 licences against 2,926 employer establishments: roughly half of the licences belong to firms with no payroll or to firms whose main trade is something else | n/a | Comparison of the rows above | JUDGMENT |
| Share of roofing jobs paid by insurance | NOT FOUND | n/a | n/a | NOT FOUND |

## D2. How many re-roofs: permit counts in two cities that require permits

| Year | City of Los Angeles: permits issued whose description contains re-roof | San Francisco: permits filed with the re-roof flag |
|---|---|---|
| 2016 | n/a | 2,656 |
| 2017 | n/a | 2,911 |
| 2018 | n/a | 2,694 |
| 2019 | n/a | 2,773 |
| 2020 | 8,890 | 2,140 |
| 2021 | 9,024 | 2,490 |
| 2022 | 10,383 | 2,911 |
| 2023 | 14,511 | 3,527 |
| 2024 | 14,273 | 4,426 |
| 2025 | 11,954 | 4,084 |
| 2026 to date | 12,696 (to about 14 November) | 1,877 (the 2026 figure looks incomplete) |

Sources: City of Los Angeles open data, "Building and Safety - Building Permits Issued from 2020 to Present" (dataset pi9x-tg5x), https://data.lacity.org/resource/pi9x-tg5x.json ; City and County of San Francisco open data, "Building Permits" (dataset i98e-djp9), https://data.sf.gov/resource/i98e-djp9.json . Counts by database query on 19 Nov 2026. Status: DERIVED.

| Fact | Value | Source | Status |
|---|---|---|---|
| Los Angeles mix, 2025 | 9,686 one- or two-family dwellings; 1,631 apartments; 637 commercial | Los Angeles data; script `la_reroof.py` | DERIVED |

## D3. Prices

**Warning.** No audited price series for California roofing was found. The three kinds of evidence below disagree, and each has a known weakness.

| Evidence | Value | Short quote | Source | Status |
|---|---|---|---|---|
| San Francisco permits: applicant-declared cost, one- and two-family buildings | Median **$15,000** per re-roof in 2023, 2024 and 2025, and $15,082 in 2026 (middle half $11,000 to $20,000 or $21,000; 2,821 to 3,501 permits a year) | Field "estimated_cost" | San Francisco Building Permits data (D2); script `sf_reroof.py` | DERIVED. Declared for permit fees, so likely on the low side |
| San Francisco: declared cost per square where the permit states an area | Median **$1,133 per square in 2023, $1,072 in 2024, $1,000 in 2025 and 2026** (middle half about $770 to $1,410; 39, 95, 128 and 80 permits). Mostly low-slope modified bitumen | Example: "reroofing- install class a modified bitumen roofing system 3800 sq ft. (hot work torch down)." with estimated cost 50000 | Same | DERIVED (small samples) |
| San Francisco apartments | Median $24,070 per permit, 2024 to 2026 (1,775 permits); $1,140 per square where area is stated (160 permits) | n/a | Same | DERIVED |
| Los Angeles permits: declared valuation | Median $5,100 to $5,400 for a 22-square house roof, and **exactly $200 per square in every year**. This is a nominal figure entered for fee purposes, **not a price**. Do not show it as cost | n/a | Los Angeles data (D2) | DERIVED. Unusable as a price |
| A cost-guide website (no stated data source) | Architectural asphalt shingles $6 to $9 per square foot statewide and $9 to $12 in San Francisco and San Jose; metal $9 to $17; tile $12 to $21; flat roof $7 to $15; wood shakes $11 to $20 (that is $600 to $900 per square for shingles, $1,200 to $2,100 for tile, $700 to $1,500 for flat) | "Costs average $6-$9/sq ft in 2025 for architectural asphalt shingles ..., $9-$17/sq ft for metal, $12-$21/sq ft for tiles, $7-$15/sq ft for flat roof materials, $11-$20/sq ft for cedar shingles/shakes" and "$9-$12/sq ft in SF/San Jose (20-30% premium ...)" | RoofingCalc.com, "Average Cost to Tear Off & Replace a Roof in California". https://www.roofingcalc.com/average-cost-to-tear-off-replace-a-roof-in-california/ (opened 19 Nov 2026) | SECONDARY (unsourced guide; treat as an order of magnitude) |
| Tile underlayment relay price | NOT FOUND from a record. A search summary of contractor sites gives 50 to 70 percent of a full tile replacement | n/a | Search summary | SECONDARY (snippet) |
| Coating prices; prices by region other than San Francisco | NOT FOUND | n/a | n/a | NOT FOUND |
| Cross-check | The San Francisco declared figure for flat roofs ($1,000 to $1,130 per square) sits inside the guide's flat-roof range ($700 to $1,500 per square) | n/a | Comparison | JUDGMENT |

## D4. Programs and money

| Program | What was found | Short quote | Source | Status |
|---|---|---|---|---|
| California Safe Homes grant program (Assembly Bill 888, 2025) | Took effect 1 January 2026; run by the Department of Insurance; for low- and middle-income owners in high-risk areas insured by an admitted insurer or the FAIR Plan; pays toward fire-safe roofs and the five-foot zone; $3 million secured to start; grant amounts not yet set as of January 2026 | "The Safe Homes grant program is designed to help low- and middle-income homeowners with fire mitigation. ... The program will also contribute toward costs for fire-safe roofs." and "has so far secured $3 million in the state budget to get the program started" and "grants, whose amounts have not been determined" | CalMatters, 1 Jan 2026. https://calmatters.org/economy/2026/01/california-safe-homes-grants/ | SECONDARY (news report quoting the Department). Whether applications opened in 2026, and the grant size: NOT FOUND |
| California Wildfire Mitigation Program (home hardening retrofits, Cal OES and CAL FIRE) | Per-home amounts and homes completed: NOT FOUND. Only aggregator pages with conflicting amounts appeared | n/a | Search summary | NOT FOUND |
| Los Angeles Department of Water and Power cool roof rebate | Up to $0.60 per square foot | "Cool Roofs: up to $0.60 per square feet" | LADWP Consumer Rebate Program fact sheet dated 04/2024 (file posted 2026-02). https://www.ladwp.com/sites/default/files/2026-02/2024_FACT_SHEETS_CRP_Eng_042024.pdf | VERIFIED. Tier rules (a search summary says $0.20 or $0.60 by reflectance index for low slopes) were not read |
| Other utility and city cool roof rebates (SMUD, Pasadena, others) | Amounts NOT FOUND | n/a | n/a | NOT FOUND |
| PACE financing | Not researched in the sources opened | n/a | n/a | NOT FOUND |
| FAIR Plan discounts | Up to 16.4 percent off the wildfire part of a dwelling premium for all 12 measures; a Class A roof is one (A6b) | See A6b | A6b | VERIFIED |
| Insurer discounts under Safer from Wildfires | Required since October 2022, but each insurer sets its own amount (A6c) | See A6c | A6c | VERIFIED |
| Replacement cost time limits as a sales fact | An owner has at least 12 months (36 after a declared emergency) to finish the roof and collect the holdback (A5b) | See A5b | A5b | VERIFIED |

## D5. The largest roofing companies

| Fact | Value | Short quote | Source | Status |
|---|---|---|---|---|
| Pacific region entrants in the national Top 100 (2025 list) | Nine, up from two. Led by Flynn Group of Companies (United States revenue), then Best Contracting Services, then Dwayne Nash Industries doing business as Kodiak Roofing and Waterproofing | "The Pacific region saw an increase from last year, going from two entrants to nine. Flynn Group of Companies' U.S. revenue led the region, followed by Best Contracting Services and Dwayne Nash Industries Inc., dba Kodiak Roofing and Waterproofing Co. and Affiliates." | Roofing Contractor magazine, "The Top 100 Roofing Contractors by Region" (2025). https://www.roofingcontractor.com/articles/101702-the-top-100-roofing-contractors-by-region | VERIFIED |
| Kodiak Roofing | A California commercial roofer, number 28 nationally in 2025 | "The commercial roofing company out of California was #28 on the national list." | Same | VERIFIED |
| The full list with revenues, and a ranking by California region | NOT FOUND (the list is an image or interactive graphic; the 2026 list was seen only in a search summary: LeafHome about $2.09 billion and Tecta America about $1.6 billion at the top, neither Californian) | n/a | n/a | NOT FOUND |
| A usable substitute | The CSLB C-39 file (D1) lists every licensed roofer with city and county; it has no size measure. County Business Patterns gives size bands by county, not names | n/a | D1 | JUDGMENT |
