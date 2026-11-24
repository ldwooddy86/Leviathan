/* the kit's own despike, run on two coarse tiles decoded beforehand (heights as float32, shore mask as bytes)
   node despike_check.js <terrain_engine.js> <dir with t10.f32 t10.u8 t8.f32 t8.u8> */
const fs = require('fs'), src = fs.readFileSync(process.argv[2], 'utf8'), a = src.indexOf('    function despike('), b = src.indexOf('    async function load(t)');
const despike = new Function(src.slice(a, b) + '; return despike;')();
for (const [f, over] of [['t10', 120], ['t8', 150]]) { const d = new Float32Array(fs.readFileSync(process.argv[3] + '/' + f + '.f32').buffer.slice(0)), sh = new Uint8Array(fs.readFileSync(process.argv[3] + '/' + f + '.u8'));
  let m0 = 0; for (const v of d) if (v > m0) m0 = v; const t0 = Date.now(), n = despike(d, sh, over, f === 't8' ? 700 : 350); let m1 = 0, over300 = 0; for (let k = 0; k < 65536; k++) { if (d[k] > m1) m1 = d[k]; }
  const at = (i, j) => [-2, -1, 0, 1, 2].map(b2 => [-2, -1, 0, 1, 2].map(a2 => Math.round(d[(j + b2) * 256 + i + a2])));
  console.log(f, 'flagged', n, 'in', Date.now() - t0, 'ms; max before', m0, 'after', m1, f === 't10' ? JSON.stringify(at(137, 122)) : JSON.stringify(at(170, 92))); }
