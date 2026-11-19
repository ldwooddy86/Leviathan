import csv,gzip,sys,collections,re
fn=sys.argv[1]
rows=list(csv.DictReader(gzip.open(fn,'rt',encoding='utf-8',errors='ignore')))
print('rows',len(rows)); print('cols',list(rows[0].keys())[:60])
yrs=[int(r['YEAR']) for r in rows if r.get('YEAR','').isdigit()]
print('years',min(yrs),max(yrs))
def dmg(s):
    s=(s or '').strip().upper()
    if not s: return 0.0
    m=re.match(r'^([0-9.]+)([KMBH]?)$',s)
    if not m: return 0.0
    v=float(m.group(1) or 0); return v*{'K':1e3,'M':1e6,'B':1e9,'H':1e2,'':1}[m.group(2)]
def mag(r):
    try: return float(r['MAGNITUDE'])
    except: return None
hail=[r for r in rows if r['EVENT_TYPE']=='Hail']
print('\nHAIL reports:',len(hail))
hm=[(mag(r),r) for r in hail if mag(r) is not None]
for th in (0.75,1.0,1.5,1.75,2.0,2.5,2.75,3.0):
    print(f'  size >= {th}: {sum(1 for m,_ in hm if m>=th)}')
dec=collections.Counter(); dec1=collections.Counter()
for m,r in hm:
    d=int(r['YEAR'])//10*10; dec[d]+=1
    if m>=1.0: dec1[d]+=1
print('  by decade all / >=1in:',[(d,dec[d],dec1[d]) for d in sorted(dec)])
print('  largest:')
for m,r in sorted(hm,key=lambda x:-x[0])[:12]:
    print('   ',m,r['BEGIN_DATE_TIME'],r['CZ_NAME'],'| dmg',r['DAMAGE_PROPERTY'],'|',(r.get('EVENT_NARRATIVE') or '')[:160].replace('\n',' '))
print('  hail property damage total reported: $',round(sum(dmg(r['DAMAGE_PROPERTY']) for r in hail)))
cz=collections.Counter(r['CZ_NAME'] for m,r in hm if m>=1.0)
print('  counties with most >=1in hail reports:',cz.most_common(10))
# unique hail days >=1in
days=set((r['BEGIN_YEARMONTH'],r['BEGIN_DAY']) for m,r in hm if m>=1.0 and int(r['YEAR'])>=1996)
print('  days with >=1in hail 1996-:',len(days),'over',max(yrs)-1996+1,'years')
for et in ['High Wind','Strong Wind','Thunderstorm Wind','Tornado','Heavy Snow','Winter Storm','Blizzard','Heavy Rain','Flood','Flash Flood','Debris Flow','Wildfire','Excessive Heat','Heat']:
    ev=[r for r in rows if r['EVENT_TYPE']==et]
    y=[int(r['YEAR']) for r in ev]
    print(f'\n{et}: n={len(ev)} years {min(y) if y else None}-{max(y) if y else None}; reported property damage total ${sum(dmg(r["DAMAGE_PROPERTY"]) for r in ev):,.0f}')
hw=[(mag(r),r) for r in rows if r['EVENT_TYPE'] in('High Wind','Thunderstorm Wind','Strong Wind') and mag(r) is not None]
print('\nTop wind magnitudes (knots):')
for m,r in sorted(hw,key=lambda x:-x[0])[:10]:
    print('   ',m,'kt =',round(m*1.15078),'mph',r['EVENT_TYPE'],r['BEGIN_DATE_TIME'],r['CZ_NAME'],r.get('MAGNITUDE_TYPE'))
print('\nHigh-wind events with largest property damage:')
ev=[r for r in rows if r['EVENT_TYPE'] in('High Wind','Strong Wind','Thunderstorm Wind')]
for r in sorted(ev,key=lambda r:-dmg(r['DAMAGE_PROPERTY']))[:12]:
    print('   $%s'%r['DAMAGE_PROPERTY'],r['EVENT_TYPE'],r['BEGIN_DATE_TIME'],r['CZ_NAME'],'mag',r['MAGNITUDE'],'|',(r.get('EVENT_NARRATIVE') or r.get('EPISODE_NARRATIVE') or '')[:200].replace('\n',' '))
