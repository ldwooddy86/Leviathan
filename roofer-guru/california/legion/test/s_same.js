/* A fingerprint of the page's behaviour, taken the same way in the original Legion.html and in Legion.patched.html
   (flag unset). node same.js compares the two. arg: { T } */
const wait = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const digest = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + ':' + s.length; };
const L = window.legion, S = L.services, out = {};
out.globals = { __LEGION__: typeof window.__LEGION__, __LG_API__: typeof window.__LG_API__, __LGK: typeof window.__LGK, legion: Object.keys(L).join(','), embed: window.__LEGION_EMBED__ === undefined, storage: window.__LEGION_STORAGE__ === undefined };
out.title = document.title; out.state = document.documentElement.dataset.state; out.theme = document.documentElement.getAttribute('data-theme'); out.build = L.build;
for (let i = 0; i < 40 && document.getElementById('boot'); i++) await wait(250);   /* the boot card leaves 450 ms after the page is ready */
out.ids = [...document.querySelectorAll('[id]')].map(e => e.id).sort().join(' ');
out.world = [S.world.N, S.world.totalPop, S.world.totalHH, S.seed, S.world.snapshotTime];
out.settings = L.settings.public();
/* wait for the crowd to be built, then stop the clock at T */
for (let i = 0; i < 120 && (L.stage.build.building || !L.crowd || !L.crowd.summary); i++) await wait(500);
L.clock.pause(); L.clock.set(arg.T); await wait(2500);
const sm = L.crowd.summary || {};
out.crowd = { agents: L.crowd.count, rate: L.crowd.rate, chunks: L.crowd.chunks.length, byMode: sm.byMode, commuters: sm.commuters, highway: sm.highway, errands: sm.errands, mode: L.crowd.mode, verified: sm.verified };
const st = L.crowd.stats(); out.stats = { t: st.t, agents: st.agents, moving: st.moving, movingTotal: st.movingTotal, atHome: st.atHome, atWork: st.atWork, atErrand: st.atErrand, toWork: st.toWork, toHome: st.toHome };
out.counts = [clean(document.querySelector('#count-agents').textContent), clean(document.querySelector('#count-moving').textContent)];
/* four people of the 2.5 percent sample, where the crowd has them at T (the order of the chunks depends on which worker answers first, in the original too, so people are asked for by id) */
out.positions = ['93201-91-0', '93223-879-2', '90044-5525-0', '92281-518-1'].map(id => { const p = L.crowd.positionOf(id); if (p) delete p.index; return p; });
/* the place panel and the NPC panel, as text */
L.place('90012'); await wait(2500);
out.place = digest(clean(document.querySelector('#place-panel').innerText)); out.placeHead = clean((document.querySelector('#place-panel h2') || {}).textContent);
out.residents = [...document.querySelectorAll('#place-panel button.resident')].map(b => b.dataset.id).join(',');
document.querySelector('#place-panel button.resident').click(); await wait(1500);
out.npc = digest(clean(document.querySelector('#npc-panel').innerText)); out.npcName = clean(document.querySelector('#npc-panel .npc-name').textContent);
out.hash = location.hash;
for (const tab of ['mind', 'prompt', 'json']) { const b = document.querySelector('#npc-tab-' + tab); if (b) { b.click(); await wait(700); out['tab_' + tab] = digest(clean(document.querySelector('#npc-tabpanel-' + tab).innerText)); } }
/* talk with the built-in voice (no network): greet and one question */
{ const b = document.querySelector('#npc-tab-talk'); b.click(); await wait(1200); const inp = document.querySelector('#npc-panel .talk-input'); out.talkInput = !!inp;
  if (inp) { inp.value = 'Have wildfires ever come close to here?'; inp.dispatchEvent(new Event('input', { bubbles: true })); const f = inp.closest('form'); if (f) f.requestSubmit(); else inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(2500); }
  out.talk = clean(document.querySelector('#npc-tabpanel-talk').innerText).slice(0, 600); }
/* the theme button writes the settings: which key? */
document.querySelector('#theme-button').click(); await wait(500);
out.themeAfter = document.documentElement.getAttribute('data-theme'); out.ls = Object.keys(localStorage).sort(); out.lsSettings = localStorage.getItem('legion.settings.v1');
document.querySelector('#theme-button').click(); await wait(300);
out.idb = indexedDB.databases ? (await indexedDB.databases()).map(d => d.name).sort() : null;
/* the street view of this NPC's street (generated streets: OpenStreetMap is off by default) */
{ const w = document.querySelector('#npc-panel .walk-btn'); out.walkBtn = !!w; if (w) { w.click(); for (let i = 0; i < 60 && !(L.street && L.street.summary); i++) await wait(500); await wait(1500);
    const sv = L.street; out.street = sv && sv.summary ? { zip: sv.summary.zip, style: sv.summary.style, source: sv.summary.source, households: sv.summary.households, residents: sv.summary.residents, buildings: sv.summary.buildings, streets: sv.summary.streets, streetKm: sv.summary.streetKm } : null;
    out.streetOpen = document.body.hasAttribute('data-street-open'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(800); out.streetClosed = !document.body.hasAttribute('data-street-open'); } }
out.settingsDialog = (() => { document.querySelector('#settings-button').click(); const d = document.querySelector('#settings-dialog'); const t = digest(clean(d.innerText).replace(/ in [\d.]+ s\./, ' in # s.')); d.close(); return t; })();   /* the dialog says how long the crowd took to build: a wall-clock time, left out */
out.workers = null;
return out;
