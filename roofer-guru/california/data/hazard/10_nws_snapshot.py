#!/usr/bin/env python3
"""Live weather snapshot for the Weather Desk (window.__NWS_SNAPSHOT__ for California).
Same structure as Louisiana's snapshot (fetched, source, points, alerts, obs, afd) with California's ten offices and
eleven forecast points; `nhc` and `spc` are replaced by `fire` (SPC fire weather outlook), `ero` (WPC excessive
rainfall outlook), `rain` (California Nevada River Forecast Center discussion) and `ar` (what is and is not public).
No personal details are sent: the only request header is a generic client name.
Run: python3 -I 10_nws_snapshot.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hazlib import *
import urllib.request, urllib.error, datetime, re

UA = {'User-Agent': 'roof-weather-atlas/1.0', 'Accept': 'application/geo+json, application/json'}
RAW = os.path.join(WORK, 'nws_raw'); os.makedirs(RAW, exist_ok=True)
REQ = []

# one forecast point per region (DESIGN.md region keys). Choices are mine: the largest or most typical roofing market
# of the region; Truckee stands for the Sierra because snow load is the region's roofing hazard.
POINTS = [('Eureka', 40.8021, -124.1637, 'nc'), ('Redding', 40.5865, -122.3917, 'fn'), ('Sacramento', 38.5816, -121.4944, 'sv'),
          ('Truckee', 39.3280, -120.1833, 'si'), ('San Francisco', 37.7749, -122.4194, 'ba'), ('Santa Barbara', 34.4208, -119.6982, 'cc'),
          ('Fresno', 36.7378, -119.7871, 'sj'), ('Los Angeles', 34.0522, -118.2437, 'la'), ('Santa Ana', 33.7455, -117.8677, 'oc'),
          ('Riverside', 33.9806, -117.3755, 'ie'), ('San Diego', 32.7157, -117.1611, 'sd')]
OFFICES = [('EKA', 'Eureka'), ('STO', 'Sacramento'), ('MTR', 'San Francisco Bay Area and Monterey'), ('HNX', 'Hanford and the San Joaquin Valley'),
           ('LOX', 'Los Angeles and Oxnard'), ('SGX', 'San Diego'), ('MFR', 'Medford'), ('REV', 'Reno'), ('VEF', 'Las Vegas'), ('PSR', 'Phoenix')]
STATIONS = ['KCEC', 'KACV', 'KUKI', 'KRDD', 'KMHS', 'KSMF', 'KSAC', 'KTRK', 'KTVL', 'KMMH', 'KBIH', 'KSFO', 'KOAK', 'KSJC', 'KSTS', 'KMRY', 'KSBP',
            'KSBA', 'KSCK', 'KFAT', 'KBFL', 'KLAX', 'KBUR', 'KVNY', 'KLGB', 'KSNA', 'KONT', 'KRAL', 'KPSP', 'KDAG', 'KSAN', 'KNZY', 'KIPL']


def get(url, name=None, tries=4, raw=False):
    err = None
    for k in range(tries):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
            REQ.append({'url': url, 'status': 200, 'bytes': len(b)})
            if name:
                open(os.path.join(RAW, name), 'wb').write(b)
            time.sleep(0.25)
            return b.decode('utf-8', 'replace') if raw else json.loads(b)
        except urllib.error.HTTPError as e:
            err = 'HTTP %d' % e.code
            if e.code in (400, 403, 404, 407):
                break
        except Exception as e:
            err = str(e)[:120]
        time.sleep(1.5 + 2 * k)
    REQ.append({'url': url, 'status': err})
    log('FAILED', url, err)
    return None


def val(o):
    return o.get('value') if isinstance(o, dict) else o


def flat_weather(v):
    out = []
    for w in v or []:
        if not w.get('weather'):
            continue
        s = w['weather']
        if w.get('intensity'):
            s += ':' + w['intensity']
        if w.get('attributes'):
            s += '[' + '|'.join(w['attributes']) + ']'
        out.append(s)
    return ', '.join(out)


GRID_KEYS = ['probabilityOfThunder', 'quantitativePrecipitation', 'windGust', 'windSpeed', 'probabilityOfPrecipitation', 'visibility',
             # added for California (not in Louisiana's snapshot): snow, humidity for fire weather, sky for marine layer
             'snowfallAmount', 'snowLevel', 'relativeHumidity', 'skyCover']


def point(city, lat, lon, reg):
    p = (get('https://api.weather.gov/points/%.4f,%.4f' % (lat, lon), 'points_%s.json' % reg) or {}).get('properties') or {}
    d = {'city': city, 'lat': lat, 'lon': lon, 'reg': reg, 'office': p.get('gridId'), 'gridX': p.get('gridX'), 'gridY': p.get('gridY'),
         'zone': (p.get('forecastZone') or '').rsplit('/', 1)[-1], 'county': (p.get('county') or '').rsplit('/', 1)[-1],
         'fireZone': (p.get('fireWeatherZone') or '').rsplit('/', 1)[-1], 'radar': p.get('radarStation'), 'updated': None, 'periods': [], 'hourly': [], 'grid': {}}
    if not p:
        return d
    f = (get(p['forecast'], 'fc_%s.json' % reg) or {}).get('properties') or {}
    d['updated'] = f.get('updateTime') or f.get('updated')
    for q in (f.get('periods') or [])[:14]:
        d['periods'].append({'name': q.get('name'), 'start': q.get('startTime'), 'end': q.get('endTime'), 'isDay': q.get('isDaytime'), 'tempF': q.get('temperature'),
                             'short': q.get('shortForecast'), 'pop': val(q.get('probabilityOfPrecipitation')), 'wind': q.get('windSpeed'), 'detail': (q.get('detailedForecast') or '')[:300]})
    h = (get(p['forecastHourly'], 'hr_%s.json' % reg) or {}).get('properties') or {}
    for q in (h.get('periods') or [])[:120]:
        d['hourly'].append({'t': q.get('startTime'), 'tempF': q.get('temperature'), 'rh': val(q.get('relativeHumidity')), 'pop': val(q.get('probabilityOfPrecipitation')),
                            'wind': q.get('windSpeed'), 'short': q.get('shortForecast'), 'isDay': q.get('isDaytime')})
    g = (get(p['forecastGridData'], 'grid_%s.json' % reg) or {}).get('properties') or {}
    for k in GRID_KEYS:
        vals = (g.get(k) or {}).get('values') or []
        if vals:
            d['grid'][k] = [[v['validTime'], (round(v['value'], 3) if isinstance(v['value'], float) else v['value'])] for v in vals[:72]]
    wv = (g.get('weather') or {}).get('values') or []
    d['grid']['weather'] = [[v['validTime'], flat_weather(v['value'])] for v in wv[:72] if flat_weather(v['value'])]
    return d


def alerts():
    j = get('https://api.weather.gov/alerts/active?area=CA', 'alerts_CA.json') or {}
    out = []
    for f in j.get('features') or []:
        a = f.get('properties') or {}
        pr = a.get('parameters') or {}
        gc = a.get('geocode') or {}
        out.append({'id': a.get('id'), 'event': a.get('event'), 'severity': a.get('severity'), 'urgency': a.get('urgency'), 'headline': a.get('headline'),
                    'description': (a.get('description') or '')[:1500], 'instruction': (a.get('instruction') or '')[:800], 'onset': a.get('onset'), 'ends': a.get('ends'),
                    'expires': a.get('expires'), 'areas': a.get('areaDesc'), 'sent': a.get('sent'), 'hail': (pr.get('maxHailSize') or [None])[0], 'gust': (pr.get('maxWindGust') or [None])[0],
                    # added for California: zone codes and county FIPS so an alert can be drawn on counties, and the sender
                    'zones': gc.get('UGC') or [], 'fips': sorted({'0' + s[1:] if len(s) == 6 else s for s in (gc.get('SAME') or [])}), 'sender': a.get('senderName')})
    return out


def obs():
    out = []
    for s in STATIONS:
        j = get('https://api.weather.gov/stations/%s/observations/latest' % s, tries=2)
        if not j:
            continue
        p = j.get('properties') or {}
        c = (j.get('geometry') or {}).get('coordinates') or [None, None]
        def cv(k, f):
            v = val(p.get(k))
            return None if v is None else round(f(v), 1)
        out.append({'id': s, 'lat': c[1], 'lon': c[0], 'time': p.get('timestamp'), 'tempF': cv('temperature', lambda v: v * 9 / 5 + 32), 'visMi': cv('visibility', lambda v: v / 1609.344),
                    'text': p.get('textDescription'), 'windMph': cv('windSpeed', lambda v: v / 1.609344), 'gustMph': cv('windGust', lambda v: v / 1.609344),
                    'rh': cv('relativeHumidity', lambda v: v)})
    return out


def latest_product(code, office=None, wmo=None, n=1):
    url = 'https://api.weather.gov/products/types/%s' % code + ('/locations/%s' % office if office else '')
    g = (get(url) or {}).get('@graph') or []
    if wmo:
        g = [x for x in g if x.get('wmoCollectiveId') == wmo]
    out = []
    for x in g[:n]:
        j = get(x['@id']) or {}
        out.append({'issued': j.get('issuanceTime'), 'text': j.get('productText') or '', 'wmo': x.get('wmoCollectiveId'), 'office': x.get('issuingOffice')})
    return out


def county_levels(features, levelof, counties, min_share=0.005):
    """Highest outlook level per county FIPS: a county takes a level when the outlook polygon covers at least
    min_share of its area (or 25 km2)."""
    from shapely.geometry import shape
    lev = {f: 0 for f in counties}
    polys = []
    for ft in features:
        gm = ft.get('geometry') or {}
        L = levelof(ft.get('properties') or {})
        if not L or gm.get('type') not in ('Polygon', 'MultiPolygon'):
            continue
        g = shape(gm)
        if not g.is_valid:
            g = g.buffer(0)
        hit = False
        for f, cg in counties.items():
            if not g.intersects(cg):
                continue
            a = to_albers(g.intersection(cg)).area
            if a >= min_share * to_albers(cg).area or a >= 25e6:
                lev[f] = max(lev[f], L); hit = True
        if hit:  # keep the part of the polygon near California for drawing
            from shapely.geometry import box
            c = g.intersection(box(-125.5, 31.5, -113.0, 43.0)).simplify(0.02)
            for part in (c.geoms if hasattr(c, 'geoms') else [c]):
                if part.geom_type == 'Polygon' and not part.is_empty:
                    polys.append({'level': L, 'ring': [[round(x, 2), round(y, 2)] for x, y in part.exterior.coords]})
    return lev, polys


def main():
    from shapely.geometry import shape
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
    snap = {'fetched': now.isoformat(), 'tz': 'America/Los_Angeles',
            'source': 'api.weather.gov (NWS Eureka EKA, Sacramento STO, San Francisco Bay Area MTR, Hanford HNX, Los Angeles LOX, San Diego SGX, Medford MFR, Reno REV, Las Vegas VEF, Phoenix PSR offices); SPC fire weather outlook; WPC excessive rainfall outlook; CNRFC'}
    log('points')
    snap['points'] = [point(*p) for p in POINTS]
    jdump(snap, os.path.join(WORK, 'snapshot_partial.json'))
    log('alerts'); snap['alerts'] = alerts()
    log('obs'); snap['obs'] = obs()
    log('afd')
    snap['afd'] = {}
    for o, name in OFFICES:
        pr = latest_product('AFD', o)
        if pr:
            snap['afd'][o] = {'issued': pr[0]['issued'], 'text': pr[0]['text'], 'name': name}
    jdump(snap, os.path.join(WORK, 'snapshot_partial.json'))

    counties = {}
    for f in jload(os.path.join(GEO, 'ca_county_2024_5m.geojson'))['features']:
        counties[f['properties']['GEOID']] = shape(f['geometry']).buffer(0)

    log('fire weather outlook')
    FL = {'ELEV': 1, 'CRIT': 2, 'EXTM': 3}
    DL = {'IDRT': 1, 'SDRT': 2, 'ISODRYT': 1, 'SCTDRYT': 2}
    fire = {'names': ['None', 'Elevated', 'Critical', 'Extremely critical'], 'dry_names': ['None', 'Isolated dry thunderstorms', 'Scattered dry thunderstorms'],
            'src': 'NOAA Storm Prediction Center fire weather outlook, days 1 and 2 (https://www.spc.noaa.gov/products/fire_wx/), intersected with county boundaries'}
    for day in ('1', '2'):
        w = get('https://www.spc.noaa.gov/products/fire_wx/day%sfw_windrh.nolyr.geojson' % day, 'fw%s_windrh.json' % day) or {}
        t = get('https://www.spc.noaa.gov/products/fire_wx/day%sfw_dryt.nolyr.geojson' % day, 'fw%s_dryt.json' % day) or {}
        fts = w.get('features') or []
        pr = (fts[0].get('properties') if fts else {}) or {}
        lev, polys = county_levels(fts, lambda p: FL.get(p.get('LABEL'), 0), counties)
        dlev, dpolys = county_levels(t.get('features') or [], lambda p: DL.get(p.get('LABEL'), 1 if (p.get('DN') or 0) > 0 else 0), counties)
        fire[day] = {'valid': pr.get('VALID'), 'expire': pr.get('EXPIRE'), 'issued': pr.get('ISSUE_ISO'), 'levels': lev, 'dry': dlev, 'polys': polys, 'dry_polys': dpolys,
                     'ok': bool(fts)}
    fw = latest_product('FWD', wmo='FNUS21') or latest_product('FWD')
    fire['text'] = {'issued': fw[0]['issued'], 'text': fw[0]['text']} if fw else {'issued': None, 'text': ''}
    fw2 = latest_product('FWD', wmo='FNUS22')
    if fw2:
        fire['text2'] = {'issued': fw2[0]['issued'], 'text': fw2[0]['text']}
    snap['fire'] = fire

    log('excessive rainfall outlook')
    ero = {'names': ['None', 'Marginal (at least 5%)', 'Slight (at least 15%)', 'Moderate (at least 40%)', 'High (at least 70%)'],
           'src': 'NOAA Weather Prediction Center excessive rainfall outlook, days 1 to 3 (https://www.wpc.ncep.noaa.gov/qpf/excessive_rainfall_outlook_ero.php), intersected with county boundaries. The level is the chance of rainfall exceeding flash flood guidance within 25 miles of a point.'}
    for day in ('1', '2', '3'):
        j = get('https://www.wpc.ncep.noaa.gov/exper/eromap/geojson/Day%s_Latest.geojson' % day, 'ero%s.json' % day) or {}
        fts = j.get('features') or []
        pr = (fts[0].get('properties') if fts else {}) or {}
        lev, polys = county_levels(fts, lambda p: int(p.get('dn') or 0), counties)
        ero[day] = {'valid': pr.get('VALID_TIME'), 'issued': pr.get('ISSUE_TIME'), 'start': pr.get('START_TIME'), 'end': pr.get('END_TIME'), 'levels': lev, 'polys': polys, 'ok': bool(j)}
    snap['ero'] = ero

    log('rain discussion')
    hm = latest_product('HMD', wmo='AGUS76') or []
    snap['rain'] = {'cnrfc': ({'issued': hm[0]['issued'], 'text': hm[0]['text']} if hm else {'issued': None, 'text': ''}),
                    'src': 'California Nevada River Forecast Center hydrometeorological discussion (product HMD, AGUS76 KRSA) from api.weather.gov'}
    # rain totals from the gridded forecast: mm in the next 24 and 72 hours at each point
    def dur_h(vt):
        m = re.search(r'/P(?:(\d+)D)?T?(?:(\d+)H)?', vt)
        return (int(m.group(1) or 0) * 24 + int(m.group(2) or 0)) if m else 1
    qpf = {}
    for p in snap['points']:
        s24 = s72 = 0.0; t0 = None
        for vt, v in p['grid'].get('quantitativePrecipitation', []):
            st = datetime.datetime.fromisoformat(vt.split('/')[0])
            t0 = t0 or st
            hrs = (st - t0).total_seconds() / 3600
            if v and hrs < 72:
                s72 += v
                if hrs < 24:
                    s24 += v
        gmax = max([v for vt, v in p['grid'].get('windGust', []) if v is not None] or [0])
        qpf[p['city']] = {'mm24': round(s24, 1), 'mm72': round(s72, 1), 'in24': round(s24 / 25.4, 2), 'in72': round(s72 / 25.4, 2), 'gust72_mph': round(gmax / 1.609344)}
    snap['rain']['qpf'] = qpf
    ment = {}
    for o, a in snap['afd'].items():
        n = len(re.findall(r'atmospheric\s+river', a['text'], flags=re.I))
        if n:
            ment[o] = n
    snap['ar'] = {'available': False,
                  'note': 'No machine readable atmospheric river scale forecast was found: the CW3E forecast page (https://cw3e.ucsd.edu/tools/forecasts/atmospheric-river-scale-forecasts/) publishes images only. This block carries what is public as data: the offices whose forecast discussion names an atmospheric river, and the forecast rain at each point (rain.qpf).',
                  'afd_mentions': ment, 'page': 'https://cw3e.ucsd.edu/tools/forecasts/atmospheric-river-scale-forecasts/'}
    snap['requests'] = {'n': len(REQ), 'failed': [r for r in REQ if r['status'] != 200], 'client': UA['User-Agent']}
    n = jdump(snap, os.path.join(OUT, 'ca_nws_snapshot.json'))
    jdump(REQ, os.path.join(WORK, 'nws_request_log.json'), indent=1)
    log('wrote ca_nws_snapshot.json', n, 'bytes; points', [(p['city'], p['office'], len(p['hourly']), len(p['grid'])) for p in snap['points']],
        'alerts', len(snap['alerts']), 'obs', len(snap['obs']), 'afd', list(snap['afd']), 'failed', len(snap['requests']['failed']))


if __name__ == '__main__':
    main()
