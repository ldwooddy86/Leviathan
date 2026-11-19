import csv,gzip,sys,collections,re
rows=list(csv.DictReader(gzip.open(sys.argv[1],'rt',encoding='utf-8',errors='ignore')))
def dmg(s):
    s=(s or '').strip().upper(); m=re.match(r'^([0-9.]+)([KMBH]?)$',s)
    return float(m.group(1))*{'K':1e3,'M':1e6,'B':1e9,'H':1e2,'':1}[m.group(2)] if m else 0.0
def show(sel,title,n=8,w=330):
    sel=list(sel); print(f'\n== {title}: n={len(sel)} total prop dmg ${sum(dmg(r["DAMAGE_PROPERTY"]) for r in sel):,.0f}')
    for r in sorted(sel,key=lambda r:-dmg(r['DAMAGE_PROPERTY']))[:n]:
        print('  ',r['EVENT_TYPE'],r['BEGIN_DATE_TIME'][:9],r['CZ_NAME'][:45],'mag',r['MAGNITUDE'],'dmg',r['DAMAGE_PROPERTY'],'|',((r.get('EVENT_NARRATIVE') or '')+' // '+(r.get('EPISODE_NARRATIVE') or ''))[:w].replace('\n',' '))
ym=lambda r:r['BEGIN_YEARMONTH']
show([r for r in rows if ym(r) in('201111','201112') and r['EVENT_TYPE'] in('High Wind','Strong Wind') and int(r['BEGIN_DAY'])in(30,1,2) and r['WFO'] in('LOX','SGX')],'Santa Ana windstorm 30 Nov-2 Dec 2011 (LOX/SGX)',8,420)
show([r for r in rows if ym(r)=='202501' and r['EVENT_TYPE'] in('High Wind','Strong Wind') and int(r['BEGIN_DAY'])in(7,8) and r['WFO']=='LOX'],'Jan 7-8 2025 high wind LOX',6,300)
sel=[r for r in rows if ym(r)=='202501' and r['EVENT_TYPE']=='High Wind' and int(r['BEGIN_DAY'])in(7,8)]
ms=sorted([(float(r['MAGNITUDE']),r['CZ_NAME']) for r in sel if r['MAGNITUDE']],reverse=True)[:6]; print('  top gusts kt:',ms)
show([r for r in rows if ym(r) in('202302','202303') and r['EVENT_TYPE'] in('Heavy Snow','Winter Storm','Blizzard') and re.search(r'roof|collaps',(r.get('EVENT_NARRATIVE') or '')+(r.get('EPISODE_NARRATIVE') or ''),re.I)],'Feb-Mar 2023 snow events mentioning roof/collapse',10,520)
for lab,yms in [('Dec 2022-Mar 2023',('202212','202301','202302','202303')),('Feb 2024',('202402',))]:
    for et in ('Flood','Flash Flood','Heavy Rain','Debris Flow','High Wind','Strong Wind'):
        s=[r for r in rows if ym(r) in yms and r['EVENT_TYPE']==et]
        print(f'  {lab} {et}: n={len(s)} dmg ${sum(dmg(r["DAMAGE_PROPERTY"]) for r in s):,.0f}')
# roof mentions
cnt=collections.Counter(); tot=collections.Counter()
for r in rows:
    if int(r['YEAR'])>=1996:
        tot[r['EVENT_TYPE']]+=1
        if re.search(r'\broof',(r.get('EVENT_NARRATIVE') or ''),re.I): cnt[r['EVENT_TYPE']]+=1
print('\nEvent narratives 1996-2026 that mention "roof", by event type (n mentioning / n events):')
for k,v in cnt.most_common(12): print('  ',k,v,'/',tot[k])
