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

## Commands

```
node dashboard-link/cli.mjs connect atlas.html [--id dfw] [--no-live] [--no-copy]
node dashboard-link/cli.mjs status          what is connected, what each agent can do with it, anything out of step
node dashboard-link/cli.mjs doors           what the dashboard takes in and gives out
node dashboard-link/cli.mjs check <file>    hand a plan or a pages file to the running dashboard
node dashboard-link/cli.mjs heat            the Heat Desk's plan
node dashboard-link/cli.mjs read <file>     a file saved from the dashboard: a desk plan, the competitor ledger, account results
node dashboard-link/cli.mjs panel [--out file] [--forget id|all] [--no-live]
                                            write the copy of the dashboard with the Agent Desk in it, and say what is on it
```

Add `--json` for machine output. Exit codes: 0 done, 1 the dashboard refused the file, the connection is out of step, or the copy was opened and the Agent Desk did not come up, 2 an error, 3 a browser was needed and none is available.

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

Point `ATLAS_HTML` at another dashboard file to run the browser tests against it as well. Nothing from that file is printed but counts.

```
ATLAS_HTML=path/to/atlas.html node dashboard-link/tests/e2e/run.mjs
```

## Limits

Only a Thermal Debt atlas can be connected. The other atlases in the console give the content strategist keyword packs (`harvest`) and no connection. The link reads from a dashboard file and writes files for its doors: it does not reach into a dashboard that is open in someone's browser. Work handed over later reaches the Agent Desk when the person opens the copy again, or drops the `handoff.json` on the one they have open. The Agent Desk was built for the module shell of this atlas and tested on Builds 4 and 6; a build with another shell gets no copy, and the agents say so. The Accounts module is read only, so nothing here sends a campaign to an ad account.
