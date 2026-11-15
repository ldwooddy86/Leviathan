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
- **Street View from the road, inside the dashboard.** The map card switches between the satellite map and live Google
  Street View (the Satellite / Street View switch, the Street View button on a building, or a double click on a
  building). The view stands on the street the building's address names, at the nearest point of the Census TIGER
  centreline, and faces the building, tilted up for buildings with rooftop units. Drag to look around, click the arrows
  to walk the street, step to the previous or next building (likely ones first), turn, face it again, mark a field check,
  or go full window; Esc goes back. While Street View shows, the satellite map is hidden: Google's Maps Platform terms
  (3.2.3(e)) keep Street View and a non-Google map off the same screen. No key is needed (Google's standard embedded
  player); with a Google Maps key saved in Settings it runs through the Maps Embed API. Each view also opens in Google Maps
  in its own tab. With a free Mapillary token, Mapillary's street photos show in the side panel, turned to face the
  building.
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
| Street View | Google's embedded Street View player (`maps.google.com`), or the Maps Embed API with a key |
| Street photos (optional) | Mapillary API v4, `graph.mapillary.com` |

Opened inside the Claude viewer, outside requests are blocked: the module says so and the heatmap still draws. Download
the file and open it in a browser.

## Rebuild

`python3 rooftop-scout/build.py <atlas.html> <out.html>` inserts the module after the Agent Desk's end marker and before
the shell boot script, and changes nothing else. Leaflet 1.9.4 (BSD 2 clause, `vendor/LEAFLET-LICENSE`) is carried inline
and kept private to the module (`window.__SCOUT_LEAFLET__`).
