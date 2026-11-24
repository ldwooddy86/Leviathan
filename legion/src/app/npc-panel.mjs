// Legion · the NPC panel: one Californian, in five tabs.
//
// Profile renders the NPC record (identity, languages, household, home, work and commute, education, income).
// Mind, Talk and Prompt render what services provide (persona, mind, the offline dialogue engine, the Claude
// bridge) or say plainly that the module arrives with the next build. JSON shows the record with copy and
// download. The tabs follow the ARIA tabs pattern: arrows, Home and End move between them.

import { EVENTS } from './bus.mjs';
import { h, icon, clear, copyText, downloadText, safeJSON, toast } from './dom.mjs';
import {
  fmtInt, fmtMoney, fmtDuration, fmtMinute, daysLabel, displayName, initials, label, capitalize, roadLabel, speechWords,
  HH_TYPE, ROLE, MODE_VERB, EDUCATION, SCHOOL, STATUS, ENGLISH, MARITAL, GENERATION, LANGUAGE, OCCUPATION_GROUP, DIALECT,
} from './format.mjs';
import { meter } from './charts.mjs';

/** The tabs, in order. */
export const NPC_TABS = Object.freeze([
  { key: 'profile', label: 'Profile' },
  { key: 'mind', label: 'Mind' },
  { key: 'talk', label: 'Talk' },
  { key: 'prompt', label: 'Prompt' },
  { key: 'json', label: 'JSON' },
]);

const BIG5 = [
  ['O', 'Openness', 'Conventional', 'Curious'],
  ['C', 'Conscientiousness', 'Easygoing', 'Organized'],
  ['E', 'Extraversion', 'Reserved', 'Outgoing'],
  ['A', 'Agreeableness', 'Challenging', 'Accommodating'],
  ['N', 'Neuroticism', 'Calm', 'Sensitive'],
];
const NEEDS = ['energy', 'social', 'fun', 'comfort', 'money'];
const DRIVING = new Set(['drive', 'carpool', 'motorcycle', 'taxi']);

/** A fire as people name it: "Camp" is "the Camp Fire", "Btu Lightning Complex" keeps its own word; null if unnamed. */
export function fireName(name) {
  const n = String(name || '').trim();
  if (!n || /^unnamed\b/i.test(n)) return null;
  return /\b(fire|fires|complex|incident)$/i.test(n) ? `the ${n}` : `the ${n} Fire`;
}

/**
 * Conversation starters for one NPC, each about something the pack holds for them (CONTRACTS section 3), so a
 * starter never invites the dialogue engine or Claude to describe an event the data does not contain: work, school
 * or the days by their status; the weather, or an NWS alert active in their ZIP right now; traffic, on their own
 * highway when they drive one; food; and the most destructive fire that touched or came near their ZIP when the pack
 * records one, else how long they have lived there.
 * @param {object} world
 * @param {object} npc a layer 1 NPC
 * @param {{weather?: object|null}} [context] world.weatherAt for the NPC's ZIP at the simulated time
 * @returns {string[]}
 */
export function startersFor(world, npc, { weather = null } = {}) {
  const out = ['How’s your day going?'];
  if (npc.occupation || npc.status === 'employed' || npc.status === 'military') out.push('What do you do for work?');
  else if (npc.school || npc.status === 'student') out.push('How’s school going?');
  else if (npc.status === 'retired') out.push('What keeps you busy these days?');
  else out.push('What do you like to do around here?');
  const alert = weather && Array.isArray(weather.alerts) ? weather.alerts.find(a => a && a.event) : null;
  out.push(alert ? `Heard about the ${alert.event}?` : 'How’s the weather treating you?');
  const c = npc.commute || {};
  const road = DRIVING.has(c.mode) ? roadLabel(c.road) : null;
  out.push(road ? `How’s traffic on ${road}?` : 'What’s traffic like around here?');
  out.push('Where should I eat around here?');
  const zi = Number.isInteger(npc.zi) ? npc.zi : world.indexOf(npc.zip);
  let fire = null;
  if (zi >= 0 && typeof world.firesOf === 'function') for (const f of world.firesOf(zi)) { fire = fireName(f.name); if (fire) break; }
  out.push(fire ? `What was ${fire} like?` : 'How long have you lived here?');
  return out;
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

/** The size of text as a file (UTF-8 bytes, which is what Download writes), in words: "18,472 bytes", "1.2 MB". */
export function byteSize(text) {
  const n = new TextEncoder().encode(String(text ?? '')).length;
  if (n < 100 * 1024) return `${fmtInt(n)} bytes`;
  return n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

/** The NPC panel. */
export class NpcPanel {
  /**
   * @param {{el: HTMLElement, services: object, bus: object, settings: object, getTime: () => number,
   *   onLocate?: (npc: object) => void, onBack?: () => void, onClose?: () => void, openSettings?: () => void}} deps
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
    el.append(h('div.sheet-grip', { 'aria-hidden': 'true' }), this.head, this.tablist, this.body);
    this.bus.on(EVENTS.SETTINGS_CHANGE, ({ changed }) => {
      if (!this.id) return;
      if (changed.some(k => k.startsWith('claude') || k.startsWith('network'))) { this.rendered.delete('talk'); if (this.tab === 'talk') this._renderTab('talk'); }
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
    if (this.id && this.id !== npc.id) this._leave();   // reflect and save the conversation with the one before
    this.talk = null;
    this.id = npc.id; this.npc = npc;
    if (wantTab) this.tab = wantTab;
    this.rendered.clear();
    this._renderHead();
    this.refreshNow(this.getTime());
    this.el.hidden = false;
    this.select(this.tab, { focusTab: false });
    if (focus) this._focusName();
    return true;
  }

  _focusName() { const n = this.head.querySelector('#npc-name'); if (n) n.focus(); }

  /** Hide the panel (a Claude conversation is reflected into the NPC's memory first). */
  close() {
    if (this.el.hidden) return;
    this._leave();
    this.el.hidden = true;
    this.id = null; this.npc = null;
    this.talk = null;   // reflected and saved by _leave(): a new visit starts a new conversation
    if (this.deps.onClose) this.deps.onClose();
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
    if (!this.rendered.has(key)) this._renderTab(key);
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
    clear(this.head).append(
      h('button.icon-btn.npc-back', { type: 'button', 'aria-label': 'Back to the place', title: 'Back to the place', on: { click: () => this.deps.onBack && this.deps.onBack() } }, icon('back')),
      h('span.avatar', { 'aria-hidden': 'true' }, initials(name)),
      h('div.npc-title',
        h('h2.npc-name#npc-name', { tabindex: '-1' }, name),
        h('p.npc-meta', h('span.npc-age', { 'aria-label': `age ${npc.age}` }, String(npc.age)), npc.pronouns ? ` · ${npc.pronouns}` : '', npc.heritageLabel ? ` · ${npc.heritageLabel}` : ''),
        h('p.npc-id.mono', npc.id),
        this.nowEl = h('p.npc-now', { hidden: true, 'aria-live': 'off' })),
      h('div.head-actions',
        h('button.icon-btn', { type: 'button', 'aria-label': 'Show home and work on the map', title: 'Show on the map', on: { click: () => this.deps.onLocate && this.deps.onLocate(npc) } }, icon('locate')),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Close NPC', title: 'Close (Esc)', on: { click: () => this.close() } }, icon('close'))));
  }

  /**
   * Refresh the "right now" line from the schedule (when wired) for simulated time t; returns the activity or null.
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

  _renderTab(key) {
    const panel = this.panels[key];
    if (!this.npc) return;
    let content;
    try {
      content = key === 'profile' ? this._profile() : key === 'mind' ? this._mind() : key === 'talk' ? this._talk() : key === 'prompt' ? this._prompt() : this._json();
    } catch (e) {
      console.error(`[legion] ${key} tab failed`, e);
      content = placeholder('alert', 'This tab could not be drawn', String(e && e.message || e));
    }
    clear(panel).append(content);
    this.rendered.add(key);
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

    const members = (hh.members || []).map(m => {
      const mname = typeof m.name === 'object' ? displayName(m.name) : (m.name || 'Member');
      const self = m.m === n.m;
      const text = [h('span.member-name', mname), h('span.member-meta', `${label(ROLE, m.role)} · ${m.age}`)];
      return h('li', self
        ? h('div.member.is-self', { 'aria-current': 'true' }, ...text, h('span.member-self', 'this NPC'))
        : h('button.member', { type: 'button', 'aria-label': `Open ${mname}, ${label(ROLE, m.role).toLowerCase()}, ${m.age}`, on: { click: () => this.bus.emit(EVENTS.NPC_SELECT, { id: `${hh.id || n.hid}-${m.m}`, source: 'household' }) } }, ...text));
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
        row('Home', [homePhrase(hh.tenure, hh.dwelling), h('span.dd-sub', [hh.yearBuilt ? `built ${hh.yearBuilt}` : null, hh.yearMoved ? `moved in ${hh.yearMoved}` : null, Number.isFinite(hh.vehicles) ? `${hh.vehicles} vehicle${hh.vehicles === 1 ? '' : 's'}` : null].filter(Boolean).join(' · '))]),
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
    const p = this.services.persona(this.id);
    const m = this.services.mind(this.id, { t: this.getTime() });
    if (!p.ok && !m.ok) {
      return placeholder('people', 'Personality and mind', p.reason === 'missing' ? `${p.message} Each NPC will carry Big Five traits, values, interests, concerns drawn from their ZIP’s data (insurance, fire, heat, rent, the commute), memories of the real fires and storms that happened while they lived there, a mood, needs and a relationship with you.` : p.message);
    }
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
    if (p.big5) s.push(h('section.p-section', h('h3', 'Personality'), h('div.meters', BIG5.map(([k, name, lo, hi]) => (Number.isFinite(p.big5[k]) ? meter(name, p.big5[k], { low: lo, high: hi }) : null)))));
    if (p.traits && p.traits.length) s.push(h('section.p-section', h('h3', 'Traits'), chips(p.traits)));
    if (p.values && p.values.length) s.push(h('section.p-section', h('h3', 'Values'), chips(p.values)));
    if (p.residence && Number.isFinite(p.residence.zipSince)) {
      const r = p.residence, z = this.npc.zip;
      s.push(h('p.residence', [r.bornHere ? `Born here` : r.grewUpHere ? 'Grew up in the county' : null, `in ${z} since ${r.zipSince}`, Number.isFinite(r.countySince) && r.countySince < r.zipSince ? `in the county since ${r.countySince}` : null].filter(Boolean).join(' · ')));
    }
    if (p.interests && p.interests.length) {
      const why = new Map((p.interestDetails || []).map(d => [d.name, d.why]));
      s.push(h('section.p-section', h('h3', 'Interests'),
        h('ul.reasons', p.interests.map(i => { const name = typeof i === 'string' ? i : (i.name || i.label); return h('li', h('span.reason-name', capitalize(name)), why.get(name) ? h('span.reason-why', why.get(name)) : null); }))));
    }
    if (p.teams && p.teams.length) s.push(h('section.p-section', h('h3', 'Roots for'), chips(p.teams.map(tm => (typeof tm === 'string' ? tm : `${tm.name}${tm.sport ? ` · ${tm.sport}` : ''}`)))));
    if (p.concerns && p.concerns.length) {
      s.push(h('section.p-section', h('h3', 'Concerns'), h('ul.concerns', p.concerns.slice(0, 6).map(c => h('li',
        h('div.concern-head', h('span.concern-topic', capitalize(c.topic || String(c))), Number.isFinite(c.weight) ? h('span.concern-weight', `${Math.round(c.weight * 100)}`) : null),
        c.why ? h('div.concern-why', c.why) : null)))));
    }
    if (p.memories && p.memories.length) {
      s.push(h('section.p-section', h('h3', 'Memories'), h('ol.timeline', p.memories.slice(0, 8).map(mem => h('li',
        h('span.tl-year', String(mem.year || (mem.date || '').slice(0, 4) || '')),
        h('span.tl-text', mem.text || ''),
        mem.source ? h('span.tl-source', mem.source) : null)))));
    }
    const sp = p.speech;
    if (sp) {
      const cs = sp.codeSwitch && sp.codeSwitch.lang ? `switches into ${label(LANGUAGE, sp.codeSwitch.lang)}${Number.isFinite(sp.codeSwitch.rate) ? ` about ${Math.round(sp.codeSwitch.rate * 100)}% of the time` : ''}` : null;
      const region = sp.dialect && this.world.regionByKey ? this.world.regionByKey[sp.dialect] : null;
      const dialect = sp.dialect ? (region ? region.name : label(DIALECT, sp.dialect)) : null;
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
      s.push(h('section.p-section', h('h3', 'Right now'), h('dl.dl',
        row('Feeling', emotion ? capitalize(String(emotion)) : null),
        Number.isFinite(mood.valence) ? row('Mood', `${mood.valence >= 0 ? 'positive' : 'negative'} (${mood.valence.toFixed(2)}), ${Number.isFinite(mood.arousal) ? (mood.arousal > 0.5 ? 'energized' : 'calm') : ''}`.replace(/, $/, '')) : null)));
    }
    if (st.needs) s.push(h('section.p-section', h('h3', 'Needs'), h('div.meters', NEEDS.map(k => (Number.isFinite(st.needs[k]) ? meter(capitalize(k), st.needs[k], { slot: 3 }) : null)))));
    const rel = st.relationships && st.relationships.player;
    let feelings = null;
    try { feelings = typeof mind.feelingsToward === 'function' ? mind.feelingsToward('player') : null; } catch { feelings = null; }
    if (rel || feelings) {
      s.push(h('section.p-section', h('h3', 'With you'),
        typeof feelings === 'string' ? h('p.feelings', `Feels ${feelings} toward you${rel && rel.met ? '' : ' (you have not met yet)'}.`) : null,
        rel ? h('div.meters', ['affinity', 'trust', 'familiarity'].map(k => (Number.isFinite(rel[k]) ? meter(capitalize(k), (rel[k] + (k === 'familiarity' ? 0 : 1)) / (k === 'familiarity' ? 1 : 2), { slot: 2 }) : null))) : null,
        rel && rel.facts && rel.facts.length ? h('ul.hooks', rel.facts.slice(-5).map(f => h('li', typeof f === 'string' ? f : (f.text || JSON.stringify(f))))) : null));
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

  _talk() {
    const offline = this.services.available('dialogue');
    const claudeWired = this.services.available('llm');
    if (!offline && !claudeWired) {
      return placeholder('send', 'Talk', `The dialogue engine arrives with the next build. When it lands, ${displayName(this.npc.name).split(' ')[0]} will answer in their own regional voice, offline, and with Claude when you allow it.`);
    }
    const t = this.talk || (this.talk = { engine: offline ? 'offline' : 'claude', conv: null, history: [], lines: [], busy: false, ended: false });
    const root = h('div.talk');
    const log = h('div.talk-log', { role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
    const input = h('textarea.talk-input', { rows: '1', placeholder: `Say something to ${displayName(this.npc.name).split(' ')[0]}…`, 'aria-label': 'Your message', maxlength: '600' });
    const send = h('button.btn.primary.send-btn', { type: 'submit', 'aria-label': 'Send' }, icon('send', { size: 16 }));
    const form = h('form.talk-form', input, send);
    const status = h('p.talk-status', { role: 'status' });

    // engine choice
    if (offline && claudeWired) {
      const voice = this.services.voice(this.settings.get());
      root.append(h('div.talk-engines',
        h('div.segmented.small', { role: 'radiogroup', 'aria-label': 'Who answers' },
          ['offline', 'claude'].flatMap(k => {
            const id = `talk-engine-${k}`;
            return [h('input', { type: 'radio', name: 'talk-engine', id, checked: t.engine === k, on: { change: () => { t.engine = k; this._renderTab('talk'); } } }), h('label', { for: id }, k === 'offline' ? 'Offline engine' : 'Claude')];
          })),
        t.engine === 'claude' && !voice.ok ? h('p.talk-note', voice.message, ' ', h('button.link-btn', { type: 'button', on: { click: () => this.deps.openSettings && this.deps.openSettings() } }, 'Open settings')) : null));
    } else if (!offline) {
      t.engine = 'claude';
      const voice = this.services.voice(this.settings.get());
      root.append(h('p.talk-note', 'The offline engine arrives with the next build; Claude answers for now.', voice.ok ? null : [' ', voice.message, ' ', h('button.link-btn', { type: 'button', on: { click: () => this.deps.openSettings && this.deps.openSettings() } }, 'Open settings')]));
    } else {
      root.append(h('p.talk-note', 'Offline engine: no network. Claude joins once the Claude bridge is wired.'));
    }

    // three voices in the log: the player, the NPC, and Legion itself (errors, Claude declining), which is never
    // dressed as the NPC: screen readers hear "Legion:", not the character's name
    const firstName = displayName(this.npc.name).split(' ')[0];
    const bubble = line => {
      const who = line.who === 'player' ? 'You' : line.who === 'system' ? 'Legion' : firstName;
      const el = h('div.bubble', { class: `from-${line.who}${line.error ? ' is-error' : ''}` },
        h('span.sr-only', `${who}: `),
        line.who === 'system' ? icon('alert', { size: 14 }) : null,
        h('p.bubble-text', line.text || ''),
        line.gloss ? h('p.bubble-gloss', `[${line.gloss}]`) : null,
        line.meta ? h('p.bubble-meta', line.meta) : null);
      log.append(el);
      requestAnimationFrame(() => { if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); });
      return el;
    };
    for (const line of t.lines) bubble(line);

    const addNpcLine = line => {
      if (!line) return;
      const meta = [line.emotion, line.intent && line.intent !== 'unknown' ? line.intent : null].filter(Boolean).join(' · ');
      const entry = { who: 'npc', text: line.text, gloss: line.gloss, meta };
      t.lines.push(entry);
      bubble(entry);
    };
    const systemLine = text => {
      const entry = { who: 'system', text: String(text || 'Something went wrong.'), error: true };
      t.lines.push(entry);
      return bubble(entry);
    };

    const ensureConv = () => {
      if (t.conv) return true;
      const r = this.services.conversation(this.id, { t: this.getTime() });
      if (!r.ok) { status.textContent = r.message; return false; }
      t.conv = r.value;
      return true;
    };

    if (t.engine === 'offline' && !t.lines.length && ensureConv()) {
      try { addNpcLine(t.conv.greet()); this.services.saveMind(this.id); } catch (e) { status.textContent = `The greeting failed: ${e.message || e}`; }
    }

    const sendText = async text => {
      text = String(text || '').trim();
      if (!text || t.busy) return;
      const entry = { who: 'player', text };
      t.lines.push(entry); bubble(entry);
      input.value = '';
      if (t.engine === 'offline') {
        if (!ensureConv()) return;
        try { addNpcLine(t.conv.reply(text)); this.services.saveMind(this.id); } catch (e) { systemLine(`The dialogue engine failed: ${e && e.message ? e.message : e}`); }
        return;
      }
      await this._claudeTurn(t, text, { bubble, systemLine, status, send });
    };

    form.addEventListener('submit', e => { e.preventDefault(); sendText(input.value); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(input.value); } });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(120, input.scrollHeight)}px`; });

    const prompts = startersFor(this.world, this.npc, { weather: this.services.weather(this.npc.zi, this.getTime()) });
    const starters = h('div.chip-row.starters', { 'aria-label': 'Conversation starters' }, prompts.map(s => h('button.chip', { type: 'button', on: { click: () => sendText(s) } }, s)));
    const goodbye = t.engine === 'offline' ? h('button.btn.ghost.small', { type: 'button', on: { click: () => { if (ensureConv() && typeof t.conv.farewell === 'function') { try { addNpcLine(t.conv.farewell()); this.services.saveMind(this.id); } catch (e) { status.textContent = String(e.message || e); } } } } }, 'Say goodbye') : null;
    root.append(log, starters, form, h('div.talk-foot', status, goodbye));
    return root;
  }

  /**
   * One Claude turn: stream the NPC's reply into a bubble. What Legion itself has to say (Claude not allowed or not
   * set up, a refusal, a failed request) goes in a system line, never in the NPC's voice; a reply cut off by an
   * error keeps what the NPC had said.
   */
  async _claudeTurn(t, text, { bubble, systemLine, status, send }) {
    const v = this.services.voice(this.settings.get());
    if (!v.ok) { systemLine(v.message); return; }
    const p = this.services.persona(this.id);
    if (!p.ok) { systemLine(p.message); return; }
    const m = this.services.mind(this.id, { t: this.getTime() });
    const entry = { who: 'npc', text: '' };
    t.lines.push(entry);
    const el = bubble(entry);
    el.classList.add('is-streaming');
    const textEl = el.querySelector('.bubble-text');
    // the streaming bubble belongs to the NPC only once they say something; otherwise it gives way to a system line
    const dropEmpty = () => { if (entry.text) return; el.remove(); const k = t.lines.indexOf(entry); if (k >= 0) t.lines.splice(k, 1); };
    t.busy = true; send.disabled = true; status.textContent = 'Claude is answering…';
    let acc = '';
    const time = this.getTime();
    const before = t.history.length;
    try {
      const activity = this.services.activityAt(this.id, time);
      // the voice appends the finished exchange to this same array (with its situation note), so pass it as is
      const result = await v.value.stream(p.value, m.ok ? m.value : null, t.history, text, {
        t: time,
        weather: this.services.weather(this.npc.zi, time),
        activity: activity.ok ? activity.value : undefined,
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
        systemLine(refused ? 'Claude declined to answer that. Try another topic.' : 'No reply came back from Claude.');
      } else {
        entry.text = reply; textEl.textContent = reply;
        // a voice that does not record the exchange itself: keep the history here
        if (t.history.length === before) t.history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
        t.claudeTurns = (t.claudeTurns || 0) + 1;
        this.services.saveMind(this.id);
        entry.meta = [result && result.model ? `${result.model}${result.fallback ? ' (fallback)' : ''}` : null, result && result.truncated ? 'cut short at the length limit' : null].filter(Boolean).join(' · ');
        if (entry.meta) el.append(h('p.bubble-meta', entry.meta));
      }
      status.textContent = '';
    } catch (e) {
      el.classList.remove('is-streaming');
      if (entry.text) { entry.meta = 'cut off'; el.append(h('p.bubble-meta', entry.meta)); }
      dropEmpty();
      systemLine(e && e.message ? e.message : String(e));
      status.textContent = '';
    } finally {
      el.classList.remove('is-streaming');
      t.busy = false; send.disabled = false;
    }
  }

  /** Leaving an NPC: reflect a Claude conversation into their mind (in the background) and save it. */
  _leave() {
    const t = this.talk, id = this.id;
    if (!id) return;
    this.services.saveMind(id);
    if (t && t.claudeTurns >= 2 && this.services.available('mind')) {
      this.services.reflect(id, t.history.slice(), this.settings.get(), { t: this.getTime() }).then(r => {
        if (!r.ok && r.reason !== 'missing') toast(`Could not save the conversation to memory: ${r.message}`, { kind: 'error' });
      });
    }
  }

  // ------------------------------------------------ Prompt

  _prompt() {
    const r = this.services.prompt(this.id);
    if (!r.ok) {
      return placeholder('key', 'System prompt', r.reason === 'missing'
        ? `${r.message} It turns this NPC’s persona into the prompt Claude speaks from: shared platform rules first, then this NPC’s persona sheet (cached per NPC), with the moment’s weather, mood and memories added each turn.`
        : r.message);
    }
    const { blocks, text } = r.value;
    const names = ['Platform rules · shared by every NPC', 'Persona sheet · cached per NPC'];
    return h('div.prompt',
      h('div.btn-row',
        h('button.btn.small', { type: 'button', on: { click: () => copyWithToast(text, 'Prompt copied') } }, icon('copy', { size: 15 }), 'Copy'),
        h('span.muted.small', `${fmtInt(text.length)} characters · ${blocks.length} block${blocks.length === 1 ? '' : 's'}`)),
      blocks.map((b, k) => h('section.prompt-block',
        h('h3', names[k] || `Block ${k + 1}`, b.cache_control ? h('span.ranked-tag', 'cached') : null),
        h('pre.code', b.text || ''))));
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
        ex.ok ? h('button.btn.small', { type: 'button', on: { click: () => downloadText(`${this.id}.persona.json`, safeJSON(ex.value, 2)) } }, icon('download', { size: 15 }), 'Game-engine export') : null,
        h('span.muted.small.json-size', byteSize(text))),
      h('pre.code.json-code', { tabindex: '0', 'aria-label': 'NPC record as JSON' }, text));
  }
}
