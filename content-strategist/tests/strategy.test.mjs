/* lib/strategy.mjs and the Content Strategist module: one content plan from everything the dashboard holds. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ok, done, json, FX, ROOT } from './_t.mjs';
import { strategy, planText, competitionText, cityStrategy, cityStrategyText, whyWork, workTitle, monthName, STRATEGY } from '../lib/strategy.mjs';
import { loadPack } from '../lib/atlas.mjs';
import { fromFile, inventory } from '../lib/sitemap.mjs';
import { installPanel, stripPanel, EXTRA } from '../../dashboard-link/lib/panel.mjs';
import { consolePayloads } from '../lib/atlas.mjs';

const pack = loadPack('dfw'), brand = Object.assign({}, json('brand.json'), { geo: { lat: 32.77, lon: -96.6 } }), inv = inventory(fromFile(path.join(FX, 'sitemap.xml'), brand.url), { pack, brand });
const plano = pack.cities.find(c => c.name === 'Plano'), frisco = pack.cities.find(c => c.name === 'Frisco');

/* what the dashboard link keeps for a client, made small: three companies, two service lines, the ZIP codes of two cities */
const months = (peak) => [...Array(12)].map((_, i) => 50 + (i + 1 === peak ? 150 : 0));
const line = (id, name, svc, angle) => ({ id, name, short: name, kind: 'base', angle, svc, hooks: ['The price before the work starts'] });
const paid = { service: { lines: [line('repair', 'Air conditioning repair', ['AC repair'], 'repair'), line('replace', 'Air conditioner replacement', ['AC replacement', 'AC installation'], 'replace'), line('landlord', 'Rental homes', ['AC repair'], 'landlord')] } };
const zl = {}; for (const [c, k] of [[plano, 1], [frisco, 2]]) for (const z of c.zips) zl[z] = { lines: { repair: [1000 * k, 400000 * k, 80 / k, 60, 0, 0], replace: [200 * k, 1500000 * k, 70 / k, 75, 0, 0], landlord: [50, 20000, 50, 50, 0, 0] } };
const live = { at: '2026-11-01T00:00:00Z', slm: { lines: [{ id: 'repair', months: months(8), unit: { ticket: 489.2, margin: 62, close: 70, gpPerJob: 300, cpl: 127.2 }, totals: { jobs: 600000, grossProfit: 2e8, competitors: 200, competitorsPaid: 30 } }, { id: 'replace', months: months(7), unit: { ticket: 14000, margin: 42, close: 40, gpPerJob: 5000, cpl: 400 }, totals: { jobs: 170000, grossProfit: 9e8, competitors: 160, competitorsPaid: 25 } }, { id: 'landlord', months: months(8), unit: { ticket: 1100, margin: 50, close: 50, gpPerJob: 500, cpl: 200 }, totals: { jobs: 160000, grossProfit: 8e7, competitors: 240, competitorsPaid: 30 } }], zips: zl } };
const model = { zips: [...plano.zips.map(z => ({ zip: z, lat: plano.lat, lon: plano.lon, sys: 1000, cpc_rel: 1.4 })), ...frisco.zips.map(z => ({ zip: z, lat: frisco.lat, lon: frisco.lon, sys: 1000, cpc_rel: 0.9 })), { zip: '76049', lat: 32.44, lon: -97.79, sys: 1000, cpc_rel: 1 }] };
const competitors = { asOf: '2026-08-18', companies: [
  { key: 'self', name: 'Example Air', self: true, cities: ['Mesquite'], zips: [], reviews: 700, rating: 4.9, services: ['AC repair'] },
  { key: 'a', name: 'Plano Cooling Co', self: false, tier: 'roster', cities: ['Plano'], zips: [plano.zips[0]], reviews: 900, rating: 4.8, paidKeywords: 0, services: ['AC repair'], scope: 'local', intel: null },
  { key: 'b', name: 'Metro Giant Air', self: false, tier: 'top40', cities: ['Dallas'], zips: [], reviews: 20000, rating: 4.7, paidKeywords: 3, services: ['AC repair', 'AC replacement'], scope: 'metro-wide', intel: { tagline: 'Since 1950', financing: '0% for 60 months', promos: '$79 tune up', membership: '-' } },
  { key: 'c', name: 'Far Away Air', self: false, tier: 'roster', cities: ['Granbury'], zips: ['76049'], reviews: 300, rating: 4.9, paidKeywords: 0, services: ['AC replacement'], scope: 'local', intel: null }] };

const S = strategy({ pack, brand, inv, link: { competitors, model, live, paid }, now: new Date('2026-11-17T12:00:00Z') });
ok(S.format === STRATEGY && S.reads.heatmaps && S.reads.lines && S.reads.competitors === 3 && S.reads.paid && S.reads.sitemap && S.site.pages === inv.length && S.client.short === brand.short, 'the plan says what it read: the heatmaps, Service Lines, Competitor Watch, the click costs and the sitemap', S.reads);

/* ---- the service lines ---- */
const rep = S.lines.find(l => l.id === 'repair'), rpl = S.lines.find(l => l.id === 'replace');
ok(rep.peak === 8 && rep.publishBy === 6 && rpl.peak === 7 && rpl.publishBy === 5 && monthName(rep.publishBy) === 'June' && rep.unit.ticket === 489 && rep.unit.margin === 62 && rep.totals.competitors === 200 && rep.angle === 'repair' && S.lines.find(l => l.id === 'landlord').b2b, 'each line carries its ticket and margin, its peak month, and the month a page must be live by: two months ahead', [rep.peak, rep.publishBy]);
ok(monthName(1 - 2 + 12) === 'November' && strategy({ pack, brand, inv, link: { competitors, model, live: { slm: { lines: [{ id: 'repair', months: months(1), unit: live.slm.lines[0].unit, totals: live.slm.lines[0].totals }], zips: zl } }, paid } }).lines[0].publishBy === 11, 'a line that peaks in January goes live by November');

const N = strategy({ pack, brand: Object.assign({}, brand, { services: ['AC repair'] }), inv, link: { competitors, model, live, paid } }), nl = id => N.lines.find(l => l.id === id);
ok(rep.offered === true && rpl.offered === true && nl('repair').offered === true && nl('replace').offered === false && /does not list this service/.test(whyWork(N.works.find(w => w.l === 'replace' && w.t === 'service-city'), N).join(' ')) && !/does not list/.test(whyWork(N.works.find(w => w.l === 'repair' && w.t === 'service-city'), N).join(' ')), 'a line the client does not list among its own services is flagged on every work for it', [nl('repair').offered, nl('replace').offered]);

/* ---- the cities ---- */
const P = S.cities.find(c => c.name === 'Plano'), F = S.cities.find(c => c.name === 'Frisco');
ok(P.inAtlas && P.served && P.hub.endsWith('/plano-hvac/') && P.built === 1993 && P.lead.includes('flex-duct') && P.heating.lead === 'mixed' && P.zips.length === 7 && P.miles > 5 && P.facts.length >= 7 && P.fires.repair === 100, 'a city carries what the heatmaps say about it, its page on the site and its distance from the shop', [P.hub, P.miles]);
ok(P.lines.repair[0] === Math.round(7000 * P.coverage) && P.lines.repair[2] === 80 && P.lines.repair[3] === 60 && F.lines.repair[2] === 40 && P.cpc === 1.4 && F.cpc === 0.9, 'and each service line there: jobs and gross profit scaled to the part of its ZIP codes the city fills, the dashboard\'s own pressure and priority, and what a click costs', P.lines.repair);
ok(P.comp.inTown === 1 && P.comp.near === 1 && P.comp.metro === 1 && P.comp.paid === 1 && P.comp.byLine.repair === 2 && P.comp.byLine.replace === 1 && !P.comp.top.some(([i]) => S.competitors.find(c => c.i === i).name === 'Far Away Air') && S.competitors.every(c => c.name !== 'Example Air'), 'who works the city: based in it, within reach, or working the whole metro; a company far away is not counted, and the client is not its own rival', P.comp);
ok(S.competitors.find(c => c.name === 'Metro Giant Air').lines.join() === 'repair,replace,landlord' && S.competitors.find(c => c.name === 'Far Away Air').lines.join() === 'replace', 'a company sells the lines its services match');

/* ---- the works ---- */
const W = id => S.works.find(w => w.id === id), cityW = W('city:Plano'), pr = W('line:Plano:repair'), fr = W('line:Frisco:repair'), prl = W('line:Plano:replace');
ok(cityW && cityW.t === 'city' && cityW.st === 'page' && cityW.u.endsWith('/plano-hvac/') && cityW.kw === 'ac repair plano' && cityW.jobs === P.lines.repair[0], 'a city with a page gets a city work that would be a rewrite of it');
ok(pr.st === 'gap' && pr.kw === 'ac repair plano' && pr.pub === 6 && pr.cn === 2 && fr.st === 'page' && fr.u.endsWith('/ac-repair-frisco-tx/') && prl.kw === 'hvac system replacement plano' && !S.works.some(w => w.l === 'landlord' && w.t === 'service-city'), 'one work for each line in each city where the dashboard finds demand, with its keyword, the rivals who sell it and what the site holds; a line that is not for homeowners gets no city page', [pr.st, fr.st, fr.u]);
ok(S.works.some(w => w.t === 'service' && w.l === 'repair' && w.st === 'page' && w.u.endsWith('/ac-repair/')) && S.works.filter(w => w.t === 'post' && w.l === 'repair').length === 3 && S.works.find(w => w.t === 'post' && /blowing warm air/.test(w.kw)).st === 'page', 'the service page for the whole market, and the questions people ask, each weighed against the site');
ok(S.works.every((w, i) => !i || S.works[i - 1].sc >= w.sc) && pr.sc > 0 && pr.sc <= 100 && [pr, prl, fr].every(w => w.val >= 0 && w.val <= 100), 'the works come best first, each with a score out of 100');
const same = { val: 60, pri: 70, prs: 30 }, sc = st => Math.round(S.mark[st] * (0.5 * same.val + 0.3 * same.pri + 0.2 * (100 - same.prs)));
ok(sc('gap') > sc('hub') && sc('hub') > sc('page') && sc('page') > sc('built') && pr.sc === Math.round(S.mark.gap * (0.5 * pr.val + 0.3 * pr.pri + 0.2 * (100 - pr.prs))), 'the score is half the money, three tenths the dashboard\'s priority, two tenths a thin field, marked down as the site comes to hold the keyword');
const B = strategy({ pack, brand, inv, link: { competitors, model, live, paid }, built: [{ slug: 'ac-repair-frisco-tx', url: fr.u, city: 'Frisco', keyword: 'ac repair frisco', title: 'AC Repair in Frisco', words: 800, grade: 6.5 }, { slug: 'plano', url: cityW.u, city: 'Plano', keyword: 'ac repair plano' }] });
ok(B.works.find(w => w.id === 'line:Frisco:repair').st === 'built' && B.works.find(w => w.id === 'city:Plano').st === 'built' && B.built.length === 2 && B.reads.built === 2 && B.works.find(w => w.id === 'line:Frisco:repair').sc < fr.sc, 'a page the agent has built and not published is marked as built, and scores lowest');
const out = strategy({ pack, brand, inv: [...inv, { url: 'https://www.example-air.test/atlantis-hvac/', key: 'example-air.test/atlantis-hvac', path: '/atlantis-hvac/', kind: 'location', place: 'Atlantis', tokens: ['hvac'], angles: [] }], link: { competitors, model, live, paid } });
ok(out.cities.find(c => c.name === 'Atlantis').inAtlas === false && out.works.find(w => w.id === 'city:Atlantis').jobs === null && out.works.find(w => w.id === 'city:Atlantis').sc === 0, 'a city the site serves outside the mapped area is in the plan with no figures');

/* ---- with less to read ---- */
const bare = strategy({ pack, brand, inv: [], link: {} });
ok(!bare.reads.lines && !bare.reads.competitors && !bare.reads.sitemap && bare.works.every(w => w.t === 'city' && w.st === 'gap') && /Service Lines NOT read/.test(planText(bare)) && /NO sitemap/.test(planText(bare)), 'with no dashboard connected and no sitemap the plan still lists the city pages, and says what it could not read');

/* ---- as text ---- */
const T = planText(S, { top: 5 }), TP = planText(S, { city: 'plano', type: 'service-city' });
ok(/^CONTENT PLAN /.test(T) && /Read from: the heatmaps; Service Lines/.test(T) && /no search volumes/.test(T) && T.split('\n').filter(l => /^\s+\d+\.\s/.test(l)).length === 5 && /more\. Narrow with --city/.test(T), 'plan prints the best works and says how the score is made and that there are no search volumes');
ok(/Air conditioning repair in Plano/.test(TP) && /keyword: ac repair plano/.test(TP) && /nothing on the site/.test(TP) && /live by June/.test(TP) && !/Frisco/.test(TP), 'narrowed to one city and one kind of piece');
const why = whyWork(pr, S).join(' ');
ok(/jobs a year/.test(why) && /priority for it here is 60 of 100/.test(why) && /2 companies in reach of Plano sell this service/.test(why) && /peaks in August, so the page should be live by June/.test(why) && /costs about 40% more/.test(why) && /No live page holds this keyword/.test(why) && workTitle(pr, S) === 'Air conditioning repair in Plano', 'why a work stands where it does, in sentences', why);
const CT = competitionText(S, 'Plano');
ok(/^COMPETITION {2}Plano, Collin County {2}· {2}1 based in town, 1 within 12 miles, 1 more working the whole metro, 1 running paid search/.test(CT) && /Air conditioning repair\s+2 sell it/.test(CT) && /Metro Giant Air/.test(CT) && /pushes: financing: 0% for 60 months {2}\| {2}offers: \$79 tune up$/m.test(CT) && /Never name a competitor on a page/.test(CT) && /not a city in this plan/.test(competitionText(S, 'Nowhere')), 'competition for a city: who is in reach, line by line, what they push (a dashed field is not an offer), and the rule about naming them', CT.split('\n')[0]);
const cs = cityStrategy(S, 'Plano'), CS = cityStrategyText(cs, 'Plano');
ok(cs.works.length >= 2 && cs.works[0].score >= cs.works[1].score && cs.competitors.top.length === 2 && cs.clickCost === 1.4 && /THE WORKS WORTH WRITING HERE/.test(CS) && /WHO THE PAGE IS UP AGAINST/.test(CS) && !/WHO THE PAGE/.test(cityStrategyText(cs, 'Plano', { roster: false })) && cityStrategy(S, 'Atlantis') === null, 'the part of the plan a city\'s brief carries');

/* ---- the Content Strategist module, in a dashboard ---- */
const def = EXTRA.find(m => m.key === 'strategist'), js = fs.readFileSync(path.join(def.dir, def.js), 'utf8'), css = fs.readFileSync(path.join(def.dir, def.css), 'utf8');
ok(def.dir === path.join(ROOT, 'desk') && !/<\/script/i.test(js) && !js.includes('<!--') && !/<\/style/i.test(css) && (() => { try { new vm.Script(js); return true; } catch { return false; } })(), 'the module is a script and a style sheet in this agent\'s own folder, safe to put inside a page');
ok(/registerModule\(\{\s*key: KEY, num: NUM, title: 'Content Strategist'/.test(js) && ['plan', 'city', 'keywords', 'competition', 'pages', 'sources'].every(v => js.includes(`['${v}', `)) && js.includes("format !== 'leviathan.content-strategy'") && /typeof registerModule !== 'function'/.test(js), 'it registers as a module of its own, with its six views, and does nothing in a file that has no module system or no plan');
const atlas = consolePayloads().find(p => p.id === 'dfw').text, withIt = installPanel(atlas, { modules: [{ key: 'strategist', data: Object.assign({}, S, { note: '</script><b>x' }) }], at: '2026-11-17T00:00:00Z' });
const data = JSON.parse(/<script type="application\/json" id="lvc-data">([\s\S]*?)<\/script>/.exec(withIt)[1]);
ok(withIt.includes('<style id="lvc-style">') && data.format === STRATEGY && data.works.length === S.works.length && data.note === '</script><b>x' && withIt.indexOf('id="lvc-data"') > withIt.indexOf('id="lvp-data"') && stripPanel(withIt) === atlas && !installPanel(atlas, {}).includes('lvc-data'), 'the panel block carries it after the Agent Desk, with the plan as data that cannot break out of its script; take the block out and the dashboard is the original; with no plan on file it is not added');
ok((() => { try { installPanel(atlas, { modules: [{ key: 'nope', data: {} }] }); return false; } catch { return true; } })(), 'a module the panel does not know is refused');
ok(JSON.stringify(S).length < 1.2e6 && JSON.stringify(strategy({ pack, brand, inv, link: { competitors, model, live, paid } }).works[0]).length < 400, 'the whole plan is small enough to ride in the file', JSON.stringify(S).length);
done();
