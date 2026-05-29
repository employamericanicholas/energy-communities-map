import json
counties=json.load(open("docs/data/counties.geojson"))
do=json.load(open("data/ffe_do.json"))
may=json.load(open("data/ffe_may.json"))
feats=[]
matched_do=set(); matched_may=set()
for ft in counties["features"]:
    g=ft["properties"]["GEOID"]
    in_do=g in do; in_may=g in may
    if not (in_do or in_may): continue
    p={"GEOID":g,"name":ft["properties"]["NAMELSAD"],"state":ft["properties"]["STATE_NAME"]}
    if in_do:
        p["do"]=True; p["v1"]=do[g]["v1"]; p["v2"]=do[g]["v2"]; matched_do.add(g)
    else:
        p["do"]=False
    p["may"]=in_may
    if in_may: matched_may.add(g)
    feats.append({"type":"Feature","properties":p,"geometry":ft["geometry"]})
json.dump({"type":"FeatureCollection","features":feats}, open("docs/data/ffe_counties.geojson","w"))
print("FFE features:",len(feats))
print("DO matched %d/%d  missing:%s"%(len(matched_do),len(do),sorted(set(do)-matched_do)))
print("MAY matched %d/%d  missing:%s"%(len(matched_may),len(may),sorted(set(may)-matched_may)))
