import pypdf, re, os
BASE="Counties and Census Tracts Eligable for Coal and FFE/Eligible Coal Closure Census Tracts"
tok=re.compile(r'\b\d{10,11}\b')
for fn in ["AppendixC.pdf","Appendix3.pdf","Appendix4.pdf"]:
    r=pypdf.PdfReader(os.path.join(BASE,fn))
    allcodes=[]
    for pg in r.pages:
        allcodes+=tok.findall(pg.extract_text() or "")
    valid=[c for c in allcodes if len(c) in (10,11)]
    print(fn, "raw codes:", len(allcodes), "unique:", len(set(c.zfill(11) for c in valid)))
