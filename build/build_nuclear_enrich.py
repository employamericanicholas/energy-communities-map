"""Enrich docs/data/nuclear.geojson with site owner and energy-community
eligibility flags for each plant location.

Owner comes from DBpedia (dbp:owner, falling back to dbp:operator); a few
historic sites DBpedia lacks are filled from a curated map.

Eligibility is computed by point-in-polygon of each plant against the
eligibility layers:
  ffe        - plant's county meets the Fossil Fuel Employment threshold
               (county is in the FFE list, i.e. `do` OR `may`)
  ffe_unemp  - plant's county is a currently-qualifying FFE energy community
               (`do`: meets FFE threshold AND the unemployment requirement)
  coal       - plant lies in a coal closure census tract
"""
import json, os, urllib.parse
from shapely.geometry import shape, Point
from shapely import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "docs", "data")

# Site/owner for plants DBpedia did not return (historic reactors).
MANUAL_OWNER = {
    "Big Rock Point Nuclear Power Plant": "Consumers Energy",
    "Elk River Station": "Rural Cooperative Power Association",
    "Fort Saint Vrain Nuclear Power Plant": "Xcel Energy (Public Service Co. of Colorado)",
    "Piqua Nuclear Generating Station": "City of Piqua, Ohio",
    "Yankee Rowe Nuclear Power Station": "Yankee Atomic Electric Company",
}

# Primary owner overrides where DBpedia's first listed value is a minor
# co-owner, a location, or a malformed per-unit string.
OWNER_OVERRIDE = {
    "South Texas Nuclear Generating Station": "NRG Energy",
    "Vogtle Electric Generating Plant": "Georgia Power (Southern Company)",
    "Edwin I. Hatch Nuclear Power Plant": "Georgia Power (Southern Company)",
    "Oyster Creek Nuclear Generating Station": "Holtec International",
    "Rancho Seco Nuclear Generating Station": "Sacramento Municipal Utility District (SMUD)",
    "Peach Bottom Nuclear Generating Station": "Constellation Energy",
    "Three Mile Island Nuclear Generating Station": "Constellation Energy",
}


def clean(val):
    """Take first value from a ' | '-joined DBpedia field; strip URI prefix."""
    if not val:
        return ""
    first = val.split(" | ")[0].strip()
    if first.startswith("http://dbpedia.org/resource/"):
        first = urllib.parse.unquote(first.rsplit("/", 1)[-1]).replace("_", " ")
    return first.strip()


def norm(s):
    return s.replace("–", "-").replace("—", "-")


def owner_for(name, owners):
    if name in OWNER_OVERRIDE:
        return OWNER_OVERRIDE[name]
    rec = owners.get(name)
    if rec is None:
        for k, v in owners.items():
            if norm(k) == norm(name):
                rec = v
                break
    if rec:
        o = clean(rec.get("owners", "")) or clean(rec.get("operators", ""))
        if o:
            return o
    return MANUAL_OWNER.get(name, "Unknown")


def index_layer(path):
    feats = json.load(open(path))["features"]
    geoms = [shape(f["geometry"]) for f in feats]
    return STRtree(geoms), geoms, feats


def locate(pt, tree, geoms, feats):
    for i in tree.query(pt):
        if geoms[i].contains(pt):
            return feats[i]["properties"]
    return None


def nearest(pt, tree, geoms, feats):
    """Containing polygon, else closest one (for coastal points in water)."""
    hit = locate(pt, tree, geoms, feats)
    if hit:
        return hit
    i = min(range(len(geoms)), key=lambda j: geoms[j].distance(pt))
    return feats[i]["properties"]


def main():
    owners = json.load(open(os.path.join(ROOT, "data", "nuclear_owners_dbp.json")))
    ffe = index_layer(os.path.join(D, "ffe_counties.geojson"))
    coal = index_layer(os.path.join(D, "coal_tracts.geojson"))
    cty = index_layer(os.path.join(D, "counties.geojson"))

    gj = json.load(open(os.path.join(D, "nuclear.geojson")))
    n_ffe = n_un = n_coal = 0
    for f in gj["features"]:
        p = f["properties"]
        lon, lat = f["geometry"]["coordinates"]
        pt = Point(lon, lat)
        p["owner"] = owner_for(p["name"], owners)
        cc = nearest(pt, *cty)
        p["county"] = cc.get("NAMELSAD", "")
        p["state"] = cc.get("STATE_NAME", "")
        fc = locate(pt, *ffe)
        p["ffe"] = bool(fc and (fc.get("do") or fc.get("may")))
        p["ffe_unemp"] = bool(fc and fc.get("do"))
        p["coal"] = locate(pt, *coal) is not None
        n_ffe += p["ffe"]; n_un += p["ffe_unemp"]; n_coal += p["coal"]

    with open(os.path.join(D, "nuclear.geojson"), "w") as f:
        json.dump(gj, f)
    print(f"plants={len(gj['features'])}  ffe={n_ffe}  ffe_unemp={n_un}  coal={n_coal}")
    unknown = [f["properties"]["name"] for f in gj["features"] if f["properties"]["owner"] == "Unknown"]
    if unknown:
        print("owner still Unknown:", unknown)


if __name__ == "__main__":
    main()
