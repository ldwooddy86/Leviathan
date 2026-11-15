import csv, json, sys, re
# choose the money set from the crawl: homepage, two service pages, one location page, contact, privacy
d, home, vert = sys.argv[1], sys.argv[2], sys.argv[3]
rows = list(csv.DictReader(open(f'omega_cache/{d}/google_crawl/crawl.csv')))
urls = [r['final_url'] or r['url'] for r in rows if r['status'] == '200']
inv = []
try:
    inv = [r.get('url') or r.get('loc') for r in csv.DictReader(open(f'omega_cache/{d}/google_crawl/sitemap_inventory.csv'))]
except Exception: pass
allu = list(dict.fromkeys(urls + [u for u in inv if u]))
KW = {'lawn': ['lawn-care', 'weed', 'aeration', 'fertiliz', 'tree-care', 'mosquito'],
      'pest': ['pest-control', 'termite', 'mosquito', 'rodent', 'bed-bug', 'ant-control'],
      'plumbing-hvac': ['plumbing', 'water-heater', 'drain', 'air-condition', 'ac-repair', 'hvac', 'furnace', 'heating'],
      'dental': ['emergency-dent', 'tooth', 'root-canal', 'extraction', 'implant', 'invisalign'],
      'legal-pi': ['car-accident', 'personal-injury', 'truck', 'motorcycle', 'wrongful', 'slip']}
kws = KW.get(vert, [])
def pick(pred, n, exclude):
    out = []
    for u in allu:
        if u in exclude: continue
        if pred(u.lower()): out.append(u)
        if len(out) >= n: break
    return out
chosen = [home]
svc = []
for k in kws:
    svc += pick(lambda u, k=k: k in u and not re.search(r'blog|article|/news|faq', u) and u.count('/') <= 4, 1, chosen + svc)
    if len(svc) >= 2: break
chosen += svc[:2]
loc = pick(lambda u: re.search(r'(location|service-area|areas|-co$|-wa$|-ne$|-ca$|-ky$|-oh$)|lawn-care-[a-z-]+$|pest-control-[a-z-]+$|plumber-|-city', u) is not None and not re.search(r'blog', u), 1, chosen)
chosen += loc
contact = pick(lambda u: 'contact' in u or 'schedule' in u or 'book' in u or 'free-quote' in u or 'get-a-quote' in u, 1, chosen)
privacy = pick(lambda u: 'privacy' in u, 1, chosen)
chosen += contact + privacy
print(json.dumps({'money': [home] + svc[:2] + loc, 'contact': contact, 'privacy': privacy, 'scan': chosen}))
