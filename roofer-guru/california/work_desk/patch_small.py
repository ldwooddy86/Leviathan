"""Targeted California edits to 12_accounts_core.js, 27_m15_accounts.js, 30_m16_publish.js.
   Each anchor must occur exactly the stated number of times. Run once: python3 -I patch_small.py"""
import os, sys
SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'atlas', 'src')

def patch(name, reps):
    p = os.path.join(SRC, name)
    t = open(p, encoding='utf-8').read()
    for old, new, n in reps:
        c = t.count(old)
        assert c == n, (name, old[:70], 'found', c, 'expected', n)
        t = t.replace(old, new)
    open(p, 'w', encoding='utf-8').write(t)
    print('patched', name, len(reps), 'anchors')

# ---------------- 12_accounts_core.js ----------------
old_lineof = t0 = None
p12 = os.path.join(SRC, '12_accounts_core.js')
t = open(p12, encoding='utf-8').read()
a = t.index("  function lineOf(name) {")
b = t.index("\n", a)
new_lineof = (
    "  /* Campaign names written by the Campaign Desk start with this token: CA_<LINE>_<PLATFORM>_<LANG>_<YYYYMMDD>. One constant, read by the\n"
    "     Desk (module 08), the import template and module 15, so the prefix cannot drift between the writer and the readers. */\n"
    "  const PREFIX = 'CA_';\n"
    "  /* A campaign name to one of the thirteen California service lines: the desk token first, then the first keyword family that matches.\n"
    "     Order matters: the narrow lines (fire hardening, fire rebuild, solar, tile) are tested before the broad ones (storm, repair, replace). */\n"
    "  const LINE_WORDS = [\n"
    "    [/harden|class a\\b|ember|\\bvents?\\b|\\bwui\\b|fire zone|fire safe|fire resist|fair plan|non ?renew/, 'harden'],\n"
    "    [/wildfire|fire damage|fire rebuild|rebuild|burn|smoke/, 'fire'],\n"
    "    [/solar|detach|reset|remove and reinstall|\\bpv\\b|panel/, 'solar'],\n"
    "    [/\\btile\\b|underlayment|lift and relay|relay|teja/, 'tile'],\n"
    "    [/mobile home|manufactured|roof ?over/, 'mh'],\n"
    "    [/apartment|condo|\\bhoa\\b|multifamily|multi family/, 'mf'],\n"
    "    [/coating|restoration|silicone|maintenance/, 'coat'],\n"
    "    [/commercial|flat roof|\\btpo\\b|\\bpvc\\b|epdm|low slope|cool roof|title 24/, 'comm'],\n"
    "    [/new construction|builder/, 'newc'],\n"
    "    [/metal|standing seam/, 'metal'],\n"
    "    [/storm|wind|rain|atmospheric|santa ana|tarp|emergency|tormenta/, 'storm'],\n"
    "    [/leak|repair|gotera|reparaci/, 'repair'],\n"
    "    [/replace|new roof|re ?roof|shingle|roof|techo|lsa|local services/, 'replace'],\n"
    "  ];\n"
    "  function lineOf(name) { const s = String(name || ''); const m = s.match(new RegExp(PREFIX + '([A-Z0-9]+)_')); if (m) { const tok = m[1]; const hit0 = PL.find(l => l.tok === tok || String(l.key).toUpperCase() === tok); if (hit0) return hit0.key; if (tok === 'BLEND') return PL.some(l => l.key === 'replace') ? 'replace' : ''; } const t = s.toLowerCase(); const hit = LINE_WORDS.find(([re, k]) => re.test(t) && PL.some(l => l.key === k)); return hit ? hit[1] : ''; }"
)
assert t.count(t[a:b]) == 1
t = t[:a] + new_lineof + t[b:]
open(p12, 'w', encoding='utf-8').write(t)

patch('12_accounts_core.js', [
    ("const KEY = 'cf.accounts.v1';", "const KEY = 'cg.accounts.v1';", 1),
    ("match(/\\b(7[01]\\d{3})\\b/)", "match(ZIP_RE)", 1),
    ("  function importCSV(text, forceId, srcLabel) {",
     "  /* California ZIP codes run 90001 to 96162. A code that passes the pattern but is not an atlas ZIP is kept (a PO box, a ZIP with no homes);\n"
     "     module 15 says so beside it. */\n"
     "  const ZIP_RE = /\\b(9[0-6]\\d{3})\\b/;\n"
     "  function importCSV(text, forceId, srcLabel) {", 1),
    ("Campaign names that contain the desk token (LA_REPLACE_, LA_STORM_, LA_HAIL_, ...) map to service lines automatically.\\nLines that start with # are notes and are not imported. Example row: 2026-10-01,17,LA_REPLACE_META_EN_20261012,70808,1200,18,42.5,2,1');",
     "Campaign names that contain the desk token (' + PREFIX + 'REPLACE_, ' + PREFIX + 'STORM_, ' + PREFIX + 'TILE_, ...) map to service lines automatically.\\nLines that start with # are notes and are not imported. Example row: ' + dstr(new Date()) + ',17,' + PREFIX + 'REPLACE_META_EN_' + dstr(new Date()).replace(/-/g, '') + ',' + ((typeof ZR !== 'undefined' && ZR[0] && ZR[0].zip) || '90001') + ',1200,18,42.5,2,1');", 1),
    ("revertModels, clearAll, lineOf,", "revertModels, clearAll, lineOf, PREFIX, ZIP_RE,", 1),
])

# ---------------- 27_m15_accounts.js ----------------
patch('27_m15_accounts.js', [
    ("Campaign names that carry the desk token (LA_REPAIR_, LA_REPLACE_ and so on) map to lines automatically",
     "Campaign names that carry the desk token (${esc(ACCT.PREFIX)}REPAIR_, ${esc(ACCT.PREFIX)}REPLACE_ and so on) map to lines automatically", 1),
    ("Uplift Louisiana Roofing Atlas, module 15.", "California Roofer Guru, module 15.", 1),
    ("store.get('up.desk.v1', {})", "store.get(DESK_KEY, {})", 3),
    ("    const st = { range: (ACCT.settings() || {}).range || 30, hourLine: 'all', confirm: {} };",
     "    const st = { range: (ACCT.settings() || {}).range || 30, hourLine: 'all', confirm: {} };\n"
     "    /* the Campaign Desk (module 08) saves its plan under this key; the pacing card reads the same one */\n"
     "    const DESK_KEY = 'cg.desk.v1';", 1),
    ("'not an atlas ZIP: outside Louisiana, or a PO box or other ZIP with no homes mapped'",
     "'not an atlas ZIP: outside California, or a PO box or other ZIP with no homes mapped'", 1),
])

# ---------------- 30_m16_publish.js ----------------
patch('30_m16_publish.js', [
    ("Uplift Louisiana Roofing Atlas, module 16.", "California Roofer Guru, module 16.", 1),
    ("'cf.publish.loaded'", "'cg.publish.loaded'", 2),
    ("const CK = 'cf.publish.composer';", "const CK = 'cg.publish.composer';", 1),
    ('<option value="es-US">Spanish (es-US)</option><option value="es-MX">Spanish (es-MX)</option><option value="en-GB">English (en-GB)</option><option value="fr-CA">French (fr-CA)</option>',
     '<option value="es-US">Spanish (es-US)</option><option value="es-MX">Spanish (es-MX)</option><option value="zh-Hans">Chinese, simplified (zh-Hans)</option><option value="zh-Hant">Chinese, traditional (zh-Hant)</option><option value="vi">Vietnamese (vi)</option><option value="tl">Tagalog (tl)</option><option value="ko">Korean (ko)</option><option value="en-GB">English (en-GB)</option>', 1),
])
