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

/* ---------- Nuclear sites (shared loader, two display layers + table) ---------- */
let nucData = null, nucPromise = null;
function loadNuclear() {
  if (!nucPromise) {
    load(true);
    nucPromise = fetch("data/nuclear.geojson")
      .then((r) => r.json())
      .then((gj) => {
        nucData = gj;
        const isFormer = (f) => f.properties.category === "former";
        setCount("cnt_nuc_op", gj.features.filter((f) => !isFormer(f)).length);
        setCount("cnt_nuc_former", gj.features.filter(isFormer).length);
        return gj;
      })
      .finally(() => load(false));
  }
  return nucPromise;
}

const yn = (b) => (b ? '<span class="yes">&#10003;</span>' : '<span class="no">&#10007;</span>');

function nucPopup(p) {
  const label = p.category === "former" ? "Former / shut down" : "Operating";
  return `<h3>${p.name}</h3><div>${label}</div>
    <div><span class="k">Owner:</span> ${p.owner || "—"}</div>
    ${p.dissolved ? `<div><span class="k">Closed:</span> ${String(p.dissolved).slice(0, 4)}</div>` : ""}
    <div class="elig"><span class="k">FFE:</span> ${yn(p.ffe)}<span class="k">FFE + Unemployment:</span> ${yn(p.ffe_unemp)}<span class="k">Coal:</span> ${yn(p.coal)}</div>`;
}

function makeNucLayer(wantFormer) {
  return {
    layer: null,
    async show() {
      await loadNuclear();
      if (!this.layer) {
        this.layer = L.geoJSON(nucData, {
          filter: (f) => (f.properties.category === "former") === wantFormer,
          pointToLayer: (f, latlng) => L.circleMarker(latlng, {
            radius: 6, weight: 1.5, color: "#222",
            fillColor: wantFormer ? "#999" : "#1a9e1a", fillOpacity: 0.95,
          }),
          onEachFeature: (f, l) => {
            const p = f.properties;
            const label = wantFormer ? "Former / shut down" : "Operating";
            l.on("mouseover", () => showHover(`<b>${p.name}</b><span class="tag">${label}</span>`));
            l.on("mouseout", hideHover);
            l.bindPopup(nucPopup(p));
          },
        });
      }
      if (!map.hasLayer(this.layer)) this.layer.addTo(map);
    },
    hide() { if (this.layer && map.hasLayer(this.layer)) map.removeLayer(this.layer); },
  };
}
const nucOp = makeNucLayer(false);
const nucFormer = makeNucLayer(true);

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
bind("lyr_nuc_op", nucOp);
bind("lyr_nuc_former", nucFormer);

/* ---------- Plant eligibility table ---------- */
const tableModal = document.getElementById("tableModal");
let tableSort = { key: "name", asc: true };

function buildTable() {
  const tbody = document.querySelector("#nucTable tbody");
  const val = (p, k) => (k === "status" ? (p.category === "former" ? 1 : 0)
    : k === "name" || k === "owner" || k === "state" || k === "county" ? (p[k] || "").toLowerCase()
    : p[k] ? 1 : 0);
  const rows = [...nucData.features].sort((a, b) => {
    const va = val(a.properties, tableSort.key), vb = val(b.properties, tableSort.key);
    const cmp = va < vb ? -1 : va > vb ? 1 : a.properties.name.localeCompare(b.properties.name);
    return tableSort.asc ? cmp : -cmp;
  });
  tbody.innerHTML = rows.map((f) => {
    const p = f.properties;
    const status = p.category === "former" ? "Former" : "Operating";
    return `<tr><td>${p.name}</td><td>${p.state || "—"}</td><td>${p.county || "—"}</td><td>${p.owner || "—"}</td><td>${status}</td>` +
      `<td class="c">${yn(p.ffe)}</td><td class="c">${yn(p.ffe_unemp)}</td><td class="c">${yn(p.coal)}</td></tr>`;
  }).join("");
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
    tableSort = { key: k, asc: tableSort.key === k ? !tableSort.asc : true };
    buildTable();
  });
});

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
