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
