/* ==== live/sources/ercot_grid.js ==== */
/* The Texas grid operator's public dashboards, the grid side of a cold snap. Three reads:
     cond   the grid condition the public gauge shows: normal, Weather Watch, Voluntary Conservation Notice, Conservation
            Appeal, Energy Emergency Alert 1 to 3, with the operating reserve                             (daily-prc.json)
     days   the hourly demand forecast for the next six days, as daily peaks: how high, at what hour, morning against
            evening (a morning peak is the signature of heating load), and the thinnest margin              (supply-demand.json)
     zone   yesterday's hourly load of the North Central weather zone, the one Dallas Fort Worth sits in, kept as a rolling
            history of full days                                (content/cdr/html/YYYYMMDD_actual_loads_of_weather_zones.html)
   The site answers only its own pages across origins, so this source runs in the browser app's background worker or in Node,
   never from a plain web page. These are undocumented files behind a bot firewall that refuses a share of automated requests
   with 403. The rules of the house, kept on purpose: three seconds between calls; on a 403 wait 6 seconds, then 15, and ask
   again, twice at most in a run; never more than four requests a run; no cookies; nothing under the paths robots.txt
   disallows. A part that cannot be read keeps its last good value, marked stale. The run fails as a whole only when neither
   the condition nor the forecast could be read; the last good record then stays in the store, and every reader of it checks
   the age of the condition before using it (live/outlook.js). */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, SITE = 'https://www.ercot.com', DASH = SITE + '/api/1/services/read/dashboards';
  /* three seconds between calls, no automatic retry, and no request waits past 25 seconds (the browser stops the worker at 30) */
  const OPT = { gapMs: 3000, retries: 0, timeoutMs: 25000 }, DAY = 864e5, TZ = 'America/Chicago';
  const MAX_REQUESTS = 4, ZONE_DAYS = 45;
  /* Grades: the condition is the operator's own declared state (A); the demand forecast and the zone loads are its own figures
     read from undocumented files, system and zone wide rather than for the 12 counties (B). */
  const GRADE = { condition: 'A', forecast: 'B', zone: 'B' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const say = e => String((e && e.message) || e).replace(/[<>]/g, ' ').slice(0, 140);
  /* the classes of the operator's own gauge, in the order of its public notice levels */
  const LEVEL = { normal: 1, weather: 2, vcn: 3, conservation: 4, eea1: 5, eea2: 6, eea3: 7 };
  const LEVEL_NAME = ['Unknown', 'Normal conditions', 'Weather Watch', 'Voluntary Conservation Notice', 'Conservation Appeal', 'Energy Emergency Alert 1', 'Energy Emergency Alert 2', 'Energy Emergency Alert 3'];
  const DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const localDay = ms => DATE_FMT.format(new Date(ms));                                   // YYYY-MM-DD in the metro's time zone
  const dayBefore = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') - n * DAY).toISOString().slice(0, 10);
  const num = v => typeof v === 'number' && Number.isFinite(v);
  /* "2026-11-13 12:16:05-0600" → ISO, null when unreadable */
  const stamp = s => { const t = Date.parse(String(s || '').trim().replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')); return Number.isNaN(t) ? null : new Date(t).toISOString(); };
  const best = (rows, f, sign) => rows.reduce((a, b) => (sign * f(b) > sign * f(a) ? b : a));
  /* the condition block of daily-prc.json: datetime is epoch seconds, prc_value is text with a thousands comma */
  function parseCondition(j) {
    const c = (j && j.current_condition) || {}; if (!c.state || typeof c.state !== 'string') return null;
    const prc = parseFloat(String(c.prc_value == null ? '' : c.prc_value).replace(/,/g, '')), level = LEVEL[c.state] || 0;
    return { state: c.state, level, name: level ? LEVEL_NAME[level] : String(c.title || 'Unknown').slice(0, 60), title: String(c.title || '').slice(0, 60), note: String(c.condition_note || '').slice(0, 200), eea: num(c.eea_level) ? c.eea_level : 0, prcMw: Number.isFinite(prc) ? prc : null, at: num(c.datetime) ? new Date(c.datetime * 1000).toISOString() : null, updated: stamp(j.lastUpdated) };
  }
  /* hourly rows of one day → the peak, and the morning peak (hours ending 6 to 10) against the evening peak (15 to 21) */
  function shape(rows, he, mw) {
    const am = rows.filter(r => he(r) >= 6 && he(r) <= 10), pm = rows.filter(r => he(r) >= 15 && he(r) <= 21);
    if (!am.length || !pm.length) return null;
    const pk = best(rows, mw, 1), a = best(am, mw, 1), p = best(pm, mw, 1);
    return { peakMw: Math.round(mw(pk)), peakHe: he(pk), amMw: Math.round(mw(a)), pmMw: Math.round(mw(p)), morning: mw(a) > mw(p) };
  }
  /* the forecast block of supply-demand.json: one row an hour for the next six days → one entry a delivery day (a local date) */
  function parseForecast(j) {
    const by = {}; ((j && j.forecast) || []).forEach(r => { if (r && /^\d{4}-\d{2}-\d{2}$/.test(r.deliveryDate) && num(r.forecastedDemand) && num(r.hourEnding)) (by[r.deliveryDate] = by[r.deliveryDate] || []).push(r); });
    return Object.keys(by).sort().map(d => {
      const rs = by[d]; if (rs.length < 23) return null;                                                      /* a day cut short at the edge of the forecast */
      const s = shape(rs, r => r.hourEnding, r => r.forecastedDemand); if (!s) return null;
      const cap = rs.filter(r => num(r.availCapGen)), tight = cap.length ? best(cap, r => r.availCapGen - r.forecastedDemand, -1) : null;
      return Object.assign({ d }, s, tight ? { marginMw: Math.round(tight.availCapGen - tight.forecastedDemand), marginHe: tight.hourEnding } : {});
    }).filter(Boolean);
  }
  /* the weather zone page, a table: Oper Day, Hour Ending, COAST, EAST, FAR_WEST, NORTH, NORTH_C, SOUTHERN, SOUTH_C, WEST, TOTAL.
     Returns one full day (23 hours or more) or null: a day still in progress, or a page that is not the table. */
  function parseZones(html) {
    const cells = r => (r.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(c => c.replace(/<[^>]+>/g, '').trim());
    const rows = (String(html || '').match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []).map(cells).filter(r => r.length >= 11);
    const head = rows.find(r => r.indexOf('NORTH_C') >= 0); if (!head) return null;
    const iz = head.indexOf('NORTH_C'), it = head.indexOf('TOTAL'), ih = head.indexOf('Hour Ending'), id = head.indexOf('Oper Day'); if (it < 0 || ih < 0 || id < 0) return null;
    const data = rows.filter(r => r !== head && /^\d{4}$/.test(r[ih])).map(r => ({ day: r[id], he: parseInt(r[ih], 10) / 100, nc: parseFloat(r[iz]), tot: parseFloat(r[it]) })).filter(r => Number.isFinite(r.nc) && Number.isFinite(r.tot));
    if (data.length < 23 || data.some(r => r.day !== data[0].day)) return null;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data[0].day), s = shape(data, r => r.he, r => r.nc);
    if (!m || !s) return null;
    return { d: `${m[3]}-${m[1]}-${m[2]}`, ncPeak: s.peakMw, ncHe: s.peakHe, ncAm: s.amMw, ncPm: s.pmMw, morning: s.morning, ncMean: Math.round(data.reduce((t, r) => t + r.nc, 0) / data.length), sysPeak: Math.round(best(data, r => r.tot, 1).tot) };
  }
  /* The record: { v, day (the Dallas date of the run), cond: { state, level (1 to 7, 0 unranked), name, title, note, eea, prcMw, at, updated, since } | null, condStale,
       days: [{ d, peakMw, peakHe, amMw, pmMw, morning, marginMw, marginHe }], daysStale,
       zone: [{ d, ncPeak, ncHe, ncAm, ncPm, morning, ncMean, sysPeak }] newest first, errs: { cond | days | zone: what went wrong this run } } */
  const zoneUrl = ymd => `${SITE}/content/cdr/html/${ymd.replace(/-/g, '')}_actual_loads_of_weather_zones.html`;
  L.register({
    id: 'ercot_grid', name: 'Texas grid conditions and demand forecast', publisher: 'Electric Reliability Council of Texas (ERCOT)', page: 'https://www.ercot.com/gridmktinfo/dashboards',
    about: 'The Texas grid operator\'s public dashboards: the grid condition level, the six day demand forecast and the measured load of the North Central weather zone. It can tell a heating advertiser when the whole state braces for cold (a Weather Watch comes days ahead of a hard freeze; a Conservation Appeal or an Energy Emergency Alert means outage risk and no heat calls when power returns) and when electric heat carries the grid (the daily peak moves to the morning). It cannot tell which county or ZIP is cold, how hard gas furnaces run, or anything past six days; most weeks it reads normal and says nothing.',
    hosts: ['www.ercot.com'], cadence: 'daily', cors: false, grade: 'B', terms: 'ERCOT terms of use (updated July 2023): raw data on the public pages may be used and redistributed in compilations, charts and analyses, which ERCOT does not guarantee. The ERCOT name and logo are trademarks: the source is credited in words only. These dashboard files are not a documented service and can change or refuse automated readers without notice.', timeoutMs: 150000,
    labels: { level: ['Grid condition level (1 normal, 2 Weather Watch, 3 Voluntary Conservation Notice, 4 Conservation Appeal, 5 to 7 Energy Emergency Alert)', 'int'], prcMw: ['Operating reserves, MW', 'int'], peakMw: ['Highest forecast demand, next six days, MW', 'int'], morningDays: ['Forecast days with a morning peak (the shape of heating load)', 'int'], ncPeak: ['North Central zone peak, latest full day, MW', 'int'] },
    async run(ctx) {
      const prev = ctx.prev || {}, now = +ctx.now, today = localDay(now), errs = {}, waits = (L.ercot && L.ercot.waits) || [];
      let left = MAX_REQUESTS, again = 0;
      /* one read, counted against the four requests of the run. A 403 is the firewall, not a missing page: when the read is
         allowed to be patient it waits and asks again, and the two waits are shared by the whole run. */
      async function ask(url, asText, patient) {
        for (;;) {
          if (left <= 0) throw new Error('the ' + MAX_REQUESTS + ' requests of this run are spent');
          left--;
          try { return asText ? await ctx.http.text(url, OPT) : await ctx.http.json(url, OPT); }
          catch (e) {
            if (!(e && e.status === 403)) throw e;
            if (!patient || again >= waits.length || left <= 0) throw new Error('refused by the site firewall (HTTP 403)');
            await sleep(waits[again++]);
          }
        }
      }
      const part = async (key, fn) => { try { return await fn(); } catch (e) { errs[key] = say(e); return null; } };
      const cond = await part('cond', async () => { const c = parseCondition(await ask(DASH + '/daily-prc.json', false, true)); if (!c) throw new Error('no current condition in the answer'); return c; });
      const days = await part('days', async () => { const d = parseForecast(await ask(DASH + '/supply-demand.json', false, true)); if (!d.length) throw new Error('no forecast days in the answer'); return d; });
      if (!cond && !days) throw new Error('the grid operator\'s site could not be read: ' + (errs.cond || errs.days));
      /* since: when this collector first saw the condition it holds now (the dashboard does not say when it began); a gap of
         more than three days between readings starts the count again */
      if (cond) { const p = prev.cond, seen = p && (p.updated || p.at); cond.since = p && p.state === cond.state && p.since && seen && now - +new Date(seen) <= 3 * DAY ? p.since : cond.at || cond.updated || ctx.now.toISOString(); }
      /* the zone history: the site keeps today and five days back. Ask for the full days still missing, newest first, two a
         run at most and only with requests to spare. A page that is not there (404) is noted and the next day is tried; a
         refusal or a server in trouble ends the asking for this run. */
      const have = {}; (prev.zone || []).forEach(z => { if (z && z.d) have[z.d] = z; });
      for (let back = 1, asked = 0, stop = false; back <= 5 && asked < 2 && left > 0 && !stop; back++) {
        const d = dayBefore(today, back); if (have[d]) continue; asked++;
        try { const z = parseZones(await ask(zoneUrl(d), true, false)); if (z && z.d === d) have[d] = z; else errs.zone = 'the zone load page of ' + d + ' did not read as a full day'; }
        catch (e) { errs.zone = say(e); stop = !(e && e.status === 404); }
      }
      const zone = Object.keys(have).sort().reverse().slice(0, ZONE_DAYS).map(d => have[d]);
      return { v: 1, day: today, cond: cond || prev.cond || null, condStale: !cond, days: days || (prev.days || []).filter(x => x && x.d >= today), daysStale: !days, zone, errs };
    },
    digest(d) {
      const ds = (d.days || []).filter(x => !d.day || x.d >= d.day), pk = ds.length ? ds.reduce((a, b) => (b.peakMw > a.peakMw ? b : a)) : null, z = d.zone || [];
      return { level: d.cond ? d.cond.level : null, prcMw: d.cond ? d.cond.prcMw : null, peakMw: pk ? pk.peakMw : null, morningDays: ds.length ? ds.filter(x => x.morning).length : null, ncPeak: z.length ? z[0].ncPeak : null };
    },
  });
  /* waits: the pauses after a first and a second refusal, in milliseconds (tests shorten them) */
  L.ercot = { GRADE, LEVEL, LEVEL_NAME, MAX_REQUESTS, ZONE_DAYS, waits: [6000, 15000], parseCondition, parseForecast, parseZones, zoneUrl };
})(typeof globalThis !== 'undefined' ? globalThis : self);
