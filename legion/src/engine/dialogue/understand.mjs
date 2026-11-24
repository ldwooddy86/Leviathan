// Legion · dialogue · understand: what the player said.
//
// The player's line becomes an intent (one of INTENTS), a few flags (a question, a greeting or thanks riding along,
// "tell me more", a yes or a no), the mind's appraisal (sentiment, toxicity, the facts they gave about
// themselves) and entities: places (Census places, ZIP mailing cities, counties, the gazetteer's peaks, ranges,
// waters and valleys), the routine places everyone has (the beach, the park, the grocery store), highways, years,
// the ZIP's fires by name, interests and teams. Intents come from weighted patterns; the strongest wins, with a
// fixed priority breaking ties, and a few combinations resolve the way a person would hear them ("hi, how are
// you?" is a how-are-you, "what do you think about the rent?" is about rent).

import { appraise as mindAppraise } from '../mind.mjs';
import { isNum, num } from './core.mjs';

/** Every intent the engine understands, in tie-breaking priority order (earlier wins a tie). */
export const INTENTS = Object.freeze([
  'insult', 'goodbye', 'name', 'joke', 'directions', 'insurance', 'earthquake', 'fire', 'storm', 'rent', 'heat',
  'housing', 'traffic', 'weather', 'food', 'place', 'job', 'family', 'home', 'history', 'about-them', 'opinion',
  'neighborhood', 'how-are-you', 'compliment', 'thanks', 'apology', 'smalltalk', 'greeting', 'unknown',
]);

/** Intents that are about a subject (they take "tell me more" and opinions). */
export const TOPICAL = Object.freeze(new Set(['job', 'family', 'home', 'neighborhood', 'weather', 'traffic', 'fire', 'storm', 'heat', 'housing', 'rent', 'insurance', 'earthquake', 'food', 'place', 'directions', 'history', 'about-them', 'opinion', 'smalltalk']));

// [pattern, weight]; a pattern counts once per message.
const P = {
  goodbye: [
    [/\b(bye|goodbye|good bye|bye bye|bye-bye|farewell|so long|peace out|adi[oó]s|ciao|later,? (man|dude|bro|friend))\b/, 4],
    [/\bsee (you|ya)( (later|soon|around|next time|tomorrow))?\b/, 3.5], [/\bcatch you later\b|\btalk (to you )?(later|soon)\b|\buntil next time\b/, 3.5],
    [/\b(gotta|got to|have to|need to|should) (go|run|get going|head out|head home|get back)\b/, 3.5], [/\bi'?m (heading out|off|out of here|leaving|going to go)\b/, 3],
    [/\bhave a (good|nice|great|wonderful) (one|day|night|evening|weekend|afternoon)\b/, 3], [/\bgood ?night\b/, 3],
    [/\b(nice|good|great) (talking|chatting) (to|with) you\b/, 3], [/\btake care\b(?! of)/, 3],
  ],
  greeting: [[/^(hi|hello|hey|heya|hiya|howdy|yo|sup|greetings|hola|good (morning|afternoon|evening|day)|morning|evening|afternoon)\b/, 2.5], [/\b(hi|hello|hey) there\b/, 2.5], [/\bnice to meet you\b/, 1.5]],
  'how-are-you': [
    [/\bhow (are|r) (you|u|ya)( doing| holding up| feeling)?\b/, 3.5], [/\bhow'?s it (going|goin)\b/, 3.5], [/\bhow (you|ya) (doing|doin)\b/, 3.5],
    [/\bhow (are|is) (things|everything|life)\b/, 3], [/\bhow'?s (your|ur) (day|week|morning|afternoon|evening|life|night)\b/, 3],
    [/\bhow (have|'ve) you been\b|\bhow you been\b/, 3.5], [/\bwhat'?s up\b|\bwhat'?s good\b|\bsup\b/, 2], [/\b(are )?you (doing )?(ok|okay|alright|all right|good)\s*\??$/, 2.5],
    [/\bhow (do|are) you feel(ing)?\b/, 2.5], [/\bhow'?s (the|your) (mood|energy)\b/, 2.5],
  ],
  name: [
    [/\bwhat'?s (your|ur) name\b|\bwhat is (your|ur) name\b|\byour name\b/, 4.5], [/\bwho are you\b/, 3.5], [/\bwhat (do|should|can|shall) i call you\b|\bwhat are you called\b/, 4.5],
    [/\bintroduce yourself\b|\bwe haven'?t met\b/, 3.5], [/\b(do you )?remember my name\b|\bwhat'?s my name\b|\bwho am i\b/, 4.5],
    [/\bmy name'?s\b|\bmy name is\b|\bcall me\b|\bi'?m called\b/, 3],
  ],
  'about-them': [
    [/\btell me (a little |a bit |more )?about (yourself|you)\b|\bwhat'?s your story\b|\bwho are you\b/, 4], [/\bwhere are you from\b|\bwhere('?re| are) you originally from\b|\bwhere (did|do) you (grow up|come from)\b|\bare you from (here|around here|california)\b|\bwere you born (here|in)\b/, 4.5],
    [/\bhow old are you\b|\bwhat'?s your age\b|\byour age\b/, 4.5], [/\bhobb(y|ies)\b|\bfor fun\b|\bwhat are you into\b|\bfree time\b|\bspare time\b|\bon (the )?weekends?\b(?=.*\byou\b)/, 3.5],
    [/\bdo you (like to |ever |still )?(surf|hike|fish|garden|cook|golf|run|ski|snowboard|read|bike|swim|camp|hunt|paint|draw|dance|sing|game|play|skate|travel|sail|knit|bake)\b/, 3.5],
    [/\bare you (a|an) [a-z0-9']+ fan\b|\bdo you (follow|watch|root for|like) (the )?[a-z0-9']+\b(?=.*\b(game|team|season|sports?|dodgers|giants|lakers|warriors|49ers|niners|rams|padres|angels|kings|sharks|clippers|chargers|ducks|galaxy|lafc|a'?s)\b)/, 3],
    [/\bwhat do you (like|love|enjoy)( to do)?\b/, 2.5], [/\b(tell me|talk) about (your life|yourself)\b/, 4],
  ],
  job: [
    [/\bwhat do you do\b(?! for fun| on (the )?weekends?| in your free| when)/, 4.5], [/\bwhere do you work\b|\bwhat'?s your job\b|\bwhat kind of work\b|\bwhat (line|kind) of (work|business)\b/, 4.5],
    [/\b(your )?(jobs?|career|occupation|profession|boss|shift|shifts|coworkers?|employer|paycheck)\b/, 2.5], [/\bfor a living\b|\bwork(ing)? (today|tomorrow|tonight|nights|from home|remotely)\b/, 3],
    [/\b(retired|retire|retirement|unemployed|laid off|looking for work|between jobs)\b/, 2.5], [/\bdo you work\b|\bare you working\b|\byou work\b/, 3],
    [/\bwhat grade\b|\bwhat school\b|\bdo you go to school\b|\b(school|class|classes|teacher|homework|college|university|major|studying|recess|semester)\b/, 2.5],
  ],
  family: [
    [/\b(family|families|kids?|children|child|sons?|daughters?|wife|husband|spouse|parents|mom|dad|mother|father|grandkids|grandchildren|grandsons?|granddaughters?|siblings?|brothers?|sisters?|babies|baby|grandma|grandpa|grandmother|grandfather|cousins?|aunts?|uncles?|nephews?|nieces?|in-laws?)\b/, 3],
    [/\bare you married\b|\bmarried\b|\bsingle\b|\bdating\b|\bboyfriend\b|\bgirlfriend\b/, 3], [/\bwho do you live with\b|\blive alone\b|\bdo you have kids\b|\bany kids\b/, 4],
  ],
  home: [
    [/\bwhere do you live\b|\bwhere'?s your (house|place|home)\b/, 4.5], [/\b(your|ur) (house|home|place|apartment|street|yard|garden|roof|building)\b/, 3],
    [/\bdo you (own|rent)\b|\bown or rent\b/, 4], [/\bhow long have you (lived|been living|been) (here|in|around)\b|\bhow long have you lived\b/, 4.5],
    [/\b(live|living) (here|around here|nearby|close by|in this (area|neighborhood|town))\b/, 3], [/\bwhen did you move\b|\bmoved? here\b/, 3.5],
  ],
  neighborhood: [
    [/\bneighbou?rhoods?\b|\bneighbou?rs?\b|\bthis (area|town|city|place|block|part of town|street)\b|\baround here\b|\bthe area\b|\bcommunity\b/, 2.5],
    [/\bwhat'?s (it|life) like (living |to live |growing up )?(here|in|around)\b|\bwhat'?s [a-z .'-]{2,28} like\s*\??$/, 4], [/\bis it (safe|nice|good|quiet|loud|busy|walkable|friendly)\b/, 3],
    [/\bdo you like (it )?(here|living here|this place|the area|this town|this neighborhood)\b/, 4], [/\b(best|worst) (thing|part) about\b/, 3.5],
    [/\bpeople (here|around here)\b|\bwho lives (here|around here)\b|\bwhat language\b|\bspeak spanish\b/, 3],
  ],
  weather: [
    [/\b(weather|forecast|temperature|degrees|rain|raining|rainy|sunny|cloudy|clouds|fog|foggy|marine layer|june gloom|may gray|windy|breezy|chilly|freezing|snowing|humid|humidity|umbrella|jacket weather|sweater weather|drizzle)\b/, 3],
    [/\bhot (today|out|outside|enough)\b|\bwarm (today|out)\b|\bcold (today|out|outside)\b|\bnice (day|out|weather)\b|\bbeautiful day\b|\bgorgeous day\b/, 3],
    [/\b(wind|cold|snow|sun)\b/, 1.5], [/\bwill it rain\b|\bis it going to (rain|be hot|be cold)\b|\bwhat'?s it like out\b/, 3.5],
  ],
  traffic: [
    [/\b(traffic|commute|commuting|freeways?|highways?|rush hour|carpool|gridlock|congestion|sigalert|parking)\b/, 3],
    [/\b(drive|driving|drove|car|cars|bus|buses|train|trains|bart|metro|muni|caltrain|light rail|transit|bike lane|road|roads)\b/, 1.8],
    [/\bthe \d{1,3}\b|\bi-?\s?\d{1,3}\b|\binterstate \d+|\broute \d+|\bhighway \d+|\bhwy \d+|\bpch\b|\bpacific coast highway\b|\b(us|sr) ?-?\d{1,3}\b/, 2.5],
    [/\bhow did you get here\b|\bhow do you get to work\b|\bhow long (is|was) your (drive|commute)\b/, 4],
  ],
  fire: [
    [/\b(wild)?fires?\b|\bsmoke\b|\bsmoky\b|\bevacuat\w*|\bflames?\b|\bembers\b|\bred flag\b|\bcal ?fire\b|\bfirefighters?\b|\bfire season\b|\bcontainment\b|\bblaze\b|\bgo-?bags?\b|\bburn(ed|ing|t)? (down|area|scar)\b|\bburn scar\b|\bdefensible space\b/, 3.5],
    [/\bash\b|\bburned\b|\bburnt\b/, 1.5],
  ],
  storm: [
    [/\bstorms?\b|\bstormy\b|\bfloods?\b|\bflooded\b|\bflooding\b|\batmospheric rivers?\b|\bmudslides?\b|\blandslides?\b|\bdebris flows?\b|\blevees?\b|\bdownpours?\b|\bdeluge\b|\bking tides?\b|\bhigh surf\b|\bel ni[nñ]o\b|\bthunderstorms?\b|\blightning\b|\brainstorms?\b|\bpower (outage|went out)\b|\blost power\b|\bwindstorms?\b|\bsanta anas?\b|\bdiablo winds?\b/, 3.5],
  ],
  heat: [
    [/\bheat\b|\bheat ?waves?\b|\bhottest\b|\bscorching\b|\btriple digits\b|\b1[01]\d degrees\b|\bair condition\w*|\ba\/?c\b|\bswamp cooler\b|\bdry heat\b|\brecord high\b/, 3.5],
    [/\bhow hot (does it|do|can) (it )?get\b|\bhow hot is it in the summer\b|\bsummers? (here|like)\b/, 4], [/\bhot\b|\bsummer\b/, 1.2],
  ],
  housing: [
    [/\bhousing\b|\bhouse prices\b|\bhome prices\b|\bhome values?\b|\breal estate\b|\bmortgages?\b|\bafford(able|ability)?\b|\bcost of living\b|\bbuy(ing)? (a|a house|a home|a place)\b|\bproperty tax(es)?\b|\bgentrif\w*|\bhomeowners?\b|\bhoa\b|\bhousing market\b|\bbuild more\b|\bnew (apartments|construction|development)\b|\bzoning\b/, 3.5],
    [/\bexpensive (here|to live)\b|\b(so|too) expensive\b|\bprices\b/, 2],
  ],
  rent: [[/\brent(s|ing|er|ers)?\b|\blandlords?\b|\blease\b|\beviction\b|\btenants?\b|\bsecurity deposit\b|\brent control\b/, 4]],
  insurance: [[/\binsurance\b|\binsurer\w*|\binsured\b|\bpremiums?\b|\bfair plan\b|\bnon-?renew\w*|\bdropped (us|me|my|our|people)\b|\bdeductible\b|\bunderwrit\w*|\bcoverage\b/, 4.5]],
  earthquake: [[/\bearthquakes?\b|\bquakes?\b|\bshaking\b|\btremors?\b|\baftershocks?\b|\bfault( lines?)?\b|\bsan andreas\b|\bthe big one\b|\bseismic\b|\bmagnitude\b|\bretrofit\w*|\bnorthridge\b|\bloma prieta\b/, 4.5]],
  food: [
    [/\b(food|restaurants?|hungry|lunch|dinner|breakfast|brunch|tacos?|burritos?|pho|pizza|burgers?|sushi|bbq|barbecue|coffee|bakery|dessert|snacks?|cuisine|dishes|cook(ing)?|recipes?|eat|eating|taqueria|noodles|dumplings|boba)\b/, 3],
    [/\bwhere (should|can|do) (i|we|you) eat\b|\bgood place to eat\b|\bbest (tacos?|burgers?|pizza|food|place to eat|restaurant)\b|\bfavou?rite food\b|\bwhat should i eat\b/, 4.5],
  ],
  place: [
    [/\bwhat should i (see|do|visit|check out)\b|\bthings to do\b|\bwhat (is there )?to do\b|\bwhere should i go\b|\bworth (seeing|visiting|a visit|checking out)\b|\bplaces to (go|visit|see|hang out)\b|\bsights(eeing)?\b|\btourist\b|\battractions?\b|\bday trip\b|\bhidden gems?\b|\bfun (place|spot|stuff)\b|\bdate (night|spot)\b/, 4],
    [/\b(hike|hiking|trails?|beach(es)?|parks?|museums?|views?|scenic|lake|go out|hang out)\b/, 2], [/\brecommend\b|\bsuggest\b/, 1.5],
  ],
  directions: [
    [/\bhow (do|can|would|should) (i|you|we|one) get (to|there)\b|\bhow to get to\b|\bdirections?\b|\bwhich way\b|\bhow far\b|\bis it far\b|\bfar from here\b|\bget to\b|\bway to\b|\bhow long (does it take|to drive|to get)\b/, 4],
    [/\bwhere (is|are|'s)\b|\bwhere'?s\b|\bnearest\b|\bclosest\b|\bclose by\b|\bnear here\b/, 2.5],
  ],
  history: [
    [/\bhistory\b|\bremember\b|\bmemories\b|\bmemory\b|\bback in the day\b|\bused to be\b|\bthe old days\b|\byears ago\b|\bwhen you were (young|a kid|little|growing up)\b|\bhas it changed\b|\bchanged\b|\bgrowing up\b|\bthe past\b|\bold times\b|\bwhat happened\b|\bback then\b/, 3],
    [/\b(18[5-9]\d|19\d\d|20[0-2]\d)\b/, 1.5],
  ],
  opinion: [
    [/\bwhat do you think (of|about)\b|\bhow do you feel about\b|\byour (opinion|take|thoughts) (on|about)\b|\bthoughts on\b|\bwhat'?s your take\b|\bdo you think\b|\bopinion\b|\bshould (they|we|the city|the state)\b|\bare you (for|against)\b/, 3],
    [/\bpolitics\b|\bpolitical\b|\bpresident\b|\belections?\b|\bvot(e|ing)\b|\bdemocrats?\b|\brepublicans?\b|\bgovernor\b|\bcongress\b|\bsenator\b|\bliberal\b|\bconservative\b|\bthe government\b/, 4],
    [/\breligio\w*|\bgod\b|\bchurch\b|\bpray\w*|\bfaith\b|\bbelieve in\b/, 3], [/\bwhat do you think of me\b|\bdo you like me\b|\bam i (annoying|boring|nice)\b/, 4.5],
  ],
  compliment: [],
  insult: [],
  joke: [[/\b(tell|know|got|have|hear(d)?) (me )?(a |any |another |some |your best )?jokes?\b|\bmake me laugh\b|\bsay something funny\b|\bfunny story\b|\btell me something funny\b|\bjoke\b/, 5]],
  thanks: [[/\b(thanks|thank you|thank u|thx|ty|cheers|appreciate (it|that|you|this)|much appreciated|gracias|salamat)\b/, 3]],
  apology: [[/\b(sorry|my bad|apologi[sz]e|apologies|forgive me|didn'?t mean (to|it)|i was (rude|wrong|out of line)|that was (rude|mean))\b/, 3]],
  smalltalk: [
    [/\bwhat are you (up to|doing)\b|\bwhat'?re you (up to|doing)\b|\bwhat'?s new\b|\banything new\b|\bhow was your (weekend|day|morning)\b|\bplans (for|this) (the )?(weekend|tonight|today)\b|\bbusy (day|today)\b|\bwhat brings you\b|\bwhere are you (going|headed|off to)\b|\bwhat'?s going on\b/, 4],
    [/\b(game|games|team|season|playoffs?|sports?|baseball|basketball|football|soccer|hockey|dodgers|giants|lakers|warriors|49ers|niners|rams|padres|angels|kings|sharks|clippers|chargers|ducks|galaxy|lafc|a'?s|fresno state|ucla|usc)\b/, 3],
  ],
};

const MORE = /^(and|so)?\s*(tell me more|more|go on|keep going|really|seriously|why|why not|how so|what happened( next| then)?|and then|then what|like what|such as|for example|oh yeah|is that right|wow|huh|interesting|no way|what do you mean|how come|what else|anything else|and)\s*[?!.]*$/;
const YES = /^(yes|yeah|yep|yup|sure|of course|definitely|absolutely|i do|i am|i have|uh huh|mhm|si|sí|correct|right|totally|kind of|sort of|a little)\b/;
const NO = /^(no|nope|nah|not really|not at all|i don'?t|i'?m not|i haven'?t|never|negative)\b/;

const ROUTINE_WORDS = [
  [/\bthe beach\b|\bbeach\b/, 'beach'], [/\bthe park\b|\ba park\b/, 'park'], [/\bgrocery( store)?\b|\bsupermarket\b|\bthe store\b|\bmarket\b/, 'grocery'],
  [/\bpharmacy\b|\bdrug ?store\b/, 'pharmacy'], [/\blaundromat\b|\blaundry\b/, 'laundromat'], [/\bhardware store\b/, 'hardware'],
  [/\bpost office\b/, 'post-office'], [/\bgym\b/, 'gym'], [/\bchurch\b/, 'church'], [/\bstadium\b|\bballpark\b|\barena\b|\bthe game\b/, 'game'],
  [/\btrail(head)?s?\b|\bhik(e|ing)\b/, 'trail'], [/\bthe lake\b|\bthe bay\b|\bthe river\b|\bthe reservoir\b/, 'water'], [/\bdowntown\b|\bcity center\b/, 'downtown'],
  [/\bthe freeway\b|\bthe highway\b/, 'freeway'],
];

// Names of places that are also common words: they count only when capitalized in what the player typed.
const COMMON_PLACE_WORDS = new Set('industry commerce paradise orange bell alpine bishop cypress highland imperial marina needles paramount weed winters woodland vista ocean home hope corona mountain ranch lakeside fortuna sunset clearlake avenal reedley rio dell fairfield coalinga'.split(' '));

const nameIndexes = new WeakMap();

/** A statewide index of place names for entity matching: Census places, ZIP mailing cities, counties, the gazetteer. */
function nameIndex(world) {
  let idx = nameIndexes.get(world);
  if (idx) return idx;
  const map = new Map();
  const add = (name, entry) => {
    const k = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!k || k.length < 3) return;
    let list = map.get(k);
    if (!list) map.set(k, list = []);
    list.push(entry);
  };
  for (const p of world.places) add(p.name, { kind: 'town', name: p.name, x: p.x, y: p.y, pop: p.pop });
  const cities = new Map();
  for (let i = 0; i < world.N; i++) {
    const c = world.z.city[i];
    if (!c) continue;
    const have = cities.get(c);
    const pop = num(world.z.pop[i], 0);
    if (!have) cities.set(c, { name: c, xs: world.z.tx[i] * pop, ys: world.z.ty[i] * pop, pop, zi: i });
    else { have.xs += world.z.tx[i] * pop; have.ys += world.z.ty[i] * pop; have.pop += pop; }
  }
  for (const c of cities.values()) {
    const k = c.name.toLowerCase();
    if (map.has(k) && map.get(k).some(e => e.kind === 'town')) continue;
    add(c.name, { kind: 'town', name: c.name, x: c.pop > 0 ? c.xs / c.pop : world.z.tx[c.zi], y: c.pop > 0 ? c.ys / c.pop : world.z.ty[c.zi], pop: c.pop });
  }
  for (const c of world.counties) {
    const zs = world.zipsOfCounty(c.index);
    let xs = 0, ys = 0, p = 0;
    for (const i of zs) { const w = num(world.z.pop[i], 0) + 1; xs += world.z.tx[i] * w; ys += world.z.ty[i] * w; p += w; }
    if (p > 0) add(`${c.name} County`, { kind: 'county', name: `${c.name} County`, x: xs / p, y: ys / p, pop: p });
  }
  for (const g of world.gaz) add(g.name, { kind: 'landmark', name: g.name, gkind: g.kind, rank: g.rank, x: g.x, y: g.y });
  // what people call a few mountains
  const alias = { 'mount baldy': 'Mount San Antonio', 'mt baldy': 'Mount San Antonio', 'mt. baldy': 'Mount San Antonio', saddleback: 'Santiago Peak', lassen: 'Lassen Peak', 'mt diablo': 'Mount Diablo', 'mt. diablo': 'Mount Diablo', 'mt shasta': 'Mount Shasta', 'mt. shasta': 'Mount Shasta', 'mt whitney': 'Mount Whitney', 'mt. whitney': 'Mount Whitney', 'mt tam': 'Mount Tamalpais', 'mount tam': 'Mount Tamalpais' };
  for (const [a, real] of Object.entries(alias)) { const hit = map.get(real.toLowerCase()); if (hit) for (const e of hit) add(a, Object.assign({}, e, { said: a })); }
  let maxWords = 1;
  for (const k of map.keys()) maxWords = Math.max(maxWords, k.split(' ').length);
  idx = { map, maxWords: Math.min(maxWords, 6) };
  nameIndexes.set(world, idx);
  return idx;
}

/** Places named in a text: [{kind: 'town'|'county'|'landmark', name, x, y, said}], nearest instance of each name. */
export function findPlaces(world, text, from = null) {
  const idx = nameIndex(world);
  const raw = String(text || '');
  const tokens = [...raw.matchAll(/[A-Za-z][A-Za-z.'-]*/g)].map(m => ({ w: m[0].toLowerCase().replace(/[.]$/, ''), cap: /^[A-Z]/.test(m[0]) }));
  const out = [];
  const used = new Set();
  for (let i = 0; i < tokens.length; i++) {
    for (let n = Math.min(idx.maxWords, tokens.length - i); n >= 1; n--) {
      if ([...Array(n).keys()].some(k => used.has(i + k))) continue;
      const phrase = tokens.slice(i, i + n).map(x => x.w).join(' ');
      const list = idx.map.get(phrase);
      if (!list) continue;
      if (n === 1 && COMMON_PLACE_WORDS.has(phrase) && !tokens[i].cap) continue;
      if (n === 1 && phrase.length < 4) continue;
      let best = list[0];
      if (from && list.length > 1) best = list.slice().sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      out.push(Object.assign({ said: phrase }, best));
      for (let k = 0; k < n; k++) used.add(i + k);
      break;
    }
  }
  return out;
}

const ROAD_RE = /\b(?:(i|interstate|us|u\.s\.|sr|ca|state route|route|highway|hwy)[-\s.]*(\d{1,3})|the (\d{1,3})(?!\s*(?:degrees|percent|years?|minutes?|miles?|mph|people|dollars|bucks|°|%))\b|(pch|pacific coast highway))\b/gi;

/** Highways named in a text: [{route, kind|null}]. "the 405", "I-80", "Highway 99", "PCH". */
export function findRoads(text) {
  const out = [];
  for (const m of String(text || '').matchAll(ROAD_RE)) {
    if (m[4]) { out.push({ route: 1, kind: 'SR' }); continue; }
    const route = +(m[2] || m[3]);
    if (!(route > 0 && route < 1000)) continue;
    const pre = (m[1] || '').toLowerCase();
    const kind = /^i|interstate/.test(pre) ? 'I' : /^u/.test(pre) ? 'US' : /^(sr|ca|state)/.test(pre) ? 'SR' : null;
    out.push({ route, kind });
  }
  return out;
}

const INTEREST_WORDS = [
  [/\bsurf(ing|er)?\b/, 'surfing'], [/\bhik(e|ing)\b/, 'hiking'], [/\bfish(ing)?\b/, 'fishing'], [/\bgarden(ing)?\b/, 'gardening'], [/\bcook(ing)?\b/, 'cooking'],
  [/\bgolf(ing)?\b/, 'golf'], [/\brun(ning)?\b|\bjog(ging)?\b/, 'running'], [/\bski(ing)?\b|\bsnowboard(ing)?\b/, 'skiing'], [/\bread(ing)?\b|\bbooks?\b/, 'reading'],
  [/\bbik(e|ing)\b|\bcycl(e|ing)\b/, 'biking'], [/\bhunt(ing)?\b/, 'hunting'], [/\bvideo games?\b|\bgaming\b|\bgames\b/, 'gaming'], [/\bmusic\b|\bconcerts?\b/, 'music'],
  [/\bchurch\b/, 'church'], [/\btennis\b/, 'tennis'], [/\bsoccer\b/, 'soccer'], [/\bbasketball\b/, 'basketball'], [/\bskat(e|ing|eboard\w*)\b/, 'skateboarding'],
  [/\bwine\b/, 'wine'], [/\bbeach\b/, 'beach'], [/\btravel(ing)?\b/, 'travel'], [/\bcamp(ing)?\b/, 'camping'], [/\bswim(ming)?\b/, 'swimming'],
  [/\bsail(ing)?\b/, 'sailing'], [/\bphoto(graphy|s)?\b/, 'photography'], [/\bcars?\b|\bcar shows?\b/, 'cars'], [/\bbirds?\b|\bbirdwatching\b/, 'birdwatching'],
];

/**
 * Read the player's line.
 * @param {string} text
 * @param {{world?: object, mind?: object, home?: {x: number, y: number}, fires?: Array<{name: string}>, lastIntent?: string|null, pending?: string|null}} [ctx]
 * @returns {{text: string, norm: string, intent: string, scores: Record<string, number>, question: boolean,
 *   flags: {greeted: boolean, thanked: boolean, apologized: boolean, complimented: boolean, opinion: boolean, more: boolean,
 *   yes: boolean, no: boolean, short: boolean, politics: boolean, religion: boolean, aboutPlayer: boolean},
 *   topics: string[], entities: {years: number[], fires: object[], roads: object[], places: object[], routine: string[], interest: string|null, team: string|null},
 *   appraisal: {sentiment: number, intents: string[], topics: string[], toxicity: number, facts: Array<{key: string, value: string}>}}}
 */
export function understand(text, ctx = {}) {
  const raw = String(text == null ? '' : text).trim();
  const norm = raw.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
  const ap = ctx.mind && typeof ctx.mind.appraise === 'function' ? ctx.mind.appraise(raw) : mindAppraise(raw);
  const scores = {};
  for (const [intent, pats] of Object.entries(P)) {
    let s = 0;
    for (const [re, w] of pats) if (re.test(norm)) s += w;
    if (s > 0) scores[intent] = s;
  }
  const AI = new Set(ap.intents);
  if (AI.has('insult') || ap.toxicity >= 0.45) scores.insult = 8 + ap.toxicity;
  if (AI.has('compliment')) scores.compliment = Math.max(scores.compliment || 0, 3.2);
  if (AI.has('farewell')) scores.goodbye = Math.max(scores.goodbye || 0, 3.5);
  if (AI.has('thanks')) scores.thanks = Math.max(scores.thanks || 0, 3);
  if (AI.has('greeting')) scores.greeting = Math.max(scores.greeting || 0, 2.5);
  if (AI.has('apology')) scores.apology = Math.max(scores.apology || 0, 3);
  if (ap.facts.some(f => f.key === 'name')) scores.name = Math.max(scores.name || 0, 4);
  const question = /\?/.test(raw) || /^(who|what|when|where|why|how|which|whose|do|does|did|is|are|was|were|can|could|would|will|should|have|has|any|anything|ever|you)\b/.test(norm);

  // entities
  const from = ctx.home || null;
  const places = ctx.world ? findPlaces(ctx.world, raw, from) : [];
  const roads = findRoads(raw);
  const years = [...norm.matchAll(/\b(18[5-9]\d|19\d\d|20[0-2]\d)\b/g)].map(m => +m[1]);
  const fires = (ctx.fires || []).filter(f => {
    const n = String(f.name || '').toLowerCase().replace(/\s+(fire|complex)$/, '');
    if (!n || n.length < 3) return false;
    const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return re.test(norm) && (n.length >= 6 || /\bfires?\b|\bcomplex\b/.test(norm));
  });
  const routine = ROUTINE_WORDS.filter(([re]) => re.test(norm)).map(([, k]) => k);
  const interestHit = INTEREST_WORDS.find(([re]) => re.test(norm));
  const teamHit = /\b(dodgers|giants|lakers|warriors|49ers|niners|rams|padres|angels|kings|sharks|clippers|chargers|ducks|galaxy|lafc|a'?s|fresno state|ucla|usc|san diego fc)\b/.exec(norm);
  if (fires.length) scores.fire = (scores.fire || 0) + 3;
  if (places.length && scores.directions) scores.directions += 2;
  if (roads.length) scores.traffic = (scores.traffic || 0) + 1.5;

  const flags = {
    greeted: !!scores.greeting, thanked: !!scores.thanks, apologized: !!scores.apology, complimented: !!scores.compliment,
    opinion: !!(scores.opinion && /\bwhat do you think|\bhow do you feel|\bopinion|\bthoughts|\btake on\b|\bdo you think\b|\bdo you like\b/.test(norm)),
    more: MORE.test(norm), yes: YES.test(norm), no: NO.test(norm), short: norm.split(' ').length <= 4,
    politics: /\bpolitics\b|\bpolitical\b|\bpresident\b|\belections?\b|\bvot(e|ing)\b|\bdemocrats?\b|\brepublicans?\b|\bgovernor\b|\bcongress\b|\bsenator\b|\bliberal\b|\bconservative\b/.test(norm),
    religion: /\breligio\w*|\bgod\b|\bpray\w*|\bfaith\b|\bbelieve in\b|\bchurch\b/.test(norm),
    aboutPlayer: /\bwhat do you think of me\b|\bdo you like me\b|\bam i (annoying|boring|nice)\b/.test(norm),
  };

  // resolve combinations the way a person hears them
  const ranked = INTENTS.filter(k => scores[k] > 0).sort((a, b) => scores[b] - scores[a] || INTENTS.indexOf(a) - INTENTS.indexOf(b));
  let intent = ranked[0] || 'unknown';
  const topical = ranked.filter(k => TOPICAL.has(k) && k !== 'opinion' && k !== 'smalltalk');
  const strongest = k => (scores[k] || 0);
  if (intent === 'greeting' && ranked.length > 1) intent = ranked[1];
  if (intent === 'thanks' && scores.goodbye) intent = 'goodbye';
  if (intent === 'opinion' && topical.length && !flags.politics && !flags.aboutPlayer && !(flags.religion && !topical.some(k => strongest(k) >= 3))) intent = topical[0];
  if (intent === 'compliment' && question && topical.length && strongest(topical[0]) >= 3) intent = topical[0];
  if ((intent === 'apology' || intent === 'thanks') && topical.length && strongest(topical[0]) >= 3.5 && question) intent = topical[0];
  if (intent === 'directions' && !places.length && !routine.length && !roads.length) {
    // "where is it?", "where do you go" without a destination: the next best reading
    const next = ranked.find(k => k !== 'directions');
    if (next && strongest(next) >= 2.5) intent = next;
  }
  if (intent === 'place' && routine.length && scores.directions >= 2.5) intent = 'directions';
  if (intent === 'housing' && scores.rent >= 4) intent = 'rent';
  if (intent === 'weather' && scores.heat >= 3.5 && !/\b(today|now|right now|outside|out there)\b/.test(norm)) intent = 'heat';
  if (intent === 'about-them' && /\bwho are you\b/.test(norm) && !/\babout\b/.test(norm)) intent = 'name';
  if (flags.more && ctx.lastIntent && TOPICAL.has(ctx.lastIntent) && ranked.every(k => strongest(k) < 3)) intent = ctx.lastIntent;
  if (!ranked.length && ctx.lastIntent && flags.more) intent = ctx.lastIntent;

  const topics = new Set(ap.topics);
  const TOPIC_OF = { weather: 'weather', heat: 'weather', storm: 'weather', traffic: 'traffic', fire: 'fire', housing: 'housing', rent: 'rent', insurance: 'insurance', job: 'job', family: 'family', food: 'food', neighborhood: 'neighborhood', history: 'history', earthquake: 'neighborhood', home: 'housing' };
  if (TOPIC_OF[intent]) topics.add(TOPIC_OF[intent]);
  if (teamHit) topics.add('sports');
  return {
    text: raw, norm, intent, scores, question, flags,
    topics: [...topics],
    entities: { years, fires, roads, places, routine, interest: interestHit ? interestHit[1] : null, team: teamHit ? teamHit[1] : null },
    appraisal: { sentiment: num(ap.sentiment, 0), intents: ap.intents.slice(), topics: ap.topics.slice(), toxicity: num(ap.toxicity, 0), facts: ap.facts.slice() },
  };
}

export { isNum };
