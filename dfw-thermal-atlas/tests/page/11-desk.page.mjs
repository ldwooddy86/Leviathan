/* Module 08 Campaign Desk: a heating plan is built from heating copy and exports whole campaigns, the money adds up to the budget,
   hand picked markets keep the sender's order, a stored or loaded plan cannot plant markup, the controls work from the keyboard,
   and receive() takes a complete plan from another module. Each block names the touch up item it proves. */
const DASH = /[A-Za-zÀ-ɏ][-‐-―−][A-Za-zÀ-ɏ]/;   // a letter, a hyphen or dash of any kind, a letter
const IDENT = /^[("']*(?:https?:\/\/\S+|[\w.-]+\.(?:csv|json|html|js|mjs|zip|txt))[)"'.,;:]*$/i;   // file names and links are identifiers, not prose
const HEAT5 = ['heatrepair', 'furnace', 'heatpump', 'eheat', 'heattune'];   // the heat line of this build, by name: a Build 4 page must fail on it
const hyphenated = text => [...new Set(text.split(/\s+/).filter(w => DASH.test(w) && !IDENT.test(w)))];
/* a CSV the desk wrote: note lines (# ...) apart, then one object per row keyed by the header */
const csv = text => { const note = [], body = []; text.split('\n').forEach(l => (l.startsWith('# ') && !body.length ? note : body).push(l)); const s = body.join('\n'), rows = []; let cur = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ',') { cur.push(f); f = ''; } else if (c === '\n') { cur.push(f); rows.push(cur); cur = []; f = ''; } else f += c; }
  if (f || cur.length) { cur.push(f); rows.push(cur); } const head = rows.shift() || []; return { note: note.join(' '), head, ragged: rows.filter(r => r.length !== head.length && r.join('') !== '').length, rows: rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? '' : r[i]]))) }; };
const heads = r => Object.keys(r).filter(k => /^Headline \d+$/.test(k) && r[k]).map(k => r[k]), descs = r => Object.keys(r).filter(k => /^Description \d$/.test(k) && r[k]).map(k => r[k]);
const town = (city, home) => String(city || '').replace(/\s*\((?:CDP|unincorporated)\)\s*/gi, '').trim() || home;   // a market's city as ad copy names it
/* what is wrong with the responsive search ads of a search file: Google wants 3 headlines of 30 and 2 descriptions of 90 at least, TDLR wants the license, the house wants clean copy */
const adFaults = (rows, lic) => rows.filter(r => r['Ad type']).flatMap(r => { const h = heads(r), d = descs(r), why = [];
  if (h.length < 3) why.push(`${h.length} headlines`); if (d.length < 2) why.push(`${d.length} description`); if (h.some(x => x.length > 30) || d.some(x => x.length > 90)) why.push('over the limit'); if (!d.some(x => x.includes(lic))) why.push('no license');
  const dirty = h.concat(d).filter(x => /^(Serving\s*County|Servicio en|Local\s+Techs)$|\(CDP\)|unincorporated|[{}]|\s{2}|[-‐-―−]/.test(x)); if (dirty.length) why.push('copy: ' + dirty.join(' / '));
  if (!/^[a-z0-9-]{1,15}$/.test(r['Path 1']) || !/^[a-z]{0,15}$/.test(r['Path 2'])) why.push(`path ${r['Path 1']}/${r['Path 2']}`);
  return why.length ? [`${r.Campaign} · ${r['Ad Group']}: ${why.join(', ')}`] : []; });
export default async function (page, t, ctx) {
  const sleep = ms => page.waitForTimeout(ms);
  /* the page reopened on a given localStorage. Now and then Chromium shows a reloaded file:// page the storage as an earlier clear() left it (about three times in ten when two reloads follow each other), so what was written is read back after the reload and written again when it is not there */
  const reopen = async storage => { const want = Object.fromEntries(Object.entries(storage || {}).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
    for (let i = 0; i < 8; i++) { await ctx.fresh(storage); if (await page.evaluate(w => Object.keys(w).every(k => localStorage.getItem(k) === w[k]) && (localStorage.getItem('tda.desk.v1') || null) === (w['tda.desk.v1'] || null), want)) return; await sleep(150); }
    throw new Error('localStorage did not keep what the test wrote, eight times over'); };
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
  t.eq(adFaults(g52.rows, lib.lic), [], 'D1 D3 every responsive search ad of that file has two descriptions or more, the license, and no orphan headline such as "Serving County"');
  t.eq(negsOf(g52), [wantNeg, wantNeg], 'both campaigns of the heat plan carry the customer negatives and the heating negatives, once each');
  const sn52 = g52.rows.filter(r => r.Header).map(r => r['Snippet values'].split('; '));
  t.ok(sn52.length === 2 && sn52.every(v => v.length >= 3 && v.every(x => x.length <= 25)) && sn52[0].every(x => /Furnace|Heat/.test(x)) && sn52[1].every(x => /Calefacción|Calor/.test(x)), 'D34 the heat plan writes a structured snippet of heating services in each language, three values or more', sn52);
  const m52 = await file('dkM'), l52 = await file('dkL'), k52 = await file('dkKw'), ms52 = await file('dkMs');
  t.ok(m52.rows.length === 2 * want52.length && m52.rows.every(r => r['Campaign Name'] && r.Body && r.Title), 'D2 the Meta file is no longer empty: one row per angle and language', m52.rows.length);
  t.ok((l52.rows.find(r => r.Field === 'Job types') || {}).Value, 'D2 the LSA build sheet lists job types', l52.rows.find(r => r.Field === 'Job types'));
  t.ok(k52.rows.some(r => r.ad_group === lib.short[want52[0]] && r.match_type === 'Exact') && !k52.rows.some(r => lib.cool.map(id => lib.short[id]).includes(r.ad_group)), 'D2 the keyword file lists the heating ad groups', [...new Set(k52.rows.map(r => r.ad_group))]);
  t.eq(k52.rows.filter(r => r.ad_group === 'Negatives').map(r => r.keyword), wantNeg, 'the keyword file of a heat plan ends with the customer and the heating negatives');
  t.ok(ms52.rows.every(r => /_MS$/.test(r.Campaign) && !r.ID) && !adFaults(ms52.rows, lib.lic).length && JSON.stringify(negsOf(ms52)) === JSON.stringify([wantNeg, wantNeg]), 'the Microsoft file of the heat plan carries the same ads and negatives under _MS names', adFaults(ms52.rows, lib.lic).slice(0, 2));

  /* D4: Spanish social rows carry the license once and a Spanish title */
  const count = (s, x) => String(s || '').split(x).length - 1;
  const es52 = m52.rows.filter(r => /_ES_/.test(r['Campaign Name'])), en52 = m52.rows.filter(r => /_EN_/.test(r['Campaign Name']));
  t.ok(es52.length === want52.length && m52.rows.every(r => count(r.Body, lib.lic) === 1 && count(r.Body, 'Lic ') === 1), 'D4 every Meta body carries the license exactly once, Spanish rows included', m52.rows.filter(r => count(r.Body, 'Lic ') !== 1).map(r => r.Body));
  t.ok(es52.every(r => { const a = r['Ad Set Name'].replace(/ ES$/, ''), en = en52.find(x => x['Ad Set Name'] === a + ' EN'); return lib.esH[a] && r.Title !== lib.metaH[a] && (!en || r.Title !== en.Title) && (/\{/.test(lib.esH[a]) || r.Title === lib.esH[a]) && r.Title.length <= 40; }), 'D4 a Spanish Meta row is titled with the Spanish headline of its angle', es52.map(r => r.Title));
  await tab('#dkPTabs', 'meta'); await tab('#dkLang', 'es');
  const pv = await assets(), shown = lib.short[await page.evaluate(() => document.querySelector('#dkAng').value)], row = es52.find(r => r['Ad Set Name'] === shown + ' ES') || {};
  t.ok(count(pv[0], 'Lic ') === 1 && pv[0] === row.Body && pv[1] === row.Title, 'D4 the Spanish Meta preview shows the same body and title as the file', pv.slice(0, 2));
  const feed = await page.evaluate(() => MODI.desk.feed().filter(x => x.plat === 'meta').map(x => x.text));
  t.ok(feed.length === 2 * want52.length && feed.every(x => count(x, 'Lic ') === 1), 'D4 the creative handed to the Satchel lint carries the license once', feed.filter(x => count(x, 'Lic ') !== 1));

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
  t.eq([pf.line, pf.budget, pf.start, pf.weeks, pf.scope, pf.zips, pf.angles], ['heat', 9000, '2026-12-07', 6, 'picks', [H.zips[3], H.zips[0], H.zips[7]], [lib.lead]], 'receive() honors line, budget, start, weeks, ZIP order and angles, dropping a repeated ZIP and an unknown angle');
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
  await reopen({ 'tda.desk.v1': { start: hostile.start } }); await ctx.show('desk');
  const sd = await tour();
  t.ok(!sd.planted.length && !sd.ran && !sd.failed && sd.start === first.start && (await kpi('Monthly media'))[1].endsWith(`weeks from ${first.words}`), 'D22 a hostile start date in localStorage plants no element and runs no handler: the plan opens on the default date', { planted: sd.planted, ran: sd.ran, start: sd.start });
  await reopen({ 'tda.desk.v1': hostile }); await ctx.show('desk');
  const st = await tour();
  t.ok(!st.planted.length && !st.ran && !st.failed, 'D22 nor does a plan that is hostile in every field, on any tab or platform', { planted: st.planted, ran: st.ran, failed: st.failed });
  t.eq([st.line, st.start, st.nums, st.scope, st.picks, st.counties, st.angles, st.mix, st.asm, st.extra], ['replace', first.start, true, 'top', ['75052'], [], ['furnace', 'repair'], true, true, false], 'D22 the stored plan is cleaned on the way in: a known line, a real date, numbers, ids that exist, known keys only');
  t.eq(st.saved, [first.start, 'replace', 'number', 'number', 'CPC', false], 'D22 and what the desk writes back to localStorage is the cleaned plan');
  t.ok(st.brand === hostile.brand, 'D22 a business name is free text: it is kept as typed and shown as text', st.brand.slice(0, 30));

  /* D22: the same plan loaded from a file, then two files that are not plans */
  const load = async body => { await page.evaluate(() => { document.querySelector('.toast').textContent = ''; }); const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), press('dkLoad')]); await fc.setFiles({ name: 'campaign-desk-plan.json', mimeType: 'application/json', buffer: Buffer.from(body) }); await sleep(300); return page.evaluate(() => document.querySelector('.toast').textContent); };
  await reopen(); await ctx.show('desk'); await send({ zips: H.zips.slice(0, 3), line: 'maint' });
  const toastStart = await load(JSON.stringify({ line: 'maint', start: hostile.start })), sf = await tour();
  t.ok(toastStart === 'Plan loaded' && !sf.planted.length && !sf.ran && sf.line === 'maint' && sf.start === first.start, 'D22 a hostile start date in a loaded plan file plants nothing either', { toastStart, planted: sf.planted, ran: sf.ran, start: sf.start });
  const toastLoad = await load(JSON.stringify(hostile)), sl = await tour();
  t.ok(toastLoad === 'Plan loaded' && !sl.planted.length && !sl.ran && !sl.failed, 'D22 nor does the plan that is hostile in every field', { toastLoad, planted: sl.planted, ran: sl.ran });
  t.eq([sl.line, sl.start, sl.nums, sl.scope, sl.picks, sl.angles, sl.mix, sl.asm, sl.extra], ['replace', first.start, true, 'top', ['75052'], ['furnace', 'repair'], true, true, false], 'D22 and is cleaned the same way');
  const kept = JSON.stringify(await plan()), refused = [await load('[1, 2, 3]'), await load('{"type": "FeatureCollection", "features": []}'), await load('not json')];
  t.ok(refused.every(x => x === 'That file is not a desk plan') && JSON.stringify(await plan()) === kept, 'D22 a file that is not a desk plan is refused and the plan in hand is kept', refused);
  const good = await load(JSON.stringify({ line: 'heat', budget: 12000, start: '2027-01-04', weeks: 8, scope: 'picks', picks: ['75217', '75052'] })), pg = await plan();
  t.eq([good, pg.line, pg.budget, pg.start, pg.weeks, pg.zips, pg.angles, pg.mix], ['Plan loaded', 'heat', 12000, '2027-01-04', 8, ['75217', '75052'], lib.heat, lib.mixHeat], 'a plan file that names a line but no angles or mix gets that line\'s own, and its ZIPs in file order');

  /* ---------- the finishing pass: keyword ownership, the Heat Desk hand off, plans kept from Build 4, Spanish previews, every file of every line ---------- */
  /* from here the files are taken where the page hands them to saveFile, so two hundred of them do not meet the browser's limit on downloads in a row */
  const grab = async id => { const g = await page.evaluate(async i => { if (!window.__grabs) { window.__grabs = true; window.saveFile = async (name, data) => { window.__grab = { name, text: typeof data === 'string' ? data : await data.text() }; }; } window.__grab = null; document.getElementById(i).click(); await new Promise(r => setTimeout(r, 20)); return window.__grab; }, id); return g ? Object.assign({ name: g.name }, csv(g.text)) : { name: null, note: '', head: [], rows: [], ragged: 0 }; };
  const filled = f => f.rows.filter(r => Object.values(r).some(Boolean)), rec = n => `${n} ZIP${n === 1 ? '' : 's'} received`;
  const twice = f => { const by = {}; f.rows.filter(r => r.Keyword && !/^Negative/.test(r['Criterion Type'])).forEach(r => { const k = `${r.Campaign} · ${r.Keyword} · ${r['Criterion Type']}`; (by[k] = by[k] || []).push(r['Ad Group']); }); return Object.keys(by).filter(k => by[k].length > 1).map(k => `${k}: ${by[k].join(', ')}`); };
  const groupOf = (f, k) => [...new Set(f.rows.filter(r => r.Keyword === k).map(r => r['Ad Group']))];
  await reopen(); await ctx.show('desk');
  const more = await page.evaluate(() => ({ maint: LINES.maint.angles, lsa: Object.fromEntries(Object.keys(LINES).map(l => [l, MIX0[l].lsa > 0 && LINES[l].angles.some(id => ANG[id].lsa.length)])), furnace: ZR.filter(z => ANG.furnace.trig(z) && z.span_sh < 20).slice(0, 2).map(z => z.zip), noFurnace: ZR.filter(z => !ANG.furnace.trig(z)).slice(0, 2).map(z => z.zip) }));

  /* a keyword that two angles of a plan list is bid on from one ad group; the furnace angle keeps its Build 4 keywords for the plans that run no heating repair angle */
  await send({ zips: more.furnace, line: 'heat' });
  const gK = await grab('dkG'), kK = await grab('dkKw');
  const kwUI = async id => { await set('#dkKwA', id); return page.evaluate(() => ({ kws: [...document.querySelectorAll('#dkKwOut .kwcol div')].map(d => d.textContent), note: (document.querySelector('#dkKwOut .mini') || { textContent: '' }).textContent })); };
  const uiF = await kwUI('furnace'), uiR = await kwUI(HEAT5[0]);
  t.ok(more.furnace.length === 2 && gK.rows.some(r => r['Ad Group'] === 'Furnace Core') && !twice(gK).length, 'a heat plan whose markets fire the furnace trigger bids on no keyword from two ad groups', twice(gK).slice(0, 3));
  t.eq([groupOf(gK, 'heater repair'), groupOf(gK, 'furnace repair'), groupOf(gK, 'furnace inspection')], [['Heating Repair Core'], ['Furnace Core'], ['Furnace Core']], 'a keyword two heating angles list stays with the angle that comes first in the library: heater repair with Heating Repair, furnace inspection with Furnace');
  const kTw = kK.rows.filter(r => r.ad_group !== 'Negatives').map(r => `${r.keyword} · ${r.match_type}`);
  t.ok(new Set(kTw).size === kTw.length && kK.rows.some(r => r.ad_group === 'Heating Repair' && r.keyword === 'heater repair') && !kK.rows.some(r => r.ad_group === 'Furnace' && r.keyword === 'heater repair'), 'the keyword file lists each keyword under one ad group', kTw.filter((k, i) => kTw.indexOf(k) !== i).slice(0, 3));
  t.ok(uiR.kws.includes('[heater repair] exact') && !uiR.note && uiF.kws.includes('[furnace repair] exact') && !uiF.kws.some(x => /heater repair/.test(x)) && /^2 keywords this angle shares .* stay with that one/.test(uiF.note) && !hyphenated(uiF.note).length, 'the keyword desk shows a shared keyword under the angle that keeps it, and says so under the other', uiF.note);
  await send({ zips: more.furnace, line: 'blend' });
  const gB = await grab('dkG');
  t.eq([groupOf(gB, 'heater repair'), groupOf(gB, 'furnace inspection'), twice(gB)], [['Furnace Core'], ['Furnace Core'], []], 'a blend plan, which runs no heating repair angle, still bids on heater repair and furnace inspection from the furnace ad group, as in Build 4');

  /* the Heat Desk hand off: goModule('desk', HEATX.hand(plan, line)) sends { zips, line, bids }; its plan arrives whole on the heat line, its tune up line on the maintenance line */
  const hx = await page.evaluate(() => { if (typeof HEATX === 'undefined' || typeof HEATX.hand !== 'function') return null; const pl = HEATX.plan(HEATX.params({})); return { all: HEATX.hand(pl, 'all'), tune: HEATX.hand(pl, 'maint') }; })
    || (t.note('the Heat Desk engine is not in this build: the test stands a payload of the same shape in'), { all: { zips: H.zips.slice(0, 8), line: 'heat', bids: Object.fromEntries(H.zips.slice(0, 8).map((z, i) => [z, 5 * (i - 3)])) }, tune: { zips: H.zips.slice(2, 6), line: 'maint', bids: Object.fromEntries(H.zips.slice(2, 6).map(z => [z, 10])) } });
  const scored = zs => page.evaluate(x => x.filter(z => ZR.some(r => r.zip === z)), zs), sAll = await scored(hx.all.zips), sTune = await scored(hx.tune.zips);
  await send({ line: 'replace' }); const toastH = await send(hx.all), pH = await plan(), xH = await grab('dkPlanX'), gH = await grab('dkG');
  t.ok(Object.keys(hx.all).sort().join() === 'bids,line,zips' && hx.all.line === 'heat' && hx.tune.line === 'maint' && sAll.length > 0 && hx.all.zips.every(z => typeof z === 'string') && Object.values(hx.all.bids).every(v => typeof v === 'number'), 'the Heat Desk hands over { zips, line, bids }: ZIP strings, numbers for bids, the line heat for its plan and maint for its tune up line', { keys: Object.keys(hx.all), lines: [hx.all.line, hx.tune.line], zips: hx.all.zips.length });
  t.eq([toastH, pH.line, pH.scope, pH.angles, pH.zips], [rec(hx.all.zips.length), 'heat', 'picks', HEAT5, sAll], 'the Heat Desk plan arrives: the heat line with the five heating angles, and its ZIPs in its own order as the hand picked markets');
  t.eq(filled(xH).map(r => +r.bid_modifier), sAll.map(z => hx.all.bids[z]), 'and the bid adjustments in the plan file are the ones the Heat Desk sent');
  t.ok(gH.rows.some(r => r['Ad Group'] === 'Heating Repair Core') && !adFaults(gH.rows, lib.lic).length && !twice(gH).length && JSON.stringify(negsOf(gH)[0]) === JSON.stringify(wantNeg), 'its Google file carries the heating repair ad groups, clean ads, each keyword once and the heating negatives', adFaults(gH.rows, lib.lic).concat(twice(gH)).slice(0, 3));
  const oneZ = sAll[Math.min(2, sAll.length - 1)], toast1 = await send(Object.assign({}, hx.all, { zips: [oneZ] })), x1 = await grab('dkPlanX');
  t.eq([toast1, filled(x1).map(r => r.zip), filled(x1).map(r => +r.bid_modifier)], ['1 ZIP received', [oneZ], [hx.all.bids[oneZ]]], 'the one ZIP hand off of the Heat Desk, which sends every bid and one ZIP, builds a one market plan with that market\'s bid');
  await send({ start: '2026-11-16' }); const toastT = await send(hx.tune), pT = await plan(), gT = await grab('dkG');
  await send({ start: '2027-05-03' }); await send(hx.tune); const pT2 = await plan();
  t.eq([toastT, pT.line, pT.zips, pT.angles], [sTune.length ? rec(hx.tune.zips.length) : `Service line: ${lib.lines.maint}`, 'maint', sTune.length ? sTune : pH.zips.slice(0, 1), more.maint.concat('heattune')], 'the tune up line of the Heat Desk arrives on the maintenance line, and for a flight that starts in November the heating tune up is selected with the line\'s own angles');
  t.eq(pT2.angles, more.maint, 'the same hand off for a flight that starts in May selects the maintenance angles alone');
  t.ok(gT.rows.some(r => r['Ad Group'] === 'Heating Tune Up Core') && !adFaults(gT.rows, lib.lic).length && !twice(gT).length && groupOf(gT, 'furnace tune up').join() === 'Heating Tune Up Core', 'the Google file of that November plan carries the heating tune up ad groups, clean ads, and "furnace tune up" from one ad group', adFaults(gT.rows, lib.lic).concat(twice(gT), groupOf(gT, 'furnace tune up')).slice(0, 3));
  await set('#dkStart', '2026-12-07'); await set('#dkLine', 'replace'); await set('#dkLine', 'maint'); const pM = await plan();
  await set('#dkStart', '2027-04-05'); await set('#dkLine', 'replace'); await set('#dkLine', 'maint'); const pM2 = await plan();
  t.eq([pM.angles, pM2.angles], [more.maint.concat('heattune'), more.maint], 'picking the maintenance line in the desk follows the same rule: the heating tune up joins for a December start, not for an April one');

  /* D4, the rest of it: a Spanish social preview shows no English line */
  await send({ zips: ['75052'], line: 'heat' }); await tab('#dkPTabs', 'meta'); await tab('#dkLang', 'es'); const esA = await assets(); await tab('#dkLang', 'en'); const enA = await assets(); await tab('#dkPTabs', 'google');
  t.ok(esA.length === 2 && enA.length === 3 && !esA.includes(enA[2]), 'D4 a Spanish social preview shows its Spanish text and title and no English description: the library has none in Spanish and the files carry none', esA);

  /* every export button of every service line writes a whole, clean file: a twelve market plan with Spanish builds, and a one market plan */
  const NAMES = { dkPlanX: /^campaign-plan_\w+_2026-11-16\.csv$/, dkG: /^google-ads-editor_\w+_2026-11-16\.csv$/, dkL: /^lsa-build-sheet_2026-11-16\.csv$/, dkDg: /^demand-gen-build-sheet_2026-11-16\.csv$/, dkM: /^meta-ads-import_2026-11-16\.csv$/, dkMs: /^microsoft-ads_\w+_2026-11-16\.csv$/, dkNd: /^nextdoor-build-sheet_2026-11-16\.csv$/, dkY: /^yelp-build-sheet_2026-11-16\.csv$/, dkLi: /^linkedin-recruiting_2026-11-16\.csv$/, dkCr: /^creative-library_2026-11-16\.csv$/, dkKw: /^keyword-desk\.csv$/ };
  const ANY = /[‐-―−-]/, wrong = [];
  for (const line of Object.keys(lib.lines)) for (const [what, zips] of [['twelve markets', H.zips.slice(0, 12)], ['one market', ['75052']]]) {
    await send({ zips, line, start: '2026-11-16' }); const F = {}, bad = x => wrong.push(`${line}, ${what}: ${x}`);
    for (const id of Object.keys(NAMES)) { F[id] = await grab(id); if (!F[id].name || !NAMES[id].test(F[id].name) || !F[id].head.length || F[id].ragged || !filled(F[id]).length) bad(`${id} wrote ${F[id].name}, ${F[id].rows.length} rows, ${F[id].ragged} ragged`); }
    for (const id of ['dkG', 'dkMs']) { const f = F[id], camps = f.rows.filter(r => r['Campaign Type']); adFaults(f.rows, lib.lic).concat(twice(f)).slice(0, 2).forEach(bad);
      if (camps.length !== 2 || !camps.every(r => r['Campaign Status'] === 'Paused' && r['Start Date'] === '2026-11-16' && /^\d+\.\d\d$/.test(r.Budget)) || !f.rows.some(r => r['Ad type']) || !f.rows.filter(r => r['Ad type']).every(r => r.Status === 'Paused' && /^https:\/\/\S+\?utm_source=/.test(r['Final URL'])) || negsOf(f).some(n => n.length < 8) || f.rows.filter(r => r.Location).length !== zips.length + (zips.length === 1 ? 1 : f.rows.filter(r => r.Location && /_ES_/.test(r.Campaign)).length)) bad(`${id} is not two whole paused campaigns`); }
    for (const id of ['dkM', 'dkDg', 'dkNd', 'dkY']) F[id].rows.filter(r => !/^DFW_[A-Z0-9]+_[A-Z]+_(EN|ES)_20261116(_SAC)?$/.test(r['Campaign Name']) || count(r.Body, lib.lic) !== 1 || !r.Title || r.Title.length > 40 || ANY.test(r.Title + r.Body) || /[{}]|\s{2}/.test(r.Title + r.Body) || r.Status !== 'Paused' || !(r.Zip || r.Radius) || !/^https:\/\//.test(r.Link)).slice(0, 2).forEach(r => bad(`${id} ${r['Ad Name']}: ${r.Title} / ${r.Body}`));
    const sets = {}; F.dkCr.rows.forEach(r => { const k = `${r.angle} ${r.language}`; sets[k] = sets[k] || { headline: 0, description: 0 }; sets[k][r.type]++; if (ANY.test(r.text) || +r.chars !== r.text.length || r.text.length > (r.type === 'headline' ? 30 : 90)) bad(`creative ${k}: ${r.text}`); });
    Object.keys(sets).filter(k => sets[k].headline < 3 || sets[k].description < 2).forEach(k => bad(`creative ${k}: ${sets[k].headline} headlines, ${sets[k].description} descriptions`));
    const kw = F.dkKw.rows.filter(r => r.ad_group !== 'Negatives').map(r => `${r.keyword} · ${r.match_type}`); if (new Set(kw).size !== kw.length || !kw.length || !F.dkKw.rows.some(r => r.ad_group === 'Negatives')) bad('the keyword file repeats a keyword or lacks its negatives');
    const sheet = Object.fromEntries(F.dkL.rows.map(r => [r.Field, r.Value])); if (sheet['TDLR license'] !== lib.lic || sheet['Service ZIPs'] !== zips.join(' ') || (more.lsa[line] && !sheet['Job types'])) bad(`the LSA sheet: ${JSON.stringify(sheet).slice(0, 160)}`);
    if (filled(F.dkPlanX).length !== zips.length || filled(F.dkPlanX).some(r => !r.angles) || filled(F.dkLi).length !== 1) bad('the plan file or the LinkedIn file');
    const blocks = await page.evaluate(() => MODI.desk.feed().flatMap(x => satchelLint(x.text, { lic: MODI.desk.plan().lic, needLic: true, platform: x.plat }).filter(f => f.rule.sev === 'block').map(f => `${x.label}: ${f.rule.id} ${f.ev}`))); blocks.slice(0, 2).forEach(bad);
  }
  t.eq(wrong.slice(0, 8), [], 'every export button of every service line writes a whole, clean file, for a twelve market plan with Spanish builds and for a one market plan: 220 files parsed');

  /* an empty plan: no market, and still no error */
  await send({ zips: H.zips.slice(0, 3), line: 'heat' }); await set('#dkPicks', 'no such zip');
  const pE = await plan(), empty = []; for (const id of Object.keys(NAMES)) { const f = await grab(id); if (!f.name || !f.head.length || f.ragged) empty.push(`${id}: no file`); else if (['dkPlanX', 'dkG', 'dkMs', 'dkM', 'dkDg', 'dkNd', 'dkY', 'dkCr'].includes(id) && filled(f).length) empty.push(`${id}: ${filled(f).length} rows`); }
  t.ok(pE.zips.length === 0 && pE.scope === 'picks' && !empty.length && (await kpi('Markets bought'))[0] === '0' && (await assets()).length >= 5, 'a plan with no market still draws, and every export button writes its header and no row', empty);

  /* a plan kept by Build 4 under tda.desk.v1 still loads; on the heat line it gains the heating angles that build did not have */
  const old = await page.evaluate(() => ({ line: 'heat', budget: 12000, start: '2026-10-01', weeks: 10, scope: 'picks', counties: [], picks: ['76028', '75052'], n: 30, minhh: 2000, alpha: 1.4, spanTh: 25, angles: ['furnace', 'heatpump'], brand: 'Integrity Air', lic: 'TACLA124869E', phone: '(972) 734-1428', url: 'https://www.example.com', city: 'Mesquite', pay: '$26 to $42 an hour', bookRate: 50, jobVal: 3000, mix: Object.assign({}, MIX0.heat, { google: 50, lsa: 22 }), asm: Object.assign(JSON.parse(JSON.stringify(ASM0)), { google: Object.assign({}, ASM0.google, { cost: 11 }) }), remarket: true, bids: { 75052: 45, 76028: 30 } }));
  await reopen({ 'tda.desk.v1': old }); await ctx.show('desk');
  const pO = await plan(), xO = await grab('dkPlanX'), gO = await grab('dkG');
  t.eq([pO.line, pO.budget, pO.start, pO.weeks, pO.scope, pO.zips, pO.alpha, pO.spanTh, pO.bookRate, pO.jobVal, pO.mix.google, pO.mix.lsa, pO.asm.google.cost, pO.brand, pO.url, filled(xO).map(r => +r.bid_modifier)], ['heat', 12000, '2026-10-01', 10, 'picks', ['76028', '75052'], 1.4, 25, 50, 3000, 50, 22, 11, 'Integrity Air', 'https://www.example.com', [30, 45]], 'a heat plan kept by Build 4 under tda.desk.v1 loads with every figure it held: budget, flight, markets, mix, assumptions, brand and bids');
  t.eq(pO.angles, HEAT5, 'and it gains the heating angles that build did not have, so its markets run heating repair copy');
  t.ok(gO.rows.some(r => r['Ad Group'] === 'Heating Repair Core') && gO.rows.filter(r => r['Campaign Type']).every(r => r['Start Date'] === '2026-10-01') && !adFaults(gO.rows, lib.lic).length && !ctx.errors.length, 'its Google file exports whole, on the flight it was saved with', adFaults(gO.rows, lib.lic).slice(0, 2));
  const toastOld = await load(JSON.stringify(Object.assign({}, old, { picks: ['75052'] }))), pL = await plan();
  t.eq([toastOld, pL.line, pL.angles, pL.zips, pL.v], ['Plan loaded', 'heat', HEAT5, ['75052'], 5], 'the same holds for a plan file saved by Build 4, and the plan in hand is marked as written by this build');
  await reopen({ 'tda.desk.v1': Object.assign({}, old, { v: 5 }) }); await ctx.show('desk'); const pN = await plan();
  await reopen({ 'tda.desk.v1': Object.assign({}, old, { line: 'maint', angles: ['maint'], mix: undefined }) }); await ctx.show('desk'); const pR = await plan();
  t.eq([pN.angles, pR.line, pR.angles, pR.start], [['furnace', 'heatpump'], 'maint', ['maint'], '2026-10-01'], 'a heat plan this build wrote keeps the two angles its owner chose, and a Build 4 plan on another line keeps its own');

  await reopen();
  t.ok(!ctx.errors.length, 'no page error or console error', ctx.errors.slice(0, 5));
}
