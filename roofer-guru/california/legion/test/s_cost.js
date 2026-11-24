const L = await window.__LEGION_LOAD__(); await L.ready(); const T = () => performance.now(), out = {};
const time = (n, f) => { const t = T(); for (let i = 0; i < n; i++) f(i); return +((T() - t) / n).toFixed(3); };
const ids = L.npcsOf('94110', { limit: 400 }).people.map(p => p.id); const t8 = L.timeAt('08:00');
out.ms = { npcFirst: time(300, i => L.npc('90026-' + (i * 7) + '-0')), npcAgain: time(300, i => L.npc('90026-' + (i * 7) + '-0')), whereIs: time(300, i => L.whereIs(ids[i], t8)), plan: time(200, i => L.plan(ids[i], t8)), trip: time(300, i => L.trip(ids[i])),
  describe: time(100, i => L.describe(ids[i], t8)), say: time(60, i => L.say(ids[i], 'fire')), sayGreeting: time(60, i => L.say(ids[i], 'greeting')), bark: time(100, i => L.say(ids[i], 'bark:weather')), placeAt: time(2000, i => L.placeAt(34 + (i % 50) * 0.01, -118.3 + (i % 40) * 0.01)),
  npcsOf24: time(20, i => L.npcsOf('92101', { limit: 24, offset: i * 500 })), places: time(1, () => L.places()) };
let t = T(); const hs = L.homesIn([-118.30, 34.03, -118.22, 34.09], { max: 100, detail: false }); out.homesInFirstMs = Math.round(T() - t); out.homes = hs.total;
t = T(); L.homesIn([-118.30, 34.03, -118.22, 34.09], { max: 100, detail: false }); out.homesInAgainMs = +(T() - t).toFixed(1);
/* the two clocks of a person: the day plan (whereIs) and the crowd model (crowd), 400 people of 94110 at six times */
await L.crowd([-122.425, 37.748, -122.408, 37.765], t8, { max: 1 });
const cls = k => k === 'sleep' || k === 'home' ? 'home' : k === 'work' || k === 'school' ? 'work' : 'other';
out.agree = {};
for (const h of ['03:00', '07:30', '08:00', '12:00', '17:30', '21:00']) { const tm = L.timeAt(h); let same = 0, n = 0, dist = [], tv = 0, tvBoth = 0; const tab = {};
  for (const id of ids) { const w = L.whereIs(id, tm); if (!w || !w.crowd) continue; n++; const a = w.traveling ? (w.kind === 'work' || w.kind === 'school' || /work|school|home/.test(w.label || '') ? 'commute' : 'trip') : cls(w.kind), c = w.crowd, b = c.state === 'home' ? 'home' : c.state === 'at-work' ? 'work' : c.state === 'to-work' || c.state === 'to-home' ? 'commute' : c.state === 'at-errand' ? 'other' : 'trip';
    tab[a + '>' + b] = (tab[a + '>' + b] || 0) + 1; if (a === b) same++; if (a === 'commute') { tv++; if (b === 'commute') { tvBoth++; dist.push(Math.hypot((w.lat - c.lat) * 111320, (w.lon - c.lon) * 88000)); } } }
  dist.sort((x, y) => x - y); out.agree[h] = { n, same, commuting: tv, commutingBoth: tvBoth, medianMetresApart: dist.length ? Math.round(dist[dist.length >> 1]) : null, table: tab }; }
return out;
