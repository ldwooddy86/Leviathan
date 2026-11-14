/* The habits that mark copy as machine written, as rules. Three kinds: marks (dashes, emoji), shapes (bullet lists, a
   reflex FAQ block, bolded lead ins, a "Conclusion" heading) and stock phrases. Each finding names its rule so that a
   request which truly calls for one (numbered steps in a how to, an FAQ the client asked for) can allow it by name. */

/* phrases that do not survive an edit: any use is an error */
const BANNED = [
  'delve', 'delves', 'delving', 'dive into', 'dives into', 'diving into', 'deep dive', "in today's", 'in the world of', 'in the realm of', 'fast[- ]paced', 'ever[- ](?:evolving|changing|growing)',
  'tapestry', 'testament to', "it(?:'s| is) important to (?:note|remember|understand)", "it(?:'s| is) worth (?:noting|mentioning)", 'look no further', 'game[- ]changer', 'game[- ]changing',
  'unleash', 'unlock (?:the|your)', 'elevate your', 'to the next level', 'cutting[- ]edge', 'state[- ]of[- ]the[- ]art', 'top[- ]notch', 'second to none', 'world[- ]class', 'best[- ]in[- ]class',
  'rest assured', 'embark', 'in conclusion', 'in summary', 'to sum up', 'to summarize', 'that being said', 'with that said', 'at the end of the day', 'when it comes to',
  'navigat(?:e|es|ing) the (?:complexities|world|landscape|challenges)', 'everything you need to know', '(?:ultimate|comprehensive|complete|definitive) guide', "let(?:'s| us) (?:dive|explore|take a (?:closer )?look|unpack|break (?:it|this) down)",
  'picture this', 'imagine this', 'say goodbye to', 'say hello to', "here(?:'s| is) the (?:thing|kicker|deal|catch)", 'the truth is', 'the reality is', 'nestled in', 'in the heart of', 'bustling', 'vibrant (?:community|city|town)', 'rich history',
  'plays? an? (?:crucial|vital|key|pivotal|significant|important|essential) role', 'a (?:wide|broad|vast) (?:range|array|variety) of', 'a plethora of', 'a myriad of', 'myriad', 'stands as a', 'serves as a (?:testament|reminder|beacon)',
  'not only\\b.{3,80}\\bbut also', "whether you(?:'re| are)\\b.{3,90}\\bor\\b", 'more than just', "(?:isn't|is not|aren't|are not|it's not|wasn't) (?:just|merely|simply|only) (?:a|an|about|the)\\b", 'beacon', 'unparalleled', 'unmatched',
  'seamless(?:ly)?', 'holistic', 'synergy', 'paradigm', 'revolutioni[sz]e[sd]?', 'transformative', 'supercharge', 'empower(?:s|ed|ing)?', 'harness(?:es|ing)? the power', 'leverag(?:e|es|ed|ing)', 'robust', 'meticulous(?:ly)?',
  'underscor(?:e|es|ed|ing)', 'pivotal', 'foster(?:s|ed|ing)?', 'treasure trove', 'hidden gem', 'double[- ]edged sword', 'for all (?:of )?your\\b.{2,40}\\bneeds', 'your one[- ]stop', 'we(?:’|\')ve got you covered', 'got you covered',
  'in this (?:article|post|blog|guide),? we', 'this (?:article|post|guide) will', 'read on to', 'without further ado', 'buckle up', 'spoiler alert', 'the good news is', 'the bad news is',
];
/* words that are fine once and a tell when they pile up: a warning past the cap per 500 words */
const OVERUSED = [
  ['crucial', 1], ['vital', 1], ['essential', 2], ['utilize', 0], ['utilizes', 0], ['utilizing', 0], ['ensure', 2], ['ensures', 2], ['ensuring', 1], ['optimal', 1], ['enhance', 1], ['enhances', 1], ['enhanced', 1], ['boasts', 0], ['showcase', 0], ['showcases', 0],
  ['moreover', 0], ['furthermore', 0], ['additionally', 0], ['ultimately', 1], ['essentially', 1], ['importantly', 0], ['notably', 0], ['indeed', 1], ['truly', 1], ['simply put', 0], ['streamline', 0], ['streamlined', 0], ['tailored', 1], ['bespoke', 0],
  ['comprehensive', 1], ['journey', 0], ['peace of mind', 1], ['hassle[- ]free', 1], ['we pride ourselves', 0], ['we understand', 1], ['very', 2], ['really', 2], ['extremely', 1], ['incredibly', 0], ['absolutely', 1], ['significantly', 1], ['overall', 1], ['however', 3],
];
const CHAT = /^(?:certainly|sure|absolutely|of course|great question)[!,.]|\bhere(?:'s| is) (?:a|an|the|your) (?:draft|page|article|post|version|rewrite|outline)\b|\bi hope this helps\b|\bas an ai\b|\blet me know if (?:you|there)\b|\bfeel free to (?:ask|reach out to me|adjust)\b/i;
const PLACEHOLDER = /\[[A-Z][A-Za-z ]{1,30}\]|\{\{?\s*\w+\s*\}?\}|lorem ipsum|\bTODO\b|\bTBD\b|\bXXX\b|\bINSERT [A-Z]/;
const HOOK = /\b(?:The (?:result|best part|catch|problem|solution|answer|kicker|bottom line|takeaway|upside|downside)|Sound familiar|Why does (?:this|that) matter|What does (?:this|that) mean(?: for you)?|So,? what(?:'s| is) the (?:answer|solution|fix))\s*\?/;
const DASHES = /[‒–—―−]/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}\u{2022}\u{25CF}\u{25AA}\u{25B6}\u{2713}\u{2714}\u{2705}]/u;
const FAQ_HEAD = /\bfaqs?\b|frequently asked|common questions|questions (?:and|&) answers|\bq ?& ?a\b|people also ask|questions? (?:we|you) (?:hear|get|ask)/i;
const CLOSER = /^(?:conclusion|final thoughts?|wrapping (?:it )?up|in summary|summary|the bottom line|bottom line|key takeaways?|takeaways?|closing thoughts?|final words?|to wrap up|in closing)\b/i;

/* the text around a match, kept to its own line */
const cut = (s, at, len = 0) => { const l0 = s.lastIndexOf('\n', at - 1) + 1, e = s.indexOf('\n', at), l1 = e === -1 ? s.length : e; const a = Math.max(l0, at - 50), b = Math.min(l1, at + len + 50); return (a > l0 ? '...' : '') + s.slice(a, b).trim() + (b < l1 ? '...' : ''); };

/* the marks and stock phrases of one short text (a title, a description, a post): [{rule, severity, message, excerpt}] */
export function phrases(text, where = '') {
  const F = [], t = String(text || ''), w = where ? ` in the ${where}` : '';
  const d = DASHES.exec(t) || /\s--?\s|\w--\w/.exec(t); if (d) F.push({ rule: 'dash', severity: 'error', message: `A dash${w}. Use a comma, a period or the word "to".`, excerpt: cut(t, d.index, 1) });
  const e = EMOJI.exec(t); if (e) F.push({ rule: 'emoji', severity: 'error', message: `An emoji or symbol${w}.`, excerpt: cut(t, e.index, 2) });
  for (const p of BANNED) { const m = new RegExp('\\b' + p, 'i').exec(t); if (m) F.push({ rule: 'stock-phrase', severity: 'error', message: `Stock phrase "${m[0].length > 60 ? m[0].slice(0, 57) + '...' : m[0]}"${w}. Say the plain thing.`, excerpt: cut(t, m.index, m[0].length) }); }
  return F;
}

/* the trope findings of a parsed page: [{rule, severity, message, excerpt}] */
export function tropes(doc) {
  const F = [], add = (rule, severity, message, excerpt) => F.push({ rule, severity, message, excerpt: excerpt || '' });
  const B = doc.blocks.filter(b => b.type !== 'verbatim'), heads = B.filter(b => /^h[1-6]$/.test(b.type));
  const all = B.map(b => b.text).join('\n'), words = Math.max(1, doc.words);

  /* marks */
  for (const b of B) {
    const d = DASHES.exec(b.text); if (d) add('dash', 'error', 'An em dash or en dash. Use a comma, a period or the word "to".', cut(b.text, d.index, 1));
    const h = /\s--?\s|\w--\w/.exec(b.text); if (h) add('dash', 'error', 'A hyphen used as a dash. Use a comma or a period.', cut(b.text, h.index, 3));
    const e = EMOJI.exec(b.text); if (e) add('emoji', 'error', 'An emoji, arrow or symbol bullet in the copy.', cut(b.text, e.index, 2));
  }
  /* shapes */
  const ul = B.filter(b => b.type === 'li' && b.list === 'ul'), ol = B.filter(b => b.type === 'li' && b.list === 'ol');
  const lists = doc.lists || {};
  if (ul.length || lists.ul) add('bullet-list', 'error', `A bulleted list (${ul.length || lists.ul} ${ul.length ? 'items' : 'list'}). Write the points as sentences in a paragraph.`, ul[0] ? ul[0].text.slice(0, 90) : '');
  if (ol.length || lists.ol) add('ordered-list', 'error', `A numbered list (${ol.length || lists.ol} ${ol.length ? 'items' : 'list'}). Write the steps as prose, or allow "ordered-list" when the request is a true how to.`, ol[0] ? ol[0].text.slice(0, 90) : '');
  const faqHead = heads.find(h => FAQ_HEAD.test(h.text));
  let run = 0, best = 0; for (const b of B) { if (/^h[3-6]$/.test(b.type) && /\?\s*$/.test(b.text)) { run++; best = Math.max(best, run); } else if (/^h[1-6]$/.test(b.type)) run = 0; }
  const qa = B.filter(b => /^(?:q|question)\s*[:.)]/i.test(b.text)).length, ld = (doc.jsonld || []).some(j => /"FAQPage"/.test(j));
  if (faqHead || best >= 3 || qa >= 2 || (lists.details || 0) >= 3 || B.filter(b => b.type === 'summary').length >= 3 || ld)
    add('faq', 'error', 'An FAQ block' + (faqHead ? ` ("${faqHead.text}")` : ld ? ' (FAQPage schema)' : ' (a run of question headings)') + '. Answer the questions inside the page where they come up, or allow "faq" when the request asks for one.', faqHead ? faqHead.text : '');
  const closer = heads.find(h => CLOSER.test(h.text)); if (closer) add('closer-heading', 'error', 'A wrap up heading. End on the last useful point or the call to action.', closer.text);
  const intro = heads.find(h => h.level !== 1 && /^(?:introduction|intro|overview)$/i.test(h.text.trim())); if (intro) add('intro-heading', 'warn', 'An "Introduction" heading. The opening paragraph needs no label.', intro.text);
  const colon = heads.filter(h => /^[^:]{3,40}:\s+\S/.test(h.text)); if (colon.length >= 2) add('colon-heading', 'warn', `${colon.length} headings use the "Topic: Subtitle" pattern. Say the point in one plain phrase.`, colon[0].text);
  const leadins = B.filter(b => (b.type === 'p' || b.type === 'li') && b.marks && b.marks.bold.some(m => m.at === 0 && (/[:.]$/.test(m.text) || /^[:.]/.test(b.text.slice(m.text.length).trim()))));
  if (leadins.length >= 2) add('bold-leadin', 'error', `${leadins.length} paragraphs open with a bolded label. That is a bullet list in disguise; write a topic sentence.`, leadins[0].text.slice(0, 90));
  const bang = (all.match(/!/g) || []).length; if (bang > 1) add('exclamation', 'warn', `${bang} exclamation marks. Keep one at most.`, '');
  /* phrases */
  for (const p of BANNED) { const re = new RegExp('\\b' + p, 'i'); const m = re.exec(all); if (m) add('stock-phrase', 'error', `Stock phrase "${m[0].length > 60 ? m[0].slice(0, 57) + '...' : m[0]}". Say the plain thing.`, cut(all, m.index, m[0].length)); }
  for (const [p, cap] of OVERUSED) { const n = (all.match(new RegExp('\\b' + p + '\\b', 'gi')) || []).length, allow = Math.floor(cap * Math.max(1, words / 500)); if (n > allow) add('overused-word', 'warn', `"${p.replace(/\[- \]/, ' ')}" appears ${n} time${n === 1 ? '' : 's'} (keep to ${allow}).`, ''); }
  for (const b of B) {
    const h = HOOK.exec(b.text); if (h) add('question-hook', 'warn', 'A question asked only to answer it. State the point.', cut(b.text, h.index, h[0].length));
    const c = CHAT.exec(b.text); if (c) add('chat-leak', 'error', 'Chat talk left in the copy.', cut(b.text, c.index, c[0].length));
    const p = PLACEHOLDER.exec(b.text); if (p) add('placeholder', 'error', 'A placeholder or note left in the copy.', cut(b.text, p.index, p[0].length));
    if (doc.format === 'html' && /\*\*[^*]+\*\*|^#{1,6}\s|`[^`]+`/.test(b.text)) add('markdown-leak', 'error', 'Markdown marks showing in the HTML.', b.text.slice(0, 90));
  }
  return F;
}
