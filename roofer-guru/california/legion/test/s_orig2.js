const L = window.legion, S = L.services, W = S.world, P = S.population;
const out = {};
const time = (f) => { const t = performance.now(); const r = f(); return [performance.now() - t, r]; };
// costs
for (const zip of ['90012', '93546', '92277', '94110']) {
  const zi = W.indexOf(zip), hh = P.householdCount(zi), o = { hh, pop: W.z.pop[zi], city: W.z.city[zi] };
  o.coreFirstMs = time(() => P._core(zi))[0];
  o.homeForMs = time(() => { for (let h = 0; h < hh; h++) W.homeFor(zi, h); })[0];
  o.sizeMs = time(() => { let n = 0; for (let h = 0; h < hh; h++) n += P.householdSize(zi, h); o.persons = n; })[0];
  const n = Math.min(hh, 2000);
  o.core2000Ms = time(() => { for (let h = 0; h < n; h++) P.householdCore(zi, h); })[0];
  o.person200Ms = time(() => { for (let h = 0; h < 200; h++) P.person(zi, h, 0); })[0];
  o.persona50Ms = time(() => { for (let h = 0; h < 50; h++) S.persona(`${zip}-${h}-0`); })[0];
  o.activity50Ms = time(() => { for (let h = 0; h < 50; h++) S.activityAt(`${zip}-${h}-0`, L.clock.t); })[0];
  out[zip] = o;
}
// residents the place panel shows
out.residents = {};
for (const zip of ['90012', '93546', '92277']) {
  const zi = W.indexOf(zip);
  const scope = L.placePanel.scope;
  out.residents[zip] = P.sample(zi, 12, 1).map(p => p.id + ' ' + p.name.display + ' ' + p.age);
}
out.placePanel = { keys: Object.keys(L.placePanel), proto: Object.getOwnPropertyNames(Object.getPrototypeOf(L.placePanel)) };
out.npcPanel = { proto: Object.getOwnPropertyNames(Object.getPrototypeOf(L.npcPanel)) };
out.stageProto = Object.getOwnPropertyNames(Object.getPrototypeOf(L.stage));
out.mapProto = Object.getOwnPropertyNames(Object.getPrototypeOf(L.map));
out.cam = L.map.camera;
// conversation
const conv = S.conversation('90012-5-0', { t: L.clock.t });
if (conv.ok) {
  const c = conv.value; out.greet = c.greet();
  out.fire = c.reply('Have wildfires ever come close to here?');
  out.roof = c.reply('How old is your roof?');
  out.ins = c.reply('How is your home insurance?');
} else out.conv = conv;
out.bark = ['pass', 'wait', 'weather', 'alert', 'traffic', 'work', 'home'].map(s => [s, S.bark('90012-5-0', null, { situation: s, t: L.clock.t })]);
out.weather = S.weather(W.indexOf('90012'), L.clock.t);
return out;
