import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld, decodePath, pointInRings } from '../src/engine/world.mjs';
import { Rng, hash3, Alias } from '../src/engine/rng.mjs';
import { pacific, atPacific, fmtClock, dayPart } from '../src/engine/clock.mjs';

const world = await loadDefaultWorld();

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
