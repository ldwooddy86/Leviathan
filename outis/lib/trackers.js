/* The tracker list behind rules/trackers.json (tools/build.mjs writes the JSON from this file).
   Every rule matches only third-party requests: visiting one of these companies' own sites still works, but their
   scripts, pixels and beacons do not load on anyone else's pages. A domain covers its subdomains.
   Deliberately left out: content hosts and CDNs, consent banners, captchas and the fraud-prevention services banks
   and stores run at sign-in and checkout, because blocking those makes the sites refuse you.
   Rule ids: category id * 100 + n; surrogates (harmless stand-ins for scripts sites wait on) 900 and up. */
export const CATEGORIES = [
  {
    id: 1, key: 'analytics', label: 'Analytics',
    domains: [
      'google-analytics.com', 'analytics.google.com', 'googletagmanager.com',
      'mixpanel.com', 'mxpnl.com', 'mxpnl.net', 'amplitude.com', 'heapanalytics.com', 'segment.io', 'segment.com',
      'kissmetrics.io', 'kissmetrics.com', 'chartbeat.com', 'chartbeat.net', 'parsely.com', 'parse.ly',
      'quantserve.com', 'quantcount.com', 'scorecardresearch.com', 'nr-data.net', 'js-agent.newrelic.com',
      'browser-intake-datadoghq.com', 'browser-intake-datadoghq.eu', 'browser-intake-us3-datadoghq.com',
      'browser-intake-us5-datadoghq.com', 'browser-intake-ap1-datadoghq.com',
      'statcounter.com', 'histats.com', 'getclicky.com', 'woopra.com', 'piwik.pro', 'matomo.cloud',
      'mc.yandex.ru', 'mc.yandex.com', 'hm.baidu.com', 'cnzz.com', 'top-fwz1.mail.ru',
      'bat.bing.com', 'demdex.net', 'omtrdc.net', '2o7.net', 'everesttech.net', 'tealiumiq.com', 'pendo.io',
      'logx.optimizely.com', 'appsflyer.com', 'kochava.com', 'hs-analytics.net', 'track.hubspot.com',
      'hscollectedforms.net', 'munchkin.marketo.net', 'pi.pardot.com', 'evgnet.com', 'trackcmp.net',
      'static.cloudflareinsights.com', 'pixel.wp.com', 'stats.wp.com', 'i.posthog.com'
    ],
    paths: []
  },
  {
    id: 2, key: 'ads', label: 'Advertising',
    domains: [
      'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'googletagservices.com',
      'adservice.google.com', 'adservice.google.ca', 'adservice.google.co.uk', 'adservice.google.de',
      'adservice.google.fr', 'adservice.google.com.au', 'adservice.google.co.in', 'adservice.google.co.jp',
      'adservice.google.es', 'adservice.google.it', 'adservice.google.nl', 'adservice.google.com.br',
      'adservice.google.com.mx',
      'amazon-adsystem.com', 'adnxs.com', 'adnxs-simple.com', 'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com',
      'rubiconproject.com', 'pubmatic.com', 'openx.net', 'casalemedia.com', 'indexww.com', 'bidswitch.net',
      'mathtag.com', 'media.net', 'moatads.com', 'doubleverify.com', 'adsafeprotected.com', '3lift.com',
      'sharethrough.com', 'smartadserver.com', 'teads.tv', 'yieldmo.com', 'gumgum.com', 'sovrn.com', 'lijit.com',
      '33across.com', 'contextweb.com', 'adform.net', 'adition.com', 'serving-sys.com', 'flashtalking.com',
      'ads.yahoo.com', 'analytics.yahoo.com', 'gemini.yahoo.com', 'advertising.com', 'zemanta.com', 'revcontent.com',
      'mgid.com', 'adroll.com', 'perfectaudience.com', 'rfihub.com', 'turn.com', 'dotomi.com', 'conversantmedia.com',
      'yieldlab.net', 'adscale.de', 'ads.linkedin.com', 'ads-twitter.com', 'adsrvr.org', 'bounceexchange.com',
      'bouncex.net', 'smaato.net', 'spotxchange.com', 'springserve.com', 'tremorhub.com', 'undertone.com',
      'onetag-sys.com', 'e-planning.net', 'emxdgt.com', 'richaudience.com', 'improvedigital.com', 'adkernel.com',
      'lkqd.net', 'innovid.com', 'zedo.com', 'adblade.com', 'popads.net', 'propellerads.com', 'exoclick.com',
      'rtbhouse.com', 'hsadspixel.net'
    ],
    paths: ['||google.com/pagead/', '||google.com/ads/']
  },
  {
    id: 3, key: 'social', label: 'Social media trackers',
    domains: [
      'connect.facebook.net', 'analytics.tiktok.com', 'tr.snapchat.com', 'ct.pinterest.com', 'q.quora.com',
      'alb.reddit.com', 'pixel-config.reddit.com', 'events.redditmedia.com', 'snap.licdn.com', 'analytics.twitter.com'
    ],
    paths: ['||facebook.com/tr^', '||twitter.com/i/adsct', '||x.com/i/adsct', '||s.pinimg.com/ct/',
      '||sc-static.net/scevent', '||redditstatic.com/ads/', '||linkedin.com/li/track']
  },
  {
    id: 4, key: 'identity', label: 'Fingerprinting and identity',
    domains: [
      'fpjs.io', 'fpcdn.io', 'fpnpmcdn.net', 'openfpcdn.io', 'fpapi.io',
      'id5-sync.com', 'liadm.com', 'rlcdn.com', 'pippio.com', 'tapad.com', 'crwdcntrl.net', 'bluekai.com', 'krxd.net',
      'exelator.com', 'agkn.com', 'eyeota.net', 'zeotap.com', 'uidapi.com', 'intentiq.com', 'semasio.net',
      'mediarithmics.com', 'permutive.com', 'permutive.app', 'sddan.com', 'hadronid.net', 'sharethis.com',
      '6sc.co', '6sense.com', 'clearbitscripts.com', 'clearbitjs.com', 'reveal.clearbit.com', 'demandbase.com',
      'company-target.com', 'zi-scripts.com', 'ws.zoominfo.com', 'lfeeder.com', 'leadfeeder.com', 'albacross.com',
      'ml314.com', 'getkoala.com', 'getwarmly.com'
    ],
    paths: []
  },
  {
    id: 5, key: 'replay', label: 'Session recording',
    domains: [
      'hotjar.com', 'hotjar.io', 'mouseflow.com', 'fullstory.com', 'clarity.ms', 'crazyegg.com', 'inspectlet.com',
      'luckyorange.com', 'luckyorange.net', 'smartlook.com', 'smartlook.cloud', 'logrocket.com', 'logrocket.io',
      'lr-ingest.io', 'lr-in.com', 'lr-ingest.com', 'quantummetric.com', 'contentsquare.net', 'decibelinsight.net',
      'glassboxdigital.io', 'sessioncam.com', 'clicktale.net', 'mc.webvisor.org', 'mc.webvisor.com'
    ],
    paths: []
  }
];

/* Scripts that some pages wait on before a link or a form works. Blocking them outright can leave a button dead,
   so these are answered with a small do-nothing stand-in from surrogates/ that still runs the page's callbacks. */
export const SURROGATES = [
  { id: 901, category: 1, domain: 'googletagmanager.com', path: '/gtm.js', file: 'surrogates/gtm.js' },
  { id: 902, category: 1, domain: 'googletagmanager.com', path: '/gtag/js', file: 'surrogates/gtag.js' },
  { id: 903, category: 1, domain: 'google-analytics.com', path: '/analytics.js', file: 'surrogates/analytics.js' },
  { id: 904, category: 2, domain: 'doubleclick.net', path: '/tag/js/gpt.js', file: 'surrogates/gpt.js' },
  { id: 905, category: 2, domain: 'googletagservices.com', path: '/tag/js/gpt.js', file: 'surrogates/gpt.js' }
];

/* Every request type except the page itself, so a tracker's own site still opens when you go there. */
export const SUBRESOURCE_TYPES = ['sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping',
  'csp_report', 'media', 'websocket', 'webtransport', 'webbundle', 'other'];

export function trackerRules() {
  const rules = [];
  for (const c of CATEGORIES) {
    rules.push({
      id: c.id * 100, priority: 1, action: { type: 'block' },
      condition: { requestDomains: [...c.domains], domainType: 'thirdParty', resourceTypes: SUBRESOURCE_TYPES }
    });
    c.paths.forEach((p, i) => rules.push({
      id: c.id * 100 + 1 + i, priority: 1, action: { type: 'block' },
      condition: { urlFilter: p, domainType: 'thirdParty', resourceTypes: SUBRESOURCE_TYPES }
    }));
  }
  for (const s of SURROGATES) {
    rules.push({
      id: s.id, priority: 2, action: { type: 'redirect', redirect: { extensionPath: '/' + s.file } },
      condition: { requestDomains: [s.domain], urlFilter: s.path, domainType: 'thirdParty', resourceTypes: ['script'] }
    });
  }
  return rules;
}

/* Rule id → category key, for the popup's breakdown. */
export function categoryOfRule(id) {
  const s = SURROGATES.find(x => x.id === id);
  const cid = s ? s.category : Math.floor(id / 100);
  const c = CATEGORIES.find(x => x.id === cid);
  return c ? c.key : null;
}

/* The category of a blocked address, or null when it is not on this list (another blocker's work). Used for the
   per-tab count, which is taken from blocked requests rather than from every rule match. */
const PATH_RULES = [];
for (const c of CATEGORIES) {
  for (const p of c.paths) { const m = /^\|\|([^/^]+)(\/[^^]*)\^?$/.exec(p); if (m) PATH_RULES.push({ host: m[1], path: m[2], key: c.key }); }
}
export function categoryOfUrl(url) {
  let u;
  try { u = new URL(url); } catch (e) { return null; }
  const host = u.hostname.toLowerCase(), rest = u.pathname + u.search;
  const within = d => host === d || host.endsWith('.' + d);
  for (const s of SURROGATES) if (within(s.domain) && rest.includes(s.path)) return CATEGORIES.find(c => c.id === s.category).key;
  for (const c of CATEGORIES) if (c.domains.some(within)) return c.key;
  for (const r of PATH_RULES) if (within(r.host) && rest.startsWith(r.path)) return r.key;
  return null;
}

export function domainCount() {
  return CATEGORIES.reduce((n, c) => n + c.domains.length + c.paths.length, 0);
}

/* ---- tracking parameters (rules/params.json) ----
   Click identifiers and campaign tags that ad networks and mail tools append to links so the destination can tie
   your visit back to who you are. Removed from page and frame addresses before the request leaves the browser. */
export const PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'utm_source_platform',
  'utm_creative_format', 'utm_marketing_tactic', 'utm_name', 'utm_cid', 'utm_reader', 'utm_referrer', 'utm_social',
  'utm_social-type', 'utm_brand', 'utm_viz_id', 'utm_pubreferrer', 'utm_swu',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid', 'srsltid', 'msclkid',
  'yclid', 'ysclid', 'ttclid', 'twclid', 'li_fat_id', 'igshid', 'igsh', 'epik', 'rdt_cid', 'ScCid',
  'mc_cid', 'mc_eid', 'mkt_tok', '_hsenc', '_hsmi', '__hssc', '__hstc', '__hsfp', 'hsCtaTracking',
  'oly_anon_id', 'oly_enc_id', 'rb_clickid', 's_cid', 's_kwcid', 'ef_id', 'vero_id', 'vero_conv', 'wickedid',
  '_kx', '_branch_match_id', '_branch_referrer', 'irclickid', '_gl', '_ga', '__s', 'ss_email_id',
  'bsft_clkid', 'bsft_uid', 'bsft_eid', 'ml_subscriber', 'ml_subscriber_hash', 'trk_contact', 'trk_msg', 'trk_module',
  'trk_sid', 'gdfms', 'gdftrk', 'gdffi', '_bta_tid', '_bta_c', 'dm_i', '_openstat',
  'pk_campaign', 'pk_kwd', 'pk_source', 'pk_medium', 'pk_content', 'mtm_campaign', 'mtm_keyword', 'mtm_source',
  'mtm_medium', 'mtm_content', 'mtm_cid', 'mtm_group', 'mtm_placement',
  'ns_source', 'ns_mchannel', 'ns_campaign', 'ns_linkname', 'ns_fee', 'oft_id', 'oft_k', 'oft_lk', 'oft_d', 'oft_c',
  'oft_ck', 'oft_ids', 'oft_sk'
];

/* Chrome compiles each rule's regular expression within a 2 KB budget, which one expression over all of these
   parameters exceeds (16 names already do), so they are matched ten at a time. Every rule removes all of them, so
   a single redirect cleans the whole address. */
export const PARAMS_PER_RULE = 10;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function paramRules() {
  const rules = [];
  for (let i = 0; i < PARAMS.length; i += PARAMS_PER_RULE) {
    const chunk = PARAMS.slice(i, i + PARAMS_PER_RULE);
    rules.push({
      id: rules.length + 1, priority: 1,
      action: { type: 'redirect', redirect: { transform: { queryTransform: { removeParams: PARAMS } } } },
      condition: { regexFilter: '[?&](?:' + chunk.map(esc).join('|') + ')=', isUrlFilterCaseSensitive: true, resourceTypes: ['main_frame', 'sub_frame'] }
    });
  }
  return rules;
}
