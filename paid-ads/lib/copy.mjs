/* The ad gate: what is measured about a piece of ad copy before it leaves.

   Four kinds of check, each a rule with a name:
     form        the platform's limits and counts, from the channel book; the dashboard's own limits where it has them
     the screen  the dashboard's advertising rules (dashboard-link/lib/satchel.mjs), applied the way its Campaign Desk
                 applies them, house style included: no hyphen or dash of any kind in copy
     the craft   a call to action in every ad, the keyword in the ad that answers it, a mix of message types, and a
                 persuasion count of six things an ad can do. These are measured so that "persuasive" is not a mood.
     the truth   every claim an ad makes about the business (a price, a rating, a guarantee, hours, years, a credential)
                 is looked up in the brand file. The gate cannot know whether a claim is true. It can say whether anyone
                 on file has vouched for it.

   Nothing here judges taste. An ad that passes can still be dull; an ad that fails cannot ship. */
import { lint as screen, lintSet } from '../../dashboard-link/lib/satchel.mjs';
import { phrases } from '../../content-strategist/lib/tropes.mjs';
import { passives } from '../../content-strategist/lib/passive.mjs';
import { byId, format as bookFormat, REQUIRED, WORDS_PER_SECOND } from '../channels/book.mjs';
import { talksCredit } from './desk.mjs';

export const text = x => (typeof x === 'string' ? x : x && typeof x.text === 'string' ? x.text : '');
export const pinOf = x => (x && typeof x === 'object' && Number.isInteger(x.pin) ? x.pin : 0);
/* characters as a platform counts them; a keyword insertion counts as its default text */
export const chars = s => [...String(s).replace(/\{keyword:([^}]*)\}/gi, '$1')].length;
const low = s => String(s).toLowerCase();
const wordsOf = s => (String(s).match(/[A-Za-zÀ-ÿ0-9']+/g) || []);
const SEV = { block: 'error', warn: 'warn', note: 'note' };
const SMALL = new Set(['near', 'the', 'for', 'and', 'how', 'why', 'what', 'does', 'much', 'can', 'is', 'my', 'are', 'you', 'your', 'with', 'from', 'not', 'que', 'por', 'para', 'los', 'las', 'del', 'una', 'cerca']);

/* ---------- calls to action ---------- */
const VERB = '(?:call|book|schedule|get|request|claim|reserve|start|text|ask|compare|check|see|find|apply|join|send|message|talk|speak|tap|dial|chat|order|try'
  + '|ll[aá]m[ae](?:nos|me)?|apart[ae]|reserv[ae]|pid[ae]|solicit[ae]|agend[ae]|program[ae]|obtenga|obt[eé]n|apliqu[ae]|aplica|env[ií][ae](?:nos)?|escr[ií]ba(?:nos)?|cotice|cotiza|compare|vea|hable)';
/* verbs that ask for something without saying what happens next */
const SOFT = '(?:learn|click|contact|visit|submit|inquire|read|discover|explore|cont[aá]cte(?:nos)?|vis[ií]te(?:nos)?|haga|conozca)';
/* An imperative opens its clause. A line is cut at its punctuation and at "and", "or", "then", so "Heat out? Call us now" and
   "Call or text today" are both read; a verb in the middle of a statement ("our techs check every burner") is not. */
const clauses = s => String(s).split(/[.!?;:,¿¡]+|\s+(?:and|then|or|y|o)\s+/i).map(c => c.replace(/^\s*(?:please|just|now|today|then|so|por favor)\s+/i, '').trim()).filter(Boolean);
const AFTER = '(?![a-z0-9áéíóúñü])';
const STARTS = new RegExp('^' + VERB + AFTER, 'i'), SOFT_STARTS = new RegExp('^' + SOFT + AFTER, 'i');
const ENDS = new RegExp('\\b' + VERB + '\\s+(?:us\\s+)?(?:now|today|online|ahora|hoy)\\s*$', 'i');
const WEAK = /\b(learn more|click here|find out more|read more|contact us|visit (us|our (web)?site)|submit|inquire|more info(rmation)?|más información|haga clic|contáctenos)\b/i;
const PHONE_WORD = /\b(call|phone|dial|ll[aá]m[ae](?:nos|me)?)(?![a-záéíóúñü])/i;
/* true when a line asks the reader to do something */
export const isCta = s => clauses(s).some(c => STARTS.test(c) || SOFT_STARTS.test(c) || ENDS.test(c));
/* 0 none; 1 generic ("learn more", "contact us"); 2 a direct action ("Call Example Air"); 3 an action with what happens next
   or when ("Book a furnace check online", "Call for heat back on today") */
export function ctaStrength(s) {
  const cs = clauses(s), hard = cs.filter(c => STARTS.test(c) || ENDS.test(c)), NEXT = /\b(today|tonight|now|online|quote|estimate|visit|tune up|check|inspection|appointment|time|minutes|price|hoy|ahora|cotizaci[oó]n|cita|precio|presupuesto|revisi[oó]n|visita)(?![a-záéíóúñü])/i;
  if (!hard.length) return cs.some(c => SOFT_STARTS.test(c)) ? 1 : 0;
  const real = hard.filter(c => !WEAK.test(c) || NEXT.test(c.replace(WEAK, ''))); if (!real.length) return 1;
  return real.some(c => NEXT.test(c)) ? 3 : 2;
}

/* ---------- message types of a headline ---------- */
const TYPES = {
  cta: s => isCta(s),
  proof: s => /\b(lic(ense[d]?)?\b|tacl[ab]|since \d{4}|\d+\+? years|family owned|locally owned|own crew|reviews?|rated|stars?|certified|dealer|insured|background|licencia|desde \d{4})\b/i.test(s),
  offer: s => /\$\s?\d|\b\d{1,3}\s?% off\b|\bfree\b|\bfinancing\b|\bcoupon\b|\bspecial\b|\bgratis\b|\bfinanciamiento\b/i.test(s),
  risk: s => /\b(upfront|up front|before (any )?work|priced? before|written (quote|price|estimate)|in writing|no obligation|straight (answer|advice)|honest|second opinion|por escrito|precio claro)\b/i.test(s),
  speed: s => /\b(today|same day|tonight|fast|now|first visit|hours|minutes|hoy|mismo día)\b/i.test(s),
  question: s => /\?\s*$/.test(s),
};
/* the kinds of message a set of headlines carries; `service` and `local` need the ad group's terms and the market's places */
export function messageTypes(headlines, { terms = [], places = [], brand = '' } = {}) {
  const got = new Set(), has = (s, list) => list.some(w => w && new RegExp('\\b' + String(w).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(low(s)));
  for (const h of headlines) { for (const [k, f] of Object.entries(TYPES)) if (f(h)) got.add(k); if (has(h, terms)) got.add('service'); if (has(h, places)) got.add('local'); if (brand && low(h).includes(low(brand))) got.add('brand'); }
  return [...got];
}

/* ---------- the six things a persuasive ad does ---------- */
const BENEFIT = /\b(heat (back )?on|cool(ing)? (back|fixed|restored)|fixed|first visit|lower (bills?|costs?)|quiet(er)?|even (cooling|heating|temperatures?)|every room|safe(ty|r)?|carbon monoxide|breathe|cleaner air|less dust|comfort(able)?|no surprises|sized (right|to|for)|ready (for|before)|before the (next|first) (freeze|cold|heat|summer|winter)|stop paying|save\b|warm(er)?|sleep|peace|protect|last longer|priority|calor|cómod|segur|ahorr)/i;
const PROOF = /\b(lic\b|license[d]?|tacl[ab]\w*|since \d{4}|\d+\+? years|family owned|own crew|\d(\.\d)? stars?|[\d,]{2,} (google )?reviews|certified|authorized dealer|dealer|insured|background checked|local (techs?|team|crew|trucks?)|licencia|desde \d{4})\b/i;
const RISK = /\b(upfront|up front|before (any )?work (starts|begins)|before we start|priced? before|price before|written (\w+ )?(quote|price|estimate|report|findings)|in writing|no obligation|no pressure|no surprises|you approve|straight (answer|advice)|honest|second opinion|tells? you (straight|honestly)|guarantee|por escrito|precio claro|antes de empezar|sin compromiso)\b/i;
const SPECIFIC = /\d|\b(capacitor|igniter|flame sensor|heat exchanger|coil|compressor|condenser|heat strips?|defrost|thermostat|blower|burner|duct(s|work)?|filter|r22|r410a|refrigerant|breaker|rooftop|mini split)\b/i;
export const PERSUADES = ['names the service or the problem', 'a benefit the customer gets', 'proof they can check', 'something that lowers the risk of calling', 'a call to action that says what happens next', 'a concrete detail'];
/* what counts for each, so a writer told one is missing knows what to put there */
export const PERSUADES_HOW = ['the ad group\'s own words, as the searcher types them', 'what changes for them: heat back on, lower bills, even rooms, a safe furnace, a quiet system', 'the license, years in business, your own crew, a rating with its date', 'a price before work starts, a written quote, a second opinion, no pressure', 'lead with the verb and say what they get or when: "Book a Furnace Check Online"', 'a part, a number or a place: an igniter, a 20 year old furnace, the city'];
/* {score 0 to 6, has: [...], missing: [...], how: [...]} for the texts of one ad. The license number every ad must carry
   counts as proof, which it is; its digits do not count as a concrete detail. The count reads for patterns, so it can miss
   an unusual wording: `how` says what kind of thing fills each gap. */
export function persuasion(texts, { terms = [], places = [], lic = '' } = {}) {
  const all = texts.join(' \n '), has = list => list.some(w => w && low(all).includes(low(w))), bare = lic ? all.split(lic).join('') : all;
  const got = [terms.length ? has(terms) : true, BENEFIT.test(all), PROOF.test(all), RISK.test(all), texts.some(t => ctaStrength(t) >= 2), SPECIFIC.test(bare) || has(places)];
  return { score: got.filter(Boolean).length, has: PERSUADES.filter((_, i) => got[i]), missing: PERSUADES.filter((_, i) => !got[i]), how: PERSUADES.map((p, i) => (got[i] ? null : `${p} (${PERSUADES_HOW[i]})`)).filter(Boolean) };
}

/* ---------- claims about the business ---------- */
const CLAIMS = [
  ['price', /\$\s?\d[\d,]*(?:\.\d\d)?|\b\d{1,3}\s?% (?:off|de descuento)\b/i],
  ['free', /\bfree\b[^.!?]{0,30}|\bgratis\b[^.!?]{0,30}/i],
  ['guarantee', /\b(?:\d{1,3}% )?(?:[\w']+ ){0,2}(?:guarantee[ds]?|warrant(?:y|ies)|garant[ií]a)\b[^.!?,]{0,30}/i],
  ['hours', /\b(?:24\/7|24 hours?|24 horas|around the clock|open 7 days|7 days a week|los 7 d[ií]as|same day|next day|mismo d[ií]a|nights and weekends|weekends|after hours|open (?:on )?(?:sundays?|saturdays?|late|nights)|(?:until|till) \d{1,2}(?::\d\d)?\s?(?:am|pm)|\d{1,2}\s?(?:am|pm) to \d{1,2}\s?(?:am|pm))(?![a-záéíóúñü])/i],
  ['response', /\b(?:in|within) \d+ (?:minutes|hours)\b|\bon time\b|\b(?:60|90) minute\b|\b(?:back on|fixed|repaired|restored|up and running)\b[^.?!]{0,15}\b(?:today|tonight|tomorrow)\b|\bcalor (?:hoy|esta noche)\b/i],
  ['scarcity', /\bonly \d+\b[^.?!]{0,25}\b(?:left|remaining|spots?|slots?|openings?)\b|\b(?:last chance|limited time|while (?:supplies|they) last|offer ends|ends (?:today|tonight|soon|this week|friday|saturday|sunday)|expires? (?:today|tonight|soon))\b|\bs[oó]lo quedan\b/i],
  ['reviews', /\b[1-5](?:\.\d)? ?(?:stars?|estrellas?)\b|\b[1-5]\.\d (?:out of 5|on google|en google)\b|\brated [1-5](?:\.\d)?\b|\b[\d,]{2,}\+? (?:google |five star |5 star )?(?:reviews|rese[nñ]as|opiniones)\b|\b(?:five|5) star rated\b/i],
  ['superlative', /\b(?:best|#\s?1|number one|top rated|highest rated|most trusted|leading|lowest price|cheapest|fastest|unbeatable|better than|beats? (?:any|every|the)|el mejor|la mejor|los mejores|n[uú]mero uno)\b/i],
  ['years', /\bsince \d{4}\b|\bdesde \d{4}\b|\b\d+\+? years (?:of (?:experience|service)|in (?:business|the business|the trade|\w+)|serving|strong|experience)\b|\b(?:over|for|with|more than) \d+\+? years\b(?! old)|\b\d+ a[nñ]os (?:de experiencia|sirviendo)\b|\bfamily owned\b|\blocally owned\b|\bveteran owned\b/i],
  ['credential', /\b(nate certified|epa certified|factory authori[sz]ed|authorized dealer|elite dealer|diamond contractor|bbb|a\+ rated|bonded|background checked|licensed (and|&) insured)\b/i],
  ['financing', /\b(?:financing|financiamiento|payment plans?|pay over time|monthly payments?|payments? as low)\b/i],
  /* the terms that set off Regulation Z's disclosures: a rate, a number of payments or a period, a payment amount, a down payment */
  ['credit', /\b\d+(?:\.\d+)?\s?% (?:apr|interest|financing|inter[eé]s)\b|\b\d+(?:\.\d+)?\s?%[^.?!]{0,12}\bfor \d+ (?:months|years)\b|\bfor \d+ months\b|\bpor \d+ meses\b|\b\d+ (?:monthly |easy |equal )?payments\b|\$\s?\d[\d,]*\s?(?:a|per|\/)\s?(?:month|mo)\b|\b(?:no|zero|\$0) (?:money )?down\b|\bno interest\b|\bdeferred interest\b|\bsame as cash\b|\bapr\b/i],
];
export const CLAIM_TYPES = CLAIMS.map(c => c[0]);
const num = s => +String(s).replace(/[^0-9.]/g, '');
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* true when `b` stands in `a` as whole words: "$50" is not in "$500 off" */
const within = (a, b) => !!b && new RegExp('(^|[^a-z0-9áéíóúñü])' + esc(low(b)) + '($|[^a-z0-9áéíóúñü])').test(low(a));
/* an amount is a discount when the words around it say so ("$50 off", "save $50", "10% off"), else a price */
const amounts = t => [...String(t).matchAll(/\$\s?\d[\d,]*(?:\.\d\d)?|\d{1,3}\s?%/g)].map(m => ({ amount: m[0].replace(/[\s,]/g, ''), discount: /%/.test(m[0]) || /^\s*(?:off|de descuento|discount)\b/i.test(t.slice(m.index + m[0].length)) || /\b(?:save|ahorre|ahorra)\s*$/i.test(t.slice(Math.max(0, m.index - 8), m.index)), at: m.index }));
const SMALL_WORDS = new Set(['a', 'an', 'the', 'our', 'we', 'on', 'of', 'and', 'with', 'your', 'is', 'are', 'every', 'all', 'for', 'to', 'in', 'by', 'guarantee', 'guaranteed', 'guarantees', 'warranty', 'warranties', 'garantia', 'garantía']);
/* does the shop answer on a Sunday, by the hours on file? */
const sundayOpen = hours => /sunday|domingo|daily|every day|7 days|todos los d[ií]as/i.test(hours) && !/(?:sunday|domingo)[^,;.]{0,25}(?:by appointment|closed|cerrado|con cita)|(?:closed|cerrado)[^,;.]{0,12}(?:sunday|domingo)/i.test(hours);
/* Every claim in the texts with what the brand file says about it:
   on-file     the brand file holds the same fact (still re-check it before launch if it is dated)
   confirmed   the campaign file records that the person confirmed it, in the claim's own words
   contradicts the brand file says otherwise: an error
   unconfirmed nobody has vouched for it: confirm with the person or cut it
   A confirmation quotes the claim ("same day"), never a kind of claim ("hours"): one answer cannot vouch for every claim
   of its kind. A superlative is confirmed only with a basis the reader can check, a credit term only with the lender's
   disclosure wording. Nothing a person says overrules what the brand file contradicts: correct the file first. */
export function claims(texts, { brand = null, confirmed = [], year = new Date().getFullYear() } = {}) {
  const out = [], P = (brand && brand.proof) || {}, O = (brand && brand.offer) || {}, seen = new Set(), hours = String((brand && brand.hours) || '');
  const quotes = x => x && typeof x.claim === 'string' && x.claim.trim().length > 2 && !CLAIM_TYPES.includes(low(x.claim.trim()));
  for (const t of texts) for (const [type, re] of CLAIMS) for (const m of t.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
    const said = m[0].trim(), key = type + '|' + low(said); if (!said || seen.has(key)) continue; seen.add(key);
    const c = { type, said, in: t, status: 'unconfirmed', detail: '' };
    const ok = (confirmed || []).find(x => quotes(x) && (within(said, x.claim.trim()) || within(x.claim, said)));
    if (type === 'price') {
      const promo = String(O.promotion || ''), mine = amounts(t).find(a => a.at === m.index) || { amount: said.replace(/[\s,]/g, ''), discount: /%/.test(said) }, held = amounts(promo).find(a => a.amount === mine.amount && a.discount === mine.discount);
      if (held) { c.status = 'on-file'; c.detail = `the promotion the dashboard was built with: "${promo}". It carries no date: check that it still runs`; }
      else c.detail = promo ? `the brand file's promotion reads "${promo}", which is not this ${mine.discount ? 'discount' : 'price'}` : 'the brand file holds no promotion or price';
    } else if (type === 'reviews') {
      const R = P.reviews;
      if (!R || R.rating == null) c.detail = 'the brand file holds no rating';
      else { const rating = (said.match(/[1-5](?:\.\d)?(?= ?(?:stars?|estrellas?))|(?<=rated )[1-5](?:\.\d)?|[1-5]\.\d(?= (?:out of 5|on google|en google))/i) || [])[0], count = (said.match(/[\d,]{2,}(?=\+? (?:google |five star |5 star )?(?:reviews|rese[nñ]as|opiniones))/i) || [])[0], five = /(?:five|5) star rated/i.test(said) && +R.rating < 4.95;
        const bad = (rating && +rating !== +R.rating) || (count && num(count) > +R.count) || five; c.status = bad ? 'contradicts' : 'on-file';
        c.detail = `the brand file has ${R.rating} stars from ${R.count} ${R.source || ''} reviews as of ${R.asOf || 'an unstated date'}`.replace(/\s+/g, ' ') + (bad ? '' : '; match the live profile and date the claim'); }
    } else if (type === 'years') {
      const since = (said.match(/(?:since|desde) (\d{4})/i) || [])[1], yrs = (said.match(/(\d+)\+? (?:years|a[nñ]os)/i) || [])[1];
      if (!P.founded) c.detail = 'the brand file holds no founding year';
      else if (since || yrs) { const bad = (since && +since !== +P.founded) || (yrs && +yrs > year - +P.founded); c.status = bad ? 'contradicts' : 'on-file'; c.detail = `the brand file says founded ${P.founded}`; }
      else if (/family owned/i.test(said) && /family owned/i.test(P.since || '')) { c.status = 'on-file'; c.detail = `the brand file says "${P.since}"`; }
      else c.detail = `the brand file says "${P.since || 'founded ' + P.founded}"`;
    } else if (type === 'guarantee') {
      const held = String(P.guarantee || ''), words = (low(said).match(/[a-z0-9áéíóúñü]+/g) || []).filter(w => !SMALL_WORDS.has(w));
      if (!held) c.detail = 'the brand file holds no guarantee';
      else if (words.every(w => within(held, w))) { c.status = 'on-file'; c.detail = `the brand file says "${held}"; an ad that names it also says what it covers or where the terms are`; }
      else c.detail = `the brand file's guarantee reads "${held}", which is not this one`;
    } else if (type === 'credential') {
      const d = (P.dealer || []).find(x => low(x).split(/\s+/).some(w => w.length > 3 && low(t).includes(w)));
      if (d) { c.status = 'on-file'; c.detail = `the brand file lists "${d}"`; } else c.detail = 'not in the brand file: keep the certificate or the dealer letter on file';
    } else if (type === 'financing') {
      if (O.financing) { c.status = 'on-file'; c.detail = `the brand file names financing through ${O.financing}; any payment, rate or term in the ad needs its disclosures`; } else c.detail = 'the brand file names no financing';
    } else if (type === 'credit') c.detail = 'Regulation Z: an ad that states a rate, a payment, a number of payments or a down payment must carry the APR by that name, the repayment terms and any down payment. Use the lender\'s own wording, or leave the term out';
    else if (type === 'hours') {
      if (!hours) c.detail = 'the brand file holds no hours';
      else {
        const allDay = /24|around the clock/i.test(said), week = /7 d|open 7/i.test(said), sunday = /sunday/i.test(said);
        if ((allDay && !/24/.test(hours)) || ((week || sunday) && !sundayOpen(hours))) { c.status = 'contradicts'; c.detail = `the brand file's hours are "${hours}"`; }
        else c.detail = `the brand file's hours: "${hours}". Only claim what is staffed; "same day" needs a cutoff time`;
      }
    } else if (type === 'free') c.detail = 'state every condition next to the offer';
    else if (type === 'superlative') c.detail = 'it needs a basis the reader can check (an award, a ranking, a named survey with its date), cited in the ad, or it goes';
    else if (type === 'response') c.detail = 'a promise of when is only as good as the owner\'s word: get it, with the cutoff or the conditions';
    else if (type === 'scarcity') c.detail = 'urgency must be real: a true limit or a true deadline, from the owner';
    if (ok && c.status !== 'contradicts') {
      const who = `${ok.by || 'the person'}${ok.on ? ' on ' + ok.on : ''}`;
      if (type === 'superlative' && !ok.basis) c.detail = `${who} asked for it, and that is not a basis. Record what makes it true under "basis" (an award, a ranking, a named survey with its date) and cite it in the ad, or cut it`;
      else if (type === 'credit' && !ok.terms) c.detail = `${who} confirmed it without the terms. Record the lender's disclosure wording under "terms" and carry it in the ad`;
      else { c.status = 'confirmed'; c.detail = `confirmed by ${who}${ok.basis ? ', on this basis: ' + ok.basis : ''}${ok.terms ? ': ' + ok.terms : ''}`; }
    }
    out.push(c);
  }
  return out;
}

/* ---------- names and numbers that must not be in an ad ---------- */
/* a license number in the copy that is not the one on file: [found, ...] */
export function wrongLicense(texts, lic) {
  const norm = s => String(s).replace(/\s+/g, '').toUpperCase(), mine = norm(lic || ''), out = [];
  if (!mine) return out;
  for (const t of texts) for (const m of String(t).matchAll(/\bTACL[AB]\s?\d{3,9}\s?[A-Z]?\b/gi)) if (norm(m[0]) !== mine && !out.includes(m[0])) out.push(m[0]);
  return out;
}
/* words a company name shares with every other in the trade: a name made only of these names nobody */
const TRADE = new Set(['ac', 'a', 'c', 'air', 'conditioning', 'heating', 'heat', 'cooling', 'cool', 'hvac', 'repair', 'repairs', 'service', 'services', 'plumbing', 'electric', 'electrical', 'mechanical', 'refrigeration', 'the', 'and', 'of', 'in', 'for', 'dallas', 'fort', 'worth', 'texas', 'tx', 'dfw', 'north', 'south', 'east', 'west', 'metro', 'metroplex', 'home', 'homes', 'comfort', 'pros', 'pro', 'experts', 'expert', 'company', 'co', 'inc', 'llc', 'corp', 'solutions', 'systems', 'team', 'best', 'quality', 'affordable', 'all', 'star', 'one', 'plus', 'total', 'premier', 'american', 'family', 'local', 'residential', 'commercial', 'contractors', 'contractor', 'specialists']);
const nameWords = s => low(s).replace(/&/g, ' and ').match(/[a-z0-9']+/g) || [];
/* ordinary words a trading name can be made of ("Fix It", "Right Now", "Cool Today"): on their own they name nobody */
const COMMON = new Set(['right', 'today', 'tonight', 'quick', 'great', 'clean', 'first', 'choice', 'green', 'smart', 'always', 'ready', 'every', 'better', 'cooler', 'warmer', 'comfy', 'happy', 'honest', 'reliable', 'trusted', 'modern', 'precision', 'priority', 'express', 'super', 'ultra', 'supreme', 'elite', 'prime', 'above', 'around', 'clock', 'hours', 'brothers', 'sons', 'services', 'heating', 'cooling', 'weather', 'climate', 'degrees', 'breeze', 'arctic', 'polar', 'frost', 'chill', 'works', 'doctor', 'masters', 'kings', 'guys', 'lady', 'texas', 'lone', 'metro']);
/* A competitor is named by its whole name, or by the part of it that is its own: the leading words up to the first trade
   word, when there are two or more ("Baker Brothers" of "Baker Brothers Plumbing, Air & Electric"). One word alone is not
   taken as a name, since "milestone" and "reliant" are also words. Returns the competitor a text names, or ''. */
export function namesCompetitor(texts, competitors = [], places = []) {
  const local = new Set(places.flatMap(p => nameWords(p))), all = texts.map(t => ' ' + nameWords(t).join(' ') + ' ');
  for (const c of competitors) {
    const w = nameWords(c), lead = []; for (const x of w) { if (TRADE.has(x) || local.has(x)) { if (lead.length) break; continue; } lead.push(x); }
    const full = w.join(' ');
    const marks = [w.length >= 2 && w.some(x => !TRADE.has(x) && !local.has(x)) ? full : '', lead.length >= 2 && lead.some(x => x.length >= 5 && !COMMON.has(x)) ? lead.join(' ') : ''].filter(Boolean);
    if (marks.some(k => all.some(t => t.includes(' ' + k + ' ')))) return c;
  }
  return '';
}
/* phrases every contractor's ad already says */
const AD_STOCK = /\b(quality (?:service|work|workmanship|you can trust)|(?:service|experts?|name|company|team|pros) you can trust|trusted (?:experts?|professionals?|name|partner|pros)|your (?:trusted|comfort) (?:partner|experts?)|your comfort is our (?:priority|business)|customer satisfaction is|satisfaction is our|we (?:care|pride ourselves|go above and beyond|treat you like family)|treat(?:ed)? you like family|no job (?:is )?too (?:big|small)|for all (?:of )?your [\w ]{0,20}needs|one stop shop|best in class|world class|top notch|second to none|look no further|exceed(?:ing)? (?:your )?expectations|high quality service|professional and reliable|reliable and affordable|fast,? friendly|honest and reliable|the other guys|servicio de calidad|su mejor opci[oó]n)\b/i;

/* ---------- editorial (search) ---------- */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}\u{2022}\u{25CF}\u{25AA}\u{25B6}\u{2713}\u{2714}\u{2705}\u{2605}\u{2606}]/u;
export function editorial(t) {
  const out = [];
  if (EMOJI.test(t)) out.push('an emoji or symbol');
  if (/[!?]{2,}|\.{4,}|,{2,}/.test(t)) out.push('repeated punctuation');
  if (/(?:\(\d{3}\)\s?|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/.test(t)) out.push('a phone number (use the call asset)');
  if (/\bclick here\b|\bhaga clic aqu[ií]\b/i.test(t)) out.push('"click here" (refused as a generic call to action)');
  if (/^\s*[-*•·]\s/.test(t)) out.push('a bullet');
  return out;
}

/* ---------- findings ---------- */
const mk = F => (severity, rule, where, message, excerpt = '', fix = '') => F.push({ severity, rule, where, message, excerpt, fix });
function screenInto(add, where, found, rulesById) {
  for (const x of found) { const r = x.rule; add(SEV[r.severity] || 'note', 'rule:' + r.id, where, `${r.name} (${r.enforcer}${r.cite ? '; ' + r.cite : ''}).`, x.in ? `${x.ev} in "${x.in}"` : x.ev, r.fix || ''); }
}
const stock = (texts, add, where) => {
  const seen = new Set(), say = x => { const k = low(x); if (seen.has(k)) return; seen.add(k); add('warn', 'stock-phrase', where, 'A stock phrase. It says nothing the next contractor\'s ad does not say; put the specific thing in its place.', x); };
  for (const t of texts) { for (const p of phrases(t)) if (p.rule === 'stock-phrase') say(p.excerpt || t); const m = AD_STOCK.exec(t); if (m) say(m[0]); }
};
/* what no ad may carry, whatever else it says: a license number that is not the one on file, and a competitor's name */
function integrity(add, where, texts, ctx) {
  for (const n of wrongLicense(texts, ctx.lic)) add('error', 'license-wrong', where, `The ad carries the license number ${n}, which is not the one on file (${ctx.lic}). A wrong number is worse than none.`, n, 'Write the number exactly as the brand file has it.');
  const c = namesCompetitor(texts, ctx.competitors || [], ctx.places || []);
  if (c) add('error', 'competitor-name', where, `The ad names a competitor on the dashboard's roster (${c}). Never name another company in an ad: it invites a trademark complaint and a comparison you would have to prove.`, texts.find(t => namesCompetitor([t], [c], ctx.places || [])) || '', 'Say what this business does, not who it is better than. If these are ordinary words that only happen to match a trading name, reword the line.');
}

/* One responsive search ad in its ad group. ctx: lic, rules (the dashboard's), book limits, places, brand, objective,
   deskLimits ({h, d, path} from the dashboard's platform book), confirmed. Returns {findings, stats, claims}. */
export function checkRsa(group, ctx) {
  const F = [], add = mk(F), where = group.name || '(ad group)', ad = group.ad || {}, B = bookFormat('google_search', 'rsa').fields;
  const H = (ad.headlines || []).map(text), D = (ad.descriptions || []).map(text), hp = (ad.headlines || []).map(pinOf), dp = (ad.descriptions || []).map(pinOf);
  const hMax = Math.min(B.headlines.max, (ctx.deskLimits && ctx.deskLimits.h) || 99), dMax = Math.min(B.descriptions.max, (ctx.deskLimits && ctx.deskLimits.d) || 999), pMax = Math.min(B.path1.max, (ctx.deskLimits && ctx.deskLimits.path) || 99);
  /* form */
  if (H.length < B.headlines.count[0]) add('error', 'rsa-count', where, `${H.length} headline${H.length === 1 ? '' : 's'}: a responsive search ad needs at least ${B.headlines.count[0]}.`);
  else if (H.length > B.headlines.count[1]) add('error', 'rsa-count', where, `${H.length} headlines: a responsive search ad holds ${B.headlines.count[1]}.`);
  else if (H.length < 8) add('warn', 'rsa-thin', where, 'Fewer than 8 headlines. Google builds the ad from combinations and rates it on variety: write 10 to 15 that say different things.', `${H.length} headlines`);
  if (D.length < B.descriptions.count[0]) add('error', 'rsa-count', where, `${D.length} description${D.length === 1 ? '' : 's'}: a responsive search ad needs at least ${B.descriptions.count[0]}.`);
  else if (D.length > B.descriptions.count[1]) add('error', 'rsa-count', where, `${D.length} descriptions: a responsive search ad holds ${B.descriptions.count[1]}.`);
  else if (D.length < 4) add('note', 'rsa-thin', where, 'Fewer than four descriptions; four give Google more to work with.', `${D.length} descriptions`);
  H.forEach(h => { if (!h.trim()) add('error', 'limit', where, 'An empty headline.'); else if (chars(h) > hMax) add('error', 'limit', where, `Headline is ${chars(h)} characters; the limit is ${hMax}.`, h); });
  D.forEach(d => { if (!d.trim()) add('error', 'limit', where, 'An empty description.'); else if (chars(d) > dMax) add('error', 'limit', where, `Description is ${chars(d)} characters; the limit is ${dMax}.`, d); });
  for (const [k, v] of [['Path 1', ad.path1], ['Path 2', ad.path2]]) if (v) { if (chars(v) > pMax) add('error', 'path', where, `${k} is ${chars(v)} characters; the limit is ${pMax}.`, v); if (/\s|[^A-Za-z0-9\-_/]/.test(v)) add('error', 'path', where, `${k} holds a space or a character a path cannot.`, v); }
  const dupe = (list, what) => { const seen = new Map(); list.forEach(x => { const k = low(x).replace(/[^a-z0-9áéíóúñ ]/g, '').replace(/\s+/g, ' ').trim(); if (!k) return; if (seen.has(k)) add('error', 'rsa-duplicate', where, `Two ${what}s say the same thing. Google refuses repeats and they waste a slot.`, x); else seen.set(k, x); }); };
  dupe(H, 'headline'); dupe(D, 'description');
  hp.forEach((p, i) => { if (p && (p < 1 || p > 3)) add('error', 'pin', where, 'A headline pins to position 1, 2 or 3.', H[i]); });
  dp.forEach((p, i) => { if (p && (p < 1 || p > 2)) add('error', 'pin', where, 'A description pins to position 1 or 2.', D[i]); });
  const pins = hp.concat(dp).filter(Boolean).length; if (pins > 3) add('warn', 'pin-many', where, `${pins} assets are pinned. Each pin takes combinations away from Google and lowers ad strength: pin what must show and no more.`);
  for (const t of H.concat(D)) for (const e of editorial(t)) add('error', 'editorial', where, `Google's editorial policy refuses ${e}.`, t);
  if (H.concat(D).some(t => /\{keyword:/i.test(t))) add('note', 'insertion', where, 'Keyword insertion puts the searched keyword in place of the default text when it fits. Read the line with every keyword of this ad group in it, and keep it out of a group that holds a competitor\'s name.');

  /* the dashboard's screen, as its Campaign Desk applies it */
  screenInto(add, where, lintSet(H.concat(D), { lic: ctx.lic, platform: 'google' }, ctx.rules));
  integrity(add, where, H.concat(D), ctx);

  /* the license in every impression */
  if (ctx.lic && H.concat(D).some(t => t.includes(ctx.lic))) {
    const always = (list, pinsOf, pos) => { const at = list.filter((_, i) => pinsOf[i] === pos); return at.length > 0 && at.every(t => t.includes(ctx.lic)); };
    const shows = D.every(d => d.includes(ctx.lic)) || always(D, dp, 1) || always(H, hp, 1) || always(H, hp, 2);
    if (!shows) add('warn', 'license-shows', where, 'The license number is in the ad but not in every impression. Google shows two of the descriptions and only Description position 1 is always shown. Pin the description that carries the license to position 1, or carry it in every description.', D.find(d => d.includes(ctx.lic)) || '', 'In the campaign file write the description as {"text": "...", "pin": 1}.');
  }

  /* craft */
  const terms = ctx.terms || [], types = messageTypes(H, { terms, places: ctx.places || [], brand: ctx.brandName || '' });
  const ctas = H.filter(isCta), strong = H.concat(D).filter(t => ctaStrength(t) >= 2);
  if (!ctas.length) add('error', 'cta', where, 'No headline asks the reader to do anything. Write at least two that start with the action: "Call Now for Furnace Repair", "Book a Furnace Check Online".');
  else if (!strong.length) add('warn', 'cta-weak', where, 'The only calls to action are generic. Say what happens when they act: who answers, what they get, when.', ctas[0]);
  if (!D.some(isCta)) add('warn', 'cta-description', where, 'No description carries a call to action. End at least one on the action.');
  if (ctx.objective === 'calls' && !H.concat(D).some(t => PHONE_WORD.test(t))) add('warn', 'cta-objective', where, 'This line is bought for phone calls and nothing in the ad says "call". Ask for the call.');
  const lead = (group.keywords || []).map(k => k && k.text).find(Boolean);
  if (lead && !(ctx.lang === 'es' && !ctx.spanishKeywords)) {
    const key = wordsOf(lead).map(low).filter(w => w.length > 2 && !SMALL.has(w) && !(ctx.places || []).some(p => low(p) === w)), need = Math.max(1, Math.ceil(key.length * 0.6)), research = ctx.intentOf ? ctx.intentOf(lead) === 'research' : false;
    const hits = H.filter(h => key.length && key.filter(w => low(h).includes(w)).length >= need).length;
    if (!hits) add(research ? 'note' : 'warn', 'relevance', where, research ? 'No headline answers the ad group\'s first search, a research search. It books little: answer it in a headline or leave it to a page.' : 'No headline carries the ad group\'s first keyword. The searcher looks for their own words: put them in at least two headlines.', lead);
    else if (hits === 1 && !research) add('note', 'relevance', where, 'Only one headline carries the ad group\'s first keyword. A second raises the odds it shows.', lead);
  }
  const want = ['service', 'cta', 'proof', 'risk', 'local'], lack = want.filter(t => !types.includes(t));
  if (lack.length >= 2) add('warn', 'mix', where, `The headlines lean on too few kinds of message. Missing: ${lack.map(t => ({ service: 'the service by name', cta: 'a call to action', proof: 'proof (license, years, reviews with a date)', risk: 'a risk reducer (price before work, in writing)', local: 'the place' })[t]).join('; ')}.`);
  const P = persuasion(H.concat(D), { terms, places: ctx.places || [], lic: ctx.lic });
  if (P.score < 4) add('warn', 'persuasion', where, `${P.score} of the six things a persuasive ad does. Missing: ${P.how.join('; ')}.`); else if (P.score < 6) add('note', 'persuasion', where, `${P.score} of 6. Missing: ${P.how.join('; ')}.`);
  stock(H.concat(D), add, where);
  const pv = D.flatMap(d => passives(d)); if (pv.length) add('note', 'passive', where, 'Passive voice hides who does the work. Lead with "we" or with the customer.', pv.slice(0, 2).map(p => p.phrase).join(' | '));

  const C = claims(H.concat(D), ctx); claimsInto(add, where, C); answered(F, C);
  return { findings: F, stats: { headlines: H.length, descriptions: D.length, pins, types, persuasion: P.score, cta: strong.length ? 'specific' : ctas.length ? 'generic' : 'none' }, claims: C.map(c => Object.assign({ where }, c)) };
}
/* A dashboard rule that warns about a kind of claim (a rating must be real, a guarantee must have terms) is answered when
   every claim of that kind in the ad is on file or confirmed: the warning then stands as a note, so that what is left as
   a warning is what still needs someone's word. */
const RULE_CLAIM = { REV1: ['reviews'], SUP1: ['superlative'], GUAR1: ['guarantee'], AVL1: ['hours', 'response'], FREE1: ['free'], URG1: ['scarcity'], LIC2: ['credential'] };
function answered(F, C) {
  for (const f of F) {
    const kinds = f.severity === 'warn' && f.rule.startsWith('rule:') && RULE_CLAIM[f.rule.slice(5)]; if (!kinds) continue;
    const mine = C.filter(c => kinds.includes(c.type)); if (!mine.length || !mine.every(c => c.status === 'on-file' || c.status === 'confirmed')) continue;
    f.severity = 'note'; f.message += ` Answered: the claim is ${mine.every(c => c.status === 'confirmed') ? 'confirmed' : 'on file'}.`;
  }
}
function claimsInto(add, where, C) {
  for (const c of C) {
    const label = { price: 'A price or discount', free: 'A "free" offer', guarantee: 'A guarantee', hours: 'An availability claim', response: 'A promise of when', scarcity: 'A limit or a deadline', reviews: 'A review or rating claim', superlative: 'A superlative or a comparison', years: 'A claim about the company\'s history', credential: 'A credential', financing: 'A financing offer', credit: 'A credit term' }[c.type];
    if (c.status === 'contradicts') add('error', 'claim:' + c.type, where, `${label} that the brand file contradicts: ${c.detail}.`, c.said, 'Correct the ad, or correct the brand file if the person says it is out of date.');
    else if (c.status === 'unconfirmed') add('warn', 'claim:' + c.type, where, `${label} nobody has vouched for: ${c.detail}.`, c.said, 'Ask the person. If they state it as a fact, record it under "confirmed" in the campaign file, quoting the claim and their words; if not, cut it. Their asking for a line is not their vouching for it.');
    else add('note', 'claim:' + c.type, where, `${label}, ${c.status === 'confirmed' ? c.detail : 'on file: ' + c.detail}.`, c.said);
  }
}

/* the assets of one search campaign: callouts, sitelinks, the structured snippet */
export function checkAssets(campaign, ctx) {
  const F = [], add = mk(F), where = `${campaign.lang || 'en'} campaign assets`, G = byId('google_search'), lim = (id, k) => bookFormat(G, id).fields[k].max;
  const texts = [];
  for (const c of campaign.callouts || []) { texts.push(c); if (chars(c) > lim('callout', 'text')) add('error', 'asset-limit', where, `Callout is ${chars(c)} characters; the limit is ${lim('callout', 'text')}.`, c); }
  const links = campaign.sitelinks || [], seen = new Set();
  for (const s of links) {
    texts.push(s.text || '', s.d1 || '', s.d2 || '');
    if (!s.text) add('error', 'asset-limit', where, 'A sitelink has no text.');
    else if (chars(s.text) > lim('sitelink', 'text')) add('error', 'asset-limit', where, `Sitelink text is ${chars(s.text)} characters; the limit is ${lim('sitelink', 'text')}.`, s.text);
    for (const d of [s.d1, s.d2]) if (d && chars(d) > lim('sitelink', 'd1')) add('error', 'asset-limit', where, `Sitelink description is ${chars(d)} characters; the limit is ${lim('sitelink', 'd1')}.`, d);
    if (!!s.d1 !== !!s.d2) add('error', 'asset-limit', where, 'A sitelink has one description line. Google takes both or neither.', s.text);
    if (!s.path) add('error', 'asset-limit', where, 'A sitelink has no page to go to.', s.text);
    const k = low(s.text || ''); if (seen.has(k)) add('error', 'sitelink-duplicate', where, 'Two sitelinks share their text.', s.text); seen.add(k);
    if (/!/.test(s.text || '')) add('error', 'editorial', where, 'A sitelink may not hold an exclamation mark.', s.text);
  }
  if (links.length === 1) add('warn', 'sitelink-count', where, 'One sitelink is too few: Google asks for at least two before it shows them on a computer screen. Write four to six.'); else if (links.length && links.length < 4) add('note', 'sitelink-count', where, `${links.length} sitelinks; four to six fill the row on every screen.`);
  const sn = campaign.snippets;
  if (sn) {
    /* Google names its headers in each language; a Spanish campaign may carry the Spanish name of the same header */
    const fmS = bookFormat(G, 'snippet'), heads = fmS.headers.concat(campaign.lang === 'es' ? fmS.headersEs || [] : []);
    if (!heads.includes(sn.header)) add('error', 'snippet-header', where, `"${sn.header}" is not one of Google's structured snippet headers, so the asset is refused. For a list of services the header is "Service catalog"${campaign.lang === 'es' ? ' ("Catálogo de servicios" in Spanish; "Servicios" there is the header for amenities)' : ''}.`, heads.join(', '));
    else if (campaign.lang === 'es' && sn.header === 'Servicios') add('warn', 'snippet-header', where, 'In Spanish, "Servicios" is Google\'s header for amenities. A list of services goes under "Catálogo de servicios".');
    const v = sn.values || []; if (v.length < 3 || v.length > 10) add('error', 'asset-limit', where, `A structured snippet takes 3 to 10 values; this one has ${v.length}.`);
    for (const x of v) { texts.push(x); if (chars(x) > lim('snippet', 'values')) add('error', 'asset-limit', where, `Snippet value is ${chars(x)} characters; the limit is ${lim('snippet', 'values')}.`, x); }
  }
  for (const t of texts.filter(Boolean)) { for (const e of editorial(t)) add('error', 'editorial', where, `Google's editorial policy refuses ${e}.`, t); screenInto(add, where, screen(t, { lic: ctx.lic, headline: true }, ctx.rules).map(x => Object.assign({ in: t }, x))); }
  integrity(add, where, texts.filter(Boolean), ctx);
  const C = claims(texts.filter(Boolean), ctx); claimsInto(add, where, C); answered(F, C);
  return { findings: F, claims: C.map(c => Object.assign({ where }, c)) };
}

/* One ad on any other channel, against the channel book. The ad names its channel and format and carries the format's
   fields by key. Returns {findings, stats, claims}. */
export function checkAd(ad, ctx) {
  const F = [], add = mk(F), ch = byId(ad.channel), where = `${ad.channel || '?'}: ${ad.name || ad.angle || '(unnamed ad)'}`;
  if (!ch) { add('error', 'channel', where, `"${ad.channel}" is not a channel in the book. See: channels`); return { findings: F, stats: {}, claims: [] }; }
  if (ch.status === 'closed') { add('error', 'channel', where, `${ch.name} is not open to this kind of business. ${ch.for}`); return { findings: F, stats: {}, claims: [] }; }
  const fm = bookFormat(ch, ad.format || ''); if (!fm) { add('error', 'format', where, `${ch.name} has no format "${ad.format}". Formats: ${ch.formats.map(f => f.id).join(', ')}`); return { findings: F, stats: {}, claims: [] }; }
  const key = ch.id + '.' + fm.id, texts = [];
  for (const r of REQUIRED[key] || []) { const v = ad[r]; if (v == null || (Array.isArray(v) ? !v.length : !String(text(v) || v).trim())) add('error', 'required', where, `${fm.name} needs ${(fm.fields[r] || {}).label || r}.`); }
  for (const [k, spec] of Object.entries(fm.fields)) {
    const v = ad[k]; if (v == null || v === '') continue; const list = (Array.isArray(v) ? v : [v]).map(text);
    if (spec.count) { if (list.length < spec.count[0]) add('error', 'limit', where, `${list.length} ${spec.label.toLowerCase()}${list.length === 1 ? '' : 's'}; at least ${spec.count[0]} needed.`); if (list.length > spec.count[1]) add('error', 'limit', where, `${list.length} ${spec.label.toLowerCase()}s; at most ${spec.count[1]} fit.`); }
    for (const t of list) { texts.push(t); const n = chars(t); if (spec.max && n > spec.max) add('error', 'limit', where, `${spec.label} is ${n} characters; ${ch.name} holds ${spec.max}${spec.grade === 'D' ? ' (a working figure: check in the platform)' : ''}.`, t.slice(0, 140)); else if (spec.rec && n > spec.rec) add(k === 'primary' || k === 'body' || k === 'intro' ? 'note' : 'warn', 'shows', where, `${spec.label} is ${n} characters; about ${spec.rec} show before it is cut. Make sure the point and the action come first.`, t.slice(0, spec.rec)); }
  }
  /* a script must fit its seconds */
  if (ad.script) { const sec = +ad.seconds || (fm.seconds ? fm.seconds[fm.seconds.length - 1] : 0), n = wordsOf(ad.script).length; if (fm.seconds && ad.seconds && !fm.seconds.includes(+ad.seconds)) add('warn', 'script-length', where, `${ch.name} takes ${fm.seconds.join(', ')} second spots; this one is marked ${ad.seconds}.`); if (sec && n > Math.round(sec * WORDS_PER_SECOND)) add('warn', 'script-length', where, `The script is ${n} words for ${sec} seconds. About ${Math.round(sec * WORDS_PER_SECOND)} can be spoken clearly.`); }
  /* the button */
  const buttons = fm.cta || ch.cta, accepted = fm.ctaAll || ch.ctaAll || null;
  if (ad.cta != null && ad.cta !== '') {
    const c = String(ad.cta), norm = low(c).replace(/_/g, ' ');
    if (fm.fields.cta && chars(c) > (fm.fields.cta.max || 999)) { /* counted above */ }
    else if (accepted && !accepted.some(a => low(a) === norm)) add('error', 'cta-button', where, `"${c}" is not a button ${ch.name} offers for this format. It offers: ${accepted.join(', ')}.`);
    else if (!ch.ctaFree && buttons && !buttons.some(a => low(a) === norm)) add(accepted ? 'note' : 'warn', 'cta-button', where, `"${c}" is ${accepted ? 'offered, but a weaker choice here' : 'not among the buttons known for ' + ch.name + ': check it in the platform'}. Better for this business: ${buttons.join(', ')}.`);
    if (/^learn more$/i.test(norm) && ctx.objective !== 'awareness') add('warn', 'cta-weak', where, '"Learn more" asks for nothing. For a lead or a call use the button that names the action: Get quote, Call now, Book now.');
  } else if (buttons && !['lsa', 'yelp', 'angi', 'thumbtack', 'ctv', 'amazon', 'audio', 'ooh', 'programmatic', 'pinterest', 'x', 'youtube', 'google_display'].includes(ch.id)) add('warn', 'cta-button', where, `No button chosen. ${ch.name} offers: ${buttons.join(', ')}.`);
  /* a profile on a lead service is read by someone already choosing a contractor: it describes, the service supplies the button */
  const prose = texts.filter(Boolean), profile = ['lsa', 'angi', 'thumbtack'].includes(ch.id), ownButton = profile || ch.id === 'yelp';   /* Yelp puts its own call and quote buttons on every ad */
  if (prose.length && !ownButton && !prose.some(isCta) && !ad.cta) add('error', 'cta', where, 'The ad never asks the reader to do anything. End on the action.');
  else if (prose.length && !profile && !prose.some(t => ctaStrength(t) >= 2)) add('warn', 'cta-weak', where, ownButton ? 'The copy never asks the reader to do anything, or only in general terms. The platform adds its own button; say the action in the words too, with what happens next.' : 'The copy carries no call to action of its own, or only a generic one. The button is small: say the action in the words too, with what happens next.');
  /* the dashboard's screen: every ad carries the license, except a job ad */
  const recruiting = ad.angle === 'recruit' || ctx.line === 'recruit';
  if (prose.length) {
    const found = screen(prose.join(' \n '), { lic: ctx.lic, needLic: !recruiting, platform: ch.desk === 'meta' ? 'meta' : ch.desk || ch.id }, ctx.rules);
    screenInto(add, where, found);
    integrity(add, where, prose, ctx);
    /* the same test the build uses to move a Meta ad into its own campaign on a radius */
    if (ch.id === 'meta' && talksCredit(ad.angle, prose.join(' '))) add('warn', 'special-category', where, 'This ad talks about financing or credit, so on Meta it runs as a Financial products and services special ad category: a 15 mile radius at least, no ZIP codes, no age or gender choices. The build puts it in its own campaign on a radius. Keep financing out of the ZIP targeted ads, or accept the wider reach.');
    if (['meta', 'nextdoor', 'tiktok'].includes(ch.id) && /\b(your|you'?re|are you)\b[^.?!]{0,40}\b(credit|debt|bills|broke|struggling|income|age|elderly|senior|disab|sick|illness)\b/i.test(prose.join(' '))) add('error', 'personal', where, `${ch.name} refuses an ad that says or implies something personal about the reader. Describe the offer, not the person.`);
    else if (['meta', 'nextdoor', 'tiktok'].includes(ch.id) && /\b(seniors?|elderly|retirees?|over (?:5|6|7)\d|(?:5|6|7)\d (?:and|or) (?:over|older)|(?:5|6|7)\d\+|low income|on a fixed income)\b/i.test(prose.join(' '))) add('warn', 'personal', where, `${ch.name} refuses an ad that speaks to people by their age or their means. Describe the offer ("a discount for seniors" still needs the owner's word and its terms) without addressing the group.`, (prose.join(' ').match(/\b(seniors?|elderly|retirees?|over (?:5|6|7)\d|(?:5|6|7)\d (?:and|or) (?:over|older)|(?:5|6|7)\d\+|low income|on a fixed income)\b[^.?!]{0,30}/i) || [''])[0]);
    for (const t of prose) if (EMOJI.test(t) && ['lsa', 'linkedin', 'nextdoor', 'eddm'].includes(ch.id)) add('warn', 'editorial', where, 'An emoji or symbol; the dashboard\'s copy carries none.', t.slice(0, 80));
    for (const [k, v] of Object.entries(ad)) if (fm.fields[k] && k !== 'cta' && /https?:\/\/|\bwww\.|(^|\s)@\w{2,}/i.test(Array.isArray(v) ? v.map(text).join(' ') : text(v))) add('warn', 'editorial', where, 'A web address or a handle sits in the ad\'s text. The link belongs in the URL field, where it is tracked; in the text it is not clickable on most placements.', String(Array.isArray(v) ? v.map(text).join(' ') : text(v)).slice(0, 80));
  }
  const terms = ctx.terms || [], P = persuasion(prose, { terms, places: ctx.places || [], lic: ctx.lic });
  if (prose.join(' ').length > 60) { if (P.score < 4) add('warn', 'persuasion', where, `${P.score} of the six things a persuasive ad does. Missing: ${P.how.join('; ')}.`); else if (P.score < 6) add('note', 'persuasion', where, `${P.score} of 6. Missing: ${P.how.join('; ')}.`); }
  stock(prose, add, where);
  const first = text(ad.primary || ad.body || ad.intro || ad.text || '');
  if (first && !/\b(you|your|usted|su|tu)\b/i.test(first) && /\b(we|our|us)\b/i.test(first)) add('note', 'we-heavy', where, 'The copy talks about the company and never about the reader. Open on their situation.');
  const C = claims(prose, ctx); claimsInto(add, where, C); answered(F, C);
  return { findings: F, stats: { channel: ch.id, format: fm.id, persuasion: P.score }, claims: C.map(c => Object.assign({ where }, c)) };
}
