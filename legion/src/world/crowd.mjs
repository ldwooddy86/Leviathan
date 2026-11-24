// Legion · GPU crowd — PROVISIONAL STUB (the crowd/map owner replaces this file; same API).
// API: new Crowd(mapView, {world, population, rate, seed}); await build({rate, onProgress}) -> summary; setTime(t);
// setVisible(kinds); pick(x, y, radiusUnits) -> {id, mode, state} | null; stats(); destroy().
export class Crowd {
  constructor(mapView, { world, population, rate = 0.025, seed = 1 } = {}) { this.map = mapView; this.world = world; this.population = population; this.rate = rate; this.t = 0; }
  async build({ rate, onProgress } = {}) { if (rate) this.rate = rate; if (onProgress) onProgress(1); return { agents: 0, byMode: {} }; }
  setTime(t) { this.t = t; }
  setVisible() {}
  pick() { return null; }
  stats() { return { agents: 0, moving: {} }; }
  destroy() {}
}
