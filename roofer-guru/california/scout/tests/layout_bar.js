/* The engine's bar at 1280, 1024 and 390 px wide, with the most it ever holds (a craft out with its warp form, then the
   M3 with its buttons; an AR5 with wind and smoke set; the Time view with its year slider): nothing wider than the
   page, no control over another, the Roof View row first and the most prominent. A picture of each.
   (California's port of SP/tests/r11/bar_shot.js.) node layout_bar.js <page.html> <outdir> */
const L = require('./lib.js'), path = require('path'), fs = require('fs');
const FILE = process.argv[2], OUT = path.resolve(process.argv[3] || '.'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const C = L.checker(); let allErrs = [];
  for (const [vw, vh, tag] of [[1280, 900, 'w1280'], [1024, 800, 'w1024'], [390, 800, 'w390']]) {
    const { page, errs, close } = await L.launch({ w: vw, h: vh, hard: 9 }); const wait = L.wait;
    await L.openPage(page, FILE); await L.find(page, '1100 Orange Ave, Coronado, CA');
    await L.engine(page, { life: true });
    const measure = async (what) => { await page.evaluate(() => document.querySelector('#scEnBar').scrollIntoView({ block: 'start' })); await wait(700);
      const o = await page.evaluate(() => { const W = document.documentElement.clientWidth, bar = document.querySelector('#scEnBar'), wide = [], over = [];
        bar.querySelectorAll('*').forEach(e => { const cd = e.closest('details:not([open])'); if (cd && e !== cd && e.tagName !== 'SUMMARY') return; const r = e.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) wide.push((e.id || e.className || e.tagName) + ' ' + Math.round(r.right - W)); });
        const ctl = [...bar.querySelectorAll('button, input, select, output, .sc-fly, .sc-enlab')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('details:not([open]) > :not(summary)'); }).map(e => ({ e, r: e.getBoundingClientRect() }));
        for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) { const a = ctl[i], b = ctl[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue; const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top); if (w > 2 && h > 2) over.push(((a.e.id || a.e.textContent.trim().slice(0, 18)) + ' x ' + (b.e.id || b.e.textContent.trim().slice(0, 18)))); }
        const rows = [...bar.querySelectorAll('.sc-enrow')], rv = bar.querySelector('.sc-roofview'), fs = e => parseFloat(getComputedStyle(e).fontSize), clip = [...bar.querySelectorAll('button, .sc-stormt i, .sc-enlab')].filter(e => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible').map(e => e.textContent.trim().slice(0, 16));
        const pad = document.querySelector('#scEnPad').getBoundingClientRect(), attr = document.querySelector('.sc-en .sc-3dattr').getBoundingClientRect(), note = document.querySelector('#scEnNote').getBoundingClientRect(), hud = (document.querySelector('.se-hud') || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect(), view = document.querySelector('#scEn').getBoundingClientRect();
        return { W, scrollW: document.documentElement.scrollWidth, barH: Math.round(bar.getBoundingClientRect().height), wide: [...new Set(wide)].slice(0, 8), over: [...new Set(over)].slice(0, 8), clipped: [...new Set(clip)].slice(0, 10), first: rows[0] === rv, rvFont: fs(rv.querySelector('.seg button')), otherFont: Math.max(...rows.slice(1).map(r => fs(r.querySelector('.seg button') || r))), rvLabel: fs(rv.querySelector('.sc-enlab')), otherLabel: Math.max(...rows.slice(1).map(r => fs(r.querySelector('.sc-enlab')))), rvBorder: getComputedStyle(rv).borderTopWidth,
          padOverAttr: pad.bottom > attr.top + 1 && pad.right > attr.left, padOverNote: note.width > 0 && pad.right > note.left + 1 && pad.bottom > note.top + 1 && pad.top < note.bottom - 1, padOverHud: hud.bottom > pad.top + 1, viewH: Math.round(view.height), attrH: Math.round(attr.height), tickFont: fs(bar.querySelector('.sc-stormt i')) }; });
      C.ok(o.scrollW <= o.W + 1 && !o.wide.length && !o.over.length && o.first && o.rvFont >= o.otherFont && o.rvLabel > o.otherLabel && !o.padOverAttr && !o.padOverNote && !o.padOverHud, tag + ' ' + what, o);
      await page.screenshot({ path: path.join(OUT, 'bar_' + tag + '_' + what + '.png'), timeout: 120000, animations: 'disabled' }).catch(e => console.log('no picture', String(e).slice(0, 80)));
      await page.evaluate(() => document.querySelector('#scEn').scrollIntoView({ block: 'end' })); await wait(700);
      await page.screenshot({ path: path.join(OUT, 'view_' + tag + '_' + what + '.png'), timeout: 120000, animations: 'disabled' }).catch(e => console.log('no picture', String(e).slice(0, 80)));
    };
    await page.evaluate(() => { const api = MODI.rooftops.api, en = api.en(); api.setRain('ar5'); api.setWind('sa2'); api.setSky('smoke'); en.setHeight('saucer'); en.setGraphics({ lens: 'time' }); }); await wait(6000);
    await measure('saucer_ar5_time');
    await page.evaluate(() => { const api = MODI.rooftops.api, en = api.en(); api.setRain('dry'); api.setWind('calm'); api.setSky('none'); en.setHeight('m3'); en.setGraphics({ lens: 'storm' }); }); await wait(8000);
    await measure('m3_weather');
    /* the Scene menu open: its panel stays inside the window */
    await page.evaluate(() => { document.querySelector('#scEnBar').scrollIntoView({ block: 'end' }); document.querySelector('#scEnGfx > summary').click(); }); await wait(1200);
    const gp = await page.evaluate(() => { const p = document.querySelector('#scEnGfx .sc-gfxp'), r = p.getBoundingClientRect(), W = document.documentElement.clientWidth, wide = [...p.querySelectorAll('*')].filter(e => { const q = e.getBoundingClientRect(); return q.width && (q.right > W + 1 || q.left < -1); }).length; return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), W, H: innerHeight, wide, scrollW: document.documentElement.scrollWidth }; });
    C.ok(gp.left >= 0 && gp.right <= gp.W + 1 && !gp.wide && gp.scrollW <= gp.W + 1, tag + ' Scene menu open: inside the window', gp);
    await page.screenshot({ path: path.join(OUT, 'bar_' + tag + '_scene.png'), timeout: 120000, animations: 'disabled' }).catch(() => 0);
    allErrs = allErrs.concat(errs); await close();
  }
  console.log('PAGE ERRORS:', allErrs.length ? allErrs.length + '\n' + [...new Set(allErrs)].slice(0, 8).join('\n') : 'none'); console.log(C.bad ? C.bad + ' FAILED' : 'all pass'); process.exit(C.bad || allErrs.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
