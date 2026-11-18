#!/usr/bin/env node
/* Drives the built Command Center in a real browser and checks what it holds and what its buttons do.

     node tools/check.mjs <dashboard.html> [folder for screenshots]

   Needs Playwright with Chromium. The page is opened as a file with the network closed, so nothing here depends on a
   connection and nothing is sent anywhere. Exits 1 when a check fails. */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? path.resolve(argv.splice(i, 2)[1]) : ''; };
const campaignsDir = opt('campaigns'), serviceDir = opt('service');
const file = path.resolve(argv[0] || ''), shots = argv[1] ? path.resolve(argv[1]) : '';
if (!fs.existsSync(file)) { console.error('usage: node tools/check.mjs <dashboard.html> [screenshots folder] [--campaigns <folder> --service <folder>]'); process.exit(2); }
/* a zip as the dashboard writes one (stored, not deflated): name -> bytes */
function unzip(buf) { const out = new Map(); let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--; if (e < 0) return out; const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); for (let i = 0; i < n; i++) { const size = buf.readUInt32LE(p + 24), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nl), start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28); out.set(name, buf.subarray(start, start + size)); p += 46 + nl + xl + cl; } return out; }
const noBom = b => (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF ? b.subarray(3) : b);
const sameAs = (bytes, ...p) => Buffer.compare(noBom(bytes), noBom(fs.readFileSync(path.join(...p)))) === 0;
if (shots) fs.mkdirSync(shots, { recursive: true });

const results = []; let failed = 0;
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); };

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.route(/^https?:\/\//, r => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: false }); };
const full = async name => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true }); };

/* count the shader programs the graphics engine links, and any the driver refuses */
await page.addInitScript(() => { const P = window.WebGL2RenderingContext && WebGL2RenderingContext.prototype; if (!P) return; const link = P.linkProgram, get = P.getProgramParameter; window.__progs = { linked: 0, refused: 0 }; P.linkProgram = function (pr) { link.call(this, pr); window.__progs.linked++; if (!get.call(this, pr, this.LINK_STATUS)) window.__progs.refused++; }; });
await page.goto('file://' + file, { waitUntil: 'load', timeout: 180000 });
await page.waitForTimeout(1200);

/* ---------- the name and the modules ---------- */
check('title', (await page.title()) === 'Integrity Air Conditioning & Heating Command Center', await page.title());
check('header', (await page.textContent('.brandmark .nm')) === 'Integrity Air Conditioning & Heating Command Center', await page.textContent('.brandmark .nm'));
const mods = await page.evaluate(() => MODS.map(m => `${m.num} ${m.key}`));
check('modules', mods.length === 23 && mods.slice(-3).join(', ') === '21 agents, 22 paidads, 23 strategist', mods.slice(-4).join(', '));
check('graphics engine present', await page.evaluate(() => !!document.getElementById('scout-engine') && /Scout Engine/.test(document.getElementById('scout-engine').textContent.slice(0, 400))));
await shot('01-home');

/* ---------- the Paid Ads Strategist ---------- */
await page.evaluate(() => showModule('paidads'));
const ps = await page.evaluate(() => MODI.paidads.state());
check('paid ads: what it holds', ps.campaigns === 6 && ps.monthly === 19500 && ps.adGroups === 31 && ps.keywords === 337 && ps.metaAds === 20 && ps.landingPages === 6 && ps.confirm === 9, ps);
for (const v of ['overview', 'ads', 'pages', 'confirm', 'files']) {
  await page.evaluate(v2 => MODI.paidads.show(v2, MODI.paidads.state().sel), v); await page.waitForTimeout(250);
  const n = await page.evaluate(() => document.querySelector('#lvsView').innerText.length);
  check(`paid ads: ${v} view draws`, n > 400, n + ' characters'); await full('02-paid-' + v);
}
const adFacts = await page.evaluate(() => {
  const d = JSON.parse(document.getElementById('lvp-data').textContent), paid = d.bundles.filter(b => b.paid && !/trial/.test(b.id));
  const groups = paid.flatMap(b => b.paid.search.flatMap(s => s.adGroups)), t = x => (typeof x === 'string' ? x : x.text), len = s => [...s].length;
  return { groups: groups.length, all15and4: groups.every(g => g.ad.headlines.length === 15 && g.ad.descriptions.length === 4), longHeadline: groups.flatMap(g => g.ad.headlines.map(t)).filter(h => len(h) > 30), longDescription: groups.flatMap(g => g.ad.descriptions.map(t)).filter(x => len(x) > 90), tokens: JSON.stringify(paid.map(b => [b.paid.search, b.paid.ads])).match(/\{reviews\.[a-z]+\}/gi) || [], pinned: groups.every(g => g.ad.descriptions[0] && g.ad.descriptions[0].pin === 1 && /TACLA124869E/.test(g.ad.descriptions[0].text)) };
});
check('ad copy: 15 headlines and 4 descriptions in every ad group, the license line pinned first', adFacts.all15and4 && adFacts.pinned, { groups: adFacts.groups });
check('ad copy: within Google\'s limits, no review token left unfilled', !adFacts.longHeadline.length && !adFacts.longDescription.length && !adFacts.tokens.length, adFacts.longHeadline.concat(adFacts.longDescription, adFacts.tokens).slice(0, 4));
for (const c of await page.evaluate(() => JSON.parse(document.getElementById('lvs-data').textContent).campaigns.map(c => c.id))) {
  await page.evaluate(id => MODI.paidads.show('ads', id), c);
  const r = await page.evaluate(() => ({ groups: document.querySelectorAll('#lvsView .lvs-group').length, serps: document.querySelectorAll('#lvsView .lvs-serp').length, posts: document.querySelectorAll('#lvsView .lvs-post').length, over: document.querySelectorAll('#lvsView .lvs-over').length, flags: [...document.querySelectorAll('#lvsView .lvs-flags .pill, #lvsView .lvs-meta .pill')].map(p => p.textContent.trim()).filter(t => !/clean/.test(t)) }));
  check(`ad copy drawn: ${c}`, r.serps > 0 && r.posts > 0 && r.over === 0, r);
}
const lp = await page.evaluate(async () => { await MODI.paidads.show('pages'); const f = document.querySelector('#lvsView iframe'); return { frame: !!f, sandbox: f && f.getAttribute('sandbox'), doc: f ? f.srcdoc.length : 0, h1: /<h1>/.test(f ? f.srcdoc : '') }; });
check('landing page preview is a sealed frame with the page in it', lp.frame && lp.sandbox === '' && lp.doc > 20000 && lp.h1, lp);
const sentLp = await page.evaluate(() => MODI.paidads.sendPages());
const inPub1 = await page.evaluate(() => MODI.publish.pages().map(p => ({ slug: p.slug, noindex: p.noindex, words: p.words, kind: p.kind })));
check('landing pages: all six go into Publish as drafts', sentLp.ok && inPub1.length === 6 && inPub1.every(p => /^lp-/.test(p.slug) && p.noindex === true), { sent: sentLp, listed: inPub1.map(p => p.slug) });
{
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#lvsAll')]);
  const z = unzip(fs.readFileSync(await dl.path())), names = [...z.keys()];
  let same = null; if (campaignsDir) { same = 0; for (const n of names) { const rel = n.replace(/^heating-campaigns\//, ''); if (fs.existsSync(path.join(campaignsDir, rel)) && sameAs(z.get(n), campaignsDir, rel)) same++; } }
  check('paid ads: the "everything" zip downloads' + (campaignsDir ? ', and every file in it that the package has is the same bytes' : ''), dl.suggestedFilename() === 'heating-campaigns.zip' && names.length === 84 && (same == null || same === 83), { files: names.length, sameAsThePackage: same });
}
await page.evaluate(() => MODI.paidads.show('pages', 'paid:heat-2026-11-23-heating-tune-up')); await page.click('#lvsSend');
await page.waitForFunction(() => /In Publish, as drafts/i.test(document.querySelector('#lvsSent').innerText), null, { timeout: 20000 }).catch(() => { });
check('landing page: the Send button puts the page in Publish and says so', await page.evaluate(() => /In Publish, as drafts/i.test(document.querySelector('#lvsSent').innerText) && MODI.publish.pages().some(p => p.slug === 'lp-heating-tune-up') && /yes/i.test(document.querySelector('#lvsView .lvs-kpis').innerText)));
const zip = await page.evaluate(() => MODI.paidads.files().map(f => f.name));
check('paid ads: the zip carries every campaign folder, the six pages and the page files', zip.filter(n => /campaign-files\//.test(n)).length === 50 && zip.filter(n => /\/pages\/lp-.*\.html$/.test(n)).length === 6 && zip.filter(n => /page-files\//.test(n)).length === 25, { files: zip.length });

/* ---------- the Agent Desk: every plan through the Campaign Desk's own Load, the city pages through Publish ---------- */
await page.evaluate(() => showModule('agents')); await page.waitForTimeout(300);
const hand = await page.evaluate(() => MODI.agents.handoffs());
check('agent desk: eight hand-offs on file', hand.length === 8 && hand.filter(h => h.kind === 'paid').length === 7 && hand.filter(h => h.kind === 'content').length === 1, hand.map(h => h.id));
check('agent desk: none is flagged as made for another build', await page.evaluate(() => !/Made for another dashboard file/.test(document.querySelector('#mod-agents').innerText)));
await full('03-agent-desk');
for (const h of hand.filter(x => x.kind === 'paid')) {
  const r = await page.evaluate(async id => { MODI.agents.receive({ open: id }); const root = document.querySelector('#mod-agents'), out = {}; for (const k of [...root.querySelectorAll('#lvpTabs button')].map(b => b.dataset.v)) { root.querySelector(`#lvpTabs button[data-v="${k}"]`).click(); await new Promise(r => setTimeout(r, 60)); out[k] = root.querySelector('#lvpTab').innerText.length; } return { tabs: out, broken: /could not be shown/.test(root.innerText), ads: root.querySelectorAll('.lvp-ad').length }; }, h.id);
  check(`agent desk: ${h.id} opens on every tab`, !r.broken && r.tabs.plan > 200 && r.tabs.copy > 500 && r.tabs.launch > 300 && r.tabs.files > 300, r.tabs);
}
const expect = JSON.parse(await page.evaluate(() => JSON.stringify(JSON.parse(document.getElementById('lvp-data').textContent).bundles.filter(b => b.paid).map(b => ({ id: b.id, leads: b.paid.summary.totals.leads, booked: b.paid.summary.totals.booked, budget: b.paid.plan.budget, markets: b.paid.plan.picks.length })))));
for (const e of expect) {
  const r = await page.evaluate(id => MODI.agents.apply(id), e.id);
  const k = r.kpis || {}, num = s => +String(s || '').replace(/[^0-9.]/g, '');
  const same = r.ok && num(k['Monthly media']) === e.budget && Math.abs(num(k['Leads a month']) - e.leads) <= 1 && Math.abs(num(k['Booked jobs']) - e.booked) <= 1 && r.held.markets === e.markets;
  check(`campaign desk takes the plan and reckons what the strategist did: ${e.id}`, same, { how: r.how, desk: { media: k['Monthly media'], leads: k['Leads a month'], booked: k['Booked jobs'], markets: r.held && r.held.markets }, strategist: { leads: Math.round(e.leads), booked: Math.round(e.booked) }, diffs: r.diffs, why: r.why });
}
const city = await page.evaluate(() => MODI.agents.apply('content:pages'));
check('city pages: all 70 compile in Publish', city.ok && city.listed.length === 70 && city.listed.every(p => !p.block), { ok: city.ok, listed: (city.listed || []).length, blocked: (city.listed || []).filter(p => p.block).length, why: city.why });
const citySlugs = await page.evaluate(() => JSON.parse(document.getElementById('lvp-data').textContent).bundles.find(b => b.id === 'content:pages').content.pages.map(p => p.page.slug));
const cityLinks = await page.evaluate(slugs => { const ps = MODI.publish.pages().filter(p => slugs.includes(p.slug)); const d = document.createElement('div'); let out = 0, blank = 0; ps.forEach(p => { d.innerHTML = p.html; d.querySelectorAll('a[href^="http"]').forEach(a => { if (!/integrityairconditioning\.com/.test(a.href)) { out++; if (a.target === '_blank') blank++; } }); }); return { pages: ps.length, out, blank }; }, citySlugs);
check('city pages: 192 source links come through, every one opening in another tab', cityLinks.pages === 70 && cityLinks.out === 192 && cityLinks.blank === 192, cityLinks);

/* ---------- the Content Strategist ---------- */
await page.evaluate(() => { localStorage.setItem('lv.strategist.v1', JSON.stringify({ view: 'pages' })); showModule('strategist'); }); await page.waitForTimeout(400);
const cs = await page.evaluate(() => MODI.strategist.state());
check('content strategist: what it holds', cs.built === 70 && cs.heat === 410 && cs.works === 1053, cs);
const planBuilt = await page.evaluate(() => { const S = JSON.parse(document.getElementById('lvc-data').textContent); const b = S.works.filter(w => w.t === 'service-city' && w.st === 'built'); return { n: b.length, withAddress: b.filter(w => /-tx\/$|\/$/.test(w.u) && !/service-area/.test(w.u)).length, lines: [...new Set(b.map(w => w.l))] }; });
check('plan: the works the heating pages answer are marked built, with the new address', planBuilt.n === 83 && planBuilt.withAddress === 83, planBuilt);
await page.evaluate(() => { document.querySelector('.lvc-tabs button[data-v="pages"]').click(); document.querySelector('#lvcSets button[data-v="city"]').click(); }); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#lvcPages tbody tr[data-id]').click()); await page.waitForTimeout(500);
const cp = await page.evaluate(() => { const f = document.querySelector('#lvcCityPrev iframe'); return { rows: document.querySelectorAll('#lvcPages tbody tr').length, frame: !!f, sandbox: f && f.getAttribute('sandbox'), doc: f ? f.srcdoc.length : 0, census: f ? (f.srcdoc.match(/data\.census\.gov/g) || []).length : 0 }; });
check('city pages: listed, and one previews in a sealed frame', cp.rows === 70 && cp.frame && cp.sandbox === '' && cp.doc > 5000, cp);
await full('04-content-city');
await page.evaluate(() => document.querySelector('#lvcSets button[data-v="heat"]').click());
await page.waitForFunction(() => document.querySelector('#lvcMx table') && MODI.strategist.heatPages, null, { timeout: 30000 });
const hm = await page.evaluate(() => ({ cells: document.querySelectorAll('#lvcMx button[data-slug]').length, live: document.querySelectorAll('#lvcMx a.lvc-live').length, rows: document.querySelectorAll('#lvcMx tbody tr').length, inView: MODI.strategist.heatPages.inView().length, found: document.querySelectorAll('#lvcMx button.lvc-found').length, low: document.querySelectorAll('#lvcMx button.lvc-low').length, none: document.querySelectorAll('#lvcMx button.lvc-none').length }));
check('heating pages: 70 cities by 6 services, 410 pages and 10 left to live pages', hm.cells === 410 && hm.live === 10 && hm.rows === 70 && hm.inView === 410 && hm.found === 266 && hm.low === 114 && hm.none === 30, hm);
await page.evaluate(() => document.querySelector('#lvcMx button[data-slug="heating-repair-plano-tx"]').click()); await page.waitForTimeout(500);
const hp = await page.evaluate(() => { const f = document.querySelector('#lvcHPrev iframe'), d = f ? f.srcdoc : ''; return { frame: !!f, sandbox: f && f.getAttribute('sandbox'), doc: d.length, h1: (/<h1>([^<]*)<\/h1>/.exec(d) || [])[1], census: (d.match(/<a href="https:\/\/data\.census\.gov[^"]*" target="_blank" rel="noopener">Census figures<\/a>/g) || []).length, form: /wp:gravityforms\/form \{"formId":"1"/.test(d) }; });
check('heating page: previews in a sealed frame, with its Census links and the form block', hp.frame && hp.sandbox === '' && hp.h1 === 'Heating Repair in Plano, TX' && hp.census === 2 && hp.form, hp);
await full('05-content-heat');
/* the buttons as a person presses them: find a city, send its pages, and save the whole set as a zip */
await page.fill('#lvcHFind', 'plano'); await page.waitForTimeout(150);
const plano = await page.evaluate(() => ({ label: document.querySelector('#lvcHSend').textContent, cells: document.querySelectorAll('#lvcMx button[data-slug]').length }));
await page.click('#lvcHSend'); await page.waitForFunction(() => /In Publish, as drafts/i.test(document.querySelector('#lvcHSent').innerText), null, { timeout: 20000 }).catch(() => { });
check('heating pages: one city found, its six pages sent with the button', plano.cells === 6 && /6 pages in view/.test(plano.label) && await page.evaluate(() => /In Publish, as drafts/i.test(document.querySelector('#lvcHSent').innerText) && [...document.querySelectorAll('#lvcMx button[data-slug]')].every(b => /✓/.test(b.textContent))), plano);
await page.fill('#lvcHFind', ''); await page.waitForTimeout(150);
const arm = await page.evaluate(() => { const b = document.querySelector('#lvcHSend'), before = MODI.publish.pages().length; b.click(); return { asks: /Press again/.test(b.textContent), sentNothing: MODI.publish.pages().length === before }; });
check('heating pages: sending all 410 asks for a second press first', arm.asks && arm.sentNothing, arm);
{
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#lvcHZip')]);
  const z = unzip(fs.readFileSync(await dl.path())), names = [...z.keys()], pagesIn = names.filter(n => /\/pages\/[^/]+\.html$/.test(n));
  let same = null; if (serviceDir) { same = 0; for (const n of names) { const rel = n.replace(/^service-area-heating-pages\//, ''); if (fs.existsSync(path.join(serviceDir, rel)) && sameAs(z.get(n), serviceDir, rel)) same++; } }
  check('heating pages: the zip of all 410 downloads' + (serviceDir ? ', every file the same bytes as the package' : ''), dl.suggestedFilename() === 'service-area-heating-pages.zip' && pagesIn.length === 410 && names.length === 415 && (same == null || same === 415), { files: names.length, pages: pagesIn.length, sameAsThePackage: same });
}
/* filters, then the staged send: one service where demand was found */
await page.evaluate(() => { const s = document.querySelector('#lvcHSvc'); s.value = 'heating-repair'; s.dispatchEvent(new Event('change')); const d = document.querySelector('#lvcHDem'); d.value = 'found'; d.dispatchEvent(new Event('change')); });
const staged = await page.evaluate(() => MODI.strategist.heatPages.inView());
const before = await page.evaluate(() => MODI.publish.pages().length), fresh = await page.evaluate(list => { const have = new Set(MODI.publish.pages().map(p => p.slug)); return list.filter(x => !have.has(x)).length; }, staged);
const s1 = await page.evaluate(() => MODI.strategist.heatPages.send());
const after = await page.evaluate(() => MODI.publish.pages().length);
check('heating pages: a filtered set goes into Publish as drafts', s1.ok && staged.length > 20 && staged.length < 70 && after - before === fresh, { inView: staged.length, notYetInPublish: fresh, publishBefore: before, publishAfter: after, why: s1.why });
await page.evaluate(() => { const s = document.querySelector('#lvcHSvc'); s.value = ''; s.dispatchEvent(new Event('change')); const d = document.querySelector('#lvcHDem'); d.value = ''; d.dispatchEvent(new Event('change')); });
const t0 = Date.now(), sAll = await page.evaluate(() => MODI.strategist.heatPages.send());
const pub = await page.evaluate(slugs => { const ps = MODI.publish.pages(); const heat = ps.filter(p => !/^lp-/.test(p.slug) && !slugs.includes(p.slug)); return { all: ps.length, heat: heat.length, titles: new Set(heat.map(p => p.title)).size, slugs: new Set(heat.map(p => p.slug)).size, schema: heat.filter(p => p.schema).length, css: heat.filter(p => p.css && p.css.length > 5000).length, checked: document.querySelectorAll('#lvcMx button[data-slug]').length && [...document.querySelectorAll('#lvcMx button[data-slug]')].filter(b => /✓/.test(b.textContent)).length }; }, citySlugs);
check('heating pages: all 410 go into Publish, each with its own title, address, schema and styling', sAll.ok && pub.heat === 410 && pub.titles === 410 && pub.slugs === 410 && pub.schema === 410 && pub.css === 410 && pub.all === 486 && pub.checked === 410, Object.assign({ seconds: Math.round((Date.now() - t0) / 100) / 10 }, pub));
await page.evaluate(() => showModule('publish')); await page.waitForTimeout(400); await shot('06-publish');

/* ---------- Rooftop Scout and the Scout Engine ---------- */
await page.evaluate(() => showModule('rooftops')); await page.waitForTimeout(2500);
const rs = await page.evaluate(() => { const SE = window.__SCOUT_ENGINE__, root = document.querySelector('#mod-rooftops'), gl = document.createElement('canvas').getContext('webgl2'); return { engine: SE ? `${SE.name} ${SE.version}` : '', builder: typeof window.__SCOUT_E3D__, failed: /This module failed to load/.test(root.innerText), webgl2: !!gl, float: !!(gl && gl.getExtension('EXT_color_buffer_float')) }; });
check('rooftop scout opens, with the Scout Engine in the file', rs.engine === 'Scout Engine 1.0.0' && rs.builder === 'function' && !rs.failed, rs);
if (rs.webgl2 && rs.float) {
  const base = await page.evaluate(() => window.__progs.linked);
  await page.evaluate(() => { const b = [...document.querySelectorAll('#mod-rooftops button')].find(x => /Scout Engine \(3D\)/.test(x.textContent)); if (b) b.click(); });
  await page.waitForFunction(n => window.__progs.linked - n >= 30, base, { timeout: 60000 }).catch(() => { });
  await page.waitForTimeout(3000);
  const pr = await page.evaluate(n => ({ linked: window.__progs.linked - n, refused: window.__progs.refused, canvas: [...document.querySelectorAll('#mod-rooftops canvas')].map(c => `${c.width}x${c.height}`).filter(x => x !== '0x0') }), base);
  check('scout engine starts: its shader programs link and none is refused', pr.linked >= 30 && pr.refused === 0 && pr.canvas.length > 0, pr);
  const cv = await page.evaluateHandle(() => [...document.querySelectorAll('#mod-rooftops canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]);
  if (shots && cv.asElement()) { await cv.asElement().scrollIntoViewIfNeeded(); await page.waitForTimeout(1500); await cv.asElement().screenshot({ path: path.join(shots, '07-scout-engine.png') }); }
} else console.log('skip scout engine start: this browser has no WebGL2 with floating point targets');

/* ---------- the rest of the dashboard still opens ---------- */
const bad = [];
for (const key of await page.evaluate(() => MODS.map(m => m.key))) {
  if (key === 'rooftops') continue;
  await page.evaluate(k => showModule(k), key); await page.waitForTimeout(350);
  const r = await page.evaluate(k => { const n = document.querySelector('#mod-' + k); return { text: n.innerText.length, failed: /This module failed to load/.test(n.innerText) }; }, key);
  if (r.failed || r.text < 200) bad.push(key);
}
check('every other module still opens', !bad.length, bad);
check('no page errors', !errors.length, errors.slice(0, 6));
await browser.close();
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
