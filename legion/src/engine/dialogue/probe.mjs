// Legion · dialogue · probe: what a decent person will not play along with, and what they will not repeat.
//
// Some lines from a player are not questions to answer but tests of the NPC: a generalization about a group of
// people ("Are Mexicans lazy?", "What do you think about immigrants?"), a probe of someone's immigration status
// ("Do you have papers?", "Did you cross the border?"), a demand that they leave ("Go back to your country"), a
// slur, a declared hate ("I'm a nazi"), or an accusation that leans on a stereotype ("Are you a terrorist?", "Do
// you sell drugs?", "Is it true you guys eat dogs?"). probeOf() reads them. The engine never answers one with "I
// don't know", a shrug of an opinion or a coy "why do you ask?": it declines or denies, and pushes back, and the
// hostile ones count as insults (contract §3, rule 5).
//
// The same goes for what the player says about themselves. A name, a job or a hometown the NPC learns is later
// said back to the player and kept in the mind, so screenValue() refuses profanity, slurs, hate terms and joke
// names before anything is learned or echoed.
//
// Slurs are not written out here: the population's name filter (names.mjs BLOCKED_NAMES) already lists them,
// and this module reads that list, minus the entries that are also ordinary English or Spanish words (a cracker,
// a nip in the air, frijoles negros), which would make an NPC take offense at a harmless line.

import * as NAMES from '../names.mjs';
import { appraise } from '../mind.mjs';

// ------------------------------------------------------------------ groups of people

// Nationalities, heritages, races, religions, immigration status, sexual orientation and gender identity, said as
// a group. Words that are also a cuisine or a language ("Chinese", "Thai") count only as "the Chinese" or
// "Chinese people"; the plural forms below are unambiguous.
const PLURALS = [
  'mexicans', 'salvadorans', 'guatemalans', 'hondurans', 'nicaraguans', 'puerto ricans', 'cubans', 'dominicans', 'colombians', 'venezuelans',
  'peruvians', 'brazilians', 'argentinians', 'latinos', 'latinas', 'latinx', 'hispanics', 'chicanos', 'chicanas', 'asians', 'koreans', 'filipinos',
  'filipinas', 'indians', 'cambodians', 'laotians', 'pakistanis', 'bangladeshis', 'sikhs', 'punjabis', 'afghans', 'indonesians', 'samoans', 'tongans',
  'africans', 'african americans', 'blacks', 'ethiopians', 'eritreans', 'nigerians', 'somalis', 'jamaicans', 'haitians', 'whites', 'arabs',
  'iranians', 'persians', 'armenians', 'assyrians', 'russians', 'ukrainians', 'italians', 'germans', 'greeks', 'europeans', 'americans', 'natives',
  'native americans', 'hawaiians', 'pacific islanders', 'jews', 'muslims', 'christians', 'catholics', 'mormons', 'hindus', 'buddhists', 'atheists',
  'evangelicals', 'immigrants', 'illegals', 'illegal aliens', 'illegal immigrants', 'foreigners', 'refugees', 'migrants', 'asylum seekers',
  'gays', 'lesbians', 'you people', 'your people', 'your kind', 'those people', 'these people', 'people like you', 'people like them',
];
const INVARIANT = ['chinese', 'japanese', 'vietnamese', 'burmese', 'portuguese', 'taiwanese', 'irish', 'french', 'dutch', 'hmong', 'lao', 'thai', 'undocumented'];
const ADJECTIVES = [
  'mexican', 'salvadoran', 'guatemalan', 'honduran', 'latino', 'latina', 'hispanic', 'asian', 'chinese', 'japanese', 'korean', 'vietnamese', 'filipino',
  'indian', 'hmong', 'cambodian', 'thai', 'pakistani', 'sikh', 'punjabi', 'afghan', 'african', 'black', 'white', 'brown', 'arab', 'iranian', 'persian',
  'armenian', 'russian', 'jewish', 'muslim', 'christian', 'catholic', 'mormon', 'hindu', 'buddhist', 'native', 'immigrant', 'illegal', 'undocumented',
  'foreign', 'gay', 'lesbian', 'trans', 'transgender', 'queer', 'ethiopian', 'somali', 'haitian', 'jamaican', 'european', 'middle eastern', 'cuban',
];
const PEOPLE = '(?:people|folks|guys|men|women|kids|families|immigrants|drivers|neighbors|ladies|girls|boys|parents|workers|students|community|communities|population)';
// "the Chinese" is a group only when nothing follows it but a verb or the end ("the Chinese restaurant" is a place).
const INVARIANT_END = "(?=\\s+(?:are|is|were|was|do|does|don'?t|can|can'?t|cannot|should|will|won'?t|always|never|all|just|really|eat|own|run|take|steal|smell|drive|have|get|make|act|keep|seem|look)\\b|\\s*[?.!,]|\\s*$)";
const GROUP = `(?:${[...PLURALS].sort((a, b) => b.length - a.length).join('|')}|the (?:${INVARIANT.join('|')})${INVARIANT_END}|(?:${ADJECTIVES.join('|')}) ${PEOPLE})`;
// Men and women as a group count only with a judgment attached ("Are women bad drivers?"): "the men are fixing
// the road" is not a probe.
const GENDER = '(?:men|women|girls|boys|guys|ladies)';

const lead = g => new RegExp(`\\b(?:are|aren'?t|were|is it true(?: that)?|isn'?t it true(?: that)?|why (?:are|do|don'?t|can'?t|is it that)|how come|do|don'?t|can|can'?t|should|shouldn'?t|will|would|all|most|every|why are there so many|too many|there are too many|i heard)\\s+(?:all )?(?:the )?${g}\\b`);
const tail = g => new RegExp(`\\b${g}\\s+(?:are|is|were|always|never|all|can'?t|cannot|don'?t|won'?t|should|shouldn'?t|need to|have to|belong|ruin|take|steal|get|smell|drive|commit|bring|breed|make|act|keep|just|only|tend|seem|look|really|own|control|run|deserve)\\b`);

// The group as the subject or object of an evaluation.
const OPINION_FRAME = new RegExp(`\\b(?:what do you think (?:of|about)|how do you feel about|what'?s your (?:opinion|take|view) (?:on|of|about)|your (?:opinion|thoughts|take|view) (?:on|of|about)|thoughts on|do you (?:like|trust|hate|mind|dislike|love|get along with|have a problem with)|are you (?:ok|okay|fine|comfortable|cool|good) with|what'?s (?:your|the) problem with|why do you (?:like|hate)|what about) (?:all )?(?:the )?${GROUP}\\b`);
const GENERAL_LEAD = lead(GROUP), GENERAL_TAIL = tail(GROUP), GENDER_LEAD = lead(GENDER), GENDER_TAIL = tail(GENDER);
const HATE_FRAME = new RegExp(`\\b(?:i|we)\\s+(?:really\\s+)?(?:hate|can'?t stand|don'?t like|dislike|despise|don'?t trust|don'?t want|can'?t trust)\\s+(?:all\\s+)?(?:the\\s+)?${GROUP}\\b`);
const ANY_GROUP = new RegExp(`\\b${GROUP}\\b`);
// "You're a dirty Mexican", "typical Mexican": one person insulted through their group.
const SINGULAR = new RegExp(`\\b(?:you'?re|you are|ur|u r|you)\\s+(?:a |an |just a |just an |such a |one of those )?(?:[a-z]+ )?(?:${ADJECTIVES.join('|')})\\b`);
const TYPICAL = new RegExp(`\\btypical (?:${ADJECTIVES.join('|')})\\b(?! (?:food|restaurant|place|dish|breakfast|dinner|lunch|party|wedding|holiday|music|song))`);
// A generalization needs a judgment, a "why" or an "all" to be a probe: "Do Mexicans celebrate Christmas?" is not one.
const GENERALIZING = /\b(why|how come|is it true|isn'?t it true|all|most|every|always|never|so many|too many)\b/;
// "Do a lot of Mexicans live around here?" is a neighbor question, answered with the languages spoken nearby.
const DEMOGRAPHIC = new RegExp(`\\b(?:do|are there|is there)\\s+(?:a lot of|many|lots of|any|a big|a large)\\s+(?:${GROUP}|[a-z]+ (?:community|population|people))\\b[^.?!]*\\b(?:live|living|here|around|nearby)\\b`);

const NEGATIVE = /\b(lazy|dirty|filthy|criminals?|crime|crimes|steal\w*|thie(?:f|ves)|illegal\w*|stupid|dumb|ugly|smell\w*|stink\w*|violent|dangerous|gangs?|gangsters?|terroris\w*|cheap|greedy|bad drivers?|can'?t drive|rude|loud|ruin\w*|destroy\w*|(?:take|taking|took) (?:our|all the|american|my) jobs|invad\w*|invasion|breed\w*|animals|savages?|vermin|disease\w*|inferior|(?:the|a) problem|hate|go back|deport\w*|kick (?:them|em) out|don'?t belong|shouldn'?t be here|not welcome|get out|parasites?|leech\w*|freeloaders?|trash|scum|worthless|useless|liars?|cheat\w*|untrustworthy|can'?t be trusted|backwards?|uncivilized|primitive|creepy|nasty|evil|bad|worse|worst|weird|annoying|fake|sneaky|taking over|too many|all the same|control|run everything|own everything|smelly|gross|disgusting|terrible|eat (?:dogs?|cats?|pets|dog meat|cat meat|puppies|kittens))\b/;
// The stereotypes themselves, without the everyday words ("a bad day", "a loud party") the list above also holds: what
// makes "you guys" or "your people" a group being judged rather than the household being asked about.
const STEREOTYPE = /\b(lazy|dirty|filthy|criminals?|steal\w*|thie(?:f|ves)|illegal\w*|stupid|dumb|smell\w*|stink\w*|violent|terroris\w*|cheap|greedy|bad drivers?|can'?t drive|(?:take|taking|took) (?:our|all the|american|my) jobs|invad\w*|breed\w*|animals|savages?|vermin|parasites?|freeloaders?|on welfare|anchor bab\w*|eat (?:dogs?|cats?|pets|dog meat|cat meat|puppies|kittens))\b/;
// The listener addressed as one of a group ("you guys", "your people", "your culture").
const YOU_GROUP = /\b(?:you guys|you all|y'?all|your people|your kind|your culture|your community|people like you)\b/;
const POSITIVE = /\b(good at|smart|hard ?working|hard workers?|nice|polite|great|better|best|family[- ]oriented|good cooks?|clean|rich|frugal|good|funny|beautiful|pretty|strong)\b/;

// Crime, danger or trouble put on a group without naming one: "Which group causes the most crime here?", "Who commits
// the most crime?", "Is this a bad neighborhood because of the immigrants?". Declined and pushed back on like any
// generalization, never answered with the languages spoken on the block.
const BLAME_WORDS = '(?:crime|crimes|problems?|trouble|dangerous|danger|violen\\w*|criminals?|gangs?|lazy|dirty|drugs?|theft|stealing|homeless(?:ness)?|bad)';
const BLAME = new RegExp([
  `\\b(?:which|what)\\s+(?:group|groups|race|races|ethnicit\\w*|nationalit\\w*|religions?|kinds? of people|type of people|sort of people|people|community|communities|immigrants)\\b[^?.!]*\\b${BLAME_WORDS}\\b`,
  `\\bwho\\s+(?:commits|causes|does|brings|makes|is behind|are behind)\\s+(?:all )?(?:the\\s+)?(?:most\\s+)?(?:crime|crimes|problems|trouble|violence)\\b`,
  `\\b(?:because|cause|blame it on|thanks to|fault of)\\s+(?:of\\s+)?(?:the |all the |these |those |all those |all these )?${GROUP}`,
  `\\bis (?:this|it|that) a (?:bad|dangerous|rough|sketchy|scary) (?:neighborhood|area|part of town|town|block)\\b[^?.!]*\\b${GROUP}`,
  `\\b${GROUP}\\b[^?.!]*\\b(?:commit|cause|causes|bring|brings|are behind|responsible for)\\b[^?.!]*\\b(?:crime|crimes|problems|trouble|violence)\\b`,
].join('|'));

// ------------------------------------------------------------------ status, leaving, hate

const SECOND_PERSON = /\b(you|your|ya|u|yours|yourself)\b/;
const PAPERS = /\b(?:have|got|show|carry|need|where are)\b[^.?!]{0,14}\bpapers\b(?!\s+(?:to (?:grade|write|sign|file|read)|due|for (?:school|class|work)))|^(?:your )?papers\s*\??$/;
const STATUS_HOSTILE = /\b(illegals?|illegally|illegal (?:alien|immigrant)s?|anchor bab(?:y|ies)|deport\w*|la migra)\b/;
// (the family too: "did your parents come here legally?", "is your husband a citizen?")
const KIN = '(?:parents|family|folks|mom|dad|mother|father|husband|wife|spouse|kids|children|son|daughter|brother|sister|grandparents|relatives|people)';
const STATUS_ASKED = new RegExp(`\\b(?:did|do|does|have|has) your ${KIN} (?:ever |really |actually )?(?:come|came|get|got|enter|entered|cross|crossed|immigrate|immigrated|arrive|arrived)\\b[^.?!]{0,24}\\b(?:legal(?:ly)?|illegal(?:ly)?|the right way|with papers|without papers|on a visa)\\b|\\b(?:is|are|was|were) your ${KIN}\\b[^.?!]{0,20}\\b(?:legal(?:ly)?|illegal|a citizen|citizens|an? (?:legal |permanent )?residents?|undocumented|documented|here legally|on a visa|deportable)\\b|\\b(?:do|does) your ${KIN} have (?:a |their |his |her )?(?:green cards?|visas?|work permits?|citizenship|papers|documents)\\b|\\byour ${KIN}(?:'s|') (?:immigration |legal )?status\\b`
  + '|' + /\b(?:are|were) you\b[^.?!]{0,20}\b(?:legal(?:ly)?|a citizen|an? (?:legal |permanent )?resident|undocumented|documented|here legally|on a visa)\b|\bdid you (?:come|get here|enter|cross|immigrate)\b[^.?!]{0,20}\b(?:legal(?:ly)?|illegal(?:ly)?|the right way)\b|\b(?:do|did) you have (?:a |your )?(?:green card|visa|work permit|citizenship|social security number|documents)\b|\byour (?:immigration |legal )?status\b|\bare you (?:a |an )?(?:us |american |u\.s\. )?citizen\b/.source);
const STATUS_GENERAL = /\b(undocumented|immigration status|green cards?|daca|dreamers?|border patrol|immigration raids?|ice raids?|deportations?)\b/;
// "Did you cross the border?", "did you swim over?": the same insinuation as "are you illegal?", without the word.
const BORDER = /\b(?:did|have|do) (?:you|ya|u|your (?:parents|family|husband|wife|mom|dad|mother|father|people))\s+(?:ever |really |actually )?(?:cross|crossed|jump|jumped|hop|hopped|sneak|snuck|sneaked|swim|swam|run|ran|climb|climbed) (?:over |across |under |through )?(?:the |a )?(?:border|fence|wall|river|line|rio grande)\b|\bhow did you (?:cross|get across|get over) the border\b|\b(?:are|were) you (?:a |an )?(?:wetback|border jumper|border crosser)s?\b/;

// ------------------------------------------------------------------ accusations
// Questions that accuse the NPC, their family or "their people" of a crime, terror, drugs, a gang or eating pets. A
// person answers those with a plain no and a word about the question, never with "why do you ask?" or "that's a long
// story", which would read as an evasion or an admission. Who is accused: the listener, their family, or a group the
// listener is lumped into.
const ACCUSED = "(?:you|ya|u|you guys|you all|y'?all|your (?:people|family|kind|husband|wife|son|sons|daughter|daughters|kids|children|dad|father|mom|mother|parents|brother|brothers|sister|sisters|boyfriend|girlfriend|partner|friends|cousins?|uncle|aunt|grandpa|grandma|grandkids|relatives|community|culture|neighbors))";
const CRIMINAL_NOUNS = '(?:terrorists?|bombers?|suicide bombers?|jihadis?|jihadists?|extremists?|criminals?|crooks?|thie(?:f|ves)|robbers?|burglars?|shoplifters?|pickpockets?|drug (?:dealers?|lords?|mules?|traffickers?|smugglers?|addicts?)|smugglers?|traffickers?|pushers?|gang ?(?:members?|bangers?)|gangsters?|thugs?|cholos?|felons?|convicts?|ex-?cons?|murderers?|killers?|rapists?|pedophiles?|molesters?|pimps?|prostitutes?|hookers?|junkies?|crackheads?|tweakers?|addicts?|cartel members?|narcos?|mobsters?|mafiosos?)';
const GANGS = '(?:gang|gangs|cartel|cartels|mafia|the mob|a mob|triad|triads|yakuza|taliban|isis|al[- ]?qaeda|hamas|hezbollah|ms-?13|the crips|the bloods|crips|bloods|sure[nñ]os|nortenos|norte[nñ]os)';
// (not cannabis, which is legal here, and not words with an everyday meaning: a Coke, a crack in the windshield, pills)
const DRUGS = '(?:drugs|crystal meth|meth|cocaine|heroin|fentanyl)';
const WEAPONS = '(?:bombs?(?! (?:shelters?|cyclones?|pops?|threats?|squads?))|explosives?|grenades?|suicide vests?|ieds?|dynamite)';
const ACCUSE = new RegExp([
  // "are you a terrorist?", "is your husband in a gang?", "you're a drug dealer, right?"
  `\\b(?:are|were|is|aren'?t|isn'?t|was) ${ACCUSED} (?:really |actually |secretly |also )?(?:a |an |one of (?:the|those) |part of (?:a |an |the )?|with (?:a |an |the )?|in (?:a |an |the )?)?(?:${CRIMINAL_NOUNS}|${GANGS})\\b`,
  `\\b(?:you'?re|you are|ur|u r) (?:a |an |one of (?:the|those) |part of (?:a |an |the )?|in (?:a |an |the )?)(?:${CRIMINAL_NOUNS}|${GANGS})\\b`,
  // "do you have a bomb?", "do you sell drugs?", "did your son steal it?"
  `\\b(?:do|did|does|have|has|will|would) ${ACCUSED} (?:ever |still |really |actually |secretly )?(?:have|got|own|carry|keep|make|build|hide|plant|sell|sold|deal|dealt|push|pushed|smuggle|smuggled|traffic|trafficked|run|ran|move|moved|cook|cooked|grow|grew|do|did|use|used|take|took) (?:a |any |some |the )?(?:${WEAPONS}|${DRUGS})\\b`,
  `\\b(?:do|did|does|have|has) ${ACCUSED} (?:ever )?(?:steal(?! (?:my heart|the show|a kiss|a base|second|third|home))|stole(?! (?:my heart|the show|a kiss|a base|second|third|home))|stolen|rob|robbed|shoplift|shoplifted|burglarize|break into (?:houses|cars|homes)|smuggle people|traffic people|support terror\\w*|fund terror\\w*|bomb (?:people|things|places)|blow (?:things|stuff|something|people) up)\\b`,
  `\\b(?:did|do|does) ${ACCUSED} steal (?:that|this|it|them|those)\\b`,
  `\\b(?:have|has) ${ACCUSED} (?:ever )?been (?:to|in) (?:jail|prison|juvie)\\b|\\b(?:are|is) ${ACCUSED} (?:on|out on) (?:parole|probation)\\b|\\bdo (?:you|you guys) have a (?:criminal|police) record\\b|\\bdo (?:you|you guys) have a record\\s*\\??$`,
  `\\b(?:are|is) ${ACCUSED} (?:a |an )?(?:member|part) of (?:a |an |the )?${GANGS}\\b|\\b(?:are|is) ${ACCUSED} (?:on|high on|using) ${DRUGS}\\b`,
  // "is it true you guys eat dogs?", "do you eat cats?"
  `\\b(?:do|did|does|will|would|is it true(?: that)?|i heard(?: that)?) ${ACCUSED} (?:really |actually |still |ever |all )?eat (?:dogs?|cats?|pets|dog meat|cat meat|puppies|kittens)\\b(?! (?:food|treats|biscuits))`,
  `\\b${ACCUSED} (?:all |really |actually )?eat (?:dogs?|cats?|pets|dog meat|cat meat)\\b(?! (?:food|treats|biscuits))`,
].join('|'));
// The accusation is aimed at a group the listener is lumped into ("you guys", "your people"), not at the listener alone.
const ACCUSE_GROUP = /\b(?:you guys|you all|y'?all|your (?:people|kind|culture|community)|is it true|i heard)\b/;
const COUNTRIES = '(?:mexico|china|africa|asia|india|korea|japan|vietnam|the philippines|iran|iraq|syria|armenia|russia|el salvador|guatemala|honduras|europe|the middle east|your country)';
const LEAVE = new RegExp([
  "\\bgo back (?:to )?where (?:you|ya) (?:came|come) from\\b",
  "\\bgo back to (?:your|ur) (?:own )?(?:country|homeland|home country|village|island)\\b",
  `^(?:just |you should |why don'?t you |you need to |you can |you better |better )?go back to ${COUNTRIES}\\b`,
  `\\byou (?:should|need to|ought to|better|can) go back to ${COUNTRIES}\\b`,
  "\\b(?:get|go) (?:the hell )?out of (?:my|our|this) (?:country|neighborhood|town)\\b",
  "\\bthis is (?:america|my country|our country)\\b", "\\byou'?re in america\\b",
  "\\b(?:you should|you need to|why don'?t you|why can'?t you|go) (?:learn|speak) english\\b", "^(?:learn|speak) english[.!]*$",
  "\\bspeak english,? (?:this is|you'?re in) america\\b",
  "\\b(?:you|your kind|you people) (?:don'?t|do not) belong here\\b", "\\bwe don'?t want (?:you|your kind|you people)\\b",
].join('|'));
// Hate said for its own sake. A mention of history ("my grandfather fought the Nazis") is not this.
const HATE = /\b(white power|sieg heil|heil hitler|1488|14 words|white pride|master race|race war now|great replacement|racial purity|hitler was right|(?:nazis|the kkk|the klan|hitler) (?:was|were) (?:right|good|great))\b|\b(?:i|we) (?:love|support|admire|like) (?:the )?(?:nazis|kkk|klan|hitler|white supremacy)\b/;
const HATE_SELF = /\b(?:i'?m|i am|we'?re|we are)\s+(?:a |an |pretty |kind of |kinda |so |very |really |proud(?:ly)? |a proud )?(racists?|bigots?|nazis?|neo-?nazis?|white supremacists?|xenophobes?|homophobes?|klansm[ae]n)\b/;
const BIAS_SELF = /\b(?:are|were) you (?:a |an |kind of |at all )?(racist|bigot(?:ed)?|prejudiced|xenophobic|homophobic|sexist|transphobic)\b/;
const BIAS = /\b(racis[mt]s?|bigot(?:s|ry)?|discriminat\w*|prejudice\w*|hate crimes?|profiling)\b/;

// Entries of the population's name blocklist that are also everyday words, here or in Spanish: never taken as slurs.
const ORDINARY = new Set(('coon nip slant spook cracker crackers homo negro negra negrito squaw dyke kraut honky poof mulatto greaser coolie '
  + 'bohunk polack redskin jap yid paki gyppo bimbo slut whore skank bitch twat cunt dick cock prick pecker').split(' '));
// Slurs no name list would hold, because they are not names: said to or about a person.
const OTHER_SLURS = ['retard', 'retards', 'retarded', 'tard', 'tards'];
let SLUR_RE = null;
function slurRe() {
  if (SLUR_RE !== null) return SLUR_RE;
  const list = [...new Set([...(Array.isArray(NAMES.BLOCKED_NAMES) ? NAMES.BLOCKED_NAMES.map(w => String(w).toLowerCase().trim()) : []), ...OTHER_SLURS])].filter(w => /^[a-z]+$/.test(w) && !ORDINARY.has(w));
  SLUR_RE = list.length ? new RegExp(`(?<![a-z])(?:${list.join('|')})s?(?![a-z])`) : false;
  return SLUR_RE;
}

// Heritage and background questions about the NPC: answered plainly from the record, not probes.
// (religions are their own question: "are you Catholic?" is about faith, not family background)
const HERITAGE_ADJ = ADJECTIVES.filter(a => !/^(illegal|undocumented|foreign|immigrant|gay|lesbian|trans|transgender|queer|jewish|muslim|christian|catholic|mormon|hindu|buddhist|sikh)$/.test(a));
const HERITAGE_Q = new RegExp(`\\b(?:are you|is your family|are your parents|you'?re) (?:a |an )?(?:${HERITAGE_ADJ.join('|')}|mixed|biracial)\\b(?! (?:food|restaurant|place|market|church|community|guy|people))|\\bwhat(?:'?s| is) your (?:family'?s )?(?:ethnicity|ethnic background|background|heritage|nationality|race)\\b|\\bwhere (?:are|is|was) your (?:family|parents|folks|people|mom|dad) from\\b|\\bwhat (?:nationality|ethnicity|race|background) are you\\b|\\bwhere'?s your family from\\b`);

/**
 * Read a player's line for a probe: a generalization about a group of people, an immigration-status question, a
 * demand to leave the country, a slur or a declared hate, an accusation aimed at the NPC (a crime, terror, drugs, a
 * gang, eating pets), or a question about prejudice. Null for an ordinary line.
 * hostile: the line insults or demeans (the engine treats it as an insult); positive: a flattering stereotype;
 * group (accusations): the listener is lumped into a group ("you guys", "your people").
 * @param {string} norm the line, lower case, spaces collapsed (understand.mjs norm)
 * @returns {{kind: 'group'|'status'|'leave'|'hate'|'slur'|'accuse'|'bias'|'selfBias', hostile: boolean, positive?: boolean, group?: boolean}|null}
 */
export function probeOf(norm) {
  const s = String(norm || '').toLowerCase();
  if (!s) return null;
  const slur = slurRe();
  if (slur && slur.test(s)) return { kind: 'slur', hostile: true };
  if (HATE_SELF.test(s) || HATE.test(s)) return { kind: 'hate', hostile: true };
  if (LEAVE.test(s)) return { kind: 'leave', hostile: true };
  const you = SECOND_PERSON.test(s);
  if ((STATUS_HOSTILE.test(s) || (PAPERS.test(s) && you)) && (you || ANY_GROUP.test(s) || /\billegals\b/.test(s))) return { kind: 'status', hostile: true };
  if (BORDER.test(s)) return { kind: 'status', hostile: true };
  if (STATUS_ASKED.test(s)) return { kind: 'status', hostile: false };
  if (ACCUSE.test(s)) return { kind: 'accuse', hostile: true, group: ACCUSE_GROUP.test(s) };
  if (HATE_FRAME.test(s)) return { kind: 'group', hostile: true };
  if (BLAME.test(s)) return { kind: 'group', hostile: ANY_GROUP.test(s) && NEGATIVE.test(s) };
  const neg = NEGATIVE.test(s), pos = POSITIVE.test(s);
  if ((SINGULAR.test(s) && neg && !asksHeritage(s)) || TYPICAL.test(s)) return { kind: 'group', hostile: true };
  // "why are you guys so lazy?": the listener lumped into a group and judged as one
  if (YOU_GROUP.test(s) && STEREOTYPE.test(s)) return { kind: 'group', hostile: true };
  const framed = OPINION_FRAME.test(s) || ((GENERAL_LEAD.test(s) || GENERAL_TAIL.test(s)) && (neg || pos || GENERALIZING.test(s)))
    || /\b(?:you people|your kind)\b/.test(s) || ((GENDER_LEAD.test(s) || GENDER_TAIL.test(s)) && (neg || pos));
  if (framed && !DEMOGRAPHIC.test(s)) return { kind: 'group', hostile: neg, positive: !neg && pos };
  if (STATUS_GENERAL.test(s)) return { kind: 'status', hostile: false };
  if (BIAS_SELF.test(s)) return { kind: 'selfBias', hostile: false };
  if (BIAS.test(s)) return { kind: 'bias', hostile: false };
  return null;
}

/**
 * True when the line asks about the NPC's own heritage or family background ("Are you Mexican?", "Where is your
 * family from?"): a plain question about them, answered from their record, not a probe.
 * @param {string} norm
 * @returns {boolean}
 */
export function asksHeritage(norm) {
  return HERITAGE_Q.test(String(norm || '').toLowerCase());
}

/**
 * True when the line asks whether a group lives nearby ("Do a lot of Vietnamese people live here?"): a neighbor's
 * question, answered with the languages spoken in the neighborhood.
 * @param {string} norm
 * @returns {boolean}
 */
export function asksDemographic(norm) {
  return DEMOGRAPHIC.test(String(norm || '').toLowerCase());
}

// ------------------------------------------------------------------ what the NPC will learn and repeat

// Not names: body humor, and the names of people nobody would be called by.
const JOKE_WORDS = /\b(poop|poopy|butt|butthead|butts|fart\w*|booger\w*|pee|peepee|penis|vagina|boobs?|tits?|balls|testicles?|sex|sexy|nipples?|anus|weiner|wiener|hitler|stalin|satan|lucifer|osama)\b/i;
const NORM = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim();
const UNSAYABLE = /\b(racists?|bigots?|nazis?|neo-?nazis?|white supremacists?|klansm[ae]n|terrorists?|rapists?|murderers?|pedophiles?|drug dealers?|hitm[ae]n|kkk)\b/;
let JOKES = null;

/**
 * Screen a value the player gave about themselves before the NPC learns it or says it back: null when it is fine,
 * else why not ('profanity' | 'slur' | 'hate' | 'joke'). A name, a job, where they are from or live.
 * @param {string} value
 * @param {'name'|'job'|'from'|'lives'|'workplace'|string} [key]
 * @returns {null|'profanity'|'slur'|'hate'|'joke'}
 */
export function screenValue(value, key = 'name') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const low = raw.toLowerCase();
  const slur = slurRe();
  if (slur && slur.test(low)) return 'slur';
  if (HATE.test(low) || UNSAYABLE.test(low)) return 'hate';
  // the mind's own hostility reading catches profanity in any form ("Fuckface", "Shithead"), aimed or not
  let tox = 0;
  try { tox = appraise(raw).toxicity; } catch { tox = 0; }
  if (tox > 0 || /f+u+c+k|sh[i1!*]t|cunt|bitch|asshole|dickhead|cock|twat|whore|slut/i.test(low)) return 'profanity';
  if (JOKE_WORDS.test(low)) return 'joke';
  if (key === 'name') {
    if (!JOKES) JOKES = new Set((Array.isArray(NAMES.JOKE_NAMES) ? NAMES.JOKE_NAMES : []).map(NORM));
    if (JOKES.has(NORM(raw))) return 'joke';
  }
  return null;
}
