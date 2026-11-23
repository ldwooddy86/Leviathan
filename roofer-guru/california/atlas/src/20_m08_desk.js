/* ==== 20_m08_desk.js ==== */
/* ==== src/20_m08_desk.js ==== */
/* ==== m08_desk ==== */
"use strict";
/* ============================ Module 8: Campaign Desk (California) ============================ */
/* Reads: ZIP columns zip, city, pi, reg, pop, cpc_rel, gid, res_ok, p_<line> (through SLM.zipAll and SLM.zipLine), the language columns
   named in DESK_LANGS, bid (fallback only); PL / PLI (angles, kw, kwEs, neg, tok, seg, name, short); SLM; BRAND; SAT; ACCT.PREFIX;
   LINE_TIER and TIER_BID from module 12 (called at mount, after every script has loaded); an optional event table (deskEvents). */
const PLATS = ['google', 'lsa', 'dg', 'meta', 'microsoft', 'tiktok'];
const PLAB = { google: 'Google Search', lsa: 'Local Services Ads', dg: 'YouTube and Demand Gen', meta: 'Meta', microsoft: 'Microsoft Advertising', tiktok: 'TikTok' };
/* The plan is stored under one key. Module 15 (pacing card) and the Site Forge read the same key. */
const DESK_KEY = 'cg.desk.v1';
/* One base cost per click for the whole atlas: the service line model's (module 12). The Desk used to carry its own copy, which could drift. */
const DESK_CPC0 = (typeof SLM !== 'undefined' && SLM.DEF && +SLM.DEF.cpc) || 38;
const ASM0 = {
  google: { basis: 'CPC', cost: DESK_CPC0, ctr: 5.5, cvr: 9.0, min: 30, g: 'D', src: 'Assumption: the service line model\'s base cost per click (module 12), times each line\'s multiplier and each ZIP\'s relative cost (module 05). No California click price was measured for this build; storm and fire weeks run higher.' },
  lsa: { basis: 'CPL', cost: 90, ctr: 0, cvr: 100, min: 20, g: 'D', src: 'Assumption: cost per Local Services lead for roofing, not measured in California; disputed and unqualified leads are credited on request' },
  dg: { basis: 'CPM', cost: 12, ctr: 0.5, cvr: 1.5, min: 15, g: 'D', src: 'Assumption' },
  meta: { basis: 'CPM', cost: 18, ctr: 0.9, cvr: 6.0, min: 15, g: 'D', src: 'Assumption; lead form objective, home services audiences' },
  microsoft: { basis: 'CPC', cost: Math.round(DESK_CPC0 * 2 / 3), ctr: 4.5, cvr: 8.0, min: 15, g: 'D', src: 'Assumption; two thirds of the search base' },
  tiktok: { basis: 'CPM', cost: 9, ctr: 0.8, cvr: 1.5, min: 15, g: 'D', src: 'Assumption' },
};
/* Starting platform mix for each of the thirteen lines, percent of budget (each row sums to 100). Judgment, grade D: urgent lines lean on
   search and Local Services, considered purchases (fire hardening, metal, tile underlayment, solar reroofs) on video and Meta, business
   to business lines on search and Microsoft with no Local Services. */
const MIX0 = {
  replace: { google: 50, lsa: 22, dg: 6, meta: 14, microsoft: 6, tiktok: 2 },
  repair: { google: 50, lsa: 30, dg: 2, meta: 10, microsoft: 8, tiktok: 0 },
  storm: { google: 55, lsa: 25, dg: 2, meta: 12, microsoft: 6, tiktok: 0 },
  fire: { google: 50, lsa: 10, dg: 8, meta: 22, microsoft: 8, tiktok: 2 },
  harden: { google: 45, lsa: 10, dg: 10, meta: 25, microsoft: 8, tiktok: 2 },
  tile: { google: 52, lsa: 15, dg: 8, meta: 17, microsoft: 6, tiktok: 2 },
  solar: { google: 55, lsa: 10, dg: 6, meta: 19, microsoft: 8, tiktok: 2 },
  metal: { google: 48, lsa: 10, dg: 12, meta: 22, microsoft: 6, tiktok: 2 },
  mh: { google: 45, lsa: 20, dg: 2, meta: 25, microsoft: 6, tiktok: 2 },
  mf: { google: 70, lsa: 0, dg: 5, meta: 10, microsoft: 15, tiktok: 0 },
  comm: { google: 70, lsa: 0, dg: 5, meta: 8, microsoft: 17, tiktok: 0 },
  coat: { google: 65, lsa: 0, dg: 10, meta: 10, microsoft: 15, tiktok: 0 },
  newc: { google: 60, lsa: 0, dg: 5, meta: 20, microsoft: 15, tiktok: 0 },
  blend: { google: 52, lsa: 20, dg: 6, meta: 14, microsoft: 6, tiktok: 2 },
};
/* the default blend: the five residential lines most California roofers sell together */
const DESK_BLEND0 = ['replace', 'repair', 'storm', 'tile', 'harden'];
const PBOOK = {
  google: { geo: 'ZIP criteria with bid modifiers; Google criterion IDs are carried for the California ZIPs Google lists, the rest resolve by name. Presence only ("people in or regularly in"), not interest.', bulk: 'Google Ads Editor CSV: Account, Import, From file. Every object is paused.', policy: [
    'Roofing is not a restricted category for search ads in the United States; editorial rules apply (no exclamation in headlines, no shouting, no phone numbers in ad text).',
    'Every licensed contractor must put the license number in all forms of advertising (Business and Professions Code 7030.5). The desk writes the company name, the CSLB license number and an office city into a description of every ad and pins it to the first description position so it always serves.',
    'No offer to waive, rebate or absorb an insurance deductible in any asset (Penal Code 551), and no promise to negotiate or settle a claim: negotiating a claim for pay is public adjusting and needs its own license (Insurance Code 15006, 15007). The desk never writes either and the lint blocks them.',
    'No promised insurance discount for a Class A roof or fire hardening: the Safer from Wildfires rule (10 CCR 2644.9) makes insurers that price wildfire risk recognize the work, but each insurer files its own amount.',
    'After a declared emergency a contractor\'s repair prices may not rise more than 10 percent above the price before it for 180 days (Penal Code 396). Keep the dated price book.',
    'Financing trigger terms (a payment, a term, a rate) need the Regulation Z disclosures in the same ad; the desk writes "financing available" at most.'] },
  lsa: { geo: 'Service area by ZIP list per business profile', bulk: 'No bulk upload. Build sheet: business profile, license and insurance documents, job types, service ZIPs, weekly budget, hours, languages.', policy: [
    'Google checks the business license and insurance and runs background checks before the Google Guaranteed badge shows; the CSLB license must be current and unsuspended.',
    'A C-39 Roofing licensee must keep a workers\' compensation certificate on file with the CSLB even with no employees (Business and Professions Code 7125); a lapse suspends the license and the profile with it.',
    'Leads are charged per lead; dispute unqualified leads in the console window.',
    'Ranking follows responsiveness, reviews and proximity; answer every lead fast, most of all in the first rain of the season.'] },
  dg: { geo: 'Same Google criteria; YouTube placements and custom segments', bulk: 'Build sheet plus custom segment term lists.', policy: [
    'Custom segments from the keyword desk terms.',
    'Video: show your own crews and real local jobs, with each owner\'s written permission for their home; storm and fire footage must be real and labeled with place and date. No footage of burned homes without the owner\'s consent.'] },
  meta: { geo: 'ZIP keys (US:90001) or radius around office cities. Roofing is not a special ad category; ads that offer financing fall under Financial products and services, which limits targeting.', bulk: 'Ads Manager, Import and Export: CSV with Campaign Name, Objective, Ad Set Name, Zip, Ad Name, Title, Body, Link, Call to Action.', policy: [
    'Personal attributes: never assert the reader\'s finances, insurance status or hardship ("lost your insurance", "dropped by your insurer", "behind on bills"); describe the service and the place.',
    'Lead forms: consent language for calls and texts, unchecked; ask the address and the best time to inspect, not insurance or claim details.',
    'The CSLB license number appears in the primary text (Business and Professions Code 7030.5).'] },
  microsoft: { geo: 'ZIP and city by name', bulk: 'Import from Google Ads, or the same Editor CSV with campaign names suffixed _MS.', policy: ['Same editorial practice as Google; audience network off at launch.'] },
  tiktok: { geo: 'Designated market area or city level; ZIP targeting is limited.', bulk: 'Build sheet for TikTok Ads Manager.', policy: [
    'Home improvement ads are allowed with platform review; claims, reviews and testimonials follow the FTC rules (16 CFR Parts 255 and 465).',
    'Creator content counts as the company\'s advertising once paid or boosted, so it carries the license number too.'] },
};
/* How each line is named in social copy, and one plain sentence of what the work is. Each sentence states only what the evidence file
   supports: the tear off rule (California Residential Code R908.3), tile reuse (R908.5), Class A and vents in Fire Hazard Severity Zones
   (Wildland-Urban Interface Code 504, 507), the separate permit and license for solar (Los Angeles County Building Code Manual 1512),
   Cool Roof Rating Council ratings under Title 24 Part 6, and the solar requirement on new houses (2019 Energy Code). */
const SOC = { replace: 'roof replacement', repair: 'roof leak repair', storm: 'wind and rain damage roof repair', fire: 'wildfire damage and rebuild roofing', harden: 'fire hardened Class A roofs', tile: 'tile roof underlayment replacement', solar: 'solar detach and reset for reroofs', metal: 'metal roofing', mh: 'manufactured home roofing', mf: 'multifamily and HOA roofing', comm: 'commercial roofing', coat: 'roof coating and restoration', newc: 'new construction roofing' };
const SOCX = {
  replace: 'The old roof comes off to the deck, new underlayment goes down, and a permit is pulled where the city or county requires one.',
  repair: 'Leaks are traced to their source and fixed before the next rain, with photos of what was wrong.',
  storm: 'After high wind or an atmospheric river the crew tarps what is open, photographs the damage and writes an itemized estimate.',
  fire: 'Rebuild roofs are Class A assemblies with ember resistant vents, built to the wildfire code that applies at the address.',
  harden: 'A Class A roof assembly, ember resistant vents and noncombustible gutters, the roof items the wildfire building code asks for in Fire Hazard Severity Zones.',
  tile: 'The tile comes up, new underlayment and flashings go down, and the sound tile goes back on.',
  solar: 'Panels come off before the reroof and go back after it, handled by a licensed electrical or solar contractor with the permit the city or county requires.',
  metal: 'Standing seam and metal panel roofs, flashed and fastened for the site.',
  mh: 'Roof overs, recovers and leak repairs for manufactured homes.',
  mf: 'Reroofs and tile underlayment work for apartments, condominiums and associations, phased around the residents.',
  comm: 'Low slope reroofs with membranes rated by the Cool Roof Rating Council where Title 24 requires a cool roof.',
  coat: 'Coatings applied over the whole roof at the thickness the maker specifies, with rated reflectance where Title 24 applies.',
  newc: 'Roofs for new homes and buildings, coordinated with the solar the Energy Code requires on new houses.',
};
/* headlines the desk adds for each line, each 30 characters or fewer after cleaning (the angle library in PL comes first) */
const DESK_H = {
  replace: ['Tear Off and Reroof', 'New Roof Estimates'], repair: ['Roof Leak Repair', 'Leak Found and Fixed'], storm: ['Wind and Rain Roof Repair', 'Emergency Roof Tarps'],
  fire: ['Wildfire Rebuild Roofing', 'Class A Roof Rebuilds'], harden: ['Class A Fire Rated Roofs', 'Ember Resistant Roof Vents', 'Fire Zone Roof Upgrades'],
  tile: ['Tile Roof Underlayment', 'Tile Lift and Relay', 'Keep Your Tile, Fix the Leak'], solar: ['Solar Detach and Reset', 'Reroof Under Solar Panels'],
  metal: ['Standing Seam Metal Roofs'], mh: ['Mobile Home Roof Overs'], mf: ['HOA and Apartment Roofing'], comm: ['Title 24 Cool Roofs', 'Commercial Reroofing'], coat: ['Cool Roof Coatings'], newc: ['Roofing for New Homes'],
};
const DESK_H_ES = {
  replace: ['Reemplazo de Techos'], repair: ['Reparación de Goteras'], storm: ['Goteras Después de la Lluvia', 'Daños por Viento en el Techo'], fire: ['Techos Tras un Incendio'], harden: ['Techos Clase A'],
  tile: ['Reparación de Techos de Teja'], solar: ['Reemplazo de Techo con Solar'], metal: ['Techos de Metal'], mh: ['Techos para Casas Móviles'], mf: ['Techos para Condominios'], comm: ['Techos Comerciales'], coat: ['Recubrimiento de Techos'], newc: ['Techos para Obra Nueva'],
};
/* question keywords by line: what a California owner or manager types before calling a roofer */
const QKW = {
  replace: ['how much does a new roof cost in california', 'how long does a roof last in california', 'signs you need a new roof', 'do i need a permit to reroof in california', 'cool roof requirements for reroof'],
  repair: ['roof leak repair near me', 'how much to fix a roof leak', 'emergency roof repair', 'repair or replace roof'],
  storm: ['roof leak after heavy rain', 'emergency roof tarp', 'wind damage to roof what to do', 'roof damage after santa ana winds', 'atmospheric river roof leak'],
  fire: ['roof replacement after wildfire', 'fire damaged roof repair', 'rebuilding after wildfire roof requirements', 'smoke and ash roof inspection'],
  harden: ['class a fire rated roof', 'ember resistant vents', 'fire hardening roof california', 'roof requirements fire hazard severity zone', 'safer from wildfires class a roof'],
  tile: ['tile roof underlayment replacement', 'tile roof lift and relay', 'tile roof leak repair', 'how long does tile roof underlayment last', 'tile roof underlayment cost'],
  solar: ['remove and reinstall solar panels for roof replacement', 'solar panel detach and reset', 'reroof with solar panels', 'solar removal for reroof cost'],
  metal: ['metal roof cost california', 'metal roof vs shingles', 'standing seam metal roof', 'metal roof fire rating', 'cool metal roof'],
  mh: ['mobile home roof replacement', 'mobile home roof over', 'mobile home roof leak repair', 'manufactured home roof coating'],
  mf: ['apartment roof replacement', 'hoa roof replacement', 'condo roof repair', 'multifamily roofing contractor', 'hoa tile roof underlayment replacement'],
  comm: ['commercial roof replacement cost', 'tpo roofing contractor', 'flat roof repair', 'title 24 cool roof requirements', 'commercial roof inspection'],
  coat: ['silicone roof coating', 'commercial roof restoration', 'cool roof coating', 'roof maintenance program'],
  newc: ['new construction roofing contractor', 'builder roofing subcontractor', 'roofing for new homes', 'solar ready roof new construction'],
};
/* Event ad groups. Louisiana's desk built these from named hurricanes; California's events are of four kinds. Each kind has its service line,
   headlines (30 characters or fewer), one description (90 or fewer), core keywords and a landing slug. {Name} is the event's name when it has one. */
const DESK_EV = {
  rain: { label: 'Heavy rain and atmospheric river', line: 'storm', first: 'put a bucket under the leak, photograph the ceiling and call for a tarp',
    h: ['Roof Leak After the Storm?', 'Rain Damage Roof Repair', 'Storm Roof Leak Repair', 'Emergency Roof Tarps', 'Roof Inspection After Rain'],
    d: 'Leak after the rain? A licensed roofer finds the source, tarps it and writes an estimate.',
    kw: ['roof leak repair', 'emergency roof repair', 'roof leak after rain', 'emergency roof tarp', 'storm damage roof repair', 'roof tarp service'], slug: 'roof leak repair after rain' },
  wind: { label: 'High wind (Santa Ana, Diablo, sundowner or winter storm)', line: 'storm', first: 'photograph the damage from the ground and call for a tarp',
    h: ['Wind Damage Roof Repair', 'Shingles or Tiles Blown Off?', 'Emergency Roof Tarps', 'Roof Inspection After Wind', 'Storm Damage Roof Repair'],
    d: 'Wind damage? A licensed roofer photographs it, tarps what is open and writes an estimate.',
    kw: ['wind damage roof repair', 'shingles blown off roof', 'tile roof wind damage', 'roof blown off', 'emergency roof tarp', 'storm damage roof repair'], slug: 'wind damage roof repair' },
  fire: { label: 'Wildfire damage and rebuild', line: 'fire', first: 'wait until the area is reopened, then photograph the roof from the ground before anything is moved',
    h: ['Wildfire Rebuild Roofing', 'Roof Damage After a Fire?', 'Smoke and Ember Roof Check', 'Class A Roof Rebuilds', 'Fire Rebuild Roofing', '{Name} Fire Rebuild Roofing'],
    d: 'Rebuilding after the fire? Class A roofs built to the wildfire code, with written estimates.',
    kw: ['fire damage roof repair', 'wildfire rebuild roofing', 'roof replacement after fire', 'smoke damage roof inspection', 'class a roof replacement', 'fire rebuild roofing contractor'], slug: 'wildfire rebuild roofing' },
  snow: { label: 'Mountain snow load', line: 'storm', first: 'stay off the roof, photograph sagging or cracked ceilings and call',
    h: ['Snow Damage Roof Repair', 'Roof Leak From Ice or Snow?', 'Emergency Roof Tarps', 'Roof Inspection After Snow'],
    d: 'Snow or ice damage? A licensed roofer inspects the roof and framing and writes an estimate.',
    kw: ['snow damage roof repair', 'roof collapse repair', 'ice dam roof leak', 'emergency roof repair'], slug: 'snow damage roof repair' },
};
const deskEvKind = t => { t = String(t || '').toLowerCase(); return /fire|burn|smoke|ember/.test(t) ? 'fire' : /snow|ice\b|blizzard/.test(t) ? 'snow' : /wind|santa ana|diablo|sundowner|gust/.test(t) ? 'wind' : 'rain'; };
/* Named events for the event ad group, if the data carries a table of them. The hazard data job owns its shape; this reads whichever of
   DATA.events, DATA.hazard_events or DATA.ts.events is an array, and from each row a name (name, n, title or label), a kind or type, and a year. */
function deskEvents() {
  const D0 = (typeof DATA !== 'undefined' && DATA) || {}; const src = [D0.events, D0.hazard_events, D0.ts && D0.ts.events].find(a => Array.isArray(a) && a.length) || [];
  const out = []; const seen = new Set();
  src.forEach(e => { if (!e || typeof e !== 'object') return; const name = String(e.name || e.n || e.title || e.label || '').trim(); if (!name) return; const year = +e.year || +e.y || (e.date ? +String(e.date).slice(0, 4) : 0) || (e.start ? +String(e.start).slice(0, 4) : 0) || null; const kind = deskEvKind((e.kind || e.type || e.k || '') + ' ' + (/fire/i.test(String(e.kind || e.type || '')) ? '' : name)); const id = String(e.id || e.r || (name + (year ? ' ' + year : ''))); if (seen.has(id)) return; seen.add(id); out.push({ id, name, year, kind, month: +e.month || +e.m || null, n: +e.dest || +e.destroyed || +e.n_dest || +e.est || null, zips: Array.isArray(e.zips) ? e.zips.map(String) : null }); });
  return out.sort((a, b) => (b.year || 0) - (a.year || 0) || a.name.localeCompare(b.name));
}
/* Languages. Louisiana built a Spanish campaign wherever 8 percent of residents spoke Spanish at home. In California that share is 28 percent
   statewide (ACS C16001), so the old rule would fire almost everywhere and say nothing. The rule here asks who needs the language, not who
   speaks it: residents who speak the language at home AND speak English less than very well, as a percent of residents 5 and over.
   A market qualifies when that share is at least the threshold AND it stands for at least DESK_LANG_MIN people. The default threshold is one and
   a half times the statewide share (population weighted over the scored ZIPs), never below DESK_LANG_FLOOR percent; the user can set another.
   Where a language has no limited English column, the share speaking it at home is used with the floor doubled.
   build: the desk writes campaigns and copy (Spanish only). Advice only for the others: the desk does not write copy in a language nobody
   here can proof. */
const DESK_LANGS = [
  { k: 'es', name: 'Spanish', sh: 'span_sh', lep: 'span_lep_sh', build: true },
  { k: 'zh', name: 'Chinese', sh: 'chin_sh', lep: 'chin_lep_sh' },
  { k: 'vi', name: 'Vietnamese', sh: 'viet_sh', lep: 'viet_lep_sh' },
  { k: 'tl', name: 'Tagalog', sh: 'tagalog_sh', lep: 'tagalog_lep_sh' },
  { k: 'ko', name: 'Korean', sh: 'korean_sh', lep: 'korean_lep_sh' },
];
const DESK_LANG_MIN = 1000, DESK_LANG_FLOOR = 5, DESK_LANG_MULT = 1.5;
/* California's roofing year, from the evidence file. Santa Ana days: Scripps Santa Ana Winds Regional Index, mean days a month 1948 to 2018.
   Wet season: November to March. Reroof permits in the City of Los Angeles peak in October, before the rain, and are lowest in January. */
const DESK_SANTA_ANA = [11.9, 6.7, 2.8, 0.6, 0.1, 0.1, 0, 0, 0.4, 3.5, 7.8, 12.2];
const DESK_WET = [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1];
registerModule({
  key: 'desk', num: '08', title: 'Campaign Desk', desc: 'Budgets, ZIP targets, keywords, ads with the CSLB license number built in, and bulk files for six ad platforms',
  mount(root) {
    const PRE = (typeof ACCT !== 'undefined' && ACCT.PREFIX) || 'CA_';
    const EV = deskEvents(); const EVI = {}; EV.forEach(e => EVI[e.id] = e);
    const hasCol = c => ZC.includes(c);
    const popAll = sum(ZR.map(z => z.pop || 0)) || 1;
    /* the languages this build's data can speak to, with the statewide share and the default threshold derived from it */
    const LANGS = DESK_LANGS.map(L => { const col = hasCol(L.lep) ? L.lep : hasCol(L.sh) ? L.sh : null; if (!col) return null; const basis = col === L.lep ? 'lep' : 'home'; const state = sum(ZR.map(z => (z.pop || 0) * (z[col] || 0))) / popAll; const floor = basis === 'lep' ? DESK_LANG_FLOOR : DESK_LANG_FLOOR * 2; return Object.assign({}, L, { col, basis, state, def: Math.max(floor, Math.round(DESK_LANG_MULT * state)) }); }).filter(Boolean);
    const LANGI = {}; LANGS.forEach(L => LANGI[L.k] = L);
    const REGS = REG_KEYS.map(k => [String(k), REGN[k]]);
    const regOf = z => z.reg != null ? z.reg : (PA[z.pi] || {}).reg;
    /* markets a budget can carry: one for every $500 a month, so the mean market gets a daily budget a platform can learn on; never more than the scored ZIPs */
    const nDefault = b => clamp(Math.round((+b || 0) / 500), 5, ZR.length);
    const blend0 = () => { const a = DESK_BLEND0.filter(k => PLI[k]); return a.length > 1 ? a : PL.slice(0, 5).map(l => l.key); };
    const defaults = () => { const budget = +SLM.A.budget || +SLM.DEF.budget || 15000; return { line: 'replace', lines: blend0(), budget, start: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), weeks: 13, scope: 'top', parishes: [], regions: [], picks: [], n: nDefault(budget), minpop: 2000, alpha: 1.2, langTh: {}, storm: '', event: '', url: '', mix: { ...(MIX0.replace) }, asm: JSON.parse(JSON.stringify(ASM0)) }; };
    let P = Object.assign(defaults(), store.get(DESK_KEY, {}) || {});
    function tidy() {
      if (!PLI[P.line] && P.line !== 'blend') P.line = PLI.replace ? 'replace' : PL[0].key;
      P.lines = (P.lines || []).filter(k => PLI[k]); if (!P.lines.length) P.lines = blend0();
      P.asm = Object.assign(JSON.parse(JSON.stringify(ASM0)), P.asm || {}); P.mix = Object.assign({ ...(MIX0[P.line] || MIX0.blend) }, P.mix || {});
      P.parishes = Array.isArray(P.parishes) ? P.parishes : []; P.regions = Array.isArray(P.regions) ? P.regions.map(String) : []; P.picks = Array.isArray(P.picks) ? P.picks : [];
      P.langTh = P.langTh && typeof P.langTh === 'object' ? P.langTh : {}; P.n = clamp(Math.round(+P.n || nDefault(P.budget)), 1, ZR.length);
    }
    tidy();
    const save = () => store.set(DESK_KEY, P);
    const UI = { plat: 'google', grp: null, lang: 'en', tab: 'markets' };
    const L = () => P.line === 'blend' ? null : PLI[P.line];
    const lineKeys = () => (P.line === 'blend' ? P.lines : [P.line]).filter(k => PLI[k] && SLM.A.lines[k]);
    const cap1d = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
    const socOf = k => SOC[k] || (PLI[k] ? PLI[k].name.toLowerCase() : k);
    /* ---------- language rule ---------- */
    const langTh = k => { const v = P.langTh[k]; return v !== '' && v != null && isN(v) ? +v : LANGI[k].def; };
    const langNeed = (z, k) => +z[LANGI[k].col] || 0;
    const langOk = (z, k) => { const v = langNeed(z, k); return v >= langTh(k) && v / 100 * (z.pop || 0) >= DESK_LANG_MIN; };
    const langsOf = z => LANGS.filter(Lg => langOk(z, Lg.k)).map(Lg => Lg.k);
    /* the share of the budget a built language gets: the allocation weighted share of residents in its markets who need it, kept between 5 and 40 percent */
    const langShare = (M, k) => { const ms = M.filter(m => m.langs.includes(k)); if (!ms.length) return 0; return clamp(sum(ms.map(m => m.share * langNeed(m.z, k) / 100)), 0.05, 0.40); };
    /* ---------- tier and bid for the plan's own lines (the stored tier and bid are for all thirteen lines at default assumptions) ---------- */
    let TIERS = {}, tiersKey = '';
    function planTiers() {
      const keys = lineKeys(); const k = keys.join(',') + '|' + JSON.stringify(SLM.A.lines) + '|' + SLM.A.fee; if (k === tiersKey) return; tiersKey = k; TIERS = {};
      if (typeof LINE_TIER !== 'function' || typeof TIER_BID === 'undefined') return;
      const R = ZR.map(z => ({ zip: z.zip, eff: SLM.zipAll(z, keys).fees / Math.max(0.3, z.cpc_rel || 1) })); const v = R.map(x => x.eff).sort((a, b) => a - b); const n = v.length;
      R.forEach(x => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < x.eff) lo = m + 1; else hi = m; } const pct = n ? lo / n * 100 : 0; const t = LINE_TIER(pct); TIERS[x.zip] = { tier: t, bid: TIER_BID[t], pct }; });
    }
    const tierOf = z => (TIERS[z.zip] || {}).tier || z.tier || '';
    const bidOf = z => (P.bids && isN(P.bids[z.zip])) ? +P.bids[z.zip] : TIERS[z.zip] ? TIERS[z.zip].bid : (z.bid || 0);
    /* ---------- event ad group ---------- */
    const evSel = () => {
      if (P.storm && EVI[P.storm]) { const e = EVI[P.storm]; return { id: e.id, name: e.name, year: e.year, kind: e.kind, label: e.name + (e.year && !String(e.name).includes(String(e.year)) ? ' ' + e.year : ''), named: true }; }
      if (P.event) { const m = /^kind:(\w+)$/.exec(P.event); const kind = m && DESK_EV[m[1]] ? m[1] : deskEvKind(P.event); return { id: 'event', name: '', year: null, kind, label: m ? DESK_EV[kind].label : String(P.event), named: false }; }
      return null;
    };
    const evLine = e => { const k = DESK_EV[e.kind].line; return PLI[k] ? k : PLI.storm ? 'storm' : PL[0].key; };
    const fireName = e => String(e.name || '').replace(/\s+fire$/i, '').trim();
    root.innerHTML = mastHTML({ eyebrow: 'Module 08 · Campaign Desk', title: 'Campaign Desk', dek: 'The atlas\'s ZIPs turned into media buys for a California roofing company: a budget allocated by ZIP and platform and paced to each line\'s season, targeting lists with each platform\'s identifiers and bid modifiers computed for the plan\'s own lines, keyword and negative sets, ads written to every platform\'s limits with the company name, the CSLB license number and an office city built in, event ad groups for heavy rain, high wind, wildfire rebuilding and mountain snow, Spanish where the ZIPs need it and plain advice for Chinese, Vietnamese, Tagalog and Korean, and a bulk file or build sheet for every ads manager.',
      meta: [`<b>${N(ZR.length)}</b> ZIPs available as markets`, `<b>${N(Z.filter(z => z.gid).length)}</b> with Google criterion IDs`, `<b>6</b> platforms · <b>${PL.length}</b> service lines · English and Spanish`, '<b>No keyword volumes pulled</b>'],
      bar: 'Campaign Desk', barsub: 'Plan, build, export', actions: [['dkPlanX', '↓ Plan'], ['dkG', '↓ Google'], ['dkL', '↓ LSA'], ['dkDg', '↓ YouTube'], ['dkM', '↓ Meta'], ['dkMs', '↓ Microsoft'], ['dkT', '↓ TikTok'], ['dkCr', '↓ Creative'], ['dkKw', '↓ Keywords'], ['dkSave', '⤓ Save'], ['dkLoad', '⤒ Load']].map(([id, label]) => ({ id, label })) }) +
      `<div class="wrap">
      ${callout('', 'Read this first: what the desk does and does not do', `Choose a service line (or a blend), a budget and a market scope. The desk picks ZIPs from the paid model, splits the money across Google Search, Local Services Ads, YouTube and Demand Gen, Meta, Microsoft and TikTok, paces it to the line's season, forecasts clicks, leads and sold jobs from assumptions you can edit, and writes what each platform expects: location targets with bid modifiers, keywords with match types and negatives, responsive search ads with the city filled in, social and video copy, and build sheets. Every ad set carries the company name, the CSLB license number and an office city, because California requires the license number in all forms of advertising (Business and Professions Code 7030.5). Nothing offers to waive or absorb a deductible (Penal Code 551), promises to negotiate a claim (Insurance Code 15006, 15007) or promises an insurance discount; copy has no hyphens or dashes. It connects to no platform, pulls no keyword volumes and spends no Ahrefs units. Exports set every object to paused. Fill the Company panel (top right) first: the desk refuses to invent a license number.`)}
      <div id="dkFirmWarn"></div>
      <div class="card mt"><div class="card-h"><h3>The plan</h3><p>Change anything; the desk rebuilds. Stored in this browser.</p></div><div class="card-b"><div class="plan">
        <div class="f"><label class="fl" for="dkLine">Service line</label><select id="dkLine"><option value="blend">Blend of lines</option>${PL.map(l => `<option value="${l.key}">${esc(l.name)}</option>`).join('')}</select></div>
        <div class="f" id="dkBlendF"><label class="fl">Lines in the blend</label><div class="chips" id="dkBlend">${PL.map(l => `<button type="button" class="chip" data-k="${l.key}">${esc(l.short)}</button>`).join('')}</div></div>
        <div class="f"><label class="fl" for="dkBud">Monthly budget ($)</label><input type="number" id="dkBud" min="500" step="500"><span class="hint">Media only.</span></div>
        <div class="f"><label class="fl" for="dkStart">Flight start · weeks</label><div style="display:flex;gap:6px"><input type="date" id="dkStart"><input type="number" id="dkWeeks" min="2" max="52" style="width:70px"></div></div>
        <div class="f"><label class="fl" for="dkScope">Market scope</label><select id="dkScope"><option value="top">Top ZIPs by efficiency, statewide</option><option value="region">Top ZIPs in selected regions</option><option value="parish">Top ZIPs in selected counties</option><option value="picks">Hand picked ZIPs</option></select><span class="hint">California is several markets. A crew rarely serves more than one or two regions.</span></div>
        <div class="f"><label class="fl" for="dkRegs">Regions (for region scope)</label><select id="dkRegs" multiple size="4">${REGS.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</select></div>
        <div class="f"><label class="fl" for="dkPars">Counties (for county scope)</label><select id="dkPars" multiple size="4">${PA.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="f"><label class="fl" for="dkPicks">Hand picked ZIPs</label><input type="text" id="dkPicks" placeholder="${esc(ZR.slice(0, 3).map(z => z.zip).join(', '))}"><span class="hint">Other modules send ZIPs here.</span></div>
        <div class="f"><label class="fl" for="dkN">ZIPs to buy · minimum residents</label><div style="display:flex;gap:6px"><input type="number" id="dkN" min="1" max="${ZR.length}" style="width:80px"><select id="dkMin"><option value="0">any</option><option value="1000">1,000+</option><option value="2000">2,000+</option><option value="5000">5,000+</option><option value="10000">10,000+</option></select></div><span class="hint">Up to the ${N(ZR.length)} scored ZIPs. A new plan starts at one market for every $500 of monthly budget.</span></div>
        <div class="f"><label class="fl" for="dkAlpha">Concentration α <span id="dkAlphaV"></span></label><input type="range" id="dkAlpha" min="0.5" max="2.5" step="0.1"><span class="hint">1 spends in proportion to the profit pool; 2 concentrates on the best ZIPs.</span></div>
        <div class="f"><label class="fl" for="dkUrl">Landing URL base</label><input type="url" id="dkUrl" placeholder="https://www.yourroofingco.com"><span class="hint">Defaults to the Company panel website.</span></div>
        <div class="f"><label class="fl" for="dkCor">Event ad group (optional)</label><select id="dkCor"><option value="">None</option>${Object.entries(DESK_EV).map(([k, v]) => `<option value="kind:${k}">${esc(v.label)}</option>`).join('')}${EV.length ? `<optgroup label="Events on record">${EV.slice(0, 120).map(e => `<option value="${esc(e.id)}">${esc(e.name)}${e.year && !String(e.name).includes(String(e.year)) ? ' ' + e.year : ''} · ${esc(DESK_EV[e.kind].label.split(' (')[0].toLowerCase())}</option>`).join('')}</optgroup>` : ''}</select><span class="hint">Adds event keywords and headlines for rain, wind, wildfire rebuilding or snow.</span></div>
      </div>
      <div class="dsec" style="margin-top:16px">Platform mix (% of budget)</div><div class="mix" id="dkMix"></div><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sec sm" id="dkMixReset">Reset mix to line default</button></div>
      <div class="dsec" style="margin-top:16px">Platform assumptions (editable)</div><div class="xscroll" id="dkAsm"></div></div></div>
      <div class="kpis" id="dkKpis"></div>
      <div class="grid2">
        <div class="card mapcard"><div class="card-h"><h3>Markets in the buy</h3><p>Shaded by monthly allocation. Click a ZIP to add or drop it (switches scope to hand picked).</p></div><div id="dkMap"></div><div class="legend" id="dkLeg"></div></div>
        <div class="card"><div class="card-h"><h3>Plan summary</h3></div><div class="card-b"><div class="ptabs" id="dkTabs"><button data-v="markets" aria-pressed="true">Markets</button><button data-v="platforms" aria-pressed="false">Platforms</button><button data-v="flight" aria-pressed="false">Flight and pacing</button><button data-v="objects" aria-pressed="false">Campaign objects</button></div><div id="dkTab"></div></div></div>
      </div>
      ${card('Languages in this buy', 'Which markets need a language other than English, by a rule that looks at need, not at who speaks what at home.', '<div id="dkLangs"></div>', 'mt')}
      <div class="card mt"><div class="card-h"><h3>Platform builders: what will be created, and the file that creates it</h3><p>Structure, targeting, creative for the selected ad group with character counts and Satchel lint, and the rules that bind this buy.</p></div><div class="card-b"><div class="ptabs" id="dkPTabs">${PLATS.map((p, i) => `<button data-v="${p}" aria-pressed="${i === 0}">${PLAB[p]}</button>`).join('')}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px"><div class="ctl"><label class="fl" for="dkAng">Ad group</label><select id="dkAng"></select></div><div class="ctl"><span class="fl">Language</span><div class="seg" id="dkLang"><button data-v="en" aria-pressed="true">English</button><button data-v="es" aria-pressed="false">Spanish</button></div></div><div class="ctl"><label class="fl" for="dkPrev">Preview market</label><select id="dkPrev"></select></div></div><div id="dkBuild"></div></div></div>
      <div class="split">
        ${card('Keyword desk: Google Search and Microsoft', 'Line keywords with match types, question terms and the city variants the export writes for each market city. Price the set in Keyword Planner inside the account; nothing here was priced by a keyword tool.', '<div class="ctl" style="margin-bottom:8px"><select id="dkKwA"></select></div><div id="dkKwOut"></div>')}
        ${card('Measurement, naming and operating rules', 'Conversion actions, naming and UTM scheme, and the pacing and kill rules derived from the assumptions.', '<div id="dkMeas"></div>')}
      </div>
      ${card('Compliance: the rules behind the lint', 'What binds this buy. ✔ primary text read this build; ◐ secondary or platform policy, verify before launch.', '<div id="dkComp"></div>', 'mt')}
      <div class="split">
        ${card('How the desk is built', '', '<ol class="meth" id="dkHow"></ol>')}
        ${card('Judgment calls', 'Places where the desk had to choose.', '<div id="dkJudg"></div>')}
      </div>
      <div class="foot">California Roofer Guru, module 08. Media plans are cold start priors built from public data and stated assumptions. Replace every assumption with account data after the first thirty to sixty days. Compiled ${esc(dateL(META.compiled || '2026-11-19'))}.</div></div>`;
    // ---------- model ----------
    function markets() {
      let pool = ZR.filter(z => z.pop >= P.minpop);
      if (P.scope === 'parish' && P.parishes.length) pool = pool.filter(z => P.parishes.includes(z.fips));
      if (P.scope === 'region' && P.regions.length) pool = pool.filter(z => P.regions.includes(String(regOf(z))));
      const keys = lineKeys(); const val = z => SLM.zipAll(z, keys).fees; const eff = z => val(z) / Math.max(0.3, z.cpc_rel || 1);
      if (P.scope === 'picks') { const s = new Set(P.picks); pool = ZR.filter(z => s.has(z.zip)); }
      else pool = pool.sort((a, b) => eff(b) - eff(a)).slice(0, P.n);
      const w = pool.map(z => Math.pow(Math.max(1, eff(z)), P.alpha)); const ws = sum(w) || 1;
      return pool.map((z, i) => { const langs = langsOf(z); return { z, share: w[i] / ws, spend: P.budget * w[i] / ws, langs, es: langs.includes('es'), fees: val(z) }; });
    }
    const lineMix = () => { const keys = lineKeys(); const f = keys.map(k => sum(MKT.map(m => SLM.zipLine(m.z, k).fees))); const tot = sum(f); return keys.map((k, i) => ({ k, w: tot > 0 ? f[i] / tot : 1 / Math.max(1, keys.length) })); };
    function forecast(M) {
      const out = {}; const mixL = lineMix(); const close = sum(mixL.map(o => o.w * SLM.A.lines[o.k].close)) / 100; const cpcMul = sum(mixL.map(o => o.w * SLM.A.lines[o.k].cpcMul)) || 1; const val = sum(mixL.map(o => o.w * SLM.A.lines[o.k].val * SLM.A.fee)); const cpcK = (+SLM.A.cpc || SLM.DEF.cpc) / SLM.DEF.cpc; const cvrK = sum(mixL.map(o => o.w * SLM.A.lines[o.k].cvr)) / (sum(mixL.map(o => o.w * SLM.DEF.lines[o.k].cvr)) || 1) || 1; const obsCpl = q => { let w = 0, v = 0; mixL.forEach(o => { const x = SLM.A.lines[o.k][q]; if (isN(x) && x > 0) { w += o.w; v += o.w * x; } }); return w ? v / w : null; };
      PLATS.forEach(p => { const A = P.asm[p]; const spend = P.budget * (P.mix[p] || 0) / Math.max(1, sum(PLATS.map(q => P.mix[q] || 0))); if (!spend) { out[p] = { spend: 0, clicks: 0, leads: 0, cases: 0, fees: 0 }; return; }
        const cm = sum(M.map(m => m.share * (m.z.cpc_rel || 1))) || 1; let clicks = 0, leads = 0;
        if (A.basis === 'CPC') { const own = ASM0[p] || {}; clicks = spend / (A.cost * (+A.cost === own.cost ? cpcK : 1) * cpcMul * cm); leads = clicks * A.cvr * (+A.cvr === own.cvr ? cvrK : 1) / 100; }
        else if (A.basis === 'CPM') { const imp = spend / A.cost * 1000; clicks = imp * A.ctr / 100; const oc = p === 'meta' && +A.cost === ASM0.meta.cost && +A.ctr === ASM0.meta.ctr && +A.cvr === ASM0.meta.cvr ? obsCpl('metaCpl') : null; leads = oc ? spend / oc : clicks * A.cvr / 100; }
        else { leads = spend / ((p === 'lsa' && +A.cost === ASM0.lsa.cost && obsCpl('lsaCpl')) || A.cost); clicks = leads; }
        const cl = p === 'lsa' ? close : p === 'meta' || p === 'tiktok' ? close * 0.5 : p === 'dg' ? close * 0.6 : close;
        out[p] = { spend, clicks, leads, cases: leads * cl, fees: leads * cl * val }; });
      return out;
    }
    const firm = () => ({ name: brandSet() ? (BRAND.short || BRAND.name) : '', lic: String(BRAND.lic || '').replace(/^#/, '').trim(), office: brandOffices()[0] || '', phone: BRAND.phone || '', fin: BRAND.financing || '', warranty: BRAND.warranty || '', url: (P.url || BRAND.url || '').replace(/\/$/, '') });
    /* a line is commercial when its segment says so; the service line table writes 'com', older tables wrote 'comm': both are read */
    const isComSeg = s => s === 'com' || s === 'comm';
    const resPlan = () => lineKeys().some(k => !isComSeg((PLI[k] || {}).seg));
    const fit = (t, n) => { t = houseClean(t); return t && t.length <= n ? t : null; };
    const titleCase = t => String(t).replace(/\b([a-z])([a-z]*)/g, (m, a, b) => /^(and|or|of|the|to|in|on|a)$/.test(a + b) ? m : a.toUpperCase() + b);
    const ctxFor = z => ({ city: (z && z.city) || BRAND.city || 'California', parish: (z && z.cty) || '', county: (z && z.cty) || '' });
    /* the desk fills {County} itself, so its copy does not depend on which tokens the shared filler knows */
    const fill = (t, ctx) => fillCopy(String(t).replace(/\{County\}/g, ctx.county || ''), ctx);
    /* ad groups: one per angle for a single line, one per line for a blend, plus an optional event group */
    function groups() {
      const out = []; const keys = lineKeys();
      if (P.line === 'blend') keys.forEach(k => { const l = PLI[k]; out.push({ id: k, label: l.name, line: k, angles: l.angles || [] }); });
      else if (L()) ((L().angles || []).filter(a => a.lang !== 'es').length ? (L().angles || []).filter(a => a.lang !== 'es') : [{ id: 'core', h: titleCase(socOf(L().key)), d: '' }]).forEach(a => out.push({ id: L().key + ':' + a.id, label: L().short + ' · ' + titleCase(a.id), line: L().key, angles: [a] }));
      const e = evSel(); if (e) out.push({ id: e.named ? 'storm' : 'event', label: 'Event · ' + e.label, line: evLine(e), angles: [], ev: e });
      return out;
    }
    /* The license line. Business and Professions Code 7030.5: the license number goes in all forms of advertising. */
    const licLine = (lic, es) => es ? `Licencia CSLB #${lic}` : `CSLB License #${lic}`;
    function reqLines(lang) { const F = firm(); const es = lang === 'es'; const out = [];
      if (F.lic && F.office) out.push(es ? `${licLine(F.lic, 1)}. Oficina en ${F.office}.` : `${licLine(F.lic)}. Office in ${F.office}.`);
      else if (F.lic) out.push(licLine(F.lic, es) + '.');
      else if (F.office) out.push(es ? `Oficina en ${F.office}.` : `Local office in ${F.office}.`);
      return out; }
    function rsaFor(g, z, lang) {
      const ctx = ctxFor(z); const F = firm(); const es = lang === 'es'; const l = PLI[g.line];
      const unset = t => (/\{Lic\}/.test(t) && !F.lic) || (/\{Office\}/.test(t) && !F.office) || (/\{(Company|Firm)\}/.test(t) && !F.name) || (/\{Phone\}/.test(t) && !F.phone) || (/\{County\}/.test(t) && !ctx.county);
      const hs = [], seen = new Set(); const addH = t => { if (!t || unset(t)) return; const x = fit(fill(t, ctx), 30); if (x && !seen.has(x.toLowerCase()) && hs.length < 15) { seen.add(x.toLowerCase()); hs.push(x); } };
      const angs = g.angles.length ? g.angles : (l ? (l.angles || []).filter(a => a.lang !== 'es').slice(0, 1) : []);
      const esAngs = l ? (l.angles || []).filter(a => a.lang === 'es') : [];
      if (g.ev && !es) { const T = DESK_EV[g.ev.kind]; const nm = g.ev.kind === 'fire' && g.ev.named ? fireName(g.ev) : ''; T.h.forEach(h => { if (/\{Name\}/.test(h)) { if (nm) addH(h.replace('{Name}', nm)); } else addH(h); }); }
      if (es) { esAngs.forEach(a => addH(a.h)); (DESK_H_ES[g.line] || []).forEach(addH); addH('Techos en {City}'); addH('Hablamos Español'); addH('Oficina en {Office}'); addH('Reparación de Techos'); addH('Llame o Escriba Hoy'); if (F.lic) addH('Techador con Licencia CSLB'); addH('Presupuesto por Escrito'); }
      else { angs.forEach(a => addH(a.h)); (DESK_H[g.line] || []).forEach(addH); const nm = titleCase(socOf(g.line)); addH(`${nm} {City}`); addH(`${nm} in {City}`); addH('Roofing Company in {City}'); addH('California Roofing Company'); if (F.lic) addH('CSLB Licensed Roofer'); addH('Itemized Written Estimates'); addH('Permits Pulled Where Required'); addH('Office in {Office}'); if (F.name) addH(F.name); addH('Call or Message Us Today'); if (F.fin) addH('Financing Available'); addH('Roofing in {County} County'); addH('Serving {County} County'); }
      const ds = []; const addD = t => { if (!t || unset(t)) return; const x = fit(fill(t, ctx), 90); if (x && !ds.includes(x) && ds.length < 4) ds.push(x); };
      reqLines(lang).forEach(addD);
      if (g.ev && !es) { if (g.ev.kind === 'fire' && g.ev.named) addD(`After the ${fireName(g.ev)} Fire: Class A rebuild roofs by a licensed roofer with a local office.`); addD(DESK_EV[g.ev.kind].d); }
      (es ? esAngs : angs).forEach(a => addD(a.d));
      addD(es ? 'Techador con licencia en California. Inspección, presupuesto detallado y permisos.' : `${cap1d(socOf(g.line))} by a licensed California roofer. Itemized estimates.`);
      addD(es ? 'Llame o escriba hoy. Hablamos español y damos el presupuesto por escrito.' : 'Roof inspections, written estimates and permits pulled where the city requires them.');
      return { h: hs, d: ds };
    }
    const lint = (txt, extra) => satchelLint(txt, satCtx(Object.assign({ asset: true, res: resPlan() }, extra || {})));
    const lintSet = (texts, plat) => { const all = texts.join(' \n '); const f = lint(all, { platform: plat }); texts.forEach(t => satchelLint(t, { headline: true }).forEach(x => { if (x.rule.id === 'GADS1') f.push(x); })); return f; };
    /* social copy speaks about the service and the place, never about the reader's finances, insurance or hardship (Meta personal attributes policy) */
    function lsaBio(z) { const F = firm(); const ctx = ctxFor(z); return houseClean(fill(`${F.name || 'Our company'} replaces and repairs roofs across ${ctx.county ? '{County} County and ' : ''}California: ${lineKeys().map(k => socOf(k)).slice(0, 3).join(', ')}. Licensed by the Contractors State License Board${F.lic ? ' (' + licLine(F.lic) + ')' : ''}, with an office in ${F.office || 'California'}. Permits are pulled where the city or county requires them.`, ctx)); }
    function socialFor(g, z, lang, p) {
      const ctx = ctxFor(z); const l = PLI[g.line]; const es = lang === 'es'; const la = (l && l.angles) || []; const a = es ? (la.find(x => x.lang === 'es') || la[0]) : (g.angles[0] || la[0]);
      const req = reqLines(lang).join(' '); const nm = cap1d(socOf(g.line)); const e = g.ev;
      const evLead = e ? ({ rain: 'Roof leak repair near {City} after the rain. A licensed California roofer finds the source, tarps what is open and writes an itemized estimate.', wind: 'Wind damage roof repair near {City}. A licensed California roofer photographs the damage, tarps what is open and writes an itemized estimate.', fire: `Rebuild and fire damage roofing near {City}${e.named ? ' after the ' + fireName(e) + ' Fire' : ''}. A licensed California roofer builds Class A roofs to the wildfire code and writes an itemized estimate.`, snow: 'Snow and ice damage roof repair near {City}. A licensed California roofer inspects the roof and framing and writes an itemized estimate.' })[e.kind] : '';
      const lead = es ? 'Techador con licencia para {City} y toda California. Hablamos español. Inspección del techo, presupuesto detallado por escrito y permisos donde la ciudad los exige.' : e ? evLead : `${nm} for {City} from a licensed California roofer. ${SOCX[g.line] || 'Roof inspections, itemized written estimates and permits where the city requires them.'}`;
      const body = houseClean(fill(lead, ctx) + ' ' + req);
      const title = fit(fill(es ? 'Techos en {City}' : e ? `${titleCase(DESK_EV[e.kind].slug)} in {City}` : `${nm} in {City}`, ctx), p === 'meta' ? 40 : 60) || (a && fit(fill(a.h, ctx), 40)) || (l ? l.short : nm);
      return { body, title, desc: fit(es ? 'Hablamos español' : 'Licensed California roofer', 30) };
    }
    // ---------- render ----------
    let MKT = [], FC = {};
    const regsOf = M => [...new Set(M.map(m => regOf(m.z)).filter(r => r != null))];
    function syncUI() {
      $('#dkLine', root).value = P.line; $('#dkBud', root).value = P.budget; $('#dkStart', root).value = P.start; $('#dkWeeks', root).value = P.weeks; $('#dkScope', root).value = P.scope;
      $$('#dkPars option', root).forEach(o => o.selected = P.parishes.includes(o.value)); $$('#dkRegs option', root).forEach(o => o.selected = P.regions.includes(o.value)); $('#dkPicks', root).value = P.picks.join(', '); $('#dkN', root).value = P.n; $('#dkMin', root).value = String(P.minpop);
      $('#dkAlpha', root).value = P.alpha; $('#dkAlphaV', root).textContent = D(P.alpha, 1); $('#dkUrl', root).value = P.url || ''; $('#dkCor', root).value = P.storm && EVI[P.storm] ? P.storm : /^kind:/.test(P.event || '') ? P.event : '';
      $('#dkBlendF', root).style.display = P.line === 'blend' ? '' : 'none';
      $$('#dkBlend .chip', root).forEach(c => { const on = P.lines.includes(c.dataset.k); c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
      const F = firm(); const e = evSel(); const miss = [!F.lic && 'CSLB license number (required in all advertising, Business and Professions Code 7030.5)', !F.office && 'office city', !F.name && 'company name', !F.phone && 'phone'].filter(Boolean);
      $('#dkFirmWarn', root).innerHTML = (miss.length ? callout('judg tight', 'The Company panel is incomplete', `Missing: ${miss.join(', ')}. The desk leaves these out rather than inventing them, and the Satchel lint flags every ad set until they are filled. <button class="ibtn" id="dkFirmBtn" style="margin-left:6px">Open the Company panel</button>`) : '')
        + (e ? callout('tight', 'Event ad group', `Built for: ${esc(e.label)} (${esc(DESK_EV[e.kind].label.toLowerCase())}). It uses that event's keywords and headlines; clear it by choosing None above.${e.kind === 'fire' ? ' Do not run it while a fire is burning or an area is evacuated: wait until the area reopens. After a declared emergency, repair prices are capped at 10 percent above the price before it for 180 days (Penal Code 396), an owner has seven business days to cancel a disaster repair contract (Business and Professions Code 7159), and contracting without a license in the disaster area can be charged as a felony (Business and Professions Code 7028.16).' : ''}`) : '');
      const fb = $('#dkFirmBtn', root); if (fb) fb.onclick = () => BRANDX.panel();
    }
    function mixUI() {
      const tot = sum(PLATS.map(p => P.mix[p] || 0));
      $('#dkMix', root).innerHTML = PLATS.map(p => `<div class="m"><span>${PLAB[p]}</span><input type="range" min="0" max="80" step="1" value="${P.mix[p] || 0}" data-p="${p}" aria-label="${PLAB[p]} share"><b>${D(P.mix[p] || 0, 0)}%</b><span class="usd">${M$(P.budget * (P.mix[p] || 0) / Math.max(1, tot))}</span></div>`).join('') + `<div class="mini">Total ${D(tot, 0)}%${Math.abs(tot - 100) > 0.5 ? ' (shares are rescaled to 100%)' : ''}</div>`;
      $$('#dkMix input', root).forEach(i => i.oninput = () => { P.mix[i.dataset.p] = +i.value; rebuild(true); });
    }
    function asmUI() {
      $('#dkAsm', root).innerHTML = `<table><thead><tr><th class="l">Platform</th><th class="l">Basis</th><th>Cost ($)</th><th>CTR %</th><th>Lead CVR %</th><th>Min $/day</th><th class="l">Grade</th><th class="l">Source</th></tr></thead><tbody>${PLATS.map(p => { const A = P.asm[p]; return `<tr><td class="l">${PLAB[p]}</td><td class="l">${A.basis}</td><td><input type="number" step="1" data-p="${p}" data-k="cost" value="${A.cost}" style="width:72px"></td><td><input type="number" step="0.1" data-p="${p}" data-k="ctr" value="${A.ctr}" style="width:64px"></td><td><input type="number" step="0.1" data-p="${p}" data-k="cvr" value="${A.cvr}" style="width:64px"></td><td><input type="number" step="1" data-p="${p}" data-k="min" value="${A.min}" style="width:56px"></td><td class="l">${G(A.g)}</td><td class="l wrap mini">${esc(A.src)}</td></tr>`; }).join('')}</tbody></table><div style="margin-top:6px"><button class="btn sec sm" id="dkAsmReset">Reset to defaults</button></div><p class="mini" style="margin-top:6px">The search base here is the service line model's base cost per click (${M$(DESK_CPC0)} by default, module 12): one number, not two. Search costs multiply by each line's click cost multiplier (module 12) and each ZIP's relative cost (module 05). They also scale by module 12's current base cost per click, and lead rates by each line's click to lead rate, against the model defaults; Apply in module 15 sets those to the account's observed values, and the Meta and Local Services forecasts then use the observed cost per lead of the plan's lines. A cost or rate you change in this table is used as you set it, without that scaling or replacement (the forecast reads cost and lead CVR for search, the cost per lead for Local Services, and cost, CTR and lead CVR for YouTube, Meta and TikTok); Reset to defaults hands it back to the model. Sold jobs use each line's lead to sale rate; social lead forms (Meta, TikTok) close at half that rate and video leads at 60%, because form leads carry more unqualified contacts.</p>`;
      $$('#dkAsm input', root).forEach(i => i.oninput = debounce(() => { P.asm[i.dataset.p][i.dataset.k] = +i.value; rebuild(true); }, 250));
      $('#dkAsmReset', root).onclick = () => { P.asm = JSON.parse(JSON.stringify(ASM0)); asmUI(); rebuild(); };
    }
    const map = new ZipMap($('#dkMap', root), { segHit: 'none', roads: false, onSelect: zip => { const z = ZI[zip]; if (!z || !z.res_ok) return; const cur = new Set(MKT.map(m => m.z.zip)); if (cur.has(zip)) cur.delete(zip); else cur.add(zip); P.scope = 'picks'; P.picks = [...cur]; rebuild(); syncUI(); }, onHover: (zip, e) => { const m = MKT.find(x => x.z.zip === zip); const z = ZI[zip]; if (!z || !z.res_ok) return; showTip(`<div class="tt">${z.zip} · ${esc(z.city)}</div><div class="ts">${esc(z.cty)} County</div>${m ? tipRow('Monthly allocation', M$(m.spend)) + tipRow('Tier and bid modifier (plan lines)', esc(tierOf(z)) + ' · ' + S(bidOf(z), 0) + '%') + (m.langs.length ? tipRow('Language need', m.langs.map(k => LANGI[k].name).join(', ')) : '') : tipRow('Not in the buy', 'click to add')}${tipRow('Gross profit pool (plan lines)', MM(SLM.zipAll(z, lineKeys()).fees))}`, e); } });
    function rebuild(light) {
      planTiers(); MKT = markets(); FC = forecast(MKT); save();
      const T = { spend: sum(PLATS.map(p => FC[p].spend)), clicks: sum(PLATS.map(p => FC[p].clicks)), leads: sum(PLATS.map(p => FC[p].leads)), cases: sum(PLATS.map(p => FC[p].cases)), fees: sum(PLATS.map(p => FC[p].fees)) };
      const objs = countObjects(); const nreg = regsOf(MKT).length;
      $('#dkKpis', root).innerHTML = kpiHTML([
        { l: 'Monthly media', g: 'D', v: M$(T.spend), d: `${P.line === 'blend' ? 'Blend: ' + lineKeys().map(k => PLI[k].short).join(', ') : L().name}; ${P.weeks} weeks from ${dateL(P.start)}` },
        { l: 'Markets bought', g: 'C', v: N(MKT.length), d: `${N(sum(MKT.map(m => m.z.pop)))} residents in ${nreg} region${nreg === 1 ? '' : 's'} · ${MKT.filter(m => m.es).length} with a Spanish build` },
        { l: 'Clicks a month', g: 'D', v: N(T.clicks), d: 'search costs scaled by each ZIP\'s relative cost' },
        { l: 'Leads a month', g: 'D', v: N(T.leads), d: 'calls, forms, messages and LSA leads' },
        { l: 'Sold jobs a month', g: 'D', v: D(T.cases, 1), d: 'at each line\'s lead to sale rate' },
        { l: 'Cost per sold job', g: 'D', v: M$(T.spend / Math.max(1e-9, T.cases)), d: `${MM(T.fees)} expected gross profit a month at default values` },
        { l: 'Campaign objects', g: '', v: N(objs.total), d: `${objs.camps} campaigns · ${objs.groups} ad groups · ${objs.ads} ads` },
      ]);
      const mx = Math.max(...MKT.map(m => m.spend), 1); const R = ramp('green');
      map.fill(zip => { const m = MKT.find(x => x.z.zip === zip); if (m) return R[Math.min(7, 2 + Math.floor(5.99 * m.spend / mx))]; const z = ZI[zip]; return z && z.res_ok ? cssv('--sunk') : null; });
      $('#dkLeg', root).innerHTML = legendHTML({ title: 'Monthly allocation', R: R.slice(2), lo: M$(Math.min(...MKT.map(m => m.spend), mx)), hi: M$(mx), note: `Allocation proportional to gross profit pool per relative click cost to the power α = ${D(P.alpha, 1)}. Light gray ZIPs are available but not bought.${nreg > 2 && P.scope === 'top' ? ` <b>This buy spans ${nreg} of the ${REG_KEYS.length} regions.</b> Unless crews work all of them, choose regions or counties in the plan.` : ''}` });
      if (!light) mixUI();
      else $$('#dkMix .m', root).forEach((row, i) => { const p = PLATS[i]; const tot = sum(PLATS.map(q => P.mix[q] || 0)); row.querySelector('b').textContent = D(P.mix[p] || 0, 0) + '%'; row.querySelector('.usd').textContent = M$(P.budget * (P.mix[p] || 0) / Math.max(1, tot)); });
      const pv = $('#dkPrev', root); const cur = pv.value; pv.innerHTML = MKT.slice(0, 80).map(m => `<option value="${m.z.zip}">${m.z.zip} ${esc(m.z.city)}${m.langs.length ? ' (' + m.langs.map(k => k.toUpperCase()).join(' ') + ')' : ''}</option>`).join(''); if (cur && MKT.some(m => m.z.zip === cur)) pv.value = cur;
      tab(); langUI(); builder(); kwDesk(); meas();
    }
    function countObjects() { let camps = 0, groups = 0, ads = 0; const G2 = groups_().length || 1; PLATS.forEach(p => { if (!FC[p] || !FC[p].spend) return; const langs = 1 + (MKT.some(m => m.es) ? 1 : 0); if (p === 'google' || p === 'microsoft') { camps += langs; groups += langs * G2 * 2; ads += langs * G2 * 2; } else if (p === 'lsa') { camps += 1; } else { camps += 1; groups += G2; ads += G2 * langs; } }); return { camps, groups, ads, total: camps + groups + ads }; }
    const groups_ = () => groups();
    function monthsOf() { const s = new Date(P.start + 'T12:00:00'); const out = []; const end = new Date(s.getTime() + P.weeks * 7 * 864e5); let d = new Date(s); while (d < end) { const m = d.getMonth(); const nx = new Date(d.getFullYear(), m + 1, 1); const segEnd = nx < end ? nx : end; const days = Math.round((segEnd - d) / 864e5); out.push({ m, y: d.getFullYear(), days }); d = nx; } return out; }
    function pacing() { const mixL = lineMix(); const seas = SLM.MONTHS.map((_, i) => sum(mixL.map(o => o.w * SLM.seasonFor(o.k)[i]))); const mm = monthsOf(); const w = mm.map(x => seas[x.m] * x.days); const ws = sum(w) || 1; const total = P.budget * P.weeks / 4.345; return mm.map((x, i) => ({ ...x, idx: seas[x.m], spend: total * w[i] / ws })); }
    function tab() {
      const t = UI.tab; const host = $('#dkTab', root);
      if (t === 'markets') { host.innerHTML = '<div class="tscroll short" id="dkMk"></div><p class="mini" style="margin-top:4px">Tier and bid are computed for the lines in this plan at the current assumptions, the way module 05 computes them (percentile of profit pool per relative click cost among the scored ZIPs). ZIPs sent from module 05 keep the bids it sent.</p>'; dataTable($('#dkMk', root), [{ k: 'zip', h: 'ZIP', l: 1, v: m => m.z.zip }, { k: 'city', h: 'City', l: 1, v: m => m.z.city }, { k: 'cty', h: 'County', l: 1, v: m => m.z.cty }, { k: 'tier', h: 'Tier', l: 1, v: m => tierOf(m.z) }, { k: 'bid', h: 'Bid', v: m => bidOf(m.z), f: v => S(v, 0) + '%' }, { k: 'spend', h: '$/mo', f: v => M$(v) }, { k: 'lg', h: 'Lang', l: 1, v: m => m.langs.map(k => k.toUpperCase()).join(' ') }, { k: 'fees', h: 'Profit pool', f: v => MM(v) }], MKT, { sortKey: 'spend' }); }
      else if (t === 'platforms') { host.innerHTML = `<table><thead><tr><th class="l">Platform</th><th>$/mo</th><th>Clicks</th><th>Leads</th><th>Sold</th><th>Cost/sold</th></tr></thead><tbody>${PLATS.filter(p => FC[p].spend > 0).map(p => `<tr><td class="l">${PLAB[p]}</td><td>${M$(FC[p].spend)}</td><td>${N(FC[p].clicks)}</td><td>${N(FC[p].leads)}</td><td>${D(FC[p].cases, 1)}</td><td>${FC[p].cases > 0 ? M$(FC[p].spend / FC[p].cases) : '—'}</td></tr>`).join('')}</tbody></table>${PLATS.filter(p => FC[p].spend > 0 && FC[p].spend / 30.4 < P.asm[p].min).map(p => callout('judg tight', 'Below the daily minimum', `${PLAB[p]} gets ${M$(FC[p].spend / 30.4)} a day, under the ${M$(P.asm[p].min)} floor you set; the export groups all markets into one campaign so the platform can learn.`)).join('')}`; }
      else if (t === 'flight') { const pc = pacing(); const mixL = lineMix(); const seas = SLM.MONTHS.map((_, i) => sum(mixL.map(o => o.w * SLM.seasonFor(o.k)[i])));
        host.innerHTML = `<div id="dkFl"></div><table style="margin-top:8px"><thead><tr><th class="l">Month</th><th>Days</th><th>Seasonal index</th><th>Media</th></tr></thead><tbody>${pc.map(x => `<tr><td class="l">${MON3[x.m]} ${x.y}</td><td>${x.days}</td><td>${D(x.idx, 0)}</td><td>${M$(x.spend)}</td></tr>`).join('')}</tbody></table><p class="chartnote">The flight spends ${M$(sum(pc.map(x => x.spend)))} across ${P.weeks} weeks, weighted by the seasonal index of the plan's lines (module 12).</p>
        <div class="dsec">California's roofing year</div><div class="xscroll"><table class="keep compact"><thead><tr><th class="l"></th>${MON3.map(m => `<th>${m}</th>`).join('')}</tr></thead><tbody><tr><td class="l">Wet season</td>${DESK_WET.map(w => `<td>${w ? '●' : ''}</td>`).join('')}</tr><tr><td class="l">Santa Ana days</td>${DESK_SANTA_ANA.map(v => `<td>${D(v, 1)}</td>`).join('')}</tr><tr><td class="l">Plan index</td>${seas.map(v => `<td>${D(v, 0)}</td>`).join('')}</tr></tbody></table></div>
        <p class="mini" style="margin-top:6px">Rain falls from November to March, and that is when leaks are found: reroof permits in the City of Los Angeles peak in October, before the rain, and are lowest in January (city open data, 2023 to 2026). Santa Ana wind days run from October to February with almost none from April to September (Scripps Santa Ana Winds Regional Index, mean days a month, 1948 to 2018); Diablo wind in the Bay Area peaks in October (McClung and Mass 2020). Wildfire has no safe month in the south: the Palisades and Eaton fires began on January 7, 2025 in a Santa Ana wind. The evidence file holds no month table for structure loss fires, so the desk does not pace the fire or hardening lines to a fire season. Inland summer heat slows production: Cal/OSHA requires shade above 80 °F and high heat procedures at 95 °F (Title 8, section 3395).</p>
        <p class="mini"><b>Reserve rule (a house rule, not a measured one).</b> Hold 15 to 25 percent of the monthly budget in reserve from November to March for rain and from October to February for offshore wind. Release it to the storm, repair and tile groups in the footprint for 72 hours after an atmospheric river of AR3 or stronger comes ashore or a high wind warning verifies (module 14). Never release it into a ZIP under a wildfire evacuation.</p>`;
        barChart($('#dkFl', root), { cats: pc.map(x => MON3[x.m] + ' ' + String(x.y).slice(2)), series: [{ name: 'Media', color: ramp('green')[6], values: pc.map(x => x.spend) }], H: 180, W: 520, fmt: v => MM(v) }); }
      else { const o = countObjects(); const e = evSel(); host.innerHTML = `<p class="body">${o.camps} campaigns, ${o.groups} ad groups and ${o.ads} ads across ${PLATS.filter(p => FC[p].spend > 0).length} platforms. Search campaigns run one per language with two ad groups per ${P.line === 'blend' ? 'line' : 'angle'} (Core in exact and phrase, Local with city names in phrase), each with one responsive search ad of up to 15 headlines and 4 descriptions, the license line pinned to the first description${e ? ', plus an event ad group for ' + esc(e.label) : ''}. Social and video run one campaign per platform with an ad set per group.</p>`; }
    }
    /* ---------- languages ---------- */
    function langUI() {
      const host = $('#dkLangs', root); if (!host) return;
      if (!LANGS.length) { host.innerHTML = '<p class="mini">This build carries no language columns, so the desk writes English only.</p>'; return; }
      const rows = LANGS.map(Lg => { const th = langTh(Lg.k); const ms = MKT.filter(m => m.langs.includes(Lg.k)); const all = ZR.filter(z => langOk(z, Lg.k)); return { Lg, th, ms, people: sum(ms.map(m => langNeed(m.z, Lg.k) / 100 * (m.z.pop || 0))), all, share: Lg.build ? langShare(MKT, Lg.k) : 0 }; });
      const standIn = ['oie_sh', 'arabic_sh', 'slavic_sh'].filter(hasCol); const SN = { oie_sh: 'another Indo European language (the published stand in for Armenian and Persian)', arabic_sh: 'Arabic', slavic_sh: 'Russian, Polish or another Slavic language' };
      const others = standIn.flatMap(c => MKT.filter(m => (m.z[c] || 0) >= 10).map(m => ({ c, m, v: m.z[c] }))).sort((a, b) => b.v - a.v).slice(0, 6);
      host.innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Language</th><th class="l">Measured as</th><th>Statewide</th><th>Threshold %</th><th>Markets in this buy</th><th>Residents who need it there</th><th>Scored ZIPs that qualify</th><th class="l">What the desk does</th></tr></thead><tbody>${rows.map(r => `<tr><td class="l"><b>${esc(r.Lg.name)}</b></td><td class="l mini">${r.Lg.basis === 'lep' ? 'speak it at home and speak English less than very well' : 'speak it at home (no limited English column in this build)'}</td><td>${P(r.Lg.state, 1)}</td><td><input type="number" min="0" max="100" step="1" data-lk="${r.Lg.k}" value="${r.th}" style="width:60px" aria-label="${esc(r.Lg.name)} threshold"></td><td>${N(r.ms.length)} of ${N(MKT.length)}</td><td>${N(r.people)}</td><td>${N(r.all.length)} (${P(100 * r.all.length / Math.max(1, ZR.length), 0)})</td><td class="l mini">${r.Lg.build ? (r.ms.length ? `Builds a Spanish search campaign and Spanish social ads for those markets with ${P(r.share * 100, 0)} of each platform's budget, the license line in Spanish.` : 'No market in this buy qualifies: English only.') : (r.ms.length ? `Advice only: ${esc(r.ms.slice(0, 4).map(m => m.z.city).filter((v, i, a) => a.indexOf(v) === i).join(', '))}. Staff the phone and the estimate in ${esc(r.Lg.name)} before advertising in it; the desk writes no ${esc(r.Lg.name)} copy.` : 'No market in this buy qualifies.')}</td></tr>`).join('')}</tbody></table></div>
        <p class="mini" style="margin-top:6px"><b>The rule.</b> A market needs a language when residents who speak it at home and speak English less than very well are at least the threshold percent of residents 5 and over, and number at least ${N(DESK_LANG_MIN)} people (the percent times the ZIP's residents). The default threshold is ${D(DESK_LANG_MULT, 1)} times the statewide share, never below ${DESK_LANG_FLOOR} percent, so it marks the markets that stand out rather than most of the state; change it in the table. The budget share of a built language is the allocation weighted share of residents who need it, held between 5 and 40 percent. Source: ACS 2020 to 2024, table C16001, by ZIP. ${G('A')} for the counts; the thresholds are a choice.</p>
        ${others.length ? `<p class="mini">Other language groups of 10 percent or more of residents in this buy (spoken at home, no limited English measure): ${others.map(o => `${esc(o.m.z.zip)} ${esc(o.m.z.city)}, ${P(o.v, 0)} ${esc(SN[o.c])}`).join('; ')}. Armenian and Persian are not published by ZIP.</p>` : ''}
        <p class="mini">What the evidence file does not cover: whether a contract negotiated in another language must be given in that language. Ask counsel before selling in a language the paperwork is not written in.</p>`;
      $$('#dkLangs input[data-lk]', root).forEach(i => i.onchange = () => { P.langTh[i.dataset.lk] = i.value === '' ? null : +i.value; rebuild(); });
    }
    function builder() {
      const p = UI.plat; const GG = groups(); const sel = $('#dkAng', root); if (!UI.grp || !GG.find(g => g.id === UI.grp)) UI.grp = GG[0] && GG[0].id; sel.innerHTML = GG.map(g => `<option value="${esc(g.id)}" ${g.id === UI.grp ? 'selected' : ''}>${esc(g.label)}</option>`).join('');
      const g = GG.find(x => x.id === UI.grp) || GG[0]; const pz = ZI[$('#dkPrev', root).value] || (MKT[0] && MKT[0].z); const lang = UI.lang; const B = PBOOK[p]; const F = firm();
      let creative = '';
      if (!g) { $('#dkBuild', root).innerHTML = '<p class="mini">No ad groups.</p>'; return; }
      if (p === 'google' || p === 'microsoft') { const r = rsaFor(g, pz, lang); const f = lintSet(r.h.concat(r.d), p); creative = `<div class="dsec">Responsive search ad</div>${r.h.map(h => `<div class="asset"><span class="cnt">${h.length}/30</span>${esc(h)}</div>`).join('')}${r.d.map((d, i) => `<div class="asset"><span class="cnt">${d.length}/90</span>${esc(d)}${i === 0 && F.lic ? ' <span class="mini">pinned to description 1</span>' : ''}</div>`).join('')}${lintBlock(f)}`; }
      else if (p === 'meta' || p === 'tiktok' || p === 'dg') { const s = socialFor(g, pz, lang, p); const f = lint(s.body + ' ' + (s.title || '') + ' ' + (s.desc || ''), { platform: p, video: p !== 'meta' });
        const first = g.ev ? DESK_EV[g.ev.kind].first : ({ storm: 'photograph the damage from the ground and call for a tarp', repair: 'put a bucket under the leak and note where the stain is', harden: 'check whether the address is in a Fire Hazard Severity Zone, then book a roof and vent inspection', fire: 'photograph the roof from the ground before anything is moved', tile: 'look for slipped or cracked tiles and stains at the eaves, then book an inspection', solar: 'find the solar contract and the age of the system before booking the reroof' })[g.line] || 'check the roof\'s age and book an inspection';
        creative = `<div class="dsec">${p === 'dg' ? 'Video and Demand Gen asset text' : 'Ad copy'}</div><div class="asset"><span class="cnt">${s.body.length}/${p === 'meta' ? '125 visible' : '300'}</span>${esc(s.body)}</div><div class="asset"><span class="cnt">${(s.title || '').length}</span>${esc(s.title || '')}</div><div class="asset"><span class="cnt">${(s.desc || '').length}</span>${esc(s.desc || '')}</div>${p !== 'meta' ? `<div class="asset">Script (15 seconds): open on a roof your crew finished in ${esc(ctxFor(pz).city)}, shown with the owner's written permission; the owner of the company or a crew lead speaks to camera; one line on what to do first (${esc(first)}); end card with ${esc(F.name || 'the company name')}, ${esc(F.lic ? licLine(F.lic) : 'the CSLB license number')} and ${esc(F.office || 'the office city')}.</div>` : ''}${lintBlock(f)}`; }
      else if (p === 'lsa') { creative = `<div class="dsec">Build sheet</div><table class="prose"><tbody><tr><td>Business name</td><td>${esc(F.name || 'Set in the Company panel')}</td></tr><tr><td>CSLB license · classification</td><td>${esc(F.lic || 'Set in the Company panel')}${BRAND.licClass ? ' · ' + esc(BRAND.licClass) : ''}</td></tr><tr><td>Job types</td><td>${esc(lineKeys().map(k => PLI[k].name).join(', '))}</td></tr><tr><td>Service ZIPs</td><td class="mono">${MKT.map(m => m.z.zip).join(', ')}</td></tr><tr><td>Weekly budget</td><td>${M$(FC.lsa.spend / 4.345)}</td></tr><tr><td>Languages</td><td>${MKT.some(m => m.es) ? 'English, Spanish (answer in Spanish)' : 'English'}</td></tr><tr><td>Bio (500 max)</td><td>${esc(lsaBio(pz))}</td></tr></tbody></table>`; }
      $('#dkBuild', root).innerHTML = `<div class="split" style="margin-top:0"><div><div class="dsec">Structure</div><p class="body">${esc(B.bulk)}</p><div class="dsec">Targeting</div><p class="body">${esc(B.geo)}</p><div class="dsec">Rules that bind this buy</div><ul class="body" style="padding-left:18px;margin:0">${B.policy.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="rowl" style="margin-top:8px"><span>Monthly media on this platform</span><b>${M$(FC[p].spend)}</b></div></div><div>${creative}</div></div>`;
    }
    function lintBlock(f) { if (!f.length) return '<div class="msg ok">Satchel lint: no findings.</div>'; return f.map(x => `<div class="asset ${x.rule.sev === 'block' ? 'bad' : 'warn'}"><b>${esc(x.rule.name)}</b> <span class="mini">${esc(x.rule.cite)} ${x.rule.v}</span><span class="why">${esc(x.ev)}: ${esc(x.rule.fix)}</span></div>`).join(''); }
    function kwFor(g) { const l = PLI[g.line] || {}; const e = g.ev; const T = e ? DESK_EV[e.kind] : null;
      const named = e && e.named && e.kind === 'fire' ? [`${fireName(e).toLowerCase()} fire rebuild roofing`, `${fireName(e).toLowerCase()} fire roof repair`] : [];
      const core = T ? named.concat(T.kw) : (l.kw || [socOf(g.line)]);
      const q = T ? (QKW[g.line] || []).slice(0, 3) : (QKW[g.line] || []); return { core, q, es: l.kwEs || [], neg: NEG_COMMON.concat(l.neg || []) }; }
    function kwDesk() {
      const GG = groups(); const sel = $('#dkKwA', root); const cur = sel.value; sel.innerHTML = GG.map(g => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join(''); if (cur && GG.find(g => g.id === cur)) sel.value = cur;
      const g = GG.find(x => x.id === sel.value) || GG[0]; if (!g) return; const K2 = kwFor(g); const cities = [...new Set(MKT.map(m => m.z.city))].slice(0, 8);
      $('#dkKwOut', root).innerHTML = `<div class="kwcol">${K2.core.map(k => `<div>[${esc(k)}] <span class="mt2">exact</span></div><div>"${esc(k)}" <span class="mt2">phrase</span></div>`).join('')}${K2.q.map(k => `<div>"${esc(k)}" <span class="mt2">question</span></div>`).join('')}${K2.core.slice(0, 3).flatMap(k => cities.slice(0, 5).map(c => `<div>"${esc(k + ' ' + c.toLowerCase())}" <span class="mt2">local</span></div>`)).join('')}${MKT.some(m => m.es) ? K2.es.map(k => `<div>"${esc(k)}" <span class="mt2">spanish</span></div>`).join('') : ''}</div><div class="dsec">Negatives (campaign level)</div><div class="neg">${K2.neg.map(n => `<code>${esc(n)}</code>`).join('')}</div><div style="margin-top:8px;display:flex;gap:8px"><button class="btn sec sm" id="dkKwCopy">Copy keywords</button><button class="btn sec sm" id="dkNegCopy">Copy negatives</button></div>`;
      $('#dkKwCopy', root).onclick = () => copyText(K2.core.map(k => `[${k}]\n"${k}"`).concat(K2.q.map(k => `"${k}"`)).concat(K2.core.slice(0, 3).flatMap(k => cities.map(c => `"${k} ${c.toLowerCase()}"`))).join('\n'));
      $('#dkNegCopy', root).onclick = () => copyText(K2.neg.join('\n'));
    }
    function meas() {
      const mixL = lineMix(); const feeCase = sum(mixL.map(o => o.w * SLM.A.lines[o.k].val * SLM.A.fee)); const tgt = feeCase * 0.15;
      $('#dkMeas', root).innerHTML = `<table class="prose"><tbody><tr><td>Conversion actions</td><td>Calls from ads of 60 seconds or more; calls from the website number (forwarding); form submits on the thank you page; chat leads; LSA leads; inspections booked; sold jobs imported from the CRM weekly as offline conversions with the contract value. Send no insurance, claim or policy details to any ad platform.</td></tr><tr><td>Naming</td><td class="mono">${esc(PRE)}${esc(tokOf())}_{PLATFORM}_{LANG}_${P.start.replace(/-/g, '')}</td></tr><tr><td>UTM</td><td class="mono">utm_source={platform}&amp;utm_medium=cpc&amp;utm_campaign={campaign}&amp;utm_content={group}&amp;utm_term={keyword}</td></tr><tr><td>Target cost per sold job</td><td>${M$(tgt)} (15% of the expected gross profit per job at your assumptions). Pause an ad group after 60 clicks with no qualified lead, or when cost per sold job runs above ${M$(tgt * 2)} for four weeks.</td></tr><tr><td>Lead handling</td><td>Answer within 60 seconds during staffed hours; after hours, route to an answering service that books inspections. Ask the address, the roof's age and covering, whether there is solar on it, what the owner sees and whether a leak is active. Never interpret coverage, promise what insurance will pay or offer to deal with the insurer: negotiating a claim for pay is public adjusting (Insurance Code 15006, 15007). Whoever sells at the door or signs the contract must be a registered home improvement salesperson (Business and Professions Code 7152).</td></tr><tr><td>Weather rule</td><td>When an atmospheric river or a high wind warning hits the footprint, move budget to the storm, repair and tile groups in the warned counties for 72 hours and pause replacement ads there while the weather passes (module 14). Under a red flag warning change nothing. During a wildfire or an evacuation, pause every ad in the affected ZIPs; return with rebuild copy only after the area reopens.</td></tr><tr><td>Declared emergencies</td><td>For 180 days after a federal, state or local emergency declaration a contractor's repair prices may not exceed the price before it by more than 10 percent, save for proven cost increases (Penal Code 396). Disaster repair contracts carry a seven business day right to cancel (Business and Professions Code 7159).</td></tr><tr><td>Bid modifiers</td><td>Start from the tiers computed for this plan's lines (A+ +30% to E −50%); after 60 to 90 days replace with observed cost per sold job by ZIP (module 15).</td></tr></tbody></table>`;
    }
    $('#dkComp', root).innerHTML = proseTable(SAT.rules.map(r => [esc(r.name), `<span class="mono">${esc(r.cite)}</span> ${r.v}`, esc(r.fix)]), ['Rule', 'Cite', 'What the desk does or you must do']);
    $('#dkHow', root).innerHTML = [`<b>Markets</b>. ZIPs are ranked by gross profit pool per relative click cost for the chosen lines (module 05 logic), or come from your regions, counties or picks, filtered by residents. A new plan buys one market for every $500 of monthly budget, up to the ${N(ZR.length)} scored ZIPs.`, `<b>Weights</b>. Each market's share is its efficiency to the power α, normalized.`, `<b>Tiers and bids</b>. Each scored ZIP's percentile of efficiency for the plan's lines sets its tier and bid modifier, the same cuts module 05 uses, recomputed whenever the lines or the assumptions change.`, `<b>Costs</b>. Search platforms scale the model's base cost per click by the line multiplier and each market's relative cost; CPM platforms convert impressions to clicks by CTR; Local Services converts spend to leads at the stated cost per lead. Once module 15 applies the account's actuals, Local Services and Meta leads come from the observed cost per lead of the plan's lines instead, unless the Local Services cost, or Meta's cost, CTR or lead CVR, was changed in the assumptions table.`, `<b>Forecast</b>. Leads times each line's lead to sale rate give sold jobs; expected gross profit uses each line's default job value and margin (module 12).`, `<b>Pacing</b>. The flight spreads the budget across its months by the profit weighted seasonal index of the lines in the plan.`, `<b>Languages</b>. A market gets a Spanish build when its limited English Spanish speakers pass the threshold in the language card; the Spanish campaigns take the allocation weighted share of residents who need them. Chinese, Vietnamese, Tagalog and Korean get advice, not copy.`, `<b>Creative</b>. Every asset is filled from the line's angle library and the desk's California lines with the market's city and county, cut to the platform's limits, cleaned of hyphens and dashes, given the company name, the CSLB license number and an office city from the Company panel, and linted by the Satchel rule pack.`, `<b>Exports</b>. One file per platform in the format its bulk tool takes, every object paused, campaign names starting ${esc(PRE)}.`].map(x => `<li>${x}</li>`).join('');
    $('#dkJudg', root).innerHTML = judgList([['The license number is automatic', 'The company name, the CSLB license number and an office city go into a description of every responsive search ad, pinned to the first description position, and into every social ad, rather than trusting the writer. California requires the license number in all forms of advertising (Business and Professions Code 7030.5). The statute leaves the form to the registrar; the desk writes "CSLB License #" and the number. Confirm the pin column imports in your version of Google Ads Editor.'], ['No claims or deductible language', 'The desk never writes "we handle your claim", "insurance approved" or anything about deductibles. A contractor may not offer a discount meant to offset a deductible (Penal Code 551), and negotiating a claim for pay needs a public adjuster license (Insurance Code 15006, 15007). Storm and fire copy describes the inspection, the photos and the itemized estimate.'], ['No insurance discount promises', 'Fire hardening copy names the roof class and the vents, not a premium. The Safer from Wildfires rule sets no percentage; each insurer files its own, and the FAIR Plan publishes only a combined maximum for twelve measures.'], ['No "fireproof"', 'A Class A assembly is a fire test rating, not a promise that a house survives. About nine in ten structures inside the January 2025 Los Angeles fire perimeters had Class A coverings (CAL FIRE inspection data). The desk writes "Class A" and "ember resistant", never "fireproof".'], ['No "free" without conditions', 'Free inspection offers are left out of the generated copy; add one only with its conditions stated (16 CFR Part 251).'], ['Financing stays generic', '"Financing available" is the most the desk writes; a payment, term or rate needs the Regulation Z disclosures in the same ad.'], ['No single homes as targets', 'Location targets are ZIPs and radius around office cities only; no lists of damaged or non renewed homes or owners.'], ['Language follows need', 'Spanish campaigns run alongside English ones only where limited English Spanish speakers pass the threshold, with the license number repeated in Spanish. The old rule (a share speaking Spanish at home) would have fired across most of California.'], ['Event groups wait for the all clear', 'Wildfire groups are for rebuilding. Nothing is released into a ZIP under evacuation, and prices after a declared emergency follow Penal Code 396.'], ['Form leads close less often', 'Meta and TikTok form leads are counted at half the line\'s lead to sale rate and video leads at 60%; replace with account data.'], ['Default costs are assumptions', 'No California click or lead price was measured for this build. Costs swing by metro and rise after storms and fires; replace the base after 30 days.'], ['Paused exports', 'Every exported object is paused so nothing spends before a person reviews it.']]);
    // ---------- exports ----------
    const tokOf = () => P.line === 'blend' ? 'BLEND' : String((L() && (L().tok || L().key)) || 'LINE').toUpperCase();
    const camp = (p, lang) => `${PRE}${tokOf()}_${p.toUpperCase()}_${lang.toUpperCase()}_${P.start.replace(/-/g, '')}`;
    const endDate = () => { const s = new Date(P.start + 'T12:00:00'); const e = new Date(s.getTime() + P.weeks * 7 * 864e5); return e.toISOString().slice(0, 10); };
    const GH = ['Campaign', 'Campaign Type', 'Networks', 'Budget', 'Budget type', 'Languages', 'Bid Strategy Type', 'Start Date', 'End Date', 'Campaign Status', 'Location', 'ID', 'Bid Modifier', 'Criterion Type', 'Status', 'Ad Group', 'Ad Group Type', 'Max CPC', 'Ad Group Status', 'Keyword', 'Ad type'].concat([...Array(15)].map((_, i) => 'Headline ' + (i + 1))).concat([...Array(4)].map((_, i) => 'Description ' + (i + 1))).concat(['Description 1 position', 'Path 1', 'Path 2', 'Final URL', 'Callout text', 'Header', 'Snippet values', 'Phone number', 'Country code']);
    const landing = g => { const F = firm(); const base = F.url || 'https://www.example.com'; return base + '/' + slug(g.ev ? (g.ev.named && g.ev.kind === 'fire' ? fireName(g.ev) + ' fire rebuild roofing' : DESK_EV[g.ev.kind].slug) : (PLI[g.line] ? PLI[g.line].name : socOf(g.line))) + '/'; };
    const langList = () => ['en'].concat(MKT.some(m => m.es) ? ['es'] : []);
    function searchRows(p) {
      const rows = []; const langs = langList(); const spend = FC[p].spend; const GG = groups(); const sES = langShare(MKT, 'es');
      langs.forEach(lang => { const ms = lang === 'es' ? MKT.filter(m => m.es) : MKT; if (!ms.length) return; const c = camp(p, lang) + (p === 'microsoft' ? '_MS' : ''); const monthly = lang === 'es' ? spend * sES : spend * (langs.length > 1 ? 1 - sES : 1);
        rows.push({ 'Campaign': c, 'Campaign Type': 'Search', 'Networks': 'Google search', 'Budget': (monthly / 30.4).toFixed(2), 'Budget type': 'Daily', 'Languages': lang === 'es' ? 'Spanish' : 'English', 'Bid Strategy Type': 'Maximize conversions', 'Start Date': P.start, 'End Date': endDate(), 'Campaign Status': 'Paused' });
        ms.forEach(m => rows.push({ 'Campaign': c, 'Location': `${m.z.zip}, California, United States`, 'ID': p === 'google' ? (m.z.gid || '') : '', 'Bid Modifier': (bidOf(m.z) >= 0 ? '+' : '') + bidOf(m.z) + '%', 'Criterion Type': 'Location', 'Status': 'Enabled' }));
        [...new Set(GG.flatMap(g => kwFor(g).neg))].forEach(k => rows.push({ 'Campaign': c, 'Keyword': k, 'Criterion Type': 'Negative Phrase', 'Status': 'Enabled' }));
        (lang === 'es' ? ['Hablamos Español', 'Presupuesto Detallado'].concat(BRAND.lic ? ['Techador con Licencia CSLB'] : []) : ['Itemized Written Estimates', 'Permits Where Required', 'Call or Message Today'].concat(BRAND.lic ? ['CSLB Licensed Roofer'] : [])).forEach(t => rows.push({ 'Campaign': c, 'Callout text': houseClean(t), 'Status': 'Enabled' }));
        rows.push({ 'Campaign': c, 'Header': lang === 'es' ? 'Servicios' : 'Services', 'Snippet values': lineKeys().map(k => PLI[k].name).slice(0, 8).join('; '), 'Status': 'Enabled' });
        if (BRAND.phone) rows.push({ 'Campaign': c, 'Phone number': phoneFmt(BRAND.phone), 'Country code': 'US', 'Status': 'Enabled' });
        const z0 = ms[0].z; const cities = [...new Set(ms.map(m => m.z.city))].slice(0, 10);
        GG.forEach(g => { const K2 = kwFor(g); const cpcMul = (SLM.A.lines[g.line] || {}).cpcMul || 1; const maxcpc = (P.asm[p].cost * cpcMul * (z0.cpc_rel || 1)).toFixed(2);
          const sets = lang === 'es' ? [[g.label + ' ES', K2.es, ['Phrase']]] : [[g.label + ' Core', K2.core.concat(K2.q), ['Exact', 'Phrase']], [g.label + ' Local', K2.core.slice(0, 4).flatMap(k => cities.map(cc => k + ' ' + cc.toLowerCase())), ['Phrase']]];
          sets.forEach(([ag, kws, mts]) => { if (!kws.length) return; rows.push({ 'Campaign': c, 'Ad Group': ag, 'Ad Group Type': 'Standard', 'Max CPC': maxcpc, 'Ad Group Status': 'Enabled' }); const seen = new Set(); kws.forEach(k => { const kk = k.toLowerCase().trim(); if (seen.has(kk)) return; seen.add(kk); mts.forEach(mt => rows.push({ 'Campaign': c, 'Ad Group': ag, 'Keyword': kk, 'Criterion Type': mt, 'Status': 'Enabled' })); });
            const r = rsaFor(g, ag.endsWith('Local') ? z0 : null, lang); const lp = landing(g); const o = { 'Campaign': c, 'Ad Group': ag, 'Ad type': 'Responsive search ad', 'Path 1': slug(PLI[g.line] ? PLI[g.line].short : g.line).replace(/-/g, '').slice(0, 15), 'Path 2': (z0.city || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 15), 'Final URL': lp + `?utm_source=${p}&utm_medium=cpc&utm_campaign=${encodeURIComponent(c)}&utm_content=${encodeURIComponent(g.id)}`, 'Status': 'Paused' }; r.h.forEach((h, i) => o['Headline ' + (i + 1)] = h); r.d.forEach((d, i) => o['Description ' + (i + 1)] = d); if (firm().lic && r.d.length) o['Description 1 position'] = '1'; rows.push(o); }); }); });
      return rows;
    }
    const lsaRows = () => { const F = firm(); return [['Business name', F.name], ['CSLB license number', F.lic], ['License classification', BRAND.licClass || ''], ['Qualifying individual or owner', BRAND.contact || ''], ['Phone', phoneFmt(F.phone)], ['Weekly budget', Math.round(FC.lsa.spend / 4.345)], ['Job types', lineKeys().map(k => PLI[k].name).join('; ')], ['Service ZIPs', MKT.map(m => m.z.zip).join(' ')], ['Languages', MKT.some(m => m.es) ? 'English; Spanish' : 'English'], ['Documents to upload', 'CSLB license, general liability insurance certificate, workers compensation certificate (required of every C-39 licensee, with or without employees), business registration, owner identification for background checks'], ['Hours', 'set to the hours the phones are actually answered']]; };
    const socialRows = p => { const rows = []; const GG = groups(); GG.forEach(g => langList().forEach(lang => { const ms = lang === 'es' ? MKT.filter(m => m.es) : MKT; const s = socialFor(g, ms[0] && ms[0].z, lang, p); rows.push({ 'Campaign Name': camp(p, lang), 'Campaign Objective': 'Leads', 'Ad Set Name': g.label + ' ' + lang.toUpperCase(), 'Zip': p === 'meta' ? ms.map(m => 'US:' + m.z.zip).join(', ') : '', 'Locations': p !== 'meta' ? [...new Set(ms.map(m => m.z.city))].slice(0, 20).join('; ') + ', California' : '', 'Ad Name': g.label + ' ' + lang.toUpperCase(), 'Title': s.title || '', 'Body': s.body, 'Link': landing(g), 'Call to Action': p === 'meta' ? 'Contact Us' : 'Learn More', 'Status': 'Paused' }); })); return rows; };
    const creativeRows = () => { const rows = []; groups().forEach(g => ['en', 'es'].forEach(lang => { const r = rsaFor(g, MKT[0] && MKT[0].z, lang); r.h.forEach(h => rows.push([g.label, lang, 'headline', h, h.length])); r.d.forEach(d => rows.push([g.label, lang, 'description', d, d.length])); })); return rows; };
    const keywordRows = () => { const rows = []; groups().forEach(g => { const K2 = kwFor(g); K2.core.forEach(k => { rows.push([g.label, k, 'Exact']); rows.push([g.label, k, 'Phrase']); }); K2.q.forEach(k => rows.push([g.label, k, 'Phrase'])); K2.es.forEach(k => rows.push([g.label + ' ES', k, 'Phrase'])); K2.neg.forEach(k => rows.push(['Negatives', k, 'Negative Phrase'])); }); return rows; };
    const planRows = () => MKT.map(m => [m.z.zip, m.z.city, m.z.cty, regOf(m.z) != null ? REGN[regOf(m.z)] || '' : '', tierOf(m.z), bidOf(m.z), Math.round(m.spend), m.langs.join(' '), Math.round(m.fees)]);
    $('#dkG', root).onclick = () => saveFile(`google-ads-editor_${tokOf().toLowerCase()}_${P.start}.csv`, toCSV(GH, searchRows('google')));
    $('#dkMs', root).onclick = () => saveFile(`microsoft-ads_${tokOf().toLowerCase()}_${P.start}.csv`, toCSV(GH, searchRows('microsoft')));
    $('#dkL', root).onclick = () => saveFile(`lsa-build-sheet_${P.start}.csv`, toCSV(['Field', 'Value'], lsaRows()));
    $('#dkM', root).onclick = () => { const R = socialRows('meta'); saveFile(`meta-ads-import_${P.start}.csv`, toCSV(Object.keys(R[0] || { 'Campaign Name': '' }), R)); };
    $('#dkDg', root).onclick = () => { const R = socialRows('dg'); saveFile(`youtube-demand-gen-build-sheet_${P.start}.csv`, toCSV(Object.keys(R[0] || { 'Campaign Name': '' }), R)); };
    $('#dkT', root).onclick = () => { const R = socialRows('tiktok'); saveFile(`tiktok-build-sheet_${P.start}.csv`, toCSV(Object.keys(R[0] || { 'Campaign Name': '' }), R)); };
    $('#dkCr', root).onclick = () => saveFile(`creative-library_${P.start}.csv`, toCSV(['ad_group', 'language', 'type', 'text', 'chars'], creativeRows()));
    $('#dkKw', root).onclick = () => saveFile('keyword-desk.csv', toCSV(['ad_group', 'keyword', 'match_type'], keywordRows()));
    $('#dkPlanX', root).onclick = () => saveFile(`campaign-plan_${tokOf().toLowerCase()}_${P.start}.csv`, toCSV(['zip', 'city', 'county', 'region', 'tier', 'bid_modifier', 'monthly_usd', 'languages', 'gross_profit_pool'], planRows()));
    $('#dkSave', root).onclick = () => saveFile('campaign-desk-plan.json', JSON.stringify(P, null, 1));
    $('#dkLoad', root).onclick = () => { const i = el('input', { type: 'file', accept: '.json,application/json' }); i.onchange = () => { const f = i.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const o = JSON.parse(rd.result); P = Object.assign(defaults(), o); tidy(); syncUI(); asmUI(); rebuild(); toast('Plan loaded'); } catch (e) { toast('That file is not a desk plan'); } }; rd.readAsText(f); }; i.click(); };
    // ---------- wiring ----------
    const bind = (id, k, num, ev) => $('#' + id, root).addEventListener(ev || 'change', e => { P[k] = num ? +e.target.value : e.target.value; if (k === 'line') { P.mix = { ...(MIX0[P.line] || MIX0.blend) }; UI.grp = null; syncUI(); } if (k === 'n') P.n = clamp(Math.round(P.n) || 1, 1, ZR.length); if (k === 'alpha') $('#dkAlphaV', root).textContent = D(P.alpha, 1); rebuild(); });
    bind('dkLine', 'line'); bind('dkBud', 'budget', 1); bind('dkStart', 'start'); bind('dkWeeks', 'weeks', 1); bind('dkScope', 'scope'); bind('dkN', 'n', 1); bind('dkMin', 'minpop', 1); bind('dkAlpha', 'alpha', 1, 'input'); bind('dkUrl', 'url');
    $('#dkCor', root).addEventListener('change', e => { const v = e.target.value; if (EVI[v]) { P.storm = v; P.event = ''; } else { P.storm = ''; P.event = v; } UI.grp = null; syncUI(); rebuild(); });
    $$('#dkBlend .chip', root).forEach(c => c.onclick = () => { const k = c.dataset.k; P.lines = P.lines.includes(k) ? (P.lines.length > 1 ? P.lines.filter(x => x !== k) : P.lines) : P.lines.concat(k); UI.grp = null; syncUI(); rebuild(); });
    $('#dkPars', root).onchange = e => { P.parishes = [...e.target.selectedOptions].map(o => o.value); if (P.parishes.length) P.scope = 'parish'; syncUI(); rebuild(); };
    $('#dkRegs', root).onchange = e => { P.regions = [...e.target.selectedOptions].map(o => o.value); if (P.regions.length) P.scope = 'region'; syncUI(); rebuild(); };
    $('#dkPicks', root).onchange = e => { P.picks = e.target.value.split(/[\s,;]+/).filter(z => ZI[z]); P.scope = 'picks'; syncUI(); rebuild(); };
    $('#dkMixReset', root).onclick = () => { P.mix = { ...(MIX0[P.line] || MIX0.blend) }; rebuild(); };
    $$('#dkTabs button', root).forEach(b => b.onclick = () => { $$('#dkTabs button', root).forEach(x => x.setAttribute('aria-pressed', String(x === b))); UI.tab = b.dataset.v; tab(); });
    $$('#dkPTabs button', root).forEach(b => b.onclick = () => { $$('#dkPTabs button', root).forEach(x => x.setAttribute('aria-pressed', String(x === b))); UI.plat = b.dataset.v; builder(); });
    $('#dkAng', root).onchange = e => { UI.grp = e.target.value; builder(); }; $('#dkPrev', root).onchange = builder; wireSeg($('#dkLang', root), v => { UI.lang = v; builder(); }); $('#dkKwA', root).onchange = kwDesk;
    /* Other modules send { zips, bids, line, lines, storm, event }. storm is an event id or name from the event table; event is free text
       (or { kind, name }). An unknown name still builds an event group of the kind its words suggest. */
    this.receive = p => { if (!p) return; let dropped = '';
      if (p.zips && p.zips.length) { P.scope = 'picks'; P.picks = p.zips.filter(z => ZI[z]); P.bids = p.bids && typeof p.bids === 'object' ? p.bids : null; }
      if (p.line && PLI[p.line]) { P.line = p.line; P.mix = { ...(MIX0[P.line] || MIX0.blend) }; }
      if (p.lines && p.lines.length > 1) { P.line = 'blend'; P.lines = p.lines.filter(k => PLI[k]); P.mix = { ...MIX0.blend }; }
      const ev = p.storm || p.event;
      if (ev) { const s = typeof ev === 'object' ? String(ev.id || ev.name || ev.label || '') : String(ev); const hit = EVI[s] || EV.find(e => e.name === s || (e.name + ' ' + e.year) === s);
        if (hit) { P.storm = hit.id; P.event = ''; } else { P.storm = ''; P.event = (typeof ev === 'object' && DESK_EV[ev.kind] && !s) ? 'kind:' + ev.kind : s; }
        const e = evSel(); if (e && P.line !== 'blend') { const k = evLine(e); if (![k, 'repair', 'storm', 'fire'].includes(P.line)) { P.line = k; P.mix = { ...(MIX0[k] || MIX0.blend) }; } } }
      else if (p.zips && p.zips.length && P.storm && EVI[P.storm] && EVI[P.storm].zips) { const s = new Set(EVI[P.storm].zips); const out = P.picks.filter(z => !s.has(z)).length; if (out) { dropped = `event ad group ${evSel().label} removed, since the event never reached ${out} of these ZIPs`; P.storm = ''; } }
      UI.grp = null; tidy(); syncUI(); rebuild(); toast(`${P.picks.length} ZIPs received` + (dropped ? '; ' + dropped : '')); };
    /* the plan as other modules read it: the stored plan plus the ZIPs bought, the language of each market, and the tier and bid used.
       spanTh is null on purpose: the Desk's Spanish rule is no longer a share speaking Spanish at home, so the Site Forge keeps its own setting. */
    this.plan = () => Object.assign(JSON.parse(JSON.stringify(P)), { zips: MKT.map(m => m.z.zip), spanTh: null, lang: Object.fromEntries(LANGS.map(Lg => [Lg.k, { th: langTh(Lg.k), basis: Lg.basis, zips: MKT.filter(m => m.langs.includes(Lg.k)).map(m => m.z.zip) }])), tiers: Object.fromEntries(MKT.map(m => [m.z.zip, { tier: tierOf(m.z), bid: bidOf(m.z) }])) });
    this.feed = () => { const out = []; const z = MKT[0] && MKT[0].z; const plats = PLATS.filter(p => p === 'google' || p === 'meta' || (FC[p] && FC[p].spend > 0)); groups().forEach(g => langList().forEach(lang => plats.forEach(p => { if (p === 'google' || p === 'microsoft') { const r = rsaFor(g, z, lang); out.push({ label: `${p === 'google' ? 'Google' : 'Microsoft'} RSA · ${g.label} · ${lang}`, text: r.h.concat(r.d).join('\n'), plat: p }); } else if (p !== 'lsa') { const s = socialFor(g, z, lang, p); out.push({ label: `${PLAB[p]} · ${g.label} · ${lang}`, text: s.body + '\n' + (s.title || ''), plat: p }); } }))); if (plats.includes('lsa')) out.push({ label: 'Local Services Ads · business bio', text: lsaBio(z), plat: 'lsa' }); return out; };
    /* pure parts, for tests and for other modules that want the Desk's arithmetic without its screen */
    this.api = { markets: () => MKT, forecast: () => FC, groups, rsaFor, socialFor, lsaBio, kwFor, searchRows, socialRows, lsaRows, creativeRows, keywordRows, planRows, camp, langs: () => LANGS, langTh, langOk, langShare: k => langShare(MKT, k), tierOf, bidOf, pacing, resPlan, evSel, set: o => { Object.assign(P, o || {}); tidy(); syncUI(); rebuild(); return P; }, header: GH };
    BUS.on('theme', () => rebuild()); BUS.on('brand', () => { syncUI(); rebuild(); }); BUS.on('slm', () => rebuild(true));
    syncUI(); asmUI(); rebuild();
  }
});
