import json, sys, urllib.request, urllib.parse, os, ssl, collections
D='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/engine/'
year='2024'
flds='data_year,route_id,begin_point,end_point,f_system,routenumber,routename,facility_type,through_lanes,managed_lanes_type,managed_lanes,lane_width,speed_limit,aadt,k_factor,dir_factor,toll_id,structure_type'
ctx=ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
allout=[]
for spec in sys.argv[1:]:
    name,lon,lat,rt,d=spec.split('|'); lon=float(lon); lat=float(lat); d=float(d)
    env='%f,%f,%f,%f'%(lon-d,lat-d,lon+d,lat+d)
    where="route_id like 'SHS_%s%%'"%rt.zfill(3) if rt else 'f_system in (1,2,3)'
    q={'where':where,'geometry':env,'geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects','outFields':flds,'returnGeometry':'false','f':'json'}
    url='https://geo.dot.gov/server/rest/services/Hosted/HPMS_FULL_CA_%s/FeatureServer/0/query?'%year+urllib.parse.urlencode(q)
    try: r=json.load(urllib.request.urlopen(url, timeout=90, context=ctx))
    except Exception as e: print(name,'ERR',e); continue
    fs=[f['attributes'] for f in r.get('features',[])]
    allout.append({'name':name,'lon':lon,'lat':lat,'route':rt,'features':fs})
    c=collections.Counter((a['route_id'],a['through_lanes'],a['managed_lanes'],a['managed_lanes_type'],a['lane_width'],a['speed_limit'],a['aadt'],a['structure_type'],a['toll_id']) for a in fs)
    print('==',name,'(%d sections)'%len(fs), r.get('error') or '')
    for k,v in c.most_common(8):
        print('   route_id %s | through_lanes %s | managed %s (type %s) | lane_width %s | speed_limit %s | aadt %s | structure %s | toll %s | x%d'%(k+(v,)))
json.dump(allout, open(D+'hpms_ca_2024_%s.json'%sys.argv[1].split('|')[0].replace(' ','_').replace('/','_'),'w'))
