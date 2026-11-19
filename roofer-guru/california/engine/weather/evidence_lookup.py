"""Looks up, in the files already on disk, the anchors the weather scale quotes: the CW3E rank of named California
storms at the nearest coastal point, and Storm Events narratives that give a rain rate by the hour, a snow level, a
dense fog visibility or a smoke/ash note. Prints; writes nothing.  python3 -I evidence_lookup.py"""
import csv, gzip, re, os, sys
H = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'dl', 'hazard')
rows = list(csv.DictReader(open(os.path.join(H, 'atmospheric_rivers', 'CW3E_AR_events_all_points.csv'))))
def ar(lat, d0, d1):
    out = []
    for r in rows:
        if abs(float(r['lat']) - lat) < 0.01 and r['start_utc'][:8] <= d1 and r['end_utc'][:8] >= d0:
            out.append((r['lat'], r['start_utc'], r['end_utc'], r['duration_h'], r['max_ivt'], 'AR' + r['ar_scale']))
    return out
for name, lat, d0, d1 in [('4 Jan 2008 Sacramento wind', 38.0, '20080103', '20080105'), ('Feb 2024 Los Angeles', 34.0, '20240203', '20240206'),
                          ('Jan 2023 Bay Area (4-5 Jan)', 37.5, '20230103', '20230106'), ('31 Dec 2022 SF', 37.5, '20221230', '20230101'), ('17 Feb 2017 San Diego', 32.5, '20170216', '20170218'),
                          ('14 Dec 2024 SFO 83 mph', 37.5, '20241213', '20241215'), ('Feb 2017 Oroville', 39.5, '20170206', '20170210'), ('Oct 2021 bomb cyclone AR', 38.0, '20211023', '20211026'),
                          ('Jan 2017 north', 38.0, '20170107', '20170110'), ('Feb 2019 Russian River', 38.5, '20190225', '20190228'), ('Dec 2025 Pablo Point 108', 38.0, '20251223', '20251225'),
                          ('5 Feb 2024 Upper Bull', 36.5, '20240203', '20240206'), ('Feb 1986', 38.5, '19860212', '19860220'), ('Jan 1997', 39.0, '19961230', '19970103'), ('Jan 2005 LA', 34.0, '20050107', '20050111'), ('Mar 2023 south', 34.5, '20230309', '20230315')]:
    print(name, ar(lat, d0, d1))
pat = re.compile(sys.argv[1] if len(sys.argv) > 1 else r'(inch(es)? (per|an) hour|inches in (one|an|1) hour|snow levels?|visibilit|ash f|falling ash|power ?line|arcing|transformer)', re.I)
n = 0
with gzip.open(os.path.join(H, 'stormevents', 'CA_StormEvents_details_1950_2026.csv.gz'), 'rt', encoding='utf-8', errors='replace') as f:
    for r in csv.DictReader(f):
        t = (r.get('EVENT_NARRATIVE') or '') + ' || ' + (r.get('EPISODE_NARRATIVE') or '')
        for m in pat.finditer(t):
            a = max(0, m.start() - 170); b = min(len(t), m.end() + 150)
            key = m.group(0).lower()
            n += 1
            if n % int(sys.argv[2] if len(sys.argv) > 2 else 60) == 0:
                print('--', r['BEGIN_DATE_TIME'], r['EVENT_TYPE'], r['CZ_NAME'], '|', t[a:b].replace('\n', ' '))
print('matches', n)
