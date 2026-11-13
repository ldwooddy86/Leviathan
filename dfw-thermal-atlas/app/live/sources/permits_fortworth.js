/* ==== live/sources/permits_fortworth.js ==== */
/* City of Fort Worth development permits (ArcGIS, refreshed by the city every hour of the working day): the mechanical
   permits pulled outside a building permit, which is how a changeout, a replacement or a repair of heating and air
   conditioning is permitted. Three server side aggregates a week: by month, the permits that fill several rows, and by ZIP
   code with the last eight weeks. The city stopped recording the work description in 2014 (it is filled on about 3 in 100
   permits), so the heating count stays empty here until it does; the collector measures that share on every run. Homes and
   businesses cannot be told apart in this file. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE;
  const CFG = {
    city: 'Fort Worth', layer: 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0',
    date: 'File_Date', zip: 'Zip_Code', id: 'Permit_No', desc: 'B1_WORK_DESC', blank: ['B1_WORK_DESC'],
    base: "Permit_Type = 'Mechanical' AND Permit_SubType = 'Standalone' AND Current_Status NOT IN ('Void', 'Withdrawn')",
    residentialOnly: false, what: 'Mechanical permits pulled outside a building permit (changeouts, replacements and repairs of heating and air conditioning), homes and businesses together. Void and withdrawn permits are left out, and a permit that covers several parcels counts once.',
  };
  L.register({
    id: 'permits_fortworth', name: 'Fort Worth mechanical permits', publisher: 'City of Fort Worth, Development Services', page: 'https://www.arcgis.com/home/item.html?id=d2740f4d746b4bfaa03e25de0376238b',
    about: 'Heating and air conditioning permits pulled outside a building permit in Fort Worth: by month for three years, by ZIP code for the last 12 months, and the last eight weeks against the same weeks a year earlier. The one observed count of replacement work by ZIP code, used to check the replacement model and to see where the work is being done; the city does not record whether a job was heating or cooling.',
    hosts: ['services5.arcgis.com'], cadence: 'weekly', cors: true, grade: 'B', terms: 'Creative Commons Attribution 4.0. Credit: City of Fort Worth Development Services Department.',
    labels: L.permits.LABELS, config: CFG,
    run: ctx => L.permits.arcgis.run(CFG, ctx),
    digest: L.permits.digest,
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
