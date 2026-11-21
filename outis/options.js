/* Outis settings page (also the welcome page on first install: options.html#welcome). Every control writes to
   chrome.storage.local through lib/settings.js; the background applies the change. */
import { DEFAULTS, load, update, save } from './lib/settings.js';
import { PLACES, REGIONS, placeById } from './lib/places.js';
import { normalizeSite } from './lib/sites.js';
import { PARAMS, domainCount } from './lib/trackers.js';

const $ = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];
let S = null;
/* Writes from this page come back as storage events; those need no re-render (the page already shows them), and a
   re-render could undo a switch flipped in the meantime. Changes from elsewhere (the popup) do re-render. */
const write = patch => update(patch);

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}
const SAVED = 'Saved. Pages you open or reload from now on get the change.';

function offsetLabel(tz) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    const n = p.find(x => x.type === 'timeZoneName');
    return n ? n.value.replace(/^GMT$/, 'GMT+0') : '';
  } catch (e) { return ''; }
}

function fillPlaces() {
  const sel = $('place');
  sel.append(new Option('Nowhere (UTC, no location)', 'nowhere'));
  for (const r of REGIONS) {
    const g = document.createElement('optgroup');
    g.label = r;
    for (const p of PLACES.filter(x => x.region === r)) g.append(new Option(`${p.label} (${offsetLabel(p.tz)})`, p.id));
    sel.append(g);
  }
}

function renderList(name) {
  const ul = document.querySelector(`ul[data-list="${name}"]`);
  ul.textContent = '';
  if (!S[name].length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'None yet.';
    ul.append(li);
    return;
  }
  for (const site of [...S[name]].sort()) {
    const li = document.createElement('li');
    const span = document.createElement('span'); span.textContent = site;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ghost'; b.textContent = 'Remove';
    b.setAttribute('aria-label', `Remove ${site}`);
    b.addEventListener('click', async () => {
      S = await write(s => { s[name] = s[name].filter(x => x !== site); return s; });
      render();
      toast(SAVED);
    });
    li.append(span, b);
    ul.append(li);
  }
}

async function render() {
  document.body.classList.toggle('off', !S.enabled);
  $('enabled').checked = S.enabled;
  $('masterLabel').textContent = S.enabled ? 'On' : 'Off';
  for (const el of $$('[data-key]')) {
    const v = S[el.dataset.key];
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = String(v);
  }
  for (const r of $$('input[name="location"]')) r.checked = r.value === S.location;
  const place = placeById(S.place);
  $('fakeNote').hidden = !(S.location === 'fake' && place.lat === undefined);
  $('tzName').textContent = place.id === 'nowhere' ? 'UTC' : `${place.label} (${offsetLabel(place.tz)})`;
  $('proxyOn').checked = S.proxy.on;
  /* never overwrite a field someone is typing in */
  const field = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v; };
  field('proxyScheme', S.proxy.scheme);
  field('proxyHost', S.proxy.host);
  field('proxyPort', String(S.proxy.port));
  field('proxyUser', S.proxy.user);
  field('proxyPass', S.proxy.pass);
  renderList('kept');
  renderList('paused');
  for (const b of $$('[data-welcome]')) {
    const w = b.dataset.welcome;
    b.classList.toggle('on', (w === 'tz-hide' && S.timezone) || (w === 'tz-keep' && !S.timezone) || (w === 'forget-on' && S.forget) || (w === 'forget-off' && !S.forget));
  }
  const { control = {}, applied } = await chrome.storage.session.get(['control', 'applied']);
  const why = {
    controlled_by_other_extensions: 'Another extension controls this Chrome setting, so Outis cannot change it.',
    not_controllable: 'Your administrator or Chrome controls this setting, so Outis cannot change it.'
  };
  for (const p of $$('[data-control]')) p.textContent = (S.enabled && why[control[p.dataset.control]]) || '';
  const failed = applied && applied.failed ? Object.entries(applied.failed) : [];
  $('problems').hidden = !failed.length;
  $('problems').textContent = failed.length ? 'Some protections could not be applied: ' + failed.map(([k, v]) => `${k} (${v})`).join('; ') : '';
  const { stats } = await chrome.storage.local.get('stats');
  $('forgotStats').textContent = stats && stats.forgotten ? `Forgotten so far: ${stats.forgotten} site${stats.forgotten === 1 ? '' : 's'}${stats.last ? ', last ' + new Date(stats.last).toLocaleString() : ''}. Outis keeps no list of which.` : '';
}

function proxyFromForm(on) {
  return {
    on,
    scheme: $('proxyScheme').value,
    host: $('proxyHost').value.trim(),
    port: Number($('proxyPort').value),
    user: $('proxyUser').value,
    pass: $('proxyPass').value
  };
}

function bind() {
  $('enabled').addEventListener('change', async e => { S = await write({ enabled: e.target.checked }); render(); toast(e.target.checked ? 'Outis is on. ' + SAVED : 'Outis is off everywhere.'); });
  for (const el of $$('[data-key]')) {
    el.addEventListener('change', async () => {
      const k = el.dataset.key;
      const v = el.type === 'checkbox' ? el.checked : k === 'forgetDelay' ? Number(el.value) : el.value;
      S = await write({ [k]: v });
      render();
      toast(SAVED);
    });
  }
  for (const r of $$('input[name="location"]')) {
    r.addEventListener('change', async () => { if (r.checked) { S = await write({ location: r.value }); render(); toast(SAVED); } });
  }
  $('proxyOn').addEventListener('change', async e => {
    const p = proxyFromForm(e.target.checked);
    if (p.on && (!p.host || !(p.port > 0 && p.port < 65536))) { e.target.checked = false; $('proxyMsg').textContent = 'Enter a host and a port first.'; return; }
    S = await write(s => { s.proxy = p; return s; });
    render();
    $('proxyMsg').textContent = p.on ? `Using ${p.scheme} ${p.host}:${p.port}.` : 'Proxy off.';
  });
  $('proxySave').addEventListener('click', async () => {
    const p = proxyFromForm($('proxyOn').checked);
    if (!p.host || !(p.port > 0 && p.port < 65536)) { $('proxyMsg').textContent = 'Enter a host and a port.'; return; }
    S = await write(s => { s.proxy = p; return s; });
    render();
    $('proxyMsg').textContent = p.on ? `Saved. Using ${p.scheme} ${p.host}:${p.port}.` : 'Saved. Switch it on to use it.';
  });
  for (const b of $$('[data-preset]')) {
    b.addEventListener('click', () => {
      $('proxyScheme').value = 'socks5';
      $('proxyHost').value = '127.0.0.1';
      $('proxyPort').value = b.dataset.preset === 'tor' ? '9050' : '9150';
      $('proxyUser').value = '';
      $('proxyPass').value = '';
      $('proxyMsg').textContent = 'Filled in. Save, then switch the proxy on.';
    });
  }
  $('ipCheck').addEventListener('click', async () => {
    $('proxyMsg').textContent = 'Checking…';
    try {
      const r = await fetch('https://check.torproject.org/api/ip', { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      const j = await r.json();
      $('proxyMsg').textContent = `Sites see ${j.IP}${j.IsTor ? ', a Tor exit' : ''}.`;
    } catch (e) { $('proxyMsg').textContent = 'Could not check right now (is the proxy running?).'; }
  });
  for (const f of $$('form.add')) {
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const input = f.querySelector('input');
      const site = normalizeSite(input.value);
      if (!site) { toast("That doesn't look like a site name."); return; }
      const name = f.dataset.list;
      S = await write(s => { if (!s[name].includes(site)) s[name] = [...s[name], site]; return s; });
      input.value = '';
      render();
      toast(name === 'kept' ? `${site} is kept: you stay signed in there.` : `Outis is paused on ${site}.`);
    });
  }
  for (const b of $$('[data-welcome]')) {
    b.addEventListener('click', async () => {
      const w = b.dataset.welcome;
      const patch = w === 'tz-hide' ? { timezone: true } : w === 'tz-keep' ? { timezone: false } : w === 'forget-on' ? { forget: true } : { forget: false };
      S = await write(patch);
      render();
    });
  }
  $('welcomeDone').addEventListener('click', () => { $('welcome').hidden = true; history.replaceState(null, '', location.pathname); window.scrollTo(0, 0); });
  $('reset').addEventListener('click', async () => {
    if (!confirm('Reset every Outis setting, including your kept and paused sites?')) return;
    S = await save(DEFAULTS);
    render();
    toast('Everything is back to the defaults.');
  });
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.settings && !changes.stats && JSON.stringify(changes.settings.newValue) === JSON.stringify(S)) return;
    if ((area === 'local' && (changes.settings || changes.stats)) || (area === 'session' && (changes.control || changes.applied))) { S = await load(); render(); }
  });
}

async function init() {
  S = await load();
  fillPlaces();
  $('trackerCount').textContent = `${domainCount()} domains and addresses`;
  $('paramCount').textContent = String(PARAMS.filter(p => !p.startsWith('utm_') && p !== 'fbclid' && p !== 'gclid').length);
  $('version').textContent = `Outis ${chrome.runtime.getManifest().version}`;
  if (location.hash === '#welcome') $('welcome').hidden = false;
  bind();
  render();
}

init();
