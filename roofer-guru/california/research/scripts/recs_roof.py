import csv,sys,collections
fn=sys.argv[1]
ROOF={'1':'Ceramic or clay tiles','2':'Wood shingles/shakes','3':'Metal','4':'Slate or synthetic slate','5':'Shingles (composition or asphalt)','6':'Concrete tiles','99':'Other','-2':'Not applicable (apartment 5+ units)'}
YR={'1':'Before 1950','2':'1950-1959','3':'1960-1969','4':'1970-1979','5':'1980-1989','6':'1990-1999','7':'2000-2009','8':'2010-2015','9':'2016-2020'}
TYPE={'1':'Mobile home','2':'Single-family detached','3':'Single-family attached','4':'Apt 2-4 units','5':'Apt 5+ units'}
rows=[r for r in csv.DictReader(open(fn,newline='',encoding='utf-8',errors='ignore')) if r['state_postal']=='CA']
print('CA sample households:',len(rows),' weighted households:',round(sum(float(r['NWEIGHT']) for r in rows)))
def tab(rows,key,label,lab=None):
    tot=collections.defaultdict(float); n=collections.Counter()
    for r in rows:
        tot[r[key]]+=float(r['NWEIGHT']); n[r[key]]+=1
    T=sum(tot.values())
    print(f'\n== {label}: weighted total {T:,.0f} (n={len(rows)})')
    for k,v in sorted(tot.items(),key=lambda kv:-kv[1]):
        print(f'  {(lab or {}).get(k,k):45s} n={n[k]:4d}  {v:12,.0f}  {100*v/T:5.1f}%')
tab(rows,'TYPEHUQ','CA housing type',TYPE)
app=[r for r in rows if r['ROOFTYPE']!='-2']
tab(app,'ROOFTYPE','CA roof type, all units asked (excludes apartments in 5+ unit buildings)',ROOF)
sf=[r for r in rows if r['TYPEHUQ'] in('2','3')]
tab(sf,'ROOFTYPE','CA roof type, single-family detached + attached',ROOF)
sfd=[r for r in rows if r['TYPEHUQ']=='2']
tab(sfd,'ROOFTYPE','CA roof type, single-family detached only',ROOF)
tab(app,'BA_climate','CA units by Building America climate')
for c in sorted(set(r['BA_climate'] for r in app)):
    tab([r for r in sf if r['BA_climate']==c],'ROOFTYPE',f'CA single-family roof type in BA climate = {c}',ROOF)
for grp,ks in [('Before 1960',('1','2')),('1960-1979',('3','4')),('1980-1999',('5','6')),('2000-2020',('7','8','9'))]:
    tab([r for r in sf if r['YEARMADERANGE'] in ks],'ROOFTYPE',f'CA single-family roof type, built {grp}',ROOF)
# US comparison
allr=[r for r in csv.DictReader(open(fn,newline='',encoding='utf-8',errors='ignore')) if r['TYPEHUQ'] in('2','3')]
tab(allr,'ROOFTYPE','US single-family (detached+attached) roof type',ROOF)
