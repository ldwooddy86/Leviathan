# Rooftop Scout (module 21 of the DFW Thermal Debt Atlas)

The atlas's heatmaps laid over commercial satellite imagery, down to the single building. Built into
`../DFW_Thermal_Debt_Atlas_Build6_Rooftop_Scout.html`; every other tab of that file is byte for byte the Build 6 Agent Desk
file it came from.

## What it does

- **Heatmap on satellite imagery.** Any layer of the atlas's shared catalog (Thermal Debt Index, systems 15 or older, R22
  era share and the rest) drawn over Esri World Imagery: Vantor satellite imagery of 30 to 34 cm across most of Dallas
  Fort Worth (Lakewood: December 9, 2025), finer aerial imagery where Esri carries it. The heatmap fades as you zoom so the roofs show. The capture date and
  source of the imagery under the map's centre are read live and shown under the map.
- **AI detail past the imagery's finest zoom.** The imagery stops at zoom 20 (drawn from captures of 30 to 34 cm over most
  of DFW; the line under the map names the one under its centre). At zoom 21 and 22,
  each tile is cut from its zoom 20 parent run through Real-ESRGAN (`realesr-general-x4v3`, a super-resolution network)
  in TensorFlow.js on the computer's own graphics card, with a 16 pixel margin from its neighbours so the joins do not
  show: four times the pixels, sharper roof edges, vents and units. A tile first shows the plain enlargement, then the
  enhanced one; the parents are kept, so panning back costs nothing. The detail the network adds is inferred, not
  photographed, and the map says so whenever it shows; the **AI detail** button under the map turns it off. Nothing
  leaves the browser.
- **Every building read.** From zoom 17 the buildings in view are fetched from FEMA USA Structures and coloured:
  **green** likely to need a repair, a replacement or an installation, **orange** maybe, **red** not likely (dashed, so
  the three read apart without colour). Each building card gives the likely system (split system with a gas furnace, heat
  pump, packaged rooftop units, PTACs, central plant), its size, its controls and environmental control, the chance of a
  replacement within five years, a repair call within twelve months and an installation, the service lines it falls
  under, and the evidence with the atlas's grades.
- **Street view (3D), no key: the neighborhood rebuilt from open data, every building glowing.** The map card switches
  between three views: the satellite map, the 3D street view and Google's photos (the Satellite / Street view (3D) /
  Google photos switch, the Street view button on a building, or a double click on a building, which opens the 3D view).
  - **Traced from 2025.** No public 3D survey of DFW is newer than 2018 (USGS lidar; FEMA's footprints in Dallas come
    from a 2015 lidar capture, OpenStreetMap's from 2009 photos; Texas's and NCTCOG's 2024 and 2025 lidar either covers
    other counties or is sold to member governments). So the scene is traced from the newest satellite photo Esri serves
    for the place, if it was captured in 2024 or later, found from World Imagery's metadata (Vantor's December 9, 2025
    picture over Lakewood, 34 cm). An AI model, SlimSAM (Segment Anything, pruned; Apache-2.0), runs on the computer
    through ONNX Runtime Web: on the graphics card where WebGPU answers (full or half precision), else on the processor
    (8 bit). Its weights (14 to 40 MB) come once from Hugging Face, pinned to a revision; its runtime once from jsDelivr.
    It reads a 1,024 pixel picture of the 360 m around the scene's centre and is pointed at every building on record:
    a roof that fits the old outline (or fits it a few metres over, the old survey's error, or is the part of it the
    trees leave in view) **confirms** the building; a larger, square-edged roof over it **redraws** the building from the
    photo (straightened, its height kept or raised to two storeys when it grew by half); no roof means **under trees**,
    and the recorded outline stays and says so. Every tree crown is outlined on a grid of points (canopy-textured ones,
    nearest the centre first), its height estimated from its spread. The satellite looked a little sideways, so a roof
    shows a little off its walls: that lean is measured on the confirmed roofs and taken out of every outline, and put
    back when the photo is laid on a roof. On Lorna Lane in Lakewood (106 buildings, heavy canopy) it confirms about two
    thirds (63 to 68 in the test runs), finds the rest under trees, and outlines about 130 to 175 crowns; about 3 minutes on a processor, seconds on a graphics
    card. The view is usable meanwhile; the AI tracing switch in the Graphics menu turns it off.
  - **Trees.** Each crown is its traced outline carried up into a dome (its base about a third of the way up, its top at
    the tree's height) skinned with clusters of photographed leaves, matte, in summer greens (the December photo shows the
    live oaks green and the rest in fall colour), with a trunk that forks into limbs reaching into the crown. Where the AI
    has not outlined a crown, the photo's own colours place the trees.
  - Houses get walls set back under their eaves, windows with frames, sills, muntins and glass that mirrors the sky
    (shutters on some siding), a foundation, a front door on the wall facing the street and a garage door facing the
    alley or drive. Walls cannot be seen from above, so brick, siding or stucco is a likely look for the building's
    type. Roofs are modeled (hipped on houses, flat behind a parapet on the rest) and carry the same 2025 photo as the
    ground, shifted for its lean; every street, alley and service drive is OpenStreetMap's (through the Overpass API: overpass-api.de, then
    two mirrors), or the Census TIGER file's when none answers (then without the alleys). Materials are CC0 photo scans:
    brick, siding, stucco, metal, asphalt, concrete, grass on the lawns near the camera, bark, roof shingles.
  - It is drawn the way a modern game engine draws a scene: a physical sky with the sun where it stands over Dallas at the
    chosen hour (Morning, Midday, Afternoon, Evening or Now), light from that sky, sun shadows, ambient occlusion (GTAO),
    filmic tone mapping, physically based brick, lap siding, stucco, storefront and curtain wall glass and metal panel, and
    bloom on the glows only (three.js's port of Unreal Engine's bloom, fed by the glows alone, so nothing else blooms).
    Quality is High, Medium or Basic: Auto picks one for the machine and steps down once if the walk stutters.
  - The page draws the scene itself, so it always knows where the camera stands and looks, and each building's green,
    orange or red glow, outline and label sit exactly on it. The current building carries a white outline.
  - Walk at eye level street by street and alley by alley (W and S or the arrow keys, or the on-screen pad; looking down
    a cross street and walking turns onto it), turn (A and D, or drag), rise to drone (38 m) or bird (120 m) height for
    the roofs (Q and E, or the Street / Drone / Bird switch), click the ground to go there, click a building to read it,
    double click to stand in front of it, step to the previous or next building, mark a field check, go full window.
  - **Photoreal (Google), with a key.** With a Google Maps key that has the **Map Tiles API** turned on (Google Cloud
    console, APIs and Services; billing on the project, and Google's free monthly use covers testing), Model: Photoreal
    (Google) in the 3D bar puts the same walk on Google's Photorealistic 3D Tiles: the real streets, houses, cars and
    trees as Google photographed and meshed them (the data behind Google Earth's 3D), streamed from
    `tile.googleapis.com` with 3DTilesRendererJS and drawn with their own photographed light. The glows stay on top, each
    building's footprint set on Google's ground (found by casting rays into the mesh around the camera), and Google's
    logo and data credits show over the view. The key is entered in the 3D bar or in Settings and stays in the browser.
    Without a key, or if Google refuses it (the reason shows in the bar), the view stays on the measured model.
  - **3D model for Unreal** downloads the area as a glTF 2.0 file (`.glb`): one node per building, named by its address,
    with the module's reading in its extras (use, reading, score, likely system, likely need, field check); its glow as an
    emissive shell (`KHR_materials_emissive_strength`, so Unreal's bloom lights it); the streets, the trees and a ground.
    It opens in Unreal Engine 5 (drag it into the Content Browser, or File > Import Into Level), Blender or any glTF tool;
    meters, +Y up, the origin's latitude and longitude in the scene's extras. Esri's imagery stays out of it (its terms keep
    it on Esri's servers). Khronos's glTF validator passes it with no errors and no warnings.
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

## Services (keyless and open to a browser, except where a key is named)

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
| Roofs and trees (3D view) | Traced by AI from Esri World Imagery (the newest 2024-or-later capture, found with `World_Imagery/MapServer/identify`); the model from `huggingface.co` (Xenova/slimsam-77-uniform), the runtime from `cdn.jsdelivr.net` (onnxruntime-web 1.30.0), once each |
| Ground height (photoreal view) | USGS 3DEP bare earth, `elevation.nationalmap.gov` (`3DEPElevation/ImageServer/exportImage`) |
| Street photos (optional) | Mapillary API v4, `graph.mapillary.com` |
| Photoreal 3D (with your key) | Google Photorealistic 3D Tiles, Map Tiles API, `tile.googleapis.com` |
| AI detail (map, zoom 21 and 22) | none: Real-ESRGAN runs in the page, on the imagery tiles the map already loads |

Opened inside the Claude viewer, outside requests are blocked: the module says so and the heatmap still draws. Download
the file and open it in a browser.

## Why not Unreal Engine itself

Unreal Engine 5 has no web export: the only way to show an Unreal scene in a browser is Pixel Streaming, where the engine
runs on a server with a graphics card and streams video to the page. That needs a GPU server and Epic's toolchain, and a
single dashboard file cannot carry it. So the view uses the same techniques in a browser engine (three.js), and the
**3D model for Unreal** export takes the scene into the real Unreal Engine, where Cesium for Unreal can add terrain and
imagery under it and Pixel Streaming can serve it to a browser.

## Rebuild

`python3 rooftop-scout/build.py <atlas.html> <out.html>` inserts the module after the Agent Desk's end marker and before
the shell boot script, and changes nothing else. Files: `scout.js` (the module), `scout3d.js` (the 3D street view),
`scout.css`. Leaflet 1.9.4 (BSD 2 clause, `vendor/LEAFLET-LICENSE`) and three.js r186 with its sky, post-processing and
glTF export add-ons (MIT, `vendor/THREE-LICENSE`) are carried inline and kept private to the module
(`window.__SCOUT_LEAFLET__`, `window.__SCOUT_THREE__`). `vendor/three.bundle.min.js` is built from `vendor/three-entry.js`
with esbuild; the command is at the top of that file. `scouttrace.js` is the AI tracing; `vendor/ort-wasm.bundle.js`
and `vendor/ort-webgpu.bundle.js` are ONNX Runtime Web 1.30.0's processor and graphics card builds (MIT,
`vendor/ORT-LICENSE`), bundled separately from `vendor/ort-entry-wasm.js` and `vendor/ort-entry-webgpu.js` (commands at
their tops); their WebAssembly engines and the SlimSAM weights are fetched at run time. `vendor/textures/` holds the
CC0 photo textures (`SOURCES.md`), embedded by build.py as data URIs. The three.js bundle also carries
3DTilesRendererJS 0.5.3 (Apache-2.0, `vendor/3DTILES-LICENSE`) and the Draco decoder, for the photoreal view;
`vendor/google-logo.png` is the logo Google asks to be shown over its tiles. `scoutsr.js` is the AI detail;
`vendor/tf.bundle.js` is TensorFlow.js 4.22 core with its WebGL backend (Apache-2.0, `vendor/TFJS-LICENSE`), built from
`vendor/tf-entry.js`; `vendor/sr/` holds Real-ESRGAN's `realesr-general-x4v3` weights (BSD-3-Clause,
`vendor/sr/REALESRGAN-LICENSE`) as float16, converted from the released PyTorch file without PyTorch by
`vendor/sr/srnet.py`, which also runs the network in numpy as the reference the browser output is checked against.
