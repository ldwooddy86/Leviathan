// Legion · crowd development page (src/world/dev.html, served over http from legion/).
//
// URL parameters: rate (share of households, default 0.01), theme (dark | light), t (epoch ms or a Pacific
// 'YYYY-MM-DDTHH:MM'), play (1 to start the clock), speed (sim seconds per second), worker (0 = build on the main
// thread), pack (0 = do not hand the fetched pack to the Crowd: it uses window.__LEGION_PACK__ or world.pack), keep
// (0..1 drawn share, fixed). window.__legionDev exposes {world, pop, map, crowd, setTime, ready, done, summary}.

import { loadPack, createWorld } from '../engine/world.mjs';
import { Population, LEGION_SEED } from '../engine/population.mjs';
import { atPacific, pacific, fmtTime } from '../engine/clock.mjs';
import { MapView } from './map.mjs';
import { Crowd, CROWD_COLORS } from './crowd.mjs';

const $ = id => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = n => Math.round(n).toLocaleString('en-US');

const WEEK0 = atPacific(2026, 11, 22, 0, 0); // Sunday of the NWS snapshot week
const dev = window.__legionDev = { done: false, error: null };
let readyResolve;
dev.ready = new Promise(r => { readyResolve = r; });

function parseTime(s) {
  if (s == null || s === '') return null;
  if (/^\d{10,}$/.test(s)) return +s;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  return m ? atPacific(+m[1], +m[2], +m[3], +m[4], +m[5]) : null;
}

function status(text, frac = null) {
  $('status').textContent = text;
  if (frac != null) $('bar').firstElementChild.style.width = `${Math.round(clamp(frac, 0, 1) * 100)}%`;
}

async function main() {
  const theme = qs.get('theme') === 'light' ? 'light' : 'dark';
  document.body.dataset.theme = theme;
  $('theme').textContent = theme === 'dark' ? 'Light' : 'Dark';
  let rate = clamp(+qs.get('rate') || 0.01, 0.0001, 0.25);
  const sel = $('rate');
  if (![...sel.options].some(o => +o.value === rate)) sel.add(new Option(String(rate), String(rate)));
  sel.value = String(rate);

  const t0 = performance.now();
  const res = await fetch('../../data/world.json.gz');
  if (!res.ok) throw new Error(`world pack: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const world = createWorld(await loadPack(bytes));
  const pop = new Population(world, { seed: LEGION_SEED });
  const map = new MapView($('map'), { world, theme });
  const crowd = new Crowd(map, { world, population: pop, rate, seed: 1, pack: qs.get('pack') === '0' ? null : bytes, worker: qs.get('worker') !== '0' });
  if (qs.has('keep')) crowd.setQuality({ keep: +qs.get('keep'), auto: false });
  Object.assign(dev, { world, pop, map, crowd, atPacific, loadMs: Math.round(performance.now() - t0) });

  // ---- clock
  let t = parseTime(qs.get('t')) ?? atPacific(2026, 11, 24, 8, 0);
  let playing = qs.get('play') === '1';
  let speed = +qs.get('speed') || 60;
  if (![...$('speed').options].some(o => +o.value === speed)) $('speed').add(new Option(`${speed}×`, String(speed)));
  $('speed').value = String(speed);
  const setTime = nt => {
    t = nt;
    crowd.setTime(t);
    const p = pacific(t);
    $('slider').value = String(clamp(Math.floor((t - WEEK0) / 60000), 0, 10079));
    $('clock').textContent = `${p.dayName.slice(0, 3)} ${fmtTime(t).split(', ')[1]} · ${p.monthName.slice(0, 3)} ${p.day}`;
  };
  dev.setTime = setTime;
  Object.defineProperty(dev, 't', { get: () => t });
  setTime(t);
  $('slider').addEventListener('input', e => { setTime(WEEK0 + (+e.target.value) * 60000); });
  $('speed').addEventListener('change', e => { speed = +e.target.value; });
  const setPlaying = on => { playing = on; $('play').textContent = on ? 'Pause' : 'Play'; if (on) { last = performance.now(); requestAnimationFrame(tick); } };
  $('play').addEventListener('click', () => setPlaying(!playing));
  let last = performance.now(), frames = 0, fpsAt = performance.now(), fps = 0;
  function tick(now) {
    if (!playing) return;
    const dt = Math.min(250, now - last);
    last = now;
    let nt = t + dt * speed;
    if (nt >= WEEK0 + 7 * 86400000) nt = WEEK0 + ((nt - WEEK0) % (7 * 86400000));
    setTime(nt);
    frames++;
    if (now - fpsAt > 1000) { fps = frames * 1000 / (now - fpsAt); frames = 0; fpsAt = now; }
    requestAnimationFrame(tick);
  }
  setPlaying(playing);

  // ---- layers
  const kinds = ['walk', 'drive', 'bike', 'transit', 'errand', 'home'];
  const swatch = { walk: 'walk', drive: 'drive-out', bike: 'bike', transit: 'transit', errand: 'errand', home: 'home' };
  const visible = new Set(crowd.visibleKinds());
  for (const k of kinds) {
    const label = document.createElement('label');
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: visible.has(k) });
    const sw = document.createElement('span');
    sw.className = 'sw';
    sw.style.background = CROWD_COLORS.dark[swatch[k]];
    if (k === 'drive') sw.style.background = `linear-gradient(90deg, ${CROWD_COLORS.dark['drive-out']} 50%, ${CROWD_COLORS.dark['drive-home']} 50%)`;
    cb.addEventListener('change', () => { cb.checked ? visible.add(k) : visible.delete(k); crowd.setVisible([...visible]); });
    label.append(cb, sw, k === 'home' ? 'at home' : k);
    $('kinds').append(label);
  }

  $('theme').addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = next;
    map.setTheme(next);
    crowd.setTime(t);
    $('theme').textContent = next === 'dark' ? 'Light' : 'Dark';
  });

  // ---- picking
  const tip = $('tip');
  map.on('hover', h => {
    if (!h) { tip.style.display = 'none'; return; }
    const hit = crowd.pick(h.x, h.y, 7 / map.camera.zoom);
    if (!hit) { tip.style.display = 'none'; return; }
    tip.textContent = `${hit.id} · ${hit.state}${hit.travel ? ' · ' + hit.travel : ''}`;
    tip.style.left = `${h.px}px`; tip.style.top = `${h.py}px`; tip.style.display = 'block';
  });
  map.on('click', e => {
    const hit = e.hit;
    if (!hit) { $('pick').textContent = 'Nothing there; click a moving dot.'; return; }
    const lines = [`${hit.id}  (${world.z.city[hit.zi]})`, `${hit.state}${hit.travel ? ' by ' + hit.travel : ''}`, `commute mode: ${hit.mode || 'none'}`];
    try {
      const npc = pop.person ? pop.person(hit.zi, hit.h, hit.m) : null;
      if (npc) {
        lines.push(`${npc.name && npc.name.display ? npc.name.display : ''}, ${npc.age}`);
        if (npc.occupation) lines.push(`${npc.occupation.title || npc.occupation.key}`);
        if (npc.commute && npc.commute.minutes) lines.push(`${npc.commute.minutes} min commute to ${npc.commute.workCity || 'work'}`);
      }
    } catch (err) { lines.push(String(err.message || err)); }
    $('pick').innerHTML = '';
    $('pick').append(Object.assign(document.createElement('pre'), { textContent: lines.join('\n') }));
  });

  // ---- stats
  const statRows = [['moving', s => s.movingTotal], ['· walking', s => s.moving.walk], ['· driving', s => s.moving.drive], ['· cycling', s => s.moving.bike], ['· transit', s => s.moving.transit], ['· errands', s => s.moving.errand], ['at work or school', s => s.atWork], ['out on errands', s => s.atErrand], ['at home', s => s.atHome], ['agents', s => s.agents]];
  setInterval(() => {
    const s = crowd.stats();
    $('stats').innerHTML = statRows.map(([k, f]) => `<tr><td>${k}</td><td>${fmt(f(s) || 0)}</td></tr>`).join('');
    const sum = crowd.summary;
    $('perf').textContent = `${crowd.renderer || 'canvas 2D'}${crowd.software ? ' (software)' : ''} · drawn ${Math.round(crowd.keep * 100)}%${playing ? ` · ${fps.toFixed(0)} fps` : ''}${sum ? ` · built in ${sum.totalMs} ms (${sum.mode})` : ''}`;
  }, 250);

  // ---- build
  const build = async r => {
    status(`Building the crowd at ${r * 100}% of households…`, 0);
    const summary = await crowd.build({
      rate: r,
      onProgress: (f, n) => status(`Building… ${fmt(n)} agents`, f),
    });
    if (summary && !summary.cancelled) {
      status(`${fmt(summary.agents)} agents in ${fmt(summary.households)} households · ${summary.totalMs} ms (${summary.mode})`, 1);
      dev.summary = summary;
      dev.done = true;
      readyResolve(summary);
    }
    return summary;
  };
  $('rebuild').addEventListener('click', () => { rate = +$('rate').value; dev.done = false; build(rate); });
  $('rate').addEventListener('change', () => { rate = +$('rate').value; dev.done = false; build(rate); });
  await build(rate);
}

main().catch(err => {
  console.error(err);
  dev.error = String((err && (err.stack || err.message)) || err);
  status(`Failed: ${err && err.message ? err.message : err}`);
});
