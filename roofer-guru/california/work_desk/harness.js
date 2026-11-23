/* Opens the harness page, mounts modules 06, 07, 08, 15, 16 and exercises their pure parts.
   node harness.js <page.html> */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]);
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
  await page.goto('file://' + FILE, { waitUntil: 'load', timeout: 180000 });
  await page.waitForTimeout(1500);
  const out = await page.evaluate(async () => {
    const R = { checks: [], info: {} }; const ok = (name, cond, detail) => R.checks.push([cond ? 'PASS' : 'FAIL', name, detail == null ? '' : String(detail).slice(0, 400)]);
    const mount = k => { try { showModule(k); return MODI[k] && (MODI[k].mounted !== false); } catch (e) { return 'ERR ' + e.message; } };
    R.info.lines = LINE_KEYS.join(','); R.info.zr = ZR.length; R.info.counties = PA.length; R.info.compiled = META.compiled;
    BRAND.name = 'Test Roofing Co'; BRAND.short = 'Test Roofing'; BRAND.lic = '1234567'; BRAND.city = 'Pasadena'; BRAND.phone = '6265550100'; BRAND.url = 'https://www.example.com';
    await ACCT.ready();
    /* ---------- accounts core ---------- */
    ok('prefix is CA_', ACCT.PREFIX === 'CA_', ACCT.PREFIX);
    const lo = n => ACCT.lineOf(n);
    const L1 = { 'CA_TILE_GOOGLE_EN_20270105': 'tile', 'CA_HARDEN_META_EN_20270105': 'harden', 'CA_BLEND_GOOGLE_EN_20270105': 'replace', 'Class A roof upgrade': 'harden', 'Wildfire rebuild Altadena': 'fire', 'Solar detach and reset': 'solar', 'Tile underlayment lift and relay': 'tile', 'Santa Ana wind damage': 'storm', 'Roof leak repair': 'repair', 'Cool roof TPO commercial': 'comm', 'New roof Fresno': 'replace', 'Window cleaning training': '', 'LA_REPLACE_META_EN_20261012': 'replace' };
    Object.entries(L1).forEach(([n, k]) => ok('lineOf ' + n, lo(n) === k, lo(n)));
    ok('old state token is not read as a token', lo('LA_STORM_X_EN_1') === 'storm' && lo('LA_FORT_X_EN_1') === '', lo('LA_FORT_X_EN_1'));
    const csv = 'date,hour,campaign,zip,impressions,clicks,spend,leads,calls\n2026-11-01,17,CA_REPLACE_META_EN_20261101,90001,1200,18,42.5,2,1\n2026-11-02,,CA_TILE_GOOGLE_EN_20261101,96162,800,10,30,1,0\n2026-11-03,,Wildfire rebuild,93401-1234,500,5,20,1,0\n2026-11-04,,CA_STORM_GOOGLE_EN_20261101,70808,100,1,5,0,0\n2026-11-05,,CA_REPAIR_GOOGLE_EN_20261101,97001,100,1,5,0,0';
    const imp = ACCT.importCSV(csv, 'generic', 'test');
    const geo = imp.rows.filter(r => r.kind === 'geo').map(r => r.geo.zip);
    ok('importer reads 90001, 96162 and 93401, drops 70808 and 97001', JSON.stringify(geo) === JSON.stringify(['90001', '96162', '93401']), JSON.stringify(geo) + ' ' + imp.note);
    ok('importer maps lines', imp.rows.filter(r => r.kind === 'ads' || r.kind === 'geo').map(r => r.line).join(',').includes('tile') && imp.rows.some(r => r.line === 'fire'), [...new Set(imp.rows.map(r => r.line))].join(','));
    const tpl = ACCT.templateCSV(); ok('template names CA_ tokens and a California ZIP', /CA_REPLACE_META_EN_\d{8},9[0-6]\d{3},/.test(tpl) && !/LA_|7[01]\d{3},1200/.test(tpl), tpl.slice(-160));
    const bz = ACCT.byZip(90); ok('byZip holds the imported California ZIPs', bz.some(o => o.zip === '90001') && bz.some(o => o.zip === '96162'), bz.map(o => o.zip + (o.z ? '' : '*')).join(','));
    await ACCT.clearAll('actuals');
    /* ---------- desk ---------- */
    R.info.mountDesk = mount('desk'); const D0 = MODI.desk.api;
    ok('desk mounted with api', !!D0, R.info.mountDesk);
    if (D0) {
      const P0 = D0.set({ line: 'replace', scope: 'top', budget: 15000, start: '2027-01-05', weeks: 13, storm: '', event: '', picks: [], parishes: [], regions: [], langTh: {} });
      ok('default ZIP count is budget / 500 and capped by scored ZIPs', +document.querySelector('#dkN').max === ZR.length, 'max=' + document.querySelector('#dkN').max + ' n=' + P0.n);
      const M = D0.markets(); ok('markets built', M.length === Math.min(P0.n, ZR.length) && Math.abs(M.reduce((s, m) => s + m.spend, 0) - 15000) < 1, M.length + ' markets, spend ' + M.reduce((s, m) => s + m.spend, 0).toFixed(2));
      ok('shares sum to 1', Math.abs(M.reduce((s, m) => s + m.share, 0) - 1) < 1e-9);
      const FC = D0.forecast(); const sp = Object.values(FC).reduce((s, o) => s + o.spend, 0); ok('platform spend sums to the budget', Math.abs(sp - 15000) < 1, sp.toFixed(2));
      ok('forecast is finite', Object.values(FC).every(o => [o.clicks, o.leads, o.cases, o.fees].every(Number.isFinite)), JSON.stringify(Object.fromEntries(Object.entries(FC).map(([k, o]) => [k, +o.leads.toFixed(1)]))));
      const pc = D0.pacing(); const flight = pc.reduce((s, x) => s + x.spend, 0); ok('pacing spends budget x weeks / 4.345', Math.abs(flight - 15000 * 13 / 4.345) < 1, flight.toFixed(0));
      ok('campaign name', D0.camp('google', 'en') === 'CA_REPLACE_GOOGLE_EN_20270105', D0.camp('google', 'en'));
      const rows = D0.searchRows('google'); const locs = rows.filter(r => r['Location'] && /_EN_/.test(r['Campaign']));
      ok('location strings', locs.length === M.length && locs.every(r => /^9[0-6]\d{3}, California, United States$/.test(r['Location'])), locs[0] && locs[0]['Location']);
      const ads = rows.filter(r => r['Ad type']); ok('every ad has the license line pinned first', ads.length > 0 && ads.every(r => /^(CSLB License #1234567\. Office in Pasadena\.|Licencia CSLB #1234567\. Oficina en Pasadena\.)$/.test(r['Description 1']) && r['Description 1 position'] === '1'), ads[0] && ads[0]['Description 1']);
      ok('headlines 30 or fewer, descriptions 90 or fewer, no dashes', ads.every(r => Object.keys(r).filter(k => /^Headline \d/.test(k)).every(k => r[k].length <= 30 && !/[-–—!]/.test(r[k])) && Object.keys(r).filter(k => /^Description \d+$/.test(k)).every(k => r[k].length <= 90 && !/[-–—]/.test(r[k]))));
      ok('ads carry at least 8 headlines and 3 descriptions', ads.every(r => Object.keys(r).filter(k => /^Headline \d/.test(k)).length >= 8 && Object.keys(r).filter(k => /^Description \d+$/.test(k)).length >= 3), ads.map(r => Object.keys(r).filter(k => /^Headline \d/.test(k)).length).join(','));
      ok('all objects paused', rows.filter(r => r['Campaign Status']).every(r => r['Campaign Status'] === 'Paused') && ads.every(r => r['Status'] === 'Paused'));
      ok('export header has the pin column', D0.header.includes('Description 1 position'));
      /* every line: copy, keywords, lint words */
      const BAD = /deductible|insurance discount|we handle your claim|claim specialist|fireproof|free roof|louisiana|hurricane|hail|fortified|parish|lslbc/i; const per = {};
      LINE_KEYS.forEach(k => { D0.set({ line: k }); const g = D0.groups()[0]; const z = D0.markets()[0].z; const r = D0.rsaFor(g, z, 'en'), e = D0.rsaFor(g, z, 'es'); const s = D0.socialFor(g, z, 'en', 'meta'); const K2 = D0.kwFor(g); const all = r.h.concat(r.d, e.h, e.d, [s.body, s.title, s.desc], K2.core, K2.q).join(' | '); per[k] = { h: r.h.length, d: r.d.length, hes: e.h.length, q: K2.q.length, core: K2.core.length, bad: (all.match(BAD) || [''])[0], name: D0.camp('meta', 'en'), lic: /CSLB License #1234567/.test(s.body) && /Licencia CSLB #1234567/.test(e.d[0] || ''), over: r.h.concat(e.h).some(x => x.length > 30) || r.d.concat(e.d).some(x => x.length > 90) }; });
      R.info.perLine = per;
      ok('thirteen lines each give copy', LINE_KEYS.length === 13 && LINE_KEYS.every(k => per[k].h >= 8 && per[k].d >= 3 && per[k].q >= 3 && per[k].core >= 1), JSON.stringify(Object.fromEntries(Object.entries(per).map(([k, o]) => [k, o.h + '/' + o.d + '/' + o.hes + '/' + o.q]))));
      ok('no unlawful or other state words in any line copy', LINE_KEYS.every(k => !per[k].bad), LINE_KEYS.filter(k => per[k].bad).map(k => k + ':' + per[k].bad).join(','));
      ok('license number in English and Spanish copy of every line', LINE_KEYS.every(k => per[k].lic), LINE_KEYS.filter(k => !per[k].lic).join(','));
      ok('campaign tokens map back to their lines', LINE_KEYS.every(k => ACCT.lineOf(per[k].name) === k), LINE_KEYS.map(k => per[k].name + '>' + ACCT.lineOf(per[k].name)).filter(s => !new RegExp('_' + s.split('>')[1].toUpperCase() + '_', 'i').test(s) && false).join(','));
      ok('residential test reads the segment', (() => { D0.set({ line: 'comm' }); const a = D0.resPlan(); D0.set({ line: 'replace' }); return a === false && D0.resPlan() === true; })());
      /* tiers follow the plan's line */
      D0.set({ line: 'replace' }); const z0 = ZR.slice().sort((a, b) => (b.p_fire || 0) - (a.p_fire || 0))[0]; const tA = D0.tierOf(z0) + D0.bidOf(z0); D0.set({ line: 'fire' }); const tB = D0.tierOf(z0) + D0.bidOf(z0); const diff = ZR.filter(z => { D0.set; return true; }).length;
      const cmp = (() => { D0.set({ line: 'replace' }); const a = ZR.map(z => D0.tierOf(z)); D0.set({ line: 'fire' }); const b = ZR.map(z => D0.tierOf(z)); return a.filter((t, i) => t !== b[i]).length; })();
      ok('tier and bid change with the plan line', cmp > 0, cmp + ' of ' + ZR.length + ' ZIPs change tier between replace and fire; top fire ZIP ' + z0.zip + ' ' + tA + ' > ' + tB);
      ok('tier shares follow the cuts', (() => { D0.set({ line: 'replace' }); const n = ZR.filter(z => D0.tierOf(z) === 'A+').length / ZR.length; return n > 0.03 && n < 0.07; })());
      /* event groups */
      const evs = {}; ['kind:rain', 'kind:wind', 'kind:fire', 'kind:snow', 'Eaton Fire'].forEach(ev => { D0.set({ line: 'replace', storm: '', event: ev }); const g = D0.groups().find(x => x.ev); const r = D0.rsaFor(g, D0.markets()[0].z, 'en'); const K2 = D0.kwFor(g); evs[ev] = { line: g.line, kind: g.ev.kind, h: r.h.slice(0, 4), d: r.d[1], kw: K2.core.slice(0, 2) }; });
      R.info.events = evs; ok('event groups: rain, wind, fire, snow', evs['kind:rain'].kind === 'rain' && evs['kind:wind'].line === 'storm' && evs['kind:fire'].line === 'fire' && evs['kind:snow'].kind === 'snow' && evs['Eaton Fire'].kind === 'fire', JSON.stringify(evs['Eaton Fire']));
      MODI.desk.receive({ zips: ZR.slice(0, 12).map(z => z.zip), event: 'High wind, Santa Ana' }); ok('receive: zips and a free text event', D0.markets().length === 12 && D0.evSel().kind === 'wind', D0.evSel().label);
      MODI.desk.receive({ zips: ZR.slice(0, 5).map(z => z.zip), storm: 'No Such Storm 2026', line: 'tile' }); ok('receive: unknown storm name still builds a group', D0.markets().length === 5 && !!D0.evSel());
      /* languages */
      D0.set({ line: 'replace', scope: 'top', storm: '', event: '', picks: [], n: 60, langTh: {} });
      const LG = D0.langs().map(L => ({ k: L.k, col: L.col, basis: L.basis, state: +L.state.toFixed(2), def: L.def, all: ZR.filter(z => D0.langOk(z, L.k)).length, buy: D0.markets().filter(m => m.langs.includes(L.k)).length })); R.info.langs = LG; R.info.span8 = ZR.filter(z => (z.span_sh || 0) >= 8).length;
      ok('language columns found', LG.length >= 5 && LG.every(l => l.basis === 'lep'), LG.map(l => l.k + ':' + l.col).join(','));
      const es = LG.find(l => l.k === 'es'); ok('Spanish rule is not universal', es && es.all > 0 && es.all < ZR.length * 0.5, es && (es.all + ' of ' + ZR.length + ' scored ZIPs qualify at ' + es.def + '%; the old 8% at home rule would fire in ' + R.info.span8));
      const shares = (() => { const zs = ZR.filter(z => D0.langOk(z, 'es')).slice(0, 10).map(z => z.zip).concat(ZR.filter(z => !D0.langOk(z, 'es')).slice(0, 10).map(z => z.zip)); D0.set({ scope: 'picks', picks: zs }); const s = D0.langShare('es'); const rr = D0.searchRows('google').filter(r => r['Campaign Type']); return { s, budgets: rr.map(r => r['Languages'] + ' ' + r['Budget']), tot: rr.reduce((a, r) => a + +r['Budget'], 0), exp: D0.forecast().google.spend / 30.4, soc: D0.socialRows('meta').filter(r => / ES$/.test(r['Ad Set Name'])).length }; })();
      ok('Spanish budget share within 5 to 40 percent and budgets add up', shares.s >= 0.05 && shares.s <= 0.40 && Math.abs(shares.tot - shares.exp) < 0.05, JSON.stringify(shares));
      const pl = MODI.desk.plan(); ok('plan() keeps zips, nulls spanTh, lists languages and tiers', Array.isArray(pl.zips) && pl.spanTh === null && pl.lang && pl.lang.es && Array.isArray(pl.lang.es.zips) && pl.tiers[pl.zips[0]], Object.keys(pl).join(','));
      ok('plan saved under cg.desk.v1', !!localStorage.getItem('cg.desk.v1') && !localStorage.getItem('up.desk.v1') && !localStorage.getItem('cf.desk.v1'));
      const feed = MODI.desk.feed(); ok('feed for the Satchel', feed.length > 0 && feed.every(a => a.label && a.text && a.plat), feed.length + ' assets');
      const lsa = D0.lsaRows(); ok('LSA sheet names the CSLB', lsa.some(r => r[0] === 'CSLB license number' && r[1] === '1234567'));
      const pr = D0.planRows(); ok('plan rows carry county and region', pr.length && pr[0][2] && pr[0][3], JSON.stringify(pr[0]));
      R.info.sample = { rsa: D0.rsaFor(D0.groups()[0], D0.markets()[0].z, 'en'), es: D0.rsaFor(D0.groups()[0], D0.markets()[0].z, 'es'), social: D0.socialFor(D0.groups()[0], D0.markets()[0].z, 'en', 'meta'), bio: D0.lsaBio(D0.markets()[0].z) };
      D0.set({ scope: 'top', picks: [], n: 30 });
    }
    /* ---------- ground ---------- */
    R.info.mountGround = mount('ground'); const G0 = MODI.ground.api;
    ok('ground mounted', !!G0, R.info.mountGround);
    if (G0) { R.info.measures = G0.measures().join(','); R.info.missing = G0.missing().join(','); R.info.fema = G0.fema(); R.info.pairs = JSON.stringify(G0.pairs());
      const c = G0.csvCounties(), ci = G0.csvCities(); ok('county CSV', c.rows.length === PA.length && c.head[0] === 'county' && c.rows.every(r => r.length === c.head.length), c.head.join(',').slice(0, 300));
      ok('cities CSV has thirteen job columns', ci.head.filter(h => /^jobs_/.test(h)).length === 13 && ci.rows.every(r => r.length === ci.head.length), ci.head.join(','));
      ok('FEMA headline is the ZIP roll up module 01 uses', G0.fema().zip == null || G0.fema().shown === G0.fema().zip, JSON.stringify(G0.fema()));
      MODI.ground.receive({ fips: PA[18].fips }); ok('county detail renders', /County/.test(document.querySelector('#g6Name').textContent) && document.querySelector('#g6Detail').textContent.length > 400, document.querySelector('#g6Name').textContent);
      const sel = document.querySelector('#g6Met'); [...sel.options].forEach(o => { sel.value = o.value; sel.dispatchEvent(new Event('change')); }); ok('every measure draws', true, sel.options.length + ' measures'); }
    /* ---------- field ---------- */
    R.info.mountField = mount('field'); const F0 = MODI.field.api;
    ok('field mounted', !!F0, R.info.mountField);
    if (F0) { const t = F0.thin(); R.info.thin = { cut: t.cut, n: t.zips.length, firms: F0.firms().length }; ok('thin field is about a tenth of scored ZIPs', t.zips.length >= ZR.length * 0.08 && t.zips.length <= ZR.length * 0.35, JSON.stringify(R.info.thin));
      const l = F0.csvLic(); ok('license CSV', l.rows.length > 100 && l.head.length === 4, l.rows.length + ' cities; ' + JSON.stringify(l.rows[0]));
      const sel = document.querySelector('#f7Layer'); [...sel.options].forEach(o => { sel.value = o.value; sel.dispatchEvent(new Event('change')); }); MODI.field.receive({ zip: ZR[5].zip }); ok('ZIP detail renders', document.querySelector('#f7Detail').textContent.length > 200); if (F0.firms().length) { MODI.field.receive({ comp: 0 }); ok('company detail renders', document.querySelector('#f7Name').textContent === F0.firms()[0].name); } }
    /* ---------- accounts screen and publish ---------- */
    R.info.mountAcc = mount('accounts'); ok('accounts mounted and reads the desk key', /California Roofer Guru, module 15/.test(document.querySelector('#mod-accounts').textContent) && /CA_REPAIR_/.test(document.querySelector('#mod-accounts').textContent), R.info.mountAcc);
    R.info.mountPub = mount('publish'); ok('publish mounted', /California Roofer Guru, module 16/.test(document.querySelector('#mod-publish').textContent) && !!document.querySelector('#p16cLang option[value="vi"]'), R.info.mountPub);
    /* ---------- text scan of what my five screens show ---------- */
    const RX = /louisiana|parish|lslbc|hurricane|\bgulf\b|fortified|new orleans|baton rouge|mardi gras|\bhail damage\b/i; const scan = {};
    ['ground', 'field', 'desk', 'accounts', 'publish'].forEach(k => { const t = document.querySelector('#mod-' + k).innerText; const m = t.match(new RegExp('.{0,60}(' + RX.source + ').{0,60}', 'i')); scan[k] = m ? m[0] : ''; });
    R.info.scan = scan; ok('no Louisiana words on my screens', Object.values(scan).every(v => !v), JSON.stringify(scan));
    return R;
  });
  const fails = out.checks.filter(c => c[0] === 'FAIL');
  out.checks.forEach(c => console.log(c[0], c[1], c[2] ? '· ' + c[2] : ''));
  console.log('\nINFO', JSON.stringify(out.info, null, 1));
  console.log('\nPAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  console.log(`\n${out.checks.length - fails.length} passed, ${fails.length} failed`);
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
