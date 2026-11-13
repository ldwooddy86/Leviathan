/* Module 08 Campaign Desk: a heating plan is built from heating copy and exports whole campaigns, the money adds up to the budget,
   hand picked markets keep the sender's order, a stored or loaded plan cannot plant markup, the controls work from the keyboard,
   and receive() takes a complete plan from another module. Each block names the touch up item it proves. */
const DASH = /[A-Za-zÀ-ɏ][-‐-―−][A-Za-zÀ-ɏ]/;   // a letter, a hyphen or dash of any kind, a letter
const IDENT = /^[("']*(?:https?:\/\/\S+|[\w.-]+\.(?:csv|json|html|js|mjs|zip|txt))[)"'.,;:]*$/i;   // file names and links are identifiers, not prose
const hyphenated = text => [...new Set(text.split(/\s+/).filter(w => DASH.test(w) && !IDENT.test(w)))];
/* a CSV the desk wrote: note lines (# ...) apart, then one object per row keyed by the header */
const csv = text => { const note = [], body = []; text.split('\n').forEach(l => (l.startsWith('# ') && !body.length ? note : body).push(l)); const s = body.join('\n'), rows = []; let cur = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ',') { cur.push(f); f = ''; } else if (c === '\n') { cur.push(f); rows.push(cur); cur = []; f = ''; } else f += c; }
  if (f || cur.length) { cur.push(f); rows.push(cur); } const head = rows.shift() || []; return { note: note.join(' '), head, rows: rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? '' : r[i]]))) }; };
const heads = r => Object.keys(r).filter(k => /^Headline \d+$/.test(k) && r[k]).map(k => r[k]), descs = r => Object.keys(r).filter(k => /^Description \d$/.test(k) && r[k]).map(k => r[k]);
const town = (city, home) => String(city || '').replace(/\s*\((?:CDP|unincorporated)\)\s*/gi, '').trim() || home;   // a market's city as ad copy names it
/* what is wrong with the responsive search ads of a search file: Google wants 3 headlines of 30 and 2 descriptions of 90 at least, TDLR wants the licence, the house wants clean copy */
const adFaults = (rows, lic) => rows.filter(r => r['Ad type']).flatMap(r => { const h = heads(r), d = descs(r), why = [];
  if (h.length < 3) why.push(`${h.length} headlines`); if (d.length < 2) why.push(`${d.length} description`); if (h.some(x => x.length > 30) || d.some(x => x.length > 90)) why.push('over the limit'); if (!d.some(x => x.includes(lic))) why.push('no licence');
  const dirty = h.concat(d).filter(x => /^(Serving\s*County|Servicio en|Local\s+Techs)$|\(CDP\)|unincorporated|[{}]|\s{2}|[-‐-―−]/.test(x)); if (dirty.length) why.push('copy: ' + dirty.join(' / '));
  if (!/^[a-z0-9-]{1,15}$/.test(r['Path 1']) || !/^[a-z]{0,15}$/.test(r['Path 2'])) why.push(`path ${r['Path 1']}/${r['Path 2']}`);
  return why.length ? [`${r.Campaign} · ${r['Ad Group']}: ${why.join(', ')}`] : []; });
export default async function (page, t, ctx) {
  const sleep = ms => page.waitForTimeout(ms);
  const send = async p => { await page.evaluate(() => { document.querySelector('.toast').textContent = ''; }); await ctx.show('desk', p); return page.evaluate(() => document.querySelector('.toast').textContent); };
  const plan = () => page.evaluate(() => MODI.desk.plan());
  const press = id => page.click('#' + id);
  const file = async id => { const f = await ctx.download(() => press(id)); return Object.assign({ name: f.name }, csv(f.text)); };
  const set = async (sel, v, ev) => { await page.evaluate(([s, x, e]) => { const c = document.querySelector(s); c.value = x; c.dispatchEvent(new Event(e, { bubbles: true })); }, [sel, String(v), ev || 'change']); await sleep(120); };
  const tab = async (host, v) => { await page.evaluate(([h, x]) => document.querySelector(`${h} button[data-v="${x}"]`).click(), [host, v]); await sleep(60); };
  const kpi = name => page.evaluate(n => { const k = [...document.querySelectorAll('#dkKpis .kpi')].find(x => x.querySelector('.kl span').textContent === n); return k ? [k.querySelector('.kv').textContent, k.querySelector('.kd').textContent] : null; }, name);
  const assets = () => page.evaluate(() => [...document.querySelectorAll('#dkBuild .asset:not(.bad):not(.warn)')].map(a => a.textContent.slice(a.querySelector('.cnt') ? a.querySelector('.cnt').textContent.length : 0)));
  const negsOf = f => [...new Set(f.rows.map(r => r.Campaign))].map(c => f.rows.filter(r => r.Campaign === c && r['Criterion Type'] === 'Negative Phrase').map(r => r.Keyword));
  /* the desk's own prose on screen: the Satchel rule pack (the compliance table and the lint findings) is another file's text */
  const prose = () => page.evaluate(() => { const root = document.getElementById('mod-desk'), off = [...root.querySelectorAll('#dkComp, #dkBuild .asset.bad, #dkBuild .asset.warn')]; off.forEach(e => { e.hidden = true; }); const s = root.innerText; off.forEach(e => { e.hidden = false; }); return s; });

  /* D20, D27: a new plan starts on the coming Monday, and the KPI writes that date in words */
  await ctx.show('desk');
  const first = await page.evaluate(() => { const p = MODI.desk.plan(), d = new Date(p.start + 'T12:00:00'), n = new Date(); return { start: p.start, dow: d.getDay(), ahead: Math.round((d - new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12)) / 864e5), input: document.querySelector('#dkStart').value, words: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), weeks: p.weeks, budget: p.budget }; });
  t.ok(/^\d{4}-\d{2}-\d{2}$/.test(first.start) && first.dow === 1 && first.ahead >= 1 && first.ahead <= 7 && first.input === first.start, 'D20 a new plan starts on the coming Monday', first);
  const k0 = await kpi('Monthly media');
  t.ok(k0[1].endsWith(`${first.weeks} weeks from ${first.words}`) && !/\d{4}-\d{2}-\d{2}/.test(k0[1]), 'D27 the KPI writes the flight start in words, not as an ISO date', k0[1]);

  /* what the copy library holds today; the heating negatives are stood in for when the library does not carry them yet */
  const lib = await page.evaluate(() => { const stood = typeof NEG_HEAT === 'undefined'; if (stood) window.NEG_HEAT = ['space heater', 'water heater', 'pool heater']; const cool = ANGLES.filter(a => a.line === 'repair').map(a => a.id);
    return { stood, heat: LINES.heat.angles, lead: LINES.heat.angles[0], short: Object.fromEntries(ANGLES.map(a => [a.id, a.short])), esH: Object.fromEntries(ANGLES.map(a => [a.short, a.es && a.es.h[0] ? a.es.h[0] : null])), metaH: Object.fromEntries(ANGLES.map(a => [a.short, a.meta.h])), paths: Object.fromEntries(ANGLES.map(a => [a.id, a.path])), cool, neg: NEG_CUSTOMER, negHeat: NEG_HEAT, negRecruit: NEG_RECRUIT, mixHeat: MIX0.heat, lic: BRAND.lic, home: BRAND.city, fired52: anglesFor(ZI['75052']).map(a => a.id), es52: ZI['75052'].span_sh >= 20, city52: ZI['75052'].city, ids: [Z.filter(z => z.gid).length, Z.length], lines: Object.fromEntries(Object.entries(LINES).map(([k, v]) => [k, v.l])), plab: PLAB }; });
  if (lib.stood) t.note('NEG_HEAT is not in the copy library yet: the test stands a short list in for it');
  const wantNeg = [...new Set(lib.neg.concat(lib.negHeat))];

  /* D2, D5, D19: one heating ZIP that fires neither the furnace nor the heat pump trigger is still a heating plan */
  const toast52 = await send({ zips: ['75052'], line: 'heat', bids: { '75052': 45 } });
  const want52 = lib.heat.filter(id => lib.fired52.includes(id)).length ? lib.heat.filter(id => lib.fired52.includes(id)) : [lib.lead];
  const ui52 = await page.evaluate(() => ({ ang: [...document.querySelectorAll('#dkAng option')].map(o => o.value), kwa: [...document.querySelectorAll('#dkKwA option')].map(o => o.value), prev: [...document.querySelectorAll('#dkPrev option')].map(o => o.value), sel: document.querySelector('#dkPrev').value, kws: [...document.querySelectorAll('#dkKwOut .kwcol div')].map(a => a.textContent), negs: [...document.querySelectorAll('#dkKwOut .neg code')].map(c => c.textContent), hint: document.querySelector('#dkAngles').parentElement.querySelector('.hint').textContent }));
  const as52 = await assets();
  t.ok(!lib.fired52.includes('furnace') && !lib.fired52.includes('heatpump') && lib.es52, 'the test market 75052 fires neither the furnace nor the heat pump trigger and gets a Spanish build', lib.fired52);
  t.eq(toast52, '1 ZIP received', 'D19 one ZIP sent is announced as one ZIP');
  t.eq([ui52.ang.slice().sort(), ui52.kwa.slice().sort()], [want52.slice().sort(), want52.slice().sort()], 'D2 the creative and keyword angle lists hold the heating angles of the market, the lead angle when no trigger fires');
  t.ok(ui52.ang.every(id => lib.heat.includes(id)) && !ui52.ang.some(id => lib.cool.includes(id)) && as52.length >= 5 && ui52.kws.length >= 5 && !as52.concat(ui52.kws).some(x => /ac repair/i.test(x)), 'D2 no cooling repair copy stands in for heating on screen', as52.concat(ui52.kws).filter(x => /ac repair/i.test(x)).slice(0, 3));
  t.ok(/or the line's lead angle when none does\.$/.test(ui52.hint), 'D2 the hint under the angles says what a market with no trigger runs', ui52.hint);
  t.ok(ui52.sel === '75052' && ui52.prev.join() === '75052' && as52.length >= 5 && !as52.some(x => /Frisco/.test(x)), 'D5 the preview shows the market that is in the plan, not the one it held before', { sel: ui52.sel, first: as52[0] });
  t.eq(ui52.negs, wantNeg, 'heating negatives follow the customer negatives in the keyword desk of a heat plan');

  /* D2, D1, D3, D34 and the heating negatives in the files of that plan */
  const g52 = await file('dkG'), groups52 = g52.rows.filter(r => r['Ad Group Type']), ads52 = g52.rows.filter(r => r['Ad type']);
  t.ok(g52.name === `google-ads-editor_heat_${first.start}.csv` && g52.head.length === 52 && [...new Set(g52.rows.map(r => r.Campaign))].length === 2, 'the Google file of the heat plan holds an English and a Spanish campaign in the 52 column layout', [g52.name, g52.head.length]);
  t.ok(groups52.length >= 2 * 2 * want52.length && ads52.length === groups52.length && ads52.every(r => r.Status === 'Paused'), 'D2 the Google file carries ad groups, each with one paused responsive search ad', { groups: groups52.length, ads: ads52.length, angles: want52 });
  t.eq(adFaults(g52.rows, lib.lic), [], 'D1 D3 every responsive search ad of that file has two descriptions or more, the licence, and no orphan headline such as "Serving County"');
  t.eq(negsOf(g52), [wantNeg, wantNeg], 'both campaigns of the heat plan carry the customer negatives and the heating negatives, once each');
  const sn52 = g52.rows.filter(r => r.Header).map(r => r['Snippet values'].split('; '));
  t.ok(sn52.length === 2 && sn52.every(v => v.length >= 3 && v.every(x => x.length <= 25)) && sn52[0].every(x => /Furnace|Heat/.test(x)) && sn52[1].every(x => /Calefacción|Calor/.test(x)), 'D34 the heat plan writes a structured snippet of heating services in each language, three values or more', sn52);
  const m52 = await file('dkM'), l52 = await file('dkL'), k52 = await file('dkKw'), ms52 = await file('dkMs');
  t.ok(m52.rows.length === 2 * want52.length && m52.rows.every(r => r['Campaign Name'] && r.Body && r.Title), 'D2 the Meta file is no longer empty: one row per angle and language', m52.rows.length);
  t.ok((l52.rows.find(r => r.Field === 'Job types') || {}).Value, 'D2 the LSA build sheet lists job types', l52.rows.find(r => r.Field === 'Job types'));
  t.ok(k52.rows.some(r => r.ad_group === lib.short[want52[0]] && r.match_type === 'Exact') && !k52.rows.some(r => lib.cool.map(id => lib.short[id]).includes(r.ad_group)), 'D2 the keyword file lists the heating ad groups', [...new Set(k52.rows.map(r => r.ad_group))]);
  t.eq(k52.rows.filter(r => r.ad_group === 'Negatives').map(r => r.keyword), wantNeg, 'the keyword file of a heat plan ends with the customer and the heating negatives');
  t.ok(ms52.rows.every(r => /_MS$/.test(r.Campaign) && !r.ID) && !adFaults(ms52.rows, lib.lic).length && JSON.stringify(negsOf(ms52)) === JSON.stringify([wantNeg, wantNeg]), 'the Microsoft file of the heat plan carries the same ads and negatives under _MS names', adFaults(ms52.rows, lib.lic).slice(0, 2));

  /* D4: Spanish social rows carry the licence once and a Spanish title */
  const count = (s, x) => String(s || '').split(x).length - 1;
  const es52 = m52.rows.filter(r => /_ES_/.test(r['Campaign Name'])), en52 = m52.rows.filter(r => /_EN_/.test(r['Campaign Name']));
  t.ok(es52.length === want52.length && m52.rows.every(r => count(r.Body, lib.lic) === 1 && count(r.Body, 'Lic ') === 1), 'D4 every Meta body carries the licence exactly once, Spanish rows included', m52.rows.filter(r => count(r.Body, 'Lic ') !== 1).map(r => r.Body));
  t.ok(es52.every(r => { const a = r['Ad Set Name'].replace(/ ES$/, ''), en = en52.find(x => x['Ad Set Name'] === a + ' EN'); return lib.esH[a] && r.Title !== lib.metaH[a] && (!en || r.Title !== en.Title) && (/\{/.test(lib.esH[a]) || r.Title === lib.esH[a]) && r.Title.length <= 40; }), 'D4 a Spanish Meta row is titled with the Spanish headline of its angle', es52.map(r => r.Title));
  await tab('#dkPTabs', 'meta'); await tab('#dkLang', 'es');
  const pv = await assets(), shown = lib.short[await page.evaluate(() => document.querySelector('#dkAng').value)], row = es52.find(r => r['Ad Set Name'] === shown + ' ES') || {};
  t.ok(count(pv[0], 'Lic ') === 1 && pv[0] === row.Body && pv[1] === row.Title, 'D4 the Spanish Meta preview shows the same body and title as the file', pv.slice(0, 2));
  const feed = await page.evaluate(() => MODI.desk.feed().filter(x => x.plat === 'meta').map(x => x.text));
  t.ok(feed.length === 2 * want52.length && feed.every(x => count(x, 'Lic ') === 1), 'D4 the creative handed to the Satchel lint carries the licence once', feed.filter(x => count(x, 'Lic ') !== 1));

  /* D31: the video script of a heating plan opens on a heating scene */
  await tab('#dkLang', 'en'); await tab('#dkPTabs', 'dg');
  const script = (await assets()).find(x => /^Script/.test(x)) || '';
  t.ok(/open on the thermostat of a cold home in Grand Prairie before sunrise/.test(script) && !/condenser|backyard|at noon/.test(script), 'D31 the video script of a heating plan opens on a cold home, not on a condenser at noon', script);
  await send({ zips: [await page.evaluate(() => ZR.find(z => z.city === 'Allen').zip)], line: 'repair' }); await tab('#dkPTabs', 'dg');
  const script2 = (await assets()).find(x => /^Script/.test(x)) || '';
  t.ok(/open on the condenser in a backyard in Allen at noon/.test(script2) && !/\ba [AEIOU]/.test(script2), 'D31 the cooling script names the city without "a Allen"', script2);
  await tab('#dkPTabs', 'google');

  /* D24, D30 groundwork: forty heating ZIPs in the service line model's order, with its bid modifiers */
  const H = await page.evaluate(() => { const top = ZR.map(z => SLM.SLZ[z.zip].heat).sort((a, b) => b.pri - a.pri).slice(0, 40); return { zips: top.map(r => r.z.zip), bids: Object.fromEntries(top.map(r => [r.z.zip, r.bid])), cities: top.map(r => r.z.city) }; });
  const toast40 = await send({ zips: H.zips, line: 'heat', bids: H.bids });
  const p40 = await plan();
  t.ok(H.zips.join() !== H.zips.slice().sort().join() && toast40 === '40 ZIPs received', 'forty heating ZIPs are sent in priority order, which is not ZIP code order', toast40);
  t.eq(p40.zips, H.zips, 'D24 hand picked markets keep the sender\'s order');
  const g40 = await file('dkG'), en40 = g40.rows.filter(r => /_EN_/.test(r.Campaign)), city1 = town(H.cities[0], lib.home);
  const cpc = await page.evaluate(zs => { const p = MODI.desk.plan(), ms = zs.map(z => ZI[z]), w = ms.map(z => Math.pow(Math.max(1, z.opp_usd), p.alpha)), of = ix => ix.length ? p.asm.google.cost * sum(ix.map(i => w[i] * (ms[i].cpc_rel || 1))) / sum(ix.map(i => w[i])) : null, all = ms.map((_, i) => i); return { en: of(all), es: of(all.filter(i => ms[i].span_sh >= p.spanTh)), lowest: p.asm.google.cost * (ZI[zs.slice().sort()[0]].cpc_rel || 1) }; }, H.zips);
  t.eq(en40.filter(r => r.Location).map(r => r.Location.slice(0, 5)), H.zips, 'D24 the location rows of the Google file follow that order');
  const slugOf = c => town(c, lib.home).toLowerCase().replace(/[^a-z]/g, '').slice(0, 15), esCity = await page.evaluate(zs => (zs.map(z => ZI[z]).find(z => z.span_sh >= MODI.desk.plan().spanTh) || {}).city, H.zips);
  t.eq([[...new Set(en40.filter(r => r['Ad type']).map(r => r['Path 2']))], [...new Set(g40.rows.filter(r => r['Ad type'] && /_ES_/.test(r.Campaign)).map(r => r['Path 2']))]], [[slugOf(city1)], [slugOf(esCity)]], `D24 the display path names the first market sent (${city1}), and the first Spanish market in the Spanish campaign (${esCity})`);
  const local = en40.filter(r => r.Keyword && r['Ad Group'] === lib.short[lib.lead] + ' Local').map(r => r.Keyword), ten = [...new Set(H.cities.map(c => town(c, lib.home)))].slice(0, 10);
  t.ok(local.length && ten.every(c => local.some(k => k.endsWith(' ' + c.toLowerCase()))), 'D24 the local keywords are written for the first ten cities sent, the best market among them', { ten, local: local.slice(0, 4) });
  const maxEn = [...new Set(en40.filter(r => r['Ad Group Type']).map(r => r['Max CPC']))], maxEs = [...new Set(g40.rows.filter(r => /_ES_/.test(r.Campaign) && r['Ad Group Type']).map(r => r['Max CPC']))];
  t.ok(maxEn.length === 1 && Math.abs(+maxEn[0] - cpc.en) < 0.006 && cpc.es != null && maxEs.length === 1 && Math.abs(+maxEs[0] - cpc.es) < 0.006 && Math.abs(cpc.en - cpc.lowest) > 0.02, 'D24 the starting max CPC is the click cost weighted over the campaign\'s markets, not that of the lowest ZIP code', { maxEn, maxEs, want: cpc });
  t.eq(adFaults(g40.rows, lib.lic), [], 'D1 D3 every responsive search ad of the forty ZIP heating plan passes the same checks');
  const paths = [...new Set(g40.rows.filter(r => r['Ad type']).map(r => r['Path 1']))];
  t.ok(paths.every(x => Object.values(lib.paths).some(full => full.slice(1) === x || full.slice(1).startsWith(x + '-'))), 'the first display path is the landing path cut at a whole word, 15 characters at most', paths);
  const cr40 = await file('dkCr');
  t.ok(/^creative-library_/.test(cr40.name) && [...new Set(cr40.rows.map(r => r.angle + '|' + r.language))].every(k => cr40.rows.filter(r => r.angle + '|' + r.language === k && r.type === 'description').length >= 2) && !hyphenated(cr40.note).length, 'D1 the creative library lists two descriptions or more for every angle in both languages', cr40.rows.filter(r => r.type === 'description').length);

  /* D30: bid modifiers sent for one line do not outlive it */
  const odd = await page.evaluate(zs => zs.filter(z => ZI[z].bid !== 45).slice(0, 2), H.zips);
  await send({ zips: odd, line: 'heat', bids: Object.fromEntries(odd.map(z => [z, 45])) });
  const b1 = (await file('dkPlanX')).rows.map(r => +r.bid_modifier);
  await set('#dkLine', 'replace');
  const p2 = await plan(), b2 = (await file('dkPlanX')).rows.map(r => +r.bid_modifier), own = await page.evaluate(zs => zs.map(z => ZI[z].bid), odd);
  t.ok(odd.length === 2 && b1.join() === '45,45' && p2.line === 'replace' && !p2.bids && b2.join() === own.join(), 'D30 changing the service line in the desk drops the bid modifiers that came with the old line', { b1, b2, own, bids: p2.bids });
  await send({ zips: odd, line: 'heat', bids: Object.fromEntries(odd.map(z => [z, 45])) }); const toastLine = await send({ line: 'repair' }); const p3 = await plan();
  t.ok(p3.line === 'repair' && !p3.bids && p3.zips.join() === odd.join(), 'D30 so does a line that arrives from another module without ZIPs', { line: p3.line, bids: p3.bids });

  /* D19: a payload with no ZIPs does not announce "0 ZIPs received" */
  t.eq(toastLine, `Service line: ${lib.lines.repair}`, 'D19 a line only payload announces the service line');
  t.eq(await send({}), '', 'D19 an empty payload announces nothing');

  /* D23: census labels and long city names do not reach ad copy, keywords or paths */
  const odds = await page.evaluate(() => ({ nrh: ZR.find(z => z.city === 'North Richland Hills').zip, lantana: ZR.find(z => /^Lantana/.test(z.city)).zip, pecan: ZR.find(z => /^Pecan Plantation/.test(z.city)).zip, uninc: ZR.find(z => /unincorporated/.test(z.city)).zip, labels: ZR.filter(z => /\(/.test(z.city)).map(z => z.city) }));
  await send({ zips: [odds.lantana, odds.pecan, odds.uninc, odds.nrh], line: 'heat' });
  const g23 = await file('dkG'), kw23 = g23.rows.filter(r => r.Keyword && / Local$/.test(r['Ad Group'])).map(r => r.Keyword), cr23 = await file('dkCr');
  t.ok(odds.labels.length >= 5 && kw23.length && !kw23.some(k => /[()]/.test(k)) && kw23.some(k => / lantana$/.test(k)) && kw23.some(k => / pecan plantation$/.test(k)) && kw23.some(k => / north richland hills$/.test(k)), 'D23 local keywords name Lantana and Pecan Plantation without the census label', kw23.filter(k => /[()]/.test(k)).slice(0, 3));
  t.eq(adFaults(g23.rows, lib.lic), [], 'D23 no "(CDP)" or "(unincorporated)" in any ad of that plan');
  const en23 = g23.rows.filter(r => r['Ad type'] && /_EN_/.test(r.Campaign));
  t.ok(en23.length && en23.every(r => r['Path 2'] === 'lantana') && en23.filter(r => / Local$/.test(r['Ad Group'])).every(r => heads(r).concat(descs(r)).some(x => /Lantana/.test(x))) && cr23.rows.some(r => /Lantana/.test(r.text)) && !cr23.rows.some(r => /\(|unincorporated/.test(r.text)), 'D23 the first market is written "Lantana" in the local ads, the display path and the creative library', [...new Set(en23.map(r => r['Path 2']))]);
  await send({ zips: [odds.nrh, odds.pecan], line: 'repair' });
  const cut = (await file('dkCr')).rows.map(r => r.text).filter(x => /\bNorth\b/.test(x) && !/North Richland Hills/.test(x));
  await send({ zips: [odds.pecan], line: 'repair' });
  const cut2 = (await file('dkCr')).rows.map(r => r.text).filter(x => /\bPecan\b/.test(x) && !/Pecan Plantation/.test(x));
  t.eq(cut.concat(cut2), [], 'D23 a city name too long for the limit is not cut to its first word ("AC Repair in North")');

  /* D34: no structured snippet with fewer than three values */
  const gRep = await file('dkG');
  t.ok(gRep.rows.some(r => r['Ad type']) && gRep.rows.filter(r => r.Header).every(r => r['Snippet values'].split('; ').length >= 3), 'D34 a line with fewer than three angles writes no structured snippet row', gRep.rows.filter(r => r.Header).map(r => r['Snippet values']));

  /* D1, D2, D3 across the desk: every service line exports ad groups, and every ad in them passes */
  const sweep = [];
  for (const line of Object.keys(lib.lines)) { await send({ zips: H.zips.slice(0, 12), line }); const f = await file('dkG'); if (!f.rows.some(r => r['Ad type'])) sweep.push(`${line}: no ads`); sweep.push(...adFaults(f.rows, lib.lic)); if (f.rows.some(r => r.Header && r['Snippet values'].split('; ').length < 3)) sweep.push(`${line}: a thin snippet`); }
  t.eq(sweep.slice(0, 6), [], 'D1 D2 D3 every service line exports ad groups, and every responsive search ad in them passes the same checks');

  /* the heating negatives stay with the heat line; recruiting keeps its own in all three places */
  await send({ zips: H.zips.slice(0, 5), line: 'replace' });
  const gR = await file('dkG'), kR = await file('dkKw'), nR = await page.evaluate(() => [...document.querySelectorAll('#dkKwOut .neg code')].map(c => c.textContent));
  t.ok(negsOf(gR).every(n => n.join() === lib.neg.join()) && kR.rows.filter(r => r.ad_group === 'Negatives').map(r => r.keyword).join() === lib.neg.join() && nR.join() === lib.neg.join(), 'a replacement plan carries the customer negatives only', negsOf(gR)[0].filter(k => !lib.neg.includes(k)));
  await send({ line: 'recruit' });
  const gJ = await file('dkG'), kJ = await file('dkKw'), nJ = await page.evaluate(() => [...document.querySelectorAll('#dkKwOut .neg code')].map(c => c.textContent));
  t.ok(negsOf(gJ).every(n => n.join() === lib.negRecruit.join()) && kJ.rows.filter(r => r.ad_group === 'Negatives').map(r => r.keyword).join() === lib.negRecruit.join() && nJ.join() === lib.negRecruit.join() && gJ.rows.some(r => r['Ad type']), 'a recruiting plan carries the recruiting negatives on screen and in both files, and its ad groups', kJ.rows.filter(r => r.ad_group === 'Negatives').map(r => r.keyword).slice(0, 4));

  /* D6: the platform mix is rescaled to the budget everywhere */
  await send({ zips: H.zips, line: 'replace' });
  const bud = (await plan()).budget, usd = s => +String(s).replace(/[$,]/g, '');
  await set('#dkMix input[data-p="google"]', 64, 'input');
  const mix = await page.evaluate(() => ({ total: document.querySelector('#dkMix .mini').textContent, row: document.querySelector('#dkMix .m .usd').textContent, sum: [...document.querySelectorAll('#dkMix .m .usd')].map(x => x.textContent) }));
  await tab('#dkTabs', 'platforms');
  const plat = await page.evaluate(() => [...document.querySelectorAll('#dkTab tbody tr')].map(tr => [tr.children[0].textContent, tr.children[1].textContent]));
  t.eq((await kpi('Monthly media'))[0], '$' + bud.toLocaleString('en-US'), 'D6 moving one mix slider keeps Monthly media equal to the budget');
  t.eq(mix.total, 'Total 120% (shares are rescaled to 100%)', 'D6 the line under the sliders says the shares are rescaled');
  t.ok(plat[0][0] === lib.plab.google && plat[0][1] === mix.row && Math.abs(plat.reduce((s, r) => s + usd(r[1]), 0) - bud) <= plat.length, 'D6 the Platforms tab shows the dollars the slider row shows, and they add up to the budget', { plat: plat[0], row: mix.row });
  await press('dkMixReset'); await sleep(80); await tab('#dkTabs', 'markets');

  /* D5: the preview market stays where the user put it through a rebuild */
  const three = await page.evaluate(zs => { const seen = new Set(); return zs.map(z => ZI[z]).filter(z => z.city.length <= 12 && !/\(/.test(z.city) && !seen.has(z.city) && seen.add(z.city)).slice(0, 3).map(z => ({ zip: z.zip, city: z.city })); }, H.zips);
  await send({ zips: three.map(x => x.zip), line: 'heat' });
  await page.selectOption('#dkPrev', three[2].zip); await sleep(80); const a1 = await assets();
  await set('#dkBud', bud + 1000); const a2 = await assets(), sel2 = await page.evaluate(() => document.querySelector('#dkPrev').value);
  t.ok(three.length === 3 && a1.some(x => x.includes(three[2].city)) && sel2 === three[2].zip && a2.join('|') === a1.join('|'), `D5 the preview stays on ${three[2].zip} ${three[2].city} when the plan is rebuilt, and the creative with it`, { sel2, a1: a1[0], a2: a2[0] });
  await set('#dkBud', bud);

  /* D21: an emptied start date is refused and the exports keep working */
  const startNow = (await plan()).start;
  await set('#dkStart', '');
  const cleared = await page.evaluate(() => ({ input: document.querySelector('#dkStart').value, plan: MODI.desk.plan().start }));
  const gC = await file('dkG').catch(() => null), msC = gC ? await file('dkMs').catch(() => null) : null, mC = await file('dkM').catch(() => null);
  t.eq([cleared.input, cleared.plan], [startNow, startNow], 'D21 clearing the flight start puts the last date back');
  t.ok(gC && msC && mC && gC.name === `google-ads-editor_heat_${startNow}.csv` && mC.name === `meta-ads-import_${startNow}.csv` && gC.rows.filter(r => r['Campaign Type']).every(r => r['Start Date'] === startNow && /^\d{4}-\d{2}-\d{2}$/.test(r['End Date'])), 'D21 and the Google, Microsoft and Meta files are still written, named for that date', [gC && gC.name, msC && msC.name, mC && mC.name]);
  if (cleared.plan !== startNow) await set('#dkStart', startNow);

  /* D18: the flight note names the season each line is paced by, and a heating flight gets the freeze rule */
  const note = async line => { await send({ line }); await tab('#dkTabs', 'flight'); return page.evaluate(() => document.querySelector('#dkTab .chartnote').textContent); };
  const nHeat = await note('heat'), nRep = await note('repair'), nB2b = await note('b2b'), nRpl = await note('replace'), nJob = await note('recruit');
  t.ok(/weighted by heating degree day normals and hard freeze odds\. Freeze rule: /.test(nHeat) && !/Heat wave|100°F/.test(nHeat), 'D18 a heating flight is paced by heating degree days and ends with the freeze rule', nHeat.slice(-230));
  t.ok(/weighted by cooling degree day and 100°F day normals\. Heat wave rule: /.test(nRep) && /weighted by the repair season blended with a flat base\. /.test(nB2b) && /weighted by the monthly permit season of Fort Worth, Dallas and Irving\. /.test(nRpl) && ![nRep, nB2b, nRpl, nHeat].some(x => /Fort Worth changeout seasonal index/.test(x)), 'D18 cooling repair, landlord and replacement flights name their own season', [nRep, nB2b, nRpl].map(x => (x.match(/weighted by [^.]+/) || [''])[0]));
  t.ok(/weighted by the Fort Worth changeout seasonal index\. /.test(nJob), 'D18 recruiting, which has no season of its own, still names the Fort Worth index it is paced by', (nJob.match(/weighted by [^.]+/) || [''])[0]);
  const how = await page.evaluate(() => document.querySelector('#dkHow').innerText);
  t.ok(/Pacing\. The flight spreads the budget across its months by each line's season index from module 12\./.test(how), 'D18 the method names the season index of module 12', (how.match(/Pacing\.[^\n]*/) || [''])[0]);
  await tab('#dkTabs', 'markets');

  /* the heat line says which click benchmark it plans on; D32 the naming scheme is the one the files use; D16 counts come from the data */
  const src = async line => { await send({ line }); return page.evaluate(() => [...document.querySelectorAll('#dkAsm tbody tr')].map(tr => tr.lastElementChild.textContent)); };
  const sHeat = await src('heat'), g32 = await file('dkG'), naming = await page.evaluate(() => [...document.querySelectorAll('#dkMeas tr')].find(tr => tr.children[0].textContent === 'Naming').children[1].textContent), sRpl = await src('replace');
  t.ok(/air conditioning installation and repair\. The heating line still plans on this cooling benchmark/.test(sHeat[0]) && sHeat.slice(1).join() === sRpl.slice(1).join() && !/heating line/.test(sRpl.join(' ')) && (await page.evaluate(() => ASM0.google.cost + '|' + ASM0.google.cvr + '|' + ASM0.google.g)) === '9.68|6.56|C', 'a heat plan says in the Google assumption row that it still uses the cooling click benchmark, with no figure changed', sHeat[0]);
  t.ok(naming === `DFW_HEAT_{PLATFORM}_{LANG}_${startNow.replace(/-/g, '')}` && g32.rows[0].Campaign === naming.replace('{PLATFORM}', 'GOOGLE').replace('{LANG}', 'EN'), 'D32 the naming scheme on screen is the one the files use', [naming, g32.rows[0].Campaign]);
  await tab('#dkPTabs', 'google');
  const geo = await page.evaluate(() => document.querySelector('#dkBuild').innerText);
  t.ok(geo.includes(`Google criterion IDs carried for ${lib.ids[0]} of ${lib.ids[1]} ZIPs`), 'D16 the Google targeting note counts the criterion IDs in the data', (geo.match(/carried for \d+ of \d+ ZIPs/) || [''])[0] + ` against ${lib.ids.join(' of ')}`);

  /* D27: no hyphenated prose in the desk, whatever the line, the tab or the platform */
  const found = [];
  for (const line of Object.keys(lib.lines)) { await page.evaluate(l => MODI.desk.receive({ line: l }), line); await sleep(40);
    for (const v of ['platforms', 'flight', 'objects', 'markets']) { await tab('#dkTabs', v); found.push(...hyphenated(await prose())); }
    for (const v of await page.evaluate(() => PLATS)) { await tab('#dkPTabs', v); found.push(...hyphenated(await prose())); } }
  await tab('#dkPTabs', 'google');
  const words = await prose(), opts = await page.evaluate(() => [...document.querySelectorAll('#mod-desk option')].map(o => o.textContent).join(' | '));
  t.eq([...new Set(found.concat(hyphenated(opts)))], [], 'D27 no hyphenated prose on screen in the desk (every line, tab and platform; the Satchel rule pack apart)');
  t.ok(/Start from the atlas tiers \(A\+ \+45% to E minus 40%\)/.test(words) && /Hand picked ZIPs/.test(words) && /Hand picked ZIPs/.test(opts) && !/[‐-―−]\d/.test(words), 'D27 the bid range reads "E minus 40%" and the scope reads "Hand picked ZIPs"', (words.match(/Start from the atlas tiers[^;]*/) || [''])[0]);
  const kNote = (await file('dkKw')).note;
  t.ok(kNote.length > 10 && !hyphenated(kNote).length, 'D27 the note in the keyword file carries no hyphenated prose', kNote);

  /* D25: the angle chips are buttons a keyboard reaches and operates; D26: every control has an accessible name */
  await send({ line: 'heat' });
  const chips = await page.evaluate(() => [...document.querySelectorAll('#dkAngles .chip')].map(c => [c.tagName, c.type, c.tabIndex, c.getAttribute('aria-pressed')].join(' ')));
  t.ok(chips.length === Object.keys(lib.short).length && chips.every(c => /^BUTTON button 0 (true|false)$/.test(c)), 'D25 every service angle chip is a button in the tab order with a pressed state', [...new Set(chips)]);
  const chip = `#dkAngles .chip[data-a="${lib.heat[lib.heat.length - 1]}"]`, state = () => page.evaluate(s => ({ pressed: document.querySelector(s).getAttribute('aria-pressed'), focus: document.activeElement === document.querySelector(s), angles: MODI.desk.plan().angles }), chip);
  await page.focus(chip); const s0 = await state(); await page.keyboard.press('Space'); await sleep(200); const s1 = await state(); await page.keyboard.press('Enter'); await sleep(200); const s2 = await state();
  t.ok(s0.focus && s0.pressed === 'true' && s1.pressed === 'false' && s1.focus && s1.angles.length === s0.angles.length - 1 && s2.pressed === 'true' && s2.focus && s2.angles.length === s0.angles.length, 'D25 Space and Enter toggle a chip and the focus stays on it', [s0, s1, s2].map(s => `${s.pressed} ${s.focus} ${s.angles.length}`));
  const names = await page.evaluate(() => { const root = document.getElementById('mod-desk'), nm = e => e.getAttribute('aria-label') || (e.labels && e.labels[0] ? e.labels[0].textContent : '') || e.title || ''; return { unnamed: [...root.querySelectorAll('input, select, textarea')].filter(e => !nm(e).trim()).map(e => e.id || `${e.dataset.p}.${e.dataset.k}`), four: ['dkWeeks', 'dkMin', 'dkVal', 'dkKwA'].map(id => document.getElementById(id).getAttribute('aria-label')), asm: [...root.querySelectorAll('#dkAsm input')].map(e => e.getAttribute('aria-label')) }; });
  t.eq(names.unnamed, [], 'D26 no input or select in the desk is without an accessible name');
  t.eq(names.four, ['Flight length in weeks', 'Minimum households', 'Value per booked job in dollars', 'Keyword angle'], 'D26 the four controls that shared or lacked a label are named');
  t.eq(names.asm, Object.values(lib.plab).flatMap(p => ['cost', 'click through rate', 'lead conversion rate', 'minimum dollars a day'].map(w => `${p} ${w}`)), 'D26 the 32 assumption inputs are named by platform and measure');

  /* receive(): a complete plan arrives valid field by valid field; what is unknown or invalid is ignored, never thrown on */
  const full = { zips: [H.zips[3], H.zips[0], H.zips[7], H.zips[0]], line: 'heat', budget: 9000, start: '2026-12-07', weeks: 6, mix: { google: 60, lsa: 40, tiktok: 50 }, angles: [lib.lead, 'bogus', lib.lead], note: '  Heating plan for the week\n of December 7  ', surprise: { a: 1 } };
  const toastFull = await send(full), pf = await plan();
  const ui = await page.evaluate(() => ['dkLine', 'dkBud', 'dkStart', 'dkWeeks', 'dkScope', 'dkPicks'].map(id => document.getElementById(id).value));
  t.eq([pf.line, pf.budget, pf.start, pf.weeks, pf.scope, pf.zips, pf.angles], ['heat', 9000, '2026-12-07', 6, 'picks', [H.zips[3], H.zips[0], H.zips[7]], [lib.lead]], 'receive() honours line, budget, start, weeks, ZIP order and angles, dropping a repeated ZIP and an unknown angle');
  t.eq(Object.entries(pf.mix).filter(([, v]) => v).concat([['keys', Object.keys(pf.mix).length], ['surprise', 'surprise' in pf]]), [['google', 60], ['lsa', 40], ['keys', 8], ['surprise', false]], 'receive() takes the platform mix as sent, zero for a platform not named, and stores nothing it does not know');
  t.eq(ui, ['heat', '9000', '2026-12-07', '6', 'picks', [H.zips[3], H.zips[0], H.zips[7]].join(', ')], 'the plan fields on screen show what arrived');
  t.eq(toastFull, '3 ZIPs received · Heating plan for the week of December 7', 'the note is toasted once, after the count');
  t.eq([(await kpi('Monthly media'))[0], (await kpi('Monthly media'))[1]], ['$9,000', `${lib.lines.heat}; 6 weeks from December 7, 2026`], 'and the KPI follows');
  const errs0 = ctx.errors.length;
  const junk = [{ zips: 'abc', line: 'constructor', bids: 7, budget: -5, start: '2026-02-30', weeks: 0, mix: { google: 'x', lsa: -1 }, angles: ['nope', 7], note: 42 }, { zips: [75052, null, 'constructor', '00000', {}], line: 'toString', budget: '9000', start: '12/07/2026', weeks: 53, mix: [], angles: 'heat' }, { budget: Infinity, start: 20261207, weeks: '6', mix: 'google', angles: { 0: lib.lead }, zips: { length: 1, 0: '75052' }, line: 7 }, 'heat', 7, []];
  const toasts = []; for (const j of junk) toasts.push(await send(j));
  t.ok(JSON.stringify(await plan()) === JSON.stringify(pf) && toasts.every(x => x === '') && ctx.errors.length === errs0, 'receive() ignores invalid or unknown fields: the plan stays as it was, nothing is announced and nothing throws', { toasts, errors: ctx.errors.slice(errs0, errs0 + 2) });
  await send({ mix: { google: 0.5, meta: 0.25, yelp: 0.25 }, weeks: 1 }); const pm = await plan();
  t.ok(pm.mix.google === 50 && pm.mix.meta === 25 && pm.mix.yelp === 25 && pm.mix.lsa === 0 && pm.weeks === 1 && (await kpi('Monthly media'))[0] === '$9,000' && (await page.evaluate(() => document.querySelector('#dkMix .mini').textContent)) === 'Total 100%', 'shares sent as fractions are rescaled to 100, and a one week flight is accepted', pm.mix);

  /* D22: a hostile plan in localStorage inserts no element and runs nothing */
  const X = n => `"><img id="xss${n}" src="x" onerror="window.__xss=(window.__xss||0)+1">`;
  const hostile = { line: 'heat' + X(1), start: '2026-10-01' + X(2), weeks: X(3), budget: X(4), n: X(5), alpha: X(6), bookRate: X(7), jobVal: X(8), spanTh: X(9), minhh: X(10), scope: X(11), picks: [X(12), '75052'], counties: [X(13)], angles: [X(14), 'furnace', 'repair'], brand: 'Acme' + X(15), lic: 'TACLA1' + X(16), phone: X(17), url: X(18), city: 'Dallas' + X(19), pay: X(20), mix: { google: X(21), lsa: 40, meta: 30 }, asm: { google: { basis: X(22), cost: X(23), ctr: X(24), cvr: X(25), min: X(26), g: X(27), src: X(28) }, lsa: X(29) }, bids: { 75052: X(30) }, remarket: X(31), extra: X(32) };
  const tour = async () => { for (const v of ['platforms', 'flight', 'objects', 'markets']) await tab('#dkTabs', v); for (const v of await page.evaluate(() => PLATS)) for (const l of ['es', 'en']) { await tab('#dkPTabs', v); await tab('#dkLang', l); } await sleep(250);
    return page.evaluate(() => { const p = MODI.desk.plan(), saved = JSON.parse(localStorage.getItem('tda.desk.v1')); return { planted: [...document.querySelectorAll('[id^="xss"], img[src="x"]')].map(e => e.id || e.outerHTML.slice(0, 60)), ran: window.__xss || 0, failed: /failed to load/i.test(document.getElementById('mod-desk').innerText), line: p.line, start: p.start, nums: ['weeks', 'budget', 'n', 'alpha', 'bookRate', 'jobVal', 'spanTh', 'minhh'].every(k => typeof p[k] === 'number' && isFinite(p[k])), scope: p.scope, picks: p.picks, counties: p.counties, angles: p.angles, mix: Object.values(p.mix).every(v => typeof v === 'number'), asm: PLATS.every(k => ['cost', 'ctr', 'cvr', 'min'].every(f => typeof p.asm[k][f] === 'number') && ['basis', 'g', 'src'].every(f => p.asm[k][f] === ASM0[k][f])), extra: 'extra' in p, saved: [saved.start, saved.line, typeof saved.weeks, typeof saved.asm.google.cost, saved.asm.google.basis, 'extra' in saved], brand: document.querySelector('#dkBrand').value }; }); };
  await ctx.fresh({ 'tda.desk.v1': { start: hostile.start } }); await ctx.show('desk');
  const sd = await tour();
  t.ok(!sd.planted.length && !sd.ran && !sd.failed && sd.start === first.start && (await kpi('Monthly media'))[1].endsWith(`weeks from ${first.words}`), 'D22 a hostile start date in localStorage plants no element and runs no handler: the plan opens on the default date', { planted: sd.planted, ran: sd.ran, start: sd.start });
  await ctx.fresh({ 'tda.desk.v1': hostile }); await ctx.show('desk');
  const st = await tour();
  t.ok(!st.planted.length && !st.ran && !st.failed, 'D22 nor does a plan that is hostile in every field, on any tab or platform', { planted: st.planted, ran: st.ran, failed: st.failed });
  t.eq([st.line, st.start, st.nums, st.scope, st.picks, st.counties, st.angles, st.mix, st.asm, st.extra], ['replace', first.start, true, 'top', ['75052'], [], ['furnace', 'repair'], true, true, false], 'D22 the stored plan is cleaned on the way in: a known line, a real date, numbers, ids that exist, known keys only');
  t.eq(st.saved, [first.start, 'replace', 'number', 'number', 'CPC', false], 'D22 and what the desk writes back to localStorage is the cleaned plan');
  t.ok(st.brand === hostile.brand, 'D22 a business name is free text: it is kept as typed and shown as text', st.brand.slice(0, 30));

  /* D22: the same plan loaded from a file, then two files that are not plans */
  const load = async body => { await page.evaluate(() => { document.querySelector('.toast').textContent = ''; }); const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), press('dkLoad')]); await fc.setFiles({ name: 'campaign-desk-plan.json', mimeType: 'application/json', buffer: Buffer.from(body) }); await sleep(300); return page.evaluate(() => document.querySelector('.toast').textContent); };
  await ctx.fresh(); await ctx.show('desk'); await send({ zips: H.zips.slice(0, 3), line: 'maint' });
  const toastStart = await load(JSON.stringify({ line: 'maint', start: hostile.start })), sf = await tour();
  t.ok(toastStart === 'Plan loaded' && !sf.planted.length && !sf.ran && sf.line === 'maint' && sf.start === first.start, 'D22 a hostile start date in a loaded plan file plants nothing either', { toastStart, planted: sf.planted, ran: sf.ran, start: sf.start });
  const toastLoad = await load(JSON.stringify(hostile)), sl = await tour();
  t.ok(toastLoad === 'Plan loaded' && !sl.planted.length && !sl.ran && !sl.failed, 'D22 nor does the plan that is hostile in every field', { toastLoad, planted: sl.planted, ran: sl.ran });
  t.eq([sl.line, sl.start, sl.nums, sl.scope, sl.picks, sl.angles, sl.mix, sl.asm, sl.extra], ['replace', first.start, true, 'top', ['75052'], ['furnace', 'repair'], true, true, false], 'D22 and is cleaned the same way');
  const kept = JSON.stringify(await plan()), refused = [await load('[1, 2, 3]'), await load('{"type": "FeatureCollection", "features": []}'), await load('not json')];
  t.ok(refused.every(x => x === 'That file is not a desk plan') && JSON.stringify(await plan()) === kept, 'D22 a file that is not a desk plan is refused and the plan in hand is kept', refused);
  const good = await load(JSON.stringify({ line: 'heat', budget: 12000, start: '2027-01-04', weeks: 8, scope: 'picks', picks: ['75217', '75052'] })), pg = await plan();
  t.eq([good, pg.line, pg.budget, pg.start, pg.weeks, pg.zips, pg.angles, pg.mix], ['Plan loaded', 'heat', 12000, '2027-01-04', 8, ['75217', '75052'], lib.heat, lib.mixHeat], 'a plan file that names a line but no angles or mix gets that line\'s own, and its ZIPs in file order');

  await ctx.fresh();
  t.ok(!ctx.errors.length, 'no page error or console error', ctx.errors.slice(0, 5));
}
