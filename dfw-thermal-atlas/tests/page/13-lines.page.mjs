/* Module 12 Service Lines and the service line model behind it: every touch up fix, and a guard that the model's core
   outputs are still the ones the Build 4 file produces. */
/* Build 4 values, read from dist/DFW_Thermal_Debt_Atlas.html with tools/drive.mjs. agg: metro jobs a year (1 decimal) and
   gross profit pool ($). zip: priority percentile (2 decimals) and bid modifier. alloc: what allocate() buys with $25,000
   at concentration 0.7 in the annual view and in January: media ($), jobs (2 decimals), gross profit ($). */
const B4 = {
  agg: { heat: [237342.3, 275275391], furnace: [57852.5, 229378358], heatpump: [55093.4, 359523680], maint: [306208, 250212095], repair: [622975.9, 860053285], replace: [176804.6, 1056188491] },
  zip: {
    75035: { heat: [98.48, 45], furnace: [99.62, 45], heatpump: [84.79, 30], maint: [96.2, 45], repair: [98.48, 45], replace: [98.48, 45] },
    75150: { heat: [66.92, 15], furnace: [67.3, 15], heatpump: [74.14, 15], maint: [60.46, 15], repair: [66.54, 15], replace: [65.4, 15] },
    76028: { heat: [99.62, 45], furnace: [88.21, 30], heatpump: [99.62, 45], maint: [99.62, 45], repair: [99.62, 45], replace: [99.62, 45] },
  },
  alloc: { heat: { ann: [2055, 13.48, 14164], jan: [4553, 29.87, 31384] }, furnace: { ann: [2266, 5.69, 21557], jan: [3571, 8.97, 33968] }, maint: { ann: [2357, 30.43, 21749], jan: [2455, 31.68, 22645] }, repair: { ann: [4571, 25.16, 31592], jan: [3242, 17.84, 22406] }, replace: { ann: [7531, 14.48, 86504], jan: [6578, 12.65, 75556] } },
};
export default async function (page, t, ctx) {
  const core = () => page.evaluate(([ids, zips, al]) => {
    const buy = (m, id) => { const r = SLM.allocate(25000, m, null, null, 0.7).find(x => x.line.id === id); return [Math.round(r.budget), +r.jobs.toFixed(2), Math.round(r.gpOut)]; };
    return { agg: Object.fromEntries(ids.map(id => [id, [+SLM.AGG[id].jobs.toFixed(1), Math.round(SLM.AGG[id].gp)]])), zip: Object.fromEntries(zips.map(z => [z, Object.fromEntries(ids.map(id => [id, [+SLM.SLZ[z][id].pri.toFixed(2), SLM.SLZ[z][id].bid]]))])), alloc: Object.fromEntries(al.map(id => [id, { ann: buy(null, id), jan: buy(0, id) }])) };
  }, [Object.keys(B4.agg), Object.keys(B4.zip), Object.keys(B4.alloc)]);
  const guard = async when => { const got = await core(); t.eq(got.agg, B4.agg, `guard, ${when}: metro jobs and gross profit pool of the six lines are the Build 4 values`); for (const z of Object.keys(B4.zip)) t.eq(got.zip[z], B4.zip[z], `guard, ${when}: priority and bid modifier in ${z} are the Build 4 values`); t.eq(got.alloc, B4.alloc, `guard, ${when}: allocate() buys the same media, jobs and gross profit as Build 4`); };
  const rowl = (host, label) => page.evaluate(([h, l]) => { const r = [...document.querySelectorAll(h + ' .rowl')].find(x => x.querySelector('span').textContent.startsWith(l)); return r ? [r.querySelector('span').textContent, r.querySelector('b').textContent] : null; }, [host, label]);
  const setVal = (sel, v) => page.evaluate(([s, x]) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
  const recv = p => page.evaluate(x => MODI.lines.receive(x), p);
  const usd = s => +String(s).replace(/[$,]/g, '');
  const media = async zips => { let s = 0; for (const z of zips) { await recv({ zip: z }); s += usd((await rowl('#l12Zip', 'Indicative monthly media'))[1]); } return s; };
  await ctx.show('lines');
  await guard('build defaults');

  /* counts the data states (ZIPs, competitors) are read from the data */
  const n = await page.evaluate(() => ({ zr: ZR.length, zrN: N(ZR.length), comp: N(COMP.filter(l => l.tier !== 'integrity').length), roster: N(COMP.filter(l => l.tier === 'roster').length), all: N(COMP.length), eyebrow: document.querySelector('#mod-lines .eyebrow').textContent, max: document.querySelector('#l12N').max, press: [...document.querySelectorAll('#mod-lines .card-h p')].map(p => p.textContent).find(x => /mapped competitors sell each line/.test(x)) || '', cav: document.querySelector('#l12Cav').textContent }));
  t.ok(n.zr > 0 && n.eyebrow.endsWith(`, ${n.zrN} ZIPs`) && n.max === String(n.zr), 'the eyebrow and the cap on ZIPs in the buy follow the number of scored ZIPs', n);
  t.ok(n.press.includes(`How many of the ${n.comp} mapped competitors`) && n.cav.includes(`Roster companies (${n.roster} of ${n.all})`), 'competitor counts in the copy follow the competitor file', [n.press, n.comp, n.roster, n.all]);
  await recv({ zip: '75150' }); await setVal('#l12N', 99999);
  t.ok((await page.evaluate(() => document.querySelector('#l12Zip').textContent)).includes(`across the top ${n.zrN} ZIPs`), 'a buy larger than the metro is cut to the scored ZIPs');
  await setVal('#l12N', 40);

  /* D13: the pool that is larger than revenue says why; D14: the headline is the direct pool and the credit is named */
  await recv({ line: 'heat' });
  const heat = { more: await page.evaluate(() => SLM.AGG.heat.gp > SLM.AGG.heat.rev), rev: await rowl('#l12Brief', 'Revenue pool'), gp: await rowl('#l12Brief', 'Gross profit pool') };
  t.ok(heat.more && /^Gross profit pool \(\d+% margin plus the replacement pipeline credit\)$/.test(heat.gp[0]), 'D13 a line whose pool exceeds its revenue names the replacement pipeline credit beside it', heat);
  await recv({ line: 'replace' });
  t.ok(/^Gross profit pool \(\d+% margin\)$/.test((await rowl('#l12Brief', 'Gross profit pool'))[0]), 'D13 a line with no pipeline share keeps the plain margin label');
  await setVal('#l12Layer', 'gp');
  t.ok(/plus the replacement pipeline credit where the line has one\.$/.test(await page.evaluate(() => document.querySelector('#l12Leg').textContent)), 'D13 the gross profit map layer note names the replacement pipeline credit');
  await setVal('#l12Layer', 'pri');
  const d14 = await page.evaluate(() => { const s = k => sum(SLM.BASE.map(l => sum(ZR.map(z => SLM.SLZ[z.zip][l.id][k])))); const k = document.querySelector('#l12Kpis .kpi'); return { direct: s('gpDirect'), pipe: s('gpPipe'), all: sum(SLM.BASE.map(l => SLM.AGG[l.id].gp)), D: MM(s('gpDirect')), Pi: MM(s('gpPipe')), All: MM(s('gp')), kl: k.querySelector('.kl span').textContent, kv: k.querySelector('.kv').textContent, kd: k.querySelector('.kd').textContent, mast: [...document.querySelectorAll('#mod-lines .mast .meta span')].map(x => x.textContent).find(x => /gross profit/.test(x)) || '' }; });
  t.ok(d14.kl === 'Direct gross profit pool' && d14.kv === d14.D && d14.kd.includes(`add ${d14.Pi} of replacement pipeline credit`), 'D14 the KPI headlines the direct gross profit pool and names the pipeline credit', d14);
  t.ok(d14.mast === `${d14.D} direct gross profit pool a year (modeled) · ${d14.Pi} replacement pipeline credit`, 'D14 the masthead does the same', d14.mast);
  t.ok(d14.pipe > 0 && Math.abs(d14.direct + d14.pipe - d14.all) < 1 && d14.D !== d14.All, 'D14 direct plus credit is still the pool the rankings use', d14);

  /* D15, D33, D27 and the click cost in the judgment call */
  const tx = await page.evaluate(() => ({ th: [...document.querySelectorAll('#l12Trig thead th')].map(x => x.textContent), rules: [...document.querySelectorAll('#l12Rules tbody tr')].map((tr, i) => { const m = SLM.LINES[i].months; return [tr.cells[1].textContent, tr.cells[2].textContent, m.some(v => v >= 110), m.some(v => v <= 75)]; }), port: document.querySelector('#l12PortN').textContent, dash: DASH_RE.test(document.querySelector('#l12PortN').textContent), cpc: document.querySelector('#l12Econ .callout').textContent, want: '$' + SLM.A.cpc.toFixed(2) }));
  t.ok(tx.th.includes('Avg warmest day') && tx.th.includes('Avg coldest night') && !tx.th.some(x => /^Avg (max|min)$/.test(x)), 'D15 the monthly extremes are not labeled as average highs and lows', tx.th);
  t.ok(tx.rules.length === 14 && tx.rules.every(([h, l, heavy, light]) => (heavy ? h !== 'flat' && h !== 'none' : h === (light ? 'none' : 'flat')) && (light ? l !== 'flat' && l !== 'none' : l === (heavy ? 'none' : 'flat'))) && tx.rules.some(([h, l]) => h !== 'none' && l === 'none'), 'D33 the flight rules say flat only for a line with neither heavy nor light months', tx.rules);
  t.ok(tx.port.includes('split again each month') && !tx.dash, 'D27 the portfolio note carries no hyphen and no dash', tx.port);
  t.ok(tx.cpc.includes(`account average (${tx.want},`), 'the judgment call prints the account click cost with its cents', tx.want);
  /* the same rule over everything the module shows, line by line, and over the notes it writes into files (business names keep their own spelling) */
  const hy = await page.evaluate(() => { const re = new RegExp('[A-Za-z]' + DASH_RE.source + '[A-Za-z]'), words = s => s.split(/\s+/).filter(w => re.test(w)), names = COMP.map(l => l.name), seen = new Set(); SLM.LINES.forEach(l => { MODI.lines.receive({ line: l.id, zip: '75150' }); let s = document.querySelector('#mod-lines').innerText; names.forEach(x => { s = s.split(x).join(' '); }); words(s).forEach(w => seen.add(w)); }); const notes = [SLM.matrixLong(ZR.slice(0, 1)), SLM.matrixWide(ZR.slice(0, 1)), SLM.metaZips('heat', null, 1), SLM.calendar(25000, null)].flatMap(c => c.split('\n').filter(x => x.startsWith('# '))); return { screen: [...seen], notes: notes.length, inNotes: notes.flatMap(words) }; });
  t.ok(!hy.screen.length && hy.notes === 5 && !hy.inNotes.length, 'D27 no prose is hyphenated in any of the fourteen line views or in a file note', hy);

  /* D9: the annual view buys one month of jobs, so its share is taken of one month of the scope's jobs */
  const d9 = await page.evaluate(() => { const rel = (rows, zs) => rows.map(r => r.share / (r.jobs / (sum(zs.map(z => SLM.SLZ[z.zip][r.line.id].jobs)) / 12))); const cty = ZR.filter(z => z.fips === CO[0].fips); const mon = SLM.MONTHS.map((_, m) => SLM.allocate(25000, m, null, null, 0.7).find(r => r.line.id === 'heat').share); const ann = SLM.allocate(25000, null, null, null, 0.7).find(r => r.line.id === 'heat'); const tr = [...document.querySelectorAll('#l12Port tbody tr')].find(x => x.cells[0].textContent === 'Heating Repair'); return { rel: rel(SLM.allocate(25000, null, null, null, 0.7), ZR).concat(rel(SLM.allocate(25000, null, cty, null, 0.7), cty)), ann: ann.share, lo: Math.min(...mon), hi: Math.max(...mon), view: document.querySelector('#l12Mo').value, cell: tr.cells[tr.cells.length - 1].textContent, want: P(ann.share * 100, 2) }; });
  t.ok(d9.rel.length === 22 && d9.rel.every(x => Math.abs(x - 1) < 1e-9), 'D9 annual view: the share is jobs bought over one month of the scope\'s jobs, every line, metro and county', d9.rel);
  t.ok(d9.ann > d9.lo && d9.ann < d9.hi, 'D9 the annual share of Heating Repair sits among its twelve monthly shares (it was a twelfth of them)', d9);
  t.ok(d9.view === '-1' && d9.cell === d9.want && d9.cell !== '0.01%', 'D9 the portfolio table prints that share', d9);
  const cal = await ctx.download(() => page.click('#l12Cal')), rows = cal.text.split('\n'), at = rows.findIndex(x => x.startsWith('line,Jan_usd')), months = rows.slice(at + 1, at + 12).map(x => x.split(',').slice(1).map(Number));
  t.ok(cal.name === 'dfw-service-line-flight-calendar.csv' && months.length === 11 && months[0].map((_, m) => months.reduce((s, r) => s + r[m], 0)).every(s => Math.abs(s - 25000) <= 6), 'D9 left the split alone: every month of the flight calendar file still adds up to the budget', months[0]);

  /* D25: the chips are buttons, work from the keyboard and keep the focus */
  const chips = await page.evaluate(() => ['#l12Lines', '#l12ChartChips'].map(h => { const c = [...document.querySelectorAll(h + ' .chip')]; return [c.length, c.every(x => x.tagName === 'BUTTON' && x.type === 'button' && x.tabIndex === 0)]; }));
  if (t.eq(chips, [[14, true], [14, true]], 'D25 the line chips and the chart chips are buttons in the tab order')) {
    await page.focus('#l12Lines .chip[data-l="furnace"]'); await page.keyboard.press('Enter');
    const kb = await page.evaluate(() => ({ brief: document.querySelector('#l12BName').textContent, on: [...document.querySelectorAll('#l12Lines .chip[aria-pressed="true"]')].map(c => c.dataset.l).join(), focus: document.activeElement.dataset.l + ' in ' + document.activeElement.parentElement.id }));
    t.ok(kb.brief === 'Gas furnace replacement' && kb.on === 'furnace' && kb.focus === 'furnace in l12Lines', 'D25 Enter on a line chip selects the line and the focus stays on it', kb);
    await page.keyboard.press('Tab');
    t.eq(await page.evaluate(() => document.activeElement.dataset.l), 'heatpump', 'D25 Tab then moves to the next chip');
    await page.focus('#l12ChartChips .chip[data-l="furnace"]'); await page.keyboard.press('Space');
    const kc = await page.evaluate(() => ({ on: document.querySelector('#l12ChartChips .chip[data-l="furnace"]').getAttribute('aria-pressed'), focus: document.activeElement.dataset.l + ' in ' + document.activeElement.parentElement.id, legend: document.querySelector('#l12SeasonN').textContent.includes('Furnace Replacement') }));
    t.ok(kc.on === 'true' && kc.legend && kc.focus === 'furnace in l12ChartChips', 'D25 Space on a chart chip draws the line and the focus stays on it', kc);
  }

  /* D11: indicative media adds up to the budget inside the buy */
  const small = await page.evaluate(() => CO.map(c => ({ fips: c.fips, zips: ZR.filter(z => z.fips === c.fips).map(z => z.zip) })).filter(c => c.zips.length > 1 && c.zips.length < 40).sort((a, b) => a.zips.length - b.zips.length)[0]);
  for (const id of ['heat', 'replace']) {
    await recv({ line: id, county: '' });
    const buy = await page.evaluate(l => ZR.map(z => SLM.SLZ[z.zip][l]).sort((a, b) => b.pri - a.pri).slice(0, 40).map(r => r.z.zip), id);
    const s = await media(buy);
    t.ok(Math.abs(s - 25000) <= 20, `D11 ${id}: indicative media over the 40 ZIPs in the buy adds up to the $25,000 budget`, s);
  }
  const out = await page.evaluate(() => { const gp = z => sum(SLM.BASE.map(l => SLM.SLZ[z.zip][l.id].gp)); const rows = ZR.map(z => SLM.SLZ[z.zip].replace).sort((a, b) => b.pri - a.pri); const z = rows[60].z; return { zip: z.zip, want: Math.round(25000 * gp(z) / (sum(rows.slice(0, 40).map(r => gp(r.z))) + gp(z))) }; });
  t.eq(await media([out.zip]), out.want, 'D11 a ZIP outside the buy shows what it would get if it joined it');
  await recv({ line: 'heat', county: small.fips });
  const sm = await media(small.zips), head = await page.evaluate(() => [...document.querySelectorAll('#l12Zip .dsec')].map(d => d.textContent).find(x => /^Suggested media/.test(x)));
  t.ok(Math.abs(sm - 25000) <= small.zips.length && head === `Suggested media at $25,000 a month across the top ${small.zips.length} ZIPs`, `D11 a county with ${small.zips.length} ZIPs: the budget is spread over the ZIPs that exist`, [sm, head]);
  await recv({ county: '' });

  /* D10: Reset brings the two portfolio inputs back with the assumptions */
  await setVal('#l12Bud', 60000); await setVal('#l12Alpha', 1.5);
  const before = await page.evaluate(() => [SLM.A.budget, SLM.A.alpha, document.querySelector('#l12Port tbody tr:last-child').cells[3].textContent]);
  await page.click('#l12Reset');
  const after = await page.evaluate(() => ({ A: [SLM.A.budget, SLM.A.alpha], bud: document.querySelector('#l12Bud').value, alpha: document.querySelector('#l12Alpha').value, label: document.querySelector('#l12AlphaV').textContent, total: document.querySelector('#l12Port tbody tr:last-child').cells[3].textContent, zip: document.querySelector('#l12Zip').textContent.includes('Suggested media at $25,000 a month') }));
  t.eq(before, [60000, 1.5, '$60,000'], 'D10 setup: a $60,000 budget at concentration 1.5 is in force');
  t.eq(after, { A: [25000, 0.7], bud: '25000', alpha: '0.7', label: '0.7', total: '$25,000', zip: true }, 'D10 after Reset the inputs, the label, the portfolio total and the ZIP card read the defaults');

  /* D12: a stated ticket cannot be cleared; a permit ticket (blank by default) still can */
  await recv({ line: 'heat' }); await setVal('#l12E_ticket', '');
  const d12 = await page.evaluate(() => ({ saved: SLM.A.lines.heat.ticket, field: document.querySelector('#l12E_ticket').value }));
  d12.rev = (await rowl('#l12Brief', 'Revenue pool'))[1]; d12.avg = (await rowl('#l12Brief', 'Average ticket'))[1];
  t.ok(d12.saved === 420 && d12.field === '420' && d12.rev !== '$0' && d12.avg !== '$0', 'D12 clearing the ticket of Heating Repair puts the stated ticket back and the line keeps its revenue', d12);
  await setVal('#l12E_ticket', 500); await setVal('#l12E_ticket', '');
  t.eq(await page.evaluate(() => [SLM.A.lines.heat.ticket, document.querySelector('#l12E_ticket').value]), [500, '500'], 'D12 a typed ticket is kept, and clearing it restores the typed value');
  await setVal('#l12E_lsaCpl', '');
  t.eq(await page.evaluate(() => SLM.A.lines.heat.lsaCpl), null, 'D12 a blank LSA cost per lead still means the line is not bought on LSA');
  await recv({ line: 'replace' }); await setVal('#l12E_ticket', '');
  t.eq(await page.evaluate(() => [SLM.A.lines.replace.ticket, document.querySelector('#l12E_ticket').value, document.querySelector('#l12E_ticket').placeholder]), [null, '', 'from permits by ZIP'], 'D12 the replacement ticket stays blank: it comes from permits');
  await page.click('#l12Reset');
  await guard('after the edits and Reset');
  /* a plan saved by Build 4 after the ticket was cleared there */
  await ctx.fresh({ 'tda.sl.v1': { cpc: 9.68, budget: 25000, alpha: 0.7, lines: { heat: { ticket: null }, replace: { ticket: null } } } }); await ctx.show('lines');
  t.eq(await page.evaluate(() => [SLM.A.lines.heat.ticket, SLM.A.lines.replace.ticket]), [420, null], 'D12 a cleared stated ticket found in saved assumptions is read as the stated ticket');
  await guard('with that saved state');
  t.ok(!ctx.errors.length, 'no page error or console error', ctx.errors.slice(0, 5));
}
