// Legion · the Place panel: a ZIP, city, county or region and the data behind its people.
//
// Totals and medians from the atlas columns; languages, heritage and the commute mix from the Census blocks;
// the weather at the simulated time from the NWS snapshot; twelve residents to meet; and, when the population
// can report it, Census versus generated fidelity bars for the ZIP.

import { EVENTS } from './bus.mjs';
import { h, icon, clear } from './dom.mjs';
import { fmtInt, fmtMoney, fmtPct, fmtCompact, displayName, initials, label, capitalize, STATUS, OCCUPATION_GROUP } from './format.mjs';
import { placeStats } from './census.mjs';
import { rankedBars, segmentedBar, pairedBars, pairedLegend } from './charts.mjs';

const KIND_WORD = { zip: 'ZIP code', city: 'City', county: 'County', region: 'Region' };
const idle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 600 }) : setTimeout(fn, 60));

/** One line about a resident for the list: occupation, school or status. */
export function residentLine(npc) {
  const occ = npc.occupation;
  if (occ && (occ.title || occ.key)) return occ.title && occ.title !== occ.key ? capitalize(occ.title) : label(OCCUPATION_GROUP, occ.key);
  if (npc.school) return { preschool: 'Preschool', elementary: 'Elementary school', middle: 'Middle school', high: 'High school', college: 'College student', grad: 'Graduate student' }[npc.school] || 'Student';
  return label(STATUS, npc.status, '');
}

/** The Place panel. */
export class PlacePanel {
  /**
   * @param {{el: HTMLElement, services: object, bus: object, getTime: () => number,
   *   onStreetView?: (scope: object) => void, onClose?: () => void}} deps
   */
  constructor({ el, services, bus, getTime, onStreetView, onClose }) {
    this.el = el; this.services = services; this.bus = bus; this.getTime = getTime;
    this.onStreetView = onStreetView; this.onClose = onClose;
    this.world = services.world;
    this.scope = null; this.seed = 1; this._hour = null; this._token = 0;
    el.classList.add('panel', 'place-panel');
    el.setAttribute('aria-labelledby', 'place-title');
    el.hidden = true;
    this.head = h('header.panel-head');
    this.body = h('div.panel-body');
    el.append(h('div.sheet-grip', { 'aria-hidden': 'true' }), this.head, this.body);
    bus.on(EVENTS.TIME_CHANGE, ({ t }) => this._onTime(t));
  }

  /** True while showing a place. */
  isOpen() { return !this.el.hidden; }

  /** Show a scope (see census.mjs). */
  open(scope) {
    if (!scope) return this.close();
    const same = this.scope && this.scope.kind === scope.kind && this.scope.key === scope.key;
    this.scope = scope;
    if (!same) this.seed = 1;
    this.el.hidden = false;
    this.render();
  }

  /** Hide the panel. */
  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.scope = null;
    this._token++;
    if (this.onClose) this.onClose();
  }

  render() {
    const scope = this.scope, w = this.world;
    if (!scope) return;
    const token = ++this._token;
    const stats = placeStats(w, scope);
    const zi = scope.kind === 'zip' ? scope.zi : this._mainZip(scope);
    clear(this.head).append(
      h('div.panel-title-block',
        h('div.eyebrow', KIND_WORD[scope.kind] || 'Place'),
        h('h2.panel-title#place-title', scope.title),
        h('p.panel-sub', scope.subtitle)),
      h('div.head-actions',
        h('button.icon-btn', { type: 'button', 'aria-label': 'Close place', title: 'Close (Esc)', on: { click: () => this.close() } }, icon('close'))));

    const weather = h('div.weather-slot');
    this._weatherEl = weather;
    this._renderWeather(zi);

    const residents = h('ul.resident-list', { 'aria-label': 'Residents' });
    const sections = [
      weather,
      this._statGrid(stats, scope),
      h('section.p-section.residents',
        h('div.section-head', h('h3', 'Meet the residents'),
          h('button.btn.ghost.small', { type: 'button', title: 'Meet twelve more', on: { click: () => { this.seed++; this._fillResidents(residents); } } }, icon('shuffle', { size: 15 }), 'Others')),
        residents),
      stats.languages.length ? h('section.p-section',
        h('div.section-head', h('h3', 'Languages at home'), h('span.section-note', 'people 5+')),
        rankedBars(stats.languages.slice(0, 6), {
          ariaLabel: 'Languages spoken at home',
          note: r => r.key !== 'english' && r.lepShare !== null && r.lepShare >= 1 ? `${fmtPct(r.lepShare)} of them speak English less than very well` : null,
        })) : null,
      stats.heritage.length ? h('section.p-section',
        h('div.section-head', h('h3', 'Heritage'), h('span.section-note', 'share of residents')),
        rankedBars(stats.heritage.slice(0, 8), { ariaLabel: 'Heritage reported to the Census', tag: r => r.family }),
        h('p.fine', 'Hispanic origin, Asian group and race tables, plus up to two reported ancestries per person, so groups overlap.')) : null,
      stats.commute.workers ? h('section.p-section',
        h('div.section-head', h('h3', 'Getting to work'), h('span.section-note', `${fmtCompact(stats.commute.workers)} workers`)),
        segmentedBar(stats.commute.groups, { ariaLabel: 'How workers commute' })) : null,
    ];
    this._fidelitySlot = h('div.fidelity-slot');
    sections.push(this._fidelitySlot);
    if (scope.zis.length > 1) sections.push(this._zipChips(scope));
    sections.push(this._streetBlock(scope));
    sections.push(h('p.fine.sources', 'Census ACS 2020–2024 by ZIP; atlas columns for income, home value and density; weather from the NWS snapshot in the pack.'));
    clear(this.body).append(...sections.filter(Boolean));
    this.body.scrollTop = 0;
    this._fillResidents(residents);
    if (scope.kind === 'zip') idle(() => { if (token === this._token) this._renderFidelity(scope.zi, token); });
  }

  _mainZip(scope) {
    let best = scope.zis[0], bp = -1;
    for (const i of scope.zis) { const p = this.world.z.pop[i] || 0; if (p > bp) { bp = p; best = i; } }
    return best;
  }

  _statGrid(s, scope) {
    const tile = (lbl, value, title) => h('div.stat', { title: title || null }, h('div.stat-label', lbl), h('div.stat-value', value));
    const med = s.weighted ? ' (ZIP medians, weighted)' : '';
    return h('div.stat-grid',
      tile('People', fmtInt(s.pop)),
      tile('Households', fmtInt(s.hh), s.hhSize ? `${s.hhSize.toFixed(2)} people per household` : null),
      tile('Median age', Number.isFinite(s.ageMedian) ? s.ageMedian.toFixed(1) : '—', med ? 'Median age' + med : null),
      tile('Income', fmtMoney(s.income), 'Median household income' + med),
      tile('Home value', fmtMoney(s.value, { compact: true }), 'Median home value' + med),
      tile('Owners', fmtPct(s.ownShare), `${scope.kind === 'zip' ? '' : 'Across all ZIPs: '}share of households that own their home`));
  }

  _renderWeather(zi) {
    const el = this._weatherEl;
    if (!el) return;
    const t = this.getTime();
    this._hour = Math.floor(t / 3600000);
    const wx = this.services.weather(zi, t);
    clear(el);
    if (!wx || !wx.now) return;
    const now = wx.now;
    const z = this.world.zip(zi);
    const alerts = (wx.alerts || []).slice(0, 3);
    el.append(h('div.weather', { class: wx.stale ? 'is-stale' : null },
      h('div.wx-now',
        h('span.wx-temp', Number.isFinite(now.tempF) ? `${now.tempF}°F` : '—'),
        h('span.wx-short', now.short || ''),
        h('span.wx-where', wx.stale ? 'Climate estimate (past the forecast)' : `NWS ${wx.point || wx.office || ''}${this.scope && this.scope.zis.length > 1 ? ` · ${z.city}` : ''}`)),
      wx.period && !wx.stale && wx.period.detail ? h('p.wx-detail', `${wx.period.name}: ${wx.period.detail}`) : null,
      alerts.length ? h('ul.wx-alerts', { 'aria-label': 'Weather alerts' }, alerts.map(a => h('li', { class: `sev-${String(a.severity || '').toLowerCase()}` }, icon('alert', { size: 14 }), h('span', a.event)))) : null,
      wx.fireWeather && wx.fireWeather.level > 0 ? h('p.wx-fire', icon('alert', { size: 14 }), `Fire weather: ${wx.fireWeather.name}`) : null));
  }

  _onTime(t) {
    if (!this.scope || this.el.hidden) return;
    const hour = Math.floor(t / 3600000);
    if (hour !== this._hour) this._renderWeather(this.scope.kind === 'zip' ? this.scope.zi : this._mainZip(this.scope));
  }

  _fillResidents(list) {
    clear(list);
    let people = [];
    try { people = this.services.residents(this.scope, 12, this.seed); } catch (e) { console.error('[legion] residents failed', e); }
    if (!people.length) { list.append(h('li.muted', 'No households are recorded here.')); return; }
    for (const npc of people) {
      const name = displayName(npc.name);
      list.append(h('li', h('button.resident', { type: 'button', 'aria-label': `Open ${name}, ${npc.age}`, dataset: { id: npc.id }, on: { click: () => this.bus.emit(EVENTS.NPC_SELECT, { id: npc.id, source: 'place' }) } },
        h('span.avatar.small', { 'aria-hidden': 'true' }, initials(name)),
        h('span.resident-text',
          h('span.resident-name', name),
          h('span.resident-meta', [String(npc.age), residentLine(npc)].filter(Boolean).join(' · '))),
        h('span.resident-tag', npc.heritageLabel || ''))));
    }
  }

  _renderFidelity(zi, token) {
    const result = this.services.validate(zi, 600);
    if (!result || token !== this._token) return;
    const shareTables = result.tables.filter(t => t.kind === 'shares').length;
    clear(this._fidelitySlot).append(h('section.p-section.fidelity',
      h('div.section-head', h('h3', 'Census versus generated'), h('span.section-note', `${fmtInt(result.households)} households`)),
      pairedLegend(),
      result.tables.map(t => t.kind === 'value'
        ? h('div.fid-value', h('span', t.label), h('span.mono', `${round(t.acs)} · ${round(t.gen)}`))
        : h('div.fid-table', h('h4', t.label, h('span.fid-gap', `mean gap ${t.meanGap.toFixed(1)} pts`)), pairedBars(t.rows, { ariaLabel: `${t.label}: Census versus generated` }))),
      shareTables ? h('p.fine', 'Generated from the same seed the crowd uses; every NPC on the map comes from these households.') : null));
  }

  _zipChips(scope) {
    const top = [...scope.zis].sort((a, b) => (this.world.z.pop[b] || 0) - (this.world.z.pop[a] || 0));
    const shown = top.slice(0, 36);
    return h('section.p-section',
      h('div.section-head', h('h3', 'ZIP codes'), h('span.section-note', `${scope.zis.length} by population`)),
      h('div.chip-row', shown.map(i => h('button.chip', { type: 'button', on: { click: () => this.bus.emit(EVENTS.PLACE_SELECT, { zi: i, kind: 'zip', key: this.world.zips[i], source: 'place' }) } }, this.world.zips[i]))),
      top.length > shown.length ? h('p.fine', `and ${top.length - shown.length} more`) : null);
  }

  _streetBlock(scope) {
    const ready = this.services.available('street');
    return h('section.p-section.street-block',
      h('button.btn.wide', { type: 'button', disabled: !ready, 'aria-describedby': ready ? null : 'street-note', on: { click: () => { if (ready && this.onStreetView) this.onStreetView(scope); } } }, icon('street', { size: 16 }), `Walk the streets of ${scope.kind === 'zip' ? scope.key : scope.title}`),
      ready ? null : h('p.fine#street-note', 'Street view arrives with the next build: residents walking the sidewalks and driving the streets, chatting as they pass.'));
  }
}

function round(v) { return Math.abs(v) >= 100 ? Math.round(v).toString() : (+v.toFixed(2)).toString(); }
