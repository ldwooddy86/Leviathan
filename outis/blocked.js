/* Outis warning page: says what was stopped and why, and lets the person go back or, deliberately, go on.
   It only explains what the background actually recorded for this tab (or for this download's token), so a site
   that opens or frames this page cannot use it to have its own address let through. */
import { REASONS } from './lib/safety.js';

const $ = id => document.getElementById(id);

const CATEGORY_TEXT = {
  Cryptominers: "Sites like this use your computer's processor to mine cryptocurrency for someone else, which slows your computer down and drains its battery.",
  'Scam and malware ad networks': 'This ad network is known for pop-ups, fake virus alerts, scam offers and malware downloads. You most likely got here through a pop-up or a redirect, not a link you chose.'
};

function fact(name, value) {
  const dt = document.createElement('dt'); dt.textContent = name;
  const dd = document.createElement('dd'); dd.textContent = value;
  $('facts').append(dt, dd);
}
function reason(text) {
  const li = document.createElement('li'); li.textContent = text;
  $('why').append(li);
}
async function closeTab() {
  try { const t = await chrome.tabs.getCurrent(); if (t) { await chrome.tabs.remove(t.id); return; } } catch (e) { /* not a tab */ }
  window.close();
}
function goBack() {
  if (history.length > 1) history.back(); else closeTab();
}

async function main() {
  const token = (/^#d=([0-9a-f-]{36})$/.exec(location.hash) || [])[1] || '';
  let r = null;
  try { r = await chrome.runtime.sendMessage({ type: 'blocked-info', token }); } catch (e) { r = null; }
  $('main').hidden = false;
  $('back').addEventListener('click', goBack);
  if (!r || !r.ok) {
    document.title = 'Outis';
    $('title').textContent = 'Nothing to show here';
    $('what').textContent = 'This page explains something Outis stopped, and there is nothing to explain right now.';
    $('back').textContent = 'Close';
    return;
  }
  const rec = r.record;
  if (rec.kind === 'malware') {
    document.title = 'Outis blocked a dangerous site';
    $('title').textContent = 'Outis blocked a dangerous site';
    $('what').textContent = `${rec.host} is on Outis's list of ${rec.label.toLowerCase()}.`;
    fact('Address', rec.url);
    reason(CATEGORY_TEXT[rec.label] || 'Sites on this list are known to serve malware or scams.');
    $('go').hidden = false;
    $('go').textContent = 'Open it anyway';
  } else if (rec.kind === 'insecure') {
    document.body.classList.add('insecure');
    document.title = 'This site has no secure version';
    $('title').textContent = 'This site has no secure version';
    $('what').textContent = `${rec.host} doesn't offer an encrypted (HTTPS) connection. Anyone on the network in between, like public Wi-Fi or a hijacked router, could read what you send it and change what it sends you, including slipping in malware.`;
    fact('Address', rec.url);
    if (rec.error) fact('Secure attempt', rec.error.replace(/^net::/, ''));
    reason("If you continue, don't sign in or enter anything private there.");
    $('go').hidden = false;
    $('go').textContent = 'Continue over HTTP';
  } else if (rec.kind === 'download') {
    document.title = 'Outis stopped a download';
    $('title').textContent = 'Outis stopped a download';
    $('what').textContent = `It was deleted before you could open it.`;
    fact('File', rec.name);
    if (rec.host) fact('From', rec.host);
    for (const k of rec.reasons) if (REASONS[k]) reason(REASONS[k]);
    $('back').textContent = 'OK';
    $('back').removeEventListener('click', goBack);
    $('back').addEventListener('click', closeTab);
    if (rec.canRetry) {
      $('go').hidden = false;
      $('go').textContent = 'Download it anyway';
    }
  }
  $('go').addEventListener('click', async () => {
    $('go').disabled = true;
    if (rec.kind === 'download') {
      $('note').textContent = 'Downloading…';
      const res = await chrome.runtime.sendMessage({ type: 'download-anyway', token }).catch(() => null);
      $('note').textContent = res && res.ok
        ? 'Downloaded. Only open it if you know exactly what it is and who sent it.'
        : "This file can't be fetched again: the page that made it has let it go. Go back and download it again with the download check switched off in Outis's settings.";
      return;
    }
    const res = await chrome.runtime.sendMessage({ type: 'blocked-continue' }).catch(() => null);
    if (res && res.ok && /^https?:\/\//i.test(res.url)) location.replace(res.url);
    else { $('note').textContent = 'This warning has expired. Open the address again to decide.'; }
  });
}

/* Never inside a frame: a page could otherwise show this one and trick a click on "continue". */
if (window.top === window.self) main();
