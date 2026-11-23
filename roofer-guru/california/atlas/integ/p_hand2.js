async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const out = {}; const txt = (sel, n) => { const e = document.querySelector(sel); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, n || 200) : null; };
  const bad = s => [...new Set(String(s).match(/undefined|NaN|\[object Object\]|\bnull\b/g) || [])].join(',');
  /* company set, as a user would, so license lines print */
  try { localStorage.setItem('cg.brand.v1', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('cg.brand.v1') || '{}'), { name: 'Golden Poppy Roofing (sample)', lic: '1234567', city: 'Chico', phone: '(530) 555 0100' }))); } catch (e) { }
  /* ---------- A. module 02 -> Desk with the Camp Fire ---------- */
  showModule('storms'); await wait(1500);
  const sel = document.querySelector('#s2Storm'); const o = [...sel.options].find(x => /Camp 2018/.test(x.textContent));
  sel.value = o.value; sel.dispatchEvent(new Event('change')); await wait(1200);
  document.querySelector('#s2FD').click(); await wait(2500);
  const dp = MODI.desk.plan(); const cor = document.querySelector('#dkCor');
  out.A_desk = { storm: dp.storm, event: dp.event, line: dp.line, picks: (dp.picks || []).length, menu: cor.selectedOptions[0] && cor.selectedOptions[0].textContent, callout: (document.querySelector('#mod-desk').innerText.match(/Built for:[^\n]{0,120}/) || [])[0], bad: bad(document.querySelector('#mod-desk').innerText) };
  const feed = MODI.desk.feed();
  const lint = (t, plat) => satchelLint(t, Object.assign({}, typeof satCtx === 'function' ? satCtx() : {}, { web: plat === 'web', juris: 'California' })).filter(l => l.rule.sev === 'block' || l.rule.sev === 'warn');
  const hits = {}; let nb = 0; feed.forEach(a => { lint(a.text, a.plat).forEach(h => { const k = h.rule.sev + ' ' + h.rule.id; hits[k] = (hits[k] || 0) + 1; if (!hits['_ex ' + k]) hits['_ex ' + k] = a.label + ' :: ' + a.text.replace(/\s+/g, ' ').slice(0, 260); nb++; }); });
  out.F_deskAds = { assets: feed.length, plats: [...new Set(feed.map(a => a.plat))], fireAds: feed.filter(a => /Camp Fire/.test(a.text)).length, sampleFire: (feed.find(a => /Camp Fire/.test(a.text)) || {}).text, findings: hits, bad: bad(feed.map(a => a.text).join('\n')) };
  /* ---------- A2. module 02 -> Forge with the fire ---------- */
  showModule('storms'); await wait(800); document.querySelector('#s2FF').click(); await wait(4000);
  const ffeed = MODI.forge.feed(); const evp = ffeed.filter(p => /Event|event/.test(p.label) || /Camp Fire/.test(p.label));
  out.A_forge = { pages: ffeed.length, labels: ffeed.map(p => p.label.replace('Site Forge · ', '')).slice(0, 60), eventPages: evp.map(p => p.label), campText: (ffeed.find(p => /Camp Fire/.test(p.label)) || { text: '' }).text.replace(/\s+/g, ' ').slice(0, 1200) };
  const fh = {}; ffeed.forEach(p => { lint(p.text, 'web').forEach(h => { const k = h.rule.sev + ' ' + h.rule.id; fh[k] = (fh[k] || 0) + 1; if (!fh['_ex ' + k]) fh['_ex ' + k] = p.label + ' :: ' + String(h.rule.test(p.text)); }); });
  out.F_forgePages = { findings: fh, bad: bad(ffeed.map(p => p.text).join('\n')), cool: (ffeed.map(p => p.text).join('\n').match(/[^.\n]{0,160}climate zone[^.\n]{0,200}\./gi) || []).slice(0, 4) };
  /* the Satchel's own buttons */
  showModule('satchel'); await wait(1500);
  document.querySelector('#s10SrcD').click(); await wait(2500); out.S_desk = { note: txt('#s10Note', 200), kpis: txt('#mod-satchel .kpis', 300) };
  document.querySelector('#s10SrcF').click(); await wait(4000); out.S_forge = { note: txt('#s10Note', 200), kpis: txt('#mod-satchel .kpis', 300), bad: bad(document.querySelector('#mod-satchel').innerText) };
  /* ---------- module 12 -> forge with a line; module 05 -> desk with lines ---------- */
  showModule('lines'); await wait(1500); const lf = document.querySelector('#l12Forge'); if (lf) { lf.click(); await wait(3000); out.G_linesForge = { shown: !document.querySelector('#mod-forge').hidden, toast: txt('.toast', 160) }; }
  showModule('paid'); await wait(1500); const pd = document.querySelector('#p5Desk'); if (pd) { pd.click(); await wait(2500); const d = MODI.desk.plan(); out.G_paidDesk = { line: d.line, lines: d.lines, picks: (d.picks || []).length }; }
  /* module 11 -> weather, storms */
  showModule('regions'); await wait(1200); document.querySelectorAll('#mod-regions .regcard')[7].click(); await wait(1000);
  const rw = document.querySelector('#r11Wx'); if (rw) { rw.click(); await wait(1500); out.G_regWx = { shown: !document.querySelector('#mod-weather').hidden, detail: txt('#w14Detail', 80) }; }
  showModule('regions'); await wait(500); const rl = document.querySelector('#r11Led'); if (rl) { rl.click(); await wait(2000); out.G_regLed = { shown: !document.querySelector('#mod-storms').hidden, reg: document.querySelector('#s2Reg').selectedOptions[0].textContent }; }
  /* module 07 -> 13 (company index), 01 -> 17 */
  showModule('field'); await wait(1500); MODI.field.receive({ comp: 0 }); await wait(600); const fw = document.querySelector('#f7W'); if (fw) { fw.click(); await wait(1500); out.G_fieldWatch = { shown: !document.querySelector('#mod-watch').hidden, name: txt('#w13Name', 80) }; }
  showModule('index', { zip: '95969' }); await wait(1500); const is = document.querySelector('#i1Stock'); if (is) { is.click(); await wait(2000); out.G_idxStock = { shown: !document.querySelector('#mod-stock').hidden, name: txt('#mod-stock [id$="Name"]', 80) }; }
  try { ['cg.brand.v1', 'cg.desk.v1', 'cg.forge.v1'].forEach(k => localStorage.removeItem(k)); } catch (e) { }
  return out;
}
