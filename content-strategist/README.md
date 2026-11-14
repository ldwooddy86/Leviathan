# The content strategist

A Claude Code agent that plans and writes for the verticals Leviathan covers, and the toolkit it works through. The agent is `.claude/agents/leviathan-content-strategist.md`; everything it measures or sends goes through `content-strategist/cli.mjs` (Node 22, no packages).

Ask for it by name in a Claude Code session on this repository:

```
Use the leviathan-content-strategist agent to write a landing page for AC repair in Plano.
Use the leviathan-content-strategist agent to plan six blog posts for the heating season.
Use the leviathan-content-strategist agent to draft Facebook and Google Business Profile posts for the new Plano page.
```

## What it holds itself to

Every landing page, blog post and content page passes one gate before it is written to disk, and `build` is the only command that writes a page.

| Rule | How it is checked |
|---|---|
| 9th grade reading level | Flesch-Kincaid over the page's prose. Above grade 9 fails and the sentences to shorten are listed; under 7 draws a warning. |
| No passive voice | A form of "to be" or "get" with a past participle, through any adverbs between them. A plain state in the present tense ("the coil is frozen", "we are licensed") passes unless a "by" phrase names the actor. |
| No AI tropes | Em and en dashes, bullet and numbered lists, a reflex FAQ block, bolded lead ins, "Conclusion" headings, emoji, chat leftovers, and about a hundred stock phrases. A request can allow one by name (`--allow faq`, `--allow ordered-list`). |
| No cannibalization | The page's keyword is weighed against every live URL in the sitemap. The same service in the same place is a conflict, and the build stops. That includes a city page that covers several services at once, and a blog post that carries the same subject in other words. |
| Internal links from the sitemap | Every internal link must be a live URL. Generic anchors fail, and so does anchoring another page with the page's own keyword. |
| Schema with every page | One JSON-LD graph: the business, the site, the page with its breadcrumb and a speakable pointer at the opening answer, and a Service, BlogPosting or Article. Validated against the page before it is written. No rating or review is ever generated. |
| The vertical's advertising rules | For the DFW pack, the atlas's Satchel rules: the TDLR license number and notice, tax credit, financing, guarantee, superiority and availability claims, each with its cite and fix. A rule the atlas grades a block fails the build; the rest warn. |
| Figures and demand | Every dollar amount, percentage and large count is looked up in the pack's facts for the market and the page's city, and the ones it cannot find are listed for the person to source. A page for an angle with no demand trigger in its city draws a warning that gives the atlas's trigger. |

Social posts go through the same writing rules plus each platform's limits. Nothing is published without `--confirm`, and the agent passes that only after the person approves the exact text. A post marked pending, because its page is not live yet, cannot be published at all.

The gate measures form. It does not know whether a claim about the business is true, so the agent is told to make none it cannot trace to the brand file or the person, and to list the ones it could not confirm.

## What each vertical knows

`verticals/` holds one pack per atlas, read from the atlases themselves.

| Depth | Packs | Holds |
|---|---|---|
| deep | `dfw` (DFW Thermal Debt Atlas, Build 6) | 20 service angles with core, city and question terms; where each angle has demand, by ZIP and by city, and where it has none; sourced facts for 119 cities as the Site Forge prints them; the pages the Site Forge plans; the Satchel's advertising rules; the TDLR notice and consent text. |
| keywords | `hvac`, `plumbing`, `roofing`, `pest`, `dental`, `ocular`, `oncology`, `criminal`, `criminal_la`, `injury`, `injury_la`, `family`, `employment` | The keyword library the atlas keeps beside its ad copy: angles with core, question, Spanish and state terms, and the negatives. |

The atlases carry no search volumes. A keyword ranks by the demand the atlas models for its angle in a place, not by a volume.

Rebuild the keyword packs after a new console build lands in `leviathan/`, and the deep pack when a new build of the atlas file arrives:

```
node content-strategist/cli.mjs harvest
node content-strategist/cli.mjs connect path/to/DFW_Thermal_Debt_Atlas.html
```

`connect` (the older name `extract` still works) connects the dashboard for this agent and for the paid ads specialist at once, through `dashboard-link/`. The pack is read from the atlas as text: nothing in it is run except the one line triggers of the service angles, each checked against a whitelist first. The brand the atlas was built for goes to the local brand file. A pack already read from the same dashboard file is left untouched, so connecting twice changes nothing under git.

## Where client files live

Outside the repository, in `~/.leviathan/content-strategist/`: the brand file, the sitemap inventory, drafts, built pages and the ledger of posts. The console's build scans every file under the repository, ignored by git or not, and refuses it while a withheld name is anywhere in it, so nothing that names a client may sit in the tree. The packs are scanned against the same list before they are written, and a pack never carries a brand.

`CS_LOCAL`, `CS_OUT` and `CS_BRAND` move those paths. A cloud session starts on a fresh machine, so give it the brand one of three ways: attach the dashboard file and run `connect`, fill a copy of `brand.example.json`, or set `CS_BRAND_JSON` in the environment to the same JSON.

## Commands

```
node content-strategist/cli.mjs where                       the dashboard connected, the brand on file, the sitemap, where client files go
node content-strategist/cli.mjs connect atlas.html          connect a dashboard (shared with the paid ads specialist)
node content-strategist/cli.mjs dashboard                   what is connected and the doors it has for pages
node content-strategist/cli.mjs verticals                   the packs
node content-strategist/cli.mjs keywords dfw --city Plano   angles by demand in a city, the city filled in
node content-strategist/cli.mjs market dfw --city Plano     sourced local facts
node content-strategist/cli.mjs rules dfw                   the advertising rules, the license format, the notice text
node content-strategist/cli.mjs sitemap                     read the client's sitemap (or: sitemap saved-file.xml)
node content-strategist/cli.mjs cannibal "ac repair plano"  who already holds a keyword
node content-strategist/cli.mjs links "ac repair plano"     live pages to link to, with anchors
node content-strategist/cli.mjs lint draft.md               the writing and page checks alone
node content-strategist/cli.mjs build draft.md              the whole gate; writes the page, schema and blueprint
node content-strategist/cli.mjs compare folder-of-pages     how alike a set of pages is, with place names masked
node content-strategist/cli.mjs handoff                     the built pages as one file for the dashboard's Publish module, tried there first
node content-strategist/cli.mjs check pages.json            hand a pages file or one blueprint to the running dashboard
node content-strategist/cli.mjs social lint post.json
node content-strategist/cli.mjs social post post.json --platform all            a dry run
node content-strategist/cli.mjs social post post.json --platform all --confirm  publishes
node content-strategist/cli.mjs social whoami               which Page and Business Profile the credentials reach
```

Add `--json` to any command for machine output.

A site that answers a script with a bot challenge cannot be read from here. `sitemap` says so. Save the page and post sitemaps from a browser and pass the files (`--add` merges a second one), or pass a list of live URLs, one a line.

## Working with the dashboard

The agent connects to a dashboard in both directions, through the link it shares with the paid ads specialist (`dashboard-link/`).

In: `connect <atlas.html>` reads the dashboard file for the deep pack and the brand, records which build it was, and finds the doors that build has for pages. `dashboard` shows them.

Out: `handoff` puts the built pages into one file, `pages-for-publish.json`, in the form the dashboard's Publish module (module 16) reads: a `pages` list of FORGE blueprints. Dropped on Publish's import box, each blueprint is compiled by the Site Forge's own compiler and listed as a draft. Where Playwright and Chromium are on the machine, `handoff` does exactly that to the running dashboard first, headless and with every network request refused, and reports what Publish listed. One page can also go in by hand: paste its `blueprint.json` into the Blueprint view of the Site Forge's page studio and choose Use edited blueprint.

The tests compile both fixture blueprints with the Forge compiler inside the console's DFW atlas, and the link's own browser tests drop a pages file on that atlas's Publish module. The Forge notes that such a page has no FAQ section, which is by design.

The schema uses the same ids the Forge compiles (`<site>/#organization`, `<site>/#website`, `<page>#webpage`), so the two merge on a site that carries both.

## Credentials for posting

Tokens never go in a file here or in a chat message.

| Platform | Needs | Where |
|---|---|---|
| Facebook Page | A Page access token with `pages_manage_posts` | The environment's network secret for `graph.facebook.com`, or `FB_PAGE_ACCESS_TOKEN`. The Page id comes from `social.facebookPageId` in the brand file or `FB_PAGE_ID`. |
| Google Business Profile | OAuth with the `business.manage` scope, on a Google Cloud project approved for the Business Profile APIs | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GBP_REFRESH_TOKEN`, or a short lived `GBP_ACCESS_TOKEN`. The account and location ids come from `social.gbpAccountId` and `social.gbpLocationId` in the brand file, or `GBP_ACCOUNT_ID` and `GBP_LOCATION_ID`; `social whoami` lists them. |

Posts go to Graph API `v26.0` (`FB_GRAPH_VERSION` changes it) and to the Business Profile `v4` local posts endpoint. The ledger records what was sent and refuses to send the same text to the same platform twice.

## Tests

```
node content-strategist/tests/run.mjs
```

Eight files, no network: the atlas reader and the packs on disk (in step with the console, nothing withheld), the writing gate, the sitemap reader with cannibalization and links, the schema and the blueprint compiled by the Site Forge, social posting against a stand in, the uniqueness check for a set of city pages, the command line end to end, and the dashboard commands (`connect`, `dashboard`, `handoff`) in a sandbox. The browser test that drops this agent's pages on a running dashboard's Publish module is with the link: `node dashboard-link/tests/e2e/run.mjs`.

## Limits

Passive voice and syllable counts are heuristics. They are tuned to over report passives slightly, and a reading grade can sit a few tenths from another tool's. Only `dfw` is a deep pack; the Louisiana Thermal Debt Atlas shares its family but is read as a keyword pack for now. The inventory reads a URL's keyword from its slug unless `sitemap --deep` can fetch the pages for their titles and h1.
