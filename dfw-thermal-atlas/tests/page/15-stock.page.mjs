/* Modules 01 to 04 (Thermal Debt Index, Replacement Wave, Rules and Refrigerants, Demand Drivers): one check per touch up fix,
   and guards that the repair or replace calculator still prints the Build 4 readings for an air conditioner and a heat pump and
   that the data rows of the exports are still the Build 4 rows. The defect numbers are the ones of the stock data review. */
import { createHash } from 'node:crypto';
/* Build 4 values, taken by running this same file with --file dist/DFW_Thermal_Debt_Atlas.html.
   calc: one hash per equipment type over the reading and the replacement quote field for 5 repair quotes x ages 1 to 30 x
   3 refrigerants, with a gas furnace selected between every two of them. csv: sha256 of the data rows of each export. */
const B4 = {
  calc: { AC_TX: 3685028878, HP_TX: 56855758, n: 900 },
  csv: { i1Csv: '2ab304bfd02878d4', r2Csv: 'ef1ebc5817d12cdc', r2Fc: '9bce931811276388', d4Csv: '2332d1a23cae54a7', d4Vars: '68d3b5782992f6e6' },
};
/* the only hyphens the four modules may print: official names, document and docket numbers, a data set id, the phone
   numbers of the notice TDLR prescribes, the ISO dates of the policy calendar and the month codes of the permit series */
const HY_OK = /^(Mid-Tex|GHCN-Daily|Low-Income|94-171|119-21|25-879|2023-25514|2026-08145|7358-krk7|1-800-803-9202|512-463-6599|\d{4}-\d\d-\d\d|\d{4}-\d\d)$/;
const HY_TOKEN = /[A-Za-z0-9.%)]*[A-Za-z0-9%)][\u2010-\u2015\u2212-][A-Za-z0-9(][A-Za-z0-9\u2010-\u2015\u2212-]*/g;
const hyphens = s => (String(s).match(HY_TOKEN) || []).filter(w => !HY_OK.test(w.replace(/^[^A-Za-z0-9]+/, '')));
const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const dataRows = text => text.replace(/^\ufeff/, '').split('\n').filter(l => !l.startsWith('#')).join('\n');
const notes = text => text.replace(/^\ufeff/, '').split('\n').filter(l => l.startsWith('#')).join('\n');

export default async function (page, t, ctx) {
  const setVal = (sel, v) => page.evaluate(([s, x]) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
  const text = sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
  const toggle = async () => { await page.evaluate(() => toggleTheme()); await page.waitForTimeout(350); };
  /* a fresh page in a given theme: the theme is written before the page's own scripts run (a value written just before a
     reload is sometimes lost by the browser, so it is not written from the old page) */
  const fresh = async th => { await page.addInitScript(v => { try { localStorage.setItem('tda.theme', v); } catch (e) { } }, JSON.stringify(th)); await ctx.fresh(); return page.evaluate(() => document.documentElement.dataset.theme + (isDark() ? ' dark' : ' light')); };
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  /* what a person sees of a module's colors: the computed color, background, fill, stroke and border colors of every element.
     The city dots of the shared map (app/js/02_map.js) are compared apart: that file is not one of the four and its dots are
     reported in a note, not failed here. */
  const DOT = 'map city dot';
  const paint = key => page.evaluate(([k, DOT]) => [...document.getElementById('mod-' + k).querySelectorAll('*')].map(e => { const c = getComputedStyle(e); if (e.tagName === 'circle' && !e.getAttribute('class') && e.closest('#i1Map,#r2Map,#p3Map,#d4LMap')) return DOT + '|' + c.fill; return e.tagName + '|' + c.color + '|' + c.backgroundColor + '|' + c.fill + '|' + c.stroke + '|' + c.borderTopColor + '|' + c.borderLeftColor + '|' + c.stopColor; }), [key, DOT]);
  const noDots = a => a.map(x => x.startsWith(DOT) ? DOT : x), dots = a => a.filter(x => x.startsWith(DOT)).join();
  const where = (key, i) => page.evaluate(([k, n]) => { const e = document.getElementById('mod-' + k).querySelectorAll('*')[n]; if (!e) return 'no element ' + n; const host = e.closest('[id]'); return (host ? '#' + host.id + ' ' : '') + e.tagName.toLowerCase() + (e.getAttribute('class') ? '.' + e.getAttribute('class').trim().replace(/\s+/g, '.') : '') + ' "' + (e.textContent || '').trim().slice(0, 30) + '"'; }, [key, i]);
  const samePaint = async (key, got, want) => { got = noDots(got); want = noDots(want); if (got.length !== want.length) return `${got.length} elements against ${want.length}`; const bad = []; for (let i = 0; i < got.length && bad.length < 3; i++) if (got[i] !== want[i]) bad.push(`${await where(key, i)}: ${got[i]} against ${want[i]}`); const n = got.filter((x, i) => x !== want[i]).length; return n ? `${n} elements differ; ${bad.join(' ;; ')}` : ''; };
  const STATES = [['index', { zip: '75150' }], ['replace', { zip: '75150' }], ['rules', null], ['drivers', null]];
  const legendSays = (sel, kind) => page.evaluate(([s, k]) => { const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]; }; const sw = [...document.querySelectorAll(s + ' .ramp i')].map(i => lum(getComputedStyle(i).backgroundColor)); const tx = document.querySelector(s + ' .dn').innerText; const lowDarker = sw[0] < sw[sw.length - 1];
    /* index legends: "<Lower|Higher> values shade <darker|lighter>"; replacement legend: "<Darker|Lighter> means more replacement work" */
    if (k === 'index') { const m = tx.match(/^(Lower|Higher) values shade (darker|lighter)/); if (!m) return { ok: false, tx: tx.slice(0, 80) }; const says = (m[1] === 'Lower') === (m[2] === 'darker'); return { ok: says === lowDarker && !/\s\./.test(tx.split('\n')[0]), tx: tx.slice(0, 90), sw: [Math.round(sw[0]), Math.round(sw[sw.length - 1])] }; }
    const m = tx.match(/^(Darker|Lighter) means more replacement work\./); return { ok: !!m && (m[1] === 'Darker') === !lowDarker, tx: tx.slice(0, 60), sw: [Math.round(sw[0]), Math.round(sw[sw.length - 1])] }; }, [sel, kind]);

  /* everything a module shows as text: what is on screen, the titles, names and placeholders of its controls, its options */
  const screen = async (key, skip) => page.evaluate(([k, skip]) => { const root = document.getElementById('mod-' + k), hid = skip.flatMap(s => [...root.querySelectorAll(s)]); hid.forEach(e => { e.dataset.was = e.style.display; e.style.display = 'none'; }); const out = [root.innerText]; hid.forEach(e => { e.style.display = e.dataset.was; delete e.dataset.was; });
    root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(e => { if (!skip.some(s => e.closest(s))) out.push(e.getAttribute('title') || '', e.getAttribute('aria-label') || '', e.getAttribute('placeholder') || ''); }); root.querySelectorAll('option').forEach(o => out.push(o.textContent)); return out.join('\n'); }, [key, skip]);
  const seen = {};
  const scan = async (label, key, skip = []) => { const bad = hyphens(await screen(key, skip)); if (bad.length) seen[label] = [...new Set(bad)].slice(0, 8); };

  /* ================= theme: a switch must leave every chart as a fresh page in that theme draws it (defects 4, 5, 6) ================= */
  const ref = { light: {}, dark: {} }, sw = { light: {}, dark: {} }, leg = {};
  for (const th of ['light', 'dark']) {
    t.eq(await fresh(th), th + ' ' + th, `a fresh page opens in the ${th} theme`);
    const other = th === 'light' ? 'dark' : 'light';
    for (const [key, payload] of STATES) {
      await ctx.show(key, payload); await page.waitForTimeout(350);
      ref[th][key] = await paint(key);
      if (key === 'index') leg['index ' + th] = await legendSays('#i1Leg', 'index');
      if (key === 'replace') leg['replace ' + th] = await legendSays('#r2Leg', 'replace');
      await toggle(); sw[th][key] = { once: await paint(key) };
      if (key === 'index') leg[`index ${th} to ${other}`] = await legendSays('#i1Leg', 'index');
      if (key === 'replace') leg[`replace ${th} to ${other}`] = await legendSays('#r2Leg', 'replace');
      await toggle(); sw[th][key].twice = await paint(key);
    }
  }
  const dnum = { index: 4, rules: 5, drivers: 6 }, stale = [];
  for (const [key] of STATES) {
    const lab = dnum[key] ? `defect ${dnum[key]}, module ${key}` : `guard, module ${key}`;
    const a = await samePaint(key, sw.light[key].once, ref.dark[key]), b = await samePaint(key, sw.dark[key].once, ref.light[key]);
    t.ok(!a, `${lab}: after a switch from light to dark every element is painted as a fresh dark page paints it`, a);
    t.ok(!b, `${lab}: after a switch from dark to light every element is painted as a fresh light page paints it`, b);
    const c = await samePaint(key, sw.dark[key].twice, ref.dark[key]);
    t.ok(!c && sw.light[key].twice.join() === ref.light[key].join(), `${lab}: switching there and back returns to the first paint`, c);
    if (dots(sw.light[key].once) !== dots(ref.dark[key])) stale.push(key);
  }
  if (stale.length) t.note(`the city dots of the shared map keep the theme they were drawn in after a switch (modules ${stale.join(', ')}): app/js/02_map.js sets their fill once from cssv('--ink-2')`);
  /* the same when the switch is made while the module is off screen: every module is mounted light, the theme changes with
     only module 02 on screen (it always redrew itself), then modules 01, 03 and 04 are opened; and back with module 02 away */
  t.eq(await fresh('light'), 'light light', 'a fresh light page for the off screen switch');
  for (const [key, payload] of STATES) await ctx.show(key, payload);
  await ctx.show('replace'); await toggle();
  for (const key of ['index', 'rules', 'drivers']) { await ctx.show(key); await page.waitForTimeout(350); const d = await samePaint(key, await paint(key), ref.dark[key]); t.ok(!d, `defect ${dnum[key]}, module ${key}: a switch to dark made while the module was off screen leaves it as a fresh dark page`, d); }
  await toggle(); await ctx.show('replace'); await page.waitForTimeout(350);
  const off = await samePaint('replace', await paint('replace'), ref.light.replace);
  t.ok(!off, 'guard, module replace: a switch back to light made while it was off screen leaves it as a fresh light page', off);
  /* defects 7 and 8: the legend sentence agrees with the ramp it sits under, at first paint and after a switch, in both themes */
  for (const k of Object.keys(leg)) t.ok(leg[k].ok, `defect ${k.startsWith('index') ? 7 : 8}: the ${k.split(' ')[0]} legend says which end is darker as the ramp shows it (${k.split(' ').slice(1).join(' ')})`, leg[k]);
  t.ok(/shade darker/.test(leg['index light'].tx) && /shade lighter/.test(leg['index dark'].tx) && /^Darker/.test(leg['replace light'].tx) && /^Lighter/.test(leg['replace dark'].tx), 'defects 7 and 8: the wording does change with the theme', [leg['index light'].tx, leg['index dark'].tx]);

  /* ================= module 01, Thermal Debt Index ================= */
  await fresh('light');
  await ctx.show('index'); await scan('index as opened', 'index');
  /* defect 7 on a layer where low values carry the debt, and the note of that layer */
  await setVal('#i1Layer', 'medyr');
  const medyr = await legendSays('#i1Leg', 'index');
  t.ok(medyr.ok && /^Lower values shade darker \(older stock reads as more debt\)\. Eight quantile classes/.test(medyr.tx), 'defect 7: median year built says lower values shade darker, with no stray space before the period', medyr);
  await toggle(); const medyrD = await legendSays('#i1Leg', 'index'); await toggle();
  t.ok(medyrD.ok && /^Lower values shade lighter \(older stock reads as more debt\)\. Eight quantile classes/.test(medyrD.tx), 'defect 7: and in the dark theme, where the oldest stock is the palest, it says lighter', medyrD);
  t.ok(/Older stock takes the stronger color\./.test(await text('#i1Leg')) && !/Older stock shades darker/.test(await text('#i1Leg')), 'defect 7: the layer note no longer names a shade that is wrong in the dark theme');
  /* smaller thing: ZIPs with no contractor establishment nearby are not called empty of households */
  await setVal('#i1Layer', 'sys_per_est8');
  const est = await page.evaluate(() => ({ leg: document.querySelector('#i1Leg').innerText, nulls: ZR.filter(z => !isN(z.sys_per_est8)).length }));
  t.ok(est.nulls > 0 && /gray means no resident households or no contractor establishment within 8 km/.test(est.leg), 'smaller thing: the supply layer says its gray ZIPs can be ZIPs with no contractor establishment within 8 km', est);
  await setVal('#i1Layer', 'gas_sh');
  t.ok(/gray means no resident households\. /.test(await text('#i1Leg')), 'smaller thing: a layer with a value in every scored ZIP keeps the plain sentence');
  /* defect 12: the ranking follows the layer */
  const rank = () => page.evaluate(() => ({ name: document.querySelector('#i1TblName').textContent, heads: [...document.querySelectorAll('#i1Tbl th')].map(x => x.textContent), ids: [...document.querySelectorAll('#i1Tbl tbody tr')].slice(0, 3).map(tr => tr.dataset.id) }));
  const top = (k, dir) => page.evaluate(([k, dir]) => ZR.filter(z => isN(z[k])).sort((a, b) => dir * (a[k] - b[k])).slice(0, 3).map(z => z[k]), [k, dir]);
  const vals = (ids, k) => page.evaluate(([ids, k]) => ids.map(z => ZI[z][k]), [ids, k]);
  let r = await rank();
  t.ok(r.name === 'Homes heated with gas (%)' && r.heads[3] === 'Value ↓' && JSON.stringify(await vals(r.ids, 'gas_sh')) === JSON.stringify(await top('gas_sh', -1)), 'defect 12: "Ranking: Homes heated with gas" is ranked by that layer, highest first', r);
  await click('#i1Tbl th[data-k="gas_sh"]'); await setVal('#i1Layer', 'elec_sh'); r = await rank();
  t.ok(r.heads[3] === 'Value ↓' && JSON.stringify(await vals(r.ids, 'elec_sh')) === JSON.stringify(await top('elec_sh', -1)), 'defect 12: a header sort followed by a layer change no longer falls back to ZIP order', r);
  await setVal('#i1Layer', 'medyr'); r = await rank();
  t.ok(r.heads[3] === 'Value ↑' && JSON.stringify(await vals(r.ids, 'medyr')) === JSON.stringify(await top('medyr', 1)), 'defect 12: a layer where low values carry the debt ranks lowest first', r);
  await setVal('#i1Layer', 'idx'); r = await rank();
  t.ok(r.heads[2] === 'Index ↓' && JSON.stringify(await vals(r.ids, 'idx')) === JSON.stringify(await top('idx', -1)), 'defect 12: back on the index the ranking is by the index', r);
  /* defect 9: ordinals */
  const ord = await page.evaluate(() => { const want = n => { const t = n % 10, h = n % 100; return n + (t === 1 && h !== 11 ? 'st' : t === 2 && h !== 12 ? 'nd' : t === 3 && h !== 13 ? 'rd' : 'th'); }; const bad = [], seen = new Set(); ZR.forEach(z => { const n = +D(z.idx, 0), m = zipTip(z, 'idx').match(/<b>(\d+[a-z]+) pct\.<\/b>/); seen.add(want(n).slice(-2)); if (!m || m[1] !== want(n)) bad.push(z.zip + ' ' + (m && m[1])); }); const pick = k => ZR.find(z => +D(z.idx, 0) % 100 === k); return { bad: bad.slice(0, 5), kinds: [...seen].sort().join(), zips: [1, 2, 3, 11, 12, 13, 21, 92, 93].map(k => pick(k)).filter(Boolean).map(z => [z.zip, want(+D(z.idx, 0))]) }; });
  t.ok(!ord.bad.length && ord.kinds === 'nd,rd,st,th', 'defect 9: the tooltip of every scored ZIP carries the right ordinal', ord);
  const big = [];
  for (const [zip, want] of ord.zips.slice(0, 6)) { await ctx.show('index', { zip }); big.push([(await text('#i1Detail .big')).replace(/\s+/g, ' ').trim(), want + ' percentile']); }
  t.ok(big.length >= 4 && big.every(([got, want]) => got === want), 'defect 9: the detail panel prints 1st, 2nd, 3rd and 11th to 13th correctly', big);
  /* defect 11: the build label is gone and the compile date is read from the data */
  const d11 = await page.evaluate(() => ({ meta: [...document.querySelectorAll('#mod-index .mast .meta span')].map(s => s.textContent), foot: document.querySelector('#i1Foot').textContent, want: new Date(META.compiled + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), iso: META.compiled, mast: document.querySelector('#mod-index .mast').textContent }));
  t.ok(d11.meta.includes('Stock model compiled ' + d11.want) && !/Build \d/.test(d11.mast) && d11.foot.includes(`module 01. Compiled ${d11.want} for 277 ZIP codes`), 'defect 11: module 01 prints the compile date of the stock model and no build label', d11.meta);
  /* smaller thing: the footer no longer says public data only beside an Ahrefs roster row */
  const reg = await text('#i1Src');
  t.ok(!/Built from public data only/.test(d11.foot) && /Built from public data, plus the competitor roster carried from the earlier heatmap \(Google Business Profile and Ahrefs data of August 18, 2026\); no new Ahrefs pull was made for this build\./.test(d11.foot) && /Ahrefs, August 18, 2026/.test(reg), 'smaller thing: the footer names the roster its own source register lists', d11.foot.slice(-220));
  /* defects 13 and 14 */
  const cav = await page.evaluate(() => ({ t: document.querySelector('#i1Cav').innerText, se: D(META.weib.AC_TX.se_mean, 2) }));
  t.ok(cav.t.includes(`sampling error ±${cav.se})`) && cav.se.length === 4 && cav.t.includes('one click away in module 02.') && !cav.t.includes('one click away in module 04'), 'defect 13: the standard error keeps its two decimals and the scenarios are said to be in module 02', cav.se);
  t.ok(cav.t.includes('the ZIP ledger in module 11 shows them for median year built, value and income') && !/the detail panel shows them/.test(cav.t), 'defect 14: margins of error are said to be where they are shown');

  /* ================= module 02, Replacement Wave ================= */
  await ctx.show('replace'); await scan('replace as opened', 'replace');
  /* defect 2: the calculator on a gas furnace */
  const calcSet = o => page.evaluate(o => { const h = document.querySelector('#r2Calc'); for (const k in o) h.querySelector('#' + k).value = o[k]; h.querySelector('#cType').dispatchEvent(new Event('input', { bubbles: true })); return { out: h.querySelector('#cOut').innerText, html: h.querySelector('#cOut').innerHTML, nw: h.querySelector('#cNew').value, off: [...h.querySelectorAll('input,select')].filter(e => e.disabled).map(e => e.id).join() }; }, o);
  const furn = []; for (const ref of ['r22', 'r410', 'a2l']) furn.push(await calcSet({ cType: 'GasFurn_TX', cAge: 5, cQuote: 450, cRef: ref }));
  const ticket = await page.evaluate(() => [String(SLM.A.lines.furnace.ticket), M$(SLM.A.lines.furnace.ticket)]);
  t.ok(/READING: REPAIR/i.test(furn[0].out) && furn[0].html === furn[1].html && furn[1].html === furn[2].html, 'defect 2: a five year old furnace with a $450 repair reads Repair whatever the refrigerant field holds', furn[0].out.slice(0, 200));
  t.ok(!/R22 is no longer|R410A is still|A2L systems are|back in power|Cooling hours and power price|SEER|Energy saving|\$13,800/i.test(furn[0].out), 'defect 2: the furnace reading carries no refrigerant logic, no cooling saving and no full system price', furn[0].out);
  t.ok(furn[0].nw === ticket[0] && furn[0].out.includes(`replacement at ${ticket[1]} buys`) && /furnace ticket of \$[\d,]+, a stated assumption \(grade D\)/.test(furn[0].out) && /RECS 2020 Texas fit \(grade B\)/.test(furn[0].out), 'defect 2: the replacement price starts at the Service Lines furnace ticket and both inputs carry their grade', [furn[0].nw, ticket]);
  t.eq(furn[0].off, 'cRef,cTons,cSeer,cSeer2,cHrs,cKwh', 'defect 2: the refrigerant and cooling fields are switched off for a furnace');
  t.ok(/STILL IN SERVICE AT THIS AGE/i.test(furn[0].out) && /fuel savings are not estimated/.test(furn[0].out) && /flame sensors, igniters and control boards lead heating season part orders \(parts index carried from the heatmap, grade C\)/.test(furn[0].out), 'defect 2: under twenty years the reading names the usual part repairs and shows the share of furnaces still in service', furn[0].out.slice(-420));
  const grid = await page.evaluate(() => { const h = document.querySelector('#r2Calc'), w = WB.GasFurn_TX, bad = []; const parts = DATA.hm.components.map(c => String(c[0]).trim()); const i0 = parts.findIndex(x => /^HEATING SEASON/.test(x));
    for (const q of [0, 300, 450, 1450, 3000]) for (let a = 1; a <= 30; a++) { h.querySelector('#cType').value = 'GasFurn_TX'; h.querySelector('#cQuote').value = q; h.querySelector('#cAge').value = a; h.querySelector('#cRef').value = ['r22', 'r410', 'a2l'][a % 3]; h.querySelector('#cAge').dispatchEvent(new Event('input', { bubbles: true }));
      const tx = h.querySelector('#cOut').innerText, rule = a * q, p1 = weibH1(a, w.lam, w.k), want = rule > 5000 || p1 > 0.2 ? 'Replace' : rule > 3500 ? 'Close call' : 'Repair', got = (tx.match(/READING: (REPLACE|CLOSE CALL|REPAIR)/i) || [])[1] || '';
      const old = /At \d+ years the questions are the heat exchanger, the flame safety parts and whether the matching air conditioner is due too/.test(tx) && /A cracked heat exchanger is a safety finding that overrides this arithmetic\./.test(tx);
      if (got.toLowerCase() !== want.toLowerCase() || old !== (a >= 20) || !tx.includes(P(weibS(a, w.lam, w.k) * 100, 0)) || /R22|R410A|A2L|SEER|back in power/.test(tx) || h.querySelector('#cNew').value !== String(SLM.A.lines.furnace.ticket)) bad.push([q, a, got, want, old]); }
    return { bad: bad.slice(0, 4), n: 150, lead: parts.slice(i0 + 1, i0 + 4) }; });
  t.ok(!grid.bad.length, 'defect 2: furnace, every age from 1 to 30 at five repair quotes: the reading follows the $5,000 rule and the furnace life alone, and past twenty years it asks the furnace questions', grid.bad);
  t.ok(/Flame sensors/.test(grid.lead[0]) && /igniters/i.test(grid.lead[1]) && /control boards/i.test(grid.lead[2]), 'evidence for defect 2: the three parts the reading names are the three that lead the heating season in the parts index the atlas carries', grid.lead);
  /* the field follows the equipment only while it holds a default; a typed quote is kept */
  const back = await calcSet({ cType: 'AC_TX', cAge: 14, cQuote: 1450, cRef: 'r410' });
  t.ok(back.nw === '13800' && back.off === '' && /ENERGY SAVING A YEAR/i.test(back.out) && await page.evaluate(() => [...document.querySelectorAll('#r2Calc input, #r2Calc select')].every(e => !e.style.opacity)), 'defect 2: back on an air conditioner the full system price and every field return', [back.nw, back.off]);
  await calcSet({ cNew: 9000 }); const kept = [(await calcSet({ cType: 'GasFurn_TX' })).nw, (await calcSet({ cType: 'HP_TX' })).nw];
  t.eq(kept, ['9000', '9000'], 'defect 2: a replacement quote the user typed is not overwritten when the equipment changes');
  await calcSet({ cNew: 13800, cType: 'AC_TX' });
  /* guard: air conditioner and heat pump readings, byte for byte */
  const calc = await page.evaluate(() => { const h = document.querySelector('#r2Calc'), out = { AC_TX: 2166136261, HP_TX: 2166136261, n: 0 }; const fnv = (x, s) => { for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x; };
    for (const q of [0, 300, 450, 1450, 3000]) for (let a = 1; a <= 30; a++) for (const ref of ['r22', 'r410', 'a2l']) for (const type of ['GasFurn_TX', 'AC_TX', 'GasFurn_TX', 'HP_TX']) { h.querySelector('#cType').value = type; h.querySelector('#cRef').value = ref; h.querySelector('#cQuote').value = q; h.querySelector('#cAge').value = a; h.querySelector('#cType').dispatchEvent(new Event('input', { bubbles: true })); if (type !== 'GasFurn_TX') { out[type] = fnv(out[type], h.querySelector('#cOut').innerHTML + '|' + h.querySelector('#cNew').value); out.n++; } }
    return out; });
  t.eq(calc, B4.calc, 'guard: 900 air conditioner and heat pump readings (5 repair quotes, ages 1 to 30, 3 refrigerants, a furnace selected in between) are byte for byte the Build 4 readings');
  await calcSet({ cType: 'AC_TX', cAge: 14, cQuote: 1450, cRef: 'r410' });
  /* defect 3: the cohort note of a county speaks of that county */
  const coh = async fips => { await setVal('#r2Cty', fips); return page.evaluate(f => { const yrs = DATA.bps.years, u1 = yrs.map((_, i) => sum((f ? [f] : FIPS).map(x => DATA.bps.u1[x][i]))); const lo = Math.min(...u1.slice(17, 23)), rec = u1.slice(yrs.indexOf(2020)); return { note: document.querySelector('#r2CohNote').textContent, want: `fell to ${N(lo)} by ${yrs[17 + u1.slice(17, 23).indexOf(lo)]}; since 2020 they have run between ${N(Math.min(...rec))} and ${N(Math.max(...rec))} a year.`, max: Math.max(...rec) }; }, fips); };
  const hood = await coh('48221'), metro = await coh('');
  t.ok(hood.note.includes(hood.want) && hood.max < 1000 && !/40,000/.test(hood.note), 'defect 3: Hood County: the trough year and the range since 2020 are the county\'s own', hood.note.slice(0, 170));
  t.ok(metro.note.includes(metro.want) && metro.max > 40000, 'defect 3: the metro note is computed the same way', metro.note.slice(0, 170));
  /* defect 10: a header sort survives a click on a row and a change of scenario; the Sort control still takes over */
  const tbl = () => page.evaluate(() => ({ first: document.querySelector('#r2Tbl tbody tr').dataset.id, arrow: [...document.querySelectorAll('#r2Tbl th')].find(x => /[↓↑]/.test(x.textContent)).textContent }));
  const want10 = await page.evaluate(() => ({ per1k: ZR.slice().sort((a, b) => b.rep_per1k - a.rep_per1k)[0].zip, r22: ZR.slice().sort((a, b) => b.r22 - a.r22)[0].zip }));
  await click('#r2Tbl th[data-k="rep_per1k"]'); const s1 = await tbl();
  await page.evaluate(() => document.querySelectorAll('#r2Tbl tbody tr')[3].click()); await page.waitForTimeout(150); const s2 = await tbl();
  await click('#r2Scn button[data-v="k3"]'); await page.waitForTimeout(150); const s3 = await tbl();
  t.ok(s1.first === want10.per1k && s1.arrow === 'Per 1k ↓' && JSON.stringify(s2) === JSON.stringify(s1) && JSON.stringify(s3) === JSON.stringify(s1), 'defect 10: the ranked table keeps a header sort through a row click and a scenario change', [s1, s2, s3]);
  await setVal('#r2Sort', 'r22'); const s4 = await tbl();
  t.ok(s4.first === want10.r22 && s4.arrow === 'R22 era ↓', 'defect 10: the Sort control still sets the order', s4);
  await setVal('#r2Sort', 'rep'); await click('#r2Scn button[data-v="fit"]'); await ctx.show('replace', { zip: '75150' });
  /* defects 23, 24 and 33 and the compile date of the file note */
  const m2 = await page.evaluate(() => ({ leg: [...document.querySelectorAll('#r2CohLeg .chartleg span')].map(s => s.textContent), names: ['cSeer', 'cSeer2', 'cKwh', 'cTons', 'cHrs'].map(id => document.getElementById(id).getAttribute('aria-label')), seg: document.querySelector('#r2Scn').getAttribute('role') + ' ' + ((document.getElementById(document.querySelector('#r2Scn').getAttribute('aria-labelledby')) || {}).textContent || ''), step7: document.querySelectorAll('#r2Meth li')[6].innerText, obs: document.querySelector('#r2ObsNote').innerText, r85: D(META.cal['Fort Worth'].r85, 2), n85: META.cal['Fort Worth'].n85, caps: Object.values(META.cal).map(c => c.cap) }));
  t.ok(m2.leg.length === 1 && /^Single family permits \(hover a bar for the share still on the original system\)$/.test(m2.leg[0]), 'defect 23: the cohort legend names only the series that is drawn', m2.leg);
  t.ok(m2.names.every(Boolean) && m2.names[0] === 'Old SEER' && m2.names[1] === 'New SEER2' && m2.names[2] === 'Dollars per kWh' && m2.seg === 'group Wear out scenario', 'defect 24: every calculator field has a name of its own and the scenario buttons are a labeled group', [m2.names, m2.seg]);
  const plotted = (m2.obs.match(/across (\d+) ZIPs/) || [])[1], rng = (m2.step7.match(/captured share is (\d+)% to (\d+)%/) || []).slice(1).map(Number);
  t.ok(m2.step7.includes(`counts correlate at r = ${m2.r85} across ${m2.n85} Fort Worth ZIP parts (the chart plots the ${plotted} scored ones)`) && +plotted < m2.n85, 'defect 33: the calibration step says which correlation it quotes and why the chart note has another', m2.step7.slice(-200));
  t.ok(rng.length === 2 && rng[0] <= rng[1] && rng[0] === Math.round(Math.min(...m2.caps) * 100) && rng[1] === Math.round(Math.max(...m2.caps) * 100), 'defect 33: the captured share range runs from low to high', rng);

  /* ================= module 03, Rules and Refrigerants ================= */
  await ctx.show('rules'); await page.waitForTimeout(300);
  /* the furnace rule: what the Federal Register holds, with both document numbers */
  const fr = await page.evaluate(() => { const row = RULE_CAL.find(r => r[0] === '2026-06-08') || [], std = STANDARDS.find(r => /gas furnace/i.test(r[0])) || [], pet = RULE_CAL.find(r => r[0] === '2026-04-27') || [], cd = RULE_CAL.find(r => r[0] === '2028-12-18') || []; return { row, std, pet, cd, shown: [...document.querySelectorAll('#p3Cal tbody tr')].map(tr => tr.innerText).find(x => x.startsWith('2026-06-08')) || '', all: document.getElementById('mod-rules').innerText, src: document.querySelector('#p3Src').innerText }; });
  const need = ['The Federal Register holds no proposal from DOE to delay the furnace standard', '2023-25514, 88 FR 87502, published December 18, 2023', 'compliance required on and after December 18, 2028', '2026-08145, 91 FR 22477, published April 27, 2026', 'a petition from three gas associations on February 19, 2026', 'until January 1, 2030 at a minimum', 'comments closed May 27, 2026', 'AGA v. DOE, No. 25-879, January 20, 2026', 'Through November 13, 2026 there is no answer to the petition, no change of the date and no withdrawal (grade A)'];
  t.ok(need.every(x => (fr.row[2] || '').includes(x)), 'furnace rule: the row of June 8, 2026 states what the Federal Register holds, with both documents, their dates and the petition', need.filter(x => !(fr.row[2] || '').includes(x)));
  t.ok(!/proposed delaying|delaying the mandate/.test(fr.all) && !/has proposed/.test(fr.row[2] || '') && String(fr.row[5]).split('/')[0] === 'A' && /2023-25514/.test(fr.row[3]) && /2026-08145/.test(fr.row[3]) && fr.shown.includes('no answer to the petition'), 'furnace rule: nothing in the module says the Department proposed a delay; the row cites both documents and leads with grade A', [fr.row[3], fr.row[5]]);
  t.ok(/Separately, ACHR News reports that the Supreme Court vacated/.test(fr.row[2]) && /\(grade B\)\.$/.test(fr.row[2]) && !/^ACHR/.test(fr.row[3]), 'furnace rule: the remand stays a report of a trade paper at grade B, told apart from what the register holds', fr.row[2].slice(-190));
  t.ok(/2023-25514/.test(fr.std[3]) && /2026-08145/.test(fr.std[3]) && /DOE has not answered it or proposed a change/.test(fr.std[3]) && fr.std[1].includes('95% AFUE on and after Dec 18, 2028') && /received on February 19, 2026 from three gas associations/.test(fr.pet[2]) && /91 FR 22477 \(2026-08145\)/.test(fr.pet[3]) && /88 FR 87502, 2023-25514/.test(fr.cd[3]) && /final rule 2023-25514 \(88 FR 87502\)/.test(fr.src), 'furnace rule: the standards row, the petition row, the compliance row and the source register cite the same two documents', [fr.std[3], fr.pet[3], fr.cd[3]]);
  /* defect 21: the gas utility rebate, hedged: its page could not be read, so no amount */
  const inc = await page.evaluate(() => ({ at: INCENTIVES.find(r => /^Atmos Energy/.test(r[0])) || [], tx: INCENTIVES.find(r => /^Texas HOMES/.test(r[0])) || [], shown: [...document.querySelectorAll('#p3Inc tbody tr')].map(tr => ({ t: tr.innerText, a: (tr.querySelector('a') || {}).href || '' })).find(x => /^Atmos Energy/.test(x.t)) || {}, read: [...document.querySelectorAll('#p3Read li')].map(li => li.innerText)[2], judg: document.querySelector('#p3Judg').innerText }));
  t.ok(/Mid-Tex appliance rebates/.test(inc.at[0]) && inc.at[1] !== 'None found' && /90% AFUE or higher/.test(inc.at[2]) && /95% AFUE or higher/.test(inc.at[2]) && !/No residential furnace rebate identified/.test(inc.at[2]), 'defect 21: the Atmos Energy row lists the furnace rebate the utility publishes', inc.at.slice(0, 3));
  t.ok(!/\$\s?\d/.test(inc.at[2]) && /could not be opened/.test(inc.at[2]) && /confirm on the Atmos page before quoting/.test(inc.at[2]) && inc.at[4] === '◐' && inc.at[5] === 'C' && /^https:\/\/www\.atmosenergy\.com\//.test(inc.at[6]) && inc.shown.a === inc.at[6], 'defect 21: it states no amount, says the page was not read, is graded C and links the publisher', [inc.at[4], inc.at[5], inc.shown.a]);
  t.ok(/for gas furnaces, the appliance rebate Atmos Energy lists for its Mid-Tex division \(grade C until its page is read\)/.test(inc.read) && !/The only live money/.test(inc.read) && /The Atmos Energy rebate is stated the same way/.test(inc.judg), 'defect 21: the contractor reading and the judgment call know the rebate', inc.read);
  /* defect 22: the state rebates, no stale comment period, graded for what was read */
  const d22 = await page.evaluate(() => { const row = RULE_CAL.find(r => r[0] === '2026-05-19') || [], k = [...document.querySelectorAll('#p3Kpis .kpi')].find(x => /Texas rebates/i.test(x.querySelector('.kl').textContent)); return { row, kpi: k ? [k.querySelector('.g').textContent, k.querySelector('.kv').textContent, k.querySelector('.kd').textContent] : [], all: document.getElementById('mod-rules').innerText, meta: [...document.querySelectorAll('#mod-rules .mast .meta span')].map(s => s.textContent).pop() }; });
  t.ok(!/comment period/.test(d22.all) && /as read on May 19, 2026/.test(d22.row[2]) && /Confirm with SECO before quoting/.test(d22.row[2]) && d22.row[4] === '◐' && d22.row[5] === 'C', 'defect 22: the calendar row drops the comment period that closed in August and says when the page was read', d22.row.slice(2));
  t.ok(d22.kpi[0] === 'C' && d22.kpi[1] === 'Not launched' && /as last read at SECO on May 19, 2026; confirm before quoting/.test(d22.kpi[2]), 'defect 22: the figure at the top is graded C and dated', d22.kpi);
  t.ok(inc.tx[1] === 'Not launched' && inc.tx[5] === 'C' && inc.tx[4] === '◐' && /Confirm the status and the amounts with SECO before quoting/.test(inc.tx[2]) && /could not be opened again/.test(inc.tx[2]) && /rechecked November 13, 2026/.test(d22.meta), 'defect 22: the incentive row says the same, and the masthead says which rows were rechecked', [inc.tx[5], d22.meta]);
  /* defect 19: no two labels of the refrigerant clock share a spot; defect 20: the era chart is legible; defect 25 */
  const clock = await page.evaluate(() => { const L = [...document.querySelectorAll('#p3Clock text.lblm')].map(e => ({ t: e.textContent, r: e.getBoundingClientRect() })); const hit = []; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i].r, b = L[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) hit.push(L[i].t + ' / ' + L[j].t); } return { n: L.length, hit, labels: L.map(x => x.t) }; });
  t.ok(clock.n === 7 && !clock.hit.length, 'defect 19: the seven labels of the refrigerant clock do not overlap', clock);
  const era = () => page.evaluate(() => { const s = document.querySelector('#p3EraC svg'), r = s.getBoundingClientRect(), vb = +s.getAttribute('viewBox').split(' ')[2]; return { px: +(parseFloat(getComputedStyle(s.querySelector('text.ax')).fontSize) * r.width / vb).toFixed(1), fits: r.width <= document.querySelector('#p3EraC').clientWidth + 1, labels: [...s.querySelectorAll('text.ax')].map(x => x.textContent), over: document.documentElement.scrollWidth - innerWidth }; });
  const e1 = await era();
  t.ok(e1.px >= 9.5 && e1.fits && e1.labels.join('|') === 'R22 era, before 2010|R410A era, 2010 to 2024|Since 2025, A2L or R410A stock', 'defect 20: the refrigerant era chart prints its labels at a readable size', e1);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500); const e2 = await era();
  t.ok(e2.px >= 9.5 && e2.fits && e2.over <= 0, 'defect 20: it does at phone width too, inside its card', e2);
  const wide = {}; for (const k of ['index', 'replace', 'drivers', 'rules']) { await ctx.show(k); const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o > 0) wide[k] = o; }
  t.ok(!Object.keys(wide).length, 'guard: at phone width none of the four modules makes the page scroll sideways', wide);
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(500); const e3 = await era();
  t.eq([e3.px >= 9.5, e3.fits], [true, true], 'defect 20: and again once the window is wide');
  t.eq(await page.evaluate(() => [document.querySelector('#p3Layer').getAttribute('aria-label'), document.querySelector('#p3Layer').labels.length]), ['Map layer', 0], 'defect 25: the map layer select of module 03 has a name');
  /* the policy calendar file says its vintage in words */
  const cal = await ctx.download(() => click('#p3Csv')), calRows = dataRows(cal.text).trim().split('\n');
  t.ok(cal.name === 'dfw-hvac-policy-calendar.csv' && calRows[0] === 'date,event,what_changed,source,vintage,grade' && calRows.length === 17 && !/[✔◐]/.test(cal.text) && calRows.slice(1).every(l => /,(read this build|secondary or memory),(A|B|C|D|A\/B)$/.test(l)), 'policy calendar file: the vintage column holds words a spreadsheet can read, not marks', calRows[1]);

  /* ================= module 04, Demand Drivers ================= */
  await ctx.show('drivers');
  const d4 = await page.evaluate(() => { const fs = DATA.ts['Fort Worth'].series, wx = DATA.ts.wx_monthly, m = k => (fs.find(r => r[0] === k) || [])[1], d = k => wx.d100[wx.m.indexOf(k)], H = META.heat; const ps = []; ['Fort Worth', 'Dallas', 'Irving'].forEach(c => ['p_d100', 'p_cdd', 'p_fr20', 'p_first'].forEach(k => ps.push(H[c][k])));
    return { note: document.querySelector('#d4TsN').textContent, want: `August 2026 (${d('2026-08')} days at 100°F) produced ${N(m('2026-08'))} permits against ${N(m('2025-08'))} in August 2025 (${d('2025-08')} days).`, last: fs[fs.length - 1][0], cells: [...document.querySelectorAll('#d4El td .mini')].map(e => e.textContent), tiny: ps.filter(p => p < 0.001).length, mean: [...document.querySelectorAll('#d4Mean li')].map(e => e.innerText), b: D(DATA.drivers.obs_per1k.rows[6].b, 2), lab: DATA.drivers.obs_per1k.rows[6].l, capB: DATA.drivers.lcap.rows[6].b, capP: DATA.drivers.lcap.rows[6].p, el: D(META.cap_elast.b, 2), lisa: [document.querySelector('#d4Lisa').getAttribute('aria-label'), document.querySelector('#d4Lisa').labels.length], hpHot: ZR.filter(z => z.lisa_hp_sh === 'HH').map(z => z.cty) }; });
  t.ok(d4.note.includes(d4.want) && d4.last === '2026-08' && !/same two months/.test(d4.note), 'defect 1: the heat note compares August with August, with the permits and the 100°F days of the data', d4.note.slice(0, 260));
  t.ok(!d4.cells.some(c => /p 0\.000/.test(c)) && d4.cells.filter(c => /p < 0\.001$/.test(c)).length === d4.tiny && d4.tiny > 0, 'defect 18: a probability under one in a thousand prints as p < 0.001', d4.cells);
  t.ok(d4.mean[3].includes(`Capture rises with income (elasticity ${d4.el}), and observed permits per 1,000 systems fall with the Spanish speaking share (β = minus ${d4.b.slice(1)}).`) && /Spanish/.test(d4.lab) && d4.b[0] === '-' && d4.capP > 0.05, 'defect 16: the Spanish speaking coefficient is credited to the observed permits model it comes from', d4.mean[3]);
  t.ok(/the south and west exurbs in Johnson, Parker, Hood and Ellis counties, and the apartment districts of central Dallas/.test(d4.mean[2]) && !/east and south/.test(d4.mean[2]) && d4.hpHot.length > 0 && !d4.hpHot.some(c => ['Hunt', 'Kaufman', 'Rockwall'].includes(c)), 'defect 17: the heat pump reading names the south and west, where the hot spot ZIPs are', [...new Set(d4.hpHot)]);
  t.eq(d4.lisa, ['Measure to map', 0], 'defect 27: the cluster measure select has a name');
  /* defect 15 */
  await click('#d4Meas'); await page.evaluate(() => document.querySelector('#d4Meas').dispatchEvent(new Event('input', { bubbles: true })));
  const meas = await page.evaluate(() => [...document.querySelectorAll('#d4Vt tbody tr')].map(tr => +tr.cells[0].textContent));
  await click('#d4Meas'); await page.evaluate(() => document.querySelector('#d4Meas').dispatchEvent(new Event('input', { bubbles: true })));
  const uhi = await page.evaluate(() => { const tr = [...document.querySelectorAll('#d4Vt tbody tr')].find(tr => tr.cells[0].textContent === '11'); return tr ? [tr.cells[1].textContent, tr.cells[7].textContent] : null; });
  await ctx.show('index'); const gap = await text('#i1Gap'); await ctx.show('drivers');
  t.ok(meas.length === 12 && !meas.includes(11) && uhi && /heat island/i.test(uhi[0]) && uhi[1] === '' && /Urban heat island by ZIP/.test(gap) && /was not built for this edition/.test(gap), 'defect 15: urban heat island is not tagged measured, as module 01 says it was not built', [meas, uhi]);

  /* ================= defect 31: no hyphen and no dash between words, on screen and in the notes of the files ================= */
  /* quoted source text is left as it is and the card says so: the 57 row matrix and the predictor names of the two coefficient plots */
  const quoted = await page.evaluate(() => ({ plots: [...document.querySelectorAll('#mod-drivers .card-h p')].map(p => p.textContent).find(x => /Predictor names in both plots are printed as the model file stores them/.test(x)) || '', matrix: [...document.querySelectorAll('#mod-drivers .card-h p')].map(p => p.textContent).find(x => /Cells are quoted as the matrix has them, in its authors' wording/.test(x)) || '', raw: DATA.hm.vars.filter(v => /-/.test(v.variable + v.direction + v.finding)).length, names: DATA.drivers.obs_per1k.rows.filter(r => /-/.test(r.l)).length }));
  t.ok(quoted.plots && quoted.matrix && quoted.raw > 0 && quoted.names > 0, 'defect 31: the inherited matrix and the model\'s predictor names are left as their sources wrote them, and their cards say so', quoted);
  await ctx.show('index', { zip: '75150' }); await scan('index, a ZIP selected', 'index');
  for (const k of await page.evaluate(() => Object.keys(LAYERS).filter(k => !(SLM.layers()[k])))) { await setVal('#i1Layer', k); const bad = hyphens(await text('#i1Leg') + '\n' + await text('#i1TblName') + '\n' + await page.evaluate(k => zipTip(ZI['75150'], k).replace(/<[^>]+>/g, '\n'), k)); if (bad.length) seen['index layer ' + k] = bad; }
  await setVal('#i1Layer', 'idx'); await setVal('#i1Cty', '48221'); await scan('index, a county', 'index'); await setVal('#i1Cty', '');
  await ctx.show('replace', { zip: '75150' }); await scan('replace, a ZIP selected', 'replace'); await ctx.show('replace', { zip: '75150' });
  for (const sc of ['k3', 'k4', 'fit']) { await click(`#r2Scn button[data-v="${sc}"]`); await page.waitForTimeout(120); await scan('replace, scenario ' + sc, 'replace'); }
  for (const [age, q] of [[5, 450], [25, 900]]) { await calcSet({ cType: 'GasFurn_TX', cAge: age, cQuote: q }); const bad = hyphens(await text('#cOut')); if (bad.length) seen['furnace reading at ' + age] = bad; }
  for (const ref of ['r22', 'r410', 'a2l']) { const bad = hyphens((await calcSet({ cType: 'HP_TX', cAge: 14, cQuote: 1450, cRef: ref })).out); if (bad.length) seen['heat pump reading ' + ref] = bad; }
  await calcSet({ cType: 'AC_TX', cAge: 14, cQuote: 1450, cRef: 'r410' });
  for (const k of await page.evaluate(() => [...document.querySelectorAll('#r2Layer option')].map(o => o.value))) { await setVal('#r2Layer', k); const bad = hyphens(await text('#r2Leg')); if (bad.length) seen['replace layer ' + k] = bad; }
  await setVal('#r2Layer', 'rep_per1k'); await setVal('#r2Cty', '48221'); await scan('replace, a county', 'replace'); await setVal('#r2Cty', '');
  await ctx.show('rules'); for (const k of ['furn20_sh', 'gas_sh', 'hp_sh', 'r22_sh']) { await setVal('#p3Layer', k); await scan('rules, layer ' + k, 'rules'); }
  await ctx.show('drivers'); await scan('drivers', 'drivers', ['#d4Vt', '#d4C1 svg', '#d4C2 svg']);
  t.ok(!Object.keys(seen).length, 'defect 31: no hyphen or dash joins two words anywhere the four modules print (every layer, every scenario, a ZIP, the calculator), official names and numbers aside', seen);
  /* a negative number in a sentence is written out */
  const neg = await page.evaluate(() => { const out = []; ['index', 'replace', 'rules', 'drivers'].forEach(k => document.getElementById('mod-' + k).querySelectorAll('p, li, dd, .callout, .foot, .kd, .dn').forEach(e => { if (e.closest('#d4Vt')) return; const m = e.innerText.match(/.{0,30}[\s(=][\u2212-]\d.{0,12}/); if (m) out.push(m[0]); })); return { out: out.slice(0, 5), minus: (document.getElementById('mod-index').innerText.match(/r = minus 0\.\d\d/g) || []).length, corr: D(DATA.index.corr.aged.wave, 2) }; });
  t.ok(!neg.out.length && neg.minus >= 3 && neg.corr[0] === '-', 'defect 31: a negative correlation in a sentence reads "minus 0.75", not a hyphen and a number', neg);

  /* ================= the files the four modules save ================= */
  const files = {};
  await ctx.show('index'); files.i1Csv = await ctx.download(() => click('#i1Csv'));
  await ctx.show('replace'); files.r2Csv = await ctx.download(() => click('#r2Csv')); files.r2Fc = await ctx.download(() => click('#r2Fc'));
  await ctx.show('drivers'); files.d4Csv = await ctx.download(() => click('#d4Csv')); files.d4Vars = await ctx.download(() => click('#d4Vars'));
  const noteBad = {}; for (const k of Object.keys(files).concat('cal')) { const bad = hyphens(notes((files[k] || cal).text)); if (bad.length) noteBad[k] = bad; }
  t.ok(!Object.keys(noteBad).length && Object.keys(files).every(k => notes(files[k].text).length > 0), 'defect 31: the note at the head of each of the six files carries no hyphenated compound', noteBad);
  t.ok(notes(files.i1Csv.text).includes(`module 01, compiled ${d11.iso}.`) && notes(files.r2Csv.text).includes(`module 02, compiled ${d11.iso}.`) && /ACS 2020 to 2024 year built/.test(notes(files.i1Csv.text)), 'defect 11: the notes of the two ZIP files take the compile date from the data', notes(files.i1Csv.text).split('\n')[0]);
  t.ok(/Cells are quoted as the matrix has them, in its authors' wording and with their strength and tier labels\./.test(notes(files.d4Vars.text)), 'defect 31: the predictor file says its cells are quoted source text');
  t.eq(Object.fromEntries(Object.keys(B4.csv).map(k => [k, sha(dataRows(files[k].text))])), B4.csv, 'guard: the header and every data row of the five data files are the Build 4 rows (only the notes changed)');

  /* ================= what other files lean on is still there, and nothing broke ================= */
  const api = await page.evaluate(() => ({ fn: [typeof layerOptions, typeof zipTip, typeof weibS, typeof weibMRL, typeof weibH1].join(), n: [Object.keys(LAYERS).length - Object.keys(SLM.layers()).length, COMP_KEYS.length, Object.keys(SCN).join(), RULE_CAL.length, INCENTIVES.length, STANDARDS.length, LICENSE.length, WB === META.weib_all], keys: Object.keys(LAYERS).slice(0, 36).join() }));
  t.ok(api.fn === 'function,function,function,function,function' && JSON.stringify(api.n) === JSON.stringify([36, 7, 'fit,k3,k4', 16, 8, 5, 7, true]) && api.keys === 'idx,idx_eq,ge15_sh,ge20_sh,rep_per1k,origwin_sh,orig_sh,first5_per1k,r22_sh,furn20_sh,meanage,medyr,yb_pre1980,yb_duct,yb_2000_09,yb_2010_19,yb_2020p,own_sf_sh,rent_sf_sh,mf_sh,gas_sh,elec_sh,hp_sh,hail1_8km,hail175_8km,hail_recent,sys_per_est8,comp_mass,est23,value,inc,rooms,own65_sh,own_recent_sh,span_sh,density', 'guard: the layer catalog keeps its 36 keys and the names other modules use are all defined', api);
  t.ok(!ctx.errors.length, 'no page error or console error', ctx.errors.slice(0, 5));
}
