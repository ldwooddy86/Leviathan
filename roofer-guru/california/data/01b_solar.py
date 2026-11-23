#!/usr/bin/env python3
"""Step 1b. Rooftop solar by ZIP.
Source 1: California Distributed Generation Statistics, Interconnection Applications Dataset of 2026-09-30
(PG&E, SCE, SDG&E only): interconnected, not decommissioned, residential photovoltaic sites, distinct Location ID.
Source 2: Google Project Sunroof postal code file (existing_installs_count, all utilities, imagery of about 2017 to 2021).
Writes work/solar.json {zip: [nem_sites, sunroof_installs, nem_since_2020, nem_storage_sites]}
Usage: python3 -I 01b_solar.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import zipfile, io, collections

zp = os.path.join(MYDL, 'solar', 'nem_apps.zip')
sites = collections.defaultdict(set)
recent = collections.Counter()
stor = collections.defaultdict(set)
tot = collections.Counter()
if os.path.exists(zp):
    with zipfile.ZipFile(zp) as zf:
        for nm in zf.namelist():
            with zf.open(nm) as fh:
                rdr = csv.reader(io.TextIOWrapper(fh, encoding='utf-8', errors='replace', newline=''))
                hd = next(rdr)
                ix = {h: i for i, h in enumerate(hd)}
                a, b, c, d, e, f_, g_, h_ = (ix['Application Status'], ix['Technology Type'], ix['Customer Sector'], ix['Service Zip'],
                                             ix.get('Location ID', ix['Application Id']), ix['Decommissioned Date'], ix['App Approved Date'],
                                             ix['Storage Capacity (kWh)'])
                sup = ix['Superceding Id']
                n = 0
                for r in rdr:
                    n += 1
                    if len(r) <= h_:
                        continue
                    if r[a] != 'Interconnected' or 'Photovoltaic' not in r[b] or r[c] != 'Residential' or r[f_] or r[sup]:
                        continue
                    z = r[d][:5]
                    loc = r[e] or ('x%s%d' % (nm[:3], n))
                    if loc not in sites[z]:
                        sites[z].add(loc)
                        if r[g_][:4] >= '2020':
                            recent[z] += 1
                    if r[h_] not in ('', '0', '0.0'):
                        stor[z].add(loc)
                tot[nm] = n
                print(nm, n, sum(len(v) for v in sites.values()), flush=True)
sun = {}
sp = os.path.join(MYDL, 'solar', 'sunroof_zip.csv')
if os.path.exists(sp):
    for row in rd(sp):
        if row['state_name'] == 'California':
            sun[row['region_name'].zfill(5)] = int(n0(row['existing_installs_count']))
out = {}
for z in set(sites) | set(sun):
    out[z] = [len(sites.get(z, ())), sun.get(z), recent.get(z, 0), len(stor.get(z, ()))]
print('zips', len(out), 'nem sites', sum(v[0] for v in out.values()), 'sunroof installs', sum(v[1] or 0 for v in out.values()))
save('solar.json', {'by_zip': out, 'rows_read': dict(tot)})
