/* The library on the bare host page: loading, ready, places, people, the clock. Run with
   --wait "typeof window.__LEGION_LOAD__ === 'function' && !!window.HOST" */
const out = {}; const T = () => performance.now();
out.before = { legion: typeof window.__LEGION__, legionApp: typeof window.legion, mem: performance.memory && performance.memory.usedJSHeapSize };
let t = T(); const L = await window.__LEGION_LOAD__(); out.loadMs = Math.round(T() - t);
out.keys = Object.keys(L);
t = T(); out.info = await L.ready(); out.readyMs = Math.round(T() - t);
out.again = (await L.ready()) === out.info;
const P = L.places();
out.places = { n: P.length, pop: P.reduce((a, p) => a + p.pop, 0), hh: P.reduce((a, p) => a + p.households, 0), counties: new Set(P.map(p => p.countyFips)).size, regions: [...new Set(P.map(p => p.region))].sort(),
  lat: [Math.min(...P.map(p => p.lat)), Math.max(...P.map(p => p.lat))], lon: [Math.min(...P.map(p => p.lon)), Math.max(...P.map(p => p.lon))], first: P[0], noBox: P.filter(p => !p.bbox).length };
out.placeAt = [[34.0537, -118.2428, 'LA City Hall'], [37.6485, -118.9721, 'Mammoth Lakes'], [34.1356, -116.0542, 'Twentynine Palms'], [37.7749, -122.4194, 'San Francisco'], [36.5, -125.5, 'ocean'], [39.5, -119.8, 'Reno']]
  .map(([la, lo, n]) => { const p = L.placeAt(la, lo); return [n, p && p.zip, p && p.city]; });
out.npcsOf = {};
for (const zip of ['90012', '93546', '92277']) {
  t = T(); const a = L.npcsOf(zip, { limit: 5 }); const ms1 = T() - t;
  const b = L.npcsOf(zip, { limit: 5, offset: a.total - 3 }), c = L.npcsOf(zip, { limit: 3, offset: 2 });
  const s = L.npcsOf(zip, { sample: true, limit: 12, page: 1 });
  out.npcsOf[zip] = { total: a.total, households: a.households, ms: +ms1.toFixed(1), first: a.people.map(p => `${p.id} ${p.name} ${p.age} ${p.role} ${p.tenure} ${p.dwelling}`), last: b.people.map(p => p.id),
    overlapOk: c.people[0].id === a.people[2].id, sample: s.people.map(p => `${p.id} ${p.name} ${p.age}`), samplePeople: s.people.map(p => p.id) };
}
out.npc = L.npc('90012-0-0');
out.npcMissing = [L.npc('90012-999999-0'), L.npc('00000-1-1'), L.npc('garbage')];
out.household = L.household('93546-10');
out.clock0 = { t: L.clock, iso: new Date(L.clock).toISOString(), parts: L.timeParts() };
const t8 = L.timeAt('08:00'); L.clock = t8; out.clock8 = { set: t8, got: L.clock, parts: L.timeParts() };
out.where = ['03:00', '08:00', '12:00', '17:30', '21:00'].map(h => { const w = L.whereIs('90012-5-0', L.timeAt(h)); return [h, w && w.text, w && w.kind, w && w.lat, w && w.lon, w && w.traveling]; });
out.plan = L.plan('92277-2655-1').map(l => `${new Date(l.start).toISOString().slice(11, 16)}Z ${l.text}${l.traveling ? ' [' + l.mode + ']' : ''}`);
out.trip = L.trip('92277-2655-1');
out.describe = L.describe('92277-2655-1');
out.say = {}; for (const k of ['greeting', 'fire', 'roof', 'insurance', 'storm', 'heat', 'wind', 'home', 'weather', 'bark:weather', 'Do you have solar panels?']) { const r = L.say('92277-2655-1', k); out.say[k] = r && [r.intent, r.text, r.gloss]; }
out.sayOwner = {}; { const own = L.npcsOf('93546', { limit: 200, full: true }).people.find(p => p.household.tenure === 'own' && p.household.dwelling === 'house' && p.age > 40 && p.role === 'householder');
  out.owner = own && own.id; if (own) { for (const k of ['roof', 'insurance', 'fire', 'storm', 'home']) { const r = L.say(own.id, k); out.sayOwner[k] = r && [r.intent, r.text]; } const d = L.describe(own.id); out.ownerRoof = d.roof; out.ownerConcerns = d.concerns; out.ownerText = d.text; } }
out.sayStable = JSON.stringify(L.say('92277-2655-1', 'fire')) === JSON.stringify(L.say('92277-2655-1', 'fire'));
out.settings = { key: L.settings.key, get: L.settings.get() };
out.stats = L.stats();
out.after = { legionApp: typeof window.legion, mem: performance.memory && performance.memory.usedJSHeapSize, ls: Object.keys(localStorage), title: document.title, state: document.documentElement.dataset.state || null, theme: document.documentElement.getAttribute('data-theme'),
  hostMap: !!(window.HOST && HOST.map && HOST.map.getCenter()), hostErrors: HOST.errors, bodyKids: document.body.children.length };
return out;
