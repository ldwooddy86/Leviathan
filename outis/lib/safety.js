/* Safety: what Outis treats as dangerous. Pure functions, shared by the background, the settings page and the tests.
   tools/build.mjs copies COMMAND_PATTERNS, DANGEROUS_SCHEMES, OFFICE_SCHEMES and MICROSOFT_HOSTS into the page shield,
   which cannot import modules. */

/* ---- commands on the clipboard ----
   "ClickFix" and "pastejacking" pages put a command on your clipboard and talk you into pasting it into Run,
   PowerShell or Terminal. These patterns describe commands that download or run code; the shield only stops one when
   the page did not show it to you, so a visible "copy this install command" button keeps working. */
export const COMMAND_PATTERNS = [
  ['\\b(?:powershell|pwsh)(?:\\.exe)?\\s+(?:-\\w|\\/\\w|["\']|iex\\b|i[rw][rm]\\b)', 'i'],
  ['\\bcmd(?:\\.exe)?["\']?\\s+\\/[ckr]\\b', 'i'],
  ['\\b(?:mshta|rundll32|regsvr32|certutil|bitsadmin|wscript|cscript|cmstp|msbuild|installutil|regasm|regsvcs|odbcconf|forfiles|schtasks|wmic)(?:\\.exe)?["\']?\\s', 'i'],
  ['\\bmsiexec(?:\\.exe)?\\s+\\/[iqxa]', 'i'],
  ['\\bconhost(?:\\.exe)?\\s+--headless\\b', 'i'],
  ['(?:^|[\\s;|(&])(?:iex|iwr|irm)(?:\\s|\\(|$)', 'i'],
  ['\\b(?:Invoke-Expression|Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|DownloadString|DownloadFile|FromBase64String|EncodedCommand)\\b', 'i'],
  ['\\bNet\\.WebClient\\b', 'i'],
  ['\\bDavWWWRoot\\b', 'i'],
  ['\\\\\\\\[\\w.-]+@(?:SSL|\\d+)\\\\', 'i'],
  ['\\bosascript\\s+-e\\b', 'i'],
  ['\\bxattr\\s+-[a-z]*[cdr]', 'i'],
  ['\\bbase64\\s+(?:-d|-D|--decode)\\b', ''],
  ['(?:curl|wget)\\b[^|\\n]{0,400}\\|\\s*(?:sudo\\s+)?(?:ba|z|da|k|c)?sh\\b', 'i'],
  ['\\b(?:bash|sh|zsh|dash)\\s+-c\\b', 'i'],
  ['\\$\\(\\s*(?:curl|wget)\\b', 'i'],
  ['`\\s*(?:curl|wget)\\b', 'i'],
  ['\\/dev\\/tcp\\/', 'i'],
  ['\\bpython[0-9.]*\\s+-c\\s', 'i'],
  ['\\bperl\\s+-e\\s', 'i']
];
const COMMANDS = COMMAND_PATTERNS.map(([s, f]) => new RegExp(s, f));
export function looksLikeCommand(text) {
  const t = String(text || '');
  if (t.length < 6 || t.length > 20000) return false;
  return COMMANDS.some(r => r.test(t));
}
/* Whitespace and invisible characters do not count when comparing what was copied with what was shown. */
export function normalizeText(s) {
  return String(s || '').replace(/[​-‍⁠﻿]/g, '').replace(/\s+/g, ' ').trim();
}

/* ---- links that open Windows tools ----
   search-ms: shows an attacker's network folder as if it were a local search; ms-msdt: ran code through the support
   tool (Follina); ms-appinstaller: installed apps straight from a web page. Office links open documents in the desktop
   apps and are fine for Microsoft's own services (SharePoint, OneDrive), not for anyone else's server. */
export const DANGEROUS_SCHEMES = ['search-ms', 'search', 'ms-search', 'ms-msdt', 'ms-officecmd', 'ms-cxh', 'ms-cxh-full',
  'ms-appinstaller', 'mk', 'its', 'ms-its', 'mhtml', 'hcp', 'vbscript', 'jscript', 'shell'];
export const OFFICE_SCHEMES = ['ms-word', 'ms-excel', 'ms-powerpoint', 'ms-visio', 'ms-access', 'ms-project', 'ms-publisher',
  'ms-spd', 'ms-infopath', 'ms-onenote'];
export const MICROSOFT_HOSTS = ['sharepoint.com', 'sharepoint-df.com', 'sharepoint.us', 'onedrive.live.com', 'live.com', 'office.com',
  'office.net', 'office365.com', 'microsoft.com', 'microsoftonline.com', 'svc.ms', '1drv.ms', 'cloud.microsoft'];
/* The scheme that makes a link dangerous, or '' if it is fine. */
export function dangerousLink(href) {
  const s = String(href || '');
  const m = /^\s*([a-z][a-z0-9+.-]*):/i.exec(s);
  if (!m) return '';
  const scheme = m[1].toLowerCase();
  if (DANGEROUS_SCHEMES.includes(scheme)) return scheme;
  if (OFFICE_SCHEMES.includes(scheme)) {
    const u = /\|u\|(https?:\/\/[^|\s]+)/i.exec(s);
    let host = '';
    try { host = u ? new URL(u[1]).hostname.toLowerCase() : ''; } catch (e) { host = ''; }
    if (host && MICROSOFT_HOSTS.some(d => host === d || host.endsWith('.' + d))) return '';
    return scheme;
  }
  return '';
}

/* ---- downloads ---- */
/* Programs, installers, scripts, shortcuts and disk images: what runs code when opened. */
export const EXECUTABLE = new Set(['exe', 'msi', 'msix', 'msixbundle', 'appx', 'appxbundle', 'appinstaller', 'application', 'appref-ms',
  'bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'dll', 'ocx', 'sys', 'hta', 'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'wsc', 'ps1', 'psm1', 'psd1',
  'reg', 'lnk', 'url', 'scf', 'inf', 'library-ms', 'search-ms', 'searchconnector-ms', 'settingcontent-ms', 'diagcab', 'msc', 'msp', 'mst',
  'chm', 'gadget', 'jar', 'jnlp', 'xll', 'iqy', 'iso', 'img', 'vhd', 'vhdx', 'dmg', 'pkg', 'mpkg', 'command', 'tool', 'scpt', 'applescript',
  'terminal', 'sh', 'deb', 'rpm', 'appimage', 'desktop', 'apk', 'xapk', 'apks']);
/* Scripts and shortcuts that run the moment they are opened: almost never a legitimate download from a website. */
export const SCRIPT = new Set(['bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'hta', 'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'wsc', 'ps1',
  'reg', 'lnk', 'url', 'scf', 'library-ms', 'search-ms', 'searchconnector-ms', 'settingcontent-ms', 'diagcab', 'msc', 'xll', 'iqy', 'gadget']);
/* What a disguised program pretends to be. */
export const DOCUMENT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'txt', 'csv', 'jpg', 'jpeg',
  'png', 'gif', 'bmp', 'webp', 'heic', 'svg', 'mp3', 'mp4', 'mov', 'avi', 'wav', 'mkv', 'zip', 'rar', '7z', 'html', 'htm', 'eml', 'msg']);
export const ARCHIVE = new Set(['zip', 'rar', '7z', 'gz', 'tgz', 'tar', 'cab', 'iso', 'img']);
const BROWSER_UPDATE = /(?:chrome|chromium|browser|firefox|edge|safari|opera|brave|vivaldi)[^a-z]{0,3}(?:update|upgrade|patch|installer)|(?:update|upgrade)[^a-z]{0,3}(?:chrome|chromium|browser|firefox|edge|safari|opera|brave)/i;
export const BROWSER_VENDORS = ['google.com', 'gstatic.com', 'googleapis.com', 'chromium.org', 'mozilla.org', 'mozilla.net', 'microsoft.com',
  'apple.com', 'opera.com', 'brave.com', 'vivaldi.com'];
export const REASONS = {
  disguised: "Its name hides what it is: it looks like a document or a picture, but it's a program.",
  assembled: 'The page built this program itself instead of downloading it from a server, a trick used to slip malware past filters.',
  fakeUpdate: 'It claims to be a browser update. Browsers update themselves; they never ask you to download an update from a website.',
  script: "It's a script or shortcut that runs as soon as you open it. Websites almost never have a good reason to send you one."
};

const basename = p => String(p || '').split(/[\\/]/).pop();
function hostOf(url) {
  let u = String(url || '');
  if (/^blob:/i.test(u)) u = u.slice(5);
  try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ''; }
}
/* Should this download be stopped, and why. */
export function judgeDownload(d) {
  const name = basename(d && d.filename);
  const src = String((d && (d.finalUrl || d.url)) || '');
  const reasons = [];
  const ext = (/\.([a-z0-9-]{1,24})$/i.exec(name) || [, ''])[1].toLowerCase();
  if (/[‪-‮⁦-⁩‎‏]/.test(name)) reasons.push('disguised');
  const dbl = /\.([a-z0-9]{1,5})[\s._-]*\.([a-z0-9-]{1,24})$/i.exec(name);
  if (dbl && DOCUMENT.has(dbl[1].toLowerCase()) && EXECUTABLE.has(dbl[2].toLowerCase())) reasons.push('disguised');
  if (/\s{3,}\.[a-z0-9-]+$/i.test(name) && EXECUTABLE.has(ext)) reasons.push('disguised');
  if (/^(?:blob|data):/i.test(src) && EXECUTABLE.has(ext)) reasons.push('assembled');
  if (BROWSER_UPDATE.test(name) && (EXECUTABLE.has(ext) || ARCHIVE.has(ext))) {
    const host = hostOf(src);
    if (!BROWSER_VENDORS.some(v => host === v || host.endsWith('.' + v))) reasons.push('fakeUpdate');
  }
  if (SCRIPT.has(ext)) reasons.push('script');
  const unique = [...new Set(reasons)];
  return { block: unique.length > 0, reasons: unique, name, ext };
}

/* ---- other extensions ----
   Any extension that can read and change every site can do anything Outis does, including the opposite. This rates
   what an installed extension is able to do (chrome.management.ExtensionInfo); it cannot tell what it actually does. */
export const POWERS = {
  debugger: 'can take over pages with the debugger',
  nativeMessaging: 'can talk to programs on your computer',
  proxy: 'can send all your traffic elsewhere',
  userScripts: 'can run scripts it fetches',
  cookies: 'can read and change your cookies',
  webRequest: 'can watch your requests',
  webRequestBlocking: 'can rewrite your requests',
  scripting: 'can inject code into pages',
  declarativeNetRequest: 'can change your requests',
  management: 'can turn other extensions on and off',
  privacy: 'can change your privacy settings',
  contentSettings: 'can change what sites may do',
  downloads: 'can download files',
  history: 'can read your browsing history',
  clipboardRead: 'can read your clipboard',
  desktopCapture: 'can record your screen',
  tabCapture: 'can record your tabs',
  webNavigation: 'can see every page you open',
  browsingData: 'can delete your browsing data',
  identity: 'can use your Google sign-in',
  geolocation: 'can read your location'
};
const SEVERE = ['debugger', 'nativeMessaging', 'proxy', 'userScripts', 'cookies', 'webRequest', 'webRequestBlocking', 'scripting', 'declarativeNetRequest'];
const ALL_SITES = h => h === '<all_urls>' || /^(?:\*|https?|wss?):\/\/\*\/\*$/.test(h) || /^\*:\/\/\*\//.test(h);
export function extensionRisk(e) {
  const hosts = (e && e.hostPermissions) || [];
  const perms = (e && e.permissions) || [];
  const allSites = hosts.some(ALL_SITES);
  const reasons = [];
  if (allSites) reasons.push('can read and change everything on every site');
  for (const p of perms) if (POWERS[p]) reasons.push(POWERS[p]);
  const outside = e && (e.installType === 'sideload' || e.installType === 'other');
  if (outside) reasons.push('was installed by another program, not by you from the Chrome Web Store');
  if (e && e.installType === 'development') reasons.push('is loaded unpacked, so nobody reviewed it');
  const level = outside || (allSites && perms.some(p => SEVERE.includes(p))) ? 'high'
    : allSites || perms.some(p => POWERS[p]) ? 'medium' : 'low';
  return { level, reasons, allSites };
}
