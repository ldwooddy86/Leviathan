// Legion · Pacific time. The simulation runs on California's clock; every time in Legion is epoch ms, read here.

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short',
});
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const cache = new Map();

/**
 * Pacific calendar parts of epoch ms t.
 * @returns {{year:number, month:number, day:number, dow:number, hour:number, minute:number, second:number, minuteOfDay:number, dayName:string, monthName:string, iso:string, label:string}}
 */
export function pacific(t) {
  const key = Math.floor(t / 60000);
  const hit = cache.get(key);
  if (hit) return hit;
  const parts = {};
  for (const p of FMT.formatToParts(new Date(key * 60000))) parts[p.type] = p.value;
  const hour = +parts.hour % 24, minute = +parts.minute;
  const out = {
    year: +parts.year, month: +parts.month, day: +parts.day, dow: DOW[parts.weekday], hour, minute, second: 0,
    minuteOfDay: hour * 60 + minute, dayName: DAYS[DOW[parts.weekday]], monthName: MONTHS[+parts.month - 1],
  };
  out.iso = `${out.year}-${String(out.month).padStart(2, '0')}-${String(out.day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  out.label = `${out.dayName.slice(0, 3)} ${out.monthName.slice(0, 3)} ${out.day}, ${fmtClock(out.minuteOfDay)}`;
  if (cache.size > 5000) cache.clear();
  cache.set(key, out);
  return out;
}

/** Epoch ms of a Pacific wall-clock time (handles daylight time by probing the offset). */
export function atPacific(year, month, day, hour = 0, minute = 0) {
  let guess = Date.UTC(year, month - 1, day, hour + 8, minute);
  for (let k = 0; k < 3; k++) {
    const p = pacific(guess);
    const have = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const want = Date.UTC(year, month - 1, day, hour, minute);
    if (have === want) return guess;
    guess += want - have;
  }
  return guess;
}

/** Start (epoch ms) of the Pacific day holding t. */
export function dayStart(t) { const p = pacific(t); return atPacific(p.year, p.month, p.day, 0, 0); }

/** 'night' | 'early' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'late' for a minute of the day. */
export function dayPart(minuteOfDay) {
  const h = minuteOfDay / 60;
  if (h < 5) return 'night';
  if (h < 7) return 'early';
  if (h < 11) return 'morning';
  if (h < 14) return 'midday';
  if (h < 17.5) return 'afternoon';
  if (h < 21.5) return 'evening';
  return 'late';
}

export function isWeekend(t) { const d = pacific(t).dow; return d === 0 || d === 6; }

/** "7:05 AM" for a minute of the day. */
export function fmtClock(minuteOfDay) {
  const m = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Mon Nov 23, 2:38 PM" for epoch ms. */
export function fmtTime(t) { return pacific(t).label; }

export { DAYS, MONTHS };
