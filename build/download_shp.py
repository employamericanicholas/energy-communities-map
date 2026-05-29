import urllib.request, os, ssl
ctx=ssl.create_default_context()
DST="build/src_shp"
files={
 "cb_2020_us_county_500k.zip":"https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_county_500k.zip",
 "cb_2020_us_cbsa_500k.zip":"https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_cbsa_500k.zip",
 "cb_2023_us_cbsa_500k.zip":"https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_cbsa_500k.zip",
 "cb_2020_us_state_500k.zip":"https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_state_500k.zip",
}
for name,url in files.items():
    dst=os.path.join(DST,name)
    if os.path.exists(dst) and os.path.getsize(dst)>5000:
        print("skip",name,os.path.getsize(dst)); continue
    try:
        req=urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req,context=ctx,timeout=120) as r, open(dst,"wb") as f:
            f.write(r.read())
        print("OK",name,os.path.getsize(dst))
    except Exception as e:
        print("FAIL",name,repr(e))
