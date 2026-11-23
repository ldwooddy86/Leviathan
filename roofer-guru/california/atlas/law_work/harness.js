// node harness.js : loads 00_core..05 then 14 (helpers), 15 and 22 in one scope with a stub DOM and the built data (or a stub),
// checks the shapes readers expect, mounts modules 03 and 10, runs the calculators and the fictional samples.
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');
const dataF = path.join(__dirname, '..', '..', 'data', 'out', 'ca_atlas_data.json');
let DATAJ = null; try { DATAJ = JSON.parse(fs.readFileSync(dataF, 'utf8')); } catch (e) { }
const fails = []; const ok = (c, msg) => { if (!c) fails.push(msg); };
// ---- stub DOM: every element is a permissive object; innerHTML parsing finds ids so $('#id') returns a stable element
const els = {};
function mkEl(id) {
  const el = { id: id || '', _html: '', value: '', hidden: false, dataset: {}, style: {}, children: [], className: '', textContent: '', checked: true, selectedOptions: [{ textContent: 'x' }],
    classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
    setAttribute(k, v) { this['_' + k] = v; }, getAttribute(k) { return this['_' + k] == null ? null : this['_' + k]; }, removeAttribute() { },
    addEventListener(t, f) { (this._ev = this._ev || {})[t] = f; }, removeEventListener() { }, appendChild(c) { this.children.push(c); return c; }, append() { }, remove() { }, focus() { }, click() { if (this.onclick) this.onclick({ target: this }); },
    insertAdjacentHTML(p, h) { this._html += h; scan(h); }, querySelector(s) { return q(s); }, querySelectorAll() { return []; }, getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 300 }; }, closest() { return null; }, contains() { return false; }, getContext() { return null; } };
  Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(h) { this._html = String(h); scan(this._html); } });
  return el;
}
function scan(h) {
  String(h).replace(/<(input|select|textarea|div|button|span|table|p|ol|ul)\b([^>]*?)\bid="([^"]+)"([^>]*)>/g, (m, tag, a, id, b) => {
    const e = els[id] || (els[id] = mkEl(id)); const attrs = a + ' ' + b; const v = attrs.match(/\bvalue="([^"]*)"/);
    if (tag === 'input') { e.value = v ? v[1] : ''; }
    if (tag === 'select') { const rest = h.slice(h.indexOf(m) + m.length); const o = rest.match(/<option[^>]*value="([^"]*)"/); e.value = o ? o[1] : ''; }
    return m;
  });
}
function q(s) { const m = String(s).match(/^#([\w-]+)$/); if (m) return els[m[1]] || (els[m[1]] = mkEl(m[1])); return mkEl(''); }
const document = { documentElement: mkEl('html'), body: mkEl('body'), head: mkEl('head'), querySelector: q, querySelectorAll() { return []; }, getElementById: id => q('#' + id), createElement: () => mkEl(''), createElementNS: () => mkEl(''), addEventListener() { }, createTextNode: () => mkEl(''), fonts: { ready: Promise.resolve() } };
const stubData = { zcols: ['zip'], zips: [], parishes: [], meta: { model: { LINES: null, W: {}, corr: [], REP: {}, VAL: {}, GRADE: {}, TIER: {} }, pools: {}, cases: {}, fees: {} }, cities: [], places: [], comp: [], geo: {}, ts: {} };
const store = {};
const sandbox = { console, document, navigator: { clipboard: {}, userAgent: 'node' }, location: { hash: '', search: '', href: 'http://x/' }, localStorage: { getItem: k => (k in store ? store[k] : null), setItem(k, v) { store[k] = String(v); }, removeItem(k) { delete store[k]; } },
  getComputedStyle: () => ({ getPropertyValue: () => '#888888' }), matchMedia: () => ({ matches: false, addEventListener() { }, addListener() { } }), setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() { }, requestAnimationFrame() { return 0; }, addEventListener() { }, removeEventListener() { }, fetch: () => Promise.reject(new Error('no net')), URL, Blob: function () { }, Intl, Date, Math, JSON, performance: { now: () => 0 }, innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1, history: { replaceState() { } } };
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
sandbox.__ATLAS_DATA__ = DATAJ || stubData; sandbox.__NWS_SNAPSHOT__ = {};
vm.createContext(sandbox);
const files = ['00_core.js', '01_brand.js', '02_map.js', '03_charts.js', '04_content.js', '05_satchel_rules.js'];
const tail = `
;globalThis.__T = { LAWX, ADRULES, PL, PLI, LAWLINK, LAWPUB, LAWFAQ, NEG_COMMON, lineName, fillCopy, SAT, satchelLint, satCtx, RX_CLAIMNEG, RX_CLAIMSVC, RX_COVER, RX_DED, RX_FIN, RX_CERT, LINE_KEYS: (typeof LINE_KEYS !== 'undefined' ? LINE_KEYS : null), RES_LINES: (typeof RES_LINES !== 'undefined' ? RES_LINES : null), COM_LINES: (typeof COM_LINES !== 'undefined' ? COM_LINES : null), BRAND, MODI, DASH_RE, houseClean, META: (typeof META !== 'undefined' ? META : null),
  m15: (typeof cancelBy !== 'undefined') ? { cancelBy, downCap, coolRule, COOLROOF, LAW_TIMELINE, LAW_GAPS, parseD, fmtDate, addDays } : null, CA_CITIES: (typeof CA_CITIES !== 'undefined' ? CA_CITIES : null), LICNUM: (typeof LICNUM !== 'undefined' ? LICNUM : null), SAT_EXTRA: (typeof SAT_EXTRA !== 'undefined' ? SAT_EXTRA : null) };`;
// one script so top-level const of each file is visible to the next, as on the page
const extra = ['const listAnd = a => a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];', 'const PLATS = ["google", "meta"]; const PLAB = { google: "Google Search", meta: "Meta" };'];
let code = files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8').replace(/^"use strict";\s*$/m, '')).join('\n;\n') + '\n;' + extra.join('\n') + '\n;' + ['15_m03_law.js', '22_m10_satchel.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8').replace(/^"use strict";\s*$/m, '')).join('\n;\n') + tail;
try { vm.runInContext(code, sandbox, { filename: 'atlas_concat.js' }); } catch (e) { console.log('LOAD ERROR', e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e); process.exit(1); }
const T = sandbox.__T;
console.log('data:', DATAJ ? 'built ca_atlas_data.json' : 'stub');
// ---------- 04_content shapes ----------
const KEYS13 = ['replace', 'repair', 'storm', 'fire', 'harden', 'tile', 'solar', 'metal', 'mh', 'mf', 'comm', 'coat', 'newc'];
ok(T.PL.length === 13 && T.PL.map(l => l.key).join() === KEYS13.join(), 'PL keys/order');
if (T.LINE_KEYS) ok(T.LINE_KEYS.join() === KEYS13.join(), 'LINE_KEYS in 00_core differ: ' + T.LINE_KEYS.join());
const ids = new Set(T.LAWX.items.map(x => x.id)); ok(ids.size === T.LAWX.items.length, 'duplicate LAWX ids');
T.LAWX.items.forEach(x => { ['id', 't', 'cite', 'eff', 'g', 'url', 's'].forEach(k => ok(typeof x[k] === 'string' && x[k].length > 0, `LAWX ${x.id} missing ${k}`)); ok(/^[ABCD]$/.test(x.g), `LAWX ${x.id} grade`); ok(Array.isArray(x.lines) && x.lines.length && x.lines.every(k => KEYS13.includes(k)), `LAWX ${x.id} lines`); ok(/^https:\/\//.test(x.url), `LAWX ${x.id} url`); });
T.LAWX.pending.forEach(x => ['t', 's', 'g', 'src'].forEach(k => ok(typeof x[k] === 'string' && x[k], 'pending ' + k)));
T.ADRULES.forEach(r => ok(Array.isArray(r) && r.length === 4 && r.every(c => typeof c === 'string' && c), 'ADRULES row ' + r[0]));
const toks = new Set();
T.PL.forEach(l => {
  ['key', 'name', 'short', 'tok', 'g', 'seg', 'unit', 'what', 'who', 'season', 'price'].forEach(k => ok(typeof l[k] === 'string' && l[k], `PL ${l.key}.${k}`));
  ok(/^[A-Z]+$/.test(l.tok) && !toks.has(l.tok), `PL ${l.key} tok`); toks.add(l.tok); ok(['res', 'com'].includes(l.seg), `PL ${l.key} seg`); ok(T.PLI[l.key] === l && typeof l.i === 'number', `PLI ${l.key}`);
  ok(Array.isArray(l.law) && l.law.length && l.law.every(id => ids.has(id)), `PL ${l.key} law ids: ${(l.law || []).filter(id => !ids.has(id))}`);
  ['kw', 'kwEs', 'neg'].forEach(k => ok(Array.isArray(l[k]), `PL ${l.key}.${k}`)); ok(l.kw.length >= 5, `PL ${l.key} kw count`);
  ok(Array.isArray(l.angles) && l.angles.length >= 2 && l.angles.some(a => a.lang !== 'es'), `PL ${l.key} angles`);
  if (T.RES_LINES && T.COM_LINES) ok((l.seg === 'res') === T.RES_LINES.includes(l.key) || (l.seg === 'com') === T.COM_LINES.includes(l.key), `PL ${l.key} seg vs RES/COM lines`);
  if (T.META && T.META.model && T.META.model.GRADE && T.META.model.GRADE[l.key] && T.META.model.GRADE[l.key] !== l.g) console.log(`  note: PL ${l.key} grade ${l.g} vs META.model.GRADE ${T.META.model.GRADE[l.key]}`);
});
Object.keys(T.LAWPUB).forEach(k => { const L = T.LAWPUB[k]; ok(ids.has(k), 'LAWPUB key not a LAWX id: ' + k); ok(Array.isArray(L) && L.length === 4 && L.slice(0, 3).every(s => typeof s === 'string' && s), 'LAWPUB shape ' + k); ok(!T.DASH_RE.test(L[0] + L[1] + L[2]), 'LAWPUB hyphen: ' + k); });
T.LAWFAQ.forEach(f => { ok(f.length === 3 && f[2].every(id => ids.has(id)), 'LAWFAQ ids'); ok(!T.DASH_RE.test(f[0] + f[1]), 'LAWFAQ hyphen: ' + f[0]); });
// angles: lengths and house style, with a sample company (plainly invented)
Object.assign(T.BRAND, { name: 'Sample Roofing Company', short: 'Sample Roofing', lic: '1234567', city: 'Sacramento', phone: '9165550100' });
let angN = 0; const ctxSelf = T.satCtx({});
T.PL.forEach(l => l.angles.forEach(a => { angN++; const h = T.fillCopy(a.h, { city: 'Sacramento' }), d = T.fillCopy(a.d, { city: 'Sacramento' });
  ok(h.length <= 30, `angle ${l.key}:${a.id} headline ${h.length}: ${h}`); ok(d.length <= 90, `angle ${l.key}:${a.id} description ${d.length}: ${d}`);
  ok(!/\{\w+\}/.test(h + d), `angle ${l.key}:${a.id} unfilled token`);
  T.satchelLint(h + '. ' + d, ctxSelf).forEach(x => { if (x.rule.sev !== 'note') fails.push(`angle ${l.key}:${a.id} trips ${x.rule.id}: ${x.ev}`); }); }));
ok(T.fillCopy('{Lic} in {County} County', { county: 'Placer' }) === 'CSLB Lic. #1234567 in Placer County', 'fillCopy: ' + T.fillCopy('{Lic} in {County} County', { county: 'Placer' }));
// ---------- 05 rule pack ----------
const rid = new Set(); T.SAT.rules.concat(T.SAT.web).forEach(r => { ok(!rid.has(r.id), 'dup rule ' + r.id); rid.add(r.id); ['id', 'sev', 'name', 'cite', 'v', 'fix'].forEach(k => ok(typeof r[k] === 'string' && r[k], `rule ${r.id}.${k}`)); ok(typeof r.test === 'function', `rule ${r.id} test`); ok(['block', 'warn', 'note'].includes(r.sev) && ['✔', '◐'].includes(r.v), `rule ${r.id} sev/v`); });
T.SAT.rules.forEach(r => ok(typeof r.fam === 'string' && r.fam && typeof r.route === 'string', `rule ${r.id} fam/route`));
(T.SAT_EXTRA || []).forEach(r => { ok(!rid.has(r.id), 'dup extra ' + r.id); rid.add(r.id); });
T.SAT.controls.forEach(c => ok(c.length === 3 && c[2].every(id => rid.has(id)), 'control ' + c[0] + ' unknown ids: ' + c[2].filter(id => !rid.has(id))));
['LIC1', 'LIC2', 'GADS1', 'HOUSE1', 'HOUSE2', 'COOL', 'TCPA'].forEach(id => ok(rid.has(id), 'reader id missing ' + id));
const hit = (txt, ctx) => T.satchelLint(txt, ctx || {}).map(x => x.rule.id);
const expect = (txt, id, ctx) => ok(hit(txt, ctx).includes(id), `expected ${id} on: ${txt} (got ${hit(txt, ctx)})`);
const clean = (txt, ctx) => { const h = hit(txt, Object.assign({ noHouse: true }, ctx || {})).filter(id => !['FTC2'].includes(id)); ok(!h.length, `expected clean: ${txt} (got ${h})`); };
expect('We pay your deductible on every roof', 'DED1'); expect('We negotiate with your insurance company for you', 'INS1'); expect('Our claims specialists help', 'INS2'); expect('Your policy covers a new roof', 'INS3');
expect('Our fireproof roofs', 'FIRE1'); expect('Get a 20% insurance discount', 'FIRE2'); expect('We guarantee your insurance renewal', 'FIRE3'); expect('Class A shingles installed', 'FIRE4'); expect('Zone Zero compliant gutters', 'FIRE5'); expect('CAL FIRE approved contractor', 'FIRE6');
expect('We secure the grant for you', 'GRANT1'); expect('New cedar shakes installed today', 'SHAKE1'); expect('Cuts your cooling bill by 30%', 'ENR1'); expect('You keep your net metering', 'SOL1'); expect('Solar removal and reinstall', 'SOL2');
expect('A 50% deposit holds your place', 'PAY1'); expect('Fire pricing in effect', 'GOUGE'); expect('Out of state crews arriving', 'STORM1'); expect('Lifetime warranty', 'LIFE1'); expect('No permit needed', 'LIC4'); expect('$149 a month', 'FIN1'); expect('The #1 roofer', 'SUP1'); expect('GAF Master Elite', 'CERT1');
expect('We pay agents a referral fee of $200', 'REF1'); expect('Our public adjuster helps', 'PADJ1'); expect('ring-shank nails', 'HOUSE1'); expect('Call CSLB license number today', 'HOUSE2'); expect('x'.repeat(31), 'GADS1', { headline: true });
expect('Hello, new roof today', 'COOL', { channel: 'door' }); expect('Hello, new roof today', 'HIS1', { channel: 'door' }); expect('text', 'TCPA', { channel: 'sms' });
ok(hit('roofing ad', { asset: true, lic: '' }).includes('LIC1'), 'LIC1 no license'); ok(hit('roofing ad', { asset: true, lic: '1234567' }).includes('LIC2'), 'LIC2'); ok(!hit('CSLB Lic. #1234567', { asset: true, lic: '1234567' }).some(i => /^LIC[12]$/.test(i)), 'LIC1/2 clean');
clean('Fire zone reroofs built as tested Class A assemblies, with the paperwork.'); clean('Replace a Wood Shake Roof with a tested Class A assembly.'); clean('A 10 percent deposit, never more than $1,000.'); clean('Insurers must weigh a Class A roof in the rate. Ask yours what it gives.'); clean('Written itemized estimate and photo report after wind damage.');
const goodContract = 'HOME IMPROVEMENT. Contractor license number 1234567. You are entitled to a completely filled in copy of this agreement, signed by both you and the contractor, before any work may be started. Downpayment $1,000. THE DOWNPAYMENT MAY NOT EXCEED $1,000 OR 10 PERCENT OF THE CONTRACT PRICE, WHICHEVER IS LESS. IT IS AGAINST THE LAW FOR A CONTRACTOR TO COLLECT PAYMENT FOR WORK NOT YET COMPLETED, OR FOR MATERIALS NOT YET DELIVERED. MECHANICS LIEN WARNING. Three-Day Right to Cancel: you, the buyer, have the right to cancel this contract within three business days. Send the Notice of Cancellation to cancel@sample.example.';
ok(!hit(goodContract, { contract: true, noHouse: true }).some(i => /^CON/.test(i)), 'good contract trips: ' + hit(goodContract, { contract: true, noHouse: true }));
const badC = hit('Roofing agreement. Price $24,000. A down payment of $8,000 is due at signing.', { contract: true, noHouse: true }); ['CON1', 'CON2', 'CON3', 'CON4', 'CON5', 'CON6', 'CON7'].forEach(i => ok(badC.includes(i), 'bad contract should trip ' + i));
ok(!hit(goodContract, { noHouse: true }).some(i => /^CON/.test(i)), 'contract rules must not run without ctx.contract');
const webHit = (h, c) => T.SAT.web.filter(w => w.test(h, c || { lic: '1234567', offices: ['Sacramento'] })).map(w => w.id);
ok(webHit('<p>CSLB Lic. #1234567 Sacramento</p>').length === 0, 'web clean: ' + webHit('<p>CSLB Lic. #1234567 Sacramento</p>'));
const wb = webHit('<meta name="description" content="We pay your deductible"><input type="checkbox" checked><script>fbevents.js</script>"aggregateRating"<p>we negotiate with your insurer</p>'); ['WEB1', 'WEB2', 'WEB3', 'WEB4', 'WEB5', 'WEB6', 'WEB7'].forEach(i => ok(wb.includes(i), 'web should trip ' + i + ' got ' + wb));
ok(T.satCtx().juris === 'California' && 'fire' in T.satCtx(), 'satCtx');
// ---------- module 03 ----------
const M = T.m15; ok(!!M, 'module 15 globals');
if (M) {
  const d = M.parseD('2026-11-23'); // Monday; Thanksgiving is Thursday Nov 26
  ok(M.fmtDate(M.cancelBy(d, 3)) === 'November 27, 2026', 'cancelBy 3: ' + M.fmtDate(M.cancelBy(d, 3)));
  ok(M.fmtDate(M.cancelBy(d, 5)) === 'November 30, 2026', 'cancelBy 5: ' + M.fmtDate(M.cancelBy(d, 5)));
  ok(M.fmtDate(M.cancelBy(d, 7)) === 'December 2, 2026', 'cancelBy 7: ' + M.fmtDate(M.cancelBy(d, 7)));
  ok(M.downCap(18500) === 1000 && M.downCap(6000) === 600 && M.downCap(0) === 0, 'downCap');
  let r = M.coolRule('sf', 'steep', 10, 2200, 1300, {}); ok(r.trig && r.row && r.row.sr === 0.20 && r.row.sri === 16, 'cool sf steep z10');
  r = M.coolRule('sf', 'steep', 3, 2200, 2200, {}); ok(r.trig && !r.row, 'cool sf steep z3 none');
  r = M.coolRule('sf', 'steep', 10, 2200, 1100, {}); ok(!r.trig, 'cool sf exactly 50 percent not triggered');
  r = M.coolRule('sf', 'low', 7, 2000, 1500, {}); ok(r.row && r.row.sr === 0.63 && /no added insulation/.test(r.ins), 'cool sf low z7');
  r = M.coolRule('mf', 'low', 2, 10000, 2500, {}); ok(r.trig && r.row && r.row.sri === 75 && /R-14/.test(r.ins), 'cool mf low z2 by 2,000 sq ft');
  r = M.coolRule('nr', 'steep', 12, 10000, 6000, {}); ok(r.row && r.row.sr === 0.25 && r.row.te === 0.80 && r.row.sri === 23, 'cool nr steep z12');
  r = M.coolRule('nr', 'low', 7, 10000, 6000, {}); ok(r.row.sr === 0.63 && /R-17/.test(r.ins), 'cool nr low z7');
  r = M.coolRule('hm', 'low', 12, 10000, 6000, {}); ok(!r.row, 'cool hotel low z12 none'); r = M.coolRule('hm', 'low', 13, 10000, 6000, {}); ok(r.row && r.row.sr === 0.55 && r.row.sri === 64, 'cool hotel low z13');
  r = M.coolRule('sf', 'steep', 10, 2200, 2200, { heavy: true }); ok(r.exempt.length === 1, 'cool heavy exempt'); r = M.coolRule('sf', 'steep', 11, 2200, 2200, { x: 'noduct' }); ok(r.exempt.length === 0, 'no ducts not in zone 11'); r = M.coolRule('sf', 'steep', 12, 2200, 2200, { x: 'noduct' }); ok(r.exempt.length === 1, 'no ducts zone 12');
  M.LAW_TIMELINE.forEach(t => { ok(t.length === 5 && (t[0] ? !!M.parseD(t[0]) : !!t[1]) && ids.has(t[4]), 'timeline row ' + t[2]); });
  ok(M.LAW_TIMELINE.map(t => t[0] || '').filter(Boolean).join() === M.LAW_TIMELINE.map(t => t[0] || '').filter(Boolean).sort().join(), 'timeline order');
}
const mount = key => { const m = T.MODI[key]; ok(!!m, 'module ' + key + ' registered'); if (!m) return null; const root = q('#mod-' + key); try { m.mount(root); } catch (e) { fails.push('mount ' + key + ': ' + (e.stack || e).toString().split('\n').slice(0, 4).join(' | ')); } return root; };
const r3 = mount('law');
['l3Kpis', 'l3Time', 'l3LO', 'l3CO', 'l3KO', 'l3GO', 'l3TO', 'l3PO', 'l3NO', 'l3SO', 'l3Mkt', 'l3Reg', 'l3Ads', 'l3Pend', 'l3Gaps', 'l3Foot'].forEach(id => ok(els[id] && els[id]._html.length > 40 && !/undefined|NaN|\[object/.test(els[id]._html), `module 03 #${id} empty or broken: ${els[id] ? (els[id]._html.match(/.{0,40}(undefined|NaN|\[object).{0,40}/) || [els[id]._html.slice(0, 60)])[0] : 'missing'}`));
// drive some inputs
const setv = (id, v, fnEl) => { els[id].value = v; const f = els[id]._ev && els[id]._ev.input; if (f) f(); };
if (els.l3LV) { setv('l3LV', '600'); setv('l3LP', 'no'); setv('l3LE', 'no'); ok(/minor work exemption/.test(els.l3LO._html), 'license screen: minor work'); setv('l3LV', '18500'); ok(/C-39 Roofing/.test(els.l3LO._html) && /\$1,000/.test(els.l3LO._html), 'license screen: C-39'); }
if (els.l3CA) { setv('l3CA', '5000'); ok(/over the cap/.test(els.l3CO._html), 'contract screen: over cap'); setv('l3CD', '2026-11-23'); setv('l3CB', 'senior'); ok(/November 30, 2026/.test(els.l3CO._html), 'contract screen senior date'); setv('l3CE', 'yes'); ok(/December 2, 2026/.test(els.l3CO._html), 'contract screen disaster date'); }
if (els.l3KN) { setv('l3KN', '2026-11-01'); setv('l3KP', '2026-11-10'); ok(/November 16, 2026/.test(els.l3KO._html) && /December 20, 2026/.test(els.l3KO._html) && /January 19, 2027/.test(els.l3KO._html), 'claim clock dates: ' + (els.l3KO._html.match(/<b>[^<]*\d{4}<\/b>/g) || []).join(' ')); }
if (els.l3GN) { setv('l3GD', '2026-11-01'); setv('l3GP', '1000'); setv('l3GN', '1180'); ok(/\$1,100/.test(els.l3GO._html) && /April 30, 2027/.test(els.l3GO._html) && /above it/.test(els.l3GO._html), 'gouge screen'); }
if (els.l3TR) { setv('l3TR', '1100'); ok(/whole roof must meet/.test(els.l3TO._html) && /not triggered/.test(els.l3TO._html), 'trigger screen at exactly 50 percent (2025: Class A yes, cool roof no)'); setv('l3TC', '22'); ok(/Below the more than 50 percent trigger/.test(els.l3TO._html), 'trigger screen 2022 code'); }
const r10 = mount('satchel');
if (els.s10Sample && els.s10Sample.onclick) {
  const run = (btn) => { try { els[btn].onclick(); } catch (e) { fails.push(btn + ': ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); return ''; } return (els.s10Kpis && els.s10Kpis._html) || ''; };
  const k1 = run('s10Sample'); const nums = h => (h.match(/<div class="kv">([^<]*)<\/div>/g) || []).map(s => s.replace(/<[^>]+>/g, '')); console.log('sample page   KPIs (confirmed, candidates, cleared, not observable, intel, answer):', nums(k1).join(' | '));
  ok(+nums(k1)[0] >= 3 && +nums(k1)[1] >= 12, 'sample page should confirm >= 3 and list >= 12 candidates');
  const k2 = run('s10SampleC'); console.log('sample contract KPIs:', nums(k2).join(' | ')); ok(+nums(k2)[0] >= 5, 'sample contract should confirm the five missing statutory texts');
  const k3 = run('s10SampleD'); console.log('sample door    KPIs:', nums(k3).join(' | ')); ok(+nums(k3)[0] >= 2, 'sample door script');
} else fails.push('satchel sample buttons not wired');
['s10BookT', 's10Ctrl', 's10Route'].forEach(id => ok(els[id] && els[id]._html.length > 100 && !/undefined/.test(els[id]._html), 'module 10 #' + id));
console.log(`rows: LAWX.items ${T.LAWX.items.length} (A ${T.LAWX.items.filter(x => x.g === 'A').length}, B ${T.LAWX.items.filter(x => x.g === 'B').length}, C ${T.LAWX.items.filter(x => x.g === 'C').length}, D ${T.LAWX.items.filter(x => x.g === 'D').length}), pending ${T.LAWX.pending.length}, ADRULES ${T.ADRULES.length}, LAWPUB ${Object.keys(T.LAWPUB).length}, LAWFAQ ${T.LAWFAQ.length}, LAWLINK ${Object.keys(T.LAWLINK).length}, PL ${T.PL.length}, angles ${angN}, kw ${T.PL.reduce((s, l) => s + l.kw.length + l.kwEs.length, 0)}, neg ${T.PL.reduce((s, l) => s + l.neg.length, 0)}, SAT.rules ${T.SAT.rules.length}, web ${T.SAT.web.length}, controls ${T.SAT.controls.length}, extra ${(T.SAT_EXTRA || []).length}, timeline ${M ? M.LAW_TIMELINE.length : 0}, gaps ${M ? M.LAW_GAPS.length : 0}, CA_CITIES ${(T.CA_CITIES || []).length}`);
console.log(fails.length ? 'FAILS (' + fails.length + '):\n - ' + fails.join('\n - ') : 'ALL CHECKS PASSED');
process.exit(fails.length ? 2 : 0);
