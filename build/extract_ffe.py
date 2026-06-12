import pypdf, openpyxl, re, json, os
# Currently-qualifying (FFE threshold + unemployment) source. IRS Notice
# 2026-39 Appendix 1 supersedes the 2025-31 "DO meet" file: it uses 2025
# calendar-year unemployment rates (status applicable as of June 10, 2026).
# Same column layout: State FIPS, County FIPS, State, County, V1 YES/NO, V2 YES/NO.
DO="Counties and Census Tracts Eligable for Coal and FFE/IRS 2026 Energy Community Updates/n-26-39-appendix-1.xlsx"
MAYDIR="Counties and Census Tracts Eligable for Coal and FFE/Eligible FFE Counties that MAY meet Unemployment Threshold"
MAYX=os.path.join(MAYDIR,"n-25-31-appendix-2.xlsx")

# ---- DO meet (currently-qualifying energy communities) ----
do={}
wb=openpyxl.load_workbook(DO, read_only=True, data_only=True); ws=wb.active
for i,r in enumerate(ws.iter_rows(values_only=True)):
    if i<3 or not r or r[0] is None: continue
    try: fips=f"{int(r[0]):02d}{int(r[1]):03d}"
    except: continue
    do[fips]={"state":r[2],"county":r[3],
              "v1":str(r[4]).strip().upper()=="YES","v2":str(r[5]).strip().upper()=="YES"}
wb.close()
json.dump(do, open("data/ffe_do.json","w"))
print("FFE DO-meet counties:", len(do), " V1:",sum(v['v1'] for v in do.values()), " V2:",sum(v['v2'] for v in do.values()))

# ---- MAY meet ----
may={}
def addmay(fips, state, county, src):
    e=may.setdefault(fips, {"state":state,"county":county,"src":set()})
    e["src"].add(src)
line_re=re.compile(r'^(\d{2})\s+(\d{3})\b\s+(.*)$')
def parse_may_pdf(fn, src):
    r=pypdf.PdfReader(os.path.join(MAYDIR,fn)); c=0
    for pg in r.pages:
        for line in (pg.extract_text() or "").split("\n"):
            m=line_re.match(line.strip())
            if m:
                fips=m.group(1)+m.group(2); rest=m.group(3)
                # state name = leading alpha words until county; best effort
                addmay(fips, None, rest, src); c+=1
    print(f"{src}: {c} rows")
parse_may_pdf("AppendixB_MSAMayFFE.pdf","2023-29_AppB")
parse_may_pdf("Appendix1_MSAMayFFE.pdf","2023-47_App1")
parse_may_pdf("Appendix1B_MSAMayFFE.pdf","2024-30_App1")
# 2025-31 additions xlsx
wb=openpyxl.load_workbook(MAYX, read_only=True, data_only=True); ws=wb.active
xc=0
for i,r in enumerate(ws.iter_rows(values_only=True)):
    if i<2 or not r or r[0] is None: continue
    try: fips=f"{int(r[0]):02d}{int(r[1]):03d}"
    except: continue
    addmay(fips, r[2], r[3], "2025-31_App2"); xc+=1
wb.close()
print("2025-31_App2:", xc)
mayout={f:{"src":sorted(v["src"])} for f,v in may.items()}
json.dump(mayout, open("data/ffe_may.json","w"))
print("FFE MAY-meet unique counties:", len(mayout))
# overlap
print("MAY also in DO:", len(set(may)&set(do)))
