/* The Emergency Satchel's copy rules, as tests that run without the dashboard.

   The dashboard screens every ad and page it writes against its own rule pack (satchelLint in the atlas). An agent's
   copy has to pass the same screen before it is handed over, so the tests are ported here, rule for rule, from the pack
   dated 2026-09-25 (the pack Build 4, Build 5 and Build 6 of the DFW Thermal Debt Atlas carry).

   A rule's name, enforcer, cite, severity and fix are never kept here: they are read from the connected dashboard and
   passed in. Each ported test carries the fingerprint of the dashboard test it was written from. A dashboard whose rule
   has another fingerprint, or a rule with no port, is reported by drift(), and the caller then says so and leans on the
   dashboard's own screen (dashboard-link/lib/live.mjs: lint). */

const quote = m => `"${m[0]}"`;

/* id -> { from: fingerprint of the dashboard's test, test(text, ctx) -> evidence or null } */
export const TESTS = {
  TDLR1: { from: '630632dcaa6f', test: (t, c) => c && c.needLic && !/TAC\s?L\s?[A-Z]\s?\d{4,}/i.test(t) && !(c.lic && t.includes(c.lic)) ? 'No TDLR license number (TACLA or TACLB format) found in the asset set' : null },
  TDLR2: { from: 'c10cc41996b7', test: (t, c) => c && c.page && /(proposal|estimate|invoice|contract|financ)/i.test(t) && !/Texas Department of Licensing and Regulation/i.test(t) ? 'Page discusses proposals or contracts without the TDLR regulated-by notice' : null },
  TAX1: { from: '4f81816c490f', test: t => {
    const hit = String(t).split(/[.!?]\s+/).find(x => /(tax credit|25C|federal rebate|IRA rebate|inflation reduction act)/i.test(x) && !/(ended|expired|lapsed|no longer|not available|terminated|does not qualify|did not survive)/i.test(x));
    if (!hit) return null; return quote(hit.match(/(tax credit|25C|federal rebate|IRA rebate|inflation reduction act)/i));
  } },
  REGZ1: { from: 'b09ceda82cd4', test: t => {
    const m = t.match(/(\b\d{1,3}\s*(monthly\s*)?payments?\b|\$\s?\d[\d,]*\s*(\/|a|per)\s*(mo|month)\b|\d+(\.\d+)?%\s*(apr|interest|financing)|\b0%\s*(apr|interest|financing)|down payment|no interest|interest free|\d+\s*months?\s*(no|0%|same as cash))/i);
    if (!m) return null; return /\bAPR\b.*\b(terms|approval)\b|\b(terms|approval)\b.*\bAPR\b/i.test(t) ? null : `"${m[0]}" without APR, terms and repayment disclosure`;
  } },
  FREE1: { from: 'e675bbbfbf75', test: t => { const m = t.match(/\bfree\b[^.]{0,40}/i); return m ? `"${m[0].trim()}"` : null; } },
  GUAR1: { from: 'a1a9adcec340', test: t => { const m = t.match(/\b(guarantee[ds]?|guaranteed|warrant(y|ies)|lifetime (warranty|guarantee|coverage|protection|service))\b[^.]{0,40}/i); return m && !/(terms|details|see|conditions)/i.test(t) ? `"${m[0].trim()}"` : null; } },
  SUP1: { from: 'a0edb0d99105', test: t => { const m = t.match(/(#\s?1\b|number one|best (hvac|ac|price|in )|lowest price|cheapest|top rated|highest rated|most trusted|beat any price)/i); return m ? quote(m) : null; } },
  REV1: { from: 'feee66584b71', test: t => { const m = t.match(/(\d[\d,]{2,}\+?\s*(five|5)\s*star|\b[45](\.\d)?\s*stars?\b|five star rated|5 star rated)/i); return m ? quote(m) : null; } },
  URG1: { from: 'ca09829dd670', test: t => { const m = t.match(/(only \d+ (spots|slots|units|left)|offer ends in|today only|act now|last chance|expires tonight)/i); return m ? quote(m) : null; } },
  R22A: { from: '0d595e48eccb', test: t => { const m = t.match(/(r[\s-]?22|r[\s-]?410a|freon)[^.]{0,40}(illegal|banned to use|must be replaced|outlawed|no longer legal)/i); return m ? quote(m) : null; } },
  INS1: { from: '496d9f17468d', test: t => { const m = t.match(/(we (will |can |)(handle|negotiate|manage|settle) (your |the )?(insurance )?claim|deal with your insurance( company)?|work(s)? directly with your insurance|we'?ll handle the claim|free roof|waive (your )?deductible|pay (your )?deductible)/i); return m ? quote(m) : null; } },
  EFF1: { from: '5a47f63e001e', test: t => { const m = t.match(/\b(seer2?|eer2?|hspf2?|afue)\b\s*(of|rating of|:)?\s*\d{1,2}(\.\d)?(?!\d)|\b\d{1,2}(\.\d)?\s*(seer2?|eer2?|hspf2?)\b/i); return m ? quote(m) : null; } },
  ES1: { from: '4034f332590c', test: t => /energy\s?star/i.test(t) ? '"ENERGY STAR" mentioned' : null },
  LIC2: { from: '4140086761e3', test: t => { const m = t.match(/(licensed (and|&) insured|bonded|nate certified|epa certified|factory authori[sz]ed|elite dealer|diamond contractor)/i); return m ? quote(m) : null; } },
  AVL1: { from: 'f34a15e63042', test: t => { const m = t.match(/(24\/7|24 hours|around the clock|same day|open 7 days)/i); return m ? quote(m) : null; } },
  SMS1: { from: '8d8d39912a65', test: t => { const m = t.match(/(text you|we'?ll text|send you texts|sms updates|text message offers)/i); return m && !/(consent|stop to opt out|reply stop|not a condition)/i.test(t) ? quote(m) : null; } },
  GGL1: { from: '429460aba2b8', test: t => /!/.test(t) ? 'exclamation mark' : /\b[A-Z]{5,}\b/.test(t.replace(/\b(HVAC|TDLR|SEER|AFUE|HSPF|ENERGY|STAR|NATE|TACLA|TACLB)\b/g, '')) ? 'all capitals word' : null },
  GGL2: { from: 'd5cbb747e572', test: t => /\(?\d{3}\)?[\s.]\d{3}[\s.]\d{4}/.test(t) ? 'phone number in text' : null },
  META1: { from: '158426d478ab', test: t => { const m = t.match(/(your (credit|debt|finances)|bad credit|are you (broke|struggling)|behind on bills)/i); return m ? quote(m) : null; } },
  META2: { from: '949d82ca4846', test: t => /(financ|monthly payment|apr|credit approval)/i.test(t) ? 'financing language in a Meta asset' : null },
  HOUSE1: { from: '95c72294c017', test: t => { const m = t.match(/\S*[‐-―−-]\S*/); return m && !/^https?:|^\/|@/.test(m[0]) ? quote(m) : null; } },
  HOUSE2: { from: 'bb4ecfe5d487', test: t => { const m = t.match(/(\[[^\]]*\]|\bTBD\b|lorem ipsum|as an ai|note to (self|editor)|placeholder|insert (here|name)|\{\w+\})/i); return m ? quote(m) : null; } },
};

/* Which of a dashboard's rules this port does not speak for: [{id, why}]. `rules` is the list the link read from the
   dashboard, each with its test fingerprint. An empty list means the port and the dashboard agree rule for rule. */
export function drift(rules) {
  const out = [];
  for (const r of rules || []) {
    const p = TESTS[r.id];
    if (!p) out.push({ id: r.id, why: 'this toolkit has no test for it' });
    else if (r.test && r.test !== p.from) out.push({ id: r.id, why: 'the dashboard\'s test has changed since this toolkit\'s was written' });
  }
  return out;
}

/* The dashboard's satchelLint, rule for rule: [{rule, ev}]. `rules` are the dashboard's (id, enforcer, severity, scope,
   name, cite, fix). ctx: lic (the license number), needLic (the text is a whole asset set that must carry it), headline
   (the text is one headline), platform ('meta' turns the Meta special category note on), page, web, noHouse. */
export function lint(text, ctx, rules) {
  ctx = ctx || {}; const out = [];
  for (const r of rules || []) {
    const p = TESTS[r.id]; if (!p) continue;
    if (ctx.web && /^(Google Ads|Meta)$/.test(r.enforcer)) continue;
    if (r.scope === 'headline' && !ctx.headline) continue;
    if (r.scope === 'meta' && ctx.platform !== 'meta') continue;
    if (r.scope === 'page' && !ctx.page) continue;
    if (r.scope === 'asset' && !ctx.needLic) continue;
    if (r.scope === 'copy' && ctx.noHouse) continue;
    let ev = null; try { ev = p.test(String(text), ctx); } catch { ev = null; }
    if (ev) out.push({ rule: r, ev });
  }
  return out;
}

/* A set of ad texts the way the Campaign Desk screens one (its lintSet): the texts together must carry the license
   number, and each text alone is read for the editorial rule on exclamation marks and capitals. The desk reads every
   text of the set that way, descriptions as well as headlines, so this does too. ctx: lic, platform. */
export function lintSet(texts, ctx, rules) {
  ctx = ctx || {}; texts = (texts || []).map(String);
  const found = lint(texts.join(' \n '), { lic: ctx.lic, needLic: true, platform: ctx.platform }, rules);
  for (const t of texts) for (const x of lint(t, { lic: ctx.lic, headline: true }, rules)) if (x.rule.id === 'GGL1') found.push(Object.assign({ in: t }, x));
  return found;
}
