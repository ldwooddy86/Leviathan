/* ==== 01_brand.js ==== */
/* ==== brand ==== */
"use strict";
/* ============================ BRAND: the roofing company this atlas is built for ============================ */
/* Brand neutral by default: no company is named until you fill the Company panel. The name, LSLBC license number and
   classifications, qualifying party, office cities, colors and links flow into the shell, the Campaign Desk, the Site Forge,
   the Compliance Satchel and the connectors. Everything persists in this browser only. */
const BRAND_DEFAULT = {
  name: '', short: '', legal: '', tagline: '',
  phone: '', url: '', domain: '', email: '',
  contact: '', lic: '', licClass: '', juris: 'Louisiana',
  street: '', city: '', state: 'LA', zip: '', lat: 30.4515, lon: -91.1871,
  offices: '', hours: '', founded: null,
  languages: 'English', warranty: '', financing: '', certs: '', fortified: '',
  colors: { primary: '#b0502a', secondary: '#e2895b', accent: '#efc6ab', dark: '#1e2933' }, fonts: { display: 'Barlow Semi Condensed', body: 'Public Sans' },
  logoUrl: '', logoData: '',
  reviews: { rating: null, count: null, asOf: '', source: '' },
  social: { facebook: '', facebookPageId: '', instagram: '', youtube: '', linkedin: '', tiktok: '', x: '', maps: '', nextdoor: '' },
  pixels: { meta: [] },
  serviceCities: [],
};
let BRAND = (() => { const s = store.get('up.brand.v1', null); const b = JSON.parse(JSON.stringify(BRAND_DEFAULT)); if (s && typeof s === 'object') { Object.keys(s).forEach(k => { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && b[k] && typeof b[k] === 'object') Object.assign(b[k], s[k]); else b[k] = s[k]; }); } return b; })();
const brandSet = () => !!(BRAND.name && BRAND.name.trim());
const brandName = () => brandSet() ? BRAND.name : 'Your company';
const brandShort = () => (BRAND.short || BRAND.name || 'Your company');
const brandOffices = () => [BRAND.city].concat(String(BRAND.offices || '').split(/[,;]\s*/)).map(s => String(s || '').trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
const BRANDX = (() => {
  const hex2rgb = h => { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const rgb2hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const lum = h => { const [r, g, b] = hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const okHex = h => /^#[0-9a-f]{6}$/i.test(String(h || ''));
  const isDefault = () => { const c = BRAND.colors, d = BRAND_DEFAULT.colors; return ['primary', 'secondary', 'accent', 'dark'].every(k => String(c[k]).toLowerCase() === d[k]); };
  function css() {
    const fontRule = `.brandmark .nm,.mast h1,.big,.kpi .kv{font-family:var(--brand-display)}`;
    const disp = BRAND.fonts && BRAND.fonts.display ? `'${BRAND.fonts.display}',` : '', body = BRAND.fonts && BRAND.fonts.body ? `'${BRAND.fonts.body}',` : '';
    const fonts = `:root{--sans:${body}'Public Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;--brand-display:${disp}'Barlow Semi Condensed','Arial Narrow',system-ui,sans-serif}`;
    if (isDefault()) return fonts + fontRule;
    const c = BRAND.colors; const P = okHex(c.primary) ? c.primary : '#b0502a', S2 = okHex(c.secondary) ? c.secondary : '#e2895b', A = okHex(c.accent) ? c.accent : '#efc6ab', Dk = okHex(c.dark) ? c.dark : '#1e2933';
    const accentInkL = lum(P) > 0.4 ? '#1c1a18' : '#ffffff', accentInkD = lum(S2) > 0.4 ? '#1b0e07' : '#ffffff';
    return fonts + `:root{--accent:${P};--accent-ink:${accentInkL};--accent-soft:${mix(P, '#ffffff', 0.86)};--navy:${Dk};--navy-2:${mix(Dk, P, 0.35)};--navy-ink:${mix(P, '#ffffff', 0.88)};--navy-mute:${mix(P, '#ffffff', 0.6)};--lime:${A}}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--accent:${S2};--accent-ink:${accentInkD};--accent-soft:${mix(S2, '#121315', 0.75)};--navy:${mix(Dk, '#000000', 0.35)};--navy-2:${Dk}}}
:root[data-theme="dark"]{--accent:${S2};--accent-ink:${accentInkD};--accent-soft:${mix(S2, '#121315', 0.75)};--navy:${mix(Dk, '#000000', 0.35)};--navy-2:${Dk}}
` + fontRule;
  }
  /* the mark: a roof ridge lifting off its walls, wind lines underneath (uplift is how a roof fails, and how a company grows) */
  function fallbackLogo(size) {
    const c = BRAND.colors; const P = okHex(c.primary) ? c.primary : '#b0502a', A = okHex(c.accent) ? c.accent : '#efc6ab', S2 = okHex(c.secondary) ? c.secondary : '#e2895b';
    return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="9" fill="${P}"/><path d="M8 21.5 20 10.5 32 21.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 25v6.5h16V25" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 27.5h4M5.5 31h5" stroke="${A}" stroke-width="1.8" stroke-linecap="round"/><path d="M20 5.5v3.2M17.6 7.2 20 4.8l2.4 2.4" fill="none" stroke="${S2}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function apply() {
    let st = document.getElementById('brand-style'); if (!st) { st = document.createElement('style'); st.id = 'brand-style'; document.head.appendChild(st); } st.textContent = css();
    const fam = [BRAND.fonts && BRAND.fonts.display, BRAND.fonts && BRAND.fonts.body].filter(f => f && !/^(Barlow Semi Condensed|Public Sans)$/.test(f)); if (fam.length) { const id = 'brand-fonts'; let ln = document.getElementById(id); const href = 'https://fonts.googleapis.com/css2?' + fam.map(f => 'family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;600;700').join('&') + '&display=swap'; if (!ln) { ln = document.createElement('link'); ln.id = id; ln.rel = 'stylesheet'; document.head.appendChild(ln); } if (ln.href !== href) ln.href = href; }
    const bm = document.querySelector('.brandmark'); if (bm) {
      const sub = brandSet() ? `Uplift Louisiana Roofing Atlas · ${esc(BRAND.city || 'Louisiana')}${BRAND.lic ? ' · LSLBC license ' + esc(BRAND.lic) : ''}` : 'Roofing demand intelligence for all 64 parishes: roof age, storms, eleven service lines, ZIP heatmaps for ads and SEO';
      bm.innerHTML = `<div class="logo" id="brandLogo"></div><div><div class="nm">${brandSet() ? esc(BRAND.name) : 'Uplift'}</div><div class="sb">${sub}</div></div>`;
      const host = bm.querySelector('#brandLogo'); const src = BRAND.logoData || BRAND.logoUrl; const fb = () => { host.innerHTML = fallbackLogo(38); host.classList.add('fb'); };
      if (src) { const img = new Image(); img.alt = (BRAND.name || 'Company') + ' logo'; img.onload = () => { host.innerHTML = ''; host.appendChild(img); host.classList.remove('fb'); }; img.onerror = fb; img.src = src; fb(); } else fb();
    }
    try { document.title = brandSet() ? `${brandShort()} · Uplift Roofing Atlas` : 'Uplift Roofing Atlas'; } catch (e) { }
    BUS.emit('brand');
  }
  function save(patch) { BRAND = Object.assign(BRAND, patch || {}); const s = JSON.parse(JSON.stringify(BRAND)); store.set('up.brand.v1', s); apply(); }
  function reset() { BRAND = JSON.parse(JSON.stringify(BRAND_DEFAULT)); store.set('up.brand.v1', {}); apply(); }
  const addr = () => [BRAND.street, [BRAND.city, BRAND.state].filter(Boolean).join(', '), BRAND.zip].filter(Boolean).join(', ').replace(/, (\d{5})$/, ' $1');
  /* ---------- settings panel ---------- */
  function panel() {
    let ov = document.getElementById('brandPanel'); if (ov) { ov.remove(); }
    ov = el('div', { id: 'brandPanel', class: 'overlay', role: 'dialog', 'aria-label': 'Company settings' });
    const f = (k, lab, val, type, hint) => `<div class="f"><label class="fl" for="bp_${k}">${lab}</label><input type="${type || 'text'}" id="bp_${k}" data-k="${k}" value="${esc(val == null ? '' : val)}">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    const cf = (k, lab) => `<div class="f"><label class="fl" for="bp_c_${k}">${lab}</label><div style="display:flex;gap:6px;align-items:center"><input type="color" id="bp_c_${k}" value="${esc(BRAND.colors[k])}"><code>${esc(BRAND.colors[k])}</code></div></div>`;
    ov.innerHTML = `<div class="panel"><div class="card-h" style="display:flex;gap:10px;align-items:center"><div style="flex:1"><h3>Company: the roofer this atlas works for</h3><p>Brand neutral until you fill it in. Since August 1, 2026 anyone who advertises, solicits, quotes, bids or performs residential roofing worth $7,500 or more must hold the LSLBC Residential Roofing or Residential Construction classification (Act 757 of 2026); the Desk, the Forge and the Satchel read the license from here. Saved in this browser only.</p></div><button class="ibtn" id="bpClose">Close</button></div><div class="card-b"><div class="plan">
      ${f('name', 'Company name (as licensed with the LSLBC)', BRAND.name, 'text', 'Use the name on the license and the contracts; a trade name that differs from the licensed name confuses license lookups.')}${f('short', 'Short name', BRAND.short)}${f('contact', 'Qualifying party or owner, full name', BRAND.contact, 'text', 'The person who answers for the license; shown on the About page and in the Satchel checks.')}
      ${f('lic', 'LSLBC license number', BRAND.lic, 'text', 'Consumers verify it on the LSLBC Contractor Search. The Satchel flags residential roofing ads that carry no license reference.')}${f('licClass', 'License classifications', BRAND.licClass, 'text', 'For example: Residential Roofing; Residential Building; Commercial: Roofing and Sheet Metal.')}${f('juris', 'States licensed', BRAND.juris, 'text', 'Louisiana plus any other state where you hold a contractor license.')}
      ${f('phone', 'Phone', BRAND.phone, 'tel')}${f('url', 'Website', BRAND.url, 'url')}${f('email', 'Leads email', BRAND.email, 'email')}
      ${f('street', 'Office street', BRAND.street)}${f('city', 'Office city', BRAND.city, 'text', 'The office that appears on pages and Google Business Profile.')}${f('zip', 'ZIP', BRAND.zip)}
      ${f('offices', 'Other office cities (comma separated)', BRAND.offices)}${f('lat', 'Latitude (map point)', BRAND.lat, 'number')}${f('lon', 'Longitude', BRAND.lon, 'number')}
      ${f('hours', 'Office hours', BRAND.hours)}${f('languages', 'Languages served', BRAND.languages, 'text', 'Spanish and Vietnamese pages and ads are built only when you serve those languages.')}${f('certs', 'Manufacturer certifications (exact program names)', BRAND.certs, 'text', 'Only programs you currently hold. The Satchel blocks certification claims that are not listed here.')}
      ${f('fortified', 'FORTIFIED status', BRAND.fortified, 'text', 'For example: FORTIFIED Roof certified roofer (IBHS). Leave blank if not certified.')}${f('warranty', 'Workmanship warranty statement (optional)', BRAND.warranty, 'text', 'Exact terms only, for example: 10 year workmanship warranty, written, transferable once.')}${f('financing', 'Financing statement (optional)', BRAND.financing, 'text', 'Lender name and the required disclosure if ads mention payments or rates (Regulation Z).')}
      ${cf('primary', 'Primary')}${cf('secondary', 'Secondary (dark mode accent)')}${cf('accent', 'Highlight')}${cf('dark', 'Dark')}
      ${f('logoUrl', 'Logo URL', BRAND.logoUrl, 'url', 'Loads where the page may reach the site (file, browser app). The viewer shows the drawn mark unless a file is uploaded.')}
      <div class="f"><label class="fl" for="bp_logo">Logo file (kept in this browser)</label><input type="file" id="bp_logo" accept="image/*"><span class="hint">${BRAND.logoData ? 'A logo file is stored. ' : ''}PNG, SVG or WebP under 400 KB.</span></div>
      </div><div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn" id="bpSave">Save and apply</button><button class="btn sec" id="bpClearLogo">Remove logo file</button><button class="btn ghost" id="bpReset">Reset to brand neutral</button></div></div></div>`;
    document.body.appendChild(ov);
    let logoData = BRAND.logoData || '';
    $('#bp_logo', ov).onchange = e => { const fl = e.target.files && e.target.files[0]; if (!fl) return; if (fl.size > 400 * 1024) { toast('Logo file is over 400 KB; pick a smaller one'); return; } const rd = new FileReader(); rd.onload = () => { logoData = String(rd.result || ''); toast('Logo loaded; save to apply'); }; rd.readAsDataURL(fl); };
    $('#bpSave', ov).onclick = () => { const patch = {}; $$('input[data-k]', ov).forEach(i => { const k = i.dataset.k; patch[k] = i.type === 'number' ? (+i.value || BRAND[k]) : i.value.trim(); }); patch.domain = String(patch.url || BRAND.url).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''); patch.colors = { primary: $('#bp_c_primary', ov).value, secondary: $('#bp_c_secondary', ov).value, accent: $('#bp_c_accent', ov).value, dark: $('#bp_c_dark', ov).value }; patch.logoData = logoData; save(patch); toast('Company saved'); ov.remove(); };
    $('#bpClearLogo', ov).onclick = () => { logoData = ''; save({ logoData: '' }); toast('Logo file removed'); };
    $('#bpReset', ov).onclick = () => { reset(); toast('Company reset to neutral'); ov.remove(); };
    $('#bpClose', ov).onclick = () => ov.remove(); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }
  return { apply, save, reset, panel, addr, fallbackLogo, css, get B() { return BRAND; } };
})();
