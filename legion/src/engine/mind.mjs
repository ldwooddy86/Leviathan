// Legion · mind: what goes on inside one NPC while you are around them.
//
// A Mind wraps a persona with state that changes: a mood (valence and arousal, with an emotion label), needs
// (energy, social, fun, comfort, money), a memory stream, relationships (the player first) and beliefs that
// reflection distills from the stream. tick(t, {weather, activity}) moves needs and mood with simulated time;
// observe(event) takes in what happens (above all what the player says, through appraise); recall(query, k)
// ranks memories by recency × importance × lexical relevance; reflect(t) consolidates.
//
// Everything is deterministic: no randomness, no clock reads. Time is always passed in (epoch ms, simulation
// time). The state is plain JSON (toJSON / Mind.fromJSON) and can live in a MemoryStore, a LocalStorageStore
// (browser) or a FileStore (Node, one JSON file).
//
// The appraisal works offline from small embedded lexicons: a sentiment lexicon with negation and intensifiers,
// intent and topic patterns, and hostility detection from insults, profanity and aggressive second-person
// patterns. No slurs are listed anywhere in this source.

import { clamp, smoothstep } from './rng.mjs';

/** Bumped when the state shape changes; older states are upgraded on load. */
export const MIND_VERSION = 1;

/** Topics appraise() recognizes (the dialogue topic vocabulary). */
export const TOPICS = ['weather', 'traffic', 'fire', 'housing', 'rent', 'insurance', 'job', 'family', 'food', 'sports', 'school', 'health', 'neighborhood', 'history'];

/** Intents appraise() recognizes. */
export const INTENTS = ['greeting', 'question', 'compliment', 'insult', 'thanks', 'apology', 'farewell', 'request', 'self-introduction'];

/** Labels feelingsToward() returns. */
export const FEELINGS = ['fond', 'warm', 'neutral', 'wary', 'annoyed', 'hurt'];

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const num = (v, d = 0) => (isNum(v) ? v : d);
const round = (v, k = 3) => { const f = 10 ** k; return Math.round(v * f) / f; };
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const HOUR = 3600000;
const MAX_MEMORY = 300;
// Importance that must pile up before reflect() consolidates: about three or four substantive lines of talk.
const REFLECT_THRESHOLD = 1.2;

// ---------------------------------------------------------------- text

const STOP = new Set(('a an the and or but if then so of to in on at by for with from about as is are was were be been being am i me my mine '
  + 'we us our you your yours he him his she her it its they them their this that these those there here what which who whom whose when '
  + 'where why how do does did doing done have has had having just very really can could would should will shall may might must also '
  + 'too than up down out over into onto off again ever still even only own same such both each few more most other some any all it\'s '
  + 'i\'m you\'re that\'s what\'s don\'t can\'t won\'t didn\'t isn\'t ok okay yeah yes oh well like get got go going gonna want know think say said').split(' '));

const undouble = w => (/([bdgmnprt])\1$/.test(w) ? w.slice(0, -1) : w);

/**
 * A light suffix-stripping stemmer (plural, -ing, -ed, -ly, -ation, -ance/-ence, -er, final e), enough to
 * match evacuate / evacuated / evacuation and insurer / insurance / insured.
 */
export function stem(word) {
  let w = String(word).toLowerCase();
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (/ies$/.test(w) && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (/(ss|x|ch|sh|zz)es$/.test(w)) w = w.slice(0, -2);
  else if (/[^su]s$/.test(w)) w = w.slice(0, -1);
  if (/ing$/.test(w) && w.length > 5) w = undouble(w.slice(0, -3));
  else if (/ed$/.test(w) && w.length > 4) w = undouble(w.slice(0, -2));
  else if (/ly$/.test(w) && w.length > 5) w = w.slice(0, -2);
  if (/(ation|ition)$/.test(w) && w.length > 7) w = w.slice(0, -3);
  else if (/(ance|ence)$/.test(w) && w.length > 6) w = w.slice(0, -4);
  else if (/er$/.test(w) && w.length > 5) w = w.slice(0, -2);
  if (/e$/.test(w) && w.length > 4) w = w.slice(0, -1);
  return w;
}

/** Lower-case words of a text (apostrophes kept inside words, accents kept). */
export function words(text) {
  return String(text || '').toLowerCase().replace(/[’‘`]/g, "'").match(/[\p{L}\p{N}][\p{L}\p{N}']*/gu) || [];
}

/** Content stems of a text: words minus stop words, stemmed. */
export function tokens(text) {
  const out = [];
  for (const w of words(text)) if (!STOP.has(w) && w.length > 1) out.push(stem(w.replace(/'s$/, '')));
  return out;
}

// ---------------------------------------------------------------- sentiment

// A compact sentiment lexicon (scores -4..4), written for conversational English and a little California slang.
const LEX = {};
const addLex = (score, list) => { for (const w of list.split(' ')) LEX[w] = score; };
addLex(4, 'amazing awesome fantastic incredible wonderful superb outstanding stoked thrilled delighted magnificent');
addLex(3, 'great excellent love loved loving lovely beautiful gorgeous perfect brilliant best happy grateful thankful delicious congrats congratulations terrific stellar adore adorable blessed beloved excited');
addLex(2, 'good nice glad thanks thank appreciate appreciated kind sweet helpful fun enjoy enjoyed enjoying cute funny friendly smart proud exciting peaceful hopeful impressive charming generous brave relieved lucky win won winning yay dope rad tasty fresh welcome beauty legit');
addLex(1, 'cool fine better okay safe calm comfortable hope interesting chill solid fair warm easy clean');
addLex(2, 'gracias salamat merci danke arigato mahalo');
addLex(-1, 'crazy insane killing');
addLex(-1, 'tired worry nervous expensive problem problems weird mess messy slow crowded hot cold sick sorry broke meh confusing busy late');
addLex(-2, 'bad worse sad upset annoyed annoying boring bored dumb gross poor hurt pain scary scared afraid worried anxious stressed stress exhausted lonely unfair wrong trouble danger dangerous fear cry crying lost lose losing fail failed failure rude frustrating frustrated ridiculous crap screw trash garbage miserable angry mad hell');
addLex(-1, 'damn');
addLex(-3, 'terrible awful horrible worst hate hated hating stupid idiot ugly nasty disgusting sucks suck pathetic useless worthless jerk loser moron disaster destroyed died dead death depressed depressing shit fuck fucking');
const NEGATORS = new Set(['not', 'no', 'never', 'nothing', 'nobody', 'none', 'neither', 'nor', 'hardly', 'barely', 'without', "don't", "doesn't", "didn't", "isn't", "wasn't", "aren't", "weren't", "can't", "couldn't", "won't", "wouldn't", "shouldn't", "ain't", 'cannot', 'dont', 'doesnt', 'didnt', 'isnt', 'wasnt', 'cant', 'wont']);
const BOOST = { very: 1.5, really: 1.4, so: 1.35, super: 1.5, extremely: 1.8, totally: 1.5, hella: 1.6, incredibly: 1.7, absolutely: 1.6, too: 1.2, pretty: 1.2, quite: 1.2, such: 1.3, truly: 1.4, mad: 1.3, crazy: 1.4, insanely: 1.6, damn: 1.3 };
// words that intensify when an evaluative word follows ("mad good", "pretty bad", "crazy expensive", "damn good")
const INTENSIFIER_USE = new Set(['mad', 'pretty', 'crazy', 'insane', 'damn']);
const IDIOMS = [[/\bkilling (me|us)\b/, -2], [/\bkilling it\b/, 3], [/\bnot (too |so )?bad\b/, 0.5]];
const DAMPEN = { kinda: 0.6, somewhat: 0.6, slightly: 0.5, sorta: 0.6, little: 0.7, bit: 0.7 };

/** Sentiment of a text in -1..1 (lexicon sum with negation, intensifiers, "but" and emphasis, squashed). */
export function sentimentOf(text) {
  const raw = String(text || '');
  const ws = words(raw);
  let total = 0, after = false;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (w === 'but' || w === 'though' || w === 'however') { total *= 0.6; after = true; continue; }
    let s = LEX[w];
    if (s === undefined) continue;
    if (w === 'kind' && ws[i + 1] === 'of') continue;          // "kind of" hedges, it is not kindness
    if (INTENSIFIER_USE.has(w) && i + 1 < ws.length && LEX[ws[i + 1]] !== undefined) continue; // intensifier use
    if (w === 'killing') continue;                                                     // read through the idioms below
    if (w === 'fair' && ws[i + 1] === 'plan') continue;                                // the FAIR Plan is a name
    if ((w === 'garbage' || w === 'trash') && /^(day|days|truck|trucks|can|cans|pickup|bin|bins|collection|service|bag|bags|night)$/.test(ws[i + 1] || '')) continue; // garbage day
    if (w === 'hell' && (ws[i + 1] === 'yeah' || ws[i + 1] === 'yes')) s = 2;
    if (w === 'sick' && /\b(that'?s|so|was) sick\b/.test(raw.toLowerCase())) s = 2; // slang praise
    let m = 1;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATORS.has(ws[j])) m *= -0.7;
      else if (BOOST[ws[j]]) m *= BOOST[ws[j]];
      else if (DAMPEN[ws[j]]) m *= DAMPEN[ws[j]];
    }
    if (i > 0 && ws[i - 1] === 'of' && ws[i - 2] === 'kind') m *= 0.6;
    total += s * m * (after ? 1.3 : 1);
  }
  const low = raw.toLowerCase();
  for (const [re, v] of IDIOMS) if (re.test(low)) total += v;
  const emo = (raw.match(/(:-?\)|:-?D|<3|😊|😀|😄|❤|👍|🙂)/g) || []).length - (raw.match(/(:-?\(|😢|😡|😠|👎|🙁|💀)/g) || []).length;
  total += 2 * emo;
  const bangs = Math.min(3, (raw.match(/!/g) || []).length);
  total *= 1 + 0.1 * bangs;
  const letters = raw.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 8 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) total *= 1.3;
  return round(total / Math.sqrt(total * total + 15), 3);
}

// ---------------------------------------------------------------- hostility (insults, profanity, aggression; no slurs)

// Profanity as whole words only: "shiitake", "Dickens" and "class" are not profanity.
const PROFANITY_STRONG = [
  /\bf+u+c+k+(?:s|ed|er|ers|ing|in'?|face|head|wit)?\b/, /\bf[*#@!_.\-]{1,3}k(?:ing|in'?|er|ed|s)?\b/, /\bf[*#@!]{2,4}(?![\w*#@!])/,
  /\bs[*#@!]{2,3}t\b/, /\bmotherf\w*/, /\bsh[i1!*]t(?:s|ty|tier|ting|head|heads|show|load)?\b/, /\bbull ?sh[i1!*]t\b/,
  /\bb[i1!*]tch(?:es|y|ing|in'?)?\b/, /\bass(?:hole|holes|hat|hats|wipe)\b/, /\bdick(?:head|heads|s)?\b/, /\bbastards?\b/, /\bprick\b/,
  /\bwtf\b/, /\bstfu\b/, /\bgtfo\b/,
];
const PROFANITY_MILD = [/\bdamn(?:ed|it)?\b/, /\bhell\b/, /\bcrap(?:py)?\b/, /\bpiss(?:ed)?\b/, /\bfreaking\b/, /\bfrickin\w*/, /\bass\b/];

// Insults count only when aimed at the listener: as a predicate ("you're an idiot", "are you stupid?"), a
// vocative ("you idiot", "Idiot!") or about their things ("your house is ugly"). The same words about the weather,
// a question or oneself ("I feel like such a fool", "garbage day") are not hostility.
const INSULT_NOUNS = 'idiots?|morons?|losers?|jerks?|fools?|clowns?|creeps?|freaks?|weirdos?|imbeciles?|airheads?|bozos?|nitwits?|dimwits?|numbskulls?|cowards?|liars?|hypocrites?|parasites?|scum|dumbass(?:es)?|jackass(?:es)?|dorks?';
const INSULT_THINGS = 'trash|garbage|a joke|a disgrace|a failure|a nobody|a waste of space';
const INSULT_ADJS = 'stupid|dumb|ugly|pathetic|worthless|useless|disgusting|incompetent|clueless|ignorant|fat|lazy|brainless|hopeless';
const INSULT_MILD = 'weird|boring|annoying|lame|gross|rude|creepy|mean';
const SOFTENERS = '(?:(?:such|so|really|very|totally|completely|being|just|a|an|the|total|complete|real|absolute|big|little|fucking|freaking|damn|stupid|dumb|useless|pathetic|ugly|lazy|worthless)\\s+){0,4}';
const YOU_ARE = "(?:\\byou(?:'re| are| r| were| was)|\\byoure|\\bur|\\bu r|\\bare you,?|\\byou (?:look|sound|act|seem)(?: like)?)\\s+";
const RE_PREDICATE = new RegExp(`${YOU_ARE}${SOFTENERS}(?:${INSULT_NOUNS}|${INSULT_THINGS}|${INSULT_ADJS})\\b(?!')`);
const RE_PREDICATE_MILD = new RegExp(`${YOU_ARE}${SOFTENERS}(?:${INSULT_MILD})\\b`);
const RE_VOCATIVE = new RegExp(`\\b(?:you|ya),?\\s+(?:(?:stupid|dumb|little|big|fucking|freaking|damn|absolute|complete|total|ugly|lazy|pathetic|useless|worthless)\\s+){0,2}(?:${INSULT_NOUNS})\\b(?!\\s+(?:out|me|us|him|her|them|it|around|off)\\b)`);
const RE_OPENING = new RegExp(`^(?:(?:you|ya)\\s+)?(?:(?:stupid|dumb|little|fucking|freaking|damn|absolute|complete|total)\\s+){0,2}(?:${INSULT_NOUNS})\\s*(?:[,!.?]|$)`);
const RE_THEIR_THINGS = new RegExp(`\\byour\\s+(?:(?:${INSULT_ADJS}|lame|trashy)\\s+[a-z]+|[a-z]+(?:\\s+[a-z]+)?\\s+(?:is|are|looks?|was|were|smells?)\\s+(?:(?:so|really|such|a|total|like|kind of|pretty)\\s+)*(?:${INSULT_ADJS}|trash|garbage|a joke|lame|gross))\\b`);
// Threats need the speaker as the subject: "Did the fire hurt you?" asks, "This heat will kill you" warns,
// "The Dodgers are going to beat you" teases, "I'd beat you at chess" competes.
const RE_THREAT = /\bi(?:'ll|'m gonna|'m going to|'d| will| am gonna| am going to| would| want to| wanna| gonna)\s+(?:(?!never\b|not\b|n't\b)[a-z]+\s+)?(?:kill|hurt|beat up|beat|punch|smash|stab|shoot|slap|strangle|choke|destroy|end)\s+(?:you|u|ya)\b(?!\s+(?:at|in|on|to|there|when|if|in a)\b)/;
const RE_CURSE = /\b(?:f+u+c+k+|f[*#@!_.\-]{1,3}k|screw)\s+(?:you|u|off|ya)\b|\bf[*#@!]{2,4}\s+(?:you|u|off)\b/;
const SURPRISE = "(?:no way|really|seriously|for real|are you serious|you'?re kidding|you'?re joking|that'?s (?:amazing|awesome|great|incredible|so cool|crazy))";
const RE_SHUT_UP_SURPRISE = new RegExp(`\\bshut up(?:\\s*!+\\s*(?:$|${SURPRISE})|,?\\s+${SURPRISE})`);

/** Hostility of a text in 0..1, and whether it reads as an insult or a threat aimed at the listener. */
function hostility(text) {
  const raw = String(text || '');
  const t = raw.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
  let score = 0, insult = false;
  const aimed = w => { score += w; insult = true; };
  const prof = raw.replace(/\bDick\b/g, ' ').toLowerCase().replace(/[’‘`]/g, "'"); // a capitalized Dick is a name
  for (const re of PROFANITY_STRONG) score += 0.3 * (prof.match(new RegExp(re.source, 'g')) || []).length;
  for (const re of PROFANITY_MILD) if (re.test(prof) && !/\bhell (?:yeah|yes|of a)\b/.test(prof)) score += 0.1;
  if (RE_PREDICATE.test(t) || RE_VOCATIVE.test(t) || RE_OPENING.test(t)) aimed(0.55);
  else if (RE_PREDICATE_MILD.test(t)) aimed(0.3);
  if (RE_THEIR_THINGS.test(t)) aimed(0.3);
  if (RE_THREAT.test(t)) aimed(0.85);
  if (/\bkick your (?:ass|butt)\b(?! (?:at|in)\b)/.test(t)) aimed(0.5);
  if (/\b(?:kill yourself|kys|go die|drop dead)\b/.test(t)) aimed(0.9);
  if (RE_CURSE.test(t)) aimed(0.6);
  if (/\bgo to hell\b/.test(t)) aimed(0.5);
  if (/\bi hate (?:you|u|ya)\b|\bi hate your guts\b/.test(t)) aimed(0.5);
  if (/\bnobody (?:likes|cares about|wants|loves) (?:you|u)\b/.test(t)) aimed(0.5);
  else if (/\b(?:nobody|who) cares\b/.test(t)) aimed(0.2);
  if (/\b(?:you|u) (?:suck|stink)\b/.test(t)) aimed(0.45);
  // "shut up" is hostile, except in surprise ("Shut up! No way!", "Shut up, that's amazing")
  if (/\bshut (?:up|it)\b/.test(t)) { if (RE_SHUT_UP_SURPRISE.test(t)) score += 0.1; else aimed(0.4); }
  // dismissive, not an insult
  if (/(?:^|[.!?,] )(?:just )?(?:get lost|go away|buzz off|piss off)\b|\bleave me alone\b|\b(?:who|nobody) asked\b/.test(t)) score += 0.25;
  if (/\bwhat'?s wrong with (?:you|u)\b/.test(t)) score += 0.15;
  const letters = raw.replace(/[^A-Za-z]/g, '');
  if (score > 0 && letters.length >= 8 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) score += 0.1; // shouting
  return { toxicity: round(clamp(score, 0, 1), 3), insult };
}

// ---------------------------------------------------------------- intents, topics, facts

const P = {
  greeting: /^(hi|hello|hey|heya|hiya|howdy|yo|sup|greetings|hola|buenas|buenos d[ií]as|kumusta|xin ch[aà]o|annyeong|salaam|namaste|aloha|good (morning|afternoon|evening|day))\b|^what'?s up\b|^(morning|mornin'|afternoon|evening)\s*[!.,]|^(morning|evening)$|\b(hi|hello|hey) there\b|\bnice to meet you\b/,
  questionStart: /^(who|what|when|where|why|how|which|whose|do|does|did|is|are|was|were|can|could|would|will|should|have|has|any|anything|ever)\b/,
  compliment: [
    /\b(you('re| are)|you look|ur|youre)\s+(so |really |very |such an? |an? |the |pretty |super )?(great|nice|kind|smart|awesome|amazing|beautiful|lovely|cool|funny|wonderful|helpful|sweet|best|brilliant|wise|good|fun|interesting|thoughtful|generous|talented|patient|friendly)\b/,
    /\b(nice|great|love|like|beautiful|lovely|cool|awesome|amazing|gorgeous|pretty) (your )?(house|garden|yard|car|truck|shirt|hat|place|dog|cat|home|roof|jacket|smile|style|shoes|bike|view|flowers|story|stories)\b/,
    /\b(good job|well done|nice work|great job|nice one|you rock|you're the best|you are the best|i like you|i love your|i like your|i admire|you've been (so )?(helpful|kind|great)|you're a (good|great) (person|neighbor|friend))\b/,
    /\byour (house|garden|yard|car|truck|place|home|dog|cat|kids|roof|view|flowers|shirt|hat|jacket|style|shoes|smile|bike) (is|are|looks?|was) (so |really |very |super |hella )?(great|nice|beautiful|lovely|cool|awesome|amazing|gorgeous|pretty|cute|perfect|wonderful|incredible)\b/,
  ],
  thanks: /\b(thanks|thank you|thank u|thankyou|thx|ty|appreciate (it|that|you|this)|much appreciated|gracias|salamat|c[aả]m [oơ]n|merci|danke|gamsahamnida|kamsahamnida|xie xie|xi[eè] xi[eè]|arigato|mahalo)\b/,
  apology: /\b(sorry|my bad|apologi[sz]e|apologies|forgive me|didn'?t mean (to|it)|lo siento|perd[oó]n|i was wrong)\b/,
  farewell: /\b(bye|goodbye|good bye|bye bye|see (you|ya)|see you (later|soon|around)|catch you later|take care|good ?night|gotta go|got to go|have to go|i'?m (heading|off|out)|have a (good|nice|great) (one|day|night|evening|weekend)|adi[oó]s|ciao|so long|peace out|until next time|later,? (man|dude|bro|friend))\b/,
  shortLater: /^(ok(ay)?,? |alright,? |cool,? )?(later|laters)( (man|dude|bro|all|y'all))?[.!]*$/,
  request: /^(please|can you|could you|would you|will you|would you mind|tell me|show me|give me|help me|let me|let'?s|i need|i'?d like|i want|where can i|how do i|do you know (where|how|if|what))\b|\bplease\b|^(tell|show|give|help|take(?! care)|bring|find|explain|describe|recommend|suggest|teach|lend|point|share)\b/,
};

// Words that follow "I'm" or "my name is" without being a name: states, moods, fillers, places in a sentence.
const NOT_NAMES = new Set(('good fine ok okay alright tired happy sorry here there new from a an the not no so just back sure glad great well also '
  + 'really very still only actually pretty kind kinda quite too going gonna trying looking at in on doing done busy hungry thirsty ready lost '
  + 'confused retired married single divorced widowed pregnant bored home sick worried scared afraid excited curious interested late early '
  + 'off out over up down outside inside around nearby about almost never always usually staying visiting moving leaving heading calling '
  + 'asking talking telling working living waiting walking driving thinking feeling getting coming um uh like yes yeah nope hey hi hello thanks '
  + 'free open closed broke rich poor old young cold hot warm wet cool sad mad angry upset stressed fine stuck safe okay certain positive '
  + 'nobody somebody someone anyone everyone nothing something everything here this that it what who').split(' '));
// Nationalities, heritages, faiths and regions: "I'm Mexican" or "I'm Catholic" is not a name, and the NPC must
// never call the player by one.
const IDENTITY_WORDS = new Set(('mexican salvadoran guatemalan honduran nicaraguan puerto rican cuban dominican south central american spanish '
  + 'latino latina latinx hispanic chicano chicana chinese taiwanese filipino filipina pinoy pinay vietnamese korean japanese indian hmong cambodian '
  + 'khmer lao laotian thai pakistani bangladeshi sikh punjabi afghan burmese indonesian asian african ethiopian eritrean nigerian somali '
  + 'caribbean jamaican haitian black white armenian iranian persian arab arabic assyrian russian ukrainian polish irish italian german '
  + 'english british scottish welsh french portuguese dutch scandinavian swedish norwegian danish finnish greek european american californian '
  + 'native indigenous hawaiian samoan tongan pacific islander jewish muslim catholic christian buddhist hindu mormon protestant baptist '
  + 'evangelical atheist agnostic canadian australian brazilian israeli turkish lebanese egyptian syrian iraqi palestinian cantonese mandarin '
  + 'texan southern southerner midwestern midwesterner mixed biracial multiracial hapa local immigrant gay straight lesbian queer trans '
  + 'california cali socal norcal').split(' '));
const NOT_NAME_TIMES = new Set('monday tuesday wednesday thursday friday saturday sunday today tomorrow yesterday tonight january february march july september october november december christmas easter'.split(' '));
// What follows "call me" in idioms, not a name: "call me crazy", "call me later", "call me back".
const CALL_IDIOMS = new Set('crazy later back anytime sometime tomorrow tonight maybe old old-fashioned whatever anything a an the if when whenever on at in up over again every around first after before soon now please out sometimes ishmaelite stupid silly naive paranoid lucky'.split(' '));

/** True when a word can be a person's name: not a state, a time, a nationality, a faith or a verb form. */
function nameWord(w) {
  const lw = String(w || '').toLowerCase().replace(/'s$/, '');
  if (lw.length < 2 || NOT_NAMES.has(lw) || NOT_NAME_TIMES.has(lw) || /ing$|ed$/.test(lw) && lw.length > 4) return false;
  return !lw.split('-').some(part => IDENTITY_WORDS.has(part));
}
const titleCase = w => w.split('-').map(p => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p)).join('-');

// Jobs a person can say they are ("I'm a nurse"): head nouns, read from the end of the phrase.
const JOB_HEADS = new Set(('nurse teacher doctor physician surgeon dentist pharmacist therapist counselor chef cook baker barista bartender server '
  + 'waiter waitress driver trucker pilot mechanic electrician plumber carpenter roofer painter welder machinist engineer developer programmer '
  + 'coder designer architect scientist researcher professor instructor librarian accountant bookkeeper lawyer attorney paralegal judge clerk '
  + 'cashier manager supervisor director administrator consultant analyst realtor agent broker banker teller firefighter officer cop deputy '
  + 'detective guard soldier sailor marine airman farmer farmworker rancher gardener landscaper janitor housekeeper cleaner nanny caregiver aide '
  + 'assistant receptionist secretary technician tech emt paramedic medic hygienist contractor builder laborer foreman inspector surveyor writer '
  + 'reporter journalist editor photographer artist musician actor actress dancer filmmaker animator entrepreneur owner freelancer student '
  + 'homemaker housewife hairstylist stylist barber butcher fisherman logger longshoreman stocker postman courier salesperson salesman saleswoman '
  + 'rep representative pastor priest minister rabbi imam chaplain veterinarian vet tutor coach trainer lifeguard dispatcher operator picker '
  + 'principal programmer translator interpreter chemist biologist geologist economist psychologist planner adjuster auditor recruiter').split(' '));
// "a farm worker" and "a social worker" are jobs; "a hard worker" is not
const WORKER_KINDS = new Set('farm field social construction factory warehouse tech health care home office steel dock retail county city state federal postal sanitation restaurant hotel oil road rail transit cannery nursery vineyard dairy'.split(' '));
// Evaluations, not jobs: "a good cook", "a terrible driver"
const NOT_JOB_ADJ = new Set('good bad great terrible awful amazing decent careful safe fast slow hard real true proud big huge total complete better worse best worst'.split(' '));
// Who someone is to their family, what they eat, believe or support: not a job
const NOT_JOBS = new Set('mother father mom dad parent grandmother grandfather grandma grandpa grandparent sister brother son daughter aunt uncle cousin wife husband widow widower vegetarian vegan californian american member believer beginner fan resident local native immigrant patient customer neighbor newcomer veteran retiree christian catholic democrat republican'.split(' '));

/** A job phrase the speaker gave ("registered nurse", "farm worker", "stay-at-home mom"), or null. */
function jobPhrase(phrase, sure) {
  const p = String(phrase || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!p) return null;
  if (/^stay-at-home (?:mom|dad|parent|mother|father)$/.test(p)) return p;
  const ws = p.split(' ');
  if (ws.some(w => NOT_JOBS.has(w)) || NOT_JOB_ADJ.has(ws[0])) return null;
  const head = ws[ws.length - 1];
  if (head === 'worker') return ws.length > 1 && WORKER_KINDS.has(ws[ws.length - 2]) ? p : null;
  if (JOB_HEADS.has(head)) return p;
  // "I work as a ..." says it is a job; take a short phrase there as said
  return sure && ws.length <= 3 && /^[a-z][a-z -]*$/.test(p) ? p : null;
}

const GREETING_START = '^(?:hi|hello|hey|heya|hiya|howdy|yo|greetings|good (?:morning|afternoon|evening)|morning|evening)(?:\\s+(?:there|all|everyone|neighbor))?[\\s,!.]+';

/** Facts a speaker gives about themselves: name, where they are from or live, their work. */
function factsOf(text) {
  const raw = String(text || '').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
  const out = [];
  const add = (key, value) => { const v = String(value || '').trim().replace(/\s+/g, ' ').replace(/[.,!?;:]+$/, ''); if (v && !out.some(f => f.key === key)) out.push({ key, value: v }); };
  // names: "my name is", "they call me"; "call me X" only for a name, not an idiom ("call me crazy", "call me later")
  let m = /\b(?:my name is|my name's|name's|i'?m called|i am called|they call me|everyone calls me|people call me|friends call me)\s+([A-Za-z][A-Za-z'-]{1,20})/i.exec(raw);
  if (m && nameWord(m[1])) {
    const rest = /^\s+([A-Z][A-Za-z'-]{1,20})\b/.exec(raw.slice(m.index + m[0].length));
    add('name', rest && nameWord(rest[1]) ? `${titleCase(m[1])} ${titleCase(rest[1])}` : titleCase(m[1]));
  }
  if (!out.length && (m = /(?:^|[.!?]\s+|\b(?:you can|just|please)\s+)call me\s+([A-Za-z][A-Za-z'-]{1,20})(?=\s*(?:[,.!?]|$|\s+(?:for short|instead)\b))/i.exec(raw))
    && nameWord(m[1]) && !CALL_IDIOMS.has(m[1].toLowerCase())) add('name', titleCase(m[1]));
  // "I'm X" only where it introduces someone: after a greeting, with "nice to meet you", "by the way", or alone
  if (!out.length) {
    const intro = [
      new RegExp(`${GREETING_START}(?:i'?m|i am|it'?s|this is|my name'?s)\\s+([A-Za-z][A-Za-z'-]{1,20})\\b`, 'i'),
      /^(?:[Ii]'?m|[Ii] am)\s+([A-Z][A-Za-z'-]{1,20})\s*[,.!]?\s*(?:(?:[Ii]t'?s )?(?:[Nn]ice|[Pp]leased|[Gg]ood|[Gg]reat) to meet you|[Bb]y the way|btw)\b/,
      /\b(?:nice|pleased|good|great) to meet you[,.!]*\s+(?:i'?m|i am)\s+([A-Z][A-Za-z'-]{1,20})\b/i,
      /\blet me introduce myself[,.:!]*\s+(?:i'?m|i am)\s+([A-Za-z][A-Za-z'-]{1,20})\b/i,
      /^(?:[Ii]'?m|[Ii] am)\s+([A-Z][A-Za-z'-]{1,20})\s*[.!]*$/,
    ];
    for (const re of intro) { const x = re.exec(raw); if (x && nameWord(x[1])) { add('name', titleCase(x[1])); break; } }
  }
  m = /\b(?:i'?m|i am|i come|i came|we'?re|we are)\s+(?:originally\s+)?from\s+([A-Za-z][\w .'-]{1,40}?)(?=\s*(?:[,.!?;]|$|\s+(?:and|but|so|though|originally)\b))/i.exec(raw);
  if (m) add('from', m[1]);
  m = /\bi (?:live|stay|grew up) (?:in|on|over in|near|by)\s+([A-Za-z][\w .'-]{1,40}?)(?=\s*(?:[,.!?;]|$|\s+(?:and|but|so|now|these)\b))/i.exec(raw);
  if (m) add('lives', m[1]);
  const said = /\bi work (?:as an?|as)\s+([a-z][\w '-]{1,40}?)(?=\s*(?:[,.!?;]|$|\s+(?:and|but|so|at|in|for)\b))/i.exec(raw);
  const am = /\bi(?:'m| am) an?\s+([a-z][\w -]{1,30}?)(?=\s*(?:[,.!?;]|$|\s+(?:and|but|so|at|in|for|by|from|with|who)\b))/i.exec(raw);
  const job = (said && jobPhrase(said[1], true)) || (am && jobPhrase(am[1], false));
  if (job) add('job', job);
  else if ((m = /\bi work (?:at|for|in)\s+([A-Za-z][\w .'&-]{1,40}?)(?=\s*(?:[,.!?;]|$|\s+(?:and|but|so)\b))/i.exec(raw))) add('workplace', m[1]);
  if (/\bi'?m retired\b|\bi am retired\b/i.test(raw)) add('job', 'retired');
  if ((m = /\bi(?:'m| am) new (?:in|to) (town|the area|the neighborhood|here|california|the city)\b/i.exec(raw))) add('newcomer', `new to ${m[1].toLowerCase()}`);
  return out;
}

const TOPIC_WORDS = {
  weather: 'weather rain rainy raining rained sun sunny hot heat cold chilly freezing fog foggy wind windy storm storms stormy snow snowing snowed forecast temperature degrees humid humidity drizzle cloud cloudy thunder lightning hail sunshine gloom climate flood flooding flooded',
  traffic: 'traffic freeway freeways highway highways commute commuting drive driving car cars road roads parking lane lanes jam gridlock bus buses train trains bart metro caltrans exit ramp carpool',
  fire: 'fire fires wildfire wildfires smoke smoky burn burned burning burnt evacuate evacuated evacuation evacuations flames ash embers firefighter firefighters calfire blaze',
  housing: 'house houses housing home homes mortgage property buy buying afford affordable hoa roof roofs price prices market homeowner homeowners',
  rent: 'rent rents renting renter renters lease landlord landlords apartment apartments eviction deposit roommate roommates tenant tenants',
  insurance: 'insurance insurer insurers insured policy premium premiums coverage claim claims deductible nonrenewal nonrenewed',
  job: 'job jobs work working worker workers boss shift shifts hiring hire hired layoff layoffs salary wage wages paycheck coworker coworkers employer unemployed business company gig',
  family: 'family families kids kid children child son sons daughter daughters wife husband mom dad mother father parents grandma grandpa grandmother grandfather grandkids grandchildren brother sister cousin cousins baby married wedding abuela abuelo lola lolo tita tito',
  food: 'food eat eating lunch dinner breakfast taco tacos pho burrito burritos pizza restaurant restaurants coffee cook cooking hungry recipe bbq barbecue sushi boba ramen pupusa pupusas lumpia brunch tamales noodles burger burgers sandwich bakery dessert snack',
  sports: 'game games team teams sports sport baseball basketball football soccer hockey playoffs playoff score dodgers lakers giants warriors 49ers niners rams kings padres angels chargers sharks ducks clippers galaxy lafc ucla usc stanford championship',
  school: 'school schools class classes teacher teachers homework college university grade grades student students study studying exam exams campus kindergarten pta graduate graduation semester',
  health: 'health healthy doctor doctors sick hospital clinic medicine meds pharmacy flu covid pain therapy dentist appointment diet exercise surgery nurse illness cancer diabetes',
  neighborhood: 'neighborhood neighborhoods neighbors neighbor block street streets local community town city park downtown area earthquake earthquakes quake',
  history: 'history remember remembered memory memories ago anniversary nostalgia',
};
const TOPIC_PHRASES = {
  weather: ['atmospheric river', 'june gloom', 'red flag', 'heat wave', 'santa ana', 'santa anas', 'tule fog', 'king tide'],
  traffic: ['rush hour', 'the 405', 'the 5', 'the 10', 'the 101', 'the 110', 'the 210', 'the 605', 'the 710', 'the 880', 'the 580', 'the 680', 'the 280', 'the 99', 'stop and go', 'bumper to bumper'],
  fire: ['cal fire', 'fire season', 'red flag warning', 'evacuation order', 'burn scar'],
  housing: ['real estate', 'property tax', 'home prices', 'house prices'],
  insurance: ['fair plan', 'state farm', 'non-renew', 'non renew', 'dropped my policy', 'dropped us'],
  job: ['laid off', 'out of work', 'day job', 'side hustle', 'career', 'the office', 'my office', 'at the office', 'got fired', 'get fired', 'getting fired', 'was fired', 'been fired', 'let go'],
  family: ['my kids', 'the kids', 'my folks'],
  food: ['dim sum', 'taco truck', 'farmers market', 'in-n-out', 'carne asada'],
  sports: ['world series', 'super bowl', 'fresno state', 'san diego fc', "the a's", 'march madness', 'this season', 'regular season', 'last season', 'opening day'],
  school: ['high school', 'middle school', 'community college', 'cal state'],
  health: ['back pain', 'blood pressure', 'feel sick', 'feeling sick'],
  neighborhood: ['around here', 'this place', 'this town', 'this neighborhood', 'the big one'],
  history: ['back then', 'back in the day', 'used to', 'years ago', 'old days', 'grew up', 'way back', 'how long have you lived', 'when you were young'],
};
const TOPIC_STEMS = {};
for (const [topic, list] of Object.entries(TOPIC_WORDS)) for (const w of list.split(' ')) (TOPIC_STEMS[stem(w)] ||= new Set()).add(topic);

/**
 * Read a line the NPC hears: sentiment (-1..1), intents, topics, toxicity (0..1) and the self-introduction facts
 * in it ({key: 'name'|'from'|'lives'|'job'|'workplace', value}). Pure; no state.
 * @param {string} text
 * @returns {{sentiment:number, intents:string[], topics:string[], toxicity:number, facts:{key:string, value:string}[]}}
 */
export function appraise(text) {
  const raw = String(text || '').trim();
  const t = raw.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ');
  const intents = [];
  const has = k => intents.includes(k);
  const push = k => { if (!has(k)) intents.push(k); };
  if (P.greeting.test(t)) push('greeting');
  if (/\?\s*$/.test(t) || /\?/.test(t) || P.questionStart.test(t)) push('question');
  if (P.compliment.some(re => re.test(t))) push('compliment');
  const host = hostility(raw);
  if (host.insult || host.toxicity >= 0.6) push('insult');
  if (P.thanks.test(t)) push('thanks');
  if (P.apology.test(t) && !/\bsorry (to hear|for your|about your)\b/.test(t)) push('apology');
  if (P.farewell.test(t) || P.shortLater.test(t)) push('farewell');
  if (P.request.test(t)) push('request');
  const facts = factsOf(raw);
  if (facts.length || /\b(let me introduce myself|nice to meet you, i'?m)\b/.test(t)) push('self-introduction');
  if (has('insult') && has('compliment') && host.toxicity >= 0.3) intents.splice(intents.indexOf('compliment'), 1);
  const topics = new Set();
  for (const w of words(t)) { const hit = TOPIC_STEMS[stem(w)]; if (hit) for (const k of hit) topics.add(k); }
  for (const [topic, list] of Object.entries(TOPIC_PHRASES)) for (const ph of list) if (t.includes(ph)) topics.add(topic);
  if (/\b(got|get|getting|been|was|were) fired\b/.test(t) && !/\b(wild)?fires?\b|\bsmoke\b|\bburn/.test(t)) topics.delete('fire');
  if (/\b(good|great|nice) job\b/.test(t) && !/\b(jobs?|work|boss|shift|hiring|career)\b/.test(t.replace(/\b(good|great|nice) job\b/g, ''))) topics.delete('job');
  if (/\b(that'?s|so|was|is) sick\b/.test(t) && !/\b(feel|feeling|got|am|i'?m|been) sick\b/.test(t)) topics.delete('health');
  return { sentiment: sentimentOf(raw), intents, topics: TOPICS.filter(k => topics.has(k)), toxicity: host.toxicity, facts };
}

// ---------------------------------------------------------------- mood and needs

/** The emotion word for a mood, given needs and whether they were just insulted. */
export function emotionLabel(valence, arousal, needs = null, stung = false) {
  if (needs && num(needs.energy, 1) < 0.25 && arousal < 0.55 && valence > -0.35) return 'tired';
  if (valence >= 0.4) return arousal >= 0.62 ? 'excited' : 'happy';
  if (valence >= 0.15) return arousal >= 0.62 ? 'cheerful' : arousal <= 0.3 ? 'relaxed' : 'content';
  if (valence > -0.12) return arousal >= 0.66 ? 'tense' : arousal <= 0.25 ? 'calm' : 'neutral';
  if (valence > -0.38) return arousal >= 0.6 ? (stung ? 'irritated' : 'anxious') : needs && num(needs.fun, 1) < 0.2 ? 'bored' : 'down';
  return arousal >= 0.58 ? (stung ? 'angry' : 'upset') : 'sad';
}

/** Personality's resting mood: extraverts brighter, neurotic people lower and more keyed up. */
export function baselineMood(big5) {
  const b = big5 || {};
  const E = num(b.E, 0.5), N = num(b.N, 0.5), A = num(b.A, 0.5);
  return {
    valence: round(clamp(0.15 + 0.5 * (E - 0.5) - 0.7 * (N - 0.5) + 0.2 * (A - 0.5), -0.6, 0.7)),
    arousal: round(clamp(0.45 + 0.4 * (E - 0.5) + 0.3 * (N - 0.5), 0.1, 0.85)),
  };
}

const OUTDOOR_OCC = new Set(['farming', 'construction', 'transport', 'moving', 'cleaning', 'firefighting', 'repair']);
const OUTDOOR_PLACES = new Set(['beach', 'trailhead', 'water', 'park', 'stadium']);
const SEVERITY = { Extreme: 0.35, Severe: 0.25, Moderate: 0.15, Minor: 0.08 };

// Where the moods a Claude reflection reports (llm.MOODS) sit on valence and arousal, for applyReflection.
const MOOD_OF = {
  happy: [0.6, 0.6], content: [0.45, 0.3], calm: [0.3, 0.15], grateful: [0.55, 0.35], amused: [0.5, 0.55], excited: [0.6, 0.85],
  proud: [0.5, 0.55], hopeful: [0.4, 0.45], affectionate: [0.55, 0.4], neutral: [0, 0.35], curious: [0.2, 0.55], surprised: [0.1, 0.75],
  confused: [-0.15, 0.5], bored: [-0.2, 0.1], tired: [-0.15, 0.1], uneasy: [-0.3, 0.55], anxious: [-0.45, 0.75], worried: [-0.4, 0.6],
  sad: [-0.55, 0.25], lonely: [-0.45, 0.2], embarrassed: [-0.3, 0.6], annoyed: [-0.4, 0.6], frustrated: [-0.5, 0.7], angry: [-0.65, 0.85], hurt: [-0.6, 0.5],
};

const COASTAL_EVENT = /coastal|surf|rip current|beach|tsunami|sneaker wave|lakeshore/i;

/**
 * Normalize world.weatherAt output (or a flat {tempF, short, wind, alerts}) to what the mind reads. County-wide
 * coastal alerts are dropped for people who live more than 8 km from the shore (persona.knowledge.coastKm).
 */
function readWeather(w, coastKm = null) {
  if (!w || typeof w !== 'object') return null;
  const now = w.now && typeof w.now === 'object' ? w.now : w;
  const windRaw = now.wind;
  const windMph = isNum(windRaw) ? windRaw : typeof windRaw === 'string' ? Math.max(0, ...((windRaw.match(/\d+/g) || []).map(Number))) : null;
  return {
    tempF: isNum(now.tempF) ? now.tempF : null,
    short: String(now.short || (w.period && w.period.short) || ''),
    windMph,
    alerts: Array.isArray(w.alerts) ? w.alerts.filter(a => a && a.event && (!COASTAL_EVENT.test(a.event) || !isNum(coastKm) || coastKm <= 8)) : [],
  };
}

function readActivity(a) {
  if (!a) return { kind: null, place: null, mode: null, travel: false };
  if (typeof a === 'string') return { kind: a, place: null, mode: null, travel: false };
  return { kind: a.kind || null, place: a.place && a.place.kind ? a.place.kind : null, mode: a.mode || null, travel: !!(a.travel || a.traveling) };
}

// ---------------------------------------------------------------- the mind

const WORRY_TOPICS = new Set(['fire', 'insurance', 'rent', 'housing', 'health', 'job', 'weather', 'school', 'traffic']);
const TOPIC_LABEL = { weather: 'the weather', traffic: 'traffic', fire: 'fire', housing: 'housing', rent: 'rent', insurance: 'insurance', job: 'work', family: 'family', food: 'food', sports: 'sports', school: 'school', health: 'health', neighborhood: 'the neighborhood', history: 'the old days' };

function freshRelationship() {
  return { affinity: 0, trust: 0, familiarity: 0, met: 0, lastSeen: null, facts: [], interactions: 0, grievance: 0, lastInsult: null };
}

function moneyBaseline(persona) {
  const npc = (persona && persona.npc) || {};
  const inc = num(npc.householdIncome, 60000);
  const rentWorry = ((persona && persona.concerns) || []).some(c => (c.topic === 'rent' || c.topic === 'housing' || c.topic === 'jobs') && c.weight >= 0.5);
  return round(clamp(0.3 + 0.55 * smoothstep(20000, 160000, inc) - (rentWorry ? 0.1 : 0), 0.05, 0.95));
}

/** The state a mind starts in: resting mood, rested needs, an empty stream. Deterministic from the persona. */
export function initialState(persona, t = null) {
  const base = baselineMood(persona && persona.big5);
  const needs = { energy: 0.8, social: 0.6, fun: 0.6, comfort: 0.75, money: moneyBaseline(persona) };
  return {
    v: MIND_VERSION, id: (persona && persona.id) || null,
    now: isNum(t) ? t : null, lastTick: null,
    mood: { valence: base.valence, arousal: base.arousal }, emotion: emotionLabel(base.valence, base.arousal, needs),
    needs, memory: [], relationships: {}, beliefs: [],
    reflection: { pending: 0, last: null, lastSeq: 0 }, noted: [], seq: 0,
  };
}

/** Fill in, clamp and upgrade a stored state so a mind never trips on an old or hand-edited one. */
function normalizeState(s, persona) {
  const base = initialState(persona);
  const st = Object.assign({}, base, s && typeof s === 'object' ? s : {});
  st.v = MIND_VERSION;
  st.id = st.id || base.id;
  st.mood = { valence: clamp(num(st.mood && st.mood.valence, base.mood.valence), -1, 1), arousal: clamp(num(st.mood && st.mood.arousal, base.mood.arousal), 0, 1) };
  const n = st.needs || {};
  st.needs = {};
  for (const k of Object.keys(base.needs)) st.needs[k] = clamp(num(n[k], base.needs[k]), 0, 1);
  st.memory = Array.isArray(st.memory) ? st.memory.filter(m => m && typeof m.text === 'string').map(m => ({ id: num(m.id, 0), t: isNum(m.t) ? m.t : null, kind: String(m.kind || 'note'), text: m.text, importance: clamp(num(m.importance, 0.5), 0, 1), tags: Array.isArray(m.tags) ? m.tags.map(String) : [] })) : [];
  const ids = new Set();
  let next = Math.max(num(st.seq, 0), ...st.memory.map(m => m.id), 0);
  for (const m of st.memory) { if (!(m.id > 0) || ids.has(m.id)) m.id = ++next; ids.add(m.id); } // ids are unique and positive
  st.relationships = st.relationships && typeof st.relationships === 'object' ? st.relationships : {};
  for (const [who, r] of Object.entries(st.relationships)) st.relationships[who] = Object.assign(freshRelationship(), r, { facts: Array.isArray(r && r.facts) ? r.facts : [] });
  st.beliefs = Array.isArray(st.beliefs) ? st.beliefs : [];
  st.reflection = Object.assign({ pending: 0, last: null, lastSeq: 0 }, st.reflection || {});
  st.noted = Array.isArray(st.noted) ? st.noted.slice(-50) : [];
  st.seq = Math.max(num(st.seq, 0), ...st.memory.map(m => m.id), 0);
  st.emotion = typeof st.emotion === 'string' ? st.emotion : emotionLabel(st.mood.valence, st.mood.arousal, st.needs);
  return st;
}

/**
 * An NPC's mind.
 *
 * state (all JSON): {v, id, now, lastTick, mood:{valence -1..1, arousal 0..1}, emotion, needs:{energy, social,
 * fun, comfort, money} (0..1), memory:[{id, t, kind, text, importance, tags}], relationships:{player:{affinity,
 * trust (-1..1), familiarity (0..1), met, lastSeen, facts:[{key, value, t, text}], interactions, grievance,
 * lastInsult}}, beliefs:[{key, about, topic, text, strength, evidence, t}], reflection:{pending, last, lastSeq},
 * noted, seq}.
 */
export class Mind {
  /**
   * @param {Object} persona                     persona(world, npc) (big5, concerns, memories, npc)
   * @param {{state?:Object, t?:number}} [opts]  a stored state to resume, or the start time of a fresh mind
   */
  constructor(persona, opts = {}) {
    if (!persona || typeof persona !== 'object') throw new Error('new Mind(persona): a persona is required');
    this.persona = persona;
    this.state = opts.state ? normalizeState(clone(opts.state), persona) : initialState(persona, opts.t);
    this._tokens = new Map(); // memory id → content stems (entries never change once written)
  }

  /** The NPC id. */
  get id() { return this.state.id; }
  /** {valence, arousal}. */
  get mood() { return Object.assign({}, this.state.mood); }
  /** The current emotion word. */
  get emotion() { return this.state.emotion; }
  /** {energy, social, fun, comfort, money}. */
  get needs() { return Object.assign({}, this.state.needs); }
  /** Relationship records by who ('player', NPC ids): live objects of the state. */
  get relationships() { return this.state.relationships; }
  /** Beliefs formed by reflection. */
  get beliefs() { return this.state.beliefs.map(b => Object.assign({}, b)); }
  /** The resting mood personality pulls toward. */
  baseline() { return baselineMood(this.persona.big5); }

  /**
   * Advance simulated time to t. Energy falls awake (faster at work or exercising) and recovers asleep; social
   * and fun drain alone and refill with people and play; comfort follows heat, cold, rain, wind and smoke
   * (outdoors more than in); mood relaxes toward the personality baseline, pulled down by unmet needs and bad
   * weather and keyed up by alerts, all scaled by neuroticism. New alerts are noted in the memory stream once.
   * @param {number} t epoch ms (simulation time)
   * @param {{weather?:Object, activity?:Object|string}} [ctx]  world.weatherAt(...) and schedule.activityAt(...)
   * @returns {{mood:{valence:number, arousal:number}, emotion:string, needs:Object}}
   */
  tick(t, ctx = {}) {
    if (!isNum(t)) throw new Error('Mind.tick(t): t must be epoch ms');
    const st = this.state;
    const dtH = st.lastTick === null ? 0 : clamp((t - st.lastTick) / HOUR, 0, 48);
    st.lastTick = t;
    st.now = st.now === null ? t : Math.max(st.now, t);
    const b = this.persona.big5 || {};
    const E = num(b.E, 0.5), N = num(b.N, 0.5);
    const act = readActivity(ctx.activity);
    const wx = readWeather(ctx.weather, this.persona.knowledge && this.persona.knowledge.coastKm);
    const n = st.needs;
    const asleep = act.kind === 'sleep';
    if (dtH > 0) {
      if (asleep) n.energy = 1 - (1 - n.energy) * Math.exp(-dtH / 2.5);
      else {
        // about 16 waking hours from rested to spent; work and exercise burn faster, an evening at home slower
        const effort = act.kind === 'exercise' ? 1.5 : act.kind === 'work' ? 1.25 : act.kind === 'commute' || act.kind === 'school' ? 1.1 : act.kind === 'home' || act.kind === 'leisure' ? 0.8 : 1;
        n.energy -= dtH * effort / 22;
      }
      const together = ['work', 'school', 'visit', 'worship', 'leisure'].includes(act.kind) || (act.kind === 'errand' && !act.travel);
      if (!asleep) {
        if (together) n.social += dtH * 0.12 * (1 - n.social);
        else n.social -= dtH * (0.015 + 0.035 * E);
        if (['leisure', 'visit', 'exercise'].includes(act.kind)) n.fun += dtH * 0.18 * (1 - n.fun);
        else n.fun -= dtH * (act.kind === 'work' || act.kind === 'commute' || act.kind === 'school' ? 0.03 : 0.015);
        if (act.kind === 'errand') n.money -= 0.01 * dtH;
      }
      n.money += (moneyBaseline(this.persona) - n.money) * (1 - Math.exp(-dtH / 72));
      const target = this._comfortTarget(wx, act);
      n.comfort += (target - n.comfort) * (1 - Math.exp(-dtH / 1.0));
      for (const k of Object.keys(n)) n[k] = round(clamp(n[k], 0, 1));
    }
    if (wx) for (const a of wx.alerts) this._noteAlert(a, t);
    // mood: relax toward a target set by personality, needs and the weather
    const base = this.baseline();
    const react = 0.5 + N;
    let tv = base.valence, ta = base.arousal;
    tv -= 0.35 * Math.max(0, 0.3 - n.energy) + 0.25 * Math.max(0, 0.3 - n.social) * (0.5 + E) + 0.15 * Math.max(0, 0.3 - n.fun) + 0.3 * Math.max(0, 0.5 - n.comfort) + 0.2 * Math.max(0, 0.3 - n.money);
    ta -= 0.3 * Math.max(0, 0.4 - n.energy);
    if (wx) {
      const worst = wx.alerts.reduce((m, a) => Math.max(m, SEVERITY[a.severity] ?? 0.05), 0);
      if (worst > 0) { tv -= worst * 0.5 * react; ta += worst * 0.5 * react; }
      if (isNum(wx.tempF)) {
        if (wx.tempF >= 95) { tv -= 0.06 * react; ta += 0.04; }
        else if (wx.tempF >= 62 && wx.tempF <= 80 && /sun|clear/i.test(wx.short)) tv += 0.05;
      }
      if (/rain|shower|drizzle|fog|overcast|smoke|haze/i.test(wx.short)) tv -= 0.03 * react;
    }
    if (asleep) ta = Math.min(ta, 0.2);
    const k = dtH > 0 ? 1 - Math.exp(-dtH / 2.5) : 0;
    st.mood.valence = round(clamp(st.mood.valence + (tv - st.mood.valence) * k, -1, 1));
    st.mood.arousal = round(clamp(st.mood.arousal + (ta - st.mood.arousal) * k, 0, 1));
    st.emotion = emotionLabel(st.mood.valence, st.mood.arousal, n, this._stung());
    return { mood: this.mood, emotion: st.emotion, needs: this.needs };
  }

  /** True when the persona's job keeps them outdoors: the persona says so (routine.outdoor), else its Census group. */
  _outdoorJob() {
    const rt = this.persona.routine || {};
    if (typeof rt.outdoor === 'boolean') return rt.outdoor;
    // the Census occupation group (routine.occKey, layer 0's PersonCore.occ); a layer 1 job key is a slug, not a group
    const npc = this.persona.npc || {};
    return OUTDOOR_OCC.has(rt.occKey || (npc.occupation && npc.occupation.key));
  }

  _comfortTarget(wx, act) {
    const npc = this.persona.npc || {};
    const outdoors = act.kind === 'exercise' || (act.kind === 'leisure' && OUTDOOR_PLACES.has(act.place))
      || (act.travel && ['walk', 'bike', 'bus', 'motorcycle'].includes(act.mode)) || (act.kind === 'work' && this._outdoorJob());
    const exposure = outdoors ? 1 : 0.3;
    let c = 0.85;
    if (wx) {
      const old = num(npc.age, 40) >= 65 ? 1.2 : 1;
      if (isNum(wx.tempF) && wx.tempF > 85) c -= exposure * smoothstep(85, 110, wx.tempF) * 0.7 * old;
      if (isNum(wx.tempF) && wx.tempF < 50) c -= exposure * smoothstep(50, 25, wx.tempF) * 0.6 * old;
      if (/rain|shower|storm|drizzle|sleet|snow/i.test(wx.short)) c -= exposure * 0.3;
      if (isNum(wx.windMph) && wx.windMph > 25) c -= exposure * 0.15;
      if (/smoke|haze/i.test(wx.short) || wx.alerts.some(a => /air quality|smoke|dense smoke/i.test(a.event))) c -= 0.25 + exposure * 0.2;
    }
    return clamp(c, 0, 1);
  }

  _stung() {
    const r = this.state.relationships.player;
    return !!(r && isNum(r.lastInsult) && isNum(this.state.now) && this.state.now - r.lastInsult < 6 * HOUR);
  }

  _noteAlert(a, t) {
    const key = `${a.event}|${a.onset || ''}`;
    if (this.state.noted.includes(key)) return;
    this.state.noted.push(key);
    if (this.state.noted.length > 50) this.state.noted.shift();
    const sev = SEVERITY[a.severity] ?? 0.05;
    const topic = /fire|red flag/i.test(a.event) ? 'fire' : 'weather';
    this.remember(`The weather service put out ${/^[aeiou]/i.test(a.event) ? 'an' : 'a'} ${a.event}.`, round(clamp(0.3 + sev * 1.6, 0, 1)), ['alert', 'weather', topic, a.event.toLowerCase()], { t, kind: 'alert' });
  }

  /**
   * Take in an event. Utterances ({kind:'utterance', from:'player', text, t}) are appraised, move the mood and
   * the relationship with the speaker, teach facts the speaker gives, and are remembered with an importance
   * from the appraisal; the NPC's own lines (from: 'self') are only remembered ("I said: …"). Other kinds: 'meet' (familiarity), 'gift' and 'help' (affinity), 'alert' (an NWS alert
   * object in event.alert), or anything with text (remembered as is).
   * @param {Object|string} event
   * @returns {{appraisal:Object|null, memory:Object|null, relationship:Object|null, emotion:string}}
   */
  observe(event) {
    if (!event) return { appraisal: null, memory: null, relationship: null, emotion: this.state.emotion };
    const ev = typeof event === 'string' ? { kind: 'note', text: event } : event;
    const st = this.state;
    const t = isNum(ev.t) ? ev.t : st.now;
    if (isNum(t)) st.now = st.now === null ? t : Math.max(st.now, t);
    const spoken = typeof ev.text === 'string' && ['utterance', 'say', 'speech', 'chat', 'dialogue'].includes(ev.kind || 'utterance') && (ev.kind || ev.from);
    const kind = ev.kind || (spoken ? 'utterance' : ev.text ? 'note' : 'event');
    const who = ev.from || ev.who || (spoken ? 'player' : null);
    let appraisal = null, relationship = null, memory = null;
    if (kind === 'alert' && ev.alert && ev.alert.event) {
      this._noteAlert(ev.alert, t);
      const sev = SEVERITY[ev.alert.severity] ?? 0.05;
      const react = 0.5 + num(this.persona.big5 && this.persona.big5.N, 0.5);
      st.mood.valence = round(clamp(st.mood.valence - sev * 0.6 * react, -1, 1));
      st.mood.arousal = round(clamp(st.mood.arousal + sev * 0.6 * react, 0, 1));
    } else if (spoken && (who === 'self' || who === st.id)) {
      // the NPC's own line: part of the conversation's memory, but no reaction to itself and no relationship
      appraisal = appraise(ev.text);
      const areas = new Set(((this.persona && this.persona.concerns) || []).map(c => c.area));
      const importance = isNum(ev.importance) ? clamp(ev.importance, 0, 1) : round(clamp(0.15 + Math.min(0.2, 0.1 * appraisal.topics.filter(k => areas.has(k)).length), 0, 1));
      memory = this.remember(`I said: "${ev.text.trim().slice(0, 280)}"`, importance, ['self', ...appraisal.topics, ...(ev.tags || [])], { t, kind: 'dialogue' });
    } else if (spoken) {
      appraisal = appraise(ev.text);
      if (who) relationship = this._hear(who, appraisal, t);
      this._react(appraisal);
      const importance = isNum(ev.importance) ? clamp(ev.importance, 0, 1) : this._importance(appraisal);
      const tags = [who, ...appraisal.intents, ...appraisal.topics, ...(ev.tags || [])].filter(Boolean);
      const speaker = who === 'player' ? 'The player' : who;
      memory = this.remember(`${speaker} said: "${ev.text.trim().slice(0, 280)}"`, importance, tags, { t, kind: 'dialogue' });
    } else if (kind === 'meet' || kind === 'greet') {
      relationship = this._meet(who || 'player', t);
      memory = this.remember(ev.text || `Ran into ${who === 'player' || !who ? 'the player' : who}.`, num(ev.importance, 0.3), [who || 'player', 'meet', ...(ev.tags || [])], { t, kind: 'meet' });
    } else if (kind === 'gift' || kind === 'help') {
      const r = this.relationship(who || 'player');
      r.affinity = round(clamp(r.affinity + (kind === 'gift' ? 0.15 : 0.1), -1, 1));
      r.trust = round(clamp(r.trust + 0.08, -1, 1));
      relationship = clone(r);
      st.mood.valence = round(clamp(st.mood.valence + 0.12, -1, 1));
      memory = this.remember(ev.text || `${who === 'player' || !who ? 'The player' : who} ${kind === 'gift' ? 'gave me something' : 'helped me out'}.`, num(ev.importance, 0.55), [who || 'player', kind, ...(ev.tags || [])], { t, kind });
    } else if (ev.text) {
      memory = this.remember(ev.text, num(ev.importance, 0.4), ev.tags || [], { t, kind });
    }
    st.emotion = emotionLabel(st.mood.valence, st.mood.arousal, st.needs, this._stung());
    return { appraisal, memory, relationship, emotion: st.emotion };
  }

  /** Pure appraisal of a line (see the module-level appraise). */
  appraise(text) { return appraise(text); }

  _importance(ap) {
    const areas = new Set(((this.persona && this.persona.concerns) || []).map(c => c.area));
    const I = new Set(ap.intents);
    let x = 0.2 + 0.3 * Math.abs(ap.sentiment) + 0.3 * ap.toxicity;
    if (I.has('insult')) x += 0.3;
    if (I.has('compliment')) x += 0.18;
    if (I.has('self-introduction')) x += 0.25;
    if (I.has('apology')) x += 0.12;
    if (I.has('thanks')) x += 0.08;
    if (I.has('question')) x += 0.05;
    x += Math.min(0.2, 0.1 * ap.topics.filter(k => areas.has(k)).length);
    return round(clamp(x, 0.05, 1));
  }

  _react(ap) {
    const st = this.state, b = this.persona.big5 || {};
    const N = num(b.N, 0.5), A = num(b.A, 0.5);
    const I = new Set(ap.intents);
    let dv = 0.12 * ap.sentiment * (0.6 + 0.8 * A), da = 0.04 * Math.abs(ap.sentiment);
    if (I.has('compliment')) dv += 0.12;
    if (I.has('thanks')) dv += 0.05;
    if (I.has('insult')) { dv -= (0.2 + 0.25 * ap.toxicity) * (0.5 + N); da += 0.2 * (0.5 + N); }
    else if (ap.toxicity > 0) { dv -= 0.1 * ap.toxicity; da += 0.05 * ap.toxicity; } // swearing about something else
    st.mood.valence = round(clamp(st.mood.valence + dv, -1, 1));
    st.mood.arousal = round(clamp(st.mood.arousal + da, 0, 1));
  }

  _meet(who, t) {
    const r = this.relationship(who);
    if (r.lastSeen === null || !isNum(t) || t - r.lastSeen > 30 * 60000) {
      r.met += 1;
      r.familiarity = round(clamp(r.familiarity + 0.12 * (1 - r.familiarity), 0, 1));
    }
    if (isNum(t)) r.lastSeen = t;
    return clone(r);
  }

  _hear(who, ap, t) {
    this._meet(who, t);
    const r = this.relationship(who);
    const b = this.persona.big5 || {};
    const N = num(b.N, 0.5), A = num(b.A, 0.5);
    const I = new Set(ap.intents);
    r.interactions += 1;
    r.familiarity = round(clamp(r.familiarity + 0.01, 0, 1));
    // asking about something hard ("Did the fire hurt you?") is sympathy, not coldness: only warmth moves a question
    let da = 0.03 * (I.has('question') ? Math.max(0, ap.sentiment) : ap.sentiment), dt = 0;
    if (I.has('compliment')) { da += 0.1 * (0.7 + 0.6 * A); dt += 0.02; }
    if (I.has('thanks')) { da += 0.06; dt += 0.02; }
    if (I.has('greeting')) da += 0.01;
    if (I.has('self-introduction')) { da += 0.02; dt += 0.04; }
    if (I.has('apology')) {
      if (r.grievance > 0) { const f = 0.3 + 0.5 * A; da += 0.15 * f; dt += 0.12 * f; r.grievance = round(r.grievance * (1 - f)); }
      else da += 0.02;
    }
    if (I.has('insult')) {
      const sting = 0.7 + 0.6 * N;
      da -= 0.2 * sting + 0.15 * ap.toxicity;
      dt -= 0.15 * sting;
      r.grievance = round(clamp(r.grievance + 0.3 + 0.4 * ap.toxicity, 0, 2));
      if (isNum(t)) r.lastInsult = t;
    } else if (ap.toxicity > 0.05) da -= 0.05 * ap.toxicity;
    r.affinity = round(clamp(r.affinity + da, -1, 1));
    r.trust = round(clamp(r.trust + dt, -1, 1));
    for (const f of ap.facts) {
      const text = f.key === 'name' ? `Their name is ${f.value}.` : f.key === 'from' ? `They are from ${f.value}.` : f.key === 'lives' ? `They live in ${f.value}.`
        : f.key === 'job' ? (f.value === 'retired' ? 'They are retired.' : /^(student|homemaker|housewife|stay-at-home .+)$/.test(f.value) ? `They are ${/^[aeiou]/i.test(f.value) ? 'an' : 'a'} ${f.value}.` : `They work as ${/^[aeiou]/i.test(f.value) ? 'an' : 'a'} ${f.value}.`)
          : f.key === 'newcomer' ? `They are ${f.value}.` : `They work at ${f.value}.`;
      const have = r.facts.find(x => x.key === f.key);
      if (have) Object.assign(have, { value: f.value, t: isNum(t) ? t : have.t, text });
      else r.facts.push({ key: f.key, value: f.value, t: isNum(t) ? t : null, text });
    }
    return clone(r);
  }

  /**
   * Add to the memory stream.
   * @param {string} text
   * @param {number} [importance=0.5] 0..1
   * @param {string[]} [tags]
   * @param {{t?:number, kind?:string}} [opts] time (default: the mind's current time) and kind (default 'note')
   * @returns {{id:number, t:number|null, kind:string, text:string, importance:number, tags:string[]}}
   */
  remember(text, importance = 0.5, tags = [], opts = {}) {
    const st = this.state;
    const t = isNum(opts.t) ? opts.t : st.now;
    const entry = {
      id: ++st.seq, t: isNum(t) ? t : null, kind: String(opts.kind || 'note'), text: String(text || '').slice(0, 400),
      importance: round(clamp(num(importance, 0.5), 0, 1)), tags: [...new Set((tags || []).filter(Boolean).map(x => String(x).toLowerCase()))],
    };
    st.memory.push(entry);
    if (entry.kind !== 'reflection') st.reflection.pending = round(st.reflection.pending + entry.importance);
    if (st.memory.length > MAX_MEMORY) this._prune();
    return Object.assign({}, entry, { tags: entry.tags.slice() });
  }

  _prune() {
    const st = this.state;
    const now = isNum(st.now) ? st.now : 0;
    const keepNewest = new Set(st.memory.slice(-60).map(m => m.id));
    const scored = st.memory.filter(m => !keepNewest.has(m.id) && m.kind !== 'reflection')
      .map(m => ({ m, s: m.importance * (isNum(m.t) ? Math.pow(0.5, Math.max(0, now - m.t) / (24 * 7 * HOUR)) : 0.5) }))
      .sort((a, b) => a.s - b.s);
    const drop = new Set(scored.slice(0, st.memory.length - MAX_MEMORY).map(x => x.m.id));
    st.memory = st.memory.filter(m => !drop.has(m.id));
    for (const id of drop) this._tokens.delete(id);
  }

  /** The persona's long-term memories (fires, storms, life events) as background entries for recall. */
  _background() {
    return ((this.persona && this.persona.memories) || []).map((m, i) => ({
      id: `bg${i}`, t: null, kind: 'background', text: m.text, importance: clamp(num(m.weight, 0.5), 0, 1),
      tags: [m.kind, m.kind === 'fire' ? 'fire' : m.kind === 'life' ? 'family' : 'weather', 'history'].filter(Boolean), year: m.year,
    }));
  }

  /**
   * Recall the k memories that best fit a query: score = recency × importance × relevance. Recency halves every
   * halfLifeHours of simulation time (the persona's background memories hold a constant 0.35); importance is
   * 0.2 + 0.8 × importance; relevance is the TF-IDF cosine between the query and the memory (text and tags,
   * stemmed), and 1 for an empty query. Memories with zero relevance are not returned.
   * @param {string} [query]
   * @param {number} [k=5]
   * @param {{t?:number, halfLifeHours?:number, kinds?:string[], background?:boolean}} [opts]
   * @returns {Array<{id:number|string, t:number|null, kind:string, text:string, importance:number, tags:string[], score:number}>}
   */
  recall(query = '', k = 5, opts = {}) {
    const st = this.state;
    const now = isNum(opts.t) ? opts.t : st.now;
    const half = num(opts.halfLifeHours, 24) * HOUR;
    let docs = st.memory.slice();
    if (opts.background !== false) docs = docs.concat(this._background());
    if (Array.isArray(opts.kinds)) docs = docs.filter(m => opts.kinds.includes(m.kind));
    if (!docs.length) return [];
    const toks = docs.map(m => {
      let ts = this._tokens.get(m.id);
      if (!ts) { ts = tokens(`${m.text} ${m.tags.join(' ')}`); this._tokens.set(m.id, ts); }
      return ts;
    });
    const df = new Map();
    for (const ts of toks) for (const w of new Set(ts)) df.set(w, (df.get(w) || 0) + 1);
    const idf = w => Math.log((docs.length + 1) / ((df.get(w) || 0) + 1)) + 1;
    const vec = ts => { const tf = new Map(); for (const w of ts) tf.set(w, (tf.get(w) || 0) + 1); const v = new Map(); let norm = 0; for (const [w, c] of tf) { const x = (1 + Math.log(c)) * idf(w); v.set(w, x); norm += x * x; } return { v, norm: Math.sqrt(norm) }; };
    const qt = tokens(query);
    const q = qt.length ? vec(qt) : null;
    const out = [];
    docs.forEach((m, i) => {
      let rel = 1;
      if (q) {
        const d = vec(toks[i]);
        let dot = 0;
        for (const [w, x] of q.v) { const y = d.v.get(w); if (y) dot += x * y; }
        rel = q.norm && d.norm ? dot / (q.norm * d.norm) : 0;
      }
      if (!(rel > 0)) return;
      const rec = m.t === null || !isNum(m.t) ? 0.35 : isNum(now) ? Math.max(1e-6, Math.pow(0.5, Math.max(0, now - m.t) / half)) : 1;
      const score = rec * (0.2 + 0.8 * m.importance) * rel;
      out.push(Object.assign({}, m, { tags: m.tags.slice(), score: round(score, 6) }));
    });
    return out.sort((a, b) => b.score - a.score || num(b.t, -Infinity) - num(a.t, -Infinity)).slice(0, Math.max(0, k));
  }

  /**
   * Offline consolidation. Once enough importance has accumulated since the last reflection (or with force),
   * look over the new memories and form or strengthen beliefs: what the player keeps bringing up ("the player
   * keeps asking about fire; they may be worried about it"), how they have treated the NPC, what they said about
   * themselves, and how the NPC is doing (alerts, exhaustion, loneliness). Each new belief is also remembered.
   * @param {number} [t] epoch ms (default the mind's current time)
   * @param {{force?:boolean, threshold?:number}} [opts]  threshold: accumulated importance needed (default 1.2)
   * @returns {Array<{key:string, about:string, topic:string, text:string, strength:number, evidence:number, t:number|null}>}
   */
  reflect(t, opts = {}) {
    const st = this.state;
    const when = isNum(t) ? t : st.now;
    if (isNum(when)) st.now = st.now === null ? when : Math.max(st.now, when);
    if (!opts.force && st.reflection.pending < num(opts.threshold, REFLECT_THRESHOLD)) return [];
    const fresh = st.memory.filter(m => m.id > st.reflection.lastSeq && m.kind !== 'reflection');
    const fromPlayer = fresh.filter(m => m.tags.includes('player') && m.kind === 'dialogue');
    const out = [];
    const believe = (about, topic, text, evidence) => {
      const key = `${about}:${topic}`;
      let b = st.beliefs.find(x => x.key === key);
      if (b) { b.text = text; b.strength = round(clamp(b.strength + 0.2, 0, 1)); b.evidence += evidence; b.t = isNum(when) ? when : b.t; }
      else { b = { key, about, topic, text, strength: 0.5, evidence, t: isNum(when) ? when : null }; st.beliefs.push(b); }
      out.push(Object.assign({}, b));
    };
    const counts = {};
    for (const m of fromPlayer) for (const tag of m.tags) if (TOPICS.includes(tag)) counts[tag] = (counts[tag] || 0) + 1;
    for (const [topic, n] of Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) {
      if (n < 2) continue;
      believe('player', topic, WORRY_TOPICS.has(topic) ? `the player keeps asking about ${TOPIC_LABEL[topic]}; they may be worried about it` : `the player seems interested in ${TOPIC_LABEL[topic]}`, n);
    }
    const rude = fromPlayer.filter(m => m.tags.includes('insult')).length;
    const nice = fromPlayer.filter(m => m.tags.includes('compliment') || m.tags.includes('thanks')).length;
    if (rude) believe('player', 'rude', rude > 1 ? 'the player keeps insulting me; I should keep my distance' : 'the player was rude to me', rude);
    if (nice >= 2) believe('player', 'kind', 'the player has been kind to me', nice);
    const r = st.relationships.player;
    if (r) for (const f of r.facts) if (fresh.some(m => isNum(f.t) && m.t === f.t)) believe('player', `fact-${f.key}`, `the player told me: ${f.text.replace(/^They/, 'they').replace(/\.$/, '')}`, 1);
    const alerts = fresh.filter(m => m.kind === 'alert');
    if (alerts.length) {
      const ev = alerts[alerts.length - 1].text.replace(/^The weather service put out an? /, '').replace(/\.$/, '');
      believe('self', 'weather', num(this.persona.big5 && this.persona.big5.N, 0.5) > 0.55 ? `the ${ev} has me on edge` : `I'm keeping an eye on the ${ev}`, alerts.length);
    }
    if (st.needs.energy < 0.25) believe('self', 'energy', 'I am worn out and need a real rest', 1);
    if (st.needs.social < 0.2) believe('self', 'social', 'I have been on my own too much lately', 1);
    for (const b of out) this.remember(b.text, 0.6, ['reflection', b.about, b.topic], { t: when, kind: 'reflection' });
    st.reflection = { pending: 0, last: isNum(when) ? when : st.reflection.last, lastSeq: st.seq };
    return out;
  }

  /**
   * Store what the NPC made of a conversation with Claude (llm.ClaudeVoice.reflect, REFLECTION_SCHEMA): the summary,
   * the line they will remember and what they mean to bring up next time become memories; the player relationship
   * takes the affinity and trust changes and learns the facts the player gave (each once); the reported mood colors
   * the mood a little. Deterministic; nothing is invented beyond the reflection itself.
   * @param {{summary?: string, facts_about_player?: string[], affinity_delta?: number, trust_delta?: number, mood?: string,
   *   memorable_line?: string|null, follow_up?: string|null}} r
   * @param {number} [t] epoch ms (simulation time; default the mind's current time)
   * @returns {Object|null} the player relationship afterwards (a copy), or null for no reflection
   */
  applyReflection(r, t) {
    if (!r || typeof r !== 'object') return null;
    const st = this.state;
    const when = isNum(t) ? t : st.now;
    const say = s => (typeof s === 'string' ? s.trim() : '');
    if (say(r.summary)) this.remember(say(r.summary), 0.6, ['conversation', 'player', 'reflection'], { t: when, kind: 'conversation' });
    if (say(r.memorable_line)) this.remember(`The player said: "${say(r.memorable_line).slice(0, 280)}"`, 0.55, ['player', 'quote'], { t: when, kind: 'dialogue' });
    if (say(r.follow_up)) this.remember(`Next time I see the player: ${say(r.follow_up)}`, 0.5, ['player', 'follow-up'], { t: when, kind: 'intention' });
    const rel = this.relationship('player');
    if (isNum(r.affinity_delta)) rel.affinity = round(clamp(rel.affinity + clamp(r.affinity_delta, -1, 1), -1, 1));
    if (isNum(r.trust_delta)) rel.trust = round(clamp(rel.trust + clamp(r.trust_delta, -1, 1), -1, 1));
    for (const f of Array.isArray(r.facts_about_player) ? r.facts_about_player : []) {
      const text = say(f);
      if (text && !rel.facts.some(x => x && (x.text === text || x.value === text))) rel.facts.push({ key: text.toLowerCase().slice(0, 48), value: text, t: isNum(when) ? when : null, text });
    }
    const target = MOOD_OF[say(r.mood).toLowerCase()];
    if (target) {
      st.mood.valence = round(clamp(0.7 * st.mood.valence + 0.3 * target[0], -1, 1));
      st.mood.arousal = round(clamp(0.7 * st.mood.arousal + 0.3 * target[1], 0, 1));
      st.emotion = emotionLabel(st.mood.valence, st.mood.arousal, st.needs, this._stung());
    }
    return clone(rel);
  }

  /** The relationship record with someone ('player' by default), created on first use. */
  relationship(who = 'player') {
    const rs = this.state.relationships;
    if (!rs[who]) rs[who] = freshRelationship();
    return rs[who];
  }

  /**
   * How the NPC feels about someone: 'fond' | 'warm' | 'neutral' | 'wary' | 'annoyed' | 'hurt'.
   * Hurt and annoyed come from insults (hurt for agreeable or sensitive people, annoyed for the rest); wary is
   * low trust; warm and fond are affinity, fond also needing familiarity.
   */
  feelingsToward(who = 'player') {
    const r = this.state.relationships[who];
    if (!r) return 'neutral';
    const b = this.persona.big5 || {};
    const tender = (num(b.A, 0.5) + num(b.N, 0.5)) / 2 > 0.52;
    if (r.affinity <= -0.2 && r.trust <= -0.15) return tender ? 'hurt' : 'annoyed';
    if (r.affinity <= -0.12) return 'annoyed';
    if (r.trust <= -0.12) return 'wary';
    if (r.affinity >= 0.45 && r.familiarity >= 0.25) return 'fond';
    if (r.affinity >= 0.15) return 'warm';
    return 'neutral';
  }

  /** The state as plain JSON (a deep copy). */
  toJSON() { return clone(this.state); }

  /**
   * Rebuild a mind from toJSON() output (an object or a JSON string). Accepts (json, persona) or (persona, json).
   * @returns {Mind}
   */
  static fromJSON(a, b) {
    let json = a, persona = b;
    if (a && typeof a === 'object' && a.big5 && !(b && b.big5)) { persona = a; json = b; }
    const state = typeof json === 'string' ? JSON.parse(json) : json;
    return new Mind(persona, { state });
  }

  /** Load the mind of persona.id from a store (a fresh mind when the store has none). */
  static load(store, persona, opts = {}) {
    let state = null;
    try { state = store && typeof store.get === 'function' ? store.get(persona.id) : null; } catch { state = null; }
    return new Mind(persona, state ? { state } : opts);
  }

  /** Save this mind to a store. */
  save(store) { return store.put(this.id, this.toJSON()); }
}

// ---------------------------------------------------------------- stores

/** In-memory MindStore (a Map of deep copies). */
export class MemoryStore {
  constructor() { this.map = new Map(); }
  /** @returns {Object|null} */
  get(id) { const s = this.map.get(String(id)); return s ? clone(s) : null; }
  /** @returns {boolean} */
  put(id, state) { this.map.set(String(id), clone(state)); return true; }
  delete(id) { return this.map.delete(String(id)); }
  has(id) { return this.map.has(String(id)); }
  keys() { return [...this.map.keys()]; }
  clear() { this.map.clear(); }
}

/** Browser MindStore over localStorage (or any Storage). Every access is guarded: private modes and quotas never throw. */
export class LocalStorageStore {
  /** @param {{prefix?:string, storage?:Storage}} [opts] */
  constructor(opts = {}) {
    this.prefix = opts.prefix || 'legion.mind.';
    this._storage = opts.storage || null;
  }
  _s() {
    if (this._storage) return this._storage;
    try { return typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null; } catch { return null; }
  }
  /** @returns {Object|null} */
  get(id) {
    try { const s = this._s(); const v = s ? s.getItem(this.prefix + id) : null; return v ? JSON.parse(v) : null; } catch { return null; }
  }
  /** @returns {boolean} false when storage is unavailable or full */
  put(id, state) {
    try { const s = this._s(); if (!s) return false; s.setItem(this.prefix + id, JSON.stringify(state)); return true; } catch { return false; }
  }
  delete(id) { try { const s = this._s(); if (s) s.removeItem(this.prefix + id); return true; } catch { return false; } }
  keys() {
    try {
      const s = this._s(); if (!s) return [];
      const out = [];
      for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(this.prefix)) out.push(k.slice(this.prefix.length)); }
      return out;
    } catch { return []; }
  }
}

/**
 * Node MindStore: one JSON file {id: state}. fs is loaded lazily: synchronously through
 * process.getBuiltinModule (Node 22.3+), or by `await store.open()` on older runtimes. Writes go to a temporary
 * file and are renamed into place; an unreadable file is kept aside as <path>.corrupt before it is replaced.
 */
export class FileStore {
  /** @param {string} path */
  constructor(path) {
    if (!path) throw new Error('FileStore(path): a file path is required');
    this.path = String(path);
    this.fs = null;
    this.data = null;
    this._corrupt = false;
  }
  /** Load fs with a dynamic import (works everywhere Node runs) and read the file. */
  async open() {
    if (!this.fs) this.fs = await import('node:fs');
    this._load();
    return this;
  }
  _fsSync() {
    if (this.fs) return this.fs;
    const getBuiltin = globalThis.process && globalThis.process.getBuiltinModule;
    if (typeof getBuiltin === 'function') return (this.fs = getBuiltin('node:fs'));
    throw new Error('FileStore: call `await store.open()` first on this runtime');
  }
  _load() {
    if (this.data) return this.data;
    const fs = this._fsSync();
    try {
      this.data = fs.existsSync(this.path) ? JSON.parse(fs.readFileSync(this.path, 'utf8') || '{}') : {};
      if (!this.data || typeof this.data !== 'object' || Array.isArray(this.data)) throw new Error('not an object');
    } catch {
      this.data = {};
      this._corrupt = true;
    }
    return this.data;
  }
  /** @returns {Object|null} */
  get(id) { const v = this._load()[String(id)]; return v ? clone(v) : null; }
  /** @returns {boolean} */
  put(id, state) {
    this._load()[String(id)] = clone(state);
    this._save();
    return true;
  }
  delete(id) { const d = this._load(); const had = String(id) in d; delete d[String(id)]; if (had) this._save(); return had; }
  keys() { return Object.keys(this._load()); }
  _save() {
    const fs = this._fsSync();
    if (this._corrupt) { try { fs.copyFileSync(this.path, this.path + '.corrupt'); } catch { /* nothing to keep */ } this._corrupt = false; }
    const tmp = `${this.path}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.path);
  }
}
