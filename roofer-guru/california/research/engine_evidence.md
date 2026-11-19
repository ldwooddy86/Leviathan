# California engine evidence file: the 2027 M3, airliners, Los Angeles and San Francisco traffic, San Diego and the Navy, landmark bridges

Compiled 19 November 2026. Every number below was read from a source opened in this session unless the status says otherwise. Nothing here is from memory. Where a figure could not be found, it says NOT FOUND, and the engine default that fills the gap should be labelled as an assumption in the code.

## How to read the status column

| Status | Meaning |
|---|---|
| **VERIFIED** | I opened the source and read the passage or the data row. |
| **VERIFIED (fetch tool)** | Opened through the web-fetch tool, which returns extracted text rather than the raw page. Treat the quote as near-verbatim. |
| **VERIFIED (chart)** | Read from an FAA chart or a figure rendered as an image in this session. |
| **VERIFIED (data)** | A value read from a published dataset row or API response (the row is quoted). |
| **SECONDARY** | A source I opened quotes or reports the figure; the original (for example a maker's unpublished data sheet) was not opened. |
| **SECONDARY (snippet)** | Seen only in a search-result summary. A lead, not a fact. |
| **DERIVED** | My arithmetic from verified numbers. The inputs are named. |
| **NOT FOUND** | Searched for and not found, or the site refused automated fetches (named where that happened). |

Raw downloads are in `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/engine/`, text extractions in `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/research/ca/engine_txt/`, rendered charts in `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/research/ca/engine_img/`, and the scripts that produced the derived tables in `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/research/ca/engine_scripts/`.

Sites that refused automated fetches in this session: edmunds.com (403), paultan.org (403), mathworks.com (403 to curl, readable through the fetch tool), epa.gov contrails PDF (403; the same factsheet was read from the FAA's copy), federalregister.gov (403; read from govinfo.gov instead), science-edu.larc.nasa.gov (gateway 502), bmwusa.com (stream error), hypebeast.com (empty body). Car and Driver and MotorTrend block the search tool but served their pages to a direct fetch.

The user's top speed of 251 mph for the car is the user's figure and is not examined here. For reference only, the published limits of the real cars are in A3 and A5.

---

# A. The car

## A1. Which car is "the 2027 BMW M3"? Two different cars carry that name

**Finding. As of 19 November 2026 the name covers two cars, and they could hardly be more different.**

1. **The car on sale in the United States as the model-year 2027 M3 is still the sixth-generation petrol car (G80)**: twin-turbo 3.0 litre straight six, rear or all-wheel drive, quad exhausts. BMW's own US release calls its run-out special "the 2027 BMW M3 CS Handschalter".
2. **The all-new M3 that BMW launches in 2027 is electric** (Neue Klasse, internal code ZA0 according to BMWBlog): four motors, no exhausts. BMW showed it to the press as a camouflaged prototype on 18 November 2026; the reveal is reported for 7 January 2027 and production starts in Munich in 2027.
3. **A new petrol M3 (G84) follows the electric car**, reported for 2028. BMW has confirmed it exists and that it is not a plug-in hybrid; no figures are published.

For a "black 2027 M3 with realistic handling" the only car with a full published data set today is the G80 (sections A3 to A6). The electric car has confirmed layout facts and press-reported preliminary figures only (A2).

| Item | Figure or fact | Short quote | Source | Status |
|---|---|---|---|---|
| US model-year 2027 M3 is the G80 | Sixth generation, final year | "BMW M is marking the close of the M3's sixth generation with a special, limited-edition model built for maximum driver involvement. The 2027 BMW M3 CS Handschalter pairs the lightweight construction and track-ready chassis tuning of BMW CS models with the added engagement of a 6-speed manual transmission and rear-wheel drive." | BMW Group Newsroom Americas, 18 May 2026. https://newsroom.bmwgroup.com/americas/the-bmw-m3-cs-handschalter-a-manual-rear-wheel-drive-sendoff-for-the-sixth-generation-m3/ | VERIFIED |
| Same, from the press | G80 near its end | "The G80's time is almost up, with a Neue Klasse platform M3 expected to debut soon" (page headed "2027 BMW M3", MSRP "$80,650–$108,450") | MotorTrend, 2027 BMW M3 model page. https://www.motortrend.com/cars/bmw/m3/2027 | VERIFIED |
| Electric M3 confirmed for 2027 | First electric M car | "From 2027, BMW M will usher in a new era in the high-performance vehicle segment and, for the first time, bring BMW M's motto ... to life with a fully electric drivetrain." | BMW Group Newsroom, 14 Jan 2026. https://newsroom.bmwgroup.com/global/the-beginning-of-a-new-era-fully-electric-bmw-m-models-set-unrivalled-high-performance-standards/ | VERIFIED |
| Electric M3 built in Munich | Plant Munich, electric only from 2027 | "the BMW Group's main plant in Munich will also produce the fully-electric BMW M3 – the first high-performance model to feature BMW M Neue Klasse technology" and "From 2027 onwards, the BMW Group will produce only fully-electric vehicles at this site." | BMW Group Newsroom, 2 Oct 2026. https://newsroom.bmwgroup.com/global/one-million-times-the-thrill-of-m-plant-munich-builds-milestone-bmw-m3-and-shapes-the-electric-future-of-bmw-m/ | VERIFIED |
| Reveal date of the electric car | 7 January 2027 | "We can't show you pictures of the finished M3 – it gets revealed on January 7 2027" | evo, John Barker, 16 Nov 2026. https://www.evo.co.uk/bmw/m3/209281/new-bmw-m3-electric-prototype-review-the-ev-weve-all-been-waiting-for | SECONDARY (press; BMW's own release gives no date) |
| Model code, electric | ZA0; badge is plain "M3" | "BMW will start building the electric M3 at its Munich plant in 2027, and it drops the "i" to be called simply M3." and "the near-production electric BMW M3 (ZA0)" | BMWBlog, 21 Oct 2026. https://www.bmwblog.com/2026/10/21/electric-bmw-m3-za0-prototype-video/ | SECONDARY (BMW does not publish internal codes). Note: evo's 3 Sep 2026 article calls it "the JA1 BMW M3"; BMWBlog has used ZA0 since 2023. Treat the code as unconfirmed |
| Model code, next petrol car | G84, reported 2028 | "A gas-powered M3 (G84) with an inline-six follows in 2028." | Same BMWBlog article | SECONDARY |
| Petrol car is not a hybrid | Straight six, no plug-in | Frank van Meel: "It won't be hybrid, as we're sticking with the perfect combustion principle. Here [with the Neue Klasse M3] we will go to the extremes, not the in-between." | BMWBlog, 15 Jun 2026, quoting PistonHeads. https://www.bmwblog.com/2026/06/15/bmw-confirms-m3-g84-not-phev/ | SECONDARY |
| Petrol car looks like the electric one | Reported | "BMW officials have already told us the G84 will look nearly identical when it arrives later this decade." | Same | SECONDARY |

## A2. The electric 2027 M3 (Neue Klasse): what is published

### A2a. Confirmed by BMW

| Item | Figure or fact | Short quote | Source | Status |
|---|---|---|---|---|
| Headline | Most powerful M3 ever | "Four electric motors, BMW M eDrive and M Dynamic Performance Control unlock a new dimension of driving dynamics." and "The result is the fastest and most powerful BMW M3 ever." | BMW Group Newsroom, 18 Nov 2026 (pre-drive at Miramas). https://newsroom.bmwgroup.com/global/a-new-dimension-of-driving-dynamics-the-new-bmw-m3-demonstrates-its-exceptional-potential-for-the-first-time/ | VERIFIED. The release carries no power, weight or acceleration figure |
| Motors | Four, one per wheel, in two drive units, one gearbox per wheel | "two electric drive units on the front and rear axles, each with one electric motor per wheel" and "the electric motors are arranged in parallel, each delivering power to one gearbox per wheel" | BMW Group Newsroom, 14 Jan 2026 (URL in A1) | VERIFIED |
| Drive | All-wheel drive that can become rear-wheel drive | "Additionally, the front axle can be completely decoupled. The result is BMW M's renowned rear-wheel drive with its dynamic driving characteristics" | Same | VERIFIED |
| Battery | More than 100 kWh usable, 800 volt, structural housing | "The high-voltage battery, boasting over 100 kWh of usable energy" and "The high-voltage battery housing also serves as a structural component of the vehicle and is connected to the front and rear axles." | Same | VERIFIED |
| Gears and sound | Simulated shift stages and soundscape | "various predefined driving modes and shift stages, along with a newly developed soundscape, are employed" | Same | VERIFIED |
| Materials | Natural-fibre panels | "BMW M will introduce for the very first-time natural fibre elements within the fully electric BMW M high-performance model line-up" | Same | VERIFIED |

### A2b. Body details (from the BMW M Concept Neue Klasse, which BMW and the press say is close to the production car)

| Item | Detail | Short quote | Source | Status |
|---|---|---|---|---|
| Grille and lights | Low shark nose; grille and headlights are one unit; yellow daytime light signature | "A forward-facing shark nose and a light signature with depth effect characterise the front end. Headlights and kidney grille form a single unit. The new M Yellow Lights create a focused view of the road. The yellow light icons are set to become a new signature feature of future BMW M automobiles" | BMW Group Newsroom, 12 Jun 2026. https://newsroom.bmwgroup.com/global/design-meets-performance-the-bmw-m-concept-neue-klasse---world-premiere-at-the-24-hours-of-le-mans | VERIFIED (concept, not production) |
| Arches | Wide arches, strong shoulder | "Powerful proportions, precise lines and a muscular shoulder section with wide wheel arches define the unmistakable BMW M character." | Same | VERIFIED (concept) |
| Bonnet | V-shaped with an air outlet | "A distinctive air outlet shapes the V-shaped front bonnet. It supports the cooling of the electric drivetrain." | Same | VERIFIED (concept) |
| Front bumper | Three-part "trimaran" bumper with splitter; stacked marker lights at the corners | "The front apron of the BMW M Concept Neue Klasse adopts a trimaran-style bumper" and "three-dimensional Track Lights located in the outer sections of the front apron" | Same | VERIFIED (concept) |
| Rear | Floating diffuser, ducktail spoiler, **no exhausts** | "The Track Lights frame the trimaran element above the floating diffuser. A striking ducktail spoiler improves aerodynamics" | Same | VERIFIED (concept) |
| Rear, press view of the production car | No tailpipes; corner marker lights | "at the rear there's a huge diffuser that's cleaner and more effective because it's uncompromised by four fat tailpipes. Signature details are Defender-ish, double-stacked marker lights at each corner." | evo, 16 Nov 2026 (URL in A1) | SECONDARY |
| How close the concept is | About 30 per cent less arch | "Wind back the steroidal arches by about 30 per cent and get rid of the harness belts and rear bucket seats on the inside, and it pretty much would be the JA1 BMW M3." | evo, 3 Sep 2026. https://www.evo.co.uk/bmw/m3/206334/2027-bmw-m3-everything-we-know-about-ms-audi-rs5-rival | SECONDARY |
| Concept colour and wheels | Monza Red, centre-lock wheels | "The newly developed Monza Red metallic paint finish and the red-and-blue coded centre-lock wheels" | BMW, 12 Jun 2026 | VERIFIED (concept only; production colours NOT FOUND) |

### A2c. Preliminary figures reported by journalists from the November 2026 prototype drive (BMW has not published them)

| Item | Figure | Short quote | Source | Status |
|---|---|---|---|---|
| System power and torque | 625 kW (850 PS), 1,200 Nm | "die Systemleistung des BMW M3 wird mit 625 kW (850 PS) in Aussicht gestellt, das Drehmoment mit 1.200 Newtonmetern" | Autonotizen (German), Nov 2026. https://autonotizen.de/fahrberichte/bmw-m3-elektro-test-fahrt-video-2027 | SECONDARY (preliminary) |
| Same, British units | About 830 bhp, 900 lb ft | "the electric M3 has around about 830bhp, with 900lb ft of torque – the final figures will be close to these numbers – which it delivers via four motors, one for each wheel" | evo, 16 Nov 2026 | SECONDARY (preliminary). 625 kW is 838 bhp, so the two agree |
| Per axle | Rear pair 560 kW and 1,000 Nm; front pair 480 kW and 540 Nm | "Das Motorenduo im Heck liefert 560 kW und 1.000 Newtonmeter, von vorne kommen 480 kW und 540 Newtonmeter Drehmoment hinzu." | Autonotizen | SECONDARY |
| Weight | Not published. Estimates 2.3 to 2.5 tonnes | "We've not been told the weight but it's probably the thick end of 2500kg." (evo); "der wohl rund 2,3 Tonnen schwere BMW" (Autonotizen) | Both | SECONDARY (journalists' estimates, and they disagree) |
| Tyres | 275 front, 295 rear; 20 inch front and 20 or 21 inch rear | "bespoke Michelin Pilot Sport S 6s, 275/35 R20 front, 295/35 R20 rear, HL – high load – at the front" (evo); "275 Millimeter breiten Hankook Ion Evo vorne und 295 Millimetern auf der Hinterachse mit 20 (vorne) bzw. 21 Zoll (hinten) großen Felgen" (Autonotizen) | Both | SECONDARY |
| Battery and range | About 100 to 108.7 kWh; about 650 km or 400 miles WLTP target | "there's a bespoke 100kWh battery that's good for a WLTP range of 400 miles" (evo); "Rund 650 Kilometer Norm-Reichweite peilt BMW ... an" (Autonotizen) | Both | SECONDARY |
| Charging and regeneration | Up to 420 kW DC; up to 540 kW regeneration | "über CCS sollen bis zu 420 kW möglich sein" and "Die maximale Rekuperationsleistung liegt bei 540 kW." | Autonotizen | SECONDARY |
| Brakes in use | Motors do most of the braking | "On a regular car they'd be at 300-350deg C, but the EV M3's are at just 70deg C." | evo | SECONDARY |
| Gearing | Single fixed ratio; six simulated "stages" on the paddles | "obwohl auch der M3 mit einer festen Übersetzung fährt" and "sechs sogenannte „Stages“ programmiert" | Autonotizen | SECONDARY |
| Top speed (real car) | Probably 250 km/h limited, more with a Driver's Package | "Die Höchstgeschwindigkeit dürfte bei 250 km/h liegen, mit einem optionalen Drivers-Package nochmals höher." | Autonotizen | SECONDARY (the reporter's expectation) |
| Track modes | Hot Lap 2 min, Short Run 8 min, Long Run 15 min | "'Hot Lap', which optimises performance for two minutes, to 'Short Run' (eight minutes) and 'Long Run' (15 minutes)" | evo | SECONDARY |
| 0-60, dimensions, wheelbase, track, weight distribution, drag | NOT FOUND | "BMW hasn't published horsepower, torque, weight or acceleration figures." | BMWBlog, 21 Oct 2026 | NOT FOUND |

## A3. The G80 M3 (the US model-year 2027 car): BMW's published figures

Three official tables were opened: the US release for model year 2025 (the current specification, with the 523 hp all-wheel-drive car), the 2020 US launch kit, and BMW's metric data sheet of 03/2021 (the only one that prints drag). From July 2026 the engine gained pre-chamber ignition with unchanged outputs (last row).

### A3a. Body, weight, drag

| Item | M3 (6-speed manual, rear drive) | M3 Competition (rear drive) | M3 Competition M xDrive | Source | Status |
|---|---|---|---|---|---|
| Length / width / height | 189.1 / 74.3 / 56.6 in (4,794 / 1,903 / 1,433 mm) | same | same | US: "Length / Width / Height (in) \| 189.1 / 74.3 / 56.6". Metric: "Length/width/height (unladen) mm 4794 / 1903 / 1433" | VERIFIED (both) |
| Wheelbase | 112.5 in (2,857 mm) | same | same | "Wheelbase (in) \| 112.5"; "Wheelbase mm 2857" | VERIFIED |
| Track front / rear | 63.7 / 63.2 in (1,617 / 1,605 mm) | same | same | "Track, front / rear (in) \| 63.7 / 63.2"; "Track, front/rear mm 1617 / 1605" | VERIFIED |
| Ground clearance | 4.7 in (120 mm) | 4.7 in | 4.8 in | "Ground clearance (in) \| 4.7 \| 4.7" and xDrive "4.8" | VERIFIED |
| Turning circle | 40.0 ft (12.2 m) | 40.0 ft | 41.3 ft | "Turning circle (ft) \| 40.0 \| 40.0"; xDrive "41.3"; "Turning circle m 12.2" | VERIFIED |
| Kerb weight, US | 3,840 lb | 3,891 lb | 3,990 lb | "Curb weight (lbs) \| 3,840 \| 3,891" and xDrive "3,990" | VERIFIED |
| Kerb weight, DIN / EU (2021 sheet) | 1,705 / 1,780 kg | 1,730 / 1,805 kg | not on that sheet | "Weight, unladen, to DIN/EU kg 1705 / 1780" and "1730 / 1805" | VERIFIED |
| Gross weight | 4,872 lb | 4,872 lb | 4,982 lb | "GVWR (lbs) \| 4,872 \| 4,872"; xDrive "4,982" | VERIFIED |
| Drag | Cd 0.33, frontal area 2.34 m2 (CdA 0.772 m2) | same | not on that sheet | "Air resistance cd x A 0.33 x 2.34" | VERIFIED (CdA is DERIVED) |
| Boot | 16.9 cu ft (480 litres) | same | same | "Luggage capacity (cu ft) \| 16.9" | VERIFIED |

Sources for the table: BMW Group Newsroom Americas, "The new 2025 BMW M3", 28 May 2024, https://newsroom.bmwgroup.com/americas/the-new-2025-bmw-m3/ ; BMW Media Information, "Specifications. BMW M3 Sedan. 03/2021", https://newsroom.bmwgroup.com/global/download/78454d7f-59b7-4da4-a815-1f8f95410376/20260722141109363-768.pdf (attached to https://newsroom.bmwgroup.com/global/specifications-of-the-bmw-m3-sedan-and-the-bmw-m3-competition-sedan-valid-from-032021/).

### A3b. Engine

| Item | M3 | M3 Competition | M3 Competition M xDrive (2025 on) | Short quote | Status |
|---|---|---|---|---|---|
| Engine | 2,993 cc twin-turbo straight six (S58), bore 84.0, stroke 90.0 mm, compression 9.3:1 | same | same | "Capacity (CC) \| 2,993 \| Stroke / bore (mm) \| 90.0 / 84.0 \| Compression ratio (:1) \| 9.3" | VERIFIED |
| Peak power | 473 hp at 6,250 rpm | 503 hp at 6,250 rpm | 523 hp at 6,250 rpm | "Max output (hp @ RPM) \| 473 @ 6,250 \| 503 @ 6,250" and "523 @ 6,250" | VERIFIED |
| Peak torque (flat plateau) | 406 lb-ft from 2,650 to 6,130 rpm | 479 lb-ft from 2,750 to 5,500 rpm | 479 lb-ft from 2,750 to 5,730 rpm | "Max torque (lb-ft @ RPM) \| 406 @ 2,650-6,130 \| 479 @ 2,750-5,500" and "479 @ 2,750-5,730" | VERIFIED |
| Same in metric (2021 sheet) | 353 kW / 480 hp; 550 Nm | 375 kW / 510 hp; 650 Nm | n/a | "Max. output kW/hp 375 / 510 at rpm 6250 Max. torque Nm 650 at rpm 2750 – 5500" | VERIFIED |
| Rev limit | 7,200 rpm | 7,200 rpm | 7,200 rpm | "Both core and Competition models rev to a redline of 7,200 rpm." | VERIFIED (BMW US launch kit dated "Sept. 22, 2020", https://newsroom.bmwgroup.com/americas/the-new-2021-bmw-m3-sedan-and-m4-coupe/) |
| Boost | 18.9 psi | 24.7 psi | n/a | "brings more turbo boost (24.7 psi versus 18.9)" | VERIFIED (Car and Driver, URL in A5) |
| Torque curve shape | Flat from about 2,700 rpm to about 5,600 rpm, then power holds to 6,250 and falls to the 7,200 limit | | | The plateau endpoints above are BMW's. A full dyno curve was NOT FOUND in a published BMW source | DERIVED / NOT FOUND |
| 2026 update | Pre-chamber ignition, same outputs | | | "All variants of the BMW M3 and BMW M4 will come with BMW M Ignite technology from July 2026." and "The displacement and power outputs of all the models with BMW M Ignite technology will be unchanged" | VERIFIED (BMW, 7 May 2026, https://newsroom.bmwgroup.com/global/bmw-m-ignite-technology-innovative-new-technology-for-all-six-cylinder-in-line-engines-from-bmw-m/) |

Derived check on the plateau: 479 lb-ft at 5,500 rpm is 502 hp, and 479 lb-ft at 5,730 rpm is 523 hp, so in the Competition cars peak power is simply the end of the torque plateau carried to 6,250 rpm.

### A3c. Gearbox, final drive, drive system

| Gear | 6-speed manual | 8-speed M Steptronic (ZF automatic) | Source | Status |
|---|---|---|---|---|
| 1 | 4.111 | 5.000 | BMW 03/2021 sheet: "Gear ratios I :1 5.000 II :1 3.200 III :1 2.143 IV :1 1.720 V :1 1.313 VI :1 1.000 VII :1 0.823 VIII :1 0.640 R :1 3.478 Final drive :1 3.154" | VERIFIED |
| 2 | 2.315 | 3.200 | | VERIFIED |
| 3 | 1.542 | 2.143 | | VERIFIED |
| 4 | 1.179 | 1.720 | | VERIFIED |
| 5 | 1.000 | 1.313 | | VERIFIED |
| 6 | 0.846 | 1.000 | | VERIFIED |
| 7 | n/a | 0.823 | | VERIFIED |
| 8 | n/a | 0.640 | | VERIFIED |
| Reverse | 3.727 | 3.478 | | VERIFIED |
| Final drive | 3.462 | 3.154 | US table rounds these to 3.46 and 3.15 | VERIFIED |

- All-wheel drive: "The rear-biased system will distribute torque between the front and rear axles via an electronically controlled multi-plate clutch. An Active M differential takes care of torque distribution at the rear axle. Torque will be directed to the rear wheels during normal driving ... Only when additional traction is required will torque be sent to the front axle." Modes "4WD", "4WD Sport" and "2WD" (stability control off). BMW US launch kit. VERIFIED.
- Top-gear revs at 60 mph: "TOP-GEAR REVS @ 60 MPH 1,500 rpm"; overall top-gear ratio "3.15:1/2.02:1". MotorTrend test table (URL in A5). VERIFIED.
- Manual is 50 lb lighter: "A bonus of the manual transmission is the 50 lb. weight reduction over 8-speed M Steptronic automatic transmission". BMW US launch kit. VERIFIED.

### A3d. Wheels, tyres, brakes, steering

| Item | M3 | M3 Competition and xDrive | Short quote | Source | Status |
|---|---|---|---|---|---|
| Tyres | 275/40 R18 front, 285/35 R19 rear | 275/35 R19 front, 285/30 R20 rear | "Tires front / rear (std) \| 275/40 R18 103Y XL / 285/35 R19 103Y XL \| 275/35 R19 100Y XL / 285/30 R20 99Y XL" | BMW US 2025 table | VERIFIED |
| Wheels | 9.5J x 18 front, 10.5J x 19 rear | 9.5J x 19 front, 10.5J x 20 rear | "Rims, front / rear (in) (std) \| 9.5J x 18.0 / 10.5J x 19.0 \| 9.5J x 19.0 / 10.5J x 20.0" | Same | VERIFIED |
| Tyre makes on test cars | Michelin Pilot Sport 4S; Pirelli P Zero PZ4 | | "Tires: Michelin Pilot Sport 4S" (2021 car); "Tires: Pirelli P Zero PZ4" (2023 car) | Car and Driver | VERIFIED |
| Standard brakes | 380 mm front discs with six-piston fixed calipers; 370 mm rear with single-piston floating calipers | same | "front six-piston fixed-caliper brakes with 380 mm discs and rear single-piston floating-calipers with 370 mm disks" | BMW US launch kit | VERIFIED |
| Carbon-ceramic option | 400 mm front, 380 mm rear, gold calipers, about 30 lb lighter | same | "Their gold painted calipers are complemented by front 400 mm discs and rear 380 mm disks." and "the M Carbon ceramic brakes are about 30 lbs lighter than the standard M Compound brakes" | BMW US launch kit; BMW US 2025 release | VERIFIED |
| Steering | Electric rack and pinion, overall ratio 15.0:1, 2.0 turns lock to lock | same | "Steering ratio overall (:1) \| 15.0"; MotorTrend: "STEERING RATIO 15.0:1" and "TURNS LOCK-TO-LOCK 2.0" | BMW US 2025 table; MotorTrend | VERIFIED |
| Suspension | Front double-joint spring strut; rear five-link; adaptive dampers | same | "Adaptive M suspension with double-joint spring strut axle" / "five-link axle" | BMW US 2025 table | VERIFIED |

## A4. What makes the G80 recognisable (body details)

| Feature | Detail | Short quote | Source | Status |
|---|---|---|---|---|
| Grille | Tall, deep, frameless twin kidney | "the front end is highlighted by the large and deep frameless BMW kidney grille" | BMW US launch kit, 22 Sep 2020 | VERIFIED |
| Headlights (2025 on) | Slim LED units with two vertical arrow-shaped daytime lights each | "Two sculpted, subtly arrow-shaped vertical LED units in each module serve as both daytime driving lights and turn signal indicators." | BMW US, 28 May 2024 | VERIFIED |
| Arches and sills | Flared front and rear arches; black extended sills forming a band round the car | "The most striking design feature alongside the prominently flared fenders of the new M3 and M4 are the extended side sills. ... they form a High-gloss Black band around the whole of the car." | BMW US launch kit | VERIFIED |
| Side | "M gills" in the front wings | "The M gills familiar from past and present cars are integrated neatly into the distinctive surfacing of the front side fenders." | Same | VERIFIED |
| Roof | Exposed carbon-fibre roof with two lengthwise fins | "The roof of both the new BMW M3 and M4 is made from carbon-fiber-reinforced plastic (CFRP)." and "Two fins running longitudinally over the CFRP roof optimize airflow" | Same | VERIFIED |
| Rear | Lip spoiler; black diffuser; **four round exhaust tips of 100 mm in two pairs**; slim dark L-shaped LED tail lights | "The rear diffuser comes in black on all models and frames the familiar exhaust system's twin pairs of 100 mm exhaust tips. The slim, darkened rear light clusters with L-shaped LED taillights extend into the fenders" | Same | VERIFIED |
| Competition trim | Mirrors and spoiler in gloss black | "painted in body color or High-gloss Black on the Competition models" | Same | VERIFIED |
| A black paint BMW lists for the 2027 model year | Black Sapphire metallic | "Isle of Man Green metallic and Black Sapphire metallic are offered at no charge" (2027 M3 CS Handschalter) | BMW US, 18 May 2026 | VERIFIED (for that model; the full 2027 colour list was not opened) |

## A5. Independent instrumented tests of the G80

| Measure | M3 Competition, rear drive | M3 Competition M xDrive | Source and quote | Status |
|---|---|---|---|---|
| 0-60 mph | 3.5 s | 2.8 s | Car and Driver: "60 mph: 3.5 sec" (2021 car); "60 mph: 2.8 sec" (2023 car). "Results above omit 1-ft rollout of 0.2 sec." | VERIFIED |
| 0-30 mph | n/a | 1.0 s | "the quickest-ever 3-series leaps to 30 mph in 1.0 second" | VERIFIED |
| 0-100 mph | 7.6 s | 7.0 s | "100 mph: 7.6 sec"; "100 mph: 7.0 sec" | VERIFIED |
| 0-130 / 0-150 mph | 12.8 / 18.3 s | 12.3 / 18.2 s | "130 mph: 12.8 sec 150 mph: 18.3 sec"; "130 mph: 12.3 sec 150 mph: 18.2 sec" | VERIFIED |
| Quarter mile | 11.6 s at 124 mph | 11.0 s at 124 mph | "1/4-Mile: 11.6 sec @ 124 mph"; "1/4-Mile: 11.0 sec @ 124 mph" | VERIFIED |
| Rolling 5-60 mph | 4.5 s | 4.2 s | "Rolling Start, 5–60 mph: 4.5 sec"; "4.2 sec" | VERIFIED |
| Top gear 30-50 / 50-70 mph | 2.4 / 2.7 s | 2.4 / 2.7 s | "Top Gear, 30–50 mph: 2.4 sec Top Gear, 50–70 mph: 2.7 sec" | VERIFIED |
| Braking 70-0 mph | 150 ft | 153 ft | "Braking, 70–0 mph: 150 ft"; "153 ft" (both cars on carbon-ceramic brakes) | VERIFIED |
| Braking 100-0 mph | 297 ft | 297 ft | "Braking, 100–0 mph: 297 ft" | VERIFIED |
| Skidpad (300 ft) | 1.03 g | 1.03 g | "Roadholding, 300-ft Skidpad: 1.03 g" | VERIFIED |
| Top speed | 180 mph (maker's claim with Driver's Package) | 156 mph (governor) | "Top Speed (mfr's claim): 180 mph"; "Top Speed (gov ltd): 156 mph" | VERIFIED |
| Test weight | 3,820 lb | 3,929 lb | "Curb Weight: 3820 lb"; "Curb Weight: 3929 lb" | VERIFIED |
| Cabin noise | 72 dB at 70 mph, 84 dB at full throttle | n/a | "72 decibels of noise inside at a steady 70 mph" | VERIFIED |

Car and Driver sources: "Tested: 2021 BMW M3 Competition Is a Quicker M3", 12 Aug 2021, https://www.caranddriver.com/reviews/a37286079/2021-bmw-m3-competition-by-the-numbers/ ; "2023 BMW M3 Competition xDrive", https://www.caranddriver.com/reviews/a43389602/2023-bmw-m3-competition-xdrive-edition-50-jahre-by-the-numbers/ ; summary table also at https://www.caranddriver.com/bmw/m3 .

| Measure | M3 Competition, rear drive (2021) | M3 Competition xDrive (2022) | Source and quote | Status |
|---|---|---|---|---|
| Weight and **front/rear distribution** | 3,745 lb, **53 / 47 per cent** | 3,899 lb, **54 / 46 per cent** | MotorTrend: "CURB WEIGHT (F/R DIST) 3,745 lb (53/47%)"; "CURB WEIGHT (DIST F/R) 3,899 lb (54/46%)" | VERIFIED |
| 0-60 mph | 3.5 s | 3.0 s | "0-60 MPH 3.5 sec"; "0-60 3.0" | VERIFIED |
| 0-30 / 0-100 mph | n/a | 1.0 / 7.2 s | "0-30 1.0 sec"; "0-100 7.2" | VERIFIED |
| Quarter mile | 11.6 s at 125.6 mph | 11.1 s at 124.7 mph | "QUARTER MILE 11.6 sec @ 125.6 mph"; "11.1 sec @ 124.7 mph" | VERIFIED |
| Braking 60-0 mph | 102 ft | 105 ft | "BRAKING, 60-0 MPH 102 ft"; "105 ft" | VERIFIED |
| Lateral acceleration | 1.03 g average | 1.03 g average | "LATERAL ACCELERATION 1.03 g (avg)" | VERIFIED |
| Figure eight | 23.8 s at 0.85 g average | 23.3 s at 0.89 g average | "MT FIGURE EIGHT 23.8 sec @ 0.85 g (avg)"; "23.3 sec @ 0.89 g (avg)" | VERIFIED |
| Redline, turning circle | 7,200 rpm | 7,200 rpm; 41.4 ft | "REDLINE 7,200 rpm"; "TURNING CIRCLE 41.4 ft" | VERIFIED |

MotorTrend sources: "2021 BMW M3 Competition First Test", https://www.motortrend.com/reviews/2021-bmw-m3-sedan-first-test-drive-review ; "2022 BMW M3 Competition vs. Cadillac CT4-V Blackwing", 12 Jan 2022, https://www.motortrend.com/reviews/2022-bmw-m3-competition-vs-cadillac-ct4-v-blackwing-comparison-test-review .

BMW's own claims for comparison (VERIFIED, BMW US 2025 table): 0-60 mph 4.1 s (manual), 3.8 s (Competition), 3.4 s (Competition xDrive); "Top speed (mph) / w/M Driver's Package \| 155 / 180". The 2021 metric sheet gives 0-100 km/h 4.2 s and 3.9 s, and 80-120 km/h in fourth and fifth gear of 2.6 and 3.4 s for the Competition.

**Derived braking and grip numbers for the model (DERIVED from the tests above):** 60-0 mph in 102 to 105 ft is a mean deceleration of 1.14 to 1.18 g; 70-0 in 150 to 153 ft is 1.07 to 1.09 g; 100-0 in 297 ft is 1.12 g. Steady-state cornering 1.03 g. So a tyre-road friction of about 1.05 to 1.2 reproduces the measured car.

## A6. Centre of gravity height

| Item | Finding | Source | Status |
|---|---|---|---|
| Centre of gravity height of the G80 | BMW publishes no figure. The only official statement is qualitative: "This extremely lightweight material lowers the cars' center of gravity, enhancing their agility." (carbon roof) | BMW US launch kit | NOT FOUND |
| US rollover data | The 2022 M3 is "Not Rated". The 2022 3 Series saloon on the same platform has "RolloverPossibility: 0.092", five stars, "No Tip" | NHTSA Safety Ratings API, https://api.nhtsa.gov/SafetyRatings/VehicleId/16198 and https://api.nhtsa.gov/SafetyRatings/VehicleId/16105 | VERIFIED (data) |
| How NHTSA's figure relates to height | Static Stability Factor "is the ratio of one half its track width to its center of gravity (c.g.) height" | NHTSA, 68 FR 59250, 14 Oct 2003, https://www.govinfo.gov/content/pkg/FR-2003-10-14/html/03-25360.htm | VERIFIED. The equation that converts rollover risk to SSF is printed only as an image in that notice, so I did not convert the 9.2 per cent to a height. Any height used in the engine (saloons of this type are commonly modelled at roughly 0.5 m) is an assumption, not a published figure |

## A7. Tyre model figures from engineering texts

| Quantity | Published figure | Short quote | Source | Status |
|---|---|---|---|---|
| Peak longitudinal grip, dry road | About 1.0; range 1.0 to 1.3 | "µ max ~ 1" and "On all dry road surfaces, the coefficient of grip is between 1 and 1.3." | Michelin, "The Tyre: Grip", Société de Technologie Michelin, 2001, section "Longitudinal grip in braking" (about pp. 38-39) and the dry/wet table in section II (about p. 26). Copy hosted by the University of Pisa: https://docenti.ing.unipi.it/~a005973/Michelin_Tire_Grip.pdf | VERIFIED |
| Slip ratio at peak | 5 to 15 per cent, typically 10 per cent; falls as speed rises | "For a Car tyre, µmax is generally reached for a slippage rate between 5 and 15 %." and "The slippage rate for which the µ max is reached decreases when the vehicle's speed increases." | Same, about p. 39 | VERIFIED |
| Same, from a US highway text | 10 to 20 per cent; sliding value well below peak | "The coefficient of friction increases rapidly with increasing slip to a peak value that usually occurs between 10 and 20 percent slip (critical slip). The friction then decreases to a value known as the coefficient of sliding friction, which occurs at 100 percent slip. The difference between the peak and sliding coefficients of friction may equal up to 50 percent of the sliding value" | NCHRP Web-Only Document 108, "Guide for Pavement Friction", 2009, ch. 4. https://www.dot.state.mn.us/mnroad/projects/hma-surface-characteristics/files/nchrp-w108-guide-for-pavement--friction.pdf | VERIFIED |
| Slip angle at peak lateral force | 4 to 7 degrees for a car tyre | "Ymax is reached for a slip angle of: 4 to 7 ° for a car, 6 to 10° for a truck." and "depending on the tyre's construction, the rubber compound used, the type of road surface, and the inflation pressure" | Michelin, section "Transversal grip in cornering" (about pp. 49-50) | VERIFIED |
| Slip angles in ordinary driving | 2 degrees on the open road, 5 in town | "Ordinarily, a driver does not use more than a 2° slip angle on the open road and no more than 5° in town." | Michelin, same section (about p. 46) | VERIFIED |
| Combined braking and cornering | Friction circle | "the tyre-road interface represents a global grip potential delineated approximately by a circle" and "The maximum values of longitudinal grip coefficient µmax and transversal grip coefficient τmax cannot therefore be reached simultaneously." | Michelin, "Sharing the grip potential on the road" (about p. 54) | VERIFIED |
| Lock-up time without ABS | About 0.2 s from peak to locked | "the coefficient of friction drops from µmax to µblocked within approximately 0.2 seconds" | Michelin, about p. 39 | VERIFIED |
| Magic Formula constants, dry | B 10, C 1.9, D 1, E 0.97 | "These values are typical sets of constant Magic Formula coefficients for common road conditions." Table: "Dry tarmac 10 1.9 1 0.97; Wet tarmac 12 2.3 0.82 1; Snow 5 2 0.3 1; Ice 4 2 0.1 1" | MathWorks, Simscape Driveline, "Tire-Road Interaction (Magic Formula)". https://www.mathworks.com/help/sdl/ref/tireroadinteractionmagicformula.html | VERIFIED (fetch tool) |
| Magic Formula form | Fx = Fz D sin(C arctan(Bk - E(Bk - arctan(Bk)))) | "Fx=f(κ,Fz)=Fz⋅D⋅sin(C⋅arctan{Bκ−E[Bκ−arctan(Bκ)]})"; block default "Slip at peak force at rated load (percent): 10" | Same | VERIFIED (fetch tool) |

A measured force-and-moment data set for the M3's own Michelin Pilot Sport 4S or Pirelli P Zero was NOT FOUND in an open source. To match the tested car, scale the generic dry curve so that peak grip is about 1.1 to 1.2 longitudinally (from the measured stops) and steady cornering reaches 1.03 g (from the skidpad), with the peak at about 10 per cent slip and 5 to 7 degrees.

---

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

# E. San Diego and the Navy

**Source warning for this section.** Every official Navy site tried (navy.mil fact files, cnrsw.cnic.navy.mil base pages, nvr.navy.mil) refused automated fetches (HTTP 403 or a certificate error), through both curl and the fetch tool. Ship, base and squadron facts below are therefore **SECONDARY** (Wikipedia and news reports, each opened and quoted) unless marked otherwise. Runway and airspace facts are VERIFIED from FAA data via AirNav; the F/A-18E and V-22 sizes are VERIFIED from the FAA aircraft database; freeway and bridge traffic is VERIFIED from Caltrans.

## E1. Naval Air Station North Island and Naval Base Coronado

| Item | Figure or fact | Quote | Source | Status |
|---|---|---|---|---|
| What Naval Base Coronado is | One command over eight sites, including NAS North Island, Naval Amphibious Base Coronado, the Silver Strand Training Complex and the Imperial Beach helicopter field | "In 1997, Naval Base Coronado was created, incorporating eight separate naval installations under one commanding officer. Those facilities include: Naval Air Station North Island (NASNI); Naval Amphibious Base Coronado (NAB); Naval Outlying Landing Field Imperial Beach (NOLFIB); Naval Auxiliary Landing Field San Clemente Island (NALFSCI); Silver Strand Training Complex (SSTC) ..." | Wikipedia, "Naval Base Coronado". https://en.wikipedia.org/wiki/Naval_Base_Coronado | SECONDARY |
| North Island location | North end of the Coronado peninsula, on San Diego Bay, 2 NM south-west of the airline airport | "located at the north end of the Coronado peninsula on San Diego Bay"; AirNav lists "KNZY - North Island Naval Air Station (Halsey Field) Airport (2 nm SW)" of KSAN | Wikipedia, "Naval Air Station North Island", https://en.wikipedia.org/wiki/Naval_Air_Station_North_Island ; AirNav KSAN | SECONDARY; VERIFIED (distance) |
| Runways | 18/36, 8,001 x 200 ft (heading 184/004 magnetic); 11/29, 7,501 x 200 ft (111/291 magnetic); field elevation 26 ft; arresting gear on both | "Runway 18/36 Dimensions: 8001 x 200 ft. / 2439 x 61 m"; "Runway 11/29 Dimensions: 7501 x 200 ft. / 2286 x 61 m"; "Elevation: 26 ft. / 7.9 m (surveyed)"; "HOOK E28(B)" | AirNav KNZY, FAA information effective 29 Oct 2026. https://www.airnav.com/airport/KNZY | VERIFIED |
| Aircraft on the field | Over 230 aircraft, 23 squadrons | "NAS North Island itself is host to 23 aviation squadrons and 80 additional tenant commands" and "Its airfield has over 230 stationed aircraft" | Wikipedia, NAS North Island | SECONDARY |
| Carrier berths | A quay wall on the bay side with room for three carriers (a 2015 photo shows three alongside) | "its quay wall is homeport to three aircraft carriers"; caption "Three US Navy Nimitz-class aircraft carriers ... pierside at NAS North Island during June 2015" | Same | SECONDARY. A count of berths from an official source was NOT FOUND |
| **Carriers homeported there now (Nov 2026)** | USS Carl Vinson (CVN 70) and USS Theodore Roosevelt (CVN 71). USS Abraham Lincoln (CVN 72) returned on 8 Oct 2026 and is leaving for Washington State by the end of 2026. Roosevelt has been deployed since late September 2026, so in mid-November the quay most likely shows two carriers (Vinson and Lincoln) | "The Navy is shifting the homeport of the Nimitz-class carrier USS Abraham Lincoln from Naval Air Station North Island in San Diego to Naval Base Kitsap near Seattle, the service said Monday. The homeport move will occur by the end of 2026" ; "The Roosevelt ... completed the journey from San Diego in 19 days" (arrived Yokosuka 16 Oct 2026) | Stars and Stripes, 19 Oct 2026, https://www.stripes.com/branches/navy/2026-10-19/uss-abraham-lincoln-homeport-kitsap-23199798.html ; The War Zone, 17 Oct 2026, https://www.twz.com/sea/where-are-the-aircraft-carriers-october-17-2026 ; Wikipedia list "USS Carl Vinson (CVN-70) USS Theodore Roosevelt (CVN-71) USS Abraham Lincoln (CVN-72)" | SECONDARY. Carl Vinson's status rests on Wikipedia only; no 2026 report on it was opened |
| Helicopter squadrons | Seven Helicopter Sea Combat squadrons flying the MH-60S (HSC-3, 4, 6, 8, 14, 21, 23) and seven Helicopter Maritime Strike squadrons flying the MH-60R (HSM-35, 41, 49, 71, 73, 75, 78) | Squadron table rows "HSC-3 Merlins ... Fleet Replacement Squadron", "HSC-4 Black Knights ... USS Carl Vinson (CVN-70)", "HSM-71 Raptors", "HSM-78 Blue Hawks"; aircraft columns "MH-60S Seahawk \| MH-60R Seahawk \| C-40A Clipper \| CMV-22B (V22)" | Wikipedia, NAS North Island | SECONDARY |
| Tilt-rotor squadrons | VRM-30 "Titans" and VRM-50 "Sunhawks" (training) with the CMV-22B; VR-57 with the C-40A (a 737) | "Fleet Logistics Multi-Mission Squadron 30 \| VRM-30 Titans"; "VRM-50 Sunhawks ... Fleet Replacement Squadron"; "VR-57 Conquistadors" | Same | SECONDARY |
| No hovering Ospreys on the runways | Vertical take-off and landing by V-22s and F-35Bs is banned there except in emergencies | "RSTD: MV-22, CMV-22, F-35B ACFT VTOL OPS FROM ANY RWY, TWY OR HELIPAD ARE PROHIBITED, EXC WHEN AN EMERG SITUATION DICTATES." | AirNav KNZY remarks (FAA data) | VERIFIED. So Ospreys should make rolling or short landings on the runway, not hover |
| Helicopter traffic over the bay | Heavy, low: surface to 500 ft around the field, surface to 2,000 ft in an area 8 NM to the south-east | "CAUTION: EXTV VFR COPTER OPR SFC-500' VCNTY ARPT AND SFC-2000' 8 NM SE." | Same | VERIFIED |
| Visiting jets | Full-stop landings only; lights on below 10,000 ft | "TFC PAT: USE MAX EXTERIOR LGT BLW 10,000' WITHIN 10 NM. ALL TRAN ACFT LTD TO FULL STOP ONLY. TOUCH-AND-GO/LO APCH NOT AVBL." | Same | VERIFIED |
| Field hours | Closed overnight at weekends | "CLSD 0600-1600Z++ SAT-SUN, 0600-1430Z++ MON" (10 or 11 p.m. to 8 or 9 a.m. local) | Same | VERIFIED |
| Imperial Beach helicopter field (11 NM south of the airline airport) | Runway 9/27 4,998 x 336 ft and a helicopter-only strip 8/26 2,241 x 151 ft; elevation 23 ft | "Runway 9/27 Dimensions: 4998 x 336 ft."; "RWY 08-26 AVBL FOR DAY AND NGT COPTER USE ONLY"; "CAUTION: EXTV COPTER TRNG." | AirNav KNRS. https://www.airnav.com/airport/KNRS | VERIFIED |
| Published flight tracks and pattern altitudes (the Navy's noise study for North Island) | Not opened; Navy sites refused the fetch | n/a | n/a | NOT FOUND |
| SEAL base | Naval Amphibious Base Coronado on the Silver Strand, bay side and ocean side; about 1,000 acres; home of Naval Special Warfare Command, the training centre and SEAL Team One among others | "situated on Silver Strand between San Diego Bay and the Pacific Ocean"; "NAB is approximately 1,000 acres (4 km2) in size and is composed of the Main Base, training beaches, California least tern preserve, recreational marina"; "Commander Naval Special Warfare (SPECWAR) Command" | Wikipedia, "Naval Amphibious Base Coronado". https://en.wikipedia.org/wiki/Naval_Amphibious_Base_Coronado | SECONDARY |
| Traffic past the SEAL base | 20,300 to 21,300 vehicles a day on SR-75 at the base gate | "075 SD 17.61 CORONADO, GATE 3, ENTRANCE TO NAVAL AMPHIBIOUS ... 20300 ... 21300" | Caltrans "2024 AADT DATA" | VERIFIED (data) |

## E2. Naval Base San Diego (32nd Street)

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Size | 13 piers; about 1,600 acres of land and 326 of water; on the east shore of the bay south of the Coronado Bridge | "The base is composed of 13 piers stretched over 1,600 acres (650 ha) of land and 326 acres (132 ha) of water." | Wikipedia, "Naval Base San Diego". https://en.wikipedia.org/wiki/Naval_Base_San_Diego | SECONDARY |
| Ships | "Over 50"; about 54 | "the principal homeport of the United States Pacific Fleet, consisting of over 50 ships"; "home port to approximately 54 ships, including 46 U.S. Navy ships, two Littoral Combat Ships, two U.S. Coast Guard cutters, and eight ships of the Military Sealift Command" | Same | SECONDARY |
| Which classes (list "As of August 2025") | 18 Arleigh Burke destroyers (DDG-54 to DDG-125); 3 Zumwalt destroyers (DDG-1000 to 1002); 4 Ticonderoga cruisers (CG-59, 65, 70, 71); 3 Wasp-class assault ships (LHD-2, 4, 8); 5 San Antonio-class transport docks (LPD-20, 23, 25, 26, 27); 5 dock landing ships (LSD-42, 45, 48, 49, 52); 18 Littoral Combat Ships (LCS-3, and the even numbers LCS-6 to LCS-38) | Section "Homeported ships" lists, for example, "USS Essex (LHD-2) USS Boxer (LHD-4) USS Makin Island (LHD-8)", "USS Zumwalt (DDG-1000)", "USS Jackson (LCS-6) ... USS Pierre (LCS-38)" | Same | SECONDARY. My count of the list. No America-class ship is on that list (Makin Island, LHD-8, is the closest in appearance) |
| People | About 26,000 work there | "The base is a workplace for approximately 26,000 military, civilian, and contract personnel." | Same | SECONDARY |

## E3. Ship dimensions

| Class | Length | Beam | Other | Quote | Source | Status |
|---|---|---|---|---|---|---|
| Nimitz-class carrier | 1,092 ft overall (1,040 ft at the waterline) | 252 ft across the flight deck; 134 ft at the waterline | Draft 37 ft; flight deck angled 9 degrees; four catapults; 85 to 90 aircraft | "Length Overall: 1,092 ft (332.8 m) Waterline: 1,040 ft (317.0 m)"; "Beam Overall: 252 ft (76.8 m) Waterline: 134 ft (40.8 m)"; "The flight deck is angled at nine degrees" | Wikipedia, "Nimitz-class aircraft carrier". https://en.wikipedia.org/wiki/Nimitz-class_aircraft_carrier | SECONDARY |
| Arleigh Burke destroyer | 505 ft (Flights I and II); 509.5 ft (Flights IIA and III) | 66 ft | Draft 31 ft | "Flights I & II: 505 ft (154 m) Flights IIA & III: 509.5 ft (155.3 m)"; "Beam 66 ft (20 m)" | https://en.wikipedia.org/wiki/Arleigh_Burke-class_destroyer | SECONDARY |
| America-class assault ship | 844 ft | 106 ft | 44,971 long tons full load; flat full-length flight deck, island to starboard | "Length 844 ft (257 m)"; "Beam 106 ft (32 m)" | https://en.wikipedia.org/wiki/America-class_amphibious_assault_ship | SECONDARY |
| Littoral Combat Ship, Independence class (the type based in San Diego) | 418 ft | 104 ft | Trimaran hull; draft 14 ft; 44 knots | "Length 418 ft (127 m)"; "Beam 104 ft (32 m)"; "Draft 14 ft (4.3 m)" | https://en.wikipedia.org/wiki/Independence-class_littoral_combat_ship | SECONDARY |
| Flight deck height above the water, island height, mast height | NOT FOUND in the pages opened | | | | | NOT FOUND |
| Hull number style and colour | Numbers as in the lists above (CVN 70, DDG 54, LHD 8, LCS 6). Paint colour (haze grey) and number placement were not confirmed in an opened source | | | | | NOT FOUND |

## E4. Naval aircraft dimensions

| Aircraft | Length | Rotor or span | Height | Other | Source | Status |
|---|---|---|---|---|---|---|
| MH-60R / MH-60S Seahawk | 64 ft 8 in | Main rotor 53 ft 8 in | 17 ft 2 in | Max take-off 21,884 lb; max speed 146 knots | Wikipedia, "Sikorsky SH-60 Seahawk" specifications: "Length: 64 ft 8 in (19.71 m) Height: 17 ft 2 in (5.23 m) ... Main rotor diameter: 53 ft 8 in (16.36 m)". https://en.wikipedia.org/wiki/Sikorsky_SH-60_Seahawk | SECONDARY |
| CMV-22B Osprey | 57 ft 4 in fuselage (FAA lists 63 ft overall) | Wing 45 ft 10 in; 84 ft 7 in across both rotors; each rotor 38 ft 1 in | 22 ft 1 in with nacelles vertical | Max take-off 60,500 lb (FAA) | FAA Aircraft Characteristics Database row "V22 \| Bell V-22 Osprey \| ... 45.8 \| ... 63 \| 22.1 \| 60500 \| ... 38.1" (URL in B1); Wikipedia "Bell Boeing V-22 Osprey": "Width: 84 ft 6.8 in (25.776 m) including rotors"; "Main rotor diameter: 2 × 38 ft 1 in (11.61 m)" | VERIFIED (data) for the FAA row; SECONDARY for the rest |
| F/A-18E Super Hornet | 60.1 ft | Wingspan 44.7 ft | 16 ft | Approach speed 134 knots; max take-off 66,000 lb | FAA database row "F18S \| FA-18E/F Super Hornet \| 134 \| 44.7 \| ... 60.1 \| 16 \| 66000" | VERIFIED (data) |

## E5. The San Diego-Coronado Bridge and the Hotel del Coronado

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Length | 11,179 ft (2.1 miles) including approaches | "Total length 11,179 feet (3,407 m) or 2.1 miles (3.4 km) (including approaches)" | Wikipedia, "San Diego–Coronado Bridge". https://en.wikipedia.org/wiki/San_Diego%E2%80%93Coronado_Bridge | SECONDARY |
| Clearance | 200 ft, set by the Navy so its ships could pass | "the Navy supported a bridge if there was at least 200 feet (61 m) of clearance for ships which operate out of the nearby Naval Base San Diego" | Same | SECONDARY |
| Shape | Rises from Coronado at 4.67 per cent, then curves 80 degrees towards San Diego; 27 concrete girders on tall piers | "ascends from Coronado at a 4.67 percent grade before curving 80 degrees toward San Diego. It is supported by 27 concrete girders" | Same | SECONDARY |
| Lanes | Five: two each way and a reversible middle lane behind a movable barrier; 63 ft kerb to kerb | "The bridge contains five lanes: two eastbound, two westbound, and a reversible middle lane with a barrier transfer machine system installed in 1993"; "Width 63 feet (19 m) between curbs" | Same; HPMS 2024 also codes `through_lanes` 5 on the bridge | SECONDARY; VERIFIED (data) for the lane count |
| Traffic | 76,000 vehicles a day (2024); peak hour 6,700 to 7,300; trucks 2.8 per cent | "075 SD R20.284 CORONADO, TOLL GATES, BEGIN FREEWAY ... 7300 ... 76000 ... 6700 ... 76000"; truck row "075 SD R22.261 leg B JCT. RTE. 5 ... 76000 ... 2128 ... 2.8" | Caltrans 2024 workbooks | VERIFIED (data) |
| Opened | 3 August 1969 | "Opened August 3, 1969" | Wikipedia | SECONDARY |
| Colour (blue) | Not stated in the page opened | n/a | n/a | NOT FOUND |
| Under the east end | Chicano Park murals on the piers | "The pillars supporting the bridge on the eastern end are painted with huge murals as part of Chicano Park" | Wikipedia | SECONDARY |
| Hotel del Coronado | Wooden Victorian beach resort on the ocean side of Coronado; opened 19 February 1888; 757 rooms; 120 ft high | "A rare surviving example of an American architectural genre—the wooden Victorian beach resort"; "Opening February 19, 1888"; "Number of rooms 757"; "Height 120 Ft (36.6 M) Architecturally" | Wikipedia, "Hotel del Coronado". https://en.wikipedia.org/wiki/Hotel_del_Coronado | SECONDARY. Roof colour and turret shape were not confirmed in text |

## E6. San Diego freeway volumes

Caltrans "2024 AADT DATA" (VERIFIED (data)); lanes from FHWA HPMS 2024 `through_lanes`, both directions; trucks from Caltrans "Truck AADTs 2024". Hour-by-hour speeds are in C3.

| Segment | AADT 2024 | Peak-hour volume, both directions | Through lanes | Trucks | Row quoted |
|---|---|---|---|---|---|
| **I-5** at SR-75 (the Coronado Bridge junction, Barrio Logan) | 325,000 to 330,000 | 25,500 | 8 to 10 | 4 to 5 per cent at I-15 | "005 SD R14.077 SAN DIEGO, JCT. RTE. 75 SOUTH ... 25500 ... 325000 ... 25500 ... 330000" |
| I-5 at I-15 | 230,000 to 295,000 | 17,400 to 18,800 | n/a | 4.1 to 5.0 | "005 SD R12.647 JCT. RTE. 15 NORTH ... 230000 ... 295000" |
| **I-8** at El Cajon Blvd (La Mesa) | 260,000 | 19,000 | n/a | n/a | "008 SD 13.658 EL CAJON, EL CAJON BOULEVARD ... 19000 ... 260000" |
| I-8 Mission Valley at SR-163 | 162,500 to 182,500 | n/a | 8 | 2.7 to 2.8 | truck rows "008 SD 2.41 ... 162500 ... 2.7" and "182500 ... 2.8" |
| **I-15** at Miramar Way | 275,000 to 290,000 | 23,800 to 24,800 | not found by the query | 2 to 5 | "015 SD M13.334 SAN DIEGO, MIRAMAR WAY ... 24800 ... 275000 ... 23800 ... 290000" |
| **SR-163** at Friars Rd / Genesee | 145,000 to 177,500 | 11,400 to 21,300 | 8 to 10 | 3.0 to 3.7 | "163 SD 4.371 FRIARS ROAD ... 145000 ... 177500" |
| SR-163 through Balboa Park (Cabrillo Fwy) | 105,000 to 110,000 | n/a | 4 | n/a | HPMS rows "through_lanes 4 ... aadt 107500" |
| I-805 at Market St / Imperial Ave | 280,000 to 305,000 | 20,500 to 22,600 | n/a | n/a | "805 SD 12.953 SAN DIEGO, MARKET STREET ... 22600 ... 305000" |

San Diego peaks are sharper than Los Angeles ones (Caltrans 2024 peak hours report, VERIFIED (data)): I-5 at postmile R11.129, evening southbound 14,268 veh/h, K 9.2, D 72; I-8 at postmile 5.638, morning westbound 10,516, K 8.1, D 67; SR-163 at postmile 4.371, evening northbound 12,680, K 9.3, D 77. So the busiest hour carries 8 to 10 per cent of the day and two thirds to three quarters of it runs one way.

## E7. The airliner approach over Bankers Hill

| Item | Finding | Quote | Source | Status |
|---|---|---|---|---|
| Neighbourhood under short final to runway 27 | Bankers Hill, with downtown towers close by | "The airport's landing approach is close to the skyscrapers of downtown San Diego, and can sometimes prove difficult to pilots due to the relatively short usable landing area, steep descent angle over the crest of Bankers Hill, and shifting wind currents just before landing." | Wikipedia, "San Diego International Airport". https://en.wikipedia.org/wiki/San_Diego_International_Airport | SECONDARY |
| Why it is steep | Buildings over 200 ft within 2 miles of the threshold; no ILS on 27 | "The approach to Runway 27 is unusually steep due to utility poles and over 200-foot-tall (61 m) buildings within 2 miles (3.2 km; 1.7 nmi) of the runway threshold." and "Runway 27 lacks an instrument landing system (as the steep terrain on approach makes such a system infeasible)" | Same | SECONDARY (agrees with the FAA data in B6: 3.50 degree path, 1,810 ft displaced threshold, "TERRAIN & BLDGS TO 500' MSL N & E WITHIN 1 1/2 MI") |
| Status of the airport | Busiest single-runway airport in the United States | "It is the busiest single-runway airport in the United States" | Same | SECONDARY |

---

# F. Landmark bridges: the numbers needed to draw each

Traffic on each bridge is in D1 (Golden Gate, Bay Bridge), C1 (Vincent Thomas) and E5 (Coronado).

## F1. Golden Gate Bridge

Source for every row unless noted: Golden Gate Bridge, Highway and Transportation District, "Design & Construction Stats", https://www.goldengate.org/bridge/history-research/statistics-data/design-construction-stats/ . Status VERIFIED.

| Item | Figure | Quote |
|---|---|---|
| Type | Suspension bridge, two towers, two main cables | "The Golden Gate Bridge has two main towers that support the two main cables." |
| Tower height | 746 ft above the water; 500 ft above the roadway | "The height of a tower above water is 746 ft (227 m)." and "The height of a tower above roadway is 500 ft (152 m)." |
| Roadway height at the towers | About 246 ft above the water | 746 minus 500 (DERIVED) |
| Clearance under the deck | 220 ft | "Clearance above mean higher high water is 220 ft (67 m)." |
| Main span | 4,200 ft between the towers | "Length of main span portion of suspended structure (distance between towers) is 4,200 ft (1,280 m)." |
| Side spans | 1,125 ft each; suspended length 6,450 ft in all | "Length of one side span is 1,125 ft (343 m)."; "Length of suspension span including main span and side spans is 1.2 miles (6,450 ft or 1,966 m)." |
| Total length | 8,981 ft (1.7 miles) abutment to abutment | "Total length of Bridge including approaches from abutment to abutment is 1.7 miles (8,981 ft or 2,737 m)." |
| Width | 90 ft overall; roadway 62 ft kerb to kerb; sidewalks 10 ft | "Width of Bridge is 90 ft (27 m)."; "Width of roadway between curbs is 62 ft (19 m)."; "Width of sidewalk is 10 ft (3 m)." |
| Tower legs | Each leg 33 by 54 ft at the base | "Tower base dimension (each leg) is 33 ft x 54 ft (10 m x 16 m)." |
| Main cables | 36 3/8 in thick, 7,650 ft long | "Diameter of one main cable including the exterior wrapping is 36 3/8 in (0.92 m)."; "Length of one main cable is 7,650 ft (2,332 m)." |
| Suspender ropes | 250 pairs, 50 ft apart | "The Golden Gate Bridge has 250 pairs of vertical suspender ropes that are spaced 50 feet apart across both sides of the Bridge." |
| How far it moves | Deck can deflect 10.8 ft down, 5.8 ft up, 27.7 ft sideways | "the maximum downward deflection ... is 10.8 ft (3.3. m). The maximum upward deflection is 5.8 ft (1.8 m)."; "The maximum transverse deflection, at center span is 27.7 ft (8.4 m)." |
| Colour | "International Orange": CMYK 0, 69, 100, 6 (about RGB 240, 74, 0 or #F04A00) | "CMYK colors are: C= Cyan: 0%, M =Magenta: 69%, Y =Yellow: 100%, K = Black: 6%." and "The closest off-the-shelf paint color that Sherwin Williams has available is "Fireweed" (color code SW 6328)." https://www.goldengate.org/bridge/history-research/bridge-features/color-art-deco-styling/ (RGB is DERIVED) |
| Lanes | Six, with a movable barrier (see D1) | "The Bridge is a fixed, six-lane roadway" |

## F2. San Francisco-Oakland Bay Bridge

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Overall | Two bridges joined by a tunnel through Yerba Buena Island; 8.4 miles with approaches; five lanes each way | "The San Francisco-Oakland Bay Bridge is made up of two bridge segments: a skyway structure/single anchored suspension bridge between Oakland and Yerba Buena Island, and a suspension span from the island to San Francisco. Connecting the two is the largest diameter bore tunnel in the world."; "Length: 8.4 miles (including approaches and toll plaza)"; "Traffic Lanes: Five lanes in each direction" | MTC. https://mtc.ca.gov/operations/programs-projects/bridges/san-francisco-oakland-bay-bridge | VERIFIED |
| Clearance | 220 ft (west span) | "Vertical Clearance: 220 feet" | Same | VERIFIED |
| **West span** (San Francisco to the island) | Two suspension bridges end to end, sharing a concrete centre anchorage: four towers; two main spans of 2,310 ft; 10,304 ft long; double deck (westbound above, eastbound below); towers 526 ft | "Double-decked suspension spans (two, connected by center anchorage)"; "West: two main spans 2,310 ft (704 m)"; "West: 10,304 ft (3,141 m)"; "Height West: 526 ft (160 m)" | Wikipedia. https://en.wikipedia.org/wiki/San_Francisco%E2%80%93Oakland_Bay_Bridge | SECONDARY |
| West span deck | Five lanes, 57.5 ft wide per deck | "West: 5 traffic lanes totaling 57.5 ft (17.5 m)" | Same | SECONDARY |
| West span colour | Grey | Reference title "Long-Overshadowed Bay Bridge Will Go From Drab Gray to Glowing" (New York Times, 2013) | Same (citation list) | SECONDARY (weak) |
| Tunnel | 76 ft wide, 58 ft high, 540 ft long, double deck | "The tunnel is 76 feet (23 m) wide, 58 feet (18 m) high, and 540 feet (160 m) long." | Same | SECONDARY |
| **East span** (island to Oakland), opened 2 Sept 2013 | Single-tower self-anchored suspension span of 2,047 ft with a 525 ft tower set towards its west end, then a 1.2 mile concrete skyway descending to Oakland; two side-by-side decks, 258.33 ft wide in all; painted white | "the world's longest self-anchored suspension span bridge (2,047 feet) and also the widest bridge in the world, with a total deck width of 258.33 feet"; "a single steel tower and a 1.2-mile-long elevated Skyway viaduct that descends gradually towards the Oakland shoreline"; "The span's single 525-foot-tall tower is closer to the west end"; "The entire suspension span is painted "Bay Bridge White" to match the container cranes in the Port of Oakland."; "the new span is made up of side-by-side bridges" | MTC / Caltrans / Bay Area Toll Authority fact sheet on the new East Span. https://files.mtc.ca.gov/library/pub/non/47654_26.pdf | VERIFIED |
| East span cable | One main cable nearly a mile long, looped under the deck ends; 200 suspender ropes | "A main cable that is nearly 1–mile long"; AP: "200 steel suspender ropes" and "The main tower is 525-feet high and comprised of four legs" | MTC fact sheet; AP via CBS, https://www.cbsnews.com/sacramento/news/specifications-of-new-sf-oakland-bay-bridge/ | VERIFIED |
| East span main opening | 1,400 ft channel span (Wikipedia gives the longest span as 1,400 ft and clearance 190 ft) | "Channel Span: 1,400 feet" (MTC); "East: 190 feet (58 m)" clearance (Wikipedia) | MTC; Wikipedia | VERIFIED; SECONDARY |

## F3. Vincent Thomas Bridge (Los Angeles Harbor, SR-47)

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Type and span | Suspension bridge, main span 1,500 ft, total 6,060 ft | "Design Suspension bridge"; "Longest span 1,500 feet (457 m)"; "Total length 6,060 feet (1,847 m)" | Wikipedia, "Vincent Thomas Bridge". https://en.wikipedia.org/wiki/Vincent_Thomas_Bridge | SECONDARY |
| Towers and clearance | Towers 365 ft; about 185 ft clear over the channel | "Height 365 feet (111 m)"; "Approximately 185 feet (56 m)" | Same | SECONDARY |
| Deck | Four lanes, 52 ft wide | "Carries 4 lanes of SR 47"; "Width 52 feet (16 m) (typical)" | Same; HPMS 2024 `through_lanes` 4 | SECONDARY; VERIFIED (data) for lanes |
| Opened; lights | 15 November 1963; 160 blue LED lamps on the cables since 2005 | "Opened November 15, 1963"; "the decorative illumination was changed to 160 blue LED lamps" | Same | SECONDARY |
| Traffic | 63,000 a day (2024) | "047 LA 2.302 LOS ANGELES, VINCENT THOMAS BRIDGE ... 3900 ... 63000" | Caltrans "2024 AADT DATA" | VERIFIED (data). Wikipedia's "32,000" is out of date |
| Colour (green) | Not stated in the text opened | n/a | n/a | NOT FOUND |

## F4. Richmond-San Rafael Bridge (I-580)

| Item | Figure | Quote | Source | Status |
|---|---|---|---|---|
| Type | Double-deck cantilever and truss, with two humps over two ship channels | "Structure: Cantilever and truss" | MTC. https://mtc.ca.gov/operations/programs-projects/bridges/richmond-san-rafael-bridge | VERIFIED (the two humps are not described on the page) |
| Length | 5.5 miles with approaches | "Length: 5.5 miles (including approaches)" | Same | VERIFIED |
| Main span, clearance, tower | 1,070 ft channel span; 185 ft clearance; towers 325 ft | "Vertical Clearance: 185 feet"; "Channel Span: 1,070 feet"; "Tower Height: 325 feet" | Same | VERIFIED |
| Lanes and toll | Two each way; toll westbound only, in Richmond; $8.50 | "Traffic Lanes: Two lanes in each direction"; "Collection: One way, westbound in Richmond" | Same | VERIFIED |
| Opened | September 1956 | "Opened: September 1956" | Same | VERIFIED |
| Traffic | 76,000 a day (2024) | "580 MRN 2.477 SAN RAFAEL, WEST END RICHMOND-SAN RAFAEL BRIDGE ... 76000" | Caltrans "2024 AADT DATA" | VERIFIED (data) |

## F5. San Diego-Coronado Bridge

See E5: 11,179 ft long, 200 ft clearance, five lanes, an 80 degree curve, 4.67 per cent climb from Coronado (SECONDARY, Wikipedia); 76,000 vehicles a day (VERIFIED, Caltrans).

---

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
