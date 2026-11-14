/* lib/social.mjs: a post is held to the writing rules and each platform's limits, nothing is sent without confirm, and
   what is sent is what was shown. No network: the fetcher is a stand in. */
import fs from 'node:fs';
import { ok, done, json, tmp } from './_t.mjs';
import { check, request, send, sent, whoami, platforms, googleToken, GRAPH, LIMIT } from '../lib/social.mjs';
import { loadPack } from '../lib/atlas.mjs';

const pack = loadPack('dfw'), brand = json('brand.json'), post = json('post.json'), env = {};
const rules = (p, plat) => check(p, plat, { pack, brand }).findings.filter(f => f.severity === 'error').map(f => f.rule);

/* ---- the checks ---- */
ok(platforms(post).join() === 'facebook,gbp' && check(post, 'facebook', { pack, brand }).ok && check(post, 'gbp', { pack, brand }).ok, 'the fixture post passes on both platforms');
const with_ = (plat, patch, top = {}) => Object.assign({}, post, top, { [plat]: Object.assign({}, post[plat], patch) });
ok(rules(with_('facebook', { text: 'Our techs fix it fast.' }), 'facebook').includes('license'), 'a post without the license number fails (every ad carries it)');
ok(rules(with_('facebook', { text: 'Your AC was installed by the builder — call us. TDLR Lic TACLA00000E' }), 'facebook').sort().join() === 'dash,passive', 'the writing rules hold for a post');
ok(rules(with_('facebook', { text: '- Fast\n- Fair\nTDLR Lic TACLA00000E' }), 'facebook').includes('bullet-list') && rules(with_('gbp', { text: 'Stay cool ✅ TDLR Lic TACLA00000E' }), 'gbp').includes('emoji'), 'no bullets, no emoji');
ok(rules(with_('gbp', { text: 'Call (214) 555-0100 today. TDLR Lic TACLA00000E' }), 'gbp').includes('phone') && !rules(with_('facebook', { text: 'Call (214) 555-0100 today. TDLR Lic TACLA00000E' }), 'facebook').includes('phone'), 'a phone number in the text fails on Google, not on Facebook');
ok(rules(with_('gbp', { text: 'x'.repeat(LIMIT.gbp.hard + 1) }), 'gbp').includes('length') && rules(with_('gbp', { cta: 'BUY' }), 'gbp').includes('cta') && rules(with_('gbp', { cta: 'BOOK' }, { link: '' }), 'gbp').includes('cta') && rules(with_('gbp', { topic: 'OFFER' }), 'gbp').includes('topic'), 'Google\'s limits: 1,500 characters, the buttons it offers, a link behind the button, an event for an offer');
ok(rules(with_('facebook', {}, { link: 'http://www.example-air.test/x/' }), 'facebook').includes('link') && rules(with_('facebook', { schedule: new Date(Date.now() + 60e3).toISOString() }), 'facebook').includes('schedule'), 'an https link; a schedule at least ten minutes out');
const live = new Set(['example-air.test/ac-repair']);
ok(check(post, 'facebook', { pack, brand, live }).ok && rules(with_('facebook', {}, { link: 'https://www.example-air.test/not-live/' }), 'facebook').length === 0 && check(with_('facebook', {}, { link: 'https://www.example-air.test/not-live/' }), 'facebook', { pack, brand, live }).findings.some(f => f.rule === 'link' && f.severity === 'error') && check(with_('facebook', {}, { link: 'https://www.example-air.test/not-live/', pending: true }), 'facebook', { pack, brand, live }).ok, 'a link must be live in the sitemap, unless the post waits on a draft page');
ok(check(with_('facebook', { text: 'Half the homes in Plano are old. We pride ourselves on service. We pride ourselves on speed. TDLR Lic TACLA00000E' }), 'facebook', { pack, brand }).findings.some(f => f.rule === 'overused-word'), 'stock words warn in a post too');

/* ---- the requests ---- */
const fb = request(post, 'facebook', brand, env), gb = request(post, 'gbp', brand, env);
ok(fb.method === 'POST' && fb.url === `https://graph.facebook.com/${GRAPH}/100000000000001/feed` && fb.body.message === post.facebook.text && fb.body.link === post.link && !('published' in fb.body), 'Facebook: the Page feed, the text and the link');
ok(gb.url === 'https://mybusiness.googleapis.com/v4/accounts/1000000001/locations/2000000002/localPosts' && gb.body.summary === post.gbp.text && gb.body.topicType === 'STANDARD' && gb.body.callToAction.actionType === 'LEARN_MORE' && gb.body.callToAction.url === post.link && gb.body.languageCode === 'en-US', 'Google: the location\'s local posts, the summary and the button');
const when = new Date(Date.now() + 3 * 864e5).toISOString(), sch = request(with_('facebook', { schedule: when }), 'facebook', brand, env);
ok(sch.body.published === false && sch.body.scheduled_publish_time === Math.floor(Date.parse(when) / 1000), 'a scheduled Facebook post is unpublished with its time');
ok(request(with_('facebook', {}, { link: '', image: 'https://www.example-air.test/a.jpg' }), 'facebook', brand, env).url.endsWith('/photos') && request(with_('gbp', {}, { image: 'https://www.example-air.test/a.jpg' }), 'gbp', brand, env).body.media[0].mediaFormat === 'PHOTO' && request(with_('gbp', { cta: 'CALL' }), 'gbp', brand, env).body.callToAction.url === undefined, 'a photo post, a Google photo, a call button');
ok(request(post, 'facebook', brand, { FB_PAGE_ID: '42' }).url.includes('/42/feed') && (() => { try { request(post, 'gbp', { social: {} }, {}); return false; } catch (e) { return /Business Profile ids/.test(e.message); } })(), 'ids come from the environment before the brand file; a missing id is named');

/* ---- sending ---- */
const calls = [], fetcher = async (url, o = {}) => { calls.push({ url, o }); if (/oauth2/.test(url)) return { ok: true, status: 200, json: async () => ({ access_token: 'fresh' }) }; if (/graph\.facebook/.test(url)) return { ok: true, status: 200, text: async () => JSON.stringify({ id: '100000000000001_555' }), json: async () => ({ name: 'Example Air', link: 'https://facebook.com/exampleair' }) }; return { ok: true, status: 200, text: async () => JSON.stringify({ name: 'accounts/1/locations/2/localPosts/9', searchUrl: 'https://local.google.com/place?id=1' }), json: async () => ({ accounts: [] }) }; };
const dir = tmp();
let r = await send(post, 'facebook', { brand, dir, env, fetcher });
ok(r.sent === false && r.request.body.message === post.facebook.text && calls.length === 0 && !fs.existsSync(dir + '/social-ledger.jsonl'), 'without confirm nothing is sent and nothing is recorded: the request comes back for review');
r = await send(post, 'facebook', { brand, dir, env: { FB_PAGE_ACCESS_TOKEN: 'tok' }, fetcher, confirm: true });
ok(r.sent && r.id === '100000000000001_555' && calls.length === 1 && calls[0].o.headers.authorization === 'Bearer tok' && JSON.parse(calls[0].o.body).message === post.facebook.text, 'with confirm the same request goes out with the Page token');
ok(sent(dir, 'facebook', post.facebook.text) && !sent(dir, 'gbp', post.gbp.text) && !fs.readFileSync(dir + '/social-ledger.jsonl', 'utf8').includes('tok'), 'the ledger records the post and never the token');
r = await send(post, 'facebook', { brand, dir, env: { FB_PAGE_ACCESS_TOKEN: 'tok' }, fetcher, confirm: true });
ok(r.sent === false && r.duplicate && calls.length === 1, 'the same text is not sent to the same platform twice');
r = await send(post, 'gbp', { brand, dir, env: { GBP_REFRESH_TOKEN: 'r', GOOGLE_CLIENT_ID: 'c', GOOGLE_CLIENT_SECRET: 's' }, fetcher, confirm: true });
ok(r.sent && calls.length === 3 && /oauth2\.googleapis\.com\/token/.test(calls[1].url) && calls[2].o.headers.authorization === 'Bearer fresh' && r.url.startsWith('https://local.google.com'), 'Google: a refresh token buys an access token, then the post goes out');
ok(await googleToken({ GBP_ACCESS_TOKEN: 'a' }, fetcher) === 'a' && await googleToken({}, fetcher) === '', 'a token in the environment is used as is; with none, the session proxy is left to supply it');
const refuse = async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ error: { message: '(#200) Requires pages_manage_posts' } }) });
let err = null; try { await send(with_('facebook', { text: post.facebook.text + ' Again.' }), 'facebook', { brand, dir, env: {}, fetcher: refuse, confirm: true }); } catch (e) { err = e; }
ok(err && /refused the post \(HTTP 403\)/.test(err.message) && /pages_manage_posts/.test(err.message) && /credential/.test(err.message), 'a refusal is reported with the platform\'s own reason', err && err.message);
const w = await whoami({ brand, env: { FB_PAGE_ACCESS_TOKEN: 't', GBP_ACCESS_TOKEN: 'g' }, fetcher });
ok(w.facebook.ok && w.facebook.name === 'Example Air' && w.gbp.ok && Array.isArray(w.gbp.locations), 'whoami names the Page and lists the Business Profile locations');
done();
