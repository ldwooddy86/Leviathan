/* What a page may claim about the company: the manufacturers it names, held against the client's own site, and its
   review score, which comes from one figure on file and is never typed. The gate first, then the command line. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ok, done, FX, ROOT, tmp } from './_t.mjs';
import { parseMarkdown } from '../lib/doc.mjs';
import { lint } from '../lib/lint.mjs';

const HEAD = '---\ntype: landing\nvertical: dfw\nangle: heatrepair\nkeyword: furnace repair plano\nslug: furnace-repair-plano-tx\ntitle: Furnace Repair in Plano, TX | Example Air\ndescription: Furnace repair in Plano from licensed technicians who show you the price before they start the work. Call us for a repair visit today, six days a week.\n---\n# Furnace Repair in Plano, TX\n\n';
const page = body => parseMarkdown(HEAD + body + '\n'), rules = (r, rule) => r.findings.filter(f => f.rule === rule);
const BRAND = { url: 'https://www.example-air.test', dealer: ['Carrier'] };
const SITE = { ageHours: 1, pages: [{ path: '/case-studies/carrier-infinity-systems/', kind: 'post' }, { path: '/mitsubishi-electric-solutions/', kind: 'page' }, { path: '/amana-wins-an-award/', kind: 'post' }] };

/* ---- the makers a page names ---- */
let r = lint(page('We install Carrier furnaces and Mitsubishi Electric mini splits. We also repair Trane and Amana furnaces.'), { brand: BRAND, inventory: SITE });
ok(rules(r, 'make').map(f => f.severity).join() === 'error,error' && /Trane/.test(rules(r, 'make')[0].message) && /only in articles/.test(rules(r, 'make')[1].message) && !r.ok, 'a page that names a maker the client\'s site does not show fails the gate; one the site shows only in articles fails too', rules(r, 'make').map(f => f.message));
ok(rules(lint(page('We install Carrier furnaces and Mitsubishi Electric mini splits.'), { brand: BRAND, inventory: SITE }), 'make').length === 0, 'makers the brand file vouches for or the site shows on a page of its own pass');
ok(rules(lint(page('We also repair Trane furnaces.'), { brand: Object.assign({}, BRAND, { makes: ['Trane'] }), inventory: SITE }), 'make').length === 0, 'and so does one the owner put on the brand file\'s makes list');
ok(/sitemap has not been read/.test((rules(lint(page('We also repair Trane furnaces.'), { brand: BRAND, inventory: null }), 'make')[0] || {}).message || '') && rules(lint(page('We also repair Trane furnaces.'), { brand: BRAND }), 'make').length === 0, 'with no sitemap read the maker is an error that says to read it; a caller that passes no inventory at all is not checked');
ok(rules(lint(page('We also repair Trane furnaces.'), { brand: BRAND, inventory: SITE, allow: ['make'] }), 'make').length === 0, 'the rule can be set aside by name, like any other');

/* ---- the review score ---- */
const FIG = { rating: 4.9, count: 900, atLeast: true, asOf: '2026-11-17', source: 'Google', from: 'person', ageDays: 0, stale: false };
ok(rules(lint(page('Homeowners rate us 4.9 from over 900 Google reviews.'), { brand: BRAND, reviews: FIG }), 'reviews').length === 0, 'the score as the figure on file has it passes');
r = lint(page('Homeowners rate us 4.8 stars from 915 Google reviews.'), { brand: BRAND, reviews: FIG });
ok(rules(r, 'reviews').length === 2 && rules(r, 'reviews').every(f => f.severity === 'error') && /\{reviews\.rating\}/.test(rules(r, 'reviews')[0].message) && /\{reviews\.floor\}/.test(rules(r, 'reviews')[1].message), 'a typed rating or count that is not the figure\'s is an error, and the fix it names is the token', rules(r, 'reviews').map(f => f.message));
ok(rules(lint(page('Rated 4.9 from over 900 Google reviews.'), { brand: BRAND, reviews: Object.assign({}, FIG, { ageDays: 40, stale: true }) }), 'reviews').map(f => f.severity).join() === 'warn' && rules(lint(page('Rated 4.9 stars.'), { brand: BRAND, reviews: null }), 'reviews').map(f => f.severity).join() === 'error', 'a figure over a month old warns; a claim with no figure on file is an error');
ok(/\{reviews\.count\}/.test((rules(lint(page('We fix furnaces.'), { brand: BRAND, reviews: FIG, unfilled: ['count'] }), 'reviews')[0] || {}).message || ''), 'a token the figure cannot fill is an error');

/* ---- the command line ---- */
const local = tmp(), env = Object.assign({}, process.env, { CS_LOCAL: local, CS_OUT: path.join(local, 'out'), CS_BRAND: path.join(FX, 'brand.json'), HTTPS_PROXY: '', https_proxy: '', CS_BRAND_JSON: '', LEVIATHAN_HOME: path.join(local, 'home'), LEVIATHAN_DASHBOARD: '', GOOGLE_PLACES_API_KEY: '' });
const run = args => { const x = spawnSync(process.execPath, [path.join(ROOT, 'cli.mjs'), ...args], { encoding: 'utf8', env, timeout: 120000 }); return { code: x.status, out: x.stdout || '', err: x.stderr || '' }; };
let c = run(['reviews']);
ok(c.code === 0 && /Review figure: none on file/.test(c.out) && /not linked yet/.test(c.out), 'reviews: with nothing on file it says so, and how to link the profile');
c = run(['reviews', 'set', '--rating', '4.9', '--count', '900']);
const kept = path.join(local, 'home', 'dashboard', 'reviews.json');
ok(c.code === 0 && /4\.9 from at least 900 Google reviews, set by a person/.test(c.out) && /\{reviews\.line\}\s+4\.9 from over 900 Google reviews/.test(c.out) && /\{reviews\.count\}\s+\(not on file: only a floor is known\)/.test(c.out) && fs.existsSync(kept) && JSON.parse(fs.readFileSync(kept, 'utf8')).figure.from === 'person', 'reviews set: a person\'s word for the score, kept outside the repository, with the words each token will carry', c.out);
ok(run(['reviews', 'set', '--count', '900']).code === 2 && run(['reviews', 'sync']).code === 2 && /No Google profile is linked/.test(run(['reviews', 'sync']).err) && run(['reviews', 'nonsense']).code === 2, 'a set with no rating, a sync with no profile linked and an unknown subcommand each stop and say why');
const md = path.join(local, 'tokens.md'); fs.writeFileSync(md, HEAD + 'Homeowners rate us {reviews.rating}, from over {reviews.floor} {reviews.source} reviews. We install Carrier furnaces.\n');
c = run(['lint', md, '--json']); let j = JSON.parse(c.out);
ok(!j.findings.some(f => f.rule === 'reviews'), 'lint fills the review tokens from the figure on file before it reads the page, so a page that writes them passes', j.findings.filter(f => f.rule === 'reviews'));
fs.writeFileSync(md, HEAD + 'Homeowners rate us 4.7 stars. Exact count: {reviews.count}.\n'); j = JSON.parse(run(['lint', md, '--json']).out);
ok(j.findings.filter(f => f.rule === 'reviews' && f.severity === 'error').length === 2, 'a typed rating that is not the figure\'s, and a token a floor cannot fill, both fail', j.findings.filter(f => f.rule === 'reviews').map(f => f.message));
c = run(['makes']);
ok(c.code === 0 && /from the brand file alone/.test(c.out), 'makes: before the sitemap is read it says the brand file is all it has');
run(['sitemap', path.join(FX, 'sitemap.xml')]); c = run(['makes']);
ok(c.code === 0 && /from the brand file and the client's sitemap \(\d+ addresses/.test(c.out), 'and after, it reads the site too', c.out.split('\n')[0]);
fs.writeFileSync(md, HEAD + 'We also repair Trane and Lennox furnaces.\n'); j = JSON.parse(run(['lint', md, '--json']).out);
ok(j.findings.filter(f => f.rule === 'make' && f.severity === 'error').length === 2 && run(['makes', md]).code === 1 && /names 2 that nothing stands behind/.test(run(['makes', md]).out), 'lint and makes both refuse a page that names makers the site does not show', j.findings.filter(f => f.rule === 'make').map(f => f.message));
done();
