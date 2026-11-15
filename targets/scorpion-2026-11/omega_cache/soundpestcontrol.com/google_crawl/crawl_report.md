# Crawl & Index audit — www.soundpestcontrol.com

Generated 2026-11-15T08:43:13Z by UltimaWeapon google_crawler/1.0 (honest mode: declared UA, robots.txt obeyed, rate-limited). 30 page(s) fetched; 62 URL(s) in 1 sitemap file(s); link-graph discovery ON.

## Index status of fetched URLs

- indexable: 27
- noindex: 2
- redirected: 1
- crawl depth histogram (from the homepage over observed links): 0:2, 1:18, 2:8

## Sitemaps

- https://www.soundpestcontrol.com/sitemap.xml — urlset, status 200, 62 entries (guess)
- note: sitemap sample: 29 URLs chosen round-robin across 38 URL families

## Findings (severity-ranked)

### High — NOINDEX_IN_SITEMAP (2)

A sitemap lists a URL that says noindex. Fix: either index it (remove noindex) or drop it from the sitemap; sitemaps list indexable finals only.

- https://www.soundpestcontrol.com/learning-center — noindex, nofollow
- https://www.soundpestcontrol.com/thank-you — noindex, nofollow

### Medium — SITEMAP_REDIRECT (1)

A sitemap lists a URL that redirects. Fix: list the final URL instead.

- https://www.soundpestcontrol.com/node/12 — 1 hop(s) -> https://www.soundpestcontrol.com/

### Low — LONG_TITLE (17)

Title longer than 70 characters. Fix: shorten to roughly 60 characters.

- https://www.soundpestcontrol.com/ — 74 chars: Pest Control in the Puget Sound | No-Contract Options | Sound Pest Control
- https://www.soundpestcontrol.com/ant-control/bremerton-wa — 112 chars: Ant Control in Bremerton, WA | Sound Pest Control | Ant Exterminator, Ant Control Near Me,
- https://www.soundpestcontrol.com/bed-bug-extermination/bremerton-wa — 160 chars: Bed Bug Exterminator in Bremerton, WA - Get $100 Off | Sound Pest Control | Bed Bug Treatm
- https://www.soundpestcontrol.com/bed-bug-exterminator/tacoma-wa — 100 chars: Get $100 Off Bed Bug Extermination in Tacoma, WA | 100% Satisfaction Guaranteed | Sound Pe
- https://www.soundpestcontrol.com/mole-control/bremerton-wa — 75 chars: Mole Control in Bremerton | Sound Pest Control | Mole Removal, Mole Problem
- https://www.soundpestcontrol.com/pest-control-bainbridge-island — 161 chars: Pest Control in Bainbridge Island, WA | No-Contracts | Sound Pest Control | Bed Bug Exterm
- https://www.soundpestcontrol.com/pest-control-belfair — 151 chars: Pest Control in Belfair, WA | No-Contracts | Sound Pest Control | Bed Bug Exterminator, Ro
- https://www.soundpestcontrol.com/pest-control-bremerton — 139 chars: Pest Control in Bremerton, WA | No-Contracts | Sound Pest Control | Exterminator in Bremer
- https://www.soundpestcontrol.com/pest-control-gig-harbor — 154 chars: Pest Control in Gig Harbor, WA | No-Contracts | Sound Pest Control | Bed Bug Exterminator,
- https://www.soundpestcontrol.com/pest-control-kingston — 152 chars: Pest Control in Kingston, WA | No-Contracts | Sound Pest Control | Bed Bug Exterminator, R
- https://www.soundpestcontrol.com/pest-control-port-hadlock-irondale — 165 chars: Pest Control in Port Hadlock-Irondale, WA | No-Contracts | Sound Pest Control | Bed Bug Ex
- https://www.soundpestcontrol.com/pest-control-port-orchard — 156 chars: Pest Control in Port Orchard, WA | No-Contracts | Sound Pest Control | Bed Bug Exterminato
- https://www.soundpestcontrol.com/pest-control-port-townsend — 157 chars: Pest Control in Port Townsend, WA | No-Contracts | Sound Pest Control | Bed Bug Exterminat
- https://www.soundpestcontrol.com/pest-control-poulsbo — 151 chars: Pest Control in Poulsbo, WA | No-Contracts | Sound Pest Control | Bed Bug Exterminator, Ro
- https://www.soundpestcontrol.com/pest-control-silverdale — 154 chars: Pest Control in Silverdale, WA | No-Contracts | Sound Pest Control | Bed Bug Exterminator,
- https://www.soundpestcontrol.com/pest-control-tacoma — 149 chars: Pest Control in Tacoma, WA | No-Contracts | Sound Pest Control | Pest Control Near Me, Ext
- https://www.soundpestcontrol.com/rodent-control/bremerton-wa — 161 chars: Rodent Control in Bremerton, WA | Rodent Exterminator Near Me, Rodent Control Near Me, Rod

### Low — ORPHAN_CANDIDATE (2)

In the sitemap, no internal link seen — the link graph was NOT crawled fully, so this is a candidate. Fix: re-run with --follow-links and a larger --max-pages to confirm.

- https://www.soundpestcontrol.com/redeem-offer — no internal in-link among 30 fetched pages (coverage 48% of sitemap)
- https://www.soundpestcontrol.com/thank-you — no internal in-link among 30 fetched pages (coverage 48% of sitemap)

### Info — NOINDEX_FOLLOWED_LINKS (2)

Noindex page (informational) — crawlable but excluded. Fix: confirm intentional.

- https://www.soundpestcontrol.com/learning-center — noindex, nofollow
- https://www.soundpestcontrol.com/thank-you — noindex, nofollow

## Ground truth this crawl cannot see — GSC URL Inspection (verify task for the owner)

1. Open Google Search Console for the verified property. 2. Paste each URL flagged High or Medium above into the URL Inspection bar. 3. Record: 'URL is on Google' / 'not on Google', the Coverage reason, 'User-declared canonical' vs 'Google-selected canonical', last crawl date, and 'Crawl allowed? / Indexing allowed?'. 4. Use TEST LIVE URL and VIEW CRAWLED PAGE to compare Google's rendered HTML with the raw HTML this crawl saw (JS-dependent content shows up here). 5. Export Pages (Indexing) report: 'Crawled - currently not indexed', 'Discovered - currently not indexed', 'Duplicate without user-selected canonical', 'Alternate page with proper canonical tag', 'Not found (404)', 'Soft 404', 'Excluded by noindex', 'Blocked by robots.txt'. These rows close the Crawl & Index findings as CONFIRMED / CLEARED.

Presence: Presence DECLARED (honest mode): every request identified the tool truthfully as 'OmegaWeapon/1.0 (declared site-audit bot; obeys robots.txt)' over a plain Python HTTP client — no browser impersonation, no TLS-fingerprint spoofing, no fabricated referer. robots.txt was obeyed; requests were rate-limited to >=2.0s per host with Retry-After honored and 429/5xx backed off, and a conditional on-disk cache avoided re-fetches (0 path(s) skipped as robots-disallowed, 2 served from cache). A wall (WAF / 403 / CAPTCHA) is recorded NOT_TESTED and never worked around.
