/* ==== live/sources/cpsc_recalls.js ==== */
/* Consumer Product Safety Commission recalls of home heating equipment since 2019: furnaces and the coils installed with
   them, heat pumps, boilers, room heaters and carbon monoxide alarms. Five small title searches a week. The Heat Desk turns
   them into the recall check offer and the Emergency Satchel keeps the claims honest: a recall is a fact about a model,
   never about a homeowner's unit until the model number is read. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, API = 'https://www.saferproducts.gov/RestWebServices/Recall';
  const SINCE = '2019-01-01';
  /* title search terms; "heater" also returns water heaters and patio heaters, which the kind filter drops */
  const TERMS = ['furnace', 'heat pump', 'boiler', 'heater', 'carbon monoxide alarm'];
  /* first number in "About 298,300 (In addition, about 44,000 were sold in Canada)" */
  const units = s => { const m = /([\d][\d,\s]*\d|\d)/.exec(String(s || '')); return m ? +m[1].replace(/[,\s]/g, '') : null; };
  function kindOf(title, product) {
    const t = (title + ' ' + product).toLowerCase();
    if (/water heater|pool|patio|spa |hot tub|aquarium|heated (blanket|jacket|vest|insole)|hair|towel|bottle|pet |coffee|wax|food|baby|seat|glove|mattress|heating pad/.test(t)) return null;
    if (/carbon monoxide alarm|co alarm|smoke.*carbon monoxide|natural gas and carbon monoxide/.test(t)) return 'alarm';
    if (/furnace|evaporator coil/.test(t)) return 'furnace';
    if (/heat pump/.test(t)) return /window|through.the.wall|packaged terminal|room/.test(t) ? 'room' : 'heatpump';
    if (/boiler/.test(t)) return 'boiler';
    if (/space heater|wall heater|room heater|fireplace|heater/.test(t)) return 'room';
    return null;
  }
  const hazardOf = t => { t = String(t || '').toLowerCase(); const h = []; if (/carbon monoxide|\bco\b/.test(t)) h.push('carbon monoxide'); if (/fire|flame|ignite|overheat/.test(t)) h.push('fire'); if (/burn/.test(t)) h.push('burn'); if (/shock|electrocut/.test(t)) h.push('shock'); if (/fail to alert|failure to alert/.test(t)) h.push('alarm failure'); return h; };
  const OPT = { timeoutMs: 12000, retries: 1 }, BUDGET = 75000;
  /* The service answers a database failure with HTTP 200 and one row that is not a recall ("Error retrieving Recalls: ...", RecallID 0).
     Read as data that row would mean "no recalls", and a week of furnace recalls would vanish. */
  const refusal = list => { if (!Array.isArray(list)) return 'the answer is not a list'; const r = list[0]; return list.length === 1 && r && !r.RecallDate && /^Error\b/i.test(String(r.Title || '')) ? String(r.Title).slice(0, 140) : null; };
  function parse(list) {
    return (Array.isArray(list) ? list : []).map(r => {
      const product = ((r.Products || [])[0] || {}).Name || '', haz = ((r.Hazards || [])[0] || {}).Name || '';
      const kind = kindOf(r.Title || '', product); if (!kind || !r.RecallDate) return null;
      return { id: r.RecallID, no: r.RecallNumber || '', d: String(r.RecallDate).slice(0, 10), title: String(r.Title || '').replace(/\s+/g, ' ').trim(), url: r.URL || '', product: product.slice(0, 140), units: units(((r.Products || [])[0] || {}).NumberOfUnits), kind, hazards: hazardOf((r.Title || '') + ' ' + haz), hazard: haz.replace(/\s+/g, ' ').slice(0, 260), maker: (((r.Manufacturers || [])[0] || {}).Name || '').replace(/,? of .*$/, '').slice(0, 80) };
    }).filter(Boolean);
  }
  L.register({
    id: 'cpsc_recalls', name: 'Heating equipment recalls', publisher: 'U.S. Consumer Product Safety Commission', page: 'https://www.cpsc.gov/Recalls',
    about: 'Recalls since 2019 of furnaces and their coils, heat pumps, boilers, room heaters and carbon monoxide alarms, with units and hazard. Feeds the recall check offer and the safety copy in the Heat Desk.',
    hosts: ['www.saferproducts.gov'], cadence: 'weekly', cors: true, grade: 'A', terms: 'U.S. Government work, public domain', timeoutMs: 110000,
    labels: { central: ['Central heating recalls since 2019 (furnace, heat pump, boiler)', 'int'], room: ['Room heater recalls since 2019', 'int'], alarm: ['Carbon monoxide alarm recalls since 2019', 'int'], last12: ['Recalls in the last 12 months', 'int'], newest: ['Most recent recall', 'text'] },
    async run(ctx) {
      const seen = {}, t0 = Date.now(); let failed = 0, lastErr = null;
      for (const t of TERMS) {
        try {
          /* the service is slow on some days: a search that has not answered in 12 seconds is tried once more, and after 75 seconds the rest wait for next week */
          if (Date.now() - t0 > BUDGET) throw new Error('not asked: the run was out of time');
          const list = await ctx.http.json(`${API}?format=json&RecallTitle=${encodeURIComponent(t)}&RecallDateStart=${SINCE}`, OPT);
          const bad = refusal(list); if (bad) throw new Error(bad);
          parse(list).forEach(r => { seen[r.id] = r; });
        } catch (e) { failed++; lastErr = e; }
      }
      if (failed === TERMS.length) throw lastErr || new Error('no recall search answered');
      /* a recall never stops being a recall: when a search failed, what the last run held is kept beside what this run found */
      if (failed && ctx.prev && Array.isArray(ctx.prev.recalls)) ctx.prev.recalls.forEach(r => { if (r && r.id != null && !seen[r.id]) seen[r.id] = r; });
      const recalls = Object.values(seen).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : b.id - a.id));
      return { since: SINCE, recalls, failed, err: failed ? String((lastErr && lastErr.message) || lastErr).slice(0, 160) : undefined };
    },
    digest(d) {
      const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10); const n = k => d.recalls.filter(r => k.includes(r.kind)).length;
      return { central: n(['furnace', 'heatpump', 'boiler']), room: n(['room']), alarm: n(['alarm']), last12: d.recalls.filter(r => r.d >= yearAgo).length, newest: d.recalls[0] ? d.recalls[0].d + ' · ' + d.recalls[0].title.slice(0, 90) : '' };
    },
  });
  L.cpsc = { parse, kindOf, units, hazardOf, refusal, TERMS };
})(typeof globalThis !== 'undefined' ? globalThis : self);
