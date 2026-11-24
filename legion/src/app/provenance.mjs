// Legion · provenance: where an NPC's facts come from, in words.
//
// Every claim an NPC makes about their place comes from the world pack (CONTRACTS section 3). The engine marks
// each claim with an id: the offline dialogue's Line.facts ('fire:Station:2009', 'weather.now', 'road:I-210'), the
// atlas column a persona's concern cites ('(nonren_sh)'), the history a memory was drawn from
// ('firesOf(91042): Station 2009'). These helpers turn them into the short labels the panels show, naming the
// dataset behind each one (the pack's own sources list: the atlas, the ACS tables, the NWS snapshot, Caltrans,
// USGS, CAL FIRE, FEMA).

import { fireLabel } from './services.mjs';

/** The datasets in the pack, by key (pack.sources). */
export const DATASETS = Object.freeze({
  atlas: 'California atlas',
  acs: 'Census ACS 2020–2024',
  nws: 'National Weather Service',
  aadt: 'Caltrans 2024 traffic census',
  gnis: 'USGS place names',
  frap: 'CAL FIRE perimeters',
  fema: 'FEMA declarations',
  cgs: 'California Geological Survey provinces',
});

// Atlas columns (and the record fields) a persona's concerns cite, with what each holds and the dataset it comes from.
const ACS_ATLAS = 'Census ACS via the atlas', CLIMATE = 'atlas climate records', STATIONS = 'atlas station records', STORMS = 'atlas storm records';
const BUSINESS = 'atlas business counts', PERIMETERS = 'CAL FIRE perimeters', DAMAGE = 'CAL FIRE damage inspections', RECORD = 'their Census-calibrated record';
const COLUMNS = {
  // insurance
  nonren_sh: ['policies not renewed in 2023', 'CA Dept. of Insurance via the atlas'],
  fair_sh: ['FAIR Plan policies per 100 homes', 'FAIR Plan via the atlas'],
  prem: ['average homeowners premium', 'CA Dept. of Insurance via the atlas'],
  wf_hi_sh: ['homes at high wildfire risk', 'atlas'],
  // wildfire
  fhsz_any: ['land in a fire hazard zone', 'CAL FIRE hazard zones via the atlas'],
  fhsz_vh: ['land in a very high hazard zone', 'CAL FIRE hazard zones via the atlas'],
  fire_n: ['fires since 2000', PERIMETERS], burn_sh: ['land burned since 2000', PERIMETERS],
  firesOf: ['fires that burned in or near the ZIP', PERIMETERS],
  fire_near: ['the nearest large fire', PERIMETERS], fire_near_yr: ['the year of the nearest large fire', PERIMETERS],
  fire_km: ['how far away it burned', PERIMETERS], fire_big: ['the largest fire', PERIMETERS], fire_big_yr: ['the year of the largest fire', PERIMETERS],
  fire_big_ac: ['the acres it burned', PERIMETERS], fire_last: ['the latest fire', PERIMETERS], fire_last_yr: ['the year of the latest fire', PERIMETERS],
  fire_dest_res: ['homes destroyed by fire', DAMAGE], fire_worst: ['the most destructive fire', DAMAGE],
  fire_worst_yr: ['the year of the most destructive fire', DAMAGE], fire_worst_dest: ['the buildings it destroyed', DAMAGE],
  // disasters
  femaOf: ['disaster declarations for the county', 'FEMA declarations'], fema_k: ['disaster declarations', 'FEMA declarations'],
  fema_fire: ['fire disaster declarations', 'FEMA declarations'], fema_storm: ['storm disaster declarations', 'FEMA declarations'],
  fema_quake: ['earthquake disaster declarations', 'FEMA declarations'],
  // climate and weather records
  h100: ['days at 100°F', CLIMATE], h90: ['days at 90°F', CLIMATE], h110: ['days at 110°F', CLIMATE],
  tjul: ['July average high', CLIMATE], heat_rec_f: ['heat record', STATIONS],
  rain_in: ['yearly rain', CLIMATE], rain_wet_m: ['the wettest month', CLIMATE], rain_rec_in: ['rain record', STATIONS],
  snowfall_in: ['yearly snowfall', CLIMATE], snow_psf: ['snow load', CLIMATE],
  ar_n: ['atmospheric rivers a year', CLIMATE], ar_days: ['atmospheric river days', CLIMATE], ar_max: ['the strongest atmospheric river', STORMS],
  flood_n10: ['flood reports nearby', STORMS], g58: ['damaging gusts', STORMS], sa_ep: ['Santa Ana wind events', STORMS], di_ep: ['Diablo wind events', STORMS],
  gust_max: ['gust record', STATIONS], off_kind: ['offshore wind regime', 'atlas'], hail_n25: ['hail reports', STORMS], tor_n25: ['tornado reports', STORMS],
  cz: ['the building climate zone', 'atlas'], zone: ['the climate zone', 'atlas'],
  // the land
  coast_km: ['distance to the coast', 'atlas'], elev_m: ['elevation', 'atlas'], elev_max_m: ['the highest ground', 'atlas'],
  marine_cls: ['salt air exposure', 'atlas'], salt_cls: ['salt air exposure', 'atlas'], stress: ['weather stress', 'atlas'], st_top: ['the main weather stress', 'atlas'],
  province: ['the geomorphic province', 'California Geological Survey provinces'],
  // roofs and homes
  roof_age: ['median roof age', 'atlas'], ra20_sh: ['roofs over 20 years old', 'atlas'], roof: ['their roof', 'their household'],
  tile_sh: ['tile roofs', 'atlas'], wood_sh: ['wood shake roofs', 'atlas'], metal_sh: ['metal roofs', 'atlas'], solar_sh: ['rooftop solar', 'atlas'],
  // Census tables through the atlas columns
  value: ['median home value', ACS_ATLAS], inc: ['median household income', ACS_ATLAS], own_sh: ['owner share', ACS_ATLAS], yb_med: ['median year built', ACS_ATLAS],
  density: ['density', ACS_ATLAS], val1m_sh: ['homes worth $1 million or more', ACS_ATLAS], mort_sh: ['owners with a mortgage', ACS_ATLAS],
  moved10_sh: ['households that moved in since 2010', ACS_ATLAS], own_yr: ['how long owners have stayed', ACS_ATLAS], vac_sh: ['vacant homes', ACS_ATLAS],
  hh100k_sh: ['households over $100,000', ACS_ATLAS], hh200k_sh: ['households over $200,000', ACS_ATLAS], rooms: ['rooms per home', ACS_ATLAS],
  sfd_sh: ['single-family houses', ACS_ATLAS], mf5_sh: ['large apartment buildings', ACS_ATLAS], mh_sh: ['mobile homes', ACS_ATLAS],
  age_med: ['median age', ACS_ATLAS], s65_sh: ['residents 65 and over', ACS_ATLAS], lep_sh: ['neighbors with limited English', ACS_ATLAS],
  span_sh: ['Spanish speakers', ACS_ATLAS], hisp_sh: ['Hispanic residents', ACS_ATLAS], asian_sh: ['Asian residents', ACS_ATLAS],
  ACS: ['the Census tables', 'Census ACS 2020–2024'],
  // business counts
  est: ['establishments', BUSINESS], retail: ['stores', BUSINESS], food: ['places to eat', BUSINESS], lodging: ['places to stay', BUSINESS],
  office: ['offices', BUSINESS], health: ['health-care establishments', BUSINESS], school: ['schools', BUSINESS], church: ['congregations', BUSINESS],
  auto: ['auto shops', BUSINESS], mfg: ['manufacturers', BUSINESS], whse: ['warehouses', BUSINESS], builders: ['builders', BUSINESS],
  roofers: ['roofers', BUSINESS], solar_co: ['solar installers', BUSINESS], ins_agents: ['insurance agents', BUSINESS],
  // highways
  Caltrans: ['highway traffic counts', 'Caltrans 2024 traffic census'], aadt: ['daily traffic', 'Caltrans 2024 traffic census'],
  // their own record
  occupation: ['their job', RECORD], tenure: ['owning or renting', RECORD], commute: ['their commute', RECORD],
  household: ['their household', RECORD], householdIncome: ['their household income', RECORD], income: ['their income', RECORD],
  arrivalYear: ['when they came to the US', RECORD], birthplace: ['where they were born', RECORD], status: ['what they do', RECORD],
  age: ['their age', RECORD], languages: ['their languages', RECORD],
  NWS: ['an alert in effect', 'National Weather Service'],
};

/** Readable names for the dialogue's grounded fact families (dialogue/ground.mjs header). */
const FACT_LABEL = {
  'weather.now': 'the forecast for this hour (NWS)',
  'weather.next': 'the forecast periods ahead (NWS)',
  'weather.keyMessage': "the forecast office's key messages (NWS)",
  'weather.fireOutlook': 'the fire weather outlook (NWS / SPC)',
  'record.heat': 'the heat record (atlas station records)',
  'record.rain': 'the one-day rain record (atlas station records)',
  'record.gust': 'the gust record (atlas station records)',
  'clim.h100': 'days at 100°F (atlas climate records)',
  'clim.h90': 'days at 90°F (atlas climate records)',
  'clim.tjul': 'the July average high (atlas climate records)',
  'clim.rain': 'yearly rain (atlas climate records)',
  'clim.snow': 'yearly snowfall (atlas climate records)',
  'clim.flood': 'flood reports nearby (atlas storm records)',
  'clim.ar': 'atmospheric rivers (atlas climate records)',
  fhsz: 'fire hazard zones (CAL FIRE via the atlas)',
  'clim.winter': 'the winter climate (atlas climate records)',
  'clim.snowLoad': 'the snow load (atlas climate records)',
  'clim.wetMonth': 'the wettest month (atlas climate records)',
  'clim.offKind': 'the offshore wind regime (atlas)',
  'weather.rainOutlook': 'the excessive rain outlook (NWS / WPC)',
  'acs.density': 'how densely people live here (Census ACS)',
  'acs.lang': 'the languages neighbors speak at home (Census ACS)',
  'acs.own': 'the share of owners (Census ACS)',
  'acs.value': 'the median home value (Census ACS)',
  'acs.yb': 'the median year built (Census ACS)',
  'biz.food': 'the count of places to eat (atlas business counts)',
  'ins.fair': 'FAIR Plan policies (atlas)',
  'ins.nonren': 'policies not renewed in 2023 (atlas)',
  'ins.prem': 'the average premium (atlas)',
  'npc.occupation': 'their job (their record)',
  'npc.commute': 'their commute (their record)',
  'npc.household': 'their household (their record)',
  'npc.residence': 'how long they have lived here (their record)',
  'npc.origin': 'where they were born (their record)',
  'npc.school': 'their school (their record)',
  'npc.status': 'what they do (their record)',
  'persona.memory': 'one of their memories',
  'persona.interests': 'their interests',
  'persona.teams': 'the teams they follow',
  'persona.roof': 'their roof (their household)',
  'persona.concerns': 'what worries them (their persona)',
  'schedule.activity': 'what they are doing now (their schedule)',
  'household.members': 'who they live with (their record)',
  'household.occupation': 'a family member’s job (their record)',
  'joke.pun': 'a joke (no data)',
};

const LANG_NAMES = { spanish: 'Spanish', chinese: 'Chinese', vietnamese: 'Vietnamese', tagalog: 'Tagalog', korean: 'Korean', arabic: 'Arabic', english: 'English', french: 'French', german: 'German', slavic: 'Slavic languages', indoeuro: 'other Indo-European languages', asianpi: 'other Asian languages', other: 'other languages' };

function date(s) {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(s || ''));
  if (!m) return String(s || '');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
}

/**
 * A fact id of the offline dialogue (Line.facts) in words, naming its dataset: 'fire:Station:2009' → 'the Station
 * Fire, 2009 (CAL FIRE perimeters)'. Unknown ids come back as they are.
 * @param {string} id
 * @returns {string}
 */
export function factLabel(id) {
  const s = String(id || '');
  if (FACT_LABEL[s]) return FACT_LABEL[s];
  const [kind, ...rest] = s.split(':');
  const val = rest.join(':');
  switch (kind) {
    case 'alert': return `the ${val} (NWS alert)`;
    case 'fire': {
      const [name, year] = [rest.slice(0, -1).join(':') || rest[0], rest[rest.length - 1]];
      const label = fireLabel(name.replace(/\s+Incident$/i, '')) || (/\b(fire|fires|complex|incident)$/i.test(name) ? `the ${name}` : `the ${name} Fire`);
      return `${label}${/^\d{4}$/.test(year) ? `, ${year}` : ''} (CAL FIRE perimeters)`;
    }
    case 'ar': return `the atmospheric river of ${date(val)} (atlas storm records)`;
    case 'wind': return `the ${String(rest[0] || '').replace(/_/g, ' ')} wind event of ${date(rest[1])} (atlas storm records)`;
    case 'fema': return `the FEMA disaster declaration of ${date(val)}`;
    case 'road': return `${val} (Caltrans 2024 traffic census)`;
    case 'aadt': return `daily traffic on ${val} (Caltrans 2024 traffic census)`;
    case 'stretch': return `${val} (a named stretch of highway)`;
    case 'landmark': return `${val} (USGS place names)`;
    case 'place': return `${val} (Census places)`;
    default: break;
  }
  let m = /^acs\.lang\.(\w+)$/.exec(s);
  if (m) return `neighbors who speak ${LANG_NAMES[m[1]] || m[1]} at home (Census ACS)`;
  m = /^acs\.comm\.(\w+)$/.exec(s);
  if (m) return `how neighbors get to work (Census ACS)`;
  m = /^(npc|persona|household)\.(\w+)/.exec(s);
  if (m) return m[1] === 'persona' ? `their ${m[2]} (their persona)` : m[1] === 'household' ? `their household's ${m[2]} (their record)` : `their ${m[2]} (their record)`;
  return s;
}

/**
 * The atlas columns a concern's `why` cites (the names in parentheses) with what each holds and its dataset:
 * [{column, label, source}], unique, in order.
 * @param {string} why
 * @returns {Array<{column: string, label: string, source: string}>}
 */
export function concernSources(why) {
  const out = [], seen = new Set();
  const re = /\(([^()]+)\)/g;
  let m;
  while ((m = re.exec(String(why || '')))) {
    for (const part of m[1].split(/[,;]\s*/)) {
      const col = (part.trim().split(/\s+/)[0] || '').replace(/[^\w]/g, '');
      const known = COLUMNS[col];
      if (!known || seen.has(col)) continue;
      seen.add(col);
      out.push({ column: col, label: known[0], source: known[1] });
    }
  }
  return out;
}

/** True for a token that is a column or record code rather than a word: a COLUMNS key, snake_case, camelCase, a call. */
function codeLike(token) {
  const t = String(token || '').replace(/[^\w()]/g, '');
  const bare = t.replace(/\(.*$/, '');
  return !!(COLUMNS[bare] || /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(bare) || /^[a-z]+[A-Z]\w*$/.test(bare) || /^[a-z]+\w*\(\d*\)$/.test(t));
}

/**
 * A concern's or an interest's `why` as a sentence for people: the column codes it cites in parentheses
 * ("(coast_km)", "(off_kind di)", "(femaOf)") and raw coordinates ("(team home 37.87, -122.26)") are left out; the
 * panel shows the datasets behind them on their own line (concernSourceText) and keeps the raw text in a tooltip.
 * Parentheses that hold words ("(about 40%)") stay.
 * @param {string} why
 * @returns {string}
 */
export function plainWhy(why) {
  const s = String(why || '');
  const out = s.replace(/\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (all, inner) => {
    const text = inner.trim();
    if (!text) return '';
    if (/^(?:team )?home\s+-?\d/i.test(text) || /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(text)) return '';
    const parts = text.split(/[,;]\s*/).map(p => p.trim()).filter(Boolean);
    return parts.length && parts.every(p => codeLike(p.split(/\s+/)[0]) || /^-?\d+(?:\.\d+)?$/.test(p)) ? '' : all;
  });
  return out.replace(/\s+([.,;:!?])/g, '$1').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
}

/** The datasets behind a concern's `why`, as one short phrase: "CAL FIRE hazard zones via the atlas · atlas". */
export function concernSourceText(why) {
  const names = [...new Set(concernSources(why).map(s => s.source))];
  return names.join(' · ');
}

/**
 * Where a persona memory comes from, in words: 'firesOf(91042): Station 2009' → 'CAL FIRE perimeters'; life
 * events (no source) → 'their own life'.
 * @param {{source?: string, kind?: string}} mem
 * @returns {string}
 */
export function memorySource(mem) {
  const s = String((mem && mem.source) || '');
  if (/^firesOf\(/.test(s)) return 'CAL FIRE perimeters';
  if (/^arsOf\(/.test(s)) return 'atlas storm records';
  if (/^windsOf\(/.test(s)) return 'atlas storm records';
  if (/^femaOf\(/.test(s)) return 'FEMA declarations';
  if (/heat_rec|rain_rec|gust_max/.test(s)) return 'atlas station records';
  // life events cite the NPC's own record (household.yearMoved, npc.arrivalYear, roof, residence.countySince ...)
  if (!s || (mem && mem.kind === 'life') || /^(npc|household|residence|roof)\b/.test(s)) return 'their own life';
  return s;
}
