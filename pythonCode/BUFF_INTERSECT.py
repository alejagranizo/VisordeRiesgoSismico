"""
BUFF_INTERSECT.py  v7
=====================
Regla fundamental:
  El barrier_level compara el espacio OCUPADO por escombros con el espacio
  LIBRE (gap real) entre los polígonos de escombros.

  debris_m  = suma de buff_dist_m de ambos lados del par
               (para buffer-building: solo el lado con buffer)
  gap_real_m = distancia métrica entre geom_A y geom_B (o huella edificio B)

  Clasificación (3 niveles):
    Nivel 3 — ROJO    : debris_m > gap_real_m
                        Los escombros ocupan MÁS espacio que el hueco libre.
    Nivel 2 — NARANJA : debris_m <= gap_real_m  Y  gap_real_m <= 4 m
                        El hueco es estrecho (≤ 4 m) aunque los escombros no lo colapsen.
    Nivel 1 — AMARILLO: debris_m <= gap_real_m  Y  gap_real_m > 4 m
                        Paso posible; los escombros son menores que el espacio libre.

  Si gap_real_m == 0 → sin barrera (los polígonos se solapan: bloqueo físico
  ya contemplado en otro análisis; aquí no se emite marcador).

Reglas mantenidas de v6:
  * buffer-building solo si el edificio B NO tiene buffer propio.
  * Supresion por proximidad: radio DEDUP_RADIUS_M → se conserva la de mayor
    urgencia (mayor nivel).
  * Pre-filtro: el buffer debe tener visibilidad a una calle (≤ SNAP_DIST_M).

Flujo por buffer A:
  1. Recopilar candidatos B dentro de exp_max de A.
  2. Bloque A -> solo otros buffers (buffer-buffer).
  3. Bloque B -> solo edificios SIN buffer propio (buffer-building).
  4. Calcular gap real y debris_m; clasificar nivel; verificar proximidad a carretera.
  5. Emitir la barrera de mayor urgencia para A.
  6. Post-proceso: suprimir duplicados en radio DEDUP_RADIUS_M.
"""

import json
import os
import re

import geopandas as gpd
import numpy as np
from shapely.geometry import shape, Polygon, Point, MultiPoint
from shapely.strtree import STRtree
from shapely.ops import (
    transform as shp_transform,
    unary_union,
    nearest_points,
)
from pyproj import Transformer


# ── Constantes ────────────────────────────────────────────────────────────────
CRS_GEO    = "EPSG:4326"
CRS_METRIC = "EPSG:25830"

# Umbral de gap libre para distinguir naranja de amarillo
GAP_NARROW_M = 4.0   # gap <= 4 m con debris <= gap -> naranja; gap > 4 m -> amarillo

# Radio de busqueda de candidatos vecinos (metros sobre el buffer ya expandido)
MAX_SEARCH_M = 12.0

ADJACENCY_TOL_M = 1.0   # medianeras: distancia entre HUELLAS de edificio (no buffers)
SNAP_DIST_M     = 5.0   # distancia maxima del punto de barrera a la carretera
ROAD_REACH_M    = SNAP_DIST_M + MAX_SEARCH_M   # pre-filtro

# Radio de supresion por proximidad: si dos barreras estan a menos de
# esta distancia entre si, se conserva solo la de mayor urgencia (mayor nivel).
DEDUP_RADIUS_M  = 8.0

# Alias de nivel para claridad
LEVEL_RED    = 3   # rojo    — debris > gap
LEVEL_ORANGE = 2   # naranja — debris <= gap  Y  gap <= GAP_NARROW_M
LEVEL_YELLOW = 1   # amarillo— debris <= gap  Y  gap >  GAP_NARROW_M


# ── Transformadores ───────────────────────────────────────────────────────────
def _make_transformers():
    to_metric = Transformer.from_crs(CRS_GEO, CRS_METRIC, always_xy=True)
    to_geo    = Transformer.from_crs(CRS_METRIC, CRS_GEO,    always_xy=True)
    return to_metric, to_geo

def _to_metric(geom, tr): return shp_transform(tr.transform, geom)
def _to_geo   (geom, tr): return shp_transform(tr.transform, geom)


# ── Clasificacion de barrera: debris vs gap ───────────────────────────────────
def _classify_barrier(gap_m, debris_m):
    """
    Compara el espacio ocupado por escombros (debris_m) con el espacio libre
    (gap_m) para asignar el nivel de urgencia.

    Reglas:
      gap_m == 0              -> None  (sin hueco: no se emite marcador)
      debris_m > gap_m        -> LEVEL_RED    (3, rojo)
      debris_m <= gap_m  y  gap_m <= GAP_NARROW_M -> LEVEL_ORANGE (2, naranja)
      debris_m <= gap_m  y  gap_m >  GAP_NARROW_M -> LEVEL_YELLOW (1, amarillo)

    debris_m = buff_dist_A + buff_dist_B  (o solo buff_dist_A en buffer-building)
    """
    if gap_m <= 0:
        return None   # solapamiento o contacto: sin marcador de barrera
    if debris_m > gap_m:
        return LEVEL_RED
    if gap_m <= GAP_NARROW_M:
        return LEVEL_ORANGE
    return LEVEL_YELLOW


# ── Centroide del gap: punto medio entre los dos bordes más próximos ─────────
def _gap_midpoint(geom_a, geom_b):
    """
    Devuelve el punto exactamente a mitad del segmento de menor distancia
    entre geom_a y geom_b.  Este es el centroide natural del hueco (gap):
      - pt_a = punto del borde de A más cercano a B
      - pt_b = punto del borde de B más cercano a A
      - midpoint = (pt_a + pt_b) / 2  →  centro geométrico del gap

    Si los polígonos se solapan (gap = 0) devuelve el centroide de la
    intersección, que también es un punto dentro del hueco.
    """
    try:
        gap = geom_a.distance(geom_b)
        if gap <= 0:
            # Los polígonos ya se tocan o solapan: usar centroide de intersección
            inter = geom_a.intersection(geom_b)
            return inter.centroid if not inter.is_empty else geom_a.centroid
        pt_a, pt_b = nearest_points(geom_a, geom_b)
        return Point((pt_a.x + pt_b.x) / 2, (pt_a.y + pt_b.y) / 2)
    except Exception:
        return geom_a.centroid


def _closest_point_to_road(geom_a, geom_b, all_bldg_union,
                            roads_geoms, roads_tree):
    """
    Calcula el centroide del gap (punto medio entre los dos bordes más
    próximos de geom_a y geom_b) y su distancia a la carretera más cercana.

    Devuelve (punto_métrico, dist_a_carretera).
    Si no hay capa de carreteras devuelve (midpoint, None).
    """
    midpoint = _gap_midpoint(geom_a, geom_b)

    if roads_tree is None:
        return midpoint, None

    try:
        nearest_idx  = roads_tree.nearest(midpoint)
        road_geom    = roads_geoms[nearest_idx]
        dist_to_road = midpoint.distance(road_geom)
        return midpoint, dist_to_road
    except Exception:
        return midpoint, None


# ── Carga de datos ────────────────────────────────────────────────────────────
def _load_buildings_metric(edificio_js, to_metric, site):
    out = {}
    if not os.path.exists(edificio_js):
        print(f'  [{site}] AVISO: Sin huellas "{edificio_js}".')
        return out
    try:
        with open(edificio_js, "r", encoding="utf-8") as f:
            content = f.read()
        match = re.search(r'=\s*(\{.*\})', content, re.DOTALL)
        if match:
            data = json.loads(match.group(1))
            for feat in data.get("features", []):
                props = feat["properties"]
                uid = str(props.get("REFCAT") or props.get("RefCat") or
                          props.get("refcat") or "").strip()
                if uid and feat.get("geometry"):
                    out[uid] = _to_metric(shape(feat["geometry"]), to_metric)
        print(f'  [{site}] {len(out)} huellas de edificios cargadas')
    except Exception as e:
        print(f'  [{site}] Error cargando huellas: {e}')
    return out


def _load_roads(roads_shp, site):
    if not os.path.exists(roads_shp):
        print(f'  [{site}] AVISO: Sin capa de carreteras "{roads_shp}".')
        return None, None
    try:
        geoms = list(gpd.read_file(roads_shp).to_crs(CRS_METRIC).geometry)
        print(f'  [{site}] Carreteras: {len(geoms)} geometrías')
        return geoms, STRtree(geoms)
    except Exception as e:
        print(f'  [{site}] Error cargando carreteras: {e}')
        return None, None


def _load_buffers_metric(buffer_js_input, to_metric, site):
    """
    Carga los buffers de escombros (output de BUFF.py).
    Almacena la geometría original (geom_m) y una expansión máxima para
    el pre-filtro espacial de candidatos.
    """
    if not os.path.exists(buffer_js_input):
        print(f'  [{site}] ERROR: No existe "{buffer_js_input}". Ejecuta BUFF primero.')
        return []
    try:
        with open(buffer_js_input, "r", encoding="utf-8") as f:
            content = f.read()
        for prefix in [f"var json_Bufferin_{site}", "var json_Bufferin"]:
            if prefix in content:
                json_str = content[content.index(prefix):]
                json_str = json_str[json_str.index("=") + 1:].strip()
                break
        else:
            json_str = content.strip()
        data = json.loads(json_str)
    except Exception as e:
        print(f'  [{site}] Error procesando buffers: {e}')
        return []

    out = []
    for feat in data.get("features", []):
        if not feat.get("geometry"):
            continue
        props     = feat["properties"]
        refcat    = str(props.get("REFCAT") or props.get("RefCat") or
                        props.get("refcat") or "").strip()
        # BUFF_DIST es la distancia real del buffer (1-4 m según nivel de daño)
        buff_dist = float(props.get("BUFF_DIST", 1.0))
        dmg_level = int(round(buff_dist))          # 1=Slight … 4=Complete
        geom_m    = _to_metric(shape(feat["geometry"]), to_metric)

        out.append({
            "REFCAT":       refcat,
            "damage_level": dmg_level,
            "buff_dist_m":  buff_dist,             # distancia real del buffer
            "geom_m":       geom_m,
            # Expansión máxima para pre-filtro: MAX_SEARCH_M adicionales sobre el buffer real
            "exp_max":      geom_m.buffer(MAX_SEARCH_M),
        })

    print(f'  [{site}] {len(out)} buffers cargados')
    return out


# ── Pre-filtro: el buffer tiene visibilidad hacia alguna calle ────────────────
def _buffer_reaches_road(geom_m, roads_geoms, roads_tree,
                         all_bldg_union, reach_m=ROAD_REACH_M):
    if roads_tree is None:
        return True
    try:
        free = geom_m.difference(all_bldg_union)
    except Exception:
        free = geom_m
    if free.is_empty:
        return False
    for idx in roads_tree.query(free.buffer(reach_m)):
        if free.distance(roads_geoms[idx]) <= reach_m:
            return True
    return False


# ── Evaluación de un par (A, B) ───────────────────────────────────────────────
def _eval_pair(geom_a, geom_b, all_bldg_union, roads_geoms, roads_tree, debris_m):
    """
    Calcula el gap real entre las geometrías originales de A y B.
    debris_m = espacio total ocupado por escombros en el corredor (buff_dist_A + buff_dist_B).
    Devuelve (nivel, punto_métrico, dist_a_carretera, gap_m) o None.

    - Si gap_m == 0  → None (solapamiento; sin marcador)
    - Nivel asignado por _classify_barrier(gap_m, debris_m)
    """
    try:
        gap_m = geom_a.distance(geom_b)
    except Exception:
        return None

    lvl = _classify_barrier(gap_m, debris_m)
    if lvl is None:
        return None   # gap == 0 o sin nivel asignable

    pt_m, dist_road = _closest_point_to_road(
        geom_a, geom_b, all_bldg_union, roads_geoms, roads_tree
    )

    if pt_m is None:
        return None
    if dist_road is not None and dist_road > SNAP_DIST_M:
        return None   # el gap no está junto a una calle accesible

    return lvl, pt_m, dist_road, gap_m


# ── Función principal ─────────────────────────────────────────────────────────
def Compute_Barriers(cfg):
    site       = cfg['site']
    outputpath = cfg['outputpath']
    print(f'\n[{site}] Compute_Barriers v7 (debris vs gap, dedup {DEDUP_RADIUS_M} m, buffer-building solo sin buffer propio)')

    buffer_js   = os.path.join(outputpath, cfg['final_buffer_filename'])
    output_path = os.path.join(outputpath, cfg['final_barriers_filename'])

    edificio_js = os.path.join("..", "public", "newData", f"EdificioEnd_{site}.js")
    if not os.path.exists(edificio_js):
        edificio_js = os.path.join("..", "public", "newData", "EdificioEnd.js")

    roads_shp = os.path.join(cfg['inputpath'], cfg.get('subfolder', ''), "Roads.shp")
    if not os.path.exists(roads_shp):
        roads_shp = os.path.join("inputs", "Roads_RegionMurcia.shp")

    to_metric, to_geo       = _make_transformers()
    buildings_m             = _load_buildings_metric(edificio_js, to_metric, site)
    roads_geoms, roads_tree = _load_roads(roads_shp, site)
    buffers                 = _load_buffers_metric(buffer_js, to_metric, site)

    if not buffers:
        print(f'  [{site}] Sin buffers — daño nulo o terremoto lejano. Escribiendo archivo vacio.')
        _write_output([], output_path, site)
        return

    print(f'  [{site}] Calculando unión de huellas de edificios...')
    all_bldg_union = unary_union(list(buildings_m.values())) if buildings_m else Polygon()

    # Pre-filtro: descartar buffers sin salida a calle
    print(f'  [{site}] Pre-filtrando buffers sin visibilidad a calles...')
    n_before = len(buffers)
    buffers  = [b for b in buffers
                if _buffer_reaches_road(b["geom_m"], roads_geoms, roads_tree,
                                        all_bldg_union)]
    print(f'  [{site}] Buffers con visibilidad: {len(buffers)}/{n_before} '
          f'({n_before - len(buffers)} tapados descartados)')

    if not buffers:
        print(f'  [{site}] Ningún buffer llega a la calle. Sin barreras.')
        _write_output([], output_path, site)
        return

    # Árboles espaciales
    buf_tree   = STRtree([b["exp_max"] for b in buffers])
    bldg_keys  = list(buildings_m.keys())
    bldg_geoms = [buildings_m[k] for k in bldg_keys]
    bldg_tree  = STRtree(bldg_geoms) if bldg_geoms else None

    results       = []
    seen_pos      = set()
    emitted_pairs = set()   # evitar duplicados simétricos A-B / B-A
    buf_emitted   = [False] * len(buffers)

    # REFCATs que tienen buffer propio: se excluyen del bloque buffer-building
    refcats_with_buffer = {b['REFCAT'] for b in buffers}

    stats = {
        'barriers':  0,
        'adjacent':  0,
        'no_road':   0,
        'no_inter':  0,
        'gap_too_large': 0,
    }

    print(f'  [{site}] Calculando barreras (debris vs gap)...')

    for i, a in enumerate(buffers):

        # ── Recopilar todos los candidatos válidos para A ─────────────────
        # best = (lvl, gap_m, dist_road, pt_m, refcat_b, dmg_b, btype, debris_m_val)
        # Mayor urgencia = mayor nivel (3 > 2 > 1); en empate, mayor gap gana (más escombros)
        best = None

        def _is_better(lvl, gap_m, dist_road):
            """True si (lvl, gap_m) es más urgente que best actual."""
            if best is None:
                return True
            if lvl > best[0]:
                return True
            if lvl == best[0]:
                # Mismo nivel: desempate por gap_m descendente (más escombros relativo)
                if gap_m < best[1]:
                    return True
                if gap_m == best[1] and dist_road is not None and \
                        (best[2] is None or dist_road < best[2]):
                    return True
            return False

        # A) otros buffers de escombros
        for j in buf_tree.query(a["exp_max"]):
            if j <= i:
                continue
            b = buffers[j]
            if a["REFCAT"] == b["REFCAT"]:
                continue
            pair = tuple(sorted([a["REFCAT"], b["REFCAT"]]))
            if pair in emitted_pairs:
                continue

            # Comprobar medianera (huellas de edificio demasiado juntas)
            bm_a = buildings_m.get(a["REFCAT"])
            bm_b = buildings_m.get(b["REFCAT"])
            if bm_a and bm_b and bm_a.distance(bm_b) < ADJACENCY_TOL_M:
                stats['adjacent'] += 1
                continue

            debris_m_val = a["buff_dist_m"] + b["buff_dist_m"]
            result = _eval_pair(a["geom_m"], b["geom_m"],
                                 all_bldg_union, roads_geoms, roads_tree,
                                 debris_m_val)
            if result is None:
                stats['no_road'] += 1
                continue

            lvl, pt_m, dist_road, gap_m = result
            if _is_better(lvl, gap_m, dist_road):
                best = (lvl, gap_m, dist_road, pt_m,
                        b["REFCAT"], b["damage_level"], "buffer-buffer", debris_m_val)

        # B) edificios vecinos (solo si aún no hay nivel rojo)
        if bldg_tree is not None and (best is None or best[0] < LEVEL_RED):
            for j in bldg_tree.query(a["exp_max"]):
                bldg_refcat = bldg_keys[j]
                if bldg_refcat == a["REFCAT"]:
                    continue
                pair = tuple(sorted([a["REFCAT"], bldg_refcat]))
                if pair in emitted_pairs:
                    continue
                bm_a = buildings_m.get(a["REFCAT"])
                bm_b = buildings_m.get(bldg_refcat)
                if bm_a and bm_b and bm_a.distance(bm_b) < ADJACENCY_TOL_M:
                    stats['adjacent'] += 1
                    continue

                # v6: si el edificio B tiene buffer propio, ya se evalua como buffer-buffer
                if bldg_refcat in refcats_with_buffer:
                    continue

                # buffer-building: solo el buffer de A cuenta como escombros
                debris_m_val = a["buff_dist_m"]
                result = _eval_pair(a["geom_m"], bldg_geoms[j],
                                     all_bldg_union, roads_geoms, roads_tree,
                                     debris_m_val)
                if result is None:
                    stats['no_road'] += 1
                    continue

                lvl, pt_m, dist_road, gap_m = result
                if _is_better(lvl, gap_m, dist_road):
                    best = (lvl, gap_m, dist_road, pt_m,
                            bldg_refcat, 0, "buffer-building", debris_m_val)

        # ── Emitir la mejor barrera para A (si existe) ────────────────────
        if best is None:
            stats['no_inter'] += 1
            continue

        lvl, gap_m, dist_road, pt_m, refcat_b, dmg_b, btype, debris_m_val = best
        pair = tuple(sorted([a["REFCAT"], refcat_b]))
        emitted_pairs.add(pair)
        buf_emitted[i] = True

        pt_geo  = _to_geo(pt_m, to_geo)
        pos_key = (round(pt_geo.y, 5), round(pt_geo.x, 5))

        if pos_key not in seen_pos:
            seen_pos.add(pos_key)
            results.append({
                "centroid":       [pt_geo.y, pt_geo.x],
                "building_ids":   [a["REFCAT"], refcat_b],
                # damage_levels = niveles de daño sísmico de cada edificio
                "damage_levels":  [a["damage_level"], dmg_b],
                # buff_dist_m = distancias reales de buffer de cada lado
                "buff_dist_m":    [a["buff_dist_m"],
                                   next((b["buff_dist_m"] for b in buffers
                                         if b["REFCAT"] == refcat_b), None)
                                   if btype == "buffer-buffer" else None],
                # debris_m = espacio total de escombros en el corredor
                "debris_m":       round(debris_m_val, 3),
                # barrier_level: 3=rojo, 2=naranja, 1=amarillo
                "barrier_level":  lvl,
                # gap_real_m = espacio libre medido entre los dos polígonos
                "gap_real_m":     round(gap_m, 3),
                "barrier_type":   btype,
                "dist_to_road_m": round(dist_road, 2) if dist_road is not None else None,
                "site":           site,
            })
            stats['barriers'] += 1


    # ── Supresion por proximidad (dedup espacial) ───────────────────────────
    # Ordena por barrier_level desc (mayor urgencia primero, 3 > 2 > 1),
    # luego por gap_m asc como desempate, y descarta cualquier barrera cuyo
    # centroide este a < DEDUP_RADIUS_M de una ya aceptada.
    if results:
        print(f'  [{site}] Supresion por proximidad ({DEDUP_RADIUS_M} m)...')
        results_sorted = sorted(results,
                                key=lambda r: (-r['barrier_level'], r['gap_real_m']))
        accepted       = []
        accepted_pts   = []  # puntos metricos de barreras aceptadas
        for r in results_sorted:
            pt_geo = Point(r['centroid'][1], r['centroid'][0])  # lon, lat
            pt_m   = _to_metric(pt_geo, to_metric)
            too_close = any(pt_m.distance(ap) < DEDUP_RADIUS_M for ap in accepted_pts)
            if not too_close:
                accepted.append(r)
                accepted_pts.append(pt_m)
        n_removed = len(results) - len(accepted)
        print(f'  [{site}] Dedup: {len(results)} -> {len(accepted)} ')
        if n_removed:
            print(f'  [{site}]   ({n_removed} barreras suprimidas por proximidad)')
        results = accepted

    # ── Resumen final (post-dedup) ────────────────────────────────────────────
    level_names = {LEVEL_RED: 'ROJO    (debris > gap)',
                   LEVEL_ORANGE: 'NARANJA (debris<=gap, gap<=4m)',
                   LEVEL_YELLOW: 'AMARILLO(debris<=gap, gap>4m)'}
    print(f'\n  [{site}] -- Resumen final --')
    for lvl in [LEVEL_RED, LEVEL_ORANGE, LEVEL_YELLOW]:
        bb  = sum(1 for r in results
                  if r['barrier_level'] == lvl and r['barrier_type'] == 'buffer-buffer')
        bbl = sum(1 for r in results
                  if r['barrier_level'] == lvl and r['barrier_type'] == 'buffer-building')
        print(f'  [{site}]   Nivel {lvl} {level_names[lvl]}: '
              f'{bb} buf-buf  |  {bbl} buf-edificio')
    print(f'  [{site}]   TOTAL barreras      : {len(results)}')
    print(f'  [{site}]   Adyacentes (skip)   : {stats["adjacent"]}')
    print(f'  [{site}]   Sin acceso a calle  : {stats["no_road"]}')
    print(f'  [{site}]   Sin candidatos      : {stats["no_inter"]}')

    _write_output(results, output_path, site)
    print(f'  [{site}] Guardado en "{output_path}"')


def _write_output(results, output_path, site):
    os.makedirs(
        os.path.dirname(output_path) if os.path.dirname(output_path) else '.',
        exist_ok=True,
    )
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f'var barrierData_{site} = ')
        json.dump(results, f, indent=2)
        f.write(';\n')


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    from info import get_location_config
    import sys
    site = sys.argv[1] if len(sys.argv) > 1 else 'LORCA'
    Compute_Barriers(get_location_config(site))