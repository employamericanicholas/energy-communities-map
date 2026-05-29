"""Tag each dissolved MSA/non-MSA region with whether it is a qualifying
Fossil Fuel Employment (FFE) energy community under that vintage.

The Statistical Area Category is determined at the MSA / non-MSA level:
an area qualifies if it meets the 0.17% FFE threshold AND the unemployment
requirement. Treasury's "DO meet" county file carries per-county Vintage 1
and Vintage 2 YES/NO flags; qualification is areal, so every county in an
area shares the same flag (verified: 0 inconsistent areas). We map those
county flags up to the area code via the EC_MSA_V1_V2 crosswalk and write
properties.ffe_do onto each region polygon.
"""
import json, os, openpyxl
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "docs", "data")
XW = os.path.join(ROOT, "build", "src_xwalk", "EC_MSA_V1_V2.xlsx")


def main():
    do = json.load(open(os.path.join(ROOT, "data", "ffe_do.json")))
    qual_v1 = {f for f, v in do.items() if v["v1"]}
    qual_v2 = {f for f, v in do.items() if v["v2"]}

    ws = openpyxl.load_workbook(XW, read_only=True, data_only=True).active
    rows = list(ws.iter_rows(values_only=True))[2:]
    codes_v1, codes_v2 = set(), set()  # area codes that qualify
    for r in rows:
        if r[0] is None:
            continue
        fips = f"{int(r[0]):02d}{int(r[1]):03d}"
        if r[4] is not None and fips in qual_v1:
            codes_v1.add(int(r[4]))
        if r[6] is not None and fips in qual_v2:
            codes_v2.add(int(r[6]))

    for fn, codes in [("cbsa_v1_2010", codes_v1), ("cbsa_v2_2020", codes_v2)]:
        path = os.path.join(D, fn + ".geojson")
        gj = json.load(open(path))
        n = 0
        for f in gj["features"]:
            q = int(f["properties"]["GEOID"]) in codes
            f["properties"]["ffe_do"] = q
            n += q
        json.dump(gj, open(path, "w"))
        print(f"{fn}: {n}/{len(gj['features'])} regions qualify as FFE energy communities")


if __name__ == "__main__":
    main()
