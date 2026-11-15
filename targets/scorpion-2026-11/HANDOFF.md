# OmegaWeapon run: Scorpion's recent acquisition books (paused 2026-11-15)

Paused at the operator's request, to resume on Fable 5.2 once its usage limit resets. Everything needed to rebuild is in
this folder; nothing depends on the old session's scratchpad.

## Resume

```bash
/model claude-fable-5-2
```

Then, from the repository root:

```bash
cd targets/scorpion-2026-11 && export OMEGA_WORK=$PWD
```

```bash
python3 -I scripts/build_payload.py $(python3 -I -c "import json;print(' '.join(r['domain'] for r in json.load(open('omega_cache/_roster/roster.json'))))")
```

The crawl and scan data are already cached under `omega_cache/<domain>/`, so no target needs to be fetched again to
finish. Re-fetch only to refresh.

## What is done

- **Prior audits reused:** the Scorpion Agency Radar record (edition 2026.09a) and the Hit Board record, unpacked from
  `leviathan/Leviathan.html` (`unpack/scorpion_radar.json`).
- **Acquisitions verified (dated):** Coalmarch Marketing 2026-10-19 (pest and lawn), 1SEO Digital Agency 2026-06-18
  (home services), GNGF 2024-09-18 (law firms). The Hit Board's "roll-up in 2026" line is wrong for three of its four
  names: Driven Local was 2017, Wheat Creative 2021, GNGF 2024. Only 1SEO (and now Coalmarch) are 2026.
- **Platform fingerprints:**
  - Coalmarch: Drupal 10 with the shared `sprowt3` theme, on Pantheon.
  - GNGF: Genesis child theme carrying the `gngf_vars` handle.
  - Scorpion: `www.<client>` CNAME into `*.scorphosting.com` / `*.scorpcloud.com`, behind Cloudflare.
- **Spine run on 7 open sites:** crawl (30 pages each), raw scan of the money set, schema check, mobile render,
  render probe, RDAP and Autocomplete demand. The 4 walled sites got robots.txt, RDAP and demand only.
- **11 payloads built** (`omega_cache/<domain>/payload.json`) in the OmegaWeapon dashboard engine's format. The engine
  and frame are in the Leviathan console's Core payload (`omega-engine`, `omega-frame-css`, `omega-frame-html`,
  `fonts-css`).
- **Discovery:** gngf.com now 301-redirects to savetube.org, a YouTube-download site. RDAP shows the domain moved to
  a NameCheap registration on 2026-02-13; it was first registered in 2001. Any former GNGF client still carrying a
  GNGF footer credit link now sends visitors there.

## Scope decisions (keep these)

- A marketing audit: search, paid, local, AI and GEO, content, tracking and speed. Email security and site security
  posture (DMARC/SPF spoofability, security headers, WAF behavior) are out of scope and were removed.
- Compliance rows are fix-it items for the business owner, routed `PRIVATE`. Nothing is framed as a report to
  regulators or platforms.
- Case-study and logo-wall ties do not distinguish current from former engagements. Only the 7 audited sites and the
  4 fingerprinted ones are confirmed on the platform today.
- Honest fetching: declared user-agent, robots.txt obeyed, rate-limited. Every WAF wall was recorded NOT_TESTED and
  never worked around.

## Fix first (known issues in the built payloads)

1. **Walled sites show overall "D" from a single graded pillar.** Require at least 4 graded pillars before letting the
   overall be a letter; otherwise it is "?". The relevant code is in `build_payload.py`, under the `# overall` comment.
2. **The "invisible on the money searches" AI finding fires unconditionally.** Gate it on two or more non-brand misses
   in the demand map.
3. **Refresh the analyst lines for the three sites scanned last.** Their `one_paid` and `one_exposure` lines in
   `analyst.json` were written before their scans finished. Use the observed facts below.

### Observed facts to fold in (from `digest.json`)

- **arlinghausair.com**
  - Google Ads AW-871025383, Microsoft UET 271002339, a Meta pixel, a Reddit pixel and session replay all fire before
    consent, with no banner.
  - Dead Universal Analytics id UA-103658182-1.
  - The LocalBusiness/Organization block is missing a required telephone.
  - Homepage: 282 requests across 52 third-party hosts, lab LCP 1440 ms, 22% of the page JS-dependent.
  - Sitemap holds 257 URLs; 12 orphan candidates.
- **centercityemergencydentists.com**
  - 26 of 30 crawled pages have no meta description; 23 titles run long.
  - Two GTM containers (GTM-52ZG6LC and GTM-W6NM53K7).
  - The only analytics id found is the dead UA-85039641-1, with no GA4 detected, so analytics may be broken. Verify.
  - Google Ads AW-946538747.
  - No Dentist, MedicalBusiness or LocalBusiness schema, only Organization: a large local-SEO gap for a dental
    practice.
  - Homepage lab LCP 2656 ms, over the 2.5 s line.
  - Timer-like strings appear on the page; check them before calling them a countdown.
- **russellandlazarus.com**
  - Call tracking, Google Ads, a Meta pixel, Microsoft UET, session replay and other adtech fire before consent, with
    no banner, on a California law firm's site. California privacy litigation over session replay and pixels is
    active, so hold this as CANDIDATE for the firm's counsel.
  - Homepage lab LCP 2608 ms.
  - Sitemap holds 946 URLs; 24 deep pages.
  - Organization schema is missing address and telephone; LegalService appears on only 3 pages.
  - Autocomplete shows offices in Riverside, Fullerton and Long Beach. A rival (Joe Naz) appears on "car accident
    lawyer orange county".

## Remaining steps

1. Apply the three fixes above and rebuild all 11 payloads.
2. Build each standalone `omega-<domain>.html`: fonts-css plus frame CSS as style, frame HTML as body, the
   `omega-data` JSON script, then the engine. This mirrors the console's `frameSrcdoc()`.
3. Write `omega-pack.json` as `{"omega_pack": true, "targets": [{"payload": ...}]}` for the Leviathan Targets wing
   (Import a run).
4. Open each page in Chromium and click every tab; fix any render error.
5. Run the brand sweep across all pages and exports. Zero hits is the gate.
6. Write the cross-book summary: the pattern verdict per agency book and an inherited-against-owned rollup.
7. Commit, push, and deliver.

## 25 clients to approach (as delivered 2026-11-15, with rows 11-12 corrected)

| # | Client | Vertical | Market | Book | Evidence |
|---|---|---|---|---|---|
| 1 | American Turf & Tree Care | Lawn/tree | Greeley, CO | Coalmarch | Audited |
| 2 | Sound Pest Control | Pest | Puget Sound, WA | Coalmarch | Audited |
| 3 | Midwest Pest Control | Pest | Omaha, NE | Coalmarch | Audited |
| 4 | Henley's Plumbing & Air | Plumbing/HVAC | Inland Empire, CA | 1SEO | Audited |
| 5 | Arlinghaus Plumbing Heating Air & Electrical | HVAC/plumbing/electrical | Cincinnati / N. KY | 1SEO | Audited |
| 6 | Center City Emergency Dentists | Dental | Philadelphia, PA | 1SEO | Audited |
| 7 | Russell & Lazarus APC | PI law | Newport Beach, CA | GNGF | Audited |
| 8 | Arnold & Itkin | PI law | Houston, TX | Scorpion native | Fingerprint |
| 9 | The Bugman | Pest | regional | Coalmarch | Fingerprint |
| 10 | Evergreen Lawn & Pest Control | Lawn/pest | Apopka, FL | Coalmarch (migrated) | Fingerprint |
| 11 | The Law Offices of Cheryl David | Bankruptcy law | n/a | GNGF (migrated) | Fingerprint |
| 12 | Overhead Door Co. of Northland | Garage doors | Eagan, MN | Scorpion native | Fingerprint |
| 13 | American Air and Heat | HVAC | Orlando, FL | 1SEO | Case study |
| 14 | Radiant Plumbing, Heating & AC | Plumbing/HVAC | Austin, TX | 1SEO | Case study |
| 15 | Alan Cherry Exteriors | Home improvement | NJ | 1SEO | Case study |
| 16 | Five Star Painting, Inc. | Painting | NJ | 1SEO | Case study |
| 17 | Patriot Chevrolet | Auto dealer | Limerick, PA | 1SEO | Case study |
| 18 | A-1 Electric | Electrical | PA | 1SEO | Case study |
| 19 | Shiloh Vein & Aesthetics Institute | Medical | PA | 1SEO | Case study |
| 20 | Davis Brothers Chimney Sweep & Masonry | Masonry | NJ | 1SEO | Case study |
| 21 | Triangle Pest Control | Pest | Raleigh, NC | Coalmarch | Case study |
| 22 | Advantage Pest Management | Pest | Denver, CO | Coalmarch | Case study |
| 23 | TruGreen Midsouth | Lawn | LA/TX | Coalmarch | Case study |
| 24 | PestMasters | Pest | regional | Coalmarch | Case study |
| 25 | Owenby Law | Family law | Jacksonville, FL | Scorpion native | Case study and ad |
