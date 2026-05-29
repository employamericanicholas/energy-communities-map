import urllib.request, ssl, re, json
ctx=ssl.create_default_context()
def get(url):
    req=urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0 (research; nicholas@employamerica.org)"})
    return urllib.request.urlopen(req,context=ctx,timeout=60).read().decode("utf-8","replace")
urls={
 "operating":"https://www.nrc.gov/reactors/operating/list-power-reactor-units.html",
 "decom":"https://www.nrc.gov/info-finder/decommissioning/power-reactor/",
}
for k,u in urls.items():
    try:
        html=get(u)
        open(f"build/nrc_{k}.html","w",encoding="utf-8").write(html)
        # crude: pull anchor texts and table cell texts
        names=re.findall(r'>([A-Z][A-Za-z .\-&/]+?(?:Nuclear|Power|Station|Plant|Generating|Yankee|Energy Center|Point|Creek|Bar|Ferry|Cliffs|Canyon|Anna|Mile|Bottom|Seco|Onofre|Island|Valley|Rock|Bend|Run)[A-Za-z0-9 .\-&/,]*?)<', html)
        uniq=sorted(set(n.strip() for n in names if len(n.strip())>5))
        print(f"\n==== {k}: {len(uniq)} candidate names ====")
        for n in uniq: print(n)
    except Exception as e:
        print(k,"FAIL",repr(e))
