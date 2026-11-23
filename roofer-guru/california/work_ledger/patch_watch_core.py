"""One-off: turns Louisiana's 10_watch_core.js into California's. Run once: python3 -I patch_watch_core.py"""
import os
P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'atlas', 'src', '10_watch_core.js')
t = open(P, encoding='utf-8').read()
def rep(a, b, n=1):
    global t
    assert t.count(a) == n, (t.count(a), a[:70])
    t = t.replace(a, b)

rep("/* ============================ COMPETITOR WATCH: roster, ledger, library links, API bridge, importers, analytics ============================ */",
    "/* ============================ COMPETITOR WATCH: roster, licence field, ledger, library links, API bridge, importers, analytics ============================ */\n"
    "/* California has no public ranked roster of roofers: the data carries only the few companies named in the evidence. The watchlist\n"
    "   therefore starts short and the analyst adds the companies met in the market (kept in this browser with the ledger); the size of the\n"
    "   field comes from Contractors State License Board C-39 licence counts by city and county and from Census establishment counts. */")
rep("const KEY = 'up.watch.v1'; const ROSTER_DATE = META.compiled || '2026-10-06';", "const KEY = 'cg.watch.v1'; const ROSTER_DATE = META.compiled || '2026-11-19';")
rep("  const COMPANIES = COMP.map((c, i) => ({ key: slug(c.name), i, name: c.name, domain: domOf(c.domain || c.url), url: c.url, tier: c.tier, hq: c.hq, cities: (c.cities || []).slice(), offices: c.offices || [], lines: c.lines || [], verified: !!c.verified, spanish: !!c.spanish, title: c.title || '', desc: c.desc || '', h1: c.h1 || '', social: c.social || [], notes: c.notes || '', asof: c.asof || '' }));\n  const CI = {}; COMPANIES.forEach(c => CI[c.key] = c);",
    "  const TIERS = ['statewide', 'national', 'regional', 'local'];\n"
    "  const mk = (c, i, custom) => ({ key: slug(c.name), i, name: c.name, domain: domOf(c.domain || c.url), url: c.url || '', tier: TIERS.includes(c.tier) ? c.tier : 'local', hq: c.hq || '', cities: (c.cities || []).slice(), offices: c.offices || [], lines: (c.lines || []).filter(k => LINE_KEYS.includes(k)), verified: !!c.verified, spanish: !!c.spanish, langs: c.langs || (c.spanish ? ['es'] : []), title: c.title || '', desc: c.desc || '', h1: c.h1 || '', social: c.social || [], notes: c.notes || '', asof: c.asof || '', seg: c.seg || '', lic_no: c.lic_no || '', src: c.src || '', custom: !!custom });\n"
    "  /* the roster in the data, then the companies the analyst added (COMPANIES and CI are live: they are refilled in place) */\n"
    "  const ROSTER = COMP.filter(c => c && c.name).map((c, i) => mk(c, i, false));\n"
    "  const COMPANIES = ROSTER.slice(); const CI = {}; COMPANIES.forEach(c => CI[c.key] = c);\n"
    "  function rebuild() { COMPANIES.length = 0; Object.keys(CI).forEach(k => delete CI[k]); ROSTER.forEach(c => { COMPANIES.push(c); CI[c.key] = c; }); ((S && S.custom) || []).forEach(c => { if (!c || !c.name) return; const o = mk(c, -1, true); if (!CI[o.key]) { COMPANIES.push(o); CI[o.key] = o; } }); }")
rep("certs: 'Certification or FORTIFIED claim', speed: 'Speed or availability', spanish: 'Spanish service', none: 'No claim' };",
    "certs: 'Certification or manufacturer claim', fire: 'Fire resistance, Class A or home hardening claim', energy: 'Cool roof, energy or rebate claim', license: 'Licence, bond or insured claim', speed: 'Speed or availability', spanish: 'Spanish or other language service', none: 'No claim' };")
rep("const HOOKS = ['free inspection', 'insurance and deductible', 'financing', 'warranty', 'reviews and trust', 'certifications', 'FORTIFIED and grants', 'local roots', 'storm response', 'hail', 'metal', 'Spanish', 'speed', 'other'];",
    "const HOOKS = ['free inspection', 'insurance and deductible', 'financing', 'warranty', 'reviews and trust', 'certifications', 'fire hardening and Class A', 'wildfire rebuild', 'cool roof and energy', 'solar', 'tile', 'local roots', 'rain and leak response', 'wind response', 'metal', 'Spanish', 'speed', 'other'];")
i = t.index("  const inferLine = t => {"); j = t.index("  /* ---------- state ---------- */")
t = t[:i] + r"""  /* the thirteen California lines, most specific first */
  const inferLine = t => { t = String(t || '').toLowerCase();
    if (/class a\b|ember|fire[- ]?(hardened|hardening|resistant|safe|rated|wise)|home hardening|wildfire[- ]prepared|defensible/.test(t)) return 'harden';
    if (/fire damage|wildfire|smoke damage|rebuild|burn(ed)? down/.test(t)) return 'fire';
    if (/solar|photovoltaic|\bpv\b|detach|remove and reinstall/.test(t)) return 'solar';
    if (/lift and relay|relay|underlayment|\btile\b|clay|concrete tile|spanish tile/.test(t)) return 'tile';
    if (/mobile home|manufactured home|roof ?over/.test(t)) return 'mh';
    if (/apartment|condo|\bhoa\b|multifamily|multi family|homeowners association/.test(t)) return 'mf';
    if (/coating|restoration|silicone|maintenance|elastomeric/.test(t)) return 'coat';
    if (/commercial|flat roof|\btpo\b|\bpvc\b|epdm|low slope|warehouse|industrial|cool roof|title 24/.test(t)) return 'comm';
    if (/new construction|builders?\b|new homes?/.test(t)) return 'newc';
    if (/metal|standing seam/.test(t)) return 'metal';
    if (/storm|wind|santa ana|atmospheric river|tarp|emergency/.test(t)) return 'storm';
    if (/leak|repair/.test(t)) return 'repair';
    if (/replace|new roof|re-?roof|shingle|roofing|roofer/.test(t)) return 'replace';
    return ''; };
  const RX_INS = /deductible|insurance (pays|covers|approved|claim)|claims? (help|specialist|expert|handling)|free roof|no out of pocket|we (handle|work with|deal with|negotiate with) (your |the )?insur/;
  const RX_FIRE = /class a\b|ember|fire[- ]?(proof|hardened|hardening|resistant|safe|rated)|home hardening|wildfire[- ]prepared|wildfire/;
  const inferOffer = t => { t = String(t || '').toLowerCase(); if (RX_INS.test(t)) return 'insurance'; if (/free (roof )?(inspection|estimate|quote|assessment)/.test(t)) return 'free'; if (/financ|\$\s?\d+\s?(\/|a |per )\s?mo|no money down|0%|monthly payments?/.test(t)) return 'financing'; if (/warrant|lifetime|guarantee/.test(t)) return 'warranty'; if (RX_FIRE.test(t)) return 'fire'; if (/cool roof|title 24|energy|rebate|tax credit/.test(t)) return 'energy'; if (/review|★|star|rated/.test(t)) return 'reviews'; if (/\bgaf\b|owens corning|certainteed|malarkey|master elite|platinum|certified/.test(t)) return 'certs'; if (/licen[sc]ed|bonded|insured|cslb|c-?39|lic\.? ?#/.test(t)) return 'license'; if (/24\/7|24 7|same day|fast|available now|call now|emergency/.test(t)) return 'speed'; if (/español|spanish|hablamos|中文|tiếng việt|tagalog|한국어/.test(t)) return 'spanish'; return 'none'; };
  const inferHook = t => { t = String(t || '').toLowerCase(); if (RX_INS.test(t)) return 'insurance and deductible'; if (/free (roof )?(inspection|estimate|quote)/.test(t)) return 'free inspection'; if (/financ|no money down|monthly payments?/.test(t)) return 'financing'; if (/warrant|lifetime|guarantee/.test(t)) return 'warranty'; if (/fire damage|rebuild|burn(ed)? down/.test(t)) return 'wildfire rebuild'; if (RX_FIRE.test(t)) return 'fire hardening and Class A'; if (/cool roof|title 24|energy|rebate/.test(t)) return 'cool roof and energy'; if (/solar|photovoltaic/.test(t)) return 'solar'; if (/\btile\b|underlayment|lift and relay/.test(t)) return 'tile'; if (/review|★|star|rated|trust/.test(t)) return 'reviews and trust'; if (/\bgaf\b|owens corning|certainteed|malarkey|master elite|platinum|certified/.test(t)) return 'certifications'; if (/family owned|local|hometown|born|raised|since 19|since 20/.test(t)) return 'local roots'; if (/leak|rain|atmospheric river|tarp/.test(t)) return 'rain and leak response'; if (/storm|wind|santa ana/.test(t)) return 'wind response'; if (/metal|standing seam/.test(t)) return 'metal'; if (/español|spanish|hablamos/.test(t)) return 'Spanish'; if (/24\/7|same day|fast|now/.test(t)) return 'speed'; return 'other'; };
""" + t[j:]
rep("function blank() { return { obs: [], meta: {}, settings:", "function blank() { return { obs: [], meta: {}, custom: [], settings:")
rep("if (s && Array.isArray(s.obs)) { s.meta = s.meta || {};", "if (s && Array.isArray(s.obs)) { s.meta = s.meta || {}; s.custom = Array.isArray(s.custom) ? s.custom : [];")
rep("/* ---------- seed observations from the verified site reads (October 5, 2026) ---------- */", "/* ---------- seed observations from the site reads the data carries (only companies whose own site was read) ---------- */")
rep("(city || 'Louisiana') + ' roofing')", "(city || 'California') + ' roofing')")
rep("enc(name + ' ' + (city || 'Louisiana'))}`,", "enc(name + ' ' + (city || 'California'))}`,\n    /* the licence board's public data portal (lists by classification and county; the licence master file) */\n    cslbPortal: () => 'https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList.aspx',")
rep("services|group|the|of|and|louisiana|la)\\b", "services|group|the|of|and|california|calif|ca|socal|norcal)\\b")
rep("Louisiana bars contractors from advertising claim handling or policy interpretation and from offering anything toward a deductible, so read those pages closely (module 10).",
    "In California a contractor may not offer or advertise a discount meant to offset a deductible (Penal Code 551), and negotiating a claim for pay is public adjusting, which needs its own licence (Insurance Code 15006 and 15007), so read those pages closely (module 10).")
rep("const sp = COMPANIES.filter(c => c.spanish); out.push(`${N(sp.length)} of ${N(ver.length)} verified sites show Spanish pages${sp.length ? ' (' + sp.map(c => c.name).join(', ') + ')' : ''}.`);",
    "const sp = COMPANIES.filter(c => c.spanish); if (ver.length) out.push(`${N(sp.length)} of ${N(ver.length)} verified sites show Spanish pages${sp.length ? ' (' + sp.map(c => c.name).join(', ') + ')' : ''}.`);\n"
    "    if (FIELD.state.lic) out.push(`The field is far larger than any watchlist: ${N(FIELD.state.lic)} active C-39 roofing licences across ${N(FIELD.cities.length)} mailing cities, most in ${FIELD.cities.slice(0, 3).map(c => `${c.city} (${N(c.lic)})`).join(', ')}. ${N(COMPANIES.filter(c => c.custom).length)} companies on the watchlist were added by you; ${N(ROSTER.length)} came with the atlas.`);")
rep("const lineCnt = LINE_KEYS.map(k => [k, COMPANIES.filter(c => c.lines.includes(k)).length]).sort((a, b) => a[1] - b[1]); const lcn = k => SLM.lineName(k).replace(/\\b[A-Z][a-z]+\\b/g, w => w.toLowerCase()); out.push(",
    "const lineCnt = LINE_KEYS.map(k => [k, COMPANIES.filter(c => c.lines.includes(k)).length]).sort((a, b) => a[1] - b[1]); const lcn = k => SLM.lineName(k).replace(/\\b[A-Z][a-z]+\\b/g, w => w.toLowerCase()); if (COMPANIES.some(c => c.lines.length)) out.push(")
rep("else out.push(`No competitor ad has been logged as live yet. The seeded entries are the companies' own site titles and descriptions read on ${dateL(ROSTER_DATE)}; open the library links in the sweep planner and log what you see.`);",
    "else out.push(st.seeded ? `No competitor ad has been logged as live yet. The seeded entries are the companies' own site titles and descriptions read on ${dateL(ROSTER_DATE)}; open the library links in the sweep planner and log what you see.` : `No competitor ad has been logged yet, and the atlas ships no site reads for California: the watchlist holds ${N(tracked)} companies. Add the companies you meet in your market, open their library links and log what you see.`);")
rep("`Competitor Watch ledger, Uplift Louisiana Roofing Atlas, exported ${today()}. Seeded rows are the companies' own site titles and descriptions read on ${dateL(ROSTER_DATE)}; the rest are observations logged by the analyst or imported from the Meta Ad Library API.`",
    "`Competitor Watch ledger, California Roofer Guru, exported ${today()}. Seeded rows, if any, are the companies' own site titles and descriptions read on ${dateL(ROSTER_DATE)}; the rest are observations logged by the analyst or imported from the Meta Ad Library API.`")
rep("atlas: 'Uplift Louisiana Roofing Atlas, module 13'", "atlas: 'California Roofer Guru, module 13'")
rep("function replaceAll(obj) { if (obj && Array.isArray(obj.obs)) { S = Object.assign(blank(), obj); S.obs = S.obs.map(o => blankObs(o)); save(); } }",
    "function replaceAll(obj) { if (obj && Array.isArray(obj.obs)) { S = Object.assign(blank(), obj); S.custom = Array.isArray(S.custom) ? S.custom : []; rebuild(); S.obs = S.obs.map(o => blankObs(o)); save(); } }\n"
    "  /* ---------- the analyst's own additions to the watchlist ---------- */\n"
    "  function addCompany(o) { const name = String((o && o.name) || '').trim(); if (!name) return null; const key = slug(name); if (CI[key]) return CI[key]; const c = { name, domain: domOf(o.domain || o.url), url: o.url || (o.domain ? 'https://' + domOf(o.domain) : ''), hq: String(o.hq || '').trim(), tier: TIERS.includes(o.tier) ? o.tier : 'local', lines: (o.lines || []).filter(k => LINE_KEYS.includes(k)), cities: o.hq ? [String(o.hq).trim()] : [], offices: [], verified: false, spanish: !!o.spanish, lic_no: String(o.lic_no || '').replace(/[^0-9]/g, ''), notes: String(o.notes || ''), asof: today(), src: 'added by the analyst' }; S.custom.push(c); rebuild(); save(); return CI[key]; }\n"
    "  function updateCompany(key, patch) { const c = CI[key]; if (!c || !c.custom) return; const raw = S.custom.find(x => slug(x.name) === key); if (!raw) return; Object.assign(raw, patch || {}); if (patch && patch.lines) raw.lines = patch.lines.filter(k => LINE_KEYS.includes(k)); rebuild(); save(); }\n"
    "  function removeCompany(key) { const c = CI[key]; if (!c || !c.custom) return; S.custom = S.custom.filter(x => slug(x.name) !== key); S.obs = S.obs.filter(o => o.comp !== key); delete S.meta[key]; rebuild(); save(); }")
# the licence field, the sample ads and the text screen, before the state is loaded
rep("  S = load();\n",
r"""  /* ---------- the field by place: licences and establishments (the measure of competition when the roster is short) ---------- */
  const FIELD = (() => {
    const cnum = v => isN(v) ? +v : 0;
    const cities = (DATA.lic_city || []).map(a => { const p = CO[a[1]] || {}; return { city: a[0], pi: a[1], county: p.name || '', fips: p.fips || '', reg: p.reg, lic: cnum(a[2]), lic_all: cnum(a[3]) }; }).filter(c => c.city).sort((a, b) => b.lic - a.lic);
    const counties = CO.map(p => { const zs = Z.filter(z => z.pi === p.i); const roofs = isN(p.roofs) ? +p.roofs : sum(zs.map(z => z.roofs || 0)); const lic = isN(p.lic) ? +p.lic : sum(zs.map(z => z.lic || 0)); return { fips: p.fips, name: p.name, reg: p.reg, pop: cnum(p.pop), roofs, lic, lic_all: isN(p.lic_all) ? +p.lic_all : null, cbp: isN(p.cbp_roof) ? +p.cbp_roof : null, emp: isN(p.cbp_roof_emp) ? +p.cbp_roof_emp : null, roofers: isN(p.roofers) ? +p.roofers : sum(zs.map(z => z.roofers || 0)), nes: isN(p.nes2381) ? +p.nes2381 : null, fees: isN(p.fees) ? +p.fees : sum(zs.map(z => z.fees || 0)), per10k: p.pop ? lic / p.pop * 1e4 : null, roofsPer: lic ? roofs / lic : null, feesPer: lic ? (isN(p.fees) ? +p.fees : sum(zs.map(z => z.fees || 0))) / lic : null }; });
    const regions = REG_KEYS.map(k => { const cs = counties.filter(c => c.reg === k); const s = f => sum(cs.map(c => c[f] || 0)); const lic = s('lic'); return { k, name: REGN[k], n: cs.length, pop: s('pop'), roofs: s('roofs'), lic, cbp: s('cbp'), cbpGaps: cs.filter(c => c.cbp == null).length, roofers: s('roofers'), fees: s('fees'), per10k: s('pop') ? lic / s('pop') * 1e4 : null, roofsPer: lic ? s('roofs') / lic : null, feesPer: lic ? s('fees') / lic : null }; });
    const L = META.lic || {}; const state = { lic: isN(L.clear) ? +L.clear : sum(counties.map(c => c.lic)), roll: isN(L.n) ? +L.n : null, only: isN(L.only) ? +L.only : null, out: isN(L.out) ? +L.out : null, susp: isN(L.susp) ? +L.susp : null, cbp: (META.cbp || {}).est, emp: (META.cbp || {}).emp };
    return { cities, counties, regions, state };
  })();
  /* ---------- sample ads for the compliance bench. EVERY ONE IS INVENTED for this atlas: no company published them. ---------- */
  const SAMPLES = [
    { id: 's1', platform: 'meta', label: 'Deductible offer', text: 'Storm damage? We cover your deductible. New roof at no cost to you. Call today.' },
    { id: 's2', platform: 'google', label: 'Claim handling', text: 'Insurance claim specialists. We handle your claim from start to finish and negotiate with your insurer so you do not have to.' },
    { id: 's3', platform: 'meta', label: 'Free roof', text: 'Your insurance will pay for a free roof. Free inspection, no out of pocket cost, insurance approved contractor.' },
    { id: 's4', platform: 'site', label: 'Fire claims', text: 'Fireproof Class A roof guaranteed to save your home from wildfire. Keep your insurance: our roof stops non renewal.' },
    { id: 's5', platform: 'mail', label: 'After a fire', text: 'We are in your neighborhood rebuilding after the fire. Sign today and lock in a price before costs double. Cash discount, no permit needed.' },
    { id: 's6', platform: 'google', label: 'Financing terms', text: 'New roof from $99 a month, $0 down, 0% APR. Best roofer in California. Lifetime warranty.' },
    { id: 's7', platform: 'meta', label: 'No licence shown', text: 'Affordable roof repair and re-roofing. Licensed and insured. Text us for a same day quote.' },
    { id: 's8', platform: 'site', label: 'A careful ad', text: 'Roof inspections by request in Pasadena. Written estimate, permit pulled in your city, CSLB Lic. #0000000 (C-39). We do not negotiate insurance claims.' },
  ];
  /* screen any text with the California rule pack, house style off: [{id, sev, name, cite, ev, fix}] */
  function lintText(text, platform) { const txt = String(text || '').trim(); if (!txt || typeof satchelLint !== 'function') return []; let out = []; try { out = satchelLint(txt, { platform: platform || 'meta', web: platform === 'site', page: platform === 'site', channel: platform === 'door' ? 'door' : platform === 'mail' ? 'mail' : '', noHouse: true }); } catch (e) { out = []; } return out.filter(x => x && x.rule).map(x => ({ id: x.rule.id, sev: x.rule.sev, name: x.rule.name || x.rule.id, cite: x.rule.cite || '', ev: typeof x.ev === 'string' ? x.ev : '', fix: x.rule.fix || '' })); }
  S = load(); rebuild();
""")
rep("function lintObs(o) { const txt = [o.text, o.offer && o.offer.text, o.cta].filter(Boolean).join(' '); if (!txt) return []; return [...new Set(satchelLint(txt,",
    "function lintObs(o) { const txt = [o.text, o.offer && o.offer.text, o.cta].filter(Boolean).join(' '); if (!txt || typeof satchelLint !== 'function') return []; return [...new Set(satchelLint(txt,")
rep("return { COMPANIES, CI, KINDS,", "return { COMPANIES, CI, ROSTER, TIERS, FIELD, SAMPLES, lintText, addCompany, updateCompany, removeCompany, KINDS,")
open(P, 'w', encoding='utf-8').write(t)
print('patched', len(t))
