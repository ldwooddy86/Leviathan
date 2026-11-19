      /* ---------- the Scout Engine: the same neighborhood drawn by the engine written for this page ---------- */
      /* engine.js (window.__SCOUT_ENGINE__) is a renderer of its own on WebGL2: a deferred, physically based pipeline with
         a physical sky, cascaded sun shadows, bounced light and reflections traced on screen, temporal anti-aliasing, and
         around it physics, particles, an editor. window.__SCOUT_E3D__ builds the neighborhood with it from the same data the
         three.js view reads (env3d), streamed cell by cell round the camera. Like that view it draws Esri imagery, so it takes
         the card's place and never shares the screen with Google's photographs. What it adds to the record is said in the
         view: window grids, cars, signals, sidewalks and rooftop equipment are generated, not observed. Its roof views are
         this module's own readings laid on the roofs (LENS, above): the heat a roof takes in the sun, the wear the weather
         has put on it, and the damage it is most likely to take over the next fifteen years. */
      const enw = $('#scEnW', root), enBar = $('#scEnBar', root), enHost = $('#scEn', root);
      const EN_NOTE = 'The neighborhood in the Scout Engine: every building the dashboard holds on its FEMA footprint at its recorded height (a usual one for its kind where none is on file) under a physical sky, the city going on to the skyline, the streets alive. Walk, fly an Alta X or circle a building. The roof views read each roof three ways: its heat in the sun (Thermal), the wear the weather has put on it so far (Wear) and the damage it is most likely to take over the next 15 years (Time). Window grids, cars, signals, sidewalks and rooftop equipment are generated, not observed; the roof views are a model, not an inspection.';
      /* a roof's heat, once the engine has read its planes, goes into the card's outlook too */
      const heatSoon = debounce(() => { if (sel && sel.type === 'b') outlookRedraw(B.get(sel.id)); }, 700);
      LENS.onHeat = b => { if (sel && sel.type === 'b' && sel.id === b.id) heatSoon(); };
      const envEn = Object.assign({}, env3d, {
        onPick: b => { hideTip(); pick(b.id, { noSV: true }); }, onFront: b => { hideTip(); pick(b.id); },
        onMove: st => { enSt = st; whereEnSoon(); }, onNote: t => { const n = $('#scEnNote', root); if (n) n.textContent = t || ''; }, onGraphics: () => renderEnBar(),
        label: b => `${STS[b.status]} · ${b.sc.score}`,
        /* every building the dashboard holds, whatever its filters show: the world is the city, the filters are a reading of it */
        buildings: () => { const out = []; B.forEach(b => { if (b.sc) out.push(b); }); return out; },
        color: b => (shown(b) ? COL[b.status] : '#9aa3a8'), shown: b => shown(b),
        /* the roof views: what each roof reads, plane by plane (LENS) */
        lens: LENS,
        /* the wider city, a square of the map at a time. Two public records are merged, because neither is the satellite
           picture's age: FEMA's USA Structures (in Louisiana traced mostly from lidar of 2008 to 2012 and later imagery; it
           has heights and uses) and OpenStreetMap's buildings as they stand today (Esri's hosted copy). FEMA's footprints are
           the base. An OpenStreetMap building that stands where FEMA has none is added (built since, or missed). One that
           is newer than FEMA's picture and much larger than the FEMA footprints under it replaces them (a block cleared
           and rebuilt). Where FEMA has no height, OpenStreetMap's height or floor count is used. minH asks FEMA alone for
           the tall ones, for the skyline. */
        context: async (box, o) => {
          const ask = async (url, extra, bx, depth) => { const j = await getJSON(url + '?' + qs(Object.assign({ geometry: env(bx), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outSR: 4326, geometryPrecision: 5, maxAllowableOffset: 0.000008, f: 'geojson' }, extra)), { timeout: 45000 });
            if (j.properties && j.properties.exceededTransferLimit && depth < 2) { const mx = (bx.w + bx.e) / 2, my = (bx.s + bx.n) / 2; return (await Promise.all([{ w: bx.w, e: mx, s: bx.s, n: my }, { w: mx, e: bx.e, s: bx.s, n: my }, { w: bx.w, e: mx, s: my, n: bx.n }, { w: mx, e: bx.e, s: my, n: bx.n }].map(x => ask(url, extra, x, depth + 1)))).flat(); }
            return j.features || []; };
          const ringOf = g => (!g ? null : g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null);
          const shape = rr => { let a = 0, cx = 0, cy = 0; const k = Math.cos(rad(rr[0][0])); for (let i = 0, n = rr.length; i < n; i++) { const p = rr[i], q = rr[(i + 1) % n], f = (p[1] * q[0] - q[1] * p[0]) * k; a += f; cx += (p[1] + q[1]) * f; cy += (p[0] + q[0]) * f; } a /= 2; return Math.abs(a) < 1e-14 ? null : { la: cy / (6 * a), lo: cx / (6 * a), m2: Math.abs(a) * 111320 * 110900 }; };
          const inRing = (la, lo, rr) => { let c = false; for (let i = 0, j = rr.length - 1; i < rr.length; j = i++) { const p = rr[i], q = rr[j]; if ((p[0] > la) !== (q[0] > la) && lo < (q[1] - p[1]) * (la - p[0]) / (q[0] - p[0]) + p[1]) c = !c; } return c; };
          const seen = new Set(), out = [], tall = !!(o && o.minH);
          const fema = await ask(EP.bldg, { where: tall ? 'HEIGHT > ' + (+o.minH) : '1=1', outFields: tall ? 'OCC_CLS,PRIM_OCC,HEIGHT,SQFEET,LATITUDE,LONGITUDE' : 'OCC_CLS,PRIM_OCC,HEIGHT,SQFEET,LATITUDE,LONGITUDE,IMAGE_DATE' }, box, 0);
          fema.forEach(f => { const p = f.properties || {}, ring = ringOf(f.geometry); if (!ring || ring.length < 4) return;
            const rr = ring.map(([x, y]) => [y, x]), bb = bboxOf([rr]); let la = +p.LATITUDE, lo = +p.LONGITUDE; if (!isN(la) || !isN(lo) || !inBox(la, lo, [bb[0] - 0.001, bb[1] - 0.001, bb[2] + 0.001, bb[3] + 0.001])) { la = (bb[0] + bb[2]) / 2; lo = (bb[1] + bb[3]) / 2; }
            const id = 'x' + la.toFixed(6) + lo.toFixed(6); if (seen.has(id)) return; seen.add(id); const cls = classify(p), sh = shape(rr);
            out.push({ id, la, lo, ring: rr, bb, cls, h: hOf({ h: +p.HEIGHT || 0, cls }), hKnown: +p.HEIGHT > 2.2, m2: sh ? sh.m2 : 0, yr: p.IMAGE_DATE ? new Date(+p.IMAGE_DATE).getUTCFullYear() : 0, src: 'fema' }); });
          if (tall) return out;
          let osm = []; try { osm = await ask(EP.osmBldg, { where: '1=1', outFields: 'osm_id,osm_timestamp,building,height,building_levels,levels,amenity,shop,office,tourism' }, box, 0); } catch (e) { osm = []; out.osmFailed = true; }
          /* FEMA's footprints on a coarse grid, so each OpenStreetMap building looks only at its neighbours */
          const G = new Map(), cell = 0.0006; out.forEach(f => { for (let a = Math.floor(f.bb[0] / cell); a <= Math.floor(f.bb[2] / cell); a++) for (let b2 = Math.floor(f.bb[1] / cell); b2 <= Math.floor(f.bb[3] / cell); b2++) { const k = a + ':' + b2; let l = G.get(k); if (!l) G.set(k, l = []); l.push(f); } });
          const osmCls = p => { const b2 = String(p.building || '').toLowerCase(); if (p.tourism === 'hotel' || b2 === 'hotel') return 'hotel'; if (/^(apartments|residential|dormitory)$/.test(b2)) return 'mf'; if (/^(house|detached|semidetached_house|terrace|bungalow|cabin)$/.test(b2)) return 'sf'; if (/^(garage|garages|carport)$/.test(b2)) return 'garage'; if (/^(shed|hut|roof)$/.test(b2)) return 'shed';
            if (/^(warehouse|industrial|hangar)$/.test(b2)) return 'whse'; if (/^(parking)$/.test(b2) || p.amenity === 'parking') return 'parking'; if (/^(retail|supermarket|kiosk)$/.test(b2) || p.shop) return 'retail'; return 'unk'; };
          const osmH = p => { const m = /^\s*([0-9.]+)\s*(m|ft|')?/i.exec(String(p.height == null ? '' : p.height)); if (m && +m[1] > 0) return +m[1] * (m[2] && m[2] !== 'm' ? 0.3048 : 1); const lv = parseFloat(p.building_levels != null ? p.building_levels : p.levels); return lv > 0 && lv < 200 ? lv * 3.5 + 1 : 0; };
          const dropped = new Set(); let added = 0, replaced = 0, heights = 0;
          osm.forEach(f => { const p = f.properties || {}, ring = ringOf(f.geometry); if (!ring || ring.length < 4) return; const b2 = String(p.building || '').toLowerCase(); if (!b2 || b2 === 'no' || b2 === 'construction' || b2 === 'proposed' || b2 === 'ruins') return;
            const rr = ring.map(([x, y]) => [y, x]), sh = shape(rr); if (!sh || sh.m2 < 12) return; const bb = bboxOf([rr]), near = new Set(); for (let a = Math.floor(bb[0] / cell); a <= Math.floor(bb[2] / cell); a++) for (let c2 = Math.floor(bb[1] / cell); c2 <= Math.floor(bb[3] / cell); c2++) (G.get(a + ':' + c2) || []).forEach(x => near.add(x));
            const under = [...near].filter(x => !dropped.has(x) && (inRing(x.la, x.lo, rr) || inRing(sh.la, sh.lo, x.ring))), oh = osmH(p), ts = p.osm_timestamp, yr = typeof ts === 'number' ? new Date(ts).getUTCFullYear() : parseInt(String(ts || '').slice(-4), 10) || parseInt(String(ts || '').slice(0, 4), 10) || 0;
            if (under.length) { const fa = under.reduce((t, x) => t + x.m2, 0), newer = under.every(x => x.yr && yr >= x.yr + 1);
              if (newer && sh.m2 > 1.5 * fa && sh.m2 > 300) { under.forEach(x => dropped.add(x)); replaced++; }
              else { if (oh > 2.2) under.forEach(x => { if (!x.hKnown && under.length === 1) { x.h = oh; x.hKnown = true; heights++; } }); return; } }
            const cls = osmCls(p), id = 'o' + (p.osm_id != null ? p.osm_id : sh.la.toFixed(6) + sh.lo.toFixed(6)); if (seen.has(id)) return; seen.add(id); added++;
            out.push({ id, la: sh.la, lo: sh.lo, ring: rr, bb, cls, h: oh > 2.2 ? oh : hOf({ h: 0, cls }), hKnown: oh > 2.2, m2: sh.m2, yr, src: 'osm' }); });
          const list = out.filter(f => !dropped.has(f)); list.dropped = [...dropped].map(f => [f.la, f.lo]); list.stats = { fema: fema.length, osm: osm.length, added, replaced, heights, osmFailed: !!out.osmFailed }; return list; },
      });
      const refreshEn = debounce(() => { if (en && enMode) en.refresh(); }, 350);
      async function openEngine(target) {
        if (!target) return;
        if (!en && !window.__SCOUT_E3D__ && document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
        if (!en) { en = window.__SCOUT_E3D__ ? window.__SCOUT_E3D__(enHost, envEn) : null; if (!en) { toast('This browser cannot run the Scout Engine (it needs WebGL2 with floating point targets). The 3D street view and Google photos still work.'); return; } }
        enTarget = target; if (viewMode === 'map') { viewBounds = map.getBounds(); svList = svListNow(); }
        if (!enMode) setMode('eng');
        renderEnBar();
        let v; try { v = await aim(target); } catch (e) { v = { lat: target.lat, lon: target.lon, heading: 0 }; }
        if (!enMode || enTarget !== target) return;
        await en.open(v.lat, v.lon, target.b ? null : v.heading, { cur: target.b ? target.b.id : null, face: target.b || null });
        renderEnBar(); try { en.canvas.focus({ preventScroll: true }); } catch (e) { /* fine */ }
      }
      function whereEn(st) {
        if (!st) return ''; const g = en ? en.graphics() : null;
        const kind = { major: 'main road', alley: 'alley', service: 'service drive' }[st.roadKind] || '';
        const on = st.mode === 'street' ? (st.road ? `On ${esc(st.road)}${kind ? ' (' + kind + ')' : ''}` : kind ? 'On a ' + kind : 'At street level') : st.mode === 'walk' ? 'On foot (walls stop you; Space jumps, Shift runs)' : st.mode === 'drone' ? 'At drone height, 38 m up' : st.mode === 'bird' ? 'At bird height, 120 m up' : st.mode === 'metro' ? 'High over the city, 1,400 m up' : st.mode === 'alta' ? `Flying the Alta X${st.alta ? ' (' + esc(st.alta.mode.toLowerCase()) + ', ' + N(Math.round(st.alta.alt)) + ' m up, batteries ' + N(Math.round(st.alta.battery * 100)) + '%)' : ''}` : 'Circling';
        const keys = st.mode === 'alta' ? 'Drag to look round it; <b>W</b> <b>S</b> <b>A</b> <b>D</b> fly, <b>←</b> <b>→</b> turn, <b>↑</b> <b>↓</b> climb and descend, <b>C</b> its camera, <b>X</b> the roof views, <b>H</b> home, <b>L</b> land; click the ground to send it there, double click a building to hover off its face.' : 'Drag to look; <b>W</b> <b>S</b> move, <b>A</b> <b>D</b> turn, <b>Q</b> <b>E</b> rise and come down, <b>X</b> the roof views, <b>[</b> <b>]</b> the year; click the ground to go there, a building to read it.';
        return `${on}, looking ${compass(st.yaw)} · <b>${N(st.built)}</b> buildings${st.queued ? ', ' + N(st.queued) + ' cells still building' : ''}${st.roads ? '' : ' · the streets are still loading'}${g && g.lens !== 'off' ? ` · ${N(g.lensN)} roofs read in the ${esc(LENS.names[g.lens] || g.lens).toLowerCase()} view${g.lensPending ? ', ' + N(g.lensPending) + ' to go' : ''}` : ''}${g ? ` · <span class="sc-enfps">${N(g.fps)} frames a second, ${N(g.tris)} triangles</span>` : ''}${g && g.broken ? ` · <b>the engine cannot draw with this graphics driver: ${esc(g.broken)}</b>` : ''}${g && g.refused && g.refused.length ? ` · this graphics driver refused ${esc(g.refused.join(', '))}; switched off` : ''}${g && g.wide && g.wideN ? ` · the wider city: ${N(g.wideN)} buildings${g.wideOsm ? ' (' + N(g.wideOsm) + ' of them newer than FEMA\'s file, from OpenStreetMap' + (g.wideReplaced ? '; ' + N(g.wideReplaced) + ' cleared footprints left out' : '') + ')' : ''}${g.widePending ? ', more coming' : ''}${g.skyline ? ', ' + N(g.skyline) + ' towers to the horizon' : ''}` : ''}. ${keys}`;
      }
      const whereEnSoon = debounce(() => { const w = $('#scEnWhere', root); const stNow = (en && en.state()) || enSt; if (w && enMode) w.innerHTML = whereEn(stNow); if (en && stNow) { $$('#scEnBar [data-h]', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.h === stNow.mode))); $$('#scEnPad .sc-enalt', root).forEach(x => { x.hidden = stNow.mode !== 'alta'; }); } }, 120);
      let enGfxOpen = false, enPlayT = 0;
      const enLon = () => (enSt && isN(enSt.lon) ? enSt.lon : enTarget && isN(enTarget.lon) ? enTarget.lon : -91.5);
      const hourOf = g => { const t = g && g.sunTime ? new Date(g.sunTime.getTime() + (enLon() / 15) * 3600e3) : null; return t ? t.getUTCHours() + t.getUTCMinutes() / 60 : 15; }, hhmm = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;
      const yearText = y => (y ? `${THIS_YEAR + y} · in ${y} year${y === 1 ? '' : 's'}` : `${THIS_YEAR} · today`);
      function enMenu() {
        const g = en ? en.graphics() : null; if (!g) return '';
        const seg = (name, cur, opts) => `<span class="seg" role="group" aria-label="${name}">${opts.map(([k, l]) => `<button type="button" data-eg="${name}:${k}" aria-pressed="${String(cur) === String(k)}">${l}</button>`).join('')}</span>`, h = hourOf(g);
        return `<details class="sc-gfx" id="scEnGfx"${enGfxOpen ? ' open' : ''}><summary class="ibtn" title="Quality, the day and hour, the weather, what shows">Scene: ${esc(g.label)}${g.q === 'auto' ? ' (auto)' : ''}</summary><div class="sc-gfxp">
            <div class="sc-gfxr"><span class="mini">Quality</span>${seg('q', g.q, [['auto', 'Auto'], ['ultra', 'Ultra'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']])}</div>
            <div class="sc-gfxr"><span class="mini">Day</span>${seg('day', g.day, [['today', 'Today'], ['summer', 'July 21'], ['fall', 'October 21'], ['winter', 'January 21'], ['spring', 'April 21']])}</div>
            <div class="sc-gfxr"><span class="mini">Sun</span>${seg('sun', g.sun, [['morning', 'Morning'], ['midday', 'Midday'], ['afternoon', 'Afternoon'], ['evening', 'Evening'], ['night', 'Night'], ['now', 'Now']])}</div>
            <div class="sc-gfxr"><span class="mini">Hour</span><span class="sc-enhour"><input type="range" id="scEnHour" min="0" max="24" step="0.25" value="${h.toFixed(2)}" aria-label="Hour of the day"><output id="scEnHourO">${hhmm(h)}</output></span></div>
            <div class="sc-gfxr"><span class="mini">Weather</span>${seg('weather', g.weather, [['clear', 'Clear'], ['cloudy', 'Cloudy'], ['overcast', 'Overcast'], ['rain', 'Rain'], ['haze', 'Haze']])}</div>
            <div class="sc-gfxr"><span class="mini">Readings</span>${seg('glow', g.glow, [['outline', 'Outline'], ['glow', 'Glow'], ['off', 'Off']])}</div>
            <div class="sc-gfxr"><span class="mini">Streets</span>${seg('life', g.life ? 'on' : 'off', [['on', 'Traffic and furniture'], ['off', 'Bare']])}</div>
            <div class="sc-gfxr"><span class="mini">Trees</span>${seg('trees', g.trees ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}<span class="mini">Motion</span>${seg('live', g.live ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}</div>
            <div class="sc-gfxr"><span class="mini">Wider city</span>${seg('wide', g.wide ? 'on' : 'off', [['on', 'To the skyline'], ['off', 'Near only']])}<span class="mini">Equipment</span>${seg('roofKit', g.roofKit ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}</div>
            <p class="mini">Ultra and High: sun shadows in four cascades, bounced light and ambient occlusion, reflections on glass and wet pavement, bloom. Medium drops the bounced light and reflections and draws fewer pixels, filling them in over time. Low is for machines without a graphics card. Auto picks one (${esc(g.tier)} here) and steps down if frames run long. The sun and moon stand where they do over this street on the chosen day at that hour; after dark the lamps, windows and headlights light the scene.${g.sunNote ? ' ' + esc(g.sunNote) : ''} The day and hour also set the Thermal roof view: the same sun heats the roofs. Buildings stand on their FEMA footprints at their recorded heights with Esri's imagery on their roofs; window grids and rooms, cars, signals, crosswalks and sidewalks are generated from the building's kind and the street map, and are not observed. The wider city is FEMA's footprints, with OpenStreetMap's where it has newer ones, for a few kilometres round as plain blocks with generated windows, and every building over 30 m out to about 18 km as the skyline. Rooftop units, condensers and cooling towers are the equipment a building of that kind, size and height most likely carries, placed by rule: a model, not a survey. Traffic obeys a car-following law, signals and stop signs, and no two cars may occupy the same ground. This machine draws with ${esc(g.gpu || 'an unnamed graphics device')}${g.refused && g.refused.length ? '; its driver refused ' + esc(g.refused.join(', ')) + ', which is switched off' : ''}.</p>
          </div></details>`;
      }
      function enPlay(on) {
        clearInterval(enPlayT); enPlayT = 0; if (!on || !en) return; let since = 0;
        /* a year stays a second and a half at least, and until the roofs in view show it (seven seconds at most, on a slow machine); Play stops when the view is not on screen */
        enPlayT = setInterval(() => { const g = en && enMode && enHost.clientWidth ? en.graphics() : null; if (!g || g.lens !== 'time') { enPlay(false); renderEnBar(); return; }
          since++; if (since < 3 || (g.lensPending > 0 && since < 14)) return; since = 0;
          const y = (g.year + 1) % (LENS.YEARS + 1); en.setGraphics({ year: y }); const r = $('#scEnYear', enBar), o = $('#scEnYearO', enBar); if (r) r.value = y; if (o) o.textContent = yearText(y); }, 500);
      }
      function renderEnBar() {
        const t = enTarget; if (!t) { enBar.innerHTML = ''; return; } const b = t.b ? (B.get(t.b.id) || t.b) : null, st = en ? en.state() : null, mode = st ? st.mode : 'street', ed = !!(en && en.editing), gNow = en ? en.graphics() : null, lens = gNow ? gNow.lens : 'off';
        if (b && !svList.includes(b.id)) { svList = svListNow(); if (!svList.includes(b.id)) svList.unshift(b.id); }
        const i = b ? svList.indexOf(b.id) : -1;
        enBar.innerHTML = `<div class="sc-svinfo">${b ? `<span class="sc-pill ${b.status}">${STL[b.status]}</span><b>${esc(b.addr ? title(b.addr) : 'Building, no address on file')}</b><span class="mini">${esc([(PROF[b.cls] || PROF.unk).l, b.roof.short, needLabel(b), 'score ' + b.sc.score].join(' · '))}</span>` : `<b>A point on the map</b><span class="mini">${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}</span>`}</div>
          <div class="sc-svctl">
            ${b && svList.length > 1 ? `<button type="button" class="ibtn" data-a="prev" title="The previous building (likely ones first, highest scores first)" aria-label="Previous building">◀</button><span class="mini sc-svn">${N(i + 1)} of ${N(svList.length)}</span><button type="button" class="ibtn" data-a="next" title="The next building" aria-label="Next building">▶</button>` : ''}
            <span class="seg" role="group" aria-label="How you move">${[['street', 'Street'], ['walk', 'Walk'], ['drone', 'Drone'], ['bird', 'Bird'], ['metro', 'Metro'], ['orbit', 'Orbit'], ['alta', 'Alta X']].map(([k, l]) => `<button type="button" data-h="${k}" aria-pressed="${mode === k}" title="${{ street: 'Along the streets and alleys', walk: 'On foot anywhere, stopped by walls', drone: '38 m up: the height a roof inspection drone flies', bird: '120 m up', metro: '1,400 m up: the city for kilometres round, to the skyline', orbit: 'Circle the building', alta: 'Fly a Freefly Alta X Gen2, built to its published dimensions: it takes off, holds position, lands on roofs, and runs its batteries down in the published time' }[k]}">${l}</button>`).join('')}</span>
            <span class="seg sc-lens" role="group" aria-label="Roof view">${LENS.list.map(([k, l, tip]) => `<button type="button" data-lens="${k}" aria-pressed="${lens === k}" title="${esc(tip)}">${l}</button>`).join('')}</span>
            ${lens === 'time' ? `<span class="sc-enyear"><button type="button" class="ibtn" data-a="play" aria-pressed="${!!enPlayT}" title="Run the years from today to ${THIS_YEAR + LENS.YEARS}">${enPlayT ? '❚❚ Pause' : '▶ Play'}</button><input type="range" id="scEnYear" min="0" max="${LENS.YEARS}" step="1" value="${gNow.year}" aria-label="Years from today"><output id="scEnYearO">${yearText(gNow.year)}</output></span>` : ''}
            ${lens === 'thermal' && gNow ? `<span class="seg" role="group" aria-label="Day of the year">${[['today', 'Today'], ['summer', 'July 21'], ['winter', 'January 21']].map(([k, l]) => `<button type="button" data-eg="day:${k}" aria-pressed="${gNow.day === k}" title="The sun's path on that day, and the air's normal temperature for that month">${l}</button>`).join('')}</span>` : ''}
            ${mode === 'alta' ? `<span class="seg" role="group" aria-label="The Alta X"><button type="button" data-al="camera" title="Its payload camera, or the view from behind it (C)">${gNow && gNow.altaCam === 'payload' ? 'Chase view' : 'Payload camera'}</button><button type="button" data-al="home" title="Fly back to where it took off and land (H)">Return home</button><button type="button" data-al="land" title="Land where it is, or take off (L)">${st && st.alta && st.alta.mode === 'Landed' ? 'Take off' : 'Land'}</button></span>` : ''}
            ${b ? '<button type="button" class="ibtn" data-a="face" title="Turn to face the building">Face it</button>' : ''}
            ${b ? `<span class="seg sc-svck" role="group" aria-label="Your field check">${[['g', 'Likely'], ['o', 'Maybe'], ['r', 'Not likely']].map(([k, l]) => `<button type="button" data-ck="${k}" aria-pressed="${!!(CK[b.id] && CK[b.id].s === k)}" title="Mark what you see: ${l.toLowerCase()}">${l}</button>`).join('')}</span>` : ''}
            ${enMenu()}
            <button type="button" class="ibtn" data-a="editor" aria-pressed="${ed}" title="The engine's editor: outliner, details, world settings, gizmos, buffer views, profiler; add lights, particles, physics props, glTF models">${ed ? 'Close editor' : 'Editor'}</button>
            <button type="button" class="ibtn" data-a="crate" title="Throw a crate from the camera: it falls, tumbles and comes to rest on the ground or a roof">Throw a crate</button>
            <button type="button" class="ibtn" data-a="full">${svFull ? '⤡ Exit full window' : '⤢ Full window'}</button>
            <button type="button" class="ibtn" data-a="classic" title="The three.js street view, with the AI tracing, Google's photoreal tiles and the glTF export">Classic 3D</button>
            <button type="button" class="btn sm" data-a="map">Back to satellite</button>
          </div>
          <div class="sc-svwhere" id="scEnWhere">${whereEn(st)}</div>`;
        const focusEn = () => { try { en.canvas.focus({ preventScroll: true }); } catch (e) { /* fine */ } };
        $$('[data-a]', enBar).forEach(x => x.onclick = () => { const a = x.dataset.a;
          if (a === 'map') setMode('map'); else if (a === 'full') full(!svFull); else if (a === 'face' && en && b) en.face(b);
          else if (a === 'prev' || a === 'next') { if (!svList.length) return; const cur = b ? svList.indexOf(b.id) : -1, k = ((cur + (a === 'next' ? 1 : -1)) % svList.length + svList.length) % svList.length; if (B.get(svList[k])) pick(svList[k]); }
          else if (a === 'editor' && en) { en.editor(!en.editing); renderEnBar(); } else if (a === 'crate' && en) en.dropCrate();
          else if (a === 'play' && en) { enPlay(!enPlayT); renderEnBar(); }
          else if (a === 'classic') { const s2 = en ? en.state() : null; open3D(b ? { lat: b.lat, lon: b.lon, street: b.street, b } : s2 ? { lat: s2.lat, lon: s2.lon, street: '', b: null } : t); } });
        $$('[data-h]', enBar).forEach(x => x.onclick = () => { if (en) { en.setHeight(x.dataset.h); renderEnBar(); focusEn(); } });
        $$('[data-lens]', enBar).forEach(x => x.onclick = () => { if (!en) return; if (x.dataset.lens !== 'time') enPlay(false); en.setGraphics({ lens: x.dataset.lens }); renderEnBar(); focusEn(); });
        $$('[data-al]', enBar).forEach(x => x.onclick = () => { if (!en) return; const a = x.dataset.al; if (a === 'camera') en.alta.camera(); else if (a === 'home') en.alta.home(); else { const s3 = en.state(); if (s3.alta && s3.alta.mode === 'Landed') en.alta.takeoff(); else en.alta.land(); } setTimeout(renderEnBar, 60); focusEn(); });
        const gd = $('#scEnGfx', enBar); if (gd) gd.addEventListener('toggle', () => { enGfxOpen = gd.open; });
        $$('[data-eg]', enBar).forEach(x => x.onclick = () => { const [k, v] = x.dataset.eg.split(':'); if (!en) return; en.setGraphics(k === 'trees' || k === 'life' || k === 'live' || k === 'wide' || k === 'roofKit' ? { [k]: v === 'on' } : { [k]: v }); renderEnBar(); });
        const hr = $('#scEnHour', enBar); if (hr) { hr.oninput = () => { const v = +hr.value; $('#scEnHourO', enBar).textContent = hhmm(v); if (en) en.setGraphics({ sun: v }); }; hr.onchange = () => renderEnBar(); }
        const yr = $('#scEnYear', enBar); if (yr) { yr.oninput = () => { const v = +yr.value; $('#scEnYearO', enBar).textContent = yearText(v); if (en) en.setGraphics({ year: v }); }; yr.onchange = () => { if (enPlayT) { enPlay(false); renderEnBar(); } }; }
        $$('[data-ck]', enBar).forEach(x => x.onclick = () => { const k = x.dataset.ck, cur = CK[b.id] && CK[b.id].s; setCheck(b.id, { s: cur === k ? undefined : k }); statusOf(b); draw(b); refreshSoon(); renderEnBar(); if (en) en.refresh(); if (sel && sel.type === 'b' && sel.id === b.id) detail(); });
      }
      $$('#scEnPad button', root).forEach(x => {
        const k = x.dataset.k, on = e => { e.preventDefault(); if (en) en.hold(k, true); }, off = () => { if (en) en.hold(k, false); };
        x.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(ev => x.addEventListener(ev, off));
        x.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); if (!en) return; if (en.state().mode === 'alta') { en.hold(k, true); setTimeout(() => en.hold(k, false), 600); return; } if (k === 'fwd') en.walk(8); else if (k === 'back') en.walk(-8); else if (k === 'left' || k === 'right') en.turn(k === 'left' ? -20 : 20); });
      });
      setInterval(() => { if (enMode && en) whereEnSoon(); }, 1000);

