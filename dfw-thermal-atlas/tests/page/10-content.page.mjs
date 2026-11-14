/* The copy library (app/js/04_content.js) as the Campaign Desk fills it: every angle on every desk line keeps enough headlines and
   descriptions inside Google's limits in English and Spanish, for the worst case market, for three real ZIPs and with no market at
   all; nothing leaves with a hyphen, a dash or an empty placeholder; the five heating angles pass the Satchel lint; and the heat
   line, its triggers and its negative keywords are the ones the desk was promised. */
const HEAT = ['heatrepair', 'furnace', 'heatpump', 'eheat', 'heattune'];
const NEW = { heatrepair: 'Heating Repair', eheat: 'Electric Heat', heattune: 'Heating Tune Up' };
const NAMED = ['space heater', 'water heater', 'pool heater', 'patio heater', 'fireplace', 'boiler parts', 'furnace filter', 'wood furnace', 'outdoor furnace', 'car heater', 'heater core', 'heating pad', 'kerosene heater'];
const MONEY = { heatrepair: ['heating repair', 'heater repair', 'no heat', 'heater not working', 'heating repair {city}'], eheat: ['electric furnace repair', 'heat strips not working', 'air handler repair'], heattune: ['furnace tune up', 'heating tune up', 'furnace inspection'] };
const DASH = /[-‐-―−]/;   // a hyphen, a dash of any kind or a minus sign
const csv = text => { const rows = []; let row = [], cur = '', q = false; const s = text.split('\n').filter(l => !l.startsWith('# ')).join('\n');
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c; }
  if (cur || row.length) { row.push(cur); rows.push(row); } const head = rows.shift() || []; return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] || '']))); };
export default async function (page, t, ctx) {
  const R = await page.evaluate(([HEAT, NEW]) => {
    const DASH = /[-‐-―−]/, heatNeg = typeof NEG_HEAT === 'undefined' ? null : NEG_HEAT;
    const ADD = { en: ['Call {brand}', 'Serving {county} County', 'Licensed HVAC Team'], es: ['Técnicos con Licencia', 'Llame Hoy', 'Servicio en {county}'] };   // the three headlines the desk adds to every responsive search ad
    const base = { brand: 'Integrity Air', lic: 'TACLA124869E', pay: '$26 to $42 an hour' };
    const clean = c => String(c || '').replace(/\s*\((?:CDP|unincorporated)\)\s*/gi, '').trim();
    const market = (city, county) => Object.assign({ city, short: city.length > 12 ? 'DFW' : city, county }, base);   // the desk's rule for a market
    const byName = ZR.slice().sort((a, b) => clean(b.city).length - clean(a.city).length);
    const real = [ZR.find(z => clean(z.city).length === 12) || byName[byName.length - 1], byName[0], ZR.slice().sort((a, b) => b.span_sh - a.span_sh)[0]];   // a 12 character city, the longest city name, the highest Spanish share
    const county = [...new Set(ZR.map(z => z.cty))].sort((a, b) => b.length - a.length)[0];
    const worst = ['the worst case market', market('Flower Mound', county)];
    const none = ['no market', Object.assign({ city: 'Mesquite', short: 'Mesquite', county: '' }, base)];   // Core and Questions ad groups are filled with no market
    const ALL = [worst].concat(real.map(z => [`${z.zip} ${z.city}`, market(clean(z.city), z.cty)]), [none]);
    const pairs = Object.keys(LINES).flatMap(l => LINES[l].angles.map(id => [l, id])), ids = [...new Set(pairs.map(p => p[1]))].filter(id => ANG[id]);
    const fit = (list, c, lim) => (list || []).map(x => fillCopy(x, c, lim)).filter(Boolean);
    const uniq = xs => xs.filter((x, i) => xs.findIndex(y => y.toLowerCase() === x.toLowerCase()) === i);
    const assets = a => [].concat(a.h.map(x => ['headline', x, 30]), a.d.map(x => ['description', x, 90]), a.es.h.map(x => ['Spanish headline', x, 30]), a.es.d.map(x => ['Spanish description', x, 90]), [['social text', a.meta.p, 0], ['social headline', a.meta.h, 40], ['social description', a.meta.d, 30]]);
    const fewD = [], fewHeatD = [], fewH = [], fewEsH = [], cut = [], dashed = [], holes = [], lint = [];
    ids.forEach(id => { const a = ANG[id];
      ALL.forEach(([name, c]) => {
        const en = fit(a.d, c, 90).length, es = fit(a.es.d, c, 90).length;
        if (en < 2 || es < 2) fewD.push(`${id}, ${name}: ${en} English, ${es} Spanish`);
        if (HEAT.includes(id) && en < 3) fewHeatD.push(`${id}, ${name}: ${en} English`);
        const h = uniq(fit(a.h.concat(ADD.en), c, 30)).length, eh = uniq(fit(a.es.h.concat(ADD.es), c, 30)).length;
        if (h < 5) fewH.push(`${id}, ${name}: ${h}`);
        if (eh < 3) fewEsH.push(`${id}, ${name}: ${eh}`);
        assets(a).concat(ADD.en.concat(ADD.es).map(x => ['desk headline', x, 30])).forEach(([kind, x]) => {
          const empty = [...x.matchAll(/\{(\w+)\}/g)].some(m => c[m[1]] == null || c[m[1]] === ''), s = fillCopy(x, c);
          if (empty ? s !== null : (typeof s !== 'string' || !s.trim() || /[{}]/.test(s))) holes.push(`${id}, ${name}, ${kind}: ${x} → ${s}`);
          if (s && DASH.test(s)) dashed.push(`${id}, ${name}, ${kind}: ${s}`);
        });
      });
      assets(a).forEach(([kind, x, lim]) => { if (lim && !fillCopy(x, worst[1], lim)) cut.push(`${id} ${kind}: ${fillCopy(x, worst[1])} (${(fillCopy(x, worst[1]) || '').length} against ${lim})`); });
      [a.short, a.label, a.why].concat(a.kw, a.kwq).forEach(x => { if (DASH.test(x)) dashed.push(`${id}: ${x}`); });
    });
    Object.keys(LINES).forEach(l => { if (DASH.test(LINES[l].l)) dashed.push(`line ${l}: ${LINES[l].l}`); });
    HEAT.filter(id => ANG[id]).forEach(id => { const a = ANG[id];
      const run = (kind, s, o) => { if (!s) return; const f = satchelLint(s, o); if (f.length) lint.push(`${id} ${kind}: "${s}" ${f.map(x => x.rule.id).join(' ')}`); };
      ALL.forEach(([name, c]) => {
        a.h.forEach(x => run('headline', fillCopy(x, c, 30), { headline: true })); a.es.h.forEach(x => run('Spanish headline', fillCopy(x, c, 30), { headline: true }));
        a.d.forEach(x => run('description', fillCopy(x, c, 90), {})); a.es.d.forEach(x => run('Spanish description', fillCopy(x, c, 90), {}));
        run(`description set, ${name}`, fit(a.d, c, 90).join(' \n '), { needLic: true, lic: c.lic }); run(`Spanish description set, ${name}`, fit(a.es.d, c, 90).join(' \n '), { needLic: true, lic: c.lic });
        const p = fillCopy(a.meta.p, c); run('social text', p && p + ' Lic ' + c.lic + '.', { platform: 'meta', needLic: true, lic: c.lic }); run('social headline', fillCopy(a.meta.h, c, 40), { platform: 'meta', headline: true }); run('social description', fillCopy(a.meta.d, c, 30), { platform: 'meta' });
        a.kw.concat(a.kwq).forEach(x => run('keyword', fillCopy(x, c), {}));
      });
    });
    const share = z => z.sys_ef / z.sys, fired = id => ANG[id] ? ZR.filter(z => ANG[id].trig(z)).length : null;
    const longest = market(clean(byName[0].city), byName[0].cty), len = (x, c, lim) => { const s = fillCopy(x, c, lim); return s ? s.length : null; };
    const known = new Set(ANGLES.filter(a => !NEW[a.id]).flatMap(a => a.lsa));
    const towns = [...new Set(ZR.map(z => clean(z.city).toLowerCase()).filter(Boolean))], negs = NEG_CUSTOMER.concat(heatNeg || []), blocked = [];
    HEAT.filter(id => ANG[id]).flatMap(id => ANG[id].kw.concat(ANG[id].kwq)).forEach(k => (k.includes('{city}') ? towns.map(c => k.replace('{city}', c)) : [k]).forEach(q => negs.forEach(n => { if ((' ' + q + ' ').includes(' ' + n + ' ')) blocked.push(`${q} is blocked by ${n}`); })));
    return {
      count: { lines: Object.keys(LINES).length, angles: ids.length, library: ANGLES.length }, missing: pairs.filter(p => !ANG[p[1]]).map(p => p.join(': ')), off: ANGLES.filter(a => !ids.includes(a.id)).map(a => a.id),
      worst: { city: worst[1].city, county }, real: real.map(z => ({ zip: z.zip, city: z.city, county: z.cty, spanish: z.span_sh })), where: ALL.map(x => x[0]),
      fewD, fewHeatD, fewH, fewEsH, cut, dashed: dashed.slice(0, 12), holes: holes.slice(0, 12), lint: lint.slice(0, 12),
      d3: { empty: ['Serving {county} County', 'Servicio en {county}', 'Local {county} Techs'].map(x => fillCopy(x, none[1], 30)), missing: fillCopy('Serving {county} County', { county: null }, 30), filled: fillCopy('Serving {county} County', worst[1], 30), zero: fillCopy('{n} visits', { n: 0 }) },
      heat: LINES.heat.angles, fires: { scored: ZR.length, heatrepair: fired('heatrepair'), heattune: fired('heattune'), eheat: fired('eheat'), rule: ZR.filter(z => share(z) >= 0.28).length, same: !!ANG.eheat && ZR.every(z => !!ANG.eheat.trig(z) === (share(z) >= 0.28)), why: ANG.eheat ? ANG.eheat.why : '', quiet: !!ANG.eheat && Z.every(z => { try { return typeof ANG.eheat.trig(z) === 'boolean'; } catch (e) { return false; } }) },
      neg: { array: Array.isArray(heatNeg), list: heatNeg || [], bad: (heatNeg || []).filter(x => typeof x !== 'string' || !x || x !== x.trim() || x !== x.toLowerCase() || DASH.test(x)), twice: (heatNeg || []).filter((x, i) => heatNeg.indexOf(x) !== i), shared: (heatNeg || []).filter(x => NEG_CUSTOMER.includes(x)), blocked: blocked.slice(0, 8) },
      shape: Object.keys(NEW).map(id => { const a = ANG[id]; return !a ? { id, absent: true } : { id, short: a.short, line: a.line, path: a.path, lsa: a.lsa, lsaKnown: a.lsa.length > 0 && a.lsa.every(x => known.has(x)), plain: [typeof a.label, typeof a.why, typeof a.trig].join(), n: { h: a.h.length, d: a.d.length, esH: a.es.h.length, esD: a.es.d.length, kw: a.kw.length, kwq: a.kwq.length }, lic: [a.d.some(x => x.includes('{lic}')), a.es.d.some(x => x.includes('{lic}'))], kw: a.kw, meta: { p: [len(a.meta.p, worst[1]), len(a.meta.p, longest)], h: len(a.meta.h, worst[1], 40), d: len(a.meta.d, worst[1], 30) } }; }),
      kwBad: ids.flatMap(id => { const all = ANG[id].kw.concat(ANG[id].kwq); return all.filter((k, i) => !/^[a-z0-9]+( [a-z0-9]+)*$/.test(k.replace('{city}', 'x')) || k.split(' ').length > 10 || k.replace('{city}', longest.city).length > 80 || all.indexOf(k) !== i).map(k => `${id}: ${k}`); }),
      kwShared: Object.keys(LINES).flatMap(l => { const seen = {}; LINES[l].angles.filter(id => ANG[id]).forEach(id => ANG[id].kw.concat(ANG[id].kwq).forEach(k => (seen[k] = seen[k] || []).push(id))); return Object.keys(seen).filter(k => seen[k].length > 1).map(k => `${l}: ${k} (${seen[k].join(', ')})`); }),
      furnaceKw: ANG.furnace.kw, furnaceIn: real.some(z => ANG.furnace.trig(z)), order: ANGLES.map(a => a.short),
      family: ['landlord', 'financing', 'maint', 'iaq'].map(id => ANG[id].why).filter(w => !/single family/.test(w) || /single-family/.test(w)),
    };
  }, [HEAT, NEW]);
  const places = R.where.join('; ');

  /* the library and the markets it is measured in */
  t.ok(R.count.angles === R.count.library && !R.missing.length && !R.off.length, `the ${R.count.lines} desk lines name ${R.count.angles} angles and the library holds no other`, { count: R.count, missing: R.missing, off: R.off });
  t.ok(R.worst.city.length === 12 && R.real.length === 3 && new Set(R.real.map(z => z.zip)).size === 3, 'measured in a 12 character city in the county with the longest name and in three real ZIPs: a 12 character city, the longest city name, the highest Spanish share', { worst: R.worst, real: R.real });

  /* D1: enough of every angle survives Google's limits, in both languages, with a market and without one */
  t.eq(R.fewD, [], `every angle keeps two English and two Spanish descriptions of 90 characters or fewer (${places})`);
  t.eq(R.fewHeatD, [], 'each of the five heating angles keeps three English descriptions or more');
  t.eq(R.fewH, [], 'every angle builds five English headlines or more of 30 characters or fewer, the desk\'s three included');
  t.eq(R.fewEsH, [], 'and the three Spanish headlines a responsive search ad needs, with no market as well');
  t.eq(R.cut, [], 'in the worst case market no headline, description or social line of the library is cut for length (30, 90, 40 and 30 characters)');

  /* house style and D27: no hyphen or dash in anything that is filled, shown or bid on */
  t.eq(R.dashed, [], 'no filled asset, angle name, trigger note, line name or keyword carries a hyphen or a dash');
  t.eq(R.family, [], 'D27 the trigger notes of the rental, financing, maintenance and indoor air angles, which show as tooltips in modules 05 and 08, read "single family"');

  /* D3: an empty value is a missing value */
  t.eq(R.d3.empty, [null, null, null], 'D3 a placeholder with an empty value drops the asset: no "Serving County", "Servicio en" or "Local Techs"');
  t.eq([R.d3.missing, R.d3.filled, R.d3.zero], [null, `Serving ${R.worst.county} County`, '0 visits'], 'D3 a missing value drops it too, a real value fills it, and zero is a value');
  t.eq(R.holes, [], 'no asset of any angle is filled around an empty or unresolved placeholder, in any of the five settings');

  /* the heating angles: compliance, shape, triggers */
  t.eq(R.lint, [], 'the Satchel lint finds nothing in any headline, description, social line or keyword of the five heating angles, and every description set carries the license');
  t.eq(R.heat, HEAT, 'the heat line runs heating repair first, then furnace, heat pump, electric heat and the heating tune up');
  for (const s of R.shape) {
    if (!t.ok(!s.absent, `the ${NEW[s.id]} angle is in the library`)) continue;
    t.ok(s.short === NEW[s.id] && s.line === 'heat' && /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.path) && s.lsaKnown && s.plain === 'string,string,function', `${s.short}: on the heat line, with a page path and Local Services job types the library already uses`, s);
    t.ok(s.n.h >= 7 && s.n.d >= 3 && s.n.esH >= 3 && s.n.esD >= 2 && s.n.kw >= 6 && s.n.kwq >= 4 && s.lic[0] && s.lic[1], `${s.short}: seven headlines, three descriptions, three Spanish headlines and two Spanish descriptions or more, the license in both languages`, { n: s.n, lic: s.lic });
    t.ok(s.meta.p.every(n => n && n < 125) && s.meta.h && s.meta.h < 40 && s.meta.d && s.meta.d < 30, `${s.short}: the social text stays under 125 characters before the license, its headline under 40 and its description under 30`, s.meta);
    t.ok(MONEY[s.id].every(k => s.kw.includes(k)), `${s.short}: bids on its money terms`, MONEY[s.id].filter(k => !s.kw.includes(k)));
  }
  t.ok(R.fires.scored > 0 && R.fires.heatrepair === R.fires.scored && R.fires.heattune === R.fires.scored, `heating repair and the heating tune up fire in all ${R.fires.scored} scored ZIPs`, R.fires);
  t.ok(R.fires.same && R.fires.quiet && R.fires.eheat === R.fires.rule && R.fires.eheat > 0 && R.fires.eheat < R.fires.scored && /28%/.test(R.fires.why), `electric heat fires where electric furnaces are 28% or more of central systems (${R.fires.eheat} ZIPs) and its note says so`, R.fires);

  /* keywords and negatives */
  t.eq(R.kwBad, [], 'every keyword is lower case words and digits, ten words and 80 characters at most, once per angle');
  t.eq(['heater repair', 'furnace repair {city}', 'furnace inspection'].filter(k => !R.furnaceKw.includes(k)), [], 'the furnace angle keeps the three keywords Build 4 gave it, so a blend plan, which has no heating repair angle, still bids on them');
  t.ok(R.kwShared.every(x => /^heat: /.test(x)) && R.kwShared.length === 3, 'only the heat line has angles that list the same keyword, three of them: the desk gives each to one ad group (checked in its Google file below)', R.kwShared);
  t.ok(R.neg.array && R.neg.list.length > 0 && !R.neg.bad.length && !R.neg.twice.length, 'NEG_HEAT is a list of lower case strings, none twice', { n: R.neg.list.length, bad: R.neg.bad, twice: R.neg.twice });
  t.eq(R.neg.shared, [], 'NEG_HEAT shares nothing with NEG_CUSTOMER');
  t.eq(NAMED.filter(n => !R.neg.list.includes(n)), [], 'NEG_HEAT names the heaters that are not central heating: space, water, pool and patio heaters, fireplaces and the rest of the agreed list');
  t.eq(R.neg.blocked, [], 'no customer or heating negative blocks a keyword of the heat line, in any city of the 12 counties');

  /* through the Campaign Desk: the heating plan for the three real ZIPs, as the Google file carries it */
  await ctx.show('desk', { zips: R.real.map(z => z.zip), line: 'heat' });
  const plan = await page.evaluate(() => MODI.desk.plan());
  t.ok(plan.line === 'heat' && JSON.stringify(plan.angles) === JSON.stringify(HEAT) && plan.zips.length === 3, 'the desk opens the heat line for the three ZIPs with the five heating angles', { line: plan.line, angles: plan.angles, zips: plan.zips });
  const g = await ctx.download(() => page.click('#dkG')), rows = csv(g.text), ads = rows.filter(r => r['Ad type']);
  const cells = (r, re) => Object.keys(r).filter(k => re.test(k) && r[k]).map(k => r[k]), heads = r => cells(r, /^Headline \d+$/), descs = r => cells(r, /^Description \d+$/);
  const groups = [...new Set(ads.map(r => r['Ad Group']))], langs = [...new Set(ads.map(r => /_ES_/.test(r.Campaign) ? 'es' : 'en'))];
  t.ok(['Core', 'Questions', 'Local'].every(x => groups.includes('Heating Repair ' + x) && groups.includes('Heating Tune Up ' + x)) && langs.length === 2, 'the Google file carries the always on heating repair and tune up ad groups, in English and Spanish', { groups, langs });
  t.eq(ads.flatMap(r => heads(r).filter(h => /^(Serving County|Servicio en|Local Techs)$/.test(h) || /[{}]/.test(h)).map(h => `${r.Campaign} ${r['Ad Group']}: ${h}`)), [], 'D3 no exported headline is an orphan such as "Serving County" or "Servicio en"');
  t.eq(ads.filter(r => heads(r).length < 3 || descs(r).length < 2 || heads(r).some(h => h.length > 30) || descs(r).some(d => d.length > 90)).map(r => `${r.Campaign} ${r['Ad Group']}: ${heads(r).length} headlines, ${descs(r).length} descriptions`), [], 'D1 every exported responsive search ad has three headlines and two descriptions or more, all inside 30 and 90 characters');
  t.eq(ads.filter(r => !descs(r).some(d => d.includes(plan.lic))).map(r => `${r.Campaign} ${r['Ad Group']}`), [], 'every exported ad carries the license number in a description');
  t.eq(ads.flatMap(r => heads(r).concat(descs(r)).filter(x => DASH.test(x) || /[{}]/.test(x))).slice(0, 5), [], 'no exported headline or description carries a hyphen, a dash or a placeholder');
  const kwRows = rows.filter(r => r.Keyword && !/^Negative/.test(r['Criterion Type'])), by = {}; kwRows.forEach(r => { const k = `${r.Campaign} · ${r.Keyword} · ${r['Criterion Type']}`; (by[k] = by[k] || []).push(r['Ad Group']); });
  t.eq(Object.keys(by).filter(k => by[k].length > 1).map(k => `${k}: ${by[k].join(', ')}`).slice(0, 5), [], 'no campaign of that file bids on a keyword from two ad groups');
  const home = k => [...new Set(kwRows.filter(r => /_EN_/.test(r.Campaign) && r.Keyword === k).map(r => r['Ad Group']))];
  t.eq([home('heater repair'), home('furnace inspection'), home('furnace repair')], [['Heating Repair Core'], [R.furnaceIn ? 'Furnace Core' : 'Heating Tune Up Core'], R.furnaceIn ? ['Furnace Core'] : []], 'a keyword two heating angles list stays with the one that comes first in the library: heater repair with Heating Repair, furnace inspection with Furnace where that angle runs');
  const negRows = rows.filter(r => /^Negative/.test(r['Criterion Type'])).map(r => r.Keyword);
  t.eq(R.neg.list.filter(n => !negRows.includes(n)), [], 'the heat campaigns of that file carry every heating negative');
  t.ok(!ctx.errors.length, 'no page error or console error', ctx.errors.slice(0, 5));
}
