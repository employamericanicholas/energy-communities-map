"""Export a compact county -> MSA/non-MSA crosswalk for the web app from
Treasury's EC_MSA_V1_V2.xlsx (IRS Notice 2025-31 Appendix 1).

Output: docs/data/county_msa_xwalk.json
  { GEOID: [v1_code, v1_name, v2_code, v2_name], ... }

Codes are null where a geography has no entry for that vintage (e.g. legacy
Connecticut counties have no Vintage 2 code; CT planning regions have no
Vintage 1 code). Codes >= 100000 are non-metropolitan areas.
"""
import json, os
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XW = os.path.join(ROOT, "build", "src_xwalk", "EC_MSA_V1_V2.xlsx")
OUT = os.path.join(ROOT, "docs", "data", "county_msa_xwalk.json")


def main():
    ws = openpyxl.load_workbook(XW, read_only=True, data_only=True)["EC_MSA_V1_V2"]
    xw = {}
    for r in ws.iter_rows(min_row=3, values_only=True):
        if r[0] is None:
            continue
        g = str(int(r[0])).zfill(2) + str(int(r[1])).zfill(3)
        code = lambda v: str(int(v)) if v is not None else None
        name = lambda v: v if v else None
        xw[g] = [code(r[4]), name(r[5]), code(r[6]), name(r[7])]
    with open(OUT, "w") as f:
        json.dump(xw, f, separators=(",", ":"))
    print(f"{OUT}: {len(xw)} entries, {round(os.path.getsize(OUT)/1e3)} KB")


if __name__ == "__main__":
    main()
