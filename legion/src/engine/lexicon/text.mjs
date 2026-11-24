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
