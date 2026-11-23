  /* ---------- public services: every one keyless and open to a browser (CORS), checked 2026-11-19 ---------- */
  const EP = {
    esri: 'https://server.arcgisonline.com/ArcGIS/rest/services/',
    esriKey: 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/',
    bldg: 'https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/USA_Structures_View/FeatureServer/0/query',
    roads: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/',
    geocode: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates',
    revgeo: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode',
    mly: 'https://graph.mapillary.com/images',
    osmBldg: 'https://services6.arcgis.com/Do88DoK2xjTUCXd1/arcgis/rest/services/OSM_NA_Buildings/FeatureServer/0/query',
    /* California Energy Commission: the sixteen building climate zones (the commission's 2015 boundary layer) */
    cz: 'https://services3.arcgis.com/bWPjFyq029ChCGur/arcgis/rest/services/BuildingClimateZones_CEC_2015/FeatureServer/0/query',
    /* CAL FIRE's hosted layers: Fire Hazard Severity Zones (State Responsibility Area, in force April 1, 2024; Local
       Responsibility Area, the State Fire Marshal's map of March 24, 2025), fire perimeters since 1950, damage inspections */
    fire: 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/',
    fhszS: 'FHSZSRA_23_3/FeatureServer/0/query', fhszL: 'FHSALRA25_v1_All/FeatureServer/0/query', perim: 'California_Historic_Fire_Perimeters/FeatureServer/2/query', dins: 'POSTFIRE_MASTER_DATA_SHARE/FeatureServer/0/query',
    /* re-roof permits */
    ladbs: [['https://data.lacity.org/resource/pi9x-tg5x.json', 2020], ['https://data.lacity.org/resource/dyxf-7hc4.json', 2010], ['https://data.lacity.org/resource/e67z-kt2n.json', 1996]],
    epicla: 'https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/EPIC-LA_Case_History_view/FeatureServer/0/query',
    sfp: 'https://data.sf.gov/resource/i98e-djp9.json',
    sfroll: 'https://data.sf.gov/resource/wv5m-vpq2.json',
    sacp: ['https://services5.arcgis.com/54falWtcpty3V47Z/arcgis/rest/services/BldgPermitIssued_Archive/FeatureServer/0/query', 'https://services5.arcgis.com/54falWtcpty3V47Z/arcgis/rest/services/BldgPermitIssued_CurrentYear/FeatureServer/0/query'],
    sjp: 'https://data.sanjoseca.gov/api/3/action/datastore_search_sql',
  };
  /* The county assessors' public parcel layers, by county FIPS, as tested on 2026-11-19 (ArcGIS REST, one envelope query a
     map square). yb: the year built as the layer gives it; an address and a use where it has them. A layer marked noYb
     has no year built a browser can read: it still names the building (FEMA's California footprints carry no address).
     San Francisco is a Socrata table of points (below); Riverside keeps the year and the roof covering in a second table. */
  const yr4 = v => { const y = parseInt(v, 10); return y >= 1850 && y <= THIS_YEAR + 1 ? y : null; };
  const PARCEL = {
    '06037': { n: 'Los Angeles', url: 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query', f: 'AIN,SitusAddress,SitusFullAddress,SitusCity,UseType,UseDescription,YearBuilt1,EffectiveYear1,Units1,SQFTmain1,Roll_Year',
      m: a => ({ yb: yr4(a.YearBuilt1), eff: yr4(a.EffectiveYear1), situs: a.SitusAddress || a.SitusFullAddress, city: a.SitusCity, use: a.UseDescription || a.UseType, apn: a.AIN, roll: a.Roll_Year, units: +a.Units1 || 0 }) },
    '06073': { n: 'San Diego', url: 'https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0/query', f: 'apn,situs_address,situs_pre_dir,situs_street,situs_suffix,situs_community,year_effective,nucleus_use_cd,unitqty', q: { maxAllowableOffset: 0.000005 }, two: true,
      m: a => ({ yy: /^\d{2}$/.test(String(a.year_effective || '').trim()) ? String(a.year_effective).trim() : '', situs: [a.situs_address, a.situs_pre_dir, a.situs_street, a.situs_suffix].filter(x => x != null && String(x).trim() && String(x).trim() !== '0').join(' '), city: a.situs_community, use: sdUse(a.nucleus_use_cd), apn: a.apn, units: +a.unitqty || 0 }) },
    '06059': { n: 'Orange', url: 'https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/FeatureServer/0/query', f: 'SITE_ADDRESS,ASSESSMENT_NO,YEAR_BUILT', m: a => ({ yb: yr4(a.YEAR_BUILT), situs: a.SITE_ADDRESS, apn: a.ASSESSMENT_NO }) },
    '06065': { n: 'Riverside', url: 'https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50/query', f: 'APN,SITUS_STREET,SITUS_CITY,CLASS_CODE', table: 'https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/80/query',
      m: a => ({ situs: a.SITUS_STREET, city: a.SITUS_CITY, use: a.CLASS_CODE, apn: a.APN }) },
    '06085': { n: 'Santa Clara', url: 'https://services2.arcgis.com/tcv2cMrq63AgvbHF/arcgis/rest/services/Parcels_Public_View/FeatureServer/0/query', f: 'APN,Year_Built,Situs_Address_Full', m: a => ({ yb: yr4(a.Year_Built), situs: a.Situs_Address_Full, apn: a.APN }) },
    '06013': { n: 'Contra Costa', url: 'https://gis.cccounty.us/arcgis/rest/services/CCMAP/Assessment_Parcels_ArcPro/MapServer/0/query', f: 'APN,full_address_display,s_city,USE_CODE,Description,YR_BUILT,YR_HS_BLT', m: a => ({ yb: yr4(a.YR_HS_BLT) || yr4(a.YR_BUILT), situs: a.full_address_display, city: a.s_city, use: a.Description, apn: a.APN }) },
    '06077': { n: 'San Joaquin', url: 'https://services2.arcgis.com/GQhSReJEO6f7tsvy/arcgis/rest/services/Parcels/FeatureServer/0/query', f: 'APN,FULL_ADDRESS,YEAR_BUILT,STORIES,NUMBER_UNITS,DESCRIPTION,VALUE_ROLL_YEAR', m: a => ({ yb: yr4(a.YEAR_BUILT), situs: a.FULL_ADDRESS, use: a.DESCRIPTION, apn: a.APN, roll: a.VALUE_ROLL_YEAR, units: +a.NUMBER_UNITS || 0 }) },
    '06097': { n: 'Sonoma', url: 'https://socogis.sonomacounty.ca.gov/map/rest/services/CRAPublic/ParcelsPublic/FeatureServer/0/query', f: 'APN,SitusFormatted1,UseCodeDescription,BuildingPrimaryYearBuilt,BuildingPrimaryEffectiveYear,BuildingPrimaryUnitCount', m: a => ({ yb: yr4(a.BuildingPrimaryYearBuilt), eff: yr4(a.BuildingPrimaryEffectiveYear), situs: a.SitusFormatted1, use: a.UseCodeDescription, apn: a.APN, units: +a.BuildingPrimaryUnitCount || 0 }) },
    '06111': { n: 'Ventura', url: 'https://services2.arcgis.com/XJ5Tb7dTYtAMoyYT/arcgis/rest/services/Parcels1955on/FeatureServer/6/query', url2: 'https://services2.arcgis.com/XJ5Tb7dTYtAMoyYT/arcgis/rest/services/ParcelsBefore1955/FeatureServer/7/query', f: 'YR_BLT', roll: 'a snapshot of May 3, 2023', m: a => ({ yb: yr4(a.YR_BLT) }) },
    '06001': { n: 'Alameda', noYb: true, url: 'https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/arcgis/rest/services/Parcels/FeatureServer/0/query', f: 'APN,SitusAddress,SitusCity,UseCode', m: a => ({ situs: a.SitusAddress, city: a.SitusCity, apn: a.APN }) },
    '06067': { n: 'Sacramento', noYb: true, url: 'https://services1.arcgis.com/5NARefyPVtAeuJPU/arcgis/rest/services/Parcels/FeatureServer/0/query', f: 'APN,STREET_NBR,STREET_NAM,CITY,LU_GENERAL,LU_SPECIF', m: a => ({ situs: [a.STREET_NBR, a.STREET_NAM].filter(x => x != null && String(x).trim()).join(' '), city: a.CITY, use: [a.LU_GENERAL, a.LU_SPECIF].filter(Boolean).join(', '), apn: a.APN }) },
    '06081': { n: 'San Mateo', noYb: true, url: 'https://gis.smcgov.org/maps/rest/services/Common/ACTIVE_PARCELS_APN/FeatureServer/0/query', f: 'APN,SITUS_ADDR', m: a => ({ situs: a.SITUS_ADDR, apn: a.APN }) },
    '06061': { n: 'Placer', noYb: true, url: 'https://services9.arcgis.com/NENkjkswKTzMfG3A/arcgis/rest/services/County_Parcels_-_Public_View/FeatureServer/0/query', f: 'Apn,SitusAddressFull,UseCodeName', m: a => ({ situs: a.SitusAddressFull, use: a.UseCodeName, apn: a.Apn }) },
  };
  /* San Diego's assessor use code (three digits): the first digit is the group */
  function sdUse(c) { c = String(c == null ? '' : c).trim(); if (!/^\d{3}$/.test(c)) return ''; return c === '111' ? 'Single family residence' : c[0] === '1' ? (+c >= 130 ? 'Multifamily residential' : 'Residential') : c[0] === '2' ? 'Commercial' : c[0] === '3' ? 'Industrial' : c[0] === '4' ? 'Agricultural' : c[0] === '7' ? 'Institutional' : 'Use code ' + c; }
  /* counties whose assessor publishes no year built a browser can read, and no address either */
  const NO_ROLL = { '06071': 'San Bernardino', '06019': 'Fresno', '06029': 'Kern' };
  /* who publishes re-roof permits: the county decides which files a map square asks */
  const PFILE = { '06037': 'la', '06075': 'sf', '06067': 'sac', '06085': 'sj' };
  const PFILE_L = { la: 'City of Los Angeles (1996 on) and Los Angeles County\'s unincorporated areas and contract cities (2018 on)', sf: 'San Francisco Department of Building Inspection', sac: 'City of Sacramento (2016 on)', sj: 'City of San Jose (active, expired and under inspection permits only)' };
