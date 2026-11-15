# Crawl & Index audit — www.arlinghausair.com

Generated 2026-11-15T08:48:54Z by UltimaWeapon google_crawler/1.0 (honest mode: declared UA, robots.txt obeyed, rate-limited). 30 page(s) fetched; 257 URL(s) in 8 sitemap file(s); link-graph discovery ON.

## Index status of fetched URLs

- indexable: 30
- crawl depth histogram (from the homepage over observed links): 0:1, 1:1, 2:4, 3:2, 4:2, 5:2

## Sitemaps

- https://www.arlinghausair.com/sitemap_index.xml — index, status 200, 9 entries (robots.txt)
- https://www.arlinghausair.com/sitemap.xml — index, status 200, 9 entries (guess)
- https://www.arlinghausair.com/wp-sitemap.xml — index, status 200, 9 entries (guess)
- https://www.arlinghausair.com/post-sitemap.xml — urlset, status 200, 151 entries (index:https://www.arlinghausair.com/sitemap_index.xml)
- https://www.arlinghausair.com/page-sitemap.xml — urlset, status 200, 72 entries (index:https://www.arlinghausair.com/sitemap_index.xml)
- https://www.arlinghausair.com/case-study-sitemap.xml — urlset, status 200, 9 entries (index:https://www.arlinghausair.com/sitemap_index.xml)
- https://www.arlinghausair.com/cooling-service-sitemap.xml — urlset, status 200, 7 entries (index:https://www.arlinghausair.com/sitemap_index.xml)
- https://www.arlinghausair.com/electrical-service-sitemap.xml — urlset, status 200, 21 entries (index:https://www.arlinghausair.com/sitemap_index.xml)
- note: sitemap fetch cap (--max-sitemaps 10) reached; 22 sitemap(s) not read
- note: sitemap sample: 29 URLs chosen round-robin across 176 URL families

## Findings (severity-ranked)

### Low — DEEP_PAGE (4)

Four or more clicks from the homepage. Fix: flatten the path: link from a hub, category or the homepage.

- https://www.arlinghausair.com/furnace-safety/ — depth 5
- https://www.arlinghausair.com/how-much-does-a-new-furnace-cost/ — depth 5
- https://www.arlinghausair.com/how-often-should-you-change-your-furnace-filter/ — depth 4
- https://www.arlinghausair.com/how-to-cope-with-dry-indoor-air-during-winter/ — depth 4

### Low — LONG_TITLE (4)

Title longer than 70 characters. Fix: shorten to roughly 60 characters.

- https://www.arlinghausair.com/furnace-not-working-try-tips-calling-pros-old/ — 73 chars: Furnace Not Working? Try These Tips Before Calling the Pros. - Arlinghaus
- https://www.arlinghausair.com/furnace-repair-cost-cincinnati/ — 94 chars: Furnace Repair Cost in Cincinnati: 2026 Price Guide by Repair Type, Age, and Fuel - Arling
- https://www.arlinghausair.com/furnace-safety/ — 79 chars: Furnace Safety: What Every Northern Kentucky Homeowner Should Know - Arlinghaus
- https://www.arlinghausair.com/signs-your-home-may-have-hard-water-and-what-to-do-about-it/ — 74 chars: Signs Your Home May Have Hard Water – And What to Do About It - Arlinghaus

### Low — ORPHAN_CANDIDATE (12)

In the sitemap, no internal link seen — the link graph was NOT crawled fully, so this is a candidate. Fix: re-run with --follow-links and a larger --max-pages to confirm.

- https://www.arlinghausair.com/9-ways-get-air-conditioner-running-efficiently-spring/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)
- https://www.arlinghausair.com/ac-replacement-5-things-know-dont-waste-money/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)
- https://www.arlinghausair.com/does-a-heat-pump-increase-home-value-and-energy-savings/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)
- https://www.arlinghausair.com/how-long-do-air-conditioners-last/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)
- https://www.arlinghausair.com/how-long-do-furnaces-last/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)
- https://www.arlinghausair.com/how-much-is-a-new-air-conditioner/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)
- https://www.arlinghausair.com/show-your-hvac-a-little-tlc/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)
- https://www.arlinghausair.com/signs-your-home-may-have-hard-water-and-what-to-do-about-it/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)
- https://www.arlinghausair.com/what-is-a-good-seer-rating-and-why-is-it-important/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)
- https://www.arlinghausair.com/what-is-high-efficiency-furnace-venting-what-you-need-to-know/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)
- https://www.arlinghausair.com/what-is-included-in-a-furnace-tune-up/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)
- https://www.arlinghausair.com/why-is-my-air-conditioner-making-noise/ — no internal in-link among 30 fetched pages (coverage 12% of sitemap)

## Ground truth this crawl cannot see — GSC URL Inspection (verify task for the owner)

1. Open Google Search Console for the verified property. 2. Paste each URL flagged High or Medium above into the URL Inspection bar. 3. Record: 'URL is on Google' / 'not on Google', the Coverage reason, 'User-declared canonical' vs 'Google-selected canonical', last crawl date, and 'Crawl allowed? / Indexing allowed?'. 4. Use TEST LIVE URL and VIEW CRAWLED PAGE to compare Google's rendered HTML with the raw HTML this crawl saw (JS-dependent content shows up here). 5. Export Pages (Indexing) report: 'Crawled - currently not indexed', 'Discovered - currently not indexed', 'Duplicate without user-selected canonical', 'Alternate page with proper canonical tag', 'Not found (404)', 'Soft 404', 'Excluded by noindex', 'Blocked by robots.txt'. These rows close the Crawl & Index findings as CONFIRMED / CLEARED.

Presence: Presence DECLARED (honest mode): every request identified the tool truthfully as 'OmegaWeapon/1.0 (declared site-audit bot; obeys robots.txt)' over a plain Python HTTP client — no browser impersonation, no TLS-fingerprint spoofing, no fabricated referer. robots.txt was obeyed; requests were rate-limited to >=2.0s per host with Retry-After honored and 429/5xx backed off, and a conditional on-disk cache avoided re-fetches (0 path(s) skipped as robots-disallowed, 7 served from cache). A wall (WAF / 403 / CAPTCHA) is recorded NOT_TESTED and never worked around.
