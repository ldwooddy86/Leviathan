/* ==== 08_forge_copy.js ==== */
/* ==== forge_copy ==== */
"use strict";
/* ============================ Site Forge: Louisiana roofing copy library ============================ */
/* Service page copy per line (keys match PL), home, about, city, parish and storm templates, data guides and Spanish
   fragments. Placeholders such as {city} are filled by FORGE.varsFor(); a value without data is dropped and the page is
   flagged. Every string that reaches a page passes houseClean (no hyphens or dashes, no meta notes) and the Compliance Satchel.
   Statements of Louisiana law follow the register in 04_content.js (read October 6, 2026) and carry their citations.
   Never in this file: claim handling, coverage promises, deductible offers, "free" without conditions, ratings, review counts,
   "best", "number one", "lifetime" or "hurricane proof". */
const FCOPY = (() => {
  /* public statements of law: [short title, plain statement, citation, url] */
  const LAWPUB = {
    resroof: ['Licensed to sell residential roofing', `Since August 1, 2026, anyone who advertises, bids, contracts for or performs roofing work of $7,500 or more on a home of up to four units must hold the Residential Roofing or Residential Construction license from the Louisiana State Licensing Board for Contractors.`, 'La. R.S. 37:2156.4 (Acts 2026, No. 757)', 'https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf'],
    permit: ['Permits and inspections', `Every roof and reroof on a home or a commercial building needs a permit from the parish or city and the inspections it requires, for projects beginning on or after August 1, 2025. Starting before the permit issues or skipping inspections is a licensing violation.`, 'Acts 2025, No. 239; Acts 2025, No. 422', 'https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf'],
    liab: ['Liability coverage', `Residential contractors licensed by the board must keep at least $500,000 in liability coverage on file with it, with workers compensation kept in force while the license is active.`, 'La. R.S. 37:2156.1', 'https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf'],
    thresholds: ['Which license a job needs', `Commercial work of $50,000 or more needs a commercial license with the right classification. Residential work of $50,000 or more, or any structural work, needs a residential building license; home improvement work over $7,500 needs at least a registration, and residential roofing of $7,500 or more needs the roofing license.`, 'La. R.S. 37:2150.1 and following', 'https://lslbc.gov/wp-content/uploads/2025/06/Licensing-Requirements-for-Contractors-in-Louisiana.pdf'],
    deductible: ['The deductible is the owner\'s to pay', `A contractor paid from a property insurance claim may not advertise, promise or agree to pay any part of the owner's deductible, to waive or rebate it, or to raise the price to make up for it. A contract of $1,000 or more expected to be paid from insurance must carry the statutory deductible notice in bold type.`, 'La. R.S. 51:451, 51:452', 'https://legis.la.gov/legis/ViewDocument.aspx?d=1290211'],
    claims: ['Roofers do not handle claims', `A contractor may not interpret the terms of a policy, adjust or negotiate a claim, or advertise as a specialist in insurance claims or in reading policies, and a public adjuster may not do the roofing on a claim the adjuster handles.`, 'La. R.S. 37:2159.1; La. R.S. 22:1706(H)(11)', 'https://legis.la.gov/legis/ViewDocument.aspx?d=1427858'],
    estimate: ['An itemized estimate first', `Before any repair agreement on an insurance funded job, the contractor must give the owner a good faith itemized estimate of the services and materials.`, 'La. R.S. 37:2159.1', 'https://legis.la.gov/legis/ViewDocument.aspx?d=1290211'],
    aob: ['Assignments of benefits', `A contractor may not take an assignment of the owner's insurance benefits before the work is complete and the insurer has made its first inspection, and then only for the contracted work.`, 'La. R.S. 37:2159.1', 'https://legis.la.gov/legis/ViewDocument.aspx?d=1290211'],
    clock: ['The insurer\'s clock', `After notice of a property claim, an insurer must begin adjusting within 14 days, or within 30 days after a catastrophic loss, and must make a written offer within 30 days of satisfactory proof of loss.`, 'La. R.S. 22:1892', 'https://legis.la.gov/legis/ViewDocument.aspx?d=1372369'],
    cooling: ['Three days to cancel', `A sale of $25 or more made at the buyer's home can be cancelled within three business days, and the seller must hand over the cancellation notice the federal rule prescribes.`, '16 CFR Part 429', 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429'],
    gouge: ['Prices after a disaster', `While a state of emergency is declared, prices for goods and services in the area may not rise above what was charged before the emergency, except for documented increases in cost.`, 'La. R.S. 29:732', 'https://legis.la.gov/legis/LawSearch.aspx'],
    fortify: ['FORTIFIED grants', `The Louisiana Fortify Homes Program pays grants of up to $10,000 toward a roof built to the IBHS FORTIFIED Roof standard on eligible homes: owner occupied with a homestead exemption, insured with wind coverage, and with flood insurance where the home is in a flood zone. Rounds are drawn by lottery, and the grant is paid to the contractor after the roof is certified.`, 'La. R.S. 22:1483.1', 'https://legis.la.gov/legis/ViewDocument.aspx?d=1384506'],
    threeyr: ['Renewals of older policies', `Since August 1, 2024, insurers may file plans to nonrenew some homeowners policies that have been in force more than three years, and since January 1, 2025 they may change deductibles and coverage on them.`, 'Acts 2024, No. 9', 'https://legis.la.gov/legis/BillInfo.aspx?s=24RS&b=HB611&sbi=y'],
    code: ['The building code', `Louisiana enforces the International Residential and Building Codes as adopted with state amendments, including the roof covering, underlayment and wind provisions that depend on the design wind speed where the building stands.`, 'La. R.S. 40:1730.21 and following', 'https://lsuccc.dps.louisiana.gov/'],
    recover: ['Recover or tear off', `Under the residential code, a new roof covering may not go over a roof that already has two layers, that is water soaked or deteriorated, or that is slate, clay or cement tile.`, 'International Residential Code R908.3.1.1', ''],
    reviews: ['Honest reviews', `Federal rules bar fake reviews, reviews bought on the condition that they are positive, undisclosed reviews by staff or family and the suppression of negative reviews.`, '16 CFR Part 465', 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-465'],
    regz: ['Financing terms', `An ad that states a monthly payment, a number of payments, a down payment or a finance charge must also state the down payment, the repayment terms and the annual percentage rate.`, '12 CFR 1026.24', 'https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24'],
    fraud: ['Home improvement fraud', `Taking payment for home improvement work and failing to perform it, or misapplying money meant for materials and subcontractors, are crimes in Louisiana.`, 'La. R.S. 14:202, 14:202.1', 'https://legis.la.gov/legis/LawSearch.aspx'],
    lien: ['Liens on private works', `Contractors, subcontractors and suppliers on private works keep their lien rights only by meeting the notice and filing deadlines of the Private Works Act.`, 'La. R.S. 9:4801 and following', 'https://legis.la.gov/legis/LawSearch.aspx'],
    nhwa: ['The new home warranty', `Builders warrant new homes for one year against defects from noncompliance with building standards, two years for plumbing, electrical, heating and cooling, and five years for major structural defects.`, 'La. R.S. 9:3141 and following', 'https://lslbc.gov/wp-content/uploads/New_Home_Warranty_Act.pdf'],
  };

  const STEPS = {
    replace: [
      { title: 'Inspection', text: `We inspect the roof, the flashing, the vents and the decking we can see from the attic, and photograph what we find.` },
      { title: 'Itemized written estimate', text: `You get a written estimate that lists the materials, tear off, decking repair, ventilation and the permit, so every price can be compared.` },
      { title: 'Permit and scheduling', text: `We pull the permit from the parish or city and schedule the work and the material delivery around the weather.` },
      { title: 'Installation and inspection', text: `Tear off, deck repair, underlayment and the new roof, then the inspections the permit requires and a final walk through with photos.` }],
    repair: [
      { title: 'Stop the water', text: `If water is coming in, we tarp or patch the area first to protect the decking, the ceiling and what is inside.` },
      { title: 'Find the source', text: `Water travels before it shows. We trace it to the flashing, vent boot, valley, nail or shingle that let it in.` },
      { title: 'Written estimate', text: `You get a written estimate for the repair, and an honest answer if the roof is near the end of its life.` },
      { title: 'Repair and check', text: `We make the repair and check it after the next heavy rain if you ask.` }],
    storm: [
      { title: 'Stay safe and document', text: `Stay off the roof. Photograph the damage from the ground and inside the house, and keep receipts for any emergency repairs.` },
      { title: 'Tarp what needs it', text: `We tarp exposed areas to keep water out until the roof can be repaired, at prices set before the storm.` },
      { title: 'Inspection and photo report', text: `We inspect every slope and give you a written photo report and an itemized estimate. Your insurer decides coverage; if you ask, we can show your adjuster the damage on the roof.` },
      { title: 'Permit and repair', text: `When you decide, we pull the permit, repair or replace the roof and pass the inspections.` }],
    hail: [
      { title: 'Check from the ground', text: `Dents in gutters, downspouts, vents and air conditioner fins are the first signs that hail was large enough to matter.` },
      { title: 'Inspection', text: `A roofer checks each slope for bruised, cracked or missing shingles and granule loss, and photographs it.` },
      { title: 'Report and estimate', text: `You get a written photo report and an itemized estimate. Your insurer decides coverage under your policy.` },
      { title: 'Repair or replace', text: `We pull the permit and do the work, with impact rated shingles as an option where hail is common.` }],
    fortified: [
      { title: 'Check the basics', text: `FORTIFIED grants go to owner occupied, homesteaded homes with wind coverage, and flood insurance where the home is in a flood zone.` },
      { title: 'Apply in a round', text: `Owners apply through the Louisiana Fortify Homes Program when a round opens; grants are drawn by lottery.` },
      { title: 'Build to the standard', text: `A FORTIFIED trained roofer installs the roof while a certified evaluator documents each stage with photos.` },
      { title: 'Certificate and grant', text: `IBHS issues the FORTIFIED designation, the grant is paid to the contractor, and you send the certificate to your insurer.` }],
    comm: [
      { title: 'Roof survey', text: `We walk the roof, check drainage, seams, flashing and rooftop equipment, and take moisture readings and core samples where needed.` },
      { title: 'Options and budget', text: `Repair, restore or replace, with the cost, the expected life and the warranty for each, so the decision fits the building and the budget.` },
      { title: 'Schedule and permit', text: `We permit the work and schedule it around your operations, tenants and the weather.` },
      { title: 'Install, inspect, warranty', text: `Installation, the required inspections, closeout photos and the manufacturer warranty paperwork.` }],
  };

  /* service lines: slug, statewide H1 (h1n), local H1 (h1), eyebrow, answer heading (aq), lede, landing lede (lp), answer,
     facts (service page), lfacts (landing page), law (LAWPUB keys), what, who, steps, faq, related lines, band, dl (key rule line) */
  const AC = {
    replace: { meta: 'When a Louisiana roof needs replacing, what a replacement includes, the permit and license rules and how to compare written estimates.', label: 'Roof replacement', card: 'Full roof replacement for homes, with an itemized estimate, a permit and the inspections.', slug: 'roof-replacement', h1n: 'Roof Replacement in Louisiana', h1: 'Roof Replacement in {city}', title: 'Roof Replacement in Louisiana', eyebrow: 'Roof replacement',
      aq: 'When does a Louisiana roof need replacing?',
      lede: 'Most shingle roofs in Louisiana wear out around twenty years, sooner after hard storms and long summers. Here is what a replacement includes and how to compare estimates.',
      lp: 'Replacing a roof in {city}? {brand} gives you an itemized written estimate and pulls the permit for every job. Office in {officeCity}.',
      answer: `An asphalt shingle roof in Louisiana usually lasts about twenty years, less where hurricanes and hail have worked on it and more on a well vented, well installed roof. About {s_ra20} Louisiana roofs are already 20 years or older, and another {s_wave} reach that age within five years. Curling or missing shingles, bare spots where the granules have worn off, daylight in the attic and repeated leaks are the signs it is time. Since August 1, 2025 every reroof needs a permit and inspections.`,
      facts: ['s_ra20', 's_wave', 'life_fact', 'permit_fact'], lfacts: ['c_ra20', 'permit_fact', 'lic7500'], law: ['resroof', 'permit', 'liab', 'recover', 'cooling', 'regz'],
      what: `<p>What a full replacement should include:</p><ul><li><strong>Tear off:</strong> removing the old layers down to the deck, which the code requires where two layers already exist and which is the only way to see the decking.</li><li><strong>Deck repair:</strong> replacing soft or rotted decking and renailing the deck, priced per sheet in the estimate.</li><li><strong>Underlayment and flashing:</strong> new underlayment, drip edge, valley and wall flashing and pipe boots.</li><li><strong>Ventilation:</strong> balanced intake and exhaust, which keeps the attic cooler and the shingles living longer.</li><li><strong>The covering:</strong> architectural shingles rated for high wind, or metal, installed to the manufacturer's high wind specification.</li><li><strong>Permit and inspections:</strong> pulled by the contractor before work starts.</li></ul>`,
      who: `<p>Get at least two itemized written estimates and compare them line by line: tear off, decking, underlayment, flashing, ventilation and the shingle line. Confirm the contractor's license on the LSLBC contractor search and ask for the certificate of liability insurance. If the sale is made at your home, you have three business days to cancel. Ask who pulls the permit; the answer should be the contractor.</p>`,
      steps: 'replace',
      faq: [
        { q: 'How long does a roof last in Louisiana?', a: 'An asphalt shingle roof usually lasts about twenty years here, less after repeated storms and more with good ventilation. Metal, tile and slate last much longer.' },
        { q: 'Does a roof replacement need a permit in Louisiana?', a: 'Yes. Since August 1, 2025 every roof and reroof needs a permit from the parish or city and the inspections it requires, and the contractor should pull it before work starts.' },
        { q: 'Can a new roof go over the old one?', a: 'Not always. The residential code bars a new covering over two existing layers, over a water soaked or deteriorated roof, and over slate, clay or cement tile. A tear off also lets the deck be inspected and renailed.' },
        { q: 'How do I check a roofer\'s license?', a: 'Search the company or the license number on the Louisiana State Licensing Board for Contractors website. Residential roofing of $7,500 or more requires the Residential Roofing or Residential Construction license.' },
        { q: 'Can I cancel a contract I signed at home?', a: 'A sale of $25 or more made at your home can be cancelled within three business days under the federal Cooling Off Rule, and the seller must give you the cancellation form.' }],
      related: ['repair', 'metal', 'fortified'], band: 'Get an itemized roof replacement estimate', dl: 'Every reroof needs a permit and inspections, and residential roofing of $7,500 or more needs the LSLBC license.',
      es: { h: ['Techo nuevo en {city}', 'Reemplazo de techos en {city}'], d: ['Reemplazo de techos con presupuesto detallado por escrito y permiso para cada trabajo. Oficina en {officeCity}.', 'Le damos un presupuesto detallado y sacamos el permiso.'] } },

    repair: { meta: 'Roof leaks in Louisiana: how leaks are found and fixed, what a repair should cost you in time and paperwork, and when a repair is no longer enough.', label: 'Roof repair and leaks', card: 'Leaks, flashing, vent boots, missing shingles and storm patches, found at the source.', slug: 'roof-repair', h1n: 'Roof Repair and Leak Repair in Louisiana', h1: 'Roof Repair in {city}', title: 'Roof Repair and Leaks in Louisiana', eyebrow: 'Roof repair and leaks',
      aq: 'How are roof leaks found and fixed?',
      lede: 'A leak rarely starts where the stain appears. Here is how roofers trace it, what a good repair includes, and when the roof is telling you it needs more than a patch.',
      lp: 'Roof leak in {city}? {brand} finds the source, stops the water and gives you a written estimate. Office in {officeCity}.',
      answer: `Most leaks come from the details rather than the shingles: flashing at walls and chimneys, rubber boots around vent pipes, valleys, and nails that have backed out. Water runs along the deck before it drips, so a roofer traces it from the attic and the roof rather than patching above the stain. A roof with repeated leaks in different places, widespread granule loss or soft decking is usually near the end of its life; at that point a repair buys time, not years.`,
      facts: ['s_ra20', 'life_fact', 'permit_fact', 'lic7500'], lfacts: ['c_ra20', 'permit_fact', 'lic7500'], law: ['permit', 'resroof', 'cooling'],
      what: `<p>The usual sources of a leak:</p><ul><li><strong>Flashing:</strong> where the roof meets a wall, a chimney or a skylight.</li><li><strong>Vent boots:</strong> rubber collars around plumbing vents that crack in the sun.</li><li><strong>Valleys:</strong> where two slopes meet and water concentrates.</li><li><strong>Fasteners:</strong> nails that back out and lift the shingle above them.</li><li><strong>Storm damage:</strong> lifted, creased or missing shingles after high wind.</li></ul>`,
      who: `<p>If water is coming in, move what you can, catch the drip and photograph the stain and the roof from the ground. Do not climb onto a wet roof. Ask for a written estimate that names the cause and the repair, and ask whether the roof's age makes a replacement the better spend. Larger repair jobs need a permit, and residential roofing of $7,500 or more needs the LSLBC license.</p>`,
      steps: 'repair',
      faq: [
        { q: 'Why does my roof leak only in heavy rain?', a: 'Wind driven rain reaches places normal rain does not: under lifted shingles, behind flashing and through cracked vent boots. A roofer can usually find the spot by tracing the water path from the attic.' },
        { q: 'Should I repair or replace my roof?', a: 'Repair a sound roof with a local problem. Replace a roof that is near twenty years old, leaks in more than one place, or has widespread granule loss or soft decking.' },
        { q: 'Does a roof repair need a permit?', a: 'Every roof and reroof project needs a permit under the 2025 law, and parishes and cities set how small repairs are handled. A licensed roofer will know the local rule and pull the permit when one is required.' },
        { q: 'Can a leak cause damage I cannot see?', a: 'Yes. Water can soak insulation and decking and feed mold long before a ceiling stains, which is why the source matters more than the spot.' }],
      related: ['replace', 'storm', 'hail'], band: 'Get a roof leak found and fixed', dl: 'Residential roofing of $7,500 or more needs the LSLBC license.',
      es: { h: ['Reparación de techos en {city}', 'Goteras en {city}'], d: ['Encontramos el origen de la gotera, la paramos y le damos un presupuesto por escrito. Oficina en {officeCity}.', 'Paramos el agua primero y luego reparamos el techo.'] } },

    storm: { meta: 'Storm and wind damage to Louisiana roofs: what to do first, tarping, inspections and photo reports, permits, and the rules on claims and deductibles.', label: 'Storm and wind damage', card: 'Emergency tarping, storm inspections with photo reports, and repairs or replacement after wind damage.', slug: 'storm-damage-roof-repair', h1n: 'Storm Damage Roof Repair in Louisiana', h1: 'Storm Damage Roof Repair in {city}', title: 'Storm Damage Roof Repair in Louisiana', eyebrow: 'Storm and wind damage',
      aq: 'What should you do after a storm damages your roof?',
      lede: 'After a hurricane or a hard thunderstorm, the first hours protect the house and the next weeks decide the repair. Here is what to do, what a roofer does, and the Louisiana rules that protect you.',
      lp: 'Storm damage to your roof in {city}? {brand} tarps, inspects and writes a photo report and an itemized estimate. Office in {officeCity}.',
      answer: `Stay off the roof, photograph the damage from the ground and inside, and keep water out with a tarp. A licensed roofer then inspects every slope and gives you a written photo report and an itemized estimate. Your insurer decides coverage under your policy. Louisiana law bars roofers from interpreting policies, adjusting claims or offering to pay any part of a deductible, and an insurer must begin adjusting within 14 days of notice, or 30 days after a catastrophe. From 2002 to 2026, {s_storms} named storms brought tropical storm force winds to Louisiana.`,
      facts: ['s_storms', 's_fema', 'clock_fact', 'ded_fact'], lfacts: ['c_last', 'clock_fact', 'ded_fact'], law: ['claims', 'deductible', 'estimate', 'aob', 'clock', 'gouge', 'cooling', 'permit'],
      what: `<p>What a storm response should include:</p><ul><li><strong>Emergency tarping:</strong> covering exposed decking to stop further water damage, priced as before the storm.</li><li><strong>Inspection and photo report:</strong> every slope, the flashing, the vents and the gutters, documented with photos and measurements.</li><li><strong>Itemized estimate:</strong> required before any repair agreement on an insurance funded job.</li><li><strong>The work:</strong> repair or replacement under a permit, with the inspections the law requires.</li></ul><p>A roofer may show the damage to your adjuster at your request, but may not interpret your policy, negotiate your claim or take an assignment of your benefits before the work is done and the insurer has inspected.</p>`,
      who: `<p>Report the damage to your insurer and keep the claim number. Photograph everything before any cleanup. Be careful with door knockers: ask for the license number and check it with the LSLBC, get a local address, and do not sign anything that assigns your insurance benefits or promises to cover part of your deductible, which Louisiana law forbids. A contract signed at your home can be cancelled within three business days. During a declared emergency, prices may rise only by documented cost increases.</p>`,
      steps: 'storm',
      faq: [
        { q: 'Should I tarp my roof myself?', a: 'Only if you can do it from a ladder safely, and never on a wet or steep roof. A roofer can tarp it properly and photograph the damage at the same visit.' },
        { q: 'Will my insurance pay for my roof?', a: 'Your insurer decides that under your policy, and Louisiana law bars roofers from interpreting coverage or adjusting claims. What we can do is document the damage with a written photo report and an itemized estimate.' },
        { q: 'Can a roofer pay my deductible?', a: 'No. Louisiana law bars a contractor paid from an insurance claim from paying, waiving or rebating your deductible or raising the price to cover it, and contracts of $1,000 or more paid from insurance must say so in bold type.' },
        { q: 'How fast must my insurer act?', a: 'An insurer must begin adjusting a property claim within 14 days of notice, or within 30 days after a catastrophic loss, and make a written offer within 30 days of satisfactory proof of loss.' },
        { q: 'How do I spot a storm chaser?', a: 'Ask for the license number and check it on the LSLBC website, ask for a local address and references, and be wary of anyone who offers to handle your claim or to cover part of your deductible.' }],
      related: ['repair', 'hail', 'fortified'], band: 'Get your storm damage inspected', dl: 'Roofers may not interpret policies, handle claims or take on any part of a deductible under Louisiana law.',
      es: { h: ['Daños por tormenta en {city}', 'Reparación de techos después de una tormenta'], d: ['Ponemos lona, inspeccionamos y le damos un reporte con fotos y un presupuesto detallado. Oficina en {officeCity}.', 'Primero protegemos la casa, luego documentamos el daño.'] } },

    hail: { meta: 'Hail damage to Louisiana roofs: what size hail damages shingles, how to check from the ground, inspections, and the rules on claims and deductibles.', label: 'Hail damage', card: 'Hail inspections with photo reports, repairs and replacement, with impact rated shingles where hail is common.', slug: 'hail-damage-roof-repair', h1n: 'Hail Damage Roof Repair in Louisiana', h1: 'Hail Damage Roof Repair in {city}', title: 'Hail Damage Roof Repair in Louisiana', eyebrow: 'Hail damage',
      aq: 'Did the hail damage your roof?',
      lede: 'Hail one inch across starts to bruise asphalt shingles, and golf ball hail damages most of them. Here is how to check, what an inspection finds and what happens next.',
      lp: 'Hail in {city}? {brand} inspects your roof and gives you a written photo report and an itemized estimate. Office in {officeCity}.',
      answer: `Hail of about one inch begins to bruise asphalt shingles and knock granules loose, and hail of 1.75 inches, golf ball size, damages most shingles outright. The damage is easy to miss from the ground: dented gutters, vents and air conditioner fins are the first clues. NOAA logged {s_h1} reports of hail one inch or larger in Louisiana from 2016 to 2026, most of them in spring. A roofer's inspection documents bruised and cracked shingles slope by slope; your insurer decides coverage under your policy.`,
      facts: ['s_h1', 's_h175', 'clock_fact', 'ded_fact'], lfacts: ['c_h1', 'clock_fact', 'ded_fact'], law: ['claims', 'deductible', 'estimate', 'clock', 'cooling', 'permit'],
      what: `<p>What hail does to a roof:</p><ul><li><strong>Bruising:</strong> soft spots where the mat under the granules is cracked, which shorten the shingle's life even when nothing leaks yet.</li><li><strong>Granule loss:</strong> bare spots that let the sun break the asphalt down.</li><li><strong>Cracks and punctures:</strong> from larger stones, which leak.</li><li><strong>Soft metals:</strong> dents in vents, flashing and gutters that show the size of the hail.</li></ul><p>Impact rated shingles (UL 2218 Class 4) resist hail better and are worth pricing where hail returns most springs.</p>`,
      who: `<p>Photograph the hail itself if it is safe, then dents in gutters, downspouts, vents and outdoor equipment. Note the date. Book an inspection before the next rain, report damage to your insurer and keep the claim number. Do not sign anything that assigns your benefits or promises to cover part of your deductible.</p>`,
      steps: 'hail',
      faq: [
        { q: 'What size hail damages a roof?', a: 'Hail of about one inch starts to bruise asphalt shingles, and golf ball size hail, about 1.75 inches, damages most of them. Wind, the age of the roof and the shingle type change the answer.' },
        { q: 'Can hail damage hide?', a: 'Yes. Bruises and granule loss can be invisible from the ground and show up as leaks months later, which is why a slope by slope inspection matters.' },
        { q: 'Are impact resistant shingles worth it?', a: 'Where hail returns most springs, Class 4 impact rated shingles resist damage better, and some insurers file discounts for them. Ask your agent before you choose.' },
        { q: 'Can a roofer handle my hail claim?', a: 'No. Louisiana law bars roofers from interpreting policies, adjusting claims or advertising as specialists in insurance claims. A roofer documents the damage and does the work.' }],
      related: ['storm', 'replace', 'repair'], band: 'Get your roof checked for hail damage', dl: 'Golf ball hail damages most asphalt shingles; your insurer decides coverage.',
      es: { h: ['Daños por granizo en {city}', 'Inspección de granizo en {city}'], d: ['Inspeccionamos su techo y le damos un reporte con fotos y un presupuesto detallado. Oficina en {officeCity}.', 'El daño por granizo no siempre se ve desde el suelo.'] } },

    fortified: { meta: 'FORTIFIED roofs in Louisiana: what the IBHS standard adds over a code roof, the Fortify Homes grant of up to $10,000, eligibility and the process.', label: 'FORTIFIED roofs', card: 'Roofs built and documented to the IBHS FORTIFIED Roof standard, including Fortify Homes grant work.', slug: 'fortified-roof', h1n: 'FORTIFIED Roofs in Louisiana', h1: 'FORTIFIED Roof in {city}', title: 'FORTIFIED Roofs and Louisiana Grants', eyebrow: 'FORTIFIED roofs',
      aq: 'What is a FORTIFIED roof?',
      lede: 'A FORTIFIED roof is built to a tested standard that keeps the roof deck on and the water out in high winds, and Louisiana pays grants toward it. Here is what changes and how the program works.',
      lp: 'Thinking about a FORTIFIED roof in {city}? {brand} explains the standard and the Louisiana Fortify Homes Program. Office in {officeCity}.',
      answer: `FORTIFIED Roof is a standard from the Insurance Institute for Business and Home Safety that goes beyond the building code: a sealed roof deck so water stays out if shingles blow off, the deck renailed with ring shank nails, stronger edges, and a covering rated and installed for high wind, each stage documented by an evaluator. The Louisiana Fortify Homes Program pays grants of up to {s_grant} toward a FORTIFIED roof on eligible owner occupied, homesteaded and insured homes, drawn by lottery when a round opens. Insurers file their own FORTIFIED discounts, which vary by company.`,
      facts: ['grant_fact', 's_wave', 'liab_fact', 'permit_fact'], lfacts: ['grant_fact', 'permit_fact', 'lic7500'], law: ['fortify', 'permit', 'resroof', 'code'],
      what: `<p>What FORTIFIED adds over a code roof:</p><ul><li><strong>Sealed roof deck:</strong> the seams taped or the deck covered with a fully adhered underlayment, so wind driven rain stays out if the covering is lost.</li><li><strong>Ring shank nails:</strong> the deck renailed at close spacing, which holds far better than smooth nails in older homes.</li><li><strong>Edges and starter strips:</strong> drip edge and starters attached to resist the uplift that peels roofs from the edge.</li><li><strong>Rated covering:</strong> shingles or metal rated for high wind and installed to the manufacturer's high wind specification.</li><li><strong>Documentation:</strong> a certified evaluator photographs each stage, and IBHS issues the designation.</li></ul>`,
      who: `<p>Check the program's eligibility rules before a round opens: an owner occupied home with a homestead exemption, wind coverage in force, and flood insurance if the home sits in a flood zone; condominiums, mobile homes and recently built homes are not eligible. Grants are drawn by lottery, so treat the grant as possible, not promised. Ask your insurance agent what discount your insurer files for a FORTIFIED roof before you decide.</p>`,
      steps: 'fortified',
      faq: [
        { q: 'How much is the Louisiana FORTIFIED grant?', a: 'The Louisiana Fortify Homes Program pays up to $10,000 toward a FORTIFIED roof, paid to the contractor after the roof is certified. Rounds open on the program\'s schedule and are drawn by lottery.' },
        { q: 'Who qualifies for a Fortify Homes grant?', a: 'Owner occupied homes with a homestead exemption and wind coverage, plus flood insurance where the home is in a flood zone. Condominiums, mobile homes and recently built homes are not eligible. Check the program\'s current rules before applying.' },
        { q: 'Will a FORTIFIED roof lower my insurance?', a: 'Insurers file their own discounts for FORTIFIED roofs, and they vary by company and policy. Ask your agent for the discount your insurer files.' },
        { q: 'What makes a FORTIFIED roof different from a new roof?', a: 'A sealed roof deck, a renailed deck with ring shank nails, stronger edges, a high wind rated covering and third party documentation of every stage.' }],
      related: ['replace', 'storm', 'metal'], band: 'Ask about a FORTIFIED roof', dl: 'Grants of up to $10,000 are drawn by lottery; discounts vary by insurer.',
      es: { h: ['Techos FORTIFIED en {city}', 'Techo FORTIFIED en Luisiana'], d: ['Le explicamos el estándar FORTIFIED y el programa de subsidios de Luisiana. Oficina en {officeCity}.', 'Subsidios de hasta 10,000 dólares por sorteo para casas elegibles.'] } },

    metal: { meta: 'Metal roofing in Louisiana: standing seam and exposed fastener panels, how long they last, coastal coatings, wind ratings and what drives the price.', label: 'Metal roofing', card: 'Standing seam and exposed fastener metal roofs for homes, camps and outbuildings.', slug: 'metal-roofing', h1n: 'Metal Roofing in Louisiana', h1: 'Metal Roofing in {city}', title: 'Metal Roofing in Louisiana', eyebrow: 'Metal roofing',
      aq: 'Is a metal roof right for a Louisiana home?',
      lede: 'Metal roofs last decades, shed heat and rain well and stand up to wind when they are fastened right. Here is how the two main systems differ and what drives the price.',
      lp: 'Metal roof in {city}? {brand} prices standing seam and exposed fastener systems with an itemized estimate. Office in {officeCity}.',
      answer: `Metal roofs commonly last forty years or more, twice the life of most shingles, and light colored panels reflect much of the summer sun. Standing seam panels hide their fasteners and resist wind and leaks best; exposed fastener panels cost less but need their screws and washers checked as they age. Near the coast, aluminum or coated steel rated for salt exposure holds up longer. Steel prices move more than shingle prices: producer prices for steel mill products {s_steelMove} in the year to {s_ppiMonth}.`,
      facts: ['life_metal', 's_steel_fact', 'permit_fact', 'lic7500'], lfacts: ['life_metal', 'permit_fact', 'lic7500'], law: ['resroof', 'permit', 'regz', 'cooling'],
      what: `<p>The two main metal systems:</p><ul><li><strong>Standing seam:</strong> panels joined by raised seams with concealed clips, the best choice for wind and leak resistance.</li><li><strong>Exposed fastener panels:</strong> screwed through the face, lower in cost, common on camps, barns and mobile homes.</li><li><strong>Underlayment and edges:</strong> a high temperature underlayment and properly fastened edges and trim matter as much as the panel.</li><li><strong>Coatings:</strong> painted finishes and coastal grade metals for salt air.</li></ul>`,
      who: `<p>Compare estimates on the same panel gauge, profile, finish and fastening, and ask how the edges and ridge are attached for wind. Ask how long the quote is good for, since steel prices move. Financing ads and quotes that state a payment or a rate must show the full terms.</p>`,
      steps: 'replace',
      faq: [
        { q: 'How long does a metal roof last?', a: 'Commonly forty years or more, depending on the metal, the finish, the installation and the exposure to salt air.' },
        { q: 'Is a metal roof noisy in the rain?', a: 'Over a solid deck with underlayment, most owners notice little difference from shingles. Panels over open framing, as on barns, are louder.' },
        { q: 'Can a metal roof go over shingles?', a: 'Sometimes, where the code and the manufacturer allow it, but not over two existing layers or a deteriorated roof. A tear off lets the deck be checked.' },
        { q: 'Why do metal roof prices change so much?', a: 'Steel prices swing more than shingle prices. Ask how long a quote is good for and whether materials are locked in when you sign.' }],
      related: ['replace', 'mh', 'fortified'], band: 'Get a metal roofing estimate', dl: 'Residential roofing of $7,500 or more needs the LSLBC license.',
      es: { h: ['Techos de metal en {city}', 'Techos de metal en Luisiana'], d: ['Techos de metal con presupuesto detallado y permiso para cada trabajo. Oficina en {officeCity}.', 'Los techos de metal duran décadas si se instalan bien.'] } },

    mh: { meta: 'Mobile and manufactured home roofs in Louisiana: leak repair, roof over systems, metal and membrane options, and what to expect for the price.', label: 'Manufactured home roofs', card: 'Leak repair and roof over systems for mobile and manufactured homes.', slug: 'mobile-home-roofing', h1n: 'Mobile Home Roofing in Louisiana', h1: 'Mobile Home Roofing in {city}', title: 'Mobile Home Roofing in Louisiana', eyebrow: 'Manufactured home roofs',
      aq: 'What are the options for a leaking mobile home roof?',
      lede: 'Mobile home roofs fail at seams, vents and fasteners, and a roof over system can add years. Here are the options and what each one costs you in time and money.',
      lp: 'Mobile home roof leaking in {city}? {brand} repairs leaks and installs roof over systems. Office in {officeCity}.',
      answer: `Louisiana has about {s_mh} mobile and manufactured homes, many with low slope metal or membrane roofs that leak at seams, vents and fasteners. A leak repair seals the source; a roof over system adds a new metal or membrane roof above the old one, often with insulation, and is a common answer to a roof that leaks in many places. Owners in the South do more than a quarter of mobile home roof work themselves, and the typical professional job runs about half the cost of a site built reroof.`,
      facts: ['s_mh', 'mh_cost', 'permit_fact', 'gouge_fact'], lfacts: ['s_mh', 'permit_fact', 'lic7500'], law: ['permit', 'cooling', 'gouge', 'regz'],
      what: `<p>The usual options:</p><ul><li><strong>Leak repair:</strong> resealing seams, vent flashing and fasteners.</li><li><strong>Coating:</strong> an elastomeric coating over a sound metal roof.</li><li><strong>Roof over:</strong> a new metal or membrane roof built over the old one, often with added insulation and better drainage.</li></ul>`,
      who: `<p>Catch the water, photograph the ceiling and the roof from the ground, and ask for a written estimate that names the cause. Ask whether a roof over is allowed for your home and what it adds in weight and insulation. Prices after a declared emergency may rise only by documented costs.</p>`,
      steps: 'repair',
      faq: [
        { q: 'What is a mobile home roof over?', a: 'A new roof, usually metal or a membrane, built over the existing roof with framing that adds slope and often insulation. It is a common fix for a roof that leaks in many places.' },
        { q: 'Can a mobile home roof be coated?', a: 'A sound metal roof can be cleaned, sealed and coated to stop minor leaks and reflect heat. A roof with rust through or soft decking needs more than a coating.' },
        { q: 'Are mobile homes eligible for FORTIFIED grants?', a: 'No. The Louisiana Fortify Homes Program does not include mobile homes.' }],
      related: ['repair', 'metal', 'storm'], band: 'Get your mobile home roof fixed', dl: 'Prices after a declared emergency may rise only by documented costs.',
      es: { h: ['Techos de casas móviles en {city}', 'Techos para casas móviles'], d: ['Reparamos goteras y ponemos techos nuevos sobre casas móviles. Oficina en {officeCity}.', 'Le damos un presupuesto por escrito.'] } },

    mf: { meta: 'Roofing for Louisiana apartment, condo and HOA buildings: surveys, phasing, reserve planning, tenant notices and low slope and steep slope systems.', label: 'Multifamily, condo and HOA', card: 'Roof surveys, replacement and phased work for apartments, condominiums and HOAs.', slug: 'multifamily-roofing', h1n: 'Multifamily and HOA Roofing in Louisiana', h1: 'Multifamily Roofing in {city}', title: 'Apartment, Condo and HOA Roofing', eyebrow: 'Multifamily, condo and HOA',
      aq: 'How do apartment and HOA roof projects work?',
      lede: 'A multifamily roof is a capital project with residents underneath it. Here is how surveys, budgets, phasing and notices fit together.',
      lp: 'Roofing for an apartment or HOA in {city}? {brand} surveys, budgets and phases the work. Office in {officeCity}.',
      answer: `Apartment, condominium and HOA roofs combine steep slope shingles, low slope membranes and long runs of flashing over many units. A roof survey sets the remaining life of each roof so boards and owners can plan reserves, and phased replacement keeps work moving building by building with residents in place. Buildings of five or more units are commercial work under Louisiana licensing: jobs of $50,000 or more need a commercial license with the roofing classification.`,
      facts: ['permit_fact', 'comm_fact', 'liab_fact', 'life_fact'], lfacts: ['permit_fact', 'comm_fact'], law: ['thresholds', 'permit', 'lien', 'code'],
      what: `<p>What a multifamily roof project includes:</p><ul><li><strong>Roof survey:</strong> condition, remaining life and a priority order for every building.</li><li><strong>Budget and reserves:</strong> repair, restore and replace options with costs and timing.</li><li><strong>Phasing and notices:</strong> a schedule by building with resident notices and protection for cars and walkways.</li><li><strong>Closeout:</strong> inspections, photos and warranty records for the association or owner.</li></ul>`,
      who: `<p>Start with a survey before budgeting, and get proposals on the same scope. Confirm the contractor's commercial license and classification, insurance certificates naming the owner, and how lien waivers will be handled.</p>`,
      steps: 'comm',
      faq: [
        { q: 'What license does a contractor need for an apartment roof?', a: 'Buildings of five or more units are commercial work in Louisiana; jobs of $50,000 or more need a commercial license with the roofing classification, and subcontracts of that size need licensed subcontractors.' },
        { q: 'Can a roof be replaced with residents at home?', a: 'Yes, with phasing, notices and protection for parking and walkways. Most work moves building by building.' },
        { q: 'How often should an HOA survey its roofs?', a: 'Many associations survey every few years and after major storms, so reserve studies reflect each roof\'s real condition.' }],
      related: ['comm', 'coat', 'storm'], band: 'Plan your multifamily roof project', dl: 'Commercial roofing of $50,000 or more needs a commercial license with the roofing classification.',
      es: { h: ['Techos para apartamentos en {city}'], d: ['Inspeccionamos, presupuestamos y hacemos el trabajo por fases. Oficina en {officeCity}.'] } },

    comm: { meta: 'Commercial roof replacement in Louisiana: TPO, PVC, modified bitumen, built up and metal systems, surveys, licensing, permits and warranties.', label: 'Commercial roof replacement', card: 'Low slope and metal roof replacement for commercial, industrial and institutional buildings.', slug: 'commercial-roofing', h1n: 'Commercial Roofing in Louisiana', h1: 'Commercial Roofing in {city}', title: 'Commercial Roof Replacement in Louisiana', eyebrow: 'Commercial roofing',
      aq: 'When does a commercial roof need replacing?',
      lede: 'A commercial roof fails at its seams, its drains and its edges long before the field wears out. Here is how to read the signs and plan a replacement.',
      lp: 'Commercial roof in {city}? {brand} surveys the roof and prices repair, restoration and replacement. Office in {officeCity}.',
      answer: `Most commercial buildings in Louisiana carry low slope membranes, TPO, PVC, modified bitumen or built up roofing, or metal panels. Membranes commonly last fifteen to thirty years depending on the system, the thickness and the drainage; ponding water, rooftop traffic and storm damage end many early. A survey with moisture readings shows whether the roof can be repaired, restored with a coating or must be replaced. Commercial work of $50,000 or more needs a commercial license with the roofing classification, and every reroof needs a permit.`,
      facts: ['comm_fact', 'permit_fact', 'life_comm', 'lien_fact'], lfacts: ['comm_fact', 'permit_fact'], law: ['thresholds', 'permit', 'lien', 'code', 'gouge'],
      what: `<p>The main commercial systems:</p><ul><li><strong>TPO and PVC:</strong> single ply membranes with heat welded seams, often white to reflect heat.</li><li><strong>Modified bitumen and built up:</strong> multi layer systems that tolerate foot traffic.</li><li><strong>Metal:</strong> standing seam or panel roofs on warehouses and shops, often restorable with coatings.</li><li><strong>Coatings:</strong> silicone and acrylic restoration over a sound roof.</li></ul>`,
      who: `<p>Track leaks by location and date, keep the warranty and past repair records, and schedule a survey before the budget cycle. Compare proposals on the same system, thickness, insulation and warranty, and confirm the contractor's commercial license, insurance and lien waiver process.</p>`,
      steps: 'comm',
      faq: [
        { q: 'How long does a commercial roof last?', a: 'Membranes commonly last fifteen to thirty years depending on the system, thickness, drainage and maintenance. Metal roofs last longer and can often be restored.' },
        { q: 'Repair, restore or replace?', a: 'A sound roof with local damage can be repaired; a roof with a dry substrate and weathered surface can often be restored with a coating; a wet or failing roof needs replacement. Moisture readings decide.' },
        { q: 'What license does a commercial roofer need?', a: 'Commercial roofing of $50,000 or more needs a commercial license with the roofing classification from the Louisiana State Licensing Board for Contractors.' }],
      related: ['coat', 'mf', 'storm'], band: 'Schedule a commercial roof survey', dl: 'Commercial roofing of $50,000 or more needs a commercial license with the roofing classification.',
      es: { h: ['Techos comerciales en {city}'], d: ['Inspeccionamos su techo comercial y le damos opciones de reparación o reemplazo. Oficina en {officeCity}.'] } },

    coat: { meta: 'Commercial roof coatings, restoration and maintenance in Louisiana: when a coating works, silicone and acrylic systems, warranties and maintenance plans.', label: 'Restoration, coatings and maintenance', card: 'Silicone and acrylic restoration, metal roof coatings and maintenance programs.', slug: 'roof-coatings', h1n: 'Roof Coatings and Restoration in Louisiana', h1: 'Roof Coatings in {city}', title: 'Roof Coatings and Restoration in Louisiana', eyebrow: 'Restoration and maintenance',
      aq: 'When does a roof coating make sense?',
      lede: 'A coating can add years to a sound commercial roof for less than a tear off, but only over a dry, sound substrate. Here is how to tell.',
      lp: 'Roof coating or maintenance in {city}? {brand} tests the roof and prices restoration against replacement. Office in {officeCity}.',
      answer: `A restoration coating, usually silicone or acrylic, seals a weathered membrane or metal roof and reflects heat, and coating warranties commonly run ten to twenty years depending on the thickness applied. It only works over a dry, sound substrate: wet insulation or failed seams have to be fixed or replaced first, which is why moisture testing comes before any coating proposal. A maintenance plan with inspections each spring and after storms catches the small failures that end roofs early.`,
      facts: ['life_coat', 'permit_fact', 'comm_fact'], lfacts: ['life_coat', 'permit_fact'], law: ['thresholds', 'permit', 'lien'],
      what: `<p>What restoration and maintenance include:</p><ul><li><strong>Moisture testing:</strong> readings and cores to confirm the substrate is dry.</li><li><strong>Repairs first:</strong> seams, flashing, drains and wet areas.</li><li><strong>The coating:</strong> applied to the thickness the warranty requires, with reinforcement at seams.</li><li><strong>Maintenance:</strong> inspections each spring and after storms, drain cleaning and small repairs.</li></ul>`,
      who: `<p>Ask for the moisture survey results and the coating thickness the warranty requires before comparing prices. Keep maintenance records; many warranties depend on them.</p>`,
      steps: 'comm',
      faq: [
        { q: 'How long does a roof coating last?', a: 'Coating warranties commonly run ten to twenty years depending on the product and the thickness applied, over a dry, sound roof.' },
        { q: 'Can any roof be coated?', a: 'No. Wet insulation, failed seams and badly deteriorated membranes have to be repaired or replaced first.' },
        { q: 'What does roof maintenance include?', a: 'Inspections each spring and after storms, clearing drains and gutters, and repairing seams and flashing before they leak.' }],
      related: ['comm', 'mf', 'metal'], band: 'Find out if your roof can be restored', dl: 'Coatings work only over a dry, sound substrate.',
      es: { h: ['Recubrimientos de techos en {city}'], d: ['Probamos su techo y comparamos restauración contra reemplazo. Oficina en {officeCity}.'] } },

    newc: { meta: 'New construction roofing in Louisiana: roofing for builders and owners, scheduling with framing, the building code, inspections and the new home warranty.', label: 'New construction roofing', card: 'Roofing for builders and owners building new homes and buildings.', slug: 'new-construction-roofing', h1n: 'New Construction Roofing in Louisiana', h1: 'New Construction Roofing in {city}', title: 'New Construction Roofing in Louisiana', eyebrow: 'New construction',
      aq: 'How does roofing fit a new construction schedule?',
      lede: 'The roof dries in the building. Here is how roofing fits the build schedule, the code and the builder\'s warranty.',
      lp: 'Building in {city}? {brand} roofs new homes and buildings on the builder\'s schedule. Office in {officeCity}.',
      answer: `On a new build, the roof comes right after framing and sheathing and dries in the building for every trade that follows. The work follows the building code's roof covering, underlayment and wind provisions for the site, passes the required inspections, and is measured against the builder's New Home Warranty obligations: one year for defects from noncompliance with building standards and longer for major structural defects. {s_permits} new housing units were permitted in Louisiana in {s_permitYear}.`,
      facts: ['s_permits_fact', 'permit_fact', 'nhwa_fact', 'lic7500'], lfacts: ['permit_fact', 'nhwa_fact'], law: ['code', 'permit', 'nhwa', 'lien', 'thresholds'],
      what: `<p>What builders get:</p><ul><li><strong>Scheduling:</strong> dry in timed to framing and sheathing.</li><li><strong>Code compliance:</strong> underlayment, flashing and fastening for the site's design wind speed.</li><li><strong>Inspections and records:</strong> photos and inspection sign offs for the warranty file.</li><li><strong>Options:</strong> FORTIFIED construction, impact rated shingles and metal.</li></ul>`,
      who: `<p>Bring the roofer in when the plans are set so materials, wind requirements and any FORTIFIED steps are priced from the start. Agree on lien notices and payment schedules in writing.</p>`,
      steps: 'replace',
      faq: [
        { q: 'Can a new home be built to the FORTIFIED standard?', a: 'Yes. FORTIFIED construction is easiest to add during the build. Recently built homes are not eligible for the state retrofit grant, so price it into the build.' },
        { q: 'What warranty covers a new home roof?', a: 'Louisiana\'s New Home Warranty Act makes the builder warrant the home for one year against defects from noncompliance with building standards, with longer periods for some systems and major structural defects. Roofing manufacturers add product warranties.' }],
      related: ['replace', 'metal', 'fortified'], band: 'Talk with us about your build', dl: 'Roofing follows the building code and the builder\'s New Home Warranty obligations.',
      es: { h: ['Techos para construcción nueva en {city}'], d: ['Techamos casas y edificios nuevos según el calendario del constructor. Oficina en {officeCity}.'] } },
  };

  const HOME_FAQ = [
    { q: 'What roofing work does {brand} do?', a: 'Our work covers {lineList}.' },
    { q: 'Where is your office?', a: '{officeLine} We work with homeowners and businesses across {areaList}.' },
    { q: 'Are you licensed in Louisiana?', a: '{brand} holds Louisiana State Licensing Board for Contractors license {lic}. You can check it on the board\'s contractor search.' },
    { q: 'Do you pull permits?', a: 'Yes. Every roof and reroof in Louisiana needs a permit and inspections, and we pull the permit before work starts.' },
    { q: 'Can you help with my insurance claim?', a: 'We inspect the roof, document the damage with photos and write an itemized estimate, and at your request we can show your adjuster the damage on the roof. Your insurer decides coverage; Louisiana law bars roofers from interpreting policies, adjusting claims or paying deductibles.' },
    { q: 'How do I get an estimate?', a: 'Call {phone} or use the form. We schedule an inspection and give you an itemized written estimate.' }];

  const CITY_FAQ = [
    { q: 'Do you work in {city}?', a: '{cityServe}' },
    { q: 'How old are the roofs in {city}?', a: 'About {c_ra20_sh} of the one unit roofs in the {city} ZIP codes are 20 years or older by our estimate from Census and storm records, and {c_wave} more reach 20 within five years. {c_ageWhy}' },
    { q: 'How often do storms hit {city}?', a: '{c_stormSentence} {c_hailSentence}' },
    { q: 'Do I need a permit to replace my roof in {city}?', a: 'Yes. Every roof and reroof in Louisiana needs a permit and inspections, and the roofer should pull it from the parish or city before work starts.' },
    { q: 'Do you work near {city}?', a: 'Yes. We also work in {nearby}.' }];

  const PARISH_FAQ = [
    { q: 'Which communities in {parish} Parish do you serve?', a: 'Homes and businesses across the parish, including {parishCities}.' },
    { q: 'How many roofs in {parish} Parish are getting old?', a: 'About {p_ra20} one unit roofs in {parish} Parish are 20 years or older by our estimate, out of about {p_roofs}. {p_ageWhy}' },
    { q: 'How often do storms damage roofs in {parish} Parish?', a: '{p_stormSentence}' },
    { q: 'Who issues roofing permits in {parish} Parish?', a: 'The parish or the city, depending on where the building stands. Every roof and reroof needs one, and the roofer should pull it.' }];

  const STORM_FAQ = [
    { q: 'What should I do first after {st_name} damaged my roof?', a: 'Stay off the roof, photograph the damage from the ground and inside, keep water out with a tarp, report the damage to your insurer and keep the claim number.' },
    { q: 'How long does my insurer have to act?', a: 'An insurer must begin adjusting a property claim within 14 days of notice, or within 30 days after a catastrophic loss, and make a written offer within 30 days of satisfactory proof of loss.' },
    { q: 'Can a roofer handle my claim or pay my deductible?', a: 'No. Louisiana law bars contractors from interpreting policies, adjusting claims or advertising as specialists in insurance claims, and from paying, waiving or rebating any part of a deductible.' },
    { q: 'How do I avoid storm chasers?', a: 'Check the license number on the LSLBC website, ask for a local address and references, never sign over your insurance benefits before the work is done, and remember you have three business days to cancel a sale made at your home.' }];

  /* storm pages two to six years after the storm: hidden damage and replacement, no claims talk */
  const STORM_LATE_FAQ = [
    { q: 'Can wind damage from {st_name} still be on my roof?', a: 'Yes. Wind can lift and crease shingles and break their seal without tearing them off, and that damage often shows up later as leaks or as shingles lost in the next storm. A slope by slope inspection with photos shows what is there.' },
    { q: 'Should I repair or replace a roof that went through {st_name}?', a: 'Repair a sound roof with local damage. Replace a roof that is near twenty years old, leaks in more than one place, or has widespread granule loss or soft decking.' },
    { q: 'Does a roof replacement need a permit in Louisiana?', a: 'Yes. Since August 1, 2025 every roof and reroof needs a permit from the parish or city and the inspections it requires, and the contractor should pull it before work starts.' },
    { q: 'How do I check a roofer\'s license?', a: 'Search the company or the license number on the Louisiana State Licensing Board for Contractors website. Residential roofing of $7,500 or more requires the Residential Roofing or Residential Construction license.' }];

  /* data guides: scope 'state' (one page), 'city' (per plan city). Tokens are filled per page; heads name the three body sections. */
  const GUIDES = [
    { id: 'age', scope: 'state', line: 'replace', label: 'How long a roof lasts in Louisiana',
      h1: 'How Long Does a Roof Last in Louisiana?', title: 'How Long Does a Roof Last in Louisiana?',
      meta: 'How long shingle, metal and other roofs last in Louisiana, why storms make roofs come due in waves, and the signs it is time to replace.',
      answer: `An asphalt shingle roof in Louisiana usually lasts about twenty years, metal forty or more, and tile and slate much longer. By our estimate from Census, American Housing Survey and storm records, about {s_ra20} Louisiana roofs are 20 years or older today and {s_wave} more reach 20 within five years. Hurricanes replaced so many roofs in 2005, 2008, 2020 and 2021 that roofs in many parishes now come due in waves.`,
      facts: ['s_ra20', 's_wave', 'life_fact', 's_nxt'], heads: ['How long roofs last here', 'Why roofs come due in waves', 'Signs it is time'],
      body: [`<p>Heat, humidity and wind are hard on roofs. The National Association of Home Builders puts the typical life of asphalt shingles at about twenty years; architectural shingles often last longer, and metal roofs commonly forty years or more. Ventilation matters: a hot attic bakes shingles from below. Owners in the region report replacing about four percent of roofs a year on homes built from the 1960s through the 2000s, and about one percent on homes built since 2010.</p>`,
        `<p>A big hurricane replaces tens of thousands of roofs in a few months, and those roofs then age together. Katrina and Rita in 2005 and Gustav and Ike in 2008 reset roofs across south Louisiana; those roofs are reaching twenty years now. Laura, Delta and Zeta in 2020 and Ida in 2021 did it again, so many parishes have a young roof stock today and a wave of replacements due in the late 2030s.</p>`,
        `<p>Curling, cracked or missing shingles, bare patches where the granules are gone, granules in the gutters, daylight or stains in the attic, and repeated leaks in different places all say the roof is near its end. A roof near twenty years old that has been through a hurricane or hail is worth an inspection before the next season. Every reroof now needs a permit and inspections.</p>`],
      faq: [
        { q: 'How long do architectural shingles last in Louisiana?', a: 'Often twenty to thirty years, depending on ventilation, installation and the storms the roof sees.' },
        { q: 'Does a new roof add value to a home?', a: 'A new roof removes a common objection at sale and can matter to insurers, who often inspect older roofs at renewal.' },
        { q: 'Why are insurers asking about my roof\'s age?', a: 'Roof age and condition are common grounds for an insurance inspection, and since 2024 insurers may again nonrenew some long held policies.' }] },
    { id: 'storm', scope: 'state', line: 'storm', label: 'After storm damage to your roof',
      h1: 'What to Do After Storm Damage to Your Roof in Louisiana', title: 'After Storm Damage to Your Roof in Louisiana',
      meta: 'What to do in the first hours and weeks after a hurricane or storm damages a Louisiana roof, and the rules on claims, deductibles, contracts and prices.',
      answer: `Stay off the roof, photograph the damage, keep water out with a tarp, report the damage to your insurer and keep the claim number. A licensed roofer inspects and documents the damage and writes an itemized estimate; your insurer decides coverage. Louisiana law bars roofers from interpreting policies, adjusting claims, taking over your insurance benefits before the work is done and the insurer has inspected, or paying any part of your deductible, and an insurer must begin adjusting within 14 days of notice, or 30 days after a catastrophe.`,
      facts: ['s_storms', 's_fema', 'clock_fact', 'ded_fact'], heads: ['The first hours', 'Your insurer and your roofer', 'Contracts, prices and storm chasers'],
      body: [`<p>Make sure everyone is safe and stay off the roof. Photograph the roof from the ground, the attic and any water inside, and keep receipts for tarps and emergency repairs. A tarp over exposed decking prevents most of the interior damage that follows a storm. Watch for downed lines around the house.</p>`,
        `<p>Report the damage to your insurer and keep the claim number. After notice, an insurer must begin adjusting within 14 days, or within 30 days after a catastrophic loss, and make a written offer within 30 days of satisfactory proof of loss. A roofer can inspect, document the damage and write an itemized estimate, which Louisiana law requires before any repair agreement on an insurance funded job, and can show the adjuster the damage at your request; a roofer may not interpret your policy or negotiate your claim.</p>`,
        `<p>The deductible is yours to pay: a contractor may not offer to pay, waive or rebate it, and contracts of $1,000 or more paid from insurance must say so in bold type. A sale made at your home can be cancelled within three business days. While a state of emergency is declared, prices may rise only by documented cost increases. Check every roofer's license on the LSLBC website before you sign.</p>`],
      faq: [
        { q: 'Should I sign over my insurance benefits to a roofer?', a: 'Louisiana law bars a contractor from taking an assignment of your insurance benefits before the work is complete and the insurer has made its first inspection.' },
        { q: 'What if a roofer offers to cover my deductible?', a: 'That offer is unlawful in Louisiana. Choose a roofer who follows the law.' },
        { q: 'Can I hire a roofer from out of state?', a: 'Only a contractor licensed in Louisiana may sell or do residential roofing of $7,500 or more here. Check the license on the LSLBC website.' }] },
    { id: 'hail', scope: 'state', line: 'hail', label: 'Hail damage and your roof',
      h1: 'Hail Damage and Your Roof in Louisiana', title: 'Hail Damage and Your Roof in Louisiana',
      meta: 'What size hail damages a roof, when hail season peaks in Louisiana, how to check for damage and what happens next.',
      answer: `Hail of about one inch begins to bruise asphalt shingles and golf ball hail of 1.75 inches damages most of them. Louisiana's hail peaks in {s_hailPeak}, and NOAA logged {s_h1} reports of hail one inch or larger in the state from 2016 to 2026, {s_h175} of them golf ball size or larger. Check gutters, vents and outdoor equipment for dents, then have the roof inspected slope by slope.`,
      facts: ['s_h1', 's_h175', 'hail_season', 'clock_fact'], heads: ['When and where hail falls', 'What hail does to shingles', 'After a hail storm'],
      body: [`<p>Hail in Louisiana comes mostly with spring storms, and it is more common in the northern parishes than on the coast. Reports also follow people: a hail swath over farmland may produce few reports even when it damaged roofs.</p>`,
        `<p>Hail bruises shingles by cracking the mat under the granules, knocks granules loose and, when large enough, cracks or punctures shingles outright. Bruises can be invisible from the ground and show up as leaks months later. Impact rated shingles, UL 2218 Class 4, resist hail better.</p>`,
        `<p>Photograph dents on gutters, downspouts, vents and air conditioner fins, note the date and book an inspection before the next rain. Report damage to your insurer and keep the claim number. Your insurer decides coverage; a roofer documents the damage and does the work.</p>`],
      faq: [
        { q: 'When is hail season in Louisiana?', a: 'Spring, peaking in {s_hailPeak}, though hail can fall in any month with strong thunderstorms.' },
        { q: 'Should I file a claim for hail damage?', a: 'That is between you and your insurer. A roofer can document the damage so you know what you are dealing with.' }] },
    { id: 'license', scope: 'state', line: null, label: 'How to check a roofer\'s license',
      h1: 'How to Check a Roofer\'s License in Louisiana', title: 'How to Check a Roofer\'s License in Louisiana',
      meta: 'Which Louisiana license a roofer needs, how to check it on the LSLBC website, the insurance rule and why it matters after storms.',
      answer: `Since August 1, 2026, anyone who advertises, bids or performs residential roofing of $7,500 or more in Louisiana must hold the Residential Roofing or Residential Construction license from the Louisiana State Licensing Board for Contractors, and residential licensees must carry at least $500,000 in liability coverage. Search the company or the license number on the board's website before you sign. About {s_out} of roofing license records belong to companies based out of state.`,
      facts: ['lic7500', 'liab_fact', 's_out', 'permit_fact'], heads: ['Which license a job needs', 'How to check', 'Why it matters after storms'],
      body: [`<p>Residential roofing of $7,500 or more on a home of up to four units needs the Residential Roofing or Residential Construction license. Commercial work of $50,000 or more needs a commercial license with the roofing classification. Every roof and reroof also needs a permit from the parish or city.</p>`,
        `<p>Use the contractor search on the Louisiana State Licensing Board for Contractors website, search by company name or license number, and confirm the classification and status. Ask for the certificate of liability insurance and a local address.</p>`,
        `<p>After hurricanes, crews from other states arrive quickly. Some are licensed and reputable; some are not. A license number, a local address, permits pulled in your parish and an itemized written estimate are the signs of a contractor who will be here to stand behind the work.</p>`],
      faq: [
        { q: 'Does a small roof repair need a licensed roofer?', a: 'The state roofing license applies to residential roofing of $7,500 or more. Smaller jobs still need a permit where the parish or city requires one and any local occupational license.' },
        { q: 'What if a roofer is not licensed?', a: 'Report unlicensed contracting to the LSLBC. Paying an unlicensed contractor leaves you with little recourse if the work fails.' }] },
    { id: 'fortified', scope: 'state', line: 'fortified', label: 'FORTIFIED roofs and Louisiana grants',
      h1: 'FORTIFIED Roofs and Louisiana Grants', title: 'FORTIFIED Roofs and Louisiana Grants',
      meta: 'What a FORTIFIED roof is, how the Louisiana Fortify Homes Program grant of up to $10,000 works, who qualifies and how insurance discounts work.',
      answer: `A FORTIFIED roof is built to the Insurance Institute for Business and Home Safety standard: a sealed roof deck, a renailed deck, stronger edges and a high wind rated covering, documented by an evaluator. The Louisiana Fortify Homes Program pays grants of up to {s_grant} toward one on eligible owner occupied, homesteaded and insured homes, drawn by lottery. Insurers file their own FORTIFIED discounts.`,
      facts: ['grant_fact', 'permit_fact', 'lic7500', 's_storms'], heads: ['What FORTIFIED adds', 'The Louisiana grant', 'Insurance and the decision'],
      body: [`<p>Most hurricane damage inside a house comes from water through the roof deck after the covering blows off. FORTIFIED seals the deck, renails it with ring shank nails at close spacing, strengthens the edges where uplift starts and uses a covering rated and installed for high wind, with a certified evaluator photographing each stage.</p>`,
        `<p>The Louisiana Fortify Homes Program pays up to $10,000 toward a FORTIFIED roof, paid to the contractor after certification. Homes must be owner occupied with a homestead exemption and carry wind coverage, plus flood insurance in a flood zone; condominiums, mobile homes and recently built homes are not eligible. Rounds open on the program's schedule and grants are drawn by lottery.</p>`,
        `<p>Insurers file their own discounts for FORTIFIED roofs, and they vary by company. Ask your agent for the discount your insurer files, compare it with the added cost after any grant, and decide on the numbers.</p>`],
      faq: [
        { q: 'Can I get the grant on a mobile home?', a: 'No. The Louisiana Fortify Homes Program does not include mobile homes.' },
        { q: 'Is a discount guaranteed?', a: 'No. Each insurer files its own FORTIFIED discount.' }] },
    { id: 'cityroofs', scope: 'city', line: 'replace', label: 'Roofs and storms in each city',
      h1: 'Roofs and Storms in {city}', title: 'Roofs and Storms in {city}, Louisiana',
      meta: 'How old the roofs in {city} are, the storms and hail that hit its ZIP codes, and what that means for owners.',
      answer: `By our estimate from Census and storm records, about {c_ra20_sh} of the one unit roofs in the {city} ZIP codes are 20 years or older and {c_wave} more reach 20 within five years. {c_ageWhy} {c_stormSentence} {c_hailSentence}`,
      facts: ['c_roofs', 'c_ra20', 'c_h1', 'c_fema'], heads: ['The roofs in {city}', 'Storms that reached {city}', 'What it means for owners'], table: 'citystorms',
      body: [`<p>The {city} ZIP codes hold about {c_roofs} one unit roofs. Their ages follow the year each home was built and the storms that replaced roofs in waves.</p>`,
        `<p>{c_stormSentence} {c_femaSentence}</p>`,
        `<p>Roofs that came through a hurricane or hail and are near twenty years old are worth an inspection before the next season. Every reroof needs a permit, and residential roofing of $7,500 or more needs the LSLBC license.</p>`],
      faq: [
        { q: 'Do I need a permit to replace my roof in {city}?', a: 'Yes. Every roof and reroof in Louisiana needs a permit and inspections.' }] },
  ];

  /* Spanish: landing pages only, built when someone at the company speaks Spanish with customers. The license and office repeat in Spanish. */
  const ES = {
    breadcrumbs: 'Inicio',
    trust: ['Licencia LSLBC {lic}', 'Oficina en {officeCity}', 'Hablamos español'],
    form: { button: 'Pedir una inspección', consent: 'Acepto que {brand} me llame, me envíe mensajes de texto o correos sobre esta solicitud. Pueden aplicarse tarifas de mensajes y datos. Responda STOP para dejar de recibir mensajes. Dar este consentimiento no es condición de compra.', fields: [{ id: 'name', label: 'Nombre completo', type: 'text', required: true }, { id: 'phone', label: 'Teléfono', type: 'tel', required: true }, { id: 'email', label: 'Correo electrónico', type: 'email', required: false }, { id: 'address', label: 'Dirección de la propiedad', type: 'text', required: true }, { id: 'message', label: 'Qué le pasa a su techo', type: 'textarea', required: false }] },
    cta: { label: 'Pedir una inspección', phone_label: 'Llame al {phone}' },
    aq: '¿Cómo trabajamos?',
    answer: {
      replace: 'Inspeccionamos el techo, le damos un presupuesto detallado por escrito con materiales, retiro del techo viejo, reparación de la base, ventilación y permiso, y sacamos el permiso antes de empezar. Todo trabajo de techo en Luisiana necesita permiso e inspecciones.',
      storm: 'No se suba al techo. Tome fotos del daño desde el suelo y por dentro, y proteja la casa con una lona. Inspeccionamos, documentamos el daño con fotos y le damos un presupuesto detallado. Su aseguradora decide la cobertura; la ley de Luisiana prohíbe a los techadores interpretar pólizas, manejar reclamos o pagar el deducible.',
      repair: 'El agua viaja antes de gotear. Buscamos el origen de la gotera, paramos el agua y le damos un presupuesto por escrito para la reparación.',
      general: 'Inspeccionamos su techo, le explicamos lo que encontramos con fotos y le damos un presupuesto detallado por escrito. Sacamos el permiso para cada trabajo.' },
    facts: { permitV: 'Permiso', permit: 'para cada techo y cada reemplazo de techo en Luisiana, con las inspecciones que exige la ley', permitSrc: 'Ley 239 de 2025', office: 'nuestra oficina', lic: 'licencia de la Junta de Licencias de Contratistas de Luisiana (LSLBC)' },
    features: [{ title: 'Presupuesto por escrito', text: 'Cada precio detallado, para que pueda comparar.' }, { title: 'Permiso e inspecciones', text: 'Sacamos el permiso y pasamos las inspecciones.' }, { title: 'Hablamos español', text: 'Le atendemos en español de principio a fin.' }],
    faq: [{ id: 'lic', q: '¿Cómo verifico la licencia de un techador?', a: 'Busque la compañía o el número de licencia en el sitio web de la Junta de Licencias de Contratistas de Luisiana (LSLBC). Los trabajos de techo residencial de 7,500 dólares o más requieren licencia.' },
      { id: 'ded', q: '¿Pueden pagar mi deducible?', a: 'No. La ley de Luisiana prohíbe que un contratista pague, perdone o reembolse el deducible del seguro.' },
      { id: 'cancel', q: '¿Puedo cancelar un contrato firmado en mi casa?', a: 'Una venta de 25 dólares o más hecha en su casa se puede cancelar dentro de tres días hábiles.' }],
    formHead: 'Pida una inspección',
    band: { heading: 'Hablemos de su techo.', text: 'Le damos un presupuesto detallado por escrito.' },
    notice: '{brand}. Licencia de la Junta de Licencias de Contratistas de Luisiana {lic}. Oficina: {officeAddr}. Cada trabajo de techo lleva permiso e inspecciones según la ley de Luisiana. Esta página es información general sobre techos, no asesoría de seguros ni legal; su aseguradora decide la cobertura de su póliza.',
  };
  const FIELDS = [{ id: 'name', label: 'Full name', type: 'text', required: true }, { id: 'phone', label: 'Phone', type: 'tel', required: true }, { id: 'email', label: 'Email', type: 'email', required: false }, { id: 'address', label: 'Property address', type: 'text', required: true }, { id: 'message', label: 'What is going on with the roof', type: 'textarea', required: false }];
  const CONSENT = 'I agree that {brand} may call, text or email me about this request. Message and data rates may apply. Reply STOP to opt out of texts. Consent is not a condition of any purchase.';
  const NOTICE = '{brand}. Louisiana State Licensing Board for Contractors license {lic}. Office: {officeAddr}. Every roofing job is permitted and inspected as Louisiana law requires. This page is general information about roofing, not insurance or legal advice; your insurer decides coverage under your policy.';
  const RESULTS_NOTE = 'Customer statements are shared with permission and describe one job. Every roof is different.';
  return { LAWPUB, STEPS, AC, HOME_FAQ, CITY_FAQ, PARISH_FAQ, STORM_FAQ, STORM_LATE_FAQ, GUIDES, ES, FIELDS, CONSENT, NOTICE, RESULTS_NOTE };
})();
