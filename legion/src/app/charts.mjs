// Legion · the small charts of the panels, as plain HTML.
//
// Ranked bars (one series, one color), a segmented part-to-whole bar with its legend, paired bars for Census
// versus generated, and meters. Marks follow one spec: thin bars with rounded data ends grown from a baseline,
// a 2px surface gap between touching segments, text in ink tokens (never the data color), and every value also
// printed as text so nothing depends on color alone. Colors are CSS custom properties (--s1 ... --s8).

import { h } from './dom.mjs';
import { fmtPct } from './format.mjs';

/**
 * Ranked horizontal bars for one series (shares in percent).
 * @param {Array<object>} rows
 * @param {{label?: (r) => string, value?: (r) => number, note?: (r) => string|null, tag?: (r) => string|null,
 *   ariaLabel: string, max?: number, slot?: number}} opts
 * @returns {HTMLElement}
 */
export function rankedBars(rows, { label = r => r.label, value = r => r.share, note = () => null, tag = () => null, ariaLabel, max, slot = 1 }) {
  const top = max ?? Math.max(1e-9, ...rows.map(value));
  return h('ul.ranked', { 'aria-label': ariaLabel },
    rows.map(r => {
      const v = value(r), n = note(r), t = tag(r);
      return h('li.ranked-row',
        h('div.ranked-head',
          h('span.ranked-label', label(r), t ? h('span.ranked-tag', t) : null),
          h('span.ranked-value', fmtPct(v))),
        h('div.ranked-track', { 'aria-hidden': 'true' }, h('span.ranked-fill', { style: { width: `${Math.max(0.6, 100 * v / top)}%`, background: `var(--s${slot})` } })),
        n ? h('div.ranked-note', n) : null);
    }));
}

/**
 * A part-to-whole bar with its legend (the legend carries every name and share, so it is also the table view).
 * @param {Array<{key: string, label: string, share: number, slot: number}>} parts slot 0 is the neutral "other"
 * @param {{ariaLabel: string}} opts
 */
export function segmentedBar(parts, { ariaLabel }) {
  const shown = parts.filter(p => p.share > 0);
  const summary = shown.map(p => `${p.label} ${fmtPct(p.share)}`).join(', ');
  return h('div.seg-wrap',
    h('div.seg', { role: 'img', 'aria-label': `${ariaLabel}: ${summary}` },
      shown.map(p => h('span.seg-part', { title: `${p.label} · ${fmtPct(p.share)}`, style: { flexGrow: String(p.share), background: p.slot ? `var(--s${p.slot})` : 'var(--other)' } }))),
    h('ul.seg-legend', { 'aria-label': `${ariaLabel}, values` },
      parts.map(p => h('li', { class: p.share > 0 ? null : 'is-zero' },
        h('span.swatch', { 'aria-hidden': 'true', style: { background: p.slot ? `var(--s${p.slot})` : 'var(--other)' } }),
        h('span.seg-name', p.label), h('span.seg-val', fmtPct(p.share))))));
}

/**
 * Census versus generated: per category, a Census bar (slot 1) over a generated bar (slot 2), values as text.
 * @param {Array<{key: string, label: string, acs: number, gen: number}>} rows percents
 * @param {{ariaLabel: string}} opts
 */
export function pairedBars(rows, { ariaLabel }) {
  const top = Math.max(1e-9, ...rows.flatMap(r => [r.acs, r.gen]));
  return h('ul.paired', { 'aria-label': ariaLabel },
    rows.map(r => h('li.paired-row',
      h('div.paired-head', h('span.paired-label', r.label), h('span.paired-values', h('span', { title: 'Census' }, fmtPct(r.acs)), ' · ', h('span', { title: 'Generated' }, fmtPct(r.gen)))),
      h('div.paired-bars', { 'aria-hidden': 'true' },
        h('div.paired-track', h('span', { style: { width: `${Math.max(0.6, 100 * r.acs / top)}%`, background: 'var(--s1)' } })),
        h('div.paired-track', h('span', { style: { width: `${Math.max(0.6, 100 * r.gen / top)}%`, background: 'var(--s2)' } }))))));
}

/** The two-swatch legend for pairedBars. */
export function pairedLegend() {
  return h('ul.pair-legend', { 'aria-label': 'Legend' },
    h('li', h('span.swatch', { 'aria-hidden': 'true', style: { background: 'var(--s1)' } }), 'Census ACS'),
    h('li', h('span.swatch', { 'aria-hidden': 'true', style: { background: 'var(--s2)' } }), 'Generated NPCs'));
}

/**
 * A labeled 0..1 meter; the value prints as 0-100.
 * @param {string} label
 * @param {number} value 0..1
 * @param {{low?: string, high?: string, slot?: number}} [opts] words for the two ends
 */
export function meter(label, value, { low, high, slot = 1 } = {}) {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  return h('div.meter', { role: 'meter', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(v * 100)) },
    h('div.meter-head', h('span.meter-label', label), h('span.meter-value', String(Math.round(v * 100)))),
    h('div.meter-track', { 'aria-hidden': 'true', style: { '--meter-color': `var(--s${slot})` } }, h('span', { style: { width: `${Math.max(1, v * 100)}%` } })),
    low || high ? h('div.meter-ends', { 'aria-hidden': 'true' }, h('span', low || ''), h('span', high || '')) : null);
}
