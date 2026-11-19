import csv,sys,re,collections,statistics as st
rows=list(csv.DictReader(open(sys.argv[1],newline='',encoding='utf-8',errors='ignore')))
print('rows',len(rows))
def num(s):
    try: return float(str(s).replace(',',''))
    except: return None
def area_sq(d):
    u=d.lower()
    m=re.search(r'([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sf\b|square\s*f(?:ee|oo)t|s\.f\.)',u)
    if m:
        a=num(m.group(1)); 
        if a and 200<=a<=100000: return a/100.0
    m=re.search(r'([\d,]+(?:\.\d+)?)\s*(?:squares|sqs\b|sq\b(?!\.?\s*f))',u)
    if m:
        a=num(m.group(1))
        if a and 2<=a<=1000: return a
    return None
def mat(d):
    u=d.lower()
    if re.search(r'torch|modified|mod\.? bit|sbs|app\b|cap sheet',u): return 'modified bitumen / torch-down / cap sheet'
    if re.search(r'tpo|pvc|single[- ]ply|epdm',u): return 'single-ply (TPO/PVC/EPDM)'
    if re.search(r'built[- ]?up|bur\b|tar\s*(and|&)\s*gravel|hot mop',u): return 'built-up / tar and gravel'
    if re.search(r'shingle|comp\b|composition',u): return 'composition shingles'
    if re.search(r'tile|slate',u): return 'tile / slate'
    if re.search(r'metal|standing seam',u): return 'metal'
    if re.search(r'coating|silicone|acrylic|elastomeric',u): return 'coating'
    if re.search(r'foam|spf',u): return 'spray foam'
    return 'not stated'
q=lambda a,p: sorted(a)[int(p*(len(a)-1))]
yr=collections.Counter(r['filed_date'][:4] for r in rows); print('by filed year',sorted(yr.items()))
use=collections.Counter(r['existing_use'] for r in rows); print('existing use',use.most_common(8))
mc=collections.Counter(mat(r['description']) for r in rows); n=len(rows)
print('material stated in description:'); 
for k,v in mc.most_common(): print(f'   {k}: {v} ({100*v/n:.1f}%)')
sf12=[r for r in rows if r['existing_use'] in('1 family dwelling','2 family dwelling')]
mc=collections.Counter(mat(r['description']) for r in sf12); n=len(sf12)
print('material, 1-2 family dwellings only (n=%d):'%n)
for k,v in mc.most_common(): print(f'   {k}: {v} ({100*v/n:.1f}%)')
def summ(sel,label):
    vals=[num(r['estimated_cost']) for r in sel if num(r['estimated_cost']) and num(r['estimated_cost'])>=500]
    per=[]; sqs=[]
    for r in sel:
        v=num(r['estimated_cost']); s=area_sq(r['description'])
        if s: sqs.append(s)
        if v and s and v>=500: per.append(v/s)
    if len(vals)<25: print('  ',label,'n too small',len(vals)); return
    print(f'  {label}: n={len(sel)} | estimated cost median ${st.median(vals):,.0f} (p25 ${q(vals,.25):,.0f}, p75 ${q(vals,.75):,.0f})'+(f' | squares median {st.median(sqs):.1f} (n={len(sqs)}) | $ per square median ${st.median(per):,.0f} (p25 ${q(per,.25):,.0f}, p75 ${q(per,.75):,.0f}, n={len(per)})' if len(per)>=25 else ''))
for y in ['2023','2024','2025','2026']:
    summ([r for r in sf12 if r['filed_date'][:4]==y],'1-2 family '+y)
recent=[r for r in rows if r['filed_date'][:4] in('2024','2025','2026')]
for u in ['1 family dwelling','2 family dwelling','apartments','office','retail sales']:
    summ([r for r in recent if r['existing_use']==u],u+' 2024-2026')
for m in ['modified bitumen / torch-down / cap sheet','composition shingles','single-ply (TPO/PVC/EPDM)','built-up / tar and gravel','tile / slate','metal','coating']:
    summ([r for r in recent if mat(r['description'])==m and r['existing_use'] in('1 family dwelling','2 family dwelling')],'1-2 family, '+m+' 2024-2026')
print([r['description'][:160] for r in rows[:5]])
