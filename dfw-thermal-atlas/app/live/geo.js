/* ==== live/geo.js ==== */
/* The geography the collectors share: the 12 counties with their Census and National Weather Service codes, and the
   forecast points the cold watch reads. The office is where the trucks leave from. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE;
  const counties = [
    { name: 'Collin', fips: '48085', zone: 'TXZ104', czone: 'TXC085' }, { name: 'Dallas', fips: '48113', zone: 'TXZ119', czone: 'TXC113' },
    { name: 'Denton', fips: '48121', zone: 'TXZ103', czone: 'TXC121' }, { name: 'Ellis', fips: '48139', zone: 'TXZ134', czone: 'TXC139' },
    { name: 'Hood', fips: '48221', zone: 'TXZ131', czone: 'TXC221' }, { name: 'Hunt', fips: '48231', zone: 'TXZ105', czone: 'TXC231' },
    { name: 'Johnson', fips: '48251', zone: 'TXZ133', czone: 'TXC251' }, { name: 'Kaufman', fips: '48257', zone: 'TXZ121', czone: 'TXC257' },
    { name: 'Parker', fips: '48367', zone: 'TXZ117', czone: 'TXC367' }, { name: 'Rockwall', fips: '48397', zone: 'TXZ120', czone: 'TXC397' },
    { name: 'Tarrant', fips: '48439', zone: 'TXZ118', czone: 'TXC439' }, { name: 'Wise', fips: '48497', zone: 'TXZ102', czone: 'TXC497' },
  ];
  /* Forecast points: one at the population centre or county seat of every county, on the airport observing station where one
     sits there (stn: the paired station, so forecast and observation can be compared), plus extra points where a county holds
     a million people or the urban heat island splits it. gx, gy: the Fort Worth office (FWD) forecast grid cell, as
     api.weather.gov/points answered on 2026-11-13; the collector looks a point up again only if that cell is gone. */
  const points = [
    { id: 'MESQ', name: 'Mesquite', lat: 32.8063, lon: -96.6609, county: 'Dallas', gx: 94, gy: 105, stn: 'KHQZ' }, { id: 'KDAL', name: 'Dallas Love Field', lat: 32.8542, lon: -96.8551, county: 'Dallas', gx: 87, gy: 107, stn: 'KDAL' },
    { id: 'KRBD', name: 'South Dallas', lat: 32.6758, lon: -96.8639, county: 'Dallas', gx: 87, gy: 99, stn: 'KRBD' }, { id: 'KADS', name: 'Addison', lat: 32.9667, lon: -96.8333, county: 'Dallas', gx: 88, gy: 112, stn: 'KADS' },
    { id: 'KDFW', name: 'DFW Airport', lat: 32.8974, lon: -97.0220, county: 'Tarrant', gx: 81, gy: 109, stn: 'KDFW' }, { id: 'KGKY', name: 'Arlington', lat: 32.6583, lon: -97.0951, county: 'Tarrant', gx: 78, gy: 99, stn: 'KGKY' },
    { id: 'KFTW', name: 'Fort Worth', lat: 32.8253, lon: -97.3642, county: 'Tarrant', gx: 68, gy: 106, stn: 'KFTW' }, { id: 'KAFW', name: 'Alliance', lat: 32.9733, lon: -97.3181, county: 'Tarrant', gx: 70, gy: 113, stn: 'KAFW' },
    { id: 'KDTO', name: 'Denton', lat: 33.2051, lon: -97.2006, county: 'Denton', gx: 75, gy: 123, stn: 'KDTO' }, { id: 'LEWV', name: 'Lewisville', lat: 33.0462, lon: -96.9942, county: 'Denton', gx: 82, gy: 116, stn: null },
    { id: 'KTKI', name: 'McKinney', lat: 33.1778, lon: -96.5903, county: 'Collin', gx: 97, gy: 122, stn: 'KTKI' }, { id: 'PLAN', name: 'Plano', lat: 33.0198, lon: -96.6989, county: 'Collin', gx: 93, gy: 115, stn: null },
    { id: 'KF46', name: 'Rockwall', lat: 32.9322, lon: -96.4348, county: 'Rockwall', gx: 103, gy: 111, stn: 'KF46' }, { id: 'KTRL', name: 'Terrell', lat: 32.7136, lon: -96.2683, county: 'Kaufman', gx: 109, gy: 101, stn: 'KTRL' },
    { id: 'KJWY', name: 'Midlothian', lat: 32.4558, lon: -96.9122, county: 'Ellis', gx: 85, gy: 90, stn: 'KJWY' }, { id: 'KGVT', name: 'Greenville', lat: 33.0667, lon: -96.0667, county: 'Hunt', gx: 116, gy: 116, stn: 'KGVT' },
    { id: 'KCPT', name: 'Cleburne', lat: 32.3536, lon: -97.4336, county: 'Johnson', gx: 65, gy: 86, stn: 'KCPT' }, { id: 'KGDJ', name: 'Granbury', lat: 32.4442, lon: -97.8167, county: 'Hood', gx: 51, gy: 90, stn: 'KGDJ' },
    { id: 'WTHF', name: 'Weatherford', lat: 32.7593, lon: -97.7972, county: 'Parker', gx: 52, gy: 104, stn: 'KMWL' }, { id: 'KLUD', name: 'Decatur', lat: 33.2544, lon: -97.5806, county: 'Wise', gx: 61, gy: 125, stn: 'KLUD' },
  ];
  const km = (a, b, c, d) => { const R = 6371, p = Math.PI / 180, x = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  /* the n nearest of `list` ([{lat, lon}]) to a place, with inverse distance weights that sum to 1 (a point within 1 km takes it all) */
  function nearest(lat, lon, list, n) {
    const d = list.map((p, i) => ({ i, p, km: km(lat, lon, p.lat, p.lon) })).sort((a, b) => a.km - b.km).slice(0, n || 3);
    if (!d.length) return []; if (d[0].km < 1) return [{ i: d[0].i, p: d[0].p, km: d[0].km, w: 1 }];
    const s = d.reduce((t, x) => t + 1 / (x.km * x.km), 0); return d.map(x => ({ i: x.i, p: x.p, km: x.km, w: 1 / (x.km * x.km) / s }));
  }
  const byZone = {}; counties.forEach(c => { byZone[c.zone] = c.name; byZone[c.czone] = c.name; });
  L.geo = { counties, points, km, nearest, byZone, office: { name: 'Integrity Air, Mesquite', lat: 32.8063, lon: -96.6609 }, tz: 'America/Chicago', bbox: [-98.3, 32.0, -95.8, 33.6] };
})(typeof globalThis !== 'undefined' ? globalThis : self);
