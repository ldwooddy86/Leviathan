// Legion · the page: boot, layout, selection, keyboard, deep links and the animation loop.
//
// Boot reads the world pack (inline in the built Legion.html as window.__LEGION_PACK__, or fetched from
// ../../data/world.json.gz when this folder is served for development), builds the world and the population
// through services, mounts the top bar, the map stage, the Place and NPC panels and Settings, then starts the
// crowd building in the background. Everything after that is events on the bus.

import { services } from './services.mjs';
import { bus, EVENTS } from './bus.mjs';
import { Settings, applyTheme, mountSettingsDialog, serverFromHealth } from './settings.mjs';
import { SimClock, mountClockControls } from './simclock.mjs';
import { mountSearch } from './search.mjs';
import { Stage } from './stage.mjs';
import { PlacePanel } from './place-panel.mjs';
import { NpcPanel, activityLine } from './npc-panel.mjs';
import { LocalMindStore } from './store.mjs';
import { zipScope, scopeFromSearch, scopeFromKey, scopeBBox } from './census.mjs';
import { h, $, icon, logoMark, toast, prefersReducedMotion } from './dom.mjs';
import { fmtInt, fmtCompact, displayName } from './format.mjs';
import { placeLabel } from './stage.mjs';

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

/**
 * The world pack: inline (built file) or fetched next to the sources (development).
 * @returns {Promise<{data: string|Uint8Array, inline: boolean, where: string}>}
 */
async function packSource() {
  const inline = window.__LEGION_PACK__;
  if (typeof inline === 'string' && inline.length > 0) return { data: inline, inline: true, where: 'inside this file' };
  const url = new URL('../../data/world.json.gz', location.href);
  let res;
  try { res = await fetch(url); } catch {
    throw withHint(new Error(`This page has no world pack inside it, and ${url.pathname} could not be fetched.`),
      'Open the built legion/Legion.html (node tools/build.mjs makes it), or serve the legion folder over http and open src/app/index.html.');
  }
  if (!res.ok) throw withHint(new Error(`The world pack could not be fetched (${res.status} ${res.statusText}).`), 'Build legion/Legion.html with node tools/build.mjs and open that file.');
  return { data: new Uint8Array(await res.arrayBuffer()), inline: false, where: `at ${url.pathname}` };
}

/**
 * Decode the pack, turning the browser's low-level failures into what happened. A truncated or altered pack fails
 * inside the gzip stream (where the browser says "Failed to fetch", though nothing was fetched), in atob, or in
 * JSON.parse; all three mean the same thing to the user: the pack is damaged.
 */
async function unpack(source) {
  try {
    return await services.unpack(source.data);
  } catch (e) {
    const error = withHint(new Error(`The world pack ${source.where} is damaged and could not be unpacked.`),
      source.inline ? 'Download Legion.html again, or rebuild it with node tools/build.mjs.' : 'Rebuild the pack (tools/build_pack.py) or restore data/world.json.gz.');
    error.detail = `${e && e.name ? `${e.name}: ` : ''}${e && e.message ? e.message : String(e)}`;
    error.cause = e;
    throw error;
  }
}

/** The loading screen. */
function bootScreen() {
  const steps = $('#boot-steps'), bar = $('#boot-bar > span'), mark = $('#boot-mark');
  if (mark && !mark.firstChild) mark.append(logoMark(56));
  const items = new Map();
  for (const [key, text] of STEPS) { const li = h('li', text); items.set(key, li); steps.append(li); }
  let done = 0;
  return {
    // each step is a long synchronous task: the bar moves without a transition (a transition would only start after the
    // next task) and the caller waits for a painted frame (paint()) before starting the next step
    start(key, text) { const li = items.get(key); if (text) li.textContent = text; li.className = 'is-active'; bar.style.transition = 'none'; bar.style.width = `${Math.max(4, Math.round(100 * (done + 0.35) / STEPS.length))}%`; },
    done(key) { items.get(key).className = 'is-done'; done++; bar.style.transition = 'none'; bar.style.width = `${Math.max(4, Math.round(100 * done / STEPS.length))}%`; },
    finish() { const el = $('#boot'); el.classList.add('is-done'); el.setAttribute('aria-hidden', 'true'); setTimeout(() => el.remove(), 450); },
    fail(error) {
      document.documentElement.dataset.state = 'error';
      // the step that was running is the one that failed: mark it, so the user sees where it stopped
      for (const li of items.values()) {
        if (li.className !== 'is-active') continue;
        li.className = 'is-failed';
        li.append(h('span.sr-only', ' (failed)'));
      }
      const cause = error && error.cause;
      const technical = [error && error.detail, (cause && cause.stack) || (error && error.stack)].filter(Boolean).join('\n\n');
      const card = $('#boot .boot-card');
      card.append(h('div.boot-error', { role: 'alert' },
        h('h2', 'Legion could not start'),
        h('p', error && error.message ? error.message : String(error)),
        error && error.hint ? h('p', error.hint) : null,
        technical ? h('details', h('summary', 'Technical details'), h('pre', technical)) : null));
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
    const source = await packSource();
    // the crowd's Workers start decoding their own copies now, while this thread decodes and mounts the page
    services.prewarmCrowd(source.data);
    const pack = await unpack(source);
    mark('pack');
    ui.done('pack');

    ui.start('world');
    await paint();
    try { services.init(pack); } catch (e) {
      const error = withHint(new Error(`The world pack does not hold a Legion world (${e && e.message ? e.message : e}).`), 'Rebuild Legion.html with node tools/build.mjs.');
      error.cause = e;
      throw error;
    }
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
  // every engine hook given no time reads this clock (never the wall clock)
  services.setClock(getTime);
  services.setLiveWeather(settings.values.network.nws);
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
  // a finished crowd is kept on this device for the next visit, under this build of the page (none in development)
  const build = buildId();
  const stage = new Stage({ root: stageEl, mapEl: $('#map'), services, bus, theme: settings.resolvedTheme(), getTime, crowdCache: build && build !== 'dev' ? `legion-${build}` : null });
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
    onStreetView: s => openStreetView(placeTarget(s)),
    onNow: () => { clock.set(Date.now()); toast('The clock is at the present: live weather applies.'); },
    onClose: () => { scope = null; stage.setScope(null); layoutChanged(); restoreFocus(null); },
    onResize: () => layoutChanged(),
  });
  const npcPanel = new NpcPanel({
    el: $('#npc-panel'), services, bus, settings, getTime,
    onLocate: npc => { if (street) closeStreetView(); locate(npc); },
    onWalk: npc => openStreetView(npcTarget(npc)),
    onBack: () => npcPanel.close(),
    onClose: () => { stage.setNpc(null); if (street && street.view.selectedId) street.view.select(null); layoutChanged(); restoreFocus(npcOpener); },
    openSettings: () => dialog.open(),
    // a conversation happens in real time: the clock runs at 1x while one is on screen, then at the chosen speed again
    onTalk: on => { if (on) clock.hold(1); else clock.release(); },
    onResize: () => layoutChanged(),
  });
  const dialog = mountSettingsDialog($('#settings-dialog'), {
    settings, services, world, buildId: buildId(),
    getBuild: () => stage.build,
    onClearMinds: () => services.resetMinds(),
  });
  settingsBtn.addEventListener('click', () => dialog.open());
  // Settings hands focus back to what opened it; when that control was redrawn away meanwhile (the Talk tab's "Open
  // settings" link, gone once Claude is allowed), the NPC panel's tab takes it, else the map, never the page body
  $('#settings-dialog').addEventListener('close', () => requestAnimationFrame(() => {
    const a = document.activeElement;
    if (a && a !== document.body && a.isConnected) return;
    if (!npcPanel.restoreFocus()) restoreFocus(null);
  }));

  const search = mountSearch({
    input: $('#search-input'), list: $('#search-list'), world, population: services.population,
    onChoose: item => {
      if (item.kind === 'npc') { bus.emit(EVENTS.NPC_SELECT, { id: item.id, source: 'search' }); return; }
      const s = scopeFromSearch(world, item);
      // a one-ZIP place keeps the name it was found by ("Emeryville" is 94608, whose Census place is Oakland)
      if (s) bus.emit(EVENTS.PLACE_SELECT, { zi: s.kind === 'zip' ? s.zi : -1, kind: s.kind, key: s.key, title: s.title, source: 'search' });
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
    // on a phone the counts chip sits over the map's top edge: keep flown-to places and NPC labels below it
    const chip = document.querySelector('.counts-mobile');
    const top = chip && getComputedStyle(chip).display !== 'none' ? Math.max(0, chip.getBoundingClientRect().bottom - sr.top + 6) : 0;
    stage.setInsets({ left, right, bottom, top });
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
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => requestAnimationFrame(updateInsets));
    ro.observe(placePanel.el); ro.observe(npcPanel.el);
  }

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

  bus.on(EVENTS.PLACE_SELECT, ({ zi, kind, key, title, source } = {}) => {
    let next = null;
    if ((kind === 'zip' || !kind) && Number.isInteger(zi) && zi >= 0) next = zipScope(world, zi, { title });
    else if (kind && key) next = scopeFromKey(world, kind, key);
    if (!next) { if (source === 'map') placePanel.close(); return; }
    showPlace(next, { fly: source !== 'map' && !street });
    refreshLive(next.kind === 'zip' ? next.zi : mainZip(next));
  });

  // ---- live NWS weather (when allowed): fetched for the place and the NPC in view, cached 15 minutes per ZIP
  function mainZip(s) { return s.zis.reduce((a, b) => ((world.z.pop[b] || 0) > (world.z.pop[a] || 0) ? b : a), s.zis[0]); }
  function refreshLive(zi) {
    if (!settings.values.network.nws || !(zi >= 0)) return;
    services.refreshWeather(zi, clock.t).then(status => {
      bus.emit(EVENTS.WEATHER_CHANGE, { zi, status });
      if (status && status.state === 'error') toast(status.note, { kind: 'error', timeout: 4200 });
    });
  }

  // where the selected NPC is now. The crowd moves everyone by their layer 0 day (the commute, school, errands drawn
  // by hash); the schedule adds the persona's own outings (services, a store, the gym, a visit) that the crowd does
  // not know. During one of those the marker goes where the panel's "Now:" line says; otherwise it sits on their dot
  // when they are in the crowd, else at the schedule's position (on the move, or at the place of the activity).
  const OUTINGS = new Set(['errand', 'leisure', 'exercise', 'worship', 'visit']);
  function nowMarker(t) {
    const a = npcPanel.refreshNow(t);
    let pos = null;
    const crowd = stage.crowd;
    if (!(a && OUTINGS.has(a.kind)) && crowd && typeof crowd.positionOf === 'function' && npcPanel.id) { try { pos = crowd.positionOf(npcPanel.id); } catch { pos = null; } }
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
    refreshLive(npc.zi);
    // in the street view, the NPC chosen anywhere is the one highlighted there (the view's own pick is already)
    if (street && street.view.selectedId !== npc.id) street.view.select(npc.id);
    if ((source === 'search' || source === 'link') && !street) {
      showPlace(zipScope(world, npc.zi), { fly: false, keepNpc: true });
      locate(npc);
    }
    layoutChanged();
    // a resident opened from the Place panel: the NPC panel now covers part of the map, so the place is fitted again
    // into what is left when much of it went under the panels (a dot clicked on the map stays where it is)
    if (!street && scope && (source === 'place' || source === 'household') && wide()) {
      requestAnimationFrame(() => {
        const bb = scopeBBox(world, scope);
        if (stage.hiddenShare(bb) > 0.3) stage.flyToBBox(bb, { maxScale: scope.kind === 'zip' ? 40 : 30 });
      });
    }
  });

  // ---- street view: the neighborhood up close, on the same clock and theme as the map

  /** Where the street view opens for a place: the town point of the scope's main ZIP. */
  function placeTarget(s) {
    const zi = s.kind === 'zip' ? s.zi : mainZip(s);
    return { x: world.z.tx[zi], y: world.z.ty[zi], title: s.title, zi };
  }
  /** Where it opens for an NPC: their home, following them. */
  function npcTarget(npc) {
    const home = npc.household && npc.household.home;
    const ok = home && Number.isFinite(home.x);
    return { x: ok ? home.x : world.z.tx[npc.zi], y: ok ? home.y : world.z.ty[npc.zi], title: `${npc.name && npc.name.display ? npc.name.display : npc.id}’s street`, zi: npc.zi, follow: npc.id };
  }

  async function openStreetView(target) {
    if (street) closeStreetView({ quiet: true });
    const canvas = h('canvas.street-canvas', { 'aria-label': `Street view: ${target.title}. Click a person to meet them. Escape returns to the map.` });
    let view = null;
    const r = services.streetView(canvas, {
      getTime, theme: settings.resolvedTheme(), allowNetwork: settings.values.network.osm,
      onSelect: id => {
        if (id && id !== npcPanel.id) { bus.emit(EVENTS.NPC_SELECT, { id, source: 'street' }); return; }
        // the view's selection is the NPC panel's person: a click on open ground stops following them but keeps them
        // selected while their panel is open (the panel's close button, or a click on someone else, changes that)
        if (!id && npcPanel.isOpen()) queueMicrotask(() => { if (street && street.view === view && !view.selectedId && npcPanel.isOpen()) view.select(npcPanel.id); });
      },
    });
    if (!r.ok) { toast(r.message, { kind: 'error' }); return; }
    view = r.value;
    const back = h('button.btn.street-back', { type: 'button', title: 'Back to the map (Esc)', on: { click: () => closeStreetView() } }, icon('back', { size: 16 }), 'Back to the map');
    const followBtn = h('button.btn.small.street-follow', { type: 'button', hidden: true, 'aria-pressed': 'false', on: { click: () => view.follow(!view.following) } }, 'Follow');
    const title = h('div.street-title', h('strong', target.title), h('span.muted', `ZIP ${world.zips[target.zi]} · ${world.z.city[target.zi]}`));
    const presence = h('div.street-presence', { role: 'status', hidden: true });
    const layer = h('div.street-layer', canvas, h('div.street-bar', back, title, followBtn), presence);
    stageEl.append(layer);
    document.body.toggleAttribute('data-street-open', true);
    const off = [
      view.on('follow', ({ on }) => { followBtn.setAttribute('aria-pressed', String(on)); followBtn.textContent = on ? 'Following' : 'Follow'; }),
      view.on('select', ({ id }) => { followBtn.hidden = !id; streetPresence(); }),
      view.on('stats', st => { street.stats = st; updateCounts(); streetPresence(); }),
      view.on('error', ({ message }) => toast(`Street view: ${message}`, { kind: 'error' })),
    ];
    street = { view, layer, off, stats: null, target, presence, summary: null, presenceKey: '' };
    bus.emit(EVENTS.VIEW_CHANGE, { mode: 'street', x: target.x, y: target.y, zoom: null });
    let summary = null;
    try { summary = await view.open(target.x, target.y); } catch (e) { summary = null; toast(`Street view failed: ${e && e.message ? e.message : e}`, { kind: 'error' }); }
    if (!street || street.view !== view) return;   // closed or replaced while it was building
    if (!summary) { if (!view.scene) closeStreetView({ quiet: true }); return; }
    street.summary = summary;
    const pick = target.follow || (npcPanel.isOpen() ? npcPanel.id : null);
    if (pick) { view.select(pick); if (target.follow) view.follow(true); }
    canvas.focus({ preventScroll: true });
  }

  /** True when world point p lies inside the open street scene (a square radiusM meters from its center each way). */
  function inStreetScene(p) {
    const s = street && street.summary;
    if (!s || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    const m = 1000 * world.unitKm, half = (Number(s.radiusM) || 600) + 25;
    return Math.abs(p.x - s.x) * m <= half && Math.abs(p.y - s.y) * m <= half;
  }

  /**
   * The selected NPC may not be out on these streets right now (at work across town, or indoors): say where they
   * are, from their schedule, so following them never looks broken. Their home is "in view" only when it is in this
   * scene; someone who lives elsewhere gets where they live and a way to walk their own streets.
   */
  function streetPresence() {
    if (!street) return;
    const { view, presence } = street;
    const id = view.selectedId;
    const here = id && view.sim && typeof view.sim.agentOf === 'function' ? view.sim.agentOf(id) : null;
    if (!id || here) { presence.hidden = true; street.presenceKey = ''; return; }
    const npc = services.npc(id), a = services.activityAt(id, clock.t);
    const line = a.ok ? activityLine(a.value) : null;
    // "Heading home from the school pickup · on foot · until 2:40 PM" as "heading home from the school pickup (on foot,
    // until 2:40 PM)"
    const parts = line ? line.split(' · ') : [];
    const lower = parts.length ? `${parts[0].charAt(0).toLowerCase()}${parts[0].slice(1)}${parts.length > 1 ? ` (${parts.slice(1).join(', ')})` : ''}` : '';
    const first = npc && npc.name ? String(npc.name.first || displayName(npc.name)).split(' ')[0] : 'They';
    const home = npc && npc.household && npc.household.home;
    const homeHere = inStreetScene(home);
    // on the move by their plan but not (yet) on these blocks: say where they are headed, never "not out"
    const traveling = !!(a.ok && a.value && (a.value.traveling || a.value.travel));
    const where = npc && npc.zi >= 0 ? `They live in ${placeLabel(world.zip(npc.zi))} (${npc.zip}).` : '';
    let text;
    if (traveling) {
      const dest = a.value.place && Number.isFinite(a.value.place.x) ? a.value.place : null;
      const soon = dest && inStreetScene(dest) ? ' They will be on these streets soon.' : '';
      text = `${first} is ${lower || 'on the way'}, not in this part of the neighborhood right now.${soon}${homeHere ? '' : ` ${where}`}`.trim();
    } else {
      const away = `${first} is not out on these streets right now${lower ? `: ${lower}` : ''}.`;
      text = homeHere ? `${away} Their home is in view (outlined); follow them when they come out.` : `${away} ${where}`.trim();
    }
    const key = `${id}|${text}`;
    if (street.presenceKey !== key) {
      street.presenceKey = key;
      const walk = !homeHere && npc ? h('button.link-btn.street-walk-home', { type: 'button', on: { click: () => openStreetView(npcTarget(npc)) } }, 'Walk their streets') : null;
      presence.replaceChildren(...[h('span', text), walk ? ' ' : null, walk].filter(Boolean));
    }
    presence.hidden = false;
  }

  function closeStreetView({ quiet = false } = {}) {
    if (!street) return;
    const { view, layer, off } = street;
    street = null;
    for (const f of off) { try { f(); } catch { /* already gone */ } }
    try { view.destroy(); } catch (e) { console.error('[legion] street view close failed', e); }
    layer.remove();
    document.body.toggleAttribute('data-street-open', false);
    // the map was not drawn while the street view covered it: bring it to the clock's time and redraw it now
    stage.invalidate();
    stage.frame(clock.t);
    updateCounts();
    if (quiet) return;
    const c = stage.map && stage.map.camera;
    bus.emit(EVENTS.VIEW_CHANGE, { mode: 'map', x: c && c.x, y: c && c.y, zoom: c && c.zoom });
    $('#map').focus({ preventScroll: true });
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
      if (street) street.view.setTheme(settings.resolvedTheme());
    });
  } catch { /* old browsers: the theme follows on reload */ }

  async function rebuildCrowd() {
    dialog.refresh();
    await stage.buildCrowd(settings.values.density);
    dialog.refresh();
    updateCounts();
  }

  // Opened from the Legion server (node server/serve.mjs)? Its /api/health says where the Claude proxy lives and
  // whether the server holds a key; without one the page keeps using the player's own key.
  let proxyCheck = 0;
  async function detectProxy() {
    const run = ++proxyCheck;
    if (!/^https?:$/.test(location.protocol) || !settings.values.network.claude) { settings.setServer(null); return; }
    let body = null;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 1500);
      const res = await fetch('/api/health', { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(timer);
      body = res.ok && /json/.test(res.headers.get('content-type') || '') ? await res.json() : null;
    } catch { body = null; }
    if (run === proxyCheck) settings.setServer(serverFromHealth(body));   // a newer check wins
  }

  bus.on(EVENTS.SETTINGS_CHANGE, ({ changed }) => {
    if (changed.includes('theme')) {
      applyTheme(settings.values.theme); stage.setTheme(settings.resolvedTheme()); syncThemeButton();
      if (street) street.view.setTheme(settings.resolvedTheme());
    }
    if (changed.includes('density')) rebuildCrowd();
    if (changed.includes('network.claude')) detectProxy();
    if (changed.includes('network.nws')) {
      services.setLiveWeather(settings.values.network.nws);
      bus.emit(EVENTS.WEATHER_CHANGE, { zi: -1 });
      if (scope) refreshLive(scope.kind === 'zip' ? scope.zi : mainZip(scope));
      if (npcPanel.npc) refreshLive(npcPanel.npc.zi);
    }
    dialog.refresh();
  });

  // ---- counts

  const countEls = ['#count-agents', '#count-moving', '#count-agents-m', '#count-moving-m'].map(s => $(s));
  function updateCounts() {
    // in the street view the top bar counts the people on screen there
    const st = street && street.stats;
    const c = st ? { agents: st.agents ?? st.onScreen ?? 0, moving: st.moving ?? 0, byKind: null, fresh: true } : stage.counts();
    const pending = !st && stage.build.building && !c.agents;
    // the moving counts wait for counts that cover the whole crowd (a kept crowd shows "…" for a moment, never 0)
    const movingPending = pending || c.fresh === false;
    const label = $('#count-agents') && $('#count-agents').nextElementSibling;
    const want = st ? 'out on these streets' : 'NPCs simulated';
    if (label && label.textContent !== want) label.textContent = want;
    const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    set(countEls[0], pending ? '…' : fmtInt(c.agents));
    set(countEls[1], movingPending ? '…' : fmtInt(c.moving));
    set(countEls[2], pending ? '…' : fmtCompact(c.agents));
    set(countEls[3], movingPending ? '…' : fmtCompact(c.moving));
    stage.updateLegend(movingPending ? null : c.byKind);
  }

  // ---- keyboard

  const interactive = el => !!(el && el.closest && el.closest('input, textarea, select, button, a[href], summary, [contenteditable=""], [contenteditable="true"], [role="tab"], [role="radio"], [role="switch"], [role="option"], [role="button"], dialog'));
  // text entry only (a focused radio, checkbox or range is not typing: '/' and Escape act as usual there)
  const typingIn = el => !!(el && el.closest && el.closest('textarea, select, [contenteditable=""], [contenteditable="true"], input:not([type]), input[type=text], input[type=search], input[type=email], input[type=password], input[type=url], input[type=tel], input[type=number]'));
  // Escape in the street view goes back to the map, wherever the focus is (the street canvas included, whose own
  // handler would only clear its selection): caught on the way down, before any element below handles it
  document.addEventListener('keydown', e => {
    if (!street || e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (dialog.isOpen() || typingIn(e.target)) return;   // the dialog and a field take their own Escape first
    e.preventDefault();
    e.stopPropagation();
    closeStreetView();
  }, true);
  // the clock's own controls (the time-of-day scrubber, the speed radios) keep focus after a drag or a click, and
  // neither has a Space action worth keeping: Space plays and pauses there too
  const clockControl = el => !!(el && el.closest && el.closest('.clock input[type=range], .clock input[type=radio], .clock .scrubber'));
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = typingIn(e.target);
    if (e.key === '/' && !typing) { e.preventDefault(); search.focus(); return; }
    if ((e.key === ' ' || e.code === 'Space') && (!interactive(e.target) || clockControl(e.target))) { e.preventDefault(); clock.toggle(); return; }
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
  // A frame drawn by software WebGL (no usable GPU: some virtual machines, blocklisted drivers, headless browsers)
  // costs the CPU tens to hundreds of milliseconds on every core, which the crowd's Workers need while they build:
  // in headless Chromium a 0.5% build took 17 s drawing every frame and 7 s paused. So while a build runs and drawn
  // frames are slow, the map is drawn a quarter of the time at most. A drawn frame's cost is the time to the next
  // callback (the browser holds the next frame until the last one is on screen). The clock and its display keep
  // real time either way. While the street view is open it covers the map completely, so the statewide map and the
  // crowd are not advanced or drawn at all (closeStreetView brings them back to the clock's time); the street view
  // runs its own loop on the same clock.
  const SLOW_FRAME_MS = 40, BUILDING_DUTY = 0.25;
  let last = performance.now(), lastCounts = 0, lastDraw = -Infinity, drawCost = 16, drew = false;
  function frame(now) {
    if (drew) drawCost = 0.7 * drawCost + 0.3 * Math.min(2000, now - lastDraw);
    const dt = Math.min(250, Math.max(0, now - last));
    last = now;
    clock.advance(dt);
    clockUI.update();
    drew = !street && !(stage.build.building && drawCost > SLOW_FRAME_MS && now - lastDraw < drawCost / BUILDING_DUTY);
    if (drew) { lastDraw = now; stage.frame(clock.t); }
    if (now - lastCounts > 500) { lastCounts = now; updateCounts(); }
    requestAnimationFrame(frame);
  }

  // ---- deep links: #zip=94110, #place=Oakland, #city=… (a postal city), #county=06075 or #county=Alameda,
  // #region=ba, #npc=94110-12-0. Read at boot and again whenever the hash changes (a link pasted into an open tab);
  // the page's own writes (history.replaceState) fire no hashchange, so this never answers itself.
  const KIND_WORDS = { zip: 'ZIP', place: 'place named', city: 'postal city named', county: 'county', region: 'region', neighborhood: 'neighborhood named' };
  function openFromHash(hash = location.hash) {
    const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    let missed = null;
    for (const kind of ['zip', 'place', 'neighborhood', 'city', 'county', 'region']) {
      const key = p.get(kind);
      if (!key) continue;
      const s = scopeFromKey(world, kind, key);
      if (s) { missed = null; showPlace(s); break; }
      missed = missed || `No ${KIND_WORDS[kind]} ${key} in the data.`;
    }
    if (missed) toast(missed, { kind: 'error' });
    const id = p.get('npc');
    if (id) bus.emit(EVENTS.NPC_SELECT, { id, source: scope ? 'place' : 'link' });
  }
  window.addEventListener('hashchange', () => openFromHash(location.hash));

  window.legion = Object.freeze({
    services, bus, settings, clock, stage, placePanel, npcPanel, dialog,
    get world() { return services.world; },
    get map() { return stage.map; },
    get crowd() { return stage.crowd; },
    /** The street view while it is open (StreetView), else null. */
    get street() { return street ? street.view : null; },
    build: buildId(),
    /** Open an NPC by id. */
    select(id) { bus.emit(EVENTS.NPC_SELECT, { id, source: 'link' }); },
    /** Open a ZIP's Place panel. */
    place(zip) { const zi = world.indexOf(zip); if (zi >= 0) bus.emit(EVENTS.PLACE_SELECT, { zi, kind: 'zip', key: String(zip), source: 'search' }); },
  });

  return {
    ready() {
      requestAnimationFrame(frame);
      openFromHash(initialHash);
      layoutChanged();
      rebuildCrowd();
      detectProxy();
    },
  };
}

boot();
