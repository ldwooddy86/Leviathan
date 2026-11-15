/* Sweeps a running dashboard for text and controls that overlap, crowd each other or spill out of their box.

   The dashboard is opened headless (lib/live.mjs) and walked the way a person would walk it: every module is shown,
   every collapsed section opened, every segmented control pressed through, the first row of every table that opens a
   detail clicked, a few filter chips pressed, and the dialogs opened (Brand, and Dr. HVAC's settings and history).
   After each step the page is measured, at each of the widths asked for.

   What is looked for (detect, below, runs in the page):
     overlap   two things that are not one inside the other share more than a sliver of the same space
     touch     a line of text and a control, or two controls, side by side on one row with nothing between them
     spill     text or a control past the edge of the nearest drawn box (a card, a button, a pill, a table cell), sideways
               or downwards, or past the edge of the page
     inline    a field label that shares its row with its control, where the dashboard stacks label, control and hint
     bare      a text entry control the style sheet does not dress: it shows as the browser's own
     clipped   a button, a pill or a heading cell whose own words are cut off by its own box with no ellipsis
     covered   (covered, below) a line or a control with something else drawn on top of its middle, asked of the browser
               while the page is scrolled from top to bottom
     labels    chart labels printed over each other
     struck    a chart label with a grid line, a marker line or a trend line through it and no halo against it, or one
               that sits on a point of the chart
     frame     a chart whose marks or labels are drawn past the top or the bottom of its own frame, over the card's
               heading or caption
     stretched a tick box stretched to the width of a text field, its label squeezed beside it
   and, under overlap, a place name on the map that sits under the map's own zoom buttons.

   What is not counted: anything clipped away by a box that hides its overflow or scrolled out of sight in its own box,
   anything not shown or parked off screen for screen readers, the body of a collapsed section, text inside its own
   control, and a sticky bar or a sticky table heading over what scrolls under it.

   It measures; it does not judge taste. A finding is a place to look. Nothing here changes the dashboard. */

/* ---------- in the page ---------- */
/* these two run inside the dashboard: each must stand alone, with nothing from this module in it */
export function detect(scopeSel) {
  const scope = document.querySelector(scopeSel); if (!scope) return { error: 'no scope ' + scopeSel };
  const VW = document.documentElement.clientWidth;
  const shownCache = new WeakMap();
  const shown = el => { if (!el || el === document.documentElement) return true; if (shownCache.has(el)) return shownCache.get(el); const cs = getComputedStyle(el); const ok = cs.display !== 'none' && +cs.opacity > 0.05 && !el.hidden && (cs.contentVisibility || 'visible') !== 'hidden' && !(el.tagName !== 'SUMMARY' && el.parentElement && el.parentElement.tagName === 'DETAILS' && !el.parentElement.open) && shown(el.parentElement); shownCache.set(el, ok); return ok; };
  const clipCache = new WeakMap();
  const clipOf = el => { if (!el || el === document.documentElement) return { l: -1e9, t: -1e9, r: 1e9, b: 1e9 }; if (clipCache.has(el)) return clipCache.get(el); const up = clipOf(el.parentElement), c = { l: up.l, t: up.t, r: up.r, b: up.b }, cs = getComputedStyle(el); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const b = el.getBoundingClientRect(); if (cs.overflowX !== 'visible') { c.l = Math.max(c.l, b.left); c.r = Math.min(c.r, b.right); } if (cs.overflowY !== 'visible') { c.t = Math.max(c.t, b.top); c.b = Math.min(c.b, b.bottom); } } clipCache.set(el, c); return c; };
  const clip = (r, c) => ({ l: Math.max(r.left, c.l), t: Math.max(r.top, c.t), r: Math.min(r.right, c.r), b: Math.min(r.bottom, c.b) });
  const fixedCache = new WeakMap();
  const isFixed = el => { if (!el || el === document.documentElement) return false; if (fixedCache.has(el)) return fixedCache.get(el); const v = getComputedStyle(el).position === 'fixed' || isFixed(el.parentElement); fixedCache.set(el, v); return v; };
  const name = el => { const parts = []; for (let e = el, i = 0; e && e !== document.body && i < 4; e = e.parentElement, i++) { parts.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); if (e.id) break; } return parts.join(' > '); };
  const scopeFixed = isFixed(scope), items = [];
  const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const s = n.nodeValue; if (!s || !s.trim()) continue; const el = n.parentElement; if (!el || el.closest('svg,script,style,select,option,noscript,template,textarea')) continue;
    if (!shown(el) || getComputedStyle(el).visibility !== 'visible') continue; if (!scopeFixed && isFixed(el)) continue;
    /* the words themselves: a space at either end is room, not ink */
    const lead = s.length - s.trimStart().length, tail = s.trimEnd().length, range = document.createRange(); range.setStart(n, lead); range.setEnd(n, tail); const c = clipOf(el);
    for (const rc of range.getClientRects()) { if (rc.width < 1.5 || rc.height < 4 || rc.right < -50) continue; const r = clip(rc, c); if (r.r - r.l < 1.5 || r.b - r.t < 3) continue; items.push({ el, kind: 't', r, raw: { l: rc.left, r: rc.right }, text: s.trim().replace(/\s+/g, ' ').slice(0, 48) }); }
  }
  const controls = [...scope.querySelectorAll('input:not([type=hidden]),select,textarea,button')].filter(el => !el.closest('svg') && shown(el) && getComputedStyle(el).visibility === 'visible' && (scopeFixed || !isFixed(el)));
  for (const el of controls) {
    const rc = el.getBoundingClientRect(); if (rc.width < 2 || rc.height < 2 || rc.right < -50) continue; const r = clip(rc, clipOf(el.parentElement)); if (r.r - r.l < 2 || r.b - r.t < 2) continue;
    items.push({ el, kind: 'c', r, raw: { l: rc.left, r: rc.right }, text: (el.tagName.toLowerCase() + (el.type ? '[' + el.type + ']' : '') + ' ' + (el.id ? '#' + el.id + ' ' : '') + (el.tagName === 'BUTTON' ? (el.textContent || '').trim().slice(0, 30) : '')).trim() });
  }
  items.sort((a, b) => a.r.t - b.r.t);
  const out = [], seen = new Set();
  const add = (type, a, b, box, note) => { const key = type + '|' + name(a.el) + '|' + a.text + '|' + (b ? name(b.el) + '|' + b.text : ''); if (seen.has(key)) return; seen.add(key); out.push({ type, a: name(a.el), aText: a.text, b: b ? name(b.el) : '', bText: b ? b.text : (note || ''), box: { x: Math.round(box.l), y: Math.round(box.t + scrollY), w: Math.round(box.r - box.l), h: Math.round(box.b - box.t) } }); };
  const union = (A, B) => ({ l: Math.min(A.r.l, B.r.l), t: Math.min(A.r.t, B.r.t), r: Math.max(A.r.r, B.r.r), b: Math.max(A.r.b, B.r.b) });
  for (let i = 0; i < items.length; i++) {
    const A = items[i], ah = A.r.b - A.r.t;
    for (let j = i + 1; j < items.length; j++) {
      const B = items[j]; if (B.r.t >= A.r.b - 1.5) break;
      if (A.el === B.el && A.kind === 'c' && B.kind === 'c') continue;
      if (A.kind === 'c' && A.el.contains(B.el)) continue; if (B.kind === 'c' && B.el.contains(A.el)) continue;
      /* a sticky bar or a sticky table heading over what has scrolled under it is how they work */
      if (!!A.el.closest('.mbar') !== !!B.el.closest('.mbar')) continue; if (!!A.el.closest('thead') !== !!B.el.closest('thead') && A.el.closest('table') === B.el.closest('table')) continue;
      const ix = Math.min(A.r.r, B.r.r) - Math.max(A.r.l, B.r.l), iy = Math.min(A.r.b, B.r.b) - Math.max(A.r.t, B.r.t), bh = B.r.b - B.r.t;
      if (iy <= 2.5 || iy < 0.3 * Math.min(ah, bh)) continue;
      /* the lines of one clamped text: the browser hides the rest */
      if (A.kind === 't' && B.kind === 't' && A.el === B.el && (ix < 4 || getComputedStyle(A.el).webkitLineClamp !== 'none')) continue;
      if (ix > 2.5 && ix * iy >= 14) { add('overlap', A, B, union(A, B)); continue; }
      if ((A.kind === 'c' || B.kind === 'c') && ix > -1.5 && ix <= 2.5 && iy > 0.5 * Math.min(ah, bh)) {
        const c = A.kind === 'c' ? A.el : B.el, o = A.kind === 'c' ? B.el : A.el; if (c.closest('.seg') || o.closest('.seg')) continue;
        if ((c.type === 'checkbox' || c.type === 'radio' || o.type === 'checkbox' || o.type === 'radio') && ix <= 0.5) continue;
        add('touch', A, B, union(A, B));
      }
    }
  }
  const painted = el => { const cs = getComputedStyle(el); if (cs.display === 'inline' || cs.display === 'contents') return false; const bg = cs.backgroundColor; return (parseFloat(cs.borderLeftWidth) > 0 && cs.borderLeftStyle !== 'none') || (parseFloat(cs.borderRightWidth) > 0 && cs.borderRightStyle !== 'none') || (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0) || (bg && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(bg)) || cs.backgroundImage !== 'none'; };
  for (const it of items) {
    if (it.r.r > VW + 2 && it.raw.r - it.raw.l > 3) add('spill', it, null, it.r, 'past the right edge of the page by ' + Math.round(it.r.r - VW) + 'px');
    let box = null; for (let p = it.kind === 'c' ? it.el.parentElement : it.el; p && p !== scope.parentElement; p = p.parentElement) { if (painted(p)) { box = p; break; } }
    if (!box) continue; const b = box.getBoundingClientRect(); if (b.width < 4 || b.height < 4) continue;
    const overX = Math.max(it.r.r - b.right, b.left - it.r.l), overY = it.r.b - b.bottom;
    if (overX > 2.5) add('spill', it, { el: box, text: 'its box is ' + Math.round(b.width) + 'px wide; out of the side by ' + Math.round(overX) + 'px' }, it.r);
    else if (overY > 3.5 && it.r.t < b.bottom + 400) add('spill', it, { el: box, text: 'its box is ' + Math.round(b.height) + 'px tall; out of the bottom by ' + Math.round(overY) + 'px' }, it.r);
  }
  for (const lab of scope.querySelectorAll('label.fl, .fl')) {
    if (!shown(lab) || lab.querySelector('input,select,textarea')) continue; const p = lab.parentElement; if (!p) continue;
    const ctl = lab.htmlFor ? document.getElementById(lab.htmlFor) : [...p.children].find(x => x !== lab && /^(INPUT|SELECT|TEXTAREA)$/.test(x.tagName)); if (!ctl || !shown(ctl) || ctl.type === 'checkbox' || ctl.type === 'radio') continue;
    const a = lab.getBoundingClientRect(), c = ctl.getBoundingClientRect(); if (a.width < 2 || c.width < 2) continue;
    if (c.top < a.bottom - 2 && c.bottom > a.top + 2 && !/flex|grid/.test(getComputedStyle(p).display)) add('inline', { el: lab, text: (lab.textContent || '').trim().slice(0, 40) }, { el: ctl, text: ctl.tagName.toLowerCase() + (ctl.id ? ' #' + ctl.id : '') }, { l: Math.min(a.left, c.left), t: Math.min(a.top, c.top), r: Math.max(a.right, c.right), b: Math.max(a.bottom, c.bottom) });
  }
  const dressed = [...scope.querySelectorAll('input[type=text],input[type=number],input[type=url],input[type=search]')].find(x => shown(x)), ref = dressed ? getComputedStyle(dressed) : null;
  for (const el of controls) {
    if (el.tagName !== 'INPUT' || !/^(password|time|month|week|datetime-local|email|tel|text|number|url|search|date)$/.test(el.type)) continue;
    if (parseFloat(getComputedStyle(el).borderTopLeftRadius) < 3 && (!ref || parseFloat(ref.borderTopLeftRadius) >= 3)) { const rc = el.getBoundingClientRect(); add('bare', { el, text: 'input[' + el.type + ']' + (el.id ? ' #' + el.id : '') }, null, { l: rc.left, t: rc.top, r: rc.right, b: rc.bottom }, 'not dressed by the style sheet'); }
  }
  for (const el of scope.querySelectorAll('button,.pill,.tag,.chip,.btn,.ibtn,th,.kv,.kl')) {
    if (el.closest('svg') || !shown(el)) continue; const cs = getComputedStyle(el); if (cs.overflowX === 'visible' || cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none') continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 8) { const rc = el.getBoundingClientRect(); if (rc.right < -50) continue; add('clipped', { el, text: (el.textContent || '').trim().slice(0, 40) }, null, { l: rc.left, t: rc.top, r: rc.right, b: rc.bottom }, 'cut off by ' + (el.scrollWidth - el.clientWidth) + 'px'); }
  }
  for (const svg of scope.querySelectorAll('svg')) {
    if (!shown(svg)) continue; const ts = [...svg.querySelectorAll('text')].filter(t => { if (!t.textContent.trim()) return false; const cs = getComputedStyle(t); return cs.visibility === 'visible' && cs.display !== 'none' && +cs.opacity > 0.05; }).map(t => ({ t, r: t.getBoundingClientRect() })).filter(x => x.r.width > 1 && x.r.height > 1);
    let n = 0; const ex = [];
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) { const a = ts[i].r, b = ts[j].r, ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 2 && iy > 2 && ix * iy > 0.25 * Math.min(a.width * a.height, b.width * b.height)) { n++; if (ex.length < 3) ex.push('"' + ts[i].t.textContent.trim().slice(0, 18) + '" over "' + ts[j].t.textContent.trim().slice(0, 18) + '"'); } }
    if (n) { const r = svg.getBoundingClientRect(); out.push({ type: 'labels', a: name(svg), aText: n + ' pair' + (n === 1 ? '' : 's') + ' of ' + ts.length + ' labels', b: '', bText: ex.join('; '), n, box: { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) } }); }
  }
  /* a drawing against what is round it, and a drawing's labels against its own marks */
  const drawn = e => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility === 'visible' && +cs.opacity > 0.05; };
  const inked = e => { if (e.tagName === 'text') return !!e.textContent.trim(); const cs = getComputedStyle(e), none = v => v === 'none' || v === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(v); return !(none(cs.fill) || +cs.fillOpacity === 0) || !(none(cs.stroke) || +cs.strokeOpacity === 0 || parseFloat(cs.strokeWidth) === 0); };
  for (const svg of scope.querySelectorAll('svg.chart')) {
    if (!shown(svg) || !svg.getClientRects().length) continue; const sr = svg.getBoundingClientRect(); if (sr.width < 20) continue;
    const boxOf = { l: sr.left, t: sr.top, r: sr.right, b: sr.bottom };
    /* a mark or a label above or below the chart's own frame is drawn over what the card has there: its heading, its caption */
    let top = 0, bottom = 0; const vbw = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal.width : 0, k = vbw ? sr.width / vbw : 1;
    for (const e of svg.querySelectorAll('rect,circle,path,line,text,polygon,polyline')) {
      if (e.classList.contains('hit') || !drawn(e) || !inked(e)) continue; const r = e.getBoundingClientRect(); if (!r.width && !r.height) continue;
      /* the room a typeface keeps above its capitals and under its baseline is not ink */
      const fs = e.tagName === 'text' ? (parseFloat(getComputedStyle(e).fontSize) || 11) * k : 0; top = Math.max(top, sr.top - (r.top + 0.3 * fs)); bottom = Math.max(bottom, (r.bottom - 0.2 * fs) - sr.bottom);
    }
    if (top > 2 || bottom > 2) add('frame', { el: svg, text: 'chart' }, null, boxOf, 'drawn ' + Math.round(Math.max(top, bottom)) + 'px past the ' + (top >= bottom ? 'top' : 'bottom') + ' of its own frame');
    /* a label with a line through it (a grid line, a marker, a trend line) that it has no halo against, or one that sits on a point */
    const labs = [...svg.querySelectorAll('text.lblm, text.lbl')].filter(t => t.textContent.trim() && drawn(t)), lines = [...svg.querySelectorAll('line')].filter(drawn), dots = [...svg.querySelectorAll('circle')].filter(drawn), m = svg.getScreenCTM();
    let n = 0; const ex = [];
    for (const t of labs) {
      const r = t.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; const cs = getComputedStyle(t), halo = /stroke/.test(cs.paintOrder) && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) >= 2; let what = '';
      for (const l of lines) {
        const b = l.getBoundingClientRect(); let through = false;
        if (b.height < 2) through = b.top > r.top + 2 && b.top < r.bottom - 2 && b.left < r.right - 2 && b.right > r.left + 2;
        else if (b.width < 2) through = b.left > r.left + 2 && b.left < r.right - 2 && b.top < r.bottom - 2 && b.bottom > r.top + 2;
        else if (m) { const P = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }), p = P(+l.getAttribute('x1') || 0, +l.getAttribute('y1') || 0), q = P(+l.getAttribute('x2') || 0, +l.getAttribute('y2') || 0), my = (r.top + r.bottom) / 2; if ((p.y - my) * (q.y - my) < 0) { const x = p.x + (q.x - p.x) * (my - p.y) / (q.y - p.y); through = x > r.left + 1 && x < r.right - 1; } }
        if (through && !(halo && !(t.compareDocumentPosition(l) & 4))) { what = 'has a line through it'; break; }
      }
      /* on a point: by the label's ink, not by the room its typeface keeps above its capitals and under its baseline */
      if (!what) { const fs = (parseFloat(cs.fontSize) || 11) * k, inkTop = r.top + 0.3 * fs, inkBottom = r.bottom - 0.2 * fs; for (const c of dots) { const b = c.getBoundingClientRect(); if (b.width > 18) continue; if (Math.min(b.right, r.right) - Math.max(b.left, r.left) > 1.5 && Math.min(b.bottom, inkBottom) - Math.max(b.top, inkTop) > 1.5) { what = 'sits on a point'; break; } } }
      if (what) { n++; if (ex.length < 3) ex.push('"' + t.textContent.trim().slice(0, 18) + '" ' + what); }
    }
    if (n) out.push({ type: 'struck', a: name(svg), aText: n + ' label' + (n === 1 ? '' : 's') + ' of ' + labs.length, b: '', bText: ex.join('; '), n, box: { x: Math.round(sr.left), y: Math.round(sr.top + scrollY), w: Math.round(sr.width), h: Math.round(sr.height) } });
  }
  /* the map: a place name under the map's own buttons */
  for (const svg of scope.querySelectorAll('svg.mapsvg')) {
    if (!shown(svg) || !svg.getClientRects().length) continue; const tools = svg.parentElement && svg.parentElement.querySelector('.maptools'); if (!tools || !shown(tools)) continue; const tr = tools.getBoundingClientRect();
    for (const t of svg.querySelectorAll('text')) { if (!t.textContent.trim() || !drawn(t)) continue; const r = t.getBoundingClientRect(); if (r.width < 2) continue; const ix = Math.min(r.right, tr.right) - Math.max(r.left, tr.left), iy = Math.min(r.bottom, tr.bottom) - Math.max(r.top, tr.top); if (ix > 0.5 && iy > 2.5) add('overlap', { el: tools, text: 'the map\'s zoom buttons' }, { el: svg, text: 'place name "' + t.textContent.trim().slice(0, 24) + '"' }, { l: Math.min(r.left, tr.left), t: Math.min(r.top, tr.top), r: Math.max(r.right, tr.right), b: Math.max(r.bottom, tr.bottom) }); }
  }
  /* a tick box as wide as a text field: a rule meant for text fields has stretched it, and its label is squeezed beside it */
  for (const el of controls) { if (el.tagName !== 'INPUT' || (el.type !== 'checkbox' && el.type !== 'radio')) continue; const rc = el.getBoundingClientRect(); if (rc.width > 40 && rc.width > 2.2 * rc.height) add('stretched', { el, text: 'input[' + el.type + ']' + (el.id ? ' #' + el.id : '') }, null, { l: rc.left, t: rc.top, r: rc.right, b: rc.bottom }, 'a tick box ' + Math.round(rc.width) + 'px wide'); }
  return { items: items.length, issues: out, pageWidth: document.documentElement.scrollWidth, viewport: VW };
}

export function covered(scopeSel) {
  const scope = document.querySelector(scopeSel); if (!scope) return { error: 'no scope ' + scopeSel };
  const VH = innerHeight, VW = document.documentElement.clientWidth, out = [], seen = new Set();
  const name = el => { const parts = []; for (let e = el, i = 0; e && e !== document.body && i < 4; e = e.parentElement, i++) { parts.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); if (e.id) break; } return parts.join(' > '); };
  const bar = scope.querySelector('.mbar'), barBottom = bar && getComputedStyle(bar).position === 'sticky' ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
  const closed = el => { const d = el.closest('details:not([open])'); return !!d && !(el.closest('summary') && el.closest('summary').parentElement === d); };
  /* inside every box above it that hides its overflow: a row scrolled out of sight in its own box is put away, not covered */
  const inView = (el, x, y) => { for (let p = el; p && p !== document.documentElement; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue; const b = p.getBoundingClientRect(); if ((cs.overflowX !== 'visible' && (x < b.left + 1 || x > b.right - 1)) || (cs.overflowY !== 'visible' && (y < b.top + 1 || y > b.bottom - 1))) return false; } return true; };
  const block = e => { for (let p = e; p; p = p.parentElement) { const d = getComputedStyle(p).display; if (!/^inline/.test(d) && d !== 'contents') return p; } return null; };
  const test = (el, rc, text, kind) => {
    const cx = (rc.left + rc.right) / 2, cy = (rc.top + rc.bottom) / 2; if (cx < 1 || cx > VW - 1 || cy < barBottom + 2 || cy > VH - 2 || !inView(el, cx, cy)) return;
    const hit = document.elementFromPoint(cx, cy); if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return;
    if (hit.closest('.mbar') || (hit.closest('th') && getComputedStyle(hit.closest('th')).position === 'sticky')) return;
    /* the middle of a line may fall on a neighbour drawn inline beside it: only a hit from outside the same block counts */
    if (kind === 't' && block(el) === block(hit)) return;
    const key = name(el) + '|' + text + '|' + name(hit); if (seen.has(key)) return; seen.add(key);
    out.push({ type: 'covered', a: name(el), aText: text, b: name(hit), bText: (hit.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40), box: { x: Math.round(rc.left), y: Math.round(rc.top + scrollY), w: Math.round(rc.width), h: Math.round(rc.height) } });
  };
  const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const s = n.nodeValue; if (!s || !s.trim()) continue; const el = n.parentElement; if (!el || el.closest('svg,script,style,select,option,textarea') || closed(el)) continue;
    const cs = getComputedStyle(el); if (cs.visibility !== 'visible' || cs.pointerEvents === 'none' || (el.checkVisibility && !el.checkVisibility({ checkOpacity: true }))) continue;
    const lead = s.length - s.trimStart().length, tail = s.trimEnd().length, range = document.createRange(); range.setStart(n, lead); range.setEnd(n, tail);
    for (const rc of range.getClientRects()) { if (rc.width < 6 || rc.height < 6 || rc.bottom < barBottom || rc.top > VH) continue; test(el, rc, s.trim().replace(/\s+/g, ' ').slice(0, 40), 't'); }
  }
  for (const el of scope.querySelectorAll('input:not([type=hidden]),select,textarea,button')) {
    if (el.closest('svg') || closed(el) || (el.checkVisibility && !el.checkVisibility({ checkOpacity: true })) || getComputedStyle(el).pointerEvents === 'none') continue;
    const rc = el.getBoundingClientRect(); if (rc.width < 6 || rc.height < 6 || rc.bottom < barBottom || rc.top > VH) continue; test(el, rc, (el.tagName.toLowerCase() + (el.id ? ' #' + el.id : '') + ' ' + (el.textContent || '').trim().slice(0, 24)).trim(), 'c');
  }
  return { issues: out };
}

/* ---------- the walk ---------- */
export const WIDTHS = [1440, 1190, 1024, 820, 600, 390];
export const KINDS = ['overlap', 'covered', 'touch', 'spill', 'inline', 'bare', 'stretched', 'clipped', 'labels', 'struck', 'frame'];

/* Walks an open dashboard (a session from live.open) and measures it. opts: widths; quick (the usual view of each module
   and the dialogs only, without pressing through the views); modules (keys to keep); cover (ask what is drawn over each
   line while scrolling, default true); onStep(width, module, view) for progress. Returns {runs, pageErrors}. */
export async function sweep(s, { widths = WIDTHS, quick = false, modules = null, cover = true, onStep = null } = {}) {
  const { page } = s, runs = [];
  const mods = (await page.evaluate(() => MODS.map(m => ({ key: m.key, num: m.num, title: m.title })))).filter(m => !modules || modules.includes(m.key));
  const run = async (w, mod, view, scope) => {
    if (onStep) onStep(w, mod, view);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(140);
    const r = await page.evaluate(detect, scope); if (r.error) { runs.push({ w, mod, view, error: r.error, issues: [] }); return; }
    runs.push({ w, mod, view, items: r.items, issues: r.issues, wider: Math.max(0, r.pageWidth - r.viewport) });
  };
  const scrollThrough = async (w, mod, view, scope) => {
    const H = await page.evaluate(() => document.documentElement.scrollHeight), issues = [], seen = new Set();
    for (let y = 0; y < H; y += 560) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(25); const r = await page.evaluate(covered, scope); for (const i of (r.issues || [])) { const k = i.a + '|' + i.aText + '|' + i.b; if (!seen.has(k)) { seen.add(k); issues.push(i); } } }
    await page.evaluate(() => window.scrollTo(0, 0)); runs.push({ w, mod, view: view + ', scrolled', items: 0, issues, wider: 0 });
  };
  const openDetails = scope => page.evaluate(sc => { const d = [...document.querySelectorAll(sc + ' details:not([open])')]; d.forEach(x => { x.open = true; }); return d.length; }, scope);
  const segs = scope => page.evaluate(sc => [...document.querySelectorAll(sc + ' .seg')].map((sg, i) => ({ i, n: sg.querySelectorAll('button').length })), scope);
  const throughSegs = async (w, key, scope, from, tag) => {
    for (const sg of (await segs(scope)).slice(from)) {
      for (let b = 0; b < sg.n; b++) {
        const label = await page.evaluate(({ sc, i, b }) => { const sg = document.querySelectorAll(sc + ' .seg')[i]; const btn = sg && sg.querySelectorAll('button')[b]; if (!btn || btn.getAttribute('aria-pressed') === 'true' || btn.disabled) return null; btn.click(); return (btn.textContent || btn.dataset.v || '').trim().slice(0, 24); }, { sc: scope, i: sg.i, b });
        if (label == null) continue; await page.waitForTimeout(260); await openDetails(scope); await run(w, key, `${tag}view "${label}"`, scope);
      }
      await page.evaluate(({ sc, i }) => { const sg = document.querySelectorAll(sc + ' .seg')[i]; const btn = sg && sg.querySelector('button'); if (btn && btn.getAttribute('aria-pressed') !== 'true') btn.click(); }, { sc: scope, i: sg.i }); await page.waitForTimeout(120);
    }
    return (await segs(scope)).length;
  };
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const m of mods) {
      await page.evaluate(k => showModule(k), m.key); await page.waitForTimeout(350);
      const scope = '#mod-' + m.key;
      await run(w, m.key, 'as it opens', scope); if (cover) await scrollThrough(w, m.key, 'as it opens', scope);
      if (!quick) {
        if (await openDetails(scope)) { await run(w, m.key, 'every section open', scope); if (cover) await scrollThrough(w, m.key, 'every section open', scope); }
        let nSegs = await throughSegs(w, m.key, scope, 0, '');
        const tables = await page.evaluate(sc => [...document.querySelectorAll(sc + ' table')].map((t, i) => (t.querySelector('tbody tr.click') ? i : -1)).filter(i => i >= 0).slice(0, 4), scope);
        for (const t of tables) {
          const ok = await page.evaluate(({ sc, t }) => { const tb = document.querySelectorAll(sc + ' table')[t], tr = tb && tb.querySelector('tbody tr.click'); if (!tr) return false; tr.click(); return true; }, { sc: scope, t });
          if (!ok) continue; await page.waitForTimeout(320); await openDetails(scope); await run(w, m.key, `a row of table ${t + 1} opened`, scope);
          const now = (await segs(scope)).length; if (now > nSegs) { await throughSegs(w, m.key, scope, nSegs, 'row open, '); nSegs = now; }
        }
        const chips = await page.evaluate(sc => Math.min(6, document.querySelectorAll(sc + ' .chip').length), scope);
        for (let c = 0; c < chips; c++) {
          const label = await page.evaluate(({ sc, c }) => { const ch = document.querySelectorAll(sc + ' .chip')[c]; if (!ch) return null; ch.click(); return (ch.textContent || '').trim().slice(0, 18); }, { sc: scope, c });
          if (label == null) continue; await page.waitForTimeout(220); await run(w, m.key, `filter "${label}"`, scope);
          await page.evaluate(({ sc, c }) => { const ch = document.querySelectorAll(sc + ' .chip')[c]; if (ch) ch.click(); }, { sc: scope, c }); await page.waitForTimeout(80);
        }
      }
      if (m.key === 'drhvac') {
        for (const [btn, id, what] of [['#d19Settings', '#d19SetPanel', 'settings dialog'], ['#d19Hist', '#d19HistPanel', 'history dialog']]) {
          if (!(await page.$(btn))) continue; await page.evaluate(() => window.scrollTo(0, 0)); await page.click(btn).catch(() => { }); await page.waitForTimeout(250);
          if (await page.$(id)) { await run(w, m.key, what, id); await page.evaluate(id => { const p = document.querySelector(id); if (p) p.remove(); }, id); }
        }
      }
    }
    if (!modules || modules.includes('shell')) {
      await page.evaluate(k => showModule(k), mods.length ? mods[0].key : ''); await page.waitForTimeout(150);
      if (await page.$('#brandBtn')) { await page.click('#brandBtn').catch(() => { }); await page.waitForTimeout(300); if (await page.$('#brandPanel')) { await run(w, 'shell', 'Brand dialog', '#brandPanel'); await page.evaluate(() => { const q = document.querySelector('#brandPanel'); if (q) q.remove(); }); } }
      if (await page.$('header.shell-top')) await run(w, 'shell', 'header', 'header.shell-top');
      if (await page.$('#rail')) await run(w, 'shell', 'rail', '#rail');
    }
  }
  return { runs, pageErrors: s.errors.slice() };
}

/* ---------- reading the result ---------- */
/* {total, byKind, byModule: {module: {kind: n}}, views, widest} */
export function tally(report) {
  const byKind = Object.fromEntries(KINDS.map(k => [k, 0])), byModule = {}; let total = 0, widest = 0;
  for (const r of report.runs) { widest = Math.max(widest, r.wider || 0); for (const i of r.issues) { const n = i.n || 1; byKind[i.type] = (byKind[i.type] || 0) + n; (byModule[r.mod] = byModule[r.mod] || {})[i.type] = ((byModule[r.mod] || {})[i.type] || 0) + n; total += n; } }
  return { total, byKind, byModule, views: report.runs.length, widest, errors: report.runs.filter(r => r.error).length };
}
/* findings that share a place, as one line each: [{kind, module, where, n, widths, views, example}] */
export function patterns(report) {
  const norm = s => String(s).replace(/#([a-zA-Z_-]*?)\d+\b/g, '#$1N').replace(/\s+/g, ' '), groups = new Map();
  for (const r of report.runs) for (const i of r.issues) {
    const k = `${i.type}|${r.mod}|${norm(i.a)}|${norm(i.b)}`; let g = groups.get(k);
    if (!g) groups.set(k, g = { kind: i.type, module: r.mod, where: norm(i.a) + (i.b ? '  ×  ' + norm(i.b) : ''), n: 0, widths: new Set(), views: new Set(), example: `"${i.aText}"${i.bText ? ` × "${i.bText}"` : ''}` });
    g.n += i.n || 1; g.widths.add(r.w); g.views.add(r.view);
  }
  return [...groups.values()].map(g => Object.assign(g, { widths: [...g.widths].sort((a, b) => b - a), views: [...g.views] })).sort((a, b) => b.n - a.n);
}
const WHAT = { overlap: 'on top of each other', covered: 'covered by something else', touch: 'side by side with no room between', spill: 'out of its box', inline: 'label, field and text run together', bare: 'text field the style sheet does not dress', stretched: 'tick box stretched to a field\'s width', clipped: 'own text cut off', labels: 'chart labels over each other', struck: 'chart label with a line through it or on a point', frame: 'chart drawn past its own frame' };
export function layoutText(report, { name = 'The dashboard', repaired = null, max = 40 } = {}) {
  const t = tally(report), pats = patterns(report), widths = [...new Set(report.runs.map(r => r.w))];
  const head = `${name}${repaired == null ? '' : repaired ? ', with the layout repairs in' : ', as it is, without the layout repairs'}: ${t.views} views measured at ${widths.length === 1 ? widths[0] + ' px' : widths.join(', ') + ' px'} wide.`;
  if (!t.total && !t.widest) return [head, 'Nothing overlaps, crowds or spills in any of them.', ...(report.pageErrors.length ? ['The page raised errors: ' + report.pageErrors.slice(0, 3).join(' | ')] : [])].join('\n');
  return [head, `${t.total} finding${t.total === 1 ? '' : 's'} in ${pats.length} place${pats.length === 1 ? '' : 's'}: ` + KINDS.filter(k => t.byKind[k]).map(k => `${t.byKind[k]} ${WHAT[k]}`).join('; ') + '.',
    ...(t.widest ? [`The page itself is wider than the window by up to ${t.widest} px in some view.`] : []), '',
    ...pats.slice(0, max).flatMap(p => [`${String(p.n).padStart(4)}  ${p.module}: ${WHAT[p.kind]}`, `      ${p.where}`, `      ${p.example}`, `      at ${p.widths.join(', ')} px · ${p.views.slice(0, 3).join('; ')}${p.views.length > 3 ? '; and ' + (p.views.length - 3) + ' more views' : ''}`]),
    ...(pats.length > max ? [`      … and ${pats.length - max} more places (--json has all of them)`] : []),
    ...(report.pageErrors.length ? ['', 'The page raised errors: ' + report.pageErrors.slice(0, 3).join(' | ')] : [])].join('\n');
}
