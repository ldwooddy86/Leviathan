# The dashboard link

How Leviathan's agents connect to a dashboard. One connection serves the paid ads specialist (`paid-ads/`) and the content strategist (`content-strategist/`): each agent's own command line takes `connect` and `dashboard`, and both go through the code here. Node 22, no packages.

A dashboard is a Thermal Debt atlas as one `.html` file (the DFW Thermal Debt Atlas, Build 6, is the one this was built against). The link never changes that file, and nothing it reads leaves the machine.

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

The link does not add anything to the dashboard. It uses the doors the dashboard already has, the ones a person opens with its own controls. `doors` lists what the connected build has.

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

## Commands

```
node dashboard-link/cli.mjs connect atlas.html [--id dfw] [--no-live] [--no-copy]
node dashboard-link/cli.mjs status          what is connected, what each agent can do with it, anything out of step
node dashboard-link/cli.mjs doors           what the dashboard takes in and gives out
node dashboard-link/cli.mjs check <file>    hand a plan or a pages file to the running dashboard
node dashboard-link/cli.mjs heat            the Heat Desk's plan
node dashboard-link/cli.mjs read <file>     a file saved from the dashboard: a desk plan, the competitor ledger, account results
```

Add `--json` for machine output. Exit codes: 0 done, 1 the dashboard refused the file or the connection is out of step, 2 an error, 3 a browser was needed and none is available.

## Staying in step with a new build

Three things tell an agent when a dashboard is not the build its toolkit was written against.

- The advertising rules are ported here (`lib/satchel.mjs`) so copy can be screened without a browser. Each rule in the pack carries a fingerprint of its test in the dashboard; `connect` and `rules` name any rule whose test changed or is new.
- The paid ads forecast model is a port of the Campaign Desk. The pack carries a fingerprint of the desk's own code, and the paid ads toolkit says when it is not a build the model was checked against.
- With a browser, `build` in the paid ads toolkit loads every plan through the real desk and compares the figures, and screens the copy with the dashboard's own rule tests.

## Tests

```
node dashboard-link/tests/run.mjs        no browser: the reader, the ported rules, the handoff files, connect in a sandbox
node dashboard-link/tests/e2e/run.mjs    with a browser: the running dashboard
```

The tests use the DFW atlas the console in `leviathan/` carries (Build 4, a placeholder brand), so no client file is needed. The ported rule tests are compared with the atlas's own on 6,130 texts and contexts. The browser tests check that what is read from the file as text matches what the running page holds (every ZIP market with the angles it triggers, every angle, rule and benchmark), load a plan through the Campaign Desk, drop pages on Publish, and run the content strategist's own `handoff`.

Point `ATLAS_HTML` at another dashboard file to run the browser tests against it as well. Nothing from that file is printed but counts.

```
ATLAS_HTML=path/to/atlas.html node dashboard-link/tests/e2e/run.mjs
```

## Limits

Only a Thermal Debt atlas can be connected. The other atlases in the console give the content strategist keyword packs (`harvest`) and no connection. The link reads from a dashboard file and writes files for its doors: it does not reach into a dashboard that is open in someone's browser, so a person loads each file. The Accounts module is read only, so nothing here sends a campaign to an ad account.
