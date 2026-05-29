import urllib.request, urllib.parse, json, ssl
ctx=ssl.create_default_context()
q="""
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX dbp: <http://dbpedia.org/property/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX dbc: <http://dbpedia.org/resource/Category:>
PREFIX geo: <http://www.w3.org/2003/01/geo/wgs84_pos#>
SELECT DISTINCT ?p ?name ?lat ?long
  (GROUP_CONCAT(DISTINCT STR(?status);separator=" | ") AS ?statuses)
  (SAMPLE(?decom) AS ?decommissioned)
  (SAMPLE(?commis) AS ?commissioned) WHERE {
  ?p dct:subject ?c .
  ?c skos:broader* dbc:Nuclear_power_stations_in_the_United_States .
  ?p geo:lat ?lat ; geo:long ?long .
  OPTIONAL { ?p rdfs:label ?name . FILTER(lang(?name)="en") }
  OPTIONAL { ?p dbp:status ?status . }
  OPTIONAL { ?p dbp:decommissioned ?decom . }
  OPTIONAL { ?p dbp:commissioned ?commis . }
} GROUP BY ?p ?name ?lat ?long
"""
url="https://dbpedia.org/sparql?"+urllib.parse.urlencode({"query":q,"format":"application/sparql-results+json","timeout":"30000"})
req=urllib.request.Request(url, headers={"User-Agent":"EnergyCommMap/1.0","Accept":"application/sparql-results+json"})
d=json.load(urllib.request.urlopen(req,context=ctx,timeout=90))
rows=d["results"]["bindings"]
sites={}
for r in rows:
    uri=r["p"]["value"]; name=r.get("name",{}).get("value", uri.split("/")[-1].replace("_"," "))
    lat=float(r["lat"]["value"]); lon=float(r["long"]["value"])
    if not(15<lat<72 and -180<lon<-60): continue
    sites[uri]={"name":name,"lat":round(lat,4),"lon":round(lon,4),
                "status":r.get("statuses",{}).get("value",""),
                "decom":r.get("decommissioned",{}).get("value",""),
                "comm":r.get("commissioned",{}).get("value","")}
json.dump(list(sites.values()), open("data/nuclear_dbp.json","w"), indent=1, ensure_ascii=False)
print("US sites:",len(sites))
for s in sorted(sites.values(), key=lambda x:x["name"]):
    print(f"{s['name'][:42]:42s} | status={s['status'][:40]:40s} | decom={s['decom'][:10]} comm={s['comm'][:10]}")
