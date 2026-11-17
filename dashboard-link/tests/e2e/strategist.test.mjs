/* The Content Strategist, a module of its own, in the running dashboard. Needs Playwright with Chromium; without them
   this file says so and passes.

   The content strategist's command line connects a dashboard, reads a site, builds a page, and writes the copy of the
   dashboard with its own module in it (`desk`). The copy is then opened headless: the module must be in the rail under
   its own name, open on its plan, show each of its views without an error, take an order, and hand the built pages to
   the real Publish import box. Runs against the console's atlas (Build 4), and against ATLAS_HTML as well when set. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, atlasFile, sandbox, run, gitState, REPO } from '../_t.mjs';
import * as live from '../../lib/live.mjs';
import { stripPanel } from '../../lib/panel.mjs';

const av = await live.available();
if (!av.ok) { console.log('skip  no browser here, so the Content Strategist module was not opened: ' + av.why); process.exit(0); }
const FX = path.join(REPO, 'content-strategist', 'tests', 'fixtures'), CLI = 'content-strategist/cli.mjs', before = gitState();
const targets = [{ label: 'the console\'s atlas', file: atlasFile() }];
if (process.env.ATLAS_HTML) targets.push({ label: 'ATLAS_HTML', file: path.resolve(process.env.ATLAS_HTML) });

for (const { label, file } of targets) {
  const { home, env } = sandbox({ live: true }), at = (...p) => path.join(home, ...p), go = (args, o) => run(CLI, args, env, o), T = s => `${label}: ${s}`;
  let r = go(['connect', file], { json: true });
  ok(r.code === 0 && r.json.live.ok, T(`connect (Build ${r.json && r.json.identity.build}): the dashboard opens here`), r.err.split('\n')[0]);
  fs.copyFileSync(path.join(FX, 'brand.json'), at('content-strategist', 'brand.json'));
  ok(go(['sitemap', path.join(FX, 'sitemap.xml')]).code === 0 && go(['build', path.join(FX, 'landing.md'), '--date', '2026-11-14']).code === 0 && go(['handoff', '--no-live']).code === 0, T('a site is read, a page is built and handed over'));
  r = go(['plan'], { json: true });
  ok(r.code === 0 && r.json.reads.lines === true && r.json.reads.competitors > 50 && r.json.works.some(w => w.t === 'service-city' && w.jobs > 0 && w.pri != null && w.pub), T('plan: with the dashboard opened once, the works carry the service line model: jobs, priority, pressure and the month to be live by'), r.err.split('\n')[0]);
  r = go(['desk'], { json: true });
  const o = r.json && r.json.opened, copy = r.json && r.json.file;
  ok(r.code === 0 && o && o.present && o.tab && o.shown && !o.failed && o.errors.length === 0 && o.title === 'Content Strategist' && o.state.works === r.json.works && o.state.rows > 0 && o.state.built === 1, T('desk: the copy opens, the Content Strategist is in the rail under its own name, and its plan is drawn'), JSON.stringify(o || r.err.split('\n')[0]));
  ok(stripPanel(fs.readFileSync(copy, 'utf8')) === stripPanel(fs.readFileSync(file, 'utf8')), T('take the block out of the copy and it is the dashboard that was connected'));
  /* every view, an order, and the Publish door, driven the way a person would */
  const seen = await live.withDashboard(copy, async s => {
    const out = await s.run(async () => {
      const wait = ms => new Promise(d => setTimeout(d, ms)), q = sel => document.querySelector(sel), res = { views: {}, agentDesk: !!MODI.agents, num: MODI.strategist.num, last: MODS[MODS.length - 1].key };
      showModule('strategist'); await wait(200);
      for (const v of ['plan', 'city', 'keywords', 'competition', 'pages', 'sources']) { q(`.lvc-tabs button[data-v="${v}"]`).click(); await wait(150); res.views[v] = { chars: q('#lvcView').textContent.length, failed: /failed to load/i.test(q('#mod-strategist').textContent) }; }
      q('.lvc-tabs button[data-v="plan"]').click(); await wait(150);
      const add = q('#lvcBody [data-add]'); if (add) { add.click(); await wait(150); }
      res.order = MODI.strategist.state().order; res.request = (q('#lvcReq') || {}).value || '';
      q('.lvc-tabs button[data-v="pages"]').click(); await wait(150);
      const send = q('#lvcSend'); res.canSend = !!send; if (send) { send.click(); for (let i = 0; i < 100 && !q('#lvcSent').textContent; i++) await wait(100); res.sent = q('#lvcSent').textContent; res.inPublish = MODI.publish && typeof MODI.publish.pages === 'function' ? MODI.publish.pages().map(p => p.slug) : null; }
      return res;
    });
    out.errors = s.errors.slice(); return out;
  });
  ok(Object.values(seen.views).every(v => v.chars > 200 && !v.failed) && seen.errors.length === 0 && seen.last === 'strategist' && seen.agentDesk, T('each of its six views draws without an error; it sits after the Agent Desk'), JSON.stringify(seen.views) + ' ' + seen.errors.join(' | '));
  ok(seen.order === 1 && /Use the leviathan-content-strategist agent to write these pieces/.test(seen.request) && /keyword: /.test(seen.request), T('a work put in the order becomes a request for the agent'));
  ok(seen.canSend && /In Publish, as drafts/.test(seen.sent || '') && Array.isArray(seen.inPublish) && seen.inPublish.includes('ac-repair-plano-tx'), T('the built page goes to Publish through its own import box, as a draft'), seen.sent);
}
ok(before !== null && gitState() === before, 'the repository is as it was');
done();
