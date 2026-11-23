#!/usr/bin/env python3
"""Step 6. Assemble window.__ATLAS_DATA__ for California and merge the hazard job's outputs.
Reads work/*.json (steps 1 to 5) and hazard/out/* if present. Writes out/ca_atlas_data.json (compact JSON)
and out/ca_zip_index.json (ZIP row order and county order, for the hazard job's pts indexes).
Usage: python3 -I 06_assemble.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import collections

base, roof, lines, geo = load('base.json'), load('roof.json'), load('lines.json'), load('geo.json')
haz = load('haz.json')
Z, C = base['zips'], base['counties']
RR, LR = roof['rows'], lines['rows']
COMPILED = '2026-11-19'

# ------------------------------------------------------------------ hazard columns
HZ_DROP = {'zip', 'zcta', 'fips', 'county', 'reg', 'aland', 'in_ca', 'ilat', 'ilon', 'po_name', 'city', 'pi', 'pop', 'hu', 'sqmi'}
HZ_RENAME = {'lat': 'tlat', 'lon': 'tlon'}        # the hazard job's town point, beside this build's Census internal point
HZ_WINS = {'fire_dest', 'fire_dmg', 'lastfire', 'yrsfire'}
final_haz = haz['src'] == 'hazard job'
decl = set(haz.get('declared') or [])
if final_haz:
    hz_src_cols = [c for c in haz['cols'] if c not in HZ_DROP]
else:
    # interim: scalar columns of the hazard job's work tables whose names its schema declares
    hz_src_cols = [c for c in haz['cols'] if c in decl and c not in HZ_DROP]
    order = {c: i for i, c in enumerate(haz.get('declared') or [])}
scal = set()
for v in haz['by_zip'].values():
    for k, x in v.items():
        if not isinstance(x, (list, dict)):
            scal.add(k)
hz_src_cols = [c for c in hz_src_cols if c in scal]
for v in haz['by_zip'].values():
    for a_, b_ in HZ_RENAME.items():
        if a_ in v:
            v[b_] = v.pop(a_)
hz_cols = [HZ_RENAME.get(c, c) for c in hz_src_cols]

# ------------------------------------------------------------------ ZIP columns, in order
A_ID = ['zip', 'city', 'pi', 'reg', 'lat', 'lon', 'sqmi', 'wsqmi', 'gid', 'place', 'ncty', 'cz']
B_PEOPLE = ['pop', 'hh', 'inc', 'value', 'own_sh', 'sfd_sh', 'mf5_sh', 'span_sh', 'span_lep_sh', 'viet_sh', 'chin_sh', 'tagalog_sh',
            'korean_sh', 'arabic_sh', 'slavic_sh', 'oie_sh', 'chin_lep_sh', 'viet_lep_sh', 'korean_lep_sh', 'tagalog_lep_sh', 'lep_sh',
            'lang2', 'anc_arm', 'anc_iran', 'hisp_sh', 'asian_sh', 'hh100k_sh', 'hh200k_sh', 's65_sh', 'age_med', 'density']
C_HOMES = ['hu', 'occ', 'vac_sh', 'seas', 'u1', 'u1a', 'mh', 'mh_sh', 'mf24', 'mf5u', 'mf5_9', 'mf10_19', 'mf20_49', 'mf50', 'mfb',
           'yb_med', 'rooms', 'mort_sh', 'pre80_sh', 'yb20', 'yb10', 'yb00', 'yb90', 'yb80', 'yb70', 'yb60', 'yb50', 'yb40', 'ybold',
           'o20', 'o10', 'o00', 'o90', 'o80', 'o70', 'o60', 'o50', 'o40', 'oold', 'rent1', 'val1m_sh', 'hhsize', 'moved10_sh', 'own_yr']
D_ROOF = ['roofs', 'ra_med', 'ra15', 'ra20', 'ra15_sh', 'ra20_sh', 'ra25', 'ra25_sh', 'wave', 'nxt', 'nxt_t', 'tile_sh', 'tile_n',
          'tile25', 'wood_sh', 'metal_sh', 'solar_n', 'solar_sh', 'solar_src', 'solar_new', 'solar_batt',
          'lastfire', 'yrsfire', 'fire_dest', 'fire_dmg'] + ([] if 'fire_dest_res' in hz_cols else ['fire_res']) + ['fire_nxt']
F_FEMA = ['fema_k', 'fema_20', 'fema_rate', 'fema_fire', 'fema_storm', 'fema_quake', 'fema_dest', 'fema_reg', 'fema_la25', 'fema_w23']
H_BIZ = ['est', 'retail', 'food', 'lodging', 'whse', 'mfg', 'church', 'health', 'school', 'apts', 'nonres', 'office', 'auto', 'roofers',
         'builders', 'supply', 'ins_agents', 'adjusters', 'solar_co', 'pm', 'cru', 'lic', 'lic_all']
I_INS = ['fair_pif', 'fair_pif22', 'fair_x', 'fair_sh', 'fair_tiv', 'fair_com', 'fair_hi', 'fair_own', 'fair_dist', 'fair22_sh',
         'ins_pol', 'nonren', 'nonren_sh', 'nonren4', 'insnr_sh', 'wf_hi_sh', 'wf_score', 'wf_claims', 'wf_loss', 'prem', 'cova']
J_LINES = (['p_' + k for k in LINES] + ['r_' + k for k in LINES] + ['z_' + k for k in LINES] + ['f_' + k for k in LINES]
           + ['idx', 'idx_eq', 'fees', 'cases', 'gi', 'gicls', 'comp_mass', 'comp_n25', 'roof_mass', 'roof_per10k', 'comp_pct', 'cpc_rel',
              'eff', 'effb', 'oppb', 'quad', 'tier', 'bid', 'res_ok', 'storm_x'])
mine = A_ID + B_PEOPLE + C_HOMES + D_ROOF + F_FEMA + H_BIZ + I_INS + J_LINES
E_HAZ = [c for c in hz_cols if c not in mine or c in HZ_WINS]
skipped_haz = [c for c in hz_cols if c in mine and c not in HZ_WINS]
zcols = A_ID + B_PEOPLE + C_HOMES + D_ROOF + [c for c in E_HAZ if c not in mine] + F_FEMA + H_BIZ + I_INS + J_LINES
assert len(set(zcols)) == len(zcols)


def tidy(v):
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        if v == int(v) and abs(v) < 1e15:
            return int(v)
    return v


# Title 24 building climate zone by ZIP code (1 to 16): California Energy Commission, "Building Climate Zones by ZIP
# Code" (Energy Code Reference Joint Appendix JA2), the copy the topography job downloaded 2026-11-19
# (CA/scout/topo/dl/cec/zip.xlsx, kept here as dl/cec/zip.xlsx). Null where the Commission's list has no row for the ZIP.
import zipfile, re
CZ = {}
_x = zipfile.ZipFile(os.path.join(HERE, 'dl', 'cec', 'zip.xlsx')).read('xl/worksheets/sheet1.xml').decode()
for _row in re.findall(r'<row[^>]*>(.*?)</row>', _x, re.S)[1:]:
    _d = dict(re.findall(r'<c r="([A-Z]+)\d+"[^>]*>(?:<v>(.*?)</v>)?', _row))
    try:
        _zp, _zn = int(float(_d['A'])), int(float(_d['B']))
    except (KeyError, ValueError):
        continue
    if 90000 <= _zp <= 96999 and 1 <= _zn <= 16:
        CZ['%05d' % _zp] = _zn

zobj = []
for d in Z:
    z = d['zip']
    o = dict(d)
    o['cz'] = CZ.get(z)
    o.update(RR[z])
    o.update(LR[z])
    h = haz['by_zip'].get(z, {})
    for c in E_HAZ:
        v = h.get(c)
        if c in HZ_WINS and v is None:
            continue
        o[c] = v if not isinstance(v, (list, dict)) else None
    o['yrsfire'] = (NOW - o['lastfire']) if o.get('lastfire') else None
    zobj.append(o)
zrows = [[tidy(o.get(c)) for c in zcols] for o in zobj]
ZI = {o['zip']: i for i, o in enumerate(zobj)}

# ------------------------------------------------------------------ counties ("parishes")
SUMS = ['roofs', 'ra15', 'ra20', 'ra25', 'wave', 'nxt', 'nxt_t', 'tile_n', 'tile25', 'est', 'roofers', 'lic', 'lic_all', 'cru', 'supply',
        'adjusters', 'ins_agents', 'fees', 'fire_dest', 'fire_dmg', 'solar_n'] + ['p_' + k for k in LINES]
KEEP = ['fips', 'name', 'reg', 'seat', 'lat', 'lon', 'aland', 'awater', 'pop', 'hh', 'inc', 'value', 'own', 'spanish', 'viet', 'chin',
        'tagalog', 'korean', 'arabic', 'pop5', 'a65p', 'hu', 'occ', 'rent', 'mh', 'u1', 'mf5u', 'seas', 'yb', 'yb_med', 'mort_sh', 'rooms',
        'fema', 'fema_k', 'fema_all', 'fema_reg', 'fema_dest', 'bps', 'ytd26', 'ytd25', 'cbp_roof', 'cbp_roof_emp', 'cbp_sup', 'nes2381',
        'nes2381_rcpt', 'lic_cnty', 'lic_cnty_all']
by_c = collections.defaultdict(list)
for o in zobj:
    by_c[o['pi']].append(o)
num_haz = [c for c in E_HAZ if any(isinstance(o.get(c), (int, float)) for o in zobj)]
parishes = []
for i, c in enumerate(C):
    p = {k: tidy(c.get(k)) for k in KEEP}
    p['yb'] = [tidy(v) for v in c['yb']]
    zs = by_c[i]
    p['nzip'] = len(zs)
    for k in SUMS:
        s = sum((o.get(k) or 0) for o in zs)
        p[k] = tidy(round(s, 1 if k in ('nxt', 'nxt_t', 'cru') else 2 if k.startswith('p_') else 0))
    hist = {}
    for y in range(2000, NOW + 1):
        j = y - 2000
        hist[str(y)] = [round(sum(o['rhist'][j][0] for o in zs)), round(sum(o['rhist'][j][1] for o in zs))]
    p['hist'] = hist
    ic = base['ins']['county'][c['fips']]
    p['fair_pif'], p['fair_pif22'] = ic['fair_pif'][4], ic['fair_pif'][0]
    p['fair_tiv'] = ic['fair_tiv'][4]
    p['fair_all'] = ic.get('fair_all')
    p['ins_pol'] = ic['ins_pol'].get('2023')
    p['nonren'] = ic['nonren'].get('2023')
    p['nonren_sh'] = pct(ic['nonren'].get('2023', 0), ic['nonren'].get('2023', 0) + ic['renewed'].get('2023', 0))
    p['nonren4'] = sum(ic['nonren'].get(str(y), 0) for y in range(2020, 2024))
    p['wf_claims'], p['wf_loss'], p['wf_hi_sh'] = ic['wf_claims'], ic['wf_loss'], ic['wf_hi_sh']
    lf = [o['lastfire'] for o in zs if o.get('lastfire')]
    p['lastfire'] = max(lf) if lf else None
    hzm = {}
    for hc in num_haz:
        w = [(o['pop'], o[hc]) for o in zs if isinstance(o.get(hc), (int, float)) and o['pop'] > 0]
        if w:
            hzm[hc] = round(sum(a * b for a, b in w) / sum(a for a, _ in w), 2)
    p['hz'] = hzm
    p['comp'] = 0
    parishes.append(p)

# ------------------------------------------------------------------ cities (postal cities of 1,500 residents or more)
groups = collections.defaultdict(list)
for o in zobj:
    groups[o['city']].append(o)
lic_pts = [(o['lat'], o['lon'], o['lic']) for o in zobj if o['lic']]
cities = []
for name, zs in groups.items():
    pop = sum(o['pop'] for o in zs)
    if pop < 1500:
        continue
    cp = collections.Counter()
    for o in zs:
        cp[o['pi']] += o['pop']
    lat = sum(o['lat'] * o['pop'] for o in zs) / pop
    lon = sum(o['lon'] * o['pop'] for o in zs) / pop
    sp = lambda k: int(round(sum((o.get(k + '_sh') or 0) / 100.0 * o['pop5'] for o in zs)))
    ct = {'name': name, 'pi': cp.most_common(1)[0][0], 'pop': pop, 'nzip': len(zs), 'zips': sorted(o['zip'] for o in zs),
          'lat': round(lat, 4), 'lon': round(lon, 4), 'fees': int(sum(o['fees'] for o in zs)),
          'comp': int(sum(n for a, b, n in lic_pts if hav_km(lat, lon, a, b) <= 8)),
          'roofers': int(sum(o['roofers'] for o in zs)), 'lic': int(sum(o['lic'] for o in zs)),
          'span': sp('span'), 'viet': sp('viet'), 'chin': sp('chin'), 'tagalog': sp('tagalog'), 'korean': sp('korean'),
          'hu': int(sum(o['hu'] for o in zs)), 'roofs': int(sum(o['roofs'] for o in zs)), 'ra20': int(sum(o['ra20'] for o in zs)),
          'tile_n': int(sum(o['tile_n'] for o in zs)), 'fair_pif': int(sum(o['fair_pif'] for o in zs)),
          'nonren': int(sum(o['nonren'] or 0 for o in zs))}
    for k in LINES:
        ct['p_' + k] = round(sum(o['p_' + k] for o in zs), 2)
    cities.append(ct)
cities.sort(key=lambda c: -c['pop'])

# ------------------------------------------------------------------ places (map labels)
zpts = [(o['lat'], o['lon'], o['pi']) for o in zobj]


def near_pi(lat, lon):
    return min(zpts, key=lambda t: (t[0] - lat) ** 2 + ((t[1] - lon) * 0.8) ** 2)[2]


places = []
seat_of = {}       # place geoid -> county index: the place carrying the seat's name nearest the county's label point
for ci, c in enumerate(C):
    cand = [p for p in base['places_all'] if p['name'] == SEATS[c['name']]]
    if cand:
        best = min(cand, key=lambda p: hav_km(c['lat'], c['lon'], p['lat'], p['lon']))
        if hav_km(c['lat'], c['lon'], best['lat'], best['lon']) < 150:
            seat_of[best['geoid']] = ci
for p in base['places_all']:
    seat = p['geoid'] in seat_of
    pi_ = seat_of[p['geoid']] if seat else near_pi(p['lat'], p['lon'])
    if p['pop'] >= 10000 or seat:
        places.append({'name': p['name'], 'lat': p['lat'], 'lon': p['lon'], 'pop': p['pop'], 'cdp': p['cdp'], 'seat': seat, 'pi': pi_})
missing_seats = sorted(c['name'] for ci, c in enumerate(C) if ci not in seat_of.values())
places.sort(key=lambda p: -p['pop'])

# ------------------------------------------------------------------ named companies (evidence only)
SRC_RC = 'Roofing Contractor magazine, "The Top 100 Roofing Contractors by Region" (2025), as quoted in roofing_law_evidence.md D5'
SRC_CSLB = 'CSLB License Master file, November 2026 (C-39 on the licence)'


def office(city, z, hq=True):
    o = zobj[ZI[z]]
    return {'city': city, 'lat': o['lat'], 'lon': o['lon'], 'hq': hq, 'zip': z}


def co(name, hq, tier, seg, lines_, offices, lic_no, src, notes):
    return {'name': name, 'domain': None, 'url': None, 'hq': hq, 'tier': tier, 'seg': seg, 'lines': lines_, 'verified': False,
            'asof': COMPILED, 'cities': [o['city'] for o in offices], 'phone': None, 'title': None, 'desc': None, 'h1': None,
            'social': [], 'spanish': False, 'fin': False, 'cert': [], 'notes': notes, 'offices': offices, 'lic_no': lic_no, 'src': src}


comp = [
    co('Best Contracting Services', 'Gardena', 'regional', 'comm', ['comm'], [office('Gardena', '90248')], '456263',
       SRC_RC + '; ' + SRC_CSLB,
       'Named second among Pacific region firms on the 2025 list. Licence classes A, B, C-17, C-39, C-43. Its own site was not read.'),
    co('Kodiak Roofing and Waterproofing', 'Roseville', 'regional', 'comm', ['comm'], [office('Roseville', '95678')], '732770',
       SRC_RC + '; ' + SRC_CSLB,
       'Dwayne Nash Industries doing business as Kodiak Roofing and Waterproofing: "the commercial roofing company out of California was #28 on the national list" (2025). Its own site was not read.'),
    co('Flynn Group of Companies', None, 'national', 'comm', [], [], None, SRC_RC,
       'Led the Pacific region on the 2025 list by United States revenue. No C-39 licence under this name is in the CSLB file, so no California office is mapped.'),
    co('Tecta America (California licensees)', None, 'national', 'comm', [],
       [office('Santa Ana', '92705', False), office('Rancho Cordova', '95742', False), office('Van Nuys', '91405', False)],
       '811111, 864500, 1114949', SRC_CSLB,
       'Three C-39 licences on the active roll carry the name: Tecta America Southern California Inc (Santa Ana), Tecta America Sacramento Inc (Rancho Cordova), Eberhard a Tecta America Company LLC (Van Nuys). Offices are the licence mailing ZIPs. No ranking was verified.'),
]
for c in comp:
    for o in c['offices']:
        parishes[zobj[ZI[o['zip']]]['pi']]['comp'] += 1

# ------------------------------------------------------------------ time series
la = json.load(open(os.path.join(CA, 'la_atlas_data.json')))
fema_year = []
for d in base['fema']:
    if d['kind'] == 'other':
        continue
    fema_year.append([d['dr'], d['label'], d['year'], d['k_rows'], d['roofera'], d['owners'], d['insured'], d['kind'], d['regs']])
ts = {'month': {}, 'hour': {}, 'year': {}, 'fema_year': fema_year, 'replace_hist': roof['replace_hist'],
      'ppi': la['ts']['ppi'], 'permits': base['permits'], 'ytd26': base['ytd26'], 'ytd25': base['ytd25'],
      'agehist': roof['agehist'], 'agehist_t': roof['agehist_t']}
pts, ptflags, hz_obj, merged = [], [], None, []
hp = os.path.join(HAZ, 'hazard_ts.json')
if os.path.exists(hp):
    ht = json.load(open(hp))
    for k, v in ht.items():
        if k in ('fema_year', 'replace_hist', 'ppi', 'permits', 'ytd26', 'ytd25', 'agehist', 'agehist_t'):
            ts['hz_' + k] = v      # this build's series keep their names; the hazard job's copy is kept beside them
        else:
            ts[k] = v
    merged.append('hazard_ts.json')
# A second count of atmospheric river landfalls, beside the hazard job's `ar_wy`. `ar_wy` merges events at neighbouring
# coast points that overlap in time, so two rivers ashore at once on separate stretches of coast count as two (about 31
# a water year). The research tabulation (CA/dl/hazard/atmospheric_rivers/tabulate_cw3e_ar.py) merges every event on
# the California coast that overlaps in time, so it counts spells with a river ashore anywhere in the state (about 23
# a water year). Both are this atlas's tabulations of the CW3E catalogue, not counts CW3E publishes.
_ap = os.path.join(CA, 'dl', 'hazard', 'atmospheric_rivers', 'CW3E_AR_counts_by_coast_stretch_wateryear_scale.csv')
if os.path.exists(_ap):
    import csv as _csv
    ts['ar_wy_state'] = {r['water_year']: [int(r['AR%d' % k]) for k in range(1, 6)]
                         for r in _csv.DictReader(open(_ap, encoding='utf-8')) if r['stretch'].startswith('All California')}
hp = os.path.join(HAZ, 'hazard_pts.json')
extra_top = {}
if os.path.exists(hp):
    h = json.load(open(hp))
    pts, ptflags = h.get('pts', []), h.get('ptflags', [])
    their = h.get('zips')
    their_c = h.get('fips')
    if their or their_c:
        for r in pts:
            if their and isinstance(r[10], int) and r[10] >= 0:
                r[10] = ZI.get(their[r[10]], -1)
            if their_c and isinstance(r[9], int) and r[9] >= 0:
                r[9] = next((i for i, c in enumerate(C) if c['fips'] == their_c[r[9]]), -1)
    for r in pts:
        if isinstance(r[10], int) and r[10] >= len(zobj):
            r[10] = -1          # a row this build dropped after the hazard job indexed it (97635, the last row)
    for k, v in h.items():
        if k not in ('pts', 'ptflags', 'zips', 'fips', 'order'):
            extra_top[k] = v
    merged.append('hazard_pts.json')
hp = os.path.join(HAZ, 'hazard_events.json')
if os.path.exists(hp):
    hz_obj = json.load(open(hp))
    merged.append('hazard_events.json')
if final_haz:
    merged.append('zcta_hazard.json')

# ------------------------------------------------------------------ meta
st = base['state']
A = json.load(open(os.path.join(DL, 'ahs', 'derived', 'ahs2023_national_roofing.json')))
A21 = json.load(open(os.path.join(DL, 'ahs', 'derived', 'ahs2021_metro_roofing.json')))


def ahs_blk(d, year):
    return {'rate': d['rate'], 'diy': d['diy'], 'med': d['med'], 'mean': d['mean'], 'ins': d['ins'], 'leak': d['leak'],
            'n': d['owners_n'], 'jobs': d['roof_jobs_n'], 'year': year}


def akey(D, frag):
    ks = [k for k in D if frag.lower() in k.lower() and isinstance(D[k], dict) and 'rate' in D[k]]
    return D[ks[0]] if ks else None


pac = akey(A, 'pacific')
ahs = {'metros': {'la': ahs_blk(akey(A, 'Los Angeles'), 2023), 'sf': ahs_blk(akey(A, 'San Francisco'), 2023),
                  'riv': ahs_blk(akey(A, 'Riverside'), 2023), 'pool': ahs_blk(akey(A, 'pooled'), 2023),
                  'sj': ahs_blk(akey(A21, 'San Jose'), 2021)},
       'us': ahs_blk(A['whole file'], 2023), 'vint': roof['WB']['fit'],
       'w_mh_rate': 4.15, 'w_mh_diy': 46.0, 'w_mh_med': 7000}
if pac:
    ahs.update(pac_rate=pac['rate'], pac_diy=pac['diy'], pac_med=pac['med'], pac_mean=pac['mean'], pac_ins=pac['ins'], pac_leak=pac['leak'])
else:
    ahs.update(pac_rate=3.67, pac_diy=15.6, pac_med=13700, pac_mean=15591, pac_ins=3.5, pac_leak=5.25)
wst = akey(A, 'west region') or akey(A, 'West (')
if wst:
    ahs['west'] = ahs_blk(wst, 2023)
model = dict(lines['model'])
model['WB'] = roof['WB']
model['WBT'] = roof['WBT']
model['ROOF'] = roof['const']
model['MKT'] = {'1': 'Eureka', '2': 'Chico and Redding', '3': 'Sacramento, Stockton and Modesto', '4': 'Sacramento and Reno (split)',
                '5': 'San Francisco, Oakland and San Jose', '6': 'Monterey and Salinas; Santa Barbara, Santa Maria and San Luis Obispo',
                '7': 'Fresno and Visalia; Bakersfield; Sacramento, Stockton and Modesto (north end)', '8': 'Los Angeles',
                '9': 'Los Angeles', '10': 'Los Angeles; Palm Springs', '11': 'San Diego; Yuma and El Centro'}
ins_s = base['ins']['state']
lm = base['lic_meta']
ASSUME = [
    'Jobs open to marketing (REP) for every line: the model\'s original defaults carried over for the lines it already had; fire 0.60, harden 0.85, tile 0.84, solar 0.50 are new and chosen by judgment. No California measurement exists.',
    'Default tickets (VAL): replace $19,000 (22 squares, the Los Angeles permit median, at about $850 a square, inside the $600 to $900 guide range and above the AHS California metro mean of $15,204 because the survey mixes partial jobs); repair $1,350 (the model\'s original $950 raised by the AHS cost ratio); storm $7,500; fire $19,000; harden $24,000; tile relay $16,000 (no recorded price was found); solar detach and reset $4,500 (no evidence); metal $28,000 ($9 to $17 a square foot guide range); mobile home $7,000 (AHS West median); multifamily $40,000 (San Francisco apartment permits median $24,070; Los Angeles apartments 34 squares); commercial $75,000 (Los Angeles commercial median 50 squares); coatings $40,000 (the model\'s original figure, no California evidence); new construction $13,000.',
    'Gross margin 33% (the model\'s original default; the 2022 Economic Census shows materials at 34% and payroll at 26% of California roofing revenue).',
    'Regional click cost factors (DMA): Los Angeles and Ventura, Orange County and the Bay Area 1.00; San Diego and Imperial 0.90; Inland Empire 0.85; Sacramento Valley and Central Coast 0.80; San Joaquin Valley 0.65; North Coast and Sierra 0.60; Far North 0.55. No measured California click costs were available.',
    'Media market names per region (MKT) are typed from general knowledge by principal city, not from a Nielsen county list.',
    'Weibull shape 3 for both life curves (the model\'s original value). Tile underlayment mean life 27 years (two trade sources say about 25 and 20 to 30; owners defer).',
    'The calibration target is the AHS West region rate by year built less 9.5% paid by insurance, with California\'s tile shares by era; the West region is not California alone.',
    'Tile and wood shares by ZIP come from the statewide RECS 2020 shares by era built and a two way climate factor (hot dry 1.13, marine 0.67; mountains given the marine factor). No ZIP level roof material source exists.',
    'A reroofed home keeps its kind of covering (tile stays tile).',
    'Wildfire: 40% of destroyed homes are rebuilt within four years (Census homes built 2020 or later in ZIPs that lost 200 or more residences in 2017 to 2020 equal 22% of the residences destroyed); 50% of fire damaged homes get a new roof the next year.',
    'Metal is 4% of residential reroofs statewide (2.2% of today\'s stock, RECS), 1.6 times in ZIPs under 300 residents per square mile, 0.6 times over 1,500, 1.5 times where a quarter of homes are rated high wildfire risk or snow load is 40 psf or more.',
    'Fire hardened roof line: 2% a year of wildfire exposed owner homes (the larger of insurer rated High or Extreme homeowners exposures and FAIR Plan owner occupied policies). 70% of it is taken out of the replacement line, since a hardened roof is usually the reroof done early.',
    'Storm line: the state total is AHS Pacific insurance paid share (3.5%) times the AHS Pacific roof job rate (3.67% of homes a year) times one unit roofs, times 3 for repairs short of replacement (the multiplier is a guess). It is spread over ZIPs by a weather index: 0.5 + 0.3 per 58 mph gust day + 1.2 per 75 mph gust day + 0.3 per AR3 or stronger day + 0.2 per day of 2 inches of rain, a year (weights by judgment).',
    'Fire line: the rebuild roofs due in the next twelve months from the fires of the last four years (a quarter of the rebuilt share each year) and half of last year\'s fire damaged homes, plus half the 2013 to 2025 state yearly mean spread over ZIPs by wildfire exposed homes (fires not yet lit). The halves are by judgment.',
    'Solar detach and reset: every reroof or tile relay on a home with solar needs one; the share of homes with solar is the same at every roof age.',
    'Solar in ZIPs served by city or district utilities (Los Angeles DWP, SMUD and others) is not in the state interconnection file; those ZIPs take the county\'s share from covered ZIPs or the older Project Sunroof count, whichever is larger (column solar_src = "est").',
    'Mobile homes: AHS West 4.15% a year with 46% done by the owner (22 sampled costs); wind and rain damage at the site built rate.',
    'Multifamily buildings are estimated at 7, 14, 30 and 80 homes a building by ACS size class and replaced on a 22 year life; commercial roofs also 22 years (carried from the model\'s original assumptions).',
    'Commercial roofs: 5,918,000 U.S. commercial buildings (Energy Information Administration, Commercial Buildings Energy Consumption Survey 2018, Table B1, revised December 2022; read 2026-11-23) times California\'s share of U.S. residents, spread by establishments weighted by building type. The national count is the survey\'s; giving California its share of residents, and the weights by building type, are assumptions: the survey publishes no California count.',
    'Coatings: 3% of commercial roofs a year (the model\'s original assumption).',
    'Roof leak rates by decade built are the AHS Southern profile by decade rescaled so the California stock averages the AHS Pacific 5.25%; 55% fixed by a paid roofer.',
    'A ZIP belongs to the county holding the largest share of its land.',
]
SRC = [
    ['acs', 'American Community Survey 2020-2024 five-year, table based summary file (ZCTA, county, place, state)', '2020-2024, released 2026-01-29', 'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/', 'A'],
    ['xwalk', 'Census 2020 ZCTA to county and place relationship files; Gazetteer 2025 (ZCTA), 2024 (counties, places)', '2020, 2024, 2025', 'https://www2.census.gov/geo/docs/maps-data/data/', 'A'],
    ['geo', 'Census cartographic boundary files: ZCTA 2020 (1:500,000), counties and states 2024; USGS 1:1,000,000 water bodies; TIGER/Line 2025 area water (bays)', '2020, 2024, 2025', 'https://www2.census.gov/geo/tiger/', 'A'],
    ['gid', 'Google Ads API geo targets file', base.get('gid_file') or 'not reached', 'https://developers.google.com/google-ads/api/data/geotargets', 'A'],
    ['zbp', 'ZIP Code Business Patterns and County Business Patterns', '2023', 'https://www2.census.gov/programs-surveys/cbp/datasets/2023/', 'A'],
    ['nes', 'Nonemployer Statistics, NAICS 2381', '2024', 'https://www2.census.gov/programs-surveys/nonemployer-statistics/', 'A'],
    ['fema', 'OpenFEMA Individuals and Households Program valid registrations', 'read 2026-11-18', 'https://www.fema.gov/api/open/v2/IndividualsAndHouseholdsProgramValidRegistrations', 'A'],
    ['cdi', 'California Department of Insurance: new, renewed and non-renewed residential policies by ZIP 2015-2021 and 2020-2023; wildfire risk report (Ins. Code 929) 2018-2023; FAIR Plan against voluntary market units 2022', '2015 to 2023', 'https://www.insurance.ca.gov/01-consumers/200-wrr/DataAnalysisOnWildfiresAndInsurance.cfm', 'A'],
    ['fair', 'California FAIR Plan Association: policies in force and exposure by ZIP and county, five year-ends; policies by category', 'fiscal year-end 2026-09-30', 'https://www.cfpnet.com/key-statistics-data/', 'A'],
    ['cslb', 'Contractors State License Board, License Master file (C-39 Roofing)', 'November 2026', 'https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList.aspx', 'A'],
    ['ahs', 'American Housing Survey public use files (owner one family houses; roofing jobs)', '2023 national; 2021 metropolitan (San Jose)', 'https://www2.census.gov/programs-surveys/ahs/', 'B'],
    ['recs', 'EIA Residential Energy Consumption Survey 2020 microdata, roof material (California, n = 837 single family)', '2020', 'https://www.eia.gov/consumption/residential/data/2020/', 'C'],
    ['bps', 'Census Building Permits Survey, county annual files and September year to date', '2005 to 2025; 2026 to September', 'https://www2.census.gov/econ/bps/County/', 'A'],
    ['dins', 'CAL FIRE Damage Inspection (DINS) points, placed in ZCTAs by this build', '2013 to 2025 (edited 2026-01-06)', 'CAL FIRE POSTFIRE_MASTER_DATA_SHARE feature service', 'B'],
    ['nem', 'California Distributed Generation Statistics, Interconnection Applications Dataset (PG&E, SCE, SDG&E)', '2026-09-30', 'https://www.californiadgstats.ca.gov/downloads/', 'A'],
    ['sunroof', 'Google Project Sunroof, postal code file (existing installs seen in imagery)', 'file as posted; imagery of several years ago', 'https://storage.googleapis.com/project-sunroof/csv/latest/project-sunroof-postal_code.csv', 'C'],
    ['ppi', 'BLS producer price indexes WPU1361 (asphalt roofing) and WPU1017 (steel mill products), carried from the earlier edition\'s data file (BLS refused the download on 2026-11-19)', 'January 2019 to August 2026', 'https://download.bls.gov/pub/time.series/wp/', 'A'],
    ['econ', 'Economic Census 2022, NAICS 238160, California: revenue $6.207 billion, 2,781 establishments', '2022', 'https://www2.census.gov/programs-surveys/economic-census/data/2022/sector23/', 'A'],
    ['permits_city', 'City of Los Angeles and San Francisco open data, re-roof permits by year (counts from roofing_law_evidence.md D2)', 'read 2026-11-19', 'https://data.lacity.org/resource/pi9x-tg5x.json ; https://data.sf.gov/resource/i98e-djp9.json', 'B'],
    ['hazard', 'Hazard job tables: ' + haz['src'], COMPILED, 'CA/data/hazard', 'see HAZARD_SCHEMA.md'],
]
tot = lambda k: sum((o.get(k) or 0) for o in zobj)
csum = lambda k: sum((c.get(k) or 0) for c in C)
meta = {
    'compiled': COMPILED, 'nzip': len(zobj), 'nres': sum(o['res_ok'] for o in zobj), 'npar': len(C),
    'pop': int(tot('pop')), 'hu': int(csum('hu')), 'occ': int(csum('occ')), 'own': int(csum('own')), 'rent': int(csum('rent')),
    'mh': int(csum('mh')), 'u1': int(csum('u1')), 'yb': [int(sum(c['yb'][i] for c in C)) for i in range(10)],
    'yb_med': st['yb_med'], 'seas': int(csum('seas')), 'mort_sh': st['mort_sh'],
    'roofs': int(tot('roofs')), 'ra15': int(tot('ra15')), 'ra20': int(tot('ra20')), 'ra25': int(tot('ra25')), 'wave': int(tot('wave')),
    'nxt': int(round(tot('nxt'))), 'nxt_t': int(round(tot('nxt_t'))), 'tile_n': int(tot('tile_n')), 'tile25': int(tot('tile25')),
    'solar_n': int(tot('solar_n')), 'npts': len(pts), 'ncomp': len(comp), 'ncomp_ver': sum(1 for c in comp if c['verified']),
    'state': {k: tidy(st[k]) for k in ['pop', 'hh', 'hu', 'inc', 'value', 'own_sh', 'sfd_sh', 'mf5_sh', 'mh', 'mh_sh', 'yb_med', 'pre80_sh',
                                       'mort_sh', 'vac_sh', 'seas', 'hh100k_sh', 's65_sh', 'span_sh', 'span_lep_sh', 'chin_sh', 'viet_sh',
                                       'tagalog_sh', 'korean_sh', 'lep_sh', 'u1', 'mf24', 'mf5u', 'age_med']},
    'cbp': base['cbp_state'], 'nes': base.get('nes_state'),
    'lic': {'n': lm['n'], 'clear': lm['clear'], 'firms': lm['n'], 'inca': lm['inca'], 'out': lm['out'], 'only': lm['only'],
            'susp': lm['susp'], 'in_rows': int(tot('lic_all')), 'top': base['lic_top']},
    'ahs': ahs,
    'harden': {'anchor': lines['pools']['harden'], 'rate': lines['model']['ANCH']['harden'], 'fair_disc': 16.4, 'safe_homes26': 3000000},
    'ins': {'fair_pif': dict(zip(map(str, base['ins']['years']), ins_s['fair_pif'])),
            'fair_tiv': dict(zip(map(str, base['ins']['years']), ins_s['fair_tiv'])), 'fair_com': ins_s['fair_com'],
            'fair_hi': ins_s['fair_hi'], 'fair_own': ins_s['fair_own'], 'fair_dist_zips': ins_s['fair_dist_zips'],
            'nonren': ins_s['nonren'], 'renewed': ins_s['renewed'], 'insnr': ins_s['insnr'], 'ins_pol': ins_s['ins_pol'],
            'wf_claims': ins_s['wf_claims'], 'wf_loss': ins_s['wf_loss'], 'wf_hi_sh': ins_s['wf_hi_sh']},
    'mat': {'state': {'shingle': 61.9, 'tile': 27.4, 'clay': 18.1, 'concrete': 9.3, 'wood': 5.4, 'metal': 2.2, 'other': 2.0, 'slate': 0.9, 'n': 837},
            'era': {'before 1960': {'shingle': 74.9, 'tile': 6.8, 'wood': 8.5, 'metal': 4.6}, '1960-1979': {'shingle': 75.4, 'tile': 17.4, 'wood': 3.1, 'metal': 1.5},
                    '1980-1999': {'shingle': 48.7, 'tile': 43.0, 'wood': 5.6, 'metal': 1.0}, '2000-2020': {'shingle': 32.9, 'tile': 62.2, 'wood': 3.0, 'metal': 0.6}},
            'climate': {'hot_dry': {'shingle': 60.3, 'tile': 30.9, 'n': 601}, 'marine': {'shingle': 65.8, 'tile': 18.3, 'n': 215}}},
    'econ': {'rcpt22': 6206850, 'estab22': 2781, 'emp22': 25383},
    'pools': lines['pools'], 'cases': lines['cases'], 'fees': lines['fees'], 'fees_tot': lines['fees_tot'],
    'model': model, 'src': [dict(zip(['k', 'name', 'vintage', 'url', 'grade'], s)) for s in SRC], 'assume': ASSUME,
    'hazard': {'src': haz['src'], 'fire_check': haz.get('fire_check'), 'merged': merged, 'cols': [c for c in E_HAZ if c not in mine], 'skipped': skipped_haz,
               'fire_src': haz.get('fire_src')},
    'notes': dict(base['notes'], missing_seats=missing_seats, geo_fallback=geo['fallback'], geo_eps=geo['eps']),
}
permits_city = {
    'Los Angeles': {'src': 'City of Los Angeles open data, building permits issued (dataset pi9x-tg5x): permits whose description contains re-roof',
                    'years': {'2020': 8890, '2021': 9024, '2022': 10383, '2023': 14511, '2024': 14273, '2025': 11954, '2026': 12696},
                    'note': '2026 runs to about 14 November. 2025 mix: 9,686 one or two family dwellings, 1,631 apartments, 637 commercial. Median house roof 22 squares.'},
    'San Francisco': {'src': 'City and County of San Francisco open data, building permits (dataset i98e-djp9): permits filed with the re-roof flag',
                      'years': {'2016': 2656, '2017': 2911, '2018': 2694, '2019': 2773, '2020': 2140, '2021': 2490, '2022': 2911, '2023': 3527,
                                '2024': 4426, '2025': 4084, '2026': 1877},
                      'note': 'The 2026 figure looks incomplete. Median declared cost $15,000 for one and two family buildings.'},
}
data = {'zcols': zcols, 'zrows': zrows, 'parishes': parishes, 'cities': cities, 'places': places, 'geo': geo['geo'],
        'seg': [], 'routes': [], 'rlist': [], 'sids': [], 'zstorm': {}, 'pts': pts, 'ptflags': ptflags, 'ts': ts, 'comp': comp,
        'agez': {o['zip']: o['agez'] for o in zobj}, 'agez_t': {o['zip']: o['agez_t'] for o in zobj},
        'rhist': {o['zip']: [[tidy(a), tidy(b)] for a, b in o['rhist']] for o in zobj},
        'lic_city': base['lic_city'], 'ins': base['ins'],
        'fema': [{k: d[k] for k in ('dr', 'type', 'date', 'kind', 'label', 'title', 'regs', 'owners', 'renters', 'insured', 'roof_n',
                                    'rpfvl_noflood', 'destroyed', 'k', 'nzip')} for d in base['fema']],
        'permits_city': permits_city, 'relief': None, 'meta': meta}
if hz_obj is not None:
    data['hz'] = hz_obj
for k, v in extra_top.items():
    data.setdefault(k, v)
out = os.path.join(OUT, 'ca_atlas_data.json')
with open(out + '.tmp', 'w') as f:
    json.dump(data, f, separators=(',', ':'), allow_nan=False)
os.replace(out + '.tmp', out)
with open(os.path.join(OUT, 'ca_zip_index.json'), 'w') as f:
    json.dump({'zips': [o['zip'] for o in zobj], 'fips': [c['fips'] for c in C],
               'geo': {k: geo['geo'][k] for k in ('W', 'H', 'minx', 'maxy', 'kx', 'sx', 'u')}}, f, separators=(',', ':'))
sizes = {k: len(json.dumps(v, separators=(',', ':'))) for k, v in data.items()}
print('wrote', out, os.path.getsize(out))
print('sizes', sizes)
print('zcols', len(zcols), 'rows', len(zrows), 'cities', len(cities), 'places', len(places), 'missing seats', missing_seats,
      'hazard cols', [c for c in E_HAZ if c not in mine], 'merged', merged)
save('assemble_report.json', {'sizes': sizes, 'total': os.path.getsize(out), 'zcols': zcols, 'ncities': len(cities), 'nplaces': len(places),
                              'missing_seats': missing_seats, 'hazard_cols': [c for c in E_HAZ if c not in mine], 'merged': merged,
                              'haz_src': haz['src']})
