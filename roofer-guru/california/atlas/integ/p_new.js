async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)); const out = {};
  const txt = (sel, n) => { const e = document.querySelector(sel); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, n || 200) : null; };
  showModule('law'); await wait(1500);
  out.faq = { n: document.querySelectorAll('#l3Faq details').length, first: txt('#l3Faq details', 160), links: document.querySelectorAll('#l3Faq details a').length, noItem: (document.querySelector('#l3Faq').innerText.match(/No register item/g) || []).length };
  const zi = document.querySelector('#l3TZip'); zi.value = '95969'; zi.dispatchEvent(new Event('input', { bubbles: true })); await wait(400);
  out.zipBox = { zone: document.querySelector('#l3TZ').value, out: txt('#l3TO', 220) };
  zi.value = '92101'; zi.dispatchEvent(new Event('input', { bubbles: true })); await wait(300); out.zipBox2 = document.querySelector('#l3TZ').value;
  showModule('ground', { fips: '06037' }); await wait(1500);
  out.g6cz = (document.querySelector('#mod-ground').innerText.match(/Energy Code climate zones of its ZIPs[^\n]*\n?[^\n]{0,200}/) || [])[0];
  out.g6fire = (document.querySelector('#mod-ground').innerText.match(/STRUCTURES DESTROYED BY WILDFIRE\s+\S+\s+\S+\s+[^\n]{0,160}/) || [])[0];
  out.g6land = (document.querySelector('#mod-ground').innerText.match(/Land in High or Very High fire zones[^\n]{0,80}/) || [])[0];
  document.querySelector('#g6PIdx').click(); await wait(1500); out.m06to01 = document.querySelector('#i1Par').value;
  showModule('ground'); await wait(500); document.querySelector('#g6PCor').click(); await wait(2000); out.m06to02 = document.querySelector('#s2Par').value;
  showModule('weather'); await wait(1500);
  out.hol = (document.querySelector('#mod-weather').innerText.match(/[^\n]{0,60}Farmworkers Day[^\n]{0,80}/g) || []).slice(0, 3);
  out.holFn = [NWSX.holiday && String(NWSX.holiday('2026-03-31')), NWSX.holiday && String(NWSX.holiday('2027-04-09')), NWSX.holiday && String(NWSX.holiday('2027-03-31'))];
  const csv = NWSX.scheduleCSV(); out.csv = { rows: csv.split('\n').length, head: csv.split('\n')[1], bad: (csv.match(/undefined|NaN|null/g) || []).length };
  out.csvBtn = [...document.querySelectorAll('#mod-weather button')].map(b => b.id + ':' + b.textContent.trim().slice(0, 30)).filter(s => /CSV|csv|↓/.test(s));
  out.gradeTitle = [...document.querySelectorAll('#mod-weather .g')].slice(0, 2).map(e => e.getAttribute('title'));
  out.foot = document.querySelector('.shell-foot').innerText.slice(-330);
  out.top = document.getElementById('shellFacts').innerText.replace(/\s+/g, ' ');
  showModule('index'); await wait(1200); out.m01kpi = (document.querySelector('#mod-index').innerText.match(/FAIR PLAN HOME POLICIES\s+\S+\s+\S+\s+[^\n]{0,120}/) || [])[0]; out.m01pool = (document.querySelector('#mod-index').innerText.match(/GROSS PROFIT POOL A YEAR\s+\S+\s+\S+\s+[^\n]{0,160}/) || [])[0];
  showModule('paid'); await wait(1200); out.m05mkt = (document.querySelector('#mod-paid').innerText.match(/Sierra\tnone[^\n]{0,80}/) || [])[0];
  return out;
}
