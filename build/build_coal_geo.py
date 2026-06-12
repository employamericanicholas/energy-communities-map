"""Append IRS Notice 2026-39 Appendix 2 coal closure tracts to the existing
docs/data/coal_tracts.geojson, preserving all existing features.

Geometry comes from the Census 2020 cartographic tract shapefiles already in
build/src_shp/tracts. Matches the existing property schema (GEOID, tract,
type, detail) and 4-decimal coordinate precision. Idempotent: tracts already
present in the geojson are skipped, so this only adds the new 2026-39 tracts.
"""
import json, os, shapefile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(ROOT, "docs", "data", "coal_tracts.geojson")
SHP = os.path.join(ROOT, "build", "src_shp", "tracts")
PREC = 4


def rnd(x):
    if isinstance(x, (list, tuple)):
        return [rnd(v) for v in x]
    return round(x, PREC)


def type_label(types):
    j = " ".join(types).lower()
    mine = "mine closure" in j
    unit = "generating unit retirement" in j
    if mine and unit:
        return "Mine closure + generating unit retirement"
    if mine:
        return "Coal mine closure"
    if unit:
        return "Coal-fired unit retirement"
    return "Directly adjoining"


def main():
    gj = json.load(open(GEO))
    have = {f["properties"]["GEOID"] for f in gj["features"]}
    ct = json.load(open(os.path.join(ROOT, "data", "coal_tracts.json")))
    # New tracts from the 2026-39 notice that still lack geometry.
    want = {g: v for g, v in ct.items()
            if g not in have and any("2026-39" in s for s in v["src"])}
    by_state = {}
    for g in want:
        by_state.setdefault(g[:2], set()).add(g)

    added, missing = 0, []
    for st, geoids in sorted(by_state.items()):
        path = os.path.join(SHP, f"cb_2020_{st}_tract_500k.shp")
        if not os.path.exists(path):
            missing += sorted(geoids); continue
        found = set()
        sf = shapefile.Reader(path)
        for sr in sf.shapeRecords():
            g = sr.record["GEOID"]
            if g not in geoids:
                continue
            types = ct[g]["types"]
            gj["features"].append({
                "type": "Feature",
                "properties": {
                    "GEOID": g,
                    "tract": sr.record["NAMELSAD"],
                    "type": type_label(types),
                    "detail": ", ".join(sorted(types)),
                },
                "geometry": {
                    "type": sr.shape.__geo_interface__["type"],
                    "coordinates": rnd(sr.shape.__geo_interface__["coordinates"]),
                },
            })
            found.add(g); added += 1
        sf.close()
        missing += sorted(geoids - found)

    # Tag every tract with the notice that first listed it, so the app can
    # show the 2025-31 vs 2026-39 coal footprint. The 54 tracts new in
    # Notice 2026-39 have src "2026-39_App2" (and no earlier source).
    n26 = 0
    for f in gj["features"]:
        src = ct.get(f["properties"]["GEOID"], {}).get("src", [])
        f["properties"]["since"] = "2026-39" if any("2026-39" in s for s in src) else "2025-31"
        n26 += f["properties"]["since"] == "2026-39"

    json.dump(gj, open(GEO, "w"))
    print(f"added={added}  total_features={len(gj['features'])}  since_2026-39={n26}  unmatched={len(missing)} {missing}")


if __name__ == "__main__":
    main()
