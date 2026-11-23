/* ==== 02_map.js ==== */
/* ==== src/02_map.js ==== */
/* ==== map ==== */
"use strict";
/* ============================ California map (SVG, offline): ZIPs, counties, bays and lakes, neighbors, located reports ============================
   The data sets the frame (geo.W, H, minx, maxy, kx, sx and geo.u); nothing about the frame is typed here. geo.u is the
   number of view box units per unit of the 2,400 wide frame the constants below were first written for (2 at W = 4800).
   Data keys that keep their first names (SCHEMA.md section 0.1): geo.parish = the 58 county shapes by FIPS, geo.pcent =
   county label points. On screen a county is always a County. */
const GEO = DATA.geo;
const GEO_U = isN(GEO.u) && GEO.u > 0 ? +GEO.u : GEO.W / 2400;
const GEO_COUNTY = GEO['parish'] || GEO.county || {};
function proj(lon, lat) { return [(lon - GEO.minx) * GEO.kx * GEO.sx, (GEO.maxy - lat) * GEO.sx]; }
const COUNTY_LABEL = (() => { const out = {}; FIPS.forEach(f => { const c = (GEO.pcent || {})[f]; if (c) out[f] = proj(c[0], c[1]); }); return out; })();
const PARISH_LABEL = COUNTY_LABEL;   /* first name, kept for any reader that still uses it */
/* a Census place name for a label: "San Buenaventura (Ventura)" reads Ventura, "El Paso de Robles (Paso Robles)" reads Paso Robles */
const placeLabel = n => { const m = /\(([^)]+)\)\s*$/.exec(String(n || '')); return m ? m[1] : String(n || ''); };
/* Town labels, rebuilt for California from the data's places (Census places of 10,000 or more and every county seat).
   Priority by zoom: tier 0 the largest cities, always tried first; tier 1 cities of 150,000 or more and the regional
   anchors of the empty parts of the state (so the north coast, the mountains and the desert are not blank at full
   view); tier 2 from twice zoom: 60,000 or more and every county seat; tier 3 from four times: 25,000 or more and
   mountain, desert and coast towns worth finding; tier 4 from seven times: every other place in the data. Collisions are
   settled on screen at every zoom, larger places first, so nothing is dropped for good here except near duplicates. */
const MAP_CITIES = (() => {
  const anchors = ['Redding', 'Eureka', 'Chico', 'Santa Rosa', 'South Lake Tahoe', 'Bishop', 'Monterey', 'San Luis Obispo', 'Santa Barbara', 'Palm Springs', 'El Centro', 'Barstow', 'Needles', 'Crescent City', 'Yreka', 'Susanville', 'Ukiah', 'Truckee', 'Mammoth Lakes', 'Merced', 'Visalia', 'Modesto', 'Ventura', 'Santa Cruz', 'Salinas', 'Santa Maria', 'Lancaster', 'Victorville', 'Blythe', 'Ridgecrest', 'Alturas', 'Fort Bragg', 'Napa', 'Oceanside', 'Temecula', 'Indio'];
  const keep = ['Weaverville', 'Quincy', 'Downieville', 'Markleeville', 'Bridgeport', 'Independence', 'Mariposa', 'Sonora', 'San Andreas', 'Jackson', 'Placerville', 'Auburn', 'Nevada City', 'Grass Valley', 'Lakeport', 'Willows', 'Colusa', 'Red Bluff', 'Oroville', 'Paradise', 'Mount Shasta', 'Weed', 'Arcata', 'Fortuna', 'Clearlake', 'Tahoe City', 'Lone Pine', 'Big Bear Lake', 'Lake Arrowhead', 'Idyllwild', 'Julian', 'Borrego Springs', 'Twentynine Palms', 'Yucca Valley', 'Joshua Tree', 'Brawley', 'Calexico', 'Avalon', 'Malibu', 'Ojai', 'Solvang', 'Lompoc', 'Morro Bay', 'Cambria', 'Paso Robles', 'King City', 'Hollister', 'Carmel', 'Half Moon Bay', 'Point Reyes Station', 'Bodega Bay', 'Calistoga', 'Healdsburg', 'Sonoma', 'Tehachapi', 'Mojave', 'California City', 'Coalinga', 'Los Banos', 'Oakdale', 'Yosemite Valley', 'Three Rivers', 'Wrightwood', 'Coronado', 'Ramona', 'Pacific Palisades', 'Altadena'];
  const list = PLACES.filter(c => isN(c.lat) && isN(c.lon)).map(c => { const name = placeLabel(c.name); const pop = +c.pop || 0;
    const tier = pop >= 400000 ? 0 : (pop >= 150000 || anchors.includes(name)) ? 1 : (pop >= 60000 || c.seat) ? 2 : (pop >= 25000 || keep.includes(name)) ? 3 : 4;
    return { name, pop, tier, seat: !!c.seat, lat: c.lat, lon: c.lon }; }).sort((a, b) => a.tier - b.tier || b.pop - a.pop);
  const placed = []; const out = []; const near = 4 * GEO_U;
  list.forEach(c => { const [x, y] = proj(c.lon, c.lat); if (x < 0 || y < 0 || x > GEO.W || y > GEO.H) return; if (placed.some(p => Math.abs(p[0] - x) < near && Math.abs(p[1] - y) < near)) return; placed.push([x, y]); out.push({ name: c.name, x, y, major: c.tier === 0, tier: c.tier, pop: c.pop, seat: c.seat }); });
  return out;
})();
const CITY_ZOOM = [1, 1, 2, 4, 7];   /* the zoom at which each tier starts to be tried */
/* water and neighbor names. The points for the ocean and the neighbors are label positions chosen by eye inside the
   frame; lake and bay names come from the data (geo.wname) and sit at the middle of each shape's box. */
const pathBox = d => { const n = String(d || '').match(/[Mlz]|-?\d+/g) || []; let x = 0, y = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, sx = 0, sy = 0; for (let i = 0; i < n.length; i++) { const t = n[i]; if (t === 'M') { x = +n[i + 1]; y = +n[i + 2]; sx = x; sy = y; i += 2; } else if (t === 'l') { x += +n[i + 1]; y += +n[i + 2]; i += 2; } else if (t === 'z') { x = sx; y = sy; continue; } else continue; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < x0 ? null : [x0, y0, x1, y1]; };
const MAP_WATER = (() => {
  const out = []; const P = (name, lon, lat, tier, big) => { const [x, y] = proj(lon, lat); out.push({ name, x, y, tier, big: !!big }); };
  P('Pacific Ocean', -122.9, 34.6, 0, true);
  P('Nevada', -117.4, 39.6, 0, true); P('Arizona', -114.15, 33.9, 1); P('Oregon', -121.6, 42.05, 2); P('Baja California', -115.9, 32.47, 2);
  const names = GEO.wname || []; const seen = {};
  (GEO.water || []).forEach((d, i) => { const nm = names[i]; if (!nm || seen[nm]) return; const b = pathBox(d); if (!b) return; const size = Math.hypot(b[2] - b[0], b[3] - b[1]) / GEO_U; if (size < 14) return; seen[nm] = 1; out.push({ name: nm, x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2, tier: size >= 60 ? 1 : size >= 30 ? 2 : 3 }); });
  return out;
})();
/* Line features. California's data ships none (the key is an empty list): the layer and its methods stay so a module
   that draws legs (an atmospheric river axis, a wind corridor) can supply them in the same ten field rows:
   label, path, magnitude, class number, status code, pressure, start time, mid latitude, mid longitude, county index. */
const SEGS = (DATA.seg || []).map((s, i) => ({ i, r: s[0], d: s[1], v: s[2], cat: s[3], stc: s[4], p: s[5], t: s[6], lat: s[7], lon: s[8], pi: s[9], cls: s[3] >= 3 ? 'H' : s[3] >= 1 ? 'T' : 'D' }));
class ZipMap {
  constructor(host, opts) {
    this.o = Object.assign({ labels: true, countyLabels: false, waterLabels: true, roads: false, segHit: 'wide', onSelect: null, onHover: null, aria: 'Map of California ZIP codes' }, opts || {});
    /* options under their first names are honoured: other modules pass them */
    if (opts && opts['parishLabels'] != null) this.o.countyLabels = !!opts['parishLabels'];
    if (opts && opts['onParish'] && !this.o.onCounty) this.o.onCounty = opts['onParish'];
    if (opts && opts['onParishHover'] && !this.o.onCountyHover) this.o.onCountyHover = opts['onParishHover'];
    this.host = host; this.k = 1; this.tx = 0; this.ty = 0; this.sel = null; this.pinsData = []; this.ptsData = []; this.mode = 'zip';
    const W = GEO.W, H = GEO.H; this.W = W; this.H = H; this.U = GEO_U;
    host.innerHTML = `<div class="mapbox"><svg class="mapsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(this.o.aria)}"></svg><div class="maptools"><button type="button" data-z="in" title="Zoom in" aria-label="Zoom in">+</button><button type="button" data-z="out" title="Zoom out" aria-label="Zoom out">−</button><button type="button" data-z="reset" title="Reset view" aria-label="Reset view">⟲</button></div></div>`;
    const svg = this.svg = $('svg', host); if (this.o.segHit !== 'wide') svg.classList.add('seg' + this.o.segHit);
    const vp = this.vp = svgEl('g'); svg.appendChild(vp);
    this.gN = svgEl('g'); this.gZ = svgEl('g'); this.gPF = svgEl('g'); this.gW = svgEl('g'); this.gC = svgEl('g'); this.gR = svgEl('g'); this.gT = svgEl('g'); this.gP = svgEl('g'); this.gL = svgEl('g');
    [this.gN, this.gZ, this.gPF, this.gW, this.gC, this.gR, this.gT, this.gP, this.gL].forEach(g => vp.appendChild(g));
    /* land beyond the frame, so a map shown narrower than its box (a tall state in a wide card) or dragged past the
       edge does not read as sea: Nevada and Arizona to the east, Oregon to the north, Mexico to the south. These are
       plain rectangles outside the frame from where each neighbor meets the frame's edge, not boundary data. */
    const nbs = Object.values(GEO.neighbors || {});
    if (nbs.length) {
      const xo = proj(-124.25, 42)[0], xm = proj(-117.12, 32.5)[0];
      this.gN.appendChild(svgEl('rect', { x: W - 1, y: -2 * H, width: 4 * W, height: 5 * H, class: 'nb' }));
      this.gN.appendChild(svgEl('rect', { x: xo, y: -2 * H, width: W - xo + 1, height: 2 * H + 1, class: 'nb' }));
      this.gN.appendChild(svgEl('rect', { x: xm, y: H - 1, width: W - xm + 1, height: 2 * H, class: 'nb' }));
    }
    nbs.forEach(d => this.gN.appendChild(svgEl('path', { d, class: 'nb' })));
    this.paths = {};
    { const frag = document.createDocumentFragment(); Object.entries(GEO.zcta).forEach(([zip, d]) => { const p = svgEl('path', { d, class: 'z' }); p.dataset.zip = zip; frag.appendChild(p); this.paths[zip] = p; }); this.gZ.appendChild(frag); }
    this.ppaths = {};
    Object.entries(GEO_COUNTY).forEach(([f, d]) => { const p = svgEl('path', { d, class: 'pf' }); p.dataset.fips = f; this.gPF.appendChild(p); this.ppaths[f] = p; });
    this.gPF.style.display = 'none';
    (GEO.water || []).forEach(d => this.gW.appendChild(svgEl('path', { d, class: 'wt' })));
    Object.values(GEO_COUNTY).forEach(d => this.gC.appendChild(svgEl('path', { d, class: 'cty' })));
    this.gC.appendChild(svgEl('path', { d: GEO.outline, class: 'outl' }));
    this.spaths = SEGS.map(s => { const p = svgEl('path', { d: s.d, class: 'rseg s' + s.cls }); this.gR.appendChild(p); return p; });
    /* wider invisible strokes make thin lines easy to hover and click */
    this.gRH = svgEl('g'); this.hpaths = SEGS.map(s => { const p = svgEl('path', { d: s.d, class: 'rhit' }); p.dataset.seg = s.i; this.gRH.appendChild(p); return p; }); this.gR.appendChild(this.gRH);
    if (!this.o.roads) this.gR.style.display = 'none';
    this.labels = [];
    MAP_WATER.forEach(w => { const g = svgEl('g', { class: 'wlab' }); g.appendChild(svgEl('text', { class: 'lab wtl' + (w.big ? ' big' : ''), 'text-anchor': 'middle' }, w.name)); g.style.display = 'none'; this.gL.appendChild(g); this.labels.push({ g, x: w.x, y: w.y, kind: 'water', tier: w.tier, txt: w.name, fs: w.big ? 15 : 11.5, ls: 1.25, pri: 2.5 + w.tier * 0.1, zmin: [1, 1.6, 3, 6][w.tier] || 1 }); });
    Object.entries(COUNTY_LABEL).forEach(([f, [x, y]]) => { const g = svgEl('g', { class: 'plab' }); const txt = PNAME(f).toUpperCase(); g.appendChild(svgEl('text', { class: 'lab ct', 'text-anchor': 'middle' }, PNAME(f))); g.style.display = 'none'; this.gL.appendChild(g); this.labels.push({ g, x, y, kind: 'county', txt, fs: 11, ls: 1.1, pri: 3, zmin: 1 }); });
    MAP_CITIES.forEach(c => { const g = svgEl('g'); const t = svgEl('text', { class: 'lab' + (c.major ? ' mj' : c.tier >= 2 ? ' sm' : ''), 'text-anchor': 'middle', dy: '-6' }, c.name); const dot = svgEl('circle', { r: c.major ? 3.2 : c.tier >= 3 ? 1.8 : 2.2, class: 'cdot' }); g.appendChild(dot); g.appendChild(t); g.style.display = 'none'; this.gL.appendChild(g); this.labels.push({ g, x: c.x, y: c.y, dot, kind: 'city', tier: c.tier, txt: c.name, fs: c.major ? 19 : c.tier >= 2 ? 12.5 : 15, ls: 1, pri: c.tier, pop: c.pop, zmin: CITY_ZOOM[c.tier] || 7 }); });
    this.labels.forEach(l => { l.on = false; });
    this.labels.sort((a, b) => a.pri - b.pri || (b.pop || 0) - (a.pop || 0));
    this.wire(); this.apply();
    if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.apply()); this.ro.observe(svg); }
  }
  /* view box units per screen pixel. The picture is fitted inside the element whole (the stylesheet caps the height of
     a tall state at the window), so the scale is set by whichever side binds. */
  unit() { const w = this.svg.clientWidth || 900, h = this.svg.clientHeight || 0; return h > 0 ? Math.max(this.W / w, this.H / h) : this.W / w; }
  apply() {
    this.vp.setAttribute('transform', `translate(${this.tx} ${this.ty}) scale(${this.k})`);
    const u = this.unit(), s = u / this.k, boxes = [];
    const vw = this.W / u, vh = this.H / u;
    /* greedy label placement in screen space: larger places first, anything that would collide or is out of view is hidden */
    for (const l of this.labels) {
      let show = l.kind === 'county' ? this.o.countyLabels : l.kind === 'water' ? (this.o.waterLabels && this.k >= l.zmin) : (this.o.labels && this.k >= l.zmin);
      if (show) {
        const cx = (l.x * this.k + this.tx) / u, cy0 = (l.y * this.k + this.ty) / u;
        if (cx < -60 || cy0 < -30 || cx > vw + 60 || cy0 > vh + 30) show = false;
        else { const w = l.txt.length * l.fs * (l.kind === 'county' ? 0.78 : 0.56) * l.ls + 8, h = l.fs + 4; const cy = cy0 - (l.kind === 'city' ? 6 + l.fs * 0.35 : -l.fs * 0.35); const b = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]; if (boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) show = false; else boxes.push(b); }
      }
      if (show) l.g.setAttribute('transform', `translate(${l.x} ${l.y}) scale(${s})`);
      if (show !== l.on) { l.on = show; l.g.style.display = show ? '' : 'none'; }
    }
    this.pinsData.forEach(p => p.g.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${s})`));
    if (this.ptsData.length) { const r0 = s; this.ptsData.forEach(p => p.c.setAttribute('r', (p.r * r0).toFixed(2))); }
  }
  zoomAt(mx, my, f) { const nk = clamp(this.k * f, 1, 48), rf = nk / this.k; this.tx = mx - (mx - this.tx) * rf; this.ty = my - (my - this.ty) * rf; this.k = nk; if (this.k <= 1.001) { this.k = 1; this.tx = 0; this.ty = 0; } this.apply(); }
  reset() { this.k = 1; this.tx = 0; this.ty = 0; this.apply(); }
  /* pad is given in units of the 2,400 wide frame and scaled to the data's frame */
  fitBox(xs, ys, pad) {
    if (!xs.length) return this.reset(); pad = (pad == null ? 90 : pad) * this.U;
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    const k = clamp(Math.min(this.W / (x1 - x0), this.H / (y1 - y0)), 1, 28); this.k = k; this.tx = this.W / 2 - k * (x0 + x1) / 2; this.ty = this.H / 2 - k * (y0 + y1) / 2; this.apply();
  }
  fitTo(zips) { const xs = [], ys = []; zips.forEach(z => { const r = ZI[z]; if (r && isN(r.lat)) { const [x, y] = proj(r.lon, r.lat); xs.push(x); ys.push(y); } }); this.fitBox(xs, ys, zips.length === 1 ? 60 : 40); }
  fitCounties(fl) { const xs = [], ys = []; (fl || []).forEach(f => { const b = pathBox(GEO_COUNTY[f]); if (b) { xs.push(b[0], b[2]); ys.push(b[1], b[3]); } }); if (xs.length) this.fitBox(xs, ys, 20); else { const set = new Set(fl); this.fitTo(Z.filter(z => set.has(z.fips)).map(z => z.zip)); } }
  fitLL(pts) { const xs = [], ys = []; pts.forEach(([lat, lon]) => { const [x, y] = proj(lon, lat); xs.push(x); ys.push(y); }); this.fitBox(xs, ys, 60); }
  wire() {
    const svg = this.svg; let down = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0, hit = null, pid = null, pinHit = null;
    const toVB = e => { const r = svg.getBoundingClientRect(); const u = r.height > 0 ? Math.max(this.W / r.width, this.H / r.height) : this.W / r.width; const offx = (r.width - this.W / u) / 2, offy = (r.height - this.H / u) / 2; return [(e.clientX - r.left - offx) * u, (e.clientY - r.top - offy) * u]; };
    const targetOf = t => { if (!t || !t.dataset) return null; if (t.dataset.zip) return { kind: 'zip', id: t.dataset.zip }; if (t.dataset.fips) return { kind: 'county', id: t.dataset.fips }; if (t.dataset.seg != null) return { kind: 'seg', id: +t.dataset.seg }; if (t.dataset.pt != null) return { kind: 'pt', id: +t.dataset.pt }; return null; };
    svg.addEventListener('pointerdown', e => { down = true; moved = false; sx = ox = e.clientX; sy = oy = e.clientY; pid = e.pointerId; hit = targetOf(e.target); pinHit = e.target.closest && e.target.closest('[data-pin]') ? e.target.closest('[data-pin]').dataset.pin : null; });
    svg.addEventListener('pointermove', e => {
      if (down) { if (!moved && Math.abs(e.clientX - ox) + Math.abs(e.clientY - oy) > 4) { moved = true; svg.classList.add('drag'); try { svg.setPointerCapture(pid); } catch (_) { } hideTip(); }
        if (moved) { const u = this.unit(); this.tx += (e.clientX - sx) * u; this.ty += (e.clientY - sy) * u; sx = e.clientX; sy = e.clientY; this.apply(); return; } }
      const t = e.target; const pin = t.closest && t.closest('[data-pin]');
      if (pin && this.o.onPinHover) { this.o.onPinHover(pin.dataset.pin, e); return; }
      const tg = targetOf(t);
      const hs = tg && tg.kind === 'seg' ? tg.id : null; if (hs !== this.hovSeg) { if (this.hovSeg != null && this.spaths[this.hovSeg]) this.spaths[this.hovSeg].classList.remove('hov'); this.hovSeg = hs; if (hs != null && this.spaths[hs]) this.spaths[hs].classList.add('hov'); }
      if (!tg) { hideTip(); return; }
      if (tg.kind === 'zip' && this.o.onHover) this.o.onHover(tg.id, e);
      else if (tg.kind === 'county' && this.o.onCountyHover) this.o.onCountyHover(tg.id, e);
      else if (tg.kind === 'seg' && this.o.onSegHover) this.o.onSegHover(tg.id, e);
      else if (tg.kind === 'pt' && this.o.onPtHover) this.o.onPtHover(tg.id, e);
      else hideTip();
    });
    const end = () => { if (down && !moved) { if (pinHit && this.o.onPin) this.o.onPin(pinHit); else if (hit) { if (hit.kind === 'zip' && this.o.onSelect) this.o.onSelect(hit.id); else if (hit.kind === 'county' && this.o.onCounty) this.o.onCounty(hit.id); else if (hit.kind === 'seg' && this.o.onSeg) this.o.onSeg(hit.id); else if (hit.kind === 'pt' && this.o.onPt) this.o.onPt(hit.id); } } down = false; moved = false; hit = null; pinHit = null; svg.classList.remove('drag'); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', () => { down = false; moved = false; svg.classList.remove('drag'); });
    svg.addEventListener('pointerleave', () => { hideTip(); if (this.hovSeg != null && this.spaths[this.hovSeg]) this.spaths[this.hovSeg].classList.remove('hov'); this.hovSeg = null; });
    svg.addEventListener('wheel', e => { e.preventDefault(); const [mx, my] = toVB(e); this.zoomAt(mx, my, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
    $$('.maptools button', this.host).forEach(b => b.onclick = () => { const z = b.dataset.z; if (z === 'in') this.zoomAt(this.W / 2, this.H / 2, 1.4); else if (z === 'out') this.zoomAt(this.W / 2, this.H / 2, 1 / 1.4); else this.reset(); });
  }
  setMode(m) { m = m === 'zip' ? 'zip' : 'county'; this.mode = m; this.gZ.style.display = m === 'zip' ? '' : 'none'; this.gPF.style.display = m === 'county' ? '' : 'none'; }
  fill(fn) { this.setMode('zip'); const nd = cssv('--nodata'); Object.entries(this.paths).forEach(([zip, p]) => { const c = fn(zip); p.style.fill = c || nd; }); }
  fillCounty(fn) { this.setMode('county'); const nd = cssv('--nodata'); Object.entries(this.ppaths).forEach(([f, p]) => { const c = fn(f); p.style.fill = c || nd; }); }
  dim(set) { Object.entries(this.paths).forEach(([zip, p]) => p.classList.toggle('dim', !!set && !set.has(zip))); }
  dimCounty(set) { Object.entries(this.ppaths).forEach(([f, p]) => p.classList.toggle('dim', !!set && !set.has(f))); }
  select(zip) { if (this.sel && this.paths[this.sel]) this.paths[this.sel].classList.remove('sel'); this.sel = zip; if (zip && this.paths[zip]) { this.paths[zip].classList.add('sel'); this.gZ.appendChild(this.paths[zip]); } }
  selectCounty(f) { if (this.psel && this.ppaths[this.psel]) this.ppaths[this.psel].classList.remove('sel'); this.psel = f; if (f && this.ppaths[f]) { this.ppaths[f].classList.add('sel'); this.gPF.appendChild(this.ppaths[f]); } }
  /* line features: fn(seg) -> {c: color, w: width} or null for the neutral line */
  roads(fn) { if (!SEGS.length) return; this.gR.style.display = ''; const hot = []; this.spaths.forEach((p, i) => { const s = SEGS[i]; const o = fn ? fn(s) : null; const h = this.hpaths[i]; if (o && o.hide) { p.style.display = 'none'; h.style.display = 'none'; return; } p.style.display = ''; h.style.display = ''; p.style.stroke = o && o.c ? o.c : ''; p.style.strokeWidth = o && o.w ? o.w : ''; p.classList.toggle('hot', !!(o && o.c)); if (o && o.c) hot.push([o.z || 0, p]); }); hot.sort((a, b) => a[0] - b[0]).forEach(([, p]) => this.gR.insertBefore(p, this.gRH)); }
  showRoads(on) { this.gR.style.display = on && SEGS.length ? '' : 'none'; }
  selectSeg(i) { this.spaths.forEach((p, j) => p.classList.toggle('sel', j === i)); if (i != null && this.spaths[i]) this.gR.insertBefore(this.spaths[i], this.gRH); }
  fitSeg(i) { const s = SEGS[i]; if (!s) return; const bb = this.spaths[i].getBBox(); if (bb && bb.width + bb.height > 0) this.fitBox([bb.x, bb.x + bb.width], [bb.y, bb.y + bb.height], 70); else if (isN(s.lat)) this.fitLL([[s.lat, s.lon]]); }
  fitRoute(r) { const xs = [], ys = []; SEGS.forEach((s, i) => { if (s.r !== r) return; const bb = this.spaths[i].getBBox(); xs.push(bb.x, bb.x + bb.width); ys.push(bb.y, bb.y + bb.height); }); this.fitBox(xs, ys, 40); }
  pins(list) {
    this.gP.innerHTML = ''; this.pinsData = [];
    (list || []).forEach(p => { if (!isN(p.lat) || !isN(p.lon)) return; const [x, y] = proj(p.lon, p.lat); const g = svgEl('g', { 'data-pin': p.id }); let shape;
      if (p.shape === 'diamond') { const r = p.r; shape = svgEl('path', { d: `M0 ${-r * 1.35}L${r * 1.35} 0L0 ${r * 1.35}L${-r * 1.35} 0Z`, class: 'pin' + (p.sel ? ' sel' : ''), fill: p.fill, 'fill-opacity': p.op || .92 }); }
      else if (p.shape === 'square') { const r = p.r; shape = svgEl('rect', { x: -r, y: -r, width: 2 * r, height: 2 * r, rx: 1.5, class: 'pin' + (p.sel ? ' sel' : ''), fill: p.fill, 'fill-opacity': p.op || .92 }); }
      else shape = svgEl('circle', { r: p.r, class: 'pin' + (p.sel ? ' sel' : ''), fill: p.fill, 'fill-opacity': p.op || .85 });
      if (p.title) shape.appendChild(svgEl('title', {}, p.title));
      g.appendChild(shape); this.gP.appendChild(g); this.pinsData.push({ g, x, y }); });
    this.apply();
  }
  /* located reports: list of {i, lat, lon, r, fill} drawn as dots that keep their screen size */
  points(list) {
    this.gT.innerHTML = ''; this.ptsData = [];
    const frag = document.createDocumentFragment();
    (list || []).forEach(p => { const [x, y] = proj(p.lon, p.lat); const c = svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: p.r, class: 'pt', fill: p.fill, 'fill-opacity': p.op || .8 }); c.dataset.pt = p.i; frag.appendChild(c); this.ptsData.push({ c, r: p.r }); });
    this.gT.appendChild(frag); this.apply();
  }
  setLabels(on) { this.o.labels = on; this.apply(); }
  setCountyLabels(on) { this.o.countyLabels = on; this.apply(); }
  setWaterLabels(on) { this.o.waterLabels = on; this.apply(); }
}
/* methods under their first names, for the modules that still call them (they act on counties) */
[['fitParishes', 'fitCounties'], ['fillParish', 'fillCounty'], ['dimParish', 'dimCounty'], ['selectParish', 'selectCounty'], ['setParishLabels', 'setCountyLabels']].forEach(([a, b]) => { ZipMap.prototype[a] = ZipMap.prototype[b]; });
function legendHTML(o) {
  const R = o.R || []; return `<div><div class="lt">${o.title}</div><div class="ramp">${R.map(c => `<i style="background:${c}"></i>`).join('')}</div><div class="rlabs"><span>${o.lo}</span><span>${o.hi}</span></div></div><div class="dn">${o.note || ''}</div>`;
}
const countyTip = (f, rows) => { const p = PAI[f]; if (!p) return ''; return `<div class="tt">${esc(p.name)} County</div><div class="ts">${esc(REGN[p.reg] || '')} · ${N(p.hu)} homes · ${N(p.pop)} residents</div>${(rows || []).map(r => tipRow(r[0], r[1])).join('')}<div class="tf">Click for the county ledger</div>`; };
const parishTip = countyTip;   /* first name, kept for the modules that still call it */
