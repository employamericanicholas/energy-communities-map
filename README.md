# U.S. Energy Communities Map

Interactive web map of **IRA tax-credit bonus eligibility** for energy communities,
plus reference boundaries and nuclear power plant sites. Built with
[Leaflet](https://leafletjs.com/) and served as a static site (GitHub Pages).

**Live map:** _(enable GitHub Pages → `main` branch, `/docs` folder)_

## Layers

| Layer | Level | Source |
|-------|-------|--------|
| Coal closure tracts (mine closure / unit retirement / adjoining) | Census tract | IRS Notice 2025-31 + cumulative prior notices |
| FFE — qualifying energy communities | County | IRS Notice 2025-31 |
| FFE — meets threshold, unemployment pending | County | IRS Notice 2025-31 |
| U.S. counties (reference outline) | County | Census Bureau cb_2020 |
| MSA / non-MSA boundaries (2010 & 2020 OMB vintages) | MSA & non-MSA region | Dissolved from Treasury/IRS county groupings (EC_MSA_V1_V2.xlsx) |
| Nuclear power plant sites (operating + former) | Point | Wikipedia / DBpedia |

## Repository layout

```
docs/            Published static site (GitHub Pages root)
  index.html
  app.js
  styles.css
  data/          GeoJSON layers consumed by the map
build/           Python build scripts that produce docs/data/*.geojson
data/            Intermediate extracted eligibility lists (JSON)
```

## Rebuilding the data

The GeoJSON layers in `docs/data/` are generated from raw Census shapefiles
(downloaded by `build/download_shp.py` / `download_tracts.py`) and the IRS notice
extracts in `data/`. Run the `build/*.py` scripts to regenerate them.

The MSA / non-MSA region layers (`cbsa_v1_2010.geojson`, `cbsa_v2_2020.geojson`)
are rebuilt by `build/build_msa_regions.py`, which dissolves county polygons using
Treasury's authoritative county→MSA/non-MSA crosswalk (`EC_MSA_V1_V2.xlsx`) so the
boundaries exactly match the IRS Statistical Area groupings for each vintage.
Vintage 1 keys on legacy Connecticut counties; Vintage 2 on the 2023 Connecticut
planning regions.

## Disclaimer

Unofficial visualization for research / educational use. Confirm eligibility against
the official IRS notices and the DOE/IRS energy community mapping tool.
