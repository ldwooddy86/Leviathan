/* src/dr/13_dr_hosting.js: DNS over HTTPS (both resolvers' real answer formats), the reading of the records, the stack
   fingerprint, the runbook and the before against after comparison. No live network: every answer is a mock. */
import { makeContext, load, suite } from './lib/load.mjs';
const { ok, eq, throwsAsync, done } = suite();
const ctx = makeContext({});
load(ctx, ['dr/00_dr_core.js', 'dr/13_dr_hosting.js']);
const D = ctx.DRHVAC, H = D.hosting;

/* ---------- a tiny authoritative server, answering in the JSON each resolver really sends ---------- */
const TNUM = { A: 1, NS: 2, CNAME: 5, SOA: 6, MX: 15, TXT: 16, AAAA: 28, CAA: 257 };
/* recs: {'name|TYPE': [[ttl, data], ...]}; a TXT value given as an array is a record split into several strings */
function zone(apex, recs, o = {}) { const names = new Set([apex]); Object.keys(recs).forEach(k => names.add(k.split('|')[0])); return Object.assign({ apex, recs, names }, o); }
function answer(z, name, type, flavor) {
  const dot = s => (flavor === 'google' ? s + '.' : s);            /* Google writes names with the trailing dot */
  const base = { Status: 0, TC: false, RD: true, RA: true, AD: !!z.ad, CD: false, Question: [{ name: dot(name), type: TNUM[type] }] };
  const soa = { name: dot(z.apex), type: 6, TTL: 1800, data: `ns1.${z.apex}. hostmaster.${z.apex}. 2026111401 7200 3600 1209600 3600` };
  if (!z.names.has(name)) return Object.assign(base, { Status: 3, Authority: [name === z.apex || name.endsWith('.' + z.apex) ? soa : { name: dot('test'), type: 6, TTL: 900, data: 'a.nic.test. hostmaster.nic.test. 1 7200 900 1209600 86400' }] });
  const out = []; let cur = name, guard = 0;
  while (type !== 'CNAME' && z.recs[cur + '|CNAME'] && guard++ < 5) { const c = z.recs[cur + '|CNAME'][0]; out.push({ name: dot(cur), type: 5, TTL: c[0], data: c[1] }); cur = c[1].replace(/\.$/, ''); }
  for (const [ttl, data] of (z.recs[cur + '|' + type] || [])) {
    let d = data;
    if (type === 'TXT') { const parts = Array.isArray(data) ? data : [data]; d = flavor === 'google' ? parts.join('') : parts.map(p => '"' + p.replace(/"/g, '\\"') + '"').join(' '); }
    out.push({ name: dot(cur), type: TNUM[type], TTL: ttl, data: d });
  }
  return out.length ? Object.assign(base, { Answer: out }) : Object.assign(base, { Authority: [soa] });
}
function doh(z, o = {}) {
  const log = [];
  const http = async (url, opts) => {
    const u = new URL(url); const cf = u.hostname === 'cloudflare-dns.com'; log.push({ url, cf, accept: opts && opts.headers && opts.headers.accept });
    if (opts && opts.signal && opts.signal.aborted) throw new D.net.NetError('Stopped.', { code: 'stopped' });
    if ((cf && o.cfDown) || (!cf && o.googleDown)) throw new D.net.NetError(`Could not reach ${u.hostname}: blocked.`, { code: 'network' });
    if (cf && o.cfHtml) return { status: 200, ok: true, url, headers: {}, text: '<html>captive portal</html>', cut: false, ms: 1 };
    const name = u.searchParams.get('name').toLowerCase().replace(/\.$/, ''), type = u.searchParams.get('type');
    return { status: 200, ok: true, url, redirected: false, headers: { 'content-type': 'application/dns-json' }, text: JSON.stringify(answer(z, name, type, cf ? 'cf' : 'google')), cut: false, ms: 2 };
  };
  http.log = log; return http;
}

/* ---------- 1. a WordPress site on shared hosting, mail on the same box, read through Cloudflare's resolver ---------- */
const N = 'northside-comfort.test';
const shared = zone(N, {
  [`${N}|A`]: [[14400, '203.0.113.10']],
  [`${N}|NS`]: [[86400, 'ns1.bluehost.com.'], [86400, 'ns2.bluehost.com.']],
  [`${N}|MX`]: [[14400, `0 mail.${N}.`]],
  [`${N}|TXT`]: [[14400, 'v=spf1 a mx ip4:203.0.113.10 ~all'], [3600, 'google-site-verification=abc123'], [3600, ['a long record that the server ', 'split into two strings']]],
  [`${N}|SOA`]: [[86400, `ns1.bluehost.com. dnsadmin.box.bluehost.com. 2026111400 86400 7200 3600000 300`]],
  [`www.${N}|CNAME`]: [[14400, `${N}.`]],
  [`mail.${N}|A`]: [[14400, '203.0.113.10']],
});
let http = doh(shared);
let L = await H.dnsLookup(`https://www.${N}/contact/`, { http });
ok(L.domain === N && L.resolver === 'cloudflare' && /^\d{4}-\d\d-\d\dT/.test(L.at) && L.errors.length === 0, 'a URL is reduced to its domain; Cloudflare answers everything', `${L.domain} via ${L.resolver}, ${L.errors.length} errors`);
ok(http.log.every(l => l.cf && l.accept === 'application/dns-json'), 'every question carries accept: application/dns-json');
ok(http.log.length === 8 + 3 + 1 + 1, 'eight types on the apex, three on www, the DMARC record and the in domain mail host: 13 questions', http.log.length);
eq(L.records.apex.A, [{ data: '203.0.113.10', ttl: 14400 }], 'A record parsed with its TTL');
eq([L.records.apex.MX[0].priority, L.records.apex.MX[0].host, L.records.apex.MX[0].data], [0, `mail.${N}`, `0 mail.${N}`], 'MX split into priority and host, trailing dot dropped');
eq(L.records.apex.NS.map(r => r.data).sort(), ['ns1.bluehost.com', 'ns2.bluehost.com'], 'NS hosts without trailing dots');
eq(L.records.apex.TXT.map(r => r.data), ['v=spf1 a mx ip4:203.0.113.10 ~all', 'google-site-verification=abc123', 'a long record that the server split into two strings'], 'TXT unquoted, a split record joined');
ok(L.records.apex.SOA[0].mname === 'ns1.bluehost.com' && L.records.apex.SOA[0].serial === 2026111400, 'SOA parsed');
eq([L.records.apex.AAAA, L.records.apex.CAA], [[], []], 'types with no record come back as empty lists, not errors');
eq(L.records.www.CNAME, [{ name: `www.${N}`, data: N, ttl: 14400 }], 'the www CNAME is recorded once though three questions returned it');
eq(L.records.www.A, [{ data: '203.0.113.10', ttl: 14400 }], 'the address behind the CNAME chain is read');
eq(L.records.mxHosts, { [`mail.${N}`]: ['203.0.113.10'] }, 'a mail host inside the domain gets its address looked up');
eq([L.records.dmarc, L.records.dnssec], [[], false], 'no DMARC record; answers did not validate');
let s = L.summary;
ok(s.dnsProvider === 'Bluehost' && s.dnsAtWebHost === true && s.registrarHint === null, 'nameservers at a web host are named and flagged as going with the account');
ok(s.email.sharesWebHost === true && /resolves to the web server's own address 203\.0\.113\.10/.test(s.email.sharesWebHostWhy) && s.email.mxFollowsWeb === false, 'mail on the web server is detected from the mail host\'s address', s.email.sharesWebHostWhy);
ok(s.email.spf === 'v=spf1 a mx ip4:203.0.113.10 ~all' && s.email.spfUsesWebServer === true && s.email.dmarc === null && s.email.dmarcPolicy === null, 'SPF read and seen to authorize the web server; DMARC absent');
eq([s.lowestTtl, s.highestTtl, s.web.wwwFollowsApex, s.web.proxied, s.web.cdn], [14400, 14400, true, false, null], 'TTL extremes over the web records; www follows the apex; no proxy');
ok(s.risks.some(r => /Mail for this domain is delivered to the web host/.test(r)) && s.risks.some(r => /No DMARC record/.test(r)) && s.risks.some(r => /SPF authorizes the current web server/.test(r)) && s.risks.some(r => /TTL of up to 14400 seconds \(4 hours\)/.test(r)) && s.risks.some(r => /DNS is hosted with a web hosting account at Bluehost/.test(r)), 'the five things that can hurt this move are each named', s.risks.length + ' risks');
ok(s.verification.length === 1 && /Google/.test(s.verification[0].service) && s.notes.some(n => /time left in its cache/.test(n)), 'a verification record is listed, and the cached TTL caveat is stated');

/* ---------- 2. Cloudflare blocked: Google answers, in its own format ---------- */
http = doh(shared, { cfDown: true });
L = await H.dnsLookup(N, { http });
ok(L.resolver === 'google' && L.errors.length === 0, 'when the first resolver fails the second answers everything', L.resolver);
ok(http.log.filter(l => l.cf).length >= 2 && http.log.filter(l => l.cf).length < http.log.length / 2, 'the failing resolver is dropped after two tries, not asked 13 times', http.log.filter(l => l.cf).length + ' Cloudflare tries');
eq([L.records.apex.MX[0].host, L.records.apex.NS.length, L.records.apex.TXT[2].data, L.records.www.CNAME[0].data, L.records.www.CNAME[0].name], [`mail.${N}`, 2, 'a long record that the server split into two strings', N, `www.${N}`], 'trailing dots and unquoted TXT from Google parse to the same records');
ok(L.summary.email.sharesWebHost && L.summary.dnsProvider === 'Bluehost', 'the reading is the same through either resolver');
http = doh(shared, { cfHtml: true });
L = await H.dnsLookup(N, { http });
ok(L.resolver === 'google', 'an answer that is not DNS JSON (a captive portal) also falls through to the second resolver');
ok(await throwsAsync(() => H.dnsLookup(N, { http: doh(shared, { cfDown: true, googleDown: true }) }), /No DNS resolver answered for northside-comfort\.test.*Could not reach/), 'both resolvers down: one clear error naming the domain');
ok(await throwsAsync(() => H.dnsLookup('not a domain'), /Not a domain name/), 'a non domain is refused before any request');
const ac = new AbortController(); ac.abort();
ok(await throwsAsync(() => H.dnsLookup(N, { http: doh(shared), signal: ac.signal }), /Stopped/), 'a stop signal ends the lookup');
eq([H.cleanDomain('HTTPS://WWW.Northside-Comfort.test:8443/x?y'), H.cleanDomain('owner@northside-comfort.test'), H.cleanDomain('northside-comfort.test.'), H.cleanDomain('localhost')], [N, N, N, ''], 'cleanDomain handles URLs, addresses, trailing dots and refuses a bare word');

/* ---------- 3. a name that does not exist ---------- */
L = await H.dnsLookup('gone-comfort.test', { http: doh(shared) });
ok(L.records.apex.status === 'nxdomain' && !L.records.zone && L.errors.length === 0, 'NXDOMAIN is a finding, and the top level domain in the authority section is not mistaken for a zone');
ok(/does not exist in DNS \(NXDOMAIN\)/.test(L.summary.risks[0]) && L.summary.nameservers.length === 0, 'the summary leads with it');

/* ---------- 4. Cloudflare proxied, Google Workspace mail, DNSSEC, CAA, IPv6 ---------- */
const P = 'peak-air.test';
const cfz = zone(P, {
  [`${P}|A`]: [[300, '104.21.5.9'], [300, '172.67.1.1']],
  [`${P}|AAAA`]: [[300, '2606:4700:3030::6815:509']],
  [`${P}|NS`]: [[86400, 'amy.ns.cloudflare.com.'], [86400, 'bob.ns.cloudflare.com.']],
  [`${P}|MX`]: [[300, '5 alt1.aspmx.l.google.com.'], [300, '1 aspmx.l.google.com.']],
  [`${P}|TXT`]: [[300, 'v=spf1 include:_spf.google.com ~all'], [300, 'MS=ms12345678']],
  [`${P}|CAA`]: [[300, '0 issue "letsencrypt.org"'], [300, '0 issuewild ";"']],
  [`www.${P}|A`]: [[300, '104.21.5.9'], [300, '172.67.1.1']],
  [`_dmarc.${P}|TXT`]: [[300, 'v=DMARC1; p=quarantine; rua=mailto:dmarc@peak-air.test']],
}, { ad: true });
const cfL = await H.dnsLookup(P, { http: doh(cfz) });
s = cfL.summary;
ok(s.dnsProvider === 'Cloudflare' && s.web.cdn === 'Cloudflare' && s.web.proxied === true && /^hidden behind Cloudflare/.test(s.web.hostGuess), 'Cloudflare addresses under Cloudflare nameservers read as a proxied zone with a hidden origin', s.web.hostGuess);
eq([s.email.provider, s.email.sharesWebHost, s.email.mx.map(m => m.priority), s.email.dmarcPolicy, s.email.spfIncludes, s.email.spfUsesWebServer], ['Google Workspace', false, [1, 5], 'quarantine', ['_spf.google.com'], false], 'Google Workspace mail, sorted by priority, DMARC policy and SPF includes read');
eq([s.dnssec, s.caaIssuers, s.web.ipv6.length], [true, ['letsencrypt.org'], 1], 'DNSSEC from the AD flag, CAA issuers, one IPv6 address');
ok(s.risks.some(r => /proxied through Cloudflare/.test(r)) && s.risks.some(r => /CAA records allow only letsencrypt\.org/.test(r)) && s.risks.some(r => /DNSSEC is on/.test(r)), 'proxy, CAA and DNSSEC each raise their risk');
eq([s.riskIds, s.web.ownIpv6], [['proxied', 'caa', 'dnssec'], false], 'each risk carries an id, in the same order; Cloudflare\'s own IPv6 address on a proxied zone is not a record to worry about');
const v6 = H.interpret({ apex: { name: 'v.test', status: 'ok', A: [{ data: '198.51.100.40', ttl: 300 }], AAAA: [{ data: '2001:db8::40', ttl: 300 }] }, www: { name: 'www.v.test', A: [{ data: '198.51.100.40', ttl: 300 }] } });
ok(v6.web.ownIpv6 === true && v6.riskIds.includes('ipv6') && v6.risks.some(r => /IPv6 \(AAAA\) records exist/.test(r)), 'a real AAAA record raises the IPv6 risk');
ok(!s.risks.some(r => /TTL of up to|No SPF|No DMARC|Mail for this domain/.test(r)) && s.notes.some(n => /always answer with a TTL of 300/.test(n)), 'nothing is raised that does not apply; the proxied TTL note replaces the cache caveat');
ok(s.verification.some(v => v.service === 'Microsoft 365'), 'the Microsoft verification record is recognized');
/* the same Cloudflare addresses under another provider's nameservers: a host that fronts its sites with Cloudflare */
const fronted = H.interpret({ apex: { name: 'k.test', status: 'ok', A: [{ data: '162.159.134.42', ttl: 300 }], NS: [{ data: 'ns-12.awsdns-01.com', ttl: 1 }] }, www: { name: 'www.k.test', CNAME: [{ name: 'www.k.test', data: 'k.test', ttl: 300 }], A: [{ data: '162.159.134.42', ttl: 300 }] } });
ok(fronted.web.proxied === false && fronted.dnsProvider === 'Amazon Route 53' && /likely a managed host that fronts its sites with Cloudflare/.test(fronted.web.hostGuess) && fronted.notes.some(n => /ordinary record change/.test(n)), 'Cloudflare addresses without Cloudflare nameservers are not called a proxied zone', fronted.web.hostGuess);

/* ---------- 5. a subdomain: the zone above it holds the nameservers and the mail ---------- */
const subz = zone(N, Object.assign({}, shared.recs, { [`shop.${N}|A`]: [[600, '198.51.100.7']] }));
L = await H.dnsLookup(`shop.${N}`, { http: doh(subz) });
ok(L.records.zone && L.records.zone.name === N && L.records.zone.NS.length === 2 && L.records.zone.MX.length === 1, 'a subdomain without nameservers of its own gets its zone looked up', L.records.zone && L.records.zone.name);
ok(L.summary.zone === N && L.summary.dnsProvider === 'Bluehost' && L.summary.email.mx.length === 1 && L.summary.web.ips[0] === '198.51.100.7', 'the reading takes nameservers and mail from the zone and the address from the subdomain');

/* ---------- 6. interpret on its own: host hints, the MX trap, TTL extremes, records in other shapes ---------- */
let I = H.interpret({ apex: { name: 'a.test', status: 'ok', A: [{ data: '141.193.213.10', ttl: 60 }], NS: [{ data: 'ns31.domaincontrol.com', ttl: 3600 }], MX: [{ priority: 0, host: 'a.test', ttl: 3600 }], TXT: [{ data: 'v=spf1 +a -all', ttl: 60 }, { data: 'v=spf1 include:x.test -all', ttl: 60 }] }, www: { name: 'www.a.test', CNAME: [{ name: 'www.a.test', data: 'aprod.wpenginepowered.com', ttl: 86400 }], A: [{ data: '141.193.213.11', ttl: 120 }] }, dmarc: [{ data: 'v=DMARC1; p=none', ttl: 60 }] });
eq([I.lowestTtl, I.highestTtl], [60, 86400], 'lowest and highest TTL across apex and www web records');
ok(/^WP Engine \(the name points at aprod\.wpenginepowered\.com\)/.test(I.web.hostGuess) && I.web.cname === 'aprod.wpenginepowered.com', 'a managed host is read from the www CNAME target', I.web.hostGuess);
ok(I.dnsProvider === 'GoDaddy' && /likely GoDaddy.*WHOIS or RDAP/.test(I.registrarHint) && I.dnsAtWebHost === false, 'a registrar\'s own nameservers give a registrar hint marked likely');
ok(I.email.mxFollowsWeb === true && I.email.sharesWebHost === true && /names a\.test itself/.test(I.email.sharesWebHostWhy), 'an MX that names the bare domain is flagged: mail follows the A record');
ok(I.risks.some(r => /2 SPF records exist/.test(r)) && I.notes.some(n => /monitoring mode \(p=none\)/.test(n)) && I.risks.some(r => /are separate records \(aprod\.wpenginepowered\.com against 141\.193\.213\.10\): both have to change at cutover/.test(r)), 'two SPF records, a monitoring only DMARC, and www as a separate record are each reported');
I = H.interpret({ records: { apex: { name: 'b.test', status: 'ok', A: [{ data: '198.51.100.20', ttl: 1800 }], MX: [{ priority: 0, host: '', ttl: 300 }] }, www: { name: 'www.b.test' } } });
ok(/null MX/.test(I.email.provider) && I.email.sharesWebHost === false && !I.risks.some(r => /SPF|DMARC/.test(r)) && I.notes.some(n => /www\.b\.test does not resolve/.test(n)), 'a null MX means no mail and raises no mail risks; a missing www is noted; a lookup result wrapper is accepted');
I = H.interpret({ apex: { name: 'c.test', status: 'ok', A: [{ data: '198.51.100.30', ttl: 300 }], MX: [{ priority: 10, host: 'mailstore1.secureserver.net', ttl: 300 }], TXT: [] }, www: { name: 'www.c.test', A: [{ data: '198.51.100.30', ttl: 300 }] } });
ok(I.email.provider === 'GoDaddy email' && I.email.tiedToHostingBrand === 'GoDaddy' && I.email.sharesWebHost === false && I.risks.some(r => /a web hosting company's mail service/.test(r)) && I.risks.some(r => /No SPF record/.test(r)), 'mail at a hosting company is flagged for confirmation without claiming it shares the web host');
ok(H.interpret({}).nameservers.length === 0 && H.interpret(null).web.ips.length === 0, 'interpret tolerates empty input');

/* ---------- 6b. odd records through the resolver: a null MX, CAA in the generic hex form, a narrowed type list ---------- */
const oddz = zone('odd.test', { 'odd.test|A': [[600, '198.51.100.50']], 'odd.test|NS': [[3600, 'dns1.registrar-servers.com.']], 'odd.test|MX': [[600, '0 .']], 'odd.test|CAA': [[600, '\\# 22 00 05 69 73 73 75 65 6c 65 74 73 65 6e 63 72 79 70 74 2e 6f 72 67']], 'www.odd.test|A': [[600, '198.51.100.50']] });
L = await H.dnsLookup('odd.test', { http: doh(oddz) });
eq([L.records.apex.MX[0].host, L.records.apex.MX[0].data, L.records.mxHosts === undefined], ['', '0 .', true], 'a null MX parses to an empty host and triggers no address lookup');
eq([L.records.apex.CAA[0].tag, L.records.apex.CAA[0].value, L.summary.caaIssuers], ['issue', 'letsencrypt.org', ['letsencrypt.org']], 'CAA in the generic hex form is decoded');
ok(/null MX/.test(L.summary.email.provider) && L.summary.dnsProvider === 'Namecheap' && /likely Namecheap/.test(L.summary.registrarHint) && L.summary.web.wwwFollowsApex === true, 'the odd zone still reads cleanly');
http = doh(oddz); L = await H.dnsLookup('odd.test', { http, types: ['a', 'MX', 'bogus'] });
eq([http.log.length, Object.keys(L.records.apex).sort(), L.records.dmarc], [3, ['A', 'MX', 'name', 'status'], []], 'a narrowed type list asks only for those types (A on the apex and www, MX on the apex)');

/* ---------- 7. fingerprint ---------- */
const WP_HTML = `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><title>AC Repair | Northside Comfort</title>
<meta name="generator" content="WordPress 6.6.2" />
<meta name="generator" content="Elementor 3.24.5; features: e_font_icon_svg, additional_custom_breakpoints; settings: css_print_method-external">
<link rel="https://api.w.org/" href="https://www.${N}/wp-json/" />
<link rel='stylesheet' id='wp-block-library-css' href='https://www.${N}/wp-includes/css/dist/block-library/style.min.css?ver=6.6.2' />
<link rel='stylesheet' href='https://www.${N}/wp-content/themes/hello-elementor/style.min.css?ver=3.1.1' />
<link rel='stylesheet' href='https://www.${N}/wp-content/themes/hello-theme-child/style.css' />
<link rel='stylesheet' href='https://www.${N}/wp-content/plugins/elementor/assets/css/frontend.min.css?ver=3.24.5' />
<link rel='stylesheet' href='https://www.${N}/wp-content/plugins/elementor-pro/assets/css/frontend.min.css?ver=3.24.3' />
<script src='https://www.${N}/wp-content/plugins/wpforms-lite/assets/js/frontend.js'></script>
<!-- This site is optimized with the Yoast SEO plugin v23.5 - https://yoast.com/wordpress/plugins/seo/ -->
</head><body class="home page elementor-default elementor-kit-7"><div data-elementor-type="wp-page" class="elementor elementor-12"><div class="elementor-element e-con"><form class="elementor-form" method="post"></form></div></div>
<!-- This website is like a Rocket, isn't it? Performance optimized by WP Rocket. Learn more: https://wp-rocket.me --></body></html>`;
let fp = H.fingerprint({ url: `https://www.${N}/`, status: 200, html: WP_HTML, headers: { Server: 'nginx', 'X-Powered-By': 'PHP/8.2.12', Link: `<https://www.${N}/wp-json/>; rel="https://api.w.org/"`, 'CF-Ray': '8e1f0a-DFW', 'cf-cache-status': 'HIT', 'x-kinsta-cache': 'HIT', 'strict-transport-security': 'max-age=31536000; includeSubDomains', 'alt-svc': 'h3=":443"; ma=86400' } });
eq([fp.cms, fp.cmsVersion, fp.kind, fp.confidence], ['WordPress', '6.6.2', 'wordpress', 'high'], 'WordPress and its version, with high confidence from several signals');
eq([fp.builder, fp.builderVersion, fp.theme], ['Elementor', '3.24.5', 'hello-elementor'], 'Elementor with its version, and the theme');
ok(fp.builders.includes('Elementor') && fp.builders.includes('Block editor (Gutenberg)'), 'every builder that leaves a trace is listed', fp.builders.join(', '));
ok(['elementor', 'elementor-pro', 'wpforms-lite', 'wordpress-seo', 'wp-rocket'].every(p => fp.plugins.includes(p)), 'plugins from asset paths and from their comments', fp.plugins.join(', '));
eq([fp.server, fp.php, fp.cdn, fp.host, fp.https, fp.hsts, fp.hstsMaxAge, fp.http2Hint], ['nginx', '8.2.12', 'Cloudflare', 'Kinsta', true, true, 31536000, 'HTTP/3 advertised (alt-svc)'], 'server, PHP, CDN, managed host, HTTPS, HSTS and HTTP/3 from the headers (header names in any case)');
ok(/WP Rocket \(a caching plugin\)/.test(fp.cache) && /Cloudflare cache \(cf-cache-status: HIT\)/.test(fp.cache) && /Kinsta page cache/.test(fp.cache), 'the cache layers are listed', fp.cache);
ok(fp.signals.length >= 8 && fp.signals.every(x => x.what && typeof x.evidence === 'string' && x.evidence.length <= 180), 'every conclusion carries its evidence', fp.signals.length + ' signals');
fp = H.fingerprint({ url: 'https://docs.peak-air.test/', status: 200, html: '<!doctype html><html><head><meta name="generator" content="Hugo 0.125.4"><title>Docs</title></head><body><h1>Docs</h1></body></html>', headers: { server: 'Netlify', 'x-nf-request-id': '01J', 'cache-control': 'public,max-age=0,must-revalidate' } });
eq([fp.cms, fp.cmsVersion, fp.kind, fp.host, fp.builder, fp.php, fp.plugins], ['Hugo (static site generator)', '0.125.4', 'static', 'Netlify', null, null, []], 'a static generator on a static host');
fp = H.fingerprint({ url: 'http://old.test/', status: 200, html: '<html><head><title>Welcome</title></head><body><p>Hello</p></body></html>', headers: { server: 'Apache' } });
eq([fp.cms, fp.kind, fp.confidence, fp.host, fp.cdn, fp.https, fp.hsts, fp.server], [null, 'unknown', 'low', null, null, false, false, 'Apache'], 'nothing recognizable is reported as unknown with low confidence, not guessed');
fp = H.fingerprint({ url: 'https://shop.test/', html: '<html><head><link href="https://cdn.shopify.com/s/files/1/x.css"></head><body></body></html>', headers: { 'x-shopid': '123' } });
eq([fp.cms, fp.kind, fp.host], ['Shopify', 'hosted-builder', 'Shopify'], 'a closed platform is named as both the system and the host');
fp = H.fingerprint({ url: 'https://d.test/', html: '<html><body><p>x</p></body></html>', headers: { 'X-Generator': 'Drupal 10 (https://www.drupal.org)', 'X-Drupal-Cache': 'HIT' } });
eq([fp.cms, fp.cmsVersion, fp.kind], ['Drupal', '10', 'cms'], 'Drupal is read from its response headers when the markup says nothing');
ok(H.fingerprint({}).cms === null && H.fingerprint().signals.length === 0, 'fingerprint tolerates empty input');
/* fingerprintUrl: the page, plus what the redirects do */
const pages = {
  [`https://${N}/`]: { status: 200, url: `https://www.${N}/`, redirected: true, text: WP_HTML, headers: { server: 'nginx' } },
  [`http://${N}/`]: { status: 200, url: `https://www.${N}/`, redirected: true, text: '', headers: {} },
  [`https://www.${N}/`]: { status: 200, url: `https://www.${N}/`, text: WP_HTML, headers: { server: 'nginx' } },
};
const web = map => async url => { const p = map[url]; if (!p) throw new D.net.NetError('Could not reach ' + url, { code: 'network' }); return Object.assign({ ok: p.status < 400, url, redirected: false, headers: {}, text: '', cut: false, ms: 120 }, p); };
fp = await H.fingerprintUrl(N, { http: web(pages) });
eq([fp.cms, fp.redirects.httpToHttps, fp.redirects.canonicalHost, fp.redirects.finalUrl, fp.fetched.status], ['WordPress', true, 'www', `https://www.${N}/`, 200], 'fingerprintUrl reports http to https and which host name is the real one');
ok(fp.redirects.notes.some(n => n === `${N} redirects to www.${N}.`), 'the redirect from the bare domain is noted');
fp = await H.fingerprintUrl(`https://www.${N}/`, { http: web({ [`https://www.${N}/`]: pages[`https://www.${N}/`], [`https://${N}/`]: { status: 200, url: `https://${N}/`, text: WP_HTML } }) });
ok(fp.redirects.canonicalHost === 'both' && fp.redirects.httpToHttps === null && fp.redirects.notes.some(n => /two copies of the site/.test(n)) && fp.redirects.notes.some(n => /could not be checked/.test(n)), 'two hosts answering without a redirect is called out; an unreachable plain http check stays unknown');

/* ---------- 8. the knowledge base ---------- */
const hosts = Object.values(H.HOSTS);
ok(hosts.length >= 15 && hosts.every(h => h.name && Array.isArray(h.signals) && h.signals.length && h.signals.every(x => ['header', 'cname', 'ns', 'mx', 'url'].includes(x.on) && typeof x.re.test === 'function' && (x.on !== 'header' || x.key === x.key.toLowerCase())) && typeof h.notes === 'string' && h.notes.length > 60), 'every host has a name, signals and notes', hosts.length + ' hosts');
ok(hosts.every(h => !/[$€£]\s?\d|\bper month\b|\bfree\b|\b\d+\s?(GB|MB|visits)\b|\bunlimited\b/i.test(h.notes)), 'no note states a price, a quota or a free offer');
eq([H.hostByName('WP Engine').id, H.hostByName('moving to Kinsta hosting').id, H.hostByName('WordPress'), H.hostByName('wp')], ['wpengine', 'kinsta', null, null], 'a host is matched on its full name only');
eq(H.DOH_HOSTS, ['https://cloudflare-dns.com/*', 'https://dns.google/*'], 'the two resolver origins are exported for the manifest');

/* ---------- 9. the runbook: WordPress, mail on the old host ---------- */
const sharedL = await H.dnsLookup(N, { http: doh(shared) });
const wpFp = H.fingerprint({ url: `https://www.${N}/`, status: 200, html: WP_HTML, headers: { server: 'Apache' } });
let p = H.plan({ domain: N, from: 'Bluehost', to: 'Kinsta', platform: 'wordpress', method: 'manual', dns: sharedL, fingerprint: wpFp, forms: true, ecommerce: false, sizeMb: 1800, launchDate: '2026-11-18' });
const ids = p.phases.map(x => x.id);
eq(ids, ['inventory', 'backups', 'email', 'ttl', 'build', 'urls', 'test', 'ssl', 'freeze', 'cutover', 'verify', 'monitor'], 'the twelve phases of a WordPress move, in order');
ok(p.title === `Hosting move runbook: ${N}` && /from Bluehost to Kinsta: WordPress, by a manual copy/.test(p.summary) && /cutover on Wednesday, November 18/.test(p.summary) && /2 blocking questions must be settled before any DNS change\.$/.test(p.summary), 'the summary names both hosts, the method, the date and the blockers', p.summary);
ok(p.blockers.length === 2 && /Mail for northside-comfort\.test is delivered to the current web host/.test(p.blockers[0]) && /DNS for northside-comfort\.test is hosted at Bluehost/.test(p.blockers[1]) && p.unknowns.filter(u => /^Blocking: /.test(u)).length === 2, 'mail on the old host and DNS in the old account are both blocking questions');
const step = (id, re) => p.phases.find(x => x.id === id).steps.find(x => re.test(x.do));
ok(step('email', /Decide where mail lives/).risk === 'high' && step('email', /imapsync/) && step('email', /how the website itself sends mail/), 'the mail phase carries the decision at high risk, the mailbox copy and the site\'s own sending');
ok(/SPF record authorizes the current server/.test(step('email', /how the website itself sends mail/).why), 'the SPF finding is carried into the reason');
const ws = p.dnsWorksheet;
ok(ws.filter(r => r.type === 'MX').length === 1 && ws.filter(r => r.type === 'MX').every(r => r.action === 'keep' && /only while that account stays open/.test(r.note)), 'the worksheet keeps the MX record and says what it depends on');
ok(ws.filter(r => r.type === 'TXT').length === 3 && ws.filter(r => r.type === 'TXT').every(r => r.action === 'keep') && ws.some(r => r.type === 'TXT' && /names the current web server/.test(r.note)) && ws.some(r => /Ownership verification for Google/.test(r.note)), 'every TXT record is kept: SPF with its warning, verification named');
eq(ws.filter(r => r.name === '@' && r.type === 'A').map(r => [r.current, r.action]), [['203.0.113.10 (TTL 14400)', 'lower TTL first']], 'the apex A record changes, after its TTL is lowered');
ok(ws.find(r => r.name === 'www' && r.type === 'CNAME').action === 'keep' && ws.find(r => r.name === 'mail' && r.type === 'A').action === 'keep' && ws.find(r => r.type === 'NS').action === 'review' && ws.some(r => /_domainkey/.test(r.name)) && ws.find(r => r.type === 'SOA').action === 'keep', 'www follows the apex, the mail host stays, the nameservers need review, DKIM is flagged as invisible to a lookup');
ok(ws.every(r => ['keep', 'change', 'lower TTL first', 'review'].includes(r.action)), 'every action is one of the four');
ok(/14400 seconds/.test(step('ttl', /Lower the TTL to 300/).do) && /\(4 hours\)/.test(step('ttl', /Lower the TTL to 300/).verify) && /the A record of the bare domain/.test(step('ttl', /Lower the TTL to 300/).do), 'the TTL step names the records and how long to wait');
ok(/rsync -avz/.test(step('build', /Copy the files/).do) && /mysqldump --single-transaction/.test(step('build', /Export the database/).do) && step('build', /wp-config\.php/) && step('build', /advanced-cache\.php/), 'the manual build copies files with rsync, the database with a dump, writes wp-config and removes host leftovers');
const sr = step('urls', /wp search-replace/);
ok(/--precise --all-tables --skip-columns=guid --dry-run/.test(sr.do) && /serialized PHP/.test(sr.why) && /Elementor is in use/.test(step('urls', /Replace URL/).do) && /wp elementor replace-urls/.test(step('urls', /Replace URL/).do) && step('urls', /hosts file entry keeps the real domain/), 'search and replace is serialization safe, dry run first, with the Elementor steps and the advice to avoid it altogether');
ok(/`[^`]+`/.test(sr.do) && !/\[\[|\]\]/.test(JSON.stringify(p)), 'commands are in backticks and no authoring bracket leaks');
ok(step('test', /hosts file entry/) && step('test', /noindex/).risk === 'high' && /wp option get blog_public/.test(step('test', /noindex/).do) && step('test', /Send mail from the copy/), 'testing runs under the real name, checks noindex at high risk and tests outgoing mail');
ok(step('cutover', /change only the web records/) && /Leave MX, TXT/.test(step('cutover', /change only the web records/).do) && step('ssl', /valid certificate/) && step('monitor', /14 to 30 days/) && step('verify', /Search Console/), 'cutover touches only web records; SSL, verification and the old host\'s retirement each have their step');
ok(p.phases.every(ph => ph.when && ph.steps.length && ph.steps.every(x => x.do && x.why && x.verify && ['low', 'medium', 'high'].includes(x.risk) && x.owner)), 'every step has what to do, why, how to check, a risk and an owner');
ok(/\(Wednesday, November 11\)$/.test(p.phases[0].when) && /\(Monday, November 16 to Tuesday, November 17\)$/.test(p.phases.find(x => x.id === 'ttl').when) && /^Days 1 to 30 \(Thursday, November 19 to Friday, December 18\)$/.test(p.phases.find(x => x.id === 'monitor').when), 'phase dates are counted back from the cutover, and forward after it', p.phases.find(x => x.id === 'monitor').when);
ok(p.freeze.needed && p.freeze.level === 'content and entries' && p.freeze.covers.some(c => /form entries/.test(c)) && step('freeze', /Reconcile/), 'forms mean a freeze that covers entries, and a reconciliation');
ok(p.rollback.length === 5 && /saved zone/.test(p.rollback[1]) && p.postLaunch.length === 6 && p.risks.length >= 9 && p.risks.every(r => r.risk && r.mitigation), 'rollback, post launch checks and the risk table are filled');
ok(p.risks.some(r => /Blocking item: decide where the mailboxes live/.test(r.mitigation)) && p.risks.some(r => /DNS is hosted with a web hosting account/.test(r.risk) && /Move the zone to the registrar/.test(r.mitigation)) && p.risks.some(r => /No DMARC record/.test(r.risk) && /Not caused by the move/.test(r.mitigation)), 'the mail risk points at the blocker, and each DNS finding joins the risk table with the step that answers it');
ok(new Set(p.risks.map(r => r.mitigation)).size === p.risks.length && !p.risks.some(r => /Mail for this domain is delivered to the web host/.test(r.risk)), 'no boilerplate: every mitigation is its own, and a finding a standing row covers is not repeated');
ok(/the DNS panel \(also at Bluehost\), Bluehost, Kinsta/.test(step('inventory', /List every login/).do) && /^Specific to Kinsta: A managed WordPress host\. Confirm with it:/.test(step('inventory', /Specific to Kinsta/).do) && /if it offers mailboxes at all/.test(step('email', /Decide where mail lives/).do) && /compare the last form entry on both sides/.test(step('freeze', /Reconcile/).do), 'the DNS panel is named once, the destination\'s notes are their own step, mailbox hosting is not assumed, and reconciliation names only what the site has');
const md = p.markdown;
ok(p.phases.every((ph, i) => md.includes(`## Phase ${i + 1}: ${ph.name}`)) && md.includes('## DNS worksheet') && md.includes('| Record | Type | Current | Action | Note |') && md.includes('## Settle these first') && md.includes('## Rollback') && md.includes('## After launch') && md.includes('## Risks') && md.startsWith(`# Hosting move runbook: ${N}`), 'the markdown holds every phase, the worksheet, the blockers, the risks and the rollback');
ok(!/undefined|\[object Object\]|NaN/.test(md) && !/[—–]/.test(md), 'the document has no stray values and no dashes', (md.match(/undefined|\[object Object\]|NaN|[—–]/) || [''])[0]);
ok(!/\$\d|per month/i.test(md) && /Specific to Kinsta: A managed WordPress host\. Confirm with it/.test(md) && md.includes('- Platform: WordPress') && md.includes('- Copy method: a manual copy (files and a database dump)'), 'the destination host\'s notes are things to confirm, never prices; the header uses plain labels');

/* ---------- 10. the runbook: other shapes ---------- */
p = H.plan({ domain: 'docs.peak-air.test', from: 'Netlify', to: 'Cloudflare Pages', platform: 'static', emailOnDomain: false, forms: false, ecommerce: false, sizeMb: 40, launchDate: '2026-11-20' });
eq(p.phases.map(x => x.id), ['inventory', 'backups', 'ttl', 'build', 'test', 'ssl', 'freeze', 'cutover', 'verify', 'monitor'], 'a static site with no mail has no mail phase and no search and replace');
ok(p.method === 'manual' && p.phases.find(x => x.id === 'build').steps.some(x => /trailing slash/.test(x.do)) && p.phases.find(x => x.id === 'inventory').steps.some(x => /form handling, functions/.test(x.do)) && !/wp-config|WP CLI|wp search-replace/.test(p.markdown), 'static steps cover host level behavior and carry no WordPress commands');
ok(p.risks.some(r => /falls on a Friday/.test(r.risk)) && p.blockers.length === 0 && p.freeze.level === 'content', 'a Friday cutover is called out; nothing blocks; the freeze is content only');
ok(/Netlify/.test(p.phases[0].steps.map(x => x.do).join(' ')) && p.dnsWorksheet.length === 4 && p.dnsWorksheet.every(r => r.current === 'not looked up') && p.unknowns.some(u => /DNS records were not looked up/.test(u)), 'without a lookup the worksheet is generic and the lookup becomes an open question');
p.phases.forEach((ph, i) => ok(p.markdown.includes(`## Phase ${i + 1}: ${ph.name}`), `static markdown has phase ${i + 1}: ${ph.name}`));

p = H.plan({ domain: P, from: 'WP Engine', to: 'Kinsta', platform: 'wordpress', dns: cfL, ecommerce: true, launchDate: '2026-11-17', changeNameservers: true,
  inventory: { wp: '6.6.2', php: '8.1.27', multisite: false, db: { prefix: 'wpx_', size_bytes: 600 * 1048576 }, uploads: { bytes: 3200 * 1048576 }, object_cache: true, cron: { disabled: true }, elementor: { version: '3.24.5', pro: '3.24.3' },
    plugins: [{ slug: 'woocommerce', active: true }, { slug: 'wordfence', active: true }, { slug: 'elementor', active: true }, { slug: 'wp-rocket', active: true }, { slug: 'akismet', active: false }] } });
ok(p.method === 'manual' && p.assumptions.some(a => /a site that takes orders needs a short, controlled final sync/.test(a)) && p.assumptions.some(a => /about 3800 MB/.test(a)), 'a store is copied by hand, and the size is taken from the inventory');
ok(p.freeze.level === 'full' && p.freeze.covers.some(c => /orders, bookings and payments/.test(c)) && p.phases.find(x => x.id === 'freeze').steps[0].risk === 'high' && /store in maintenance mode/.test(p.phases.find(x => x.id === 'freeze').steps[0].do) && p.phases.find(x => x.id === 'freeze').steps.some(x => /last order number/.test(x.do)), 'ecommerce means a full freeze, at high risk, with order reconciliation');
ok(p.risks.some(r => /Orders or leads placed between the final copy and the cutover/.test(r.risk)), 'the data loss window is in the risk table');
const all = JSON.stringify(p.phases);
ok(/WordPress 6\.6\.2, PHP 8\.1\.27, 4 active plugins, database 600 MB, uploads 3200 MB, table prefix `wpx_`/.test(all) && /same PHP version \(8\.1\)/.test(all) && /Wordfence is active: turn off its extended firewall/.test(all) && /WP Cron is disabled on the current site/.test(all) && /object cache drop in is present/.test(all), 'the inventory tailors the steps: versions, prefix, the firewall plugin, the real cron job, the object cache');
ok(/Nothing to lower: the records are proxied through Cloudflare/.test(all) && !/Leave MX, TXT and NS records out of this step/.test(all) && /change the origin address of the proxied web records/.test(all) && !/Update the AAAA records/.test(all) && /Full \(strict\)/.test(all) && /CAA records limit who may issue certificates.*letsencrypt\.org/.test(all), 'behind Cloudflare there is no TTL to lower, the cutover is the origin address with no AAAA edit, and CAA and SSL mode have their steps');
{ const q = H.plan({ domain: P, to: 'Kinsta', emailOnDomain: false, inventory: { wp: '6.6.2', php: '8.2.1', db: { prefix: 'wp_', size_bytes: 50 * 1048576 }, uploads: { bytes: 250 * 1048576 }, plugins: [{ slug: 'woocommerce', active: true }, { slug: 'gravityforms', active: true }, { slug: 'wp-mail-smtp', active: false }] } });
  ok(q.platform === 'wordpress' && q.assumptions.some(a => /^WooCommerce is active, so this plan treats the site as one that takes orders/.test(a)) && q.assumptions.some(a => /A form plugin is active \(Gravity Forms\)/.test(a)) && q.freeze.level === 'full' && q.method === 'manual' && /No SMTP plugin is active today/.test(JSON.stringify(q.phases)) && !q.unknowns.some(u => /take orders|store their entries|How large/.test(u)), 'an inventory answers what was not said: the platform, the store, the forms, the size, and that no SMTP plugin is active'); }
ok(/DNSSEC is on for this domain: remove the DS record/.test(all) && /rebuild the complete zone at the new DNS provider first/.test(all) && p.rollback.length === 6 && /cannot be rolled back quickly/.test(p.rollback[5]) && p.dnsWorksheet.find(r => r.type === 'NS').action === 'change', 'a nameserver change adds the zone rebuild, the DS record step and a rollback warning');
ok(p.dnsWorksheet.filter(r => r.type === 'MX').every(r => r.action === 'keep' && /not part of a web move/.test(r.note)) && p.dnsWorksheet.filter(r => r.type === 'CAA').every(r => r.action === 'review') && p.dnsWorksheet.find(r => r.name === '_dmarc').action === 'keep' && p.dnsWorksheet.filter(r => r.type === 'A' && r.name === '@').every(r => r.action === 'change' && /Edit the origin address inside Cloudflare/.test(r.note)), 'Google Workspace mail records are kept, CAA reviewed, proxied A records explained');
ok(p.blockers.length === 1 && /sits behind Cloudflare today.*Is leaving Cloudflare intended/.test(p.blockers[0]) && /Leave mail alone\. The MX records point at Google Workspace/.test(all), 'mail at a mail provider blocks nothing and is left alone; changing nameservers away from a Cloudflare proxied zone is the one blocking question');
ok(p.dnsWorksheet.filter(r => r.type === 'AAAA').every(r => r.action === 'keep' && /Cloudflare's own IPv6 address/.test(r.note)) && p.risks.some(r => /^Email stops/.test(r.risk) && /Rebuild every mail record at the new DNS provider/.test(r.mitigation)) && /1 blocking question must be settled before any DNS change, and 1 more is open\.$/.test(p.summary), 'the worksheet keeps Cloudflare\'s IPv6 rows, the mail risk covers the nameserver change, and the summary counts both kinds of question', p.summary);
ok(p.risks.some(r => /falls on a/.test(r.risk)) === false, 'a Tuesday cutover raises no weekday risk');

p = H.plan({ domain: 'northside-comfort.test' });
ok(p.from === null && p.to === null && p.platform === 'other' && p.launch === null && /from the current host to the new host/.test(p.summary) && /cutover date open/.test(p.summary), 'with only a domain, nothing is invented: hosts, platform and date stay open');
ok(['Who hosts the site today', 'Which host is the site moving to', 'What runs the site', 'take orders, bookings or payments', 'store their entries', 'How large is the site', 'receive email at an address ending in @northside-comfort.test', 'DNS records were not looked up', 'What date and hour is the cutover'].every(q => p.unknowns.some(u => u.includes(q))), 'each missing input becomes an open question', p.unknowns.length + ' questions');
ok(p.phases.find(x => x.id === 'email').steps.some(x => /dig \+short northside-comfort\.test MX/.test(x.do)) && !p.phases.some(x => x.id === 'urls'), 'unknown mail gets a find out step; no WordPress phase is assumed');
p = H.plan({ domain: N, to: 'Kinsta', platform: 'wordpress', emailOnDomain: true });
ok(p.blockers.length === 1 && /People receive mail at northside-comfort\.test, and the DNS records were not looked up/.test(p.blockers[0]), 'mail said to exist with no lookup is a blocker until the lookup is run');
p = H.plan({ domain: N, to: 'Kinsta', platform: 'wordpress', sizeMb: 300, forms: false, ecommerce: false, emailOnDomain: false });
ok(p.method === 'plugin' && p.phases.find(x => x.id === 'build').steps.some(x => /Duplicator, All-in-One WP Migration, WPvivid and Migrate Guru/.test(x.do)) && p.assumptions.some(a => /a migration plugin, because at about 300 MB/.test(a)) && /If the site uses Elementor/.test(JSON.stringify(p.phases)), 'a small site with nothing to protect is moved by plugin; Elementor steps stay conditional when the builder is unknown');
p = H.plan({ domain: N, to: 'Kinsta', platform: 'wordpress', method: 'host-migration', sizeMb: 300, emailOnDomain: false });
ok(p.method === 'host-migration' && p.phases.find(x => x.id === 'build').steps.some(x => /temporary administrator account/.test(x.do)) && p.phases.find(x => x.id === 'build').steps.some(x => /what their copy includes and what it leaves out/.test(x.do)) && p.phases.find(x => x.id === 'freeze').steps.some(x => /Ask Kinsta for the final copy/.test(x.do)), 'a host run migration keeps access temporary, asks what is left out and waits for the final copy');
p = H.plan({ domain: N, from: 'Wix', to: 'Kinsta', emailOnDomain: false });
ok(p.method === 'rebuild' && p.blockers.some(b => /Wix is a closed platform: the site cannot be copied/.test(b)) && p.phases.find(x => x.id === 'build').steps.some(x => /Rebuild the pages/.test(x.do)) && !p.phases.some(x => x.id === 'urls') && p.markdown.includes('- Copy method: a rebuild on the new platform, with a redirect map'), 'leaving a closed platform is a rebuild, said plainly, with no copy steps');
p = H.plan({ domain: N, from: 'Bluehost', to: 'Shopify', platform: 'wordpress', emailOnDomain: false });
ok(p.method === 'rebuild' && p.blockers.some(b => /Shopify is a closed platform: a site is built inside it, not copied onto it/.test(b)) && !p.phases.some(x => x.id === 'urls') && !p.phases[0].steps.some(x => /Specific to Shopify/.test(x.do)), 'moving onto a closed platform is a rebuild too');
p = H.plan({ domain: N, to: 'Kinsta', platform: 'wordpress', sizeMb: 100, emailOnDomain: false, launchDate: '2026-11-16' });
ok(p.risks.some(r => /falls on a Monday/.test(r.risk)) && p.launch.weekday === 'Monday', 'a Monday cutover is called out for a service business');
p = H.plan({ domain: 'a.test', to: 'Kinsta', platform: 'wordpress', sizeMb: 100, dns: { records: { apex: { name: 'a.test', status: 'ok', A: [{ data: '198.51.100.9', ttl: 3600 }], NS: [{ data: 'ns-12.awsdns-01.com', ttl: 1 }], MX: [{ priority: 0, host: 'a.test', ttl: 3600 }], TXT: [] }, www: { name: 'www.a.test', CNAME: [{ name: 'www.a.test', data: 'a.test', ttl: 3600 }], A: [{ data: '198.51.100.9', ttl: 3600 }] }, dmarc: [] } } });
ok(p.dnsWorksheet.find(r => r.type === 'MX').action === 'review' && /mail follows the A record to the new web server/.test(p.dnsWorksheet.find(r => r.type === 'MX').note) && p.phases.find(x => x.id === 'email').steps.some(x => /create a `mail` record that points at the old server/.test(x.do)), 'an MX that names the bare domain is the one MX marked for review, with the fix as a step (records without a precomputed summary are read on the spot)');
ok(H.plan().title === 'Hosting move runbook: the domain' && H.plan(null).phases.length >= 9, 'plan tolerates empty input');

/* ---------- 11. before and after ---------- */
const page = (o = {}) => `<!doctype html><html><head><title>${o.title || 'AC Repair in Mesquite | Northside Comfort'}</title><meta name="description" content="${o.desc == null ? 'Same day AC repair.' : o.desc}">${o.robots ? `<meta name="robots" content="${o.robots}">` : ''}${o.canonical === false ? '' : `<link rel="canonical" href="${o.canonical || 'https://www.' + N + (o.path || '/')}">`}<style>.x{color:red}</style></head><body><h1>${o.h1 || 'AC Repair in Mesquite'}</h1><p>${'word '.repeat(o.words || 200)}</p>${o.tel === false ? '' : '<a href="tel:+19725550100">Call</a>'}${o.form === false ? '' : '<form method="post"><input name="phone"></form>'}${o.extra || ''}<script>var hidden = "these words do not count";</script></body></html>`;
const OLD = `https://www.${N}`, NEW = 'https://northside.kinsta.test';
const site = {};
const put = (base, path, o) => { site[base + path] = o.throw ? o : { status: o.status || 200, url: base + (o.landsOn || path), text: o.status >= 400 ? 'Not found' : page(Object.assign({ path }, o)), headers: o.headers || {}, ms: o.ms || 100 }; };
put(OLD, '/', {}); put(NEW, '/', {}); put(NEW, '/orphan/', { robots: 'noindex' });
put(OLD, '/ac-repair/', {}); put(NEW, '/ac-repair/', { status: 404 });
put(OLD, '/about/', { title: 'About Northside Comfort' }); put(NEW, '/about/', { title: 'About Us' });
put(OLD, '/contact/', {}); put(NEW, '/contact/', { form: false, tel: false });
put(OLD, '/furnace/', {}); put(NEW, '/furnace/', { robots: 'noindex, nofollow' });
put(OLD, '/heat-pumps/', {}); put(NEW, '/heat-pumps/', { headers: { 'X-Robots-Tag': 'noindex' } });
put(OLD, '/ducts/', {}); put(NEW, '/ducts/', { throw: true });
put(OLD, '/financing/', {}); put(NEW, '/financing/', { canonical: NEW + '/financing/', words: 90, desc: '', ms: 2500, extra: '<img src="http://cdn.old.test/a.jpg">' });
put(OLD, '/maintenance/', {}); put(NEW, '/maintenance/', { landsOn: '/maintenance-plan/', h1: 'Maintenance Plan' });
const siteHttp = async url => { const p = site[url]; if (!p || p.throw) throw new D.net.NetError(`Could not reach ${D.hostOf(url)}: connection refused.`, { code: 'network' }); return Object.assign({ ok: p.status < 400, redirected: false, cut: false }, p); };
const paths = ['/', '/ac-repair/', '/about/', '/contact/', '/furnace/', '/heat-pumps/', '/ducts/', '/financing/', '/maintenance/'];
let V = await H.verify({ oldBase: OLD + '/anything', newBase: NEW, paths, http: siteHttp, concurrency: 3 });
const row = pth => V.rows.find(r => r.path === pth);
eq([V.summary.checked, V.summary.ok, V.summary.issues, V.summary.unreachable, V.rows.map(r => r.path)], [9, 1, 8, 1, paths], 'nine pages checked in order: one clean, eight with differences, one unreachable');
ok(row('/').ok && row('/').issues.length === 0 && row('/').old.words === 205 && row('/').old.title === 'AC Repair in Mesquite | Northside Comfort' && row('/').old.h1 === 'AC Repair in Mesquite' && row('/').old.tel && row('/').old.form && row('/').old.canonical === `https://www.${N}/`, 'a matching page is clean; scripts and styles do not count as words', row('/').old.words);
ok(row('/ac-repair/').issues[0] === 'status 200 on the old site, 404 on the new copy' && row('/ac-repair/').issues.length === 1 && row('/ac-repair/').severity === 3, 'a 404 on the new host is the one finding for that page');
ok(row('/about/').issues.some(i => i === 'title changed: "About Northside Comfort" became "About Us"'), 'a changed title is quoted');
ok(row('/contact/').issues.includes('the form is missing on the new copy') && row('/contact/').issues.includes('the click to call link is missing on the new copy'), 'a missing form and a missing phone link are reported');
ok(/noindex on the new copy \(noindex, nofollow\)/.test(row('/furnace/').issues[0]) && /noindex on the new copy \(noindex\)/.test(row('/heat-pumps/').issues[0]) && row('/heat-pumps/').severity === 3, 'noindex is caught in the meta tag and in the X-Robots-Tag header');
ok(/the new copy could not be reached: Could not reach northside\.kinsta\.test/.test(row('/ducts/').issues[0]), 'an unreachable page says so');
const fin = row('/financing/').issues.join(' | ');
ok(/canonical on the new copy points at the temporary host northside\.kinsta\.test/.test(fin) && /content length changed: 205 words before, 95 now/.test(fin) && /meta description missing/.test(fin) && /1 resource loaded over plain http/.test(fin) && /slower: 100 ms before, 2500 ms now/.test(fin), 'canonical on the temporary host, lost content, lost description, mixed content and a slow answer are each found', fin);
ok(row('/maintenance/').issues.some(i => /lands on a different path: \/maintenance before, \/maintenance-plan now/.test(i)) && row('/maintenance/').issues.some(i => /H1 changed/.test(i)), 'a page that lands somewhere else is reported with both paths');
ok(V.summary.worst.length === 5 && V.summary.worst.slice(0, 4).map(w => w.path).sort().join() === ['/ac-repair/', '/ducts/', '/furnace/', '/heat-pumps/'].sort().join(), 'the worst list leads with the pages that would cost rankings or leads', V.summary.worst.map(w => w.path).join(' '));
/* after cutover both sides share one domain: compare with a snapshot taken before */
const snap = await H.snapshot({ base: OLD, paths: ['/', '/about/', 'https://www.' + N + '/contact/', 'furnace/'], http: siteHttp });
eq([snap.base, snap.rows.map(r => r.path), snap.rows[1].title], [OLD, ['/', '/about/', '/contact/', '/furnace/'], 'About Northside Comfort'], 'a snapshot keeps the facts of each page; paths may be given as URLs or without the slash');
V = await H.verify({ before: snap, newBase: NEW, http: siteHttp, tempHosts: ['northside.kinsta.test'] });
eq([V.summary.checked, V.summary.ok, V.rows.find(r => r.path === '/about/').issues.some(i => /title changed/.test(i)), V.oldBase], [4, 1, true, OLD], 'verify against a snapshot finds the same differences without fetching the old site again');
V = await H.verify({ before: [{ path: '/', status: 200, finalUrl: OLD + '/', title: 'T', description: '', canonical: '', h1: '', words: 5, robots: '', noindex: false, tel: false, form: false }], newBase: NEW, paths: ['/', '/nowhere/', '/orphan/'], http: siteHttp });
ok(V.rows[1].issues.some(i => /the new copy could not be reached/.test(i)) && V.rows[1].issues.some(i => /not in the before snapshot/.test(i)) && V.rows[1].severity === 3, 'a path missing on both sides reports both facts');
ok(V.rows[2].issues.some(i => /not in the before snapshot, so there is nothing to compare with/.test(i)) && V.rows[2].issues.some(i => /noindex on the new copy/.test(i)), 'a path missing from the snapshot still has the new copy\'s own faults reported');
V = await H.verify({ oldBase: OLD, newBase: NEW, paths: ['/financing/', '/'], http: siteHttp, tempHosts: ['northside.kinsta.test'] });
ok(V.rows[0].issues.some(i => /1 reference to a temporary host remains in the page source/.test(i)) && V.rows[1].ok, 'references to a named temporary host left in the page source are counted');
ok(await throwsAsync(() => H.verify({ newBase: NEW, http: siteHttp }), /verify needs the old site/) && await throwsAsync(() => H.verify({ oldBase: OLD, newBase: 'not a url ::', http: siteHttp }), /Not a site address/), 'verify refuses to run without both sides');
const ac2 = new AbortController(); ac2.abort();
ok(await throwsAsync(() => H.verify({ oldBase: OLD, newBase: NEW, paths, http: siteHttp, signal: ac2.signal }), /Stopped/), 'a stop signal ends the comparison');
const pf = H.pageFacts({ status: 200, url: 'https://x.test/', headers: {}, text: '<title> A &amp; B </title><meta content="D &quot;q&quot;" name="description"><link href="/c/" rel="canonical"><h1>Hi <span>there</span></h1><p>one two</p>' });
eq([pf.title, pf.description, pf.canonical, pf.h1, pf.words, pf.noindex, pf.form, pf.tel], ['A & B', 'D "q"', '/c/', 'Hi there', 4, false, false, false], 'pageFacts reads attributes in any order and decodes entities');

/* ---------- 12. the day's checklists ---------- */
eq(H.checklist(), ['pre-cutover', 'cutover', 'post-cutover'], 'three checklists');
ok(['pre-cutover', 'cutover', 'post-cutover'].every(k => { const c = H.checklist(k); return c && c.kind === k && c.title && c.items.length >= 8 && c.items.every(i => i.id && i.text); }) && H.checklist('nonsense') === null, 'each checklist has a title and items; an unknown kind is null');
done();
