/* Passive voice. A form of "to be" (or "get") followed by a past participle, with adverbs allowed between them:
   "the coil is cleaned", "was quickly and quietly replaced", "is no longer produced", "got damaged".

   A participle that only describes a state passes, because nobody is hiding in it:
     how someone is       "we are licensed and insured", "you are tired of the heat", "our techs are skilled"
     the shape a thing    "the coil is frozen", "the breaker is tripped", "the unit is covered in ice"; present tense
     is in right now      only, since "the duct was torn out" tells of something done to it
   Either turns passive when a "by" phrase names the actor ("certified by NATE", "frozen by low airflow"). */
import { sentences } from './readability.mjs';

const BE = "(?:am|is|are|was|were|be|been|being|isn't|aren't|wasn't|weren't|[a-z]+'re|i'm|it's|that's|what's|he's|she's|there's|who's)";
const GET = '(?:get|gets|got|gotten|getting)';
const ADV = "(?:no\\s+longer|not|never|always|often|also|just|still|already|usually|typically|sometimes|rarely|only|even|ever|soon|now|then|both|all|each|well|fully|properly|yet|best|better|once|first|later|again|n't|[a-z]+ly)";
const IRREG = ['made', 'done', 'built', 'sent', 'found', 'known', 'given', 'taken', 'seen', 'shown', 'sold', 'told', 'kept', 'held', 'put', 'set', 'cut', 'hit', 'run', 'paid', 'bought', 'brought', 'caught', 'taught', 'thought', 'written', 'driven', 'broken', 'chosen', 'frozen', 'stolen', 'spoken', 'worn', 'torn', 'drawn', 'grown', 'thrown', 'blown', 'flown', 'hidden', 'bitten', 'eaten', 'forgotten', 'laid', 'led', 'lost', 'meant', 'met', 'read', 'said', 'shut', 'spent', 'struck', 'swept', 'understood', 'won', 'wound', 'hung', 'dug', 'fed', 'fought', 'bent', 'bound', 'dealt', 'lit', 'shot', 'sewn', 'sunk', 'split', 'spread', 'sought', 'shaken', 'hurt', 'cast', 'overseen', 'undertaken', 'rebuilt', 'rewritten', 'undone', 'withheld', 'withdrawn', 'begun', 'heard', 'felt', 'left', 'sworn', 'beaten', 'born', 'borne', 'woven', 'ground', 'bred', 'slid', 'swung', 'stuck', 'strung', 'stung', 'wrung', 'mistaken', 'overtaken', 'overdone', 'outdone', 'foreseen', 'proven', 'mown', 'sawn', 'shorn', 'sped', 'spun', 'spilt', 'burnt', 'learnt', 'dreamt', 'leapt', 'knelt', 'dwelt', 'smelt', 'spelt'];
/* -ed words that are not participles at all */
const NOT_VERB = new Set(['need', 'feed', 'speed', 'seed', 'weed', 'indeed', 'bed', 'red', 'shed', 'hundred', 'sacred', 'naked', 'wicked', 'rugged', 'beloved', 'proceed', 'succeed', 'exceed', 'breed', 'bleed', 'greed', 'deed', 'reed', 'freed', 'agreed', 'embed', 'biped', 'moped']);
/* how someone is: a feeling, a credential, a quality. A state in any tense. */
const PERSON = new Set(['tired', 'interested', 'excited', 'pleased', 'concerned', 'worried', 'surprised', 'scared', 'bored', 'confused', 'married', 'retired', 'involved', 'committed', 'dedicated', 'experienced', 'qualified', 'licensed', 'insured', 'bonded', 'certified', 'located', 'based', 'done', 'gone', 'finished', 'prepared', 'satisfied', 'convinced', 'determined', 'inclined', 'accustomed', 'advanced', 'detailed', 'limited', 'related', 'complicated', 'crowded', 'born', 'ashamed', 'thrilled', 'delighted', 'relieved', 'stressed', 'overwhelmed', 'exhausted', 'owned', 'operated', 'skilled', 'equipped', 'talented', 'gifted', 'devoted']);
/* the shape a thing is in. A state in the present tense; in the past it is something that was done to the thing. */
const CONDITION = new Set(['stuck', 'lost', 'hurt', 'shut', 'closed', 'broken', 'frozen', 'worn', 'torn', 'clogged', 'cracked', 'damaged', 'blocked', 'corroded', 'rusted', 'bent', 'flooded', 'oversized', 'undersized', 'outdated', 'covered', 'coated', 'iced', 'set', 'tripped', 'seized', 'undercharged', 'overcharged', 'plugged', 'burned', 'burnt', 'sealed', 'pitted', 'sized', 'rated', 'soaked', 'stained', 'warped', 'kinked', 'crushed', 'stripped', 'jammed', 'overloaded', 'overheated', 'wired', 'grounded', 'insulated', 'vented', 'matched', 'dated', 'aged', 'packed', 'filled', 'loaded', 'exposed', 'buried', 'hidden', 'attached', 'connected', 'mounted']);
const PRESENT = /^(am|is|are|be|isn't|aren't|[a-z]+'re|i'm|it's|that's|what's|he's|she's|there's|who's)$/;
/* verbs whose -ed form after "is" or "has" is active ("it's happened") */
const INTRANS = new Set(['happened', 'arrived', 'failed', 'stopped', 'started', 'changed', 'passed', 'died', 'ended', 'worked', 'lasted', 'appeared', 'remained', 'existed', 'occurred', 'emerged', 'vanished', 'disappeared', 'returned', 'moved', 'improved', 'dropped', 'increased', 'decreased', 'grown', 'fallen', 'risen', 'become', 'come', 'gone', 'begun', 'run']);

/* a "by" phrase that names the actor ("by a raccoon"), not a time or a means ("by noon", "by phone") */
const AGENT = /^\s+(?:\w+\s+){0,3}?by\s+(?!(?:now|then|far|hand|phone|email|mail|text|law|itself|yourself|default|design|choice|chance|mistake|accident|appointment|noon|midnight|morning|evening|tonight|today|tomorrow|the end|the time|next|this|mid|early|late|spring|summer|fall|winter|(?:mon|tues|wednes|thurs|fri|satur|sun)day|january|february|march|april|may|june|july|august|september|october|november|december)\b|\d)/i;
const PART = '([a-z]+ed|' + IRREG.join('|') + ')';
const RE = new RegExp('\\b(' + BE + '|' + GET + ')((?:\\s+(?:' + ADV + '|and)){0,4})\\s+' + PART + '\\b', 'gi');

/* the passive constructions in a text: [{sentence, phrase, verb, agent}] */
export function passives(text) {
  const out = [];
  for (const sentence of sentences(text)) {
    RE.lastIndex = 0; let m;
    while ((m = RE.exec(sentence))) {
      const aux = m[1].toLowerCase(), verb = m[3].toLowerCase(), rest = sentence.slice(m.index + m[0].length);
      if (NOT_VERB.has(verb)) continue;
      if (/^(used|supposed)$/.test(verb) && /^\s+to\b/i.test(rest)) continue;                 /* "is used to the heat" */
      const agent = AGENT.test(rest), got = /^(get|gets|got|gotten|getting)$/.test(aux);
      if (!agent && !got) {
        if (PERSON.has(verb)) continue;
        if (/^un[a-z]{3,}ed$/.test(verb) && !/^(unplugged|unlocked|uninstalled|unloaded|unscrewed|uncovered|unpacked)$/.test(verb)) continue;   /* "is unrelated", "is unexpected" */
        if (CONDITION.has(verb) && PRESENT.test(aux)) continue;
      }
      if (/^(it's|that's|what's|he's|she's|there's|who's)$/.test(aux) && INTRANS.has(verb)) continue;    /* "it's stopped" is "it has stopped" */
      if (got && /^(started|done|used|married|dressed|rid|lost|stuck|going|ahead|ready)$/.test(verb)) continue;
      out.push({ sentence, phrase: m[0], verb, agent });
    }
  }
  return out;
}
