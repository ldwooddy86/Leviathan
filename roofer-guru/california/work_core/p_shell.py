import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('99_shell.js', [
 ("""/* California labels for the module rail. Each module names itself in its own file; this table is the shell's copy of the
   California names, used when a module's own title or blurb still carries a word that has no place in this edition, so
   the rail is right whatever order the parts were rewritten in. Keys and ids never change: routing reads them. */""",
  """/* California labels for the module rail. Each module names itself in its own file; this table is the one place the rail's
   names and blurbs are settled for the seventeen atlas modules, with every count taken from the data, so the rail is
   right whatever order the parts were rewritten in. Module 18 (Rooftop Scout) keeps its own. Keys and ids never change:
   routing reads them. */"""),
 ("""  const stale = /\\b(Louisiana|parish|parishes|hurricane|hurricanes|FORTIFIED|LSLBC|Gulf|tornado)\\b|\\b(64|nine|eleven)\\b/i;
  MODS.forEach(m => { const c = MOD_CA[m.key]; if (!c) return; if (stale.test(m.title || '') || (m.key === 'storms' && /^Storm Ledger$/i.test(m.title || '')) || (m.key === 'weather' && /^Storm Desk$/i.test(m.title || ''))) m.title = c[0]; if (!m.desc || stale.test(m.desc)) m.desc = c[1](); });""",
  """  MODS.forEach(m => { const c = MOD_CA[m.key]; if (!c) return; m.title = c[0]; m.desc = c[1](); });"""),
])
