/* Outis popup: the current site's switches, what is hidden right now, and a live comparison of what the page sees
   against the real values. */
import { load, update } from './lib/settings.js';
import { siteOfUrl } from './lib/sites.js';
import { placeById } from './lib/places.js';
import { CATEGORIES } from './lib/trackers.js';

const $ = id => document.getElementById(id);
const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.key, c.label]));
let S = null, tab = null, site = '';

/* Runs twice: in the page's own world (what the site sees) and here in the popup, which Outis leaves untouched
   (the real values). It must be self-contained: chrome.scripting sends it to the page as source text. */
function probe() {
  const out = {};
  const safe = (k, f) => { try { out[k] = f(); } catch (e) { out[k] = null; } };
  const two = n => (n < 10 ? '0' : '') + n;
  safe('tz', () => Intl.DateTimeFormat().resolvedOptions().timeZone);
  safe('clock', () => { const d = new Date(); return two(d.getHours()) + ':' + two(d.getMinutes()); });
  safe('langs', () => (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]).join(', '));
  safe('cores', () => navigator.hardwareConcurrency);
  safe('memory', () => navigator.deviceMemory);
  safe('screen', () => screen.width + ' × ' + screen.height);
  safe('gpu', () => {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  });
  safe('canvas', () => {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 60;
    const x = c.getContext('2d');
    x.textBaseline = 'top';
    x.font = '16px Arial';
    x.fillStyle = '#f60'; x.fillRect(100, 1, 62, 20);
    x.fillStyle = '#069'; x.fillText('Outis, who where when \u{1F575}', 2, 15);
    x.fillStyle = 'rgba(102, 204, 0, 0.7)'; x.fillText('Outis, who where when \u{1F575}', 4, 17);
    const g = x.createLinearGradient(0, 0, 240, 0);
    g.addColorStop(0, '#123029'); g.addColorStop(1, '#7fe6c4');
    x.fillStyle = g; x.fillRect(0, 40, 240, 20);
    x.beginPath(); x.arc(200, 30, 18, 0, Math.PI * 2); x.strokeStyle = '#c33'; x.lineWidth = 3; x.stroke();
    const s = c.toDataURL();
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  });
  safe('gpc', () => navigator.globalPrivacyControl === true);
  safe('referrer', () => document.referrer);
  const geo = navigator.permissions ? navigator.permissions.query({ name: 'geolocation' }).then(s => s.state, () => null) : Promise.resolve(null);
  return geo.then(state => { out.geo = state; return out; });
}

function setText(id, text) { $(id).textContent = text; }

function render() {
  const on = S.enabled;
  document.body.classList.toggle('disabled', !on);
  $('enabled').checked = on;
  setText('status', on ? 'On' : 'Off everywhere');
  const paused = !!site && S.paused.includes(site);
  const kept = !!site && S.kept.includes(site);

  /* the site card */
  $('siteControls').hidden = !site;
  $('notWeb').hidden = !!site;
  setText('host', site || 'This page');
  const pill = $('sitePill');
  pill.className = 'pill' + (!on || paused ? ' off' : '');
  pill.textContent = !site ? 'Not a web page' : !on ? 'Off' : paused ? 'Paused here' : 'Protected';
  $('siteOn').checked = on && !paused;
  $('siteOn').disabled = !on;
  $('siteForget').checked = on && S.forget && !kept && !paused;
  $('siteForget').disabled = !on || !S.forget || paused;
  $('siteForget').closest('.row').title = !S.forget ? 'Forgetting is off in Settings' : paused ? 'Paused sites are not forgotten' : '';
  $('forgetNow').disabled = !site;

  /* who / where / when */
  const live = on && !paused;
  const place = placeById(S.place);
  $('who').classList.toggle('off', !live || !S.trackers);
  if (!live) setText('whoSub', paused ? 'paused on this site' : 'Outis is off');
  else if (!S.trackers) setText('whoSub', 'tracker blocking is off');
  else setText('whoSub', 'trackers blocked on this page');

  $('where').classList.toggle('off', !live || S.location === 'off');
  if (!live) { setText('whereBig', 'Visible'); setText('whereSub', paused ? 'paused on this site' : 'Outis is off'); }
  else if (S.location === 'fake' && place.lat !== undefined) { setText('whereBig', place.label); setText('whereSub', 'the location sites get'); }
  else if (S.location === 'off') { setText('whereBig', 'Visible'); setText('whereSub', 'location requests left to Chrome'); }
  else { setText('whereBig', 'Hidden'); setText('whereSub', 'location requests refused'); }

  $('when').classList.toggle('off', !live || !S.timezone);
  if (!live || !S.timezone) { setText('whenBig', 'Real'); setText('whenSub', !live ? (paused ? 'paused on this site' : 'Outis is off') : 'your own clock and time zone'); }
  else { setText('whenBig', place.id === 'nowhere' ? 'UTC' : place.label); setText('whenSub', 'the time zone sites see' + (S.forget ? '; closed sites are forgotten' : '')); }

  /* the IP note */
  const ip = $('ip');
  if (on && S.proxy.on) {
    ip.classList.add('safe');
    $('ipText').innerHTML = '';
    const b = document.createElement('strong'); b.textContent = 'Your traffic goes through your proxy.';
    $('ipText').append(b, ` Sites see its address (${S.proxy.scheme} ${S.proxy.host}:${S.proxy.port}) instead of yours.`);
  } else {
    ip.classList.remove('safe');
  }
}

async function showCounts() {
  if (!tab || !site) return;
  let c = { total: 0, cats: {}, hosts: {} };
  try { const r = await chrome.runtime.sendMessage({ type: 'count', tabId: tab.id }); if (r && r.ok) c = r.counts; } catch (e) { /* ignore */ }
  const live = S.enabled && !S.paused.includes(site) && S.trackers;
  setText('whoBig', live ? String(c.total) : '0');
  const hosts = Object.entries(c.hosts).sort((a, b) => b[1] - a[1]);
  const list = $('blockedList');
  list.textContent = '';
  for (const [host, n] of hosts) {
    const li = document.createElement('li');
    const name = document.createElement('span'); name.textContent = host;
    const meta = document.createElement('span'); meta.className = 'cat'; meta.textContent = n > 1 ? `${n}×` : '';
    li.append(name, meta);
    list.append(li);
  }
  const cats = Object.entries(c.cats).filter(([k]) => CAT_LABEL[k]).map(([k, n]) => `${CAT_LABEL[k]} ${n}`).join(' · ');
  setText('blockedCount', c.total ? `(${c.total})` : '');
  setText('blockedNote', c.total ? cats : (live ? 'Nothing blocked on this page yet.' : 'Tracker blocking is not active here.'));
}

const geoText = (state, fake) => state === 'denied' ? 'Refused' : state === 'granted' ? (fake ? `Pretend: ${fake}` : 'Allowed') : state === 'prompt' ? 'Asks you' : '—';

async function showSees() {
  const body = $('seesTable').tBodies[0];
  body.textContent = '';
  if (!tab || !site) { setText('seesNote', 'Open a web page to compare.'); return; }
  let seen = null;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: probe });
    seen = res && res.result;
  } catch (e) { seen = null; }
  if (!seen) { setText('seesNote', 'Outis cannot look inside this page (it may still be loading, or Chrome does not allow it here).'); return; }
  const real = await probe();
  const place = placeById(S.place);
  const fakeGeo = S.location === 'fake' && place.lat !== undefined ? place.label : '';
  const rows = [
    ['Time zone', seen.tz, real.tz],
    ['Clock', seen.clock, real.clock],
    ['Location', geoText(seen.geo, fakeGeo), '—'],
    ['Languages', seen.langs, real.langs],
    ['CPU cores', seen.cores, real.cores],
    ['Memory', seen.memory ? seen.memory + ' GB' : '—', real.memory ? real.memory + ' GB' : '—'],
    ['Screen', seen.screen, real.screen],
    ['Graphics card', seen.gpu, real.gpu],
    ['Canvas print', seen.canvas, real.canvas],
    ['Do not sell or share', seen.gpc ? 'Asked (GPC)' : 'Not asked', '—']
  ];
  for (const [label, a, b] of rows) {
    const tr = document.createElement('tr');
    const th = document.createElement('th'); th.scope = 'row'; th.textContent = label;
    const ta = document.createElement('td'), tb = document.createElement('td');
    const shown = v => (v === null || v === undefined || v === '' ? '—' : String(v).replace(/\//g, '/\u200b'));
    ta.textContent = shown(a);
    tb.textContent = shown(b);
    const differs = b !== '—' && String(a) !== String(b);
    ta.className = differs || (label === 'Location' && seen.geo !== 'prompt') || (label.startsWith('Do not') && seen.gpc) ? 'hid' : 'same';
    tr.append(th, ta, tb);
    body.append(tr);
  }
  setText('seesNote', S.paused.includes(site) ? 'Outis is paused here, so this site sees your real values.' : 'Green: what Outis changed. Canvas noise is different on every site and every browser session.');
}

async function showStats() {
  const { stats } = await chrome.storage.local.get('stats');
  if (stats && stats.forgotten) {
    setText('forgotten', `Forgot ${stats.forgotten} site${stats.forgotten === 1 ? '' : 's'} so far`);
  }
}

async function applyNow() {
  try { await chrome.runtime.sendMessage({ type: 'apply' }); } catch (e) { /* the change still applies on its own */ }
}

async function init() {
  S = await load();
  /* popup.html?tab=<id> shows a given tab (the end-to-end tests open the popup as a page). */
  const forced = Number(new URLSearchParams(location.search).get('tab'));
  try { tab = forced ? await chrome.tabs.get(forced) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0]; } catch (e) { tab = null; }
  site = tab ? siteOfUrl(tab.url || '') : '';
  render();
  showStats();
  showCounts();
  $('sees').addEventListener('toggle', () => { if ($('sees').open) showSees(); });

  $('enabled').addEventListener('change', async e => {
    S = await update({ enabled: e.target.checked });
    render();
    await applyNow();
    if (tab && site) chrome.tabs.reload(tab.id);
  });
  $('siteOn').addEventListener('change', async e => {
    const on = e.target.checked;
    S = await update(s => { s.paused = on ? s.paused.filter(x => x !== site) : [...s.paused, site]; return s; });
    render();
    setText('siteMsg', on ? 'Protecting this site again. Reloading.' : 'Paused here. Reloading.');
    await applyNow();
    chrome.tabs.reload(tab.id);
    setTimeout(() => { showCounts(); if ($('sees').open) showSees(); }, 1500);
  });
  $('siteForget').addEventListener('change', async e => {
    const forget = e.target.checked;
    S = await update(s => { s.kept = forget ? s.kept.filter(x => x !== site) : [...s.kept, site]; return s; });
    render();
    setText('siteMsg', forget ? 'Will be forgotten when you close it.' : 'Kept: you stay signed in here.');
  });
  $('forgetNow').addEventListener('click', async () => {
    $('forgetNow').disabled = true;
    setText('siteMsg', 'Forgetting…');
    try {
      const r = await chrome.runtime.sendMessage({ type: 'forget', site });
      setText('siteMsg', r && r.ok ? `Forgot ${site}. Reloading.` : 'Could not forget this site.');
      if (r && r.ok) chrome.tabs.reload(tab.id);
    } catch (e) { setText('siteMsg', 'Could not forget this site.'); }
    $('forgetNow').disabled = false;
    showStats();
  });
  $('ipCheck').addEventListener('click', async () => {
    const out = $('ipResult');
    out.textContent = 'Checking…';
    try {
      const r = await fetch('https://check.torproject.org/api/ip', { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      const j = await r.json();
      out.textContent = `Sites see ${j.IP}${j.IsTor ? ' (a Tor exit)' : ''}`;
    } catch (e) {
      out.textContent = 'Could not check right now.';
    }
  });
}

init();
