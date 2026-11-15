# Crawl & Index audit — midwestpest.com

Generated 2026-11-15T08:44:39Z by UltimaWeapon google_crawler/1.0 (honest mode: declared UA, robots.txt obeyed, rate-limited). 30 page(s) fetched; 94 URL(s) in 1 sitemap file(s); link-graph discovery ON.

## Index status of fetched URLs

- indexable: 29
- noindex: 1
- crawl depth histogram (from the homepage over observed links): 0:1, 1:27

## Sitemaps

- https://midwestpest.com/sitemap.xml — urlset, status 200, 94 entries (guess)
- note: sitemap sample: 29 URLs chosen round-robin across 64 URL families

## Findings (severity-ranked)

### High — NOINDEX_IN_SITEMAP (1)

A sitemap lists a URL that says noindex. Fix: either index it (remove noindex) or drop it from the sitemap; sitemaps list indexable finals only.

- https://midwestpest.com/pest-control-omaha — noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate

### Low — LONG_TITLE (27)

Title longer than 70 characters. Fix: shorten to roughly 60 characters.

- https://midwestpest.com/ — 98 chars: Omaha, NE Pest Control Exterminators | Midwest Pest Control | Exterminators | Pest Control
- https://midwestpest.com/pest-control-altoona — 111 chars: Eco-Friendly Pest Control in Altoona, IA | Rodent Control, Mosquito Control, Ant Control |
- https://midwestpest.com/pest-control-ames — 108 chars: Eco-Friendly Pest Control in Ames, IA | Rodent Control, Mosquito Control, Ant Control | Mi
- https://midwestpest.com/pest-control-ankeny — 110 chars: Eco-Friendly Pest Control in Ankeny, IA | Rodent Control, Mosquito Control, Ant Control | 
- https://midwestpest.com/pest-control-bellevue — 112 chars: Eco-Friendly Pest Control in Bellevue, NE | Rodent Control, Mosquito Control, Ant Control 
- https://midwestpest.com/pest-control-bennington — 114 chars: Eco-Friendly Pest Control in Bennington, NE | Rodent Control, Mosquito Control, Ant Contro
- https://midwestpest.com/pest-control-cedar-rapids — 116 chars: Eco-Friendly Pest Control in Cedar Rapids, IA | Rodent Control, Mosquito Control, Ant Cont
- https://midwestpest.com/pest-control-clive — 109 chars: Eco-Friendly Pest Control in Clive, IA | Rodent Control, Mosquito Control, Ant Control | M
- https://midwestpest.com/pest-control-council-bluffs — 118 chars: Eco-Friendly Pest Control in Council Bluffs, IA | Rodent Control, Mosquito Control, Ant Co
- https://midwestpest.com/pest-control-des-moines — 114 chars: Eco-Friendly Pest Control in Des Moines, IA | Rodent Control, Mosquito Control, Ant Contro
- https://midwestpest.com/pest-control-elkhorn — 111 chars: Eco-Friendly Pest Control in Elkhorn, NE | Rodent Control, Mosquito Control, Ant Control |
- https://midwestpest.com/pest-control-fremont — 111 chars: Eco-Friendly Pest Control in Fremont, NE | Rodent Control, Mosquito Control, Ant Control |
- https://midwestpest.com/pest-control-gretna — 110 chars: Eco-Friendly Pest Control in Gretna, NE | Rodent Control, Mosquito Control, Ant Control | 
- https://midwestpest.com/pest-control-indianola — 113 chars: Eco-Friendly Pest Control in Indianola, IA | Rodent Control, Mosquito Control, Ant Control
- https://midwestpest.com/pest-control-iowa-city — 113 chars: Eco-Friendly Pest Control in Iowa City, IA | Rodent Control, Mosquito Control, Ant Control
- https://midwestpest.com/pest-control-johnston — 112 chars: Eco-Friendly Pest Control in Johnston, IA | Rodent Control, Mosquito Control, Ant Control 
- https://midwestpest.com/pest-control-la-vista — 112 chars: Eco-Friendly Pest Control in La Vista, NE | Rodent Control, Mosquito Control, Ant Control 
- https://midwestpest.com/pest-control-lincoln — 107 chars: Eco-Friendly Pest Control in Lincoln, NE | Rodent Control, Mosquito Control, Near Me | Mid
- https://midwestpest.com/pest-control-marion — 110 chars: Eco-Friendly Pest Control in Marion, IA | Rodent Control, Mosquito Control, Ant Control | 
- https://midwestpest.com/pest-control-newton — 110 chars: Eco-Friendly Pest Control in Newton, IA | Rodent Control, Mosquito Control, Ant Control | 
- https://midwestpest.com/pest-control-norwalk — 111 chars: Eco-Friendly Pest Control in Norwalk, IA | Rodent Control, Mosquito Control, Ant Control |
- https://midwestpest.com/pest-control-papillion — 113 chars: Eco-Friendly Pest Control in Papillion, NE | Rodent Control, Mosquito Control, Ant Control
- https://midwestpest.com/pest-control-urbandale — 113 chars: Eco-Friendly Pest Control in Urbandale, IA | Rodent Control, Mosquito Control, Ant Control
- https://midwestpest.com/pest-control-waterloo — 112 chars: Eco-Friendly Pest Control in Waterloo, IA | Rodent Control, Mosquito Control, Ant Control 
- https://midwestpest.com/pest-control-waukee — 110 chars: Eco-Friendly Pest Control in Waukee, IA | Rodent Control, Mosquito Control, Ant Control | 
- … 2 more in findings.csv

### Low — ORPHAN_CANDIDATE (2)

In the sitemap, no internal link seen — the link graph was NOT crawled fully, so this is a candidate. Fix: re-run with --follow-links and a larger --max-pages to confirm.

- https://midwestpest.com/blog/how-prevent-rodent-infestations-winter — no internal in-link among 30 fetched pages (coverage 32% of sitemap)
- https://midwestpest.com/slate — no internal in-link among 30 fetched pages (coverage 32% of sitemap)

### Info — NOINDEX_FOLLOWED_LINKS (1)

Noindex page (informational) — crawlable but excluded. Fix: confirm intentional.

- https://midwestpest.com/pest-control-omaha — noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate

## Ground truth this crawl cannot see — GSC URL Inspection (verify task for the owner)

1. Open Google Search Console for the verified property. 2. Paste each URL flagged High or Medium above into the URL Inspection bar. 3. Record: 'URL is on Google' / 'not on Google', the Coverage reason, 'User-declared canonical' vs 'Google-selected canonical', last crawl date, and 'Crawl allowed? / Indexing allowed?'. 4. Use TEST LIVE URL and VIEW CRAWLED PAGE to compare Google's rendered HTML with the raw HTML this crawl saw (JS-dependent content shows up here). 5. Export Pages (Indexing) report: 'Crawled - currently not indexed', 'Discovered - currently not indexed', 'Duplicate without user-selected canonical', 'Alternate page with proper canonical tag', 'Not found (404)', 'Soft 404', 'Excluded by noindex', 'Blocked by robots.txt'. These rows close the Crawl & Index findings as CONFIRMED / CLEARED.

Presence: Presence DECLARED (honest mode): every request identified the tool truthfully as 'OmegaWeapon/1.0 (declared site-audit bot; obeys robots.txt)' over a plain Python HTTP client — no browser impersonation, no TLS-fingerprint spoofing, no fabricated referer. robots.txt was obeyed; requests were rate-limited to >=2.0s per host with Retry-After honored and 429/5xx backed off, and a conditional on-disk cache avoided re-fetches (0 path(s) skipped as robots-disallowed, 2 served from cache). A wall (WAF / 403 / CAPTCHA) is recorded NOT_TESTED and never worked around.
