/* A campaign file: the one thing the paid ads specialist writes, and everything made from it.

   {
     "name":   a line for the person
     "plan":   the Campaign Desk's plan keys: line, budget, start, weeks, scope, picks, bids, mix, angles, asm, ...
     "search": one campaign per language for Google Search and Microsoft: callouts, sitelinks, a structured snippet,
               negatives, and ad groups, each with keywords and one responsive search ad
     "ads":    every other ad, one entry each: its channel and format from the channel book, and that format's fields
     "extra":  monthly budgets for channels the Campaign Desk does not plan (connected TV, mail, audio, ...)
     "confirmed": claims the person vouched for, in their words: [{"claim": "same day", "by": "owner", "on": "2026-11-14",
               "terms": "calls before noon, Monday to Saturday"}]
   }

   draft()  starts the file from the dashboard's own library, as its Campaign Desk would build the plan
   gate()   measures the file: plan, keywords, copy, claims. Errors stop a build.
   files()  the bulk files and build sheets, every campaign and ad paused, and the plan file the Campaign Desk loads */
import * as desk from './desk.mjs';
import * as kw from './keywords.mjs';
import { checkRsa, checkAssets, checkAd, text, chars, CLAIM_TYPES } from './copy.mjs';
import { CHANNELS, byId, forDesk, format as bookFormat } from '../channels/book.mjs';
import { deskPlan } from '../../dashboard-link/lib/handoff.mjs';

/* the Campaign Desk's platform keys and the channel book's ids */
export const DESK_TO_CHANNEL = { google: 'google_search', microsoft: 'microsoft_search', lsa: 'lsa', dg: 'demand_gen', meta: 'meta', nextdoor: 'nextdoor', yelp: 'yelp', linkedin: 'linkedin' };
export const channelToDesk = id => { const c = byId(id); return c ? c.desk : null; };
const $ = n => '$' + Math.round(n || 0).toLocaleString('en-US');
const sum = a => a.reduce((s, x) => s + (+x || 0), 0);
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const STOP = new Set(['near', 'with', 'from', 'that', 'this', 'your', 'have', 'does', 'what', 'much', 'best', 'cost', 'need', 'long', 'home', 'unit', 'units', 'system', 'systems', 'service', 'services', 'company', 'city']);
/* the words that name an angle's service, for "does the ad say what it is about" */
export function termsOf(angle, lang = 'en') {
  if (!angle) return [];
  const src = [angle.short, ...(angle.keywords.core || []).slice(0, 5)].concat(lang === 'es' && angle.copy.es ? angle.copy.es.h.slice(0, 2) : []);
  return [...new Set(src.join(' ').toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)))].concat(['ac', 'aire', 'hvac'].filter(w => src.join(' ').toLowerCase().split(/\W+/).includes(w)));
}
export function placesOf(R) { return [...new Set(R.markets.flatMap(m => [desk.cityName(m.z, R.P), m.z.county]).filter(Boolean).concat(['DFW', 'Dallas', 'Fort Worth', 'Texas', R.P.city]))]; }

/* ---------- draft ---------- */
/* The campaign file the dashboard's own Campaign Desk would build for a plan, as a starting point. Every line of copy in
   it comes from the dashboard's library; the specialist's work is what changes after this. One thing is already set
   right: the structured snippet header, which the desk writes as "Services" and Google only takes as "Service catalog". */
export function draft(planInput, ctx) {
  const R = desk.read(planInput, ctx), { P } = R, pack = ctx.pack, ANG = Object.fromEntries(pack.angles.map(a => [a.id, a])), FC = R.forecast;
  const search = (FC.google.spend > 0 || FC.microsoft.spend > 0) ? desk.searchDraft(R, ctx).map(c => { if (c.snippets) c.snippets.header = 'Service catalog'; return c; }) : [];
  const ads = [], first = R.markets[0] && R.markets[0].z, c0 = desk.ctxFor(first, P);
  for (const plat of ['meta', 'nextdoor', 'yelp', 'dg']) {
    if (!(FC[plat] && FC[plat].spend > 0)) continue;
    for (const x of desk.socialDraft(R, plat, ctx)) {
      if (plat === 'meta') ads.push({ channel: 'meta', format: 'feed', angle: x.angle, lang: x.lang, name: x.name, primary: x.primary, headline: x.headline, description: x.description || undefined, cta: 'Get quote', url: x.url });
      else if (plat === 'nextdoor') ads.push({ channel: 'nextdoor', format: 'newsfeed', angle: x.angle, lang: x.lang, name: x.name, headline: x.headline, body: x.primary, cta: 'Get a quote', url: x.url });
      else if (plat === 'yelp') ads.push({ channel: 'yelp', format: 'ad', angle: x.angle, lang: x.lang, name: x.name, text: x.primary, url: x.url });
      else ads.push({ channel: 'demand_gen', format: 'image', angle: x.angle, lang: x.lang, name: x.name, headlines: [x.headline].filter(h => h && chars(h) <= 40), descriptions: sentencesUnder(x.primary, 90).slice(0, 3), business: P.brand.slice(0, 25), cta: 'Get quote', url: x.url });
    }
  }
  if (FC.lsa && FC.lsa.spend > 0) ads.push({ channel: 'lsa', format: 'profile', name: 'Local Services profile', bio: desk.fillCopy(`${P.brand} is a licensed Texas air conditioning and heating contractor serving {county} County. We diagnose, price upfront and install matched systems with our own crew. Lic {lic}.`, c0) || '', jobTypes: [...new Set(R.angles.flatMap(id => (ANG[id] || {}).lsa || []))] });
  if (FC.linkedin && FC.linkedin.spend > 0 && ANG.recruit) ads.push({ channel: 'linkedin', format: 'image', angle: 'recruit', lang: 'en', name: 'Recruiting', intro: desk.fillCopy(ANG.recruit.copy.social.primary, c0) || '', headline: desk.fillCopy(ANG.recruit.copy.h[0], c0) || '', cta: 'Apply' });
  const plan = { line: P.line, budget: P.budget, start: P.start, weeks: P.weeks, scope: 'picks', picks: R.markets.map(m => m.z.zip), mix: P.mix, angles: P.angles, bookRate: P.bookRate, jobVal: P.jobVal, spanTh: P.spanTh };
  if (P.bids) plan.bids = P.bids;
  const given = planInput && typeof planInput === 'object' ? planInput : {}; if (given.asm) plan.asm = given.asm; if (given.alpha != null) plan.alpha = given.alpha;
  return { name: `${(pack.lines[P.line] || {}).label || P.line}: ${R.markets.length} markets, ${$(P.budget)} a month from ${P.start}`, plan, search, ads, extra: [], confirmed: [],
    draft: { from: `${pack.atlas} library`, note: 'Every line of copy below is the dashboard\'s own. Rewrite it; then delete this note.' } };
}
function sentencesUnder(textIn, max) { return String(textIn || '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s && chars(s) <= max); }

/* ---------- gate ---------- */
const order = { error: 0, warn: 1, note: 2 };
/* minutes from the shop beyond which a market is called out */
export const FAR = 45;
/* a site's host without "www.", and a page's path as the sitemap inventory keys it: lower case, no trailing slash */
export const hostOf = u => { try { return new URL(/^https?:/i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
export const normPath = p => { const s = ('/' + String(p || '').split(/[?#]/)[0]).replace(/\/{2,}/g, '/').toLowerCase(); return s.length > 1 ? s.replace(/\/$/, '') : '/'; };
/* What a job on a Campaign Desk line is worth by the dashboard's service line model: the computed ticket when the running
   dashboard was read, else the stated one. {ticket, name, from} or null (a line whose ticket is each ZIP's own). */
export function lineTicket(pack, line, snapshot) {
  const sv = pack.service; if (!sv) return null;
  const mine = sv.lines.filter(l => l.desk === line), l = mine.find(x => x.id === line) || mine[0]; if (!l) return null;
  const live = snapshot && snapshot.slm && snapshot.slm.lines.find(x => x.id === l.id), t = live && live.unit && live.unit.ticket ? live.unit.ticket : (l.economics || {}).ticket;
  return t > 0 ? { ticket: t, name: l.name || l.short || l.id, from: live && live.unit && live.unit.ticket ? 'as the running dashboard computes it' : 'its stated assumption, grade D' } : null;
}
/* Errors a person may ask to have lifted, by name: matters of house policy and of structure. Every other error stays
   whatever is asked: a limit the platform enforces, a file the Campaign Desk would not take, a rule of law, a claim the
   brand file contradicts. Warnings and notes can always be set aside by name; the build records every rule lifted. */
export const LIFTABLE = new Set(['draft', 'cta', 'competitor-name', 'kw-duplicate', 'kw-blocked', 'kw-intent', 'language', 'rule:HOUSE1']);
/* every rule name the gate can give, so a misspelt --allow is caught */
const RULES = ['draft', 'plan', 'brand', 'floor', 'spread', 'desk-build', 'job-value', 'drive', 'angle', 'demand', 'unbuilt', 'unfunded', 'language', 'required', 'landing', 'desk-limit', 'channel', 'extra', 'confirmed', 'kw-none', 'kw-form', 'kw-broad', 'kw-duplicate', 'kw-split', 'kw-blocked', 'kw-intent', 'kw-competitor', 'kw-theme', 'kw-mixed', 'neg-twin', 'kw-language', 'rsa-count', 'rsa-thin', 'limit', 'path', 'rsa-duplicate', 'pin', 'pin-many', 'editorial', 'insertion', 'license-shows', 'license-wrong', 'competitor-name', 'cta', 'cta-weak', 'cta-description', 'cta-objective', 'cta-button', 'relevance', 'mix', 'persuasion', 'stock-phrase', 'passive', 'asset-limit', 'sitelink-duplicate', 'sitelink-count', 'snippet-header', 'format', 'shows', 'script-length', 'special-category', 'personal', 'we-heavy'];
/* a rule as --allow may name it: "REGZ1" is "rule:REGZ1" */
export const ruleName = a => { const s = String(a).trim(); return /^[A-Za-z]+\d+$/.test(s) ? 'rule:' + s.toUpperCase() : /^(rule|dashboard):/i.test(s) ? s.replace(/^(rule|dashboard):(.*)$/i, (m, k, id) => k.toLowerCase() + ':' + id.toUpperCase()) : s.toLowerCase(); };
/* Everything measured about a campaign file. ctx: pack, model, brand, seasons, competitors (names), site (the live pages
   of the client's site, when the content strategist has read its sitemap), now. Returns {ok, counts, findings, stats,
   claims, reading (the plan as the desk reads it), plan (the file for the desk), allowed, notLifted, unknownAllow}. */
export function gate(file, ctx, { allow = [] } = {}) {
  const F = [], add = (severity, rule, where, message, excerpt = '', fix = '') => F.push({ severity, rule, where, message, excerpt, fix });
  const c = file && typeof file === 'object' ? file : {}, pack = ctx.pack, ANG = Object.fromEntries(pack.angles.map(a => [a.id, a])), claims = [];
  if (c.draft) add('error', 'draft', 'file', 'The file still carries its draft note, so the copy in it is the dashboard\'s library, not yours. A draft is a starting point and never the deliverable: rewrite it, then delete the "draft" key.');

  /* the plan, as the Campaign Desk will take it */
  const brand = ctx.brand, base = Object.assign({}, c.plan || {});
  if (brand) { if (base.brand == null && (brand.short || brand.name)) base.brand = String(brand.short || brand.name).slice(0, 40); if (base.lic == null && brand.license) base.lic = brand.license; if (base.phone == null && brand.phone) base.phone = brand.phone; if (base.url == null && brand.url) base.url = brand.url; if (base.city == null && brand.address && brand.address.city) base.city = brand.address.city; }
  const dp = deskPlan(base, { pack, model: ctx.model });
  for (const p of dp.problems) add('error', 'plan', 'plan', p);
  for (const n of dp.notes) add('note', 'plan', 'plan', n);
  if (!brand) add('error', 'brand', 'plan', 'No brand is on file, so the ads would carry a made up name and license number. Connect the dashboard, or fill the brand file.');
  else if (!brand.license) add('error', 'brand', 'plan', 'The brand file has no license number, and every ad must carry it.');
  const R = desk.read(dp.plan, ctx), { P } = R, PL = pack.platforms, lic = (brand && brand.license) || P.lic;
  if (!R.markets.length) add('error', 'plan', 'plan', 'The plan buys no market.');
  const port = desk.ported(pack);
  if (!port.same) add('warn', 'desk-build', 'plan', `The forecast here may not be the dashboard's: ${port.why}. Quote the figures the Campaign Desk shows once the plan is loaded there. build loads it through the running desk and says whether the two agree.`);
  for (const f of R.floors) add('warn', 'floor', 'plan', `${f.label} gets ${$(f.daily)} a day, under the ${$(f.min)} the Campaign Desk holds as the floor for a platform to learn. Fund it properly or take it out of the mix and give its share to a platform that is.`);
  const funded = PL.order.filter(p => R.forecast[p].spend > 0);
  if (funded.length > 3 && P.budget / funded.length < 1500) add('warn', 'spread', 'plan', `${$(P.budget)} a month across ${funded.length} platforms is ${$(P.budget / funded.length)} each. Fewer platforms, funded properly, book more jobs than many starved ones.`);
  const span = R.markets.filter(m => m.es).length;
  /* a start date behind today: Google Ads Editor takes today or later */
  const today = new Date(ctx.now || Date.now()).toISOString().slice(0, 10);
  if (P.start < today) add('warn', 'plan', 'plan', `The plan starts on ${P.start}, which is past. Google Ads Editor takes a start date of today or later: move the start.`);
  /* the value of a booked job: the desk opens every plan with one figure, whatever the line sells */
  const worth = lineTicket(pack, P.line, ctx.snapshot);
  if (worth && P.jobVal === (pack.defaults || {}).jobVal && (worth.ticket < P.jobVal / 2 || worth.ticket > P.jobVal * 2)) add('warn', 'job-value', 'plan', `The plan values a booked job at ${$(P.jobVal)}, the figure the Campaign Desk opens every plan with. The dashboard's service line model puts ${worth.name.toLowerCase()} at ${$(worth.ticket)} a job (${worth.from}). The booked value and the target cost a booked job follow this figure: set "jobVal" in the plan to what a job on this line is worth.`);
  /* a market a long drive from the shop: the paid model scores the market and ignores the truck */
  const shop = brand && brand.geo && brand.geo.lat != null ? brand.geo : null, far = shop ? R.markets.map(m => ({ m, min: desk.minutesFrom(shop, m.z) })).filter(x => x.min != null && x.min > FAR).sort((a, b) => b.min - a.min) : [];
  if (far.length) add('warn', 'drive', 'plan', `${far.length} of the ${R.markets.length} markets ${far.length === 1 ? 'is' : 'are'} more than ${FAR} minutes from the shop by the Heat Desk's rule of thumb (grade C). A job that far costs a truck two hours and more: keep them only if the owner wants the drive.`, far.slice(0, 8).map(x => `${x.m.z.zip} ${x.m.z.city} ${x.min} min`).join(' | '));

  /* what the dashboard's model says about each angle in these markets */
  const fires = id => R.markets.filter(m => (m.z.fires || []).includes(id)).length;
  const used = new Set([...(c.search || []).flatMap(s => (s.adGroups || []).map(g => g.angle)), ...(c.ads || []).map(a => a.angle)].filter(Boolean));
  for (const id of used) { const a = ANG[id]; if (!a) { add('error', 'angle', 'file', `"${id}" is not a service angle in the dashboard. Angles: ${pack.angles.map(x => x.id).join(', ')}`); continue; } if (id !== 'recruit' && R.markets.length && !fires(id)) add('warn', 'demand', a.short, `The dashboard's model finds no demand trigger for ${a.label.toLowerCase()} in any of the ${R.markets.length} markets bought (its trigger: ${a.why}). Say so before you spend there, or choose markets where it fires.`); }

  /* landing pages, against the site's own sitemap when the content strategist has read it. A path from the dashboard's
     library is the Site Forge's plan for a page: it says nothing about whether the page is live. */
  const site = ctx.site && ctx.site.paths ? ctx.site : null, host = brand && brand.url ? hostOf(brand.url) : '', unread = new Set();
  const landing = (u, where) => {
    if (!u) return; let p = u;
    if (/^https?:\/\//i.test(u)) { try { const x = new URL(u); if (host && hostOf(u) !== host) return; p = x.pathname; } catch { add('error', 'landing', where, `"${u}" is not a web address.`); return; } }
    p = normPath(p);
    if (!site) { unread.add(p); return; }
    if (!site.paths.has(p)) add('warn', 'landing', where, `The ad lands on ${p}, which is not in the site's sitemap as it was read ${site.ageHours} hour${site.ageHours === 1 ? '' : 's'} ago (${site.paths.size} live pages). A path from the dashboard's library is the Site Forge's plan for a page, not proof the page exists. Point the ad at a live page, or have the page built first.`, p);
  };

  /* search */
  const places = placesOf(R), competitors = (ctx.competitors || []).filter(Boolean);
  const common = { lic, rules: pack.rules.rules, places, brand, brandName: P.brand, confirmed: c.confirmed || [], line: P.line, objective: (pack.lines[P.line] || {}).objective || '', deskLimits: (PL.book.google || {}).limits || null, competitors, year: ctx.year };
  const stats = { campaigns: 0, adGroups: 0, keywords: 0, ads: 0, persuasion: [] };
  const searchSpend = R.forecast.google.spend + R.forecast.microsoft.spend, S = Array.isArray(c.search) ? c.search : [];
  if (searchSpend > 0 && !S.length) add('error', 'unbuilt', 'search', `The plan gives search ${$(searchSpend)} a month and the file holds no search campaign.`);
  if (!searchSpend && S.length) add('warn', 'unfunded', 'search', 'The file holds search campaigns and the plan gives Google and Microsoft nothing.');
  const langs = new Set();
  for (const camp of S) {
    stats.campaigns++; const lang = camp.lang === 'es' ? 'es' : 'en', tag = lang.toUpperCase();
    if (langs.has(lang)) add('error', 'language', `search ${tag}`, 'Two search campaigns share a language. One campaign a language.'); langs.add(lang);
    if (lang === 'es' && !span) add('warn', 'language', `search ${tag}`, `None of the markets passes the Spanish threshold (${P.spanTh}% of households), so the Campaign Desk would give a Spanish campaign no markets.`);
    if (camp.bidding != null && !/^(maximize\s+)?(clicks|conversions)$|^manual(\s*cpc)?$/i.test(String(camp.bidding).trim())) add('error', 'plan', `search ${tag}`, `"${camp.bidding}" is not a bid strategy this toolkit writes. Use "clicks" (Maximize clicks with a bid limit, where ZIP bid adjustments apply), "conversions" or "manual".`);
    else if (desk.biddingOf(camp) === desk.BIDDING.conversions && R.markets.some(m => desk.bidOf(m.z, P) !== 0)) add('warn', 'plan', `search ${tag}`, 'This campaign runs on Maximize conversions, and Google\'s Smart Bidding does not use manual bid adjustments: the ZIP bid adjustments in the plan would do nothing. Keep Maximize clicks until the account has conversion data, or accept that the ZIPs are no longer weighted.');
    if (camp.share != null && !(typeof camp.share === 'number' && camp.share > 0 && camp.share < 1)) add('error', 'plan', `search ${tag}`, 'A campaign\'s "share" of the search money is a number between 0 and 1, set on the Spanish campaign.');
    const tagged = f => Object.assign(f, { where: `search ${tag} · ${f.where}` });
    kw.check(camp, { competitors, cities: places, line: P.line }).map(tagged).forEach(f => F.push(f));
    const A = checkAssets(camp, common); A.findings.map(tagged).forEach(f => F.push(f)); claims.push(...A.claims.map(x => Object.assign(x, { where: `search ${tag} · ${x.where}` })));
    for (const s of camp.sitelinks || []) landing(s && s.path, `search ${tag} · sitelink "${(s && s.text) || ''}"`);
    for (const g of camp.adGroups || []) {
      stats.adGroups++; stats.keywords += (g.keywords || []).length; stats.ads++;
      if (!g.ad) { add('error', 'required', `search ${tag} · ${g.name || '(ad group)'}`, 'This ad group has no ad.'); continue; }
      if (g.bid != null && !(typeof g.bid === 'number' && g.bid > 0 && g.bid <= 3)) add('error', 'plan', `search ${tag} · ${g.name}`, 'An ad group\'s "bid" is a share of the campaign\'s click cost: 0.5 for half, 1 for the same, up to 3.');
      const r = checkRsa(g, Object.assign({}, common, { terms: termsOf(ANG[g.angle], lang), lang, spanishKeywords: (camp.adGroups || []).some(x => (x.keywords || []).some(k => k && kw.SPANISH.test(k.text || ''))), intentOf: kw.intent })); r.findings.map(tagged).forEach(f => F.push(f)); claims.push(...r.claims.map(x => Object.assign(x, { where: `search ${tag} · ${x.where}` }))); stats.persuasion.push(r.stats.persuasion);
      const u = g.ad.url || ''; if (!u) add('error', 'landing', `search ${tag} · ${g.name}`, 'The ad has no landing page.'); else landing(u, `search ${tag} · ${g.name}`);
    }
  }
  if (S.length && span && !langs.has('es')) add('note', 'language', 'search', `${span} of the ${R.markets.length} markets pass the Spanish threshold. The Campaign Desk would add a Spanish campaign there, beside the English one.`);
  /* how the search money divides between the languages, and whether either campaign falls under a platform's floor */
  if (S.length > 1 && langs.has('es') && span) {
    const sh = desk.languageShares(S, R);
    add('note', 'language', 'search ES', `The Spanish campaign gets ${Math.round(sh.es * 100)}% of each search platform's money and the English one ${Math.round(sh.en * 100)}%: the Campaign Desk's own split unless the Spanish campaign carries a "share" (0 to 1).`);
    for (const plat of ['google', 'microsoft']) for (const [lang, part] of [['en', sh.en], ['es', sh.es]]) { const daily = R.forecast[plat].spend * part / 30.4, min = P.asm[plat].min; if (R.forecast[plat].spend > 0 && daily < min && !R.floors.some(f => f.platform === plat)) add('warn', 'floor', `search ${lang.toUpperCase()}`, `The ${lang === 'es' ? 'Spanish' : 'English'} ${PL.labels[plat] || plat} campaign gets ${$(daily)} a day, under the ${$(min)} the Campaign Desk holds as the floor. Run one language there, or move the share.`); }
  }

  /* every other ad */
  const A = Array.isArray(c.ads) ? c.ads : [], byPlat = {};
  for (const ad of A) {
    stats.ads++; const r = checkAd(ad, Object.assign({}, common, { terms: termsOf(ANG[ad.angle], ad.lang === 'es' ? 'es' : 'en'), deskLimits: null }));
    r.findings.forEach(f => F.push(f)); claims.push(...r.claims); if (r.stats.persuasion != null) stats.persuasion.push(r.stats.persuasion);
    const ch = byId(ad.channel), dk = channelToDesk(ad.channel), where = `${ad.channel}: ${ad.name || ad.angle || ''}`;
    if (dk) byPlat[dk] = (byPlat[dk] || 0) + 1; else if (ch && ch.status !== 'closed' && !(c.extra || []).some(e => e && e.channel === ad.channel)) add('warn', 'unfunded', where, `${ch.name} is not a platform the Campaign Desk plans, and the file gives it no budget. Add it under "extra" with a monthly figure and say in the hand back that it sits outside the desk's forecast.`);
    if (ch && ch.status !== 'closed') landing(ad.url, where);
    const book = dk && (PL.book[dk] || {}).limits; if (book) { for (const [bk, fk] of [['p', 'primary'], ['h', 'headline'], ['d', 'description'], ['b', 'body'], ['i', 'intro'], ['bio', 'bio']]) { const v = text(ad[fk]); if (book[bk] && v && chars(v) > book[bk]) add('note', 'desk-limit', where, `The dashboard's Campaign Desk cuts ${fk} at ${book[bk]} characters; this is ${chars(v)}. The platform's own figure is in the channel book.`); } }
  }
  if (unread.size) add('note', 'landing', 'file', `No landing page was checked: the site's sitemap has not been read on this machine. A path from the dashboard's library is the Site Forge's plan for a page, not proof the page exists. Read the site (node content-strategist/cli.mjs sitemap) and lint again, or open each page yourself.`, [...unread].slice(0, 12).join(' | '));
  for (const p of PL.order) { if (p === 'google' || p === 'microsoft') continue; const has = byPlat[p] || 0, spend = R.forecast[p].spend; if (spend > 0 && !has) add('warn', 'unbuilt', PL.labels[p] || p, `The plan gives ${PL.labels[p] || p} ${$(spend)} a month and the file holds no ad for it.`); if (!spend && has) add('warn', 'unfunded', PL.labels[p] || p, `The file holds ${has} ad${has === 1 ? '' : 's'} for ${PL.labels[p] || p} and the plan gives it nothing.`); }

  /* channels the desk does not plan: their money sits on top of the plan and outside its forecast */
  let extraTotal = 0;
  for (const e of c.extra || []) {
    const ch = byId(e && e.channel);
    if (!ch) add('error', 'channel', 'extra', `"${e && e.channel}" is not a channel in the book.`);
    else if (ch.status === 'closed') add('error', 'channel', 'extra', `${ch.name} is not open to this kind of business. ${ch.for}`);
    else if (!(+e.monthly > 0)) add('error', 'plan', 'extra', `${ch.name} needs a monthly budget.`);
    else { extraTotal += +e.monthly; if (ch.desk && ch.id !== 'youtube') add('warn', 'extra', 'extra', `${ch.name} is a platform the Campaign Desk plans: give it a share of the plan's mix instead, so its money is in the forecast.`);
      if (ch.minDaily && +e.monthly / 30.4 < ch.minDaily) add('warn', 'extra', 'extra', `${ch.name} will not take a daily budget under ${$(ch.minDaily)}. ${$(e.monthly)} a month is ${$(+e.monthly / 30.4)} a day, or ${Math.floor(+e.monthly / ch.minDaily)} days at the floor: fund it properly or leave it out.`); }
  }
  if (extraTotal > 0) add('note', 'extra', 'extra', `${$(extraTotal)} a month goes to channels the Campaign Desk does not plan. It is on top of the plan's ${$(P.budget)}, ${$(P.budget + extraTotal)} a month in all, and it is outside the forecast: say both in the hand back.`);
  for (const x of c.confirmed || []) {
    if (!x || !x.claim || !x.by) add('error', 'confirmed', 'file', 'A confirmed claim needs what was confirmed ("claim") and who confirmed it ("by").', JSON.stringify(x));
    else if (CLAIM_TYPES.includes(String(x.claim).trim().toLowerCase())) add('error', 'confirmed', 'file', `A confirmation quotes the claim's own words ("same day"), not a kind of claim ("${x.claim}"): one answer cannot vouch for every claim of its kind.`, JSON.stringify(x));
  }
  stats.extraMonthly = extraTotal;

  /* what was asked to be set aside, by name */
  const asked = [...new Set((allow || []).map(ruleName).filter(Boolean))];
  const known = new Set(RULES.concat(pack.rules.rules.flatMap(r => ['rule:' + r.id, 'dashboard:' + r.id]), CLAIM_TYPES.map(t => 'claim:' + t), ['dashboard:desk', 'dashboard:forecast']));
  const unknownAllow = asked.filter(a => !known.has(a)), lifts = new Set(asked.filter(a => known.has(a))), can = f => f.severity !== 'error' || LIFTABLE.has(f.rule);
  const notLifted = [...new Set(F.filter(f => lifts.has(f.rule) && !can(f)).map(f => f.rule))], allowed = [...lifts].filter(a => F.some(f => f.rule === a && can(f)));
  for (const r of notLifted) add('note', 'allow', 'file', `${r} was not lifted. An error stays when it is a limit the platform enforces, a file the Campaign Desk would not take, a rule of law, or a claim the brand file contradicts.`);
  const kept = F.filter(f => !(lifts.has(f.rule) && can(f))).sort((a, b) => order[a.severity] - order[b.severity]), n = s => kept.filter(f => f.severity === s).length;
  const ps = stats.persuasion; stats.persuasion = ps.length ? Math.round(sum(ps) / ps.length * 10) / 10 : null;
  return { ok: n('error') === 0, counts: { error: n('error'), warn: n('warn'), note: n('note') }, findings: kept, stats, claims, reading: R, plan: dp.plan, allowed, lifts: [...lifts], notLifted, unknownAllow };
}

/* the gate's result as text */
export function report(g, name = '') {
  const s = g.stats, head = `${g.ok ? 'PASS' : 'FAIL'}${name ? '  ' + name : ''}  ·  ${s.campaigns} search campaign${s.campaigns === 1 ? '' : 's'}, ${s.adGroups} ad group${s.adGroups === 1 ? '' : 's'}, ${s.keywords} keywords, ${s.ads} ads  ·  persuasion ${s.persuasion == null ? 'n/a' : s.persuasion + ' of 6'}  ·  ${g.counts.error} error${g.counts.error === 1 ? '' : 's'}, ${g.counts.warn} warning${g.counts.warn === 1 ? '' : 's'}, ${g.counts.note} note${g.counts.note === 1 ? '' : 's'}`;
  const L = [head];
  /* the same finding in many ad groups is said once, with where */
  for (const sev of ['error', 'warn', 'note']) {
    const groups = new Map();
    for (const f of g.findings.filter(x => x.severity === sev)) { const k = f.rule + '|' + f.message; let x = groups.get(k); if (!x) groups.set(k, x = { f, where: [], excerpts: [] }); x.where.push(f.where); if (f.excerpt && !x.excerpts.includes(f.excerpt)) x.excerpts.push(f.excerpt); }
    for (const { f, where, excerpts } of groups.values()) {
      const tag = sev === 'error' ? 'ERROR' : sev === 'warn' ? 'warn ' : 'note ';
      if (where.length === 1) L.push(`${tag}  [${f.rule}] ${where[0]}: ${f.message}`);
      else L.push(`${tag}  [${f.rule}] in ${where.length} places: ${f.message}`, '         in: ' + where.slice(0, 8).join('; ') + (where.length > 8 ? `; and ${where.length - 8} more` : ''));
      if (excerpts.length > 1 && excerpts.every(e => String(e).length <= 60 && !String(e).includes('\n'))) L.push('         > ' + excerpts.slice(0, 12).join(' | ') + (excerpts.length > 12 ? ' | ...' : ''));
      else for (const e of excerpts.slice(0, where.length === 1 ? 3 : 2)) for (const line of String(e).split('\n').slice(0, 2)) L.push('         > ' + line.slice(0, 220));
      if (f.fix) L.push('         fix: ' + f.fix);
    }
  }
  const open = [...new Set(g.claims.filter(c => c.status === 'unconfirmed').map(c => `"${c.said}"`))];
  if (open.length) L.push('', `Claims nobody has vouched for (${open.length}): ` + open.slice(0, 20).join(', ') + (open.length > 20 ? ', ...' : ''));
  return L.join('\n');
}

/* the plan as the desk reads it, as text */
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* The flight as the desk cuts it, with what each month means for a flat daily budget. The desk counts a flight from noon of
   its first day, so one that ends on the last day of a month shows a stub of a day in the next: it is marked. */
export function flightOf(R) {
  const base = R.P.budget / 30.4;
  return R.flight.map(x => ({ month: MO[x.m], year: x.y, days: x.days, index: x.idx, spend: x.spend, daily: x.days ? x.spend / x.days : 0, against: base ? (x.days ? x.spend / x.days : 0) / base : 0, stub: x.days <= 1 && R.flight.length > 1 }));
}
export function planText(R, ctx) {
  const { P } = R, PL = ctx.pack.platforms, T = R.totals, g = k => (P.asm[k] || {}).g || '?', port = desk.ported(ctx.pack), FL = flightOf(R);
  const shop = ctx.brand && ctx.brand.geo && ctx.brand.geo.lat != null ? ctx.brand.geo : null, worth = lineTicket(ctx.pack, P.line, ctx.snapshot), social = PL.order.filter(p => !['google', 'microsoft', 'lsa'].includes(p)), socialBooked = sum(social.map(p => R.forecast[p].booked));
  return [
    `${(ctx.pack.lines[P.line] || {}).label || P.line}: ${$(P.budget)} a month for ${P.weeks} weeks from ${P.start}, ${R.markets.length} ZIP markets, ${Math.round(R.households).toLocaleString('en-US')} households.`,
    `Forecast a month (the Campaign Desk's own arithmetic on benchmarks it grades C and D, not a promise): ${Math.round(T.clicks).toLocaleString('en-US')} clicks, ${Math.round(T.leads)} leads, ${Math.round(T.booked)} booked jobs at ${P.bookRate}% lead to booked, ${R.costPerBooked ? $(R.costPerBooked) : 'n/a'} a booked job against a target of ${$(R.targetCostPerBooked)} (18% of a ${$(P.jobVal)} job).`,
    ...(worth && P.jobVal === (ctx.pack.defaults || {}).jobVal && (worth.ticket < P.jobVal / 2 || worth.ticket > P.jobVal * 2) ? [`NOTE ${$(P.jobVal)} a job is the figure the desk opens every plan with. The service line model puts ${worth.name.toLowerCase()} at ${$(worth.ticket)} (${worth.from}): pass --job-value so the target means something.`] : []),
    'Platforms:', ...PL.order.filter(p => R.forecast[p].spend > 0).map(p => { const f = R.forecast[p], A = P.asm[p]; return `  ${(PL.labels[p] || p).padEnd(24)} ${String(Math.round(100 * f.spend / (T.spend || 1))).padStart(3)}%  ${$(f.spend).padStart(8)}  ${String(Math.round(f.clicks)).padStart(6)} clicks  ${String(Math.round(f.leads)).padStart(4)} leads  ${f.booked.toFixed(1).padStart(6)} booked   assumes ${A.basis} ${$(A.cost)}${A.basis === 'CPL' ? '' : `, ${A.cvr}% to lead`} (grade ${g(p)})`; }),
    ...(T.booked > 0 && socialBooked / T.booked > 0.2 ? [`  NOTE ${Math.round(100 * socialBooked / T.booked)}% of the booked jobs above come from social and display platforms. The desk books a form fill there at the same rate as a search lead, which flatters them: do not move money toward them to raise this forecast.`] : []),
    ...R.floors.map(f => `  NOTE ${f.label} gets ${$(f.daily)} a day, under the Campaign Desk's ${$(f.min)} floor.`),
    `Flight (paced by ${R.season.from}): ` + FL.map(x => `${x.month} ${$(x.spend)}${x.stub ? ' (a one day stub: the desk counts from noon)' : ''}`).join(', '),
    `  The files carry a flat ${$(P.budget / 30.4)} a day. To follow the season instead, set the daily budget by month: ` + FL.filter(x => !x.stub).map(x => `${x.month} ${$(x.daily)}`).join(', ') + '.',
    `Markets (${R.languages.includes('es') ? R.markets.filter(m => m.es).length + ' pass the desk\'s Spanish threshold of ' + P.spanTh + '% of households, marked ES' : 'English only'}):`,
    ...R.markets.slice(0, 40).map(m => { const min = shop ? desk.minutesFrom(shop, m.z) : null; return `  ${m.z.zip} ${String(m.z.city).padEnd(18)} ${String(m.z.county).padEnd(9)} ${min == null ? '' : String(min).padStart(3) + ' min  '}tier ${String(m.z.tier).padEnd(2)} bid ${String((desk.bidOf(m.z, P) >= 0 ? '+' : '') + desk.bidOf(m.z, P) + '%').padStart(5)}  ${$(m.spend).padStart(7)}/mo  ${m.es ? `ES ${String(Math.round(m.z.span_sh)).padStart(2)}%` : '      '} ${m.angles.map(a => a.id).join(', ')}`; }),
    ...(R.markets.length > 40 ? [`  ... and ${R.markets.length - 40} more`] : []),
    '  "tier" is the paid model\'s grade of the market; "bid" is the plan\'s adjustment for the ZIP; dollars by ZIP are the desk\'s own weighting by opportunity, a planning view: a search campaign has one budget, and the bid adjustments steer it.',
    `Angles in play: ${R.angles.join(', ') || 'none'}.  Campaign negatives: ${R.negatives.length}.`,
    ...(port.same ? [] : [`NOTE The figures above are this toolkit's reading and may not be the dashboard's: ${port.why}. Load the plan in the Campaign Desk (or run check on it) and quote what the desk shows.`]),
  ].join('\n');
}

/* ---------- files ---------- */
const csvFile = (header, rows) => desk.BOM + desk.toCSV(header, rows);
/* Everything a passing campaign file becomes: {name: text}. Bulk files follow the Campaign Desk's own, with every campaign
   and every ad paused (ad groups, keywords and assets inside a paused campaign are enabled, and serve nothing until a
   person switches the campaign on). `handoff` is the note the plan file carries. */
export function files(file, g, ctx, handoff) {
  const R = g.reading, { P } = R, pack = ctx.pack, PL = pack.platforms, FC = R.forecast, out = {}, stamp = `${P.line}_${P.start}`, brand = ctx.brand || {};
  const shop = brand.geo && brand.geo.lat != null ? brand.geo : null;
  const planOut = Object.assign({}, g.plan); out['campaign-desk-plan.json'] = JSON.stringify(Object.assign(planOut, { handoff }), null, 1) + '\n';
  out['campaign-plan_' + stamp + '.csv'] = csvFile(['zip', 'city', 'county', 'minutes_from_shop', 'tier', 'bid_modifier', 'desk_monthly_usd', 'spanish', 'angles_with_demand'], R.markets.map(m => [m.z.zip, m.z.city, m.z.county, shop ? desk.minutesFrom(shop, m.z) : '', m.z.tier, desk.bidOf(m.z, P), Math.round(m.spend), m.es ? 'yes' : '', m.angles.map(a => a.short).join('; ')]));
  const S = file.search || [];
  for (const [plat, name] of [['google', 'google-ads-editor_'], ['microsoft', 'microsoft-ads_']]) { if (!(FC[plat].spend > 0) || !S.length) continue; const rows = desk.searchRows(S, plat, R, ctx); out[name + stamp + '.csv'] = csvFile(desk.searchHeader(rows), rows); }
  const ads = file.ads || [], socialOf = (channel, plat) => ads.filter(a => a.channel === channel).map(a => ({ channel: plat, angle: a.angle, lang: a.lang || 'en', name: a.name, headline: text(a.headline) || text((a.headlines || [])[0]) || '', primary: text(a.primary) || text(a.body) || text(a.text) || (a.descriptions || []).map(text).join(' '), description: text(a.description) || '', cta: a.cta, url: a.url }));
  for (const [channel, plat, name] of [['meta', 'meta', 'meta-build-sheet_'], ['demand_gen', 'dg', 'demand-gen-build-sheet_'], ['nextdoor', 'nextdoor', 'nextdoor-build-sheet_'], ['yelp', 'yelp', 'yelp-build-sheet_']]) {
    const list = socialOf(channel, plat); if (!list.length) continue; const rows = desk.socialRows(list, plat, R, ctx);
    const withDesc = plat === 'meta' && list.some(x => x.description); if (withDesc) rows.forEach((r, i) => { r['Link Description'] = list[i].description || ''; });
    rows.forEach(r => { r['Platform monthly budget'] = Math.round(FC[plat].spend); });
    const at = desk.SOCIAL_COLS_OUT.indexOf('Link'), cols = desk.SOCIAL_COLS_OUT.slice(0, at).concat(withDesc ? ['Link Description'] : [], desk.SOCIAL_COLS_OUT.slice(at), ['Platform monthly budget']);
    out[name + P.start + '.csv'] = csvFile(cols, rows);
  }
  const lsa = ads.find(a => a.channel === 'lsa');
  if (lsa) out['lsa-build-sheet_' + P.start + '.csv'] = csvFile(['Field', 'Value'], [['Business name', P.brand], ['TDLR license', P.lic], ['Phone', desk.phoneFmt(P.phone)], ['Weekly budget', Math.round(FC.lsa.spend / 4.345)], ['Job types', (lsa.jobTypes || []).join('; ')], ['Service ZIPs', R.markets.map(m => m.z.zip).join(' ')], ['Spanish', R.markets.some(m => m.es) ? 'on' : 'off'], ['Bio', text(lsa.bio)], ['Documents to upload', 'TDLR license, certificate of general liability insurance, business registration'], ['Hours', brand.hours ? `the hours the phone is answered: ${brand.hours}` : 'set to the hours actually staffed']]);
  const li = ads.find(a => a.channel === 'linkedin');
  if (li) out['linkedin_' + P.start + '.csv'] = csvFile(['Campaign Group', 'Campaign', 'Objective', 'Locations', 'Intro text', 'Headline', 'Description', 'Call to Action', 'Status'], [[li.angle === 'recruit' ? 'DFW Recruiting' : 'DFW ' + P.line, desk.campName(P, 'linkedin', li.lang || 'en'), li.angle === 'recruit' ? 'Job applicants' : 'Lead generation', 'Dallas Fort Worth Area', text(li.intro), text(li.headline), text(li.description), li.cta || '', 'Paused']]);
  /* every other channel: one build sheet, a row a field */
  const other = ads.filter(a => !channelToDesk(a.channel) && byId(a.channel));
  if (other.length) {
    const rows = []; for (const a of other) { const ch = byId(a.channel), fm = bookFormat(ch, a.format || ''), budget = (file.extra || []).find(e => e.channel === a.channel);
      for (const [k, spec] of Object.entries((fm && fm.fields) || {})) for (const v of (Array.isArray(a[k]) ? a[k] : a[k] == null ? [] : [a[k]])) rows.push([ch.name, fm.name, a.name || a.angle || '', spec.label, text(v), chars(text(v)), spec.max || spec.rec || '', a.cta || '', budget ? Math.round(budget.monthly) : '', a.channel === 'eddm' ? 'carrier routes inside: ' + R.markets.map(m => m.z.zip).join(' ') : R.markets.map(m => m.z.zip).join(' '), 'Paused']); }
    out['other-channels-build-sheet_' + P.start + '.csv'] = csvFile(['channel', 'format', 'ad', 'field', 'text', 'characters', 'limit', 'button', 'monthly_usd', 'zips', 'status'], rows);
  }
  /* the keyword and creative ledgers */
  const kwRows = []; for (const c of S) { for (const gp of c.adGroups || []) for (const k of gp.keywords || []) kwRows.push([c.lang, gp.name, k.text, k.match, kw.intent(k.text)]); for (const n of c.negatives || []) kwRows.push([c.lang, 'Campaign negatives', n, 'negative phrase', '']); }
  if (kwRows.length) out['keywords_' + stamp + '.csv'] = csvFile(['language', 'ad_group', 'keyword', 'match_type', 'intent'], kwRows);
  const cr = []; for (const c of S) for (const gp of c.adGroups || []) { if (!gp.ad) continue; (gp.ad.headlines || []).forEach(h => cr.push(['Google Search', c.lang, gp.name, 'headline', text(h), chars(text(h)), 30, typeof h === 'object' && h.pin ? h.pin : ''])); (gp.ad.descriptions || []).forEach(d => cr.push(['Google Search', c.lang, gp.name, 'description', text(d), chars(text(d)), 90, typeof d === 'object' && d.pin ? d.pin : ''])); }
  for (const a of ads) { const ch = byId(a.channel), fm = ch && bookFormat(ch, a.format || ''); if (!fm) continue; for (const [k, spec] of Object.entries(fm.fields)) for (const v of (Array.isArray(a[k]) ? a[k] : a[k] == null ? [] : [a[k]])) cr.push([ch.name, a.lang || 'en', a.name || a.angle || '', spec.label.toLowerCase(), text(v), chars(text(v)), spec.max || '', '']); }
  if (cr.length) out['creative_' + stamp + '.csv'] = csvFile(['channel', 'language', 'ad', 'type', 'text', 'characters', 'limit', 'pinned'], cr);
  out['campaign.json'] = JSON.stringify(file, null, 1) + '\n';
  return out;
}

/* What to do with the folder, for the person who gets it. `check` is what the running dashboard made of the plan (or
   null when it was not tried). Everything the gate left open is listed here by name: a README that says less than the
   gate knew would be the one place the person looks. */
export function readme(file, g, ctx, names, check) {
  const R = g.reading, { P } = R, T = R.totals, target = R.targetCostPerBooked, lineId = desk.NAME_LINE[P.line] || P.line, PL = ctx.pack.platforms, FC = R.forecast, brand = ctx.brand || {}, FL = flightOf(R);
  const open = [...new Set(g.claims.filter(c => c.status === 'unconfirmed').map(c => `"${c.said}"`))], dated = [...new Set(g.claims.filter(c => c.status === 'on-file' && ['reviews', 'price'].includes(c.type)).map(c => `"${c.said}"`))];
  const warns = new Map(); for (const f of g.findings.filter(x => x.severity === 'warn' && !x.rule.startsWith('claim:'))) warns.set(f.rule, (warns.get(f.rule) || 0) + 1);
  const has = re => names.find(n => re.test(n)), S = file.search || [], sh = S.length > 1 ? desk.languageShares(S, R) : null, clicks = S.some(c => desk.biddingOf(c) === desk.BIDDING.clicks), extra = (file.extra || []).filter(e => e && +e.monthly > 0), extraTotal = sum(extra.map(e => e.monthly)), H = file.heat;
  const kp = check && check.kpis ? Object.entries(check.kpis).filter(([k]) => /Leads|Booked jobs|Monthly media/.test(k)).map(([k, v]) => `${k.toLowerCase()} ${v.value}`).join(', ') : '';
  return [
    `# ${file.name || 'Campaign'}`, '',
    `Built for the ${ctx.pack.atlas}. ${$(P.budget)} a month for ${P.weeks} weeks from ${P.start} to ${desk.lastDay(P)}, in ${R.markets.length} ZIP markets.${extraTotal ? ` On top of that, ${$(extraTotal)} a month goes to ${extra.map(e => (byId(e.channel) || {}).name || e.channel).join(', ')}, which the dashboard does not plan: ${$(P.budget + extraTotal)} a month in all.` : ''}`,
    `Forecast a month, on the Campaign Desk's own benchmarks (graded C and D, so a starting point and not a promise): ${Math.round(T.leads)} leads, ${Math.round(T.booked)} booked jobs, ${R.costPerBooked ? $(R.costPerBooked) : 'n/a'} a booked job.${extraTotal ? ' The channels outside the desk are not in this forecast.' : ''}`,
    ...(H ? [`The Heat Desk, the dashboard's own model for heating, reckoned its plan for ${H.month} (${H.zips} ZIPs, ${$(H.spent)}) at ${H.leads} leads and ${H.jobs} booked jobs, ${$(H.costPerJob)} a job (grade ${H.grade}). It weighs drive time, cold and competition by ZIP, which the Campaign Desk does not, so for heating it is the better guide.${H.same ? '' : ' This campaign changed that plan (its markets, its money or its split), so the figure is a reference and not a forecast of what is in this folder.'}`] : []), '',
    '## Nothing here spends money', '',
    'Every campaign and every ad in these files is paused. Ad groups, keywords and assets inside them are enabled, and serve nothing until a person switches the campaign on. Nothing was sent to any ad account. A person imports each file, reads it, and switches it on.', '',
    '## The dashboard', '',
    'Open the dashboard, go to the Campaign Desk (module 08), press ⤒ Load and choose `campaign-desk-plan.json`. The desk then shows this plan: the markets, the split, the forecast and the flight.',
    check ? (check.accepted ? `This was tried against the running dashboard when the folder was built: the desk took the plan and showed ${kp}.${check.agrees === false ? ' Those figures differ from the forecast above: quote the dashboard\'s.' : ''}` : `When the folder was built the running dashboard did not take the plan ("${check.verdict}"). Do not load it until that is understood.`) : 'The plan was not tried against the running dashboard (no browser was on the machine that built this).',
    'The desk writes its own ad copy from its library, so the copy in these files will not appear there. The files below carry the copy.', '',
    '## The files', '',
    ...[[/^google-ads-editor/, 'Google Ads Editor: Account, Import, From file. Review the proposed changes, post, and leave everything paused until the checks below are done.'], [/^microsoft-ads/, 'Microsoft Advertising: import the same sheet, or import the Google campaigns once they are live and then set Microsoft\'s own budget.'], [/^meta-build-sheet/, 'Meta: a build sheet, not an import file. Build the campaign in Ads Manager from it: one ad set a language with every ad of that language inside, so the budget is not split thin. A row marked with a special ad category runs on a radius, not on ZIP codes.'], [/^lsa-build-sheet/, 'Local Services Ads: the profile, job types, service ZIPs and weekly budget to enter.'], [/^demand-gen/, 'Demand Gen: the build sheet for Google Ads.'], [/^nextdoor/, 'Nextdoor Ads Manager: the build sheet.'], [/^yelp/, 'Yelp Ads: the build sheet.'], [/^linkedin/, 'LinkedIn Campaign Manager: the build sheet.'], [/^other-channels/, 'Channels the dashboard does not plan: build each by hand in its own platform, paused, and check every limit there.'], [/^keywords_/, 'Every keyword with its ad group, match type and intent. No volumes and no click prices: price the set in Keyword Planner inside the account.'], [/^creative_/, 'Every line of copy with its length, its limit and its pin.'], [/^campaign-plan_/, 'The markets: minutes from the shop, bid adjustment, and the desk\'s own dollars by ZIP (a planning view: the campaign has one budget). The angles column says where the dashboard\'s model finds demand; a search campaign runs every ad group in every ZIP.'], [/^report\.json/, 'What the gate measured, every finding, and every claim with who vouched for it.']].filter(([re]) => has(re)).map(([re, what]) => `- \`${has(re)}\`: ${what}`), '',
    '## Before anything is switched on', '',
    ...(g.allowed && g.allowed.length ? [`- These rules were set aside for this build because someone asked: ${g.allowed.join(', ')}. Know why before you launch.`] : []),
    ...(open.length ? [`- Confirm these claims with the owner or cut them: ${open.join(', ')}.`] : ['- No claim in the copy is waiting for the owner\'s word.']),
    ...(dated.length ? [`- These are on file with a date or without one, and may have moved since: ${dated.join(', ')}. Match them to the live profile and the current offer.`] : []),
    ...(warns.size ? [`- The gate left ${[...warns.values()].reduce((a, b) => a + b, 0)} warnings in: ${[...warns].map(([r, n]) => `${r}${n > 1 ? ' (' + n + ')' : ''}`).join(', ')}. Each is in \`report.json\` with its reason.`] : []),
    '- Check that each landing page is live, says what the ad says, and carries the license number.',
    ...(clicks ? [`- Bidding: the search campaigns ask for Maximize clicks with a maximum CPC bid limit, because that is where the ZIP bid adjustments in the plan are in force. Check both in each campaign's bidding settings after the import. Google's Smart Bidding (Maximize conversions, Target CPA) does not use bid adjustments, so the ZIPs stop being weighted the day the strategy changes: change it once the account has about 30 conversions in 30 days, and know what it costs.`] : []),
    ...(sh && sh.es ? [`- Languages: the Spanish campaign gets ${Math.round(sh.es * 100)}% of each search platform's money (${$(FC.google.spend * sh.es / 30.4)} a day on Google) and the English one the rest. Run the Spanish campaign only if the phone is answered in Spanish and the page it lands on is in Spanish.`] : []),
    `- Ad schedule: the files set none. ${brand.hours ? `Run call ads in the hours the phone is answered (${brand.hours}).` : 'Run call ads only in the hours the phone is answered.'}`,
    `- Set up conversions first: calls from ads of 60 seconds or more, calls from the site through a forwarding number, form submits on the thank you page, ${FC.lsa && FC.lsa.spend > 0 ? 'Local Services leads, ' : ''}and booked jobs imported weekly with their value.`,
    '- Price the keywords in Keyword Planner. The dashboard holds no search volumes and no auction prices.', '',
    '## Running it', '',
    `- Campaigns are named DFW_${lineId.toUpperCase()}_<PLATFORM>_<LANGUAGE>_${P.start.replace(/-/g, '')} (Microsoft's end in _MS, a Meta special ad category campaign in _SAC). Keep the names: the dashboard's Accounts module files results under a service line by reading them.`,
    '- Tracking on every landing URL and sitelink: utm_source, utm_medium=cpc, utm_campaign, utm_content.',
    `- Budget: the files carry a flat daily budget (${$(P.budget / 30.4)} a day across the plan). The dashboard paces this flight by season (${R.season.from}): ${FL.filter(x => !x.stub).map(x => `${x.month} ${$(x.daily)} a day`).join(', ')}. Raise and lower the daily budgets by month to follow it, or hold them flat and say so.`,
    `- Target cost a booked job: ${$(target)} (18% of a ${$(P.jobVal)} job). Pause an ad group after 40 clicks with no booked job, or when cost a booked job runs above ${$(target * 2)} for two weeks.`,
    P.line === 'heat' || P.angles.includes('heattune') ? '- Freeze rule (the dashboard\'s): a forecast low of 20°F or less switches heating repair ads on across all markets for 72 hours; replacement quotes wait. The Heat Desk reads the week.' : '- Heat wave rule (the dashboard\'s): three or more forecast 100°F days lift Search and Local Services 25% for the week.',
    '- After 60 to 90 days replace the starting bid adjustments with the observed cost a booked job by ZIP, and send the account results back through the dashboard\'s Accounts module.',
  ].join('\n') + '\n';
}
export { slug, CHANNELS, forDesk };
