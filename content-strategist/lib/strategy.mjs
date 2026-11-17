/* The content plan, read from everything the dashboard knows.

   A page is worth writing where there is work to win, where it pays, where the field is thin, and where the site has
   nothing yet. Each of those lives on a different tab of the dashboard, and this module reads them all:

     the heatmaps and the city records          what each area needs (lib/atlas.mjs, lib/brief.mjs)
     Service Lines                              each line's jobs, ticket, margin and gross profit by ZIP, its season,
                                                the dashboard's own priority and competitive pressure by ZIP and line
     Competitor Watch                           who is in reach of each city, what they sell, what they push
     Paid Acquisition                           where a click costs more than the market, so a ranking is worth more
     the keyword library                        the keyword for each piece, by service angle
     the client's sitemap                       what the site already holds, so nothing is planned twice
     the agent's own built pages                what is written and waiting

   strategy() returns one plain object: the lines, the cities, the competitors and the works, each work a piece of
   content with its keyword, the numbers behind it and a score. The command line prints it (plan, competition), the brief
   draws on it, and the Content Strategist module in the dashboard is this object with a page around it.

   The score is plain on purpose: half of it is the money in the work (gross profit a year, ranked among all the works),
   three tenths is the dashboard's own priority for that line in that place, two tenths is how thin the competition is.
   A work the site already holds is marked down, since the gain is smaller. Nothing here is a search volume. The
   dashboard has none, and the plan says so. */
import { cannibal, cityPage } from './sitemap.mjs';
import { miles } from './atlas.mjs';
import { brief } from './brief.mjs';

export const STRATEGY = 'leviathan.content-strategy';
/* the content angle each service line is written under, where the line's own angle is wider or shared */
const LINE_ANGLE = { repair: 'repair', replace: 'replace', firstwave: 'firstwave', r22: 'r22', heat: 'heatrepair', furnace: 'furnace', heatpump: 'heatpump', duct: 'duct', maint: 'maint', iaq: 'iaq', ductless: 'ductless', hail: 'hail', commercial: 'commercial', landlord: 'landlord' };
/* the lines a city page covers, and the lines that are not written for a homeowner */
const CORE = ['repair', 'heat', 'heatpump', 'furnace'], B2B = new Set(['commercial', 'landlord']);
const REACH = 12;                                                          /* miles: a competitor based this close works the city */
const MARK = { gap: 1, hub: 0.85, page: 0.55, built: 0.3 };                 /* how much of a work's score is left once the site holds it */
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const r1 = x => Math.round(x * 10) / 10, low = s => String(s || '').toLowerCase();
/* what a competitor pushes, as the roster has it: a field left blank or dashed is not an offer */
const given = v => !!v && !/^[-\u2013\u2014\s\u00b7]*$/.test(String(v));
const pushes = k => (k && k.intel ? [given(k.intel.financing) && 'financing: ' + k.intel.financing, given(k.intel.promos) && 'offers: ' + k.intel.promos, given(k.intel.membership) && 'plan: ' + k.intel.membership].filter(Boolean) : []);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = m => MONTHS[((m - 1) % 12 + 12) % 12];

/* strategy({pack, brand, inv, link: {competitors, model, live, paid}, built: [{slug, url, city, keyword, ...}], now}) */
export function strategy({ pack, brand = null, inv = [], link = {}, built = [], now = new Date() } = {}) {
  const { competitors = null, model = null, live = null, paid = null } = link, year = now.getFullYear();
  const angle = Object.fromEntries((pack.angles || []).map(a => [a.id, a])), fill = (k, city) => k.replace(/\{city\}/gi, city).toLowerCase();
  const zpos = new Map(((model && model.zips) || []).map(z => [z.zip, z])), cityOf = name => (pack.cities || []).find(c => same(c.name, name)) || null;
  const slm = live && live.slm ? live.slm : null, zl = slm ? slm.zips || {} : {};

  /* ---- the service lines: what each is worth, when it peaks, who else sells it ---- */
  /* what the client itself says it sells: its own record on the roster and the services in its brand file */
  const selfRec = ((competitors && competitors.companies) || []).find(c => c.self) || null, sells = new Set([...((selfRec && selfRec.services) || []), ...((brand && brand.services) || []).map(x => (typeof x === 'string' ? x : (x && (x.name || x.label)) || ''))].map(low).filter(Boolean));
  const offers = l => (!sells.size ? null : (l.svc || []).some(x => sells.has(low(x)) || [...sells].some(y => y.includes(low(x)) || low(x).includes(y))));
  const lines = ((paid && paid.service && paid.service.lines) || []).map(l => {
    const m = slm ? (slm.lines || []).find(x => x.id === l.id) : null, months = m ? m.months : null, peak = months ? months.indexOf(Math.max(...months)) + 1 : null, a = angle[LINE_ANGLE[l.id]] ? LINE_ANGLE[l.id] : (angle[l.angle] ? l.angle : null);
    return { id: l.id, name: l.name, short: l.short, kind: l.kind, angle: a, b2b: B2B.has(l.id), offered: offers(l), svc: l.svc || [], hooks: (l.hooks || []).slice(0, 4), months, peak,
      /* a page takes weeks to rank, so it goes up two months before the line peaks */
      publishBy: peak ? ((peak - 3 + 12) % 12) + 1 : null,
      unit: m ? { ticket: Math.round(m.unit.ticket), margin: m.unit.margin, close: m.unit.close, gpPerJob: Math.round(m.unit.gpPerJob), cpl: Math.round(m.unit.cpl) } : null,
      totals: m ? { jobs: Math.round(m.totals.jobs), grossProfit: Math.round(m.totals.grossProfit), competitors: m.totals.competitors, competitorsPaid: m.totals.competitorsPaid } : null };
  });
  const lineBy = Object.fromEntries(lines.map(l => [l.id, l]));

  /* ---- the competitors: where each is based, how far its reach goes, which lines it sells ---- */
  const comps = ((competitors && competitors.companies) || []).filter(c => !c.self).map((c, i) => {
    const z = zpos.get((c.zips || [])[0]), home = cityOf((c.cities || [])[0]), pos = z ? { lat: z.lat, lon: z.lon } : home && home.lat ? { lat: home.lat, lon: home.lon } : null, sv = (c.services || []).map(low);
    return { i, name: c.name, domain: c.domain, tier: c.tier, city: (c.cities || [])[0] || '', reviews: c.reviews || 0, rating: c.rating || null, paid: (c.paidKeywords || 0) > 0, scope: c.scope || '', services: c.services || [], brands: c.brands || [], intel: c.intel || null, pos,
      lines: lines.filter(l => l.svc.some(s => sv.includes(low(s)))).map(l => l.id) };
  });
  const me = ((competitors && competitors.companies) || []).find(c => c.self) || null;

  /* ---- the cities ---- */
  const shop = brand && brand.geo && brand.geo.lat ? brand.geo : null, served = new Set(((brand && brand.serviceCities) || []).map(low));
  const names = [...(pack.cities || []).map(c => c.name), ...[...new Set(inv.filter(p => p.kind === 'location' && p.place).map(p => p.place))].filter(n => !cityOf(n))];
  const cities = names.map(name => {
    const C = cityOf(name), hub = cityPage(inv, name), own = inv.filter(p => p.kind === 'service-location' && same(p.place, name) && !p.noindex).map(p => ({ url: p.url, topic: p.topic || p.keyword, angle: p.angle || null }));
    const out = { name, county: C ? C.county : null, inAtlas: !!C, served: !!hub || served.has(low(name)), hub: hub ? hub.url : null, pages: own, miles: C && shop && C.lat ? Math.round(miles(shop, C)) : null };
    if (!C) return out;
    const b = brief({ pack, brand, inv: null, city: name, now: year });
    Object.assign(out, { coverage: C.coverage, built: b.home.builtAround, systems: C.demand.systems, zips: (C.areas || []).map(a => ({ zip: a.zip, share: a.share, built: a.builtAround, needs: a.needs })),
      heating: { gas: b.heating.gas, electric: b.heating.electric, heatPumps: b.heating.heatPumps, lead: b.heating.lead },
      lead: b.lead.map(x => x.id), also: b.also.map(x => x.id), pockets: b.pockets.map(x => [x.id, x.zips]), quiet: b.quiet.map(x => x.id), planning: b.planning.map(x => x.id),
      means: b.home.means, wider: b.wider, fires: Object.fromEntries((C.angles || []).filter(x => x.share > 0).map(x => [x.id, x.share])), facts: C.facts.map(f => [f.say, f.label, f.value, f.plainSource || f.source]), neighbors: (C.neighbors || []).slice(0, 4).map(n => n.name) });
    /* each line here: jobs and gross profit a year, the dashboard's own pressure and priority, weighted by where the jobs are.
       A city that fills only part of its ZIP codes takes that part of their jobs. */
    const cov = C.coverage == null ? 1 : Math.min(1, C.coverage); out.lines = {};
    for (const l of lines) { let jobs = 0, gp = 0, prs = 0, pri = 0; for (const z of C.zips) { const v = zl[z] && zl[z].lines ? zl[z].lines[l.id] : null; if (!v) continue; jobs += v[0]; gp += v[1]; prs += v[2] * v[0]; pri += v[3] * v[0]; }
      if (jobs > 0) out.lines[l.id] = [Math.round(jobs * cov), Math.round(gp * cov), Math.round(prs / jobs), Math.round(pri / jobs)]; }
    /* paid search here against the market: where a click costs more, a page that ranks is worth more */
    const zs = C.zips.map(z => zpos.get(z)).filter(Boolean), w = zs.reduce((n, z) => n + (z.sys || 0), 0); if (w) out.cpc = Math.round(100 * zs.reduce((n, z) => n + (z.cpc_rel || 1) * (z.sys || 0), 0) / w) / 100;
    /* who works this city: based in it, based within reach of it, or working the whole metro */
    const at = c => (c.pos && C.lat ? miles(C, c.pos) : null), near = comps.map(c => ({ c, d: at(c), town: same(c.city, name) })).filter(x => x.town || (x.d != null && x.d <= REACH) || x.c.scope === 'metro-wide');
    const local = near.filter(x => x.town || (x.d != null && x.d <= REACH));
    out.comp = { inTown: near.filter(x => x.town).length, near: local.length, metro: near.length - local.length, paid: near.filter(x => x.c.paid).length,
      top: [...local.sort((a, b) => b.c.reviews - a.c.reviews).slice(0, 8), ...near.filter(x => !local.includes(x)).sort((a, b) => b.c.reviews - a.c.reviews).slice(0, 4)].map(x => [x.c.i, x.d == null ? null : Math.round(x.d)]),
      byLine: Object.fromEntries(lines.map(l => [l.id, near.filter(x => x.c.lines.includes(l.id)).length])) };
    return out;
  });
  const cityBy = Object.fromEntries(cities.map(c => [c.name, c]));

  /* ---- what the agent has built and not yet published ---- */
  const builtKey = new Set(built.map(b => low(b.url || '').replace(/\/+$/, ''))), isBuilt = url => !!url && builtKey.has(low(url).replace(/\/+$/, ''));

  /* ---- the works ---- */
  const works = [], holder = (kw, type, selfUrl = '') => { const r = cannibal(kw, inv, { pack, brand, type, selfUrl }), c = r.conflicts[0]; return r.verdict === 'clear' ? { st: 'gap', u: '' } : { st: c && c.shared ? 'hub' : 'page', u: c ? c.url : '' }; };
  const mean = (id, k) => { let s = 0, w = 0; for (const z of Object.values(zl)) { const v = z.lines && z.lines[id]; if (v) { s += v[k] * v[0]; w += v[0]; } } return w ? Math.round(s / w) : 50; };
  for (const c of cities) {
    if (!c.inAtlas) { if (c.hub) works.push({ id: `city:${c.name}`, t: 'city', c: c.name, l: '', a: 'repair', kw: `ac repair ${low(c.name)}`, st: isBuilt(c.hub) ? 'built' : 'page', u: c.hub, jobs: null, gp: null, pri: null, prs: null, cn: null, pub: null, n: [] }); continue; }
    /* the city page: the four services every city page covers, and the keyword no page of the city's own already holds */
    const core = CORE.map(id => c.lines[id]).filter(Boolean), jobs = core.reduce((n, v) => n + v[0], 0), gp = core.reduce((n, v) => n + v[1], 0), wj = jobs || 1;
    let kw = `ac repair ${low(c.name)}`; if (c.pages.some(p => p.angle === 'repair')) kw = `hvac ${low(c.name)}`;
    works.push({ id: `city:${c.name}`, t: 'city', c: c.name, l: '', a: 'repair', kw, st: c.hub ? (isBuilt(c.hub) ? 'built' : 'page') : 'gap', u: c.hub || '', jobs, gp, pri: Math.round(core.reduce((n, v) => n + v[3] * v[0], 0) / wj), prs: Math.round(core.reduce((n, v) => n + v[2] * v[0], 0) / wj), cn: c.comp.near + c.comp.metro, pub: null, n: c.lead.slice(0, 3) });
    /* one page per service line in the city, where the dashboard finds demand for it there */
    const fires = new Set(((cityOf(c.name) || {}).angles || []).filter(x => x.share > 0).map(x => x.id));
    for (const l of lines) {
      const v = c.lines[l.id], a = angle[l.angle]; if (!v || !a || l.b2b || !fires.has(l.angle) || !(a.keywords.city || []).length) continue;
      const k = fill(a.keywords.city[0], c.name), h = holder(k, 'landing');
      /* a section of the city page stays a section, even when the agent has just rebuilt that city page */
      works.push({ id: `line:${c.name}:${l.id}`, t: 'service-city', c: c.name, l: l.id, a: l.angle, kw: k, st: h.st !== 'hub' && isBuilt(h.u) ? 'built' : h.st, u: h.u, jobs: v[0], gp: v[1], pri: v[3], prs: v[2], cn: c.comp.byLine[l.id] || 0, pub: l.publishBy, n: (pack.needs || []).filter(n => n.copy && n.angles.includes(l.angle) && (c.lead.includes(n.id) || c.also.includes(n.id))).map(n => n.id).slice(0, 3) });
    }
  }
  for (const l of lines) {
    const a = angle[l.angle]; if (!a || !l.totals) continue; const pri = mean(l.id, 3), prs = mean(l.id, 2), base = { l: l.id, a: l.angle, jobs: l.totals.jobs, gp: l.totals.grossProfit, pri, prs, cn: l.totals.competitors, pub: l.publishBy, n: [] };
    /* the service page for the whole market, then the questions people ask about it */
    const k = low(a.keywords.core[0]), h = holder(k, 'landing'); works.push(Object.assign({ id: `service:${l.id}`, t: 'service', c: '', kw: k, st: isBuilt(h.u) ? 'built' : h.st, u: h.u }, base));
    for (const q of (a.keywords.questions || []).slice(0, 3)) { const hq = holder(q, 'blog'); works.push(Object.assign({ id: `post:${l.id}:${q}`, t: 'post', c: '', kw: low(q), st: isBuilt(hq.u) ? 'built' : hq.st === 'hub' ? 'page' : hq.st, u: hq.u }, base)); }
  }
  /* the score: the money ranked among all the works, the dashboard's own priority, how thin the field is */
  const gps = works.map(w => w.gp).filter(v => v > 0).sort((x, y) => x - y), rank = v => { if (!(v > 0) || !gps.length) return 0; let lo = 0, hi = gps.length; while (lo < hi) { const m = (lo + hi) >> 1; if (gps[m] < v) lo = m + 1; else hi = m; } return Math.round(100 * lo / gps.length); };
  for (const w of works) { w.val = rank(w.gp); w.sc = w.gp == null ? 0 : Math.round((MARK[w.st] || 1) * (0.5 * w.val + 0.3 * (w.pri ?? 50) + 0.2 * (100 - (w.prs ?? 50)))); }
  works.sort((x, y) => y.sc - x.sc || (y.gp || 0) - (x.gp || 0));

  return {
    format: STRATEGY, v: 1, made: now.toISOString(), year, atlas: { name: pack.atlas, source: pack.source ? { file: (pack.source.pin || {}).file || pack.source.file, sha256: pack.source.sha256 } : null }, vertical: pack.vertical,
    client: brand ? { name: brand.name, short: brand.short || brand.name, url: brand.url, city: (brand.address || {}).city || '', reviews: me ? me.reviews : null, rating: me ? me.rating : null, services: me ? me.services : [] } : null,
    site: { pages: inv.length, kinds: inv.reduce((o, p) => (o[p.kind] = (o[p.kind] || 0) + 1, o), {}) },
    reads: { heatmaps: !!(pack.needs && pack.needs.length), lines: lines.some(l => l.unit), competitors: comps.length, paid: !!(model && model.zips), sitemap: inv.length > 0, built: built.length, asOf: { competitors: competitors ? competitors.asOf || null : null, model: live ? live.at || null : null } },
    reach: REACH, mark: MARK, lines, angles: (pack.angles || []).map(a => ({ id: a.id, label: a.label, line: a.line, why: a.why || '', kw: { core: a.keywords.core || [], city: a.keywords.city || [], questions: a.keywords.questions || [], negatives: a.keywords.negatives || [] } })),
    negatives: pack.negatives || {}, needs: (pack.needs || []).map(n => ({ id: n.id, title: n.title, owner: n.owner, tech: n.tech, copy: n.copy, metro: n.metro, angles: n.angles })),
    market: ((pack.market && pack.market.facts) || []).map(f => [f.say, f.label, f.value, f.plainSource || f.source]),
    cities, competitors: comps.map(({ pos, ...c }) => c), works, built: built.map(b => ({ slug: b.slug, url: b.url || '', city: b.city || '', keyword: b.keyword || '', title: b.title || '', words: b.words ?? null, grade: b.grade ?? null })),
  };
}

/* ---------- reading the plan ---------- */
const TYPE = { city: 'City page', 'service-city': 'Service page for a city', service: 'Service page', post: 'Post' };
const STATUS = { gap: 'nothing on the site', hub: 'a section of the city page', page: 'a page holds it', built: 'built, not yet live' };
export const workTitle = (w, S) => { const l = S.lines.find(x => x.id === w.l); return w.t === 'city' ? `City page: ${w.c}` : w.t === 'service-city' ? `${l ? l.name : w.a} in ${w.c}` : w.t === 'service' ? `${l ? l.name : w.a}` : `Post: ${w.kw}`; };
const money = v => (v == null ? '' : v >= 1e9 ? '$' + r1(v / 1e9) + 'B' : v >= 1e6 ? '$' + r1(v / 1e6) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'k' : '$' + Math.round(v));
const count = v => (v == null ? '' : v >= 1e4 ? Math.round(v / 1e3) + 'k' : v >= 1000 ? r1(v / 1e3) + 'k' : String(Math.round(v)));

/* why a work stands where it does, in sentences */
export function whyWork(w, S) {
  const l = S.lines.find(x => x.id === w.l), c = S.cities.find(x => x.name === w.c), out = [];
  if (w.jobs != null) out.push(`${w.t === 'city' ? 'The four services a city page covers' : l ? l.name : 'This service'} ${w.c ? 'in ' + w.c : 'across the market'}: about ${count(w.jobs)} jobs a year and ${money(w.gp)} in gross profit, by the dashboard's service line model. That ranks above ${w.val}% of the works in this plan.`);
  if (w.pri != null) out.push(`The dashboard's own priority for it here is ${w.pri} of 100, and competitive pressure is ${w.prs} of 100${w.prs <= 40 ? ', a thin field' : w.prs >= 70 ? ', a crowded field' : ''}.`);
  if (w.cn != null) out.push(w.c ? `${w.cn} compan${w.cn === 1 ? 'y' : 'ies'} in reach of ${w.c} ${w.l ? 'sell this service' : 'work the city'}.` : `${w.cn} companies on the roster sell this service.`);
  if (l && l.peak) out.push(`${l.name} peaks in ${monthName(l.peak)}, so the page should be live by ${monthName(l.publishBy)}.`);
  if (l && l.offered === false) out.push('The client does not list this service among its own. Confirm they sell it before a page is written.');
  if (c && c.cpc && c.cpc >= 1.15) out.push(`A paid click here costs about ${Math.round(100 * (c.cpc - 1))}% more than across the market, so a page that ranks is worth more.`);
  out.push(w.st === 'gap' ? 'No live page holds this keyword.' : w.st === 'hub' ? `Today it is only a section of the city page (${w.u}). A page of its own is a split, and that is the client's call.` : w.st === 'built' ? `The agent has built it (${w.u}); it is not live yet.` : `A live page already holds it (${w.u}), so this would be a rewrite, and it scores lower for that.`);
  return out;
}

/* the plan as text: the top works, filtered */
export function planText(S, { city = '', type = '', line = '', status = '', top = 25 } = {}) {
  let W = S.works.filter(w => (!city || same(w.c, city)) && (!type || w.t === type) && (!line || w.l === line) && (!status || w.st === status)); const all = W.length; W = W.slice(0, top);
  const head = `CONTENT PLAN  ${S.atlas.name}${S.client ? ' · ' + S.client.short : ''}  ·  ${S.works.length} works, ${S.works.filter(w => w.st === 'gap').length} with nothing on the site, ${S.works.filter(w => w.st === 'built').length} built and waiting`;
  const reads = `Read from: ${[S.reads.heatmaps ? 'the heatmaps' : '', S.reads.lines ? 'Service Lines (jobs, gross profit, season, priority and pressure by ZIP)' : 'Service Lines NOT read (open the dashboard once with a browser on this machine: connect)', S.reads.competitors ? `Competitor Watch (${S.reads.competitors} companies)` : 'Competitor Watch NOT read', S.reads.paid ? 'Paid Acquisition (click cost by ZIP)' : '', S.reads.sitemap ? `the sitemap (${S.site.pages} live URLs)` : 'NO sitemap: every work reads as a gap'].filter(Boolean).join('; ')}.`;
  const rows = W.map((w, i) => `${String(i + 1).padStart(3)}. ${String(w.sc).padStart(3)}  ${workTitle(w, S)}\n       keyword: ${w.kw}  ·  ${TYPE[w.t]}  ·  ${STATUS[w.st]}${w.u ? ' (' + w.u.replace(/^https?:\/\/[^/]+/, '') + ')' : ''}\n       ${w.jobs == null ? 'outside the mapped area: no figures' : `${count(w.jobs)} jobs, ${money(w.gp)} gross profit a year  ·  priority ${w.pri}  ·  pressure ${w.prs}  ·  ${w.cn} competitor${w.cn === 1 ? '' : 's'}${w.pub ? '  ·  live by ' + monthName(w.pub) : ''}`}`);
  return [head, reads, 'The score: half the money in the work, three tenths the dashboard\'s own priority there, two tenths how thin the competition is; marked down when the site already holds it. The dashboard has no search volumes, and neither does this plan.', '', ...rows, '', all > W.length ? `${all - W.length} more. Narrow with --city, --type city|service-city|service|post, --line <id>, --status gap|hub|page|built, or raise --top.` : ''].filter(x => x !== '').join('\n');
}

/* who a city page is up against */
export function competitionText(S, name) {
  const c = S.cities.find(x => same(x.name, name)); if (!c) return `"${name}" is not a city in this plan.`;
  if (!c.comp) return `${c.name} lies outside the mapped area, so the dashboard has no competitor read for it.`;
  const T = [`COMPETITION  ${c.name}${c.county ? ', ' + c.county + ' County' : ''}  ·  ${c.comp.inTown} based in town, ${c.comp.near} within ${S.reach} miles, ${c.comp.metro} more working the whole metro, ${c.comp.paid} running paid search`, ''];
  T.push('By service line (companies in reach that sell it, and the dashboard\'s pressure there):', ...S.lines.filter(l => c.lines[l.id]).map(l => `  ${l.name.padEnd(34)} ${String(c.comp.byLine[l.id] || 0).padStart(3)} sell it  ·  pressure ${String(c.lines[l.id][2]).padStart(3)}  ·  priority ${String(c.lines[l.id][3]).padStart(3)}  ·  ${count(c.lines[l.id][0])} jobs a year`), '');
  T.push('The largest by reviews:'); for (const [i, d] of c.comp.top) { const k = S.competitors.find(x => x.i === i); if (!k) continue; T.push(`  ${k.name}  ·  ${k.city}${d != null ? `, ${d} mi` : ''}${k.scope === 'metro-wide' ? ' (metro wide)' : ''}  ·  ${count(k.reviews)} reviews${k.rating ? ' at ' + k.rating : ''}${k.paid ? '  ·  runs paid search' : ''}`); if (pushes(k).length) T.push('     pushes: ' + pushes(k).join('  |  ')); }
  T.push('', 'Use this to choose what a page leads with and what it must answer. Never name a competitor on a page, and never claim to beat one without a basis the client gives you.');
  return T.join('\n');
}

/* that part of the plan as the last sections of a brief */
export function cityStrategyText(cs, city, { roster = true } = {}) {
  const T = ['', `THE WORKS WORTH WRITING HERE  (from the content plan: plan --city "${city}")`, ...cs.works.map(w => `  ${String(w.score).padStart(3)}  ${w.title}  ·  keyword: ${w.keyword}  ·  ${w.status}${w.jobs != null ? `  ·  about ${count(w.jobs)} jobs and ${money(w.grossProfit)} gross profit a year across every company  ·  pressure ${w.pressure}${w.liveBy ? '  ·  live by ' + w.liveBy : ''}` : ''}`)];
  if (roster) T.push('', `WHO THE PAGE IS UP AGAINST  (${cs.competitors.inTown} based in town, ${cs.competitors.near} within reach, ${cs.competitors.metro} more working the whole metro, ${cs.competitors.paid} on paid search)`, ...cs.competitors.top.flatMap(k => [`  ${k.name}  ·  ${k.city}${k.miles != null ? ', ' + k.miles + ' mi' : ''}  ·  ${count(k.reviews)} reviews${k.paid ? '  ·  paid search' : ''}`, k.pushes.length ? '     pushes: ' + k.pushes.join('  |  ') : '']).filter(Boolean), '  Read it to choose what the page leads with and what it must answer. Never name a competitor on a page, and never claim to beat one without a basis the client gives you.');
  if (cs.clickCost && cs.clickCost >= 1.15) T.push(`  A paid click here costs about ${Math.round(100 * (cs.clickCost - 1))}% more than across the market, so a page that ranks is worth more.`);
  return T.join('\n');
}

/* the part of the plan a brief for one city carries */
export function cityStrategy(S, name) {
  const c = S.cities.find(x => same(x.name, name)); if (!c || !c.inAtlas) return null;
  return { works: S.works.filter(w => same(w.c, c.name)).slice(0, 8).map(w => ({ title: workTitle(w, S), keyword: w.kw, status: STATUS[w.st], url: w.u, score: w.sc, jobs: w.jobs, grossProfit: w.gp, priority: w.pri, pressure: w.prs, competitors: w.cn, liveBy: w.pub ? monthName(w.pub) : '' })),
    competitors: { inTown: c.comp.inTown, near: c.comp.near, metro: c.comp.metro, paid: c.comp.paid, top: c.comp.top.slice(0, 6).map(([i, d]) => { const k = S.competitors.find(x => x.i === i); return k ? { name: k.name, city: k.city, miles: d, reviews: k.reviews, rating: k.rating, paid: k.paid, pushes: pushes(k) } : null; }).filter(Boolean) },
    clickCost: c.cpc || null, milesFromShop: c.miles };
}
