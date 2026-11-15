# The dashboard link

How Leviathan's agents connect to a dashboard. One connection serves the paid ads specialist (`paid-ads/`) and the content strategist (`content-strategist/`): each agent's own command line takes `connect`, `dashboard` and `panel`, and all three go through the code here. Node 22, no packages.

A dashboard is a Thermal Debt atlas as one `.html` file (the DFW Thermal Debt Atlas, Build 6, is the one this was built against). The link never changes that file, and nothing it reads leaves the machine. The one thing it adds to a dashboard, the Agent Desk, it adds to a copy.

## What connecting does

```
node dashboard-link/cli.mjs connect path/to/DFW_Thermal_Debt_Atlas_Build6.html
```

The file is read once, as text, and three things are left behind.

| Where | What | For |
|---|---|---|
| `content-strategist/verticals/<id>.json` | The deep pack: service angles by demand per city, sourced local facts, the Site Forge's page plan, the advertising rules | content strategist |
| `paid-ads/packs/<id>.json` | The paid library: service angles with keywords and ad copy, the negatives, the platform book with its graded benchmarks, the service lines' stated economics, the 22 advertising rules, a fingerprint of the Campaign Desk's code | paid ads specialist |
| `~/.leviathan/dashboard/` | The connection record, a copy of the dashboard file, the ZIP by ZIP paid model, the competitor roster, and (with a browser) what the running dashboard computes | both |
| `~/.leviathan/content-strategist/brand.json` | The brand the dashboard was built for: name, license, phone, site, hours, offer, proof points | both |

The two packs are shared by a vertical and live in the repository. Each is scanned against the withheld list before it is written and never carries a brand, a ZIP model or a competitor. Everything that names or describes the client lives outside the repository, under `~/.leviathan` (`LEVIATHAN_HOME` moves it). A pack is rewritten only when the dashboard file differs from the one it was read from, so connecting the same file twice changes nothing under git.

Nothing in the dashboard is executed to read it, except the one line triggers of the service angles, each checked against a whitelist first.

## The doors

Work reaches the dashboard through the doors it already has, the ones a person opens with its own controls. `doors` lists what the connected build has. The Agent Desk, below, uses these same doors from inside the dashboard.

| Door | In the dashboard | Used by |
|---|---|---|
| A campaign plan goes in | Campaign Desk (module 08), ⤒ Load, choose `campaign-desk-plan.json` | paid ads specialist |
| Pages go in | Publish (module 16), "What to publish", drop `pages-for-publish.json` on the import box. Each blueprint is compiled by the Site Forge compiler and listed as a draft | content strategist |
| One page goes in | Site Forge (module 09), page studio, Blueprint view, paste and choose Use edited blueprint | content strategist |
| The desk's plan, the competitor ledger, account results come out | Campaign Desk ⤓ Save, Competitor Watch JSON export, Accounts JSON export; `read <file>` reads each | paid ads specialist |

A file an agent writes for a door carries a `handoff` note (who made it, when, for which build). The dashboard ignores the note.

## Checked against the running dashboard

Where Playwright and Chromium are on the machine, the link opens the dashboard file headless, in a fresh profile with every network request refused, and uses it as a person would.

```
node dashboard-link/cli.mjs check campaign-desk-plan.json   through the Campaign Desk's own Load button
node dashboard-link/cli.mjs check pages-for-publish.json    onto the Publish import box
node dashboard-link/cli.mjs heat --budget 12000             the Heat Desk's plan and its reading of the week
```

`check` reports what the dashboard made of the file: the plan the desk then holds with its forecast, or the pages Publish lists. A file the dashboard refuses comes back as refused, in the dashboard's own words, with exit code 1. `connect` uses the browser too, to read what the dashboard computes when it opens (each service line's season and unit economics, priority by ZIP and line, audience levers).

Without a browser everything else still works, and each command says what it could not check. `LEVIATHAN_NO_LIVE=1` turns the browser off; `LEVIATHAN_CHROMIUM` names a Chrome binary.

## The Agent Desk

One place inside the dashboard where both agents' work arrives. It is a module of the dashboard's own kind, the next number in the rail (20 on Build 6), added to a copy of the dashboard file.

```
node dashboard-link/cli.mjs panel
```

writes `~/.leviathan/dashboard/<Atlas>_Build_<n>_Agent_Desk.html`: the connected dashboard with one block put in front of its shell script. A person opens that copy the way they open the dashboard. Each agent writes it again when it hands work over (`build` in the paid ads toolkit, `handoff` in the content strategist's), so the copy always holds the latest.

What a person does there:

| For | The Agent Desk shows | And does |
|---|---|---|
| A campaign from the paid ads specialist | The plan with its markets, split and forecast; the specialist's own ad copy, each ad screened as it is read by the dashboard's own advertising rules; the claims nobody has vouched for; what to check before launch; every file of the folder | Loads the plan on the Campaign Desk through the desk's own Load, then reads the desk back and says whether it holds the plan and whether its forecast is the specialist's. Saves the owner's answers to the claims as a file the specialist reads (`answers` in the paid ads toolkit). Saves any file, or all of them as a zip |
| Pages from the content strategist | Each page with its address, keyword, words, reading grade, schema and the warnings the gate left in | Sends them to Publish through its own import box, where each is compiled and listed as a draft |

It spends nothing and publishes nothing: a plan loads as a plan, pages land as drafts, and every campaign in an agent's files is paused. It asks before it replaces the plan the desk holds or a page Publish holds, and offers the desk's own Save first.

What it says is read from the dashboard as it is, not from what it remembers doing. The Campaign Desk keeps its plan in the browser, so a plan loaded last week still reads "on the Campaign Desk" if the desk still holds it, and "the desk has changed since" if it does not. Publish keeps pages only while the dashboard is open, so pages sent before a reload read "sent before, not in Publish now".

### How a hand-off gets there

A hand-off is one JSON file, `handoff.json`, that an agent writes beside its other files: everything it built, as data. Three ways in:

- **It comes with the file.** Each agent registers its hand-off under `~/.leviathan/dashboard/handoffs/` and the copy is written with the registered hand-offs for this client inside it. Nothing has to be loaded by hand.
- **A file or a folder is chosen** in the Agent Desk, or dropped on its box. `handoff.json` opens; so does a `campaign-desk-plan.json` or a `pages-for-publish.json` on its own. A plan or a page that a hand-off in the same folder already carries is not listed twice.
- **Another module sends it:** `showModule('agents', { bundle })`.

Hand-offs opened by hand are kept in the browser's storage, the newest six, without the text of their bulk files and within a fixed share of the storage, because that storage is the dashboard's own too.

### What it cannot do to the dashboard

- The dashboard file that was connected is read and never written. The only file `panel` writes over is an earlier copy of its own making; a file at the target that has no Agent Desk in it is someone's dashboard and is left alone. Nothing is written inside the repository.
- Take the block out of the copy and the file is the original, byte for byte: `stripPanel(installPanel(x)) === x`. `connect` does that first, so a copy with the Agent Desk in it connects as the same dashboard, with the same fingerprint, and the hand-offs inside it are put on file.
- The block goes in only where the dashboard's shell is the one this panel knows (one boot script that builds the rail from the registered modules). A file without it is left alone and the command says so; the agents' files are written all the same, with the by hand route.
- If the module cannot register, it does nothing. Its script is its own block, so an error in it cannot stop the dashboard's own scripts.
- It reaches no network: there is no fetch, no socket and no address in it. Its styles are scoped to its own section and its own tab.
- Text from a hand-off never becomes markup. Every string is escaped before it reaches the page, the data block holds no `<`, and the same holds for what the browser's storage gives back.
- One client's work is never put in another's dashboard: a hand-off carries the client and the atlas it was made for, and only those of the connected dashboard go into its copy.

A large registry does not make a file that will not open: the copy holds twelve hand-offs at most, the newest whole, older ones without the text of their bulk files. `panel --forget <id>` drops one, `panel --forget all` drops every one; the folders the agents built are not touched.

## The layout repairs

The copy also carries repairs to the dashboard's own modules, in the places where their text and controls overlapped, ran together or ran out of their box. They are one style sheet and one small script (`panel/atlas-repairs.css`, `panel/atlas-repairs.js`). They sit in the same block as the Agent Desk and come out with it, so the dashboard file is still never written to.

| Where | What a person saw | The cause in the dashboard | The repair |
|---|---|---|---|
| Dr. HVAC, Settings, the API key (Build 6) | The label, the field and its hint ran together on one line: the field against the last letter of its label, the hint at body size wrapping round both | `.dr-key .f` has no layout of its own. The stacked field rule is written for `.plan .f`, and `.hint` is styled only inside `.plan` | The label is above the field, the field shares its row with Test and Remove, and the hint is under them in the size of every other hint |
| Every password field: Accounts, Publish, Site Forge, Competitor Watch, Live Data, Dr. HVAC | The browser's own box, another height, border and font than the field beside it | The rule that dresses fields lists text, number, search, url, date, email and tel, and not `password` | Password fields get the same dress |
| Publish, the tick boxes of a connection card (Webflow, Duda) | The tick sat in the middle of an empty box as wide as a field, and its label was squeezed beside it into a column a word wide, four to six lines tall | `.conn .plan input{width:100%}` is meant for text fields and catches the tick box too | A tick box is its own size, and its label has the row |
| Competitor Watch, first seen and last seen | The second date stuck out of its cell, and at tablet width slid under the next control | Two date fields in a row that cannot wrap, and a date field will not shrink below its date | The two share the cell while both fit and stack when they do not. A date beside a field of another kind (the Campaign Desk's flight start and its weeks) is left as it was |
| Replacement Wave, the reinvestment tables | A table ran out through the side of its card and over the next column | Table cells do not wrap, and the box holding the table did not scroll | The box that holds a table scrolls sideways, as the dashboard's `.xscroll` boxes do |
| Publish and the connection cards, on a phone | A web address or a path ran out of its card and the page scrolled sideways | An address has no place to break | Addresses and paths break where they must |
| Site Forge and the other two column modules, narrow | Every line of a column ran out of its card | Under 1100 px `.grid2` is one `1fr` column, and `1fr` grows to the longest word that cannot break | The column keeps to its card, and a word longer than its line breaks |
| The Campaign Desk's channel mix, a label and value row, a long button, under 360 px | Each ran out of the side of its card | Four fixed columns that add up to 288 px; a row whose two sides cannot shrink; a button caption that never wraps | Under 360 px only: the columns share the row, the two sides may break, the caption may wrap |
| Bar charts: What a job is worth, The hail record, Hour of the day, A decade of establishments | The tallest bars rose out of the chart and over the rule under the card's heading, by up to about 30 px | `barChart` ends its scale at the last tick (`y1 = yt[yt.length - 1]`) where `lineChart` takes the larger of that and the data | The chart's frame grows upward to hold what is drawn above it |
| Scatter charts: Observed against modeled | ZIP labels printed over each other and over other points | Each label is drawn 9 above its point, with no look at the others | A label that would cover another label or point is tried at seven places round its own point, and left out if none is free; pointing at the point still shows it |
| Line and scatter charts: The refrigerant clock, What a budget buys, Demand Drivers, Paid | A grid line struck through a label; a marker line ran through the note of the marker before it; an axis title sat on the top tick | Labels are drawn before the lines that cross them, with nothing to set them off. The title sits in the corner where the top tick is | The label gets a halo in the colour of what it sits on and is drawn after the line, as the map's place names are. The title moves up into head room |
| Line charts with notes, before Build 6 | A note printed over the note beside it, or under the series' last point | Notes all start on the same row. Build 6 staggers them (`dy`) | A note that lands on another, a tick or a point moves down a row, or along its line, inside the frame |
| The map, every build | A place name under the zoom buttons: one or two letters at desk width, most of "Greenville" on a phone | The buttons sit over the corner of the map and the names take no notice of them | A name under the buttons is left out while it is there, and comes back when the map is moved |
| The map, before Build 6 | County names printed over city names | No declutter. Build 6 added one (`ZipMap.declutter`) | The same rule for a build that lacks it, the two major cities placed first. A build that has it keeps its own |

Nothing is restyled: each rule gives a thing the room, the wrap or the dress its neighbours already have, and a rule whose target a build does not have does nothing. The repairs change no word and no number of the dashboard. The table is also the list for the next build: fixed at the source, each repair has nothing left to do.

What they leave alone, because nothing overlaps there: a table wider or taller than its card inside one of the dashboard's own scroll boxes (`.tscroll`, `.xscroll`), which scrolls; the text of a long option in a dropdown, which the browser cuts at the arrow; and rows of tabs or a card's heading that wrap onto a second line.

```
node dashboard-link/cli.mjs layout                 sweep the copy for anything that overlaps, at six window widths
node dashboard-link/cli.mjs layout --plain         the same sweep of the dashboard as it was connected, without the repairs
node dashboard-link/cli.mjs panel --no-repairs     write the copy without them, from then on (--repairs puts them back)
```

`layout` opens the dashboard and walks it as a person would: every module as it opens and scrolled, every section opened, every view switch, the first row of each table, the dialogs, the header and the rail, at each width. In each view it measures where every line of text and every control really is, and reports what sits on something else, what touches it with no room between, what runs out of its box or off the page, a label, field and hint run together on one line, a text field the style sheet never dressed and a tick box stretched to a field's width. In the drawings it reports chart labels over each other, a label with a line through it or on a point, a chart drawn past its own frame, and a place name under the map's buttons. It exits 1 when it finds something, so it can be run after a new build is connected.

## Commands

```
node dashboard-link/cli.mjs connect atlas.html [--id dfw] [--no-live] [--no-copy]
node dashboard-link/cli.mjs status          what is connected, what each agent can do with it, anything out of step
node dashboard-link/cli.mjs doors           what the dashboard takes in and gives out
node dashboard-link/cli.mjs check <file>    hand a plan or a pages file to the running dashboard
node dashboard-link/cli.mjs heat            the Heat Desk's plan
node dashboard-link/cli.mjs read <file>     a file saved from the dashboard: a desk plan, the competitor ledger, account results
node dashboard-link/cli.mjs panel [--out file] [--forget id|all] [--no-live] [--no-repairs | --repairs]
                                            write the copy of the dashboard with the Agent Desk in it, and say what is on it
node dashboard-link/cli.mjs layout [--widths 1440,1190,...] [--quick] [--plain] [--modules key,key]
                                            sweep the running dashboard for text and controls that overlap
```

Add `--json` for machine output. Exit codes: 0 done, 1 the dashboard refused the file, the connection is out of step, the copy was opened and the Agent Desk did not come up, or `layout` found something, 2 an error, 3 a browser was needed and none is available.

## Staying in step with a new build

Three things tell an agent when a dashboard is not the build its toolkit was written against.

- The advertising rules are ported here (`lib/satchel.mjs`) so copy can be screened without a browser. Each rule in the pack carries a fingerprint of its test in the dashboard; `connect` and `rules` name any rule whose test changed or is new.
- The paid ads forecast model is a port of the Campaign Desk. The pack carries a fingerprint of the desk's own code, and the paid ads toolkit says when it is not a build the model was checked against.
- With a browser, `build` in the paid ads toolkit loads every plan through the real desk and compares the figures, and screens the copy with the dashboard's own rule tests.

## Tests

```
node dashboard-link/tests/run.mjs        no browser: the reader, the ported rules, the handoff files, connect in a sandbox, the Agent Desk's block
node dashboard-link/tests/e2e/run.mjs    with a browser: the running dashboard
```

The tests use the DFW atlas the console in `leviathan/` carries (Build 4, a placeholder brand), so no client file is needed. The ported rule tests are compared with the atlas's own on 6,130 texts and contexts. The browser tests check that what is read from the file as text matches what the running page holds (every ZIP market with the angles it triggers, every angle, rule and benchmark), load a plan through the Campaign Desk, drop pages on Publish, and run the content strategist's own `handoff`.

The Agent Desk is tested twice. Without a browser: the block goes in and comes out leaving the file as it was, text in a hand-off cannot end the data block, the module's files hold nothing that reaches the network, and the commands refuse to write over a dashboard. With a browser, `e2e/panel.test.mjs` has both agents' command lines do their work, opens the copy and drives the Agent Desk by its own buttons: every tab, the plan loaded and read back from the Campaign Desk, the pages sent and read back from Publish, the owner's answers saved and fed to the specialist, a file chosen and a folder dropped, a reload, every other module still opening, and a hand-off whose every line is an image tag with a handler shown as text.

The layout repairs are tested twice as well. Without a browser: the block carries them, they can be left out and the choice is kept, and neither file reaches the network, writes markup, takes anything off the page by a style rule or forces a rule. With a browser, `e2e/repairs.test.mjs` opens the dashboard as it was delivered and with the repairs in, runs the sweep on both, then goes to each repaired place and measures it: the password fields against the text fields beside them, the two dates in their cell, the wide tables in their card, every chart (no label on another, no bar above its frame, and each label left out still shown by pointing at its point), the map at rest, zoomed and on a phone, the tick boxes of the connection cards, and Dr. HVAC's settings at desk and phone width. It holds the repairs to changing no word of any module and to leaving alone what was right (the Campaign Desk's date and weeks still share their row), and checks that left out, the dashboard measures exactly as it did as delivered.

Point `ATLAS_HTML` at another dashboard file to run the browser tests against it as well. Nothing from that file is printed but counts.

```
ATLAS_HTML=path/to/atlas.html node dashboard-link/tests/e2e/run.mjs
```

## Limits

Only a Thermal Debt atlas can be connected. The other atlases in the console give the content strategist keyword packs (`harvest`) and no connection. The link reads from a dashboard file and writes files for its doors: it does not reach into a dashboard that is open in someone's browser. Work handed over later reaches the Agent Desk when the person opens the copy again, or drops the `handoff.json` on the one they have open. The Agent Desk was built for the module shell of this atlas and tested on Builds 4 and 6; a build with another shell gets no copy, and the agents say so. The Accounts module is read only, so nothing here sends a campaign to an ad account.

The layout sweep and the repairs were measured in headless Chromium, on Builds 4 and 6. `layout` runs with the network refused like every other check here, so it sets the page in the machine's own fonts and not in the web fonts the dashboard loads when it is online; the repairs do not depend on the width of a typeface, but a sweep can only speak for the fonts it ran with. Two repairs, the date pair and the scrolling tables, use `:has()`, which browsers have had since 2023, and the halo of a label that sits on a shaded band uses `color-mix()`, of the same year; in an older browser those places stay as the dashboard drew them, or the halo is the card's colour. The sweep does not reach what needs a key or a live account to appear (a Dr. HVAC conversation in progress, a connected ad account's results) or what shows only under the pointer.
