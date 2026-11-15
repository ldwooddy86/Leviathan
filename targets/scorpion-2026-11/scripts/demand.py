import json, sys, time, urllib.request, urllib.parse, datetime
# Google Autocomplete presence grid (public JSON endpoint, declared UA). Presence and ordering only; no volumes.
out_path, brand_terms = sys.argv[1], [b.lower() for b in sys.argv[2].split('|') if b]
seeds = sys.argv[3:]
rows = []
for s in seeds:
    u = 'https://suggestqueries.google.com/complete/search?' + urllib.parse.urlencode({'client': 'firefox', 'hl': 'en', 'gl': 'us', 'q': s})
    req = urllib.request.Request(u, headers={'User-Agent': 'OmegaWeapon/1.0 (declared site-audit bot; obeys robots.txt)'})
    try:
        raw = urllib.request.urlopen(req, timeout=15).read()
        try: txt = raw.decode('utf-8')
        except UnicodeDecodeError: txt = raw.decode('latin-1')
        sugg = json.loads(txt)[1]; status = 'ok'
    except Exception as e:
        sugg = []; status = 'refused: ' + str(e)[:80]
    present = any(any(b in x.lower() for b in brand_terms) for x in sugg)
    rows.append({'seed': s, 'suggestions': sugg, 'client_present': present, 'status': status, 'fetched': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ')})
    print(('%-45s %s %s' % (s, 'BRAND' if present else '-', '; '.join(sugg[:8])))[:230])
    time.sleep(1.5)
json.dump(rows, open(out_path, 'w'), indent=1)
