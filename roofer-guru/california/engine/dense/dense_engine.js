    /* Pacing: a frame is not started while the graphics side still has frames of this engine to draw.
       The draw calls of a frame return at once; the drawing happens later, in the browser's GPU process. A browser
       holds requestAnimationFrame back when the card falls behind, but not always: headless Chromium on its software
       renderer does not, and there every turn of the loop handed over another frame. Measured at 200 N Spring St, Los
       Angeles, on that renderer, a frame costing 1.3 s to draw: 236 frames handed over in 26 s, 317 s of drawing
       queued, and the page frozen for all of it the first time anything waited for the picture (the watch below, a
       screenshot, the tab being shown). So after each frame a fence is left behind it, and the next frame is drawn only
       when the fence has been reached. Two frames may be on their way on a card that draws one in under 100 ms (one
       would halve the rate of a card that needs 20 ms); one on anything slower. While a frame is held the world still
       moves: input, physics, traffic and the camera are stepped every turn as before; only the drawing waits.
       If no fence is ever reached (a driver that does not report them) the gate takes itself out after 40 s. */
    _held(now) {
      const G = this._gate || (this._gate = { q: [], ms: 0, since: 0, held: 0, drawn: 0, ok: 0, valve: 0, off: false, dt: 0, last: 0, wait: false, longest: 0 });
      const gl = this.device.gl, q = G.q, t = performance.now(); if (G.off || this.device.lost || !gl.fenceSync) return false;
      while (q.length) {
        let st; try { st = gl.clientWaitSync(q[0].s, 0, 0); } catch (e) { st = gl.WAIT_FAILED; } if (st === gl.TIMEOUT_EXPIRED) { q[0].seen = true; break; }
        const f = q.shift(); try { gl.deleteSync(f.s); } catch (e) {} if (st === gl.WAIT_FAILED) continue;
        const ms = f.seen ? t - f.t : Math.min(t - f.t, 34); G.ms = G.ms ? G.ms * 0.7 + ms * 0.3 : ms; G.ok++;   /* reached at the first look: it may have lain there while the engine rested, so it is not counted as slow */
      }
      if (q.length < (G.ms > 100 ? 1 : 2)) { G.since = 0; return false; }
      if (!G.since) G.since = t; G.longest = Math.max(G.longest, t - G.since);
      if (t - G.since > 20000) { G.since = t; G.valve++; if (!G.ok && G.valve >= 2) { G.off = true; q.forEach(f => { try { gl.deleteSync(f.s); } catch (e) {} }); q.length = 0; } return false; }   /* held 20 s: one frame is let through all the same */
      G.held++; G.wait = true; return true;
    }
    /* after a frame's draw calls: leave the fence, and note the true time between drawn frames (0 when nothing was held:
       then the loop's own dt is the true one). A renderer that needs over a quarter of a second for a frame is not asked
       for the 56 frames that let a still view gather: 16 are drawn and it rests (the number is a choice). */
    _fence() {
      const G = this._gate; if (!G || G.off || this.device.lost) return; const gl = this.device.gl, t = performance.now();
      try { const s = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); if (s) { G.q.push({ s, t, seen: false }); gl.flush(); } } catch (e) {}
      G.dt = G.wait && G.last ? Math.min(4, Math.max(0.0001, (t - G.last) / 1000)) : 0; G.wait = false; G.last = t; G.drawn++;
      if (G.ms > 250 && this._settle > 16) this._settle = 16;
    }
    /* for tests and the status line: how the drawing is paced */
    pacing() { const G = this._gate; return G ? { inFlight: G.q.length, frameMs: Math.round(G.ms), allowed: G.ms > 100 ? 1 : 2, held: G.held, drawn: G.drawn, longestHoldMs: Math.round(G.longest), let: G.valve, off: G.off } : null; }
    /* The watch's nine points, read without waiting: they are copied into a small buffer on the card and a fence is
       left; the answer is fetched on a later frame, when the fence has been reached. (Reading them straight back made
       the page wait for every frame still queued: 47.8 s in one call, measured as above.) False if it cannot be set up. */
    _watchAsk(W, w, h) {
      const gl = this.device.gl; if (!gl.fenceSync || !gl.getBufferSubData) return false;
      try {
        const b = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, b); gl.bufferData(gl.PIXEL_PACK_BUFFER, 36, gl.STREAM_READ);
        for (let i = 0; i < 9; i++) gl.readPixels(Math.floor(w * (0.1 + 0.4 * (i % 3))), Math.floor(h * (0.1 + 0.4 * Math.floor(i / 3))), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, i * 4);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); const s = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); if (!s) { gl.deleteBuffer(b); return false; }
        W.pend = { b, s, t: performance.now() }; return true;
      } catch (e) { try { gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); } catch (x) {} return false; }
    }
    /* null: not drawn yet. true: something is lit (or the answer was lost with the context). false: all nine are black. */
    _watchRead(W) {
      const gl = this.device.gl, p = W.pend; let st; try { st = gl.clientWaitSync(p.s, 0, 0); } catch (e) { st = gl.WAIT_FAILED; }
      if (st === gl.TIMEOUT_EXPIRED && performance.now() - p.t < 60000) return null;
      W.pend = null; let lit = true;
      try { if (st === gl.ALREADY_SIGNALED || st === gl.CONDITION_SATISFIED) { const px = new Uint8Array(36); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, p.b); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, px); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); lit = false; for (let i = 0; i < 36; i++) if (i % 4 !== 3 && px[i] > 0) lit = true; }
        gl.deleteSync(p.s); gl.deleteBuffer(p.b); } catch (e) { lit = true; }
      return lit;
    }
    /* the context was taken away or given back: what was left on the card is gone with it */
    _ctxGone() { const G = this._gate; if (G) { G.q.length = 0; G.since = 0; } if (this._watchS) this._watchS.pend = null; }
