// Legion · dialogue · voice: who is talking, where, when, and how.
//
// A voice is everything the templates' tags and the planners read about the speaker, computed once per
// conversation (or per bark) from the persona, the NPC record and the world at time t: the life stage, the
// register and manner, the life facts lines may presuppose (a car, a lease, kids at home), the household as the
// speaker sees it, the dialect and its world-grounded slots, the weather and alerts, what they are doing right
// now, and the language they will answer in. The mood and the relationship are refreshed every turn from the
// mind (refreshVoice).
//
// Language mode: 'en' for English speakers (with code-switching at the persona's rate when they have another home
// language), 'es' for Spanish speakers with limited English (they answer in Spanish, with an English gloss), and
// 'simple' for speakers of another language with limited English (short, plain English, opening with a phrase
// in their own language where one fits).

import {
  dialectFor, DIALECTS, slotsFor, speakerFacts, weatherCondition, offshoreWind,
  resolveLanguage, varietyFor, faithFor, LANGUAGES, COAST_KM,
} from '../lexicon.mjs';
import { activityAt } from '../schedule.mjs';
import { pacific } from '../clock.mjs';
import { isNum, num, str } from './core.mjs';

/** Life stages by age: 'baby' (0-1), 'toddler' (2-4), 'kid' (5-12), 'teen' (13-17), 'adult' (18-64), 'senior' (65+). */
export function stageOf(age) {
  if (!isNum(age)) return 'adult';
  if (age < 2) return 'baby';
  if (age < 5) return 'toddler';
  if (age < 13) return 'kid';
  if (age < 18) return 'teen';
  if (age < 65) return 'adult';
  return 'senior';
}

/**
 * The household as this member sees it (the same reading persona.mjs uses): partner, kids, grandkids, parents,
 * grandparents, siblings, roommates and other relatives, each {m, role, name, age, sex}.
 * @param {object} npc
 * @returns {{partner: object|null, kids: object[], grandkids: object[], parents: object[], grandparents: object[], siblings: object[], roommates: object[], relatives: object[]}}
 */
export function relationsOf(npc) {
  const members = npc && npc.household && Array.isArray(npc.household.members) ? npc.household.members : [];
  const me = Number.isInteger(npc && npc.m) ? npc.m : -1;
  const others = members.filter(x => x && x.m !== me).map(x => ({
    m: x.m, role: x.role, name: str(x.first) || (str(x.name) ? String(x.name).split(' ')[0] : null), full: str(x.name),
    age: isNum(x.age) ? x.age : null, sex: x.sex === 'F' || x.sex === 'M' ? x.sex : null,
  }));
  const by = (...roles) => others.filter(x => roles.includes(x.role));
  const out = { partner: null, kids: [], grandkids: [], parents: [], grandparents: [], siblings: [], roommates: [], relatives: [] };
  const role = (npc && npc.role) || 'householder';
  if (role === 'householder') {
    out.partner = by('spouse')[0] || by('partner')[0] || null;
    out.kids = by('child'); out.grandkids = by('grandchild'); out.parents = by('parent');
    out.siblings = by('sibling'); out.roommates = by('roommate'); out.relatives = by('relative');
  } else if (role === 'spouse' || role === 'partner') {
    out.partner = by('householder')[0] || null;
    out.kids = by('child'); out.grandkids = by('grandchild'); out.roommates = by('roommate');
    out.relatives = by('parent', 'sibling', 'relative');
  } else if (role === 'child') {
    out.parents = by('householder', 'spouse', 'partner'); out.siblings = by('child'); out.grandparents = by('parent');
    out.relatives = by('grandchild', 'sibling', 'relative');
  } else if (role === 'grandchild') {
    out.grandparents = by('householder', 'spouse', 'partner'); out.siblings = by('grandchild');
    out.relatives = by('child', 'parent', 'sibling', 'relative');
  } else if (role === 'parent') {
    out.kids = by('householder', 'sibling'); out.grandkids = by('child'); out.partner = by('parent')[0] || null;
    out.relatives = by('spouse', 'partner', 'grandchild', 'relative');
  } else if (role === 'sibling') {
    out.siblings = by('householder', 'sibling'); out.parents = by('parent');
    out.relatives = by('spouse', 'partner', 'child', 'grandchild', 'relative');
  } else if (role === 'roommate') {
    out.roommates = others;
  } else {
    out.relatives = others;
  }
  const myAge = isNum(npc && npc.age) ? npc.age : 40;
  out.kids = out.kids.filter(k => isNum(k.age) && k.age <= myAge - 15);
  return out;
}

// Coastal alerts cover whole counties but only touch the shore (persona.mjs relevantAlerts, 8 km).
const COASTAL_EVENT = /coastal|surf|rip current|beach|tsunami|sneaker wave|lakeshore/i;

/** Alerts that matter where this person lives. */
export function relevantAlerts(alerts, coastKm) {
  return (Array.isArray(alerts) ? alerts : []).filter(a => a && a.event && (!COASTAL_EVENT.test(a.event) || num(coastKm, 0) <= 8));
}

/** The sky condition from the forecast alone (an alert for river flooding does not make a sunny day rainy). */
export function skyCondition(wx) {
  if (!wx || !wx.now) return null;
  return weatherCondition({ now: wx.now, alerts: [] });
}

/** "the Clippers", "LAFC", "UCLA": a team name as it goes in a sentence. */
export function teamLabel(name) {
  const n = str(name);
  if (!n) return null;
  if (/^the /i.test(n)) return n;
  if (/^(LAFC|UCLA|USC|San Diego FC|San Diego State|Fresno State|Cal|Stanford|Sacramento State|UC Davis)$/.test(n)) return n;
  return `the ${n}`;
}

const HOME_WORD = { house: 'house', 'small-apartment': 'apartment', apartment: 'apartment', 'mobile-home': 'mobile home' };

/** "at the district attorney's office", "on a farm": the employer with its preposition, first person. */
export function employerPhrase(employer) {
  let e = str(employer);
  if (!e || /^a local employer$/i.test(e)) return null;
  e = e.replace(/\s+/g, ' ').replace(/^their own\b/i, 'my own').replace(/^their family\b/i, "my family's").replace(/^their\b/i, 'my');
  return `${/\b(farm|ranch|orchard|vineyard|boat|crew|dairy|field)s?\b/i.test(e) ? 'on' : 'at'} ${e}`;
}

/**
 * Build the voice for one persona at time t. Throws when the persona has no NPC record or ZIP in this world.
 * @param {import('../world.mjs').World} world
 * @param {object} persona persona(world, npc, …)
 * @param {{t?: number}} [opts]
 * @returns {object} the voice (see the module comment)
 */
export function makeVoice(world, persona, opts = {}) {
  if (!world || !persona || !persona.npc) throw new Error('dialogue: a world and a persona with its NPC record are required');
  const npc = persona.npc;
  let zi = Number.isInteger(npc.zi) && npc.zi >= 0 && npc.zi < world.N && world.zips[npc.zi] === npc.zip ? npc.zi : world.indexOf(npc.zip || (npc.place && npc.place.zip));
  if (zi < 0 && persona.knowledge && persona.knowledge.zip) zi = world.indexOf(persona.knowledge.zip);
  if (zi < 0) throw new Error(`dialogue: ${persona.id} has no ZIP in this world`);
  const z = world.zip(zi);
  const t = isNum(opts.t) ? opts.t : isNum(persona.t) ? persona.t : world.snapshotTime;
  const P = pacific(t);
  const speech = persona.speech || {};
  const key = DIALECTS[speech.dialect] ? speech.dialect : dialectFor(world, zi);
  const D = DIALECTS[key];
  const age = isNum(npc.age) ? npc.age : 40;
  const stage = stageOf(age);
  const hh = npc.household && typeof npc.household === 'object' ? npc.household : {};
  const home = hh.home && isNum(hh.home.x) ? { x: hh.home.x, y: hh.home.y } : (persona.routine && persona.routine.home) || { x: z.tx, y: z.ty };
  const rel = relationsOf(npc);
  const res = persona.residence || {};
  const occ = npc.occupation && typeof npc.occupation === 'object' ? npc.occupation : null;
  const commute = npc.commute && typeof npc.commute === 'object' ? npc.commute : {};
  const routine = persona.routine || {};
  const big5 = Object.assign({ O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 }, persona.big5 || {});
  const density = num(z.density, 0);
  const coastKm = isNum(z.coast_km) ? z.coast_km : 999;
  const speaker = speakerFacts(npc, persona);
  if (speaker.age === undefined) speaker.age = age;

  // language mode
  const langs = npc.languages || {};
  const homeLang = str(langs.home) || 'english';
  const resolved = homeLang === 'english' ? null : resolveLanguage(homeLang, npc.seed >>> 0);
  const known = resolved && LANGUAGES[resolved] ? resolved : null;
  const limited = langs.english === 'limited' && homeLang !== 'english';
  const mode = limited && known === 'spanish' ? 'es' : limited ? 'simple' : 'en';
  const csRaw = speech.codeSwitch && typeof speech.codeSwitch === 'object' ? speech.codeSwitch : null;
  const csLang = csRaw ? (resolveLanguage(csRaw.lang, npc.seed >>> 0) || null) : null;
  const cs = csLang && LANGUAGES[csLang] && age >= 3 ? { lang: csLang, rate: Math.max(0, Math.min(1, num(csRaw.rate, 0))) } : null;
  const variety = known ? varietyFor(known, npc.heritage, { birthplace: npc.birthplace }) : null;
  const faith = faithFor(npc.heritage) || (persona.practice ? 'christian' : null);
  const reg = age < 13 ? 'casual' : (speech.register === 'formal' || speech.register === 'casual' ? speech.register : 'neutral');
  const usted = !(age >= 13 && age < 30 && reg === 'casual');

  // the weather and alerts now
  const wx = world.weatherAt(zi, t);
  const alerts = relevantAlerts(wx && wx.alerts, coastKm);
  const sky = skyCondition(wx);
  const offshore = offshoreWind(wx, z);

  // what they are doing now
  let activity = null;
  try { activityAt && (activity = activityAt(npc, persona, t)); } catch { activity = null; }

  const occKey = str(routine.occKey) || (occ && str(occ.sector)) || null;
  const mode0 = str(commute.mode);
  const interests = Array.isArray(persona.interests) ? persona.interests : [];
  const teams = Array.isArray(persona.teams) ? persona.teams : [];
  const kids = rel.kids;
  const flags = {
    house: hh.dwelling === 'house', apartment: hh.dwelling === 'apartment' || hh.dwelling === 'small-apartment', mobile: hh.dwelling === 'mobile-home',
    ownerHousehold: hh.tenure === 'own',
    newcomer: isNum(res.yearsInZip) && res.yearsInZip <= 3 && !res.bornHere,
    longtime: isNum(res.yearsInZip) && res.yearsInZip >= 15,
    retired: npc.status === 'retired', student: npc.status === 'student' || !!npc.school,
    wfh: mode0 === 'wfh' || !!(occ && occ.wfh && mode0 === 'wfh'),
    outdoor: routine.outdoor === true,
    kids: kids.length > 0, littleKids: kids.some(k => isNum(k.age) && k.age < 6), teens: kids.some(k => isNum(k.age) && k.age >= 13 && k.age < 18),
    grandkids: rel.grandkids.length > 0, partner: !!rel.partner, alone: num(hh.size, 1) <= 1,
    immigrant: npc.nativity === 'foreign',
    transit: ['bus', 'rail', 'ferry'].includes(mode0),
    nights: (occ && occ.shift === 'night') || routine.shift === 'night',
    early: (occ && occ.shift === 'early') || (isNum(commute.departMin) && commute.departMin < 360 && npc.status === 'employed'),
    commuter: npc.status === 'employed' && !!mode0 && mode0 !== 'wfh' && isNum(commute.minutes) && commute.minutes > 0,
    coast: coastKm <= COAST_KM,
    urban: density >= 4500, rural: density < 700, suburban: density >= 700 && density < 4500,
    churchgoer: !!persona.practice, fan: teams.length > 0,
    fireZone: num(z.fhsz_any) >= 20, hotPlace: num(z.h100) >= 10 || num(z.tjul) >= 92, snowPlace: num(z.snowfall_in) >= 20,
    desert: /desert/i.test(String(z.provinceName || '')),
    withParents: rel.parents.length > 0 && age >= 18, widowed: npc.marital === 'widowed',
    surfs: interests.includes('surfing'),
  };

  // the dialect's world-grounded slots (the persona's own team, or none: a non-fan does not cheer)
  const team = teams[0] ? { name: teams[0].name, label: teamLabel(teams[0].name) } : null;
  const lex = slotsFor(world, zi, { t, dialect: key, team: team || undefined });
  if (!team) { lex.values.team = null; lex.values.teamName = null; }
  // dialect weather lines follow the sky, not an alert for a river somewhere in the county
  const context = Object.assign({}, lex.context, { condition: sky, alerts: alerts.map(a => String(a.event)) });

  const names = npc.name || {};
  const v = {
    world, p: persona, npc, zi, z, t, P, hour: P.hour, month: P.month, weekend: P.dow === 0 || P.dow === 6,
    key, D, age, stage, sex: npc.sex === 'F' ? 'F' : 'M',
    first: str(names.first) || str(names.display) || 'me', full: str(names.full) || str(names.display) || str(names.first) || null,
    nick: str(names.nick),
    reg, verb: num(speech.verbosity, 0.5), humor: num(speech.humor, 0.4), humorStyle: str(speech.humorStyle) || 'wry',
    direct: num(speech.directness, 0.5), slang: num(speech.slang, 0.2), fillers: Array.isArray(speech.fillers) ? speech.fillers.slice() : [],
    catchphrases: Array.isArray(speech.catchphrases) ? speech.catchphrases.slice() : [],
    big5, speaker, flags, rel, home, res, hh, occ, occKey, commute, routine, interests, teams, team,
    homeWord: HOME_WORD[hh.dwelling] || 'place',
    lang: { mode, home: homeLang, known, cs, variety, faith, usted, limited },
    lex, context, wx, alerts, sky, offshore, tempF: wx && wx.now && isNum(wx.now.tempF) ? wx.now.tempF : null,
    activity,
    // refreshed every turn
    mood: { valence: 0, arousal: 0.4, emotion: 'neutral', tired: false, tense: false },
    relq: { known: false, affinity: 0, trust: 0, familiarity: 0, guarded: false, name: null, feelings: 'neutral', facts: [] },
  };
  return v;
}

/**
 * Refresh the per-turn parts of a voice from the mind: mood, emotion, needs and the relationship with the player.
 * @param {object} v a voice
 * @param {import('../mind.mjs').Mind|null} mind
 * @param {{metBefore?: boolean}} [opts]
 * @returns {object} the same voice
 */
export function refreshVoice(v, mind, opts = {}) {
  if (!mind) return v;
  const mood = mind.mood || { valence: 0, arousal: 0.4 };
  const needs = mind.needs || {};
  const emotion = mind.emotion || 'neutral';
  v.mood = {
    valence: num(mood.valence, 0), arousal: num(mood.arousal, 0.4), emotion,
    tired: emotion === 'tired' || num(needs.energy, 1) < 0.28,
    tense: ['tense', 'anxious', 'irritated', 'angry', 'upset'].includes(emotion),
    needs: Object.assign({}, needs),
  };
  const r = mind.relationships && mind.relationships.player ? mind.relationships.player : null;
  const feelings = typeof mind.feelingsToward === 'function' ? mind.feelingsToward('player') : 'neutral';
  const facts = r && Array.isArray(r.facts) ? r.facts : [];
  const nameFact = facts.find(f => f && f.key === 'name' && str(f.value));
  v.relq = {
    known: !!opts.metBefore || (r ? num(r.familiarity, 0) >= 0.2 : false),
    affinity: r ? num(r.affinity, 0) : 0, trust: r ? num(r.trust, 0) : 0, familiarity: r ? num(r.familiarity, 0) : 0,
    grievance: r ? num(r.grievance, 0) : 0,
    guarded: ['wary', 'annoyed', 'hurt'].includes(feelings) || (r ? num(r.trust, 0) < -0.1 : false),
    name: nameFact ? String(nameFact.value).split(/\s+/)[0] : null,
    feelings, facts,
  };
  return v;
}
