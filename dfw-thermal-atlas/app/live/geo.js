/* ==== live/geo.js ==== */
/* The geography the collectors share: the 12 counties with their Census and National Weather Service codes, and the
   forecast points the cold watch reads (14 airport stations the Weather Desk already lists, plus the county seats of the
   five counties that have none). The office is where the trucks leave from. */
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
  /* gx, gy: the Fort Worth office (FWD) forecast grid cell of each point, as api.weather.gov/points answered on 2026-11-13.
     The collector uses them directly and looks a point up again only if the Weather Service says the cell is gone. */
  const points = [
    { id: 'KHQZ', name: 'Mesquite', lat: 32.747, lon: -96.530, county: 'Dallas', gx: 99, gy: 102 }, { id: 'KDAL', name: 'Dallas Love Field', lat: 32.847, lon: -96.852, county: 'Dallas', gx: 87, gy: 107 },
    { id: 'KRBD', name: 'South Dallas (Executive)', lat: 32.681, lon: -96.868, county: 'Dallas', gx: 87, gy: 100 }, { id: 'KADS', name: 'Addison', lat: 32.969, lon: -96.836, county: 'Dallas', gx: 88, gy: 112 },
    { id: 'KGPM', name: 'Grand Prairie', lat: 32.699, lon: -97.047, county: 'Tarrant', gx: 80, gy: 101 }, { id: 'KDFW', name: 'DFW Airport', lat: 32.897, lon: -97.038, county: 'Tarrant', gx: 80, gy: 109 },
    { id: 'KGKY', name: 'Arlington', lat: 32.664, lon: -97.094, county: 'Tarrant', gx: 78, gy: 99 }, { id: 'KFTW', name: 'Fort Worth Meacham', lat: 32.820, lon: -97.362, county: 'Tarrant', gx: 68, gy: 106 },
    { id: 'KAFW', name: 'Fort Worth Alliance', lat: 32.988, lon: -97.319, county: 'Tarrant', gx: 70, gy: 113 }, { id: 'KDTO', name: 'Denton', lat: 33.201, lon: -97.198, county: 'Denton', gx: 75, gy: 123 },
    { id: 'KTKI', name: 'McKinney', lat: 33.178, lon: -96.591, county: 'Collin', gx: 97, gy: 122 }, { id: 'KF46', name: 'Rockwall', lat: 32.930, lon: -96.435, county: 'Rockwall', gx: 103, gy: 110 },
    { id: 'KTRL', name: 'Terrell', lat: 32.709, lon: -96.267, county: 'Kaufman', gx: 109, gy: 101 }, { id: 'KJWY', name: 'Midlothian', lat: 32.456, lon: -96.912, county: 'Ellis', gx: 85, gy: 90 },
    { id: 'GRNV', name: 'Greenville', lat: 33.138, lon: -96.111, county: 'Hunt', gx: 115, gy: 120 }, { id: 'CLEB', name: 'Cleburne', lat: 32.348, lon: -97.387, county: 'Johnson', gx: 67, gy: 85 },
    { id: 'GRNB', name: 'Granbury', lat: 32.442, lon: -97.794, county: 'Hood', gx: 52, gy: 90 }, { id: 'WTHF', name: 'Weatherford', lat: 32.759, lon: -97.797, county: 'Parker', gx: 52, gy: 104 },
    { id: 'DECA', name: 'Decatur', lat: 33.234, lon: -97.586, county: 'Wise', gx: 60, gy: 125 },
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
