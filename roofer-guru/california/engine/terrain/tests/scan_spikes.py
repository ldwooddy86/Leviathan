"""Scans decoded terrarium tiles (a folder of <z>_<x>_<y>.png) for false spikes: pixels that stand far above all but
five of the 24 round them. Says how many lie within three pixels of the sea (what the kit's despike removes) and how
many lie inland (what it does not).   python3 -I scan_spikes.py <folder> <near threshold m> <inland threshold m>"""
import sys, glob, os
import numpy as np
from PIL import Image
from numpy.lib.stride_tricks import sliding_window_view as swv
d0, NEAR, FAR = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
tn = tf = 0
for f in sorted(glob.glob(os.path.join(d0, '*.png'))):
    a = np.asarray(Image.open(f).convert('RGB'), dtype=np.float64); h = a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
    sea = h <= 3; d = np.where(h < 0, 0, h); p = np.pad(d, 2, mode='edge'); w = swv(p, (5, 5)).reshape(256, 256, 25)
    w = np.delete(w, 12, axis=2); n6 = np.sort(w, axis=2)[:, :, -6]; spike = d - n6
    near = np.zeros_like(sea); cur = sea.copy()
    for _ in range(3):
        q = np.pad(cur, 1); grown = np.zeros_like(cur)
        for dy in (0, 1, 2):
            for dx in (0, 1, 2): grown |= q[dy:dy + 256, dx:dx + 256]
        near |= grown & ~sea; cur = grown
    a1 = (spike > NEAR) & near; a2 = (spike > FAR) & ~near & ~sea
    if a1.any() or a2.any():
        print('%-14s near the sea: %3d (worst %5d m over)   inland: %3d (worst %5d m over, heights %s)' % (os.path.basename(f), a1.sum(), spike[a1].max() if a1.any() else 0, a2.sum(), spike[a2].max() if a2.any() else 0, np.round(d[a2][:4]).astype(int).tolist()))
    tn += a1.sum(); tf += a2.sum()
print('total near the sea', tn, ' inland', tf)
