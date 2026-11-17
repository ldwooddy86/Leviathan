/* The review score, from one place.

   A rating typed into a page or an ad is wrong the day another review lands. So nothing types it. Copy carries a token,
   and the token is filled, each time a page or a campaign is built, from the one figure on file:

     {reviews.rating}   4.9                               the average, to one decimal
     {reviews.floor}    900                               the count rounded DOWN to a round number: "over {reviews.floor}"
     {reviews.line}     4.9 from over 900 Google reviews  the whole claim as a sentence part
     {reviews.source}   Google
     {reviews.asOf}     November 2026                     the month the figure was read
     {reviews.count}    915                               the exact count. It dates fastest; the gate warns on it.

   "Over 900" stays true while the profile grows, which is why the round floor is the form to write.

   The figure on file comes from one of three places, newest first:
     profile     read from the business's Google profile through the Places API (`reviews sync`)
     person      what a person said it is (`reviews set`), until the profile is linked
     dashboard   the figure the dashboard was built with, which is the oldest and carries its own date

   It is kept beside the connection, outside the repository, in reviews.json: the linked profile (a place id), the
   figure in force and the figures before it. Both agents' gates read it: a review figure written by hand that does not
   match is an error, and a figure older than MAX_AGE_DAYS is a warning to sync again.

   The key for the Places API is never in a file or on a command line. It is read from GOOGLE_PLACES_API_KEY when that
   is set; otherwise the request goes out with a placeholder and the session's proxy puts the saved key in its place. */
import fs from 'node:fs';
import path from 'node:path';
import { LINK, readJson, writeJson, outside } from './paths.mjs';

export const FORMAT = 'leviathan.reviews';
export const MAX_AGE_DAYS = 31;
export const PLACES = 'https://places.googleapis.com/v1';
export const file = () => path.join(LINK, 'reviews.json');

const day = d => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ageDays = (asOf, now = new Date()) => { const t = Date.parse(String(asOf || '').slice(0, 10) + 'T12:00:00Z'); return Number.isFinite(t) ? Math.max(0, Math.floor((now.getTime() - t) / 864e5)) : null; };
const isNum = v => typeof v === 'number' && Number.isFinite(v);

/* ---------- what is on file ---------- */
export function load(f = file()) { const j = readJson(f, null); return j && j.format === FORMAT ? j : { format: FORMAT, v: 1, profile: null, figure: null, history: [] }; }
export function save(held, f = file()) { outside(path.dirname(f), 'The folder the review figure is kept in'); return writeJson(f, held); }

/* a figure as kept: {rating, count, atLeast, asOf, source, from} */
function figure(o, from) {
  if (!o || !isNum(+o.rating) || !(+o.rating >= 1 && +o.rating <= 5)) return null;
  const count = o.count == null || o.count === '' ? null : Math.max(0, Math.floor(+o.count));
  return { rating: Math.round(+o.rating * 10) / 10, count: Number.isFinite(count) ? count : null, atLeast: !!o.atLeast, asOf: String(o.asOf || '').slice(0, 10), source: o.source || 'Google', from: o.from || from };
}
/* The figure in force: the kept one (from the profile or a person) unless the dashboard's is newer; else the dashboard's.
   Returns null when nothing is on file. Adds ageDays and stale. */
export function inForce(brand, held = load(), now = new Date()) {
  const kept = figure(held && held.figure, 'person'), dash = figure(brand && brand.proof && brand.proof.reviews, 'dashboard');
  const pick = kept && dash ? (String(dash.asOf) > String(kept.asOf) ? dash : kept) : (kept || dash);
  if (!pick) return null;
  const age = ageDays(pick.asOf, now);
  return Object.assign({}, pick, { ageDays: age, stale: age == null || age > MAX_AGE_DAYS });
}
/* the brand with the figure in force as its proof.reviews, which is where both gates look */
export function overlay(brand, held = load(), now = new Date()) {
  if (!brand) return brand; const f = inForce(brand, held, now); if (!f) return brand;
  return Object.assign({}, brand, { proof: Object.assign({}, brand.proof || {}, { reviews: f }) });
}

/* ---------- the words ---------- */
/* a count rounded down to a number a person would say: 915 -> 900, 1,284 -> 1,200, 87 -> 80, 14 -> 14 */
export const floorCount = n => (n >= 100 ? Math.floor(n / 100) * 100 : n >= 20 ? Math.floor(n / 10) * 10 : n);
const commas = n => Number(n).toLocaleString('en-US');
export function words(f) {
  if (!f) return null;
  const w = { rating: f.rating.toFixed(1), source: f.source || 'Google' };
  if (f.asOf) { const [y, m] = f.asOf.split('-'); w.asOf = `${MONTHS[+m - 1] || ''} ${y}`.trim(); }
  if (f.count != null) {
    w.floor = commas(floorCount(f.count));
    if (!f.atLeast) w.count = commas(f.count);
    w.line = `${w.rating} from over ${w.floor} ${w.source} reviews`;
  }
  return w;
}
export const TOKEN = /\{reviews\.([A-Za-z]+)\}/g;
export const tokens = text => [...String(text || '').matchAll(TOKEN)].map(m => m[1]);
/* Fill the tokens in a text. Returns {text, missing}: `missing` lists the tokens the figure on file cannot fill
   (no figure at all, an unknown token, or the exact count when only a floor is on file). */
export function expand(text, f) {
  const w = words(f) || {}, missing = [];
  const out = String(text == null ? '' : text).replace(TOKEN, (m, k) => { if (w[k] == null) { missing.push(k); return m; } return w[k]; });
  return { text: out, missing: [...new Set(missing)] };
}
/* the same through every string of a value (a campaign file, a page's fields); returns {value, missing, filled} */
export function expandDeep(value, f) {
  const missing = new Set(); let filled = 0;
  const walk = v => { if (typeof v === 'string') { if (!v.includes('{reviews.')) return v; const r = expand(v, f); r.missing.forEach(k => missing.add(k)); if (r.text !== v) filled++; return r.text; } if (Array.isArray(v)) return v.map(walk); if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])); return v; };
  return { value: walk(value), missing: [...missing], filled };
}

/* ---------- the gate ---------- */
/* a rating as copy writes it, and a review count with the words around it */
const RATING = /\b([1-5]\.\d)(?= ?(?:stars?|star rating|out of 5|on google|rating|average|aggregate|from\b))|\brated ([1-5](?:\.\d)?)\b|\b([1-5](?:\.\d)?) ?stars?\b/gi;
const COUNT = /\b(over|more than|at least|nearly|almost|about|around)?\s*([\d,]{2,})(\+)?\s+(?:google |verified |five star |5 star |customer )*(?:reviews|ratings)\b/gi;
/* Findings for the review claims in a text, held against the figure in force:
   error  a rating that is not the profile's; a count the profile does not reach; a claim with no figure on file
   warn   an exact count (it dates the day a review lands); a figure older than MAX_AGE_DAYS
   Each is {severity, rule: 'reviews', kind, message, excerpt}; kind is rating, over, exact, nearly, none or stale. */
export function check(text, f, { maxAgeDays = MAX_AGE_DAYS } = {}) {
  const t = String(text || ''), F = [], add = (severity, kind, message, at, len) => F.push({ severity, rule: 'reviews', kind, message, excerpt: t.slice(Math.max(0, at - 30), at + len + 30).replace(/\s+/g, ' ').trim() });
  const ratings = [...t.matchAll(RATING)].map(m => ({ v: +(m[1] || m[2] || m[3]), at: m.index, len: m[0].length })), counts = [...t.matchAll(COUNT)].map(m => ({ soft: !!(m[1] || m[3]), under: /nearly|almost/i.test(m[1] || ''), n: +m[2].replace(/,/g, ''), at: m.index, len: m[0].length }));
  if (!ratings.length && !counts.length) return F;
  if (!f) { const x = ratings[0] || counts[0]; add('error', 'none', 'A review claim, and no review figure is on file. Link the Google profile and run reviews sync, or have a person set the figure.', x.at, x.len); return F; }
  const src = f.from === 'profile' ? 'the Google profile' : f.from === 'person' ? 'the figure a person set' : 'the figure the dashboard holds';
  for (const r of ratings) if (r.v !== f.rating) add('error', 'rating', `Says ${r.v}; ${src} says ${f.rating.toFixed(1)} (as of ${f.asOf || 'an unstated date'}). Write {reviews.rating} and let the build fill it.`, r.at, r.len);
  for (const c of counts) {
    if (f.count == null) { add('error', 'none', `Counts ${commas(c.n)} reviews, and no count is on file.`, c.at, c.len); continue; }
    if (c.under) { if (c.n <= f.count) add('warn', 'nearly', `"Nearly ${commas(c.n)}" understates a profile that has ${commas(f.count)}. Write "over {reviews.floor}".`, c.at, c.len); else if (c.n - f.count > Math.max(5, c.n * 0.03)) add('error', 'nearly', `Says nearly ${commas(c.n)} reviews; ${src} has ${commas(f.count)}.`, c.at, c.len); continue; }
    if (c.n > f.count) add('error', 'over', `Counts ${commas(c.n)} reviews; ${src} has ${f.atLeast ? 'at least ' : ''}${commas(f.count)} (as of ${f.asOf || 'an unstated date'}). Write "over {reviews.floor}".`, c.at, c.len);
    else if (!c.soft && c.n !== f.count) add('error', 'exact', `Counts exactly ${commas(c.n)} reviews; ${src} has ${f.atLeast ? 'at least ' : ''}${commas(f.count)}. Write "over {reviews.floor}", which stays true as the profile grows.`, c.at, c.len);
    else if (!c.soft) add('warn', 'exact', `An exact review count dates the day another review lands. Write "over {reviews.floor}" instead.`, c.at, c.len);
  }
  if (f.stale) { const x = ratings[0] || counts[0]; add('warn', 'stale', `The review figure on file is ${f.ageDays == null ? 'undated' : f.ageDays + ' days old'} (${src}, ${f.asOf || 'no date'}). Run reviews sync to read the profile again before this goes out.`, x.at, x.len); }
  return F;
}

/* ---------- the Google profile ---------- */
const FIELDS = ['id', 'displayName', 'formattedAddress', 'nationalPhoneNumber', 'rating', 'userRatingCount', 'googleMapsUri', 'businessStatus'];
const keyHeader = env => ({ 'X-Goog-Api-Key': (env && env.GOOGLE_PLACES_API_KEY) || 'set-by-the-session-proxy' });
export class ProfileError extends Error { constructor(message, status = 0) { super(message); this.name = 'ProfileError'; this.status = status; } }
async function ask(url, init, fetcher) {
  let r; try { r = await fetcher(url, Object.assign({ signal: AbortSignal.timeout(20000) }, init)); } catch (e) { throw new ProfileError(`Google's Places service could not be reached (${(e && (e.cause && e.cause.code || e.code || e.message)) || 'no answer'}).`); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const why = (j && j.error && (j.error.message || j.error.status)) || '';
    const said = String(why).replace(/\.+$/, '');
    if (r.status === 401 || r.status === 403 || (r.status === 400 && /api key/i.test(why))) throw new ProfileError(`Google refused the request (${r.status}${said ? ': ' + said : ''}). No valid key reached it. The key is an API key from a Google Cloud project with "Places API (New)" switched on and billing set up; it is read from GOOGLE_PLACES_API_KEY, or the session's proxy sends it in the X-Goog-Api-Key header.`, r.status);
    if (r.status === 404) throw new ProfileError('Google has no place with that id. Run reviews find to look the business up again.', 404);
    throw new ProfileError(`Google answered ${r.status}${said ? ': ' + said : ''}.`, r.status);
  }
  return j;
}
const place = p => ({ placeId: p.id || '', name: (p.displayName && p.displayName.text) || '', address: p.formattedAddress || '', phone: p.nationalPhoneNumber || '', mapsUri: p.googleMapsUri || '', status: p.businessStatus || '', rating: isNum(p.rating) ? p.rating : null, count: isNum(p.userRatingCount) ? p.userRatingCount : null });
/* look a business up by name and address: the candidates Google returns, best first */
export async function findPlace(query, { fetcher = fetch, env = process.env } = {}) {
  const j = await ask(`${PLACES}/places:searchText`, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json', 'X-Goog-FieldMask': FIELDS.map(f => 'places.' + f).join(',') }, keyHeader(env)), body: JSON.stringify({ textQuery: query, pageSize: 5 }) }, fetcher);
  return (j.places || []).map(place);
}
/* one profile by its place id */
export async function fetchPlace(placeId, { fetcher = fetch, env = process.env } = {}) {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(String(placeId || ''))) throw new ProfileError('That is not a place id. Run reviews find to get one.');
  return place(await ask(`${PLACES}/places/${placeId}`, { headers: Object.assign({ 'X-Goog-FieldMask': FIELDS.join(',') }, keyHeader(env)) }, fetcher));
}
/* is a candidate this business? The phone decides; failing that the street number and the ZIP. */
const digits = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
export function sameBusiness(p, brand) {
  if (!p || !brand) return false; const a = brand.address || {};
  if (digits(p.phone) && digits(p.phone) === digits(brand.phone)) return true;
  const no = (String(a.street || '').match(/^\s*(\d+)/) || [])[1], zip = String(a.zip || '').slice(0, 5);
  return !!no && !!zip && new RegExp('(^|\\D)' + no + '\\D').test(p.address) && p.address.includes(zip);
}
/* keep a profile as the one to read */
export function link(held, p, now = new Date()) { return Object.assign({}, held, { profile: { source: 'google', placeId: p.placeId, name: p.name, address: p.address, phone: p.phone, mapsUri: p.mapsUri, linked: day(now) } }); }
/* put a figure in force; the one before it goes to the history (the last 24 are kept) */
export function put(held, fig, now = new Date()) {
  const f = figure(Object.assign({}, fig, { asOf: fig.asOf || day(now) }), fig.from || 'person'); if (!f) throw new Error('A review figure needs a rating between 1 and 5.');
  const history = (held.history || []).concat(held.figure ? [held.figure] : []).slice(-24);
  return Object.assign({}, held, { figure: f, history });
}
/* Read the linked profile and put its figure in force. Returns {held, figure, before, changed, wordsChanged, place}. */
export async function sync(held, { fetcher = fetch, env = process.env, now = new Date() } = {}) {
  if (!held || !held.profile || !held.profile.placeId) throw new ProfileError('No Google profile is linked. Run reviews find, then reviews link <place id>.');
  const p = await fetchPlace(held.profile.placeId, { fetcher, env });
  if (p.rating == null || p.count == null) throw new ProfileError('Google returned the profile without a rating. A profile with no reviews has none to show.');
  const before = held.figure || null, next = put(held, { rating: p.rating, count: p.count, atLeast: false, source: 'Google', from: 'profile' }, now), a = words(before), b = words(next.figure);
  return { held: next, figure: next.figure, before, place: p, changed: !before || before.rating !== next.figure.rating || before.count !== next.figure.count, wordsChanged: !a || a.rating !== b.rating || a.floor !== b.floor };
}

/* ---------- for a person ---------- */
export function statusText(brand, held = load(), now = new Date()) {
  const f = inForce(brand, held, now), w = words(f), T = [];
  if (!f) T.push('Review figure: none on file. Link the Google profile (reviews find, reviews link) and run reviews sync, or set one by hand (reviews set --rating 4.8 --count 250).');
  else {
    const src = f.from === 'profile' ? 'read from the Google profile' : f.from === 'person' ? 'set by a person' : 'the figure the dashboard was built with';
    T.push(`Review figure in force: ${f.rating.toFixed(1)} from ${f.count == null ? 'an unstated number of' : (f.atLeast ? 'at least ' : '') + commas(f.count)} ${f.source} reviews, ${src}, as of ${f.asOf || 'an unstated date'}${f.ageDays != null ? ` (${f.ageDays} day${f.ageDays === 1 ? '' : 's'} ago)` : ''}.`);
    if (f.stale) T.push(`  It is older than ${MAX_AGE_DAYS} days: both gates warn on every review claim until it is read again.`);
    T.push('  What copy writes, and what a build puts there:');
    for (const k of ['rating', 'floor', 'line', 'source', 'asOf', 'count']) T.push(`    {reviews.${k}}`.padEnd(24) + (w[k] != null ? w[k] : k === 'count' ? '(not on file: only a floor is known)' : '(not on file)'));
  }
  const p = held && held.profile;
  T.push(p && p.placeId ? `Google profile linked: ${p.name}, ${p.address} (place id ${p.placeId}, linked ${p.linked}). reviews sync reads it.` : 'Google profile: not linked yet. reviews find looks the business up; reviews link <place id> keeps it; reviews sync reads the score.');
  return T.join('\n');
}
export const exists = () => fs.existsSync(file());
