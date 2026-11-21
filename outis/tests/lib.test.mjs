/* lib/: sites, settings, places, request rules and the tracker list. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, assert, run } from './harness.mjs';
import { siteOf, siteOfUrl, normalizeSite, patternsFor, contentPatternFor, baseOrigins, MULTI_SUFFIXES } from '../lib/sites.js';
import { DEFAULTS, normalize, shieldFiles, shieldFlags, shieldNeeded, FLAGS } from '../lib/settings.js';
import { PLACES, REGIONS, placeById, placeForZone } from '../lib/places.js';
import { dynamicRules, RULE, HIGH_ENTROPY_HINTS, ALL_TYPES } from '../lib/rules.js';
import { CATEGORIES, SURROGATES, PARAMS, trackerRules, paramRules, categoryOfRule, categoryOfUrl, SUBRESOURCE_TYPES } from '../lib/trackers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('siteOf: registrable domains', () => {
  assert.equal(siteOf('www.example.com'), 'example.com');
  assert.equal(siteOf('a.b.c.example.com'), 'example.com');
  assert.equal(siteOf('shop.example.co.uk'), 'example.co.uk');
  assert.equal(siteOf('example.co.uk'), 'example.co.uk');
  assert.equal(siteOf('me.github.io'), 'me.github.io');
  assert.equal(siteOf('EXAMPLE.com.'), 'example.com');
  assert.equal(siteOf('localhost'), 'localhost');
  assert.equal(siteOf('192.168.1.20'), '192.168.1.20');
  assert.equal(siteOf('[::1]'), '[::1]');
  assert.equal(siteOf(''), '');
});

test('siteOfUrl: only web pages', () => {
  assert.equal(siteOfUrl('https://news.example.com/a?b'), 'example.com');
  assert.equal(siteOfUrl('http://localhost:8080/'), 'localhost');
  assert.equal(siteOfUrl('chrome://settings'), '');
  assert.equal(siteOfUrl('chrome-extension://abc/popup.html'), '');
  assert.equal(siteOfUrl('file:///tmp/x.html'), '');
  assert.equal(siteOfUrl('not a url'), '');
});

test('normalizeSite: what people type', () => {
  assert.equal(normalizeSite('https://www.Example.com/path?q=1'), 'example.com');
  assert.equal(normalizeSite('shop.example.co.uk'), 'example.co.uk');
  assert.equal(normalizeSite('  mail.google.com  '), 'google.com');
  assert.equal(normalizeSite('localhost:3000'), 'localhost');
  assert.equal(normalizeSite('10.0.0.5'), '10.0.0.5');
  assert.equal(normalizeSite('not a site!'), '');
  assert.equal(normalizeSite(''), '');
  assert.equal(normalizeSite('ex ample.com'), '');
  assert.equal(normalizeSite('42'), '', 'a bare number is not a host, though URL() would read it as 0.0.0.42');
});

test('patterns for a site cover it and its subdomains', () => {
  assert.deepEqual(patternsFor('example.com'), ['*://example.com/*', '*://*.example.com/*']);
  assert.deepEqual(patternsFor('localhost'), ['*://localhost/*']);
  assert.deepEqual(patternsFor('10.0.0.5'), ['*://10.0.0.5/*']);
  assert.equal(contentPatternFor('example.com'), '*://*.example.com/*');
  assert.deepEqual(baseOrigins('example.com'), ['https://example.com', 'http://example.com', 'https://www.example.com', 'http://www.example.com']);
});

test('settings: defaults protect everything, and nothing malformed switches anything off', () => {
  const d = normalize(undefined);
  assert.equal(d.enabled, true);
  for (const k of ['trackers', 'cookies', 'links', 'gpc', 'canvas', 'audio', 'device', 'screen', 'language', 'webrtc', 'referrer', 'timezone', 'activity', 'forget']) assert.equal(d[k], true, k);
  assert.equal(d.place, 'nowhere');
  assert.equal(d.location, 'block');
  assert.equal(d.proxy.on, false);
  const bad = normalize({ enabled: 'no', trackers: 0, place: 'atlantis', location: 'maybe', forgetDelay: 7, proxy: { on: 'yes', port: 99999, host: 'bad host!' }, paused: ['ok.com', 'not valid!', 'OK.com', 42], kept: 'x' });
  assert.equal(bad.enabled, true);
  assert.equal(bad.trackers, true);
  assert.equal(bad.place, 'nowhere');
  assert.equal(bad.location, 'block');
  assert.equal(bad.forgetDelay, 15);
  assert.equal(bad.proxy.on, false);
  assert.equal(bad.proxy.port, 9150);
  assert.equal(bad.proxy.host, '127.0.0.1');
  assert.deepEqual(bad.paused, ['ok.com']);
  assert.deepEqual(bad.kept, []);
});

test('settings: the page script gets one file per switched-off module and one for the place', () => {
  assert.deepEqual(shieldFiles(normalize({})), ['inject/places/nowhere.js', 'inject/shield.js']);
  const s = normalize({ canvas: false, timezone: false, location: 'fake', place: 'tokyo' });
  assert.deepEqual(shieldFiles(s), ['inject/opt/no-canvas.js', 'inject/opt/no-timezone.js', 'inject/opt/geo-fake.js', 'inject/places/tokyo.js', 'inject/shield.js']);
  for (const f of shieldFlags(normalize({ canvas: false, audio: false, device: false, screen: false, timezone: false, language: false, referrer: false, activity: false, gpc: false, location: 'off' }))) assert.ok(FLAGS.includes(f), f);
  assert.equal(shieldNeeded(normalize({ enabled: false })), false);
  assert.equal(shieldNeeded(normalize({ canvas: false, audio: false, device: false, screen: false, timezone: false, language: false, referrer: false, activity: false, gpc: false, location: 'off', clipboard: false, appLinks: false, harden: false })), false);
  assert.equal(shieldNeeded(normalize({})), true);
});

test('places: unique ids, valid time zones, coordinates for every city', () => {
  const ids = new Set();
  for (const p of PLACES) {
    assert.ok(!ids.has(p.id), 'duplicate ' + p.id);
    ids.add(p.id);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en-US', { timeZone: p.tz }), p.tz);
    if (p.id !== 'nowhere') {
      assert.ok(REGIONS.includes(p.region), p.id);
      assert.ok(p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180, p.id);
    }
  }
  assert.equal(placeById('nope').id, 'nowhere');
  assert.equal(placeForZone('Asia/Tokyo').id, 'tokyo');
  assert.equal(placeForZone('Antarctica/Troll'), null);
});

test('dynamic rules: headers, referrer and paused sites', () => {
  const r = dynamicRules(normalize({ paused: ['example.com'] }));
  const byId = Object.fromEntries(r.map(x => [x.id, x]));
  assert.deepEqual(byId[RULE.GPC].action.requestHeaders, [{ header: 'Sec-GPC', operation: 'set', value: '1' }]);
  assert.equal(byId[RULE.LANGUAGE].action.requestHeaders[0].value, 'en-US,en;q=0.9');
  assert.deepEqual(byId[RULE.HINTS].action.requestHeaders.map(h => h.header), HIGH_ENTROPY_HINTS);
  assert.ok(!HIGH_ENTROPY_HINTS.includes('sec-ch-ua') && !HIGH_ENTROPY_HINTS.includes('sec-ch-ua-platform') && !HIGH_ENTROPY_HINTS.includes('sec-ch-ua-mobile'));
  assert.deepEqual(byId[RULE.REFERRER].condition, { domainType: 'thirdParty', resourceTypes: ['main_frame'], requestMethods: ['get'] });
  assert.equal(byId[RULE.PAUSE].action.type, 'allowAllRequests');
  assert.deepEqual(byId[RULE.PAUSE].condition.requestDomains, ['example.com']);
  assert.ok(byId[RULE.PAUSE].priority > 2, 'pauses outrank the tracker list and the stand-ins');
  for (const x of r) if ([RULE.GPC, RULE.LANGUAGE, RULE.HINTS].includes(x.id) && x.condition.resourceTypes !== ALL_TYPES) assert.fail('header rules cover every request type');
  assert.deepEqual(dynamicRules(normalize({ enabled: false })), []);
  assert.deepEqual(dynamicRules(normalize({ gpc: false, language: false, device: false, referrer: false, https: false })), []);
});

test('tracker list: valid, unique, third-party only, never the page itself', () => {
  const hostname = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$/;
  const seen = new Set();
  for (const c of CATEGORIES) {
    for (const d of c.domains) {
      assert.match(d, hostname, d);
      assert.ok(!seen.has(d), 'listed twice: ' + d);
      seen.add(d);
    }
  }
  /* No domain may also be covered by a broader entry (it would be listed twice in effect). */
  for (const d of seen) {
    const parts = d.split('.');
    for (let i = 1; i < parts.length - 1; i++) assert.ok(!seen.has(parts.slice(i).join('.')), `${d} is already covered by ${parts.slice(i).join('.')}`);
  }
  /* Content hosts that must never be on the list. */
  for (const d of ['google.com', 'gstatic.com', 'googleapis.com', 'youtube.com', 'facebook.com', 'twitter.com', 'cloudflare.com', 'jsdelivr.net', 'recaptcha.net', 'licdn.com', 'pinimg.com', 'redditstatic.com', 'amazonaws.com', 'cloudfront.net', 'akamaihd.net']) assert.ok(!seen.has(d), d);
  const rules = trackerRules();
  const ids = new Set();
  for (const r of rules) {
    assert.ok(!ids.has(r.id), 'rule id twice: ' + r.id);
    ids.add(r.id);
    assert.equal(r.condition.domainType, 'thirdParty');
    assert.ok(!r.condition.resourceTypes.includes('main_frame'), 'main_frame in rule ' + r.id);
    assert.ok(categoryOfRule(r.id), 'no category for rule ' + r.id);
  }
  assert.ok(!SUBRESOURCE_TYPES.includes('main_frame'));
  for (const s of SURROGATES) {
    assert.ok(fs.existsSync(path.join(ROOT, s.file)), s.file);
    assert.ok(seen.has(s.domain) || CATEGORIES.some(c => c.domains.some(d => s.domain.endsWith(d))), 'stand-in for an unlisted domain: ' + s.domain);
    assert.ok(rules.find(r => r.id === s.id).priority > 1, 'stand-ins outrank the block rules');
  }
});

test('a blocked address maps to its category, anything else to none', () => {
  assert.equal(categoryOfUrl('https://www.google-analytics.com/g/collect?v=2'), 'analytics');
  assert.equal(categoryOfUrl('https://www.googletagmanager.com/gtm.js?id=GTM-1'), 'analytics');
  assert.equal(categoryOfUrl('https://securepubads.g.doubleclick.net/tag/js/gpt.js'), 'ads');
  assert.equal(categoryOfUrl('https://www.facebook.com/tr?id=1&ev=PageView'), 'social');
  assert.equal(categoryOfUrl('https://connect.facebook.net/en_US/fbevents.js'), 'social');
  assert.equal(categoryOfUrl('https://www.google.com/pagead/1p-conversion/1/'), 'ads');
  assert.equal(categoryOfUrl('https://api.fpjs.io/agent'), 'identity');
  assert.equal(categoryOfUrl('https://static.hotjar.com/c/hotjar-1.js'), 'replay');
  assert.equal(categoryOfUrl('https://www.facebook.com/somepage'), null);
  assert.equal(categoryOfUrl('https://www.google.com/search?q=x'), null);
  assert.equal(categoryOfUrl('https://example.com/analytics.js'), null);
  assert.equal(categoryOfUrl('not a url'), null);
});

test('link cleaning: unique names, rules within the regex budget, each removes them all', () => {
  assert.equal(new Set(PARAMS).size, PARAMS.length);
  for (const p of PARAMS) assert.match(p, /^[A-Za-z0-9_-]+$/, p);
  const rules = paramRules();
  const covered = new Set();
  for (const r of rules) {
    assert.deepEqual(r.action.redirect.transform.queryTransform.removeParams, PARAMS);
    assert.ok(r.condition.regexFilter.length < 170, 'regex too long: ' + r.condition.regexFilter.length);
    assert.equal(r.condition.isUrlFilterCaseSensitive, true);
    for (const p of PARAMS) if (new RegExp(r.condition.regexFilter).test('https://x.test/?' + p + '=1')) covered.add(p);
    assert.ok(!new RegExp(r.condition.regexFilter).test('https://x.test/?id=1&page=2'));
  }
  assert.equal(covered.size, PARAMS.length, 'every parameter is matched by some rule');
});

test('generated files are current and the manifest is complete (tools/build.mjs --check)', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('shield carries the same suffix list as lib/sites.js', () => {
  const src = fs.readFileSync(path.join(ROOT, 'inject', 'shield.js'), 'utf8');
  const m = /const SUFFIXES = '([^']*)'/.exec(src);
  assert.ok(m);
  assert.deepEqual(m[1].split(' '), MULTI_SUFFIXES);
});

test('manifest: permissions match what the code uses, nothing extra', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  assert.equal(m.manifest_version, 3);
  assert.ok(m.description.length <= 132, 'Chrome allows 132 characters of description');
  const used = new Set();
  for (const f of ['background.js', 'popup.js', 'options.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const [, api] of src.matchAll(/chrome\.([a-zA-Z]+)\b/g)) used.add(api);
  }
  const need = { alarms: 'alarms', browsingData: 'browsingData', contentSettings: 'contentSettings', cookies: 'cookies', declarativeNetRequest: 'declarativeNetRequest', privacy: 'privacy', proxy: 'proxy', scripting: 'scripting', storage: 'storage', webRequest: 'webRequest' };
  need.downloads = 'downloads';
  for (const api of Object.keys(need)) assert.ok(!used.has(api) || m.permissions.includes(need[api]), `uses chrome.${api} without the permission`);
  /* management is asked for only when the person checks their other extensions, and can be given back */
  assert.ok(used.has('management') && m.optional_permissions.includes('management') && !m.permissions.includes('management'), 'management is optional');
  for (const p of m.permissions) {
    const api = p === 'declarativeNetRequestFeedback' ? 'declarativeNetRequest' : p === 'webRequestAuthProvider' ? 'webRequest' : p;
    assert.ok(used.has(api), `permission ${p} is not used`);
  }
  assert.ok(!m.permissions.includes('tabs') && !m.permissions.includes('history') && !m.permissions.includes('identity'));
  assert.deepEqual(m.host_permissions, ['<all_urls>']);
  assert.ok(m.web_accessible_resources.some(w => w.resources.includes('inject/k') && w.use_dynamic_url === true), 'the session key file is only reachable by the per-session id');
});

test('defaults object is frozen', () => {
  assert.ok(Object.isFrozen(DEFAULTS) && Object.isFrozen(DEFAULTS.proxy) && Object.isFrozen(DEFAULTS.paused));
});

process.exit(await run('lib') ? 1 : 0);
