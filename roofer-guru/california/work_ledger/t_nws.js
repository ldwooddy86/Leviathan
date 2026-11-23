/* node test of 11_nws_core.js against the real snapshot: node t_nws.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
const CA = path.dirname(__dirname);
const snap = JSON.parse(fs.readFileSync(path.join(CA, 'data/hazard/out/ca_nws_snapshot.json'), 'utf8'));
const ctx = {
  window: { __NWS_SNAPSHOT__: snap }, console,
  META: { model: { REGK: { 1: 'nc', 2: 'fn', 3: 'sv', 4: 'si', 5: 'ba', 6: 'cc', 7: 'sj', 8: 'la', 9: 'oc', 10: 'ie', 11: 'sd' } } },
  REGN: { 1: 'North Coast', 2: 'Far North', 3: 'Sacramento Valley', 4: 'Sierra', 5: 'Bay Area', 6: 'Central Coast', 7: 'San Joaquin Valley', 8: 'Los Angeles and Ventura', 9: 'Orange County', 10: 'Inland Empire', 11: 'San Diego and Imperial' },
  DATA: { ts: {} }, PLI: { storm: { tok: 'STORM' }, repair: { tok: 'REPAIR' } },
  isN: v => v !== null && v !== '' && isFinite(v), sum: a => a.reduce((s, v) => s + (+v || 0), 0), mean: a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0,
  inViewer: () => true, BUS: { emit() { } }, toCSV: (h, rows, note) => ['# ' + note, h.join(',')].concat(rows.map(r => r.join(','))).join('\n'),
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(CA, 'atlas/src/11_nws_core.js'), 'utf8') + '\nthis.NWSX = NWSX;', ctx);
const X = ctx.NWSX;
console.log('REGOF', JSON.stringify(X.REGOF));
X.D.points.forEach((p, i) => {
  const H = X.hourly(i), W = X.windows(i), WD = X.workDays(i), T = X.totals(i);
  const pk = Math.max(...H.map(x => x.risk));
  console.log(p.city.padEnd(14), 'hrs', H.length, 'peak', pk.toFixed(2), 'windows', W.length, W.slice(0, 2).map(w => `${w.date} ${w.start}-${w.end} ${w.peak.toFixed(2)} ${w.kinds.join('+')} [${w.why.slice(0, 3).join('; ')}]`).join(' | '));
  console.log('   totals', JSON.stringify(T, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v), 'alerts', X.alertsAt(i).map(a => a.event).join(', '));
  console.log('   days', WD.slice(0, 4).map(d => `${d.date.slice(5)} ${d.verdict} g${d.good} m${d.marginal} b${d.blocked}`).join(' | '));
});
console.log(X.scheduleCSV().split('\n').slice(0, 5).join('\n'));
const evs = [...new Set(X.D.alerts.map(a => a.event))];
evs.forEach(e => console.log(e.padEnd(28), X.actionFor(e).kind));
console.log('holiday 2026-11-26', X.holiday('2026-11-26'), '| 2027-09-06', X.holiday('2027-09-06'), '| seasons 2026-12-10', X.seasonsOf('2026-12-10').map(s => s.name));
/* synthetic checks of each trigger */
const mk = (over, grid, alerts) => { const t0 = Date.parse('2026-07-01T12:00:00-07:00'); const hourly = []; for (let i = 0; i < 6; i++) { const d = new Date(t0 + i * 3600e3); const iso = new Date(d.getTime() - 7 * 3600e3).toISOString().slice(0, 19) + '-07:00'; hourly.push(Object.assign({ t: iso, tempF: 70, rh: 50, pop: 0, wind: '5 mph', short: 'Sunny', isDay: true }, over)); } return { city: 'Los Angeles', lat: 34, lon: -118, reg: 'la', office: 'LOX', zone: 'CAZ368', fireZone: 'CAZ368', county: 'CAC037', hourly, periods: [], grid: grid || {} }; };
const run = (name, over, grid, alerts) => { ctx.window.__NWS_SNAPSHOT__ = { fetched: 'x', points: [mk(over, grid)], alerts: alerts || [], afd: {}, ar: {} }; vm.runInContext(fs.readFileSync(path.join(CA, 'atlas/src/11_nws_core.js'), 'utf8').replace('"use strict";', '').replace('const NWSX =', 'NWSX2 =') , ctx); const h = ctx.NWSX2.hourly(0)[0]; console.log(name.padEnd(22), h.risk.toFixed(2), h.kinds.join('+'), '|', h.why.join('; '), '| work', h.work, h.wwhy.join('; ')); return h; };
const vt = '2026-07-01T19:00:00+00:00/PT6H';
run('calm', {});
run('rain 0.25 in/hr', { pop: 90 }, { quantitativePrecipitation: [[vt, 6 * 0.25 * 25.4]] });
run('gust 50', {}, { windGust: [[vt, 50 * 1.609]] });
run('dry offshore 40', { rh: 8 }, { windGust: [[vt, 40 * 1.609]], windDirection: [[vt, 45]] });
run('red flag', { rh: 20 }, {}, [{ event: 'Red Flag Warning', zones: ['CAZ368'], onset: '2026-07-01T00:00:00-07:00', ends: '2026-07-02T00:00:00-07:00' }]);
run('heat 112', { tempF: 112, rh: 10 });
run('snow 1.5 in/hr', { tempF: 28, pop: 100, short: 'Heavy Snow' }, { snowfallAmount: [[vt, 6 * 1.5 * 25.4]] });
run('thunder 40 hail', { short: 'Thunderstorms' }, { probabilityOfThunder: [[vt, 40]], weather: [[vt, 'thunderstorms[small_hail]']] });
