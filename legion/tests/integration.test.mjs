// Legion · integration tests: the engine modules wired together the way the page uses them (src/app/services.mjs),
// the live NWS layer (src/app/nws-live.mjs) against a fake api.weather.gov, the provenance labels and the NPC
// panel's pure helpers. No network, no DOM: everything here runs in Node.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { createServices, applyReflection } from '../src/app/services.mjs';
import { LiveWeather, adaptLive, liveWeatherAt, liveWorld, toF, LIVE_TTL_MS, cleanForecastText, alertsForZip, periodOf } from '../src/app/nws-live.mjs';
import { factLabel, concernSources, concernSourceText, memorySource } from '../src/app/provenance.mjs';
import { startersFor, big5Words, estimateTokens, activityLine, talkIsStale, TALK_STALE_MIN } from '../src/app/npc-panel.mjs';
import { SimClock } from '../src/app/simclock.mjs';
import { zipScope } from '../src/app/census.mjs';
import { History } from '../src/engine/llm.mjs';

const world = await loadDefaultWorld();
const T = world.snapshotTime;

// ------------------------------------------------------------------ a fake api.weather.gov

/** JSON bodies shaped like api.weather.gov's, for a forecast starting at `start` (epoch ms), 48 hours. */
function nwsBodies(start, { tempF = 81, alert = 'Wind Advisory' } = {}) {
  const iso = ms => new Date(ms).toISOString().replace('.000Z', '+00:00');
  const hours = [];
  for (let k = 0; k < 48; k++) {
    hours.push({ number: k + 1, startTime: iso(start + k * 3600000), endTime: iso(start + (k + 1) * 3600000), isDaytime: k % 24 < 12, temperature: tempF + (k % 5), temperatureUnit: 'F',
      probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 10 }, relativeHumidity: { unitCode: 'wmoUnit:percent', value: 33 }, windSpeed: '12 mph', windDirection: 'NE', shortForecast: 'Sunny', detailedForecast: '' });
  }
  const periods = [0, 12, 24].map((h, k) => ({ number: k + 1, name: ['Today', 'Tonight', 'Tomorrow'][k], startTime: iso(start + h * 3600000), endTime: iso(start + (h + 12) * 3600000), isDaytime: k !== 1, temperature: tempF + 3,
    temperatureUnit: 'F', probabilityOfPrecipitation: { value: null }, windSpeed: '10 to 15 mph', shortForecast: 'Sunny', detailedForecast: `Sunny, with a high near ${tempF + 3}. Northeast wind 10 to 15 mph.` }));
  return {
    points: { properties: { gridId: 'LOX', gridX: 154, gridY: 48, forecast: 'https://api.weather.gov/gridpoints/LOX/154,48/forecast', forecastHourly: 'https://api.weather.gov/gridpoints/LOX/154,48/forecast/hourly', forecastZone: 'https://api.weather.gov/zones/forecast/CAZ369', relativeLocation: { properties: { city: 'Tujunga', state: 'CA' } } } },
    hourly: { properties: { updateTime: iso(start), periods: hours } },
    forecast: { properties: { periods } },
    alerts: { features: alert ? [{ properties: { event: alert, severity: 'Moderate', headline: `${alert} issued by NWS Los Angeles`, onset: iso(start - 3600000), ends: iso(start + 30 * 3600000), description: 'Gusty northeast winds.', instruction: 'Secure outdoor objects.' } }] : [] },
  };
}

/** A fetch that answers from the bodies by URL and records the calls; `fail` makes every call reject. */
function fakeFetch(bodies, { fail = false } = {}) {
  const calls = [];
  const fn = async url => {
    calls.push(String(url));
    if (fail) throw new TypeError('Failed to fetch');
    const u = String(url);
    const body = /\/points\//.test(u) ? bodies.points : /forecast\/hourly$/.test(u) ? bodies.hourly : /\/forecast$/.test(u) ? bodies.forecast : /\/alerts\/active/.test(u) ? bodies.alerts : null;
    return { ok: !!body, status: body ? 200 : 404, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

// ------------------------------------------------------------------ nws-live

test('live NWS: the API answer becomes exactly the shape world.weatherAt returns', () => {
  const zi = world.indexOf('91042');
  const snap = world.weatherAt(zi, T);
  const live = adaptLive(nwsBodies(T - 1800000), T);
  assert.equal(live.office, 'LOX');
  assert.equal(live.point, 'Tujunga');
  assert.equal(live.zone, 'CAZ369');
  assert.equal(live.hourly.length, 48);
  assert.deepEqual(live.hourly[0].slice(1), [81, 33, 10, '12 mph', 'Sunny', 1]);
  const wx = liveWeatherAt(live, T, snap);
  // every key of the snapshot's answer is there, so every reader takes it unchanged
  for (const k of Object.keys(snap)) assert.ok(k in wx, `live weather has ${k}`);
  for (const k of Object.keys(snap.now)) assert.ok(k in wx.now, `live now has ${k}`);
  assert.equal(wx.live, true);
  assert.equal(wx.stale, false);
  assert.ok(wx.now.tempF >= 81 && wx.now.tempF <= 85);
  assert.equal(wx.period.name, 'Today');
  assert.equal(wx.next.length, 2);
  assert.deepEqual(wx.alerts.map(a => a.event), ['Wind Advisory']);
  assert.equal(wx.obs, snap.obs, 'the observing station comes from the snapshot');
  // a time the live hours do not cover reads nothing: the snapshot answers
  assert.equal(liveWeatherAt(live, T + 10 * 86400000, snap), null);
  assert.equal(toF(20, 'wmoUnit:degC'), 68);
  assert.throws(() => adaptLive({ points: {}, hourly: { properties: { periods: [] } } }, T), /empty/);
});

test('live NWS: off by default, fetched once per 15 minutes, failures fall back to the snapshot with a note', async () => {
  const zi = world.indexOf('91042');
  let now = 1_000_000;
  const fetch = fakeFetch(nwsBodies(T - 1800000));
  const lw = new LiveWeather({ world, fetch, now: () => now });
  assert.equal(lw.enabled, false);
  assert.equal(lw.world(), world, 'off: the world itself');
  assert.equal((await lw.refresh(zi)).state, 'off');
  assert.equal(fetch.calls.length, 0, 'nothing is fetched while off');

  lw.setEnabled(true);
  const changes = [];
  lw.onChange(e => changes.push(e.zi));
  const st = await lw.refresh(zi);
  assert.equal(st.state, 'live');
  assert.match(st.note, /^Live from api\.weather\.gov/);
  assert.equal(fetch.calls.length, 4, 'points, the hourly forecast, the 12-hour periods and the alerts');
  assert.match(fetch.calls[0], /^https:\/\/api\.weather\.gov\/points\/34\.\d{4},-118\.\d{4}$/);
  assert.ok(fetch.calls.some(u => /\/alerts\/active\?point=34\.\d{4},-118\.\d{4}$/.test(u)));
  assert.deepEqual(changes, [zi]);
  const wx = lw.weatherAt(zi, T);
  assert.equal(wx.live, true);

  // cached: no second request within 15 minutes; the grid lookup is kept for the session
  now += LIVE_TTL_MS - 1000;
  await lw.refresh(zi);
  assert.equal(fetch.calls.length, 4);
  now += 2000;
  await lw.refresh(zi);
  assert.equal(fetch.calls.length, 7, 'refreshed after 15 minutes, without asking for the grid again');

  // the live-aware world: weather from the cache where it covers the time, else the snapshot; all else is the world
  const view = lw.world();
  assert.notEqual(view, world);
  assert.equal(view.weatherAt(zi, T).live, true);
  assert.equal(view.weatherAt(zi, T + 20 * 86400000).live, undefined, 'outside the live hours: the snapshot (a climate estimate)');
  assert.equal(view.zip(zi).zip, '91042');
  assert.equal(view.N, world.N);
  assert.ok(view.firesOf(zi).length > 0);
  assert.equal(lw.world(), view, 'the same view until the cache changes');
  assert.equal(lw.status(zi, T + 20 * 86400000).state, 'outside');
  assert.match(lw.status(zi, T + 20 * 86400000).note, /so this is the pack's snapshot/);

  // a failure: the note says so and the snapshot answers
  const broken = new LiveWeather({ world, fetch: fakeFetch({}, { fail: true }), enabled: true, now: () => now });
  const bad = await broken.refresh(zi);
  assert.equal(bad.state, 'error');
  assert.match(bad.note, /Live weather is unavailable \(Failed to fetch\); showing the pack's NWS snapshot\./);
  assert.equal(broken.weatherAt(zi, T), null);
  assert.equal(broken.world().weatherAt(zi, T).live, undefined);
  assert.deepEqual(broken.world().weatherAt(zi, T).now, world.weatherAt(zi, T).now);
});

test('liveWorld: only weatherAt changes; writes and lazily built indexes stay on the world', () => {
  const zi = world.indexOf('94110');
  const view = liveWorld(world, (i, t) => (i === zi ? { now: { tempF: 99 }, live: true, alerts: [] } : null));
  assert.equal(view.weatherAt(zi, T).now.tempF, 99);
  assert.equal(view.weatherAt(zi + 1, T).now.tempF, world.weatherAt(zi + 1, T).now.tempF);
  assert.equal(view.liveBase, world);
  assert.ok(view instanceof world.constructor);
  assert.equal(view.raster(), world.raster(), 'methods run on the world (one raster)');
  view.__probe = 1;
  assert.equal(world.__probe, 1);
  delete world.__probe;
});

// ------------------------------------------------------------------ the wired services

function services(opts = {}) {
  const svc = createServices(opts);
  svc.init(world);
  return svc;
}
const residentOf = (svc, zip, seed = 2) => svc.residents(zipScope(world, world.indexOf(zip)), 1, seed)[0];

test('services: every engine module is wired, and the persona follows the simulated hour', () => {
  const svc = services();
  assert.ok(svc.status().every(m => m.available), svc.status().filter(m => !m.available).map(m => m.key).join(', '));
  const npc = residentOf(svc, '91042');
  const a = svc.persona(npc.id, { t: T });
  assert.ok(a.ok, a.message);
  const p = a.value;
  // the lexicon's dialect, not the region key the persona falls back to
  assert.equal(p.speech.dialect, 'sfv');
  assert.equal(p.t, Math.floor(T / 3600000) * 3600000, 'built for the hour holding t');
  assert.equal(svc.persona(npc.id, { t: T + 60000 }).value, p, 'the same hour: the same persona');
  const later = svc.persona(npc.id, { t: T + 3 * 3600000 }).value;
  assert.notEqual(later, p);
  assert.equal(later.t, Math.floor((T + 3 * 3600000) / 3600000) * 3600000);
  assert.deepEqual(later.big5, p.big5, 'who they are does not change with the hour');
  assert.equal(svc.persona(npc.id, { any: true }).value, later, 'any: whatever is cached');
  // with no time, the page's clock (never the wall clock)
  svc.setClock(() => T + 7 * 3600000);
  assert.equal(svc.now(), T + 7 * 3600000);
  assert.equal(svc.persona(npc.id).value.t, Math.floor((T + 7 * 3600000) / 3600000) * 3600000);
});

test('services: an offline conversation hears the persisted mind, and the mind consolidates it', () => {
  const store = new Map();
  const svc = services({ mindStore: { get: id => store.get(id) || null, put: (id, s) => { store.set(id, JSON.parse(JSON.stringify(s))); return true; } } });
  const npc = residentOf(svc, '91042');
  const c = svc.conversation(npc.id, { t: T });
  assert.ok(c.ok, c.message);
  const conv = c.value;
  assert.ok(conv.greet().text);
  const said = ['Hi, my name is Dana.', 'I work as a nurse in Burbank.', 'How is the weather today?', 'Any fires around here?', 'What do you do for work?'];
  const lines = said.map(s => conv.reply(s));
  for (const l of lines) { assert.ok(l.text && l.text.length > 1); assert.ok(Array.isArray(l.facts)); }
  // the weather line states the temperature the Place panel shows for the same time
  const wx = svc.weather(npc.zi, T);
  assert.ok(lines[2].text.includes(String(wx.now.tempF)) || lines[2].facts.includes('weather.now'), lines[2].text);
  conv.farewell();
  const r = svc.reflectOffline(npc.id, { t: T });
  assert.ok(r.ok);
  assert.ok(svc.saveMind(npc.id));
  const state = store.get(npc.id);
  assert.ok(state.memory.some(m => /The player said: "Hi, my name is Dana\."/.test(m.text)), 'the player\'s lines are in the mind');
  assert.ok(state.relationships.player.facts.some(f => /Dana/.test(f.text || f.value)), 'and what they said about themselves');
  // a new session reads the stored mind back: the next conversation remembers the player
  const svc2 = services({ mindStore: { get: id => store.get(id) || null, put: () => true } });
  const m2 = svc2.mind(npc.id, { t: T + 86400000 });
  assert.ok(m2.ok);
  assert.ok(m2.value.relationship('player').facts.some(f => /Dana/.test(f.text || f.value)));
});

test('services: the Claude path records the player in the mind, and a reflection lands there', async () => {
  const svc = services();
  const npc = residentOf(svc, '94110', 3);
  const r = svc.observe(npc.id, { kind: 'utterance', from: 'player', text: 'I just moved here from Ohio.', t: T });
  assert.ok(r.ok);
  const mind = svc.mind(npc.id).value;
  assert.ok(mind.toJSON().memory.some(m => /moved here from Ohio/.test(m.text)));
  assert.ok(mind.relationship('player').met >= 0);
  // a ClaudeVoice stand-in with the bridge's reflect() contract
  svc.wire({ llm: { ...await import('../src/engine/llm.mjs'), ClaudeVoice: class { async reflect() { return { summary: 'We talked about Ohio.', facts_about_player: ['moved here from Ohio'], affinity_delta: 0.1, trust_delta: 0.05, mood: 'content', memorable_line: 'I just moved here from Ohio.', follow_up: 'Ask how the move went.' }; } } } });
  const out = await svc.reflect(npc.id, new History(), { claude: { apiKey: 'sk-ant-test' }, network: { claude: true } }, { t: T });
  assert.ok(out.ok, out.message);
  const m = svc.mind(npc.id).value;
  assert.ok(m.toJSON().memory.some(x => x.text === 'We talked about Ohio.'));
  assert.ok(m.relationship('player').facts.some(f => f.text === 'moved here from Ohio'));
  assert.equal(typeof applyReflection, 'function');
});

test('services: the prompt is the exact system blocks (three cache breakpoints with the turn) and the situation note', () => {
  const svc = services();
  const npc = residentOf(svc, '93721');
  const r = svc.prompt(npc.id, { t: T, said: 'How is the weather?' });
  assert.ok(r.ok, r.message);
  const { blocks, text, situation } = r.value;
  assert.equal(blocks.length, 2);
  assert.ok(blocks.every(b => b.cache_control && b.cache_control.type === 'ephemeral'), 'rules and sheet each carry a breakpoint');
  assert.equal(text, blocks.map(b => b.text).join('\n\n'));
  assert.match(situation, /^\[Situation for this turn/);
  assert.match(situation, /Local time: Monday, November 23, 2026/);
  assert.match(situation, new RegExp(`${svc.weather(npc.zi, T).now.tempF}°F`));
  // the game-engine export names the model and effort chosen in Settings
  const ex = svc.exportPersona(npc.id, { claude: { model: 'claude-sonnet-5-5', effort: 'medium' } });
  assert.ok(ex.ok);
  assert.equal(ex.value.defaults.model, 'claude-sonnet-5-5');
  assert.deepEqual(ex.value.defaults.output_config, { effort: 'medium' });
  assert.equal(ex.value.id, npc.id);
});

test('services: street barks come in agreeing pairs, and the street view gets plans and personas from the engine', () => {
  const svc = services();
  const scope = zipScope(world, world.indexOf('90011'));
  const [a, b] = svc.residents(scope, 2, 5);
  const t = T + 2 * 3600000;
  const first = svc.bark(a.id, b.id, { t });
  // B's answer to A is the one barkBetween made for that opener (asked for right after, as the street view does)
  const answer = svc.bark(b.id, a.id, { t, replyTo: first ? first.text : 'Hi' });
  if (first) assert.ok(first.text.length > 0);
  if (answer) assert.ok(answer.text.length > 0);
  assert.ok(first || answer, 'at least one of the two says something');
  // a fake StreetView receives everything it needs
  let captured = null;
  svc.wire({ street: { StreetView: class { constructor(c, o) { captured = o; } } } });
  const r = svc.streetView('canvas', { getTime: () => t });
  assert.ok(r.ok, r.message);
  assert.equal(captured.world, world);
  assert.equal(typeof captured.planFor, 'function');
  assert.equal(typeof captured.bark, 'function');
  assert.equal(typeof captured.persona, 'function');
  const plan = captured.planFor(a.id, t);
  assert.ok(plan && typeof plan.kind === 'string' && plan.position, 'the plan is schedule.activityAt');
  assert.equal(captured.persona(a.id).id, a.id);
  assert.equal(captured.getTime(), t);
});

test('services: with live weather on, conversations, personas and the Place panel read the live forecast', async () => {
  const zip = '91042', zi = world.indexOf(zip);
  // a live forecast starting at the snapshot hour, 30°F warmer than the snapshot, with its own alert
  const bodies = nwsBodies(T - 1800000, { tempF: world.weatherAt(zi, T).now.tempF + 30, alert: 'Red Flag Warning' });
  const svc = services({ fetch: fakeFetch(bodies) });
  const npc = residentOf(svc, zip);
  const before = svc.weather(zi, T);
  assert.notEqual(before.live, true);
  svc.setLiveWeather(true);
  const st = await svc.refreshWeather(zi, T);
  assert.equal(st.state, 'live');
  const wx = svc.weather(zi, T);
  assert.equal(wx.live, true);
  assert.ok(wx.now.tempF >= before.now.tempF + 30);
  assert.deepEqual(wx.alerts.map(a => a.event), ['Red Flag Warning']);
  // the offline engine speaks from the live forecast
  const conv = svc.conversation(npc.id, { t: T }).value;
  conv.greet();
  const line = conv.reply('How hot is it today?');
  assert.ok(line.text.includes(String(wx.now.tempF)) || !line.facts.includes('weather.now'), `"${line.text}" should state ${wx.now.tempF}`);
  // and the persona's alert clauses name the live alert
  const p = svc.persona(npc.id, { t: T }).value;
  assert.ok(JSON.stringify(p.concerns).includes('Red Flag Warning') || JSON.stringify(p.hooks).includes('Red Flag Warning'), 'the live alert reaches the persona');
  // switched off again: the snapshot
  svc.setLiveWeather(false);
  assert.notEqual(svc.weather(zi, T).live, true);
});

// ------------------------------------------------------------------ provenance and panel helpers

test('provenance: fact ids, concern columns and memory sources in words', () => {
  assert.equal(factLabel('fire:Station:2009'), 'the Station Fire, 2009 (CAL FIRE perimeters)');
  assert.equal(factLabel('fire:Btu Lightning Complex:2020'), 'the BTU Lightning Complex, 2020 (CAL FIRE perimeters)');
  assert.equal(factLabel('acs.density'), 'how densely people live here (Census ACS)');
  assert.equal(factLabel('schedule.activity'), 'what they are doing now (their schedule)');
  assert.equal(factLabel('household.members'), 'who they live with (their record)');
  assert.equal(factLabel('weather.now'), 'the forecast for this hour (NWS)');
  assert.equal(factLabel('road:I-210'), 'I-210 (Caltrans 2024 traffic census)');
  assert.equal(factLabel('aadt:I-210'), 'daily traffic on I-210 (Caltrans 2024 traffic census)');
  assert.equal(factLabel('alert:Red Flag Warning'), 'the Red Flag Warning (NWS alert)');
  assert.equal(factLabel('acs.lang.spanish'), 'neighbors who speak Spanish at home (Census ACS)');
  assert.equal(factLabel('landmark:Mount Lukens'), 'Mount Lukens (USGS place names)');
  assert.equal(factLabel('something.new'), 'something.new');
  const why = '9.8% of residential policies up for renewal in 91042 were not renewed in 2023 (nonren_sh); there are 13.7 FAIR Plan home policies per 100 homes here (fair_sh); a wood shake roof in a fire hazard zone (roof, fhsz_any 23%)';
  assert.deepEqual(concernSources(why).map(s => s.column), ['nonren_sh', 'fair_sh', 'roof', 'fhsz_any']);
  assert.equal(concernSourceText(why), 'CA Dept. of Insurance via the atlas · FAIR Plan via the atlas · their household · CAL FIRE hazard zones via the atlas');
  assert.equal(memorySource({ source: 'firesOf(91042): Station 2009' }), 'CAL FIRE perimeters');
  assert.equal(memorySource({ source: 'femaOf(91042): 2025-01-08 Los Angeles wildfires' }), 'FEMA declarations');
  assert.equal(memorySource({ source: 'zip 91042: heat_rec_f 1997-08-05' }), 'atlas station records');
  assert.equal(memorySource({ kind: 'life', source: 'household.yearMoved' }), 'their own life');
});

test('NPC panel helpers: Big Five in words, token estimates, starters only about what the data holds', async () => {
  assert.equal(big5Words('O', 0.9), 'very curious, open to new things');
  assert.equal(big5Words('E', 0.3), 'reserved, recharges alone');
  assert.equal(big5Words('N', 0.5), 'in between');
  assert.equal(big5Words('X', 0.5), '');
  assert.equal(estimateTokens('abcd'.repeat(25)), 25);
  const svc = services();
  // snow only where it snows, the heat only where it is hot, fires only where they burned
  const tahoe = residentOf(svc, '96150'), fresno = residentOf(svc, '93721'), mission = residentOf(svc, '94110');
  assert.ok(startersFor(world, tahoe).includes('Does it snow much up here?'));
  assert.ok(!startersFor(world, mission).some(s => /snow|heat|fire/i.test(s)), startersFor(world, mission).join(' | '));
  assert.ok(startersFor(world, fresno).includes('How do you handle the heat here?'));
  // a coastal alert is news on the shore, not 30 km inland
  const inland = residentOf(svc, '91042');
  const coastal = { alerts: [{ event: 'Coastal Flood Advisory' }] };
  assert.ok(!startersFor(world, inland, { weather: coastal }).some(s => /Coastal/.test(s)));
  assert.ok(startersFor(world, residentOf(svc, '90291'), { weather: coastal }).includes('Heard about the Coastal Flood Advisory?'));
  assert.equal(activityLine({ kind: 'work', label: 'work in Palmdale', place: { label: 'Palmdale' }, endMin: 990 }), 'At work in Palmdale · until 4:30 PM');
});

// ------------------------------------------------------------------ review fixes: weather text, alerts, sources, barks, talk time

test('forecast text: NWS template placeholders never reach the panels, live answers are cleaned at the source', () => {
  // the Truckee forecast point of the snapshot (84 ZIPs read it at the default time)
  const zi = world.indexOf('96161');
  const raw = world.weatherAt(zi, T).period.detail;
  assert.match(raw, /\{\{missing_temperature_data\}\}/, 'the snapshot still carries the placeholder this guards against');
  assert.equal(cleanForecastText(raw), 'Mostly sunny. Calm wind.');
  assert.equal(cleanForecastText('Sunny, with a high near 45. Light east wind around 0 mph.'), 'Sunny, with a high near 45. Calm wind.');
  assert.equal(cleanForecastText('Rain likely.  Chance of precipitation is 60%.'), 'Rain likely. Chance of precipitation is 60%.');
  assert.equal(cleanForecastText('Snow. North winds 10 to 15 mph.'), 'Snow. North winds 10 to 15 mph.');
  assert.ok(cleanForecastText('word '.repeat(300), { max: 40 }).endsWith('…'));
  const live = periodOf({ name: 'Tonight', startTime: '2026-11-24T18:00:00-08:00', endTime: '2026-11-25T06:00:00-08:00', isDaytime: false, temperature: 30, temperatureUnit: 'F', windSpeed: '0 mph', shortForecast: 'Clear', detailedForecast: 'Clear. {{missing_temperature_data}}. West wind around 0 mph.' });
  assert.equal(live.detail, 'Clear. Calm wind.');
  // every period of every ZIP of the snapshot reads clean
  let periods = 0;
  for (let i = 0; i < world.N; i += 7) {
    const wx = world.weatherAt(i, T);
    for (const p of [wx.period, ...(wx.next || [])].filter(Boolean)) { periods++; assert.doesNotMatch(cleanForecastText(p.detail || ''), /\{\{|\}\}|\.\s*\.|\s,/, `${world.zips[i]}: ${p.detail}`); }
  }
  assert.ok(periods > 200);
});

test('alerts: a shore-only alert is not news far inland, in the Place panel as in the starters and the dialogue', () => {
  const coastal = [{ event: 'Coastal Flood Advisory' }, { event: 'High Surf Warning' }, { event: 'Wind Advisory' }];
  const lancaster = world.indexOf('93534'), venice = world.indexOf('90291');
  assert.ok(world.z.coast_km[lancaster] > 60 && world.z.coast_km[venice] < 3);
  assert.deepEqual(alertsForZip(coastal, world.z.coast_km[lancaster]).map(a => a.event), ['Wind Advisory']);
  assert.deepEqual(alertsForZip(coastal, world.z.coast_km[venice]).map(a => a.event), coastal.map(a => a.event));
  assert.equal(alertsForZip(coastal, null).length, 3, 'an unknown distance keeps every alert');
  // at the snapshot time, no ZIP more than 8 km inland is shown a shore-only alert
  let inland = 0;
  for (let i = 0; i < world.N; i++) {
    if (!(world.z.coast_km[i] > 8)) continue;
    const shown = alertsForZip(world.weatherAt(i, T).alerts, world.z.coast_km[i]);
    inland++;
    assert.ok(!shown.some(a => /coastal|surf|rip current|beach|sneaker/i.test(a.event)), `${world.zips[i]}: ${shown.map(a => a.event)}`);
  }
  assert.ok(inland > 500);
});

test('provenance: every concern a persona has names the data behind it', () => {
  const svc = services();
  let concerns = 0;
  for (const npc of svc.population.sampleState(160, 5)) {
    const p = svc.persona(npc.id, { t: T });
    assert.ok(p.ok, p.message);
    for (const c of p.value.concerns) {
      concerns++;
      assert.ok(concernSourceText(c.why), `${npc.id} ${c.topic}: no source in "${c.why}"`);
    }
  }
  assert.ok(concerns > 300, `${concerns} concerns`);
  assert.equal(concernSourceText('the Gifford Fire burned 131,614 acres 23.6 km from 93444 in 2025 (firesOf)'), 'CAL FIRE perimeters');
  assert.equal(concernSourceText('came to the US in 2025 (arrivalYear) from Chandigarh, India (birthplace)'), 'their Census-calibrated record');
  assert.equal(concernSourceText('the valley holds smoke (province: Great Valley)'), 'California Geological Survey provinces');
  assert.equal(concernSourceText('unemployment in 92127 is 3.5% (ACS B23025)'), 'Census ACS 2020–2024');
});

test('street barks: the answer kept for a pair is the one given, however fast the clock runs', async () => {
  const { barkBetween } = await import('../src/engine/dialogue.mjs');
  const svc = services();
  const scope = zipScope(world, world.indexOf('90011'));
  const people = svc.residents(scope, 24, 9);
  let pairs = 0, matched = 0;
  for (let k = 0; k + 1 < people.length; k += 2) {
    const [a, b] = [people[k], people[k + 1]];
    const t = T + k * 3600000;
    const first = svc.bark(a.id, b.id, { t, situation: 'pass' });
    if (!first) continue;
    // the answer barkBetween gives for this opener (deterministic in the two personas and the moment)
    const [lineA, lineB] = barkBetween(world, svc.persona(a.id, { t, any: true }).value, svc.persona(b.id, { t, any: true }).value, { t, situation: 'pass' });
    assert.equal(first.text, lineA.text);
    if (!lineB) continue;
    pairs++;
    // the street asks B 1.4 s of real time later: at 3600x that is 84 simulated minutes, and a caller may give no
    // time at all; either way B answers with the line that goes with A's
    const reply = svc.bark(b.id, a.id, k % 4 ? { t: t + 84 * 60000, replyTo: first.text } : { replyTo: first.text });
    if (reply && reply.text === lineB.text) matched++;
  }
  assert.ok(pairs >= 4 && matched === pairs, JSON.stringify({ pairs, matched }));
});

test('talk time: a conversation happens in real time, and one the clock has left behind is stale', () => {
  const bus = { events: [], emit(e, p) { this.events.push([e, p]); } };
  const clock = new SimClock({ t0: T, speed: 600, playing: true, bus });
  clock.hold(1);
  assert.equal(clock.rate, 1);
  assert.equal(clock.speed, 600, 'the chosen speed waits');
  clock.advance(2000);
  assert.equal(clock.t, T + 2000, 'two real seconds are two simulated seconds while held');
  clock.release();
  assert.equal(clock.rate, 600);
  clock.advance(1000);
  assert.equal(clock.t, T + 2000 + 600000);
  clock.hold(1);
  clock.setSpeed(600);   // the player chooses a speed: the hold ends
  assert.equal(clock.held, null);
  assert.equal(clock.rate, 600);
  assert.ok(bus.events.some(([, p]) => p.held === 1 && p.rate === 1), 'the hold is in the time:change payload');
  assert.equal(talkIsStale(T, T + (TALK_STALE_MIN - 1) * 60000), false);
  assert.equal(talkIsStale(T, T + (TALK_STALE_MIN + 1) * 60000), true);
  assert.equal(talkIsStale(T, T - 3 * 3600000), true, 'the clock set back is another moment too');
  assert.equal(talkIsStale(NaN, T), false);
});

test('the persona sheet Claude caches stays byte-identical as the hours pass (the moment goes in the situation note)', () => {
  const svc = services();
  const ids = [...['96161', '94603', '90011', '92101', '95969'].flatMap(z => svc.residents(zipScope(world, world.indexOf(z)), 3, 2).map(n => n.id))];
  let transitions = 0;
  for (const id of ids) {
    let prev = null;
    for (let h = 0; h < 48; h += 1) {
      const t = T + h * 3600000;
      const r = svc.prompt(id, { t });
      assert.ok(r.ok, r.message);
      const sheet = r.value.blocks[1].text;
      if (prev !== null) { transitions++; assert.equal(sheet, prev, `${id}: the sheet changed between hours ${h - 1} and ${h}`); }
      prev = sheet;
      // the hour's own weather is still there for the persona's hooks, first, when it is worth mentioning
      const p = svc.persona(id, { t }).value;
      assert.ok(p.hooks.length >= 3 && p.hooks.length <= 5, `${id}: ${p.hooks}`);
      if (p.hookDetails[0].kind === 'weather') assert.deepEqual(p.hookDetails.slice(1).map(x => x.text), p.lastingHooks.slice(0, p.hooks.length - 1).map(x => x.text));
      else assert.deepEqual(p.hookDetails, p.lastingHooks);
    }
  }
  assert.ok(transitions > 600);
});
