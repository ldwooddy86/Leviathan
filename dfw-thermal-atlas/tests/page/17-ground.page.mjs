/* Modules 06 Ground Truth, 07 Supply Line and 11 Dallas Fort Worth: every touch up fix, the turn of the year (the page clock
   set to January and July 2027, and a year to date block that has moved on before its row exists), dates read from the data
   instead of literals, and a guard that every file the three modules write is the Build 4 file apart from the changes a
   defect names. Ids are those of notes/R4-ground-weather.md section 10 (D12 ...) and notes/R3-stock-data.md section 10.8 (26, 29, 30). */
import { createHash } from 'node:crypto';
/* sha1 (12 hex) of each Build 4 export, byte order mark stripped, read from dist/DFW_Thermal_Debt_Atlas.html. The function
   beside a hash sets aside what a defect changes: the Census sentinels in the ZIP file (26, fixed in the shared core), the
   grade stated in the note of the county file (29), the grade column of the headline file (D14, 29), the two reworded rows
   of the inventory (D13, D21). */
const B4X = {
  'dfw-counties-ground-truth.csv': ['7b4e3eb78c42', s => s],
  'dfw-cities-ground-truth.csv': ['51f7b6790695', s => s],
  'dfw-hvac-competitors.csv': ['ac819991cc2d', s => s],
  'dfw-survey-estimates.csv': ['eaa80ec1752e', s => s],
  'dfw-zips.csv': ['95d9446ddfeb', s => s.replace(/-222222222/g, '')],
  'dfw-counties.csv': ['f3f34361d0e1', s => s.split('\n').slice(1).join('\n')],
  'dfw-headlines.csv': ['9eb032113a7c', s => s.split('\n').map(l => l.replace(/,[A-D]$/, '')).join('\n')],
  'dfw-data-inventory.csv': ['58e1e69dcd0b', s => s.split('\n').filter(l => !/^(E3|U2),/.test(l)).join('\n')],
};
const BUTTONS = { ground: ['g6Co', 'g6Ci'], supply: ['s7Csv'], dfw: ['d11CoX', 'd11ZiX', 'd11HlX', 'd11InvX', 'd11SvyX'] };
/* the grade module 11 prints beside each headline figure after D14 and 29; the figures 29 does not name keep the grade Build 4 gave them */
const HEADLINE = { 'Occupied housing units': 'A', 'Central systems in homes (model)': 'B', 'Systems 15 years or older': 'B', 'Systems 20 years or older': 'B', 'R22 era systems (installed before 2010)': 'B', 'Builder originals aged 10 to 25': 'B', 'Replacements a year, RECS shape': 'B', 'Replacements a year, engineering shape k = 3': 'C', 'Replacements a year in 2035, RECS shape': 'C', 'Gas furnaces': 'B', 'Gas furnaces 20 or older': 'B', 'Replacement dollars a year': 'C', 'Median year built': 'A', 'Gas heated homes (%)': 'A', 'Median home value': 'A', 'New single family homes permitted, 2015 to 2025': 'A', 'Hail reports of 1 inch or larger since 2016': 'C', 'Active A/C contractor licenses': 'A', 'Active A/C technician licenses': 'A', 'Systems per licensed technician': 'B', 'HVAC contractor establishments, 2023': 'B' };

export default async function (page, t, ctx) {
  const sha = s => createHash('sha1').update(s).digest('hex').slice(0, 12);
  /* a patch to the baked data applied the moment the data script assigns it, so the tables built at script load see it too. It is asked for in the address (?t17={"lic":..,"roster":..}), not in localStorage: storage written just before a reload is not always there when the next document starts */
  await page.addInitScript(() => { let p = null; try { const m = /[?&]t17=([^&#]*)/.exec(location.search); p = m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch (e) { } if (!p) return; let d; Object.defineProperty(window, '__ATLAS_DATA__', { configurable: true, get() { return d; }, set(v) { d = v; if (p.lic) v.lic.asof = p.lic; if (p.roster) v.comp_generated = p.roster; } }); });

  /* ---------- readers ---------- */
  const text = sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
  const kpis = host => page.evaluate(h => [...document.querySelectorAll(h + ' .kpi')].map(k => ({ l: k.querySelector('.kl span').textContent, g: [...k.querySelectorAll('.kl .g')].map(x => x.textContent).join('/'), v: k.querySelector('.kv').textContent, d: k.querySelector('.kd').textContent })), host);
  const srcs = host => page.evaluate(h => [...document.querySelectorAll(h + ' .srcs > div')].map(r => ({ l: r.querySelector('.sl').textContent, s: r.querySelector('.sr').innerText, g: [...r.querySelectorAll('.g')].map(x => x.textContent).join('/'), v: r.querySelector('.mini').textContent, links: [...r.querySelectorAll('a')].map(a => a.href) })), host);
  const headlines = () => page.evaluate(() => [...document.querySelectorAll('#d11Hls tbody tr')].map(tr => [...tr.cells].map(c => c.textContent)));
  const setVal = (sel, v) => page.evaluate(([s, x]) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
  const setTheme = th => page.evaluate(x => { document.documentElement.dataset.theme = x; BUS.emit('theme'); }, th);
  const legend = host => page.evaluate(h => { const e = document.querySelector(h); return { title: (e.querySelector('.lt') || {}).textContent || '', ramp: [...e.querySelectorAll('.ramp i')].map(i => i.style.backgroundColor), labs: [...e.querySelectorAll('.rlabs span')].map(s => s.textContent), note: (e.querySelector('.dn') || {}).innerText || '', g: [...e.querySelectorAll('.dn .g')].map(x => x.textContent).join('/') }; }, host);
  /* a ZIP picked on the Dallas Fort Worth map the way a pointer does it, then its ledger: [label, grade, value] */
  const ledger = zip => page.evaluate(async z => { document.querySelector('#d11Reset').click(); const p = document.querySelector('#d11Map path.z[data-zip="' + z + '"]'), r = p.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }; p.dispatchEvent(new PointerEvent('pointerdown', o)); p.dispatchEvent(new PointerEvent('pointerup', o)); await new Promise(r => setTimeout(r, 60)); return { title: document.querySelector('#d11LedT').textContent, rows: [...document.querySelectorAll('#d11Led .rowl')].map(r => { const s = r.querySelector('span'); return [s.firstChild.textContent.trim(), [...s.querySelectorAll('.g')].map(x => x.textContent).join('/'), r.querySelector('b').textContent]; }) }; }, zip);
  const row = (led, label) => led.rows.find(r => r[0].startsWith(label)) || ['', '', ''];
  /* words with a hyphen or a dash between letters or digits, and cells with a spaced dash between words, in what a module shows; company names, street addresses and the official names and ids in keep are not prose (a lone dash is the placeholder for a missing number) */
  const hyphens = (key, keep) => page.evaluate(([k, keepSrc]) => { const word = new RegExp('[A-Za-z0-9]' + DASH_RE.source + '[A-Za-z0-9]'), spaced = new RegExp('\\S ' + DASH_RE.source + ' \\S'), ok = new RegExp(keepSrc); let s = document.querySelector('#mod-' + k).innerText; COMP.forEach(l => { s = s.split(l.name).join(' '); if (l.street) s = s.split(l.street).join(' '); }); return [...new Set(s.split(/\s+/).filter(w => word.test(w) && !ok.test(w)).concat(s.split(/[\t\n]+/).filter(x => spaced.test(x)).map(x => x.slice(0, 70))))]; }, [key, keep]);
  const KEEP = '^\\(?(94-171|7358-krk7|49-9021)\\)?[,.;]?$';

  /* what the baked data says about its own dates: every label below is checked against these, never against a literal */
  const facts = () => page.evaluate(() => { const c = DATA.climate, f = (d, o) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', o), hy = DATA.hail.rows[DATA.hail.rows.length - 1], fwY = Math.max(...Object.keys(META.fw_ytd).map(Number)); return { y: +c.ytd.through.slice(0, 4), md: f(c.ytd.through, { month: 'long', day: 'numeric' }), mdS: f(c.ytd.through, { month: 'short', day: 'numeric' }), d100: c.ytd.d100, hasRow: c.rows.some(r => r[0] === +c.ytd.through.slice(0, 4)), hail0: DATA.hail.rows[0][0], hailY: hy[0], hailN: N(hy[1]), hailMax: hy[5], fwY, fwN: N(META.fw_ytd[fwY]), lic: DATA.lic.asof, roster: DATA.comp_generated, licLong: f(DATA.lic.asof, { month: 'long', day: 'numeric', year: 'numeric' }), licDay: f(DATA.lic.asof, { month: 'short', day: 'numeric', year: 'numeric' }), licMon: f(DATA.lic.asof, { month: 'short', year: 'numeric' }), licMonth: f(DATA.lic.asof, { month: 'long', year: 'numeric' }), rosterDay: f(DATA.comp_generated, { month: 'long', day: 'numeric', year: 'numeric' }), rosterMonth: f(DATA.comp_generated, { month: 'long', year: 'numeric' }), rosterMon: f(DATA.comp_generated, { month: 'short', year: 'numeric' }), top40: COMP.filter(l => l.tier === 'top40').length, paid: COMP.filter(l => l.tier === 'top40' && (l.paid_kw || 0) > 0).length, ncomp: N(COMP.length) }; });
  const F = await facts();

  /* ================= module 11, Dallas Fort Worth ================= */
  await ctx.show('dfw');
  /* D12: the legend of a layer that runs dark for low values reads the same way the map is painted, in both themes */
  for (const th of ['light', 'dark']) {
    await setTheme(th); await setVal('#d11Lay', 'medyr');
    const m = await page.evaluate(() => { const zs = ZR.filter(z => isN(z.medyr)).sort((a, b) => a.medyr - b.medyr), o = zs[0], n = zs[zs.length - 1], fill = z => document.querySelector('#d11Map path.z[data-zip="' + z.zip + '"]').style.fill; return { old: [String(Math.round(o.medyr)), fill(o)], nw: [String(Math.round(n.medyr)), fill(n)] }; });
    const lg = await legend('#d11Leg');
    t.ok(lg.ramp.length === 8 && lg.ramp[0] === m.old[1] && lg.labs[0] === m.old[0] && lg.ramp[7] === m.nw[1] && lg.labs[1] === m.nw[0] && m.old[1] !== m.nw[1], `D12 median year built, ${th} theme: the end of the legend painted like the oldest ZIP carries the oldest year`, { m, lg });
  }
  await setTheme('light');
  /* a layer that runs dark for high values was right and stays right */
  await setVal('#d11Lay', 'ge15_sh');
  const up = await page.evaluate(() => { const zs = ZR.filter(z => isN(z.ge15_sh)).sort((a, b) => a.ge15_sh - b.ge15_sh), fill = z => document.querySelector('#d11Map path.z[data-zip="' + z.zip + '"]').style.fill; return [fill(zs[0]), fill(zs[zs.length - 1]), P(zs[0].ge15_sh, 0), P(zs[zs.length - 1].ge15_sh, 0)]; });
  const lgUp = await legend('#d11Leg');
  t.ok(lgUp.ramp[0] === up[0] && lgUp.ramp[7] === up[1] && lgUp.labs[0] === up[2] && lgUp.labs[1] === up[3], 'D12 control: a layer that runs dark for high values keeps its legend', { up, lgUp });

  /* D12b: the ZIP hail figure is a rate per decade and says so */
  await setVal('#d11Lay', 'hail');
  const lgHail = await legend('#d11Leg');
  const l13 = await ledger('75013');
  const hail13 = await page.evaluate(() => { const v = ZI['75013'].hail1_8km; return { v, shown: D(v, 1), count: Math.round(v * 1.07), allRate: Z.every(z => !isN(z.hail1_8km) || Math.abs(z.hail1_8km * 1.07 - Math.round(z.hail1_8km * 1.07)) < 0.06) }; });
  t.ok(hail13.allRate && /reports within 8 km per decade/.test(lgHail.title) && !/within 8 km since 2016/.test(lgHail.title), 'D12b the hail layer is labeled as reports within 8 km per decade', lgHail.title);
  t.ok(row(l13, 'Hail of 1 inch')[0] === 'Hail of 1 inch within 8 km, per decade' && row(l13, 'Hail of 1 inch')[2] === hail13.shown && String(hail13.count) !== hail13.shown, 'D12b the ZIP ledger prints the rate with its decimal and does not call it a count since 2016', [row(l13, 'Hail of 1 inch'), hail13]);
  t.ok(/for each ZIP as reports within 8 km of its centroid per decade/.test(await text('#mod-dfw')), 'D12b the method note says the same');

  /* D13: the Dallas permit file ends where its own series ends */
  const inv = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#d11Inv tbody tr')].map(tr => [...tr.cells].map(c => c.textContent)), last: DATA.ts.Dallas.series[DATA.ts.Dallas.series.length - 1][0], first: DATA.ts.Dallas.series[0][0] }));
  const e3 = inv.rows.find(r => r[0] === 'E3') || [];
  t.ok(inv.last === '2020-08' && inv.first.startsWith('2018') && e3[4] === 'City, 2018 to Aug 2020', 'D13 the inventory dates the Dallas permit file 2018 to Aug 2020, the span of the series held', [e3[4], inv.first, inv.last]);

  /* D14 and 29: one figure, one grade across modules 01, 06 and 11 */
  const m01 = await page.evaluate(() => Object.fromEntries(Object.entries(LAYERS).map(([k, o]) => [k, o.g])));
  const k11 = await kpis('#d11Kpis'), kg = l => (k11.find(k => k.l.startsWith(l)) || {}).g;
  t.ok(kg('Central systems') === m01.ge15_sh && kg('15 years or older') === m01.ge15_sh && kg('R22 era') === m01.r22_sh && kg('Replacements a year') === m01.rep_per1k && m01.ge15_sh === 'B', '29 the KPIs of the modeled base carry the grade module 01 gives the same figures', [k11.map(k => k.l + ' ' + k.g), m01.ge15_sh, m01.r22_sh, m01.rep_per1k]);
  t.ok(kg('Hail reports') === m01.hail1_8km && m01.hail1_8km === 'C' && kg('100 degree days') === 'A' && kg('Licensed contractors') === 'A', 'D14 the hail KPI carries the grade of the hail layer of module 01', k11.map(k => k.l + ' ' + k.g));
  const lay = {};
  for (const k of ['ge15_sh', 'r22_sh', 'rep_per1k', 'origwin_sh', 'furn20_sh', 'gas_sh', 'medyr', 'hail', 'lic', 'spt', 'value', 'inc']) { await setVal('#d11Lay', k); lay[k] = (await legend('#d11Leg')).g; }
  t.ok(['ge15_sh', 'r22_sh', 'rep_per1k', 'origwin_sh', 'furn20_sh', 'gas_sh', 'medyr', 'value', 'inc'].every(k => lay[k] === m01[k]) && lay.hail === m01.hail1_8km && lay.lic === 'A' && lay.spt === 'B', 'D14, 29 every map layer of module 11 carries the grade module 01 gives the same layer', { lay, m01: ['ge15_sh', 'r22_sh', 'rep_per1k', 'origwin_sh', 'furn20_sh', 'gas_sh', 'medyr', 'value', 'inc', 'hail1_8km'].map(k => k + ' ' + m01[k]) });
  await setVal('#d11Lay', 'ge15_sh');
  const hl = await headlines(), hlG = Object.fromEntries(hl.map(r => [r[0], r[3]]));
  const hlBad = Object.entries(HEADLINE).filter(([k, g]) => hlG[k] !== g).map(([k, g]) => `${k}: ${hlG[k]} not ${g}`);
  const d100Row = hl.find(r => r[0].startsWith('100 degree days')) || [], fwRow = hl.find(r => r[0].startsWith('Fort Worth HVAC permits')) || [];
  t.ok(hl.length === 23 && !hlBad.length && d100Row[3] === 'A' && fwRow[3] === 'B', 'D14, 29 the headline table: hail C, Business Patterns B, Fort Worth permits B, the modeled base B, and nothing else moved', hlBad.concat([d100Row[3], fwRow[3], hl.length]));
  const l50 = await ledger('75150'), lg50 = Object.fromEntries(l50.rows.map(r => [r[0], r[1]]));
  t.ok(['Central systems', '15 years or older', 'R22 era', 'Builder originals 10 to 25', 'Replacements a year', 'Gas furnaces 20 or older'].every(k => lg50[k] === m01.ge15_sh) && lg50['Heat pump share'] === m01.hp_sh && lg50['Thermal Debt Index'] === m01.idx && lg50['Hail of 1 inch within 8 km, per decade'] === m01.hail1_8km && lg50['HVAC establishments within 8 km'] === m01.est23 && lg50['Paid tier'] === 'C' && lg50['Median income'] === 'A', 'D14, 29 the ZIP ledger: the modeled rows, the hail row and the establishments row carry the grades of module 01', lg50);
  const s11 = await srcs('#mod-dfw'), sg = l => (s11.find(r => r.l === l) || {}).g;
  t.ok(sg('Establishments') === 'B' && sg('Hail and zone events') === 'C' && sg('Permits') === 'B' && sg('Climate') === 'A' && sg('Licenses') === 'A', 'D14 the source register grades hail C and Business Patterns B, as modules 01 and 06 do', s11.map(r => r.l + ' ' + r.g));
  const prose = await page.evaluate(() => ({ card: [...document.querySelectorAll('#mod-dfw .card-h p')].map(p => p.textContent).find(x => /^Sortable\./.test(x)) || '', gap: document.querySelector('#mod-dfw').innerText.match(/fitted lifetimes \(grade [A-D]\)/) }));
  t.ok(/model outputs \(grade B\)/.test(prose.card) && prose.gap && prose.gap[0].includes('grade B'), '29 the sentences that state the grade of the modeled base say B as well', prose);

  /* 26: a margin of error only when the survey gives one; the top income code is a floor */
  const sentinels = await page.evaluate(() => ({ inc: ZI['76092'].inc, moe: ZI['76092'].moe_inc }));
  const l92 = await ledger('76092');
  t.ok(sentinels.inc === 250001 && row(l92, 'Median income')[2] === '$250,000 or more' && /^\d{4} ± \d+$/.test(row(l92, 'Median year built')[2]) && /^\$[\d,]+ ± \$[\d,]+$/.test(row(l92, 'Median value')[2]), '26 ZIP 76092: the top coded income reads "$250,000 or more" with no margin; its real margins are kept', [l92.rows.filter(r => /^Median/.test(r[0])), sentinels]);
  const noVal = {};
  for (const z of ['75207', '75226', '75247', '75251', '76155']) { const l = await ledger(z); noVal[z] = [row(l, 'Median value')[2], row(l, 'Median income')[2], row(l, 'Median year built')[2]]; }
  t.ok(Object.values(noVal).every(v => v[0] === '—' && /^\$[\d,]+ ± \$[\d,]+$/.test(v[1]) && /^\d{4} ± \d+$/.test(v[2])), '26 the five ZIPs with no published home value print a plain dash, and keep the margins the survey does give', noVal);
  const led = await page.evaluate(async () => { const bad = []; let n = 0; for (const z of Z) { const p = document.querySelector('#d11Map path.z[data-zip="' + z.zip + '"]'); if (!p) continue; document.querySelector('#d11Reset').click(); const r = p.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }; p.dispatchEvent(new PointerEvent('pointerdown', o)); p.dispatchEvent(new PointerEvent('pointerup', o)); n++; const s = document.querySelector('#d11Led').innerText; if (!document.querySelector('#d11LedT').textContent.startsWith(z.zip) || /±\s*(—|\$?-)|-\d{3},\d{3}|\$250,001|undefined|NaN/.test(s)) bad.push(z.zip + ': ' + (s.match(/[^\n]*(±\s*(—|\$?-)|\$250,001|undefined|NaN)[^\n]*/) || [''])[0]); } document.querySelector('#d11Reset').click(); return { n, bad }; });
  t.ok(led.n >= 270 && !led.bad.length, '26 no ZIP ledger on the map prints a negative margin, a margin of a dash or the raw top code', led);
  await setVal('#d11Lay', 'inc');
  const lgInc = await legend('#d11Leg');
  t.ok(lgInc.labs[1] === '$250,000 or more', '26 the income layer ends at "$250,000 or more"', lgInc.labs);
  await setVal('#d11Lay', 'ge15_sh');

  /* 30: the normals drawn in the charts are this build's own means and say so */
  const norm = await page.evaluate(() => { const c = DATA.climate, w = DATA.ts.wx_monthly, own = k => Array.from({ length: 12 }, (_, i) => { let s = 0, n = 0; w.m.forEach((ym, j) => { if (+ym.slice(0, 4) >= 1991 && +ym.slice(0, 4) <= 2020 && +ym.slice(5, 7) === i + 1) { s += w[k][j]; n++; } }); return s / n; }); return ['cdd', 'hdd'].map(k => Math.max(...own(k).map((v, i) => Math.abs(v - c.normals[k][i])))); });
  const rNorm = s11.find(r => /^Normals/.test(r.l)) || {}, rNws = s11.find(r => /NWS Fort Worth/.test(r.s)) || {};
  t.ok(norm.every(d => d < 0.06) && /own 1991 to 2020 means/.test(rNorm.s || '') && /NOAA daily record at DFW Airport/.test(rNorm.s || '') && !/NWS/.test(rNorm.s || '') && !rNorm.links.length && /constants/i.test(rNws.s || '') && rNws.links.length === 1, '30 the register calls the chart normals this atlas\'s own 1991 to 2020 means from the NOAA daily record; the NWS page stays the source of the constants table', [rNorm, rNws, norm]);

  /* D32: the permit row links the three city datasets */
  const hosts = r => (r ? r.links : []).map(u => new URL(u).host).join(' ');
  t.ok(hosts(s11.find(r => r.l === 'Permits')) === 'services5.arcgis.com www.dallasopendata.com services3.arcgis.com', 'D32 module 11: the permit row of the source register links the Fort Worth, Dallas and Irving datasets', s11.find(r => r.l === 'Permits'));

  /* D21: the heatmap tables and the inventory in house style */
  const d21 = await page.evaluate(() => { const cells = (h, cols) => [...document.querySelectorAll(h + ' tbody tr')].flatMap(tr => cols.map(i => tr.cells[i].textContent)); const re = new RegExp(DASH_RE.source); return { nt: cells('#d11Nt', [0, 1]).filter(x => re.test(x)), comp: cells('#d11Comp', [0, 1, 2]).filter(x => re.test(x)), all: document.querySelector('#d11Nt').innerText + '\n' + document.querySelector('#d11Comp').innerText, src: cells('#d11Nt', [2]).filter(x => re.test(x)), raw: DATA.hm.nt.map(r => r[2]).filter(x => re.test(x)), inv: document.querySelector('#d11Inv').innerText + document.querySelector('#mod-dfw').innerText.match(/Oncor and the [a-z-]+ know/)[0], grades: [...document.querySelectorAll('#d11Comp tbody tr')].slice(0, 3).map(tr => [...tr.cells[3].querySelectorAll('.g')].map(x => x.textContent).join('/')), want: String(DATA.hm.components[0][5]) }; });
  t.ok(!d21.nt.length && !d21.comp.length, 'D21 no hyphen or dash in the constants, values, components, shares and notes carried from the heatmap', d21.nt.concat(d21.comp));
  t.ok(['Jan 2025 to Jun 2026', '(Apr to Sep)', '(Oct to Mar)', 'Jul 2024 to Jul 2025', '(1991 to 2020 normal)', '$10 to 20B', 'COOLING SEASON, share of replacement part orders', 'Surge and heat sensitive'].every(x => d21.all.includes(x)), 'D21 ranges keep their "to", months included, and a spaced hyphen becomes a comma', d21.all.slice(0, 300));
  t.eq(d21.src, d21.raw, 'D21 source names stay as published (official names are not prose)');
  t.ok(/cooperative and municipal utility rebate lists/.test(d21.inv) && /Oncor and the cooperatives know/.test(d21.inv) && !/co-op/.test(d21.inv), 'D21 "co-op" is written out in the inventory and in the gaps', d21.inv.slice(-40));
  t.ok(d21.want === 'B-/C' && d21.grades.every(g => g === 'B/C'), 'the parts index keeps both letters of the grade the heatmap gave it (B minus to C), not the better one alone', d21);
  t.eq(await hyphens('dfw', KEEP + '|^Triple-I$|^NBC-DFW$'), [], 'D21 no hyphenated prose anywhere in module 11');

  /* ================= module 06, Ground Truth ================= */
  await ctx.show('ground');
  /* D15: county layers carry their own grade and say which are modeled */
  const og = await page.evaluate(() => [...document.querySelectorAll('#g6Layer optgroup')].map(o => o.label));
  const cl = {};
  for (const k of ['con10k', 'tech10k', 'sysTech', 'hail', 'bps', 'rep1k']) { await setVal('#g6Layer', 'c:' + k); const l = await legend('#g6Leg'); cl[k] = [l.g, /Modeled\./.test(l.note) ? 'modeled' : /Observed\./.test(l.note) ? 'observed' : '?']; }
  t.eq(og, ['Observed', 'Modeled', 'County level'], 'D15 the third group of layers no longer claims every county layer is observed');
  t.eq(cl, { con10k: ['A', 'observed'], tech10k: ['A', 'observed'], sysTech: ['B', 'modeled'], hail: ['C', 'observed'], bps: ['A', 'observed'], rep1k: ['B', 'modeled'] }, 'D15 each county layer carries its own grade; replacements per 1,000 households and systems per technician are marked modeled');
  t.ok(cl.rep1k[0] === m01.rep_per1k && cl.hail[0] === m01.hail1_8km && cl.sysTech[0] === lay.spt, 'D15 those grades are the ones modules 01 and 11 give the same figures', [cl, m01.rep_per1k, m01.hail1_8km, lay.spt]);
  /* D14 against module 06: hail and establishments */
  const g6 = {};
  for (const k of ['hail1_in', 'est23', 'rep', 'idx']) { await setVal('#g6Layer', k); g6[k] = (await legend('#g6Leg')).g; }
  const k06 = await kpis('#g6Kpis');
  t.ok(g6.hail1_in === lay.hail && g6.est23 === sg('Establishments') && g6.rep === kg('Replacements a year') && g6.idx === lg50['Thermal Debt Index'] && (k06.find(k => /^Hail reports/.test(k.l)) || {}).g === kg('Hail reports') && (k06.find(k => /^HVAC establishments/.test(k.l)) || {}).g === hlG['HVAC contractor establishments, 2023'], 'D14, 29 hail, establishments, replacements and the index carry one grade in modules 06 and 11', { g6, m11: [lay.hail, sg('Establishments'), kg('Replacements a year'), lg50['Thermal Debt Index']] });
  /* D16 */
  const clu = await text('#g6Clu');
  t.ok(clu.includes(`the roster is the ${F.ncomp} locations the heatmap researched`) && !/242 companies/.test(clu), 'D16 the roster is counted in locations, as module 07 counts it', clu.slice(-260));
  /* D18: every layer label, legend and note of the module */
  const g6h = await page.evaluate(async keep => { const re = new RegExp('[A-Za-z0-9]' + DASH_RE.source + '[A-Za-z0-9]'), ok = new RegExp(keep), out = new Set(), sel = document.querySelector('#g6Layer'); const scan = s => s.split(/\s+/).filter(w => re.test(w) && !ok.test(w)).forEach(w => out.add(w)); document.querySelector('#g6CoT tbody tr').click(); for (const o of sel.options) { sel.value = o.value; sel.dispatchEvent(new Event('change')); scan(o.textContent + ' ' + document.querySelector('#g6Leg').innerText); } scan(document.querySelector('#mod-ground').innerText); return [...out]; }, KEEP);
  t.eq(g6h, [], 'D18 no hyphenated prose in any layer label, legend, panel or note of module 06');
  const g6t = (await text('#mod-ground')) + '\n' + await page.evaluate(() => [...document.querySelectorAll('#g6Layer option')].map(o => o.textContent).join('\n'));
  await setVal('#g6Layer', 'c:bps');
  const g6all = g6t + '\n' + (await legend('#g6Leg')).note, g6miss = ['Gas heated homes (%)', 'Owner single family households (%)', 'Spanish speaking households (%)', 'Single family permits 2015 to 2025', 'lower income ZIPs', 'Household weighted means', 'gas heated and rented', 'Cross check against', 'five year estimates', 'CBP excludes the self employed', 'County level value painted'].filter(x => !g6all.includes(x));
  t.eq(g6miss, [], 'D18 the phrases the review lists read without their hyphens');
  await setVal('#g6Layer', 'perm_rate');
  /* D32 */
  const s06 = await srcs('#mod-ground');
  t.ok(hosts(s06.find(r => r.l === 'Permits')) === 'services5.arcgis.com www.dallasopendata.com services3.arcgis.com', 'D32 module 06: the permit row of the source register links the three city datasets', s06.find(r => r.l === 'Permits'));
  /* 26 in the cities table */
  const top = await page.evaluate(() => { const rows = [...document.querySelectorAll('#g6CiT tbody tr')].map(tr => [...tr.cells].map(c => c.textContent)); return { coded: CITIES.filter(c => c.inc >= 250001).map(c => c.name).sort(), shown: rows.filter(r => r[7] === '$250,000 or more').map(r => r[0]).sort(), raw: rows.filter(r => /250,001/.test(r[7])).length, n: rows.length }; });
  t.ok(top.coded.length === 3 && JSON.stringify(top.coded) === JSON.stringify(top.shown) && !top.raw, '26 the cities table shows the top coded income of Highland Park, Southlake and University Park as "$250,000 or more"', top);

  /* ================= module 07, Supply Line ================= */
  await ctx.show('supply');
  /* D17 */
  const k07 = await kpis('#s7Kpis'), paidK = k07.find(k => k.l === 'Running paid search') || {};
  const s7 = await page.evaluate(() => ({ read: document.querySelector('#s7Read').innerText, chk: [...document.querySelectorAll('#mod-supply label.chk')].map(l => l.textContent.trim()) }));
  t.ok(F.top40 === 50 && paidK.v === String(F.paid) && paidK.d.startsWith(`of ${F.top40} deep dive companies`) && s7.read.includes(`${F.paid} of ${F.top40} deep dive companies`) && s7.chk.includes(`Deep dive (${F.top40})`), 'D17 the paid search count is out of the 50 deep dive companies the filter names; the client is not one of them', [paidK, s7.chk]);
  /* D19: the roster date, phones, and the roster's own text in every company panel */
  const mast = await text('#mod-supply .mast .meta');
  t.ok(mast.includes('Roster date ' + F.rosterDay) && !mast.includes(F.roster), 'D19 the roster date is written out', mast.split('\n').pop());
  const det = await page.evaluate(() => { const bad = [], phones = [], re = new RegExp('[A-Za-z0-9]' + DASH_RE.source + '[A-Za-z0-9]|\\s' + DASH_RE.source + '\\s'), web = /^\(?((?:[\w-]+\.)+[a-z]{2,}\/\S*|\/[\w./-]+|(?:I|IH|US|SH|FM)-\d+[A-Z]?[,.;]?)$/; COMP.forEach((l, i) => { MODI.supply.receive({ comp: i }); const d = document.querySelector('#s7Det').cloneNode(true); d.querySelectorAll('.kwtab').forEach(x => x.remove()); [...d.querySelectorAll('.rowl')].forEach(r => { const k = r.querySelector('span').textContent; if (k === 'Phone') phones.push(r.querySelector('b').textContent); if (k === 'Address' || k === 'Domain') r.remove(); }); document.body.appendChild(d); let s = d.innerText + '\n' + document.querySelector('#s7DSub').innerText; d.remove(); s = s.split(l.name).join(' '); s.split('\n').filter(x => re.test(x)).forEach(x => { const w = x.split(/\s+/).filter(y => new RegExp('[A-Za-z0-9]' + DASH_RE.source + '[A-Za-z0-9]|^' + DASH_RE.source + '$').test(y) && !web.test(y)); if (w.length) bad.push(i + ' ' + w.join(' ')); }); }); const pick = (i, rx) => { MODI.supply.receive({ comp: i }); return (document.querySelector('#s7Det').innerText.match(rx) || [''])[0]; }; const find = s => COMP.findIndex(l => JSON.stringify(l).includes(s)); const b = COMP.indexOf(BENCH); const out = { bad, n: COMP.length, phones: phones.length, badPhones: phones.filter(p => !/^\(\d{3}\) \d{3} \d{4}$/.test(p)), hours: pick(b, /Open 7 days [^.]*\./), scope: (MODI.supply.receive({ comp: b }), document.querySelector('#s7DSub').innerText), track: pick(find('214/817-267-2405'), /tracking numbers [^\n]*/), path: pick(find('/85-dollar'), /campaign LP [^\n]*/), url: pick(find('serviceexperts.com/dallas-tx'), /cited on [^\n ]*/), road: pick(find('I-35E service road'), /storefront on [^\n]*/), comma: pick(find('Aug 2026 - possible'), /under construction [^\n]*/), seo: pick(b, /SEO \(Ahrefs, [^)]*\)/) }; MODI.supply.receive({ comp: b }); return out; });
  t.ok(det.n === 242 && !det.bad.length, 'D19 no hyphen or dash in the scope, services, notes, website intel or data source of any of the 242 company panels', det.bad.slice(0, 8));
  t.ok(det.phones > 200 && !det.badPhones.length, 'D19 every phone in a company panel reads like (972) 734 1428', det.badPhones.slice(0, 5));
  t.ok(det.hours === 'Open 7 days 7am to 8pm.' && /metro wide/.test(det.scope) && det.track === 'tracking numbers 214/817 267 2405' && det.path === 'campaign LP /85-dollar-tune-up-offer/' && det.url === 'cited on serviceexperts.com/dallas-tx,' && det.road === 'storefront on I-35E service road.' && /under construction Aug 2026, possible transition\./.test(det.comma), 'D19 hour ranges keep their "to", a phone number is not turned into a range, web addresses and highway numbers stay whole, a spaced hyphen becomes a comma', det);
  await page.evaluate(() => document.querySelector('#s7View').click());
  const tbl = await page.evaluate(() => { const i = [...document.querySelectorAll('#s7Tbl thead th')].findIndex(th => /^Phone/.test(th.textContent)); const v = [...document.querySelectorAll('#s7Tbl tbody tr')].map(tr => tr.cells[i].textContent); return { n: v.length, bad: v.filter(p => !/^(\(\d{3}\) \d{3} \d{4}|—)$/.test(p)).slice(0, 5) }; });
  await page.evaluate(() => document.querySelector('#s7View').click());
  t.ok(tbl.n === 242 && !tbl.bad.length, 'D19 the table view prints phones the same way', tbl);
  t.eq(await hyphens('supply', KEEP), [], 'D19 no hyphenated prose anywhere else in module 07');
  /* D24: the ranking rows from the keyboard */
  const rk = () => page.evaluate(() => { const rows = [...document.querySelectorAll('#s7Rank .rk')], a = document.activeElement; return { n: rows.length, stops: rows.filter(r => r.tabIndex === 0).map(r => r.dataset.i), role: rows[0].getAttribute('role'), box: document.querySelector('#s7Rank').getAttribute('role'), sel: rows.filter(r => r.getAttribute('aria-selected') === 'true').map(r => r.dataset.i), cls: rows.filter(r => r.classList.contains('sel')).map(r => r.dataset.i), focus: a && a.classList.contains('rk') ? a.dataset.i : null, want: a && a.classList.contains('rk') ? COMP[+a.dataset.i].name : null, name: document.querySelector('#s7DName').textContent }; });
  const r0 = await rk();
  t.ok(r0.n > 30 && r0.box === 'listbox' && r0.role === 'option' && r0.stops.length === 1 && r0.stops[0] === r0.sel[0] && r0.sel.length === 1 && r0.sel[0] === r0.cls[0], 'D24 the rankings are a list with one tab stop, on the selected company', r0);
  await page.evaluate(() => { const e = document.querySelector('#s7Rank .rk[tabindex="0"]'); if (e) e.focus(); });
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  const r1 = await rk();
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  const r2 = await rk();
  t.ok(r1.focus && r1.focus !== r0.stops[0] && r1.name === r0.name && r2.focus === r1.focus && r2.sel[0] === r1.focus && r2.name === r2.want && r2.stops.length === 1 && r2.stops[0] === r1.focus && r2.name !== r0.name, 'D24 the arrow keys move along the rows without selecting; Enter opens the company and focus stays on its row', { r0: [r0.stops, r0.name], r1: [r1.focus, r1.name], r2: [r2.focus, r2.sel, r2.name] });
  await page.keyboard.press('ArrowDown'); await page.keyboard.press(' '); await page.waitForTimeout(80);
  const r3 = await rk();
  t.ok(r3.focus && r3.focus !== r2.focus && r3.sel[0] === r3.focus && r3.name === r3.want, 'D24 Space does the same', [r3.focus, r3.sel, r3.name]);
  await page.evaluate(() => MODI.supply.receive({ comp: COMP.indexOf(BENCH) }));

  /* ================= every file the three modules write ================= */
  const files = {};
  for (const [mod, ids] of Object.entries(BUTTONS)) { await ctx.show(mod); for (const id of ids) { const f = await ctx.download(() => page.evaluate(i => document.getElementById(i).click(), id)); files[f.name] = f.text.replace(/^\uFEFF/, ''); } }
  const xBad = Object.entries(B4X).filter(([n, [h, f]]) => !files[n] || sha(f(files[n])) !== h).map(([n]) => n);
  t.ok(Object.keys(files).length === 8 && !xBad.length, 'exports: the eight files are the Build 4 files apart from what a defect names (sentinels, grades, two reworded inventory rows)', xBad);
  const hx = (files['dfw-headlines.csv'] || '').split('\n').filter(l => l.startsWith('Dallas Fort Worth,')).map(l => { const m = l.match(/^Dallas Fort Worth,("(?:[^"]|"")*"|[^,]*),.*,([A-D])$/); return m ? [m[1].replace(/^"|"$/g, ''), m[2]] : [l, '?']; });
  t.ok(hx.length === 23 && hx.every(([k, g]) => (HEADLINE[k] || (k.startsWith('100 degree days') ? 'A' : k.startsWith('Fort Worth HVAC permits') ? 'B' : '?')) === g), 'exports: the grade column of the headline file is the one the page shows', hx.filter(([k, g]) => HEADLINE[k] !== g));
  t.ok(/^# DFW Thermal Debt Atlas, module 11\. Systems, ages and replacements are model estimates \(grade B\)/.test(files['dfw-counties.csv'] || '') && /^E3,.*"City, 2018 to Aug 2020"/m.test(files['dfw-data-inventory.csv'] || '') && /^U2,.*cooperative and municipal/m.test(files['dfw-data-inventory.csv'] || '') && new RegExp('^S1,.*"Statewide, ' + F.licMonth + '"', 'm').test(files['dfw-data-inventory.csv'] || ''), 'exports: the county note states grade B, and the inventory file carries the D13 and D21 rows and the license month', (files['dfw-data-inventory.csv'] || '').split('\n').filter(l => /^(E3|U2|S1),/.test(l)).map(l => l.slice(0, 90)));
  t.ok((files['dfw-hvac-competitors.csv'] || '').startsWith(`# Heatmap roster, ${F.rosterDay}. Ahrefs paid data excludes Google Local Services Ads.\n`), 'exports: the note of the competitor file takes the roster date from the data', (files['dfw-hvac-competitors.csv'] || '').slice(0, 90));

  /* ================= dates read from the data, not from literals ================= */
  await page.goto(ctx.url + '?t17=' + encodeURIComponent(JSON.stringify({ lic: '2027-02-03', roster: '2027-01-09' })), { waitUntil: 'load' });
  const P = await facts();
  t.ok(P.lic === '2027-02-03' && P.roster === '2027-01-09', 'dates: the test moved the license file date and the roster date in the data', [P.lic, P.roster]);
  await ctx.show('ground');
  await setVal('#g6Layer', 'comp_n8');
  const dg = { how: await text('#g6How'), src: await srcs('#mod-ground'), note: (await legend('#g6Leg')).note };
  t.ok(dg.how.includes('unexpired on February 3, 2027') && (dg.src.find(r => r.l === 'Licenses') || {}).v === 'Feb 3, 2027' && dg.note.includes('Heatmap roster, January 2027.'), 'dates, module 06: the license date in the method note and the register, and the roster month in the layer note, follow the data', [dg.how.match(/unexpired on [^,]*, \d{4}/), (dg.src.find(r => r.l === 'Licenses') || {}).v, dg.note]);
  await ctx.show('supply');
  const ds = { mast: await text('#mod-supply .mast .meta'), foot: await text('#mod-supply .foot'), src: await srcs('#mod-supply'), cards: await page.evaluate(() => [...document.querySelectorAll('#mod-supply .card-h p')].map(p => p.textContent).join('|')), det: await page.evaluate(() => document.querySelector('#s7Det').textContent) };
  const dsC = ds.src.find(r => r.l === 'Competitors') || {}, dsL = ds.src.find(r => r.l === 'Licenses') || {}, dsF = ds.src.find(r => r.l === 'City focus model') || {};
  t.ok(ds.mast.includes('Roster date January 9, 2027') && ds.foot.includes('company websites; January 9, 2027)') && dsC.s.includes('(Top Shelf Logic), January 9, 2027:') && dsC.v === 'Jan 2027' && dsF.v === 'Jan 2027' && dsL.v === 'Feb 3, 2027' && ds.cards.includes('(80 cities, January 2027)') && ds.det.includes('SEO (Ahrefs, Jan 2027)'), 'dates, module 07: the roster date in the masthead, the footer, the register, the panel and the city model card, and the license date, follow the data', [ds.mast.split('\n').pop(), dsC.v, dsF.v, dsL.v, ds.foot.match(/websites; [^)]*\)/)]);
  const fx = await ctx.download(() => page.evaluate(() => document.getElementById('s7Csv').click()));
  t.ok(fx.text.replace(/^\uFEFF/, '').startsWith('# Heatmap roster, January 9, 2027.'), 'dates, module 07: so does the note of the competitor file', fx.text.slice(0, 60));
  await ctx.show('dfw');
  const dd = { hl: await headlines(), src: await srcs('#mod-dfw'), inv: await page.evaluate(() => [...document.querySelectorAll('#d11Inv tbody tr')].map(tr => [...tr.cells].map(c => c.textContent)).find(r => r[0] === 'S1')) };
  t.ok(dd.hl.filter(r => r[2] === 'TDLR license file, Feb 2027').length === 2 && (dd.src.find(r => r.l === 'Licenses') || {}).v === 'Feb 2027' && dd.inv[4] === 'Statewide, February 2027', 'dates, module 11: the license month in the headline table, the register and the inventory follows the data', [dd.hl.filter(r => /TDLR license file/.test(r[2])).map(r => r[2]), (dd.src.find(r => r.l === 'Licenses') || {}).v, dd.inv[4]]);

  /* ================= the turn of the year ================= */
  /* what the three modules must say for a given state of the data: w comes from facts() */
  const year = async (label, w) => {
    const before = ctx.errors.length, st = {};
    for (const k of ['ground', 'supply', 'dfw']) { await ctx.show(k); st[k] = await page.evaluate(key => { const s = document.getElementById('mod-' + key), c = s.querySelector('.callout .ct'); return { failed: !!(c && /failed to load/i.test(c.textContent)), len: s.innerHTML.length, junk: (s.innerText.match(/undefined|NaN|Infinity|Invalid Date|\bnull\b/g) || []).join(' ') }; }, k); }
    const now = await page.evaluate(() => new Date().toISOString().slice(0, 10));
    t.ok(Object.values(st).every(s => !s.failed && s.len > 50000) && ctx.errors.length === before, `${label}: modules 06, 07 and 11 mount, none says "This module failed to load", no error`, { now, st, errors: ctx.errors.slice(before, before + 3) });
    t.ok(Object.values(st).every(s => !s.junk), `${label}: no "undefined", "NaN" or "Invalid Date" in what the three modules show`, st);
    const k = await kpis('#d11Kpis'), k100 = k.find(x => x.l.startsWith('100 degree days')) || {}, kh = k.find(x => x.l.startsWith('Hail reports')) || {};
    const d = await page.evaluate(() => { const y = document.querySelector('#d11Ytd table'); return { ytdHead: y ? y.querySelector('th').textContent : '', ytdRows: y ? [...y.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(c => c.textContent)) : [], note: document.querySelector('#d11D100N').textContent, cards: [...document.querySelectorAll('#mod-dfw .card-h')].map(h => h.innerText.replace(/\n+/g, ' :: ')), read: document.querySelector('#mod-dfw .wrap > .callout').innerText, mast: document.querySelector('#mod-dfw .mast .meta').innerText, bars: [...document.querySelectorAll('#d11D100 svg text')].map(x => x.textContent) }; });
    const hl = await headlines(), src = await srcs('#mod-dfw');
    const card = s => d.cards.find(c => c.startsWith(s)) || '';
    t.ok(k100.l === `100 degree days, ${w.y}` && k100.v === String(w.d100) && k100.d.startsWith(`through ${w.mdS}; normal `) && !/undefined|rank \d\d/.test(k100.d), `${label}: the 100 degree day KPI names its year (${w.y}) and the date it runs through (${w.mdS})`, k100);
    t.ok(kh.l === `Hail reports, ${w.hailY}` && kh.v === w.hailN && (w.hailN === '0' ? !/largest/.test(kh.d) : +((kh.d || '').match(/largest ([\d.]+) in$/) || [])[1] === w.hailMax && w.hailMax > 0), `${label}: the hail KPI shows the latest year the hail file holds (${w.hailY}), never a zero that stands for a missing year`, kh);
    t.ok(d.ytdHead === `${w.y} through ${w.md}` && !/to date/i.test(d.ytdHead) && d.ytdRows.length === (w.hasRow ? 5 : 3) && d.ytdRows.every(r => !/—°F|undefined|NaN|Infinity/.test(r.join(' '))), `${label}: "Where the year stands" is headed ${w.y} through ${w.md}; readings the data does not hold are left out, not printed as blanks`, [d.ytdHead, d.ytdRows]);
    t.ok(card('The heat record').includes(`to ${w.y}. ${w.y} is highlighted and runs through ${w.md};`) && card('Cooling and heating demand by year').includes(`${w.y} runs through ${w.md} and is left off the lines.`) && card('Where the year stands').includes(`${w.y} through ${w.md} against the normal for the same dates`) && card('The hail record').includes(`${w.hail0} to ${w.hailY}.`) && d.bars.includes(String(w.y)) && !/current year|to date/i.test(d.cards.join(' ')), `${label}: every climate card says ${w.y} through ${w.md}; the hail record ends in ${w.hailY}; nothing says "the current year" or "to date"`, [card('The heat record'), card('Cooling and heating demand by year'), card('The hail record')]);
    t.ok(d.note.startsWith(`${w.y} has ${w.d100} days through ${w.md}`) && !/undefined/.test(d.note) && d.read.includes(`in ${w.y} through ${w.md}, against`) && d.read.includes(`for January 1 to September 24, ${w.fwY}.`) && d.mast.includes(`Climate through ${w.md}, ${w.y}`), `${label}: the chart note, the opening note and the masthead carry the same year and date; the Fort Worth comparison names its own year (${w.fwY})`, [d.note, d.read.slice(-330, -120)]);
    const h100 = hl.find(r => r[0].startsWith('100 degree days')) || [], hfw = hl.find(r => r[0].startsWith('Fort Worth HVAC permits')) || [], sp = src.find(r => r.l === 'Permits') || {}, sh = src.find(r => r.l === 'Hail and zone events') || {};
    t.ok(h100[0] === `100 degree days at DFW Airport, ${w.y} through ${w.md}` && h100[1] === String(w.d100) && hfw[0] === `Fort Worth HVAC permits, January 1 to September 24, ${w.fwY}` && hfw[1] === w.fwN && sp.v === `through September 24, ${w.fwY}` && sh.v === `${w.hail0} to ${w.hailY}`, `${label}: the headline rows and the register date each figure from its own series (permits ${w.fwY}, hail ${w.hailY})`, [h100, hfw, sp.v, sh.v]);
    const g = { k: await kpis('#g6Kpis'), mast: await text('#mod-ground .mast .meta'), src: await srcs('#mod-ground') }, gh = g.k.find(x => x.l.startsWith('Hail reports')) || {};
    t.ok(gh.l === `Hail reports, 2023 to ${w.hailY}` && g.mast.includes(`hail reports 1 inch or larger, 2016 to ${w.hailY}`) && (g.src.find(r => r.l === 'Hail') || {}).v === `2016 to ${w.hailY}` && !/since 2023/.test(gh.l), `${label}: module 06 says through which year its hail counts run (${w.hailY})`, [gh.l, g.mast.split('\n')[2]]);
    t.ok((await text('#mod-supply .mast .meta')).includes('Roster date ' + w.rosterDay), `${label}: module 07 dates its roster (${w.rosterDay})`);
  };
  /* (a) the data as baked, the page clock in January and in July 2027 */
  for (const iso of ['2027-01-01T15:00:00Z', '2027-01-15T15:00:00Z', '2027-07-01T15:00:00Z']) {
    await page.clock.setFixedTime(new Date(iso)); await ctx.fresh();
    const w = await facts(), now = await page.evaluate(() => new Date().toISOString());
    t.ok(now === iso.replace('Z', '.000Z') && w.y === F.y && w.md === F.md, `clock ${iso.slice(0, 10)}: the page believes the date, the data is the baked data (${F.y} through ${F.md})`, [now, w.y, w.md]);
    await year(`clock ${iso.slice(0, 10)}, data as baked`, w);
  }
  /* (b) the year to date block has moved into 2027: on January 1 before any 2027 row exists (the state that took module 11 down in Build 4), then with its row; the hail file and the permit counts still end in 2026 */
  const MOVED = [
    ['2027-01-01T15:00:00Z', 'year to date moved to January 1, 2027 with no 2027 row', { ytd: { d100: 0, cdd: 0, hdd: 21, norm_d100: 0, norm_cdd: 0, norm_hdd: 18, through: '2027-01-01' } }],
    ['2027-01-15T15:00:00Z', 'year to date moved to January 15, 2027 with its row', { ytd: { d100: 0, cdd: 0, hdd: 310, norm_d100: 0, norm_cdd: 1, norm_hdd: 281, through: '2027-01-15' }, row: [2027, 0, 0, 0, 310, 1, 6, 71, 19, 15] }],
    ['2027-07-01T15:00:00Z', 'year to date moved to July 1, 2027 with its row', { ytd: { d100: 3, cdd: 1105, hdd: 1290, norm_d100: 1.9, norm_cdd: 1012, norm_hdd: 1297, through: '2027-07-01' }, row: [2027, 3, 0, 1105, 1290, 2, 21, 101, 17, 182] }],
    ['2027-01-15T15:00:00Z', 'the hail file has opened 2027 with no report yet', { ytd: { d100: 0, cdd: 0, hdd: 310, norm_d100: 0, norm_cdd: 1, norm_hdd: 281, through: '2027-01-15' }, row: [2027, 0, 0, 0, 310, 1, 6, 71, 19, 15], hail: [2027, 0, 0, 0, 0, 0] }],
  ];
  for (const [iso, label, p] of MOVED) {
    await page.clock.setFixedTime(new Date(iso)); await ctx.fresh();
    await page.evaluate(x => { DATA.climate.ytd = x.ytd; DATA.climate.last_date = x.ytd.through; if (x.row) DATA.climate.rows.push(x.row); if (x.hail) DATA.hail.rows.push(x.hail); }, p);
    const w = await facts();
    t.ok(w.y === 2027 && w.hasRow === !!p.row && w.fwY === F.fwY && w.hailY === (p.hail ? 2027 : F.hailY), `${label}: the test put the data in that state before the modules mounted`, [w.y, w.hasRow, w.fwY, w.hailY]);
    await year(label, w);
  }
  await page.clock.setFixedTime(new Date());
  t.ok(!ctx.errors.length, 'no page error or console error in the whole run', ctx.errors.slice(0, 5));
}
