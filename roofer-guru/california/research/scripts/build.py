import re,os,sys,html,glob
SP='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad'
PL=SP+'/ca/dl/law/publaw'; WB=SP+'/ca/dl/law/statutes'; FR=SP+'/research/ca/frag'
NAME={'BPC':'Bus. & Prof. Code','CIV':'Civil Code','CCP':'Code Civ. Proc.','PEN':'Penal Code','INS':'Insurance Code','HSC':'Health & Safety Code','PRC':'Pub. Resources Code','GOV':'Government Code','LAB':'Labor Code'}
SLUG={'BPC':'ca_bus_and_prof_code_section_','CIV':'ca_civ_code_section_','CCP':'ca_civ_proc_code_section_','PEN':'ca_penal_code_section_','INS':'ca_ins_code_section_','HSC':'ca_health_and_safety_code_section_','PRC':'ca_pub_res_code_section_','GOV':"ca_gov't_code_section_",'LAB':'ca_lab_code_section_'}
MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
missing=[]
def wb(code,sec):
    fn=f'{WB}/wb_{code}_{sec}.html'
    if not os.path.exists(fn) or os.path.getsize(fn)<20000: return None
    raw=open(fn,errors='ignore').read(); m=re.search(r'/web/(\d{14})/https://leginfo',raw)
    if not m: return None
    ts=m.group(1); d=f'{int(ts[6:8])} {MON[int(ts[4:6])-1]} {ts[:4]}'
    return f"{NAME[code]} § {sec}, California Legislative Information [Wayback Machine capture of {d}]. https://web.archive.org/web/{ts}/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode={code}&sectionNum={sec}"
def pl(code,sec):
    fn=f'{PL}/pl_{code}_{sec}.html'
    if not os.path.exists(fn) or os.path.getsize(fn)<12000: return None
    t=html.unescape(re.sub(r'<[^>]+>',' ',open(fn,errors='ignore').read())); t=re.sub(r'\s+',' ',t)
    m=re.search(r'\(updated ([^;]+); accessed ([^)]+)\)',t); upd=m.group(1) if m else 'date not shown'
    return f"{NAME[code]} § {sec} [california.public.law transcription of the Legislature's text; the site says \"updated {upd}\"]. https://california.public.law/codes/{SLUG[code]}{sec} (opened 19 Nov 2026)"
def rep(m):
    kind,code,sec=m.group(1),m.group(2),m.group(3)
    r=(wb(code,sec) if kind=='WB' else pl(code,sec)) or (pl(code,sec) if kind=='WB' else wb(code,sec))
    if not r: missing.append(m.group(0)); return m.group(0)
    return r
out=[]
for fn in sorted(glob.glob(FR+'/*.md')):
    if os.path.basename(fn).startswith('NOTES'): continue
    out.append(re.sub(r'\{\{(WB|PL):([A-Z]+):([0-9.]+)\}\}',rep,open(fn,encoding='utf-8').read()).rstrip()+'\n')
dest=SP+'/research/ca/roofing_law_evidence.md'
open(dest,'w',encoding='utf-8').write('\n'.join(out))
print('wrote',dest,os.path.getsize(dest),'bytes; fragments:',[os.path.basename(f) for f in sorted(glob.glob(FR+'/*.md')) if not os.path.basename(f).startswith('NOTES')]); print('unresolved tokens:',missing)
