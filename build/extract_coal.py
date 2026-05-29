import pypdf, openpyxl, re, json, os
from collections import Counter
BASE="Counties and Census Tracts Eligable for Coal and FFE/Eligible Coal Closure Census Tracts"
VALID_ST={f"{i:02d}" for i in [1,2,4,5,6,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,49,50,51,53,54,55,56,60,66,69,72,78]}
tracts={}
def add(geoid, ttype, src):
    geoid=geoid.strip()
    if not geoid.isdigit(): return False
    if len(geoid)==10: geoid="0"+geoid
    if len(geoid)!=11: return False
    if geoid[:2] not in VALID_ST: return False
    e=tracts.setdefault(geoid, {"types":set(),"src":set()})
    if ttype and ttype.strip(): e["types"].add(ttype.strip())
    e["src"].add(src); return True

code_re=re.compile(r'(\d{10,11})')
def parse_pdf(path, src):
    r=pypdf.PdfReader(path); cnt=0
    for pg in r.pages:
        for line in (pg.extract_text() or "").split("\n"):
            for m in code_re.finditer(line):
                code=m.group(1)
                ttype=line[m.end():].strip()
                ttype=re.sub(r'^[^A-Za-z]+','',ttype)  # strip leftover
                if add(code, ttype, src): cnt+=1
    print(f"{src}: added {cnt}")

parse_pdf(os.path.join(BASE,"AppendixC.pdf"),"2023-29_AppC")
parse_pdf(os.path.join(BASE,"Appendix3.pdf"),"2023-47_App3")
parse_pdf(os.path.join(BASE,"Appendix4.pdf"),"2024-48_App2")
wb=openpyxl.load_workbook(os.path.join(BASE,"IRSnotice2025-31Appendix4.xlsx"), read_only=True, data_only=True)
for i,row in enumerate(wb.active.iter_rows(values_only=True)):
    if i<2 or not row or row[2] is None: continue
    add(str(row[2]).strip(), str(row[3] or ""), "2025-31_App4")
wb.close()
out={g:{"types":sorted(v["types"]),"src":sorted(v["src"])} for g,v in tracts.items()}
json.dump(out, open("data/coal_tracts.json","w"))
print("TOTAL UNIQUE:", len(out), "states:", len(set(g[:2] for g in out)))
