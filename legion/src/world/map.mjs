// Legion · statewide map — PROVISIONAL STUB (the crowd/map owner replaces this file; same API).
// API: new MapView(container, {world, theme}); camera {x, y, zoom}; setTheme; flyTo(x, y, zoom, ms); fitState();
// screenToWorld(px, py); worldToScreen(x, y); on(event, fn) for 'move' | 'click' | 'hover'; addLayer(layer); resize(); destroy().
export class MapView {
  constructor(container, { world, theme = 'dark' } = {}) {
    this.world = world; this.container = container; this.theme = theme; this.handlers = {}; this.layers = [];
    this.canvas = document.createElement('canvas'); this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    container.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.camera = { x: world.proj.W / 2, y: world.proj.H / 2, zoom: 0.15 };
    this.resize(); this.fitState();
    this.canvas.addEventListener('click', e => { const r = this.canvas.getBoundingClientRect(); const p = this.screenToWorld(e.clientX - r.left, e.clientY - r.top); this.emit('click', { ...p, px: e.clientX - r.left, py: e.clientY - r.top }); });
  }
  on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); }
  emit(ev, d) { (this.handlers[ev] || []).forEach(f => f(d)); }
  setTheme(t) { this.theme = t; this.draw(); }
  resize() { const r = this.container.getBoundingClientRect(); this.canvas.width = Math.max(1, r.width); this.canvas.height = Math.max(1, r.height); this.draw(); }
  fitState() { const r = this.canvas; this.camera.zoom = Math.min(r.width / this.world.proj.W, r.height / this.world.proj.H) * 0.95; this.camera.x = this.world.proj.W / 2; this.camera.y = this.world.proj.H / 2; this.draw(); }
  flyTo(x, y, zoom) { this.camera = { x, y, zoom: zoom || this.camera.zoom }; this.draw(); this.emit('move', this.camera); }
  screenToWorld(px, py) { const c = this.camera; return { x: c.x + (px - this.canvas.width / 2) / c.zoom, y: c.y + (py - this.canvas.height / 2) / c.zoom }; }
  worldToScreen(x, y) { const c = this.camera; return { px: (x - c.x) * c.zoom + this.canvas.width / 2, py: (y - c.y) * c.zoom + this.canvas.height / 2 }; }
  addLayer(l) { this.layers.push(l); }
  draw() {
    const g = this.ctx; if (!g) return; g.fillStyle = this.theme === 'dark' ? '#121315' : '#f3f1ee'; g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.strokeStyle = '#888'; g.beginPath();
    for (const r of this.world.outlineRings()) { for (let i = 0; i < r.length; i += 2) { const p = this.worldToScreen(r[i], r[i + 1]); i ? g.lineTo(p.px, p.py) : g.moveTo(p.px, p.py); } g.closePath(); }
    g.stroke();
  }
  destroy() { this.canvas.remove(); }
}
