# The paid ads specialist

A Claude Code agent that plans and writes paid media for a Leviathan dashboard, and the toolkit it works through. The agent is `.claude/agents/leviathan-paid-ads-specialist.md`; everything it measures or builds goes through `paid-ads/cli.mjs` (Node 22, no packages). It connects to a dashboard through `dashboard-link/`, the same connection the content strategist uses.

Ask for it by name in a Claude Code session on this repository:

```
Use the leviathan-paid-ads-specialist agent to plan $12,000 a month of heating ads from November 23.
Use the leviathan-paid-ads-specialist agent to pick keywords and negatives for furnace repair in Mesquite.
Use the leviathan-paid-ads-specialist agent to write the search and Meta ads for the heating plan and build the files.
```

Start a job by giving it the dashboard file. It runs `connect` on it and works from there.

## What it is

The agent's definition gives it the judgment of fifteen years in paid media: demand capture before demand creation, fewer channels funded properly, one job to an ad group, negatives as half the work, copy that asks for one action and says what happens next. Its evidence is never its own. Markets, service lines, keywords, benchmarks and rules come from the connected dashboard; platform limits come from the channel book, each with the page it was read on; claims about the business come from the brand file or from the person. It is told never to invent a past campaign, a result, a benchmark or a statistic.

It never spends money and never touches an ad account. Every campaign and every ad in its files is paused, and a person imports them.

## What the dashboard gives it

| Command | From the dashboard |
|---|---|
| `lines` | The 14 service lines: ticket, margin, close rate, cost a lead by platform, season, platform fit, hooks, the weather and calendar triggers, bids by hour |
| `markets` | 263 ZIP markets ranked as the dashboard ranks them: tier, bid adjustment, competitor pressure, quiet auctions, audience levers, minutes from the shop |
| `keywords` | The keyword library by service angle, set out in ad groups with match types, each term marked with its intent, and the negatives for the line |
| `rules` | The 22 advertising rules (TDLR license, the ended tax credit, Regulation Z, guarantees, superlatives, reviews, house style), the license format, the consent text |
| `competitors` | The competitor roster with what each company's site offered |
| `heat` | The Heat Desk's plan and its reading of the week's forecast, from the running dashboard |
| `plan` | A media plan on the Campaign Desk's own model: markets, platform split, forecast, flight |

The dashboard holds no search volumes and no auction prices. Its costs and rates are benchmarks it grades A (measured) to D (assumed), and the toolkit prints the grade beside the number.

## The channel book

`channels` lists every paid channel a business in the United States can buy, 28 in all: Google Search, Microsoft, Local Services, Performance Max, Demand Gen, YouTube, Display, Meta, TikTok, Nextdoor, LinkedIn, Snapchat, Pinterest, Reddit, X, Yelp, Angi, Thumbtack, connected television, Amazon, Spotify, radio and streaming audio, programmatic, Every Door Direct Mail and outdoor, and the three that are closed to a home service contractor (Apple Maps, Waze, retail media) with the reason.

For each: what it is for, how it is bought, how finely it targets, what it costs to enter, the ad formats with their limits and buttons, the rules that trip people, how to measure it, and how well it fits emergency, considered, maintenance, business to business and recruiting work. Every limit carries a grade for how it is known (A read on the platform's own page, B seen as an excerpt, D from memory) and the book carries the date it was read: November 14, 2026. Platforms change without notice; the agent is told to read a platform's page again when a figure matters and its grade is low or its date is old.

## The gate

`build` is the only command that writes a campaign, and it writes nothing while the gate holds an error. `lint` runs the same gate and writes nothing. A draft, which is the dashboard's own library copy, fails the gate for being a draft.

| Checked | How |
|---|---|
| The plan | The line, dates, markets, mix and bids are held to what the Campaign Desk accepts, so the desk cannot change the plan without a word. Warnings for a platform or a language funded under its daily floor, a small budget spread across many platforms, a market more than 45 minutes from the shop, a start date in the past, a job value left at the desk's default when the line's own ticket is far from it, and Maximize conversions on a plan that steers by ZIP. Money for channels the desk does not plan is totalled, marked as on top of the plan and outside the forecast, and held to the platform's own daily minimum where the book has one. |
| Keywords | Form and match type. A keyword in two ad groups, a negative that stops the campaign's own keyword, and a job seeker's search off the recruiting line are errors. Broad match, the same words in two ad groups under different match types, a competitor's name, an ad group that mixes jobs or mixes research with buying searches, a negative without its plural, and a Spanish campaign that bids only on English searches are called out. |
| Landing pages | Every ad has one. Where the content strategist has read the site's sitemap on the machine, each landing page is checked against it and one that is not there draws a warning: a path from the dashboard's library is the Site Forge's plan for a page, not proof of one. Where it has not, the gate says no page was checked. |
| Platform limits | Counts and characters for every format, from the channel book. A responsive search ad takes 3 to 15 headlines of 30 and 2 to 4 descriptions of 90. Google's 13 structured snippet headers. What shows before a social ad is cut. A script against its seconds. |
| The dashboard's rules | All 22, applied as the Campaign Desk applies them. A rule the dashboard grades a block fails the build: no license number, the ended federal tax credit, credit terms without their disclosures, a hyphen or dash in copy, a placeholder. |
| The license in every impression | Google always shows Description position 1 and nothing else among the descriptions. The gate warns until the description that carries the license is pinned there, or every description carries it. |
| A call to action | Every ad asks for an action. None in a search ad's headlines is an error. Only "learn more" or "contact us", none in a description, or no "call" on a line bought for calls is a warning. |
| Persuasion | Six things counted in every ad: the service or problem named, a benefit, proof the reader can check, something that lowers the risk of calling, a call to action that says what happens next, a concrete detail. Under four draws a warning. Stock phrases and passive voice are flagged. |
| Claims | Every price, "free", guarantee, hours claim, promise of when, limit or deadline, rating, superlative or comparison, years in business, credential, financing offer and credit term is looked up in the brand file. One the file contradicts fails the build: a rating above the one on file, "24/7" against stated hours, the wrong founding year. One nobody has vouched for draws a warning until the person confirms it and the campaign file records their words. A confirmation quotes the claim itself, so one answer cannot vouch for every claim of a kind; a superlative needs a basis the reader can check; a credit term (a rate, a payment, a number of payments, a down payment, however worded) needs the lender's disclosure wording. |
| Names and numbers | A license number in the copy that is not the one on file, and a competitor from the dashboard's roster named in an ad, are errors. |
| Demand | An angle the dashboard's model finds no trigger for in the markets bought draws a warning that gives the model's trigger. |

A person can ask for a rule to be set aside by name (`--allow kw-theme`, `--allow HOUSE1`): any warning, and the errors that are matters of house policy or structure. A platform limit, a file the Campaign Desk would not take, a rule of law and a claim the brand file contradicts are never set aside, and a name that is no rule stops the command. What was set aside is printed, written to `report.json` and listed in the README the build writes.

The gate measures form and traces claims. It cannot know whether a claim is true, or whether an ad is good. An ad that passes can still be dull; an ad that fails cannot ship.

The review score in an ad is never typed: copy writes `{reviews.rating}` and "over {reviews.floor} reviews", the gate fills them from the one figure on file before it measures a line, and the bulk files carry the numbers while the campaign file keeps its tokens. An ad that names a manufacturer the client's site does not show, and the brand file does not vouch for, fails the gate; a keyword that bids on one draws a warning. `reviews` and `makes` are the two commands; [the dashboard link](../dashboard-link/README.md#what-copy-may-claim-the-review-score-and-the-makers) has the detail.

## What it hands back

`build` writes a folder outside the repository:

```
campaign-desk-plan.json                the plan, for the dashboard's Campaign Desk to load
campaign-plan_<line>_<date>.csv        the markets with their bid adjustments and monthly dollars
google-ads-editor_<line>_<date>.csv    search campaigns for Google Ads Editor, every campaign and ad paused
microsoft-ads_<line>_<date>.csv        the same sheet for Microsoft Advertising
meta-build-sheet_<date>.csv            build sheets to enter by hand, one a platform in the plan:
nextdoor-build-sheet_<date>.csv          Meta, Demand Gen, Nextdoor, Yelp, Local Services, LinkedIn
other-channels-build-sheet_<date>.csv  channels the desk does not plan (TikTok, mail, television, audio)
keywords_<line>_<date>.csv             every keyword with its ad group, match type and intent
creative_<line>_<date>.csv             every line of copy with its length, limit and pin
campaign.json                          the campaign file the folder was built from
report.json                            what the gate measured, every claim and who vouched for it
README.md                              what to do with each file, for the person who gets the folder
handoff.json                           all of the above as one file, for the Agent Desk in the dashboard
```

Every campaign and every ad in the files is paused. Ad groups, keywords and assets inside a paused campaign are enabled, and serve nothing until a person switches the campaign on.

The search file follows Google Ads Editor's documented columns where the dashboard's own export differs: a sitelink's page goes in `Final URL`, a call asset's country in `Country of phone`, a structured snippet takes the header `Service catalog`, a pinned asset gets its position column, and the campaign ends on the flight's last day. It also bids differently. The dashboard's export asks for Maximize conversions beside ZIP bid adjustments, and Google's Smart Bidding does not use manual bid adjustments; these files ask for Maximize clicks with a maximum CPC bid limit, where the adjustments are in force (the dashboard's own Heat Desk plans its campaigns the same way). A campaign file can name another strategy, give an ad group its own bid, and change the 30% of search money the desk gives a Spanish campaign.

The files carry a flat daily budget and no ad schedule. The README in the folder says what the season would have the daily budget be by month, which hours the brand file says the phone is answered, which claims still need the owner's word, which warnings were left in, and which rules were set aside. Campaigns keep the dashboard's naming, `DFW_<LINE>_<PLATFORM>_<LANGUAGE>_<start date>`, so its Accounts module files their results under the right service line. A campaign file with a `slug` carries it on the end of every campaign name (`..._FURNACE_REPLACEMENT`), so several campaigns on one line with one start date stay apart when their files are imported one after another; Google Ads Editor matches campaigns by name.

## The dashboard

In: `connect <atlas.html>`. See `dashboard-link/README.md` for what is read and where it is kept.

Out: the Agent Desk. `build` puts the campaign on the Agent Desk of a copy of the dashboard (`~/.leviathan/dashboard/<Atlas>_Build_<n>_Agent_Desk.html`; the connected dashboard itself is never written to) and says where the copy is. A person opens it and chooses Agent Desk, the last module. There the plan loads on the Campaign Desk with one button and the desk is read back; the specialist's own copy is read ad by ad, each screened by the dashboard's own rules; the claims nobody has vouched for wait for the owner; the launch checks and every file of the folder are at hand. With a browser on the machine `build` opens the copy to see that the Agent Desk lists the campaign. `handoff.json` in the folder is the same hand-off as one file, to drop on the Agent Desk of any copy. The copy also carries repairs to the layout of the dashboard's own modules, where text and controls overlapped; `panel --no-repairs` leaves them out. `dashboard-link/README.md` has the whole of it.

The owner's answers come back as a file. On the Agent Desk the owner confirms a claim in their own words, with their name, or says to cut it, and saves `owner-answers.json`. `answers owner-answers.json campaign.json` records each confirmation under `confirmed` in the campaign file and says whether the gate takes it (a superlative with no basis, a credit term with no disclosure wording and a claim the brand file contradicts are still refused), and lists every line that carries a claim to cut. It does not rewrite copy: the lines are the writer's. An answers file is the owner's word only when a person hands it over; the agent never writes one.

By hand, the older way still works: `campaign-desk-plan.json`. In the dashboard, open the Campaign Desk (module 08), press ⤒ Load and choose the file. The desk then shows the plan: the markets, the split, the forecast and the flight.

The plan model here is a port of that Campaign Desk, so a plan made here says what the desk will say. Three things keep that honest. The pack carries a fingerprint of the desk's code, and the toolkit says when the connected dashboard is not a build the model was checked against (Build 6 is). The browser tests put eleven plans through the running desk and compare markets, angles, mix, forecast, flight and the desk's own exported files with the port's, byte for byte. And where Playwright and Chromium are on the machine, `build` screens the copy with the running dashboard's own rule tests and loads the plan through the desk's own Load button, then reports whether the desk's figures match. When they do not, the report says so and the desk's figures are the ones to quote.

The Campaign Desk writes its own ad copy from its library, so the agent's copy does not appear on the desk. It is on the Agent Desk, and it travels in the bulk files.

For a heating buy, `plan --from-heat` starts from the Heat Desk's plan for the month the flight mostly runs in (`--month` picks another): its ZIPs, its bid adjustments and the platform shares that run after its minimums. `--within` holds those ZIPs to a drive time and `--mix` replaces its split, and the command says when either has moved the plan away from the Heat Desk's own. The Heat Desk and the Campaign Desk are two models and give different figures for the same money; the Heat Desk weighs drive time, cold and competition by ZIP, and the agent is told to quote it for heating and to say which plan its figure is for. The plan also prints the Heat Desk's reading of each ZIP and the share of the month it holds back as a freeze reserve.

Every command refuses an option it does not know and a value that makes no sense (a budget below zero, a date that does not exist, a ZIP the dashboard does not score), so nothing is ignored without a word. `draft` will not write over a campaign file someone has rewritten, and `build` will not write one campaign over another's folder.

## Where client files live

Outside the repository, in `~/.leviathan/paid-ads/`: plans and campaign files in `drafts`, built campaigns in `out`. `PA_LOCAL` and `PA_OUT` move them. The brand file and the dashboard's model sit beside them (`~/.leviathan/content-strategist/brand.json`, `~/.leviathan/dashboard/`). The console's build scans every file under the repository, ignored by git or not, and refuses it while a withheld name is anywhere in it, so the commands refuse to write a plan or a campaign inside the tree.

## Commands

```
node paid-ads/cli.mjs where                      the dashboard connected, the brand on file, where client files go
node paid-ads/cli.mjs connect atlas.html         connect a dashboard (shared with the content strategist)
node paid-ads/cli.mjs dashboard                  what is connected and the doors it has
node paid-ads/cli.mjs lines [id]                 the service lines
node paid-ads/cli.mjs markets --line heat --within 25
node paid-ads/cli.mjs keywords furnace --city Mesquite
node paid-ads/cli.mjs rules
node paid-ads/cli.mjs competitors --find name
node paid-ads/cli.mjs heat --budget 12000        the Heat Desk's plan (runs the dashboard)
node paid-ads/cli.mjs channels [id] [--for emergency]
node paid-ads/cli.mjs plan --line heat --budget 12000 --start 2026-11-23 --weeks 10 --from-heat
node paid-ads/cli.mjs draft plan.json            a campaign file started from the dashboard's library
node paid-ads/cli.mjs lint campaign.json         the gate, writing nothing
node paid-ads/cli.mjs build campaign.json        the gate, the files, the check against the running dashboard, the hand-off to the Agent Desk
node paid-ads/cli.mjs answers owner-answers.json campaign.json
                                                 the owner's answers from the Agent Desk, put into a campaign file
node paid-ads/cli.mjs panel [--forget id|all] [--no-repairs | --repairs]
                                                 write the dashboard copy with the Agent Desk again, and say what is on it
node paid-ads/cli.mjs check campaign-desk-plan.json
node paid-ads/cli.mjs read file-from-the-dashboard.json
```

Add `--json` to any command for machine output.

## Tests

```
node paid-ads/tests/run.mjs        no browser
node paid-ads/tests/e2e/run.mjs    with a browser: the running Campaign Desk
```

Six files without a browser: the channel book's integrity and the figures the gate leans on, keyword intent and negatives, the copy gate rule by rule, the plan model's arithmetic and files, the campaign gate with the hand-off it makes, and the command line end to end in a sandbox, `answers` included. They use the DFW atlas the console carries (Build 4) and a made up brand, so no client file is needed.

The browser test runs the whole command line against that atlas with the dashboard open: connect, plan, draft, build with the live screen and the live load. Build 4 is not a build the plan model claims to mirror, and the test holds the toolkit to saying so rather than claiming a match it did not check. Point `ATLAS_HTML` at a Build 6 dashboard file to run the eleven plan parity check and the same command line flow against it; nothing from that file is printed but counts. The Agent Desk itself is driven in a browser by `dashboard-link/tests/e2e/panel.test.mjs`, which builds a campaign with this command line first.

```
ATLAS_HTML=path/to/atlas.html node paid-ads/tests/e2e/run.mjs
```

## Limits

The plan model mirrors Build 6 of the DFW Thermal Debt Atlas; another build is flagged, and its own desk is the authority. A forecast is the desk's arithmetic on benchmarks graded C and D, a starting point and not a promise. The bulk files were checked against Google Ads Editor's documented columns and against the dashboard's own exports; they have not been imported into a live ad account from here, so review Editor's proposed changes before posting. Intent, calls to action, persuasion and claims are read by pattern: they catch the common cases and miss unusual phrasing, and they do not replace a person reading the ad. Only search has a bulk import file; every other channel gets a build sheet to enter by hand. The keyword library is English; Spanish searches are the agent's own and it says so.
