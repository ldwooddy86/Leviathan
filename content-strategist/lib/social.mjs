/* Posts to a Facebook Page and to a Google Business Profile.

   A post file holds the copy for each platform, because the two read differently:

     { "page": "ac-repair-plano", "link": "https://www.example.com/ac-repair-plano/", "image": "https://.../photo.jpg",
       "facebook": { "text": "..." },
       "gbp": { "text": "...", "cta": "LEARN_MORE" } }

   check() holds a post to the same writing rules as a page and to each platform's own limits. send() publishes it, and
   only when it is told to: without confirm it returns the exact request it would make. Tokens never sit in a file here.
   They come from the environment, or from the session's network proxy when the credential is saved there. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseMarkdown } from './doc.mjs';
import { lint, urlKey } from './lint.mjs';

export const GRAPH = process.env.FB_GRAPH_VERSION || 'v26.0';
export const LIMIT = { facebook: { hard: 63206, soft: 500, tags: 3 }, gbp: { hard: 1500, soft: 750 } };
const CTA = ['BOOK', 'ORDER', 'SHOP', 'LEARN_MORE', 'SIGN_UP', 'CALL'];
const PHONE = /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;

export const platforms = post => ['facebook', 'gbp'].filter(p => post[p] && post[p].text);

/* the findings for one platform's copy: the page linter in social mode, then the platform's limits */
export function check(post, platform, { pack = null, brand = null, live = null } = {}) {
  const p = post[platform] || {}, text = String(p.text || ''), link = p.link || post.link || '', image = p.image || post.image || '';
  const r = lint(parseMarkdown(text), { type: 'social', pack, brand }), F = r.findings, add = (rule, severity, message, excerpt = '') => F.push({ rule, severity, message, excerpt });
  const L = LIMIT[platform];
  if (!text.trim()) add('empty', 'error', 'The post has no text.');
  if (text.length > L.hard) add('length', 'error', `${text.length} characters; ${platform === 'gbp' ? 'Google Business Profile' : 'Facebook'} takes ${L.hard} at most.`);
  else if (text.length > L.soft) add('length', 'warn', `${text.length} characters. Past ${L.soft} most readers never open the rest.`);
  if (link && !/^https:\/\//.test(link)) add('link', 'error', `The link is not an https URL: ${link}`);
  if (link && brand && brand.domain && !new RegExp('(^|\\.)' + brand.domain.replace(/\./g, '\\.') + '$', 'i').test(new URL(link).hostname)) add('link', 'warn', `The link leaves ${brand.domain}.`, link);
  if (link && live && !live.has(urlKey(link)) && !post.pending) add('link', 'error', `${link} is not in the sitemap. Post after the page is live, or mark the post "pending": true while the page is a draft.`);
  if (image && !/^https:\/\/\S+\.(jpe?g|png|webp)(\?\S*)?$/i.test(image)) add('image', 'warn', 'The image should be an https URL to a JPG or PNG.', image);
  const tags = (text.match(/(^|\s)#[A-Za-z]\w+/g) || []).length;
  if (platform === 'facebook') {
    if (tags > L.tags) add('hashtags', 'warn', `${tags} hashtags. Keep to ${L.tags} or fewer.`);
    if (p.schedule) { const t = Date.parse(p.schedule), now = Date.now(); if (Number.isNaN(t)) add('schedule', 'error', `Not a date: ${p.schedule}`); else if (t < now + 10 * 60e3 || t > now + 75 * 864e5) add('schedule', 'error', 'Facebook schedules a post from 10 minutes to 75 days ahead.'); }
  } else {
    if (PHONE.test(text)) add('phone', 'error', 'A phone number in the text. Google rejects such posts; use the CALL button.', (PHONE.exec(text) || [''])[0]);
    if (/https?:\/\/|www\./i.test(text)) add('url-in-text', 'warn', 'A URL in the text does not link on Google. Put it on the button.');
    if (tags) add('hashtags', 'warn', 'Hashtags do nothing on a Business Profile post.');
    const cta = p.cta || (link ? 'LEARN_MORE' : '');
    if (cta && !CTA.includes(cta)) add('cta', 'error', `"${cta}" is not a button Google offers. Use one of ${CTA.join(', ')}.`);
    if (cta && cta !== 'CALL' && !link) add('cta', 'error', `The ${cta} button needs a link.`);
    const topic = p.topic || 'STANDARD';
    if (!['STANDARD', 'EVENT', 'OFFER'].includes(topic)) add('topic', 'error', `"${topic}" is not a post type. Use STANDARD, EVENT or OFFER.`);
    if (topic !== 'STANDARD' && !(p.event && p.event.title && p.event.start && p.event.end)) add('topic', 'error', `An ${topic} post needs event: {title, start, end}.`);
  }
  const count = s => F.filter(f => f.severity === s).length;
  return Object.assign(r, { platform, length: text.length, ok: count('error') === 0, counts: { error: count('error'), warn: count('warn'), note: count('note') } });
}

/* ---------- credentials ---------- */
export function ids(brand, env = process.env) {
  const s = (brand && brand.social) || {};
  return { fbPage: env.FB_PAGE_ID || s.facebookPageId || '', gbpAccount: env.GBP_ACCOUNT_ID || s.gbpAccountId || '', gbpLocation: env.GBP_LOCATION_ID || s.gbpLocationId || '' };
}
/* a Google access token: the one in the environment, or a fresh one from a refresh token; '' leaves it to the proxy */
export async function googleToken(env = process.env, fetcher = fetch) {
  if (env.GBP_ACCESS_TOKEN) return env.GBP_ACCESS_TOKEN;
  if (env.GBP_REFRESH_TOKEN && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    const r = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: env.GBP_REFRESH_TOKEN, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET }) });
    const j = await r.json().catch(() => ({})); if (!r.ok || !j.access_token) throw new Error(`Google would not refresh the token (${r.status}${j.error ? ': ' + j.error : ''})`);
    return j.access_token;
  }
  return '';
}
const bearer = t => ({ authorization: 'Bearer ' + (t || 'set-by-the-session-proxy') });

/* ---------- the requests ---------- */
const iso = t => { const d = new Date(t); return { date: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }, time: { hours: d.getUTCHours(), minutes: d.getUTCMinutes(), seconds: 0, nanos: 0 } }; };
/* the request that would publish one platform's copy: {method, url, body} */
export function request(post, platform, brand, env = process.env) {
  const p = post[platform], id = ids(brand, env), link = p.link || post.link || '', image = p.image || post.image || '';
  if (platform === 'facebook') {
    if (!id.fbPage) throw new Error('No Facebook Page id. Set social.facebookPageId in the brand file or FB_PAGE_ID.');
    if (image && !link) return { method: 'POST', url: `https://graph.facebook.com/${GRAPH}/${id.fbPage}/photos`, body: { url: image, caption: p.text } };
    const body = { message: p.text }; if (link) body.link = link;
    if (p.schedule) { body.published = false; body.scheduled_publish_time = Math.floor(Date.parse(p.schedule) / 1000); }
    return { method: 'POST', url: `https://graph.facebook.com/${GRAPH}/${id.fbPage}/feed`, body };
  }
  if (!id.gbpAccount || !id.gbpLocation) throw new Error('No Business Profile ids. Set social.gbpAccountId and social.gbpLocationId in the brand file (run `social whoami` to list them), or GBP_ACCOUNT_ID and GBP_LOCATION_ID.');
  const cta = p.cta || (link ? 'LEARN_MORE' : ''), topic = p.topic || 'STANDARD', body = { languageCode: p.language || 'en-US', summary: p.text, topicType: topic };
  if (cta) body.callToAction = cta === 'CALL' ? { actionType: 'CALL' } : { actionType: cta, url: link };
  if (image) body.media = [{ mediaFormat: 'PHOTO', sourceUrl: image }];
  if (topic !== 'STANDARD' && p.event) { const a = iso(p.event.start), b = iso(p.event.end); body.event = { title: p.event.title, schedule: { startDate: a.date, startTime: a.time, endDate: b.date, endTime: b.time } }; }
  if (topic === 'OFFER' && p.offer) body.offer = p.offer;
  return { method: 'POST', url: `https://mybusiness.googleapis.com/v4/accounts/${id.gbpAccount}/locations/${id.gbpLocation}/localPosts`, body };
}

export const LEDGER = dir => path.join(dir, 'social-ledger.jsonl');
const digest = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 12);
/* true when this exact copy already went to this platform */
export function sent(dir, platform, text) { const f = LEDGER(dir); if (!fs.existsSync(f)) return null; const h = digest(text); return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).find(x => x && x.platform === platform && x.hash === h) || null; }

/* publishes one platform's copy. Without confirm it returns the request and sends nothing. */
export async function send(post, platform, { brand = null, confirm = false, dir = '', env = process.env, fetcher = fetch } = {}) {
  const rq = request(post, platform, brand, env);
  if (!confirm) return { sent: false, platform, request: rq, note: 'Dry run: nothing was sent. Show this to the person and pass --confirm only after they approve this exact text.' };
  const before = dir ? sent(dir, platform, post[platform].text) : null;
  if (before && !post.repost) return { sent: false, platform, duplicate: before, note: `This exact text went to ${platform} on ${before.at} (${before.id}). Set "repost": true to send it again.` };
  const token = platform === 'facebook' ? (env.FB_PAGE_ACCESS_TOKEN || '') : await googleToken(env, fetcher);
  const r = await fetcher(rq.url, { method: rq.method, headers: Object.assign({ 'content-type': 'application/json' }, bearer(token)), body: JSON.stringify(rq.body) });
  const raw = await r.text(); let j; try { j = JSON.parse(raw); } catch { j = { raw: raw.slice(0, 400) }; }
  if (!r.ok) { const e = (j.error && (j.error.message || j.error.status)) || raw.slice(0, 300); throw new Error(`${platform} refused the post (HTTP ${r.status}): ${e}${r.status === 401 || r.status === 403 ? '. The credential is missing, expired or lacks the posting permission.' : ''}`); }
  const id = j.post_id || j.id || j.name || '', url = platform === 'facebook' ? (id ? `https://www.facebook.com/${id}` : '') : (j.searchUrl || '');
  const row = { at: new Date().toISOString(), platform, id, url, link: rq.body.link || (rq.body.callToAction && rq.body.callToAction.url) || '', hash: digest(post[platform].text), page: post.page || '', scheduled: !!rq.body.scheduled_publish_time };
  if (dir) { fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(LEDGER(dir), JSON.stringify(row) + '\n'); }
  return { sent: true, platform, id, url, scheduled: row.scheduled };
}

/* who the credentials belong to: the Page's name, the Business Profile accounts and locations */
export async function whoami({ brand = null, env = process.env, fetcher = fetch } = {}) {
  const id = ids(brand, env), out = { facebook: null, gbp: null }, get = async (url, token) => { const r = await fetcher(url, { headers: bearer(token) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`HTTP ${r.status}${j.error ? ': ' + (j.error.message || j.error.status) : ''}`); return j; };
  try { if (!id.fbPage) throw new Error('no Page id set'); const j = await get(`https://graph.facebook.com/${GRAPH}/${id.fbPage}?fields=name,link`, env.FB_PAGE_ACCESS_TOKEN || ''); out.facebook = { ok: true, page: id.fbPage, name: j.name, link: j.link }; } catch (e) { out.facebook = { ok: false, error: e.message }; }
  try {
    const token = await googleToken(env, fetcher), acc = await get('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', token), list = [];
    for (const a of (acc.accounts || []).slice(0, 10)) { const l = await get(`https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`, token); for (const x of l.locations || []) list.push({ account: a.name.split('/')[1], accountName: a.accountName, location: x.name.split('/')[1], title: x.title, city: (x.storefrontAddress || {}).locality || '' }); }
    out.gbp = { ok: true, set: { account: id.gbpAccount, location: id.gbpLocation }, locations: list };
  } catch (e) { out.gbp = { ok: false, error: e.message }; }
  return out;
}
