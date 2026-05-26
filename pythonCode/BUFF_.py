#!/usr/bin/env python3
# BUFF_.py — Fusiona geometría + resultados en un JS por municipio
# No genera ningún archivo combinado ni ningún cálculo de buffer.

import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import json, os, re
from pyproj import Transformer
from info_ import (outputpath, js_data_dir, sscc_js, sscc_js_pl)

# ---------------------------------------------------------------------------
# CONFIGURACIÓN DE MUNICIPIOS
# Para añadir uno nuevo: añadir entrada aquí + <script> en map_.html
# ---------------------------------------------------------------------------
MUNICIPIOS = [
    {
        "id":          "Lorca",
        "archivo":     sscc_js,            # geometría en public/newData/
        "reproyectar": False,              # SSCCEnd_Completo.js ya está en WGS84
        "var_name":    "json_SeccionesLorca",
        "result_file": "resultSSCC_Lorca.js",   # generado por RISK_.py
        "output_file": "Secciones_Lorca.js",    # servido por Express
    },
    {
        "id":          "PuertoLumbreras",
        "archivo":     sscc_js_pl,
        "reproyectar": False,              # ya en WGS84
        "var_name":    "json_SeccionesPL",
        "result_file": "resultSSCC_PuertoLumbreras.js",
        "output_file": "Secciones_PuertoLumbreras.js",
    },
    # Para añadir un tercer municipio:
    # {
    #     "id":          "Aguilas",
    #     "archivo":     "SSCCEnd_AG.js",
    #     "reproyectar": False,
    #     "var_name":    "json_SeccionesAguilas",
    #     "result_file": "resultSSCC_Aguilas.js",
    #     "output_file": "Secciones_Aguilas.js",
    # },
]

# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------
transformer = Transformer.from_crs("EPSG:25830", "EPSG:4326", always_xy=True)

def reproject(coords):
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        lng, lat = transformer.transform(coords[0], coords[1])
        return [round(lng, 7), round(lat, 7)]
    return [reproject(c) for c in coords]

def strip_js_var(raw):
    raw = raw.strip()
    raw = re.sub(r"^\s*var\s+\w+\s*=\s*", "", raw)
    raw = re.sub(r"\s*;\s*$", "", raw)
    return raw.strip()

def clean_cusec(raw):
    return str(raw).strip().replace("\r", "").replace("\n", "")

def load_results_for(result_file):
    """Carga resultSSCC_<municipio>.js y devuelve dict {cusec: registro}."""
    ruta = os.path.join(outputpath, result_file)
    if not os.path.exists(ruta):
        raise FileNotFoundError(
            f"No se encuentra {ruta}\n"
            "Asegúrate de que RISK_.py se ejecutó correctamente antes de BUFF_.py."
        )
    with open(ruta, "r", encoding="utf-8") as f:
        content = strip_js_var(f.read())
    data = json.loads(content)
    return {clean_cusec(d["CUSEC"]): d for d in data}

def load_sscc_js(filepath, localidad, reproject_utm=False):
    if not os.path.exists(filepath):
        print(f"  Aviso: no se encuentra {filepath}")
        return None
    with open(filepath, "r", encoding="utf-8") as f:
        content = strip_js_var(f.read())
    data = json.loads(content)
    for feat in data.get("features", []):
        if "properties" not in feat:
            feat["properties"] = {}
        feat["properties"]["localidad"] = localidad
        if reproject_utm and feat.get("geometry"):
            feat["geometry"]["coordinates"] = reproject(
                feat["geometry"]["coordinates"]
            )
    return data

def merge_results(feat, resultados, localidad_id):
    """Inyecta los resultados de RISK_ en las propiedades del feature GeoJSON."""
    props = feat["properties"]
    cusec = clean_cusec(props.get("CUSEC", ""))
    res   = resultados.get(cusec)

    if res:
        props["NumEdif"]      = res.get("NumEdif",  props.get("Num_Edif", 0))
        props["Vs30"]         = res.get("Vs30",  0)
        props["Rjb"]          = res.get("Rjb",   0)
        props["dMean"]        = res.get("dMean", 0.0)
        props["DamageTotals"] = res.get("DamageTotals", {})
        props["Resultados"]   = res.get("Resultados",   {})
    else:
        props["NumEdif"]      = props.get("Num_Edif", 0)
        props["Vs30"]         = 0
        props["dMean"]        = 0.0
        props["DamageTotals"] = {}
        props["Resultados"]   = {}

    props["localidad"] = localidad_id

# ---------------------------------------------------------------------------
# Función principal
# ---------------------------------------------------------------------------

def generar_archivos():
    print("=" * 60)
    print("BUFF_.py — iniciando")
    print("=" * 60)
    print(f"Geometrías desde: {js_data_dir}")
    os.makedirs(outputpath, exist_ok=True)

    for mun in MUNICIPIOS:
        print(f"\n── {mun['id']} ──")

        # 1. Cargar resultados de RISK_
        try:
            dict_resultados = load_results_for(mun["result_file"])
            print(f"  {len(dict_resultados)} CUSECs con resultados")
        except Exception as e:
            print(f"  Error: {e}")
            continue

        # 2. Cargar geometría
        path_in = os.path.join(js_data_dir, mun["archivo"])
        geojson = load_sscc_js(path_in, mun["id"], reproject_utm=mun["reproyectar"])
        if not geojson:
            continue

        # 3. Merge
        con_res = 0
        for feat in geojson.get("features", []):
            merge_results(feat, dict_resultados, mun["id"])
            if feat["properties"].get("Resultados"):
                con_res += 1

        total = len(geojson["features"])
        print(f"  Secciones: {total} total | {con_res} con resultados de riesgo")

        # 4. Guardar JS individual
        ruta_out = os.path.join(outputpath, mun["output_file"])
        # IMPORTANTE: Borrar el archivo anterior si existe (evita que quede bloqueado)
        if os.path.exists(ruta_out):
            try:
                os.remove(ruta_out)
                print(f"  Archivo anterior borrado: {mun['output_file']}")
            except Exception as e:
                print(f"  Aviso: No se pudo borrar archivo anterior: {e}")
        
        with open(ruta_out, "w", encoding="utf-8") as f:
            f.write(f"var {mun['var_name']} = ")
            json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
            f.write(";")
        print(f"  Generado NUEVO: {mun['output_file']}")

    print("\nBUFF_.py — finalizado")

if __name__ == "__main__":
    generar_archivos()