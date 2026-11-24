// Legion · the page: boot, layout, selection, keyboard, deep links and the animation loop.
//
// Boot reads the world pack (inline in the built Legion.html as window.__LEGION_PACK__, or fetched from
// ../../data/world.json.gz when this folder is served for development), builds the world and the population
// through services, mounts the top bar, the map stage, the Place and NPC panels and Settings, then starts the
// crowd building in the background. Everything after that is events on the bus.

import { services } from './services.mjs';
import { bus, EVENTS } from './bus.mjs';
import { Settings, applyTheme, mountSettingsDialog } from './settings.mjs';
import { SimClock, mountClockControls } from './simclock.mjs';
import { mountSearch } from './search.mjs';
import { Stage } from './stage.mjs';
import { PlacePanel } from './place-panel.mjs';
import { NpcPanel } from './npc-panel.mjs';
import { LocalMindStore } from './store.mjs';
import { zipScope, scopeFromSearch, scopeFromKey, scopeBBox } from './census.mjs';
import { h, $, icon, logoMark, toast, prefersReducedMotion } from './dom.mjs';
import { fmtInt, fmtCompact } from './format.mjs';

const STEPS = [
  ['pack', 'Unpacking the world pack'],
  ['world', 'Indexing ZIP codes and Census tables'],
  ['people', 'Seeding the population'],
  ['map', 'Drawing the state'],
];

/** An Error with a sentence telling the user what to do. */
function withHint(error, hint) { error.hint = hint; return error; }

/** Resolve after the browser has had a chance to paint (with a timer fallback for throttled tabs). */
function paint() {
  return new Promise(resolve => {
    let done = false;
    const go = () => { if (!done) { done = true; resolve(); } };
    requestAnimationFrame(() => setTimeout(go, 0));
    setTimeout(go, 60);
  });
}

/** The world pack: inline (built file) or fetched next to the sources (development). */
async function packSource() {
  const inline = window.__LEGION_PACK__;
  if (typeof inline === 'string' && inline.length > 1000) return inline;
  const url = new URL('../../data/world.json.gz', location.href);
  let res;
  try { res = await fetch(url); } catch {
    throw withHint(new Error(`This page has no world pack inside it, and ${url.pathname} could not be fetched.`),
      'Open the built legion/Legion.html (node tools/build.mjs makes it), or serve the legion folder over http and open src/app/index.html.');
  }
  if (!res.ok) throw withHint(new Error(`The world pack could not be fetched (${res.status} ${res.statusText}).`), 'Build legion/Legion.html with node tools/build.mjs and open that file.');
  return new Uint8Array(await res.arrayBuffer());
}

/** The loading screen. */
function bootScreen() {
  const steps = $('#boot-steps'), bar = $('#boot-bar > span'), mark = $('#boot-mark');
  if (mark && !mark.firstChild) mark.append(logoMark(56));
  const items = new Map();
  for (const [key, text] of STEPS) { const li = h('li', text); items.set(key, li); steps.append(li); }
  let done = 0;
  return {
    start(key, text) { const li = items.get(key); if (text) li.textContent = text; li.className = 'is-active'; },
    done(key) { items.get(key).className = 'is-done'; done++; bar.style.width = `${Math.max(4, Math.round(100 * done / STEPS.length))}%`; },
    finish() { const el = $('#boot'); el.classList.add('is-done'); el.setAttribute('aria-hidden', 'true'); setTimeout(() => el.remove(), 450); },
    fail(error) {
      document.documentElement.dataset.state = 'error';
      for (const li of items.values()) if (li.className === 'is-active') li.className = '';
      const card = $('#boot .boot-card');
      card.append(h('div.boot-error', { role: 'alert' },
        h('h2', 'Legion could not start'),
        h('p', error && error.message ? error.message : String(error)),
        error && error.hint ? h('p', error.hint) : null,
        error && error.stack ? h('details', h('summary', 'Technical details'), h('pre', error.stack)) : null));
    },
  };
}

/** A performance mark per boot step (legion:pack, legion:world, legion:people, legion:map), for diagnostics. */
function mark(step) { try { performance.mark(`legion:${step}`); } catch { /* marks are optional */ } }

function buildId() {
  const meta = document.querySelector('meta[name="legion-build"]');
  return meta ? meta.getAttribute('content') : 'dev';
}

async function boot() {
  const ui = bootScreen();
  try {
    if (typeof DecompressionStream !== 'function') {
      throw withHint(new Error('This browser cannot decompress the world pack (no DecompressionStream).'), 'Use a current version of Chrome, Edge, Firefox or Safari.');
    }
    ui.start('pack');
    await paint();
    const pack = await services.unpack(await packSource());
    mark('pack');
    ui.done('pack');

    ui.start('world');
    await paint();
    services.init(pack);
    const world = services.world;
    world.raster();   // the ZIP raster, built now so the first click on the map answers at once
    mark('world');
    ui.done('world');

    ui.start('people', `Seeding ${fmtInt(world.totalPop)} Californians in ${fmtInt(world.totalHH)} households`);
    await paint();
    services.setMindStore(new LocalMindStore());
    mark('people');
    ui.done('people');

    ui.start('map');
    await paint();
    const app = mount(world);
    mark('map');
    ui.done('map');

    document.documentElement.dataset.state = 'ready';
    ui.finish();
    app.ready();
  } catch (error) {
    console.error('[legion] boot failed', error);
    ui.fail(error);
  }
}

/**
 * Mount the app on a loaded world. Returns `{ready}`, called once the loading screen is gone.
 * @param {object} world
 */
function mount(world) {
  const initialHash = location.hash;   // read before anything writes the hash
  const settings = new Settings({ bus, models: services.models().map(m => m.id), efforts: services.efforts() });
  applyTheme(settings.values.theme);
  const clock = new SimClock({ t0: world.snapshotTime, speed: 60, playing: !prefersReducedMotion(), bus });
  const getTime = () => clock.t;
  const wide = () => window.matchMedia('(min-width: 1180px)').matches;

  // ---- top bar
  $('#brand').prepend(logoMark(22));
  $('#search-icon').append(icon('search', { size: 16 }));
  const settingsBtn = $('#settings-button');
  settingsBtn.append(icon('sliders'));
  settingsBtn.title = 'Settings';
  const themeBtn = $('#theme-button');
  const clockUI = mountClockControls($('#clock-host'), clock);

  // ---- stage and panels
  const stageEl = $('#stage');
  const stage = new Stage({ root: stageEl, mapEl: $('#map'), services, bus, theme: settings.resolvedTheme(), getTime });
  stage.start();

  let scope = null;
  let street = null;
  let npcOpener = null;   // the control that opened the NPC panel, to give focus back when it closes
  // a closed panel cannot hold focus: hand it back to what opened the panel, else to the map
  function restoreFocus(opener) {
    const a = document.activeElement;
    if (a && a !== document.body && a.isConnected && !a.closest('[hidden]')) return;
    if (opener && opener.isConnected && !opener.closest('[hidden]')) opener.focus();
    else $('#map').focus({ preventScroll: true });
  }
  const placePanel = new PlacePanel({
    el: $('#place-panel'), services, bus, getTime,
    onStreetView: s => openStreetView(s),
    onClose: () => { scope = null; stage.setScope(null); layoutChanged(); restoreFocus(null); },
  });
  const npcPanel = new NpcPanel({
    el: $('#npc-panel'), services, bus, settings, getTime,
    onLocate: npc => locate(npc),
    onBack: () => npcPanel.close(),
    onClose: () => { stage.setNpc(null); layoutChanged(); restoreFocus(npcOpener); },
    openSettings: () => dialog.open(),
  });
  const dialog = mountSettingsDialog($('#settings-dialog'), {
    settings, services, world, buildId: buildId(),
    getBuild: () => stage.build,
    onClearMinds: () => services.resetMinds(),
  });
  settingsBtn.addEventListener('click', () => dialog.open());

  const search = mountSearch({
    input: $('#search-input'), list: $('#search-list'), world, population: services.population,
    onChoose: item => {
      if (item.kind === 'npc') { bus.emit(EVENTS.NPC_SELECT, { id: item.id, source: 'search' }); return; }
      const s = scopeFromSearch(world, item);
      if (s) bus.emit(EVENTS.PLACE_SELECT, { zi: s.kind === 'zip' ? s.zi : -1, kind: s.kind, key: s.key, source: 'search' });
    },
  });

  // ---- layout

  function updateInsets() {
    const sr = stageEl.getBoundingClientRect();
    let left = 0, right = 0, bottom = 0;
    for (const p of [placePanel.el, npcPanel.el]) {
      if (p.hidden) continue;
      const r = p.getBoundingClientRect();
      if (r.width >= sr.width * 0.85) bottom = Math.max(bottom, sr.bottom - r.top);
      else if (r.left - sr.left < sr.width * 0.4) left = Math.max(left, r.right - sr.left);
      else right = Math.max(right, sr.right - r.left);
    }
    stage.setInsets({ left, right, bottom, top: 0 });
    stageEl.style.setProperty('--inset-left', `${Math.round(left)}px`);
    stageEl.style.setProperty('--inset-right', `${Math.round(right)}px`);
    stageEl.style.setProperty('--inset-bottom', `${Math.round(bottom)}px`);
  }

  function writeHash() {
    const p = new URLSearchParams();
    if (scope) p.set(scope.kind, scope.key);
    if (npcPanel.id) p.set('npc', npcPanel.id);
    const s = p.toString();
    try { history.replaceState(null, '', s ? `#${s}` : `${location.pathname}${location.search}`); } catch { /* sandboxed: no deep link */ }
  }

  function layoutChanged() {
    document.body.toggleAttribute('data-place-open', placePanel.isOpen());
    document.body.toggleAttribute('data-npc-open', npcPanel.isOpen());
    updateInsets();
    requestAnimationFrame(updateInsets);
    writeHash();
  }
  window.addEventListener('resize', () => requestAnimationFrame(updateInsets));

  // ---- selection

  function showPlace(next, { fly = true, keepNpc = false } = {}) {
    if (!next) return;
    if (!keepNpc && !wide() && npcPanel.isOpen()) npcPanel.close();
    scope = next;
    placePanel.open(next);
    stage.setScope(next);
    layoutChanged();
    if (fly) stage.flyToBBox(scopeBBox(world, next), { maxScale: next.kind === 'zip' ? 40 : 30 });
  }

  function locate(npc) {
    const home = npc.household && npc.household.home, work = npc.commute && npc.commute.work;
    if (!home || !Number.isFinite(home.x)) return;
    if (work && Number.isFinite(work.x) && world.distKm(home.x, home.y, work.x, work.y) < 160) {
      stage.flyToBBox([Math.min(home.x, work.x), Math.min(home.y, work.y), Math.max(home.x, work.x), Math.max(home.y, work.y)], { maxScale: 30, pad: 70 });
    } else stage.flyToPoint(home.x, home.y, 30);
  }

  bus.on(EVENTS.PLACE_SELECT, ({ zi, kind, key, source } = {}) => {
    let next = null;
    if ((kind === 'zip' || !kind) && Number.isInteger(zi) && zi >= 0) next = zipScope(world, zi);
    else if (kind && key) next = scopeFromKey(world, kind, key);
    if (!next) { if (source === 'map') placePanel.close(); return; }
    showPlace(next, { fly: source !== 'map' });
  });

  // where the selected NPC is now: the crowd's own position when the NPC is in it (so the marker sits on their
  // dot), else the schedule's (when wired): on the move, or at the place of the activity
  function nowMarker(t) {
    const a = npcPanel.refreshNow(t);
    let pos = null;
    const crowd = stage.crowd;
    if (crowd && typeof crowd.positionOf === 'function' && npcPanel.id) { try { pos = crowd.positionOf(npcPanel.id); } catch { pos = null; } }
    if (!pos && a) pos = a.position || (a.place && Number.isFinite(a.place.x) ? a.place : null);
    stage.setNpcNow(pos);
  }
  bus.on(EVENTS.TIME_CHANGE, ({ t }) => { if (npcPanel.isOpen()) nowMarker(t); });

  bus.on(EVENTS.NPC_SELECT, ({ id, source } = {}) => {
    if (!id) { npcPanel.close(); return; }
    const opener = document.activeElement;
    if (!npcPanel.open(id, { focus: source !== 'map' && source !== 'link' })) return;
    if (opener && opener !== document.body && !npcPanel.el.contains(opener)) npcOpener = opener;
    const npc = npcPanel.npc;
    stage.setNpc(npc);
    nowMarker(clock.t);
    if (source === 'search' || source === 'link') {
      showPlace(zipScope(world, npc.zi), { fly: false, keepNpc: true });
      locate(npc);
    }
    layoutChanged();
  });

  // ---- street view (when the module is wired)

  function openStreetView(s) {
    const zi = s.kind === 'zip' ? s.zi : s.zis.reduce((a, b) => ((world.z.pop[b] || 0) > (world.z.pop[a] || 0) ? b : a), s.zis[0]);
    const canvas = h('canvas.street-canvas', { 'aria-label': `Street view of ${s.title}` });
    const r = services.streetView(canvas, {
      getTime, bus, allowNetwork: settings.values.network.osm,
      onSelect: id => bus.emit(EVENTS.NPC_SELECT, { id, source: 'street' }),
    });
    if (!r.ok) { toast(r.message, { kind: 'error' }); return; }
    const layer = h('div.street-layer', { style: 'position:absolute;inset:0;z-index:3;background:var(--map-bg)' }, canvas,
      h('button.btn', { type: 'button', style: 'position:absolute;top:12px;left:12px', on: { click: () => closeStreetView() } }, icon('back', { size: 16 }), 'Back to the map'));
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    stageEl.append(layer);
    street = { view: r.value, layer };
    try { r.value.open(world.z.tx[zi], world.z.ty[zi]); } catch (e) { toast(`Street view failed: ${e.message || e}`, { kind: 'error' }); closeStreetView(); return; }
    bus.emit(EVENTS.VIEW_CHANGE, { mode: 'street', x: world.z.tx[zi], y: world.z.ty[zi], zoom: null });
  }

  function closeStreetView() {
    if (!street) return;
    try { street.view.close(); } catch (e) { console.error('[legion] street view close failed', e); }
    street.layer.remove();
    street = null;
    const c = stage.map && stage.map.camera;
    bus.emit(EVENTS.VIEW_CHANGE, { mode: 'map', x: c && c.x, y: c && c.y, zoom: c && c.zoom });
  }

  // ---- theme, settings, density

  function syncThemeButton() {
    const dark = settings.resolvedTheme() === 'dark';
    themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'));
    themeBtn.setAttribute('aria-label', dark ? 'Switch to the light theme' : 'Switch to the dark theme');
    themeBtn.title = dark ? 'Light theme' : 'Dark theme';
  }
  syncThemeButton();
  themeBtn.addEventListener('click', () => settings.set({ theme: settings.resolvedTheme() === 'dark' ? 'light' : 'dark' }));
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (settings.values.theme !== 'system') return;
      applyTheme('system'); stage.setTheme(settings.resolvedTheme()); syncThemeButton();
    });
  } catch { /* old browsers: the theme follows on reload */ }

  async function rebuildCrowd() {
    dialog.refresh();
    await stage.buildCrowd(settings.values.density);
    dialog.refresh();
    updateCounts();
  }

  async function detectProxy() {
    if (!/^https?:$/.test(location.protocol) || !settings.values.network.claude) { settings.setProxyURL(''); return; }
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 1500);
      const res = await fetch('/api/health', { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(timer);
      const body = res.ok && /json/.test(res.headers.get('content-type') || '') ? await res.json() : null;
      settings.setProxyURL(body && typeof body === 'object' && body.claude !== false ? '/api/claude' : '');
    } catch { settings.setProxyURL(''); }
  }

  bus.on(EVENTS.SETTINGS_CHANGE, ({ changed }) => {
    if (changed.includes('theme')) { applyTheme(settings.values.theme); stage.setTheme(settings.resolvedTheme()); syncThemeButton(); }
    if (changed.includes('density')) rebuildCrowd();
    if (changed.includes('network.claude')) detectProxy();
    dialog.refresh();
  });

  // ---- counts

  const countEls = ['#count-agents', '#count-moving', '#count-agents-m', '#count-moving-m'].map(s => $(s));
  function updateCounts() {
    const c = stage.counts();
    const pending = stage.build.building && !c.agents;
    const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    set(countEls[0], pending ? '…' : fmtInt(c.agents));
    set(countEls[1], pending ? '…' : fmtInt(c.moving));
    set(countEls[2], pending ? '…' : fmtCompact(c.agents));
    set(countEls[3], pending ? '…' : fmtCompact(c.moving));
    stage.updateLegend(c.byKind);
  }

  // ---- keyboard

  const interactive = el => !!(el && el.closest && el.closest('input, textarea, select, button, a[href], summary, [contenteditable=""], [contenteditable="true"], [role="tab"], [role="radio"], [role="switch"], [role="option"], [role="button"], dialog'));
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    // text entry only (a focused radio, checkbox or range is not typing: '/' and Escape act as usual there)
    const typing = e.target && e.target.closest && e.target.closest('textarea, select, [contenteditable=""], [contenteditable="true"], input:not([type]), input[type=text], input[type=search], input[type=email], input[type=password], input[type=url], input[type=tel], input[type=number]');
    if (e.key === '/' && !typing) { e.preventDefault(); search.focus(); return; }
    if ((e.key === ' ' || e.code === 'Space') && !interactive(e.target)) { e.preventDefault(); clock.toggle(); return; }
    if (e.key === 'Escape') {
      if (dialog.isOpen()) return;                       // the dialog closes itself
      if (typing) { e.target.blur(); return; }           // first Escape leaves the field (a draft survives)
      if (street) { closeStreetView(); return; }
      if (npcPanel.isOpen()) { npcPanel.close(); return; }
      if (placePanel.isOpen()) { placePanel.close(); }
    }
  });

  // ---- errors after boot: tell the user once in a while, never in a loop
  let lastErrorToast = 0;
  const report = msg => {
    if (!msg || /ResizeObserver loop/.test(msg)) return;
    const now = Date.now();
    if (now - lastErrorToast > 6000) { lastErrorToast = now; toast(`Something went wrong: ${msg}`, { kind: 'error', timeout: 5000 }); }
  };
  window.addEventListener('error', e => report(e.message));
  window.addEventListener('unhandledrejection', e => report(e.reason && e.reason.message ? e.reason.message : String(e.reason)));

  // ---- the animation loop
  let last = performance.now(), lastCounts = 0;
  function frame(now) {
    const dt = Math.min(250, Math.max(0, now - last));
    last = now;
    clock.advance(dt);
    clockUI.update();
    stage.frame(clock.t);
    if (now - lastCounts > 500) { lastCounts = now; updateCounts(); }
    requestAnimationFrame(frame);
  }

  // ---- deep links: #zip=94110, #city=…, #county=06075, #region=ba, #npc=94110-12-0
  function openFromHash() {
    const p = new URLSearchParams(initialHash.slice(1));
    for (const kind of ['zip', 'city', 'county', 'region']) {
      const key = p.get(kind);
      const s = key ? scopeFromKey(world, kind, key) : null;
      if (s) { showPlace(s); break; }
    }
    const id = p.get('npc');
    if (id) bus.emit(EVENTS.NPC_SELECT, { id, source: scope ? 'place' : 'link' });
  }

  window.legion = Object.freeze({
    services, bus, settings, clock, stage, placePanel, npcPanel, dialog,
    get world() { return services.world; },
    get map() { return stage.map; },
    get crowd() { return stage.crowd; },
    build: buildId(),
    /** Open an NPC by id. */
    select(id) { bus.emit(EVENTS.NPC_SELECT, { id, source: 'link' }); },
    /** Open a ZIP's Place panel. */
    place(zip) { const zi = world.indexOf(zip); if (zi >= 0) bus.emit(EVENTS.PLACE_SELECT, { zi, kind: 'zip', key: String(zip), source: 'search' }); },
  });

  return {
    ready() {
      requestAnimationFrame(frame);
      openFromHash();
      layoutChanged();
      rebuildCrowd();
      detectProxy();
    },
  };
}

boot();
