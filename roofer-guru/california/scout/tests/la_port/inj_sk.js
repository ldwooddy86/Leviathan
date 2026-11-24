/* California port of review/r8check/permits8_skeptic/inj_sk.js (CA/scout/tests/la_port/port_suites.py) */
/* skeptic page check, after permit18/inj8.js: in #rooftops (Hollywood) add eight synthetic City of Los Angeles permits to the live permit
   answer, each on its own single-family house with no permit, and read each house's permit weight, status, score and card sentence.
   node inj_sk.js <page.html> ...   (the first run with no picked8.json only picks the houses) */
const H = require('/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/review/r5check/skepticA/h.js');
const fs = require('fs'), LA = 34.1008, LO = -118.3362, PICK = __dirname + '/picked8.json';
const P = [
  { tag: 'A house and garage (want 0.9+)', d: '2015-06-15', text: 'Re-roof main dwelling and detached garage with Class A composition shingles over existing solid sheathing, 32 squares.' },
  { tag: 'B garage only (want <= 0.2)', d: '2015-06-15', text: 'Re-roof detached garage only' },
  { tag: 'C wind damage (want 0.9+)', d: '2015-06-15', text: 'Remove existing roof damaged by wind storm and install new Class A roof covering over new solid sheathing 24 Squares' },
  { tag: 'D addition with new roof (want <= 0.5)', d: '2015-06-15', text: 'Construct single story rear addition with new roof to match existing.' },
  { tag: 'E tile lift and relay (want 0.9+)', d: '2019-03-11', text: 'Remove existing roof tiles, apply new underlayment and reset roof tiles (Cool roof compliance is not required)' },
  { tag: 'F partial, 6 squares (want 0.3 to 0.5)', d: '2019-03-11', text: 'Partial reroof of rear section, 6 squares' },
  { tag: 'G solar only (want <= 0.15)', d: '2019-03-11', text: 'Install 5.2 kW roof mounted solar photovoltaic system, 14 modules' },
  { tag: 'H remodel, roof patch (want <= 0.45)', d: '2019-03-11', text: 'Kitchen and bath remodel; replace 2 windows; patch roof at new vent' },
];
async function settle(p) { const t0 = Date.now(); let st; while (Date.now() - t0 < 150000) { await p.waitForTimeout(3000); st = await p.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && st.tiles && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return st; }
(async () => {
  for (const f of process.argv.slice(2)) {
    const picked = fs.existsSync(PICK) ? JSON.parse(fs.readFileSync(PICK, 'utf8')) : null;
    const { browser, p, errs } = await H.open(f, '#rooftops');
    let hits = 0;
    if (picked) await p.route(/data\.lacity\.org\/resource\/pi9x-tg5x\.json/, async route => {
      const resp = await route.fetch(); let j = []; try { j = await resp.json(); } catch (e) { }
      if (Array.isArray(j)) picked.forEach((b, i) => { const q = P[i]; j.push({ primary_address: '', permit_type: 'Bldg-Alter/Repair', permit_sub_type: '1 or 2 Family Dwelling', issue_date: (q.d || '2015-06-15') + 'T00:00:00.000', status_desc: 'Issued', valuation: '45000', work_desc: q.text, lat: String(b.lat), lon: String(b.lon), apn: '' }); hits++; });
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
