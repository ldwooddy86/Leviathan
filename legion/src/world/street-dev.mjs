// Legion · street view dev page: ?zip=94110&t=2026-11-24T08:00&speed=1&theme=dark&net=0 (served over http from legion/).
//
// Loads the world pack from ../../data/world.json.gz, makes the population, and opens the street view at the ZIP's
// town point (or at ?x=&y= world units). A clock runs simulation time from the given Pacific wall time at the
// chosen speed; the slider jumps through the day. window.__street is the StreetView and window.__streetDev holds
// the page state for end-to-end tests.

import { loadPack, createWorld } from '../engine/world.mjs';
import { Population } from '../engine/population.mjs';
import { atPacific, pacific, fmtTime } from '../engine/clock.mjs';
import { StreetView } from './street.mjs';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const dev = { ready: false, selected: null, selects: [], error: null };
window.__streetDev = dev;

/** "2026-11-24T08:00" (Pacific wall time) → epoch ms; default: now. */
function parseT(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{1,2}):(\d{2}))?$/.exec(s || '');
  if (!m) return Date.now();
  return atPacific(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0));
}

const clock = {
  t0: parseT(q.get('t')), real0: performance.now(), speed: q.has('speed') ? +q.get('speed') : 1,
  now() { return this.t0 + (performance.now() - this.real0) * this.speed; },
  set(t) { this.t0 = t; this.real0 = performance.now(); },
  setSpeed(s) { this.t0 = this.now(); this.real0 = performance.now(); this.speed = s; },
};

async function main() {
  const bytes = new Uint8Array(await (await fetch('../../data/world.json.gz')).arrayBuffer());
  const world = createWorld(await loadPack(bytes));
  const population = new Population(world);
  dev.world = world; dev.population = population;
  let theme = q.get('theme') === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  const view = new StreetView($('view'), { world, population, getTime: () => clock.now(), allowNetwork: q.get('net') === '1', theme });
  window.__street = view;

  view.on('select', ({ id }) => {
    dev.selected = id; dev.selects.push(id);
    if (!id) { $('who').textContent = 'Click someone on the street'; $('what').textContent = ''; $('follow').setAttribute('aria-pressed', 'false'); return; }
    const npc = population.get(id);
    $('who').textContent = npc ? `${npc.name.display}, ${npc.age}` : id;
    const a = view.sim && view.sim.agentOf(id);
    $('what').textContent = `${id}${npc && npc.occupation ? ' · ' + (npc.occupation.title || npc.occupation.key) : ''}${a ? ' · ' + a.kind : ''}`;
  });
  view.on('follow', ({ on }) => $('follow').setAttribute('aria-pressed', String(on)));
  view.on('stats', s => {
    dev.stats = s;
    const rows = [['People out', s.agents], ['Moving', s.moving], ['Walking', s.walk], ['Cars', s.car], ['Bikes', s.bike], ['Buses', s.bus], ['At bus stops', s.waiting], ['Residents out', s.residentsOut], ['Through traffic', s.through], ['Parked cars', s.parked], ['In-commuters', s.commuters], ['Frame rate', s.fps + ' fps']];
    $('stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v ?? '—'}</dd>`).join('');
  });

  async function openZip(zip) {
    const zi = world.indexOf(zip);
    if (zi < 0) { dev.error = 'unknown ZIP ' + zip; return; }
    dev.ready = false;
    const x = q.has('x') ? +q.get('x') : world.z.tx[zi], y = q.has('y') ? +q.get('y') : world.z.ty[zi];
    const summary = await view.open(x, y, { radiusM: q.has('r') ? +q.get('r') : 600 });
    if (!summary) return;
    const z = world.zip(zi);
    const rows = [['ZIP', `${z.zip} ${z.city}`], ['County', z.countyName], ['Streets', `${summary.style} · ${summary.source}`], ['Street length', summary.streetKm + ' km'], ['Households', summary.households], ['Residents', summary.residents], ['Buildings', summary.buildings], ['Built in', summary.buildMs + ' ms'], ['Year built (median)', z.yb_med], ['Density', Math.round(z.density) + ' / sq mi']];
    $('place').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v ?? '—'}</dd>`).join('');
    dev.summary = summary;
    dev.ready = true;
    history.replaceState(null, '', `?zip=${zip}&t=${pacific(clock.now()).iso}&speed=${clock.speed}&theme=${theme}${$('osm').checked ? '&net=1' : ''}`);
  }

  // controls
  $('zip').value = q.get('zip') || '94110';
  $('go').onclick = () => openZip($('zip').value.trim());
  $('zip').onkeydown = e => { if (e.key === 'Enter') openZip($('zip').value.trim()); };
  $('osm').checked = q.get('net') === '1';
  $('osm').onchange = () => { view.allowNetwork = $('osm').checked; openZip($('zip').value.trim()); };
  const slider = $('slider');
  slider.oninput = () => { const p = pacific(clock.now()); clock.set(atPacific(p.year, p.month, p.day, Math.floor(+slider.value / 60), +slider.value % 60)); };
  for (const b of $('speeds').querySelectorAll('button')) b.onclick = () => { clock.setSpeed(+b.dataset.speed); markSpeed(); };
  const markSpeed = () => { for (const b of $('speeds').querySelectorAll('button')) b.setAttribute('aria-pressed', String(+b.dataset.speed === clock.speed)); };
  markSpeed();
  $('follow').onclick = () => view.follow(!view.following);
  $('theme').textContent = theme === 'dark' ? 'Light' : 'Dark';
  $('theme').onclick = () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    $('theme').textContent = theme === 'dark' ? 'Light' : 'Dark';
    view.setTheme(theme);
  };
  const tick = () => {
    const t = clock.now();
    $('clock').textContent = fmtTime(t);
    if (document.activeElement !== slider) slider.value = pacific(t).minuteOfDay;
    requestAnimationFrame(tick);
  };
  tick();
  await openZip($('zip').value.trim());
}

main().catch(err => { dev.error = String(err && err.stack || err); console.error(err); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;bottom:0;left:0;color:#f66;background:#000;padding:8px;margin:0">${dev.error}</pre>`); });
