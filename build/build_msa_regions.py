"""Rebuild Vintage 1 / Vintage 2 MSA + non-MSA region boundaries by dissolving
county polygons using Treasury's authoritative IRS energy-community crosswalk
(EC_MSA_V1_V2.xlsx). This guarantees the rendered boundaries match exactly the
groupings the IRS used to determine Statistical Area eligibility.

Vintage 1 (2010-based) keys on legacy Connecticut counties (09001-09015);
Vintage 2 (2023) keys on Connecticut planning regions (09110-09190), whose
geometry comes from the cb_2023 county cartographic file.

Codes >= 100000 are BLS-style non-metropolitan areas; 5-digit codes are CBSA
(metropolitan/micropolitan) areas.
"""
import json, os
import openpyxl
import shapefile
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XW   = os.path.join(ROOT, "build", "src_xwalk", "EC_MSA_V1_V2.xlsx")
CTY  = os.path.join(ROOT, "docs", "data", "counties.geojson")
CT23 = os.path.join(ROOT, "build", "src_xwalk", "cb_2023_county", "cb_2023_us_county_500k")
OUT  = os.path.join(ROOT, "docs", "data")

PREC = 4  # coordinate decimal places (~11 m), matches counties.geojson


def load_crosswalk():
    ws = openpyxl.load_workbook(XW, read_only=True, data_only=True)["EC_MSA_V1_V2"]
    xw = {}
    for r in ws.iter_rows(min_row=3, values_only=True):
        if r[0] is None:
            continue
        g = str(int(r[0])).zfill(2) + str(int(r[1])).zfill(3)
        xw[g] = {"v1": r[4], "v1n": r[5], "v2": r[6], "v2n": r[7]}
    return xw


def load_geometry():
    geom = {}
    gj = json.load(open(CTY))
    for ft in gj["features"]:
        geom[ft["properties"]["GEOID"]] = shape(ft["geometry"]).buffer(0)
    # add Connecticut planning regions (Vintage 2 geography) from cb_2023
    rdr = shapefile.Reader(CT23)
    flds = [f[0] for f in rdr.fields[1:]]
    gi = flds.index("GEOID")
    for sr in rdr.iterShapeRecords():
        g = str(sr.record[gi])
        if g.startswith("09") and g not in geom:
            geom[g] = shape(sr.shape.__geo_interface__).buffer(0)
    return geom


def round_coords(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], PREC), round(obj[1], PREC)]
        return [round_coords(x) for x in obj]
    return obj


def build(xw, geom, codekey, namekey):
    groups = {}
    for g, rec in xw.items():
        code = rec[codekey]
        if code is None or g not in geom:
            continue
        groups.setdefault(int(code), {"name": rec[namekey], "geoms": []})
        groups[int(code)]["geoms"].append(geom[g])
    feats = []
    for code, info in sorted(groups.items()):
        merged = unary_union(info["geoms"])
        gj = mapping(merged)
        gj["coordinates"] = round_coords(gj["coordinates"])
        feats.append({
            "type": "Feature",
            "properties": {
                "GEOID": str(code),
                "NAME": info["name"],
                "kind": "non-MSA" if code >= 100000 else "MSA",
            },
            "geometry": gj,
        })
    return feats


def write(feats, fn):
    path = os.path.join(OUT, fn)
    with open(path, "w") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f)
    n_msa = sum(1 for x in feats if x["properties"]["kind"] == "MSA")
    print(f"{fn}: {len(feats)} regions ({n_msa} MSA, {len(feats)-n_msa} non-MSA), "
          f"{round(os.path.getsize(path)/1e6,2)} MB")


def main():
    xw = load_crosswalk()
    geom = load_geometry()
    print(f"crosswalk={len(xw)} counties  geometry={len(geom)} polygons")
    write(build(xw, geom, "v1", "v1n"), "cbsa_v1_2010.geojson")
    write(build(xw, geom, "v2", "v2n"), "cbsa_v2_2020.geojson")


if __name__ == "__main__":
    main()
