async () => {
  const out = { swapped: FCOPY.LAW_SWAPPED, notes: [] };
  Object.keys(LAWPUB).forEach(k => { const r = LAWPUB[k]; if (!Array.isArray(r)) return;
    const hits = satchelLint(r[0] + '. ' + r[1], { web: true, juris: 'California' }).filter(l => l.rule.sev === 'block' || l.rule.sev === 'warn');
    if (hits.length) out.notes.push({ id: k, text: r[0] + '. ' + r[1], hits: hits.map(h => h.rule.id + ' [' + h.rule.sev + '] "' + (h.match || h.m || h.text || '') + '"') }); });
  out.clean = [houseClean('C-39 roofing'), houseClean('a C-39 license and C-10'), houseClean('well-known 24-hour')];
  out.gouge = ['fire rated shingles', 'a Class A fire rated assembly', 'we raise the fire rate after the emergency', 'storm pricing'].map(t => [t, satchelLint(t, { web: true, juris: 'California' }).map(h => h.rule.id)]);
  return out;
}
