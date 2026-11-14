# Dr. HVAC

Module 19 of the DFW Thermal Debt Atlas: a web developer and designer that works inside the dashboard. It is an agent on the Claude API with fifty tools of its own. It reads the atlas, builds landing pages and whole sites, reworks Elementor templates into new pages, edits pages on a live WordPress site as drafts, and plans and verifies hosting moves. It asks before anything reaches a website.

This folder holds the agent's source, the tool that builds it into the atlas, and its tests. It does not hold a built atlas: the atlas carries a client's data, so the build writes outside the repository and refuses to write inside it.

## What it does

| Job | How |
|---|---|
| A landing page from the atlas | Reads the city, county and service line figures with their public sources, writes the page as a FORGE blueprint (the Site Forge's own format), compiles it with the Site Forge's compiler to Elementor containers, semantic HTML and JSON-LD, and checks it. |
| A page on an existing design | Loads an Elementor template (an export you attach, a saved template, or a live page), lists every editable slot, changes text, links and images slot by slot so the design stays intact, can insert a compiled section, and turns the result into a page. |
| A change to a live page | With the connector plugin on WordPress: reads the page's Elementor content, writes the change back with a backup taken first, refuses to overwrite a page someone else changed meanwhile, and can restore any of the last ten backups. |
| A whole site | Plans it with the Site Forge (through the forge's own controls), copies pages into its workshop, or packages its own pages as a static site: pages, shared header and footer, stylesheet, sitemap, robots file, redirects, a 404 page. |
| A hosting move | Looks up public DNS over HTTPS, fingerprints the current stack, reads the WordPress inventory, and writes a dated runbook: phases, a DNS worksheet (keep, change, lower the TTL), mail, certificates, rollback. After the move it compares old and new hosts page by page. |
| A review | Audits a public URL or a workshop page across search, accessibility, speed, conversion, content, schema and security headers (76 findings it can raise), and screens copy against the atlas's rule pack: TDLR, FTC, Texas deceptive practices, lending and texting rules. |

## How it is put together

```
src/dr/00_dr_core.js          storage, settings, the one network exit, schema validation
src/dr/01_dr_knowledge.js     the system prompt (frozen per conversation) and the per turn dashboard state
src/dr/02_dr_llm.js           the Claude client: the official SDK, streaming, betas, error wording
src/dr/03_dr_agent.js         the loop: tool calls, approvals, an append only history, conversations
src/dr/10_dr_html.js          page parser, outline, audit, design tokens, sitemaps, redirects, static site bundle
src/dr/11_dr_elementor.js     Elementor documents: parse, validate, outline, slots, edits, diff, rendering, export
src/dr/12_dr_wp.js            the WordPress client (the connector plugin and the FORGE bridge)
src/dr/13_dr_hosting.js       DNS, host fingerprint, the move runbook, old against new verification
src/dr/14_dr_connector_raw.js the connector plugin's source as a string (generated)
src/dr/20_dr_tools.js         the tool registry, the workshop, the atlas and Site Forge tools
src/dr/21_dr_tools_work.js    page, Elementor, WordPress, site, hosting and file tools
src/33_m19_drhvac.js          the module: conversation, approval cards, workbench, settings
src/css/drhvac.css            its styles, on the atlas's own tokens
src/connector/drhvac-connector.php   the WordPress plugin Dr. HVAC hands over as a zip
vendor/anthropic-sdk.min.js   @anthropic-ai/sdk 1.8.0, cut down to Messages and Models, one classic script
build.mjs, lib/zip.mjs        the build
tests/                        nine unit suites, a PHP harness for the plugin, the browser run
```

The module registers itself the way the other eighteen do (`registerModule`), and the atlas's shell picks it up. The build rewrites none of the atlas's own code.

### Reaching Claude

The agent calls the Messages API through the official TypeScript SDK, from the page, with the person's own API key. The key is kept in the browser (extension storage in the browser app, local storage otherwise) and sent only to `api.anthropic.com`.

| Setting | Default |
|---|---|
| Model | `claude-opus-5-5`. Settings also offers `claude-fable-5-2`, `claude-sonnet-5-5` and `claude-haiku-5-5`. |
| Thinking | Adaptive, summarized for display. Effort `high`; Settings offers low to xhigh. |
| Output | Streamed, up to 64,000 tokens a reply. |
| Tools | Fifty client tools with eager input streaming (each input is checked against its schema before anything runs), plus Anthropic's web search and web fetch when web research is on. |
| Caching | The system prompt and the tool list are frozen at a conversation's first request and cached; what changes (the date, the brand, what is connected) travels in a state block on each user turn, so the cache holds. |
| Beta features | Server side fallback, thinking binding controls, server side compaction. Compatibility mode in Settings sends none of them. If the API refuses a request while they are on, the same request is sent once more without them; when that goes through, compatibility mode stays on and the conversation says so. |

Inside the Claude viewer (a published artifact) there is no key: the agent uses the viewer's own model access when the page was published with it, and every tool that needs the network says it cannot run there.

### What may run without asking

Each tool declares what it touches, and the loop gates on that, not on what the model says about it.

| Level | Examples | Gate |
|---|---|---|
| read | the atlas tools, `page_check`, `wp_read`, `fetch_url`, `dns_lookup` | Runs. A website it has no access to raises a site access card first. |
| local | `page_create`, `elementor_edit`, `migration_plan`, `site_build` | Runs: it changes only Dr. HVAC's own workshop in this browser. |
| settings | `brand_update`, `forge_set` | Always asks, with the old and new values: these change what the person saved in the atlas. |
| draft | `wp_create`, `wp_write` to an unpublished page, `page_publish` as drafts | Asks, unless Settings allows drafts or the person allowed them for the session. |
| live | `wp_write` to a published page, `wp_restore`, `page_publish` live | Always asks, in red, with the page named. The keyboard lands on No. |

Site access is asked for once per site, together with its www twin, and in the browser app the click on the card is what opens the browser's own permission prompt. A refusal goes back to the model as the tool's result, with the instruction not to retry.

### What leaves the browser

Each message sends Anthropic the conversation so far, a short status block (the date, the brand's name, city, domain and phone, what is connected, what is in the workshop), the tool results in the conversation, and what the person attached. Atlas data leaves only as far as a tool result quotes it. Passwords, the API key and the WordPress Application Password are never part of a message: credentials are typed into Settings and the Publish module, and the model is told to send people there instead of asking in chat. A page it fetches or a file it is given is treated as information, not instruction.

## Build it into the atlas

```bash
npm install
```

```bash
node build.mjs --html /path/to/DFW_Thermal_Debt_Atlas.html --app /path/to/DFW-Thermal-Debt-Atlas-browser-app.zip --out /path/outside/this/repo
```

It writes `DFW_Thermal_Debt_Atlas_Build6.html` (every script inline) and `DFW-Thermal-Debt-Atlas-browser-app-6.0.0.zip` (the Manifest V3 extension). Either input may be left out.

- Every edit is anchored on text that must be found exactly once. A dashboard it does not recognize stops the build with the reason; nothing half patched is written.
- Running it on an already built atlas replaces the earlier Dr. HVAC blocks. The build runs each patch twice and fails if the second run changes a byte.
- The browser app keeps its `script-src 'self'` policy. The manifest gains version 6.0.0, host access for `api.anthropic.com` and the two public DNS resolvers, and `http://*/*` beside `https://*/*` among the optional hosts, which are asked for one site at a time.
- If the atlas's own build source is at hand, the files under `src/` follow its naming and drop into it unchanged.

After a change to the plugin, `node tools/connector.mjs` regenerates `src/dr/14_dr_connector_raw.js` (a test fails when the two drift apart). `npm run vendor` rebuilds the SDK bundle and refuses one that uses `eval`, `new Function` or a dynamic import.

## Tests

```bash
node tests/run.mjs
```

Nine suites, 591 checks, no packages beyond the two dev dependencies; the plugin's suite also runs 94 checks in PHP (`php` on the path, 7.4 or later) against a stand in for WordPress, once with Elementor and once without, and fails on any PHP warning or notice.

```bash
node tests/e2e/run.mjs --html /path/to/built.html --app /path/to/built.zip --shots /path/outside/this/repo
```

62 checks in headless Chromium (Playwright) against the built atlas, both editions, with `api.anthropic.com` answered by the test itself in the Messages API's own event stream format. Each scripted reply is written from the tool results in the request it answers, the way a model works: the page it creates uses the figures `atlas_place` returned. It covers the key and settings, a landing page from the atlas through to the Publish module, every approval card, an Elementor template from an attached file, a hosting runbook and its download, the plugin zip (linted with `php -l`), an API failure, a reload, History, phone width, and in the extension the script policy, extension storage, the site access card and the popup.

## What is and is not verified

Verified here: everything above, in a real browser, against the real atlas, with a scripted model.

Not verified here, and worth a first run with someone watching:

- **A live model.** No API key was available where this was built, so no conversation ran against Anthropic. The requests are made by the official SDK, a direct call confirmed that the API accepts them from a browser page and from an extension, and the conversation logic was checked against scripted replies. How well the model uses the fifty tools on a real job is the thing to watch first.
- **The connector plugin on a real WordPress with real Elementor.** It was tested against a PHP stand in. `tests/wp/README.md` is the checklist for a staging site.
- **Websites from the browser app.** Reading a public site needs the browser's permission prompt, which a headless run cannot answer; the fetch, audit, fingerprint and comparison tools were tested against recorded responses.
- **The Claude viewer transport**, tested only against a mock of its contract.
- **Host specifics in the runbook** (which button, which command) age; the runbook says where to confirm them.
