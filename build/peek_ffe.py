import pypdf, os, io, sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE="Counties and Census Tracts Eligable for Coal and FFE/Eligible FFE Counties that MAY meet Unemployment Threshold"
for fn in ["AppendixB_MSAMayFFE.pdf","Appendix1_MSAMayFFE.pdf","Appendix1B_MSAMayFFE.pdf"]:
    r=pypdf.PdfReader(os.path.join(BASE,fn))
    print("\n==== ",fn, len(r.pages),"pages ====")
    print(r.pages[0].extract_text()[:1500])
