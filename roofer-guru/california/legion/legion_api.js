/* Legion as a library: the body of function __LG_API__, put inside Legion's bundle by port_legion.py and run instead of
   the page boot when window.__LEGION_EMBED__ is set. It publishes one object, window.__LEGION__ (LEGION_CONTRACT.md,
   section 8). Names between two at-signs are Legion's own internals; the port finds each by an anchor and writes the
   minified name of the build in. Nothing here draws, fetches or stores anything until it is called.
   Every person this returns is synthetic: drawn from Census tables for a ZIP area, not a record of a resident. */
var W = window, D = document, SV = @@services@@, BUS = @@bus@@, EV = @@events@@, MODS = { schedule: @@schedule@@, dialogue: @@dialogue@@, persona: @@persona@@ };
var SELF = D.currentScript || null;                 /* the bundle's own <script>: mount() gives its text to the frame */
var NOTICE = 'Synthetic person, generated from Census statistics for this ZIP area. Not a real resident.';
var world = null, pop = null, net = null, info = null, readyP = null, simClock = null, mounted = null;
var DEG = 180 / Math.PI;
function need() { if (!world) throw new Error('__LEGION__: call ready() and wait for it first'); }
function ms(t) { if (t == null) return simClock ? simClock.t : Date.now(); if (typeof t === 'number') return t; if (t instanceof Date) return t.getTime(); var v = Date.parse(String(t)); if (!isFinite(v)) throw new Error('__LEGION__: not a time: ' + t); return v; }
function mix(a) { a = a >>> 0; a ^= a >>> 16; a = Math.imul(a, 2146121005); a ^= a >>> 15; a = Math.imul(a, 2221713035); a ^= a >>> 16; return a >>> 0; }
function hstr(s, h) { h = (h || 2166136261) >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return mix(h); }
function ll(x, y) { var p = world.proj; return { lat: +(p.maxy - y / p.sx).toFixed(6), lon: +(p.minx + x / (p.kx * p.sx)).toFixed(6) }; }
function zipIndex(id) { need(); if (id && typeof id === 'object') id = id.zip || id.id; var zi = world.indexOf(String(id)); if (zi < 0) throw new Error('__LEGION__: no place ' + id); return zi; }
function box(b) {                                   /* [west, south, east, north] in degrees, an object with those names, or Leaflet bounds */
  var w, s, e, n; if (Array.isArray(b)) { w = b[0]; s = b[1]; e = b[2]; n = b[3]; } else if (b && typeof b.getWest === 'function') { w = b.getWest(); s = b.getSouth(); e = b.getEast(); n = b.getNorth(); } else if (b) { w = b.west; s = b.south; e = b.east; n = b.north; }
  if (![w, s, e, n].every(isFinite) || !(e > w) || !(n > s)) throw new Error('__LEGION__: a box is [west, south, east, north] in degrees');
  var a = world.project(n, w), c = world.project(s, e); return { w: w, s: s, e: e, n: n, x0: a.x, y0: a.y, x1: c.x, y1: c.y };
}
function zipsIn(B, pad) { var out = [], z = world.z; pad = pad || 0; for (var i = 0; i < world.N; i++) { if (!(z.hh[i] > 0)) continue; var r = world.zipBBox(i); if (r && r[0] <= B.x1 + pad && r[2] >= B.x0 - pad && r[1] <= B.y1 + pad && r[3] >= B.y0 - pad) out.push(i); } return out; }

/* ---------- ready ---------- */
function ready(opts) {
  if (readyP) return readyP; opts = opts || {};
  var t0 = performance.now();
  readyP = (async function () {
    var pack = W.__LEGION_PACK__;
    if (typeof pack !== 'string' || !pack.length) throw new Error('__LEGION__: window.__LEGION_PACK__ is not on this page');
    if (typeof DecompressionStream !== 'function') throw new Error('__LEGION__: this browser cannot decompress the world pack (no DecompressionStream)');
    var nw = opts.workers == null ? 1 : Math.max(0, Math.min(4, opts.workers | 0));
    startWorkers(nw);                                /* they unpack their own copy while this thread unpacks its own */
    var data = await SV.unpack(pack), t1 = performance.now();
    SV.init(data); world = SV.world; pop = SV.population;
    simClock = new @@Clock@@({ t0: world.snapshotTime, speed: 60, playing: false, bus: null });
    SV.setClock(function () { return simClock.t; });
    world.raster(); net = @@roadNet@@(world);
    var t2 = performance.now(), prepared = await Promise.all(pool.map(function (k) { return k.prep; }));
    info = { ready: true, version: API.version, build: API.build, compiled: data.compiled, snapshot: new Date(world.snapshotTime).toISOString(), places: world.N, people: world.totalPop, households: world.totalHH, seed: pop.seed,
      workers: prepared.filter(Boolean).length, ms: { unpack: Math.round(t1 - t0), world: Math.round(t2 - t1), workers: Math.round(performance.now() - t2), total: Math.round(performance.now() - t0) }, synthetic: NOTICE };
    return info;
  })();
  readyP.catch(function () { readyP = null; });
  return readyP;
}

/* ---------- places ---------- */
var placeRows = null;
function placeRow(zi) {
  var z = world.z, c = world.counties[z.county[zi]] || {}, r = world.zipBBox(zi), a = r ? ll(r[0], r[3]) : null, b = r ? ll(r[2], r[1]) : null;
  return { id: z.zip[zi], zi: zi, zip: z.zip[zi], city: z.city[zi], place: z.place[zi] || z.city[zi], neighborhood: (Array.isArray(z.nbhd[zi]) && z.nbhd[zi][0]) || null, county: c.name || null, countyFips: c.fips || null,
    region: z.region[zi], lat: z.lat[zi], lon: z.lon[zi], pop: z.pop[zi] || 0, households: z.hh[zi] || 0, housingUnits: z.hu[zi] || 0, sqmi: z.sqmi[zi], bbox: r ? [a.lon, a.lat, b.lon, b.lat] : null };
}
function places() { need(); if (!placeRows) { placeRows = []; for (var i = 0; i < world.N; i++) placeRows.push(placeRow(i)); } return placeRows; }
function place(id) { return places()[zipIndex(id)]; }
function placeAt(lat, lon) { need(); var p = world.project(+lat, +lon), zi = world.zipAt(p.x, p.y); return zi >= 0 ? places()[zi] : null; }

/* ---------- people ---------- */
var prefix = new Map();                              /* zi -> Uint32Array(hh + 1): people before each household */
function prefixOf(zi) {
  var p = prefix.get(zi); if (p) return p;
  var hh = pop.householdCount(zi); p = new Uint32Array(hh + 1); for (var h = 0; h < hh; h++) p[h + 1] = p[h] + pop.householdSize(zi, h);
  prefix.set(zi, p); if (prefix.size > 48) prefix.delete(prefix.keys().next().value); return p;
}
function withLL(o) { if (o && isFinite(o.x) && isFinite(o.y)) { var q = ll(o.x, o.y); return { lat: q.lat, lon: q.lon, x: o.x, y: o.y, label: o.label || null, kind: o.kind || null }; } return null; }
function brief(p) {
  var h = p.household || {}, hm = h.home || {}, o = p.occupation;
  return { id: p.id, household: p.hid, name: p.name.display, age: p.age, sex: p.sex, role: p.role, heritage: p.heritageLabel, status: p.status, job: o ? (o.title || o.key) : null,
    size: h.size, tenure: h.tenure, dwelling: h.dwelling, yearBuilt: h.yearBuilt, lat: hm.lat, lon: hm.lon, synthetic: true };
}
function npcsOf(id, o) {
  var zi = zipIndex(id); o = o || {};
  var limit = Math.max(0, Math.min(500, o.limit == null ? 24 : o.limit | 0)), offset = Math.max(0, o.offset | 0), pre = prefixOf(zi), hh = pre.length - 1, total = pre[hh], list = [];
  if (o.sample) list = SV.residents({ kind: 'zip', key: world.zips[zi], zi: zi, zis: [zi] }, limit, o.page == null ? 1 : o.page);   /* the twelve the place panel shows, when limit is 12 */
  else if (offset < total) {
    var lo = 0, hi = hh; while (lo < hi) { var mid = (lo + hi) >> 1; if (pre[mid + 1] <= offset) lo = mid + 1; else hi = mid; }
    for (var h = lo, m = offset - pre[lo]; h < hh && list.length < limit; h++, m = 0) for (var n = pre[h + 1] - pre[h]; m < n && list.length < limit; m++) list.push(pop.person(zi, h, m));
  }
  return { place: places()[zi], total: total, households: hh, offset: o.sample ? null : offset, limit: limit, sample: !!o.sample, people: o.full ? list : list.map(brief), synthetic: NOTICE };
}
function npc(id) { need(); return SV.npc(String(id)); }
function household(id) { need(); var q = pop.parseId(String(id)); if (!q || q.zi < 0 || q.h >= pop.householdCount(q.zi)) return null; return pop.household(q.zi, q.h); }

function leg(v) {
  var pos = v.position || v.place || null, P = withLL(pos), F = withLL(v.from), T = withLL(v.place), moving = !!(v.traveling || v.travel), head = null;
  if (moving && F && T) { var k = Math.cos(T.lat / DEG); head = (Math.atan2((T.lon - F.lon) * k, T.lat - F.lat) * DEG + 360) % 360; }
  return { kind: v.kind, label: v.label, text: @@activityText@@(v), traveling: moving, mode: v.mode || null, lat: P ? P.lat : null, lon: P ? P.lon : null, x: pos ? pos.x : null, y: pos ? pos.y : null,
    heading: head == null ? null : +head.toFixed(1), from: F, to: T, start: v.start, end: v.end, progress: v.progress == null ? null : v.progress };
}
function whereIs(id, time) {                         /* the day plan's answer: what the NPC panel's "Now" line says */
  need(); id = String(id); var t = ms(time), a = SV.activityAt(id, t); if (!a || !a.ok || !a.value) return null;
  var r = leg(a.value); r.id = id; r.t = t; r.crowd = crowdOne(id, t); return r;
}
function plan(id, time) { need(); var t = ms(time), a = SV.dayPlan(String(id), t); return a && a.ok ? a.value.map(leg) : null; }

/* ---------- the NPC panel's text ---------- */
var dPanel = null, dTime = 0;
function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function ddText(dd) {
  var parts = [], ul = dd.querySelector('ul.members');
  if (ul) return Array.prototype.map.call(ul.children, function (li) { var n = li.querySelector('.member-name'), m = li.querySelector('.member-meta'); return clean(n && n.textContent) + (m ? ' (' + clean(m.textContent) + ')' : '') + (li.querySelector('.is-self') ? ' [this person]' : ''); }).join('; ');
  Array.prototype.forEach.call(dd.childNodes, function (c) { var s = clean(c.textContent); if (s) parts.push(s); });
  return parts.join(' · ');
}
function describe(id, time) {
  need(); id = String(id); var p = SV.npc(id); if (!p) return null;
  dTime = ms(time);
  if (!dPanel) dPanel = new @@NpcPanel@@({ el: D.createElement('aside'), services: SV, bus: BUS, settings: { get: function () { return { claude: {}, network: {} }; }, public: function () { return { claude: {}, network: {} }; }, values: { claude: {}, network: {} } }, getTime: function () { return dTime; } });
  if (dPanel.id) { dPanel.id = null; dPanel.npc = null; dPanel.el.hidden = true; }      /* a fresh open each time, without the panel's close callbacks */
  dPanel.tab = 'profile'; if (!dPanel.open(id, { focus: false })) return null;
  var el = dPanel.el, q = function (s) { var n = el.querySelector(s); return n ? clean(n.textContent) : ''; }, sections = [];
  Array.prototype.forEach.call(dPanel.panels.profile.querySelectorAll('section.p-section'), function (sec) {
    var rows = []; Array.prototype.forEach.call(sec.querySelectorAll('.dl-row'), function (r) { var dt = r.querySelector('dt'), dd = r.querySelector('dd'); if (dt && dd) rows.push({ label: clean(dt.textContent), value: ddText(dd) }); });
    sections.push({ title: clean((sec.querySelector('h3') || {}).textContent), rows: rows });
  });
  var per = SV.persona(id, { t: dTime }), P = per && per.ok ? per.value : null, now = q('.npc-now');
  var out = { id: id, name: q('.npc-name'), meta: q('.npc-meta'), now: now || null, sections: sections, bio: P ? P.bio : null, archetype: P ? P.archetype : null, traits: P ? P.traits : [], values: P ? P.values : [],
    interests: P ? P.interests : [], concerns: P ? (P.concerns || []).map(function (c) { return { topic: c.topic, weight: c.weight, why: c.why }; }) : [], memories: P ? (P.memories || []).map(function (m) { return { year: m.year, kind: m.kind, text: m.text, source: m.source }; }) : [],
    roof: P ? P.roof || null : null, hooks: P ? P.hooks : [], synthetic: NOTICE };
  var L = [out.name, out.meta, out.id]; if (now) L.push(now); if (out.bio) L.push(out.bio);
  sections.forEach(function (s) { L.push('', s.title); s.rows.forEach(function (r) { L.push('  ' + r.label + ': ' + r.value); }); });
  L.push('', NOTICE); out.text = L.join('\n'); return out;
}

/* ---------- the built-in voice ---------- */
var ASK = { weather: "How's the weather been?", fire: 'Have wildfires ever come close to here?', smoke: 'Does wildfire smoke get bad here?', storm: 'Do you remember any big storms here?', wind: 'What about the wind storms?', heat: 'How bad does the heat get here?',
  roof: 'How is your roof holding up?', home: 'Tell me about your home.', housing: 'What is housing like around here?', rent: "How's the rent around here?", insurance: 'How is your home insurance?', earthquake: 'Do you worry about earthquakes?',
  neighborhood: 'What is this neighborhood like?', job: 'What do you do for work?', family: 'Tell me about your family.', traffic: "How's the traffic around here?", history: 'What do you remember happening around here?', self: 'Tell me about yourself.' };
var BARKS = ['pass', 'wait', 'weather', 'alert', 'traffic', 'work', 'home'];
function say(id, topic, o) {
  need(); id = String(id); o = o || {}; topic = String(topic == null ? 'greeting' : topic); var t = ms(o.time);
  if (!SV.npc(id)) return null;
  var out = { id: id, topic: topic, asked: null, text: null, gloss: null, intent: null, topics: [], emotion: null, facts: [], source: 'built-in', synthetic: true };
  if (topic.indexOf('bark:') === 0 || o.ambient) {   /* a passing remark, as people in the street view make */
    var sit = topic.replace(/^bark:/, ''), b = SV.bark(id, null, { situation: BARKS.indexOf(sit) >= 0 ? sit : 'pass', t: t });
    if (!b) return null; out.text = b.text; out.gloss = b.gloss || null; out.intent = 'bark'; return out;
  }
  var per = SV.persona(id, { t: t }); if (!per || !per.ok) return null;
  var conv = new MODS.dialogue.Conversation({ world: SV.weatherWorld || world, persona: per.value, t: t, population: pop, rngSeed: hstr(id + '|' + topic) });   /* its own mind, thrown away: nothing is remembered */
  var r; if (topic === 'greeting') r = conv.greet(); else { out.asked = Object.prototype.hasOwnProperty.call(ASK, topic) ? ASK[topic] : topic; r = conv.reply(out.asked); }
  if (!r) return null; out.text = r.text; out.gloss = r.gloss || null; out.intent = r.intent || null; out.topics = r.topics || []; out.emotion = r.emotion || null; out.facts = r.facts || []; return out;
}

/* ---------- the crowd ---------- */
var pool = [], jobs = [], jobSeq = 0, wurl = null;
var zcache = new Map(), zAgents = 0, ZCAP = 900000;  /* zi -> { rate, chunks, agents }: people of a ZIP, built once */
var base = null;                                     /* the statewide sample, when asked for: { rate, chunks, agents } */
function startWorkers(n) {
  if (pool.length || !(n > 0) || typeof Worker === 'undefined' || typeof W.__LEGION_WORKER_SRC__ !== 'string') return;
  try { wurl = URL.createObjectURL(new Blob([W.__LEGION_WORKER_SRC__], { type: 'text/javascript' })); } catch (e) { return; }
  for (var i = 0; i < n; i++) (function () {
    var k = { w: null, job: null, dead: false, prep: null, ms: null };
    try { k.w = new Worker(wurl, { name: 'legion-crowd' }); } catch (e) { return; }
    k.prep = new Promise(function (res) { k.prepared = res; setTimeout(function () { if (k.ms == null && !k.dead) { k.dead = true; res(false); pump(); } }, 90000); });
    k.w.onmessage = function (ev) {
      var d = ev.data || {}, j = k.job;
      if (d.type === 'prepared') { k.ms = d.ms; k.prepared(true); pump(); return; }
      if (d.type === 'error' && d.id === -1) { k.dead = true; k.prepared(false); pump(); return; }
      if (!j || d.id !== j.id) return;
      if (d.type === 'chunk') j.chunks.push(d.chunk);
      else if (d.type === 'done') { k.job = null; j.resolve({ chunks: j.chunks, summary: d.summary }); pump(); }
      else if (d.type === 'error') { k.job = null; j.reject(new Error(d.message)); pump(); }
    };
    k.w.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); k.dead = true; k.prepared(false); var j = k.job; k.job = null; if (j) { jobs.unshift(j); } pump(); };
    try { k.w.postMessage({ type: 'prepare', pack: W.__LEGION_PACK__, popSeed: SV.seed >>> 0 }); } catch (e) { k.dead = true; k.prepared(false); }
    pool.push(k);
  })();
}
function pump() {
  var live = pool.filter(function (k) { return !k.dead; });
  while (jobs.length) {
    if (!live.length) { var j0 = jobs.shift(); try { j0.resolve(buildOnMain(j0.zips, j0.rate)); } catch (e) { j0.reject(e); } continue; }
    var k = live.find(function (q) { return !q.job && q.ms != null; }); if (!k) return;
    var j = jobs.shift(); k.job = j;
    try { k.w.postMessage({ type: 'build', id: j.id, rate: j.rate, seed: pop.seed >>> 0, popSeed: pop.seed >>> 0, focus: null, zips: j.zips, chunkTarget: 131072, firstChunkTarget: 0, pack: null }); }
    catch (e) { k.job = null; k.dead = true; live = pool.filter(function (q) { return !q.dead; }); jobs.unshift(j); }
  }
}
function buildOnMain(zips, rate) {                   /* the same generator the worker runs, on this thread: blocks while it runs */
  var g = @@crowdGen@@(world, pop, { rate: rate, seed: pop.seed >>> 0, zips: zips, chunkTarget: 131072, byRegion: false, roadNet: net }), r, chunks = [];
  while (!(r = g.next()).done) if (r.value.type === 'chunk') chunks.push(r.value.chunk);
  return { chunks: chunks, summary: r.value };
}
function build(zips, rate) { return new Promise(function (resolve, reject) { jobs.push({ id: ++jobSeq, zips: zips, rate: rate, chunks: [], resolve: resolve, reject: reject }); pump(); }); }
function ensureZip(zi, rate) {
  var c = zcache.get(zi);
  if (c && c.rate >= rate) { zcache.delete(zi); zcache.set(zi, c); return c.p || Promise.resolve(c); }
  if (c) zAgents -= c.agents || 0;
  var e = { rate: rate, chunks: null, agents: 0, p: null };
  e.p = build([zi], rate).then(function (r) { e.chunks = r.chunks; e.agents = r.chunks.reduce(function (a, k) { return a + k.count; }, 0); e.p = null; zAgents += e.agents;
    var it = zcache.keys(), nx; while (zAgents > ZCAP && !(nx = it.next()).done) { var old = nx.value, oc = zcache.get(old); if (old === zi || !oc || oc.p) continue; zAgents -= oc.agents; zcache.delete(old); }
    return e; }, function (err) { zcache.delete(zi); throw err; });
  zcache.set(zi, e); return e.p;
}
function crowdBase(o) {                              /* the statewide sample Legion's own map draws (rate 0.025: about 961,000 people) */
  need(); o = o || {}; var rate = o.rate == null ? 0.025 : +o.rate;
  if (base && base.rate === rate) return base.p || Promise.resolve(base.summary);
  var live = Math.max(1, pool.filter(function (k) { return !k.dead; }).length), parts = [], t0 = performance.now(), b = base = { rate: rate, chunks: [], agents: 0, p: null, summary: null };
  for (var i = 0; i < live; i++) parts.push([]);
  for (var z = 0; z < world.N; z++) parts[z % live].push(z);
  b.p = Promise.all(parts.map(function (zs) { return build(zs, rate); })).then(function (rs) {
    rs.forEach(function (r) { r.chunks.forEach(function (c) { b.chunks.push(c); b.agents += c.count; }); });
    b.summary = { rate: rate, agents: b.agents, chunks: b.chunks.length, ms: Math.round(performance.now() - t0), bytes: b.agents * 32 }; b.p = null; return b.summary; });
  return b.p;
}
var OUT = { state: 0, kind: 0, x: 0, y: 0 }, OUT2 = { state: 0, kind: 0, x: 0, y: 0 }, SCR = { u: 0, len: 1, start: 0, day: 0 };
var VEH = { drive: 'car', carpool: 'car', taxi: 'car', motorcycle: 'motorcycle', bus: 'bus', rail: 'rail', ferry: 'ferry', bike: 'bike' };
function agentOut(c, i, minute, dow, weight, visitor) {  /* OUT holds this agent's state and place at (minute, dow) */
  var st = OUT.state, sname = @@stateNames@@[st], code = c.mode[i] & 15, cm = @@modeNames@@[code], q = ll(OUT.x, OUT.y), id = @@agentId@@(c, i, world).id;
  var moving = st === 1 || st === 3 || st === 4 || st === 6, mode = null, head = null, kmh = null;
  if (moving) {
    mode = st === 1 || st === 3 ? cm : ((c.errand[i] >>> 25) & 1 ? 'drive' : 'walk');
    var x = OUT.x, y = OUT.y, dt = 0.2; @@agentAt@@(c, i, minute + dt, dow, net, OUT2, SCR);
    if (OUT2.state !== st) { @@agentAt@@(c, i, minute - dt, dow, net, OUT2, SCR); dt = -dt; }
    if (OUT2.state === st) { var f = Math.cos(q.lat / DEG) / world.proj.kx, dx = (OUT2.x - x) * f * (dt > 0 ? 1 : -1), dy = (OUT2.y - y) * (dt > 0 ? 1 : -1), d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1e-9) { head = +(((Math.atan2(dx, -dy) * DEG) + 360) % 360).toFixed(1); kmh = +(d * world.unitKm / (Math.abs(dt) / 60)).toFixed(1); } }
  }
  return { id: id, lat: q.lat, lon: q.lon, state: sname, moving: moving, kind: OUT.kind >= 0 ? @@kindNames@@[OUT.kind] : null, mode: mode, commuteMode: cm, vehicle: moving ? (VEH[mode] || null) : null, heading: head, kmh: kmh,
    weight: weight, visitor: !!visitor };
}
function scan(c, B, minute, dow, weight, skipZi, hits, counts, want) {
  var n = c.count, ids = c.ids;
  for (var i = 0; i < n; i++) {
    if (skipZi) { var idv = ids[i]; if (skipZi.has(idv & 2147483648 ? c.overflow[3 * (idv & 2147483647)] : idv >>> 20)) continue; }
    @@agentAt@@(c, i, minute, dow, net, OUT, SCR);
    if (OUT.x < B.x0 || OUT.x > B.x1 || OUT.y < B.y0 || OUT.y > B.y1) continue;
    var st = OUT.state, key = st === 0 ? 'home' : st === 2 ? 'atWork' : st === 5 ? 'atErrand' : (@@kindNames@@[OUT.kind] || 'walk');
    counts[key] = (counts[key] || 0) + 1; counts.est[key] = (counts.est[key] || 0) + weight; counts.total++;
    if (want && !want[st]) continue;
    hits.push(c, i, weight, skipZi ? 1 : 0);
  }
}
var WANT = { all: null, out: [0, 1, 1, 1, 1, 1, 1], moving: [0, 1, 0, 1, 1, 0, 1] };
function crowdNow(b, time, o) {                      /* what is already built, at once: nothing is asked of the worker */
  need(); o = o || {}; var B = box(b), t = ms(time), md = @@minuteDow@@(t), max = o.max == null ? 2000 : Math.max(0, o.max | 0), want = WANT[o.only || 'all'] || null;
  var zero = function () { return { home: 0, atWork: 0, atErrand: 0, walk: 0, drive: 0, bike: 0, transit: 0, errand: 0 }; };
  var zis = zipsIn(B), local = new Set(), hits = [], counts = zero(), missing = [], rates = {}; counts.total = 0; counts.est = zero();
  zis.forEach(function (zi) { var c = zcache.get(zi); if (c && c.chunks) { local.add(zi); rates[world.zips[zi]] = c.rate; c.chunks.forEach(function (k) { scan(k, B, md.minute, md.dow, 1 / c.rate, null, hits, counts, want); }); } else missing.push(world.zips[zi]); });
  var vis = base && base.chunks.length && !base.p && o.visitors !== false;
  if (vis) base.chunks.forEach(function (k) { scan(k, B, md.minute, md.dow, 1 / base.rate, local, hits, counts, want); });
  var n = hits.length / 4, keep = n > max ? max / n : 1, people = [];
  for (var i = 0; i < n && people.length < max; i++) { var c = hits[4 * i], j = hits[4 * i + 1]; if (keep < 1 && mix(c.ids[j] ^ 1540483477) / 4294967296 >= keep) continue;
    @@agentAt@@(c, j, md.minute, md.dow, net, OUT, SCR); people.push(agentOut(c, j, md.minute, md.dow, hits[4 * i + 2] / keep, hits[4 * i + 3])); }
  var est = {}; Object.keys(counts.est).forEach(function (k) { est[k] = Math.round(counts.est[k]); }); delete counts.est;
  return { t: t, minute: +md.minute.toFixed(2), dow: md.dow, bbox: [B.w, B.s, B.e, B.n], zips: zis.map(function (zi) { return world.zips[zi]; }), missing: missing, rates: rates, visitors: vis ? base.rate : null,
    found: n, counts: counts, estimate: est, truncated: n > people.length, people: people, synthetic: NOTICE };
}
function crowd(b, time, o) {                         /* builds what the box needs (the residents of the ZIPs it touches), then answers */
  need(); o = o || {}; var B, zis; try { B = box(b); zis = zipsIn(B); } catch (e) { return Promise.reject(e); }
  var people = zis.reduce(function (a, zi) { return a + pop.expectedPersons(zi); }, 0), budget = o.budget == null ? 400000 : +o.budget;
  var rate = o.rate != null ? Math.max(0.001, Math.min(1, +o.rate)) : (people <= budget ? 1 : [0.5, 0.25, 0.1, 0.05, 0.025, 0.01].find(function (r) { return people * r <= budget; }) || 0.005);
  var w = [zis.length ? Promise.all(zis.map(function (zi) { return ensureZip(zi, rate); })) : null];
  if (o.visitors === true) w.push(crowdBase({ rate: o.baseRate }));
  return Promise.all(w).then(function () { return crowdNow(b, time, o); });
}
function crowdOne(id, t) {                           /* where the crowd model has this person, if their ZIP is built */
  var q = pop.parseId(id); if (!q || q.zi < 0 || q.m == null) return null; var c = zcache.get(q.zi); if (!c || !c.chunks) return null;
  var want = q.h < 65536 && q.m < 16 ? ((q.zi << 20) | (q.h << 4) | q.m) >>> 0 : null, md = @@minuteDow@@(t); if (want == null) return null;
  for (var k = 0; k < c.chunks.length; k++) { var ch = c.chunks[k], lo = 0, hi = ch.count - 1;
    while (lo <= hi) { var mid = (lo + hi) >> 1, v = ch.ids[mid]; if (v === want) { @@agentAt@@(ch, mid, md.minute, md.dow, net, OUT, SCR); return agentOut(ch, mid, md.minute, md.dow, 1 / c.rate, false); } if (v < want) lo = mid + 1; else hi = mid - 1; } }
  return null;
}
function trip(id) {                                  /* the commute as the crowd model has it: what the engine needs to run it as a real trip */
  need(); var p = SV.npc(String(id)); if (!p) return null; var c = p.commute || {}, h = (p.household || {}).home || {}, wk = c.work ? ll(c.work.x, c.work.y) : null;
  var days = []; for (var d = 0; d < 7; d++) if ((c.days >> d) & 1) days.push(d);
  return { id: p.id, mode: c.mode, vehicle: VEH[c.mode] || null, home: { lat: h.lat, lon: h.lon }, work: wk, workZip: c.workZip, workCity: c.workCity, departMin: c.departMin, minutes: c.minutes, dwellMin: c.dwellMin,
    returnMin: c.departMin == null ? null : (c.departMin + c.minutes + c.dwellMin) % 1440, days: days, road: c.road ? c.road.name : null, vehicles: (p.household || {}).vehicles, synthetic: true };
}

/* ---------- homes, and tying households to buildings ---------- */
var homes = new Map();                               /* zi -> Float32Array(2 * hh): every household's home point, world units */
function homesOf(zi) { var a = homes.get(zi); if (a) return a; var hh = pop.householdCount(zi); a = new Float32Array(2 * hh); for (var h = 0; h < hh; h++) { var p = world.homeFor(zi, h); a[2 * h] = p.x; a[2 * h + 1] = p.y; } homes.set(zi, a); if (homes.size > 96) homes.delete(homes.keys().next().value); return a; }
function homesIn(b, o) {
  need(); o = o || {}; var B = box(b), max = o.max == null ? 5000 : o.max | 0, out = [], total = 0;
  zipsIn(B).forEach(function (zi) { var a = homesOf(zi), zip = world.zips[zi];
    for (var h = 0, n = a.length / 2; h < n; h++) { var x = a[2 * h], y = a[2 * h + 1]; if (x < B.x0 || x > B.x1 || y < B.y0 || y > B.y1) continue; total++; if (out.length >= max) continue;
      var q = ll(x, y), r = { id: zip + '-' + h, zip: zip, h: h, lat: q.lat, lon: q.lon };
      if (o.detail !== false) { var c = pop.householdCore(zi, h); r.size = c.size; r.tenure = c.tenure; r.dwelling = c.dwelling; r.vehicles = c.vehicles; r.type = c.type; }
      out.push(r); } });
  return { bbox: [B.w, B.s, B.e, B.n], total: total, truncated: total > out.length, households: out, synthetic: NOTICE };
}
var CELL = 2;                                        /* world units: a cell is about 395 m on a side, fixed for the whole state */
function cellOf(lat, lon) { need(); var p = world.project(+lat, +lon), cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), a = ll(cx * CELL, (cy + 1) * CELL), c = ll((cx + 1) * CELL, cy * CELL); return { key: cx + '_' + cy, bbox: [a.lon, a.lat, c.lon, c.lat] }; }
function unitsOf(b) {
  if (b.units != null && isFinite(b.units)) return Math.max(0, Math.round(b.units));
  var k = b.kind, area = +b.area || 0, lv = Math.max(1, +b.levels || (k === 'apartment' ? 3 : k === 'small-apartment' ? 2 : 1));
  if (k === 'house' || k === 'mobile-home') return 1;
  if (k === 'small-apartment') return Math.max(2, Math.min(4, Math.round(area * lv / 110) || 2));
  if (k === 'apartment') return Math.max(5, Math.round(area * lv * 0.8 / 80));
  return area > 320 ? Math.max(2, Math.round(area * lv * 0.8 / 85)) : 1;
}
function housing(key, buildings, o) {
  /* Who lives in which building of one cell. Give every residential building whose centre is in the cell. The answer
     depends only on the cell and on those buildings (id, lat, lon, units or kind/area/levels), so it is the same on
     every surface and every visit. Households take the nearest building of their dwelling kind that has a unit free, in
     a fixed order; a house holds one household. */
  need(); o = o || {}; var m = /^(-?\d+)_(-?\d+)$/.exec(String(key)); if (!m) throw new Error('__LEGION__: a cell key comes from cellOf()');
  var cx = +m[1], cy = +m[2], a = ll(cx * CELL, (cy + 1) * CELL), c = ll((cx + 1) * CELL, cy * CELL), H = homesIn([a.lon, a.lat, c.lon, c.lat], { max: 1e9 }).households;
  var bs = (buildings || []).map(function (b) { var p = world.project(+b.lat, +b.lon), u = unitsOf(b); return { id: String(b.id), x: p.x, y: p.y, kind: b.kind || (u > 4 ? 'apartment' : u > 1 ? 'small-apartment' : 'house'), units: u, free: u, list: [] }; })
    .sort(function (p, q) { return p.id < q.id ? -1 : p.id > q.id ? 1 : 0; });
  var order = H.map(function (h, i) { return [hstr(h.id, 40503), i]; }).sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; }), kx = Math.cos(a.lat / DEG) / world.proj.kx;
  var byHousehold = {}, unhoused = [];
  var near = function (h, hp, test) { var best = null, bd = Infinity; for (var i = 0; i < bs.length; i++) { var b = bs[i]; if (!test(b)) continue; var dx = (b.x - hp.x) * kx, dy = b.y - hp.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; } } return best; };
  order.forEach(function (e) { var h = H[e[1]], hp = world.project(h.lat, h.lon), kind = h.dwelling;
    var b = near(h, hp, function (q) { return q.free > 0 && q.kind === kind; }) || near(h, hp, function (q) { return q.free > 0; });
    if (!b && !o.strict) b = near(h, hp, function (q) { return q.kind === 'apartment'; }) || near(h, hp, function (q) { return q.kind !== 'house' && q.kind !== 'mobile-home'; });
    if (!b) { unhoused.push(h.id); return; }
    if (b.free > 0) b.free--; else b.over = (b.over || 0) + 1; b.list.push(h.id); byHousehold[h.id] = b.id; });
  var byBuilding = {}, units = 0, vacant = 0; bs.forEach(function (b) { byBuilding[b.id] = { households: b.list, units: b.units, over: b.over || 0 }; units += b.units; vacant += Math.max(0, b.free); });
  return { cell: String(key), bbox: [a.lon, a.lat, c.lon, c.lat], households: H.length, units: units, housed: H.length - unhoused.length, unhoused: unhoused, vacant: vacant, byBuilding: byBuilding, byHousehold: byHousehold, synthetic: NOTICE };
}

/* ---------- Legion's own view, in a frame ---------- */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function mount(host, o) {
  o = o || {}; if (!host || !host.appendChild) throw new Error('__LEGION__.mount: give it an element');
  var parts = W.__LEGION_PARTS__, code = o.bundleText || (SELF && SELF.textContent) || '';
  if (!parts || !parts.css || !parts.markup) throw new Error('__LEGION__.mount: window.__LEGION_PARTS__ (stylesheet and markup) is not on this page');
  if (code.length < 100000) throw new Error('__LEGION__.mount: the bundle text is not at hand (the bundle must be an inline script, or give options.bundleText)');
  if (mounted) unmount();
  var theme = o.theme || settings.get().theme, f = D.createElement('iframe'), prefixKey = W.__LEGION_STORAGE__ || '';
  f.className = 'cg-legion-frame'; f.title = 'Legion: synthetic Californians'; f.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#18191c';
  f.srcdoc = '<!doctype html><html lang="en"' + (theme === 'light' || theme === 'dark' ? ' data-theme="' + theme + '"' : '') + ' data-state="loading"><head><meta charset="utf-8"><meta name="legion-build" content="' + esc(parts.build || 'dev') +
    '"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Legion</title><meta name="color-scheme" content="dark light"><meta name="theme-color" content="#18191c"><style>' + parts.css + '</style></head><body>' + parts.markup + '</body></html>';
  var h = mounted = { frame: f, host: host, window: null, legion: null, ready: null, off: [] };
  h.ready = new Promise(function (resolve, reject) {
    f.addEventListener('load', function () {
      if (mounted !== h) return;
      var w = f.contentWindow, d = f.contentDocument; h.window = w;
      try {
        if (prefixKey) w.__LEGION_STORAGE__ = prefixKey;
        w.__LEGION_PACK__ = W.__LEGION_PACK__; w.__LEGION_WORKER_SRC__ = W.__LEGION_WORKER_SRC__;   /* the same strings, not copies */
        var s = d.createElement('script'); s.textContent = code; d.body.appendChild(s);
      } catch (e) { reject(e); return; }
      var t0 = Date.now(), tick = setInterval(function () {
        if (mounted !== h) { clearInterval(tick); reject(new Error('unmounted')); return; }
        var st = d.documentElement.dataset.state;
        if (st === 'error') { clearInterval(tick); reject(new Error('Legion could not start in the frame: ' + clean((d.querySelector('.boot-error') || {}).textContent))); return; }
        if (st === 'ready' && w.legion) {
          clearInterval(tick); var L = h.legion = w.legion;
          try {
            if (o.time != null) L.clock.set(ms(o.time)); else if (simClock) L.clock.set(simClock.t);
            if (o.playing === false) L.clock.pause();
            if (typeof o.onNpc === 'function') L.bus.on(EV.NPC_SELECT, function (e) { if (e && e.id) o.onNpc(String(e.id), e.source || null); });
            if (typeof o.onPlace === 'function') L.bus.on(EV.PLACE_SELECT, function (e) { if (e && e.zi >= 0) o.onPlace(L.world.zips[e.zi], e.source || null); else if (e && e.key) o.onPlace(String(e.key), e.source || null); });
            if (typeof o.onTime === 'function') L.bus.on(EV.TIME_CHANGE, function (e) { if (e) o.onTime(e.t); });
            if (o.zip) L.place(String(o.zip)); if (o.npc) L.select(String(o.npc));
          } catch (e) { /* the view is up; an option that could not be applied is not a failure to mount */ }
          resolve(h);
        } else if (Date.now() - t0 > (o.timeout || 120000)) { clearInterval(tick); reject(new Error('Legion did not start in the frame in time')); }
      }, 100);
    });
  });
  h.select = function (id) { if (h.legion) h.legion.select(String(id)); };
  h.place = function (zip) { if (h.legion) h.legion.place(String(zip)); };
  h.setTime = function (t) { if (h.legion) h.legion.clock.set(ms(t)); };
  h.time = function () { return h.legion ? h.legion.clock.t : null; };
  h.unmount = unmount;
  host.appendChild(f); return h;
}
function unmount() { var h = mounted; mounted = null; if (!h) return false; try { h.frame.remove(); } catch (e) { /* gone already */ } h.legion = null; h.window = null; return true; }

/* ---------- settings, under the page's own storage name ---------- */
var settings = {
  key: __LGK('legion.settings.v1'),
  get: function () { var s = new @@Settings@@({}).public(); delete s.claude.serverKey; delete s.claude.proxy; return s; },   /* says whether a key is kept (hasKey), never the key */
  set: function (patch) { var p = patch || {}; if (p.claude && 'apiKey' in p.claude) throw new Error('__LEGION__.settings: a key is entered in Legion\'s own settings dialog, never through this object');
    new @@Settings@@({}).set(p); if (mounted && mounted.legion) { try { mounted.legion.settings.set(p); } catch (e) { /* the frame keeps its own */ } } return settings.get(); }
};

var API = {
  version: '1.0', build: (W.__LEGION_PARTS__ && W.__LEGION_PARTS__.build) || ((D.querySelector('meta[name="legion-build"]') || { getAttribute: function () { return null; } }).getAttribute('content')) || 'dev', NOTICE: NOTICE,
  ready: ready, get isReady() { return !!info; }, get info() { return info; },
  places: places, place: place, placeAt: placeAt, npcsOf: npcsOf, npc: npc, household: household, whereIs: whereIs, plan: plan, trip: trip,
  crowd: crowd, crowdNow: crowdNow, crowdBase: crowdBase, describe: describe, say: say, topics: Object.keys(ASK), barks: BARKS,
  homesIn: homesIn, cellOf: cellOf, housing: housing,
  get clock() { return simClock ? simClock.t : null; }, set clock(t) { need(); simClock.set(ms(t)); },
  timeAt: function (hhmm, baseT) { need(); var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm)); if (!m) throw new Error('__LEGION__.timeAt: "HH:MM"'); var c = new @@Clock@@({ t0: ms(baseT), playing: false }); c.setMinuteOfDay(60 * +m[1] + +m[2]); return c.t - (c.t % 60000); },
  timeParts: function (t) { need(); var c = new @@Clock@@({ t0: ms(t), playing: false }); return c.parts(); },
  weather: function (id, time) { var zi = zipIndex(id); return SV.weather(zi, ms(time)); },
  mount: mount, unmount: unmount, get mounted() { return mounted; }, settings: settings,
  stats: function () { var z = 0; zcache.forEach(function (c) { z += c.agents || 0; }); return { ready: !!info, workers: pool.length, workersLive: pool.filter(function (k) { return !k.dead; }).length, workerPrepareMs: pool.map(function (k) { return k.ms; }),
    zipsBuilt: zcache.size, zipAgents: z, zipBytes: z * 35, baseAgents: base ? base.agents : 0, baseBytes: base ? base.agents * 35 : 0, queued: jobs.length, mounted: !!mounted }; },
  dropCrowd: function () { zcache.clear(); zAgents = 0; base = null; homes.clear(); prefix.clear(); },
  internals: { get services() { return SV; }, get world() { return world; }, get population() { return pop; }, get clock() { return simClock; }, bus: BUS, events: EV, modules: MODS }
};
W.__LEGION__ = API;
