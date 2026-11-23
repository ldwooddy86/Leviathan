/* ==== scout topo: roofing readings, profile, the Topography panel ==== */
/* Hooks into topo_block.js through window.__SCOUT_TOPO_EXTRA__:
   - read / lines / csv: design snow (ASCE 7-22 ground snow load), the Title 24 climate zone and what it asks of a
     re-roof, salt air by distance to the shore;
   - profile: click two points on the map, the ground between them is drawn from the terrain tiles;
   - init: the Topography panel under the map: the profile, and what each province means for roofs, each line tied to
     the evidence files (SP/research/ca/sources_weather_hazard.md, roofing_law_evidence.md) or left out. */
(function () {
  'use strict';
  const XD = window.__SCOUT_TOPO_XD__ || null, FT = 3.28084;
  const isN = v => typeof v === 'number' && isFinite(v);
  const N0 = v => Math.round(v).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* climate zone by ZIP */
  const CZ = {};
  if (XD && XD.cz) Object.keys(XD.cz).forEach(k => { const s = XD.cz[k]; for (let i = 0; i < s.length; i += 3) CZ[String(90000 + parseInt(s.substr(i, 3), 36))] = +k; });
  /* Energy Code, alterations to a house (Section 150.2(b)1I): roofing_law_evidence.md, the cool roof table */
  const COOL_STEEP = new Set([4, 8, 9, 10, 11, 12, 13, 14, 15]), COOL_LOW = new Set([4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  /* the snow grid */
  const b64 = s => { const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  const SN = XD && XD.snow ? { g: XD.snow, psf: b64(XD.snow.psf), el: b64(XD.snow.el) } : null;
  function snowAt(la, lo) {
    if (!SN) return null; const g = SN.g, fx = (lo - g.lon0) / g.d, fy = (la - g.lat0) / g.d, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    let t = 0, w = 0, e = 0, ew = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue; const q = SN.psf[y * g.w + x]; if (!q) continue; const k = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty); t += (q / 8) * k; w += k; const ee = SN.el[y * g.w + x]; if (ee) { e += (ee - 1) * 18 * k; ew += k; } }
    if (w < 0.3) return null; const r = t / w; return { psf: r * r, cellElev: ew > 0.3 ? e / ew : null };
  }
  /* Snow country: a choice, stated on the card. 30 lb/ft2 and 100 lb/ft2 are the two marks the hazard research counts
     stations by; 230 is the mountain building departments' limit for rooftop solar (Town of Mammoth Lakes, 2021). */
  const snowClass = p => p >= 230 ? 'deep' : p >= 100 ? 'heavy' : p >= 30 ? 'snow' : p >= 10 ? 'light' : 'none';
  const SNOW_L = { deep: 'Deep snow country', heavy: 'Heavy snow country', snow: 'Snow country', light: 'Occasional snow', none: 'No design snow to speak of' };

  function read(r, ctx) {
    const x = r.x = {};
    x.zip = ctx.zip || null; x.cz = ctx.zip && CZ[ctx.zip] ? CZ[ctx.zip] : null;
    const zs = ctx.zi && isN(ctx.zi.snow_psf) ? ctx.zi.snow_psf : null, g = snowAt(r.la, r.lo);
    if (g) x.snow = { psf: g.psf, cellElev: g.cellElev, src: 'grid', zip: zs }; else if (zs != null) x.snow = { psf: zs, cellElev: null, src: 'zip', zip: zs };
    if (x.snow) x.snowClass = snowClass(x.snow.psf);
    x.salt = r.coast != null && r.coast <= 1.609344;
  }
  function lines(r) {
    const x = r.x || {}, L = [], G = api && api.G ? api.G : (() => '');
    if (x.snow) {
      const p = x.snow.psf, c = x.snowClass;
      if (c === 'none') L.push(`<b>Snow</b>: none to design for. ASCE 7-22 ground snow load about ${p.toFixed(0)} lb/ft² ${G('B')}`);
      else {
      let t = `<b>Snow</b>: ${SNOW_L[c]}. ASCE 7-22 ground snow load about <b>${p < 10 ? p.toFixed(0) : N0(p)} lb/ft²</b> here`;
      if (x.snow.src === 'grid') {
        t += ' (design load for an ordinary building, read off a grid of about 5 km';
        if (isN(x.snow.cellElev) && isN(r.elev) && r.src === 'tiles') { const d = (r.elev - x.snow.cellElev) * FT; t += Math.abs(d) >= 400 ? `; the snow model's ground there stands at ${N0(x.snow.cellElev * FT)} ft and this site at ${N0(r.elev * FT)} ft, so the true figure is likely ${d > 0 ? 'higher' : 'lower'}` : ''; }
        t += ')';
      } else t += ' (the ZIP\'s figure in the atlas)';
      t += '. ';
      if (c === 'deep') t += 'Past 230 lb/ft², the limit the mountain building departments set for rooftop solar (Town of Mammoth Lakes, 2021). The building department sets the design load here: ask it before pricing a deck, a metal roof or solar.';
      else if (c === 'heavy') t += 'The building department sets the design load here, often by subdivision or elevation: ask it before pricing structure, snow retention or solar.';
      else if (c === 'snow') t += 'Snow is a design load here: eaves, valleys and low slopes need ice and water protection, and the local load governs.';
      else if (c === 'light') t += 'Snow falls some winters but seldom governs a roof.';
      t += ` The rule: 30 lb/ft² or more is called snow country here, 100 heavy, 230 deep; a choice, not a code line ${G('C')}`;
      L.push(t);
      }
    }
    if (x.cz) {
      L.push(`<b>Title 24 climate zone ${x.cz}</b> (Energy Commission list, ZIP ${esc(x.zip)}). Re-roofing more than half of a house here: a steep roof ${COOL_STEEP.has(x.cz) ? '<b>must</b> be a cool roof (aged solar reflectance 0.20, emittance 0.75, or SRI 16)' : 'has no cool roof rule'}; a low slope roof ${COOL_LOW.has(x.cz) ? '<b>must</b> be one (0.63, 0.75, or SRI 75)' : 'has none'}. Energy Code Section 150.2(b)1I; exceptions apply ${G('A')}`);
    } else if (x.zip) L.push(`<b>Title 24 climate zone</b>: ZIP ${esc(x.zip)} is not on the Energy Commission's list carried here.`);
    if (x.salt) L.push(`<b>Salt air</b>: ${r.coast < 0.15 ? 'at' : 'within a mile of'} salt water. Metal roofing warranties limit or exclude coverage by distance from salt water: read the maker's warranty for this distance before choosing metal, fasteners or flashings ${G('C')}`);
    return L;
  }
  const csvCols = ['asce7_22_ground_snow_psf', 'snow_country', 'title24_climate_zone', 'cool_roof_steep_reroof', 'cool_roof_low_slope_reroof', 'within_1_mi_of_salt_water'];
  function csvRow(r) { const x = r.x || {}; return [x.snow ? +x.snow.psf.toFixed(x.snow.psf < 10 ? 1 : 0) : '', x.snow ? SNOW_L[x.snowClass] : '', x.cz || '', x.cz ? (COOL_STEEP.has(x.cz) ? 'required' : 'not required') : '', x.cz ? (COOL_LOW.has(x.cz) ? 'required' : 'not required') : '', r.coast == null ? '' : (x.salt ? 'yes' : 'no')]; }
  const csvNote = 'asce7_22_ground_snow_psf: ASCE 7-22 ground snow load, Risk Category II, off a 0.05 degree grid (about 5 km; read as lb/ft2, a unit the service does not state), so a steep site can differ; snow_country is this page\'s wording (30 or more snow country, 100 heavy, 230 deep), not a code term. title24_climate_zone: California Energy Commission list by ZIP code; the cool roof columns are the Energy Code rule for re-roofing more than half of a house (Section 150.2(b)1I), before exceptions.';

  /* ---------- the profile tool ---------- */
  let api = null, H = null, prof = { on: false, pts: [], line: null, marks: [] };
  function profile(a) {
    a = a || api; const map = a.map, LF = a.LF, out = document.getElementById('scTopoProfOut');
    clearProfile(); prof.on = true; if (out) { out.innerHTML = '<p class="sc-note">Click the start of the line on the map, then its end.</p>'; out.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    map.getContainer().classList.add('sc-topo-pick');
    const onClick = e => {
      prof.pts.push([e.latlng.lat, e.latlng.lng]); prof.marks.push(LF.circleMarker(e.latlng, { pane: 'scTopoP', radius: 5, color: '#fff', weight: 2, fillColor: '#e2542d', fillOpacity: 1, interactive: false }).addTo(map));
      if (prof.pts.length < 2) return;
      map.off('click', onClick); map.getContainer().classList.remove('sc-topo-pick'); prof.on = false;
      prof.line = LF.polyline(prof.pts, { pane: 'scTopoP', color: '#e2542d', weight: 3, opacity: 0.95, interactive: false }).addTo(map);
      runProfile(prof.pts[0], prof.pts[1]);
    };
    prof.off = () => { map.off('click', onClick); map.getContainer().classList.remove('sc-topo-pick'); };
    map.on('click', onClick);
  }
  function clearProfile() { if (!api) return; if (prof.off) prof.off(); prof.marks.forEach(m => api.map.removeLayer(m)); if (prof.line) api.map.removeLayer(prof.line); prof = { on: false, pts: [], line: null, marks: [] }; }
  function runProfile(A, B) {
    const out = document.getElementById('scTopoProfOut'), n = 240, L = H.distM(A[0], A[1], B[0], B[1]);
    if (out) out.innerHTML = '<p class="sc-note">Reading the ground along the line…</p>';
    const z = Math.max(7, Math.min(14, Math.round(Math.log2(40075016.686 * Math.cos((A[0] + B[0]) / 2 * Math.PI / 180) / (256 * Math.max(4, L / n))))));
    const P = []; for (let i = 0; i <= n; i++) { const t = i / n; P.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
    return Promise.all(P.map(p => api.eleAt(p[0], p[1], z))).then(E => { const r = { A, B, L, z, n, E: E.map(v => (isN(v) ? v : null)) }; prof.last = r; drawProfile(r); return r; }, () => { if (out) out.innerHTML = '<p class="sc-note">The line could not be read.</p>'; });
  }
  function drawProfile(r) {
    const out = document.getElementById('scTopoProfOut'); if (!out) return; const E = r.E, ok = E.filter(v => v != null);
    if (ok.length < 10) { out.innerHTML = '<p class="sc-note">No heights along that line (outside the state, or the terrain tiles did not load).</p>'; return; }
    const lo = Math.min(...ok), hi = Math.max(...ok), W = 900, Hh = 190, pl = 58, pr = 12, pt = 12, pb = 26, span = Math.max(20, hi - lo), y0 = lo - span * 0.06, y1 = hi + span * 0.08;
    const X = i => pl + (W - pl - pr) * i / r.n, Y = v => pt + (Hh - pt - pb) * (1 - (v - y0) / (y1 - y0));
    let d = '', up = 0, down = 0, steep = 0, prev = null, started = false, iHi = 0, iLo = 0;
    E.forEach((v, i) => { if (v == null) { started = false; return; } d += (started ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); started = true; if (v === hi) iHi = i; if (v === lo) iLo = i; });
    const step = r.L / r.n, win = Math.max(1, Math.round(100 / step));          /* climb and fall on a line smoothed over about 100 m, so pixel noise is not counted */
    const S = E.map((v, i) => { let t = 0, c = 0; for (let k = Math.max(0, i - win); k <= Math.min(r.n, i + win); k++) if (E[k] != null) { t += E[k]; c++; } return c ? t / c : null; });
    S.forEach((v, i) => { if (v == null) { prev = null; return; } if (prev != null) { const dv = v - prev; if (dv > 0) up += dv; else down -= dv; } prev = v; });
    for (let i = win; i <= r.n; i++) if (E[i] != null && E[i - win] != null) steep = Math.max(steep, Math.abs(E[i] - E[i - win]) / (step * win) * 100);
    const first = E.find(v => v != null), last = [...E].reverse().find(v => v != null), mi = r.L / 1609.344, ticks = [lo, (lo + hi) / 2, hi];
    const area = d + `L${X(r.n).toFixed(1)} ${Hh - pb}L${X(0).toFixed(1)} ${Hh - pb}Z`, sea = y0 < 0 && y1 > 0 ? `<line x1="${pl}" x2="${W - pr}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" class="sc-topo-sea"/><text x="${W - pr}" y="${(Y(0) - 3).toFixed(1)}" text-anchor="end" class="sc-topo-ax">sea level</text>` : '';
    out.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" class="sc-topo-prof" role="img" aria-label="Elevation profile along the line: from ${N0(first * FT)} feet to ${N0(last * FT)} feet over ${mi.toFixed(1)} miles, highest ${N0(hi * FT)} feet, lowest ${N0(lo * FT)} feet">
      ${ticks.map(v => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="sc-topo-gr"/><text x="${pl - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="sc-topo-ax">${N0(v * FT)} ft</text>`).join('')}${sea}
      ${E.some(v => v == null) ? '' : `<path d="${area}" class="sc-topo-ar"/>`}<path d="${d}" class="sc-topo-pl"/>
      <circle cx="${X(iHi).toFixed(1)}" cy="${Y(hi).toFixed(1)}" r="3.5" class="sc-topo-dot"/>
      ${[0, 0.25, 0.5, 0.75, 1].map(t => `<text x="${X(t * r.n).toFixed(1)}" y="${Hh - 8}" text-anchor="${t === 0 ? 'start' : t === 1 ? 'end' : 'middle'}" class="sc-topo-ax">${(mi * t).toFixed(mi < 20 ? 1 : 0)} mi</text>`).join('')}</svg>
      <div class="sc-topo-ps"><span>Length <b>${mi.toFixed(mi < 20 ? 1 : 0)} mi</b></span><span>Start <b>${N0(first * FT)} ft</b></span><span>End <b>${N0(last * FT)} ft</b></span><span>High <b>${N0(hi * FT)} ft</b> at ${(mi * iHi / r.n).toFixed(1)} mi</span><span>Low <b>${N0(lo * FT)} ft</b> at ${(mi * iLo / r.n).toFixed(1)} mi</span><span>Climb <b>${N0(up * FT)} ft</b>, fall <b>${N0(down * FT)} ft</b></span><span>Steepest ${N0(step * win / 10) * 10} m <b>${N0(steep)}%</b></span></div>
      <p class="sc-note">${r.n + 1} heights from the terrain tiles at zoom ${r.z} (about ${N0(40075016.686 * Math.cos(r.A[0] * Math.PI / 180) / (256 * Math.pow(2, r.z)))} m a pixel), one every ${N0(step)} m; where a tile did not load, the statewide grid. Vertical scale stretched to fit. <button type="button" class="lnk" id="scTopoProfX">Clear the line</button></p>`;
    const xb = document.getElementById('scTopoProfX'); if (xb) xb.onclick = () => { clearProfile(); out.innerHTML = '<p class="sc-note">Press “Draw a profile”, then click two points on the map.</p>'; };
  }

  /* ---------- what the land means for roofs, province by province ---------- */
  /* [province, the land (California Geological Survey, GeoGems province notes), roofs (evidence files)] */
  const E_W = 'sources_weather_hazard.md', E_L = 'roofing_law_evidence.md';
  const NOTES = [
    ['Sierra Nevada', 'A tilted fault block nearly 400 miles long, gentle on the west, a high fault scarp on the east; the crest tops out at Mount Whitney.',
      'Snow governs. ASCE 7-22 ground snow loads read at stations: Tahoe City 383, Truckee 314, Donner Memorial 429, Blue Canyon 428, Mammoth Lakes 437, Lodgepole 741 lb/ft² (' + E_W + ' 8c; the service does not state its unit). Truckee sets loads by subdivision; its own example is 325 lb/ft², 13 feet of snow. The mountain building departments put the limit for rooftop solar at 230 lb/ft². In the winter of 2023 one storm left 87.2 inches at the Central Sierra Snow Lab and a school roof fell in at Nevada City on 7 March (' + E_L + ' C5). Wind: the strongest gust in Storm Events rows naming a Mono wind is 107 mph, southern Sierra, 21 November 2004 (' + E_W + ' 6c).', 'B'],
    ['Cascade Range', 'A chain of volcanic cones; Mount Shasta, 14,162 feet, and Lassen Peak at its southern end, the Pit River canyon between them.',
      'Snow at height: the ASCE 7-22 ground snow load at the town of Mount Shasta reads 166 lb/ft² (' + E_W + ' 8c). Read the card for the site: the load changes fast with elevation. Yreka and Alturas, like Truckee and Mammoth Lakes, are climate zone 16, where the Energy Code asks no cool roof of a re-roofed house.', 'B'],
    ['Modoc Plateau', 'A volcanic tableland 4,000 to 6,000 feet up, broken by north trending faults into tilted block mountains.',
      'High, cold and dry. No station figure for the plateau is in the evidence files: the card gives the ASCE ground snow load at the site.', 'C'],
    ['Klamath Mountains', 'Rugged ranges and deep canyons reaching 6,000 to 8,000 feet, cut by the Klamath River.',
      'Rain on the west side and snow at height. No roofing figure specific to the Klamath is in the evidence files: the card gives the site\'s snow load and climate zone.', 'C'],
    ['Coast Ranges', 'Low ranges and valleys running northwest beside the San Andreas Fault, mostly 2,000 to 4,000 feet, parted at San Francisco Bay.',
      'Wind off the ridges: the strongest gusts in Storm Events rows naming a Diablo wind are 75 mph (8 October 2017) and 72 mph (28 November 2009), both on Mount Diablo: a summit, which is where the card\'s ridge reading matters (' + E_W + ' 6c). On the Energy Commission\'s list Eureka is climate zone 1, Santa Rosa 2, San Francisco, Oakland and Salinas 3, San Jose 4, San Luis Obispo 5: of those only zone 4 asks a cool roof of a re-roofed house (' + E_L + ' cool roof table). No source on the marine layer or on salt air was collected, so the card gives the distance to salt water and stops there.', 'B'],
    ['Great Valley', 'An alluvial plain about 50 miles wide and 400 long: the Sacramento Valley in the north, the San Joaquin in the south, the Sutter Buttes standing alone in it.',
      'Heat. Climate zones 11 (Redding), 12 (Sacramento, Stockton) and 13 (Fresno, Bakersfield): a re-roofed house needs a cool roof (aged reflectance 0.20 steep, 0.63 low slope), and the Energy Code rates an unlisted asphalt shingle at only 0.08. Cal/OSHA shade at 80 °F and high heat procedures at 95 °F slow summer production (' + E_L + ' C6, cool roof table).', 'A'],
    ['Basin and Range', 'Fault bounded ranges and dropped basins: Death Valley, with Badwater about 280 feet below sea level, though most valley floors stand above 3,000 feet; Honey Lake basin in the north.',
      'Both ends in one province: desert heat on the floors and snow on the ranges (the White and Inyo mountains, the Panamint Range). The card reads the snow load and the climate zone at the site.', 'C'],
    ['Mojave Desert', 'The high desert: isolated ranges between wide plains and dry lake beds, with interior drainage.',
      'Heat, sun and wind. Lancaster, Victorville and Barstow are in climate zone 14: a re-roofed house needs a cool roof, steep or low slope (' + E_L + ' cool roof table). The strongest gust in Storm Events rows naming a Santa Ana wind is 105 mph at Johnson Valley, 6 March 2012 (' + E_W + ' 6c).', 'B'],
    ['Colorado Desert', 'A low basin, much of it below sea level, holding the Salton Sea (surface about 245 feet below sea level): the Coachella and Imperial valleys.',
      'The hottest part of the state for a roof and a crew. Palm Springs, Indio and El Centro are in climate zone 15: cool roofs on re-roofed houses, steep and low slope; Cal/OSHA\'s 80 °F shade and 95 °F high heat rules shape the summer day (' + E_L + ' C6).', 'A'],
    ['Transverse Ranges', 'East to west ranges and valleys set across the grain of the state: the Santa Ynez, San Gabriel and San Bernardino mountains.',
      'Snow up top and wind on the ridges. From 22 February to 1 March 2023: 100 inches at Crestline, 108 near Lake Arrowhead, 82 at Big Bear Lake; roofs collapsed in Lake Arrowhead and Crestline, a grocery store\'s among them (' + E_L + ' C5). ASCE 7-22 ground snow load: Big Bear Lake 392, Lake Arrowhead 245 lb/ft². Santa Ana conditions on 45.9 days a year in the Scripps regional index for Southern California (1948 to 2018), most of them from November to February (' + E_W + ' 6a); gusts of 100 mph and more were measured on ridges here (Mount Lukens Truck Trail, 7 January 2025; Magic Mountain Truck Trail 102 mph, 15 November 2022); sundowners at the Santa Ynez front reached 70 mph at Montecito, 9 May 2022 (' + E_W + ' 6c).', 'B'],
    ['Peninsular Ranges', 'Ranges and long valleys running to Baja California; by the Survey\'s reckoning the Los Angeles Basin and the southern Channel Islands belong to it.',
      'Three roofs in one province: the coastal plain and basin (Long Beach is climate zone 6, San Diego and Coronado 7), hot inland valleys (Riverside 10), and snow on the San Jacinto, Santa Rosa and Laguna mountains (ASCE 7-22 ground snow load: Idyllwild 263, Julian 71 lb/ft²). Santa Ana wind on the ridges: 102 mph at Sill Hill, 9 January 2025 (' + E_W + ' 6c, 8c).', 'B']
  ];
  function panelHTML(G) {
    return `<div class="card mt sc-topo-card"><div class="card-h"><h3>Topography: the land under the roofs</h3><p>Mountains, deserts and valleys of California, a profile between any two points, and what each province means for a roof</p></div><div class="card-b">
      <div class="sc-topo-acts"><button type="button" class="btn sm" id="scTopoPS">Whole state relief</button><button type="button" class="btn sm sec" id="scTopoPP">Draw a profile</button></div>
      <div id="scTopoProfOut"><p class="sc-note">Press “Draw a profile”, then click two points on the map: the ground between them is read from the terrain tiles. Try the Los Angeles Basin to the Antelope Valley, or Sacramento to Lake Tahoe.</p></div>
      <div class="sc-topo-notes">${NOTES.map(n => `<details class="sc-topo-n"><summary><b>${esc(n[0])}</b> <span>${esc(n[1])}</span></summary><p>${esc(n[2])} ${G(n[3])}</p></details>`).join('')}</div>
      <p class="sc-note">Provinces: California Geological Survey, the eleven geomorphic provinces of CGS Note 36 (outlines from its GeoGems layer; descriptions shortened from its province notes) ${G('A')}. Names and positions: USGS Geographic Names Information System ${G('A')}; heights of peaks and passes: USGS 3DEP read at the named point, so a sharp summit can read some feet under its surveyed height ${G('B')}. Relief: AWS Terrain Tiles over the USGS 10 m model, and under zoom 8 a grid of about 1 km carried in this file ${G('B')}. Snow loads: ASCE 7-22 ${G('B')}. Climate zones: California Energy Commission ${G('A')}. Wind on a ridge or shelter in a hollow is a judgment from the shape of the land. Nothing here is said about wind in a named pass, the marine layer or tule fog: no source for them is in the atlas's evidence.</p>
    </div></div>`;
  }
  function init(a, helpers) {
    api = a; H = helpers; const root = a.root || document;
    const host = root.querySelector('.sc-grid') || (root.querySelector('#scMap') && root.querySelector('#scMap').closest('.card'));
    if (!host || root.querySelector('.sc-topo-card')) return;
    host.insertAdjacentHTML('afterend', panelHTML(a.G));
    const q = s => root.querySelector(s);
    q('#scTopoPS').onclick = () => { a.stateView(); const m = q('#scMap'); if (m) m.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    q('#scTopoPP').onclick = () => { profile(a); const m = q('#scMap'); if (m) m.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    a.profile = (A, B) => { clearProfile(); prof.pts = [A, B]; prof.line = a.LF.polyline([A, B], { pane: 'scTopoP', color: '#e2542d', weight: 3, opacity: 0.95, interactive: false }).addTo(a.map); return runProfile(A, B); };
    a.snowAt = snowAt; a.cz = z => CZ[z] || null;
  }
  window.__SCOUT_TOPO_EXTRA__ = { init, read, lines, csvCols, csvRow, csvNote, profile, snowAt, cz: z => CZ[z] || null };
})();
