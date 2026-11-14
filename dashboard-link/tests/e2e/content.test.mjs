/* The content strategist's pages, through the running dashboard's Publish module. Needs Playwright with Chromium;
   without them this file says so and passes.

   The content strategist's own command line connects a dashboard, builds two pages through its gate, and hands them
   over: `handoff` writes one pages file and drops it on the real Publish import box, headless. What Publish lists is
   what the test reads back. Runs against the console's atlas (Build 4), and against ATLAS_HTML as well when set. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, atlasFile, sandbox, run, gitState, REPO } from '../_t.mjs';
import * as live from '../../lib/live.mjs';

const av = await live.available();
if (!av.ok) { console.log('skip  no browser here, so the Publish module was not tested: ' + av.why); process.exit(0); }
const FX = path.join(REPO, 'content-strategist', 'tests', 'fixtures'), CLI = 'content-strategist/cli.mjs', before = gitState();
const targets = [{ label: 'the console\'s atlas', file: atlasFile() }];
if (process.env.ATLAS_HTML) targets.push({ label: 'ATLAS_HTML', file: path.resolve(process.env.ATLAS_HTML) });

for (const { label, file } of targets) {
  const { home, env } = sandbox({ live: true }), at = (...p) => path.join(home, ...p), go = (args, o) => run(CLI, args, env, o), T = s => `${label}: ${s}`;
  let r = go(['connect', file], { json: true });
  ok(r.code === 0 && r.json.live.ok && r.json.doors.some(d => d.id === 'publish.pages.in'), T(`connect (Build ${r.json && r.json.identity.build}): the dashboard opens, and it has the Publish door`), r.err.split('\n')[0]);
  fs.copyFileSync(path.join(FX, 'brand.json'), at('content-strategist', 'brand.json'));   /* pages in the fixtures are written for this made up brand */
  r = go(['where']); ok(/It runs on this machine, so a pages file can be tried on its Publish module before you hand it over\./.test(r.out), T('where: the dashboard runs here, so pages can be tried on it'));
  ok(go(['sitemap', path.join(FX, 'sitemap.xml')]).code === 0 && go(['build', path.join(FX, 'landing.md'), '--date', '2026-11-14']).code === 0 && go(['build', path.join(FX, 'blog.md'), '--date', '2026-11-14']).code === 0, T('two pages pass the content gate against this dashboard\'s pack'));
  r = go(['handoff'], { json: true });
  const d = r.json && r.json.dashboard;
  ok(r.code === 0 && d && d.accepted === true && d.pages.length === 2 && d.pages.includes('ac-repair-plano-tx') && d.listed.length === 2 && d.listed.every(l => l.row.length > 2) && d.errors.length === 0 && !r.json.notTried, T('handoff: the pages file went onto the real Publish import box, both blueprints were compiled there and listed'), d ? d.verdict : r.err.split('\n')[0]);
  r = go(['handoff']);
  ok(r.code === 0 && /^2 pages {2}-> /.test(r.out) && /Tried on the running dashboard: ACCEPTED by Publish: 2 pages listed as /.test(r.out) && /\/ac-repair-plano-tx\//.test(r.out), T('and the command says so in words a person can act on'), r.out.split('\n').slice(-3).join(' | '));
  r = go(['check', at('content-strategist', 'out', 'ac-repair-plano-tx', 'blueprint.json')]);
  ok(r.code === 0 && /ACCEPTED by Publish: 1 page listed as \/ac-repair-plano-tx\//.test(r.out), T('check: one page\'s blueprint on its own is taken too'));
  const bad = at('bad.json'); fs.writeFileSync(bad, JSON.stringify({ pages: [{ title: 'not a blueprint' }] }));
  r = go(['check', bad]); ok(r.code === 1 && /REFUSED by Publish: "bad\.json: nothing recognisable/.test(r.out), T('check: a file Publish cannot read comes back refused, in the dashboard\'s own words'));
}
ok(before !== null && gitState() === before, 'the repository is as it was');
done();
