import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld, decodePath, pointInRings, World } from '../src/engine/world.mjs';
import { Rng, hash3, Alias } from '../src/engine/rng.mjs';
import { pacific, atPacific, fmtClock, dayPart } from '../src/engine/clock.mjs';

const world = await loadDefaultWorld();
const SNAP = world.snapshotTime;
const zi = zip => { const i = world.indexOf(zip); assert.ok(i >= 0, zip); return i; };
const countyFema = name => world.counties.find(c => c.name === name).fema;

test('pack totals reconcile with the atlas and the Census', () => {
  assert.equal(world.N, 1762);
  assert.equal(world.totalPop, 39286245);
  let acsPop = 0; for (let i = 0; i < world.N; i++) acsPop += world.acs(i, 'age').reduce((a, b) => a + b, 0);
  assert.equal(acsPop, world.totalPop);
});

test('ZIP rows resolve names', () => {
  const z = world.zip('94110');
  assert.equal(z.city, 'San Francisco'); assert.equal(z.countyName, 'San Francisco'); assert.equal(z.regionKey, 'ba');
  const t = world.zip('96161'); assert.equal(t.regionKey, 'si'); assert.ok(t.snowfall_in > 100);
});

test('projection round-trips and ZIP lookup finds the ZIP of its own town point', () => {
  for (const zip of ['94110', '90001', '96161', '92262', '95521']) {
    const i = world.indexOf(zip), z = world.zip(i);
    const p = world.project(z.lat, z.lon), q = world.unproject(p.x, p.y);
    assert.ok(Math.abs(q.lat - z.lat) < 1e-9 && Math.abs(q.lon - z.lon) < 1e-9);
    const home = world.homeFor(i, 7);
    assert.equal(world.zipAt(home.x, home.y), i, zip);
  }
});

test('sampled homes fall inside their ZIP', () => {
  const rng = new Rng(3);
  let inside = 0, n = 0;
  for (let i = 0; i < world.N; i += 7) for (let k = 0; k < 20; k++) { const p = world.sampleHome(i, rng); n++; if (pointInRings(p.x, p.y, world.zipRings(i))) inside++; }
  assert.ok(inside / n > 0.97, `${inside}/${n}`);
});

test('path decoding', () => {
  const r = decodePath('M0 0l10 0l0 10l-10 0z');
  assert.equal(r.length, 1); assert.deepEqual([...r[0]], [0, 0, 10, 0, 10, 10, 0, 10]);
  assert.ok(pointInRings(5, 5, r)); assert.ok(!pointInRings(15, 5, r));
});

test('lookups: roads, landmarks, fires, weather', () => {
  const i = world.indexOf('90265'), z = world.zip(i);
  assert.ok(world.firesOf(i).some(f => f.name === 'Woolsey' && f.year === 2018));
  assert.ok(world.roadsNear(z.tx, z.ty, 15).some(r => r.name === 'SR 1'));
  const wx = world.weatherAt(world.indexOf('96161'));
  assert.ok(Number.isFinite(wx.now.tempF) && wx.now.tempF < 50);
  assert.ok(world.landmarksNear(z.tx, z.ty, 30).length > 0);
});

test('rng determinism and alias draws', () => {
  const a = new Rng(42), b = new Rng(42);
  for (let k = 0; k < 100; k++) assert.equal(a.next(), b.next());
  assert.notEqual(hash3(1, 2, 3), hash3(1, 2, 4));
  const al = new Alias([1, 0, 3]), r = new Rng(9), c = [0, 0, 0];
  for (let k = 0; k < 40000; k++) c[al.draw(r)]++;
  assert.equal(c[1], 0); assert.ok(Math.abs(c[2] / 40000 - 0.75) < 0.02);
});

test('Pacific clock', () => {
  const t = atPacific(2026, 11, 23, 14, 38);
  const p = pacific(t);
  assert.equal(p.hour, 14); assert.equal(p.minute, 38); assert.equal(p.dow, 1);
  assert.equal(fmtClock(7 * 60 + 5), '7:05 AM'); assert.equal(dayPart(8 * 60), 'morning');
  const summer = pacific(atPacific(2026, 7, 4, 9, 0)); assert.equal(summer.hour, 9);
});

// ---------------------------------------------------------------- final review fixes (foundation)

test('FEMA: a county lists only the declarations that designated it (fid-1)', () => {
  // Alameda filed 3 registrations under the 2025 Los Angeles wildfires and 1 under the Napa earthquake: not designated
  const alameda = countyFema('Alameda').map(e => e[0]);
  assert.ok(!alameda.includes('2025-01-08'), 'Alameda carries the 2025 Los Angeles wildfires');
  assert.ok(!alameda.includes('2014-09-11'), 'Alameda carries the 2014 Napa earthquake');
  assert.ok(alameda.includes('2023-01-14'), 'Alameda was designated for the January 2023 storms');
  for (const n of ['Sacramento', 'Kern', 'San Bernardino', 'Orange']) assert.ok(!countyFema(n).some(e => e[0] === '2025-01-08'), n);
  assert.ok(countyFema('Los Angeles').some(e => e[0] === '2025-01-08' && /Los Angeles wildfires/.test(e[2])));
  for (const n of ['Napa', 'Solano']) assert.ok(countyFema(n).some(e => e[0] === '2014-09-11'), n);
  for (const n of ['Shasta', 'Lake']) assert.ok(countyFema(n).some(e => e[0] === '2018-08-04'), `${n}: Carr fire`);
  assert.ok(!countyFema('Riverside').some(e => e[0] === '2018-08-04' || e[0] === '2017-10-10'), 'Riverside: Carr or North Bay fires');
  const pairs = world.counties.reduce((s, c) => s + c.fema.length, 0);
  assert.ok(pairs >= 100 && pairs <= 160, `county-declaration pairs ${pairs} (300 before)`);
  for (const c of world.counties) for (const e of c.fema) assert.ok(e.length === 4 && /^\d{4}-\d\d-\d\d$/.test(e[0]) && e[2] && e[3], JSON.stringify(e));
  assert.deepEqual(world.femaOf(zi('94606')), countyFema('Alameda'));
});

test('places: every Census place point is on land, San Francisco in the city (fid-3)', () => {
  for (const p of world.places) assert.ok(world.zipAt(p.x, p.y) >= 0, `${p.name} ${p.lat},${p.lon}`);
  const sf = world.places.find(p => p.name === 'San Francisco');
  assert.equal(world.z.city[world.zipAt(sf.x, sf.y)], 'San Francisco');
  const oak = world.zip('94612');
  assert.ok(world.distKm(oak.tx, oak.ty, sf.x, sf.y) < 20, 'downtown Oakland to San Francisco');
  const near = world.placesNear(world.zip('94015').tx, world.zip('94015').ty, 25).map(p => p.name);
  assert.ok(near.includes('San Francisco'), 'Daly City has San Francisco nearby');
  const sm = world.places.find(p => p.name === 'Santa Monica');
  assert.ok(['90401', '90402', '90403', '90404', '90405'].includes(world.zips[world.zipAt(sm.x, sm.y)]));
});

test('weather: the forecast is the ZIP\'s own, borrowed within 80 km and its office, or the climate (fid-2)', () => {
  const kinds = new Set();
  for (let i = 0; i < world.N; i++) {
    const wx = world.weatherAt(i, SNAP), b = wx.basis;
    kinds.add(b.kind);
    assert.ok(['forecast', 'borrowed', 'climate'].includes(b.kind));
    assert.equal(wx.approx, b.kind !== 'forecast');
    assert.ok(Number.isFinite(wx.now.tempF));
    if (b.kind === 'climate') { assert.equal(wx.point, null); assert.equal(wx.stale, true); assert.equal(wx.next.length, 0); assert.equal(wx.period, null); continue; }
    assert.ok(b.distKm <= 80, `${world.zips[i]} reads ${b.point} ${b.distKm} km away`);
    assert.equal(b.office, world.z.wfo[i], `${world.zips[i]} reads another office's forecast`);
    assert.equal(wx.point, b.point);
    if (b.kind === 'forecast') { assert.ok(b.distKm <= 15); assert.equal(b.elevAdjF, 0); }
  }
  assert.deepEqual([...kinds].sort(), ['borrowed', 'climate', 'forecast']);
  // Mammoth Lakes (2,672 m, east of the crest) used Fresno's forecast and Hanford's key messages
  const m = world.weatherAt(zi('93546'), atPacific(2026, 11, 25, 18, 10));
  assert.equal(m.basis.kind, 'climate'); assert.equal(m.office, 'REV'); assert.equal(m.next.length, 0);
  assert.deepEqual(m.keyMessages, world.weather.afd.REV.key);
  for (const zip of ['93514', '92328', '93555', '92225', '92363', '95468']) assert.equal(world.weatherAt(zi(zip), SNAP).basis.kind, 'climate', zip);
  const sf = world.weatherAt(zi('94110'), SNAP);
  assert.equal(sf.basis.kind, 'forecast'); assert.equal(sf.point, 'San Francisco'); assert.equal(sf.approx, false);
  const tahoe = world.weatherAt(zi('96150'), SNAP);
  assert.equal(tahoe.basis.kind, 'borrowed'); assert.equal(tahoe.point, 'Truckee'); assert.equal(tahoe.approx, true);
});

test('weather: the station offset fades from the snapshot; borrowed forecasts are carried to the ZIP\'s height (fid-2)', () => {
  // Fresno's 2:38 PM station read 48.2 F against a 58 F forecast; Tuesday 8 AM must read the NWS hourly (44 F)
  const i = zi('93727'), fresno = world.weather.points.find(p => p.city === 'Fresno');
  const t = atPacific(2026, 11, 24, 8, 0), row = fresno.hourly.find(r => Math.abs(Date.parse(r[0]) - t) < 60000);
  assert.equal(world.weatherAt(i, t).now.tempF, row[1]);
  assert.ok(Math.abs(world.weatherAt(i, SNAP).now.tempF - world.weatherAt(i, SNAP).obs.tempF) <= 1.5, 'at the snapshot the station stands');
  // Victorville borrows Riverside's forecast from about 750 m lower: colder, in the numbers and in the text
  const v = world.weatherAt(zi('92392'), SNAP), riv = world.weather.points.find(p => p.city === 'Riverside');
  assert.equal(v.basis.kind, 'borrowed'); assert.ok(v.basis.elevAdjF < -5, String(v.basis.elevAdjF));
  for (const p of [v.period, ...v.next]) {
    const src = riv.periods.find(q => q.name === p.name && q.start === p.start);
    assert.equal(p.tempF, src.tempF + Math.round(v.basis.elevAdjF), p.name);
    const n = /(?:high near|low around) (-?\d+)/.exec(p.detail);
    if (n) assert.equal(+n[1], p.tempF, `${p.name}: ${p.detail}`);
    assert.equal(p.detail.match(/\d+ mph/g)?.join(), src.detail.match(/\d+ mph/g)?.join(), 'wind speeds unchanged');
  }
  const carried = World._carryPeriod({ name: 'x', tempF: 50, detail: 'Rain, with a low around 50. Wind chill values as low as 40. South wind around 15 mph, with gusts as high as 30 mph. New rainfall amounts around 0.25 inches. Snow level around 5500 feet. Temperatures falling to around 45 in the afternoon.' }, -7);
  assert.equal(carried.detail, 'Rain, with a low around 43. Wind chill values as low as 33. South wind around 15 mph, with gusts as high as 30 mph. New rainfall amounts around 0.25 inches. Snow level around 5500 feet. Temperatures falling to around 38 in the afternoon.');
  // every ZIP has a forecast office, and the snapshot's points belong to theirs
  for (let k = 0; k < world.N; k++) assert.ok(world.offices[world.z.wfo[k]], world.zips[k]);
  for (const p of world.weather.points) assert.equal(world.z.wfo[world.indexOf(p.zip)], p.office, p.city);
});

test('climate estimate: the day turns at Pacific midnight, and the year follows the normals (eng-52)', () => {
  const i = zi('94110');
  for (let d = 1; d <= 28; d++) {   // April 2027: daylight time
    const first = world.climateAt(i, atPacific(2027, 4, d, 0, 5));
    for (const [h, m] of [[0, 55], [1, 5], [6, 0], [12, 0], [23, 55]]) {
      const c = world.climateAt(i, atPacific(2027, 4, d, h, m));
      assert.equal(c.pop, first.pop, `2027-04-${d} ${h}:${m}`);
      assert.equal(/Partly/.test(c.short), /Partly/.test(first.short), `2027-04-${d} ${h}:${m} ${c.short} vs ${first.short}`);
    }
  }
  // mean daily highs (NOAA 1991-2020 normals) in mid-January and mid-November, within 6 F
  const normals = { '93721': [55, 64], '92328': [67, 77], '96001': [56, 63], '94102': [58, 63], '93546': [41, 47], '92101': [66, 70], '92225': [67, 75] };
  for (const [zip, [jan, nov]] of Object.entries(normals)) {
    assert.ok(Math.abs(world.climateAt(zi(zip), atPacific(2027, 1, 15, 15, 0)).tempF - jan) <= 7, `${zip} January`);
    assert.ok(Math.abs(world.climateAt(zi(zip), atPacific(2026, 11, 15, 15, 0)).tempF - nov) <= 6, `${zip} November`);
  }
});

test('atmospheric rivers carry the landfall rank and the rank at the ZIP\'s coast (fid-5)', () => {
  const i = zi('90001'), z = world.zip(i);
  const jan17 = world.arsOf(i, 200).find(a => a.start === '2017-01-07');
  assert.equal(jan17.rank, 5); assert.equal(jan17.peakAt, 'Point Reyes');
  assert.equal(jan17.rankHere, 3); assert.equal(jan17.coast, 'Santa Monica Bay');
  assert.equal(z.ar_max, 4);
  const top = world.arsOf(i, 6);
  for (let k = 1; k < top.length; k++) assert.ok(top[k - 1].rankHere >= top[k].rankHere, 'strongest here first');
  for (let k = 0; k < world.N; k++) for (const a of world.arsOf(k, 12)) {
    assert.ok(a.rankHere >= 1 && a.rankHere <= world.z.ar_max[k], `${world.zips[k]} ${a.start}`);
    assert.ok(a.rank >= a.rankHere);
  }
});

test('wind events reach the ZIPs whose own record has that wind (fid-12)', () => {
  for (const zip of ['92225', '92310', '92277', '92311', '92252']) assert.ok(!world.windsOf(zi(zip), 20).some(w => w.kind === 'santa_ana'), zip);
  assert.ok(world.windsOf(zi('92335'), 10).some(w => w.kind === 'santa_ana'), 'Fontana');
  let n = 0;
  for (let k = 0; k < world.N; k++) {
    const off = world.z.off_kind[k] || '';
    for (const w of world.windsOf(k, 20)) {
      n++;
      if (w.kind === 'santa_ana') assert.ok(off === 'sa' || world.z.sa_ep[k] > 0, world.zips[k]);
      if (w.kind === 'diablo') assert.ok(off === 'di' || world.z.di_ep[k] > 0, world.zips[k]);
      if (w.kind === 'sundowner') assert.equal(off, 'su', world.zips[k]);
      assert.ok(w.fips.includes(world.countyOf(k).fips));
    }
  }
  assert.ok(n > 5000);
  assert.ok(world.windsOf(zi('93101'), 40).some(w => w.kind === 'sundowner'), 'Santa Barbara has its sundowners');
  assert.ok(!world.windsOf(zi('93436'), 40).some(w => w.kind === 'sundowner'), 'Lompoc has no sundowners');
});

test('fires rank by salience: Hollister leads with the SCU Lightning Complex, not a 7-acre fire (fid-23)', () => {
  const h = world.firesOf(zi('95023'));
  assert.equal(h[0].name, 'Scu Lightning Complex');
  assert.ok(h.findIndex(f => f.name === 'Pond') > 0);
  assert.equal(world.firesOf(zi('90265'))[0].name, 'Woolsey');
  assert.equal(world.firesOf(zi('95969'))[0].name, 'Camp');
  for (let k = 0; k < world.N; k += 3) { const f = world.firesOf(k); for (let j = 1; j < f.length; j++) assert.ok(f[j - 1].salience >= f[j].salience); }
});

test('neighborhoods inside the big cities, and search finds them (exp-68)', () => {
  const nb = zip => world.zip(zip).neighborhood;
  assert.equal(nb('94110'), 'the Mission'); assert.equal(nb('94102'), 'the Tenderloin'); assert.equal(nb('90033'), 'Boyle Heights');
  assert.equal(nb('90028'), 'Hollywood'); assert.equal(nb('90026'), 'Echo Park'); assert.equal(nb('92104'), 'North Park');
  assert.equal(nb('94618'), 'Rockridge'); assert.equal(nb('95125'), 'Willow Glen'); assert.equal(nb('95817'), 'Oak Park');
  assert.equal(nb('90803'), 'Belmont Shore'); assert.equal(nb('93728'), 'the Tower District');
  // a ZIP whose Census place is another community keeps that name
  for (const zip of ['90022', '90001', '95821', '91001']) assert.equal(nb(zip), null, zip);
  assert.equal(world.zip('90022').neighborhood || world.zip('90022').placeName, 'East Los Angeles');
  const cities = new Set(['San Francisco', 'Los Angeles', 'Oakland', 'San Jose', 'San Diego', 'Sacramento', 'Long Beach', 'Fresno']);
  let named = 0;
  for (let k = 0; k < world.N; k++) {
    const z = world.zip(k);
    if (!z.neighborhood) { assert.deepEqual(z.neighborhoods, []); continue; }
    named++;
    assert.ok(cities.has(z.city) && (z.place == null || z.place === z.city), z.zip);
    assert.equal(z.neighborhoods[0], z.neighborhood);
  }
  assert.ok(named >= 150, String(named));
  const hit = q => world.search(q, 12).filter(r => r.kind === 'neighborhood');
  assert.equal(hit('Mission')[0].index, zi('94110'));
  assert.equal(hit('the mission')[0].index, zi('94110'));
  assert.equal(hit('Boyle Heights')[0].index, zi('90033'));
  assert.ok(hit('Koreatown').length && hit('Koreatown')[0].zis.includes(zi('90005')));
  assert.ok(world.search('Mission', 12).some(r => r.kind === 'city' && /Mission Viejo/.test(r.label)), 'cities still found');
});

test('year built: the Census top code reads as before 1940 (exp-65)', () => {
  const flagged = [];
  for (let k = 0; k < world.N; k++) { const z = world.zip(k); if (z.ybBefore1940) flagged.push(z.zip); assert.equal(z.ybBefore1940, z.yb_med != null && z.yb_med <= 1939); }
  assert.ok(flagged.includes('94110') && flagged.includes('94117') && flagged.includes('94118'));
  assert.ok(flagged.length >= 30 && flagged.length <= 60, String(flagged.length));
  assert.equal(world.zip('94612').ybBefore1940, false);
});

test('station records carry their distance and height difference (fid-6)', () => {
  const onyx = world.zip('93255');
  assert.equal(onyx.heat_st, 'Lodgepole'); assert.ok(onyx.heat_km > 100);
  for (const col of ['heat_km', 'heat_dz', 'rain_rec_km', 'gust_km', 'gust_dz', 'elev_pt_m', 'ar_pt', 'wfo', 'nbhd']) assert.ok(world.pack.zcols.includes(col), col);
  let withRec = 0;
  for (let k = 0; k < world.N; k++) if (world.z.heat_rec_f[k] != null) { withRec++; assert.ok(Number.isFinite(world.z.heat_km[k]), world.zips[k]); }
  assert.ok(withRec > 1700);
  assert.ok(world.zip('90012').heat_km < 15);
});
