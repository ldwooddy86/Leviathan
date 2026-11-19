#!/usr/bin/env python3
"""Where the bytes of a saved Overpass answer go, and what a leaner query would return. usage: overpass_bytes.py <file.json>"""
import sys, json, gzip, collections
j=json.load(open(sys.argv[1])); els=j['elements']
def cat(e):
    t=e.get('tags') or {}
    if e['type']=='relation': return 'relation: '+str(t.get('route') or t.get('aeroway') or t.get('type'))
    if e['type']=='node': return 'node: '+str(t.get('highway') or t.get('railway') or t.get('aeroway'))
    h=t.get('highway')
    if h:
        if h in ('footway','path','steps','pedestrian','cycleway','track','bridleway','corridor','elevator','platform'): 
            return 'way: foot/cycle ('+('sidewalk or crossing' if t.get('footway') in ('sidewalk','crossing') else 'other')+')'
        if h=='service': return 'way: service'
        if h in ('motorway','motorway_link'): return 'way: motorway + ramps'
        if h in ('construction','proposed','razed','abandoned'): return 'way: highway '+h
        return 'way: other roads'
    if 'railway' in t: return 'way: railway'
    if 'aeroway' in t: return 'way: aeroway '+t['aeroway']
    if 'man_made' in t: return 'way: man_made '+t['man_made']
    return 'way: other'
B=collections.Counter(); N=collections.Counter()
for e in els:
    c=cat(e); B[c]+=len(json.dumps(e,separators=(',',':'))); N[c]+=1
tot=sum(B.values())
for c,b in B.most_common(): print(f'  {c:42s} {N[c]:6d} elements {b/1e6:7.2f} MB  {100*b/tot:5.1f}%')
print(f'  total (compact JSON) {tot/1e6:.2f} MB')
lean=[e for e in els if not cat(e).startswith('relation: ') and cat(e)!='way: foot/cycle (sidewalk or crossing)']
for label,sel in (('all elements, compact',els),('lean: no route relations, no sidewalk/crossing footways',lean),('roads only (no foot/cycle at all, no relations)',[e for e in lean if not cat(e).startswith('way: foot/cycle')])):
    raw=json.dumps({'elements':sel},separators=(',',':')).encode(); print(f'  {label:58s}: {len(sel):6d} elements, {len(raw)/1e6:5.2f} MB, gzip {len(gzip.compress(raw))/1e3:6.0f} KB')
