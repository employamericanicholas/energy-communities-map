"""Add two new sites and tag a curated "featured" watchlist on
docs/data/nuclear.geojson.

New sites (category "advanced" = prospective / new-reactor candidate sites):
  Rockport Plant (AEP) - large coal site, Spencer County IN; coal-to-nuclear
    candidate. Coordinates are the actual plant location.
  Stewart County Site (Southern Company) - prospective greenfield site in
    Stewart County GA. No precise location published, so placed at the county
    representative point (point-in-polygon still resolves the correct county).

featured=True marks the watchlist; featured_name overrides the display label
in the plant table's "Featured" view (e.g. Salem represents Salem/Hope Creek).
Idempotent. Run build_nuclear_enrich.py afterward to fill owner/county/
state/eligibility (owners curated there in OWNER_OVERRIDE).
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(ROOT, "docs", "data", "nuclear.geojson")

# (name, category, status, lon, lat)
NEW_SITES = [
    ("Rockport Plant", "advanced", "Prospective site - AEP Rockport (coal)", -87.0342, 37.9264),
    ("Stewart County Site", "advanced", "Prospective site - Southern Company", -84.8471, 32.0750),
]

# name in data -> featured display label (None = keep the real name)
FEATURED = {
    "Virgil C. Summer Nuclear Generating Station": "V.C. Summer (SC)",
    "Nine Mile Point Nuclear Generating Station": "Nine Mile Point (NY)",
    "Salem Nuclear Power Plant": "Salem / Hope Creek (NJ)",
    "William States Lee III": "W.S. Lee III (Duke site)",
    "Kewaunee Power Station": "Kewaunee (WI)",
    "River Bend Nuclear Generating Station": "River Bend (Entergy)",
    "Enrico Fermi Nuclear Generating Station": "Fermi 2 (DTE)",
    "Comanche Peak Nuclear Power Plant": "Comanche Peak (Vistra)",
    "Rockport Plant": "Rockport (AEP)",
    "Stewart County Site": "Stewart County (Southern)",
}


def main():
    gj = json.load(open(GEO))
    have = {f["properties"]["name"] for f in gj["features"]}
    added = 0
    for name, cat, status, lon, lat in NEW_SITES:
        if name in have:
            continue
        gj["features"].append({
            "type": "Feature",
            "properties": {"name": name, "category": cat, "status": status},
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
        })
        added += 1

    tagged = 0
    for f in gj["features"]:
        p = f["properties"]
        if p["name"] in FEATURED:
            p["featured"] = True
            label = FEATURED[p["name"]]
            if label:
                p["featured_name"] = label
            tagged += 1
        else:
            p.pop("featured", None)
            p.pop("featured_name", None)

    json.dump(gj, open(GEO, "w"))
    print(f"added={added}  featured tagged={tagged}  total={len(gj['features'])}")
    missing = [n for n in FEATURED if n not in {f['properties']['name'] for f in gj['features']}]
    if missing:
        print("WARNING featured names not found:", missing)


if __name__ == "__main__":
    main()
