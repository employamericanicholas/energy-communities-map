import json
# FFE county layer with per-notice qualifying flags. The "may" set (counties
# meeting the FFE threshold) is the shared threshold universe; "do" (currently
# qualifying = threshold + unemployment) differs by notice vintage.
counties=json.load(open("docs/data/counties.geojson"))
do25=json.load(open("data/ffe_do_2531.json"))
do26=json.load(open("data/ffe_do_2639.json"))
may=json.load(open("data/ffe_may.json"))
feats=[]
m25=m26=mmay=0
for ft in counties["features"]:
    g=ft["properties"]["GEOID"]
    in25=g in do25; in26=g in do26; in_may=g in may
    if not (in25 or in26 or in_may): continue
    p={"GEOID":g,"name":ft["properties"]["NAMELSAD"],"state":ft["properties"]["STATE_NAME"]}
    p["do_2531"]=in25; p["v1_2531"]=do25.get(g,{}).get("v1",False); p["v2_2531"]=do25.get(g,{}).get("v2",False)
    p["do_2639"]=in26; p["v1_2639"]=do26.get(g,{}).get("v1",False); p["v2_2639"]=do26.get(g,{}).get("v2",False)
    p["may"]=in_may
    m25+=in25; m26+=in26; mmay+=in_may
    feats.append({"type":"Feature","properties":p,"geometry":ft["geometry"]})
json.dump({"type":"FeatureCollection","features":feats}, open("docs/data/ffe_counties.geojson","w"))
print("FFE features:",len(feats)," do_2531:",m25," do_2639:",m26," may(threshold):",mmay)
print("DO 2531 matched %d/%d"%(m25,len(do25)))
print("DO 2639 matched %d/%d"%(m26,len(do26)))
