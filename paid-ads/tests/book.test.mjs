/* channels/book.mjs: the channel book holds together, and says what was verified. */
import { ok, done, atlas } from '../../dashboard-link/tests/_t.mjs';
import { CHANNELS, LAW, READ, REQUIRED, WORDS_PER_SECOND, byId, forDesk, format } from '../channels/book.mjs';
import { DESK_TO_CHANNEL, channelToDesk } from '../lib/campaign.mjs';
import { library } from '../../dashboard-link/lib/read.mjs';

const ids = CHANNELS.map(c => c.id), KINDS = ['emergency', 'considered', 'maintenance', 'b2b', 'recruiting'];
ok(CHANNELS.length >= 25 && new Set(ids).size === ids.length && ids.every(i => /^[a-z][a-z0-9_]*$/.test(i)) && /^\d{4}-\d{2}-\d{2}$/.test(READ), `${CHANNELS.length} channels, each with its own id; the book says the day it was read`, READ);
const thin = CHANNELS.filter(c => !(c.name && c.group && c.for && ['open', 'closed'].includes(c.status) && Array.isArray(c.formats) && Array.isArray(c.rules) && Array.isArray(c.read) && KINDS.every(k => Number.isInteger(c.fits[k]) && c.fits[k] >= 0 && c.fits[k] <= 3) && Object.keys(c.fits).length === 5)).map(c => c.id);
ok(thin.length === 0, 'every channel says what it is for, whether it is open, and how well it fits five kinds of work', thin);
const open = CHANNELS.filter(c => c.status === 'open'), closed = CHANNELS.filter(c => c.status === 'closed');
ok(open.every(c => c.buy && c.geo && c.floor && c.formats.length > 0 && c.measure) && closed.map(c => c.id).join() === 'apple_maps,waze,retail_media' && closed.every(c => c.formats.length === 0 && KINDS.every(k => c.fits[k] === 0) && /bars|stopped|cannot|neither/i.test(c.for)), 'an open channel says how it is bought, targeted, entered and measured; a closed one has no format, fits nothing and says why');
ok(new Set(CHANNELS.map(c => c.group)).size >= 6 && ['Search', 'Social', 'Video and display', 'Local leads', 'Television and audio'].every(g => CHANNELS.some(c => c.group === g)), 'the groups cover search, social, video and display, local lead services, television and audio, and offline');

/* ---- formats and their fields ---- */
const bad = [];
for (const c of CHANNELS) { const fids = c.formats.map(f => f.id); if (new Set(fids).size !== fids.length) bad.push(c.id + ': a format id twice');
  for (const f of c.formats) { if (!f.id || !f.name || !f.fields) bad.push(`${c.id}.${f.id}: no name or fields`);
    for (const [k, s] of Object.entries(f.fields || {})) { if (!s.label || !['A', 'B', 'C', 'D'].includes(s.grade)) bad.push(`${c.id}.${f.id}.${k}: no label or grade`); if (s.max != null && !(Number.isInteger(s.max) && s.max > 0)) bad.push(`${c.id}.${f.id}.${k}: max`); if (s.rec != null && s.max != null && s.rec > s.max) bad.push(`${c.id}.${f.id}.${k}: rec over max`); if (s.count && !(s.count.length === 2 && s.count[0] >= 1 && s.count[0] <= s.count[1])) bad.push(`${c.id}.${f.id}.${k}: count`); }
    if (f.seconds && !(f.seconds.every(n => n > 0) && f.fields.script)) bad.push(`${c.id}.${f.id}: seconds without a script`);
    for (const list of [f.cta, f.ctaAll, c.cta, c.ctaAll]) if (list && !(Array.isArray(list) && list.every(x => typeof x === 'string' && x))) bad.push(`${c.id}.${f.id}: buttons`); }
  const all = c.ctaAll, pick = c.cta; if (all && pick && !pick.every(p => all.some(a => a.toLowerCase() === p.toLowerCase()))) bad.push(c.id + ': a recommended button the channel does not offer');
  for (const f of c.formats) if (f.ctaAll && f.cta && !f.cta.every(p => f.ctaAll.some(a => a.toLowerCase() === p.toLowerCase()))) bad.push(`${c.id}.${f.id}: a recommended button the format does not offer`);
  for (const r of c.read) if (!(r.what && /^https:\/\//.test(r.url))) bad.push(c.id + ': a source with no page'); }
ok(bad.length === 0, 'every format field has a label and a grade; limits, counts, spot lengths and buttons are well formed; every source is a page', bad.slice(0, 6));
const req = Object.entries(REQUIRED).flatMap(([k, list]) => { const [c, f] = k.split('.'), fm = byId(c) && byId(c).formats.find(x => x.id === f); return !fm ? [k + ': no such format'] : list.filter(x => !fm.fields[x]).map(x => `${k}: ${x} is not a field`); });
ok(req.length === 0 && Object.keys(REQUIRED).length >= 15, 'what a format requires is a field of that format', req);
ok(byId('meta').name === 'Meta (Facebook and Instagram)' && byId('nope') === null && format('google_search', 'rsa').id === 'rsa' && format(byId('meta'), '').id === 'feed' && format('meta', 'nope') === null && format('nope', 'x') === null && WORDS_PER_SECOND > 2 && WORDS_PER_SECOND < 3.2, 'lookups: a channel by id, a format by id, the first format when none is named');

/* ---- the dashboard's platforms ---- */
const order = library(atlas()).platforms.order;
ok(order.every(k => forDesk(k) && DESK_TO_CHANNEL[k] === forDesk(k).id && channelToDesk(DESK_TO_CHANNEL[k]) === k) && forDesk('dg').id === 'demand_gen' && channelToDesk('tiktok') === null && channelToDesk('nope') === null, 'every platform the Campaign Desk plans has its channel in the book, and the book knows which channels the desk does not plan', order);

/* ---- what was read at the source and the gate leans on ---- */
const rsa = format('google_search', 'rsa').fields, snip = format('google_search', 'snippet');
ok(rsa.headlines.max === 30 && rsa.headlines.count.join() === '3,15' && rsa.descriptions.max === 90 && rsa.descriptions.count.join() === '2,4' && rsa.path1.max === 15 && rsa.path2.max === 15 && rsa.headlines.grade === 'A', 'a responsive search ad: 3 to 15 headlines of 30, 2 to 4 descriptions of 90, paths of 15');
ok(snip.headers.length === 13 && snip.headers.includes('Service catalog') && !snip.headers.includes('Services') && snip.fields.values.count.join() === '3,10' && format('google_search', 'sitelink').fields.text.max === 25 && format('google_search', 'sitelink').fields.d1.max === 35 && format('google_search', 'callout').fields.text.max === 25, 'structured snippets take one of 13 fixed headers ("Service catalog", never "Services"); sitelinks 25 and 35; callouts 25');
const call = format('google_search', 'call');
ok(call && Object.keys(call.fields).length === 0 && byId('google_search').rules.some(r => /Call ads .*can no longer be created/.test(r)) && byId('google_search').read.some(r => /call ads withdrawn/.test(r.what)), 'calls come from the call asset: call ads can no longer be created, and the book says where that was read');
ok(format('nextdoor', 'newsfeed').fields.headline.max === 70 && format('nextdoor', 'newsfeed').fields.body.rec === 90 && byId('nextdoor').ctaFree === true && format('meta', 'feed').fields.primary.rec === 125 && byId('meta').rules.some(r => /Financial products and services/.test(r)) && byId('meta').rules.some(r => /15 mile/.test(r)), 'Nextdoor headline 70 with about 90 of the body shown; Meta shows about 125; financing on Meta is a special ad category on a radius');
ok(byId('apple_maps').read.length > 0 && /HVAC|home service/i.test(byId('apple_maps').for) && /2023/.test(byId('waze').for), 'Apple Maps ads bar home services and Waze\'s own ads ended, each with its source');
ok(/manual lead disputes are gone/.test(byId('lsa').buy) && byId('eddm').floor && /\$0\.\d\d/.test(byId('eddm').floor + ' ' + byId('eddm').buy), 'Local Services: lead disputes are no longer filed by hand; Every Door Direct Mail states its postage');
ok(LAW.length >= 5 && LAW.every(l => l.rule && l.cite) && LAW.some(l => /25C|Energy Efficient Home Improvement/.test(l.rule) && /2025/.test(l.rule + l.cite)) && LAW.some(l => /Regulation Z|1026/.test(l.rule + l.cite)) && LAW.some(l => /review/i.test(l.rule)) && LAW.some(l => /text|TCPA/i.test(l.rule + l.cite)), 'the United States rules behind the gate: reviews, free offers, credit terms, texts, the ended tax credit');
ok(byId('tiktok').minDaily === 50 && /\$50 at campaign level and \$20 at ad group level/.test(byId('tiktok').floor) && byId('tiktok').read.some(r => /minimum budgets/.test(r.what)) && CHANNELS.every(c => c.minDaily == null || (c.minDaily > 0 && c.read.length > 0)), 'TikTok\'s own daily minimums are in the book with their source, as a number the gate can use');
ok(snip.headersEs.length === 13 && snip.headersEs[9] === 'Catálogo de servicios' && snip.headersEs[0] === 'Servicios' && snip.headers[0] === 'Amenities' && /does not use manual bid adjustments/.test(byId('google_search').buy) && /Maximize clicks with a maximum CPC bid limit/.test(byId('google_search').buy) && byId('google_search').read.some(r => /which bid strategies use them/.test(r.what)), 'Google\'s Spanish snippet headers pair with the English ones in order ("Servicios" is amenities); Smart Bidding ignores bid adjustments, Maximize clicks with a bid limit does not');
const graded = CHANNELS.flatMap(c => c.formats.flatMap(f => Object.values(f.fields).map(s => s.grade))), n = g => graded.filter(x => x === g).length;
ok(n('A') > 20 && n('D') > 0 && CHANNELS.filter(c => c.status === 'open' && !c.read.length).every(c => c.formats.every(f => Object.values(f.fields).every(s => s.grade === 'D'))), `limits say how they are known: ${n('A')} read on the platform's page, ${n('B')} seen as an excerpt, ${n('D')} from memory; a channel with no source claims nothing above memory`);
done();
