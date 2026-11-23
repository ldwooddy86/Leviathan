      /* ---------- the engine's weather, vehicles and air traffic: asked for only where the engine in the page has them ---------- */
      /* California's engine carries a rain scale (dry, light rain, rain, a thunderstorm, atmospheric rivers of rank 1 to
         5), a dry wind scale (calm, a breeze, four steps of offshore wind), sky states (marine layer, tule fog, wildfire
         smoke), a car to drive (mode m3), air traffic, and the ground's height. Each is looked for before it is used, so
         the bar draws what the engine in the page can do and nothing else. An engine without the rain scale's
         atmospheric river steps draws them as its heaviest plain rain; the roof readings use the step chosen either way. */
      const NOFLY = "Don't waste a $40,000 drone, stupid. Use the UAPs.";
      const OLD_STEP = { dry: 0, light: 1, rain: 2, tstorm: 3, ar1: 2, ar2: 2, ar3: 2, ar4: 2, ar5: 2 };
      function enHas() {
        const g = en && en.graphics ? en.graphics() : null, wx = !!(en && (typeof en.wind === 'function' || (g && 'skyState' in g)));
        return { wx, air: !!(g && 'air' in g), m3: !!(en && en.car), elev: wx || !!(en && en.state && en.state() && 'elev' in en.state()) };
      }
      const idAt = (list, v) => (typeof v === 'string' ? (list.find(x => x.id === v) || {}).id : isN(v) && list[v] ? list[v].id : v && typeof v === 'object' && v.id ? (list.find(x => x.id === v.id) || {}).id : null) || null;
      const SKY_IDS = WX_SKY.map(x => ({ id: x[0] }));
      /* what the engine says its scales stand at, kept for the roof readings (WXNOW) */
      function wxSync() {
        if (!en) return WXNOW; const H = enHas(), g = en.graphics() || {}, st = en.state() || {}; WXNOW.engine = H.wx;
        if (H.wx) { WXNOW.rain = idAt(WX_RAIN, st.stormKey) || idAt(WX_RAIN, g.storm) || WXNOW.rain; WXNOW.wind = idAt(WX_WIND, st.windKey) || idAt(WX_WIND, g.wind) || WXNOW.wind; WXNOW.sky = idAt(SKY_IDS, g.skyState) || idAt(SKY_IDS, st.sky) || WXNOW.sky; }
        const el = isN(st.elevationM) ? +st.elevationM : isN(st.elev) ? +st.elev : isN(g.elevation) ? +g.elevation : null; WXNOW.elev = el;
        if (isN(en.lensPatterns)) ENGX.pat = +en.lensPatterns;
        return WXNOW;
      }
      const lensAgain = () => { try { if (en && en.lensRefresh) en.lensRefresh(); } catch (e) { /* the next frame reads it */ } };
      function setRain(id) { if (!WX_RAIN.some(x => x.id === id)) return; WXNOW.rain = id; if (en) { try { if (enHas().wx) { if (typeof en.storm === 'function') en.storm(id); else en.setGraphics({ storm: id }); } else en.setGraphics({ storm: OLD_STEP[id] || 0 }); } catch (e) { /* the readings still use the step */ } } wxSync(); WXNOW.rain = enHas().wx ? WXNOW.rain : id; lensAgain(); }
      function setWind(id) { if (!WX_WIND.some(x => x.id === id)) return; WXNOW.wind = id; if (en && enHas().wx) { try { if (typeof en.wind === 'function') en.wind(id); else en.setGraphics({ wind: id }); } catch (e) { /* fine */ } wxSync(); } lensAgain(); }
      function setSky(id) { if (!WX_SKY.some(x => x[0] === id)) return; WXNOW.sky = id; if (en && enHas().wx) { try { en.setGraphics({ skyState: id }); } catch (e) { /* fine */ } wxSync(); } lensAgain(); }
      /* may the Alta X fly in this: the engine's own word where it gives one, else dry or light rain only */
      const altaFly = () => { const st = en ? en.state() : null, g = en ? en.graphics() : null; if (st && typeof st.altaCanFly === 'boolean') return st.altaCanFly; if (enHas().wx && g && g.stormInfo && typeof g.stormInfo.fly === 'boolean') return g.stormInfo.fly; return WXNOW.rain === 'dry' || WXNOW.rain === 'light'; };
      /* the weather in force, in a line */
      function wxLine() {
        const wx = wxResolve({}), st = en ? en.state() || {} : {}, H = enHas(), bits = [`<b>${esc(wxTitle(wx))}</b>`];
        const gust = H.wx && isN(st.gustMph) ? +st.gustMph : wx.gust; if (gust >= 15) bits.push(`gusts near ${Math.round(gust)} mph`);
        if (H.wx && isN(st.rainMmH) && +st.rainMmH > 0) bits.push(`${st.precip === 'snow' ? 'snow' : 'rain'} drawn at ${D(+st.rainMmH, +st.rainMmH < 10 ? 1 : 0)} mm an hour`);
        const sl = H.wx && isN(st.snowLevelM) ? +st.snowLevelM : wx.rain.id !== 'dry' ? wx.snowM : null; if (sl) bits.push(`snow above about ${N(Math.round(sl * 3.281 / 100) * 100)} ft`);
        if (WXNOW.elev != null) bits.push(`the ground here is ${N(Math.round(WXNOW.elev * 3.281 / 10) * 10)} ft above the sea`);
        if (H.wx && isN(st.visKm) && +st.visKm < 15) bits.push(`you can see about ${D(+st.visKm * 0.621, 1)} miles`);
        if (!H.wx && /^ar/.test(wx.rain.id)) bits.push('this engine draws an atmospheric river as heavy rain; the roof readings use the rank chosen');
        if (wx.rain.id === 'dry' && wx.wind.id === 'calm' && wx.sky === 'none') return '<b>Dry and calm</b> · the sky is the Scene menu\'s. Slide the rain scale for rain and atmospheric rivers' + (H.wx ? ', the wind scale for Santa Ana and Diablo wind, or pick a sky' : '') + '.';
        return bits.join(' · ');
      }
