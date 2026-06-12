"""Add Fervo Energy geothermal sites (category "fervo") to nuclear.geojson.

Sourced from Fervo Energy's Form S-1 (filed 2026-04-17, SEC EDGAR
CIK 1853868). The S-1 gives specific locations for three sites:
  - Cape Station: GeoCluster in Beaver County near Milford, Utah
    (~500 MW under construction; flagship).
  - Project Red: commercial pilot adjacent to the Blue Mountain geothermal
    field near Winnemucca, Humboldt County, Nevada (3 MW, operating).
  - A PPA-associated geothermal project in Churchill County, Nevada
    (unnamed in the filing; placed at the county representative point).
The remainder of Fervo's portfolio (~596k leased acres across ten
early-stage GeoClusters in UT/NV) is not individually located in the S-1.

Run build_nuclear_enrich.py afterward to fill owner/county/state/eligibility
(owner curated there in OWNER_OVERRIDE). Idempotent.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(ROOT, "docs", "data", "nuclear.geojson")

# (name, status, lon, lat)
SITES = [
    ("Cape Station", "Geothermal EGS - under construction (~500 MW), Milford UT", -112.90, 38.50),
    ("Project Red", "Geothermal EGS pilot - operating (3 MW), Blue Mountain NV", -118.05, 40.94),
    ("Fervo Churchill County Project", "Geothermal EGS - PPA facility, Churchill County NV", -118.29, 39.5479),
]


def main():
    gj = json.load(open(GEO))
    have = {f["properties"]["name"] for f in gj["features"]}
    added = 0
    for name, status, lon, lat in SITES:
        if name in have:
            continue
        gj["features"].append({
            "type": "Feature",
            "properties": {"name": name, "category": "fervo", "status": status, "operator": "Fervo Energy"},
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
        })
        added += 1
    json.dump(gj, open(GEO, "w"))
    print(f"added={added}  total={len(gj['features'])}  fervo={sum(1 for f in gj['features'] if f['properties'].get('category')=='fervo')}")


if __name__ == "__main__":
    main()
