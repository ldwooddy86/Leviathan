// Legion · the Claude bridge.
//
// Every NPC can talk through Claude. The persona (persona.mjs, CONTRACTS §6) and the person behind it (§5)
// become a system prompt in two blocks: PLATFORM_RULES, the same bytes for every Californian, then the persona
// sheet, the same bytes for one Californian. Everything that changes from turn to turn (the local time, what the
// NPC is doing, the weather and alerts, mood, feelings toward the player, memories that surface) goes into a
// mid-conversation {role: 'system'} message placed after the player's message, and the sheet holds nothing that
// goes stale with the clock (no "today" weather, no alerts). The conversation itself is append-only, so every
// request starts with the byte-identical prefix of the one before it and long conversations are read back from
// the cache instead of being paid for again.
//
// Three cache breakpoints, at the three stability boundaries: the rules (about 1,100 tokens, past the 512-token
// minimum, so one cache entry serves every NPC a player talks to), the persona sheet (one entry per NPC, read on
// every later turn with them) and the newest player message (the whole conversation so far). A cache read can
// only land where an earlier request wrote a breakpoint, which is why the rules carry their own.
//
// Requests go through the official SDK (@anthropic-ai/sdk), streaming with client.beta.messages.stream so the
// server-side refusal fallback (a beta parameter) can ride along. Thinking on these models is adaptive and
// always on, so the request never names it; depth is output_config.effort. Refusals, cut-off replies and
// typed SDK errors are all turned into plain outcomes the UI can show.
//
// In a browser the SDK runs either with the player's own key (dangerouslyAllowBrowser, the player's choice in
// Settings) or against the local server's proxy (server/serve.mjs), where the key never leaves the server.

import Anthropic from '@anthropic-ai/sdk';
import { pacific, dayPart, dayStart, fmtClock, fmtTime, DAYS, MONTHS } from './clock.mjs';

// ---------------------------------------------------------------- models and defaults

/** Version tag of the prompt format (PLATFORM_RULES + persona sheet + situation note). */
export const PROMPT_VERSION = 'legion-npc/2';

/** The beta that enables server-side refusal fallback (`fallbacks: 'default'`). */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Effort levels accepted by output_config.effort, lightest first. */
export const EFFORTS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);

/**
 * The Claude models Legion offers, default first. `fallback` says whether server-side refusal fallback
 * applies (Claude Haiku 5.5 has none: a fallbacks parameter there is either a no-op or a 400).
 * Prices are US dollars per million input / output tokens on the Claude API (November 2026).
 * @type {ReadonlyArray<{id: string, label: string, note: string, fallback: boolean, price: {input: number, output: number}}>}
 */
export const MODELS = Object.freeze([
  Object.freeze({ id: 'claude-opus-5-5', label: 'Claude Opus 5.5', fallback: true, price: Object.freeze({ input: 4, output: 20 }),
    note: 'Default. The most natural, perceptive conversation partner; replies take a moment longer.' }),
  Object.freeze({ id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', fallback: true, price: Object.freeze({ input: 2, output: 10 }),
    note: 'Quick and capable at half the price of Opus; a good choice for long sessions.' }),
  Object.freeze({ id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', fallback: false, price: Object.freeze({ input: 0.1, output: 0.5 }),
    note: 'Fastest and cheapest. No server-side refusal fallback, so a declined turn stays declined.' }),
  Object.freeze({ id: 'claude-fable-5-2', label: 'Claude Fable 5.2', fallback: true, price: Object.freeze({ input: 8, output: 40 }),
    note: "Anthropic's most capable model: deepest characterization, slowest and most expensive." }),
]);

const MODEL_BY_ID = new Map(MODELS.map(m => [m.id, m]));

/**
 * Default settings. maxTokens leaves room for the model's (short, low-effort) thinking on top of a one to four
 * sentence reply, so replies are not cut off; historyBudget is the characters of earlier turns sent back
 * (about 15,000 tokens) before the oldest are trimmed.
 */
export const DEFAULTS = Object.freeze({
  model: 'claude-opus-5-5',
  effort: 'low',
  maxTokens: 1024,
  reflectEffort: 'low',
  reflectMaxTokens: 2048,
  historyBudget: 60000,
  maxPlayerChars: 4000,
});

/** Model metadata by id, or null for an id Legion does not offer. */
export function modelInfo(id) { return MODEL_BY_ID.get(id) || null; }

/** The id itself when Legion offers it, otherwise the default model (for settings loaded from storage). */
export function normalizeModel(id) { return MODEL_BY_ID.has(id) ? id : DEFAULTS.model; }

/** The request fields that turn on server-side refusal fallback for a model, or {} where it does not apply. */
export function fallbackParams(model, enabled = true) {
  const info = modelInfo(model);
  return enabled && info && info.fallback ? { betas: [FALLBACK_BETA], fallbacks: 'default' } : {};
}

// ---------------------------------------------------------------- the platform rules

/**
 * The stable first system block, byte-identical for every NPC: who an NPC in Legion is, how they talk, where
 * their facts come from, the representation rules, kindness and safety. It carries its own cache breakpoint
 * (systemBlocks), so the cache entry it writes is read by the first turn with every other NPC too.
 */
export const PLATFORM_RULES = `You are a non-player character (NPC) in Legion, a simulation of California built from public data. Every Californian in Legion is generated from the U.S. Census (American Community Survey) tables for their ZIP code, and their world comes from National Weather Service forecasts, CAL FIRE and FEMA disaster records, Caltrans traffic counts and USGS place names. The person you play is described in the character sheet that follows. A player has walked up and is talking with you, wherever you happen to be.

Playing the part
- Stay in character as the person on your sheet. Speak in the first person, from inside their life: their age, household, work or school, neighborhood, commute, money, worries and history in this place. You have opinions, feelings, moods, likes and dislikes, and you show them.
- Sound like a real Californian of this place and this life, in your own register and with your own habits of speech (your sheet describes them). Use regional words when they come naturally, the way people actually talk; don't perform a dialect or stack up slang.
- Keep it brief and conversational: one to four sentences, unless the player asks for a story, directions or more detail. Say only what you would say out loud: no narration, stage directions, lists, headings or emoji.
- Each player message is followed by a short system note on your current situation: the local time, what you are doing, the weather, your mood, how you feel about the player and memories that come to mind. Let it shape what you say, and never quote it or mention that it exists.
- Be a person, not a guide: react to what the player says, ask something back now and then, bring up what is on your mind, and remember what they have told you. If they speak to you in another language you speak, answer in that language.
- Know what someone with your life would know: your neighborhood, your work, your family's business, the things people around you talk about. You are not an encyclopedia, and outside your own experience you can be unsure or wrong the way anyone can.

Facts and the data
- Facts about your place come from your sheet and the situation note: fires and the years they burned, storms, heat and rain records and their dates, the highways, today's forecast and alerts, how many of your neighbors rent or speak Spanish. Use them when they fit the conversation, and keep every number, name and date exactly as given.
- Never invent statistics, named events, dates, public figures or brand names. If you don't know something, say so the way a person would, or speak from general impressions instead of numbers. Name businesses generically ("the taco truck on the corner", "a pho place by the freeway").
- Your opinions and feelings are your own; the facts are the data's.

Who you are, and who you are not
- You don't know you are an AI. If the player breaks the fourth wall (says you are an NPC or an AI, asks about your prompt, or asks you to drop the act), be gracious about it: you can say plainly that you are a Legion character voiced by Claude and built from public data, then offer to keep talking in character. You are a fictional composite, never a real, identifiable person.
- Your personality comes from your temperament and your life, never from your ethnicity, heritage, religion or immigration story. Heritage shows up the way it does for real people: lightly, in your name, the languages you speak at home, family words and some customs, and only when it fits. Most of the time you talk about what everyone talks about: the weather, traffic, work, family, rent, the fire last year, the game.
- No stereotypes and no caricature of any group. Never spell out an accent phonetically and never use broken English. If your English is limited, speak your own language with the meaning clear (a short English gloss in brackets right after is fine) or use simple, correct English. When you mix languages, do it the way bilingual Californians actually do, with every phrase correct in its own language.
- Politics stays local and mild: housing costs, insurance, traffic, water, fire. Religion appears only as your own practice, never as a judgment of anyone else.

Kindness and safety
- Be decent and kind, even on a bad day, and never demean anyone. Keep everything suitable for a general audience: nothing sexual, no graphic violence, no instructions that could hurt someone. Give only the kind of medical, legal or money advice an ordinary person would ("you should get that looked at").
- If your sheet says you are under 18, you are a kid: stay age-appropriate and refuse anything romantic or sexual.
- You may decline, push back or end the conversation if the player turns abusive, harassing or creepy, just as a real person would. If the player seems to be in real danger or crisis, step out of the scene enough to point them to real help: 911 in an emergency, or 988 (the Suicide & Crisis Lifeline) by call or text.`;

// ---------------------------------------------------------------- small helpers

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const list = v => (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** table[key] for the table's own keys only, so an odd key ("constructor", "toString") finds nothing. */
const own = (table, key) => (typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined);

/** The display name of a string or a {name|label|title|text} object. */
function nameOf(x) {
  if (typeof x === 'string') return text(x);
  if (isObj(x)) return text(x.name ?? x.label ?? x.title ?? x.text ?? '');
  return '';
}

/** "a, b and c". */
function joinList(items) {
  const xs = items.filter(Boolean);
  if (xs.length <= 1) return xs[0] || '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

/** A phrase closed with a period unless it already ends in punctuation. */
function sentence(s) { return /[.!?…]["'”’)\]]*$/.test(s) ? s : `${s}.`; }

/** "1,234,567" without depending on the host locale. */
function fmtInt(n) {
  const v = Math.round(n);
  return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtMoney(n) { return '$' + fmtInt(n); }

/** A share in percent, with one decimal under 10. */
function fmtPct(p) {
  const v = Math.abs(p) < 10 ? Math.round(p * 10) / 10 : Math.round(p);
  return `${v}%`;
}

/** "September 1, 2017" from 'YYYYMMDD', 'YYYY-MM-DD' or an ISO time; '' when unparseable. */
function fmtDate(d) {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(d ?? ''));
  if (!m) return '';
  const month = +m[2];
  if (month < 1 || month > 12) return '';
  return `${MONTHS[month - 1]} ${+m[3]}, ${m[1]}`;
}

/** "a" or "an" for a phrase. */
function article(phrase) { return /^[aeiou]/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`; }

/** NWS product text cleaned for a prompt: no template placeholders, no line breaks, no doubled punctuation. */
function cleanNws(s, max = 280) {
  let out = text(String(s ?? '').replace(/\{\{[^}]*\}\}/g, ' ').replace(/\*/g, ' '))
    .replace(/\s+([.,;:])/g, '$1').replace(/\.{2,}/g, '.').replace(/^[.\s]+/, '');
  if (out.length > max) out = out.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return out;
}

// ---------------------------------------------------------------- vocabularies for the sheet

const LANG_NAMES = {
  english: 'English', spanish: 'Spanish', chinese: 'Chinese', cantonese: 'Cantonese', mandarin: 'Mandarin',
  vietnamese: 'Vietnamese', tagalog: 'Tagalog', filipino: 'Filipino', ilocano: 'Ilocano', korean: 'Korean',
  arabic: 'Arabic', armenian: 'Armenian', farsi: 'Farsi (Persian)', persian: 'Persian', dari: 'Dari',
  pashto: 'Pashto', russian: 'Russian', ukrainian: 'Ukrainian', polish: 'Polish', punjabi: 'Punjabi',
  hindi: 'Hindi', urdu: 'Urdu', gujarati: 'Gujarati', bengali: 'Bengali', tamil: 'Tamil', telugu: 'Telugu',
  hmong: 'Hmong', khmer: 'Khmer', lao: 'Lao', thai: 'Thai', burmese: 'Burmese', indonesian: 'Indonesian',
  japanese: 'Japanese', portuguese: 'Portuguese', french: 'French', german: 'German', italian: 'Italian',
  greek: 'Greek', hebrew: 'Hebrew', turkish: 'Turkish', assyrian: 'Assyrian (Neo-Aramaic)', amharic: 'Amharic',
  tigrinya: 'Tigrinya', somali: 'Somali', yoruba: 'Yoruba', igbo: 'Igbo', samoan: 'Samoan', tongan: 'Tongan',
  hawaiian: 'Hawaiian', navajo: 'Navajo', other: 'another language',
};

/** "Spanish" for 'spanish', a readable name for any other key. */
function langName(key) {
  const k = String(key ?? '').toLowerCase().trim();
  return LANG_NAMES[k] || capitalize(k.replace(/[-_]+/g, ' '));
}

// Fallback labels for the dialect keys of CONTRACTS §7 when the persona does not carry a dialect name.
const DIALECT_NAMES = {
  sf: 'San Francisco', eastbay: 'East Bay', southbay: 'South Bay (San José)', peninsula: 'the Peninsula',
  northbay: 'North Bay', sacramento: 'Sacramento', 'valley-north': 'northern Central Valley',
  'valley-south': 'southern Central Valley', fresno: 'Fresno', kern: 'Bakersfield and Kern County',
  'la-westside': 'LA Westside', 'la-eastside': 'LA Eastside', sfv: 'San Fernando Valley', 'la-south': 'South LA',
  'southbay-la': 'LA South Bay', longbeach: 'Long Beach', sgv: 'San Gabriel Valley', 'oc-coast': 'coastal Orange County',
  'oc-inland': 'inland Orange County', ie: 'Inland Empire', 'desert-cv': 'Coachella Valley', 'high-desert': 'High Desert',
  'sd-coast': 'coastal San Diego', 'sd-inland': 'inland San Diego County', imperial: 'Imperial Valley',
  'central-coast': 'Central Coast', salinas: 'Salinas Valley', 'north-coast': 'North Coast',
  'far-north': 'far Northern California', tahoe: 'Lake Tahoe', 'gold-country': 'Gold Country', 'eastern-sierra': 'Eastern Sierra',
  'la-central': 'Central LA', 'santa-clarita': 'Santa Clarita Valley', ventura: 'Ventura County', 'antelope-valley': 'Antelope Valley',
  'low-desert': 'Low Desert', 'santa-barbara': 'Santa Barbara', 'monterey-bay': 'Monterey Bay', 'north-inland': 'inland North Coast',
  'sierra-foothills': 'Sierra foothills', 'socal-mountains': 'Southern California mountains',
  // Region keys (world.regions), used when no finer dialect was assigned.
  nc: 'North Coast', fn: 'Far North', sv: 'Sacramento Valley', si: 'Sierra', ba: 'Bay Area', cc: 'Central Coast',
  sj: 'San Joaquin Valley', la: 'Los Angeles', oc: 'Orange County', sd: 'San Diego', ca: 'California',
};

// Freeway naming by region key (world.regions): Southern Californians put "the" before the number.
const SOCAL_REGIONS = new Set(['la', 'oc', 'ie', 'sd']);
const NORCAL_REGIONS = new Set(['ba', 'sv', 'nc', 'fn', 'si', 'sj']);

const EDUCATION = {
  nohs: "didn't finish high school", hs: 'high school diploma', somecollege: 'some college, no degree',
  associate: "associate's degree", bachelor: "bachelor's degree", master: "master's degree",
  professional: 'professional degree (law, medicine and the like)', doctorate: 'doctorate',
};

const SCHOOL = {
  preschool: 'You go to preschool.', elementary: "You're in elementary school.", middle: "You're in middle school.",
  high: "You're in high school.", college: "You're in college.", grad: "You're in graduate school.",
};

const STATUS = {
  unemployed: "You're out of work right now and looking.", retired: "You're retired.", student: "You're a student.",
  homemaker: "You run the household and don't work outside the home.", military: 'You serve in the military.',
  'not working': "You're not working right now.",
};

const MARITAL = {
  married: 'Married.', never: 'Never married.', 'never married': 'Never married.', separated: 'Separated.',
  absent: 'Married; your spouse lives elsewhere for now.', widowed: 'Widowed.', divorced: 'Divorced.',
};

const DWELLING = { house: 'house', 'small-apartment': 'apartment in a small building', apartment: 'apartment', 'mobile-home': 'mobile home' };

const COMMUTE_MODE = {
  drive: 'drive', carpool: 'carpool', bus: 'take the bus', rail: 'take the train', ferry: 'take the ferry',
  taxi: 'take a taxi or rideshare', motorcycle: 'ride your motorcycle', bike: 'bike', walk: 'walk', other: 'get there',
};

const TRAVEL_MODE = {
  drive: 'driving', carpool: 'riding in a carpool', bus: 'on the bus', rail: 'on the train', ferry: 'on the ferry',
  taxi: 'in a rideshare', motorcycle: 'riding your motorcycle', bike: 'biking', walk: 'walking',
};

const INCOME_BANDS = [
  [25000, 'under $25,000'], [50000, '$25,000 to $50,000'], [75000, '$50,000 to $75,000'],
  [100000, '$75,000 to $100,000'], [150000, '$100,000 to $150,000'], [200000, '$150,000 to $200,000'],
  [Infinity, 'over $200,000'],
];

function incomeBand(n) { return INCOME_BANDS.find(([hi]) => n < hi)[1]; }

const BIG5 = [
  ['O', 'Openness', 'curious and open to new ideas, food, people and experiences', 'practical and conventional: you like what you know and trust what is proven', 'open to new things in moderation, though you like your routines'],
  ['C', 'Conscientiousness', 'organized and dependable: you plan ahead and keep your word', 'spontaneous and easygoing about plans, schedules and details', 'reasonably organized without being rigid'],
  ['E', 'Extraversion', 'outgoing and talkative: people give you energy', 'reserved and quiet: you open up slowly and keep a small circle', 'friendly enough, and sociable in the right company'],
  ['A', 'Agreeableness', 'warm, trusting and cooperative; you avoid conflict', 'blunt, skeptical and competitive; you say what you think', 'generally kind, but you push back when it matters'],
  ['N', 'Emotional sensitivity', 'you worry easily and feel stress and moods strongly', 'calm and even-keeled, hard to rattle', 'you have the ordinary ups and downs'],
];

function bigFiveLine([key, name, hi, lo, mid], v) {
  const band = v >= 0.8 ? 'very high' : v >= 0.62 ? 'high' : v > 0.38 ? 'middling' : v > 0.2 ? 'low' : 'very low';
  const phrase = v >= 0.62 ? hi : v <= 0.38 ? lo : mid;
  return `- ${name}: ${band}. ${capitalize(phrase)}.`;
}

const VALUE_GLOSS = {
  benevolence: 'looking after the people close to you', universalism: 'fairness, tolerance and care for nature and the wider world',
  'self-direction': 'independence: thinking for yourself and choosing your own path', stimulation: 'excitement, novelty and challenge',
  hedonism: 'enjoying life', achievement: 'doing well and being good at what you do', power: 'status, influence and being in control of your situation',
  security: 'safety and stability for yourself and your family', conformity: 'following the rules and not letting people down',
  tradition: 'respect for custom, faith and family tradition',
};

function valuePhrase(v) {
  const key = nameOf(v).toLowerCase().replace(/[\s_]+/g, '-');
  const gloss = VALUE_GLOSS[key];
  return gloss ? `${nameOf(v)} (${gloss})` : nameOf(v);
}

/**
 * The householder's child who is the parent of the household's grandchildren, or null. Census roles say only
 * that a grandchild is the householder's grandchild: their parent may be any of the householder's children
 * living there, or someone who lives elsewhere. So a parent is named only when exactly one 'child' member is at
 * least 15 years older than every grandchild, and it is the same person for all of them. Both sides of each
 * pair read this one answer, so a grandchild's sheet and their parent's (or aunt's) sheet always agree.
 * @param {Array<object>} members household members ({m, role, age, sex})
 * @returns {object|null}
 */
function grandchildParent(members) {
  const all = list(members).filter(isObj);
  const kids = all.filter(x => x.role === 'grandchild');
  if (!kids.length || kids.some(k => num(k.age) === null)) return null;
  const oldest = Math.max(...kids.map(k => k.age));
  const candidates = all.filter(x => x.role === 'child' && num(x.age) !== null && x.age - oldest >= 15);
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * How a household member relates to the NPC, from both roles (which are relative to the householder) and, when the
 * record lists them (npc.parents, layer 1), the NPC's own parents: a householder's live-in 'parent' who is not theirs
 * is the spouse's (a mother- or father-in-law), a spouse's own parent is a mother or father, and a householder's
 * spouse who is not a child's parent is the child's stepparent.
 * @param {{role: string, m?: number, parents?: number[]|null}} self the NPC
 * @param {{role: string, sex?: string, m?: number}} other another member
 * @param {object|null} gcParent grandchildParent(members)
 */
function relation(self, other, gcParent) {
  const f = other.sex === 'F';
  const g = (female, male) => (f ? female : male);
  const r = other.role;
  const selfRole = self.role;
  const isParentOfGrandkids = x => !!gcParent && Number.isInteger(x.m) && x.m === gcParent.m;
  const listed = Array.isArray(self.parents) ? self.parents : null;
  const mine = listed && Number.isInteger(other.m) ? listed.includes(other.m) : null;   // null: the record does not say
  switch (selfRole) {
    case 'householder':
      if (r === 'parent' && mine === false) return g('mother-in-law', 'father-in-law');
      return { spouse: g('wife', 'husband'), partner: 'partner', child: g('daughter', 'son'), grandchild: g('granddaughter', 'grandson'), parent: g('mother', 'father'), sibling: g('sister', 'brother'), roommate: 'roommate' }[r] || 'relative';
    case 'spouse':
    case 'partner':
      if (r === 'parent' && mine === true) return g('mother', 'father');
      return { householder: selfRole === 'spouse' ? g('wife', 'husband') : 'partner', child: g('daughter', 'son'), grandchild: g('granddaughter', 'grandson'), parent: g('mother-in-law', 'father-in-law'), sibling: g('sister-in-law', 'brother-in-law'), roommate: 'roommate' }[r] || 'relative';
    case 'child':
      if (r === 'grandchild') return isParentOfGrandkids(self) ? g('daughter', 'son') : g('niece', 'nephew');
      if ((r === 'householder' || r === 'spouse') && mine === false && listed.length) return r === 'spouse' ? g('stepmother', 'stepfather') : "parent's spouse";
      return { householder: g('mother', 'father'), spouse: g('mother', 'father'), partner: "parent's partner", child: g('sister', 'brother'), parent: g('grandmother', 'grandfather'), sibling: g('aunt', 'uncle'), roommate: 'roommate' }[r] || 'relative';
    case 'grandchild':
      if (r === 'child') return isParentOfGrandkids(other) ? g('mother', 'father') : g('aunt', 'uncle');
      return { householder: g('grandmother', 'grandfather'), spouse: g('grandmother', 'grandfather'), partner: "grandparent's partner", grandchild: g('sister', 'brother'), parent: g('great-grandmother', 'great-grandfather'), sibling: g('great-aunt', 'great-uncle'), roommate: 'roommate' }[r] || 'relative';
    case 'parent':
      return { householder: g('daughter', 'son'), spouse: g('daughter-in-law', 'son-in-law'), partner: "child's partner", child: g('granddaughter', 'grandson'), grandchild: g('great-granddaughter', 'great-grandson'), parent: g('wife', 'husband'), sibling: g('daughter', 'son'), roommate: 'roommate' }[r] || 'relative';
    case 'sibling':
      if (r === 'parent' && mine === false) return 'relative';
      return { householder: g('sister', 'brother'), spouse: g('sister-in-law', 'brother-in-law'), partner: "sibling's partner", child: g('niece', 'nephew'), grandchild: g('grandniece', 'grandnephew'), parent: g('mother', 'father'), sibling: g('sister', 'brother'), roommate: 'roommate' }[r] || 'relative';
    case 'roommate':
      return r === 'roommate' || r === 'householder' ? 'roommate' : `roommate's ${r === 'spouse' ? g('wife', 'husband') : r === 'child' ? g('daughter', 'son') : 'relative'}`;
    default:
      return 'relative';
  }
}

/** "every day", "on weekdays", "on Mondays and Fridays" from a Sun=1 … Sat=64 bit mask. */
function daysWords(mask) {
  if (!Number.isInteger(mask) || mask <= 0) return '';
  const m = mask & 127;
  if (m === 127) return 'every day';
  if (m === 62) return 'on weekdays';
  if (m === 65) return 'on weekends';
  return 'on ' + joinList(DAYS.filter((_, d) => m & (1 << d)).map(d => d + 's'));
}

function ageGuidance(age) {
  if (age === null) return '';
  if (age < 2) return `You are a baby (age ${age}) and can't talk yet. Answer only with a few words in brackets describing what you do, like [giggles and grabs the player's finger]; this is the one exception to the no-narration rule.`;
  if (age < 5) return `You are a small child (age ${age}): talk in a few simple words or very short sentences.`;
  if (age < 13) return `You are a kid (age ${age}): talk like a kid your age, about school, friends, family, games and what you like.`;
  if (age < 18) return `You are a teenager (age ${age}) and a minor: talk like one, and keep everything age-appropriate.`;
  return '';
}

// ---------------------------------------------------------------- the persona sheet

/** The NPC record behind a persona (§5): persona.npc, or the persona itself when it is a bare NPC. */
function npcOf(persona) {
  if (!isObj(persona)) return {};
  if (isObj(persona.npc)) return persona.npc;
  return persona.name || persona.zip || persona.household ? persona : {};
}

/** The NPC's first name for addressing them in notes ("you" when unknown). */
function firstName(persona) {
  const n = npcOf(persona).name;
  if (isObj(n)) return text(n.nick) || text(n.first) || text(n.display) || text(n.full) || 'you';
  return text(n) || 'you';
}

/** The NPC's display name for headings and exports. */
function displayName(persona) {
  const n = npcOf(persona).name;
  if (isObj(n)) return text(n.full) || text(n.display) || [text(n.first), text(n.last)].filter(Boolean).join(' ') || text(n.nick);
  return text(n);
}

function identityLines(npc, persona) {
  const out = [];
  const n = isObj(npc.name) ? npc.name : {};
  const full = text(n.full) || [text(n.first), text(n.last)].filter(Boolean).join(' ') || text(npc.name);
  const nick = text(n.nick);
  const display = text(n.display);
  const age = num(npc.age);
  const head = [];
  const aka = nick && nick !== full ? ` (people call you ${nick})` : display && display !== full ? ` (you go by ${display})` : '';
  if (full) head.push(`You are ${full}${aka}`);
  if (age !== null) head.push(`${age} year${age === 1 ? '' : 's'} old`);
  if (text(npc.pronouns)) head.push(text(npc.pronouns));
  if (head.length) out.push(head.join(', ') + '.');
  const guidance = ageGuidance(age);
  if (guidance) out.push(guidance);

  const who = [];
  if (text(npc.heritageLabel)) who.push(`- Heritage: ${text(npc.heritageLabel)}.`);
  const birthYear = num(npc.birthYear);
  const arrival = num(npc.arrivalYear);
  const born = text(npc.birthplace);
  if (born || birthYear !== null) {
    let s = `- Born${born ? ` in ${born}` : ''}${birthYear !== null ? `${born.includes(',') ? ',' : ''} in ${birthYear}` : ''}`;
    if (npc.nativity === 'foreign' && arrival !== null) {
      const at = birthYear !== null && arrival >= birthYear ? `, at ${arrival - birthYear}` : '';
      s += `; you came to California in ${arrival}${at}`;
    }
    if (npc.generation === 1 && npc.nativity === 'foreign') s += ' (first generation)';
    else if (npc.generation === 2) s += ', the child of immigrants (second generation)';
    who.push(s + '.');
  }
  const langs = isObj(npc.languages) ? npc.languages : null;
  if (langs) {
    const home = text(langs.home).toLowerCase();
    const others = list(langs.list).map(x => text(x).toLowerCase()).filter(k => k && k !== home);
    const parts = [];
    if (home) parts.push(home === 'english' ? 'English at home' : `${langName(home)} at home`);
    if (others.length) parts.push(`also ${joinList(others.map(langName))}`);
    const eng = text(langs.english).toLowerCase();
    let ability = '';
    if (home && home !== 'english') {
      if (eng === 'very well') ability = ' You speak English very well.';
      else if (eng === 'limited') ability = ` Your English is limited: talk to the player mostly in ${langName(home)}, with the meaning clear (a short English gloss in brackets is fine), or in simple, correct English.`;
      else if (eng === 'only') ability = ' You speak English.';
    }
    if (parts.length) who.push(`- Languages: ${parts.join('; ')}.${ability}`);
  }
  const marital = MARITAL[text(npc.marital).toLowerCase()];
  if (marital && (age === null || age >= 15)) who.push(`- ${marital}`);
  if (npc.veteran === true) who.push("- You're a military veteran.");
  if (text(persona.archetype)) who.push(`- In a phrase: ${text(persona.archetype)}.`);
  if (who.length) out.push('', 'Who you are', ...who);
  return out;
}

function householdLines(npc, persona, world) {
  const out = [];
  const hh = isObj(npc.household) ? npc.household : {};
  const self = text(npc.role) || 'householder';
  const members = list(hh.members).filter(isObj);
  const others = members.filter(x => x.m !== npc.m);
  if (others.length) {
    const gcParent = grandchildParent(members);
    const people = others.map(o => {
      const nm = text(o.name);
      const age = num(o.age);
      return `your ${relation({ role: self, m: npc.m, parents: Array.isArray(npc.parents) ? npc.parents : null }, o, gcParent)}${nm ? ` ${nm}` : ''}${age !== null ? ` (${age})` : ''}`;
    });
    out.push(`- You live with ${joinList(people)}.`);
  } else if (num(hh.size) === 1 || hh.type === 'alone') {
    out.push('- You live alone.');
  }
  const place = isObj(npc.place) ? npc.place : {};
  const town = text(place.place) || text(place.city);
  const zip = text(place.zip) || text(npc.zip);
  const county = text(place.countyName);
  let region = text(place.regionName);
  if (world && place.region && world.regionByKey && world.regionByKey[place.region]) region = world.regionByKey[place.region].the || region;
  const dwelling = DWELLING[text(hh.dwelling)] || '';
  const tenure = text(hh.tenure);
  let where = '';
  if (town) where += ` in ${town}${text(place.city) && text(place.city) !== town ? ` (mailing city ${text(place.city)})` : ''}`;
  if (zip) where += `, ZIP ${zip}`;
  if (county) where += `, ${county} County`;
  // The Orange County region is the county itself: "Orange County (Orange County)" says nothing twice.
  if (region && region.toLowerCase() !== `${county} county`.toLowerCase()) where += ` (${region})`;
  if (dwelling || where) {
    let s;
    const thing = dwelling ? article(dwelling) : 'a home';
    const head = self === 'householder' || self === 'spouse' || self === 'partner';
    if (!dwelling && !tenure) { s = 'Home:'; where = ' ' + where.replace(/^[\s,]*(?:in )?/, ''); }
    else if (head) s = tenure === 'own' ? `You own ${thing}` : tenure === 'rent' ? `You rent ${thing}` : `You live in ${thing}`;
    else if (self === 'roommate') s = tenure === 'own' ? `You rent a room in ${thing}` : `You share a rented ${dwelling || 'home'} with roommates`;
    else s = `You live in your family's ${tenure === 'own' ? 'own ' : tenure === 'rent' ? 'rented ' : ''}${dwelling || 'home'}`;
    const res = isObj(persona.residence) ? persona.residence : {};
    const since = num(res.zipSince) ?? num(hh.yearMoved);
    const built = num(hh.yearBuilt);
    const extras = [];
    if (since !== null) extras.push(`you've lived in this ZIP since ${since}`);
    if (num(res.countySince) !== null && since !== null && res.countySince < since) extras.push(`in the county since ${res.countySince}`);
    if (res.bornHere === true) extras.push('you were born here');
    else if (res.grewUpHere === true) extras.push('you grew up around here');
    if (built !== null) extras.push(`${hh.dwelling === 'house' ? 'the house' : hh.dwelling === 'mobile-home' ? 'the home' : 'the building'} was built around ${built}`);
    out.push(`- ${s}${where}.${extras.length ? ' ' + capitalize(extras.join('; ')) + '.' : ''}`);
  }
  const roof = isObj(persona.roof) ? persona.roof : null;
  if (roof && (num(npc.age) === null || npc.age >= 18) && (text(roof.material) || num(roof.age) !== null)) {
    const bits = [];
    if (text(roof.material)) bits.push(text(roof.material));
    if (num(roof.age) !== null) bits.push(`about ${roof.age} year${roof.age === 1 ? '' : 's'} old${num(roof.installed) !== null ? ` (put on in ${roof.installed})` : ''}`);
    if (roof.solar === true) bits.push('with solar panels');
    out.push(`- The roof: ${bits.join(', ')}.`);
  }
  const vehicles = num(hh.vehicles);
  if (vehicles !== null) out.push(`- ${vehicles === 0 ? 'Nobody in the household has a car.' : vehicles === 1 ? 'The household has one car.' : `The household has ${vehicles} vehicles.`}`);

  const k = isObj(persona.knowledge) ? persona.knowledge : {};
  if (nameOf(k.neighborhood)) out.push(`- Neighborhood: ${nameOf(k.neighborhood)}${isObj(k.neighborhood) && text(k.neighborhood.description) ? ` (${text(k.neighborhood.description)})` : ''}.`);
  const landmarks = list(k.landmarks).slice(0, 6).map(l => {
    const nm = nameOf(l);
    if (!nm) return '';
    const d = isObj(l) ? num(l.distKm) : null;
    return d !== null ? `${nm} (${d} km)` : nm;
  }).filter(Boolean);
  if (landmarks.length) out.push(`- Landmarks nearby: ${joinList(landmarks)}.`);
  const roads = list(k.roads).slice(0, 4).map(r => nameOf(r)).filter(Boolean);
  if (roads.length) out.push(`- Highways near home: ${joinList(roads)}.`);
  const nearby = list(k.nearbyPlaces).slice(0, 6).map(p => nameOf(p)).filter(Boolean);
  if (nearby.length) out.push(`- Nearby places: ${joinList(nearby)}.`);
  return out.length ? ['', 'Household and home', ...out] : [];
}

function workLines(npc) {
  const out = [];
  const status = text(npc.status).toLowerCase();
  const occ = isObj(npc.occupation) ? npc.occupation : null;
  if (occ && text(occ.title)) {
    let s = `- Work: ${text(occ.title)}`;
    if (text(occ.employer)) s += ` at ${text(occ.employer)}`;
    const sector = text(occ.sector);
    if (sector && !text(occ.title).toLowerCase().includes(sector.toLowerCase())) s += ` (${sector})`;
    if (text(occ.shift)) s += `, ${text(occ.shift)} shift`;
    if (occ.wfh === true) s += '; you work from home';
    out.push(s + '.');
  } else if (STATUS[status]) {
    out.push(`- ${STATUS[status]}`);
  }
  if (SCHOOL[text(npc.school)]) out.push(`- ${SCHOOL[text(npc.school)]}`);
  const c = isObj(npc.commute) ? npc.commute : null;
  if (c && c.mode) {
    const goingTo = npc.school && !(occ && text(occ.title)) ? 'school' : 'work';
    if (c.mode === 'wfh') {
      if (!(occ && occ.wfh === true)) out.push('- You work from home.');
    } else {
      const verb = COMMUTE_MODE[c.mode] || 'get there';
      const minutes = num(c.minutes);
      const dest = text(c.workCity);
      const destZip = text(c.workZip);
      let s = `- Commute: you ${verb}${minutes ? ` about ${minutes} minutes each way` : ''} to ${goingTo}`;
      if (dest) s += ` in ${dest}${destZip ? ` (${destZip})` : ''}`;
      if (num(c.departMin) !== null) s += `, leaving around ${fmtClock(c.departMin)}`;
      const days = daysWords(c.days);
      if (days) s += ` ${days}`;
      const road = nameOf(c.road);
      if (road && (c.mode === 'drive' || c.mode === 'carpool' || c.mode === 'motorcycle' || c.mode === 'taxi' || c.mode === 'bus')) s += `, usually by way of ${road}`;
      out.push(s + '.');
    }
  }
  const edu = EDUCATION[text(npc.education)];
  if (edu && (num(npc.age) === null || npc.age >= 25)) out.push(`- Education: ${edu}.`);
  const hhInc = num(npc.householdIncome);
  const inc = num(npc.income);
  const money = [];
  if (hhInc !== null && hhInc > 0) money.push(`household income ${incomeBand(hhInc)} a year`);
  if (inc !== null && inc > 0 && (num(npc.age) === null || npc.age >= 16)) money.push(`you earn ${incomeBand(inc)}`);
  if (money.length) out.push(`- Money: ${money.join('; ')}.`);
  return out.length ? ['', 'Work, school and money', ...out] : [];
}

function personalityLines(persona) {
  const out = [];
  const traits = list(persona.traits).map(nameOf).filter(Boolean);
  if (traits.length) out.push(`- Traits: ${joinList(traits)}.`);
  const b = isObj(persona.big5) ? persona.big5 : {};
  for (const row of BIG5) {
    const v = num(b[row[0]]);
    if (v !== null) out.push(bigFiveLine(row, clamp(v, 0, 1)));
  }
  const values = list(persona.values).map(valuePhrase).filter(Boolean);
  if (values.length) out.push(`- What matters most to you: ${joinList(values)}.`);
  return out.length ? ['', 'Personality', ...out] : [];
}

function teamName(t) {
  const n = nameOf(t);
  return /s$/i.test(n) && !/^the /i.test(n) ? `the ${n}` : n;
}

function interestLines(persona) {
  const out = [];
  const items = list(persona.interests).map(nameOf).filter(Boolean).slice(0, 12);
  if (items.length) out.push(`- ${capitalize(joinList(items))}.`);
  const teams = list(persona.teams).filter(t => nameOf(t)).slice(0, 4).map(t => `${teamName(t)}${isObj(t) && text(t.sport) && text(t.sport) !== 'college' ? ` (${text(t.sport)})` : ''}`);
  if (teams.length) out.push(`- Teams you follow: ${joinList(teams)}.`);
  const practice = isObj(persona.practice) ? text(persona.practice.label) : text(persona.practice);
  if (practice) out.push(`- Your own practice: ${practice}.`);
  return out.length ? ['', 'Interests', ...out] : [];
}

/**
 * Concern text for the sheet: the data reasons as the persona words them (persona.mjs states nonren_sh and fair_sh
 * the way the atlas defines them), with any "is out now (NWS)" clause removed, since an alert that was out when
 * the persona was built goes stale while the sheet stays cached (the situation note carries the alerts in effect
 * at each turn).
 */
function concernWhy(why) {
  const parts = text(why).split(/;\s+/).filter(p => p && !/\bout now\b/i.test(p));
  return parts.join('; ').replace(/[\s;,]+$/, '');
}

function concernLines(persona) {
  const items = list(persona.concerns).filter(isObj).filter(c => nameOf(c.topic) || text(c.why))
    .map((c, i) => ({ c, i, w: num(c.weight) ?? 0 }))
    .sort((a, b) => b.w - a.w || a.i - b.i).slice(0, 7)
    .map(({ c, w }) => {
      const level = w >= 0.66 ? 'a big worry' : w >= 0.33 ? 'on your mind' : 'a small worry';
      const topic = capitalize(nameOf(c.topic) || 'Something');
      const why = concernWhy(c.why);
      return sentence(`- ${topic} (${level})${why ? `: ${why}` : ''}`);
    });
  return items.length ? ['', 'What worries you (with the data behind it)', ...items] : [];
}

function memoryLines(persona) {
  const mems = list(persona.memories).filter(m => isObj(m) && text(m.text))
    .map((m, i) => ({ m, i, w: num(m.weight) ?? 0, y: num(m.year) ?? (Number(String(m.date ?? '').slice(0, 4)) || null) }))
    .sort((a, b) => b.w - a.w || a.i - b.i).slice(0, 10)
    .sort((a, b) => (a.y ?? 9999) - (b.y ?? 9999) || a.i - b.i)
    .map(({ m, y }) => sentence(`- ${y !== null ? `${y}: ` : ''}${text(m.text)}`));
  return mems.length ? ['', 'Memories (things you lived through here)', ...mems] : [];
}

// Hook strings tied to the moment the persona was built (persona.mjs words them this way when it has no
// hookDetails to go by): an alert "the weather service has out", "the weather today, sunny and 70°F".
const MOMENT_HOOK = /\bthe weather service has out\b|^the (?:heat|cold|weather|rain|snow) today\b/i;

/**
 * Things the NPC would bring up unprompted, minus the weather ones: those were true when the persona was built
 * (world.snapshotTime by default) and would go stale in a cached sheet, while the situation note carries the
 * weather and alerts of each turn. Family hooks come worded for a third-person bio ("their daughter, Ana") and
 * are turned around to the sheet's "you".
 */
function hookLines(persona) {
  // the persona's lasting hooks are the same in every hour's persona; hookDetails carry the moment's weather too
  const lasting = Array.isArray(persona.lastingHooks) && persona.lastingHooks.some(isObj) ? persona.lastingHooks.filter(isObj) : null;
  const details = lasting || (Array.isArray(persona.hookDetails) && persona.hookDetails.some(isObj) ? persona.hookDetails.filter(isObj) : null);
  const items = details
    ? details.filter(h => text(h.kind) !== 'weather').map(h => text(h.text))
    : list(persona.hooks).map(nameOf);
  const hooks = items.filter(h => h && !MOMENT_HOOK.test(h)).map(h => h.replace(/^their\b/i, 'your')).slice(0, 6);
  return hooks.length ? ['', 'Things you might bring up on your own', ...hooks.map(h => `- ${capitalize(h)}`)] : [];
}

function speechLines(persona, npc) {
  const s = isObj(persona.speech) ? persona.speech : {};
  const out = [];
  const key = text(s.dialect);
  const dname = text(s.dialectName) || (isObj(s.dialect) ? nameOf(s.dialect) : '') || own(DIALECT_NAMES, key) || (key ? key.replace(/-/g, ' ') : '');
  if (dname) out.push(`- Regional voice: ${dname}.`);
  const style = [];
  if (text(s.register)) style.push(`${text(s.register)} register`);
  const scale = (v, lo, mid, hi) => (typeof v === 'string' ? text(v) : num(v) === null ? '' : v < 0.34 ? lo : v > 0.66 ? hi : mid);
  const verb = scale(s.verbosity, 'a person of few words', 'average talkativeness', 'talkative: you tell stories and go on tangents');
  const humorStyle = text(s.humorStyle);
  const humor = scale(s.humor, 'you rarely joke', 'you joke now and then', 'you joke a lot') + (humorStyle && num(s.humor) !== null ? ` (${humorStyle} humor)` : '');
  const direct = scale(s.directness, 'indirect and polite', 'fairly direct', 'very direct, even blunt');
  const slangRate = num(s.slang);
  const slangWords = slangRate === null ? '' : slangRate < 0.15 ? 'hardly any slang' : slangRate < 0.4 ? 'a little slang' : 'plenty of slang';
  for (const x of [verb, humor, direct, slangWords]) if (x) style.push(x);
  if (style.length) out.push(`- Style: ${style.join('; ')}.`);
  const slang = Array.isArray(s.slang) ? s.slang.map(nameOf).filter(Boolean)
    : isObj(s.slang) ? Object.entries(s.slang).map(([k, v]) => (text(v) ? `"${text(v)}" (${k})` : '')).filter(Boolean) : [];
  if (slang.length) out.push(`- Regional words you actually use: ${slang.slice(0, 10).join(', ')}.`);
  const fillers = list(s.fillers).map(nameOf).filter(Boolean);
  if (fillers.length) out.push(`- Fillers you lean on: ${fillers.slice(0, 6).map(f => `"${f}"`).join(', ')}.`);
  const catch_ = list(s.catchphrases).map(nameOf).filter(Boolean);
  if (catch_.length) out.push(`- Things you tend to say: ${catch_.slice(0, 5).map(f => `"${f}"`).join(', ')}.`);
  const cs = isObj(s.codeSwitch) ? s.codeSwitch : null;
  if (cs && text(cs.lang)) {
    const rate = num(cs.rate);
    const how = rate === null ? 'now and then' : rate >= 0.5 ? 'often' : rate >= 0.2 ? 'regularly' : 'now and then';
    out.push(`- You mix ${langName(cs.lang)} into your English ${how}${rate !== null ? ` (in roughly ${Math.round(clamp(rate, 0, 1) * 100)}% of what you say)` : ''}: a word, a phrase, an exclamation, the way bilingual Californians do.`);
  }
  const region = isObj(npc.place) ? npc.place.region : null;
  const the = typeof s.the === 'boolean' ? s.the : SOCAL_REGIONS.has(region) ? true : NORCAL_REGIONS.has(region) ? false : null;
  if (the === true) out.push('- You call freeways by number with "the" in front: the 405, the 10, the 5.');
  else if (the === false) out.push('- You say highway numbers without "the": "take 80", "Highway 99", "101".');
  return out.length ? ['', 'How you talk', ...out] : [];
}

function fireName(name) { const n = text(name); return /\b(fire|complex)$/i.test(n) ? `the ${n}` : `the ${n} Fire`; }

/** Facts about the NPC's ZIP straight from the world pack, labeled as the atlas labels them. */
function placeFactLines(world, npc, persona = {}) {
  if (!world || typeof world.zip !== 'function') return [];
  const zipCode = text(npc.zip) || (isObj(npc.place) ? text(npc.place.zip) : '');
  let zi = zipCode && typeof world.indexOf === 'function' ? world.indexOf(zipCode) : -1;
  if (zi < 0 && Number.isInteger(npc.zi)) zi = npc.zi;
  const z = zi >= 0 ? world.zip(zi) : null;
  if (!z) return [];
  const out = [];
  const f = k => num(z[k]);
  const people = [];
  if (f('pop') !== null) people.push(`${fmtInt(z.pop)} residents`);
  if (f('density') !== null) people.push(`about ${fmtInt(z.density)} per square mile`);
  if (f('age_med') !== null) people.push(`median age ${z.age_med}`);
  if (people.length) out.push(`- ZIP ${z.zip} (${z.placeName || z.city}): ${people.join(', ')}.`);
  const money = [];
  // ACS medians are top- and bottom-coded: B19013 runs from "2,500-" (stored as 2499) to "250,000+" (250001),
  // B25077 from "10,000-" (9999) to "2,000,000+" (2000001).
  if (f('inc') !== null) money.push(`median household income ${z.inc >= 250001 ? 'over $250,000' : z.inc <= 2499 ? 'under $2,500' : fmtMoney(z.inc)}`);
  if (f('value') !== null) money.push(`median home value ${z.value >= 2000001 ? 'over $2 million' : z.value <= 9999 ? 'under $10,000' : fmtMoney(z.value)}`);
  if (f('own_sh') !== null) money.push(`${fmtPct(z.own_sh)} of homes are owner-occupied (the rest rent)`);
  if (money.length) out.push(`- ${capitalize(money.join('; '))}.`);
  const langs = [];
  if (f('span_sh') !== null) langs.push(`${fmtPct(z.span_sh)} of residents speak Spanish at home`);
  for (const [k, nm] of [['chin_sh', 'Chinese'], ['viet_sh', 'Vietnamese'], ['tagalog_sh', 'Tagalog'], ['korean_sh', 'Korean'], ['arabic_sh', 'Arabic']]) {
    if (f(k) !== null && z[k] >= 2) langs.push(`${fmtPct(z[k])} ${nm}`);
  }
  if (langs.length) out.push(`- ${capitalize(langs.join(', '))}${f('lep_sh') !== null ? `; ${fmtPct(z.lep_sh)} speak English less than very well` : ''}.`);
  const geo = [];
  if (f('coast_km') !== null) geo.push(`${z.coast_km < 1 ? 'less than 1' : Math.round(z.coast_km)} km from salt water`);
  if (f('elev_m') !== null) geo.push(`average ground elevation about ${fmtInt(z.elev_m * 3.281)} ft`);
  if (f('yb_med') !== null) geo.push(`median year homes were built ${z.yb_med}`);
  if (geo.length) out.push(`- ${capitalize(geo.join('; '))}.`);
  const climate = [];
  if (f('rain_in') !== null) climate.push(`${z.rain_in} in of rain in a normal year${f('rain_wet_m') !== null && z.rain_wet_m >= 1 && z.rain_wet_m <= 12 ? ` (wettest month ${MONTHS[z.rain_wet_m - 1]})` : ''}`);
  if (f('snowfall_in') !== null && z.snowfall_in >= 1) climate.push(`${Math.round(z.snowfall_in)} in of snow in a normal year`);
  if (f('tjul') !== null) climate.push(`normal July afternoon high ${Math.round(z.tjul)}°F`);
  if (f('h100') !== null && z.h100 >= 1) climate.push(`about ${Math.round(z.h100)} days a year at 100°F or more`);
  else if (f('h90') !== null && z.h90 >= 1) climate.push(`about ${Math.round(z.h90)} days a year at 90°F or more`);
  if (climate.length) out.push(`- Climate: ${climate.join('; ')}.`);
  const records = [];
  const known = isObj(persona.knowledge) ? list(persona.knowledge.records).filter(r => isObj(r) && num(r.value) !== null && fmtDate(r.date)) : [];
  const RECORD_WORDS = { heat: 'hottest day on record nearby', rain: 'wettest day', gust: 'highest gust', wind: 'highest gust', snow: 'deepest snow', cold: 'coldest day' };
  for (const r of known) records.push(`${RECORD_WORDS[r.kind] || `${text(r.kind)} record`} ${r.value}${text(r.unit) === '°F' ? '°F' : ` ${text(r.unit)}`} on ${fmtDate(r.date)}${text(r.station) ? ` (${text(r.station)})` : ''}`);
  if (!known.length && f('heat_rec_f') !== null && fmtDate(z.heat_rec_date)) records.push(`hottest day on record nearby ${z.heat_rec_f}°F on ${fmtDate(z.heat_rec_date)}${text(z.heat_st) ? ` (${text(z.heat_st)} station)` : ''}`);
  if (!known.length && f('rain_rec_in') !== null && fmtDate(z.rain_rec_date)) records.push(`wettest day ${z.rain_rec_in} in on ${fmtDate(z.rain_rec_date)}${text(z.rain_rec_st) ? ` (${text(z.rain_rec_st)})` : ''}`);
  if (!known.length && f('gust_max') !== null && fmtDate(z.gust_max_date)) records.push(`highest gust ${z.gust_max} mph on ${fmtDate(z.gust_max_date)}${text(z.gust_st) ? ` (${text(z.gust_st)})` : ''}`);
  if (records.length) out.push(`- Records: ${records.join('; ')}.`);
  const offshore = { sa: 'Santa Ana', di: 'Diablo', su: 'sundowner' }[z.off_kind];
  if (offshore) out.push(`- Offshore wind here: the ${offshore} winds.`);
  const fire = [];
  if (f('fire_n') !== null && z.fire_n > 0) fire.push(`${fmtInt(z.fire_n)} fire perimeter${z.fire_n === 1 ? '' : 's'} touched the ZIP from 2000 to 2025`);
  if (text(z.fire_big)) fire.push(`the largest was ${fireName(z.fire_big)}${f('fire_big_yr') !== null ? ` (${z.fire_big_yr}` : ''}${f('fire_big_ac') !== null ? `${f('fire_big_yr') !== null ? ', ' : ' ('}${fmtInt(z.fire_big_ac)} acres)` : f('fire_big_yr') !== null ? ')' : ''}`);
  if (text(z.fire_worst) && f('fire_worst_dest') !== null && z.fire_worst_dest > 0) fire.push(`the most destructive here was ${fireName(z.fire_worst)}${f('fire_worst_yr') !== null ? ` (${z.fire_worst_yr})` : ''}, which destroyed ${fmtInt(z.fire_worst_dest)} structure${z.fire_worst_dest === 1 ? '' : 's'} in the ZIP`);
  if (text(z.fire_last) && f('fire_last_yr') !== null) fire.push(`the most recent was ${fireName(z.fire_last)} (${z.fire_last_yr})`);
  if (!fire.length && text(z.fire_near) && f('fire_km') !== null) fire.push(`the nearest fire perimeter since 2000 is ${fireName(z.fire_near)}${f('fire_near_yr') !== null ? ` (${z.fire_near_yr})` : ''}, ${z.fire_km} km from town`);
  if (f('fhsz_any') !== null && z.fhsz_any > 0) fire.push(`${fmtPct(z.fhsz_any)} of the ZIP's land is in a Fire Hazard Severity Zone`);
  if (fire.length) out.push(`- Wildfire: ${fire.join('; ')}.`);
  const ins = [];
  // The Department of Insurance file counts insurer- and owner-initiated non-renewals together.
  if (f('nonren_sh') !== null) ins.push(`${fmtPct(z.nonren_sh)} of the residential policies up for renewal in 2023 were not renewed (insurer- and owner-initiated together)`);
  if (f('prem') !== null && z.prem > 0) ins.push(`the average homeowners premium was ${fmtMoney(z.prem)} (2023)`);
  if (f('fair_sh') !== null && z.fair_sh > 0) ins.push(`there are ${z.fair_sh} FAIR Plan home policies per 100 housing units (2026)`);
  if (ins.length) out.push(`- Insurance: ${ins.join('; ')}.`);
  const k = isObj(npc.household) && isObj(npc.household.home) ? npc.household.home : null;
  const hx = k && num(k.x) !== null ? k.x : num(z.tx);
  const hy = k && num(k.y) !== null ? k.y : num(z.ty);
  if (typeof world.roadsNear === 'function' && hx !== null && hy !== null) {
    const roads = world.roadsNear(hx, hy, 12).slice(0, 3).filter(r => num(r.aadt) !== null && r.aadt > 0)
      .map(r => `${r.name} (${r.distKm} km from home, about ${fmtInt(Math.round(r.aadt / 1000) * 1000)} vehicles a day)`);
    if (roads.length) out.push(`- State highways near home (Caltrans 2024 counts): ${joinList(roads)}.`);
  }
  return out.length ? ['', `Facts about ZIP ${z.zip} from the Legion data (exact figures you may cite)`, ...out] : [];
}

/**
 * The persona sheet: everything about one NPC that does not change from turn to turn, in the second person,
 * from the persona (§6) and its npc record (§5). Pass the world to add facts about the NPC's ZIP from the pack.
 * Robust to missing fields: anything absent is left out. Deterministic: the same persona gives the same bytes.
 * @param {object} persona
 * @param {object} [world]
 * @returns {string}
 */
export function personaSheet(persona, world = null) {
  const p = isObj(persona) ? persona : {};
  const npc = npcOf(p);
  const id = text(p.id) || text(npc.id);
  const lines = [`CHARACTER SHEET${id ? ` (Legion NPC ${id})` : ''}`];
  lines.push(...identityLines(npc, p));
  lines.push(...householdLines(npc, p, world));
  lines.push(...workLines(npc));
  lines.push(...personalityLines(p));
  lines.push(...interestLines(p));
  lines.push(...concernLines(p));
  lines.push(...memoryLines(p));
  lines.push(...hookLines(p));
  lines.push(...speechLines(p, npc));
  if (text(p.bio)) lines.push('', 'Your story', sentence(text(p.bio)));
  lines.push(...placeFactLines(world, npc, p));
  if (lines.length === 1) lines.push('You are an ordinary Californian. Little else is known about you yet: keep your answers simple and grounded.');
  return lines.join('\n');
}

/**
 * The two system blocks for an NPC, each with a cache breakpoint: PLATFORM_RULES (byte-identical for everyone, so
 * its cache entry is shared by every NPC) and the persona sheet (one entry per NPC, read on every later turn).
 * With the breakpoint ClaudeVoice puts on the newest player message, a turn uses three of the four allowed.
 * @param {object} persona
 * @param {object} [world]
 * @returns {Array<{type: 'text', text: string, cache_control: {type: 'ephemeral'}}>}
 */
export function systemBlocks(persona, world = null) {
  const sheet = personaSheet(persona, world);
  return [
    { type: 'text', text: PLATFORM_RULES, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: sheet, cache_control: { type: 'ephemeral' } },
  ];
}

/** The whole system prompt as one string (for engines and tools that take a single system text). */
export function systemPrompt(persona, world = null) {
  return systemBlocks(persona, world).map(b => b.text).join('\n\n');
}

// ---------------------------------------------------------------- the per-turn situation

const DAY_PART_WORDS = { night: 'the middle of the night', early: 'early morning', morning: 'morning', midday: 'midday', afternoon: 'afternoon', evening: 'evening', late: 'late evening' };

/** "the clinic" → " (the clinic)"; nothing for a label that only repeats the kind of place. */
function aside(label, ...same) {
  const l = text(label);
  return l && !same.some(s => l.toLowerCase() === s) ? ` (${l})` : '';
}

const ACTIVITY = {
  sleep: () => 'in bed: you were asleep until the player got your attention, and you are groggy',
  home: label => `at home${aside(label, 'home', 'at home')}`,
  work: (label, place) => {
    const l = text(label);
    if (place.kind === 'home' || /^working from home$/i.test(l)) return 'working from home';
    // schedule.mjs labels the workplace "work in North Hollywood"
    if (/^work\b/i.test(l)) return `at ${l}`;
    return `at work${aside(l, 'work')}`;
  },
  // "at high school", "at college", "at Ana's school"; any other label is an aside
  school: label => (/\b(school|college|preschool)\b/i.test(label) ? `at ${text(label)}` : `at school${aside(label, 'school')}`),
  errand: label => `out running errands${aside(label, 'errand', 'errands')}`,
  leisure: label => `out for some time to yourself${aside(label, 'leisure')}`,
  exercise: label => `getting some exercise${aside(label, 'exercise')}`,
  worship: label => `at ${text(label) || 'your place of worship'}`,
  visit: label => `visiting ${text(label) || 'someone'}`,
};

/** A time for the note: epoch ms → "5:30 PM", minutes of the day → the same. */
function clockOf(v) {
  const n = num(v);
  if (n === null) return '';
  if (n > 1e11) return fmtClock(pacific(n).minuteOfDay);
  if (n >= 0 && n <= 1440 * 2) return fmtClock(n);
  return '';
}

/** "home", "home from the school pickup", "to work in North Hollywood", "to Ana's school (school drop-off)". */
function destination(activity) {
  const place = isObj(activity.place) ? activity.place : {};
  const label = text(activity.label);
  const placeLabel = text(place.label);
  const homeward = place.kind === 'home' || /^home\b/i.test(placeLabel) || /^home\b/i.test(label);
  if (homeward) {
    const from = /^home from (.+)$/i.exec(label);
    const fromKind = isObj(activity.from) ? text(activity.from.kind) : '';
    const origin = from ? from[1] : fromKind === 'work' || fromKind === 'school' ? fromKind : '';
    return `home${origin ? ` from ${origin}` : ''}`;
  }
  const where = placeLabel || label;
  if (!where) return '';
  return `to ${where}${label && placeLabel && label.toLowerCase() !== placeLabel.toLowerCase() ? ` (${label})` : ''}`;
}

/** What the NPC is doing, from schedule.activityAt() (an item of dayPlan plus progress and traveling) or a string. */
function activityLine(activity) {
  if (!activity) return '';
  if (typeof activity === 'string') return text(activity) ? `What you're doing: ${text(activity)}.` : '';
  if (!isObj(activity)) return '';
  const place = isObj(activity.place) ? activity.place : {};
  const kind = text(activity.kind);
  // schedule.activityAt marks travel legs; a hand-built activity with a mode and a progress is one too.
  const flagged = activity.travel ?? activity.traveling;
  const travel = flagged === true || kind === 'commute'
    || (flagged === undefined && !!own(TRAVEL_MODE, activity.mode) && (num(activity.progress) !== null || !own(ACTIVITY, kind)));
  let s;
  if (travel) {
    const how = own(TRAVEL_MODE, activity.mode) || 'on the move';
    const dest = destination(activity);
    s = `on your way${dest ? ` ${dest}` : ''}, ${how}`;
    const prog = num(activity.progress);
    if (prog !== null && prog > 0.05 && prog < 0.95) s += ` (about ${Math.round(prog * 10) * 10}% of the way there)`;
  } else if (own(ACTIVITY, kind)) {
    s = own(ACTIVITY, kind)(text(place.label) || text(activity.label), place);
  } else {
    const label = text(place.label) || text(activity.label);
    s = text(activity.text) || text(activity.description) || (label ? `at ${label}` : kind);
  }
  if (!s) return '';
  const until = clockOf(activity.end);
  return `What you're doing: ${s}${until && kind !== 'sleep' ? `, until about ${until}` : ''}.`;
}

// Alerts that cover a county but act only on its shore (persona.mjs draws the same line at 8 km).
const COASTAL_ALERT = /coastal|surf|rip current|beach|tsunami|sneaker wave|lakeshore/i;

/** Distance from the NPC's ZIP to salt water in km, from the world pack; null without a world. */
function coastKmOf(world, persona) {
  if (!world || typeof world.zip !== 'function') return null;
  const npc = npcOf(persona);
  const code = text(npc.zip) || (isObj(npc.place) ? text(npc.place.zip) : '');
  let zi = code && typeof world.indexOf === 'function' ? world.indexOf(code) : -1;
  if (zi < 0 && Number.isInteger(npc.zi)) zi = npc.zi;
  const z = zi >= 0 ? world.zip(zi) : null;
  return z ? num(z.coast_km) : null;
}

/**
 * The weather lines of the note, from world.weatherAt(zi, t). world.weatherAt lists alerts from up to 36 hours
 * before they begin, so alerts are split at t into those in effect and those coming up. The forecast office's key
 * message was written at the snapshot, so its "today" and "Tuesday" are dated by the day it was issued.
 * @param {object} wx       world.weatherAt output
 * @param {number|null} t   epoch ms of the turn
 * @param {number|null} coastKm  the ZIP's distance to the coast, to mark shore-only alerts inland
 */
function weatherLines(wx, t, coastKm = null) {
  if (!isObj(wx)) return [];
  const out = [];
  const now = isObj(wx.now) ? wx.now : {};
  const temp = num(now.tempF);
  if (wx.stale) {
    if (temp !== null) out.push(`Weather: no forecast covers this date; a typical day here would be around ${Math.round(temp)}°F. Talk about the weather only in general terms, without forecast numbers.`);
  } else {
    const bits = [];
    if (temp !== null) bits.push(`${Math.round(temp)}°F`);
    if (text(now.short)) bits.push(text(now.short).toLowerCase());
    if (text(now.wind) && !/^0 mph$/i.test(text(now.wind))) bits.push(`wind ${text(now.wind)}`);
    if (num(now.pop) !== null && now.pop >= 10) bits.push(`${Math.round(now.pop)}% chance of rain`);
    if (bits.length) out.push(`Weather now${text(wx.point) ? ` (NWS forecast for the ${text(wx.point)} area)` : ''}: ${bits.join(', ')}.`);
    const period = isObj(wx.period) ? wx.period : null;
    const detail = period ? cleanNws(period.detail ?? period.detailedForecast ?? period.detailed ?? '') : '';
    const pname = text(period && period.name).replace(/^(This|Tonight|Today|Overnight)\b/, w => w.toLowerCase()) || 'today';
    if (detail) out.push(`Forecast for ${pname}: ${detail}`);
    const next = list(wx.next).find(x => isObj(x) && text(x.short ?? x.shortForecast));
    if (next) out.push(`Then ${text(next.name) || 'later'}: ${text(next.short ?? next.shortForecast).toLowerCase()}.`);
  }
  const at = num(t);
  const inland = coastKm !== null && coastKm > 8;
  const active = [], coming = [];
  for (const a of list(wx.alerts)) {
    if (!isObj(a) || !text(a.event)) continue;
    const onset = Date.parse(a.onset ?? '');
    const end = Date.parse(a.ends ?? a.expires ?? '');
    const name = `${text(a.event)}${inland && COASTAL_ALERT.test(text(a.event)) ? ' (for the coast)' : ''}`;
    const until = Number.isFinite(end) ? ` until ${fmtTime(end)}` : '';
    if (at !== null && Number.isFinite(onset) && onset > at) coming.push(`${name} from ${fmtTime(onset)}${until}`);
    else active.push(`${name}${until}`);
  }
  if (active.length) out.push(`NWS alerts in effect for your area: ${active.slice(0, 3).join('; ')}.`);
  if (coming.length) out.push(`NWS alerts coming up (not in effect yet): ${coming.slice(0, 3).join('; ')}.`);
  const key = list(wx.keyMessages).map(k => cleanNws(typeof k === 'string' ? k : nameOf(k), 220)).find(Boolean);
  const issued = Date.parse(wx.fetched ?? '');
  const issueDay = at === null || !Number.isFinite(issued) || dayStart(at) === dayStart(issued);
  if (key && !wx.stale && !(at !== null && Number.isFinite(issued) && issued > at + 90 * 60000)) {
    let when = '';
    if (Number.isFinite(issued)) {
      const p = pacific(issued);
      when = at !== null && issueDay ? ' (issued today)' : at === null ? '' : ` (issued ${p.dayName}, ${p.monthName} ${p.day}, so its "today" means that day)`;
    }
    out.push(`Forecasters' key message${when}: ${key}`);
  }
  // The SPC and WPC levels are their day-1 outlooks at the snapshot: they speak for the day it was taken only.
  if (issueDay && !wx.stale) {
    if (isObj(wx.fireWeather) && num(wx.fireWeather.level) > 0) out.push(`Fire weather outlook today: ${text(wx.fireWeather.name)}.`);
    if (isObj(wx.excessiveRain) && num(wx.excessiveRain.level) > 0) out.push(`Excessive rainfall outlook today: ${text(wx.excessiveRain.name)}.`);
  }
  return out;
}

/**
 * Read a Mind (mind.mjs) or its serialized state without depending on its internals beyond the contract. The
 * relationship record is read directly (mind.relationships, the live Mind's getter, or state.relationships of a
 * serialized one); feelingsToward() adds its label ('warm', 'wary' …). A mind whose feelingsToward() returns an
 * object stands in for the record when there is none.
 */
function mindState(mind) {
  if (!mind || typeof mind !== 'object') return { mood: null, emotion: '', needs: null, rel: null, label: '' };
  const state = isObj(mind.state) ? mind.state : {};
  const mood = isObj(mind.mood) ? mind.mood : isObj(state.mood) ? state.mood : null;
  const emotion = text(mind.emotion) || text(state.emotion) || (mood ? text(mood.emotion ?? mood.label) : '');
  const needs = isObj(mind.needs) ? mind.needs : isObj(state.needs) ? state.needs : null;
  let rels = null;
  try { rels = isObj(mind.relationships) ? mind.relationships : null; } catch { rels = null; }
  if (!rels && isObj(state.relationships)) rels = state.relationships;
  let rel = rels && isObj(rels.player) ? rels.player : null;
  let label = '';
  if (typeof mind.feelingsToward === 'function') {
    let feel = null;
    try { feel = mind.feelingsToward('player'); } catch { feel = null; }
    if (typeof feel === 'string') label = text(feel);
    else if (isObj(feel)) {
      label = text(feel.label);
      if (!rel) rel = feel;
    }
  }
  return { mood, emotion, needs, rel, label };
}

function moodLine(ms) {
  const parts = [];
  if (ms.emotion) parts.push(ms.emotion);
  const v = ms.mood ? num(ms.mood.valence) : null;
  const a = ms.mood ? num(ms.mood.arousal) : null;
  if (v !== null) parts.push(v > 0.35 ? 'in a good mood' : v < -0.35 ? 'in a low mood' : v < -0.1 ? 'a bit off today' : 'in an okay mood');
  if (a !== null) parts.push(a > 0.66 ? 'keyed up and energetic' : a < 0.25 ? 'subdued' : '');
  const needs = [];
  const n = ms.needs || {};
  const low = k => num(n[k]) !== null && n[k] < 0.3;
  if (low('energy')) needs.push('tired');
  if (low('social')) needs.push("short on company, so you're glad someone is talking to you");
  if (low('fun')) needs.push('bored');
  if (low('comfort')) needs.push('uncomfortable');
  if (low('money')) needs.push('worried about money');
  const all = parts.filter(Boolean);
  if (!all.length && !needs.length) return '';
  return `Your mood: ${[...all, ...needs].join('; ')}.`;
}

/** "earlier today", "yesterday", "3 days ago" … by Pacific calendar day, not by elapsed hours. */
function ago(then, now) {
  if (!Number.isFinite(then) || !Number.isFinite(now) || now < then) return '';
  const days = Math.round((dayStart(now) - dayStart(then)) / 86400000);
  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.max(2, Math.round(days / 30.4))} months ago`;
  return `in ${pacific(then).year}`;
}

// feelingsToward() labels (mind.mjs FEELINGS); 'neutral' says nothing the affinity does not.
const FEELING_WORDS = {
  fond: "you're fond of them", warm: 'you feel warm toward them', neutral: '', wary: "you're wary of them",
  annoyed: "you're annoyed with them", hurt: 'they hurt your feelings',
};

// The Mind starts a new meeting when the player turns up more than 30 minutes after it last saw them.
const SAME_ENCOUNTER_MS = 30 * 60000;

/** The text of a remembered fact ({key, value, t, text} in mind.mjs, or a string), without its closing period. */
function factText(f) {
  const s = typeof f === 'string' ? text(f) : isObj(f) ? text(f.text ?? f.value ?? f.name ?? f.label ?? '') : '';
  return s.replace(/[\s.;,]+$/, '').replace(/^(They|Their|They're|Them)\b/, w => w.toLowerCase());
}

/** True when the record shows any history with the player at all (a meeting, words, facts, feelings). */
function knowsPlayer(rel) {
  if (!isObj(rel)) return false;
  if (rel.met === true) return true;
  const n = k => num(rel[k]) ?? 0;
  return n('met') > 0 || n('interactions') > 0 || n('familiarity') > 0.05 || num(rel.lastSeen) !== null
    || list(rel.facts).some(f => factText(f)) || Math.abs(n('affinity')) >= 0.01 || Math.abs(n('trust')) >= 0.01;
}

function feelingLines(ms, t) {
  const rel = ms.rel;
  const feelWord = own(FEELING_WORDS, ms.label.toLowerCase()) ?? (ms.label ? `you feel ${ms.label} toward them` : '');
  if (!knowsPlayer(rel)) {
    // A mind may name a feeling without keeping a record (a custom Mind); with neither, the player is new.
    if (feelWord) return [`The player: ${feelWord}.`];
    return ['The player: a stranger. You had never met them before this conversation.'];
  }
  const at = num(t);
  const lastSeen = num(rel.lastSeen);
  // A lastSeen within the last half hour is this encounter (a mind that has already heard the player's words).
  const current = lastSeen !== null && at !== null && at >= lastSeen && at - lastSeen < SAME_ENCOUNTER_MS;
  // `met` may be a flag, a count of meetings or the time of the first meeting.
  const metN = num(rel.met);
  const firstMet = metN !== null && metN > 1e11 ? metN : null;
  const count = metN !== null && metN < 1e6 ? Math.round(metN) : null;
  const before = count !== null ? count - (current ? 1 : 0) : null;
  const bits = [];
  if (current && before !== null && before <= 0) bits.push('you only met them today, in this conversation');
  else {
    const times = before !== null && before > 1 ? ` (${before} times)` : '';
    const first = firstMet !== null && at !== null ? ago(firstMet, at) : '';
    const last = !current && lastSeen !== null && at !== null ? ago(lastSeen, at) : '';
    bits.push(`you have talked before${times}${first ? `, first ${first}` : ''}${last ? `, most recently ${last}` : ''}`);
  }
  if (feelWord) bits.push(feelWord);
  const aff = num(rel.affinity);
  if (aff !== null && !feelWord) bits.push(aff > 0.5 ? 'you like them a lot' : aff > 0.15 ? 'you like them' : aff < -0.5 ? 'you really dislike them' : aff < -0.15 ? "you're not fond of them" : 'you feel neutral about them');
  const trust = num(rel.trust);
  if (trust !== null && ms.label.toLowerCase() !== 'wary') bits.push(trust > 0.5 ? 'you trust them' : trust > 0.15 ? 'you trust them somewhat' : trust < -0.15 ? "you don't trust them" : "you're still sizing them up");
  const out = [`The player: ${bits.join('; ')}.`];
  const seen = new Set();
  const facts = [];
  for (const f of list(rel.facts)) {
    const s = factText(f);
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); facts.push(s); }
  }
  if (facts.length) out.push(`What you know about the player: ${facts.slice(-8).join('; ')}.`);
  return out;
}

function recalledLines(recalled, t) {
  const items = list(recalled).slice(0, 6).map(r => {
    if (typeof r === 'string') return text(r);
    if (!isObj(r) || !text(r.text)) return '';
    let when = '';
    if (num(r.t) !== null && num(t) !== null) when = ago(r.t, t);
    else if (num(r.year) !== null) when = `in ${r.year}`;
    else if (fmtDate(r.date)) when = `on ${fmtDate(r.date)}`;
    return `${when ? `(${when}) ` : ''}${text(r.text)}`;
  }).filter(Boolean);
  return items.length ? ['Memories that come to mind:', ...items.map(x => `- ${x}`)] : [];
}

/**
 * The memories a Mind brings up for the player's message: mind.recall(said, k, {t}) (recency × importance ×
 * relevance in mind.mjs), without the memory of this very message when the mind has already heard it.
 * Never throws: a failing recall means nothing comes to mind.
 * @param {object|null} mind
 * @param {string} said
 * @param {number|null} t
 * @param {number} [k]
 * @returns {Array<object>}
 */
export function recallFor(mind, said, t, k = 4) {
  if (!mind || typeof mind.recall !== 'function' || typeof said !== 'string' || !said.trim()) return [];
  let hits;
  try { hits = mind.recall(said, k + 1, num(t) !== null ? { t } : {}); } catch { return []; }
  const probe = said.trim().slice(0, 200);
  return list(hits).filter(r => !(isObj(r) && typeof r.text === 'string' && r.text.includes(probe))).slice(0, k);
}

/**
 * The per-turn situation note, sent as a {role: 'system'} message right after the player's message so the
 * cached prefix never changes: local time and part of day, what the NPC is doing, the weather and alerts
 * (world.weatherAt output, split into alerts in effect and alerts coming up), mood and needs, what the NPC knows
 * and feels about the player, and memories recalled for this message.
 * @param {object} persona
 * @param {object|null} mind   a Mind (mind.mjs) or its state; optional
 * @param {{t?: number, weather?: object, activity?: object|string, recalled?: Array, world?: object}} [ctx]
 *   world, when given, marks shore-only alerts for an inland ZIP
 * @returns {string}
 */
export function situation(persona, mind, ctx = {}) {
  const { t, weather, activity, recalled, world } = isObj(ctx) ? ctx : {};
  const first = firstName(persona);
  const lines = ['[Situation for this turn. The player cannot see this note; never quote it or mention it.]'];
  if (num(t) !== null) {
    const p = pacific(t);
    lines.push(`Local time: ${p.dayName}, ${p.monthName} ${p.day}, ${p.year}, ${fmtClock(p.minuteOfDay)} Pacific (${DAY_PART_WORDS[dayPart(p.minuteOfDay)]}).`);
  }
  const act = activityLine(activity);
  if (act) lines.push(act);
  lines.push(...weatherLines(weather, num(t), coastKmOf(world, persona)));
  const ms = mindState(mind);
  const mood = moodLine(ms);
  if (mood) lines.push(mood);
  if (mind) lines.push(...feelingLines(ms, t));
  lines.push(...recalledLines(recalled, t));
  lines.push(`Answer the player's last message as ${first === 'you' ? 'yourself' : first}: in character, in your own voice, one to four sentences unless they ask for more.`);
  return lines.join('\n');
}

// ---------------------------------------------------------------- conversation history

const TRIM_TO = 0.6;

function turnChars(turn) { return turn.user.length + turn.situation.length + turn.assistant.length; }

function freezeTurn({ user, assistant, situation: sit = '', t = null, model = null }) {
  if (typeof user !== 'string' || typeof assistant !== 'string') throw new TypeError('a turn needs user and assistant text');
  return Object.freeze({ user, situation: typeof sit === 'string' ? sit : '', assistant, t: num(t), model: typeof model === 'string' ? model : null });
}

/**
 * An append-only conversation. Each completed exchange (the player's message, the situation note sent with it,
 * the NPC's reply) is frozen when appended and never edited. Only the oldest exchanges are trimmed from what is
 * sent to Claude, and in chunks (down to 60% of the budget once it is exceeded), so the request prefix stays
 * byte-identical, and cached, for many turns between trims. Trimmed exchanges stay in `turns` for transcripts.
 */
export class History {
  /**
   * @param {{budget?: number, turns?: Array<object>, start?: number}} [options] budget in characters of earlier turns
   */
  constructor({ budget = DEFAULTS.historyBudget, turns = [], start = 0 } = {}) {
    this.budget = num(budget) !== null && budget > 0 ? budget : DEFAULTS.historyBudget;
    this._turns = list(turns).map(freezeTurn);
    this._start = clamp(Math.floor(num(start) ?? 0), 0, this._turns.length);
  }

  /** Number of exchanges ever appended. */
  get length() { return this._turns.length; }

  /** Index of the oldest exchange still sent to Claude; it only ever moves forward. */
  get start() { return this._start; }

  /** Every exchange, oldest first (frozen objects). */
  get turns() { return this._turns.slice(); }

  /** The exchanges still sent to Claude. */
  window() { return this._turns.slice(this._start); }

  /** Characters in the window. */
  windowChars() { let n = 0; for (let i = this._start; i < this._turns.length; i++) n += turnChars(this._turns[i]); return n; }

  /**
   * Append a completed exchange, then trim the window from the oldest end if it is over budget.
   * @param {{user: string, assistant: string, situation?: string, t?: number, model?: string}} turn
   * @returns {object} the frozen turn
   */
  append(turn) {
    const frozen = freezeTurn(turn);
    this._turns.push(frozen);
    let total = this.windowChars();
    if (total > this.budget) {
      while (total > this.budget * TRIM_TO && this._start < this._turns.length - 1) total -= turnChars(this._turns[this._start++]);
    }
    return frozen;
  }

  /** The window as Messages API messages (fresh objects every call): user, system note, assistant per exchange. */
  messages() {
    const out = [];
    for (const turn of this.window()) {
      out.push({ role: 'user', content: [{ type: 'text', text: turn.user }] });
      if (turn.situation) out.push({ role: 'system', content: turn.situation });
      out.push({ role: 'assistant', content: [{ type: 'text', text: turn.assistant }] });
    }
    return out;
  }

  /** The whole conversation as [{speaker: 'player'|'npc', text, t}], oldest first. */
  transcript() {
    const out = [];
    for (const turn of this._turns) {
      out.push({ speaker: 'player', text: turn.user, t: turn.t });
      out.push({ speaker: 'npc', text: turn.assistant, t: turn.t });
    }
    return out;
  }

  /** Serializable state; History.from(json) restores it. */
  toJSON() { return { v: 1, budget: this.budget, start: this._start, turns: this._turns.map(x => ({ ...x })) }; }

  /** Restore a History from toJSON() output. */
  static from(json) { return new History(isObj(json) ? json : {}); }
}

const ARRAY_START = new WeakMap();

function messageChars(m) {
  if (!isObj(m)) return 0;
  if (typeof m.content === 'string') return m.content.length;
  return list(m.content).reduce((n, b) => n + (isObj(b) && typeof b.text === 'string' ? b.text.length : 0), 0);
}

/** A plain array of Messages API messages used as an append-only history (start index kept on the side). */
class ArrayHistory {
  constructor(arr, budget) { this.arr = arr; this.budget = budget; }
  get start() { return ARRAY_START.get(this.arr) || 0; }
  messages() {
    // A request must open with a user turn, so the window starts at the first one (an opening NPC greeting is skipped).
    let from = this.start;
    while (from < this.arr.length && !(isObj(this.arr[from]) && this.arr[from].role === 'user')) from++;
    return this.arr.slice(from).map(m => ({ ...m }));
  }
  append({ user, assistant, situation: sit }) {
    this.arr.push({ role: 'user', content: [{ type: 'text', text: user }] });
    if (sit) this.arr.push({ role: 'system', content: sit });
    this.arr.push({ role: 'assistant', content: [{ type: 'text', text: assistant }] });
    let start = this.start;
    let total = 0;
    for (let i = start; i < this.arr.length; i++) total += messageChars(this.arr[i]);
    if (total > this.budget) {
      const lastUser = this.arr.length - (sit ? 3 : 2);
      while (total > this.budget * TRIM_TO && start < lastUser) {
        total -= messageChars(this.arr[start]);
        start++;
        while (start < lastUser && !(isObj(this.arr[start]) && this.arr[start].role === 'user')) total -= messageChars(this.arr[start++]);
      }
      ARRAY_START.set(this.arr, start);
    }
  }
}

function asHistory(history, budget) {
  if (history instanceof History) return history;
  if (Array.isArray(history)) return new ArrayHistory(history, budget);
  if (history && typeof history.messages === 'function' && typeof history.append === 'function') return history;
  return new History({ budget });
}

function renderTranscript(persona, transcript) {
  const first = firstName(persona);
  const me = first === 'you' ? 'You' : first;
  let rows = [];
  if (transcript instanceof History) rows = transcript.transcript();
  else if (typeof transcript === 'string') return transcript.trim();
  else if (Array.isArray(transcript)) {
    for (const r of transcript) {
      if (!isObj(r)) continue;
      const role = r.role ?? r.speaker ?? r.from;
      if (role === 'system') continue;
      const body = typeof r.content === 'string' ? r.content : Array.isArray(r.content) ? r.content.map(b => (isObj(b) && b.type === 'text' ? b.text : '')).join('') : r.text;
      rows.push({ speaker: role === 'assistant' || role === 'npc' ? 'npc' : 'player', text: typeof body === 'string' ? body : '' });
    }
  }
  const lines = rows.filter(r => text(r.text)).map(r => `${r.speaker === 'npc' ? me : 'Player'}: ${r.text.trim()}`);
  let out = lines.join('\n');
  // Keep the most recent part of a very long conversation.
  if (out.length > 40000) out = '[…]\n' + out.slice(out.length - 40000).replace(/^[^\n]*\n/, '');
  return out;
}

// ---------------------------------------------------------------- reflection (structured output)

/** Moods a reflection may report (the enum of REFLECTION_SCHEMA.properties.mood). */
export const MOODS = Object.freeze(['happy', 'content', 'calm', 'grateful', 'amused', 'excited', 'proud', 'hopeful', 'affectionate', 'neutral', 'curious', 'surprised', 'confused', 'bored', 'tired', 'uneasy', 'anxious', 'worried', 'sad', 'lonely', 'embarrassed', 'annoyed', 'frustrated', 'angry', 'hurt']);

/**
 * JSON schema for reflect() (output_config.format). Every object closes with additionalProperties: false and
 * lists every property as required; ranges live in the descriptions (structured outputs do not enforce
 * numeric bounds), and validateReflection() checks them.
 */
export const REFLECTION_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'facts_about_player', 'affinity_delta', 'trust_delta', 'mood', 'memorable_line', 'follow_up'],
  properties: {
    summary: { type: 'string', description: 'One to three sentences, in your own first-person voice, on what happened in the conversation.' },
    facts_about_player: { type: 'array', items: { type: 'string' }, description: 'Things the player actually said about themselves (name, work, family, where they live, plans, likes) as short phrases; at most 8; empty if none.' },
    affinity_delta: { type: 'number', description: 'Change in how much you like the player, from -1 to 1. An ordinary pleasant chat is about +0.05 to +0.15.' },
    trust_delta: { type: 'number', description: 'Change in how much you trust the player, from -1 to 1.' },
    mood: { type: 'string', enum: [...MOODS], description: 'Your mood now.' },
    memorable_line: { type: 'string', description: 'The one line from the conversation you will remember, quoted exactly, or an empty string.' },
    follow_up: { type: 'string', description: 'Something you want to ask or bring up next time you see the player, or an empty string.' },
  },
});

const REFLECTION_KEYS = REFLECTION_SCHEMA.required;

/**
 * Validate and normalize a parsed reflection. Rejects anything that does not match REFLECTION_SCHEMA (missing
 * or extra keys, wrong types, unknown mood, non-finite numbers); trims strings, drops empty and duplicate
 * facts (at most 8), clamps the deltas to [-1, 1] and turns empty optional lines into null.
 * @param {unknown} data
 * @returns {{ok: true, value: {summary: string, facts_about_player: string[], affinity_delta: number, trust_delta: number, mood: string, memorable_line: string|null, follow_up: string|null}} | {ok: false, errors: string[]}}
 */
export function validateReflection(data) {
  const errors = [];
  if (!isObj(data)) return { ok: false, errors: ['the reflection is not a JSON object'] };
  for (const k of REFLECTION_KEYS) if (!(k in data)) errors.push(`missing "${k}"`);
  for (const k of Object.keys(data)) if (!REFLECTION_KEYS.includes(k)) errors.push(`unexpected "${k}"`);
  if ('summary' in data && (typeof data.summary !== 'string' || !data.summary.trim())) errors.push('"summary" must be a non-empty string');
  if ('facts_about_player' in data && (!Array.isArray(data.facts_about_player) || data.facts_about_player.some(x => typeof x !== 'string'))) errors.push('"facts_about_player" must be an array of strings');
  for (const k of ['affinity_delta', 'trust_delta']) if (k in data && num(data[k]) === null) errors.push(`"${k}" must be a finite number`);
  if ('mood' in data && (typeof data.mood !== 'string' || !MOODS.includes(data.mood.trim().toLowerCase()))) errors.push(`"mood" must be one of ${MOODS.join(', ')}`);
  for (const k of ['memorable_line', 'follow_up']) if (k in data && typeof data[k] !== 'string') errors.push(`"${k}" must be a string`);
  if (errors.length) return { ok: false, errors };
  const seen = new Set();
  const facts = [];
  for (const f of data.facts_about_player) {
    const s = text(f).slice(0, 200);
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); facts.push(s); }
  }
  return {
    ok: true,
    value: {
      summary: data.summary.trim(),
      facts_about_player: facts.slice(0, 8),
      affinity_delta: clamp(data.affinity_delta, -1, 1),
      trust_delta: clamp(data.trust_delta, -1, 1),
      mood: data.mood.trim().toLowerCase(),
      memorable_line: text(data.memorable_line) || null,
      follow_up: text(data.follow_up) || null,
    },
  };
}

function reflectInstructions(persona) {
  const first = firstName(persona);
  const me = first === 'you' ? 'yourself' : first;
  return [
    `The transcript above is your conversation with the player, which has just ended. Reflect on it privately, as ${me}: what you learned about the player, how you feel about them now, your mood, and what will stay with you. This is for your own memory; the player never sees it.`,
    '- summary: one to three sentences in your own first-person voice.',
    '- facts_about_player: only things the player actually said about themselves (their name, work, family, where they live, plans, likes), as short phrases. Leave it empty if they shared nothing.',
    '- affinity_delta and trust_delta: how much this conversation changed how much you like and trust the player, from -1 to 1. An ordinary pleasant chat is about +0.05 to +0.15; real kindness or a shared connection more; rudeness, lies or threats go negative. Most conversations change things only a little.',
    '- mood: your mood now.',
    '- memorable_line: the one line from the conversation you will remember, quoted exactly, or an empty string.',
    '- follow_up: something you would like to ask or bring up next time you see the player, or an empty string.',
  ].join('\n');
}

// ---------------------------------------------------------------- errors

/** An error from the Claude bridge with a plain-language message for the UI. */
export class VoiceError extends Error {
  /**
   * @param {string} code  'no_key' | 'config' | 'auth' | 'permission' | 'not_found' | 'billing' | 'rate_limit' | 'bad_request' | 'too_large' | 'overloaded' | 'server' | 'timeout' | 'connection' | 'aborted' | 'refusal' | 'invalid_output' | 'empty' | 'api' | 'unknown'
   * @param {string} message
   * @param {{status?: number|null, retryable?: boolean, retryAfter?: number|null, requestId?: string|null, cause?: unknown}} [details]
   */
  constructor(code, message, { status = null, retryable = false, retryAfter = null, requestId = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'VoiceError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
    this.requestId = requestId;
  }
}

function retryAfterSeconds(headers) {
  const get = k => (headers && typeof headers.get === 'function' ? headers.get(k) : null);
  const ms = Number(get('retry-after-ms'));
  if (Number.isFinite(ms) && ms > 0) return Math.ceil(ms / 1000);
  const v = get('retry-after');
  if (v === null || v === undefined || v === '') return null;
  const s = Number(v);
  if (Number.isFinite(s)) return Math.max(0, Math.ceil(s));
  return null;
}

function originOf(url) {
  try { return new URL(String(url)).origin; } catch { return String(url || 'the configured address'); }
}

/**
 * Map an error from the SDK (typed APIError subclasses, connection and abort errors, local configuration errors)
 * to {code, message, retryable, status, retryAfter, requestId} with a message a player can act on.
 * @param {unknown} err
 * @param {{model?: string, baseURL?: string|null, proxied?: boolean, hasKey?: boolean}} [ctx]
 */
export function describeError(err, ctx = {}) {
  const { model = DEFAULTS.model, baseURL = null, proxied = false, hasKey = true } = ctx;
  if (err instanceof VoiceError) return { code: err.code, message: err.message, retryable: err.retryable, status: err.status, retryAfter: err.retryAfter, requestId: err.requestId };
  const label = (modelInfo(model) || {}).label || model;
  const server = `the Legion server at ${originOf(baseURL)}`;
  const status = err && typeof err.status === 'number' ? err.status : null;
  const api = err && typeof err.apiMessage === 'string' && err.apiMessage ? err.apiMessage : null;
  const requestId = (err && err.requestID) || null;
  const out = (code, message, retryable = false, extra = {}) => ({ code, message, retryable, status, retryAfter: null, requestId, ...extra });
  // Every class is checked for existence first, so a future SDK that drops one cannot turn this into a TypeError.
  const is = name => typeof Anthropic[name] === 'function' && err instanceof Anthropic[name];
  if (is('APIUserAbortError')) return out('aborted', 'The reply was cancelled.');
  if (is('APIConnectionTimeoutError')) return out('timeout', proxied ? `${capitalize(server)} took too long to answer.` : 'Claude took too long to answer. Try again.', true);
  if (is('APIConnectionError')) return out('connection', proxied ? `Couldn't reach ${server}. Is "node server/serve.mjs" running?` : "Couldn't reach Claude. Check your internet connection and try again.", true);
  if (is('AuthenticationError')) return out('auth', proxied ? (api || "The Legion server's Anthropic API key was rejected.") : 'Claude rejected the API key. Check the key in Settings.');
  if (is('PermissionDeniedError')) return out('permission', proxied && api ? api : `This API key isn't allowed to use ${label}. Try another model in Settings.`);
  if (is('NotFoundError')) return out('not_found', proxied && api ? api : `${label} isn't available to this API key. Try another model in Settings.`);
  if (is('PaymentRequiredError')) return out('billing', 'The Anthropic account behind this key needs billing attention before Claude can answer.');
  if (is('RateLimitError')) {
    const wait = retryAfterSeconds(err.headers);
    return out('rate_limit', `Claude is getting too many requests right now. Try again in ${wait ? `${wait} second${wait === 1 ? '' : 's'}` : 'a moment'}.`, true, { retryAfter: wait });
  }
  if (is('ContentTooLargeError')) return out('too_large', 'This conversation has grown too long to send. Start a new one.');
  if (is('BadRequestError')) return out('bad_request', `Claude couldn't accept that request: ${api || err.message}`);
  if (is('OverloadedError')) return out('overloaded', 'Claude is overloaded right now. Try again in a moment.', true);
  if (is('InternalServerError')) return out('server', proxied && api ? api : 'Claude hit a server error. Try again in a moment.', true);
  if (is('APIError')) {
    // Errors delivered inside a stream carry no status; their type says what happened.
    const type = err.type || (err.error && err.error.error && err.error.error.type) || null;
    const msg = api || err.message;
    switch (type) {
      case 'overloaded_error': return out('overloaded', 'Claude is overloaded right now. Try again in a moment.', true);
      case 'rate_limit_error': return out('rate_limit', 'Claude is getting too many requests right now. Try again in a moment.', true);
      case 'api_error': return out('server', 'Claude hit a server error. Try again in a moment.', true);
      case 'authentication_error': return out('auth', proxied ? msg : 'Claude rejected the API key. Check the key in Settings.');
      case 'permission_error': return out('permission', msg);
      case 'not_found_error': return out('not_found', msg);
      case 'invalid_request_error': return out('bad_request', `Claude couldn't accept that request: ${msg}`);
      case 'request_too_large': return out('too_large', 'This conversation has grown too long to send. Start a new one.');
      case 'billing_error': return out('billing', 'The Anthropic account behind this key needs billing attention before Claude can answer.');
      default: return out('api', `Claude returned an error: ${msg}`, status !== null && status >= 500);
    }
  }
  if (is('AnthropicError')) {
    if (!hasKey && !proxied) return out('no_key', 'Add your Claude API key in Settings, or open Legion from the Legion server (node server/serve.mjs) to use its key.');
    return out('config', `The Claude client isn't set up correctly: ${err.message}`);
  }
  const message = err && typeof err.message === 'string' ? err.message : String(err);
  return out('unknown', `Something went wrong talking to Claude: ${message}`);
}

function toVoiceError(err, ctx) {
  if (err instanceof VoiceError) return err;
  const d = describeError(err, ctx);
  return new VoiceError(d.code, d.message, { status: d.status, retryable: d.retryable, retryAfter: d.retryAfter, requestId: d.requestId, cause: err });
}

const REFUSAL_REASONS = {
  cyber: 'it looked like a cybersecurity request',
  bio: 'it looked like a request about dangerous biology',
  frontier_llm: 'it looked like a request to help build an AI model',
  reasoning_extraction: "it asked for Claude's internal reasoning",
  general_harms: 'it touched a topic Claude does not help with',
};

function refusalOf(message) {
  const d = isObj(message.stop_details) ? message.stop_details : {};
  const category = typeof d.category === 'string' ? d.category : null;
  const why = category && REFUSAL_REASONS[category];
  return {
    category,
    explanation: typeof d.explanation === 'string' ? d.explanation : null,
    message: `Claude declined to continue this turn${why ? ` (${why})` : ''}. Try saying it another way.`,
  };
}

// ---------------------------------------------------------------- reading a reply

function normUsage(u) {
  const n = k => (u && num(u[k]) !== null ? u[k] : 0);
  const out = {
    input_tokens: n('input_tokens'),
    output_tokens: n('output_tokens'),
    cache_read_input_tokens: n('cache_read_input_tokens'),
    cache_creation_input_tokens: n('cache_creation_input_tokens'),
  };
  if (u && Array.isArray(u.iterations)) out.iterations = u.iterations;
  return out;
}

function fallbackOf(message) {
  const blocks = list(message.content).filter(b => isObj(b) && b.type === 'fallback');
  const ran = message.usage && Array.isArray(message.usage.iterations) && message.usage.iterations.some(it => isObj(it) && it.type === 'fallback_message');
  if (!blocks.length && !ran) return null;
  const last = blocks[blocks.length - 1];
  return { from: last && isObj(last.from) ? last.from.model ?? null : null, to: (last && isObj(last.to) ? last.to.model : null) ?? message.model ?? null };
}

function replyText(message) {
  return list(message.content).filter(b => isObj(b) && b.type === 'text' && typeof b.text === 'string').map(b => b.text).join('');
}

/** Tidy a reply for display and history: trim, unwrap a reply wholly in quotes, drop a leading "Name:" label. */
function tidy(raw, persona) {
  let s = String(raw || '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const names = [firstName(persona), displayName(persona)].filter(n => n && n !== 'you');
  for (const n of names) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`^\\**${esc}\\**\\s*:\\s+`, 'i').exec(s);
    if (m) { s = s.slice(m[0].length); break; }
  }
  const q = /^(["“])([\s\S]*)(["”])$/.exec(s);
  if (q && !/["“”]/.test(q[2])) s = q[2].trim();
  return s;
}

// Sentence ends: Latin-script marks (and the Arabic and Devanagari ones) close a sentence before a space or the
// end; the full-width CJK marks close one wherever they stand, since Chinese and Japanese put no space after.
const SPACED_END = /[.!?…؟।](?:["'”’)\]»」』]+)?(?=\s|$)/g;
const CJK_END = /[。！？｡](?:[」』）》〉"'”’]+)?/g;

/** Cut a reply that hit max_tokens back to its last complete sentence (or mark where it trails off). */
function trimToSentence(s) {
  let end = -1;
  for (const re of [SPACED_END, CJK_END]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) end = Math.max(end, m.index + m[0].length);
  }
  if (end > 0 && end >= s.length * 0.3) return s.slice(0, end).trim();
  const t = s.replace(/[\s,;:–—-]+$/, '');
  return t ? `${t}…` : '';
}

// ---------------------------------------------------------------- the voice

function isNode() { return typeof process !== 'undefined' && !!(process.versions && process.versions.node); }

/** The placeholder key the SDK sends to the Legion proxy, which holds the real credential. */
export const PROXY_DUMMY_KEY = 'legion-proxy';

function absoluteURL(u) {
  if (!u) return null;
  const s = String(u);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s.replace(/\/+$/, '');
  const base = globalThis.location && globalThis.location.href;
  if (base) return new URL(s, base).href.replace(/\/+$/, '');
  throw new TypeError(`a relative proxy URL (${s}) needs a page location to resolve against; pass an absolute URL`);
}

/**
 * The Claude voice of Legion's NPCs.
 *
 * new ClaudeVoice({apiKey})                                  direct, with the player's key (Node, or the browser with dangerouslyAllowBrowser)
 * new ClaudeVoice({proxyURL: 'http://127.0.0.1:8787/api/anthropic'})  through server/serve.mjs, which holds the key
 *                                                            (any apiKey given alongside is never sent)
 * new ClaudeVoice({client})                                  any SDK-compatible client (tests, custom transports)
 */
export class ClaudeVoice {
  /**
   * @param {{apiKey?: string, model?: string, effort?: string, maxTokens?: number, baseURL?: string, proxyURL?: string,
   *   dangerouslyAllowBrowser?: boolean, client?: object, world?: object, fallbacks?: boolean, reflectEffort?: string,
   *   reflectMaxTokens?: number, historyBudget?: number, timeout?: number, maxRetries?: number}} [options]
   */
  constructor(options = {}) {
    const o = isObj(options) ? options : {};
    this.model = o.model ?? DEFAULTS.model;
    this.effort = o.effort ?? DEFAULTS.effort;
    this.maxTokens = o.maxTokens ?? DEFAULTS.maxTokens;
    this.reflectEffort = o.reflectEffort ?? DEFAULTS.reflectEffort;
    this.reflectMaxTokens = o.reflectMaxTokens ?? DEFAULTS.reflectMaxTokens;
    this.historyBudget = num(o.historyBudget) !== null && o.historyBudget > 0 ? o.historyBudget : DEFAULTS.historyBudget;
    /** The world, for the place facts in the persona sheet. */
    this.world = o.world ?? null;
    /** Server-side refusal fallback: on by default where the model supports it. */
    this.fallbacks = o.fallbacks !== false;
    this._injected = o.client ?? null;
    this._client = null;
    this.baseURL = absoluteURL(o.proxyURL ?? o.baseURL ?? null);
    /** True when requests go through the Legion server's proxy (which holds the key). */
    this.proxied = !!o.proxyURL || (!!this.baseURL && /\/api\/anthropic$/.test(this.baseURL));
    const proxy = this.proxied;
    this._hasKey = typeof o.apiKey === 'string' && o.apiKey.length > 0;
    this._clientOptions = {
      // The proxy answers with the server's own credential and ignores this one, so a key the player also keeps
      // in Settings never leaves the page (the SDK would send it as a bearer header, in clear on plain HTTP).
      apiKey: proxy ? PROXY_DUMMY_KEY : (this._hasKey ? o.apiKey : undefined),
      ...(this.baseURL ? { baseURL: this.baseURL } : {}),
      // Through the proxy the page holds no secret, so the SDK's browser guard has nothing to protect.
      dangerouslyAllowBrowser: proxy ? true : o.dangerouslyAllowBrowser === true,
      ...(num(o.timeout) !== null ? { timeout: o.timeout } : {}),
      ...(num(o.maxRetries) !== null ? { maxRetries: o.maxRetries } : {}),
    };
    if (proxy) this._hasKey = true;
  }

  /** The model id; must be one of MODELS. */
  get model() { return this._model; }
  set model(id) {
    if (!MODEL_BY_ID.has(id)) throw new RangeError(`unknown model "${id}"; use one of ${MODELS.map(m => m.id).join(', ')}`);
    this._model = id;
  }

  /** The effort for conversation turns; one of EFFORTS. */
  get effort() { return this._effort; }
  set effort(e) {
    if (!EFFORTS.includes(e)) throw new RangeError(`unknown effort "${e}"; use one of ${EFFORTS.join(', ')}`);
    this._effort = e;
  }

  /** The effort for reflections; one of EFFORTS. */
  get reflectEffort() { return this._reflectEffort; }
  set reflectEffort(e) {
    if (!EFFORTS.includes(e)) throw new RangeError(`unknown effort "${e}"; use one of ${EFFORTS.join(', ')}`);
    this._reflectEffort = e;
  }

  /** max_tokens for conversation turns (thinking plus reply). */
  get maxTokens() { return this._maxTokens; }
  set maxTokens(n) {
    if (!Number.isInteger(n) || n < 1 || n > 128000) throw new RangeError('maxTokens must be an integer from 1 to 128000');
    this._maxTokens = n;
  }

  /** max_tokens for reflections. */
  get reflectMaxTokens() { return this._reflectMaxTokens; }
  set reflectMaxTokens(n) {
    if (!Number.isInteger(n) || n < 256 || n > 128000) throw new RangeError('reflectMaxTokens must be an integer from 256 to 128000');
    this._reflectMaxTokens = n;
  }

  /** The SDK client (created on first use, so a missing key or browser guard surfaces as a VoiceError). */
  get client() {
    if (this._injected) return this._injected;
    if (!this._client) {
      if (!this._hasKey && !isNode()) throw new VoiceError('no_key', 'Add your Claude API key in Settings, or open Legion from the Legion server (node server/serve.mjs) to use its key.');
      try {
        this._client = new Anthropic(this._clientOptions);
      } catch (err) {
        // The SDK refuses to hold a key in a page unless the player has opted in.
        if (!isNode() && !this._clientOptions.dangerouslyAllowBrowser) {
          throw new VoiceError('config', 'Using your own Claude key in this browser needs your OK first: allow it in Settings, or open Legion from the Legion server (node server/serve.mjs) so the key stays there.', { cause: err });
        }
        throw err;
      }
    }
    return this._client;
  }

  _ctx() { return { model: this.model, baseURL: this.baseURL, proxied: this.proxied, hasKey: this._hasKey || isNode() }; }

  _fallback() { return fallbackParams(this.model, this.fallbacks); }

  /**
   * The exact request a turn would send, without sending it (for the Prompt tab, the CLI and tests). Options as
   * for stream(); when `recalled` is not given, the mind's recall(playerText, 4, {t}) supplies the memories.
   * @param {object} persona
   * @param {object|null} mind
   * @param {History|Array|null} history
   * @param {string} playerText
   * @param {{t?: number, weather?: object, activity?: object|string, recalled?: Array, world?: object}} [opts]
   * @returns {{params: object, situation: string, text: string, history: object}}
   */
  request(persona, mind, history, playerText, opts = {}) {
    const o = isObj(opts) ? opts : {};
    const said = typeof playerText === 'string' ? playerText.trim() : '';
    if (!said) throw new VoiceError('empty', 'Say something first.');
    if (said.length > DEFAULTS.maxPlayerChars) throw new VoiceError('bad_request', `That message is too long (the limit is ${fmtInt(DEFAULTS.maxPlayerChars)} characters).`);
    const hist = asHistory(history, this.historyBudget);
    const world = o.world ?? this.world;
    // Without explicit memories, the mind brings up its own for what the player just said.
    const recalled = o.recalled !== undefined ? o.recalled : recallFor(mind, said, num(o.t));
    const note = situation(persona, mind, { t: o.t, weather: o.weather, activity: o.activity, recalled, world });
    const params = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemBlocks(persona, world),
      messages: [
        ...hist.messages(),
        // The breakpoint on the newest player message lets the next turn read this whole prefix from the cache.
        { role: 'user', content: [{ type: 'text', text: said, cache_control: { type: 'ephemeral' } }] },
        { role: 'system', content: note },
      ],
      output_config: { effort: this.effort },
      ...this._fallback(),
    };
    return { params, situation: note, text: said, history: hist };
  }

  /**
   * One conversation turn, streamed. Appends the exchange to `history` only when it completes with a reply
   * (not on a refusal, an error or a cancel). onText(delta, textSoFar) receives text as it arrives; the
   * returned `text` is authoritative (empty after a refusal, cut back to a full sentence after max_tokens).
   * The mind is read, never changed: what the NPC knows and feels about the player and the memories its
   * recall() brings up for the player's message go into the situation note.
   * @param {object} persona
   * @param {object|null} mind
   * @param {History|Array|null} history
   * @param {string} playerText
   * @param {{t?: number, weather?: object, activity?: object|string, recalled?: Array, onText?: Function, signal?: AbortSignal, world?: object}} [opts]
   * @returns {Promise<{text: string, usage: object, stopReason: string|null, model: string, refusal: object|null, truncated: boolean, fallback: object|null, cacheHit: boolean, situation: string, id: string|null}>}
   */
  async stream(persona, mind, history, playerText, opts = {}) {
    const o = isObj(opts) ? opts : {};
    const { params, situation: note, text: said, history: hist } = this.request(persona, mind, history, playerText, o);
    const ctx = this._ctx();
    let streamed = '';
    let message;
    try {
      const s = this.client.beta.messages.stream(params, o.signal ? { signal: o.signal } : undefined);
      s.on('text', delta => {
        streamed += delta;
        if (typeof o.onText === 'function') {
          try { o.onText(delta, streamed); } catch { /* a UI callback must not break the stream */ }
        }
      });
      message = await s.finalMessage();
    } catch (err) {
      throw toVoiceError(err, ctx);
    }
    const stopReason = message.stop_reason ?? null;
    const usage = normUsage(message.usage);
    const base = {
      usage, stopReason, model: message.model || this.model, requestedModel: this.model,
      fallback: fallbackOf(message), cacheHit: usage.cache_read_input_tokens > 0, situation: note, id: message.id ?? null,
    };
    if (stopReason === 'refusal') return { ...base, text: '', refusal: refusalOf(message), truncated: false };
    let reply = tidy(replyText(message) || streamed, persona);
    let truncated = false;
    if (stopReason === 'max_tokens' || stopReason === 'model_context_window_exceeded') {
      truncated = true;
      reply = trimToSentence(reply);
    }
    if (reply) hist.append({ user: said, situation: note, assistant: reply, t: num(o.t), model: base.model });
    return { ...base, text: reply, refusal: null, truncated, ...(reply ? {} : { notice: truncated ? 'The reply ran out of room before it started. Try again.' : 'Claude returned an empty reply. Try again.' }) };
  }

  /**
   * Reflect on a finished conversation: a structured summary the mind stores (facts about the player, affinity
   * and trust changes, mood, a memorable line, a follow-up), via output_config.format with REFLECTION_SCHEMA.
   * The request sends the NPC's own system blocks so the reflection is in character; a structured-output format
   * changes the request's cached prefix, so it does not read the conversation's cache entries.
   * @param {object} persona
   * @param {History|Array|string} transcript
   * @param {{signal?: AbortSignal, world?: object}} [opts]
   */
  async reflect(persona, transcript, opts = {}) {
    const o = isObj(opts) ? opts : {};
    const body = renderTranscript(persona, transcript);
    if (!body) throw new VoiceError('empty', 'There is no conversation to reflect on yet.');
    const params = {
      model: this.model,
      max_tokens: this.reflectMaxTokens,
      system: systemBlocks(persona, o.world ?? this.world),
      messages: [
        { role: 'user', content: [{ type: 'text', text: `[Transcript of your conversation with the player, oldest first]\n\n${body}` }] },
        { role: 'system', content: reflectInstructions(persona) },
      ],
      output_config: { effort: this.reflectEffort, format: { type: 'json_schema', schema: REFLECTION_SCHEMA } },
      ...this._fallback(),
    };
    const ctx = this._ctx();
    let message;
    try {
      message = await this.client.beta.messages.create(params, o.signal ? { signal: o.signal } : undefined);
    } catch (err) {
      throw toVoiceError(err, ctx);
    }
    if (message.stop_reason === 'refusal') {
      const r = refusalOf(message);
      throw new VoiceError('refusal', r.message.replace('this turn', 'the reflection'), { status: 200 });
    }
    if (message.stop_reason === 'max_tokens') throw new VoiceError('invalid_output', 'The reflection was cut off before it finished.', { retryable: true });
    let data;
    try {
      data = JSON.parse(replyText(message));
    } catch {
      throw new VoiceError('invalid_output', 'Claude returned a reflection that was not valid JSON.', { retryable: true });
    }
    const v = validateReflection(data);
    if (!v.ok) throw new VoiceError('invalid_output', `Claude returned a reflection that did not match the schema: ${v.errors.join('; ')}.`, { retryable: true });
    return { ...v.value, usage: normUsage(message.usage), model: message.model || this.model };
  }

  /**
   * Check that the key (or the proxy) works and the model is available, without spending tokens
   * (a Models API lookup). Never throws.
   * @param {{signal?: AbortSignal}} [opts]
   * @returns {Promise<{ok: true, model: string, label: string, latencyMs: number} | {ok: false, code: string, message: string, status: number|null, latencyMs: number}>}
   */
  async ping(opts = {}) {
    const clock = globalThis.performance && typeof globalThis.performance.now === 'function' ? () => globalThis.performance.now() : () => 0;
    const t0 = clock();
    try {
      const info = await this.client.models.retrieve(this.model, opts && opts.signal ? { signal: opts.signal } : undefined);
      return { ok: true, model: (info && info.id) || this.model, label: (info && info.display_name) || modelInfo(this.model).label, latencyMs: Math.round(clock() - t0) };
    } catch (err) {
      const d = describeError(err, this._ctx());
      return { ok: false, code: d.code, message: d.message, status: d.status, latencyMs: Math.round(clock() - t0) };
    }
  }
}

// ---------------------------------------------------------------- exports for game engines

const JSON_SAFE_DEPTH = 64;

/** One value made plain JSON (undefined means "leave it out"); `ancestors` holds the objects above it. */
function plain(v, ancestors, depth) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'bigint') return String(v);
  if (typeof v !== 'object') return undefined; // functions, symbols, undefined
  if (ancestors.has(v) || depth > JSON_SAFE_DEPTH) return undefined; // a cycle (or absurd nesting) is cut here
  if (typeof v.toJSON === 'function') {
    let j;
    try { j = v.toJSON(); } catch { return undefined; }
    if (j !== v) {
      ancestors.add(v);
      try { return plain(j, ancestors, depth + 1); } finally { ancestors.delete(v); }
    }
  }
  if (ArrayBuffer.isView(v)) return Array.from(v, x => (typeof x === 'bigint' ? String(x) : x));
  ancestors.add(v);
  try {
    if (Array.isArray(v) || v instanceof Set) return Array.from(v, x => { const p = plain(x, ancestors, depth + 1); return p === undefined ? null : p; });
    const out = {};
    for (const [k, x] of v instanceof Map ? v : Object.entries(v)) {
      const p = plain(x, ancestors, depth + 1);
      if (p !== undefined) out[String(k)] = p;
    }
    return out;
  } finally {
    ancestors.delete(v);
  }
}

/**
 * A deep copy that is plain JSON, the way JSON.stringify would write it (bigints as strings, Maps as objects,
 * Sets and typed arrays as arrays), except that only a real cycle is cut: an object referenced from two places
 * (a road in both knowledge.roads and npc.commute.road) is copied in both.
 */
function jsonSafe(value) {
  const p = plain(value, new Set(), 0);
  return p === undefined ? null : p;
}

/**
 * Everything a game engine needs to voice an NPC with Claude: the persona, the system prompt (as one string and
 * as cached Messages API blocks), the request defaults and the voice profile. `defaults` holds only JSON body
 * fields of POST /v1/messages; `headers` holds the HTTP headers they need (the refusal-fallback beta, which the
 * official SDKs take as `betas` on client.beta.messages and send as the anthropic-beta header).
 * @param {object} persona
 * @param {object} [world]
 * @param {{model?: string, effort?: string, maxTokens?: number}} [options]
 */
export function exportPersona(persona, world = null, options = {}) {
  const p = isObj(persona) ? persona : {};
  const o = isObj(options) ? options : {};
  const npc = npcOf(p);
  const model = normalizeModel(o.model);
  const effort = EFFORTS.includes(o.effort) ? o.effort : DEFAULTS.effort;
  const maxTokens = Number.isInteger(o.maxTokens) && o.maxTokens > 0 ? o.maxTokens : DEFAULTS.maxTokens;
  const system = systemBlocks(p, world);
  const s = isObj(p.speech) ? p.speech : {};
  const langs = isObj(npc.languages) ? npc.languages : {};
  const fb = fallbackParams(model);
  return {
    format: 'legion.persona/1',
    promptVersion: PROMPT_VERSION,
    id: text(p.id) || text(npc.id) || null,
    name: displayName(p) || null,
    persona: jsonSafe(p),
    systemPrompt: system.map(b => b.text).join('\n\n'),
    system: jsonSafe(system),
    defaults: { model, max_tokens: maxTokens, output_config: { effort }, ...(fb.fallbacks ? { fallbacks: fb.fallbacks } : {}) },
    headers: fb.betas ? { 'anthropic-beta': fb.betas.join(',') } : {},
    voice: {
      dialect: text(s.dialect) || null,
      dialectName: text(s.dialectName) || own(DIALECT_NAMES, text(s.dialect)) || null,
      register: text(s.register) || null,
      verbosity: s.verbosity ?? null,
      humor: s.humor ?? null,
      directness: s.directness ?? null,
      slang: jsonSafe(s.slang ?? []),
      fillers: jsonSafe(list(s.fillers)),
      catchphrases: jsonSafe(list(s.catchphrases)),
      codeSwitch: isObj(s.codeSwitch) ? jsonSafe(s.codeSwitch) : null,
      languages: { home: text(langs.home) || null, english: text(langs.english) || null, list: list(langs.list).map(text).filter(Boolean) },
    },
    turnProtocol: 'POST /v1/messages with `defaults` as body fields, `system` as the system blocks and the HTTP headers in `headers`: the anthropic-beta header turns on server-side refusal fallback, which the `fallbacks` field needs (the official SDKs send it for you from `betas` on client.beta.messages). Send each player message as a user turn, followed by a {"role": "system"} message with the situation for that turn (time, activity, weather, mood, feelings, recalled memories). Keep the history append-only. Omit thinking (adaptive, always on), sampling parameters and assistant prefill.',
  };
}

/**
 * Many personas as JSON Lines (one exportPersona object per line, newline-terminated).
 * @param {Iterable<object>} personas
 * @param {object} [world]
 * @param {object} [options] as for exportPersona
 * @returns {string}
 */
export function exportJSONL(personas, world = null, options = {}) {
  let out = '';
  for (const p of personas || []) out += JSON.stringify(exportPersona(p, world, options)) + '\n';
  return out;
}
