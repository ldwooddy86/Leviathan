# Legion in Rooftop Scout: who does what, and the one interface between the two jobs

The user's words: "Combine Legion with the Rooftop Scout tab. I want to integrate all of the NPCs throughout California."

Legion is in the page as a library (CA/legion/LEGION_CONTRACT.md: read sections 3, 4, 8, 10 and 11). The page build
(CA/build/build_ca.py, called by assemble_ca.sh) now carries CA/legion/out/legion.embed.html; `await
window.__LEGION_LOAD__()` gives `window.__LEGION__`.

## Rules for every surface
- These are synthetic people drawn from ZIP statistics, not residents. Wherever a person, a household or a count of
  people is shown, the page says so (`__LEGION__.NOTICE` or the same in the page's own words). A household at a
  building is a placement, not a finding. Nothing from Legion goes into the lead, account, outreach or campaign modules,
  and nothing is exported as if it were a record of a person.
- One rule for homes on every surface: `__LEGION__.housing(cellKey, buildings, { strict: true })` over ALL residential
  buildings of the cell, computed each time, never stored. The Scout module owns that call (below), so the card, the
  map and the engine always agree.
- One clock. The Scout module owns it (`SLG.clock`); the engine's sun hour and the map's time control both set it.
- Legion's own network settings are never switched on for the user. Claude talk exists only inside Legion's own
  mounted view, with the user's own key entered in Legion's own dialog. No key is ever read, stored, logged or sent by
  the dashboard's code.
- Legion loads on first use of people in the Scout tab, with one worker. The page must work with Legion absent or
  failing (every call guarded).

## Job A: Scout map and card (owns CA/scout/scout.js, scout-style.css, CA/scout/tests)
Implements, in scout.js, the module-side bridge `SLG` and publishes it to the engine as `env.legion`:

    SLG = {
      ready(),                          // Promise: Legion loaded and ready (loads it on first call)
      on,                               // boolean: people switched on in the Scout tab
      NOTICE,                           // the synthetic-people sentence
      clock: { get(), set(t), minute(), dow(), fromEngine(hour, dayOffset) },   // epoch ms; minute of day; weekday 0-6
      households(buildingId),           // [householdId, ...] placed at that Scout building ('' list if none / not residential)
      residents(buildingId),            // [{ id, household, name, age, role, job, tenure, ... }] brief people of those households
      buildingOf(personOrHouseholdId),  // Scout building id or null (within loaded buildings)
      trips(buildingIds),               // [{ id, household, building, mode, vehicle, departMin, returnMin, minutes, dwellMin,
                                        //    days: [7 booleans], work: { lat, lon }, bearing }] for residents who travel
      vehicles(buildingId),             // number of household vehicles at that building (for parked cars)
      through(box, t, max),             // [{ id, mode, vehicle, kind }] identities for traffic passing through (crowdNow visitors)
      describe(id), say(id, topic),     // as __LEGION__ gives them
      open(id, from)                    // show that person in the Scout tab's NPC panel (from: 'map' | 'card' | 'engine')
    }

Surfaces: a statewide "People" layer (every ZIP shape coloured from `places()`: all 39 million by place, with the
list of people for a ZIP), a crowd dot layer at street zooms, "Who lives here" on the building card, the NPC panel
(Legion's own description and built-in voice), "Open in Legion" (the full mounted view), a People row in the engine
bar (switch, clock read-out, counts from `en.state().people`), and the method, caveats and sources text.

## Job B: Scout Engine (owns CA/engine/people/: people_engine.js + port_people.py, applied after `views`, before `dense`)
Reads `env.legion` (the object above; absent or not ready means no people and no errors). Publishes:

    en.people = { info(), pick(id), list(), focus(id) }      // info(): { on, walkers, drivers, parked, homes, t }
    en.state().people = { on, walkers, drivers, parked, residents }
    en.setGraphics({ people: true | false })   en.graphics().people
    click or tap on a person or an NPC's car in the view  ->  env.legion.open(id, 'engine')
    the engine tells the bridge its time: env.legion.clock.fromEngine(sunHour, dayOffset) whenever its clock changes

Legion gives who and when; the engine keeps where: residents leave their own building at `departMin` on the engine's
own streets (drivers in the traffic kit's vehicles, walkers and transit riders as pedestrians on the sidewalks) and
come back at `returnMin`; parked cars are household vehicles less those out; through traffic is named from
`through()` at spawn. Nothing is asked of Legion per frame.
