/* Every module mounts with no error, the rail and the routes work, the live layer is present and quiet. */
export default async function (page, t, ctx) {
  const mods = await page.evaluate(() => MODS.map(m => ({ key: m.key, num: m.num, title: m.title })));
  t.ok(mods.length >= 17, 'the modules register', mods.map(m => m.key).join(' '));
  t.eq(mods.map(m => +m.num), mods.map(m => +m.num).slice().sort((a, b) => a - b), 'module numbers ascend along the rail');
  for (const m of mods) {
    const before = ctx.errors.length;
    await ctx.show(m.key);
    const r = await page.evaluate(k => { const s = document.getElementById('mod-' + k); const c = s.querySelector('.callout .ct'); return { len: s.innerHTML.length, failed: !!(c && /failed to load/i.test(c.textContent)), hash: location.hash, tab: document.getElementById('tab-' + k).getAttribute('aria-selected'), overflow: document.documentElement.scrollWidth - innerWidth }; }, m.key);
    t.ok(!r.failed && r.len > 2000 && ctx.errors.length === before, `module ${m.num} ${m.key} mounts cleanly`, { r, errors: ctx.errors.slice(before) });
    t.ok(r.hash === '#' + m.key && r.tab === 'true' && r.overflow <= 0, `module ${m.key}: hash, selected tab, no sideways scroll`, r);
  }
  /* routes */
  await page.evaluate(() => { location.hash = '#weather'; }); await page.waitForTimeout(150);
  t.ok(await page.evaluate(() => !document.getElementById('mod-weather').hidden), 'a hash change shows the module');
  await page.evaluate(() => { location.hash = '#nonsense'; }); await page.waitForTimeout(100);
  t.ok(await page.evaluate(() => !document.getElementById('mod-weather').hidden), 'an unknown hash leaves the page where it is');
  /* live layer */
  const live = await page.evaluate(async () => { await LIVE.ready; return { env: LIVE.env, n: LIVE.sources.length, chip: document.getElementById('liveBtn').innerText, busy: LIVE.busy(), auto: LIVE.settings().auto, recs: Object.keys(LIVE.all()).length, facts: document.getElementById('shellFacts').innerText }; });
  t.ok(live.env === 'page' && live.n >= 2 && !live.busy && live.auto === false, 'the live layer is loaded and does not call out during tests', live);
  t.ok(/Live data/.test(live.chip), 'the header chip states how fresh the live data is', live.chip);
  t.ok(!ctx.errors.length, 'no page error or console error', ctx.errors.slice(0, 5));
}
