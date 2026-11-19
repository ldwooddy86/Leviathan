import json, sys, urllib.request, urllib.parse, os, ssl
D='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/engine/'
year=sys.argv[1]
pts=[l.split('|') for l in sys.argv[2:]]
fields_2024='data_year,route_id,begin_point,end_point,f_system,routenumber,routename,facility_type,through_lanes,managed_lanes_type,managed_lanes,peak_lanes,counter_peak_lanes,lane_width,median_width,shoulder_width_r,speed_limit,aadt,aadt_single_unit,aadt_combination,k_factor,dir_factor,access_control,toll_id,county_id'
fields_2025=fields_2024.replace('routenumber','route_number').replace('routename','route_name')
flds=fields_2025 if year=='2025' else fields_2024
out=[]
for name,lon,lat,*rest in pts:
    lon=float(lon); lat=float(lat); d=float(rest[0]) if rest else 0.0012
    env='%f,%f,%f,%f'%(lon-d,lat-d,lon+d,lat+d)
    q={'where':'f_system in (1,2,3)','geometry':env,'geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects','outFields':flds,'returnGeometry':'false','f':'json'}
    url='https://geo.dot.gov/server/rest/services/Hosted/HPMS_FULL_CA_%s/FeatureServer/0/query?'%year+urllib.parse.urlencode(q)
    ctx=ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or '/root/.ccr/ca-bundle.crt')
    try:
        r=json.load(urllib.request.urlopen(url, timeout=90, context=ctx))
    except Exception as e:
        print(name,'ERR',e); continue
    fs=[f['attributes'] for f in r.get('features',[])]
    out.append({'name':name,'lon':lon,'lat':lat,'features':fs})
    print('==',name,len(fs), r.get('error'))
    seen=set()
    for a in fs:
        rn=a.get('routenumber',a.get('route_number')); nm=a.get('routename',a.get('route_name'))
        key=(a['route_id'],a['begin_point'])
        if key in seen: continue
        seen.add(key)
        print('   yr %s rid %s rt %s %s fsys %s fac %s | thru %s managed %s(type %s) peak %s | lane w %s ft | speed %s | aadt %s (su %s comb %s) | K %s D %s | %.3f-%.3f'%(a['data_year'],a['route_id'],rn,(nm or '')[:18],a['f_system'],a['facility_type'],a['through_lanes'],a['managed_lanes'],a['managed_lanes_type'],a['peak_lanes'],a['lane_width'],a['speed_limit'],a['aadt'],a['aadt_single_unit'],a['aadt_combination'],a['k_factor'],a['dir_factor'],a['begin_point'] or 0,a['end_point'] or 0))
json.dump(out, open(D+'hpms_ca_%s_points_%s.json'%(year, pts[0][0].replace(' ','_')),'w'))
