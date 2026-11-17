/* lib/reviews.mjs: the review score from one place. The figure in force, the tokens copy writes, the gate's check,
   and the Google profile behind it (asked through a stand-in for the network: no test goes out). */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, tmp } from './_t.mjs';

const home = tmp('lv-reviews-'); process.env.LEVIATHAN_HOME = home; process.env.LEVIATHAN_DASHBOARD = '';
const R = await import('../lib/reviews.mjs');
const NOW = new Date('2026-11-17T15:00:00Z');
const BRAND = { name: 'Example Air', phone: '(972) 555-0100', address: { street: '100 Main St, Ste A', city: 'Mesquite', state: 'TX', zip: '75150' }, proof: { reviews: { rating: 4.9, count: 915, asOf: '2026-09-26', source: 'Google' } } };

/* ---- the words ---- */
ok(R.floorCount(915) === 900 && R.floorCount(1284) === 1200 && R.floorCount(900) === 900 && R.floorCount(87) === 80 && R.floorCount(14) === 14 && R.floorCount(100) === 100, 'a count is rounded down to a number a person would say, never up');
const dash = R.inForce(BRAND, R.load(), NOW), w = R.words(dash);
ok(dash.from === 'dashboard' && dash.rating === 4.9 && dash.count === 915 && dash.ageDays === 52 && dash.stale === true, 'with nothing else on file the dashboard\'s figure is in force, and it knows its age', dash);
ok(w.rating === '4.9' && w.floor === '900' && w.count === '915' && w.line === '4.9 from over 900 Google reviews' && w.source === 'Google' && w.asOf === 'September 2026', 'the words a build puts in place of each token', w);
ok(R.words({ rating: 5, count: 1284, atLeast: false, asOf: '2026-01-02', source: 'Google' }).line === '5.0 from over 1,200 Google reviews' && R.words(null) === null, 'a rating keeps its decimal and a large count its comma');

/* ---- the tokens ---- */
const e = R.expand('Rated {reviews.rating} by over {reviews.floor} neighbors. {reviews.line}. {reviews.bogus}', dash);
ok(e.text === 'Rated 4.9 by over 900 neighbors. 4.9 from over 900 Google reviews. {reviews.bogus}' && e.missing.join() === 'bogus' && R.tokens('a {reviews.rating} b {reviews.floor}').join() === 'rating,floor', 'tokens are filled from the figure; one it does not know is left and named', e);
const d = R.expandDeep({ search: [{ adGroups: [{ ad: { headlines: ['{reviews.rating} Stars, Over {reviews.floor} Reviews', { text: 'Rated {reviews.rating}', pin: 1 }] } }] }], n: 3, plain: 'no token' }, dash);
ok(d.value.search[0].adGroups[0].ad.headlines[0] === '4.9 Stars, Over 900 Reviews' && d.value.search[0].adGroups[0].ad.headlines[1].text === 'Rated 4.9' && d.value.search[0].adGroups[0].ad.headlines[1].pin === 1 && d.value.n === 3 && d.filled === 2 && !d.missing.length, 'and through every string of a campaign file, leaving the rest as it was');
ok(R.expand('{reviews.rating}', null).missing.join() === 'rating', 'with no figure on file a token cannot be filled, and says so');

/* ---- a person's word, then the profile ---- */
let held = R.put(R.load(), { rating: 4.9, count: 900, atLeast: true, from: 'person', asOf: undefined }, NOW);
const person = R.inForce(BRAND, held, NOW), pw = R.words(person);
ok(person.from === 'person' && person.atLeast && person.asOf === '2026-11-17' && person.stale === false && pw.floor === '900' && pw.count === undefined && pw.line === '4.9 from over 900 Google reviews', 'a person\'s "4.9, over 900" stands in force over the dashboard\'s older figure; its count is a floor, so the exact count is not offered', person);
ok(R.expand('{reviews.count} reviews', person).missing.join() === 'count', 'and {reviews.count} cannot be filled from a floor');
ok(R.inForce({ proof: { reviews: { rating: 4.8, count: 990, asOf: '2026-12-01', source: 'Google' } } }, held, new Date('2026-12-02T12:00:00Z')).from === 'dashboard', 'a dashboard figure newer than the kept one wins: the newest reading is the one in force');
const over = R.overlay(BRAND, held, NOW);
ok(over.proof.reviews.from === 'person' && over.proof.reviews.count === 900 && BRAND.proof.reviews.count === 915 && over.name === BRAND.name, 'overlay gives the gates a brand whose proof holds the figure in force, and leaves the brand file\'s own alone');

/* ---- the gate ---- */
const kinds = (t, f) => R.check(t, f).map(x => x.severity + ':' + x.kind).join(',');
ok(kinds('Rated 4.9 from over 900 Google reviews.', person) === '' && kinds('4.9 Stars, Over 900 Reviews', person) === '' && kinds('We fix furnaces.', person) === '', 'the floor form passes, and copy with no review claim is not looked at');
ok(kinds('Rated 4.8 from over 900 reviews', person) === 'error:rating' && kinds('4.9 stars from over 1,000 Google reviews', person) === 'error:over' && kinds('4.9 from 915 Google reviews', person) === 'error:over', 'a rating that is not the figure\'s, or a count it does not reach, is an error', kinds('4.9 from 915 Google reviews', person));
const exact = R.put(held, { rating: 4.9, count: 915, atLeast: false, from: 'profile' }, NOW).figure, ex = Object.assign({}, exact, { ageDays: 0, stale: false });
ok(kinds('4.9 from 915 Google reviews', ex) === 'warn:exact' && kinds('4.9 from 910 Google reviews', ex) === 'error:exact' && kinds('4.9 from over 800 reviews', ex) === '' && kinds('nearly 1,000 reviews', ex) === 'error:nearly' && kinds('nearly 920 reviews', ex) === '', 'an exact count that matches still warns (it dates fast); one that does not is an error; "nearly" may round up a little, not a lot', [kinds('4.9 from 915 Google reviews', ex), kinds('4.9 from 910 Google reviews', ex), kinds('nearly 1,000 reviews', ex)]);
ok(kinds('4.9 stars, over 900 reviews', dash) === 'warn:stale' && /52 days old/.test(R.check('4.9 stars', dash)[0].message) && kinds('4.9 stars', null) === 'error:none', 'a figure over a month old warns on any review claim; a claim with no figure on file is an error');

/* ---- the Google profile ---- */
const calls = [], PLACE = { id: 'ChIJexample0123456789', displayName: { text: 'Example Air' }, formattedAddress: '100 Main St Ste A, Mesquite, TX 75150, USA', nationalPhoneNumber: '(972) 555-0100', rating: 4.9, userRatingCount: 1003, googleMapsUri: 'https://maps.google.com/?cid=1' };
const net = (status, body) => async (url, init) => { calls.push({ url, init }); return { ok: status >= 200 && status < 300, status, json: async () => body }; };
const found = await R.findPlace('Example Air, 100 Main St, Mesquite, TX 75150', { fetcher: net(200, { places: [PLACE, Object.assign({}, PLACE, { id: 'ChIJother00000000000', nationalPhoneNumber: '(214) 555-0199', formattedAddress: '9 Elm St, Dallas, TX 75201, USA' })] }), env: {} });
ok(found.length === 2 && found[0].placeId === PLACE.id && found[0].rating === 4.9 && found[0].count === 1003 && R.sameBusiness(found[0], BRAND) && !R.sameBusiness(found[1], BRAND), 'find returns the profiles Google offers; the one with the brand file\'s phone is the business');
const c0 = calls[0];
ok(c0.url === 'https://places.googleapis.com/v1/places:searchText' && c0.init.method === 'POST' && JSON.parse(c0.init.body).textQuery.startsWith('Example Air') && c0.init.headers['X-Goog-Api-Key'] === 'set-by-the-session-proxy' && /places\.rating/.test(c0.init.headers['X-Goog-FieldMask']) && /places\.userRatingCount/.test(c0.init.headers['X-Goog-FieldMask']), 'the request names only the fields it needs and carries no key of its own: the session\'s proxy puts the saved one in', c0.init.headers);
await R.fetchPlace(PLACE.id, { fetcher: net(200, PLACE), env: { GOOGLE_PLACES_API_KEY: 'k-from-env' } });
ok(calls[1].url === 'https://places.googleapis.com/v1/places/' + PLACE.id && calls[1].init.headers['X-Goog-Api-Key'] === 'k-from-env' && calls[1].init.headers['X-Goog-FieldMask'].split(',').includes('userRatingCount'), 'a key in GOOGLE_PLACES_API_KEY is used where there is one');
ok(R.sameBusiness({ phone: '', address: '100 Main St Ste A, Mesquite, TX 75150, USA' }, BRAND) && !R.sameBusiness({ phone: '', address: '1000 Main St, Mesquite, TX 75150' }, BRAND), 'with no phone, the street number and the ZIP decide');
held = R.link(held, found[0], NOW);
const s1 = await R.sync(held, { fetcher: net(200, PLACE), env: {}, now: NOW });
ok(held.profile.placeId === PLACE.id && s1.figure.from === 'profile' && s1.figure.rating === 4.9 && s1.figure.count === 1003 && !s1.figure.atLeast && s1.changed && s1.wordsChanged && s1.held.history.length === 1 && s1.held.history[0].from === 'person' && R.words(s1.figure).line === '4.9 from over 1,000 Google reviews', 'sync reads the linked profile and puts its score in force; crossing a round number changes the words, and the old figure is kept in the history', s1.figure);
const s2 = await R.sync(s1.held, { fetcher: net(200, Object.assign({}, PLACE, { userRatingCount: 1011 })), env: {}, now: NOW });
ok(s2.changed && !s2.wordsChanged && s2.figure.count === 1011, 'a few more reviews change the figure and not the words, so nothing built needs building again');
const err = async fn => { try { await fn(); return null; } catch (x) { return x; } };
const e403 = await err(() => R.sync(s1.held, { fetcher: net(403, { error: { message: 'Places API (New) has not been used in project 1 before or it is disabled.' } }), env: {} })), eNone = await err(() => R.sync(R.load(), { fetcher: net(200, PLACE), env: {} })), eBad = await err(() => R.fetchPlace('not a place id!', { fetcher: net(200, PLACE), env: {} })), eDown = await err(() => R.fetchPlace(PLACE.id, { fetcher: async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } }); }, env: {} }));
const e400 = await err(() => R.fetchPlace(PLACE.id, { fetcher: net(400, { error: { message: 'API key not valid. Please pass a valid API key.' } }), env: {} }));
ok(e400 instanceof R.ProfileError && /No valid key reached it/.test(e400.message) && /GOOGLE_PLACES_API_KEY/.test(e400.message) && !/\.\./.test(e400.message), 'a placeholder key that nothing replaced is reported as a missing key, with where the key is read from');
ok(e403 instanceof R.ProfileError && e403.status === 403 && /Places API \(New\)/.test(e403.message) && /No Google profile is linked/.test(eNone.message) && /not a place id/.test(eBad.message) && /could not be reached \(ENOTFOUND\)/.test(eDown.message), 'a refused key, no linked profile, a bad id and no network each say what is wrong in plain words');

/* ---- kept outside the repository ---- */
const f = R.save(s2.held), back = R.load();
ok(f === path.join(home, 'dashboard', 'reviews.json') && fs.existsSync(f) && back.figure.count === 1011 && back.profile.placeId === PLACE.id && back.history.length === 2 && !/k-from-env|session-proxy/.test(fs.readFileSync(f, 'utf8')), 'the figure, the linked profile and the history are kept beside the connection, and no key is ever written');
const st = R.statusText(BRAND, back, NOW);
ok(/Review figure in force: 4\.9 from 1,011 Google reviews, read from the Google profile, as of 2026-11-17 \(0 days ago\)/.test(st) && /\{reviews\.floor\}\s+1,000/.test(st) && /Google profile linked: Example Air/.test(st) && /not linked yet/.test(R.statusText(BRAND, R.put(R.load(path.join(home, 'none.json')), { rating: 4.9, count: 900, atLeast: true }, NOW), NOW)), 'the status says the figure, where it came from, its age, every token and the linked profile');
done();
