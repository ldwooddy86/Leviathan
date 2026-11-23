// node patch22.js <orig.js> <blocks.txt> <out.js> : replace 1-based line ranges of orig with the blocks
const fs = require('fs');
const [orig, blocksF, out] = process.argv.slice(2);
const lines = fs.readFileSync(orig, 'utf8').split('\n');
const blocks = [];
let cur = null;
fs.readFileSync(blocksF, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^@@@ (\d+)-(\d+)$/);
  if (m) { cur = { a: +m[1], b: +m[2], t: [] }; blocks.push(cur); } else if (cur) cur.t.push(l);
});
blocks.forEach(b => { while (b.t.length && b.t[b.t.length - 1] === '') b.t.pop(); });
blocks.sort((x, y) => y.a - x.a);
for (let i = 1; i < blocks.length; i++) if (blocks[i].b >= blocks[i - 1].a) throw new Error('overlap ' + blocks[i].a);
blocks.forEach(b => lines.splice(b.a - 1, b.b - b.a + 1, ...b.t));
fs.writeFileSync(out, lines.join('\n'));
console.log('applied', blocks.length, 'blocks;', lines.length, 'lines');
