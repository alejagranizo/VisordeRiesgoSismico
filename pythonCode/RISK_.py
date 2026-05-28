#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# RISK_.py — Cálculo de daño sísmico por sección censal
#
# Flujo:
#   1. Lee fault_params.json (escrito por routes/data.js con los params del terremoto elegido)
#   2. Procesa Lorca y Puerto Lumbreras usando sus respectivos shapefiles y TXTs
#   3. Genera resultSSCC_Lorca.js y resultSSCC_PuertoLumbreras.js en pythonCode/output/

import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import os
import json
import math
import shapefile
import pandas as pd
import numpy as np
from math import pi, sqrt, log
from collections import defaultdict
from scipy.stats import norm
from scipy.interpolate import interp1d
from shapely.geometry import shape
import pygmm

from info_ import (inputpath, outputpath,
                   secciones_shp, secciones_shp_pl,
                   final_result_filename)

PARAMS_XLSX      = os.path.join(inputpath, "params.xlsx")
FAULT_JSON       = os.path.join(inputpath, "fault_params.json")
BUILDINGS_TXT    = os.path.join(inputpath, "allBuildings_cusec.txt")
BUILDINGS_TXT_PL = os.path.join(inputpath, "allBuildings_cusec_PL.txt")
BEDROCK_VS30     = 760

# ---------------------------------------------------------------------------
# Configuración de municipios
# Para añadir uno nuevo: añadir entrada aquí y en BUFF_.py y map_.html
# ---------------------------------------------------------------------------
MUNICIPIOS_RISK = [
    {
        "id":          "Lorca",
        "shp":         secciones_shp,
        "buildings":   BUILDINGS_TXT,
        "vs30_field":  "Max_Id",
        "result_file": "resultSSCC_Lorca.js",
        "result_var":  "excelData",
    },
    {
        "id":          "PuertoLumbreras",
        "shp":         secciones_shp_pl,
        "buildings":   BUILDINGS_TXT_PL,
        "vs30_field":  "Max_Id",       # campo confirmado en SSCC_PLum.dbf
        "result_file": "resultSSCC_PuertoLumbreras.js",
        "result_var":  "excelData",
    },
    # Para añadir un tercer municipio:
    # {
    #     "id":          "Aguilas",
    #     "shp":         "SSCC_Aguilas.shp",
    #     "buildings":   os.path.join(inputpath, "allBuildings_cusec_AG.txt"),
    #     "vs30_field":  "Max_Id",
    #     "result_file": "resultSSCC_Aguilas.js",
    #     "result_var":  "excelData",
    # },
]

# ---------------------------------------------------------------------------
# Carga de edificios
# ---------------------------------------------------------------------------

def clean_cusec(raw):
    return str(raw).strip().replace("\r", "").replace("\n", "")

def load_buildings_file(filepath):
    """
    Lee un archivo de edificios: col[6]=vul_code, col[-1]=CUSEC.

    Formatos soportados:
      - 9 columnas separadas por TAB (Lorca): idx lng lat REFCAT nplants year vul_code col7 CUSEC
        Las columnas pueden estar vacías (edificios sin vul_code válido).
      - 8 columnas separadas por ESPACIO (PuertoLumbreras): idx lng lat REFCAT nplants year vul_code CUSEC

    El separador se autodetecta en la primera línea válida.
    Solo se almacenan edificios con vul_code válido (no vacío, no 'none', no 'nan').
    """
    cusec_vuls = defaultdict(lambda: defaultdict(int))
    if not os.path.exists(filepath):
        print(f"  Warning: {filepath} no encontrado, omitiendo.")
        return cusec_vuls

    # Autodetectar separador
    sep = None
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                sep = "\t" if "\t" in line else " "
                break

    count = 0
    count_no_vul = 0
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split(sep)
            if sep == " ":
                parts = [p for p in parts if p]

            n = len(parts)
            if n < 8:
                continue

            if sep == "\t":
                if n < 9:
                    continue
                vul_code = parts[6].strip()
                cusec    = clean_cusec(parts[8])
            else:
                vul_code = parts[6].strip()
                cusec    = clean_cusec(parts[7])

            if not cusec:
                continue

            count += 1
            if vul_code and vul_code.lower() not in ("none", "nan", "-", ""):
                cusec_vuls[cusec][vul_code] += 1
            else:
                count_no_vul += 1

    print(f"  {count} edificios leídos de {os.path.basename(filepath)}")
    print(f"  {len(cusec_vuls)} CUSECs únicos")
    if count_no_vul:
        print(f"  {count_no_vul} edificios sin vul_code (excluidos del cálculo de daño)")
    return cusec_vuls

# ---------------------------------------------------------------------------
# Vulnerabilidad
# ---------------------------------------------------------------------------

def load_vul_table():
    df = pd.read_excel(PARAMS_XLSX, sheet_name="vulcode", index_col=0)
    return {col: df[col].to_dict() for col in df.columns}

# ---------------------------------------------------------------------------
# Suelo / sísmica
# ---------------------------------------------------------------------------

def nehrp_class(vs30):
    if vs30 <= 180:    return "E"
    elif vs30 <= 360:  return "D"
    elif vs30 <= 760:  return "C"
    elif vs30 <= 1500: return "B"
    else:              return "A"

def effective_displacement(vs30, te, sa_gal, ay):
    soil = nehrp_class(vs30)
    if soil in ("A", "B"): a = 130
    elif soil == "C":      a = 90
    else:                  a = 60
    sd_elastic = sa_gal * (te / (2 * pi))**2
    # C1/C2 son correcciones de inelasticidad: solo aplican cuando SA > ay
    # (el edificio supera su límite elástico). Si SA <= ay, respuesta elástica pura.
    if sa_gal <= ay:
        return sd_elastic
    C1 = 1 + ((sa_gal - ay) / (a * ay * te**2))
    C2 = 1 + ((sa_gal - ay)**2 / (800 * ay**2 * te**2))
    return C1 * C2 * sd_elastic

def calc_damage(r, vs30, vul_code, mag, mechanism, scenario, vul_table, num_edif_vul):
    vs30 = min(vs30, 1200)
    params = vul_table.get(vul_code)
    if params is None:
        return None

    te = 2 * pi * sqrt((0.01 * float(params["Dy"])) / (float(params["ay"]) * 9.81))

    s_Rock = pygmm.model.Scenario(dist_jb=r, mag=mag, mechanism=mechanism, v_s30=760)
    m_Rock = pygmm.AkkarSandikkayaBommer2014(s_Rock)
    s      = pygmm.model.Scenario(dist_jb=r, mag=mag, mechanism=mechanism, v_s30=vs30)
    m      = pygmm.AkkarSandikkayaBommer2014(s)

    if scenario == 0:
        interpol = interp1d(m.periods, m.spec_accels)
        pga_Soil = float(m.pga)
        pga_Rock = float(m_Rock.pga)
    else:
        interpol = interp1d(m.periods, np.exp(np.log(m.spec_accels) + m.ln_stds))
        pga_Soil = float(np.exp(np.log(m.pga) + m.ln_std_pga))
        pga_Rock = float(np.exp(np.log(m_Rock.pga) + m_Rock.ln_std_pga))

    sa_te_gal = float(interpol(te)) * 9.81 * 100
    ay        = float(params["ay"]) * 9.81 * 100
    sd        = effective_displacement(vs30, te, max(sa_te_gal, 0.001), ay)

    sd_low = float(params["sd_lev"]); sig_low = float(params["sigma_sd_lev"])
    sd_mod = float(params["sd_mod"]); sig_mod = float(params["sigma_sd_mod"])
    sd_ext = float(params["sd_ex"]);  sig_ext = float(params["sigma_sd_ex"])
    sd_com = float(params["sd_com"]); sig_com = float(params["sigma_sd_com"])

    p_com = norm.cdf((1/sig_com) * log(sd/sd_com))
    p_ext = norm.cdf((1/sig_ext) * log(sd/sd_ext)) - p_com
    p_mod = norm.cdf((1/sig_mod) * log(sd/sd_mod)) - p_com - p_ext
    p_low = norm.cdf((1/sig_low) * log(sd/sd_low)) - p_com - p_ext - p_mod
    p_nul = 1 - p_com - p_ext - p_mod - p_low
    d_mean = p_low*1 + p_mod*2 + p_ext*3 + p_com*4

    return {
        "numEdif": num_edif_vul,
        "pgaRock": round(pga_Rock * 100, 4),
        "pgaSoil": round(pga_Soil * 100, 4),
        "sd":      round(float(sd), 4),
        "dMean":   round(float(d_mean), 4),
        "pNull":   round(float(p_nul), 4),
        "pLow":    round(float(p_low), 4),
        "pMod":    round(float(p_mod), 4),
        "pExt":    round(float(p_ext), 4),
        "pCom":    round(float(p_com), 4),
    }

# ---------------------------------------------------------------------------
# Falla y parámetros del terremoto
# ---------------------------------------------------------------------------

def load_fault_params():
    """
    Lee fault_params.json (escrito por routes/data.js con los parámetros
    del terremoto que el usuario seleccionó en el primer mapa).
    """
    if not os.path.exists(FAULT_JSON):
        raise FileNotFoundError(
            f"fault_params.json no encontrado en {FAULT_JSON}\n"
            "El usuario debe seleccionar un terremoto en el primer mapa."
        )
    with open(FAULT_JSON, "r", encoding="utf-8") as f:
        p = json.load(f)

    print(f"  Terremoto cargado: ID={p.get('Id','?')} | "
          f"M={p.get('mag','?')} | FM={p.get('mechanism','?')} | "
          f"Scenario={p.get('scenario',0)} | "
          f"lat={p.get('lat','?')} lng={p.get('lng','?')}")
    return p

# ---------------------------------------------------------------------------
# Redondeo proporcional exacto para DamageTotals
# ---------------------------------------------------------------------------

def compute_damage_totals(resultados_vul, num_edif):
    dmgNull = dmgLow = dmgMod = dmgExt = dmgCom = 0.0
    for v in resultados_vul.values():
        n = v["numEdif"]
        dmgNull += v["pNull"] * n
        dmgLow  += v["pLow"]  * n
        dmgMod  += v["pMod"]  * n
        dmgExt  += v["pExt"]  * n
        dmgCom  += v["pCom"]  * n

    raw_vals = [("dmgNull", dmgNull), ("dmgLow", dmgLow),
                ("dmgMod", dmgMod), ("dmgExt", dmgExt), ("dmgCom", dmgCom)]
    floors    = {k: int(math.floor(v)) for k, v in raw_vals}
    fracs     = {k: v - floors[k]       for k, v in raw_vals}
    remaining = num_edif - sum(floors.values())
    rounded   = floors.copy()

    if remaining > 0:
        order = sorted(fracs, key=lambda k: fracs[k], reverse=True)
        i = 0
        while remaining > 0:
            rounded[order[i]] += 1
            remaining -= 1
            i = (i + 1) % len(order)
    return rounded

# ---------------------------------------------------------------------------
# Procesado de un shapefile
# ---------------------------------------------------------------------------

def process_shapefile(shp_path, localidad, cusec_vuls, vul_table,
                      fault_proj, fault_dict, mag, mechanism, scenario,
                      vs30_field):
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from DIST import Fault_Proj, Find_R_Zones, Zone_Based_Distance

    if not os.path.exists(shp_path):
        print(f"  Aviso: shapefile no encontrado -> {shp_path}")
        return []

    sf     = shapefile.Reader(shp_path)
    fields = [f[0] for f in sf.fields[1:]]
    n_shp  = len(sf.shapes())
    print(f"  Shapefile: {os.path.basename(shp_path)}  ({n_shp} secciones)")
    print(f"  Campos disponibles: {fields}")
    print(f"  Usando campo Vs30: '{vs30_field}'")

    # Verificar que el campo Vs30 existe
    if vs30_field not in fields:
        print(f"  AVISO: campo '{vs30_field}' no encontrado. Se usará Vs30={BEDROCK_VS30} para todas las secciones.")

    resultados  = []
    sin_edificios = 0

    for sr in sf.iterShapeRecords():
        rec   = sr.record
        props = {fields[i]: rec[i] for i in range(len(fields))}

        oid   = int(props.get("OBJECTID") or props.get("OBJECTID_1")
                    or props.get("Id") or 0)
        cusec = clean_cusec(props.get("CUSEC", ""))

        # Vs30
        vs30_raw = props.get(vs30_field)
        try:
            vs30 = int(vs30_raw)
            if vs30 <= 0:
                vs30 = BEDROCK_VS30
        except (TypeError, ValueError):
            vs30 = BEDROCK_VS30

        vuls_en_seccion = cusec_vuls.get(cusec, {})
        num_edif        = sum(vuls_en_seccion.values())

        if not vuls_en_seccion:
            sin_edificios += 1
            resultados.append({
                "OBJECTID":      oid,
                "CUSEC":         cusec,
                "localidad":     localidad,
                "NumEdif":       0,
                "NumEdifSinVul": 0,
                "Vs30":          vs30,
                "Rjb":           None,
                "dMean":         None,
                "noData":        True,
                "Resultados":    {},
                "DamageTotals":  {},
            })
            continue

        # Centroide
        geom     = shape(sr.shape.__geo_interface__)
        centroid = geom.centroid
        lat_c, lng_c = centroid.y, centroid.x

        # Distancia Rjb
        try:
            zone = Find_R_Zones((lat_c, lng_c), fault_proj,
                                fault_dict["azimuth"], "Rjb")
            r    = Zone_Based_Distance((lat_c, lng_c), zone,
                                       fault_proj, fault_dict, "Rjb")
            r    = max(r, 0.1)
        except Exception as e:
            print(f"    Distancia fallida para {cusec}: {e} -> usando r=10 km")
            r = 10.0

        # Daño por código de vulnerabilidad
        resultados_vul = {}
        for vul_code in sorted(vuls_en_seccion.keys()):
            try:
                res = calc_damage(r, vs30, vul_code, mag, mechanism,
                                  scenario, vul_table,
                                  vuls_en_seccion[vul_code])
                if res:
                    resultados_vul[vul_code] = res
            except Exception as e:
                print(f"    Error {cusec}/{vul_code}: {e}")

        no_data      = (len(resultados_vul) == 0)
        DamageTotals = compute_damage_totals(resultados_vul, num_edif)
        vals_dmean   = [v["dMean"] for v in resultados_vul.values()]
        # dMean ponderado por número de edificios de cada tipología
        total_edif_vul = sum(v["numEdif"] for v in resultados_vul.values())
        if vals_dmean and total_edif_vul > 0:
            dMean = round(sum(v["dMean"] * v["numEdif"] for v in resultados_vul.values()) / total_edif_vul, 4)
        else:
            dMean = None

        resultados.append({
            "OBJECTID":      oid,
            "CUSEC":         cusec,
            "localidad":     localidad,
            "NumEdif":       num_edif,
            "NumEdifSinVul": 0,
            "Vs30":          vs30,
            "Rjb":           round(r, 3),
            "dMean":         dMean,
            "noData":        no_data,
            "Resultados":    resultados_vul,
            "DamageTotals":  DamageTotals,
        })

    con_res = len(resultados) - sin_edificios
    print(f"  Con edificios: {con_res}  |  Sin edificios (incluidas con NumEdif=0): {sin_edificios}")
    return resultados

# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

def run():
    print("=" * 60)
    print("RISK_.py - iniciando")
    print("=" * 60)

    # 1. Parámetros del terremoto elegido por el usuario
    print("\nCargando parámetros del terremoto...")
    fault = load_fault_params()

    mag       = float(fault["mag"])
    mechanism = fault.get("mechanism", "SS")
    scenario  = int(fault.get("scenario", 0))

    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from DIST import Fault_Proj

    fault_dict = {
        "lat":     float(fault["lat"]),
        "long":    float(fault["lng"]),
        "azimuth": float(fault.get("strike", fault.get("Strike", 0))),
        "dip":     float(fault.get("dip",    fault.get("Dip", 90))),
        "wide":    float(fault.get("width",  fault.get("Width", 10))),
        "length":  float(fault.get("length", fault.get("Length", 10))),
        "Ztor":    float(fault.get("ztop",   fault.get("Ztop", 5))),
    }
    fault_proj = Fault_Proj(fault_dict)

    # 2. Tabla de vulnerabilidad
    print("\nCargando tabla de vulnerabilidad...")
    vul_table = load_vul_table()

    os.makedirs(outputpath, exist_ok=True)
    todos_resultados = []

    # 3. Procesar cada municipio por separado
    for mun in MUNICIPIOS_RISK:
        print(f"\n{'='*40}")
        print(f"Procesando: {mun['id']}")
        print(f"{'='*40}")

        cusec_vuls = load_buildings_file(mun["buildings"])
        if not cusec_vuls:
            print(f"  Sin edificios para {mun['id']}, saltando.")
            continue

        res = process_shapefile(
            shp_path   = os.path.join(inputpath, mun["shp"]),
            localidad  = mun["id"],
            cusec_vuls = cusec_vuls,
            vul_table  = vul_table,
            fault_proj = fault_proj,
            fault_dict = fault_dict,
            mag        = mag,
            mechanism  = mechanism,
            scenario   = scenario,
            vs30_field = mun["vs30_field"],
        )
        print(f"  -> {len(res)} secciones procesadas ({mun['id']})")

        # Guardar archivo individual
        ruta_ind = os.path.join(outputpath, mun["result_file"])
        with open(ruta_ind, "w", encoding="utf-8") as f:
            f.write(f"var {mun['result_var']} = ")
            json.dump(res, f, indent=2, ensure_ascii=False)
            f.write(";")
        print(f"  Guardado: {mun['result_file']}")

        todos_resultados.extend(res)

    # 4. Archivo combinado (usado por BUFF_.py como fallback)
    ruta_combined = os.path.join(outputpath, final_result_filename)
    with open(ruta_combined, "w", encoding="utf-8") as f:
        f.write("var excelData = ")
        json.dump(todos_resultados, f, indent=2, ensure_ascii=False)
        f.write(";")
    print(f"\nGuardado combinado: {final_result_filename} ({len(todos_resultados)} secciones)")
    print("RISK_.py - finalizado")

if __name__ == "__main__":
    run()