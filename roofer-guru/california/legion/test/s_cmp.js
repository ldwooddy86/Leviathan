/* The same questions asked of the original app (through its own interface: the place panel and the NPC panel as
   drawn) and of the library. Runs in either page; node cmp.js compares the two answers.
   arg: { T: epoch ms, zips: [...] } */
const wait = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const ddText = dd => { const ul = dd.querySelector('ul.members'); if (ul) return [...ul.children].map(li => { const n = li.querySelector('.member-name'), m = li.querySelector('.member-meta'); return clean(n && n.textContent) + (m ? ' (' + clean(m.textContent) + ')' : '') + (li.querySelector('.is-self') ? ' [this person]' : ''); }).join('; ');
  return [...dd.childNodes].map(c => clean(c.textContent)).filter(Boolean).join(' · '); };
const digest = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
const T = arg.T, out = { T, who: null, zips: {} };
const isLib = !window.legion;
let L, S;
if (isLib) { L = await window.__LEGION_LOAD__(); await L.ready(); L.clock = T; out.who = 'library'; S = L.internals.services; }
else { L = window.legion; L.clock.pause(); L.clock.set(T); await wait(600); out.who = 'original'; S = L.services; }
for (const zip of arg.zips) {
  const o = out.zips[zip] = {};
  if (isLib) {
    const r = L.npcsOf(zip, { sample: true, limit: 12, page: 1 });
    o.residents = r.people.map(p => ({ id: p.id, name: p.name, age: p.age }));
    o.total = r.total; o.households = r.households;
    const d = L.describe(o.residents[0].id, T);
    o.panel = { name: d.name, meta: d.meta, now: d.now, sections: d.sections, bio: d.bio };
    const d2 = L.describe(o.residents[5].id, T); o.panel2 = { name: d2.name, meta: d2.meta, now: d2.now, sections: d2.sections, bio: d2.bio };
    o.where = L.whereIs(o.residents[0].id, T).text;
  } else {
    L.place(zip); await wait(1500);
    const pp = document.querySelector('#place-panel');
    o.residents = [...pp.querySelectorAll('button.resident')].map(b => ({ id: b.dataset.id, name: clean(b.querySelector('.resident-name').textContent), age: +clean(b.querySelector('.resident-meta').textContent).split(' · ')[0] }));
    o.placeTitle = clean((pp.querySelector('h2') || {}).textContent);
    const W = S.world, zi = W.indexOf(zip); o.households = S.population.householdCount(zi);
    const read = async (btnIndex) => {
      pp.querySelectorAll('button.resident')[btnIndex].click(); await wait(1200);
      const np = document.querySelector('#npc-panel'), q = s => { const n = np.querySelector(s); return n ? clean(n.textContent) : ''; };
      const sections = [...np.querySelectorAll('#npc-tabpanel-profile section.p-section')].map(sec => ({ title: clean(sec.querySelector('h3').textContent), rows: [...sec.querySelectorAll('.dl-row')].map(r => ({ label: clean(r.querySelector('dt').textContent), value: ddText(r.querySelector('dd')) })) }));
      const id = q('.npc-id'), per = S.persona(id, { t: T });
      return { name: q('.npc-name'), meta: q('.npc-meta'), now: q('.npc-now') || null, sections, bio: per.ok ? per.value.bio : null };
    };
    o.panel = await read(0); L.npcPanel.close(); await wait(300); L.place(zip); await wait(800);
    o.panel2 = await read(5); L.npcPanel.close(); await wait(300);
    const a = S.activityAt(o.residents[0].id, T); o.whereRaw = a.ok ? a.value.kind : null;
  }
  /* the people themselves: the first 40 in household order, the twelve shown, and 40 spread through the ZIP */
  const pop = S.population, zi = S.world.indexOf(zip), hh = pop.householdCount(zi), ids = [];
  for (let h = 0; h < hh && ids.length < 40; h++) for (let m = 0, n = pop.householdSize(zi, h); m < n; m++) ids.push(`${zip}-${h}-${m}`);
  for (let k = 0; k < 40; k++) ids.push(`${zip}-${Math.floor((k + 0.5) * hh / 40)}-0`);
  o.residents.forEach(r => ids.push(r.id));
  o.npcDigest = {}; let all = '';
  for (const id of ids) { const p = isLib ? L.npc(id) : S.npc(id); const s = JSON.stringify(p); o.npcDigest[id] = digest(s); all += s; }
  o.allDigest = digest(all); o.nIds = ids.length;
  o.sampleNpc = JSON.parse(JSON.stringify(isLib ? L.npc(ids[41]) : S.npc(ids[41])));
}
return out;
