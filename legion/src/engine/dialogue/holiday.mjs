// Legion · dialogue · holidays: the holidays a player's line names, when they fall from the conversation's day, and
// what the speaker's record says about that day (on the schedule or off, who they will be with).
//
// The snapshot is the Monday before Thanksgiving, so "Happy Thanksgiving!" and "What are you doing for
// Thanksgiving?" come up. The answers rest on the record: the household (hosting a full house, dinner with the family,
// the two of them, a quiet one alone) and the work days (a nurse whose schedule has her on Thursday works it). Nothing
// is invented about where anyone travels or who comes over beyond the people who live there.

import { pacific } from '../clock.mjs';
import { num } from './core.mjs';

const DAY_MS = 86400000;
const dayNumber = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY_MS);

/** The n-th weekday (0 Sunday … 6 Saturday) of a month, as a day number (days since the epoch). */
function nthWeekday(y, m, dow, n) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return dayNumber(y, m, 1 + ((dow - first + 7) % 7) + 7 * (n - 1));
}

/**
 * The holidays people wish each other and plan for: {en, es (as said after "para"), esHappy (after "Feliz"),
 * day(year) → day number}.
 */
export const HOLIDAYS = Object.freeze({
  thanksgiving: { en: 'Thanksgiving', es: 'el Día de Acción de Gracias', esHappy: 'Día de Acción de Gracias', day: y => nthWeekday(y, 11, 4, 4) },
  christmas: { en: 'Christmas', es: 'la Navidad', esHappy: 'Navidad', day: y => dayNumber(y, 12, 25) },
  newyear: { en: "New Year's", es: 'el Año Nuevo', esHappy: 'Año Nuevo', day: y => dayNumber(y, 1, 1) },
  halloween: { en: 'Halloween', es: 'Halloween', esHappy: 'Halloween', day: y => dayNumber(y, 10, 31) },
  july4: { en: 'the Fourth of July', es: 'el 4 de julio', esHappy: '4 de julio', day: y => dayNumber(y, 7, 4) },
});

const NAMES = [
  ['thanksgiving', /\bthanksgiving\b|\bturkey day\b|\bfriendsgiving\b/],
  ['christmas', /\bchristmas\b|\bxmas\b|\bnavidad\b/],
  ['newyear', /\bnew year'?s?\b|\bnew years eve\b|\bano nuevo\b/],
  ['halloween', /\bhalloween\b|\btrick or treat/],
  ['july4', /\b(?:the )?fourth of july\b|\b4th of july\b|\bjuly (?:4th|fourth)\b|\bindependence day\b/],
];
// A turkey is Thanksgiving's ("are you cooking a turkey?").
const TURKEY = /\bturkey\b(?! (?:sandwich|burger|club|bacon|jerky))/;

/**
 * The holiday a line names: a key of HOLIDAYS, 'holidays' for "the holidays", or null.
 * @param {string} scan the line, lower case, accents folded
 * @returns {string|null}
 */
export function holidayOf(scan) {
  const s = String(scan || '');
  for (const [k, re] of NAMES) if (re.test(s)) return k;
  if (/\b(?:the )?holidays?\b(?! inn)/.test(s)) return 'holidays';
  if (TURKEY.test(s) && /\b(?:cook|cooking|make|making|roast|roasting|fry|frying|bake|baking|get|getting|having)\b/.test(s)) return 'thanksgiving';
  return null;
}

/**
 * When a holiday falls from day t: {key, days (until it; negative once past), dow}. "the holidays" is the nearest of
 * Thanksgiving, Christmas and New Year's still ahead (or at most a week past).
 * @param {string} key a key of HOLIDAYS or 'holidays'
 * @param {number} t epoch ms
 * @returns {{key: string, days: number, dow: number}|null}
 */
export function holidayWhen(key, t) {
  const p = pacific(t);
  const today = dayNumber(p.year, p.month, p.day);
  const keys = key === 'holidays' ? ['thanksgiving', 'christmas', 'newyear'] : HOLIDAYS[key] ? [key] : [];
  let best = null;
  for (const k of keys) {
    for (const y of [p.year - 1, p.year, p.year + 1]) {
      const day = HOLIDAYS[k].day(y);
      const days = day - today;
      if (days < -7) continue;
      if (!best || days < best.days) best = { key: k, days, dow: new Date(day * DAY_MS).getUTCDay() };
    }
  }
  return best;
}

/** How far off a holiday is, as said: ['today' | 'tomorrow' | 'this week' | …, the Spanish]. */
export function holidaySoon(days) {
  if (days <= 0) return ['today', 'hoy'];
  if (days === 1) return ['tomorrow', 'mañana'];
  if (days <= 6) return ['this week', 'esta semana'];
  if (days <= 13) return ['next week', 'la próxima semana'];
  if (days <= 27) return ['a couple of weeks away', 'en un par de semanas'];
  return ['coming up', 'pronto'];
}

// Work that goes on through a holiday. By what the job is (care, safety, kitchens and dining rooms, hotels, transit,
// animals) and by where hands-on work is done (a hospital's janitor or cook, a gas station's cashier; not the hospital's
// billing office, and not a department store, a school or a factory, which close).
const HOLIDAY_TITLE = /\b(nurse|nursing|caregiver|(?:home health|personal care|psychiatric|resident care) aide|paramedic|emt|police|sheriff|deputy|firefighter|correction(?:s|al)|security (?:guard|officer)|dispatcher|cook|chef|server|waiter|waitress|bartender|dishwasher|busser|host|hostess|housekeeper|bellhop|concierge|desk clerk|bus (?:driver|operator)|rideshare|taxi|ramp agent|flight attendant|pilot|air traffic|ranch hand|dairy|milker|herdsman|livestock|respiratory therapist|radiologic|surgical tech\w*)\b/;
const HOLIDAY_PLACE = /\b(hospital|skilled nursing|nursing home|nursing facility|assisted living|care home|memory care|residential care|prison|jail|detention|police|fire department|sheriff|airport|hotel|resort|casino|transit|gas station|convenience store|grocery store|supermarket|drugstore|pharmacy)\b/;
const DESK_TITLE = /\b(manager|director|administrator|administrative|secretary|receptionist|(?<!desk )clerk|accountant|analyst|billing|coder|coordinator|specialist|representative|recruiter|engineer|developer|programmer|scientist|assistant)\b/;
const CLOSED_PLACE = /\b(school|college|university|clinic|medical group|practice|office|dental|district|factory|plant|warehouse|department store)\b/;
const ANIMALS = /\b(ranch|rancher|dairy|cattle|livestock|poultry|chickens?|eggs?|goats?|sheep|hogs?|horses?|stable)\b/;

/**
 * Whether the speaker works on a holiday: it falls on one of their working days (commute.workDays) and their work goes
 * on through holidays (care, safety, kitchens, hotels, transit, a round-the-clock shift, animals on their own place).
 * @param {object} v a voice
 * @param {{dow: number}} when
 * @returns {boolean}
 */
export function worksHoliday(v, when) {
  if (!v || !when || !v.speaker || v.speaker.works !== true) return false;
  const c = v.commute || {};
  const days = num(c.workDays, num(c.days, 0));
  if (!(days & (1 << when.dow))) return false;
  const occ = v.occ || {};
  const title = String(occ.title || '').toLowerCase(), where = `${occ.employer || ''} ${occ.sector || ''}`.toLowerCase();
  // (their own farm: animals are fed every day; an orchard or a vineyard rests in late fall)
  if (v.flags && v.flags.onFarm) return ANIMALS.test(`${title} ${where}`);
  if (occ.shift === 'h24') return true;
  if (CLOSED_PLACE.test(where) && !/\b(hospital|prison|jail)\b/.test(where)) return false;
  return HOLIDAY_TITLE.test(title) || (HOLIDAY_PLACE.test(where) && !DESK_TITLE.test(title));
}
