"""Louisiana's regression suites, ported one for one to California addresses.
   python3 -I port_suites.py      reads SP/tests and SP/review, writes CA/scout/tests/la_port/<name>.js
   Each port is the Louisiana file with its places, ZIPs, keys and Louisiana-only fields changed by anchored
   replacements (each asserted), so what a suite checks stays what Louisiana's checked."""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SP = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
def rd(p): return open(os.path.join(SP, p), encoding='utf-8').read()
def port(src, name, reps, also=()):
    s = rd(src)
    for a, b in reps:
        c = s.count(a)
        assert c >= 1, (name, 'anchor not found', a[:80])
        s = s.replace(a, b)
    for pat, b in also: s = re.sub(pat, b, s)
    s = '/* California port of ' + src + ' (CA/scout/tests/la_port/port_suites.py) */\n' + s
    open(os.path.join(HERE, name), 'w', encoding='utf-8').write(s); print('wrote', name, len(s))

HARD = "const __hard = setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(3); }, (+process.env.HARD || 14) * 60000);\n"
# ---- smoke.js: mount, three places, parcels and permits, the card ----
port('tests/smoke.js', 'smoke.js', [
  ("/* Smoke test for the Louisiana Rooftop Scout", "/* Smoke test for California's Rooftop Scout"),
  ("  { name: 'baton-rouge-woodgate', lat: 30.3859, lon: -91.1431, z: 18 },\n  { name: 'new-orleans-bayou-st-john', lat: 29.9716, lon: -90.0829, z: 18 },\n  { name: 'lafayette-marilyn-dr', lat: 30.1955, lon: -92.0555, z: 18 },",
   "  { name: 'los-angeles-hollywood', lat: 34.1008, lon: -118.3362, z: 18 },\n  { name: 'san-francisco-mission', lat: 37.7570, lon: -122.4187, z: 18 },\n  { name: 'sacramento-midtown', lat: 38.5763, lon: -121.4767, z: 18 },"),
  ("(async () => {\n  const proxy", HARD + "(async () => {\n  const proxy"),
  ("viewport: { width: 1500, height: 1100 }", "viewport: { width: 1280, height: 900 }"),
  ("timeout: 120000 });\n  await page.waitForTimeout(1500);", "timeout: 240000 });\n  await page.waitForTimeout(4000);"),
  ("wind: +b.sc.WIND.toFixed(3), hail: +b.sc.HAIL.toFixed(3),", "wind: +(b.sc.WIND || 0).toFixed(3), hail: +(b.sc.HAIL || 0).toFixed(3), fire: b.sc.FIRE != null ? +(+b.sc.FIRE).toFixed(3) : undefined, fhsz: b.fhsz ? b.fhsz.l : '',"),
  ("storms: (b.state.storms || []).map(s => SIDS[s.si][0] + ' ' + s.y + ' ' + s.share.toFixed(2)).join(', '),", "resets: (b.state.storms || b.state.resets || []).length,"),
  ("  await browser.close();\n})().catch", "  await browser.close(); clearTimeout(__hard);\n})().catch"),
])
# ---- smoke2.js: search, CSV, AI detail, the 3D view, glTF, hand-offs ----
port('tests/smoke2.js', 'smoke2.js', [
  ("(async () => {\n  const proxy", HARD + "(async () => {\n  const proxy"),
  ("viewport: { width: 1500, height: 1100 }", "viewport: { width: 1280, height: 900 }"),
  ("timeout: 120000 });\n  await wait(1500);", "timeout: 240000 });\n  await wait(4000);"),
  ("'632 Woodgate Blvd, Baton Rouge, LA'", "'2300 J St, Sacramento, CA'"),
  ("'10-search-woodgate.png'", "'10-search-sacramento.png'"),
  ("goModule('rooftops', { zip: '70119' })", "goModule('rooftops', { zip: '95816' })"),
  ("'14-zip-70119.png'", "'14-zip-95816.png'"),
  ("  await browser.close();\n})().catch", "  await browser.close(); clearTimeout(__hard);\n})().catch"),
])
# ---- layout.js: phone and desk, dark: nothing wider than the window (California adds 1280 and 1024) ----
port('tests/layout.js', 'layout.js', [
  ("for (const [name, vp, theme] of [['phone-dark', { width: 390, height: 844 }, 'dark'], ['desktop-dark', { width: 1400, height: 1000 }, 'dark']]) {",
   "for (const [name, vp, theme] of [['phone-dark', { width: 390, height: 844 }, 'dark'], ['desktop-dark', { width: 1400, height: 1000 }, 'dark'], ['w1280-light', { width: 1280, height: 900 }, 'light'], ['w1024-light', { width: 1024, height: 800 }, 'light']]) {"),
  ("MODI.rooftops.api.goTo(29.9716, -90.0829, 18)", "MODI.rooftops.api.goTo(37.7570, -122.4187, 18)"),
  ("timeout: 120000 });\n    await page.waitForTimeout(1500);", "timeout: 240000 });\n    await page.waitForTimeout(4000);"),
  ("const over = await page.evaluate(() => ({ docW: document.documentElement.scrollWidth, winW: window.innerWidth,", "const over = await page.evaluate(() => ({ docW: document.documentElement.scrollWidth, winW: window.innerWidth, wide: [...document.querySelectorAll('#mod-rooftops *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && !e.closest('.leaflet-container, .sc-3d, table, .tablewrap, [style*=\"overflow\"]'); }).map(e => (e.id || e.className || e.tagName) + '').slice(0, 6),"),
])
# ---- scout_open.js ----
port('review/r6check/edgecases/scout_open.js', 'scout_open.js', [
  ("require('./h.js')", "require('" + SP + "/review/r6check/edgecases/h.js')"),
])

# ---- keys_test.js: California's keys are cg.*; nothing under Louisiana's or Contraflow's keys is read, copied or made ----
port('tests/r6/keys_test.js', 'keys_test.js', [
  ("/* the storage key fixes in a real page:", "/* California: the atlas's stores are under cg.* and take NOTHING from the Louisiana atlas's up.* keys or the older cf.* keys\n   (the brief: no fallbacks to old keys). Where Louisiana's suite checked the one-time copy from cf.*, this checks there is none.\n   the storage key fixes in a real page:"),
  ("await page({ 'up.desk.v1': { budget: 22222 }, 'cf.desk.v1': { budget: 99999 } }, '#accounts');", "await page({ 'cg.desk.v1': { budget: 22222 }, 'up.desk.v1': { budget: 88888 }, 'cf.desk.v1': { budget: 99999 } }, '#accounts');"),
  ("ok(/22,222/.test(t) && !/99,999/.test(t),", "ok(/22,222/.test(t) && !/99,999/.test(t) && !/88,888/.test(t),"),
  ("const d = await get(p, 'up.desk.v1'); ok(d && +d.budget > 0, 'the Campaign Desk saves its plan under up.desk.v1 with a budget: ' + (d && d.budget));", "const d = await get(p, 'cg.desk.v1'); ok(d && +d.budget > 0, 'the Campaign Desk saves its plan under cg.desk.v1 with a budget: ' + (d && d.budget));"),
  ("const d = JSON.parse(localStorage.getItem('up.desk.v1')); d.budget = 31313; localStorage.setItem('up.desk.v1', JSON.stringify(d));", "const d = JSON.parse(localStorage.getItem('cg.desk.v1')); d.budget = 31313; localStorage.setItem('cg.desk.v1', JSON.stringify(d));"),
  ("await page({ 'up.desk.v1': { budget: 22222 } }, '#accounts');", "await page({ 'cg.desk.v1': { budget: 22222 } }, '#accounts');"),
  ("    const d = await get(p, 'up.desk.v1');\n", "    const d = await get(p, 'cg.desk.v1');\n"),
  ("/* 2. accounts and CMS: the first read copies the old key; the old key is left as it was */", "/* 2. accounts and CMS: old keys (Louisiana's up.*, Contraflow's cf.*) are not read and not copied; they are left as they were */"),
  ("await page({ 'cf.accounts.v1': oldAcct, 'cf.cms.v1': oldCms, 'cf.publish.composer': { title: 'Seeded draft title' } }, '#publish');", "await page({ 'cf.accounts.v1': oldAcct, 'up.accounts.v1': oldAcct, 'cf.cms.v1': oldCms, 'up.cms.v1': oldCms, 'cf.publish.composer': { title: 'Seeded draft title' }, 'up.publish.composer': { title: 'Seeded draft title' } }, '#publish');"),
  ("ok(JSON.stringify(await get(p, 'up.accounts.v1')) === JSON.stringify(oldAcct), 'accounts copied to up.accounts.v1 on the first read');", "{ const mine = await get(p, 'cg.accounts.v1'); ok(!mine || !(mine.cfg && mine.cfg.meta && mine.cfg.meta.adAccount), 'nothing copied to cg.accounts.v1 from the old keys'); ok(JSON.stringify(await get(p, 'up.accounts.v1')) === JSON.stringify(oldAcct), 'up.accounts.v1 left as it was'); }"),
  ("ok(await p.evaluate(() => ACCT.cfg('meta').adAccount) === 'act_123', 'the Accounts store holds the copied settings');", "ok(await p.evaluate(() => (ACCT.cfg('meta') || {}).adAccount) !== 'act_123', 'the Accounts store does not hold the other atlas\\'s settings');"),
  ("ok(JSON.stringify(await get(p, 'up.cms.v1')) === JSON.stringify(oldCms), 'CMS settings copied to up.cms.v1 on the first read');", "{ const mine = await get(p, 'cg.cms.v1'); ok(!mine || !(mine.cfg && mine.cfg.wp_headless && mine.cfg.wp_headless.siteUrl), 'nothing copied to cg.cms.v1 from the old keys'); }"),
  ("ok(await p.evaluate(() => CMS.cfg('wp_headless').siteUrl) === 'https://www.example.com', 'the CMS store holds the copied settings');", "ok(await p.evaluate(() => (CMS.cfg('wp_headless') || {}).siteUrl) !== 'https://www.example.com', 'the CMS store does not hold the other atlas\\'s settings');"),
  ("ok(await p.$eval('#p16cTitle', e => e.value) === 'Seeded draft title', 'the Publish composer shows the draft saved under the old key');", "ok(await p.$eval('#p16cTitle', e => e.value) !== 'Seeded draft title', 'the Publish composer does not show a draft saved under an old key');"),
  ("const up = await get(p, 'up.publish.composer'), cf = await get(p, 'cf.publish.composer');", "const up = await get(p, 'cg.publish.composer'), cf = await get(p, 'cf.publish.composer'), lou = await get(p, 'up.publish.composer');"),
  ("ok(up && up.title === 'New roofing draft', 'the composer saves under up.publish.composer: ' + (up && up.title));", "ok(up && up.title === 'New roofing draft', 'the composer saves under cg.publish.composer: ' + (up && up.title)); ok(lou && lou.title === 'Seeded draft title', 'up.publish.composer left as it was');"),
  ("ok((await get(p, 'up.accounts.v1')).settings.range === 7 && (await get(p, 'cf.accounts.v1')).settings.range === 30, 'an Accounts change writes up.accounts.v1 only');", "ok((await get(p, 'cg.accounts.v1')).settings.range === 7 && (await get(p, 'cf.accounts.v1')).settings.range === 30 && (await get(p, 'up.accounts.v1')).settings.range === 30, 'an Accounts change writes cg.accounts.v1 only');"),
  ("/* 2b. the composer copies the old key's draft once: a later draft the other atlas saves under that key does not show here */", "/* 2b. a draft the other atlases save under their keys never shows here */"),
  ("await page({ 'cf.publish.composer': { title: 'Roof replacement in Lafayette' } }, '#publish');", "await page({ 'cf.publish.composer': { title: 'Roof replacement in Lafayette' }, 'up.publish.composer': { title: 'Roof replacement in Lafayette' } }, '#publish');"),
  ("    const up0 = await get(p, 'up.publish.composer');\n    ok(up0 && up0.title === 'Roof replacement in Lafayette', 'the first Publish visit copies the old draft to up.publish.composer');", "    const up0 = await get(p, 'cg.publish.composer');\n    ok(!up0 || up0.title !== 'Roof replacement in Lafayette', 'the first Publish visit copies no old draft to cg.publish.composer');"),
  ("ok(await p.$eval('#p16cTitle', e => e.value) === 'Roof replacement in Lafayette', 'a later draft of the other atlas under the old key does not show here');", "ok(!/Lafayette|Baton Rouge/.test(await p.$eval('#p16cTitle', e => e.value)), 'a draft of another atlas under an old key does not show here');"),
  ("await page({ 'up.accounts.v1': Object.assign({}, oldAcct, { cfg: { meta: { adAccount: 'act_ROOF' } } }), 'cf.accounts.v1': oldAcct, 'up.cms.v1': Object.assign({}, oldCms, { cfg: { wp_headless: { url: 'https://wp.roof.example', siteUrl: 'https://roof.example' } } }), 'cf.cms.v1': oldCms, 'up.publish.composer': { title: 'Roof draft' }, 'cf.publish.composer': { title: 'Law draft' } }, '#publish');",
   "await page({ 'cg.accounts.v1': Object.assign({}, oldAcct, { cfg: { meta: { adAccount: 'act_ROOF' } } }), 'cf.accounts.v1': oldAcct, 'up.accounts.v1': oldAcct, 'cg.cms.v1': Object.assign({}, oldCms, { cfg: { wp_headless: { url: 'https://wp.roof.example', siteUrl: 'https://roof.example' } } }), 'cf.cms.v1': oldCms, 'up.cms.v1': oldCms, 'cg.publish.composer': { title: 'Roof draft' }, 'cf.publish.composer': { title: 'Law draft' }, 'up.publish.composer': { title: 'Louisiana draft' } }, '#publish');"),
  ("ok(!keys.some(k => k.startsWith('cf.')), 'a fresh browser gets no cf. keys: ' + keys.join(', '));", "ok(!keys.some(k => k.startsWith('cf.') || k.startsWith('up.')), 'a fresh browser gets no cf. or up. keys: ' + keys.join(', ')); ok(keys.every(k => k.startsWith('cg.') || !/\\.(v1|composer)$/.test(k)), 'every store of the atlas is under cg.: ' + keys.join(', '));"),
  ("timeout: 120000 });\n  await p.waitForTimeout(2500);", "timeout: 240000 });\n  await p.waitForTimeout(4000);"),
])
# ---- unscored.js and mapclick.js: a ZIP under 500 residents (Mt Baldy, 91759: 341 residents); a scored one (Sacramento 95816) ----
port('tests/r7/unscored.js', 'unscored.js', [("process.argv[3] || '70038'", "process.argv[3] || '91759'")])
port('tests/r7/mapclick.js', 'mapclick.js', [("process.argv[3] || '70038'", "process.argv[3] || '91759'"), ("'70503'", "'95816'")])
# ---- inj8.js and inj_sk.js: synthetic permits added to the live City of Los Angeles answer in Hollywood ----
ROUTE_OLD = "await p.route(/data\\.nola\\.gov\\/resource\\/rcm3-fn58\\.json/, async route => {"
ROUTE_NEW = "await p.route(/data\\.lacity\\.org\\/resource\\/pi9x-tg5x\\.json/, async route => {"
P4 = """const P = [
  { tag: 'A house and garage (want 0.9+)', d: '2015-06-15', text: 'Re-roof main dwelling and detached garage with Class A composition shingles over existing solid sheathing, 32 squares.' },
  { tag: 'B garage only (want <= 0.2)', d: '2015-06-15', text: 'Re-roof detached garage only' },
  { tag: 'C wind damage (want 0.9+)', d: '2015-06-15', text: 'Remove existing roof damaged by wind storm and install new Class A roof covering over new solid sheathing 24 Squares' },
  { tag: 'D addition with new roof (want <= 0.5)', d: '2015-06-15', text: 'Construct single story rear addition with new roof to match existing.' },
];
const P_OLD_UNUSED = ["""
port('review/r8check/permit18/inj8.js', 'inj8.js', [
  ("/* drive #rooftops in Bayou St. John: add four synthetic New Orleans permits", "/* drive #rooftops in Hollywood: add four synthetic City of Los Angeles permits"),
  ("LA = 29.9716, LO = -90.0829", "LA = 34.1008, LO = -118.3362"),
  (ROUTE_OLD, ROUTE_NEW),
  ("j.push({ address: '', type: q.type, code: q.code, issuedate: q.d + 'T00:00:00.000', filingdate: q.d + 'T00:00:00.000', currentstatus: 'Permit Issued', description: q.text, constrval: '45000', location_1: { latitude: String(b.lat), longitude: String(b.lon) } }); hits++; });",
   "j.push({ primary_address: '', permit_type: 'Bldg-Alter/Repair', permit_sub_type: '1 or 2 Family Dwelling', issue_date: q.d + 'T00:00:00.000', status_desc: 'Issued', valuation: '45000', work_desc: q.text, lat: String(b.lat), lon: String(b.lon), apn: '' }); hits++; });"),
], also=[(r"const P = \[\n(?:.*\n)*?\];\nconst P_OLD = \[", lambda m: P4)])
P8 = P4.replace("const P_OLD_UNUSED = [", "").rstrip().rstrip(';').rstrip(']') + """  { tag: 'E tile lift and relay (want 0.9+)', d: '2019-03-11', text: 'Remove existing roof tiles, apply new underlayment and reset roof tiles (Cool roof compliance is not required)' },
  { tag: 'F partial, 6 squares (want 0.3 to 0.5)', d: '2019-03-11', text: 'Partial reroof of rear section, 6 squares' },
  { tag: 'G solar only (want <= 0.15)', d: '2019-03-11', text: 'Install 5.2 kW roof mounted solar photovoltaic system, 14 modules' },
  { tag: 'H remodel, roof patch (want <= 0.45)', d: '2019-03-11', text: 'Kitchen and bath remodel; replace 2 windows; patch roof at new vent' },
];
"""
port('review/r8check/permits8_skeptic/inj_sk.js', 'inj_sk.js', [
  ("in #rooftops (Bayou St. John) add eight synthetic New Orleans permits", "in #rooftops (Hollywood) add eight synthetic City of Los Angeles permits"),
  ("LA = 29.9716, LO = -90.0829", "LA = 34.1008, LO = -118.3362"),
  (ROUTE_OLD, ROUTE_NEW),
], also=[(r"const P = \[\n(?:.*\n)*?\];\n", lambda m: P8, ), (r"j\.push\(\{ address: ''.*?\}\); hits\+\+;", lambda m: "j.push({ primary_address: '', permit_type: 'Bldg-Alter/Repair', permit_sub_type: '1 or 2 Family Dwelling', issue_date: (q.d || '2015-06-15') + 'T00:00:00.000', status_desc: 'Issued', valuation: '45000', work_desc: q.text, lat: String(b.lat), lon: String(b.lon), apn: '' }); hits++;")])

# ---- r11_smoke.js: the bar's rows, the views, the rain scale from its slider, the Alta X refused, a warp from the bar's box ----
SET_OLD = "const s = document.querySelector('#scEnStorm'); s.value = %d; s.dispatchEvent"
port('tests/r11/r11_smoke.js', 'r11_smoke.js', [
  ("'632 Woodgate Blvd, Baton Rouge, LA'", "'2300 J St, Sacramento, CA'"),
  ("(async () => {\n  const proxy", HARD + "(async () => {\n  const proxy"),
  ("timeout: 180000 }); await wait(1500);", "timeout: 240000 }); await wait(4000);"),
  ("en.setGraphics({ q, sun: 15, weather: 'clear', life: false });", "en.setGraphics({ q, sun: 15, weather: 'clear', life: false, wide: false, trees: false });"),
  (SET_OLD % 7, "const s = document.querySelector('#scEnRain'); s.value = 7; s.dispatchEvent"),
  (SET_OLD % 2, "const s = document.querySelector('#scEnRain'); s.value = 2; s.dispatchEvent"),
  ("console.log('scale at 7:'", "console.log('rain scale at 7 (AR4):'"),
  ("console.log('storm view in heavy rain:'", "console.log('weather view in steady rain:'"),
  ("console.log('Alta X pressed in heavy rain:'", "console.log('Alta X pressed in steady rain:'"),
  ("await page.fill('#scWarp', '30.2266, -93.2174');", "await page.fill('#scWarp', '34.1478, -118.1445');"),
  ("surge: g.surge, surgeNote: g.surgeNote, ", "elev: s.elev, ground: s.ground, "),
  ("await page.fill('#scWarp', '32.7767, -96.7970');", "await page.fill('#scWarp', '36.1699, -115.1398');"),
  ("console.log('a warp to Dallas:'", "console.log('a warp to Las Vegas (outside California):'"),
  ("  await browser.close();\n})().catch", "  await browser.close(); clearTimeout(__hard);\n})().catch"),
  ("await wait(8000);\n  console.log('after the warp:'", "await wait(8000); await page.evaluate(() => MODI.rooftops.api.en().storm('dry'));\n  console.log('after the warp:'"),
])
# ---- review_fix_check2.js: the review's scenarios stepped by the engine's own clocks ----
port('tests/r11/review_fix_check2.js', 'review_fix_check2.js', [
  ("'632 Woodgate Blvd, Baton Rouge, LA'", "'2300 J St, Sacramento, CA'"),
  ("(async () => {\n  const proxy", HARD + "(async () => {\n  const proxy"),
  ("timeout: 180000 }); await wait(1500);", "timeout: 240000 }); await wait(4000);"),
  ("en.setHeight('street'); en.storm(5);", "en.setHeight('street'); en.storm('ar2');"),
  ("en.storm(0); let quiet = 0;", "en.storm('dry'); en.wind('calm'); en.sky('none'); let quiet = 0;"),
  ("await browser.close(); process.exit(bad ? 1 : 0);", "await browser.close(); clearTimeout(__hard); process.exit(bad ? 1 : 0);"),
])
# ---- views_unit.js: Louisiana's was arithmetic on its views block (storm replacement by wind, flood depth by distance: gone
#      with the hurricane model). California's roof view arithmetic is checked in the page by ../lens_unit_ca.js. ----
open(os.path.join(HERE, 'views_unit.js'), 'w', encoding='utf-8').write("/* California port of tests/r11/views_unit.js: the roof views' arithmetic. Louisiana's file tested its views block in Node\n   (the laminated share by year, the share of roofs a hurricane's wind replaces, the flood's depth by distance from the\n   surge). The hurricane and surge parts do not exist in California; the rest (laminated share by year, wind damage by\n   gust, fire class, cool roof rule, snow against the design load, the Alta X rule) is checked in the page itself by\n   ../lens_unit_ca.js, which this runs. node views_unit.js <page.html> */\nprocess.argv.splice(2, 0); require('../lens_unit_ca.js');\n")
print('done 3')
