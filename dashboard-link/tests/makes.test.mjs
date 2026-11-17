/* lib/makes.mjs: the manufacturers copy names, held against the client's own site and the brand file. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, tmp } from './_t.mjs';
import { MAKES, makesIn, makesOnSite, makesVouched, makesReport, checkMakes, siteOf } from '../lib/makes.mjs';

/* ---- the makes a text names ---- */
const names = (t, o) => makesIn(t, o).map(x => x.make).join(',');
ok(names('We install Carrier furnaces and Mitsubishi Electric mini splits, and repair Trane, American Standard and Lennox.') === 'Carrier,Mitsubishi Electric,Trane,American Standard,Lennox', 'every maker a sentence names, once each, in the order met');
ok(names('Your mail carrier knows the street. We serve New York Avenue and the Coleman Street area. A payne in the neck.') === '' && names('A York furnace and a Coleman heat pump.') === 'York,Coleman', 'a maker\'s name is matched with its capital, so a carrier, New York and a street are left alone');
ok(names('Mitsubishi mini splits') === 'Mitsubishi Electric' && names('a Weil-McLain boiler') === 'Weil McLain' && names('Goodman. Amana. Daikin.') === 'Goodman,Amana,Daikin', 'other spellings of a name count as the same maker');
ok(names('trane furnace repair', { loose: true }) === 'Trane' && names('lennox heat pump repair near me', { loose: true }) === 'Lennox' && names('york furnace repair', { loose: true }) === 'York' && names('new york pizza', { loose: true }) === '' && names('lg mini split', { loose: true }) === 'LG' && names('greenville furnace repair', { loose: true }) === '', 'keywords are read in lower case; a name that is also a plain word must stand beside a trade word');
ok(MAKES.length > 30 && MAKES.every(m => m.name && Array.isArray(m.slug) && m.slug.length), 'the catalog is whole');

/* ---- what the site shows ---- */
const PAGES = [
  { path: '/case-studies/carrier-infinity-systems-in-sachse-tx/', kind: 'post' }, { path: '/rl_gallery/carrier-infinity/', kind: 'media' },
  { path: '/mitsubishi-electric-solutions/', kind: 'page' }, { path: '/amana-receives-2nd-gold-award/', kind: 'post' }, { path: '/amana-brand-ranks-1/', kind: 'post' }, { path: '/amana-brand-ranks-1/', kind: 'post' },
  { path: '/service-area/furnace-repair-in-greenville-tx/', kind: 'location' }, { path: '/heating-service/furnace-repair/', kind: 'service' }, { path: '/blog/categories/lennox/', kind: 'taxonomy' },
];
const on = makesOnSite(PAGES);
ok(on.Carrier.grade === 'page' && on.Carrier.pages.length === 2 && on['Mitsubishi Electric'].grade === 'page' && on.Amana.grade === 'article' && on.Amana.articles.length === 2 && on.Lennox.grade === 'article' && !on.Gree && !on.Trane, 'a case study, a gallery or a page of its own shows the company works with a make; blog posts and tags are articles; a city is not a maker', on);

/* ---- what the brand file vouches for ---- */
const BRAND = { url: 'https://www.example-air.test', dealer: ['Mitsubishi Electric Elite Diamond Contractor'], proof: { dealer: ['Carrier'] }, makes: ['Goodman'] };
const v = makesVouched(BRAND);
ok(v.Carrier.by === 'dealer credential' && v['Mitsubishi Electric'].by === 'dealer credential' && v.Goodman.by === 'the owner\'s list' && !v.Trane && Object.keys(makesVouched(null)).length === 0, 'a dealer credential the dashboard holds vouches for a make, and so does the owner\'s own list');

/* ---- the gate's check ---- */
const site = { pages: PAGES, ageHours: 2 };
const found = checkMakes('We install Carrier and Mitsubishi Electric. We also repair Goodman, Amana, Trane and Lennox.', { brand: BRAND, site });
ok(found.map(f => f.make).join() === 'Amana,Trane,Lennox' && found.every(f => f.severity === 'error' && f.rule === 'make') && /shows only in articles \(\/amana-receives-2nd-gold-award\/, \/amana-brand-ranks-1\/\)/.test(found[0].message) && /nothing in the sitemap as read 2 hours ago \(9 addresses\) shows/.test(found[1].message) && /makes list/.test(found[1].message) && /Trane/.test(found[1].excerpt), 'a make the site shows only in articles, or not at all, is an error that says where it looked and what to do', found.map(f => f.message));
ok(checkMakes('We install Carrier and Mitsubishi Electric.', { brand: BRAND, site }).length === 0 && checkMakes('We fix every major make.', { brand: BRAND, site }).length === 0, 'a vouched make passes, and so does copy that names none');
ok(checkMakes('We install Carrier.', { brand: null, site }).length === 0 && checkMakes('We install Carrier.', { brand: null, site: { pages: [], ageHours: 1 } }).length === 1, 'with no brand file the site alone can stand behind a make');
const unread = checkMakes('We repair Trane.', { brand: BRAND, site: null });
ok(unread.length === 1 && /sitemap has not been read/.test(unread[0].message) && checkMakes('We install Carrier.', { brand: BRAND, site: null }).length === 0, 'with no sitemap read, an unvouched make is an error that says to read it first');
ok(checkMakes('trane furnace repair', { brand: BRAND, site, loose: true }).length === 1 && checkMakes('carrier furnace repair', { brand: BRAND, site, loose: true }).length === 0, 'the same check reads keywords');
const rep = makesReport({ brand: BRAND, site });
ok(rep.rows.map(r => `${r.make}:${r.ok ? 'ok' : 'no'}`).join() === 'Carrier:ok,Mitsubishi Electric:ok,Lennox:no,Goodman:ok,Amana:no' && rep.pageCount === 9 && rep.ageHours === 2, 'the report lists every make either source knows, and which may be named', rep.rows.map(r => r.make + ':' + r.ok));

/* ---- the inventory on file ---- */
const dir = tmp('lv-makes-'); fs.writeFileSync(path.join(dir, 'example-air.test.json'), JSON.stringify({ fetched: new Date(Date.now() - 3 * 36e5).toISOString(), pages: PAGES.map(p => Object.assign({ key: 'example-air.test' + p.path }, p)) }));
const s = siteOf(BRAND, dir);
ok(s && s.pages.length === PAGES.length && s.ageHours === 3 && siteOf({ url: 'https://nothing-read.test' }, dir) === null && siteOf(null, dir) === null, 'the site is read from the inventory the content strategist keeps, with its age; none on file is null');
done();
