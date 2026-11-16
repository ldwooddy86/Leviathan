/* connect, status and the command line, in a sandbox: its own home and its own pack folders, so nothing a command writes
   can land in the repository. No browser is used here (tests/e2e covers the running dashboard). */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, atlas, atlasFile, sandbox, run, gitState, tmp, REPO } from './_t.mjs';
import { findWithheld } from '../../chrome-app/lib/scrub.mjs';
import { READER } from '../lib/read.mjs';

const CLI = 'dashboard-link/cli.mjs', before = gitState();
const { home, env } = sandbox(), file = atlasFile(), at = (...p) => path.join(home, ...p), J = f => JSON.parse(fs.readFileSync(f, 'utf8'));

/* ---- before anything is connected ---- */
let r = run(CLI, ['status'], env);
ok(r.code === 0 && /No dashboard is connected/.test(r.out) && /connect <atlas\.html>/.test(r.out), 'status with nothing connected says so and says how to connect');
r = run(CLI, ['doors'], env);
ok(r.code === 2 && /No dashboard is connected/.test(r.err) && !/at .*\.mjs:\d+/.test(r.err), 'a command that needs a connection stops with the same plain message, no stack');
r = run(CLI, ['nonsense'], env); ok(r.code === 2 && /connect <atlas\.html>/.test(r.out), 'an unknown command prints the help and fails');

/* ---- what connect refuses ---- */
const junk = path.join(tmp(), 'page.html'); fs.writeFileSync(junk, '<html><title>Not an atlas</title></html>');
r = run(CLI, ['connect', junk], env); ok(r.code === 2 && /not a Thermal Debt atlas/.test(r.err), 'a file that is not a Thermal Debt atlas is refused');
r = run(CLI, ['connect', path.join(home, 'missing.html')], env); ok(r.code === 2 && /no file at/.test(r.err), 'a file that is not there is refused');
r = run(CLI, ['connect', file, '--id', 'Bad Id', '--no-live'], env); ok(r.code === 2 && /pack id is 2 to 24 lowercase/.test(r.err), 'a pack id that is not a short lowercase word is refused');
const other = path.join(tmp(), 'other.html'); fs.writeFileSync(other, atlas().replace(/<title>[^<]*<\/title>/, '<title>Houston Thermal Debt Atlas · Build 9</title>'));
r = run(CLI, ['connect', other, '--no-live'], env); ok(r.code === 2 && /Name the pack it should write/.test(r.err) && /Houston Thermal Debt Atlas/.test(r.err), 'an atlas for another market must be given a pack id, so it cannot replace this one\'s');
r = run(CLI, ['connect', file, '--no-live'], Object.assign({}, env, { LEVIATHAN_DASHBOARD: path.join(REPO, 'dashboard-link', 'local') }));
ok(r.code === 2 && /inside the repository/.test(r.err) && !fs.existsSync(path.join(REPO, 'dashboard-link', 'local')), 'a link folder inside the repository is refused, and nothing is written there');
ok(!fs.existsSync(at('dashboard')) && !fs.existsSync(at('packs-paid')), 'a refused connect leaves nothing behind');

/* ---- connect ---- */
r = run(CLI, ['connect', file, '--no-live'], env, { json: true }); const c = r.json;
ok(r.code === 0 && c && c.id === 'dfw' && c.v === 1 && c.identity.atlas === 'DFW Thermal Debt Atlas' && c.identity.build === '4' && /^[0-9a-f]{64}$/.test(c.identity.sha256) && c.identity.zips === 277 && c.modules.length === 16 && c.file === file, 'connect: the atlas, its build and fingerprint, its modules', r.err || (c && c.identity.atlas));
ok(c.packs.content.written && c.packs.paid.written && c.packs.scanned && c.packs.paid.file === at('packs-paid', 'dfw.json') && c.packs.content.file === at('packs-content', 'dfw.json'), 'both packs are written, scanned against the withheld list');
ok(c.live.ok === false && /LEVIATHAN_NO_LIVE|not asked for/.test(c.live.why) && !fs.existsSync(at('dashboard', 'live.json')), 'with no browser asked for, the connection says the dashboard was read as text only');
ok(c.counts.angles >= 17 && c.counts.zips === 263 && c.counts.rules === 22 && c.counts.lines === 14 && c.counts.competitors > 200 && c.drift.length === 0, 'counts: angles, ZIP markets, rules, service lines, competitors; no rule out of step', c.counts);
ok(c.doors.some(d => d.id === 'desk.plan.in' && d.agent === 'paid') && c.doors.some(d => d.id === 'publish.pages.in' && d.agent === 'content'), 'its doors: a plan for the Campaign Desk, pages for Publish');
const cap = (list, what) => list.find(x => x.what.startsWith(what));
ok(cap(c.capabilities.paid, 'Campaign Desk takes a plan file').ok && cap(c.capabilities.paid, 'Paid model by ZIP').ok && cap(c.capabilities.paid, 'Advertising rules').ok && !cap(c.capabilities.paid, 'Heat Desk').ok && !cap(c.capabilities.paid, 'Computed model').ok && !cap(c.capabilities.paid, 'Brand with a license number').ok && cap(c.capabilities.content, 'Publish takes a pages file').ok && cap(c.capabilities.content, 'Deep pack').ok, 'what each agent can do: Build 4 has no Heat Desk, no browser means no computed model, the placeholder brand has no license');

/* ---- what it leaves behind ---- */
for (const f of ['connection.json', 'atlas.html', 'model.json', 'competitors.json']) ok(fs.existsSync(at('dashboard', f)), 'outside the repository: dashboard/' + f);
ok(fs.readFileSync(at('dashboard', 'atlas.html'), 'utf8') === atlas() && fs.readFileSync(file, 'utf8') === atlas(), 'the copy is the file, byte for byte, and the file itself is untouched');
const M = J(at('dashboard', 'model.json')), K = J(at('dashboard', 'competitors.json')), B = J(at('content-strategist', 'brand.json'));
ok(M.id === 'dfw' && M.sha256 === c.identity.sha256 && M.zips.length === 263 && K.companies.length > 200 && K.sha256 === c.identity.sha256, 'the model and the roster carry the fingerprint of the file they were read from');
ok(B.vertical === 'dfw' && B.name === 'Your HVAC Company' && B.license === '' && B.offer && B.offer.promotion === '' && B.proof && B.proof.reviews && B.proof.reviews.source === 'Google' && B.proof.reviews.count === null && Array.isArray(B.proof.dealer) && B.social && c.brandFile === at('content-strategist', 'brand.json'), 'the brand file both agents read: the profile, the offer, the proof points', B.name);
const P = J(at('packs-paid', 'dfw.json')), CP = J(at('packs-content', 'dfw.json'));
ok(P.format === 1 && P.id === 'dfw' && P.depth === 'paid' && P.source.sha256 === c.identity.sha256.slice(0, 16) && P.source.build === '4' && P.angles.length === c.counts.angles && P.rules.rules.length === 22 && P.platforms.order.length === 8 && P.service.lines.length === 14 && P.defaults.budget === 15000 && /grade/.test(P.note), 'the paid pack: angles, rules, the platform book, the service lines, a note on what the numbers are');
ok(!('zips' in P) && !('brand' in P) && !('competitors' in P) && !JSON.stringify(P).includes('Your HVAC Company') && !findWithheld(JSON.stringify(P), 1).length && !findWithheld(JSON.stringify(CP), 1).length, 'no ZIP model, no brand, no competitor and no withheld name is in a pack');
ok(CP.depth === 'deep' && CP.id === 'dfw' && CP.source.sha256 === P.source.sha256 && J(at('packs-content', 'index.json')).packs.some(x => x.id === 'dfw'), 'the content strategist\'s deep pack comes from the same file');

/* ---- connecting the same file again changes no pack ---- */
const stamp = f => fs.statSync(f).mtimeMs + ':' + fs.readFileSync(f, 'utf8').length, s1 = [stamp(at('packs-paid', 'dfw.json')), stamp(at('packs-content', 'dfw.json'))];
B.social.facebookPageId = '1234567890'; fs.writeFileSync(at('content-strategist', 'brand.json'), JSON.stringify(B));
r = run(CLI, ['connect', file, '--no-live', '--no-copy'], env, { json: true });
ok(r.code === 0 && r.json.packs.paid.written === false && r.json.packs.content.written === false && s1.join() === [stamp(at('packs-paid', 'dfw.json')), stamp(at('packs-content', 'dfw.json'))].join(), 'the same file again: neither pack is rewritten');
ok(r.json.copy === null && J(at('content-strategist', 'brand.json')).social.facebookPageId === '1234567890', 'an account id the person added to the brand file survives a reconnect; --no-copy keeps no copy');
r = run(CLI, ['connect', file, '--no-live'], env, { json: true }); ok(r.json.copy === at('dashboard', 'atlas.html'), 'and with a copy again');
/* ---- the pin: one version of the dashboard and no other ---- */
{ const cf = at('packs-content', 'dfw.json'), newer = path.join(tmp(), '1a2b3c4d-DFW_Atlas_next.html'); fs.writeFileSync(newer, atlas() + '\n<!-- a later build of the same dashboard -->');
  ok(!J(cf).source.pin && /not pinned to a version/.test(run(CLI, ['status'], env).out), 'a dashboard is not pinned until someone asks for that');
  r = run(CLI, ['connect', file, '--no-live', '--no-copy', '--pin'], env, { json: true }); const pin = J(cf).source.pin;
  ok(r.code === 0 && r.json.pin && pin && pin.sha256 === J(cf).source.sha256 && pin.file === path.basename(file) && /^\d{4}-\d\d-\d\d$/.test(pin.since) && r.json.packs.content.written === true && r.json.packs.paid.written === false, 'connect --pin records the dashboard\'s fingerprint on the pack in the repository', pin);
  ok(/pinned to .* since \d{4}/.test(run(CLI, ['status'], env).out), 'status says which version is pinned');
  const stampNow = fs.readFileSync(cf, 'utf8'), linkNow = fs.readFileSync(at('dashboard', 'connection.json'), 'utf8');
  r = run(CLI, ['connect', newer, '--no-live'], env);
  ok(r.code === 2 && /not the dashboard version the repository is pinned to/.test(r.err) && r.err.includes('pinned: ' + pin.file) && /given: {2}DFW_Atlas_next\.html/.test(r.err) && /--pin/.test(r.err) && fs.readFileSync(cf, 'utf8') === stampNow && fs.readFileSync(at('dashboard', 'connection.json'), 'utf8') === linkNow, 'another version is refused before anything is read or written, and the message names both files without the upload id', r.err.slice(0, 200));
  r = run(CLI, ['connect', file, '--no-live', '--no-copy'], env, { json: true });
  ok(r.code === 0 && r.json.packs.content.written === false && J(cf).source.pin.since === pin.since, 'the pinned version itself connects as before, and the pin stays on the pack');
  r = run(CLI, ['connect', newer, '--no-live', '--no-copy', '--pin'], env, { json: true });
  ok(r.code === 0 && J(cf).source.pin.file === 'DFW_Atlas_next.html' && J(cf).source.pin.sha256 !== pin.sha256 && run(CLI, ['connect', file, '--no-live'], env).code === 2, 'only connect --pin moves the pin, and then the old version is the one refused');
  r = run(CLI, ['connect', file, '--no-live', '--pin'], env, { json: true }); ok(r.code === 0 && J(cf).source.pin.sha256 === pin.sha256, 'and back'); }

/* a content pack read by an older reader, from the very same file, is read again: the reader has learned to read more */
{ const cf = at('packs-content', 'dfw.json'), old = J(cf); delete old.source.reader; delete old.needs; fs.writeFileSync(cf, JSON.stringify(old));
  r = run(CLI, ['connect', file, '--no-live', '--no-copy'], env, { json: true }); const again = J(cf);
  ok(r.code === 0 && r.json.packs.content.written === true && r.json.packs.paid.written === false && again.source.reader >= 2 && Array.isArray(again.needs) && again.needs.length >= 15, 'a pack an older reader left is read again from the same file, and gains what the reader now reads', [r.json.packs.content.written, again.source.reader]); }

/* ---- status, doors, read ---- */
r = run(CLI, ['status'], env);
ok(r.code === 0 && /Connected: DFW Thermal Debt Atlas · Build 4/.test(r.out) && /263 ZIP markets/.test(r.out) && /running the dashboard here: no/.test(r.out) && /Paid ads specialist/.test(r.out) && /Content strategist/.test(r.out) && !/PROBLEM/.test(r.out), 'status: what is connected and what each agent can do with it');
r = run(CLI, ['doors'], env); ok(r.code === 0 && /Campaign Desk, ⤒ Load/.test(r.out) && /import box/.test(r.out), 'doors: how a person opens each one');
const plan = path.join(home, 'campaign-desk-plan.json'); fs.writeFileSync(plan, JSON.stringify({ line: 'heat', budget: 9000, start: '2026-11-23', weeks: 10, scope: 'picks', picks: ['75150'], handoff: { agent: 'paid-ads-specialist', made: '2026-11-14T10:00:00Z' } }));
r = run(CLI, ['read', plan], env); ok(r.code === 0 && /A Campaign Desk plan: line heat, \$9000 a month, 10 weeks from 2026-11-23, scope picks, 1 ZIP picked\. Made by paid-ads-specialist on 2026-11-14/.test(r.out), 'read: a desk plan and who made it', r.out);
const led = path.join(home, 'ledger.json'); fs.writeFileSync(led, JSON.stringify({ exported: '2026-11-01', obs: [{ src: 'seed', kind: 'offer', compName: 'A Co', offer: { type: 'price', price: 79, text: '$79 tune up' }, lint: [] }], meta: {} }));
r = run(CLI, ['read', led], env); ok(r.code === 0 && /Competitor ledger, exported 2026-11-01: 1 entries/.test(r.out) && /No live ads are logged\. That is a gap in the log/.test(r.out) && /A Co \$79/.test(r.out), 'read: the competitor ledger, with what an empty log does and does not mean');
const not = path.join(home, 'x.json'); fs.writeFileSync(not, '{"hello":1}'); r = run(CLI, ['read', not], env); ok(r.code === 2 && /not a file this link knows/.test(r.err), 'read: a file that is none of these is refused');

/* ---- what needs a browser says so ---- */
r = run(CLI, ['check', plan], env); ok(r.code === 3 && /no browser is available here: LEVIATHAN_NO_LIVE is set/.test(r.err), 'check without a browser stops with its own exit code and the reason', r.err);
r = run(CLI, ['heat'], env); ok(r.code === 3 && /no browser is available/.test(r.err), 'so does heat');

/* ---- a connection out of step with what is on disk ---- */
fs.renameSync(at('dashboard', 'model.json'), at('dashboard', 'model.away'));
r = run(CLI, ['status'], env); ok(r.code === 1 && /PROBLEM {2}The ZIP model is missing/.test(r.out), 'status fails when the ZIP model is gone');
fs.renameSync(at('dashboard', 'model.away'), at('dashboard', 'model.json'));
const pp = at('packs-paid', 'dfw.json'), keep = fs.readFileSync(pp, 'utf8'), swapped = JSON.parse(keep); swapped.source.sha256 = '0'.repeat(16); swapped.source.build = '3'; fs.writeFileSync(pp, JSON.stringify(swapped));
r = run(CLI, ['status'], env); ok(r.code === 1 && /The paid pack in the repository was read from another dashboard file \(Build 3\)/.test(r.out), 'and when a pack was read from another dashboard file');
r = run(CLI, ['connect', file, '--no-live'], env, { json: true }); ok(r.json.packs.paid.written === true && J(pp).source.build === '4' && run(CLI, ['status'], env).code === 0, 'connecting again puts it right');

const older = J(pp); older.source.reader = READER - 1; delete older.desk; fs.writeFileSync(pp, JSON.stringify(older));
r = run(CLI, ['connect', file, '--no-live'], env, { json: true }); ok(r.json.packs.paid.written === true && J(pp).source.reader === READER && J(pp).desk && /^[0-9a-f]{12}$/.test(J(pp).desk.code), 'a pack read by an older reader is written again from the same file, and carries the desk\'s fingerprint');

ok(before !== null && gitState() === before, 'the repository is as it was: nothing a command wrote landed in it');
done();
