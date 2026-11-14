/* A reader for the object literals the atlases keep their content in (ANGLES, LINES, the Forge copy, the Satchel rules).
   It reads them as text and never runs them: strings, templates, comments and regular expressions are skipped so that a
   bracket inside one is not counted. Works on JavaScript literals and on JSON alike. */

const OPEN = { '{': '}', '[': ']', '(': ')' };

/* the index after the string that opens at i (', " or `) */
export function skipString(t, i) {
  const q = t[i]; let j = i + 1;
  while (j < t.length) {
    const c = t[j];
    if (c === '\\') { j += 2; continue; }
    if (q === '`' && c === '$' && t[j + 1] === '{') { const e = matchClose(t, j + 1); if (e === -1) return t.length; j = e + 1; continue; }
    if (c === q) return j + 1;
    if (q !== '`' && c === '\n') return j;            /* a quote that never closed on its line was not a string */
    j++;
  }
  return j;
}

/* true when a slash at i starts a regular expression, judged by what stands before it */
function regexAt(t, i) {
  let j = i - 1; while (j >= 0 && (t[j] === ' ' || t[j] === '\t' || t[j] === '\n' || t[j] === '\r')) j--;
  if (j < 0) return true;
  if ('(,=:[!&|?{};'.includes(t[j]) || (t[j] === '>' && t[j - 1] === '=')) return true;
  const w = /[A-Za-z_$]+$/.exec(t.slice(Math.max(0, j - 10), j + 1));
  return !!w && ['return', 'typeof', 'case', 'in', 'of', 'void', 'delete', 'do', 'else'].includes(w[0]);
}
/* the index after the regular expression that opens at i */
function skipRegex(t, i) {
  let j = i + 1, cls = false;
  while (j < t.length) {
    const c = t[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '\n') return i + 1;                     /* not a regular expression after all */
    if (c === '[') cls = true; else if (c === ']') cls = false;
    else if (c === '/' && !cls) { j++; while (j < t.length && /[a-z]/.test(t[j])) j++; return j; }
    j++;
  }
  return i + 1;
}

/* steps over one token that can hide a bracket; returns the index of its last character, or -1 when i starts none */
function hop(t, i) {
  const c = t[i];
  if (c === "'" || c === '"' || c === '`') return skipString(t, i) - 1;
  if (c === '/') {
    if (t[i + 1] === '*') { const e = t.indexOf('*/', i + 2); return e === -1 ? t.length : e + 1; }
    if (t[i + 1] === '/') { const e = t.indexOf('\n', i); return e === -1 ? t.length : e; }
    if (regexAt(t, i)) return skipRegex(t, i) - 1;
  }
  return -1;
}

/* the index of the bracket that closes the one at i, or -1 */
export function matchClose(t, i) {
  const want = OPEN[t[i]]; if (!want) return -1;
  let depth = 0;
  for (let j = i; j < t.length; j++) {
    const h = hop(t, j); if (h !== -1) { j = h; continue; }
    const c = t[j];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') { if (--depth === 0) return c === want ? j : -1; }
  }
  return -1;
}

/* the end of the value that starts at i: the next comma outside any bracket, or close */
function endOfValue(t, i, close) {
  for (let j = i; j < close; j++) {
    const h = hop(t, j); if (h !== -1) { j = h; continue; }
    const c = t[j];
    if (c === '{' || c === '[' || c === '(') { const e = matchClose(t, j); if (e === -1 || e > close) return close; j = e; continue; }
    if (c === ',') return j;
  }
  return close;
}

const ESC = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };
const unescape = raw => raw.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (m, e) =>
  (e.length > 1 ? String.fromCharCode(parseInt(e.slice(1), 16)) : (ESC[e] !== undefined ? ESC[e] : e)));

/* the string that opens at i: {value, end}; value is null for a template that interpolates */
export function readString(t, i) {
  const end = skipString(t, i), raw = t.slice(i + 1, end - 1);
  if (t[i] === '`' && raw.includes('${')) return { value: null, end };
  return { value: unescape(raw), end };
}

function skipSpace(t, i, close) {
  for (;;) {
    while (i < close && (t[i] === ' ' || t[i] === '\n' || t[i] === '\t' || t[i] === '\r' || t[i] === ',')) i++;
    if (t[i] === '/' && t[i + 1] === '*') { const e = t.indexOf('*/', i + 2); i = e === -1 ? close : e + 2; continue; }
    if (t[i] === '/' && t[i + 1] === '/') { const e = t.indexOf('\n', i); i = e === -1 ? close : e + 1; continue; }
    return i;
  }
}

/* the key: value pairs of the object that opens at `open`: [{key, start, end}], the value as text between start and end */
export function fields(t, open, close = matchClose(t, open)) {
  const out = []; if (t[open] !== '{' || close === -1) return out;
  let i = open + 1;
  while (i < close) {
    i = skipSpace(t, i, close); if (i >= close) break;
    let key = null;
    if (t[i] === '"' || t[i] === "'") { const s = readString(t, i); key = s.value; i = s.end; }
    else { const m = /^[A-Za-z_$][\w$]*/.exec(t.slice(i, i + 80)); if (m) { key = m[0]; i += key.length; } }
    while (i < close && (t[i] === ' ' || t[i] === '\n' || t[i] === '\t' || t[i] === '\r')) i++;
    if (key == null || t[i] !== ':') { i = endOfValue(t, i, close) + 1; continue; }      /* a spread, a method or a shorthand */
    i++; while (i < close && (t[i] === ' ' || t[i] === '\n' || t[i] === '\t' || t[i] === '\r')) i++;
    const end = endOfValue(t, i, close);
    out.push({ key, start: i, end });
    i = end + 1;
  }
  return out;
}

/* the elements of the array that opens at `open`: [{start, end}] */
export function elements(t, open, close = matchClose(t, open)) {
  const out = []; if (t[open] !== '[' || close === -1) return out;
  let i = open + 1;
  while (i < close) {
    i = skipSpace(t, i, close); if (i >= close) break;
    const end = endOfValue(t, i, close);
    out.push({ start: i, end });
    i = end + 1;
  }
  return out;
}

/* a value as data where it is plain: a string, a number, a boolean, null, an array of plain values; undefined otherwise */
export function plain(t, start, end) {
  const c = t[start];
  if (c === "'" || c === '"' || c === '`') { const s = readString(t, start); return s.value != null && !t.slice(s.end, end).trim() ? s.value : undefined; }
  if (c === '[') {
    const e = matchClose(t, start); if (e === -1 || t.slice(e + 1, end).trim()) return undefined;
    const vals = elements(t, start, e).map(x => plain(t, x.start, x.end));
    return vals.some(v => v === undefined) ? undefined : vals;
  }
  const raw = t.slice(start, end).trim();
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(raw)) return +raw;
  if (raw === 'true') return true; if (raw === 'false') return false; if (raw === 'null') return null;
  return undefined;
}

/* an object as {key: plain value}, the keys whose values are not plain left out; `raw` lists keys to return as source text */
export function record(t, open, raw = []) {
  const o = {}, close = matchClose(t, open);
  for (const f of fields(t, open, close)) {
    if (raw.includes(f.key)) { o[f.key] = t.slice(f.start, f.end).trim(); continue; }
    const v = plain(t, f.start, f.end); if (v !== undefined) o[f.key] = v;
  }
  return o;
}

/* the opening brace of the object that holds position i, or -1. Counts braces backwards without reading strings (the copy
   placeholders such as {city} come in pairs, so they cancel), then confirms the candidate by reading it forwards. */
export function ownerOf(t, i, floor = 0) {
  let depth = 0;
  for (let j = i - 1; j >= floor; j--) {
    const c = t[j];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) { const e = matchClose(t, j); if (e > i) return j; }
      else depth--;
    }
  }
  return -1;
}

/* the literal a declaration opens: `const NAME = [` or `NAME = {` gives the index of that bracket, or -1 */
export function declared(t, name, from = 0) {
  const m = new RegExp('(?:^|[\\s;{}(,.])' + name.replace(/[.$]/g, '\\$&') + '\\s*=\\s*([\\[{])', 'g'); m.lastIndex = from;
  const r = m.exec(t); return r ? r.index + r[0].length - 1 : -1;
}
