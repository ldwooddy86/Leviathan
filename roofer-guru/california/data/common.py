"""Shared paths and helpers for the California atlas data build. Run scripts with python3 -I."""
import csv, json, os, sys, math

HERE = os.path.dirname(os.path.abspath(__file__))
CA = os.path.dirname(HERE)
DL = os.path.join(CA, 'dl', 'people')
WORK = os.path.join(HERE, 'work')
OUT = os.path.join(HERE, 'out')
MYDL = os.path.join(HERE, 'dl')
HAZ = os.path.join(HERE, 'hazard', 'out')
for d in (WORK, OUT):
    os.makedirs(d, exist_ok=True)
csv.field_size_limit(10 ** 9)

LINES = ['replace', 'repair', 'storm', 'fire', 'harden', 'tile', 'solar', 'metal', 'mh', 'mf', 'comm', 'coat', 'newc']
RES = LINES[:9]
COM = LINES[9:]

REG = {1: 'North Coast', 2: 'Far North', 3: 'Sacramento Valley', 4: 'Sierra', 5: 'Bay Area', 6: 'Central Coast',
       7: 'San Joaquin Valley', 8: 'Los Angeles and Ventura', 9: 'Orange County', 10: 'Inland Empire',
       11: 'San Diego and Imperial'}
REGK = {1: 'nc', 2: 'fn', 3: 'sv', 4: 'si', 5: 'ba', 6: 'cc', 7: 'sj', 8: 'la', 9: 'oc', 10: 'ie', 11: 'sd'}
REG_COUNTIES = {
    1: ['Del Norte', 'Humboldt', 'Mendocino', 'Lake'],
    2: ['Siskiyou', 'Modoc', 'Shasta', 'Lassen', 'Tehama', 'Trinity', 'Plumas'],
    3: ['Butte', 'Glenn', 'Colusa', 'Sutter', 'Yuba', 'Yolo', 'Sacramento', 'Placer', 'El Dorado'],
    4: ['Sierra', 'Nevada', 'Amador', 'Calaveras', 'Tuolumne', 'Mariposa', 'Alpine', 'Mono', 'Inyo'],
    5: ['Alameda', 'Contra Costa', 'Marin', 'Napa', 'San Francisco', 'San Mateo', 'Santa Clara', 'Solano', 'Sonoma'],
    6: ['Santa Cruz', 'San Benito', 'Monterey', 'San Luis Obispo', 'Santa Barbara'],
    7: ['San Joaquin', 'Stanislaus', 'Merced', 'Madera', 'Fresno', 'Kings', 'Tulare', 'Kern'],
    8: ['Los Angeles', 'Ventura'],
    9: ['Orange'],
    10: ['Riverside', 'San Bernardino'],
    11: ['San Diego', 'Imperial'],
}
COUNTY_REG = {c: r for r, cs in REG_COUNTIES.items() for c in cs}
SEATS = {'Alameda': 'Oakland', 'Alpine': 'Markleeville', 'Amador': 'Jackson', 'Butte': 'Oroville', 'Calaveras': 'San Andreas',
         'Colusa': 'Colusa', 'Contra Costa': 'Martinez', 'Del Norte': 'Crescent City', 'El Dorado': 'Placerville',
         'Fresno': 'Fresno', 'Glenn': 'Willows', 'Humboldt': 'Eureka', 'Imperial': 'El Centro', 'Inyo': 'Independence',
         'Kern': 'Bakersfield', 'Kings': 'Hanford', 'Lake': 'Lakeport', 'Lassen': 'Susanville', 'Los Angeles': 'Los Angeles',
         'Madera': 'Madera', 'Marin': 'San Rafael', 'Mariposa': 'Mariposa', 'Mendocino': 'Ukiah', 'Merced': 'Merced',
         'Modoc': 'Alturas', 'Mono': 'Bridgeport', 'Monterey': 'Salinas', 'Napa': 'Napa', 'Nevada': 'Nevada City',
         'Orange': 'Santa Ana', 'Placer': 'Auburn', 'Plumas': 'Quincy', 'Riverside': 'Riverside', 'Sacramento': 'Sacramento',
         'San Benito': 'Hollister', 'San Bernardino': 'San Bernardino', 'San Diego': 'San Diego',
         'San Francisco': 'San Francisco', 'San Joaquin': 'Stockton', 'San Luis Obispo': 'San Luis Obispo',
         'San Mateo': 'Redwood City', 'Santa Barbara': 'Santa Barbara', 'Santa Clara': 'San Jose', 'Santa Cruz': 'Santa Cruz',
         'Shasta': 'Redding', 'Sierra': 'Downieville', 'Siskiyou': 'Yreka', 'Solano': 'Fairfield', 'Sonoma': 'Santa Rosa',
         'Stanislaus': 'Modesto', 'Sutter': 'Yuba City', 'Tehama': 'Red Bluff', 'Trinity': 'Weaverville', 'Tulare': 'Visalia',
         'Tuolumne': 'Sonora', 'Ventura': 'Ventura', 'Yolo': 'Woodland', 'Yuba': 'Marysville'}
NOW = 2026


def rd(path, **kw):
    with open(path, newline='', encoding=kw.pop('encoding', 'utf-8-sig')) as f:
        return list(csv.DictReader(f, **kw))


def num(x):
    if x is None:
        return None
    x = str(x).strip().replace(',', '')
    if x in ('', '.', 'null', 'None'):
        return None
    try:
        v = float(x)
    except ValueError:
        return None
    if v <= -666666:
        return None
    return v


def n0(x):
    v = num(x)
    return 0.0 if v is None else v


def r1(x, d=1):
    return None if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))) else round(x, d)


def pct(a, b, d=1):
    return None if not b else round(100.0 * a / b, d)


def save(name, obj):
    p = os.path.join(WORK, name)
    with open(p + '.tmp', 'w') as f:
        json.dump(obj, f, separators=(',', ':'))
    os.replace(p + '.tmp', p)
    print('wrote', p, os.path.getsize(p))


def load(name):
    with open(os.path.join(WORK, name)) as f:
        return json.load(f)


def hav_km(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


def titlecase(s):
    s = ' '.join(w.capitalize() for w in s.strip().lower().split())
    out = []
    for w in s.split(' '):
        if w.startswith('Mc') and len(w) > 2:
            w = 'Mc' + w[2:].capitalize()
        if '-' in w:
            w = '-'.join(x.capitalize() for x in w.split('-'))
        out.append(w)
    s = ' '.join(out)
    for a, b in ((' Of ', ' of '), (' By The ', ' by the '), (' De ', ' de '), (' Del ', ' del '), (' La ', ' la '), (' Afb', ' AFB')):
        if s.find(a) > 0:
            s = s.replace(a, b)
    return s
