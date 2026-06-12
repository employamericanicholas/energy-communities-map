/* U.S. Energy Communities Map */
"use strict";

const map = L.map("map", { preferCanvas: true, minZoom: 3, maxZoom: 12 })
  .setView([39.5, -98.5], 4);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> | Boundaries: U.S. Census Bureau | Eligibility: IRS Notice 2026-39 / 2025-31',
  subdomains: "abcd", maxZoom: 19,
}).addTo(map);

const COAL_COLORS = {
  "Coal mine closure": "#7a2d12",
  "Coal-fired unit retirement": "#c0532b",
  "Mine closure + generating unit retirement": "#5a1f0c",
  "Directly adjoining": "#e3a07f",
};

const hover = document.getElementById("hoverinfo");
function showHover(html) { hover.innerHTML = html; hover.style.display = "block"; }
function hideHover() { hover.style.display = "none"; }

const loading = document.createElement("div");
loading.id = "loading"; loading.textContent = "Loading…";
document.body.appendChild(loading);
let pending = 0;
function load(on) { pending += on ? 1 : -1; loading.style.display = pending > 0 ? "block" : "none"; }

/* Lazy GeoJSON layer: fetches data on first activation, caches it. */
function lazyLayer(url, makeLayer) {
  let layer = null, loadingPromise = null;
  return {
    async show() {
      if (!layer) {
        if (!loadingPromise) {
          load(true);
          loadingPromise = fetch(url)
            .then((r) => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); })
            .then((gj) => { layer = makeLayer(gj); return gj; })
            .catch((e) => { console.error(e); alert("Could not load " + url + "\n" + e.message); })
            .finally(() => load(false));
        }
        await loadingPromise;
      }
      if (layer && !map.hasLayer(layer)) layer.addTo(map);
    },
    hide() { if (layer && map.hasLayer(layer)) map.removeLayer(layer); },
    getLayer() { return layer; },
  };
}

function setCount(id, n) {
  const el = document.getElementById(id);
  if (el) el.textContent = "(" + n.toLocaleString() + ")";
}

/* ---------- IRS notice version (eligibility-data vintage) ----------
   "2639" = Notice 2026-39 (June 2026, 2025 unemployment); "2531" = Notice
   2025-31 (June 2025, 2024 unemployment). Switching re-renders every
   eligibility layer. The diff layer highlights what changed between them. */
let notice = "2639";
const NOTICE_LABEL = { "2531": "Notice 2025-31", "2639": "Notice 2026-39" };

/* Version-aware layer: caches its GeoJSON, (re)builds with the current
   notice, and rebuilds in place when the notice changes. */
function versioned(loader, build) {
  return {
    layer: null, data: null,
    async show() {
      const gj = await loader();
      if (!gj) return;
      this.data = gj;
      if (!this.layer) this.layer = build(gj);
      if (!map.hasLayer(this.layer)) this.layer.addTo(map);
    },
    hide() { if (this.layer && map.hasLayer(this.layer)) map.removeLayer(this.layer); },
    refresh() {
      if (!this.data) return;
      const vis = this.layer && map.hasLayer(this.layer);
      if (vis) map.removeLayer(this.layer);
      this.layer = build(this.data);
      if (vis) this.layer.addTo(map);
    },
  };
}

function cachedFetch(url) {
  let data = null, promise = null;
  return () => {
    if (data) return Promise.resolve(data);
    if (!promise) {
      load(true);
      promise = fetch(url)
        .then((r) => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); })
        .then((gj) => { data = gj; return gj; })
        .catch((e) => { console.error(e); alert("Could not load " + url + "\n" + e.message); })
        .finally(() => load(false));
    }
    return promise;
  };
}

/* ---------- Coal closure tracts ---------- */
const loadCoal = cachedFetch("data/coal_tracts.geojson");
// 2025-31 footprint excludes tracts first listed in Notice 2026-39.
const coalVisible = (f) => notice === "2639" || f.properties.since !== "2026-39";
const coal = versioned(loadCoal, (gj) => {
  setCount("cnt_coal", gj.features.filter(coalVisible).length);
  return L.geoJSON(gj, {
    filter: coalVisible,
    style: (f) => ({
      color: "#5a1f0c", weight: 0.4,
      fillColor: COAL_COLORS[f.properties.type] || "#c0532b",
      fillOpacity: 0.7,
    }),
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.on("mouseover", () => showHover(`<b>Coal closure tract</b> — ${p.type}<br>${p.tract} · FIPS ${p.GEOID}`));
      l.on("mouseout", hideHover);
      l.bindPopup(
        `<h3>Coal closure census tract</h3>
         <div><span class="k">Tract:</span> ${p.tract}</div>
         <div><span class="k">FIPS:</span> ${p.GEOID}</div>
         <div><span class="k">Type:</span> ${p.detail || p.type}</div>
         ${p.since === "2026-39" ? '<div><span class="k">Added:</span> Notice 2026-39</div>' : ""}`);
    },
  });
});

/* ---------- FFE counties (shared loader, two display layers) ---------- */
let ffeData = null, ffePromise = null;
function loadFFE() {
  if (!ffePromise) {
    load(true);
    ffePromise = fetch("data/ffe_counties.geojson")
      .then((r) => r.json())
      .then((gj) => { ffeData = gj; refreshFfeCounts(); return gj; })
      .finally(() => load(false));
  }
  return ffePromise;
}
const ffeDoKey = () => "do_" + notice;
function refreshFfeCounts() {
  if (!ffeData) return;
  const k = ffeDoKey();
  setCount("cnt_ffe_do", ffeData.features.filter((f) => f.properties[k]).length);
  setCount("cnt_ffe_may", ffeData.features.filter((f) => f.properties.may && !f.properties[k]).length);
}

function ffePopup(p) {
  const isDo = p[ffeDoKey()];
  const status = isDo
    ? `<span class="pill" style="background:#1f8a70">Qualifying energy community</span>`
    : `<span class="pill" style="background:#f0b400;color:#3a2700">Meets FFE employment threshold — not currently qualifying (unemployment below national-average threshold)</span>`;
  let v = "";
  if (isDo) v = `<div><span class="k">Eligible under:</span> ${[p["v1_" + notice] ? "Vintage 1 (2010-based)" : null, p["v2_" + notice] ? "Vintage 2 (2020-based)" : null].filter(Boolean).join(", ") || "—"}</div>`;
  return `<h3>${p.name}, ${p.state}</h3>${status}
    <div style="margin-top:5px"><span class="k">County FIPS:</span> ${p.GEOID}</div>${v}
    <div><span class="k">Data:</span> ${NOTICE_LABEL[notice]}</div>`;
}

const ffeDo = versioned(loadFFE, (gj) => L.geoJSON(gj, {
  filter: (f) => f.properties[ffeDoKey()],
  style: { color: "#0c5", weight: 0.5, fillColor: "#1f8a70", fillOpacity: 0.55 },
  onEachFeature: (f, l) => {
    const p = f.properties;
    l.on("mouseover", () => showHover(`<b>${p.name}, ${p.state}</b><span class="tag">FFE qualifying</span>`));
    l.on("mouseout", hideHover);
    l.bindPopup(ffePopup(p));
  },
}));

const ffeMay = versioned(loadFFE, (gj) => L.geoJSON(gj, {
  filter: (f) => f.properties.may && !f.properties[ffeDoKey()],
  style: { color: "#9c7400", weight: 0.5, fillColor: "#f0b400", fillOpacity: 0.55 },
  onEachFeature: (f, l) => {
    const p = f.properties;
    l.on("mouseover", () => showHover(`<b>${p.name}, ${p.state}</b><span class="tag">Meets FFE threshold — not qualifying</span>`));
    l.on("mouseout", hideHover);
    l.bindPopup(ffePopup(p));
  },
}));

/* ---------- "What changed" diff: Notice 2025-31 -> 2026-39 ----------
   FFE counties that gained/lost qualifying status, plus coal tracts first
   listed in 2026-39. Independent of the selected notice version. */
const diffLayer = {
  layer: null,
  async show() {
    const [ffe, cgj] = await Promise.all([loadFFE(), loadCoal()]);
    if (!ffe || !cgj) return;
    if (!this.layer) {
      const grp = L.layerGroup();
      let dropped = 0, added = 0;
      L.geoJSON(ffe, {
        filter: (f) => f.properties.do_2531 !== f.properties.do_2639,
        style: (f) => f.properties.do_2639
          ? { color: "#0a7d5a", weight: 0.6, fillColor: "#13b886", fillOpacity: 0.65 }
          : { color: "#9e1b1b", weight: 0.6, fillColor: "#e23b3b", fillOpacity: 0.65 },
        onEachFeature: (f, l) => {
          const p = f.properties, isAdd = p.do_2639;
          isAdd ? added++ : dropped++;
          l.on("mouseover", () => showHover(`<b>${p.name}, ${p.state}</b><span class="tag">${isAdd ? "Added in 2026-39" : "Dropped in 2026-39"}</span>`));
          l.on("mouseout", hideHover);
          l.bindPopup(`<h3>${p.name}, ${p.state}</h3>` + (isAdd
            ? `<div><span class="yes">&#10003; Newly qualifying</span> under Notice 2026-39 (did not qualify under 2025-31).</div>`
            : `<div><span class="no">&#10007; No longer qualifying</span> under Notice 2026-39 (qualified under 2025-31).</div>`)
            + `<div><span class="k">County FIPS:</span> ${p.GEOID}</div>`);
        },
      }).addTo(grp);
      L.geoJSON(cgj, {
        filter: (f) => f.properties.since === "2026-39",
        style: { color: "#7a3d00", weight: 0.6, fillColor: "#ff8c1a", fillOpacity: 0.85 },
        onEachFeature: (f, l) => {
          const p = f.properties;
          l.on("mouseover", () => showHover(`<b>New coal closure tract (2026-39)</b> — ${p.tract}`));
          l.on("mouseout", hideHover);
          l.bindPopup(`<h3>New coal closure tract</h3>
            <div><span class="k">Added:</span> Notice 2026-39</div>
            <div><span class="k">Tract:</span> ${p.tract}</div>
            <div><span class="k">FIPS:</span> ${p.GEOID}</div>
            <div><span class="k">Type:</span> ${p.detail || p.type}</div>`);
        },
      }).addTo(grp);
      this.layer = grp;
      setCount("cnt_diff", added + dropped + cgj.features.filter((f) => f.properties.since === "2026-39").length);
    }
    if (!map.hasLayer(this.layer)) this.layer.addTo(map);
  },
  hide() { if (this.layer && map.hasLayer(this.layer)) map.removeLayer(this.layer); },
};

/* ---------- County -> MSA/non-MSA crosswalk (Treasury EC_MSA_V1_V2) ---------- */
let msaXwalk = null, xwalkPromise = null;
function loadXwalk() {
  if (!xwalkPromise) {
    load(true);
    xwalkPromise = fetch("data/county_msa_xwalk.json")
      .then((r) => r.json())
      .then((d) => { msaXwalk = d; })
      .catch((e) => console.error(e))
      .finally(() => load(false));
  }
  return xwalkPromise;
}

function msaEntry(code, name, isCT) {
  if (!code) return isCT
    ? '<em>n/a — this vintage uses Connecticut planning regions</em>'
    : "—";
  const kind = Number(code) >= 100000 ? "non-MSA" : "MSA";
  return `${name} <span class="k">(${kind} ${code})</span>`;
}

function countyMsaHtml(geoid) {
  const x = msaXwalk && msaXwalk[geoid];
  if (!x) return "";
  const isCT = geoid.startsWith("09");
  return `<div class="elig"><span class="k">Vintage 1 (2010-based):</span> ${msaEntry(x[0], x[1], isCT)}</div>
    <div><span class="k">Vintage 2 (2020-based):</span> ${msaEntry(x[2], x[3], isCT)}</div>`;
}

/* Prominent line for the currently-selected vintage's MSA/non-MSA, shown
   directly under the county name when a V1 or V2 layer is active. */
function selectedMsaHeader(geoid) {
  if (msaSel !== "v1" && msaSel !== "v2") return "";
  const x = msaXwalk && msaXwalk[geoid];
  if (!x) return "";
  const isCT = geoid.startsWith("09");
  const code = msaSel === "v1" ? x[0] : x[2];
  const name = msaSel === "v1" ? x[1] : x[3];
  const label = msaSel === "v1" ? "Vintage 1" : "Vintage 2";
  return `<div class="msa-head">${msaEntry(code, name, isCT)} <span class="k">· ${label}</span></div>`;
}

/* ---------- Counties (thin reference outline; the level-2 drill layer) ---------- */
function countyPopupHtml(p) {
  return `<h3>${p.NAMELSAD}</h3>${selectedMsaHeader(p.GEOID)}<div>${p.STATE_NAME} (${p.STUSPS})</div>
     <div><span class="k">FIPS:</span> ${p.GEOID}</div>${countyMsaHtml(p.GEOID)}`;
}

const countiesBase = lazyLayer("data/counties.geojson", (gj) =>
  L.geoJSON(gj, {
    style: { color: "#9a9a9a", weight: 0.35, fill: true, fillOpacity: 0, fillColor: "#000" },
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.on("mouseover", (e) => {
        e.target.setStyle({ weight: 1.4, color: "#222" });
        let extra = "";
        const x = msaXwalk && msaXwalk[p.GEOID];
        if (x && msaSel === "v1" && x[1]) extra = `<br>V1: ${x[1]}`;
        if (x && msaSel === "v2" && x[3]) extra = `<br>V2: ${x[3]}`;
        showHover(`<b>${p.NAMELSAD}</b>, ${p.STATE_NAME} <span class="tag">FIPS ${p.GEOID}</span>${extra}`);
      });
      l.on("mouseout", (e) => { e.target.setStyle({ weight: 0.35, color: "#9a9a9a" }); hideHover(); });
      l.on("click", (e) => handleCountyClick(p, e.latlng));
    },
  })
);

const counties = {
  async show() {
    await Promise.all([loadXwalk(), countiesBase.show()]);
    // At level 1 with no vintage, counties are the only clickable layer.
    if (msaSel === "none") { const l = countiesBase.getLayer(); if (l && map.hasLayer(l)) l.bringToFront(); }
  },
  hide() { countiesBase.hide(); },
};

/* ---------- CBSA / MSA boundaries (two vintages) ---------- */
function cbsaStyle(color) {
  return (f) => {
    const isMsa = f.properties.kind !== "non-MSA";
    const q = f.properties["ffe_do_" + notice];
    return {
      color: color,
      weight: isMsa ? 2.6 : 2.0,
      dashArray: isMsa ? null : "5 4",
      fill: true,
      fillColor: q ? "#1f8a70" : color,
      fillOpacity: q ? (isMsa ? 0.5 : 0.4) : (isMsa ? 0.08 : 0.04),
    };
  };
}
function makeCbsa(color) {
  const styleFn = cbsaStyle(color);
  return (gj) =>
    L.geoJSON(gj, {
      style: styleFn,
      onEachFeature: (f, l) => {
        const p = f.properties;
        const isMsa = p.kind !== "non-MSA";
        const label = isMsa ? "Metropolitan Statistical Area (MSA)" : "Non-MSA area";
        const baseWeight = isMsa ? 2.6 : 2.0;
        l.on("mouseover", (e) => {
          e.target.setStyle({ weight: baseWeight + 1.6 });
          const tag = p["ffe_do_" + notice] ? `${label} &mdash; qualifying FFE energy community` : label;
          showHover(`<b>${p.NAME}</b><span class="tag">${tag}</span>`);
        });
        l.on("mouseout", (e) => { e.target.setStyle({ weight: baseWeight }); hideHover(); });
        l.on("click", (e) => selectArea(p.GEOID, e.latlng));
      },
    });
}
const cbsaV1 = lazyLayer("data/cbsa_v1_2010.geojson", makeCbsa("#6a3d9a"));
const cbsaV2 = lazyLayer("data/cbsa_v2_2020.geojson", makeCbsa("#1f6fb2"));
const cbsaStyleByVintage = { v1: cbsaStyle("#6a3d9a"), v2: cbsaStyle("#1f6fb2") };
function restyleCbsa() {
  [["v1", cbsaV1], ["v2", cbsaV2]].forEach(([v, lz]) => {
    const l = lz.getLayer();
    if (l && map.hasLayer(l)) l.setStyle(cbsaStyleByVintage[v]);
  });
}

/* ---------- Two-level drill: MSA/non-MSA (level 1) -> counties (level 2) ----------
   Level 1: MSA/non-MSA regions are the clickable layer (thick borders).
   Clicking a region highlights its border, shows its info, and arms its
   counties. Level 2: clicking inside the focused area selects a county;
   clicking into a different area refocuses to that area's MSA. */
let drillMsa = null;        // GEOID of the focused area, or null at level 1
let highlightLayer = null;  // non-interactive outline drawn over the focused area
let activeCbsa = null;      // { vintage } metadata for the shown vintage
const msaByCode = {};       // GEOID -> cbsa sublayer (geometry + properties)

function buildMsaIndex(geoLayer, vintage) {
  for (const k in msaByCode) delete msaByCode[k];
  activeCbsa = { vintage };
  if (geoLayer) geoLayer.eachLayer((sub) => { msaByCode[sub.feature.properties.GEOID] = sub; });
}

function msaPopupHtml(p) {
  const isMsa = p.kind !== "non-MSA";
  const label = isMsa ? "Metropolitan Statistical Area (MSA)" : "Non-MSA area";
  const vintage = activeCbsa ? activeCbsa.vintage : "";
  return `<h3>${p.NAME}</h3><div>${label}</div>
    <div><span class="k">Area code:</span> ${p.GEOID}</div>
    <div class="elig"><span class="k">FFE energy community (${vintage}):</span> ${p["ffe_do_" + notice] ? '<span class="yes">&#10003; Qualifies</span>' : '<span class="no">&#10007; Not qualifying</span>'}</div>
    <div><span class="k">Data:</span> ${NOTICE_LABEL[notice]}</div>
    <div class="drill-hint">Click inside this area to inspect its counties.</div>`;
}

function vintageCode(geoid) {
  const x = msaXwalk && msaXwalk[geoid];
  if (!x) return null;
  return msaSel === "v1" ? x[0] : msaSel === "v2" ? x[2] : null;
}

function drawHighlight(geoid) {
  if (highlightLayer) { map.removeLayer(highlightLayer); highlightLayer = null; }
  const sub = msaByCode[geoid];
  if (!sub) return;
  highlightLayer = L.geoJSON(sub.feature, {
    interactive: false,
    style: { color: "#e8590c", weight: 4, fill: false, dashArray: null },
  }).addTo(map);
}

function selectArea(geoid, latlng) {
  const sub = msaByCode[geoid];
  if (!sub) return;
  drillMsa = geoid;
  drawHighlight(geoid);
  const cl = countiesBase.getLayer();          // counties become the clickable layer
  if (cl && map.hasLayer(cl)) cl.bringToFront();
  if (highlightLayer) highlightLayer.bringToFront();
  L.popup({ autoPan: true }).setLatLng(latlng).setContent(msaPopupHtml(sub.feature.properties)).openOn(map);
  backBtn.style.display = "block";
}

function handleCountyClick(p, latlng) {
  const openCounty = () => L.popup().setLatLng(latlng).setContent(countyPopupHtml(p)).openOn(map);
  if (msaSel !== "v1" && msaSel !== "v2") { openCounty(); return; }
  const code = vintageCode(p.GEOID);
  if (code && code === drillMsa) openCounty();          // inside focused area -> county detail
  else if (code && msaByCode[code]) selectArea(code, latlng); // different area -> refocus
  else openCounty();                                     // unmapped (e.g. CT planning regions)
}

function enterLevel1() {
  drillMsa = null;
  if (highlightLayer) { map.removeLayer(highlightLayer); highlightLayer = null; }
  backBtn.style.display = "none";
  const lz = msaSel === "v1" ? cbsaV1 : msaSel === "v2" ? cbsaV2 : null;
  const gl = lz && lz.getLayer();
  if (gl && map.hasLayer(gl)) gl.bringToFront();        // MSA regions clickable at level 1
}

function backToAreas() { map.closePopup(); enterLevel1(); }

const backBtn = document.createElement("button");
backBtn.id = "backBtn";
backBtn.type = "button";
backBtn.innerHTML = "&#8624; Back to areas";
backBtn.style.display = "none";
backBtn.addEventListener("click", backToAreas);
document.body.appendChild(backBtn);

/* ---------- Nuclear sites (per-plant visibility; categories = bulk toggles) ---------- */
const NUC_COLORS = { operating: "#1a9e1a", former: "#999", esp_col: "#2b6cb0", advanced: "#8e44ad" };
const NUC_CATS = ["operating", "former", "esp_col", "advanced"];
const NUC_CAT_CB = { operating: "lyr_nuc_op", former: "lyr_nuc_former", esp_col: "lyr_nuc_esp_col", advanced: "lyr_nuc_advanced" };
const NUC_CAT_CNT = { operating: "cnt_nuc_op", former: "cnt_nuc_former", esp_col: "cnt_nuc_esp_col", advanced: "cnt_nuc_advanced" };
const NUC_CAT_LABEL = { operating: "Operating", former: "Former / shut down", esp_col: "ESP / COL sites", advanced: "Advanced reactors" };

const yn = (b) => (b ? '<span class="yes">&#10003;</span>' : '<span class="no">&#10007;</span>');

function nucLabel(p) {
  return p.category === "former" ? "Former / shut down"
    : p.category === "operating" ? "Operating"
    : p.status || "Licensed / proposed";
}

const nucUnemp = (p) => p["ffe_unemp_" + notice];
const nucCoal = (p) => p["coal_" + notice];
function nucPopup(p) {
  return `<h3>${p.name}</h3><div>${nucLabel(p)}</div>
    <div><span class="k">Owner:</span> ${p.owner || "—"}</div>
    ${p.county ? `<div><span class="k">Location:</span> ${p.county}, ${p.state}</div>` : ""}
    ${p.dissolved ? `<div><span class="k">Closed:</span> ${String(p.dissolved).slice(0, 4)}</div>` : ""}
    <div class="elig"><span class="k">FFE:</span> ${yn(p.ffe)}<span class="k">FFE + Unemployment:</span> ${yn(nucUnemp(p))}<span class="k">Coal:</span> ${yn(nucCoal(p))}</div>
    <div><span class="k">Data:</span> ${NOTICE_LABEL[notice]}</div>`;
}

/* Plant markers live in their own high pane so they stay above the polygon
   fills even after counties/MSA regions are brought to front. */
map.createPane("nucPane");
map.getPane("nucPane").style.zIndex = 640;
const nucRenderer = L.canvas({ pane: "nucPane" });

let nucData = null, nucPromise = null;
const nucLayer = L.layerGroup().addTo(map);   // holds the currently-visible markers
const markersByName = {};                     // plant name -> circleMarker
const catByName = {};                         // plant name -> category
const visiblePlants = new Set();              // names currently shown on the map
const featuredSet = new Set();                // names on the curated watchlist

function loadNuclear() {
  if (!nucPromise) {
    load(true);
    nucPromise = fetch("data/nuclear.geojson")
      .then((r) => r.json())
      .then((gj) => {
        nucData = gj;
        gj.features.forEach((f) => {
          const p = f.properties;
          const [lng, lat] = f.geometry.coordinates;
          const m = L.circleMarker([lat, lng], {
            renderer: nucRenderer, pane: "nucPane",
            radius: 6, weight: 1.5, color: "#222",
            fillColor: NUC_COLORS[p.category] || "#1a9e1a", fillOpacity: 0.95,
          });
          m.on("mouseover", () => showHover(`<b>${p.name}</b><span class="tag">${nucLabel(p)}</span>`));
          m.on("mouseout", hideHover);
          m.bindPopup(() => nucPopup(p));
          markersByName[p.name] = m;
          catByName[p.name] = p.category;
          if (p.featured) featuredSet.add(p.name);
        });
        NUC_CATS.forEach((c) => setCount(NUC_CAT_CNT[c], gj.features.filter((f) => f.properties.category === c).length));
        setCount("cnt_nuc_featured", featuredSet.size);
        buildPlantPicker();
        return gj;
      })
      .finally(() => load(false));
  }
  return nucPromise;
}

function plantsInCat(cat) { return Object.keys(catByName).filter((n) => catByName[n] === cat); }

function setPlantVisible(name, on) {
  const m = markersByName[name];
  if (!m) return;
  if (on && !visiblePlants.has(name)) { visiblePlants.add(name); nucLayer.addLayer(m); }
  else if (!on && visiblePlants.has(name)) { visiblePlants.delete(name); nucLayer.removeLayer(m); }
}

function setCategoryVisible(cat, on) {
  plantsInCat(cat).forEach((n) => setPlantVisible(n, on));
  syncPickerForCat(cat);
  refreshCatCheckbox(cat);
}

/* Category checkbox reflects its plants: checked = all on, indeterminate = some on. */
function refreshCatCheckbox(cat) {
  const names = plantsInCat(cat);
  const vis = names.filter((n) => visiblePlants.has(n)).length;
  const cb = document.getElementById(NUC_CAT_CB[cat]);
  if (!cb) return;
  cb.checked = vis > 0 && vis === names.length;
  cb.indeterminate = vis > 0 && vis < names.length;
}

/* ----- Individual-plant picker (searchable side-panel list) ----- */
function buildPlantPicker() {
  const list = document.getElementById("plantList");
  if (!list || !nucData) return;
  let html = "";
  NUC_CATS.forEach((cat) => {
    const feats = nucData.features
      .filter((f) => f.properties.category === cat)
      .sort((a, b) => a.properties.name.localeCompare(b.properties.name));
    if (!feats.length) return;
    html += `<div class="pl-group" data-cat="${cat}">
      <div class="pl-cat"><span class="swatch swatch-dot" style="background:${NUC_COLORS[cat]}"></span>${NUC_CAT_LABEL[cat]}</div>`;
    feats.forEach((f) => {
      const p = f.properties;
      const chk = visiblePlants.has(p.name) ? " checked" : "";
      const search = attr((p.name + " " + (p.state || "") + " " + (p.county || "")).toLowerCase());
      html += `<label class="pl-item" data-search="${search}">
        <input type="checkbox" data-name="${attr(p.name)}"${chk}>
        <span class="pl-name">${p.name}</span><span class="pl-meta">${p.state || ""}</span></label>`;
    });
    html += `</div>`;
  });
  list.innerHTML = html;
}

function syncPickerForCat(cat) {
  document.querySelectorAll(`#plantList .pl-group[data-cat="${cat}"] input[type=checkbox]`)
    .forEach((cb) => { cb.checked = visiblePlants.has(cb.dataset.name); });
}

/* ---------- Wire up controls ---------- */
function bind(id, ctrl) {
  const cb = document.getElementById(id);
  cb.addEventListener("change", () => { cb.checked ? ctrl.show() : ctrl.hide(); });
  if (cb.checked) ctrl.show();
}
bind("lyr_coal", coal);
bind("lyr_ffe_do", ffeDo);
bind("lyr_ffe_may", ffeMay);
bind("lyr_diff", diffLayer);

/* ---------- Eligibility data version (IRS notice) ---------- */
function setNotice(v) {
  if (v === notice) return;
  notice = v;
  coal.refresh();          // also refreshes cnt_coal
  ffeDo.refresh();
  ffeMay.refresh();
  refreshFfeCounts();
  restyleCbsa();
  map.closePopup();
  if (tableModal.classList.contains("open")) buildTable();
}
document.querySelectorAll('input[name="notice"]').forEach((r) => {
  r.addEventListener("change", () => { if (r.checked) setNotice(r.value); });
});

/* Counties show when their checkbox is on OR an MSA vintage layer is active,
   so MSA regions stay clickable at the county level. */
let msaSel = "none";
const countiesCb = document.getElementById("lyr_counties");
function syncCounties() {
  if (countiesCb.checked || msaSel !== "none") counties.show();
  else counties.hide();
}
countiesCb.addEventListener("change", syncCounties);
if (countiesCb.checked) counties.show();
/* Nuclear categories are bulk on/off for every plant in the category */
NUC_CATS.forEach((cat) => {
  const cb = document.getElementById(NUC_CAT_CB[cat]);
  cb.addEventListener("change", async () => {
    const on = cb.checked;
    await loadNuclear();
    setCategoryVisible(cat, on);
  });
});

/* Featured watchlist: bulk on/off across categories */
document.getElementById("lyr_nuc_featured").addEventListener("change", async (e) => {
  const on = e.target.checked;
  await loadNuclear();
  featuredSet.forEach((n) => setPlantVisible(n, on));
  NUC_CATS.forEach(refreshCatCheckbox);
});

/* Individual-plant picker: lazy-load on open, search, bulk All/None, per-plant toggle */
const plantPicker = document.getElementById("plantPicker");
plantPicker.addEventListener("toggle", async () => {
  if (!plantPicker.open) return;
  await loadNuclear();
  if (!document.getElementById("plantList").children.length) buildPlantPicker();
});
document.getElementById("plantList").addEventListener("change", (e) => {
  const cb = e.target;
  if (cb.type !== "checkbox") return;
  setPlantVisible(cb.dataset.name, cb.checked);
  refreshCatCheckbox(catByName[cb.dataset.name]);
});
document.getElementById("plantSearch").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll("#plantList .pl-item").forEach((el) => {
    el.style.display = !q || el.dataset.search.includes(q) ? "" : "none";
  });
  document.querySelectorAll("#plantList .pl-group").forEach((g) => {
    const any = [...g.querySelectorAll(".pl-item")].some((el) => el.style.display !== "none");
    g.style.display = any ? "" : "none";
  });
});
function bulkPicker(on) {
  document.querySelectorAll("#plantList .pl-item").forEach((el) => {
    if (el.style.display === "none") return;       // only rows matching the current search
    const cb = el.querySelector("input");
    setPlantVisible(cb.dataset.name, on);
    cb.checked = on;
  });
  NUC_CATS.forEach(refreshCatCheckbox);
}
document.getElementById("pickAll").addEventListener("click", () => bulkPicker(true));
document.getElementById("pickNone").addEventListener("click", () => bulkPicker(false));

/* ---------- Plant eligibility table ---------- */
const tableModal = document.getElementById("tableModal");
let tableSort = { key: "name", asc: true };
const MAX_SEL = 10;
const selected = new Set();
let showSelectedOnly = false;
let featuredOnly = false;
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function updateSelUI() {
  const n = selected.size;
  const cnt = document.getElementById("selCount");
  cnt.textContent = `${n} / ${MAX_SEL} selected`;
  cnt.classList.toggle("maxed", n >= MAX_SEL);
  const onlyBtn = document.getElementById("selOnlyBtn");
  onlyBtn.textContent = showSelectedOnly ? "Show all plants" : "Show only selected";
  onlyBtn.disabled = n === 0 && !showSelectedOnly;
  document.getElementById("selClearBtn").disabled = n === 0 && !showSelectedOnly;
  document.querySelectorAll("#nucTable tbody input[type=checkbox]").forEach((cb) => {
    cb.disabled = !cb.checked && n >= MAX_SEL;
  });
}

function buildTable() {
  const tbody = document.querySelector("#nucTable tbody");
  const statusText = (p) => p.status || (p.category === "former" ? "Former" : "Operating");
  const cell = (p, k) => k === "ffe_unemp" ? nucUnemp(p) : k === "coal" ? nucCoal(p) : p[k];
  const val = (p, k) => (k === "status" ? statusText(p).toLowerCase()
    : k === "name" || k === "owner" || k === "state" || k === "county" ? (p[k] || "").toLowerCase()
    : cell(p, k) ? 1 : 0);
  let feats = [...nucData.features];
  if (featuredOnly) feats = feats.filter((f) => f.properties.featured);
  if (showSelectedOnly) feats = feats.filter((f) => selected.has(f.properties.name));
  feats.sort((a, b) => {
    const va = val(a.properties, tableSort.key), vb = val(b.properties, tableSort.key);
    const cmp = va < vb ? -1 : va > vb ? 1 : a.properties.name.localeCompare(b.properties.name);
    return tableSort.asc ? cmp : -cmp;
  });
  tbody.innerHTML = feats.map((f) => {
    const p = f.properties;
    const chk = selected.has(p.name) ? " checked" : "";
    const plantName = featuredOnly && p.featured_name ? p.featured_name : p.name;
    return `<tr><td class="sel"><input type="checkbox" data-name="${attr(p.name)}"${chk}></td>` +
      `<td>${plantName}</td><td>${p.state || "—"}</td><td>${p.county || "—"}</td><td>${p.owner || "—"}</td><td>${statusText(p)}</td>` +
      `<td class="c">${yn(p.ffe)}</td><td class="c">${yn(nucUnemp(p))}</td><td class="c">${yn(nucCoal(p))}</td></tr>`;
  }).join("");
  const tn = document.getElementById("tableNotice");
  if (tn) tn.textContent = NOTICE_LABEL[notice];
  updateSelUI();
}

async function openTable() {
  await loadNuclear();
  buildTable();
  tableModal.classList.add("open");
}
function closeTable() { tableModal.classList.remove("open"); }

document.getElementById("tableBtn").addEventListener("click", openTable);
document.getElementById("tableClose").addEventListener("click", closeTable);
tableModal.addEventListener("click", (e) => { if (e.target === tableModal) closeTable(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeTable(); });
document.querySelectorAll("#nucTable th").forEach((th) => {
  th.addEventListener("click", () => {
    const k = th.dataset.k;
    if (!k) return;
    tableSort = { key: k, asc: tableSort.key === k ? !tableSort.asc : true };
    buildTable();
  });
});
document.querySelector("#nucTable tbody").addEventListener("change", (e) => {
  const cb = e.target;
  if (cb.type !== "checkbox") return;
  if (cb.checked) {
    if (selected.size >= MAX_SEL) { cb.checked = false; return; }
    selected.add(cb.dataset.name);
  } else {
    selected.delete(cb.dataset.name);
  }
  if (showSelectedOnly && !cb.checked) buildTable();
  else updateSelUI();
});
document.getElementById("selOnlyBtn").addEventListener("click", () => {
  if (!showSelectedOnly && selected.size === 0) return;
  showSelectedOnly = !showSelectedOnly;
  buildTable();
});
document.getElementById("selClearBtn").addEventListener("click", () => {
  selected.clear();
  showSelectedOnly = false;
  buildTable();
});
document.getElementById("selFeaturedBtn").addEventListener("click", (e) => {
  featuredOnly = !featuredOnly;
  e.target.classList.toggle("active", featuredOnly);
  e.target.textContent = featuredOnly ? "★ Showing featured" : "★ Featured list";
  buildTable();
});

document.querySelectorAll('input[name="msa"]').forEach((r) => {
  r.addEventListener("change", async () => {
    if (!r.checked) return;
    msaSel = r.value;
    // reset any drill state from the previous vintage
    map.closePopup();
    if (highlightLayer) { map.removeLayer(highlightLayer); highlightLayer = null; }
    drillMsa = null;
    backBtn.style.display = "none";
    cbsaV1.hide(); cbsaV2.hide();
    if (r.value === "none") { buildMsaIndex(null); syncCounties(); return; }
    const lz = r.value === "v1" ? cbsaV1 : cbsaV2;
    const vintage = r.value === "v1" ? "2010 / Vintage 1" : "2020 / Vintage 2";
    await lz.show();
    await counties.show();            // thin county lines present for level-2 drilling
    buildMsaIndex(lz.getLayer(), vintage);
    enterLevel1();                     // MSA/non-MSA borders on top & clickable (level 1)
  });
});

/* Esc returns from a drilled-in area to the MSA/non-MSA level (when no modal is open) */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !tableModal.classList.contains("open") && drillMsa) backToAreas();
});

/* mobile panel toggle */
const panel = document.getElementById("panel");
document.getElementById("panelToggle").addEventListener("click", () => panel.classList.add("open"));
map.on("click", () => { if (window.innerWidth <= 640) panel.classList.remove("open"); });
