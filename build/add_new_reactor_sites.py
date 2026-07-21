"""Append NRC new-reactor licensing sites to docs/data/nuclear.geojson.

Two new categories beyond operating/former power reactors:
  esp_col   - sites with an NRC Early Site Permit (ESP) and/or a Combined
              License (COL), whether active, abandoned, or terminated.
  advanced  - advanced-reactor demonstration sites (TerraPower Natrium,
              X-energy/Dow Xe-100) with NRC construction permits/applications.

Sites co-located at an existing operating plant reuse that plant's
coordinates; greenfield/standalone sites use coordinates from Wikipedia
infoboxes (Clinch River, Levy County, William States Lee III, Kemmerer/
Natrium) or Global Energy Monitor (Long Mott / Dow Seadrift).

Owners for these sites are curated in build_nuclear_enrich.py (OWNER_OVERRIDE).
This script only adds geometry + name/category/status; run
build_nuclear_enrich.py afterward to fill owner/county/state/eligibility.

Idempotent: re-running skips sites already present by name.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(ROOT, "docs", "data", "nuclear.geojson")

# (name, category, status, lon, lat)
SITES = [
    # --- Early Site Permits (6 issued) ---
    ("Clinton ESP", "esp_col", "ESP (2007)", -88.8350, 40.1722),
    ("Grand Gulf ESP", "esp_col", "ESP (2007)", -91.0478, 32.0072),
    ("PSEG Site (ESP)", "esp_col", "ESP (2016)", -75.5381, 39.4678),
    ("Clinch River Nuclear Site", "esp_col", "ESP (2019, SMR)", -84.3825, 35.8900),
    # ESP + COL at the same site (combined entries) ---
    ("North Anna Unit 3", "esp_col", "ESP (2007) + COL (2017)", -77.7894, 38.0606),
    ("Vogtle Units 3 & 4", "esp_col", "ESP (2009) + COL (2012) - operating", -81.7606, 33.1433),
    # --- Combined Licenses (issued) ---
    ("V.C. Summer Units 2 & 3", "esp_col", "COL (2012) - abandoned", -81.3147, 34.2986),
    ("Levy County Units 1 & 2", "esp_col", "COL (2016) - abandoned", -82.6217, 29.0733),
    ("William States Lee III", "esp_col", "COL (2016) - cancelled", -81.51111, 35.03333),
    ("Turkey Point Units 6 & 7", "esp_col", "COL (2018) - active, unbuilt", -80.3306, 25.4342),
    ("Fermi Unit 3", "esp_col", "COL (2015) - active, unbuilt", -83.2575, 41.9628),
    ("South Texas Project Units 3 & 4", "esp_col", "COL (2016) - terminated", -96.0489, 28.7956),
    # --- Advanced reactor demonstration sites ---
    ("TerraPower Natrium (Kemmerer Unit 1)", "advanced", "Construction permit (2026)", -110.56056, 41.70583),
    ("X-energy / Dow - Long Mott (Seadrift)", "advanced", "CP application (2025)", -96.7745, 28.5033),
    # Prospective advanced-reactor site; coordinates provided directly.
    ("Elementl Power Ohio Project", "advanced", "Prospective advanced-reactor site", -81.91597, 38.89858),
]


def main():
    gj = json.load(open(GEO))
    have = {f["properties"]["name"] for f in gj["features"]}
    added = 0
    for name, cat, status, lon, lat in SITES:
        if name in have:
            continue
        gj["features"].append({
            "type": "Feature",
            "properties": {"name": name, "category": cat, "status": status},
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
        })
        added += 1
    with open(GEO, "w") as f:
        json.dump(gj, f)
    print(f"added={added}  total={len(gj['features'])}")


if __name__ == "__main__":
    main()
