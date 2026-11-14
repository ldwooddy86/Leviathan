/* lib/handoff.mjs: the files that cross between an agent and the dashboard. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, atlas, tmp } from './_t.mjs';
import { library, model } from '../lib/read.mjs';
import { note, deskPlan, deskPlanFile, pagesFile, isBlueprint, kindOf, readFile, ledger, actuals, HANDOFF } from '../lib/handoff.mjs';

const text = atlas(), lib = library(text), mdl = model(text, lib), pack = { lines: lib.lines, angles: lib.angles, platforms: lib.platforms, defaults: lib.defaults };
const ctx = { pack, model: mdl }, collin = mdl.counties.find(c => c.name === 'Collin').fips;

/* ---- a plan for the Campaign Desk ---- */
let r = deskPlan({ line: 'heat', budget: 12000, start: '2026-11-23', weeks: 8, scope: 'picks', picks: ['75150', '75149'], bids: { 75150: 20 }, mix: { google: 60, lsa: 30, meta: 10 }, angles: ['heatpump', 'furnace'] }, ctx);
ok(!r.problems.length && r.plan.line === 'heat' && r.plan.picks.length === 2 && r.plan.bids['75150'] === 20 && r.plan.mix.dg === 0 && Object.keys(r.plan.mix).length === 8 && r.plan.angles.length === 2, 'a sound plan passes whole, every platform of the desk named in the mix', r.problems);
ok(!('v' in r.plan) && deskPlan({ line: 'heat', start: '2026-11-23' }, { pack: Object.assign({}, pack, { defaults: Object.assign({}, pack.defaults, { v: 5 }) }), model: mdl }).plan.v === 5, 'the plan carries the desk\'s plan version when the build has one, so the desk does not treat it as an old plan');
r = deskPlan({ line: 'heating', budget: -5, start: '11/23/2026', weeks: 80, scope: 'zip', picks: ['75150', '99999', '1234'], counties: ['Collin'], angles: ['furnace', 'bogus'], mix: { google: 60, tiktok: 40, lsa: 'much' }, asm: { google: { cost: 'high', cvr: 5 }, tiktok: { cost: 1 } }, bids: { 99999: 10, 75150: 2000 }, extra: 1 }, ctx);
const P = r.problems.join(' | ');
ok(/not a Campaign Desk line/.test(P) && /not a date/.test(P) && /outside 1 to 52/.test(P) && /positive number/.test(P) && /not top, county or picks/.test(P) && /2 ZIPs the dashboard does not score/.test(P) && /five digit FIPS/.test(P) && /angles the desk would drop: bogus/.test(P) && /"tiktok", which is not one of the desk's platforms/.test(P) && /mix\.lsa must be a number/.test(P) && /asm\.google\.cost must be a number/.test(P) && /bids names ZIP 99999/.test(P) && /minus 90% to plus 900%/.test(P), 'everything the desk would drop or replace without a word is said', r.problems.length + ' problems');
ok(r.plan.picks.join() === '75150' && r.plan.angles.join() === 'furnace' && r.plan.weeks === 52 && !('line' in r.plan) && r.notes.some(n => /"extra" is not a key the desk keeps/.test(n)), 'and the plan that is left holds only what the desk would keep');
ok(deskPlan({ line: 'heat', start: '2026-11-23', scope: 'picks' }, ctx).problems.some(p => /no ZIP is picked/.test(p)) && deskPlan({ line: 'heat', start: '2026-11-23', scope: 'county', counties: [collin] }, ctx).problems.length === 0 && deskPlan({ line: 'heat', start: '2026-11-23', mix: { google: 30, lsa: 30 } }, ctx).notes.some(n => /rescales/.test(n)) && deskPlan({ line: 'heat', start: '2026-02-30' }, ctx).problems.length === 1, 'an empty pick list, a real county, a mix that does not add to 100, a day that does not exist');
const h = note('paid-ads-specialist', { identity: { atlas: 'DFW Thermal Debt Atlas', build: '4', sha256: 'a'.repeat(64) } }, { campaign: 'x' }), file = JSON.parse(deskPlanFile(r.plan, h));
ok(file.handoff.format === HANDOFF && file.handoff.agent === 'paid-ads-specialist' && file.handoff.atlas.build === '4' && file.handoff.atlas.sha256.length === 16 && file.handoff.campaign === 'x' && file.picks.length === 1, 'the file carries a note: who made it, when, for which build');

/* ---- pages for Publish ---- */
const bp = (slug, title = 'T') => ({ site: {}, page: { slug, title }, sections: [{ type: 'hero', h1: title }] });
let pg = pagesFile([bp('a'), bp('b')], h), pj = JSON.parse(pg.file);
ok(!pg.problems.length && pg.count === 2 && Array.isArray(pj.pages) && pj.pages.length === 2 && pj.handoff.agent === 'paid-ads-specialist' && !('page' in pj), 'blueprints go out as a pages list, which is what Publish reads');
pg = pagesFile([bp('a'), bp('a'), { nope: 1 }, bp('', 'X'), { page: { slug: 'z' }, sections: [] }], h);
ok(pg.problems.some(p => /not a FORGE blueprint/.test(p)) && pg.problems.some(p => /share a slug/.test(p)) && pg.problems.some(p => /no page\.slug/.test(p)) && pg.problems.some(p => /no title/.test(p)) && isBlueprint(bp('q')) && !isBlueprint({ page: 1, sections: [] }), 'what is not a blueprint, a slug used twice, a page with no slug or no title');

/* ---- what a file from the dashboard is ---- */
ok(kindOf(file) === 'desk-plan' && kindOf(pj) === 'pages' && kindOf(bp('a')) === 'pages' && kindOf({ obs: [], meta: {} }) === 'ledger' && kindOf({ actuals: {} }) === 'actuals' && kindOf({ hello: 1 }) === '' && kindOf(null) === '' && kindOf({ line: 'heat' }) === '', 'a desk plan, a pages file, the competitor ledger, account results, and none of these');
const d = tmp(), f = path.join(d, 'x.json'); fs.writeFileSync(f, '﻿' + JSON.stringify({ line: 'heat', budget: 1 })); ok(readFile(f).kind === 'desk-plan', 'a file is read past its byte order mark');
fs.writeFileSync(f, 'not json'); ok((() => { try { readFile(f); return false; } catch (e) { return /not JSON/.test(e.message); } })(), 'a file that is not JSON says so');

/* ---- the competitor ledger ---- */
const today = new Date().toISOString().slice(0, 10), old = '2025-01-01';
const L = ledger({ exported: today, obs: [
  { src: 'seed', kind: 'offer', platform: 'site', status: 'unknown', compName: 'A Co', line: 'maint', last: old, offer: { type: 'price', text: '$79 tune up', price: 79, fin: '' }, lint: [] },
  { src: 'seed', kind: 'offer', platform: 'site', status: 'unknown', compName: 'B Co', line: 'replace', last: old, offer: { type: 'financing', text: '', price: null, fin: '0% for 60 months' }, lint: ['REGZ1'] },
  { src: 'manual', kind: 'ad', platform: 'meta', status: 'active', compName: 'A Co', comp: 'a.co', line: 'heat', hook: 'cold snap', last: today, offer: { type: 'none', text: '', price: null, fin: '' }, lint: [] },
  { src: 'import', kind: 'ad', platform: 'google', status: 'inactive', compName: 'C Co', line: 'repair', hook: 'speed', last: today, offer: { type: 'discount', text: '$50 off', price: 50, fin: '' }, lint: [] },
  { src: 'manual', kind: 'ad', platform: 'meta', status: 'unknown', compName: 'D Co', line: '', hook: 'other', last: old, offer: { type: 'none' }, lint: [] },
], meta: {} });
ok(L.entries === 5 && L.seeded === 2 && L.logged === 3 && L.ads === 3 && L.liveAds === 1 && L.byCompany[0].k === 'A Co' && L.byPlatform[0].k === 'meta' && L.prices.map(p => p.price).join() === '50,79' && L.financing.length === 1 && L.financing[0].flags.join() === 'REGZ1' && L.lastLogged === today, 'the ledger: seeded against logged, live ads by company, prices low to high, financing offers with their flags', L);

/* ---- account results ---- */
const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const R = actuals({ exported: today, actuals: {
  google: { rows: [{ src: 'google', kind: 'ads', date: day(3), hour: null, line: 'heat', spend: 600, clicks: 60, imp: 900, leads: 4, calls: 2 }, { src: 'google', kind: 'ads', date: day(4), hour: 14, line: 'heat', spend: 999, clicks: 99 }, { src: 'google', kind: 'geo', date: day(4), line: 'heat', spend: 999 }, { src: 'google', kind: 'ads', date: day(400), hour: null, line: 'heat', spend: 5000, clicks: 500 }] },
  'import:meta': { rows: [{ kind: 'ads', date: day(2), hour: null, line: '', spend: 100, clicks: 10, leads: 0, calls: 0 }, { kind: 'lead', date: day(1), line: 'maint', leads: 1, calls: 0 }] },
} });
const gh = R.rows.find(x => x.line === 'heat' && x.platform === 'google'), un = R.rows.find(x => x.line === 'unmapped');
ok(R.rowsRead === 3 && gh.spend === 600 && gh.clicks === 60 && gh.cpc === 10 && gh.cpl === 100 && gh.leadRate === 10 && gh.thin === false && un.platform === 'meta' && un.thin === true && R.unmapped === 100 && R.from === day(3) && R.to === day(1), 'results: daily ad rows and lead rows only, inside the window; rates by line and platform; thin ones marked; unmapped spend counted', R.rows);
done();
