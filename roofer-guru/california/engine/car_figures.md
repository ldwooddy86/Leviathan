# BMW M3 Competition (G80): published figures used by car_physics.js

Compiled 2026-11-19. "Opened" means I fetched the page or file myself in this session and read the figure in it.
"Not opened" means the site refused my fetch tool and the figure reached me only second hand (named each time).
Every figure below sits in the one `SPEC` object in `car_physics.js`; figures that are not published are listed
under `SPEC.assumed` and in section 6 here.

The car modelled is the current (2024 facelift, model year 2025 on) M3 Competition with M xDrive, with a SPEC switch
to rear drive. The rear-drive M3 Competition's own published figures are kept beside it (`SPEC.rwdCar`) because most
magazine tests with a full set of numbers are of that car.

## 0. The one figure fixed by the user

| Figure | Value | Source |
|---|---|---|
| Top speed | 251 mph (112.21 m/s) | The user's brief. Not a BMW figure: BMW limits the car to 155 mph (250 km/h), or 180 mph (290 km/h) with the M Driver's Package (sources S1, S2, S3). The model reaches 251 mph by raising engine power, see section 6. |

## 1. Sources

| Id | Source | URL | Opened? |
|---|---|---|---|
| S1 | BMW Media Information, "Specifications. BMW M3 Sedan. M3 Competition with M xDrive", 05/2021 (2-page PDF technical data sheet) | https://newsroom.bmwgroup.com/emea/download/4c301087-5bb6-441d-8da1-9f2058ca5c19/20260908113927989-330.pdf (linked from https://newsroom.bmwgroup.com/emea/es/los-nuevos-bmw-m3-competition-y-bmw-m4-competition-coupe-con-traccion-m-xdrive) | Yes (PDF text extracted and read in full) |
| S2 | BMW of North America press release, "The New 2022 BMW M3 Competition xDrive and M4 Competition xDrive", 18 April 2021, with specification table | https://newsroom.bmwgroup.com/americas/download/5c120393-bb1b-4ec4-8785-8d41e50a4f6f/20260728141746562-334.pdf (page: https://newsroom.bmwgroup.com/americas/the-new-2022-bmw-m3-competition-xdrive-sedan-and-m4-competition-xdrive-coupe) | Yes (PDF text extracted and read in full) |
| S3 | BMW of North America press release, "The new 2021 BMW M3 Sedan and M4 Coupe" (rear-drive cars, specification table) | https://newsroom.bmwgroup.com/americas/the-new-2021-bmw-m3-sedan-and-m4-coupe | Yes (page fetched; read through the fetch tool's extraction, first 100,000 characters) |
| S4 | auto-data.net, BMW M3 (G80 LCI, facelift 2024) Competition 3.0 (530 Hp) M xDrive M Steptronic | https://www.auto-data.net/en/bmw-m3-g80-lci-facelift-2024-competition-3.0-530hp-m-xdrive-m-steptronic-51870 | Yes |
| S5 | auto-data.net, BMW M3 (G80) Competition 3.0 (510 Hp) M xDrive M Steptronic | https://www.auto-data.net/en/bmw-m3-g80-competition-3.0-510hp-m-xdrive-m-steptronic-43388 | Yes |
| S6 | auto-data.net, BMW M3 (G80) Competition 3.0 (510 Hp) Steptronic (rear drive) | https://www.auto-data.net/en/bmw-m3-g80-competition-3.0-510hp-steptronic-41302 | Yes |
| S7 | auto motor und sport, BMW M3 Competition, Technische Daten | https://www.auto-motor-und-sport.de/test/kosten-realverbrauch-bmw-m3-competition/technische-daten/ | Yes |
| S8 | Wikipedia, "BMW M3" (G80 section) | https://en.wikipedia.org/wiki/BMW_M3 | Yes |
| S9 | Wikipedia, "ZF 8HP transmission" (gear ratio table) | https://en.wikipedia.org/wiki/ZF_8HP_transmission | Yes |
| S10 | BimmerLife, "G80 M3 Comp Test Reveals Exceptional Performance", 14 Aug 2021 (reports Car and Driver's test of the rear-drive 2021 M3 Competition) | https://bimmerlife.com/2021/08/14/g80-m3-competition-testing-reveals-exceptional-performance/ | Yes (secondary report; Car and Driver itself not opened) |
| S11 | BimmerLife, "BMW G80 M3 Competition xDrive Among Fastest New Cars", 15 Jan 2022 (reports MotorTrend's figures) | https://bimmerlife.com/2022/01/15/bmw-g80-m3-competition-xdrive-among-fastest-new-cars/ | Yes (secondary report; MotorTrend itself not opened) |
| S12 | 0-60specs.com, BMW M3 0-60 times (aggregator table naming Car and Driver, MotorTrend, MotorWeek) | https://www.0-60specs.com/bmw-m3-0-60-times/ | Yes (aggregator) |
| S13 | BMW Blog, "2025 BMW M3 pricing, specs, features", 5 Nov 2024 (quotes Car and Driver's xDrive test) | https://www.bmwblog.com/2024/11/05/2025-bmw-m3-pricing-specs-features/ | Yes (secondary report) |
| S14 | The Citizen (South Africa), road test data sheet "M3data.pdf", test date 14 April 2021 (rear-drive M3 Competition) | https://media.citizen.co.za/wp-content/uploads/2021/04/M3data.pdf | Yes (PDF text extracted and read in full) |
| S15 | Edmunds, "2025 BMW M3 Competition xDrive: Track Tested" | https://www.edmunds.com/car-news/2025-bmw-m3-competition-xdrive-track-tested.html | No. HTTP 403 to my fetch tool. Figures seen only in two web-search result summaries of that page. |
| S16 | Car and Driver road tests of the G80 M3 | caranddriver.com | No. The domain is blocked to my tools. Figures come from S10, S12, S13. |
| S17 | MotorTrend road tests of the G80 M3 | motortrend.com | No. The domain is blocked to my tools. Figures come from S11, S12. |
| S18 | BMW Blog, "BMW M3 0-60 mph", 5 Apr 2023 | https://www.bmwblog.com/2023/04/05/bmw-m3-0-60-mph | Yes (secondary report) |

## 2. Body, weights, tyres (M3 Competition with M xDrive unless marked)

| Figure | Value | Source | Opened? |
|---|---|---|---|
| Length | 4794 mm | S1 (also S4, S5, S7). S2 and S3 give 189.1 in (4803 mm) for the US car | Yes |
| Width | 1903 mm (2068 mm with mirrors, S6) | S1. S2 and S3 give 74.3 in (1887 mm) for the US car | Yes |
| Height | 1434 mm (xDrive, unladen). Rear-drive car 1433 mm (S6); the 2024 facelift page gives 1438 mm (S4) | S1 | Yes |
| Wheelbase | 2857 mm | S1 (also S2: 112.5 in) | Yes |
| Track, front / rear | 1617 / 1605 mm | S1 (also S2: 63.7 / 63.2 in) | Yes |
| Ground clearance | 122 mm | S1 | Yes |
| Turning circle | 12.6 m (xDrive); 12.2 m rear drive (S6) | S1 | Yes |
| Kerb weight, xDrive | 1780 kg DIN, 1855 kg EU (EU adds 75 kg for driver and luggage); US curb weight 3,990 lb (1810 kg) | S1; S2 | Yes |
| Kerb weight, rear drive | 1730 kg DIN (S6, S8); US curb weight 3,890 lb (1764 kg) (S3) | S6, S8, S3 | Yes |
| Front / rear weight split, rear drive | 53.1 % / 46.9 % | S3 | Yes |
| Front / rear weight split, xDrive | Not published: the BMW sheet says "tbd" (S2). Assumed 54.0 / 46.0, see section 6 | S2 | Yes |
| Max permissible weight, max axle loads | 2260 kg; 1125 / 1200 kg | S1 | Yes |
| Tyres, xDrive (and optional on the rear-drive car) | front 275/35 ZR19 100Y XL on 9.5J x 19; rear 285/30 ZR20 99Y XL on 10.5J x 20 | S1, S2 | Yes |
| Tyres, rear-drive standard | front 275/40 ZR18 on 9.5 x 18; rear 285/35 ZR19 on 10.5 x 19 | S3, S6 | Yes |
| Brake discs (M Compound, standard) | 380 mm front (six-piston fixed callipers), 370 mm rear (single-piston floating) | S3 (sizes), S1 (calliper types) | Yes |
| Steering | Electromechanical rack and pinion, overall ratio 14.6:1 (xDrive); 15.0:1 (rear drive) | S1, S2; S3 | Yes |

## 3. Engine and driveline

| Figure | Value | Source | Opened? |
|---|---|---|---|
| Engine | S58B30T0, 2993 cm3 in-line six, two mono-scroll turbochargers, bore x stroke 84.0 x 90.0 mm, compression 9.3:1 | S1, S2 | Yes |
| Power, current xDrive car (2024 facelift on) | 390 kW (530 PS, 523 hp) at 6250 rpm | S4 (530 Hp at 6250 rpm), S8 (390 kW; 530 PS; 523 hp), S13 (523 horsepower) | Yes |
| Torque, current xDrive car | 650 Nm (479 lb-ft) at 2750 to 5730 rpm | S4 | Yes |
| Power, 2021 to 2024 cars and the current rear-drive car | 375 kW (510 PS, 503 hp) at 6250 rpm | S1, S2, S3 | Yes |
| Torque, 2021 to 2024 cars and the current rear-drive car | 650 Nm (479 lb-ft) at 2750 to 5500 rpm | S1, S2, S3 | Yes |
| Rev limit | 7200 rpm ("Both core and Competition models rev to a redline of 7,200 rpm") | S3 | Yes |
| Gearbox | Eight-speed M Steptronic with Drivelogic (ZF 8HP76, BMW code M8HP76) | S1, S2 | Yes |
| Gear ratios 1 to 8 | 5.000, 3.200, 2.143, 1.720, 1.313, 1.000, 0.823, 0.640 | S1 (three decimals); S2, S3, S7 (two decimals); S9 gives the 8HP 76/I set 5.0000, 3.2000, 2.1429, 1.7200, 1.3131, 1.0000, 0.8226, 0.6400 | Yes |
| Reverse ratio | 3.478 | S1 (S2: 3.48; S9: 3.4783) | Yes |
| Final drive | 3.154 | S1 (S2, S3, S7: 3.15) | Yes |
| Drive | M xDrive: rear-biased, electronically controlled multi-plate clutch to the front axle, Active M Differential at the rear; modes 4WD, 4WD Sport and 2WD (rear drive, stability control off) | S2 | Yes |
| Stability systems | DSC with ABS, ASC, M Dynamic Mode, "can be switched off", integrated wheel slip limitation | S1 | Yes |

## 4. Aerodynamics

| Figure | Value | Source | Opened? |
|---|---|---|---|
| Drag coefficient x frontal area | cd x A = 0.34 x 2.34 m2 (so cd.A = 0.796 m2) | S1 ("Air resistance cd x A 0.34 x 2.34") | Yes |
| Drag coefficient, other statements | 0.33 in the US tables for the M3 (S2, S3) and on S6 for the rear-drive car; 0.34 on S4, S5 | S2, S3, S4, S5, S6 | Yes |
| Lift or downforce | Not published. Assumed, see section 6 | | |

## 5. Performance

Car and Driver and MotorTrend start their clock after the car has rolled one foot ("1-ft rollout"), which takes about
0.25 to 0.3 s off a 0-60 time. BMW's and Edmunds' figures are from a true standstill. The test prints both.

### 5a. M3 Competition with M xDrive

| Figure | Value | Source | Opened? |
|---|---|---|---|
| 0-60 mph, BMW | 3.4 s (503 hp car; the same claim is repeated for the 523 hp car) | S2 (S4 lists 3.4 s; a search summary of BMW's 2025 release agrees) | Yes |
| 0-100 km/h, BMW | 3.5 s | S1, S4 | Yes |
| 80-120 km/h in 4th / 5th gear, BMW | 2.6 / 3.4 s | S1 | Yes |
| Top speed, BMW | 250 km/h limited, 290 km/h with M Driver's Package (155 / 180 mph) | S1, S2 | Yes |
| 0-60 mph, Car and Driver (2023 car, 503 hp, 1-ft rollout) | 2.8 s | S13, S18, S12 | Secondary only (S16 not opened) |
| Quarter mile, Car and Driver (same test) | 11.0 s at 124 mph | S13, S12 | Secondary only |
| 0-60 mph, MotorTrend (2022 car, 503 hp, 1-ft rollout) | 2.98 s | S11 (S12 rounds to 3.0) | Secondary only (S17 not opened) |
| Quarter mile, MotorTrend (same test) | 11.1 s at 124.7 mph | S12 | Secondary only |
| 0-60 mph, Edmunds (2025 car, 523 hp, from standstill) | 3.2 s | S15 | Not opened (search summaries only) |
| Quarter mile, Edmunds (same test) | 11.1 s at 124 mph | S15 | Not opened (search summaries only) |
| 60-0 mph braking, Edmunds (same test, carbon-ceramic brakes) | 108 ft | S15 | Not opened (search summaries only) |
| Skidpad, Edmunds (same test) | 1.07 g | S15 | Not opened (search summaries only) |
| 0-100 mph | No figure found in a source I could open | | |

### 5b. M3 Competition, rear drive (503 hp)

| Figure | Value | Source | Opened? |
|---|---|---|---|
| 0-60 mph, BMW | 3.8 s | S3 | Yes |
| 0-100 km/h, BMW | 3.9 s | S6 | Yes |
| 0-60 mph, Car and Driver (2021 car, 1-ft rollout) | 3.5 s | S10, S12 | Secondary only |
| 0-100 mph, Car and Driver (same test) | 7.6 s | S10 | Secondary only |
| 5-60 mph rolling start, Car and Driver | 4.5 s | S10 | Secondary only |
| Quarter mile, Car and Driver (same test) | 11.6 s at 124 mph | S10, S12 | Secondary only |
| Skidpad (300 ft circle), Car and Driver (same test) | 1.03 g | S10 | Secondary only |
| 0-60 mph and quarter mile, MotorTrend (2021 car) | 3.5 s; 11.6 s at 125.6 mph | S11 (125 mph), S12 (125.6 mph) | Secondary only |
| 0-100 km/h, The Citizen | 3.64 s | S14 | Yes |
| Quarter mile, The Citizen | 11.58 s at 201.21 km/h (125.0 mph) | S14 | Yes |
| 1 km from rest, The Citizen | 20.75 s at 256.46 km/h | S14 | Yes |
| 100-200 km/h, The Citizen | 8.01 s | S14 | Yes |
| 60-0 mph braking | No rear-drive figure found in a source I could open; the xDrive figure in 5a is used for both | | |

## 6. Figures that are not published and are assumed in the model (`SPEC.assumed`)

| Figure | Assumed value | Why |
|---|---|---|
| Engine power for 251 mph | **872 kW (1,169 hp, 1,186 PS) at the peak, 1,453 Nm**: the published torque curve times 2.235. Solved by the model when it is built, from the drag, rolling resistance, driveline loss and tyre slip in SPEC, and stored in `SPEC.assumed.topSpeedPower` (it re-solves if any SPEC figure is revised). The published torque curve is multiplied by one factor; rev range, gears and final drive stay as published | The user fixed 251 mph. Drag alone at 251 mph is 0.5 x 1.225 x 0.796 x 112.21^3 = 688 kW at the wheels, so the published 390 kW cannot do it |
| Air density | 1.225 kg/m3 | ISO standard atmosphere, sea level, 15 C |
| Rolling resistance | 0.010 at low speed, rising with speed squared to about 0.027 at 251 mph | Typical of ultra-high-performance summer tyres (EU label class C to D); no data published for these tyres at that speed |
| Driveline efficiency | 0.90 with all-wheel drive, 0.92 rear drive | Typical of a locked-converter automatic and hypoid final drive; BMW publishes none |
| Front / rear split, xDrive | 54.0 / 46.0 | BMW's sheet says "tbd"; the rear-drive car is 53.1 / 46.9 and xDrive adds a front differential, shafts and a transfer case |
| Driver | 75 kg | The EU kerb-weight convention (S1: 1780 DIN, 1855 EU) |
| Centre of gravity height | 0.51 m | Not published; typical of a low sports saloon |
| Yaw inertia | 0.92 x mass x a x b | Typical ratio measured for saloons (NHTSA inertia data for a BMW 3 Series gives about 0.92) |
| Wheel, engine inertias | 1.8 / 2.0 kg m2 per front / rear wheel; 0.25 kg m2 engine and converter | Estimated from part masses |
| Tyre rolling radius | 0.985 x the radius given by the tyre size | Usual ratio for low-profile radials |
| Tyre friction and curve shape | peak grip 1.32 longitudinal and 1.23 lateral at 4.8 kN, falling 12 % per extra 4.8 kN; peak at 10 % slip and 9 / 7.5 degrees front / rear; magic-formula shape factors 1.55 / 1.4 | Chosen so the model's skidpad, braking and launch figures match section 5 |
| Roll stiffness split, roll and pitch gradients | 58 % front; 2.6 deg/g roll; 1.2 deg/g pitch | Not published; typical, and gives the mild understeer BMW tunes in |
| Lift | A little downforce: lift coefficient -0.02 front, -0.06 rear | Not published. Chosen small and rear-biased for stability at 251 mph |
| Brake torque and balance | 68 % front; full pedal 1.5 g worth of torque; anti-lock holds each wheel near 5.5 % slip | Not published |
| Idle speed, launch speed, torque below 2750 rpm, power between 6250 and 7200 rpm | 800 rpm; 2800 rpm; rising curve; falling to 93 % at 7200 | Only the 650 Nm plateau and the power peak are published |
| Shift time | 0.15 s with torque cut to 40 % | ZF quotes about 0.2 s for the 8HP |
| Maximum steering angle at the wheels | 30.8 degrees (mean of the two front wheels) | Derived from the published 12.6 m turning circle, wheelbase and track |
| Body overhangs | Body centred on the wheelbase midpoint | Overhangs not in the sources opened |
