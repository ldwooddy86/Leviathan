# Leviathan · the unified console

One frame, sixteen dashboards. OmegaWeapon and the Hit Board sit at the core; fourteen industry atlases hang off it in
three wings (legal, home services, healthcare); the Convergence map and the Agency Field read all of them at once.

## This build (October 7, 2026, fourth build): the Résumé Forge in the single file edition

`Leviathan-full.html` now carries the browser app's patches and the **Résumé Forge** inline: a fourth console view beside
the Agency Field (route `resume`, `resume.<agency>`, a Résumé link on every Agency Field row) that reads the Agency Radar's
findings on any of the 222 agencies into the gaps it shows and the lines it sells, ranks seventeen hiring tracks on demand
and angle, and builds an ATS-friendly résumé in the agency's own vocabulary, with an ATS readiness score, a mirror readout,
readability, match-a-posting and copy, .txt, .md, print and interview-brief exports. The engine is Clapback 4.3.0's résumé
module, ported. Nothing is sent anywhere; the draft stays in the browser.

The file is written in place by `cd chrome-app && node build.mjs --full` from this folder's own `Leviathan-full.html`: the
thirteen anchored patches, the four `ext/` scripts inline (so the file needs nothing beside it), the payloads scrubbed. The
patch is idempotent (an edition this build wrote earlier is unpatched first), so the file can be rebuilt in place and the
next console build can read it as its previous edition. The split edition (`Leviathan.html`, `Leviathan-data.js`,
`Leviathan-data-2.js`) stays the plain console without the Forge: the browser app and the single file are built from it.

One licensee row in the DFW Thermal Debt payload carried a name on the browser app's withheld list; it is dropped from
both editions (the build drops such rows from every payload it writes, and its validation refuses the repository while a
withheld name remains anywhere in it, every payload inflated and every zip entry read). Every other byte of the split
edition is unchanged. `FEATURES.md` at the repository root lists every feature of this build, dashboard by dashboard.

### Previous build (October 6, 2026, third build): no client or agency names

The console now carries no client or agency names. In the DFW Thermal Debt Atlas the brand defaults are a neutral
placeholder ("Your HVAC Company", with no phone, address, license, logo, acquisitions or social profiles; the Brand panel
fills them in and the shell, the Site Forge and the connectors read what it holds), the benchmark location on the
competitor map is carried as "Client (name withheld)" with its contact details and branded keywords removed and its own
TDLR license row dropped from the lookup table, the agency credit is gone from the competitive heatmap source rows and
the house style rule, and the Hit Board's writing gate names no proprietary content skills. The same scrub covers the
single file preview in `dist/`, the build 3 reference and the browser app.

This build was made in place rather than from a new atlas: the DFW payload was rewrapped from the scrubbed preview with
`build.py`'s own `wrap_dfw` (which reproduces the previous payload byte for byte from the previous preview), the Hit
Board text was edited, both were packed again (gzip + base64) and the registry's two payload sizes were updated. Every
other byte of both editions, including the three companion scripts, is unchanged.

### Previous build (October 6, 2026, second build): the Louisiana legal atlases

The legal wing now carries criminal defense and personal injury twice, the way the home wing carries HVAC twice:

| Wing | Atlas | What changed in this build |
|---|---|---|
| Legal | **Probable Cause Defense Atlas** (Louisiana edition) | New: the Louisiana criminal defense atlas, sixteen modules, all 64 parishes, 441 residential ZIPs scored on the Defense Demand Index. Registered as `criminal_la` beside the Texas edition and feeds Convergence as the Louisiana criminal defense column. |
| Legal | **Contraflow Injury Atlas** (Louisiana edition) | New: the Louisiana personal injury atlas, sixteen modules, all 64 parishes, the same 441 ZIPs scored on the Case Flow Index. Registered as `injury_la` beside the Texas edition and feeds Convergence as the Louisiana personal injury column. |

The spine labels the four legal editions by state (Criminal defense · Texas, Criminal defense · Louisiana, Personal
injury · Texas, Personal injury · Louisiana). Convergence ranks each state's column within that state, so the Louisiana
matrix gains two verticals and eleven Spearman pairs; the Texas matrix is untouched. The other fourteen dashboards
carry over byte for byte.

### First build (October 6, 2026)

That build unified the two dashboards this repository already carried with the Leviathan console and added the
attached atlas:

| Wing | Atlas | What changed in that build |
|---|---|---|
| Home services | **DFW Thermal Debt Atlas** (build 4, the browser app edition) | New: `dist/DFW_Thermal_Debt_Atlas_4_preview.html` wrapped and registered beside the Louisiana Thermal Debt Atlas. Its 263 scored ZIPs feed Convergence as the HVAC (DFW) vertical. |
| Legal | **The Termination Exposure Atlas** (v8.2) | New: the employment law atlas, eight modules, every buyable US ZIP scored. Its 1,625 Texas and Louisiana ZIPs feed Convergence as Employment law. |
| Healthcare | **The Dental Divide Atlas** | Already inside the console; byte for byte the same build as `dental-divide-atlas.html` at the repository root. |

The other eleven dashboards (OmegaWeapon, Hit Board, Probable Cause, Contraflow, Severance, Louisiana Thermal Debt, Uplift,
Water Hammer, Swarm Front, Oncogene, Ocular Health) carried over unchanged.

## Files

| File | Size | Holds |
|---|---|---|
| `Leviathan-full.html` | 63 MB | **The whole console in one file**: frame, fonts, registry, all sixteen dashboards and the Résumé Forge inline (the browser app's patches applied). Open it anywhere; it needs nothing beside it. Over GitHub's 50 MB warning line but under its 100 MB limit. |
| `Leviathan.html` | 26 MB | The same console split for hosting that minds file size: the frame, fonts, registry, and the twelve smaller atlases packed inline (gzip + base64). |
| `Leviathan-data.js` | 26 MB | Severance, Dental Divide and Ocular Health, loaded on demand. |
| `Leviathan-data-2.js` | 10 MB | The Termination Exposure Atlas, loaded on demand. |
| `tools/build.py` | | The build script of the first build (DFW Thermal Debt and Termination Exposure). |
| `tools/build_louisiana.py` | | The build script of the second build (the Louisiana legal atlases); it imports its helpers from `build.py`. |
| `../chrome-app/build.mjs --full` | | The fourth build: rewrites `Leviathan-full.html` in place with the browser app's patches and the Résumé Forge inline (see `../chrome-app/README.md`). |

`Leviathan-full.html` is the one to send around. The split edition keeps every file under GitHub's 50 MB line; keep its
three files in one folder and open `Leviathan.html`. Either way, use a current Chrome, Edge, Safari or Firefox. Nothing runs on a server: each atlas unpacks in the browser
when you open it, and the five most recently opened stay live.

## Rebuilding

Each script carries every payload over from a previous console build, wraps the new atlases with the console's host
link and bridge, extends the registry (modules, wings, verticals, Convergence columns, Spearman correlations) and patches
the frame. Each patch asserts its anchor occurs exactly once, so an upstream change fails loudly instead of silently.

The second build reads the previous single file edition (it carries every payload inline) and the two Louisiana atlases as
they come out of the viewer. The Probable Cause download starts at `<title>` with no document skeleton; the script adds one.

```
python3 leviathan/tools/build_louisiana.py \
  --prev-full       <previous Leviathan-full.html> \
  --probable-cause  <probable-cause-defense-atlas.html>        # Louisiana edition
  --contraflow      <contraflow-louisiana-injury-atlas.html>   # Louisiana edition
  --out             leviathan \
  --single          leviathan/Leviathan-full.html   # the one file edition
  --online          <folder>      # optional hosted edition: index.html plus m/<id>.txt, fetched on demand
```

The first build, from the split edition before it:

```
python3 leviathan/tools/build.py \
  --prev-html  <previous Leviathan.html> \
  --prev-data  <previous Leviathan-data.js> \
  --dfw        dist/DFW_Thermal_Debt_Atlas_4_preview.html \
  --termination <termination-exposure-atlas-v8_2.html> \
  --out        leviathan \
  --single     leviathan/Leviathan-full.html   # the one file edition
  --online     <folder>      # optional hosted edition: a 2 MB index.html plus m/<id>.txt, fetched on demand
```

## Hosted edition

`--online` writes a page without inline payloads and one `m/<id>.txt` file per dashboard; the console fetches them when an
atlas is opened. That layout is what the online copy of this build is published from. It needs an HTTP server (file://
blocks fetch), which is why the offline files above inline their payloads and use companion scripts instead.
