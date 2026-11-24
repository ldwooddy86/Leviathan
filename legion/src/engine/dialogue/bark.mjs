// Legion · dialogue · barks: the short lines in speech bubbles on the street.
//
// bark(world, persona, context) is one line for a passing moment: neighbors greeting each other in their
// register (and, when both speak the same home language, sometimes in it), a remark about the weather or an
// active alert, a grumble at a light or about traffic, a word on the way to work or coming home. barkBetween
// makes the two lines of an exchange agree: a greeting gets a greeting back, a question an answer, a remark on
// the heat a nod, and a line in Spanish a reply in Spanish.
//
// Deterministic: the line depends on the two people, the minute and the situation. A voice is built once per
// persona and ten-minute window (barks are frequent; the street view asks every quarter second).

import { Rng, hashAll } from '../rng.mjs';
import { Picker, phrasesFor, LANGUAGES } from '../lexicon.mjs';
import { compileBank, isNum, cleanGloss, cleanText, terminate, tidy, fillLine, tagsHold, fitsLife } from './core.mjs';
import { makeVoice } from './voice.mjs';
import { lex, baseSlots } from './plan.mjs';
import * as G from './ground.mjs';

/** The bark bank: English lines, and Spanish lines with their English. */
export const BARK_EN = compileBank({
  'bark.pass': `
    Hey there.
    Hi!
    How's it going?
    Hey, how are you?
    Hey, neighbor.
    Hi, how are you doing?
    @morning Morning!
    @morning @plain Good morning.
    @afternoon Afternoon!
    @afternoon @plain Good afternoon.
    @evening Evening!
    @evening @plain Good evening.
    @senior Hello there!
    @loose Hey!
    @teen Hey.
    @kid Hi!
    @outgoing Hey! Good to see you.
  `,
  'bark.passQ': `
    How's your day going?
    You doing okay?
    How's everything?
    How are things?
  `,
  'bark.weather': `
    {temp} degrees. Can you believe it?
    Some weather, huh?
    @hot Hot enough for you?
    @hot It's {temp} out. Stay cool.
    @cold Chilly one today.
    @mild Nice out today, huh?
    Beautiful day.
  `,
  'bark.alert': `
    Did you hear about the {alert}?
    Stay safe with this {alert}.
    Heads up, there's a {alert} out.
    You see they put out a {alert}?
  `,
  'bark.wait': `
    Come on, light.
    This light takes forever.
    Any minute now.
    @transit Where's the bus?
    @kid Are we there yet?
    @adult Always waiting on something.
  `,
  'bark.traffic': `
    Traffic again.
    {road} must be backed up again.
    Everybody's in a hurry today.
  `,
  'bark.work': `
    Long day.
    Back to work.
    Almost done for the day.
    @nights Another night shift.
    @early Too early for this.
    @outdoor @hot Hot one to be working in.
    @afternoon Almost quitting time.
  `,
  'bark.home': `
    Home sweet home.
    Finally home.
    @house The yard needs some work.
    @kids Dinner time!
    @kid I'm home!
  `,
  'bark.replyGreet': `
    Hey!
    Hi there.
    Hey, good to see you.
    Hi! How are you?
    @morning Morning!
    @afternoon Afternoon!
    @evening Evening!
    @senior Well, hello!
    @kid Hi!
    @teen Hey.
  `,
  'bark.replyHow': `
    Good, you?
    Can't complain!
    Hanging in there.
    Not bad, not bad.
    Doing good, thanks.
    @kid Good!
    @tired Tired, but okay.
  `,
  'bark.replyWeather': `
    Tell me about it.
    I know, right?
    Sure is.
    You said it.
    @hot Way too hot.
  `,
  'bark.replyAlert': `
    Yeah, I saw. Stay safe.
    I heard. Crazy.
    Yeah, keeping an eye on it.
  `,
  'bark.replyGrumble': `
    Ha, tell me about it.
    Every single time.
    Right?
  `,
}, { name: 'bark' });

/** Spanish barks for speakers with limited English. */
export const BARK_ES = compileBank({
  'bark.pass': `
    ¡Hola! || Hi!
    ¡Buenas! || Hi there!
    ¿Qué tal? || How's it going?
    @morning ¡Buenos días! || Good morning!
    @afternoon Buenas tardes. || Good afternoon.
    @evening Buenas noches. || Good evening.
  `,
  'bark.passQ': `
    @usted ¿Cómo está? || How are you?
    @tu ¿Cómo estás? || How are you?
    ¿Cómo le va? || How's it going?
  `,
  'bark.weather': `
    Estamos a {temp} grados. || It's {temp} degrees.
    @hot ¡Qué calor! || So hot!
    @cold ¡Qué frío! || So cold!
    @mild Qué bonito día. || What a nice day.
  `,
  'bark.alert': `
    ¿Ya supo de la alerta del clima? || Did you hear about the weather alert?
    Cuídese, hay alerta del clima. || Take care, there's a weather alert.
  `,
  'bark.wait': `
    Este semáforo tarda mucho. || This light takes forever.
    @transit ¿Dónde está el autobús? || Where's the bus?
  `,
  'bark.traffic': `
    ¡Qué tráfico! || What traffic!
  `,
  'bark.work': `
    A trabajar. || Off to work.
    Fue un día largo. || It was a long day.
  `,
  'bark.home': `
    Por fin en casa. || Finally home.
  `,
  'bark.replyGreet': `
    ¡Hola! || Hi!
    ¡Buenas! || Hi there!
    @morning ¡Buenos días! || Good morning!
    @afternoon Buenas tardes. || Good afternoon.
    @evening Buenas noches. || Good evening.
  `,
  'bark.replyHow': `
    Bien, gracias. ¿Y usted? || Good, thanks. And you?
    Aquí, trabajando. || Here, working.
    Todo bien. || All good.
  `,
  'bark.replyWeather': `
    Sí, ¿verdad? || Yes, right?
    Así es. || That's right.
  `,
  'bark.replyAlert': `
    Sí, ya supe. Cuídese. || Yes, I heard. Take care.
  `,
  'bark.replyGrumble': `
    Siempre es lo mismo. || It's always the same.
  `,
}, { bilingual: true, name: 'bark-es' });

/** The situations a bark can be for. */
export const BARK_SITUATIONS = Object.freeze(['pass', 'wait', 'weather', 'alert', 'traffic', 'work', 'home']);

const voices = new WeakMap();
const WINDOW = 10 * 60000;

function voiceFor(world, persona, t) {
  const key = Math.floor(t / WINDOW);
  let byWorld = voices.get(persona);
  if (!byWorld) voices.set(persona, byWorld = new WeakMap());
  const hit = byWorld.get(world);
  if (hit && hit.key === key) return hit.v;
  const v = makeVoice(world, persona, { t });
  byWorld.set(world, { key, v });
  return v;
}

function timeOf(world, persona, context) {
  if (context && isNum(context.t)) return context.t;
  if (persona && isNum(persona.t)) return persona.t;
  return world.snapshotTime;
}

/** The language two speakers share at home (a LANGUAGES key), or null. */
export function sharedLanguage(va, vb) {
  const la = va.lang.known || (va.lang.cs && va.lang.cs.lang), lb = vb.lang.known || (vb.lang.cs && vb.lang.cs.lang);
  return la && lb && la === lb && LANGUAGES[la] ? la : null;
}

function session(v, rng) {
  return { v, rng, picker: new Picker(rng.next()), st: { said: new Set(), used: new Set(), usedMemories: new Set(), usedInterests: new Set(), hooksUsed: new Set(), asked: new Set() }, base: baseSlots(v) };
}

// Barks have their own small banks, read the way say() reads the conversation banks.
function sayBark(S, key, slots = {}, facts = []) {
  const list = (S.v.lang.mode === 'en' ? BARK_EN : BARK_ES)[key];
  return list ? sayFrom(S, list, key, slots, facts) : null;
}

function sayFrom(S, list, key, slots, facts) {
  const v = S.v;
  const all = Object.assign({}, S.base, slots);
  const usable = S.rng.shuffle(list.filter(l => tagsHold(l, v)));
  for (const line of usable) {
    if (v.lang.mode === 'en') {
      const a = fillLine(line.text, all);
      if (a && cleanText(a.text) && fitsLife(a.text, v, { familiar: true })) return { text: a.text, gloss: null, facts, key };
    } else {
      const es = fillLine(line.text, all), en = fillLine(line.gloss, all);
      if (es && en && cleanText(es.text) && cleanText(en.text)) return v.lang.mode === 'es' ? { text: es.text, gloss: en.text, facts, key } : { text: en.text, gloss: null, facts, key };
    }
  }
  return null;
}

function phrase(v, lang, intent, rng) {
  const list = (phrasesFor(lang, intent, { sex: v.sex, t: v.t, variety: v.lang.known === lang ? v.lang.variety : undefined, faith: v.lang.faith }) || [])
    .filter(e => !e.to && !/\((to a (man|woman|boy|girl)|to someone|said when)/i.test(e.gloss));
  const e = rng.pick(list);
  return e ? { text: e.text, gloss: cleanGloss(e.gloss) } : null;
}

/**
 * One bark with what kind of line it is and the language used (internal shape of bark()).
 * @returns {{text: string, gloss: string|null, kind: string, lang: string|null, question: boolean}|null}
 */
function barkLine(world, persona, context = {}) {
  if (!world || !persona || !persona.npc) return null;
  const t = timeOf(world, persona, context);
  let v;
  try { v = voiceFor(world, persona, t); } catch { return null; }
  if (v.age < 3) return null;
  const other = context.other && context.other.npc ? context.other : null;
  const situation = BARK_SITUATIONS.includes(context.situation) ? context.situation : (other ? 'pass' : 'wait');
  const rng = new Rng(hashAll('bark', persona.id || '', other ? other.id || '' : '', Math.floor(t / 60000), situation, context.salt || 0));
  const S = session(v, rng);
  const W = G.weatherFacts(v);
  const slots = { temp: W.temp, alert: W.alerts[0] ? W.alerts[0].event : null };
  const done = (p, kind, lang = null) => (p && p.text ? { text: tidy(terminate(p.text)), gloss: p.gloss ? tidy(terminate(p.gloss)) : null, kind, lang, question: /\?$/.test(p.text.trim()) } : null);

  // neighbors who share a home language sometimes greet in it
  if (situation === 'pass' && other) {
    let vo = null;
    try { vo = voiceFor(world, other, t); } catch { vo = null; }
    const shared = vo ? sharedLanguage(v, vo) : null;
    if (shared && v.age >= 5) {
      const both = v.lang.mode !== 'en' || (vo && vo.lang.mode !== 'en');
      const p = both || rng.chance(0.5 + (v.lang.cs ? v.lang.cs.rate : 0)) ? phrase(v, shared, rng.chance(0.7) ? 'greeting' : 'how_are_you', rng) : null;
      if (p) return done(p, 'greet', shared);
    }
  }
  // an alert or the weather, when there is something to say
  const alertFirst = situation === 'alert' || (W.alerts.length && rng.chance(0.25));
  if (alertFirst && W.alerts.length && v.age >= 10) {
    const p = (v.lang.mode === 'en' && rng.chance(0.4) ? lex(S, 'weather') : null) || sayBark(S, 'bark.alert', slots, [W.alerts[0].id]);
    if (p) return done(p, 'alert');
  }
  const weatherish = situation === 'weather' || (situation !== 'work' && situation !== 'home' && (W.cond === 'heat' || W.cond === 'rain' || W.cond === 'cold' || W.cond === 'fog' || W.cond === 'smoke') && rng.chance(0.3));
  if (weatherish) {
    if (v.lang.mode === 'en' && v.age >= 13 && rng.chance(0.6)) { const p = lex(S, 'weather'); if (p) return done(p, 'weather'); }
    if (v.lang.mode === 'simple' || (v.lang.cs && rng.chance(v.lang.cs.rate))) {
      const lang = v.lang.known || v.lang.cs.lang;
      const intent = W.cond === 'heat' ? 'weather_hot' : W.cond === 'cold' ? 'weather_cold' : W.cond === 'rain' ? 'weather_rain' : null;
      const p = intent && lang ? phrase(v, lang, intent, rng) : null;
      if (p) return done(p, 'weather', lang);
    }
    const p = sayBark(S, 'bark.weather', slots, ['weather.now']);
    if (p) return done(p, 'weather');
  }
  if (situation === 'traffic' && v.age >= 16) {
    const r = G.roadFacts(v)[0];
    const p = (v.lang.mode === 'en' && rng.chance(0.6) ? lex(S, 'traffic', r ? { road: r.name } : {}, r ? { road: r.id } : {}) : null) || sayBark(S, 'bark.traffic', { road: r ? r.name : null });
    if (p) return done(p, 'grumble');
  }
  if (situation === 'wait') { const p = sayBark(S, 'bark.wait'); if (p) return done(p, 'grumble'); }
  if (situation === 'work' && v.speaker.works) { const p = sayBark(S, 'bark.work', slots); if (p) return done(p, 'grumble'); }
  if (situation === 'home') { const p = sayBark(S, 'bark.home'); if (p) return done(p, 'home'); }
  // a plain greeting, the dialect's or the bank's, sometimes with a question
  let p = null;
  if (v.lang.mode === 'en' && v.age >= 13 && rng.chance(0.35)) {
    p = lex(S, 'greetings');
    if (p && !fitsLife(p.text, v, { familiar: true })) p = null;
  }
  if (!p) p = rng.chance(0.3) ? sayBark(S, 'bark.passQ') : sayBark(S, 'bark.pass');
  if (!p) return null;
  if (v.lang.mode === 'en' && v.lang.cs && rng.chance(v.lang.cs.rate * 0.5)) {
    const ph = phrase(v, v.lang.cs.lang, 'greeting', rng);
    if (ph) return done({ text: ph.text, gloss: ph.gloss }, 'greet', v.lang.cs.lang);
  }
  return done(p, 'greet');
}

/**
 * A short line for a speech bubble, or null (babies don't bark, and a moment can pass in silence).
 * @param {import('../world.mjs').World} world
 * @param {object} persona the speaker's persona
 * @param {{t?: number, other?: object, situation?: 'pass'|'wait'|'weather'|'alert'|'traffic'|'work'|'home'}} [context]
 *   t: epoch ms (default the persona's time, then the NWS snapshot); other: the other person's persona
 * @returns {{text: string, gloss: string|null}|null}
 */
export function bark(world, persona, context = {}) {
  const b = barkLine(world, persona, context || {});
  return b ? { text: b.text, gloss: b.gloss } : null;
}

function replyTo(world, persona, opener, context) {
  const t = timeOf(world, persona, context);
  let v;
  try { v = voiceFor(world, persona, t); } catch { return null; }
  if (v.age < 3) return null;
  const rng = new Rng(hashAll('reply', persona.id || '', opener ? opener.text : '', Math.floor(t / 60000)));
  const S = session(v, rng);
  const W = G.weatherFacts(v);
  if (opener && opener.lang && (v.lang.known === opener.lang || (v.lang.cs && v.lang.cs.lang === opener.lang))) {
    const p = phrase(v, opener.lang, opener.question ? 'how_are_you' : 'greeting', rng) || phrase(v, opener.lang, 'greeting', rng);
    if (p) return { text: tidy(terminate(p.text)), gloss: p.gloss ? tidy(terminate(p.gloss)) : null };
  }
  let key = 'bark.replyGreet';
  if (opener) {
    if (opener.kind === 'alert') key = 'bark.replyAlert';
    else if (opener.kind === 'weather') key = 'bark.replyWeather';
    else if (opener.kind === 'grumble') key = 'bark.replyGrumble';
    else if (opener.question) key = 'bark.replyHow';
  }
  let p = null;
  if (key === 'bark.replyWeather' && v.lang.mode === 'en' && rng.chance(0.4)) p = lex(S, 'agreement');
  if (!p) p = sayBark(S, key, { temp: W.temp });
  if (!p) p = sayBark(S, 'bark.replyGreet', {});
  return p ? { text: tidy(terminate(p.text)), gloss: p.gloss ? tidy(terminate(p.gloss)) : null } : null;
}

/**
 * Two people passing: [lineA, lineB], A's opener and B's reply to it (either can be null: a baby says nothing).
 * @param {import('../world.mjs').World} world
 * @param {object} personaA
 * @param {object} personaB
 * @param {{t?: number, situation?: string}} [context]
 * @returns {[{text: string, gloss: string|null}|null, {text: string, gloss: string|null}|null]}
 */
export function barkBetween(world, personaA, personaB, context = {}) {
  const ctx = Object.assign({}, context || {});
  const a = barkLine(world, personaA, Object.assign({}, ctx, { other: personaB, situation: ctx.situation || 'pass' }));
  if (!a) {
    const b = barkLine(world, personaB, Object.assign({}, ctx, { other: personaA, situation: ctx.situation || 'pass' }));
    return [null, b ? { text: b.text, gloss: b.gloss } : null];
  }
  const b = replyTo(world, personaB, a, ctx);
  return [{ text: a.text, gloss: a.gloss }, b];
}

