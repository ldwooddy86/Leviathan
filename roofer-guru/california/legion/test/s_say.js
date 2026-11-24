const L = await window.__LEGION_LOAD__(); await L.ready(); const out = { topics: {}, alt: {} };
const ids = []; for (const z of ['90012', '93546', '92277', '95969', '94110']) L.npcsOf(z, { limit: 60, offset: 300 }).people.filter(p => p.age >= 18).slice(0, 8).forEach(p => ids.push(p.id));
for (const k of L.topics) { const c = {}; let ex = null; for (const id of ids) { const r = L.say(id, k); const i = r ? r.intent : 'null'; c[i] = (c[i] || 0) + 1; if (!ex && r) ex = r.text; } out.topics[k] = [c, ex && ex.slice(0, 110)]; }
const ALT = { wind: ['Do the Santa Ana winds get bad here?', 'Is it windy here?', 'Have you had wind damage here?', 'What about the wind storms?'], smoke: ['Is the air smoky during fire season?', 'How is the smoke from the fires?', 'Do the fires make the air bad here?'],
  roof: ['How old is your roof?', 'Tell me about your roof.', 'Does your roof leak?'], history: ['What happened around here over the years?', 'Any big events you remember here?'], self: ['Who are you?', 'What is your story?'] };
for (const [k, qs] of Object.entries(ALT)) for (const q of qs) { const c = {}; let ex = null; for (const id of ids) { const r = L.say(id, q); const i = r ? r.intent : 'null'; c[i] = (c[i] || 0) + 1; if (!ex && r && r.intent !== 'unknown') ex = r.text; } out.alt[k + ': ' + q] = [c, ex && ex.slice(0, 110)]; }
out.n = ids.length; return out;
