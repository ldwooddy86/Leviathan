/* a click on an unscored (gray) ZIP in the Index and Service Lines maps, made through the map's own onSelect: what is selected and what the
   Desk button sends. node mapclick.js <atlas.html> [zip] */
const H = require('/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/review/r6check/crossflow/h.js');
const FILE = process.argv[2], Z = process.argv[3] || '70038';
(async () => {
  for (const [mod, host, name, btn, poke] of [['index', '#i1Map', '#i1Name', '#i1Desk', () => { const s = $('#i1Layer'); s.dispatchEvent(new Event('change')); }], ['lines', '#l12Map', '#l12Name', '#l12Desk', () => { const b = $('#l12Met button'); if (b) b.click(); }]]) {
    const o = await H.open({ file: FILE, hash: '#' + mod }); const p = o.p; await p.waitForTimeout(2500);
    await p.evaluate(() => { const s0 = ZipMap.prototype.select; ZipMap.prototype.select = function (...a) { (window.__maps = window.__maps || new Set()).add(this); return s0.apply(this, a); }; });
    await p.evaluate(poke); await p.waitForTimeout(500);
    const r = await p.evaluate(([z, host, name]) => { const m = [...(window.__maps || [])].find(x => x.host && x.host.closest(host)); if (!m) return { found: false }; m.o.onSelect(z); return { found: true, mapSel: m.sel, name: ($(name) || {}).textContent }; }, [Z, host, name]);
    /* then a scored ZIP still selects */
    const r2 = await p.evaluate(([host, name]) => { const m = [...window.__maps].find(x => x.host && x.host.closest(host)); m.o.onSelect('70503'); return { mapSel: m.sel, name: ($(name) || {}).textContent }; }, [host, name]);
    await p.evaluate(([host]) => { const m = [...window.__maps].find(x => x.host && x.host.closest(host)); m.o.onSelect('70503'); }, [host]);   /* click it again to deselect */
    await p.evaluate(([z, host]) => { const m = [...window.__maps].find(x => x.host && x.host.closest(host)); m.o.onSelect(z); }, [Z, host]);
    await p.click(btn); await p.waitForTimeout(900);
    const d = await p.evaluate(() => { const pl = MODI.desk.plan(); return { n: pl.picks.length, first: pl.picks.slice(0, 3).join(',') }; });
    console.log(`${mod}: click ${Z} -> ${JSON.stringify(r)} | click 70503 -> ${JSON.stringify(r2)} | after deselect and a gray click, Desk gets ${d.n} (${d.first})${o.errs.length ? ' | ERRORS ' + o.errs.join(' | ') : ''}`);
    await o.close();
  }
  await H.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
