async () => {
  const out = {};
  out.LINE_KEYS = LINE_KEYS.join(' ');
  out.PL = PL.map(l => l.key + ':' + l.name + ' / ' + l.short);
  out.SLM = SLM.LINES.map(l => l.key + ':' + l.name + ' / ' + l.short);
  out.same = JSON.stringify(PL.map(l => [l.key, l.name, l.short])) === JSON.stringify(SLM.LINES.map(l => [l.key, l.name, l.short]));
  out.metaLines = (META.model.LINES || []).map(l => Array.isArray(l) ? l.join(':') : (l.key || l) + ':' + (l.name || ''));
  out.forge = FORGE.LINES.join(' ');
  out.AC = Object.keys(FCOPY.AC).join(' ');
  out.RES = typeof RES_LINES !== 'undefined' ? RES_LINES.join(' ') : null; out.COM = typeof COM_LINES !== 'undefined' ? COM_LINES.join(' ') : null;
  out.W = Object.keys(META.model.W || {}).join(' '); out.corrN = (META.model.corr || []).length;
  out.pools = META.pools; out.fees_tot = META.fees_tot; out.cases = META.cases;
  out.lic = META.lic && { n: META.lic.n, clear: META.lic.clear, inca: META.lic.inca, in_rows: META.lic.in_rows }; out.licZ = sum(Z.map(z => z.lic || 0)); out.licP = sum(PA.map(p => p.lic || 0));
  out.fairZ = sum(Z.map(z => z.fair_pif || 0)); out.fairP = sum(PA.map(p => p.fair_pif || 0)); out.insState = (DATA.ins || {}).state;
  out.femaZ = sum(Z.map(z => z.fema_k || 0)); out.femaP = sum(PA.map(p => p.fema_k || 0)); out.femaRegZ = sum(Z.map(z => z.fema_reg || 0)); out.femaRegP = sum(PA.map(p => p.fema_reg || 0)); out.femaAllP = sum(PA.map(p => p.fema_all || 0));
  out.fireZ = [sum(Z.map(z => z.fire_dest || 0)), sum(Z.map(z => z.fire_dmg || 0))]; out.fireP = [sum(PA.map(p => p.fire_dest || 0)), sum(PA.map(p => p.fire_dmg || 0))]; out.fireHz = [sum(DATA.hz.fires.map(f => f.dest || 0)), sum(DATA.hz.fires.map(f => f.dmg || 0))];
  out.compiled = [COMPILED, DATA.compiled, META.compiled, document.getElementById('footCompiled').textContent];
  out.keys = Object.keys(localStorage);
  return out;
}
