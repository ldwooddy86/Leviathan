/* Module 14 Weather Desk and the National Weather Service layer behind it (NWSX): the touch up defects, the heating view, the
   year turn, every export, and a guard that the summer desk is still the one Build 4 shows.
   No network anywhere. Each scenario opens its own browser context in which every request is refused (or answered by the
   test itself), the page clock is set, a time zone is chosen, the snapshot is the fixture of tests/fixtures/nwsx (not whatever
   is baked into the build that day), the live baseline is taken away and storage is seeded. tests/fixtures/nwsx/README.md says
   where each fixture came from. The freeze week figures asserted below were worked out by hand from the fixture; the sums are
   written beside them. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const FXD = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'nwsx'), fx = n => JSON.parse(readFileSync(join(FXD, n), 'utf8'));
const SNAP = fx('snapshot-2026-09-26.json'), LIVE_WEEK = fx('cache-live-week-2026-11-13.json'), FREEZE = fx('synthetic-cache-freeze-week.json'), COLD_REC = fx('live-nws-cold-2026-11-13.json'), SEASON_REC = fx('live-acis-season-2026-11-13.json'), B4 = fx('build4-summer-desk.json');
const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const NOV = '2026-11-13T19:00:00Z';                       /* Friday 1 pm in Dallas, 45 minutes after the two November caches were fetched */
const ZONES = ['America/Chicago', 'America/Los_Angeles', 'UTC'];
const DASH = /[A-Za-z][-‐-―−][A-Za-z]|\s[-‐-―−]\s/;       /* a hyphen or a dash between words */

/* What the desk shows, read in the page. */
export const collect = () => {
  const M = document.getElementById('mod-weather'), q = (s, r) => [...(r || M).querySelectorAll(s)], tx = e => e ? String(e.innerText === undefined ? e.textContent : e.innerText).replace(/\s+/g, ' ').trim() : null, one = (s, r) => (r || M).querySelector(s);
  const pressed = one('#w14View button[aria-pressed="true"]');
  return {
    view: pressed ? pressed.dataset.v : null, line: one('#w14Line').value, status: tx(one('#w14Status')),
    kpis: q('#w14Kpis .kpi').map(k => [tx(one('.kl span', k)), tx(one('.kv', k)), tx(one('.kd', k)), q('.kl .g', k).map(tx).join('/')]),
    days: q('#w14Days .daycard').map(c => ({ text: tx(c), tags: q('.tag', c).map(tx) })),
    narr: q('#w14Narr li').map(tx),
    alerts: q('#w14Alerts .alertrow').map(a => ({ event: tx(one('.ah b', a)), tags: q('.aact .tag', a).map(tx), act: tx(one('.aact', a)), when: tx(one('.ah .mini', a)) })), alertNote: tx(one('#w14Alerts .callout')),
    obs: q('#w14Obs tbody tr').map(tx), obsNote: tx(one('#w14ObsN')), spc: q('#w14Spc tbody tr').map(tx), spcNote: tx(one('#w14Spc p')),
    season: q('#w14Season .qb').map(b => [tx(one('.qt', b)), tx(one('.qv', b)), tx(one('.qd', b))]), clim: q('#w14Season tbody tr').map(tx), climHead: tx(one('#w14Season .dsec')), seasonNote: tx(one('#w14Season p.mini')),
    hourNote: tx(one('#w14HourN')), hourLines: q('#w14HourChart svg text.lblm').map(tx), hourAxis: q('#w14HourChart svg text.ax').map(tx), cards: q('.card-h').map(tx),
    grid: { head: tx(one('#w14Grid thead')), cells: q('#w14Grid tbody td').map(tx), titles: q('#w14Grid tbody td').map(c => c.title), note: tx(one('#w14Grid p')) }, win: { head: tx(one('#w14Win thead')), rows: q('#w14Win tbody tr').map(tx), none: tx(one('#w14Win p')) },
    hist: tx(one('#w14HistChart p')), histSvg: !!one('#w14HistChart svg'),
    lines: Object.fromEntries(SLM.LINES.map(l => [l.id, { windows: NWSX.windows(l.id).map(w => [w.date, w.dow, w.start, w.end, w.kind, w.avg, w.peak]), sched: NWSX.scheduleCSV(l.id), hourly: NWSX.hourlyCSV(l.id) }])),
    json: NWSX.snapshotJSON(), mast: tx(one('.mast')), meth: q('#w14Meth li').map(tx), judg: tx(one('#w14Judg')), src: q('#w14Src > .srcs > div').map(tx),
  };
};

/* ---------- a stand in for api.weather.gov and www.spc.noaa.gov, built from a cache fixture ---------- */
const f2c = f => (f == null ? null : (f - 32) * 5 / 9), kmh = m => (m == null ? null : m / 0.621371);
function fakeNWS(cache, o) {
  o = o || {}; const d = cache.data, lay = (k, conv) => ({ values: (d.grid[k] || []).map(x => ({ validTime: `${x.t}/PT${x.h}H`, value: x.v == null ? null : conv ? conv(x.v) : x.v })) });
  const box = lab => ({ type: 'FeatureCollection', features: lab ? [{ type: 'Feature', properties: { LABEL: lab, VALID: '202611141200', EXPIRE: '202611151200', ISSUE: '202611131712' }, geometry: { type: 'Polygon', coordinates: [[[-99, 31], [-95, 31], [-95, 34], [-99, 34], [-99, 31]]] } }] : [] });
  const end = Date.parse(o.now || NOV);
  /* a station's history: a reading every 20 minutes for 80 hours, 8°C falling to 2°C, a wind chill in the coldest ones */
  const hist = () => ({ features: Array.from({ length: 240 }, (_, i) => { const t = end - i * 20 * 6e4, c = 2 + 6 * i / 240; return { properties: { timestamp: new Date(t).toISOString().replace('.000Z', '+00:00'), temperature: { value: +c.toFixed(2) }, relativeHumidity: { value: 60.4 }, windChill: { value: i < 30 ? +(c - 3).toFixed(2) : null } } }; }) });
  return route => {
    const u = route.request().url(), J = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (o.fail && o.fail.test(u)) return route.abort();
    let m;
    if (/\/points\//.test(u)) return J({ properties: { gridId: 'FWD', gridX: 94, gridY: 105, forecastZone: 'https://api.weather.gov/zones/forecast/TXZ119', county: 'https://api.weather.gov/zones/county/TXC113', radarStation: 'KFWS' } });
    if (/\/gridpoints\/FWD\/94,105\/forecast\/hourly$/.test(u)) return J({ properties: { periods: d.hourly.map(h => ({ startTime: h.t, temperature: h.tempF, relativeHumidity: { value: h.rh }, probabilityOfPrecipitation: { value: h.pop }, windSpeed: h.wind, shortForecast: h.short, isDaytime: h.isDay })) } });
    if (/\/gridpoints\/FWD\/94,105\/forecast$/.test(u)) return J({ properties: { updateTime: d.forecast.updated, generatedAt: d.forecast.generated, periods: d.forecast.periods.map(p => ({ name: p.name, startTime: p.start, endTime: p.end, isDaytime: p.isDay, temperature: p.tempF, shortForecast: p.short, detailedForecast: p.detail, probabilityOfPrecipitation: { value: p.pop }, windSpeed: p.wind, windDirection: p.windDir })) } });
    if (/\/gridpoints\/FWD\/94,105$/.test(u)) return J({ properties: { updateTime: d.grid.updated, heatIndex: lay('heatIndex', f2c), apparentTemperature: lay('apparentTemperature', f2c), maxTemperature: lay('maxTemperature', f2c), minTemperature: lay('minTemperature', f2c), probabilityOfThunder: lay('probabilityOfThunder'), hazards: { values: [] } } });
    if (/\/alerts\/active\?area=TX$/.test(u)) return J({ features: d.alerts.map(a => ({ properties: { id: a.id, event: a.event, severity: a.severity, urgency: a.urgency, certainty: a.certainty, headline: a.headline, description: a.description, instruction: a.instruction, onset: a.onset, ends: a.ends, expires: a.expires, senderName: a.sender, areaDesc: a.areas, sent: a.sent, geocode: { UGC: a.counties.map(c => d.zones.forecast[c]) } } })).concat([{ properties: { id: 'far', event: 'Red Flag Warning', severity: 'Severe', headline: 'far west Texas', expires: '2026-11-14T06:00:00+00:00', geocode: { UGC: ['TXZ001'] } } }]) });
    if ((m = /\/stations\/(\w+)\/observations\/latest$/.exec(u))) { const s = d.obs.stations.find(x => x.id === m[1]); return s ? J({ properties: { timestamp: s.time, temperature: { value: f2c(s.tempF) }, relativeHumidity: { value: s.rh }, heatIndex: { value: null }, windChill: { value: m[1] === 'KDTO' ? f2c(30.2) : null }, windSpeed: { value: kmh(s.windMph) }, textDescription: s.text } }) : route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '{}' }); }
    if (/\/stations\/\w+\/observations\?/.test(u)) return J(hist());
    if (/\/products\/types\/AFD\/locations\/FWD$/.test(u)) return J({ '@graph': [{ '@id': 'https://api.weather.gov/products/test-afd' }] });
    if (/\/products\/test-afd$/.test(u)) return J({ issuanceTime: '2026-11-13T17:40:00+00:00', productText: '000\n\n.KEY MESSAGES...\n\n- Cold rain on Sunday.\n- A warming trend next week.\n\n&&\n\n.SHORT TERM...\nA test discussion.\n\n&&\n\n.LONG TERM...\nNothing of note.\n\n&&\n' });
    if ((m = /spc\.noaa\.gov\/products\/outlook\/(\w+)\.lyr\.geojson$/.exec(u))) return J(box(m[1] === 'day2otlk_cat' ? 'SLGT' : m[1] === 'day3otlk_cat' ? '<i>ODD</i>' : null));
    return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '{}' });
  };
}
/* every date in a cache moved by a whole number of days: the same week in another month (weekdays kept when the shift is a multiple of 7) */
const shiftDays = (obj, n) => JSON.parse(JSON.stringify(obj).replace(/(\d{4})-(\d\d)-(\d\d)T/g, (_, y, m, d) => new Date(Date.UTC(+y, +m - 1, +d + n)).toISOString().slice(0, 11)).replace(/"(\d{4})(\d\d)(\d\d)(\d{4})"/g, (_, y, m, d, hm) => '"' + new Date(Date.UTC(+y, +m - 1, +d + n)).toISOString().slice(0, 10).replace(/-/g, '') + hm + '"'));
/* the cold forecast record of the live layer made 24°F colder, the way the freeze week cache was made from the live week */
const colder = (rec, by) => { const r = JSON.parse(JSON.stringify(rec)), sub = v => (v == null ? v : v - by); r.data.points.forEach(p => { const lowOn = {}; p.nights.forEach(n => { n.lowF = sub(n.lowF); n.appF = sub(n.appF); n.wcF = n.appF; lowOn[n.m] = n.lowF; }); p.days.forEach(x => { x.hiF = sub(x.hiF); x.hdd = lowOn[x.d] == null ? null : Math.max(0, 65 - Math.floor((x.hiF + lowOn[x.d]) / 2 + 0.5)); }); }); return r; };

export default async function (page, t, ctx) {
  const browser = page.context().browser(), opened = [];
  async function open(o) {
    o = o || {};
    const context = await browser.newContext({ viewport: { width: o.width || 1440, height: 900 }, acceptDownloads: true, timezoneId: o.tz || 'America/Chicago', colorScheme: o.dark ? 'dark' : 'light' });
    const p = await context.newPage(), reqs = [], errors = [];
    await p.route(/^https?:\/\//, r => { const q = r.request(); if (/api\.weather\.gov|spc\.noaa\.gov/.test(q.url())) reqs.push({ url: q.url(), accept: q.headers().accept || '', headers: Object.keys(q.headers()) }); return o.net ? o.net(r) : r.abort(); });
    if (o.clock) { if (o.running) await p.clock.install({ time: new Date(o.clock) }); else await p.clock.setFixedTime(new Date(o.clock)); }
    await p.addInitScript(({ snap, storage }) => {
      if (snap !== 'baked') Object.defineProperty(window, '__NWS_SNAPSHOT__', { get: () => snap, set: () => { }, configurable: true });
      Object.defineProperty(window, '__LIVE_BASELINE__', { get: () => null, set: () => { }, configurable: true });
      try { if (!localStorage.getItem('t16.seeded')) { localStorage.clear(); for (const k in storage) localStorage.setItem(k, JSON.stringify(storage[k])); localStorage.setItem('t16.seeded', '1'); } } catch (e) { }      /* once per context: a reload keeps what the page stored */
    }, { snap: o.snap === undefined ? SNAP : o.snap, storage: Object.assign({ 'tda.live.settings': { auto: false } }, o.storage || {}) });
    p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push('console.error: ' + m.text().slice(0, 300)); });
    const S = { p, reqs, errors, name: o.name || '',
      async show(payload) { await p.evaluate(pl => showModule('weather', pl || undefined), payload || null); await p.waitForTimeout(o.net ? 700 : 300); },
      read: () => p.evaluate(collect),
      async view(v) { await p.click(`#w14View button[data-v="${v}"]`); await p.waitForTimeout(150); },
      async pick(line) { await p.selectOption('#w14Line', line); await p.waitForTimeout(80); },
      async download(sel) { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click(sel)]); return { name: d.suggestedFilename(), text: readFileSync(await d.path(), 'utf8') }; },
      close: () => context.close() };
    opened.push(S);
    await p.goto(ctx.url, { waitUntil: 'load' });
    if (!o.stay) await S.show(o.payload);
    return S;
  }
  const rec = (r, at) => Object.assign({}, r, { at: at || '2026-11-13T18:15:22.163Z' });

  /* ================= 1. the summer desk is the Build 4 desk (September snapshot, cooling view) ================= */
  /* The reference was read from the Build 4 single file with the same snapshot, clock and no network, in America/Chicago.
     Every difference allowed below is a defect of the touch up list, named beside it. */
  let sep = null;
  for (const tz of ZONES) {
    const s = await open({ tz, clock: B4.clock }), r = await s.read(); if (tz === 'America/Chicago') sep = r;
    t.eq(r.view, 'cool', `summer desk, ${tz}: on September 26 the desk opens in the cooling view`);
    t.eq(r.line, 'repair', `summer desk, ${tz}: the bid plan opens on AC Repair`);
    t.eq(r.kpis.map(k => k.slice(0, 3)), B4.kpis, `summer desk, ${tz}: the seven tiles read as in Build 4`);
    t.eq(r.kpis.map(k => k[3]), ['A', 'A', 'A', 'A', 'A', 'A', 'A'], `summer desk, ${tz}: every tile keeps its A grade`);
    /* D6: a general thunderstorm outlook no longer raises "Hail watch" on day one */
    t.eq(r.days, B4.days.map((d, i) => (i ? d : { text: d.text.replace(' Hail watch', ''), tags: d.tags.filter(x => x !== 'Hail watch') })), `summer desk, ${tz}: the day cards and their tags read as in Build 4 (but for D6)`);
    /* D1: midnight is 12a */
    t.eq(r.narr, B4.narr.map(x => x.replace('11a to 12p', '11a to 12a')), `summer desk, ${tz}: the week in plain words reads as in Build 4 (but for D1)`);
    t.eq(r.alerts, B4.alerts, `summer desk, ${tz}: the alert, its rule and its times read as in Build 4`);
    t.eq(r.obs, B4.obs, `summer desk, ${tz}: the station table reads as in Build 4`); t.eq(r.obsNote, B4.obsNote, `summer desk, ${tz}: the note under the station table too`);
    t.eq(r.spc, B4.spc, `summer desk, ${tz}: the outlook table reads as in Build 4`);
    /* D20: the through date is written out */
    t.eq(r.season, B4.season.map(b => [b[0], b[1], b[2].replace('through 2026-09-22', 'through September 22, 2026')]), `summer desk, ${tz}: the four season boxes read as in Build 4 (but for D20)`);
    /* D5 and the hard freeze clash: the two freeze rows and the last row are relabeled, the numbers stay */
    t.eq(r.clim, B4.clim.map(x => x.replace('Hard freeze (20°F or lower)', '20°F or lower').replace(/^25°F or lower/, 'Hard freeze (25°F or lower)').replace('Average high · low', 'Average warmest day · coldest night')), `summer desk, ${tz}: the climatology rows keep their numbers (labels: D5, hard freeze at 25°F)`);
    t.eq(r.grid.cells, B4.grid.cells, `summer desk, ${tz}: the hourly bid cells read as in Build 4`);
    /* windows: Heating Repair changes by D26 (and the 50°F start), Furnace Replacement reports its coldest hour (D25) */
    const same = Object.keys(B4.windows).filter(k => k !== 'heat' && k !== 'furnace');
    t.eq(same.map(k => r.lines[k].windows), same.map(k => B4.windows[k]), `summer desk, ${tz}: the bid windows of the other 12 lines are the Build 4 windows`);
    t.eq(r.lines.furnace.windows.map(w => w.slice(0, 6)), B4.windows.furnace.map(w => w.slice(0, 6)), `summer desk, ${tz}: Furnace Replacement keeps its windows`);
    /* exports. D25: the reason no longer blames the heat index on every row */
    t.eq(same.map(k => r.lines[k].sched), same.map(k => B4.sched[k].replace(/daypart template times forecast heat index/g, 'daypart template times the weather factor')), `summer desk, ${tz}: the ad schedule files of the other 12 lines are the Build 4 files (but for the D25 reason)`);
    const other = Object.keys(B4.hourly).filter(k => k !== 'heat');
    t.eq(other.map(k => sha(r.lines[k].hourly)), other.map(k => B4.hourly[k]), `summer desk, ${tz}: the hourly plan files of every line but Heating Repair are the Build 4 files, byte for byte`);
    t.eq(sha(r.json), B4.json, `summer desk, ${tz}: the weather file is the Build 4 file`);
    t.ok(!s.reqs.some(q => !/^https:\/\/api\.weather\.gov\//.test(q.url)) && !s.errors.length, `summer desk, ${tz}: no error, and nothing asked of any host but the Weather Service`, { errors: s.errors, reqs: s.reqs.map(q => q.url) });
    if (tz !== 'America/Chicago') { t.eq(r.status, sep.status, `summer desk, ${tz}: the status line reads as it does in a Central browser (D2)`); t.eq([r.win.rows, r.hourAxis, r.spcNote], [sep.win.rows, sep.hourAxis, sep.spcNote], `summer desk, ${tz}: the window days, the chart axis and the outlook times do too (D2)`); await s.close(); }
  }
  const S1 = opened[0];
  /* ---- the defects, on the September snapshot ---- */
  t.ok(sep.narr.some(x => /^Tue 09\/29\..*repair bids \+90% peak, 11a to 12a$/.test(x)) && (await S1.p.evaluate(() => [NWSX.hh(0), NWSX.hh(12), NWSX.hh(23), NWSX.hh(24)])).join() === '12a,12p,11p,12a', 'D1: a window that runs to midnight ends at 12a', sep.narr[5]);
  t.ok(sep.days[0].tags.join() === 'Repair lift' && /^Day 1\. Storm Prediction Center: TSTM risk/.test(sep.narr[1]), 'D6: a general thunderstorm outlook on day one is not a hail watch', sep.days[0]);
  t.ok(sep.clim.some(x => /^Average warmest day · coldest night 100° · 57° 93° · 42°$/.test(x)) && !sep.clim.some(x => /Average high/.test(x)), 'D5: the mean of each month\'s hottest and coldest reading is no longer called the average high and low', sep.clim);
  t.ok(sep.clim.some(x => /^20°F or lower /.test(x)) && sep.clim.some(x => /^Hard freeze \(25°F or lower\) /.test(x)), 'a hard freeze is 25°F or lower on this desk; the 20°F row is labeled by its number', sep.clim);
  t.ok(/^SAT 09\/26 /i.test(sep.grid.head) && sep.win.rows[0].startsWith('Sat 09/26 3p to 9p') && /through September 22, 2026/.test(sep.season[0][2]) && /Day 1 valid Sat 9\/26 3p to Sun 9\/27 7a Central\.$/.test(sep.spcNote) && !/\d{4}-\d\d-\d\d|\d{12}/.test([sep.grid.head, sep.win.rows.join(), sep.season.join(), sep.spcNote].join()), 'D20: no raw date is left in the grid head, the windows, the season box or the outlook note', [sep.grid.head, sep.win.rows[0], sep.season[0][2], sep.spcNote.slice(-60)]);
  t.ok(/the station table shows the spread\.$/.test(sep.judg.split(' Bid steps')[0]) && !/in its options/.test(sep.judg), 'D22: no options page is promised', sep.judg.slice(0, 220));
  t.ok(/Season DFW Airport, 1953 to September 22, 2026/.test(sep.mast) && !/to today/.test(sep.mast) && sep.src.some(x => /DFW Airport daily records 1953 to 2026 \(atlas weather file\) A Sep 2026/.test(x)), 'D28: the season line and the source row state the date the record runs to, read from the data', sep.mast.slice(-120));
  t.ok(sep.meth.some(x => /the day 1 hail, wind and tornado probabilities and the day 2 hail probability/.test(x)), 'D31: the method names the seven outlook products the desk asks for');
  t.ok(sep.meth.some(x => /one reading an hour.*a refresh brings the station on screen and the others are fetched when their button is pressed/.test(x)), 'D3: the method says how the station history is fetched');
  /* D27 and D26: the factor note of every line says what its factor does */
  const notes = {}; for (const l of ['repair', 'heat', 'furnace', 'replace', 'heatpump', 'duct', 'ductless', 'commercial', 'landlord', 'maint', 'iaq', 'hail']) { await S1.pick(l); notes[l] = (await S1.read()).grid.note; }
  t.ok(/Furnace Repl.*temperature below 50 lifts, a cold weather alert adds 15%\.$/.test(notes.furnace) && ['duct', 'ductless', 'commercial', 'landlord'].every(l => /a heat index above 90 lifts modestly\.$/.test(notes[l])) && /hot and cold extremes lift research modestly\.$/.test(notes.replace) && /hot and cold extremes lift research modestly\.$/.test(notes.heatpump), 'D27: Furnace Replacement and the four heat only lines no longer claim hot and cold extremes', [notes.furnace, notes.duct]);
  t.ok(/below a heat index of 65 the line is out of season and trimmed 30%\.$/.test(notes.repair) && /temperature below 50 lifts \(Build 4 began at 45, so the first nights in the 40s now register\), 25 and a cold weather alert add steps; at 70 or warmer the line is out of season and trimmed 40%\.$/.test(notes.heat), 'D26: the factor notes of AC Repair and Heating Repair say what the out of season trim does and where the heat line now starts', [notes.repair, notes.heat]);
  /* D26 and D25 on a hot week: Heating Repair is bid down, never up, and its windows report the coldest hour */
  await S1.pick('heat'); const hot = await S1.read();
  t.ok(B4.windows.heat.every(w => w[4] === 'up') && hot.lines.heat.windows.length > 0 && hot.lines.heat.windows.every(w => w[4] === 'down'), 'D26: Build 4 bid Heating Repair up into a 102°F heat index on template alone; now every window of the hot week is a bid down', hot.lines.heat.windows.slice(0, 2));
  t.ok(/^Day Window Bid Coldest Direction$/i.test(hot.win.head) && hot.lines.heat.sched.split('\n')[1] === 'campaign,date,day,start_hour,end_hour,bid_adjustment_pct,coldest_temp_f,reason' && /^DFW_HEAT_SEARCH,2026-09-27,Sun,00:00,24:00,-30,74,Heating Repair: low demand window$/m.test(hot.lines.heat.sched), 'D25: the heat line\'s windows and its ad schedule file carry the coldest temperature of the window', hot.lines.heat.sched.split('\n').slice(1, 4));
  t.ok(hot.grid.titles[0].includes('temperature 94°') && sep.grid.titles[0].includes('heat index 96°'), 'the bid cells of a cold line show the temperature, those of the other lines the heat index', [hot.grid.titles[0], sep.grid.titles[0]]);
  await S1.pick('repair');
  /* D10: contrast of the bid cells, light and dark, measured in the page */
  const ratio = p => p.evaluate(() => { const c2 = v => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = '#000'; x.fillStyle = v; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3); }, lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }, rt = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); let worst = 99; SLM.LINES.forEach(l => { const sel = document.getElementById('w14Line'); sel.value = l.id; sel.dispatchEvent(new Event('change')); document.querySelectorAll('#w14Grid tbody td').forEach(td => { const bg = lum(c2(getComputedStyle(td).backgroundColor)); worst = Math.min(worst, rt(lum(c2(getComputedStyle(td).color)), bg), rt(lum(c2(getComputedStyle(td.querySelector('.mini')).color)), bg)); }); }); const sel = document.getElementById('w14Line'); sel.value = 'repair'; sel.dispatchEvent(new Event('change')); return +worst.toFixed(2); });
  const light = await ratio(S1.p); await S1.p.evaluate(() => toggleTheme()); const dark = await ratio(S1.p); await S1.p.evaluate(() => toggleTheme());
  t.ok(light >= 4.5 && dark >= 4.5, 'D10: every bid cell and the small figure under it reach 4.5 to 1 against the cell, in light and in dark, for all 14 lines', { light, dark });
  /* D23: the day cards from the keyboard */
  await S1.p.focus('#w14Days .daycard[data-i="3"]'); await S1.p.keyboard.press('Enter');
  let k = await S1.p.evaluate(() => { const c = [...document.querySelectorAll('#w14Days .daycard')], a = document.activeElement; return { tab: c.every(x => x.tabIndex === 0 && x.getAttribute('role') === 'button'), pressed: c.map(x => x.getAttribute('aria-pressed')).join(), sel: c.findIndex(x => x.classList.contains('sel')), focus: c.indexOf(a), head: document.querySelector('#w14Grid thead th').textContent }; });
  t.ok(k.tab && k.sel === 3 && k.focus === 3 && k.pressed === 'false,false,false,true,false,false,false' && /^Tue 09\/29$/i.test(k.head), 'D23: a day card is a button that Enter presses, the bid plan follows and the focus stays on the card', k);
  await S1.p.focus('#w14Days .daycard[data-i="0"]'); await S1.p.keyboard.press(' '); k = await S1.p.evaluate(() => ({ sel: [...document.querySelectorAll('#w14Days .daycard')].findIndex(x => x.classList.contains('sel')), head: document.querySelector('#w14Grid thead th').textContent }));
  t.ok(k.sel === 0 && /^Sat 09\/26$/i.test(k.head), 'D23: Space presses a day card too', k);
  /* D30: an outlook label is text, never markup */
  const odd = await S1.p.evaluate(() => { const d = NWSX.data, keep = d.spc.day3.cat; d.spc.day3.cat = { valid: keep.valid, expire: keep.expire, counties: { 'Dallas<b>': '<img src=x onerror=window.__x=1>', Collin: 'TSTM' } }; BUS.emit('nws'); const cell = document.querySelector('#w14Spc tbody tr:last-child'), r = { html: cell.innerHTML, imgs: cell.querySelectorAll('img, b').length, x: window.__x || 0 }; d.spc.day3.cat = keep; BUS.emit('nws'); return r; });
  t.ok(odd.imgs === 0 && odd.x === 0 && odd.html.includes('&lt;img') && odd.html.includes('Dallas&lt;b&gt;'), 'D30: a label or a county name from the outlook file reaches the page escaped', odd.html.slice(0, 200));
  /* D9: an outlook that did not arrive is "not available", not "none" */
  const lost = await S1.p.evaluate(() => { const d = NWSX.data, keep = d.spc, out = {}; const read = () => ({ tile: [...document.querySelectorAll('#w14Kpis .kpi')].map(x => x.innerText.replace(/\s+/g, ' ')).find(x => /SEVERE OUTLOOK/i.test(x)), card: document.getElementById('w14Spc').innerText.replace(/\s+/g, ' ').slice(0, 90), now: NWSX.spcNow() }); d.spc = { day1: { cat: null, hail: null, wind: null, torn: null }, day2: { cat: null, hail: null }, day3: { cat: null } }; BUS.emit('nws'); out.all = read(); d.spc = { day1: { cat: null, hail: keep.day1.hail, wind: keep.day1.wind, torn: keep.day1.torn }, day2: keep.day2, day3: keep.day3 }; BUS.emit('nws'); out.one = read(); d.spc = keep; BUS.emit('nws'); out.back = read().tile; return out; });
  t.ok(lost.all.now === null && /— outlook not available/.test(lost.all.tile) && /No outlook held/.test(lost.all.card), 'D9: when no outlook product arrived (as a Build 4 cache stored it) the tile reads "outlook not available" and the card "No outlook held"', lost.all);
  t.ok(/— outlook not available/.test(lost.one.tile) && /Day 1 categorical — not available/.test(lost.one.card) && /TSTM/.test(lost.back), 'D9: one missing product is "not available" in its row and on the tile, the others still show', lost.one);
  /* D34: the first tile is named after the station it shows */
  const noHq = await open({ clock: B4.clock, snap: Object.assign({}, SNAP, { obs: { stations: SNAP.obs.stations.filter(x => x.id !== 'KHQZ'), history: SNAP.obs.history } }) });
  t.ok(/^DFW International Airport now$/i.test((await noHq.read()).kpis[0][0]) && /^Mesquite Metro now$/i.test(sep.kpis[0][0]), 'D34: when Mesquite Metro did not report, the tile carries the name of the station it falls back to', (await noHq.read()).kpis[0]);
  await noHq.close();

  /* ================= 2. the same snapshot seven weeks later: nothing stale is called "now" (D29), and the heating view opens ================= */
  const old = await open({ clock: NOV }), o1 = await old.read();
  t.ok(/^BUILD SNAPSHOT: FETCHED SAT 9\/26 3P \(48 DAYS AGO\)/i.test(o1.status) && /Every figure below is the forecast as it stood then, not the weather now\./.test(o1.status), 'D29: a 48 day old snapshot states its age in days and says the figures are not the weather now', o1.status.slice(0, 200));
  t.eq([o1.view, o1.line], ['heat', 'heat'], 'on November 13 the desk opens in the heating view with the bid plan on Heating Repair');
  t.ok(/^Mesquite Metro, Sat 9\/26$/i.test(o1.kpis[0][0]) && /^Night of Sat 09\/26$/i.test(o1.kpis[1][0]) && /^Coldest low, seven nights from Sat 9\/26$/i.test(o1.kpis[2][0]) && /^Cold nights, seven nights from Sat 9\/26$/i.test(o1.kpis[3][0]) && /^Heating degree days, seven days from Sat 9\/26$/i.test(o1.kpis[4][0]) && !o1.kpis.some(x => /\bnow$|tonight|tomorrow|next seven/i.test(x[0] + ' ' + x[2])), 'D29: in the heating view every tile built on the stale forecast carries its date; none says now, tonight, tomorrow or next', o1.kpis.map(x => x[0]));
  t.ok(/^Coldest in these reports: /.test(o1.obsNote), 'D29: the note under the stations does not say "right now" either', o1.obsNote.slice(0, 80));
  await old.view('cool'); const o2 = await old.read();
  t.ok(/^Mesquite Metro, Sat 9\/26$/i.test(o2.kpis[0][0]) && /^Sat 09\/26$/i.test(o2.kpis[1][0]) && o2.kpis[1][1] === '96° / 72°', 'D29: in the cooling view the first two tiles carry the date of the data instead of "now" and "Today"', o2.kpis.slice(0, 2));
  await old.close();

  /* ================= 3. the freeze week (simulated: the live week made 24°F colder, with twelve synthetic alerts) ================= */
  /* Friday November 13, 1 pm in Dallas. The grid's nights ahead: Fri 20, Sat 22, Sun 20, Mon 22, Tue 25, Wed 32, Thu 34°F; the
     highs that follow them: Sat 41, Sun 24, Mon 29, Tue 38, Wed 42, Thu 46, Fri 49°F.
     Coldest low: 20°F, first on Friday night (tonight). Nights at or under 40: all 7; at or under 32: 6; at or under 25: 5.
     Heating degree days, 65 minus the mean of high and low rounded half up: Sat (41+20)/2=30.5→31→34; Sun 23→42; Mon 24.5→25→40;
     Tue 30→35; Wed 33.5→34→31; Thu 39→26; Fri 41.5→42→23; in all 231. Normal for November 14 to 20 from the 1991 to 2020 monthly
     normals (October 69.2, November 285.2, December 528.3) read day by day: 9.1+9.4+9.6+9.9+10.1+10.4+10.6=69.1→69; 231/69=335%.
     Mesquite Metro reports 40.4°F with a 6.9 mph wind: wind chill 35.74+0.6215×40.4−35.75×6.9^0.16+0.4275×40.4×6.9^0.16=35.7→36°F.
     The lowest apparent temperature of the grid on Friday night is 15°F. */
  const TILES = [
    ['Mesquite Metro now', '40°', 'wind chill 36° · Clear · Fri 11/13 10a', 'A'],
    ['Tonight and tomorrow', '20° / 41°', 'low tonight, high tomorrow · feels like 15° at the coldest', 'A'],
    ['Coldest low, next seven nights', '20°', 'tonight at the Mesquite grid · Mesquite only: Live Data holds no fresh forecast for the other counties', 'A'],
    ['Cold nights ahead', '7', 'at 40°F or lower at the Mesquite grid, of the next 7 · 6 at 32°F or lower · 5 at 25°F or lower (hard freeze)', 'A'],
    ['Heating degree days, next seven days', '231', 'normal for these dates 69 (335% of normal) · Mesquite grid', 'A/B'],
    ['Active alerts', '12', 'Extreme Cold Warning and 11 more', 'A'],
    ['Heating degree days in 2026', '897', 'January 1 through Sep 22 at DFW Airport, normal 1,299 · the season since July 1 needs the climate record in Live Data · first forecast freeze at Mesquite tonight', 'A'],
  ];
  const up = k => k.map(x => [x[0].toUpperCase(), x[1], x[2], x[3]]);
  let fz = null, FZ = null;
  for (const tz of ZONES) {
    const s = await open({ tz, clock: NOV, storage: { 'tda.nws.v2': FREEZE } }), r = await s.read(); if (tz === 'America/Chicago') { fz = r; FZ = s; }
    t.eq([r.view, r.line], ['heat', 'heat'], `freeze week, ${tz}: the heating view, Heating Repair selected`);
    t.eq(up(r.kpis), up(TILES), `freeze week, ${tz}: the seven tiles match the figures worked out by hand (no live record: each says it is Mesquite only)`);
    t.eq(r.days.map(d => d.tags), [['Freeze', 'Heating surge'], ['Hard freeze', 'Heating surge'], ['Hard freeze', 'Heating surge', 'Rain: reschedule attic work'], ['Hard freeze', 'Heating surge'], ['Hard freeze', 'Heating surge'], ['Hard freeze', 'Heating surge'], ['Freeze', 'Heating surge']], `freeze week, ${tz}: lows of 26, 20, 22, 20, 22, 25 and 32 tag the days Freeze (32 or lower) or Hard freeze (25 or lower) beside Heating surge`);
    t.ok(/^Fri 11\/13 44° 26° Sunny 4h ≤32 /.test(r.days[0].text) && /^Sat 11\/14 41° 20° feels 15° at the coldest Mostly Cloudy ☂ 26% ⚡ 11% · 16h ≤32 /.test(r.days[1].text) && /^Thu 11\/19 46° 32° .* · 14h ≤40 /.test(r.days[6].text), `freeze week, ${tz}: a day card shows the lowest apparent temperature and its hours at 32°F or lower (at 40°F when none)`, r.days.map(d => d.text.slice(0, 70)));
    if (tz !== 'America/Chicago') { t.eq([r.status, r.narr, r.win.rows, r.hourAxis, r.alerts.map(a => a.when), r.lines.heat.sched, sha(r.lines.heat.hourly)], [fz.status, fz.narr, fz.win.rows, fz.hourAxis, fz.alerts.map(a => a.when), fz.lines.heat.sched, sha(fz.lines.heat.hourly)], `freeze week, ${tz}: status, plain words, windows, chart axis, alert times and both plan files are the ones a Central browser shows (D2)`); t.ok(!s.errors.length, `freeze week, ${tz}: no error`, s.errors); await s.close(); }
  }
  /* 72 hours of the hourly forecast: 7 are above 40°F (41, 43, 44, 44, 44, 41 on Friday afternoon, 41 on Saturday) and 17 above 32°F */
  t.ok(/^Temperature Apparent temperature 65 of the next 72 hours are at 40°F or lower, 55 of them at 32°F or lower; shaded columns are 9 pm to 6 am\./.test(fz.hourNote), 'freeze week: the chart note counts 65 hours at 40°F or lower and 55 at 32°F or lower', fz.hourNote.slice(0, 140));
  t.eq(fz.hourLines, ['40', '32', '25'], 'freeze week: the hourly chart draws its reference lines at 40, 32 and 25°F');
  t.ok(fz.cards.some(x => /^Hourly temperature, next 72 hours Temperature and apparent temperature by hour with the 40, 32 and 25 lines that move heating repair demand\.$/.test(x)) && fz.hourAxis.includes('Fri 11a') && fz.hourAxis.includes('Mon 11a'), 'freeze week: the chart card is titled for the heating view and its axis starts at Friday 11 am Central', fz.hourAxis);
  /* plain words: the heating read leads. Saturday: low 20 (grid), the hourly forecast bottoms at 20 with an apparent temperature of 15; 16 hours at 32 or lower and 23 at 40 or lower */
  t.eq(fz.narr.slice(12), [
    'Fri 11/13. low 26°, high 44°; 7 hours at 40°F or lower; heating repair bid up 80% 11a to 12a',
    'Sat 11/14. low 20°, feels like 15° at the coldest, high 41°; 23 hours at 40°F or lower; heating repair bid up 90% all day',
    'Sun 11/15. low 22°, feels like 16° at the coldest, high 24°; 24 hours at 40°F or lower; heating repair bid up 90% all day; rain 100%: maintenance and duct visits slip',
    'Mon 11/16. low 20°, feels like 17° at the coldest, high 29°; 24 hours at 40°F or lower; heating repair bid up 90% all day',
    'Tue 11/17. low 22°, high 38°; 24 hours at 40°F or lower; heating repair bid up 85% all day',
    'Wed 11/18. low 25°, high 42°; 21 hours at 40°F or lower; heating repair bid up 75% all day',
    'Thu 11/19. low 32°, high 46°; 14 hours at 40°F or lower; heating repair bid up 65% 12a to 11p'], 'freeze week: each day in plain words leads with the low, the hours at 40°F or lower and what the heating repair plan does');
  t.ok(!fz.narr.some(x => /repair bids \+/.test(x)) && fz.narr.length === 19, 'freeze week: no day opens with the cooling repair line any more; the twelve alerts stay on top', fz.narr.length);
  /* the weather factor of the heat line: 1 + 0.6 × (50 − T) / 25, + 0.3 at 25°F or lower, + 0.25 under a cold alert. Friday 11 am, 37°F: 1 + 0.312 + 0.25 = 1.562;
     template 9a to 12p on a weekday 1.10; 1.10 × 1.562 = 1.718 → +70%. Friday 8 pm, 32°F: 1 + 0.432 + 0.25 = 1.682 × 1.25 = 2.10 → capped at +90% */
  const wf = await FZ.p.evaluate(() => { const p = NWSX.plan('heat'), a = p.days[0].rows[0], b = p.days[0].rows.find(x => x.hr === 20); return { a: [a.hr, a.tempF, +a.base.toFixed(2), +a.w.toFixed(3), a.adj], b: [b.hr, b.tempF, +b.base.toFixed(2), +b.w.toFixed(3), b.adj], cold: p.ctx.coldAlert, th: NWSX.TH() }; });
  t.eq(wf, { a: [11, 37, 1.1, 1.562, 70], b: [20, 32, 1.25, 1.682, 90], cold: true, th: { cool: 50, cold: 40, freeze: 32, hard: 25 } }, 'freeze week: the heat line lifts from 50°F down (37°F: ×1.562 with the alert), capped at +90% as before');
  t.ok(fz.grid.cells[0] === '+70% 37°' && /^11:00 · temperature 37° · template ×1\.10 · weather ×1\.56$/.test(fz.grid.titles[0]) && /^Day Window Bid Coldest Direction$/i.test(fz.win.head) && fz.win.rows[1] === 'Sat 11/14 12a to 12a +90% 20° bid up', 'freeze week: the bid cells of the heat line show the temperature and each window its coldest hour (D25: Build 4 said "peak feels like 41°" for a 20°F night)', [fz.grid.cells[0], fz.grid.titles[0], fz.win.rows[1]]);
  /* D26: AC Repair on a day that never passes 44°F is trimmed, not bid up */
  t.ok(fz.lines.repair.windows.length > 0 && fz.lines.repair.windows.every(w => w[4] === 'down') && Math.max(...fz.lines.repair.hourly.split('\n').slice(2).filter(Boolean).map(l => +l.split(',')[7])) === 0.7, 'D26: in the freeze week every AC Repair hour carries the ×0.7 trim and no window bids it up', fz.lines.repair.windows.slice(0, 2));
  /* D7 and D8: the twelve synthetic alerts */
  const rule = Object.fromEntries(fz.alerts.map(a => [a.event, a.tags.join(' ')]));
  t.eq(fz.alerts.length, 12, 'D8: all twelve held alerts are shown, the Freeze Warning whose message lapsed two hours ago but whose hazard runs ten more hours among them');
  t.eq([rule['Freeze Watch'], rule['Frost Advisory'], rule['Winter Weather Advisory'], rule['Freeze Warning'], rule['Cold Weather Advisory'], rule['Extreme Cold Warning'], rule['Winter Storm Warning'], rule['Ice Storm Warning'], rule['Special Weather Statement']], ['watch Heating Repair', 'watch Heating Repair', 'surge Heating Repair', 'surge Heating Repair', 'surge Heating Repair', 'surge Heating Repair', 'surge Heating Repair', 'surge Heating Repair', 'watch'], 'D7: a freeze watch and a frost advisory open the heating campaigns, a winter weather advisory is a heating surge, a statement with no rule stays a watch');
  t.ok(fz.alerts.find(a => a.event === 'Freeze Watch').act.includes('First cold nights: open the heating repair campaigns with no heat and safety check copy') && !fz.alerts.filter(a => /Freeze|Frost|Winter|Cold|Ice/.test(a.event)).some(a => /no standing rule/.test(a.act)), 'D7: none of the winter products is left with "no standing rule"', fz.alerts.find(a => a.event === 'Freeze Watch').act);
  const pd = await FZ.p.evaluate(() => { const d = NWSX.data, keep = d.alerts; d.alerts = [{ id: 'x', event: 'Practice/Demo Warning', severity: 'Minor', counties: ['Dallas'], expires: '2026-11-14T06:00:00Z', description: '' }]; const demo = NWSX.plan('heat').ctx.coldAlert; d.alerts = [{ id: 'y', event: 'Frost Advisory', severity: 'Minor', counties: ['Dallas'], expires: '2026-11-14T06:00:00Z', description: '' }]; const frost = NWSX.plan('heat').ctx.coldAlert; d.alerts = keep; return { demo, frost }; });
  t.eq(pd, { demo: false, frost: true }, 'D7: a frost advisory counts as a cold alert in the bid plan; "Practice/Demo Warning" no longer does');
  t.ok(DASH.test('tune-up') && !DASH.test('minus 40% and -35% and 2026-11-13') && fz.alerts.every(a => !DASH.test(a.act)), 'the standing rules carry no hyphen or dash between words', fz.alerts.map(a => a.act).find(x => DASH.test(x)));
  /* the station table and the last three days in the heating view */
  t.ok(/^KDTO Denton Enterprise 37° 30° 45% 9 mph Clear /.test(fz.obs.find(x => /^KDTO/.test(x))) && /^Coldest right now: Denton Enterprise at 37°, wind chill 30°\. Feels is the wind chill where there is one/.test(fz.obsNote), 'freeze week: the station table\'s Feels column is the wind chill (Denton 36.8°F at 9.2 mph → 30°F) and the note names the coldest station', [fz.obs.find(x => /^KDTO/.test(x)), fz.obsNote.slice(0, 70)]);
  t.ok(fz.histSvg && fz.cards.some(x => /^The last three days Observed temperature, and the wind chill where the station reported one/.test(x)), 'freeze week: the last three days card is retitled and still draws the station held');
  /* the season card with no live record: the calendar year figure, labeled; nothing invented */
  t.eq(fz.season.map(b => [b[0].toUpperCase(), b[1]]), [['HEATING DEGREE DAYS IN 2026 A', '897'], ['FREEZE NIGHTS SO FAR', '—'], ['FIRST FORECAST FREEZE A', 'Fri 11/13'], ['COLDEST NIGHT AHEAD A', '20°']], 'freeze week, no live record: the season card shows the calendar year total, an unknown freeze count, the first forecast freeze and the coldest night ahead');
  t.ok(/the calendar year at DFW Airport, January 1 through September 22, 2026 · normal to that date 1,299 \(69% of normal\) · the season since July 1 needs the climate record in Live Data/.test(fz.season[0][2]) && /not known here: the weather file in this build ends September 22, 2026/.test(fz.season[1][2]) && /20°F at the Mesquite grid that night · whether a freeze has already come this season is not known without the climate record in Live Data/.test(fz.season[2][2]), 'freeze week, no live record: each season box says what it is and what it cannot know (897 of 1,299 is 69%)', fz.season.map(b => b[2].slice(0, 60)));
  t.eq(fz.clim, ['Hard freeze (25°F or lower) 10% 57%', '20°F or lower 0% 30%', 'Average warmest day · coldest night 84° · 31° 79° · 24°'], 'freeze week: the heating view keeps the freeze odds rows for November and December');
  /* ---- the same week with the live layer's forecast record only, then with every record ---- */
  const COLD16 = colder(rec(COLD_REC), 24), minOf = r => { let best = null; r.data.points.forEach(p => p.nights.forEach(n => { if (n.d >= '2026-11-13' && (!best || n.lowF < best.f)) best = { f: n.lowF, at: p.name, d: n.d }; })); return best; }, m40 = minOf(rec(COLD_REC)), m16 = minOf(COLD16);
  t.eq([m40, m16], [{ f: 40, at: 'Denton', d: '2026-11-15' }, { f: 16, at: 'Denton', d: '2026-11-15' }], 'the cold forecast fixture bottoms at 40°F on Sunday night at Denton; made 24°F colder, at 16°F');
  const fo = await open({ clock: NOV, storage: { 'tda.nws.v2': FREEZE, 'tda.live.src.nws_cold': COLD16 } }), f1 = await fo.read();
  t.ok(f1.kpis[2][2] === 'tonight at the Mesquite grid · across the 12 counties 16°F Sunday night at Denton' && / · anywhere in the 12 counties: 7 at 40°F or lower, 7 at 32°F or lower$/.test(f1.kpis[3][2]) && / · Mesquite grid · 12 county mean \d+$/.test(f1.kpis[4][2]), 'freeze week, forecast record only: the tiles add the coldest low across the 12 counties and where, the nights that reach each mark somewhere, and the 12 county heating degree days', f1.kpis.slice(2, 5).map(x => x[2]));
  t.ok(f1.kpis[6][0].toUpperCase() === 'HEATING DEGREE DAYS IN 2026' && /^FIRST FORECAST FREEZE/i.test(f1.season[2][0]), 'freeze week, forecast record only: the season tile and the season card still show the calendar year figure and say why', f1.kpis[6]);
  t.eq(up(f1.kpis.slice(0, 2)).concat(up(f1.kpis.slice(5, 6))), up(TILES.slice(0, 2)).concat(up(TILES.slice(5, 6))), 'freeze week, forecast record only: the Mesquite tiles are unchanged');
  await fo.close();
  const fa = await open({ clock: NOV, storage: { 'tda.nws.v2': FREEZE, 'tda.live.src.nws_cold': COLD16, 'tda.live.src.acis_season': SEASON_REC } }), f2 = await fa.read();
  /* the season record: DFW Airport through November 12, 29 heating degree days against a normal of 157 (18%), no freeze yet, median first freeze November 24, coldest 47°F on October 17 */
  t.eq(up(f2.kpis.slice(6)), [['HEATING DEGREE DAYS SINCE JULY 1', '29', 'normal to date 157 (18%) · DFW Airport through Nov 12 · no freeze yet, the first one in the forecast is tonight', 'A']], 'freeze week, every record: the season tile reads the climate record (29 against a normal of 157) and the first freeze the forecast brings');
  t.eq(f2.season.map(b => [b[0].toUpperCase(), b[1]]), [['HEATING DEGREE DAYS SINCE JULY 1 A', '29'], ['FREEZE NIGHTS SO FAR A', '0'], ['FIRST FREEZE B', 'Not yet'], ['COLDEST SO FAR A', '47°']], 'freeze week, every record: the season card shows the season to date, the freeze nights, the first freeze status and the coldest reading so far');
  t.ok(f2.season[0][2] === 'DFW Airport through November 12, 2026 · normal to date 157 (18%)' && f2.season[1][2] === '32°F or lower at DFW Airport since July 1 · normal to date 0.7 · 0 at 25°F or lower' && /^none at DFW Airport through Nov 12 · median date Nov 24 · by now it has come in 25% of years · first one in the forecast: tonight, \d+°F at [A-Z][A-Za-z ]+$/.test(f2.season[2][2]) && /^at DFW Airport on Oct 17 · coldest night ahead at the Mesquite grid: 20°, Fri night 11\/13$/.test(f2.season[3][2]), 'freeze week, every record: each season box states its station, its through date and its normal', f2.season.map(b => b[2]));
  t.ok(/^Heating season to date: 29 heating degree days at DFW Airport against a normal of 157 \(18%\), second lowest to this date among 31 falls; no freeze yet, the median first freeze is November 24\. The heating campaigns open on the first forecast freeze/.test(f2.seasonNote) && /The season figures are the weekly climate record in Live Data \(module 18\)\.$/.test(f2.seasonNote), 'freeze week, every record: the note under the season card is the climate layer\'s own sentence', f2.seasonNote.slice(0, 200));
  await fa.close();

  /* ================= 4. the live week of November 13 (the Weather Service's own answer that day) ================= */
  /* nights ahead 44, 46, 44, 46, 49, 56, 58°F; the highs that follow 65, 48, 53, 62, 66, 70, 73°F. Heating degree days: (65+44)/2=54.5→55→10;
     47→18; 48.5→49→16; 54→11; 57.5→58→7; 63→2; 65.5→66→0; in all 64, against the normal 69: 93%. */
  const lw = await open({ clock: NOV, storage: { 'tda.nws.v2': LIVE_WEEK, 'tda.live.src.nws_cold': rec(COLD_REC), 'tda.live.src.acis_season': SEASON_REC } }), l1 = await lw.read();
  t.eq(up(l1.kpis), up([
    ['Mesquite Metro now', '64°', 'Clear · Fri 11/13 10a', 'A'],
    ['Tonight and tomorrow', '44° / 65°', 'low tonight, high tomorrow · feels like 39° at the coldest', 'A'],
    ['Coldest low, next seven nights', '44°', 'tonight at the Mesquite grid · across the 12 counties 40°F Sunday night at Denton', 'A'],
    ['Cold nights ahead', '0', 'at 40°F or lower at the Mesquite grid, of the next 7 · 0 at 32°F or lower · anywhere in the 12 counties: 1 at 40°F or lower, 0 at 32°F or lower', 'A'],
    ['Heating degree days, next seven days', '64', 'normal for these dates 69 (93% of normal) · Mesquite grid · 12 county mean 66', 'A/B'],
    ['Active alerts', '0', 'none touching the twelve counties', 'A'],
    ['Heating degree days since July 1', '29', 'normal to date 157 (18%) · DFW Airport through Nov 12 · no freeze yet', 'A'],
  ]), 'live week, every record: the seven heating tiles (a mild week: no night at 40°F at Mesquite, one at Denton)');
  t.eq(l1.days.map(d => d.tags), [['Tune up window'], ['Tune up window'], ['Rain: reschedule attic work'], [], ['Tune up window'], ['Tune up window'], ['Tune up window']], 'live week: no cold tag in a week whose lows stay at 44°F or higher; the existing tags stay');
  t.eq(l1.hourLines, ['40', '32'], 'live week: the chart reaches down to 30°F so the 40 and 32 lines show; the 25 line is off the scale');
  t.ok(/^Temperature Apparent temperature 0 of the next 72 hours are at 40°F or lower; /.test(l1.hourNote), 'live week: the chart note counts no hour at 40°F or lower', l1.hourNote.slice(0, 90));
  /* the heat line now registers the first nights in the 40s: Saturday 5 am, 44°F: 1 + 0.6 × 6 / 25 = 1.144 on a template of 1.00 → +15%; Build 4 gave 1 + 0.6 × 1 / 20 = 1.03 → +5% */
  const sat5 = await lw.p.evaluate(() => { const r = NWSX.plan('heat').days[1].rows.find(x => x.hr === 5); return [r.tempF, +r.base.toFixed(2), +r.w.toFixed(3), r.adj]; });
  t.eq(sat5, [44, 1, 1.144, 15], 'live week: at 44°F the heat line\'s weather factor is 1.144 (Build 4: 1.03), enough to open Saturday\'s window at 5 am');
  t.ok(l1.narr[1] === 'Sat 11/14. low 44°, feels like 39° at the coldest, high 65°; no hour at 40°F or lower; heating repair bid up 20% 5a to 9p' && l1.win.rows[1] === 'Sat 11/14 5a to 9p +20% 44° bid up', 'live week: Saturday in plain words and in the windows table', [l1.narr[1], l1.win.rows[1]]);
  t.ok(JSON.stringify(l1.lines.heat.windows) !== JSON.stringify(l1.lines.repair.windows) && l1.lines.repair.windows.some(w => w[4] === 'down'), 'live week: Heating Repair and AC Repair no longer get the same plan (Build 4 gave both the template)', { heat: l1.lines.heat.windows.slice(0, 2), repair: l1.lines.repair.windows.slice(0, 2) });
  t.ok(/^FIRST FREEZE B$/i.test(l1.season[2][0]) && /none at DFW Airport through Nov 12 · median date Nov 24 · by now it has come in 25% of years · none in the forecast for the 12 counties$/.test(l1.season[2][2]), 'live week: no freeze yet and none in the forecast for the 12 counties', l1.season[2]);
  /* ---- the switch: both views, the line follows it until a line is chosen, and the choice is remembered ---- */
  await lw.view('cool'); const l2 = await lw.read();
  t.eq([l2.view, l2.line, l2.kpis.map(x => x[0].toUpperCase())], ['cool', 'repair', ['MESQUITE METRO NOW', 'TODAY', 'HOURS AT 95°F+ HEAT INDEX', 'DAYS AT 100°F, FORECAST', 'ACTIVE ALERTS', 'SEVERE OUTLOOK, DAY 1', '100°F DAYS IN 2026']], 'the switch: Cooling view brings back the seven cooling tiles and AC Repair');
  t.ok(l2.kpis[1][1] === '68° / 50°' && l2.cards.some(x => /^Hourly heat index, next 72 hours Temperature and heat index by hour with the 95, 100 and 105 lines/.test(x)), 'the switch: the cooling view shows today\'s high and low and the heat index chart', [l2.kpis[1], l2.narr[0]]);
  t.ok(l2.narr.every(x => !/heating repair bid/.test(x)) && l2.clim.length === 6 && l2.season[0][0].toUpperCase() === '100°F DAYS SO FAR', 'the switch: plain words, climatology and season card are the cooling ones', l2.narr.slice(0, 2));
  await lw.p.reload({ waitUntil: 'load' }); await lw.show(); const l3 = await lw.read();
  t.eq([l3.view, l3.line, await lw.p.evaluate(() => JSON.parse(localStorage.getItem('tda.wx.view')))], ['cool', 'repair', { view: 'cool', season: 'heat2026' }], 'the switch: the choice is remembered across a reload, with the season it was made in');
  await lw.view('heat'); await lw.pick('furnace'); await lw.view('cool'); const l4 = await lw.read(); await lw.view('heat'); const l5 = await lw.read();
  t.eq([l4.view, l4.line, l5.view, l5.line], ['cool', 'furnace', 'heat', 'furnace'], 'the switch: once a line has been chosen by hand the views leave it alone');
  t.ok(/Furnace Repl/.test(l5.grid.note) && (l5.win.head ? /^Day Window Bid Coldest Direction$/i.test(l5.win.head) : /No hour in the next seven days/.test(l5.win.none)), 'the furnace line reports its coldest hour too (D25)', [l5.grid.note.slice(0, 80), l5.win.head, l5.win.none]);
  /* another module sends a line: the Heat Desk calls goModule('weather', { line: 'heat' }) */
  await lw.p.evaluate(() => showModule('index')); await lw.p.evaluate(() => goModule('weather', { line: 'heat' })); await lw.p.waitForTimeout(200); const l6 = await lw.read();
  t.eq([l6.line, await lw.p.evaluate(() => !document.getElementById('mod-weather').hidden), /^Heating Repair/.test(l6.grid.cells.length ? await lw.p.evaluate(() => document.querySelector('#w14Grid tbody th').textContent) : '')], ['heat', true, true], 'receive: a line sent by another module is selected and its plan drawn');
  await lw.p.evaluate(() => goModule('weather', { line: 'no such line' })); t.eq((await lw.read()).line, 'heat', 'receive: an unknown line is ignored');
  /* a first visit that arrives with a line (the desk is mounted by the call itself), in the cooling season */
  const sum = await open({ clock: '2027-07-15T18:00:00Z', stay: true }); await sum.p.evaluate(() => goModule('weather', { line: 'heat' })); await sum.p.waitForTimeout(300); const su = await sum.read();
  t.eq([su.view, su.line], ['cool', 'heat'], 'receive: in July the desk opens in the cooling view and still selects the line it was sent'); await sum.close();
  /* the season key: a choice made in the heating season does not outlive it */
  const apr = await open({ clock: '2027-04-02T18:00:00Z', storage: { 'tda.wx.view': { view: 'heat', season: 'heat2026' } } }), mar = await open({ clock: '2027-03-31T18:00:00Z', storage: { 'tda.wx.view': { view: 'cool', season: 'heat2026' } } }), oct = await open({ clock: '2026-10-01T04:30:00Z' }), octLate = await open({ clock: '2026-10-01T05:30:00Z', tz: 'UTC' });
  t.eq([(await apr.read()).view, (await mar.read()).view, (await oct.read()).view, (await octLate.read()).view], ['cool', 'cool', 'cool', 'heat'], 'the season: April opens in the cooling view whatever was chosen in winter; a March choice still holds; the season turns at midnight in Dallas (September 30, 11:30 pm is cooling, October 1, 12:30 am is heating, in a UTC browser too)');
  await apr.close(); await mar.close(); await oct.close(); await octLate.close();

  /* ================= 5. every export, as files, in both views ================= */
  await lw.view('heat'); await lw.pick('heat');
  const e1 = await lw.download('#w14Sched'), e2 = await lw.download('#w14Hourly'), e3 = await lw.download('#w14Snap');
  t.ok(e1.name === 'ad-schedule_heat_2026-11-13.csv' && e1.text === l1.lines.heat.sched && e1.text.split('\n')[1] === 'campaign,date,day,start_hour,end_hour,bid_adjustment_pct,coldest_temp_f,reason' && e1.text.includes('DFW_HEAT_SEARCH,2026-11-14,Sat,05:00,21:00,20,44,Heating Repair: daypart template times the weather factor'), 'export: the ad schedule file of the heat line (coldest temperature, the weather factor as the reason)', [e1.name, e1.text.split('\n').slice(0, 4)]);
  t.ok(e2.name === 'hourly-bid-plan_heat.csv' && e2.text === l1.lines.heat.hourly && e2.text.split('\n')[1] === 'date,day,hour,temp_f,heat_index_f,precip_pct,template_multiplier,weather_multiplier,combined,bid_adjustment_pct' && e2.text.includes('\n2026-11-14,Sat,5,44,44,0,1,1.14,1.14,15\n') && e2.text.trim().split('\n').length === 2 + 156, 'export: the hourly plan file of the heat line, 156 hours', [e2.name, e2.text.split('\n').slice(0, 3)]);
  t.ok(e3.name === 'nws-dfw-weather.json' && JSON.stringify(JSON.parse(e3.text)) === JSON.stringify(LIVE_WEEK.data), 'export: the weather file is the data held, in the snapshot shape', e3.name);
  await lw.view('cool'); await lw.pick('repair'); const e4 = await lw.download('#w14Sched'), e5 = await lw.download('#w14Hourly');
  t.ok(e4.name === 'ad-schedule_repair_2026-11-13.csv' && e4.text.split('\n')[1] === 'campaign,date,day,start_hour,end_hour,bid_adjustment_pct,peak_heat_index_f,reason' && e5.name === 'hourly-bid-plan_repair.csv' && e5.text === l1.lines.repair.hourly, 'export: the same two files for AC Repair from the cooling view (peak heat index)', [e4.name, e4.text.split('\n').slice(0, 4)]);
  t.ok([e1, e2, e4, e5].every(f => f.text.split('\n').filter(l => l.startsWith('#')).every(l => !DASH.test(l.replace(/\d{4}-\d\d-\d\dT[\d:.+Z-]*/g, '')))), 'export: no hyphen or dash between words in any note line', e1.text.split('\n')[0]);
  for (const s of [lw]) t.ok(!s.errors.length, 'live week: no error', s.errors);
  await lw.close();

  /* ================= 6. the year turn ================= */
  /* the freeze week moved nine weeks on (Friday January 15, 2027, 1 pm in Dallas): same lows, same weekdays, a live cache of that day */
  const JAN = shiftDays(FREEZE, 63), jn = await open({ clock: '2027-01-15T19:00:00Z', storage: { 'tda.nws.v2': JAN, 'tda.live.src.nws_cold': rec(COLD_REC), 'tda.live.src.acis_season': SEASON_REC } }), j1 = await jn.read();
  t.eq([j1.view, j1.line, j1.status.slice(0, 40).toUpperCase()], ['heat', 'heat', 'LIVE: FETCHED FRI 1/15 12P (0.7 H AGO) A'], 'January 2027: the heating view, a live cache of the day');
  /* normal for January 16 to 22: January 582.0 over 31 days is 18.77 a day at mid month (the 16th), easing 0.14 a day toward February's 14.63:
     18.8+18.6+18.5+18.4+18.2+18.1+17.9=128.5, which the live layer's sum rounds up to 129; 231/129=179% */
  t.eq(up(j1.kpis.slice(1, 5)), up([
    ['Tonight and tomorrow', '20° / 41°', 'low tonight, high tomorrow · feels like 15° at the coldest', 'A'],
    ['Coldest low, next seven nights', '20°', 'tonight at the Mesquite grid · Mesquite only: Live Data holds no fresh forecast for the other counties', 'A'],
    ['Cold nights ahead', '7', 'at 40°F or lower at the Mesquite grid, of the next 7 · 6 at 32°F or lower · 5 at 25°F or lower (hard freeze)', 'A'],
    ['Heating degree days, next seven days', '231', 'normal for these dates 129 (179% of normal) · Mesquite grid', 'A/B'],
  ]), 'January 2027: the same nights against the January normal (129); a forecast record two months old is not shown as the 12 county picture');
  t.ok(j1.kpis[6][0].toUpperCase() === 'HEATING DEGREE DAYS SINCE JULY 1' && /^normal to date 157 \(18%\) · DFW Airport through Nov 12 · no freeze yet$/.test(j1.kpis[6][2]), 'January 2027: the season record still belongs to the season that began in July 2026 and states its through date', j1.kpis[6]);
  t.ok(j1.climHead.toUpperCase() === 'CLIMATOLOGY FOR JAN AND FEB (1996 TO 2025)' && j1.days[0].text.startsWith('Fri 01/15 44° 26°') && j1.win.rows[1] === 'Sat 01/16 12a to 12a +90% 20° bid up' && /Observed through November 12; a refresh is due\./.test(j1.seasonNote), 'January 2027: the climatology months, the day cards and the windows follow the calendar; the season sentence says its record is overdue', [j1.climHead, j1.days[0].text.slice(0, 20), j1.seasonNote.slice(0, 230)]);
  const jf = await jn.download('#w14Sched'); t.ok(jf.name === 'ad-schedule_heat_2027-01-15.csv' && /^DFW_HEAT_SEARCH,2027-01-16,Sat,00:00,24:00,90,20,/m.test(jf.text), 'January 2027: the ad schedule file is named and dated in the new year', jf.name);
  await jn.view('cool'); const j2 = await jn.read();
  t.ok(j2.kpis[6][0].toUpperCase() === '100°F DAYS IN 2026' && j2.kpis[6][2] === 'normal 20.2 · record 71 (2011) · rank #5 of the last century' && /through September 22, 2026/.test(j2.season[0][2]) && /1953 to September 22, 2026/.test(j2.mast) && j2.src.some(x => /1953 to 2026 \(atlas weather file\) A Sep 2026/.test(x)), 'January 2027: the 100°F count is still labeled 2026, the year of the data, with its through date; nothing says "today"', [j2.kpis[6], j2.season[0][2]]);
  /* the rank and the record come from the yearly rows, so the list is right when the data moves into a new year */
  const rk = await jn.p.evaluate(() => { const Y = DATA.climate.ytd, keep = Object.assign({}, Y), a = NWSX.seasonStatus(); Object.assign(Y, { d100: 0, through: '2027-01-14' }); const b = NWSX.seasonStatus(); Object.assign(Y, { d100: 53, through: '2027-08-01' }); const c = NWSX.seasonStatus(); Object.assign(Y, keep); return { now: [a.rank, a.record], jan: [b.rank, b.record], aug: [c.rank, c.record], rows: DATA.climate.rows.filter(r => r[1] > 0).length, last: DATA.climate.rows[DATA.climate.rows.length - 1].slice(0, 2), list: DATA.climate.rank100.length }; });
  t.ok(JSON.stringify(rk.now) === '[5,[71,2011]]' && rk.jan[0] === rk.rows + 1 && rk.aug[0] === 5 && rk.last.join() === '2026,52' && rk.list === 12, 'year turn: with the year to date in 2027, 2026 and its 52 days count as a past year (53 days would rank fifth, one day behind 2023 and ahead of 2026 and 1954); the fixed list of twelve is not what ranks', rk);
  t.ok(!jn.errors.length, 'January 2027: no error', jn.errors); await jn.close();
  /* New Year's Eve, 11:30 pm in Dallas, with nothing newer than the September snapshot (a November cache is older than seven days and is dropped) */
  for (const tz of ['America/Chicago', 'UTC']) {
    const ny = await open({ tz, clock: '2027-01-01T05:30:00Z', storage: { 'tda.nws.v2': FREEZE } }), n1 = await ny.read();
    t.ok(/^BUILD SNAPSHOT: FETCHED SAT 9\/26 3P \(96 DAYS AGO\)/i.test(n1.status) && n1.view === 'heat' && n1.climHead.toUpperCase() === 'CLIMATOLOGY FOR DEC AND JAN (1996 TO 2025)' && /^HEATING DEGREE DAYS IN 2026$/i.test(n1.kpis[6][0]) && /^Mesquite Metro, Sat 9\/26$/i.test(n1.kpis[0][0]), `year turn, ${tz}: at 11:30 pm on December 31 in Dallas it is still December; the old cache is dropped and the snapshot shown with its age and its dates`, [n1.status.slice(0, 60), n1.climHead, n1.kpis[6][0]]);
    const nf = await ny.download('#w14Sched'); t.ok(nf.name === 'ad-schedule_heat_2026-12-31.csv', `year turn, ${tz}: the file is dated by the day in Dallas`, nf.name);
    t.ok(!ny.errors.length, `year turn, ${tz}: no error`, ny.errors); await ny.close();
  }

  /* ================= 7. a refresh, request by request (the test answers for the Weather Service) ================= */
  const net = fakeNWS(LIVE_WEEK), rf = await open({ clock: NOV, running: true, net, storage: { 'tda.wx.view': { view: 'heat', season: 'heat2026' } } });
  const first = rf.reqs.slice(), hosts = a => [...new Set(a.map(q => q.url.split('/')[2]))].sort(), paths = a => a.map(q => q.url.replace(/^https:\/\/[^/]+/, '').replace(/start=[^&]+/, 'start=T')).sort();
  t.eq([first.length, hosts(first)], [29, ['api.weather.gov', 'www.spc.noaa.gov']], 'refresh: opening the desk makes 29 requests (Build 4: 30), to the two hosts it always used');
  t.eq(paths(first).filter(x => /observations\?/.test(x)), ['/stations/KDFW/observations?start=T&limit=500'], 'D3: one station history per refresh, the station on screen, bounded to the last 73 hours');
  t.eq([paths(first).filter(x => /observations\/latest$/.test(x)).length, paths(first).filter(x => /^\/products\/outlook\//.test(x)).length, paths(first).filter(x => /^\/(points|gridpoints|alerts|products)\b/.test(x) && !/outlook/.test(x)).length], [14, 7, 7], 'refresh: 14 stations, 7 outlook products, and the point, three grid calls, the alerts and the two discussion calls');
  t.ok(first.every(q => /spc\.noaa\.gov/.test(q.url) ? q.accept === '*/*' : /\/products\//.test(q.url) ? q.accept === 'application/ld+json' : q.accept === 'application/geo+json') && first.every(q => !q.headers.some(h => /^(x-|authorization|cookie|from)/.test(h))), 'refresh: the headers are the ones Build 4 sent (Accept only); nothing names a person, a company or a repository', [...new Set(first.flatMap(q => q.headers))]);
  const st1 = await rf.p.evaluate(() => { const s = NWSX.state, d = s.data, h = d.obs.history; return { live: s.live, error: s.error, hours: d.hourly.length, stations: d.obs.stations.length, hist: Object.keys(h), rows: h.KDFW.length, perHour: new Set(h.KDFW.map(r => r.t.slice(0, 13))).size, span: +((Date.parse(h.KDFW[h.KDFW.length - 1].t + ':00Z') - Date.parse(h.KDFW[0].t + ':00Z')) / 36e5).toFixed(2), wc: h.KDFW.filter(r => r.wcF != null).length, alerts: d.alerts.length, spc: [d.spc.day2.cat.counties.Dallas, Object.keys(d.spc.day1.cat.counties).length], afd: d.afd.keyMessages, wcF: d.obs.stations.find(x => x.id === 'KDTO').wcF, cached: JSON.parse(localStorage.getItem('tda.nws.v2')).fetched === s.fetched, keys: Object.keys(d).join() }; });
  t.eq(st1, { live: true, error: null, hours: 156, stations: 14, hist: ['KDFW'], rows: 72, perHour: 72, span: 70.33, wc: 11, alerts: 0, spc: ['SLGT', 0], afd: ['Cold rain on Sunday.', 'A warming trend next week.'], wcF: 30.2, cached: true, keys: 'fetched,source,point,zones,stationList,stationLL,forecast,hourly,grid,alerts,obs,spc,afd' }, 'D3: the history held is one reading an hour, the latest of each, 72 of them spanning 70 hours 20 minutes of a station that reports every 20 minutes (Build 4 kept the last 72 observations: 23 hours 40 minutes); the answer has the snapshot shape and is cached');
  const r1 = await rf.read();
  t.ok(/^LIVE: FETCHED FRI 11\/13 1P \(0\.0 H AGO\)/i.test(r1.status) && /Refreshes automatically every thirty minutes while this desk is on screen; use Refresh live to force it\./.test(r1.status) && r1.kpis[1][1] === '44° / 65°' && r1.histSvg, 'refresh: the desk shows the fresh answer and says how it refreshes', r1.status.slice(0, 220));
  t.ok(r1.spc.some(x => /^Day 3 categorical <i>ODD<\/i> 12 of 12: /.test(x)) && (await rf.p.evaluate(() => document.querySelectorAll('#w14Spc i').length)) === 0, 'D30: an unknown outlook label from the wire is shown as text', r1.spc[6]);
  /* D3: Love Field is fetched when its button is pressed, once */
  let n0 = rf.reqs.length; await rf.p.click('#w14Hist button[data-v="KDAL"]'); await rf.p.waitForTimeout(500);
  const h1 = await rf.p.evaluate(() => ({ keys: Object.keys(NWSX.data.obs.history), svg: !!document.querySelector('#w14HistChart svg'), cached: Object.keys(JSON.parse(localStorage.getItem('tda.nws.v2')).data.obs.history) }));
  t.eq([paths(rf.reqs.slice(n0)), h1], [['/stations/KDAL/observations?start=T&limit=500'], { keys: ['KDFW', 'KDAL'], svg: true, cached: ['KDFW', 'KDAL'] }], 'D3: pressing Love Field fetches its history with one request and draws it (Build 4: "No history held for this station.")');
  n0 = rf.reqs.length; await rf.p.click('#w14Hist button[data-v="KDFW"]'); await rf.p.click('#w14Hist button[data-v="KDAL"]'); await rf.p.waitForTimeout(300);
  t.eq(rf.reqs.length - n0, 0, 'D3: a station already held is not fetched again');
  /* D4: the timer. Nothing while the data is younger than thirty minutes; a refresh once it is older, only while the desk is on screen and the page visible */
  n0 = rf.reqs.length; await rf.p.clock.fastForward('20:00'); await rf.p.waitForTimeout(400); const quiet = rf.reqs.length - n0;
  await rf.p.evaluate(() => showModule('index')); await rf.p.clock.fastForward('15:00'); await rf.p.waitForTimeout(400); const away = rf.reqs.length - n0;
  await rf.p.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); showModule('weather'); }); await rf.p.waitForTimeout(400); const shown = rf.reqs.slice(n0);
  t.eq([quiet, away, shown.length, paths(shown).filter(x => /observations\?/.test(x))], [0, 0, 29, ['/stations/KDAL/observations?start=T&limit=500']], 'D4: no request for 35 minutes with the data fresh or the desk off screen; coming back to the desk refreshes it (29 requests, the history of the station now on screen)');
  n0 = rf.reqs.length; await rf.p.clock.fastForward('31:00'); await rf.p.waitForTimeout(400); const hidden = rf.reqs.length - n0;
  await rf.p.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); }); await rf.p.waitForTimeout(500); const back = rf.reqs.length - n0;
  n0 = rf.reqs.length; await rf.p.clock.fastForward('31:00'); await rf.p.waitForTimeout(500); const timer = rf.reqs.length - n0;
  t.eq([hidden, back, timer], [0, 29, 29], 'D4: a hidden page does not refresh; it does when it becomes visible again, and then every thirty minutes by the timer while the desk is on screen');
  /* the Refresh live button, and a second press while one is running */
  n0 = rf.reqs.length; await rf.p.evaluate(() => { const b = document.getElementById('w14Ref'); b.click(); b.click(); }); await rf.p.waitForTimeout(600);
  t.eq(rf.reqs.length - n0, 29, 'refresh: the button forces one refresh; a second press while it runs does not start another');
  /* a bare NWSX.refresh(true), as tools/snapshot.mjs calls it, brings all three histories so a re baked snapshot keeps Love Field */
  n0 = rf.reqs.length; const bare = await rf.p.evaluate(async () => { const s = await NWSX.refresh(true); return { live: s.live, hist: Object.keys(JSON.parse(NWSX.snapshotJSON()).obs.history).sort() }; });
  t.eq([bare, rf.reqs.length - n0], [{ live: true, hist: ['KDAL', 'KDFW', 'KHQZ'] }, 31], 'snapshot tool: NWSX.refresh(true) with no station named still returns the three histories of the snapshot shape (31 requests, at release time only)');
  t.ok(!rf.errors.length, 'refresh: no error', rf.errors); await rf.close();
  /* D9 on the wire: the outlook host down */
  const dn = await open({ clock: NOV, net: fakeNWS(LIVE_WEEK, { fail: /spc\.noaa\.gov/ }), storage: { 'tda.wx.view': { view: 'cool', season: 'heat2026' } } }), d1 = await dn.read();
  t.ok((await dn.p.evaluate(() => NWSX.state.live && NWSX.state.error === null && NWSX.data.spc === null)) && /^SEVERE OUTLOOK, DAY 1 — outlook not available A$/i.test(d1.kpis[5].slice(0, 4).join(' ').replace(/\s+/g, ' ')) && (await dn.p.evaluate(() => document.getElementById('w14Spc').textContent)) === 'No outlook held.', 'D9: with the outlook host down the refresh still succeeds, the outlook is stored as missing and the desk says "outlook not available" (Build 4: "None, no thunderstorm risk drawn")', d1.kpis[5]);
  await dn.close();
  /* a refresh that fails keeps what is held and says so; no timer storm */
  const fl = await open({ clock: NOV, storage: { 'tda.nws.v2': LIVE_WEEK } }), fl1 = await fl.read();
  t.ok(/^LIVE: FETCHED FRI 11\/13 12P \(0\.7 H AGO\).*Last refresh failed: Failed to fetch\. Showing the most recent data held\./i.test(fl1.status) && fl.reqs.length === 1 && /\/points\//.test(fl.reqs[0].url), 'no network: the desk keeps the cached week, says the refresh failed, and gave up after the first request', [fl1.status.slice(0, 120), fl.reqs.length]);
  await fl.p.click('#w14Hist button[data-v="KDAL"]'); await fl.p.waitForTimeout(300);
  t.eq([(await fl.read()).hist, fl.reqs.length], ['No history held for this station.', 2], 'no network: a station that cannot be fetched says so after one try');
  await fl.close();
  /* with the network down the timer tries again thirty minutes after the last try, not every minute */
  const rt = await open({ clock: NOV, running: true, storage: { 'tda.nws.v2': LIVE_WEEK } }); await rt.p.clock.fastForward('25:00'); await rt.p.waitForTimeout(300); const tries25 = rt.reqs.length; await rt.p.clock.fastForward('06:00'); await rt.p.waitForTimeout(300);
  t.eq([tries25, rt.reqs.length], [1, 2], 'no network: one failed try on open, none for the next 25 minutes, the next one after thirty'); await rt.close();

  /* ================= 8. copy: what the desk says about refreshing and the browser app is what the code does ================= */
  const copy = [fz.status, fz.alertNote || '', l1.alertNote || '', fz.meth.join(' '), fz.judg, fz.mast, sep.status].join(' ');
  t.ok(!/every thirty minutes while open|update themselves every thirty minutes|notifies on new alerts|notifies on a new|in its options|checks in the background and notifies/.test(copy), 'copy: no sentence of Build 4 that promised more than the code does is left', copy.match(/every thirty minutes while open|notifies on[^.]*|in its options/));
  t.ok(/The browser app also checks them in the background once a day, with its morning forecast run, and sends one notification per new cold, heat, air quality or severe storm product when notifications are on; it does not watch alerts minute by minute\./.test(l1.alertNote), 'copy: the alert note says the browser app checks once a day and sends one notification per new product', l1.alertNote);
  const refreshM = fz.meth.find(x => /^Refresh\./.test(x));
  t.ok(/fetches on open and every thirty minutes while it is on screen and the page is visible, keeps the last good answer in browser storage for seven days/.test(refreshM) && /background worker does not feed this desk: it checks the forecast at twenty points across the twelve counties every morning and the full set of sources in Live Data once a week, sets a toolbar badge when a night at 40°F or lower is in that forecast, and sends one notification per new trigger/.test(refreshM) && /It does not watch alerts minute by minute\.$/.test(refreshM), 'copy: the method says what the desk and the background worker each do', refreshM);
  /* the claims above, checked against the live layer the page carries */
  const bg = await FZ.p.evaluate(() => { const L = TDA_LIVE, s = L.DEFAULT_SETTINGS, c = L.BY_ID.nws_cold, b = L.derive.badge({ ok: true, stale: false, minLow: 40, th: L.derive.TH, worst: { name: 'tonight', minAt: 'Denton' }, headline: '' }), b2 = L.derive.badge({ ok: true, stale: false, minLow: 41, th: L.derive.TH, worst: { name: 'tonight', minAt: 'Denton' }, headline: '' }); return { daily: s.daily, dailyHour: s.dailyHour, weeklyDow: s.weeklyDow, cadence: c.cadence, points: L.geo.points.length, counties: L.geo.counties.length, badge: [b.text, b2.text], th: L.derive.TH }; });
  t.eq(bg, { daily: true, dailyHour: 5, weeklyDow: 1, cadence: 'daily', points: 20, counties: 12, badge: ['40°', ''], th: { cool: 50, cold: 40, freeze: 32, hard: 25 } }, 'copy: the live layer does run the cold forecast daily (5 am by default) at 20 points in 12 counties, and badges a low of 40°F or lower');
  const methH = fz.meth.find(x => /^Heating view\./.test(x)), methP = fz.meth.find(x => /^Plan\./.test(x));
  t.ok(/50°F cool, 40°F cold night, 32°F freeze, 25°F hard freeze/.test(methH) && /without them each tile shows the Mesquite grid alone and says so\.$/.test(methH) && /Heating Repair starts to lift at 50°F \(Build 4 started at 45°F, which left the first nights in the 40s flat\); its ramp still tops out at plus 60% at 25°F, with the same plus 30% step at 25°F or lower and plus 25% on a cold weather alert\.$/.test(methP) && /AC Repair by 30% in hours with a heat index under 65°F, Heating Repair by 40% in hours at 70°F or warmer/.test(methP), 'the method states the thresholds, the out of season trims and the heat line\'s new start', [methH.slice(0, 160), methP.slice(-200)]);
  /* house style: no hyphen or dash between words in anything the desk itself writes (the Weather Service's own texts are quoted as published) */
  for (const [name, r] of [['heating view', fz], ['cooling view', sep]]) {
    const own = [r.status.replace(/api\.weather\.gov[^.]*\. /, ''), r.kpis.map(x => x[0] + ' ' + x[2]).join(' | '), r.days.map(d => d.tags.join(' ')).join(' | '), r.narr.filter(x => !/synthetic|issued/.test(x)).join(' | '), r.hourNote, r.grid.note, r.win.head, r.obsNote, r.season.join(' | '), r.clim.join(' | '), r.seasonNote, r.spcNote, r.cards.join(' | '), r.meth.join(' | '), r.judg, r.src.join(' | '), r.mast, r.alertNote || ''].join(' || ');
    const hit = own.match(new RegExp('.{0,30}(' + DASH.source + ').{0,30}'));
    t.ok(!hit, `house style, ${name}: no hyphen or dash between words in the desk's own copy`, hit && hit[0]);
  }
  t.ok(!FZ.errors.length && !S1.errors.length, 'no error in the freeze week or the summer desk sessions', FZ.errors.concat(S1.errors));
  await FZ.close(); await S1.close();

  /* ================= 9. the build as it ships today: whatever snapshot and baseline are baked, no network ================= */
  await page.route(/^https?:\/\//, r => r.abort());
  await ctx.show('weather'); await page.waitForTimeout(300);
  const mo = +new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'numeric' }).format(new Date()), want = mo >= 10 || mo <= 3 ? 'heat' : 'cool';
  const b1 = await page.evaluate(collect);
  t.eq([b1.view, b1.line], [want, want === 'heat' ? 'heat' : 'repair'], 'as shipped: the view follows today\'s date in Dallas');
  t.ok(b1.kpis.length === 7 && b1.days.length === 7 && b1.narr.length >= 7 && b1.season.length === 4 && b1.meth.length === 8 && /^(Live|Build snapshot): fetched /i.test(b1.status), 'as shipped: the desk draws its seven tiles, seven days, plain words and season card from the baked snapshot', b1.status.slice(0, 80));
  await page.click(`#w14View button[data-v="${want === 'heat' ? 'cool' : 'heat'}"]`); await page.waitForTimeout(200); const b2 = await page.evaluate(collect);
  t.ok(b2.view !== b1.view && b2.kpis.length === 7 && b2.days.length === 7 && b2.season.length === 4 && b2.kpis[2][0] !== b1.kpis[2][0], 'as shipped: the other view draws as well', b2.kpis.map(x => x[0]));
  for (const [sel, re] of [['#w14Sched', /^ad-schedule_(repair|heat)_\d{4}-\d\d-\d\d\.csv$/], ['#w14Hourly', /^hourly-bid-plan_(repair|heat)\.csv$/], ['#w14Snap', /^nws-dfw-weather\.json$/]]) { const f = await ctx.download(() => page.click(sel)); t.ok(re.test(f.name) && f.text.length > 400, `as shipped: ${sel} saves a file`, [f.name, f.text.length]); }
  await page.click(`#w14View button[data-v="${want}"]`);
  t.ok(!ctx.errors.length, 'as shipped: no page error or console error', ctx.errors.slice(0, 5));
  for (const s of opened) { try { await s.close(); } catch (e) { } }
}
