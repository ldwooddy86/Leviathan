/* ==== 02_map.js ==== */
/* ==== src/02_map.js ==== */
/* ==== map ==== */
"use strict";
/* ============================ Louisiana map (SVG, offline): ZIPs, parishes, water, storm tracks, storm reports ============================ */
const GEO = DATA.geo;
function proj(lon, lat) { return [(lon - GEO.minx) * GEO.kx * GEO.sx, (GEO.maxy - lat) * GEO.sx]; }
const PARISH_LABEL = (() => { const out = {}; FIPS.forEach(f => { const c = GEO.pcent[f]; if (c) out[f] = proj(c[0], c[1]); }); return out; })();
const MAP_CITIES = (() => {
  const keep = ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles', 'Monroe', 'Alexandria', 'Houma', 'Kenner', 'Bossier City', 'Metairie', 'Slidell', 'Hammond', 'Ruston', 'New Iberia', 'Natchitoches', 'Opelousas', 'Thibodaux', 'Covington', 'Laplace', 'Sulphur', 'Morgan City', 'Bogalusa', 'Minden', 'DeRidder', 'Leesville', 'Crowley', 'Jennings', 'Natchitoches', 'Pineville', 'West Monroe', 'Gonzales', 'Denham Springs', 'Zachary', 'Abbeville', 'Eunice', 'Plaquemine', 'Chalmette', 'Marrero', 'Mandeville', 'Bastrop', 'Tallulah', 'Winnfield', 'Many', 'Oakdale', 'Marksville', 'Ville Platte', 'Jonesboro', 'Homer', 'Farmerville', 'Vidalia', 'Jena', 'Columbia', 'Winnsboro', 'Rayville', 'Lake Providence', 'Franklinton', 'Amite City', 'Napoleonville', 'Donaldsonville', 'Port Allen', 'New Roads', 'Clinton', 'St. Francisville', 'Galliano', 'Cut Off', 'Raceland', 'Belle Chasse', 'Grand Isle', 'Cameron', 'Kaplan', 'Breaux Bridge', 'St. Martinville', 'Youngsville', 'Broussard', 'Scott', 'Carencro'];
  const list = PLACES.filter(c => isN(c.lat) && (c.pop >= 20000 || keep.includes(c.name))).sort((a, b) => b.pop - a.pop);
  const placed = []; const out = [];
  list.forEach(c => { const [x, y] = proj(c.lon, c.lat); const major = c.pop >= 90000; const tier = c.pop >= 90000 ? 0 : c.pop >= 30000 ? 1 : 2; if (placed.some(p => Math.abs(p[0] - x) < (major ? 70 : 95) && Math.abs(p[1] - y) < 30)) return; placed.push([x, y]); out.push({ name: c.name, x, y, major, tier, pop: c.pop }); });
  return out;
})();
/* storm track legs (HURDAT2 six hour fixes, 2002 to 2025, and NHC operational best tracks for 2026): label, path, mean sustained wind (kt),
   Saffir Simpson category of the leg, status code, central pressure, start time, midpoint, nearest parish */
const SEGS = DATA.seg.map((s, i) => ({ i, r: s[0], d: s[1], v: s[2], cat: s[3], stc: s[4], p: s[5], t: s[6], lat: s[7], lon: s[8], pi: s[9], cls: s[3] >= 1 ? 'H' : s[3] === 0 ? 'T' : 'D' }));
class ZipMap {
  constructor(host, opts) {
    this.o = Object.assign({ labels: true, parishLabels: false, roads: false, segHit: 'wide', onSelect: null, onHover: null, aria: 'Map of Louisiana ZIP codes' }, opts || {});
    this.host = host; this.k = 1; this.tx = 0; this.ty = 0; this.sel = null; this.pinsData = []; this.ptsData = []; this.mode = 'zip';
    const W = GEO.W, H = GEO.H; this.W = W; this.H = H;
    host.innerHTML = `<div class="mapbox"><svg class="mapsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(this.o.aria)}"></svg><div class="maptools"><button type="button" data-z="in" title="Zoom in" aria-label="Zoom in">+</button><button type="button" data-z="out" title="Zoom out" aria-label="Zoom out">−</button><button type="button" data-z="reset" title="Reset view" aria-label="Reset view">⟲</button></div></div>`;
    const svg = this.svg = $('svg', host); if (this.o.segHit !== 'wide') svg.classList.add('seg' + this.o.segHit);
    const vp = this.vp = svgEl('g'); svg.appendChild(vp);
    this.gN = svgEl('g'); this.gZ = svgEl('g'); this.gPF = svgEl('g'); this.gW = svgEl('g'); this.gC = svgEl('g'); this.gR = svgEl('g'); this.gT = svgEl('g'); this.gP = svgEl('g'); this.gL = svgEl('g');
    [this.gN, this.gZ, this.gPF, this.gW, this.gC, this.gR, this.gT, this.gP, this.gL].forEach(g => vp.appendChild(g));
    Object.values(GEO.neighbors).forEach(d => this.gN.appendChild(svgEl('path', { d, class: 'nb' })));
    this.paths = {};
    Object.entries(GEO.zcta).forEach(([zip, d]) => { const p = svgEl('path', { d, class: 'z' }); p.dataset.zip = zip; this.gZ.appendChild(p); this.paths[zip] = p; });
    this.ppaths = {};
    Object.entries(GEO.parish).forEach(([f, d]) => { const p = svgEl('path', { d, class: 'pf' }); p.dataset.fips = f; this.gPF.appendChild(p); this.ppaths[f] = p; });
    this.gPF.style.display = 'none';
    GEO.water.forEach(d => this.gW.appendChild(svgEl('path', { d, class: 'wt' })));
    Object.values(GEO.parish).forEach(d => this.gC.appendChild(svgEl('path', { d, class: 'cty' })));
    this.gC.appendChild(svgEl('path', { d: GEO.outline, class: 'outl' }));
    this.spaths = SEGS.map(s => { const p = svgEl('path', { d: s.d, class: 'rseg s' + s.cls }); this.gR.appendChild(p); return p; });
    /* wider invisible strokes make thin tracks easy to hover and click */
    this.gRH = svgEl('g'); this.hpaths = SEGS.map(s => { const p = svgEl('path', { d: s.d, class: 'rhit' }); p.dataset.seg = s.i; this.gRH.appendChild(p); return p; }); this.gR.appendChild(this.gRH);
    if (!this.o.roads) this.gR.style.display = 'none';
    this.labels = [];
    Object.entries(PARISH_LABEL).forEach(([f, [x, y]]) => { const g = svgEl('g', { class: 'plab' }); const txt = PNAME(f).toUpperCase(); g.appendChild(svgEl('text', { class: 'lab ct', 'text-anchor': 'middle' }, PNAME(f))); this.gL.appendChild(g); this.labels.push({ g, x, y, kind: 'parish', txt, fs: 11, ls: 1.1, pri: 3 }); });
    MAP_CITIES.forEach(c => { const g = svgEl('g'); const t = svgEl('text', { class: 'lab' + (c.major ? ' mj' : c.tier === 2 ? ' sm' : ''), 'text-anchor': 'middle', dy: '-6' }, c.name); const dot = svgEl('circle', { r: c.major ? 3.2 : 2.2, class: 'cdot' }); g.appendChild(dot); g.appendChild(t); this.gL.appendChild(g); this.labels.push({ g, x: c.x, y: c.y, dot, kind: 'city', tier: c.tier, txt: c.name, fs: c.major ? 19 : c.tier === 2 ? 12.5 : 15, ls: 1, pri: c.tier, pop: c.pop }); });
    this.labels.sort((a, b) => a.pri - b.pri || (b.pop || 0) - (a.pop || 0));
    this.wire(); this.apply();
    if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.apply()); this.ro.observe(svg); }
  }
  unit() { const w = this.svg.clientWidth || 900; return this.W / w; }
  apply() {
    this.vp.setAttribute('transform', `translate(${this.tx} ${this.ty}) scale(${this.k})`);
    const s = this.unit() / this.k;
    /* greedy label placement in screen space: larger places first, anything that would collide is hidden */
    const u = this.unit(), boxes = [];
    this.labels.forEach(l => { l.g.setAttribute('transform', `translate(${l.x} ${l.y}) scale(${s})`); let show = l.kind === 'parish' ? this.o.parishLabels : this.o.labels && (l.tier <= 1 || (l.tier === 2 && this.k >= 2));
      if (show) { const w = l.txt.length * l.fs * (l.kind === 'parish' ? 0.78 : 0.56) * l.ls + 8, h = l.fs + 4; const cx = (l.x * this.k + this.tx) / u, cy = (l.y * this.k + this.ty) / u - (l.kind === 'city' ? 6 + l.fs * 0.35 : -l.fs * 0.35); const b = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]; if (boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) show = false; else boxes.push(b); }
      l.g.style.display = show ? '' : 'none'; });
    this.pinsData.forEach(p => p.g.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${s})`));
    if (this.ptsData.length) { const r0 = s; this.ptsData.forEach(p => p.c.setAttribute('r', (p.r * r0).toFixed(2))); }
  }
  zoomAt(mx, my, f) { const nk = clamp(this.k * f, 1, 16), rf = nk / this.k; this.tx = mx - (mx - this.tx) * rf; this.ty = my - (my - this.ty) * rf; this.k = nk; if (this.k <= 1.001) { this.k = 1; this.tx = 0; this.ty = 0; } this.apply(); }
  reset() { this.k = 1; this.tx = 0; this.ty = 0; this.apply(); }
  fitBox(xs, ys, pad) {
    if (!xs.length) return this.reset(); pad = pad == null ? 90 : pad;
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    const k = clamp(Math.min(this.W / (x1 - x0), this.H / (y1 - y0)), 1, 10); this.k = k; this.tx = this.W / 2 - k * (x0 + x1) / 2; this.ty = this.H / 2 - k * (y0 + y1) / 2; this.apply();
  }
  fitTo(zips) { const xs = [], ys = []; zips.forEach(z => { const r = ZI[z]; if (r && isN(r.lat)) { const [x, y] = proj(r.lon, r.lat); xs.push(x); ys.push(y); } }); this.fitBox(xs, ys, zips.length === 1 ? 140 : 90); }
  fitParishes(fl) { const set = new Set(fl); this.fitTo(Z.filter(z => set.has(z.fips)).map(z => z.zip)); }
  fitLL(pts) { const xs = [], ys = []; pts.forEach(([lat, lon]) => { const [x, y] = proj(lon, lat); xs.push(x); ys.push(y); }); this.fitBox(xs, ys, 120); }
  wire() {
    const svg = this.svg; let down = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0, hit = null, pid = null, pinHit = null;
    const toVB = e => { const r = svg.getBoundingClientRect(); const u = this.W / r.width; return [(e.clientX - r.left) * u, (e.clientY - r.top) * u]; };
    const targetOf = t => { if (!t || !t.dataset) return null; if (t.dataset.zip) return { kind: 'zip', id: t.dataset.zip }; if (t.dataset.fips) return { kind: 'parish', id: t.dataset.fips }; if (t.dataset.seg != null) return { kind: 'seg', id: +t.dataset.seg }; if (t.dataset.pt != null) return { kind: 'pt', id: +t.dataset.pt }; return null; };
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
      else if (tg.kind === 'parish' && this.o.onParishHover) this.o.onParishHover(tg.id, e);
      else if (tg.kind === 'seg' && this.o.onSegHover) this.o.onSegHover(tg.id, e);
      else if (tg.kind === 'pt' && this.o.onPtHover) this.o.onPtHover(tg.id, e);
      else hideTip();
    });
    const end = () => { if (down && !moved) { if (pinHit && this.o.onPin) this.o.onPin(pinHit); else if (hit) { if (hit.kind === 'zip' && this.o.onSelect) this.o.onSelect(hit.id); else if (hit.kind === 'parish' && this.o.onParish) this.o.onParish(hit.id); else if (hit.kind === 'seg' && this.o.onSeg) this.o.onSeg(hit.id); else if (hit.kind === 'pt' && this.o.onPt) this.o.onPt(hit.id); } } down = false; moved = false; hit = null; pinHit = null; svg.classList.remove('drag'); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', () => { down = false; moved = false; svg.classList.remove('drag'); });
    svg.addEventListener('pointerleave', () => { hideTip(); if (this.hovSeg != null && this.spaths[this.hovSeg]) this.spaths[this.hovSeg].classList.remove('hov'); this.hovSeg = null; });
    svg.addEventListener('wheel', e => { e.preventDefault(); const [mx, my] = toVB(e); this.zoomAt(mx, my, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
    $$('.maptools button', this.host).forEach(b => b.onclick = () => { const z = b.dataset.z; if (z === 'in') this.zoomAt(this.W / 2, this.H / 2, 1.4); else if (z === 'out') this.zoomAt(this.W / 2, this.H / 2, 1 / 1.4); else this.reset(); });
  }
  setMode(m) { this.mode = m; this.gZ.style.display = m === 'zip' ? '' : 'none'; this.gPF.style.display = m === 'parish' ? '' : 'none'; }
  fill(fn) { this.setMode('zip'); Object.entries(this.paths).forEach(([zip, p]) => { const c = fn(zip); p.style.fill = c || cssv('--nodata'); }); }
  fillParish(fn) { this.setMode('parish'); Object.entries(this.ppaths).forEach(([f, p]) => { const c = fn(f); p.style.fill = c || cssv('--nodata'); }); }
  dim(set) { Object.entries(this.paths).forEach(([zip, p]) => p.classList.toggle('dim', !!set && !set.has(zip))); }
  dimParish(set) { Object.entries(this.ppaths).forEach(([f, p]) => p.classList.toggle('dim', !!set && !set.has(f))); }
  select(zip) { if (this.sel && this.paths[this.sel]) this.paths[this.sel].classList.remove('sel'); this.sel = zip; if (zip && this.paths[zip]) { this.paths[zip].classList.add('sel'); this.gZ.appendChild(this.paths[zip]); } }
  selectParish(f) { if (this.psel && this.ppaths[this.psel]) this.ppaths[this.psel].classList.remove('sel'); this.psel = f; if (f && this.ppaths[f]) { this.ppaths[f].classList.add('sel'); this.gPF.appendChild(this.ppaths[f]); } }
  /* track legs: fn(seg) -> {c: color, w: width} or null for the neutral track */
  roads(fn) { this.gR.style.display = ''; const hot = []; this.spaths.forEach((p, i) => { const s = SEGS[i]; const o = fn ? fn(s) : null; const h = this.hpaths[i]; if (o && o.hide) { p.style.display = 'none'; h.style.display = 'none'; return; } p.style.display = ''; h.style.display = ''; p.style.stroke = o && o.c ? o.c : ''; p.style.strokeWidth = o && o.w ? o.w : ''; p.classList.toggle('hot', !!(o && o.c)); if (o && o.c) hot.push([o.z || 0, p]); }); hot.sort((a, b) => a[0] - b[0]).forEach(([, p]) => this.gR.insertBefore(p, this.gRH)); }
  showRoads(on) { this.gR.style.display = on ? '' : 'none'; }
  selectSeg(i) { this.spaths.forEach((p, j) => p.classList.toggle('sel', j === i)); if (i != null && this.spaths[i]) this.gR.insertBefore(this.spaths[i], this.gRH); }
  fitSeg(i) { const s = SEGS[i]; if (!s) return; const bb = this.spaths[i].getBBox(); if (bb && bb.width + bb.height > 0) this.fitBox([bb.x, bb.x + bb.width], [bb.y, bb.y + bb.height], 140); else if (isN(s.lat)) this.fitLL([[s.lat, s.lon]]); }
  fitRoute(r) { const xs = [], ys = []; SEGS.forEach((s, i) => { if (s.r !== r) return; const bb = this.spaths[i].getBBox(); xs.push(bb.x, bb.x + bb.width); ys.push(bb.y, bb.y + bb.height); }); this.fitBox(xs, ys, 80); }
  pins(list) {
    this.gP.innerHTML = ''; this.pinsData = [];
    (list || []).forEach(p => { const [x, y] = proj(p.lon, p.lat); const g = svgEl('g', { 'data-pin': p.id }); let shape;
      if (p.shape === 'diamond') { const r = p.r; shape = svgEl('path', { d: `M0 ${-r * 1.35}L${r * 1.35} 0L0 ${r * 1.35}L${-r * 1.35} 0Z`, class: 'pin' + (p.sel ? ' sel' : ''), fill: p.fill, 'fill-opacity': p.op || .92 }); }
      else if (p.shape === 'square') { const r = p.r; shape = svgEl('rect', { x: -r, y: -r, width: 2 * r, height: 2 * r, rx: 1.5, class: 'pin' + (p.sel ? ' sel' : ''), fill: p.fill, 'fill-opacity': p.op || .92 }); }
      else shape = svgEl('circle', { r: p.r, class: 'pin' + (p.sel ? ' sel' : ''), fill: p.fill, 'fill-opacity': p.op || .85 });
      if (p.title) shape.appendChild(svgEl('title', {}, p.title));
      g.appendChild(shape); this.gP.appendChild(g); this.pinsData.push({ g, x, y }); });
    this.apply();
  }
  /* storm reports: list of {i, lat, lon, r, fill} drawn as dots that keep their screen size */
  points(list) {
    this.gT.innerHTML = ''; this.ptsData = [];
    const frag = document.createDocumentFragment();
    (list || []).forEach(p => { const [x, y] = proj(p.lon, p.lat); const c = svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: p.r, class: 'pt', fill: p.fill, 'fill-opacity': p.op || .8 }); c.dataset.pt = p.i; frag.appendChild(c); this.ptsData.push({ c, r: p.r }); });
    this.gT.appendChild(frag); this.apply();
  }
  setLabels(on) { this.o.labels = on; this.apply(); }
  setParishLabels(on) { this.o.parishLabels = on; this.apply(); }
}
function legendHTML(o) {
  const R = o.R || []; return `<div><div class="lt">${o.title}</div><div class="ramp">${R.map(c => `<i style="background:${c}"></i>`).join('')}</div><div class="rlabs"><span>${o.lo}</span><span>${o.hi}</span></div></div><div class="dn">${o.note || ''}</div>`;
}
const parishTip = (f, rows) => { const p = PAI[f]; if (!p) return ''; return `<div class="tt">${esc(p.name)} Parish</div><div class="ts">${esc(REGN[p.reg])} · ${N(p.hu)} homes · ${N(p.pop)} residents</div>${(rows || []).map(r => tipRow(r[0], r[1])).join('')}<div class="tf">Click for the parish ledger</div>`; };