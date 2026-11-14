# Testing the connector plugin on a real WordPress

`src/connector/drhvac-connector.php` is tested here against a stand in for WordPress (`stubs.php`, run by `run.php`): 94 checks over its nine routes, its permission rules, the backup and restore cycle and the stale write refusal, once with Elementor and once without. That proves the plugin's own logic. It does not prove it against WordPress itself or against a real Elementor, and it has not been run on either. Do this once on a staging copy before it goes near the live site.

## Set up

1. A staging copy of the site (most hosts make one in a click), with Elementor active. Not the live site.
2. In WordPress: Users, your profile, Application Passwords. Create one for an administrator. Writing Elementor content needs the `unfiltered_html` capability, which an administrator has on a single site.
3. In the atlas, open Dr. HVAC and press Connector plugin. Upload `drhvac-connector.zip` under Plugins, Add New, Upload Plugin, and activate it. The FORGE Bridge plugin from the Publish module should be active too: it allows the browser app's origin, and the connector relies on that.
4. In the Publish module, fill in the WordPress card with the staging URL, the username and the Application Password, and press Test.

## What to check

Ask Dr. HVAC for each of these and read the tool cards.

| Ask | Expect |
|---|---|
| "Check the WordPress site." | `wp_status`: the WordPress and Elementor versions, the theme, connector on, bridge on, and what your user may do. |
| "List the Elementor pages." | `wp_list`: pages with their status and modified time. Only pages your user can edit. |
| "Read the page called (a real page)." | `wp_read`: the title, the SEO fields, and an outline of the Elementor tree whose headings match the page. |
| "Change the headline on that page to (new text)." | A card asking first (red if the page is published). After approval, `wp_write` reports a backup id. Open the page in WordPress: the headline changed, the layout did not, and the Elementor editor opens it without a warning. |
| Edit the same page by hand in WordPress, then ask for another change without reading it again. | The write is refused as stale (someone changed the page since it was read). Nothing is overwritten. |
| "Show the backups for that page" then "Restore the first one." | `wp_backups` lists them; `wp_restore` asks in red, puts the old headline back, and takes a backup of the state it replaced. |
| "Create a draft page from this template" (attach an Elementor export). | A new draft appears under Pages, opens in Elementor, and is not published. |
| "Read the site's colors and fonts." | `wp_site` kit: the global colors and typography from Elementor's Site Settings. |
| "What would a hosting move need to know about this site?" | `wp_site` inventory: versions, active plugins, sizes, table prefix. No password, salt, database credential or server path anywhere in it. |

Also try it signed in as an Editor (create an Application Password for one): reading works, writing Elementor content is refused with a message that names the missing capability, and the inventory is refused.

## If something is off

- A 404 on `/wp-json/drhvac/v1/status` means the plugin is not active, or permalinks are set to Plain (Settings, Permalinks: choose any other structure).
- A 401 means the Application Password, or a security plugin or host that strips the Authorization header.
- A CORS error in the browser app means the site was never allowed: approve the site access card. Opened as a file, the atlas reaches WordPress only once the FORGE Bridge lists that origin.
- After a write, if the page looks unstyled, ask Dr. HVAC to clear the cache (`wp_site` with clear_cache), which regenerates Elementor's CSS.

Deactivating and deleting the plugin removes its routes. The backups it took stay as private posts of type `drhvac_backup` until you delete them.

## Running the stand in tests

```bash
php tests/wp/run.php
```

```bash
WITH_ELEMENTOR=0 php tests/wp/run.php
```

`node tests/connector.test.mjs` runs both, lints the plugin with `php -l`, and checks that the copy inside `src/dr/14_dr_connector_raw.js` matches the source.
