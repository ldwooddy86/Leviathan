// which province the topo block gives a few known places (node prov_check.js)
const fs = require('fs'), path = require('path'), T = process.argv[2];
global.window = {}; 
const src = fs.readFileSync(path.join(T, 'topo_prov.js'), 'utf8');
eval(src);
console.log(Object.keys(window));
