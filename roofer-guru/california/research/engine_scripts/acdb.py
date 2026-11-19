import openpyxl, sys
p='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/engine/faa_acdb.xlsx'
wb=openpyxl.load_workbook(p, read_only=True, data_only=True)
print(wb.sheetnames)
for ws in wb.worksheets:
    rows=list(ws.iter_rows(values_only=True))
    print('SHEET',ws.title,len(rows))
    if len(rows)<3: continue
    hdr=rows[0]
    print(hdr)
    if 'ICAO_Code' in hdr or 'ICAO Code' in hdr or any(h and 'ICAO' in str(h) for h in hdr):
        ic=[i for i,h in enumerate(hdr) if h and 'ICAO' in str(h)][0]
        want=set(sys.argv[1:])
        for r in rows[1:]:
            if r[ic] in want:
                print({hdr[i]:r[i] for i in range(len(hdr)) if r[i] is not None})
    else:
        for r in rows[:25]: print(r)
