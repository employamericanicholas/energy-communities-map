import json, urllib.request, os, ssl
ctx=ssl.create_default_context()
coal=json.load(open("data/coal_tracts.json"))
states=sorted(set(g[:2] for g in coal))
print("states:",states, len(states))
DST="build/src_shp/tracts"; os.makedirs(DST, exist_ok=True)
ok=0; fail=[]
for st in states:
    name=f"cb_2020_{st}_tract_500k.zip"
    url=f"https://www2.census.gov/geo/tiger/GENZ2020/shp/{name}"
    dst=os.path.join(DST,name)
    if os.path.exists(dst) and os.path.getsize(dst)>2000:
        ok+=1; continue
    try:
        req=urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req,context=ctx,timeout=120) as r, open(dst,"wb") as f:
            f.write(r.read())
        ok+=1
    except Exception as e:
        fail.append((st,repr(e)))
print("downloaded ok:",ok,"failed:",fail)
