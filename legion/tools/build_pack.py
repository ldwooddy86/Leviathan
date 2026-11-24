#!/usr/bin/env python3
"""Legion world pack compiler.

Reads the California Roofer Guru atlas (one HTML file that carries its data inline) and the American
Community Survey 2020-2024 5-year tables by ZCTA, and writes legion/data/world.json.gz: the one data file
every Legion module reads (the people generator, the persona model, the dialogue engine, the crowd and the
street view).

    python3 legion/tools/build_pack.py                       # atlas at dist/california-roofer-guru.html
    python3 legion/tools/build_pack.py --atlas <path>
    python3 legion/tools/build_pack.py --fetch-acs           # download the ACS tables again first

The ACS tables are cached in legion/data/acs/<table>.dat.gz, filtered to the 9xxxx ZCTAs, so a rebuild
needs no network unless --fetch-acs is given. The atlas stays outside the repository (dist/ is ignored), the
way the other Leviathan build scripts read their sources.

What the atlas gives (all of it compiled 2026-11-19 by the atlas build): 1,762 ZIPs with 365 columns (ACS
2024 housing and language, roof age, climate records, wildfire history, insurance, business counts), the 58
counties, 774 cities and 515 places, the ZIP and county outlines, the NWS snapshot of 2026-11-23, the
Caltrans 2024 traffic census, the USGS GNIS gazetteer and the CGS geomorphic provinces. What the ACS tables
add, because the atlas does not carry them: age by sex, race and Hispanic origin with the detailed Asian
and Latino groups, ancestry, nativity, the language spoken at home with English ability, commute mode and
time, occupation by sex, education, marital status, veterans, employment, household type, vehicles,
household income brackets and school enrollment.
"""
import argparse
import gzip
import json
import math
import os
import re
import shutil
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
LEGION = os.path.dirname(HERE)
REPO = os.path.dirname(LEGION)
ACS_DIR = os.path.join(LEGION, 'data', 'acs')
OUT = os.path.join(LEGION, 'data', 'world.json.gz')
ACS_URL = 'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-{t}.dat'
ACS_TABLES = ['b01001', 'b03002', 'b03001', 'b02015', 'b04006', 'b05012', 'b08301', 'b08303', 'b11001',
              'b12001', 'b14001', 'b15003', 'b19001', 'b21001', 'b23025', 'b25044', 'c16001', 'c24010']

REGIONS = [
    ('nc', 'North Coast', 'the North Coast', ['Del Norte', 'Humboldt', 'Mendocino', 'Lake']),
    ('fn', 'Far North', 'the Far North', ['Siskiyou', 'Modoc', 'Shasta', 'Lassen', 'Tehama', 'Trinity', 'Plumas']),
    ('sv', 'Sacramento Valley', 'the Sacramento Valley', ['Butte', 'Glenn', 'Colusa', 'Sutter', 'Yuba', 'Yolo', 'Sacramento', 'Placer', 'El Dorado']),
    ('si', 'Sierra', 'the Sierra', ['Sierra', 'Nevada', 'Amador', 'Calaveras', 'Tuolumne', 'Mariposa', 'Alpine', 'Mono', 'Inyo']),
    ('ba', 'Bay Area', 'the Bay Area', ['Alameda', 'Contra Costa', 'Marin', 'Napa', 'San Francisco', 'San Mateo', 'Santa Clara', 'Solano', 'Sonoma']),
    ('cc', 'Central Coast', 'the Central Coast', ['Santa Cruz', 'San Benito', 'Monterey', 'San Luis Obispo', 'Santa Barbara']),
    ('sj', 'San Joaquin Valley', 'the San Joaquin Valley', ['San Joaquin', 'Stanislaus', 'Merced', 'Madera', 'Fresno', 'Kings', 'Tulare', 'Kern']),
    ('la', 'Los Angeles and Ventura', 'Los Angeles and Ventura counties', ['Los Angeles', 'Ventura']),
    ('oc', 'Orange County', 'Orange County', ['Orange']),
    ('ie', 'Inland Empire', 'the Inland Empire', ['Riverside', 'San Bernardino']),
    ('sd', 'San Diego and Imperial', 'San Diego and Imperial counties', ['San Diego', 'Imperial']),
]

# Route numbers are unique across the three systems in California, so the number says the system.
INTERSTATES = {5, 8, 10, 15, 40, 80, 105, 110, 205, 210, 238, 280, 380, 405, 505, 580, 605, 680, 710, 780, 805, 880, 980}
US_ROUTES = {6, 50, 95, 97, 101, 199, 395}

# The atlas columns the pack keeps, by the name the pack gives them. Each entry: pack name, atlas name,
# kind ('s' string, 'i' integer, 'f' float with the given decimals).
ATLAS_COLS = [
    ('zip', 'zip', 's'), ('city', 'city', 's'), ('place', 'place', 's'), ('county', 'pi', 'i'),
    ('lat', 'lat', 'f4'), ('lon', 'lon', 'f4'), ('tlat', 'tlat', 'f4'), ('tlon', 'tlon', 'f4'),
    ('sqmi', 'sqmi', 'f2'), ('density', 'density', 'i'), ('pop', 'pop', 'i'), ('hh', 'hh', 'i'),
    ('hhsize', 'hhsize', 'f2'), ('inc', 'inc', 'i'), ('value', 'value', 'i'), ('own_sh', 'own_sh', 'f1'),
    ('sfd_sh', 'sfd_sh', 'f1'), ('mf5_sh', 'mf5_sh', 'f1'), ('mh_sh', 'mh_sh', 'f1'), ('vac_sh', 'vac_sh', 'f1'),
    ('seas', 'seas', 'i'), ('hu', 'hu', 'i'), ('yb_med', 'yb_med', 'i'), ('rooms', 'rooms', 'f1'),
    ('mort_sh', 'mort_sh', 'f1'), ('val1m_sh', 'val1m_sh', 'f1'), ('moved10_sh', 'moved10_sh', 'f1'),
    ('own_yr', 'own_yr', 'i'), ('age_med', 'age_med', 'f1'), ('s65_sh', 's65_sh', 'f1'),
    ('hisp_sh', 'hisp_sh', 'f1'), ('asian_sh', 'asian_sh', 'f1'), ('span_sh', 'span_sh', 'f1'),
    ('span_lep_sh', 'span_lep_sh', 'f1'), ('viet_sh', 'viet_sh', 'f1'), ('chin_sh', 'chin_sh', 'f1'),
    ('tagalog_sh', 'tagalog_sh', 'f1'), ('korean_sh', 'korean_sh', 'f1'), ('arabic_sh', 'arabic_sh', 'f1'),
    ('slavic_sh', 'slavic_sh', 'f1'), ('oie_sh', 'oie_sh', 'f1'), ('lep_sh', 'lep_sh', 'f1'),
    ('anc_arm', 'anc_arm', 'i'), ('anc_iran', 'anc_iran', 'i'), ('hh100k_sh', 'hh100k_sh', 'f1'),
    ('hh200k_sh', 'hh200k_sh', 'f1'),
    # roofs and solar (homeowners talk about them)
    ('roof_age', 'ra_med', 'i'), ('ra20_sh', 'ra20_sh', 'f1'), ('tile_sh', 'tile_sh', 'f1'),
    ('wood_sh', 'wood_sh', 'f1'), ('metal_sh', 'metal_sh', 'f1'), ('solar_sh', 'solar_sh', 'f1'),
    # terrain and climate
    ('cz', 'cz', 'i'), ('elev_m', 'elev_m', 'i'), ('elev_max_m', 'elev_max_m', 'i'), ('coast_km', 'coast_km', 'f1'),
    ('zone', 'zone', 's'), ('rain_in', 'rain_in', 'f1'), ('rain_wet_m', 'rain_wet_m', 'i'),
    ('rain_rec_in', 'rain_rec_in', 'f2'), ('rain_rec_date', 'rain_rec_date', 's'), ('rain_rec_st', 'rain_rec_st', 's'),
    ('gust_max', 'gust_max', 'i'), ('gust_max_date', 'gust_max_date', 's'), ('gust_st', 'gust_st', 's'),
    ('g58', 'g58', 'f2'), ('sa_ep', 'sa_ep', 'i'), ('di_ep', 'di_ep', 'i'), ('off_kind', 'off_kind', 's'),
    ('snow_psf', 'snow_psf', 'i'), ('snowfall_in', 'snowfall_in', 'f1'), ('h90', 'h90', 'f1'),
    ('h100', 'h100', 'f1'), ('h110', 'h110', 'f2'), ('heat_rec_f', 'heat_rec_f', 'i'),
    ('heat_rec_date', 'heat_rec_date', 's'), ('heat_st', 'heat_st', 's'), ('tjul', 'tjul', 'f1'),
    ('hail_n25', 'hail_n25', 'i'), ('hail_max_in', 'hail_max_in', 'f2'), ('tor_n25', 'tor_n25', 'i'),
    ('flood_n10', 'flood_n10', 'i'), ('marine_cls', 'marine_cls', 'i'), ('salt_cls', 'salt_cls', 'i'),
    ('ar_n', 'ar_n', 'f1'), ('ar_days', 'ar_days', 'f2'), ('ar_max', 'ar_max', 'i'), ('ar_max_date', 'ar_max_date', 's'),
    ('st_top', 'st_top', 's'), ('stress', 'stress', 'i'),
    # wildfire
    ('fhsz_vh', 'fhsz_vh', 'f1'), ('fhsz_any', 'fhsz_any', 'f1'), ('fire_n', 'fire_n', 'i'),
    ('fire_big', 'fire_big', 's'), ('fire_big_yr', 'fire_big_yr', 'i'), ('fire_big_ac', 'fire_big_ac', 'i'),
    ('fire_last', 'fire_last', 's'), ('fire_last_yr', 'fire_last_yr', 'i'), ('fire_near', 'fire_near', 's'),
    ('fire_near_yr', 'fire_near_yr', 'i'), ('fire_km', 'fire_km', 'f1'), ('burn_sh', 'burn_sh', 'f1'),
    ('fire_dest_res', 'fire_dest_res', 'i'), ('fire_worst', 'fire_worst', 's'), ('fire_worst_yr', 'fire_worst_yr', 'i'),
    ('fire_worst_dest', 'fire_worst_dest', 'i'),
    # disasters and insurance
    ('fema_k', 'fema_k', 'i'), ('fema_fire', 'fema_fire', 'i'), ('fema_storm', 'fema_storm', 'i'),
    ('fema_quake', 'fema_quake', 'i'), ('fair_sh', 'fair_sh', 'f1'), ('nonren_sh', 'nonren_sh', 'f1'),
    ('prem', 'prem', 'i'), ('wf_hi_sh', 'wf_hi_sh', 'f1'),
    # business establishments (County Business Patterns, by ZIP)
    ('est', 'est', 'i'), ('retail', 'retail', 'i'), ('food', 'food', 'i'), ('lodging', 'lodging', 'i'),
    ('whse', 'whse', 'i'), ('mfg', 'mfg', 'i'), ('church', 'church', 'i'), ('health', 'health', 'i'),
    ('school', 'school', 'i'), ('office', 'office', 'i'), ('auto', 'auto', 'i'), ('builders', 'builders', 'i'),
    ('roofers', 'roofers', 'i'), ('solar_co', 'solar_co', 'i'), ('ins_agents', 'ins_agents', 'i'),
]

# ACS layout: block name -> list of (table, [cell numbers summed]) in order. Every value is an integer count.
def _cells(*nums):
    return [[n] for n in nums]

ACS_LAYOUT = [
    # B01001 sex by age: 23 male brackets then 23 female brackets
    ('age', 'b01001', [[n] for n in range(3, 26)] + [[n] for n in range(27, 50)]),
    # B03002: NH white, NH Black, NH AIAN, NH Asian, NH NHPI, NH other, NH two or more, Hispanic
    ('race', 'b03002', _cells(3, 4, 5, 6, 7, 8, 9, 12)),
    # B03001 Hispanic origin: Mexican, Puerto Rican, Cuban, Dominican, Guatemalan, Honduran, Nicaraguan,
    # Salvadoran, other Central American, South American, Spaniard/Spanish, other
    ('hisp', 'b03001', [[4], [5], [6], [7], [10], [11], [12], [14], [9, 13, 15], [16], [28, 29, 30], [31]]),
    # B02015 Asian alone groups: Chinese (incl. Taiwanese), Filipino, Vietnamese, Korean, Japanese, Asian Indian,
    # Hmong, Cambodian, Lao and Mien, Thai, Pakistani, Bangladeshi, Sikh, Afghan, Burmese, Indonesian, other
    ('asian', 'b02015', [[2, 8], [12], [19], [5], [4], [21], [3], [11], [14, 16], [18], [25], [22], [26], [29], [10], [13],
                         [6, 7, 9, 15, 17, 20, 23, 24, 27, 28, 30, 31, 32, 33, 34, 35]]),
    # B04006 ancestry (people reporting each; a person may report two)
    ('anc', 'b04006', _cells(16, 48, 6, 17, 64, 92, 61, 49, 51, 42, 36, 67, 66, 40, 62, 34, 89, 59, 33, 44, 20, 91,
                             73, 94, 5, 50, 22, 18, 26, 90, 46, 31, 63, 7, 10, 75, 79, 102)),
    ('nat', 'b05012', _cells(2, 3)),
    # C16001 language at home (population 5+): 13 language totals then 12 limited-English counts
    ('lang', 'c16001', _cells(2, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36) + _cells(5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38)),
    # B08301 commute (workers 16+): drove alone, carpool, bus, rail, ferry, taxi/ride-hail, motorcycle, bicycle,
    # walked, other, worked from home
    ('comm', 'b08301', [[3], [4], [11], [12, 13, 14], [15], [16], [17], [18], [19], [20], [21]]),
    ('ctime', 'b08303', _cells(*range(2, 14))),
    # C24010 occupation leaves: 25 male then 25 female
    ('occ', 'c24010', _cells(5, 6, 8, 9, 10, 12, 13, 14, 15, 17, 18, 20, 22, 23, 24, 25, 26, 28, 29, 31, 32, 33, 35, 36, 37)
                       + _cells(41, 42, 44, 45, 46, 48, 49, 50, 51, 53, 54, 56, 58, 59, 60, 61, 62, 64, 65, 67, 68, 69, 71, 72, 73)),
    # B15003 education (25+): below high school diploma, high school or GED, some college, associate, bachelor,
    # master, professional, doctorate
    ('edu', 'b15003', [list(range(2, 17)), [17, 18], [19, 20], [21], [22], [23], [24], [25]]),
    # B12001 marital (15+): male never, married spouse present, separated, married spouse absent (other), widowed,
    # divorced; female the same
    ('mar', 'b12001', _cells(3, 5, 7, 8, 9, 10, 12, 14, 16, 17, 18, 19)),
    # B21001 veterans (18+): male vet by age 18-34, 35-54, 55-64, 65-74, 75+; male non-vet the same; female vet;
    # female non-vet
    ('vet', 'b21001', _cells(8, 11, 14, 17, 20, 9, 12, 15, 18, 21, 26, 29, 32, 35, 38, 27, 30, 33, 36, 39)),
    # B23025 (16+): employed, unemployed, armed forces, not in labor force
    ('emp', 'b23025', _cells(4, 5, 6, 7)),
    # B11001 households: married couple, male householder no spouse, female householder no spouse, living alone,
    # nonfamily not alone
    ('hht', 'b11001', _cells(3, 5, 6, 8, 9)),
    # B25044 vehicles by tenure: owner 0..5+, renter 0..5+
    ('veh', 'b25044', _cells(3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15)),
    # B19001 household income, 16 brackets
    ('hinc', 'b19001', _cells(*range(2, 18))),
    # B14001 school enrollment (3+): preschool, kindergarten, grades 1-4, 5-8, 9-12, undergraduate, graduate,
    # not enrolled
    ('sch', 'b14001', _cells(3, 4, 5, 6, 7, 8, 9, 10)),
]
ACS_LABELS = {
    'age': ['<5', '5-9', '10-14', '15-17', '18-19', '20', '21', '22-24', '25-29', '30-34', '35-39', '40-44', '45-49',
            '50-54', '55-59', '60-61', '62-64', '65-66', '67-69', '70-74', '75-79', '80-84', '85+'],
    'race': ['white', 'black', 'aian', 'asian', 'nhpi', 'other', 'multi', 'hispanic'],
    'hisp': ['mexican', 'puertorican', 'cuban', 'dominican', 'guatemalan', 'honduran', 'nicaraguan', 'salvadoran',
             'centralam', 'southam', 'spanish', 'otherhisp'],
    'asian': ['chinese', 'filipino', 'vietnamese', 'korean', 'japanese', 'indian', 'hmong', 'cambodian', 'lao',
              'thai', 'pakistani', 'bangladeshi', 'sikh', 'afghan', 'burmese', 'indonesian', 'otherasian'],
    'anc': ['armenian', 'iranian', 'arab', 'assyrian', 'russian', 'ukrainian', 'polish', 'irish', 'italian', 'german',
            'english', 'scottish', 'scotchirish', 'french', 'portuguese', 'dutch', 'swedish', 'norwegian', 'danish',
            'greek', 'basque', 'turkish', 'african', 'westindian', 'american', 'israeli', 'brazilian', 'australian',
            'canadian', 'swiss', 'hungarian', 'czech', 'romanian', 'egyptian', 'lebanese', 'ethiopian', 'nigerian',
            'jamaican'],
    'nat': ['native', 'foreign'],
    'lang': ['english', 'spanish', 'french', 'german', 'slavic', 'indoeuro', 'korean', 'chinese', 'vietnamese',
             'tagalog', 'asianpi', 'arabic', 'other'],
    'lang_lep': ['spanish', 'french', 'german', 'slavic', 'indoeuro', 'korean', 'chinese', 'vietnamese', 'tagalog',
                 'asianpi', 'arabic', 'other'],
    'comm': ['drove', 'carpool', 'bus', 'rail', 'ferry', 'taxi', 'motorcycle', 'bike', 'walk', 'other', 'wfh'],
    'ctime': ['<5', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-59', '60-89', '90+'],
    'occ': ['management', 'business', 'computer', 'engineering', 'science', 'social', 'legal', 'education', 'arts',
            'practitioner', 'healthtech', 'healthsupport', 'firefighting', 'police', 'food', 'cleaning',
            'personalcare', 'sales', 'office', 'farming', 'construction', 'repair', 'production', 'transport',
            'moving'],
    'edu': ['nohs', 'hs', 'somecollege', 'associate', 'bachelor', 'master', 'professional', 'doctorate'],
    'mar': ['never', 'married', 'separated', 'absent', 'widowed', 'divorced'],
    'vet': ['18-34', '35-54', '55-64', '65-74', '75+'],
    'emp': ['employed', 'unemployed', 'military', 'nilf'],
    'hht': ['married', 'male', 'female', 'alone', 'roommates'],
    'veh': ['0', '1', '2', '3', '4', '5+'],
    'hinc': ['<10k', '10-15k', '15-20k', '20-25k', '25-30k', '30-35k', '35-40k', '40-45k', '45-50k', '50-60k',
             '60-75k', '75-100k', '100-125k', '125-150k', '150-200k', '200k+'],
    'sch': ['preschool', 'kindergarten', 'g1-4', 'g5-8', 'g9-12', 'undergrad', 'grad', 'none'],
}


def log(*a):
    print('[legion pack]', *a, file=sys.stderr)


# ---------------------------------------------------------------- atlas extraction

def read_atlas(path):
    """Pull the inline data blocks out of the atlas HTML. Returns a dict of the parsed blocks."""
    blocks = {}
    want = {
        'window.__ATLAS_DATA__ = ': 'atlas',
        'window.__NWS_SNAPSHOT__ = ': 'nws',
        'window.__SCOUT_TOPO_GAZ__ = ': 'gaz',
        'window.__SCOUT_TOPO_PROV__ = ': 'prov',
    }
    with open(path, 'r', encoding='utf-8') as fh:
        for line in fh:
            s = line.lstrip()
            for prefix, key in want.items():
                if s.startswith(prefix):
                    body = s[len(prefix):].rstrip().rstrip(';')
                    blocks[key] = json.loads(body)
            if 'SE.AADT = {' in s and 'aadt' not in blocks:
                m = re.search(r"year:\s*(\d+),\s*n:\s*(\d+),\s*d:\s*'([0-9a-z]+)'", s)
                if m:
                    blocks['aadt'] = {'year': int(m.group(1)), 'n': int(m.group(2)), 'd': m.group(3)}
    missing = [k for k in ('atlas', 'nws', 'gaz', 'prov', 'aadt') if k not in blocks]
    if missing:
        raise SystemExit('the atlas is missing blocks: ' + ', '.join(missing))
    return blocks


# ---------------------------------------------------------------- ACS

def fetch_acs():
    os.makedirs(ACS_DIR, exist_ok=True)
    for t in ACS_TABLES:
        url = ACS_URL.format(t=t)
        log('fetching', url)
        out = os.path.join(ACS_DIR, t + '.dat.gz')
        keep = []
        if shutil.which('curl'):
            proc = subprocess.Popen(['curl', '-s', '-L', '-m', '900', url], stdout=subprocess.PIPE)
            stream = proc.stdout
        else:
            stream = urllib.request.urlopen(url, timeout=900)
        first = True
        for raw in stream:
            line = raw.decode('utf-8', 'replace')
            if first or line.startswith('860Z200US9'):
                keep.append(line)
            first = False
        with gzip.open(out, 'wt', encoding='utf-8') as fh:
            fh.writelines(keep)
        log('  kept', len(keep) - 1, 'ZCTA rows')


def read_acs():
    """Return {zip: {block: [ints]}} from the cached tables."""
    tables = {}
    for t in ACS_TABLES:
        path = os.path.join(ACS_DIR, t + '.dat.gz')
        if not os.path.exists(path):
            raise SystemExit('ACS table missing: %s (run with --fetch-acs)' % path)
        with gzip.open(path, 'rt', encoding='utf-8') as fh:
            header = fh.readline().rstrip('\n').split('|')
            idx = {h: i for i, h in enumerate(header)}
            rows = {}
            for line in fh:
                parts = line.rstrip('\n').split('|')
                geo = parts[0]
                if not geo.startswith('860Z200US'):
                    continue
                rows[geo[9:]] = (parts, idx)
        tables[t] = rows
    out = {}
    zips = set()
    for t in tables.values():
        zips.update(t.keys())
    for z in zips:
        rec = {}
        for block, t, cells in ACS_LAYOUT:
            row = tables[t].get(z)
            vals = []
            for group in cells:
                tot = 0
                for n in group:
                    if row is None:
                        continue
                    parts, idx = row
                    key = '%s_E%03d' % (t.upper(), n)
                    i = idx.get(key)
                    if i is None or i >= len(parts):
                        continue
                    v = parts[i]
                    try:
                        tot += int(float(v)) if v not in ('', 'null', 'N') else 0
                    except ValueError:
                        pass
                vals.append(max(0, tot))
            rec[block] = vals
        out[z] = rec
    return out


# ---------------------------------------------------------------- geometry helpers

class Proj:
    def __init__(self, g):
        self.minx, self.maxy, self.kx, self.sx = g['minx'], g['maxy'], g['kx'], g['sx']

    def xy(self, lat, lon):
        return ((lon - self.minx) * self.kx * self.sx, (self.maxy - lat) * self.sx)


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def decode_polyline(s, precision=3):
    """Google encoded polyline -> [(lat, lon)]."""
    out, i, lat, lon, f = [], 0, 0, 0, 10 ** precision
    while i < len(s):
        vals = []
        for _ in range(2):
            shift, res = 0, 0
            while True:
                b = ord(s[i]) - 63
                i += 1
                res |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            vals.append(~(res >> 1) if res & 1 else res >> 1)
        lat += vals[0]
        lon += vals[1]
        out.append((lat / f, lon / f))
    return out


def point_in_ring(lat, lon, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        yi, xi = ring[i]
        yj, xj = ring[j]
        if (yi > lat) != (yj > lat):
            x = (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
            if lon < x:
                inside = not inside
        j = i
    return inside


def rnd(v, d):
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return round(v, d) if d > 0 else int(round(v))


# ---------------------------------------------------------------- roads from the traffic census

def decode_aadt(blk, proj):
    d = blk['d']
    pts = []
    for k in range(0, len(d) - 9, 10):
        c = d[k:k + 10]
        lat = 32 + int(c[0:3], 36) / 1000.0
        lon = -125 + int(c[3:6], 36) / 1000.0
        aadt = int(c[6:8], 36)
        route = int(c[8:10], 36)
        x, y = proj.xy(lat, lon)
        pts.append({'lat': lat, 'lon': lon, 'x': x, 'y': y, 'aadt': aadt, 'route': route})
    return pts


def chain_route(points, max_km=45.0):
    """Order one route's count points into polylines: a minimum spanning tree (edges under max_km), then the
    tree split into paths, longest first, each branch keeping the junction it hangs from."""
    n = len(points)
    if n == 0:
        return []
    if n == 1:
        return [[0]]
    dist = lambda a, b: haversine_km(points[a]['lat'], points[a]['lon'], points[b]['lat'], points[b]['lon'])
    in_tree = [False] * n
    best = [float('inf')] * n
    parent = [-1] * n
    adj = [[] for _ in range(n)]
    for start in range(n):
        if in_tree[start]:
            continue
        best[start] = 0
        heap_nodes = {start}
        while True:
            u, bu = -1, float('inf')
            for v in heap_nodes:
                if not in_tree[v] and best[v] < bu:
                    u, bu = v, best[v]
            if u < 0 or bu > max_km:
                break
            in_tree[u] = True
            heap_nodes.discard(u)
            if parent[u] >= 0:
                adj[u].append(parent[u])
                adj[parent[u]].append(u)
            for v in range(n):
                if not in_tree[v]:
                    dv = dist(u, v)
                    if dv < best[v]:
                        best[v] = dv
                        parent[v] = u
                        heap_nodes.add(v)
        for v in range(n):
            if not in_tree[v]:
                best[v] = float('inf')
                parent[v] = -1
    # split the forest into paths
    used_edge = set()
    paths = []

    def far(src, allowed):
        seen = {src: None}
        order = [src]
        for u in order:
            for v in adj[u]:
                e = (min(u, v), max(u, v))
                if v not in seen and e not in used_edge and v in allowed:
                    seen[v] = u
                    order.append(v)
        last = order[-1]
        # farthest by hops is fine for a road chain; weight by distance for the diameter
        dmax, best_v = -1, src
        acc = {src: 0.0}
        for u in order[1:]:
            acc[u] = acc[seen[u]] + dist(u, seen[u])
            if acc[u] > dmax:
                dmax, best_v = acc[u], u
        return best_v, seen, acc

    remaining_nodes = set(range(n))
    while True:
        # pick a component that still has unused edges
        cand = None
        for u in sorted(remaining_nodes):
            if any((min(u, v), max(u, v)) not in used_edge for v in adj[u]):
                cand = u
                break
        if cand is None:
            break
        comp = set()
        stack = [cand]
        while stack:
            u = stack.pop()
            if u in comp:
                continue
            comp.add(u)
            for v in adj[u]:
                if (min(u, v), max(u, v)) not in used_edge:
                    stack.append(v)
        a, _, _ = far(cand, comp)
        b, seen, _ = far(a, comp)
        path = [b]
        while seen[path[-1]] is not None:
            path.append(seen[path[-1]])
        for i in range(len(path) - 1):
            used_edge.add((min(path[i], path[i + 1]), max(path[i], path[i + 1])))
        if len(path) >= 2:
            paths.append(path)
        else:
            break
    # singletons (no edge under max_km) stay out: one count point is not a road
    return paths


def build_roads(aadt_pts):
    by_route = {}
    for p in aadt_pts:
        by_route.setdefault(p['route'], []).append(p)
    routes = []
    for r in sorted(by_route):
        pts = by_route[r]
        kind = 'I' if r in INTERSTATES else ('US' if r in US_ROUTES else 'SR')
        name = ('I-%d' if kind == 'I' else ('US %d' if kind == 'US' else 'SR %d')) % r
        lines = []
        for path in chain_route(pts):
            line = [[round(pts[i]['x'], 1), round(pts[i]['y'], 1), pts[i]['aadt']] for i in path]
            lines.append(line)
        if lines:
            routes.append({'r': r, 'kind': kind, 'name': name, 'lines': lines})
    return routes


# ---------------------------------------------------------------- weather

def key_messages(text):
    if not text:
        return []
    m = re.search(r'\.KEY MESSAGES\.\.\.\s*(.*?)(?:\n\s*\n\s*\.|\n&&|\Z)', text, re.S)
    if not m:
        # offices that write no key messages: the synopsis paragraph stands in
        m2 = re.search(r'\.SYNOPSIS\.\.\.[^\n]*\n(.*?)(?:\n&&|\n\s*\n\s*\.|\Z)', text, re.S)
        if not m2:
            return []
        para = ' '.join(m2.group(1).split())
        return [para[:600]] if len(para) > 12 else []
    body = m.group(1)
    items = re.split(r'\n\s*\*\s+', '\n' + body)
    out = []
    for it in items:
        it = ' '.join(it.split())
        if len(it) > 12:
            out.append(it[:400])
    return out[:6]


def compact_weather(nws):
    pts = []
    for p in nws.get('points', []):
        periods = []
        for q in (p.get('periods') or [])[:10]:
            periods.append({k: q.get(k) for k in ('name', 'start', 'end', 'isDay', 'tempF', 'short', 'pop', 'wind', 'detail')})
        hourly = []
        for q in (p.get('hourly') or [])[:72]:
            hourly.append([q.get('t'), q.get('tempF'), q.get('rh'), q.get('pop'), q.get('wind'), q.get('short'), 1 if q.get('isDay') else 0])
        pts.append({'city': p.get('city'), 'reg': p.get('reg'), 'lat': p.get('lat'), 'lon': p.get('lon'),
                    'zone': p.get('zone'), 'office': p.get('office'), 'periods': periods, 'hourly': hourly})
    alerts = []
    for a in nws.get('alerts', []):
        alerts.append({
            'event': a.get('event'), 'severity': a.get('severity'), 'urgency': a.get('urgency'),
            'headline': a.get('headline'), 'description': (a.get('description') or '')[:900],
            'instruction': (a.get('instruction') or '')[:500], 'onset': a.get('onset'), 'ends': a.get('ends'),
            'expires': a.get('expires'), 'zones': a.get('zones') or [], 'fips': a.get('fips') or [],
            'sender': a.get('sender'), 'gust': a.get('gust')})
    afd = {}
    for office, rec in (nws.get('afd') or {}).items():
        km = key_messages((rec or {}).get('text'))
        if km:
            afd[office] = {'issued': rec.get('issued'), 'key': km}
    fire = {}
    for day in ('1', '2'):
        blk = (nws.get('fire') or {}).get(day)
        if blk:
            fire[day] = {'valid': blk.get('valid'), 'levels': blk.get('levels')}
    ero = {}
    for day in ('1', '2', '3'):
        blk = (nws.get('ero') or {}).get(day)
        if blk:
            ero[day] = {'valid': blk.get('valid'), 'levels': blk.get('levels')}
    return {
        'fetched': nws.get('fetched'), 'tz': nws.get('tz'), 'source': nws.get('source'),
        'points': pts, 'obs': nws.get('obs') or [], 'alerts': alerts, 'afd': afd,
        'fire': {'names': (nws.get('fire') or {}).get('names'), 'days': fire},
        'ero': {'names': (nws.get('ero') or {}).get('names'), 'days': ero},
    }


# ---------------------------------------------------------------- main build

def build(atlas_path):
    blocks = read_atlas(atlas_path)
    A = blocks['atlas']
    geo = A['geo']
    proj = Proj(geo)
    cols = A['zcols']
    ci = {c: i for i, c in enumerate(cols)}
    zrows = A['zrows']
    log('atlas:', len(zrows), 'ZIPs,', len(A['parishes']), 'counties,', len(A['cities']), 'cities,', len(A['places']), 'places')

    acs = read_acs()
    log('acs:', len(acs), 'ZCTAs')

    # counties and regions
    counties = A['parishes']
    reg_of_county = {}
    for key, name, the, names in REGIONS:
        for n in names:
            reg_of_county[n] = key
    county_idx = {c['fips']: i for i, c in enumerate(counties)}

    # FEMA declarations, joined to the counties they covered
    decl = {}
    for row in A['ts'].get('fema_decl') or []:
        dr, typ, date, kind, title, ncty = row[0], row[1], row[2], row[3], row[4], row[5]
        decl[str(dr)] = {'dr': dr, 'type': typ, 'date': date, 'kind': kind, 'title': title, 'ncty': ncty}
    fema_named = {str(f['dr']): f for f in A.get('fema') or []}

    out_counties = []
    for c in counties:
        events = []
        for dr in (c.get('fema_all') or {}):
            d = decl.get(str(dr))
            if not d:
                continue
            label = (fema_named.get(str(dr)) or {}).get('label')
            events.append([d['date'], d['kind'], label or d['title'].title()[:80], d['type']])
        events.sort(key=lambda e: e[0], reverse=True)
        out_counties.append({
            'fips': c['fips'], 'name': c['name'], 'region': reg_of_county.get(c['name']), 'seat': c.get('seat'),
            'lat': rnd(c.get('lat'), 4), 'lon': rnd(c.get('lon'), 4), 'pop': c.get('pop'), 'hh': c.get('hh'),
            'inc': c.get('inc'), 'value': c.get('value'), 'lastfire': c.get('lastfire'),
            'fema': events[:40],
        })

    # provinces
    provinces = []
    for p in blocks['prov']['prov']:
        rings = [decode_polyline(r, 3) for r in p.get('r', [])]
        provinces.append({'name': p['n'], 'lat': p.get('la'), 'lon': p.get('lo'), 'rings': rings})

    def province_of(lat, lon):
        for i, p in enumerate(provinces):
            hits = sum(1 for r in p['rings'] if point_in_ring(lat, lon, r))
            if hits % 2 == 1:
                return i
        best, bi = 1e9, 0
        for i, p in enumerate(provinces):
            for r in p['rings']:
                for (la, lo) in r[::max(1, len(r) // 60)]:
                    d = haversine_km(lat, lon, la, lo)
                    if d < best:
                        best, bi = d, i
        return bi

    # NWS zones
    zones = A['hz'].get('zones') or []
    zone_name = {z['ugc']: z['name'] for z in zones}
    zone_list = sorted(zone_name)
    zone_index = {u: i for i, u in enumerate(zone_list)}
    zip_zone = {}
    for zrec in zones:
        for zz in zrec.get('zips') or []:
            zip_zone.setdefault(zz, zrec['ugc'])

    # fires: keep every fire any ZIP references, plus the biggest
    fires_src = A['hz'].get('fires') or []
    zfire = A['hz'].get('zfire') or {}
    used = set()
    zip_fires = {}
    for z, lst in zfire.items():
        srt = sorted(lst, key=lambda a: (-((a[1] or 0) + (a[2] or 0)), a[3] if a[3] is not None else 999, -(a[4] or 0)))
        keep = srt[:6]
        zip_fires[z] = keep
        used.update(a[0] for a in keep)
    for i, f in sorted(enumerate(fires_src), key=lambda t: -((t[1].get('acres') or 0)))[:120]:
        used.add(i)
    fire_map = {}
    fires = []
    for i in sorted(used):
        if i >= len(fires_src):
            continue
        f = fires_src[i]
        fire_map[i] = len(fires)
        fires.append([f.get('name'), f.get('year'), f.get('acres'), f.get('dest'), f.get('dmg'), rnd(f.get('lat'), 3),
                      rnd(f.get('lon'), 3), f.get('cause'), f.get('start')])

    # atmospheric rivers and wind events
    ars = []
    for a in A['hz'].get('ar_big') or []:
        ars.append([a.get('start', '')[:10], a.get('rank'), a.get('peak_at'), a.get('stretch'), a.get('lat0'), a.get('lat1'),
                    a.get('se_dmg'), a.get('se_deaths'), a.get('dur_h'), (a.get('gust') or [None, None, None])[1]])
    winds = []
    for w in A['hz'].get('wind') or []:
        winds.append([w.get('kind'), w.get('start'), w.get('gust'), w.get('where'), w.get('fips') or [], w.get('dmg'), w.get('deaths')])

    # ZIP table
    keep_rows = [r for r in zrows if (r[ci['pop']] or 0) > 0]
    keep_rows.sort(key=lambda r: r[0])
    N = len(keep_rows)
    z = {name: [] for name, _, _ in ATLAS_COLS}
    for r in keep_rows:
        for name, src, kind in ATLAS_COLS:
            v = r[ci[src]] if src in ci else None
            if kind == 's':
                v = None if v in (None, '') else str(v)
            elif kind == 'i':
                v = None if v is None else int(round(float(v)))
            else:
                v = None if v is None else rnd(float(v), int(kind[1:]))
            z[name].append(v)
    # derived columns
    z['x'], z['y'], z['tx'], z['ty'], z['province'], z['zoneName'], z['region'] = [], [], [], [], [], [], []
    z['fires'] = []
    for i in range(N):
        lat, lon = z['lat'][i], z['lon'][i]
        tlat, tlon = z['tlat'][i] or lat, z['tlon'][i] or lon
        x, y = proj.xy(lat, lon)
        tx, ty = proj.xy(tlat, tlon)
        z['x'].append(round(x, 1)); z['y'].append(round(y, 1)); z['tx'].append(round(tx, 1)); z['ty'].append(round(ty, 1))
        z['province'].append(province_of(tlat, tlon))
        zc = zip_zone.get(z['zip'][i]) or z['zone'][i]
        z['zone'][i] = zc
        z['zoneName'].append(zone_index.get(zc, -1))
        cname = counties[z['county'][i]]['name'] if z['county'][i] is not None else None
        z['region'].append(reg_of_county.get(cname))
        refs = []
        for a in zip_fires.get(z['zip'][i], []):
            if a[0] in fire_map:
                refs.append([fire_map[a[0]], a[1] or 0, a[2] or 0, rnd(a[3], 1) if a[3] is not None else None, rnd(a[4] or 0, 1)])
        z['fires'].append(refs)

    # ACS rows aligned with the ZIP table
    layout = {}
    off = 0
    for block, _, cells in ACS_LAYOUT:
        layout[block] = [off, len(cells)]
        off += len(cells)
    acs_rows, missing = [], 0
    for zz in z['zip']:
        rec = acs.get(zz)
        if rec is None:
            missing += 1
            acs_rows.append([0] * off)
            continue
        row = []
        for block, _, _ in ACS_LAYOUT:
            row.extend(rec[block])
        acs_rows.append(row)
    log('acs rows aligned; ZIPs without an ACS row:', missing)

    # shapes
    shapes = {
        'zip': [geo['zcta'].get(zz) for zz in z['zip']],
        'county': [geo['parish'].get(c['fips']) for c in counties],
        'outline': geo['outline'],
        'water': geo['water'],
        'waterName': geo['wname'],
        'neighbors': geo['neighbors'],
    }

    # places and cities
    places = []
    for p in A['places']:
        x, y = proj.xy(p['lat'], p['lon'])
        places.append([p['name'], rnd(p['lat'], 4), rnd(p['lon'], 4), p.get('pop'), 1 if p.get('cdp') else 0,
                       1 if p.get('seat') else 0, p.get('pi'), round(x, 1), round(y, 1)])
    cities = []
    for c in A['cities']:
        cities.append([c['name'], c.get('pi'), c.get('pop'), c.get('zips') or [], rnd(c.get('lat'), 4), rnd(c.get('lon'), 4)])

    # gazetteer
    gz = blocks['gaz']
    gaz = []
    for f in gz['f']:
        lat, lon = f[3] / 1e4, f[4] / 1e4
        x, y = proj.xy(lat, lon)
        gaz.append([f[0], f[1], f[2], round(lat, 4), round(lon, 4), f[5], round(x, 1), round(y, 1)])

    # roads
    aadt = decode_aadt(blocks['aadt'], proj)
    roads = build_roads(aadt)
    log('roads:', len(roads), 'routes,', sum(len(r['lines']) for r in roads), 'polylines from', len(aadt), 'count points')

    weather = compact_weather(blocks['nws'])

    meta = A['meta']
    pack = {
        'v': 1,
        'name': 'Legion world pack',
        'compiled': A.get('compiled'),
        'atlasCompiled': A.get('compiled'),
        'sources': [
            {'k': 'atlas', 'name': 'California Roofer Guru atlas', 'vintage': 'compiled ' + str(A.get('compiled')),
             'note': 'ZIP, county, city and place tables; outlines; climate records; wildfire history; insurance; business counts'},
            {'k': 'acs', 'name': 'U.S. Census Bureau, American Community Survey 2020-2024 5-year estimates, table-based summary file, by ZCTA',
             'vintage': '2024 5-year', 'tables': [t.upper() for t in ACS_TABLES]},
            {'k': 'nws', 'name': 'National Weather Service (api.weather.gov) snapshot carried by the atlas', 'vintage': weather['fetched']},
            {'k': 'aadt', 'name': 'Caltrans Traffic Census, annual average daily traffic', 'vintage': str(blocks['aadt']['year'])},
            {'k': 'gnis', 'name': 'USGS GNIS Domestic Names (California)', 'vintage': gz.get('src', '')[:120]},
            {'k': 'cgs', 'name': 'California Geological Survey geomorphic provinces (CGS Note 36)', 'vintage': 'simplified'},
            {'k': 'frap', 'name': 'CAL FIRE fire perimeters and damage inspections, as compiled by the atlas', 'vintage': 'through 2025'},
            {'k': 'fema', 'name': 'FEMA disaster declarations (OpenFEMA), as compiled by the atlas', 'vintage': 'through 2026'},
        ],
        'proj': {k: geo[k] for k in ('W', 'H', 'minx', 'maxy', 'kx', 'sx')},
        'state': {'pop': meta['state']['pop'], 'hh': meta['state']['hh'], 'inc': meta['state']['inc'],
                  'value': meta['state']['value'], 'age_med': meta['state'].get('age_med'), 'nzip': N},
        'regions': [{'key': k, 'name': n, 'the': t, 'counties': [counties[county_idx_name]['fips'] for county_idx_name in
                                                                   [i for i, c in enumerate(counties) if c['name'] in names]]}
                    for k, n, t, names in REGIONS],
        'counties': out_counties,
        'zcols': list(z.keys()),
        'z': z,
        'acs': {'layout': layout, 'labels': ACS_LABELS, 'rows': acs_rows},
        'shapes': shapes,
        'places': places,
        'cities': cities,
        'gazKinds': gz['k'],
        'gaz': gaz,
        'provinces': [p['name'] for p in provinces],
        'zones': [[u, zone_name[u]] for u in zone_list],
        'roads': roads,
        'weather': weather,
        'fires': fires,
        'fireCols': ['name', 'year', 'acres', 'dest', 'dmg', 'lat', 'lon', 'cause', 'start'],
        'ars': ars,
        'arCols': ['start', 'rank', 'peak_at', 'stretch', 'lat0', 'lat1', 'dmg', 'deaths', 'hours', 'gust_at'],
        'winds': winds,
        'windCols': ['kind', 'start', 'gust', 'where', 'fips', 'dmg', 'deaths'],
    }
    return pack


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--atlas', default=os.path.join(REPO, 'dist', 'california-roofer-guru.html'))
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--fetch-acs', action='store_true')
    args = ap.parse_args()
    if args.fetch_acs:
        fetch_acs()
    if not os.path.exists(args.atlas):
        raise SystemExit('atlas not found: %s (pass --atlas)' % args.atlas)
    pack = build(args.atlas)
    raw = json.dumps(pack, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with gzip.GzipFile(args.out, 'wb', compresslevel=9, mtime=0) as fh:
        fh.write(raw.encode('utf-8'))
    log('wrote', args.out, '%.2f MB raw, %.2f MB gzip' % (len(raw) / 1e6, os.path.getsize(args.out) / 1e6))


if __name__ == '__main__':
    main()
