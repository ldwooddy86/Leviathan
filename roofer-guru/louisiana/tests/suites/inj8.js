/* drive #rooftops in Bayou St. John: add four synthetic New Orleans permits to the live permit answer, each on its own single-family
   house with no permit, and read each house's permit weight, status, score and card sentence. node inj.js <page.html> ... */
const H = require('/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/review/r5check/skepticA/h.js');
const fs = require('fs'), LA = 29.9716, LO = -90.0829, PICK = __dirname + '/picked4.json';
const P = [
  { tag: 'A camelback+house (want 80%)', code: 'RNVS', type: 'Renovation (Structural)', d: '2015-06-15', text: 'Renovation of shotgun double. Roof to be replaced on the camelback addition and the existing house.' },
  { tag: 'B garage as well as house (want 80%)', code: 'RNVS', type: 'Renovation (Non-Structural)', d: '2015-06-15', text: 'Renovation of single family residence. Roof will be replaced on the garage as well as the house.' },
  { tag: 'C damaged by Ida (want 80%)', code: 'RNVS', type: 'Renovation (Structural)', d: '2015-06-15', text: 'Construct rear addition with new roof. Roof damaged by Hurricane Ida will be replaced.' },
  { tag: 'D single and two-story (want 45%)', code: 'RNVS', type: 'Renovation (Structural)', d: '2015-06-15', text: 'Construct single and two-story addition with new metal roof.' },
];
const P_OLD = [
  { tag: 'F1 part-only (want 45%)', code: 'RNVS', type: 'Renovation (Structural)', d: '2015-06-15', text: 'Renovation of existing structure and rear addition per plans. Remove existing roof on rear addition down to the deck and install new metal roof. New HVAC.' },
  { tag: 'F1 whole (want 80%)', code: 'RNVS', type: 'Renovation (Structural)', d: '2015-06-15', text: 'Reroof existing structure and rear addition.' },
  { tag: 'F2 whole (want 80%)', code: 'RNVS', type: 'Renovation (Non-Structural)', d: '2015-06-15', text: 'Renovate single family residence: new kitchen and baths, replace roof and flashing at dormers, paint exterior.' },
  { tag: 'F3 reroof (want 95%)', code: 'ROOF', type: 'Residential Re-Roofing', d: '2025-09-15', text: 'Main house and garage reroof including but not limited to decking and flashing under this permit.' },
];
async function settle(p) { const t0 = Date.now(); let st; while (Date.now() - t0 < 150000) { await p.waitForTimeout(3000); st = await p.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && st.tiles && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return st; }
(async () => {
  for (const f of process.argv.slice(2)) {
    const picked = fs.existsSync(PICK) ? JSON.parse(fs.readFileSync(PICK, 'utf8')) : null;
    const { browser, p, errs } = await H.open(f, '#rooftops');
    let hits = 0;
    if (picked) await p.route(/data\.nola\.gov\/resource\/rcm3-fn58\.json/, async route => {
      const resp = await route.fetch(); let j = []; try { j = await resp.json(); } catch (e) { }
      if (Array.isArray(j)) picked.forEach((b, i) => { const q = P[i]; j.push({ address: '', type: q.type, code: q.code, issuedate: q.d + 'T00:00:00.000', filingdate: q.d + 'T00:00:00.000', currentstatus: 'Permit Issued', description: q.text, constrval: '45000', location_1: { latitude: String(b.lat), longitude: String(b.lon) } }); hits++; });
      await route.fulfill({ response: resp, body: JSON.stringify(j), headers: Object.assign({}, resp.headers(), { 'content-type': 'application/json' }) });
    });
    await p.evaluate(([la, lo]) => MODI.rooftops.api.goTo(la, lo, 18), [LA, LO]);
    await settle(p);
    if (!picked) {
      const c = await p.evaluate(([la, lo]) => MODI.rooftops.api.buildings().filter(b => b.cls === 'sf' && !(b.permits || []).length && b.status !== 'r').map(b => ({ id: b.id, lat: b.lat, lon: b.lon, d: Math.hypot(b.lat - la, (b.lon - lo) * 0.87) })).sort((a, b) => a.d - b.d).slice(0, 4), [LA, LO]);
      fs.writeFileSync(PICK, JSON.stringify(c)); console.log('picked', JSON.stringify(c)); await browser.close(); continue;
    }
    for (const [i, b] of picked.entries()) {
      await p.evaluate(id => MODI.rooftops.api.pick(id), b.id); await p.waitForTimeout(1200);
      const r = await p.evaluate(id => { const x = MODI.rooftops.api.buildings().find(q => q.id === id); const lis = [...document.querySelectorAll('li')].map(e => e.textContent);
        const card = lis.find(t => /The model reads the/.test(t)) || lis.find(t => /not used by the model/.test(t)) || '';
        return x ? { status: x.status, score: x.sc && x.sc.score, permits: (x.permits || []).map(q => q.w), card: card.slice(0, 200) } : null; }, b.id);
      console.log(f.split('/').pop().padEnd(16), `| ${P[i].tag.padEnd(24)}`, JSON.stringify(r));
    }
    console.log(f.split('/').pop(), '| injected into', hits, 'answers | real errors', JSON.stringify(H.realErrs(errs)));
    await browser.close();
  }
})().catch(e => { console.error('ERROR', e); process.exit(1); });
