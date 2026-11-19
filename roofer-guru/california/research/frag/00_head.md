# California roofing evidence file: the law, what roofs are made of, what weather and fire do to them, and the market

Compiled 19 November 2026 for the California rebuild of the roofing dashboard. Every number and legal statement below was read from a source opened in this session unless the status says otherwise. Nothing here is from memory. This file is evidence for a dashboard, not legal advice.

## How to read the status column

| Status | Meaning |
|---|---|
| **VERIFIED** | I opened the source and read the passage. |
| **VERIFIED (archive capture)** | The primary page blocks automated readers, so I read an Internet Archive (Wayback Machine) capture of that same page. The capture date is given. A statute may have been amended after the capture date; where I found a later amendment I say so. |
| **VERIFIED (transcription host)** | I read the text on a third-party site that reproduces the primary source (california.public.law for statutes, Cornell Legal Information Institute for regulations, UpCodes for Title 24). The host is named. Treat the quote as near-verbatim. |
| **SECONDARY** | A source I opened quotes or summarises the original; I did not open the original. |
| **SECONDARY (snippet)** | Seen only in a search-result summary. A lead, not a fact. |
| **DERIVED** | My arithmetic from a public data file that I downloaded. The script and its output are kept. |
| **JUDGMENT** | My inference. Not stated by any source. |
| **NOT FOUND** | Searched for and not found. |

## Sites that blocked automated reading, and what I used instead

| Site | What happened | Substitute used |
|---|---|---|
| leginfo.legislature.ca.gov (official statutes) | HTTP 403, Cloudflare browser challenge | Wayback Machine captures of the same pages (they show the amendment history line) and california.public.law (shows the date it last updated each section). Where the two differ, the later one is quoted and the difference is noted. |
| fire.ca.gov and osfm.fire.ca.gov (CAL FIRE, State Fire Marshal) | HTTP 403 "Access Denied" | Wayback captures for the two January 2025 incident pages. The Top 20 destructive fires list, the State Fire Marshal's building materials listing and the Board of Forestry rule file could not be opened at all. |
| codes.iccsafe.org (official Title 24 viewer) | Page loads but the code text is drawn by script | UpCodes transcription of the 2022 and 2025 codes. |
| api.census.gov | "Missing Key" (an API key is now required; none was used) | Census bulk files (Economic Census 2022, County Business Patterns 2023). |
| law.justia.com, codes.findlaw.com, legiscan.com, homeadvisor.com, sanjoseca.gov, lcf.ca.gov | HTTP 403 | Not used. |
| insurance.ca.gov Bulletin 2025-1 (PDF) | Connection reset twice | The Department's moratorium web page, which names the same declaration. |
| data.bls.gov QCEW industry file for NAICS 238160 | HTTP 404 for 2024 and 2025 | Not used. |
| westernroofing.net (WSRCA magazine) | Site returns a PHP fatal error | Not used. |

Raw downloads are in `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/law/` (statute captures in `statutes/` and `publaw/`, market files in `market/`, the federal housing survey in `recs/`, and `_log.tsv` lists every fetch with its HTTP code). Scripts and their printed outputs are in `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/research/ca/scripts/` and `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/research/ca/frag/`.

## Headline numbers (each is sourced in the section named)

| # | Number | What it is | Section |
|---|---|---|---|
| 1 | **$1,000** | A contractor's licence is needed for any job with a total price of $1,000 or more (the line was $500 until 1 January 2025). Under $1,000 a licence is still needed if the work needs a permit or the person employs anyone | A1 |
| 2 | **$1,000 or 10 percent, whichever is less** | Largest down payment allowed on a home improvement contract | A2 |
| 3 | **3, 5 and 7 business days** | Right to cancel: ordinary buyer, senior citizen, and disaster repair contracts | A2 |
| 4 | **$25,000** | Contractor's licence bond since 1 January 2023 | A1 |
| 5 | **C-39 has no workers' compensation exemption** | Roofers must carry it even with no employees; all other licensees are due to follow on 1 January 2028 | A1 |
| 6 | **$10,000 and $20,000** | Minimum civil penalty (sole owner, other entities) for employing workers without workers' compensation, from 2026 | A1 |
| 7 | **10 percent for 180 days** | Price-gouging cap on a contractor's repair prices after an emergency declaration | A3 |
| 8 | **16 months, 2 or 3 years, and up to $10,000** | Penalty for unlicensed contracting in a declared disaster area | A3 |
| 9 | **15, 40 and 30 days** | Insurer must acknowledge a claim, accept or deny it, and pay it | A5 |
| 10 | **12 and 36 months** | Shortest period an insurer may allow to collect full replacement cost: ordinary loss, declared emergency | A5 |
| 11 | **698,307 policies and $773 billion** | FAIR Plan policies in force and exposure, September 2026 (up 157 percent and 252 percent since September 2022) | A6 |
| 12 | **0.20 and 0.63** | Minimum aged solar reflectance for a steep and a low-slope house re-roof in the covered climate zones, when more than 50 percent of the roof is replaced | A9 |
| 13 | **Class A** | Roof class required in Fire Hazard Severity Zones for new roofs and when 50 percent or more is replaced in 12 months | A10 |
| 14 | **6 feet** | Fall height at which Cal/OSHA requires fall protection for residential roofing since 1 July 2025 (was 15 feet) | A13 |
| 15 | **62 percent, 27 percent, 5 percent** | California single-family roofs: composition shingles, tile (clay 18, concrete 9), wood | B1 |
| 16 | **62 percent tile** | Share of California single-family homes built 2000 to 2020 with tile roofs | B1 |
| 17 | **16,264 destroyed** | Structures destroyed in the Palisades (6,845) and Eaton (9,419) fires, CAL FIRE final counts | C1 |
| 18 | **70 percent against 19 percent** | Home survival with non-flammable against flammable roofs, 1990 Painted Cave fire | C1 |
| 19 | **11.5 percent against 38.5 percent** | Camp Fire survival of homes built before 1997 against 1997 and later | C1 |
| 20 | **$25.4 billion** | Insurance paid on the two January 2025 fires as of July 2026 (residential $23.4 billion on 38,737 claims) | C1 |
| 21 | **349 reports since 1951** | Hail of one inch or more reported anywhere in California; largest 3 inches | C4 |
| 22 | **5,602** | Currently renewed C-39 roofing licences, 19 November 2026 | D1 |
| 23 | **$6.21 billion** | California roofing contractor revenue, 2022 Economic Census (2,781 establishments, 25,383 employees) | D1 |
| 24 | **14,511** | Re-roof permits issued by the City of Los Angeles in 2023, up 40 percent on 2022 after the wet winter | D2 |

---

# A. THE LAW A ROOFER WORKS UNDER

**Citation shorthand used in the Source column.** "Wayback Machine capture" means a dated Internet Archive copy of the Legislature's own page; the last line of each such page gives the amending act and its effective date, and I quote it. "california.public.law transcription" means that site's copy, with the date the site says the section was last updated.
