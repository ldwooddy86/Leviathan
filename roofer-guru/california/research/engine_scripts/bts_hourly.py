import csv, sys, collections, json
p=sys.argv[1]
AP=['LAX','SFO','SAN','BUR','LGB','SNA','ONT','OAK','SJC','SMF']
dep=collections.defaultdict(lambda: [0]*24)   # scheduled departures by local hour
arr=collections.defaultdict(lambda: [0]*24)   # scheduled arrivals by local hour
wd_dep=collections.defaultdict(lambda: [0]*24); wd_arr=collections.defaultdict(lambda: [0]*24)
carr=collections.defaultdict(collections.Counter)
days=set(); wdays=set()
n=0
with open(p, newline='', encoding='latin-1') as f:
    r=csv.DictReader(f)
    for row in r:
        n+=1
        d=row['FlightDate']; days.add(d)
        dow=int(row['DayOfWeek'])  # 1=Mon
        if dow<=5: wdays.add(d)
        o=row['Origin']; de=row['Dest']
        if o in AP:
            h=int(row['CRSDepTime'])//100 % 24
            dep[o][h]+=1; carr[o][row['Reporting_Airline']]+=1
            if dow<=5: wd_dep[o][h]+=1
        if de in AP:
            h=int(row['CRSArrTime'])//100 % 24
            arr[de][h]+=1; carr[de][row['Reporting_Airline']]+=1
            if dow<=5: wd_arr[de][h]+=1
nd=len(days); nw=len(wdays)
out={'rows':n,'days':nd,'weekdays':nw,'airports':{}}
print('rows',n,'days',nd,'weekdays',nw)
for a in AP:
    td=sum(dep[a]); ta=sum(arr[a])
    print('\n==',a,'sched dep/day %.1f arr/day %.1f total/day %.1f'%(td/nd,ta/nd,(td+ta)/nd))
    print(' weekday dep by hour/day:',' '.join('%.1f'%(x/nw) for x in wd_dep[a]))
    print(' weekday arr by hour/day:',' '.join('%.1f'%(x/nw) for x in wd_arr[a]))
    tot=[(wd_dep[a][h]+wd_arr[a][h]) for h in range(24)]; s=sum(tot)
    print(' weekday share of day by hour (%):',' '.join('%.1f'%(100*x/s) for x in tot))
    c=carr[a]; ct=sum(c.values())
    print(' carriers:',', '.join('%s %.1f%%'%(k,100*v/ct) for k,v in c.most_common(10)))
    out['airports'][a]={'dep_per_day':td/nd,'arr_per_day':ta/nd,'wd_dep_by_hour':[x/nw for x in wd_dep[a]],'wd_arr_by_hour':[x/nw for x in wd_arr[a]],'carrier_share':{k:v/ct for k,v in c.most_common(12)}}
json.dump(out, open(sys.argv[2],'w'), indent=1)
