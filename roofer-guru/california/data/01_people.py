#!/usr/bin/env python3
"""Step 1. People, homes, business, insurance, FEMA, licences by ZIP and county.
Reads CA/dl/people (already downloaded and verified) and CA/data/dl (geotargets).
Writes work/base.json: {zips: [dict], counties: [dict], state: dict, places: [...], extras...}
Usage: python3 -I 01_people.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import collections, glob, re

RAW = os.path.join(DL, 'acs', 'raw')


def table(t):
    """ACS table -> {geo_id: {line number: estimate}}"""
    out = {}
    with open(os.path.join(RAW, 'ca_acs5y2024_%s.dat' % t)) as f:
        head = f.readline().rstrip('\n').split('|')
        idx = [(i, int(h.split('_E')[1])) for i, h in enumerate(head) if '_E' in h]
        for line in f:
            c = line.rstrip('\n').split('|')
            out[c[0]] = {k: num(c[i]) for i, k in idx}
    return out


T = {t: table(t) for t in ['b01001', 'b01002', 'b01003', 'b03002', 'b04006', 'b11001', 'b19001', 'b19013', 'b25001', 'b25002',
                           'b25003', 'b25004', 'b25010', 'b25018', 'b25024', 'b25032', 'b25034', 'b25035', 'b25038',
                           'b25039', 'b25075', 'b25077', 'b25081', 'b25127', 'c16001']}
# ancestry lines by label
shell = collections.defaultdict(dict)
with open(os.path.join(RAW, 'ACS20245YR_Table_Shells.txt'), encoding='latin-1') as f:
    next(f)
    for line in f:
        c = line.rstrip('\n').split('|')
        if c[3]:
            shell[c[0]][c[4].strip().rstrip(':').lower()] = int(c[3].split('_')[1])
ARM, IRAN = shell['B04006']['armenian'], shell['B04006']['iranian']

YB = ['yb20', 'yb10', 'yb00', 'yb90', 'yb80', 'yb70', 'yb60', 'yb50', 'yb40', 'ybold']
OB = ['o20', 'o10', 'o00', 'o90', 'o80', 'o70', 'o60', 'o50', 'o40', 'oold']
LANGS = [('span', 3), ('chin', 21), ('viet', 24), ('tagalog', 27), ('korean', 18), ('arabic', 33), ('slavic', 12), ('oie', 15)]
LEP_LINES = [5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38]


def g(t, gid, k):
    v = T[t].get(gid, {}).get(k)
    return 0.0 if v is None else v


def gm(t, gid, k):
    return T[t].get(gid, {}).get(k)


def acs_row(gid):
    """every ACS derived field for one geography; counts kept as numbers"""
    r = {}
    r['pop'] = int(g('b01003', gid, 1))
    r['hh'] = int(g('b11001', gid, 1))
    r['inc'] = gm('b19013', gid, 1)
    r['value'] = gm('b25077', gid, 1)
    occ = g('b25003', gid, 1)
    r['own'] = g('b25003', gid, 2)
    r['rent'] = g('b25003', gid, 3)
    r['own_sh'] = pct(r['own'], occ)
    s = lambda t, a, b: sum(g(t, gid, k) for k in range(a, b + 1))
    tot24 = g('b25024', gid, 1)
    r['sfd_sh'] = pct(g('b25024', gid, 2), tot24)
    r['mf5u'] = s('b25024', 6, 9)
    r['mf5_sh'] = pct(r['mf5u'], tot24)
    p5 = g('c16001', gid, 1)
    r['pop5'] = p5
    for nm, ln in LANGS:
        r[nm] = g('c16001', gid, ln)
        r[nm + '_sh'] = pct(r[nm], p5)
    r['span_lep_sh'] = pct(g('c16001', gid, 5), p5)
    r['chin_lep_sh'] = pct(g('c16001', gid, 23), p5)
    r['viet_lep_sh'] = pct(g('c16001', gid, 26), p5)
    r['korean_lep_sh'] = pct(g('c16001', gid, 20), p5)
    r['tagalog_lep_sh'] = pct(g('c16001', gid, 29), p5)
    r['lep_sh'] = pct(sum(g('c16001', gid, k) for k in LEP_LINES), p5)
    best = max(((r[nm + '_sh'] or 0), nm) for nm, _ in LANGS[1:])
    r['lang2'] = best[1] if best[0] >= 3 else None
    r['anc_arm'] = int(g('b04006', gid, ARM))
    r['anc_iran'] = int(g('b04006', gid, IRAN))
    tot3 = g('b03002', gid, 1)
    r['hisp_sh'] = pct(g('b03002', gid, 12), tot3)
    r['asian_sh'] = pct(g('b03002', gid, 6), tot3)
    t19 = g('b19001', gid, 1)
    r['hh100k_sh'] = pct(s('b19001', 14, 17), t19)
    r['hh200k_sh'] = pct(g('b19001', gid, 17), t19)
    r['a65p'] = s('b01001', 20, 25) + s('b01001', 44, 49)
    r['s65_sh'] = pct(r['a65p'], g('b01001', gid, 1))
    r['age_med'] = gm('b01002', gid, 1)
    r['hu'] = g('b25001', gid, 1)
    r['occ'] = float(r['hh'])
    r['vac_sh'] = pct(g('b25002', gid, 3), g('b25002', gid, 1))
    r['seas'] = g('b25004', gid, 6)
    r['u1'] = g('b25024', gid, 2) + g('b25024', gid, 3)
    r['u1a'] = g('b25024', gid, 3)
    r['mh'] = g('b25024', gid, 10)
    r['mh_sh'] = pct(r['mh'], tot24)
    r['mf24'] = g('b25024', gid, 4) + g('b25024', gid, 5)
    r['mf5_9'], r['mf10_19'], r['mf20_49'], r['mf50'] = (g('b25024', gid, k) for k in (6, 7, 8, 9))
    r['mfb'] = round(r['mf5_9'] / 7 + r['mf10_19'] / 14 + r['mf20_49'] / 30 + r['mf50'] / 80, 1)
    r['yb_med'] = gm('b25035', gid, 1)
    if r['yb_med'] is not None and r['yb_med'] < 1800:
        r['yb_med'] = None   # ACS writes 0 for "1939 or earlier"
    r['rooms'] = gm('b25018', gid, 1)
    r['mort_sh'] = pct(g('b25081', gid, 2), g('b25081', gid, 1))
    yb = [g('b25034', gid, k) for k in range(2, 12)]
    for nm, v in zip(YB, yb):
        r[nm] = v
    r['pre80_sh'] = pct(sum(yb[5:]), g('b25034', gid, 1))
    # one unit homes by decade: B25127 one unit (owner + renter, occupied) in six bands, split by B25034 inside the band,
    # then scaled so the ten sum to u1 (B25127 counts occupied homes only)
    bands = [(4, 47, [0]), (11, 54, [1, 2]), (18, 61, [3, 4]), (25, 68, [5, 6]), (32, 75, [7, 8]), (39, 82, [9])]
    o = [0.0] * 10
    for a, b, ix in bands:
        n = g('b25127', gid, a) + g('b25127', gid, b)
        w = [yb[i] for i in ix]
        sw = sum(w)
        for i, wi in zip(ix, w):
            o[i] = n * (wi / sw if sw > 0 else 1.0 / len(ix))
    so = sum(o)
    if so > 0:
        o = [x * r['u1'] / so for x in o]
    elif r['u1'] > 0:
        syb = sum(yb)
        o = [r['u1'] * (y / syb if syb else 0.1) for y in yb]
    for nm, v in zip(OB, o):
        r[nm] = round(v, 1)
    r['rent1'] = g('b25032', gid, 14) + g('b25032', gid, 15)
    r['val1m_sh'] = pct(s('b25075', 25, 27), g('b25075', gid, 1))
    r['hhsize'] = gm('b25010', gid, 1)
    r['moved10_sh'] = pct(s('b25038', 3, 5) + s('b25038', 10, 12), g('b25038', gid, 1))
    r['own_yr'] = gm('b25039', gid, 2)
    if r['own_yr'] is not None and r['own_yr'] < 1800:
        r['own_yr'] = None
    return r


# ---------- counties
gaz = {}
with open(os.path.join(DL, 'geo', 'raw', 'gazetteer', '2024_gaz_counties_06.txt')) as f:
    hd = [h.strip() for h in f.readline().split('\t')]
    for line in f:
        c = dict(zip(hd, [x.strip() for x in line.split('\t')]))
        gaz[c['GEOID']] = c
counties = []
for fips in sorted(gaz):
    c = gaz[fips]
    name = c['NAME'].replace(' County', '')
    r = acs_row('0500000US' + fips)
    d = {'fips': fips, 'name': name, 'reg': COUNTY_REG[name], 'seat': SEATS[name], 'aland': int(c['ALAND']),
         'awater': int(c['AWATER']), 'lat': float(c['INTPTLAT']), 'lon': float(c['INTPTLONG'])}
    d.update(r)
    d['yb'] = [r[k] for k in YB]
    d['spanish'] = r['span']
    counties.append(d)
assert len(counties) == 58
CI = {c['fips']: i for i, c in enumerate(counties)}
CN = {c['name'].upper(): i for i, c in enumerate(counties)}
state = acs_row('0400000US06')

# ---------- ZIP rows
xw = rd(os.path.join(DL, 'xwalk', 'raw', 'ca_zcta_crosswalk.csv'))
gid = {}
gt = glob.glob(os.path.join(MYDL, 'geotargets', '**', 'geotargets-*.csv'), recursive=True)
gt_file = None
if gt:
    gt_file = sorted(gt)[-1]
    for row in rd(gt_file):
        if row['Target Type'] == 'Postal Code' and row['Country Code'] == 'US' and row['Status'] == 'Active':
            gid[row['Name']] = int(row['Criteria ID'])
print('geotargets', gt_file and os.path.basename(gt_file), len(gid))

zips = []
skipped = collections.Counter()
for x in xw:
    z = x['zcta']
    if x['in_ca'] != '1' or not x['county_fips'].startswith('06'):
        skipped['not mostly California'] += 1
        continue
    if not re.fullmatch(r'9[0-6]\d{3}', z):
        skipped['postal code outside 90000 to 96999 (an Oregon post office)'] += 1
        continue
    r = acs_row('860Z200US' + z)
    if r['pop'] < 1:
        skipped['no residents'] += 1
        continue
    pi = CI[x['county_fips']]
    city = x['po_city'] if x['po_state'] in ('CA', '') and x['po_city'] else x['geonames_place']
    if not city:
        city = x['geonames_place'] or counties[pi]['name']
    place = re.sub(r' (city|CDP|town)$', '', x['place_name']) if x['place_name'] and float(x['unincorp_land_share'] or 0) < 0.5 else None
    d = {'zip': z, 'city': titlecase(city), 'pi': pi, 'reg': counties[pi]['reg'], 'lat': round(float(x['lat']), 4),
         'lon': round(float(x['lon']), 4), 'sqmi': round(float(x['aland_sqmi']), 2), 'wsqmi': round(float(x['awater_sqmi'] or 0), 2),
         'gid': gid.get(z), 'place': place, 'ncty': int(x['n_counties'])}
    d.update(r)
    d['density'] = round(r['pop'] / d['sqmi']) if d['sqmi'] > 0 else None
    zips.append(d)
ZI = {d['zip']: d for d in zips}
print('zip rows', len(zips), dict(skipped), 'pop', sum(d['pop'] for d in zips), 'gid', sum(1 for d in zips if d['gid']))

# ---------- business (ZIP Code Business Patterns 2023)
BIZ = ['est', 'retail', 'food', 'lodging', 'whse', 'mfg', 'church', 'health', 'school', 'apts', 'nonres', 'office', 'auto',
       'roofers', 'builders', 'supply', 'ins_agents', 'adjusters']
for d in zips:
    for k in BIZ + ['solar_co', 'pm']:
        d[k] = 0
biz_out = collections.Counter()
for row in rd(os.path.join(DL, 'biz', 'raw', 'ca', 'ca_zip_business_columns_zbp2023.csv')):
    d = ZI.get(row['zip'])
    if d is None:
        biz_out['zips_not_zcta'] += 1
        biz_out['roofers_not_zcta'] += int(n0(row['roofers']))
        biz_out['est_not_zcta'] += int(n0(row['est']))
        continue
    for k in BIZ:
        d[k] = int(n0(row[k]))
    d['solar_co'] = int(n0(row['electrical']))
    d['pm'] = int(n0(row['prop_mgr_res']))
print('business', dict(biz_out))
cb = {}
for row in rd(os.path.join(DL, 'biz', 'raw', 'ca', 'ca_county_roofing_cbp2023_nes2024.csv')):
    cb[row['county_fips']] = row
for c in counties:
    row = cb.get(c['fips'], {})
    c['cbp_roof'] = int(num(row.get('cbp238160_est'))) if num(row.get('cbp238160_est')) is not None else None
    c['cbp_roof_emp'] = int(num(row.get('cbp238160_emp'))) if num(row.get('cbp238160_emp')) is not None else None
    c['cbp_sup'] = int(num(row.get('cbp423330_est'))) if num(row.get('cbp423330_est')) is not None else None
    c['nes2381'] = int(num(row.get('nes2381_estab'))) if num(row.get('nes2381_estab')) is not None else None
    c['nes2381_rcpt'] = int(num(row.get('nes2381_receipts_1000'))) if num(row.get('nes2381_receipts_1000')) is not None else None
state_biz = [r for r in cb.values() if not r['county_fips'].startswith('06') or len(r['county_fips']) != 5]
print('county biz state rows', [r['county_fips'] for r in state_biz])

# ---------- CSLB C-39
for d in zips:
    d['lic'] = 0
    d['lic_all'] = 0
for c in counties:
    c['lic_cnty'] = 0
    c['lic_cnty_all'] = 0
lic_rows = rd(os.path.join(DL, 'cslb', 'derived', 'c39_licences.csv'))
lic_meta = collections.Counter()
city_lic = collections.defaultdict(lambda: [0, 0, collections.Counter()])
lic_pts = collections.Counter()      # zip -> active licences (for distance sums, includes non-ZCTA zips later dropped)
for row in lic_rows:
    act = row['PrimaryStatus'].strip().upper() == 'CLEAR'
    lic_meta['n'] += 1
    lic_meta['clear'] += act
    lic_meta['susp'] += (not act)
    lic_meta['only'] += row['_only'] == '1'
    if row['State'].strip().upper() != 'CA':
        lic_meta['out'] += 1
        continue
    lic_meta['inca'] += 1
    z = row['ZIPCode'].strip()[:5]
    d = ZI.get(z)
    if d is not None:
        d['lic_all'] += 1
        d['lic'] += act
    else:
        lic_meta['zip_not_in_rows'] += 1
    ci = CN.get(row['County'].strip().upper())
    if ci is not None:
        counties[ci]['lic_cnty_all'] += 1
        counties[ci]['lic_cnty'] += act
    cl = city_lic[titlecase(row['City'])]
    cl[1] += 1
    cl[0] += act
    if ci is not None:
        cl[2][ci] += 1
print('cslb', dict(lic_meta))
lic_city = sorted(([k, (v[2].most_common(1)[0][0] if v[2] else None), v[0], v[1]] for k, v in city_lic.items()), key=lambda a: -a[2])
lic_top = [[a[0], a[2]] for a in lic_city[:25]]

# ---------- insurance
INS_COLS = ['fair_pif', 'fair_pif22', 'fair_x', 'fair_sh', 'fair_tiv', 'fair_com', 'fair_hi', 'fair_own', 'fair_dist', 'fair22_sh',
            'ins_pol', 'nonren', 'nonren_sh', 'nonren4', 'insnr_sh', 'wf_hi_sh', 'wf_score', 'wf_claims', 'wf_loss', 'prem', 'cova']
for d in zips:
    for k in INS_COLS:
        d[k] = None
    for k in ('fair_pif', 'fair_pif22', 'fair_com', 'fair_hi', 'fair_own', 'fair_dist', 'nonren', 'nonren4', 'wf_claims', 'wf_loss', 'ins_pol', 'fair_tiv'):
        d[k] = 0
YRS5 = [2022, 2023, 2024, 2025, 2026]


def blank_ins():
    return {'fair_pif': [0] * 5, 'fair_tiv': [0.0] * 5, 'fair_com': 0, 'fair_hi': 0, 'fair_own': 0, 'fair_dist_zips': 0,
            'ins_pol': collections.Counter(), 'nonren': collections.Counter(), 'renewed': collections.Counter(),
            'insnr': collections.Counter(), 'wf_claims': 0, 'wf_loss': 0.0, 'wf_hi': 0.0, 'wf_rated': 0.0}


ins_c = {c['fips']: blank_ins() for c in counties}
ins_s = blank_ins()
ins_unmatched = collections.Counter()


def cty_of(name, z=None):
    ci = CN.get((name or '').strip().upper())
    if ci is None and z in ZI:
        ci = ZI[z]['pi']
    return ci


# FAIR Plan 5 year files: county field is not in the ZIP file, so use the category file's county, then the ZIP row's county
fp_cty = {}
for row in rd(os.path.join(DL, 'insurance', 'derived', 'fairplan_zip_category_dwe_20260930.csv')):
    z = row['zip']
    fp_cty[z] = row['county']
    hi = sum(int(n0(row[k])) for k in row if k.startswith('high_'))
    own = sum(int(n0(row[k])) for k in ('low_owner_sfr', 'med_owner_sfr', 'high_owner_sfr'))
    ci = cty_of(row['county'], z)
    for blk in ([ins_c[counties[ci]['fips']]] if ci is not None else []) + [ins_s]:
        blk['fair_hi'] += hi
        blk['fair_own'] += own
        blk['fair_dist_zips'] += int(row['distressed'] == '1')
    if z in ZI:
        ZI[z]['fair_hi'] = hi
        ZI[z]['fair_own'] = own
        ZI[z]['fair_dist'] = int(row['distressed'] == '1')
for row in rd(os.path.join(DL, 'insurance', 'derived', 'fairplan_zip_5yr.csv')):
    z = row['zip']
    if not z.isdigit():
        continue
    ci = cty_of(fp_cty.get(z), z)
    pif = [int(n0(row['pif_%d' % y])) for y in YRS5]
    tiv = [n0(row['tiv_%d' % y]) / 1e6 for y in YRS5]
    blks = ([ins_c[counties[ci]['fips']]] if ci is not None else []) + [ins_s]
    if ci is None:
        ins_unmatched['fair zip without county: ' + row['line']] += pif[-1]
    if row['line'] == 'DWE':
        for b in blks:
            for i in range(5):
                b['fair_pif'][i] += pif[i]
                b['fair_tiv'][i] += tiv[i]
        if z in ZI:
            d = ZI[z]
            d['fair_pif'], d['fair_pif22'], d['fair_tiv'] = pif[4], pif[0], round(tiv[4], 1)
        else:
            ins_unmatched['fair DWE policies in ZIPs not in rows'] += pif[4]
    elif row['line'] == 'COM':
        for b in blks:
            b['fair_com'] += pif[4]
        if z in ZI:
            ZI[z]['fair_com'] = pif[4]
for d in zips:
    d['fair_x'] = round(d['fair_pif'] / d['fair_pif22'], 2) if d['fair_pif22'] >= 10 else None
    d['fair_sh'] = min(100.0, round(100.0 * d['fair_pif'] / d['hu'], 1)) if d['hu'] > 0 else None
for row in rd(os.path.join(DL, 'insurance', 'derived', 'cdi_fair_vs_voluntary_zip_2022.csv')):
    if row['zip'] in ZI:
        ZI[row['zip']]['fair22_sh'] = num(row['pct_fair_plan'])
# non-renewals
ren23 = {}
for row in rd(os.path.join(DL, 'insurance', 'derived', 'cdi_new_renew_nonrenew_zip_2020_2023.csv')):
    z, y = row['ZIP Code'].strip(), int(row['Year'])
    new, ren, non = int(n0(row['New'])), int(n0(row['Renewed'])), int(n0(row['Non-Renewed']))
    ci = cty_of(row['County'], z)
    for b in ([ins_c[counties[ci]['fips']]] if ci is not None else []) + [ins_s]:
        b['ins_pol'][y] += new + ren
        b['nonren'][y] += non
        b['renewed'][y] += ren
    if z in ZI:
        d = ZI[z]
        d['nonren4'] += non
        if y == 2023:
            d['ins_pol'], d['nonren'] = new + ren, non
            d['nonren_sh'] = pct(non, ren + non)
    elif y == 2023:
        ins_unmatched['2023 non-renewals in ZIPs not in rows'] += non
for row in rd(os.path.join(DL, 'insurance', 'derived', 'cdi_new_renew_nonrenew_zip_2015_2021.csv')):
    z, y = row['ZIP Code'].strip(), int(row['Year'])
    ren = int(n0(row['Renewed']))
    a, b_ = int(n0(row['Insured-Initiated Nonrenewed'])), int(n0(row['Insurer-Initiated Nonrenewed']))
    ci = cty_of(row['County'], z)
    for b in ([ins_c[counties[ci]['fips']]] if ci is not None else []) + [ins_s]:
        b['insnr'][y] += b_
        if y < 2020:
            b['nonren'][y] += a + b_
            b['renewed'][y] += ren
    if z in ZI and y == 2021:
        ZI[z]['insnr_sh'] = pct(b_, ren + a + b_)
# wildfire risk report
with open(os.path.join(DL, 'insurance', 'derived', 'cdi_wildfire_risk_records.csv'), newline='', encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        z = row['ZIP Code'].strip()
        yr = int(row['Calendar Year'])
        src, pt = row['Source'], row['Policy Type']
        ci = cty_of(row['County'], z)
        blks = ([ins_c[counties[ci]['fips']]] if ci is not None else []) + [ins_s]
        d = ZI.get(z)
        if src == 'All Companies':
            cnt = sum(n0(row[k]) for k in row if k.endswith('Count') and ('Fire' in k or 'Smoke' in k))
            loss = sum(n0(row[k]) for k in row if k.endswith('Losses'))
            for b in blks:
                b['wf_claims'] += cnt
                b['wf_loss'] += loss / 1000.0
            if d is not None:
                d['wf_claims'] += cnt
                d['wf_loss'] += loss / 1000.0
                if pt == 'HO' and yr == 23:
                    exp = n0(row['Earned Exp'])
                    d['prem'] = round(n0(row['Earned Prem']) / exp) if exp >= 10 else None
                    d['cova'] = round(n0(row['Avg Cov A  '])) if exp >= 10 else None
        elif src == 'Fire Risk Scores' and pt == 'HO' and yr == 23:
            cn = [n0(row['Count ' + k]) for k in 'NLMHE']
            tot = sum(cn)
            for b in blks:
                b['wf_hi'] += cn[3] + cn[4]
                b['wf_rated'] += tot
            if d is not None:
                d['wf_hi_n'] = cn[3] + cn[4]
                d['wf_hi_sh'] = pct(cn[3] + cn[4], tot) if tot >= 10 else None
                d['wf_score'] = num(row['Avg Fire Risk'])
for d in zips:
    d['wf_claims'] = int(round(d['wf_claims']))
    d['wf_loss'] = round(d['wf_loss'])
    d.setdefault('wf_hi_n', 0)
print('insurance unmatched', dict(ins_unmatched))
print('FAIR residential by year', ins_s['fair_pif'], 'tiv $M', [round(x) for x in ins_s['fair_tiv']])
fpc = {}
for row in rd(os.path.join(DL, 'insurance', 'derived', 'fairplan_county_5yr.csv')):
    ci = CN.get(row['county'].strip().upper())
    if ci is not None:
        fpc[counties[ci]['fips']] = [int(n0(row['pif_%d' % y])) for y in YRS5]


def fin_ins(b, hu):
    y1 = sorted(set(b['nonren']) | set(b['renewed']))
    o = {'fair_pif': b['fair_pif'], 'fair_tiv': [round(x, 1) for x in b['fair_tiv']], 'fair_com': b['fair_com'],
         'fair_hi': b['fair_hi'], 'fair_own': b['fair_own'], 'fair_dist_zips': b['fair_dist_zips'],
         'ins_pol': {str(y): b['ins_pol'][y] for y in sorted(b['ins_pol'])},
         'nonren': {str(y): b['nonren'][y] for y in y1}, 'renewed': {str(y): b['renewed'][y] for y in y1},
         'insnr': {str(y): b['insnr'][y] for y in sorted(b['insnr'])},
         'wf_claims': int(round(b['wf_claims'])), 'wf_loss': round(b['wf_loss']), 'wf_hi_sh': pct(b['wf_hi'], b['wf_rated']),
         'hu': hu}
    return o


ins = {'years': YRS5, 'state': fin_ins(ins_s, state['hu']), 'county': {}, 'region': {}}
for c in counties:
    ins['county'][c['fips']] = fin_ins(ins_c[c['fips']], c['hu'])
    ins['county'][c['fips']]['fair_all'] = fpc.get(c['fips'])
for rg in REG:
    b = blank_ins()
    hu = 0
    for c in counties:
        if c['reg'] != rg:
            continue
        s = ins_c[c['fips']]
        hu += c['hu']
        for k in ('fair_pif', 'fair_tiv'):
            b[k] = [a + x for a, x in zip(b[k], s[k])]
        for k in ('fair_com', 'fair_hi', 'fair_own', 'fair_dist_zips', 'wf_claims', 'wf_loss', 'wf_hi', 'wf_rated'):
            b[k] += s[k]
        for k in ('ins_pol', 'nonren', 'renewed', 'insnr'):
            b[k].update(s[k])
    ins['region'][str(rg)] = fin_ins(b, hu)

# ---------- FEMA
KIND = {'Fire': 'fire', 'Severe Storm': 'storm', 'Flood': 'storm', 'Winter Storm': 'storm', 'Earthquake': 'quake', 'Biological': 'other'}
LABEL = {'1498': 'Cedar and Old fires', '1505': 'San Simeon earthquake', '1577': 'Winter storms 2005', '1628': 'Winter storms 2006',
         '1731': 'October 2007 fires', '1810': 'November 2008 fires', '4193': 'Napa earthquake', '4240': 'Valley and Butte fires',
         '4344': 'North Bay fires', '4353': 'Thomas fire and mudflows', '4382': 'Carr fire', '4407': 'Camp and Woolsey fires',
         '4482': 'COVID-19', '4558': 'August 2020 fires', '4569': 'Autumn 2020 fires', '4610': 'Dixie and 2021 fires',
         '4683': 'Winter storms January 2023', '4699': 'Winter storms March 2023', '4707': 'Winter storms and mudslides 2023',
         '4758': 'San Diego storm January 2024', '4856': 'Los Angeles wildfires January 2025'}
dis = {}
for row in rd(os.path.join(DL, 'fema', 'derived', 'ihp_ca_by_disaster.csv')):
    dr = row['disasterNumber']
    yr = int(row['declarationDate'][:4])
    kind = KIND.get(row['incidentType'], 'other')
    if dr in ('4856',):
        kind = 'fire'
    roofera = yr <= 2018
    k = int(n0(row['roof_n'])) if roofera else int(n0(row['rpfvl_noflood_n']))
    if kind == 'other':
        k = 0
    dis[dr] = {'dr': dr, 'type': row['declarationType'], 'date': row['declarationDate'], 'year': yr, 'kind': kind,
               'label': LABEL.get(dr, row['title'].title()), 'title': row['title'], 'regs': int(n0(row['regs'])),
               'owners': int(n0(row['owners'])), 'renters': int(n0(row['renters'])), 'insured': int(n0(row['insured'])),
               'roof_n': int(n0(row['roof_n'])), 'rpfvl_noflood': int(n0(row['rpfvl_noflood_n'])),
               'destroyed': int(n0(row['destroyed_n'])), 'k': k, 'roofera': roofera, 'nzip': 0, 'k_rows': 0}
FCOLS = ['fema_k', 'fema_20', 'fema_fire', 'fema_storm', 'fema_quake', 'fema_dest', 'fema_reg', 'fema_la25', 'fema_w23']
for d in zips:
    for k in FCOLS:
        d[k] = 0
    d['fema_by'] = {}
for c in counties:
    c['fema'] = {}
    c['fema_all'] = {}
    c['fema_reg'] = 0
    c['fema_dest'] = 0
fema_out = collections.Counter()
for row in rd(os.path.join(DL, 'fema', 'derived', 'ihp_ca_by_zip_disaster.csv')):
    dr = row['disasterNumber']
    D = dis.get(dr)
    if D is None or D['kind'] == 'other':
        continue
    z = row['zip'].strip()[:5]
    k = int(n0(row['roof_n'])) if D['roofera'] else int(n0(row['rpfvl_noflood_n']))
    regs = int(n0(row['regs']))
    dest = int(n0(row['destroyed_n']))
    d = ZI.get(z)
    if d is None:
        fema_out['regs in ZIPs not in rows'] += regs
        fema_out['k in ZIPs not in rows'] += k
        continue
    D['nzip'] += 1
    D['k_rows'] += k
    d['fema_k'] += k
    d['fema_reg'] += regs
    d['fema_dest'] += dest
    if D['year'] >= 2020:
        d['fema_20'] += k
    d['fema_' + D['kind']] += k
    if dr == '4856':
        d['fema_la25'] += regs
    if dr in ('4683', '4699', '4707'):
        d['fema_w23'] += k
    if k:
        d['fema_by'][dr] = d['fema_by'].get(dr, 0) + k
    c = counties[d['pi']]
    if k:
        c['fema'][dr] = c['fema'].get(dr, 0) + k
    c['fema_all'][dr] = c['fema_all'].get(dr, 0) + regs
    c['fema_reg'] += regs
    c['fema_dest'] += dest
for d in zips:
    d['fema_rate'] = round(100.0 * d['fema_k'] / d['occ'], 1) if d['occ'] > 0 else None
for c in counties:
    c['fema_k'] = sum(c['fema'].values())
print('fema', dict(fema_out), 'k total', sum(d['fema_k'] for d in zips))

# ---------- building permits (Census BPS, county)
bps = {c['fips']: {} for c in counties}
ytd = {c['fips']: {} for c in counties}
PDIR = os.path.join(DL, 'permits', 'raw', 'ca')
for fn in sorted(os.listdir(PDIR)):
    m = re.match(r'ca_co(\d{4})([ay])\.txt', fn)
    if not m:
        continue
    with open(os.path.join(PDIR, fn)) as f:
        rows = list(csv.reader(f))
    for c in rows:
        if len(c) < 18 or c[1].strip() != '06':
            continue
        fips = '06' + c[2].strip()
        if fips not in bps:
            continue
        v = [int(n0(x)) for x in c[6:18]]
        b1, u1, b2, u2, b3, u3, b5, u5 = v[0], v[1], v[3], v[4], v[6], v[7], v[9], v[10]
        rec = [u1, u1 + u2 + u3 + u5, b1 + b2 + b3 + b5]
        if m.group(2) == 'a':
            bps[fips][m.group(1)] = rec
        else:
            ytd[fips]['20' + m.group(1)[:2]] = rec[1]
for c in counties:
    c['bps'] = {y: bps[c['fips']][y] for y in sorted(bps[c['fips']]) if 2005 <= int(y) <= 2025}
    c['ytd26'] = ytd[c['fips']].get('2026')
    c['ytd25'] = ytd[c['fips']].get('2025')
permits = {}
for y in range(2005, 2026):
    permits[str(y)] = [sum(c['bps'].get(str(y), [0, 0, 0])[i] for c in counties) for i in range(3)]
print('permits 2025', permits['2025'], 'ytd26', sum(c['ytd26'] or 0 for c in counties), 'ytd25', sum(c['ytd25'] or 0 for c in counties))

# ---------- places
pg = {}
with open(os.path.join(DL, 'geo', 'raw', 'gazetteer', '2024_gaz_place_06.txt')) as f:
    hd = [h.strip() for h in f.readline().split('\t')]
    for line in f:
        c = dict(zip(hd, [x.strip() for x in line.split('\t')]))
        pg[c['GEOID']] = c
places_all = []
for row in rd(os.path.join(DL, 'acs', 'derived', 'ca_place_acs_columns.csv')):
    gz = pg.get(row['geoid'])
    if not gz:
        continue
    nm = row['name'].replace(', California', '')
    cdp = nm.endswith(' CDP')
    nm = re.sub(r' (city|CDP|town)$', '', nm)
    nm = re.sub(r' \(.*\)$', '', nm)
    if nm == 'San Buenaventura':
        nm = 'Ventura'
    places_all.append({'name': nm, 'lat': round(float(gz['INTPTLAT']), 4), 'lon': round(float(gz['INTPTLONG']), 4),
                       'pop': int(n0(row['pop'])), 'cdp': cdp, 'geoid': row['geoid']})

base = {'zips': zips, 'counties': counties, 'state': state, 'ins': ins, 'fema': sorted(dis.values(), key=lambda a: a['date']),
        'lic_city': lic_city, 'lic_meta': dict(lic_meta), 'lic_top': lic_top, 'permits': permits,
        'ytd26': sum(c['ytd26'] or 0 for c in counties), 'ytd25': sum(c['ytd25'] or 0 for c in counties),
        'places_all': places_all, 'gid_file': gt_file and os.path.basename(gt_file),
        'notes': {'zip_skipped': dict(skipped), 'biz_out': dict(biz_out), 'ins_unmatched': dict(ins_unmatched),
                  'fema_out': dict(fema_out)},
        'cbp_state': {}}
# state roofing business block (County Business Patterns 2023 state file, Nonemployer 2024)
for row in rd(os.path.join(DL, 'biz', 'raw', 'ca', 'cbp23st_CA.csv')):
    lfo = row.get('lfo', '-')
    if row.get('naics') == '238160' and lfo == '-':
        base['cbp_state'].update(est=int(n0(row['est'])), emp=int(n0(row['emp'])), ap=int(n0(row['ap'])))
    if row.get('naics') == '423330' and lfo == '-':
        base['cbp_state'].update(sup_est=int(n0(row['est'])), sup_emp=int(n0(row['emp'])))
for row in rd(os.path.join(DL, 'biz', 'raw', 'ca', 'nonemp24st_CA.csv')):
    keys = {k.upper(): k for k in row}
    if row[keys['NAICS']].strip() == '2381' and row.get(keys.get('LFO', ''), '-').strip() in ('-', ''):
        base['nes_state'] = {'est2381': int(n0(row[keys['ESTAB']])), 'rcpt2381': int(n0(row[keys['RCPTOT']]))}
print('cbp', base['cbp_state'], base.get('nes_state'))
save('base.json', base)
