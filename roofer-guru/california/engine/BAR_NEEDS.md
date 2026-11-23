# What the engine jobs ask of the Scout bar (collected by the lead from their reports)

## sky (CA/engine/sky): done
- A switch "Aircraft, ships and bridges": `en.setGraphics({ air })`, state from `en.graphics().air` (missing = on).
- A read-out line from `en.sky.info()`: nearest airport, km, landing and departing runways, arrivals and departures per
  hour, flights drawn. `en.state().air` = { on, flights, helicopters, boats, sites }.
- A caption from `en.sky.info().what.generated` (every flight, the ships at the piers, helicopters and boats are
  generated; runways, paths, rates, berths and bridge lines are real).
- No new storage key: the graphics settings object carries `air`.
- `S.deckAt(x, z)` gives bridge deck heights (Coronado, Golden Gate, Bay Bridge, Vincent Thomas).

## weather (CA/engine/weather): API as built (from its notes; report pending)
- `en.storm(n|id)` ids dry, light, rain, tstorm, ar1..ar5 (0..8); `en.wind(n|id)` calm, breeze, sa1..sa4 (0..5);
  `en.sky(n|id)` none, marine, tule, smoke (0..3)  [note: `en.sky` name collides with the sky kit's `en.sky`: lead to settle]
- `en.snowLevel(m|null)`, `en.elevation(m|null)`.
