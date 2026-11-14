/* The link's reports in plain text, shared by the three command lines (dashboard-link, paid-ads, content-strategist). */
import path from 'node:path';
import { REPO, rel } from './paths.mjs';

const mb = n => (n / 1048576).toFixed(2) + ' MB';
const repo = p => path.relative(REPO, p) || p;
const mark = ok => (ok ? 'ok ' : '-- ');

export function identityLine(c) {
  const i = c.identity;
  return `${i.atlas}${i.build ? ' · Build ' + i.build : ''}  (compiled ${i.compiled || 'date not stated'}, ${mb(i.bytes)}, sha256 ${i.sha256.slice(0, 16)})`;
}

function capsText(caps) {
  const part = (title, rows) => [title, ...rows.map(r => `  ${mark(r.ok)}${r.what}${r.detail ? ': ' + r.detail : ''}`)];
  return [...part('Paid ads specialist', caps.paid), '', ...part('Content strategist', caps.content)];
}
function doorsText(doors) {
  if (!doors.length) return ['Doors: none found. This build takes no file from outside.'];
  const who = { paid: 'paid ads', content: 'content', both: 'both agents' };
  return ['Doors: what this dashboard takes in and gives out with its own controls', ...doors.map(d => `  ${d.dir === 'in' ? 'in ' : 'out'}  ${d.what}  (${who[d.agent] || d.agent})\n        ${d.how}`)];
}

/* after connect */
export function connectText(c) {
  const live = c.live.ok ? 'The dashboard was also opened headless and its computed model read (seasons, unit economics, priority by ZIP and line).' : `The dashboard was read as text only: ${c.live.why}.`;
  const wrote = (name, p) => `  ${repo(p.file)}  ${p.written ? 'written' + (p.dropped ? ` (${p.dropped} string${p.dropped === 1 ? '' : 's'} naming a withheld party left out)` : '') : 'unchanged (already read from this same file)'}`;
  return [
    'Connected: ' + identityLine(c),
    `  ${c.modules.length} modules: ${c.modules.map(m => m.num + ' ' + m.title).join(', ')}`,
    c.client ? `  Built for ${c.client}. The brand is in ${c.brandFile ? rel(c.brandFile) : 'no file'}, outside the repository.` : '  The dashboard names no client.',
    '  ' + live, '',
    ...doorsText(c.doors), '',
    ...capsText(c.capabilities), '',
    'In the repository (no client name in either; ' + (c.packs.scanned ? 'both scanned against the withheld list' : 'the withheld list was not found, so they were NOT scanned') + '):',
    wrote('content', c.packs.content), wrote('paid', c.packs.paid),
    `Outside it: ${rel(path.dirname(c.copy || c.brandFile || c.file))}  (the dashboard copy, the ZIP model, the competitor roster${c.live.ok ? ', the computed model' : ''})`,
    ...(c.drift.length ? ['', 'Rules to watch: ' + c.drift.map(d => `${d.id} (${d.why})`).join('; ') + '. Screen copy against the running dashboard before it is handed over.'] : []),
  ].join('\n');
}

/* status */
export function statusText(s) {
  if (!s.connected) return 'No dashboard is connected on this machine.\nAsk for the dashboard file (the atlas as one .html file) and connect it:\n  node paid-ads/cli.mjs connect <atlas.html>      (the content strategist\'s cli.mjs takes the same command)';
  const c = s.connection, age = Math.round((Date.now() - Date.parse(c.connectedAt)) / 36e5);
  return [
    'Connected: ' + identityLine(c), `  connected ${age < 1 ? 'under an hour' : age + ' hour' + (age === 1 ? '' : 's')} ago from ${rel(c.file)}`,
    c.client ? `  built for ${c.client}` : '', `  ${c.counts.angles} service angles, ${c.counts.zips} ZIP markets, ${c.counts.lines} service lines, ${c.counts.rules} advertising rules, ${c.counts.competitors} competitors`,
    `  running the dashboard here: ${c.live.ok ? 'yes' : 'no (' + c.live.why + ')'}`,
    ...(s.problems.length ? ['', ...s.problems.map(p => 'PROBLEM  ' + p)] : []), '',
    ...doorsText(c.doors), '', ...capsText(c.capabilities),
  ].filter(x => x !== '').join('\n').replace(/\n(Doors|Paid ads specialist|Content strategist)/g, '\n\n$1');
}

/* what the running Campaign Desk made of a plan file */
export function deskCheckText(d) {
  if (!d.accepted) return `REFUSED by the Campaign Desk: "${d.verdict || 'no answer'}". The plan the desk held did not change.`;
  const p = d.plan, k = Object.fromEntries(Object.entries(d.kpis).map(([a, b]) => [a, b.value]));
  return [
    `ACCEPTED by the Campaign Desk ("${d.verdict}").`,
    `  The desk now holds: line ${p.line}, $${Math.round(p.budget).toLocaleString('en-US')} a month, ${p.weeks} weeks from ${p.start}, ${p.zips.length} market${p.zips.length === 1 ? '' : 's'} (${p.scope}), angles ${p.angles.join(', ') || 'none'}`,
    `  Its forecast: ${Object.entries(k).map(([a, b]) => `${a} ${b}`).join(' · ')}`,
    ...d.platforms.map(x => `    ${x.platform.padEnd(24)} $${String(Math.round(x.spend).toLocaleString('en-US')).padStart(7)}  ${String(Math.round(x.clicks)).padStart(6)} clicks  ${String(Math.round(x.leads)).padStart(5)} leads  ${String(x.booked).padStart(6)} booked`),
    ...(d.flight.length ? ['  Flight: ' + d.flight.map(f => `${f.month} $${Math.round(f.media).toLocaleString('en-US')}`).join(', ')] : []),
    ...d.warnings.map(w => '  NOTE from the desk: ' + w.replace(/\s+/g, ' ')),
    ...(d.files ? ['  The desk\'s own files for this plan: ' + d.files.map(f => f.name).join(', ')] : []),
    ...(d.errors.length ? ['  The page raised errors: ' + d.errors.slice(0, 3).join(' | ')] : []),
  ].join('\n');
}
/* what the running Publish module made of a pages file */
export function publishCheckText(r) {
  if (!r.accepted) return `REFUSED by Publish: "${r.verdict || 'no answer'}".`;
  return [`ACCEPTED by Publish: ${r.pages.length} page${r.pages.length === 1 ? '' : 's'} listed as ${r.pages.map(p => '/' + p + '/').join(', ')}.`, ...r.listed.map(l => `  /${l.slug}/  ${l.row.slice(0, 7).join(' · ')}`), ...(r.errors.length ? ['  The page raised errors: ' + r.errors.slice(0, 3).join(' | ')] : [])].join('\n');
}

/* the Heat Desk's plan */
export function heatText(h) {
  if (!h) return 'This dashboard has no Heat Desk.';
  const $ = n => '$' + Math.round(n || 0).toLocaleString('en-US'), T = h.totals, w = h.week;
  return [
    `Heat Desk plan for ${h.month}: ${$(T.spent)} of ${$(T.budget)} placed in ${T.zips} ZIPs, ${T.within20min}% of it within 20 minutes of ${h.origin ? h.origin.label : 'the shop'}, farthest ${T.farthestMin} minutes.`,
    `  Modeled: ${T.leads} leads at ${$(T.cpl)}, ${T.jobs} booked jobs at ${$(T.costPerJob)}, gross profit ${$(T.grossProfit)} with the replacement pipeline (${$(T.grossProfitDirect)} direct). Leads, jobs and profit are grade ${h.grades.leads}.`,
    '  Lines:', ...h.lines.map(l => `    ${l.name.padEnd(26)} ${String(l.share).padStart(5)}%  ${$(l.dollars).padStart(8)}  ${String(l.zips).padStart(3)} ZIPs  ${String(l.leads).padStart(5)} leads at ${$(l.cpl)}   season index ${l.season}`),
    '  Platforms that run: ' + h.platforms.filter(p => p.dollars > 0).map(p => `${p.name} ${$(p.dollars)} (${p.share}%)`).join(', '),
    ...h.platforms.filter(p => p.folded.length).map(p => `    ${p.name} folds to Google Search for ${[...new Set(p.folded.map(f => f.line))].join(', ')}: its share is under the ${$(p.min)} minimum`),
    '  Campaigns (all paused): ' + h.campaigns.map(c => `${c.name} ${$(c.budget)}`).join(', '),
    `  Hand off to the Campaign Desk: line ${h.hand.line}, ${h.hand.zips.length} ZIPs with bid adjustments from ${Math.min(...Object.values(h.hand.bids))}% to ${Math.max(...Object.values(h.hand.bids))}%.`,
    ...(w ? ['', w.stale || w.source === 'normal' ? `This week: the forecast in the file is ${w.forecastAgeHours != null ? w.forecastAgeHours + ' hours old' : 'missing'}, so the week runs at normal and nothing is released. Open the dashboard for a live read.` : `This week (${w.from} to ${w.to}, forecast ${w.forecastAgeHours} hours old): ${w.head ? w.head.headline : ''}`,
      ...(w.stale || w.source === 'normal' ? [] : [`  ${$(w.totals.week)} against a normal ${$(w.totals.normal)}. ${w.reserve}`, '  ' + w.lines.map(l => `${l.name} x${l.multiplier}${l.paused ? ' (paused)' : ''}`).join(', '), w.trigger ? '  TRIGGER: ' + w.why : '  No trigger this week.', ...w.rules.map(r => `  Rule fired: ${r.id}: ${r.budget}`)])] : []),
    ...(h.weekError ? ['  The week could not be read: ' + h.weekError] : []),
  ].join('\n');
}
