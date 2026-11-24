// Legion · the Place panel: a ZIP, city, county or region and the data behind its people.
//
// Totals and medians from the atlas columns; languages, heritage and the commute mix from the Census blocks;
// the weather at the simulated time (the NWS snapshot in the pack, or live from api.weather.gov when Settings allows
// it, with a note saying which and why); twelve residents to meet; the street view; and, when the population can
// report it, Census versus generated fidelity bars for the ZIP.

import { EVENTS } from './bus.mjs';
import { h, icon, clear, sheetGrip } from './dom.mjs';
import { fmtInt, fmtMoney, fmtPct, fmtCompact, displayName, initials, label, capitalize, STATUS, OCCUPATION_GROUP } from './format.mjs';
import { placeTotals, placeMixes, fidelityValueText } from './census.mjs';
import { rankedBars, segmentedBar, pairedBars, pairedLegend } from './charts.mjs';
import { cleanForecastText, alertsForZip } from './nws-live.mjs';

const KIND_WORD = { zip: 'ZIP code', place: 'City', city: 'Postal city', county: 'County', region: 'Region', neighborhood: 'Neighborhood' };
const idle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 600 }) : setTimeout(fn, 60));
/** Households the fidelity check generates per ZIP (fewer when the ZIP has fewer). */
const FIDELITY_HOUSEHOLDS = 600;
/** Below this many households the comparison is noisy, and the panel says so. */
const SMALL_SAMPLE = 100;

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
   *   onStreetView?: (scope: object) => void, onNow?: () => void, onClose?: () => void}} deps onNow sets the clock to
   *   the present (offered when the live forecast does not cover the simulated time)
   */
  constructor({ el, services, bus, getTime, onStreetView, onNow, onClose, onResize }) {
    this.el = el; this.services = services; this.bus = bus; this.getTime = getTime;
    this.onStreetView = onStreetView; this.onNow = onNow; this.onClose = onClose; this.onResize = onResize;
    this.world = services.world;
    this.scope = null; this.seed = 1; this._hour = null; this._token = 0;
    el.classList.add('panel', 'place-panel');
    el.setAttribute('aria-labelledby', 'place-title');
    el.hidden = true;
    this.head = h('header.panel-head');
    this.body = h('div.panel-body');
    el.append(sheetGrip(el, { label: 'place', onChange: () => { if (this.onResize) this.onResize(); } }), this.head, this.body);
    bus.on(EVENTS.TIME_CHANGE, ({ t }) => this._onTime(t));
    // live weather arrived (or failed, or was switched): redraw the weather of the place shown
    bus.on(EVENTS.WEATHER_CHANGE, ({ zi } = {}) => {
      if (!this.scope || this.el.hidden) return;
      const main = this.scope.kind === 'zip' ? this.scope.zi : this._mainZip(this.scope);
      if (zi === -1 || zi === main) this._renderWeather(main);
    });
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
    // the totals now; the Census mixes (every ACS row of a big scope: a third of a second for Los Angeles) a moment
    // later, so the panel and its weather paint at once (ux-1027)
    const stats = placeTotals(w, scope);
    const zi = scope.kind === 'zip' ? scope.zi : this._mainZip(scope);
    clear(this.head).append(
      h('div.panel-title-block',
        h('div.eyebrow', scope.eyebrow || KIND_WORD[scope.kind] || 'Place'),
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
      this._mixSlot = h('div.mix-slot', { 'aria-busy': 'true' }),
    ];
    this._fidelitySlot = h('div.fidelity-slot');
    sections.push(this._fidelitySlot);
    if (scope.zis.length > 1) sections.push(this._zipChips(scope));
    sections.push(this._streetBlock(scope));
    sections.push(h('p.fine.sources', 'Census ACS 2020–2024 by ZIP; atlas columns for income, home value and density; weather from the NWS snapshot in the pack, or live from api.weather.gov when Settings allows it.'));
    clear(this.body).append(...sections.filter(Boolean));
    this.body.scrollTop = 0;
    this._fillResidents(residents);
    const slot = this._mixSlot;
    const fillMixes = () => { if (token === this._token) this._renderMixes(slot, placeMixes(w, scope)); };
    if (scope.zis.length <= 3) fillMixes(); else idle(fillMixes);
    if (scope.kind === 'zip') idle(() => { if (token === this._token) this._renderFidelity(scope.zi, token); });
  }

  /** The languages, heritage and commute sections of a scope (placeMixes) into their slot. */
  _renderMixes(slot, mix) {
    if (!slot || !mix) return;
    slot.removeAttribute('aria-busy');
    clear(slot).append(...[
      mix.languages.length ? h('section.p-section',
        h('div.section-head', h('h3', 'Languages at home'), h('span.section-note', 'people 5+')),
        rankedBars(mix.languages.slice(0, 6), {
          ariaLabel: 'Languages spoken at home',
          note: r => r.key !== 'english' && r.lepShare !== null && r.lepShare >= 1 ? `${fmtPct(r.lepShare)} of them speak English less than very well` : null,
        })) : null,
      mix.heritage.length ? h('section.p-section',
        h('div.section-head', h('h3', 'Heritage'), h('span.section-note', 'share of residents')),
        rankedBars(mix.heritage.slice(0, 8), { ariaLabel: 'Heritage reported to the Census', tag: r => r.family }),
        h('p.fine', 'Hispanic origin, Asian group and race tables, plus up to two reported ancestries per person, so groups overlap.')) : null,
      mix.commute.workers ? h('section.p-section',
        h('div.section-head', h('h3', 'Getting to work'), h('span.section-note', `${fmtCompact(mix.commute.workers)} workers`)),
        segmentedBar(mix.commute.groups, { ariaLabel: 'How workers commute' })) : null,
    ].filter(Boolean));
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
    // alerts are issued for whole zones and counties: a shore-only one is not shown far inland (the NPCs' own rule)
    const alerts = alertsForZip(wx.alerts, this.world.z.coast_km ? this.world.z.coast_km[zi] : null).slice(0, 3);
    // where the numbers come from (world.weatherAt's basis): this place's own forecast point, a forecast borrowed from
    // a point nearby (named, with its distance and the elevation adjustment, never as "here"), or a climate estimate
    // (past the forecast, or no point close enough on this side of the mountains); `approx` numbers read "about"
    const basis = wx.basis && typeof wx.basis === 'object' ? wx.basis : null;
    const climate = !!wx.stale || (basis && basis.kind === 'climate');
    const borrowed = !climate && basis && basis.kind === 'borrowed';
    const approx = wx.approx === true || climate || borrowed;
    // the NWS text generator leaves placeholders in when a value is missing ("{{missing_temperature_data}}")
    const detail = wx.period && !climate && wx.period.detail ? cleanForecastText(wx.period.detail) : '';
    // where this weather comes from: the snapshot, or live when allowed (with a note when it could not be used)
    const live = typeof this.services.weatherStatus === 'function' ? this.services.weatherStatus(zi, t) : { state: 'off' };
    const nws = wx.live ? 'Live NWS' : 'NWS';
    const elev = borrowed && Number.isFinite(basis.elevAdjF) && Math.abs(basis.elevAdjF) >= 1 ? `, ${basis.elevAdjF > 0 ? '+' : '−'}${Math.abs(Math.round(basis.elevAdjF))}°F for the elevation` : '';
    const pointName = borrowed ? (basis.point || wx.point || 'a point nearby') : null;
    const where = climate ? (wx.stale ? 'Climate estimate (past the forecast)' : 'Climate estimate: no NWS forecast point near enough')
      : borrowed ? `${nws} forecast for ${pointName}${Number.isFinite(basis.distKm) ? `, ${Math.round(basis.distKm)} km away` : ''}${elev}`
        : `${nws} ${wx.point || wx.office || ''}${this.scope && this.scope.zis.length > 1 ? ` · ${z.city}` : ''}`;
    const note = live && live.note && live.state !== 'live' ? h('p.wx-note', { role: 'note' }, icon('info', { size: 14 }), h('span', live.note),
      live.state === 'outside' && this.onNow ? h('button.link-btn', { type: 'button', on: { click: () => this.onNow() } }, 'Set the clock to now') : null) : null;
    el.append(h('div.weather', { class: [wx.stale ? 'is-stale' : null, wx.live ? 'is-live' : null].filter(Boolean).join(' ') || null, dataset: { source: wx.live ? 'live' : wx.stale ? 'climate' : 'snapshot' } },
      h('div.wx-now',
        h('span.wx-temp', Number.isFinite(now.tempF) ? { title: approx ? `About ${now.tempF}°F` : null, 'aria-label': approx ? `about ${now.tempF}°F` : null } : null, Number.isFinite(now.tempF) ? `${approx ? '≈' : ''}${now.tempF}°F` : '—'),
        h('span.wx-short', now.short || ''),
        h('span.wx-where', where)),
      detail ? h('p.wx-detail', borrowed ? `${wx.period.name} in ${pointName}: ${detail}` : `${wx.period.name}: ${detail}`) : null,
      alerts.length ? h('ul.wx-alerts', { 'aria-label': 'Weather alerts' }, alerts.map(a => h('li', { class: `sev-${String(a.severity || '').toLowerCase()}` }, icon('alert', { size: 14 }), h('span', a.event)))) : null,
      wx.fireWeather && wx.fireWeather.level > 0 ? h('p.wx-fire', icon('alert', { size: 14 }), `Fire weather: ${wx.fireWeather.name}`) : null,
      live && live.state === 'live' ? h('p.wx-note.is-live', h('span', live.note)) : null,
      note));
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
    const result = this.services.validate(zi, FIDELITY_HOUSEHOLDS);
    if (!result || token !== this._token) return;
    const values = result.tables.filter(t => t.kind === 'value');
    const featured = result.tables.filter(t => t.kind === 'shares' && t.featured);
    const rest = result.tables.filter(t => t.kind === 'shares' && !t.featured);
    const n = result.households;
    const counted = [`${fmtInt(n)} household${n === 1 ? '' : 's'}`, Number.isFinite(result.persons) ? `${fmtInt(result.persons)} people` : null].filter(Boolean).join(' · ');
    const gqShare = result.gq ? result.gq.share : 0;
    clear(this._fidelitySlot).append(h('section.p-section.fidelity',
      h('div.section-head', h('h3', 'Census versus generated'), h('span.section-note', counted)),
      n < SMALL_SAMPLE ? h('p.fid-caveat', { role: 'note' }, icon('info', { size: 14 }), h('span', `Only ${n === 1 ? 'one household lives' : `${fmtInt(n)} households live`} here, so the generated shares swing widely from the Census ones.`)) : null,
      gqShare >= 0.02 ? h('p.fid-caveat', { role: 'note' }, icon('info', { size: 14 }), h('span', `About ${fmtInt(result.gq.persons)} people here (${fmtPct(gqShare * 100)}) live in group quarters such as dorms, barracks, prisons and nursing homes. Households do not include them, so the Census ages and school shares count people the generated ones leave out.`)) : null,
      pairedLegend(),
      values.length ? h('div.fid-figures', { role: 'table', 'aria-label': 'Key figures, Census versus generated' },
        h('div.fid-fig.fid-fig-head', { role: 'row' }, h('span', { role: 'columnheader' }, ''), h('span', { role: 'columnheader' }, 'Census'), h('span', { role: 'columnheader' }, 'Generated')),
        values.map(t => h('div.fid-fig', { role: 'row' },
          h('span.fid-fig-label', { role: 'rowheader' }, t.label),
          h('span.mono', { role: 'cell' }, fidelityValueText(t.acs, t.format)),
          h('span.mono', { role: 'cell' }, fidelityValueText(t.gen, t.format))))) : null,
      featured.map(t => this._fidelityTable(t)),
      rest.length ? h('details.fid-more',
        h('summary', `${rest.length} more table${rest.length === 1 ? '' : 's'}`, h('span.fid-more-list', rest.map(t => t.label).join(', '))),
        rest.map(t => this._fidelityTable(t))) : null,
      h('p.fine', 'Generated from the same seed the crowd uses; every NPC on the map comes from these households.')));
  }

  _fidelityTable(t) {
    return h('div.fid-table', { dataset: { dim: t.key } },
      h('div.fid-head', h('h4', t.label), h('span.fid-gap', { title: 'Mean absolute difference across the rows, in percentage points' }, `gap ${t.meanGap.toFixed(1)} pts`)),
      t.note ? h('p.fid-note', t.note) : null,
      pairedBars(t.rows, { ariaLabel: `${t.label}: Census versus generated` }),
      t.more ? h('p.fid-note', `and ${t.more} smaller group${t.more === 1 ? '' : 's'}`) : null);
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
      h('button.btn.wide.walk-streets', { type: 'button', disabled: !ready, 'aria-describedby': 'street-note', on: { click: () => { if (ready && this.onStreetView) this.onStreetView(scope); } } }, icon('street', { size: 16 }), `Walk the streets of ${scope.kind === 'zip' ? scope.key : scope.title}`),
      h('p.fine#street-note', ready
        ? 'The neighborhood up close, on the same clock: the residents of the homes in view walk the sidewalks and drive the streets on their own schedules, chatting as they pass.'
        : 'The street view is not loaded in this page.'));
  }
}

