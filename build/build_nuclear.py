"""Classify DBpedia nuclear sites into operating / former and emit GeoJSON.

Classification is name-based because the DBpedia status codes are inconsistent
(blank for several plants that clearly operated, "O" for converted/duplicate
sites, etc.). We curate three sets:

  OPERATING  - currently generating commercial power (NRC operating fleet)
  FORMER     - commercial power reactors that operated and have shut down
  EXCLUDE    - never-built (cancelled/proposed/suspended), pure
               research/experimental/military/production reactors, and
               non-nuclear or duplicate sites.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ROOT, "data", "nuclear_dbp.json")
out = os.path.join(ROOT, "docs", "data", "nuclear.geojson")

with open(src, encoding="utf-8", errors="replace") as f:
    sites = json.load(f)

OPERATING = {
    "Callaway Nuclear Generating Station", "McGuire Nuclear Station",
    "Comanche Peak Nuclear Power Plant", "Braidwood Nuclear Generating Station",
    "Enrico Fermi Nuclear Generating Station", "Prairie Island Nuclear Power Plant",
    "R. E. Ginna Nuclear Power Plant", "St. Lucie Nuclear Power Plant",
    "South Texas Nuclear Generating Station", "H. B. Robinson Nuclear Generating Station",
    "Clinton Power Station", "Salem Nuclear Power Plant",
    "Millstone Nuclear Power Plant", "LaSalle County Nuclear Generating Station",
    "Susquehanna Steam Electric Station", "Wolf Creek Generating Station",
    "Oconee Nuclear Station", "Byron Nuclear Generating Station",
    "James A. FitzPatrick Nuclear Power Plant", "Davis�Besse Nuclear Power Station",
    "Watts Bar Nuclear Plant", "Donald C. Cook Nuclear Plant",
    "Perry Nuclear Generating Station", "Palo Verde Nuclear Generating Station",
    "Turkey Point Nuclear Generating Station", "Shearon Harris Nuclear Power Plant",
    "Quad Cities Nuclear Generating Station", "Nine Mile Point Nuclear Generating Station",
    "Vogtle Electric Generating Plant", "Edwin I. Hatch Nuclear Power Plant",
    "Grand Gulf Nuclear Station", "Brunswick Nuclear Generating Station",
    "Waterford Nuclear Generating Station", "North Anna Nuclear Generating Station",
    "Peach Bottom Nuclear Generating Station", "Seabrook Station Nuclear Power Plant",
    "Columbia Generating Station", "Beaver Valley Nuclear Power Station",
    "Cooper Nuclear Station", "Monticello Nuclear Generating Plant",
    "Hope Creek Nuclear Generating Station", "Limerick Generating Station",
    "Sequoyah Nuclear Plant", "Browns Ferry Nuclear Plant",
    "Arkansas Nuclear One", "River Bend Nuclear Generating Station",
    "Point Beach Nuclear Plant", "Dresden Generating Station",
    "Catawba Nuclear Station", "Joseph M. Farley Nuclear Plant",
    "Calvert Cliffs Nuclear Power Plant", "Surry Nuclear Power Plant",
    "Virgil C. Summer Nuclear Generating Station", "Diablo Canyon Power Plant",
}

FORMER = {
    "Zion Nuclear Power Station", "Rancho Seco Nuclear Generating Station",
    "Kewaunee Power Station", "La Crosse Boiling Water Reactor",
    "Humboldt Bay Nuclear Power Plant", "Crystal River Nuclear Plant",
    "Connecticut Yankee Nuclear Power Plant", "Maine Yankee Nuclear Power Plant",
    "Shippingport Atomic Power Station", "Shoreham Nuclear Power Plant",
    "Duane Arnold Energy Center", "Oyster Creek Nuclear Generating Station",
    "Fort Calhoun Nuclear Generating Station", "Pilgrim Nuclear Power Station",
    "Indian Point Energy Center", "San Onofre Nuclear Generating Station",
    "Vermont Yankee Nuclear Power Plant", "Three Mile Island Nuclear Generating Station",
    "Palisades Nuclear Generating Station", "Fermi 1", "Trojan Nuclear Power Plant",
    "Big Rock Point Nuclear Power Plant", "Elk River Station",
    "Yankee Rowe Nuclear Power Station", "Piqua Nuclear Generating Station",
    "Fort Saint Vrain Nuclear Power Plant", "Pathfinder Nuclear Generating Station",
}

# Everything else is excluded; we still list it explicitly so the script errors
# loudly if a new/unseen site appears in the source data.
EXCLUDE = {
    # research / experimental / military / production reactors
    "Sodium Reactor Experiment", "Experimental Breeder Reactor I",
    "Experimental Breeder Reactor II", "SL-1", "SM-1", "MH-1A",
    "Advanced Test Reactor", "Vallecitos Nuclear Center", "N-Reactor",
    "Carolinas�Virginia Tube Reactor", "Saxton Nuclear Generating Station",
    # cancelled / proposed / never completed
    "Bell Bend Nuclear Power Plant", "Victoria County Station",
    "Galena Nuclear Power Plant", "Sheldon Power Station",
    "Cherokee Nuclear Power Plant", "Atlantic Nuclear Power Plant",
    "Forked River Nuclear Power Plant", "Ravenswood Nuclear Power Plant",
    "Montague Nuclear Power Plant", "William States Lee III Nuclear Generating Station",
    "Douglas Point Nuclear Power Plant", "Black Fox Nuclear Power Plant",
    "Marble Hill Nuclear Power Plant", "Jamesport Nuclear Power Plant",
    "Bailly Nuclear Power Plant", "Haven Nuclear Power Plant",
    "Erie Nuclear Power Plant", "Greene County Nuclear Power Plant",
    "Yellow Creek Nuclear Plant", "Blue Hills Nuclear Power Plant",
    "Allens Creek Nuclear Power Plant", "Bellefonte Nuclear Plant",
    "Hartsville Nuclear Plant", "Sundesert Nuclear Power Plant",
    "Clinch River Breeder Reactor Project", "Bodega Bay Nuclear Power Plant",
    "WNP-3 and WNP-5", "Phipps Bend Nuclear Plant", "WNP-1 and WNP-4",
    "Levy County Nuclear Power Plant", "Blue Castle Project",
    "Washington Xe-100 reactor site",
    # non-nuclear, converted, or duplicate site entries
    "Midland Cogeneration Venture", "Kintigh Generating Station",
    "Alan R. Barton Plant", "William H. Zimmer Power Station",
    "Crystal River Energy Complex",
}

features, unclassified = [], []
n_op = n_former = 0
for s in sites:
    name = s["name"]
    if name in OPERATING:
        cat = "operating"; n_op += 1
    elif name in FORMER:
        cat = "former"; n_former += 1
    elif name in EXCLUDE:
        continue
    else:
        unclassified.append(name); continue
    props = {"name": name.replace("�", "-"), "category": cat}
    if cat == "former" and s.get("decom"):
        props["dissolved"] = s["decom"]
    features.append({
        "type": "Feature",
        "properties": props,
        "geometry": {"type": "Point", "coordinates": [s["lon"], s["lat"]]},
    })

if unclassified:
    print("UNCLASSIFIED (not in any set):", file=sys.stderr)
    for n in unclassified:
        print("  -", n, file=sys.stderr)
    sys.exit("Refusing to write output until every site is classified.")

gj = {"type": "FeatureCollection", "features": features}
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump(gj, f)

print(f"operating={n_op}  former={n_former}  total={len(features)}")
print("wrote", out)
