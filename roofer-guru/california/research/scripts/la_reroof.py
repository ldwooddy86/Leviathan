import csv,sys,re,collections,statistics as st
rows=list(csv.DictReader(open(sys.argv[1],newline='',encoding='utf-8',errors='ignore')))
print('rows',len(rows))
def num(s):
    try: return float(str(s).replace(',',''))
    except: return None
tmpl=collections.Counter()
for r in rows:
    d=r['work_desc']; d=re.sub(r'\(?\s*[\d,.]+\s*\)?\s*(?=[Ss]quares)','N ',d); tmpl[d[:150]]+=1
print('top description templates:')
for k,v in tmpl.most_common(8): print('  ',v,'|',k)
def sq(d):
    m=re.search(r'\(?\s*([\d,]+(?:\.\d+)?)\s*\)?\s*[Ss]quares',d)
    return num(m.group(1)) if m else None
def kind(d):
    u=d.upper()
    if 'LESS THAN 6 POUNDS' in u or 'LESS THAN 6 LBS' in u: return 'light (<6 psf: shingles, membranes)'
    if '6 POUNDS OR MORE' in u or 'MORE THAN 6' in u or 'TILE' in u: return 'heavy/tile (>=6 psf or tile mentioned)'
    return 'other/unspecified'
out=[]
for r in rows:
    y=r['issue_date'][:4]; v=num(r['valuation']); s=sq(r['work_desc'])
    out.append((y,r['permit_sub_type'],kind(r['work_desc']),v,s,r['zip_code'],r['work_desc']))
by=collections.Counter((y,t) for y,t,k,v,s,z,d in out); 
print('\npermits by year and sub-type:')
for (y,t),n in sorted(by.items()): 
    if n>300: print('  ',y,t,n)
print('\nkind counts:',collections.Counter(k for y,t,k,v,s,z,d in out))
def summ(sel,label):
    vals=[v for y,t,k,v,s,z,d in sel if v and v>0]
    sqs=[s for y,t,k,v,s,z,d in sel if s and 1<=s<=500]
    per=[v/s for y,t,k,v,s,z,d in sel if v and s and v>0 and 5<=s<=200]
    if len(vals)<30: return
    q=lambda a,p: sorted(a)[int(p*(len(a)-1))]
    print(f'  {label}: n={len(sel)} | valuation median ${st.median(vals):,.0f} (p25 ${q(vals,.25):,.0f}, p75 ${q(vals,.75):,.0f}) | squares median {st.median(sqs) if sqs else None} (n={len(sqs)}) | $ per square median ${st.median(per):,.0f} (p25 ${q(per,.25):,.0f}, p75 ${q(per,.75):,.0f}, n={len(per)})')
print('\n1 or 2 Family Dwelling, by year, all kinds:')
for y in ['2023','2024','2025','2026']:
    summ([o for o in out if o[0]==y and o[1]=='1 or 2 Family Dwelling'],y)
print('\n1 or 2 Family Dwelling by kind (2025-2026):')
for k in set(o[2] for o in out):
    summ([o for o in out if o[0] in('2025','2026') and o[1]=='1 or 2 Family Dwelling' and o[2]==k],k)
print('\nApartment (2025-2026):'); summ([o for o in out if o[0] in('2025','2026') and o[1]=='Apartment'],'Apartment')
print('Commercial (2025-2026):'); summ([o for o in out if o[0] in('2025','2026') and o[1]=='Commercial'],'Commercial')
# monthly counts 2022-2026 for seasonality
mon=collections.Counter(r['issue_date'][:7] for r in rows)
print('\nmonthly permits:',' '.join(f'{k}:{v}' for k,v in sorted(mon.items())))
# tile examples
ex=[d for y,t,k,v,s,z,d in out if 'TILE' in d.upper()][:3]; print('\ntile examples:',[e[:260] for e in ex])
print('tile mentions:',sum(1 for o in out if 'TILE' in o[6].upper()),'solar mention:',sum(1 for o in out if 'SOLAR' in o[6].upper()))
