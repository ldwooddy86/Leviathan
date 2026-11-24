/* node cmp.js <original.json> <library.json> [<library second run.json>]: compares what the original app shows with
   what the library returns (s_cmp.js run in each page), and one library run with another (a reload). */
const fs = require('fs');
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const A = rd(process.argv[2]), B = rd(process.argv[3]), C = process.argv[4] ? rd(process.argv[4]) : null;
let bad = 0; const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 400) : '')); if (!c) bad++; };
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
ok(A.out.who === 'original' && B.out.who === 'library' && A.out.T === B.out.T, 'the two runs: original and library, at the same clock', { T: new Date(A.out.T).toISOString() });
ok(!A.errs.length && !B.errs.length, 'no page errors in either', { original: A.errs, library: B.errs });
ok(!A.refused.length && !B.refused.length, 'no request left either page', { original: A.refused, library: B.refused });
for (const zip of Object.keys(A.out.zips)) {
  const a = A.out.zips[zip], b = B.out.zips[zip];
  ok(a.residents.length === 12 && eq(a.residents, b.residents), zip + ': the twelve residents the place panel lists = npcsOf(sample, limit 12, page 1)', a.residents.slice(0, 3));
  ok(a.households === b.households, zip + ': households', [a.households, b.households, 'people', b.total]);
  ok(eq(a.panel, b.panel), zip + ': NPC panel as drawn (name, line under it, Now, every Profile row, bio) = describe()', { name: a.panel.name, meta: a.panel.meta, now: a.panel.now, rows: a.panel.sections.reduce((n, s) => n + s.rows.length, 0) });
  if (!eq(a.panel, b.panel)) console.log('     original', JSON.stringify(a.panel).slice(0, 900), '\n     library ', JSON.stringify(b.panel).slice(0, 900));
  ok(eq(a.panel2, b.panel2), zip + ': a second NPC panel = describe()', { name: a.panel2.name, now: a.panel2.now });
  if (!eq(a.panel2, b.panel2)) console.log('     original', JSON.stringify(a.panel2).slice(0, 900), '\n     library ', JSON.stringify(b.panel2).slice(0, 900));
  const diff = Object.keys(a.npcDigest).filter(id => a.npcDigest[id] !== b.npcDigest[id]);
  ok(a.nIds === b.nIds && !diff.length && a.allDigest === b.allDigest, zip + ': npc(id) equals the original person, field for field, for ' + a.nIds + ' people', diff.slice(0, 5));
  ok(eq(a.sampleNpc, b.sampleNpc), zip + ': one person compared whole', { id: a.sampleNpc.id, name: a.sampleNpc.name.display, age: a.sampleNpc.age, job: a.sampleNpc.occupation && a.sampleNpc.occupation.title });
  if (C) { const c = C.out.zips[zip]; ok(c.allDigest === b.allDigest && eq(c.residents, b.residents) && eq(c.panel, b.panel), zip + ': the same after a reload (a second run of the page)', { digest: b.allDigest }); }
}
console.log(bad ? 'FAILED ' + bad : 'ALL OK');
process.exit(bad ? 1 : 0);
