# car job notes (engine job "car": the drivable black 2027 BMW M3, mode `m3`)

Files (all in CA/engine/car/):
- car_body.js   pure geometry (M3Body()): body skin by material group, wheels, cabin. No engine names used.
- car_engine.js the kit (SE.M3Kit): meshes, materials, entities, lamps, smoke, sound, physics wrapper.
- car_world.js  the world's side (functions put inside the world builder's closure by the port).
- port_car.py   <in.js> <out.js>: anchored replacements; concatenates ../car_physics.js + car_body.js + car_engine.js.
- tests/        preview.js (node rasteriser of the body), drive tests (playwright), shots/ pictures.

Plan / state
1. [ ] car_body.js + tests/preview.js (look at PNGs)
2. [ ] car_engine.js
3. [ ] car_world.js + port_car.py
4. [ ] testbed runs: LA, Coronado, dynamics by hand clock, wall, 251 mph, night, rain
5. [ ] report (functions touched, what the bar needs)

Decisions
- Mode name `m3`. Kit `SE.M3Kit`. Physics untouched (CA/engine/car_physics.js), autoReverse on by override.
- Model: nose at -z, right +x (engine craft convention: Q.fromEuler(pitch, -yaw, roll)).
- No shader edits: plain Materials (paint lit rough 0.16; glass model 'glass'; lamps lit + emissive).
- S.fast set by the car above 60 m/s (off below 45): near cells and building fetches stop, far ground and roads stay.
- Roads at speed: loadRoads() called with S.x/S.z moved ahead for the call (no anchor inside loadRoads).
