import json, csv, glob, os, sys, collections, re
# Compact marketing digest per domain: crawl and index, on-page, schema, local signals, tag stack, consent firing,
# lab speed, AI crawler directives, Autocomplete presence. Writes omega_cache/<d>/digest.json and prints a summary.
d = sys.argv[1]; C = 'omega_cache/' + d; F = {'domain': d}
def j(p, default=None):
    try:
        return json.load(open(p))
    except Exception:
        return default
def rcsv(p):
    return list(csv.DictReader(open(p))) if os.path.exists(p) else []
rows = rcsv(C + '/google_crawl/crawl.csv')
fd = rcsv(C + '/google_crawl/findings.csv')
codes = collections.Counter((r['severity'], r['code']) for r in fd)
ex = {}
for r in fd:
    ex.setdefault(r['code'], []).append(r['url'])
rep = open(C + '/google_crawl/crawl_report.md').read() if os.path.exists(C + '/google_crawl/crawl_report.md') else ''
m = re.search(r'(\d+) URL\(s\) in (\d+) sitemap', rep)
F['crawl'] = {'pages': len(rows), 'sitemap_urls': int(m.group(1)) if m else None,
              'indexable': sum(1 for r in rows if r.get('indexable') == 'True'),
              'codes': {k[0] + ' ' + k[1]: n for k, n in codes.most_common()},
              'examples': {k: v[:3] for k, v in ex.items()},
              'jsonld_types': dict(collections.Counter(t for r in rows for t in (r.get('jsonld_types') or '').split('|') if t)),
              'no_desc': sum(1 for r in rows if not r.get('description')),
              'long_title': sum(1 for r in rows if len(r.get('title') or '') > 70)}
pages = []
for p in sorted(glob.glob(C + '/web/*.web.json')):
    w = j(p, {})
    mt = w.get('meta', {}); fa = w.get('facts', {}); jl = w.get('jsonld', {}); ph = w.get('phones', {}); ft = w.get('footer', {})
    pages.append({'url': mt.get('final_url') or mt.get('url'), 'status': mt.get('status'), 'title': fa.get('title'), 'desc_len': len(fa.get('meta_description') or ''),
                  'words': fa.get('words'), 'canonical': fa.get('canonical'), 'robots_meta': fa.get('robots_meta'), 'generator': fa.get('generator'),
                  'jsonld_types': jl.get('types'), 'jsonld_flags': jl.get('flags'), 'entities': jl.get('entities'),
                  'tel_hrefs': ph.get('tel_hrefs'), 'phones_text': ph.get('distinct_numbers_in_text'),
                  'credits': ft.get('credits'), 'socials': w.get('socials'), 'disclosures': w.get('disclosures'),
                  'gtm': {k: v.get('tags') for k, v in (w.get('gtm_containers') or {}).items()}, 'tags': w.get('tags'),
                  'robots_ai': ((w.get('host_level') or {}).get('robots') or {}).get('ai_bots')})
F['pages'] = pages
sch = rcsv(C + '/schema/schema_findings.csv')
F['schema'] = dict(collections.Counter(r['entity_type'] + ' ' + r['severity'] + ' ' + r['charge'] + ' ' + r['detail'][:40] for r in sch).most_common(12))
gr = j(C + '/google_render.json', {}) or {}
F['render'] = [{k: x.get(k) for k in ('url', 'raw_words', 'rendered_words', 'js_dependent_share', 'lcp_ms_lab', 'requests', 'third_party_hosts', 'verdict')} | {'ttfb': (x.get('nav_timing_ms') or {}).get('ttfb'), 'load': (x.get('nav_timing_ms') or {}).get('load'), 'console_errors': len(x.get('console_errors') or [])} for x in gr.get('rows', [])]
pr = []
for p in glob.glob(C + '/render/*.render.json'):
    x = j(p, {})
    pr.append({'url': x.get('url'), 'status': x.get('status'), 'banner': (x.get('consent_banner') or {}).get('reading'), 'pre_consent': x.get('pre_consent_trackers'),
               'chat': x.get('chat_iframes'), 'ai_agents': x.get('ai_agent_markers'), 'prechecked': x.get('prechecked_checkboxes'), 'scarcity': x.get('scarcity_strings'),
               'timers': x.get('timer_strings_first_load'), 'requests': x.get('request_count'), 'hosts': x.get('third_party_hosts')})
F['probe'] = pr
F['demand'] = [{'seed': r['seed'], 'brand_in_list': r['client_present'], 'top': r['suggestions'][:10], 'status': r['status']} for r in (j(C + '/search/autocomplete.json', []) or [])]
json.dump(F, open(C + '/digest.json', 'w'), indent=1)
cr = F['crawl']
print('== ' + d + ': crawl ' + str(cr['pages']) + ' pages, sitemap ' + str(cr['sitemap_urls']) + ', indexable ' + str(cr['indexable']) + ', no-desc ' + str(cr['no_desc']) + ', long-title ' + str(cr['long_title']))
print('  codes: ' + json.dumps(cr['codes'])[:600])
print('  jsonld across crawl: ' + json.dumps(cr['jsonld_types'])[:300])
for pg in pages:
    print('  PAGE ' + str(pg['url']) + ' | ' + str(pg['status']) + ' | ' + str(pg['title'])[:80] + ' | words ' + str(pg['words']) + ' | desc ' + str(pg['desc_len']) + ' | ld ' + str(pg['jsonld_types']) + ' | flags ' + str(pg['jsonld_flags'])[:120])
    print('       tel ' + str(pg['tel_hrefs']) + ' text ' + str(pg['phones_text']) + ' | credits ' + str(pg['credits']) + ' | robots ' + str(pg['robots_meta']))
p0 = pages[0] if pages else {}
print('  socials: ' + str(p0.get('socials')))
print('  tags: ' + json.dumps(p0.get('tags'))[:300] + ' | gtm: ' + json.dumps(p0.get('gtm'))[:500])
print('  disclosures(home): ' + json.dumps(p0.get('disclosures'))[:500])
print('  AI bots in robots.txt: ' + json.dumps(p0.get('robots_ai')))
print('  schema top: ' + json.dumps(F['schema'])[:700])
for r in F['render']:
    print('  RENDER ' + json.dumps(r)[:330])
for r in F['probe']:
    print('  PROBE ' + json.dumps({k: r[k] for k in ('banner', 'pre_consent', 'chat', 'ai_agents', 'prechecked', 'scarcity', 'timers', 'requests')})[:500])
    print('        hosts ' + ', '.join((r.get('hosts') or [])[:40])[:600])
for r in F['demand']:
    print('  DEMAND ' + ('BRAND ' if r['brand_in_list'] else '- ') + r['seed'] + ': ' + '; '.join(r['top'][:8])[:230])
