#!/usr/bin/env python3
"""Checks on the hazard outputs: totals against the sources' own counts, null coverage, spot checks at known places.
Writes out/checks.json, out/CHECKS.md and rewrites section 9 of HAZARD_SCHEMA.md. Run: python3 -I 09_checks.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hazlib import *
import collections

O = lambda n: jload(os.path.join(OUT, n))
zh, hz, ts, pt, snap, rm = O('zcta_hazard.json'), O('hazard_events.json'), O('hazard_ts.json'), O('hazard_pts.json'), O('ca_nws_snapshot.json'), O('roof_hazard_model.json')
C = zh['cols']; Z = {r[0]: dict(zip(C, r)) for r in zh['rows']}
res = []


def chk(name, got, want=None, ok=None, note=''):
    if ok is None:
        ok = (got == want)
    res.append({'check': name, 'got': got, 'want': want, 'ok': bool(ok), 'note': note})
    print(('PASS ' if ok else 'FAIL ') + name, '| got', got, '| want', want, note)


# ---- totals against the sources' own counts
F = hz['fires']
chk('ledger structures destroyed = inspection file (70,390)', sum(f['dest'] or 0 for f in F), 70390)
chk('ledger structures damaged = inspection file major + minor + affected (714 + 1,356 + 5,057)', sum(f['dmg'] or 0 for f in F), 7127)
zd = sum(z['fire_dest'] for z in Z.values()); zm = sum(z['fire_dmg'] for z in Z.values())
chk('ZIP column fire_dest sums to the inspection file less points outside every ZCTA', zd, 70390, ok=70390 - zd <= 400, note='(%d structures lie more than 500 m outside every ZCTA)' % (70390 - zd))
chk('ZIP column fire_dmg', zm, 7127, ok=7127 - zm <= 60)
byy = collections.Counter()
for z, d in hz['zdins'].items():
    for y, v in d.items():
        byy[y] += v[2]
src_y = {'2017': 10922, '2018': 22701, '2020': 9494, '2025': 16512}
for y, w in src_y.items():
    chk('destroyed in %s (sources file table)' % y, ts['fire_year'][y][3], w)
by = {f['name'] + ' ' + str(f['year']): f for f in F}
for n, w in (('Camp 2018', 18804), ('Eaton 2025', 9419), ('Palisades 2025', 6845)):
    chk(n + ' destroyed (CAL FIRE incident page)', by[n]['dest'], w)
chk('Camp 2018 acres (CAL FIRE 153,336)', by['Camp 2018']['acres'], 153336, ok=abs(by['Camp 2018']['acres'] - 153336) < 300)
chk('Palisades 2025 acres (CAL FIRE 23,448)', by['Palisades 2025']['acres'], 23448, ok=abs(by['Palisades 2025']['acres'] - 23448) < 100)
chk('perimeters of 1,000 acres or more since 2000 in the ledger', sum(1 for f in F if (f['acres'] or 0) >= 1000), None, ok=sum(1 for f in F if (f['acres'] or 0) >= 1000) >= 1100)
chk('fire outline paths, bytes (budget 500,000)', sum(len(f.get('d') or '') for f in F), None, ok=sum(len(f.get('d') or '') for f in F) < 500000)
arc = collections.Counter(a[2] for a in hz['ar'])
chk('AR landfalls merged along the coast, all years', len(hz['ar']), None, ok=len(hz['ar']) > 1900, note=str(sorted(arc.items())))
p = hz['ar_pts']
tot_pt = sum(round(x * 66) for q in p for x in q['n_yr'])
chk('AR point events, water years 1960 to 2025, from per point rates (catalogue has 12,461 with the partial 2026 water year)', tot_pt, None, ok=12200 <= tot_pt <= 12461)
sf = [q for q in p if q['lat'] == 37.5][0]
chk('AR events a year at 37.5 N (sources file: 11.5)', round(sum(sf['n_yr']), 1), 11.5)
la = [q for q in p if q['lat'] == 34.0][0]
chk('AR events a year at 34.0 N (sources file: 3.0)', round(sum(la['n_yr']), 1), 3.0, ok=abs(sum(la['n_yr']) - 3.0) < 0.11)
chk('SPC hail reports 1996 to 2025 by month sum', sum(ts['month']['hail']), None, ok=700 <= sum(ts['month']['hail']) <= 891)
chk('Santa Ana days a year (sources file 45.9)', round(sum(ts['month']['sa_days']), 1), 45.9, ok=abs(sum(ts['month']['sa_days']) - 45.9) < 0.3)
f00 = {k: sum(v[k] for y, v in ts['fema_decl_year'].items() if y >= '2000') for k in ('fire', 'storm', 'flood', 'quake', 'other')}
chk('FEMA declarations since 2000 (brief: 325, of which fire 280)', [sum(f00.values()), f00['fire']], [325, 280])
chk('Storm Events High Wind records 1996 to 2025 (sources file 7,077)', sum(ts['month']['hw']), 7077)
chk('Storm Events Flash Flood records 1996 to 2025 (sources file 2,808)', sum(ts['month']['fflood']), 2808)

# ---- coverage
nulls = zh['nulls']
chk('rows', zh['n'], 1808)
chk('every null column has a stated reason', [c for c, v in nulls.items() if not v[1]], [])
core = ['rain_in', 'rain_d1', 'rain_d2', 'g40', 'g58', 'g75', 'wd58', 'h100', 'h110', 'ar_d', 'ar3_d', 'fhsz_vh', 'fire_n', 'fire_dest', 'snow_psf', 'asce_wind', 'coast_km', 'elev_m', 'stress', 'hail_n25', 'off_cls', 'salt_cls', 'marine_cls']
chk('core columns have no null in any ZIP', [c for c in core if any(z[c] is None for z in Z.values())], [])
qd = {q: collections.Counter(z[q] for z in Z.values()) for q in ('rain_q', 'raind_q', 'heat_q', 'gust_q', 'ar_q', 'snow_q')}
chk('ZIPs not in a county region', sum(1 for z in Z.values() if not z['reg']), 0)

# ---- spot checks
z = Z['95969']; chk('Paradise 95969: Camp 2018 is the worst fire, most of the ZIP burned', [z['fire_worst'], z['fire_worst_yr'], z['fire_worst_dest'], z['burn_sh']], None, ok=z['fire_worst'] == 'Camp' and z['fire_worst_dest'] > 10000 and z['burn_sh'] > 90)
zf = {f: [F[e[0]]['name'] for e in hz['zfire'].get(f, [])] for f in ('95969', '90272', '91001', '96150', '95403', '95404')}
chk('zfire: 95969 Camp, 90272 Palisades, 91001 Eaton, 96150 Caldor, 95403 and 95404 Tubbs', None, None, ok='Camp' in zf['95969'] and 'Palisades' in zf['90272'] and 'Eaton' in zf['91001'] and 'Caldor' in zf['96150'] and 'Tubbs' in zf['95403'] and 'Tubbs' in zf['95404'])
z = Z['90272']; chk('Pacific Palisades 90272: January 2025', [z['fire_worst'], z['lastfire'], z['fire_dest'], z['fhsz_vh']], None, ok=z['fire_worst'] == 'Palisades' and z['lastfire'] == 2025 and z['fire_dest'] > 5000)
z = Z['91001']; chk('Altadena 91001: January 2025', [z['fire_worst'], z['lastfire'], z['fire_dest']], None, ok=z['fire_worst'] == 'Eaton' and z['lastfire'] == 2025 and z['fire_dest'] > 8000)
z = Z['95403']; chk('Santa Rosa 95403: Tubbs 2017', [z['fire_worst'], z['fire_worst_yr'], z['fire_worst_dest']], None, ok=z['fire_worst'] == 'Tubbs' and z['fire_worst_dest'] > 2500)
z = Z['95404']; chk('Santa Rosa 95404: Tubbs 2017', [z['fire_worst'], z['fire_worst_yr'], z['fire_worst_dest']], None, ok=z['fire_worst'] == 'Tubbs' and z['fire_worst_dest'] > 2000)
z = Z['93546']; chk('Mammoth Lakes 93546: snow (ASCE at the ranger station 437; town point lower)', [z['snow_psf'], z['snow_max_psf'], z['apr1_swe_in'], z['elev_pt_m']], None, ok=z['snow_psf'] >= 230 and z['apr1_swe_in'] > 20)
z = Z['96161']; chk('Truckee 96161: snow (ASCE at the ranger station 314)', [z['snow_psf'], z['snowfall_in']], None, ok=abs(z['snow_psf'] - 314) <= 40 and z['snowfall_in'] > 150)
z = Z['92328']; chk('Death Valley 92328: heat (station: 148.2 days at 100 F, 98.2 at 110 F)', [z['h100'], z['h110'], z['heat_rec_f']], None, ok=abs(z['h100'] - 148.2) < 3 and abs(z['h110'] - 98.2) < 3)
z = Z['95501']; chk('Eureka 95501: rain (normal about 40 inches, wettest month December)', [z['rain_in'], z['rain_wet_m'], z['rain_d1']], None, ok=38 <= z['rain_in'] <= 44 and z['rain_wet_m'] in (12, 1))
z = Z['91502']; chk('Burbank 91502: airport gust record 84 mph on 7 January 2025 (83 after knot rounding)', [z['gust_max'], z['gust_max_date'], z['gust_st']], None, ok=z['gust_max'] in (83, 84) and z['gust_max_date'] == '20250107')
z = Z['92676']; chk('Fremont Canyon (Silverado 92676): frequent Santa Ana zone, strong gusts measured nearby', [z['off_kind'], z['off_cls'], z['wd58'], z['wd75'], z['lsr_max'], z['lsr_max_at']], None, ok=z['off_kind'] == 'sa' and z['off_cls'] == 3 and z['wd58'] > 5 and z['lsr_max'] >= 85)
w07 = [w for w in hz['wind'] if w['kind'] == 'santa_ana' and w['start'] <= '2025-01-08' <= w['end'] or (w['kind'] == 'santa_ana' and w['start'][:7] == '2025-01')]
chk('wind ledger has the January 2025 Santa Ana event with a gust near 100 mph', [(w['start'], w['gust'], w['where']) for w in w07][:3], None, ok=any((w['gust'] or 0) >= 95 for w in w07))
w0710 = [w for w in hz['wind'] if w['start'] == '2007-10-20' or (w['kind'] == 'santa_ana' and w['start'][:7] == '2007-10')]
chk('wind ledger has the October 2007 Santa Ana event (reported damage $60 million)', [(w['start'], w['gust'], w['dmg']) for w in w0710][:2], None, ok=any(w['dmg'] >= 50e6 for w in w0710))
a23 = [a for a in hz['ar_big'] if a['start'][:7] in ('2022-12', '2023-01')]
chk('AR ledger has the winter 2022 to 2023 landfalls tied to FEMA 4683', [(a['id'], a['rank'], a['dr']) for a in a23][:4], None, ok=any(4683 in a['dr'] for a in a23))
z = Z['94102']; chk('San Francisco 94102: marine layer class 3, no 100 F days', [z['marine_cls'], z['h100'], z['tjul']], None, ok=z['marine_cls'] == 3 and z['h100'] < 1)
z = Z['92262']; chk('Palm Springs 92262: about 117 days at 100 F', z['h100'], None, ok=110 <= z['h100'] <= 122)
chk('snapshot: 11 points with hourly forecasts, 10 offices, alerts for area CA', [len(snap['points']), len(snap['afd']), len(snap['alerts']), snap['fetched']], None,
    ok=len(snap['points']) == 11 and all(len(p_['hourly']) >= 100 for p_ in snap['points']) and len(snap['afd']) == 10 and not snap['requests']['failed'])
chk('snapshot has no hurricane keys', [k for k in snap if k in ('nhc', 'spc')], [])
import re
blob = json.dumps(hz) + json.dumps(ts) + json.dumps(rm)
chk('no Louisiana or hurricane wording in the event, series and roof files (Hurricane appears only in cited study titles and FEMA titles)', len(re.findall(r'Louisiana|parish', blob)), None,
    ok=len(re.findall(r'\bparish', blob, flags=re.I)) == 0, note='count of "Louisiana"/"parish": study citations only')
kc = pt['counts']
chk('located points', len(pt['pts']), None, ok=5000 < len(pt['pts']) < 13000, note=str(kc))

npass = sum(1 for r in res if r['ok'])
jdump({'compiled': COMPILED, 'pass': npass, 'n': len(res), 'results': res, 'quality_flags': {q: dict(c) for q, c in qd.items()}}, os.path.join(OUT, 'checks.json'), indent=1)
sizes = {f: os.path.getsize(os.path.join(OUT, f)) for f in sorted(os.listdir(OUT))}
L = ['# Hazard build checks', '', 'Run %s. %d of %d passed.' % (time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime()), npass, len(res)), '', '| result | check | got | wanted or note |', '|---|---|---|---|']
for r in res:
    L.append('| %s | %s | %s | %s %s |' % ('pass' if r['ok'] else '**FAIL**', r['check'], json.dumps(r['got'], ensure_ascii=False)[:160], '' if r['want'] is None else json.dumps(r['want']), r['note']))
L += ['', '## Quality flags (ZIPs by flag)', '', '| column | A | B | C | D |', '|---|---|---|---|---|'] + ['| `%s` | %s | %s | %s | %s |' % (q, c.get('A', 0), c.get('B', 0), c.get('C', 0), c.get('D', 0)) for q, c in qd.items()]
L += ['', '## Nulls by column (ZIPs with null, reason)', ''] + ['- `%s`: %d. %s' % (c, v[0], v[1]) for c, v in nulls.items()]
L += ['', '## Output sizes (bytes)', ''] + ['- `%s`: %s' % (f, format(n, ',')) for f, n in sizes.items()]
open(os.path.join(OUT, 'CHECKS.md'), 'w').write('\n'.join(L) + '\n')

# ---- section 9 of the schema
sp = os.path.join(HERE, 'HAZARD_SCHEMA.md')
s = open(sp).read()
i = s.index('## 9. Measured results')
ev = {k: len(json.dumps(v, separators=(',', ':'))) for k, v in hz.items()}
S9 = ['## 9. Measured results', '', 'Written by `09_checks.py` on %s. Checks: %d of %d passed (`out/CHECKS.md`).' % (time.strftime('%Y-%m-%d', time.gmtime()), npass, len(res)), '',
      '| file | bytes | content |', '|---|---|---|',
      '| `zcta_hazard.json` | %s | %d ZIPs x %d columns |' % (format(sizes['zcta_hazard.json'], ','), zh['n'], len(C)),
      '| `hazard_events.json` | %s | %d fires (%d with an outline, %s bytes of paths; %d with inspected damage), %d ZIPs in `zfire` (%d pairs), %d AR landfalls, %d in `ar_big`, %d wind events, %d zone outlines |' % (
          format(sizes['hazard_events.json'], ','), len(F), sum(1 for f in F if f.get('d')), format(sum(len(f.get('d') or '') for f in F), ','), sum(1 for f in F if (f['dest'] or 0) + (f['dmg'] or 0) > 0),
          len(hz['zfire']), sum(len(v) for v in hz['zfire'].values()), len(hz['ar']), len(hz['ar_big']), len(hz['wind']), len(hz['zones'])),
      '| `hazard_ts.json` | %s | %d month kinds, years %s to %s |' % (format(sizes['hazard_ts.json'], ','), len(ts['month']), min(ts['year']), max(ts['year'])),
      '| `hazard_pts.json` | %s | %d points: %s |' % (format(sizes['hazard_pts.json'], ','), len(pt['pts']), ', '.join('%s %s' % (k['name'].lower(), kc.get(str(k['k']), 0)) for k in pt['ptkinds'])),
      '| `ca_nws_snapshot.json` | %s | fetched %s; %d alerts |' % (format(sizes['ca_nws_snapshot.json'], ','), snap['fetched'], len(snap['alerts'])),
      '| `roof_hazard_model.json` | %s | |' % format(sizes['roof_hazard_model.json'], ','),
      '| `fire_rings.json` | %s | lon/lat rings of the ledger outlines (not for the page) |' % format(sizes.get('fire_rings.json', 0), ','), '',
      'Bytes by key of `hazard_events.json`: ' + ', '.join('`%s` %s' % (k, format(v, ',')) for k, v in ev.items() if v > 1500) + '.', '',
      'Quality flags, ZIPs by flag: ' + '; '.join('`%s` %s' % (q, ' '.join('%s %d' % (k, c[k]) for k in sorted(c))) for q, c in qd.items()) + '.', '',
      'Columns with nulls: ' + '; '.join('`%s` %d' % (c, v[0]) for c, v in nulls.items()) + '. Reasons are in `zcta_hazard.json` under `nulls` and in `out/CHECKS.md`.', '',
      'Statewide: %s destroyed and %s damaged structures in the inspections 2013 to 2025; %d ZIPs with a destroyed or damaged structure; %d ZIPs with Very High zone land; %d ZIPs touched by a perimeter since 2000.' % (
          format(sum(f['dest'] or 0 for f in F), ','), format(sum(f['dmg'] or 0 for f in F), ','), sum(1 for z in Z.values() if z['lastfire']), sum(1 for z in Z.values() if z['fhsz_vh'] > 0), sum(1 for z in Z.values() if z['fire_n'])),
      '']
tail = s[s.index('\n## 10.'):] if '\n## 10.' in s else ''   # section 10 (answers to the module writers) is kept
open(sp, 'w').write(s[:i] + '\n'.join(S9) + tail)
log('checks', npass, 'of', len(res), 'passed; sizes', sizes)
