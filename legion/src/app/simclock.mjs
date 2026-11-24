// Legion · the simulation clock: Pacific time that runs at 1x to 3600x, and its controls in the top bar.
//
// The clock starts at the NWS snapshot time (the moment the pack's weather was fetched), so the forecast, the
// alerts and the crowd all describe the same California afternoon. Real time only drives the animation; every
// time the engine sees is this clock's epoch ms, read through clock.mjs.
//
// A conversation happens in real time: while the player talks with an NPC the page holds the clock at 1x (hold),
// and the speed they chose comes back when the conversation ends (release). Choosing a speed ends a hold.

import { pacific, atPacific } from '../engine/clock.mjs';
import { EVENTS } from './bus.mjs';
import { h, icon } from './dom.mjs';
import { fmtMinute } from './format.mjs';

/** Speeds offered (simulated seconds per real second). */
export const SPEEDS = Object.freeze([1, 60, 600, 3600]);

const SPEED_TITLE = { 1: 'Real time', 60: 'One minute per second', 600: 'Ten minutes per second', 3600: 'One hour per second' };

/** The simulation clock. */
export class SimClock {
  /**
   * @param {{t0: number, speed?: number, playing?: boolean, bus?: {emit: Function}}} options t0 in epoch ms
   */
  constructor({ t0, speed = 60, playing = true, bus = null }) {
    if (!Number.isFinite(t0)) throw new TypeError('SimClock needs a start time');
    this.t0 = t0;
    this.t = t0;
    this.speed = SPEEDS.includes(speed) ? speed : 60;
    /** The speed a hold caps the clock at (hold), or null. */
    this.held = null;
    this.playing = !!playing;
    this.bus = bus;
    this._lastEmitReal = -Infinity;
    this._lastMinute = Math.floor(t0 / 60000);
    this._listeners = new Set();
  }

  /** The speed the clock runs at now: the chosen speed, or less while a hold caps it. */
  get rate() { return this.held !== null ? Math.min(this.held, this.speed) : this.speed; }

  /** Advance by realMs of wall time (when playing); returns true when the simulated minute changed. */
  advance(realMs) {
    if (!this.playing || !(realMs > 0)) return false;
    this.t += realMs * this.rate;
    const minute = Math.floor(this.t / 60000);
    if (minute === this._lastMinute) return false;
    this._lastMinute = minute;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // at 3600x the minute changes every frame; tell the page at most four times a second
    if (now - this._lastEmitReal >= 250) { this._lastEmitReal = now; this._emit(); }
    return true;
  }

  /** Jump to epoch ms t. */
  set(t) {
    if (!Number.isFinite(t)) return;
    this.t = t;
    this._lastMinute = Math.floor(t / 60000);
    this._emit();
  }

  /** Keep the Pacific date, move to a minute of the day (0-1439). */
  setMinuteOfDay(min) {
    const p = pacific(this.t);
    const m = Math.max(0, Math.min(1439, Math.round(min)));
    this.set(atPacific(p.year, p.month, p.day, Math.floor(m / 60), m % 60) + (this.t % 60000));
  }

  /** Set the speed (one of SPEEDS). The player's choice: it also ends a hold. */
  setSpeed(speed) {
    if (!SPEEDS.includes(speed) || (speed === this.speed && this.held === null)) return;
    this.speed = speed; this.held = null;
    this._emit();
  }

  /**
   * Run at most at `speed` (one of SPEEDS; real time by default) until release(), keeping the chosen speed for then:
   * the page holds the clock while the player talks with an NPC, whose words describe one moment.
   */
  hold(speed = 1) {
    if (!SPEEDS.includes(speed) || this.held === speed) return;
    this.held = speed;
    this._emit();
  }

  /** End a hold: the clock runs at the chosen speed again. */
  release() { if (this.held !== null) { this.held = null; this._emit(); } }

  /** Start the clock. */
  play() { if (!this.playing) { this.playing = true; this._emit(); } }
  /** Stop the clock. */
  pause() { if (this.playing) { this.playing = false; this._emit(); } }
  /** Play or pause. */
  toggle() { if (this.playing) this.pause(); else this.play(); }
  /** Back to the snapshot time. */
  reset() { this.set(this.t0); }

  /** Pacific calendar parts of the current time (clock.pacific). */
  parts() { return pacific(this.t); }

  /** Listen to every change (play, speed, time); returns the unsubscribe function. */
  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  _emit() {
    const payload = { t: this.t, speed: this.speed, rate: this.rate, held: this.held, playing: this.playing };
    for (const fn of [...this._listeners]) { try { fn(payload); } catch (e) { console.error('[legion] clock listener failed', e); } }
    if (this.bus) this.bus.emit(EVENTS.TIME_CHANGE, payload);
  }
}

/**
 * Mount the clock controls (play/pause, speeds, the time, a time-of-day scrubber, back-to-snapshot) in `host`.
 * Call the returned `update()` each frame; it only touches the DOM when the minute or state changed.
 * @param {HTMLElement} host
 * @param {SimClock} clock
 * @returns {{update: () => void, element: HTMLElement}}
 */
export function mountClockControls(host, clock) {
  const playBtn = h('button.icon-btn.play-btn', { type: 'button', 'aria-keyshortcuts': 'Space', on: { click: () => clock.toggle() } });
  const speeds = h('div.segmented.speeds', { role: 'radiogroup', 'aria-label': 'Simulation speed' });
  const speedInputs = new Map();
  for (const s of SPEEDS) {
    const id = `speed-${s}`;
    const input = h('input', { type: 'radio', name: 'sim-speed', id, value: String(s), checked: s === clock.speed, on: { change: () => clock.setSpeed(s) } });
    speedInputs.set(s, input);
    speeds.append(input, h('label', { for: id, title: SPEED_TITLE[s] }, `${s}×`));
  }
  const timeEl = h('time.clock-time');
  const dayEl = h('span.clock-day');
  const scrub = h('input.scrubber', { type: 'range', min: '0', max: '1439', step: '1', 'aria-label': 'Time of day (Pacific)' });
  let dragging = false;
  scrub.addEventListener('pointerdown', () => { dragging = true; });
  window.addEventListener('pointerup', () => { dragging = false; });
  scrub.addEventListener('input', () => clock.setMinuteOfDay(+scrub.value));
  scrub.addEventListener('blur', () => { dragging = false; });
  const resetBtn = h('button.icon-btn.small', { type: 'button', title: 'Back to the NWS snapshot time', 'aria-label': 'Back to the NWS snapshot time', on: { click: () => clock.reset() } }, icon('reset', { size: 16 }));

  const element = h('div.clock', { role: 'group', 'aria-label': 'Simulation clock' },
    playBtn, speeds,
    h('div.clock-face', h('div.clock-read', timeEl, dayEl), scrub),
    resetBtn);
  host.append(element);

  let shown = { minute: -1, playing: null, speed: null, held: undefined };
  function update() {
    const p = clock.parts();
    const minute = Math.floor(clock.t / 60000);
    if (minute !== shown.minute) {
      shown.minute = minute;
      timeEl.textContent = fmtMinute(p.minuteOfDay);
      timeEl.setAttribute('datetime', `${p.iso}`);
      dayEl.textContent = `${p.dayName.slice(0, 3)} ${p.monthName.slice(0, 3)} ${p.day} · PT`;
      if (!dragging && document.activeElement !== scrub) scrub.value = String(p.minuteOfDay);
      scrub.setAttribute('aria-valuetext', `${fmtMinute(p.minuteOfDay)}, ${p.dayName}`);
    }
    if (clock.playing !== shown.playing) {
      shown.playing = clock.playing;
      playBtn.replaceChildren(icon(clock.playing ? 'pause' : 'play'));
      playBtn.setAttribute('aria-label', clock.playing ? 'Pause the simulation' : 'Play the simulation');
      playBtn.setAttribute('aria-pressed', String(clock.playing));
      playBtn.classList.toggle('is-playing', clock.playing);
    }
    // the speed the clock runs at is the one checked; a hold (a conversation in real time) says so
    if (clock.rate !== shown.speed || clock.held !== shown.held) {
      shown.speed = clock.rate; shown.held = clock.held;
      const input = speedInputs.get(clock.rate);
      if (input && !input.checked) input.checked = true;
      const held = clock.held !== null && clock.rate < clock.speed;
      speeds.classList.toggle('is-held', held);
      speeds.title = held ? `Real time while you talk; back to ${clock.speed}× when the conversation ends (or choose a speed)` : '';
    }
  }
  clock.subscribe(update);
  update();
  return { update, element };
}
