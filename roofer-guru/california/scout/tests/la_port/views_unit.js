/* California port of tests/r11/views_unit.js: the roof views' arithmetic. Louisiana's file tested its views block in Node
   (the laminated share by year, the share of roofs a hurricane's wind replaces, the flood's depth by distance from the
   surge). The hurricane and surge parts do not exist in California; the rest (laminated share by year, wind damage by
   gust, fire class, cool roof rule, snow against the design load, the Alta X rule) is checked in the page itself by
   ../lens_unit_ca.js, which this runs. node views_unit.js <page.html> */
process.argv.splice(2, 0); require('../lens_unit_ca.js');
