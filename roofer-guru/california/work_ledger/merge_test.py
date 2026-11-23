"""Test only: the atlas data with the hazard job's final files merged the way HAZARD_SCHEMA.md suggests (hz, ts, pts)."""
import json, os, sys
CA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(CA, 'data/out/ca_atlas_data.json')))
H = os.path.join(CA, 'data/hazard/out')
d['hz'] = json.load(open(os.path.join(H, 'hazard_events.json')))
ts = json.load(open(os.path.join(H, 'hazard_ts.json')))
for k, v in ts.items():
    if k not in ('fema_year', 'replace_hist', 'ppi', 'permits', 'agehist'):
        d['ts'][k] = v
p = json.load(open(os.path.join(H, 'hazard_pts.json')))
d['pts'] = p['pts']; d['ptflags'] = p['ptflags']; d['ptkinds'] = p.get('ptkinds')
json.dump(d, open(os.path.join(CA, 'work_ledger/out/ca_data_merged.json'), 'w'), separators=(',', ':'))
hz = d['hz']
print('hz keys', list(hz.keys()))
print('fires', len(hz['fires']), 'with d', sum(1 for f in hz['fires'] if f.get('d')), hz['fires'][-1].keys())
print('zfire', len(hz['zfire']), 'ar', len(hz['ar']), 'ar_big', len(hz['ar_big']), 'wind', len(hz['wind']), 'zones', len(hz['zones']), 'roof', list(hz['roof'].keys()), 'fhsz', hz['fhsz'])
print('ts', {k: (len(v) if hasattr(v, '__len__') else v) for k, v in d['ts'].items()}); print('month kinds', list(d['ts']['month'].keys()))
print('pts', len(d['pts']), d['ptflags'], d['ptkinds'], d['pts'][0], p.get('order'))
print('nz', len(d['zrows']), 'max zi', max(r[10] for r in d['pts']), 'max pi', max(r[9] for r in d['pts']))
print(hz['ar_big'][0]); print(hz['wind'][0]); print(hz['ar_pts'][0]); print(hz.get('geo'), {k: d['geo'][k] for k in ('W','H','minx','maxy','kx','sx')})
for z in ('95969', '90272', '91001', '96150'):
    print(z, [(hz['fires'][a[0]]['name'], hz['fires'][a[0]]['year'], a[1:]) for a in hz['zfire'].get(z, [])][:4])
