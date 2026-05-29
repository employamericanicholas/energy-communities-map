import urllib.request, urllib.parse, json, ssl, time, re, sys
ctx=ssl.create_default_context()
q="""
SELECT ?item ?itemLabel ?coord ?dissolved ?statusLabel ?adminLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:Q134447 .
  ?item wdt:P17 wd:Q30 .
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P576 ?dissolved. }
  OPTIONAL { ?item wdt:P5817 ?status. }
  OPTIONAL { ?item wdt:P131 ?admin. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
"""
url="https://query.wikidata.org/sparql?"+urllib.parse.urlencode({"query":q,"format":"json"})
data=None
for attempt in range(8):
    try:
        req=urllib.request.Request(url, headers={"User-Agent":"EnergyCommunitiesMap/1.0 (nicholas@employamerica.org) research","Accept":"application/sparql-results+json"})
        data=json.load(urllib.request.urlopen(req,context=ctx,timeout=120)); break
    except Exception as e:
        print(f"attempt {attempt} failed: {e}", flush=True); time.sleep(65)
if not data:
    print("ALL ATTEMPTS FAILED"); sys.exit(2)
rows=data["results"]["bindings"]; seen={}
for r in rows:
    qid=r["item"]["value"].split("/")[-1]; name=r["itemLabel"]["value"]
    m=re.match(r"Point\(([-0-9.]+) ([-0-9.]+)\)", r["coord"]["value"])
    if not m: continue
    lon=float(m.group(1)); lat=float(m.group(2))
    e=seen.setdefault(qid,{"name":name,"lat":lat,"lon":lon,"dissolved":r.get("dissolved",{}).get("value"),"status":r.get("statusLabel",{}).get("value",""),"admin":r.get("adminLabel",{}).get("value","")})
def classify(e):
    s=(e["status"] or "").lower()
    if e["dissolved"]: return "former"
    if any(w in s for w in["decommission","former","closed","shut","disused","destroyed","cancel"]): return "former"
    if any(w in s for w in["construction","planned","proposed"]): return "planned"
    return "operating"
out=[{"qid":k,**v,"category":classify(v)} for k,v in seen.items()]
json.dump(out, open("data/nuclear_raw.json","w"), indent=1)
from collections import Counter
print("unique sites:",len(out), Counter(o["category"] for o in out), flush=True)
