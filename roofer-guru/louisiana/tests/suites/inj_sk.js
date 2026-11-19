/* skeptic page check, after permit18/inj8.js: in #rooftops (Bayou St. John) add eight synthetic New Orleans permits to the live permit
   answer, each on its own single-family house with no permit, and read each house's permit weight, status, score and card sentence.
   node inj_sk.js <page.html> ...   (the first run with no picked8.json only picks the houses) */
const H = require('/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/review/r5check/skepticA/h.js');
const fs = require('fs'), LA = 29.9716, LO = -90.0829, PICK = __dirname + '/picked8.json';
const P = [
  { tag: 'A camelback+house (80%)', type: 'Renovation (Structural)', text: 'Renovation of shotgun double. Roof to be replaced on the camelback addition and the existing house.' },
  { tag: 'B garage as well as house (80%)', type: 'Renovation (Non-Structural)', text: 'Renovation of single family residence. Roof will be replaced on the garage as well as the house.' },
  { tag: 'C damaged by Ida (80%)', type: 'Renovation (Structural)', text: 'Construct rear addition with new roof. Roof damaged by Hurricane Ida will be replaced.' },
  { tag: 'D single and two-story (45%)', type: 'Renovation (Structural)', text: 'Construct single and two-story addition with new metal roof.' },
  { tag: 'A-x double gallery (45%)', type: 'Renovation (Structural)', text: 'Renovation of shotgun double. Roof to be replaced on the rear addition and the double gallery.' },
  { tag: 'B-x garage, house siding (15%)', type: 'Renovation (Non-Structural)', text: 'Renovation of single family residence. Roof to be replaced on detached garage, house siding and windows to be replaced.' },
  { tag: 'C-x damaged, decking (45%)', type: 'Renovation (Structural)', text: 'Construct rear addition with new roof. Roof damaged by Ida, decking to be replaced.' },
  { tag: 'D-x shotgun single (80%)', type: 'Renovation (Structural)', text: 'Renovate shotgun single and two-story addition with new metal roof.' },
];
async function settle(p) { const t0 = Date.now(); let st; while (Date.now() - t0 < 150000) { await p.waitForTimeout(3000); st = await p.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && st.tiles && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return st; }
(async () => {
  for (const f of process.argv.slice(2)) {
    const picked = fs.existsSync(PICK) ? JSON.parse(fs.readFileSync(PICK, 'utf8')) : null;
    const { browser, p, errs } = await H.open(f, '#rooftops');
    let hits = 0;
    if (picked) await p.route(/data\.nola\.gov\/resource\/rcm3-fn58\.json/, async route => {
      const resp = await route.fetch(); let j = []; try { j = await resp.json(); } catch (e) { }
      if (Array.isArray(j)) picked.forEach((b, i) => { const q = P[i]; j.push({ address: '', type: q.type, code: 'RNVS', issuedate: '2015-06-15T00:00:00.000', filingdate: '2015-06-15T00:00:00.000', currentstatus: 'Permit Issued', description: q.text, constrval: '45000', location_1: { latitude: String(b.lat), longitude: String(b.lon) } }); hits++; });
      await route.fulfill({ response: resp, body: JSON.stringify(j), headers: Object.assign({}, resp.headers(), { 'content-type': 'application/json' }) });
    });
    await p.evaluate(([la, lo]) => MODI.rooftops.api.goTo(la, lo, 18), [LA, LO]);
    await settle(p);
    if (!picked) {
      const c = await p.evaluate(([la, lo]) => MODI.rooftops.api.buildings().filter(b => b.cls === 'sf' && !(b.permits || []).length && b.status !== 'r').map(b => ({ id: b.id, lat: b.lat, lon: b.lon, d: Math.hypot(b.lat - la, (b.lon - lo) * 0.87) })).sort((a, b) => a.d - b.d).slice(0, 8), [LA, LO]);
      fs.writeFileSync(PICK, JSON.stringify(c)); console.log('picked', c.length, JSON.stringify(c)); await browser.close(); continue;
    }
    for (const [i, b] of picked.entries()) {
      await p.evaluate(id => MODI.rooftops.api.pick(id), b.id); await p.waitForTimeout(1200);
      const r = await p.evaluate(id => { const x = MODI.rooftops.api.buildings().find(q => q.id === id); const lis = [...document.querySelectorAll('li')].map(e => e.textContent);
        const card = lis.find(t => /The model reads the/.test(t)) || lis.find(t => /not used by the model/.test(t)) || '';
        return x ? { status: x.status, score: x.sc && x.sc.score, permits: (x.permits || []).map(q => q.w), card: card.slice(0, 150) } : null; }, b.id);
      console.log(f.split('/').slice(-2).join('/').padEnd(26), `| ${P[i].tag.padEnd(31)}`, JSON.stringify(r));
    }
    console.log(f.split('/').slice(-2).join('/'), '| injected into', hits, 'answers | real errors', JSON.stringify(H.realErrs(errs)), '| all errors', errs.length);
    await browser.close();
  }
})().catch(e => { console.error('ERROR', e); process.exit(1); });
