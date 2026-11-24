/* node same.js <original.json> <patched.json>: with the flag unset the patched page must behave as the original. */
const fs = require('fs');
const A = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), B = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
let bad = 0; const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 330) : '')); if (!c) bad++; };
ok(!A.out.EVAL_ERROR && !B.out.EVAL_ERROR, 'both pages ran the whole script', [A.out.EVAL_ERROR, B.out.EVAL_ERROR]);
ok(!A.errs.length && !B.errs.length, 'no page errors', [A.errs, B.errs]);
ok(!A.refused.length && !B.refused.length, 'no request left either page (network settings are off by default)', [A.refused, B.refused]);
ok(B.out.globals && B.out.globals.__LEGION__ === 'undefined' && B.out.globals.embed, 'patched page, flag unset: no window.__LEGION__, the page booted its own interface', B.out.globals);
for (const k of Object.keys(A.out)) {
  const a = JSON.stringify(A.out[k]), b = JSON.stringify(B.out[k]);
  ok(a === b, k, a.length > 200 ? a.slice(0, 120) + ' ...' : JSON.parse(a));
  if (a !== b) console.log('     original', a.slice(0, 500), '\n     patched ', b.slice(0, 500));
}
console.log(bad ? 'FAILED ' + bad : 'ALL OK');
process.exit(bad ? 1 : 0);
