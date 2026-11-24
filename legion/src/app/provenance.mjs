// Legion · provenance: where an NPC's facts come from, in words.
//
// Every claim an NPC makes about their place comes from the world pack (CONTRACTS section 3). The engine marks
// each claim with an id: the offline dialogue's Line.facts ('fire:Station:2009', 'weather.now', 'road:I-210'), the
// atlas column a persona's concern cites ('(nonren_sh)'), the history a memory was drawn from
// ('firesOf(91042): Station 2009'). These helpers turn them into the short labels the panels show, naming the
// dataset behind each one (the pack's own sources list: the atlas, the ACS tables, the NWS snapshot, Caltrans,
// USGS, CAL FIRE, FEMA).

/** The datasets in the pack, by key (pack.sources). */
export const DATASETS = Object.freeze({
  atlas: 'California atlas',
  acs: 'Census ACS 2020–2024',
  nws: 'National Weather Service',
  aadt: 'Caltrans 2024 traffic census',
  gnis: 'USGS place names',
  frap: 'CAL FIRE perimeters',
  fema: 'FEMA declarations',
});

// Atlas columns a persona's concerns cite, with what each holds and the dataset it comes from.
const COLUMNS = {
  nonren_sh: ['policies not renewed in 2023', 'CA Dept. of Insurance via the atlas'],
  fair_sh: ['FAIR Plan policies per 100 homes', 'FAIR Plan via the atlas'],
  prem: ['average homeowners premium', 'CA Dept. of Insurance via the atlas'],
  wf_hi_sh: ['homes at high wildfire risk', 'atlas'],
  fhsz_any: ['land in a fire hazard zone', 'CAL FIRE hazard zones via the atlas'],
  fhsz_vh: ['land in a very high hazard zone', 'CAL FIRE hazard zones via the atlas'],
  fire_n: ['fires since 2000', 'CAL FIRE perimeters'], burn_sh: ['land burned since 2000', 'CAL FIRE perimeters'],
  h100: ['days at 100°F', 'atlas climate records'], h90: ['days at 90°F', 'atlas climate records'], h110: ['days at 110°F', 'atlas climate records'],
  tjul: ['July average high', 'atlas climate records'], heat_rec_f: ['heat record', 'atlas station records'],
  rain_in: ['yearly rain', 'atlas climate records'], rain_rec_in: ['rain record', 'atlas station records'],
  snowfall_in: ['yearly snowfall', 'atlas climate records'], snow_psf: ['snow load', 'atlas climate records'],
  ar_n: ['atmospheric rivers a year', 'atlas climate records'], ar_days: ['atmospheric river days', 'atlas climate records'],
  flood_n10: ['flood reports nearby', 'atlas storm records'], g58: ['damaging gusts', 'atlas storm records'],
  gust_max: ['gust record', 'atlas station records'], off_kind: ['offshore wind regime', 'atlas'], hail_n25: ['hail reports', 'atlas storm records'],
  roof_age: ['median roof age', 'atlas'], ra20_sh: ['roofs over 20 years old', 'atlas'], roof: ['their roof', 'their household'],
  value: ['median home value', 'Census ACS via the atlas'], inc: ['median household income', 'Census ACS via the atlas'],
  own_sh: ['owner share', 'Census ACS via the atlas'], yb_med: ['median year built', 'Census ACS via the atlas'],
  coast_km: ['distance to the coast', 'atlas'], elev_m: ['elevation', 'atlas'], density: ['density', 'Census ACS via the atlas'],
  marine_cls: ['salt air exposure', 'atlas'], salt_cls: ['salt air exposure', 'atlas'], stress: ['weather stress', 'atlas'],
  occupation: ['their job', 'their Census-calibrated record'], tenure: ['owning or renting', 'their Census-calibrated record'],
  commute: ['their commute', 'their Census-calibrated record'], NWS: ['an alert in effect', 'National Weather Service'],
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
      const label = /\b(fire|fires|complex|incident)$/i.test(name) ? `the ${name}` : `the ${name} Fire`;
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
  m = /^(npc|persona)\.(\w+)/.exec(s);
  if (m) return m[1] === 'npc' ? `their ${m[2]} (their record)` : `their ${m[2]} (their persona)`;
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
