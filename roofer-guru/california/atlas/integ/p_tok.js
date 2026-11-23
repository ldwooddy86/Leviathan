async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)); const out = {};
  out.prefix = ACCT.PREFIX; out.zipre = String(ACCT.ZIP_RE);
  out.nws = LINE_KEYS.map(k => { const c = NWSX.campaign(k, 'Los Angeles'); return c + ' -> ' + ACCT.lineOf(c); });
  showModule('desk'); await wait(2000);
  const api = MODI.desk.api; let names = [];
  try { names = [...new Set((api.searchRows ? api.searchRows() : []).map(r => r[0] || r.campaign).filter(Boolean))].slice(0, 8); } catch (e) { out.err = String(e); }
  out.desk = names.map(c => c + ' -> ' + ACCT.lineOf(c));
  out.toks = PL.map(l => l.key + ':' + l.tok);
  return out;
}
