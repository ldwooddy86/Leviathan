/* The layout repairs inside the running dashboard. Needs Playwright with Chromium; without them this file says so and
   passes.

   The copy of the dashboard carries repairs to places where the dashboard's own text and controls overlapped, crowded
   each other or spilled out of their box (panel/atlas-repairs.css and .js). This opens the dashboard twice, as it was
   delivered and with the repairs in, and measures both with the sweep in lib/layout.mjs. Then it goes to each repaired
   place and checks the geometry directly, so a repair that stops working is named.

   It also holds the repairs to what they promise not to do: they change no word of the dashboard, raise no error, and
   leave alone what was right (a row of fields that fitted still shares its row; a build that keeps its own map tidy has
   no name taken off its map but the one under the zoom buttons).
   Runs against the console's atlas (Build 4), and against ATLAS_HTML as well when set (Build 6 has more to repair:
   Dr. HVAC's settings are new in it). Nothing of an ATLAS_HTML file is printed but counts. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, atlasFile, tmp, gitState } from '../_t.mjs';
import * as live from '../../lib/live.mjs';
import { installPanel, stripPanel } from '../../lib/panel.mjs';
import { sweep, tally, patterns, detect } from '../../lib/layout.mjs';

const av = await live.available();
if (!av.ok) { console.log('skip  no browser here, so the layout repairs were not tested in a dashboard: ' + av.why); process.exit(0); }
const before = gitState(), targets = [{ label: 'the console\'s atlas', file: atlasFile() }];
if (process.env.ATLAS_HTML) targets.push({ label: 'ATLAS_HTML', file: path.resolve(process.env.ATLAS_HTML) });
const brief = t => Object.entries(t.byKind).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ') || 'nothing';
const WIDTHS = [1190, 820, 390];

/* ---------- what is read off a page, with the repairs or without ---------- */
const show = async (sess, w, key) => { await sess.page.setViewportSize({ width: w, height: 900 }); await sess.page.evaluate(k => { showModule(k); window.scrollTo(0, 0); document.querySelectorAll('#mod-' + k + ' details:not([open])').forEach(d => { d.open = true; }); }, key); await sess.page.waitForTimeout(350); };
/* a module's words: its own text exactly, and the text of its drawings as a set (a label may be drawn in another order) */
const words = async (sess, keys) => { const out = {}; for (const k of keys) out[k] = await sess.page.evaluate(k => { showModule(k); const m = document.querySelector('#mod-' + k), c = m.cloneNode(true); c.querySelectorAll('svg').forEach(s => s.remove()); return c.textContent.replace(/\s+/g, ' ').trim() + ' ¦ ' + [...m.querySelectorAll('svg text')].map(t => t.textContent.trim()).sort().join('|'); }, k); return out; };
/* a pair of fields that share a cell: do they share a row, and are they inside the cell */
const pairOf = (sess, a, b) => sess.page.evaluate(([a, b]) => { const x = document.querySelector(a), y = document.querySelector(b); if (!x || !y || !x.getClientRects().length) return null; const cell = y.closest('.f').getBoundingClientRect(), ra = x.getBoundingClientRect(), rb = y.getBoundingClientRect(); return { inside: rb.right <= cell.right + 1 && ra.left >= cell.left - 1, sameRow: Math.abs(ra.top - rb.top) < 3, cell: Math.round(cell.width), wide: Math.round(Math.min(ra.width, rb.width)), first: Math.round(ra.width), second: Math.round(rb.width) }; }, [a, b]);
/* the tick boxes of the connection cards: how wide each is drawn */
const ticks = (sess, key) => sess.page.evaluate(k => [...document.querySelectorAll('#mod-' + k + ' .conn .plan input[type=checkbox]')].filter(x => x.getClientRects().length).map(x => { const r = x.getBoundingClientRect(), lab = x.closest('label'), range = document.createRange(); let lines = 0; if (lab) { range.selectNodeContents(lab); lines = new Set([...range.getClientRects()].filter(q => q.width > 2).map(q => Math.round(q.top / 6))).size; } return { w: Math.round(r.width), h: Math.round(r.height), lines }; }), key);
/* each chart on screen: is any mark above its frame, and how many of its labels are left out */
const chartsOf = (sess, key) => sess.page.evaluate(k => [...document.querySelectorAll('#mod-' + k + ' svg.chart')].filter(s => s.getClientRects().length).map(s => {
  const sr = s.getBoundingClientRect(), vis = e => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility === 'visible' && +cs.opacity > 0.05; };
  const ts = [...s.querySelectorAll('text')].filter(t => t.textContent.trim() && vis(t)).map(t => t.getBoundingClientRect()).filter(r => r.width > 1); let pairs = 0;
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) { const a = ts[i], b = ts[j], ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 2 && iy > 2 && ix * iy > 0.25 * Math.min(a.width * a.height, b.width * b.height)) pairs++; }
  let above = 0; for (const e of s.querySelectorAll('rect,circle,path,polygon,polyline')) { if (e.classList.contains('hit') || !vis(e)) continue; const cs = getComputedStyle(e); if ((cs.fill === 'none' || /, 0\)$/.test(cs.fill)) && cs.stroke === 'none') continue; const r = e.getBoundingClientRect(); if (r.width || r.height) above = Math.max(above, sr.top - r.top); }
  return { key: k, id: s.parentElement.id || '', tidied: s.getAttribute('data-lv-tidy'), pairs, above: Math.round(above * 10) / 10, labels: s.querySelectorAll('text.lblm, text.lbl').length, leftOut: s.querySelectorAll('text[data-lv-left-out]').length, halo: s.querySelectorAll('text[data-lv-halo]').length };
}), key);

for (const { label, file } of targets) {
  const T = s => `${label}: ${s}`, dir = tmp('lv-repairs-'), text = stripPanel(fs.readFileSync(file, 'utf8'));
  const plain = path.join(dir, 'as-delivered.html'), fixed = path.join(dir, 'with-repairs.html'); fs.writeFileSync(plain, text); fs.writeFileSync(fixed, installPanel(text, { bundles: [] }));

  /* ---------- as delivered: what the sweep finds, and the places a repair must leave as they are ---------- */
  const raw = await live.open(plain); let was, wasT, base;
  try {
    was = await sweep(raw, { widths: WIDTHS, quick: true, cover: false }); wasT = tally(was);
    const keys = await raw.page.evaluate(() => MODS.map(m => m.key)), wordKeys = keys.filter(k => !['agents', 'weather', 'live', 'heat'].includes(k));
    base = { keys, wordKeys, words: await words(raw, wordKeys), desk: null, ticks: [], above: [] };
    if (keys.includes('desk')) { await show(raw, 1190, 'desk'); base.desk = await pairOf(raw, '#dkStart', '#dkWeeks'); }
    if (keys.includes('publish')) { await show(raw, 1190, 'publish'); base.ticks = await ticks(raw, 'publish'); }
    for (const k of keys) { await show(raw, 1190, k); base.above.push(...(await chartsOf(raw, k)).filter(c => c.above > 2)); }
  } finally { await raw.close(); }
  ok(wasT.byKind.bare > 0 && wasT.total > 0 && was.pageErrors.length === 0, T(`as delivered, the sweep finds what there is to repair (${brief(wasT)} in ${wasT.views} views)`));

  const s = await live.open(fixed);
  try {
    const { page } = s, has = await page.evaluate(() => ({ keys: MODS.map(m => m.key), repairs: !!document.getElementById('lvp-repairs') && !!document.getElementById('lvp-repairs-js') }));
    const now = await sweep(s, { widths: WIDTHS, quick: true }), nowT = tally(now);
    ok(has.repairs && nowT.total === 0 && nowT.widest === 0 && nowT.errors === 0 && now.pageErrors.length === 0, T(`with the repairs in, nothing overlaps, crowds or spills in ${nowT.views} views at ${WIDTHS.join(', ')} px, the Agent Desk included`), patterns(now).slice(0, 3).map(p => `${p.module} ${p.kind}: ${p.example}`).join(' | ') || now.pageErrors[0]);

    /* ---------- each repair, where it applies ---------- */
    const at = (w, key) => show(s, w, key);
    /* 1. password fields are dressed like the text fields beside them */
    const pw = [];
    for (const key of ['publish', 'accounts', 'watch'].filter(k => has.keys.includes(k))) { await at(1190, key); pw.push(...await page.evaluate(k => { const ref = [...document.querySelectorAll('#mod-' + k + ' input[type=text], #mod-' + k + ' input[type=url]')].find(x => x.getClientRects().length), rs = ref ? getComputedStyle(ref) : null; return [...document.querySelectorAll('#mod-' + k + ' input[type=password]')].filter(x => x.getClientRects().length).map(x => { const cs = getComputedStyle(x); return { radius: parseFloat(cs.borderTopLeftRadius), sameBorder: !rs || cs.borderTopColor === rs.borderTopColor, sameBack: !rs || cs.backgroundColor === rs.backgroundColor, sameHeight: !ref || Math.abs(x.getBoundingClientRect().height - ref.getBoundingClientRect().height) <= 1.5 }; }); }, key)); }
    ok(pw.length > 0 && pw.every(p => p.radius >= 3 && p.sameBorder && p.sameBack && p.sameHeight), T(`all ${pw.length} password fields on screen have the border, the background and the height of the text fields beside them`), pw.filter(p => !(p.radius >= 3 && p.sameBorder && p.sameBack && p.sameHeight)).length + ' do not');

    /* 2. two date fields in one cell: side by side when there is room, stacked when there is not, never out of the cell */
    if (has.keys.includes('watch')) {
      const pair = async w => { await at(w, 'watch'); const p = await pairOf(s, '#wfFirst', '#wfLast'); return p && Object.assign(p, { room: p.cell >= 274 }); };
      const narrow = await pair(820), wide = await pair(1440);
      ok(narrow && wide && narrow.inside && wide.inside && wide.sameRow === wide.room && narrow.sameRow === narrow.room && narrow.wide >= 133 && wide.wide >= 133, T('Competitor Watch: the two date fields stay inside their cell, share a row only where both dates fit, and neither is squeezed below the width of its date'), { narrow, wide });
    }
    /* and a date beside a field of another kind is left as it was: the Campaign Desk's flight start and its weeks */
    if (base.desk) {
      await at(1190, 'desk'); const d = await pairOf(s, '#dkStart', '#dkWeeks');
      ok(d && d.inside && d.sameRow === base.desk.sameRow && Math.abs(d.second - base.desk.second) <= 1 && Math.abs(d.first - base.desk.first) <= 2, T(`Campaign Desk: the flight start and its weeks ${base.desk.sameRow ? 'share their row' : 'sit'} as they did as delivered, each the width it was`), { now: d, was: base.desk });
    }

    /* 3. a table wider than its card scrolls inside it */
    if (has.keys.includes('replace')) {
      await at(1024, 'replace');
      const tb = await page.evaluate(() => { const out = []; for (const t of document.querySelectorAll('#mod-replace table')) { const host = t.parentElement, card = t.closest('.card'); if (!card || !t.getClientRects().length) continue; const tr = t.getBoundingClientRect(), hr = host.getBoundingClientRect(), cr = card.getBoundingClientRect(); out.push({ wider: tr.width > hr.width + 1, scrolls: /auto|scroll/.test(getComputedStyle(host).overflowX), hostInside: hr.right <= cr.right + 1 }); } return out; });
      ok(tb.length > 0 && tb.every(x => x.hostInside && (!x.wider || x.scrolls)) && tb.some(x => x.wider), T(`Replacement Wave at 1024 px: of ${tb.length} tables, the ${tb.filter(x => x.wider).length} wider than their card scroll sideways inside it`), tb.filter(x => x.wider && !x.scrolls).length + ' spill');
    }

    /* 4. charts: no label on another, nothing above the frame, and what was left out can still be read off its point */
    const charts = [], tips = [];
    for (const key of has.keys.filter(k => k !== 'agents')) {
      await at(1190, key); charts.push(...await chartsOf(s, key));
      tips.push(...await page.evaluate(k => { const out = []; for (const t of document.querySelectorAll('#mod-' + k + ' svg.chart text[data-lv-left-out]')) { const svg = t.closest('svg'), x = +t.getAttribute('x'), y = +t.getAttribute('y'), c = [...svg.querySelectorAll('circle')].find(c => Math.abs(+c.getAttribute('cx') - x) < 0.6 && Math.abs(+c.getAttribute('cy') - (y + 9)) < 0.6); if (!c) { out.push(false); continue; } const r = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); out.push(TIP.classList.contains('on') && TIP.textContent.includes(t.textContent.trim())); c.dispatchEvent(new MouseEvent('mouseleave')); } return out; }, key));
    }
    const leftOut = charts.reduce((n, c) => n + c.leftOut, 0), labels = charts.reduce((n, c) => n + c.labels, 0);
    ok(charts.length > 5 && charts.every(c => c.tidied === '1' && c.pairs === 0) && leftOut <= Math.max(6, Math.round(labels * 0.2)), T(`charts: all ${charts.length} on screen were looked at, no label sits on another, and ${leftOut} of ${labels} labels were left out for want of room`), charts.filter(c => c.pairs || c.tidied !== '1').slice(0, 3));
    ok(tips.length === leftOut && tips.every(Boolean), T(`every one of the ${leftOut} labels left out belongs to a scatter point, and pointing at that point still shows it`), tips.filter(x => !x).length + ' do not');
    ok(charts.every(c => c.above <= 2) && (base.above.length === 0 || base.above.every(b => charts.some(c => c.id === b.id && c.above <= 2))), T(base.above.length ? `the ${base.above.length} charts whose bars rose above their own frame as delivered (by up to ${Math.round(Math.max(...base.above.map(b => b.above)))} px, over the card's heading) now hold them` : 'no chart draws a mark above its own frame, as none did as delivered'), charts.filter(c => c.above > 2).slice(0, 3));

    /* 4b. the map: no place name over another, and none under the zoom buttons. From Build 6 the dashboard sees to the
       first itself; on an earlier build the repair does. Zoomed in, names that now have room come back. */
    const mapsOf = k => page.evaluate(k => [...document.querySelectorAll('#mod-' + k + ' svg.mapsvg')].filter(s => s.getClientRects().length).map(s => { const on = g => getComputedStyle(g).display !== 'none', gs = [...s.querySelectorAll('text.lab')].map(t => t.parentNode).filter(on), rs = gs.map(g => g.getBoundingClientRect()), tools = s.parentElement.querySelector('.maptools'), tr = tools ? tools.getBoundingClientRect() : null; let pairs = 0; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) pairs++; } return { key: k, names: s.querySelectorAll('text.lab').length, shown: gs.length, pairs, under: tr ? rs.filter(r => r.left < tr.right && tr.left < r.right && r.top < tr.bottom && tr.top < r.bottom).length : 0, ours: s.querySelectorAll('g[data-lv-left-out]').length, majors: [...s.querySelectorAll('text.lab.mj')].filter(t => on(t.parentNode)).length, mj: s.querySelectorAll('text.lab.mj').length }; }), k);
    const maps = [], phone = []; let mapKey = '';
    for (const key of has.keys.filter(k => k !== 'agents')) { await at(1190, key); const m = await mapsOf(key); if (m.length && !mapKey) mapKey = key; maps.push(...m); }
    for (const key of has.keys.filter(k => k !== 'agents')) { await at(390, key); phone.push(...await mapsOf(key)); }
    const own = await page.evaluate(() => typeof ZipMap === 'function' && typeof ZipMap.prototype.declutter === 'function');
    ok(maps.length > 0 && maps.concat(phone).every(m => m.pairs === 0 && m.under === 0 && m.shown >= 8 && m.shown < m.names) && maps.every(m => m.majors === m.mj) && phone.every(m => m.majors >= 1) && (own ? maps.every(m => m.ours <= 2) : maps.concat(phone).every(m => m.ours > 0)),
      T(own ? `the map: this build leaves out a place name that would cover another by itself; on its ${maps.length} maps the repair took off only a name under the zoom buttons (${maps.reduce((n, m) => n + m.ours, 0)} at 1190 px, ${phone.reduce((n, m) => n + m.ours, 0)} at 390 px), and at 1190 px every major city keeps its name` : `the map: on all ${maps.length} maps no place name is printed over another or under the zoom buttons (this build does not see to it, so the repair leaves out the name of lower rank, as Build 6 does), and at 1190 px every major city keeps its name`), maps.filter(m => m.pairs || m.under || m.majors !== m.mj).concat(phone.filter(m => m.pairs || m.under || m.majors < 1)).slice(0, 3));
    if (mapKey) {
      await at(1190, mapKey); const far = (await mapsOf(mapKey))[0];
      for (let i = 0; i < 3; i++) await page.click('#mod-' + mapKey + ' .maptools [data-z="in"]'); await page.waitForTimeout(400); const near = (await mapsOf(mapKey))[0];
      await page.click('#mod-' + mapKey + ' .maptools [data-z="reset"]'); await page.waitForTimeout(400); const back = (await mapsOf(mapKey))[0];
      ok(near.pairs === 0 && near.under === 0 && near.shown > far.shown && back.pairs === 0 && back.under === 0 && back.shown === far.shown, T(`zoomed in, the map shows ${near.shown} names where it showed ${far.shown}, still none over another or under the buttons, and reset it is as it was`), { far, near, back });
    }

    /* 5. Dr. HVAC's settings, where the build has them */
    if (has.keys.includes('drhvac')) {
      const row = async w => { await at(w, 'drhvac'); await page.click('#d19Settings'); await page.waitForTimeout(250); const r = await page.evaluate(() => { const q = sel => document.querySelector('#d19SetPanel ' + sel), b = e => e.getBoundingClientRect(); const lab = b(q('.dr-key label')), inp = b(q('#d19Key')), hint = b(q('.dr-key .hint')), test = b(q('#d19KeyTest')), rm = b(q('#d19KeyRm')), other = q('.plan .hint'); return { labelAbove: lab.bottom <= inp.top + 1, hintBelow: hint.top >= inp.bottom - 1, buttonsOnFieldRow: Math.abs((test.top + test.bottom) / 2 - (inp.top + inp.bottom) / 2) < 6 && test.left >= inp.right, buttonsBelow: test.top >= hint.bottom - 1 && rm.top === test.top, hintSize: getComputedStyle(q('.dr-key .hint')).fontSize, otherHintSize: other ? getComputedStyle(other).fontSize : '', fieldDressed: parseFloat(getComputedStyle(q('#d19Key')).borderTopLeftRadius) >= 3, inside: Math.max(inp.right, rm.right, hint.right) <= b(q('.dr-key')).right + 1 }; }); const found = await page.evaluate(detect, '#d19SetPanel'); await page.evaluate(() => document.querySelector('#d19SetPanel').remove()); return Object.assign(r, { found: found.issues.length }); };
      const desk = await row(1190), small = await row(480);
      ok(desk.labelAbove && desk.hintBelow && desk.buttonsOnFieldRow && desk.fieldDressed && desk.inside && desk.hintSize === desk.otherHintSize && desk.found === 0, T('Dr. HVAC settings: the key\'s label is above its field, the field shares its row with Test and Remove, and the hint is under them in the size of every other hint'), desk);
      ok(small.labelAbove && small.hintBelow && small.buttonsBelow && small.inside && small.found === 0, T('and on a narrow window the field takes the full width with the hint and then the two buttons under it'), small);
    }

    /* 6. a tick box in a connection card is the size of a tick box, and its label has the row */
    if (base.ticks.length) {
      await at(1190, 'publish'); const tk = await ticks(s, 'publish'), wasWide = base.ticks.filter(t => t.w > 40).length, most = a => Math.max(...a.map(t => t.lines));
      ok(tk.length === base.ticks.length && wasWide > 0 && tk.every(t => t.w <= 24) && most(tk) < most(base.ticks), T(`Publish: the ${wasWide} tick boxes that were stretched to the width of a field are tick boxes again, and the longest label beside one takes ${most(tk)} lines where it took ${most(base.ticks)}`), tk.filter(t => t.w > 24).length + ' still wide');
    }

    /* ---------- what the repairs must not do ---------- */
    const withR = await words(s, base.wordKeys), changed = base.wordKeys.filter(k => withR[k] !== base.words[k]);
    ok(base.wordKeys.length >= 12 && changed.length === 0 && s.errors.length === 0, T(`the repairs change no word of the dashboard: the text of ${base.wordKeys.length} modules and every label of their drawings is the same with them as without, and the page raised no error`), changed.concat(s.errors).slice(0, 3));
  } finally { await s.close(); }

  /* left out, the dashboard's own modules are as they were delivered */
  const bare = path.join(dir, 'no-repairs.html'); fs.writeFileSync(bare, installPanel(text, { bundles: [], repairs: false }));
  const off = await live.withDashboard(bare, async x => ({ t: tally(await sweep(x, { widths: [1190], quick: true, cover: false })), repairs: await x.page.evaluate(() => !!document.getElementById('lvp-repairs')), agents: await x.page.evaluate(() => !!MODI.agents) }));
  const wasAt1190 = tally({ runs: was.runs.filter(r => r.w === 1190) });
  ok(!off.repairs && off.agents && off.t.byKind.bare === wasAt1190.byKind.bare && off.t.total === wasAt1190.total, T('left out, the copy has the Agent Desk and the dashboard\'s own modules measure exactly as they did as delivered'), { off: brief(off.t), was: brief(wasAt1190) });
}
ok(gitState() === before, 'the repository is as it was');
done();
