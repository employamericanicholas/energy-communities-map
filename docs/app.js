/* U.S. Energy Communities Map */
"use strict";

const map = L.map("map", { preferCanvas: true, minZoom: 3, maxZoom: 12 })
  .setView([39.5, -98.5], 4);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> | Boundaries: U.S. Census Bureau | Eligibility: IRS Notice 2025-31',
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

/* ---------- Coal closure tracts ---------- */
const coal = lazyLayer("data/coal_tracts.geojson", (gj) => {
  setCount("cnt_coal", gj.features.length);
  return L.geoJSON(gj, {
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
         <div><span class="k">Type:</span> ${p.detail || p.type}</div>`);
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
      .then((gj) => {
        ffeData = gj;
        setCount("cnt_ffe_do", gj.features.filter((f) => f.properties.do).length);
        setCount("cnt_ffe_may", gj.features.filter((f) => f.properties.may && !f.properties.do).length);
        return gj;
      })
      .finally(() => load(false));
  }
  return ffePromise;
}

function ffePopup(p) {
  const status = p.do
    ? `<span class="pill" style="background:#1f8a70">Qualifying energy community</span>`
    : `<span class="pill" style="background:#f0b400;color:#3a2700">Meets FFE employment threshold — not currently qualifying (unemployment below national-average threshold)</span>`;
  let v = "";
  if (p.do) v = `<div><span class="k">Eligible under:</span> ${[p.v1 ? "Vintage 1 (2010-based)" : null, p.v2 ? "Vintage 2 (2020-based)" : null].filter(Boolean).join(", ") || "—"}</div>`;
  return `<h3>${p.name}, ${p.state}</h3>${status}
    <div style="margin-top:5px"><span class="k">County FIPS:</span> ${p.GEOID}</div>${v}`;
}

const ffeDo = {
  layer: null,
  async show() {
    await loadFFE();
    if (!this.layer) {
      this.layer = L.geoJSON(ffeData, {
        filter: (f) => f.properties.do,
        style: { color: "#0c5", weight: 0.5, fillColor: "#1f8a70", fillOpacity: 0.55 },
        onEachFeature: (f, l) => {
          const p = f.properties;
          l.on("mouseover", () => showHover(`<b>${p.name}, ${p.state}</b><span class="tag">FFE qualifying</span>`));
          l.on("mouseout", hideHover);
          l.bindPopup(ffePopup(p));
        },
      });
    }
    if (!map.hasLayer(this.layer)) this.layer.addTo(map);
  },
  hide() { if (this.layer && map.hasLayer(this.layer)) map.removeLayer(this.layer); },
};

const ffeMay = {
  layer: null,
  async show() {
    await loadFFE();
    if (!this.layer) {
      this.layer = L.geoJSON(ffeData, {
        filter: (f) => f.properties.may && !f.properties.do,
        style: { color: "#9c7400", weight: 0.5, fillColor: "#f0b400", fillOpacity: 0.55 },
        onEachFeature: (f, l) => {
          const p = f.properties;
          l.on("mouseover", () => showHover(`<b>${p.name}, ${p.state}</b><span class="tag">Meets FFE threshold — not qualifying</span>`));
          l.on("mouseout", hideHover);
          l.bindPopup(ffePopup(p));
        },
      });
    }
    if (!map.hasLayer(this.layer)) this.layer.addTo(map);
  },
  hide() { if (this.layer && map.hasLayer(this.layer)) map.removeLayer(this.layer); },
};

/* ---------- Counties (reference outline) ---------- */
const counties = lazyLayer("data/counties.geojson", (gj) =>
  L.geoJSON(gj, {
    style: { color: "#555", weight: 0.6, fill: true, fillOpacity: 0, fillColor: "#000" },
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.on("mouseover", (e) => { e.target.setStyle({ weight: 1.6, color: "#000" }); showHover(`<b>${p.NAMELSAD}</b>, ${p.STATE_NAME} <span class="tag">FIPS ${p.GEOID}</span>`); });
      l.on("mouseout", (e) => { e.target.setStyle({ weight: 0.6, color: "#555" }); hideHover(); });
      l.bindPopup(`<h3>${p.NAMELSAD}</h3><div>${p.STATE_NAME} (${p.STUSPS})</div><div><span class="k">FIPS:</span> ${p.GEOID}</div>`);
    },
  })
);

/* ---------- CBSA / MSA boundaries (two vintages) ---------- */
function makeCbsa(color) {
  return (gj) =>
    L.geoJSON(gj, {
      style: (f) => f.properties.kind === "non-MSA"
        ? { color: color, weight: 1.0, dashArray: "4 3", fill: true, fillOpacity: 0.02, fillColor: color }
        : { color: color, weight: 1.3, fill: true, fillOpacity: 0.06, fillColor: color },
      onEachFeature: (f, l) => {
        const p = f.properties;
        const isMsa = p.kind !== "non-MSA";
        const label = isMsa ? "Metropolitan Statistical Area (MSA)" : "Non-MSA area";
        const baseWeight = isMsa ? 1.3 : 1.0;
        l.on("mouseover", (e) => { e.target.setStyle({ weight: 2.6 }); showHover(`<b>${p.NAME}</b><span class="tag">${label}</span>`); });
        l.on("mouseout", (e) => { e.target.setStyle({ weight: baseWeight }); hideHover(); });
        l.bindPopup(`<h3>${p.NAME}</h3><div>${label}</div><div><span class="k">Area code:</span> ${p.GEOID}</div>`);
      },
    });
}
const cbsaV1 = lazyLayer("data/cbsa_v1_2010.geojson", makeCbsa("#6a3d9a"));
const cbsaV2 = lazyLayer("data/cbsa_v2_2020.geojson", makeCbsa("#1f6fb2"));

/* ---------- Nuclear sites ---------- */
const nuclear = lazyLayer("data/nuclear.geojson", (gj) => {
  setCount("cnt_nuclear", gj.features.length);
  return L.geoJSON(gj, {
    pointToLayer: (f, latlng) => {
      const former = f.properties.category === "former";
      return L.circleMarker(latlng, {
        radius: 6, weight: 1.5, color: "#222",
        fillColor: former ? "#999" : "#1a9e1a", fillOpacity: 0.95,
      });
    },
    onEachFeature: (f, l) => {
      const p = f.properties;
      const label = p.category === "former" ? "Former / shut down" : p.category === "planned" ? "Planned / under construction" : "Operating";
      l.on("mouseover", () => showHover(`<b>${p.name}</b><span class="tag">${label}</span>`));
      l.on("mouseout", hideHover);
      l.bindPopup(`<h3>${p.name}</h3><div>${label}</div>${p.admin ? `<div><span class="k">Location:</span> ${p.admin}</div>` : ""}${p.dissolved ? `<div><span class="k">Closed:</span> ${String(p.dissolved).slice(0,4)}</div>` : ""}`);
    },
  });
});

/* ---------- Wire up controls ---------- */
function bind(id, ctrl) {
  const cb = document.getElementById(id);
  cb.addEventListener("change", () => { cb.checked ? ctrl.show() : ctrl.hide(); });
  if (cb.checked) ctrl.show();
}
bind("lyr_coal", coal);
bind("lyr_ffe_do", ffeDo);
bind("lyr_ffe_may", ffeMay);
bind("lyr_counties", counties);
bind("lyr_nuclear", nuclear);

document.querySelectorAll('input[name="msa"]').forEach((r) => {
  r.addEventListener("change", () => {
    cbsaV1.hide(); cbsaV2.hide();
    if (r.value === "v1" && r.checked) cbsaV1.show();
    if (r.value === "v2" && r.checked) cbsaV2.show();
  });
});

/* mobile panel toggle */
const panel = document.getElementById("panel");
document.getElementById("panelToggle").addEventListener("click", () => panel.classList.add("open"));
map.on("click", () => { if (window.innerWidth <= 640) panel.classList.remove("open"); });
