# Leviathan · the browser app

The Leviathan console as a Chrome extension (Chrome, Edge, Brave and other Chromium browsers). One frame, sixteen dashboards:
OmegaWeapon and the Hit Board at the core, fourteen industry atlases in three wings (legal, home services, healthcare), the
Convergence map and the Agency Field. The console inside is the split edition from this repository's `leviathan/` folder
(`Leviathan.html`, `Leviathan-data.js`, `Leviathan-data-2.js`), copied into `console/` with six anchored one line patches (five
in its frame script, one marker in its head) and no change to any atlas. `node build.mjs` regenerates that copy from `../leviathan` whenever the console changes.

Nothing runs on a server. The atlases unpack in the browser when they are opened, and the five most recently opened stay live.
The only things the app stores are the console's preferences (theme, module cards, spine), the list of recently opened atlases
and the popup's "Open in a new tab" setting, in the extension's local storage.

## Install

1. `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`), turn on Developer mode.
2. **Load unpacked**, choose this folder (`chrome-app/`). The console opens in a tab on the first install.
3. Pin the icon. The popup is the launcher: the three console views, the wings with their atlases, the recent atlases, and a search
   over atlases and modules (Enter opens the first match).

Three more ways in:

- **Keyboard**: `Ctrl+Shift+L` (`Command+Shift+L` on a Mac) opens the console, or brings the open console tab forward;
  `chrome://extensions/shortcuts` changes the key.
- **Address bar**: type `lev`, a space, then an atlas, module, wing or view ("lev dental", "lev paid acquisition", "lev legal",
  "lev convergence"); a route typed exactly (`lev convergence.75001`) is taken as is.
- **Links**: the tab's URL follows the console, so any view can be bookmarked or shared between tabs:
  `chrome-extension://<id>/app.html#dental.paid`. Routes are `command`, `convergence`, `convergence.<ZIP>`, `agencies`, a wing
  (`legal`, `home`, `health`), an atlas (`hvac`, `dental`, `core`, ...) or an atlas and a module (`hvac.paid`, `core.pulse`).

Opening a route from the popup, the keyboard command or the address bar reuses the console tab that is already open (the one
you can see, if several are), so its live atlases stay live: that tab navigates and comes forward. The popup's "Open in a new tab" switch changes this for all three;
in the address bar, Alt+Enter and Shift+Enter open a new tab regardless.

Firefox is not covered: it has no sandboxed extension pages (the `sandbox` manifest key), which this app depends on.

## How it works

Manifest V3 forbids inline scripts on extension pages. The console and every atlas are built from inline scripts, and the
atlases unpack further inline documents at run time, so rewriting them into external files is not an option. Instead:

- `console/Leviathan.html` is declared a **sandboxed page**. Chrome serves it with a content security policy that allows inline
  scripts and gives it, and every frame inside it, an opaque origin. That is also why the console cannot use `localStorage` or any
  extension API: it has no origin to key them on.
- `app.html` is an ordinary extension page that frames the console edge to edge. It hands the console its preferences in the
  query string, writes them to `chrome.storage.local` when they change, mirrors the console's route into the tab's URL, and
  answers the popup and the omnibox when they look for an open console tab.
- The atlases talk to the console through `window.parent.__LEVIATHAN`, a direct call that the sandbox turns into a security
  error. `console/ext/host-bridge.js`, loaded ahead of the console's frame script, puts a small shim at the top of every atlas
  document before it is framed. The shim stands in for `window.parent` (a replaceable property), answers the questions an atlas
  asks at start (theme, rail, initial route) from a seed the console writes into it, and carries everything else over
  `postMessage`: `register`, `moduleChanged`, `moduleTheme`, `navigate`, `save` and a `state` snapshot up; `setTheme`, `rail`,
  `go` and `brand` down. On the console side
  the bridge registers a proxy api whose `current()` and `route()` answer from the last snapshot the atlas sent, so the console's
  own code runs unchanged.
- The shell atlases (Dental Divide, Ocular Health, Termination Exposure) nest their module documents in frames of their own
  and used to reach into them with `contentDocument` for the theme and to hide the module's masthead. Those frames are cross
  origin here too, so the atlas shim hooks the `srcdoc` setter, plants a second shim in each module document, and relays the
  theme to it; the module document clicks its own theme toggle (whose handler redraws its charts), or sets the attribute when
  it has none, and applies the same chrome tweaks itself.

The six patches, each anchored on text that must occur exactly once (`lib/patch.mjs`): in the frame script, the bridge script
tag, `isFramed()` answering false (the wrapper is not a viewer, so downloads stay on), the preference loader and saver going
through the bridge, and the `srcdoc` assignment going through `wrapAtlas`; in the head, a version marker.

## Files

```
manifest.json            MV3; storage is the only permission; console/Leviathan.html sandboxed with its own CSP; omnibox keyword lev; the open-console command
app.html / app.js        the wrapper: frames the console, keeps preferences and recents, mirrors the route, answers the popup
popup.html / popup.js    the launcher
open.js                  shared by the popup and the background: registry search, find or open the console tab
background.js            service worker: open on install, the keyboard command, the omnibox
registry.js              generated from the console: wings, dashboards, modules, console version (read by the popup, the omnibox, the wrapper)
console/Leviathan.html   the console, patched (26.5 MB)
console/Leviathan-data.js, Leviathan-data-2.js   the companion payloads the console loads on demand (25.7 MB and 9.5 MB), as in the Leviathan repository
console/ext/host-bridge.js   the console side of the bridge and the two shims it plants
icons/                   the console's mark at 16, 32, 48 and 128 pixels (tools/icons.mjs renders them)
lib/patch.mjs            the anchored patches, the registry extraction, the zip writer (build only, not shipped)
build.mjs                rebuild from ../leviathan, validate, test, zip (not shipped)
package.json             the Playwright dev dependency for the end to end run and the icon renderer (not shipped)
tests/                   unit tests and the Playwright end to end run (not shipped)
```

## Rebuilding after a new console build

`console/` is generated from the console beside this folder and committed, so the extension loads straight from a checkout.
After `leviathan/` changes, regenerate it:

```
node build.mjs                 # rebuild console/ and registry.js from ../leviathan, validate, run the unit tests
node build.mjs --from <dir>    # from another Leviathan checkout (its root or its leviathan/ folder)
node build.mjs --fetch         # from GitHub (main; --branch <name> for another branch)
node build.mjs --zip           # also write ../dist/leviathan-extension.zip (not committed)
```

The build fails loudly if an anchor in the frame script has moved; the fix is in `lib/patch.mjs`. Then click Reload on
`chrome://extensions`. `--check` validates only and reports when `console/` is out of step with `../leviathan`; `--no-test`
skips the tests. The rebuild is reproducible: the same console gives the same bytes, so a rebuild with nothing changed
leaves the working tree clean.

## Tests

Node 22. The build and the unit tests need no packages. The end to end run and `tools/icons.mjs` need Playwright: `npm install`
in this folder, then `npx playwright install chromium` (or point `PLAYWRIGHT_BROWSERS_PATH` at browsers you already have).

- `node tests/run.mjs` runs the unit tests: the anchored patches and the registry extraction on a synthetic console, the bridge
  and both shims driven through fake `postMessage` traffic in a vm, the manifest and the extension pages, and the built console
  (markers, companion payloads, `registry.js` in step, byte for byte the patched `../leviathan` console).
- `node tests/e2e/run.mjs` loads the unpacked extension into headless Chromium with Playwright and checks the whole chain: the
  console starts sandboxed, the Thermal Debt Atlas (inline payload), the Dental Divide Atlas (companion script, nested module
  documents) and OmegaWeapon register over the bridge, the Dark button reaches the atlases and a nested module document, the
  preference lands in storage and survives a reload, the tab URL follows the console and drives it, the popup lists and finds
  the dashboards, and a route from the popup lands in the open console tab. Screenshots land in `tests/e2e/console.png` and
  `tests/e2e/popup.png`.
