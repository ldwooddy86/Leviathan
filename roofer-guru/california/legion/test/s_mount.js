/* Legion's own view mounted in a 900 by 600 element of a host page that has a Leaflet map in its own #map, its own
   #stage, #topbar and #toasts, its own styles, hash and storage. Neither may break the other. */
const wait = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const out = { checks: [] }; const ok = (c, m, d) => out.checks.push([!!c, m, d === undefined ? null : d]);
const cs = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
const mem = () => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
location.hash = '#rooftops';
const host0 = { title: document.title, h1: cs('#host-title', 'color'), btn: cs('#host-button', 'backgroundColor'), font: cs('body', 'fontFamily'), bg: cs('body', 'backgroundColor'), panel: cs('#host-note', 'backgroundColor'), topbar: cs('#topbar', 'backgroundColor'),
  mapSize: HOST.map.getSize().x + 'x' + HOST.map.getSize().y, attrs: [...document.documentElement.attributes].map(a => a.name).join(','), bodyAttrs: [...document.body.attributes].map(a => a.name).join(','), kids: document.body.children.length, toasts: document.querySelector('#toasts').children.length };
out.mem = { start: mem() };
const L = await window.__LEGION_LOAD__(); await L.ready(); out.mem.ready = mem();
/* the statewide sample against the original app's own count at 08:00 (test/out/same.txt: walk 18864, drive 54395, bike 2405, transit 9816, errand 867 of 961,346) */
const T8 = L.timeAt('08:00'); out.base = await L.crowdBase({ rate: 0.025 }); out.mem.base = mem();
const st = L.crowdNow([-124.6, 32.4, -114.0, 42.1], T8, { max: 0 }).counts;
ok(out.base.agents === 961346 && st.walk === 18864 && st.drive === 54395 && st.bike === 2405 && st.transit === 9816 && st.errand === 867, 'the statewide sample through the library counts as the original app does at 08:00', { agents: out.base.agents, walk: st.walk, drive: st.drive, bike: st.bike, transit: st.transit, errand: st.errand, home: st.home, atWork: st.atWork });
/* a crowd layer on the host's Leaflet map (what the Scout map will do) */
const bb = HOST.map.getBounds(), cr = await L.crowd(bb, T8, { max: 400, only: 'out' });
cr.people.forEach(p => HOST.L.circleMarker([p.lat, p.lon], { radius: p.moving ? 4 : 2, color: p.moving ? '#c2410c' : '#57534e', weight: 1 }).addTo(HOST.layer));
ok(cr.people.length > 20 && HOST.layer.getLayers().length === cr.people.length, 'a crowd layer drawn on the host Leaflet map from crowd(map.getBounds())', { people: cr.people.length, found: cr.found, zips: cr.zips });
/* mount */
const events = { npc: [], place: [] };
const hostEl = document.querySelector('#legion-host');
let t0 = performance.now();
const h = L.mount(hostEl, { zip: '90012', time: T8, playing: false, onNpc: id => events.npc.push(id), onPlace: z => events.place.push(z) });
await h.ready; out.mountMs = Math.round(performance.now() - t0); out.mem.mounted = mem();
const F = h.frame, FW = h.window, FD = F.contentDocument, FL = h.legion;
const r = F.getBoundingClientRect();
ok(Math.round(r.width) === 900 && Math.round(r.height) === 600, 'the frame fills the 900 by 600 host', [r.width, r.height]);
ok(FD.documentElement.dataset.state === 'ready' && FL && FL.build === L.build, 'Legion booted its own interface inside the frame', { state: FD.documentElement.dataset.state, build: FL && FL.build });
for (let i = 0; i < 120 && (FL.stage.build.building || !FL.crowd || !FL.crowd.summary); i++) await wait(500);
out.frameCrowd = { agents: FL.crowd.count, mode: FL.crowd.mode, ms: FL.stage.build.ms && Math.round(FL.stage.build.ms), workers: FL.crowd._workers.length, gl: !!FL.map.gl, software: FL.crowd.software }; out.mem.frameCrowd = mem();
ok(FL.crowd.count === 961346, 'the frame built its crowd', out.frameCrowd);
const fm = FD.getElementById('map').getBoundingClientRect(), cv = FD.querySelector('#map canvas');
ok(fm.width > 300 && fm.height > 300 && cv && cv.width > 300, "Legion's map is drawn inside the frame", { map: [Math.round(fm.width), Math.round(fm.height)], canvas: cv && [cv.width, cv.height], layoutWide: FW.matchMedia('(min-width: 1180px)').matches, frameInner: [FW.innerWidth, FW.innerHeight] });
ok(document.querySelectorAll('#map').length === 1 && document.querySelector('#map') === HOST.map.getContainer() && FD.getElementById('map') !== document.getElementById('map'), 'two elements with id map, one per document: the host one is still the Leaflet map');
await wait(1500);
ok(clean((FD.querySelector('#place-panel h2') || {}).textContent) === 'Los Angeles' && FD.querySelectorAll('#place-panel button.resident').length === 12, 'option zip: the place panel is open on 90012 with its twelve residents', clean((FD.querySelector('#place-panel h2') || {}).textContent));
ok(Math.abs(FL.clock.t - T8) < 1000 && !FL.clock.playing, 'options time and playing: the clock in the frame is at 08:00 and stopped', new Date(FL.clock.t).toISOString());
/* drive it from the host */
h.place('93546'); await wait(1500); h.select('93546-4-0'); await wait(1500);
const d = L.describe('93546-4-0', T8);
ok(clean(FD.querySelector('#npc-panel .npc-name').textContent) === d.name && clean(FD.querySelector('#npc-panel .npc-now').textContent) === d.now, "handle.select(id): the frame's NPC panel shows the person describe() gives", { name: d.name, now: d.now });
ok(events.place.includes('93546') && events.npc.includes('93546-4-0'), 'onPlace and onNpc reach the host', events);
FD.querySelector('#place-panel button.resident') && FD.querySelector('#place-panel button.resident').click(); await wait(800);
ok(events.npc.length >= 2, 'a person clicked inside the frame reaches the host through onNpc', events.npc);
/* the street view inside the frame */
const wb = FD.querySelector('#npc-panel .walk-btn'); if (wb) wb.click(); for (let i = 0; i < 60 && !(FL.street && FL.street.summary); i++) await wait(500); await wait(1500);
const sv = FL.street && FL.street.summary;
ok(sv && sv.residents > 0 && sv.buildings > 0 && FD.querySelector('canvas.street-canvas'), 'the street view opens inside the frame (generated streets: OpenStreetMap is off)', sv && { zip: sv.zip, source: sv.source, residents: sv.residents, buildings: sv.buildings, streets: sv.streets });
out.shotNow = true;
return out;
