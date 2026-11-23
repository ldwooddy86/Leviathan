async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const out = {}; const txt = (sel, n) => { const e = document.querySelector(sel); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, n || 200) : null; };
  const bad = s => (String(s).match(/undefined|NaN|\[object Object\]|null/g) || []).join(',');
  /* ---------- A. module 02 -> Desk and Forge with a fire event ---------- */
  showModule('storms'); await wait(1500);
  const sel = document.querySelector('#s2Storm'); const o = [...sel.options].find(x => /Camp 2018/.test(x.textContent)) || sel.options[1];
  sel.value = o.value; sel.dispatchEvent(new Event('change')); await wait(1200);
  out.A_fire = { option: o.textContent, name: txt('#s2Name'), hasFD: !!document.querySelector('#s2FD'), hasFF: !!document.querySelector('#s2FF') };
  document.querySelector('#s2FD').click(); await wait(2500);
  const dp = MODI.desk.plan();
  out.A_desk = { shown: !document.querySelector('#mod-desk').hidden, storm: dp.storm, event: dp.event, line: dp.line, picks: (dp.picks || []).length, zips: dp.zips.length,
    evText: [...document.querySelectorAll('#mod-desk select')].map(s => s.selectedOptions[0] && s.selectedOptions[0].textContent).filter(t => /Camp|Fire/.test(t || '')).slice(0, 3),
    mentions: (document.querySelector('#mod-desk').innerText.match(/Camp Fire[^\n]{0,80}/g) || []).slice(0, 4), bad: bad(document.querySelector('#mod-desk').innerText) };
  showModule('storms'); await wait(800);
  document.querySelector('#s2FF').click(); await wait(3500);
  out.A_forge = { shown: !document.querySelector('#mod-forge').hidden, note: txt('#f9Note', 300), mentions: (document.querySelector('#mod-forge').innerText.match(/Camp[^\n]{0,90}/g) || []).slice(0, 5), bad: bad(document.querySelector('#mod-forge').innerText) };
  /* a wind event and an AR through the ledger tables to the Desk */
  showModule('storms'); await wait(600); sel.value = ''; sel.dispatchEvent(new Event('change')); await wait(600);
  for (const [id, btn] of [['#s2WT', '#s2WD'], ['#s2ArT', '#s2AD']]) {
    showModule('storms'); await wait(500); const r = document.querySelector(id + ' tbody tr'); if (!r) { out['A_' + id] = 'no row'; continue; } r.click(); await wait(900);
    const nm = txt('#s2Name'); const b = document.querySelector(btn); if (!b) { out['A_' + id] = { name: nm, btn: 'none' }; continue; } b.click(); await wait(2000);
    const d = MODI.desk.plan(); out['A_' + id] = { name: nm, storm: d.storm, event: d.event, line: d.line, picks: (d.picks || []).length };
  }
  /* ---------- B. module 06 driving 01 and 02 ---------- */
  showModule('ground', { fips: '06037' }); await wait(1500);
  out.B_ground = { name: txt('#mod-ground #g6Name') || txt('#mod-ground .dname'), idx: !!document.querySelector('#g6PIdx'), cor: !!document.querySelector('#g6PCor'), corLabel: txt('#g6PCor') };
  if (document.querySelector('#g6PIdx')) { document.querySelector('#g6PIdx').click(); await wait(2000); out.B_index = { shown: !document.querySelector('#mod-index').hidden, par: document.querySelector('#i1Par') && document.querySelector('#i1Par').value, parText: document.querySelector('#i1Par') && document.querySelector('#i1Par').selectedOptions[0].textContent }; }
  showModule('ground'); await wait(800);
  if (document.querySelector('#g6PCor')) { document.querySelector('#g6PCor').click(); await wait(2500); out.B_storms = { shown: !document.querySelector('#mod-storms').hidden, par: document.querySelector('#s2Par').value, parText: document.querySelector('#s2Par').selectedOptions[0].textContent, kpi: txt('#s2Kpis', 240) }; }
  /* ---------- C. the Desk plan read by 09 and 15 ---------- */
  showModule('forge'); await wait(1500);
  const fb = document.querySelector('#f9Desk'); if (fb) { fb.click(); await wait(2500); out.C_forge = { note: txt('#f9Note', 300), toast: txt('.toast', 200) }; } else out.C_forge = 'no #f9Desk';
  showModule('accounts'); await wait(2000);
  const at = document.querySelector('#mod-accounts').innerText;
  out.C_acct = { deskKey: !!localStorage.getItem('cg.desk.v1'), budgetMentions: (at.match(/[^\n]{0,80}(Campaign Desk|plan)[^\n]{0,120}/g) || []).slice(0, 6), bad: bad(at) };
  /* ---------- D. module 14 CSV ---------- */
  const csv = NWSX.scheduleCSV(); const lines = csv.split('\n');
  out.D_csv = { len: csv.length, rows: lines.length, head: lines.slice(0, 3).map(l => l.slice(0, 260)), bad: bad(csv), camp: [...new Set(lines.slice(2).map(l => l.split(',')[0]))].slice(0, 8) };
  /* ---------- E. the Forge on real hz ---------- */
  const E = FORGE; const kinds = {}; E.HZ.EVENTS.forEach(e => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
  out.E_events = { n: E.HZ.EVENTS.length, kinds, sample: E.HZ.EVENTS.slice(0, 2).map(e => ({ id: e.id, name: e.name, kind: e.kind })) };
  return out;
}
