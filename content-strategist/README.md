# The content strategist

A Claude Code agent that plans and writes for the verticals Leviathan covers, and the toolkit it works through. The agent is `.claude/agents/leviathan-content-strategist.md`; everything it measures or sends goes through `content-strategist/cli.mjs` (Node 22, no packages).

Ask for it by name in a Claude Code session on this repository:

```
Use the leviathan-content-strategist agent to write a landing page for AC repair in Plano.
Use the leviathan-content-strategist agent to plan a page for every city we serve, from what each area needs.
Use the leviathan-content-strategist agent to plan six blog posts for the heating season.
Use the leviathan-content-strategist agent to draft Facebook and Google Business Profile posts for the new Plano page.
```

## What it holds itself to

Every landing page, blog post and content page passes one gate before it is written to disk, and `build` is the only command that writes a page.

| Rule | How it is checked |
|---|---|
| 9th grade reading level | Flesch-Kincaid over the page's prose. Above grade 9 fails and the sentences to shorten are listed; under 6 draws a warning. |
| No passive voice | A form of "to be" or "get" with a past participle, through any adverbs between them. A plain state passes: the shape a thing is in ("the coil is frozen"), a credential whoever granted it ("licensed by TDLR"), what a thing is for ("built for the new refrigerant"). A finding comes with the plain active wording where one is known: homes "went up in" a year, owners "replace" a system. |
| A homeowner's voice | The machinery behind a number named in the copy fails ("a model estimate", a survey's acronym); the source goes in plain words ("Census figures", "by one estimate"). A decimal percentage fails, and a count to the last hundred, a decimal age or a page of percentages draws a warning with the way a person would say it ("about one in five"). So do a page that never says "you", an opening on the company, and a city page whose section headings never name the city. |
| No AI tropes | Em and en dashes, bullet and numbered lists, a reflex FAQ block, bolded lead ins, "Conclusion" headings, emoji, chat leftovers, and about a hundred stock phrases. A request can allow one by name (`--allow faq`, `--allow ordered-list`). |
| No cannibalization | The page's keyword is weighed against every live URL in the sitemap. The same service in the same place is a conflict, and the build stops. That includes a city page that covers several services at once, and a blog post that carries the same subject in other words. |
| Internal links from the sitemap | Every internal link must be a live URL. Generic anchors fail, and so does anchoring another page with the page's own keyword. A page for one city is asked to name the two cities next door, each linked to its own live page. |
| Schema with every page | One JSON-LD graph: the business, the site, the page with its breadcrumb and a speakable pointer at the opening answer, and a Service, BlogPosting or Article. Validated against the page before it is written. No rating or review is ever generated. |
| The vertical's advertising rules | For the DFW pack, the atlas's Satchel rules: the TDLR license number and notice, tax credit, financing, guarantee, superiority and availability claims, each with its cite and fix. A rule the atlas grades a block fails the build; the rest warn. |
| Figures and demand | Every dollar amount, percentage and large count is looked up in the pack's facts for the market and the page's city, and the ones it cannot find are listed for the person to source. A page for an angle with no demand trigger in its city draws a warning that gives the atlas's trigger. |

Social posts go through the same writing rules plus each platform's limits. Nothing is published without `--confirm`, and the agent passes that only after the person approves the exact text. A post marked pending, because its page is not live yet, cannot be published at all.

The gate measures form. It does not know whether a claim about the business is true, so the agent is told to make none it cannot trace to the brand file or the person, and to list the ones it could not confirm.

## What each vertical knows

`verticals/` holds one pack per atlas, read from the atlases themselves.

| Depth | Packs | Holds |
|---|---|---|
| deep | `dfw` (DFW Thermal Debt Atlas, Build 6) | 20 service angles with core, city and question terms; where each angle has demand, by ZIP and by city, and where it has none; sourced facts for 119 cities as the Site Forge prints them, each with how a person would say it and its source in plain words; the heatmap layers for every ZIP and what each area needs; the cities next door to each city; the pages the Site Forge plans; the Satchel's advertising rules; the TDLR notice and consent text. |
| keywords | `hvac`, `plumbing`, `roofing`, `pest`, `dental`, `ocular`, `oncology`, `criminal`, `criminal_la`, `injury`, `injury_la`, `family`, `employment` | The keyword library the atlas keeps beside its ad copy: angles with core, question, Spanish and state terms, and the negatives. |

The atlases carry no search volumes. A keyword ranks by the demand the atlas models for its angle in a place, not by a volume.

## What each area needs

The dashboard draws its ZIP heatmaps from one catalog of layers: the age of the central systems, the decade the homes went up, the heating fuel, hail, who bought lately. The deep pack reads the same catalog and the same ZIP rows, so the agent sees what the map shows.

A need is a layer running hot in a ZIP, and the toolkit holds nineteen of them (`lib/atlas.mjs`, `NEEDS`): systems past 15 and past 20 years, R22 era systems, builder original systems, flexible duct from the 1980s and 1990s, homes from before 1980, the 2000s boom, homes from the 2010s, new homes, older gas furnaces, gas heat, electric heat, heat pumps, hail, new owners, larger homes. Each says the point to get across to the owner and the trade detail behind it. Three more (rentals, older owners, Spanish speaking households) are for planning only and never reach a reader.

```
node content-strategist/cli.mjs areas dfw                 every city by what runs hot there
node content-strategist/cli.mjs areas dfw --need hail     the cities that share one need
node content-strategist/cli.mjs brief Plano               the plan for one city page
```

`brief` is what the agent writes a city page from. It says who the reader is (the year the typical home dates to, how that differs across the city's ZIP codes, what they heat with), what sets the place apart in order, what is true in part of town only and in which ZIP, what is common elsewhere and not the story here, each measure here against the whole market, every ZIP with the figures that bear on it, the figures as a person says them, the live pages to link to and the neighbors to name. A city outside the mapped area gets a brief that says so, with no local figure.

A city is not its ZIP codes. One ZIP is often shared by a small city and the big one beside it: the ZIP codes of the smallest cities here hold up to nine times the homes the city does. So the pack keeps two things for every city: its own figures on the layers, from the city's own record in the dashboard (`own`), and the share of its ZIP codes' systems that sit in the city (`coverage`). At three quarters or more, the ZIP codes are the city and decide its needs, part of town by part of town. Under that, the city's own figures decide, and a need that only its ZIP codes show is kept as true of that ZIP and never said of the city. Hail is the exception, since a storm does not stop at a city line. The first briefs read every city from its ZIP codes, and for a third of the cities that described the neighbors: a town where six homes in ten heat with gas was written up as mostly electric. The writers caught it as a brief that contradicted itself.

A need runs hot by where a ZIP stands among the market's ZIPs, the way the map colors it. The brief prints the measure itself beside it, here and across the market, and says when the gap is small, so a page does not write up a three point difference as a local crisis.

## What a round of client review changed

A set of city pages went to a client, and the client sent back their own edited versions. The toolkit now holds itself to what those edits did.

The pages read like a report, and the client made them talk to the owner of the house. Figures written to the decimal became "about one in five". "A model estimate built from Census housing data" became "Census figures put the typical home here at 1993". Openings that named the company first became openings on the reader's situation. Section labels became headings that name the service and the city. Every page gained a sentence naming two neighboring cities, each linked to its own page. The voice checks, the spoken form on every fact, the neighbor links and the `brief` command come from that review.

The client's edits also brought back passive voice ("homes were built", "is typically replaced"), which the gate still refuses. It now gives the plain active wording with the finding, so the fix reads naturally.

`compare` checks more than it did. A sentence of four words or more that turns up on three pages fails the set, and so does a section heading on four pages with only the city swapped. The closing lines of a set are where the sameness was.

Rebuild the keyword packs after a new console build lands in `leviathan/`, and the deep pack when a new build of the atlas file arrives:

```
node content-strategist/cli.mjs harvest
node content-strategist/cli.mjs connect path/to/DFW_Thermal_Debt_Atlas.html
```

`connect` (the older name `extract` still works) connects the dashboard for this agent and for the paid ads specialist at once, through `dashboard-link/`. `connect <file> --pin` makes that file the only version of the dashboard the toolkit will take: its fingerprint goes on the pack in the repository, and from then on any other version is refused before anything is read, in this and every later session, until another `connect --pin` moves the pin. `where` names the pinned file. A copy of the pinned dashboard with the Agent Desk and work on it is still the pinned dashboard. The pack is read from the atlas as text: nothing in it is run except the one line triggers of the service angles, each checked against a whitelist first. The brand the atlas was built for goes to the local brand file. A pack already read from the same dashboard file by the same reader is left untouched, so connecting twice changes nothing under git. When the reader learns to read more from a dashboard (the heatmaps were the last such step), a pack an older reader left is read again on the next `connect`.

## Where client files live

Outside the repository, in `~/.leviathan/content-strategist/`: the brand file, the sitemap inventory, drafts, built pages and the ledger of posts. The console's build scans every file under the repository, ignored by git or not, and refuses it while a withheld name is anywhere in it, so nothing that names a client may sit in the tree. The packs are scanned against the same list before they are written, and a pack never carries a brand.

The brand file may carry `neighbors`, the client's own choice of the cities to name beside each city (`{"Plano": ["Allen", "Richardson"]}`); it wins over the map. Whatever a person adds to the brand file that the dashboard does not carry stays there when the dashboard is connected again.

`CS_LOCAL`, `CS_OUT` and `CS_BRAND` move those paths. A cloud session starts on a fresh machine, so give it the brand one of three ways: attach the dashboard file and run `connect`, fill a copy of `brand.example.json`, or set `CS_BRAND_JSON` in the environment to the same JSON.

## Commands

```
node content-strategist/cli.mjs where                       the dashboard connected, the brand on file, the sitemap, where client files go
node content-strategist/cli.mjs connect atlas.html [--pin]  connect a dashboard (shared with the paid ads specialist); --pin makes it the only version taken
node content-strategist/cli.mjs dashboard                   what is connected and the doors it has for pages
node content-strategist/cli.mjs verticals                   the packs
node content-strategist/cli.mjs keywords dfw --city Plano   angles by demand in a city, the city filled in
node content-strategist/cli.mjs market dfw --city Plano     sourced local facts
node content-strategist/cli.mjs areas dfw                   every city by what runs hot on the heatmaps
node content-strategist/cli.mjs brief Plano                 the plan for one city page, ZIP by ZIP
node content-strategist/cli.mjs rules dfw                   the advertising rules, the license format, the notice text
node content-strategist/cli.mjs sitemap                     read the client's sitemap (or: sitemap saved-file.xml)
node content-strategist/cli.mjs cannibal "ac repair plano"  who already holds a keyword
node content-strategist/cli.mjs links "ac repair plano"     live pages to link to, with anchors
node content-strategist/cli.mjs lint draft.md               the writing and page checks alone
node content-strategist/cli.mjs build draft.md              the whole gate; writes the page, schema and blueprint
node content-strategist/cli.mjs compare folder-of-pages     how alike a set of pages is, place names masked: runs, sentences, headings
node content-strategist/cli.mjs handoff                     the built pages for the dashboard: onto its Agent Desk, and as one file for Publish, tried there first
node content-strategist/cli.mjs panel [--forget id|all] [--no-repairs | --repairs]
                                                            write the dashboard copy with the Agent Desk again, and say what is on it
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

`handoff` also puts the pages on the Agent Desk, so nobody has to carry a file. It writes `handoff.json` beside the pages file (the same blueprints with what the gate measured for each page: its address, keyword, words, reading grade, schema and the warnings left in), and writes a copy of the dashboard with the Agent Desk in it, `~/.leviathan/dashboard/<Atlas>_Build_<n>_Agent_Desk.html`. The connected dashboard itself is never written to. A person opens the copy, chooses Agent Desk, the last module, reads the pages there and sends them to Publish with one button, through that same import box; they land as drafts. Handing over every built page replaces the set that was on the Agent Desk; handing over pages by name adds a hand-off of their own. Publish keeps pages only while the dashboard is open, and the Agent Desk says so when pages sent before are no longer there. The copy also carries repairs to the layout of the dashboard's own modules, where text and controls overlapped; `panel --no-repairs` leaves them out. `dashboard-link/README.md` has the whole of it.

The tests compile both fixture blueprints with the Forge compiler inside the console's DFW atlas, and the link's own browser tests drop a pages file on that atlas's Publish module and send the pages there from the Agent Desk. The Forge notes that such a page has no FAQ section, which is by design.

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

Nine files, no network: the atlas reader, the heatmap needs and the packs on disk (in step with the console, nothing withheld), the writing gate with the voice checks, the brief for a city page, the sitemap reader with cannibalization, links and neighbors, the schema and the blueprint compiled by the Site Forge, social posting against a stand in, the uniqueness check for a set of city pages, the command line end to end, and the dashboard commands (`connect`, `dashboard`, `handoff`) in a sandbox. The browser test that drops this agent's pages on a running dashboard's Publish module is with the link: `node dashboard-link/tests/e2e/run.mjs`.

## Limits

A need is a reading of the map, not of a house: it says what is common in a ZIP, and the copy has to say "many" and "likely". The dashboard has no city figure for hail, new owners or home size, so for a city that fills less than half of its ZIP codes those stay ZIP points. A city's heat pump share is worked out the way the dashboard models a ZIP's, from the city's electric heated share. The cities next door come from straight line distance between city centers unless the brand file lists the client's own (`neighbors`). Passive voice and syllable counts are heuristics. They are tuned to over report passives slightly, and a reading grade can sit a few tenths from another tool's. Only `dfw` is a deep pack; the Louisiana Thermal Debt Atlas shares its family but is read as a keyword pack for now. The inventory reads a URL's keyword from its slug unless `sitemap --deep` can fetch the pages for their titles and h1.
