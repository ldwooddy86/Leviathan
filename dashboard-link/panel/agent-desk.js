/* ==== leviathan agent desk ==== */
/* The Agent Desk: a module added to a Thermal Debt atlas by dashboard-link (lib/panel.mjs), where the work of the paid
   ads specialist and the content strategist arrives in one place. It reads hand-offs (put in this file by the agents'
   own commands, or opened here as a file or a folder), shows what was handed over, screens the ad copy with this
   dashboard's own rules, and puts the work where it belongs through the dashboard's own doors: a media plan through the
   Campaign Desk's Load, pages through the Publish import. It spends nothing and publishes nothing: a plan loads as a
   plan and pages land as drafts.

   It is plain script in the dashboard's own style and uses the dashboard's own helpers (registerModule, mastHTML,
   callout, kpiHTML, esc, store, toast, saveFile, zipBlob, satchelLint). Every string that came from a hand-off or from
   this browser's storage is escaped before it reaches the page. If the dashboard it is put in has no module system it
   does nothing at all. */
(function () {
  "use strict";
  if (typeof registerModule !== 'function' || typeof MODS === 'undefined' || typeof MODI === 'undefined' || MODI.agents) return;
  const VERSION = 1, KEY = 'agents', STORE = 'lv.agentdesk.v1', FORMAT = 'leviathan.handoff.bundle', ANSWERS = 'leviathan.owner-answers';
  /* this browser's storage is the dashboard's too (the desk's plan, the pages in Publish): the panel keeps to a small share of it */
  const BUDGET = 600000, KEEP = 6;
  const NUM = String(Math.max(0, ...MODS.map(m => +m.num || 0)) + 1).padStart(2, '0');
  const AGENT = { 'paid-ads-specialist': 'Paid ads specialist', 'content-strategist': 'Content strategist' };

  /* ---------- what is on file ---------- */
  const arr = v => (Array.isArray(v) ? v : []), obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const isBlueprint = p => !!p && typeof p === 'object' && !!p.page && typeof p.page === 'object' && typeof p.page.slug === 'string' && Array.isArray(p.sections);
  const isBundle = o => !!o && typeof o === 'object' && o.format === FORMAT && typeof o.id === 'string' && !!o.id && ((!!o.paid && typeof o.paid === 'object' && !!o.paid.plan && typeof o.paid.plan === 'object') || (!!o.content && typeof o.content === 'object' && arr(o.content.pages).some(isBlueprint)));
  const embedded = (() => { try { const n = document.getElementById('lvp-data'), d = n ? JSON.parse(n.textContent) : null; return d && typeof d === 'object' ? { atlas: obj(d.atlas), bundles: arr(d.bundles).filter(isBundle), installed: d.installed || '' } : { atlas: {}, bundles: [] }; } catch (e) { return { atlas: {}, bundles: [], error: String(e && e.message || e) }; } })();
  const S = (() => { const s = obj(store.get(STORE, {})); return { applied: obj(s.applied), answers: obj(s.answers), tab: obj(s.tab), kept: arr(s.kept).filter(isBundle), sel: typeof s.sel === 'string' ? s.sel : '', who: typeof s.who === 'string' ? s.who : '' }; })();
  let stored = true;
  /* Hand-offs opened here by hand are kept in this browser so that a reload does not lose them: the newest few, without the
     text of their bulk files (open the hand-off again to save those), and never past the panel's share of the storage. */
  const slim = b => (b.paid && b.paid.files ? Object.assign({}, b, { paid: Object.assign({}, b.paid, { files: arr(b.paid.files).map(f => ({ name: f.name, what: f.what, text: null })) }) }) : b);
  function save() {
    const last = (o, n) => Object.fromEntries(Object.entries(o).slice(-n));
    S.applied = last(S.applied, 40); S.answers = last(S.answers, 40); S.tab = last(S.tab, 40);
    let kept = S.kept.slice(0, KEEP).map(slim), text = '';
    for (;;) { text = JSON.stringify(Object.assign({}, S, { kept })); if (text.length <= BUDGET || !kept.length) break; kept = kept.slice(0, -1); }
    try { localStorage.setItem(STORE, text); stored = kept.length === Math.min(S.kept.length, KEEP); }
    catch (e) { stored = false; try { localStorage.setItem(STORE, JSON.stringify(Object.assign({}, S, { kept: [] }))); } catch (e2) { /* this session only */ } }
  }
  const all = () => { const by = new Map(); embedded.bundles.forEach(b => by.set(b.id, Object.assign({ origin: 'file' }, b))); S.kept.forEach(b => { const have = by.get(b.id); if (!have || String(b.made) > String(have.made)) by.set(b.id, Object.assign({ origin: 'opened' }, b)); }); return [...by.values()].sort((a, b) => String(b.made).localeCompare(String(a.made))); };
  const find = id => all().find(b => b.id === id) || null;

  /* ---------- small things ---------- */
  const $money = v => (isN(v) ? '$' + N(v) : '—');
  const when = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const day = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const txt = x => (typeof x === 'string' ? x : x && typeof x.text === 'string' ? x.text : '');
  const pinOf = x => (x && typeof x === 'object' && +x.pin > 0 ? Math.round(+x.pin) : 0);
  const len = s => [...String(s).replace(/\{keyword:([^}]*)\}/gi, '$1')].length;
  const plural = (n, one, many) => `${N(n)} ${n === 1 ? one : (many || one + 's')}`;
  const wait = (test, ms) => new Promise(done => { const t0 = Date.now(); (function tick() { let ok = false; try { ok = !!test(); } catch (e) { ok = false; } if (ok || Date.now() - t0 > ms) done(ok); else setTimeout(tick, 60); })(); });
  const HERE = (() => { try { const t = document.title.split('·').map(s => s.trim()); return { name: t.find(p => /atlas/i.test(p)) || '', build: (/\bBuild\s+(\d+(?:\.\d+)*)/i.exec(document.title) || [])[1] || '', sha256: embedded.atlas.sha256 || '' }; } catch (e) { return { name: '', build: '', sha256: '' }; } })();
  /* a hand-off made for another build of the dashboard still opens; the person is told */
  const forThis = b => { const a = obj(b.atlas); if (a.sha256 && HERE.sha256) return a.sha256 === HERE.sha256; return !a.build || !HERE.build || String(a.build) === String(HERE.build); };
  const SEVC = { error: 'var(--critical)', block: 'var(--critical)', warn: 'var(--warning)', note: 'var(--ink-3)' };
  const pill = (text, cls, title) => `<span class="pill ${cls || ''}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
  const mountOf = key => { const m = MODI[key]; if (!m) return null; if (!m.mounted) { m.mounted = true; m.mount($('#mod-' + key)); } return m; };
  const TOASTED = () => $('.toast');
  const fileOf = (name, value) => { const dt = new DataTransfer(); dt.items.add(new File([JSON.stringify(value)], name, { type: 'application/json' })); return dt.files; };
  const pathOf = u => { try { return u ? new URL(u).pathname : ''; } catch (e) { return String(u || ''); } };
  const samePlan = (a, b) => { const strip = p => { const o = Object.assign({}, p); delete o.handoff; return JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]])); }; return strip(a) === strip(b); };

  /* ---------- what the dashboard holds now ---------- */
  /* How a plan differs from what the Campaign Desk holds, key for key: [] when the desk holds it. `now` is the desk's own
     plan(), which lists the ZIPs it buys, or the plan it keeps in this browser, which names its picks. */
  function planDiffs(plan, now) {
    const diffs = [], same = (a, b) => JSON.stringify(a) === JSON.stringify(b), tot = o => sum(Object.values(obj(o))) || 1, short = v => String(typeof v === 'object' ? JSON.stringify(v) : v).slice(0, 80);
    const want = (k, label) => { if (plan[k] != null && !same(plan[k], now[k])) diffs.push(`${label}: the plan says ${short(plan[k])}, the desk holds ${short(now[k])}`); };
    want('line', 'service line'); want('budget', 'monthly budget'); want('start', 'start date'); want('weeks', 'weeks'); want('bookRate', 'lead to booked rate'); want('jobVal', 'value of a booked job');
    const zips = Array.isArray(now.zips) ? now.zips : now.scope === 'picks' ? arr(now.picks) : null;
    if (arr(plan.picks).length && (plan.scope == null || plan.scope === 'picks')) { if (!zips) diffs.push(`markets: the plan names ${plural(plan.picks.length, 'ZIP')}, the desk buys ${now.scope === 'county' ? 'by county' : 'its own top markets'}`); else if (!same(plan.picks.map(String).sort(), zips.map(String).sort())) diffs.push(`markets: the plan names ${plural(plan.picks.length, 'ZIP')}, the desk holds ${N(zips.length)}`); }
    if (Array.isArray(plan.angles) && !same(plan.angles.slice().sort(), arr(now.angles).slice().sort())) diffs.push(`angles: the plan runs ${plan.angles.join(', ')}, the desk runs ${arr(now.angles).join(', ')}`);
    if (plan.mix && typeof plan.mix === 'object') { const a = tot(plan.mix), b = tot(now.mix), off = Object.keys(plan.mix).filter(k => Math.abs((+plan.mix[k] || 0) / a - (+obj(now.mix)[k] || 0) / b) > 0.005); if (off.length) diffs.push(`platform mix differs on ${off.join(', ')}`); }
    if (plan.bids && typeof plan.bids === 'object' && arr(plan.picks).length) { const off = plan.picks.filter(z => plan.bids[z] != null && (!now.bids || +now.bids[z] !== +plan.bids[z])); if (off.length) diffs.push(`bid adjustments differ for ${plural(off.length, 'ZIP')}`); }
    return diffs;
  }
  /* the plan the desk holds, without opening the desk: its own plan() when it is open, else the plan it keeps in this browser */
  const deskState = () => { try { const m = MODI.desk; if (m && m.mounted && typeof m.plan === 'function') return obj(m.plan()); } catch (e) { /* read what it keeps instead */ } const p = store.get('tda.desk.v1', null); return p && typeof p === 'object' && !Array.isArray(p) && typeof p.line === 'string' ? p : null; };
  /* true, false, or null when what the desk holds cannot be read */
  const deskHolds = plan => { const now = deskState(); return now ? planDiffs(plan, now).length === 0 : null; };
  /* Publish keeps pages only while the dashboard is open: it holds these pages when it is open and lists every one */
  const publishHolds = pages => { try { const m = MODI.publish; if (!pages.length || !m || !m.mounted || typeof m.pages !== 'function') return false; const have = new Set(arr(m.pages()).map(p => p && p.slug)); return pages.every(p => have.has(p.page.slug)); } catch (e) { return false; } };

  /* ---------- the Campaign Desk's door ---------- */
  /* The plan goes in the way a person would put it in: through the desk's own Load button, with the plan as the chosen
     file, so the desk cleans and checks it with its own code. Where a build has no Load button the plan goes through the
     desk's receive(), the door other modules use, which carries the markets, bids, line, dates, budget, mix and angles
     and leaves the rest as the desk has it. Either way the desk is read back and compared with the plan, key for key. */
  async function deskApply(plan) {
    let m; try { m = mountOf('desk'); } catch (e) { return { ok: false, why: 'The Campaign Desk failed to open: ' + (e && e.message || e) }; }
    if (!m || typeof m.plan !== 'function') return { ok: false, why: 'This build has no Campaign Desk that can be read back.' };
    const root = $('#mod-desk'), btn = $('#dkLoad', root), T = TOASTED(); let how = '', said = '';
    if (btn) {
      const proto = HTMLInputElement.prototype, own = Object.prototype.hasOwnProperty.call(proto, 'click'), orig = proto.click; let took = false;
      if (T) T.textContent = '';
      /* the desk's Load makes its own file input and clicks it: for that one click the plan is the file it finds chosen */
      proto.click = function () {
        if (this.type === 'file' && !took) { try { this.files = fileOf('campaign-desk-plan.json', plan); took = true; this.dispatchEvent(new Event('change')); } catch (e) { took = false; } return; }
        return orig.apply(this, arguments);
      };
      try { btn.click(); } finally { if (own) proto.click = orig; else delete proto.click; }
      if (took) { await wait(() => T && /Plan loaded|not a desk plan/i.test(T.textContent || ''), 4000); said = T ? (T.textContent || '').trim() : ''; if (/Plan loaded/i.test(said)) how = 'load'; }
    }
    if (!how && !said && typeof m.receive === 'function') {
      m.receive({ zips: arr(plan.picks), bids: plan.bids || null, line: plan.line, budget: plan.budget, start: plan.start, weeks: plan.weeks, mix: plan.mix, angles: plan.angles, note: 'From the Agent Desk' }); how = 'receive';
    }
    if (!how) return { ok: false, why: said ? `The Campaign Desk answered: "${said}".` : 'The Campaign Desk has no way in that this panel knows.' };
    const now = obj(m.plan()), diffs = planDiffs(plan, now);
    const kpis = {}; $$('#dkKpis .kpi', root).forEach(k => { const l = $('.kl span', k), v = $('.kv', k); if (l && v) kpis[l.textContent.trim()] = v.textContent.trim(); });
    return { ok: diffs.length === 0, how, diffs, kpis, held: { line: now.line, budget: now.budget, start: now.start, weeks: now.weeks, markets: arr(now.zips).length } };
  }
  /* what the desk holds before a plan replaces it */
  const deskNow = () => { try { const m = mountOf('desk'); return m && typeof m.plan === 'function' ? obj(m.plan()) : null; } catch (e) { return null; } };
  /* the desk's own Save, so the person can keep what is there */
  const deskKeep = () => { const b = $('#dkSave', $('#mod-desk')); if (b) { b.click(); return; } const p = deskNow(); if (p) { delete p.zips; saveFile('campaign-desk-plan.json', JSON.stringify(p, null, 1)); } };

  /* ---------- the Publish door ---------- */
  /* Blueprints go in as one file on Publish's own import box, so its own compiler builds each page and its own checks
     run. What Publish then lists is read back. */
  const publishHas = () => { try { const m = mountOf('publish'); return m && typeof m.pages === 'function' ? arr(m.pages()).map(p => p && p.slug).filter(Boolean) : []; } catch (e) { return []; } };
  async function publishSend(blueprints) {
    let m; try { m = mountOf('publish'); } catch (e) { return { ok: false, why: 'Publish failed to open: ' + (e && e.message || e) }; }
    const root = $('#mod-publish'), input = m && $('#p16iFile', root), log = m && $('#p16iLog', root), T = TOASTED();
    if (!input) return { ok: false, why: 'This build has no Publish import box.' };
    const prev = log ? log.textContent : ''; if (T) T.textContent = '';
    try { input.files = fileOf('pages-from-the-agent-desk.json', { pages: blueprints }); input.dispatchEvent(new Event('change', { bubbles: true })); }
    catch (e) { return { ok: false, why: 'This browser would not hand the pages to Publish: ' + (e && e.message || e) }; }
    await wait(() => (log && log.textContent !== prev) || (T && /imported/i.test(T.textContent || '')), 8000);
    const first = ((log && log.textContent) || '').split('\n')[0] || '', took = /:\s*\d+ pages? \(/.test(first), slugs = new Set(blueprints.map(b => b.page.slug));
    const listed = (typeof m.pages === 'function' ? arr(m.pages()) : $$('#p16Pages tr[data-slug]', root).map(tr => ({ slug: tr.dataset.slug }))).filter(p => p && slugs.has(p.slug)).map(p => ({ slug: p.slug, title: p.title || p.h1 || '', words: isN(p.words) ? +p.words : null, block: p.checks ? +p.checks.block || 0 : null, warn: p.checks ? +p.checks.warn || 0 : null }));
    const verdict = first.replace(/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\s*/i, '');
    return { ok: took && listed.length === slugs.size, verdict, why: took && listed.length !== slugs.size ? `Publish lists ${N(listed.length)} of the ${N(slugs.size)} pages.` : took ? '' : (verdict || 'Publish gave no answer.'), listed };
  }

  /* ---------- this dashboard's own screen of an ad's copy ---------- */
  const screen = (texts, platform, lic, search) => {
    if (typeof satchelLint !== 'function' || !texts.length) return null;
    try {
      const L = (t, extra) => satchelLint(t, Object.assign({ lic }, extra || {})), out = L(texts.join(' \n '), { needLic: true, platform }).map(x => ({ id: x.rule.id, name: x.rule.name, sev: x.rule.sev, ev: x.ev }));
      if (search) texts.forEach(t => L(t, { headline: true }).forEach(x => { if (x.rule.id === 'GGL1') out.push({ id: 'GGL1', name: x.rule.name, sev: x.rule.sev, ev: `${x.ev} in "${t}"` }); }));
      return out;
    } catch (e) { return null; }
  };
  const flags = list => (list == null ? '' : list.length ? list.map(f => `<span class="pill" style="border-color:${SEVC[f.sev] || 'var(--line-strong)'};color:${SEVC[f.sev] || 'var(--ink-2)'}" title="${esc(f.name + ': ' + f.ev)}">${esc(f.id)}</span>`).join(' ') : pill('clean by this dashboard\'s rules', 'st-connected'));

  /* ---------- opening hand-offs by hand ---------- */
  /* What a set of files holds: the hand-off file an agent writes (handoff.json), or the two older files on their own, a
     Campaign Desk plan and a pages file for Publish. A plan or a page that a hand-off in the same set already carries is
     not listed twice. files: [{name, dir, text}] -> {found: [bundle], skipped: [text]} */
  function bundlesFrom(files) {
    const whole = [], plans = [], pages = [], skipped = []; let agent = '', atlas = null, made = '';
    for (const f of files) {
      if (!/\.json$/i.test(f.name)) { skipped.push(`${f.name}: not a .json file`); continue; }
      if (f.text == null) { skipped.push(`${f.name}: could not be read`); continue; }
      let o; try { o = JSON.parse(String(f.text).replace(/^﻿/, '')); } catch (e) { skipped.push(`${f.name}: not JSON`); continue; }
      if (isBundle(o)) { whole.push(o); continue; }
      if (o && o.format === FORMAT) { skipped.push(`${f.name}: a hand-off with no plan and no pages in it`); continue; }
      const note = obj(o && o.handoff);
      if (o && typeof o === 'object' && !Array.isArray(o) && typeof o.line === 'string' && ['budget', 'picks', 'start', 'weeks', 'mix'].some(k => k in o)) { const plan = Object.assign({}, o); delete plan.handoff; plans.push({ plan, note, dir: f.dir || '' }); continue; }
      const list = Array.isArray(o) ? o : o && Array.isArray(o.pages) ? o.pages : [o], got = list.filter(isBlueprint);
      if (got.length) { got.forEach(p => { if (!pages.some(x => x.page.slug === p.page.slug)) pages.push(p); }); if (note.agent) { agent = note.agent; atlas = note.atlas || atlas; made = note.made || made; } continue; }
      if (/handoff|plan|pages|blueprint/i.test(f.name)) skipped.push(`${f.name}: not a hand-off, a desk plan or a pages file`);
    }
    const found = whole.slice(), now = new Date().toISOString();
    for (const p of plans) { if (whole.some(w => w.paid && samePlan(w.paid.plan, p.plan))) continue; found.push({ format: FORMAT, v: VERSION, id: `paid:${p.dir || 'plan'}:${p.plan.line}:${p.plan.start || ''}`, agent: p.note.agent || 'paid-ads-specialist', made: p.note.made || now, atlas: p.note.atlas || null, title: p.note.campaign || `A ${p.plan.line} plan${p.plan.start ? ' from ' + p.plan.start : ''}`, bare: true, paid: { plan: p.plan } }); }
    const fresh = pages.filter(p => !whole.some(w => w.content && arr(w.content.pages).some(x => isBlueprint(x) && x.page.slug === p.page.slug)));
    if (fresh.length) found.push({ format: FORMAT, v: VERSION, id: 'content:' + fresh.map(p => p.page.slug).sort().join('+').slice(0, 80), agent: agent || 'content-strategist', made: made || now, atlas, title: fresh.length === 1 ? (fresh[0].page.h1 || fresh[0].page.title || fresh[0].page.slug) : `${fresh.length} pages`, bare: true, content: { pages: fresh } });
    return { found, skipped };
  }
  /* the files a person chose or dropped, as text; from a folder only the files a hand-off could be in */
  const WANTED = /^(?:.*[.-])?handoff\.json$|^campaign-desk-plan.*\.json$|^pages.*\.json$|^blueprint\.json$/i;
  const asText = (f, dir) => (f.size > 30e6 ? Promise.resolve(null) : f.text().catch(() => null)).then(text => ({ name: f.name, dir, text }));
  const dirOf = f => { const p = String(f.webkitRelativePath || '').split('/'); return p.length > 1 ? p[p.length - 2] : ''; };
  const readList = (list, folder) => Promise.all([...list].filter(f => !folder || WANTED.test(f.name)).slice(0, 80).map(f => asText(f, dirOf(f))));
  /* a drop can be files or a folder: the entries are taken while the drop is still live, and a folder is walked for the
     files a hand-off could be in */
  function readDrop(dt) {
    const entries = [...(dt.items || [])].map(i => (i && typeof i.webkitGetAsEntry === 'function' ? i.webkitGetAsEntry() : null)).filter(Boolean);
    if (!entries.some(e => e.isDirectory)) return readList(dt.files || [], false);
    const out = [], fileFrom = e => new Promise((ok, no) => e.file(ok, no)), batch = r => new Promise((ok, no) => r.readEntries(ok, no));
    const walk = async (e, dir, depth) => {
      if (out.length >= 80 || depth > 4) return;
      if (e.isFile) { if (depth === 0 || WANTED.test(e.name)) out.push(await asText(await fileFrom(e), dir)); return; }
      if (!e.isDirectory) return; const r = e.createReader();
      for (;;) { const got = await batch(r); if (!got.length) break; for (const x of got) await walk(x, e.name, depth + 1); }
    };
    return entries.reduce((p, e) => p.then(() => walk(e, '', 0)), Promise.resolve()).then(() => out);
  }

  /* ---------- the module ---------- */
  registerModule({
    key: KEY, num: NUM, title: 'Agent Desk', desc: 'Work from the paid ads specialist and the content strategist: read it, check it, send it to the Campaign Desk and Publish',
    mount(root) {
      const self = this; let confirmFor = '', busy = false, lastLog = [];
      const tabOf = b => S.tab[b.id] || (b.paid ? 'plan' : 'pages');
      const appliedOf = b => { const a = S.applied[b.id]; return a && typeof a === 'object' ? a : null; };
      const record = (b, r) => { delete S.applied[b.id]; S.applied[b.id] = Object.assign({ at: new Date().toISOString(), made: b.made }, r); save(); };
      /* Where a hand-off stands, read from the dashboard as it is now and not from what this panel remembers doing:
         held    the Campaign Desk holds this plan, or Publish lists these pages
         moved   the desk took this plan and holds something else now
         gone    the pages were sent, and Publish, which keeps pages only while the dashboard is open, no longer has them
         was     the desk took the plan and what it holds now cannot be read from here
         failed  it was tried and not taken as handed over
         new     nothing has been done with it */
      const standing = b => { const a = appliedOf(b); if (b.paid) { const h = deskHolds(obj(b.paid.plan)); return h === true ? 'held' : a && a.ok ? (h === false ? 'moved' : 'was') : a ? 'failed' : 'new'; } return publishHolds(arr(obj(b.content).pages).filter(isBlueprint)) ? 'held' : a && a.ok ? 'gone' : a ? 'failed' : 'new'; };
      const statusPill = b => { const st = standing(b), a = appliedOf(b), at = a ? when(a.at) : ''; return st === 'held' ? pill(b.paid ? 'on the Campaign Desk' : 'in Publish', 'st-connected', at) : st === 'moved' ? pill('the desk has changed since', 'st-configured', `Loaded ${at}; the Campaign Desk holds a different plan now`) : st === 'gone' ? pill('sent before, not in Publish now', 'st-configured', `Sent ${at}; Publish keeps pages only while the dashboard is open`) : st === 'was' ? pill(`loaded ${at}`, '') : st === 'failed' ? pill('not taken as handed over', 'st-expired', at) : pill('new', 'st-configured'); };
      const openClaims = b => { const seen = new Set(); arr(obj(b.paid).claims).forEach(c => { if (c && (c.status === 'unconfirmed' || c.status === 'contradicts')) seen.add(c.type + '|' + String(c.said).toLowerCase()); }); return seen.size; };
      const head = b => `<div class="card-h"><h3>${esc(b.title || (b.paid ? 'A campaign' : 'Pages'))}</h3><p>${esc(AGENT[b.agent] || b.agent || 'An agent')} · handed over ${esc(when(b.made))}${obj(b.atlas).build ? ` · made for Build ${esc(b.atlas.build)}` : ''}${b.origin === 'opened' ? ' · opened here by hand <button type="button" class="lnk" id="lvpForget" data-fk="forget">Forget it</button>' : ''}</p></div>`;
      const otherBuild = b => { if (forThis(b)) return ''; const theirs = obj(b.atlas).build, same = !!theirs && !!HERE.build && String(theirs) === String(HERE.build); return callout('judg tight', 'Made for another dashboard file', `This hand-off was made for ${same ? `another file of Build ${esc(theirs)}` : theirs ? 'Build ' + esc(theirs) : 'another file'}${!same && HERE.build ? ` and this is Build ${esc(HERE.build)}` : ''}. It still opens here: read the Campaign Desk's and Publish's own figures after it goes in.`); };

      /* ----- the inbox ----- */
      const inbox = list => `<div class="card lvp-inbox"><div class="card-h"><h3>Hand-offs</h3><p>${list.length ? 'Newest first. Choose one to read it and put it to work.' : 'Nothing has been handed over yet.'}</p></div><div class="card-b">${list.map(b => `<button type="button" class="lvp-item" data-id="${esc(b.id)}" data-fk="item:${esc(b.id)}" aria-pressed="${String(b.id === S.sel)}"><span class="lvp-who">${esc(AGENT[b.agent] || b.agent || 'An agent')}</span><span class="lvp-t">${esc(b.title || b.id)}</span><span class="lvp-m">${esc(when(b.made))}${forThis(b) ? '' : ' · another dashboard file'}</span><span class="lvp-s">${statusPill(b)}${b.origin === 'opened' ? ' ' + pill('opened here') : ''}</span></button>`).join('')}
        <div class="drop" id="lvpDrop" tabindex="0" role="button">Drop a hand-off or its folder here, or click to choose a file</div><input type="file" id="lvpFile" accept=".json,application/json" multiple hidden><input type="file" id="lvpDir" webkitdirectory multiple hidden>
        <p class="mini lvp-hint">An agent writes <span class="mono">handoff.json</span> into every folder it builds. <button type="button" class="lnk" id="lvpFolder" data-fk="folder">Choose a folder</button></p>
        ${stored ? '' : '<p class="mini lvp-hint">This browser\'s storage is full or closed, so a hand-off opened here by hand lasts until the page is closed.</p>'}
        <div class="status" id="lvpLog"${lastLog.length ? '' : ' hidden'}>${esc(lastLog.join('\n'))}</div></div></div>`;

      /* ----- a paid ads hand-off ----- */
      function paidView(b) {
        const P = obj(b.paid), plan = obj(P.plan), s = obj(P.summary), T = obj(s.totals), a = appliedOf(b), tab = tabOf(b), open = openClaims(b), val = k => (s[k] != null ? s[k] : plan[k]);
        const tabs = [['plan', 'Plan'], ['copy', 'Ad copy'], ['claims', 'Claims'], ['launch', 'Before launch'], ['files', 'Files']].filter(([k]) => k === 'plan' || (k === 'copy' ? arr(P.search).length || arr(P.ads).length : k === 'claims' ? Array.isArray(P.claims) : k === 'launch' ? Array.isArray(P.findings) || arr(P.before).length : arr(P.files).length));
        const cur = tabs.some(([k]) => k === tab) ? tab : 'plan', k = [];
        k.push({ l: 'Monthly media', v: $money(val('budget')), d: `${esc(s.lineLabel || val('line') || '')}${isN(val('weeks')) ? `; ${N(val('weeks'))} weeks` : ''}${val('start') ? ` from ${esc(val('start'))}` : ''}` });
        k.push({ l: 'Markets', v: isN(s.markets) ? N(s.markets) : arr(plan.picks).length ? N(plan.picks.length) : '—', d: isN(s.households) ? `${N(s.households)} households` : 'ZIP codes named in the plan' });
        if (isN(T.leads)) k.push({ l: 'Leads a month', v: N(T.leads), d: 'as the specialist reckoned it' }, { l: 'Booked jobs', v: N(T.booked), d: isN(val('bookRate')) ? `at ${N(val('bookRate'))}% lead to booked` : '' }, { l: 'Cost a booked job', v: $money(T.costPerBooked), d: isN(T.target) ? `target ${$money(T.target)}` : '' });
        if (isN(s.extraTotal) && s.extraTotal > 0) k.push({ l: 'Outside the desk', v: $money(s.extraTotal), d: 'a month, on top of the plan and not in its forecast' });
        if (Array.isArray(P.claims)) k.push({ l: 'Claims waiting', v: N(open), d: open ? 'need the owner\'s word' : 'none needs the owner\'s word' });
        const st = standing(b), K = obj(a && a.ok ? a.kpis : null), H = obj(a && a.held), agree = isN(T.leads) && K['Leads a month'] === N(T.leads) && K['Booked jobs'] === N(T.booked), mk = isN(s.markets) ? +s.markets : arr(plan.picks).length;
        const copyNote = ' The desk writes ad copy of its own from its library, so the specialist\'s copy is under Ad copy here and in the files.';
        const fc = K['Leads a month'] ? ` Its own forecast when it loaded: <b>${esc(K['Leads a month'])}</b> leads and <b>${esc(K['Booked jobs'] || '—')}</b> booked jobs a month${isN(T.leads) ? (agree ? ', the same as the specialist reckoned.' : `. The specialist reckoned ${N(T.leads)} and ${N(T.booked)}: quote the desk's figures.`) : '.'}` : '';
        const result = st === 'held' ? callout('lvp-ok', 'On the Campaign Desk', `${a && a.ok ? `The desk took this plan ${esc(when(a.at))} and holds it now` : 'The desk holds this plan now'}: <b>${esc(s.lineLabel || val('line') || '')}</b>, ${$money(val('budget'))} a month${isN(val('weeks')) ? `, ${N(val('weeks'))} weeks` : ''}${val('start') ? ` from ${esc(val('start'))}` : ''}${mk ? `, ${plural(mk, 'market')}` : ''}.${fc}${a && a.how === 'receive' ? ' It went in through the desk\'s hand-off door, which carries the markets, bids, line, dates, budget, mix and angles and nothing else.' : ''}${copyNote}`)
          : st === 'moved' ? callout('judg', 'The Campaign Desk has changed since', `The desk took this plan ${esc(when(a.at))}. It holds something else now:<ul class="lvp-ul">${planDiffs(plan, deskState() || {}).slice(0, 8).map(d => `<li>${esc(d)}</li>`).join('')}</ul>Load it again to put this plan back.`)
          : st === 'was' ? callout('note', 'Loaded on the Campaign Desk', `The desk took this plan ${esc(when(a.at))}.${fc} What it holds now cannot be read from here: open the Campaign Desk to see.${copyNote}`)
          : st === 'failed' ? callout('', 'The desk does not hold this plan as handed over', `${a.why ? esc(a.why) : 'The plan went in, and the desk reads it differently:'}${arr(a.diffs).length ? '<ul class="lvp-ul">' + arr(a.diffs).map(d => `<li>${esc(d)}</li>`).join('') + '</ul>' : ''}`) : '';
        const now = confirmFor === b.id ? deskNow() : null;
        const ask = confirmFor !== b.id ? '' : callout('note', 'This replaces the plan on the Campaign Desk', `${now ? `The desk holds now: <b>${esc(String(now.line || ''))}</b>, ${$money(now.budget)} a month, ${N(now.weeks)} weeks from ${esc(String(now.start || ''))}, ${plural(arr(now.zips).length, 'market')}. ` : ''}Loading this plan puts it in that one's place. <div class="lvp-row"><button type="button" class="btn" id="lvpGo" data-fk="go">Replace it with this plan</button><button type="button" class="btn sec" id="lvpKeep" data-fk="keep">↓ Save the desk's plan first</button><button type="button" class="btn ghost" id="lvpNo" data-fk="no">Cancel</button></div>`);
        return `<div class="card">${head(b)}<div class="card-b">${otherBuild(b)}
          <div class="kpis lvp-kpis">${kpiHTML(k)}</div>
          <div class="lvp-row"><button type="button" class="btn" id="lvpApply" data-fk="apply"${busy ? ' disabled' : ''}>${busy ? 'Loading…' : st === 'held' ? 'Load it on the Campaign Desk again' : 'Load this plan on the Campaign Desk'}</button>${MODI.desk ? '<button type="button" class="btn sec" data-go="desk">Open the Campaign Desk</button>' : ''}<span class="mini">A plan is a plan: nothing is bought, and every campaign in the files is paused.</span></div>
          ${ask}${result}
          <div class="seg lvp-tabs" id="lvpTabs">${tabs.map(([key, label]) => `<button type="button" data-v="${key}" data-fk="tab:${key}" aria-pressed="${String(key === cur)}">${label}${key === 'claims' && open ? ` (${N(open)})` : ''}</button>`).join('')}</div>
          <div id="lvpTab">${({ plan: paidPlan, copy: paidCopy, claims: paidClaims, launch: paidLaunch, files: paidFiles })[cur](b)}</div></div></div>`;
      }
      function paidPlan(b) {
        const P = obj(b.paid), plan = obj(P.plan), s = obj(P.summary), rows = [], val = k => (s[k] != null ? s[k] : plan[k]);
        rows.push(['Service line', esc(s.lineLabel || val('line') || '')], ['Flight', `${isN(val('weeks')) ? N(val('weeks')) + ' weeks ' : ''}from ${esc(val('start') || 'the desk\'s own start')}${s.end ? ' to ' + esc(s.end) : ''}`], ['Budget', `${$money(val('budget'))} a month${isN(val('budget')) ? `, ${$money(val('budget') / 30.4)} a day flat` : ''}`]);
        if (isN(val('jobVal'))) rows.push(['A booked job', `${$money(val('jobVal'))}${isN(val('bookRate')) ? `, with ${N(val('bookRate'))}% of leads booked` : ''}`]);
        if (arr(val('angles')).length) rows.push(['Angles', esc(arr(val('angles')).join(', '))]);
        if (s.pacedBy) rows.push(['Flight paced by', esc(s.pacedBy)]);
        if (s.deskModel) rows.push(['Forecast model', esc(s.deskModel)]);
        const mix = arr(s.mix).length ? `<div class="xscroll"><table><thead><tr><th class="l">Platform</th><th>Share</th><th>A month</th><th>Clicks</th><th>Leads</th><th>Booked</th><th class="l">Assumes</th></tr></thead><tbody>${s.mix.map(m => `<tr><td class="l lvp-w">${esc(m.label)}</td><td>${N(m.share)}%</td><td>${$money(m.spend)}</td><td>${N(m.clicks)}</td><td>${N(m.leads)}</td><td>${D(m.booked, 1)}</td><td class="l lvp-w">${esc(m.basis || '')} ${$money(m.cost)}${m.grade ? `, grade ${esc(m.grade)}` : ''}</td></tr>`).join('')}</tbody></table></div>` : plan.mix && typeof plan.mix === 'object' ? `<div class="mini">Mix: ${esc(Object.entries(plan.mix).filter(([, v]) => +v > 0).map(([k2, v]) => `${k2} ${N(v)}%`).join(', '))}</div>` : '';
        const fl = arr(s.flight).filter(f => !f.stub), flight = fl.length > 1 ? `<p class="mini lvp-hint">The season would have the daily budget run ${fl.map(f => `${esc(f.month)} ${$money(f.daily)}`).join(', ')}. The files carry the flat figure.</p>` : '';
        const h = s.heat && typeof s.heat === 'object' ? s.heat : null, heat = h ? callout('note tight', 'The Heat Desk', `The Heat Desk reckoned its plan for ${esc(String(h.month || ''))} (${N(h.zips)} ZIPs, ${$money(h.spent)}) at ${N(h.leads)} leads and ${N(h.jobs)} booked jobs, ${$money(h.costPerJob)} a job${h.grade ? ` (grade ${esc(String(h.grade))})` : ''}. It weighs drive time, cold and competition by ZIP, which the Campaign Desk does not.${h.same === false ? ' This campaign changed that plan, so the figure is a reference.' : ''}${MODI.heat ? ' <button type="button" class="lnk" data-go="heat">Open the Heat Desk</button>' : ''}`) : '';
        const mk = arr(P.markets).length ? `<div class="xscroll lvp-tall"><table><thead><tr><th class="l">ZIP</th><th class="l">City</th><th class="l">County</th><th>Minutes</th><th>Bid</th><th>Desk $ a month</th><th class="l">Spanish</th><th class="l">Angles with demand</th></tr></thead><tbody>${P.markets.map(m => `<tr><td class="l mono">${esc(m.zip)}</td><td class="l">${esc(m.city)}</td><td class="l">${esc(m.county)}</td><td>${isN(m.minutes) ? N(m.minutes) : ''}</td><td>${isN(m.bid) ? (m.bid > 0 ? '+' : m.bid < 0 ? '−' : '') + N(Math.abs(m.bid)) + '%' : ''}</td><td>${$money(m.spend)}</td><td class="l">${m.es ? 'yes' : ''}</td><td class="l lvp-w">${esc(arr(m.angles).join(', '))}</td></tr>`).join('')}</tbody></table></div><p class="mini lvp-hint">Minutes are from the shop by the Heat Desk's rule of thumb. Dollars by ZIP are the desk's own weighting, a planning view: a search campaign has one budget and the bid adjustments steer it.</p>` : arr(plan.picks).length ? `<p class="mini lvp-hint">Markets: <span class="mono">${esc(plan.picks.join(' '))}</span></p>` : '';
        const extra = arr(s.extra).length ? callout('note tight', 'Outside the Campaign Desk', `${s.extra.map(e => `${esc(e.name)} ${$money(e.monthly)} a month`).join(', ')}. This money is on top of the plan and outside its forecast.`) : '';
        return `<div class="lvp-two lvp-plan"><div>${rows.map(([l, v]) => `<div class="rowl"><span>${l}</span><b>${v}</b></div>`).join('')}</div><div>${mix}${flight}</div></div>${heat}${extra}${mk}`;
      }
      function paidCopy(b) {
        const P = obj(b.paid), lic = obj(P.plan).lic || '', out = [];
        const line = (t, max, pin) => `<div class="lvp-line"><span>${esc(t)}</span><span class="mini${max && len(t) > max ? ' lvp-over' : ''}">${pin ? `pinned ${pin} · ` : ''}${len(t)}${max ? '/' + max : ''}</span></div>`;
        for (const c of arr(P.search)) {
          out.push(`<h4 class="lvp-h">Search · ${c.lang === 'es' ? 'Spanish' : 'English'}${c.bidding ? ` · ${esc(c.bidding)}` : ''}</h4>`);
          const sn = c.snippets && typeof c.snippets === 'object' ? c.snippets : null;
          const assets = [arr(c.callouts).length ? `<b>Callouts</b> ${c.callouts.map(x => `<span class="tag">${esc(txt(x))}</span>`).join('')}` : '', arr(c.sitelinks).length ? `<b>Sitelinks</b> ${c.sitelinks.map(x => `<span class="tag" title="${esc([x.d1, x.d2, x.path].filter(Boolean).join(' · '))}">${esc(x.text)}</span>`).join('')}` : '', sn ? `<b>${esc(sn.header || 'Snippets')}</b> ${arr(sn.values).map(x => `<span class="tag">${esc(x)}</span>`).join('')}` : '', arr(c.negatives).length ? `<b>${plural(c.negatives.length, 'negative')}</b> <span class="mini">${esc(c.negatives.slice(0, 14).join(', '))}${c.negatives.length > 14 ? ', …' : ''}</span>` : ''].filter(Boolean);
          if (assets.length) out.push(`<div class="lvp-assets">${assets.map(x => `<div>${x}</div>`).join('')}</div>`);
          for (const g of arr(c.adGroups)) {
            const ad = obj(g.ad), H = arr(ad.headlines), D2 = arr(ad.descriptions), texts = H.concat(D2).map(txt).filter(Boolean);
            out.push(`<details class="lvp-ad"><summary><b>${esc(g.name || '')}</b> <span class="mini">${plural(arr(g.keywords).length, 'keyword')} · ${plural(H.length, 'headline')} · ${plural(D2.length, 'description')}${isN(g.bid) ? ` · bids ${N(g.bid * 100)}% of the campaign` : ''}</span> ${flags(screen(texts, 'google', lic, true))}</summary>
              <div class="lvp-two"><div><div class="fl">Headlines</div>${H.map(h => line(txt(h), 30, pinOf(h))).join('')}</div>
              <div><div class="fl">Descriptions</div>${D2.map(d => line(txt(d), 90, pinOf(d))).join('')}
              <div class="fl lvp-gap">Lands on</div><div class="mono lvp-url">${esc(ad.url || '')}</div><div class="fl lvp-gap">Keywords</div><div class="mini">${arr(g.keywords).map(k2 => `${esc(k2.text)} <span class="lvp-dim">[${esc(k2.match)}]</span>`).join(' · ')}</div></div></div></details>`);
          }
        }
        const ads = arr(P.ads), META = ['channel', 'format', 'angle', 'lang', 'name', 'url', 'cta', 'seconds', 'jobTypes'], CH = obj(P.channels);
        if (ads.length) out.push('<h4 class="lvp-h">Other channels</h4>');
        for (const a of ads) {
          const fields = Object.entries(obj(a)).filter(([k2]) => !META.includes(k2)).map(([k2, v]) => [k2, (Array.isArray(v) ? v : [v]).map(txt).filter(Boolean)]).filter(([, v]) => v.length), texts = fields.flatMap(([, v]) => v);
          out.push(`<details class="lvp-ad"><summary><b>${esc(CH[a.channel] || a.channel || '')}</b> ${esc(a.name || a.angle || '')} <span class="mini">${esc(a.format || '')}${a.lang === 'es' ? ' · Spanish' : ''}${a.cta ? ` · button "${esc(a.cta)}"` : ''}</span> ${a.angle === 'recruit' ? '' : flags(screen(texts, a.channel === 'meta' ? 'meta' : String(a.channel || ''), lic, false))}</summary>${fields.map(([k2, v]) => `<div class="fl lvp-gap">${esc(k2)}</div>${v.map(t => line(t, 0, 0)).join('')}`).join('')}${a.url ? `<div class="fl lvp-gap">Lands on</div><div class="mono lvp-url">${esc(a.url)}</div>` : ''}${arr(a.jobTypes).length ? `<div class="fl lvp-gap">Job types</div><div class="mini">${esc(a.jobTypes.join(', '))}</div>` : ''}</details>`);
        }
        return (typeof satchelLint === 'function' && out.length ? '<p class="mini lvp-lead">Each ad is screened here, as you read it, by this dashboard\'s own advertising rules: the ones the Emergency Satchel runs. Hover a flag for what it found. The specialist\'s own gate checks more (limits, claims, a call to action); what it left in is under Before launch.</p>' : '') + (out.join('') || '<p class="mini">This hand-off carries a plan and no copy.</p>');
      }
      const LABEL = { price: 'A price or discount', free: 'A "free" offer', guarantee: 'A guarantee', hours: 'Availability', response: 'A promise of when', scarcity: 'A limit or a deadline', reviews: 'A rating or review count', superlative: 'A superlative or comparison', years: 'The company\'s history', credential: 'A credential', financing: 'Financing', credit: 'A credit term' };
      /* claims by what was said: one answer for a claim, however many ads carry it */
      const claimsOf = b => { const by = new Map(); for (const c of arr(obj(b.paid).claims)) { if (!c || typeof c.said !== 'string') continue; const k = c.type + '|' + c.said.toLowerCase(); let x = by.get(k); if (!x) by.set(k, x = { key: k, type: c.type, said: c.said, status: c.status, detail: c.detail || '', where: [], lines: [] }); if (c.where && !x.where.includes(c.where)) x.where.push(c.where); if (c.in && !x.lines.includes(c.in) && x.lines.length < 2) x.lines.push(c.in); if (c.status === 'contradicts' || (c.status === 'unconfirmed' && x.status !== 'contradicts')) { x.status = c.status; x.detail = c.detail || x.detail; } } return [...by.values()]; };
      function paidClaims(b) {
        const list = claimsOf(b), open = list.filter(c => c.status === 'unconfirmed'), against = list.filter(c => c.status === 'contradicts'), settled = list.filter(c => c.status === 'on-file' || c.status === 'confirmed'), ans = obj(S.answers[b.id]);
        const row = c => { const a = obj(ans[c.key]), f = c.type === 'superlative' ? 'basis' : 'terms', need = c.type === 'superlative' ? 'What makes it true: an award, a ranking, a named survey with its date' : c.type === 'credit' ? 'The lender\'s disclosure wording' : 'In your words: the terms, the cutoff, the conditions';
          const must = (c.type === 'superlative' || c.type === 'credit') && a.decision === 'confirm' && !String(a[f] || '').trim();
          return `<div class="lvp-claim" data-k="${esc(c.key)}"><div class="lvp-said"><b>“${esc(c.said)}”</b> <span class="mini">${esc(LABEL[c.type] || c.type)} · in ${plural(c.where.length || 1, 'place')}</span>${c.lines.length ? `<div class="mini lvp-in">as in: ${c.lines.map(l => esc(l)).join(' · ')}</div>` : ''}<div class="mini">${esc(c.detail)}</div></div>
            <div class="seg lvp-dec"><button type="button" data-d="confirm" data-fk="dec:${esc(c.key)}:confirm" aria-pressed="${String(a.decision === 'confirm')}">I confirm it</button><button type="button" data-d="cut" data-fk="dec:${esc(c.key)}:cut" aria-pressed="${String(a.decision === 'cut')}">Cut it</button></div>
            ${a.decision === 'confirm' ? `<label class="fl lvp-ans">${esc(need)}<input type="text" data-f="${f}" value="${esc(a[f] || '')}">${must ? `<span class="mini lvp-must">Without this the specialist's gate will not take the confirmation.</span>` : ''}</label>` : ''}</div>`; };
        const done = Object.values(ans).filter(a => a && a.decision).length, confirms = Object.values(ans).some(a => a && a.decision === 'confirm'), ready = done > 0 && (!confirms || S.who.trim());
        return `${against.length ? callout('tight', 'The brand file says otherwise', `The specialist's gate stops a campaign that carries these, whatever anyone confirms: ${against.map(c => `“${esc(c.said)}” (${esc(c.detail)})`).join('; ')}. Correct the brand file if it is the one that is wrong.`) : ''}
          ${open.length ? `<p class="mini lvp-lead">The specialist would not vouch for these on its own, and asking for a line is not vouching for it. Confirm only what is true, in its own terms, and cut the rest. Your answers are saved as a file for the specialist, which then records each confirmation in the campaign and rewrites what you cut.</p>
            <label class="fl lvp-who2">Your name, as the one who confirms<input type="text" id="lvpWho" value="${esc(S.who)}" placeholder="First and last name"></label>${open.map(row).join('')}
            <div class="lvp-row"><button type="button" class="btn" id="lvpAns" data-fk="ans"${ready ? '' : ' disabled'}>↓ Save my answers</button><span class="mini" id="lvpAnsNote">${done ? plural(done, 'answer') + ' so far' + (confirms && !S.who.trim() ? '. Add your name to save them.' : '. Hand the file to the specialist.') : 'Answer at least one claim first.'}</span></div>` : '<p class="mini lvp-lead">No claim in this copy is waiting for the owner\'s word.</p>'}
          ${settled.length ? `<h4 class="lvp-h">Already answered</h4><div class="xscroll"><table class="prose"><thead><tr><th class="l">Said</th><th class="l">Kind</th><th class="l">Standing</th></tr></thead><tbody>${settled.map(c => `<tr><td>“${esc(c.said)}”</td><td>${esc(LABEL[c.type] || c.type)}</td><td>${c.status === 'confirmed' ? esc(c.detail || 'confirmed') : 'on file: ' + esc(c.detail)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
      }
      const md = t => esc(t).replace(/`([^`]+)`/g, '<span class="mono">$1</span>');
      function paidLaunch(b) {
        const P = obj(b.paid), F = arr(P.findings), groups = new Map(), ch = obj(P.checked), d = obj(ch.dashboard), sc = obj(d.screen), dk = obj(d.desk), lines = [];
        for (const f of F) { if (!f || f.severity === 'note') continue; const k = f.severity + '|' + f.rule + '|' + f.message; let x = groups.get(k); if (!x) groups.set(k, x = { f, where: [] }); x.where.push(f.where); }
        if (P.checked) {
          lines.push(d.ran ? `Checked against the running dashboard when it was built: ${d.screen ? (sc.error ? 'the rule screen could not be run' : `${plural(+sc.sets || 0, 'ad set')} screened by the dashboard's own rules${sc.agrees ? ', which flagged nothing more' : `, which flagged ${N(sc.extra)} more, listed below`}`) : 'no ad set to screen'}${d.desk ? (dk.error ? '; the plan could not be tried on the Campaign Desk' : dk.accepted ? `; the plan loaded through the Campaign Desk${dk.agrees ? ' and its forecast matched' : ' and its forecast differed'}` : '; the Campaign Desk refused the plan') : ''}.` : `Not checked against the running dashboard when it was built${d.why ? ': ' + esc(d.why) : ''}.`);
          lines.push(ch.landing ? `Landing pages were checked against the site's sitemap, read ${plural(+obj(ch.landing).ageHours || 0, 'hour')} before.` : 'Landing pages were not checked against the site: open each one before launch.');
        }
        if (arr(P.allowed).length) lines.push(`Rules set aside because someone asked: <b>${esc(P.allowed.join(', '))}</b>.`);
        const list = (title, items) => (arr(items).length ? `<h4 class="lvp-h">${title}</h4><ul class="lvp-ul lvp-check">${items.map(x => `<li>${md(String(x))}</li>`).join('')}</ul>` : '');
        return `${lines.length ? `<div class="mini lvp-lead">${lines.map(l => `<div>${l}</div>`).join('')}</div>` : ''}${list('Before anything is switched on', P.before)}
          ${Array.isArray(P.findings) ? `<h4 class="lvp-h">What the specialist's gate left in</h4>${groups.size ? `<div class="xscroll"><table class="prose lvp-find"><thead><tr><th class="l">Level</th><th class="l">Rule</th><th class="l">What it found</th><th class="l">Where</th></tr></thead><tbody>${[...groups.values()].map(({ f, where }) => `<tr><td><span style="color:${SEVC[f.severity] || 'var(--ink-2)'}">${f.severity === 'warn' ? 'warning' : esc(f.severity)}</span></td><td class="mono">${esc(f.rule)}</td><td>${esc(f.message)}${f.excerpt ? `<div class="mini">${esc(String(f.excerpt).slice(0, 220))}</div>` : ''}</td><td class="mini">${where.length === 1 ? esc(where[0]) : plural(where.length, 'place')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mini">No warning was left in.</p>'}<p class="mini lvp-hint">${plural(F.filter(x => x && x.severity === 'note').length, 'note')} beside these, in report.json under Files.</p>` : ''}
          ${list('Running it', P.running)}`;
      }
      function paidFiles(b) {
        const files = arr(obj(b.paid).files), have = files.some(f => f && f.text != null);
        return `<p class="mini lvp-lead">Everything the specialist built for this campaign. Every campaign and every ad in the files is paused; ad groups, keywords and assets inside them are enabled and serve nothing until a person switches the campaign on.${have ? '' : ' This hand-off was opened here earlier and the text of its files was not kept: open its <span class="mono">handoff.json</span> again to save them.'}</p><div class="lvp-row lvp-row0"><button type="button" class="btn sec" id="lvpZip" data-fk="zip"${have && typeof zipBlob === 'function' ? '' : ' disabled'}>↓ All of it as one .zip</button></div>
          <div class="xscroll"><table class="prose"><thead><tr><th class="l">File</th><th class="l">What it is for</th><th></th></tr></thead><tbody>${files.map((f, i) => `<tr><td class="mono">${esc(f.name)}</td><td>${esc(f.what || '')}</td><td class="lvp-r">${f.text != null ? `<button type="button" class="btn sm sec" data-file="${i}" data-fk="file:${i}">↓ Save</button>` : '<span class="mini">not kept here</span>'}</td></tr>`).join('')}</tbody></table></div>`;
      }

      /* ----- pages from the content strategist ----- */
      function contentView(b) {
        const C = obj(b.content), pages = arr(C.pages).filter(isBlueprint), info = Object.fromEntries(arr(C.info).filter(i => i && i.slug).map(i => [i.slug, i])), of = p => obj(info[p.page.slug]), a = appliedOf(b), words = sum(pages.map(p => of(p).words)), grades = pages.map(p => of(p).grade).filter(isN), d = obj(obj(C.checked).dashboard);
        const k = [{ l: 'Pages', v: N(pages.length), d: esc([...new Set(pages.map(p => of(p).type || p.page.archetype || 'page'))].join(', ')) }];
        if (words) k.push({ l: 'Words', v: N(words), d: 'across the set' });
        if (grades.length) k.push({ l: 'Reading grade', v: D(sum(grades) / grades.length, 1), d: 'the average; the strategist\'s gate holds every page to grade 9 or under' });
        const dup = confirmFor === b.id ? publishHas().filter(s => pages.some(p => p.page.slug === s)) : [];
        const ask = confirmFor !== b.id ? '' : callout('note', 'Publish already holds some of these', `${plural(dup.length, 'page')} with the same address ${dup.length === 1 ? 'is' : 'are'} in Publish now: ${dup.map(s => `<span class="mono">/${esc(s)}/</span>`).join(', ')}. Sending puts the strategist's version in ${dup.length === 1 ? 'its' : 'their'} place. <div class="lvp-row"><button type="button" class="btn" id="lvpGo" data-fk="go">Replace ${dup.length === 1 ? 'it' : 'them'}</button><button type="button" class="btn ghost" id="lvpNo" data-fk="no">Cancel</button></div>`);
        const st = standing(b), one = pages.length === 1;
        const result = st === 'held' ? callout('lvp-ok', 'In Publish', `Publish lists ${one ? 'this page' : `these ${N(pages.length)} pages`} now, each as a draft${a && a.ok ? `. It compiled them ${esc(when(a.at))}: ${arr(a.listed).map(p => `<span class="mono">/${esc(p.slug)}/</span>${p.block ? ` <span style="color:var(--critical)">${N(p.block)} blocked by Publish's checks</span>` : ''}${p.warn ? ` <span class="mini">${plural(+p.warn, 'note')} from Publish</span>` : ''}`).join(', ')}` : ''}. Nothing reaches a site until you choose a target there and send it. Publish keeps pages only while the dashboard is open, so send them again after the page is closed or reloaded.`)
          : st === 'gone' ? callout('note', 'Sent before, and not in Publish now', `Publish took ${one ? 'this page' : 'these pages'} ${esc(when(a.at))}. It keeps pages only while the dashboard is open, because pages hold photos, so ${one ? 'it is' : 'they are'} not there now. Send ${one ? 'it' : 'them'} again when you are ready to publish.`)
          : st === 'failed' ? callout('', 'Publish did not take all of it', esc(a.why || a.verdict || 'No answer from Publish.')) : '';
        return `<div class="card">${head(b)}<div class="card-b">${otherBuild(b)}
          <div class="kpis lvp-kpis">${kpiHTML(k)}</div>
          <div class="lvp-row"><button type="button" class="btn" id="lvpSend" data-fk="send"${busy ? ' disabled' : ''}>${busy ? 'Sending…' : st === 'held' ? (one ? 'Send it to Publish again' : 'Send them to Publish again') : pages.length === 1 ? 'Send this page to Publish' : 'Send these pages to Publish'}</button>${MODI.publish ? '<button type="button" class="btn sec" data-go="publish">Open Publish</button>' : ''}<span class="mini">They land as drafts in this dashboard. Publish sends nothing to a site on its own.</span></div>
          ${ask}${result}${C.checked ? `<p class="mini lvp-hint">${d.ran ? (d.accepted ? 'Tried on the running dashboard when it was handed over: Publish took it.' : `Tried on the running dashboard when it was handed over: Publish answered "${esc(d.verdict || '')}".`) : `Not tried on the running dashboard when it was handed over${d.why ? ': ' + esc(d.why) : ''}.`}</p>` : ''}
          <div class="xscroll lvp-pages"><table class="prose"><thead><tr><th class="l">Page</th><th class="l">Address</th><th class="l">Kind</th><th class="l">Keyword</th><th>Words</th><th>Grade</th><th class="l">Schema</th><th class="l">Left in by the gate</th></tr></thead><tbody>${pages.map(p => { const i = of(p); return `<tr><td><b>${esc(p.page.h1 || p.page.title || p.page.slug)}</b><div class="mini">${esc(p.page.meta_description || '')}</div></td><td class="mono"${i.url ? ` title="${esc(i.url)}"` : ''}>${esc(pathOf(i.url) || '/' + p.page.slug + '/')}</td><td>${esc(i.type || p.page.archetype || '')}</td><td>${esc(i.keyword || '')}</td><td class="lvp-r">${isN(i.words) ? N(i.words) : ''}</td><td class="lvp-r">${isN(i.grade) ? D(i.grade, 1) : ''}</td><td class="mini">${esc(arr(i.schemaTypes).join(', '))}</td><td class="mini">${arr(i.warnings).length ? esc(i.warnings.slice(0, 3).join(' · ')) : Array.isArray(i.warnings) ? 'nothing' : ''}</td></tr>`; }).join('')}</tbody></table></div></div></div>`;
      }

      /* ----- the whole module ----- */
      function render() {
        const fk = document.activeElement && root.contains(document.activeElement) ? document.activeElement.getAttribute('data-fk') : null;
        const list = all(); if (!list.some(b => b.id === S.sel)) S.sel = list.length ? list[0].id : '';
        const b = find(S.sel), waiting = list.filter(x => standing(x) !== 'held').length; let detail = '<div></div>';
        if (b) { try { detail = b.paid ? paidView(b) : contentView(b); } catch (e) { detail = `<div class="card">${head(b)}<div class="card-b">${callout('', 'This hand-off could not be shown', esc(e && e.message || e))}</div></div>`; } }
        root.innerHTML = mastHTML({
          eyebrow: `Module ${NUM} · Agent Desk · the paid ads specialist and the content strategist`,
          title: 'Agent Desk',
          dek: 'Work your agents finish arrives here. Read what they handed over, see the ad copy screened by this dashboard\'s own rules, answer the claims that need your word, and put the work where it belongs from one place: a media plan goes to the Campaign Desk, pages go to Publish. Nothing here spends money or publishes anything. A plan loads as a plan, pages land as drafts, and every campaign in an agent\'s files is paused.',
          meta: [`<b>${N(list.length)}</b> ${list.length === 1 ? 'hand-off' : 'hand-offs'} on file`, `<b>${N(waiting)}</b> not yet put to work`, `<b>${N(embedded.bundles.length)}</b> came with this file`, 'Kept <b>in this browser</b> · nothing is sent anywhere'],
          bar: 'Agent Desk', barsub: 'Hand-offs, copy, claims, files',
          actions: [{ id: 'lvpOpen', label: '⤒ Open a hand-off', title: 'Choose a handoff.json an agent wrote, a Campaign Desk plan or a pages file' }]
        }) + `<div class="wrap lvp">
          ${embedded.error ? callout('', 'The hand-offs in this file could not be read', esc(embedded.error)) : ''}
          ${list.length ? '' : callout('note', 'How work arrives', 'When the paid ads specialist builds a campaign, or the content strategist hands over pages, each writes a <span class="mono">handoff.json</span> beside its other files and makes a copy of this dashboard with the work already in it. Open that copy and the work is here. Or drop a <span class="mono">handoff.json</span>, or the folder it is in, on the box below. A plan file or a pages file on its own opens here as well.')}
          <div class="lvp-grid${b ? '' : ' lvp-solo'}">${detail}${inbox(list)}</div></div>`;
        wire(b);
        if (fk) { const n = $$('[data-fk]', root).find(x => x.getAttribute('data-fk') === fk); if (n && !n.disabled) { try { n.focus({ preventScroll: true }); } catch (e) { /* no focus */ } } }
      }
      function wire(b) {
        const on = (sel, fn) => { const n = $(sel, root); if (n) n.onclick = fn; };
        $$('.lvp-item', root).forEach(n => n.onclick = () => { S.sel = n.dataset.id; confirmFor = ''; save(); render(); });
        const file = $('#lvpFile', root), dir = $('#lvpDir', root), drop = $('#lvpDrop', root), take = p => Promise.resolve(p).then(open).catch(e => say(['Could not read that: ' + (e && e.message || e)]));
        if (drop) { drop.onclick = () => file.click(); drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } }; drop.ondragover = e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; }; drop.ondragleave = () => { drop.style.borderColor = ''; }; drop.ondrop = e => { e.preventDefault(); drop.style.borderColor = ''; let p; try { p = readDrop(e.dataTransfer); } catch (err) { p = Promise.reject(err); } take(p); }; }
        if (file) file.onchange = e => { const l = [...e.target.files]; e.target.value = ''; take(readList(l, false)); };
        if (dir) dir.onchange = e => { const l = [...e.target.files]; e.target.value = ''; take(readList(l, true)); };
        on('#lvpOpen', () => file && file.click()); on('#lvpFolder', () => dir && dir.click());
        if (!b) return;
        on('#lvpForget', () => { S.kept = S.kept.filter(x => x.id !== b.id); delete S.applied[b.id]; delete S.answers[b.id]; delete S.tab[b.id]; confirmFor = ''; save(); render(); toast('Forgotten in this browser'); });
        $$('#lvpTabs button', root).forEach(t => t.onclick = () => { delete S.tab[b.id]; S.tab[b.id] = t.dataset.v; save(); render(); });
        const run = async job => { confirmFor = ''; busy = true; render(); let r; try { r = await job(); } catch (e) { r = { ok: false, why: 'It could not be done: ' + (e && e.message || e) }; } busy = false; record(b, r); render(); return r; };
        const toDesk = () => run(() => deskApply(obj(b.paid.plan))).then(r => toast(r.ok ? 'The Campaign Desk holds this plan' : 'The Campaign Desk does not hold the plan as handed over'));
        const toPublish = () => run(() => publishSend(arr(b.content.pages).filter(isBlueprint))).then(r => toast(r.ok ? `${plural(arr(r.listed).length, 'page')} in Publish, as ${arr(r.listed).length === 1 ? 'a draft' : 'drafts'}` : 'Publish did not take the pages'));
        on('#lvpApply', () => { confirmFor = b.id; render(); });
        on('#lvpSend', () => { const have = publishHas(); if (arr(b.content.pages).some(p => isBlueprint(p) && have.includes(p.page.slug))) { confirmFor = b.id; render(); } else toPublish(); });
        on('#lvpNo', () => { confirmFor = ''; render(); });
        on('#lvpKeep', deskKeep);
        on('#lvpGo', () => (b.paid ? toDesk() : toPublish()));
        $$('[data-file]', root).forEach(n => n.onclick = () => { const f = arr(b.paid.files)[+n.dataset.file]; if (f && f.text != null) saveFile(f.name, f.text); });
        on('#lvpZip', () => { const fs = arr(b.paid.files).filter(f => f && f.text != null); if (fs.length) saveFile(`${String(b.id).replace(/^[a-z]+:/, '').replace(/[^a-z0-9._-]+/gi, '-') || 'campaign'}.zip`, zipBlob(fs.map(f => ({ name: f.name, data: f.text })))); });
        /* the owner's answers */
        const who = $('#lvpWho', root); if (who) who.oninput = () => { S.who = who.value; save(); ansState(b); };
        $$('.lvp-claim', root).forEach(n => {
          const k = n.dataset.k, A = () => { const all2 = S.answers[b.id] = obj(S.answers[b.id]); return all2[k] = obj(all2[k]); };
          $$('.lvp-dec button', n).forEach(x => x.onclick = () => { const a = A(); a.decision = a.decision === x.dataset.d ? '' : x.dataset.d; save(); render(); });
          $$('input[data-f]', n).forEach(x => x.oninput = () => { A()[x.dataset.f] = x.value; save(); const m = $('.lvp-must', n); if (m) m.hidden = !!x.value.trim(); });
        });
        on('#lvpAns', () => saveFile('owner-answers.json', JSON.stringify(answersOf(b), null, 1)));
      }
      /* the save button follows the name field without redrawing the tab under the person's cursor */
      function ansState(b) { const ans = obj(S.answers[b.id]), done = Object.values(ans).filter(a => a && a.decision).length, confirms = Object.values(ans).some(a => a && a.decision === 'confirm'), btn = $('#lvpAns', root), note = $('#lvpAnsNote', root); if (btn) btn.disabled = !(done > 0 && (!confirms || S.who.trim())); if (note) note.textContent = done ? plural(done, 'answer') + ' so far' + (confirms && !S.who.trim() ? '. Add your name to save them.' : '. Hand the file to the specialist.') : 'Answer at least one claim first.'; }
      /* the file the specialist reads back: what the owner confirmed, in their words, and what to cut */
      function answersOf(b) {
        const ans = obj(S.answers[b.id]), known = Object.fromEntries(claimsOf(b).map(c => [c.key, c])), out = [];
        for (const [k, a] of Object.entries(ans)) { const c = known[k]; if (!c || !a || !a.decision) continue;
          out.push(a.decision === 'cut' ? { claim: c.said, type: c.type, decision: 'cut' } : Object.assign({ claim: c.said, type: c.type, decision: 'confirm', by: S.who.trim(), on: day() }, String(a.terms || '').trim() ? { terms: String(a.terms).trim() } : {}, String(a.basis || '').trim() ? { basis: String(a.basis).trim() } : {})); }
        return { format: ANSWERS, v: 1, handoff: b.id, campaign: b.title || '', made: new Date().toISOString(), answers: out };
      }
      function say(lines) { lastLog = lines.slice(0, 12); const n = $('#lvpLog', root); if (n) { n.hidden = !lastLog.length; n.textContent = lastLog.join('\n'); } }
      async function open(files) {
        const r = bundlesFrom(files), lines = [];
        for (const b of r.found) { S.kept = [b].concat(S.kept.filter(x => x.id !== b.id)).slice(0, KEEP); S.sel = b.id; lines.push(`${b.title || b.id}: opened`); }
        confirmFor = ''; lastLog = lines.concat(r.skipped).concat(r.found.length || r.skipped.length ? [] : ['No hand-off in what was chosen. An agent writes handoff.json into every folder it builds.']).slice(0, 12);
        if (r.found.length) save();
        render();
        if (r.found.length) toast(plural(r.found.length, 'hand-off') + ' opened');
        return r;
      }
      self.receive = p => { if (p && isBundle(p.bundle)) { S.kept = [p.bundle].concat(S.kept.filter(x => x.id !== p.bundle.id)).slice(0, KEEP); S.sel = p.bundle.id; save(); render(); } else if (p && typeof p.open === 'string' && find(p.open)) { S.sel = p.open; confirmFor = ''; save(); render(); } };
      /* for other modules and for the checks that drive this page: what is on file, and the same doors the buttons use */
      self.handoffs = () => all().map(b => ({ id: b.id, agent: b.agent, title: b.title, made: b.made, origin: b.origin, kind: b.paid ? 'paid' : 'content', state: standing(b), applied: appliedOf(b) }));
      self.apply = async id => { const b = find(id); if (!b) return { ok: false, why: 'no such hand-off' }; const r = b.paid ? await deskApply(obj(b.paid.plan)) : await publishSend(arr(b.content.pages).filter(isBlueprint)); record(b, r); render(); return r; };
      self.answers = id => { const b = find(id); return b && b.paid ? answersOf(b) : null; };
      self.open = files => open(files);
      self.version = VERSION;
      /* coming back from the Campaign Desk or Publish, the page says what they hold now (the first show follows the first draw) */
      let fresh = true; self.onShow = () => { if (fresh) { fresh = false; return; } render(); };
      render();
    }
  });
})();
