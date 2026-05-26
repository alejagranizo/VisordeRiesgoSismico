#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GENERATE_BUFFERS.py
==================================
Versión optimizada con Índice Espacial
"""

import os
import sys
import json
from shapely.ops import transform
from shapely.geometry import mapping
from pyproj import Transformer
import geopandas as gpd

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN
# ══════════════════════════════════════════════════════════════════════════════

BUFFER_DISTANCES = {
    1: 1.0,   # Slight
    2: 2.0,   # Moderate
    3: 3.0,   # Extensive
    4: 4.0,   # Complete
}

# Rutas de entrada (Ajustadas a Lorca según tu script)
INPUT_SHP   = os.path.join("inputs", "Lorca", "shapefiles", "EdificiosLorca2026.shp")
INPUT_TXT   = os.path.join("inputs", "Lorca", "allBuildings_cusec.txt")
OUTPUT_DIR  = os.path.join("inputs", "Lorca")
OUTPUT_PREFIX = "allBuffers_Lorca"

OUTPUT_BUILDINGS_TXT = os.path.join("inputs", "Lorca", "allBuildings_Lorca.txt")

CRS_METRIC = "EPSG:25830"
CRS_GEO    = "EPSG:4326"

# ══════════════════════════════════════════════════════════════════════════════

def compute_facade_length(geom_metric):
    if geom_metric is None or geom_metric.is_empty:
        return 0.0
    if geom_metric.geom_type in ("Polygon", "MultiPolygon"):
        if hasattr(geom_metric, "exterior"):
            return round(geom_metric.exterior.length, 2)
        else:
            return round(sum(p.exterior.length for p in geom_metric.geoms), 2)
    return 0.0

def main():
    print("=" * 60)
    print("GENERATE_BUFFERS_LORCA (OPTIMIZED) — Lorca")
    print("=" * 60)

    # 1. Cargar shapefile
    print(f"\n[1] Cargando shapefile: {INPUT_SHP}")
    if not os.path.exists(INPUT_SHP):
        sys.exit(f"ERROR: No se encontró {INPUT_SHP}")
    
    gdf_metric = gpd.read_file(INPUT_SHP)
    
    if gdf_metric.crs is None:
        gdf_metric = gdf_metric.set_crs(CRS_GEO)
    if gdf_metric.crs.to_epsg() != 25830:
        print("    Proyectando a EPSG:25830...")
        gdf_metric = gdf_metric.to_crs(CRS_METRIC)

    # Optimización: Simplificar mínimamente para acelerar cálculos espaciales
    gdf_metric['geometry'] = gdf_metric.geometry.simplify(0.02)

    # Crear Índice Espacial
    print("    Creando índice espacial (sindex)...")
    sindex = gdf_metric.sindex

    # Identificar columna REFCAT
    refcat_col = next((c for c in ["REFCAT", "RefCat", "refcat", "REF_CAT"] if c in gdf_metric.columns), None)
    if refcat_col is None:
        sys.exit("Error: No se encontró columna REFCAT.")
    
    # Índice para búsqueda rápida de geometría por REFCAT
    shp_index = {str(row[refcat_col]): row.geometry for _, row in gdf_metric.iterrows()}

    # 2. Procesar edificios
    if not os.path.exists(INPUT_TXT):
        sys.exit(f"ERROR: No se encontró {INPUT_TXT}")
    
    print(f"\n[2] Procesando edificios y calculando buffers por vecindad...")
    to_geo = Transformer.from_crs(CRS_METRIC, CRS_GEO, always_xy=True)
    
    level_features = {1: [], 2: [], 3: [], 4: []}
    all_features = []
    updated_txt_lines = []

    with open(INPUT_TXT, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
        total = len(lines)

        for i, line in enumerate(lines):
            parts = line.strip().split()
            if len(parts) < 4: continue
            
            uid, refcat = int(parts[0]), parts[3]
            facade = 0.0

            if i % 500 == 0:
                print(f"    Progreso: {i}/{total} edificios procesados...")

            if refcat in shp_index:
                geom = shp_index[refcat]
                facade = compute_facade_length(geom)
                
                for level, dist_m in BUFFER_DISTANCES.items():
                    try:
                        # Crear buffer (resolución 8 es óptima para web)
                        outer = geom.buffer(dist_m, resolution=8)
                        
                        # OPTIMIZACIÓN CLAVE: Buscamos solo vecinos que toquen el buffer
                        possible_idx = sindex.query(outer, predicate="intersects")
                        neighbors = gdf_metric.iloc[possible_idx]
                        
                        # Restamos solo las geometrías cercanas
                        union_nearby = neighbors.geometry.union_all()
                        ring = outer.difference(union_nearby)
                        
                        if not ring.is_empty:
                            ring_wgs = transform(lambda x, y: to_geo.transform(x, y), ring)
                            feat = {
                                "type": "Feature",
                                "properties": {
                                    "REFCAT": refcat, 
                                    "ID": uid, 
                                    "BUFF_DIST": float(level), 
                                    "AREA": round(ring.area, 4)
                                },
                                "geometry": mapping(ring_wgs)
                            }
                            level_features[level].append(feat)
                            all_features.append(feat)
                    except Exception as e:
                        continue
            
            # Columna 8: Reemplazamos CUSEC por Fachada calculada
            new_row = parts[:7] + [f"{facade:.2f}"]
            updated_txt_lines.append("\t".join(new_row))

    # 3. Guardar archivos
    print(f"\n[3] Guardando archivos en {OUTPUT_DIR}...")

    for level, features in level_features.items():
        out_path = os.path.join(OUTPUT_DIR, f"{OUTPUT_PREFIX}{level}.geojson")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"features": features}, f, separators=(",", ":"))
        print(f"    -> {out_path}")

    # Guardar TXT actualizado
    with open(OUTPUT_BUILDINGS_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(updated_txt_lines) + "\n")
    print(f"    -> {OUTPUT_BUILDINGS_TXT}")

    print("\nPROCESO FINALIZADO CON ÉXITO\n" + "=" * 60)

if __name__ == "__main__":
    main()