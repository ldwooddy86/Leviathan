/* Full-page run of the seventeen atlas modules: node run_all.js <page.html> [dumpdir]
   For each module: page errors, bad words in the rendered text, empty svgs, empty table bodies, map paths. */
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const FILE = path.resolve(process.argv[2]); const DUMP = process.argv[3] ? path.resolve(process.argv[3]) : null;
const wait = ms => new Promise(r => setTimeout(r, ms));
const KEYS = ['index', 'storms', 'law', 'drivers', 'paid', 'ground', 'field', 'desk', 'forge', 'satchel', 'regions', 'lines', 'watch', 'weather', 'accounts', 'publish', 'stock'];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await ctx.route(/^https?:\/\//, r => r.abort());
  const errs = []; page.on('pageerror', e => errs.push(String(e && e.stack || e).slice(0, 700)));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
  const t0 = Date.now();
  await page.goto('file://' + FILE + '#index', { waitUntil: 'load', timeout: 300000 }); await wait(5000);
  console.log('loaded in', Date.now() - t0, 'ms; errors at load', errs.length);
  if (errs.length) console.log(errs.join('\n---\n'));
  let bad = 0;
  for (const k of KEYS) {
    const n = errs.length; const t = Date.now();
    await page.evaluate(k2 => showModule(k2), k); await wait(3000);
    const r = await page.evaluate(k2 => {
      const s = document.querySelector('#mod-' + k2); if (!s) return null;
      const txt = s.innerText;
      const find = (re) => { const out = []; let m; const g = new RegExp(re, 'g'); while ((m = g.exec(txt)) && out.length < 6) out.push(txt.slice(Math.max(0, m.index - 70), m.index + 40).replace(/\s+/g, ' ')); return out; };
      /* attribute text too: titles, values */
      const attrBad = []; s.querySelectorAll('[title],[value],[placeholder],[aria-label]').forEach(e => { ['title', 'value', 'placeholder', 'aria-label'].forEach(a => { const v = e.getAttribute(a); if (v && /undefined|NaN|\[object Object\]/.test(v) && attrBad.length < 5) attrBad.push(a + '=' + v.slice(0, 90)); }); });
      const svgs = [...s.querySelectorAll('svg')]; const vis = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const emptySvg = svgs.filter(v => vis(v) && v.querySelectorAll('path,rect,circle,line,polyline,polygon,text').length === 0).map(v => (v.parentElement.id || v.parentElement.className || '?'));
      const nanSvg = svgs.filter(v => /NaN|undefined/.test(v.innerHTML)).map(v => (v.parentElement.id || v.parentElement.className || '?') + ': ' + (v.innerHTML.match(/.{40}(NaN|undefined).{30}/) || [''])[0]);
      const emptyT = [...s.querySelectorAll('table')].filter(t => vis(t) && t.querySelectorAll('tr').length <= (t.querySelector('thead') ? 1 : 0)).map(t => t.id || t.parentElement.id || '?');
      const emptyBox = [...s.querySelectorAll('[id]')].filter(e => vis(e) && !e.children.length && !e.textContent.trim() && /DIV|TBODY|UL|OL|P/.test(e.tagName)).map(e => e.id);
      const maps = svgs.map(v => v.querySelectorAll('path').length).filter(n => n > 50);
      return { len: txt.length, h: (s.querySelector('h1,h2') || {}).innerText, svgs: svgs.length, maps, tables: s.querySelectorAll('table').length, undef: find('undefined'), nan: find('\\bNaN\\b'), obj: find('\\[object Object\\]'), nul: find('\\bnull\\b'), inf: find('Infinity'), attrBad, emptySvg, nanSvg, emptyT, emptyBox, txt: txt };
    }, k);
    if (DUMP && r) { fs.mkdirSync(DUMP, { recursive: true }); fs.writeFileSync(path.join(DUMP, k + '.txt'), r.txt); }
    const flags = r ? ['undef', 'nan', 'obj', 'nul', 'inf', 'attrBad', 'emptySvg', 'nanSvg', 'emptyT'].filter(f => r[f].length) : ['MISSING'];
    if (flags.length || errs.length > n) bad++;
    console.log(`MODULE ${k}: "${r && r.h}" text ${r && r.len} svgs ${r && r.svgs} maps ${JSON.stringify(r && r.maps)} tables ${r && r.tables} ms ${Date.now() - t} errors ${errs.length - n}` + (flags.length ? '  FLAGS ' + flags.join(',') : ''));
    for (const f of flags) if (r) console.log('   ' + f + ': ' + JSON.stringify(r[f]).slice(0, 900));
    if (r && r.emptyBox.length) console.log('   emptyBox: ' + JSON.stringify(r.emptyBox).slice(0, 500));
    for (let i = n; i < errs.length; i++) console.log('   ERR ' + errs[i]);
  }
  console.log('MODULES WITH FLAGS OR ERRORS:', bad, ' TOTAL PAGE ERRORS:', errs.length);
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
