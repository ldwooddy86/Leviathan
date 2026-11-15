/* Whether a page talks to the person who owns the house. The first sets of pages this toolkit wrote read like a report:
   they opened on the company, cited their sources like a paper ("a lifetime fit to the EIA survey"), and printed figures
   to the decimal ("20.8% of systems"). The revision that came back from review said the same things the way a
   technician would say them at the door: "about one in five", "Census figures put the typical home at 2009", "if yours
   stops heating, check two things before you call". These rules hold a page to that:

     method-talk     the machinery behind a number named in the copy; name the source in plain words instead
     figure-style    a figure nobody would say aloud: a decimal percentage, a decimal age, a count to three digits
     address         a page that never says "you"
     opens-on-us     an opening that starts with the company and not with the reader's house

   Technical knowledge is wanted, and so are trade terms, each with a few plain words on what it is. */
import { sentences, words } from './readability.mjs';

const METHOD = /\b(?:model(?:'s|’s)? estimates?|modell?ed (?:estimate|figure|count|share)|the model(?! (?:number|and serial|plate|year|name|you|that fits|home))|a model (?:based|built|fitted)|our (?:housing |demand |market )?model|demand model|lifetime (?:fit|curve)|fitted (?:to|lifetime)|RECS|EIA\b|ACS\b|American Community Survey|Residential Energy Consumption Survey|Weibull|percentile|demand trigger|the atlas|thermal debt|data ?set|five year estimates?|housing data and)\b/;
const PLAIN = 'Name the source in plain words: "Census figures", "federal energy surveys", "storm reports", "by one estimate".';
const cut = (s, at, len) => { const a = Math.max(0, at - 45), b = Math.min(s.length, at + len + 45); return (a ? '...' : '') + s.slice(a, b).trim() + (b < s.length ? '...' : ''); };
/* how a person would say a share */
export function sayShare(pct) {
  const p = +pct; if (!Number.isFinite(p)) return '';
  const T = [[2, 'almost none'], [7, 'about one in twenty'], [11.5, 'about one in ten'], [14.5, 'about one in eight'], [18, 'about one in six'], [22.5, 'about one in five'], [28.5, 'about one in four'], [37, 'about one in three'], [44, 'about four in ten'], [47.5, 'a little under half'], [52.5, 'about half'], [57, 'just over half'], [63, 'about six in ten'], [70, 'about two in three'], [78, 'about three in four'], [84, 'about four in five'], [93, 'about nine in ten'], [101, 'nearly all']];
  return T.find(([max]) => p < max)[1];
}
/* how a person would say a count or a number of years */
export function sayNumber(n, unit = '') {
  const x = +String(n).replace(/[,$]/g, ''); if (!Number.isFinite(x)) return String(n);
  if (/year/.test(unit)) { const w = Math.floor(x), f = x - w; return f < 0.25 ? `about ${w} years` : f < 0.75 ? `about ${w} and a half years` : `about ${w + 1} years`; }
  if (x < 1000) return 'about ' + String(Math.round(x / (x >= 100 ? 10 : 1)) * (x >= 100 ? 10 : 1));
  const mag = Math.pow(10, Math.floor(Math.log10(x)) - 1), r = Math.round(x / mag) * mag;
  return 'about ' + (r >= 1e6 ? (Math.round(r / 1e5) / 10) + ' million' : r.toLocaleString('en-US'));
}

/* the voice findings of a parsed page: [{rule, severity, message, excerpt}] */
export function voice(doc, { social = false, brand = null } = {}) {
  const F = [], add = (rule, severity, message, excerpt = '') => F.push({ rule, severity, message, excerpt });
  const B = doc.blocks.filter(b => b.type !== 'verbatim' && (b.type === 'p' || b.type === 'li' || b.type === 'quote' || /^h[1-6]$/.test(b.type))), text = B.map(b => b.text).join('\n');
  for (const b of B) { const m = METHOD.exec(b.text); if (m) { add('method-talk', 'error', `"${m[0]}" is the machinery behind the number, not something to tell a homeowner. ${PLAIN}`, cut(b.text, m.index, m[0].length)); break; } }
  const dec = /\b\d+\.\d+\s?%/.exec(text); if (dec) add('figure-style', 'error', `"${dec[0]}" is a figure nobody says aloud. Say it the way a person would: "${sayShare(parseFloat(dec[0]))}".`, cut(text, dec.index, dec[0].length));
  const age = /\b(\d+\.\d+)\s+years?\b/.exec(text); if (age) add('figure-style', 'warn', `"${age[0]}" reads like a table. Say "${sayNumber(age[1], 'years')}".`, cut(text, age.index, age[0].length));
  const pcts = (text.match(/\b\d+\s?%/g) || []).length; if (pcts > 2) add('figure-style', 'warn', `${pcts} percentages on the page. Keep one or two and say the rest as "one in five" or "about half".`);
  const fine = (text.match(/\b\d{1,3}(?:,\d{3})+\b/g) || []).filter(x => { const d = x.replace(/,/g, '').replace(/0+$/, ''); return d.length >= 4 || (d.length === 3 && d[2] !== '5'); });   /* 115,000 is sayable; 23,300 is not */ if (fine.length) add('figure-style', 'warn', `${fine.slice(0, 3).join(', ')}: round a count the way a person would say it ("${sayNumber(fine[0])}").`);
  if (!social) {
    const w = Math.max(1, doc.words), you = (doc.prose.match(/\byou(?:r|rs|rself)?\b|\byou(?:'|’)(?:re|ll|ve|d)\b/gi) || []).length, rate = Math.round(1000 * you / w) / 10;
    if (doc.words >= 200 && rate < 0.8) add('address', 'warn', `The page says "you" ${you} time${you === 1 ? '' : 's'} in ${doc.words} words. Talk to the person who owns the house: what they will notice, what to check, when to call.`);
    const first = doc.lede.length ? sentences(doc.lede[0])[0] || '' : '', names = [brand && brand.name, brand && brand.short, 'We', 'Our'].filter(Boolean);
    if (first && names.some(n => first.startsWith(n + ' ') || first.startsWith(n + ','))) add('opens-on-us', 'warn', 'The page opens on the company. Open on the homeowner\'s situation in this place, then say who you are.', first.slice(0, 120));
    void words;
  }
  return F;
}
