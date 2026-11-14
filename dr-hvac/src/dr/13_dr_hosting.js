/* ==== src/dr/13_dr_hosting.js ==== */
/* ==== dr_hosting ==== */
"use strict";
/* ============================ Dr. HVAC: moving a site between hosts ============================
   Three jobs, in the order a move needs them:
     find out what is there   dnsLookup (every record that matters, read over DNS over HTTPS), interpret (who runs DNS,
                              mail and the web address, and what in that picture can hurt), fingerprint (the stack a
                              page and its headers give away)
     write the runbook        plan: phases, each step with its reason and its check, a DNS worksheet that names every
                              record found and says keep or change, the risks, the rollback, all of it also as markdown
     check the result         snapshot before, verify after: status, title, canonical, robots, forms and phone links.
                              Before cutover the copy is read on its temporary URL, or under the real name once a hosts
                              file entry is in place (the browser follows it, so the earlier snapshot is the old side);
                              after cutover the same snapshot is compared with the live domain
   No DOM and no dependencies: the same file runs in the page and in the Node tests. Every request goes through an
   injected http(url, opts) shaped like DRHVAC.net.get, which is the default.
   What this file will not do: state a host's prices, plan names or current features. Hosts change those by the month;
   the runbook says what to confirm with the host and why it matters. A provider read from a DNS or header pattern that
   is a strong hint and no more is marked "likely". An input nobody gave becomes an open question, never a guess. */
(() => {
  const D = DRHVAC;
  const lc = s => String(s == null ? '' : s).toLowerCase();
  const undot = s => lc(s).trim().replace(/\.+$/, '');
  const uniq = a => [...new Set(a)];
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const http0 = (url, o) => D.net.get(url, o);
  const stopErr = () => new D.net.NetError('Stopped.', { code: 'stopped' });
  const isStop = e => !!(e && e.code === 'stopped');
  async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; const run = async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }; await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, run)); return out; }

  /* ============================ DNS ============================ */
  /* Two public resolvers that answer in JSON. Cloudflare first; Google when Cloudflare does not answer. Both send CORS
     headers and the accept header below is on the browser's safe list, so no preflight is made. */
  const DOH = [
    { id: 'cloudflare', name: 'Cloudflare (1.1.1.1)', url: 'https://cloudflare-dns.com/dns-query' },
    { id: 'google', name: 'Google (8.8.8.8)', url: 'https://dns.google/resolve' },
  ];
  const DOH_HOSTS = ['https://cloudflare-dns.com/*', 'https://dns.google/*'];
  const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA'];
  const WWW_TYPES = ['A', 'AAAA', 'CNAME'];
  const TNUM = { A: 1, NS: 2, CNAME: 5, SOA: 6, MX: 15, TXT: 16, AAAA: 28, CAA: 257 };
  const TNAME = {}; Object.keys(TNUM).forEach(k => { TNAME[TNUM[k]] = k; });
  const RCODE = ['NOERROR', 'FORMERR', 'SERVFAIL', 'NXDOMAIN', 'NOTIMP', 'REFUSED'];

  /* a host name out of whatever was typed: a URL, an email address, a name with www or a trailing dot */
  function cleanDomain(input) {
    const raw = String(input == null ? '' : input).trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/[\/?#].*$/, '').replace(/^.*@/, '').replace(/:\d+$/, '').replace(/\.+$/, '');
    const h = D.hostOf(raw).replace(/^www\./, '');
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h) ? h : '';
  }
  /* TXT data arrives quoted from Cloudflare ("a" "b" for a record split in two) and bare from Google */
  function txtClean(d) { d = String(d == null ? '' : d).trim(); if (d[0] !== '"') return d; const segs = []; const re = /"((?:[^"\\]|\\.)*)"/g; let m; while ((m = re.exec(d))) segs.push(m[1].replace(/\\(.)/g, '$1')); return segs.length ? segs.join('') : d; }
  function caaParse(d) {
    d = String(d || '').trim();
    let m = d.match(/^(\d+)\s+([a-z0-9]+)\s+"?([^"]*)"?$/i); if (m) return { flags: +m[1], tag: lc(m[2]), value: m[3].trim() };
    m = d.match(/^\\#\s+\d+\s+([0-9a-f\s]+)$/i);          /* the generic form of RFC 3597: flags, tag length, tag, value, in hex */
    if (m) { const b = (m[1].replace(/\s+/g, '').match(/../g) || []).map(x => parseInt(x, 16)); const n = b[1] || 0; const s = a => String.fromCharCode.apply(null, a); return { flags: b[0] || 0, tag: lc(s(b.slice(2, 2 + n))), value: s(b.slice(2 + n)) }; }
    return { flags: 0, tag: '', value: d };
  }
  function rec(type, a) {
    const data = String(a.data == null ? '' : a.data).trim(); const ttl = +a.TTL || 0;
    if (type === 'A' || type === 'AAAA') return { data: lc(data), ttl };
    if (type === 'CNAME' || type === 'NS') return { data: undot(data), ttl };
    if (type === 'MX') { const m = data.match(/^(\d+)\s+(\S+)$/); const host = undot(m ? m[2] : data); return { data: `${m ? +m[1] : 0} ${host || '.'}`, ttl, priority: m ? +m[1] : 0, host }; }
    if (type === 'TXT') return { data: txtClean(data), ttl };
    if (type === 'SOA') { const p = data.split(/\s+/); return { data, ttl, mname: undot(p[0]), rname: undot(p[1]), serial: +p[2] || 0, refresh: +p[3] || 0, retry: +p[4] || 0, expire: +p[5] || 0, minimum: +p[6] || 0 }; }
    if (type === 'CAA') { const c = caaParse(data); return { data: `${c.flags} ${c.tag} "${c.value}"`, ttl, flags: c.flags, tag: c.tag, value: c.value }; }
    return { data, ttl };
  }
  /* one question to the first resolver that answers. A resolver that failed twice is skipped once another has answered. */
  async function ask(name, type, st) {
    let last = '';
    for (const r of DOH) {
      if ((st.fail[r.id] || 0) >= 2 && [...st.used].some(id => id !== r.id)) continue;
      if (st.signal && st.signal.aborted) throw stopErr();
      try {
        const res = await st.http(`${r.url}?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: 'application/dns-json' }, timeout: 12000, signal: st.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = D.safeParse(res.text, null);
        if (!j || typeof j.Status !== 'number') throw new Error('the answer was not DNS JSON');
        st.used.add(r.id); return j;
      } catch (e) { if (isStop(e)) throw e; st.fail[r.id] = (st.fail[r.id] || 0) + 1; last = `${r.name}: ${(e && e.message) || e}`; }
    }
    throw new Error(last || 'no resolver left to ask');
  }
  /* dnsLookup(domain, {types, http, signal}) → {domain, at, resolver, records, summary, errors}
     records.apex and records.www hold a list per type ({data, ttl} and the parsed parts), records.dmarc the _dmarc TXT,
     records.zone the parent zone when the name asked about is a subdomain without its own nameservers, records.mxHosts
     the addresses of mail hosts that live inside the domain, records.dnssec whether the answers validated. */
  async function dnsLookup(domain, o) {
    o = o || {}; const apex = cleanDomain(domain);
    if (!apex) throw new D.net.NetError('Not a domain name: ' + domain, { code: 'bad_domain' });
    const types = o.types && o.types.length ? uniq(o.types.map(t => String(t).toUpperCase()).filter(t => TNUM[t])) : TYPES;
    const st = { http: o.http || http0, signal: o.signal, used: new Set(), fail: {} };
    const blank = name => ({ name, status: 'ok' });
    const R = { apex: blank(apex), www: blank('www.' + apex), dmarc: [] };
    const errors = []; let answered = 0, validated = 0, zoneHint = '';
    const addCname = (box, c) => { box.CNAME = box.CNAME || []; if (!box.CNAME.some(x => x.name === c.name && x.data === c.data)) box.CNAME.push(c); };
    const take = (slot, name, type, j) => {
      if (j.AD === true) validated++;
      const status = j.Status === 0 ? 'ok' : j.Status === 3 ? 'nxdomain' : lc(RCODE[j.Status] || 'error ' + j.Status);
      const list = [], chain = [];
      for (const a of (j.Answer || [])) { const t = TNAME[a.type]; if (t === 'CNAME') chain.push(Object.assign({ name: undot(a.name) }, rec('CNAME', a))); else if (t === type) list.push(rec(type, a)); }
      let zone = ''; if (!list.length && !chain.length) for (const a of (j.Authority || [])) if (a.type === 6) zone = undot(a.name);
      if (slot === 'dmarc') { R.dmarc = list; return; }
      if (slot === 'zdmarc') { R.zone.dmarc = list; return; }
      const box = R[slot];
      if (type === 'CNAME') { box.CNAME = box.CNAME || []; chain.forEach(c => addCname(box, c)); } else { box[type] = list; chain.forEach(c => addCname(box, c)); }
      if (status === 'nxdomain') box.status = 'nxdomain'; else if (status !== 'ok') errors.push({ name, type, error: status.toUpperCase() });
      if (slot === 'apex' && zone && !zoneHint) zoneHint = zone;
    };
    const run = list => pool(list, 6, async ([slot, name, type]) => { try { take(slot, name, type, await ask(name, type, st)); answered++; } catch (e) { if (isStop(e)) throw e; errors.push({ name, type, error: (e && e.message) || String(e) }); } });
    const jobs = types.map(t => ['apex', apex, t]).concat(types.filter(t => WWW_TYPES.includes(t)).map(t => ['www', 'www.' + apex, t]));
    if (types.includes('TXT')) jobs.push(['dmarc', '_dmarc.' + apex, 'TXT']);
    await run(jobs);
    if (!answered) throw new D.net.NetError(`No DNS resolver answered for ${apex}. ${errors[0] ? errors[0].error : ''}`.trim(), { code: 'dns_unreachable', errors });
    /* a subdomain has no NS of its own: the SOA in the authority section names the zone that holds its mail and nameserver records */
    if (R.apex.status === 'ok' && !(R.apex.NS || []).length && zoneHint && zoneHint !== apex && zoneHint.includes('.') && apex.endsWith('.' + zoneHint)) {
      R.zone = blank(zoneHint);
      const zj = ['NS', 'MX', 'TXT', 'SOA', 'CAA'].filter(t => types.includes(t)).map(t => ['zone', zoneHint, t]); if (types.includes('TXT')) zj.push(['zdmarc', '_dmarc.' + zoneHint, 'TXT']);
      await run(zj);
    }
    /* a mail host inside the domain (mail.example.com) is usually the web server under another name: its address settles it */
    const scope = R.zone ? R.zone.name : apex;
    const inside = uniq((R.apex.MX || []).concat((R.zone && R.zone.MX) || []).map(m => m.host).filter(h => h && (h === scope || h.endsWith('.' + scope)))).slice(0, 4);
    if (inside.length && types.includes('MX')) {
      R.mxHosts = {};
      await pool(inside, 4, async h => { try { const j = await ask(h, 'A', st); R.mxHosts[h] = (j.Answer || []).filter(a => a.type === 1).map(a => lc(a.data)); } catch (e) { if (isStop(e)) throw e; errors.push({ name: h, type: 'A', error: (e && e.message) || String(e) }); } });
    }
    R.dnssec = validated > 0;
    return { domain: apex, at: D.nowIso(), resolver: [...st.used].join(', '), records: R, summary: interpret(R), errors };
  }

  /* ---------- who is behind a name: patterns that have held for years ---------- */
  /* [pattern on a nameserver, provider, {reg: the registrar when the nameservers are a registrar's own, web: DNS that
     comes with a web hosting account and goes when the account goes, guess: say "likely"}] */
  const NS_HINTS = [
    [/\.ns\.cloudflare\.com$/, 'Cloudflare'],
    [/^ns-\d+\.awsdns-\d+\.(com|net|org|co\.uk)$/, 'Amazon Route 53'],
    [/\.domaincontrol\.com$/, 'GoDaddy', { reg: 'GoDaddy' }],
    [/\.registrar-servers\.com$/, 'Namecheap', { reg: 'Namecheap' }],
    [/^ns-cloud-[a-z]\d+\.googledomains\.com$/, 'Google Cloud DNS', { reg: 'Squarespace Domains, which took over Google Domains', guess: true }],
    [/\.squarespacedns\.com$/, 'Squarespace', { reg: 'Squarespace Domains' }],
    [/\.azure-dns\.(com|net|org|info)$/, 'Azure DNS'],
    [/\.digitalocean\.com$/, 'DigitalOcean'],
    [/\.linode\.com$/, 'Linode (Akamai)'],
    [/\.nsone\.net$/, 'NS1 (Netlify DNS runs on it)', { guess: true }],
    [/\.vercel-dns\.com$/, 'Vercel'],
    [/\.dnsimple(-edge)?\.(com|net|org)$/, 'DNSimple'],
    [/\.dnsmadeeasy\.com$/, 'DNS Made Easy'],
    [/\.he\.net$/, 'Hurricane Electric'],
    [/\.cloudns\.(net|com|uk)$/, 'ClouDNS'],
    [/\.hover\.com$/, 'Hover', { reg: 'Hover' }],
    [/\.name\.com$/, 'Name.com', { reg: 'Name.com' }],
    [/\.worldnic\.com$/, 'Network Solutions', { reg: 'Network Solutions' }],
    [/\.gandi\.net$/, 'Gandi', { reg: 'Gandi' }],
    [/\.porkbun\.com$/, 'Porkbun', { reg: 'Porkbun' }],
    [/\.dynadot\.com$/, 'Dynadot', { reg: 'Dynadot' }],
    [/\.ui-dns\.(com|org|de|biz)$/, 'IONOS', { reg: 'IONOS', guess: true }],
    [/\.wixdns\.net$/, 'Wix', { web: true }],
    [/\.wordpress\.com$/, 'WordPress.com', { web: true }],
    [/\.bluehost\.com$/, 'Bluehost', { web: true }],
    [/\.hostgator\.com$/, 'HostGator', { web: true }],
    [/\.siteground\.net$/, 'SiteGround', { web: true }],
    [/\.dreamhost\.com$/, 'DreamHost', { web: true }],
    [/\.inmotionhosting\.com$/, 'InMotion Hosting', { web: true }],
    [/\.a2hosting\.com$/, 'A2 Hosting', { web: true }],
    [/\.(hostinger\.com|dns-parking\.com)$/, 'Hostinger', { web: true }],
    [/\.liquidweb\.com$/, 'Liquid Web', { web: true }],
    [/\.nexcess\.net$/, 'Nexcess', { web: true }],
    [/\.(websitewelcome|hostmonster|justhost)\.com$/, 'a shared host of the Bluehost and HostGator family', { web: true, guess: true }],
  ];
  /* [pattern on a CNAME target, {host | cdn, closed: a platform a site cannot be copied out of, guess}] */
  const CNAME_HINTS = [
    [/\.(wpengine|wpenginepowered|wpeproxy)\.com$/, { host: 'WP Engine' }],
    [/\.kinsta\.(cloud|com)$/, { host: 'Kinsta' }],
    [/\.(flywheelsites|flywheelstaging)\.com$/, { host: 'Flywheel' }],
    [/\.(pantheonsite\.io|edge\.pantheon\.io)$/, { host: 'Pantheon' }],
    [/\.cloudwaysapps\.com$/, { host: 'Cloudways' }],
    [/\.sg-host\.com$/, { host: 'SiteGround' }],
    [/\.onrocket\.site$/, { host: 'Rocket.net' }],
    [/\.elementor\.cloud$/, { host: 'Elementor Hosting' }],
    [/\.wordpress\.com$/, { host: 'WordPress.com' }],
    [/\.(netlify\.app|netlify\.com|netlifyglobalcdn\.com)$/, { host: 'Netlify' }],
    [/(^|\.)vercel-dns\.com$|\.vercel\.app$/, { host: 'Vercel' }],
    [/\.github\.io$/, { host: 'GitHub Pages' }],
    [/\.gitlab\.io$/, { host: 'GitLab Pages' }],
    [/\.pages\.dev$/, { host: 'Cloudflare Pages' }],
    [/\.(web\.app|firebaseapp\.com)$/, { host: 'Firebase Hosting' }],
    [/\.amplifyapp\.com$/, { host: 'AWS Amplify' }],
    [/\.onrender\.com$/, { host: 'Render' }],
    [/\.(herokuapp|herokudns)\.com$/, { host: 'Heroku' }],
    [/\.(azurewebsites|azurestaticapps)\.net$/, { host: 'Azure App Service' }],
    [/(^|\.)myshopify\.com$/, { host: 'Shopify', closed: true }],
    [/\.squarespace\.com$/, { host: 'Squarespace', closed: true }],
    [/\.wixdns\.net$/, { host: 'Wix', closed: true }],
    [/\.webflow\.(com|io)$/, { host: 'Webflow', closed: true }],
    [/\.(hubspot\.net|hs-sites\.com|hubspotpagebuilder\.com)$/, { host: 'HubSpot CMS', closed: true }],
    [/\.(multiscreensite|dudaone)\.com$/, { host: 'Duda', closed: true }],
    [/\.godaddysites\.com$/, { host: 'GoDaddy Websites + Marketing', closed: true }],
    [/\.ghost\.io$/, { host: 'Ghost(Pro)' }],
    [/\.secureserver\.net$/, { host: 'GoDaddy hosting', guess: true }],
    [/\.cloudfront\.net$/, { cdn: 'Amazon CloudFront' }],
    [/\.(fastly|fastlylb)\.net$/, { cdn: 'Fastly' }],
    [/\.(edgekey\.net|edgesuite\.net|akamaiedge\.net|akamaized\.net)$/, { cdn: 'Akamai' }],
    [/\.cdn\.cloudflare\.net$/, { cdn: 'Cloudflare' }],
    [/\.b-cdn\.net$/, { cdn: 'bunny.net' }],
    [/\.(sucuri\.net|sucuridns\.com)$/, { cdn: 'Sucuri firewall' }],
    [/\.(azureedge|azurefd)\.net$/, { cdn: 'Azure Front Door' }],
  ];
  /* [pattern on an MX host, provider, {webBrand: mail that belongs to a web hosting company's account}] */
  const MX_HINTS = [
    [/(^|\.)(aspmx\.l\.google\.com|googlemail\.com|smtp\.google\.com)$/, 'Google Workspace'],
    [/\.(mail|olc)\.protection\.outlook\.com$/, 'Microsoft 365'],
    [/\.(pphosted|ppe-hosted)\.com$/, 'Proofpoint (a filter in front of the real mailboxes)'],
    [/\.mimecast\.com$/, 'Mimecast (a filter in front of the real mailboxes)'],
    [/\.barracudanetworks\.com$/, 'Barracuda (a filter in front of the real mailboxes)'],
    [/(^|\.)zoho\.(com|eu|in)$/, 'Zoho Mail'],
    [/\.emailsrvr\.com$/, 'Rackspace Email'],
    [/\.messagingengine\.com$/, 'Fastmail'],
    [/\.protonmail\.ch$/, 'Proton Mail'],
    [/\.mail\.icloud\.com$/, 'iCloud Mail'],
    [/\.titan\.email$/, 'Titan Email'],
    [/\.privateemail\.com$/, 'Namecheap Private Email'],
    [/\.registrar-servers\.com$/, 'Namecheap email forwarding'],
    [/\.improvmx\.com$/, 'ImprovMX forwarding'],
    [/\.mx\.cloudflare\.net$/, 'Cloudflare Email Routing (forwarding)'],
    [/\.hostedemail\.com$/, 'OpenSRS hosted email'],
    [/\.mailgun\.org$/, 'Mailgun (inbound routing)'],
    [/\.sendgrid\.net$/, 'SendGrid (inbound parse)'],
    [/\.secureserver\.net$/, 'GoDaddy email', { webBrand: 'GoDaddy' }],
    [/\.mailspamprotection\.com$|\.siteground\.net$/, 'SiteGround email', { webBrand: 'SiteGround' }],
    [/\.bluehost\.com$/, 'Bluehost email', { webBrand: 'Bluehost' }],
    [/\.(hostgator|websitewelcome)\.com$/, 'HostGator email', { webBrand: 'HostGator' }],
    [/\.dreamhost\.com$/, 'DreamHost email', { webBrand: 'DreamHost' }],
    [/\.inmotionhosting\.com$/, 'InMotion Hosting email', { webBrand: 'InMotion Hosting' }],
    [/\.(ionos\.com|kundenserver\.de|1and1\.com)$/, 'IONOS mail', { webBrand: 'IONOS' }],
    [/\.hostinger\.com$/, 'Hostinger email', { webBrand: 'Hostinger' }],
  ];
  /* published address ranges and documented apex addresses */
  const CF4 = ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'];
  const CF6 = /^(2606:4700|2400:cb00|2803:f800|2405:b500|2405:8100|2c0f:f248|2a06:98c[0-7]):/i;
  const ip4 = ip => { const m = String(ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/); return m ? (+m[1] * 16777216) + (+m[2] * 65536) + (+m[3] * 256) + (+m[4]) : -1; };
  const inCidr = (ip, cidr) => { const p = cidr.split('/'); const a = ip4(ip), b = ip4(p[0]); if (a < 0 || b < 0) return false; const size = Math.pow(2, 32 - (+p[1])); const lo = b - (b % size); return a >= lo && a < lo + size; };
  const isCf4 = ip => CF4.some(c => inCidr(ip, c));
  const IP_HINTS = [
    { test: isCf4, cdn: 'Cloudflare' },
    { test: ip => inCidr(ip, '151.101.0.0/16'), cdn: 'Fastly' },
    { test: ip => /^185\.199\.1(08|09|10|11)\.153$/.test(ip), host: 'GitHub Pages' },
    { test: ip => ip === '76.76.21.21', host: 'Vercel' },
    { test: ip => ip === '75.2.60.5', host: 'Netlify' },
    { test: ip => ip === '75.2.70.75', host: 'Webflow', closed: true },
    { test: ip => ip === '99.83.190.102', host: 'Netlify or Webflow (both document this address)', guess: true },
    { test: ip => ['198.185.159.144', '198.185.159.145', '198.49.23.144', '198.49.23.145'].includes(ip), host: 'Squarespace', closed: true },
    { test: ip => /^23\.227\.38\.(6[5-9]|7[0-4])$/.test(ip), host: 'Shopify', closed: true },
    { test: ip => inCidr(ip, '192.0.64.0/18'), host: 'WordPress.com (Automattic)' },
    { test: ip => /^23\.185\.0\.[1-4]$/.test(ip), host: 'Pantheon' },
    { test: ip => /^185\.230\.6[0-3]\./.test(ip), host: 'Wix', closed: true, guess: true },
  ];
  const VERIFY_TXT = [[/^google-site-verification=/i, 'Google (Search Console, Workspace)'], [/^MS=ms/i, 'Microsoft 365'], [/^facebook-domain-verification=/i, 'Meta'], [/^apple-domain-verification=/i, 'Apple'], [/^atlassian-domain-verification=/i, 'Atlassian'], [/^stripe-verification=/i, 'Stripe'], [/^docusign=/i, 'DocuSign'], [/^zoom-domain-verification=/i, 'Zoom'], [/^adobe-idp-site-verification=/i, 'Adobe'], [/^pinterest-site-verification=/i, 'Pinterest'], [/^klaviyo-site-verification=/i, 'Klaviyo'], [/^hubspot-developer-verification=/i, 'HubSpot'], [/^brevo-code:/i, 'Brevo'], [/^_globalsign-domain-verification=|^globalsign-domain-verification=/i, 'GlobalSign'], [/verif/i, 'a service that checks domain ownership']];
  const hours = s => s >= 7200 ? `${Math.round(s / 3600)} hours` : s >= 3600 ? 'one hour' : s >= 120 ? `${Math.round(s / 60)} minutes` : `${s} seconds`;

  /* interpret(records | lookup result) → what the records say, and what in them can hurt during a move */
  function interpret(input) {
    const R = (input && input.records) ? input.records : (input || {});
    const A = R.apex || {}, W = R.www || {}, Z = R.zone || null; const apex = A.name || '';
    const list = (box, t) => (box && box[t]) || [];
    const own = t => (list(A, t).length ? list(A, t) : list(Z, t));
    const risks = [], riskIds = [], notes = []; const risk = (id, text) => { riskIds.push(id); risks.push(text); };
    if (A.status === 'nxdomain') risk('nxdomain', `${apex} does not exist in DNS (NXDOMAIN): check the spelling, or the domain has expired or was never registered.`);

    /* nameservers and who runs them */
    const nameservers = uniq(own('NS').map(r => r.data)).sort();
    let dnsProvider = null, registrarHint = null, dnsAtWebHost = false;
    for (const [re, name, o] of NS_HINTS) { if (!nameservers.some(n => re.test(n))) continue; dnsProvider = (o && o.guess ? 'likely ' : '') + name; dnsAtWebHost = !!(o && o.web); if (o && o.reg) registrarHint = `likely ${o.reg}: the nameservers are that registrar's own. Confirm with a WHOIS or RDAP lookup.`; break; }
    if (!nameservers.length) notes.push(apex ? `No NS records came back for ${apex}${Z ? '' : '; if it is a subdomain, its zone holds them'}.` : 'No NS records came back.');
    else if (!dnsProvider) notes.push('The nameservers match no provider this atlas knows by name: read the DNS panel\'s login page to see who runs them.');
    if (!registrarHint && nameservers.length) notes.push('The registrar does not show in DNS: a WHOIS or RDAP lookup names it.');
    if (dnsAtWebHost) risk('dns-at-web-host', `DNS is hosted with a web hosting account at ${dnsProvider}. Closing that account takes the DNS zone offline, and email routing with it: move the zone to the registrar or to a DNS provider before canceling.`);

    /* the web address */
    const ips = uniq(list(A, 'A').map(r => r.data)), ipv6 = uniq(list(A, 'AAAA').map(r => r.data));
    const wwwIps = uniq(list(W, 'A').map(r => r.data)), wwwIpv6 = uniq(list(W, 'AAAA').map(r => r.data));
    const wwwCn = (list(W, 'CNAME').find(c => c.name === W.name) || list(W, 'CNAME')[0] || {}).data || '';
    const apexCn = (list(A, 'CNAME').find(c => c.name === A.name) || list(A, 'CNAME')[0] || {}).data || '';
    const hits = [];
    for (const t of uniq(list(W, 'CNAME').concat(list(A, 'CNAME')).map(c => c.data))) for (const [re, o] of CNAME_HINTS) if (re.test(t)) hits.push(Object.assign({ via: `the name points at ${t}` }, o));
    for (const ip of uniq(ips.concat(wwwIps))) for (const h of IP_HINTS) if (h.test(ip)) hits.push({ host: h.host, cdn: h.cdn, closed: h.closed, guess: h.guess, via: `the address ${ip}` });
    for (const ip of uniq(ipv6.concat(wwwIpv6))) if (CF6.test(ip)) hits.push({ cdn: 'Cloudflare', via: `the address ${ip}` });
    const hHost = hits.find(h => h.host), hCdn = hits.find(h => h.cdn);
    const cdn = hCdn ? hCdn.cdn : null;
    /* Cloudflare addresses with Cloudflare nameservers: the owner's own Cloudflare zone, and the cutover happens inside it.
       Cloudflare addresses under someone else's nameservers: a host that fronts its sites with Cloudflare, and an ordinary record change. */
    const cfIps = ips.length > 0 && ips.every(isCf4), cfDns = /Cloudflare/.test(dnsProvider || '');
    const proxied = cfIps && cfDns, fronted = cfIps && !cfDns;
    const hostGuess = hHost ? `${hHost.guess ? 'likely ' : ''}${hHost.host} (${hHost.via})` : fronted ? 'likely a managed host that fronts its sites with Cloudflare (the address is Cloudflare\'s, the nameservers are not)' : cdn ? `hidden behind ${cdn}: the origin server does not show in public DNS` : null;
    if (fronted) notes.push('The web address belongs to Cloudflare while the nameservers do not: the current host most likely serves its sites through Cloudflare, as several managed hosts do. The cutover is then an ordinary record change at the DNS provider.');
    const wwwFollowsApex = !!(wwwCn && wwwCn === apex) || (wwwIps.length > 0 && wwwIps.slice().sort().join() === ips.slice().sort().join());
    if (A.status !== 'nxdomain') {
      if (!ips.length && !apexCn) notes.push(`${apex || 'The bare domain'} has no A record: only the www name (or nothing) serves the site.`);
      if (!wwwIps.length && !wwwCn) notes.push(`www.${apex} does not resolve: a visitor who types www gets an error.`);
      else if ((ips.length || apexCn) && !wwwFollowsApex && !proxied) risk('www-apart', `www.${apex} and ${apex} are separate records (${wwwCn || wwwIps.join(', ')} against ${apexCn || ips.join(', ')}): both have to change at cutover, and one of them should redirect to the other.`);
    }
    if (proxied) risk('proxied', 'The site is proxied through Cloudflare. The cutover is an edit of the origin address inside Cloudflare, not a public DNS change; the origin server stays hidden, so its current address has to be read in the Cloudflare panel, and the new origin needs a certificate Cloudflare accepts (SSL mode Full, strict).');
    const realV6 = uniq(ipv6.concat(wwwIpv6)).filter(ip => !(proxied && CF6.test(ip)));      /* behind the proxy Cloudflare answers with its own IPv6 addresses: nothing to edit */
    if (realV6.length) risk('ipv6', 'IPv6 (AAAA) records exist. If the new host gives no IPv6 address, delete them at cutover: a stale AAAA keeps sending IPv6 visitors to the old server.');
    if (hHost && hHost.closed) risk('closed', `${hHost.host} is a closed platform: a site cannot be copied out of it. Moving away means rebuilding the pages on the new host and redirecting every old URL.`);

    /* mail */
    const mx = own('MX').slice().sort((a, b) => a.priority - b.priority).map(m => ({ priority: m.priority, host: m.host, ttl: m.ttl }));
    const scope = Z ? Z.name : apex; const webAll = uniq(ips.concat(wwwIps));
    const nullMx = mx.length === 1 && !mx[0].host;
    let provider = null, tiedToHostingBrand = null, sharesWebHost = false, sharesWebHostWhy = '', mxFollowsWeb = false;
    if (nullMx) provider = 'none (a null MX: the domain says it accepts no mail)';
    for (const m of (nullMx ? [] : mx)) {
      const hint = MX_HINTS.find(([re]) => re.test(m.host));
      if (hint && !provider) { provider = hint[1]; if (hint[2] && hint[2].webBrand) tiedToHostingBrand = hint[2].webBrand; }
      const inDomain = m.host === scope || m.host.endsWith('.' + scope) || m.host === apex || m.host.endsWith('.' + apex);
      if (!inDomain || sharesWebHost) continue;
      const mips = (R.mxHosts || {})[m.host];
      if (m.host === apex || m.host === 'www.' + apex) { sharesWebHost = true; mxFollowsWeb = true; sharesWebHostWhy = `the MX record names ${m.host} itself, so mail goes wherever the site's A record points`; }
      else if (mips && mips.some(ip => webAll.includes(ip))) { sharesWebHost = true; sharesWebHostWhy = `${m.host} resolves to the web server's own address ${mips.find(ip => webAll.includes(ip))}`; }
      else if (mips && mips.length && !proxied) { if (!provider) provider = `a mail server at ${m.host} (${mips.join(', ')}), separate from the web address`; }
      else { sharesWebHost = true; sharesWebHostWhy = proxied ? `${m.host} is a name inside this domain while the site is proxied: it most likely points at the origin server (likely)` : `${m.host} is a name inside this domain, which usually means the web host's own mail server (likely; its address did not come back)`; }
    }
    if (sharesWebHost && !provider) provider = 'the web host\'s own mail server';
    if (!provider && mx.length) provider = 'unrecognized: ' + mx[0].host;
    const allTxt = own('TXT').map(r => r.data);
    const spfAll = allTxt.filter(t => /^v=spf1(\s|$)/i.test(t)); const spf = spfAll.length ? spfAll[0] : null;
    const mech = spf ? spf.split(/\s+/).slice(1) : [];
    const spfIncludes = mech.filter(m => /^[+~?-]?include:/i.test(m)).map(m => m.replace(/^[+~?-]?include:/i, ''));
    const spfIps = mech.filter(m => /^[+~?-]?ip4:/i.test(m)).map(m => m.replace(/^[+~?-]?ip4:/i, '').replace(/\/\d+$/, ''));
    const spfUsesWebServer = !!spf && (mech.some(m => /^[+~?-]?a([:/]|$)/i.test(m)) || spfIps.some(ip => webAll.includes(ip)) || (sharesWebHost && mech.some(m => /^[+~?-]?mx([:/]|$)/i.test(m))));
    const dmarc = ((R.dmarc && R.dmarc.length ? R.dmarc : (Z && Z.dmarc) || []).map(r => r.data).find(d => /^v=DMARC1/i.test(d))) || null;
    const dmarcPolicy = dmarc ? (lc((dmarc.match(/(?:^|;)\s*p\s*=\s*([a-z]+)/i) || [])[1]) || null) : null;
    if (sharesWebHost) risk('mail-on-host', `Mail for this domain is delivered to the web host (${sharesWebHostWhy}). It moves or dies with the hosting account: decide where the mailboxes live before any DNS change.`);
    else if (tiedToHostingBrand) risk('mail-host-brand', `Mail is handled by ${provider}, a web hosting company's mail service. If the website's hosting account is with ${tiedToHostingBrand} too, the mailboxes are part of that account: confirm before canceling anything.`);
    if (mx.length && !nullMx) {
      if (!spf) risk('no-spf', 'No SPF record: receiving servers cannot tell which servers may send mail for this domain. The move does not cause this, but fix it while the DNS panel is open.');
      else if (spfAll.length > 1) risk('multi-spf', `${spfAll.length} SPF records exist. More than one makes SPF fail for every message: merge them into one.`);
      if (spf && spfUsesWebServer) risk('spf-web', 'SPF authorizes the current web server (through a, mx or its ip4 address). After the move, mail the website sends from the new server (form notifications, password resets) fails SPF unless the record names the new server or the site sends through an SMTP service.');
      if (!dmarc) risk('no-dmarc', 'No DMARC record: nothing tells receivers what to do with mail that fails SPF and DKIM, and nobody gets the reports. Add at least v=DMARC1; p=none with a reporting address.');
      else if (dmarcPolicy === 'none') notes.push('DMARC is in monitoring mode (p=none): reports arrive, nothing is rejected.');
    } else if (!mx.length && A.status !== 'nxdomain') notes.push('No MX records: this domain receives no mail (or mail is broken already).');
    const verification = allTxt.map(t => { const v = VERIFY_TXT.find(([re]) => re.test(t)); return v && !/^v=(spf1|DMARC1)/i.test(t) ? { service: v[1], data: t } : null; }).filter(Boolean);
    if (verification.length) notes.push(`${verification.length} ownership verification record${verification.length === 1 ? '' : 's'} (${uniq(verification.map(v => v.service)).join(', ')}): they must survive any DNS change.`);

    /* certificates and signing */
    const caa = own('CAA').map(r => ({ tag: r.tag, value: r.value }));
    const issuers = uniq(caa.filter(c => c.tag === 'issue' || c.tag === 'issuewild').map(c => c.value.replace(/;.*$/, '').trim()).filter(Boolean));
    if (caa.length) risk('caa', `CAA records allow only ${issuers.length ? issuers.join(', ') : 'no certificate authority at all'} to issue certificates for this domain. Confirm the new host's certificate authority is on that list, or its SSL certificate will not issue.`);
    const dnssec = R.dnssec === true;
    if (dnssec) risk('dnssec', 'DNSSEC is on (the answers validate). A nameserver change needs the DS record at the registrar removed or replaced first, or the domain stops resolving for everyone.');

    /* how long the old answer lingers */
    const ttls = [].concat(list(A, 'A'), list(A, 'AAAA'), list(A, 'CNAME'), list(W, 'A'), list(W, 'AAAA'), list(W, 'CNAME')).map(r => r.ttl).filter(t => t > 0);
    const lowestTtl = ttls.length ? Math.min.apply(null, ttls) : null, highestTtl = ttls.length ? Math.max.apply(null, ttls) : null;
    if (highestTtl != null && highestTtl > 3600 && !proxied) risk('ttl', `The web records carry a TTL of up to ${highestTtl} seconds (${hours(highestTtl)}): after a change, visitors keep the old address that long. Lower it to 300 seconds at least ${hours(highestTtl)} before the cutover; 24 to 48 hours ahead is the safe habit.`);
    if (ttls.length) notes.push(proxied ? 'Cloudflare proxied records always answer with a TTL of 300 seconds, whatever the panel says.' : 'A public resolver reports the time left in its cache, so the configured TTL is at least the number shown here: read the exact value in the DNS panel.');

    return { domain: apex, zone: Z ? Z.name : apex, dnsProvider, dnsAtWebHost, nameservers, registrarHint, dnssec,
      web: { ips, ipv6, ownIpv6: realV6.length > 0, wwwIps, cname: wwwCn || apexCn || null, wwwFollowsApex, cdn, proxied, hostGuess, closedPlatform: !!(hHost && hHost.closed) },
      email: { provider, mx, spf, spfIncludes, spfUsesWebServer, dmarc, dmarcPolicy, sharesWebHost, sharesWebHostWhy, mxFollowsWeb, tiedToHostingBrand },
      caa, caaIssuers: issuers, verification, lowestTtl, highestTtl, risks, riskIds, notes };
  }

  /* ============================ the stack a page gives away ============================ */
  /* Managed hosts and platforms, with the signals that identify them and what to confirm before moving to or from one.
     Notes say what to ask, never what a host currently offers or charges. on: header (key, re), cname, ns, mx, url. */
  const HOSTS = {
    wpengine: { name: 'WP Engine', kind: 'managed-wordpress', signals: [{ on: 'header', key: 'x-powered-by', re: /wp ?engine/i }, { on: 'header', key: 'wpe-backend', re: /./ }, { on: 'cname', re: /\.(wpengine|wpenginepowered|wpeproxy)\.com$/ }, { on: 'url', re: /\.(wpengine|wpenginepowered)\.com$/ }], notes: 'A managed WordPress host. Confirm with it: how redirects are set (rules in .htaccess may not apply on its web tier), which plugins it does not allow (caching and backup plugins are the usual ones on managed hosts), how a copy is previewed before DNS points at it, how the domain and certificate are attached, and whether its own migration plugin or service fits this site.' },
    kinsta: { name: 'Kinsta', kind: 'managed-wordpress', signals: [{ on: 'header', key: 'x-kinsta-cache', re: /./ }, { on: 'header', key: 'ki-cache-type', re: /./ }, { on: 'cname', re: /\.kinsta\.(cloud|com)$/ }, { on: 'url', re: /\.kinsta\.cloud$/ }], notes: 'A managed WordPress host. Confirm with it: which web server answers (Nginx does not read .htaccess, so redirects then go in the host\'s own tool), whether a CDN or proxy sits in front of every site and what that means for the certificate, which plugins are not allowed, how the domain is verified and pointed, and where mail is expected to live.' },
    flywheel: { name: 'Flywheel', kind: 'managed-wordpress', signals: [{ on: 'header', key: 'x-fw-hash', re: /./ }, { on: 'header', key: 'x-fw-serve', re: /./ }, { on: 'header', key: 'server', re: /^flywheel/i }, { on: 'cname', re: /\.(flywheelsites|flywheelstaging)\.com$/ }], notes: 'A managed WordPress host. Confirm with it: how redirects are set, which plugins are not allowed, how a site is previewed before DNS moves, how the domain and certificate are attached, and where mail for the domain is expected to live.' },
    pantheon: { name: 'Pantheon', kind: 'managed-wordpress', signals: [{ on: 'header', key: 'x-pantheon-styx-hostname', re: /./ }, { on: 'header', key: 'x-styx-req-id', re: /./ }, { on: 'cname', re: /\.(pantheonsite\.io|edge\.pantheon\.io)$/ }], notes: 'A managed platform with its own deployment workflow. Confirm with it: how code, files and the database are each loaded and promoted between environments, where redirects are written, and how the domain and certificate are attached before cutover.' },
    siteground: { name: 'SiteGround', kind: 'shared', signals: [{ on: 'header', key: 'host-header', re: /^8441280b0c35cbc1147f8ba998a563a7$/ }, { on: 'cname', re: /\.sg-host\.com$/ }, { on: 'ns', re: /\.siteground\.net$/ }, { on: 'mx', re: /\.(mailspamprotection\.com|siteground\.net)$/ }], notes: 'Hosting that commonly bundles DNS and mailboxes with the site. Leaving it: check whether DNS and mail live in the same account before canceling. Arriving: confirm the temporary URL for testing, the caching layer, and how its migration tool handles a site of this size.' },
    bluehost: { name: 'Bluehost', kind: 'shared', signals: [{ on: 'header', key: 'host-header', re: /^c2hhcmVkLmJsdWVob3N0LmNvbQ==$/ }, { on: 'ns', re: /\.bluehost\.com$/ }, { on: 'mx', re: /\.bluehost\.com$/ }], notes: 'Shared hosting that commonly bundles the domain registration, DNS and mailboxes with the site. Leaving it: find out which of the three live in the account, because each one is a separate move, and the domain itself may need a registrar transfer or just new nameservers.' },
    hostgator: { name: 'HostGator', kind: 'shared', signals: [{ on: 'ns', re: /\.hostgator\.com$/ }, { on: 'mx', re: /\.(hostgator|websitewelcome)\.com$/ }], notes: 'Shared hosting that commonly bundles DNS and mailboxes with the site. Leaving it: confirm where mail and DNS live before canceling, and export the full zone.' },
    godaddy: { name: 'GoDaddy', kind: 'shared', signals: [{ on: 'ns', re: /\.domaincontrol\.com$/ }, { on: 'mx', re: /\.secureserver\.net$/ }, { on: 'cname', re: /\.(secureserver\.net|godaddysites\.com)$/ }], notes: 'Often the registrar and the DNS host even when the site lives elsewhere. Its nameservers showing up says where DNS is edited, not where the site is hosted. Mail bought there is a separate product from web hosting: confirm which products the account holds.' },
    hostinger: { name: 'Hostinger', kind: 'shared', signals: [{ on: 'header', key: 'platform', re: /^hostinger$/i }, { on: 'ns', re: /\.(dns-parking\.com|hostinger\.com)$/ }], notes: 'Hosting that commonly bundles DNS and mailboxes. Confirm where mail and DNS live before canceling; on arrival confirm the temporary domain for testing and the web server in use.' },
    dreamhost: { name: 'DreamHost', kind: 'shared', signals: [{ on: 'ns', re: /\.dreamhost\.com$/ }, { on: 'mx', re: /\.dreamhost\.com$/ }], notes: 'Hosting that commonly bundles DNS and mailboxes. Confirm where mail and DNS live before canceling, and export the full zone.' },
    cloudways: { name: 'Cloudways', kind: 'managed-cloud', signals: [{ on: 'cname', re: /\.cloudwaysapps\.com$/ }, { on: 'url', re: /\.cloudwaysapps\.com$/ }], notes: 'Managed cloud servers. Confirm with it: whether mailboxes are part of the service or a separate add on, how the site sends mail, and which web server stack answers, since that decides whether .htaccess rules apply.' },
    wpcom: { name: 'WordPress.com or WordPress VIP (Automattic)', aliases: ['WordPress.com', 'WordPress VIP', 'WPVIP'], kind: 'managed-wordpress', signals: [{ on: 'header', key: 'x-ac', re: /./ }, { on: 'header', key: 'host-header', re: /wordpress\.com/i }, { on: 'header', key: 'x-powered-by', re: /wordpress vip/i }, { on: 'ns', re: /\.wordpress\.com$/ }, { on: 'cname', re: /\.wordpress\.com$/ }], notes: 'Hosted WordPress. What can be exported depends on the plan: confirm whether plugins, themes and the database can be taken out, or only a content export. A content export is a rebuild, not a copy.' },
    netlify: { name: 'Netlify', kind: 'static', signals: [{ on: 'header', key: 'server', re: /^netlify/i }, { on: 'header', key: 'x-nf-request-id', re: /./ }, { on: 'cname', re: /\.netlify\.(app|com)$/ }], notes: 'Static hosting with host side features. Whatever the site uses of the host\'s own redirects, form handling, functions, environment variables and build settings does not move with the files: list each one in use and name its replacement on the new host.' },
    vercel: { name: 'Vercel', kind: 'static', signals: [{ on: 'header', key: 'server', re: /^vercel/i }, { on: 'header', key: 'x-vercel-id', re: /./ }, { on: 'cname', re: /(^|\.)vercel-dns\.com$|\.vercel\.app$/ }], notes: 'Hosting for static and server rendered front ends, with host side features. Whatever the site uses of the host\'s own redirect config, functions and environment variables does not move with the files: list each one in use and name its replacement on the new host.' },
    githubpages: { name: 'GitHub Pages', aliases: ['GitHub Pages', 'gh-pages'], kind: 'static', signals: [{ on: 'header', key: 'server', re: /^github\.com/i }, { on: 'header', key: 'x-github-request-id', re: /./ }, { on: 'cname', re: /\.github\.io$/ }], notes: 'Static files served from a repository. Check what the site relies on for redirects, headers and forms: whatever the host does not do lives in the pages themselves or in a third party service, and moves unchanged.' },
    cloudflarepages: { name: 'Cloudflare Pages', aliases: ['Cloudflare Pages', 'pages.dev'], kind: 'static', signals: [{ on: 'cname', re: /\.pages\.dev$/ }, { on: 'url', re: /\.pages\.dev$/ }], notes: 'Static hosting inside Cloudflare, with host side features. Whatever the site uses of the host\'s own redirects, headers and functions does not move with the files: list each one in use and name its replacement on the new host.' },
    shopify: { name: 'Shopify', kind: 'closed', closed: true, signals: [{ on: 'header', key: 'x-shopid', re: /./ }, { on: 'header', key: 'powered-by', re: /shopify/i }, { on: 'cname', re: /(^|\.)myshopify\.com$/ }], notes: 'A closed platform: the storefront does not run anywhere else. Confirm what exports as data (products, customers and orders usually do). Leaving it is a rebuild, with a redirect for every old URL.' },
    squarespace: { name: 'Squarespace', kind: 'closed', closed: true, signals: [{ on: 'header', key: 'server', re: /^squarespace/i }, { on: 'cname', re: /\.squarespace\.com$/ }], notes: 'A closed platform: the design and the forms do not run anywhere else. Confirm what its export covers. Leaving it is a rebuild, with a redirect for every old URL.' },
    wix: { name: 'Wix', kind: 'closed', closed: true, signals: [{ on: 'header', key: 'x-wix-request-id', re: /./ }, { on: 'header', key: 'server', re: /^pepyaka/i }, { on: 'cname', re: /\.wixdns\.net$/ }, { on: 'ns', re: /\.wixdns\.net$/ }], notes: 'A closed platform: the site does not run anywhere else. Confirm what, if anything, exports. Leaving it is a rebuild with a redirect for every old URL, and if the domain was bought through it, a domain transfer as well.' },
    webflow: { name: 'Webflow', kind: 'closed', closed: true, signals: [{ on: 'cname', re: /\.webflow\.(com|io)$/ }], notes: 'A closed platform for anything dynamic. Confirm what the current plan exports (static markup at most): collections, forms and search depend on the platform. Leaving it is mostly a rebuild, with a redirect for every old URL.' },
    hubspot: { name: 'HubSpot CMS', aliases: ['HubSpot'], kind: 'closed', closed: true, signals: [{ on: 'header', key: 'x-hs-hub-id', re: /./ }, { on: 'cname', re: /\.(hubspot\.net|hs-sites\.com|hubspotpagebuilder\.com)$/ }], notes: 'A closed platform: pages and templates do not run anywhere else. Leaving it is a rebuild with a redirect for every old URL, and forms and tracking tied to the CRM need a replacement or an embed.' },
  };
  /* a host named in plain words ("WP Engine", "moving to Kinsta hosting") → its entry; only a full name counts, never a fragment */
  const squash = s => lc(s).replace(/[^a-z0-9]+/g, '');
  const hostByName = name => { const n = squash(name); if (n.length < 3) return null; for (const id of Object.keys(HOSTS)) { const keys = [id, squash(HOSTS[id].name)].concat((HOSTS[id].aliases || []).map(squash)); if (keys.some(k => k === n || (k.length >= 3 && n.includes(k)))) return Object.assign({ id }, HOSTS[id]); } return null; };
  const lowerKeys = h => { const o = {}; if (h && typeof h.forEach === 'function' && typeof h.get === 'function') h.forEach((v, k) => { o[lc(k)] = String(v); }); else for (const k of Object.keys(h || {})) o[lc(k)] = String(h[k]); return o; };
  const STATIC_GEN = [[/^Hugo\s*([\d.]+)?/i, 'Hugo'], [/^Jekyll\s*v?([\d.]+)?/i, 'Jekyll'], [/^Gatsby\s*([\d.]+)?/i, 'Gatsby'], [/^(?:Eleventy|11ty)\s*v?([\d.]+)?/i, 'Eleventy'], [/^Astro\s*v?([\d.]+)?/i, 'Astro'], [/^Docusaurus\s*v?([\d.]+)?/i, 'Docusaurus'], [/^Hexo\s*([\d.]+)?/i, 'Hexo'], [/^Pelican/i, 'Pelican'], [/^VitePress\s*v?([\d.]+)?/i, 'VitePress']];
  const BUILDERS = [
    ['Elementor', /elementor-kit-\d+|\/wp-content\/plugins\/elementor\/|class="[^"]*\belementor-(section|container|widget|element)\b/i],
    ['Divi', /\bet_pb_(section|row|module)\b|\/wp-content\/themes\/Divi\//i],
    ['WPBakery', /\bvc_row\b|\/js_composer\//i],
    ['Beaver Builder', /\bfl-builder(-content)?\b|\/bb-plugin\//i],
    ['Bricks', /\bbrxe-[a-z]+|\/wp-content\/themes\/bricks\//i],
    ['Oxygen', /\bct-section\b|\/wp-content\/plugins\/oxygen\//i],
    ['Avada (Fusion Builder)', /\bfusion-(builder-row|fullwidth|layout-column)\b/i],
    ['Breakdance', /\/wp-content\/plugins\/breakdance\/|\bbde-section\b/i],
    ['Brizy', /\bbrz-(root|section)\b/i],
    ['Thrive Architect', /\btve_(flt|editor)|\bthrv_wrapper\b/i],
    ['Block editor (Gutenberg)', /\bwp-block-[a-z]/i],
  ];
  const CLOSED_HTML = [
    ['Shopify', /cdn\.shopify\.com|Shopify\.theme\b/i], ['Wix', /static\.wixstatic\.com|static\.parastorage\.com/i], ['Squarespace', /static1\.squarespace\.com|squarespace-cdn\.com|SQUARESPACE_CONTEXT/i],
    ['Webflow', /\bdata-wf-site=|website-files\.com/i], ['Duda', /irp\.cdn-website\.com|multiscreensite\.com/i], ['HubSpot CMS', /\bhs_cos_wrapper\b/i], ['Weebly', /editmysite\.com/i], ['GoDaddy Websites + Marketing', /img1\.wsimg\.com\/isteam/i],
  ];
  const OPEN_HTML = [
    ['Drupal', /\/sites\/(default|all)\/(files|themes|modules)\/|\bdata-drupal-[a-z]/i], ['Joomla', /\/media\/(jui|system)\/js\/|\/components\/com_[a-z]+/i], ['Ghost', /\/ghost\/api\/|ghost-(sdk|portal)/i],
  ];
  const APP_HTML = [['Next.js', /\/_next\/static\//], ['Nuxt', /\/_nuxt\//], ['Gatsby', /id="___gatsby"/]];
  const PLUGIN_MARKS = [
    [/This site is optimized with the Yoast SEO (?:Premium )?plugin v?([\d.]+)?/i, 'wordpress-seo', 'Yoast SEO'], [/Search Engine Optimization by Rank Math/i, 'seo-by-rank-math', 'Rank Math'], [/All in One SEO( Pro)? ([\d.]+)?/i, 'all-in-one-seo-pack', 'All in One SEO'],
    [/Performance optimized by WP Rocket|This website is like a Rocket|\bdata-rocket-|wpr-usedcss|\/cache\/wp-rocket\//i, 'wp-rocket', 'WP Rocket', 'cache'], [/Page (?:generated|cached|supported) by LiteSpeed Cache/i, 'litespeed-cache', 'LiteSpeed Cache', 'cache'],
    [/Performance optimized by W3 Total Cache/i, 'w3-total-cache', 'W3 Total Cache', 'cache'], [/WP-?Super-?Cache|Dynamic page generated in [\d.]+ seconds/i, 'wp-super-cache', 'WP Super Cache', 'cache'], [/WP Fastest Cache file was created/i, 'wp-fastest-cache', 'WP Fastest Cache', 'cache'],
    [/\/wp-content\/cache\/autoptimize\/|autoptimize_/i, 'autoptimize', 'Autoptimize', 'cache'], [/siteground-optimizer/i, 'sg-cachepress', 'SiteGround Optimizer', 'cache'], [/nitropack|nitro-cache/i, 'nitropack', 'NitroPack', 'cache'], [/\/wp-content\/cache\/min\//i, 'minify-cache', 'a minify cache', 'cache'],
    [/\bwoocommerce(-page|-no-js|-js)?\b|\bwc-block/i, 'woocommerce', 'WooCommerce'], [/\bgform_wrapper\b|gform_fields/i, 'gravityforms', 'Gravity Forms'], [/\bwpforms-(form|container)\b/i, 'wpforms', 'WPForms'], [/\bwpcf7(-form)?\b/i, 'contact-form-7', 'Contact Form 7'], [/\belementor-form\b/i, 'elementor-pro', 'Elementor Pro forms'], [/\bfluentform\b/i, 'fluentform', 'Fluent Forms'], [/\bfrm_forms\b/i, 'formidable', 'Formidable Forms'],
  ];
  /* fingerprint({url, status, headers, html}) → what the page and its response headers say about the stack */
  function fingerprint(o) {
    o = o || {}; const H = lowerKeys(o.headers), html = String(o.html || ''), url = String(o.url || '');
    const signals = []; const sig = (what, evidence) => { signals.push({ what, evidence: norm(evidence).slice(0, 180) }); };
    const hv = k => H[k] || '';
    const gens = []; { const re = /<meta\b[^>]*>/gi; let m; while ((m = re.exec(html))) { const t = m[0]; if (!/name\s*=\s*["']?generator/i.test(t)) continue; const c = t.match(/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i); if (c) gens.push(c[1] != null ? c[1] : c[2]); } }
    let cms = null, cmsVersion = null, kind = 'unknown', confidence = 'low';

    /* WordPress: any two of these is certain */
    const wp = [];
    if (/\/wp-content\//i.test(html)) wp.push('/wp-content/ paths in the markup');
    if (/\/wp-includes\//i.test(html)) wp.push('/wp-includes/ paths in the markup');
    const gWp = gens.find(g => /^WordPress/i.test(g)); if (gWp) wp.push('generator meta: ' + gWp);
    if (/api\.w\.org/i.test(hv('link')) || /rel=["']https:\/\/api\.w\.org\/["']/i.test(html)) wp.push('the REST API discovery link (api.w.org)');
    if (hv('x-pingback')) wp.push('an X-Pingback header');
    if (wp.length) { cms = 'WordPress'; kind = 'wordpress'; confidence = wp.length >= 2 ? 'high' : 'medium'; cmsVersion = gWp ? ((gWp.match(/[\d.]+/) || [])[0] || null) : null; wp.forEach(w => sig('WordPress', w)); }
    if (!cms) for (const [name, re] of CLOSED_HTML) { const m = html.match(re); const g = gens.find(x => lc(x).includes(lc(name.split(' ')[0]))); if (m || g) { cms = name; kind = 'hosted-builder'; confidence = m && g ? 'high' : 'medium'; sig(name, g ? 'generator meta: ' + g : m[0]); break; } }
    if (!cms) for (const [name, re] of OPEN_HTML) { const m = html.match(re); const g = gens.find(x => new RegExp('^' + name, 'i').test(x)); if (m || g) { cms = name; kind = 'cms'; confidence = m && g ? 'high' : 'medium'; cmsVersion = g ? ((g.match(/[\d.]+/) || [])[0] || null) : null; sig(name, g ? 'generator meta: ' + g : m[0]); break; } }
    if (!cms && (hv('x-drupal-cache') || hv('x-drupal-dynamic-cache') || /drupal/i.test(hv('x-generator')))) { cms = 'Drupal'; kind = 'cms'; confidence = 'medium'; cmsVersion = (hv('x-generator').match(/Drupal\s+([\d.]+)/i) || [])[1] || null; sig('Drupal', ['x-generator', 'x-drupal-cache', 'x-drupal-dynamic-cache'].filter(k => hv(k)).map(k => `${k}: ${hv(k)}`).join('; ')); }
    if (!cms) for (const [re, name] of STATIC_GEN) { const g = gens.find(x => re.test(x)); if (g) { cms = name + ' (static site generator)'; kind = 'static'; confidence = 'medium'; cmsVersion = (g.match(re) || [])[1] || null; sig(name, 'generator meta: ' + g); break; } }
    if (!cms) for (const [name, re] of APP_HTML) { const m = html.match(re); if (m) { cms = name; kind = 'app'; confidence = 'medium'; sig(name, m[0]); break; } }
    if (!cms && /next\.js/i.test(hv('x-powered-by'))) { cms = 'Next.js'; kind = 'app'; confidence = 'medium'; sig('Next.js', 'x-powered-by: ' + hv('x-powered-by')); }

    /* inside WordPress: the builder, the theme, the plugins that leave a trace */
    let builder = null, builderVersion = null, theme = null; const builders = [], plugins = [], cacheBits = [];
    if (kind === 'wordpress') {
      for (const [name, re] of BUILDERS) { const m = html.match(re); if (m) { builders.push(name); sig('Page builder: ' + name, m[0]); } }
      const gEl = gens.find(g => /^Elementor\s/i.test(g)); if (gEl) { if (!builders.includes('Elementor')) builders.unshift('Elementor'); builderVersion = (gEl.match(/Elementor\s+([\d.]+)/i) || [])[1] || null; sig('Page builder: Elementor', 'generator meta: ' + gEl); }
      const real = builders.filter(b => !/Gutenberg/.test(b)); builder = real[0] || builders[0] || null;
      if (builder === 'Elementor' && /\/wp-content\/plugins\/elementor-pro\//i.test(html)) sig('Elementor Pro', '/wp-content/plugins/elementor-pro/ assets');
      const tcount = {}; { const re = /\/wp-content\/themes\/([a-z0-9._-]+)\//gi; let m; while ((m = re.exec(html))) tcount[m[1]] = (tcount[m[1]] || 0) + 1; }
      const themes = Object.keys(tcount).sort((a, b) => tcount[b] - tcount[a]); theme = themes[0] || null; if (theme) sig('Theme', themes.join(', '));
      { const re = /\/wp-content\/plugins\/([a-z0-9._-]+)\//gi; let m; while ((m = re.exec(html))) if (!plugins.includes(lc(m[1]))) plugins.push(lc(m[1])); }
      for (const [re, slug, label, isCache] of PLUGIN_MARKS) { const m = html.match(re); if (!m) continue; if (!plugins.includes(slug) && slug !== 'minify-cache') plugins.push(slug); if (isCache) cacheBits.push(label + ' (a caching plugin)'); }
      plugins.sort(); if (plugins.length > 40) plugins.length = 40;
    }

    /* the server side: software, PHP, CDN, managed host, cache */
    const server = hv('server') || null;
    const php = (hv('x-powered-by').match(/PHP\/([\d.]+)/i) || [])[1] || null;
    let cdn = null;
    if (hv('cf-ray') || /^cloudflare/i.test(server || '')) cdn = 'Cloudflare';
    else if (hv('x-amz-cf-id') || /cloudfront/i.test(hv('via'))) cdn = 'Amazon CloudFront';
    else if (hv('x-fastly-request-id') || /^cache-/i.test(hv('x-served-by'))) cdn = 'Fastly';
    else if (hv('x-sucuri-id') || /sucuri/i.test(server || '')) cdn = 'Sucuri firewall';
    else if (hv('x-akamai-transformed') || /akamai/i.test(server || '')) cdn = 'Akamai';
    else if (hv('cdn-pullzone') || /bunnycdn/i.test(server || '')) cdn = 'bunny.net';
    else if (/keycdn/i.test(server || '')) cdn = 'KeyCDN';
    else if (hv('x-qc-pop') || hv('x-qc-cache')) cdn = 'QUIC.cloud';
    if (cdn) sig('CDN or proxy: ' + cdn, ['cf-ray', 'x-amz-cf-id', 'x-fastly-request-id', 'x-served-by', 'x-sucuri-id', 'cdn-pullzone', 'x-qc-pop', 'server'].filter(k => hv(k)).map(k => `${k}: ${hv(k)}`)[0] || '');
    let host = null; const uh = D.hostOf(url);
    for (const id of Object.keys(HOSTS)) { const h = HOSTS[id]; const hit = h.signals.find(s => (s.on === 'header' && hv(s.key) && s.re.test(hv(s.key))) || (s.on === 'url' && uh && s.re.test(uh))); if (hit) { host = h.name; sig('Host: ' + h.name, hit.on === 'header' ? `${hit.key}: ${hv(hit.key)}` : uh); if (h.kind === 'static' && !cms) { kind = 'static'; } break; } }
    if (!host && kind === 'hosted-builder') host = cms;
    [['cf-cache-status', 'Cloudflare cache'], ['x-kinsta-cache', 'Kinsta page cache'], ['x-cache', 'cache'], ['x-proxy-cache', 'proxy cache'], ['x-litespeed-cache', 'LiteSpeed cache'], ['x-cacheable', 'page cache'], ['x-nitro-cache', 'NitroPack'], ['x-fastcgi-cache', 'FastCGI cache'], ['x-varnish', 'Varnish'], ['x-vercel-cache', 'Vercel cache'], ['x-rocket-nginx-serving-static', 'WP Rocket static files']].forEach(([k, label]) => { if (hv(k)) cacheBits.push(`${label} (${k}: ${hv(k).slice(0, 40)})`); });
    const https = /^https:/i.test(url) ? true : /^http:/i.test(url) ? false : null;
    const hstsRaw = hv('strict-transport-security'); const hsts = !!hstsRaw;
    const http2Hint = /\bh3(-\d+)?=/.test(hv('alt-svc')) ? 'HTTP/3 advertised (alt-svc)' : null;
    if (kind === 'unknown' && html && !php && !cms) { sig('No CMS markers', 'no generator, no known asset paths, no application headers'); }
    return { url: url || null, status: o.status == null ? null : o.status, cms, cmsVersion, kind, builder, builderVersion, builders, theme, plugins, server, php, cdn, host, cache: cacheBits.length ? uniq(cacheBits).join('; ') : null, https, hsts, hstsMaxAge: hsts ? (+((hstsRaw.match(/max-age=(\d+)/i) || [])[1]) || 0) : null, http2Hint, signals, confidence };
  }
  /* fetch a page, fingerprint it, and report what its redirects do: http to https, and which of www and the bare domain is the real one */
  async function fingerprintUrl(url, o) {
    o = o || {}; const http = o.http || http0; let u = ''; try { u = new URL(D.withScheme(url)).href; } catch (e) { u = ''; }
    const host = D.hostOf(u);
    if (!host) throw new D.net.NetError('Not a URL: ' + url, { code: 'bad_url' });
    const r = await http(u, { timeout: 25000, signal: o.signal, maxBytes: 700000 });
    const fp = fingerprint({ url: r.url || u, status: r.status, headers: r.headers, html: r.text });
    const bare = host.replace(/^www\./, ''), otherHost = host === bare ? 'www.' + bare : bare;
    const tryGet = async x => { try { return await http(x, { timeout: 15000, signal: o.signal, maxBytes: 20000 }); } catch (e) { if (isStop(e)) throw e; return null; } };
    const [plain, other] = await Promise.all([tryGet('http://' + host + '/'), tryGet('https://' + otherHost + '/')]);
    const red = { finalUrl: r.url || u, httpToHttps: null, canonicalHost: null, notes: [] };
    if (plain) { red.httpToHttps = /^https:/i.test(plain.url || ''); if (!red.httpToHttps) red.notes.push('The plain http address answers without redirecting to https.'); } else red.notes.push('The plain http address could not be checked from here.');
    const a = D.hostOf(r.url || u), b = other ? D.hostOf(other.url || '') : '';
    const which = h => (h.startsWith('www.') ? 'www' : 'apex');
    if (other && other.status < 400) { if (a === b) red.canonicalHost = which(a); else { red.canonicalHost = 'both'; red.notes.push(`${host} and ${otherHost} both answer without one redirecting to the other: search engines see two copies of the site.`); } }
    else { red.canonicalHost = which(a); red.notes.push(other ? `${otherHost} answers ${other.status}: visitors who type it do not reach the site.` : `${otherHost} could not be reached from here.`); }
    if (a && a !== host) red.notes.push(`${host} redirects to ${a}.`);
    return Object.assign(fp, { redirects: red, fetched: { status: r.status, ms: r.ms == null ? null : r.ms, bytes: r.bytes == null ? (r.text || '').length : r.bytes, cut: !!r.cut } });
  }

  /* ============================ the runbook ============================ */
  /* texts carry commands as [[command]]; code() turns the brackets into backticks so the source stays readable */
  const code = s => String(s == null ? '' : s).replace(/\[\[([\s\S]+?)\]\]/g, '`$1`');
  const S = (doT, why, verify, risk, owner) => ({ do: code(doT), why: code(why), verify: code(verify), risk: risk || 'low', owner: owner || 'developer' });
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const parseDay = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)); return isNaN(d.getTime()) || d.getUTCMonth() !== +m[2] - 1 ? null : d; };
  const dayStr = d => `${DOW[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const back = (d, n) => new Date(d.getTime() - n * 86400000);
  const PLUGIN_ROLES = {
    cache: ['wp-rocket', 'w3-total-cache', 'wp-super-cache', 'litespeed-cache', 'wp-fastest-cache', 'sg-cachepress', 'autoptimize', 'nitropack', 'breeze', 'cache-enabler', 'hummingbird-performance', 'wp-optimize'],
    security: ['wordfence', 'sucuri-scanner', 'better-wp-security', 'ithemes-security-pro', 'all-in-one-wp-security-and-firewall', 'ninjafirewall', 'bulletproof-security'],
    smtp: ['wp-mail-smtp', 'wp-mail-smtp-pro', 'post-smtp', 'fluent-smtp', 'easy-wp-smtp', 'mailgun', 'sendgrid-email-delivery-simplified', 'smtp-mailer'],
    store: ['woocommerce', 'easy-digital-downloads', 'surecart', 'wp-simple-pay-lite', 'bookly-responsive-appointment-booking-tool', 'amelia'],
    forms: ['gravityforms', 'wpforms', 'wpforms-lite', 'contact-form-7', 'formidable', 'ninja-forms', 'fluentform', 'elementor-pro', 'forminator', 'ws-form'],
  };
  const PLUGIN_NAMES = { woocommerce: 'WooCommerce', wordfence: 'Wordfence', 'sucuri-scanner': 'Sucuri Security', 'better-wp-security': 'Solid Security', 'ithemes-security-pro': 'Solid Security Pro', 'all-in-one-wp-security-and-firewall': 'All In One WP Security', ninjafirewall: 'NinjaFirewall', 'easy-digital-downloads': 'Easy Digital Downloads', surecart: 'SureCart', gravityforms: 'Gravity Forms', wpforms: 'WPForms', 'wpforms-lite': 'WPForms', 'contact-form-7': 'Contact Form 7', formidable: 'Formidable Forms', 'ninja-forms': 'Ninja Forms', fluentform: 'Fluent Forms', 'elementor-pro': 'Elementor Pro', forminator: 'Forminator', 'ws-form': 'WS Form', amelia: 'Amelia' };
  const pluginNames = slugs => uniq(slugs.map(x => PLUGIN_NAMES[x] || (x.charAt(0).toUpperCase() + x.slice(1)))).join(', ');
  const METHOD_LABEL = { plugin: 'a migration plugin', manual: 'a manual copy (files and a database dump)', 'host-migration': 'the new host\'s migration service', rebuild: 'a rebuild on the new platform, with a redirect map' };

  /* plan(input) → the runbook. Nothing is fetched here: pass in what the lookups found (dns, fingerprint, inventory). */
  function plan(input) {
    const I = Object.assign({}, input || {});
    const dom = cleanDomain(I.domain) || norm(I.domain) || 'the domain';
    const dns = I.dns || null; const R = dns ? (dns.records || (dns.apex ? dns : null)) : null;
    const sum = dns ? (dns.summary || (R ? interpret(R) : null)) : null;
    const fp = I.fingerprint || null; const inv = I.inventory || null;
    const assumptions = [], unknowns = [], blockers = [], risks = [];
    const risk = (r, m) => risks.push({ risk: code(r), mitigation: code(m) });
    const block = q => { blockers.push(q); unknowns.push('Blocking: ' + q); };

    /* who and what */
    const guessFrom = (fp && fp.host) || (sum && sum.web.hostGuess && !/^(hidden|likely a managed host)/.test(sum.web.hostGuess) ? sum.web.hostGuess.replace(/\s*\(.*$/, '') : '');
    const fromName = norm(I.from) || '', toName = norm(I.to) || '';
    const oldH = fromName || 'the current host', newH = toName || 'the new host';
    if (!fromName) { if (guessFrom) assumptions.push(`The current host looks like ${guessFrom} (read from ${fp && fp.host ? 'the response headers' : 'DNS'}): confirm it.`); else unknowns.push('Who hosts the site today, and who can log in there?'); }
    if (!toName) unknowns.push('Which host is the site moving to, and is the account already open?');
    const fromKb = hostByName(fromName || guessFrom), toKb = hostByName(toName);
    let platform = lc(I.platform);
    if (!['wordpress', 'static', 'other'].includes(platform)) {
      platform = inv ? 'wordpress' : fp && fp.kind === 'wordpress' ? 'wordpress' : fp && fp.kind === 'static' ? 'static' : 'other';
      if (platform === 'other') unknowns.push('What runs the site (WordPress, a static build, another CMS or application)? The copy steps depend on it.');
      else assumptions.push(`Platform taken as ${platform === 'wordpress' ? 'WordPress' : 'a static site'}, from ${inv ? 'the site inventory' : 'the page fingerprint'}.`);
    }
    const wp = platform === 'wordpress', isStatic = platform === 'static';
    const active = inv && Array.isArray(inv.plugins) ? inv.plugins.filter(p => p && p.active !== false).map(p => lc(p.slug || p.name)) : (fp && fp.plugins) || [];
    const has = role => PLUGIN_ROLES[role].filter(s => active.includes(s));
    const isElementor = !!((fp && fp.builders && fp.builders.includes('Elementor')) || (fp && /elementor/i.test(fp.builder || '')) || (inv && inv.elementor && (inv.elementor.version || inv.elementor === true)) || active.includes('elementor'));
    const leavingClosed = !!((fromKb && fromKb.closed) || (sum && sum.web.closedPlatform) || (fp && fp.kind === 'hosted-builder'));
    const enteringClosed = !!(toKb && toKb.closed);
    const closedFrom = leavingClosed || enteringClosed;      /* either way nothing is copied: the pages are built again */
    if (leavingClosed) block(`${(fromKb && fromKb.name) || (fp && fp.cms) || 'The current platform'} is a closed platform: the site cannot be copied to another host. Is the site already rebuilt on ${newH}, with a redirect for every old URL? This runbook then covers DNS, mail and verification; the copy steps do not apply.`);
    else if (enteringClosed) block(`${toKb.name} is a closed platform: a site is built inside it, not copied onto it. Is the site already rebuilt there, with a redirect for every old URL? This runbook then covers DNS, mail and verification; the copy steps do not apply.`);

    /* store and forms: said, or read from the plugin list, or asked */
    let store = I.ecommerce === true, forms = I.forms === true;
    if (I.ecommerce == null) { if (has('store').length) { store = true; assumptions.push(`${pluginNames(has('store'))} is active, so this plan treats the site as one that takes orders or bookings.`); } else if (!inv) unknowns.push('Does the site take orders, bookings or payments? If so the cutover needs a full freeze and a reconciliation.'); }
    if (I.forms == null) { if (has('forms').length) { forms = true; assumptions.push(`A form plugin is active (${pluginNames(has('forms'))}), so this plan treats form entries as data to protect.`); } else if (!inv) unknowns.push('Do forms store their entries in the site\'s database (most form plugins do)? Entries received during the move have to be carried over.'); }
    const formsMaybe = forms || (I.forms == null && !inv);

    /* size and method */
    let sizeMb = I.sizeMb != null && isFinite(+I.sizeMb) ? Math.round(+I.sizeMb) : null;
    if (sizeMb == null && inv && inv.db && inv.uploads && isFinite(+inv.db.size_bytes) && isFinite(+inv.uploads.bytes)) { sizeMb = Math.round((+inv.db.size_bytes + +inv.uploads.bytes) / 1048576); assumptions.push(`Size taken from the inventory: about ${sizeMb} MB of database and uploads (themes and plugins add to it).`); }
    if (sizeMb == null && !closedFrom) unknowns.push('How large is the site (files plus database)? It decides the copy method and how long the final sync takes.');
    let method = lc(I.method); if (!['plugin', 'manual', 'host-migration'].includes(method)) method = 'auto';
    if (isStatic || !wp) { if (method !== 'host-migration') method = 'manual'; }
    else if (method === 'auto') {
      let why;
      if (store) { method = 'manual'; why = 'a site that takes orders needs a short, controlled final sync, which rsync and a database dump give'; }
      else if (sizeMb != null && sizeMb > 2000) { method = 'manual'; why = `at about ${sizeMb} MB the site is past the size where migration plugins tend to hit upload limits and timeouts`; }
      else if (sizeMb != null) { method = 'plugin'; why = `at about ${sizeMb} MB a migration plugin is the route with the fewest manual steps`; }
      else { method = 'manual'; why = 'the size is unknown and the manual route works at any size'; }
      assumptions.push(`Copy method: ${METHOD_LABEL[method]}, because ${why}. Ask ${newH} first whether its own migration service covers this site.`);
    }
    if (wp && method === 'plugin' && sizeMb != null && sizeMb > 2000) risk(`A migration plugin on a site of about ${sizeMb} MB tends to fail on upload limits or timeouts part way through.`, 'Switch to the manual route (rsync and a database dump), or split the package (database separately from uploads).');

    /* mail */
    const mail = sum ? sum.email : null;
    const mailBrandMatch = !!(mail && mail.tiedToHostingBrand && fromKb && lc(fromKb.name).includes(lc(mail.tiedToHostingBrand)));
    const mailOnHost = !!(mail && (mail.sharesWebHost || mailBrandMatch));
    const hasMail = I.emailOnDomain === true || !!(mail && mail.mx.length && !/^none/.test(mail.provider || ''));
    const mailUnknown = I.emailOnDomain == null && !sum;
    if (mailOnHost) block(`Mail for ${dom} is delivered to the current web host${mail.sharesWebHostWhy ? ' (' + mail.sharesWebHostWhy + ')' : ''}. Where will the mailboxes live after the move: a mail provider, the new host, or the old account kept open? Nothing in DNS changes until this is decided.`);
    else if (I.emailOnDomain === true && !sum) block(`People receive mail at ${dom}, and the DNS records were not looked up, so where that mail is hosted is unknown. Run the DNS lookup: if the mailboxes are on the current web host they must be dealt with before cutover.`);
    else if (mailUnknown) unknowns.push(`Does anyone receive email at an address ending in @${dom}, and where are those mailboxes hosted? If they are on the current web host, the move takes them down.`);
    if (mail && mail.tiedToHostingBrand && !mailOnHost) unknowns.push(`Mail is with ${mail.provider}. Is it part of the hosting account that is being closed, or a separate product?`);

    /* DNS facts */
    if (!sum) unknowns.push(`The current DNS records were not looked up. Run the DNS lookup for ${dom} so the worksheet names every record and its TTL.`);
    const proxied = !!(sum && sum.web.proxied);
    const changeNs = I.changeNameservers === true;
    const ttlHigh = sum && sum.highestTtl != null ? sum.highestTtl : null;
    if (sum && sum.dnsAtWebHost && !changeNs) block(`DNS for ${dom} is hosted at ${sum.dnsProvider}, which looks like the hosting account being left. Will DNS stay there (the account must then stay open), or move to the registrar or a DNS provider first? Move DNS as its own change, at least 48 hours before or after the site.`);
    if (sum && !sum.registrarHint && !changeNs) { /* a note, not a question: the registrar only matters when nameservers change */ }
    if (proxied && changeNs) block(`${dom} sits behind Cloudflare today (its nameservers and its proxy), and this plan changes the nameservers. Moving them away removes Cloudflare's proxy, its certificate and its cache in the same stroke. Is leaving Cloudflare intended? If not, keep the nameservers and change only the origin address.`);
    if (changeNs && !(sum && sum.registrarHint)) unknowns.push('Where is the domain registered, and who can log in there? Nameservers are changed at the registrar, nowhere else.');
    const launch = parseDay(I.launchDate);
    if (!launch) unknowns.push('What date and hour is the cutover? Pick a quiet one: mid week, early in the day, with the people who can fix things at their desks.');
    else {
      const dw = launch.getUTCDay();
      if (dw === 5 || dw === 6 || dw === 0) risk(`The cutover falls on a ${DOW[dw]}. Problems found on a weekend wait for Monday, and the host's senior support is thinnest then.`, 'Move the cutover to a Tuesday, Wednesday or Thursday morning.');
      if (dw === 1) risk('The cutover falls on a Monday, the heaviest day for calls and form leads at a service business.', 'Move it to Tuesday through Thursday, early in the day.');
    }
    assumptions.push('Every public URL stays exactly as it is: same domain, same paths, same www or bare form. A move that also changes URLs needs a redirect map first, as its own project.');
    assumptions.push('Design and content do not change on cutover day. A move is a move, not a redesign: one change at a time is how you know what broke.');
    assumptions.push('Times are counted back from the cutover (T). For a heating and cooling business, T should sit in a mild week: not the first days of a freeze or a heat wave, when the phones carry the month.');

    const T = (rel, a, b) => launch ? `${rel} (${a === b ? dayStr(back(launch, a)) : `${dayStr(back(launch, a))} to ${dayStr(back(launch, b))}`})` : rel;       /* days before the cutover; a negative number is days after */
    const phases = []; const phase = (id, name, when, steps) => { const s = steps.filter(Boolean); if (s.length) phases.push({ id, name, when, steps: s }); };
    const php = inv && inv.php ? String(inv.php).match(/^\d+\.\d+/) : null; const prefix = inv && inv.db && inv.db.prefix ? inv.db.prefix : null;
    const invLine = inv ? ` The connector read: WordPress ${inv.wp || 'version unknown'}, PHP ${inv.php || 'version unknown'}, ${active.length} active plugins${inv.db && inv.db.size_bytes ? `, database ${Math.round(inv.db.size_bytes / 1048576)} MB` : ''}${inv.uploads && inv.uploads.bytes ? `, uploads ${Math.round(inv.uploads.bytes / 1048576)} MB` : ''}${prefix ? `, table prefix [[${prefix}]]` : ''}.` : '';
    const changeList = sum ? (proxied ? 'the origin address of the proxied records inside Cloudflare' : [sum.web.ips.length ? 'the A record of the bare domain' : '', sum.web.ipv6.length ? 'its AAAA record' : '', sum.web.cname && sum.web.cname !== sum.domain ? 'the www CNAME' : (!sum.web.wwwFollowsApex && sum.web.wwwIps.length ? 'the www A record' : '')].filter(Boolean).join(', ') || 'the A, AAAA and CNAME records of the bare domain and www') : 'the A, AAAA and CNAME records of the bare domain and www';

    /* 1 · inventory and access */
    phase('inventory', 'Inventory and access', T('T minus 7 days or earlier', 7, 7), [
      S(`List every login the move needs and confirm each one works today: the domain registrar, the DNS panel${sum && sum.dnsProvider ? (fromName && lc(sum.dnsProvider) === lc(fromName) ? ' (also at ' + fromName + ')' : ' (' + sum.dnsProvider + ')') : ''}, ${oldH}, ${newH}${wp ? ', and a WordPress administrator' : ''}.`, 'Moves stall on cutover day over a login nobody can find. The registrar account matters most: whoever holds it holds the domain.', 'Sign in to each one. Write down who owns the account and where its two factor codes go.', 'medium', 'site owner'),
      wp ? S(`Record what runs today: WordPress version, PHP version, active plugins and theme, database size, uploads size, table prefix.${invLine}`, 'The new host has to match the PHP version first. A PHP upgrade is its own change, made after the move.', '[[wp core version]], [[wp plugin list --status=active]], [[php -v]], [[wp config get table_prefix]], [[wp db size]].') : null,
      wp ? S('List what lives outside WordPress: redirects and rewrite rules in [[.htaccess]] or the server config, cron jobs, custom constants in [[wp-config.php]], PHP extensions the plugins need, SMTP settings, and every outside service that names the current server address (payment gateway or CRM allow lists, API keys locked to an IP, license keys tied to the URL).', 'A copy of the files and the database carries none of these. Rules in [[.htaccess]] do nothing on a host that serves through Nginx, so redirects have to be recreated in the new host\'s own tool.', 'Each item has a line saying where it goes on the new host.') : null,
      isStatic ? S('List what the current host does beyond serving files: redirects, custom headers, the 404 page, how trailing slashes and [[.html]] endings are handled, form handling, functions, environment variables, password protection, the build command and its runtime version.', 'Static hosts differ exactly here. None of it is in the files, so none of it moves with them.', 'Each item has a line naming its replacement on the new host.') : null,
      (!wp && !isStatic) ? S('Write down how the site is built and deployed: the application or CMS, its runtime and version, its database, its file storage, scheduled jobs, environment variables and secrets.', 'The copy steps in this runbook are generic until this is known.', 'Someone who did not build the site could redeploy it from these notes.') : null,
      S('Write down every tag and integration the pages carry: analytics, ad conversion tags, call tracking numbers, chat, form notifications, the Search Console verification method.', 'After the move the pages must report leads exactly as before. A missing call tracking script looks like a slow week, not like a bug.', 'A list with each tag, where it is set (theme, plugin, tag manager) and how to test it.'),
      S('Crawl the live site and save the URL list with status, title, description, canonical and H1 for each page (the snapshot in this toolkit does it).', 'It is the before picture the after picture is compared with.', 'The list holds every URL in the XML sitemap plus every page an ad lands on.'),
      S(`Save the current DNS zone: every record with its TTL.${sum ? ` Found: nameservers at ${sum.dnsProvider || 'an unrecognized provider'}; web ${sum.web.ips.join(', ') || sum.web.cname || 'no address'}${sum.web.cdn ? ' behind ' + sum.web.cdn : ''}; mail ${mail.provider || 'none'}.` : ''}`, 'The worksheet below starts from it, and if anything goes wrong the saved zone is the way back.', 'Export the zone file where the DNS panel offers one; otherwise screenshot the full record list.', 'low', 'DNS admin'),
      S(`Ask ${newH} and save the answers with a date: supported PHP versions${wp ? ', whether [[.htaccess]] is honored, which plugins are not allowed' : ''}, how a site is tested before DNS points at it (temporary URL, hosts file, staging domain), how SSL is issued before cutover, whether the server may send mail, and the IPv4 and IPv6 addresses the site will get.`, 'These answers shape the build, test, SSL and cutover steps. The host\'s own documentation is the only current source.', 'Each answer links to the host\'s page or ticket.'),
      toKb && !toKb.closed ? S(`Specific to ${toKb.name}: ${toKb.notes}`, 'A host of this kind differs from ordinary shared hosting in exactly these places, and its answers change over time.', 'Each point has a dated answer from the host.') : null,
      fromKb && !fromKb.closed ? S(`Before leaving ${fromKb.name}: ${fromKb.notes}`, 'What is bundled into the old account decides what else has to move.', 'A list of the products in the old account: hosting, domain, DNS, mailboxes, certificates.', 'medium', 'site owner') : null,
    ]);

    /* 2 · backups */
    phase('backups', 'Backups, restored once', T('T minus 5 days', 5, 5), [
      wp ? S('Take a full backup that depends on neither host: all files and a database dump, downloaded to storage you control. [[wp db export backup.sql --add-drop-table]] and [[tar -czf files.tar.gz -C /path/to/site .]]', 'The old host\'s backups vanish with the account, and the new host has none yet.', 'The dump ends with a [[Dump completed]] line; the archive lists [[wp-config.php]] and [[wp-content/uploads]].')
        : S('Take a full backup that depends on neither host: the published files, the source or repository, and any database, downloaded to storage you control.', 'The old host\'s backups vanish with the account, and the new host has none yet.', 'The archive opens and holds the home page and the newest content.'),
      S('Restore that backup once, somewhere disposable: a local environment or a scratch site.', 'A backup nobody has restored is a hope. The restore also times the copy, which sets the length of the freeze.', 'The restored copy loads the home page, a deep page and, where there is one, the admin.'),
      S('Keep this backup until the old host is canceled and for 30 days after.', 'It is the last copy of the site as it was before anything changed.', 'Its location and date are written in this runbook.', 'low', 'site owner'),
    ]);

    /* 3 · mail */
    const mailSteps = [];
    if (mailOnHost) {
      mailSteps.push(S(`Decide where mail lives after the move, before any DNS change: (a) move the mailboxes to a mail provider first, so mail no longer depends on web hosting; (b) recreate every mailbox on ${newH}, if it offers mailboxes at all (many managed hosts do not), and copy the mail across; or (c) leave MX pointing at ${oldH} and keep that account open.`, `Mail for ${dom} is delivered to the current web host. Canceling that host, or changing nameservers without the mail records, stops email the same hour. Option (a) is the one that ends the problem for good.`, 'A written choice, plus a list of every mailbox, alias and forwarder with its owner.', 'high', 'site owner'));
      mailSteps.push(S('For (a) or (b): create the mailboxes on the new side, copy each one with IMAP sync ([[imapsync --host1 OLD --user1 name@' + dom + ' --host2 NEW --user2 name@' + dom + ']]), change MX, then sync once more for mail that arrived in between.', 'Mail servers retry for hours, so nothing is lost while MX moves, but anything delivered to the old mailbox before the change stays there until the second sync.', 'A test message sent from outside lands in the new mailbox; the old mailbox stays empty afterwards.', 'high', 'mail admin'));
      if (mail && mail.mxFollowsWeb) mailSteps.push(S(`The MX record names ${dom} itself. Before cutover, create a [[mail]] record that points at the old server's address and point MX at it (or finish the mail move first).`, 'An MX that names the bare domain follows its A record: the minute A changes, mail goes to the new web server, which has no mailboxes.', `[[dig +short ${dom} MX]] answers with the new mail name and it resolves to the mail server, not the new web server.`, 'high', 'DNS admin'));
    } else if (hasMail) {
      mailSteps.push(S(`Leave mail alone. The MX records${mail && mail.provider ? ' point at ' + mail.provider + ' and' : ''} stay exactly as they are through the move, with the SPF, DKIM and DMARC records beside them.`, 'Mail and web are separate services that share a domain name. The web cutover touches only the web records.', `[[dig +short ${dom} MX]] returns the same answer before and after cutover.`, 'low', 'DNS admin'));
    } else if (mailUnknown) {
      mailSteps.push(S(`Find out whether anyone receives mail at @${dom} and where: [[dig +short ${dom} MX]] (or [[nslookup -type=mx ${dom}]] on Windows).`, 'If the answer names the current web host, the mailboxes are part of the account being left and need their own plan first.', 'The MX answer is written into this runbook with the provider it belongs to.', 'medium', 'DNS admin'));
    }
    if ((wp || formsMaybe) && !closedFrom) mailSteps.push(S('Decide how the website itself sends mail (form notifications, password resets): through an SMTP service with its own SPF and DKIM, not through the web server\'s own mail function.', `The new server has a new address.${mail && mail.spfUsesWebServer ? ' The SPF record authorizes the current server, so notifications from the new one fail SPF until the record is updated.' : ''} Many managed hosts restrict mail sent straight from PHP.${wp && inv && !has('smtp').length ? ' No SMTP plugin is active today, so the site most likely uses PHP mail.' : ''}`, 'Send a form test and a password reset from the copy; the received headers show spf=pass and dkim=pass.', 'medium'));
    phase('email', 'Mail: decide before DNS moves', T('T minus 7 to 3 days', 7, 3), mailSteps);

    /* 4 · TTLs (and the zone, when nameservers change) */
    const ttlSteps = [];
    if (proxied) ttlSteps.push(S('Nothing to lower: the records are proxied through Cloudflare. Visitors always reach Cloudflare\'s addresses, and the cutover is an edit of the origin address inside Cloudflare that takes effect in seconds.', 'TTL only matters when the public answer changes. Here it does not.', 'In the Cloudflare panel the web records show the proxied (orange) state.', 'low', 'DNS admin'));
    else ttlSteps.push(S(`Lower the TTL to 300 seconds on the records that will change: ${changeList}.${ttlHigh != null ? ` A resolver showed up to ${ttlHigh} seconds on them today.` : ''}`, 'Resolvers keep an answer for the length of its TTL. At 300 seconds the switch reaches almost everyone within five minutes, and a rollback is just as quick.', `[[dig ${dom} A +noall +answer]] against the authoritative nameserver shows 300. Then wait at least the old TTL${ttlHigh != null && ttlHigh > 300 ? ' (' + hours(ttlHigh) + ')' : ''} before cutover, so no resolver still holds the long answer.`, 'low', 'DNS admin'));
    if (!proxied) ttlSteps.push(S('Leave MX, TXT and NS records out of this step.', 'Only the records that change at cutover need a short TTL. Touching mail records for no reason is how mail gets broken.', 'The saved zone and the live zone differ only in the TTL of the web records.', 'low', 'DNS admin'));
    if (changeNs) {
      ttlSteps.push(S('Because the nameservers change: rebuild the complete zone at the new DNS provider first. Every A, AAAA, CNAME, MX, TXT (SPF, each DKIM selector, DMARC, ownership verification), SRV and CAA record, compared one by one against the saved zone.', 'A nameserver switch moves every record at once. The ones forgotten are DKIM selectors and verification records, because a public lookup cannot list them: they have to be read in the old DNS panel.', `Query the new nameservers directly before switching: [[dig @NEW_NS ${dom} MX]], [[dig @NEW_NS ${dom} TXT]], and each DKIM selector.`, 'high', 'DNS admin'));
      ttlSteps.push(S(`${sum && sum.dnssec ? 'DNSSEC is on for this domain: remove' : 'If DNSSEC is on, remove'} the DS record at the registrar and wait out its TTL before changing nameservers, unless both providers support a signed handover.`, 'A DS record that points at keys the new nameservers do not hold makes the whole domain fail validation, which looks like the domain vanishing.', '[[dig +short ' + dom + ' DS]] returns nothing before the nameserver change.', 'high', 'DNS admin'));
      ttlSteps.push(S('Switch nameservers at least 48 hours before or after the site cutover, never the same day.', 'Registries publish delegations with a two day TTL, so for up to 48 hours some visitors ask the old nameservers and some the new. Both must give the same answers during that time, which is only simple when nothing else is changing.', '[[dig +short ' + dom + ' NS @1.1.1.1]] and [[@8.8.8.8]] both return the new nameservers.', 'high', 'DNS admin'));
      risk('A nameserver change cannot be rolled back quickly: restoring the old nameservers takes up to 48 hours to reach everyone.', 'Keep the old DNS zone intact and serving the same records for a week after the switch, and keep the nameserver change apart from the site cutover.');
    }
    phase('ttl', changeNs ? 'DNS preparation: TTLs and the new zone' : 'Lower the TTLs', T('T minus 48 to 24 hours', 2, 1), ttlSteps);

    /* 5 · build the copy */
    const build = [];
    const leftovers = wp ? S(`Remove what belongs to the old host: [[wp-content/advanced-cache.php]], [[wp-content/object-cache.php]], the old host's must use plugins in [[wp-content/mu-plugins]], and cache folders.${has('security').length ? ` ${pluginNames(has('security'))} is active: turn off its extended firewall before the copy, because it writes the old server's absolute path into [[.user.ini]] or [[.htaccess]].` : ' If a firewall plugin runs in extended mode, turn that off before the copy: it writes the old server\'s absolute path into [[.user.ini]] or [[.htaccess]].'}${inv && inv.object_cache ? ' An object cache drop in is present on the current site.' : ''}`, 'These drop ins point at services and paths that do not exist on the new server. They are the usual cause of a blank page right after a move.', 'The copy loads with every plugin active and the PHP error log stays quiet.', 'medium') : null;
    const outside = wp ? S(`Recreate what lives outside WordPress, from the inventory: redirects, cron jobs, PHP settings and extensions, SMTP.${inv && inv.cron && inv.cron.disabled ? ' WP Cron is disabled on the current site, which means a real cron job runs it: create the same job on the new host.' : ''}`, 'The site depends on them and the copy did not bring them.', '[[wp cron event list]] shows next runs in the future; a redirect from the inventory answers 301 on the copy.') : null;
    if (closedFrom) build.push(S(`Rebuild the pages on ${newH} and map every old URL to its new one with a 301 redirect.`, 'A closed platform exports content at best. The pages, the forms and the design are built again.', 'Every URL in the saved list answers 200 or a 301 to the right page on the copy.', 'high'));
    else if (method === 'host-migration') {
      build.push(S(`Open the migration request with ${newH}. Give them a temporary administrator account and temporary file access made for this job, never the owner's own passwords.`, 'Accounts made for the job can be removed the day it ends, and they leave a clean record of who did what.', 'The accounts are named for the migration and have an end date in this runbook.', 'medium', 'site owner'));
      build.push(S('Ask in writing what their copy includes and what it leaves out: email, DNS, cron jobs, redirects outside the application, SSL, and whether they copy again right before cutover.', 'A host\'s migration moves the website. Everything else on this list stays your job, and the final sync has to be on their calendar.', 'A dated reply from the host answering each point.', 'medium'));
      build.push(leftovers); build.push(outside);
    } else if (wp && method === 'plugin') {
      build.push(S(`Create a clean WordPress on ${newH} with the same PHP version${php ? ' (' + php[0] + ')' : ''} as today. Do not point the domain yet.`, 'Matching PHP first keeps the move to one change.', '[[php -v]] matches the current host; the host\'s temporary address answers.'));
      build.push(S(`On the current site, build a package with a migration plugin. Duplicator, All-in-One WP Migration, WPvivid and Migrate Guru are the usual choices: use the one ${newH} supports. Leave cache folders and old backup archives out of the package.`, 'A package carries files and database together, and the plugin rewrites URLs in a way that keeps serialized data intact.', 'The package finishes without a timeout and its size is close to files plus database.'));
      build.push(S('Import the package on the new host.', 'The import replaces the clean install with the real site.', '[[wp post list --post_type=page --format=count]] gives the same number on both hosts.'));
      build.push(leftovers); build.push(outside);
    } else if (wp) {
      build.push(S(`Create the site on ${newH} with the same PHP version${php ? ' (' + php[0] + ')' : ''} as today and an empty database. Do not point the domain yet.`, 'Matching PHP first keeps the move to one change.', '[[php -v]] matches the current host; the host\'s temporary address answers.'));
      build.push(S('Copy the files: everything under the WordPress root except caches and old backup archives. [[rsync -avz --exclude \'wp-content/cache/\' --exclude \'*.zip\' --exclude \'*.tar.gz\' USER@OLD_HOST:/path/to/site/ /path/on/new/host/]] (SFTP where SSH is not offered).', 'rsync can run again on cutover day and move only what changed, which keeps the freeze short.', '[[find wp-content/uploads -type f | wc -l]] gives the same count on both hosts.'));
      build.push(S('Export the database on the old host and import it on the new one: [[wp db export site.sql --add-drop-table]], then [[wp db import site.sql]]. Without WP CLI: [[mysqldump --single-transaction --quick --default-character-set=utf8mb4 -u USER -p DBNAME > site.sql]].', 'The single transaction flag takes a consistent snapshot without locking the live site.', '[[wp db check]] passes and [[wp post list --post_type=page --format=count]] matches the old host.'));
      build.push(S(`Write [[wp-config.php]] for the new host: its database name, user, password and host, the same table prefix${prefix ? ' ([[' + prefix + ']])' : ''}, fresh salts, and the custom constants from the inventory. Leave out anything that names the old server's paths.`, 'A wrong prefix makes WordPress start its installer over an existing database. Fresh salts only log people out.', '[[wp option get siteurl]] answers without a database error.'));
      build.push(leftovers); build.push(outside);
    } else if (isStatic) {
      build.push(S(`Deploy the same build to ${newH}: from the repository when there is one, otherwise the published files as they are.`, 'The same input should produce the same pages. Deploying from the repository also proves the build still works.', 'The file list matches, and a sample of pages is byte for byte the same apart from host injected snippets.'));
      build.push(S('Recreate the host level behavior from the inventory: redirects, headers, the 404 page, trailing slash and [[.html]] handling, forms, functions, environment variables.', 'A site that answers [[/services]] on one host and only [[/services/]] on the other loses links and splits its search signals between two addresses.', 'For ten URLs, with and without the trailing slash, [[curl -sI]] gives the same status and location on both hosts.', 'medium'));
    } else {
      build.push(S(`Stand the application up on ${newH}: same runtime version, a copy of the database and the file storage, the same environment variables and scheduled jobs.`, 'Without knowing what runs the site, this is as specific as the step can honestly be.', 'The copy answers on the host\'s temporary address and shows the newest content.', 'medium'));
    }
    if (wp && inv && inv.multisite) build.push(S('This is a multisite network: copy the whole network, and plan for [[--network]] on every WP CLI command and for the domain mapping tables.', 'A multisite keeps each site\'s address in its own tables. A single site procedure moves the main site and breaks the rest.', '[[wp site list]] shows every site with the right address on the copy.', 'high'));
    phase('build', 'Build the copy on the new host', T('T minus 4 to 2 days', 4, 2), build);

    /* 6 · URLs, WordPress only */
    if (wp && !closedFrom) phase('urls', 'Search and replace, only if a URL changes', T('T minus 3 to 2 days', 3, 2), [
      S('First decide whether any URL changes at all. Testing through a hosts file entry keeps the real domain on the copy, so nothing needs replacing. Only a temporary URL, a switch between www and the bare domain, or a move from http to https needs this phase.', 'Every replace is a chance to damage data. The cleanest move never rewrites a URL.', 'The test method for the next phase is written down: hosts file, or temporary URL.'),
      S(`When a replace is needed, use WP CLI and run it dry first: [[wp search-replace 'https://OLD' 'https://NEW' --precise --all-tables --skip-columns=guid --dry-run${inv && inv.multisite ? ' --network' : ''}]]. Read the counts per table, then run it again without [[--dry-run]].`, 'WordPress stores settings as serialized PHP, where every string carries its length. A plain SQL find and replace changes the text and not the length, and those values (widgets, theme options, page builder data) reset without a word. WP CLI rewrites the lengths. The guid column is an identifier, not a link, and must not change.', '[[wp option get home]] and [[wp option get siteurl]] show the new address, and the same dry run now reports no replacements.', 'medium'),
      isElementor || !inv ? S(`${isElementor ? 'Elementor is in use: it' : 'If the site uses Elementor, it'} keeps URLs inside its own JSON and in generated CSS files. After any URL change run Elementor, Tools, Replace URL with the old and new address, then Tools, Regenerate Files and Data (Regenerate CSS in older versions). With WP CLI: [[wp elementor replace-urls 'https://OLD' 'https://NEW']] and [[wp elementor flush-css]]. Run the regenerate step once on the new host even when no URL changed.`, 'Escaped addresses inside Elementor data are missed by other tools, and stale CSS files keep loading backgrounds and fonts from the old address.', 'View source on an Elementor page of the copy: no old address in the markup or in [[wp-content/uploads/elementor/css]].', 'medium') : null,
      S('Flush what remembers the old state: [[wp cache flush]], [[wp rewrite flush]], then any page cache and CDN.', 'Caches and rewrite rules written on the old server describe the old server.', 'A page that changed in the replace shows the change on first load.'),
    ]);

    /* 7 · test */
    phase('test', 'Test the copy before DNS moves', T('T minus 2 to 1 days', 2, 1), [
      S(`Open the copy without touching public DNS. Best: a hosts file entry on your own machine, [[NEW_IP ${dom} www.${dom}]] in [[/etc/hosts]] (macOS, Linux) or [[C:\\Windows\\System32\\drivers\\etc\\hosts]], which shows the copy under its real name. Otherwise the host's temporary URL.${proxied ? ' With Cloudflare in front, the hosts file entry reaches the new origin directly and skips Cloudflare, which is what this test wants.' : ''}`, 'The hosts file test uses the real URLs, the real cookies and the real certificate name, so what passes here passes after cutover. Remove the entry when done.', `[[curl -sI --resolve ${dom}:443:NEW_IP https://${dom}/]] answers from the new server (look for a header only the new host sends).`),
      S('Walk the paths that make money: the home page, the top service pages, every ad landing page, the contact and booking forms (send a test lead), click to call links on a phone, the thank you page, site search, the 404 page.', 'These are the pages the campaigns pay to fill.', 'Each one loads, looks right on a phone, and the test lead arrives where leads normally arrive.', 'medium'),
      S(`Check what search engines will see. The copy must not carry noindex${wp ? ': in WordPress, Settings, Reading, the box that discourages search engines is off ([[wp option get blog_public]] returns 1)' : ''}; [[robots.txt]] does not disallow everything; no response sends [[X-Robots-Tag: noindex]].`, 'Staging copies are set to noindex on purpose. Carrying that flag into production removes the site from search within days, and it is the most expensive mistake a move can make.', '[[curl -s https://' + dom + '/robots.txt]] and the head of the home page, read through the hosts file entry, show no noindex and no blanket disallow.', 'high'),
      S('Run the before against after comparison on the saved URL list (snapshot and verify in this toolkit): status, title, description, canonical, H1, word count, forms and phone links. With the hosts file entry in place this browser reads the copy under the real name, so the snapshot taken earlier is the old side; on a temporary URL the two addresses are compared directly.', 'It finds the page that lost its form or its title among hundreds that are fine.', 'No differences beyond the ones expected and written down.'),
      S('Confirm every tag from the inventory fires on the copy: analytics, conversion tags, the call tracking number swap, chat.', 'A tag lost in the move is invisible until the monthly report.', 'Each tag\'s request shows in the browser\'s network panel, or in the tag\'s own debug view.'),
      wp ? S('Read the PHP error log on the new host after the walk through.', 'Warnings that the old server hid, or that only a different PHP build raises, show up here first.', 'No fatal errors; any warning is understood and written down.') : null,
      formsMaybe ? S('Send mail from the copy: a form notification and, where there are accounts, a password reset.', 'Mail sent from a new server is the thing most likely to work in testing and fail quietly in production.', 'Both arrive in an inbox, not in spam, and their headers show spf=pass and dkim=pass.', 'medium') : null,
      S('Time the home page and one heavy page on both hosts: [[curl -s -o /dev/null -w \'%{time_starttransfer}\\n\' URL]], five runs each.', 'The new host should not be slower before its caching is even set up. If it is, find out why before the move, not after.', 'The new host\'s median is at or under the old one.'),
    ]);

    /* 8 · SSL */
    phase('ssl', 'The certificate plan', T('T minus 2 days to cutover', 2, 0), [
      S(`Have a valid certificate for ${dom} and www.${dom} on the new server before DNS switches, or within minutes of it. Options, best first: the host issues one ahead of time by DNS validation; you install the existing certificate and key exported from the old host; a CDN in front already holds the certificate; or the host issues one by HTTP validation the minute DNS points at it.`, 'A free certificate validated over HTTP can only be issued once the name resolves to the new server. Without a plan there is a gap in which browsers show a full page warning, and where HSTS is set nobody can click through it.', `[[openssl s_client -connect NEW_IP:443 -servername ${dom} </dev/null 2>/dev/null | openssl x509 -noout -subject -dates]] shows the right name and dates.`, 'medium'),
      sum && sum.caa.length ? S(`CAA records limit who may issue certificates for this domain (${sum.caaIssuers.join(', ') || 'nobody'}). Confirm the certificate authority ${newH} uses is on the list, or add it before cutover.`, 'A certificate authority that is not listed must refuse, and the host\'s panel usually just says the certificate is pending.', '[[dig +short ' + dom + ' CAA]] lists the new host\'s certificate authority.', 'high', 'DNS admin') : null,
      proxied ? S('In Cloudflare keep the SSL mode at Full (strict), and give the new origin a certificate Cloudflare trusts: a Cloudflare origin certificate or a public one.', 'In Flexible mode the hop from Cloudflare to the origin is unencrypted and WordPress can fall into a redirect loop; in strict mode an origin without a valid certificate answers with an error page.', 'The site loads through Cloudflare with the mode set to Full (strict).', 'medium', 'DNS admin') : null,
      S(`Keep the redirects between http and https, and between www and the bare domain, exactly as they are today${fp && fp.redirects && fp.redirects.canonicalHost && fp.redirects.canonicalHost !== 'both' ? ' (the site lives on the ' + (fp.redirects.canonicalHost === 'www' ? 'www' : 'bare') + ' name)' : ''}.`, 'A change in the canonical host on cutover day turns every indexed URL into a redirect at the same moment the server changes, and hides which of the two caused a drop.', '[[curl -sI http://' + dom + '/]] and [[curl -sI https://www.' + dom + '/]] answer with the same locations on the copy as on the live site.'),
    ]);

    /* 9 · freeze and final sync */
    const freezeLevel = store ? 'full' : formsMaybe ? 'content and entries' : 'content';
    const freeze = { needed: true, level: freezeLevel, starts: 'at the final sync', ends: 'when the verification phase passes', covers: ['publishing and editing content'].concat(store ? ['orders, bookings and payments (maintenance mode or checkout paused)'] : []).concat(formsMaybe ? ['form entries (note the last one received on the old site)'] : []), why: store ? 'An order placed on the old site after the final copy does not exist on the new one. The store has to pause, and the last order number on both sides has to match.' : 'Anything written to the old site after the final copy stays on the old site. The window is short, but someone has to know it exists.' };
    phase('freeze', 'Freeze and final sync', T('Cutover day, before the switch', 0, 0), [
      S(`Announce and start the freeze: no content edits${store ? ', the store in maintenance mode or with checkout paused' : ''}${formsMaybe ? ', and a note of the last form entry received' : ''}.`, freeze.why, `The start time is written down${store ? ', with the last order number' : ''}${formsMaybe ? ' and the last form entry' : ''}.`, store ? 'high' : 'medium', 'site owner'),
      closedFrom ? null : method === 'host-migration' ? S(`Ask ${newH} for the final copy and wait for their confirmation before touching DNS.`, 'Their first copy is days old by now.', 'The newest post, order or form entry on the old site exists on the new one.', 'medium')
        : wp && method === 'plugin' ? S('Build a fresh package on the old site and import it on the new one, then repeat the leftovers step.', 'The copy made days ago is missing everything since.', 'The newest post, order or form entry on the old site exists on the new one.', 'medium')
        : wp ? S('Final sync: export and import the database again, and run the same rsync once more for uploads.', 'rsync moves only what changed, so this takes minutes where the first copy took hours.', 'The newest post, order or form entry on the old site exists on the new one.', 'medium')
        : S('Deploy the current build once more, or copy what changed since the first copy.', 'The copy made days ago is missing everything since.', 'The newest page or change on the old site exists on the new one.'),
      wp && !closedFrom ? S('If the copy was tested on a temporary URL, repeat the search and replace and the Elementor steps on the fresh database. With the hosts file method there is nothing to repeat.', 'A fresh database import brings the old addresses back.', '[[wp option get home]] shows the live address.') : null,
      (store || forms) ? S(`Reconcile: compare ${store && forms ? 'the last order number and the last form entry' : store ? 'the last order number' : 'the last form entry'} on both sides.`, 'It is the proof that the freeze held.', 'They match, or the difference is carried over by hand and noted.', 'medium') : null,
    ]);

    /* 10 · cutover */
    phase('cutover', 'DNS cutover', T('Cutover day', 0, 0), [
      proxied ? S('In Cloudflare, change the origin address of the proxied web records to the new server. Change nothing else.', 'The public addresses are Cloudflare\'s and stay as they are; only where Cloudflare fetches the site from changes, and it changes in seconds.', 'A response header only the new host sends appears on the live site.', 'medium', 'DNS admin')
        : S(`At the DNS provider, change only the web records: ${changeList}, to the values ${newH} gave. Leave MX, TXT (SPF, DKIM, DMARC, verification), NS and everything else untouched.`, 'The worksheet below lists each record with keep or change. A web move changes the web records and nothing else.', `[[dig +short ${dom} A @1.1.1.1]] and [[dig +short ${dom} A @8.8.8.8]] return the new address within minutes.`, 'medium', 'DNS admin'),
      sum && sum.web.ownIpv6 ? S('Update the AAAA records in the same edit, or delete them if the new host gave no IPv6 address.', 'A stale AAAA record keeps sending IPv6 visitors, a large share of phones, to the old server.', '[[dig +short ' + dom + ' AAAA]] returns the new address or nothing.', 'medium', 'DNS admin') : null,
      S(`Watch the site as DNS moves: load [[https://${dom}/]] and [[https://www.${dom}/]], check the padlock, and check the redirect between www and the bare domain.`, 'The first minutes show certificate and redirect problems while a rollback is still five minutes away.', `[[curl -sI https://${dom}/ | head -n 5]] answers 200 or the expected redirect, from the new server.`),
      S('Purge every cache layer: the page cache plugin, the host\'s cache, the CDN.', 'A cache filled before cutover can keep serving pages built on the old server, or the host\'s placeholder page.', 'A hard reload of three pages shows current content.'),
      S('Keep the freeze on until the verification phase passes.', 'If a rollback is needed, nothing written in between is lost.', 'The freeze end time is written down after verification.', 'low', 'site owner'),
    ]);

    /* 11 · verify */
    phase('verify', 'Verify the live site', T('The first hour after cutover', 0, 0), [
      S('Run the comparison again against the live domain: the saved before snapshot against the site now.', 'It is the same check as in testing, now through real DNS, the real certificate and every cache layer.', 'No differences beyond the ones written down.'),
      S('Send a real test lead through each form and place a call through a tracked number.', 'Leads are what the site is for. This is the check that matters most.', 'Both arrive where leads normally arrive, with the right source on them.', 'medium', 'site owner'),
      hasMail || mailUnknown ? S(`Check that mail still flows: send a message to an address at ${dom} from outside, and reply to it.`, 'Mail should be untouched. This proves it.', 'The message arrives and the reply is received.', 'medium', 'site owner') : null,
      S('In Search Console: confirm the property is still verified, inspect the home page URL, resubmit the sitemap.', 'Verification by an HTML file or a meta tag has to exist on the new host too. Losing it hides the reports that would show a problem.', 'URL inspection says the page can be fetched and indexed.'),
      wp ? S('Confirm scheduled jobs and backups run on the new host: [[wp cron event list]], and the host\'s backup schedule.', 'Cron and backups are configured per server. Neither one came across in the copy.', 'Next runs are in the future, and a backup exists by the next morning.') : null,
      S('Look once more for noindex and for a blanket disallow in [[robots.txt]], on the live domain.', 'The same check as before cutover, because a final sync or a host setting can put the flag back.', 'Neither is present.', 'high'),
    ]);

    /* 12 · monitor, and the old host */
    phase('monitor', 'Monitor, then retire the old host', T('Days 1 to 30', -1, -30), [
      S('Turn on uptime monitoring for the home page and the main form page for the first 72 hours, with alerts to a phone.', 'New hosts fail in new ways: a resource limit, a firewall rule, a certificate renewal.', 'A test alert reaches the phone.'),
      S('Each day for a week, compare organic visits, calls, form leads and ad conversions with the same weekday before the move.', 'A tracking gap and a real drop look the same on day one. Only the comparison tells them apart.', 'The numbers sit inside their normal range, or the cause of a gap is found.', 'low', 'site owner'),
      S('Watch Search Console\'s page indexing and crawl stats for two weeks.', 'A rise in server errors or in pages excluded by noindex is the early warning, days before rankings move.', 'No new error class appears.'),
      S(`Keep ${oldH} running for 14 to 30 days and watch its access log ([[tail -f]] on the log, or the panel's visitor stats). Cancel only when the log is quiet, mail is confirmed independent of it, and the final backup is stored elsewhere.`, 'Requests still arriving at the old server mean a resolver, a hard coded address or a forgotten subdomain still points there. The old host is also the rollback.', 'A day of the old access log shows only bots that ignore DNS.', 'medium', 'site owner'),
      proxied ? null : S('Raise the TTLs back to an hour or more once a week has passed without trouble.', 'A 300 second TTL makes every visit depend on a fresh DNS answer. It is a setting for moving, not for living.', 'The web records show the longer TTL.', 'low', 'DNS admin'),
      S('Remove the temporary accounts made for the move and change any password that was shared along the way.', 'Migration accounts are administrator accounts nobody remembers.', 'The user lists on the site and both hosts hold no migration accounts.', 'low', 'site owner'),
      S('Then, as separate changes with their own checks: upgrade PHP if a newer version was waiting, set up the new host\'s caching and CDN, and retune performance.', 'Each of these can break a site by itself. Done after the move, a problem has one possible cause.', 'Each change has its own before and after check.'),
    ]);

    /* the worksheet, the standing risks, the way back */
    const dnsWorksheet = worksheet({ dom, R, sum, changeNs, proxied, hasMail: hasMail || mailOnHost, mailOnHost });
    risk('Email stops because mail records were changed or lost with the old host.', mailOnHost ? 'Blocking item: decide where the mailboxes live before any DNS change (the mail phase).' : changeNs ? 'Rebuild every mail record at the new DNS provider before the nameserver switch and compare it with the saved zone; at the site cutover change only the web records.' : 'Change only the web records at cutover; keep MX, SPF, DKIM and DMARC exactly as saved.');
    risk('The site drops out of search: a noindex flag carried over from staging, changed URLs, lost redirects or a lost Search Console verification.', 'The search checks in the test and verify phases, identical URLs, and the before against after comparison.');
    risk('Visitors keep reaching the old server after cutover.', proxied ? 'Not a TTL matter behind Cloudflare; purge its cache after the origin changes.' : 'TTL lowered to 300 seconds at least one old TTL ahead; old host kept running for 14 to 30 days.');
    risk('Browsers show a certificate warning between the DNS change and the new certificate.', 'The certificate plan: issued ahead by DNS validation, imported from the old host, or held by a CDN in front.');
    if (store || formsMaybe) risk('Orders or leads placed between the final copy and the cutover are lost.', 'The freeze, the final sync, and the reconciliation of the last order or form entry on both sides.');
    risk('Form notifications from the new server land in spam or bounce.', 'Send through an SMTP service with its own SPF and DKIM; test from the copy before cutover.');
    if (wp) risk('The new host runs different software: another PHP build, Nginx where Apache was, plugins it does not allow.', 'Match PHP first, recreate redirects in the host\'s own tool, check the host\'s list of plugins it does not allow, and read the error log during testing.');
    risk('Leads go uncounted because a tag or a call tracking script did not survive.', 'The tag inventory, checked on the copy and again after cutover, and the daily comparison in the first week.');
    risk('Outside services that trust the old server address (payment gateway, CRM, API allow lists) refuse the new one.', 'The inventory of everything that names the server address; update each allow list before cutover.');
    /* what the DNS records showed, each with the step that answers it. Findings a standing row already covers are not repeated. */
    const DNS_COVER = {
      nxdomain: 'Stop here: nothing can be planned for a name that does not resolve. Check the registration and the spelling first.',
      'dns-at-web-host': 'Blocking question above. Move the zone to the registrar or a DNS provider as its own change, 48 hours away from the site cutover, or keep the old account open.',
      'www-apart': 'Confirm during inventory what serves each name; the worksheet lists both, and both are tested through the hosts file.',
      proxied: 'The cutover step edits the origin address inside Cloudflare, and the certificate plan covers the SSL mode.',
      ipv6: 'The AAAA step in the cutover phase.',
      'mail-host-brand': 'Open question above: confirm whether the mailboxes belong to the hosting account before anything is canceled.',
      'no-spf': 'Not caused by the move. Add the record as its own change once the cutover has settled.',
      'multi-spf': 'Not caused by the move. Merge the records as its own change once the cutover has settled.',
      'no-dmarc': 'Not caused by the move. Add a DMARC record as its own change once the cutover has settled.',
      caa: 'The certificate plan checks the new host\'s certificate authority against the list before cutover.',
      dnssec: changeNs ? 'The DS record step in the DNS preparation phase.' : 'No nameserver change is planned, so nothing changes. Never switch nameservers without dealing with the DS record first.',
    };
    if (sum) sum.risks.forEach((r, i) => { const cover = DNS_COVER[(sum.riskIds || [])[i]]; if (cover) risks.push({ risk: r, mitigation: cover }); });

    const rollback = [
      'Agree the trigger before cutover and write it down: for example the site unreachable or broken for 15 minutes, forms or checkout failing, or mail bouncing.',
      proxied ? 'Change the origin address back inside Cloudflare: it takes effect in seconds.' : 'Point the changed records back to the values in the saved zone. With the TTL at 300 seconds most visitors are back on the old host within five to ten minutes.',
      'Before switching back, export anything created on the new host since cutover (orders, form entries, new content) so it can be entered on the old site.',
      'Leave the old host untouched until monitoring ends: a rollback only works while the old copy is intact and its certificate is valid.',
      'After a rollback, find the cause on the new host through the hosts file method, fix it, and set a new cutover time. Do not try again the same evening.',
    ].concat(changeNs ? ['A nameserver change is the exception: it cannot be rolled back quickly, because restoring the old nameservers takes up to 48 hours to reach everyone.'] : []).map(code);
    const postLaunch = [
      { when: 'first 15 minutes', check: 'The site loads on the bare domain and on www with a valid certificate; the right server answers; caches are purged.' },
      { when: 'first hour', check: 'The before against after comparison is clean; a test lead and a test call arrive; mail to the domain arrives; no noindex anywhere.' },
      { when: 'day 1', check: 'Backups and scheduled jobs ran on the new host; the error log is quiet; analytics and conversion tags recorded the day.' },
      { when: 'day 3', check: 'Uptime monitoring shows no outage; leads and calls match the same weekdays before the move.' },
      { when: 'week 1', check: 'Search Console shows no new errors and no rise in excluded pages; TTLs go back up.' },
      { when: 'day 14 to 30', check: 'The old host\'s access log is quiet; the final backup is stored elsewhere; temporary accounts are gone; the old account is canceled.' },
    ];
    const title = `Hosting move runbook: ${dom}`; const openN = unknowns.length - blockers.length;
    const summary = `Move ${dom} from ${oldH} to ${newH}: ${wp ? 'WordPress' : isStatic ? 'a static site' : 'platform to be confirmed'}${closedFrom ? ', as a rebuild' : `, by ${METHOD_LABEL[method] || method}`}. ${phases.length} phases${launch ? `, cutover on ${dayStr(launch)}` : ', cutover date open'}. ${blockers.length ? `${blockers.length} blocking question${blockers.length === 1 ? '' : 's'} must be settled before any DNS change${openN ? `, and ${openN} more ${openN === 1 ? 'is' : 'are'} open` : ''}.` : openN ? `${openN} open question${openN === 1 ? '' : 's'} to answer before cutover.` : ''}`.trim();
    const out = { title, summary, domain: dom, from: fromName || null, to: toName || null, platform, method: closedFrom ? 'rebuild' : method, launch: launch ? { date: launch.toISOString().slice(0, 10), weekday: DOW[launch.getUTCDay()] } : null, contactRole: norm(I.contactRole) || null, assumptions: assumptions.map(code), unknowns: unknowns.map(code), blockers: blockers.map(code), phases, dnsWorksheet, risks, rollback, postLaunch, freeze };
    out.markdown = markdown(out);
    return out;
  }

  /* one row per record found, with what to do to it at a web cutover */
  function worksheet(c) {
    const rows = []; const row = (name, type, current, action, note) => rows.push({ name, type, current, action, note: code(note || '') });
    const R = c.R, sum = c.sum;
    if (!R || !sum) {
      row('@ and www', 'A, AAAA, CNAME', 'not looked up', 'change', 'The web records: these become the new host\'s values. Run the DNS lookup so each one is listed with its TTL.');
      row('@', 'MX', 'not looked up', 'keep', 'Mail routing: left alone in a web move, unless the mailboxes turn out to live on the old web host.');
      row('@', 'TXT', 'not looked up', 'keep', 'SPF, DMARC and ownership verification: left alone.');
      row('@', 'NS', 'not looked up', c.changeNs ? 'change' : 'keep', c.changeNs ? 'Changed at the registrar, only after the complete zone exists at the new provider.' : 'The nameservers stay; only records inside the zone change.');
      return rows;
    }
    const A = R.apex || {}, W = R.www || {}, Z = R.zone || null, apex = A.name || c.dom;
    const fmt = r => `${r.data} (TTL ${r.ttl})`; const web = t => (c.proxied ? 'change' : t > 300 ? 'lower TTL first' : 'change');
    const pick = t => { const own = (A[t] || []); return own.length ? { list: own, name: '@' } : { list: (Z && Z[t]) || [], name: Z ? Z.name : '@' }; };
    (A.A || []).forEach(r => row('@', 'A', fmt(r), web(r.ttl), c.proxied ? 'A Cloudflare address: the public record stays. Edit the origin address inside Cloudflare.' : 'Becomes the new host\'s IPv4 address at cutover.'));
    (A.AAAA || []).forEach(r => { const edge = c.proxied && CF6.test(r.data); row('@', 'AAAA', fmt(r), edge ? 'keep' : web(r.ttl), edge ? 'Cloudflare\'s own IPv6 address for a proxied record: nothing to edit, unless the Cloudflare panel holds a real AAAA record for the old origin.' : 'Becomes the new host\'s IPv6 address, or is deleted if the new host has none.'); });
    (A.CNAME || []).filter(r => r.name === A.name).forEach(r => row('@', 'CNAME', fmt(r), web(r.ttl), 'Points the bare domain at another name: becomes the new host\'s target.'));
    const wcn = (W.CNAME || []).filter(r => r.name === W.name);
    wcn.forEach(r => { const cdnHit = CNAME_HINTS.find(([re, o]) => o.cdn && re.test(r.data)); if (r.data === apex) row('www', 'CNAME', fmt(r), 'keep', 'Follows the bare domain: nothing to change.'); else if (cdnHit) row('www', 'CNAME', fmt(r), 'review', `Points at ${cdnHit[1].cdn}: the origin behind it changes, not this record, unless the CDN is being dropped.`); else row('www', 'CNAME', fmt(r), web(r.ttl), 'Points at the old host\'s name: becomes the new host\'s target.'); });
    if (!wcn.length) { (W.A || []).forEach(r => row('www', 'A', fmt(r), web(r.ttl), c.proxied ? 'A Cloudflare address: the public record stays. Edit the origin address inside Cloudflare.' : (sum.web.wwwFollowsApex ? 'Same address as the bare domain: changes with it.' : 'A different address from the bare domain: confirm what serves www before changing it.'))); (W.AAAA || []).forEach(r => { const edge = c.proxied && CF6.test(r.data); row('www', 'AAAA', fmt(r), edge ? 'keep' : web(r.ttl), edge ? 'Cloudflare\'s own IPv6 address for a proxied record: nothing to edit.' : 'Becomes the new host\'s IPv6 address, or is deleted.'); }); }
    const mx = pick('MX');
    mx.list.forEach(r => { const follows = r.host === apex || r.host === 'www.' + apex; row(mx.name, 'MX', fmt(r), follows ? 'review' : 'keep', follows ? 'Names the domain itself, so mail follows the A record to the new web server. Give mail its own name pointing at the mail server before cutover.' : c.mailOnHost ? `Points at the old web host. Leave it in the web cutover: mail keeps working only while that account stays open (see the mail phase).` : 'Mail routing: not part of a web move.'); });
    Object.keys(R.mxHosts || {}).forEach(h => { if (h === apex || h === 'www.' + apex) return; row(h.endsWith('.' + apex) ? h.slice(0, -apex.length - 1) : h, 'A', (R.mxHosts[h] || []).join(', ') || 'no address', 'keep', 'The mail server\'s own address: leave it out of the web cutover.'); });
    const txt = pick('TXT');
    txt.list.forEach(r => { const d = r.data; const v = VERIFY_TXT.find(([re]) => re.test(d)); const short = d.length > 90 ? d.slice(0, 90) + '…' : d; if (/^v=spf1/i.test(d)) row(txt.name, 'TXT', `${short} (TTL ${r.ttl})`, 'keep', sum.email.spfUsesWebServer ? 'SPF, and it names the current web server: keep it at cutover, then add the new server or move the site to an SMTP service before forms send from the new host.' : 'SPF: says which servers may send mail for the domain.'); else row(txt.name, 'TXT', `${short} (TTL ${r.ttl})`, 'keep', v ? `Ownership verification for ${v[1]}.` : 'Purpose not recognized: keep it unless you know what it was for.'); });
    (R.dmarc && R.dmarc.length ? R.dmarc : (Z && Z.dmarc) || []).forEach(r => row('_dmarc', 'TXT', fmt(r), 'keep', 'DMARC policy for mail.'));
    if (c.hasMail) row('(selector)._domainkey', 'TXT or CNAME', 'not visible to a lookup without the selector name', 'keep', 'DKIM keys. They matter when nameservers change: copy each one from the old DNS panel.');
    const ns = pick('NS');
    if (ns.list.length) row(ns.name, 'NS', ns.list.map(r => r.data).sort().join(', '), c.changeNs ? 'change' : sum.dnsAtWebHost ? 'review' : 'keep', c.changeNs ? 'Changed at the registrar, only after the complete zone exists at the new provider, and not on the day the site moves.' : sum.dnsAtWebHost ? 'DNS is hosted with the old web hosting account: it goes when that account is closed. Move the zone before canceling.' : 'The nameservers stay; only records inside the zone change.');
    pick('SOA').list.forEach(r => row('@', 'SOA', `${r.mname} (serial ${r.serial})`, 'keep', 'Written by the DNS provider: nothing to edit.'));
    pick('CAA').list.forEach(r => row('@', 'CAA', fmt(r), 'review', 'Limits who may issue certificates: the new host\'s certificate authority has to be allowed.'));
    return rows;
  }
  const cell = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
  function markdown(p) {
    const L = [];
    L.push(`# ${p.title}`, '', p.summary, '');
    L.push(`- From: ${p.from || 'to be confirmed'}`, `- To: ${p.to || 'to be confirmed'}`, `- Platform: ${p.platform === 'wordpress' ? 'WordPress' : p.platform === 'static' ? 'a static site' : 'to be confirmed'}`, `- Copy method: ${METHOD_LABEL[p.method] || p.method}`, `- Cutover: ${p.launch ? `${p.launch.weekday}, ${p.launch.date}` : 'date open'}`, '');
    if (p.blockers.length) { L.push('## Settle these first', ''); p.blockers.forEach((b, i) => L.push(`${i + 1}. ${b}`)); L.push(''); }
    const open = p.unknowns.filter(u => !/^Blocking: /.test(u));
    if (open.length) { L.push('## Open questions', ''); open.forEach((u, i) => L.push(`${i + 1}. ${u}`)); L.push(''); }
    L.push('## Assumptions', ''); p.assumptions.forEach(a => L.push(`- ${a}`)); L.push('');
    L.push(`## The freeze`, '', `Level: ${p.freeze.level}. Starts ${p.freeze.starts}, ends ${p.freeze.ends}. Covers: ${p.freeze.covers.join('; ')}. ${p.freeze.why}`, '');
    p.phases.forEach((ph, i) => {
      L.push(`## Phase ${i + 1}: ${ph.name}`, '', `When: ${ph.when}`, '');
      ph.steps.forEach((s, k) => { L.push(`${k + 1}. ${s.do}`, `   - Why: ${s.why}`, `   - Check: ${s.verify}`, `   - Risk: ${s.risk}. Owner: ${s.owner}.`); });
      L.push('');
    });
    L.push('## DNS worksheet', '', '| Record | Type | Current | Action | Note |', '|---|---|---|---|---|');
    p.dnsWorksheet.forEach(r => L.push(`| ${cell(r.name)} | ${cell(r.type)} | ${cell(r.current)} | ${cell(r.action)} | ${cell(r.note)} |`)); L.push('');
    L.push('## Risks', '', '| Risk | What covers it |', '|---|---|'); p.risks.forEach(r => L.push(`| ${cell(r.risk)} | ${cell(r.mitigation)} |`)); L.push('');
    L.push('## Rollback', ''); p.rollback.forEach((r, i) => L.push(`${i + 1}. ${r}`)); L.push('');
    L.push('## After launch', ''); p.postLaunch.forEach(x => L.push(`- ${x.when}: ${x.check}`)); L.push('');
    return L.join('\n');
  }

  /* ============================ before and after ============================ */
  const ent = s => String(s == null ? '' : s).replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0*39;|&#x0*27;|&apos;/gi, "'").replace(/&#(\d+);/g, (m, n) => { try { return String.fromCodePoint(+n); } catch (e) { return m; } });
  const attrOf = (tag, name) => { const m = tag.match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? ent(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]) : null; };
  const tagsOf = (html, name) => html.match(new RegExp('<' + name + '\\b[^>]*>', 'gi')) || [];
  /* what a page says about itself, enough to tell whether a copy is the same page */
  function pageFacts(r, o) {
    o = o || {}; const html = String((r && r.text) || ''); const H = lowerKeys((r && r.headers) || {});
    const body = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ');
    const title = norm(ent(((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/<[^>]+>/g, ' ')));
    const metas = tagsOf(html, 'meta'); const meta = n => { const t = metas.find(x => lc(attrOf(x, 'name')) === n); return t ? norm(attrOf(t, 'content') || '') : ''; };
    const canonTag = tagsOf(html, 'link').find(x => /(^|\s)canonical(\s|$)/i.test(attrOf(x, 'rel') || ''));
    const h1 = norm(ent(((body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ' ')));
    const text = norm(ent(body.replace(/<head\b[\s\S]*?<\/head>/i, ' ').replace(/<title\b[\s\S]*?<\/title>/gi, ' ').replace(/<[^>]+>/g, ' ')));
    const robots = [meta('robots'), meta('googlebot'), H['x-robots-tag'] || ''].filter(Boolean).join(', ');
    const f = { status: r ? r.status : 0, finalUrl: (r && r.url) || '', ms: r && r.ms != null ? r.ms : null, title, description: meta('description'), canonical: canonTag ? (attrOf(canonTag, 'href') || '') : '', h1, words: text ? text.split(/\s+/).length : 0, robots, noindex: /noindex|\bnone\b/i.test(robots), tel: /href\s*=\s*["']?tel:/i.test(html), form: /<form\b/i.test(html), mixed: /^https:/i.test((r && r.url) || '') ? (html.match(/\s(?:src|srcset)\s*=\s*["']http:\/\//gi) || []).length : 0 };
    if (o.tempHosts && o.tempHosts.length) f.tempRefs = o.tempHosts.reduce((n, h) => n + (h ? html.split(h).length - 1 : 0), 0);
    return f;
  }
  const baseOf = b => { const o = D.originOf(b); if (!o) throw new D.net.NetError('Not a site address: ' + b, { code: 'bad_url' }); return o; };
  const cleanPaths = paths => uniq((paths && paths.length ? paths : ['/']).map(p => { p = String(p || '').trim(); if (/^https?:\/\//i.test(p)) { try { const u = new URL(p); p = u.pathname + u.search; } catch (e) { } } return p ? (p[0] === '/' ? p : '/' + p) : '/'; })).slice(0, 300);
  async function fetchFacts(base, path, o) {
    if (o.signal && o.signal.aborted) throw stopErr();
    try { const r = await o.http(base + path, { timeout: 25000, signal: o.signal, maxBytes: 900000 }); return pageFacts(r, o); }
    catch (e) { if (isStop(e)) throw e; return { status: 0, error: (e && e.message) || String(e) }; }
  }
  /* snapshot({base, paths, http, signal, concurrency}) → the before picture: [{path, ...facts}] */
  async function snapshot(o) {
    o = Object.assign({}, o || {}); o.http = o.http || http0; const base = baseOf(o.base || o.oldBase); const paths = cleanPaths(o.paths);
    const rows = await pool(paths, Math.max(1, Math.min(8, +o.concurrency || 4)), async p => Object.assign({ path: p }, await fetchFacts(base, p, o)));
    return { base, at: D.nowIso(), rows };
  }
  const pathOnly = (u, base) => { try { const x = new URL(u, base); return (x.pathname.replace(/\/+$/, '') || '/') + x.search; } catch (e) { return String(u || ''); } };
  function compare(path, a, b, c) {
    const issues = []; let sev = 0; const add = (s, text) => { issues.push(text); if (s > sev) sev = s; };
    if (b.error) add(3, `the new copy could not be reached: ${b.error}`);
    if (a.error) {
      add(1, a.missing ? 'this path is not in the before snapshot, so there is nothing to compare with' : `the old site could not be reached, so there is nothing to compare with: ${a.error}`);
      if (!b.error && b.status >= 400) add(2, `the new copy answers ${b.status}`);
      if (!b.error && b.noindex) add(3, `noindex on the new copy (${b.robots}): remove it before cutover or the page leaves search`);
    }
    if (a.error || b.error) return { issues, sev };
    if (a.status !== b.status) add(a.status < 400 && b.status >= 400 ? 3 : 2, `status ${a.status} on the old site, ${b.status} on the new copy`);
    if (b.status >= 400) return { issues, sev };
    if (b.noindex && !a.noindex) add(3, `noindex on the new copy (${b.robots}): remove it before cutover or the page leaves search`);
    if (pathOnly(a.finalUrl, c.oldBase) !== pathOnly(b.finalUrl, c.newBase)) add(2, `lands on a different path: ${pathOnly(a.finalUrl, c.oldBase)} before, ${pathOnly(b.finalUrl, c.newBase)} now`);
    if (norm(a.title) !== norm(b.title)) add(2, `title changed: "${a.title}" became "${b.title}"`);
    if (norm(a.description) !== norm(b.description)) add(1, b.description ? 'meta description changed' : 'meta description missing on the new copy');
    if (norm(a.h1) !== norm(b.h1)) add(1, `H1 changed: "${a.h1}" became "${b.h1}"`);
    const newHost = D.hostOf(c.newBase), oldHost = D.hostOf(c.oldBase);
    if (b.canonical) { const ch = D.hostOf(b.canonical); if (ch && ch === newHost && newHost !== oldHost) add(2, `the canonical on the new copy points at the temporary host ${ch}: expected while testing on a temporary URL, and it must read the live domain before cutover`); else if (a.canonical && pathOnly(a.canonical, c.oldBase) !== pathOnly(b.canonical, c.newBase)) add(2, `canonical changed: ${a.canonical} became ${b.canonical}`); }
    else if (a.canonical) add(2, 'canonical tag missing on the new copy');
    if (a.words > 30 && Math.abs(a.words - b.words) / a.words > 0.15) add(2, `content length changed: ${a.words} words before, ${b.words} now`);
    if (a.form && !b.form) add(2, 'the form is missing on the new copy');
    if (a.tel && !b.tel) add(2, 'the click to call link is missing on the new copy');
    if (b.mixed) add(1, `${b.mixed} resource${b.mixed === 1 ? '' : 's'} loaded over plain http on an https page (mixed content)`);
    if (b.tempRefs) add(1, `${b.tempRefs} reference${b.tempRefs === 1 ? '' : 's'} to a temporary host remain${b.tempRefs === 1 ? 's' : ''} in the page source`);
    if (a.ms != null && b.ms != null && b.ms > 800 && b.ms > a.ms * 2) add(1, `slower: ${a.ms} ms before, ${b.ms} ms now`);
    return { issues, sev };
  }
  /* verify({oldBase | before, newBase, paths, http, signal, concurrency, tempHosts}) → page by page, what differs.
     before is a snapshot (or its rows) taken earlier: the way to compare after cutover, when both sides share one domain. */
  async function verify(o) {
    o = Object.assign({}, o || {}); o.http = o.http || http0; const newBase = baseOf(o.newBase);
    const before = o.before ? (Array.isArray(o.before) ? o.before : o.before.rows || []) : null;
    const oldBase = o.oldBase ? baseOf(o.oldBase) : (o.before && o.before.base) || newBase;
    if (!before && !o.oldBase) throw new D.net.NetError('verify needs the old site: pass oldBase, or before (a snapshot taken earlier).', { code: 'bad_input' });
    const paths = cleanPaths(o.paths && o.paths.length ? o.paths : before ? before.map(r => r.path) : null);
    const byPath = {}; (before || []).forEach(r => { byPath[r.path] = r; });
    const rows = await pool(paths, Math.max(1, Math.min(8, +o.concurrency || 4)), async p => {
      const [a, b] = await Promise.all([before ? Promise.resolve(byPath[p] || { status: 0, error: 'not in the before snapshot', missing: true }) : fetchFacts(oldBase, p, o), fetchFacts(newBase, p, o)]);
      const c = compare(p, a, b, { oldBase, newBase });
      return { path: p, old: a, new: b, issues: c.issues, ok: !c.issues.length, severity: c.sev };
    });
    const bad = rows.filter(r => !r.ok).sort((x, y) => y.severity - x.severity || y.issues.length - x.issues.length);
    return { oldBase, newBase, at: D.nowIso(), rows, summary: { checked: rows.length, ok: rows.length - bad.length, issues: bad.length, unreachable: rows.filter(r => r.new && r.new.error).length, worst: bad.slice(0, 5).map(r => ({ path: r.path, issues: r.issues })) } };
  }

  /* ---------- short lists for the day itself ---------- */
  const CHECKLISTS = {
    'pre-cutover': { title: 'Before cutover day', items: ['Every login works: registrar, DNS, old host, new host, site admin.', 'A full backup exists outside both hosts and has been restored once.', 'The mail decision is made and written down; MX and TXT records are saved.', 'TTLs on the web records were lowered to 300 seconds at least one old TTL ago.', 'The copy passes the walk through under its real name (hosts file) or on the temporary URL.', 'No noindex on the copy; robots.txt is the live one.', 'The before snapshot of every URL is saved.', 'A certificate for the domain and www is ready, or the plan for the first minutes is agreed.', 'Tags, call tracking and form notifications work on the copy.', 'The rollback trigger and the person who decides are agreed.'] },
    cutover: { title: 'Cutover', items: ['Start the freeze and write down the time and the last order or form entry.', 'Run the final sync and confirm the newest item exists on the new host.', 'Change only the web records (or the origin address behind a proxy).', 'Confirm the new address from two public resolvers.', 'Check the padlock and the www redirect.', 'Purge every cache layer.', 'Run the before against after comparison.', 'Send a test lead and place a test call.', 'Send a test message to an address at the domain.', 'End the freeze and write down the time.'] },
    'post-cutover': { title: 'After cutover', items: ['Uptime monitoring is on for 72 hours with alerts to a phone.', 'Backups and scheduled jobs ran on the new host.', 'Search Console still shows the property verified; the sitemap is resubmitted.', 'Leads, calls and conversions match the same weekdays before the move, checked daily for a week.', 'TTLs are raised again after a quiet week.', 'The old host\'s access log is quiet before the account is canceled, 14 to 30 days on.', 'The final backup is stored outside both hosts.', 'Temporary migration accounts are removed and shared passwords changed.'] },
  };
  function checklist(kind) { if (kind == null) return Object.keys(CHECKLISTS); const c = CHECKLISTS[lc(kind)]; return c ? { kind: lc(kind), title: c.title, items: c.items.map((text, i) => ({ id: `${lc(kind)}-${i + 1}`, text })) } : null; }

  D.hosting = { DOH_HOSTS, TYPES, HOSTS, cleanDomain, dnsLookup, interpret, fingerprint, fingerprintUrl, plan, markdown, snapshot, verify, pageFacts, checklist, hostByName };
})();
