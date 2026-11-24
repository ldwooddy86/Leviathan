/* California port of review/r6check/edgecases/scout_open.js (CA/scout/tests/la_port/port_suites.py) */
/* open module 18 and check for page errors, and that permitW in the page reads a probe as the fix intends. node scout_open.js <atlas.html> */
const { open, realErrs } = require('/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/review/r6check/edgecases/h.js');
(async () => {
  const { browser, p, errs } = await open(process.argv[2], '#rooftops', {});
  await p.waitForTimeout(6000);
  const r = await p.evaluate(() => ({ mounted: !!(MODI.rooftops && MODI.rooftops.mounted), text: (document.querySelector('#mod-rooftops') || {}).innerText ? document.querySelector('#mod-rooftops').innerText.slice(0, 120).replace(/\s+/g, ' ') : '' }));
  console.log(JSON.stringify(r)); console.log('errors:', JSON.stringify(realErrs(errs)));
  await browser.close();
})();
