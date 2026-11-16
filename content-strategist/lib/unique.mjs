/* How alike a set of pages is. City pages go wrong in one way above all: the same page with the city name swapped. So
   every place name is masked first, and what is left is compared three ways: the share of four word runs a pair of pages
   has in common, whole sentences that turn up on more than one page, and section headings that do. A legal notice in a
   verbatim block is left out, since it must repeat, and so is the h1, which a set of city pages shares by design.

   A sentence of four words or more counts. The short ones matter most: "Call us today to book a visit" on forty pages is
   what makes forty pages read as one. */
import { sentences } from './readability.mjs';
import { norm } from './terms.mjs';

const flat = (text, names) => { let t = ' ' + norm(text).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '; for (const n of names) t = t.split(' ' + n + ' ').join(' ~ '); return t.trim(); };
export function runs(text, n = 4) { const w = text.split(' ').filter(Boolean), S = new Set(); for (let i = 0; i + n <= w.length; i++) S.add(w.slice(i, i + n).join(' ')); return S; }

/* compare([{name, text, headings: [text], mask: [place names]}]) -> {ok, limit, pages: [{name, closest, similarity}], pairs, repeated, headings} */
export function compare(docs, { n = 4, limit = 0.15, minWords = 4, spread = 3, headingSpread = 4 } = {}) {
  const names = [...new Set(docs.flatMap(d => d.mask || []).map(x => norm(x).replace(/[^a-z0-9 ]+/g, ' ').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  const D = docs.map(d => ({ name: d.name, set: runs(flat(d.text, names), n), heads: [...new Set((d.headings || []).map(h => flat(h, names)).filter(Boolean))] })).map((d, i) => { const heads = new Set(d.heads); /* a heading is counted with the headings, not again as a sentence */
    return Object.assign(d, { sents: [...new Set(sentences(docs[i].text).map(s => flat(s, names)).filter(s => s.split(' ').length >= minWords && !heads.has(s)))] }); });
  const pairs = [], best = D.map(() => ({ closest: '', similarity: 0 }));
  for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++) {
    const A = D[i].set, B = D[j].set, small = A.size <= B.size ? A : B, big = small === A ? B : A; if (!small.size) continue;
    let k = 0; for (const x of small) if (big.has(x)) k++;
    const sim = Math.round(1000 * k / small.size) / 1000;
    if (sim > best[i].similarity) best[i] = { closest: D[j].name, similarity: sim }; if (sim > best[j].similarity) best[j] = { closest: D[i].name, similarity: sim };
    if (sim > limit) pairs.push({ a: D[i].name, b: D[j].name, similarity: sim });
  }
  const tally = pick => { const seen = new Map(); for (const d of D) for (const s of pick(d)) { if (!seen.has(s)) seen.set(s, []); seen.get(s).push(d.name); } return [...seen].filter(([, p]) => p.length >= 2).map(([sentence, pages]) => ({ sentence, pages })).sort((a, b) => b.pages.length - a.pages.length); };
  const repeated = tally(d => d.sents), headings = tally(d => d.heads);
  pairs.sort((a, b) => b.similarity - a.similarity);
  return { ok: !pairs.length && !repeated.some(r => r.pages.length >= spread) && !headings.some(r => r.pages.length >= headingSpread), limit, count: D.length, pages: D.map((d, i) => Object.assign({ name: d.name }, best[i])), pairs, repeated, headings };
}
