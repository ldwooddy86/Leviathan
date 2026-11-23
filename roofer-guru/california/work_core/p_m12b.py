import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import SRC
p = os.path.join(SRC, '24_m12_lines.js'); t = open(p, encoding='utf-8').read()
a = t.find('    function lineRows(k, z) {'); b = t.find('    function drawDetail(TI) {')
assert a > 0 and b > a
NEW = r"""    function lineRows(k, z) {
      const r = (l, v) => `<div class="rowl"><span>${l}</span><b>${v}</b></div>`; const hv = (c, d, u) => c ? D(z[c], d == null ? 1 : d) + (u || '') : '—';
      const age = r('One unit roofs · 20 or older · reaching 20 in five years (model)', `${N(z.roofs)} · ${P(z.ra20_sh, 0)} · ${N(z.wave)}`) + r('Median roof age · roofs 25 or older', `${isN(z.ra_med) ? D(z.ra_med, 0) : '—'} · ${N(z.ra25)} (${P(z.ra25_sh, 0)})`);
      const own = r('Owner occupied · with a mortgage · median home value', `${P(z.own_sh, 0)} · ${P(z.mort_sh, 0)} · ${M$(z.value)}`);
      const wx = r('Normal rain a year · heavy rain days · atmospheric river days', `${hv(HC.rain, 1, ' in')} · ${hv(HC.rain1, 1)} · ${hv(HC.ar, 1)}`) + r('Gust days a year, 58 mph or more · offshore wind days', `${hv(HC.gust, 2)} · ${hv(HC.sa, 1)}`) + r('FEMA storm and flood registrations · the 2023 winter storms', `${N(z.fema_storm)} · ${N(z.fema_w23)}`);
      const fire = r('Homes in High or Very High fire zones', HC.fhsz ? P(z[HC.fhsz], 0) : '—') + r('Structures destroyed · damaged by wildfire · last year on record', `${HC.dest ? N(z[HC.dest]) : '—'} · ${HC.dmg ? N(z[HC.dmg]) : '—'} · ${z.lastfire || 'none'}`) + r('FEMA fire registrations · fire and smoke claims paid 2018 to 2023', `${N(z.fema_fire)} · ${N(z.wf_claims)}`);
      const ins = r('FAIR Plan home policies · per 100 homes · against 2022', `${N(z.fair_pif)} · ${D(z.fair_sh, 1)} · ${isN(z.fair_x) ? D(z.fair_x, 1) + '×' : '—'}`) + r('Non-renewed 2023 · share · rated High or Extreme wildfire risk', `${N(z.nonren)} · ${P(z.nonren_sh, 1)} · ${P(z.wf_hi_sh, 0)}`);
      const tile = r('Tile roofs (model) · share of roofs · underlayment 25 years or older', `${N(z.tile_n)} · ${P(z.tile_sh, 0)} · ${N(z.tile25)}`) + r('Tile underlayment jobs due in twelve months (model)', D(z.nxt_t, 0));
      const com = r('Commercial roofs (estimate) · warehouses · plants · retail · churches', `${D(z.cru, 0)} · ${N(z.whse)} · ${N(z.mfg)} · ${N(z.retail)} · ${N(z.church)}`);
      const heat = r('Days at 100°F or more · normal rain a year', `${hv(HC.heat, 1)} · ${hv(HC.rain, 1, ' in')}`);
      return {
        replace: age + own + r('Wood shake roofs (model) · metal share of reroofs (assumption)', `${P(z.wood_sh, 1)} · ${P(z.metal_sh, 0)}`),
        repair: age + r('Built before 1980 · median year built', `${P(z.pre80_sh, 0)} · ${isN(z.yb_med) ? D(z.yb_med, 0) : '—'}`) + wx,
        storm: wx + age, fire: fire + ins, harden: fire + ins + own, tile: tile + age + own,
        solar: (HC.solar ? r('Homes with rooftop solar', P(z[HC.solar], 0)) : '') + r('Reroofs due in twelve months · tile relays due (model)', `${D(z.nxt, 0)} · ${D(z.nxt_t, 0)}`) + r('Electrical contractors in the ZIP (ZBP)', N(z.solar_co)) + own,
        metal: age + own + r('Households earning $100,000 or more · metal share of reroofs (assumption)', `${P(z.hh100k_sh, 0)} · ${P(z.metal_sh, 0)}`) + r('Snow load · homes in High or Very High fire zones', `${hv(HC.snow, 0, ' psf')} · ${HC.fhsz ? P(z[HC.fhsz], 0) : '—'}`),
        mh: r('Mobile homes · share of homes', `${N(z.mh)} · ${P(z.mh_sh, 0)}`) + wx + heat,
        mf: r('Homes in buildings of five or more units · buildings (estimate) · apartment lessors · property managers', `${N(z.mf5u)} · ${N(z.mfb)} · ${N(z.apts)} · ${N(z.pm)}`) + wx,
        comm: com + heat + r('FAIR Plan commercial policies', N(z.fair_com)), coat: com + heat,
        newc: r('Homes built since 2020 · since 2010', `${N(z.yb20)} · ${N((z.yb20 || 0) + (z.yb10 || 0))}`) + r('Builders and supply houses (ZBP)', `${N(z.builders)} · ${N(z.supply)}`) + (HC.fhsz ? r('Homes in High or Very High fire zones (Class A on every new roof there)', P(z[HC.fhsz], 0)) : ''),
      }[k] || '';
    }
"""
t = t[:a] + NEW + t[b:]
open(p, 'w', encoding='utf-8').write(t); print('lineRows replaced')
