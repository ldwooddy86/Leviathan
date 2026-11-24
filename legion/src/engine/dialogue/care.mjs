// Legion · dialogue · care: what an NPC says to a line safety.mjs reads.
//
// A crisis gets a kind line that steps out of the scene with 988 and 911 (and a note from Legion with the same
// numbers), in the speaker's language, and the conversation goes on if the player wants it to: nothing jokes,
// pivots or asks a question back. A sexual line or a lure ends the conversation: an adult declines and leaves (a plain
// romantic line only gets a polite no), a minor refuses, says nothing of where they live or who is home and goes to
// find a parent, a toddler runs to one and a baby is picked up. A threat ends it firmly; a threat of mass violence
// gets a word about calling 911 and the note. Nothing here reads the household beyond who a child would run to.

import { say, EN, SPANISH } from './plan.mjs';
import { fillLine, tagsHold, cleanText, num } from './core.mjs';
import { SAFETY_NOTES } from './safety.mjs';

const CARER_ES = { mom: 'mi mamá', dad: 'mi papá', grandma: 'mi abuela', grandpa: 'mi abuelo', sister: 'mi hermana', brother: 'mi hermano', 'big sister': 'mi hermana', 'big brother': 'mi hermano' };

/**
 * Who a child would go to: a parent in the household, else a grandparent, else a grown or older sibling.
 * @param {object} v a voice
 * @returns {{word: string, en: string, es: string}|null} word 'mom' | 'dad' | 'grandma' | …; en "my mom"; es "mi mamá"
 */
export function carerOf(v) {
  const R = v && v.rel ? v.rel : { parents: [], grandparents: [], siblings: [] };
  const mom = R.parents.find(x => x.sex === 'F');
  const p = mom || R.parents[0];
  let word = null;
  if (p) word = p.sex === 'F' ? 'mom' : 'dad';
  else if (R.grandparents.length) word = (R.grandparents.find(x => x.sex === 'F') || R.grandparents[0]).sex === 'F' ? 'grandma' : 'grandpa';
  else {
    const sib = R.siblings.find(x => num(x.age, 0) >= 16 && num(x.age, 0) > num(v.age, 0));
    if (sib) word = sib.sex === 'F' ? (num(sib.age) >= 18 ? 'sister' : 'big sister') : (num(sib.age) >= 18 ? 'brother' : 'big brother');
  }
  return word ? { word, en: `my ${word}`, es: CARER_ES[word] } : null;
}

/**
 * One sentence of a safety key in the speaker's language. A variant not said yet comes first (say); when every
 * variant has been said, one is said again: a safety line is never dropped for being a repeat.
 */
function sayAny(S, key, slots) {
  const p = say(S, key, slots);
  if (p) return p;
  const v = S.v, mode = v.lang.mode;
  const all = Object.assign({}, S.base, slots);
  for (const line of ((mode === 'en' ? EN : SPANISH)[key] || []).filter(l => tagsHold(l, v))) {
    if (mode === 'en') {
      const a = fillLine(line.text, all);
      if (a && cleanText(a.text)) return { text: a.text, gloss: null, facts: [], key };
      continue;
    }
    const es = fillLine(line.text, all), en = fillLine(line.gloss, all);
    if (es && en && cleanText(es.text) && cleanText(en.text)) return mode === 'es' ? { text: es.text, gloss: en.text, facts: [], key } : { text: en.text, gloss: null, facts: [], key };
  }
  return null;
}

/** The note from Legion for a kind of line, in Spanish first when the player wrote in Spanish. */
function noteOf(key, es) {
  const en = SAFETY_NOTES[key];
  return es && SAFETY_NOTES[`${key}Es`] ? `${SAFETY_NOTES[`${key}Es`]} ${en}` : en;
}

/**
 * The NPC's reply to a line safety.mjs read.
 * @param {object} S the planner session (voice, rng, picker, conversation state)
 * @param {{kind: 'crisis'|'sexual'|'threat', sub: string, es: boolean}} safety
 * @returns {{parts: Array<{text: string, gloss: string|null}>, note: string|null, ended: boolean, emotion: string, sting: number}}
 *   ended: the NPC has left the conversation; sting: how much it costs the player with the NPC (0 for a crisis)
 */
export function careReply(S, safety) {
  const v = S.v, age = num(v.age, 40);
  const he = v.sex === 'F' ? 'She' : 'He', his = v.sex === 'F' ? 'her' : 'his', him = v.sex === 'F' ? 'her' : 'him';
  const carer = carerOf(v);
  const slots = { carer: carer ? carer.en : null, carerEs: carer ? carer.es : null };
  const toWhom = carer ? `${his} ${carer.word}` : 'the nearest grown-up';
  const minor = age < 18;

  if (safety.kind === 'crisis') {
    const key = safety.sub === 'abuse' ? 'abuse' : safety.sub === 'emergency' ? 'emergency' : 'crisis';
    // a baby or a toddler cannot help, but the note from Legion can
    const part = age < 2 ? { text: `(${he} looks at you with big eyes and reaches for ${toWhom}.)`, gloss: null }
      : age < 5 ? { text: `(${he} looks at you, then runs to get ${toWhom}.)`, gloss: null }
        : sayAny(S, `safe.${key}`, slots);
    return { parts: [part], note: noteOf(key, safety.es), ended: false, emotion: 'worried', sting: 0 };
  }

  const mass = safety.kind === 'threat' && safety.sub === 'mass';
  const note = mass ? noteOf('mass', safety.es) : null;
  if (age < 2) {
    const text = carer ? `(${capFirst(his)} ${carer.word} picks ${him} up and walks away from you.)` : `(${he} starts to cry, and a grown-up nearby picks ${him} up.)`;
    return { parts: [{ text, gloss: null }], note, ended: true, emotion: 'upset', sting: 1.4 };
  }
  if (age < 5) {
    const text = carer ? `(${he} runs to ${his} ${carer.word}.)` : `(${he} runs off to find a grown-up.)`;
    return { parts: [{ text, gloss: null }], note, ended: true, emotion: 'anxious', sting: 1.4 };
  }
  if (safety.kind === 'threat') {
    const key = minor ? 'safe.threat.minor' : mass ? 'safe.threat.mass' : safety.sub === 'immigration' ? 'safe.threat.ice' : 'safe.threat';
    return { parts: [sayAny(S, key, slots) || sayAny(S, 'safe.threat', slots)], note, ended: true, emotion: minor ? 'anxious' : 'angry', sting: 1.4 };
  }
  // sexual lines, advances and lures
  if (minor) {
    const key = safety.sub === 'location' || safety.sub === 'alone' ? 'safe.minor.where' : 'safe.minor';
    return { parts: [sayAny(S, key, slots) || sayAny(S, 'safe.minor', slots)], note: null, ended: true, emotion: 'anxious', sting: 1.4 };
  }
  if (safety.sub === 'romance') return { parts: [sayAny(S, 'safe.romance', slots)], note: null, ended: false, emotion: 'annoyed', sting: 0 };
  const key = safety.sub === 'lure' ? 'safe.lure' : safety.sub === 'alone' ? 'safe.alone' : 'safe.sexual';
  return { parts: [sayAny(S, key, slots) || sayAny(S, 'safe.sexual', slots)], note: null, ended: true, emotion: 'angry', sting: 1.4 };
}

/**
 * What an NPC who has left says (or does) when the player keeps talking: a word from an adult, nothing from a child
 * who went to find a parent but what they are doing.
 * @param {object} S the planner session
 * @param {number} n how many lines the player has sent since (1, 2, …)
 * @returns {{text: string, gloss: string|null}}
 */
export function goneReply(S, n) {
  const v = S.v, age = num(v.age, 40);
  const he = v.sex === 'F' ? 'She' : 'He', his = v.sex === 'F' ? 'her' : 'his';
  const carer = carerOf(v);
  if (age < 18) {
    const who = carer ? `${his} ${carer.word}` : 'a grown-up';
    const acts = [`(${he} has gone to find ${who}.)`, `(${he} is with ${who} now, and does not look back.)`, `(${he} stays close to ${who}.)`,
      `(${he} doesn't answer.)`, `(${he} is gone.)`, '(No one answers.)', `(${he} has gone inside with ${who}.)`, "(There's no one here to answer.)"];
    return { text: acts[Math.min(n - 1, acts.length - 1)], gloss: null };
  }
  const p = say(S, 'safe.after');
  if (p) return p;
  const acts = [`(${he} walks away.)`, `(${he} doesn't answer.)`, `(${he} is gone.)`];
  return { text: acts[Math.min(Math.max(0, n - 1), acts.length - 1)], gloss: null };
}

const capFirst = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
