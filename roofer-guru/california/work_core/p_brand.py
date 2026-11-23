import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('01_brand.js', [
 ("""/* Brand neutral by default: no company is named until you fill the Company panel. The name, LSLBC license number and
   classifications, qualifying party, office cities, colors and links flow into the shell, the Campaign Desk, the Site Forge,
   the Compliance Satchel and the connectors. Everything persists in this browser only. */""",
  """/* Brand neutral by default: no company is named until you fill the Company panel. The name, CSLB license number and
   classifications (C-39 Roofing), qualifying individual, workers' compensation, office cities, colors and links flow into
   the shell, the Campaign Desk, the Site Forge, the Compliance Satchel and the connectors. Everything persists in this
   browser only, under the key cg.brand.v1. The default map point is Sacramento. */"""),
 ("""contact: '', lic: '', licClass: '', juris: 'Louisiana',
  street: '', city: '', state: 'LA', zip: '', lat: 30.4515, lon: -91.1871,
  offices: '', hours: '', founded: null,
  languages: 'English', warranty: '', financing: '', certs: '', fortified: '',""",
  """contact: '', lic: '', licClass: '', juris: 'California',
  street: '', city: '', state: 'CA', zip: '', lat: 38.5816, lon: -121.4944,
  offices: '', hours: '', founded: null,
  languages: 'English', warranty: '', financing: '', certs: '', harden: '', wc: '', his: '',"""),
 ("store.get('up.brand.v1', null)", "store.get('cg.brand.v1', null)"),
 ("""/* the mark: a roof ridge lifting off its walls, wind lines underneath (uplift is how a roof fails, and how a company grows) */""",
  """/* the mark: a roof ridge over its walls, a sun above the ridge and two lines of weather at the eave */"""),
 ("""const sub = brandSet() ? `Uplift Louisiana Roofing Atlas · ${esc(BRAND.city || 'Louisiana')}${BRAND.lic ? ' · LSLBC license ' + esc(BRAND.lic) : ''}` : 'Roofing demand intelligence for all 64 parishes: roof age, storms, eleven service lines, ZIP heatmaps for ads and SEO';
      bm.innerHTML = `<div class="logo" id="brandLogo"></div><div><div class="nm">${brandSet() ? esc(BRAND.name) : 'Uplift'}</div><div class="sb">${sub}</div></div>`;""",
  """const sub = brandSet() ? `${ATLAS.name} · ${esc(BRAND.city || ATLAS.state)}${BRAND.lic ? ' · CSLB license ' + esc(BRAND.lic) : ''}` : `Roofing demand intelligence for all ${NCOUNTY} counties: roof age, weather and wildfire, insurance, ${numWord(NLINE)} service lines, ZIP heatmaps for ads and SEO`;
      bm.innerHTML = `<div class="logo" id="brandLogo"></div><div><div class="nm">${brandSet() ? esc(BRAND.name) : ATLAS.name}</div><div class="sb">${sub}</div></div>`;"""),
 ("""try { document.title = brandSet() ? `${brandShort()} · Uplift Roofing Atlas` : 'Uplift Roofing Atlas'; } catch (e) { }""",
  """try { document.title = brandSet() ? `${brandShort()} · ${ATLAS.name}` : ATLAS.name; } catch (e) { }"""),
 ("store.set('up.brand.v1', s)", "store.set('cg.brand.v1', s)"),
 ("store.set('up.brand.v1', {})", "store.set('cg.brand.v1', {})"),
 ("""<p>Brand neutral until you fill it in. Since August 1, 2026 anyone who advertises, solicits, quotes, bids or performs residential roofing worth $7,500 or more must hold the LSLBC Residential Roofing or Residential Construction classification (Act 757 of 2026); the Desk, the Forge and the Satchel read the license from here. Saved in this browser only.</p>""",
  """<p>Brand neutral until you fill it in. In California a contractor's license is needed for any job priced at $1,000 or more, and for a smaller one that needs a permit or uses an employee (Business and Professions Code 7048); roofing is the C-39 classification, and the license number must appear in every contract, bid and advertisement (section 7030.5). The Desk, the Forge and the Satchel read the license from here. Saved in this browser only.</p>"""),
 ("""${f('name', 'Company name (as licensed with the LSLBC)', BRAND.name, 'text', 'Use the name on the license and the contracts; a trade name that differs from the licensed name confuses license lookups.')}""",
  """${f('name', 'Company name (as licensed with the CSLB)', BRAND.name, 'text', 'Use the business name on the license and the contracts; a trade name that differs from the licensed name confuses license lookups.')}"""),
 ("""${f('contact', 'Qualifying party or owner, full name', BRAND.contact, 'text', 'The person who answers for the license; shown on the About page and in the Satchel checks.')}
      ${f('lic', 'LSLBC license number', BRAND.lic, 'text', 'Consumers verify it on the LSLBC Contractor Search. The Satchel flags residential roofing ads that carry no license reference.')}${f('licClass', 'License classifications', BRAND.licClass, 'text', 'For example: Residential Roofing; Residential Building; Commercial: Roofing and Sheet Metal.')}${f('juris', 'States licensed', BRAND.juris, 'text', 'Louisiana plus any other state where you hold a contractor license.')}""",
  """${f('contact', 'Qualifying individual or owner, full name', BRAND.contact, 'text', 'The responsible managing officer or employee, or the owner, who qualifies the license; shown on the About page and in the Satchel checks.')}
      ${f('lic', 'CSLB license number', BRAND.lic, 'text', 'Consumers verify it on the CSLB Check a License page. The Satchel flags roofing ads that carry no license number.')}${f('licClass', 'License classifications', BRAND.licClass, 'text', 'For example: C-39 Roofing; B General Building; C-46 Solar; C-43 Sheet Metal.')}${f('juris', 'States licensed', BRAND.juris, 'text', 'California plus any other state where you hold a contractor license.')}
      ${f('wc', 'Workers\\' compensation carrier and policy', BRAND.wc, 'text', 'A C-39 license needs a workers\\' compensation certificate on file even with no employees (Business and Professions Code 7125).')}${f('his', 'Home improvement salespeople registered (names or numbers)', BRAND.his, 'text', 'Anyone who solicits or signs home improvement contracts for the company must be registered with the CSLB (section 7152), with few exceptions.')}"""),
 ("""${f('languages', 'Languages served', BRAND.languages, 'text', 'Spanish and Vietnamese pages and ads are built only when you serve those languages.')}""",
  """${f('languages', 'Languages served', BRAND.languages, 'text', 'Spanish, Chinese, Vietnamese, Tagalog, Korean and other pages and ads are built only when you serve those languages.')}"""),
 ("""${f('fortified', 'FORTIFIED status', BRAND.fortified, 'text', 'For example: FORTIFIED Roof certified roofer (IBHS). Leave blank if not certified.')}""",
  """${f('harden', 'Wildfire hardening credentials', BRAND.harden, 'text', 'For example: Class A assemblies installed to the manufacturer listing; ember resistant vents; training or a designation you hold by its exact name. Leave blank if none.')}"""),
 ("""const st = document.getElementById('brand-style')""", """const st = document.getElementById('brand-style')""", 0),
])
