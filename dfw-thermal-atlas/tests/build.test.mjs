import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validate, sections, render, registry, registryScript, liveSync, liveList, zip, appFiles, APP, ROOT } from '../build.mjs';
import { context, load } from './helpers/load.mjs';

const manifest = JSON.parse(readFileSync(join(APP, 'manifest.json'), 'utf8'));

test('the tree passes the build check', () => { assert.deepEqual(validate(), []); });

test('both editions carry the same sections in the same order', () => {
  const s = sections('single').map(x => x.path), e = sections('ext').map(x => x.path);
  assert.deepEqual(s, e); assert.ok(s.length >= 50);
  assert.equal(s[0], 'css/atlas.css'); assert.equal(s[s.length - 1], 'js/99_shell.js', 'the shell boots last');
  const at = p => s.indexOf(p);
  assert.ok(at('data/atlas-data.js') < at('js/00_core.js'), 'data before code');
  assert.ok(at('js/00_core.js') < at('live/core.js') && at('live/core.js') < at('live/geo.js') && at('live/derive.js') < at('live/page.js'), 'live layer: core, geo, sources, derive, page');
  assert.ok(liveList().every(p => at(p) < at('live/page.js')), 'every collector loads before the page glue');
  assert.ok(at('live/page.js') < at('js/13_m01_index.js'), 'the live layer loads before the modules');
});

test('the browser app page has no inline script and every file it names exists', () => {
  const page = render('ext');
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(page));
  const refs = [...page.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"/g)].map(m => m[1]);
  assert.ok(refs.length >= 50); for (const r of refs) assert.ok(!/^https?:/.test(r) && existsSync(join(APP, r)), r);
  assert.ok(refs.includes('fonts/fonts.css') && !/fonts\.googleapis\.com/.test(page), 'fonts come from the app, not from Google');
  assert.equal(readFileSync(join(APP, 'atlas.html'), 'utf8'), page, 'app/atlas.html is current (run node build.mjs)');
});

test('the single file edition is self contained and whole', () => {
  const single = render('single');
  assert.ok(!/<script[^>]*\bsrc=/.test(single.replace(/<script>[\s\S]*?<\/script>/g, '')), 'no external script tags outside inline code');
  assert.equal((single.match(/<script>\n/g) || []).length, sections('single').filter(s => s.kind === 'js').length);
  assert.ok(single.includes('window.__ATLAS_DATA__ = {') && single.includes('const LIVE = (() => {') && single.trimEnd().endsWith('</html>'));
  assert.ok(/fonts\.googleapis\.com/.test(single), 'the single file links the web fonts');
});

test('manifest: version 3, least privilege, every collector host granted', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions.slice().sort(), ['alarms', 'notifications', 'storage', 'unlimitedStorage']);
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");
  const L = load(context(), ...liveList()).TDA_LIVE;
  const granted = manifest.host_permissions.map(h => { assert.match(h, /^https:\/\/[a-z0-9.-]+\/\*$/, h + ' is an exact https host'); return h.slice(8, -2); });
  const need = [...new Set(L.SOURCES.flatMap(s => s.hosts))];
  assert.ok(need.length >= 1); for (const h of need) assert.ok(granted.includes(h), `host_permissions lacks ${h}`);
  for (const h of ['api.weather.gov', 'www.spc.noaa.gov']) assert.ok(granted.includes(h), 'the Weather Desk calls ' + h);
  for (const h of granted) assert.ok(need.includes(h) || ['api.weather.gov', 'www.spc.noaa.gov'].includes(h), `${h} is granted but nothing calls it`);
  assert.ok(!manifest.host_permissions.some(h => /\*\./.test(h) || h === '<all_urls>' || h === 'https://*/*'), 'no wildcard host at install');
});

test('the worker and the popup load the same live layer as the page', () => {
  for (const f of liveSync()) assert.equal(f.now, f.want, f.file);
  const bg = readFileSync(join(APP, 'background.js'), 'utf8');
  assert.match(bg, /importScripts\('live\/core\.js', 'live\/geo\.js'/);
  assert.ok(!/live\/page\.js/.test(bg), 'page.js needs the DOM and stays out of the worker');
});

test('registry: every module in rail order, every ZIP, in step with the file on disk', () => {
  const r = registry();
  assert.equal(r.version, manifest.version);
  assert.ok(r.modules.length >= 17); assert.equal(r.modules[0].key, 'index'); assert.ok(r.modules.some(m => m.key === 'live'));
  assert.equal(new Set(r.modules.map(m => m.key)).size, r.modules.length); assert.deepEqual(r.modules.map(m => +m.num), r.modules.map(m => +m.num).slice().sort((a, b) => a - b), 'numbered in order');
  assert.equal(r.zips.length, 277); assert.deepEqual(r.zips.find(z => z[0] === '75150'), ['75150', 'Mesquite', 'Dallas']);
  assert.equal(readFileSync(join(APP, 'registry.js'), 'utf8'), registryScript(), 'app/registry.js is current (run node build.mjs)');
});

test('the popup search finds modules and ZIP codes', () => {
  const ctx = context({ chrome: { runtime: { getURL: p => 'chrome-extension://x/' + p } } });
  load(ctx, 'registry.js', 'open.js'); const O = ctx.TDA_OPEN;
  assert.equal(O.search('weather')[0].route, 'weather'); assert.equal(O.search('75150')[0].route, 'heat.75150'); assert.equal(O.search('mesquite')[0].zip, true);
  assert.equal(O.resolve('live'), 'live'); assert.equal(O.resolve('paid acquisition'), 'paid'); assert.equal(O.resolve(''), ''); assert.equal(O.resolve('zzzz'), '');
  assert.equal(O.search('').length, 0); assert.equal(O.pageUrl('heat.75150'), 'chrome-extension://x/atlas.html#heat.75150');
});

test('the install zip holds the app under one folder and reads back', async () => {
  const files = appFiles(); const names = files.map(f => f.rel);
  for (const n of ['manifest.json', 'background.js', 'atlas.html', 'popup.html', 'registry.js', 'css/atlas.css', 'data/atlas-data.js', 'live/core.js', 'fonts/fonts.css', 'icons/icon128.png']) assert.ok(names.includes(n), n);
  assert.ok(!names.some(n => /(^|\/)\.|node_modules|tests\/|tools\//.test(n)), 'only the app ships');
  const z = zip([{ name: 'a/x.txt', data: Buffer.from('hello hello hello hello hello') }, { name: 'a/y.bin', data: Buffer.from([1, 2, 3]) }]);
  assert.equal(z.readUInt32LE(0), 0x04034b50); assert.equal(z.readUInt32LE(z.length - 22), 0x06054b50); assert.equal(z.readUInt16LE(z.length - 22 + 10), 2);
});
