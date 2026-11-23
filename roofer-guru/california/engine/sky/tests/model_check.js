/* Sky job: numeric checks of the air traffic model, in Node (no drawing).   node tests/model_check.js */
const fs = require('fs'), path = require('path'), D = path.dirname(__dirname);
global.SE = {}; ['sky_data.js', 'sky_model.js'].forEach(f => eval(fs.readFileSync(path.join(D, f), 'utf8')));
const M = SE.SkyModel(SE.SKY_DATA), FT = M.FT, NM = M.NM, KT = M.KT; let fail = 0;
const ok = (c, t) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if (!c) fail++; };
/* a weekday in November, Pacific standard time: local midnight = 08:00 UTC */
const day0 = Date.UTC(2026, 10, 19, 8) / 1000, B0 = Math.floor(day0 / 3600);
console.log('tz offset', M.tzOff, 'hour of day0', M.hourOf(day0));

/* 1. runway geometry against the evidence */
const chk = (ap, rw, len, hdg) => { const e = M.runway(ap, rw); ok(e && Math.abs(e.len / FT - len) < 60 && Math.abs(((e.hdg - hdg + 540) % 360) - 180) < 1.5, `${ap} ${rw}: ${(e.len / FT).toFixed(0)} ft (evidence ${len}), heading ${e.hdg.toFixed(1)} true (evidence ${hdg})`); };
chk('LAX', '24R', 8926, 263); chk('LAX', '25L', 11095, 263); chk('SFO', '28R', 11870, 298); chk('SFO', '28L', 11381, 298); chk('SAN', '27', 9401, 286); chk('NZY', '18', 8001, 195.5); { const e = M.runway('NZY', '29'); console.log(`     note: North Island 11/29 is ${(e.len / FT).toFixed(0)} ft between the OurAirports end points against the FAA's 7,501 ft (no flights are drawn there)`); }
{ const a = M.airports.SFO, L = M.runway('SFO', '28L'), R = M.runway('SFO', '28R'), dx = (R.lon - L.lon) * a.kLon, dy = (R.lat - L.lat) * a.kLat, sep = Math.abs(dx * L.un - dy * L.ue); ok(Math.abs(sep / FT - 750) < 25, `SFO 28L / 28R centre lines ${(sep / FT).toFixed(0)} ft apart (evidence 750)`); }
ok(Math.abs(M.runway('SAN', '27').displ / FT - 1810) < 6, 'SAN 27 displaced threshold ' + (M.runway('SAN', '27').displ / FT).toFixed(0) + ' ft (evidence 1,810)');

/* 2. on final: on the centre line and on the glide path */
function onPath(ap, rw, expect) {
  const e = M.runway(ap, rw), a = M.airports[ap], c = M.config(ap, rw), f = { ap, rw, kind: 'arr', type: M.TYPES.B738, t0: 1e6, sd: 0.3, liv: 0 }; let worstX = 0, worstH = 0;
  for (let tau = 1; tau < 500; tau += 3) { const p = M.arrPose(f, f.t0 - tau); if (!p || p.dist > 5 * NM) break; const ex = (p.lon - e.lon) * a.kLon, ny = (p.lat - e.lat) * a.kLat, al = ex * e.ue + ny * e.un - e.displ, xt = ex * e.un - ny * e.ue; worstX = Math.max(worstX, Math.abs(xt)); const want = e.elev + c.tch * FT + Math.tan(c.gs * Math.PI / 180) * (-al); worstH = Math.max(worstH, Math.abs(p.alt - want)); }
  ok(worstX < 0.5 && worstH < 1.5, `${ap} ${rw}: inside 5 NM, off the centre line at most ${worstX.toFixed(2)} m, off the ${c.gs.toFixed(2)} degree path at most ${worstH.toFixed(2)} m`);
  expect.forEach(([nm, ft]) => { const h = M.pathFt(ap, rw, nm * NM); ok(Math.abs(h - ft) < 25, `   ${nm} NM from the threshold: ${h.toFixed(0)} ft above sea level (evidence about ${ft})`); });
}
onPath('LAX', '24R', [[1, 500], [2, 810], [3, 1130], [4, 1450], [6.4, 2200]]); onPath('LAX', '25L', [[1, 468]]); onPath('SFO', '28R', [[5.4, 1800], [10, 3000], [14.1, 4000]]); onPath('SFO', '28L', [[1, 368]]); onPath('SAN', '27', [[0.5, 270], [1, 450], [2, 825], [5.2, 2000], [7.4, 2700], [12.9, 4000]]);
{ const perNm = (M.pathFt('LAX', '24R', 3 * NM) - M.pathFt('LAX', '24R', 2 * NM)); ok(Math.abs(perNm - 318) < 1.5, `LAX: ${perNm.toFixed(1)} ft per NM (3.00 degrees is 318)`); const p2 = M.pathFt('SAN', '27', 2 * NM) - M.pathFt('SAN', '27', 1 * NM); ok(Math.abs(p2 - 372) < 1.5, `SAN: ${p2.toFixed(1)} ft per NM (3.50 degrees is 372)`); }

/* 3. a whole day: flights by hour against the table, spacing on final, curfew, night runways, deconfliction */
const hoursOf = (ap, kind) => { const out = new Array(24).fill(0); for (let h = 0; h < 24; h++) out[h] = (kind === 'arr' ? M.arrivals(ap, B0 + h) : M.departures(ap, B0 + h)).length; return out; };
for (const ap of ['LAX', 'SFO', 'SAN', 'BUR', 'LGB', 'SNA', 'ONT', 'OAK', 'SJC', 'SMF']) {
  const A = hoursOf(ap, 'arr'), Dp = hoursOf(ap, 'dep'), H = SE.SKY_DATA.hourly[ap], F = M.FLOW[ap]; let wa = 0, wd = 0, ta = 0, td = 0, ea = 0, ed = 0;
  for (let h = 0; h < 24; h++) { const r = M.rates(ap, h); wa = Math.max(wa, Math.abs(A[h] - r.arr)); wd = Math.max(wd, Math.abs(Dp[h] - r.dep)); ta += A[h]; td += Dp[h]; ea += r.arr; ed += r.dep; }
  ok(wa <= 4 && Math.abs(ta - ea) < 0.06 * ea + 4, `${ap}: landings ${ta} in the day (table x scale ${ea.toFixed(0)}), worst hour off by ${wa.toFixed(1)}`);
  ok(Math.abs(td - ed) < 0.12 * ed + 4, `${ap}: take-offs ${td} in the day (table x scale ${ed.toFixed(0)}), worst hour off by ${wd.toFixed(1)}`);
  if (ap === 'LAX' || ap === 'SFO' || ap === 'SAN') console.log('     arr by hour ' + A.join(' ') + '\n     dep by hour ' + Dp.join(' '));
}
/* spacing: when one crosses the threshold, how far out is the next on the same runway */
function spacing(ap) {
  const all = []; for (let h = -1; h <= 24; h++) all.push(...M.arrivals(ap, B0 + h)); const by = {}; all.forEach(f => (by[f.rw] = by[f.rw] || []).push(f)); let minNm = 99, minS = 1e9, bad = 0, heavyMin = 99, n = 0;
  for (const rw in by) { const L = by[rw].sort((a, b) => a.t0 - b.t0); for (let i = 1; i < L.length; i++) { const lead = L[i - 1], fol = L[i], p = M.arrPose(fol, lead.t0); if (!p || p.dist == null) continue; const nm = p.dist / NM, need = lead.type.wake === 'S' ? (fol.type.wake === 'L' ? 7 : 6) : lead.type.wake === 'H' ? (fol.type.wake === 'L' ? 5 : 4) : 2.5; n++; minNm = Math.min(minNm, nm); minS = Math.min(minS, fol.t0 - lead.t0); if (lead.type.wake !== 'L') heavyMin = Math.min(heavyMin, nm - need); if (nm < need - 0.02) bad++; } }
  ok(bad === 0 && minNm >= 2.5, `${ap}: ${n} successive landings on one runway; closest ${minNm.toFixed(2)} NM (${minS.toFixed(0)} s); behind a heavy or super the least margin over the rule is ${heavyMin === 99 ? 'n/a' : heavyMin.toFixed(2) + ' NM'}; ${bad} under the rule`);
}
['LAX', 'SFO', 'SAN', 'SNA', 'SMF'].forEach(spacing);
{ /* SFO pairs */ const L = []; for (let h = 7; h < 22; h++) L.push(...M.arrivals('SFO', B0 + h)); const l = L.filter(f => f.rw === '28L'), r = L.filter(f => f.rw === '28R'); let pairs = 0; l.forEach(f => { if (r.some(g => Math.abs(g.t0 - f.t0 - 4) < 0.01)) pairs++; }); ok(l.length === r.length && pairs === l.length, `SFO: ${l.length} landings on 28L and ${r.length} on 28R by day, ${pairs} of them in pairs (28L four seconds ahead)`); }
{ /* SAN curfew and one runway shared */ let inCurfew = 0, n = 0, close = 0; const A = []; for (let h = -1; h <= 24; h++) A.push(...M.arrivals('SAN', B0 + h)); for (let h = 0; h < 24; h++) for (const f of M.departures('SAN', B0 + h)) { n++; const hr = M.hourOf(f.t0); if (hr >= 23.5 || hr < 6.5) inCurfew++; for (const a of A) if (f.t0 > a.t0 - 77.9 && f.t0 < a.t0 + 51.9) close++; }
  ok(inCurfew === 0, `SAN: ${n} take-offs in the day, ${inCurfew} between 11:30 p.m. and 6:30 a.m.`); ok(close === 0, `SAN: ${close} take-offs started within 78 s before or 52 s after a landing on the same runway`); }
{ /* LAX night */ const n = M.arrivals('LAX', B0 + 0).concat(M.arrivals('LAX', B0 + 5)), d = M.arrivals('LAX', B0 + 10); ok(n.length > 0 && n.every(f => f.rw === '6L' || f.rw === '7R') && d.every(f => f.rw === '24R' || f.rw === '25L'), `LAX: ${n.length} landings in the 0 and 5 o'clock hours all from over the ocean (6L, 7R); the ${d.length} of the 10 o'clock hour all on 24R and 25L`);
  const dd = M.departures('LAX', B0 + 10); ok(dd.every(f => f.rw === '24L' || f.rw === '25R'), `LAX: ${dd.length} take-offs in the 10 o'clock hour all on 24L and 25R`); }
{ /* SFO crossing runways */ let close = 0, n = 0; const A = []; for (let h = -1; h <= 24; h++) A.push(...M.arrivals('SFO', B0 + h)); for (let h = 0; h < 24; h++) for (const f of M.departures('SFO', B0 + h)) { n++; for (const a of A) if (f.t0 > a.t0 - 49.9 && f.t0 < a.t0 + 44.9) close++; } ok(close === 0, `SFO: ${n} take-offs from 1L and 1R, ${close} begun within 50 s before or 45 s after a landing on the crossing 28s`); }

/* 4. speeds and heights of everything in the air through a day */
{ let over = 0, n = 0, vmaxLow = 0, lowCruise = 0, wrongLevel = 0, mLo = 9, mHi = 0, under = 0;
  for (let t = day0; t < day0 + 86400; t += 97) { const L = M.flightsAt(t, 36, -119.5, 1e9); for (const p of L) { n++; const kt = p.v / KT, ft = p.alt / FT; if (p.kind !== 'crz') { if (ft < 10000 + 5) { vmaxLow = Math.max(vmaxLow, kt); if (kt > 250.5) over++; } if (!p.ground && p.kind === 'arr' && p.alt < p.base - 0.5) under++; } else { if (ft < 30000) lowCruise++; const east = p.hdg < 180, odd = (p.f.fl / 10) % 2 === 1; if (east !== odd) wrongLevel++; const m = p.v / 295; mLo = Math.min(mLo, m); mHi = Math.max(mHi, m); } } }
  ok(over === 0, `${n} positions sampled through the day: fastest below 10,000 ft ${vmaxLow.toFixed(0)} kt (rule 250)`); ok(lowCruise === 0 && wrongLevel === 0, `high traffic: none below FL300, ${wrongLevel} at a level for the wrong direction; Mach ${mLo.toFixed(2)} to ${mHi.toFixed(2)}`); ok(under === 0, 'no arrival below its runway'); }
{ /* a departure's climb */ const f = M.departures('LAX', B0 + 10)[0], K = M.depTrack(f); let lift = 0; for (let i = 0; i < K.n; i++) if (K.Hh[i] > 0) { lift = i; break; } const e = M.runway('LAX', f.rw); console.log(`     LAX departure ${f.type.key} on ${f.rw}: off the ground after ${lift} s and ${Math.hypot(K.X[lift], K.Y[lift]).toFixed(0)} m of a ${e.len.toFixed(0)} m runway; ${Math.round(K.Hh[Math.min(K.n - 1, lift + 60)] / FT)} ft a minute later; ${Math.round(K.Hh[K.n - 1] / FT)} ft at ${(Math.hypot(K.X[K.n - 1], K.Y[K.n - 1]) / 1000).toFixed(0)} km`); ok(Math.hypot(K.X[lift], K.Y[lift]) < e.len, 'airborne before the end of the runway'); }
{ const i = M.info(day0 + 9.5 * 3600, 33.9425, -118.408); console.log('     info at LAX 09:30:', JSON.stringify({ airport: i.airport, landing: i.landing, departing: i.departing, arr: i.arrivalsPerHour, dep: i.departuresPerHour, arriving: i.arriving, departingNow: i.departingNow })); }
console.log(fail ? fail + ' FAILED' : 'ALL OK'); process.exit(fail ? 1 : 0);
