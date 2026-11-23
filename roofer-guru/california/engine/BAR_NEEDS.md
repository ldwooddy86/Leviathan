# What the engine jobs ask of the Scout bar (collected by the lead from their reports)

## sky (CA/engine/sky): done
- A switch "Aircraft, ships and bridges": `en.setGraphics({ air })`, state from `en.graphics().air` (missing = on).
- A read-out line from `en.sky.info()`: nearest airport, km, landing and departing runways, arrivals and departures per
  hour, flights drawn. `en.state().air` = { on, flights, helicopters, boats, sites }.
- A caption from `en.sky.info().what.generated` (every flight, the ships at the piers, helicopters and boats are
  generated; runways, paths, rates, berths and bridge lines are real).
- No new storage key: the graphics settings object carries `air`.
- `S.deckAt(x, z)` gives bridge deck heights (Coronado, Golden Gate, Bay Bridge, Vincent Thomas).

## Naming settled by the lead
- The sky kit (aircraft, ships, bridges) is reached as `en.air` (an object: `en.air.info()`, `en.air.hold(t)`), NOT
  `en.sky`: the weather job uses `en.sky(id)` for the sky state. `en.state().air` and `en.graphics().air` are unchanged.

## weather (CA/engine/weather): done
- `en.storm(n | id)`: ids dry, light, rain, tstorm, ar1..ar5 (0..8): NINE steps (Louisiana had ten). The module's storm
  slider, `stormText` and the CSS `.sc-stormt` grid (`repeat(10,1fr)` in the engine stylesheet) must become nine; `range`
  and `surge` fields are gone (`en.graphics().surge`, `surgeNote`, `setSurge` no longer exist).
- `en.wind(n | id)`: calm, breeze, sa1..sa4 (0..5): the dry offshore wind scale (Santa Ana / Diablo / sundowner by place:
  `en.state().windName`).
- `en.sky(n | id)`: none, marine, tule, smoke (0..3). Marine and tule are held off while rain or sa1+ is set
  (`en.stormKit.info().sky.held` says why).
- `en.snowLevel(m | null)`, `en.elevation(m | null)`, `en.weather()` (= `en.stormKit.info()`).
- `en.setGraphics({ storm, wind, skyState, snowLevel, elevation })`; `en.graphics()` carries the same plus `stormInfo`.
- `en.state()`: `stormKey, wind, windKey, windName, sky, skyOn, weather` (a readable sentence), `sustainedMph, gustMph`,
  `rainMmH`, `precip` ('none' | 'rain' | 'rain and snow' | 'snow'), `snowLevelM, elevationM, visKm, altaCanFly`.
- `en.stormKit.info()`: wet step `{level, key, name, short, ar, ivt, cw3e, mph, gust, rain, rainIn, bolt, note}`, snow
  `{snowLevelM, snowLevelFt, precip, snowCover, pond}`, `wind {level, key, name, short, local, mph, gust, fly, note}`,
  `sky {level, key, name, short, on, held, burn, note}`, for the roof `sustainedMph, gustMph, rainMmH, rainInH, snowing`,
  Alta X `fly, flyWhy, altaGustLimitMph`, and `text`. Tables: `SE.STORM`, `SE.WIND`, `SE.SKY` (each row has a `note`).
- Roof-view lens context has `stormStep, wind, windStep, sky, wx` (`wx` = info()); `surgeNote` is gone.
- Alta X flies only in dry or light rain AND calm or breeze; `en.NOFLY`, `en.warn` unchanged.
- The bar should say what is chosen, from the notes: rain rate and wind per AR rank are this picture's choices; the AR
  scale itself is CW3E's; snow build-up and melt are sped up; marine layer figures are choices.
