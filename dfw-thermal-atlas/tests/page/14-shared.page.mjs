/* The shared layer (core, brand, map, charts, stylesheet): tables and the Brand dialog work from the keyboard, the copy and CSV
   guards, the compact formatters, chart names, the rail, map labels, sideways overflow, contrast, and what leaves the browser.
   Each part runs on its own, so the file can be pointed at an older build (--file) to list everything that build gets wrong. */
const HC = [   // [typed, what leaves the atlas]; the first 17 are the reader's probes
  ['10–15 years', '10 to 15 years'], ['10 – 15 years', '10 to 15 years'], ['10-15 years', '10 to 15 years'], ['10 — 15 years', '10, 15 years'],
  ['$50-$100 off', '$50 to $100 off'], ['$50–$100 off', '$50 to $100 off'], ['Mon–Sat 7–8', 'Mon, Sat 7 to 8'], ['24/7 — call now', '24/7, call now'],
  ['R-410A and R-22', 'R410A and R22'], ['heat pump — the efficient choice', 'heat pump, the efficient choice'], ['4.9-star rated', '4.9 star rated'],
  ['SEER2 14.3–15.2', 'SEER2 14.3 to 15.2'], ['family-owned since 1999', 'family owned since 1999'], ['Trust Us With Your Home Comfort', 'Trust Us With Your Home Comfort'],
  ['Monday to Saturday 7 am to 8 pm, Sunday by appointment', 'Monday to Saturday 7 am to 8 pm, Sunday by appointment'], ['A/C Heat by Russell', 'A/C Heat by Russell'],
  ['$50 off residential HVAC service', '$50 off residential HVAC service'],
  /* an em dash between two figures is a break in the sentence, not a range */
  ['Open 24/7 — 100% satisfaction guaranteed', 'Open 24/7, 100% satisfaction guaranteed'], ['Save $500 — 0% APR for 60 months', 'Save $500, 0% APR for 60 months'],
  ['$1,500-$2,000 rebate', '$1,500 to $2,000 rebate'], ['2026–2030', '2026 to 2030'],
];
const CSVQ = [   // [cell, what the file holds]
  ['=HYPERLINK("http://x","y")', '"\'=HYPERLINK(""http://x"",""y"")"'], ['@SUM(A1)', "'@SUM(A1)"], ['+furnace', "'+furnace"], ['-cmd|x', "'-cmd|x"],
  ["-2+3+cmd|' /C calc'!A0", "'-2+3+cmd|' /C calc'!A0"], ['+1+IMPORTXML("http://x","//a")', '"\'+1+IMPORTXML(""http://x"",""//a"")"'], ['\t=1+1', "'\t=1+1"],
  /* numbers, signed figures, percents and coordinates stay as they are */
  ['+15', '+15'], ['-20%', '-20%'], ['+0%', '+0%'], ['-96.6609', '-96.6609'], [-96.6609, '-96.6609'], [-5, '-5'], [-1e-7, '-1e-7'], ['+.5', '+.5'], ['32.8063,-96.6609', '"32.8063,-96.6609"'],
  ['-1,234.5', '"-1,234.5"'], ['-', '-'], ['—', '—'], ['75150', '75150'], [0, '0'], [null, ''], ['(972) 734 1428', '(972) 734 1428'], ['plain, text', '"plain, text"'],
];
const MMP = [[999, '$999'], [1500, '$1.5K'], [999499, '$999K'], [999500, '$1.0M'], [999999, '$1.0M'], [1e6, '$1.0M'], [6.3e8, '$630M'], [999.49e6, '$999M'], [999.5e6, '$1.00B'], [1e9, '$1.00B'], [2.345e9, '$2.35B'], [null, '—']];
const KP = [[999, '999'], [1500, '1.5k'], [533000, '533k'], [999499, '999k'], [999500, '1.00M'], [999999, '1.00M'], [1e6, '1.00M'], [2864573, '2.86M'], [null, '—']];
export default async function (page, t, ctx) {
  page.setDefaultTimeout(6000);
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.keyboard.press(k); await page.waitForTimeout(60); };
  const size = async (w, h = 900) => { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250); };
  const part = async (name, fn) => { try { await fn(); } catch (e) { t.ok(false, name + ': the part ran to the end', String(e.message || e).split('\n')[0]); } };
  const tools = () => page.evaluate(() => {   // contrast of an element's text against the nearest solid background behind it
    const parse = s => { let m = /^rgba?\(([^)]+)\)$/.exec(s); if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } m = /^color\(srgb\s+([^)]+)\)$/.exec(s); if (m) { const q = m[1].split('/'), p = q[0].trim().split(/\s+/).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, q[1] != null ? +q[1] : 1]; } return null; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const bgOf = e => { for (let p = e; p; p = p.parentElement) { const c = parse(getComputedStyle(p).backgroundColor); if (c && c[3] >= 0.999) return c; } return [255, 255, 255, 1]; };
    window.__ratio = e => { const A = lum(parse(getComputedStyle(e).color)), B = lum(bgOf(e)); return +((Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05)).toFixed(2); };
  });
  await tools();

  /* ---------- 15, 16, 25: copy rules, CSV cells, compact figures ---------- */
  await part('copy rules, CSV cells and compact figures', async () => {
    const fn = await page.evaluate(([hc, cq, mm, kk]) => ({ hc: hc.map(v => houseClean(v)), cq: cq.map(v => csvQ(v)), mm: mm.map(v => MM(v)), kk: kk.map(v => K(v)) }), [HC.map(x => x[0]), CSVQ.map(x => x[0]), MMP.map(x => x[0]), KP.map(x => x[0])]);
    t.eq(fn.hc, HC.map(x => x[1]), 'houseClean reads a hyphen or en dash between figures as a range, keeps the dollar sign, and turns an em dash into a comma');
    t.eq(fn.cq, CSVQ.map(x => x[1]), 'a CSV cell that could start a formula gets a leading apostrophe; numbers, +15, -20% and coordinates are untouched');
    t.eq(fn.mm, MMP.map(x => x[1]), 'MM steps to the next unit at the rounding boundary ($1.0M, $1.00B, never $1000K or $1000M)');
    t.eq(fn.kk, KP.map(x => x[1]), 'K steps to the next unit at the rounding boundary (1.00M, never 1000k)');
    const file = await page.evaluate(() => toCSV(['zip', '=total', 'bid'], [['75150', -3.5, '+15%'], { zip: '75043', '=total': '=SUM(A1:A9)', bid: '-20%' }], 'note line'));
    t.eq(file, "# note line\nzip,'=total,bid\n75150,-3.5,+15%\n75043,'=SUM(A1:A9),-20%\n", 'toCSV guards headers and cells alike and leaves bid modifiers and negative numbers alone');
    const ledger = await page.evaluate(() => { const ob = WATCH.add({ text: '=HYPERLINK("http://example.invalid","Free tune up")' }); const csv = WATCH.csv(); WATCH.remove(ob.id); return csv.split('\n').filter(l => l.includes('HYPERLINK')); });
    t.ok(ledger.length === 1 && ledger[0].includes('"\'=HYPERLINK(') && !/(^|,)"?=/.test(ledger[0]), 'competitor ad text that starts with = reaches the Watch ledger file as text', ledger);
    if (await page.evaluate(() => { showModule('paid'); return !!document.getElementById('a5G'); })) {
      await page.waitForTimeout(200); const g = await ctx.download(() => page.click('#a5G'));
      const rows = g.text.trim().split('\n').filter(l => /,Location,Enabled$/.test(l));
      t.ok(rows.length > 20 && rows.every(l => /,[+-]\d+%,Location,Enabled$/.test(l)), 'the Google Ads location file keeps its signed bid modifiers exactly as typed', rows.slice(0, 2));
    } else t.note('no #a5G button in Paid Acquisition: the download check was skipped');
  });

  /* ---------- Census sentinels: a negative margin of error is no margin at all ---------- */
  await part('margins of error', async () => {
    const moe = await page.evaluate(() => { const ks = ['moe_medyr', 'moe_value', 'moe_inc'], neg = a => a.filter(o => ks.some(k => typeof o[k] === 'number' && o[k] < 0)).length; const z = ZI['76092'] || {}; return { zips: neg(Z), cities: neg(DATA.cities), counties: neg(CO), real: ks.map(k => Z.filter(o => o[k] > 0).length), topCoded: [z.inc, z.moe_inc], noValue: [(ZI['75207'] || {}).value, (ZI['75207'] || {}).moe_value] }; });
    t.ok(moe.zips === 0 && moe.cities === 0 && moe.counties === 0, 'no ZIP, city or county carries a negative margin of error', moe);
    t.ok(moe.real.every(n => n >= 250) && moe.topCoded[0] === 250001 && moe.topCoded[1] === null && moe.noValue[1] === null, 'real margins are kept; the top coded income of 76092 and the missing home value of 75207 have none', moe);
    await ctx.show('dfw');
    const led = await page.evaluate(async () => { const out = {}; for (const zip of ['76092', '75207', '75150']) { const p = document.querySelector('#mod-dfw .mapsvg path[data-zip="' + zip + '"]'); if (!p) continue; const r = p.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }; p.dispatchEvent(new PointerEvent('pointerdown', o)); p.dispatchEvent(new PointerEvent('pointerup', o)); await new Promise(r => setTimeout(r, 120)); out[zip] = document.getElementById('d11LedT').textContent.slice(0, 5) + ' ' + [...document.querySelectorAll('#d11Led *')].filter(e => !e.children.length && /±/.test(e.textContent)).map(e => e.textContent.trim()).join(' | '); } return out; });
    t.ok(Object.keys(led).length === 3 && Object.entries(led).every(([z, s]) => s.startsWith(z) && /±/.test(s) && !/-\s?\$?\d|\d{3},\d{3},\d{3}/.test(s)) && /± \$[\d,]+/.test(led['75150']), 'DFW Stats: no ZIP ledger prints a margin like "± $-333,333,333"', led);
  });

  /* ---------- 3: every dataTable sorts and selects from the keyboard ---------- */
  await part('tables from the keyboard', async () => {
    await page.evaluate(() => {
      const host = el('div', { id: 'tShDt', class: 'tscroll' }); document.body.appendChild(host);
      const T = window.__dt = { sel: null, picks: 0, inner: 0, rows: [{ id: 'a', name: 'Alpha', n: 3 }, { id: 'b', name: 'Bravo', n: 10 }, { id: 'c', name: 'Charlie', n: 7 }] };
      T.draw = () => { dataTable(host, [{ k: 'name', h: 'Name', l: 1 }, { k: 'n', h: 'Count' }, { k: 'act', h: 'Act', f: () => '<button type="button" class="tShBtn">go</button>' }], T.rows, { sortKey: 'n', id: r => r.id, rowClass: r => r.id === T.sel ? 'sel' : '', onClick: id => { T.sel = id; T.picks++; T.draw(); } }); host.querySelectorAll('.tShBtn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); T.inner++; })); };
      T.draw();
    });
    const dt = () => page.evaluate(() => { const h = document.getElementById('tShDt'), a = document.activeElement; return { order: [...h.querySelectorAll('tbody tr')].map(r => r.dataset.id).join(''), sort: [...h.querySelectorAll('th.sort')].map(x => x.getAttribute('aria-sort')), heads: [...h.querySelectorAll('th.sort')].every(x => x.tabIndex === 0), stops: [...h.querySelectorAll('tbody tr')].filter(r => r.tabIndex === 0).map(r => r.dataset.id).join(''), active: h.contains(a) ? (a.dataset.k || a.dataset.id || a.tagName) : 'outside', sel: [...h.querySelectorAll('tr.sel')].map(r => r.dataset.id).join(''), picked: window.__dt.sel, picks: window.__dt.picks, inner: window.__dt.inner }; });
    try {
      let d = await dt();
      t.ok(d.order === 'bca' && d.sort.join() === 'none,descending,none' && d.heads && d.stops === 'b', 'a table states its sort (aria-sort), every header is a tab stop and the rows share one', d);
      await page.focus('#tShDt th[data-k="name"]'); await key('Enter'); d = await dt();
      t.ok(d.order === 'abc' && d.sort.join() === 'ascending,none,none' && d.active === 'name', 'Enter on a header sorts by it and the header keeps the focus', d);
      await key('Space'); d = await dt();
      t.ok(d.order === 'cba' && d.sort[0] === 'descending' && d.active === 'name', 'Space on the same header reverses the sort', d);
      await page.focus('#tShDt tbody tr[tabindex="0"]'); await key('ArrowDown'); d = await dt();
      t.ok(d.active === 'b' && d.stops === 'b' && d.picks === 0, 'ArrowDown moves to the next row without selecting it', d);
      await key('Enter'); d = await dt();
      t.ok(d.picked === 'b' && d.sel === 'b' && d.active === 'b' && d.stops === 'b' && d.picks === 1, 'Enter selects the row and the redrawn row keeps the focus', d);
      await key('ArrowUp', 3); await key('Space'); d = await dt();
      t.ok(d.picked === 'c' && d.active === 'c' && d.picks === 2, 'ArrowUp stops at the first row and Space selects it', d);
      await page.focus('#tShDt tbody tr[data-id="c"] .tShBtn'); await key('Enter'); d = await dt();
      t.ok(d.inner === 1 && d.picks === 2, 'a button inside a row still answers Enter itself', d);
      /* the mouse works as it always did: a click on a header sorts, a click on a row selects, a click on a button in a row is the button's */
      await page.click('#tShDt th[data-k="n"]'); d = await dt(); const m1 = d.order + ' ' + d.sort.join();
      await page.click('#tShDt th[data-k="n"]'); d = await dt(); const m2 = d.order + ' ' + d.sort.join();
      await page.click('#tShDt tbody tr[data-id="a"] td'); d = await dt(); const m3 = d.picked + d.sel + d.picks;
      await page.click('#tShDt tbody tr[data-id="b"] .tShBtn'); d = await dt();
      t.ok(m1 === 'bca none,descending,none' && m2 === 'acb none,ascending,none' && m3 === 'aa3' && d.inner === 2 && d.picks === 3, 'by mouse: a click on a header sorts (again: reverses), a click on a row selects it, a click on a button in a row does not', [m1, m2, m3, d.inner, d.picks]);
      await page.evaluate(() => { const h = document.getElementById('tShDt'); h._st = null; const T = window.__dt; T.rows = [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }, { id: 'z', name: 'Z' }]; T.draw = () => dataTable(h, [{ k: 'name', h: 'Name', l: 1 }], T.rows, { sortDir: 1, id: r => r.id, onClick: id => { T.rows = T.rows.filter(r => r.id !== id); T.draw(); } }); T.draw(); });
      await page.focus('#tShDt tbody tr[tabindex="0"]'); await key('ArrowDown'); await key('Enter'); d = await dt();
      t.ok(d.order === 'xz' && d.active === 'z' && d.stops === 'z', 'when Enter removes the row, the row that takes its place gets the focus', d);
      /* a table with no onClick has sortable headers and plain rows */
      const plain = await page.evaluate(() => { const h = document.getElementById('tShDt'); h._st = null; dataTable(h, [{ k: 'name', h: 'Name', l: 1 }], [{ name: 'X' }, { name: 'Y' }], {}); return { rows: [...h.querySelectorAll('tbody tr')].map(r => r.getAttribute('tabindex') + '/' + r.className.trim()).join(), th: h.querySelector('th').tabIndex }; });
      t.ok(plain.rows === 'null/,null/' && plain.th === 0, 'a table without a row action gives its rows no tab stop', plain);
    } finally { await page.evaluate(() => { const h = document.getElementById('tShDt'); if (h) h.remove(); }); }
    await ctx.show('index');
    const real = await page.evaluate(() => { const h = document.getElementById('i1Tbl'); const r = h && h.querySelector('tbody tr[tabindex="0"]'); if (!h) return null; if (r) r.focus(); return { second: h.querySelectorAll('tbody tr')[1].dataset.id }; });
    if (real) {
      await key('ArrowDown'); await key('Enter'); await page.waitForTimeout(150);
      const got = await page.evaluate(() => { const h = document.getElementById('i1Tbl'), a = document.activeElement; return { active: a.dataset.id, sel: [...h.querySelectorAll('tr.sel')].map(r => r.dataset.id).join(), inTable: h.contains(a) }; });
      t.ok(got.inTable && got.active === real.second && got.sel === real.second, 'Thermal Debt Index: ArrowDown and Enter select the second ZIP of the ranking from the keyboard', { real, got });
      const th = await page.evaluate(() => { const x = document.querySelector('#i1Tbl th[data-k="city"]'); x.focus(); return !!x; }); await key('Enter');
      const srt = await page.evaluate(() => { const h = document.getElementById('i1Tbl'), x = h.querySelector('th[data-k="city"]'); const c = [...h.querySelectorAll('tbody tr')].slice(0, 12).map(r => r.children[1].textContent); return { th: x.getAttribute('aria-sort'), focus: document.activeElement === x, asc: c.every((v, i) => !i || c[i - 1].localeCompare(v) <= 0), c: c.slice(0, 4) }; });
      t.ok(th && srt.th === 'ascending' && srt.focus && srt.asc, 'Thermal Debt Index: Enter on the City header sorts the ranking A to Z', srt);
    } else t.note('no #i1Tbl table in the Thermal Debt Index: the module check was skipped');
    const hid = await page.evaluate(() => { const h = document.getElementById('i1Tbl'); if (!h) return null; const rows = [...h.querySelectorAll('tbody tr')]; rows.forEach(r => { if (!r.hasAttribute('tabindex')) r.tabIndex = -1; }); rows[30].focus(); const out = []; for (let i = 29; i >= 8; i--) { rows[i].focus(); const a = rows[i].getBoundingClientRect(), b = h.querySelector('thead th').getBoundingClientRect(); if (a.top < b.bottom - 1) out.push(i); } return out; });
    if (hid) t.eq(hid, [], 'a row focused while moving up a scrolling table is not hidden under the sticky header');
    /* every module: each table drawn by dataTable can be reached and worked from the keyboard */
    const all = await page.evaluate(async () => { const bad = []; let tables = 0, rows = 0; for (const m of MODS) { showModule(m.key); await new Promise(r => setTimeout(r, 140)); document.querySelectorAll('#mod-' + m.key + ' th.sort').forEach(th => { if (th.tabIndex !== 0 || !th.hasAttribute('aria-sort')) bad.push(m.key + ' th ' + th.textContent.trim().slice(0, 14)); }); document.querySelectorAll('#mod-' + m.key + ' table').forEach(tb => { const rs = [...tb.querySelectorAll('tbody tr.click')]; if (!rs.length || !tb.parentElement._st) return; tables++; rows += rs.length; const stops = rs.filter(r => r.tabIndex === 0).length; if (stops !== 1 || rs.some(r => !r.hasAttribute('tabindex'))) bad.push(m.key + ' rows of ' + (tb.parentElement.id || '?') + ': ' + stops + ' stops'); }); } return { bad: [...new Set(bad)].slice(0, 12), tables, rows }; });
    t.ok(all.tables >= 6 && all.rows > 500 && !all.bad.length, 'in every module each sortable header is a tab stop with aria-sort and each dataTable of clickable rows has exactly one', all);
  });

  /* ---------- 4, 14, 20: the Brand dialog ---------- */
  await part('the Brand dialog', async () => {
    const where = () => page.evaluate(() => { const a = document.activeElement; return (a.closest('#brandPanel') ? 'panel:' : 'page:') + (a.id || a.tagName); });
    try {
      await ctx.show('index'); await page.evaluate(() => window.scrollTo(0, 0)); await page.focus('#brandBtn'); await key('Enter');
      const open = await page.evaluate(() => { const p = document.getElementById('brandPanel'); return p && { modal: p.getAttribute('aria-modal'), role: p.getAttribute('role'), label: p.getAttribute('aria-label'), intro: p.querySelector('.card-h p').textContent }; });
      t.ok(open && open.modal === 'true' && open.role === 'dialog' && (await where()) === 'panel:bp_name', 'the Brand dialog opens as a modal dialog and takes the focus', { open, focus: await where() });
      t.ok(open && /on [A-Z][a-z]+ \d{1,2}, \d{4}\.$/.test(open.intro) && !/\d{4}-\d\d-\d\d/.test(open.intro), 'the dialog writes its date in words', open && open.intro.slice(-70));
      await key('Shift+Tab'); const s1 = await where(); await key('Shift+Tab'); const s2 = await where(); await key('Tab'); const s3 = await where(); await key('Tab', 30); const s4 = await where();
      t.ok(s1 === 'panel:bpClose' && s2 === 'panel:bpReset' && s3 === 'panel:bpClose' && s4.startsWith('panel:'), 'Tab and Shift+Tab wrap inside the dialog', [s1, s2, s3, s4]);
      const walk = []; await page.focus('#bpClose'); for (let i = 0; i < 28; i++) { await page.keyboard.press('Tab'); walk.push(await where()); }
      t.ok(walk.every(w => w.startsWith('panel:')) && new Set(walk).size >= 24 && walk.indexOf('panel:bpClose') === walk.indexOf('panel:bpReset') + 1, 'Tab walks every field and button of the dialog and comes round to Close again, never to the page behind', walk.join(' ').replace(/panel:/g, ''));
      await page.click('#brandPanel .card-h p'); await key('Shift+Tab'); const s5 = await where();
      t.ok(s5.startsWith('panel:'), 'after a click on the dialog text, Shift+Tab still stays inside', s5);
      const chip = await page.evaluate(() => { const i = document.getElementById('bp_c_primary'); const was = i.value; i.value = '#aa0000'; i.dispatchEvent(new Event('input', { bubbles: true })); const now = i.nextElementSibling.textContent; i.value = was; i.dispatchEvent(new Event('input', { bubbles: true })); return now; });
      t.eq(chip, '#aa0000', 'the hex beside a color picker follows the picker');
      const z = await page.evaluate(() => { toast('Logo file is over 400 KB; pick a smaller one'); return { toast: +getComputedStyle(document.querySelector('.toast')).zIndex, dialog: +getComputedStyle(document.getElementById('brandPanel')).zIndex }; });
      t.ok(z.toast > z.dialog, 'a toast opens above the dialog', z);
      await page.click('#brandPanel .card-h p'); await key('Escape');
      const shut = await page.evaluate(() => ({ open: !!document.getElementById('brandPanel'), focus: document.activeElement.id }));
      t.ok(!shut.open && shut.focus === 'brandBtn', 'Escape closes the dialog and hands the focus back to the Brand button', shut);
      /* it still does its job: save applies names and colors, reset puts the defaults back, both close and return the focus */
      await page.focus('#brandBtn'); await key('Enter');
      await page.fill('#bp_short', 'Acme Air'); await page.evaluate(() => { const i = document.getElementById('bp_c_primary'); i.value = '#7a1f1f'; i.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.focus('#bpSave'); await key('Enter');
      const saved = await page.evaluate(() => ({ open: !!document.getElementById('brandPanel'), focus: document.activeElement.id, short: BRAND.short, primary: BRAND.colors.primary, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), stored: (store.get('tda.brand.v1', {}) || {}).short }));
      t.ok(!saved.open && saved.focus === 'brandBtn' && saved.short === 'Acme Air' && saved.stored === 'Acme Air' && saved.primary === '#7a1f1f' && saved.accent === '#7a1f1f', 'Save applies and stores the name and the color, closes the dialog and returns the focus', saved);
      await page.focus('#brandBtn'); await key('Enter'); await page.focus('#bpReset'); await key('Enter');
      const reset = await page.evaluate(() => ({ open: !!document.getElementById('brandPanel'), focus: document.activeElement.id, short: BRAND.short, primary: BRAND.colors.primary, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }));
      t.ok(!reset.open && reset.focus === 'brandBtn' && reset.short !== 'Acme Air' && reset.primary !== '#7a1f1f' && reset.accent === reset.primary, 'Reset puts the defaults back, closes the dialog and returns the focus', reset);
    } finally { await page.evaluate(() => { const p = document.getElementById('brandPanel'); if (p) p.remove(); if (BRAND.short === 'Acme Air') BRANDX.reset(); }); }
  });

  /* ---------- 2: the focus ring on the navy header and rail ---------- */
  await part('the focus ring', async () => {
    await page.evaluate(() => window.scrollTo(0, 0)); await page.focus('#brandBtn'); await key('Shift+Tab'); const ring = [];
    for (let i = 0; i < 3; i++) { ring.push(await page.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { el: a.id || a.tagName, zone: a.closest('.rail') ? 'rail' : a.closest('.shell-top') ? 'header' : 'body', vis: a.matches(':focus-visible'), color: cs.outlineColor, style: cs.outlineStyle }; })); await key('Tab'); }
    t.ok(ring.some(r => r.zone === 'rail') && ring.some(r => r.zone === 'header') && ring.every(r => r.zone !== 'body' && r.vis && r.style === 'solid' && r.color === 'rgb(255, 255, 255)'), 'keyboard focus draws a white ring on the header buttons and the rail tabs', ring);
    /* the whole rail, tab by tab: every module can be reached and opened from the keyboard */
    const n = await page.evaluate(() => MODS.length); await page.focus('#tab-' + await page.evaluate(() => MODS[0].key)); const seen = [];
    for (let i = 0; i < n; i++) { seen.push(await page.evaluate(() => { const a = document.activeElement; return (a.id || '').replace('tab-', '') + (a.matches(':focus-visible') && getComputedStyle(a).outlineColor === 'rgb(255, 255, 255)' ? '' : '!'); })); await page.keyboard.press('Tab'); }
    t.eq(seen, await page.evaluate(() => MODS.map(m => m.key)), 'Tab walks the rail in module order, each tab with the white ring');
    const last = await page.evaluate(() => MODS[MODS.length - 1].key); await page.focus('#tab-' + last); await key('Enter'); await page.waitForTimeout(150);
    t.ok(await page.evaluate(k => !document.getElementById('mod-' + k).hidden && location.hash === '#' + k, last), 'Enter on a rail tab opens its module');
    await ctx.show('index');
  });

  /* ---------- 23: charts are announced by name ---------- */
  await part('chart names', async () => {
    const named = await page.evaluate(() => {
      const mk = html => { const d = el('div', {}, html); document.body.appendChild(d); return d; };
      const a = mk('<div class="card"><div class="card-h"><h3>Furnace calls by month</h3></div><div class="card-b"><div class="h"></div></div></div>'), b = mk('<div class="h"></div>');
      const spec = { series: [{ name: 's', color: '#888', pts: [[0, 1], [1, 2]] }] };
      const out = [lineChart(a.querySelector('.h'), spec), lineChart(a.querySelector('.h'), Object.assign({ aria: 'Given name' }, spec)), barChart(a.querySelector('.h'), { cats: ['a'], series: [{ name: 's', color: '#888', values: [1] }] }), hbarChart(a.querySelector('.h'), [{ l: 'a', v: 1 }]), lineChart(b.querySelector('.h') || b, spec)].map(s => s.getAttribute('aria-label'));
      a.remove(); b.remove(); return out;
    });
    t.eq(named, ['Furnace calls by month', 'Given name', 'Furnace calls by month', 'Furnace calls by month', 'chart'], 'a chart without a name of its own takes the title of its card');
    const anon = await page.evaluate(async () => { const out = []; for (const m of MODS) { showModule(m.key); await new Promise(r => setTimeout(r, 120)); document.querySelectorAll('#mod-' + m.key + ' svg.chart').forEach(s => { const l = (s.getAttribute('aria-label') || '').trim(); if (!l || l === 'chart') out.push(m.key + ':' + (s.parentElement.id || '?')); }); } return out; });
    t.eq(anon, [], 'no chart in any module is announced as just "chart"');
  });

  /* ---------- 1, 5, 11, 12, 13, 21: text contrast, light and dark ---------- */
  await part('contrast', async () => {
    const probe = () => page.evaluate(() => {
      const box = el('div', { id: 'tShC' }, `<div class="card"><div class="card-b"><button class="btn">Save</button><span class="seg"><button aria-pressed="true">On</button></span><button class="chip" aria-pressed="true">Chip</button><span class="wscore">71</span>
        ${G('A')}${G('B')}${G('C')}${G('D')}${G('X')}<span class="q1">Whitespace</span><span class="q3">Avoid</span><span class="disp x">cleared</span><span class="disp c">confirmed</span>
        <span class="pill st-connected">connected</span><span class="pill st-configured">waiting</span><span class="pill st-expired">expired</span><span class="tier tE">E</span><span class="mini pb-ok">valid</span>
        <span class="pbadge p-site">site</span><span class="pbadge p-google">google</span><span class="pbadge p-nextdoor">nextdoor</span><span class="pbadge p-mail">mail</span>
        <div class="daycard"><div class="dhi">feels 104</div></div><div class="rk bench"><div class="nm">Client</div></div><div class="rk bench sel"><div class="nm">Client <span class="rn">39.</span></div></div>
        ${corrMatrix(['a', 'b', 'c'], { a: 'A', b: 'B', c: 'C' }, { a: { a: 1, b: 0.94, c: -0.62 }, b: { a: 0.94, b: 1, c: 0.56 }, c: { a: -0.62, b: 0.56, c: 1 } })}</div></div><div class="wrap"><p class="mini">note</p><div class="foot">Footer line</div></div>`);
      document.body.appendChild(box); const low = [];
      box.querySelectorAll('button,span,.dhi,.nm,.cm td,.foot,p.mini').forEach(e => { if (e.children.length && !e.matches('.nm')) return; const r = window.__ratio(e); if (r < 4.5) low.push((e.className || e.tagName) + ' "' + e.textContent.trim().slice(0, 12) + '" ' + r); });
      const btn = window.__ratio(box.querySelector('.btn')), chips = [...box.querySelectorAll('.g')].map(e => window.__ratio(e)); box.remove(); return { low, btn, chips, dark: isDark() };
    });
    await ctx.show('index');
    try {
      const light = await probe();
      t.ok(!light.dark && light.chips.every(r => r >= 4.5), 'light theme: the grade chips A, B, C, D and the gray one read at 4.5:1 or better on a card', light.chips);
      t.eq(light.low, [], 'light theme: buttons, status words, pills, badges, the client row, the matrix and the footer all reach 4.5:1');
      await page.evaluate(() => { if (!isDark()) toggleTheme(); }); await page.waitForTimeout(100);
      const dark = await probe();
      t.ok(dark.dark && dark.btn >= 4.5, 'dark theme: the ink on a primary button reaches 4.5:1', dark.btn);
      t.ok(dark.chips.every(r => r >= 4.5), 'dark theme: the grade chips read at 4.5:1 or better on a card', dark.chips);
      t.eq(dark.low, [], 'dark theme: buttons, status words, pills, badges, the client row, the matrix and the footer all reach 4.5:1');
      /* the index was drawn in the light theme and its matrix is not redrawn on a theme change: it must follow the theme all the same */
      const inPage = await page.evaluate(async () => { const out = []; for (const k of ['index', 'paid', 'supply']) { if (!MODI[k]) continue; showModule(k); await new Promise(r => setTimeout(r, 200)); document.querySelectorAll('#mod-' + k + ' .g, #mod-' + k + ' .btn:not([disabled]), #mod-' + k + ' .cm td, #mod-' + k + ' .foot').forEach(e => { if (!e.getClientRects().length) return; const r = window.__ratio(e); if (r < 4.5) out.push(k + ' ' + e.className + ' "' + e.textContent.trim().slice(0, 10) + '" ' + r); }); } return [...new Set(out)]; });
      t.eq(inPage, [], 'dark theme: chips, buttons, matrix cells and footers as the modules draw them reach 4.5:1');
    } finally { await page.evaluate(() => { const b = document.getElementById('tShC'); if (b) b.remove(); if (isDark()) toggleTheme(); }); await page.waitForTimeout(100); }
  });

  /* ---------- D35: a wrapping table cell is not the page wrapper ---------- */
  await part('wrapping cells', async () => {
    const cell = await page.evaluate(() => { const d = el('div', { class: 'wrap' }, '<table class="keep"><tbody><tr><td>plain</td><td class="l wrap">wraps</td><th class="wrap">head</th></tr></tbody></table>'); document.body.appendChild(d); const [a, b, c] = [...d.querySelectorAll('td,th')].map(x => getComputedStyle(x)); const out = { plain: a.padding, wrap: b.padding, head: c.padding, ws: b.whiteSpace, maxw: b.maxWidth, h: [d.querySelector('td').offsetHeight, d.querySelector('td.wrap').offsetHeight] }; d.remove(); return out; });
    t.ok(cell.wrap === cell.plain && cell.head === cell.plain && cell.ws === 'normal' && cell.maxw === 'none' && cell.h[0] === cell.h[1] && cell.h[1] < 40, 'td.wrap and th.wrap keep the padding of a table cell and take nothing from the page wrapper', cell);
    const tall = await page.evaluate(async () => { const out = []; let n = 0; for (const m of MODS) { showModule(m.key); await new Promise(r => setTimeout(r, 140)); document.querySelectorAll('#mod-' + m.key + ' td.wrap, #mod-' + m.key + ' th.wrap').forEach(c => { if (!c.getClientRects().length) return; n++; const cs = getComputedStyle(c); if (parseFloat(cs.paddingBottom) > 12) out.push(m.key + ' ' + (c.closest('[id]') || {}).id + ' ' + cs.padding); }); } return { n, out: [...new Set(out)].slice(0, 8) }; });
    t.ok(tall.n > 0 && !tall.out.length, 'no wrapping cell of any module carries the 64 px bottom padding of the page wrapper', tall);
    await ctx.show('index');
  });

  /* ---------- the rail: nine tabs a row from 1180 px, six below, one scrolling row on a phone; no title cut off ---------- */
  await part('the rail', async () => {
    const rail = () => page.evaluate(() => { const r = document.querySelector('#rail .in'), bs = [...r.querySelectorAll('button')]; const tops = [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().top)))]; const cut = bs.filter(b => { const tt = b.querySelector('.t'), cs = getComputedStyle(b), br = b.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(tt); const rr = rg.getBoundingClientRect(); return rr.right > br.right - parseFloat(cs.paddingRight) + 0.5 || rr.bottom > br.bottom || tt.scrollWidth > tt.clientWidth + 1; }).map(b => b.querySelector('.t').textContent); const ws = bs.map(b => b.getBoundingClientRect().width); return { n: bs.length, display: getComputedStyle(r).display, rows: tops.map(y => bs.filter(b => Math.round(b.getBoundingClientRect().top) === y).length), cut, over: document.documentElement.scrollWidth - innerWidth, spread: +(Math.max(...ws) - Math.min(...ws)).toFixed(1) }; });
    const even = (r, per) => r.rows.length === Math.ceil(r.n / per) && r.rows.slice(0, -1).every(x => x === per) && r.rows[r.rows.length - 1] <= per;
    try {
      for (const [w, per] of [[1920, 9], [1440, 9], [1423, 9], [1280, 9], [1180, 9], [1179, 6], [1024, 6], [800, 6], [761, 6]]) { await size(w); const r = await rail(); t.ok(r.display === 'grid' && even(r, per) && !r.cut.length && r.over <= 0 && r.spread < 1.5, `rail at ${w} px: ${per} tabs a row, all the same width, every title whole`, r); }
      await size(1440); const r18 = await rail();
      if (r18.n === 18) { t.eq(r18.rows, [9, 9], 'the 18 tabs of Build 5 sit in two even rows of nine at 1440 px'); await size(1024); t.eq((await rail()).rows, [6, 6, 6], 'and in three rows of six at 1024 px'); } else t.note(`the build has ${r18.n} tabs, not 18: the two rows of nine and three rows of six were checked by count only`);
      await size(390, 844); const phone = await rail();
      t.ok(phone.display === 'flex' && phone.rows.length === 1 && !phone.cut.length && phone.over <= 0, 'rail at 390 px: one row that scrolls inside the rail', phone);
    } finally { await size(1440); }
  });

  /* ---------- 7: charts on a phone scroll inside their card at a readable size ---------- */
  await part('charts on a phone', async () => {
    try {
      await size(390, 844); await ctx.show('index');
      const small = await page.evaluate(() => { const w = document.querySelector('#mod-index .wrap'), c = el('div', { class: 'card' }, '<div class="card-b"><div id="tShCh"></div></div>'); w.appendChild(c); const s = lineChart(c.querySelector('#tShCh'), { aria: 'test', series: [{ name: 's', color: '#888', pts: [[0, 1], [1, 2]] }] }); const h = s.parentElement; const out = { svg: Math.round(s.getBoundingClientRect().width), host: h.clientWidth, scrolls: getComputedStyle(h).overflowX, axis: +(11 * s.getBoundingClientRect().width / 820).toFixed(1), over: document.documentElement.scrollWidth - innerWidth }; c.remove(); return out; });
      t.ok(small.svg >= 600 && small.host < 400 && small.scrolls === 'auto' && small.axis >= 8 && small.over <= 0, 'at 390 px a chart is drawn 600 px wide inside a card that scrolls, and the page does not', small);
      const sized = await page.evaluate(() => { const w = document.querySelector('#mod-index .wrap'), out = {}; for (const W of [380, 700, 1180]) { const c = el('div', { class: 'card' }, '<div class="card-b"><div></div></div>'); w.appendChild(c); const h = c.querySelector('.card-b div'), s = lineChart(h, { W, aria: 'test', series: [{ name: 's', color: '#888', pts: [[0, 1], [1, 2]] }] }), r = s.getBoundingClientRect(); out[W] = { drawn: Math.round(r.width), axis: +(11 * r.width / W).toFixed(1), scrolls: h.scrollWidth > h.clientWidth + 1 }; c.remove(); } return out; });
      t.ok(sized[380].drawn < 400 && !sized[380].scrolls && sized[380].axis >= 8 && sized[700].axis >= 8 && sized[700].scrolls && sized[1180].axis >= 8 && sized[1180].scrolls, 'a narrow chart stays inside its card without a scroll bar and a wide one grows until its axis text is 8 px', sized);
      const every = await page.evaluate(async () => { const thin = [], over = {}; let n = 0; for (const m of MODS) { showModule(m.key); await new Promise(r => setTimeout(r, 160)); const o = document.documentElement.scrollWidth - innerWidth; if (o > 0) over[m.key] = o; document.querySelectorAll('#mod-' + m.key + ' svg.chart').forEach(s => { const r = s.getBoundingClientRect(); if (!r.width) return; n++; const vb = (s.getAttribute('viewBox') || '').split(/\s+/).map(Number), px = 11 * r.width / (vb[2] || r.width); if (px < 7.9) thin.push(m.key + ':' + (s.parentElement.id || '?') + ' ' + px.toFixed(1)); }); } return { n, thin, over }; });
      t.ok(every.n >= 10 && !every.thin.length && !Object.keys(every.over).length, 'at 390 px the axis text of every chart in every module is drawn at 8 px or more and no module scrolls sideways', every);
    } finally { await size(1440); }
  });

  /* ---------- 6: map labels do not print over each other ---------- */
  await part('map labels', async () => {
    const labels = () => page.evaluate(() => { const gs = [...document.querySelectorAll('#mod-index .mapsvg .lab')].map(x => x.parentNode), vis = gs.filter(g => g.style.display !== 'none'), rs = vis.map(g => g.getBoundingClientRect()); const pairs = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (rs[i].left < rs[j].right && rs[j].left < rs[i].right && rs[i].top < rs[j].bottom && rs[j].top < rs[i].bottom) pairs.push(vis[i].textContent + ' on ' + vis[j].textContent); return { all: gs.length, shown: vis.length, counties: vis.filter(g => g.querySelector('.ct')).length, pairs }; });
    try {
      await size(390, 844); await ctx.show('index'); await page.waitForTimeout(500); const m390 = await labels();
      t.ok(m390.all > 40 && m390.shown >= 8 && m390.shown < m390.all && !m390.pairs.length, 'map at 390 px: the labels that would collide are held back and none overlap', m390);
      await page.evaluate(() => { const b = document.querySelector('#mod-index .maptools button[data-z="in"]'); b.click(); b.click(); }); await page.waitForTimeout(200); const zoomed = await labels();
      t.ok(zoomed.shown > m390.shown && !zoomed.pairs.length, 'zooming in brings labels back, still without overlap', zoomed);
      await page.evaluate(() => document.querySelector('#mod-index .maptools button[data-z="reset"]').click());
      await size(1440); await page.waitForTimeout(400); const m1440 = await labels();
      t.ok(!m1440.pairs.length && m1440.counties >= 11 && m1440.shown >= m1440.all - 3, 'map at 1440 px: no label overlaps another and the county names are in view', m1440);
      /* the map still answers the mouse: a click selects, the buttons and the wheel zoom, a drag pans, reset puts it back */
      const use = await page.evaluate(async () => { const svg = document.querySelector('#mod-index .mapsvg'), vp = svg.querySelector('g'), tf = () => vp.getAttribute('transform'), zip = document.querySelector('#i1Tbl tbody tr:nth-child(5)').dataset.id, p = svg.querySelector('path[data-zip="' + zip + '"]'), r = p.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }; const t0 = tf(); p.dispatchEvent(new PointerEvent('pointerdown', o)); p.dispatchEvent(new PointerEvent('pointerup', o)); await new Promise(r => setTimeout(r, 150)); const sel = [...svg.querySelectorAll('path.z.sel')].map(x => x.dataset.zip).join(), row = [...document.querySelectorAll('#i1Tbl tr.sel')].map(x => x.dataset.id).join(); document.querySelector('#mod-index .maptools button[data-z="in"]').click(); const t1 = tf(); svg.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: o.clientX, clientY: o.clientY })); const t2 = tf(); const q = Object.assign({}, o); svg.dispatchEvent(new PointerEvent('pointerdown', q)); q.clientX += 40; q.clientY += 25; svg.dispatchEvent(new PointerEvent('pointermove', q)); svg.dispatchEvent(new PointerEvent('pointerup', q)); const t3 = tf(); document.querySelector('#mod-index .maptools button[data-z="reset"]').click(); return { zip, sel, row, moved: [t0 !== t1, t1 !== t2, t2 !== t3], back: tf() === t0 }; });
      t.ok(use.sel === use.zip && use.row === use.zip && use.moved.every(Boolean) && use.back, 'the map still selects on a click, zooms on the button and the wheel, pans on a drag and resets', use);
    } finally { await size(1440); }
  });

  /* ---------- 8: no module scrolls sideways at 1024 or 900 px ---------- */
  await part('sideways overflow', async () => {
    try {
      for (const w of [1024, 900]) {
        await size(w);
        const over = await page.evaluate(async () => { const out = {}; for (const m of MODS) { showModule(m.key); await new Promise(r => setTimeout(r, 160)); const o = document.documentElement.scrollWidth - innerWidth; if (o > 0) out[m.key] = o; } return out; });
        t.eq(over, {}, `no module pushes the page sideways at ${w} px`);
      }
      const boxes = await page.evaluate(async () => { const out = {}; for (const [k, id] of [['weather', 'w14Spc'], ['ground', 'g6Clu'], ['drivers', 'd4Moran']]) { if (!MODI[k]) continue; showModule(k); await new Promise(r => setTimeout(r, 300)); const e = document.getElementById(id); if (e) out[id] = getComputedStyle(e).overflowX + ' ' + (e.getBoundingClientRect().right <= innerWidth); } return out; });
      t.ok(Object.keys(boxes).length > 0 && Object.values(boxes).every(v => v === 'auto true'), 'the three bare tables scroll inside their own box at 900 px', boxes);
    } finally { await size(1440); }
  });

  /* ---------- 10: the brand layer asks Google Fonts for nothing the page already has ---------- */
  await part('fonts', async () => {
    const reqs = []; const onReq = r => { const u = r.url(); if (/^https?:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) reqs.push(u); };
    page.on('request', onReq);
    try {
      await ctx.fresh(); await page.waitForTimeout(1200);
      const links = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].filter(l => /fonts\.googleapis\.com/.test(l.href)).map(l => ({ id: l.id, href: l.href })));
      const api = reqs.filter(u => /fonts\.googleapis\.com/.test(u));
      t.ok(!links.some(l => l.id === 'brand-fonts') && links.length <= 1, 'the page carries no font link beyond the one in its own head', links.map(l => l.id + ' ' + l.href.slice(0, 60)));
      t.ok(api.length <= links.length && api.every(u => links.some(l => l.href === u)), 'the only request to fonts.googleapis.com is that link', api.map(u => u.slice(0, 80)));
      const before = reqs.length;
      await page.evaluate(() => { BRANDX.apply(); BRANDX.save({}); BRANDX.panel(); document.getElementById('bpSave').click(); }); await page.waitForTimeout(700);
      t.eq(reqs.length, before, 'applying and saving the brand sends no further request to fonts.googleapis.com or fonts.gstatic.com');
      t.ok(await page.evaluate(() => getComputedStyle(document.querySelector('.mast h1')).fontFamily.includes('Bebas Neue') && getComputedStyle(document.body).fontFamily.includes('Open Sans')), 'the brand faces are still the ones the page asks for');
      /* a face the page does not carry is still fetched when the owner picks one */
      const other = await page.evaluate(() => { BRANDX.save({ fonts: { display: 'Oswald', body: 'Open Sans' } }); const l = document.getElementById('brand-fonts'); const href = l ? l.href : ''; BRANDX.reset(); return href; });
      t.ok(/family=Oswald/.test(other) && !/Open\+Sans|Bebas/.test(other), 'a brand face the page does not carry is still linked, alone', other);
    } finally { page.off('request', onReq); }
  });

  /* ---------- the stored theme is applied by the first shared script, not the last ---------- */
  await part('the stored theme', async () => {
    await page.addInitScript(() => { new MutationObserver(() => { const r = document.documentElement; if (r && r.dataset.theme && !window.__themeAt) window.__themeAt = { theme: r.dataset.theme, brand: typeof BRANDX, shellFacts: !!(document.getElementById('shellFacts') || {}).innerHTML }; }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] }); });
    await ctx.fresh({ 'tda.theme': '"dark"' });
    const th = await page.evaluate(() => ({ at: window.__themeAt || null, now: document.documentElement.dataset.theme, dark: isDark() }));
    t.ok(th.now === 'dark' && th.dark && th.at && th.at.theme === 'dark' && th.at.brand === 'undefined' && !th.at.shellFacts, 'a stored dark theme is set before the brand layer loads and before the shell builds the page', th);
    const tg = await page.evaluate(() => { toggleTheme(); const a = [document.documentElement.dataset.theme, localStorage.getItem('tda.theme')]; toggleTheme(); return a.concat([document.documentElement.dataset.theme, localStorage.getItem('tda.theme')]); });
    t.eq(tg, ['light', '"light"', 'dark', '"dark"'], 'the theme button still switches the theme and stores the choice');
    await ctx.fresh({ 'tda.theme': '"sepia"' });
    t.ok(await page.evaluate(() => { const v = document.documentElement.dataset.theme; return v !== 'sepia'; }), 'a stored value that is not a theme is not applied');
    await ctx.fresh();
  });
  t.ok(!ctx.errors.length, 'no page error or console error', ctx.errors.slice(0, 5));
}
