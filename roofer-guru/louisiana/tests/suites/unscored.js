/* a ZIP the atlas does not score (under 500 residents) reaching the Index or Service Lines by its search box or a hand-off:
   what each module selects and what its Desk button sends. node unscored.js <atlas.html> [zip] */
const H = require('/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/review/r6check/crossflow/h.js');
const FILE = process.argv[2], Z = process.argv[3] || '70038';
const desk = async p => { await p.waitForTimeout(900); return p.evaluate(() => { const pl = MODI.desk.plan(); return { n: pl.picks.length, first: pl.picks.slice(0, 3).join(','), toast: (document.querySelector('.toast') || {}).textContent || '' }; }); };
(async () => {
  const cases = [
    ['Index search box', '#index', async p => { await p.evaluate(z => { const i = $('#i1Find'); i.value = z; i.dispatchEvent(new Event('change')); }, Z); await p.waitForTimeout(600); return p.evaluate(() => ({ sel: (document.querySelector('#i1Tbl tr.sel') || {}).textContent || '', name: ($('#i1Name') || {}).textContent, toast: (document.querySelector('.toast') || {}).textContent || '' })); }, '#i1Desk'],
    ['Lines search box', '#lines', async p => { await p.evaluate(z => { const i = $('#l12Find'); i.value = z; i.dispatchEvent(new Event('change')); }, Z); await p.waitForTimeout(600); return p.evaluate(() => ({ name: ($('#l12Name') || {}).textContent, toast: (document.querySelector('.toast') || {}).textContent || '' })); }, '#l12Desk'],
    ['Index map click', '#index', async p => { await p.evaluate(() => { const s0 = ZipMap.prototype.select; ZipMap.prototype.select = function (...a) { (window.__maps = window.__maps || new Set()).add(this); return s0.apply(this, a); }; }); await p.evaluate(m => { MODI[m].onShow && MODI[m].onShow(); window.dispatchEvent(new Event('resize')); }, 'index'); await p.evaluate(() => { const r = document.querySelector('#i1Layer'); }); await p.evaluate(m => { showModule(m === 'index' ? 'lines' : 'index'); showModule(m); }, 'index'); await p.waitForTimeout(600); return p.evaluate(z => { const m = [...(window.__maps || [])].find(x => x.host && x.host.closest('#i1Map')); if (!m) return { found: false }; m.o.onSelect(z); return { found: true, name: ($('#i1Name') || {}).textContent }; }, Z); }, '#i1Desk'],
    ['Lines map click', '#lines', async p => { await p.evaluate(() => { const s0 = ZipMap.prototype.select; ZipMap.prototype.select = function (...a) { (window.__maps = window.__maps || new Set()).add(this); return s0.apply(this, a); }; }); await p.evaluate(m => { MODI[m].onShow && MODI[m].onShow(); window.dispatchEvent(new Event('resize')); }, 'lines'); await p.evaluate(() => { const r = document.querySelector('#l12Met'); }); await p.evaluate(m => { showModule(m === 'index' ? 'lines' : 'index'); showModule(m); }, 'lines'); await p.waitForTimeout(600); return p.evaluate(z => { const m = [...(window.__maps || [])].find(x => x.host && x.host.closest('#l12Map')); if (!m) return { found: false }; m.o.onSelect(z); return { found: true, name: ($('#l12Name') || {}).textContent }; }, Z); }, '#l12Desk'],
    ['Lines receive (Scout building card)', '#lines', async p => { await p.evaluate(z => goModule('lines', { zip: z, line: 'repair' }), Z); await p.waitForTimeout(800); return p.evaluate(() => ({ name: ($('#l12Name') || {}).textContent })); }, '#l12Desk'],
  ];
  for (const [label, hash, act, btn] of cases) {
    const o = await H.open({ file: FILE, hash }); const p = o.p; await p.waitForTimeout(2500);
    const s = await act(p); await p.click(btn); const d = await desk(p);
    console.log(`${label}: ${JSON.stringify(s)} | Desk gets ${d.n} ZIPs (${d.first}) ${d.toast}${o.errs.length ? ' | ERRORS ' + o.errs.join(' | ') : ''}`);
    await o.close();
  }
  await H.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
