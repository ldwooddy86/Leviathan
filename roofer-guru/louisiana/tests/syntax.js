/* compile every inline script of the built page: node syntax.js <atlas.html> */
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8'), re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g; let m, n = 0, bad = 0;
while ((m = re.exec(html))) { const attrs = m[1] || ''; if (/\bsrc=|type="(?!module|text\/javascript)/.test(attrs)) continue; n++; try { new vm.Script(m[2], { filename: 'script' + n }); } catch (e) { bad++; console.log('SYNTAX', n, attrs.trim(), e.message); } }
console.log('scripts', n, 'syntax errors', bad);
