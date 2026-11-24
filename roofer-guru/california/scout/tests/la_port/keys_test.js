/* California port of tests/r6/keys_test.js (CA/scout/tests/la_port/port_suites.py) */
/* California: the atlas's stores are under cg.* and take NOTHING from the Louisiana atlas's up.* keys or the older cf.* keys
   (the brief: no fallbacks to old keys). Where Louisiana's suite checked the one-time copy from cf.*, this checks there is none.
   the storage key fixes in a real page: Accounts pacing reads the Campaign Desk's budget; the accounts, CMS and Publish
   composer stores take this atlas's own keys, copying what the old Contraflow key held on the first read, never touching
   the old key afterwards, and preferring their own key once it exists; Accounts follows a Desk budget change made while it
   was open. node keys_test.js <atlas.html> */
const { chromium } = require('playwright'), path = require('path');
const URL0 = 'file://' + path.resolve(process.argv[2]);
const fails = [], ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails.push(m); };
async function page(seed, hash) {
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } }), p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  /* seed storage once, before the atlas's scripts run */
  await p.addInitScript(s => { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.clear(); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v))); } }, seed);
  await p.goto(URL0 + (hash || ''), { waitUntil: 'load', timeout: 240000 });
  await p.waitForTimeout(4000);
  return { browser, p, errs };
}
const get = (p, k) => p.evaluate(k => { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); }, k);
(async () => {
  /* 1. Accounts pacing reads up.desk.v1, not the Contraflow key */
  { const { browser, p, errs } = await page({ 'cg.desk.v1': { budget: 22222 }, 'up.desk.v1': { budget: 88888 }, 'cf.desk.v1': { budget: 99999 } }, '#accounts');
    await p.waitForSelector('#a15Pace', { timeout: 60000 }); await p.waitForTimeout(1500);
    const t = await p.$eval('#a15Pace', e => e.textContent);
    ok(/22,222/.test(t) && !/99,999/.test(t) && !/88,888/.test(t), 'Accounts pacing uses the Campaign Desk budget: ' + t.slice(0, 120));
    ok(!errs.length, 'no page errors (' + errs.join(' | ') + ')'); await browser.close(); }
  /* 1b. the Campaign Desk, edited in the page, reaches Accounts */
  { const { browser, p, errs } = await page({}, '#desk');
    await p.waitForTimeout(2000);
    const d = await get(p, 'cg.desk.v1'); ok(d && +d.budget > 0, 'the Campaign Desk saves its plan under cg.desk.v1 with a budget: ' + (d && d.budget));
    await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('cg.desk.v1')); d.budget = 31313; localStorage.setItem('cg.desk.v1', JSON.stringify(d)); });
    await p.evaluate(() => { location.hash = '#accounts'; }); await p.waitForSelector('#a15Pace', { timeout: 60000 }); await p.waitForTimeout(1500);
    const t = await p.$eval('#a15Pace', e => e.textContent); ok(/31,313/.test(t), 'Accounts follows a Campaign Desk budget change: ' + t.slice(0, 100));
    ok(!errs.length, 'no page errors (' + errs.join(' | ') + ')'); await browser.close(); }
  /* 1c. Accounts open first, then a Desk budget change in the same session: Accounts follows on its next show */
  { const { browser, p, errs } = await page({ 'cg.desk.v1': { budget: 22222 } }, '#accounts');
    await p.waitForSelector('#a15Pace', { timeout: 60000 }); await p.waitForTimeout(1500);
    const t0 = await p.$eval('#a15Pace', e => e.textContent);
    await p.evaluate(() => { location.hash = '#desk'; }); await p.waitForSelector('#dkBud', { timeout: 60000 }); await p.waitForTimeout(1000);
    await p.fill('#dkBud', '33333'); await p.press('#dkBud', 'Tab'); await p.waitForTimeout(1200);
    const d = await get(p, 'cg.desk.v1');
    await p.evaluate(() => { location.hash = '#accounts'; }); await p.waitForTimeout(1500);
    const t1 = await p.$eval('#a15Pace', e => e.textContent);
    ok(/22,222/.test(t0) && d && +d.budget === 33333 && /33,333/.test(t1) && !/22,222/.test(t1), 'Accounts, open first, follows a Desk budget change on its next show: ' + t1.slice(0, 100));
    ok(!errs.length, 'no page errors (' + errs.join(' | ') + ')'); await browser.close(); }
  /* 2. accounts and CMS: old keys (Louisiana's up.*, Contraflow's cf.*) are not read and not copied; they are left as they were */
  const oldAcct = { cfg: { meta: { adAccount: 'act_123' } }, tokens: {}, actuals: { '2026-11-01|meta|x': { spend: 10 } }, settings: { useObserved: false, applied: null, range: 30 }, imports: [] };
  const oldCms = { cfg: { wp_headless: { url: 'https://wp.example.com', siteUrl: 'https://www.example.com' } }, deployed: {}, log: [], settings: { mediaHost: '', target: '' } };
  { const { browser, p, errs } = await page({ 'cf.accounts.v1': oldAcct, 'up.accounts.v1': oldAcct, 'cf.cms.v1': oldCms, 'up.cms.v1': oldCms, 'cf.publish.composer': { title: 'Seeded draft title' }, 'up.publish.composer': { title: 'Seeded draft title' } }, '#publish');
    await p.evaluate(() => Promise.all([ACCT.ready(), CMS.ready()])); await p.waitForTimeout(800);
    { const mine = await get(p, 'cg.accounts.v1'); ok(!mine || !(mine.cfg && mine.cfg.meta && mine.cfg.meta.adAccount), 'nothing copied to cg.accounts.v1 from the old keys'); ok(JSON.stringify(await get(p, 'up.accounts.v1')) === JSON.stringify(oldAcct), 'up.accounts.v1 left as it was'); }
    ok(JSON.stringify(await get(p, 'cf.accounts.v1')) === JSON.stringify(oldAcct), 'cf.accounts.v1 left as it was');
    ok(await p.evaluate(() => (ACCT.cfg('meta') || {}).adAccount) !== 'act_123', 'the Accounts store does not hold the other atlas\'s settings');
    { const mine = await get(p, 'cg.cms.v1'); ok(!mine || !(mine.cfg && mine.cfg.wp_headless && mine.cfg.wp_headless.siteUrl), 'nothing copied to cg.cms.v1 from the old keys'); }
    ok(await p.evaluate(() => (CMS.cfg('wp_headless') || {}).siteUrl) !== 'https://www.example.com', 'the CMS store does not hold the other atlas\'s settings');
    await p.waitForSelector('#p16cTitle', { timeout: 60000, state: 'attached' });
    ok(await p.$eval('#p16cTitle', e => e.value) !== 'Seeded draft title', 'the Publish composer does not show a draft saved under an old key');
    await p.$eval('#p16cTitle', e => { e.value = 'New roofing draft'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(1500);
    const up = await get(p, 'cg.publish.composer'), cf = await get(p, 'cf.publish.composer'), lou = await get(p, 'up.publish.composer');
    ok(up && up.title === 'New roofing draft', 'the composer saves under cg.publish.composer: ' + (up && up.title)); ok(lou && lou.title === 'Seeded draft title', 'up.publish.composer left as it was');
    ok(cf && cf.title === 'Seeded draft title', 'cf.publish.composer left as it was');
    /* a change saved here goes to the new key only */
    await p.evaluate(() => ACCT.setSettings({ range: 7 })); await p.waitForTimeout(300);
    ok((await get(p, 'cg.accounts.v1')).settings.range === 7 && (await get(p, 'cf.accounts.v1')).settings.range === 30 && (await get(p, 'up.accounts.v1')).settings.range === 30, 'an Accounts change writes cg.accounts.v1 only');
    ok(!errs.length, 'no page errors (' + errs.join(' | ') + ')'); await browser.close(); }
  /* 2b. a draft the other atlases save under their keys never shows here */
  { const { browser, p, errs } = await page({ 'cf.publish.composer': { title: 'Roof replacement in Lafayette' }, 'up.publish.composer': { title: 'Roof replacement in Lafayette' } }, '#publish');
    await p.waitForSelector('#p16cTitle', { timeout: 60000, state: 'attached' }); await p.waitForTimeout(800);
    const up0 = await get(p, 'cg.publish.composer');
    ok(!up0 || up0.title !== 'Roof replacement in Lafayette', 'the first Publish visit copies no old draft to cg.publish.composer');
    await p.evaluate(() => localStorage.setItem('cf.publish.composer', JSON.stringify({ title: 'Car accident lawyer in Baton Rouge' })));
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500);
    await p.waitForSelector('#p16cTitle', { timeout: 60000, state: 'attached' });
    ok(!/Lafayette|Baton Rouge/.test(await p.$eval('#p16cTitle', e => e.value)), 'a draft of another atlas under an old key does not show here');
    ok((await get(p, 'cf.publish.composer')).title === 'Car accident lawyer in Baton Rouge', 'the old key is left as the other atlas wrote it');
    ok(!errs.length, 'no page errors (' + errs.join(' | ') + ')'); await browser.close(); }
  /* 3. once the new key exists, the old key is ignored */
  { const { browser, p, errs } = await page({ 'cg.accounts.v1': Object.assign({}, oldAcct, { cfg: { meta: { adAccount: 'act_ROOF' } } }), 'cf.accounts.v1': oldAcct, 'up.accounts.v1': oldAcct, 'cg.cms.v1': Object.assign({}, oldCms, { cfg: { wp_headless: { url: 'https://wp.roof.example', siteUrl: 'https://roof.example' } } }), 'cf.cms.v1': oldCms, 'up.cms.v1': oldCms, 'cg.publish.composer': { title: 'Roof draft' }, 'cf.publish.composer': { title: 'Law draft' }, 'up.publish.composer': { title: 'Louisiana draft' } }, '#publish');
    await p.evaluate(() => Promise.all([ACCT.ready(), CMS.ready()]));
    ok(await p.evaluate(() => ACCT.cfg('meta').adAccount) === 'act_ROOF', 'Accounts prefers its own key over the old one');
    ok(await p.evaluate(() => CMS.cfg('wp_headless').siteUrl) === 'https://roof.example', 'CMS prefers its own key over the old one');
    await p.waitForSelector('#p16cTitle', { timeout: 60000, state: 'attached' });
    ok(await p.$eval('#p16cTitle', e => e.value) === 'Roof draft', 'the composer prefers its own key');
    ok(!errs.length, 'no page errors (' + errs.join(' | ') + ')'); await browser.close(); }
  /* 4. a fresh browser: nothing under the old keys is created */
  { const { browser, p, errs } = await page({}, '#publish');
    await p.evaluate(() => Promise.all([ACCT.ready(), CMS.ready()])); await p.waitForTimeout(800);
    const keys = await p.evaluate(() => Object.keys(localStorage).sort());
    ok(!keys.some(k => k.startsWith('cf.') || k.startsWith('up.')), 'a fresh browser gets no cf. or up. keys: ' + keys.join(', ')); ok(keys.every(k => k.startsWith('cg.') || !/\.(v1|composer)$/.test(k)), 'every store of the atlas is under cg.: ' + keys.join(', '));
    ok(!errs.length, 'no page errors (' + errs.join(' | ') + ')'); await browser.close(); }
  console.log(fails.length ? `${fails.length} FAILED` : 'all passed'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
