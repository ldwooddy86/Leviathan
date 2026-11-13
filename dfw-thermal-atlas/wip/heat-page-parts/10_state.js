    /* ---------- state: a sparse patch of the owner's settings; the engine fills in and clamps the rest ---------- */
    const IDS = HX.IDS, NAMES = HX.NAMES, SHORT = HX.SHORT || NAMES, R = HX.RANGES || {}, GR = HX.GRADES || {};
    const WORD = { heat: 'heating repair', furnace: 'furnace replacement', heatpump: 'heat pump replacement', maint: 'tune ups' };
    const SV = (s => (s && typeof s === 'object' ? s : {}))(store.get(KEY, null));
    const st = { P: SV.P && typeof SV.P === 'object' && !Array.isArray(SV.P) ? SV.P : {}, layer: typeof SV.layer === 'string' ? SV.layer : 'share', bench: SV.bench === true, scn: 'live', sel: null, miss: '', mixSel: null, sens: null, sensKey: '', lad: null, ladKey: '', mon: null, monKey: '', lsaKey: '', lsaAdd: null };
    const save = () => store.set(KEY, { v: 1, P: st.P, layer: st.layer, bench: st.bench });
    /* what was saved is data from outside: keep only keys the engine knows, at the values the engine accepts */
    (() => { let full; try { full = HX.params(st.P); } catch (e) { st.P = {}; return; } const out = {}; Object.keys(st.P).forEach(k => { if (k in HX.DEF && st.P[k] != null) out[k] = full[k]; }); ['pins', 'blocks'].forEach(k => { if (out[k]) out[k] = (Array.isArray(out[k]) ? out[k] : []).map(String).filter(z => ZI[z]); }); st.P = out; })();
    /* PP: the full parameters (the global P is the percent formatter); plan, bands, F, wk: the engine's answers for them */
    let PP, plan, bands, F0, F, wk, ex = null, fail = '', dirty = false, lt = 0; const CSV = {};
    function compute() {
      PP = HX.params(st.P); plan = HX.plan(PP); bands = HX.bands(plan);
      F0 = HX.forecast(new Date()); if (!F0) st.scn = 'live';
      F = st.scn === 'live' ? F0 : HX.scenario(F0, st.scn);
      wk = HX.week(PP, F); ex = null;
    }
    const files = () => ex || (ex = HX.exports(plan, wk, PP));
    const pkey = () => JSON.stringify(PP) + '|' + plan.origin.lat + ',' + plan.origin.lon + '|' + plan.exposure.source;
    const sim = () => !!(wk && wk.src === 'sim');
    const simTag = () => (sim() ? '<span class="hd-sim">Simulation</span>' : '');
    const band = k => (bands && bands[k] ? [bands[k].p10, bands[k].p50, bands[k].p90] : null);
    const lband = (id, k) => (bands && bands.lines && bands.lines[id] && bands.lines[id][k] ? [bands.lines[id][k].p10, bands.lines[id][k].p50, bands.lines[id][k].p90] : null);
    const stamp = t => { const d = new Date(t); return isNaN(d) ? NA : d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
    const sd = v => (!isN(v) ? NA : Math.round(v) === 0 ? '$0' : (v > 0 ? '+' : '-') + '$' + N(Math.abs(v)));                // a signed change in a cell
    const chg = l => (isN(l.changePct) ? l.changePct : l.normal ? (l.week / l.normal - 1) * 100 : 0);
    const over = p => (Math.round(p) === 0 ? 'level with' : Math.abs(Math.round(p)) + '% ' + (p > 0 ? 'over' : 'under'));

    /* ---------- the live records, read by meaning in one place. A missing or failed record gives null and its row hides. ---------- */
    function live() {
      const L = window.TDA_LIVE || {}, B = window.__CLIMATE_BASE__ || null, now = new Date();
      const safe = (f, d) => { try { const v = f(); return v == null ? d : v; } catch (e) { return d; } };
      const recs = safe(() => LIVE.all(), {}), has = id => !!(L.BY_ID && L.BY_ID[id]);
      const rec = id => (has(id) && recs[id] && recs[id].data != null ? recs[id] : null), data = id => (rec(id) ? rec(id).data : null), at = id => (rec(id) ? rec(id).at || null : null);
      const season = safe(() => { const d = data('acis_season'); if (!d) return null; const s = L.climate.status(d, B, now); return s && s.ok ? Object.assign({ headline: L.climate.headline(s), at: at('acis_season') }, s) : null; }, null);
      const yearAgo = new Date(+now - 365 * 864e5).toISOString().slice(0, 10);
      const recalls = safe(() => { const d = data('cpsc_recalls'); if (!d || !Array.isArray(d.recalls)) return null; return { at: at('cpsc_recalls'), all: d.recalls.length, central: d.recalls.filter(r => r && r.d >= yearAgo && ['furnace', 'heatpump', 'boiler'].indexOf(r.kind) >= 0) }; }, null);
      return { now, base: B, has, rec, data, at, season, recalls,
        /* normal freeze nights a year by county and by ZIP, from the climate baseline baked into the build */
        freezeNights: safe(() => { const out = {}; (L.geo.counties || []).forEach(c => { const p = B.prismCounty[c.fips]; if (p && isN(p.fr32)) out[c.name] = p.fr32; }); return Object.keys(out).length ? out : null; }, null),
        zipNormal: zip => safe(() => B.zip[zip] || null, null),
        outlook: safe(() => outlookOf(data('cpc_outlook'), at('cpc_outlook')), null),
        prices: safe(() => pricesOf(data('bls_energy'), at('bls_energy')), null),
        rules: safe(() => rulesOf(data('fedreg_rules'), at('fedreg_rules')), null),
        licences: safe(() => licencesOf(data('tdlr_licenses'), at('tdlr_licenses')), null),
        permits: safe(() => permitsOf(['permits_dallas', 'permits_fortworth', 'permits_irving'].map(id => ({ id, d: data(id), at: at(id) })).filter(x => x.d)), null) };
    }
    /* The collectors below were still being written when this page was built. Each reader takes the record by meaning and
       returns null unless it finds what it needs, so a record that is missing or shaped differently hides its row. */
    function outlookOf(d, at) { return null; }
    function pricesOf(d, at) { return null; }
    function rulesOf(d, at) { return null; }
    function licencesOf(d, at) { return null; }
    function permitsOf(list) { return null; }
