import openpyxl, warnings, sys, re, json
warnings.filterwarnings('ignore')
D='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/engine/'
T='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/research/ca/engine_txt/'
def load(f, sheet):
    wb=openpyxl.load_workbook(D+f, read_only=True, data_only=True)
    ws=wb[sheet]; rows=list(ws.iter_rows(values_only=True)); hdr=[h for h in rows[0]]
    return hdr, rows[1:], wb
mode=sys.argv[1]
if mode=='preface':
    for f in ['caltrans_2024_volumes.xlsx','caltrans_2024_truck.xlsx','caltrans_2024_peak.xlsx']:
        wb=openpyxl.load_workbook(D+f, read_only=True, data_only=True)
        print('=====',f)
        for r in wb['Preface'].iter_rows(values_only=True):
            t=' '.join(str(c) for c in r if c is not None).strip()
            if t: print('  ',t[:700])
elif mode=='dump':
    # write tab-separated text copies for grep
    for f,s,o in [('caltrans_2024_volumes.xlsx','2024 AADT DATA','caltrans_2024_volumes.tsv'),('caltrans_2024_truck.xlsx','Truck AADTs 2024','caltrans_2024_truck.tsv'),('caltrans_2024_peak.xlsx','2024 PEAK HOURS REPORT','caltrans_2024_peak.tsv')]:
        hdr,rows,wb=load(f,s)
        with open(T+o,'w') as fo:
            fo.write('\t'.join(str(h) for h in hdr)+'\n')
            for r in rows:
                fo.write('\t'.join('' if c is None else str(c).strip() for c in r)+'\n')
        print(o,len(rows))
