#!/usr/bin/env python3
"""Final cross-origin test of each county parcel layer: box query with the fields the page needs, Origin: null.
Writes a 25-feature sample per county and appends one line per county to parcels_summary.jsonl.
usage: parcel_final.py <outdir> [key ...]"""
import sys, json, re, time, urllib.request, urllib.parse
OUT=sys.argv[1]; only=set(sys.argv[2:])
L=[
 # key, county, url, box (w,s,e,n) residential, outFields, year fields, use fields, address fields
 ('la','Los Angeles','https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0','-118.3050,34.0480,-118.3000,34.0520','AIN,APN,SitusFullAddress,SitusAddress,SitusCity,SitusZIP,UseCode,UseType,UseDescription,YearBuilt1,EffectiveYear1,YearBuilt2,Units1,SQFTmain1,Roll_Year,DesignType1',['YearBuilt1','EffectiveYear1'],['UseType','UseDescription','UseCode'],['SitusFullAddress']),
 ('sd','San Diego','https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0','-117.1350,32.7400,-117.1300,32.7440','apn,situs_address,situs_pre_dir,situs_street,situs_suffix,situs_suite,situs_community,situs_zip,year_effective,nucleus_use_cd,asr_landuse,unitqty,total_lvg_area,usable_sq_feet,qual_class_shape',['year_effective'],['nucleus_use_cd','asr_landuse'],['situs_address','situs_street']),
 ('oc','Orange','https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/FeatureServer/0','-117.9350,33.8450,-117.9300,33.8490','SITE_ADDRESS,ASSESSMENT_NO,YEAR_BUILT,NBR_BEDROOMS',['YEAR_BUILT'],[],['SITE_ADDRESS']),
 ('riv','Riverside (parcels; year built is in table 80)','https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50','-117.3800,33.9500,-117.3750,33.9540','APN,SITUS_STREET,SITUS_CITY,ZIP_CODE,CLASS_CODE,MULTIPLE,ACREAGE',[],['CLASS_CODE'],['SITUS_STREET']),
 ('sb','San Bernardino','https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/Parcels_for_San_Bernardino_County/FeatureServer/0','-117.2950,34.1300,-117.2900,34.1340','ParcelNumber,AssessClass,AssessDescription,BaseYear,Zoning,ZoningDescription,Jurisdiction,Acreage,TaxStatus',['BaseYear'],['AssessClass','AssessDescription'],[]),
 ('scl','Santa Clara','https://services2.arcgis.com/tcv2cMrq63AgvbHF/arcgis/rest/services/Parcels_Public_View/FeatureServer/0','-121.9000,37.3050,-121.8950,37.3090','APN,Year_Built,Situs_Address_Full,Sq_Ft_Rec,Acres_Rec,TRA',['Year_Built'],[],['Situs_Address_Full']),
 ('ala','Alameda','https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/arcgis/rest/services/Parcels/FeatureServer/0','-122.2500,37.8150,-122.2450,37.8190','APN,SitusAddress,SitusCity,SitusZip,UseCode,Land,Imps,LatestDocumentDate',[],['UseCode'],['SitusAddress']),
 ('cc','Contra Costa','https://gis.cccounty.us/arcgis/rest/services/CCMAP/Assessment_Parcels_ArcPro/MapServer/0','-122.0500,37.9150,-122.0450,37.9190','APN,full_address_display,s_city,S_ZIP,USE_CODE,Description,YR_BUILT,YR_HS_BLT,BLDG_SQFT,TOT_AREA,TLA,ACREAGE',['YR_BUILT','YR_HS_BLT'],['USE_CODE','Description'],['full_address_display']),
 ('sac','Sacramento','https://services1.arcgis.com/5NARefyPVtAeuJPU/arcgis/rest/services/Parcels/FeatureServer/0','-121.4750,38.5600,-121.4700,38.5640','APN,STREET_NBR,STREET_NAM,CITY,ZIP,LANDUSE,LU_GENERAL,LU_SPECIF,LU_DETAIL,LOT_SIZE',[],['LU_GENERAL','LU_SPECIF','LU_DETAIL'],['STREET_NAM']),
 ('sm','San Mateo','https://gis.smcgov.org/maps/rest/services/Common/ACTIVE_PARCELS_APN/FeatureServer/0','-122.3250,37.5650,-122.3200,37.5690','APN,SITUS_ADDR,SITUS_CITY,OFFICEYEARBUILT,OFFICEGRSBLDAREA,OFFICELANDAREA,PUC,PUCDESC,LegalAreaSQFT',['OFFICEYEARBUILT'],['PUC','PUCDESC'],['SITUS_ADDR']),
 ('fre','Fresno','https://services6.arcgis.com/tXJI2YlHpcXmq7ZL/arcgis/rest/services/All_Fresno_parcels/FeatureServer/0','-119.7900,36.7500,-119.7850,36.7540','APN,AGENCY_COD,ROLL_YEAR',[],[],[]),
 ('kern','Kern','https://services5.arcgis.com/Y8jwjGUWbRjuqpG5/arcgis/rest/services/Assessor_Parcels_Land_2026_gdb/FeatureServer/0','-119.0300,35.3700,-119.0250,35.3740','APN,APN9,APN_LABEL,SHAPE_SQFT',[],[],[]),
 ('ven55','Ventura (built 1955 on)','https://services2.arcgis.com/XJ5Tb7dTYtAMoyYT/arcgis/rest/services/Parcels1955on/FeatureServer/6','-119.2300,34.2750,-119.2250,34.2790','CTY_STA,ZIP,MH_PARK,YR_BLT',['YR_BLT'],[],[]),
 ('venpre','Ventura (built before 1955)','https://services2.arcgis.com/XJ5Tb7dTYtAMoyYT/arcgis/rest/services/ParcelsBefore1955/FeatureServer/7','-119.2950,34.2780,-119.2900,34.2820','CTY_STA,ZIP,YR_BLT',['YR_BLT'],[],[]),
 ('venall','Ventura (all parcels, monthly)','https://services2.arcgis.com/XJ5Tb7dTYtAMoyYT/arcgis/rest/services/Parcels_Quarterly/FeatureServer/0','-119.2300,34.2750,-119.2250,34.2790','APN,APN10,LAT,LON',[],[],[]),
 ('sj','San Joaquin','https://services2.arcgis.com/GQhSReJEO6f7tsvy/arcgis/rest/services/Parcels/FeatureServer/0','-121.3050,37.9650,-121.3000,37.9690','APN,FULL_ADDRESS,YEAR_BUILT,STORIES,TOTALLIV_AREA,NUMBER_UNITS,USECODE,DESCRIPTION,CATEGORY,QCS,VALUE_ROLL_YEAR',['YEAR_BUILT'],['USECODE','DESCRIPTION','CATEGORY'],['FULL_ADDRESS']),
 ('son','Sonoma','https://socogis.sonomacounty.ca.gov/map/rest/services/CRAPublic/ParcelsPublic/FeatureServer/0','-122.7150,38.4450,-122.7100,38.4490','APN,SitusFormatted1,SitusFormatted2,UseCode,UseCodeDescription,UseCodeType,BuildingPrimaryYearBuilt,BuildingPrimaryEffectiveYear,BuildingPrimaryStories,BuildingPrimarySize,BuildingPrimaryUnitCount,BuildingPrimaryQualityClass,LandSizeSqft',['BuildingPrimaryYearBuilt','BuildingPrimaryEffectiveYear'],['UseCode','UseCodeDescription','UseCodeType'],['SitusFormatted1']),
 ('pla','Placer','https://services9.arcgis.com/NENkjkswKTzMfG3A/arcgis/rest/services/County_Parcels_-_Public_View/FeatureServer/0','-121.2900,38.7500,-121.2850,38.7540','Apn,SitusAddressFull,FormattedSitus1,UseCode,UseCodeName,LandValue,Structure,Acres,Jurisdiction',[],['UseCode','UseCodeName'],['FormattedSitus1']),
]
def get(u, timeout=90):
    req=urllib.request.Request(u, headers={'Origin':'null','User-Agent':'Mozilla/5.0 (X11; Linux x86_64) scout-probe'})
    t=time.time()
    try:
        r=urllib.request.urlopen(req, timeout=timeout); b=r.read(); return r.status, r.headers.get('access-control-allow-origin'), b, time.time()-t
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('access-control-allow-origin'), e.read(), time.time()-t
    except Exception as e:
        return 0, None, str(e).encode(), time.time()-t
def valid_year(v):
    try:
        iv=int(float(str(v).strip())); return 1800<=iv<=2027
    except Exception: return False
for key,county,url,box,of,yf,uf,af in L:
    if only and key not in only: continue
    rec={'key':key,'county':county,'layer':url,'box':box,'outFields':of,'tested':time.strftime('%Y-%m-%d %H:%M UTC',time.gmtime())}
    st,acao,b,dt=get(url+'?f=json')
    try:
        m=json.loads(b); rec.update(maxRecordCount=m.get('maxRecordCount'), formats=m.get('supportedQueryFormats'), pagination=(m.get('advancedQueryCapabilities') or {}).get('supportsPagination'), name=m.get('name'))
        ed=m.get('editingInfo') or {}; 
        if ed.get('dataLastEditDate') or ed.get('lastEditDate'): rec['lastEdit']=time.strftime('%Y-%m-%d',time.gmtime((ed.get('dataLastEditDate') or ed.get('lastEditDate'))/1000))
    except Exception as e: rec['meta_error']=str(b[:120])
    base={'where':'1=1','geometry':box,'geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects'}
    st,acao,b,dt=get(url+'/query?'+urllib.parse.urlencode(dict(base,returnCountOnly='true',f='json')))
    try: rec['total_in_box']=json.loads(b).get('count')
    except Exception: pass
    st,acao2,b2,dt2=get(url+'/query?'+urllib.parse.urlencode({'where':'1=1','returnCountOnly':'true','f':'json'}))
    try: rec['total_in_layer']=json.loads(b2).get('count')
    except Exception: pass
    q=dict(base,outFields=of,returnGeometry='true',outSR='4326',geometryPrecision='6',f='json')
    qurl=url+'/query?'+urllib.parse.urlencode(q)
    st,acao,b,dt=get(qurl,120)
    rec.update(http=st,acao=acao,bytes=len(b),seconds=round(dt,2),query=qurl)
    try:
        r=json.loads(b)
        if 'error' in r: rec['error']=r['error']
        F=r.get('features',[]); rec['features']=len(F); rec['exceeded']=bool(r.get('exceededTransferLimit'))
        n=len(F) or 1
        rec['year_valid']={k:f"{sum(1 for f in F if valid_year(f['attributes'].get(k)))}/{len(F)}" for k in yf}
        rec['use_filled']={k:f"{sum(1 for f in F if f['attributes'].get(k) not in (None,'',' ',0))}/{len(F)}" for k in uf}
        rec['addr_filled']={k:f"{sum(1 for f in F if str(f['attributes'].get(k) or '').strip() not in ('','No Data Available','NO ADDRESS ON FILE'))}/{len(F)}" for k in af}
        if F:
            rec['sample_attrs']=F[min(3,len(F)-1)]['attributes']
            verts=sum(len(rg) for f in F for rg in ((f.get('geometry') or {}).get('rings') or []))
            rec['vertices']=verts
            r['features']=F[:25]; r['_note']=f'first 25 of {len(F)} features for box {box} (w,s,e,n); query: {qurl}'
            p=f'{OUT}/{key}_parcels_box_sample.json'; json.dump(r,open(p,'w')); rec['sample_path']=p
    except Exception as e: rec['parse_error']=str(e)[:200]+' '+str(b[:120])
    # geojson variant size
    st,acao3,b3,dt3=get(url+'/query?'+urllib.parse.urlencode(dict(q,f='geojson')),120)
    rec['geojson']={'http':st,'acao':acao3,'bytes':len(b3)}
    open(f'{OUT}/parcels_summary.jsonl','a').write(json.dumps(rec)+'\n')
    print(f"{key:7s} {county[:28]:28s} http {rec.get('http')} ACAO {rec.get('acao')!s:5s} max {rec.get('maxRecordCount')} box {rec.get('features')}/{rec.get('total_in_box')} layer {rec.get('total_in_layer')} {rec.get('bytes')}B {rec.get('seconds')}s verts {rec.get('vertices')} years {rec.get('year_valid')} use {rec.get('use_filled')} addr {rec.get('addr_filled')} edit {rec.get('lastEdit')}")
