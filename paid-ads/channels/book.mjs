/* The channel book: every paid channel a business in the United States can buy, as a paid media specialist needs it.

   For each channel: what it is for, how it is bought, how finely it targets, what it costs to enter, the ad formats with
   their limits and call to action options, the rules that trip people, and whether a home service contractor can use it
   at all. The gate (lib/copy.mjs) reads the limits from here.

   Every limit carries a grade for how it is known:
     A   read on the platform's own page on the date in `read`
     B   the platform's own page, seen only as an excerpt (the page would not load whole)
     D   from memory: check it in the platform before launch
   Platforms change these without notice. `read` says when and where each was checked; when a figure matters and the date
   is old, read the page again before you rely on it.

   `minDaily`, where a channel has it, is a daily budget the platform itself will not go under, read at its source.

   `fits` is judgment, 0 to 3, for five kinds of work: emergency (the heat is out), considered (a replacement quote),
   maintenance (tune ups, plans, air quality), b2b (property managers, light commercial), recruiting. `desk` names the
   Campaign Desk platform the channel maps to, when the dashboard's desk plans it. */

export const READ = '2026-11-14';

const g = 'https://support.google.com/google-ads/answer/';
export const CHANNELS = [
  /* ============================ search ============================ */
  { id: 'google_search', name: 'Google Search', group: 'Search', desk: 'google', status: 'open',
    for: 'Demand capture: someone is searching for the service now. First dollars for every emergency and replacement line.',
    buy: 'Auction, cost per click. Start on Search only (partners and display off). Start on Maximize clicks with a maximum CPC bid limit: the limit caps a click and the ZIP bid adjustments apply on top of it. Smart Bidding (Maximize conversions, Target CPA, Target ROAS) needs conversion data, about 30 conversions in 30 days, and does not use manual bid adjustments at all, so a plan that steers by ZIP adjustments loses them the day the strategy changes.',
    geo: 'ZIP codes, cities, counties, radius. Location bid adjustments from minus 90% to plus 900%, in force under Maximize clicks and manual bidding only. Target people in the area, not people interested in it.',
    floor: 'No platform minimum. A campaign learns on about 10 clicks a day: at the desk\'s $9.68 benchmark click that is about $100 a day a campaign.',
    fits: { emergency: 3, considered: 3, maintenance: 1, b2b: 2, recruiting: 1 },
    formats: [
      { id: 'rsa', name: 'Responsive search ad', fields: {
        headlines: { label: 'Headline', max: 30, count: [3, 15], want: 10, grade: 'A' },
        descriptions: { label: 'Description', max: 90, count: [2, 4], want: 4, grade: 'A' },
        path1: { label: 'Path 1', max: 15, grade: 'A' }, path2: { label: 'Path 2', max: 15, grade: 'A' } },
        notes: ['Google shows up to three headlines and two descriptions, in any order, unless an asset is pinned.', 'Only Headline position 1, Headline position 2 and Description position 1 always show. An asset pinned to Headline 3 or Description 2 is not shown in every ad.', 'Pinning lowers ad strength. Pin what the law needs to show (a license number) and little else.', 'Double width characters count as two.'] },
      { id: 'sitelink', name: 'Sitelink asset', fields: { text: { label: 'Link text', max: 25, grade: 'A' }, d1: { label: 'Description line 1', max: 35, grade: 'A' }, d2: { label: 'Description line 2', max: 35, grade: 'A' } }, notes: ['Both description lines or neither.', 'No two sitelinks with the same text; no exclamation marks; each one goes to its own page.', 'At least 2 to show; write 4 to 6.'] },
      { id: 'callout', name: 'Callout asset', fields: { text: { label: 'Callout', max: 25, grade: 'A' } }, notes: ['Up to 10 can show. A callout is a fact, not a slogan.'] },
      { id: 'snippet', name: 'Structured snippet asset', fields: { values: { label: 'Value', max: 25, count: [3, 10], grade: 'A' } }, headers: ['Amenities', 'Brands', 'Courses', 'Degree programs', 'Destinations', 'Featured hotels', 'Insurance coverage', 'Models', 'Neighborhoods', 'Service catalog', 'Shows', 'Styles', 'Types'],
        /* the same thirteen as Google's Spanish help page lists them, in the same order */
        headersEs: ['Servicios', 'Marcas', 'Cursos', 'Carreras universitarias', 'Destinos', 'Hoteles destacados', 'Cobertura de seguros', 'Modelos', 'Barrios', 'Catálogo de servicios', 'Programas', 'Estilos', 'Tipos'],
        notes: ['The header must be one of Google\'s thirteen. For a list of services it is "Service catalog". "Services" is not a header and is refused.', 'Google names the headers in each language. In Spanish, "Service catalog" is "Catálogo de servicios", and "Servicios" is the header for amenities: a Spanish list of services under "Servicios" is filed as amenities.', 'At least 3 values; Google suggests 4 or more.'] },
      { id: 'call', name: 'Call asset', fields: {}, notes: ['A phone number and its country, nothing else. No vanity or premium numbers; the number must be findable on the site.', 'Count calls of 60 seconds or more as conversions.'] },
      { id: 'price', name: 'Price asset', fields: { header: { label: 'Header', max: 25, grade: 'A' }, description: { label: 'Description', max: 25, grade: 'A' } }, notes: ['3 to 8 items. Use only for prices the business confirmed and the landing page shows.'] },
    ],
    cta: null,
    rules: ['Call ads (call only ads) can no longer be created: Google removed the option in February 2026 and existing ones stop serving in February 2027. Phone calls come from call assets on responsive search ads.', 'No phone number in ad text. No emoji, no repeated punctuation, no bullets or symbols, no gimmicky capitals. A generic call to action such as "click here" is refused under Style and spelling.', 'Keep exclamation marks out of headlines (long standing editorial practice; the dashboard\'s own rule GGL1).', 'A competitor\'s name may be bought as a keyword. It may not appear in the ad text once the owner objects, so leave it out.', 'Negative keywords do not match close variants: add the plural and the synonym yourself.', 'Match types today: exact matches the same meaning or intent, phrase matches searches that include the meaning, broad matches related searches. Broad only with smart bidding and conversion data.'],
    measure: 'Calls from ads of 60 seconds or more, calls from the site through a forwarding number, form submits on the thank you page, booked jobs imported weekly as offline conversions with their value.',
    read: [{ what: 'responsive search ad counts, limits and pinning', url: g + '7684791', grade: 'A' }, { what: 'sitelinks', url: g + '2375416', grade: 'A' }, { what: 'callouts', url: g + '6079510', grade: 'A' }, { what: 'structured snippet headers', url: g + '6280012', grade: 'A' }, { what: 'call ads withdrawn', url: g + '6341403', grade: 'A' }, { what: 'editorial: punctuation and symbols', url: 'https://support.google.com/adspolicy/answer/14847994', grade: 'A' }, { what: 'trademarks', url: 'https://support.google.com/adspolicy/answer/6118', grade: 'A' }, { what: 'match types and negatives', url: g + '7478529', grade: 'A' }, { what: 'bid adjustments, and which bid strategies use them', url: g + '2732132', grade: 'A' }, { what: 'Maximize clicks and its maximum CPC bid limit', url: g + '6268626', grade: 'A' }, { what: 'structured snippet headers in Spanish', url: g + '6280012?hl=es', grade: 'A' }, { what: 'Google Ads Editor CSV columns', url: 'https://support.google.com/google-ads/editor/answer/57747', grade: 'A' }] },

  { id: 'microsoft_search', name: 'Microsoft Advertising (Bing)', group: 'Search', desk: 'microsoft', status: 'open',
    for: 'The same searches on Bing, at lower volume and usually a lower click price. Older, desktop heavy searchers: good for replacement and commercial lines.',
    buy: 'Auction, cost per click. Import the Google campaigns, then set its own budget. Audience network off at launch.',
    geo: 'ZIP codes, cities, metro areas, states. Up to 10,000 location targets a campaign.',
    floor: 'No minimum. Expect a tenth to a fifth of Google\'s volume in a metro.',
    fits: { emergency: 2, considered: 2, maintenance: 1, b2b: 2, recruiting: 0 },
    formats: [
      { id: 'rsa', name: 'Responsive search ad', fields: { headlines: { label: 'Headline', max: 30, count: [3, 15], want: 10, grade: 'A' }, descriptions: { label: 'Description', max: 90, count: [2, 4], want: 4, grade: 'A' }, path1: { label: 'Path 1', max: 15, grade: 'A' }, path2: { label: 'Path 2', max: 15, grade: 'A' } }, notes: ['The same limits as Google, so one sheet serves both.'] },
      { id: 'multimedia', name: 'Multimedia or audience ad', fields: { headlines: { label: 'Short headline', max: 30, count: [1, 15], grade: 'A' }, longHeadlines: { label: 'Long headline', max: 90, count: [1, 5], grade: 'A' }, descriptions: { label: 'Ad text', max: 90, count: [1, 5], grade: 'A' }, business: { label: 'Business name', max: 25, grade: 'A' } } },
    ],
    cta: null,
    rules: ['Import from Google Ads is supported and brings campaigns, ad groups, ads, keywords, negatives, locations, schedules and assets. Check budgets and bids after every import: they copy over at Google\'s levels.', 'Same editorial practice as Google.'],
    measure: 'UET tag with the same conversion actions as Google; import offline conversions the same way.',
    read: [{ what: 'responsive search ads', url: 'https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad?view=bingads-13', grade: 'A' }, { what: 'import from Google Ads', url: 'https://learn.microsoft.com/en-us/advertising/guides/google-ads-import?view=bingads-13', grade: 'A' }, { what: 'location targeting', url: 'https://learn.microsoft.com/en-us/advertising/guides/show-ads-target-audience?view=bingads-13', grade: 'A' }] },

  { id: 'lsa', name: 'Google Local Services Ads', group: 'Search', desk: 'lsa', status: 'open',
    for: 'The box above the search ads: pay per lead, the Google screened badge, calls. For repair and heating calls it usually books best.',
    buy: 'Pay per valid lead (call, message or booking); the price moves with place, job type and lead type. Since August 2026 Google has been moving home service advertisers into Google Ads: there the weekly budget becomes a daily average, a maximum price per lead can no longer be set by hand, and manual lead disputes are gone.',
    geo: 'One service area for the profile: a ZIP list, cities or counties. No bids by ZIP.',
    floor: 'No minimum budget. Ranking follows answer rate, reviews, proximity and hours, not budget: a profile that misses calls falls.',
    fits: { emergency: 3, considered: 2, maintenance: 1, b2b: 0, recruiting: 0 },
    formats: [{ id: 'profile', name: 'Profile', fields: { bio: { label: 'Business bio', max: 500, grade: 'D' } }, notes: ['Google publishes no bio limit; 500 characters is the dashboard\'s working figure.', 'Up to 6 bio highlights.', 'Job types for HVAC: repair AC, install AC, AC maintenance, repair heating system, install heating system, heating maintenance, HVAC maintenance, repair HVAC, repair or install thermostat, repair, install or clean ducts and vents, ductless heating and AC services.'] }],
    cta: null,
    rules: ['HVAC is an urgent category: business and owner checks, general liability insurance, the state license and background checks on the people who go to homes. Verification takes three to four weeks, so start it before the season.', 'A missed call is charged when the customer stays on the line more than 20 seconds. A repeat contact inside 15 days is not charged again.', 'Never answer with a call center that cannot book: the answer rate is the ranking.'],
    measure: 'Leads in the Local Services inbox or Google Ads; mark each lead booked or not, weekly. That feedback is the only optimisation lever.',
    read: [{ what: 'HVAC eligibility', url: 'https://support.google.com/localservices/answer/6224841', grade: 'A' }, { what: 'screening', url: 'https://support.google.com/localservices/answer/12174778', grade: 'A' }, { what: 'how leads are charged', url: 'https://support.google.com/localservices/answer/7195435', grade: 'A' }, { what: 'move into Google Ads', url: g + '17213585', grade: 'A' }, { what: 'job type ids', url: 'https://developers.google.com/google-ads/api/data/codes-formats', grade: 'A' }] },

  { id: 'pmax', name: 'Google Performance Max', group: 'Search', desk: null, status: 'open',
    for: 'One campaign across Search, Maps, YouTube, Display, Discover and Gmail. Worth testing only after Search has conversion data and offline conversions are imported; before that it buys cheap, weak leads.',
    buy: 'Automated bidding to a conversion goal. With store goals it also buys Promoted Places pins on Waze.',
    geo: 'ZIP codes, cities, radius; presence targeting.',
    floor: 'No minimum. As a rule of thumb three times the target cost per lead a day, for six weeks.',
    fits: { emergency: 1, considered: 2, maintenance: 2, b2b: 1, recruiting: 0 },
    formats: [{ id: 'assets', name: 'Asset group', fields: { headlines: { label: 'Headline', max: 30, count: [3, 15], grade: 'A' }, longHeadlines: { label: 'Long headline', max: 90, count: [1, 5], grade: 'A' }, descriptions: { label: 'Description', max: 90, count: [2, 5], grade: 'A' }, business: { label: 'Business name', max: 25, grade: 'A' } }, notes: ['At least one headline of 15 characters or fewer and one description of 60 or fewer.', 'Images, a square logo and, ideally, a video: without one Google makes its own.'] }],
    cta: ['Apply now', 'Book now', 'Contact us', 'Get quote', 'Learn more', 'Sign up', 'Visit site'],
    rules: ['Add the brand name as a campaign negative so it does not take credit for people who were already looking for the company.', 'It cannibalises Search when both run on the same terms: watch the Search campaign\'s impression share after launch.'],
    measure: 'Only as good as the conversion fed to it: booked jobs with value, not form fills.',
    read: [{ what: 'asset requirements', url: 'https://developers.google.com/google-ads/api/performance-max/asset-requirements', grade: 'A' }, { what: 'Waze through store goals', url: g + '12971048', grade: 'A' }] },

  /* ============================ video and display on Google ============================ */
  { id: 'demand_gen', name: 'Google Demand Gen', group: 'Video and display', desk: 'dg', status: 'open',
    for: 'Image and video ads on YouTube, Shorts, Discover and Gmail to people who look like buyers. Demand creation for replacement, maintenance plans and indoor air.',
    buy: 'Auction, optimised to clicks or conversions. Video action campaigns were folded into Demand Gen in May 2026.',
    geo: 'The same Google locations, ZIP codes included.',
    floor: 'No minimum. As a rule of thumb about $50 a day a campaign to leave learning.',
    fits: { emergency: 0, considered: 2, maintenance: 2, b2b: 1, recruiting: 1 },
    formats: [
      { id: 'image', name: 'Single image ad', fields: { headlines: { label: 'Headline', max: 40, rec: 30, count: [1, 5], grade: 'A' }, descriptions: { label: 'Description', max: 90, count: [1, 5], grade: 'A' }, business: { label: 'Business name', max: 25, grade: 'A' } }, notes: ['Keep at least one headline to 30 characters or fewer, or the ad cannot serve on Display and ad strength reads Incomplete.'] },
      { id: 'video', name: 'Video ad', fields: { headline: { label: 'Headline', max: 40, grade: 'A' }, longHeadline: { label: 'Long headline', max: 90, grade: 'A' }, description: { label: 'Description', max: 90, grade: 'A' }, business: { label: 'Business name', max: 25, grade: 'A' } } },
    ],
    cta: ['Apply now', 'Book now', 'Contact us', 'Get quote', 'Learn more', 'Sign up', 'Visit site'],
    rules: ['Build custom segments from the campaign\'s own keywords and in market Home Services audiences.', 'Video shows the real crew and truck with the license number on the door.'],
    measure: 'View through conversions flatter this channel. Judge it on booked jobs from engaged view conversions and on the lift in branded search.',
    read: [{ what: 'image ad specs', url: g + '17091672', grade: 'A' }, { what: 'video ad specs', url: g + '17141078', grade: 'A' }] },

  { id: 'youtube', name: 'YouTube video', group: 'Video and display', desk: 'dg', status: 'open',
    for: 'Reach in the ZIPs you serve before the season turns: the name people remember when the system fails.',
    buy: 'Cost per thousand views or per view. Skippable in stream (skip after 5 seconds), non skippable 15 seconds (30 on connected TV), 6 second bumpers, in feed, Shorts.',
    geo: 'ZIP codes and radius.',
    floor: 'No minimum. As a rule of thumb $20 to $30 a day carries bumpers across a handful of ZIPs.',
    fits: { emergency: 0, considered: 2, maintenance: 2, b2b: 0, recruiting: 1 },
    formats: [
      { id: 'instream', name: 'In stream or bumper', fields: { headline: { label: 'Headline', max: 90, rec: 30, grade: 'A' }, description: { label: 'Description', max: 90, grade: 'A' }, cta: { label: 'Call to action', max: 10, grade: 'A' }, script: { label: 'Script', grade: 'A' } }, seconds: [6, 15, 30], notes: ['The call to action button holds 10 characters: "Book now", "Call now", "Get quote".', 'Say the name and the offer in the first five seconds, before the skip.'] },
      { id: 'infeed', name: 'In feed', fields: { headline: { label: 'Headline', max: 80, rec: 40, grade: 'A' }, description: { label: 'Description', max: 70, rec: 35, grade: 'A' } }, notes: ['Two lines of 40 for the headline and two of 35 for the description.'] },
    ],
    cta: null,
    rules: ['The license number is on screen or spoken in every spot (the dashboard\'s license rule covers all advertising).', 'Captions on: most views are muted.'],
    measure: 'Branded search volume and direct calls in the ZIPs bought, against ZIPs not bought.',
    read: [{ what: 'video ad formats', url: g + '2375464', grade: 'A' }, { what: 'in stream text', url: g + '10581234', grade: 'A' }, { what: 'connected TV lengths', url: g + '11462260', grade: 'A' }] },

  { id: 'google_display', name: 'Google Display', group: 'Video and display', desk: null, status: 'open',
    for: 'Remarketing to site visitors from the last 30 days. Cold display to strangers rarely pays for a local contractor.',
    buy: 'Cost per click or per thousand views.',
    geo: 'ZIP codes and radius.', floor: 'A few dollars a day covers a remarketing list.',
    fits: { emergency: 0, considered: 2, maintenance: 1, b2b: 1, recruiting: 0 },
    formats: [{ id: 'responsive', name: 'Responsive display ad', fields: { headlines: { label: 'Headline', max: 30, count: [1, 5], grade: 'A' }, longHeadline: { label: 'Long headline', max: 90, grade: 'A' }, descriptions: { label: 'Description', max: 90, count: [1, 5], grade: 'A' }, business: { label: 'Business name', max: 25, grade: 'A' } }, notes: ['Uploaded banners: 300x250, 728x90, 320x50, 300x600, 160x600; GIF, JPG or PNG; 150 KB at most.'] }],
    cta: null,
    rules: ['Exclude mobile app placements and children\'s content.', 'A remarketing list is off limits in a special ad category campaign.'],
    measure: 'View through conversions only as a footnote.',
    read: [{ what: 'responsive display ads', url: g + '17090561', grade: 'A' }, { what: 'uploaded sizes', url: g + '1722096', grade: 'A' }] },

  /* ============================ social ============================ */
  { id: 'meta', name: 'Meta (Facebook and Instagram)', group: 'Social', desk: 'meta', status: 'open',
    for: 'Demand creation by ZIP: replacement before the system fails, maintenance plans, indoor air, the first builder system. Poor for an emergency: nobody scrolls for a furnace repair.',
    buy: 'Auction, cost per thousand views, optimised to leads, calls or conversions. Lead forms convert cheaply and book poorly: ask one qualifying question.',
    geo: 'ZIP codes (up to 50,000, written US:75150), cities with a radius, pins from 1 mile. No ZIPs in a special ad category.',
    floor: 'As a rule of thumb $15 to $20 a day an ad set. The dashboard\'s Heat Desk holds Meta to $450 a month before it folds the money into search.',
    fits: { emergency: 1, considered: 3, maintenance: 3, b2b: 1, recruiting: 3 },
    formats: [
      { id: 'feed', name: 'Feed image or video', fields: { primary: { label: 'Primary text', max: 1024, rec: 125, grade: 'A' }, headline: { label: 'Headline', max: 255, rec: 40, grade: 'A' }, description: { label: 'Description', max: 255, rec: 30, grade: 'A' } }, notes: ['The hard limits are the ones Meta documents for flexible creatives (1,024 for body text, 255 for a title or description). What matters is what shows.', 'Facebook Feed shows about 125 characters of primary text before "See more" and recommends a 27 character headline; Instagram Feed takes a 40 character headline. Put the point in the first 125 characters.', 'The description shows on few placements. Do not put anything the ad needs there.', 'Image 4:5 at 1440 by 1800.'] },
      { id: 'lead', name: 'Lead ad (instant form)', fields: { primary: { label: 'Primary text', max: 1024, rec: 125, grade: 'A' }, headline: { label: 'Headline', max: 255, rec: 40, grade: 'A' } }, cta: ['Get quote', 'Sign up', 'Learn more', 'Apply now'], ctaAll: ['Apply now', 'Download', 'Get quote', 'Learn more', 'Sign up', 'Subscribe'], notes: ['The form must link the business\'s privacy policy.', 'Consent to calls and texts goes in a custom disclaimer with an unchecked box, in the dashboard\'s own consent wording.'] },
    ],
    cta: ['Get quote', 'Call now', 'Book now', 'Contact us', 'Request time', 'Get offer', 'Send message', 'Apply now'],
    ctaAll: ['Download', 'Subscribe', 'Apply now', 'Check availability', 'Learn more', 'Shop now', 'Book now', 'Order now', 'Watch more', 'See details', 'Send WhatsApp message', 'Send message', 'Sign up', 'See menu', 'Get directions', 'Get quote', 'Listen now', 'Contact us', 'Donate now', 'Get offer', 'Call now', 'Request time', 'Get tickets'],
    rules: ['An ad that offers financing or credit belongs in the Financial products and services special ad category: locations of 15 miles or wider, no ZIP codes, no age or gender choices, no lookalikes. Keep financing out of ZIP targeted ad sets or run it in its own campaign.', 'Personal attributes: never say or imply what the reader is or owes. "Is your furnace 20 years old?" is fine; "Struggling with bills?" is not.', 'Calls ads need a phone number from the country they target and an audience of 18 or older.'],
    measure: 'Conversions API with the pixel; score leads booked or not and send that back. Judge by cost per booked job, never by cost per lead.',
    read: [{ what: 'feed text', url: 'https://www.facebook.com/business/ads-guide/update/image/facebook-feed/outcome-leads', grade: 'A' }, { what: 'call to action types', url: 'https://developers.facebook.com/docs/marketing-api/reference/ad-creative-link-data-call-to-action/', grade: 'A' }, { what: 'lead ad buttons', url: 'https://developers.facebook.com/docs/marketing-api/guides/lead-ads/create', grade: 'A' }, { what: 'special ad categories', url: 'https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/special-ad-category', grade: 'A' }, { what: 'personal attributes', url: 'https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes/', grade: 'A' }, { what: 'ZIP targeting', url: 'https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/basic-targeting', grade: 'A' }] },

  { id: 'tiktok', name: 'TikTok', group: 'Social', desk: null, status: 'open',
    for: 'Short video to homeowners under 45: the first builder system, the new homeowner check, recruiting technicians. The dashboard\'s Campaign Desk does not plan it; its Accounts module reads its results.',
    buy: 'Auction, cost per thousand views, optimised to leads or calls.',
    geo: 'State, county, metro, city and ZIP code. Up to 3,000 locations an ad group; no exclusions.',
    floor: 'A daily budget must exceed $50 at campaign level and $20 at ad group level; a lifetime budget at ad group level is at least $20 times the days it runs. So a month of TikTok starts near $1,500, and "a small test" under $50 a day cannot be set up.',
    minDaily: 50,
    fits: { emergency: 0, considered: 1, maintenance: 2, b2b: 0, recruiting: 3 },
    formats: [{ id: 'infeed', name: 'In feed video', fields: { text: { label: 'Ad text', max: 100, grade: 'B' }, displayName: { label: 'Display name', max: 20, grade: 'A' }, script: { label: 'Script', grade: 'A' } }, seconds: [9, 15, 30], notes: ['TikTok publishes 100 characters for its reserved formats and four lines for Spark ads; hold auction ad text to 100.', 'Vertical 9:16; 9 to 15 seconds works best.', 'No links, hashtags or @ in ad text on a non Spark ad.'] }],
    cta: ['Get quote', 'Contact us', 'Book now', 'Learn more', 'Apply now'], ctaAll: ['Download', 'Learn more', 'Visit store', 'Book now', 'Shop now', 'Contact us', 'Apply now', 'Play game', 'Watch now', 'View now', 'Get quote', 'Interested', 'Install now', 'Get showtimes', 'Experience now', 'Sign up', 'Subscribe', 'Get tickets now', 'Listen now', 'Read more', 'Pre-order now', 'Order now', 'Call now'],
    rules: ['Housing, employment and credit ads in the United States: no ZIP targeting, 18 and over only, no gender. A recruiting ad is an employment ad.', 'A lead form needs the company name and a privacy policy link; a custom disclaimer carries consent.'],
    measure: 'Events API; booked jobs, as on Meta.',
    read: [{ what: 'in feed specs', url: 'https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads', grade: 'A' }, { what: 'location targeting', url: 'https://ads.tiktok.com/help/article/location-targeting', grade: 'A' }, { what: 'calls to action', url: 'https://ads.tiktok.com/resources/help/article/ad-set-up', grade: 'A' }, { what: 'minimum budgets', url: 'https://ads.tiktok.com/help/article/budget', grade: 'A' }] },

  { id: 'nextdoor', name: 'Nextdoor', group: 'Social', desk: 'nextdoor', status: 'open',
    for: 'Homeowners by neighborhood, with their real address behind the account. Strong for maintenance plans, first builder systems and hail weeks.',
    buy: 'Nextdoor Ads Manager, cost per thousand views or per click.',
    geo: 'ZIP code, city, metro or state. Reach thins out in exurban ZIPs.',
    floor: 'None published. The Heat Desk holds Nextdoor to $300 a month before it folds the money into search.',
    fits: { emergency: 1, considered: 2, maintenance: 3, b2b: 0, recruiting: 1 },
    formats: [{ id: 'newsfeed', name: 'Newsfeed ad', fields: { headline: { label: 'Headline', max: 70, grade: 'A' }, body: { label: 'Body', max: 1700, rec: 90, grade: 'A' }, cta: { label: 'Button text', max: 45, rec: 20, grade: 'A' }, advertiser: { label: 'Advertiser name', max: 70, grade: 'A' } }, notes: ['Nextdoor shows 90 characters of the body before it cuts it. The dashboard\'s desk works to a 60 character headline and a 300 character body, graded D; these are Nextdoor\'s own figures.', 'Image 1200 by 628 or 1200 by 1200.'] }],
    cta: ['Get a quote', 'Call now', 'Book now', 'Learn more'], ctaFree: true,
    rules: ['The business page must match the advertiser.', 'No excessive capitals. An ad must not imply it knows something personal about the reader.', 'Credit ads may not treat ZIP code as relevant: financing creative stays generic here too.'],
    measure: 'Nextdoor pixel or conversion API; ask "how did you hear about us" on the call, since neighbors recommend by word.',
    read: [{ what: 'creative specs', url: 'https://business.nextdoor.com/en-us/nam/nextdoor-ads-manager/creative-specs', grade: 'A' }, { what: 'ad policy', url: 'https://business.nextdoor.com/en-us/nam/nextdoor-ads-manager/ad-policy', grade: 'A' }] },

  { id: 'linkedin', name: 'LinkedIn', group: 'Social', desk: 'linkedin', status: 'open',
    for: 'Recruiting technicians, and property managers and facilities people for the commercial and rental lines. Not for homeowners.',
    buy: 'Auction, cost per click or per thousand views. Expensive clicks: use it where one account is worth thousands.',
    geo: 'Metro, county or city. No ZIP codes. An audience needs 300 members to run.',
    floor: 'About $10 a day a campaign (from memory: check); plan $50, because the clicks are dear.',
    fits: { emergency: 0, considered: 0, maintenance: 0, b2b: 3, recruiting: 3 },
    formats: [{ id: 'image', name: 'Single image ad', fields: { intro: { label: 'Introductory text', max: 3000, rec: 150, grade: 'A' }, headline: { label: 'Headline', max: 200, rec: 70, grade: 'A' }, description: { label: 'Description', max: 300, rec: 70, grade: 'A' } } }],
    cta: ['Apply', 'View quote', 'Learn more', 'Sign up'], ctaAll: ['Apply', 'Download', 'View quote', 'Learn more', 'Sign up', 'Subscribe', 'Register', 'Join', 'Attend', 'Request demo'],
    rules: ['An employment ad must not signal age or gender and cannot be targeted by age at all. Post the pay range.', 'The dashboard\'s desk keeps LinkedIn for recruiting; a customer campaign there is for the b2b and commercial lines only.'],
    measure: 'Insight Tag; for recruiting count completed applications, not clicks.',
    read: [{ what: 'single image ads', url: 'https://business.linkedin.com/marketing-solutions/success/ads-guide/single-image-ads', grade: 'A' }, { what: 'employment ads', url: 'https://www.linkedin.com/help/linkedin/answer/a416948/', grade: 'A' }] },

  { id: 'snapchat', name: 'Snapchat', group: 'Social', desk: null, status: 'open',
    for: 'Under 35s. For a contractor that means recruiting, rarely customers.',
    buy: 'Auction, cost per thousand views.', geo: 'ZIP codes and radius.', floor: 'About $5 a day an ad set (from memory: check).',
    fits: { emergency: 0, considered: 0, maintenance: 0, b2b: 0, recruiting: 2 },
    formats: [{ id: 'single', name: 'Single image or video', fields: { brand: { label: 'Brand name', max: 25, grade: 'A' }, headline: { label: 'Headline', max: 34, grade: 'A' } }, notes: ['Snap\'s pages give 25 and 32 characters for the brand name; 25 fits both.', 'Vertical 1080 by 1920.'] }],
    cta: ['Apply now', 'Book now', 'Sign up', 'Call now', 'Request quote', 'More'],
    rules: [], measure: 'Snap pixel.',
    read: [{ what: 'ad formats', url: 'https://forbusiness.snapchat.com/advertising/ad-formats', grade: 'A' }] },

  { id: 'pinterest', name: 'Pinterest', group: 'Social', desk: null, status: 'open',
    for: 'People planning a remodel or an addition: ductless, indoor air, high efficiency systems. Slow and cheap.',
    buy: 'Auction, cost per click or per thousand views.', geo: 'ZIP codes and metro areas.', floor: 'A few dollars a day.',
    fits: { emergency: 0, considered: 1, maintenance: 1, b2b: 0, recruiting: 0 },
    formats: [{ id: 'pin', name: 'Standard Pin ad', fields: { title: { label: 'Title', max: 100, rec: 40, grade: 'A' }, description: { label: 'Description', max: 800, grade: 'A' } }, notes: ['The first 40 characters of the title show in the feed. The description does not show on an ad seen up close: the image and the title carry it.', 'Image 2:3 at 1000 by 1500.'] }],
    cta: null, rules: [], measure: 'Pinterest tag.',
    read: [{ what: 'product specs', url: 'https://help.pinterest.com/en/business/article/pinterest-product-specs', grade: 'A' }] },

  { id: 'reddit', name: 'Reddit', group: 'Social', desk: null, status: 'open',
    for: 'City subreddits where people ask "who do you use for AC". Thin for a contractor; a test, not a line in the plan.',
    buy: 'Auction, cost per click or per thousand views.', geo: 'Metro areas and ZIP codes (up to 20,000 an ad group). No ZIPs for housing, employment or credit ads.', floor: 'About $5 a day (from memory: check).',
    fits: { emergency: 0, considered: 1, maintenance: 0, b2b: 0, recruiting: 1 },
    formats: [{ id: 'post', name: 'Promoted post', fields: { headline: { label: 'Headline', max: 300, rec: 100, grade: 'A' } } }],
    cta: ['Get quote', 'Contact us', 'Book now', 'Learn more'], ctaAll: ['Apply now', 'Book now', 'Buy tickets', 'Contact us', 'Donate now', 'Download', 'Get directions', 'Get quote', 'Get showtimes', 'Install', 'Learn more', 'Listen now', 'Order now', 'Play now', 'Pre-order now', 'Read more', 'See menu', 'Shop now', 'Sign up', 'Subscribe', 'Visit store', 'View more', 'Watch now'],
    rules: ['Write like a neighbor, not an ad. Comments are on by default: someone has to answer them.'], measure: 'Reddit pixel.',
    read: [{ what: 'ad specs', url: 'https://business.reddithelp.com/articles/Knowledge/Reddit-Ad-Unit-Specifications', grade: 'A' }] },

  { id: 'x', name: 'X', group: 'Social', desk: null, status: 'open',
    for: 'Weather moments: a freeze warning, a hail core. Otherwise little reach among local homeowners.',
    buy: 'Auction.', geo: 'Metro areas and postal codes.', floor: 'None published.',
    fits: { emergency: 1, considered: 0, maintenance: 0, b2b: 0, recruiting: 0 },
    formats: [{ id: 'post', name: 'Promoted post', fields: { text: { label: 'Post text', max: 280, rec: 257, grade: 'B' }, cardTitle: { label: 'Website card title', max: 70, rec: 50, grade: 'B' } }, notes: ['A link takes 23 characters of the 280.'] }],
    cta: null, rules: [], measure: 'X pixel.',
    read: [{ what: 'character counting', url: 'https://docs.x.com/fundamentals/counting-characters', grade: 'A' }] },

  /* ============================ local lead marketplaces ============================ */
  { id: 'yelp', name: 'Yelp Ads', group: 'Local leads', desk: 'yelp', status: 'open',
    for: 'People comparing contractors on Yelp. Works when the profile already has strong recent reviews; a weak profile pays for clicks that go to a competitor.',
    buy: 'Cost per click, capped by a monthly maximum; from about $5 a day. Request a Quote is free to switch on.',
    geo: 'A radius around the business, with keywords and blocked keywords.',
    floor: 'About $150 a month at Yelp\'s $5 a day; a sales call will propose more.',
    fits: { emergency: 2, considered: 2, maintenance: 1, b2b: 0, recruiting: 0 },
    formats: [{ id: 'ad', name: 'Yelp ad', fields: { text: { label: 'Custom ad text', max: 1500, rec: 200, grade: 'D' } }, notes: ['Yelp lets an advertiser choose a review, a photo or custom text. It publishes no limit for custom text; the Specialties section shows its first 200 characters.'] }],
    cta: null,
    rules: ['Never ask anyone for a Yelp review and never offer anything for one. Yelp posts a consumer alert on businesses that do.', 'Answer Request a Quote messages within the hour: the response time is shown on the profile.'],
    measure: 'Calls and messages from the Yelp for Business inbox; tag the profile\'s phone number.',
    read: [{ what: 'how Yelp charges', url: 'https://business.yelp.com/products/yelp-ads/', grade: 'A' }, { what: 'review rules', url: 'https://biz.yelp.com/support-center/article/Should-I-ask-my-customers-to-write-reviews-on-Yelp', grade: 'A' }] },

  { id: 'angi', name: 'Angi (and HomeAdvisor)', group: 'Local leads', desk: null, status: 'open',
    for: 'Bought leads by job type and ZIP. A lead is often sold to several contractors: it pays only for a team that calls back in minutes.',
    buy: 'Leads inside a monthly budget, at full price or discounted in a subscription; a lead is owed whether or not the job is won. Angi stopped selling its older advertising product in 2025.',
    geo: 'Job types and the ZIP codes served.', floor: 'Set by the monthly budget chosen.',
    fits: { emergency: 2, considered: 2, maintenance: 1, b2b: 0, recruiting: 0 },
    formats: [{ id: 'profile', name: 'Profile', fields: { bio: { label: 'Profile text', max: 1000, grade: 'D' } } }], cta: null,
    rules: ['Turn off the job types the crew does not want before the first lead arrives.', 'Track cost per booked job, not per lead: shared leads close at a fraction of an exclusive call.'],
    measure: 'Each lead marked won or lost in the field system.',
    read: [{ what: 'products and pricing', url: 'https://www.sec.gov/Archives/edgar/data/1705110/000170511026000011/angi-20251231.htm', grade: 'A' }] },

  { id: 'thumbtack', name: 'Thumbtack', group: 'Local leads', desk: null, status: 'open',
    for: 'Small and mid jobs from people who compare three quotes: tune ups, thermostat work, ductless.',
    buy: 'A price per lead shown before the lead is bought, inside a weekly budget that resets on Monday.',
    geo: 'A radius, counties, cities or ZIP codes.', floor: 'The weekly budget chosen.',
    fits: { emergency: 1, considered: 1, maintenance: 2, b2b: 0, recruiting: 0 },
    formats: [{ id: 'profile', name: 'Profile', fields: { bio: { label: 'Profile text', max: 1000, grade: 'D' } } }], cta: null,
    rules: ['A week can run over its budget by a stated margin; read the cap before setting it.'], measure: 'Leads marked hired.',
    read: [{ what: 'paying for leads', url: 'https://help.thumbtack.com/article/pay-for-leads', grade: 'A' }] },

  /* ============================ television and audio ============================ */
  { id: 'ctv', name: 'Connected TV (streaming)', group: 'Television and audio', desk: null, status: 'open',
    for: 'The living room screen, by ZIP code, for the price a local cable flight used to cost. Brand reach ahead of the season; it does not produce calls the week it runs.',
    buy: 'Cost per thousand views through self serve desks: Universal Ads (Comcast, NBCU, Fox, Paramount, Roku and others; from $100; by ZIP code), Paramount Ads Manager (from $500 a campaign; by ZIP), Disney Campaign Manager for Hulu and Disney (from $500 a campaign), Roku Ads Manager (from $500), Amazon streaming TV ads (no minimum on self serve), MNTN (no minimum), YouTube on TV screens through Google Ads. Netflix sells only directly or through the large buying platforms.',
    geo: 'ZIP codes on most desks; metro on a few.',
    floor: 'Entry is $100 to $500 a campaign on the self serve desks. As a rule of thumb, under about $2,000 a month in one metro the frequency is too low to be remembered.',
    fits: { emergency: 0, considered: 2, maintenance: 1, b2b: 0, recruiting: 0 },
    formats: [{ id: 'spot', name: '15 or 30 second spot', fields: { script: { label: 'Script', grade: 'A' } }, seconds: [15, 30], notes: ['MP4 or MOV, 1920 by 1080, 16:9. 15 and 30 seconds are taken everywhere.', 'About 2.5 spoken words a second: 35 words for 15 seconds, 70 for 30.'] }],
    cta: null,
    rules: ['The license number is on the end card or the truck door.', 'Spectrum Reach closed its self serve portal: local cable there is bought through a salesperson. Comcast retired the Effectv name; its self serve desk is Universal Ads.'],
    measure: 'Site visits and calls from the ZIPs bought, against matched ZIPs not bought. A QR code is the only direct response.',
    read: [{ what: 'Universal Ads', url: 'https://www.universalads.com/', grade: 'A' }, { what: 'Paramount Ads Manager', url: 'https://adsmanager.paramount.com/', grade: 'A' }, { what: 'Disney Campaign Manager', url: 'https://www.disneycampaignmanager.com/faq/getting-started/', grade: 'A' }, { what: 'Roku Ads Manager', url: 'https://help.ads.roku.com/en/articles/7191949', grade: 'A' }, { what: 'MNTN', url: 'https://mountain.com/', grade: 'A' }] },

  { id: 'amazon', name: 'Amazon Ads', group: 'Television and audio', desk: null, status: 'open',
    for: 'Streaming TV on Prime Video and Fire TV, and display, for a business that sells nothing on Amazon. A reach buy like any connected TV.',
    buy: 'Self serve display ads by click or by thousand views with no minimum; streaming TV by thousand views. Managed service starts near $50,000.',
    geo: 'ZIP codes on display; check the streaming desk for the smallest area.', floor: 'None on self serve.',
    fits: { emergency: 0, considered: 1, maintenance: 1, b2b: 0, recruiting: 0 },
    formats: [{ id: 'spot', name: 'Streaming TV spot', fields: { script: { label: 'Script', grade: 'B' } }, seconds: [15, 30] }], cta: null,
    rules: ['Amazon renamed its products in 2026: Sponsored Display is "display ads", Sponsored TV is "streaming TV ads".'], measure: 'Amazon\'s reach reports; calls by ZIP.',
    read: [{ what: 'display ads', url: 'https://advertising.amazon.com/products/display-ads', grade: 'A' }] },

  { id: 'spotify', name: 'Spotify', group: 'Television and audio', desk: null, status: 'open',
    for: 'Audio to commuters and people at home, by ZIP code. A reminder channel for maintenance plans and the pre season tune up.',
    buy: 'Spotify Ads Manager, cost per thousand listens. Lifetime budget from $250, daily from $15.',
    geo: 'State, city and postal code.', floor: '$250 a campaign.',
    fits: { emergency: 0, considered: 1, maintenance: 2, b2b: 0, recruiting: 1 },
    formats: [{ id: 'audio', name: 'Audio ad', fields: { script: { label: 'Script', grade: 'A' }, advertiser: { label: 'Advertiser name', max: 25, grade: 'A' }, tagline: { label: 'Tagline', max: 40, grade: 'A' } }, seconds: [30], notes: ['30 seconds at most: about 70 words. Companion image 640 by 640.', 'Say the name twice and the action once.'] }],
    cta: ['Book now', 'Get info', 'Learn more', 'Visit site', 'Get coupon'], ctaAll: ['Apply now', 'Book now', 'Buy now', 'Buy tickets', 'Click now', 'Download', 'Find stores', 'Get coupon', 'Get info', 'Learn more', 'Listen now', 'More info', 'Order now', 'Pre-save', 'Save now', 'Share', 'Shop now', 'Sign up', 'Visit profile', 'Visit site'],
    rules: ['The license number is spoken or shown on the companion image.'], measure: 'Site visits by ZIP during the flight.',
    read: [{ what: 'audio ad specs', url: 'https://ads.spotify.com/en-US/ad-specs/audio-ad-specs/', grade: 'A' }, { what: 'budgets', url: 'https://adshelp.spotify.com/s/article/Setting-your-budget-US', grade: 'A' }] },

  { id: 'audio', name: 'Streaming audio and radio', group: 'Television and audio', desk: null, status: 'open',
    for: 'Pandora and SiriusXM through AudioGo, iHeart, Audacy and local stations. Radio still reaches the 45 and over homeowner in the car.',
    buy: 'AudioGo is self serve from $250 with state, county, metro and ZIP targeting. SiriusXM direct starts at $10,000. iHeart and Audacy sell through salespeople.',
    geo: 'ZIP on AudioGo; the station\'s signal on broadcast.', floor: '$250 on AudioGo.',
    fits: { emergency: 0, considered: 1, maintenance: 2, b2b: 0, recruiting: 1 },
    formats: [{ id: 'spot', name: 'Audio spot', fields: { script: { label: 'Script', grade: 'A' } }, seconds: [15, 30], notes: ['10, 15 and 30 seconds on AudioGo. Broadcast stations also sell 60: check with the station.'] }], cta: null,
    rules: ['A spot that names a price or a financing term must carry its conditions aloud.'], measure: 'A tracked phone number or a spoken web address used nowhere else.',
    read: [{ what: 'AudioGo', url: 'https://www.audiogo.com/', grade: 'A' }, { what: 'SiriusXM audio specs', url: 'https://www.siriusxmmedia.com/audio-ad-specs', grade: 'A' }] },

  /* ============================ programmatic and offline ============================ */
  { id: 'programmatic', name: 'Programmatic display and video', group: 'Programmatic and offline', desk: null, status: 'open',
    for: 'Display, video and streaming bought through a buying platform (Display & Video 360, The Trade Desk, Amazon). Worth it once several channels need one frequency cap; overkill for one contractor in one metro.',
    buy: 'Cost per thousand views plus platform and data fees, usually through an agency seat.',
    geo: 'ZIP codes on both large platforms.', floor: 'Agency seats commonly ask for $5,000 to $10,000 a month (from memory: ask).',
    fits: { emergency: 0, considered: 1, maintenance: 1, b2b: 1, recruiting: 0 },
    formats: [{ id: 'banner', name: 'Banner', fields: { headline: { label: 'Headline', max: 30, grade: 'D' } }, notes: ['Sizes 300x250, 728x90, 320x50, 300x600, 160x600.'] }], cta: null,
    rules: ['Geofencing a competitor\'s shop or a storm swath is sold by specialist vendors; ask for a match rate and a list of the apps the location data comes from.'], measure: 'Incrementality by ZIP, not view through.',
    read: [{ what: 'Display & Video 360 ZIP targeting', url: 'https://support.google.com/displayvideo/answer/2705812', grade: 'A' }, { what: 'The Trade Desk geography lists', url: 'https://www.thetradedesk.com/resources/create-local-campaigns-in-bulk-with-geography-lists', grade: 'A' }] },

  { id: 'eddm', name: 'Every Door Direct Mail (USPS)', group: 'Programmatic and offline', desk: null, status: 'open',
    for: 'A card in every mailbox on the carrier routes you choose. The one channel that reaches the owner of a 20 year old system who is not online looking yet.',
    buy: 'Postage of $0.26 a piece (USPS price list of October 4, 2026) plus print. 200 to 5,000 pieces a day for each ZIP at the retail counter, no permit.',
    geo: 'Carrier routes inside a ZIP code, chosen by age, income and household size.', floor: 'About 200 pieces.',
    fits: { emergency: 0, considered: 2, maintenance: 3, b2b: 0, recruiting: 0 },
    formats: [{ id: 'card', name: 'Flat mail piece', fields: { headline: { label: 'Headline', max: 60, grade: 'D' }, body: { label: 'Body', max: 400, grade: 'D' }, offer: { label: 'Offer', max: 80, grade: 'D' }, cta: { label: 'Call to action', max: 60, grade: 'D' } }, notes: ['USPS sets the size, not the words: longer than 10.5 inches or taller than 6.125, no larger than 15 by 12, 3.3 ounces at most. The text limits here are a designer\'s working figures.', 'One offer, one phone number, one date.'] }], cta: null,
    rules: ['The license number is printed on the piece.', 'An offer needs its end date and conditions on the piece.', 'Pick routes from the dashboard\'s ZIP model: homes of the right age, owner occupied.'],
    measure: 'A phone number and an offer code used only on the mailing.',
    read: [{ what: 'EDDM rules and price', url: 'https://www.usps.com/business/every-door-direct-mail.htm', grade: 'A' }, { what: 'price list', url: 'https://pe.usps.com/text/dmm300/Notice123.htm', grade: 'A' }] },

  { id: 'ooh', name: 'Billboards and outdoor', group: 'Programmatic and offline', desk: null, status: 'open',
    for: 'Name recognition on the roads the trucks drive. A long commitment for a business with one metro and patience.',
    buy: 'Four week periods a board, through the owner (Lamar, Clear Channel, Outfront); digital boards by the play.',
    geo: 'The board\'s road.', floor: 'From memory, a few hundred to a few thousand dollars a board a period: ask.',
    fits: { emergency: 0, considered: 1, maintenance: 1, b2b: 0, recruiting: 1 },
    formats: [{ id: 'board', name: 'Board', fields: { headline: { label: 'Copy', max: 45, grade: 'D' } }, notes: ['Seven words or fewer. A driver has three seconds.'] }], cta: null,
    rules: ['The license number goes on the board.'], measure: 'Branded search in the board\'s ZIPs.', read: [] },

  /* ============================ closed to this kind of business ============================ */
  { id: 'apple_maps', name: 'Apple Maps ads', group: 'Not open to a home service contractor', desk: null, status: 'closed',
    for: 'Apple began selling ads in Maps in the United States in summer 2026. Its policy bars home services by name: plumbing, electrical, locksmith, HVAC, pest control, roofing and general contracting.',
    buy: 'Not available.', geo: '', floor: '', fits: { emergency: 0, considered: 0, maintenance: 0, b2b: 0, recruiting: 0 }, formats: [], cta: null,
    rules: ['Do not plan it. Keep the free Apple Business listing accurate instead.'], measure: '',
    read: [{ what: 'home services barred', url: 'https://ads.apple.com/news-and-stocks-maps-and-sports-programming-policies', grade: 'A' }] },
  { id: 'waze', name: 'Waze', group: 'Not open to a home service contractor', desk: null, status: 'closed',
    for: 'Waze stopped selling its own ads on August 31, 2023. A pin on Waze now comes only through a Google Performance Max campaign with store goals, which a contractor with no storefront cannot use.',
    buy: 'Not available on its own.', geo: '', floor: '', fits: { emergency: 0, considered: 0, maintenance: 0, b2b: 0, recruiting: 0 }, formats: [], cta: null, rules: [], measure: '',
    read: [{ what: 'Waze Ads ended', url: 'https://support.google.com/wazeads', grade: 'A' }] },
  { id: 'retail_media', name: 'Retail and app store media', group: 'Not open to a home service contractor', desk: null, status: 'closed',
    for: 'Amazon sponsored product ads, Walmart Connect, Instacart and Apple Search Ads sell placement for products on a shelf or apps in a store. A service has neither.',
    buy: 'Not applicable.', geo: '', floor: '', fits: { emergency: 0, considered: 0, maintenance: 0, b2b: 0, recruiting: 0 }, formats: [], cta: null, rules: [], measure: '', read: [] },
];

/* what the United States asks of an ad whoever runs it, with where each was read (the dashboard's own rules add Texas) */
export const LAW = [
  { id: 'reviews', rule: 'Review and rating claims must be real and current. Fake or bought reviews and undisclosed insider reviews are unlawful, with civil penalties.', cite: 'FTC Rule on Consumer Reviews and Testimonials, 16 CFR Part 465, in force since October 21, 2024', url: 'https://www.govinfo.gov/content/pkg/FR-2024-08-22/html/2024-18519.htm' },
  { id: 'free', rule: 'A "free" offer states every condition clearly at the outset, next to the offer. A footnote does not do it.', cite: 'FTC Guide Concerning Use of the Word "Free", 16 CFR 251.1', url: 'https://www.ecfr.gov/current/title-16/part-251' },
  { id: 'credit', rule: 'Naming a down payment, a number of payments, a payment amount or a finance charge triggers three disclosures in the same ad: the down payment, the terms of repayment, and the "annual percentage rate" by that name.', cite: 'Regulation Z, 12 CFR 1026.24(d)', url: 'https://www.consumerfinance.gov/rules-policy/regulations/1026/24/' },
  { id: 'texts', rule: 'Marketing texts and autodialed calls need prior express written consent, never as a condition of purchase. From November 25, 2026 an opt out in reply to one marketing message stops them all, within ten business days.', cite: '47 CFR 64.1200; FCC 26-67', url: 'https://www.govinfo.gov/content/pkg/FR-2026-10-26/html/2026-21821.htm' },
  { id: 'taxcredit', rule: 'The federal Energy Efficient Home Improvement Credit does not apply to equipment placed in service after December 31, 2025. Do not advertise it for a 2026 install.', cite: 'IRS, section 25C as amended by Public Law 119-21', url: 'https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit' },
];

export const byId = id => CHANNELS.find(c => c.id === id) || null;
/* the channel a Campaign Desk platform key maps to (the desk's "dg" is Demand Gen, with YouTube beside it) */
export const forDesk = key => CHANNELS.find(c => c.desk === key && c.id !== 'youtube') || null;
export const format = (channel, id) => { const c = typeof channel === 'string' ? byId(channel) : channel; return c ? (c.formats.find(f => f.id === id) || (id ? null : c.formats[0]) || null) : null; };

/* the fields an ad cannot go without, by channel and format; and the fields that are lists */
export const REQUIRED = {
  'meta.feed': ['primary', 'headline'], 'meta.lead': ['primary', 'headline'], 'tiktok.infeed': ['text'], 'nextdoor.newsfeed': ['headline', 'body'], 'linkedin.image': ['intro', 'headline'],
  'snapchat.single': ['brand', 'headline'], 'pinterest.pin': ['title'], 'reddit.post': ['headline'], 'x.post': ['text'], 'youtube.instream': ['script'], 'youtube.infeed': ['headline', 'description'],
  'demand_gen.image': ['headlines', 'descriptions', 'business'], 'demand_gen.video': ['headline', 'description', 'business'], 'pmax.assets': ['headlines', 'longHeadlines', 'descriptions', 'business'],
  'google_display.responsive': ['headlines', 'longHeadline', 'descriptions', 'business'], 'microsoft_search.multimedia': ['headlines', 'longHeadlines', 'descriptions', 'business'],
  'lsa.profile': ['bio'], 'yelp.ad': ['text'], 'angi.profile': ['bio'], 'thumbtack.profile': ['bio'], 'ctv.spot': ['script'], 'amazon.spot': ['script'], 'audio.spot': ['script'], 'spotify.audio': ['script', 'advertiser'],
  'eddm.card': ['headline', 'body', 'cta'], 'ooh.board': ['headline'], 'programmatic.banner': ['headline'],
};
/* spoken words a second a script can carry and still be understood */
export const WORDS_PER_SECOND = 2.6;
