/* Keywords for a search campaign: what a search means, where the keyword belongs, and what must stay out.

   The dashboard holds a keyword library by service angle and no search volumes. So a keyword is chosen here the way a
   buyer without a volume tool chooses: by what the searcher wants (intent), by whether the dashboard's model finds
   demand for the angle in the markets bought, and by what a booked job on that line is worth. Volumes and click prices
   come from the account's Keyword Planner and from search term reports, never from here. */

const words = s => String(s).toLowerCase().replace(/[^a-z0-9áéíóúñü\s']/g, ' ').split(/\s+/).filter(Boolean);
const QUESTION = /^(who|what|when|where|why|how|can|could|does|do|did|is|are|should|will|which)\b/i;
const SYMPTOM = /\b(not (working|cooling|heating|turning on|igniting|blowing|coming on|keeping up)|won'?t (start|turn on|light|stay on)|blowing (cold|warm|hot) air|no (heat|air|ac|cooling)|making (a )?noise|frozen( coil)?|froze up|leaking|keeps (shutting off|tripping|running)|shuts off|short cycling|tripping (the )?breaker|smells like gas|running constantly|says heat but no heat|ice on|iced up|hot upstairs|some rooms)\b/i;
const URGENT = /\b(emergency|same day|24 hour|24\/7|tonight|today|right now|asap|after hours)\b/i;
const PRICE = /\b(cost|costs|price|prices|pricing|how much|cheap|affordable|financing|finance|payment|payments|quote|quotes|estimate|estimates|coupon|deal|special)\b/i;
const RESEARCH = /\b(how long|how often|how old|what is|what does|what size|what replaces|what seer|is (a|an|my|it) .* worth|worth it|vs\b|versus|signs of|how to (tell|read|reduce|know)|should i|can i|can a|can hail|do heat pumps|does (a|an|insurance)|who (pays|repairs)|best time|pros and cons|difference between)\b/i;
/* a search that asks what something costs to buy, as against what it costs to run or whether it is worth it */
const COSTS = /\b(how much|cost|costs|price|prices|pricing|quote|quotes|estimate|estimates|finance|financing)\b/i, RUNNING = /\b(to run|to operate|worth|vs|versus|per month|a month|electric bill|energy bill|save|savings)\b/i;
const HIRING = /\b(jobs?|hiring|careers?|salary|apprentice(ship)?|technician jobs|installer jobs)\b/i;
/* \b does not see an accented letter as part of a word, so a Spanish phrase that ends in one is closed by hand */
const NEAR = /\bnear me\b|\bnearby\b|\bin my area\b|\bcerca de m[ií](?![a-záéíóúñü])/i;
export const SPANISH = /\b(reparaci[oó]n|calefacci[oó]n|calef[aá]ctor|calent[oó]n|aire|acondicionado|bomba de calor|t[eé]cnico|instalaci[oó]n|mantenimiento|emergencia|cerca de m[ií]|no (calienta|enfr[ií]a|enciende|prende)|arreglo|servicio de|ductos?|horno|clima)(?![a-z0-9áéíóúñü])/i;

/* What a search is after, and what a campaign does about it.
   emergency  the system is down now: full bid, call first, every hour the phones are answered
   symptom    names what is wrong: a buyer who has not picked a contractor; name the symptom in a headline
   service    names the job (repair, replacement, tune up): the core of the account
   price      asks what it costs: close to a decision on a replacement; answer with how the price is given
   research   wants to understand: bid low or leave it to a page; a topic for the content strategist
   hiring     a job seeker: only on the recruiting line */
/* the same readings for a search typed in Spanish */
const ES = {
  hiring: /\b(trabajos?|empleos?|vacantes?|sueldo|contratando)\b/i,
  urgent: /\b(emergencia|urgente|urgencia|hoy mismo|mismo d[ií]a|24 horas|ahora)\b/i,
  symptom: /\bno (calienta|enfr[ií]a|enciende|prende|funciona|sirve|arranca|sopla)\b|\bsin (calefacci[oó]n|aire|calor|clima)\b|\b(tira|sopla|echa) aire (fr[ií]o|caliente)\b|\bhace ruido\b|\bgotea\b|\bse apaga\b|\bhuele a gas\b|\bcongelad[oa]\b/i,
  price: /\b(precios?|costos?|cu[aá]nto (cuesta|cobran|sale)|cotizaci[oó]n|presupuesto|financiamiento|barat[oa]s?|econ[oó]mic[oa]s?|pagos)\b/i,
  research: /^(c[oó]mo|por qu[eé]|qu[eé]|cu[aá]nto dura|cu[aá]ndo|cu[aá]l|vale la pena|se puede)\b/i,
};
export function intent(keyword) {
  const s = String(keyword).toLowerCase().trim(), q = QUESTION.test(s);
  if (SPANISH.test(s) || /[áéíóúñ¿]/.test(s)) {
    if (ES.hiring.test(s)) return 'hiring'; if (ES.urgent.test(s) && !ES.research.test(s)) return 'emergency'; if (ES.symptom.test(s)) return 'symptom';
    if (ES.price.test(s)) return 'price'; if (ES.research.test(s)) return 'research'; return 'service';
  }
  if (HIRING.test(s)) return 'hiring';
  if (URGENT.test(s) && !RESEARCH.test(s)) return 'emergency';
  if (SYMPTOM.test(s)) return 'symptom';
  if (COSTS.test(s)) return RUNNING.test(s) ? 'research' : 'price';
  if (RESEARCH.test(s)) return 'research';
  if (PRICE.test(s)) return 'price';
  if (q) return 'research';
  return 'service';
}
export const INTENT = {
  emergency: { label: 'emergency', bid: 'full bid, raised on cold or hot days', action: 'a call', note: 'The system is down. Call assets on, ads only in the hours the phone is answered.' },
  symptom: { label: 'symptom', bid: 'full bid', action: 'a call or a booking', note: 'Names what is wrong. Put the symptom in a headline and say the price comes before the work.' },
  service: { label: 'service', bid: 'full bid', action: 'a call or a quote request', note: 'Names the job. The core of the account.' },
  price: { label: 'price', bid: 'full bid on replacement lines, three quarters on repair', action: 'a written quote', note: 'Close to a decision. Say how the price is given (in writing, before work starts), not a number the business has not confirmed.' },
  research: { label: 'research', bid: 'half bid, or leave it out and write the page', action: 'a page that answers it', note: 'Wants to understand, not to book. Cheap clicks that seldom book: a topic for the content strategist.' },
  hiring: { label: 'hiring', bid: 'recruiting campaigns only', action: 'an application', note: 'A job seeker. A negative everywhere else.' },
};
export const isLocal = (keyword, cities = []) => NEAR.test(keyword) || /\{city\}/.test(keyword) || cities.some(c => new RegExp('\\b' + String(c).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(String(keyword).toLowerCase()));

/* ---------- form ---------- */
/* what is wrong with a keyword as text, or '' */
export function badForm(text) {
  const s = String(text == null ? '' : text);
  if (!s.trim()) return 'it is empty';
  if (/\{\w+\}/.test(s)) return 'a placeholder is left in it';
  if (/[,!@%^()={};~`<>?\\|*]/.test(s)) return 'it holds a character keywords cannot (, ! @ % ^ ( ) = { } ; ~ ` < > ? \\ | *)';
  if (s.length > 80) return `it is ${s.length} characters; a keyword holds 80`;
  if (words(s).length > 10) return 'it has more than 10 words';
  if (s !== s.trim() || /\s{2,}/.test(s)) return 'it has stray spaces';
  return '';
}
export const MATCH = ['exact', 'phrase', 'broad'];

/* ---------- negatives ---------- */
/* true when a negative, as a phrase, would stop a search that is the keyword itself: its words stand in the keyword in the
   same order, whole words only. (A negative matches no close variants, so "jobs" does not stop "job".) */
export function blocks(negative, keyword) {
  const n = words(negative), k = words(keyword); if (!n.length || n.length > k.length) return false;
  for (let i = 0; i + n.length <= k.length; i++) if (n.every((w, j) => k[i + j] === w)) return true;
  return false;
}
/* nouns on a negative list that people search in both numbers */
const COUNTED = new Set(['job', 'career', 'school', 'course', 'class', 'certification', 'part', 'unit', 'heater', 'filter', 'blanket', 'lamp', 'pad', 'rental', 'diagram', 'lawsuit', 'recall', 'radiator', 'stove', 'fireplace', 'chimney', 'dryer', 'oven', 'boiler', 'coupon', 'salary', 'manual', 'kit', 'purifier', 'checklist', 'furnace', 'pump', 'tub', 'camper', 'truck', 'apartment', 'adjuster']);
const plural = w => (/[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/.test(w) ? w + 'es' : w + 's');
const singular = w => (/ies$/.test(w) ? w.slice(0, -3) + 'y' : /(ses|xes|ches|shes)$/.test(w) ? w.slice(0, -2) : /s$/.test(w) ? w.slice(0, -1) : w);
/* negatives with no singular or plural twin on the list: a negative stops only the form it is written in */
export function twinless(negatives) {
  const set = new Set(negatives.map(n => n.toLowerCase().trim())), out = [];
  for (const n of set) {
    const w = n.split(' '), last = w[w.length - 1], one = singular(last); if (!COUNTED.has(one)) continue;
    const twin = w.slice(0, -1).concat(last === one ? plural(one) : one).join(' ');
    if (!set.has(twin)) out.push({ negative: n, missing: twin });
  }
  return out;
}

/* the job a keyword is about, so an ad group that mixes jobs can be seen */
const THEMES = [['repair', /\b(repair|fix|not (working|cooling|heating)|broken|service call|reparaci[oó]n)\b/i], ['replacement', /\b(replace(ment)?|new|install(ation)?|upgrade|cambio|instalaci[oó]n)\b/i], ['upkeep', /\b(tune ?up|maintenance|inspection|check ?up|cleaning|mantenimiento|revisi[oó]n)\b/i]];
export const themesOf = list => [...new Set(list.flatMap(k => THEMES.filter(([, re]) => re.test(k)).map(([t]) => t)))];

/* ---------- a campaign's keywords, checked ---------- */
/* findings for the ad groups of one search campaign: [{severity, rule, where, message, excerpt}]. `negatives` are the
   campaign's; `competitors` the names other contractors trade under; `cities` the market cities. */
export function check(campaign, { competitors = [], cities = [], line = '' } = {}) {
  const F = [], add = (severity, rule, where, message, excerpt = '') => F.push({ severity, rule, where, message, excerpt });
  const groups = campaign.adGroups || [], seen = new Map(), home = new Map(), cneg = (campaign.negatives || []).map(String);
  for (const g of groups) {
    const where = g.name || '(unnamed ad group)', kws = g.keywords || [];
    if (!kws.length) add('error', 'kw-none', where, 'This ad group has no keywords, so it would never run.');
    const intents = new Set(), stopped = new Set(), split = new Set();
    for (const k of kws) {
      const text = k && k.text, bad = badForm(text);
      if (bad) { add('error', 'kw-form', where, `A keyword is not usable: ${bad}.`, String(text)); continue; }
      if (text !== text.toLowerCase()) add('note', 'kw-form', where, 'Keywords are written in lower case; match is not case sensitive.', text);
      if (!MATCH.includes(k.match)) add('error', 'kw-form', where, `The match type "${k.match}" is not exact, phrase or broad.`, text);
      if (k.match === 'broad') add('warn', 'kw-broad', where, 'Broad match shows the ad on related searches that need not contain the keyword\'s meaning. Run it only with smart bidding on an account that already has conversion data, and say so in the hand back.', text);
      const id = text.toLowerCase() + '|' + k.match;
      if (seen.has(id) && seen.get(id) !== where) add('error', 'kw-duplicate', where, `"${text}" (${k.match}) is also in the ad group "${seen.get(id)}". A campaign bids on a keyword from one ad group; keep it where its ad fits best.`, text); else seen.set(id, where);
      /* the same words in another ad group under another match type answer the same searches from two ads */
      const lt = text.toLowerCase(), firstHere = seen.get(id) === where;
      if (firstHere && home.has(lt) && home.get(lt) !== where && !split.has(lt)) { split.add(lt); add('warn', 'kw-split', where, `"${text}" is also in the ad group "${home.get(lt)}" under another match type, so two ad groups answer the same search. Keep a keyword's match types in one ad group.`, text); }
      if (!home.has(lt)) home.set(lt, where);
      /* a negative that stops a keyword is said once for the keyword, whatever its match types */
      for (const n of cneg) if (blocks(n, text) && !stopped.has(n + '|' + lt)) { stopped.add(n + '|' + lt); add('error', 'kw-blocked', where, `The campaign negative "${n}" stops this keyword's own searches. Drop the negative or the keyword.`, text); }
      for (const n of g.negatives || []) { const nt = typeof n === 'string' ? n : n.text; if (blocks(nt, text) && !stopped.has('g' + nt + '|' + lt)) { stopped.add('g' + nt + '|' + lt); add('error', 'kw-blocked', where, `The ad group negative "${nt}" stops this keyword's own searches.`, text); } }
      const it = intent(text); intents.add(it);
      if (it === 'hiring' && line !== 'recruit') add('error', 'kw-intent', where, 'This is a job seeker\'s search. It belongs on the recruiting line only.', text);
      const comp = competitors.find(c => c && c.length > 3 && blocks(c, text));
      if (comp) add('warn', 'kw-competitor', where, `This keyword holds a competitor's name (${comp}). Buying it is allowed; the name must stay out of the ad text, clicks cost more and book less, and the owner decides whether to do it at all.`, text);
    }
    const th = themesOf(kws.map(k => (k && k.text) || '').filter(k => intent(k) !== 'research'));
    if (th.length > 1) add('note', 'kw-theme', where, `This ad group holds ${th.join(' and ')} searches, so one ad and one landing page answer ${th.length === 2 ? 'both' : 'all three'}. Split them when the budget carries it: each job gets the ad that names it.`, kws.filter(k => k && k.text).map(k => k.text).filter((t, i, a) => a.indexOf(t) === i).slice(0, 6).join(' | '));
    if (intents.has('research') && (intents.has('service') || intents.has('emergency') || intents.has('symptom'))) add('note', 'kw-mixed', where, 'Research searches sit in the same ad group as buying searches, so one ad answers both. Move the research terms to their own group with a lower bid, or leave them to a page.', kws.filter(k => k && k.text && intent(k.text) === 'research').map(k => k.text).slice(0, 4).join(' | '));
  }
  const tw = twinless(cneg);
  if (tw.length) add('note', 'neg-twin', 'campaign negatives', 'A negative keyword matches no close variants: it stops only the form it is written in. These have no singular or plural twin on the list; add the twin where the other form is also unwanted.', tw.slice(0, 14).map(t => `${t.negative} (add: ${t.missing})`).join(' | '));
  /* a campaign in another language that bids only on English searches */
  if (campaign.lang === 'es') { const all = groups.flatMap(g => (g.keywords || []).map(k => (k && k.text) || '')), es = all.filter(k => SPANISH.test(k)); if (all.length && !es.length) add('warn', 'kw-language', 'keywords', 'This is the Spanish campaign and every keyword in it is English: the dashboard\'s library holds no Spanish terms. Its ads would show only to people who search in English with a Spanish language setting. Add the Spanish searches yourself (they are yours, not the dashboard\'s: say so) or run Spanish ads only where a Spanish search is bought.'); }
  return F;
}

/* a keyword set as the agent sees it: each keyword with its intent, by ad group kind */
export function describe(own, cities = []) {
  const row = (text, kind) => ({ text, kind, intent: intent(text), local: kind === 'local' || isLocal(text, cities) });
  return [...own.core.map(k => row(k, 'core')), ...own.questions.map(k => row(k, 'questions')), ...own.city.map(k => row(k, 'local'))];
}
