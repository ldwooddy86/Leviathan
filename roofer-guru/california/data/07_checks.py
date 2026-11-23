#!/usr/bin/env python3
"""Step 7. Checks on out/ca_atlas_data.json: every derived column is recomputed from the file's own inputs
(as the Louisiana contract's build tests do), totals are compared with published figures, shapes and
indexes are verified. Writes out/build_report.md and out/checks.json. Exit code 1 when a check fails.
Usage: python3 -I 07_checks.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import re, collections

P = os.path.join(OUT, 'ca_atlas_data.json')
raw = open(P).read()
D = json.loads(raw)
cols = D['zcols']
Z = [dict(zip(cols, r)) for r in D['zrows']]
PA = D['parishes']
M = D['meta']
MD = M['model']
res = []


def check(name, ok, detail=''):
    res.append({'name': name, 'ok': bool(ok), 'detail': str(detail)})


def maxdiff(pairs):
    m = 0.0
    n = 0
    for a, b in pairs:
        if a is None and b is None:
            continue
        if a is None or b is None:
            return float('inf'), n + 1
        m = max(m, abs(a - b))
        n += 1
    return m, n


def close(name, pairs, tol):
    m, n = maxdiff(list(pairs))
    check(name, m <= tol, 'largest difference %.4g over %d values (tolerance %g)' % (m, n, tol))


# ---- 1. structure
check('zcols are unique', len(set(cols)) == len(cols), '%d columns' % len(cols))
check('every row has one value per column', all(len(r) == len(cols) for r in D['zrows']), '%d rows' % len(Z))
check('no NaN or Infinity in the file', not re.search(r'\bNaN\b|Infinity', raw))
check('ZIP codes are unique and match 9[0-6]ddd', len({z['zip'] for z in Z}) == len(Z) and all(re.fullmatch(r'9[0-6]\d{3}', z['zip']) for z in Z))
for k in ('seg', 'routes', 'rlist', 'sids'):
    check('hurricane key %s is empty' % k, D[k] == [])
check('hurricane key zstorm is empty', D['zstorm'] == {})
bad = [c for c in cols if re.search(r'^hur|ts34|n64|n50_00|vmax|last64|yrs64|hail|fortified|french', c)]
check('no hurricane, hail line, FORTIFIED or French column', not bad, bad)
check('no Louisiana wording in keys or meta', not re.search(r'Louisiana|[Pp]arish(?!es")|LSLBC|FORTIFIED', json.dumps(M)) , '')

# ---- 2. counties and regions
check('58 counties in FIPS order', len(PA) == 58 and [p['fips'] for p in PA] == sorted(p['fips'] for p in PA))
want = {r: sorted(cs) for r, cs in REG_COUNTIES.items()}
got = collections.defaultdict(list)
for p in PA:
    got[p['reg']].append(p['name'])
check('eleven regions hold the counties DESIGN.md lists', all(sorted(got[r]) == want[r] for r in want) and len(got) == 11,
      {r: len(v) for r, v in sorted(got.items())})
check('meta.model.REG has keys 1 to 11', sorted(MD['REG'], key=int) == [str(i) for i in range(1, 12)])
check('every ZIP is in exactly one county and that county\'s region',
      all(isinstance(z['pi'], int) and 0 <= z['pi'] < 58 and z['reg'] == PA[z['pi']]['reg'] for z in Z))
check('P2R equals the county regions', all(MD['P2R'][p['fips']] == p['reg'] for p in PA))
check('county nzip sums to the ZIP count', sum(p['nzip'] for p in PA) == len(Z), sum(p['nzip'] for p in PA))
check('every county has one ZIP or more', all(p['nzip'] > 0 for p in PA), [p['name'] for p in PA if p['nzip'] == 0])

# ---- 3. geometry
G = D['geo']
pat = re.compile(r'(M-?\d+ -?\d+(l-?\d+ -?\d+){2,}z)+')
check('geo.zcta keys equal the zip column', set(G['zcta']) == {z['zip'] for z in Z}, 'missing %d, extra %d' % (
    len({z['zip'] for z in Z} - set(G['zcta'])), len(set(G['zcta']) - {z['zip'] for z in Z})))
check('geo.parish and geo.pcent keys equal the county FIPS codes', set(G['parish']) == {p['fips'] for p in PA} == set(G['pcent']))
allp = list(G['zcta'].values()) + list(G['parish'].values()) + G['water'] + list(G['neighbors'].values()) + [G['outline']]
check('every path is M x y, relative l segments, z, integers only', all(pat.fullmatch(s) for s in allp), '%d paths' % len(allp))
kx, sx = G['kx'], G['sx']
check('projection constants: kx = cos(37.25 deg), sx = W / (10.7 kx), H = 9.7 sx', abs(kx - math.cos(math.radians(37.25))) < 1e-12
      and abs(sx - G['W'] / (10.7 * kx)) < 1e-9 and G['H'] == round(9.7 * sx), 'W %d H %d' % (G['W'], G['H']))


def bbox(s):
    xs, ys = [], []
    x = y = 0
    for m in re.finditer(r'([Ml])(-?\d+) (-?\d+)', s):
        if m.group(1) == 'M':
            x, y = int(m.group(2)), int(m.group(3))
        else:
            x += int(m.group(2))
            y += int(m.group(3))
        xs.append(x)
        ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


off = 0
far = 0
for z in Z:
    b = bbox(G['zcta'][z['zip']])
    if b[0] < 0 or b[1] < 0 or b[2] > G['W'] or b[3] > G['H']:
        off += 1
    px, py = (z['lon'] - G['minx']) * kx * sx, (G['maxy'] - z['lat']) * sx
    if not (b[0] - 3 <= px <= b[2] + 3 and b[1] - 3 <= py <= b[3] + 3):
        far += 1
check('every ZIP shape lies inside the view box', off == 0, off)
check('ZIP centre points project inside their own shape\'s bounding box (2 misses allowed: internal points on a dropped islet)', far <= 2, far)
check('water names match water paths', len(G['wname']) == len(G['water']) and all(n in G['wname'] for n in ('Lake Tahoe', 'Salton Sea', 'Mono Lake', 'Clear Lake', 'San Francisco Bay')))
check('neighbours are Oregon, Nevada, Arizona, Baja California', set(G['neighbors']) == {'Oregon', 'Nevada', 'Arizona', 'Baja California'})
gsz = len(json.dumps(G, separators=(',', ':')))
check('geo block is 3 MB or less', gsz <= 3e6, '%d bytes' % gsz)

# ---- 4. ACS identities and totals
YB = ['yb20', 'yb10', 'yb00', 'yb90', 'yb80', 'yb70', 'yb60', 'yb50', 'yb40', 'ybold']
OB = ['o20', 'o10', 'o00', 'o90', 'o80', 'o70', 'o60', 'o50', 'o40', 'oold']
check('occ equals hh in every row', all(z['occ'] == z['hh'] for z in Z))
close('pre80_sh = five oldest decades / all decades', ((z['pre80_sh'], round(100 * sum(z[k] for k in YB[5:]) / sum(z[k] for k in YB), 1))
                                                    for z in Z if sum(z[k] for k in YB) > 0), 0.11)
close('one unit homes by decade sum to u1', ((sum(z[k] for k in OB), z['u1']) for z in Z), 0.6)
close('density = pop / sqmi', ((z['density'], round(z['pop'] / z['sqmi'])) for z in Z if z['sqmi'] > 0), 0.5)
close('mfb = units / 7, 14, 30, 80', ((z['mfb'], round(z['mf5_9'] / 7 + z['mf10_19'] / 14 + z['mf20_49'] / 30 + z['mf50'] / 80, 1)) for z in Z), 0.05)
check('mf5u = sum of its four size classes', all(z['mf5u'] == z['mf5_9'] + z['mf10_19'] + z['mf20_49'] + z['mf50'] for z in Z))
check('res_ok is 1 exactly when pop >= 500, and idx is non-null exactly there',
      all((z['res_ok'] == 1) == (z['pop'] >= 500) and ((z['idx'] is not None) == (z['res_ok'] == 1)) for z in Z),
      '%d scored' % sum(z['res_ok'] for z in Z))
sh_cols = [c for c in cols if c.endswith('_sh')]
badsh = [(c, z['zip']) for c in sh_cols for z in Z if z[c] is not None and not (0 <= z[c] <= 100)]
check('every share column is between 0 and 100', not badsh, badsh[:5])
check('centre points are inside California\'s box', all(32.4 <= z['lat'] <= 42.1 and -124.6 <= z['lon'] <= -113.9 for z in Z))
PUB = {'pop': 39287377, 'hh': 13548091, 'hu': 14644735}
check('counties sum to the published state row (ACS 2020-2024): residents, households, housing units',
      sum(p['pop'] for p in PA) == PUB['pop'] and sum(p['hh'] for p in PA) == PUB['hh'] and sum(p['hu'] for p in PA) == PUB['hu'],
      [sum(p[k] for p in PA) for k in ('pop', 'hh', 'hu')])
for k in ('pop', 'hh', 'hu'):
    s = sum(z[k] for z in Z)
    check('ZIP rows sum to within 0.1%% of the state: %s' % k, abs(s / PUB[k] - 1) < 0.001, '%d against %d (%.4f%%)' % (s, PUB[k], 100 * (s / PUB[k] - 1)))
check('meta.pop is the ZIP sum; meta.hu the county sum', M['pop'] == sum(z['pop'] for z in Z) and M['hu'] == PUB['hu'])
check('meta.nzip, nres, npar', M['nzip'] == len(Z) and M['nres'] == sum(z['res_ok'] for z in Z) and M['npar'] == 58, (M['nzip'], M['nres']))

# ---- 5. roof model
AZ, AT, RH = D['agez'], D['agez_t'], D['rhist']
check('agez, agez_t and rhist have one entry per ZIP, of 41, 41 and 27', set(AZ) == set(AT) == set(RH) == {z['zip'] for z in Z}
      and all(len(v) == 41 for v in AZ.values()) and all(len(v) == 41 for v in AT.values()) and all(len(v) == 27 for v in RH.values()))
check('roofs = sum of agez', all(z['roofs'] == sum(AZ[z['zip']]) for z in Z))
check('ra15, ra20, ra25 = sums of agez from that age', all(z['ra15'] == sum(AZ[z['zip']][15:]) and z['ra20'] == sum(AZ[z['zip']][20:])
                                                          and z['ra25'] == sum(AZ[z['zip']][25:]) for z in Z))
check('wave = ra15 - ra20', all(z['wave'] == z['ra15'] - z['ra20'] for z in Z))
close('ra15_sh, ra20_sh, ra25_sh', ((z[k + '_sh'], round(100 * z[k] / z['roofs'], 1)) for z in Z if z['roofs'] for k in ('ra15', 'ra20', 'ra25')), 0.051)


def med(a):
    t = sum(a)
    c = 0
    for i, v in enumerate(a):
        c += v
        if c >= t / 2.0:
            return i


check('ra_med = first age where cumulative agez reaches half', all(z['ra_med'] == med(AZ[z['zip']]) for z in Z if z['roofs'] > 0))
check('tile roofs never exceed all roofs at any age', all(t <= a for z in Z for a, t in zip(AZ[z['zip']], AT[z['zip']])))
check('tile_n = sum of agez_t; tile25 = sum from age 25', all(z['tile_n'] == sum(AT[z['zip']]) and z['tile25'] == sum(AT[z['zip']][25:]) for z in Z))
close('roofs within 1% (or 30) of u1 except where 2024-2025 fires removed homes',
      ((0, 0) if (abs(z['roofs'] - z['u1']) <= max(30, 0.01 * z['u1']) or (z['lastfire'] or 0) >= 2024) else (z['roofs'], z['u1']) for z in Z), 0)
WB, WBT = MD['WB'], MD['WBT']


def hz(L, k, n=41):
    lam = L / math.gamma(1 + 1 / k)
    S = [math.exp(-((a / lam) ** k)) for a in range(n + 1)]
    return [1 - S[a + 1] / S[a] for a in range(n)]


hS, hT = hz(WB['L'], WB['k']), hz(WBT['L'], WBT['k'])
# the shipped histogram pools ages 40 and over, so the recomputation is approximate: compare state totals and the ZIP median error
r_n, r_t, errs = 0.0, 0.0, []
for z in Z:
    a, t = AZ[z['zip']], AT[z['zip']]
    n1 = sum((a[i] - t[i]) * hS[i] for i in range(41))
    t1 = sum(t[i] * hT[i] for i in range(41))
    ns, ts_ = sum(a) - sum(t), sum(t)
    n1 += 0.354 * z['mf24'] * (ns / max(ns + ts_, 1)) * (n1 / ns if ns else 0)
    t1 += 0.354 * z['mf24'] * (ts_ / max(ns + ts_, 1)) * (t1 / ts_ if ts_ else 0)
    r_n += n1
    r_t += t1
    if z['nxt'] > 20:
        errs.append(abs(n1 / z['nxt'] - 1))
errs.sort()
check('nxt recomputed from agez and the Weibull hazard: state total within 5%, ZIP median error under 5%',
      abs(r_n / sum(z['nxt'] for z in Z) - 1) < 0.05 and errs[len(errs) // 2] < 0.05,
      'state %.0f against %.0f; median ZIP error %.2f%%' % (r_n, sum(z['nxt'] for z in Z), 100 * errs[len(errs) // 2]))
check('nxt_t recomputed the same way: state total within 5%', abs(r_t / sum(z['nxt_t'] for z in Z) - 1) < 0.05,
      '%.0f against %.0f' % (r_t, sum(z['nxt_t'] for z in Z)))
check('ts.agehist = sum of agez; ts.agehist_t = sum of agez_t',
      D['ts']['agehist'] == [sum(AZ[z][i] for z in AZ) for i in range(41)] and D['ts']['agehist_t'] == [sum(AT[z][i] for z in AT) for i in range(41)])
close('ts.replace_hist = sum of rhist', ((D['ts']['replace_hist'][str(2000 + j)][e], sum(RH[z][j][e] for z in RH)) for j in range(27) for e in (0, 1)), 6.0)
close('county hist = sum of the county\'s rhist', ((PA[ci]['hist'][str(2000 + j)][e], sum(RH[z['zip']][j][e] for z in Z if z['pi'] == ci))
                                                  for ci in range(58) for j in (0, 13, 26) for e in (0, 1)), 1.0)
check('meta roof totals are ZIP sums', M['roofs'] == sum(z['roofs'] for z in Z) and M['ra20'] == sum(z['ra20'] for z in Z)
      and M['wave'] == sum(z['wave'] for z in Z) and abs(M['nxt'] - sum(z['nxt'] for z in Z)) <= 1)
check('yrsfire = 2026 - lastfire', all((z['yrsfire'] is None and z['lastfire'] is None) or z['yrsfire'] == 2026 - z['lastfire'] for z in Z))
tile_state = 100.0 * sum(z['tile_n'] for z in Z) / sum(z['roofs'] for z in Z)
check('state tile share is 27.4% (RECS 2020) to within half a point', abs(tile_state - 27.4) < 0.5, '%.2f%%' % tile_state)
fit = WB['fit']
rm = math.sqrt(sum((a - b) ** 2 for a, b in fit.values()) / len(fit))
check('calibration table: root mean square gap under 0.5 points', rm < 0.5, 'L %.1f years, rmse %.2f' % (WB['L'], rm))

# ---- 6. service lines
LN = MD['LINES']
REP, VAL, FEE, W, TIER = MD['REP'], MD['VAL'], MD['FEE'], MD['W'], MD['TIER']
check('thirteen lines in DESIGN.md order', LN == LINES)
check('four columns for each line', all(p + k in cols for k in LN for p in ('p_', 'r_', 'z_', 'f_')))
close('f = p x REP x VAL x FEE', ((z['f_' + k], z['p_' + k] * REP[k] * VAL[k] * FEE) for z in Z for k in LN), 1.0)
check('fees = sum of f', all(z['fees'] == sum(z['f_' + k] for k in LN) for z in Z))
close('cases = sum of p x REP', ((z['cases'], sum(z['p_' + k] * REP[k] for k in LN)) for z in Z), 0.011)
cp = collections.Counter()
cpl = collections.defaultdict(float)
for z in Z:
    cp[z['pi']] += z['pop']
    for k in LN:
        cpl[(z['pi'], k)] += z['p_' + k]
close('r = (p + 2500 x county rate) / (pop + 2500) x 10000', ((z['r_' + k], (z['p_' + k] + 2500 * cpl[(z['pi'], k)] / cp[z['pi']]) / (z['pop'] + 2500) * 10000)
                                                             for z in Z if z['res_ok'] for k in LN), 0.011)
S = [z for z in Z if z['res_ok']]
for k in LN:
    ln = [math.log(z['r_' + k] + 0.01) for z in S]
    mu = sum(ln) / len(ln)
    sd = math.sqrt(sum((v - mu) ** 2 for v in ln) / len(ln))
    close('z_%s = (ln(r + 0.01) - mean) / population SD over scored ZIPs' % k, ((z['z_' + k], (v - mu) / sd) for z, v in zip(S, ln)), 0.0011)
pools = {k: sum(z['p_' + k] for z in Z) for k in LN}
close('meta.pools = ZIP sums', ((M['pools'][k], pools[k]) for k in LN), 0.06)
close('meta.cases = pools x REP', ((M['cases'][k], M['pools'][k] * REP[k]) for k in LN), 0.06)
close('meta.fees = cases x VAL x FEE', ((M['fees'][k], M['cases'][k] * VAL[k] * FEE) for k in LN), 1.0)
check('meta.fees_tot = sum of meta.fees', M['fees_tot'] == sum(M['fees'].values()), M['fees_tot'])
close('county p_<line> = ZIP sums', ((PA[ci]['p_' + k], cpl[(ci, k)]) for ci in range(58) for k in LN), 0.02)
close('W = share of fees_tot x TIER', ((W[k], M['fees'][k] / M['fees_tot'] * TIER[k]) for k in LN), 1e-9)


def prank(vals):
    srt = sorted(vals)
    import bisect
    return [bisect.bisect_right(srt, v) / len(vals) * 100 for v in vals]


close('idx = percentile of sum W x z among scored ZIPs', zip([z['idx'] for z in S], prank([sum(W[k] * z['z_' + k] for k in LN) for z in S])), 0.6)
close('idx_eq = the same with equal weights', zip([z['idx_eq'] for z in S], prank([sum(z['z_' + k] for k in LN) for z in S])), 0.6)
DMA = MD['DMA']
close('cpc_rel = DMA[region] x (0.8 + 0.4 x comp_pct / 100)', ((z['cpc_rel'], DMA[str(z['reg'])] * (0.8 + 0.4 * z['comp_pct'] / 100)) for z in S), 0.00051)
close('eff = fees / cpc_rel', ((z['eff'], z['fees'] / z['cpc_rel']) for z in S), 0.51)
close('effb = percentile of eff', zip([z['effb'] for z in S], prank([z['eff'] for z in S])), 0.051)
close('oppb = percentile of fees', zip([z['oppb'] for z in S], prank([z['fees'] for z in S])), 0.051)
tier = lambda p: 'A+' if p >= 95 else 'A' if p >= 85 else 'B' if p >= 65 else 'C' if p >= 40 else 'D' if p >= 15 else 'E'
BID = {'A+': 30, 'A': 20, 'B': 10, 'C': 0, 'D': -20, 'E': -50}
check('tier follows effb (95, 85, 65, 40, 15); bid follows tier', all(z['tier'] == tier(z['effb']) and z['bid'] == BID[z['tier']] for z in S),
      dict(collections.Counter(z['tier'] for z in S)))
quad = lambda o, c: 0 if (o >= 60 and c >= 60) else 1 if o >= 60 else 3 if c >= 60 else 2
check('quad follows oppb and comp_pct at 60', all(z['quad'] == quad(z['oppb'], z['comp_pct']) for z in S), dict(collections.Counter(z['quad'] for z in S)))
check('model columns are null where res_ok = 0', all(z[c] is None for z in Z if not z['res_ok'] for c in ['idx', 'gi', 'tier', 'bid', 'quad', 'cpc_rel', 'eff'] + ['r_' + k for k in LN] + ['z_' + k for k in LN]))
gc = lambda v: 'ns' if abs(v) < 1.645 else ('H' if v > 0 else 'C') + ('99' if abs(v) >= 2.576 else '95' if abs(v) >= 1.96 else '90')
check('gicls follows gi', all(z['gicls'] == gc(z['gi']) for z in S), dict(collections.Counter(z['gicls'] for z in S)))
A = MD['ANCH']
close('p_coat = 0.03 x cru', ((z['p_coat'], A['coat'] * z['cru']) for z in Z), 0.012)
check('cru sums to the state anchor', abs(sum(z['cru'] for z in Z) - A['cru']) < 0.001 * A['cru'], '%.0f against %d' % (sum(z['cru'] for z in Z), A['cru']))
close('p_tile = nxt_t', ((z['p_tile'], z['nxt_t']) for z in Z), 0.06)
close('p_harden = rate x exposed owner homes, never above 2% of owner one unit homes', ((max(0, z['p_harden'] - A['harden'] * max(0, z['u1'] - z['rent1'])), 0) for z in Z), 0.011)
close('p_replace = max(0, nxt x (1 - metal_sh) - 0.7 x p_harden)', ((z['p_replace'], max(0, z['nxt'] * (1 - z['metal_sh'] / 100) - A['harden_carve'] * z['p_harden'])) for z in Z), 0.06)
close('p_solar = (nxt + nxt_t) x solar_sh', ((z['p_solar'], (z['nxt'] + z['nxt_t']) * z['solar_sh'] / 100) for z in Z), 0.8)
close('county p_newc = Building Permits Survey buildings, 2023 to 2025 mean', ((PA[ci]['p_newc'], sum(PA[ci]['bps'][str(y)][2] for y in (2023, 2024, 2025)) / 3.0) for ci in range(58)), 0.6)
close('storm pool equals the stated anchor less the metal carve out', [(sum(z['p_storm'] / (1 - z['metal_sh'] / 100) for z in Z), A['storm_ins'] * A['storm_rate'] * M['roofs'] * A['storm_mult'])], 5.0)
C = MD['corr']
zm = {k: [z['z_' + k] for z in S] for k in LN}


def pear(a, b):
    n = len(a)
    ma, mb = sum(a) / n, sum(b) / n
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))


close('corr is the 13 x 13 Pearson matrix of the z columns', ((C[a][b], pear(zm[a], zm[b])) for a in LN for b in LN), 1e-6)

# ---- 7. FEMA, insurance, business
close('fema_rate = fema_k / occ x 100', ((z['fema_rate'], round(100 * z['fema_k'] / z['occ'], 1)) for z in Z if z['occ'] > 0), 0.051)
check('fema_k = fire + storm + earthquake; fema_20 <= fema_k', all(z['fema_k'] == z['fema_fire'] + z['fema_storm'] + z['fema_quake'] and z['fema_20'] <= z['fema_k'] for z in Z))
check('county fema_k = ZIP sums = sum of the county\'s per disaster counts', all(p['fema_k'] == sum(z['fema_k'] for z in Z if z['pi'] == i) == sum(p['fema'].values()) for i, p in enumerate(PA)))
check('ts.fema_year registrations sum to the ZIP fema_k total', sum(r[3] for r in D['ts']['fema_year']) == sum(z['fema_k'] for z in Z), sum(z['fema_k'] for z in Z))
fy = D['ts']['fema_year']
check('FEMA: 20 property disasters, Los Angeles 2025 has 261,118 registrations', len(fy) == 20 and [r for r in fy if r[0] == '4856'][0][8] == 261118)
I = D['ins']
check('FAIR Plan residential policies, state: 665,673 at 2026-09-30 and 265,909 at 2022-09-30 (the Plan\'s printed totals)',
      I['state']['fair_pif'][4] == 665673 and I['state']['fair_pif'][0] == 265909, I['state']['fair_pif'])
s = sum(z['fair_pif'] for z in Z)
check('ZIP rows carry 99.5% or more of FAIR Plan residential policies', s / 665673.0 >= 0.995, '%d (%.2f%%)' % (s, 100 * s / 665673.0))
cs = sum(I['county'][f]['fair_pif'][4] for f in I['county'])
check('county FAIR Plan rollups sum to within 0.1% of the state', abs(cs / 665673.0 - 1) < 0.001, cs)
check('region rollups equal the sums of their counties', all(I['region'][str(r)]['fair_pif'] == [sum(I['county'][p['fips']]['fair_pif'][i] for p in PA if p['reg'] == r) for i in range(5)] for r in range(1, 12)))
close('fair_sh = fair_pif / hu x 100 (capped at 100)', ((z['fair_sh'], min(100.0, round(100.0 * z['fair_pif'] / z['hu'], 1))) for z in Z if z['hu'] > 0), 0.051)
close('fair_x = fair_pif / fair_pif22', ((z['fair_x'], round(z['fair_pif'] / z['fair_pif22'], 2)) for z in Z if z['fair_pif22'] >= 10), 0.0051)
check('non-renewals 2023: ZIP rows carry 99.9% of the state file', sum(z['nonren'] or 0 for z in Z) / float(I['state']['nonren']['2023']) > 0.999,
      '%d of %d' % (sum(z['nonren'] or 0 for z in Z), I['state']['nonren']['2023']))
check('CSLB C-39: 5,829 on the roll; ZIP rows carry the California licences less those at post office box ZIPs',
      M['lic']['n'] == 5829 and sum(z['lic_all'] for z in Z) == M['lic']['in_rows'] <= M['lic']['inca'], (M['lic']['clear'], M['lic']['inca'], M['lic']['in_rows']))
check('lic <= lic_all', all(z['lic'] <= z['lic_all'] for z in Z))
check('County Business Patterns 2023 roofing: 2,926 establishments, 23,903 employees', M['cbp']['est'] == 2926 and M['cbp']['emp'] == 23903)
check('Building Permits Survey: 103,856 units in 2025; 83,850 to September 2026', D['ts']['permits']['2025'][1] == 103856 and D['ts']['ytd26'] == 83850)
close('roof_per10k = (roofers + lic) / pop x 10000', ((z['roof_per10k'], round((z['roofers'] + z['lic']) / z['pop'] * 10000, 1)) for z in Z if z['pop'] >= 200), 0.051)
gidn = sum(1 for z in Z if z['gid'])
check('Google Ads location IDs present for most ZIPs', gidn > 0.9 * len(Z), '%d of %d' % (gidn, len(Z)))

# ---- 8. cities, places, companies
names = [c['name'] for c in D['cities']]
zs = {z['zip']: z for z in Z}
check('city names are unique; every city ZIP is a row; pop = sum of its ZIPs; 1,500 residents or more',
      len(set(names)) == len(names) and all(all(q in zs for q in c['zips']) and c['pop'] == sum(zs[q]['pop'] for q in c['zips']) >= 1500 for c in D['cities']), len(names))
close('city p_replace = sum of its ZIPs', ((c['p_replace'], sum(zs[q]['p_replace'] for q in c['zips'])) for c in D['cities']), 0.02)
check('no ZIP is in two cities', len([q for c in D['cities'] for q in c['zips']]) == len({q for c in D['cities'] for q in c['zips']}))
check('58 county seats are in places', sum(1 for p in D['places'] if p['seat']) == 58, sum(1 for p in D['places'] if p['seat']))
check('every comp row has name, tier and array fields', all(c['name'] and c['tier'] in ('statewide', 'national', 'regional', 'local') and all(isinstance(c[k], list) for k in ('lines', 'cities', 'offices')) for c in D['comp']), len(D['comp']))
check('pts indexes point at existing rows and counties', all(-1 <= r[10] < len(Z) and -1 <= r[9] < 58 for r in D['pts']), len(D['pts']))

# ---- report
fails = [r for r in res if not r['ok']]
sizes = {k: len(json.dumps(v, separators=(',', ':'))) for k, v in D.items()}
gs = {k: len(json.dumps(G[k], separators=(',', ':'))) for k in ('outline', 'neighbors', 'parish', 'zcta', 'water')}
L = ['# California atlas data: build report', '',
     'File: `CA/data/out/ca_atlas_data.json`, %s bytes. Compiled %s. Checks run: %d, failed: %d.' % ('{:,}'.format(len(raw)), M['compiled'], len(res), len(fails)), '',
     '## Counts', '',
     '- ZIP rows %d (scored, 500 residents or more: %d); columns %d; counties %d; regions %d; cities %d; places %d; named companies %d.' % (
         len(Z), M['nres'], len(cols), len(PA), len(MD['REG']), len(D['cities']), len(D['places']), len(D['comp'])),
     '- Residents %s (ZIP rows) against %s (state); one unit roofs %s; roofs 20 years or older %s; tile roofs %s.' % (
         '{:,}'.format(M['pop']), '{:,}'.format(PUB['pop']), '{:,}'.format(M['roofs']), '{:,}'.format(M['ra20']), '{:,}'.format(M['tile_n'])),
     '- Pools (jobs a year): ' + ', '.join('%s %s' % (k, '{:,.0f}'.format(M['pools'][k])) for k in LN) + '.',
     '- Gross profit pool at the defaults: $%s.' % '{:,}'.format(M['fees_tot']),
     '- Hazard inputs: %s. Hazard files merged: %s. Hazard ZIP columns carried: %s.' % (M['hazard']['src'], ', '.join(M['hazard']['merged']) or 'none', ', '.join(M['hazard']['cols']) or 'none'),
     '', '## Sizes (bytes of compact JSON)', '', '| key | bytes |', '|---|---|']
for k, v in sorted(sizes.items(), key=lambda t: -t[1]):
    L.append('| `%s` | %s |' % (k, '{:,}'.format(v)))
L += ['', 'Inside `geo`: ' + ', '.join('%s %s' % (k, '{:,}'.format(v)) for k, v in gs.items()) + '.', '', '## Checks', '', '| result | check | detail |', '|---|---|---|']
for r in res:
    L.append('| %s | %s | %s |' % ('pass' if r['ok'] else '**FAIL**', r['name'].replace('|', '/'), r['detail'].replace('|', '/')[:160]))
open(os.path.join(OUT, 'build_report.md'), 'w').write('\n'.join(L) + '\n')
json.dump({'checks': res, 'sizes': sizes, 'bytes': len(raw)}, open(os.path.join(OUT, 'checks.json'), 'w'), indent=1)
print('checks %d, failed %d' % (len(res), len(fails)))
for r in fails:
    print('FAIL', r['name'], '|', r['detail'][:300])
sys.exit(1 if fails else 0)
