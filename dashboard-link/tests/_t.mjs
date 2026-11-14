/* shared by the tests of the link and of the paid ads toolkit: a counter, a scratch folder outside the repository, and a
   dashboard to test against. The dashboard is the DFW Thermal Debt Atlas the console in leviathan/ carries (Build 4,
   with a placeholder brand), written out as the single file it is. No client's dashboard is in the repository; to run
   the browser tests against one as well, point ATLAS_HTML at it. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { consolePayloads } from '../../content-strategist/lib/atlas.mjs';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(DIR, '..', '..');
let fails = 0;
export const ok = (c, label, extra) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? '  (' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).replace(/\s+/g, ' ').slice(0, 320) + ')' : ''}`); if (!c) fails++; };
export const done = () => { if (fails) { console.log(`\n${fails} failed`); process.exit(1); } };
export const tmp = (tag = 'lv-test-') => fs.mkdtempSync(path.join(os.tmpdir(), tag));

/* the console's DFW atlas as text, and as a file in a scratch folder */
let atlasText = null;
export function atlas() { if (atlasText == null) { const p = consolePayloads(REPO).find(x => x.id === 'dfw'); if (!p) throw new Error('the console in leviathan/ carries no DFW atlas'); atlasText = p.text; } return atlasText; }
export function atlasFile(dir = tmp()) { const f = path.join(dir, 'DFW_Thermal_Debt_Atlas_Build4.html'); fs.writeFileSync(f, atlas()); return f; }

/* the day the tests take as today: a Saturday, nine days before the Monday the test plans start on */
export const TODAY = '2026-11-14';
/* an environment in which nothing a command writes can land in the repository: its own home, its own pack folders */
export function sandbox({ live = false } = {}) {
  const home = tmp('lv-home-');
  const env = Object.assign({}, process.env, { LEVIATHAN_HOME: home, LEVIATHAN_DASHBOARD: '', CS_LOCAL: '', CS_OUT: '', CS_BRAND: '', CS_BRAND_JSON: '', PA_LOCAL: '', PA_OUT: '', CS_PACKS: path.join(home, 'packs-content'), PA_PACKS: path.join(home, 'packs-paid'), HTTPS_PROXY: '', https_proxy: '' });
  if (!live) env.LEVIATHAN_NO_LIVE = '1'; else delete env.LEVIATHAN_NO_LIVE;
  env.LEVIATHAN_TODAY = TODAY;   /* "today" for the paid ads command line, so a plan's dates read the same on any day */
  return { home, env };
}
/* runs a command line and returns {code, out, err, json} */
export function run(cli, args, env, { json = false, timeout = 180000 } = {}) {
  const r = spawnSync(process.execPath, [path.join(REPO, cli), ...args, ...(json ? ['--json'] : [])], { encoding: 'utf8', env, timeout, cwd: REPO });
  const res = { code: r.status, out: r.stdout || '', err: r.stderr || '', json: null };
  if (json) { try { res.json = JSON.parse(res.out); } catch { res.json = null; } }
  return res;
}
/* the repository as git sees it, to prove a test left it alone */
export function gitState() { const r = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8', cwd: REPO }); return r.status === 0 ? r.stdout : null; }
/* a brand with a license, a phone and a site, for a dashboard that carries a placeholder */
export const BRAND = { vertical: 'dfw', name: 'Example Air Conditioning & Heating', short: 'Example Air', legalName: 'Example Air LLC', phone: '(972) 555-0142', url: 'https://www.example-air.test', domain: 'example-air.test', license: 'TACLA00000E', licenseLabel: 'TDLR', address: { street: '100 Main St', city: 'Mesquite', state: 'TX', zip: '75150' }, geo: { lat: 32.8063, lon: -96.6609 }, hours: 'Monday to Saturday 7 am to 8 pm, Sunday by appointment', founded: 2001, since: 'family owned since 2001', dealer: ['Carrier'], services: ['AC repair', 'heating repair'], serviceCities: ['Mesquite', 'Dallas', 'Garland'], plan: 'Comfort Club', financing: 'Example Finance',
  offer: { promotion: '$50 off a heating repair', plan: 'Comfort Club', financing: 'Example Finance' }, proof: { reviews: { rating: 4.8, count: 412, asOf: '2026-10-01', source: 'Google' }, guarantee: '', experience: '', since: 'family owned since 2001', founded: 2001, dealer: ['Carrier'] }, social: { facebookPageId: '', gbpAccountId: '', gbpLocationId: '' } };
