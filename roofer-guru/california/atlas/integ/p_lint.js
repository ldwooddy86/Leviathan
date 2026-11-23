async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const out = {}; const txt = (sel, n) => { const e = document.querySelector(sel); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, n || 200) : null; };
  const bad = s => [...new Set(String(s).match(/undefined|NaN|\[object Object\]|\bnull\b/g) || [])].join(',');
  BRANDX.save({ name: 'Golden Poppy Roofing', short: 'Golden Poppy', legal: 'Golden Poppy Roofing Inc', phone: '(530) 555 0100', url: 'https://www.example.com', domain: 'example.com', email: 'office@example.com', contact: 'Alex Sample', lic: '1234567', licClass: 'C-39 Roofing', street: '100 Sample Street', city: 'Chico', zip: '95926', hours: 'Monday to Friday 8 am to 5 pm' });
  await wait(500);
  showModule('storms'); await wait(1500);
  const sel = document.querySelector('#s2Storm'); const o = [...sel.options].find(x => /Camp 2018/.test(x.textContent));
  sel.value = o.value; sel.dispatchEvent(new Event('change')); await wait(1200);
  document.querySelector('#s2FD').click(); await wait(2500);
  showModule('storms'); await wait(800); document.querySelector('#s2FF').click(); await wait(4000);
  showModule('satchel'); await wait(1500);
  const grab = () => ({ note: txt('#s10Note', 200), kpis: txt('#mod-satchel .kpis', 260), rows: [...document.querySelectorAll('#mod-satchel table tbody tr')].slice(0, 14).map(r => r.innerText.replace(/\s+/g, ' ').slice(0, 230)), bad: bad(document.querySelector('#mod-satchel').innerText) });
  document.querySelector('#s10SrcD').click(); await wait(2500); out.S_desk = grab();
  document.querySelector('#s10SrcF').click(); await wait(5000); out.S_forge = grab();
  const ffeed = MODI.forge.feed();
  const all = ffeed.map(p => p.text).join('\n');
  out.cool = (all.match(/[^.\n]{0,60}energy climate zone[^.\n]{0,200}\./gi) || []).slice(0, 5);
  out.czFact = (all.match(/[^\n]{0,80}energy climate zone of the[^\n]{0,120}/g) || []).slice(0, 2);
  out.lic = (all.match(/[^\n]{0,60}1234567[^\n]{0,60}/g) || []).slice(0, 3);
  out.hyph = (all.match(/[^\n ]*\w-\w[^\n ]*/g) || []).filter((v, i, a) => a.indexOf(v) === i).slice(0, 20);
  out.camp = (ffeed.find(p => /Camp Fire/.test(p.label)) || { text: '' }).text.replace(/\s+/g, ' ').slice(1100, 4200);
  BRANDX.reset && BRANDX.reset(); try { ['cg.brand.v1', 'cg.desk.v1', 'cg.forge.v1'].forEach(k => localStorage.removeItem(k)); } catch (e) { }
  return out;
}
