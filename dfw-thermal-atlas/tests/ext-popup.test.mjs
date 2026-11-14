/* What the toolbar popup says about the live data when nobody has looked for a while: app/popup.js run in a vm against the
   store the worker wrote (tests/helpers/fakechrome.mjs), with just enough of a document to read back what it painted.
   The rule under test: nothing may read as current unless it was fetched without a failure and is still inside its schedule. */
process.env.TZ = 'America/Chicago';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP } from '../build.mjs';
import { makeWorld } from './helpers/fakechrome.mjs';

const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h || 0, mi || 0, 0);
function node(tag) {
  const e = { tag, kids: [], own: '', className: '', hidden: false, disabled: false, appendChild(c) { this.kids.push(c); return c; }, setAttribute() { }, addEventListener() { }, querySelector() { return null; }, classList: { toggle() { }, remove() { }, add() { } } };
  Object.defineProperty(e, 'textContent', { get() { return this.own + this.kids.map(k => k.textContent).join(''); }, set(v) { this.own = String(v); this.kids = []; } });
  Object.defineProperty(e, 'children', { get() { return this.kids; } });
  return e;
}
/* open the popup on the world's store and clock; returns id => the text painted in that element */
async function popup(w) {
  const els = {}, document = { getElementById: id => els[id] || (els[id] = node('div')), createElement: node, createTextNode: t => ({ textContent: String(t) }) };
  const chrome = Object.assign({}, w.chrome, { storage: { local: w.chrome.storage.local, onChanged: { addListener() { } } } });
  const ctx = vm.createContext({ console, document, chrome, setTimeout: () => 0, clearTimeout() { }, URL, Intl, Date: w.ctx.Date, window: { close() { } } });
  ctx.globalThis = ctx; ctx.self = ctx;
  const html = readFileSync(join(APP, 'popup.html'), 'utf8');
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) vm.runInContext(readFileSync(join(APP, m[1]), 'utf8'), ctx, { filename: m[1] });
  await w.settle();
  return id => (els[id] ? els[id].textContent : '');
}
const sources = text => (/Sources(\d+ of \d+ current)/.exec(text('status')) || [])[1];

test('popup: a clean full refresh reads as 12 of 12 current, and stops reading so once the records are older than their schedule', async () => {
  const w = makeWorld({ now: at(2026, 11, 9, 6) }); w.boot(); w.chrome.runtime.onInstalled.fire({ reason: 'update' }); await w.settle();
  assert.equal(sources(await popup(w)), '12 of 12 current');
  /* two days on with no run in between (the pulse switched off, or the browser closed): the weather sources are past their day */
  w.at(at(2026, 11, 11, 9));
  assert.equal(sources(await popup(w)), '7 of 12 current', 'the five weather sources are two days old');
  /* three weeks on, nothing failed, nothing ran: not one record is current */
  w.at(at(2026, 11, 30, 9)); const t = await popup(w);
  assert.equal(sources(t), '0 of 12 current', 'three week old records do not read as current');
  assert.match(t('status'), /Full refresh.*3 weeks ago/);
  w.kill();
});

test('popup: a first refresh that failed everywhere does not speak of previous data', async () => {
  const w = makeWorld({ now: at(2026, 11, 13, 19) }); w.runSource = async () => { throw new TypeError('Failed to fetch'); }; w.boot();
  w.chrome.runtime.onInstalled.fire({ reason: 'install' }); await w.settle();
  const t = await popup(w);
  assert.equal(sources(t), '0 of 12 current'); assert.match(t('status'), /Full refreshnot yet/);
  assert.match(t('liveNote'), /^12 sources failed on the last run and have no data yet: /); assert.doesNotMatch(t('liveNote'), /previous data/);
  assert.equal(t('weekHead'), 'The first refresh has not run yet');
  /* once a source has data, a later failure says the data was kept */
  w.runSource = async id => ({ stub: id }); w.at(at(2026, 11, 13, 19, 8)); w.boot(); await w.fireDue();
  w.runSource = async id => { if (id === 'cpsc_recalls') throw new TypeError('Failed to fetch'); return { stub: id }; };
  w.at(at(2026, 11, 16, 6)); w.boot(); await w.fireDue();
  const t2 = await popup(w);
  assert.equal(sources(t2), '11 of 12 current'); assert.match(t2('liveNote'), /^1 source failed on the last run and kept their previous data: /);
  w.kill();
});
