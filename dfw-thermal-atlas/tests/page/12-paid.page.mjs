/* Module 05 Paid Acquisition: the cost card counts leads, zero is a value, the Campaign Desk gets the buy that was entered,
   the replacement ticket label reaches its input, counts come from the data, and no prose is hyphenated on screen or in a file note. */
const DASH = /[A-Za-z\u00C0-\u024F][-\u2010-\u2015\u2212][A-Za-z\u00C0-\u024F]/;   // a letter, a hyphen or dash of any kind, a letter
const IDENT = /^[("']*(?:https?:\/\/\S+|[\w.-]+\.(?:csv|json|html|js|mjs|zip|txt))[)"'.,;:]*$/i;   // file names and links are identifiers, not prose
const hyphenated = text => [...new Set(text.split(/\s+/).filter(w => DASH.test(w) && !IDENT.test(w)))];
const marks = text => text.match(/.{0,24}[\u2010-\u2015\u2212].{0,16}/g) || [];   // a typographic dash or minus sign, with what stands around it
export default async function (page, t, ctx) {
  await ctx.show('paid');
  const type = async (sel, v) => { await page.fill(sel, v); await page.waitForTimeout(350); };   // the cost card waits 200 ms after the last key
  const press = async sel => { const e = page.locator(sel).first(); await e.evaluate(x => x.scrollIntoView({ block: 'center' })); await e.click(); await page.waitForTimeout(250); };
  const names = await page.evaluate(() => COMP.map(l => l.name));   // business names keep their own spelling
  const visible = async sel => { let s = await page.evaluate(q => document.querySelector(q).innerText, sel || '#mod-paid'); for (const n of names) s = s.split(n).join(' '); return s; };
  const cards = () => page.evaluate(() => [...document.querySelectorAll('#a5Bud .qb')].map(b => ({ t: b.querySelector('.qt').textContent, v: b.querySelector('.qv').textContent, d: b.querySelector('.qd').textContent })));
  const top = n => page.evaluate(k => ZR.slice().sort((a, b) => b.effb - a.effb).slice(0, k).map(z => z.zip), n);
  const found = hyphenated(await visible());

  /* D28: the benchmark is a click to lead rate; same arithmetic, honest names */
  const want = await page.evaluate(() => { const M = sum(ZR.map(z => z.mass)); const e = ZR.slice().sort((a, b) => b.effb - a.effb).slice(0, 40).map(z => { const clicks = 200000 * z.mass / M * 0.15, leads = clicks * 0.066; return { cost: clicks * 9.68 * z.cpc_rel, leads, val: leads * (0.22 * 13800 * z.value_idx / 100 + 0.78 * 450), fix: leads * 450 }; }); const T = k => sum(e.map(x => x[k])); return { media: M$(T('cost')), leads: D(T('leads'), 0), cpl: M$(T('cost') / T('leads')), val: MM(T('val')), val0: MM(T('fix')) }; });
  let c = await cards();
  t.eq(c.map(x => x.t), ['Monthly media', 'Leads a month', 'Cost per lead', 'Lead value'], 'the cost card reports leads and cost per lead');
  t.eq(c.map(x => x.v), [want.media, want.leads, want.cpl, want.val], 'the arithmetic is unchanged: media, leads, cost per lead and value at the defaults');
  t.ok(/before call handling and close rate/.test(c[3].d), 'the value card says it is lead value before call handling and close rate', c[3].d);
  const words = await page.evaluate(() => ({ cvr: document.querySelector('#mod-paid label[for="a5Cvr"]').textContent, prep: document.querySelector('#mod-paid label[for="a5Prep"]').textContent, heads: [...document.querySelectorAll('#a5Bud thead th')].map(h => h.textContent), card: document.querySelector('#a5Bud').closest('.card').innerText }));
  t.eq([words.cvr, words.prep], ['Click to lead (%)', 'Leads that become replacements (%)'], 'the two rate controls are named for leads');
  t.eq(words.heads, ['ZIP', 'City', 'Searches/mo', 'Clicks', 'Media/mo', 'Leads', 'Cost/lead'], 'the ZIP table heads its columns Leads and Cost/lead');
  t.ok(!/booked/i.test(words.card), 'nothing in the cost card is called a booked job', (words.card.match(/.{0,30}booked.{0,30}/i) || [''])[0]);

  /* D17: the Whitespace KPI states the threshold the quadrants use */
  const ws = await page.evaluate(() => ({ kd: [...document.querySelectorAll('#a5Kpis .kpi')].filter(k => k.querySelector('.kl span').textContent === 'Whitespace ZIPs').map(k => k.querySelector('.kd').textContent), below60: ZR.filter(z => z.quad === 1).every(z => z.comp_pct < 60), box: document.querySelectorAll('#a5Quads .qd')[1].textContent }));
  t.eq(ws.kd, ['high opportunity, competition below the 60th percentile'], 'the Whitespace KPI names the 60th percentile');
  t.ok(ws.below60 && /below the 60th percentile/.test(ws.box), 'which is what the data and the quadrant card say', ws);

  /* D16: the criterion id count is the one the data holds */
  const ids = await page.evaluate(() => ({ src: document.querySelector('#a5Src').innerText, have: Z.filter(z => z.gid).length, all: Z.length }));
  t.ok(ids.src.includes(`(${ids.have} of ${ids.all} ZIPs)`), 'the source register counts the Google criterion ids in the data', (ids.src.match(/\(\d+ of \d+ ZIPs\)/) || [''])[0] + ` against ${ids.have} of ${ids.all}`);

  /* D8: zero is a value; a blank or a figure under the control's minimum keeps the last one */
  await type('#a5Prep', '0'); c = await cards();
  t.ok(c[3].v === want.val0 && /\b0% replacements/.test(c[3].d) && want.val0 !== want.val, 'typing 0 into the replacement share recalculates the value', { got: c[3], want: want.val0, before: want.val });
  await type('#a5Prep', ''); c = await cards();
  t.ok(c[3].v === want.val0 && /\b0% replacements/.test(c[3].d), 'an emptied field keeps the last value', c[3]);
  await type('#a5Cvr', '0'); c = await cards();
  t.ok(/ clicks at 6\.6%$/.test(c[1].d) && c[2].v === want.cpl, 'zero is refused where the control starts above zero (click to lead)', [c[1], c[2]]);
  await type('#a5Cvr', '6.6'); await type('#a5Prep', '22'); c = await cards();
  t.eq(c.map(x => x.v), [want.media, want.leads, want.cpl, want.val], 'and the defaults typed back give the first figures again');

  /* D29: the desk receives the ZIPs in the buy, as many as were entered */
  await page.evaluate(() => { const go = window.goModule; window.__sent = []; window.goModule = (k, p) => { window.__sent.push([k, JSON.parse(JSON.stringify(p || null))]); return go(k, p); }; });
  const handOff = async () => { await press('#a5Desk'); const r = await page.evaluate(() => ({ sent: window.__sent[window.__sent.length - 1], hash: location.hash, picks: MODI.desk.plan().picks })); await ctx.show('paid'); return r; };
  await type('#a5N', '10'); c = await cards();
  let h = await handOff();
  t.ok(/top 10 ZIPs/.test(c[0].d), 'the card prices the top 10 ZIPs when 10 is entered', c[0].d);
  t.eq(h.sent, ['desk', { zips: await top(10) }], 'Campaign Desk is sent exactly those 10 ZIPs, best first');
  t.ok(h.hash === '#desk' && h.picks.length === 10 && h.picks.slice().sort().join() === (await top(10)).sort().join(), 'and the desk plan holds them', { hash: h.hash, picks: h.picks.length });
  const cty = await page.evaluate(() => { const by = CO.map(c => ({ fips: c.fips, name: c.name, n: ZR.filter(z => z.fips === c.fips).length })).filter(c => c.n).sort((a, b) => a.n - b.n); return { small: by[0], big: by[by.length - 1] }; });
  await page.selectOption('#a5Cty', cty.big.fips); await type('#a5N', '7'); h = await handOff();
  t.ok(h.sent[1].zips.length === 7 && await page.evaluate(([zs, f]) => zs.every(z => ZI[z].fips === f), [h.sent[1].zips, cty.big.fips]), `with ${cty.big.name} County in scope and 7 entered, 7 ZIPs of that county are sent`, h.sent[1]);
  await page.selectOption('#a5Cty', cty.small.fips); await type('#a5N', String(cty.small.n + 5)); h = await handOff();
  t.eq(h.sent[1].zips.length, cty.small.n, `a scope smaller than the buy sends every ZIP in it (${cty.small.name} County, ${cty.small.n})`);
  await page.selectOption('#a5Cty', ''); await type('#a5N', '40');

  /* D7: one element per id; the replacement ticket label belongs to its input */
  await press('#a5Tbl tbody tr');
  const sel = await page.evaluate(() => { const root = document.getElementById('mod-paid'), lab = root.querySelector('label[for="a5Rep"]'); return { name: root.querySelector('#a5Name').textContent, dup: [...new Set([...root.querySelectorAll('[id]')].map(e => e.id).filter(id => document.querySelectorAll('#' + CSS.escape(id)).length > 1))], control: lab.control ? lab.control.tagName + '#' + lab.control.id : null, unnamed: [...root.querySelectorAll('.plan input')].filter(e => !e.labels || e.labels.length !== 1).map(e => e.id) }; });
  t.ok(/^\d{5} · /.test(sel.name), 'a ZIP is open in the detail card', sel.name);
  t.eq(sel.dup, [], 'no id is used twice in module 05 once a ZIP is open');
  t.eq([sel.control, sel.unnamed], ['INPUT#a5Rep', []], 'the "Replacement ticket ($)" label names the number input and every cost input has one label');
  await press('#mod-paid label[for="a5Rep"]');
  t.eq(await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement.tagName + '#' + document.activeElement.id, shown: !document.getElementById('mod-paid').hidden })), { hash: '#paid', focus: 'INPUT#a5Rep', shown: true }, 'clicking that label focuses the input and does not press a button');
  await ctx.show('paid');
  if (t.ok(await page.evaluate(() => { const b = document.querySelector('#mod-paid #a5Led'); return !!b && b.tagName === 'BUTTON' && b.textContent === 'Replacement ledger'; }), 'the "Replacement ledger" button has an id of its own')) {
    await press('#a5Led');
    t.eq(await page.evaluate(() => window.__sent[window.__sent.length - 1]), ['replace', { zip: sel.name.slice(0, 5) }], 'and still opens the replacement ledger on that ZIP');
    await ctx.show('paid');
  }
  h = await handOff();
  t.eq(h.sent, ['desk', { zips: [sel.name.slice(0, 5)] }], 'with a ZIP open, Campaign Desk is sent that ZIP alone');

  /* D27: no hyphenated prose on screen, whatever the layer or the ZIP, nor in the notes of the files */
  for (const v of await page.evaluate(() => [...document.querySelectorAll('#a5Layer option')].map(o => o.value))) { await page.selectOption('#a5Layer', v); await page.waitForTimeout(120); found.push(...hyphenated(await visible())); }
  const dets = [];
  for (const zip of await page.evaluate(() => [ZR.find(z => z.span_sh >= 20), ZR.find(z => !z.gid), ...ZR.slice(0, 12)].filter(Boolean).map(z => z.zip))) { await page.evaluate(z => MODI.paid.receive({ zip: z }), zip); await page.waitForTimeout(60); dets.push(await visible('#a5Det')); found.push(...hyphenated(dets[dets.length - 1])); }
  t.eq([...new Set(found)], [], 'no hyphenated prose in the visible text of module 05 (every layer, several ZIP cards)');
  const stray = dets.concat(await visible('#a5Meth')).flatMap(marks);
  t.ok(!stray.length && /\+45% to minus 40%/.test(await visible('#a5Meth')), 'no dash stands in for a word in a ZIP card or in the method, which writes "minus 40%"', stray.slice(0, 3));
  const meta = await ctx.download(() => page.click('#a5M')), full = await ctx.download(() => page.click('#a5All'));
  const notes = [meta, full].map(f => f.text.replace(/^\uFEFF/, '').split('\n').filter(l => l.startsWith('# ')).join(' '));   /* a saved CSV begins with a byte order mark */
  t.ok(meta.name === 'meta-zip-targets-dfw-hvac.csv' && /ZIP targeted ad sets\.$/.test(notes[0]) && notes[1].length > 20 && !hyphenated(notes.join(' ')).length, 'the notes written into the Meta ZIP file and the full data file carry no hyphenated prose', { notes, bad: hyphenated(notes.join(' ')) });

  /* The copy follows the data: drop a ZIP, a competitor, a criterion id and every review count before the module mounts */
  await ctx.fresh();
  const n = await page.evaluate(() => { const early = !!MODI.paid.mounted; ZR.pop(); COMP.splice(COMP.findIndex(l => l.tier !== 'integrity'), 1); COMP.forEach(l => { l.reviews = null; }); Z.find(z => z.gid).gid = null; return { early, zr: ZR.length, zrN: N(ZR.length), comp: COMP.filter(l => l.tier !== 'integrity').length, gid: Z.filter(z => z.gid).length, z: Z.length }; });
  await ctx.show('paid');
  const seen = await page.evaluate(() => ({ max: document.querySelector('#a5N').max, coh: document.querySelector('#a5Coh').innerText, intro: document.querySelector('#mod-paid .callout').innerText, meth: document.querySelector('#a5Meth').innerText, src: document.querySelector('#a5Src').innerText }));
  t.ok(!n.early && seen.max === String(n.zr), '"ZIPs in the buy" stops at the number of scored ZIPs', { max: seen.max, want: n.zr });
  t.ok(seen.coh.includes(`across ${n.zrN} ZIPs`), 'the coherence check counts the scored ZIPs', (seen.coh.match(/across [\d,]+ ZIPs/) || [''])[0] + ` against ${n.zrN}`);
  t.ok(seen.intro.includes(`the ${n.comp} mapped competitor locations`) && seen.meth.includes(`the ${n.comp} mapped competitor locations`), 'the introduction and the method count the mapped competitors', [...(seen.intro + ' ' + seen.meth).matchAll(/the (\d+) mapped competitor locations/g)].map(m => m[1]).join(' and ') + ` against ${n.comp}`);
  t.ok(seen.src.includes(`(${n.gid} of ${n.z} ZIPs)`), 'the source register counts the criterion ids', (seen.src.match(/\(\d+ of \d+ ZIPs\)/) || [''])[0] + ` against ${n.gid} of ${n.z}`);
  await page.evaluate(() => MODI.paid.receive({ zip: ZR[0].zip })); await page.waitForTimeout(100);
  const near = ((await visible('#a5Det')).match(/Nearest:.*/) || [''])[0];
  t.ok((near.match(/ km, no review count\)/g) || []).length === 4 && !marks(near).length, 'a competitor with no review count says so in words', near);
  t.ok(!ctx.errors.length, 'no page error or console error', ctx.errors.slice(0, 5));
}
