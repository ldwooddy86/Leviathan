#!/usr/bin/env python3
"""Step 5. The thirteen service lines: pools, rates, z scores, fees, weights, the index, competition, paid tiers.
Formulas follow the Louisiana contract's confirmed build tests (contract_m01_08 Part A, m09_17 section 12).
Writes work/lines.json.   Usage: python3 -I 05_lines.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import numpy as np

base = load('base.json')
roof = load('roof.json')
haz = load('haz.json')
solar = load('solar.json')['by_zip'] if os.path.exists(os.path.join(WORK, 'solar.json')) else {}
Z = base['zips']
C = base['counties']
N = len(Z)
R = roof['rows']
HZ = haz['by_zip']

# ------------------------------------------------------------------ constants
FEE = 0.33
PRIOR = 2500
REP = {'replace': 0.84, 'repair': 0.55, 'storm': 0.80, 'fire': 0.60, 'harden': 0.85, 'tile': 0.84, 'solar': 0.50, 'metal': 0.88,
       'mh': 0.72, 'mf': 0.65, 'comm': 0.55, 'coat': 0.50, 'newc': 0.25}
VAL = {'replace': 19000, 'repair': 1350, 'storm': 7500, 'fire': 19000, 'harden': 24000, 'tile': 20000, 'solar': 4500, 'metal': 28000,
       'mh': 7000, 'mf': 40000, 'comm': 75000, 'coat': 40000, 'newc': 13000}
GRADE = {'replace': 'B', 'repair': 'B', 'storm': 'C', 'fire': 'C', 'harden': 'D', 'tile': 'C', 'solar': 'C', 'metal': 'D', 'mh': 'C',
         'mf': 'C', 'comm': 'D', 'coat': 'D', 'newc': 'B'}
TIER = {'replace': 1.0, 'repair': 1.0, 'storm': 0.75, 'fire': 0.75, 'harden': 0.5, 'tile': 0.75, 'solar': 0.5, 'metal': 0.5, 'mh': 0.75,
        'mf': 0.75, 'comm': 0.5, 'coat': 0.5, 'newc': 1.0}
DMA = {1: 0.60, 2: 0.55, 3: 0.80, 4: 0.60, 5: 1.00, 6: 0.80, 7: 0.65, 8: 1.00, 9: 1.00, 10: 0.85, 11: 0.90}
US_POP = 334922499          # ACS 2020-2024 B01003, United States row
CBECS = 5.9e6               # commercial buildings, United States, CBECS 2018
state_pop = base['state']['pop']
ANCH = {
    'cru': int(round(CBECS * state_pop / US_POP, -4)),
    'coat': 0.03,
    'leak': 0.55,
    'mh': round(0.0415 * (1 - 0.46), 5),       # AHS 2023 West: 8.3% in two years, 46% done by the owner
    'metal': 0.04,
    'harden': 0.02,
    'harden_carve': 0.70,
    'fire_rb': roof['const']['FIRE_RB'],
    'fire_dm': roof['const']['FIRE_DM'],
    'fire_years': [2013, 2025],
    'storm_ins': 0.035,          # AHS 2023 Pacific division: share of owner roof jobs paid by insurance
    'storm_rate': 0.0367,        # AHS 2023 Pacific division: owner roof jobs a year, share of homes
    'storm_mult': 3.0,           # jobs per insurance paid roof job (repairs short of replacement), assumption
    'storm_w': {'g58': 0.0003, 'g75': 0.0012, 'ar3': 0.0003, 'rain2': 0.0002, 'floor': 0.0005},
    'mf_life': 22, 'comm_life': 22, 'mf_storm': 0.8, 'comm_storm': 0.7,
    'mf24_roof': roof['const']['MF24_ROOF'],
    'solar_cap': 80.0,
}
CRU_W = {'est': 0.15, 'mfg': 0.85, 'whse': 0.80, 'retail': 0.55, 'office': 0.25, 'church': 1.0, 'school': 0.6, 'lodging': 0.5,
         'health': 0.3, 'auto': 0.4, 'food': 0.3}
# Louisiana's fitted leak profile by decade built (South, share of homes with a roof leak in a year), newest first
LEAK_LA = [2.0, 2.4, 3.2, 3.4, 3.0, 5.1, 5.1, 7.1, 7.3, 8.1]
PAC_LEAK = 5.25
YB = ['yb20', 'yb10', 'yb00', 'yb90', 'yb80', 'yb70', 'yb60', 'yb50', 'yb40', 'ybold']

arr = lambda k, d=0.0: np.array([(x[k] if x.get(k) is not None else d) for x in Z], dtype=float)
rarr = lambda k, d=0.0: np.array([(R[x['zip']][k] if R[x['zip']].get(k) is not None else d) for x in Z], dtype=float)


def harr(names, d=None):
    """hazard column by the first name present; returns (array, name used or None)"""
    for nm in names:
        if any(nm in HZ.get(x['zip'], {}) for x in Z):
            v = np.array([(HZ.get(x['zip'], {}).get(nm) if isinstance(HZ.get(x['zip'], {}).get(nm), (int, float)) else np.nan) for x in Z], dtype=float)
            return v, nm
    return np.full(N, np.nan), None


pop, hu, u1, occ = arr('pop'), arr('hu'), arr('u1'), arr('occ')
roofs, nxt, nxt_t = rarr('roofs'), rarr('nxt'), rarr('nxt_t')
mf24, mh, mfb = arr('mf24'), arr('mh'), arr('mfb')
pi = np.array([x['pi'] for x in Z])
reg = np.array([x['reg'] for x in Z])
dens = arr('density')
scored = pop >= 500
used_haz = {}

# ------------------------------------------------------------------ hazard exposure
g58, used_haz['g58'] = harr(['g58', 'wd58'])
g75, used_haz['g75'] = harr(['g75', 'wd75'])
ar3, used_haz['ar3'] = harr(['ar3_d', 'ar3p_d'])
if used_haz['ar3'] is None:
    a3, n3 = harr(['ar3d'])
    a4, _ = harr(['ar4d'])
    a5, _ = harr(['ar5d'])
    if n3:
        ar3 = np.nan_to_num(a3) + np.nan_to_num(a4) + np.nan_to_num(a5)
        used_haz['ar3'] = 'ar3d+ar4d+ar5d'
rain2, used_haz['rain2'] = harr(['rain_d2', 'rain2_d'])
fhsz, used_haz['fhsz'] = harr(['fhsz_sh', 'fhsz_vh_sh', 'fhsz_hv_sh', 'fhsz_pct'])
snow, used_haz['snow'] = harr(['snow_psf', 'pg_psf', 'snow_load'])
w = ANCH['storm_w']
storm_x = (w['floor'] + w['g58'] * np.nan_to_num(g58) + w['g75'] * np.nan_to_num(g75) + w['ar3'] * np.nan_to_num(ar3)
           + w['rain2'] * np.nan_to_num(rain2))
print('hazard columns used', used_haz, '| source:', haz['src'])

# ------------------------------------------------------------------ solar
sol_n = np.zeros(N)
sol_src = [None] * N
nem = np.array([(solar.get(x['zip']) or [0, 0, 0, 0])[0] for x in Z], dtype=float)
sun = np.array([((solar.get(x['zip']) or [0, 0, 0, 0])[1] or 0) for x in Z], dtype=float)
sol_new = np.array([(solar.get(x['zip']) or [0, 0, 0, 0])[2] for x in Z], dtype=float)
sol_batt = np.array([(solar.get(x['zip']) or [0, 0, 0, 0])[3] for x in Z], dtype=float)
have_solar = nem.sum() > 0
if have_solar:
    share = np.where(u1 > 0, nem / np.maximum(u1, 1), 0)
    cshare = {}
    for ci in range(len(C)):
        m = (pi == ci) & (u1 >= 200)
        cov = m & (nem >= np.maximum(sun, 1) * 1.0) & (share > 0.01)
        cshare[ci] = (nem[cov].sum() / u1[cov].sum()) if cov.sum() >= 1 and u1[cov].sum() > 0 else None
    rshare = {}
    for rg in REG:
        m = (reg == rg) & (u1 >= 200) & (share > 0.01)
        rshare[rg] = nem[m].sum() / u1[m].sum() if m.sum() else nem.sum() / u1.sum()
    for i in range(N):
        cs = cshare[pi[i]] if cshare[pi[i]] is not None else rshare[reg[i]]
        if u1[i] <= 0:
            sol_n[i], sol_src[i] = nem[i], 'nem'
        elif share[i] < 0.25 * cs and nem[i] < max(sun[i], 1) * 1.5:
            # not covered by the three investor owned utilities' file (a city or district utility serves the ZIP)
            sol_n[i] = max(sun[i], round(cs * u1[i]))
            sol_src[i] = 'est'
        else:
            sol_n[i], sol_src[i] = nem[i], 'nem'
sol_sh = np.where(u1 > 0, np.minimum(ANCH['solar_cap'], 100 * sol_n / np.maximum(u1, 1)), 0)
print('solar: NEM sites in rows', int(nem.sum()), 'estimated ZIPs', sol_src.count('est'), 'solar homes', int(sol_n.sum()),
      'state share of one unit homes %.1f%%' % (100 * sol_n.sum() / u1.sum()))

# ------------------------------------------------------------------ metal share (assumption)
fire_zone = np.where(np.isnan(fhsz), arr('wf_hi_sh'), fhsz)
tilt = np.ones(N)
tilt[dens < 300] = 1.6
tilt[dens > 1500] = 0.6
hot = (fire_zone >= 25) | (np.nan_to_num(snow) >= 40)
tilt[hot] *= 1.5
msh = tilt * ANCH['metal']
msh *= ANCH['metal'] / ((msh * nxt).sum() / nxt.sum())
metal_sh = np.round(100 * msh, 2)
msh = metal_sh / 100.0

# ------------------------------------------------------------------ pools
P = {}
# harden
own1 = np.maximum(0, u1 - arr('rent1'))
exposed = np.minimum(own1, np.maximum(arr('wf_hi_n'), arr('fair_own')))
P['harden'] = ANCH['harden'] * exposed
# replace
P['replace'] = np.maximum(0, nxt * (1 - msh) - ANCH['harden_carve'] * P['harden'])
# repair
ybm = np.array([[x[k] for k in YB] for x in Z], dtype=float)
st_share = ybm.sum(0) / ybm.sum()
leak_f = PAC_LEAK / float((st_share * np.array(LEAK_LA)).sum())
leak = np.array(LEAK_LA) * leak_f / 100.0
P['repair'] = (ybm * leak[None, :]).sum(1) * np.where(hu > 0, (roofs + mf24) / np.maximum(hu, 1), 0) * ANCH['leak']
# storm
storm_anchor = ANCH['storm_ins'] * ANCH['storm_rate'] * roofs.sum() * ANCH['storm_mult']
base_roofs = roofs + mf24 / 3.0
storm_gross = storm_anchor * base_roofs * storm_x / (base_roofs * storm_x).sum()
storm_rate = np.where(base_roofs > 0, storm_gross / np.maximum(base_roofs, 1), 0)       # jobs per roof a year
storm_repl = storm_rate / ANCH['storm_mult']
P['storm'] = storm_gross * (1 - msh)
# fire
fy = haz['fire_year']
y0, y1 = ANCH['fire_years']
ny = y1 - y0 + 1
own_fire = np.zeros(N)
fire_nxt = np.zeros(N)
for i, x in enumerate(Z):
    d = fy.get(x['zip'], {})
    for y, v in d.items():
        if y0 <= int(y) <= y1:
            own_fire[i] += (ANCH['fire_rb'] * v[0] + ANCH['fire_dm'] * v[1]) / ny
        if NOW - 4 <= int(y) <= NOW - 1:
            fire_nxt[i] += ANCH['fire_rb'] * v[0] / 4.0
        if int(y) == NOW - 1:
            fire_nxt[i] += ANCH['fire_dm'] * v[1]
expo = np.where(np.isnan(fhsz), arr('wf_hi_n'), fhsz / 100.0 * u1)
expo = np.maximum(expo, 0)
prior = own_fire.sum() * expo / expo.sum() if expo.sum() > 0 else np.zeros(N)
fire_gross = 0.5 * own_fire + 0.5 * prior
P['fire'] = fire_gross * (1 - msh)
# tile, solar
P['tile'] = nxt_t.copy()
P['solar'] = (nxt + nxt_t) * sol_sh / 100.0
# metal
P['metal'] = msh * (nxt + 0.5 * storm_gross + fire_gross)
# mobile homes
P['mh'] = mh * ANCH['mh'] + mh * storm_rate
# multifamily, commercial, coatings
P['mf'] = mfb / ANCH['mf_life'] + mfb * ANCH['mf_storm'] * storm_repl
raw_cru = sum(CRU_W[k] * arr(k) for k in CRU_W)
cru = raw_cru * ANCH['cru'] / raw_cru.sum()
P['comm'] = cru * (1.0 / ANCH['comm_life'] + ANCH['comm_storm'] * storm_repl)
P['coat'] = ANCH['coat'] * cru
# new construction
P['newc'] = np.zeros(N)
wnew = arr('yb20') + 0.35 * arr('yb10')
cnew = {}
for ci, c in enumerate(C):
    b = [c['bps'].get(str(y), [0, 0, 0])[2] for y in (2023, 2024, 2025)]
    cnew[ci] = sum(b) / 3.0
    m = pi == ci
    if wnew[m].sum() > 0:
        P['newc'][m] = cnew[ci] * wnew[m] / wnew[m].sum()
    elif m.sum():
        P['newc'][m] = cnew[ci] * hu[m] / max(hu[m].sum(), 1)
for k in LINES:
    P[k] = np.round(np.nan_to_num(P[k]), 2)
pools = {k: round(float(P[k].sum()), 1) for k in LINES}
print('pools', pools, 'sum', round(sum(pools.values())))

# ------------------------------------------------------------------ rates, z, fees
Rr, Zs, F = {}, {}, {}
cpop = np.array([pop[pi == ci].sum() for ci in range(len(C))])
for k in LINES:
    cp = np.array([P[k][pi == ci].sum() for ci in range(len(C))])
    crate = np.where(cpop > 0, cp / np.maximum(cpop, 1), 0)
    Rr[k] = np.round((P[k] + PRIOR * crate[pi]) / (pop + PRIOR) * 10000, 2)
    ln = np.log(Rr[k] + 0.01)
    mu, sd = ln[scored].mean(), ln[scored].std()
    Zs[k] = np.round((ln - mu) / (sd if sd > 0 else 1), 3)
    F[k] = np.rint(P[k] * REP[k] * VAL[k] * FEE)
fees = sum(F[k] for k in LINES)
cases = np.round(sum(P[k] * REP[k] for k in LINES), 2)
m_cases = {k: round(pools[k] * REP[k], 1) for k in LINES}
m_fees = {k: int(round(m_cases[k] * VAL[k] * FEE)) for k in LINES}
fees_tot = int(sum(m_fees.values()))
W = {k: m_fees[k] / fees_tot * TIER[k] for k in LINES}


def pctrank(v, mask):
    """percentile 0 to 100 of each masked value among the masked values (share of values at or below it)"""
    out = np.full(len(v), np.nan)
    vv = v[mask]
    order = np.sort(vv)
    out[mask] = np.searchsorted(order, vv, side='right') / len(vv) * 100.0
    return out


wz = sum(W[k] * Zs[k] for k in LINES)
ez = sum(Zs[k] for k in LINES)
idx = np.round(pctrank(wz, scored), 1)
idx_eq = np.round(pctrank(ez, scored), 1)
zmat = np.array([Zs[k][scored] for k in LINES])
corr = np.corrcoef(zmat)


def spearman(a, b):
    ra = np.argsort(np.argsort(a))
    rb = np.argsort(np.argsort(b))
    return float(np.corrcoef(ra, rb)[0, 1])


sens = [float(np.corrcoef(wz[scored], ez[scored])[0, 1]), spearman(wz[scored], ez[scored])]

# ------------------------------------------------------------------ Getis-Ord Gi* on idx (ZIP and its eight nearest scored neighbours)
lat, lon = arr('lat'), arr('lon')
si = np.where(scored)[0]
la, lo = np.radians(lat[si]), np.radians(lon[si])
x = idx[si]
n = len(si)
xbar, s = x.mean(), x.std()
gi = np.full(N, np.nan)
for a in range(n):
    d = np.sin((la - la[a]) / 2) ** 2 + np.cos(la) * np.cos(la[a]) * np.sin((lo - lo[a]) / 2) ** 2
    nb = np.argpartition(d, 8)[:9]            # itself and eight nearest
    wsum = 9.0
    num = x[nb].sum() - xbar * wsum
    den = s * math.sqrt((n * wsum - wsum ** 2) / (n - 1))
    gi[si[a]] = num / den
gi = np.round(gi, 2)


def gicls(v):
    if v is None or np.isnan(v):
        return None
    a = abs(v)
    lvl = '99' if a >= 2.576 else '95' if a >= 1.96 else '90' if a >= 1.645 else None
    return 'ns' if lvl is None else ('H' if v > 0 else 'C') + lvl


# ------------------------------------------------------------------ competition
lic, roofers = arr('lic'), arr('roofers')
comp_n25 = np.zeros(N)
comp_mass = np.zeros(N)
roof_mass = np.zeros(N)
LA_, LO_ = np.radians(lat), np.radians(lon)
for i in range(N):
    d = np.sin((LA_ - LA_[i]) / 2) ** 2 + np.cos(LA_) * np.cos(LA_[i]) * np.sin((LO_ - LO_[i]) / 2) ** 2
    km = 12742 * np.arcsin(np.sqrt(d))
    k = 1.0 / (1.0 + (km / 10.0) ** 2)
    comp_n25[i] = lic[km <= 25].sum()
    comp_mass[i] = (lic * k).sum()
    roof_mass[i] = (roofers * k).sum()
roof_per10k = np.where(pop >= 200, (roofers + lic) / np.maximum(pop, 1) * 10000, np.nan)
rk = lambda v: pctrank(v, scored)
comp_pct = np.round(pctrank(0.6 * rk(comp_mass) + 0.4 * rk(roof_mass), scored), 1)
cpc_rel = np.round(np.array([DMA[r] for r in reg]) * (0.8 + 0.4 * comp_pct / 100.0), 3)
eff = np.rint(fees / cpc_rel)
effb = np.round(pctrank(eff, scored), 1)
oppb = np.round(pctrank(fees, scored), 1)


def tier_of(p):
    return 'A+' if p >= 95 else 'A' if p >= 85 else 'B' if p >= 65 else 'C' if p >= 40 else 'D' if p >= 15 else 'E'


BID = {'A+': 30, 'A': 20, 'B': 10, 'C': 0, 'D': -20, 'E': -50}


def quad_of(o, c):
    return 0 if (o >= 60 and c >= 60) else 1 if o >= 60 else 3 if c >= 60 else 2


fv = lambda a, i, d=None: (None if np.isnan(a[i]) else (round(float(a[i]), d) if d is not None else float(a[i])))
rows = {}
for i, zrow in enumerate(Z):
    z = zrow['zip']
    ok = bool(scored[i])
    o = {'metal_sh': float(metal_sh[i]), 'cru': round(float(cru[i]), 1), 'res_ok': int(ok),
         'solar_n': int(sol_n[i]) if have_solar else None, 'solar_sh': round(float(sol_sh[i]), 1) if have_solar else None,
         'solar_src': sol_src[i], 'solar_new': int(sol_new[i]) if have_solar else None,
         'solar_batt': int(sol_batt[i]) if have_solar else None,
         'fire_nxt': round(float(fire_nxt[i]), 1), 'storm_x': round(float(storm_x[i] * 1000), 2),
         'comp_n25': int(comp_n25[i]), 'comp_mass': round(float(comp_mass[i]), 2), 'roof_mass': round(float(roof_mass[i]), 2),
         'roof_per10k': fv(roof_per10k, i, 1)}
    for k in LINES:
        o['p_' + k] = float(P[k][i])
        o['r_' + k] = float(Rr[k][i]) if ok else None
        o['z_' + k] = float(Zs[k][i]) if ok else None
        o['f_' + k] = int(F[k][i])
    o['fees'] = int(fees[i])
    o['cases'] = float(cases[i])
    if ok:
        t = tier_of(effb[i])
        o.update(idx=float(idx[i]), idx_eq=float(idx_eq[i]), gi=float(gi[i]), gicls=gicls(gi[i]), comp_pct=float(comp_pct[i]),
                 cpc_rel=float(cpc_rel[i]), eff=int(eff[i]), effb=float(effb[i]), oppb=float(oppb[i]),
                 quad=quad_of(oppb[i], comp_pct[i]), tier=t, bid=BID[t])
    else:
        o.update(idx=None, idx_eq=None, gi=None, gicls=None, comp_pct=None, cpc_rel=None, eff=None, effb=None, oppb=None,
                 quad=None, tier=None, bid=None)
    rows[z] = o
model = {'W': W, 'corr': {a: {b: float(corr[i][j]) for j, b in enumerate(LINES)} for i, a in enumerate(LINES)}, 'sens': sens,
         'REP': REP, 'VAL': VAL, 'FEE': FEE, 'GRADE': GRADE, 'TIER': TIER, 'DMA': {str(k): v for k, v in DMA.items()},
         'REG': {str(k): v for k, v in REG.items()}, 'REGK': {str(k): v for k, v in REGK.items()},
         'P2R': {c['fips']: c['reg'] for c in C}, 'ANCH': ANCH, 'LINES': LINES, 'RES': RES, 'COM': COM, 'PRIOR': PRIOR,
         'CRU_W': CRU_W, 'LEAK': [round(float(v) * 100, 2) for v in leak], 'LEAK_F': round(leak_f, 4),
         'storm_anchor': round(float(storm_anchor)), 'haz_used': used_haz, 'haz_src': haz['src']}
print('fees_tot', fees_tot, {k: round(m_fees[k] / 1e6) for k in LINES})
print('W', {k: round(v, 3) for k, v in W.items()}, 'sens', [round(v, 3) for v in sens])
print('scored', int(scored.sum()), 'tiers', {t: sum(1 for r in rows.values() if r['tier'] == t) for t in BID})
save('lines.json', {'rows': rows, 'pools': pools, 'cases': m_cases, 'fees': m_fees, 'fees_tot': fees_tot, 'model': model})
