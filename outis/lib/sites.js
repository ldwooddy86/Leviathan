/* Sites: the unit Outis protects, pauses, keeps and forgets. A site is a registrable domain ("example.co.uk"
   for shop.example.co.uk). Chrome knows the full Public Suffix List but does not expose it to extensions, so
   this keeps the multi-label suffixes common enough to matter. A miss only groups a few hosts together
   (a.wordpress.com with b.wordpress.com), which makes forgetting wait for both; cookie removal itself is done
   by Chrome with the full list. shield.js carries the same list (tools/build.mjs copies it in). */
export const MULTI_SUFFIXES = [
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk', 'nhs.uk', 'police.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au',
  'co.nz', 'net.nz', 'org.nz', 'govt.nz', 'ac.nz',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp', 'gr.jp', 'ed.jp', 'lg.jp',
  'co.kr', 'or.kr', 'ne.kr', 'go.kr', 'ac.kr',
  'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br',
  'com.mx', 'org.mx', 'gob.mx', 'edu.mx',
  'com.ar', 'com.co', 'com.pe', 'com.ve', 'com.ec', 'com.uy', 'com.py', 'com.bo',
  'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in', 'firm.in', 'gen.in', 'ind.in',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  'com.hk', 'org.hk', 'net.hk', 'edu.hk', 'gov.hk',
  'com.tw', 'org.tw', 'net.tw', 'edu.tw', 'gov.tw',
  'com.sg', 'org.sg', 'net.sg', 'edu.sg', 'gov.sg',
  'com.my', 'org.my', 'net.my', 'edu.my', 'gov.my',
  'co.id', 'or.id', 'ac.id', 'go.id', 'web.id',
  'co.th', 'or.th', 'ac.th', 'go.th', 'in.th',
  'com.ph', 'org.ph', 'net.ph', 'gov.ph', 'edu.ph',
  'com.vn', 'net.vn', 'org.vn', 'gov.vn', 'edu.vn',
  'com.tr', 'org.tr', 'net.tr', 'gov.tr', 'edu.tr', 'gen.tr',
  'co.za', 'org.za', 'net.za', 'gov.za', 'ac.za', 'web.za',
  'com.ng', 'org.ng', 'gov.ng', 'edu.ng',
  'co.ke', 'or.ke', 'go.ke', 'ac.ke',
  'com.eg', 'org.eg', 'gov.eg', 'edu.eg',
  'com.sa', 'org.sa', 'gov.sa', 'edu.sa',
  'co.il', 'org.il', 'gov.il', 'ac.il', 'net.il',
  'com.ua', 'org.ua', 'net.ua', 'gov.ua', 'in.ua',
  'com.pl', 'net.pl', 'org.pl', 'gov.pl', 'edu.pl',
  'com.ru', 'org.ru', 'net.ru', 'msk.ru', 'spb.ru',
  'co.at', 'or.at', 'gv.at', 'ac.at',
  'com.es', 'org.es', 'nom.es', 'gob.es', 'edu.es',
  'com.pt', 'org.pt', 'gov.pt', 'edu.pt',
  'com.gr', 'org.gr', 'gov.gr', 'edu.gr',
  'github.io', 'gitlab.io', 'pages.dev', 'workers.dev', 'netlify.app', 'vercel.app', 'herokuapp.com', 'web.app',
  'firebaseapp.com', 'appspot.com', 'blogspot.com', 'azurewebsites.net', 'myshopify.com', 'glitch.me', 'surge.sh',
  'neocities.org', 'fly.dev', 'onrender.com'
];
const MULTI = new Set(MULTI_SUFFIXES);

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/;

/* Registrable domain of a hostname; IP addresses and single labels (localhost) stand for themselves. */
export function siteOf(hostname) {
  let h = String(hostname || '').trim().toLowerCase().replace(/\.+$/, '');
  if (!h) return '';
  if (h.startsWith('[') || h.includes(':') || IPV4.test(h)) return h;
  const labels = h.split('.');
  if (labels.length <= 2) return h;
  const two = labels.slice(-2).join('.');
  return MULTI.has(two) ? labels.slice(-3).join('.') : two;
}

/* The site of a URL, only for the web schemes Outis works on; '' for anything else. */
export function siteOfUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return siteOf(u.hostname);
  } catch (e) {
    return '';
  }
}

/* Turn what a person types ("https://www.Example.com/page", "shop.example.co.uk") into a site, or '' if it is
   not a host name. */
export function normalizeSite(input) {
  let s = String(input || '').trim().toLowerCase();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = 'http://' + s;
  let host;
  try { host = new URL(s).hostname; } catch (e) { return ''; }
  host = host.replace(/\.+$/, '');
  if (!host) return '';
  /* URL() reads "42" or "0x2a" as an IPv4 address; only a written-out dotted quad counts as one here. */
  if (IPV4.test(host) && !/^\s*(?:[a-z][a-z0-9+.-]*:\/\/)?\d{1,3}(?:\.\d{1,3}){3}(?:[:/?#]|\s*$)/i.test(String(input))) return '';
  if (host.startsWith('[')) return host;
  if (!IPV4.test(host) && !HOST.test(host)) return '';
  return siteOf(host);
}

/* Match patterns covering a site and all of its subdomains (content script exclusions, content settings). */
export function patternsFor(site) {
  if (!site) return [];
  if (site.startsWith('[') || IPV4.test(site) || !site.includes('.')) return [`*://${site}/*`];
  return [`*://${site}/*`, `*://*.${site}/*`];
}

/* The content-settings pattern for a site: Chrome's "*." form there covers the domain itself too. */
export function contentPatternFor(site) {
  if (!site) return '';
  if (site.startsWith('[') || IPV4.test(site) || !site.includes('.')) return `*://${site}/*`;
  return `*://*.${site}/*`;
}

/* Origins whose storage to clear when a site is forgotten (cookies go for the whole registrable domain). */
export function baseOrigins(site) {
  if (!site) return [];
  const hosts = [site];
  if (site.includes('.') && !IPV4.test(site) && !site.startsWith('[')) hosts.push('www.' + site);
  const out = [];
  for (const h of hosts) out.push('https://' + h, 'http://' + h);
  return out;
}

export function sameSite(a, b) {
  return !!a && siteOf(a) === siteOf(b);
}
