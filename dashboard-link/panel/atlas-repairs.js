/* ==== leviathan layout repairs: chart and map labels ==== */
/* The repairs a style sheet cannot make. The dashboard draws every chart label where its point is and every bar to its
   full height, with no look at what is already there. After a chart or a map is drawn, this puts right what landed on
   something else:

     an axis title over a tick      the title moves up, and the chart's frame grows upward to hold it
     a bar above the chart's frame  (the bar chart's scale stops at its last tick, so a taller bar is drawn over the
                                    card's heading) the frame grows upward to hold the bar
     a scatter label over another   it is tried at seven other places round its point; if none is free it is left out,
     label or over another point    and the point keeps its tooltip
     a line through a label         a grid line, a marker line or a trend line: the label is marked for a halo (rule 8 of
                                    the sheet) and drawn after the line, so the line breaks around it
     a place name under the map's   the name is left out while it is there, and comes back when the map is moved
     zoom buttons
     a place name over another      on the map of a build that does not see to this itself (before Build 6), the name of
                                    lower rank is left out, as Build 6 does

   It touches only the dashboard's own charts (svg.chart) and map (svg.mapsvg), and of those only text, the order text
   is drawn in, and the frame. It changes no number and no mark. A chart is done once, when it is on screen. If anything
   here fails, the drawing stays as the dashboard drew it. */
(function () {
  "use strict";
  if (typeof document === 'undefined' || !document.querySelector) return;
  var DONE = 'data-lv-tidy', OUT = 'data-lv-left-out', HALO = 'data-lv-halo';
  function box(t) { try { var b = t.getBBox(); return b && b.width > 0 ? { l: b.x, t: b.y, r: b.x + b.width, b: b.y + b.height } : null; } catch (e) { return null; } }
  function hit(a, b, pad) { return !!a && !!b && a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad; }
  function num(e, a) { var v = parseFloat(e.getAttribute(a)); return isFinite(v) ? v : 0; }
  function seen(e) { var cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05; }
  /* does a straight line run through a label's box: across it (a grid line), down it (a marker), or at a slant (a trend) */
  function through(l, b) {
    var x1 = num(l, 'x1'), y1 = num(l, 'y1'), x2 = num(l, 'x2'), y2 = num(l, 'y2');
    if (Math.abs(y1 - y2) < 0.5) return y1 > b.t + 2 && y1 < b.b - 2 && Math.min(x1, x2) < b.r - 2 && Math.max(x1, x2) > b.l + 2;
    if (Math.abs(x1 - x2) < 0.5) return x1 > b.l + 2 && x1 < b.r - 2 && Math.min(y1, y2) < b.b - 2 && Math.max(y1, y2) > b.t + 2;
    var my = (b.t + b.b) / 2; if ((y1 - my) * (y2 - my) >= 0) return false;
    var x = x1 + (x2 - x1) * (my - y1) / (y2 - y1); return x > b.l + 1 && x < b.r - 1;
  }
  function tidy(svg) {
    if (svg.getAttribute(DONE) || !svg.getClientRects().length) return;
    var texts = [].slice.call(svg.querySelectorAll('text')), ticks = texts.filter(function (t) { return t.classList.contains('ax'); }), titles = texts.filter(function (t) { return t.classList.contains('axl'); });
    var labels = texts.filter(function (t) { return t.classList.contains('lblm') || t.classList.contains('lbl'); });
    /* the axis title that sits at the top left corner, over the top tick: it moves up by its own height */
    titles.forEach(function (t) {
      var x = parseFloat(t.getAttribute('x')), y = parseFloat(t.getAttribute('y')); if (!(x <= 12 && y <= 16) || t.getAttribute('transform')) return;
      var b = box(t); if (!b || !ticks.some(function (k) { return hit(b, box(k), 1); })) return;
      t.setAttribute('y', y - (Math.ceil(b.b - b.t) + 3));
    });
    /* a scatter's labels. The scatter draws each 9 above its point, in the middle. One that would cover a label already
       placed, a tick, a title or another point is tried round its own point, and left out if no place is free. A label
       that is not a scatter's (a note beside a marker, a value over a bar) has no tooltip to fall back on, and stays. */
    var dots = [].slice.call(svg.querySelectorAll('circle')).map(function (c) { var b = box(c); return b ? { b: b, cx: num(c, 'cx'), cy: num(c, 'cy'), r: num(c, 'r') } : null; }).filter(Boolean);
    var fixed = ticks.concat(titles).map(box).filter(Boolean), kept = [];
    labels.forEach(function (t) {
      var x = parseFloat(t.getAttribute('x')), y = parseFloat(t.getAttribute('y')), anchor = t.getAttribute('text-anchor') || 'start', own = null;
      if (anchor === 'middle' && isFinite(x) && isFinite(y) && !t.getAttribute('transform')) own = dots.filter(function (d) { return d.r <= 8 && Math.abs(d.cx - x) < 0.6 && Math.abs(d.cy - (y + 9)) < 0.6; })[0] || null;
      if (!own) {
        /* a note beside a marker or a line (it starts or ends at its anchor): where it lands on a note already placed,
           a tick or a point, it moves down a row at a time, three at most, as the dashboard's own notes are staggered
           from Build 6; failing that, along its line away from its anchor, inside the frame. With no free place it
           stays where it was drawn. A value centred over a bar is never moved. */
        var b0 = box(t);
        if (b0 && anchor !== 'middle' && isFinite(x) && isFinite(y) && !t.getAttribute('transform')) {
          var frame = svg.viewBox && svg.viewBox.baseVal, inside = function (q) { return !frame || !frame.width || (q.l >= frame.x && q.r <= frame.x + frame.width); };
          var clear = function () { var q = box(t); return q && inside(q) && !kept.concat(fixed).some(function (k) { return hit(q, k, 1); }) && !dots.some(function (d) { return hit(q, d.b, -1); }) ? q : null; };
          var q = clear(), s;
          for (s = 1; !q && s <= 3; s++) { t.setAttribute('y', y + 13 * s); q = clear(); }
          if (!q) { t.setAttribute('y', y); for (s = 1; !q && s <= 3; s++) { t.setAttribute('x', x + (anchor === 'end' ? -12 : 12) * s); q = clear(); } if (!q) t.setAttribute('x', x); }
          if (q) b0 = q;
        }
        if (b0) kept.push(b0); return;
      }
      var others = dots.filter(function (d) { return d !== own; }).map(function (d) { return d.b; });
      var free = function () { var b = box(t); return b && !kept.concat(fixed, others).some(function (k) { return hit(b, k, 1); }) ? b : null; };
      var b = free(); if (b) { kept.push(b); return; }
      /* below its point the label must clear the point by the height its typeface stands above the baseline, which
         differs from one typeface to the next: measured here, not assumed */
      var first = box(t), rise = first ? y - first.t : 10.5, k = Math.max(0, own.r - 5);
      var tries = [[x, y + 9 + own.r + 1.75 + rise, 'middle'], [x + 9 + k, y + 12, 'start'], [x - 9 - k, y + 12, 'end'], [x + 8 + k, y + 3, 'start'], [x - 8 - k, y + 3, 'end'], [x + 8 + k, y + 21, 'start'], [x - 8 - k, y + 21, 'end']];
      for (var i = 0; i < tries.length; i++) { t.setAttribute('x', tries[i][0]); t.setAttribute('y', tries[i][1]); t.setAttribute('text-anchor', tries[i][2]); b = free(); if (b) { kept.push(b); return; } }
      t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('text-anchor', anchor);
      t.style.display = 'none'; t.setAttribute(OUT, '1');
    });
    /* a line through a label: the label gets a halo and is drawn after the line. The halo is the colour of what the
       label is drawn on: the card, or a band of the chart when the label sits on one. */
    var lines = [].slice.call(svg.querySelectorAll('line')).filter(seen), stop = svg.querySelector('.hit'), bands = [].slice.call(svg.querySelectorAll('rect')).filter(function (r) { return !r.classList.contains('hit') && seen(r); });
    labels.forEach(function (t) {
      if (t.getAttribute(OUT) || t.getAttribute('transform')) return; var b = box(t); if (!b) return;
      var cross = lines.filter(function (l) { return l.parentNode === t.parentNode && through(l, b); }); if (!cross.length) return;
      t.setAttribute(HALO, '1');
      var cx = (b.l + b.r) / 2, cy = (b.t + b.b) / 2, on = null;
      bands.forEach(function (r) { var q = box(r); if (q && r.parentNode === t.parentNode && cx > q.l && cx < q.r && cy > q.t && cy < q.b && (q.r - q.l) * (q.b - q.t) > 4 * (b.r - b.l) * (b.b - b.t)) on = r; });
      if (on) { var cs = getComputedStyle(on), share = Math.round(100 * Math.max(0, Math.min(1, parseFloat(cs.opacity) * parseFloat(cs.fillOpacity)))); if (cs.fill && cs.fill !== 'none' && share > 0) t.style.stroke = 'color-mix(in srgb, ' + cs.fill + ' ' + share + '%, var(--card))'; }
      if (cross.some(function (l) { return (t.compareDocumentPosition(l) & 4) !== 0; })) { if (stop && stop.parentNode === t.parentNode) t.parentNode.insertBefore(t, stop); else t.parentNode.appendChild(t); }
    });
    /* what rises above the chart's own frame would be drawn over the card's heading: the frame grows upward to hold it.
       The room a typeface keeps above its capitals is not ink, so a label counts from a little under the top of its box. */
    var vb = svg.viewBox && svg.viewBox.baseVal, top = vb ? vb.y : 0;
    if (vb && vb.width) {
      [].forEach.call(svg.querySelectorAll('rect,circle,path,line,polygon,polyline,text'), function (e) {
        if (e.classList.contains('hit') || !seen(e)) return; var q = null; try { q = e.getBBox(); } catch (x) { q = null; } if (!q || (!q.width && !q.height)) return;
        var y = q.y + (e.tagName === 'text' ? 0.3 * (parseFloat(getComputedStyle(e).fontSize) || 11) : 0); if (y < top) top = y;
      });
      if (top < vb.y - 0.75) { var up = Math.ceil(vb.y - top) + 2; svg.setAttribute('viewBox', vb.x + ' ' + (vb.y - up) + ' ' + vb.width + ' ' + (vb.height + up)); }
    }
    svg.setAttribute(DONE, '1');
  }

  /* The map. Two things can sit on a place name: the map's own zoom buttons, and another place name.
     From Build 6 the dashboard leaves out a name that would be printed over another (ZipMap.declutter: cities first,
     then counties, each kept if it is clear of those already kept). A build without it prints county names over city
     names, "Dallas" the county on "Dallas" the city: for such a build this does the same thing, with the two major
     cities placed before the rest so that neither is the one left out. On every build a name under the zoom buttons
     is left out while it is there. A name the dashboard hid is shown by this only where it is clear of every name on
     show. */
  function mapOwn() { try { return typeof ZipMap === 'function' && typeof ZipMap.prototype.declutter === 'function'; } catch (e) { return false; } }
  function over(a, b) { return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; }
  function names(svg, own) {
    if (!svg.getClientRects().length) return;
    var tools = svg.parentNode && svg.parentNode.querySelector ? svg.parentNode.querySelector('.maptools') : null, tb = tools && tools.getClientRects().length ? tools.getBoundingClientRect() : null;
    /* the two cities the map is named for first, then the other cities, then the counties */
    var ls = [].slice.call(svg.querySelectorAll('text.lab')).map(function (t, i) { return { g: t.parentNode, rank: t.classList.contains('ct') ? 1000 + i : t.classList.contains('mj') ? i - 500 : i }; }).sort(function (a, b) { return a.rank - b.rank; });
    if (!own) {
      var kept = tb ? [tb] : [];
      ls.forEach(function (l) {
        if (l.g.getAttribute(OUT)) { l.g.style.display = ''; l.g.removeAttribute(OUT); }
        if (l.g.style.display === 'none') return;
        var r = l.g.getBoundingClientRect();
        if (r.width > 0 && kept.some(function (q) { return over(r, q); })) { l.g.style.display = 'none'; l.g.setAttribute(OUT, '1'); } else kept.push(r);
      });
      return;
    }
    if (!tb) return;
    var shown = [];
    ls.forEach(function (l) {
      if (l.g.style.display === 'none') return;
      l.g.removeAttribute(OUT);
      var r = l.g.getBoundingClientRect();
      if (r.width > 0 && over(r, tb)) { l.g.style.display = 'none'; l.g.setAttribute(OUT, '1'); } else shown.push(r);
    });
    ls.forEach(function (l) {
      if (!l.g.getAttribute(OUT)) return;
      l.g.style.display = ''; var r = l.g.getBoundingClientRect();
      if (r.width > 0 && (over(r, tb) || shown.some(function (q) { return over(r, q); }))) l.g.style.display = 'none'; else { l.g.removeAttribute(OUT); shown.push(r); }
    });
  }

  var due = 0;
  function sweep() {
    due = 0;
    try { [].forEach.call(document.querySelectorAll('svg.chart:not([' + DONE + '])'), function (s) { try { tidy(s); } catch (e) { s.setAttribute(DONE, 'failed'); } }); } catch (e) { /* the charts stay as drawn */ }
    try { var own = mapOwn(); [].forEach.call(document.querySelectorAll('svg.mapsvg'), function (s) { try { names(s, own); } catch (e) { /* this map stays as drawn */ } }); } catch (e) { /* the maps stay as drawn */ }
  }
  function soon() { if (!due) due = setTimeout(sweep, 60); }
  function start() {
    try {
      var host = document.getElementById('modules') || document.body;
      /* a module shown or hidden, a chart drawn again, and the map moved (it places its names by their transform) */
      new MutationObserver(soon).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'transform'] });
      window.addEventListener('hashchange', soon); window.addEventListener('resize', soon); soon();
    } catch (e) { /* no observer: nothing is repaired, nothing is broken */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
