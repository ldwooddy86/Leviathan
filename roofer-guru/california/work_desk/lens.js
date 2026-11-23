const fs=require('fs');const t=fs.readFileSync('desk_a.js','utf8');
const m=[...t.matchAll(/ d: '([^']+)'/g)].map(x=>x[1]);m.forEach(s=>console.log(s.length,s));
const hs=[...t.matchAll(/'([^']{26,40})'/g)].map(x=>x[1]).filter(s=>/^[A-ZÁÉ]/.test(s)&&s.split(' ').length<8&&s.length>30);console.log('long headline candidates',hs);
