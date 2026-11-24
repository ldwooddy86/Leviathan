/* Weather on real terrain: the snow line across mountains near and far, rain below it, ponding on level ground only, haze
   and cloud measured from the ground under the camera, the marine layer as a deck that hills stand out of, tule fog on the
   valley floor.   node t_wx.js <page.html> [snow,pond,marine,tule,base] */
const L = require('./lib.js'), ok = L.ok;
const WHAT = (process.argv[3] || 'snow,pond,marine,tule,base').split(',');
(async () => {
  const T = await L.start(process.argv[2], '1100 Orange Ave, Coronado, CA', { maxMs: 3000000, w: 900, h: 640, osm: true });
  console.log('ready', JSON.stringify(await T.ready(120000)));
  const go = async (lat, lon, yaw, h, pitch, gfx) => { await T.ev(a => { const en = MODI.rooftops.api.en(); en.engine.start(); en.storm('dry'); en.wind('calm'); en.sky('none'); en.snowLevel(null); en.setHeight(a[3] || 'drone'); en.open(a[0], a[1], a[2], {}); en.setGraphics(Object.assign({ q: 'low', sun: 13, life: false, wide: true, weather: 'clear' }, a[5] || {})); if (a[4] != null) en.world.pitch = a[4]; }, [lat, lon, yaw, h, pitch, gfx]); await T.wait(7000); const r = await T.ready(180000); await T.wait(5000); await T.settle(60); return r; };
  const wx = () => T.ev(() => { const en = MODI.rooftops.api.en(), s = en.state(), i = en.weather(), e = en.engine.scene.env, S = en.world, cam = en.engine.camera.position; return { weather: s.weather, precip: s.precip, snowLevelM: i.snowLevelM, snowCover: i.snowCover, snowInAir: i.snowInAir, elev: Math.round(s.elev), camAsl: Math.round(cam[1] + S.y0), fogDensity: +e.fogDensity.toFixed(5), fogH: Math.round(e.fogHeight), fogBaseAsl: Math.round((e.fogBase || 0) + S.y0), cloudBaseAsl: Math.round((e.cloudBase || 0) + S.y0), groundAsl: Math.round(S.gy(S.x, S.z) + S.y0), clouds: +e.clouds.toFixed(2), sunI: +(+e.sunIntensity).toFixed(2), sky: i.sky, snowK: e.snowK && e.snowK.map(v => +(+v).toFixed(2)) }; });
  const run = (secs) => T.step(Math.round(secs * 30), 1 / 30);
  const look = (yaw, pitch) => T.ev(a => { const en = MODI.rooftops.api.en(); en.world.yaw = a[0]; en.world.pitch = a[1]; en.setGraphics({}); }, [yaw, pitch]);
  if (WHAT.includes('snow')) {
    /* Lone Pine (1,136 m) under the Sierra crest: steady rain, snow above 1,500 m: rain in town, the line across the mountain front */
    console.log('lone pine', JSON.stringify(await go(36.6060, -118.0628, 262, 'bird', -2)));
    await T.ev(() => MODI.rooftops.api.en().storm('rain')); await run(100); let w = await wx(); console.log(' rain', JSON.stringify(w));
    ok(w.precip === 'rain' && w.snowLevelM === 1500 && w.snowK[0] > 0.9, 'Lone Pine: rain in town, snow settled above 1,500 m', w); await T.shot('wx_lonepine_snowline.png');
    const far = await T.ev(() => { const en = MODI.rooftops.api.en(), sc = en.engine.scene; let n = 0, neg = 0; const walk = e => { (e.components || []).forEach(c => { const m = c.material; if (m && /Far ground|Wider city: ground/.test(m.name || '')) { n++; if (m.wet < 0) neg++; } }); (e.children || []).forEach(walk); }; sc.roots.forEach(walk); return { farGroundRenderers: n, takeSnow: neg }; });
    console.log(' far ground', JSON.stringify(far)); ok(far.farGroundRenderers > 0 && far.takeSnow === far.farGroundRenderers, 'the far ground takes snow', far);
    await T.ev(() => MODI.rooftops.api.en().snowLevel(2600)); await run(60); await T.shot('wx_lonepine_snowline_2600.png');
    /* Mammoth Lakes (2,400 m): the same storm is snow */
    console.log('mammoth', JSON.stringify(await go(37.6485, -118.9721, 230, 'drone', -10))); await T.ev(() => MODI.rooftops.api.en().storm('rain')); await run(100); w = await wx(); console.log(' rain step', JSON.stringify(w));
    ok(w.precip === 'snow' && w.snowCover > 0.8, 'Mammoth Lakes: snow in the air and on the ground', w); await T.shot('wx_mammoth_snow.png');
    /* Truckee (1,773 m) with the snow level at 2,000 m: rain in town, white above */
    console.log('truckee', JSON.stringify(await go(39.3280, -120.1833, 200, 'bird', -3))); await T.ev(() => { const en = MODI.rooftops.api.en(); en.storm('ar2'); en.snowLevel(2000); }); await run(100); w = await wx(); console.log(' ar2, snow level 2000', JSON.stringify(w));
    ok(w.precip === 'rain' && w.snowLevelM === 2000, 'Truckee: rain in town under a 2,000 m snow level', w); await T.shot('wx_truckee_snowline.png');
    /* Big Bear Lake (2,060 m), AR3 with its own snow level */
    console.log('big bear', JSON.stringify(await go(34.2439, -116.9114, 180, 'bird', -6))); await T.ev(() => MODI.rooftops.api.en().storm('ar1')); await run(100); w = await wx(); console.log(' ar1', JSON.stringify(w)); await T.shot('wx_bigbear_ar1.png');
  }
  if (WHAT.includes('pond')) {
    /* an AR5 on Filbert Street's steep block and on the flat of the Marina: water stands on the level, not on the hill */
    console.log('filbert', JSON.stringify(await go(37.80030, -122.41780, 262, 'street', -8, { life: true }))); await T.ev(() => MODI.rooftops.api.en().storm('ar5')); await run(70); console.log(' ar5', JSON.stringify(await wx())); await T.shot('wx_pond_filbert_hill.png');
    console.log('marina', JSON.stringify(await go(37.80370, -122.43700, 90, 'street', -8, { life: true }))); await T.ev(() => MODI.rooftops.api.en().storm('ar5')); await run(70); await T.shot('wx_pond_marina_flat.png');
  }
  if (WHAT.includes('marine')) {
    /* the marine layer over the Golden Gate at 8 in the morning: from the street under it, and from 650 m up over Sausalito toward Mount Tamalpais (784 m) */
    console.log('sf', JSON.stringify(await go(37.8024, -122.4480, 300, 'street', 2, { sun: 8, life: true }))); await T.ev(() => MODI.rooftops.api.en().sky('marine')); await run(30); let w = await wx(); console.log(' under', JSON.stringify(w));
    ok(w.sky.topM === 450 && !w.sky.above && w.clouds > 0.9 && w.fogBaseAsl > 400 && w.fogBaseAsl < 470, 'under the marine layer: overcast, haze up to 450 m above sea level', w); await T.shot('wx_marine_under.png');
    await T.ev(() => { const en = MODI.rooftops.api.en(); en.setHeight('saucer'); }); await T.settle(10);
    await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, U = en.uap.craft.state; const p = [(-122.4850 - S.lon0) * S.kx, -(37.8500 - S.lat0) * S.ky]; U.x = p[0]; U.z = p[1]; U.y = 680 - S.y0; U.vx = U.vy = U.vz = 0; U.target = null; if ('yaw' in U) U.yaw = 300; S.x = p[0]; S.z = p[1]; });
    await run(40); await T.settle(40); await run(10); w = await wx(); console.log(' above', JSON.stringify(w)); ok(w.sky.above && w.sunI > 0.5 && w.camAsl > 520, 'over the top the sun is out', w); await T.ev(() => { const en = MODI.rooftops.api.en(); en.world.uchase.yaw = 0; en.world.uchase.pitch = -8; }); await T.shot('wx_marine_above_tam.png');
    await T.ev(() => { const en = MODI.rooftops.api.en(); en.world.uchase.yaw = 150; en.world.uchase.pitch = -10; }); await T.shot('wx_marine_above_city.png'); await T.ev(() => MODI.rooftops.api.en().setHeight('drone'));
  }
  if (WHAT.includes('tule')) {
    /* tule fog at Fresno at 8 in the morning: in it, over it, and from the foothills at Auberry (about 600 m) looking down the valley */
    console.log('fresno', JSON.stringify(await go(36.7378, -119.7871, 0, 'street', 0, { sun: 8, life: true }))); await T.ev(() => MODI.rooftops.api.en().sky('tule')); await run(30); let w = await wx(); console.log(' in it', JSON.stringify(w));
    ok(w.sky.topM != null && w.sky.topM > w.groundAsl + 40 && w.sky.topM < w.groundAsl + 200 && !w.sky.above, 'Fresno: the fog lies on the valley floor, its top some 110 m over the lowest ground', w); await T.shot('wx_tule_street.png');
    await T.ev(() => MODI.rooftops.api.en().setHeight('bird')); await run(20); await T.settle(20); await run(8); w = await wx(); console.log(' bird', JSON.stringify(w)); await look(0, -12); await T.shot('wx_tule_bird.png');
    console.log('auberry', JSON.stringify(await go(37.0810, -119.4850, 240, 'bird', -6, { sun: 9 }))); await T.ev(() => MODI.rooftops.api.en().sky('tule')); await run(40); await T.wait(3000); await run(10); w = await wx(); console.log(' foothills', JSON.stringify(w));
    ok(w.sky.above && w.sky.topM < w.groundAsl, 'from the foothills the fog is below', w); await T.shot('wx_tule_from_foothills.png');
  }
  if (WHAT.includes('base')) {
    /* haze and cloud from the ground under the camera: at Mammoth Lakes the base follows the ground as the camera moves, and looking down into a valley the haze stays bounded */
    console.log('mammoth', JSON.stringify(await go(37.6485, -118.9721, 60, 'drone', -6))); await run(20); const a = await wx();
    await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world; S.x += 5200; S.z += 1800; S.on = null; }); await T.settle(40); await run(25); const b = await wx(); console.log(' here', JSON.stringify(a)); console.log(' 5.5 km on', JSON.stringify(b));
    ok(Math.abs(a.fogBaseAsl - a.groundAsl) < 12 && Math.abs(b.fogBaseAsl - b.groundAsl) < 12 && Math.abs(a.cloudBaseAsl - a.groundAsl) < 12 && Math.abs(b.cloudBaseAsl - b.groundAsl) < 12, 'haze and cloud are measured from the ground under the camera', [a.groundAsl, a.fogBaseAsl, b.groundAsl, b.fogBaseAsl, b.cloudBaseAsl]);
    await T.shot('wx_base_mammoth_clear.png');
  }
  await T.close(); console.log(L.bad() ? L.bad() + ' FAILED' : 'all pass'); process.exit(L.bad() ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
