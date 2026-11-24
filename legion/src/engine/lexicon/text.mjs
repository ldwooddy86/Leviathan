// Legion · lexicon · compact authoring helpers for the content files.
//
// The phrase banks are thousands of short lines. Writing them as one line per entry inside a template string
// keeps them readable and reviewable (no quote-and-comma noise), and these helpers turn that text into the
// arrays and objects the rest of Legion uses.

import { parseTagged, registerLine } from './tags.mjs';

/**
 * One entry per non-empty line, trimmed. Lines starting with "//" are comments. A line may start with tags
 * ("@m6-8 @drives ...", see tags.mjs): they are stripped from the text and recorded, so lineTags(text) and
 * lineFits(text, situation) know when and for whom the line is true.
 * @param {string} block
 * @returns {string[]}
 */
export function lines(block) {
  const out = [];
  for (const raw of block.split('\n')) {
    const s = raw.trim();
    if (!s || s.startsWith('//')) continue;
    const { text, tags } = parseTagged(s);
    registerLine(text, tags);
    out.push(text);
  }
  return out;
}

// Spanish template -> its English gloss template (esLines registers them)
const GLOSS = new Map();

/**
 * Spanish (es) variants of regional lines: one "tags Spanish || English gloss" per line (decision 12). The tags
 * apply to both texts, which are registered like lines() registers English ones; the Spanish templates are returned
 * and glossOf(template) gives the English one, with the same {slots}.
 * @param {string} block
 * @returns {string[]}
 */
export function esLines(block) {
  const out = [];
  for (const raw of block.split('\n')) {
    const s = raw.trim();
    if (!s || s.startsWith('//')) continue;
    const { text, tags } = parseTagged(s);
    const parts = text.split(' || ');
    const es = (parts[0] || '').trim(), en = (parts[1] || '').trim();
    if (parts.length !== 2 || !es || !en) throw new Error(`lexicon: a Spanish line is "Spanish || English": ${s}`);
    const slots = t => (t.match(/\{\w+\}/g) || []).sort().join();
    if (slots(es) !== slots(en)) throw new Error(`lexicon: the Spanish line and its gloss need the same slots: ${s}`);
    registerLine(es, tags);
    registerLine(en, tags);
    GLOSS.set(es, en);
    out.push(es);
  }
  return out;
}

/**
 * The English gloss template of a Spanish line (esLines), or null.
 * @param {string} template
 * @returns {string|null}
 */
export function glossOf(template) {
  return GLOSS.get(template) || null;
}

/**
 * Regional vocabulary: one "term | kind | note" per line.
 * @param {string} block
 * @returns {Record<string, {kind: string, note: string}>}
 */
export function words(block) {
  const out = {};
  for (const ln of untagged(block)) {
    const [term, kind, note] = ln.split(' | ').map(s => s.trim());
    if (!term || !kind || !note) throw new Error(`bad word line: ${ln}`);
    out[term] = { kind, note };
  }
  return out;
}

/**
 * Age-graded slang: one "term | level | lo-hi | gloss | example" per line. Level 1 is mild (most people in the
 * age band use it), 2 clearly slangy, 3 heavy and strongly age-marked.
 * @param {string} block
 * @returns {{term: string, level: number, ages: [number, number], gloss: string, example: string}[]}
 */
export function slang(block) {
  return untagged(block).map(ln => {
    const [term, level, ages, gloss, example] = ln.split(' | ').map(s => s.trim());
    const m = /^(\d+)-(\d+)$/.exec(ages || '');
    if (!term || !(+level >= 1 && +level <= 3) || !m || !gloss || !example) throw new Error(`bad slang line: ${ln}`);
    return { term, level: +level, ages: [+m[1], +m[2]], gloss, example };
  });
}

// Vocabulary and slang tables are not spoken lines and take no tags.
function untagged(block) {
  return block.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('//'));
}
