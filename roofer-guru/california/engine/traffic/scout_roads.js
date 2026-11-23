      const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
      /* a freeway and its ramps are kinds of their own: the engine gives them lanes one way, no signals and no sidewalks */
      const osmKind = t => { const h = t.highway || '', s = t.service || ''; if (h === 'motorway') return 'freeway'; if (h === 'motorway_link') return 'ramp'; if (/^(trunk|primary|secondary)(_link)?$/.test(h)) return 'major'; if (/^(tertiary|tertiary_link|residential|unclassified|living_street|road)$/.test(h)) return 'street'; if (h === 'service') return s === 'alley' ? 'alley' : /^(driveway|parking_aisle|drive-through|emergency_access)$/.test(s) ? 'drive' : 'service'; if (/^(footway|path|pedestrian|cycleway|steps|track|bridleway)$/.test(h)) return 'path'; return null; };
      const tigerKind = m => m === 'S1100' ? 'freeway' : m === 'S1630' ? 'ramp' : m === 'S1200' ? 'major' : m === 'S1730' ? 'alley' : m === 'S1780' ? 'drive' : /^S1(640|740)$/.test(m) ? 'service' : /^S1(710|720|820|830)$/.test(m) ? 'path' : 'street';
      /* one OpenStreetMap way as the engine takes it: what the map says about lanes, direction, limit and level goes with it
         (0 or null where the map is silent; the engine fills those by class and says so). A cable car track is a kind too. */
      const osmRoad = e => { const t = e.tags || {}, kind = t.railway === 'tram' ? (t.cable_tram ? 'cable' : null) : osmKind(t); if (!kind) return null;
        const ms = /^(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh)?$/.exec(t.maxspeed || ''), ln = parseInt(t.lanes, 10), ow = /^(yes|1|true)$/.test(t.oneway || '') ? 1 : /^(-1|reverse)$/.test(t.oneway || '') ? -1 : t.oneway === 'no' ? 0 : t.junction === 'roundabout' ? 1 : null;
        return { name: t.name || t.ref || '', kind, pts: e.geometry.map(g => [g.lat, g.lon]), id: e.id, hw: t.highway || '', ref: t.ref || '', lanes: ln > 0 ? ln : 0, oneway: ow, maxspeed: ms ? +ms[1] * (ms[2] === 'mph' ? 0.44704 : 1 / 3.6) : 0, layer: parseInt(t.layer, 10) || 0, bridge: !!t.bridge && t.bridge !== 'no', tunnel: !!t.tunnel && t.tunnel !== 'no', hov: /^designated/.test(t['hov:lanes'] || '') }; };
      const osmList = j => { const els = j.elements || [], list = els.filter(e => e.type === 'way' && e.geometry && e.geometry.length > 1).map(osmRoad).filter(Boolean), nodes = h => els.filter(e => e.type === 'node' && e.tags && e.tags.highway === h).map(e => [e.lat, e.lon]); list.signals = nodes('traffic_signals'); list.stops = nodes('stop'); list.osm = true; return list; };
      const roadCache = new Map();   /* answers already had, by the box asked for: moving back over ground costs nothing */
      /* o.only === 'freeway': the motorways and their ramps alone, which is a small answer even for a box of several kilometres */
      async function roads3d(la, lo, r, o) {
        const only = o && o.only === 'freeway', ck = la.toFixed(4) + ',' + lo.toFixed(4) + ',' + Math.round(r) + (only ? 'f' : ''); if (roadCache.has(ck)) return roadCache.get(ck);
        const dLa = r / 110900, dLo = r / (111320 * Math.cos(rad(la))), bb = [la - dLa, lo - dLo, la + dLa, lo + dLo].map(v => v.toFixed(6)).join(',');
        const q = only ? `[out:json][timeout:25];way["highway"~"^motorway"](${bb});out tags geom;` : `[out:json][timeout:25];(way["highway"](${bb});way["railway"="tram"]["cable_tram"](${bb});node["highway"~"^(traffic_signals|stop)$"](${bb}););out tags geom;`;
        let answered = false; const order = OVERPASS.slice().sort((a, b) => (b === OVERPASS.good) - (a === OVERPASS.good));
        for (const url of order) {
          const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 15000);
          try {
            const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal, credentials: 'omit' });
            if (!res.ok) continue; const j = await res.json(), list = osmList(j); OVERPASS.good = url;
            if (list.length || only) { list.source = ''; if (roadCache.size > 40) roadCache.delete(roadCache.keys().next().value); roadCache.set(ck, list); return list; }
            answered = true; break;   /* a server that answers with no streets is believed: the area goes to no other server */
          } catch (e) { /* the next server */ } finally { clearTimeout(tm); }
        }
        if (only) {   /* the Census file's primary roads over the whole box in one question (no lanes, no direction: the engine pairs the carriageways) */
          const js = await getJSON(EP.roads + '2/query?' + qs({ geometry: env({ w: lo - dLo, e: lo + dLo, s: la - dLa, n: la + dLa }), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'NAME,MTFCC', returnGeometry: 'true', outSR: 4326, geometryPrecision: 6, f: 'json' }), { timeout: 25000 }).catch(() => ({ features: [], failed: true }));
          const list = []; (js.features || []).forEach(f => ((f.geometry && f.geometry.paths) || []).forEach((p, i) => list.push({ name: (f.attributes && f.attributes.NAME) || '', kind: 'freeway', id: 't' + ((f.attributes && f.attributes.NAME) || '') + p[0].join() + i, hw: 'motorway', pts: p.map(([x, y]) => [y, x]) }))); list.tiger = true; list.source = ''; if (!js.failed) roadCache.set(ck, list); return list; }
        const ks = new Set(); [[0, 0], [dLa, 0], [-dLa, 0], [0, dLo], [0, -dLo], [dLa, dLo], [-dLa, -dLo], [dLa, -dLo], [-dLa, dLo], [dLa / 2, dLo / 2], [-dLa / 2, -dLo / 2], [dLa / 2, -dLo / 2], [-dLa / 2, dLo / 2]].forEach(([a, b]) => ks.add(tileOf(la + a, lo + b)));
        const parts = await Promise.all([...ks].map(t => roadsFor(t).catch(() => Object.assign([], { failed: true })))), failed = parts.some(x => x.failed), all = parts.flat(), seen = new Set();
        const list = all.filter(r => { const k = r.line.map(p => p.join()).join(';'); if (seen.has(k)) return false; seen.add(k); return true; }).map(r => ({ name: r.name, kind: tigerKind(r.m || ''), id: 't' + r.line[0].join() + r.line.length, hw: r.m === 'S1100' ? 'motorway' : r.m === 'S1630' ? 'motorway_link' : '', pts: r.line }));
        const osm = answered ? 'OpenStreetMap has no streets here' : 'OpenStreetMap did not answer'; list.tiger = true;
        list.source = list.length ? `${osm}, so the streets are the Census TIGER file's: the alleys are missing, and lanes, one-way streets and speed limits are assumed by class of road.` : `No streets loaded: ${osm}, and the Census TIGER file ${failed ? (answered ? 'did not answer' : 'did not answer either') : 'has none here'}. The view still walks freely.`;
        return list;
      }
