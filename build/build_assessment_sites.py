"""Build docs/data/assessment_sites.geojson from the Employ America
"Site Assessment By Company" workbook (Potential Sites + Potential Firms).

Each site is a company project at a named county. Because energy-community
eligibility is determined at the county / MSA-non-MSA level, every site is
mapped at its county centroid (representative point); the exact plant point
does not change eligibility. Sites sharing a county get a small deterministic
offset so they don't fully overlap.

Properties per feature: name (site), owner (company), etype (Nuclear/
Geothermal/Storage/CCS), status (=etype), county, state, GEOID, loc_note,
and IRS eligibility per notice (ffe, ffe_unemp_2531/2639, coal_2531/2639)
computed by point-in-polygon against the same layers the rest of the app uses.
"""
import json, os, math, re
import openpyxl
from shapely.geometry import shape, Point
from shapely import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "docs", "data")
XLSX = os.path.join(ROOT, "build", "site_assessment.xlsx")

# County strings in the workbook that aren't "<Name> County, ST".
COUNTY_FIX = {
    "Southeastern Connecticut": ("New London County", "CT"),
    "Southeastern Connecticut Planning Region, CT": ("New London County", "CT"),
}


def etype_of(source):
    s = (source or "").lower()
    if "geotherm" in s: return "Geothermal"
    if "nuclear" in s: return "Nuclear"
    if "ccs" in s: return "CCS"
    if "storage" in s: return "Storage"
    return "Other"


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    firm_src = {}
    for r in list(wb["Potential Firms"].iter_rows(values_only=True))[1:]:
        if r[0] and r[1]:
            firm_src[str(r[0]).strip()] = str(r[1]).strip()

    def company_etype(comp):
        if comp in firm_src:
            return etype_of(firm_src[comp])
        for k, v in firm_src.items():            # loose match across sheet naming
            if k.lower() in comp.lower() or comp.lower() in k.lower():
                return etype_of(v)
        return "Other"

    def site_etype(comp, site):
        # Several firms are mixed (e.g. "Nuclear / Storage"); classify the
        # site by name first so pumped-storage and CCS projects aren't mislabeled.
        s = (site or "").lower()
        if "ccs" in s: return "CCS"
        if "pumped" in s or "storage" in s: return "Storage"
        return company_etype(comp)

    sites = []
    for r in list(wb["Potential Sites"].iter_rows(values_only=True))[2:]:
        if not (r[1] or r[2]):
            continue
        comp = str(r[0]).strip() if r[0] else ""
        cty = str(r[1]).strip() if r[1] else ""
        site = str(r[2]).strip() if r[2] else ""
        sites.append((comp, cty, site))

    # County lookup: (NAMELSAD lower, STUSPS) -> (repr point, GEOID, STATE_NAME)
    counties = json.load(open(os.path.join(D, "counties.geojson")))
    cidx = {}
    for f in counties["features"]:
        p = f["properties"]
        rp = shape(f["geometry"]).representative_point()
        cidx[(p["NAMELSAD"].lower(), p["STUSPS"])] = (round(rp.x, 4), round(rp.y, 4), p["GEOID"], p["STATE_NAME"])

    def resolve(cty):
        if cty in COUNTY_FIX:
            name, st = COUNTY_FIX[cty]
        elif "," in cty:
            left, st = cty.rsplit(",", 1)
            st = st.strip()
            name = left.strip()
        else:
            return None
        if not name.lower().endswith("county"):
            name2 = name + " County"
        else:
            name2 = name
        for key in [(name.lower(), st), (name2.lower(), st)]:
            if key in cidx:
                return cidx[key]
        return None

    feats, unresolved, per_county = [], [], {}
    for comp, cty, site in sites:
        loc = resolve(cty)
        if not loc:
            unresolved.append((comp, cty, site)); continue
        lon, lat, geoid, state = loc
        n = per_county.get(geoid, 0); per_county[geoid] = n + 1
        if n:                                     # offset duplicates on a small ring
            ang = n * 2.399963       # golden angle
            lon += 0.06 * math.cos(ang); lat += 0.06 * math.sin(ang)
        name = site if site and site != "(Greenfield)" else f"{comp} (greenfield)"
        et = site_etype(comp, site)
        feats.append({
            "type": "Feature",
            "properties": {
                "name": name, "owner": comp, "etype": et,
                "status": et, "county": None, "state": state,
                "GEOID": geoid, "site_county": cty,
                "loc_note": "Mapped at the county centroid — energy-community eligibility is determined at the county / MSA level, not the exact site point.",
            },
            "geometry": {"type": "Point", "coordinates": [round(lon, 4), round(lat, 4)]},
        })

    # ---- IRS eligibility by point-in-polygon (same layers as the app) ----
    def index_layer(path):
        fs = json.load(open(path))["features"]
        geoms = [shape(f["geometry"]) for f in fs]
        return STRtree(geoms), geoms, fs

    def locate(pt, tree, geoms, fs):
        for i in tree.query(pt):
            if geoms[i].contains(pt):
                return fs[i]["properties"]
        return None

    ffe = index_layer(os.path.join(D, "ffe_counties.geojson"))
    coal = index_layer(os.path.join(D, "coal_tracts.geojson"))
    cty_layer = index_layer(os.path.join(D, "counties.geojson"))
    for f in feats:
        pt = Point(*f["geometry"]["coordinates"])
        cc = locate(pt, *cty_layer)
        f["properties"]["county"] = cc.get("NAMELSAD", "") if cc else ""
        fc = locate(pt, *ffe)
        f["properties"]["ffe"] = bool(fc and (fc.get("do_2531") or fc.get("do_2639") or fc.get("may")))
        f["properties"]["ffe_unemp_2531"] = bool(fc and fc.get("do_2531"))
        f["properties"]["ffe_unemp_2639"] = bool(fc and fc.get("do_2639"))
        ct = locate(pt, *coal)
        f["properties"]["coal_2639"] = ct is not None
        f["properties"]["coal_2531"] = bool(ct and ct.get("since") != "2026-39")

    json.dump({"type": "FeatureCollection", "features": feats},
              open(os.path.join(D, "assessment_sites.geojson"), "w"))
    from collections import Counter
    print(f"assessment sites: {len(feats)}  (unresolved: {len(unresolved)})")
    print("by type:", dict(Counter(f["properties"]["etype"] for f in feats)))
    print("qualify 2639 (ffe+unemp):", sum(f["properties"]["ffe_unemp_2639"] for f in feats),
          " coal 2639:", sum(f["properties"]["coal_2639"] for f in feats))
    if unresolved:
        print("UNRESOLVED:", unresolved)


if __name__ == "__main__":
    main()
