# ADR-0003 — Mapa base: patrón RUC360 (MapLibre + OpenFreeMap + caché en disco) y paquete territorial propio

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

```yaml
adr_id: ADR-0003
title: Mapa base y límites territoriales
status: PROPOSED
owner: Pierre R. Boss (oprbguitar)
prepared_by: Claude Code (eos-architect)
affected_components: [peru_intel.map, apps/web/js/map.js, data/peru, data/ofm]
```

## Contexto comprobado

- RUC360 (`portal/mapa_zona.py`) ya sirve OpenFreeMap a través de un proxy con caché en disco (`data/ofm`, 136 MB vistos).
- OCE/FEDTID y RUC360 comparten la cartografía simplificada INEI (`peru_departamental_simple.geojson`,
  `peru_distrital_simple.geojson`, 1 834 distritos).
- La carpeta **3SL** mencionada en el encargo **no se encontró** en `Analisis de empresas` ni en el repo
  `datos01082026` (búsqueda por nombre, 2026-10-04). Queda pendiente auditarla cuando se entregue.

## Decisión propuesta

1. **Proxy OFM portado** (`peru_intel/map/ofm_proxy.py`): busca en `data/ofm`, luego en la caché de RUC360
   en solo lectura, luego en la red; reescribe estilos/TileJSON al origen local (MapLibre exige URLs absolutas).
   `python -m peru_intel export-ofm` copia la caché de RUC360 para no depender de esa carpeta.
2. **Paquete territorial** `data/peru/` generado una vez (`build-territory`): departamentos, provincias
   (unión de distritos por IDPROV con DuckDB spatial) y distritos, con UBIGEO y punto de etiqueta.
3. **`Ruc360MapAdapter`** expone `load_base_map`, `load_departments/provinces/districts`, `load_roads`,
   `load_territory`/`load_cadastre` (lectura de `territorio.db` solo si existe), `resolve_ubigeo`,
   `resolve_coordinates`, `get_available_layers`.

## Evolución

- PMTiles (`protomaps/PMTiles`) para empaquetar Perú en un archivo y servirlo luego desde R2/S3/CDN.
- `tileserver-gl` solo si aparecen MBTiles.
