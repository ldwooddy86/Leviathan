/* The page shield's time zone and language engine, run in a Node vm context (no DOM: the DOM modules switch
   themselves off). The process runs in Asia/Kolkata with a German default locale, so nothing passes by accident:
   every expected value comes from this outer realm's own Intl with an explicit time zone. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
if (!process.env.OUTIS_SHIELD_CHILD) {
  const r = spawnSync(process.execPath, [FILE], { encoding: 'utf8', env: Object.assign({}, process.env, { OUTIS_SHIELD_CHILD: '1', TZ: 'Asia/Kolkata', LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8' }) });
  process.stdout.write((r.stdout || '') + (r.stderr || ''));
  process.exit(r.status === null ? 1 : r.status);
}

const { test, assert, run } = await import('./harness.mjs');
const ROOT = path.resolve(path.dirname(FILE), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'inject', 'shield.js'), 'utf8');

function shielded(cfg) {
  const ctx = vm.createContext({});
  ctx.__outis_cfg = cfg;
  vm.runInContext(SRC, ctx);
  return ctx;
}
const ev = (ctx, code) => vm.runInContext(code, ctx);

/* ---- the reference: this realm's Intl with an explicit zone ---- */
const WEEK = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const refFmt = new Map();
function ref(tz, t) {
  let f = refFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'longOffset' });
    refFmt.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(t).map(x => [x.type, x.value]));
  const m = /GMT(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(p.timeZoneName);
  const off = m && m[1] ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3] + (m[4] ? +m[4] / 60 : 0)) : 0;
  return { y: +p.year, mo: +p.month - 1, d: +p.day, wd: WEEK[p.weekday], h: +p.hour, mi: +p.minute, s: +p.second, tzo: -off || 0 };
}
/* Instants at and around this zone's offset changes, plus a spread over a century. */
function instants(tz) {
  const out = [];
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 600; i++) out.push(Math.floor(Date.UTC(1950, 0, 1) + rnd() * (Date.UTC(2050, 0, 1) - Date.UTC(1950, 0, 1))));
  for (const year of [1999, 2026, 2038]) {
    let prev = ref(tz, Date.UTC(year, 0, 1)).tzo;
    for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += 3600000) {
      const o = ref(tz, t).tzo;
      if (o !== prev) for (let d = -7200000; d <= 7200000; d += 900000) out.push(t + d, t + d - 1, t + d + 1);
      prev = o;
    }
  }
  return out;
}
const ZONES = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Australia/Sydney', 'Asia/Kathmandu', 'Pacific/Auckland', 'America/Sao_Paulo', 'Asia/Tokyo', 'Atlantic/Reykjavik'];

test('this process really is elsewhere (Asia/Kolkata, German)', () => {
  assert.equal(new Date(0).getTimezoneOffset(), -330);
  assert.match(new Intl.DateTimeFormat().resolvedOptions().timeZone, /^Asia\/(Kolkata|Calcutta)$/);
  assert.match(new Intl.NumberFormat().resolvedOptions().locale, /^de/);
});

for (const tz of ZONES) {
  test(`${tz}: every local field and the offset match, across changes and a century`, () => {
    const ctx = shielded({ place: { id: 't', tz } });
    const ts = instants(tz);
    ctx.__ts = ts;
    const got = ev(ctx, `__ts.map(t => { const d = new Date(t); return [d.getFullYear(), d.getMonth(), d.getDate(), d.getDay(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getTimezoneOffset()]; })`);
    for (let i = 0; i < ts.length; i++) {
      const r = ref(tz, ts[i]);
      assert.deepEqual([...got[i]], [r.y, r.mo, r.d, r.wd, r.h, r.mi, r.s, r.tzo], `${tz} at ${new Date(ts[i]).toISOString()}`);
    }
    assert.equal(ev(ctx, 'Intl.DateTimeFormat().resolvedOptions().timeZone'), new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone);
  });

  test(`${tz}: local dates map back to the right instant (existing, repeated and skipped times)`, () => {
    const ctx = shielded({ place: { id: 't', tz } });
    const walls = [];
    for (const t of instants(tz).filter((x, i) => i % 3 === 0)) {
      const r = ref(tz, t);
      walls.push([r.y, r.mo, r.d, r.h, r.mi]);
    }
    for (let h = 0; h < 4; h++) walls.push([2026, 2, 8, h, 30], [2026, 9, 4, h, 30], [2026, 10, 1, h, 30], [2026, 3, 5, h, 30], [2026, 8, 27, h, 30]);
    ctx.__w = walls;
    const got = ev(ctx, '__w.map(w => new Date(w[0], w[1], w[2], w[3], w[4]).getTime())');
    for (let i = 0; i < walls.length; i++) {
      const [y, mo, d, h, mi] = walls[i];
      const L = Date.UTC(y, mo, d, h, mi);
      /* every instant whose wall clock reads L, from the offsets in use within a day either side */
      const offs = new Set();
      for (let k = -2; k <= 2; k++) offs.add(-ref(tz, L + k * 43200000).tzo * 60000);
      const valid = [...offs].map(o => L - o).filter(t => { const r = ref(tz, t); return Date.UTC(r.y, r.mo, r.d, r.h, r.mi) === L; }).sort((a, b) => a - b);
      const expected = valid.length ? valid[0] : L + ref(tz, L - 86400000).tzo * 60000;
      assert.equal(got[i], expected, `${tz} ${walls[i].join('-')}`);
    }
  });
}

test('known edge cases: gaps, repeats, odd offsets', () => {
  const ny = shielded({ place: { id: 'ny', tz: 'America/New_York' } });
  assert.equal(ev(ny, 'new Date(2026, 2, 8, 2, 30).toISOString()'), '2026-03-08T07:30:00.000Z');
  assert.equal(ev(ny, 'new Date(2026, 10, 1, 1, 30).toISOString()'), '2026-11-01T05:30:00.000Z');
  assert.equal(ev(ny, 'new Date(2026, 0, 15, 10, 30).getHours()'), 10);
  const syd = shielded({ place: { id: 's', tz: 'Australia/Sydney' } });
  assert.equal(ev(syd, 'new Date(2026, 9, 4, 2, 30).toISOString()'), '2026-10-03T16:30:00.000Z');
  const ktm = shielded({ place: { id: 'k', tz: 'Asia/Kathmandu' } });
  assert.equal(ev(ktm, 'new Date(2026, 0, 1).toISOString()'), '2025-12-31T18:15:00.000Z');
  assert.equal(ev(ktm, 'new Date(2026, 0, 1).getTimezoneOffset()'), -345);
  const utc = shielded({ place: { id: 'nowhere', tz: 'UTC' } });
  assert.equal(ev(utc, 'new Date(2026, 0, 15, 10, 30).toISOString()'), '2026-01-15T10:30:00.000Z');
  assert.ok(Object.is(ev(utc, 'new Date().getTimezoneOffset()'), 0), 'zero, not minus zero');
  assert.equal(ev(utc, 'new Date(99, 0).getFullYear()'), 1999, 'two-digit years still mean the 1900s');
  assert.ok(Number.isNaN(ev(utc, 'new Date(NaN).getHours()')));
});

test('setters work on the wall clock, including across a skipped hour', () => {
  const ny = shielded({ place: { id: 'ny', tz: 'America/New_York' } });
  assert.equal(ev(ny, 'const d = new Date(Date.UTC(2026, 2, 7, 17)); d.setDate(8); d.setHours(2, 30); [d.getHours(), d.toISOString()].join(" ")'), '3 2026-03-08T07:30:00.000Z');
  assert.equal(ev(ny, 'const e = new Date(Date.UTC(2026, 6, 4, 16)); e.setHours(23, 59, 59, 999); e.toISOString()'), '2026-07-05T03:59:59.999Z');
  assert.equal(ev(ny, 'const f = new Date(Date.UTC(2026, 0, 31, 17)); f.setMonth(1); [f.getMonth(), f.getDate()].join("/")'), '2/3');
  assert.equal(ev(ny, 'new Date(new Date(NaN).setFullYear(2026)).toISOString()'), '2026-01-01T05:00:00.000Z');
  assert.ok(Number.isNaN(ev(ny, 'new Date(NaN).setHours(1)')));
  assert.equal(ev(ny, 'const g = new Date(Date.UTC(2026, 5, 1, 12)); g.setYear(99); g.getFullYear()'), 1999);
  assert.equal(ev(ny, 'const h = new Date(Date.UTC(2026, 5, 1, 12)); h.setMilliseconds(1500); [h.getSeconds(), h.getMilliseconds()].join(",")'), '1,500');
});

test('strings read in the place', () => {
  const ny = shielded({ place: { id: 'ny', tz: 'America/New_York' } });
  assert.equal(ev(ny, 'String(new Date(Date.UTC(2026, 6, 4, 16)))'), 'Sat Jul 04 2026 12:00:00 GMT-0400 (Eastern Daylight Time)');
  assert.equal(ev(ny, 'new Date(Date.UTC(2026, 0, 4, 16)).toString()'), 'Sun Jan 04 2026 11:00:00 GMT-0500 (Eastern Standard Time)');
  assert.equal(ev(ny, 'new Date(Date.UTC(2026, 6, 4, 16)).toDateString()'), 'Sat Jul 04 2026');
  assert.equal(ev(ny, 'new Date(Date.UTC(2026, 6, 4, 16)).toTimeString()'), '12:00:00 GMT-0400 (Eastern Daylight Time)');
  assert.equal(ev(ny, 'String(new Date(NaN))'), 'Invalid Date');
  assert.match(ev(ny, 'Date()'), /^\w{3} \w{3} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT-0[45]00 \(Eastern (Standard|Daylight) Time\)$/);
  assert.equal(ev(ny, 'new Date(0).toLocaleString("en-US")'), '12/31/1969, 7:00:00 PM');
  assert.equal(ev(ny, 'new Date(0).toLocaleString()'), '12/31/1969, 7:00:00 PM', 'default locale en-US, zone of the place');
  assert.equal(ev(ny, 'new Date(0).toLocaleDateString()'), '12/31/1969');
  assert.equal(ev(ny, 'new Date(0).toLocaleTimeString()'), '7:00:00 PM');
  assert.equal(ev(ny, 'new Date(0).toLocaleString("en-US", { timeZone: "UTC" })'), '1/1/1970, 12:00:00 AM', 'an explicit zone is respected');
  assert.equal(ev(ny, 'new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo" }).resolvedOptions().timeZone'), 'Asia/Tokyo');
  assert.equal(ev(ny, 'new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23" }).format(new Date(Date.UTC(2026, 6, 4, 16)))'), '12');
  assert.equal(ev(ny, 'String(new Date(NaN).toLocaleString())'), 'Invalid Date');
  const utc = shielded({ place: { id: 'nowhere', tz: 'UTC' } });
  assert.equal(ev(utc, 'String(new Date(0))'), 'Thu Jan 01 1970 00:00:00 GMT+0000 (Coordinated Universal Time)');
});

test('parsing: strings without a zone are the place\'s local time', () => {
  const ny = shielded({ place: { id: 'ny', tz: 'America/New_York' } });
  const cases = {
    '2026-07-04T12:00': Date.UTC(2026, 6, 4, 16),
    '2026-07-04T12:00:30.250': Date.UTC(2026, 6, 4, 16, 0, 30, 250),
    '2026-07-04': Date.UTC(2026, 6, 4),
    '2026-07': Date.UTC(2026, 6, 1),
    '2026-07-04T12:00:00Z': Date.UTC(2026, 6, 4, 12),
    '2026-07-04T12:00:00+02:00': Date.UTC(2026, 6, 4, 10),
    'July 4, 2026 12:00:00': Date.UTC(2026, 6, 4, 16),
    '07/04/2026': Date.UTC(2026, 6, 4, 4),
    '2026/07/04 12:00': Date.UTC(2026, 6, 4, 16),
    'Sat, 04 Jul 2026 12:00:00 GMT': Date.UTC(2026, 6, 4, 12),
    'Sat Jul 04 2026 12:00:00 GMT-0400 (Eastern Daylight Time)': Date.UTC(2026, 6, 4, 16),
    'Jul 4 2026 12:00 PDT': Date.UTC(2026, 6, 4, 19)
  };
  for (const [s, want] of Object.entries(cases)) {
    ny.__s = s;
    assert.equal(ev(ny, 'Date.parse(__s)'), want, s);
    assert.equal(ev(ny, 'new Date(__s).getTime()'), want, 'new Date: ' + s);
  }
  assert.ok(Number.isNaN(ev(ny, 'Date.parse("not a date")')));
  assert.equal(ev(ny, 'new Date(new Date(5)).getTime()'), 5);
  assert.equal(ev(ny, 'new Date({ valueOf() { return 7; } }).getTime()'), 7);
  assert.equal(ev(ny, 'new Date({ [Symbol.toPrimitive]() { return "2026-07-04T12:00"; } }).getTime()'), Date.UTC(2026, 6, 4, 16));
});

test('the replacements look native', () => {
  const ctx = shielded({ place: { id: 'ny', tz: 'America/New_York' } });
  const checks = {
    'Function.prototype.toString.call(Date.prototype.getHours)': 'function getHours() { [native code] }',
    'Date.prototype.setHours.toString()': 'function setHours() { [native code] }',
    'String(Date)': 'function Date() { [native code] }',
    'String(Intl.DateTimeFormat)': 'function DateTimeFormat() { [native code] }',
    'String(Function.prototype.toString)': 'function toString() { [native code] }',
    'Date.prototype.getHours.name': 'getHours',
    'Date.prototype.setHours.length': 4,
    'Date.UTC.length': 7,
    'Date.length': 7,
    'Date.name': 'Date',
    'Date.prototype.constructor === Date': true,
    'Intl.DateTimeFormat.prototype.constructor === Intl.DateTimeFormat': true,
    'new Date() instanceof Date': true,
    '"prototype" in Date.prototype.getHours': false,
    'Object.getOwnPropertyDescriptor(globalThis, "Date").enumerable': false,
    'Object.getOwnPropertyDescriptor(Date.prototype, "getHours").enumerable': false,
    'typeof Date.now()': 'number',
    'Object.keys(globalThis).length': 0,
    '"__outis_cfg" in globalThis': false,
    '(() => { class X extends Date {} const x = new X(2026, 0, 1); return x instanceof X && x.getFullYear() === 2026 && x.getHours() === 0; })()': true,
    '(() => { try { Date.prototype.getHours.call({}); return "no throw"; } catch (e) { return e.constructor.name; } })()': 'TypeError',
    '(() => { try { new Date.prototype.getHours(); return "no throw"; } catch (e) { return e.constructor.name; } })()': 'TypeError',
    'Intl.DateTimeFormat.supportedLocalesOf(["en-US"]).length': 1,
    'typeof Intl.DateTimeFormat("en-US").format': 'function'
  };
  for (const [code, want] of Object.entries(checks)) assert.equal(ev(ctx, code), want, code);
});

test('language: the default locale is en-US everywhere Intl uses one', () => {
  const ctx = shielded({ place: { id: 'nowhere', tz: 'UTC' } });
  assert.equal((1234.5).toLocaleString(), '1.234,5', 'outside the shield: German');
  assert.equal(ev(ctx, '(1234.5).toLocaleString()'), '1,234.5');
  assert.equal(ev(ctx, 'new Intl.NumberFormat().resolvedOptions().locale'), 'en-US');
  assert.equal(ev(ctx, 'Intl.DateTimeFormat().resolvedOptions().locale'), 'en-US');
  assert.equal(ev(ctx, 'new Intl.Collator().resolvedOptions().locale'), 'en-US');
  assert.equal(ev(ctx, 'new Intl.PluralRules().resolvedOptions().locale'), new Intl.PluralRules('en-US').resolvedOptions().locale);
  assert.equal(ev(ctx, 'new Intl.RelativeTimeFormat().format(-1, "day")'), '1 day ago');
  assert.equal(ev(ctx, '(12345678901234567890n).toLocaleString()'), '12,345,678,901,234,567,890');
  assert.equal(ev(ctx, '(1234.5).toLocaleString("de-DE")'), '1.234,5', 'an explicit locale is respected');
  assert.equal(ev(ctx, 'Intl.NumberFormat.prototype.constructor === Intl.NumberFormat'), true);
  assert.equal(ev(ctx, '"a".localeCompare("b")'), -1);
  assert.throws(() => ev(ctx, 'Intl.PluralRules()'), /requires 'new'|TypeError|Constructor/);
  const off = shielded({ place: { id: 'nowhere', tz: 'UTC' }, 'no-language': 1 });
  assert.equal(ev(off, '(1234.5).toLocaleString()'), '1.234,5', 'language switched off leaves the locale alone');
});

test('switched off, the clock is left alone; unknown zones fall back to UTC; a second run changes nothing', () => {
  const off = shielded({ place: { id: 'tokyo', tz: 'Asia/Tokyo' }, 'no-timezone': 1 });
  assert.equal(ev(off, 'new Date(0).getTimezoneOffset()'), -330);
  assert.match(ev(off, 'Intl.DateTimeFormat().resolvedOptions().timeZone'), /^Asia\/(Kolkata|Calcutta)$/);
  const bad = shielded({ place: { id: 'x', tz: 'Mars/Olympus_Mons' } });
  assert.equal(ev(bad, 'new Date(0).getTimezoneOffset()'), 0);
  assert.equal(ev(bad, 'Intl.DateTimeFormat().resolvedOptions().timeZone'), 'UTC');
  const twice = shielded({ place: { id: 'tokyo', tz: 'Asia/Tokyo' } });
  twice.__outis_cfg = { place: { id: 'tokyo', tz: 'Asia/Tokyo' } };
  vm.runInContext(SRC, twice);
  assert.equal(ev(twice, 'new Date(Date.UTC(2026, 0, 1, 0)).getHours()'), 9);
  assert.equal(ev(twice, '"__outis_cfg" in globalThis'), false);
});

process.exit(await run('shield') ? 1 : 0);
