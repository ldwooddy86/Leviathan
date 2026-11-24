// Legion · DOM helpers: an element builder, the icon set, toasts, clipboard and downloads.
//
// Text always goes in through textContent (never innerHTML), so names, prompts and model output can never
// inject markup. Icons are built from path data with createElementNS.

const SVG_NS = 'http://www.w3.org/2000/svg';
const PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'indeterminate', 'open', 'tabIndex', 'readOnly', 'multiple']);

/**
 * Create an element. `tag` may carry classes and an id: `h('button.chip.is-on#play', {...}, ...children)`.
 * Props: `class` (string or array), `style` (object or string), `dataset`, `on` ({event: handler}), `text`,
 * DOM properties (value, checked, disabled, hidden ...), anything else as an attribute (false/null skip it).
 * Children: nodes, strings, numbers or nested arrays; null, undefined and false are skipped.
 * @returns {HTMLElement}
 */
export function h(tag, props = null, ...children) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
  const el = document.createElement(m[1] || 'div');
  for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { children.unshift(props); props = null; }
  if (props) applyProps(el, props);
  append(el, children);
  return el;
}

function applyProps(el, props) {
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false && !PROPS.has(k)) continue;
    if (k === 'class' || k === 'className') { for (const c of [].concat(v).join(' ').split(/\s+/)) if (c) el.classList.add(c); }
    else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k === 'dataset') { for (const [dk, dv] of Object.entries(v)) if (dv !== undefined && dv !== null) el.dataset[dk] = String(dv); }
    else if (k === 'on') { for (const [ev, fn] of Object.entries(v)) if (fn) el.addEventListener(ev, fn); }
    else if (k === 'text') el.textContent = String(v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

/** Append children (nodes, strings, arrays) to el; returns el. */
export function append(el, children) {
  for (const c of [].concat(children).flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Remove every child of el; returns el. */
export function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

/** Replace el's children; returns el. */
export function replace(el, ...children) { return append(clear(el), children); }

/** querySelector shorthand. */
export const $ = (sel, root = document) => root.querySelector(sel);
/** querySelectorAll as an array. */
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// 24 x 24 stroke icons (round caps, currentColor). Each is a list of [element, attributes].
const ICONS = {
  play: [['path', { d: 'M8 5.5v13l10.5-6.5z', fill: 'currentColor', stroke: 'none' }]],
  pause: [['rect', { x: 6.5, y: 5, width: 3.6, height: 14, rx: 1, fill: 'currentColor', stroke: 'none' }], ['rect', { x: 13.9, y: 5, width: 3.6, height: 14, rx: 1, fill: 'currentColor', stroke: 'none' }]],
  search: [['circle', { cx: 10.5, cy: 10.5, r: 6 }], ['path', { d: 'M15 15l5 5' }]],
  sliders: [['path', { d: 'M4 7h9M17 7h3M4 17h3M11 17h9M4 12h13' }], ['circle', { cx: 15, cy: 7, r: 2 }], ['circle', { cx: 9, cy: 17, r: 2 }], ['circle', { cx: 19, cy: 12, r: 1.2, fill: 'currentColor' }]],
  close: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
  sun: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6' }]],
  moon: [['path', { d: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z' }]],
  copy: [['rect', { x: 8.5, y: 8.5, width: 11, height: 11, rx: 2 }], ['path', { d: 'M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5' }]],
  download: [['path', { d: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14' }]],
  locate: [['circle', { cx: 12, cy: 12, r: 6.5 }], ['circle', { cx: 12, cy: 12, r: 2, fill: 'currentColor' }], ['path', { d: 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  minus: [['path', { d: 'M5 12h14' }]],
  fit: [['path', { d: 'M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15' }]],
  shuffle: [['path', { d: 'M4 7h3.5c4.5 0 4.5 10 9 10H20M4 17h3.5c1.6 0 2.6-1.2 3.4-2.8M20 7h-3.5c-1.6 0-2.6 1.2-3.4 2.8M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5' }]],
  back: [['path', { d: 'M14.5 5.5L8 12l6.5 6.5' }]],
  reset: [['path', { d: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4' }]],
  alert: [['path', { d: 'M12 4l9 16H3z' }], ['path', { d: 'M12 10v4.5M12 17.2v.3' }]],
  info: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M12 11v5.5M12 7.8v.3' }]],
  send: [['path', { d: 'M5 12l14-7-5 14-2.5-5.5z' }], ['path', { d: 'M11.5 13.5L19 5' }]],
  street: [['path', { d: 'M4 20V10l5-4 5 4v10M14 20v-7l3-2.5 3 2.5v7M2.5 20h19M7.5 20v-4h3v4' }]],
  people: [['circle', { cx: 9, cy: 8, r: 3 }], ['path', { d: 'M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5' }], ['circle', { cx: 16.5, cy: 9, r: 2.4 }], ['path', { d: 'M15.5 14.2c2.3 0 4.3 1.4 4.9 4.3' }]],
  check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
  key: [['circle', { cx: 8, cy: 15, r: 3.5 }], ['path', { d: 'M10.5 12.5L19 4M15.5 7.5l2.5 2.5M13.5 9.5l2 2' }]],
};

/**
 * An inline SVG icon by name (see ICONS); decorative unless a label is given.
 * @param {string} name
 * @param {{size?: number, label?: string}} [options]
 * @returns {SVGSVGElement}
 */
export function icon(name, { size = 18, label: aria } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('icon');
  if (aria) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', aria); } else svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of ICONS[name] || ICONS.info) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.appendChild(node);
  }
  return svg;
}

/** The Legion mark: a small crowd of seven dots, the center one in the accent. */
export function logoMark(size = 22) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true'); svg.classList.add('logo-mark');
  const dots = [[12, 12, 3.1, 'accent'], [12, 4.6, 2.2], [18.4, 8.3, 2.2], [18.4, 15.7, 2.2], [12, 19.4, 2.2], [5.6, 15.7, 2.2], [5.6, 8.3, 2.2]];
  for (const [cx, cy, r, kind] of dots) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    c.setAttribute('class', kind === 'accent' ? 'logo-core' : 'logo-dot');
    svg.appendChild(c);
  }
  return svg;
}

/**
 * Show a short message at the bottom of the page. The host (#toasts) is a polite live region, so the message is
 * announced once; errors are alerts.
 * @param {string} message
 * @param {{kind?: 'info'|'error'|'success', timeout?: number}} [options]
 */
export function toast(message, { kind = 'info', timeout = 2600 } = {}) {
  const host = document.getElementById('toasts');
  if (!host) return null;
  const el = h('div.toast', { class: `is-${kind}`, role: kind === 'error' ? 'alert' : null }, icon(kind === 'error' ? 'alert' : kind === 'success' ? 'check' : 'info', { size: 16 }), h('span', { text: message }));
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 300); }, timeout);
  return el;
}

/** Copy text to the clipboard (with a fallback for file:// pages without the async clipboard); true on success. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to the textarea path */ }
  const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-9999px;top:0;opacity:0' });
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  let okCopy = false;
  try { okCopy = document.execCommand('copy'); } catch { okCopy = false; }
  ta.remove();
  return okCopy;
}

/** Offer text as a file download. */
export function downloadText(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename, style: 'display:none' });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
}

/**
 * JSON.stringify that survives cycles, typed arrays, Maps, Sets and BigInts (for the JSON tab and exports).
 * Only a true cycle (an object inside itself) prints as "[circular]"; an object shared by two branches prints
 * in both, because the check follows the chain of ancestors rather than everything seen so far.
 */
export function safeJSON(value, space = 2) {
  const ancestors = [];
  return JSON.stringify(value, function replacer(key, v) {
    if (typeof v === 'bigint') return String(v);
    if (!v || typeof v !== 'object') return v;
    if (ArrayBuffer.isView(v)) return Array.from(v);
    const out = v instanceof Map ? Object.fromEntries(v) : v instanceof Set ? [...v] : v;
    // `this` is the object holding `key`: unwind to it, so the stack is exactly the path from the root
    while (ancestors.length && ancestors[ancestors.length - 1] !== this) ancestors.pop();
    if (ancestors.includes(v) || ancestors.includes(out)) return '[circular]';
    ancestors.push(out);
    return out;
  }, space);
}

/**
 * The handle of a bottom sheet (on phones; CSS hides it on wide screens): a button that switches the sheet between
 * its usual height and nearly the whole screen (the class `is-expanded` on the sheet). A tap toggles; a drag of the
 * handle up expands and down shrinks. `onChange(expanded)` runs after each change the handle makes; the handle also
 * follows the class when the panel sets it itself (the NPC panel opens tall on its Talk tab).
 * @param {HTMLElement} sheet
 * @param {{label?: string, onChange?: (expanded: boolean) => void}} [options]
 * @returns {HTMLButtonElement}
 */
export function sheetGrip(sheet, { label = 'panel', onChange } = {}) {
  const btn = h('button.sheet-grip', { type: 'button', 'aria-expanded': 'false', 'aria-label': `Expand the ${label} panel`, title: 'Drag or tap to resize' });
  const sync = () => {
    const on = sheet.classList.contains('is-expanded');
    btn.setAttribute('aria-expanded', String(on));
    btn.setAttribute('aria-label', `${on ? 'Shrink' : 'Expand'} the ${label} panel`);
  };
  const set = on => { sheet.classList.toggle('is-expanded', on); sync(); if (onChange) onChange(on); };
  let startY = null, dragged = false;
  btn.addEventListener('pointerdown', e => { startY = e.clientY; dragged = false; try { btn.setPointerCapture(e.pointerId); } catch { /* old browsers */ } });
  btn.addEventListener('pointermove', e => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) >= 24) { dragged = true; startY = null; set(dy < 0); }
  });
  const end = () => { startY = null; };
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointercancel', end);
  btn.addEventListener('click', e => {
    if (dragged) { dragged = false; e.preventDefault(); return; }
    set(!sheet.classList.contains('is-expanded'));
  });
  if (typeof MutationObserver === 'function') new MutationObserver(sync).observe(sheet, { attributes: true, attributeFilter: ['class'] });
  return btn;
}

/** True when the user asked for reduced motion. */
export function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
