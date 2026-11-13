import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { context, load, fakeFetch, same, ROOT } from './helpers/load.mjs';

const fx = n => JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'cpsc', n), 'utf8'));
const FURNACE = fx('recall-title-furnace-2026-11-13.json'), HP = fx('recall-title-heat-pump-2026-11-13.json'), SPACE = fx('recall-title-space-heater-2026-11-13.json');
const fresh = () => load(context(), 'live/core.js', 'live/geo.js', 'live/sources/cpsc_recalls.js').TDA_LIVE;

test('units: the first number in the CPSC phrase', () => {
  const L = fresh();
  assert.equal(L.cpsc.units('About 298,300 (In addition, about 44,000 were sold in Canada)'), 298300); assert.equal(L.cpsc.units('About 17, 370 (In addition, about 782 units were sold'), 17370);
  assert.equal(L.cpsc.units('Approximately 60,000'), 60000); assert.equal(L.cpsc.units('About 96'), 96); assert.equal(L.cpsc.units(''), null); assert.equal(L.cpsc.units(null), null);
});

test('kinds: central equipment, room heaters, alarms; water heaters and gadgets dropped', () => {
  const L = fresh(), k = L.cpsc.kindOf;
  assert.equal(k('Allied Air Enterprises Recalls Armstrong Air and Air Ease Gas Furnaces', ''), 'furnace');
  assert.equal(k('Goodman Recalls Evaporator Coil Drain Pans Installed with Condensing Gas Furnaces', ''), 'furnace');
  assert.equal(k('Daikin Recalls Daikin FIT, Amana Brand S-series, and Goodman SD Heat Pumps', ''), 'heatpump');
  assert.equal(k('Daikin Recalls Amana Through-The-Wall Air Conditioners and Heat Pumps', ''), 'room');
  assert.equal(k('Rinnai America Recalls Boilers Due to Carbon Monoxide (CO) Poisoning Hazard', ''), 'boiler');
  assert.equal(k('DREO Recalls DR-HSH015 Space Heaters Due to Fire and Burn Hazards', ''), 'room');
  assert.equal(k('Kidde Recalls TruSense Smoke and Combination Smoke/Carbon Monoxide Alarms', ''), 'alarm');
  for (const t of ['Rheem Recalls Tankless Water Heaters', 'Patio Heaters Recalled', 'Heated Blankets Recalled', 'Pool Heaters Recalled Due to Fire Hazard', 'Bottle Warmers and Heaters']) assert.equal(k(t, ''), null, t);
  same(L.cpsc.hazardOf('Recalled Due to Risk of Serious Injury or Death from Fire, Carbon Monoxide (CO) Poisoning'), ['carbon monoxide', 'fire']);
});

test('parse keeps what a contractor needs from a real answer', () => {
  const L = fresh(); const r = L.cpsc.parse(FURNACE);
  assert.equal(r.length, 3);
  const a = r.find(x => x.no === '23218');
  same({ d: a.d, kind: a.kind, units: a.units, hazards: a.hazards, maker: a.maker }, { d: '2023-06-08', kind: 'furnace', units: 9255, hazards: ['carbon monoxide'], maker: 'Allied Air Enterprises LLC' });
  assert.match(a.url, /^https:\/\/www\.cpsc\.gov\/Recalls\/2023\//); assert.ok(a.hazard.length <= 260);
  assert.ok(L.cpsc.parse(HP).some(x => x.kind === 'heatpump' && x.units === 56000)); assert.ok(L.cpsc.parse(SPACE).every(x => x.kind === 'room'));
  same(L.cpsc.parse(null), []); same(L.cpsc.parse([{ Title: 'x' }]), []);
});

test('the collector merges the searches, newest first, and survives one failed search', async () => {
  const L = fresh();
  const fetch = fakeFetch([[/RecallTitle=furnace/, FURNACE], [/RecallTitle=heat%20pump/, HP], [/RecallTitle=boiler/, { status: 500, body: 'x' }], [/RecallTitle=heater/, SPACE], [/RecallTitle=carbon/, []]]);
  const http = L.makeHttp({ fetch, gapMs: 0, backoffMs: 1, retries: 0 });
  const d = await L.BY_ID.cpsc_recalls.run({ http, now: new Date('2026-11-13T18:00:00Z'), prev: null, geo: L.geo, settings: {} });
  assert.equal(d.failed, 1); assert.equal(d.recalls.length, new Set(d.recalls.map(r => r.id)).size, 'no duplicates');
  assert.ok(d.recalls.every((r, i) => i === 0 || d.recalls[i - 1].d >= r.d), 'newest first');
  assert.ok(fetch.calls.every(c => /RecallDateStart=2019-01-01/.test(c.url) && /format=json/.test(c.url)));
  const g = L.BY_ID.cpsc_recalls.digest(JSON.parse(JSON.stringify(d)));
  assert.ok(g.central >= 5 && g.room >= 4 && /^20\d\d-\d\d-\d\d · /.test(g.newest));
  await assert.rejects(() => L.BY_ID.cpsc_recalls.run({ http: L.makeHttp({ fetch: fakeFetch([[/./, { status: 503, body: '' }]]), gapMs: 0, backoffMs: 1, retries: 0 }), now: new Date(), prev: null, geo: L.geo, settings: {} }), /503/);
});
