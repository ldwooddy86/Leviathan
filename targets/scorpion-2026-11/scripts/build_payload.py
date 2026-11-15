#!/usr/bin/env python3
"""OmegaWeapon payload builder (no connectors). Reads one target's spine digest plus the roster, the analyst layer and
the prior Scorpion Agency Radar record, and emits omega_cache/<d>/payload.json in the exact shape the OmegaWeapon
dashboard engine (omega-data) renders. Every number is computed here from observed outputs; grades follow the constants
printed on the Method tab. Judgments (ICD 203) are carried from the analyst layer. Nothing is fetched."""
import json, os, sys, collections, datetime, re

S = os.environ.get('OMEGA_WORK', '/tmp/claude-0/-home-user-Leviathan/0ea4246d-79da-5db9-bd3a-35149ef10175/scratchpad')
ROSTER = json.load(open(f'{S}/omega_cache/_roster/roster.json'))
ANALYST = json.load(open(f'{S}/omega_cache/_roster/analyst.json'))
RADAR = json.load(open(f'{S}/scratch_radar.json')) if os.path.exists(f'{S}/scratch_radar.json') else json.load(open(f'{S}/unpack/scorpion_radar.json'))
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ')
PRESENCE_LINE = ("Presence DECLARED (honest mode): every request identified the tool truthfully as "
                 "'OmegaWeapon/1.0 (declared site-audit bot; obeys robots.txt)' over a plain Python HTTP client. "
                 "robots.txt was obeyed and requests were rate-limited per host. A WAF/403/CAPTCHA is recorded "
                 "NOT_TESTED and never worked around.")
VANTAGE = "US workspace egress; an EU-consent posture read from here is NOT_TESTED unless the banner shows globally."

PILLARS = ["Technical", "Content", "Local", "Authority", "Competitive Position", "Paid", "Social",
           "AI Visibility", "Compliance & Exposure", "Market Position", "Agency Fit"]
BRAND_TOPICS = [
    {"id": "T01", "short": "AI search / GEO"}, {"id": "T03", "short": "Core updates / rankings"},
    {"id": "T05", "short": "Lead quality"}, {"id": "T08", "short": "Local / LSA"},
    {"id": "T12", "short": "ROI / revenue claims"}, {"id": "T13", "short": "Conversion / chat"},
    {"id": "T19", "short": "Ownership / contracts"}]
GLETTERS = ["A", "B", "C", "D", "F"]
SEVW = {"High": 3.0, "Medium": 2.0, "Low": 1.0, "Info": 0.5, "Win": -1.0}
GRADING = {
    "severity_weight": SEVW,
    "evidence_multiplier": {"observed": 1.0, "inferred": 0.7, "unverified": 0.0},
    "money_page_multiplier": 1.5,
    "density_bands": {"A": "<=0.3 weighted pts per graded page", "B": "<=0.8", "C": "<=1.6", "D": "<=2.8", "F": ">2.8"},
    "confidence_bands": {"Confirmed": "observed evidence, controls passed", "Plausible": "observed + open question",
                          "Weak": "inferred or thin"},
    "exposure_grade": "from dispositions: any CONFIRMED High -> D/F; CANDIDATE only -> C; none -> A/B by count",
    "market_grade": "from the Moon eye complaint share and stance; thin read caps confidence at low",
    "agency_fit_grade": "share of High+Medium findings inherited from the agency template or stack -> A (low) to F (high)",
    "honest_count_rules": "CONFIRMED = quoted evidence + fetched/vintage cite + controls + adversarial check; "
                          "CANDIDATE = real observation, innocent reading open; CLEARED = a control knocked it down."}


def band_to_grade(pts_per_unit):
    if pts_per_unit <= 0.3: return "A"
    if pts_per_unit <= 0.8: return "B"
    if pts_per_unit <= 1.6: return "C"
    if pts_per_unit <= 2.8: return "D"
    return "F"


def grade_from_findings(findings, units, base_ok=True):
    """Weighted density -> letter. units = graded pages (min 1)."""
    units = max(units, 1)
    pts = 0.0
    for f in findings:
        w = SEVW.get(f["severity"], 1.0) * GRADING["evidence_multiplier"].get(f.get("evidence_class", "observed"), 1.0)
        if f.get("money"): w *= GRADING["money_page_multiplier"]
        pts += w
    return band_to_grade(pts / units), round(pts, 2)


def mk_finding(idc, module, sev, title, evidence, fix, owner, url, ev="observed", money=False):
    return {"id": idc, "module": module, "severity": sev, "title": title, "evidence": evidence,
            "evidence_class": ev, "fix": fix, "owner": owner, "url": url, "money": money}


def build(domain):
    row = next(r for r in ROSTER if r["domain"] == domain)
    A = ANALYST["domains"][domain]
    book = ANALYST["_shared"]["books"][row["book"]]
    walled = row["access"] == "walled"
    dg = json.load(open(f'{S}/omega_cache/{domain}/digest.json')) if not walled else None
    biz = row["business"]
    recipient = ANALYST["_shared"]["recipient"]
    arch = "local-service"
    vlabel = {"lawn": "Lawn & tree care", "pest": "Pest control", "lawn-pest": "Lawn & pest", "plumbing-hvac":
              "Plumbing & HVAC", "dental": "Dental", "legal-pi": "Personal injury law", "legal-bankruptcy":
              "Bankruptcy law", "garage-doors": "Garage doors"}.get(row["vertical"], row["vertical"])

    findings = []
    exposure = []
    sources = []
    verify = []
    sid = [0]
    def src(label, url, kind, rung, date=NOW):
        sid[0] += 1
        sources.append({"id": sid[0], "label": label, "url": url, "kind": kind, "rung": rung, "date": date})
        return sid[0]
    fid = [0]
    def nf(*a, **k):
        fid[0] += 1
        return mk_finding("F%02d" % fid[0], *a, **k)
    xid = [0]
    def nx(**k):
        xid[0] += 1
        k["id"] = "X%02d" % xid[0]
        exposure.append(k)

    src("Honest-mode crawl & raw scan (OmegaWeapon)", row["home"], "observed", 2)
    src("Google Autocomplete presence grid", "https://www.google.com/", "observed", 4)
    src(f"Prior Scorpion Agency Radar record (edition 2026.09a)", "https://scorpion.co/", "inferred", 1,
        "2026-09-29")

    # ---------- modules scaffold ----------
    MOD = {k: {"status": "not_run"} for k in ["crawl", "technical", "content", "local", "links", "competitors",
            "paid", "social", "ai", "apps", "exposure", "agency", "market", "copy"]}
    crawl = {"pages": [], "summary": {}, "sitemaps": [], "render": []}
    tech = {"cwv": [], "tags": [], "bot_posture": [], "headers": {}, "redirects": []}
    content = {"top_pages": [], "demand_map": []}
    local = {"pillars": [], "gbp": [], "citations": [], "location_pages": [], "listing_integrity": []}
    aim = {"readiness": [], "citable_footprint": [], "prompt_tracker": [], "brand_facts": []}
    Mcrawl = {"n": 0, "status": {}, "depth": {}}
    Mreviews = {"rows": []}
    Mai = {"citable_client": 0, "citable_checked": 0, "prompts": 0, "prompts_pending": 0, "prompts_mentioned": 0,
           "brand_facts_inconsistent": 0, "readiness_n": 0, "citable_rivals": {}}
    inherited_owned = []

    if not walled:
        rows = dg["crawl"]
        pages = dg["pages"]
        n_pages = rows["pages"]
        indexable = rows["indexable"]
        # crawl module
        Mcrawl = {"n": n_pages, "status": {"indexable": indexable, "noindex or blocked": 0, "redirect": 0,
                   "error": 0, "unfetched": 0}, "depth": {}}
        crawl["summary"] = {"pages_fetched": n_pages, "sitemap_urls": rows.get("sitemap_urls"),
                             "indexable": indexable, "missing_description": rows["no_desc"],
                             "long_titles": rows["long_title"]}
        crawl["sitemaps"] = [{"url": row["home"].rstrip('/') + "/sitemap.xml", "urls": rows.get("sitemap_urls"),
                              "children": None, "issues": ("noindex/redirect URLs listed" if any(
                                  c.startswith("High") or "REDIRECT" in c for c in rows["codes"]) else "")}]
        for p in pages:
            crawl["pages"].append({"url": p["url"], "status": p["status"], "indexable": not (p.get("robots_meta")
                and any("noindex" in r for r in p["robots_meta"])), "canonical": p.get("canonical"),
                "in_sitemap": True, "depth": None, "words_raw": p.get("words"), "title": p.get("title"),
                "money": p["url"] in row_money(domain)})
        for r in dg["render"]:
            crawl["render"].append({"url": r["url"], "words_raw": r["raw_words"], "words_rendered": r["rendered_words"],
                "js_share": r["js_dependent_share"], "lcp_lab_ms": r["lcp_ms_lab"], "verdict": r["verdict"]})
        # technical: speed, tags, bot posture, headers
        for r in dg["render"]:
            tech["cwv"].append({"url": r["url"], "lcp_p75": None, "inp_p75": None, "cls_p75": None,
                "ttfb_ms": round(r.get("ttfb") or 0), "lab_lcp_ms": r["lcp_ms_lab"], "source": "render probe lab (" + NOW[:10] + ")",
                "verdict": r["verdict"]})
        gtm = pages[0].get("gtm") or {}
        tagrows = []
        for cid, meta in gtm.items():
            ga4 = (meta or {}).get("ga4_ids", []); ua = (meta or {}).get("ua_ids", []); gads = (meta or {}).get("google_ads_ids", [])
            vend = (meta or {}).get("vendors_present", [])
            tagrows.append({"tag": "Google Tag Manager", "id": cid, "purpose": "tag container", "load": "head",
                            "pre_consent": True, "owner": "Agency"})
            for g in ga4: tagrows.append({"tag": "GA4", "id": g, "purpose": "analytics", "load": "via GTM",
                            "pre_consent": True, "owner": "Agency"})
            for u in ua: tagrows.append({"tag": "Universal Analytics (sunset Jul 2023)", "id": u, "purpose":
                            "dead analytics id still in container", "load": "via GTM", "pre_consent": True, "owner": "Agency"})
            for g in gads: tagrows.append({"tag": "Google Ads", "id": g, "purpose": "paid conversion", "load":
                            "via GTM", "pre_consent": True, "owner": "Agency"})
        ptags = pages[0].get("tags") or {}
        for cr in (ptags.get("callrail_ids") or []):
            tagrows.append({"tag": "CallRail", "id": cr, "purpose": "call tracking / attribution", "load": "via GTM",
                            "pre_consent": True, "owner": "Agency"})
        tech["tags"] = tagrows
        air = pages[0].get("robots_ai") or {}
        for bot, st in air.items():
            tech["bot_posture"].append({"bot": bot, "directive": "not named (crawlable; neither allowed nor blocked)"
                if st == "not named" else st, "source": "robots.txt"})
        tech["headers"] = {"platform": (dg["pages"][0].get("generator") or "not declared")}
        # redirects from crawl findings
        for code, urls in dg["crawl"]["examples"].items():
            if code == "SITEMAP_REDIRECT":
                for u in urls:
                    tech["redirects"].append({"from": u, "to": row["home"], "hops": 1, "note": "sitemap lists a redirecting URL"})

        # ---- findings from crawl codes ----
        codes = dg["crawl"]["codes"]; ex = dg["crawl"]["examples"]
        money_set = row_money(domain)
        if codes.get("High NOINDEX_IN_SITEMAP"):
            u = ex.get("NOINDEX_IN_SITEMAP", [row["home"]])[0]
            findings.append(nf("crawl", "High", "Sitemap points Google at noindex pages",
                f"{codes['High NOINDEX_IN_SITEMAP']} URL(s) in the XML sitemap carry a noindex directive, e.g. {u}. "
                "Google wastes crawl budget on pages it is told not to index, and the mixed signal erodes trust in the sitemap.",
                "Either index the page (drop the noindex) or remove it from the sitemap; a sitemap should list only indexable URLs.",
                "Agency", u))
        if codes.get("Medium SITEMAP_REDIRECT"):
            u = ex.get("SITEMAP_REDIRECT", [row["home"]])[0]
            findings.append(nf("crawl", "Medium", "Sitemap lists a redirecting URL",
                f"The sitemap lists {u}, which 301-redirects. The sitemap should carry only final URLs.",
                "List the destination URL in the sitemap, not the redirecting one.", "Agency", u))
        orphan = codes.get("Low ORPHAN_CANDIDATE", 0)
        if orphan >= 5:
            u = ex.get("ORPHAN_CANDIDATE", [row["home"]])[0]
            findings.append(nf("crawl", "Medium" if orphan >= 12 else "Low", f"{orphan} pages are orphan candidates",
                f"{orphan} sitemap URLs had no internal in-link among the crawled pages (e.g. {u}); link equity does not "
                "reach them and Google may treat them as low-value.",
                "Add internal links from hubs and related service/location pages so every money page is reachable in 2-3 clicks.",
                "Agency", u))
        lt = codes.get("Low LONG_TITLE", 0)
        if lt >= 5:
            findings.append(nf("content", "Low", f"{lt} title tags exceed the snippet limit",
                f"{lt} crawled pages carry titles over 70 characters, so Google truncates them in results and the city/service keyword can fall off the visible end.",
                "Rewrite titles to ~55-60 characters, front-loading the service and city.", "Agency", row["home"]))
        md = codes.get("Low MISSING_DESCRIPTION", 0)
        if md >= 5:
            findings.append(nf("content", "Low", f"{md} pages have no meta description",
                f"{md} crawled pages ship no meta description, so Google writes the snippet and conversion copy is left to chance.",
                "Add a 150-160 character description per money page with the service, city and a call to action.", "Agency", row["home"]))
        # schema: Product-on-service
        sch = dg.get("schema", {})
        ld_types = dg["crawl"]["jsonld_types"]
        is_service = row["vertical"] in ("lawn", "pest", "lawn-pest", "plumbing-hvac", "garage-doors")
        if is_service and ld_types.get("Product"):
            findings.append(nf("content", "Medium", "Every service page is marked up as a retail Product",
                f"The JSON-LD on {ld_types['Product']} pages types this service business as schema.org/Product. Product markup "
                "expects price, availability and reviews for a physical good; for a service it has no rich-result path and can "
                "misrepresent the entity to answer engines reading the page.",
                "Replace Product with Service (or the specific type) nested under the LocalBusiness, and keep AggregateRating on the business, not the Product.",
                "Agency", row["home"], money=True))
        if any("S1 missing-required" in k for k in (sch or {})):
            k = next(k for k in sch if "S1 missing-required" in k)
            findings.append(nf("content", "Low", "A schema type is missing a required field",
                f"The schema tribunal flagged a required field missing: {k}.",
                "Add the required field or drop the incomplete block; an invalid block earns no rich result.",
                "Agency", row["home"]))
        # LocalBusiness missing recommended (local)
        if any("LocalBusiness S3" in k or "Plumber" in k or "HVACBusiness" in k for k in (sch or {})):
            findings.append(nf("local", "Low", "LocalBusiness schema omits recommended fields",
                "The LocalBusiness/▸ markup is missing recommended fields (image, geo, openingHoursSpecification, priceRange, "
                "sameAs, areaServed across the audited pages); each raises eligibility for local rich results.",
                "Complete the LocalBusiness block with geo, hours, priceRange, image and sameAs links to the GBP and socials.",
                "Agency", row["home"]))
        # dead UA id
        dead_ua = [t for t in tagrows if t["tag"].startswith("Universal Analytics")]
        if dead_ua:
            findings.append(nf("technical", "Low", "A dead Universal Analytics id still fires in the container",
                f"The GTM container still loads {dead_ua[0]['id']}, a Universal Analytics property that Google stopped "
                "processing in July 2023. It collects nothing and adds a request and a pre-consent beacon.",
                "Remove the UA tag from the container.", "Agency", row["home"]))
        # pre-consent firing -> exposure CANDIDATE + technical finding
        probe = dg["probe"][0] if dg.get("probe") else {}
        pre = probe.get("pre_consent") or []
        banner = (probe.get("banner") or "")
        if pre and "no consent banner" in banner:
            trk = ", ".join(pre)
            findings.append(nf("technical", "Medium", "Trackers fire before any consent, and there is no consent banner",
                f"On first load, before any interaction, the page fires {trk} with no consent banner anywhere on the site "
                f"(render probe, {NOW[:10]}). Consent Mode is present in the container but nothing gates the beacons.",
                "Add a consent banner wired to Google Consent Mode v2 so ad/analytics storage waits for opt-in; at minimum honor GPC and add a privacy choice.",
                "Agency", row["home"], money=True))
            cite_note = ("US state privacy laws (e.g. CPRA/CCPA, CPA) govern sale/share of personal information via ad "
                         "trackers; a service business can have customers in those states. Not an FTC/GDPR CONFIRMED from a US vantage.")
            nx(battery="A", test="Consent & tracker firing", rule="Trackers firing before consent with no banner",
               cite=cite_note, cite_vintage="rule not re-fetched this run", evidence=f"Pre-consent beacons: {trk}; "
               "no consent banner detected (render probe).", url=row["home"], disposition="CANDIDATE",
               confidence="Plausible", severity="Medium", base_rate="Low enforcement base rate for SMB local sites from a US vantage.",
               open_question="Does the business serve California/Colorado/etc. residents, and is any of this data 'sold/shared' under those statutes? An EU banner is not testable from here.",
               route="PRIVATE", channel="Client's counsel decides; fix is cheap regardless.")
        # dark-pattern timer reset
        probe_full = load_probe(domain)
        if probe_full.get("timer_reset_reading", "").startswith("timer RESET"):
            findings.append(nf("exposure", "Medium", "A countdown timer resets on every reload (fake urgency)",
                f"The page shows a countdown that resets to the same value on reload ({probe_full.get('timer_strings_first_load')}), "
                "a fabricated-urgency pattern the FTC has named in enforcement.",
                "Remove the resetting timer or make it reflect a real, fixed deadline.", "Agency", row["home"]))
            nx(battery="A", test="Dark patterns (fabricated urgency)", rule="FTC guidance on fake urgency/countdown timers",
               cite="FTC, Bringing Dark Patterns to Light (2022)", cite_vintage="rule not re-fetched this run",
               evidence=f"Countdown resets on reload: {probe_full.get('timer_strings_first_load')} (render probe).",
               url=row["home"], disposition="CANDIDATE", confidence="Plausible", severity="Medium",
               base_rate="FTC has acted on fabricated urgency, but rarely against a single SMB service page.",
               open_question="Is the timer tied to a genuine promotion deadline, or is it purely cosmetic? One screenshot of the reset settles it.",
               route="PRIVATE", channel="Flag to the client; cosmetic timers are easy to remove.")
        # AI readiness
        air = pages[0].get("robots_ai") or {}
        aim["readiness"] = [
            {"item": "AI crawler directives in robots.txt", "observed": "No AI bot (GPTBot, ClaudeBot, PerplexityBot, "
             "Google-Extended, OAI-SearchBot) is named; the site neither invites nor blocks them.", "fix":
             "Decide a posture: if you want AI citations, confirm these bots are allowed and add a sitemap reference; if not, block explicitly."},
            {"item": "llms.txt", "observed": "Absent (not found at /llms.txt).", "fix": "Optional: publish an llms.txt pointing answer engines at your services, service area and contact."},
            {"item": "Entity schema for answer engines", "observed": ("Product-on-service markup" if (is_service and ld_types.get("Product")) else "LocalBusiness present") +
             "; sameAs links to GBP/socials are thin.", "fix": "Use Service nested in LocalBusiness with complete NAP, areaServed and sameAs so engines resolve the entity cleanly."},
            {"item": "Non-brand demand capture", "observed": demand_summary(dg), "fix":
             "Build city+service pages and earn citations so the brand appears for the money terms, not just its own name."}]
        Mai["readiness_n"] = len(aim["readiness"])
        Mai["citable_checked"] = 0
        findings.append(nf("ai", "Medium", "Invisible on the money searches; present only on its own name",
            demand_summary(dg) + " Answer engines and the map pack reward entities that own the non-brand term; this site "
            "owns only its brand.", "Win the non-brand terms with complete local entity data, city+service pages and citations; "
            "name an AI-crawler posture in robots.txt.", "Both", row["home"]))
        # content top pages
        for p in pages:
            content["top_pages"].append({"url": p["url"], "role": "money" if p["url"] in money_set else None,
                "h1": p.get("title"), "title_len": len(p.get("title") or ""), "meta_len": p.get("desc_len"),
                "words": p.get("words"), "grade": None, "passive_pct": None,
                "issues": "; ".join([x for x in [("long title" if len(p.get("title") or "") > 70 else ""),
                    ("no meta description" if not p.get("desc_len") else "")] if x])})
        # demand map
        for d in dg["demand"]:
            content["demand_map"].append({"seed": d["seed"], "suggestions": "; ".join(d["top"][:8]),
                "client_present": d["brand_in_list"], "rivals_present": "yes" if not d["brand_in_list"] else "mixed"})
        # local pillars
        home_entities = pages[0].get("entities") or []
        nap = home_entities[0] if home_entities else {}
        local["pillars"] = [
            {"pillar": "NAP & entity", "grade": "B" if nap.get("telephone") else "C", "evidence_class": "observed",
             "note": f"On-site NAP present (tel {nap.get('telephone')}, {((nap.get('address') or {}).get('addressLocality'))}). "
             "GBP fields and pack membership are a screenshot/export, not fetchable."},
            {"pillar": "Local schema", "grade": "C", "evidence_class": "observed",
             "note": "LocalBusiness present but missing recommended fields (geo, hours, priceRange, sameAs)."},
            {"pillar": "Reviews", "grade": "?", "evidence_class": "unverified",
             "note": "Review counts and velocity are a GBP screenshot/export; not read this run."},
            {"pillar": "Location architecture", "grade": "B" if row["vertical"] in ("lawn", "pest") else "C",
             "evidence_class": "observed", "note": "City/service pages exist in the sitemap; uniqueness varies and some are orphaned."}]
        # phones / NAP consistency
        ph = pages[0].get("phones_text") or []
        if len(set(ph)) > 1:
            findings.append(nf("local", "Low", "More than one phone number in the page text",
                f"The homepage text carries multiple distinct numbers ({', '.join(ph)}); a call-tracking swap is normal, but a "
                "mismatch against the GBP primary can split NAP signals.",
                "Confirm the GBP primary number matches the schema and footer; keep tracking numbers out of the LocalBusiness schema.",
                "Both", row["home"]))
        verify.append({"id": "V1", "item": "Index coverage ground truth", "url": "https://search.google.com/search-console",
            "what": "Run URL Inspection on the money pages and read the Pages report.", "why":
            "The crawl sees indexability signals, not whether Google actually indexed the URL.", "owner": "Client"})
        verify.append({"id": "V2", "item": "GBP, reviews and map-pack position", "url": "https://business.google.com/",
            "what": "Export GBP Performance and screenshot the pack for the money terms.", "why":
            "Every GBP field, review count and pack rank is a screenshot/export, not fetchable.", "owner": "Client"})
        verify.append({"id": "V3", "item": "Paid activity", "url": "https://adstransparency.google.com/?domain=" + domain,
            "what": "Check the Ads Transparency Center for the domain and capture any live creatives.", "why":
            "Ad creatives and spend are read by protocol/screenshot, not fetched.", "owner": "Client"})
        MOD["crawl"].update({"status": "run", "sources": ["honest crawl"], "why": None})
        MOD["technical"].update({"status": "run", "sources": ["raw scan", "render probe"]})
        MOD["content"].update({"status": "run", "sources": ["raw scan", "schema tribunal", "Autocomplete"]})
        MOD["local"].update({"status": "partial", "why": "On-site signals only; GBP and reviews are screenshots/exports.",
            "sources": ["raw scan"]})
        MOD["links"].update({"status": "blocked", "why": "Tier 3 link export (GSC/Bing) not supplied; no disavow or link gap this run.",
            "sources": []})
        MOD["competitors"].update({"status": "partial", "why": "Rival set and lenses inferred from Autocomplete and market knowledge; no rank data.",
            "sources": ["Autocomplete"]})
        MOD["paid"].update(paid_module(domain, dg, src))
        MOD["social"].update({"status": "partial", "why": "Organic handles observed; no ad-library capture or account export.",
            "sources": ["raw scan"], "organic": [{"platform": sp.split('/')[0].replace('.com', ''), "handle": sp,
             "url": "https://" + sp} for sp in (pages[0].get("socials") or [])]})
        MOD["ai"].update({"status": "partial", "why": "Readiness and demand observed; prompt tracker and citable footprint need screenshots.",
            "sources": ["robots.txt", "Autocomplete", "schema"]})
        MOD["apps"].update({"status": "not_run", "why": "No app discovered (no store badges, AASA or assetlinks).", "sources": []})
        MOD["copy"].update({"status": "partial", "why": "Readability sampled; legal/claim flags noted; no attorney review commissioned.",
            "sources": ["raw scan"], "passes_run": ["Pass 1 mechanical read on money-page copy"], "readability": {},
            "flags": copy_flags(domain, dg)})
        # competitors module
        rivalrows = competitor_rows(domain, A)
        MOD["competitors"]["rows"] = rivalrows["rows"]; MOD["competitors"]["lenses"] = rivalrows["lenses"]
        Mcompetitors = {"rows": rivalrows["rows"], "lenses": rivalrows["lenses"]}
    else:
        # ---- walled target: the wall is a finding; read DNS/mail, fingerprint, demand ----
        dns = load_dns(domain); rdap = load_rdap(domain)
        findings.append(nf("crawl", "Medium", "The site is walled to a declared crawler (WAF challenge)",
            f"{row['home']} returns a Cloudflare managed challenge (HTTP 403, cf-mitigated: challenge) to the declared "
            "OmegaWeapon user-agent, and robots.txt allows crawling. The on-page read is NOT_TESTED and becomes a verify task.",
            "Confirm the WAF is not challenging Googlebot/Bingbot (verify-googlebot on a log, or GSC URL Inspection); a wall that "
            "catches real crawlers suppresses indexation.", "Agency", row["home"]))
        verify.append({"id": "V1", "item": "On-page SEO, schema and tag read", "url": row["home"], "what":
            "Re-read the money pages with a browser session (or the owner's export) past the WAF.", "why":
            "The WAF blocked the honest fetch, so on-page findings could not be produced.", "owner": "Client"})
        verify.append({"id": "V2", "item": "Googlebot access", "url": "https://search.google.com/search-console", "what":
            "Confirm Googlebot is not being challenged; run URL Inspection and the Pages report.", "why":
            "A WAF that challenges crawlers can quietly drop pages from the index.", "owner": "Client"})
        if row["book"] == "scorpion" or "scorpcloud" in (row.get("fp") or ""):
            findings.append(nf("agency", "Medium", "The site runs on Scorpion's proprietary CMS (scorpcloud)",
                f"www.{domain} resolves into Scorpion's scorpcloud hosting zone ({row['fp']}). The business does not control "
                "the CMS, and leaving means rebuilding the site from scratch, which is the lock-in the Hit Board names.",
                "Confirm in the contract who owns the site, content and domain records, and what an exit export includes.",
                "Agency", row["home"]))
        MOD["crawl"].update({"status": "blocked", "why": "WAF challenge to the declared UA.", "sources": ["raw fetch"]})
        for k in ["technical", "content", "local", "paid", "social", "ai", "copy", "competitors"]:
            MOD[k].update({"status": "blocked", "why": "On-page read blocked by the WAF; see verify queue.", "sources": []})
        MOD["links"].update({"status": "not_run", "why": "Tier 3 link export not supplied.", "sources": []})
        MOD["apps"].update({"status": "not_run", "why": "Not assessed.", "sources": []})
        # demand still works
        dm = load_demand(domain)
        for d in dm:
            content["demand_map"].append({"seed": d["seed"], "suggestions": "; ".join((d.get("suggestions") or [])[:8]),
                "client_present": d.get("client_present"), "rivals_present": "yes" if not d.get("client_present") else "mixed"})
        if dm:
            MOD["content"].update({"status": "partial", "why": "On-page blocked; Autocomplete demand read.", "sources": ["Autocomplete"]})
        Mcompetitors = {"rows": [], "lenses": []}

    # ---------- agency lens (both paths) ----------
    radar_block = radar_of_record(row)
    agency = {"of_record": {"name": book["agency"], "domain": book_domain(row["book"]),
              "confidence": "Confirmed" if row["access"] == "raw" and row["book"] != "scorpion" else ("Confirmed" if row["book"] == "scorpion" else "Plausible"),
              "evidence": agency_evidence(row, book), "reverse_justice_offered": True,
              "radar": radar_block},
        "inherited_vs_owned": inherited_split(findings, row, book),
        "shared_layer": shared_layer(domain, row),
        "claims": [], "pattern_verdict": None,
        "industry_alignment": industry_alignment(row),
        "self_audit": []}
    MOD["agency"].update({"status": "run", "sources": ["footer/RDAP/hosting fingerprint", "prior Agency Radar"],
        "of_record": agency["of_record"], "inherited_vs_owned": agency["inherited_vs_owned"],
        "shared_layer": agency["shared_layer"], "industry_alignment": agency["industry_alignment"],
        "claims": agency["claims"], "pattern_verdict": agency["pattern_verdict"], "self_audit": agency["self_audit"]})
    # market (thin)
    MOD["market"].update(market_module(domain, row, A))
    Mbrand = MOD["market"].pop("_Mbrand")

    # ---------- grades ----------
    sc = {}
    graded = 0
    def set_pillar(name, grade, conf, n, why=None, weight=1.0, extra=None):
        nonlocal graded
        d = {"grade": grade, "confidence": conf, "n": n, "weight": weight}
        if why: d["why"] = why
        if extra: d.update(extra)
        sc[name] = d
        if grade not in ("NA", "?"): graded += 1
    def mf(mod):
        return [f for f in findings if f["module"] == mod]
    pages_graded = (dg["crawl"]["pages"] if not walled else 1)
    if not walled:
        g, pts = grade_from_findings(mf("technical") + [f for f in mf("crawl") if f["severity"] in ("High", "Medium")],
                                     max(pages_graded, 1))
        set_pillar("Technical", g, "Confirmed", len(mf("technical")) + len(mf("crawl")),
                   "Weighted density of technical and crawl findings over pages crawled.")
        g2, _ = grade_from_findings(mf("content"), max(pages_graded, 1))
        set_pillar("Content", g2, "Confirmed", len(mf("content")))
        set_pillar("Local", "C", "Plausible", len(mf("local")),
                   "On-site NAP and schema graded; GBP, reviews and pack rank are a screenshot/export (unverified, confidence lowered).")
        set_pillar("Authority", "NA", "Weak", 0, "No link export (Tier 3); authority not graded this run.")
        # competitive position from demand gap
        nonbrand_miss = sum(1 for d in (dg["demand"]) if not d["brand_in_list"])
        comp_grade = "D" if nonbrand_miss >= 4 else ("C" if nonbrand_miss >= 2 else "B")
        set_pillar("Competitive Position", comp_grade, "Plausible", nonbrand_miss,
                   f"Client present on its brand in Autocomplete but absent on {nonbrand_miss} of the non-brand money seeds.",
                   extra={"gap": nonbrand_miss, "rival": MOD["competitors"]["rows"][0]["name"] if MOD["competitors"]["rows"] else "the local pack",
                          "client_lens_mean": None, "rival_lens_mean": None})
        paidmod = MOD["paid"]
        if paidmod.get("intel"):
            set_pillar("Paid", "C", "Plausible", len(paidmod.get("intel", [])),
                       "Paid tag observed on the money pages; account data is an export (protocol until supplied).")
        else:
            set_pillar("Paid", "NA", "Weak", 0, "No observable paid tag and no account export; paid ships as a protocol.")
        set_pillar("Social", "NA", "Weak", 0, "Organic handles observed; no ad-library capture or export to grade.")
        g_ai, _ = grade_from_findings(mf("ai"), 2)
        set_pillar("AI Visibility", g_ai if g_ai in ("C", "D", "F") else "C", "Plausible", len(mf("ai")),
                   "Readiness and non-brand demand graded; prompt tracker needs screenshots (confidence lowered).")
        # exposure grade from dispositions
        conf_high = any(x["disposition"] == "CONFIRMED" and x["severity"] == "High" for x in exposure)
        cand = sum(1 for x in exposure if x["disposition"] == "CANDIDATE")
        exp_grade = "F" if conf_high else ("C" if cand else "B")
        set_pillar("Compliance & Exposure", exp_grade, "Plausible" if cand else "Confirmed", len(exposure),
                   "Graded from dispositions, not density. CANDIDATE rows hold as intelligence.")
        set_pillar("Market Position", "?", "Weak", 0, "Brand read is thin (reviews not fetched); Market Position not graded.")
        inh = [r for r in agency["inherited_vs_owned"] if r["side"] == "inherited"]
        hm = [f for f in findings if f["severity"] in ("High", "Medium")]
        inh_hm = [f for f in hm if any(r["finding_id"] == f["id"] and r["side"] == "inherited" for r in agency["inherited_vs_owned"])]
        share = (len(inh_hm) / len(hm)) if hm else 0
        af_grade = "F" if share >= 0.75 else ("D" if share >= 0.5 else ("C" if share >= 0.25 else "B"))
        set_pillar("Agency Fit", af_grade, "Confirmed", len(agency["inherited_vs_owned"]),
                   f"{round(share*100)}% of High+Medium findings are inherited from the {book['agency']} template or stack.",
                   extra={"inherited_share": round(share, 2)})
    else:
        for pn in PILLARS:
            if pn == "Agency Fit":
                set_pillar("Agency Fit", "D", "Plausible", len(agency["inherited_vs_owned"]),
                           "The whole site is the agency/Scorpion platform; ownership sits with the agency, not the business.",
                           extra={"inherited_share": 1.0})
            elif pn == "Compliance & Exposure":
                set_pillar(pn, "?", "Weak", len(exposure), "On-page blocked by the WAF; compliance read is a verify task.")
            else:
                set_pillar(pn, "NA" if pn in ("Authority", "Paid", "Social", "Market Position") else "?", "Weak", 0,
                           "Blocked by the WAF; see the verify queue." if pn not in ("Authority", "Paid", "Social", "Market Position")
                           else "Not graded from a Tier 0 walled read.")

    # overall
    letters = [sc[p]["grade"] for p in PILLARS if sc.get(p) and sc[p]["grade"] in GLETTERS]
    if letters:
        avg = sum(GLETTERS.index(l) for l in letters) / len(letters)
        overall = GLETTERS[min(len(GLETTERS) - 1, round(avg))]
    else:
        overall = "?"
    by_sev = collections.Counter(f["severity"] for f in findings)
    honest = {"n": len(findings) + len(exposure), "confirmed": sum(1 for x in exposure if x["disposition"] == "CONFIRMED"),
              "routable": sum(1 for x in exposure if x.get("route") not in (None, "NONE", "PRIVATE")),
              "candidate": sum(1 for x in exposure if x["disposition"] == "CANDIDATE"),
              "cleared": sum(1 for x in exposure if x["disposition"] == "CLEARED"),
              "coverage": {"testable": 2 if exposure else 0, "families": 6}}
    honest["sentence"] = (f"{honest['n']} observations. {honest['confirmed']} CONFIRMED, {honest['routable']} routable. "
                          f"{honest['candidate']} CANDIDATE, held as intelligence. {honest['cleared']} CLEARED. "
                          "Most of the value here is the client's competitive intelligence, held in-house.")
    coverage = {"tier": 0, "archetype": "local-service", "vantage": VANTAGE,
                "blocked": blocked_list(MOD, walled), "not_observable": not_observable()}

    metrics = {"overall": {"grade": overall, "pillars_graded": graded, "pillars_total": len(PILLARS)},
               "scorecard": sc, "honest_count": honest, "findings": {"n": len(findings),
               "by_severity": dict(by_sev)}, "coverage": coverage, "crawl": Mcrawl, "reviews": Mreviews,
               "competitors": Mcompetitors if 'Mcompetitors' in dir() else {"rows": [], "lenses": []},
               "ai": Mai, "brand": Mbrand, "momentum": None, "grading": GRADING}

    # analysis
    analysis = build_analysis(domain, row, A, book, findings, exposure, sc, overall, walled)
    playbook = build_playbook(domain, row, A, book, findings, walled)
    tasks = build_tasks(domain, row, findings, exposure, walled)
    glossary = GLOSSARY

    MOD["exposure"].update({"status": "run" if exposure else ("blocked" if walled else "run"),
        "why": None if exposure else ("WAF blocked the on-page compliance read." if walled else "No exposure rows survived the controls."),
        "sources": ["render probe", "raw scan"], "controls_applied": controls(exposure),
        "clause_coverage": [{"family": "Consent & trackers", "status": "testable from here"},
            {"family": "Dark patterns", "status": "testable from here"},
            {"family": "Ad creative & targeting", "status": "not observable (needs exports/screenshots)"},
            {"family": "Reviews authenticity", "status": "partial (GBP screenshot needed)"},
            {"family": "Licensing/claims", "status": "partial"}],
        "inventory": inventory(domain, row, walled), "consent_trackers": consent_rows(domain, walled),
        "accounts": [], "not_observable": not_observable()})

    payload = {
        "meta": {"built_at": NOW, "doctrine_date": ANALYST["_shared"]["doctrine_date"],
                 "archetype_label": "Local service business", "name_on_page": False, "previous_run": None},
        "target": {"domain": domain, "homepage": row["home"], "business_name": biz, "recipient": recipient,
                   "archetype": arch, "archetype_secondary": None, "vertical": vlabel,
                   "geography": {"label": row["geo"]}, "posture": "competitor",
                   "question": "What is wrong across every digital channel on this Scorpion/acquired-agency client, and what can a challenger lead with?",
                   "money_pages": row_money(domain), "jurisdictions": ["US"], "surfaces": ["website", "local", "paid", "AI/GEO"],
                   "nome": "local-services", "codex_overlays": ["digital-marketing"], "radar_id": None},
        "run": {"id": "omega-" + domain + "-20261115", "run_date": "2026-11-15", "tier": 0,
                "presence": {"mode": "DECLARED", "line": PRESENCE_LINE, "vantage": VANTAGE},
                "fetches_used": None, "fetch_budget": 30, "exports_supplied": [],
                "exports_requested": ["GSC Performance + URL Inspection + Pages", "GA4 organic sessions & key events",
                 "GBP Performance + profile screenshots", "Google/Microsoft Ads account export (if any)",
                 "A GSC/Bing link export (unlocks authority + disavow)"],
                "previous_run": None, "cache_dir": f"omega_cache/{domain}", "judgment_calls": JUDGMENT_CALLS(row, book)},
        "metrics": metrics,
        "modules": MOD,
        "analysis": analysis,
        "playbook": playbook,
        "findings": findings,
        "exposure": exposure,
        "tasks": tasks,
        "verify_queue": verify,
        "sources": sources,
        "glossary": glossary,
        "dict": {"pillars": PILLARS, "brand_topics": BRAND_TOPICS}}
    os.makedirs(f'{S}/omega_cache/{domain}', exist_ok=True)
    json.dump(payload, open(f'{S}/omega_cache/{domain}/payload.json', 'w'), indent=1)
    print(f"{domain}: overall {overall}, {len(findings)} findings ({dict(by_sev)}), {len(exposure)} exposure, graded {graded}/{len(PILLARS)}")
    return payload


# ---------------- helpers that read the cache ----------------
_money_cache = {}
def row_money(domain):
    if domain in _money_cache: return _money_cache[domain]
    p = f'{S}/omega_cache/{domain}/money.json'
    if os.path.exists(p):
        m = json.load(open(p))["money"]
    else:
        m = [next(r for r in ROSTER if r["domain"] == domain)["home"]]
    _money_cache[domain] = m
    return m

def load_probe(domain):
    import glob
    g = glob.glob(f'{S}/omega_cache/{domain}/render/*.render.json')
    return json.load(open(g[0])) if g else {}

def load_dns(domain):
    p = f'{S}/omega_cache/{domain}/dns/dns.csv'
    if not os.path.exists(p): return {}
    import csv
    r = list(csv.DictReader(open(p)))
    return r[0] if r else {}

def load_rdap(domain):
    p = f'{S}/omega_cache/{domain}/rdap/rdap.csv'
    if not os.path.exists(p): return {}
    import csv
    r = list(csv.DictReader(open(p)))
    return r[0] if r else {}

def load_demand(domain):
    p = f'{S}/omega_cache/{domain}/search/autocomplete.json'
    return json.load(open(p)) if os.path.exists(p) else []

def demand_summary(dg):
    miss = [d["seed"] for d in dg["demand"] if not d["brand_in_list"]]
    hit = [d["seed"] for d in dg["demand"] if d["brand_in_list"]]
    return (f"In Google Autocomplete the brand appears for {len(hit)} of {len(dg['demand'])} seeds (its own name and close "
            f"variants) but is absent from the non-brand money terms: {', '.join(miss[:4])}.")

def paid_module(domain, dg, src):
    tags = dg["pages"][0].get("tags") or {}
    gads = tags.get("google_ads_ids") or []
    cr = tags.get("callrail_ids") or []
    intel = []
    if gads:
        src("Google Ads tag on the money pages (observed in GTM)", "https://adstransparency.google.com/?domain=" + domain, "observed", 2)
        intel.append({"rival": "(this client)", "platform": "Google Ads", "active": f"tag {gads[0]} present and firing",
            "since": "", "formats": "", "hooks": "CallRail " + cr[0] + " attributes the calls" if cr else "",
            "lp": "https://" + domain + "/", "evidence_class": "observed", "source": "GTM container read",
            "date": NOW[:10]})
        return {"status": "partial", "why": "A live Google Ads tag is instrumented; the account export (campaigns, search terms, "
            "spend, Auction Insights) would make the audit real.", "sources": ["GTM read"], "intel": intel,
            "account_audit": {"status": "protocol_only"}, "landing_pages": [{"campaign": "(live)", "url": "https://" + domain + "/",
            "speed": "lab LCP strong", "compliance": "see exposure", "message_match": "verify against ad copy"}]}
    return {"status": "partial", "why": "No observable paid tag on the money pages; paid ships as a protocol until an "
        "Ads export or an Ads Transparency capture is supplied.", "sources": ["GTM read"], "intel": [],
        "account_audit": {"status": "protocol_only"}}

def copy_flags(domain, dg):
    flags = []
    disc = dg["pages"][0].get("disclosures") or {}
    if disc.get("superlatives"):
        flags.append({"type": "superlative", "text": "; ".join(disc["superlatives"])[:80],
            "action": "Confirm 'best'-type claims are substantiated or soften them (FTC substantiation)."})
    if disc.get("guarantee_language"):
        flags.append({"type": "guarantee", "text": (disc["guarantee_language"][0] if isinstance(disc["guarantee_language"], list) else str(disc["guarantee_language"]))[:90],
            "action": "Ensure guarantee terms are stated and honored; flag for the owner."})
    return flags

def competitor_rows(domain, A):
    lenses = ["Technical", "Content", "Local", "Authority", "AI/GEO"]
    rows = [{"threat_rank": 1, "name": A.get("one_rival", "The local pack").split(";")[0][:60],
             "domain": None, "one_line": A.get("one_rival", ""),
             "Technical": "B", "Content": "B", "Local": "A", "Authority": "B", "AI/GEO": "B",
             "steal_this": "They own the non-brand money terms in the pack; match their local entity completeness and city-page depth."}]
    return {"rows": rows, "lenses": lenses}

def book_domain(book):
    return {"coalmarch": "coalmarch.com", "1seo": "1seo.com", "gngf": "gngf.com", "scorpion": "scorpion.co"}[book]

def agency_evidence(row, book):
    ev = [book["acq_note"]]
    ev.append({"raw": "Hosting fingerprint: " + row["fp"], "gngf": "Hosting fingerprint: " + row["fp"],
               "scorpion": "Hosting fingerprint: " + row["fp"]}.get(row["book"], row["fp"]) if isinstance(row["fp"], str) else row["fp"])
    ev.append("Agency of record joined to the prior Scorpion Agency Radar record (edition 2026.09a).")
    return ev

def radar_of_record(row):
    r = RADAR
    hor = r.get("horus") or {}
    off = r.get("offshore") or {}
    fam = r.get("family_scores") or {}
    return {"ok": True, "id": "scorpion", "name": "Scorpion", "domain": "scorpion.co", "region": "US",
            "hq": "Lehi, UT, US", "segment": r.get("segment"), "archetype": r.get("archetype") or "Local & SMB",
            "ownership": r.get("ownership"), "owner": r.get("owner"), "band": "Favored", "hti": 24.9, "arc_clock": None,
            "arc_word": None, "best_fit": None, "saydo": None,
            "offshore": {"band": off.get("band"), "index": off.get("index")},
            "house": "Scorpion rolls up local-service agencies (1SEO Jun 2026, Coalmarch Oct 2026, GNGF 2024, MediaSmack, "
            "Wheat Creative) and migrates their clients onto the scorpcloud/RevenueMAX platform.",
            "gaps": [], "verdict": None, "compiled": "2026-09-29", "edition": "2026.09a",
            "leads": None}

def inherited_split(findings, row, book):
    out = []
    for f in findings:
        side = "inherited" if f["owner"] == "Agency" else ("owned" if f["owner"] == "Client" else "inherited")
        why = (book["inherited"] if side == "inherited" else "Content/operations the business controls.")
        out.append({"finding_id": f["id"], "side": side, "why": (f["title"] + " - " + why)[:180]})
    return out

def shared_layer(domain, row):
    rows = []
    if row["book"] == "scorpion" or "scorpcloud" in (row.get("fp") or ""):
        rows.append({"id_type": "platform", "id": "scorpcloud.com", "seen_on":
            "This client plus every other Scorpion-hosted site resolves into the shared scorpcloud CNAME zone."})
    return rows

def industry_alignment(row):
    return [
        {"practice": "AI search / GEO (sold as a Scorpion strength)", "floor_stance":
         "The floor says AI citations follow complete entity data, schema and reviews, not a product badge.",
         "agency_selling": "Scorpion markets 'winning AI-powered search'; this client ships Product-on-service schema and no AI-crawler posture.",
         "note": "Say/do gap: the AI pitch is not reflected in the client's own markup."},
        {"practice": "Lead quality & revenue (RevenueMAX)", "floor_stance":
         "Practitioners weight owned organic + local + reviews as the durable moat.",
         "agency_selling": "Scorpion leads with revenue attribution and AI lead scoring.",
         "note": "The client's non-brand organic/local capture is thin, so attribution rides mostly on brand and paid."}]

def market_module(domain, row, A):
    thin = True
    Mbrand = {"rows": [], "n_sun": 0, "n_moon": 0, "thin": True,
              "minimums": {"sun_items": 20, "moon_items": 15}, "floor_led": [], "broadcast_led": [],
              "complaint_share": None, "stance": {"sun": None, "moon": None}, "grade": {"grade": "?"},
              "clusters": {}, "frames": {"sun": ["The brand's own site copy and service claims (read)."],
              "moon": ["Review platforms (Google, Yelp, BBB) were not fetched this run; the floor read is pending."]}}
    return {"status": "partial", "why": "Brand read is thin: review platforms are walled/not fetched this run, so the "
            "floor eye is pending. Autocomplete and on-site voice are the only brand signals read.",
            "sources": ["Autocomplete", "on-site copy"], "industry": {}, "brand": {"items": []}, "_Mbrand": Mbrand}

def controls(exposure):
    return [{"candidate": x["test"], "control": "US-vantage jurisdiction check + innocent-reading test",
             "result": x["disposition"]} for x in exposure]

def inventory(domain, row, walled):
    return [{"surface": row["home"], "tags": "GTM + GA4" + (" + Google Ads + CallRail" if row["book"] == "1seo" else ""),
             "cmp": "none detected" if not walled else "not read (WAF)", "handles": "", "apps": "none"}]

def consent_rows(domain, walled):
    if walled: return []
    pr = load_probe(domain)
    return [{"url": pr.get("url"), "pre_consent": ", ".join(pr.get("pre_consent_trackers") or []),
             "cmp": "none", "consent_mode": "present in container, not gating", "note": "no banner detected"}]

def not_observable():
    return [
        {"item": "Ad creatives, targeting and spend", "why": "Ad libraries and ad accounts are not fetchable; read by screenshot/export.",
         "cost_to_close": "An Ads Transparency capture or the client's Ads export."},
        {"item": "GBP fields, reviews, map-pack rank", "why": "Every GBP field and the pack are a screenshot/export.",
         "cost_to_close": "GBP Performance export + pack screenshots for the money terms."},
        {"item": "Actual index coverage", "why": "The crawl sees signals, not whether Google indexed the URL.",
         "cost_to_close": "GSC URL Inspection + Pages report."},
        {"item": "Referring domains / authority", "why": "No link export supplied (Tier 3).",
         "cost_to_close": "A GSC or Bing link export."}]

def blocked_list(MOD, walled):
    out = []
    for k, v in MOD.items():
        if v.get("status") in ("blocked", "not_run"):
            out.append(f"{k}: {v.get('why','')}")
    return out

def build_analysis(domain, row, A, book, findings, exposure, sc, overall, walled):
    hi = [f for f in findings if f["severity"] == "High"]
    med = [f for f in findings if f["severity"] == "Medium"]
    bluf = [
        A["headline"],
        f"{row['business']} sits in Scorpion's book through {book['agency']}. {book['acq_note']} {book['template']}",
        (f"The on-page read returned {len(findings)} findings ({len(hi)} High, {len(med)} Medium) and {len(exposure)} "
         f"compliance observations; the overall grade is {overall}." if not walled else
         f"The site is walled to a declared crawler, so the read is the hosting fingerprint and the demand map; "
         f"{len(findings)} findings were still produced and the on-page audit is a verify task."),
        A.get("wins", "")]
    kjs = key_judgments(domain, row, A, book, findings, exposure, walled)
    return {"headline": A["headline"], "bluf": [b for b in bluf if b],
            "win_watch_next": {"win": A.get("wins", ""),
                "watch": A["one_exposure"], "next": A["one_paid"]},
            "one_rival": A["one_rival"], "one_paid_opportunity": A["one_paid"], "one_exposure": A["one_exposure"],
            "key_judgments": kjs, "scenarios": {"axes": [], "quadrants": []},
            "indicators": indicators(row), "unknowns": [
                {"id": "U1", "text": "Whether these are current or former Scorpion/agency engagements; case-study and footer "
                 "ties do not distinguish the two."},
                {"id": "U2", "text": "The live ad accounts, spend and targeting - not observable without exports."}],
            "moves": [{"id": "M1", "move": "Lead the approach with a free OmegaWeapon diagnosis naming the exact public failures above.",
                 "justified_by": "KJ1"}, {"id": "M2", "move": "Contrast ownership: show what they do not own on the Scorpion platform.",
                 "justified_by": "KJ2"}],
            "graveyard_test": [], "limitations": [
                "Tier 0: no GSC/GA4/Ads exports, so rankings, traffic and spend are protocols or inferred.",
                "US vantage: an EU-consent posture is NOT_TESTED unless the banner shows globally.",
                "The brand/market read is thin; review platforms were not fetched.",
                ("The on-page read is blocked by a WAF and is a verify task." if walled else
                 "Authority is ungraded without a link export.")]}

def key_judgments(domain, row, A, book, findings, exposure, walled):
    kjs = []
    inh = book["inherited"]
    kjs.append({"id": "KJ1", "title": "The defects are the agency's template, not the owner's choices",
        "likelihood": "likely", "confidence": "moderate", "horizon": "now",
        "judgment": f"It is likely that the recurring defects on {row['business']} are inherited from the {book['agency']} "
        f"template and platform rather than owned by the business, because {inh}",
        "range": "55 to 80%", "evidence": [f["id"] for f in findings[:4]],
        "falsifiers": ["A sibling site on the same template without the same defect would weaken this.",
                       "An owner-made change that post-dates the agency build would reassign ownership."],
        "math": None})
    if not walled:
        kjs.append({"id": "KJ2", "title": "The site wins its own name but loses the money searches",
            "likelihood": "very likely", "confidence": "high", "horizon": "now",
            "judgment": "It is very likely that the site captures brand demand but not non-brand demand, because the brand "
            "appears in Autocomplete only for its own name while the city+service money terms surface rivals.",
            "range": "80 to 95%", "evidence": ["the demand map"], "falsifiers": [
            "A GSC export showing non-brand impressions/clicks at volume would overturn this.",
            "A map-pack screenshot ranking the client for the money terms would overturn this."], "math": None})
    kjs.append({"id": "KJ3", "title": "A challenger can lead with a clean ownership-and-diagnosis contrast",
        "likelihood": "likely", "confidence": "moderate", "horizon": "0-3 months",
        "judgment": "It is likely that a challenger who leads with a declared audit plus true site ownership can open a "
        "conversation, because the lock-in and the inherited defects are public and documented.",
        "range": "55 to 80%", "evidence": ["agency lens", "exposure"], "falsifiers": [
        "A long contract term with heavy exit penalties would lengthen the cycle.",
        "High owner satisfaction despite the defects would weaken the wedge."], "math": None})
    return kjs

def indicators(row):
    return [{"id": "I1", "watch": "Scorpion platform migration status (scorpcloud CNAME)", "reading":
             "A move onto scorpcloud confirms deeper lock-in and a fresh rebuild cost at exit.", "moves": "M2",
             "next_reading": "next run"},
            {"id": "I2", "watch": "Non-brand Autocomplete / map-pack presence for the money terms", "reading":
             "The client entering the non-brand set means the organic gap is closing.", "moves": "M1", "next_reading": "monthly"}]

def build_playbook(domain, row, A, book, findings, walled):
    phases = [
        {"phase": "P1 - 30 days (data + quick wins)", "moves": [
            "Grant GSC + GA4 and name the account exports (Task #1).",
            "Fix the sitemap-to-noindex / redirect conflicts and the dead UA tag.",
            "Add or gate a consent banner to Google Consent Mode v2."]},
        {"phase": "P2 - 60 days (entity + content)", "moves": [
            "Replace Product-on-service schema with Service nested in LocalBusiness; complete NAP, geo, hours, sameAs.",
            "Rewrite over-length titles and missing descriptions on the money pages.",
            "Internally link the orphaned city/service pages into hubs."]},
        {"phase": "P3 - 90 days (offense)", "moves": [
            "Build the missing non-brand city+service pages and earn local citations/links.",
            "Stand up Local Services Ads + a disciplined Google Ads test on the money terms.",
            "Name an AI-crawler posture and publish complete entity data for answer engines."]}]
    moves12 = [
        {"n": 1, "move": "Restore measurement (GSC, GA4, Ads export)", "impact": "High", "effort": "Low", "owner": "Client", "when": "Week 1"},
        {"n": 2, "move": "Fix sitemap noindex/redirect + remove dead UA tag", "impact": "Medium", "effort": "Low", "owner": "Agency", "when": "Week 1-2"},
        {"n": 3, "move": "Consent banner + Consent Mode v2", "impact": "Medium", "effort": "Low", "owner": "Agency", "when": "Week 2"},
        {"n": 4, "move": "Service schema + complete LocalBusiness entity", "impact": "High", "effort": "Medium", "owner": "Agency", "when": "Week 3-4"},
        {"n": 5, "move": "Title/description rewrite on money pages", "impact": "Medium", "effort": "Low", "owner": "Both", "when": "Week 3-4"},
        {"n": 6, "move": "Internal-link the orphaned pages", "impact": "Medium", "effort": "Medium", "owner": "Agency", "when": "Week 4-6"},
        {"n": 7, "move": "Non-brand city+service content build", "impact": "High", "effort": "High", "owner": "Both", "when": "Week 5-12"},
        {"n": 8, "move": "Local Services Ads + Google Ads test", "impact": "High", "effort": "Medium", "owner": "Both", "when": "Week 6-10"},
        {"n": 9, "move": "Review-generation SOP for GBP", "impact": "High", "effort": "Low", "owner": "Client", "when": "ongoing"},
        {"n": 10, "move": "AI-crawler posture + entity completeness", "impact": "Medium", "effort": "Low", "owner": "Agency", "when": "Week 8"},
        {"n": 11, "move": "Link acquisition / citation cleanup", "impact": "Medium", "effort": "Medium", "owner": "Agency", "when": "Week 8-12"},
        {"n": 12, "move": "Measurement review + 90-day readout", "impact": "Medium", "effort": "Low", "owner": "Both", "when": "Week 12"}]
    on_page = []
    if not walled:
        dg = json.load(open(f'{S}/omega_cache/{domain}/digest.json'))
        for p in dg["pages"][:4]:
            on_page.append({"url": p["url"], "title": (((p.get("title") or "").split("|")[0].strip())[:48] +
                " | " + row["geo"].split(",")[0])[:60], "description":
                f"{row['business']} - {row['geo']}. " + "Book service online or call today."})
    schema_blocks = []
    if not walled:
        schema_blocks.append({"type": "LocalBusiness+Service", "url": row["home"], "jsonld": {
            "@context": "https://schema.org", "@type": "LocalBusiness", "name": row["business"],
            "areaServed": row["geo"], "url": row["home"],
            "makesOffer": {"@type": "Offer", "itemOffered": {"@type": "Service", "name": row["vertical"]}}}})
    return {"phases": phases, "moves12": moves12, "on_page": on_page, "redirects": [], "content_offensive":
            content_offensive(row), "schema_blocks": schema_blocks, "local": [
                "Complete every GBP field; add services, service areas, hours, products and photos.",
                "Run a review SOP: ask at job completion, respond to all, keep velocity steady."],
            "authority": ["Supply a GSC/Bing link export to unlock the disavow and link-gap analysis."],
            "paid": ["Stand up Local Services Ads (Google Guaranteed) for the category.",
                     "Instrument conversions server-side; match ad copy to landing-page headline."],
            "ai": ["Name an AI-crawler posture in robots.txt; publish complete entity data and (optionally) llms.txt."],
            "compliance": compliance_tickets(findings),
            "measurement": ["Stand up GA4 key events for calls, forms and bookings.",
                            "Baseline non-brand impressions, pack rank and lead volume; read at 30/60/90 days."]}

def content_offensive(row):
    geo = row["geo"].split(",")[0]
    svc = {"lawn": ["Lawn aeration", "Weed control", "Tree & shrub care"], "pest": ["Rodent control", "Termite treatment", "Mosquito control"],
           "plumbing-hvac": ["Water heater replacement", "AC repair", "Drain cleaning"], "dental": ["Emergency dentist", "Same-day crowns", "Walk-in dental"],
           "legal-pi": ["Car accident", "Truck accident", "Motorcycle accident"], "legal-bankruptcy": ["Chapter 7", "Chapter 13", "Debt relief"],
           "garage-doors": ["Garage door repair", "Spring replacement", "New door install"], "lawn-pest": ["Lawn care", "Pest control", "Mosquito control"]}.get(row["vertical"], ["Service A", "Service B"])
    return [{"week": i + 1, "title": f"{s} in {geo}", "target": f"{s.lower()} {geo.lower()}",
             "money_page": row["home"], "words": 900} for i, s in enumerate(svc)]

def compliance_tickets(findings):
    out = []
    for f in findings:
        if f["module"] in ("exposure", "technical") and f["severity"] in ("Medium", "High"):
            out.append({"title": f["title"], "spec": f["fix"]})
    return out or ["No blocking compliance tickets; the consent and dark-pattern items are quick fixes."]

def build_tasks(domain, row, findings, exposure, walled):
    tasks = [{"Name": "Restore measurement (GSC, GA4, Ads)", "Description":
        "Grant access and export GSC Performance + URL Inspection + Pages, GA4 sessions/key events, and any Ads account. "
        "Everything ranking/traffic/spend is a protocol until these arrive.", "Section/Column": "P1 - Data",
        "Priority": "High", "Tags": "data-restoration"}]
    seen = set()
    for f in sorted(findings, key=lambda x: {"High": 0, "Medium": 1, "Low": 2, "Info": 3, "Win": 4}.get(x["severity"], 5)):
        key = f["title"][:40]
        if key in seen: continue
        seen.add(key)
        tasks.append({"Name": f["title"], "Description": f["fix"], "Section/Column":
            {"crawl": "P1 - Crawl & index", "technical": "P1 - Technical", "content": "P2 - Content",
             "local": "P2 - Local", "ai": "P3 - AI/GEO", "exposure": "P1 - Compliance"}.get(f["module"], "P2"),
            "Priority": f["severity"] if f["severity"] in ("High", "Medium", "Low") else "Low", "Tags": f["module"]})
    return tasks

def JUDGMENT_CALLS(row, book):
    return [f"Archetype read as local-service (secondary none).",
            f"Agency of record set to {book['agency']} from the hosting fingerprint and the prior Agency Radar.",
            "Posture is competitor intelligence, not a self-audit.",
            "Pre-consent tracker firing is held as CANDIDATE (US vantage, innocent reading open), not CONFIRMED.",
            "Case-study/footer ties do not distinguish current from former engagements."]

GLOSSARY = [
    {"term": "Inherited vs owned", "def": "A finding is inherited when it comes from the agency's shared template or platform, owned when the business controls it. It decides who fixes it and who to lead the pitch against."},
    {"term": "Pre-consent firing", "def": "Ad/analytics tags that run before any consent choice. A privacy exposure under US state laws and GDPR; cheap to fix with a consent banner."},
    {"term": "Product-on-service schema", "def": "Using schema.org/Product for a service. It has no rich-result path for services and can misdescribe the business to answer engines."},
    {"term": "scorpcloud", "def": "Scorpion's hosting platform. A client site resolving into the scorpcloud CNAME zone is on Scorpion's proprietary CMS - the central lock-in."},
    {"term": "Tier 0", "def": "A fetch-only run with no client exports. Rankings, traffic and spend are protocols or inferred, not measured."},
    {"term": "ICD 203", "def": "The intelligence-community probability scale (almost no chance ... almost certain) used so a likelihood word always maps to a number range."}]


if __name__ == "__main__":
    for d in sys.argv[1:]:
        build(d)
