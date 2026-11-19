"""Copies California's sources of record from the scratch folder into the repository (roofer-guru/california/), leaving
   out downloads, build outputs, pictures, pages and anything over 5 MB. Run before each commit: python3 -I snapshot.py"""
import os, shutil
SP = '/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad'
D = '/home/user/Leviathan/roofer-guru/california'
SKIP_DIR = {'dl', 'out', '__pycache__', 'node_modules', 'raw', 'cache', 'tmp', 'shots', 'screens', 'screenshots'}
SKIP_FILE = {'la_atlas_source.html', 'la_atlas_data.json', 'la_nws_snapshot.json', 'la_engine.js', 'la_engine-style.css'}
SKIP_EXT = {'.png', '.jpg', '.jpeg', '.webp', '.html', '.zip', '.gz', '.tif', '.pyc', '.log', '.bin', '.npy', '.npz', '.pkl', '.csv', '.geojson', '.dat', '.lerc', '.pdf', '.xlsx'}
def copy_tree(src, dst, only_ext=None, cap=5 << 20):
    n = b = 0
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in SKIP_DIR and not d.startswith('.')]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if f in SKIP_FILE or ext in SKIP_EXT or (only_ext and ext not in only_ext): continue
            p = os.path.join(root, f)
            if os.path.islink(p) or os.path.getsize(p) > cap: continue
            q = os.path.join(dst, os.path.relpath(p, src))
            os.makedirs(os.path.dirname(q), exist_ok=True)
            shutil.copy2(p, q); n += 1; b += os.path.getsize(p)
    return n, b
if os.path.isdir(D): shutil.rmtree(D)
a = copy_tree(os.path.join(SP, 'ca'), D)
c = copy_tree(os.path.join(SP, 'research', 'ca'), os.path.join(D, 'research'), only_ext={'.md', '.py', '.sh', '.js'}, cap=2 << 20)
print('copied', a[0] + c[0], 'files,', round((a[1] + c[1]) / 1e6, 1), 'MB')
