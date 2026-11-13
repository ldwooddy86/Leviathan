/* ==== live/sources/census_acs.js ==== */
/* U.S. Census Bureau, American Community Survey: the vintage watch. The atlas stock model (house heating fuel, owner or
   renter by fuel, year built) is compiled from one five year file and stays fixed until it is rebuilt. Each week this asks
   two official channels whether a newer five year file exists: the Census API's own catalogue (it answers without a key)
   and the Bureau's file server, where the summary file of the heating fuel table is posted (the 2024 file is stamped
   2026-01-29, its release day). With a Census API key it also confirms with one small data call: data calls have needed
   a key since May 2026 and redirect to a "Missing Key" page without one. It stores no estimates: two to five small
   requests, under 1 KB stored. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, API = 'https://api.census.gov/data', FILES = 'https://www2.census.gov/programs-surveys/acs/summary_file';
  /* The five year vintage the stock model was compiled from: ACS 2020 to 2024, published 2026-01-29 and compiled into the
     atlas on 2026-09-25. Nothing is read from the page: raise this when the model is rebuilt from a newer file. */
  const COMPILED = 2024, V = 1;
  /* the tables the stock model reads, named as the 2024 catalogue names them */
  const TABLES = [['B25040', 'House Heating Fuel'], ['B25117', 'Tenure by House Heating Fuel'], ['B25034', 'Year Structure Built'], ['B25035', 'Median Year Structure Built']];
  const KEY_PAGE = /\/(missing|invalid)_key\.html/i;
  const NEED_KEY = 'The Census API now asks for a key on this request. Add a free Census API key in Live Data settings, then refresh again.';
  const BAD_KEY = 'The Census API did not accept the Census API key saved in Live Data settings.';
  const span = y => `${y - 4} to ${y}`;
  const guard = { expectFinalUrl: u => !KEY_PAGE.test(u), retries: 1, gapMs: 600, timeoutMs: 20000 };
  const keyPage = e => !!(e && e.name === 'HttpError' && KEY_PAGE.test(e.body || ''));
  const why = e => String((e && e.message) || e).slice(0, 140);
  /* The summary file of the heating fuel table, one file for all places (44 MB: asked for with HEAD, never downloaded).
     The 2022, 2023 and 2024 files sit on this path. */
  const fileUrl = y => `${FILES}/${y}/table-based-SF/data/5YRData/acsdt5y${y}-b25040.dat`;
  /* The vintages worth asking about. The file for year Y is due in December of Y + 1 (2024 slipped to January 2026) and
     the catalogue entries of 2023 and 2024 are dated early September, so from September on the year before counts. */
  function candidates(now) {
    const d = new Date(now), top = Math.min(COMPILED + 3, d.getUTCFullYear() - (d.getUTCMonth() >= 8 ? 1 : 2)), out = [];
    for (let y = COMPILED; y <= Math.max(COMPILED, top); y++) out.push(y);
    return out;
  }
  /* api.census.gov/data/<year>/acs/acs5.json lists the detailed tables and the profiles built on them: the entry that is
     exactly acs/acs5 is the five year file. modified is the catalogue's own date, set months before the release. */
  function parseListing(j, year) {
    const d = ((j && j.dataset) || []).find(x => x && +x.c_vintage === year && Array.isArray(x.c_dataset) && x.c_dataset.join('/') === 'acs/acs5');
    return d ? { year, listed: d.c_isAvailable !== false, title: String(d.title || '').slice(0, 80), modified: String(d.modified || '').slice(0, 10) || null } : { year, listed: false };
  }
  async function listing(ctx, year) {
    const url = `${API}/${year}/acs/acs5.json`;
    const read = async u => { try { return parseListing(await ctx.http.json(u, guard), year); } catch (e) { if (e && e.status === 404) return { year, listed: false }; throw e; } };
    try { return await read(url); }
    catch (e) {
      /* the catalogue needs no key today. If it starts to (the answer is then the Missing Key page), use the key, and never
         send one otherwise: a mistyped key turns even this request into a redirect to the Invalid Key page */
      if (!keyPage(e)) throw e;
      if (!ctx.key) throw new Error(NEED_KEY);
      try { return await read(url + '?key=' + encodeURIComponent(ctx.key)); } catch (e2) { throw keyPage(e2) ? new Error(BAD_KEY) : e2; }
    }
  }
  /* true: the file is on the file server; false: it is not (404); null: could not ask. The file server sends no CORS
     header, so a plain web page cannot ask: the browser app and Node can. */
  async function published(ctx, year) {
    if (ctx.env === 'page') return null;
    try { await ctx.http.text(fileUrl(year), { method: 'HEAD', retries: 1, gapMs: 600, timeoutMs: 15000 }); return true; }
    catch (e) { return e && e.status === 404 ? false : null; }
  }
  /* One data call with the user's key: the total of the heating fuel table (occupied homes) for Dallas County. Nothing from
     the answer is kept but whether it came. key: 'none' no key saved, 'ok', 'refused' (the Invalid Key page), 'unknown'
     (no usable answer). */
  async function confirm(ctx, year) {
    if (!ctx.key) return { api: null, key: 'none' };
    try {
      const j = await ctx.http.json(`${API}/${year}/acs/acs5?get=NAME,B25040_001E&for=county:113&in=state:48&key=${encodeURIComponent(ctx.key)}`, guard);
      return Array.isArray(j) && j.length > 1 && Array.isArray(j[0]) && j[0].indexOf('B25040_001E') >= 0 ? { api: true, key: 'ok' } : { api: null, key: 'unknown' };
    } catch (e) { return { api: null, key: keyPage(e) ? 'refused' : 'unknown' }; }
  }
  /* does the newer file still carry the four tables: one 200 byte answer per table */
  async function tablesOf(ctx, year) {
    const out = [];
    for (const [id, name] of TABLES) {
      let present = null, concept = name;
      try { const j = await ctx.http.json(`${API}/${year}/acs/acs5/variables/${id}_001E.json`, guard); present = !!(j && j.name === id + '_001E'); if (present && j.concept) concept = String(j.concept).slice(0, 80); }
      catch (e) { present = e && e.status === 404 ? false : null; }
      out.push({ id, name: concept, present });
    }
    return out;
  }

  L.register({
    id: 'census_acs', name: 'Census vintage watch', publisher: 'U.S. Census Bureau, American Community Survey', page: 'https://www.census.gov/programs-surveys/acs/news/data-releases.html',
    about: 'Watches for the next American Community Survey five year file. The stock model (heating fuel, owner or renter, year built) is compiled from the 2020 to 2024 file; when a newer one is published this says so, and the model can be rebuilt.',
    hosts: ['api.census.gov', 'www2.census.gov'], cadence: 'weekly', cors: true, key: 'census', keyLabel: 'Census API key', keyUrl: 'https://api.census.gov/data/key_signup.html', keyRequired: false, grade: 'A',
    terms: 'U.S. Government work, public domain (the catalogue marks it CC0). This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.',
    labels: { latest: ['Latest five year file', 'text'], compiled: ['File the stock model was compiled from', 'text'], newer: ['Newer file out', 'text'] },
    async run(ctx) {
      const prev = ctx.prev && ctx.prev.v === V ? ctx.prev : null, now = ctx.now.toISOString(), years = [], stale = [];
      for (const y of candidates(ctx.now)) {
        let e;
        try { e = await listing(ctx, y); }
        catch (err) {
          if (y === COMPILED) throw err;                                  /* the control: if the compiled file cannot be found, nothing can be said about a newer one */
          const was = prev && (prev.years || []).find(x => x.year === y && x.listed);
          e = was ? Object.assign({}, was, { stale: true }) : { year: y, listed: null }; stale.push({ block: String(y), why: why(err) });
        }
        if (y === COMPILED && !e.listed) throw new Error(`The Census API no longer lists the ${span(COMPILED)} five year file the atlas was compiled from: its catalogue may have moved.`);
        e.published = await published(ctx, y); years.push(e);
      }
      /* a 404 for a later year means "not published" only while the compiled year's own file is found on the same path */
      if (years[0].published !== true) years.forEach(y => { if (y.published === false) y.published = null; });
      const out = years.filter(y => y.listed === true || y.published === true), top = out[out.length - 1], latest = top.year, newer = latest > COMPILED;
      const k = await confirm(ctx, latest), confirmed = top.published === true || k.api === true;
      const tables = !newer || top.listed !== true ? null : prev && prev.latest === latest && prev.tables && prev.tables.every(t => t.present === true) ? prev.tables : await tablesOf(ctx, latest);
      return { v: V, checked: now, compiled: COMPILED, latest, newer, state: !newer ? 'current' : confirmed ? 'newer' : 'listed', published: top.published, api: k.api, key: k.key, firstSeen: newer ? (prev && prev.latest === latest && prev.firstSeen) || now : null, years, tables, stale };
    },
    digest(d) { return { latest: span(d.latest), compiled: span(d.compiled), newer: d.state === 'newer' ? 'yes' : d.state === 'listed' ? 'listed, not confirmed' : 'no' }; },
  });

  /* ---------- reads ---------- */
  /* What the page can say: { state: 'current' | 'newer' | 'listed', compiled, latest, text }. null without a record. */
  function status(d) {
    if (!d || !d.latest) return null;
    const lost = (d.tables || []).filter(t => t.present === false).map(t => t.id);
    const text = d.state === 'newer' ? `A newer Census file is out: American Community Survey ${span(d.latest)}. The stock model, compiled from ${span(d.compiled)}, can be rebuilt.`
      : d.state === 'listed' ? `The Census API lists a newer five year file, ${span(d.latest)}, not yet confirmed as published. The browser app checks the file server and a Census API key confirms with a data call.`
        : `The stock model uses the latest American Community Survey five year file, ${span(d.compiled)}.`;
    return { state: d.state, compiled: span(d.compiled), latest: span(d.latest), firstSeen: d.firstSeen || null, text: text + (lost.length ? ` Missing from the new file: ${lost.join(', ')}.` : '') + (d.key === 'refused' ? ' ' + BAD_KEY : '') };
  }
  L.census = { COMPILED, TABLES, API, span, fileUrl, candidates, parseListing, status };
})(typeof globalThis !== 'undefined' ? globalThis : self);
