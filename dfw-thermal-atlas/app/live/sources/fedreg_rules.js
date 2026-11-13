/* ==== live/sources/fedreg_rules.js ==== */
/* The Federal Register documents that shape what a Texas heating contractor may sell and say. Four searches over the last
   24 months: Energy Department standards and test procedures for consumer furnaces, heat pumps and central air conditioners;
   Environmental Protection Agency hydrofluorocarbon rules (40 CFR part 84, the refrigerant transition); Federal Trade
   Commission rules on reviews, endorsements, fees and recurring plans; and anything on the residential energy credits and
   the home energy rebates. A fifth request reads the standing rules that are older than the window and still govern.
   Five requests a week, about 60 KB read. Titles and action lines are the publisher's words: nothing here restates a
   rule. A search that fails keeps its documents from the last run and is named in `stale`. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, API = 'https://www.federalregister.gov/api/v1/documents';
  const MONTHS = 24, CAP = 60, TOPICS = ['furnace', 'heatpump', 'refrigerant', 'credit', 'advertising'];
  /* the abstract is asked for only where the topic is read from it (equipment and credits) */
  const FIELDS = ['document_number', 'publication_date', 'type', 'title', 'html_url', 'effective_on', 'comments_close_on', 'action', 'agencies', 'cfr_references'];
  const tail = abs => FIELDS.concat(abs ? ['abstract'] : []).map(f => 'fields[]=' + f).join('&');
  /* a second between calls. The site turns automated readers of its full text pages away to an access check; the API answers. */
  const OPT = { gapMs: 1100, retries: 2, timeoutMs: 25000, expectFinalUrl: u => /^https:\/\/www\.federalregister\.gov\/api\//.test(u) };
  /* Standing rules by document number, each seen in a live answer on 2026-11-13: the consumer furnace standard (95 percent AFUE
     for gas furnaces, compliance from 2028-12-18), the technology transitions rule for hydrofluorocarbons and the rule on
     managing them in service work, the rule on consumer reviews and testimonials, and the rule on unfair or deceptive fees. */
  const PINS = { '2023-25514': 'furnace', '2023-22529': 'refrigerant', '2024-21967': 'refrigerant', '2024-18519': 'advertising', '2024-30293': 'advertising' };
  const TERM_EQUIP = 'furnace | furnaces | "heat pump" | "heat pumps" | "central air conditioners"';
  const TERM_CREDIT = '"energy efficient home improvement credit" | "residential clean energy credit" | "home energy rebates" | "home efficiency rebates" | "home electrification and appliance rebates"';
  const AGENCY = { 'internal-revenue-service': 'IRS', 'treasury-department': 'Treasury', 'energy-department': 'DOE', 'environmental-protection-agency': 'EPA', 'federal-trade-commission': 'FTC', 'consumer-product-safety-commission': 'CPSC' };
  /* 16 CFR parts: 255 endorsements and testimonials, 425 recurring plans (negative option), 464 unfair or deceptive fees, 465 consumer reviews and testimonials */
  const AD_PARTS = ['255', '425', '464', '465'];

  /* ---------- dates: the register is dated in Washington, the reader is in Dallas ---------- */
  const fmt = tz => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const ET = fmt('America/New_York'), CT = fmt('America/Chicago');
  const isDay = v => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v);
  const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const monthsBack = (ymd, m) => { const p = ymd.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1 - m, p[2])).toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

  /* ---------- which documents belong, and under which topic ---------- */
  const clean = s => String(s == null ? '' : s).replace(/<\/?[a-z][^>]*>/gi, '').replace(/\s+/g, ' ').trim();
  const parts = (r, title) => ((r && r.cfr_references) || []).filter(c => c && +c.title === title && c.part != null).map(c => String(c.part));
  const slugs = r => ((r && r.agencies) || []).map(a => (a && a.slug) || '');
  const agencyOf = r => { const s = slugs(r), k = Object.keys(AGENCY).find(x => s.includes(x)), a = ((r && r.agencies) || [])[0] || {}; return k ? AGENCY[k] : clean(a.name || a.raw_name).slice(0, 60); };
  const FURNACE = /furnace/i, HEATPUMP = /heat pump|central air conditioner/i, OTHER_APPLIANCE = /water heat|pool heat|dryer|room air|portable air/i;
  /* Energy Department documents count when they amend the consumer product rules (10 CFR 430, or 429 alone: 431 is commercial
     equipment) and the title names the product; a title that names no product counts when the abstract names it. */
  function equipment(r) {
    const t = clean(r.title), a = clean(r.abstract), p = parts(r, 10);
    if (slugs(r).includes('energy-department') && !(p.includes('430') || (p.includes('429') && !p.includes('431')))) return null;
    const hit = FURNACE.test(t) ? 'furnace' : HEATPUMP.test(t) ? 'heatpump' : null;
    if (hit) return OTHER_APPLIANCE.test(t) ? null : hit;
    return /consumer furnace|residential furnace/i.test(a) ? 'furnace' : /central air conditioners? and heat pumps?/i.test(a) ? 'heatpump' : null;
  }
  const refrigerant = r => (parts(r, 40).includes('84') ? 'refrigerant' : null);
  const advertising = r => (parts(r, 16).some(p => AD_PARTS.includes(p)) || /consumer reviews|testimonials|endorsements|word\W{0,3}free\b/i.test(clean(r.title)) ? 'advertising' : null);
  const CREDIT = /energy efficient home improvement|residential clean energy|home energy rebate|home efficiency rebate|home electrification and appliance rebate|\b25C\b|\b25D\b/i;
  const credit = r => (CREDIT.test(clean(r.title)) || CREDIT.test(clean(r.abstract)) ? 'credit' : null);
  const search = (q, since, abs) => `${API}.json?${q}&conditions[publication_date][gte]=${since}&order=newest&per_page=100&${tail(abs)}`;
  const BLOCKS = [
    { key: 'equipment', topics: ['furnace', 'heatpump'], topic: equipment, url: s => search(`conditions[term]=${encodeURIComponent(TERM_EQUIP)}&conditions[agencies][]=energy-department&conditions[agencies][]=consumer-product-safety-commission&conditions[type][]=RULE&conditions[type][]=PRORULE`, s, true) },
    { key: 'refrigerant', topics: ['refrigerant'], topic: refrigerant, url: s => search('conditions[agencies][]=environmental-protection-agency&conditions[cfr][title]=40&conditions[cfr][part]=84', s) },
    { key: 'advertising', topics: ['advertising'], topic: advertising, url: s => search('conditions[agencies][]=federal-trade-commission&conditions[type][]=RULE&conditions[type][]=PRORULE', s) },
    { key: 'credit', topics: ['credit'], topic: credit, url: s => search(`conditions[term]=${encodeURIComponent(TERM_CREDIT)}`, s, true) },
    { key: 'standing', pin: true, topic: r => PINS[r.document_number] || null, url: () => `${API}/${Object.keys(PINS).join(',')}.json?${tail()}` },
  ];
  const urls = now => { const s = monthsBack(ET.format(now), MONTHS); return BLOCKS.map(b => b.url(s)); };

  /* one record as stored: the publisher's title, type, dates and action line, our topic, nothing else */
  function doc(r, topic, pin) {
    if (!r || !r.document_number || !isDay(r.publication_date) || !clean(r.title) || !topic) return null;
    const d = { id: String(r.document_number), d: r.publication_date, type: clean(r.type), agency: agencyOf(r), title: clean(r.title), url: /^https:\/\/www\.federalregister\.gov\//.test(r.html_url || '') ? r.html_url : '', topic, effective: isDay(r.effective_on) ? r.effective_on : null, comments: isDay(r.comments_close_on) ? r.comments_close_on : null, action: clean(r.action).slice(0, 140) };
    if (pin) d.pin = true;
    return d;
  }
  /* the list inside an answer: a search with no match has a count and no results; one document asked by number comes bare */
  function rows(j) {
    if (!j || typeof j !== 'object' || (typeof j.count !== 'number' && !j.document_number)) throw new Error('The Federal Register answered without a document list');
    return Array.isArray(j.results) ? j.results : j.document_number ? [j] : [];
  }
  const pick = (j, block) => rows(j).map(r => doc(r, block.topic(r || {}), block.pin)).filter(Boolean);
  const RANK = { Rule: 0, 'Proposed Rule': 1, Notice: 2 };
  const rank = d => (RANK[d.type] != null ? RANK[d.type] : 3);
  const newestFirst = (a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : rank(a) - rank(b) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  async function ask(http, url) {
    try { return await http.json(url, OPT); }
    catch (e) { throw e && /^redirected to/.test(e.body || '') ? new Error('The Federal Register sent its access check page instead of an answer') : e; }
  }

  /* ---------- reads ---------- */
  function byTopic(data) { const out = {}; TOPICS.forEach(t => { out[t] = []; }); ((data && data.docs) || []).forEach(d => { if (out[d.topic]) out[d.topic].push(d); }); return out; }
  /* documents published in the last `days` days, counted back from `now` in Dallas, or from the day of the run when `now` is left out */
  function recent(data, days, now) { if (!data || !Array.isArray(data.docs)) return []; const from = addDays(now ? CT.format(new Date(now)) : data.through, -(days == null ? 90 : days)); return data.docs.filter(d => d.d >= from); }
  /* dates still ahead (today counts): a rule taking effect, a comment period closing. One entry per date, soonest first:
     the document plus what ('effective' | 'comments'), on (the date) and days (from today in Dallas). A proposed rule has no
     effective date of its own (the register repeats the date of the proposal there), so only its comment date is read. */
  function upcoming(data, now) {
    if (!data || !Array.isArray(data.docs)) return [];
    const today = CT.format(now ? new Date(now) : new Date()), out = [];
    data.docs.forEach(d => {
      if (d.effective && d.effective >= today && d.type !== 'Proposed Rule') out.push(Object.assign({}, d, { what: 'effective', on: d.effective, days: daysBetween(today, d.effective) }));
      if (d.comments && d.comments >= today) out.push(Object.assign({}, d, { what: 'comments', on: d.comments, days: daysBetween(today, d.comments) }));
    });
    return out.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : newestFirst(a, b)));
  }

  L.register({
    id: 'fedreg_rules', name: 'Federal rules on heating equipment, refrigerants and advertising', publisher: 'Office of the Federal Register (National Archives)', page: 'https://www.federalregister.gov/',
    about: 'Rules, proposed rules and notices of the last 24 months on consumer furnaces and heat pumps (Energy Department), refrigerants (Environmental Protection Agency), the residential energy credits, and reviews, fees and recurring plans in advertising (Federal Trade Commission), plus the standing rules still in force. Feeds the rules watch in the Heat Desk and keeps offers and copy in step with what is in force.',
    hosts: ['www.federalregister.gov'], cadence: 'weekly', cors: true, grade: 'A', terms: 'U.S. Government work, public domain. No key.',
    labels: { last90: ['Documents published in the last 90 days', 'int'], newest: ['Newest document', 'text'], effective180: ['Rules taking effect in the next 180 days', 'int'] },
    async run(ctx) {
      const prev = ctx.prev && Array.isArray(ctx.prev.docs) ? ctx.prev : null, through = ET.format(ctx.now), since = monthsBack(through, MONTHS);
      const seen = {}, stale = []; let answered = 0, lastErr = null;
      /* a fresh record replaces what is there and a standing rule stays marked; a record kept from the last run only fills a gap */
      const add = (d, fill) => { const o = seen[d.id]; if (!o) seen[d.id] = d; else if (fill) { if (d.pin) o.pin = true; } else seen[d.id] = Object.assign({}, o, d, o.pin || d.pin ? { pin: true } : null); };
      for (const b of BLOCKS) {
        try { pick(await ask(ctx.http, b.url(since)), b).forEach(d => add(d)); answered++; }
        catch (e) { lastErr = e; stale.push(b.key); if (prev) prev.docs.filter(d => (b.pin ? d.pin : b.topics.includes(d.topic) && d.d >= since)).forEach(d => add(d, true)); }
      }
      if (!answered) throw lastErr || new Error('no Federal Register search answered');
      const all = Object.values(seen).sort(newestFirst), pins = all.filter(d => d.pin);
      const docs = all.length > CAP ? all.filter(d => !d.pin).slice(0, Math.max(0, CAP - pins.length)).concat(pins).sort(newestFirst) : all;
      return { v: 1, through, since, docs, failed: stale.length, stale };
    },
    digest(d) {
      const docs = d.docs || [], t = d.through, from = addDays(t, -90), to = addDays(t, 180), n = docs[0];
      return { last90: docs.filter(x => x.d >= from).length, newest: n ? `${n.d} · ${n.agency} · ${n.title.length > 90 ? n.title.slice(0, 90).trim() + '…' : n.title}` : '', effective180: docs.filter(x => x.type === 'Rule' && x.effective && x.effective > t && x.effective <= to).length };
    },
  });
  L.fedreg = { byTopic, recent, upcoming, urls, pick, doc, rows, equipment, refrigerant, advertising, credit, agencyOf, BLOCKS, PINS, TOPICS, MONTHS, CAP };
})(typeof globalThis !== 'undefined' ? globalThis : self);
