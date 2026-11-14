/* Keywords as comparable things: a phrase is reduced to stems, its place (a city, a county, the metro) is pulled out, and
   what is left is matched to a service angle of the vertical pack. Two phrases compete when they land on the same angle
   in the same place with the same purpose (a service page or an answer to a question). */

const STOP = new Set(['a', 'an', 'the', 'in', 'on', 'at', 'for', 'of', 'to', 'and', 'or', 'near', 'me', 'my', 'your', 'our', 'is', 'are', 'be', 'with', 'by', 'from', 'it', 'its', 'this', 'that', 'do', 'does', 'i', 'you', 'we', 'us', 'vs', 'as', 'tx', 'texas', 'la', 'louisiana', 'usa', 'page', 'guide', 'blog', 'html', 'php', 'www', 'com']);
const PHRASES = [
  [/\ba\s?\/\s?c\b|\ba\.c\.|\bair[- ]?condition(?:ing|er|ers)\b|\baircon\b/g, 'ac'], [/\bmini[- ]?splits?\b/g, 'minisplit'], [/\btune[- ]?ups?\b/g, 'tuneup'], [/\bheat[- ]?pumps?\b/g, 'heatpump'],
  [/\bheaters?\b/g, 'heat'], [/\b(?:frozen|froze|freez(?:e|es|ing))\b/g, 'freez'], [/\b(?:iced|icing|icy)\b/g, 'ice'], [/\bd\.?w\.?i\.?\b/g, 'dwi'], [/\battorneys?\b/g, 'lawyer'], [/\bdentists?\b|\bdental\b/g, 'dental'], [/\broofers?\b/g, 'roof'], [/\bplumbers?\b/g, 'plumb'], [/\bexterminators?\b/g, 'pest control'],
];
const QUESTION = /^(?:how|why|what|when|where|which|who|can|does|do|is|are|should|will|could)\b|\?$/i;

export const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/&/g, ' and ');
export function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 7 && w.endsWith('ation')) w = w.slice(0, -5);
  else if (w.length > 7 && w.endsWith('ment')) w = w.slice(0, -4);
  else if (w.length > 6 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 5 && w.endsWith('ed')) w = w.slice(0, -2);
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}
/* the stems of a phrase, the filler words left out */
export function tokens(s) {
  let t = norm(s); for (const [re, to] of PHRASES) t = t.replace(re, ' ' + to + ' ');
  return (t.match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w)).map(stem);
}
export const key = s => [...new Set(tokens(s))].sort().join(' ');
/* true when every stem of the keyword appears in the text */
export function covers(text, keyword) { const T = new Set(tokens(text)), K = tokens(keyword); return K.length > 0 && K.every(k => T.has(k)); }
export function overlap(a, b) { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return n / Math.min(A.size, B.size); }
export function jaccard(a, b) { const A = new Set(a), B = new Set(b); if (!A.size && !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n); }
export const isQuestion = s => QUESTION.test(String(s).trim());

/* the places a vertical knows: [{name, kind, tokens}] longest names first, so "north richland hills" wins over "richland" */
export function places(pack, brand) {
  const out = [], seen = new Set();
  const add = (name, kind) => { const t = (norm(name).match(/[a-z0-9]+/g) || []); const k = t.join(' '); if (!t.length || seen.has(kind + k)) return; seen.add(kind + k); out.push({ name, kind, words: t }); };
  for (const c of (pack && pack.cities) || []) add(c.name, 'city');
  for (const c of (brand && brand.serviceCities) || []) add(c, 'city');
  for (const c of (pack && pack.market && pack.market.counties) || []) add(c.name + ' County', 'county');
  if (pack && pack.market && pack.market.name) { add(pack.market.name, 'metro'); if (/dallas fort worth/i.test(pack.market.name)) { add('DFW', 'metro'); add('North Texas', 'metro'); add('Dallas Ft Worth', 'metro'); } }
  return out.sort((a, b) => b.words.length - a.words.length || b.name.length - a.name.length);
}
/* {place, kind, rest}: the place a phrase names, and the phrase without it */
export function locate(phrase, placeList) {
  const w = (norm(phrase).replace(/[-_/]+/g, ' ').match(/[a-z0-9]+/g) || []);
  for (const p of placeList) {
    for (let i = 0; i + p.words.length <= w.length; i++) {
      if (p.words.every((x, j) => w[i + j] === x)) return { place: p.name, kind: p.kind, rest: [...w.slice(0, i), ...w.slice(i + p.words.length)].join(' ') };
    }
  }
  return { place: null, kind: null, rest: w.join(' ') };
}

/* the angles of a pack as matchable sets, built once per pack */
const INDEX = new WeakMap();
function index(pack) {
  let ix = INDEX.get(pack); if (ix) return ix;
  ix = (pack.angles || []).map(a => {
    const lists = a.keywords || {}, terms = [];
    for (const [kind, list] of Object.entries(lists)) { if (kind === 'negatives') continue; for (const k of list) terms.push({ kind, text: k, tok: [...new Set(tokens(k.replace(/\{\w+\}/g, ' ')))] }); }
    terms.push({ kind: 'label', text: a.label, tok: [...new Set(tokens(a.label))] });
    if (a.page && a.page.slug) terms.push({ kind: 'slug', text: a.page.slug, tok: [...new Set(tokens(a.page.slug.replace(/-/g, ' ')))] });
    if (a.path) terms.push({ kind: 'slug', text: a.path, tok: [...new Set(tokens(a.path.replace(/[-/]/g, ' ')))] });
    return { id: a.id, label: a.label, line: a.line, terms: terms.filter(t => t.tok.length) };
  });
  INDEX.set(pack, ix); return ix;
}
/* the angle a topic belongs to: {id, label, score, via} or null. The score is how closely the topic matches the angle's nearest keyword. */
export function angleOf(topic, pack) {
  if (!pack) return null; const T = [...new Set(tokens(topic))]; if (!T.length) return null;
  let best = null;
  for (const a of index(pack)) for (const t of a.terms) {
    const j = jaccard(T, t.tok), held = t.tok.length >= 2 && t.tok.every(x => T.includes(x)), s = Math.max(j, held ? 0.75 : 0);   /* the same stems, or a whole keyword inside the topic */
    if (!best || s > best.score) best = { id: a.id, label: a.label, line: a.line, score: Math.round(s * 100) / 100, via: t.text, kind: t.kind };
  }
  return best && best.score >= 0.6 ? best : null;          /* half a match ("hvac" against "hvac repair") is no match */
}

/* every angle a topic holds: its nearest one, and each one whose whole keyword sits inside it. A slug such as
   "ac heat pump and furnace repair" holds three services at once. */
export function anglesHeld(topic, pack) {
  if (!pack) return []; const T = [...new Set(tokens(topic))], out = new Set(), best = angleOf(topic, pack); if (best) out.add(best.id);
  if (T.length >= 3) for (const a of index(pack)) if (a.terms.some(t => t.kind !== 'questions' && t.tok.length >= 2 && t.tok.every(x => T.includes(x)))) out.add(a.id);
  return [...out];
}

/* a phrase read whole: its stems, its place, its angle, whether it asks a question */
export function read(phrase, pack, placeList) {
  const loc = locate(phrase, placeList || []);
  const a = angleOf(loc.rest, pack);
  return { phrase, key: key(loc.rest), tokens: [...new Set(tokens(loc.rest))], place: loc.place, placeKind: loc.kind, angle: a ? a.id : null, angleLabel: a ? a.label : null, angleScore: a ? a.score : 0, mode: isQuestion(phrase) || (a && a.kind === 'questions' && a.score >= 0.8) ? 'answer' : 'service' };
}
