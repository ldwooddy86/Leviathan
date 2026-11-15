/* Runs the real dashboard, headless, and asks it.

   Reading the file as text (lib/read.mjs) gives an agent what the dashboard states. What the dashboard computes when it
   opens (the service line model's seasons and unit economics, the Heat Desk's plan, the Campaign Desk's forecast) and
   what it does with a file handed to it can only be known by opening it. This module opens the dashboard file in
   Chromium through Playwright, in a fresh profile with every network request refused, and uses the dashboard's own
   functions and the dashboard's own controls: the Campaign Desk's Load button, the Publish module's import box.

   Nothing here is required. Where Playwright or a browser is missing, available() says so and callers fall back to the
   text reading. Nothing here changes the dashboard file, and nothing leaves the machine. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { REPO } from './paths.mjs';

export class Unavailable extends Error { }

/* Playwright, from wherever this machine has it: beside this toolkit, in the browser app's packages, or global */
function playwright() {
  const from = [import.meta.url, pathToFileURL(path.join(REPO, 'chrome-app', 'package.json')).href, pathToFileURL(path.join(process.cwd(), 'package.json')).href];
  for (const f of from) { try { return createRequire(f)('playwright'); } catch { /* next */ } }
  return null;
}
async function launch(pw) {
  const tries = [{}]; const exe = process.env.LEVIATHAN_CHROMIUM; if (exe) tries.unshift({ executablePath: exe });
  let last = null;
  for (const o of tries) { try { return await pw.chromium.launch(Object.assign({ headless: true }, o)); } catch (e) { last = e; } }
  throw new Unavailable('Chromium could not be started for Playwright (' + String(last && last.message || last).split('\n')[0] + '). Install it with: npx playwright install chromium, or set LEVIATHAN_CHROMIUM to a Chrome binary.');
}
let known = null;
/* {ok, why}: can this machine run the dashboard? Cached for the process. */
export async function available() {
  if (known) return known;
  if (process.env.LEVIATHAN_NO_LIVE) return known = { ok: false, why: 'LEVIATHAN_NO_LIVE is set' };
  const pw = playwright(); if (!pw) return known = { ok: false, why: 'Playwright is not installed (npm install playwright, then npx playwright install chromium)' };
  try { const b = await launch(pw); await b.close(); return known = { ok: true, why: '' }; } catch (e) { return known = { ok: false, why: e.message }; }
}

/* Opens a dashboard file. Returns {page, errors, close, run}. The page reaches no network: fonts, live data and every
   platform call are refused, so the dashboard shows what its file carries. */
export async function open(file, { timeout = 45000 } = {}) {
  const abs = path.resolve(file); if (!fs.existsSync(abs)) throw new Error('no dashboard file at ' + abs);
  const pw = playwright(); if (!pw) throw new Unavailable('Playwright is not installed (npm install playwright, then npx playwright install chromium)');
  const browser = await launch(pw);
  try {
    const context = await browser.newContext();
    await context.route(/^(https?|wss?):/, r => r.abort());
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.goto(pathToFileURL(abs).href, { waitUntil: 'load', timeout });
    await page.waitForFunction(() => typeof MODS !== 'undefined' && MODS.length > 0 && !!document.querySelector('#rail button'), null, { timeout });
    /* files the dashboard would download are kept in the page instead */
    await page.evaluate(() => { window.__saved = []; saveFile = (name, content) => { window.__saved.push({ name: String(name), text: typeof content === 'string' ? content : null }); }; });
    return { page, errors, file: abs, close: () => browser.close(), run: (fn, arg) => page.evaluate(fn, arg) };
  } catch (e) { await browser.close(); throw e; }
}
/* opens, runs one job, closes */
export async function withDashboard(file, job) { const s = await open(file); try { return await job(s); } finally { await s.close(); } }

/* ---------- what the dashboard computes ---------- */
/* The service line model as the dashboard computes it at load, from the file's own data and default assumptions: each
   line's twelve month season, metro totals, unit economics, cost per lead by platform and the blend it would run; and
   for every scored ZIP, each line's jobs, gross profit pool, competitor pressure percentile, priority percentile,
   starting bid modifier and whether the auction is quiet, with the ZIP's audience levers. */
export async function snapshot(s) {
  return s.run(() => {
    const r1 = v => (typeof v === 'number' && isFinite(v) ? Math.round(v * 10) / 10 : null), r2 = v => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : null);
    const out = { at: new Date().toISOString(), modules: MODS.map(m => ({ key: m.key, num: m.num, title: m.title })), slm: null, desk: null };
    if (typeof SLM !== 'undefined' && SLM && Array.isArray(SLM.LINES)) {
      const lines = SLM.LINES.map(l => {
        const a = SLM.AGG[l.id] || {}; let u = {}, cpl = {}, b = {};
        try { u = SLM.unitEcon(l, null) || {}; } catch (e) { } try { cpl = SLM.cplByPlatform(l) || {}; } catch (e) { } try { b = SLM.blended(l) || {}; } catch (e) { }
        return { id: l.id, months: (l.months || []).slice(), totals: { pool: r1(a.pool), jobs: r1(a.jobs), revenue: r1(a.rev), grossProfit: r1(a.gp), quietZips: a.quiet ?? null, ticket: r2(a.ticket), competitors: a.compN ?? null, competitorsPaid: a.compPaid ?? null },
          unit: { ticket: r2(u.ticket), margin: u.margin ?? null, close: u.close ?? null, pipe: u.pipe ?? null, cpl: r2(u.cpl), cac: r2(u.cac), gpPerJob: r2(u.gpPerJob), breakEvenCpl: r2(u.beCpl), roas: r2(u.roas), gpRoas: r2(u.gpRoas) },
          cplByPlatform: Object.fromEntries(Object.entries(cpl).map(([k, v]) => [k, r2(v)])), blend: (b.parts || []).map(p => ({ platform: p.p ?? p.platform ?? p.id ?? null, share: r2(p.w ?? p.share ?? null), cpl: r2(p.cpl ?? null) })) };
      });
      const zips = {};
      ZR.forEach(z => { const row = SLM.SLZ[z.zip] || {}, L = SLM.LEV[z.zip] || null; const o = {}; SLM.LINES.forEach(l => { const c = row[l.id]; if (c) o[l.id] = [r1(c.jobs), Math.round(c.gp || 0), r1(c.presspct), r1(c.pri), c.bid ?? 0, c.quiet ? 1 : 0]; }); zips[z.zip] = { lines: o, levers: L ? { fin: L.fin, cash: L.cash, es: L.es, senior: !!L.senior, newowner: !!L.newowner, landlord: !!L.landlord, multisys: !!L.multisys, dominant: L.dominant || '', tags: L.tags || [] } : null }; });
      out.slm = { assumptions: JSON.parse(JSON.stringify(SLM.A)), lines, zipFields: ['jobs', 'grossProfit', 'pressurePct', 'priorityPct', 'bid', 'quiet'], zips, blendRaw: (() => { try { return JSON.parse(JSON.stringify(SLM.blended(SLM.LINES[0]))); } catch (e) { return null; } })() };
    }
    if (typeof PLATS !== 'undefined' && typeof PBOOK !== 'undefined') out.desk = { platforms: PLATS.slice(), labels: Object.assign({}, PLAB), assumptions: JSON.parse(JSON.stringify(ASM0)), mix: JSON.parse(JSON.stringify(MIX0)), book: JSON.parse(JSON.stringify(PBOOK)) };
    return out;
  });
}

/* ---------- the dashboard's own rule screen ---------- */
/* Screens sets of ad texts the way the Campaign Desk does. sets: [{texts: [...], platform, lic}] -> [[{id, ev, in?}]] */
export async function lint(s, sets) {
  return s.run(sets => sets.map(set => {
    const L = (txt, extra) => satchelLint(txt, Object.assign({ lic: set.lic }, extra || {}));
    const f = L(set.texts.join(' \n '), { needLic: true, platform: set.platform }).map(x => ({ id: x.rule.id, ev: x.ev }));
    set.texts.forEach(t => L(t, { headline: true }).forEach(x => { if (x.rule.id === 'GGL1') f.push({ id: x.rule.id, ev: x.ev, in: t }); }));
    return f;
  }), sets.map(x => ({ texts: (x.texts || []).map(String), platform: x.platform || '', lic: x.lic || '' })));
}

/* ---------- the Campaign Desk's door ---------- */
const money = s => +String(s).replace(/[^0-9.\-]/g, '') || 0;
/* Loads a plan file through the desk's own Load button and reads back what the desk made of it: the plan it now holds,
   its markets, its forecast by platform, and (with files: true) the bulk files it would export, every campaign and ad in them paused. */
export async function desk(s, planFile, { files = false } = {}) {
  const { page } = s; await page.evaluate(() => showModule('desk'));
  /* the desk answers a load with a toast; an earlier toast's words stay in the element, so it is emptied first */
  const before = await page.evaluate(() => { const t = document.querySelector('.toast'); if (t) t.textContent = ''; return JSON.stringify(MODI.desk.plan()); });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), page.click('#dkLoad')]);
  await chooser.setFiles(path.resolve(planFile));
  await page.waitForFunction(() => { const t = document.querySelector('.toast'); return !!t && (t.textContent || '').trim().length > 0; }, null, { timeout: 15000 }).catch(() => { });
  const verdict = await page.evaluate(() => { const t = document.querySelector('.toast'); return t ? (t.textContent || '').trim() : ''; });
  const out = await page.evaluate(() => {
    const d = MODI.desk, plan = d.plan(), num = s => +String(s).replace(/[^0-9.\-]/g, '') || 0;
    const kpis = {}; document.querySelectorAll('#dkKpis .kpi').forEach(k => { kpis[k.querySelector('.kl span').textContent.trim()] = { value: k.querySelector('.kv').textContent.trim(), note: (k.querySelector('.kd') || {}).textContent || '' }; });
    const tab = v => { const b = document.querySelector(`#dkTabs button[data-v="${v}"]`); if (b) b.click(); };
    tab('platforms'); const platforms = [...document.querySelectorAll('#dkTab table tbody tr')].map(tr => { const c = [...tr.children].map(td => td.textContent.trim()); return { platform: c[0], spend: num(c[1]), clicks: num(c[2]), leads: num(c[3]), booked: num(c[4]), costPerBooked: c[5] === '—' ? null : num(c[5]) }; });
    const warnings = [...document.querySelectorAll('#dkTab .callout')].map(c => c.textContent.trim());
    tab('flight'); const flight = [...document.querySelectorAll('#dkTab table tbody tr')].map(tr => { const c = [...tr.children].map(td => td.textContent.trim()); return { month: c[0], days: num(c[1]), index: num(c[2]), media: num(c[3]) }; });
    tab('markets');
    return { plan, kpis, platforms, warnings, flight, feed: d.feed().map(f => ({ label: f.label, platform: f.plat, text: f.text })) };
  });
  out.verdict = verdict; out.accepted = /Plan loaded/.test(verdict); out.changed = JSON.stringify(out.plan) !== before;
  if (files) {
    await page.evaluate(() => { window.__saved.length = 0; });
    for (const id of ['dkPlanX', 'dkG', 'dkL', 'dkDg', 'dkM', 'dkMs', 'dkNd', 'dkY', 'dkLi', 'dkCr', 'dkKw']) { if (await page.$('#' + id)) await page.click('#' + id).catch(() => { }); }
    out.files = await page.evaluate(() => window.__saved.filter(f => f.text != null));
  }
  out.errors = s.errors.slice();
  return out;
}

/* ---------- the Publish module's door ---------- */
/* Drops a pages file (a blueprint, a list of blueprints, a handoff with a pages list, or an HTML page) on the import box
   and reads back what Publish now lists. */
export async function publish(s, pagesFile) {
  const { page } = s; await page.evaluate(() => showModule('publish'));
  await page.waitForSelector('#p16iFile', { state: 'attached', timeout: 15000 });
  /* Publish answers an import with a new first line in its log; wait for the log to change, not merely to hold text */
  const prev = await page.evaluate(() => (document.querySelector('#p16iLog') || {}).textContent || '');
  await page.setInputFiles('#p16iFile', path.resolve(pagesFile));
  await page.waitForFunction(prev => { const l = document.querySelector('#p16iLog'); return !!l && !l.hidden && (l.textContent || '') !== prev; }, prev, { timeout: 20000 }).catch(() => { });
  const out = await page.evaluate(() => {
    const log = (document.querySelector('#p16iLog') || {}).textContent || '';
    const listed = [...document.querySelectorAll('#p16Pages tr[data-slug]')].map(tr => ({ slug: tr.dataset.slug, row: [...tr.children].map(td => (td.innerText || td.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean) }));
    return { log: log.trim(), listed };
  });
  /* the newest line of the import log is the first; a line that names pages means the file was taken */
  const first = out.log.split('\n')[0] || '', took = /:\s*\d+ pages? \(/.test(first);
  out.accepted = took; out.verdict = first.replace(/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\s*/i, '');
  out.pages = took ? (first.slice(first.indexOf('(')).match(/\/[^/\s,)]+\//g) || []).map(x => x.replace(/^\/|\/$/g, '')) : [];
  out.errors = s.errors.slice();
  return out;
}

/* ---------- the Agent Desk ---------- */
/* What a copy of the dashboard with the Agent Desk in it (lib/panel.mjs) opens to: whether the module is there, its
   number, its place in the rail, and the hand-offs it lists. */
export async function panel(s) {
  const out = await s.run(() => {
    const m = typeof MODI !== 'undefined' ? MODI.agents : null; if (!m) return { present: false, tab: false, failed: false, handoffs: [], modules: typeof MODS !== 'undefined' ? MODS.length : 0 };
    showModule('agents'); const sec = document.querySelector('#mod-agents');
    return { present: true, num: m.num, title: m.title, tab: !!document.querySelector('#tab-agents'), shown: !!sec && !sec.hidden, failed: !sec || /This module failed to load/.test(sec.textContent || ''), handoffs: typeof m.handoffs === 'function' ? m.handoffs() : [], modules: MODS.length, repairs: !!document.getElementById('lvp-repairs') };
  });
  out.errors = s.errors.slice(); return out;
}

/* ---------- the Heat Desk ---------- */
/* The Heat Desk engine's plan for a month and its reading of the week, from the forecast the file carries. settings is a
   sparse HEATX settings object (budget, month 0 to 11, lsaLive, mode, mix, ...). Returns null when the dashboard has no
   Heat Desk. The desk payload is what the Heat Desk itself sends to the Campaign Desk. */
export async function heat(s, settings = {}) {
  return s.run(settings => {
    if (typeof HEATX === 'undefined' || !HEATX || typeof HEATX.plan !== 'function') return null;
    const r1 = v => (typeof v === 'number' && isFinite(v) ? Math.round(v * 10) / 10 : null), r0 = v => (typeof v === 'number' && isFinite(v) ? Math.round(v) : null), r2 = v => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : null);
    const P = HEATX.params(settings || {}), plan = HEATX.plan(P), hand = HEATX.hand(plan, 'all'), T = plan.T || {};
    const out = {
      month: plan.monthName, settings: { budget: P.budget, month: P.month, mode: P.mode, lsaLive: P.lsaLive, bidding: P.bidding, reserve: P.reserve, hours: P.hours }, origin: plan.origin || null, grades: HEATX.GRADES,
      totals: { budget: r0(T.budget), spent: r0(T.spent), unspent: r0(T.unspent), leads: r1(T.leads), jobs: r1(T.jobs), cpl: r0(T.cpl), costPerJob: r0(T.cpj), grossProfit: r0(T.gp), grossProfitDirect: r0(T.gpDirect), gpPerDollar: r1(T.gpPerDollar), zips: T.zips, within20min: r1(T.share20 != null ? T.share20 * 100 : null), farthestMin: r0(T.farthest), households: r0(T.households) },
      lines: (plan.lines || []).map(l => ({ id: l.id, name: l.name, share: r1(l.share * 100), dollars: r0(l.dollars), zips: l.zips, leads: r1(l.leads), cpl: r0(l.cpl), jobs: r1(l.jobs), season: r1(l.season), runs: l.runWhy || '' })),
      platforms: (plan.platforms || []).map(q => ({ id: q.id, name: q.name, dollars: r0(q.dollars), share: r1(q.share * 100), min: q.min, folded: q.folded || [], how: q.how })),
      campaigns: (plan.campaigns || []).map(c => ({ name: c.name, kind: c.kind, platform: c.platform, lines: c.lines, tier: c.tier || '', zips: Array.isArray(c.zips) ? c.zips.length : c.zips, budget: r0(c.budget), daily: r1(c.daily), strategy: c.strategy, targetCpa: r0(c.targetCpa), maxCpc: c.maxCpc ?? null, bidMin: c.bidMin ?? null, bidMax: c.bidMax ?? null, leads: r1(c.leads), cpl: r0(c.cpl), status: c.status, note: c.note || '' })),
      tiers: (plan.tiers || []).map(t => ({ tier: t.tier, words: t.words, zips: t.zips, share: r1(t.share * 100), dollars: r0(t.dollars) })),
      zips: (plan.zips || []).map(z => ({ zip: z.zip, city: z.city, county: z.county, minutes: r0(z.min), tier: z.tier, dollars: r0(z.dollars), bid: z.bid, label: z.label, leads: r1(z.leads), why: z.why || '' })),
      notes: (plan.notes || []).map(n => ({ kind: n.kind, text: n.text })),
      hand, deskPayload: Object.assign({}, hand, { budget: Math.round(T.spent || 0), mix: Object.fromEntries((plan.platforms || []).map(q => [q.id, q.share])), note: `Heat Desk plan for ${plan.monthName}: ${T.zips} ZIPs with their bid adjustments and the platform shares that run` }),
      week: null,
    };
    try {
      const F = HEATX.forecast(new Date()), wk = HEATX.week(P, F, {});
      if (wk) out.week = { source: wk.src, stale: !!wk.stale, forecastAgeHours: r1(wk.ageH), from: wk.from, to: wk.to, trigger: !!wk.trigger, why: wk.triggerWhy || '', head: wk.head ? { headline: wk.head.headline, sub: wk.head.sub, minLow: wk.head.minLow } : null,
        totals: wk.T ? { normal: r0(wk.T.normal), week: r0(wk.T.week), change: r0(wk.T.change), leads: r1(wk.T.leads) } : null, reserve: wk.reserve ? wk.reserve.text : '',
        lines: (wk.lines || []).map(l => ({ id: l.id, name: l.name, multiplier: r2(l.mult), normal: r0(l.normal), week: r0(l.week), paused: !!l.paused })),
        days: (wk.days || []).map(d => ({ date: d.date, label: d.label, low: d.low, tier: d.tierName, answered: d.answered, total: r0(d.total), capUp: d.capUp, alert: d.alert || '' })),
        list: (wk.list || []).map(x => x.text), rules: (wk.rules || []).filter(r => r.fired).map(r => ({ id: r.id, trigger: r.trigger, budget: r.budget, bids: r.bids, grade: r.grade })) };
    } catch (e) { out.weekError = String(e && e.message || e); }
    return out;
  }, settings);
}

/* a scratch file outside the repository for a value the dashboard must be handed as a file */
export function scratch(name, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-link-')); const f = path.join(dir, name); fs.writeFileSync(f, text); return f;
}
