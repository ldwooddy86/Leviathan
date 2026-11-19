#!/usr/bin/env python3
"""Filter the OurAirports CSVs to California and join runways. usage: airports_ca.py <rawdir> <outdir>"""
import sys, csv, json, collections
RAW,OUT=sys.argv[1],sys.argv[2]
A=[r for r in csv.DictReader(open(f'{RAW}/airports.csv',encoding='utf-8')) if r['iso_region']=='US-CA']
ids={r['id'] for r in A}; byid={r['id']:r for r in A}
R=[r for r in csv.DictReader(open(f'{RAW}/runways.csv',encoding='utf-8')) if r['airport_ref'] in ids]
print('California airports',len(A),collections.Counter(r['type'] for r in A).most_common())
print('California runway rows',len(R),'| closed',sum(1 for r in R if r['closed']=='1'))
def num(v):
    try: return float(v)
    except Exception: return None
ends=sum(1 for r in R if num(r['le_latitude_deg']) is not None and num(r['he_latitude_deg']) is not None)
print('runways with both ends located',ends,'| with length',sum(1 for r in R if num(r['length_ft'])),'| with width',sum(1 for r in R if num(r['width_ft'])),'| with surface',sum(1 for r in R if r['surface']),'| with both end elevations',sum(1 for r in R if num(r['le_elevation_ft']) is not None and num(r['he_elevation_ft']) is not None),'| with headings',sum(1 for r in R if num(r['le_heading_degT']) is not None))
fixed=[r for r in A if r['type'] in ('large_airport','medium_airport','small_airport')]
fr=[r for r in R if byid[r['airport_ref']]['type'] in ('large_airport','medium_airport','small_airport') and r['closed']!='1']
print('open runways at fixed-wing airports',len(fr),'| both ends located',sum(1 for r in fr if num(r['le_latitude_deg']) is not None and num(r['he_latitude_deg']) is not None))
print('surfaces',collections.Counter(r['surface'].upper() for r in fr).most_common(12))
w=csv.DictWriter(open(f'{OUT}/ca_airports.csv','w',newline='',encoding='utf-8'),fieldnames=list(A[0].keys())); w.writeheader(); w.writerows(A)
w=csv.DictWriter(open(f'{OUT}/ca_runways.csv','w',newline='',encoding='utf-8'),fieldnames=list(R[0].keys())); w.writeheader(); w.writerows(R)
rw=collections.defaultdict(list)
for r in R: rw[r['airport_ref']].append(r)
out=[]
for a in A:
    if a['type'] in ('heliport','closed','seaplane_base','balloonport') and not rw.get(a['id']): pass
    o={'ident':a['ident'],'icao':a['icao_code'],'iata':a['iata_code'],'faa':a['local_code'],'gps':a['gps_code'],'name':a['name'],'type':a['type'],'lat':num(a['latitude_deg']),'lon':num(a['longitude_deg']),'elev_ft':num(a['elevation_ft']),'city':a['municipality'],'sched':a['scheduled_service'],
       'runways':[{'len_ft':num(r['length_ft']),'wid_ft':num(r['width_ft']),'surface':r['surface'],'lighted':r['lighted']=='1','closed':r['closed']=='1',
                   'le':{'id':r['le_ident'],'lat':num(r['le_latitude_deg']),'lon':num(r['le_longitude_deg']),'elev_ft':num(r['le_elevation_ft']),'hdg':num(r['le_heading_degT']),'displ_ft':num(r['le_displaced_threshold_ft'])},
                   'he':{'id':r['he_ident'],'lat':num(r['he_latitude_deg']),'lon':num(r['he_longitude_deg']),'elev_ft':num(r['he_elevation_ft']),'hdg':num(r['he_heading_degT']),'displ_ft':num(r['he_displaced_threshold_ft'])}} for r in rw.get(a['id'],[])]}
    out.append(o)
json.dump(out,open(f'{OUT}/ca_airports_runways.json','w'),separators=(',',':'))
import os; print('wrote ca_airports.csv',os.path.getsize(f'{OUT}/ca_airports.csv'),'B; ca_runways.csv',os.path.getsize(f'{OUT}/ca_runways.csv'),'B; ca_airports_runways.json',os.path.getsize(f'{OUT}/ca_airports_runways.json'),'B')
want=[('KLAX','Los Angeles Intl'),('KSFO','San Francisco Intl'),('KSAN','San Diego Intl'),('KNZY','NAS North Island'),('KOAK','Oakland'),('KSJC','San Jose'),('KSMF','Sacramento Intl'),('KBUR','Burbank'),('KLGB','Long Beach'),('KSNA','John Wayne'),('KONT','Ontario'),('KPSP','Palm Springs'),('KFAT','Fresno Yosemite'),('KNKX','MCAS Miramar'),('KNLC','NAS Lemoore')]
byident={o['ident']:o for o in out}
note=[]
for ident,label in want:
    o=byident.get(ident)
    if not o: print(ident,label,'NOT FOUND'); continue
    print(f"\n{ident} {o['iata'] or '-':3s} {o['name']} | {o['type']} | {o['lat']:.5f},{o['lon']:.5f} | elev {o['elev_ft']} ft | {len(o['runways'])} runways")
    for r in o['runways']:
        print(f"   {r['le']['id']:>3s}/{r['he']['id']:<3s} {r['len_ft']:.0f} x {r['wid_ft']:.0f} ft {r['surface']:8s} lighted {r['lighted']} closed {r['closed']} | {r['le']['id']} {r['le']['lat']},{r['le']['lon']} {r['le']['elev_ft']} ft hdg {r['le']['hdg']} | {r['he']['id']} {r['he']['lat']},{r['he']['lon']} {r['he']['elev_ft']} ft hdg {r['he']['hdg']}")
    note.append(o)
json.dump(note,open(f'{OUT}/ca_15_named_airports.json','w'),indent=1)
