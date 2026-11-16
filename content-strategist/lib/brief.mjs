/* What a writer needs to know about one place before writing to the people who live there.

   A pack built from a Thermal Debt atlas carries the dashboard's heatmaps for every ZIP: how old the systems run, when
   the homes went up, what they heat with, how often large hail falls, who bought lately. brief() turns that into a page
   plan for one city: who the reader is, what sets their part of town apart, what the homeowner should hear about it and
   the trade detail behind it, the figures said the way a person says them, the neighbors to name, and the live pages to
   link to. A page written from it can speak to the owner of a 1994 house in one ZIP and a 2016 house in the next
   without sounding like a report.

   Nothing here is copy. The lines marked "tell the owner" are the point to make, to be said fresh on every page; a set
   of pages that reuses them word for word fails `compare`. */
import { PLAIN_SOURCE } from './atlas.mjs';
import { sayShare, sayNumber } from './voice.mjs';
import { linkTargets, cannibal, nearby, cityPage } from './sitemap.mjs';

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
export const cityOf = (pack, name) => (pack && pack.cities ? pack.cities.find(c => same(c.name, name)) : null) || null;

/* a ZIP's figures as sentences a writer can reword: [layer, source, worth saying when, how it reads after the share] */
const ZIP_FACTS = [
  ['ge15_sh', 'est', v => v >= 8, 'central systems', 'are 15 years old or more'],
  ['ge20_sh', 'est', v => v >= 5, 'central systems', 'are 20 years old or more'],
  ['r22_sh', 'est', v => v >= 8, 'systems', 'went in before 2010, when new units still used R22'],
  ['origwin_sh', 'est', v => v >= 8, 'systems', 'are the one the builder put in, now 10 to 25 years old'],
  ['furn20_sh', 'est', v => v >= 8, 'gas furnaces', 'are 20 years old or more'],
  ['yb_pre1980', 'acs', v => v >= 20, 'homes', 'went up before 1980'],
  ['yb_duct', 'acs', v => v >= 20, 'homes', 'went up between 1980 and 1999'],
  ['yb_2000_09', 'acs', v => v >= 20, 'homes', 'went up between 2000 and 2009'],
  ['yb_2010_19', 'acs', v => v >= 20, 'homes', 'went up between 2010 and 2019'],
  ['yb_2020p', 'acs', v => v >= 15, 'homes', 'went up in 2020 or later'],
  ['gas_sh', 'acs', v => v >= 15, 'homes', 'heat with gas'],
  ['elec_sh', 'acs', v => v >= 15, 'homes', 'heat with electricity'],
  ['hp_sh', 'est', v => v >= 10, 'central systems', 'are heat pumps'],
  ['own_recent_sh', 'acs', v => v >= 20, 'owners', 'moved in since 2020'],
];
/* a share of something, as a person says it: "about one in five homes", "about half of the homes" */
export const shareOf = (pct, noun) => { const x = sayShare(pct); return /\bin (?:\w+)$/.test(x) ? `${x} ${noun}` : `${x} of the ${noun}`; };
export function zipFacts(area, needs = []) {
  const v = area.values || {}, out = [], era = ['yb_pre1980', 'yb_duct', 'yb_2000_09', 'yb_2010_19', 'yb_2020p'].sort((a, b) => (v[b] || 0) - (v[a] || 0))[0];
  /* the figures that bear on this ZIP: its biggest building era, its heating fuel, and the layers behind what runs hot */
  const bears = new Set([era, (v.gas_sh || 0) >= (v.elec_sh || 0) ? 'gas_sh' : 'elec_sh', ...needs.filter(n => (area.needs || []).includes(n.id)).flatMap(n => n.layers || [])]);
  if (area.builtAround) out.push({ key: 'medyr', value: String(area.builtAround), say: String(area.builtAround), text: `the typical home dates to ${area.builtAround}`, source: PLAIN_SOURCE.acs, estimate: false });
  for (const [k, src, worth, noun, rest] of ZIP_FACTS) if (bears.has(k) && typeof v[k] === 'number' && worth(v[k])) out.push({ key: k, value: v[k] + '%', say: sayShare(v[k]), text: `${shareOf(v[k], noun)} ${rest}`, source: PLAIN_SOURCE[src], estimate: src === 'est' });
  if (bears.has('hail175_8km') && typeof v.hail175_8km === 'number' && v.hail175_8km >= 3) out.push({ key: 'hail175_8km', value: String(v.hail175_8km), say: sayNumber(Math.round(v.hail175_8km)), text: `${sayNumber(Math.round(v.hail175_8km))} reports of golf ball size hail within five miles in the past ten years${v.hail_recent ? `, ${Math.round(v.hail_recent)} of them since 2023` : ''}`, source: PLAIN_SOURCE.storm, estimate: false });
  return out;
}

/* what a home of that age has usually been through; a rule of thumb from the replacement ages, and marked as one */
function lifeStage(year, now) {
  const age = now - year;
  if (!year || age < 0) return '';
  if (age < 8) return 'Homes this new are on their first system, and it is young. Upkeep and warranty questions, not replacement.';
  if (age < 14) return 'Homes this age are on their first system, which is reaching the years when the first parts give out.';
  if (age < 20) return 'Homes this age have a first system at or past the normal replacement age of about 15 years, unless someone already replaced it.';
  if (age < 32) return 'A home this age has probably worn out its first system. The second may be getting old too.';
  if (age < 46) return 'A home this age is likely on its second or third system, and its ducts may be the originals.';
  return 'A home this age has had several systems. The ducts, and sometimes the wiring, come from before central air was standard.';
}

/* the layer a need is measured on, where that is not the first one it lists */
const NEED_LAYER = { 'older-furnaces': ['furn20_sh'], 'electric-heat': ['elec_sh'], hail: ['hail175_8km'] };
const READ = d => d >= 8 ? 'well above' : d >= 3 ? 'above' : d > -3 ? 'about the same as' : d > -8 ? 'below' : 'well below';

/* brief({pack, brand, inv, city, keyword, type, selfUrl, now}) -> the plan for one page */
export function brief({ pack, brand = null, inv = null, city: name, keyword = '', type = 'landing', selfUrl = '', now = new Date().getFullYear(), n = 8 } = {}) {
  const C = cityOf(pack, name), kw = keyword || `${((pack.angles || []).find(a => a.id === 'repair') || { keywords: { core: [''] } }).keywords.core[0] || 'service'} ${String(name).toLowerCase()}`.trim();
  const out = { city: C ? C.name : name, county: C ? C.county : null, inAtlas: !!C, keyword: kw, type, zips: C ? C.zips : [] };
  const angleById = Object.fromEntries((pack.angles || []).map(a => [a.id, a])), fill = k => k.replace(/\{city\}/gi, out.city);
  const termsFor = ids => [...new Set(ids.map(id => angleById[id]).filter(Boolean).flatMap(a => [...(a.keywords.city || []).slice(0, 2).map(fill), ...(a.keywords.core || []).slice(0, 2), ...(a.keywords.questions || []).slice(0, 1)]))].slice(0, 6);

  if (C && C.areas) {
    const N = Object.fromEntries((pack.needs || []).map(x => [x.id, x])), areas = C.areas, own = C.own || {}, cov = C.coverage;
    const years = areas.filter(a => a.builtAround).sort((a, b) => a.builtAround - b.builtAround), built = (C.facts.find(f => /median year/.test(f.label)) || {}).value || null;
    /* how much of its ZIP codes the city fills: under three quarters, the ZIPs are partly another city's homes */
    out.coverage = cov == null ? null : cov; out.wider = cov != null && cov < 0.75;
    out.home = { builtAround: built ? +built : null, oldest: years[0] ? { zip: years[0].zip, year: years[0].builtAround } : null, newest: years.length ? { zip: years[years.length - 1].zip, year: years[years.length - 1].builtAround } : null, means: lifeStage(+built, now), split: !out.wider && years.length > 1 && years[years.length - 1].builtAround - years[0].builtAround >= 12 };
    /* each layer here against the market: the city's own figure where the dashboard has one, else its ZIPs weighted by where the systems are */
    const Z = k => { let s = 0, w = 0; for (const a of areas) if (typeof a.values[k] === 'number') { s += a.values[k] * a.share; w += a.share; } return w ? Math.round(10 * s / w) / 10 : null; }, W = k => (typeof own[k] === 'number' ? own[k] : Z(k));
    out.against = ['ge15_sh', 'r22_sh', 'origwin_sh', 'furn20_sh', 'yb_pre1980', 'yb_duct', 'yb_2000_09', 'yb_2010_19', 'yb_2020p', 'gas_sh', 'hp_sh', 'own_recent_sh'].map(k => { const here = W(k), l = (pack.layers || {})[k]; return here == null || !l || l.metro == null ? null : { key: k, label: l.label.replace(/\s*\(%[^)]*\)\s*$/, ''), here, metro: l.metro, read: READ(here - l.metro), from: typeof own[k] === 'number' ? 'city' : 'zips' }; }).filter(Boolean);
    const gas = W('gas_sh'), hp = W('hp_sh'), elec = W('elec_sh'), zg = Z('gas_sh');
    out.heating = { gas, electric: elec, heatPumps: hp, lead: gas >= 55 ? 'gas' : elec >= 55 ? 'electric' : 'mixed', say: gas >= 55 ? `${shareOf(gas, 'homes')} heat with gas, so the furnace section leads the heating half of the page` : elec >= 55 ? `${shareOf(elec, 'homes')} heat with electricity (heat pumps and electric furnaces with heat strips), so the heat pump section leads the heating half of the page` : `${shareOf(gas, 'homes')} heat with gas and ${sayShare(elec)} with electricity, so give the furnace and the heat pump even weight`,
      note: zg != null && Math.abs(zg - gas) >= 6 ? `Its ZIP codes read ${zg}% gas because they take in homes outside ${out.city}. For ${out.city} itself the figure is ${gas}%.` : '' };
    const row = x => { const d = N[x.id] || {}, some = x.zips.length && x.zips.length < areas.length ? `ZIP ${x.zips.join(', ')}` : '';
      const cover = x.citywide ? (x.basis === 'city' ? `across ${out.city}, by the city's own figures${some && !out.wider ? ` (strongest in ${some})` : ''}` : x.share >= 80 ? `across ${out.city}` : `in most of ${out.city} (${some || 'every ZIP'})`) : `in ${x.wider || out.wider ? '' : 'part of ' + out.city + ': '}ZIP ${x.zips.join(', ')}${x.wider || out.wider ? `, which ${x.zips.length > 1 ? 'reach' : 'reaches'} past the city line: say it of the ZIP, not of ${out.city}` : ''}`;
      const k = (NEED_LAYER[x.id] || d.layers || [])[0], l = (pack.layers || {})[k], here = k ? W(k) : null, pctLayer = l && /%/.test(l.label), lift = x.share - (d.metro || 0);
      return { id: x.id, title: d.title || x.id, share: x.share, metro: d.metro, lift, score: x.basis === 'city' && x.heat != null ? x.heat : 50 + lift / 2, citywide: x.citywide, basis: x.basis || 'zips', wider: !!x.wider, where: cover, zips: x.zips, measure: here != null && l && l.metro != null && pctLayer ? { label: l.label.replace(/\s*\(%[^)]*\)\s*$/, ''), here, metro: l.metro, from: typeof own[k] === 'number' ? 'city' : 'zips' } : null, owner: d.owner || '', tech: d.tech || '', copy: d.copy !== false, inferred: !!d.inferred, angles: d.angles || [], terms: termsFor(d.angles || []) }; };
    const all = (C.needs || []).map(row), say = all.filter(x => x.copy);
    const ranked = say.filter(x => x.citywide).sort((a, b) => b.score - a.score || b.share - a.share), measured = ranked.filter(x => !x.inferred);
    out.lead = measured.filter(x => x.score >= 57.5).slice(0, 4); if (out.lead.length < 2) out.lead = measured.slice(0, Math.min(3, measured.length));
    out.also = ranked.filter(x => !out.lead.includes(x));
    out.pockets = say.filter(x => !x.citywide && x.zips.length && x.share >= 5).sort((a, b) => b.share - a.share);
    out.planning = all.filter(x => !x.copy);
    /* what is common across the market and not the story here: a page must not borrow another city's problems */
    out.quiet = (pack.needs || []).filter(d => d.copy && d.metro >= 15 && !['larger-homes', 'electric-heat', 'gas-heat'].includes(d.id) && !all.some(x => x.id === d.id && (x.citywide || x.zips.length))).map(d => ({ id: d.id, title: d.title, metro: d.metro }));
    out.areas = areas.map(a => ({ zip: a.zip, share: a.share, builtAround: a.builtAround, needs: a.needs.filter(id => (N[id] || {}).copy !== false).map(id => (N[id] || { title: id }).title), facts: zipFacts(a, pack.needs || []) }));
    out.facts = C.facts; out.demand = C.demand;
  }
  out.market = (pack.market && pack.market.facts) || [];
  out.services = ['repair', 'heatrepair', 'heatpump', 'furnace'].map(id => angleById[id]).filter(Boolean).map(a => ({ id: a.id, label: a.label, share: C ? ((C.angles.find(x => x.id === a.id) || {}).share || 0) : null, terms: [...(a.keywords.city || []).slice(0, 3).map(fill), ...(a.keywords.core || []).slice(0, 3)] }));
  out.neighbors = nearby(out.city, { pack, brand }).map(nb => { const p = inv ? cityPage(inv, nb.name, selfUrl) : null; return { name: nb.name, miles: nb.miles, from: nb.from, url: p ? p.url : null }; });
  if (inv) {
    /* a city that already has its page: the brief is for a rewrite of it, not for a second page */
    if (!selfUrl) { const hub = cityPage(inv, out.city), first = cannibal(kw, inv, { pack, brand, type }); if (hub && first.conflicts.length && first.conflicts.every(c => c.url === hub.url)) { selfUrl = hub.url; out.rewrites = hub.url; } }
    const can = cannibal(kw, inv, { pack, brand, type, selfUrl }); out.cannibal = { verdict: can.verdict, advice: can.advice, conflicts: can.conflicts.map(c => ({ url: c.url, why: c.why })), avoid: can.avoid.map(a => a.keyword) };
    const seen = new Map(), add = (t, backs) => { const cur = seen.get(t.url); if (cur) { if (!cur.backs.includes(backs)) cur.backs.push(backs); } else seen.set(t.url, Object.assign({}, t, { backs: [backs] })); };
    /* one parent page for each service the page covers and each need it will raise */
    const wants = [...out.services.map(s => [s.id, s.label]), ...[...(out.lead || []), ...(out.also || []), ...(out.pockets || [])].flatMap(x => x.angles.slice(0, 2).map(a => [a, x.title]))];
    for (const [id, label] of wants) { const a = angleById[id]; if (!a || !a.keywords.core[0]) continue; const parent = linkTargets(`${a.keywords.core[0]} ${out.city}`, inv, { pack, brand, n: 4, type, selfUrl, neighbors: 0 }).targets.find(t => t.why === 'the parent service page'); if (parent) add(parent, label); }
    /* the city's own pages for single services: link down to them, and leave their keywords alone */
    for (const p of inv.filter(p => p.kind === 'service-location' && same(p.place, out.city) && !p.noindex)) add({ url: p.url, anchor: `${p.topic || p.keyword} in ${p.place}`, why: `${out.city}'s own page for that service: link down to it and do not aim this page at its keyword`, kind: p.kind, score: 9 }, 'this city');
    let posts = 0; for (const t of linkTargets(kw, inv, { pack, brand, n, type, selfUrl }).targets) { if (t.kind === 'post' && ++posts > 3) continue; add(t, 'the page keyword'); }
    const rank = t => t.kind === 'contact' ? 9 : t.kind === 'neighbor' ? 8 : t.kind === 'service-location' ? 1 : t.why === 'the parent service page' ? 0 : 5;
    out.links = [...seen.values()].sort((a, b) => rank(a) - rank(b));
  }
  return out;
}

/* the brief as text, for the writer */
export function briefText(b) {
  const T = [`BRIEF  ${b.city}${b.county ? ', ' + b.county + ' County' : ''}  ·  keyword: ${b.keyword}${b.zips.length ? '  ·  ZIP ' + b.zips.join(' ') : ''}`], sec = (title, ...lines) => { const L = lines.flat().filter(x => x != null && x !== ''); if (L.length) T.push('', title, ...L); };
  const src = f => `${f.estimate ? 'an estimate: say "about" or "by one estimate"' : 'say where it comes from: "' + (f.plainSource || f.source) + '"'}`;
  if (b.cannibal) sec(`KEYWORD  ${b.cannibal.verdict === 'conflict' ? 'CONFLICT' : 'clear'}`, b.rewrites ? `  ${b.city} already has its page, so this brief is for a rewrite of ${b.rewrites}. Keep its address.` : '', `  ${b.cannibal.advice[0] || ''}`, b.cannibal.conflicts.map(c => `  held by ${c.url} (${c.why})`), b.cannibal.avoid.length ? '  Leave these alone: ' + [...new Set(b.cannibal.avoid)].slice(0, 12).map(k => `"${k}"`).join(', ') : '');
  if (!b.inAtlas) sec('WHO YOU ARE WRITING TO', `  The owner of a home in ${b.city}. The dashboard has no heatmap for ${b.city}: it lies outside the mapped cities. Use no local figure and make no claim about the homes here that you cannot source.`, '  Write to the homeowner from the trade: what fails, what they will notice, what to check before they call. Ask the person for anything local they want said.');
  else {
    const h = b.home, pc = b.coverage == null ? null : Math.round(100 * b.coverage);
    sec('WHO YOU ARE WRITING TO', `  The owner of a home in ${b.city}. Census figures put the typical home here at ${h.builtAround || 'an unknown year'}.${h.split ? ` It is not one town, though: ${h.oldest.zip} dates to about ${h.oldest.year} and ${h.newest.zip} to about ${h.newest.year}. Say which part of town a point belongs to.` : ''}`,
      b.wider ? `  Take care with ZIP codes here: only about ${pc}% of the homes in ${b.city}'s ZIP codes are in ${b.city}. The rest belong to the cities next door. So what follows is judged from ${b.city}'s own figures wherever the dashboard has them, and anything read from a ZIP is true of that ZIP, not of ${b.city}. Say "${b.city}" for the city's figures, and name a ZIP only for a point about that ZIP.` : '  A ZIP code can reach past the city line. Name the ZIP itself; do not turn it into "the north side" unless you know the map.',
      h.means ? `  What that usually means (a rule of thumb, so word it as likely, not certain): ${h.means}` : '', `  Heating: ${b.heating.say}.${b.heating.note ? ' ' + b.heating.note : ''}`);
    const need = (x, i) => [`  ${i + 1}. ${x.title}  ·  ${x.where}`, `     ${x.basis === 'city' ? `By ${b.city}'s own figures` : 'On the heatmap'}: ${x.basis === 'city' ? (x.citywide ? 'it stands well above the market on this.' : 'the city as a whole is not far enough above the market to call this a city trait.') : `hot for ${x.share}% of the systems in its ZIP codes against ${x.metro}% across the market.`}${x.measure ? ` The measure itself: ${x.measure.here}% here${x.measure.from === 'zips' && b.wider ? ' (from its ZIP codes)' : ''}, ${x.measure.metro}% across the market${Math.abs(x.measure.here - x.measure.metro) < 3 ? ', so the gap is small: say it applies here, not that it is worse here' : ''}.` : ''}`, x.owner ? `     Tell the owner: ${x.owner}` : '', `     The trade detail: ${x.tech}${x.inferred ? ' (Inferred from home size, not measured: keep it general.)' : ''}`, x.terms.length ? `     Terms that fit: ${x.terms.join(' | ')}` : ''];
    sec(`WHAT SETS ${b.city.toUpperCase()} APART  (lead with these, in this order; they come from the dashboard's heatmaps)`, b.lead.flatMap(need));
    sec('ALSO TRUE HERE  (true of much of the market too; a paragraph each at most)', b.also.flatMap(need));
    sec(b.wider ? 'TRUE OF A ZIP CODE, NOT OF THE CITY  (name the ZIP; these ZIP codes take in homes outside the city)' : 'TRUE IN PART OF TOWN  (say where: name the ZIP or the side of town, never the whole city)', b.pockets.flatMap(need));
    sec(`NOT THE STORY HERE  (common elsewhere in the market; do not write as if ${b.city} had it)`, b.quiet.map(q => `  ${q.title}`));
    sec(`${b.city.toUpperCase()} AGAINST THE MARKET${b.wider ? "  (the city's own figures, except where marked)" : ''}`, b.against.map(a => `  ${a.label}: ${a.here}% here${a.from === 'zips' && b.wider ? ' (from its ZIP codes)' : ''}, ${a.metro}% across the market  (${a.read} the market)`));
    sec(b.wider ? `BY ZIP  (what a homeowner in each one is likely living with; each takes in homes outside ${b.city})` : 'BY ZIP  (what a homeowner in each one is likely living with)', b.areas.flatMap(a => [`  ${a.zip}  ·  ${a.share}% of ${b.wider ? "these ZIPs' systems" : "the city's systems"}${a.needs.length ? '  ·  ' + a.needs.join('; ') : '  ·  nothing runs hot here'}`, a.facts.length ? '     ' + a.facts.map(f => `${f.text} [${f.value}; ${f.source}]`).join('. ') + '.' : '']));
    sec('FIGURES FOR THE CITY  (say them the way the left column does; the exact figure is for your check, not for the page)', b.facts.map(f => `  ${String(f.say).padEnd(26)} ${f.label}  [${f.value}; ${src(f)}]`));
    sec('FOR PLANNING ONLY  (never say this to a reader, and never address who they are)', b.planning.map(x => `  ${x.title}, ${x.where}. ${x.tech}`));
  }
  sec('FIGURES FOR TEXAS AND THE MARKET', b.market.map(f => `  ${String(f.say).padEnd(26)} ${f.label}  [${f.value}; ${src(f)}]`));
  sec('THE SERVICES THE PAGE COVERS', b.services.map(s => `  ${s.label}${s.share != null ? `  ·  demand in ${s.share}% of ${b.city}'s ZIPs` : ''}: ${s.terms.join(' | ')}`));
  if (b.links) sec('LIVE PAGES TO LINK TO  (each anchor once, in a sentence that reads fine without the link; link a service page where the page raises that service)', b.links.filter(l => l.kind !== 'neighbor').map(l => `  [${l.anchor}](${l.url})\n     ${l.why}${l.backs && l.backs.filter(x => x !== 'the page keyword' && x !== 'this city').length ? '  ·  backs: ' + l.backs.filter(x => x !== 'the page keyword' && x !== 'this city').slice(0, 3).join('; ') : ''}`));
  const nb = b.neighbors.filter(x => x.url);
  sec('NEIGHBORS', nb.length ? `  Name two of these once, near the end, each linked to its own page: ${nb.slice(0, 4).map(x => `[${x.name}](${x.url})${x.miles != null ? ' (' + x.miles + ' mi)' : ''}`).join(', ')}` : b.neighbors.length ? `  Next door: ${b.neighbors.map(x => x.name).join(', ')}. None has a live page of its own, so name no neighbor.` : '  The map has no neighbors for this place. Ask the person which two cities next door to name, or name none.');
  sec('HOW TO WRITE IT', '  Talk to the owner: "you", "your", contractions. Open on what is happening in their house, in this place.', '  Keep the trade knowledge and explain each term in a few plain words the first time.', '  Say a figure the way a person would, name its source in plain words, and use no more than a handful on the page.', '  Let the section headings name the service and the place. Say each point fresh: none of the lines above is copy.');
  return T.join('\n');
}

/* every city in a pack by what runs hot there: the overview a plan for a set of pages starts from */
export function areasTable(pack, { need = '' } = {}) {
  const N = Object.fromEntries((pack.needs || []).map(x => [x.id, x]));
  return (pack.cities || []).filter(c => c.needs && (!need || c.needs.some(x => x.id === need))).map(c => ({ city: c.name, county: c.county, builtAround: +((c.facts.find(f => /median year/.test(f.label)) || {}).value || 0) || null, systems: c.demand.systems, needs: c.needs.filter(x => x.citywide && (N[x.id] || {}).copy !== false).sort((a, b) => (b.share - (N[b.id].metro || 0)) - (a.share - (N[a.id].metro || 0))).slice(0, 4).map(x => x.id), pockets: c.needs.filter(x => !x.citywide && (N[x.id] || {}).copy !== false).map(x => `${x.id} (${x.zips.join(' ')})`) }));
}
