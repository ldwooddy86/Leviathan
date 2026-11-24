// Legion · the NPC panel: one Californian, in five tabs.
//
// Profile renders the NPC record (identity, languages, household, home, work and commute, education, income).
// Mind renders the persona (Big Five in plain words, traits, archetype, values, interests, concerns with the data
// behind them, memories with their year and source) and the live mind (mood, needs, the relationship with you and
// what they have learned about you). Talk is a conversation with the offline dialogue engine or with Claude:
// offline, the NPC greets when the tab opens, answers every line (with an English gloss under a line in another
// language and the pack facts it used a tap away) and says goodbye when you leave, and the mind consolidates what
// was said (mind.reflect); with Claude, the reply streams in, the voice keeps the history and each turn carries
// the moment's situation, and leaving reflects the conversation into the NPC's memory (llm.reflect). Both record
// what you say in the NPC's mind. Prompt shows the exact system blocks Claude gets and the situation note of the
// moment, with a token estimate. JSON exports the record, the persona and the mind, and the game-engine export.
// The tabs follow the ARIA tabs pattern: arrows, Home and End move between them.

import { EVENTS } from './bus.mjs';
import { h, icon, clear, copyText, downloadText, safeJSON, toast, sheetGrip } from './dom.mjs';
import {
  fmtInt, fmtMoney, fmtDuration, fmtMinute, daysLabel, displayName, initials, label, capitalize, roadLabel, speechWords,
  householdRelations, memberRelation,
  HH_TYPE, ROLE, MODE_VERB, EDUCATION, SCHOOL, STATUS, ENGLISH, MARITAL, GENERATION, LANGUAGE, OCCUPATION_GROUP, DIALECT,
} from './format.mjs';
import { meter } from './charts.mjs';
import { factLabel, concernSourceText, memorySource, plainWhy } from './provenance.mjs';
import { alertsForZip } from './nws-live.mjs';
import { fireLabel } from './services.mjs';

/** The tabs, in order. */
export const NPC_TABS = Object.freeze([
  { key: 'profile', label: 'Profile' },
  { key: 'mind', label: 'Mind' },
  { key: 'talk', label: 'Talk' },
  { key: 'prompt', label: 'Prompt' },
  { key: 'json', label: 'JSON' },
]);

/** The Big Five as the Mind tab shows them: key, name, the low and the high end in plain words. */
export const BIG5 = Object.freeze([
  ['O', 'Openness', 'prefers the familiar', 'curious, open to new things'],
  ['C', 'Conscientiousness', 'easygoing, spontaneous', 'organized, dependable'],
  ['E', 'Extraversion', 'reserved, recharges alone', 'outgoing, energized by people'],
  ['A', 'Agreeableness', 'blunt, competitive', 'warm, accommodating'],
  ['N', 'Neuroticism', 'calm, even-keeled', 'sensitive, worries easily'],
]);

/**
 * One Big Five score (0..1) in plain words: 'very curious, open to new things', 'in between', 'easygoing,
 * spontaneous'.
 * @param {string} key O C E A or N
 * @param {number} v 0..1
 * @returns {string}
 */
export function big5Words(key, v) {
  const row = BIG5.find(r => r[0] === key);
  if (!row || !Number.isFinite(v)) return '';
  if (v >= 0.4 && v <= 0.6) return 'in between';
  const side = v > 0.6 ? row[3] : row[2];
  return v > 0.8 || v < 0.2 ? `very ${side}` : side;
}

const NEEDS = ['energy', 'social', 'fun', 'comfort', 'money'];
const DRIVING = new Set(['drive', 'carpool', 'motorcycle', 'taxi']);

/**
 * A fire as people name it, the way the dialogue says it (the lexicon's fireLabel): "Camp" is "the Camp Fire",
 * "Btu Lightning Complex" is "the BTU Lightning Complex"; null for an unnamed fire or one whose name is only a code
 * or a number ("241 Incident"), which no one asks about by name.
 * @param {string} name a pack fire name (world.firesOf)
 * @returns {string|null}
 */
export function fireName(name) {
  const n = String(name || '').trim().replace(/\s+/g, ' ').replace(/\s+Incident$/i, '');
  if (!n || /^unnamed\b/i.test(n)) return null;
  if (!/^\d+ Complex$/i.test(n) && !/[A-Za-z]{3,}/.test(n.replace(/\b(?:complex|fire)\b/gi, ''))) return null;
  return fireLabel(n);
}

/**
 * Conversation starters for one NPC, each about something the pack holds for them (CONTRACTS section 3), so a
 * starter never invites the dialogue engine or Claude to describe an event the data does not contain: work, school
 * or the days by their status; the weather, or an NWS alert active in their ZIP right now; traffic, on their own
 * highway when they drive one; food; the most destructive fire that touched or came near their ZIP when the pack
 * records one, else how long they have lived there; and one question about the place's climate the data supports
 * (snow only where it snows, the heat only where it is hot).
 * @param {object} world
 * @param {object} npc a layer 1 NPC
 * @param {{weather?: object|null}} [context] world.weatherAt for the NPC's ZIP at the simulated time
 * @returns {string[]}
 */
export function startersFor(world, npc, { weather = null } = {}) {
  // babies and toddlers are not asked about traffic or restaurants; small children get questions a child answers
  const age = Number.isFinite(npc.age) ? npc.age : null;
  if (age !== null && age < 3) return ['Hi there, little one!', 'Want to play peekaboo?', 'Is that your favorite toy?', 'Can you wave hello?'];
  if (age !== null && age < 5) return ['Hi! How are you today?', 'What’s your favorite toy?', 'Do you like going to the park?', 'What’s your favorite animal?', 'What’s your favorite food?'];
  const kid = age !== null && age < 13;
  const out = ['How’s your day going?'];
  if (npc.occupation || npc.status === 'employed' || npc.status === 'military') out.push('What do you do for work?');
  else if (npc.school || npc.status === 'student') out.push('How’s school going?');
  else if (npc.status === 'retired') out.push('What keeps you busy these days?');
  else out.push('What do you like to do around here?');
  const zi0 = Number.isInteger(npc.zi) ? npc.zi : world.indexOf(npc.zip);
  // coastal alerts cover whole counties but only touch the shore: not news 8 km inland (the dialogue's rule)
  const alert = weather ? alertsForZip(weather.alerts, zi0 >= 0 && world.z && world.z.coast_km ? world.z.coast_km[zi0] : null)[0] || null : null;
  out.push(alert ? `Heard about the ${alert.event}?` : 'How’s the weather treating you?');
  const c = npc.commute || {};
  const road = DRIVING.has(c.mode) ? roadLabel(c.road) : null;
  if (kid) out.push('What do you like to play?', 'What’s your favorite food?');
  else {
    out.push(road ? `How’s traffic on ${road}?` : 'What’s traffic like around here?');
    out.push('Where should I eat around here?');
  }
  const zi = Number.isInteger(npc.zi) ? npc.zi : world.indexOf(npc.zip);
  // the fire is one they could remember: they were at least five when it burned
  const born = Number.isFinite(npc.birthYear) ? npc.birthYear : age !== null ? 2026 - age : null;
  let fire = null;
  if (zi >= 0 && typeof world.firesOf === 'function') {
    for (const f of world.firesOf(zi)) {
      if (born !== null && Number.isFinite(Number(f.year)) && Number(f.year) - born < 5) continue;
      fire = fireName(f.name);
      if (fire) break;
    }
  }
  out.push(fire ? `What was ${fire} like?` : 'How long have you lived here?');
  const z = zi >= 0 && world.z ? world.z : null;
  const snowNow = weather && weather.now && /snow/i.test(String(weather.now.short || ''));
  if (z && (snowyPlace(z, zi) || snowNow)) out.push('Does it snow much up here?');
  else if (z && (Number(z.h100[zi]) || 0) >= 10) out.push('How do you handle the heat here?');
  return out;
}

/**
 * True where it snows enough to talk about: a foot or more a year (snowfall_in), or, where no station measures
 * snowfall, a heavy design snow load (snow_psf, 60 lb/ft² and up) in the mountains (1,200 m and up).
 */
export function snowyPlace(z, zi) {
  const fall = z.snowfall_in[zi];
  if (fall !== null && fall !== undefined && Number.isFinite(Number(fall))) return Number(fall) >= 12;
  return (Number(z.snow_psf[zi]) || 0) >= 60 && (Number(z.elev_m[zi]) || 0) >= 1200;
}

/** "Rents in an apartment building", "Owns a house". */
export function homePhrase(tenure, dwelling) {
  const own = tenure === 'own';
  const verb = own ? 'Owns' : tenure === 'rent' ? 'Rents' : 'Lives in';
  switch (dwelling) {
    case 'house': return `${verb} a house`;
    case 'mobile-home': return `${verb} a mobile home`;
    case 'small-apartment': return own ? 'Owns a unit in a small building' : `${verb} in a small apartment building`;
    case 'apartment': return own ? 'Owns a condo in a large building' : `${verb} in an apartment building`;
    default: return own ? 'Owns their home' : tenure === 'rent' ? 'Rents their home' : 'Home';
  }
}

/**
 * "built 1962"; in a ZIP whose median is the ACS top code (built 1939 or earlier), a year at the code itself reads
 * "built before 1940" (the Census does not say which year).
 */
export function builtText(year, z) {
  const y = Number(year);
  if (!Number.isFinite(y) || y <= 0) return null;
  const top = z && (z.ybBefore1940 === true || (Number(z.yb_med) > 0 && Number(z.yb_med) <= 1939));
  return top && (y === 1938 || y === 1939) ? 'built before 1940' : `built ${y}`;
}

/** The commute as two short lines: how, and when. */
export function commuteLines(npc) {
  const c = npc.commute || {};
  if (!c.mode) return null;
  if (c.mode === 'wfh') return { how: 'Works from home', when: c.days ? daysLabel(c.days) : null };
  const verb = label(MODE_VERB, c.mode);
  const dest = c.workCity ? ` to ${c.workCity}${c.workZip ? ` (${c.workZip})` : ''}` : '';
  const road = DRIVING.has(c.mode) && roadLabel(c.road) ? ` on ${roadLabel(c.road)}` : '';
  const how = `${verb}${Number.isFinite(c.minutes) && c.minutes > 0 ? ` ${fmtDuration(c.minutes)}` : ''}${dest}${road}`;
  const parts = [];
  if (Number.isFinite(c.departMin)) parts.push(`leaves ${fmtMinute(c.departMin)}`);
  if (Number.isFinite(c.departMin) && Number.isFinite(c.dwellMin) && c.dwellMin > 0) parts.push(`back about ${fmtMinute((c.departMin + 2 * (c.minutes || 0) + c.dwellMin) % 1440)}`);
  if (c.days) parts.push(daysLabel(c.days));
  return { how, when: parts.length ? capitalize(parts.join(' · ')) : null };
}

const MOVING_BY = { drive: 'driving', carpool: 'carpooling', bus: 'by bus', rail: 'by train', ferry: 'by ferry', taxi: 'by taxi', motorcycle: 'by motorcycle', bike: 'by bike', walk: 'on foot', other: null, wfh: null };

/**
 * What an NPC is doing (schedule.activityAt) as one line, from the schedule's kind and its destination label:
 * "Heading to work in Los Angeles · driving · until 8:40 AM", "Visiting family in Newbury Park · until 4:07 PM".
 */
export function activityLine(a) {
  if (!a || typeof a !== 'object') return null;
  const where = a.place && a.place.label ? String(a.place.label) : '';
  const lbl = String(a.label || where || a.kind || '');
  let what;
  if (a.travel) what = /^home\b/.test(lbl) ? `Heading ${lbl}` : `Heading to ${where && where !== 'home' ? where : lbl}`;
  else {
    switch (a.kind) {
      case 'sleep': what = 'Asleep'; break;
      case 'home': what = 'At home'; break;
      case 'work': what = /home/.test(lbl) ? capitalize(lbl) : `At ${lbl || 'work'}`; break;
      case 'visit': what = `Visiting ${lbl}`; break;
      case 'exercise': what = `Exercising${lbl && lbl !== 'exercise' ? ` (${lbl})` : ''}`; break;
      default: what = lbl ? `At ${lbl}` : capitalize(a.kind || '');
    }
  }
  const how = a.travel && a.mode ? MOVING_BY[a.mode] || null : null;
  const until = Number.isFinite(a.endMin) ? `until ${fmtMinute(a.endMin % 1440)}` : null;
  return [what, how, until].filter(Boolean).join(' · ') || null;
}

/**
 * The small line under an NPC's bubble: who spoke and how they feel, in words ("offline engine · feeling content").
 * An emotion key never stands alone, where "content" would read as the noun.
 * @param {{emotion?: string}} line
 * @param {string} engine 'offline' | 'claude'
 */
export function lineMeta(line, engine) {
  const mood = line && line.emotion && line.emotion !== 'neutral' ? `feeling ${String(line.emotion).replace(/[-_]+/g, ' ')}` : null;
  return [engine === 'offline' ? 'offline engine' : null, mood].filter(Boolean).join(' · ');
}

/** A rough token count of text (4 characters a token, the usual estimate for English prose). */
export function estimateTokens(text) { return Math.ceil(String(text ?? '').length / 4); }

/** The size of text as a file (UTF-8 bytes, which is what Download writes), in words: "18,472 bytes", "1.2 MB". */
export function byteSize(text) {
  const n = new TextEncoder().encode(String(text ?? '')).length;
  if (n < 100 * 1024) return `${fmtInt(n)} bytes`;
  return n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

function row(term, ...value) {
  const v = value.flat().filter(x => x !== null && x !== undefined && x !== '');
  return v.length ? h('div.dl-row', h('dt', term), h('dd', ...v)) : null;
}
function group(title, ...rows) {
  const r = rows.flat().filter(Boolean);
  return r.length ? h('section.p-section', h('h3', title), h('dl.dl', r)) : null;
}
function placeholder(iconName, title, text, extra) {
  return h('div.placeholder', h('div.ph-icon', { 'aria-hidden': 'true' }, icon(iconName, { size: 22 })), h('h3', title), h('p', text), extra || null);
}
function chips(list) { return h('div.chip-row.static', list.map(x => h('span.chip', typeof x === 'string' ? x : (x.label || x.name || x.topic || JSON.stringify(x))))); }

/** Copy text and say how it went: a success toast only when the copy really happened. */
async function copyWithToast(text, done) {
  const copied = await copyText(text);
  toast(copied ? done : 'Copy failed: select the text and copy it yourself.', { kind: copied ? 'success' : 'error' });
  return copied;
}

/** A fresh conversation state (one visit to an NPC; leaving ends it). */
function newTalk(engine) {
  return { engine, conv: null, history: null, lines: [], busy: false, ended: false, claudeTurns: 0, offlineTurns: 0, seeded: false, abort: null, greeted: false, used: new Set(), rerender: false };
}

/**
 * How far (simulated minutes) the clock may move from the moment an offline conversation is about before its next
 * line belongs to a new conversation. The offline engine speaks of one moment (the weather, what the NPC is doing);
 * while the Talk tab is open the clock runs in real time, so only leaving the tab with the clock running, a jump of
 * the clock or a speed chosen mid-conversation gets this far.
 */
export const TALK_STALE_MIN = 15;

/** True when an offline conversation that started at convT (epoch ms) no longer describes simulated time t. */
export function talkIsStale(convT, t, staleMin = TALK_STALE_MIN) {
  return Number.isFinite(convT) && Number.isFinite(t) && Math.abs(t - convT) > staleMin * 60000;
}

/** The NPC panel. */
export class NpcPanel {
  /**
   * @param {{el: HTMLElement, services: object, bus: object, settings: object, getTime: () => number,
   *   onLocate?: (npc: object) => void, onWalk?: (npc: object) => void, onBack?: () => void, onClose?: () => void,
   *   openSettings?: () => void, onTalk?: (active: boolean) => void}} deps onWalk opens the street view at the NPC's
   *   home, following them; onTalk says when a conversation is on screen and when it is not (the page runs the clock
   *   in real time meanwhile)
   */
  constructor(deps) {
    Object.assign(this, { services: deps.services, bus: deps.bus, settings: deps.settings, getTime: deps.getTime });
    this.deps = deps;
    this.el = deps.el;
    this.world = deps.services.world;
    this.id = null; this.npc = null; this.tab = 'profile';
    this.rendered = new Set();
    this.talk = null;
    const el = this.el;
    el.classList.add('panel', 'npc-panel');
    el.setAttribute('aria-labelledby', 'npc-name');
    el.hidden = true;
    this.head = h('header.panel-head.npc-head');
    this.tablist = h('div.tabs', { role: 'tablist', 'aria-label': 'About this NPC' });
    this.panels = {};
    this.tabButtons = {};
    for (const t of NPC_TABS) {
      const btn = h('button.tab', { type: 'button', role: 'tab', id: `npc-tab-${t.key}`, 'aria-controls': `npc-tabpanel-${t.key}`, 'aria-selected': 'false', tabindex: '-1', dataset: { tab: t.key }, on: { click: () => this.select(t.key) } }, t.label);
      this.tabButtons[t.key] = btn;
      this.tablist.append(btn);
      this.panels[t.key] = h('div.tabpanel', { role: 'tabpanel', id: `npc-tabpanel-${t.key}`, 'aria-labelledby': `npc-tab-${t.key}`, tabindex: '0', hidden: true, dataset: { tab: t.key } });
    }
    this.tablist.addEventListener('keydown', e => this._tabKeys(e));
    this.body = h('div.panel-body.npc-body', Object.values(this.panels));
    el.append(sheetGrip(el, { label: 'NPC', onChange: () => { this._gripUsed = true; if (deps.onResize) deps.onResize(); } }), this.head, this.tablist, this.body);
    this.bus.on(EVENTS.SETTINGS_CHANGE, ({ changed }) => {
      if (!this.id) return;
      if (changed.some(k => k.startsWith('claude') || k.startsWith('network'))) {
        // the engine line and the setup note depend on these; a conversation in progress is kept, and a reply on its
        // way is not cut from the screen: the tab is redrawn once it has arrived
        this.rendered.delete('talk'); this.rendered.delete('prompt');
        if (this.tab === 'talk' && this.talk && this.talk.busy) { this.talk.rerender = true; return; }
        if (this.tab === 'talk' || this.tab === 'prompt') this._renderTab(this.tab, { keepFocus: true });
      }
    });
  }

  /** True while showing an NPC. */
  isOpen() { return !this.el.hidden; }

  /**
   * Show an NPC by id; returns false (and shows nothing) when the id resolves to no one.
   * @param {string} id
   * @param {{focus?: boolean, tab?: string}} [options]
   */
  open(id, { focus = false, tab } = {}) {
    const npc = this.services.npc(id);
    if (!npc) { toast(`No NPC has the id ${id}.`, { kind: 'error' }); return false; }
    const wantTab = tab && NPC_TABS.some(t => t.key === tab) ? tab : null;
    if (!this.el.hidden && npc.id === this.id) {
      // the NPC already open (their row, their dot, their search result): keep the panel and the conversation
      if (wantTab && wantTab !== this.tab) this.select(wantTab);
      if (focus) this._focusName();
      return true;
    }
    if (this.id && this.id !== npc.id) this._leave();   // say goodbye, reflect and save the conversation before
    this.talk = null;
    this.id = npc.id; this.npc = npc;
    if (wantTab) this.tab = wantTab;
    this.rendered.clear();
    this._renderHead();
    this.refreshNow(this.getTime());
    this.el.hidden = false;
    this.select(this.tab, { focusTab: false });
    if (focus) this._focusName();
    this._talkChanged();
    return true;
  }

  _focusName() { const n = this.head.querySelector('#npc-name'); if (n) n.focus(); }

  /** Hide the panel (the conversation is closed: goodbye, reflection into the NPC's memory, saved). */
  close() {
    if (this.el.hidden) return;
    this._leave();
    this.el.hidden = true;
    this.id = null; this.npc = null;
    this.talk = null;
    this._talkChanged();
    if (this.deps.onClose) this.deps.onClose();
  }

  /** True while a conversation is on screen: the Talk tab of the open panel, the conversation not ended. */
  talking() { return this.isOpen() && this.tab === 'talk' && !!this.talk && !this.talk.ended; }

  /** Tell the page when a conversation comes on screen or leaves it (the clock runs in real time meanwhile). */
  _talkChanged() {
    const on = this.talking();
    if (on === !!this._talkOn) return;
    this._talkOn = on;
    if (this.deps.onTalk) { try { this.deps.onTalk(on); } catch (e) { console.error('[legion] onTalk failed', e); } }
  }

  /** Switch tabs. */
  select(key, { focusTab = false } = {}) {
    this.tab = key;
    for (const t of NPC_TABS) {
      const on = t.key === key, btn = this.tabButtons[t.key];
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
      this.panels[t.key].hidden = !on;
    }
    if (focusTab) this.tabButtons[key].focus();
    // the Talk tab fills the panel (only the log scrolls); on a phone its sheet opens tall unless the grip was used
    this.body.classList.toggle('is-talk', key === 'talk');
    if (!this._gripUsed) this.el.classList.toggle('is-expanded', key === 'talk');
    // an offline conversation the clock has left behind (the tab was away while the clock ran, or the clock jumped)
    // ends, and the NPC greets anew at the present moment
    if (key === 'talk' && this._talkStale()) this._resumeLater();
    // Mind and Prompt show the moment: redrawn whenever they are opened
    else if (!this.rendered.has(key) || key === 'mind' || key === 'prompt') this._renderTab(key);
    this._talkChanged();
  }

  _tabKeys(e) {
    const keys = NPC_TABS.map(t => t.key), i = keys.indexOf(this.tab);
    let next = null;
    if (e.key === 'ArrowRight') next = keys[(i + 1) % keys.length];
    else if (e.key === 'ArrowLeft') next = keys[(i - 1 + keys.length) % keys.length];
    else if (e.key === 'Home') next = keys[0];
    else if (e.key === 'End') next = keys[keys.length - 1];
    if (next) { e.preventDefault(); this.select(next, { focusTab: true }); }
  }

  _renderHead() {
    const npc = this.npc, name = displayName(npc.name);
    const canWalk = this.services.available('street') && this.deps.onWalk;
    clear(this.head).append(
      h('button.icon-btn.npc-back', { type: 'button', 'aria-label': 'Back to the place', title: 'Back to the place', on: { click: () => this.deps.onBack && this.deps.onBack() } }, icon('back')),
      h('span.avatar', { 'aria-hidden': 'true' }, initials(name)),
      h('div.npc-title',
        h('h2.npc-name#npc-name', { tabindex: '-1' }, name),
        h('p.npc-meta', h('span.npc-age', { 'aria-label': `age ${npc.age}` }, String(npc.age)), npc.pronouns ? ` · ${npc.pronouns}` : '', npc.heritageLabel ? ` · ${npc.heritageLabel}` : ''),
        h('p.npc-id.mono', npc.id),
        this.nowEl = h('p.npc-now', { hidden: true, 'aria-live': 'off' })),
      h('div.head-actions',
        canWalk ? h('button.icon-btn.walk-btn', { type: 'button', 'aria-label': `Walk the streets with ${name.split(' ')[0]}`, title: 'Walk the streets (follows them)', on: { click: () => this.deps.onWalk(this.npc) } }, icon('street')) : null,
        h('button.icon-btn', { type: 'button', 'aria-label': 'Show home and work on the map', title: 'Show on the map', on: { click: () => this.deps.onLocate && this.deps.onLocate(npc) } }, icon('locate')),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Close NPC', title: 'Close (Esc)', on: { click: () => this.close() } }, icon('close'))));
  }

  /**
   * Refresh the "right now" line from the schedule for simulated time t; returns the activity or null.
   * Called by the page as the clock moves.
   */
  refreshNow(t) {
    if (!this.id || !this.nowEl) return null;
    const r = this.services.activityAt(this.id, t);
    const text = r.ok ? activityLine(r.value) : null;
    this.nowEl.hidden = !text;
    if (text && this.nowEl.textContent !== `Now: ${text}`) this.nowEl.textContent = `Now: ${text}`;
    return r.ok ? r.value : null;
  }

  /**
   * Draw a tab. With keepFocus (a redraw the player did not ask for, such as a settings change), focus that was
   * inside the tab, or on the page body because the control that had it is gone, lands back in the tab: the Talk
   * input, else the tab panel, so a keyboard or screen-reader user keeps their place.
   */
  _renderTab(key, { keepFocus = false } = {}) {
    const panel = this.panels[key];
    if (!this.npc) return;
    let content;
    try {
      content = key === 'profile' ? this._profile() : key === 'mind' ? this._mind() : key === 'talk' ? this._talk() : key === 'prompt' ? this._prompt() : this._json();
    } catch (e) {
      console.error(`[legion] ${key} tab failed`, e);
      content = placeholder('alert', 'This tab could not be drawn', String(e && e.message || e));
    }
    const a = typeof document !== 'undefined' ? document.activeElement : null;
    const hadFocus = keepFocus && !!a && panel.contains(a);
    clear(panel).append(content);
    this.rendered.add(key);
    if (hadFocus) this._focusIn(key);
  }

  /** Focus the tab's main control (the Talk input when it can take text), else the tab panel itself. */
  _focusIn(key) {
    const panel = this.panels[key];
    const input = key === 'talk' ? panel.querySelector('.talk-input:not([disabled])') : null;
    (input || panel).focus({ preventScroll: true });
  }

  /**
   * The page hands focus back after a dialog closes (Settings opened from the Talk tab): when the control that
   * opened it was redrawn away meanwhile, the tab it was in takes the focus. Returns true when it did.
   */
  restoreFocus() {
    if (!this.isOpen()) return false;
    const a = typeof document !== 'undefined' ? document.activeElement : null;
    if (a && a !== document.body && a.isConnected) return false;
    this._focusIn(this.tab);
    return true;
  }

  // ------------------------------------------------ Profile

  _profile() {
    const n = this.npc, w = this.world;
    const hh = n.household || {}, place = n.place || {}, occ = n.occupation, lang = n.languages || {};
    const foreign = n.nativity === 'foreign';
    const homeLang = label(LANGUAGE, lang.home, null);
    const others = (lang.list || []).filter(k => k !== lang.home).map(k => label(LANGUAGE, k));
    const commute = commuteLines(n);
    const ll = hh.home && Number.isFinite(hh.home.lat) ? `${hh.home.lat.toFixed(4)}, ${hh.home.lon.toFixed(4)}` : null;
    const zi = Number.isFinite(n.zi) ? n.zi : w.indexOf(n.zip);
    const placeName = place.place && place.place !== place.city ? `${place.place}, ${place.city}` : (place.city || (zi >= 0 ? w.z.city[zi] : ''));

    // each member as this NPC's relative ('Aunt', 'Brother'): the Census roles are the householder's, so the
    // householder's sister reads "Sibling" only from the householder's side; the role stays in the tooltip
    const relations = new Map(householdRelations(n).map(r => [r.member.m, r.relation]));
    const allMembers = hh.members || [];
    const holder = allMembers.find(m => m.role === 'householder');
    const members = allMembers.map(m => {
      const mname = typeof m.name === 'object' ? displayName(m.name) : (m.name || 'Member');
      const self = m.m === n.m;
      const census = m.role === 'householder' ? 'Householder' : `Householder’s ${label(ROLE, m.role).toLowerCase()} (Census role)`;
      // this NPC's own line says how they stand to the householder: "Householder", "Householder's son"
      const rel = self
        ? (m.role === 'householder' || !holder ? label(ROLE, m.role) : `Householder’s ${memberRelation({ role: 'householder', m: holder.m }, { ...m, sex: m.sex || n.sex }, allMembers)}`)
        : capitalize(relations.get(m.m) || label(ROLE, m.role).toLowerCase());
      const text = [h('span.member-name', mname), h('span.member-meta', { title: census }, `${rel} · ${m.age}`)];
      return h('li', self
        ? h('div.member.is-self', { 'aria-current': 'true' }, ...text, h('span.member-self', 'this NPC'))
        : h('button.member', { type: 'button', 'aria-label': `Open ${mname}, ${rel.toLowerCase()}, ${m.age}`, on: { click: () => this.bus.emit(EVENTS.NPC_SELECT, { id: `${hh.id || n.hid}-${m.m}`, source: 'household' }) } }, ...text));
    });

    const job = occ ? [
      h('span', occ.title && occ.title !== occ.key ? capitalize(occ.title) : label(OCCUPATION_GROUP, occ.key)),
      h('span.dd-sub', [occ.sector && occ.sector !== occ.key && occ.sector !== occ.title ? capitalize(occ.sector) : label(OCCUPATION_GROUP, occ.key, ''), occ.employer, occ.shift ? `${occ.shift} shift` : null].filter(Boolean).join(' · ')),
    ] : null;

    return h('div.profile',
      group('Who',
        row('Born', [n.birthYear, n.birthplace].filter(Boolean).join(' · ')),
        foreign || n.arrivalYear ? row('Arrived', [n.arrivalYear ? `${n.arrivalYear}` : null, label(GENERATION, n.generation, null)].filter(Boolean).join(' · ')) : row('Generation', label(GENERATION, n.generation, null)),
        row('Heritage', n.heritageLabel),
        n.age >= 15 ? row('Marital', label(MARITAL, n.marital, null)) : null,
        n.veteran ? row('Service', 'Veteran') : null),
      group('Languages',
        row('At home', homeLang ? [homeLang, lang.english && lang.english !== 'only' ? h('span.dd-sub', label(ENGLISH, lang.english)) : null] : null),
        others.length ? row('Also', others.join(', ')) : null),
      group('Household',
        row('Household', [label(HH_TYPE, hh.type, null), Number.isFinite(hh.size) ? `${fmtInt(hh.size)} ${hh.size === 1 ? 'person' : 'people'}` : null].filter(Boolean).join(' · ')),
        members.length > 1 ? h('div.dl-row.members-row', h('dt', 'Members'), h('dd', h('ul.members', members))) : null,
        row('Home', [homePhrase(hh.tenure, hh.dwelling), h('span.dd-sub', [builtText(hh.yearBuilt, zi >= 0 ? w.zip(zi) : null), hh.yearMoved ? `moved in ${hh.yearMoved}` : null, Number.isFinite(hh.vehicles) ? `${hh.vehicles} vehicle${hh.vehicles === 1 ? '' : 's'}` : null].filter(Boolean).join(' · '))]),
        row('Income', Number.isFinite(n.householdIncome) && n.householdIncome > 0 ? `${fmtMoney(n.householdIncome)} household` : null)),
      group('Where',
        row('Lives in', [`${placeName} ${n.zip || ''}`.trim(), place.countyName ? h('span.dd-sub', `${place.countyName} County${place.regionName ? ` · ${place.regionName}` : ''}`) : null]),
        ll ? row('Location', h('span.mono', ll)) : null),
      group(n.school && !occ ? 'School' : 'Work',
        row('Status', label(STATUS, n.status, null)),
        job ? row('Job', job) : null,
        n.school ? row('School', label(SCHOOL, n.school)) : null,
        commute ? row('Commute', [commute.how, commute.when ? h('span.dd-sub', commute.when) : null]) : null,
        row('Earns', Number.isFinite(n.income) && n.income > 0 ? `${fmtMoney(n.income)} a year` : null),
        row('Education', n.age >= 18 || (n.education && !['child', 'in school'].includes(n.education)) ? label(EDUCATION, n.education, null) : null)));
  }

  // ------------------------------------------------ Mind

  _mind() {
    const t = this.getTime();
    const p = this.services.persona(this.id, { t });
    const m = this.services.mind(this.id, { t });
    if (!p.ok && !m.ok) return placeholder('people', 'Personality and mind', p.message);
    const out = h('div.mind');
    if (p.ok) out.append(...this._personaSections(p.value));
    else out.append(h('p.muted', p.message));
    if (m.ok) out.append(...this._mindSections(m.value));
    else out.append(h('section.p-section', h('h3', 'Mood and memory'), h('p.muted', m.message)));
    return out;
  }

  _personaSections(p) {
    const s = [];
    if (p.bio) s.push(h('p.bio', p.bio));
    if (p.archetype) s.push(h('p.archetype', h('span.eyebrow', 'Archetype'), ' ', p.archetype));
    if (p.big5) {
      s.push(h('section.p-section.big5', h('h3', 'Personality'), h('p.fine', 'The Big Five, from age, sex, region and individual chance; never from heritage.'),
        h('div.meters', BIG5.map(([k, name, lo, hi]) => (Number.isFinite(p.big5[k]) ? meter(name, p.big5[k], { low: lo, high: hi, note: big5Words(k, p.big5[k]) }) : null)))));
    }
    if (p.traits && p.traits.length) s.push(h('section.p-section', h('h3', 'Traits'), chips(p.traits)));
    if (p.values && p.values.length) s.push(h('section.p-section', h('h3', 'Values'), chips(p.values)));
    if (p.residence && Number.isFinite(p.residence.zipSince)) {
      const r = p.residence, z = this.npc.zip;
      s.push(h('p.residence', [r.bornHere ? 'Born here' : r.grewUpHere ? 'Grew up in the county' : null, `in ${z} since ${r.zipSince}`, Number.isFinite(r.countySince) && r.countySince < r.zipSince ? `in the county since ${r.countySince}` : null].filter(Boolean).join(' · ')));
    }
    if (p.interests && p.interests.length) {
      const why = new Map((p.interestDetails || []).map(d => [d.name, d.why]));
      s.push(h('section.p-section', h('h3', 'Interests'),
        h('ul.reasons', p.interests.map(i => {
          const name = typeof i === 'string' ? i : (i.name || i.label), reason = why.get(name);
          return h('li', h('span.reason-name', capitalize(name)), reason && plainWhy(reason) ? h('span.reason-why', { title: reason }, plainWhy(reason)) : null);
        }))));
    }
    if (p.teams && p.teams.length) s.push(h('section.p-section', h('h3', 'Roots for'), chips(p.teams.map(tm => (typeof tm === 'string' ? tm : `${tm.name}${tm.sport ? ` · ${tm.sport}` : ''}`)))));
    if (p.concerns && p.concerns.length) {
      s.push(h('section.p-section', h('h3', 'Concerns'), h('p.fine', 'What worries them, and the data behind each worry.'), h('ul.concerns', p.concerns.slice(0, 6).map(c => {
        const src = concernSourceText(c.why);
        return h('li',
          h('div.concern-head', h('span.concern-topic', capitalize(c.topic || String(c))), Number.isFinite(c.weight) ? h('span.concern-weight', { title: 'How much it weighs on them (0-100)' }, `${Math.round(c.weight * 100)}`) : null),
          c.why && plainWhy(c.why) ? h('div.concern-why', { title: c.why }, plainWhy(c.why)) : null,
          src ? h('div.concern-src', `Data: ${src}`) : null);
      }))));
    }
    if (p.memories && p.memories.length) {
      s.push(h('section.p-section', h('h3', 'Memories'), h('ol.timeline', p.memories.slice(0, 8).map(mem => h('li',
        h('span.tl-year', String(mem.year || (mem.date || '').slice(0, 4) || '')),
        h('span.tl-text', mem.text || ''),
        h('span.tl-source', { title: mem.source || '' }, memorySource(mem)))))));
    }
    const sp = p.speech;
    if (sp) {
      const cs = sp.codeSwitch && sp.codeSwitch.lang ? `switches into ${label(LANGUAGE, sp.codeSwitch.lang)}${Number.isFinite(sp.codeSwitch.rate) ? ` about ${Math.round(sp.codeSwitch.rate * 100)}% of the time` : ''}` : null;
      const dialect = sp.dialect ? (this.services.dialectName && this.services.dialectName(sp.dialect)) || label(DIALECT, sp.dialect) : null;
      s.push(h('section.p-section', h('h3', 'How they talk'), h('dl.dl',
        row('Dialect', dialect),
        row('Register', sp.register ? capitalize(String(sp.register)) : null),
        row('Style', capitalize(speechWords(sp).join(', ')) || null),
        row('Languages', cs),
        sp.fillers && sp.fillers.length ? row('Fillers', sp.fillers.slice(0, 4).map(f => `“${f}”`).join(', ')) : null,
        sp.catchphrases && sp.catchphrases.length ? row('Says', sp.catchphrases.slice(0, 3).map(c => `“${c}”`).join('  ')) : null)));
    }
    if (p.hooks && p.hooks.length) s.push(h('section.p-section', h('h3', 'Would bring up'), h('ul.hooks', p.hooks.slice(0, 5).map(x => h('li', typeof x === 'string' ? x : (x.text || JSON.stringify(x)))))));
    return s;
  }

  _mindSections(mind) {
    const st = typeof mind.toJSON === 'function' ? mind.toJSON() : (mind.state || {});
    const s = [];
    const mood = st.mood || {};
    const emotion = st.emotion || mood.emotion || mood.label;
    if (emotion || Number.isFinite(mood.valence)) {
      s.push(h('section.p-section.mood', h('h3', 'Right now'), h('dl.dl',
        row('Feeling', emotion ? capitalize(String(emotion)) : null),
        Number.isFinite(mood.valence) ? row('Mood', `${mood.valence >= 0.15 ? 'good' : mood.valence <= -0.15 ? 'low' : 'level'} (${mood.valence.toFixed(2)})${Number.isFinite(mood.arousal) ? `, ${mood.arousal > 0.55 ? 'keyed up' : mood.arousal < 0.3 ? 'quiet' : 'steady'}` : ''}`) : null)));
    }
    if (st.needs) s.push(h('section.p-section', h('h3', 'Needs'), h('div.meters', NEEDS.map(k => (Number.isFinite(st.needs[k]) ? meter(capitalize(k), st.needs[k], { slot: 3 }) : null)))));
    const rel = st.relationships && st.relationships.player;
    let feelings = null;
    try { feelings = typeof mind.feelingsToward === 'function' ? mind.feelingsToward('player') : null; } catch { feelings = null; }
    if (rel || feelings) {
      s.push(h('section.p-section.relationship', h('h3', 'With you'),
        typeof feelings === 'string' ? h('p.feelings', `Feels ${feelings} toward you${rel && rel.met ? `; you have met ${rel.met === 1 ? 'once' : `${fmtInt(rel.met)} times`}` : ' (you have not met yet)'}.`) : null,
        rel ? h('div.meters', ['affinity', 'trust', 'familiarity'].map(k => (Number.isFinite(rel[k]) ? meter(capitalize(k), (rel[k] + (k === 'familiarity' ? 0 : 1)) / (k === 'familiarity' ? 1 : 2), { slot: 2 }) : null))) : null,
        rel && rel.facts && rel.facts.length
          ? [h('h4.sub-head', 'What they know about you'), h('ul.hooks.learned', rel.facts.slice(-8).map(f => h('li', typeof f === 'string' ? f : (f.text || f.value || JSON.stringify(f)))))]
          : h('p.fine', 'They have not learned anything about you yet. Tell them your name, your work, where you live.')));
    }
    const beliefs = Array.isArray(st.beliefs) ? st.beliefs.slice().sort((a, b) => (b.strength || 0) - (a.strength || 0)).slice(0, 4) : [];
    if (beliefs.length) s.push(h('section.p-section', h('h3', 'Has come to think'), h('ul.hooks', beliefs.map(b => h('li', b.text || String(b))))));
    const stream = Array.isArray(st.memory) ? st.memory.slice(-6).reverse() : [];
    if (stream.length) s.push(h('section.p-section', h('h3', 'Recent memory'), h('ol.timeline', stream.map(mm => h('li', h('span.tl-year', this._when(mm.t)), h('span.tl-text', mm.text || ''))))));
    return s;
  }

  /** A memory's time, short: the clock time on the simulated day, else the date. */
  _when(t) {
    if (!Number.isFinite(t)) return '';
    const c = this.services.clock, p = c.pacific(t), now = c.pacific(this.getTime());
    return p.year === now.year && p.month === now.month && p.day === now.day ? fmtMinute(p.minuteOfDay) : `${p.monthName.slice(0, 3)} ${p.day}`;
  }

  // ------------------------------------------------ Talk

  /** Who is speaking for the NPC, in words, and whether Claude can answer now. */
  _engineInfo(engine) {
    if (engine === 'offline') return { ok: true, text: 'Speaking: the offline engine, in this browser (no network).' };
    const s = this.settings.get();
    const v = this.services.voice(s);
    if (!v.ok) return { ok: false, text: v.message };
    const model = (this.services.models().find(m => m.id === s.claude.model) || {}).label || s.claude.model;
    return { ok: true, text: `Speaking: ${model}, ${s.claude.proxyURL ? 'through the Legion server (the key stays there)' : 'with your API key, straight to api.anthropic.com'}.` };
  }

  _talk() {
    const offline = this.services.available('dialogue');
    const claudeWired = this.services.available('llm');
    const first = displayName(this.npc.name).split(' ')[0];
    if (!offline && !claudeWired) return placeholder('send', 'Talk', `Talking needs the offline dialogue engine or the Claude bridge, and neither is loaded in this page.`);
    const T = this.talk || (this.talk = newTalk(offline ? 'offline' : 'claude'));
    if (!offline) T.engine = 'claude';
    if (!claudeWired) T.engine = 'offline';
    const root = h('div.talk', { dataset: { engine: T.engine } });
    const log = h('div.talk-log', { role: 'log', 'aria-live': 'polite', 'aria-label': `Conversation with ${first}` });
    const input = h('textarea.talk-input', { rows: '1', placeholder: `Say something to ${first}…`, 'aria-label': 'Your message', maxlength: '600', disabled: T.ended });
    const send = h('button.btn.primary.send-btn', { type: 'submit', 'aria-label': 'Send', title: 'Send (Enter)' }, icon('send', { size: 16 }));
    const form = h('form.talk-form', input, send);
    const status = h('p.talk-status', { role: 'status' });
    this._talkUI = { root, log, input, send, status };

    // who answers
    const info = this._engineInfo(T.engine);
    const engineLine = h('p.talk-engine', { class: info.ok ? null : 'is-blocked' }, info.text,
      info.ok ? null : [' ', h('button.link-btn', { type: 'button', on: { click: () => this.deps.openSettings && this.deps.openSettings() } }, 'Open settings')]);
    if (offline && claudeWired) {
      root.append(h('div.talk-engines',
        h('div.segmented.small', { role: 'radiogroup', 'aria-label': 'Who answers' },
          ['offline', 'claude'].flatMap(k => {
            const id = `talk-engine-${k}`;
            return [h('input', { type: 'radio', name: 'talk-engine', id, checked: T.engine === k, disabled: T.busy, on: { change: () => this._switchEngine(k) } }), h('label', { for: id }, k === 'offline' ? 'Offline engine' : 'Claude')];
          })),
        engineLine));
    } else root.append(engineLine);

    for (const line of T.lines) this._bubble(line);

    // the offline engine greets as the conversation opens (not when the player switches to it mid-conversation);
    // the lines after the last divider are this conversation's, those before it earlier ones'
    const started = T.lines.slice(T.lines.map(l => l.who).lastIndexOf('divider') + 1).some(l => l.who === 'player' || l.who === 'npc');
    if (T.engine === 'offline' && !T.greeted && !T.ended && !started && this._ensureConv()) {
      T.greeted = true;
      let hello = null;
      try { hello = T.conv.greet(); this._addNpcLine(hello, 'offline'); this.services.saveMind(this.id); } catch (e) { this._systemLine(`The greeting failed: ${e && e.message ? e.message : e}`); }
      // an NPC who will not talk at all (their greeting ends it): the conversation is over before it starts
      if ((hello && hello.ended === true) || T.conv.ended === true) { T.endedByNpc = true; T.ended = true; T.farewelled = true; this._settle(T, this.id); input.disabled = true; }
    }

    form.addEventListener('submit', e => { e.preventDefault(); this._send(input.value); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._send(input.value); } });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(120, input.scrollHeight)}px`; });

    const prompts = startersFor(this.world, this.npc, { weather: this.services.weather(this.npc.zi, this.getTime()) }).filter(s => !T.used.has(s));
    // the starters sit in one scrolling row right above the input, which stays below the log rather than over it
    const starters = h('div.chip-row.starters', { role: 'group', 'aria-label': 'Conversation starters', hidden: T.ended }, prompts.map(s => h('button.chip', { type: 'button', on: { click: () => this._send(s) } }, s)));
    // a conversation the NPC ended (they declined a line and left) stays ended for this visit
    const foot = T.endedByNpc
      ? h('p.talk-note.talk-left', `${first} has left the conversation.`)
      : T.ended
        ? h('button.btn.small', { type: 'button', on: { click: () => this._restartTalk() } }, icon('reset', { size: 15 }), 'Talk again')
        : h('button.btn.ghost.small', { type: 'button', disabled: !T.lines.length, on: { click: () => this._goodbye() } }, 'Say goodbye');
    // what the clock does meanwhile (the page holds it at real time while a conversation is on screen)
    const clockNote = T.ended ? null : h('p.talk-note.talk-clock', 'While you talk, the clock runs in real time; your speed comes back when you leave.');
    root.append(log, h('div.talk-dock', starters, form, clockNote, h('div.talk-foot', status, foot)));
    return root;
  }

  _ensureConv() {
    const T = this.talk;
    if (T.conv) return true;
    const r = this.services.conversation(this.id, { t: this.getTime() });
    if (!r.ok) { this._systemLine(r.message); return false; }
    T.conv = r.value;
    return true;
  }

  _switchEngine(k) {
    const T = this.talk;
    if (!T || T.busy || T.engine === k) return;
    T.engine = k;
    this._renderTab('talk');
  }

  /** One bubble in the log; returns its element. Lines from Legion itself (errors, Claude declining) are never the NPC's. */
  _bubble(line) {
    const ui = this._talkUI;
    if (!ui) return null;
    const first = displayName(this.npc.name).split(' ')[0];
    const who = line.who === 'player' ? 'You' : line.who === 'system' ? 'Legion' : line.who === 'divider' ? '' : first;
    if (line.who === 'divider') {
      const el = h('div.talk-divider', { role: 'separator' }, line.text);
      ui.log.append(el);
      return el;
    }
    const facts = Array.isArray(line.facts) ? line.facts.filter(Boolean) : [];
    let factsEl = null;
    const factsBtn = facts.length ? h('button.fact-btn', {
      type: 'button', title: `From the data: ${facts.map(factLabel).join('; ')}`, 'aria-label': `Where this comes from (${facts.length})`, 'aria-expanded': 'false',
      on: { click: e => { const open = factsEl.hidden; factsEl.hidden = !open; e.currentTarget.setAttribute('aria-expanded', String(open)); } },
    }, icon('info', { size: 13 })) : null;
    if (facts.length) factsEl = h('ul.bubble-facts', { hidden: true }, facts.map(f => h('li', factLabel(f))));
    const el = h('div.bubble', { class: `from-${line.who}${line.error ? ' is-error' : ''}${line.note ? ' is-note' : ''}`, dataset: line.engine ? { engine: line.engine } : null },
      h('span.sr-only', `${who}: `),
      line.who === 'system' ? icon(line.note ? 'info' : 'alert', { size: 14 }) : null,
      h('p.bubble-text', line.text || ''),
      line.gloss ? h('p.bubble-gloss', `[${line.gloss}]`) : null,
      line.meta || factsBtn ? h('p.bubble-meta', line.meta || '', factsBtn) : null,
      factsEl);
    ui.log.append(el);
    requestAnimationFrame(() => { if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); });
    return el;
  }

  _addNpcLine(line, engine) {
    if (!line) return null;
    const entry = { who: 'npc', text: line.text, gloss: line.gloss || null, meta: lineMeta(line, engine), facts: line.facts || [], engine, safety: line.safety || null };
    this.talk.lines.push(entry);
    this._bubble(entry);
    // a line that steps out of the scene (someone in crisis): what Legion has to say (988, 911) is a note from Legion
    // under the NPC's line, never in the NPC's voice
    if (line.note) this._noteLine(line.note);
    return entry;
  }

  /**
   * A line from Legion itself into conversation T (default the one on screen). A conversation the player has left
   * (another NPC is open now) keeps the line in its own record, and nothing of it reaches the screen.
   */
  _systemLine(text, T = this.talk) {
    const entry = { who: 'system', text: String(text || 'Something went wrong.'), error: true };
    if (T) T.lines.push(entry);
    return T && T === this.talk ? this._bubble(entry) : null;
  }

  /** A note from Legion that is not an error (where to find help): kept in conversation T, shown when it is on screen. */
  _noteLine(text, T = this.talk) {
    const entry = { who: 'system', text: String(text), note: true };
    if (T) T.lines.push(entry);
    return T && T === this.talk ? this._bubble(entry) : null;
  }

  /**
   * The NPC ended the conversation (a line they will not answer: they decline and walk away, a child goes to find a
   * parent). It stays ended: no input, no starters and no "Talk again" in this visit; their mind keeps what was said.
   */
  _endedByNpc(T = this.talk) {
    if (!T || T.ended) return;
    if (T.conv && !T.farewelled) { try { T.conv.farewell(); T.farewelled = true; } catch { /* the mind keeps what it heard */ } }
    T.endedByNpc = true;
    this._settle(T, this.id);
    T.ended = true;
    if (T === this.talk) { this._renderTab('talk'); this._talkChanged(); }
  }

  async _send(raw) {
    const text = String(raw || '').trim();
    // the moment the offline conversation is about has passed: this line opens a new one, at the present
    if (text && this.talk && !this.talk.busy && this._talkStale()) this._resumeLater();
    const T = this.talk, ui = this._talkUI;
    if (!T || !ui || !text || T.busy || T.ended) return;
    T.used.add(text);
    const entry = { who: 'player', text };
    T.lines.push(entry); this._bubble(entry);
    ui.input.value = ''; ui.input.style.height = 'auto';
    const goodbye = ui.root.querySelector('.talk-foot .btn');
    if (goodbye) goodbye.disabled = false;
    if (T.engine === 'offline') {
      if (!this._ensureConv()) return;
      let line = null;
      try {
        line = T.conv.reply(text);
        T.offlineTurns++;
        this._addNpcLine(line, 'offline');
        this.services.saveMind(this.id);
      } catch (e) { this._systemLine(`The dialogue engine failed: ${e && e.message ? e.message : e}`); }
      if ((line && line.ended === true) || T.conv.ended === true) this._endedByNpc(T);
      return;
    }
    await this._claudeTurn(text);
  }

  /** The offline exchanges so far as the Claude history's first turns (a conversation that switches engines keeps its thread). */
  _seedHistory() {
    const T = this.talk;
    if (T.seeded) return;
    T.seeded = true;
    if (!T.history || typeof T.history.append !== 'function' || Array.isArray(T.history)) return;
    const lines = T.lines.filter(l => (l.who === 'player' || (l.who === 'npc' && l.engine === 'offline')));
    for (let i = 0; i + 1 < lines.length; i++) {
      if (lines[i].who === 'player' && lines[i + 1].who === 'npc') {
        try { T.history.append({ user: lines[i].text, assistant: lines[i + 1].text }); } catch { /* a malformed pair is skipped */ }
        i++;
      }
    }
  }

  /**
   * One Claude turn: the player's line goes into the NPC's mind, then the reply streams into a bubble. What Legion
   * itself has to say (Claude not allowed or not set up, a refusal, a failed request) goes in a system line, never
   * in the NPC's voice; a reply cut off by an error keeps what the NPC had said.
   */
  async _claudeTurn(text) {
    const T = this.talk, ui = this._talkUI, id = this.id;
    // the player may open someone else while the reply streams (leaving aborts it): from then on nothing of this
    // turn touches the panel, which shows the other conversation
    const here = () => this.talk === T && this.id === id;
    const v = this.services.voice(this.settings.get());
    if (!v.ok) { this._systemLine(v.message, T); return; }
    const time = this.getTime();
    const p = this.services.persona(id, { t: time });
    if (!p.ok) { this._systemLine(p.message, T); return; }
    const m = this.services.mind(id, { t: time });
    if (!T.history) T.history = this.services.history();
    this._seedHistory();
    // the mind hears the player in both engines (the offline Conversation does it itself)
    if (m.ok) this.services.observe(id, { kind: 'utterance', from: 'player', text, t: time });
    const entry = { who: 'npc', text: '', engine: 'claude' };
    T.lines.push(entry);
    const el = this._bubble(entry);
    el.classList.add('is-streaming');
    const textEl = el.querySelector('.bubble-text');
    const dropEmpty = () => { if (entry.text) return; el.remove(); const k = T.lines.indexOf(entry); if (k >= 0) T.lines.splice(k, 1); };
    T.busy = true; ui.send.disabled = true; ui.status.textContent = 'Claude is answering…';
    const stop = h('button.btn.ghost.small.stop-btn', { type: 'button', on: { click: () => { if (T.abort) T.abort.abort(); } } }, 'Stop');
    ui.status.after(stop);
    T.abort = typeof AbortController === 'function' ? new AbortController() : null;
    // Claude answers someone in crisis itself (the platform rules), and Legion adds the same note the offline engine
    // gives: where to call or text, under the reply
    const safety = typeof this.services.safety === 'function' ? this.services.safety(text, { age: this.npc && this.npc.age }) : null;
    let acc = '';
    try {
      const activity = this.services.activityAt(id, time);
      const result = await v.value.stream(p.value, m.ok ? m.value : null, T.history, text, {
        t: time,
        weather: this.services.weather(this.npc.zi, time),
        activity: activity.ok ? activity.value : undefined,
        signal: T.abort ? T.abort.signal : undefined,
        onText: (delta, soFar) => {
          acc = typeof soFar === 'string' ? soFar : acc + String(delta ?? '');
          entry.text = acc;
          textEl.textContent = acc;
        },
      });
      const refused = !!(result && (result.refusal || result.stopReason === 'refusal'));
      const reply = result && typeof result.text === 'string' ? result.text : acc;
      el.classList.remove('is-streaming');
      if (refused || !reply) {
        entry.text = '';
        dropEmpty();
        this._systemLine(refused ? (result.refusal && result.refusal.message) || 'Claude declined to answer that. Try another topic.' : (result && result.notice) || 'No reply came back from Claude.', T);
      } else {
        entry.text = reply; textEl.textContent = reply;
        // a voice that does not record the exchange itself: keep the history here
        if (Array.isArray(T.history) && !T.history.some(x => x && x.role === 'assistant' && x.content === reply)) T.history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
        T.claudeTurns++;
        if (m.ok) this.services.observe(id, { kind: 'utterance', from: 'self', text: reply, t: time });
        entry.meta = [result && result.model ? `${result.model}${result.fallback ? ' (fallback)' : ''}` : 'claude', result && result.cacheHit ? 'cached prefix' : null, result && result.truncated ? 'cut short at the length limit' : null].filter(Boolean).join(' · ');
        el.append(h('p.bubble-meta', entry.meta));
      }
      ui.status.textContent = '';
    } catch (e) {
      el.classList.remove('is-streaming');
      if (entry.text) { entry.meta = 'cut off'; el.append(h('p.bubble-meta', entry.meta)); }
      dropEmpty();
      // a reply cancelled because the player left goes in the old conversation's record, never on screen
      this._systemLine(e && e.message ? e.message : String(e), T);
      ui.status.textContent = '';
    } finally {
      el.classList.remove('is-streaming');
      stop.remove();
      if (safety && safety.note) this._noteLine(safety.note, T);
      T.busy = false; T.abort = null; ui.send.disabled = false;
      // settings changed while the reply streamed: the tab is redrawn now that it is in
      if (T.rerender && here() && this.tab === 'talk') { T.rerender = false; this._renderTab('talk'); }
    }
  }

  /** The NPC says goodbye (offline engine) and the conversation ends; "Talk again" starts a new one. */
  _goodbye() {
    const T = this.talk;
    if (!T || T.ended || T.busy) return;
    if (T.engine === 'offline' && this._ensureConv()) {
      try { this._addNpcLine(T.conv.farewell(), 'offline'); T.farewelled = true; } catch (e) { this._systemLine(String(e && e.message || e)); }
    }
    this._endTalk();
  }

  /** Close the conversation: the mind consolidates it (offline) and Claude's reflection is stored (Claude). */
  _endTalk() {
    const T = this.talk;
    if (!T || T.ended) return;
    this._settle(T, this.id);
    T.ended = true;
    this._renderTab('talk');
    this._talkChanged();
  }

  _restartTalk(word = 'New conversation') {
    const old = this.talk;
    const engine = old ? old.engine : 'offline';
    const next = newTalk(engine);
    next.lines = old ? old.lines.slice() : [];
    next.lines.push({ who: 'divider', text: `${word} · ${fmtMinute(this.services.clock.pacific(this.getTime()).minuteOfDay)}` });
    this.talk = next;
    this._renderTab('talk');
    this._talkChanged();
  }

  /** True when the offline conversation in progress speaks of a moment the clock has left (TALK_STALE_MIN). */
  _talkStale() {
    const T = this.talk;
    return !!(T && T.engine === 'offline' && T.conv && !T.ended && !T.busy && talkIsStale(T.conv.t, this.getTime()));
  }

  /**
   * The conversation the clock left behind ends as if the two had parted (the NPC's mind keeps it), and a new one
   * starts at the present: a divider with the time, then a fresh greeting about this moment's weather and doings.
   */
  _resumeLater() {
    const T = this.talk;
    if (!T || T.ended) return;
    if (T.conv && !T.farewelled) { try { T.conv.farewell(); T.farewelled = true; } catch { /* the mind keeps what it heard */ } }
    this._settle(T, this.id);
    T.ended = true;
    this._restartTalk('Later');
  }

  /**
   * Leaving an NPC ends the conversation: the offline NPC says goodbye (their mind records the conversation), the
   * mind consolidates it (mind.reflect), a Claude conversation is reflected into the NPC's memory (llm.reflect, in
   * the background), and the mind is saved.
   */
  _leave() {
    const T = this.talk, id = this.id;
    if (!id) return;
    if (T && !T.ended) {
      if (T.conv && !T.farewelled && (T.offlineTurns > 0 || T.greeted)) { try { T.conv.farewell(); T.farewelled = true; } catch { /* a goodbye that fails still leaves */ } }
      this._settle(T, id);
      T.ended = true;
    }
    if (T && T.abort) T.abort.abort();
    this.services.saveMind(id);
  }

  _settle(T, id) {
    const t = this.getTime();
    if (T.offlineTurns > 0 || T.farewelled) this.services.reflectOffline(id, { t });
    if (T.claudeTurns >= 1 && T.history && this.services.available('mind')) {
      const transcript = Array.isArray(T.history) ? T.history.slice() : T.history;
      this.services.reflect(id, transcript, this.settings.get(), { t }).then(r => {
        if (!r.ok && r.reason !== 'missing') toast(`Could not save the conversation to memory: ${r.message}`, { kind: 'error' });
      });
    }
    this.services.saveMind(id);
  }

  // ------------------------------------------------ Prompt

  _prompt() {
    const T = this.talk;
    const lastSaid = T ? [...T.lines].reverse().find(l => l.who === 'player') : null;
    const r = this.services.prompt(this.id, { t: this.getTime(), said: lastSaid ? lastSaid.text : '' });
    if (!r.ok) return placeholder('key', 'System prompt', r.message);
    const { blocks, text, situation } = r.value;
    const names = ['Platform rules · the same for every NPC', 'Persona sheet · this NPC'];
    const total = estimateTokens(text) + estimateTokens(situation);
    const all = `${text}${situation ? `\n\n[Situation message]\n${situation}` : ''}`;
    return h('div.prompt',
      h('p.fine', 'What Claude receives: two cached system blocks, then each player message followed by a short system message with the moment’s situation. Tokens are estimated at four characters each.'),
      h('div.btn-row',
        h('button.btn.small', { type: 'button', on: { click: () => copyWithToast(all, 'Prompt copied') } }, icon('copy', { size: 15 }), 'Copy'),
        h('span.muted.small.prompt-size', `≈ ${fmtInt(total)} tokens · ${fmtInt(all.length)} characters · ${blocks.length} system block${blocks.length === 1 ? '' : 's'}`)),
      blocks.map((b, k) => h('section.prompt-block',
        h('h3', names[k] || `Block ${k + 1}`, h('span.ranked-tag', `≈ ${fmtInt(estimateTokens(b.text))} tokens`), b.cache_control ? h('span.ranked-tag', 'cache breakpoint') : null),
        h('pre.code', b.text || ''))),
      situation ? h('section.prompt-block.situation',
        h('h3', 'Situation message · this turn', h('span.ranked-tag', `≈ ${fmtInt(estimateTokens(situation))} tokens`)),
        h('pre.code', situation)) : null);
  }

  // ------------------------------------------------ JSON

  _json() {
    const record = { npc: this.npc };
    const p = this.services.persona(this.id);
    if (p.ok) { const { npc: _npc, ...rest } = p.value; record.persona = rest; }
    const m = this.services.mind(this.id);
    if (m.ok && typeof m.value.toJSON === 'function') record.mind = m.value.toJSON();
    const text = safeJSON(record, 2);
    const ex = this.services.exportPersona(this.id, this.settings.get());
    return h('div.json',
      h('div.btn-row',
        h('button.btn.small', { type: 'button', on: { click: () => copyWithToast(text, 'JSON copied') } }, icon('copy', { size: 15 }), 'Copy'),
        h('button.btn.small', { type: 'button', on: { click: () => downloadText(`${this.id}.json`, text) } }, icon('download', { size: 15 }), 'Download'),
        ex.ok ? h('button.btn.small.export-btn', { type: 'button', title: 'The persona, the system prompt and the request settings a game engine needs (llm.exportPersona)', on: { click: () => downloadText(`${this.id}.persona.json`, safeJSON(ex.value, 2)) } }, icon('download', { size: 15 }), 'Game-engine export') : null,
        h('span.muted.small.json-size', byteSize(text))),
      h('p.fine', 'The NPC record, their persona and their mind as it stands now. The game-engine export adds the system prompt and the Claude request settings.'),
      h('pre.code.json-code', { tabindex: '0', 'aria-label': 'NPC record as JSON' }, text));
  }
}
