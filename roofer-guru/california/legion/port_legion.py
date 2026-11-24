"""California Roofer Guru, Rooftop Scout: Legion made usable as a library inside another page.

   python3 -I port_legion.py <Legion.html in> <out dir>

Legion.html (the user's app, never edited) is cut into its parts, and its bundle is given three changes and no others,
by anchored replacements (each anchor must occur exactly once):

  boot        the last statement of the bundle, the call that boots the page, becomes
              `window.__LEGION_EMBED__ ? __LG_API__() : <boot>()`. With the flag unset the page boots as before.
  __LG_API__  new code (legion_api.js), put inside the bundle so that it can reach Legion's internals: it publishes
              window.__LEGION__ (LEGION_CONTRACT.md section 8). It is a function declaration: it runs only when called.
  storage     the seven storage names (localStorage `legion.settings.v1`, `legion.claude.apiKey`, `legion.mind.` twice,
              `legion.osm.v2.`, `legion.osm.v1.`; IndexedDB `legion-crowd`) pass through __LGK(name), which returns the
              name unchanged unless window.__LEGION_STORAGE__ is set (to `cg.legion`): then `cg.legion.v1`,
              `cg.legion.claude.apiKey`, `cg.legion.mind.`, `cg.legion.osm.v2.`, `cg.legion.osm.v1.`, `cg.legion.crowd`.

The names legion_api.js needs from inside the bundle are minified and change with every build of Legion. Each is found
by a pattern on text that does not change (property names, string literals) and must be found exactly once; the table
NAMES below is the one in LEGION_CONTRACT.md section 9.

Written to <out dir>:
  legion.pack.js       window.__LEGION_PACK__="..."          as in the original, byte for byte
  legion.worker.js     window.__LEGION_WORKER_SRC__="..."    as in the original, byte for byte
  legion.bundle.js     the bundle with the three changes
  legion.css           the stylesheet, as in the original
  legion.markup.html   the body markup, as in the original
  legion.parts.js      window.__LEGION_PARTS__ = { build, css, markup }   (what mount() builds its frame from)
  legion.embed.html    the block to put in a host page: flags, parts, pack, worker source, the bundle kept as text
                       (not run at page load) and window.__LEGION_LOAD__() which runs it on first use
  Legion.patched.html  the original page with only its bundle replaced: must behave exactly as the original
  names.json           the minified names found in this build
"""
import os, re, sys, json, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
src, outdir = sys.argv[1], sys.argv[2]
html = open(src, encoding='utf-8').read()
api = open(os.path.join(HERE, 'legion_api.js'), encoding='utf-8').read()
os.makedirs(outdir, exist_ok=True)

def cut(text, a, b, what):
    """the text between anchor a and the next b; a must occur exactly once"""
    assert text.count(a) == 1, ('anchor count', what, text.count(a), a[:80])
    i = text.index(a) + len(a); j = text.index(b, i)
    return text[i:j], i, j

# ---- the parts of the page ----
css, _, _ = cut(html, '<style>', '</style>', 'stylesheet')
pack, _, _ = cut(html, '<script>window.__LEGION_PACK__="', '"</script>', 'pack')
wsrc, _, _ = cut(html, '<script>window.__LEGION_WORKER_SRC__="', '"</script>', 'worker source')
bundle, b0, b1 = cut(html, '<script>(()=>{var ', '</script>', 'bundle')
bundle = '(()=>{var ' + bundle; b0 -= len('(()=>{var ')
assert html[b1:].strip() == '</script>\n</body>\n</html>'.replace('\n', '') or html[b1:].replace('\n', '').replace(' ', '') == '</script></body></html>', 'the bundle is not the last script of the page'
markup, _, _ = cut(html, '<body>', '<script>window.__LEGION_PACK__="', 'markup')
build, _, _ = cut(html, '<meta name="legion-build" content="', '"', 'build id')
assert re.fullmatch(r'[\w.-]{3,40}', build), build
assert '</script' not in bundle and '</script' not in pack and '</script' not in wsrc and '</style' not in css
orig_bundle = bundle

# ---- the names of Legion's internals in this build ----
N = r'([\w$]+)'
NAMES = [  # (plain names, pattern with one group per name)
    (('services',), N + r'\.prewarmCrowd\('),
    (('bus', 'events'), N + r'\.emit\(' + N + r'\.NPC_SELECT,\{id:[\w$]+,source:"link"\}\)'),
    (('Settings',), r'new ' + N + r'\(\{bus:[\w$]+,models:'),
    (('Clock',), r'new ' + N + r'\(\{t0:[\w$]+\.snapshotTime,speed:60'),
    (('NpcPanel',), r'new ' + N + r'\(\{el:[\w$]+\("#npc-panel"\)'),
    (('PlacePanel',), r'new ' + N + r'\(\{el:[\w$]+\("#place-panel"\)'),
    (('crowdGen',), r'=' + N + r'\(this\.world,this\.population,\{rate:this\.rate,seed:this\.seed,focus:'),
    (('roadNet',), r'this\.net=' + N + r'\([\w$]+\),this\.chunks=\[\]'),
    (('agentAt',), r'=' + N + r'\([\w$]+\.chunk,[\w$]+\.i,this\.minute,this\.dow,this\.net\)'),
    (('agentId',), r'_describe\([\w$,]+\)\{let [\w$]+=' + N + r'\('),
    (('minuteDow',), r'this\.t=\+[\w$]+;let [\w$]+=' + N + r'\(this\.t\)'),
    (('modeNames', 'stateNames', 'kindNames'), r'commuteMode:' + N + r'\[[\w$]+\],state:' + N + r'\[[\w$]+\.state\],school:[^,]+,kind:[\w$.]+>=0\?' + N + r'\['),
    (('persona', 'mind', 'schedule', 'dialogue', 'llm', 'street', 'weather'),
     r'Object\.freeze\(\{persona:' + N + ',mind:' + N + ',schedule:' + N + ',dialogue:' + N + ',llm:' + N + ',street:' + N + ',weather:' + N + r'\}\)'),
    (('activityText',), r'this\.services\.activityAt\(this\.id,[\w$]+\),[\w$]+=[\w$]+\.ok\?' + N + r'\('),
    (('boot',), r'\}\}\}' + N + r'\(\);\}\)\(\);\s*$'),
    (('MindStore',), r'\.setMindStore\(new ' + N + r'\)'),
    (('buildId',), r'buildId:' + N + r'\(\),getBuild'),
    (('toast',), r'function ' + N + r'\([\w$]+,\{kind:[\w$]+="info",timeout:'),
]
names = {}
for plain, rx in NAMES:
    m = re.findall(rx, bundle)
    assert len(m) == 1, ('name not found exactly once', plain, len(m))
    got = m[0] if isinstance(m[0], tuple) else (m[0],)
    for k, v in zip(plain, got): names[k] = v

# ---- the API source, with the names written in ----
used = set(re.findall(r'@@(\w+)@@', api))
assert used <= set(names), ('the API asks for names that were not looked for', used - set(names))
api_js = re.sub(r'@@(\w+)@@', lambda m: names[m.group(1)], api)
assert '@@' not in api_js and '</script' not in api_js

def rep(a, b, n=1):
    global bundle
    assert bundle.count(a) == n, ('anchor count', bundle.count(a), a[:110])
    bundle = bundle.replace(a, b)

assert '__LGK' not in bundle and '__LG_API__' not in bundle and '__LEGION_EMBED__' not in bundle, 'port_legion is already applied'

# ---- storage names ----
LGK = ('var __LGK=function(k){var p=typeof window<"u"?window.__LEGION_STORAGE__:null;if(typeof p!="string"||!p)return k;'
       'return k==="legion.settings.v1"?p+".v1":k==="legion-crowd"?p+".crowd":p+k.slice(6)};')
rep('="legion.settings.v1"', '=__LGK("legion.settings.v1")')
rep('="legion.claude.apiKey"', '=__LGK("legion.claude.apiKey")')
rep('prefix:e="legion.mind."', 'prefix:e=__LGK("legion.mind.")')            # the mind store of the page (localStorage)
rep('.prefix||"legion.mind."', '.prefix||__LGK("legion.mind.")')            # the mind module's own store
rep('="legion.osm.v2."', '=__LGK("legion.osm.v2.")')                        # street data kept from OpenStreetMap
rep('["legion.osm.v1."]', '[__LGK("legion.osm.v1.")]')                      # the older keys it clears
rep('="legion-crowd"', '=__LGK("legion-crowd")')                            # IndexedDB: the built crowd
assert bundle.count('"legion.mind."') == 2 and bundle.count('"legion-crowd"') == 3   # 2 more are the workers' names, left alone
assert bundle.startswith('(()=>{var ')
bundle = '(()=>{' + LGK + bundle[len('(()=>{'):]                           # the helper, first thing in the bundle

# ---- the boot, and the API ----
boot = names['boot']
tail = '}}}' + boot + '();})();'
assert bundle.rstrip().endswith(tail), 'the end of the bundle is not as expected'
cutat = bundle.rstrip().rindex(boot + '();})();')
bundle = (bundle[:cutat] + 'function __LG_API__(){\n' + api_js + '\n}\n'
          + '(typeof window<"u"&&window.__LEGION_EMBED__)?__LG_API__():' + boot + '();})();')

# ---- undoing the changes gives the original back: nothing else was touched ----
undo = bundle.replace('(()=>{' + LGK, '(()=>{', 1)
undo = re.sub(r'__LGK\(("legion[.\-][\w.\-]*")\)', r'\1', undo)
i = undo.index('function __LG_API__(){\n'); j = undo.index('(typeof window<"u"&&window.__LEGION_EMBED__)?__LG_API__():')
undo = undo[:i] + undo[j:].replace('(typeof window<"u"&&window.__LEGION_EMBED__)?__LG_API__():', '', 1)
assert undo == orig_bundle.rstrip(), 'the patched bundle differs from the original outside the three changes'

# ---- the files ----
def put(name, text):
    with open(os.path.join(outdir, name), 'w', encoding='utf-8', newline='') as f: f.write(text)
    return len(text.encode('utf-8'))
sizes = {}
sizes['legion.pack.js'] = put('legion.pack.js', 'window.__LEGION_PACK__="' + pack + '"')
sizes['legion.worker.js'] = put('legion.worker.js', 'window.__LEGION_WORKER_SRC__="' + wsrc + '"')
sizes['legion.bundle.js'] = put('legion.bundle.js', bundle)
sizes['legion.css'] = put('legion.css', css)
sizes['legion.markup.html'] = put('legion.markup.html', markup)
def jstr(t): return json.dumps(t, ensure_ascii=False).replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
parts = 'window.__LEGION_PARTS__={build:' + jstr(build) + ',css:' + jstr(css) + ',markup:' + jstr(markup) + '};'
sizes['legion.parts.js'] = put('legion.parts.js', parts)
loader = ('window.__LEGION_LOAD__=function(){if(!window.__LEGION__){var e=document.getElementById("cg-legion-bundle"),s=document.createElement("script");'
          'window.__LEGION_EMBED__=true;if(!window.__LEGION_STORAGE__)window.__LEGION_STORAGE__="cg.legion";'
          's.id="cg-legion-run";s.textContent=e.textContent;document.head.appendChild(s);}'
          'return window.__LEGION__?Promise.resolve(window.__LEGION__):Promise.reject(new Error("Legion did not load"))};')
embed = ('<!-- Legion, as a library (CA/legion/port_legion.py). Nothing here runs at page load except three assignments. -->\n'
         '<script>window.__LEGION_EMBED__=true;window.__LEGION_STORAGE__="cg.legion";' + parts + loader + '</script>\n'
         '<script>window.__LEGION_PACK__="' + pack + '"</script>\n'
         '<script>window.__LEGION_WORKER_SRC__="' + wsrc + '"</script>\n'
         '<script type="text/plain" id="cg-legion-bundle">' + bundle + '</script>\n')
sizes['legion.embed.html'] = put('legion.embed.html', embed)
patched = html[:b0] + bundle + html[b1:]
sizes['Legion.patched.html'] = put('Legion.patched.html', patched)
put('names.json', json.dumps(names, indent=1))

# ---- everything parses ----
def parses(text, what):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(text); tmp = f.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True); os.unlink(tmp)
    assert r.returncode == 0, ('does not parse', what, r.stderr[:600])
parses('function __LG_API__(){\n' + api_js + '\n}', 'the API')
parses(bundle, 'the patched bundle')
parses(parts + loader, 'parts and loader')
print('port_legion: build', build, '| names', json.dumps(names))
print('port_legion: sizes', json.dumps(sizes), '| original', len(html.encode('utf-8')), '| bundle grew by', len(bundle.encode('utf-8')) - len(orig_bundle.encode('utf-8')), 'bytes')
