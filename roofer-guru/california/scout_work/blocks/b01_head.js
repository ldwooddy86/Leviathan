/* Module 18, Rooftop Scout, of California Roofer Guru: the atlas's heatmaps laid over commercial satellite imagery, down
   to the single roof, for California and only California.
   The ZIP heatmap of any layer in the shared catalog (the same LAYERS modules 01, 04, 05 and 06 draw) sits on Esri World
   Imagery: Vantor satellite imagery of 31 to 50 cm at the closest zoom across most of the state, finer county aerials
   where Esri carries them (Santa Clara County, Santa Rosa, San Bernardino County). At street level every building in view
   is fetched from FEMA's USA Structures inventory and joined to what California's public records say about it:
     its parcel (year built, use, situs address) from the county assessor's public layer where one carries a year built:
       Los Angeles, San Diego (a two digit effective year), Orange, Riverside (which also records the roof covering),
       Santa Clara, Contra Costa, San Francisco, San Joaquin, Sonoma and Ventura; an address and use only in Alameda,
       Sacramento, San Mateo and Placer; nothing in San Bernardino, Fresno or Kern, where the ZIP's housing age stands in
       and the card says so;
     re-roof permits where a city publishes them: the City of Los Angeles (1996 on), Los Angeles County's unincorporated
       areas and contract cities (2018 on), San Francisco (with its re-roof flag), the City of Sacramento (by parcel
       number, with the covering and the squares) and, in part, San Jose;
     CAL FIRE's record at the site: the Fire Hazard Severity Zone the building stands in, the fire perimeters since 1950
       round it, and the damage inspection of the building itself where a fire reached it (which also records its roof);
     the Energy Commission's building climate zone, for the cool roof rules a re-roof must meet (Title 24, Part 6).
   Each building is then read by the atlas's own models: the roof it most likely carries (statewide 62 percent shingles,
   27 percent tile, 5 percent wood on single family homes, and 62 percent tile on those built 2000 to 2020: the 2020
   Residential Energy Consumption Survey), how old that roof most likely is (module 17's roof life, with tile aged by its
   underlayment, and wildfire rebuilds), how likely it is to need a replacement, a tile lift and relay, a repair or
   wind, rain or fire work, and which of the thirteen service lines that is.
   Green: likely to need the work. Orange: maybe. Red: not likely. A field check from the imagery overrides the model.
   Live Google Street View plays inside the map card, aimed from the street at the building, in place of the satellite map:
   Google's terms (Maps Platform 3.2.3(e)) keep Street View imagery and a non-Google map off the same screen, so the card
   switches between them. With no key at all, the Street view (3D) rebuilds the neighborhood from open data (FEMA
   buildings, Esri imagery, OpenStreetMap streets and alleys) and every building glows in its colour, exactly, because the
   page draws the scene itself; it walks the streets and alleys and rises for the roofs. It is traced from the newest
   satellite photo Esri serves for the place when that photo is from 2024 or later: an AI model (SlimSAM, Segment
   Anything, run on this computer by ONNX Runtime Web) checks every building on record against the photo, redraws the
   ones whose roofs changed, and outlines every tree crown. The area exports as a glTF model for Unreal Engine 5 or
   Blender. With a Google Maps key that has the Map Tiles API, the same 3D view can stand on Google's Photorealistic 3D
   Tiles instead. Past the imagery's finest zoom, the satellite map's AI detail runs Real-ESRGAN on this computer's
   graphics card to draw each tile four times finer, labelled as inferred. Street photos inside the side panel come from
   Mapillary when a Mapillary token is saved. Every request goes from this browser straight to a public service; nothing
   is sent anywhere else, and the keys a person saves stay in this browser.
   The Scout Engine (window.__SCOUT_E3D__, carried in the file after this script) draws the same neighborhood with its own
   WebGL2 renderer and lays roof views on the roofs round the camera: Covering, Shingle style, Thermal, Wear, Weather
   (what the rain, the atmospheric river, the wind, the snow or the smoke now set on the engine's scales would do to
   each roof), Fire (the class of roof each most likely is, the zone it stands in and its ember exposure), Solar and
   cool roof (the sun each plane takes in a year, and the cool roof rule a re-roof there must meet) and Time (the damage
   most likely to have reached each part of each roof by each of the next fifteen years). The same fifteen year outlook
   is on the building's card, with California's weather history applied to the roof: atmospheric river days by rank,
   heavy rain days, gust days at 40, 58 and 75 mph, Santa Ana or Diablo exposure, the fire zone and the fires and
   losses near it, the ground snow load, heat days, hail and salt air, each said plainly with its source, as the record
   of what has happened there and never as a forecast of an event.
   Plain script in the dashboard's own style, on the dashboard's own helpers (registerModule, mastHTML, card, callout,
   kpiHTML, dataTable, layerOptions, zipTip, qScale, legendHTML, saveFile, toCSV, store, toast). Leaflet 1.9.4 is carried
   inline beside it and kept private (window.__SCOUT_LEAFLET__), so no other module sees a global L. */
