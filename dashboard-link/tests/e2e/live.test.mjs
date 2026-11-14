/* The running dashboard, through the link. Needs Playwright with Chromium; without them this file says so and passes.

   Runs against the DFW atlas the console carries (Build 4). Point ATLAS_HTML at another dashboard file to run the same
   checks against it as well: nothing from that file is printed but counts.

   What is proved here: that the file read as text (lib/read.mjs) says what the running page holds; that the ported
   rule tests agree with the page's own; that a plan goes in through the Campaign Desk's own Load button and pages go in
   through the Publish import box; that a file the dashboard refuses is reported as refused; and that the dashboard file
   itself is never changed. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ok, done, atlasFile, sandbox, run, tmp, gitState } from '../_t.mjs';
import * as live from '../../lib/live.mjs';
import { identity, modules, library, model, serviceLines } from '../../lib/read.mjs';
import { lintSet } from '../../lib/satchel.mjs';

const av = await live.available();
if (!av.ok) { console.log('skip  no browser here, so the running dashboard was not tested: ' + av.why); process.exit(0); }

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const targets = [{ label: 'the console\'s atlas', file: atlasFile() }];
if (process.env.ATLAS_HTML) targets.push({ label: 'ATLAS_HTML', file: path.resolve(process.env.ATLAS_HTML) });
const before = gitState();

for (const { label, file } of targets) {
  const text = fs.readFileSync(file, 'utf8'), id = identity(text, file), lib = library(text), mdl = model(text, lib), svc = serviceLines(text), mods = modules(text), sum0 = sha(file), d = tmp();
  const T = s => `${label} (Build ${id.build}): ${s}`, hasClean = text.includes('cleanPlan('), hasHeat = mods.some(m => m.key === 'heat');
  const s = await live.open(file);
  try {
    /* ---- the text reading against the running page ---- */
    const snap = await live.snapshot(s);
    ok(s.errors.length === 0 && JSON.stringify(snap.modules.map(m => [m.key, m.num, m.title])) === JSON.stringify(mods.map(m => [m.key, m.num, m.title])), T(`it opens with no error, and its ${mods.length} modules are the ones read from the text`), s.errors[0]);
    const page = await s.run(() => ({
      zips: ZR.map(z => [z.zip, z.city, z.cty, z.fips, z.occ, z.span_sh, z.opp_usd, z.cpc_rel, z.effb, z.tier, z.bid, z.gid || null, ANGLES.filter(a => a.id !== 'recruit' && a.trig(z)).map(a => a.id)]),
      angles: ANGLES.map(a => [a.id, a.short, a.path, (a.kw || []).length + (a.kwq || []).length, (a.h || []).length, (a.d || []).length]),
      lines: Object.fromEntries(Object.entries(LINES).map(([k, v]) => [k, v.angles])), rules: SAT.rules.map(r => [r.id, r.sev]),
      negatives: typeof NEG_CUSTOMER !== 'undefined' ? NEG_CUSTOMER.length : null,
    }));
    const mine = mdl.zips.map(z => [z.zip, z.city, z.county, z.fips, z.occ, z.span_sh, z.opp_usd, z.cpc_rel, z.effb, z.tier, z.bid, z.gid || null, z.fires]);
    const off = mine.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(page.zips[i]));
    ok(mine.length === page.zips.length && off === -1 && mdl.triggersUnread.length === 0, T(`all ${mine.length} ZIP markets read from the text match the page: place, households, opportunity, click cost, tier, bid, and the angles each one triggers`), off === -1 ? '' : [mine[off], page.zips[off]]);
    ok(JSON.stringify(lib.angles.map(a => [a.id, a.short, a.path, a.keywords.core.length + a.keywords.city.length + a.keywords.questions.length, a.copy.h.length, a.copy.d.length])) === JSON.stringify(page.angles) && JSON.stringify(Object.fromEntries(Object.entries(lib.lines).map(([k, v]) => [k, v.angles]))) === JSON.stringify(page.lines) && lib.negatives.NEG_CUSTOMER.length === page.negatives, T(`the ${lib.angles.length} service angles with their keywords and copy, the lines and the negatives match`));
    ok(JSON.stringify(lib.rules.rules.map(r => [r.id, r.severity])) === JSON.stringify(page.rules), T(`the ${lib.rules.rules.length} advertising rules match, in order, with their severity`));
    ok(snap.desk && JSON.stringify(snap.desk.platforms) === JSON.stringify(lib.platforms.order) && JSON.stringify(snap.desk.labels) === JSON.stringify(lib.platforms.labels) && JSON.stringify(snap.desk.assumptions) === JSON.stringify(lib.platforms.assumptions) && JSON.stringify(snap.desk.mix) === JSON.stringify(lib.platforms.mix), T('the platform book matches: order, labels, every benchmark assumption, every starting mix'));
    const bookOff = Object.keys(snap.desk.book).filter(k => JSON.stringify(snap.desk.book[k]) !== JSON.stringify(lib.platforms.book[k]));
    ok(bookOff.length === 0, T('and each platform\'s build rules and limits, the interpolated lines included'), bookOff);
    if (svc) {
      ok(snap.slm && JSON.stringify(snap.slm.lines.map(l => l.id)) === JSON.stringify(svc.lines.map(l => l.id)) && snap.slm.lines.every(l => l.months.length === 12 && l.months.every(v => typeof v === 'number' && v > 0) && l.unit && typeof l.unit.close === 'number') && Object.keys(snap.slm.zips).length === mdl.zips.length, T(`the service line model is read from the page: ${svc.lines.length} lines, each with twelve months and unit economics, for every ZIP`));
      const stated = svc.lines.every(l => { const u = snap.slm.lines.find(x => x.id === l.id).unit; return !l.economics || (u.close === l.economics.close && u.margin === l.economics.margin); });
      ok(stated, T('and the close rate and margin it computes with are the ones the text states for each line'));
      const z0 = mdl.zips[0].zip, cell = snap.slm.zips[z0].lines[svc.lines[0].id];
      ok(Array.isArray(cell) && cell.length === snap.slm.zipFields.length && snap.slm.zips[z0].levers && Array.isArray(snap.slm.zips[z0].levers.tags), T('each ZIP carries a cell per line (jobs, profit pool, pressure, priority, bid, quiet) and its audience levers'));
    } else ok(snap.slm === null, T('no service line model in this build, and none is reported'));

    /* ---- the ported rule tests against the page's own ---- */
    const lic = 'TACLA00000E', fill = t => t.replace(/\{city\}/g, 'Plano').replace(/\{county\}/g, 'Collin').replace(/\{brand\}/g, 'Example Air').replace(/\{lic\}/g, lic).replace(/\{pay\}/g, '$26 to $42 an hour');
    const sets = [{ texts: ['Call Now!', 'No license here.'], platform: 'google', lic }, { texts: ['Fine', 'Licensed. Lic ' + lic + '.'], platform: 'google', lic }, { texts: ['0% APR for 60 months', 'Best AC repair in Plano. #1 rated.'], platform: 'meta', lic }];
    for (const a of lib.angles) sets.push({ texts: [...a.copy.h, ...a.copy.d].map(fill), platform: 'google', lic }, { texts: Object.values(a.copy.social || {}).map(fill), platform: 'meta', lic });
    const theirs = await live.lint(s, sets), ours = sets.map(x => lintSet(x.texts, { lic: x.lic, platform: x.platform }, lib.rules.rules).map(f => Object.assign({ id: f.rule.id, ev: f.ev }, f.in ? { in: f.in } : {})));
    const lo = theirs.findIndex((t, i) => JSON.stringify(t) !== JSON.stringify(ours[i]));
    ok(theirs.length === sets.length && lo === -1 && theirs[0].some(f => f.id === 'TDLR1') && theirs[0].some(f => f.id === 'GGL1') && theirs[1].length === 0, T(`${sets.length} ad sets screened by the page and by the port: the same findings with the same evidence`), lo === -1 ? '' : [theirs[lo], ours[lo]]);

    /* ---- the Campaign Desk's door ---- */
    const picks = mdl.zips.slice().sort((a, b) => b.effb - a.effb).slice(0, 5).map(z => z.zip), line = lib.lines.heat ? 'heat' : Object.keys(lib.lines)[0];
    const plan = Object.assign({ line, budget: 9000, start: '2026-11-23', weeks: 10, scope: 'picks', picks, angles: lib.lines[line].angles, mix: Object.fromEntries(lib.platforms.order.map(k => [k, ({ google: 60, lsa: 30, meta: 10 })[k] || 0])), brand: 'Example Air', lic, phone: '(972) 555-0142', url: 'https://www.example-air.test', handoff: { format: 'leviathan.handoff', agent: 'test' } }, lib.defaults.v != null ? { v: lib.defaults.v } : {});
    const pf = path.join(d, 'campaign-desk-plan.json'); fs.writeFileSync(pf, JSON.stringify(plan));
    const dk = await live.desk(s, pf, { files: true });
    ok(dk.accepted && dk.verdict === 'Plan loaded' && dk.changed && dk.plan.line === line && dk.plan.budget === 9000 && dk.plan.start === '2026-11-23' && dk.plan.weeks === 10 && JSON.stringify(dk.plan.zips.slice().sort()) === JSON.stringify(picks.slice().sort()) && dk.plan.lic === lic && JSON.stringify(dk.plan.angles) === JSON.stringify(plan.angles), T('a plan file goes in through the desk\'s own Load button, and the desk then holds that plan'), dk.verdict);
    ok(dk.kpis['Monthly media'] && dk.kpis['Monthly media'].value === '$9,000' && dk.kpis['Markets bought'].value === '5' && +dk.kpis['Leads a month'].value.replace(/,/g, '') > 0 && dk.platforms.length === 3 && Math.round(dk.platforms.reduce((n, p) => n + p.spend, 0)) === 9000 && dk.flight.length >= 3 && dk.feed.length > 0, T('and shows it: the media, the markets, a forecast by platform that adds to the budget, the flight'), dk.kpis['Leads a month']);
    if (hasClean) ok(!('handoff' in dk.plan), T('the note a handoff file carries is not kept in the plan'));
    const g = (dk.files || []).find(f => /^google-ads-editor_/.test(f.name)), names = (dk.files || []).map(f => f.name);
    ok(g && /Campaign Status/.test(g.text.split('\n')[0]) && g.text.includes(',Paused') && !/,Enabled,[^\n]*Responsive search ad/.test(g.text) && names.some(n => /^meta-ads-import_/.test(n)) && names.some(n => /^campaign-plan_/.test(n)), T(`the desk's own bulk files for the plan are captured (${names.length}), with every campaign and ad paused`), names);
    const nj = path.join(d, 'not-json.json'); fs.writeFileSync(nj, 'not json at all');
    const r1 = await live.desk(s, nj);
    ok(!r1.accepted && r1.verdict === 'That file is not a desk plan' && !r1.changed && r1.plan.line === line, T('a file that is not JSON is refused, reported as refused, and the plan the desk held stays'), r1.verdict);
    const np = path.join(d, 'not-a-plan.json'); fs.writeFileSync(np, '{"hello":1}');
    const r2 = await live.desk(s, np);
    if (hasClean) ok(!r2.accepted && !r2.changed, T('JSON with no plan key in it is refused as well'), r2.verdict);
    else ok(r2.accepted && r2.plan.line !== line, T('this older desk takes any JSON as a plan and resets to its defaults, which is reported as it happened'), r2.verdict);

    /* ---- the Publish door ---- */
    if (mods.some(m => m.key === 'publish')) {
      const bp = (slug, title) => ({ site: {}, page: { slug, title }, sections: [{ type: 'hero', h1: title }] });
      const pg = path.join(d, 'pages-for-publish.json'); fs.writeFileSync(pg, JSON.stringify({ handoff: { format: 'leviathan.handoff', agent: 'test' }, pages: [bp('heating-repair-mesquite', 'Heating Repair in Mesquite'), bp('furnace-repair-garland', 'Furnace Repair in Garland')] }));
      const p1 = await live.publish(s, pg);
      ok(p1.accepted && p1.pages.join() === 'heating-repair-mesquite,furnace-repair-garland' && p1.listed.length === 2 && p1.listed.every(l => l.row.length > 1) && /2 pages/.test(p1.verdict) && !/^\d/.test(p1.verdict), T('a pages file dropped on the Publish import box is compiled and listed, page by page'), p1.verdict);
      const pb = path.join(d, 'junk.json'); fs.writeFileSync(pb, '{"hello":1}');
      const p2 = await live.publish(s, pb);
      ok(!p2.accepted && /nothing recognisable/.test(p2.verdict) && p2.pages.length === 0 && p2.listed.length === 2, T('a file Publish cannot read is refused and reported as refused; the pages already there stay'), p2.verdict);
    }

    /* ---- the Heat Desk ---- */
    const h = await live.heat(s, { budget: 12000 });
    if (hasHeat) ok(h && h.totals.zips > 0 && h.totals.spent > 0 && h.totals.spent <= 12000 && h.lines.length > 0 && h.campaigns.length > 0 && h.campaigns.every(c => /paused/i.test(c.status)) && h.hand.zips.length === h.totals.zips && Object.keys(h.hand.bids).length > 0 && h.deskPayload.budget === h.totals.spent && h.grades, T('the Heat Desk gives its plan: ZIPs, lines, campaigns (all paused) and the handoff it sends the Campaign Desk'), h && h.totals);
    else ok(h === null, T('no Heat Desk in this build, and none is reported'));
    ok(s.errors.length === 0, T('none of this raised an error in the page'), s.errors[0]);
  } finally { await s.close(); }
  ok(sha(file) === sum0, T('the dashboard file is byte for byte what it was'));
}

/* ---- the command line, with a browser ---- */
{
  const { home, env } = sandbox({ live: true }), file = atlasFile(), CLI = 'dashboard-link/cli.mjs', at = (...p) => path.join(home, ...p);
  let r = run(CLI, ['connect', file], env, { json: true });
  ok(r.code === 0 && r.json.live.ok === true && fs.existsSync(at('dashboard', 'live.json')) && r.json.capabilities.paid.find(x => x.what.startsWith('Computed model')).ok, 'connect with a browser: the dashboard is opened and its computed model kept beside the text reading', r.err);
  const L = JSON.parse(fs.readFileSync(at('dashboard', 'live.json'), 'utf8'));
  ok(L.sha256 === r.json.identity.sha256 && L.slm && L.slm.lines.length === 14 && L.desk, 'the computed model carries the fingerprint of the file it came from');
  r = run(CLI, ['status'], env); ok(r.code === 0 && /running the dashboard here: yes/.test(r.out), 'status says the dashboard runs on this machine');
  const plan = path.join(home, 'campaign-desk-plan.json'); fs.writeFileSync(plan, JSON.stringify({ line: 'heat', budget: 9000, start: '2026-11-23', weeks: 10, scope: 'picks', picks: ['75150', '75149'], angles: ['furnace'], mix: { google: 100 } }));
  const filesTo = path.join(home, 'desk-files');
  r = run(CLI, ['check', plan, '--files', filesTo], env);
  ok(r.code === 0 && /ACCEPTED by the Campaign Desk \("Plan loaded"\)/.test(r.out) && /line heat, \$9,000 a month, 10 weeks from 2026-11-23, 2 markets/.test(r.out) && /Google Search/.test(r.out) && fs.readdirSync(filesTo).some(n => /^google-ads-editor_/.test(n)), 'check: a plan handed to the running desk is reported with what the desk made of it, and its own files are kept on request', r.out.split('\n')[0] + r.err);
  const pages = path.join(home, 'pages.json'); fs.writeFileSync(pages, JSON.stringify({ pages: [{ site: {}, page: { slug: 'ac-repair-plano', title: 'AC Repair in Plano' }, sections: [{ type: 'hero', h1: 'AC Repair in Plano' }] }] }));
  r = run(CLI, ['check', pages], env); ok(r.code === 0 && /ACCEPTED by Publish: 1 page listed as \/ac-repair-plano\//.test(r.out), 'check: a pages file is tried on Publish', r.out + r.err);
  const bad = path.join(home, 'bad.json'); fs.writeFileSync(bad, JSON.stringify({ pages: [{ nope: 1 }] }));
  r = run(CLI, ['check', bad], env); ok(r.code === 1 && /REFUSED by Publish/.test(r.out), 'check: a refusal comes back as a failure, with the dashboard\'s own words', r.out + r.err);
  r = run(CLI, ['check', plan, '--files', path.join(path.dirname(new URL(import.meta.url).pathname), 'kept')], env); ok(r.code === 2 && /inside the repository/.test(r.err), 'check: the desk\'s files are not written inside the repository');
  r = run(CLI, ['heat'], env); ok(r.code === 0 && /This dashboard has no Heat Desk/.test(r.out), 'heat: a build without a Heat Desk says so');
}
ok(before !== null && gitState() === before, 'the repository is as it was');
done();
