// Legion · dialogue · understand: what the player said.
//
// The player's line becomes an intent (one of INTENTS), a few flags (a question, a greeting or thanks riding along,
// "tell me more", a yes or a no), the mind's appraisal (sentiment, toxicity, the facts they gave about
// themselves) and entities: places (Census places, ZIP mailing cities, counties, the gazetteer's peaks, ranges,
// waters and valleys), the routine places everyone has (the beach, the park, the grocery store), highways, years,
// the ZIP's fires by name, interests and teams. Intents come from weighted patterns; the strongest wins, with a
// fixed priority breaking ties, and a few combinations resolve the way a person would hear them ("hi, how are
// you?" is a how-are-you, "what do you think about the rent?" is about rent). A line in Spanish is read through an
// English paraphrase of its common phrases (spanish.mjs; flags.spanish tells the conversation it was Spanish); a hello
// in another language is a greeting (entities.foreignLangs); a holiday named in a wish or a question about plans is
// entities.holiday, with flags.holidayGreeting or flags.holidayAsk.
//
// Two more readings matter as much as the intent. A probe (probe.mjs) is a line that generalizes about a group of
// people, asks about someone's immigration status or tells them to leave: intent 'probe', or 'insult' when it is
// hostile, never a question to shrug at. And a follow-up ("how old are they?", "which hospital?", "what about
// tomorrow?") is read against the topic the conversation is on (ctx.lastIntent) and marked with the part of the
// topic it asks about (flags.sub), so the NPC answers from their own life instead of claiming not to know it. The
// speaker's own words (ctx.self: their job title and workplace, their interests, the worries the persona lists)
// steer a line that names them to the matching planner.

import { appraise as mindAppraise } from '../mind.mjs';
import { num } from './core.mjs';
import { probeOf, asksHeritage, asksDemographic } from './probe.mjs';
import { safetyOf } from './safety.mjs';
import { spanishReading } from './spanish.mjs';
import { holidayOf } from './holiday.mjs';
import { LANGUAGES, LANGUAGE_KEYS } from '../lexicon.mjs';

/**
 * A text with its accents and other combining marks removed ("días" → "dias", "carísimo" → "carisimo"), so the
 * English patterns, whose \b is ASCII, see whole words. Letters of other scripts pass through.
 * @param {string} s
 * @returns {string}
 */
export function foldAccents(s) {
  return String(s || '').normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC');
}

// Interests that are family ("the grandkids"): a question about them is a question about the family.
const FAMILY_INTEREST = /\b(grandkids|grandchildren|kids|children|family|baby)\b/i;

/** Every intent the engine understands, in tie-breaking priority order (earlier wins a tie). */
export const INTENTS = Object.freeze([
  'safety', 'insult', 'probe', 'goodbye', 'about-me', 'name', 'joke', 'directions', 'insurance', 'earthquake', 'fire', 'storm', 'rent', 'heat',
  'housing', 'traffic', 'weather', 'food', 'place', 'job', 'family', 'home', 'history', 'about-them', 'opinion',
  'neighborhood', 'how-are-you', 'compliment', 'thanks', 'apology', 'smalltalk', 'greeting', 'unknown',
]);

/** Intents that are about a subject (they take "tell me more" and opinions). */
export const TOPICAL = Object.freeze(new Set(['job', 'family', 'home', 'neighborhood', 'weather', 'traffic', 'fire', 'storm', 'heat', 'housing', 'rent', 'insurance', 'earthquake', 'food', 'place', 'directions', 'history', 'about-them', 'opinion', 'smalltalk']));

// A word list as a pattern whose edges are letters in any script, not ASCII \b: an accented letter ("días") is a
// letter, so "as" is never found inside it.
const uword = (src, flags = 'u') => new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`, flags);

// Teams and sports talk. The Athletics are "the A's" or "the Athletics", never a bare "as".
const TEAM_WORDS = "dodgers|giants|lakers|warriors|49ers|niners|rams|padres|angels|kings|sharks|clippers|chargers|ducks|galaxy|lafc|a's|athletics|fresno state|ucla|usc|san diego fc";
const SPORT_TALK = uword(`game|games|team|season|playoffs?|sports?|baseball|basketball|football|soccer|hockey|${TEAM_WORDS}`);
const TEAM_HIT = uword(TEAM_WORDS);

// Dishes and places to eat people ask about across the state, from tamales and pupusas to dim sum and tri-tip.
const FOOD_WORDS = 'food|restaurants?|hungry|lunch|dinner|breakfast|brunch|tacos?|taquer[ií]as?|burritos?|tamales?|pupusas?|pupuser[ií]as?|tortas?|birria|menudo|pozole|carnitas|al pastor|'
  + 'elotes?|churros?|pan dulce|panader[ií]as?|enchiladas?|quesadillas?|nachos|mariscos|ceviche|pho|banh mi|ramen|udon|sushi|dim sum|dumplings|noodles|boba|hot ?pot|'
  + 'korean bbq|kbbq|bulgogi|lumpia|adobo|pancit|poke|curry|thai food|kebabs?|falafel|shawarma|pizza|burgers?|hot dogs?|sandwich(?:es)?|delis?|bagels?|donuts?|doughnuts?|'
  + 'bbq|barbecue|tri-?tip|steaks?|steakhouses?|fried chicken|wings|seafood|crab|oysters?|clam chowder|fish and chips|diners?|cafes?|caf[eé]s?|coffee|bakery|bakeries|'
  + 'dessert|ice cream|gelato|frozen yogurt|snacks?|cuisine|dishes|cook(?:ing)?|recipes?|eat|eating|eats|grub|beers?|brewery|breweries|brewpubs?|wine bars?|food trucks?|taco trucks?';

// [pattern, weight]; a pattern counts once per message.
const P = {
  goodbye: [
    [/\b(bye|goodbye|good bye|bye bye|bye-bye|farewell|so long|peace out|adi[oó]s|ciao|later,? (man|dude|bro|friend))\b/, 4],
    [/\bsee (you|ya)( (later|soon|around|next time|tomorrow))?\b/, 3.5], [/\bcatch you later\b|\btalk (to you )?(later|soon)\b|\buntil next time\b|\bcya\b|\bttyl\b|\blaters\b/, 3.5],
    [/\b(gotta|got to|have to|need to|should) (go|run|get going|head out|head home|get back|bounce|jet)\b/, 3.5], [/\bi'?m (heading out|off|out of here|leaving|going to go)\b/, 3],
    [/\b(i'?ll|i should|i'd better|i better|let me) let you (go|get back)\b/, 3.5],
    [/\bhave a (good|nice|great|wonderful) (one|day|night|evening|weekend|afternoon)\b/, 3], [/\bgood ?night\b/, 3],
    [/\b(nice|good|great|lovely) (talking|chatting) (to|with) you\b/, 3], [/\btake care\b(?! of)/, 3],
    // "nice meeting you" closes a conversation ("nice to meet you" opens one); "Later!" at the end is goodbye
    [/\b(nice|good|great|lovely|a pleasure|pleasure) (meeting|chatting with|talking with|talking to) (you|ya)\b|\bnice to have met you\b|\bnice chatting\b/, 3.5],
    [/(^|[.!,]\s*)later\s*[!.]*$/, 3.5],
  ],
  greeting: [[/^(hi|hello|hey|heya|hiya|howdy|yo|sup|greetings|hola|good (morning|afternoon|evening|day)|morning|evening|afternoon)\b/, 2.5], [/\b(hi|hello|hey) there\b/, 2.5], [/\bnice to meet you\b/, 1.5]],
  'how-are-you': [
    [/\bhow (are|r) (you|u|ya)( doing| holding up| feeling)?\b/, 3.5], [/\bhow'?s it (going|goin)\b|\bhow is it (going|goin)\b/, 3.5], [/\bhow (you|ya) (doing|doin)\b/, 3.5],
    [/\bhow (is|are) (everything|things|life) going\b|\bhow'?s everything( going)?\b/, 3.5],
    [/\bhow (are|is) (things|everything|life)\b/, 3], [/\bhow'?s (your|ur) (day|week|morning|afternoon|evening|life|night)\b/, 3],
    [/\bhow (have|'ve) you been\b|\bhow you been\b/, 3.5], [/\bwhat'?s up\b|\bwhat'?s good\b|\bsup\b/, 2], [/\b(are )?you (doing )?(ok|okay|alright|all right|good)\s*\??$/, 2.5],
    [/\bhow (do|are) you feel(ing)?\b/, 2.5], [/\bhow'?s (the|your) (mood|energy)\b/, 2.5],
    [/^(?:i'?m |i am )?(?:good|great|fine|okay|ok|alright|all right|not bad|pretty good|doing well|well|tired|busy|so-so)[,.!]* (?:and|how about|what about) (?:you|yourself|u)\b/, 4],
    [/^(?:and|how about|what about) (?:you|yourself|u)\s*[?!.]*$/, 3], [/\bare you (happy|sad|tired|busy|stressed|doing ok|feeling ok|alright)\b/, 3.5],
    // "you look tired", "long day?": a question about how they are, asked by noticing it
    [/\byou (look|seem|sound) (tired|exhausted|beat|wiped( out)?|worn out|stressed|busy|happy|cheerful|down|sad|upset|worried|cold|hot|sleepy|great|good|well)\b/, 3.5],
    [/\b(long|rough|tough|hard|busy|good|bad|crazy|slow) (day|night|shift|week|morning)\s*\?/, 3.2],
  ],
  name: [
    [/\bwhat'?s (your|ur) name\b|\bwhat is (your|ur) name\b|\byour name\b/, 4.5], [/\bwho are you\b/, 3.5], [/\bwhat (do|should|can|shall) i call you\b|\bwhat are you called\b/, 4.5],
    [/\bintroduce yourself\b|\bwe haven'?t met\b/, 3.5], [/\b(do you )?remember my name\b|\bwhat'?s my name\b|\bwho am i\b/, 4.5],
    [/\bmy name'?s\b|\bmy name is\b|\bcall me\b|\bi'?m called\b/, 3],
  ],
  'about-them': [
    [/\btell me (a little |a bit |more )?about (yourself|you)\b|\bwhat'?s your story\b|\bwho are you\b/, 4], [/\bwhere are you from\b|\bwhere('?re| are) you originally from\b|\bwhere (did|do) you (grow up|come from)\b|\bare you from (here|around here|california)\b|\bwere you born (here|in)\b/, 4.5],
    [/\bhow old are you\b|\bwhat'?s your age\b|\byour age\b/, 4.5], [/\bhobb(y|ies)\b|\bfor fun\b|\bwhat are you into\b|\bfree time\b|\bspare time\b|\bon (the )?weekends?\b(?=.*\byou\b)/, 3.5],
    [/\bwhat do you (usually |normally |like to )?do (on|over|during) (the )?weekends?\b|\bwhat do you do on your days? off\b|\bon your days? off\b/, 3.8],
    [/\bwhat do you (usually |normally |like to )?do on (sundays|saturdays|sunday|saturday)\b|\bwhat are your sundays like\b/, 4.4],
    [/\bare you an immigrant\b|\bdid you (immigrate|emigrate|move here from)\b|\bwere you born (in (the us|the u\.s\.|america|the states|another country|this country|california)|abroad|overseas)\b/, 4.5],
    [/\bhave you always lived (here|around here|in)\b|\bhave you lived here (your whole|all your) life\b|\bwhen did you (come|immigrate|get here|arrive|move) (to|in) (the us|the u\.s\.|the states|america|this country|california)\b/, 4.6],
    // where they're from and how they came: "did you grow up here?", "what brought you here?", "how long have you been in the US?"
    [/\bdid you grow up (here|around here|in|out here|nearby|close by)\b|\bwere you (born and )?raised (here|in|around here)\b|\bare you (a )?local\b|\bare you from (here|around here|this area|the area|these parts)\b/, 4.6],
    [/\bwhat brought you (here|to|out here|out to|down here|up here|over here)\b|\bwhy did you (move|come) (here|to|out here|out to|down here|up here)\b|\bhow did you (end up|wind up|land|get) (here|in|out here|down here|up here)\b|\bwhen did you (come|get|move) (here|out here|to)\b/, 4.6],
    [/\bhow long have you (been|lived) in (the us|the u\.s\.|the states|america|the united states|this country)\b/, 4.9],
    [/\bwhere did you go to (school|college|high school)\b|\bdid you go to college\b|\bwhat did you study\b|\bdid you finish (school|high school|college)\b|\bhow far did you go in school\b|\byour education\b/, 4.6],
    [/\bdo you (like to |ever |still )?(surf|hike|fish|garden|cook|golf|run|ski|snowboard|read|bike|swim|camp|hunt|paint|draw|dance|sing|game|play|skate|travel|sail|knit|bake)\b/, 3.5],
    [/\bdo you (have|keep|grow) (a |any )?(garden|vegetable garden|veggie garden)\b/, 3.8],
    [/\bare you (a |an )?(morning person|night owl|early riser|early bird|night person)\b/, 4.5],
    [/\bhave you (ever )?been (back )?to (mexico|el salvador|guatemala|honduras|nicaragua|the philippines|vietnam|china|taiwan|korea|india|iran|armenia|japan|cuba|peru|colombia)\b/, 4.5],
    [new RegExp(`\\bare you (a|an) [a-z0-9']+ fan\\b|\\bdo you (follow|watch|root for|like) (the )?[a-z0-9']+\\b(?=.*(?<![\\p{L}\\p{N}])(game|team|season|sports?|${TEAM_WORDS})(?![\\p{L}\\p{N}]))`, 'u'), 3],
    [/\bwhat do you (like|love|enjoy)( to do)?\b/, 2.5], [/\b(tell me|talk) about (your life|yourself)\b/, 4],
  ],
  job: [
    [/\bwhat do you do\b(?! for fun| on (?:the |your )?(?:weekends?|days? off|sundays?|saturdays?)| in your free| when| around here| here for fun)/, 4.5], [/\bwhere do you work\b|\bwhat'?s your job\b|\bwhat kind of work\b|\bwhat (line|kind) of (work|business)\b/, 4.5],
    [/\b(your )?(jobs?|career|occupation|profession|boss|shift|shifts|coworkers?|employer|paycheck)\b/, 2.5], [/\bfor a living\b|\bwork(ing)? (today|tomorrow|tonight|nights|from home|remotely)\b/, 3],
    [/\b(retired|retire|retirement|unemployed|laid off|looking for work|between jobs)\b/, 2.5], [/\bdo you work\b|\bare you working\b|\byou work\b/, 3],
    [/\bwhat grade\b|\bwhat school\b|\bdo you go to school\b|\b(school|class|classes|teacher|homework|college|university|major|studying|recess|semester)\b/, 2.5],
    [/\bare you working today\b|\bdo you (have to )?work today\b|\bare you off today\b|\b(your|a) day off today\b|\bworking today\b/, 4.6],
    // "is your work hard?": their work, whatever the talk was about before
    [/\b(your|the) (work|job)\b/, 3.6],
    // "do you own a nail salon?", "do you work at a liquor store?": a question about their work, answered with the job they have
    [/\bdo you (own|run|manage|have|work (at|in|for)) (a|an|the|your own) [a-z' ]{0,20}?(salon|store|shop|restaurant|business|motel|hotel|bakery|market|gas station|farm|ranch|company|garage|clinic|practice|cafe|food truck|taco truck)\b/, 4.6],
  ],
  family: [
    [/\b(family|families|kids?|children|child|sons?|daughters?|wife|husband|spouse|parents|mom|dad|mother|father|grandkids|grandchildren|grandsons?|granddaughters?|siblings?|brothers?|sisters?|babies|baby|grandma|grandpa|grandmother|grandfather|cousins?|aunts?|uncles?|nephews?|nieces?|in-laws?)\b/, 3],
    [/\bare you married\b|\bmarried\b|\bsingle\b|\bdating\b|\bboyfriend\b|\bgirlfriend\b/, 3], [/\bwho do you live with\b|\blive alone\b|\bdo you have kids\b|\bany kids\b/, 4],
  ],
  home: [
    [/\bwhere do you live\b|\bwhere'?s your (house|place|home)\b/, 4.5], [/\b(your|ur) (house|home|place|apartment|street|yard|garden|roof|building)\b/, 3],
    [/\bdo you (own|rent)\b|\bown or rent\b/, 4], [/\bhow long have you (lived|been living|been) (here|in|around)\b|\bhow long have you lived\b/, 4.5],
    [/\b(live|living) (here|around here|nearby|close by|in this (area|neighborhood|town))\b/, 3], [/\bwhen did you move\b|\bmoved? here\b/, 3.5],
    [/\bhave you (lived|been living|been) (here|around here|in town|in the area|in [a-z .']{2,24}?) (long|a long time|for long|for a while|very long|your whole life|all your life)\b/, 4.7],
    [/\bdo you live (out |around |over |up |down |right )?(here|there|nearby|close by|close|near here|in (town|the area|this area|this neighborhood))\b/, 4.6],
  ],
  neighborhood: [
    [/\bneighbou?rhoods?\b|\bneighbou?rs?\b|\bthis (area|town|city|place|block|part of town|street)\b|\baround here\b|\bthe area\b|\bcommunity\b/, 2.5],
    [/\bwhat'?s (it|life) like (living |to live |growing up )?(here|in|around)\b/, 4], [/\bwhat'?s [a-z .'-]{2,28} like\s*\??$/, 2.5], [/\bis it (safe|nice|good|quiet|loud|busy|walkable|friendly)\b/, 3],
    [/\bdo you like (it )?(here|living here|this place|the area|this town|this neighborhood)\b/, 4], [/\b(best|worst) (thing|part)( about)?\b/, 3.5],
    [/\bpeople (here|around here)\b|\bwho lives (here|around here)\b|\bwhat language\b|\bspeak spanish\b/, 3],
  ],
  weather: [
    [/\b(weather|forecast)\b/, 1.5],
    [/\b(weather|forecast|temperature|degrees|rain|raining|rainy|sunny|cloudy|clouds|fog|foggy|marine layer|june gloom|may gray|windy|breezy|chilly|freezing|snowing|humid|humidity|umbrella|jacket weather|sweater weather|drizzle)\b/, 3],
    [/\bhot (today|out|outside|enough)\b|\bwarm (today|out)\b|\bcold (today|out|outside)\b|\bnice (day|out|weather)\b|\bbeautiful day\b|\bgorgeous day\b/, 3],
    [/\b(wind|cold|snow|sun)\b/, 1.5], [/\bwill it rain\b|\bis it going to (rain|be hot|be cold)\b|\bwhat'?s it like out\b/, 3.5],
    [/\bhow'?s the air\b|\bair quality\b|\bthe air (like|today|here)\b|\bsmog\b|\baqi\b/, 4],
  ],
  traffic: [
    [/\b(traffic|commute|commuting|freeways?|highways?|rush hour|carpool|gridlock|congestion|sigalert|parking)\b/, 3],
    [/\b(drive|driving|drove|car|cars|bus|buses|train|trains|bart|metro|muni|caltrain|light rail|transit|bike lane|road|roads)\b/, 1.8],
    [/\bthe \d{1,3}\b|\bi-?\s?\d{1,3}\b|\binterstate \d+|\broute \d+|\bhighway \d+|\bhwy \d+|\bpch\b|\bpacific coast highway\b|\b(us|sr) ?-?\d{1,3}\b/, 2.5],
    [/\bhow did you get here\b|\bhow do you get to work\b|\bhow long (is|was) your (drive|commute)\b/, 4],
    // how they get to work or school, and getting around without a car
    [/\bhow do (you|ya) get (to|into) (school|class|work|the office|your job|campus)\b|\bhow do you commute\b|\bdo you (drive|bike|walk|ride|take the bus|take the train|take transit|carpool) to (work|school|class)\b/, 4.5],
    [/\bget(ting)? around\b|\bwithout (a car|driving|wheels)\b|\bpublic transit\b|\bpublic transportation\b/, 3],
    [/\bwhere (can|do|should|could) (i|you|we|people) park\b|\bplace to park\b|\bhard to park\b/, 4],
  ],
  fire: [
    [/\b(wild)?fires?\b|\bsmoke\b|\bsmoky\b|\bevacuat\w*|\bflames?\b|\bembers\b|\bred flag\b|\bcal ?fire\b|\bfirefighters?\b|\bfire season\b|\bcontainment\b|\bblaze\b|\bgo-?bags?\b|\bburn(ed|ing|t)? (down|area|scar)\b|\bburn scar\b|\bdefensible space\b/, 3.5],
    [/\bash\b|\bburned\b|\bburnt\b/, 1.5],
  ],
  storm: [
    // wind as a climate question ("ever get bad wind here?", "how windy does it get?"); "is it windy today?" stays weather
    [/\b(?:bad|strong|big|crazy|high|worst|any|much|real|serious) winds?\b|\bwinds? (?:here|around here|out here)\b|\bhow windy\b|\b(?:get|gets|getting) (?:really |very |pretty |so )?windy\b|\bgusts?\b|\bsundowners?\b|\bwindiest\b/, 3.6],
    [/\bstorms?\b|\bstormy\b|\bfloods?\b|\bflooded\b|\bflooding\b|\batmospheric rivers?\b|\bmudslides?\b|\blandslides?\b|\bdebris flows?\b|\blevees?\b|\bdownpours?\b|\bdeluge\b|\bking tides?\b|\bhigh surf\b|\bel ni[nñ]o\b|\bthunderstorms?\b|\blightning\b|\brainstorms?\b|\bpower (outage|went out)\b|\blost power\b|\bwindstorms?\b|\bsanta anas?\b|\bdiablo winds?\b/, 3.5],
  ],
  heat: [
    [/\bheat\b|\bheat ?waves?\b|\bhottest\b|\bscorching\b|\btriple digits\b|\b1[01]\d degrees\b|\bair condition\w*|\ba\/?c\b|\bswamp cooler\b|\bdry heat\b|\brecord high\b/, 3.5],
    [/\bhow hot (does it|do|can) (it )?get\b|\bhow hot is it in the summer\b|\bsummers? (here|like)\b/, 4], [/\bhot\b|\bsummer\b/, 1.2],
  ],
  housing: [
    [/\bhousing\b|\bhouse prices\b|\bhome prices\b|\bhome values?\b|\breal estate\b|\bmortgages?\b|\bafford(able|ability)?\b|\bcost of living\b|\bbuy(ing)? (a|a house|a home|a place)\b|\bproperty tax(es)?\b|\bgentrif\w*|\bhomeowners?\b|\bhoa\b|\bhousing market\b|\bbuild more\b|\bnew (apartments|construction|development)\b|\bzoning\b/, 3.5],
    [/\bexpensive (here|to live)\b|\bexpensive around here\b|\bcost of living\b|\bafford to live\b/, 4], [/\b(so|too) expensive\b|\bprices\b/, 2],
  ],
  rent: [[/\brent(s|ing|er|ers)?\b|\blandlords?\b|\blease\b|\beviction\b|\btenants?\b|\bsecurity deposit\b|\brent control\b/, 4]],
  insurance: [[/\binsurance\b|\binsurer\w*|\binsured\b|\bpremiums?\b|\bfair plan\b|\bnon-?renew\w*|\bdropped (us|me|my|our|people)\b|\bdeductible\b|\bunderwrit\w*|\bcoverage\b/, 4.5]],
  earthquake: [[/\bearthquakes?\b|\bquakes?\b|\bshaking\b|\btremors?\b|\baftershocks?\b|\bfault( lines?)?\b|\bsan andreas\b|\bthe big one\b|\bseismic\b|\bmagnitude\b|\bretrofit\w*|\bnorthridge\b|\bloma prieta\b/, 4.5]],
  food: [
    [new RegExp(`\\b(${FOOD_WORDS})\\b`), 3],
    [/\bwhere (should|can|do) (i|we|you) eat\b|\bgood place to eat\b|\bbest (tacos?|burgers?|pizza|food|place to eat|restaurant)\b|\bfavou?rite food\b|\bwhat should i eat\b/, 4.5],
    // "where can I get tamales?", "any good ramen places?": a dish with a where, a get or a good
    [new RegExp(`\\b(where|get|grab|good|best|great|decent|try|recommend)\\b.*\\b(${FOOD_WORDS})\\b`), 1.5],
  ],
  place: [
    [/\bfun to do\b|\bto do around here\b|\bwhat can (i|we|you) do\b|\bfun (things|stuff|places)\b|\bwhere do people go\b(?! (for|to) (eat|food|dinner|lunch|breakfast|drinks?|coffee|seafood|tacos))/, 4],
    [/\bwhat should i (see|do|visit|check out)\b|\bthings to (do|see)\b|\bwhat (is there )?to do\b|\bwhere should i go\b|\bworth (seeing|visiting|a visit|checking out)\b|\bplaces to (go|visit|see|hang out)\b|\bsights(eeing)?\b|\btourist\b|\battractions?\b|\bday trip\b|\bhidden gems?\b|\bfun (place|spot|stuff)\b|\bdate (night|spot)\b/, 4],
    [/\bwhat'?s there to (do|see)\b|\bwhat is there to (do|see)\b|\b(is there |there'?s )?anything (fun |good )?to (do|see)\b|\bwhat do (people|folks|you guys) do (for fun|around here|here|on (the )?weekends?|at night)\b|\bnightlife\b/, 4.5],
    [/\b(any|good|nice|best|great) (hikes?|hiking|trails?|beach(es)?|parks?|views?|spots? to (hike|swim|surf|fish|camp))\b/, 4],
    [/\b(closest|nearest|next) (big |bigger |real |major )?(town|city)\b|\bbig (town|city) (near|around|close)\b/, 4.5],
    [/\b(go|get|head|drive|come) (in|into|down|up|over)? ?to the city\b|\bgo into (the )?(city|town)\b|\bgo to town\b/, 4.4],
    [/\b(hike|hikes|hiking|trails?|beach(es)?|parks?|museums?|views?|scenic|lake|go out|hang out)\b/, 2], [/\brecommend\b|\bsuggest\b/, 1.5],
  ],
  directions: [
    [/\bhow (do|can|would|should) (i|you|we|one) get (to|there)\b|\bhow to get to\b|\bdirections?\b|\bwhich way\b|\bhow far\b|\bis it far\b|\bfar from here\b|\bget to\b|\bway to\b|\bhow long (does it take|to drive|to get)\b/, 4],
    [/\bwhere (is|are|'s)\b|\bwhere'?s\b|\bnearest\b|\bclosest\b|\bclose by\b|\bnear here\b/, 2.5],
    [/\bwhere (can|do|could|should) (i|you|we|people|one) (buy|get|find|pick up|shop for|go for) (some |my |your )?(groceries|food shopping|medicine|prescriptions|gas|hardware|stuff for the house)\b/, 4.2],
  ],
  history: [
    [/\bhistory\b|\bremember\b|\bmemories\b|\bmemory\b|\bback in the day\b|\bused to be\b|\bthe old days\b|\byears ago\b|\bwhen you were (young|a kid|little|growing up)\b|\bhas it changed\b|\bchanged\b|\bgrowing up\b|\bthe past\b|\bold times\b|\bwhat happened\b|\bback then\b/, 3],
    [/\bwhen you first (came|moved|got|arrived)\b|\bwhat was it like (back then|when you (came|moved|got|arrived|were))\b|\bin the old days\b|\bthe way it (was|used to be)\b/, 4.2],
    [/\b(18[5-9]\d|19\d\d|20[0-2]\d)\b/, 1.5],
  ],
  opinion: [
    [/\bwhat do you think (of|about)\b|\bhow do you feel about\b|\byour (opinion|take|thoughts) (on|about)\b|\bthoughts on\b|\bwhat'?s your take\b|\bdo you think\b|\bopinion\b|\bshould (they|we|the city|the state)\b|\bare you (for|against)\b/, 3],
    [/\bpolitics\b|\bpolitical\b|\bpresident\b|\belections?\b|\bvot(e|ing)\b|\bdemocrats?\b|\brepublicans?\b|\bgovernor\b|\bcongress\b|\bsenator\b|\bliberal\b|\bconservative\b|\bthe government\b/, 4],
    [/\breligio\w*|\bgod\b|\bchurch\b|\bpray\w*|\bfaith\b|\bbelieve in\b|\bare you (a )?(catholic|christian|muslim|jewish|mormon|hindu|buddhist|sikh|religious|atheist|protestant|evangelical)\b/, 3], [/\bwhat do you think of me\b|\bdo you like me\b|\bam i (annoying|boring|nice)\b/, 4.5],
  ],
  compliment: [],
  insult: [],
  joke: [[/\b(tell|know|got|have|hear(d)?) (me )?(a |any |another |some |your best )?jokes?\b|\bmake me laugh\b|\bsay something funny\b|\bfunny story\b|\btell me something funny\b|\bjoke\b/, 5]],
  thanks: [[/\b(thanks|thank you|thank u|thx|ty|cheers|appreciate (it|that|you|this)|much appreciated|gracias|salamat)\b/, 3]],
  apology: [[/\b(sorry|my bad|apologi[sz]e|apologies|forgive me|didn'?t mean (to|it)|i was (rude|wrong|out of line)|that was (rude|mean))\b/, 3]],
  smalltalk: [
    [/\bwhat are you (up to|doing)\b|\bwhat'?re you (up to|doing)\b|\bwhat'?s new\b|\banything new\b|\bhow was your (weekend|day|morning)\b|\bplans (for|this) (the )?(weekend|tonight|today)\b|\bbusy (day|today)\b|\bwhat brings you\b|\bwhere are you (going|headed|off to)\b|\bwhat'?s going on\b/, 4],
    [SPORT_TALK, 3],
  ],
};

// A question about whatever was just said: "is it always like this?", "do you like it?", "is that normal?". It
// continues the topic only when it is short and names no topic of its own ("is it hard to get around without a car?"
// is about getting around, not about the forecast before it).
const ABOUT_THAT = /\b(is it|is that) always like this\b|\balways like this\b|\bis (that|this) (normal|typical|usual)\b|\b(do|how do) you (like|enjoy|love) (it|that|that job|the job|your job|work|school|living here)\b|\bis it (fun|good|hard|nice|tough|stressful)\b|\bwhy is that\b|\bhow come\b/;
const ABOUT_THAT_WORDS = 7;

const MORE = /^(and|so)?\s*(tell me more|more|go on|keep going|really|seriously|why|why not|how so|what happened( next| then)?|and then|then what|like what|such as|for example|oh yeah|is that right|wow|huh|interesting|no way|what do you mean|how come|what else|anything else|and)\s*[?!.]*$/;
const YES = /^(yes|yeah|yep|yup|sure|of course|definitely|absolutely|i do|i am|i have|uh huh|mhm|si|sí|correct|right|totally|kind of|sort of|a little)\b/;
const NO = /^(no|nope|nah|not really|not at all|i don'?t|i'?m not|i haven'?t|never|negative)\b/;

// ------------------------------------------------------------------ follow-ups
// The part of a topic a follow-up asks about. Order matters: the first match wins.
const SUBS = [
  ['names', /\b(?:what are|what'?s|what were) (?:their|his|her|the kids'?|your kids'?|your (?:son|daughter|wife|husband|partner|roommates?|parents|mom|dad|mother|father|brother|sister|siblings|grandkids|grandchildren|grandson|granddaughter|kids|children|grandma|grandpa|grandmother|grandfather)'?s?'?) names?\b|\btheir names\b|\bwhat are they called\b|\bwhat do you call (?:them|him|her)\b/],
  ['ages', /\bhow old (?:are|is|were) (?:they|he|she|them|the kids|your kids|the grandkids|your (?:son|sons|daughter|daughters|boy|girl|wife|husband|partner|mom|dad|mother|father|parents|grandkids|grandchildren|grandson|granddaughter|brother|brothers|sister|sisters|siblings|kids|children|grandma|grandpa|grandmother|grandfather|roommates?))\b|\b(?:their|his|her) ages?\b|\bwhat ages?\b/],
  ['sexes', /\b(?:boys? or girls?|girls? or boys?|sons? or daughters?|daughters? or sons?)\b/],
  ['parentJob', /\bwhat(?:'s| does| do| is)? (?:your )(?:mom|dad|mother|father|mama|papa|parents|folks|old man|old lady) do\b|\bwhat do (?:your )?(?:parents|folks) do\b|\b(?:does|do) (?:your )(?:mom|dad|mother|father|parents|folks) work\b|\bwhere (?:does|do) (?:your )(?:mom|dad|mother|father|parents|folks) work\b/],
  ['partnerJob', /\bwhat does (?:she|he|your (?:wife|husband|partner|spouse)) do\b|\bwhat (?:does|do) (?:she|he|they) do for (?:work|a living)\b|\bdoes (?:she|he|your (?:wife|husband|partner|spouse)) work\b/],
  ['school', /\bwhere do (?:they|the kids|your kids|your grandkids|he|she) go to school\b|\bdo (?:they|the kids|your kids|your grandkids|the grandkids) (?:all )?go to school\b|\bdoes (?:he|she) go to school\b|\bwhat grades? (?:are|is) (?:they|he|she|the kids|your kids)\b|\b(?:are|is) (?:they|he|she|the kids|your kids) in school\b/],
  ['kidsDo', /\bwhat do (?:your |the )?(?:kids|children|sons?|daughters?|grandkids) do\b|\bwhat do they do\b|\bdo (?:your kids|they) work\b/],
  ['farWork', /\bhow far (?:is|away is) (?:your|the) (?:work|job|office|school)\b|\bhow far do you (?:drive|go|commute|travel)\b|\bhow long (?:is|does) (?:your|the) (?:drive|commute)(?: take)?\b|\bhow long does it take you to get to work\b/],
  ['car', /\bwhat (?:kind of |type of )?(?:car|truck|vehicle) do you (?:drive|have)\b|\bdo you (?:have|own) a car\b|\bdo you drive\b/],
  ['days', /\b(?:do you )?work (?:on )?(?:the )?(?:weekends?|saturdays?|sundays?)\b|\bwhat days do you work\b|\bwork every day\b|\b(?:what|when|which) (?:are )?(?:your )?days off\b|\bwhat days (?:are you|do you have) off\b/],
  ['workAt', /\bdo you (?:own|run|manage|have|work (?:at|in|for)) (?:a|an|the|your own) [a-z' ]{0,20}?(?:salon|store|shop|restaurant|business|motel|hotel|bakery|market|gas station|farm|ranch|company|garage|clinic|practice|cafe|food truck|taco truck)\b/],
  ['today', /\bare you working today\b|\bdo you (?:have to )?work today\b|\bare you off today\b|\b(?:your|a) day off today\b|\bworking today\b/],
  ['before', /\bwhat did you do before\b|\bbefore (?:this|that|your) job\b/],
  ['howLong', /\bhow long (?:have|did|has) you\b|\bhow long (?:have you )?been (?:there|doing (?:it|that)|at it|in (?:that|this) (?:job|line of work))\b|\bhow many years\b|\bsince when\b/],
  ['hours', /\bhow early\b|\bwhat time do you (?:start|leave|get up|go in|head out|get off|finish|clock in|wake up)\b|\bwhen do you (?:start|leave|get up|go in|head out|get off|finish|clock in|wake up)\b|\bwhat (?:are )?your hours\b|\bwhat shift\b/],
  ['which', /^(?:and |so |oh,? )?which (?:one|ones|hospital|company|school|store|restaurant|place|office|clinic|firm|shop|farm|plant|warehouse|road|freeway|highway|fire|storm|airport|business|church|team)\b|\bwhich (?:hospital|company|clinic|firm|plant|warehouse|restaurant|store|road|freeway|highway)\b/],
  ['where', /^(?:and |so )?where(?:'s| is| was) (?:it|that|the job|work|the farm|the place)\b|^(?:and |so )?where at\b|\bwhere do you work\b/],
  ['like', /\b(?:do|did) (?:you|ya) (?:like|enjoy|love|hate|mind) (?:it|that|being (?:a|an) [a-z ]+|your (?:job|work)|working (?:there|as [a-z ]+)|the work|the job|what you do)\b|\b(?:is|was) (?:it|the work|the job|your work|your job|that) (?:hard|tough|stressful|fun|good|easy|dangerous|boring|rewarding|tiring)\b|\bhow do you like (?:it|the job|your job|the work)\b/],
  ['pay', /\b(?:does it|do they) pay\b|\bpays? (?:well|good|ok|okay)\b|\bhow much do you (?:make|earn|get paid)\b|\bsalary\b|\bgood money\b/],
  ['wfh', /\b(?:do|can) you work (?:from|at) home\b|\bwork(?:ing)? remote(?:ly)?\b|\b(?:go|come|head) (?:in )?(?:to|into) the office\b|\bremote or (?:in[- ]person|in the office|hybrid)\b|\bin the office or\b|\bhybrid (?:schedule|job|work)\b/],
  ['howMany', /\bhow many (?:head|cows|cattle|steers|acres|animals|horses|trees|vines|rows|patients|students|kids do you (?:teach|see)|employees|people work|customers|hours do you work|beds)\b|\bhow big is (?:the|your) (?:ranch|farm|place|orchard|vineyard|herd|crew|team|class)\b/],
  ['ahead', /^(?:and |so |what about |how about |is it |will it be )?(?:tomorrow|tonight|later|the weekend|this weekend|next week|this week|thanksgiving|the rest of the week)\b|\b(?:what about|how about|and) (?:tomorrow|tonight|later today|the weekend|this weekend|next week|thanksgiving)\b/],
  ['impact', /\b(?:did|do|have) (?:you|they|your family|you guys) (?:ever )?(?:have to )?(?:evacuate|lose|get out|leave|get hit|lose power|get flooded)\b|\b(?:was|were) your (?:house|home|place|family|car) (?:ok|okay|alright|all right|damaged|hit|safe|fine)\b|\bdid it (?:hit|reach|get to|damage) (?:you|your)\b/],
  ['whatAbout', /^(?:and |so )?(?:what|how) about\b/],
];
// The topics each follow-up can continue; the topic it means when the conversation is on none of them.
const SUB_CONTINUES = {
  names: ['family'], ages: ['family'], sexes: ['family'], partnerJob: ['family'], parentJob: ['family'], school: ['family'], howLong: ['job', 'home', 'neighborhood', 'about-them', 'family', 'history'],
  hours: ['job', 'traffic'], which: null, where: ['job', 'traffic', 'food', 'place', 'home', 'directions'], like: ['job', 'neighborhood', 'home', 'food', 'place', 'about-them'],
  pay: ['job'], ahead: ['weather', 'heat', 'storm'], impact: ['fire', 'storm', 'earthquake'], whatAbout: null, today: ['job'],
  kidsDo: ['family'], farWork: ['traffic', 'job'], car: ['traffic'], days: ['job'], before: ['job'], wfh: ['job', 'traffic'], howMany: ['job'],
};
const SUB_DEFAULT = { names: 'family', ages: 'family', sexes: 'family', partnerJob: 'family', parentJob: 'family', school: 'family', hours: 'job', pay: 'job', ahead: 'weather', impact: 'fire', kidsDo: 'family', farWork: 'traffic', car: 'traffic', days: 'job', before: 'job', wfh: 'job', howMany: 'job', today: 'job' };
// Follow-ups that mean one thing whatever else the line seems to say ("how far is your work?" is not directions).
const SUB_FORCE = { farWork: 'traffic', car: 'traffic', days: 'job', kidsDo: 'family', parentJob: 'family', wfh: 'job', howMany: 'job', today: 'job', workAt: 'job' };

// "Do you miss home?", "do you go back to visit?", "is your family still there?": the place they come from, asked
// as a question about them. The kind names the part: return, visit, family, miss (Spanish questions read folded).
const HOME_PLACES = 'mexico|el salvador|guatemala|honduras|nicaragua|the philippines|philippines|vietnam|china|taiwan|korea|india|iran|armenia|japan|cuba|peru|colombia|ecuador|michoacan|jalisco|oaxaca|zacatecas|guanajuato|sinaloa|puebla';
const HOMELAND_Q = [
  ['return', new RegExp(`\\b(?:would|will) you (?:ever )?(?:go|move) back\\b(?! to (?:work|school|sleep|bed|the office))|\\bdo you (?:want|plan|hope|think about|ever think about) (?:to )?(?:go|going|move|moving) back\\b(?! to (?:work|school|sleep|bed|the office))|\\b(?:piensa|piensas) regresar\\b`)],
  ['visit', new RegExp(`\\bdo you (?:ever |still |get to )?(?:go|get|travel|fly|make it) back\\b(?! to (?:work|school|sleep|bed|the office))(?: home| there| to visit| (?:to )?(?:${HOME_PLACES}))?|\\bhow often do you (?:go|get) back\\b|\\bdo you (?:ever )?visit (?:home|your (?:family|country|hometown|home ?town|relatives|people)|${HOME_PLACES})\\b|\\b(?:last time|when did) you (?:went|go|were|was) (?:back|home)\\b|\\b(?:va|vas|regresa|regresas) (?:seguido )?(?:para alla|a (?:su|tu) (?:pais|tierra|pueblo))\\b`)],
  ['family', new RegExp(`\\b(?:do you )?(?:still )?have (?:any )?(?:family|relatives|people|folks) (?:back home|back there|still there|over there|there|in (?:${HOME_PLACES}))\\b|\\b(?:is|are) (?:your|the rest of your) (?:family|relatives|folks|people|parents) (?:still )?(?:there|back home|over there|in (?:${HOME_PLACES}))\\b|\\b(?:tiene|tienes) familia (?:alla|en (?:${HOME_PLACES}))\\b`)],
  ['miss', new RegExp(`\\bdo you (?:ever |still )?miss (?:home|back home|being home|your (?:country|hometown|home ?town|homeland|town|village|old (?:home|town|neighborhood)|family (?:back home|there))|it (?:there|back home)|${HOME_PLACES})\\b|\\b(?:extrana|extranas) (?:a )?(?:su|tu) (?:tierra|pais|pueblo|rancho|familia)\\b`)],
];

// Questions about the player, answered from what the NPC's mind keeps of them (relationship facts, earlier talks):
// "Do you remember me?", "What's my name?", "What do I do?", "Where am I from?", "What did I tell you?". The kind
// names the part asked about. (Spanish questions arrive through spanish.mjs in these words.)
const PLAYER_Q = [
  ['job', /\bwhat do i do(?: for (?:work|a living))?\b|\bwhat(?:'?s| is) my (?:job|work|line of work|profession|occupation)\b|\bwhere do i work\b|\bremember what i do\b|\bknow what i do\b/],
  ['from', /\bwhere am i from\b|\bremember where i(?:'m| am| come)? from\b|\bwhere do i come from\b|\bknow where i(?:'m| am) from\b/],
  ['lives', /\bwhere do i live\b|\bremember where i live\b|\bknow where i live\b/],
  ['name', /\bwhat(?:'?s| is) my name\b|\bremember my name\b|\bknow my name\b|\bwho am i\b/],
  ['told', /\bwhat (?:did|have) i (?:tell|told) you\b|\bwhat do you (?:know|remember) about me\b|\bwhat have i told you\b|\bwhat did i say (?:last time|before)\b/],
  ['remember', /\b(?:do|did) you (?:still |even )?remember me\b|\bremember me\b|\bdo you (?:know|recognize) (?:me|who i am)\b|\bhave we met\b|\bdid we (?:ever )?meet\b|\bwe(?:'ve| have) met (?:before)?\b|\bremember who i am\b|\bdon'?t you remember\b|\bremember talking to me\b/],
];

// Questions about the languages the NPC speaks.
// "What's your favorite color?": a taste of their own (food and teams have planners of their own).
const FAVORITE_Q = /\bfavou?rite (colou?r|animal|holiday|season|time of year|sport|music|song|band|movie|film|show|tv show|book|singer|artist|thing to do)\b|\bwhat (?:kind|type|sort) of (music|movies|films|books|shows|tv) do you (?:like|listen to|watch|read)\b/;

const LANG_Q = /\b(?:do|can|could) you speak\b|\bwhat languages? do you speak\b|\bis english your (?:first|native|second) language\b|\byour (?:first|native|home) language\b|\bare you bilingual\b|\bdo you know (?:any )?(?:spanish|english|tagalog|korean|arabic|armenian|farsi|russian|hindi|punjabi|vietnamese|chinese|cantonese|mandarin|japanese)\b|\bspeak any other languages?\b|\bhow many languages\b|\b(?:what|which) language do you speak at home\b/;

// The speaker's own school or classes, and the local schools as a subject of their own.
const OWN_SCHOOL = /\b(?:how'?s|how is|how was|how are|how'?re) (?:school|class|classes|college)\b|\b(?:do|did) (?:you|ya) (?:like|enjoy|love|hate) (?:school|your school|class|your classes|college)\b|\byour (?:school|classes|teachers?|grades)\b|\b(?:school|college|class) going\b/;
const LOCAL_SCHOOLS = /\b(?:the|local|public|these|those|good|bad) schools?\b(?! going)|\bschools (?:here|around|in)\b|\bschool (?:district|board)\b/;

// "What worries you?", "what's your biggest concern?": their own top worry, whatever it is.
const WORRY_Q = /\bwhat (?:worries|concerns|bothers|scares|stresses) you\b|\bwhat(?:'s| is| are) (?:your|the) (?:biggest |main |big |number one )?(?:worry|worries|concern|concerns)\b|\bwhat keeps you up at night\b|\bwhat do you worry about\b|\bare you worried about anything\b|\banything (?:worry|worrying) you\b/;

// Worries the persona can have that no planner of their own covers: talked about as an opinion on a local topic.
const CONCERN_TOPICS = [
  ['water', /\b(water|drought|irrigation|water wells?|wells? (?:are|went|run|running|going) dry|the wells?|groundwater|aquifers?|canals?|water allocations?|dry years?|reservoirs? (?:are|is) (?:low|full))\b/],
  ['power shutoffs', /\b(power (?:shutoffs?|outages?|shut ?offs?|goes out|went out|cuts?)|psps|blackouts?|outages?|the power (?:going|go) out)\b/],
  ['roof', /\b(your |the )?roofs?\b/],
  ['jobs', /\b(jobs? market|hiring around here|layoffs?|unemployment|find(?:ing)? (?:a )?(?:job|work)|(?:get|getting) (?:a )?job|work around here|jobs around here|jobs here)\b/],
  ['health', /\b(your health|health care|healthcare|doctors?|clinics?|health)\b/],
  ['schools', /\b(the |local |public )?schools?\b(?! (?:bus|run|day))/],
  ['family abroad', /\b(?:family|folks|parents|relatives|people) (?:back home|back there|abroad|overseas|in the old country)\b/],
];

/** A follow-up's sub-question key ('names', 'ages', 'howLong', 'which', 'ahead', …), or null. */
export function subOf(norm) {
  for (const [k, re] of SUBS) if (re.test(norm)) return k;
  return null;
}

// ------------------------------------------------------------------ Spanish
// A player may speak Spanish: the line is read through an English paraphrase of its common phrases (spanish.mjs).
export { spanishReading };

// ------------------------------------------------------------------ hello in other languages
// "你好吗？", "안녕하세요!", "Xin chào!", "Bonjour!": a greeting or a how-are-you in a language other than English or
// Spanish, from the lexicon's phrase banks (script and romanization), plus a few languages the banks do not carry.
const greetKey = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC').replace(/[\s.,!?¿¡。！？、，،؟։։።।'"“”‘’()~-]+/gu, '');
// Romanizations that are everyday English: a hello in English is English.
const ENGLISH_HELLO = new Set(['hi', 'hey', 'hello', 'yo', 'oi', 'ok', 'okay', 'sup', 'hai', 'helo']);
const OTHER_HELLOS = [['bonjour', 'french', 'greeting'], ['salut', 'french', 'greeting'], ['ca va', 'french', 'how'], ['comment ca va', 'french', 'how'], ['comment allez vous', 'french', 'how'],
  ['hallo', 'german', 'greeting'], ['guten tag', 'german', 'greeting'], ['guten morgen', 'german', 'greeting'], ['wie gehts', 'german', 'how'], ['wie geht es dir', 'german', 'how'], ['wie geht es ihnen', 'german', 'how'],
  ['buongiorno', 'italian', 'greeting'], ['come stai', 'italian', 'how'], ['shalom', 'hebrew', 'greeting'], ['aloha', 'hawaiian', 'greeting']];
let GREET_INDEX = null;
function greetIndex() {
  if (GREET_INDEX) return GREET_INDEX;
  const map = new Map();
  const add = (text, lang, kind) => {
    const k = greetKey(text);
    if (!k || k.length < 2 || ENGLISH_HELLO.has(k)) return;
    let e = map.get(k);
    if (!e) map.set(k, e = { langs: new Set(), kind });
    e.langs.add(lang);
    if (kind === 'how') e.kind = 'how';
  };
  for (const lang of LANGUAGE_KEYS) {
    const L = LANGUAGES[lang];
    if (!L || lang === 'spanish') continue; // Spanish has a reading of its own
    for (const e of L.greetings || []) { add(e.text, lang, 'greeting'); if (e.roman) add(e.roman, lang, 'greeting'); }
    for (const e of L.howAreYou || []) { add(e.text, lang, 'how'); if (e.roman) add(e.roman, lang, 'how'); }
  }
  for (const [t, lang, kind] of OTHER_HELLOS) add(t, lang, kind);
  GREET_INDEX = map;
  return map;
}

/**
 * A greeting or a how-are-you in a language other than English or Spanish: {langs, kind: 'greeting'|'how'} when the
 * line opens with one (and is nothing but greetings), else null.
 * @param {string} raw
 * @returns {{langs: string[], kind: 'greeting'|'how'}|null}
 */
export function foreignGreeting(raw) {
  const idx = greetIndex();
  const pieces = String(raw || '').split(/[,，、;]+|(?<=[.!?。！？])\s*/u).map(greetKey).filter(Boolean);
  if (!pieces.length || pieces.length > 3) return null;
  let kind = null;
  const langs = new Set();
  for (const p of pieces) {
    const e = idx.get(p);
    if (!e) return null;
    if (e.kind === 'how') kind = 'how'; else kind = kind || 'greeting';
    for (const l of e.langs) langs.add(l);
  }
  return { langs: [...langs], kind };
}

// The commonest English words: a line with none of them, no known name and no intent reads as unclear.
const COMMON_WORDS = new Set(('that\'s it\'s what\'s funny hilarious true right exactly interesting cool nice awesome great sweet lovely a an the and or but if so of to in on at by for with from about as is are was were be been am i me my we us our you your '
  + 'he him his she her it its they them their this that these those there here what which who when where why how do does did have has had '
  + 'can could would should will not no yes yeah yep nope ok okay oh hi hey hello bye thanks thank please sorry well like just really very '
  + 'good great nice bad fine sure maybe much many more most some any all one two get got go going went come came know think say said tell '
  + 'want need see look make made time day today tonight tomorrow week year home house work job car people place food weather rain sun hot cold '
  + 'love hate fun cool wow huh hmm lol haha man dude bro friend guy thing things stuff kind way too also still back now then out up down '
  + 'over around off again never always ever only even right left new old big small little lot lots here there life world city town street').split(' '));

const ROUTINE_WORDS = [
  [/\bthe beach\b|\bbeach\b/, 'beach'], [/\bthe park\b|\ba park\b/, 'park'], [/\bgrocery( store)?\b|\bgroceries\b|\bsupermarket\b|\bthe store\b|\bmarket\b/, 'grocery'],
  [/\bpharmacy\b|\bdrug ?store\b/, 'pharmacy'], [/\blaundromat\b|\blaundry\b/, 'laundromat'], [/\bhardware store\b/, 'hardware'],
  [/\bpost office\b/, 'post-office'], [/\bgym\b/, 'gym'], [/\bchurch\b/, 'church'], [/\bstadium\b|\bballpark\b|\barena\b|\bthe game\b/, 'game'],
  [/\btrail(head)?s?\b|\bhik(e|ing)\b/, 'trail'], [/\bthe lake\b|\bthe bay\b|\bthe river\b|\bthe reservoir\b/, 'water'], [/\bdowntown\b|\bcity center\b/, 'downtown'],
  [/\bthe freeway\b|\bthe highway\b/, 'freeway'],
];

// One-word places that are also everyday words (English or Spanish). One counts as a place after a preposition
// ("from Paradise", "up in Weed"), or capitalized in mid-sentence, or as a whole capitalized answer ("Paradise.").
// A capital at the start of a sentence is no evidence: "Orange you glad" is not Orange County.
const COMMON_PLACE_WORDS = new Set(('industry commerce paradise orange bell alpine bishop cypress highland imperial marina needles paramount weed winters woodland '
  + 'vista ocean home hope corona mountain ranch lakeside fortuna sunset clearlake avenal reedley rio dell fairfield coalinga alligator antelope badger baker '
  + 'balls boulevard brooks canyon challenge citrus columbia coyote diablo empire fellows freedom gazelle helm herald homeland hood independence lakeshore '
  + 'likely lookout lotus meridian mineral nice cool occidental onyx parkway pioneer posey promontory rescue rodeo salmon sawtooth seaside snaggletooth strawberry '
  + 'sugarloaf summerland surfside thermal topaz vineyard volcano walnut willows woody camino campo cantil capay caliente encino nuevo potrero represa salida '
  + 'soledad sultana tranquillity valencia linda').split(' '));
// Words a player says on their own as a reaction ("Nice.", "Cool.", "Likely."): a place only after a preposition.
const REPLY_PLACE_WORDS = new Set('nice cool likely rescue challenge balls weed hood fellows woody posey'.split(' '));
// Reactions and fillers a player says on their own: never a name or a hometown, whatever the gazetteer holds.
const REACTION_WORDS = new Set(('nice cool great awesome sure same likewise whatever interesting wow ok okay yes yeah yep yup nope no thanks thank hi hey hello '
  + 'sweet lovely perfect neat fun true right exactly totally definitely maybe likely probably here there home nowhere everywhere around lol haha '
  + 'hmm oh ah um uh really gotcha cheers indeed agreed absolutely fair enough fine good bad sad nothing anything something me too also ditto '
  + 'whoa yikes damn dang wild crazy weird funny cute fancy classy brilliant amazing incredible beautiful gorgeous terrible awful').split(' '));

/**
 * True when a short line is only reactions and everyday words ("Cool.", "Nice!", "Same here.", "Likely."): an
 * answer to nothing, never a name or a place to learn.
 * @param {string} text
 * @returns {boolean}
 */
export function everydayLine(text) {
  const ws = foldAccents(String(text || '').toLowerCase()).match(/[\p{L}']+/gu) || [];
  return ws.length > 0 && ws.every(w => REACTION_WORDS.has(w) || REPLY_PLACE_WORDS.has(w) || COMMON_WORDS.has(w) || COMMON_WORDS.has(w.replace(/'(s|re|ve|ll|d|m|t)$/, '')));
}

/**
 * True when a short line is only reactions ("Cool.", "Nice!", "Wow."): narrower than everydayLine, so a given name
 * that is also a word ("Will", "Grace", "June") still counts as a name.
 * @param {string} text
 * @returns {boolean}
 */
export function reactionLine(text) {
  const ws = foldAccents(String(text || '').toLowerCase()).match(/[\p{L}']+/gu) || [];
  return ws.length > 0 && ws.every(w => REACTION_WORDS.has(w));
}

// Words before a place in a sentence about it.
const LOCATIVE = new Set('from in to near at around visit visiting outside by toward towards past through into of via between up down over out drive driving moved live lived'.split(' '));
// A name follows these ("I'm Tracy", "call me Lincoln"), not a place.
const NAME_BEFORE = /\b(?:name is|name's|i'm|i am|call me|named|called)\s*$/i;

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

/**
 * Whether a one-word place name in a line is meant as the place: never right after "I'm" or "my name is"; a word
 * people say as a reaction ("Nice", "Cool", "Likely") only after a preposition; an everyday word after a
 * preposition, capitalized in mid-sentence, or capitalized as the whole line; any other name as it stands.
 */
function onePlaceWord(w, tokens, i, alone) {
  const t = tokens[i];
  if (NAME_BEFORE.test(t.before)) return false;
  const prev = i > 0 ? tokens[i - 1].w : null;
  const prep = !!prev && LOCATIVE.has(prev) && !/[.!?,;:]\s*$/.test(t.before);
  if (REPLY_PLACE_WORDS.has(w)) return prep;
  if (COMMON_PLACE_WORDS.has(w) || COMMON_WORDS.has(w)) return prep || (t.cap && (!t.initial || alone));
  return true;
}

/** Places named in a text: [{kind: 'town'|'county'|'landmark', name, x, y, said}], nearest instance of each name. */
export function findPlaces(world, text, from = null) {
  const idx = nameIndex(world);
  const raw = String(text || '');
  const tokens = [...raw.matchAll(/[A-Za-z][A-Za-z.'-]*/g)].map(m => {
    const head = raw.slice(0, m.index);
    return {
      w: m[0].toLowerCase().replace(/[.]$/, ''), cap: /^[A-Z]/.test(m[0]),
      // the first word of a sentence is capitalized whatever it is
      initial: /^[\s"'(¡¿]*$/.test(head) || /[.!?¡¿]["')]*\s*$/.test(head),
      before: head.slice(-24),
    };
  });
  const alone = tokens.length === 1;
  const out = [];
  const used = new Set();
  for (let i = 0; i < tokens.length; i++) {
    for (let n = Math.min(idx.maxWords, tokens.length - i); n >= 1; n--) {
      if ([...Array(n).keys()].some(k => used.has(i + k))) continue;
      const phrase = tokens.slice(i, i + n).map(x => x.w).join(' ');
      const list = idx.map.get(phrase);
      if (!list) continue;
      if (n === 1 && phrase.length < 4) continue;
      if (n === 1 && !onePlaceWord(phrase, tokens, i, alone)) continue;
      let best = list[0];
      if (from && list.length > 1) best = list.slice().sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      out.push(Object.assign({ said: phrase }, best));
      for (let k = 0; k < n; k++) used.add(i + k);
      break;
    }
  }
  return out;
}

/**
 * Places the name index missed, through world.search: a ZIP code ("how do I get to 93702?") or a capitalized
 * phrase after "to", "in", "from", "near" or "visit" that is exactly a ZIP's city or place name.
 */
export function searchPlaces(world, text) {
  const out = [];
  const raw = String(text || '');
  for (const m of raw.matchAll(/\b(9[0-6]\d{3})\b/g)) {
    const hit = world.search(m[1], 1).find(r => r.kind === 'zip');
    if (hit) { const zi = hit.index; out.push({ kind: 'town', name: `${world.z.city[zi]} ${world.zips[zi]}`, said: m[1], x: world.z.tx[zi], y: world.z.ty[zi], zi }); }
  }
  for (const m of raw.matchAll(/\b(?:to|in|from|near|visit|visiting)\s+((?:[A-Z][a-z'.-]+)(?:\s+[A-Z][a-z'.-]+){0,3})/g)) {
    const phrase = m[1].toLowerCase();
    const hit = world.search(phrase, 8).find(r => r.kind === 'city' && [world.z.city[r.index], world.z.place[r.index]].some(n => String(n || '').toLowerCase() === phrase));
    if (hit) out.push({ kind: 'town', name: world.z.city[hit.index] || m[1], said: phrase, x: world.z.tx[hit.index], y: world.z.ty[hit.index], zi: hit.index });
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

/** Words of a persona's own life that a player's line can name: built once per conversation (see selfVocab). */
const STOP = new Set('the and with around town city county local family home house kids friends near over from into your their this that some more most just like work working worker other things stuff time a an of in on at to for up out new old big good great best'.split(' '));

/**
 * The vocabulary of a speaker's own life, for understand(): their job title and workplace words, their interests and
 * the worries no planner of their own covers. Pass the result as ctx.self.
 * @param {{title?: string|null, employer?: string|null, interests?: string[], concerns?: string[]}} life
 * @returns {{job: RegExp|null, interests: Array<{name: string, re: RegExp}>, concerns: string[]}}
 */
export function selfVocab(life = {}) {
  const forms = w => {
    const out = new Set([w, `${w}s`, `${w}es`, `${w}ing`]);
    if (/er$/.test(w) && w.length > 5) out.add(`${w.slice(0, -2)}ing`);
    if (/e$/.test(w)) out.add(`${w.slice(0, -1)}ing`);
    return [...out];
  };
  const words = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^a-z]+/).filter(w => w.length >= 4 && !STOP.has(w));
  const jobWords = [...new Set([...words(life.title), ...words(String(life.employer || '').replace(/^(a|an|the|their|their own|my|my own)\s+/i, ''))])]
    .filter(w => !/^(regional|public|private|small|large|busy|independent|national|state|general|senior|junior|assistant|associate|part|time|full|service|services|company|group|system|systems|center|office)$/.test(w));
  const job = jobWords.length ? new RegExp(`\\b(?:${jobWords.flatMap(forms).join('|')})\\b`) : null;
  const interests = (life.interests || []).map(name => {
    const ws = words(name).filter(w => !/^(games|game|show|shows|trips?|stuff)$/.test(w));
    return ws.length ? { name, re: new RegExp(`\\b(?:${ws.flatMap(forms).join('|')})\\b`) } : null;
  }).filter(Boolean);
  return { job, interests, concerns: (life.concerns || []).slice() };
}

/**
 * Read the player's line.
 * @param {string} text
 * @param {{world?: object, mind?: object, home?: {x: number, y: number}, fires?: Array<{name: string}>, lastIntent?: string|null, recent?: boolean, pending?: string|null, age?: number,
 *   self?: {job: RegExp|null, interests: Array<{name: string, re: RegExp}>, concerns: string[]}}} [ctx]
 * @returns {{text: string, norm: string, intent: string, scores: Record<string, number>, question: boolean,
 *   flags: {greeted: boolean, thanked: boolean, apologized: boolean, complimented: boolean, opinion: boolean, more: boolean,
 *   yes: boolean, no: boolean, short: boolean, politics: boolean, religion: boolean, aboutPlayer: boolean, unclear: boolean,
 *   spanish: boolean (the line was Spanish, read through its English paraphrase), aboutThat: boolean, likeIt: boolean,
 *   probe: {kind: string, hostile: boolean, positive?: boolean}|null, sub: string|null (the part of the topic a follow-up asks about),
 *   safety: {kind: 'crisis'|'sexual'|'threat', sub: string, es: boolean}|null (safety.mjs; the intent is then 'safety'; ctx.age: the NPC's age),
 *   followUp: boolean (the intent continues the conversation's topic), aboutYou: boolean (a question about the NPC),
 *   holidayGreeting: boolean ("Happy Thanksgiving!"), holidayAsk: boolean (a question about their holiday plans)},
 *   topics: string[], entities: {years: number[], fires: object[], roads: object[], places: object[], routine: string[], interest: string|null, team: string|null,
 *   ownInterest: string|null, concern: string|null, langAsked: string|null, heritage: boolean, demographic: string|null, favorite: string|null,
 *     homeland: 'return'|'visit'|'family'|'miss'|null (a question about the place they come from), holiday: string|null (holiday.mjs key),
 *     foreignLangs: string[]|null (the languages of a hello in another language),
 *     player: 'remember'|'name'|'job'|'from'|'lives'|'told'|null (a question about the player: intent 'about-me')},
 *   appraisal: {sentiment: number, intents: string[], topics: string[], toxicity: number, facts: Array<{key: string, value: string}>}}}
 */
export function understand(text, ctx = {}) {
  const raw = String(text == null ? '' : text).trim();
  // Spanish is read through its English paraphrase (the planners' sub-questions read norm too)
  const es = spanishReading(raw);
  // the paraphrase goes first, where the anchored patterns ("hi ...", "yes ...") look
  const said = es && es.says.length ? `${es.says.join('. ')}. ${es.en}` : es ? es.en : raw;
  const norm = said.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
  // The English patterns read the line with its accents folded: ASCII \b takes an accented letter for a word break,
  // so "días" would hold the word "as" and "carísimo" the word "car". "Acción de Gracias" is Thanksgiving, never thanks.
  const scan = foldAccents(norm).replace(/\b(?:(?:el )?dia de )?accion de gracias\b/g, 'thanksgiving');
  // the appraisal reads the paraphrase too: "Es usted muy amable" is a compliment
  const heard = said.replace(/(?:(?:el )?d[ií]a de )?acci[oó]n de gracias/gi, 'Thanksgiving');
  // (a mind that cannot appraise a line, whatever word trips it, leaves the line unappraised, never unanswered)
  const ap = appraiseSafely(heard, ctx.mind);
  // "I'm Marcus. What's your name?": a name given in one sentence of a longer line, read a sentence at a time
  if (!ap.facts.some(f => f && f.key === 'name')) {
    const sentences = heard.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 1) {
      for (const sn of sentences) {
        const f = (appraiseSafely(sn).facts || []).find(x => x && x.key === 'name');
        if (f) { ap.facts = ap.facts.concat([f]); if (!ap.intents.includes('self-introduction')) ap.intents = ap.intents.concat(['self-introduction']); break; }
      }
    }
  }
  const scores = {};
  for (const [intent, pats] of Object.entries(P)) {
    let s = 0;
    for (const [re, w] of pats) if (re.test(scan)) s += w;
    if (s > 0) scores[intent] = s;
  }
  // "Tell me about your family.": a request names its topic plainly, and the topic it names is what is asked
  if (/^(?:(?:so|and|now|ok|okay|well),? )?(?:(?:can|could|would|will) you |please )?(?:tell (?:me|us)|talk(?: to me)?|describe|explain)\b/.test(scan)) {
    for (const k of Object.keys(scores)) if (TOPICAL.has(k) && k !== 'opinion' && k !== 'smalltalk' && scores[k] >= 1.5) scores[k] += 1.5;
  }
  const AI = new Set(ap.intents);
  // "did you have a good day?" asks about their day; "have a good day!" says goodbye
  const askedDay = /\b(did|do) (you|ya) have an? (good|nice|great|fun|busy|long|rough|ok|okay) (day|night|weekend|week|morning|afternoon|evening|time|shift)\b/.test(scan);
  if (askedDay) { AI.delete('farewell'); delete scores.goodbye; scores['how-are-you'] = Math.max(scores['how-are-you'] || 0, 3.6); }
  if (AI.has('insult') || ap.toxicity >= 0.45) scores.insult = 8 + ap.toxicity;
  if (AI.has('compliment')) scores.compliment = Math.max(scores.compliment || 0, 3.2);
  if (AI.has('farewell')) scores.goodbye = Math.max(scores.goodbye || 0, 3.5);
  if (AI.has('thanks')) scores.thanks = Math.max(scores.thanks || 0, 3);
  if (AI.has('greeting')) scores.greeting = Math.max(scores.greeting || 0, 2.5);
  if (AI.has('apology')) scores.apology = Math.max(scores.apology || 0, 3);
  if (ap.facts.some(f => f.key === 'name')) scores.name = Math.max(scores.name || 0, 4);
  const question = /\?/.test(raw) || /^(who|what|when|where|why|how|which|whose|do|does|did|is|are|was|were|can|could|would|will|should|have|has|any|anything|ever)\b/.test(scan)
    || (!!es && /^(qu[eé]|c[oó]mo|d[oó]nde|cu[aá]ndo|cu[aá]nto|cu[aá]ntos|qui[eé]n|por qu[eé]|tiene|tienes|eres|es usted|hay)(?![a-záéíóúñü])/.test(raw.toLowerCase()));

  // what is not part of the game (a crisis, a sexual line or a lure, a threat) is read before anything else
  const safety = safetyOf(raw, { age: ctx.age });
  // a probe is never a question to shrug at: hostile ones are insults, the rest get their own answer
  const probe = probeOf(scan);
  // hello in another language: a greeting (or a how-are-you) in any language
  const foreign = es ? null : foreignGreeting(raw);
  if (foreign) scores[foreign.kind === 'how' ? 'how-are-you' : 'greeting'] = Math.max(scores[foreign.kind === 'how' ? 'how-are-you' : 'greeting'] || 0, 4.5);
  if (probe && probe.hostile) scores.insult = Math.max(scores.insult || 0, 9);
  else if (probe) scores.probe = 9;

  // entities
  const from = ctx.home || null;
  const places = ctx.world ? findPlaces(ctx.world, raw, from) : [];
  if (ctx.world && !places.length) places.push(...searchPlaces(ctx.world, raw));
  const roads = findRoads(raw);
  const years = [...norm.matchAll(/\b(18[5-9]\d|19\d\d|20[0-2]\d)\b/g)].map(m => +m[1]);
  // a fire named as the records spell it or as people say it ("the Parker 2 Fire" is the record's "Parker2")
  const fires = (ctx.fires || []).filter(f => [f.name, f.alias].filter(Boolean).some(name => {
    const n = foldAccents(String(name).toLowerCase().replace(/\s+(fire|complex)$/, ''));
    if (!n || n.length < 3) return false;
    const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return re.test(scan) && (n.length >= 6 || /\bfires?\b|\bcomplex\b/.test(scan));
  }));
  const routine = ROUTINE_WORDS.filter(([re]) => re.test(scan)).map(([, k]) => k);
  const interestHit = INTEREST_WORDS.find(([re]) => re.test(scan));
  const teamHit = TEAM_HIT.exec(norm);
  if (fires.length) scores.fire = (scores.fire || 0) + 3;
  if (places.length && scores.directions) scores.directions += 2;
  if (roads.length) scores.traffic = (scores.traffic || 0) + 1.5;

  // questions about the NPC: the languages they speak, their family's background
  const aboutYou = question && /\b(you|your|you'?re|yours|yourself|ya)\b/.test(scan);
  let langAsked = null;
  const heritage = !probe && asksHeritage(scan);
  const homelandHit = probe ? null : HOMELAND_Q.find(([, re]) => re.test(scan));
  const homeland = homelandHit ? homelandHit[0] : null;
  if (homeland) scores['about-them'] = Math.max(scores['about-them'] || 0, 5);
  const favM = probe ? null : FAVORITE_Q.exec(scan);
  const favorite = favM ? (favM[1] || favM[2]) : null;
  if (favorite) scores['about-them'] = Math.max(scores['about-them'] || 0, 4.7);
  if (!probe && LANG_Q.test(scan)) {
    scores['about-them'] = Math.max(scores['about-them'] || 0, 4.6);
    const m = /\b(spanish|english|tagalog|korean|arabic|armenian|farsi|russian|hindi|punjabi|vietnamese|chinese|cantonese|mandarin|japanese|french|german|portuguese)\b/.exec(scan);
    langAsked = m ? m[1] : 'any';
  } else if (heritage) scores['about-them'] = Math.max(scores['about-them'] || 0, 4.6);
  // "do a lot of Vietnamese people live here?": the neighborhood, in the languages spoken there
  const demo = !probe && asksDemographic(scan) ? demographicLanguage(scan) : null;
  if (demo) scores.neighborhood = Math.max(scores.neighborhood || 0, 4.6);

  // "how's school?", "do you like school?": the speaker's own school (the local schools are "the schools")
  const ownSchool = OWN_SCHOOL.test(scan) && !LOCAL_SCHOOLS.test(scan);
  const student = !!(ctx.self && ctx.self.student);
  if (ownSchool && !probe) scores.job = Math.max(scores.job || 0, student ? 4.6 : 3.6);
  // "Happy Thanksgiving!" is a greeting; "what are you doing for Thanksgiving?" asks about their plans (a holiday in a
  // question about the weather or the traffic stays that question)
  const holiday = probe ? null : holidayOf(scan);
  const holidayGreeting = !!holiday && !question && /^(?:and |oh,? |hey,? |well,? )?(?:a )?(?:happy|merry|feliz|felices|prospero)\b|\bhappy (?:thanksgiving|turkey day|holidays|new year|halloween|fourth|4th)\b|\bmerry (?:christmas|xmas)\b|\bseason'?s greetings\b/.test(scan);
  const otherTopic = ['weather', 'storm', 'heat', 'traffic', 'fire'].some(k => (scores[k] || 0) >= 3);
  const holidayAsk = !!holiday && !holidayGreeting && !otherTopic && (question || /\b(plans?|doing|going|cook|cooking|celebrate|celebrating|spend|spending|host|hosting|working|work|off|travel|traveling|turkey)\b/.test(scan));
  if (holidayGreeting) scores.greeting = Math.max(scores.greeting || 0, 4.6);
  else if (holidayAsk) scores.smalltalk = Math.max(scores.smalltalk || 0, 4.4);
  // "what worries you?": their own worry (the opinion planner answers it)
  const worry = !probe && WORRY_Q.test(scan);
  if (worry) scores.opinion = Math.max(scores.opinion || 0, 5);
  // a question about the player themselves: what the NPC remembers of them
  const playerHit = probe ? null : PLAYER_Q.find(([, re]) => re.test(scan));
  const player = playerHit ? playerHit[0] : null;
  if (player) scores['about-me'] = Math.max(scores['about-me'] || 0, 5.2);
  // a worry named in the line ("how's the water situation for ranching?") is the subject, whatever work it is for:
  // read first, so the speaker's own job words in the same line do not take it over
  let ownInterest = null, concern = null;
  if (!probe) {
    const c = CONCERN_TOPICS.find(([, re]) => re.test(scan));
    const top = Math.max(0, ...Object.entries(scores).filter(([k]) => !['greeting', 'thanks', 'compliment', 'apology', 'opinion'].includes(k)).map(([, v]) => v));
    if (c && top < 3.5 && (c[0] !== 'roof' || !scores.home) && !(c[0] === 'schools' && (ownSchool || /\b(you|ya) go\b|\bgo to school\b/.test(scan)))) {
      concern = c[0];
      scores.opinion = Math.max(scores.opinion || 0, 3.7);
    }
  }
  // the speaker's own life named in the line: their job, an interest
  const self = ctx.self || null;
  if (self && !probe && !concern) {
    const top = Math.max(0, ...Object.entries(scores).filter(([k]) => !['greeting', 'thanks', 'compliment', 'apology'].includes(k)).map(([, v]) => v));
    if (self.job && self.job.test(scan) && top < 4) scores.job = Math.max(scores.job || 0, 3.8);
    // "do you have grandkids?" asks about the family, even of someone whose pastime is the grandkids
    const hit = (self.interests || []).find(i => i.re.test(scan) && !FAMILY_INTEREST.test(i.name));
    if (hit && top < 4) { ownInterest = hit.name; scores['about-them'] = Math.max(scores['about-them'] || 0, 3.8); }
  }

  const flags = {
    greeted: !!scores.greeting, thanked: !!scores.thanks, apologized: !!scores.apology, complimented: !!scores.compliment,
    opinion: !!(scores.opinion && /\bwhat do you think|\bhow do you feel|\bopinion|\bthoughts|\btake on\b|\bdo you think\b|\bdo you like\b/.test(scan)),
    more: MORE.test(scan) || !!(es && es.says.includes('tell me more')), yes: YES.test(scan), no: NO.test(scan), short: norm.split(' ').length <= 4,
    politics: /\bpolitics\b|\bpolitical\b|\bpresident\b|\belections?\b|\bvot(e|ing)\b|\bdemocrats?\b|\brepublicans?\b|\bgovernor\b|\bcongress\b|\bsenator\b|\bliberal\b|\bconservative\b|\bpolitic[ao]s?\b|\bpresidente\b|\belecciones\b/.test(scan),
    religion: /\breligio\w*|\bgod\b|\bpray\w*|\bfaith\b|\bbelieve in\b|\bchurch\b|\bdios\b|\biglesia\b|\breligion\b|\bare you (a )?(catholic|christian|muslim|jewish|mormon|hindu|buddhist|sikh|religious|atheist|protestant|evangelical)\b/.test(scan),
    aboutPlayer: /\bwhat do you think of me\b|\bdo you like me\b|\bam i (annoying|boring|nice)\b/.test(scan),
    unclear: false, spanish: !!es,
    aboutThat: ABOUT_THAT.test(scan),
    likeIt: /\b(do|how do) you (like|enjoy|love) (it|that|that job|the job|your job|work|school|living here)\b|\bis it (fun|good|hard|nice|tough|stressful)\b/.test(scan),
    probe: probe || null, sub: subOf(scan), followUp: false, aboutYou, holidayGreeting, holidayAsk, safety, worry,
  };
  if (flags.sub === 'like' && /\b(do|did) (you|ya) (like|enjoy|love)\b|\bhow do you like\b/.test(scan)) flags.likeIt = true;
  // a student asked how school is going: how they feel about it
  if (ownSchool && student && !probe) { flags.likeIt = true; if (!flags.sub) flags.sub = 'like'; }
  const ws = norm.match(/[\p{L}']+/gu) || [];
  flags.unclear = !foreign && (!ws.length || (!es && !Object.keys(scores).length && !places.length && !roads.length && !years.length && ws.length <= 4 && !ws.some(w => COMMON_WORDS.has(w.replace(/'(s|re|ve|ll|d|m|t)$/, '')) || COMMON_WORDS.has(w))));

  // resolve combinations the way a person hears them
  const ranked = INTENTS.filter(k => scores[k] > 0).sort((a, b) => scores[b] - scores[a] || INTENTS.indexOf(a) - INTENTS.indexOf(b));
  let intent = ranked[0] || 'unknown';
  const topical = ranked.filter(k => TOPICAL.has(k) && k !== 'opinion' && k !== 'smalltalk');
  const strongest = k => (scores[k] || 0);
  if (intent === 'greeting' && ranked.length > 1 && !holidayGreeting) intent = ranked[1];
  if (intent === 'thanks' && scores.goodbye) intent = 'goodbye';
  if (intent === 'opinion' && topical.length && !flags.politics && !flags.aboutPlayer && !concern && !worry && !(flags.religion && !topical.some(k => strongest(k) >= 3))) intent = topical[0];
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
  const last = ctx.lastIntent && TOPICAL.has(ctx.lastIntent) ? ctx.lastIntent : null;
  // "is it hard?" right after the job is about the job; "is it hard to get around without a car?" has a topic of its own
  const ownTopic = ranked.some(k => TOPICAL.has(k) && k !== 'opinion' && k !== 'smalltalk' && strongest(k) >= 1.5);
  const aboutLast = flags.aboutThat && ws.length <= ABOUT_THAT_WORDS && !ownTopic;
  const recent = ctx.recent !== false;
  if ((flags.more || aboutLast) && last && recent && ranked.every(k => strongest(k) < 3.5)) { intent = last; flags.followUp = true; }
  if (!ranked.length && last && recent && flags.more) { intent = last; flags.followUp = true; }
  // a follow-up continues the topic: "how old are they?", "which hospital?", "what about tomorrow?"
  if (flags.sub && SUB_FORCE[flags.sub] && !['insult', 'probe', 'goodbye'].includes(intent)) intent = SUB_FORCE[flags.sub];
  else if (flags.sub && !['insult', 'probe', 'goodbye'].includes(intent)) {
    const sub = flags.sub;
    const topicalHit = ranked.some(k => TOPICAL.has(k) && k !== 'opinion' && k !== 'smalltalk' && strongest(k) >= 2.5);
    const weak = ranked.every(k => strongest(k) < 3.5) || (sub !== 'whatAbout' && ['unknown', 'smalltalk', 'opinion', 'history', 'directions', 'about-them', 'neighborhood'].includes(intent) && strongest(intent) < 4.5 && !concern && !ownInterest && !langAsked && !heritage && !homeland && !favorite);
    const fits = SUB_CONTINUES[sub];
    // ("How is the traffic? Which freeway do you take?" after the weather is about the traffic: a topic named plainly
    // in the line wins over the one the conversation was on)
    const otherTopic = ranked.some(k => TOPICAL.has(k) && k !== last && k !== 'opinion' && k !== 'smalltalk' && strongest(k) >= 2.5);
    if (last && (!fits || fits.includes(last)) && !otherTopic && (sub === 'whatAbout' ? !topicalHit : weak)) { intent = last; flags.followUp = true; }
    else if (weak && SUB_DEFAULT[sub] && !(sub === 'ahead' && topicalHit)) intent = SUB_DEFAULT[sub];
    else if (weak && sub === 'howLong') intent = /\b(lived|living|live|here|in this (?:house|place|neighborhood|town|area))\b/.test(scan) ? 'home' : /\b(work|job|done|doing|been an? |worked)\b/.test(scan) ? 'job' : intent;
    else if (weak && sub === 'like' && /\bbeing an? |\byour (?:job|work)\b|\bthe (?:job|work)\b/.test(scan)) intent = 'job';
  }

  if (safety) { intent = 'safety'; flags.followUp = false; }
  // a second topic asked in the same breath ("What about rent and insurance?"): told after the first, in a sentence
  const SAME = { rent: ['housing', 'home'], housing: ['rent', 'home'], home: ['rent', 'housing'], weather: ['heat', 'storm'], heat: ['weather', 'storm'], storm: ['weather', 'heat'] };
  const also = ['safety', 'insult', 'probe'].includes(intent) || flags.followUp ? [] : ranked.filter(k => k !== intent && TOPICAL.has(k) && !['opinion', 'smalltalk', 'about-them', 'neighborhood'].includes(k)
    && strongest(k) >= 3.5 && !(SAME[intent] || []).includes(k)).slice(0, 1);
  const topics = new Set(ap.topics);
  const TOPIC_OF = { weather: 'weather', heat: 'weather', storm: 'weather', traffic: 'traffic', fire: 'fire', housing: 'housing', rent: 'rent', insurance: 'insurance', job: 'job', family: 'family', food: 'food', neighborhood: 'neighborhood', history: 'history', earthquake: 'neighborhood', home: 'housing' };
  if (TOPIC_OF[intent]) topics.add(TOPIC_OF[intent]);
  if (teamHit) topics.add('sports');
  return {
    text: raw, norm, intent, scores, question, flags,
    topics: [...topics],
    entities: {
      years, fires, roads, places, routine, interest: interestHit ? interestHit[1] : null, team: teamHit ? teamHit[0] : null,
      ownInterest, concern, langAsked, heritage, demographic: demo, favorite, homeland, holiday, foreignLangs: foreign ? foreign.langs : null, player,
    },
    also,
    appraisal: { sentiment: num(ap.sentiment, 0), intents: ap.intents.slice(), topics: ap.topics.slice(), toxicity: num(ap.toxicity, 0), facts: ap.facts.slice() },
  };
}

const NO_APPRAISAL = Object.freeze({ sentiment: 0, intents: [], topics: [], toxicity: 0, facts: [] });

/** The mind's appraisal of a line, or a neutral one when the appraisal fails or returns something malformed. */
function appraiseSafely(text, mind = null) {
  let ap = null;
  try { ap = mind && typeof mind.appraise === 'function' ? mind.appraise(text) : mindAppraise(text); } catch { ap = null; }
  if (!ap || typeof ap !== 'object') return { ...NO_APPRAISAL, intents: [], topics: [], facts: [] };
  const list = x => (Array.isArray(x) ? x.filter(y => typeof y === 'string' || (y && typeof y === 'object')) : []);
  return { sentiment: num(ap.sentiment, 0), intents: list(ap.intents), topics: list(ap.topics), toxicity: num(ap.toxicity, 0), facts: list(ap.facts).filter(f => f && typeof f === 'object') };
}

// A group the player asked about, as the Census language most of its people speak at home (for the neighborhood).
const GROUP_LANG = [
  [/\b(mexican|salvadoran|guatemalan|honduran|nicaraguan|latino|latina|hispanic|cuban|puerto rican|colombian|peruvian|spanish)/, 'spanish'],
  [/\b(chinese|taiwanese|cantonese|mandarin)/, 'chinese'], [/\bvietnamese/, 'vietnamese'], [/\b(filipino|filipina|tagalog)/, 'tagalog'],
  [/\bkorean/, 'korean'], [/\b(arab|arabic|egyptian|syrian|iraqi|lebanese|yemeni|palestinian|jordanian)/, 'arabic'],
];

/** The Census language key of a demographic question ("do a lot of Filipinos live here?" → 'tagalog'), else 'any'. */
function demographicLanguage(norm) {
  const hit = GROUP_LANG.find(([re]) => re.test(norm));
  return hit ? hit[1] : 'any';
}
