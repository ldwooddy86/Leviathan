import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { context, load, fakeFetch, same, ROOT } from './helpers/load.mjs';

const fx = n => JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'fedreg', n), 'utf8'));
/* the five answers of the live run of 2026-11-13 (the refrigerant search and the standing rules as asked that evening, after the
   search was widened), plus the credit search with an older start and a search with no match */
const EQUIP = fx('search-equipment-2026-11-13.json'), REFR = fx('search-refrigerant-2026-11-13.json'), ADS = fx('search-advertising-2026-11-13.json'), CREDIT = fx('search-credit-2026-11-13.json'), STANDING = fx('documents-standing-2026-11-13.json');
const CREDIT_OLD = fx('search-credit-since-2022-08-16-2026-11-13.json'), NONE = fx('search-no-match-2026-11-13.json');
/* the furnace rule and the 2026 petition notice in their own words (search excerpts) */
const RULE_TEXT = fx('excerpt-furnace-rule-compliance-2026-11-13.json'), PETITION_TEXT = fx('excerpt-furnace-petition-2026-11-13.json'), PETITION_ASKS = fx('excerpt-furnace-petition-request-2026-11-13.json'), PETITION_2030 = fx('excerpt-furnace-petition-2030-2026-11-13.json'), PETITION_COURT = fx('excerpt-furnace-petition-court-2026-11-13.json'), COURT_SINCE_JUNE = fx('search-furnace-court-since-2026-06-01-2026-11-13.json');
/* abstracts read on 2026-11-13: the four standing rules and the fees rule; the refrigerant documents the first search left out
   (asked by number together with one unrelated notice, which is cut from the file) */
const ABOUT_STANDING = fx('abstracts-standing-and-fees-2026-11-13.json'), ABOUT_REFR = fx('abstracts-refrigerant-2026-11-13.json');
const fresh = () => load(context(), 'live/core.js', 'live/geo.js', 'live/sources/fedreg_rules.js').TDA_LIVE;
const T0 = new Date('2026-11-13T18:40:00Z');                                  // the afternoon of the recording, a Friday
const routes = o => [[/\/documents\/\d{4}-\d+,/, (o && o.standing) || STANDING], [/energy-department/, (o && o.equipment) || EQUIP], [/environmental-protection-agency/, (o && o.refrigerant) || REFR], [/federal-trade-commission/, (o && o.advertising) || ADS], [/home%20improvement/, (o && o.credit) || CREDIT]];
const runOnce = async (L, fetch, prev, now) => { const http = L.makeHttp({ fetch, gapMs: 0, backoffMs: 1, retries: 0 }); const data = await L.BY_ID.fedreg_rules.run({ http, now: now || T0, prev: prev || null, geo: L.geo, settings: {} }); return { data, http }; };
const copy = x => JSON.parse(JSON.stringify(x));
const ids = list => list.map(d => d.id);
const FIELDS = 'fields[]=document_number&fields[]=publication_date&fields[]=type&fields[]=title&fields[]=html_url&fields[]=effective_on&fields[]=comments_close_on&fields[]=action&fields[]=agencies&fields[]=cfr_references';
const DOE = [{ name: 'Energy Department', slug: 'energy-department' }], CPSC = [{ name: 'Consumer Product Safety Commission', slug: 'consumer-product-safety-commission' }], EPA = [{ name: 'Environmental Protection Agency', slug: 'environmental-protection-agency' }];
const rec = (title, agencies, cfr, abstract) => ({ document_number: '2099-00001', publication_date: '2026-11-02', type: 'Rule', title, html_url: 'https://www.federalregister.gov/documents/2026/11/02/2099-00001/x', effective_on: null, comments_close_on: null, action: 'Final rule.', agencies, cfr_references: (cfr || []).map(p => ({ title: +p.split('/')[0], part: p.split('/')[1] })), abstract: abstract || '' });

test('registration: weekly, grade A, callable from a page, one host, house style in its own words', () => {
  const L = fresh(), s = L.BY_ID.fedreg_rules;
  same({ cadence: s.cadence, cors: s.cors, grade: s.grade, hosts: s.hosts, key: s.key }, { cadence: 'weekly', cors: true, grade: 'A', hosts: ['www.federalregister.gov'] });
  same(Object.keys(s.labels), ['last90', 'newest', 'effective180']);
  for (const t of [s.name, s.about, s.terms, ...Object.values(s.labels).map(l => l[0])]) assert.ok(!/\w[-–—]\w|\s[-–—]\s/.test(t), 'no hyphen or dash between words: ' + t);
  same(L.fedreg.TOPICS, ['furnace', 'heatpump', 'refrigerant', 'credit', 'advertising']);
  same(L.fedreg.PINS, { '2023-25514': 'furnace', '2023-22529': 'refrigerant', '2024-21967': 'refrigerant', '2024-18519': 'advertising' });
});

test('the standing rules are the ones that govern a heating contractor; the fees rule is not one of them', () => {
  const L = fresh(), about = n => ABOUT_STANDING.results.find(r => r.document_number === n), text = n => about(n).abstract.replace(/\s+/g, ' ');
  for (const n of Object.keys(L.fedreg.PINS)) { assert.ok(about(n) && about(n).type === 'Rule' && about(n).action === 'Final rule.', n + ' is a final rule'); assert.ok(STANDING.results.some(r => r.document_number === n), n + ' is in the recorded answer'); }
  same(Object.keys(L.fedreg.PINS).map(n => [n, about(n).citation, about(n).effective_on]), [['2023-25514', '88 FR 87502', '2024-02-16'], ['2023-22529', '88 FR 73098', '2023-12-26'], ['2024-21967', '89 FR 82682', '2024-12-10'], ['2024-18519', '89 FR 68034', '2024-10-21']]);
  assert.match(text('2023-25514'), /DOE is adopting amended energy conservation standards for consumer furnaces, specifically non-weatherized gas furnaces and mobile home gas furnaces\./);
  assert.match(text('2023-22529'), /restricts the use of hydrofluorocarbons in specific sectors or subsectors in which they are used/);
  assert.match(text('2024-21967'), /requirements for leak repair .* the servicing and\/or repair of certain refrigerant- containing equipment to be done with reclaimed hydrofluorocarbons/);
  assert.match(text('2024-18519'), /prohibits selling or purchasing fake consumer reviews or testimonials, buying positive or negative consumer reviews/);
  /* the fees rule in its own words: tickets and lodging, not a contractor's trip charge */
  same([about('2024-30293').title, about('2024-30293').citation, about('2024-30293').effective_on], ['Trade Regulation Rule on Unfair or Deceptive Fees', '90 FR 2066', '2025-05-12']);
  assert.match(text('2024-30293'), /unfair or deceptive practices involving fees or charges for live-event tickets and short-term lodging/); assert.equal(L.fedreg.PINS['2024-30293'], undefined, 'so it is not held up as a standing rule');
  assert.equal(L.fedreg.advertising(ADS.results.find(r => r.document_number === '2024-30293')), 'advertising', 'it is still listed while it is inside the 24 months, like any document on 16 CFR 464');
});

test('the compliance date of the furnace standard is the register\'s own sentence, twice', () => {
  const L = fresh(), day = t => { const m = /(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})/.exec(t); return m ? new Date(Date.UTC(+m[3], ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(m[1]), +m[2])).toISOString().slice(0, 10) : null; };
  const rule = RULE_TEXT.results[0], text = rule.excerpts.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  same({ id: rule.document_number, cite: rule.citation, d: rule.publication_date, effective: rule.effective_on, dates: rule.dates }, { id: '2023-25514', cite: '88 FR 87502', d: '2023-12-18', effective: '2024-02-16', dates: 'Effective date: The effective date of this rule is February 16, 2024.' }, 'the dates field of the API stops at the effective date');
  const said = /Compliance date: (Compliance with the amended standards established for the subject consumer furnaces in this final rule is required on and after [A-Z][a-z]+ \d+, \d{4})\./.exec(text);
  assert.ok(said, 'the rule states its compliance date in the text'); assert.equal(day(said[1]), '2028-12-18'); same(L.fedreg.COMPLY, { '2023-25514': day(said[1]) });
  const pet = PETITION_TEXT.results[0], ptext = pet.excerpts.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  same({ id: pet.document_number, cite: pet.citation, d: pet.publication_date, comments: pet.comments_close_on, action: pet.action, docket: pet.docket_ids }, { id: '2026-08145', cite: '91 FR 22477', d: '2026-04-27', comments: '2026-05-27', action: 'Notification of petition for rulemaking; request for comment.', docket: ['EERE-2026-BT-STD-0001'] });
  assert.match(ptext, /non-weatherized gas furnaces \(95% AFUE\) and mobile home gas furnaces \(95% AFUE\)/); assert.equal(day(/The compliance date for the amended energy conservation standards for the subject consumer furnaces is ([A-Z][a-z]+ \d+, \d{4})/.exec(ptext)[1]), L.fedreg.COMPLY['2023-25514'], 'the Energy Department repeats the date in April 2026');
  assert.match(pet.abstract, /^On February 19, 2026, the Department of Energy \(DOE\) received a petition from the American Gas Association/);
  /* what the petition asks for and the court case it cites, in the notice's own words */
  const flat = j => j.results[0].excerpts.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  same([PETITION_ASKS.results[0].document_number, PETITION_COURT.results[0].document_number], ['2026-08145', '2026-08145']);
  assert.match(flat(PETITION_ASKS), /amend the compliance dates for the following rules: \(1\) Energy Conservation Program: Energy Conservation Standards for Commercial Water Heating Equipment, 88 FR 69686 \(Oct\. 6, 2023\) .* and \(2\) Energy Conservation Program: Energy Conservation Standards for Consumer Furnaces, 88 FR 87502 \(Dec\. 18, 2023\)/);
  assert.match(flat(PETITION_2030), /requesting that DOE extend the compliance dates for its most recently promulgated energy conservation standards for commercial water heaters \(currently October 6, 2026\) and consumer furnaces \(currently December 18, 2028\) until January 1, 2030, at a minimum\./);
  assert.match(flat(PETITION_COURT), /Petition for Writ of Certiorari at Supreme Court of the United States, AGA v\. DOE, No\. 25-879 \(Jan\. 20, 2026\)/);
  /* asked on 2026-11-13: no document since June names consumer furnaces together with the Supreme Court, a remand or a vacatur */
  assert.match(COURT_SINCE_JUNE.description, /"consumer furnaces" \("Supreme Court" \| remand \| remanded \| vacated \| vacatur\)' and published on or after 06\/01\/2026/); same(L.fedreg.rows(COURT_SINCE_JUNE), []);
  /* the record on the day of the recording: nothing on consumer furnaces after the petition notice, so no answer to it, no delay and no withdrawal */
  const later = EQUIP.results.filter(r => r.publication_date > pet.publication_date);
  assert.equal(later.length, 4); assert.ok(later.every(r => L.fedreg.equipment(r) !== 'furnace'), 'the four later Energy Department matches are about commercial furnaces, gas plants and the department\'s own procedures');
});

test('equipment: consumer furnaces and heat pumps stay, commercial equipment and other appliances go', () => {
  const L = fresh(), eq = L.fedreg.equipment, kept = {};
  EQUIP.results.forEach(r => { const t = eq(r); if (t) kept[r.document_number] = t; });
  same(kept, { '2026-08145': 'furnace', '2025-17227': 'heatpump', '2025-09591': 'heatpump', '2025-09064': 'heatpump', '2025-08583': 'furnace', '2025-04473': 'heatpump', '2025-02234': 'heatpump', '2024-30852': 'heatpump' });
  const by = n => EQUIP.results.find(r => r.document_number === n);
  assert.match(by('2026-08145').abstract, /amend the compliance dates for two energy conservation standards final rules for commercial water heating equipment and consumer furnaces/, 'the petition on the furnace compliance date is found through its abstract');
  for (const n of ['2026-20517', '2025-08580', '2025-01082', '2024-30274']) { assert.match(by(n).title, /Commercial Warm Air Furnaces/); assert.equal(eq(by(n)), null, n + ' is commercial (10 CFR 431)'); }
  for (const n of ['2026-21443', '2026-13674', '2026-13673', '2025-22643', '2025-17262', '2025-12383', '2025-03839', '2025-00987', '2024-31214', '2024-30369', '2024-28474']) assert.equal(eq(by(n)), null, n + ' only mentions the words in passing');
  /* the edges of the rule, on records in the register's shape */
  assert.equal(eq(rec('Energy Conservation Program: Energy Conservation Standards for Consumer Furnaces', DOE, ['10/430'])), 'furnace');
  assert.equal(eq(rec('Energy Conservation Program: Energy Conservation Standards for Commercial Water Heating Equipment and Consumer Furnaces; Compliance Dates', DOE, ['10/430', '10/431'])), 'furnace', 'the document the 2026 petition asks for would name both rules: it must not be lost to the water heaters or to part 431');
  assert.equal(eq(rec('Energy Conservation Program: Request for Information on Consumer Furnaces', DOE, [])), 'furnace', 'a title that names the product needs no CFR citation');
  assert.equal(eq(rec('Energy Conservation Program: Test Procedures for Commercial Warm Air Furnaces', DOE, [])), null, 'commercial by its title alone');
  assert.equal(eq(rec('Energy Conservation Program: Notification of Petition for Rulemaking', DOE, [], 'A petition about consumer furnaces.')), null, 'an abstract alone counts only with the consumer parts cited');
  assert.equal(eq(rec('Energy Conservation Program: Test Procedure for Central Air Conditioners and Heat Pumps', DOE, ['10/429'])), 'heatpump', 'the certification part alone is still consumer equipment');
  assert.equal(eq(rec('Energy Conservation Program: Test Procedure for Water-Source Heat Pumps', DOE, ['10/429', '10/431'])), null, 'commercial once part 431 is cited without part 430');
  assert.equal(eq(rec('Energy Conservation Program: Energy Conservation Standards for Single Package Vertical Heat Pumps', DOE, ['10/431'])), null);
  assert.equal(eq(rec('Energy Conservation Program: Energy Conservation Standards for Consumer Water Heaters', DOE, ['10/430'], 'Standards for heat pump water heaters and for central air conditioners and heat pumps are unchanged.')), 'heatpump', 'an abstract that names our product counts when the title names none of ours');
  assert.equal(eq(rec('Energy Conservation Program: Test Procedure for Heat Pump Water Heaters', DOE, ['10/430'])), null, 'a heat pump water heater is not a heat pump');
  assert.equal(eq(rec('Energy Conservation Standards for Room Air Conditioners With Heat Pump Operation', DOE, ['10/430'])), null);
  assert.equal(eq(rec('Energy Conservation Program: Corrections', DOE, ['10/430'], 'Technical corrections for consumer furnaces.')), 'furnace');
  assert.equal(eq(rec('Energy Conservation Program: Corrections', DOE, ['10/430'], 'A furnace is mentioned, the product is not named.')), null);
  assert.equal(eq(rec('Safety Standard for Residential Gas Furnaces and Boilers', CPSC, ['16/1408'])), 'furnace', 'a safety commission rule on furnaces is not held to the energy parts');
  assert.equal(eq(rec('Safety Standard for Toys: Requirements for Water Beads', CPSC, ['16/1250'], 'No product of ours.')), null);
  assert.equal(eq({}), null);
});

test('refrigerant, advertising and credit: what each search keeps from the real answers', () => {
  const L = fresh(), F = L.fedreg;
  const refr = n => REFR.results.find(r => r.document_number === n), cfr = n => refr(n).cfr_references.map(c => c.title + '/' + c.part).join(','), about = n => ABOUT_REFR.results.find(r => r.document_number === n).abstract.replace(/\s+/g, ' ');
  assert.equal(REFR.results.length, 30); same(REFR.results.filter(r => F.refrigerant(r)).map(r => r.document_number), ['2026-20389', '2026-15219', '2026-10387', '2026-06665', '2025-20439', '2025-19895', '2025-19812', '2025-19438', '2024-29243'], 'nine of the 30 matches of the last 24 months');
  same(['2026-10387', '2025-19895', '2025-19438', '2024-29243'].map(cfr), ['40/84', '40/84', '40/84', '40/84'], 'the phasedown rules by their part');
  /* the yearly allowance notices and the data notice cite no part: they are known by their titles */
  same(['2026-20389', '2025-20439', '2026-15219'].map(n => [refr(n).type, cfr(n)]), [['Notice', ''], ['Notice', ''], ['Notice', '']]);
  assert.match(refr('2026-20389').title, /^Phasedown of Hydrofluorocarbons: Notice of 2027 Allowance Allocations/); assert.equal(refr('2026-15219').title, 'Notice of Data Availability: Analysis of HFC Allocation Program Data for 2022-2025');
  assert.match(about('2026-20389'), /has issued calendar year 2027 allowances for the production and consumption of hydrofluorocarbons/);
  /* the listings of acceptable substitutes sit in part 82: the proposal of November 2025 is the one on home heat pumps */
  same(['2026-06665', '2025-19812'].map(cfr), ['40/82', '40/82']);
  assert.match(about('2025-19812'), /proposes to list several substitutes as acceptable, subject to use conditions, for residential and light commercial air conditioning and heat pumps/);
  assert.equal(F.refrigerant(refr('2024-28307')), null, 'a determination whose title names no sector stays out'); assert.match(refr('2024-28307').title, /Determination 39 for the Significant New Alternatives Policy Program$/);
  /* another trade's use of the same chemicals */
  same(['2026-10534', '2026-10388', '2025-16357'].map(n => [F.refrigerant(refr(n)), /Metered Dose Inhalers|Transport Refrigeration Units|Application-Specific Allowances/.exec(refr(n).title)[0]]), [[null, 'Metered Dose Inhalers'], [null, 'Transport Refrigeration Units'], [null, 'Application-Specific Allowances']]);
  for (const n of ['2026-20982', '2026-19072', '2026-18289', '2026-15984', '2026-03157', '2025-17923', '2024-31058', '2024-26643']) assert.equal(F.refrigerant(refr(n)), null, n + ' only mentions hydrofluorocarbons in passing');
  assert.equal(F.refrigerant(rec('Air Plan Approval; Texas', EPA, ['40/52'])), null); assert.equal(F.refrigerant(rec('Phasedown of Hydrofluorocarbons: Notice of 2028 Allowance Allocations', EPA, [])), 'refrigerant');
  assert.equal(F.refrigerant(rec('Restrictions on the Use of HFCs in Residential Heat Pumps', EPA, [])), 'refrigerant'); assert.equal(F.refrigerant(rec('A Rule With No Chemical in Its Title', EPA, ['40/84'])), 'refrigerant', 'part 84 alone is enough');
  assert.equal(F.refrigerant(rec('Protection of Stratospheric Ozone: Listing of Substitutes Under the Significant New Alternatives Policy Program in Foam Blowing', EPA, ['40/82'])), null, 'a listing for another sector');
  assert.equal(F.refrigerant(rec('Protection of Stratospheric Ozone: Listing of Substitutes Under the Significant New Alternatives Policy Program in Residential Air Conditioning and Heat Pumps', EPA, ['40/82'])), 'refrigerant');
  same(ADS.results.filter(r => F.advertising(r)).map(r => r.document_number), ['2026-04952', '2026-02866', '2025-21887', '2025-00634', '2024-30293', '2024-25534']);
  const drop = n => ADS.results.find(r => r.document_number === n);
  assert.match(drop('2026-07473').title, /Unfair or Deceptive Fees in Online Food Delivery Services/); assert.equal(F.advertising(drop('2026-07473')), null, 'a fee rule for another trade, with no CFR part yet, stays out');
  assert.equal(F.advertising(drop('2026-17428')), null, 'telemarketing fees'); assert.equal(F.advertising(drop('2026-22581')), null, 'a petition under the rules of practice');
  assert.equal(F.advertising(STANDING.results.find(r => r.document_number === '2024-18519')), 'advertising', 'the reviews and testimonials rule (16 CFR 465)');
  assert.equal(F.advertising(rec('Guides Concerning the Use of Endorsements and Testimonials in Advertising', [], ['16/255'])), 'advertising');
  assert.equal(F.advertising(rec('Guide Concerning Use of the Word "Free" and Similar Representations', [], [])), 'advertising'); assert.equal(F.advertising(rec('Free Annual File Disclosures', [], ['16/610'])), null);
  same(CREDIT.results.filter(r => F.credit(r)).map(r => r.document_number), [], 'the two matches of the last 24 months only mention the credits in passing');
  assert.match(CREDIT.results[0].title, /Federal Scholarship Tax Credit/);
  same(CREDIT_OLD.results.filter(r => F.credit(r)).map(r => [r.document_number, r.publication_date]), [['2024-24110', '2024-10-25'], ['2023-17571', '2023-08-16'], ['2023-01873', '2023-01-31']], 'with an older start the same search finds the proposed credit rules and the rebate notices');
  assert.equal(CREDIT_OLD.results.find(r => r.document_number === '2024-24110').title, 'Energy Efficient Home Improvement Credit');
});

test('doc: the publisher\'s words, our topic, and nothing kept from a broken record', () => {
  const L = fresh(), F = L.fedreg, r = STANDING.results.find(x => x.document_number === '2023-25514');
  same(F.doc(r, 'furnace', true), { id: '2023-25514', d: '2023-12-18', type: 'Rule', agency: 'DOE', title: 'Energy Conservation Program: Energy Conservation Standards for Consumer Furnaces', url: 'https://www.federalregister.gov/documents/2023/12/18/2023-25514/energy-conservation-program-energy-conservation-standards-for-consumer-furnaces', topic: 'furnace', effective: '2024-02-16', comments: null, action: 'Final rule.', pin: true, comply: '2028-12-18' });
  assert.equal(F.doc(r, 'furnace').comply, undefined, 'only the standing rule carries the date'); assert.equal(F.doc(STANDING.results.find(x => x.document_number === '2024-18519'), 'advertising', true).comply, undefined);
  const p = F.doc(EQUIP.results.find(x => x.document_number === '2026-08145'), 'furnace');
  same({ type: p.type, effective: p.effective, comments: p.comments, action: p.action, pin: p.pin }, { type: 'Proposed Rule', effective: null, comments: '2026-05-27', action: 'Notification of petition for rulemaking; request for comment.' });
  assert.equal(F.agencyOf({ agencies: [{ slug: 'treasury-department' }, { slug: 'internal-revenue-service' }] }), 'IRS'); assert.equal(F.agencyOf({ agencies: [{ slug: 'energy-department' }, { slug: 'federal-energy-regulatory-commission' }] }), 'DOE');
  assert.equal(F.agencyOf({ agencies: [{ name: 'Housing and Urban Development Department', slug: 'housing-and-urban-development-department' }] }), 'Housing and Urban Development Department'); assert.equal(F.agencyOf({}), '');
  const odd = F.doc(Object.assign({}, r, { title: '  A <em>marked</em>\n title </script>', html_url: 'https://example.org/x', effective_on: 'soon', action: 'x'.repeat(300) }), 'furnace');
  same({ title: odd.title, url: odd.url, effective: odd.effective, n: odd.action.length }, { title: 'A marked title', url: '', effective: null, n: 140 });
  for (const bad of [null, {}, Object.assign({}, r, { document_number: '' }), Object.assign({}, r, { publication_date: '12/18/2023' }), Object.assign({}, r, { title: ' ' })]) assert.equal(F.doc(bad, 'furnace'), null);
  assert.equal(F.doc(r, null), null, 'no topic, no record');
  same(F.rows(NONE), [], 'a search with no match carries a count and no list'); assert.equal(F.rows(r).length, 1, 'one document asked by number comes bare'); assert.equal(F.rows(STANDING).length, 4);
  for (const bad of [null, 'x', {}, { errors: { per_page: 'too high' } }]) assert.throws(() => F.rows(bad), /without a document list/);
});

test('the collector sends five requests dated from the day of the run and merges them newest first', async () => {
  const L = fresh(); const fetch = fakeFetch(routes());
  const { data, http } = await runOnce(L, fetch);
  assert.equal(http.stats.n, 5);
  same(fetch.calls.map(c => c.url), [
    'https://www.federalregister.gov/api/v1/documents.json?conditions[term]=furnace%20%7C%20furnaces%20%7C%20%22heat%20pump%22%20%7C%20%22heat%20pumps%22%20%7C%20%22central%20air%20conditioners%22&conditions[agencies][]=energy-department&conditions[agencies][]=consumer-product-safety-commission&conditions[type][]=RULE&conditions[type][]=PRORULE&conditions[publication_date][gte]=2024-11-13&order=newest&per_page=100&' + FIELDS + '&fields[]=abstract',
    'https://www.federalregister.gov/api/v1/documents.json?conditions[term]=hydrofluorocarbons%20%7C%20hydrofluorocarbon%20%7C%20%22significant%20new%20alternatives%20policy%22&conditions[agencies][]=environmental-protection-agency&conditions[publication_date][gte]=2024-11-13&order=newest&per_page=100&' + FIELDS,
    'https://www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=federal-trade-commission&conditions[type][]=RULE&conditions[type][]=PRORULE&conditions[publication_date][gte]=2024-11-13&order=newest&per_page=100&' + FIELDS,
    'https://www.federalregister.gov/api/v1/documents.json?conditions[term]=%22energy%20efficient%20home%20improvement%20credit%22%20%7C%20%22residential%20clean%20energy%20credit%22%20%7C%20%22home%20energy%20rebates%22%20%7C%20%22home%20efficiency%20rebates%22%20%7C%20%22home%20electrification%20and%20appliance%20rebates%22&conditions[publication_date][gte]=2024-11-13&order=newest&per_page=100&' + FIELDS + '&fields[]=abstract',
    'https://www.federalregister.gov/api/v1/documents/2023-25514,2023-22529,2024-21967,2024-18519.json?' + FIELDS,
  ]);
  same(L.fedreg.urls(T0), fetch.calls.map(c => c.url));
  assert.ok(fetch.calls.every(c => c.init.method === 'GET' && c.init.credentials === 'omit' && c.init.cache === 'no-store' && !c.init.headers && !c.init.body), 'plain reads: no cookies, no headers of ours');
  same({ v: data.v, through: data.through, since: data.since, failed: data.failed, stale: data.stale, n: data.docs.length }, { v: 1, through: '2026-11-13', since: '2024-11-13', failed: 0, stale: [], n: 27 });
  assert.equal(new Set(ids(data.docs)).size, 27, 'no document twice'); assert.ok(data.docs.every((d, i) => i === 0 || data.docs[i - 1].d >= d.d), 'newest first');
  same(ids(data.docs).slice(0, 4), ['2026-20389', '2026-15219', '2026-10387', '2026-08145']);
  same(ids(data.docs.filter(d => d.pin)), ['2024-21967', '2024-18519', '2023-25514', '2023-22529'], 'the standing rules, marked');
  assert.ok(data.docs.filter(d => !d.pin).every(d => d.d >= data.since), 'everything else is inside the 24 months');
  const T = L.fedreg.byTopic(data); same(Object.keys(T), ['furnace', 'heatpump', 'refrigerant', 'credit', 'advertising']);
  same({ furnace: ids(T.furnace), heatpump: T.heatpump.length, refrigerant: ids(T.refrigerant), credit: T.credit.length, advertising: ids(T.advertising) }, { furnace: ['2026-08145', '2025-08583', '2023-25514'], heatpump: 6, refrigerant: ['2026-20389', '2026-15219', '2026-10387', '2026-06665', '2025-20439', '2025-19895', '2025-19812', '2025-19438', '2024-29243', '2024-21967', '2023-22529'], credit: 0, advertising: ['2026-04952', '2026-02866', '2025-21887', '2025-00634', '2024-30293', '2024-25534', '2024-18519'] });
  same([...new Set(data.docs.map(d => d.agency))].sort(), ['DOE', 'EPA', 'FTC']); same([...new Set(data.docs.map(d => d.type))].sort(), ['Notice', 'Proposed Rule', 'Rule']);
  same(data.docs.filter(d => d.type === 'Notice').map(d => [d.id, d.action, d.effective, d.comments]), [['2026-20389', 'Notice.', null, null], ['2026-15219', 'Notice of data availability.', null, null], ['2025-20439', 'Notice.', null, null]], 'a notice has no effective date and none of these three takes comments through the register');
  assert.equal(data.docs.find(d => d.id === '2024-30293').pin, undefined, 'the fees rule is one of the 24 months\' documents, not a standing rule');
  assert.ok(data.docs.every(d => /^https:\/\/www\.federalregister\.gov\/documents\/\d{4}\/\d\d\/\d\d\//.test(d.url) && d.title && d.action && Object.keys(d).every(k => ['id', 'd', 'type', 'agency', 'title', 'url', 'topic', 'effective', 'comments', 'action', 'pin', 'comply'].includes(k))));
  same(data.docs.filter(d => d.comply).map(d => [d.id, d.comply]), [['2023-25514', '2028-12-18']]);
  same(L.BY_ID.fedreg_rules.digest(copy(data)), { last90: 1, newest: '2026-10-06 · EPA · Phasedown of Hydrofluorocarbons: Notice of 2027 Allowance Allocations for Production and C…', effective180: 0 });
  const size = JSON.stringify(data).length; assert.ok(size < 16000, 'the stored record stays small: ' + size); assert.ok(!/<\/script/i.test(JSON.stringify(data)));
});

test('dates: the window and the day of the run follow Washington time', async () => {
  const L = fresh(); const fetch = fakeFetch(routes());
  const { data } = await runOnce(L, fetch, null, new Date('2027-03-01T04:30:00Z'));              // 11:30 pm on February 28 in Washington
  same({ through: data.through, since: data.since }, { through: '2027-02-28', since: '2025-02-28' });
  assert.ok(fetch.calls.slice(0, 4).every(c => c.url.includes('conditions[publication_date][gte]=2025-02-28')) && !fetch.calls[4].url.includes('[gte]'), 'the standing rules are asked for by number, without a date');
  assert.ok(!ids(data.docs).includes('2025-02234'), 'a document older than the window is not kept, whatever the answer holds'); assert.ok(ids(data.docs).includes('2025-04473'));
  assert.ok(L.fedreg.urls(new Date('2028-02-29T17:00:00Z'))[1].includes('[gte]=2026-03-01'), 'February 29 two years back lands on March 1');
});

test('reads: what is recent and which dates are still ahead', async () => {
  const L = fresh(), F = L.fedreg; const { data } = await runOnce(L, fakeFetch(routes()));
  same(F.upcoming(data, T0).map(u => [u.id, u.what, u.on, u.days, u.recheck]), [['2023-25514', 'compliance', '2028-12-18', 766, false]], 'on the day of the recording only the furnace compliance date is ahead'); same(ids(F.recent(data, 90)), ['2026-20389']); same(ids(F.recent(data, 180)), ['2026-20389', '2026-15219', '2026-10387']);
  assert.equal(F.recent(data, 365).length, 10); same(ids(F.recent(data)), ['2026-20389'], '90 days when no span is given'); same(ids(F.recent(data, 30, new Date('2026-06-10T12:00:00Z'))), ['2026-20389', '2026-15219', '2026-10387'], 'counted back from a given day: what came after that day is part of the record too');
  const may = F.upcoming(data, new Date('2026-05-01T15:00:00Z'));
  same(may.map(u => [u.id, u.what, u.on, u.days]), [['2026-06665', 'comments', '2026-05-06', 5], ['2026-08145', 'comments', '2026-05-27', 26], ['2026-10387', 'effective', '2026-07-27', 87], ['2023-25514', 'compliance', '2028-12-18', 962]], 'soonest first');
  const june = F.upcoming(data, new Date('2026-06-01T15:00:00Z'));
  same(june.map(u => [u.id, u.what, u.on, u.days]), [['2026-10387', 'effective', '2026-07-27', 56], ['2023-25514', 'compliance', '2028-12-18', 931]]);
  assert.equal(june[0].title, data.docs[2].title); assert.equal(june[0].topic, 'refrigerant'); assert.equal(june[0].type, 'Rule');
  same(F.upcoming(data, new Date('2026-07-27T23:00:00Z')).map(u => [u.id, u.days]), [['2026-10387', 0], ['2023-25514', 875]], 'the day itself still counts, in Dallas time');
  same(F.upcoming(data, new Date('2026-07-28T05:30:00Z')).map(u => u.id), ['2023-25514'], 'half past midnight in Dallas on the 28th: gone');
  same(F.upcoming(data, new Date('2028-12-18T18:00:00Z')).map(u => [u.what, u.days]), [['compliance', 0]]); same(F.upcoming(data, new Date('2028-12-19T18:00:00Z')), []);
  /* a newer rule on furnaces: the compliance date may have moved, so it is flagged for a second look */
  const moved = copy(data); moved.docs.unshift(Object.assign({}, moved.docs.find(d => d.id === '2025-08583'), { id: '2027-01234', d: '2027-02-01', type: 'Rule', effective: '2027-04-02', comments: null }));
  same(F.upcoming(moved, new Date('2027-02-10T18:00:00Z')).map(u => [u.id, u.what, !!u.recheck]), [['2027-01234', 'effective', false], ['2023-25514', 'compliance', true]]);
  const fall = F.upcoming(data, new Date('2025-09-30T15:00:00Z'));
  assert.ok(fall.some(u => u.id === '2025-19895' && u.what === 'comments' && u.on === '2025-11-21')); assert.ok(!fall.some(u => u.id === '2025-19895' && u.what === 'effective'), 'a proposal has no effective date of its own, whatever the register repeats there');
  assert.equal(data.docs.find(d => d.id === '2025-19895').effective, '2025-10-03', 'the stored value stays as published');
  same(F.upcoming(null, T0), []); same(F.recent(null, 90), []); same(F.byTopic(null), { furnace: [], heatpump: [], refrigerant: [], credit: [], advertising: [] });
  /* the same answers read on June 1: one rule about to take effect. The count of 90 days reaches back from that day, and the
     three documents the answers hold from after it are counted with it. */
  const then = await runOnce(L, fakeFetch(routes()), null, new Date('2026-06-01T15:00:00Z'));
  same(L.BY_ID.fedreg_rules.digest(copy(then.data)), { last90: 6, newest: '2026-10-06 · EPA · Phasedown of Hydrofluorocarbons: Notice of 2027 Allowance Allocations for Production and C…', effective180: 1 });
  same(L.BY_ID.fedreg_rules.digest({ through: '2026-11-13', docs: [] }), { last90: 0, newest: '', effective180: 0 });
});

test('a search that fails keeps its documents from the last run and is named; a first run goes without', async () => {
  const L = fresh(); const full = (await runOnce(L, fakeFetch(routes()))).data;
  const down = () => fakeFetch(routes({ advertising: { status: 500, body: 'x' } }));
  const cold = (await runOnce(L, down())).data;
  same({ failed: cold.failed, stale: cold.stale, ads: ids(L.fedreg.byTopic(cold).advertising) }, { failed: 1, stale: ['advertising'], ads: ['2024-18519'] }, 'only the standing rule, read fresh');
  const warm = (await runOnce(L, down(), copy(full))).data;
  same({ failed: warm.failed, stale: warm.stale, n: warm.docs.length }, { failed: 1, stale: ['advertising'], n: 27 }); same(ids(warm.docs), copy(ids(full.docs)), 'last week\'s advertising documents are still there');
  /* three weeks on, the kept documents that have left the window go */
  const later = (await runOnce(L, down(), copy(full), new Date('2026-12-04T18:00:00Z'))).data;
  assert.equal(later.since, '2024-12-04'); assert.ok(!ids(later.docs).includes('2024-25534'), 'the Negative Option Rule of 2024-11-15 has left the window'); assert.ok(ids(later.docs).includes('2025-00634'));
  /* the standing rules fail: they are kept, still marked, and the searches are fresh */
  const noPins = (await runOnce(L, fakeFetch(routes({ standing: { status: 503, body: '' } })), copy(full))).data;
  same({ stale: noPins.stale, pins: ids(noPins.docs.filter(d => d.pin)) }, { stale: ['standing'], pins: ['2024-21967', '2024-18519', '2023-25514', '2023-22529'] });
  const noPinsCold = (await runOnce(L, fakeFetch(routes({ standing: { status: 503, body: '' } })))).data;
  same({ n: noPinsCold.docs.length, pins: noPinsCold.docs.filter(d => d.pin).length }, { n: 23, pins: 0 }, 'without a last run only the 24 months are known');
  /* a record stored while the fees rule was still held as a standing rule: with the standing request or the advertising search
     down, it comes back as an ordinary document of the 24 months, and leaves with them */
  const old = copy(full); old.docs.find(d => d.id === '2024-30293').pin = true;
  const a1 = (await runOnce(L, fakeFetch(routes({ standing: { status: 503, body: '' } })), copy(old))).data, a2 = (await runOnce(L, down(), copy(old))).data;
  for (const r of [a1, a2]) { same(ids(r.docs.filter(d => d.pin)), ['2024-21967', '2024-18519', '2023-25514', '2023-22529']); assert.equal(r.docs.find(d => d.id === '2024-30293').pin, undefined); }
  const a3 = (await runOnce(L, fakeFetch(routes({ standing: { status: 503, body: '' } })), copy(old), new Date('2027-01-12T18:00:00Z'))).data;
  assert.ok(!ids(a3.docs).includes('2024-30293'), 'two years after its publication it is gone, whatever the old record said'); assert.equal(a3.docs.filter(d => d.pin).length, 4);
  /* an empty answer is an answer */
  const quiet = (await runOnce(L, fakeFetch(routes({ refrigerant: NONE })), copy(full))).data;
  same({ stale: quiet.stale, refrigerant: ids(L.fedreg.byTopic(quiet).refrigerant) }, { stale: [], refrigerant: ['2024-21967', '2023-22529'] });
});

test('failure modes: nothing answers, a page instead of JSON, the access check, an answer without a list', async () => {
  const L = fresh();
  await assert.rejects(() => runOnce(L, fakeFetch([[/./, { status: 503, body: 'down' }]])), /HTTP 503 from www\.federalregister\.gov/);
  await assert.rejects(() => runOnce(L, fakeFetch([[/./, { status: 200, body: '<!DOCTYPE html><html><title>Request Access</title>' }]])), /not JSON from www\.federalregister\.gov/);
  /* what the full text pages of the site did to this client on 2026-11-13: a redirect to unblock.federalregister.gov */
  await assert.rejects(() => runOnce(L, fakeFetch([[/./, { status: 200, url: 'https://unblock.federalregister.gov/', body: '<html></html>' }]])), /access check page/);
  await assert.rejects(() => runOnce(L, fakeFetch([[/./, { errors: { fields: 'invalid' } }]])), /without a document list/);
  const one = await runOnce(L, fakeFetch([[/environmental-protection-agency/, REFR], [/./, { status: 429, body: 'slow down' }]]));
  same({ stale: one.data.stale, n: one.data.docs.length }, { stale: ['equipment', 'advertising', 'credit', 'standing'], n: 9 }, 'one search answering is enough for a record');
  const net = await runOnce(L, fakeFetch([[/federal-trade-commission/, new TypeError('Failed to fetch')], ...routes()]));
  same(net.data.stale, ['advertising']);
});

test('a site that does not answer at all is asked twice, not five times', async () => {
  const L = fresh(); const dead = fakeFetch([[/./, new TypeError('Failed to fetch')]]);
  await assert.rejects(() => runOnce(L, dead), /Failed to fetch/);
  assert.equal(dead.calls.length, 4, 'two searches, each tried twice, then it stops');
  /* the first search answers, the next two meet silence: the rest keep last week\'s documents */
  const full = (await runOnce(L, fakeFetch(routes()))).data;
  const half = fakeFetch([[/energy-department/, EQUIP], [/./, new TypeError('Failed to fetch')]]);
  const { data } = await runOnce(L, half, copy(full));
  assert.equal(half.calls.length, 5, 'one answer, then two searches tried twice each');
  same({ stale: data.stale, n: data.docs.length, failed: data.failed }, { stale: ['refrigerant', 'advertising', 'credit', 'standing'], n: 27, failed: 4 });
  /* an error status is an answer of a kind: the next search is still asked */
  const busy = fakeFetch([[/./, { status: 500, body: 'x' }]]); await assert.rejects(() => runOnce(L, busy), /HTTP 500/); assert.equal(busy.calls.length, 10, 'five searches, each tried twice');
});

test('every request carries its own time limit, under the 30 seconds a background worker allows, and a second between calls', async () => {
  const L = fresh(), real = L.makeHttp({ fetch: fakeFetch(routes()), gapMs: 0, backoffMs: 1 }), seen = [];
  const http = { json: (u, i) => { seen.push(i || {}); return real.json(u, i); }, text: (u, i) => { seen.push(i || {}); return real.text(u, i); }, stats: real.stats };
  await L.BY_ID.fedreg_rules.run({ http, now: T0, prev: null, geo: L.geo, settings: {} });
  assert.equal(seen.length, 5); assert.ok(seen.every(i => i.timeoutMs >= 10000 && i.timeoutMs < 30000 && i.retries === 1 && i.gapMs >= 1000 && typeof i.expectFinalUrl === 'function'));
  assert.ok(seen[0].expectFinalUrl('https://www.federalregister.gov/api/v1/documents.json?x=1') && !seen[0].expectFinalUrl('https://unblock.federalregister.gov/'), 'an answer from anywhere but the API is refused');
  /* a site that never answers costs two searches, each tried twice: well inside the two minutes the runner gives a source */
  assert.ok(2 * (2 * seen[0].timeoutMs + 900) + seen[0].gapMs < (L.BY_ID.fedreg_rules.timeoutMs || 120000));
});

test('the list is capped at 60 and the standing rules survive the cap', async () => {
  const L = fresh(), many = copy(REFR); const base = many.results[1];
  many.results = Array.from({ length: 80 }, (_, i) => Object.assign({}, base, { document_number: '2026-9' + String(i).padStart(4, '0'), publication_date: new Date(Date.UTC(2026, 9, 31) - i * 864e5).toISOString().slice(0, 10) }));
  const { data } = await runOnce(L, fakeFetch(routes({ refrigerant: many })));
  assert.equal(data.docs.length, 60); assert.equal(data.docs.filter(d => d.pin).length, 4); assert.equal(data.docs[0].id, '2026-90000'); assert.ok(data.docs.every((d, i) => i === 0 || data.docs[i - 1].d >= d.d));
  assert.ok(JSON.stringify(data).length < 40000, 'even full, the record is small: ' + JSON.stringify(data).length);
});
