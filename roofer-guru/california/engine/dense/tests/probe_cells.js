async () => {
  /* What the cells hold and what they cost to build: per cell, triangles and bytes of its meshes (from the scene);
     then every cell is rebuilt once (the roof kit switched off and on) with K.addBuilding and the update timed. */
  const en = MODI.rooftops.api.en(), E = en.engine, S = E.scene, K = en.kit;
  const say = (...a) => console.log('[dense] ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
  const nap = ms => new Promise(r => setTimeout(r, ms));
  const bytesOf = m => { let b = m.vcount * 12; if (m.has.normal) b += m.vcount * 12; if (m.has.uv) b += m.vcount * 8; if (m.has.color) b += m.vcount * 4; if (m.has.aux) b += m.vcount * 16; if (m.indexed) b += m.count * (m.isize || 2); return b; };
  const measure = () => {
    const cells = [], seen = new Set(); let allT = 0, allB = 0;
    for (const e of S.entities.values()) if (/^Cell /.test(e.name)) {
      let tris = 0, bytes = 0, meshes = 0, inst = 0;
      e.traverse(x => x.components.forEach(c => { const m = c.mesh; if (!m || !m.vcount) return; if (c.buffer || c.instances) { inst += (c.buffer && c.buffer.n) || 0; return; } if (seen.has(m.id)) return; seen.add(m.id); tris += m.tris; bytes += bytesOf(m); meshes++; }));
      cells.push({ key: e.name.slice(5), tris: Math.round(tris), bytes, meshes, inst }); allT += tris; allB += bytes;
    }
    cells.sort((a, b) => b.tris - a.tris);
    /* everything else in the scene (far tiles, the wider city, the skyline, streets) */
    let oT = 0, oB = 0; const names = {};
    for (const e of S.entities.values()) e.components.forEach(c => { const m = c.mesh; if (!m || !m.vcount || seen.has(m.id) || c.buffer) return; seen.add(m.id); oT += m.tris; oB += bytesOf(m); const k = e.name.replace(/[ -]?[0-9/._-]+.*$/, '').slice(0, 26); names[k] = (names[k] || 0) + Math.round(m.tris); });
    return { n: cells.length, tris: Math.round(allT), bytes: allB, top: cells.slice(0, 3), otherTris: Math.round(oT), otherBytes: oB, other: Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 6) };
  };
  const heap = () => Math.round(performance.memory.usedJSHeapSize / 1048576);
  const before = measure(); say('cells as built', before, 'heap MB', heap());
  /* rebuild with timing */
  const add0 = K.addBuilding, emit0 = E.emit; const B = [], U = [];
  K.addBuilding = function (Bd, b, o) { const t = performance.now(); const g = add0.apply(this, arguments); B.push([Math.round((performance.now() - t) * 10) / 10, b && b.id, g && Math.round(g.h || 0)]); return g; };
  E.emit = function (ev) { if (ev !== 'update') return emit0.apply(this, arguments); const t = performance.now(); const r = emit0.apply(this, arguments); const d = performance.now() - t; if (d > 2) U.push(Math.round(d * 10) / 10); return r; };
  const settle = async () => { const t0 = performance.now(); await nap(400); while (performance.now() - t0 < 60000) { const st = en.state(); if (!st.queued) { await nap(600); if (!en.state().queued) break; } await nap(200); } return Math.round(performance.now() - t0); };
  en.setGraphics({ roofKit: false }); await settle(); B.length = 0; U.length = 0;
  en.setGraphics({ roofKit: true }); const took = await settle();
  K.addBuilding = add0; E.emit = emit0;
  B.sort((a, b) => b[0] - a[0]); U.sort((a, b) => b - a);
  const r = { rebuildWallMs: took, buildings: B.length, buildMsTotal: Math.round(B.reduce((a, x) => a + x[0], 0)), slowestBuildings: B.slice(0, 4), longestUpdatesMs: U.slice(0, 5), updatesOver2ms: U.length, heapMB: heap(), pacing: E.pacing ? E.pacing() : null };
  say('rebuild', r); const after = measure(); say('cells after rebuild', { n: after.n, tris: after.tris, bytes: after.bytes, top: after.top.slice(0, 1) });
  return { before, r };
}
