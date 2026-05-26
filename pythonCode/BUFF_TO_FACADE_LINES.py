"""
BUFF_TO_FACADE_LINES.py
Extrae segmentos de fachada exterior (los que dan a la calle) de cada edificio
y genera 8 shapefiles: 4 de líneas + 4 de puntos centrales, uno por nivel BUFF_DIST.

Flujo:
  1. unary_union de todos los edificios → agrupa bloques contiguos y entierra medianeras.
  2. street_boundary: se conservan SOLO los anillos exteriores del union, descartando
     los interiores (patios). Así ni medianeras ni patios contaminan la extracción.
  3. Cierre morfológico buffer(+r).buffer(-r) sobre el union → manzanas sintéticas.
     Rellena patios con gap pequeño entre edificios (los que el union no cerró).
     Se usa únicamente como filtro de respaldo, no para la intersección.
  4. Para cada edificio: segs = edificio.boundary ∩ street_boundary.
  5. Filtro de respaldo: descarta segmentos cuyo midpoint esté dentro de una manzana
     sintética erosionada Y a más de BOUNDARY_TOLERANCE m del street_boundary.

Columnas de salida: geometry | BLDG_ID | REFCAT | BUFF_DIST | SEG_LEN
"""

import os
import geopandas as gpd
from shapely.ops import unary_union
from shapely.geometry import LineString

# ── Configuración ──────────────────────────────────────────────────────────────
INPUT_SHP     = os.path.join("inputs","Lorca", "shapefiles", "EdificiosLorca2026.shp")
OUTPUT_DIR    = os.path.join("output", "facade_lines")

INPUT_CRS     = "EPSG:4326"
PROJECTED_CRS = "EPSG:25830"  # UTM 30N – necesario para operar en metros

CLOSING_RADIUS     = 2.0   # m – tamaño máximo de gap/patio cerrado por el cierre morfológico
MANZANAS_EROSION   = 1.0   # m – erosión sobre manzanas sintéticas para el filtro de respaldo
BOUNDARY_TOLERANCE = 0.5   # m – un segmento dentro de la manzana se conserva si está a menos de esto del street_boundary
SIMPLIFY_TOL       = 0.15  # m – simplificación tras la intersección (0 = desactiva)
MIN_SEG_LEN        = 0.20  # m – longitud mínima de segmento
# ──────────────────────────────────────────────────────────────────────────────


def extract_linestrings(geom):
    if geom is None or geom.is_empty:
        return []
    t = geom.geom_type
    if t == "LineString":
        return [geom]
    if t == "MultiLineString":
        return list(geom.geoms)
    if t == "LinearRing":
        return [LineString(geom.coords)]
    if t == "GeometryCollection":
        out = []
        for g in geom.geoms:
            out.extend(extract_linestrings(g))
        return out
    return []


def iter_polygons(geom):
    if geom is None or geom.is_empty:
        return
    if geom.geom_type == "Polygon":
        yield geom
    elif geom.geom_type == "MultiPolygon":
        for p in geom.geoms:
            yield p
    elif geom.geom_type == "GeometryCollection":
        for g in geom.geoms:
            yield from iter_polygons(g)


def build_street_boundary(raw_union):
    """Unión de los anillos exteriores del union. Descarta interiores (patios)."""
    rings = [LineString(poly.exterior.coords) for poly in iter_polygons(raw_union)]
    n_patios = sum(len(poly.interiors) for poly in iter_polygons(raw_union))
    return unary_union(rings), n_patios


def build_eroded_blocks(raw_union, closing_radius, erosion):
    """Manzanas sintéticas erosionadas para el filtro de respaldo."""
    blocks = []
    for poly in iter_polygons(raw_union):
        closed = poly.buffer(closing_radius).buffer(-closing_radius)
        for block in iter_polygons(closed):
            if not block.is_empty:
                blocks.append(block.buffer(-erosion))
    return unary_union([b for b in blocks if not b.is_empty])


def extract_segments(bldg_geom, street_boundary):
    segs = []
    for line in extract_linestrings(bldg_geom.boundary.intersection(street_boundary)):
        s = line.simplify(SIMPLIFY_TOL, preserve_topology=True) if SIMPLIFY_TOL > 0 else line
        for seg in extract_linestrings(s or line):
            if seg.length >= MIN_SEG_LEN:
                segs.append(seg)
    return segs


def main():
    print(f"Leyendo: {INPUT_SHP}")
    os.environ["SHAPE_RESTORE_SHX"] = "YES"
    gdf = gpd.read_file(INPUT_SHP)
    print(f"  {len(gdf)} edificios  |  CRS: {gdf.crs}")

    if gdf.crs is None:
        gdf = gdf.set_crs(INPUT_CRS)
    if not gdf.crs.is_projected:
        gdf = gdf.to_crs(PROJECTED_CRS)
        print(f"  Reproyectado a {PROJECTED_CRS}")

    print("\n[1] unary_union de edificios...")
    raw_union = unary_union(gdf.geometry)

    print("[2] Construyendo street_boundary (solo anillos exteriores)...")
    street_boundary, n_patios = build_street_boundary(raw_union)
    print(f"    Anillos de patio descartados: {n_patios}")

    print(f"[3] Manzanas sintéticas erosionadas "
          f"(closing={CLOSING_RADIUS} m, erosion={MANZANAS_EROSION} m)...")
    eroded_union = build_eroded_blocks(raw_union, CLOSING_RADIUS, MANZANAS_EROSION)

    print("[4] Extrayendo segmentos (edificio.boundary ∩ street_boundary)...")
    rows, skipped = [], 0
    for _, row in gdf.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            skipped += 1
            continue
        segs = extract_segments(geom, street_boundary)
        if not segs:
            skipped += 1
            continue
        for seg in segs:
            rows.append({
                "geometry": seg,
                "BLDG_ID":  int(row["ID"]),
                "REFCAT":   row["REFCAT"],
                "SEG_LEN":  round(seg.length, 3),
            })
    print(f"    Candidatos: {len(rows)}  |  Edificios sin fachada: {skipped}")

    print(f"[5] Filtro de respaldo (tolerancia={BOUNDARY_TOLERANCE} m)...")
    kept, removed = [], 0
    for row in rows:
        mid = row["geometry"].interpolate(0.5, normalized=True)
        if eroded_union.contains(mid) and mid.distance(street_boundary) > BOUNDARY_TOLERANCE:
            removed += 1
        else:
            kept.append(row)
    rows = kept
    print(f"    Eliminados: {removed}  |  Conservados: {len(rows)}")

    if not rows:
        print("ERROR: No se generaron segmentos.")
        return

    base_lines  = gpd.GeoDataFrame(rows, crs=gdf.crs)
    base_points = gpd.GeoDataFrame([
        {"geometry": r["geometry"].interpolate(0.5, normalized=True),
         "BLDG_ID": r["BLDG_ID"], "REFCAT": r["REFCAT"], "SEG_LEN": r["SEG_LEN"]}
        for r in rows
    ], crs=gdf.crs)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    names = {1: "Slight", 2: "Moderate", 3: "Extensive", 4: "Complete"}
    print()
    for level in [1, 2, 3, 4]:
        for base, kind, fname in [
            (base_lines,  "líneas",  f"facade_lines_d{level}.shp"),
            (base_points, "puntos",  f"facade_points_d{level}.shp"),
        ]:
            out = base.copy()
            out["BUFF_DIST"] = level
            cols = ["geometry", "BLDG_ID", "REFCAT", "BUFF_DIST", "SEG_LEN"]
            path = os.path.join(OUTPUT_DIR, fname)
            out[cols].to_file(path)
            print(f"  d{level} {names[level]:10s} {kind:6s} → {path}")

    print(f"\nFinalizado. {len(rows)} fachadas en {OUTPUT_DIR}")


if __name__ == "__main__":
    main()