# Outis

*Sites see nobody, from nowhere, at no particular time.*

A Chrome extension that keeps websites, and the trackers inside them, from learning **who** you are, **where** you are and **when** you are there. (Outis is Greek for "nobody": the name Odysseus gave the Cyclops.) Everything runs inside your browser. Outis sends nothing anywhere.

## Install

1. Download [`Outis-chrome-extension.zip`](../Outis-chrome-extension.zip) from the repository root and unzip it. It holds one folder, `outis/`.
2. Open `chrome://extensions`, switch on **Developer mode** (top right), click **Load unpacked** and choose that `outis` folder.
3. Pin the Outis button to the toolbar. A welcome page opens with the two choices worth making on day one: whether sites see your real time zone, and whether sites are forgotten when you close them.

From a checkout of this repository, choose the `outis/` folder in step 2 instead. Edge (`edge://extensions`) and Brave (`brave://extensions`) take the same steps; Outis is tested on Chrome.

## What it hides

| | What gives you away | What Outis does |
|---|---|---|
| **Who** | Tracking scripts, pixels and beacons | Blocks 231 tracker domains and addresses across analytics, ad networks, social media pixels, fingerprinting and identity-resolution services, and session recorders. Only on other sites' pages: the companies' own sites still open. Pages that wait on Google Tag Manager, Analytics or the Google ad tag get small stand-ins that send nothing but keep buttons and links working. |
| | Cookies that follow you between sites | Turns off third-party cookies and related-website sets. |
| | Tracking tags in links | Strips `utm_*`, `fbclid`, `gclid` and 86 other click and campaign identifiers before the page is requested. |
| | Your device's fingerprint | Adds invisible, per-site noise to canvas, WebGL and audio readouts, and reports a common graphics card, 8 cores, 8 GB, a window-sized screen, no exact OS version or hardware model, a typical connection, no installed voices, keyboard layout or local fonts, and a rounded disk quota. Strips the high-detail client hints from requests. |
| | Your consent | Sends Global Privacy Control, an opt-out of sale and sharing that California and several other states require many businesses to honor. |
| | Chrome's own ad features | Turns off ad topics, ad measurement, interest groups and hyperlink pings. |
| **Where** | The location API | Refuses every location request, or answers with a city you pick (a few hundred metres from its centre, different per site). |
| | Your time zone | Pages see UTC, or the time zone of the place you pick, in `Date`, `Intl` and `Temporal`. |
| | Your languages | Requests and scripts see `en-US`, so language settings don't point to a region. |
| | WebRTC | Video-call technology can't reveal your local addresses, or go around a proxy. |
| | The page you came from | A site you arrive at from another site isn't told where you came from. |
| | Your IP address | Can't be changed by an extension alone. Outis can send your traffic through a proxy or Tor, and shows you what address sites see. |
| **When** | Your clock | Sites see the time in UTC (or your chosen place), not your local time. |
| | Return visits | When the last tab of a site closes, its cookies and stored data are deleted after 15 seconds (or 1 or 10 minutes, or at the next browser start), so next time it can't tell you've been there. Sites you choose to keep stay signed in. |
| | Your activity | Idle detection is refused, and the battery always reads full and charging, so its level can't link your visits. |

The fingerprint noise stays the same on one site for a whole browser session (so sites don't break or see it flicker), differs on every other site (so trackers can't match you across them), and changes when you restart the browser (so a site can't match you over time).

## Using it

**The toolbar button** shows how many trackers it blocked on the page. Its popup has:

- **Protect me on this site:** pause Outis on a site that breaks. A paused site sees your real details, isn't forgotten, and gets location prompts back.
- **Forget this site when I close it:** switch off to stay signed in to that site.
- **Forget this site now:** deletes its cookies and data on the spot.
- **Who, where, when:** what is hidden right now.
- **What this site sees:** the page's view of your time zone, clock, location, languages, cores, memory, screen, graphics card and canvas print, beside the real values.
- **Blocked on this page:** each blocked tracker host.
- **Check what sites see:** asks `check.torproject.org` once which IP address your requests come from.

**Settings** (right-click the button → Options) holds every switch above, the place picker, the proxy (with Tor presets), and the kept and paused lists.

![The popup](tests/e2e/popup.png)

## What it can't hide

- **Your IP address.** Every site sees it, and it points to your area and internet provider. Use a VPN, Tor, or Outis's proxy setting.
- **Accounts you sign in to.** A site you sign in to knows who you are. Outis stops it following you elsewhere, not recognizing you on its own pages.
- **The moment you visit.** A site always knows when your request reached it. Outis hides your clock, and forgetting stops it linking one visit to the next.
- **Background scripts.** Scripts that pages run in web workers are out of an extension's reach and still see your real time zone and device details. Few trackers use them; some fingerprinting scripts do.
- **Every last fingerprint.** Outis covers the signals trackers use most. Your window size, fonts measured from drawn text and many small details stay visible, so a determined fingerprinting service can still sometimes recognize a returning browser.
- **Trackers on the site itself.** Tracking served from the site's own domain, or disguised as it, isn't on the list.
- **Fraud checks.** Banks and stores run device checks at sign-in and checkout. Outis leaves those services alone, because blocking them gets you locked out. If a site still refuses you, pause Outis there.
- **Chrome and Google.** Chrome itself, a signed-in Google account with sync, and other extensions are outside its control.

## Permissions, and why

| Permission | Used for |
|---|---|
| Read and change data on all sites (`<all_urls>`) | Running the page shield in every frame, rewriting request headers, reading tab addresses for the per-site switches |
| `declarativeNetRequest` | Blocking trackers, cleaning links, the privacy headers, pausing sites |
| `scripting` | Registering the page shield; "What this site sees" |
| `privacy` | Third-party cookies, related-website sets, WebRTC, ad topics, ad measurement, link pings |
| `contentSettings` | Refusing location requests |
| `browsingData`, `cookies` | Forgetting sites |
| `webRequest` | Counting blocked trackers, signing in to a proxy |
| `webRequestAuthProvider` | Answering a proxy's sign-in request |
| `proxy` | The optional proxy |
| `storage`, `alarms` | Settings; forgetting sites on time |

Switching Outis off or removing it hands every Chrome setting it changed back to you.

## Privacy

Outis makes one network request of its own, "Check what sites see", and only when you click it. Settings live in `chrome.storage.local` (not synced), including a proxy password if you enter one. To forget a site, Outis keeps that site's addresses until it is forgotten; it keeps no list of which sites it forgot, only how many.

## How it works

- `manifest.json`: Manifest V3. `background.js` is the service worker; `lib/` holds settings, sites, places, the tracker list and the request rules.
- `rules/`: static request rules, generated from `lib/trackers.js`. Dynamic rules (headers, referrer, paused sites) come from `lib/rules.js`.
- `inject/shield.js` runs in each page's own JavaScript world at `document_start`, before the page's scripts, in every frame (fresh `about:blank` frames included). A page script can't wait for storage, so its settings arrive as small generated files listed ahead of it (`inject/opt/`, `inject/places/`) and are deleted before the page runs. `inject/key.js` runs just before it in the extension's isolated world and leaves a per-site seed derived from the per-session id Chrome gives the extension's web-accessible files; the shield takes it and removes it. Replaced functions keep native names, lengths and source text.
- `surrogates/` are the stand-ins for Tag Manager, gtag, Analytics and the Google ad tag.

## Development

```bash
node tools/build.mjs
```

Regenerates `rules/`, `inject/opt/`, `inject/places/` and the suffix list in the shield. `--check` verifies them and the manifest without writing; `--zip` also writes `../Outis-chrome-extension.zip`.

```bash
node tests/run.mjs
```

43 unit tests, no packages: sites, settings, rules, the tracker list, and the time zone engine run against Node's own time zone data in ten zones (DST gaps and repeats, parsing, setters, strings).

```bash
node tests/e2e/run.mjs
```

121 checks in Chromium through Playwright, against a local HTTPS server that answers for every host name. It needs Playwright, Chromium and `openssl`, and binds port 443 (root, or `cap_net_bind_service`). It writes the screenshots in `tests/e2e/`. `node tools/icons.mjs` redraws the icons.

Tested on Chrome for Testing 153.
