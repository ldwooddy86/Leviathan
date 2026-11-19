import openpyxl, sys, warnings
warnings.filterwarnings('ignore')
p='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/engine/faa_acdb.xlsx'
wb=openpyxl.load_workbook(p, read_only=True, data_only=True)
ws=wb['ACD_Data']
rows=list(ws.iter_rows(values_only=True))
hdr=rows[0]
H={h:i for i,h in enumerate(hdr) if h}
cols=['ICAO_Code','Model_FAA','Approach_Speed_knot','Wingspan_ft_without_winglets_sharklets','Wingspan_ft_with_winglets_sharklets','Length_ft','Tail_Height_at_OEW_ft','MTOW_lb','FAA_Weight','CWT','Rotor_Diameter_ft','TMFS_Operations_FY24']
out=open('/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/research/ca/engine_txt/faa_acdb_extract.txt','w')
out.write(' | '.join(cols)+'\n')
pat=sys.argv[1:]
for r in rows[1:]:
    if r[H['ICAO_Code']] is None: continue
    line=' | '.join(str(r[H[c]]) for c in cols)
    out.write(line+'\n')
    if any(x.lower() in (str(r[H['ICAO_Code']])+' '+str(r[H['Model_FAA']])).lower() for x in pat):
        print(line)
out.close()
