"""Tag sites whose mapped coordinate is approximate (not a surveyed point)
with a loc_note shown in the map popup. Idempotent; safe to re-run.

Two kinds of uncertainty:
  - county-centroid placements where no precise site is published
  - approximate area coordinates / secondary-source coordinates
Sites with precise coordinates (operating/former reactors, Wikipedia-infobox
NRC greenfield sites, the actual Rockport plant location) get no note.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(ROOT, "docs", "data", "nuclear.geojson")

NOTES = {
    "Stewart County Site":
        "Approximate — no precise site location has been published; mapped to the Stewart County, GA centroid.",
    "Fervo Churchill County Project":
        "Approximate — the S-1 gives only the county; mapped to the Churchill County, NV centroid.",
    "Cape Station":
        "Approximate — mapped near Milford, UT; the project footprint is not surveyed here.",
    "Project Red":
        "Approximate — mapped to the Blue Mountain geothermal field area near Winnemucca, NV.",
    "X-energy / Dow - Long Mott (Seadrift)":
        "Approximate — coordinate from Global Energy Monitor, not an official NRC filing.",
}


def main():
    gj = json.load(open(GEO))
    tagged = 0
    for f in gj["features"]:
        p = f["properties"]
        if p["name"] in NOTES:
            p["loc_note"] = NOTES[p["name"]]
            tagged += 1
        else:
            p.pop("loc_note", None)
    json.dump(gj, open(GEO, "w"))
    print(f"loc_note tagged={tagged}  total={len(gj['features'])}")
    missing = [n for n in NOTES if n not in {f['properties']['name'] for f in gj['features']}]
    if missing:
        print("WARNING names not found:", missing)


if __name__ == "__main__":
    main()
