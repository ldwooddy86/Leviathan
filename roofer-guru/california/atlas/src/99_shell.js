if (!document.documentElement.lang) document.documentElement.lang = 'en';
/* ==== 99_shell.js ==== */
/* ==== src/99_shell.js ==== */
/* ==== shell ==== */
/* California labels for the module rail. Each module names itself in its own file; this table is the one place the rail's
   names and blurbs are settled for the seventeen atlas modules, with every count taken from the data, so the rail is
   right whatever order the parts were rewritten in. Module 18 (Rooftop Scout) keeps its own. Keys and ids never change:
   routing reads them. */
const MOD_CA = {
  index: ['Roof Demand Index', () => `Where roofing jobs arise across ${numWord(NLINE)} residential and commercial lines, ZIP by ZIP, for all ${NCOUNTY} counties`],
  storms: ['Weather and Fire Ledger', () => 'Atmospheric rivers, winter wind and rain, Santa Ana and Diablo wind, wildfire perimeters and structures lost, heat, snow and hail, by event and by ZIP'],
  law: ['Code, License and Claims', () => 'The C-39 license, home improvement contracts, re-roof permits, Title 24 cool roofs, Class A roofs in fire zones, claims rules, the FAIR Plan and the insurer clock, with screening calculators'],
  drivers: ['Demand Drivers', () => 'What drives roofing demand in California: roof age and building booms, rain and wind, wildfire, insurance, income, the seasons and the clock'],
  paid: ['Paid Acquisition', () => 'Where an ad dollar reaches the most sold jobs: gross profit pool per click cost, quadrants, tiers and bid modifiers by ZIP'],
  ground: ['Ground Truth', () => `The ${NCOUNTY} counties as observed: FEMA registrations, wind, rain and fire records, permits, housing, insurance and roofers`],
  field: ['Competitive Field', () => 'The roofing trade already in the market: C-39 licenses by city and ZIP, employer establishments, named companies, pressure by ZIP and the whitespace between them'],
  desk: ['Campaign Desk', () => 'Budgets, ZIP targets, keywords, ads with the license number built in, and bulk files for six ad platforms'],
  forge: ['Site Forge', () => 'Service, city, county, weather and guide pages written from the atlas, linted by the Compliance Satchel and compiled for WordPress'],
  satchel: ['Compliance Satchel', () => 'Ads, pages, scripts and contracts screened against California licensing, home improvement contract and claims law, the FTC and platform policies'],
  regions: ['California Regions', () => `The ${numWord(NREG)} regions on their own: roof stock and age, weather and fire, insurance, competition, media markets and languages`],
  lines: ['Service Lines', () => `${capFirst(numWord(NLINE))} roofing lines resolved to the ZIP: jobs, jobs open to marketing, gross profit, seasons, rules, keywords, competitors and bid modifiers`],
  watch: ['Competitor Watch', () => 'What the roofing companies on the watch list are doing: ads on Meta and Google, free, insurance and warranty claims, languages, coverage by line, with library links and an API bridge'],
  weather: ['Weather Desk', () => `National Weather Service forecasts, outlooks and alerts for the ${numWord(NREG)} California regions, turned into weather triggers for ads and work windows for crews`],
  accounts: ['Accounts', () => 'Connect the paid and social accounts, pull what they actually did, and let the actuals correct the models'],
  publish: ['Publish', () => 'Send the pages the Site Forge built, or your own, to WordPress (Elementor or headless), Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla or Ghost'],
  stock: ['Roof Stock and Materials', () => 'How old California roofs are, what they are made of (shingle, tile, shake, membrane), what materials cost and what the code asks of a reroof'],
};
(function boot() {
  const t = store.get('cg.theme', null); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  BRANDX.apply();
  MODS.forEach(m => { const c = MOD_CA[m.key]; if (!c) return; m.title = c[0]; m.desc = c[1](); });
  const rail = document.querySelector('#rail .in');
  rail.innerHTML = MODS.map(m => `<button type="button" id="tab-${m.key}" role="tab" aria-selected="false" aria-controls="mod-${m.key}"><span class="n">${m.num}</span><span class="t">${esc(m.title)}</span><span class="d">${esc(m.desc)}</span></button>`).join('');
  document.getElementById('modules').innerHTML = MODS.map(m => `<section class="module" id="mod-${m.key}" role="tabpanel" aria-labelledby="tab-${m.key}" hidden></section>`).join('');
  $$('#rail button').forEach(b => b.addEventListener('click', () => showModule(b.id.slice(4))));
  document.getElementById('shellFacts').insertAdjacentHTML('afterend', '<button class="tbtn" id="brandBtn" title="Company settings: name, CSLB license, qualifying individual, offices, service area, colors">⚙ Company</button>'); document.getElementById('brandBtn').onclick = () => BRANDX.panel();
  /* the facts in the top bar are all counted from the data */
  const tile = sum(Z.map(z => z.tile_n || 0)); const fair = FAIR_STATE ? FAIR_STATE.now : sum(Z.map(z => z.fair_pif || 0)); const lic = (META.lic && (META.lic.clear || META.lic.n)) || sum(Z.map(z => z.lic || 0));
  const facts = [[N(NCOUNTY), 'counties'], [N(META.nzip || Z.length), 'ZIP codes'], [K(META.roofs), 'one unit roofs'], [K(META.ra20), 'roofs 20+ years old']];
  if (tile > 0) facts.push([K(tile), 'tile roofs']);
  if (fair > 0) facts.push([K(fair), 'FAIR Plan home policies']);
  if (isN(META.npts) && META.npts > 0) facts.push([K(META.npts), 'weather and fire reports']); else if (PTS.length) facts.push([K(PTS.length), 'weather and fire reports']);
  facts.push([N(NLINE), 'service lines']);
  if (lic > 0) facts.push([N(lic), 'C-39 roofing licenses']);
  document.getElementById('shellFacts').innerHTML = facts.map(f => `<span><b>${f[0]}</b> ${f[1]}</span>`).join('');
  /* the compile date and the page description follow the data */
  const fc = document.getElementById('footCompiled'); if (fc) fc.textContent = 'Compiled ' + COMPILED;
  const md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', `California roofing demand intelligence for all ${NCOUNTY} counties and ${N(META.nzip || Z.length)} ZIP codes: roof age by ZIP, atmospheric rivers, winter wind and rain, Santa Ana and Diablo wind, wildfire zones and structures lost, heat and mountain snow load, the FAIR Plan and insurer non-renewals, ${numWord(NLINE)} residential and commercial service lines, heatmaps for ads and SEO, licensing and insurance law, competitors, campaigns, pages and compliance.`);
  const h = (location.hash || '').slice(1); showModule(MODI[h] ? h : 'index');
  window.addEventListener('hashchange', () => { const k = (location.hash || '').slice(1); if (MODI[k] && $('#mod-' + k).hidden) showModule(k); });
})();
