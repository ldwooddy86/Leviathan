#!/usr/bin/env python3
"""Step 4. The roof age cohort model for California (contract m09_17 section 17.3, rebuilt).
Two cohorts per ZIP: tile roofs (age = age of the underlayment) and every other covering.
Yearly loop 1905 to 2026: new homes at age 0, wear (Weibull hazard), wildfire resets, ageing.
No hurricane resets. Calibration of the non-tile life to AHS 2023 West region rates by year built.
Writes work/roof.json.   Usage: python3 -I 04_roofmodel.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import numpy as np

base = load('base.json')
haz = load('haz.json')
Z = base['zips']
N = len(Z)
OB = ['o20', 'o10', 'o00', 'o90', 'o80', 'o70', 'o60', 'o50', 'o40', 'oold']
SPAN = {'o20': (2020, 2025), 'o10': (2010, 2019), 'o00': (2000, 2009), 'o90': (1990, 1999), 'o80': (1980, 1989),
        'o70': (1970, 1979), 'o60': (1960, 1969), 'o50': (1950, 1959), 'o40': (1940, 1949), 'oold': (1905, 1939)}
# RECS 2020, California single family homes, share with tile (clay + concrete) and wood, by era built
TILE_ERA = {'oold': 6.8, 'o40': 6.8, 'o50': 6.8, 'o60': 17.4, 'o70': 17.4, 'o80': 43.0, 'o90': 43.0, 'o00': 62.2, 'o10': 62.2, 'o20': 62.2}
WOOD_ERA = {'oold': 8.5, 'o40': 8.5, 'o50': 8.5, 'o60': 3.1, 'o70': 3.1, 'o80': 5.6, 'o90': 5.6, 'o00': 3.0, 'o10': 3.0, 'o20': 3.0}
TILE_STATE, WOOD_STATE = 27.4, 5.4
# RECS climate split: Hot-Dry tile 30.9% (20.3 + 10.6), Marine 18.3% (12.1 + 6.2), state 27.4%
CLIM = {'hot': 30.9 / 27.4, 'marine': 18.3 / 27.4}
REG_CLIM = {1: 'marine', 2: 'marine', 3: 'hot', 4: 'marine', 5: 'marine', 6: 'marine', 7: 'hot', 8: 'hot', 9: 'hot', 10: 'hot', 11: 'hot'}
AMAX = 122
Y0, Y1 = 1905, NOW
K = 3.0                 # Weibull shape, both curves (Louisiana's value; not refitted: six data points cannot fix two shapes)
LT = 27.0               # tile underlayment mean life, years (evidence: "about 25 years", "failing at 20 to 30 years"; owners defer)
FIRE_RB = 0.4           # share of destroyed homes rebuilt within four years (assumption)
FIRE_DM = 0.5           # share of fire damaged (not destroyed) homes that get a new roof the next year (assumption)
ACS_SEES_TO = 2023      # homes destroyed up to this year are already out of (or rebuilt in) the ACS 2020-2024 stock


def hazard(L, k=K, n=AMAX):
    lam = L / math.gamma(1 + 1 / k)
    S = np.exp(-(np.arange(n + 1) / lam) ** k)
    return 1 - S[1:] / S[:-1]


# ---------- calibration (17.3 d): cohort by era, hazard then background, read in 2022
AHS_WEST = {'before 1960': 4.16, '1960-1979': 4.69, '1980-1989': 3.56, '1990-1999': 4.10, '2000-2009': 3.06, '2010-2019': 1.09}
INS_WEST = 9.5          # % of West region roof jobs paid by insurance
RHO = round(INS_WEST / 100 * 3.65 / 100, 4)     # background resets a year in the calibration cohort (insurance paid jobs)
BANDS = {'before 1960': (1905, 1959, 6.8), '1960-1979': (1960, 1979, 17.4), '1980-1989': (1980, 1989, 43.0),
         '1990-1999': (1990, 1999, 43.0), '2000-2009': (2000, 2009, 62.2), '2010-2019': (2010, 2019, 62.2)}
TARGET = {b: round(v * (1 - INS_WEST / 100), 2) for b, v in AHS_WEST.items()}


def cohort_rate(L, a, b, read=2022):
    h = hazard(L)
    st = np.zeros(AMAX)
    wear = 0.0
    for y in range(a, read + 1):
        wear_y = st * h
        st = st - wear_y
        bg = st * RHO
        st = st - bg
        new = (1.0 / (b - a + 1)) if a <= y <= b else 0.0
        age0 = wear_y.sum() + bg.sum() + new
        st[1:] = st[:-1].copy()
        st[0] = age0
        wear = wear_y.sum()
    return 100 * wear / st.sum()


def fit_rates(L):
    out = {}
    for bnd, (a, b, tile) in BANDS.items():
        t = tile / 100.0
        out[bnd] = (1 - t) * cohort_rate(L, a, b) + t * cohort_rate(LT, a, b)
    return out


best = None
for L10 in range(160, 361):
    L = L10 / 10.0
    r = fit_rates(L)
    err = sum((r[b] - TARGET[b]) ** 2 for b in BANDS)
    if best is None or err < best[0]:
        best = (err, L, r)
err, LS, fitr = best
rmse = math.sqrt(err / len(BANDS))
print('calibration: non-tile mean life %.1f years, rmse %.2f points' % (LS, rmse))
for b in BANDS:
    print('  %-12s model %.2f  AHS West net of insurance %.2f (all jobs %.2f)' % (b, fitr[b], TARGET[b], AHS_WEST[b]))
vint = {b: [round(fitr[b], 2), TARGET[b]] for b in BANDS}

# ---------- material shares by ZIP
o = np.array([[d[k] for k in OB] for d in Z], dtype=float)                  # N x 10
reg = np.array([d['reg'] for d in Z])
cf = np.array([CLIM[REG_CLIM[r]] for r in reg])
te = np.array([TILE_ERA[k] for k in OB]) / 100.0
we = np.array([WOOD_ERA[k] for k in OB]) / 100.0
tile = np.minimum(0.9, te[None, :] * cf[:, None])
for _ in range(20):          # rescale to the state share
    s = TILE_STATE / 100.0 / ((o * tile).sum() / o.sum())
    tile = np.minimum(0.9, tile * s)
wood = we[None, :] * np.ones((N, 1))
wood *= WOOD_STATE / 100.0 / ((o * wood).sum() / o.sum())
print('state tile share %.2f%%, wood %.2f%%' % (100 * (o * tile).sum() / o.sum(), 100 * (o * wood).sum() / o.sum()))

# ---------- fire inputs
fy = haz['fire_year']
zi = {d['zip']: i for i, d in enumerate(Z)}
dest = {}      # year -> array of residential structures destroyed
dmg = {}
lastfire = [None] * N
fire_dest_all = np.zeros(N)
fire_dmg_all = np.zeros(N)
for z, d in fy.items():
    if z not in zi:
        continue
    i = zi[z]
    for y, v in d.items():
        yy = int(y)
        dest.setdefault(yy, np.zeros(N))[i] += v[0]
        dmg.setdefault(yy, np.zeros(N))[i] += v[1]
        fire_dest_all[i] += v[2]
        fire_dmg_all[i] += v[3]
        if v[2] + v[3] > 0 and (lastfire[i] is None or yy > lastfire[i]):
            lastfire[i] = yy

# ---------- yearly loop
hS, hT = hazard(LS), hazard(LT)
A = np.zeros((N, AMAX))     # non-tile roofs by age
T = np.zeros((N, AMAX))     # tile roofs by underlayment age
rh = np.zeros((N, NOW - 2000 + 1, 2))
removed = np.zeros(N)       # homes destroyed after the ACS window and not yet rebuilt
for y in range(Y0, Y1 + 1):
    newS = np.zeros(N)
    newT = np.zeros(N)
    for j, k in enumerate(OB):
        a, b = SPAN[k]
        if a <= y <= b:
            newS += o[:, j] * (1 - tile[:, j]) / (b - a + 1)
            newT += o[:, j] * tile[:, j] / (b - a + 1)
    wS = A * hS[None, :]
    wT = T * hT[None, :]
    A -= wS
    T -= wT
    fire0S = np.zeros(N)
    fire0T = np.zeros(N)
    shown = np.zeros(N)
    # fire damaged homes reroofed the year after the fire
    if (y - 1) in dmg:
        tot = A.sum(1) + T.sum(1)
        sh = np.minimum(0.9, FIRE_DM * dmg[y - 1] / np.maximum(tot, 1))
        rs, rt = A * sh[:, None], T * sh[:, None]
        A -= rs
        T -= rt
        fire0S += rs.sum(1)
        fire0T += rt.sum(1)
        shown += rs.sum(1) + rt.sum(1)
    # homes destroyed after the ACS window leave the stock in the fire year
    if y in dest and y > ACS_SEES_TO:
        tot = A.sum(1) + T.sum(1)
        sh = np.minimum(0.95, dest[y] / np.maximum(tot, 1))
        A *= (1 - sh)[:, None]
        T *= (1 - sh)[:, None]
    # rebuilds: a quarter of the rebuilt share in each of the four years after the fire
    for back in (1, 2, 3, 4):
        yy = y - back
        if yy in dest:
            rb = FIRE_RB * dest[yy] / 4.0
            shown += rb
            if yy > ACS_SEES_TO:     # only these enter the stock here; earlier rebuilds are already in the Census year-built counts
                t20 = tile[:, 0]
                fire0S += rb * (1 - t20)
                fire0T += rb * t20
    A[:, 1:] = A[:, :-1].copy()
    T[:, 1:] = T[:, :-1].copy()
    A[:, 0] = wS.sum(1) + newS + fire0S
    T[:, 0] = wT.sum(1) + newT + fire0T
    if y >= 2000:
        rh[:, y - 2000, 0] = wS.sum(1) + wT.sum(1)
        rh[:, y - 2000, 1] = shown


def bins(M):
    B = np.zeros((N, 41))
    B[:, :40] = M[:, :40]
    B[:, 40] = M[:, 40:].sum(1)
    return B


BA, BT = bins(A), bins(T)
agez_f = BA + BT
agez = np.rint(agez_f).astype(int)
agez_t = np.minimum(agez, np.rint(BT).astype(int))
roofs = agez.sum(1)
nxtS = (A * hS[None, :]).sum(1)
nxtT = (T * hT[None, :]).sum(1)
tot = np.maximum(A.sum(1) + T.sum(1), 1e-9)
meanh = (nxtS + nxtT) / tot
mf24 = np.array([d['mf24'] for d in Z])
tsh = T.sum(1) / tot
MF24_ROOF = 0.354
nxt = nxtS + MF24_ROOF * mf24 * (1 - tsh) * np.where(A.sum(1) > 0, nxtS / np.maximum(A.sum(1), 1e-9), 0)
nxt_t = nxtT + MF24_ROOF * mf24 * tsh * np.where(T.sum(1) > 0, nxtT / np.maximum(T.sum(1), 1e-9), 0)
rows = {}
for i, d in enumerate(Z):
    az = agez[i]
    r = int(roofs[i])
    cum = np.cumsum(az)
    med = int(np.searchsorted(cum, r / 2.0)) if r > 0 else None
    ra15, ra20, ra25 = int(az[15:].sum()), int(az[20:].sum()), int(az[25:].sum())
    u1 = d['u1']
    rows[d['zip']] = {
        'roofs': r, 'ra_med': med, 'ra15': ra15, 'ra20': ra20, 'ra25': ra25,
        'ra15_sh': pct(ra15, r), 'ra20_sh': pct(ra20, r), 'ra25_sh': pct(ra25, r), 'wave': ra15 - ra20,
        'nxt': round(float(nxt[i]), 1), 'nxt_t': round(float(nxt_t[i]), 1),
        'tile_sh': round(100 * float(tsh[i]), 1) if r > 0 else None, 'tile_n': int(agez_t[i].sum()),
        'tile25': int(agez_t[i][25:].sum()),
        'wood_sh': round(100 * float((o[i] * wood[i]).sum() / o[i].sum()), 1) if o[i].sum() > 0 else None,
        'lastfire': lastfire[i], 'yrsfire': (NOW - lastfire[i]) if lastfire[i] else None,
        'fire_dest': int(fire_dest_all[i]), 'fire_dmg': int(fire_dmg_all[i]),
        'fire_res': int(sum(dest[y][i] for y in dest)),
        'agez': az.tolist(), 'agez_t': agez_t[i].tolist(),
        'rhist': [[round(float(a), 1), round(float(b), 1)] for a, b in rh[i]],
        'mean_h': round(float(meanh[i]), 5),
    }
print('state roofs', int(roofs.sum()), 'u1', sum(d['u1'] for d in Z), 'nxt', round(float(nxt.sum())), 'nxt_t', round(float(nxt_t.sum())),
      'ra20 %.1f%%' % (100 * agez[:, 20:].sum() / roofs.sum()), 'ra25 %.1f%%' % (100 * agez[:, 25:].sum() / roofs.sum()),
      'tile roofs', int(agez_t.sum()), 'tile25', int(agez_t[:, 25:].sum()))
st = agez.sum(0)
print('median age', int(np.searchsorted(np.cumsum(st), st.sum() / 2)), 'wear rate now %.2f%% a year (non-tile %.2f, tile %.2f)' % (
    100 * (nxtS.sum() + nxtT.sum()) / tot.sum(), 100 * nxtS.sum() / A.sum(), 100 * nxtT.sum() / T.sum()))
# empirical look at the rebuild share: homes built 2020 or later against residences destroyed 2017 to 2020
num_, den_ = 0.0, 0.0
for i, d in enumerate(Z):
    dd = sum(dest[y][i] for y in dest if 2017 <= y <= 2020)
    if dd >= 200:
        num_ += d['yb20']
        den_ += dd
print('ZIPs with 200+ residences destroyed 2017-2020: homes built 2020 or later / destroyed = %.2f (n destroyed %d)' % (num_ / den_, den_))
save('roof.json', {'rows': rows, 'WB': {'L': LS, 'k': K, 'rho': RHO, 'fit': vint, 'rmse': round(rmse, 2)}, 'WBT': {'L': LT, 'k': K},
                   'const': {'FIRE_RB': FIRE_RB, 'FIRE_DM': FIRE_DM, 'ACS_SEES_TO': ACS_SEES_TO, 'MF24_ROOF': MF24_ROOF,
                             'TILE_ERA': TILE_ERA, 'WOOD_ERA': WOOD_ERA, 'CLIM': CLIM, 'REG_CLIM': REG_CLIM,
                             'TILE_STATE': TILE_STATE, 'WOOD_STATE': WOOD_STATE, 'AHS_WEST': AHS_WEST, 'INS_WEST': INS_WEST},
                   'agehist': st.tolist(), 'agehist_t': agez_t.sum(0).tolist(),
                   'replace_hist': {str(2000 + j): [round(float(rh[:, j, 0].sum())), round(float(rh[:, j, 1].sum()))] for j in range(rh.shape[1])},
                   'rebuild_check': {'ratio': round(num_ / den_, 3), 'destroyed': den_}})
