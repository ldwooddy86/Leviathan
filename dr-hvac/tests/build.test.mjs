/* build.mjs and lib/zip.mjs against a miniature atlas made here: the same anchors as the real one (the title, the
   footer sentence, the head, the shell comment, the manifest, the registry, the popup), none of its content. Checks the
   patches land exactly once, in the right order, that a second run changes nothing, that a page the tool does not
   recognize stops it, that what is inlined cannot end a script early, and that nothing is written inside the repository. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { suite } from './lib/load.mjs';
import { readZip, writeZip, safeName } from '../lib/zip.mjs';
import { BUILD, SCRIPTS, HOSTS, sources, patchSingle, patchApp, readApp, zipApp, inlineProblem, checkOut, repoRoot, build, BuildError } from '../build.mjs';
const { ok, eq, done } = suite();
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return e instanceof Error && (!re || re.test(e.message)); } };

/* ---------- a miniature atlas ---------- */
const FOOT = '<footer class="shell-foot"><div class="in"><span>Compiled from public data; Build 5 November 13, 2026 adds the Heat Desk and the live data layer, which refreshes the forecast every day and every other public source in Live Data once a week.</span><span>Model figures are estimates and carry an A to D grade.</span></div></footer>';
const HEAD = n => `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Northside Comfort · DFW Thermal Debt Atlas · Build ${n}</title>\n`;
const BODY = '<header class="shell-top"><div class="in"><div class="facts" id="shellFacts"></div></div></header>\n<nav class="rail" id="rail"><div class="in"></div></nav>\n<main id="modules"></main>\n' + FOOT + '\n';
const SHELL = '<!-- shell boot: builds the rail and shows the module in the hash -->';
const single = (n = 5) => HEAD(n) + '<style>\n:root{--ink:#111}\n</style>\n<style>\n/* ==== heat.css ==== */\n.hd{color:red}\n</style>\n</head>\n<body>\n' + BODY + '<!-- shared layers -->\n<script>\n/* ==== src/00_core.js ==== */\nconst MODS = [];\n</script>\n<script>\n/* ==== src/32_m18_live.js ==== */\nMODS.push("live");\n</script>\n' + SHELL + '\n<script>\n/* ==== src/99_shell.js ==== */\n(function boot() { /* a string that names </head> and a <style> tag must not confuse the patch */ })();\n</script>\n</body>\n</html>\n';
const appFiles = () => new Map(Object.entries({
  'manifest.json': JSON.stringify({ manifest_version: 3, name: 'DFW Thermal Debt Atlas', version: '5.0.0', permissions: ['storage'], host_permissions: ['https://api.weather.gov/*'], optional_host_permissions: ['https://*/*'], content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" } }, null, 2),
  'atlas.html': HEAD(5) + '<link rel="stylesheet" href="fonts/fonts.css">\n<link rel="stylesheet" href="css/atlas.css">\n<link rel="stylesheet" href="css/heat.css">\n</head>\n<body>\n' + BODY + '<script src="js/00_core.js"></script>\n<script src="js/32_m18_live.js"></script>\n' + SHELL + '\n<script src="js/99_shell.js"></script>\n</body>\n</html>\n',
  'registry.js': '/* Generated. Do not edit. */\nglobalThis.TDA_REGISTRY = {"version":"5.0.0","compiled":"2026-09-25","modules":[{"key":"index","num":"01","title":"Thermal Debt Index","desc":"Where systems are coming due"},{"key":"live","num":"18","title":"Live Data","desc":"The public sources"}],"zips":[["75001","Addison","Dallas"]]};\n',
  'popup.html': '<!doctype html><html><body>\n  <div class="btns">\n    <button class="b p" id="goHeat" type="button">Open the Heat Desk</button>\n    <button class="b" id="goAtlas" type="button">Open the atlas</button>\n    <button class="b" id="goLive" type="button">Live data and sources</button>\n  </div>\n<script src="popup.js"></script></body></html>\n',
  'popup.js': "(function () {\n  const $ = id => document.getElementById(id); const open = () => {};\n  $('goHeat').onclick = e => open('heat', e); $('goAtlas').onclick = e => open('', e); $('goLive').onclick = e => open('live', e);\n})();\n",
  'js/99_shell.js': '/* ==== src/99_shell.js ==== */\n', 'js/00_core.js': 'const MODS = [];\n', 'js/32_m18_live.js': 'MODS.push("live");\n', 'css/atlas.css': ':root{--ink:#111}\n', 'css/heat.css': '.hd{color:red}\n', 'js/dr/99_left_over.js': '/* from an earlier build */\n',
}).map(([k, v]) => [k, Buffer.from(v)]));

const S = sources();

/* ---------- the sources ---------- */
ok(S.scripts.length === SCRIPTS.length && S.scripts[0].app === 'js/vendor/anthropic-sdk.min.js' && S.scripts[1].app === 'js/dr/00_dr_core.js' && S.scripts[S.scripts.length - 1].app === 'js/33_m19_drhvac.js' && S.scripts.every(x => x.text.startsWith('/* ==== ') && x.text.endsWith('\n')), 'thirteen scripts in load order: the SDK, the agent layers, then the module');
eq([S.module.key, S.module.num, S.module.title, /^The web developer on call/.test(S.module.desc), S.version], ['drhvac', '19', 'Dr. HVAC', true, '6.0.0'], 'the module\'s registry entry is read from its own registerModule call, the version from package.json');
ok(S.scripts.every(x => !inlineProblem(x.text)) && !/<\/style/i.test(S.css), 'nothing that is inlined can end a script or a style block early');
eq([inlineProblem('const a = "</scr" + "ipt>";'), inlineProblem('x = "</SCRIPT >"') !== '', inlineProblem('s.replace(/<!--[\\s\\S]*?-->/g, "") + "<script"'), inlineProblem('a = "<!-- <script"; b = "-->"') !== '', inlineProblem('a = "<!--"') !== ''], ['', true, '', true, true], 'the inline check: a closing script tag, or a script opener inside an open HTML comment, is refused; a closed comment is not');

/* ---------- the single file ---------- */
const one = patchSingle(single(), S), h = one.html;
ok(/Build 6<\/title>/.test(h.slice(0, 300)) && !/Build 5<\/title>/.test(h) && h.includes('once a week; Build 6 November 14, 2026 adds Dr. HVAC (module 19)') && h.includes('Build 5 November 13, 2026 adds the Heat Desk') && h.includes('reaches a site.</span><span>Model figures'), 'the title moves to Build 6 and the footer gains its sentence, the earlier history untouched');
const iCss = h.indexOf('<!-- drhvac:css -->'), iHead = h.indexOf('</head>'), iHeat = h.indexOf('/* ==== heat.css ==== */');
ok(iCss > iHeat && iCss < iHead && h.slice(iCss, iHead).includes('.dr-work{') && h.split('<!-- drhvac:css -->').length === 2, 'the stylesheet goes in the head once, after the atlas\'s own styles');
const order = [...h.matchAll(/<script>\n\/\* ==== ([^=]+?) ==== \*\//g)].map(m => m[1]);
eq(order, ['src/00_core.js', 'src/32_m18_live.js', ...SCRIPTS, 'src/99_shell.js'], 'the scripts sit after the last module and before the shell, in load order, one block each');
ok(h.indexOf('<!-- /drhvac:js -->') < h.indexOf('<!-- shell boot') && h.split('<script>').length - 1 === 3 + SCRIPTS.length && h.split('</script>').length === h.split('<script>').length, 'every inline block is closed, and the shell is still last');
eq(patchSingle(h, S).html === h, true, 'a second run over a patched file changes nothing');
ok(patchSingle(h.replace('.dr-work{', '.dr-old{'), S).html === h, 'and it replaces an earlier Dr. HVAC block rather than adding a second one');
ok(throws(() => patchSingle(single(4), S), /does not end in "Build 5"/) && throws(() => patchSingle(single().replace('<!-- shell boot: builds the rail and shows the module in the hash -->', ''), S), /scripts: expected its anchor once and found it 0 times/) && throws(() => patchSingle(single().replace('once a week.', 'each week.'), S), /footer/) && throws(() => patchSingle('<html><title>x Build 5</title></html>', S), /not the single file edition/), 'a page it does not recognize stops the build with the reason, and nothing half patched comes back');
ok(throws(() => patchSingle(single() + SHELL, S), /found it 2 times/), 'an anchor that appears twice stops it too');

/* ---------- the browser app ---------- */
const A = patchApp(appFiles(), S), F = A.files, T = n => F.get(n).toString('utf8');
ok(S.scripts.every(x => F.has(x.app) && T(x.app) === x.text) && T('css/drhvac.css') === S.css && /Apache License/.test(T('js/vendor/LICENSE-anthropic-sdk.txt')) && !F.has('js/dr/99_left_over.js'), 'the scripts, the stylesheet and the SDK license are added; a file left under js/dr by an earlier build is removed');
const page = T('atlas.html'); const tags = [...page.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
eq(tags, ['js/00_core.js', 'js/32_m18_live.js', ...S.scripts.map(x => x.app), 'js/99_shell.js'], 'atlas.html loads them after the modules and before the shell');
ok(page.includes('<link rel="stylesheet" href="css/heat.css">\n<link rel="stylesheet" href="css/drhvac.css">\n</head>') && /Build 6<\/title>/.test(page) && page.includes('Build 6 November 14, 2026 adds Dr. HVAC') && !/<script>(?!<)/.test(page.replace(/<script src=/g, '')), 'with its stylesheet, the Build 6 title and footer, and no inline script (the page runs under script-src \'self\')');
const man = JSON.parse(T('manifest.json'));
eq([man.version, man.host_permissions, man.optional_host_permissions, man.content_security_policy.extension_pages, man.permissions], ['6.0.0', ['https://api.weather.gov/*', ...HOSTS], ['https://*/*', 'http://*/*'], "script-src 'self'; object-src 'self'", ['storage']], 'the manifest: version 6.0.0, Claude and the two DNS resolvers added to the hosts, websites still optional, nothing else touched');
const reg = T('registry.js'); const R = JSON.parse(reg.slice(reg.indexOf('{'), reg.lastIndexOf('}') + 1));
ok(reg.startsWith('/* Generated. Do not edit. */\nglobalThis.TDA_REGISTRY = {') && reg.endsWith('};\n') && R.version === '6.0.0' && R.modules.length === 3 && R.modules[2].key === 'drhvac' && R.modules[2].num === '19' && R.zips.length === 1 && R.compiled === '2026-09-25', 'the registry gains module 19 and the version, its data untouched');
ok(/id="goLive"[^\n]*\n\s*<!-- drhvac:popup --><button class="b" id="goDr"[^>]*>Ask Dr\. HVAC/.test(T('popup.html')) && /open\('live', e\);\n\s*\/\* drhvac:popup \*\/ \{ const dr = \$\('goDr'\); if \(dr\) dr\.onclick = e => open\('drhvac', e\); \}/.test(T('popup.js')), 'the popup gets its button and the click that opens the module');
const twice = patchApp(new Map(F), S).files; const drift = [...F.keys()].filter(k => !twice.has(k) || !F.get(k).equals(twice.get(k)));
ok([...F.keys()].sort().join() === [...twice.keys()].sort().join() && drift.length === 0, 'a second run over a patched app changes no file', drift.join(', '));
const thrice = patchApp(new Map(twice), S).files; ok([...twice.keys()].every(k => twice.get(k).equals(thrice.get(k))), 'nor does a third');
ok(throws(() => patchApp(new Map([...appFiles()].filter(([k]) => k !== 'popup.js')), S), /no popup\.js/) && throws(() => { const m = appFiles(); m.set('manifest.json', Buffer.from(JSON.stringify({ manifest_version: 2 }))); patchApp(m, S); }, /not Manifest V3/) && throws(() => { const m = appFiles(); const j = JSON.parse(m.get('manifest.json')); j.content_security_policy.extension_pages += "; connect-src 'self'"; m.set('manifest.json', Buffer.from(JSON.stringify(j))); patchApp(m, S); }, /connect-src/), 'a missing file, an old manifest or a policy that would block the Claude API stops the build');

/* ---------- the zip reader and writer ---------- */
const entries = [{ name: 'app/a.txt', data: 'hello hello hello hello hello hello hello hello' }, { name: 'app/dir/b.bin', data: Buffer.from([0, 1, 2, 255, 254]) }, { name: 'app/empty.txt', data: '' }, { name: 'app/ünï.txt', data: 'é' }];
const z = writeZip(entries), back = readZip(z);
eq(back.map(e => [e.name, e.data.toString('hex')]), entries.map(e => [e.name, Buffer.from(e.data).toString('hex')]), 'a zip written here reads back byte for byte, names in UTF-8, compressed or stored');
ok(writeZip(entries).equals(z) && z.readUInt32LE(0) === 0x04034b50, 'the same input gives the same bytes');
ok(throws(() => safeName('../x'), /unsafe/) && throws(() => safeName('/etc/x'), /unsafe/) && throws(() => safeName('C:\\x'), /unsafe/) && throws(() => writeZip([{ name: 'a', data: '' }, { name: 'a', data: '' }]), /two entries/) && throws(() => readZip(Buffer.from('not a zip')), /no end of central directory/), 'names that climb out of the folder, duplicates and a file that is not a zip are refused');
{ const bad = Buffer.from(z); const at = bad.indexOf(Buffer.from('hello')); const packed = at < 0; if (!packed) bad[at] ^= 1; else bad[40] ^= 1; ok(throws(() => readZip(bad)), 'a damaged entry fails its checksum instead of being read'); }

/* ---------- reading the app from a zip with a top folder, and writing it back ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drhvac-build-'));
const appZip = path.join(tmp, 'app.zip'); fs.writeFileSync(appZip, zipApp(appFiles(), 'dfw-thermal-debt-atlas'));
const RA = readApp(appZip); ok(RA.top === 'dfw-thermal-debt-atlas' && RA.files.has('manifest.json') && RA.files.has('js/99_shell.js') && ![...RA.files.keys()].some(k => k.startsWith('dfw-')), 'the app is found inside its top folder in the zip');
const dir = path.join(tmp, 'unpacked'); for (const [n, b] of appFiles()) { fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true }); fs.writeFileSync(path.join(dir, n), b); }
ok(readApp(dir).files.size === appFiles().size && readApp(dir).top === 'unpacked', 'or read from an unpacked folder');

/* ---------- the whole build, and where it may write ---------- */
const htmlIn = path.join(tmp, 'atlas.html'); fs.writeFileSync(htmlIn, single());
const out = path.join(tmp, 'out'); const lines = []; const made = build({ html: htmlIn, app: appZip, out, log: l => lines.push(l) });
ok(made.length === 2 && path.basename(made[0]) === `DFW_Thermal_Debt_Atlas_Build${BUILD.n}.html` && path.basename(made[1]) === 'DFW-Thermal-Debt-Atlas-browser-app-6.0.0.zip' && fs.readFileSync(made[0], 'utf8') === h, 'build writes both editions to the out folder', lines.join(' | ').slice(0, 300));
const outApp = readZip(fs.readFileSync(made[1])); ok(outApp.every(e => e.name.startsWith('dfw-thermal-debt-atlas/')) && outApp.some(e => e.name === 'dfw-thermal-debt-atlas/js/33_m19_drhvac.js') && outApp.length === F.size, 'the browser app zip keeps its top folder and holds every file');
const root = repoRoot();
ok(root && fs.existsSync(path.join(root, '.git')) && throws(() => checkOut(path.join(root, 'dr-hvac', 'dist')), /inside the repository/) && throws(() => checkOut(root), /inside the repository/) && checkOut(tmp) === path.resolve(tmp), 'the out folder may not be inside the repository: a built atlas carries the client\'s data');
ok(throws(() => build({ html: htmlIn, out: path.join(root, 'dr-hvac', 'out-test'), log() { } }), /inside the repository/) && !fs.existsSync(path.join(root, 'dr-hvac', 'out-test')) && throws(() => build({ out: tmp, log() { } }), /give --html, --app or both/) && throws(() => build({ html: htmlIn, log() { } }), /give --out/), 'build refuses before it writes anything');
ok(new BuildError('x') instanceof Error, 'build failures are their own error type, so the command line can tell them from a crash');
fs.rmSync(tmp, { recursive: true, force: true });
done();
