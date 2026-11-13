/* ==== live/sources/tdlr_licenses.js ==== */
/* Texas Department of Licensing and Regulation: the air conditioning and refrigeration contractor and technician licenses
   whose business county is one of the 12, counted on the server of the Texas Open Data Portal (dataset 7358-krk7, "TDLR All
   Licenses": about a million rows of every license type, replaced whole about once a month, last on 2026-10-19).
   One request reads the file date. When the file is new, four more count it: active licenses by county, class and
   endorsement; the Texas totals with the highest license number that had already expired; the license numbers above that
   one by county (a license runs one year and numbers are issued in sequence, so those are the licenses first issued in
   the last 12 months); and the 25 newest of them by name. About 20 KB on the wire, 8 KB stored.
   Contractors per home is the competition a heating advertiser bids against; the new numbers show who is entering. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, HOST = 'https://data.texas.gov', ID = '7358-krk7';
  const META = `${HOST}/api/views/metadata/v1/${ID}`, RES = `${HOST}/resource/${ID}.json`;
  const V = 1, CON = 'A/C Contractor', TECH = 'A/C Technician', NEWEST = 25, DAY = 864e5;
  /* no custom header: a plain GET needs no CORS preflight. The counts scan a million rows, so give them time. */
  const OPT = { gapMs: 600, retries: 1, timeoutMs: 30000 };
  /* The expiration date is text, mm/dd/yyyy. Rebuilt on the server as yyyymmdd it compares as text; OKD guards the shape. */
  const EXP = 'license_expiration_date_mmddccyy', OKD = `${EXP} like '__/__/____'`;
  const KEY = `substring(${EXP},7,4)||substring(${EXP},1,2)||substring(${EXP},4,2)`;
  const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
  const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY);
  const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const yearsBefore = (ymd, n) => { const y = +ymd.slice(0, 4) - n; return y + (ymd.slice(5) === '02-29' && !leap(y) ? '-02-28' : ymd.slice(4)); };
  const thousands = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const upper = s => String(s == null ? '' : s).trim().toUpperCase();
  const clean = s => String(s == null ? '' : s).replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  const sum = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0);

  /* The file date: the portal's dataUpdatedAt ("2026-10-19T18:51:17+0000"; the older views endpoint gives rowsUpdatedAt in
     seconds), and the same instant as a calendar day in Texas. */
  function fileDate(meta) {
    const raw = meta ? (meta.dataUpdatedAt != null ? meta.dataUpdatedAt : meta.rowsUpdatedAt) : null;
    const t = typeof raw === 'number' ? raw * 1000 : Date.parse(String(raw || '').replace(/([+-]\d\d)(\d\d)$/, '$1:$2'));
    if (!Number.isFinite(t)) throw new Error('the Texas Open Data Portal did not say when the license file was last updated');
    return { asOf: new Date(t).toISOString().replace('.000Z', 'Z'), day: DAY_FMT.format(new Date(t)) };
  }
  /* "BE", "AC", "AEBR": pairs of a class (A any size; B cooling up to 25 tons and heating up to 1.5 million BTU an hour) and an
     endorsement (E environmental air conditioning, which is comfort heating and cooling; R commercial refrigeration and
     process cooling or heating; C both). env: may work on home heating. */
  function subtype(code) {
    const p = upper(code).match(/[AB][ERC]/g) || [];
    return { classA: p.some(x => x[0] === 'A'), env: p.some(x => x[1] !== 'R'), refrig: p.some(x => x[1] !== 'E') };
  }
  /* The four counting requests for a file dated `day` (YYYY-MM-DD). after: the license number the last 12 months start above. */
  function queries(day, names, after) {
    const q = p => RES + '?' + Object.keys(p).map(k => k + '=' + encodeURIComponent(p[k])).join('&');
    const a = day.replace(/-/g, ''), b = addDays(day, 90).replace(/-/g, '');
    const inC = `business_county in(${names.map(n => `'${upper(n)}'`).join(',')})`, act = `sum(case(${OKD} and ${KEY}>='${a}',1,true,0))`;
    const fresh = after == null ? null : `license_type='${CON}' and ${inC} and license_number::number>${+after}`;
    return {
      counts: q({ $select: `license_type,business_county,license_subtype,count(*) as n,${act} as act,sum(case(${OKD} and ${KEY}>='${a}' and ${KEY}<='${b}',1,true,0)) as x90,sum(case(${OKD},0,true,1)) as bad`, $where: `license_type in('${CON}','${TECH}') and ${inC}`, $group: 'license_type,business_county,license_subtype', $order: 'license_type,business_county,license_subtype', $limit: 1000 }),
      texas: q({ $select: `license_type,count(*) as n,${act} as act,max(case(${OKD} and ${KEY}<'${a}',license_number::number)) as n0`, $where: `license_type in('${CON}','${TECH}')`, $group: 'license_type', $order: 'license_type' }),
      entrants: fresh && q({ $select: `business_county,count(*) as n,min(${KEY}) as lo`, $where: fresh, $group: 'business_county', $order: 'business_county', $limit: 100 }),
      newest: fresh && q({ $select: `license_number,business_name,business_county,license_subtype,${EXP}`, $where: fresh, $order: 'license_number::number DESC', $limit: NEWEST }),
    };
  }
  /* Rows of (license type, county, subtype) → one row per county. Active: the expiration date is on or after the file date. */
  function parseCounts(rows, counties) {
    if (!Array.isArray(rows)) throw new Error('the license counts are not a list');
    if (rows.length >= 1000) throw new Error('the license counts were cut off at 1,000 rows');
    const by = {}; counties.forEach(c => { by[upper(c.name)] = { name: c.name, fips: c.fips, contractors: 0, classA: 0, comfort: 0, techs: 0, certified: 0, expiring90: 0, lapsed: 0, new12: null, contractorsPer10kHomes: null }; });
    let listed = 0, con = 0, bad = 0;
    for (const r of rows) {
      const c = by[upper(r.business_county)], n = +r.n || 0, act = +r.act || 0; if (!c || !n) continue;
      if (r.license_type === CON) { const s = subtype(r.license_subtype); con += n; c.contractors += act; c.lapsed += n - act; c.expiring90 += +r.x90 || 0; if (s.classA) c.classA += act; if (s.env) c.comfort += act; }
      else if (r.license_type === TECH) { c.techs += act; if (upper(r.license_subtype) === 'CER') c.certified += act; }
      else continue;
      listed += n; bad += +r.bad || 0;
    }
    const list = counties.map(c => by[upper(c.name)]);
    if (!con) throw new Error('no air conditioning contractor license came back for the 12 counties: the license type or county names in the file may have changed');
    if (bad > listed * 0.02) throw new Error(`${thousands(bad)} of ${thousands(listed)} expiration dates in the license file are not mm/dd/yyyy any more`);
    if (!sum(list, 'contractors')) throw new Error('no contractor license in the file is active on the file date: the expiration dates may have changed');
    return { counties: list, badDates: bad };
  }
  /* Texas as a whole on the same rule, and n0: the highest contractor license number that had already expired on the file date. */
  function parseTexas(rows) {
    const of = t => (Array.isArray(rows) ? rows : []).find(r => r && r.license_type === t) || null, c = of(CON), t = of(TECH);
    if (!c || !(+c.act > 0)) throw new Error('no Texas total for contractor licenses');
    return { contractors: +c.act, techs: t && +t.act > 0 ? +t.act : null, n0: /^\d+$/.test(String(c.n0)) ? +c.n0 : null };
  }
  /* New license numbers by county. first: the earliest expiration date among them. The oldest of a true year of entrants
     expire (or have just renewed) around the file date; if the first expiration is far off, an oddity set the number line
     and the count is not a year of entrants (ok false). */
  function parseEntrants(rows, counties, day) {
    const by = {}; counties.forEach(c => { by[c.name] = 0; }); let lo = null;
    for (const r of Array.isArray(rows) ? rows : []) { const c = counties.find(x => upper(x.name) === upper(r.business_county)); if (!c) continue; by[c.name] += +r.n || 0; if (/^\d{8}$/.test(r.lo || '') && (lo == null || r.lo < lo)) lo = r.lo; }
    const first = lo ? `${lo.slice(0, 4)}-${lo.slice(4, 6)}-${lo.slice(6)}` : null, gap = first ? daysBetween(day, first) : null;
    return { by, total: Object.keys(by).reduce((s, k) => s + by[k], 0), first, ok: gap != null && gap >= 0 && gap <= 45 };
  }
  /* The newest license holders. issued: one year before the expiration date, two when the license is already renewed ahead. */
  function parseNewest(rows, counties, day) {
    return (Array.isArray(rows) ? rows : []).map(r => {
      const c = counties.find(x => upper(x.name) === upper(r.business_county)), m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(r[EXP] || '');
      if (!c || !/^\d+$/.test(r.license_number || '')) return null;
      const exp = m ? `${m[3]}-${m[1]}-${m[2]}` : null; let issued = exp ? yearsBefore(exp, 1) : null; if (issued && issued > day) issued = yearsBefore(exp, 2);
      return { no: +r.license_number, name: clean(r.business_name).slice(0, 60), county: c.name, sub: upper(r.license_subtype), comfort: subtype(r.license_subtype).env, issued };
    }).filter(Boolean);
  }
  /* a refused query says why in its body ("No such column: license_kind"): pass that on instead of a bare status */
  async function ask(ctx, url, what) {
    try { return await ctx.http.json(url, OPT); }
    catch (e) {
      if (!(e && e.status === 400)) throw e;
      const col = /No such column: ?(\w+)/.exec(e.body || '');
      throw new Error(col ? `the license file no longer has the column ${col[1]}, so ${what} could not be counted` : `the Texas Open Data Portal refused the query for ${what}`);
    }
  }
  const basis = day => `Counted from the TDLR All Licenses file as published on ${day}. Active: the license type is A/C Contractor or A/C Technician, the business county is one of the 12, and the expiration date is on or after the file date. Comfort: the license carries the environmental air conditioning endorsement, which covers home heating. Expiring within 90 days counts from the file date. Lapsed: still in the file with an expiration date before the file date (the file keeps a license 18 months after it expires). New in 12 months: license numbers above the highest numbered Texas contractor license that had already expired on the file date. Numbers are issued in sequence and a license runs one year, so every higher number was first issued within the year (grade B: the line can sit a few days early). A license is counted in its business county, a technician in the county on the technician's own record.`;

  L.register({
    id: 'tdlr_licenses', name: 'Air conditioning contractor licenses', publisher: 'Texas Department of Licensing and Regulation, on the Texas Open Data Portal', page: 'https://data.texas.gov/dataset/TDLR-All-Licenses/7358-krk7',
    about: 'Active air conditioning and refrigeration contractor and technician licenses in each of the 12 counties, the licenses expiring soon and the license numbers first issued in the last 12 months. Contractors per home is the competition a heating ad bids against, and the new licenses show where it is growing.',
    hosts: ['data.texas.gov'], cadence: 'weekly', cors: true, grade: 'A', terms: 'Public record of the State of Texas, published on its open data portal. The dataset states no license; the file is replaced about once a month.',
    labels: { contractors: ['Active contractor licenses in the 12 counties', 'int'], techs: ['Active technician licenses in the 12 counties', 'int'], top: ['County with the most contractor licenses', 'text'], new12: ['Contractor licenses first issued in the last 12 months', 'int'], asOf: ['Date of the license file', 'text'] },
    async run(ctx) {
      const G = ctx.geo, names = G.counties.map(c => c.name), prev = ctx.prev && ctx.prev.v === V ? ctx.prev : null, now = ctx.now.toISOString();
      const f = fileDate(await ctx.http.json(META, OPT));
      /* the same file as last time, and nothing missing from it: nothing to count again */
      if (prev && prev.asOf === f.asOf && !(prev.stale || []).length && prev.entrants && prev.texas) return Object.assign({}, prev, { checked: now });
      const main = parseCounts(await ask(ctx, queries(f.day, names).counts, 'licenses by county'), G.counties);
      const stale = []; let texas = null, entrants = null, after = null;
      const why = e => String((e && e.message) || e).slice(0, 140);
      try { const t = parseTexas(await ask(ctx, queries(f.day, names).texas, 'the Texas totals')); after = t.n0; texas = { asOf: f.asOf, contractors: t.contractors, techs: t.techs }; }
      catch (e) { texas = prev && prev.texas ? prev.texas : null; stale.push({ block: 'texas', why: why(e), kept: texas ? texas.asOf : null }); }
      try {
        if (after == null) throw new Error('the Texas totals did not give the license number the last 12 months start above');
        const Q = queries(f.day, names, after), e = parseEntrants(await ask(ctx, Q.entrants, 'new licenses by county'), G.counties, f.day);
        if (!e.ok) throw new Error(`the license numbers above ${after} do not span a year (first expiration ${e.first || 'unknown'})`);
        entrants = { asOf: f.asOf, after, from: yearsBefore(f.day, 1), by: e.by, total: e.total, newest: parseNewest(await ask(ctx, Q.newest, 'the newest licenses'), G.counties, f.day) };
      } catch (e) { entrants = prev && prev.entrants ? prev.entrants : null; stale.push({ block: 'entrants', why: why(e), kept: entrants ? entrants.asOf : null }); }
      main.counties.forEach(c => { c.new12 = entrants && entrants.by[c.name] != null ? entrants.by[c.name] : null; });
      const total = {}; ['contractors', 'classA', 'comfort', 'techs', 'certified', 'expiring90', 'lapsed'].forEach(k => { total[k] = sum(main.counties, k); }); total.new12 = entrants ? entrants.total : null;
      return { v: V, asOf: f.asOf, asOfDay: f.day, checked: now, basis: basis(f.day), counties: main.counties, total, texas, entrants, badDates: main.badDates, stale };
    },
    digest(d) {
      const top = d.counties.slice().sort((a, b) => b.contractors - a.contractors)[0], by = {}; d.counties.forEach(c => { by[c.name] = [c.contractors, c.techs]; });
      return { contractors: d.total.contractors, techs: d.total.techs, top: top ? `${top.name} (${thousands(top.contractors)})` : '', new12: d.total.new12, asOf: d.asOfDay, by };
    },
  });

  /* ---------- reads ---------- */
  /* { county name: row }. Pass the page's own housing counts ({ county name or fips: homes }) and each row gains contractors
     per 10,000 homes; newShare is the part of today's contractor licenses first issued in the last 12 months. */
  function byCounty(d, homes) {
    const out = {};
    for (const c of (d && d.counties) || []) {
      const h = homes ? +(homes[c.name] != null ? homes[c.name] : homes[c.fips]) : NaN;
      out[c.name] = Object.assign({}, c, { contractorsPer10kHomes: h > 0 ? Math.round(c.contractors / h * 1e5) / 10 : null, techsPerContractor: c.contractors ? Math.round(c.techs / c.contractors * 10) / 10 : null, newShare: c.contractors && c.new12 != null ? c.new12 / c.contractors : null });
    }
    return out;
  }
  /* What moved since the digest of the previous refresh (record.prev.digest): the totals and the counties that changed, the
     largest contractor change first. fileChanged false means the state has not replaced the file since. null: nothing to compare. */
  function change(d, p) {
    if (!d || !d.total || !p || p.contractors == null) return null;
    const diff = (a, b) => a == null || b == null ? null : a - b;
    const counties = d.counties.map(c => { const was = (p.by || {})[c.name]; return was ? { name: c.name, contractors: c.contractors - was[0], techs: c.techs - was[1] } : null; }).filter(x => x && (x.contractors || x.techs)).sort((a, b) => Math.abs(b.contractors) - Math.abs(a.contractors) || (a.name < b.name ? -1 : 1));
    return { fileChanged: p.asOf !== d.asOfDay, from: p.asOf || null, to: d.asOfDay, contractors: diff(d.total.contractors, p.contractors), techs: diff(d.total.techs, p.techs), new12: diff(d.total.new12, p.new12), counties };
  }
  /* days between the file date and `now`: how old the picture is */
  const ageDays = (d, now) => d && d.asOf ? Math.max(0, Math.floor((+new Date(now || Date.now()) - +new Date(d.asOf)) / DAY)) : null;
  L.tdlr = { fileDate, subtype, queries, parseCounts, parseTexas, parseEntrants, parseNewest, byCounty, change, ageDays, META, RES };
})(typeof globalThis !== 'undefined' ? globalThis : self);
