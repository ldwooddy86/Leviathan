# Rooftop Scout (module 21 of the DFW Thermal Debt Atlas)

The atlas's heatmaps laid over commercial satellite imagery, down to the single building. Built into
`../DFW_Thermal_Debt_Atlas_Build6_Rooftop_Scout.html`; every other tab of that file is byte for byte the Build 6 Agent Desk
file it came from.

## What it does

- **Heatmap on satellite imagery.** Any layer of the atlas's shared catalog (Thermal Debt Index, systems 15 or older, R22
  era share and the rest) drawn over Esri World Imagery: Vantor satellite imagery at about 30 cm, 15 cm aerial imagery at
  the closest zoom across most of Dallas Fort Worth. The heatmap fades as you zoom so the roofs show. The capture date and
  source of the imagery under the map's centre are read live and shown under the map.
- **Every building read.** From zoom 17 the buildings in view are fetched from FEMA USA Structures and coloured:
  **green** likely to need a repair, a replacement or an installation, **orange** maybe, **red** not likely (dashed, so
  the three read apart without colour). Each building card gives the likely system (split system with a gas furnace, heat
  pump, packaged rooftop units, PTACs, central plant), its size, its controls and environmental control, the chance of a
  replacement within five years, a repair call within twelve months and an installation, the service lines it falls
  under, and the evidence with the atlas's grades.
- **Street view (3D), no key: the neighborhood rebuilt from open data, every building glowing.** The map card switches
  between three views: the satellite map, the 3D street view and Google's photos (the Satellite / Street view (3D) /
  Google photos switch, the Street view button on a building, or a double click on a building, which opens the 3D view).
  - Every building is its FEMA footprint raised to its FEMA height (a hipped roof on houses, eaves at about 60% of the
    height; a flat roof on the rest). Its roof, and the ground, are Esri's aerial and satellite imagery. Every street,
    alley and service drive is OpenStreetMap's (through the Overpass API: overpass-api.de, then two mirrors), or the
    Census TIGER file's when none answers (then without the alleys).
  - The page draws the scene itself, so it always knows where the camera stands and looks, and each building's green,
    orange or red glow, outline and label sit exactly on it. The current building carries a white outline.
  - Walk at eye level street by street and alley by alley (W and S or the arrow keys, or the on-screen pad; looking down
    a cross street and walking turns onto it), turn (A and D, or drag), rise to drone (38 m) or bird (120 m) height for
    the roofs (Q and E, or the Street / Drone / Bird switch), click the ground to go there, click a building to read it,
    double click to stand in front of it, step to the previous or next building, mark a field check, go full window.
- **Google photos.** Google's own Street View photographs of the street, in the card's place, aimed at the building.
  Without a key it is Google's plain embedded player, which is sealed (it tells the page nothing about where it looks), so
  no glow is drawn on it; with a Google Maps key (Maps JavaScript API) the photos glow too, drawn from the panorama's own
  camera. While either Google view shows, the satellite map and the 3D view are hidden: Google's Maps Platform terms
  (3.2.3(e)) keep Street View off any screen with a non-Google map. Each view also opens in Google Maps in its own tab.
  With a free Mapillary token, Mapillary's street photos show in the side panel, turned to face the building.
- **Field checks.** What you see on the roof or from the street (old or rusted unit, window units, hail damage, rooftop
  units, new equipment) overrides the model's colour, is kept in this browser and travels with the CSV.
- **Lead list.** The buildings in view as a sortable table and a CSV, with the links into Service Lines and the Campaign
  Desk.

## How a building is scored

1. **Building:** FEMA USA Structures footprint, height, address and occupancy class.
2. **Age:** year built from the county appraisal roll in the TxGIO statewide parcel file (filled for Tarrant, Collin,
   Denton and Wise), else a Dallas new construction permit, else the ZIP's ACS year built mix leaned by the footprint.
3. **Last replacement:** City of Dallas (2018 on) and City of Fort Worth (2001 on) mechanical permits matched by address.
4. **Life tables:** the atlas's Weibull lifetimes (EIA RECS 2020 Texas) run as a renewal model.
5. **Repairs:** module 05's call rates by system age.
6. **Installation:** older, smaller homes that may still cool with room units.
7. **Score:** the chance of at least one paid job. Green at 55 or more, orange at 42 to 54 (adjustable in Settings). An
   average DFW system scores about 45, so orange is the typical building.

## Services (all keyless and open to a browser)

| What | Service |
|---|---|
| Imagery | `server.arcgisonline.com` World Imagery (or `ibasemaps-api.arcgis.com` with an ArcGIS key) |
| Buildings | FEMA USA Structures, `services2.arcgis.com` |
| Year built | TxGIO StratMap parcels, `feature.geographic.texas.gov` (identify) |
| Permits | `www.dallasopendata.com` (e7gq-4sah), Fort Worth development permits on `services5.arcgis.com` |
| Streets | Census TIGERweb, `tigerweb.geo.census.gov` |
| Address search | Esri World Geocoder, `geocode.arcgis.com` |
| Street View | Maps JavaScript API Street View with a key (glows), or Google's embedded player (`maps.google.com`) without |
| Streets and alleys (3D view) | OpenStreetMap through the Overpass API (`overpass-api.de`, `overpass.kumi.systems`, `maps.mail.ru`), Census TIGER as the fallback |
| Street photos (optional) | Mapillary API v4, `graph.mapillary.com` |

Opened inside the Claude viewer, outside requests are blocked: the module says so and the heatmap still draws. Download
the file and open it in a browser.

## Rebuild

`python3 rooftop-scout/build.py <atlas.html> <out.html>` inserts the module after the Agent Desk's end marker and before
the shell boot script, and changes nothing else. Files: `scout.js` (the module), `scout3d.js` (the 3D street view),
`scout.css`. Leaflet 1.9.4 (BSD 2 clause, `vendor/LEAFLET-LICENSE`) and three.js r149 (MIT, `vendor/THREE-LICENSE`) are
carried inline and kept private to the module (`window.__SCOUT_LEAFLET__`, `window.__SCOUT_THREE__`).
