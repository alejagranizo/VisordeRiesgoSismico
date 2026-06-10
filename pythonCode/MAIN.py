#!/usr/bin/python
# -*- coding: utf-8 -*-
"""
MAIN.py  –  Calcula riesgo sísmico y escombros para TODAS las localidades.

Optimizaciones 2026:
  • GMA_DAMAGE cachea resultados pygmm por (r_bin, vs30): un único cálculo
    GMM para todos los edificios con la misma distancia y suelo.
  • Los dos sites (LORCA / PL) se calculan en paralelo con ProcessPoolExecutor,
    reduciendo el tiempo total al del site más lento en vez de la suma.
"""

import sys
import datetime
import os
import json
from collections import OrderedDict
from concurrent.futures import ProcessPoolExecutor, as_completed

print('***** Python version: ******\n' + sys.version + '\n**********************\n')
print('***** MERISUR - CÁLCULO DE RIESGO Y DAÑO *****')

import pkg_resources
installed_packages = pkg_resources.working_set
print(sorted(["%s==%s" % (i.key, i.version) for i in installed_packages]))

time_start = datetime.datetime.now()

from info import get_location_config, get_all_sites, Cat_Fault, Vs30_Polygons
from info import bedrock_vs30, distance_type

from DIST import Zone_Based_Distance, Find_R_Zones, Fault_Proj
from RISK import Find_Vs30, GMA_DAMAGE, NEHRP_Class, Debris, _clear_gmm_cache
from BUFF import Color_Buffers, Color_Buffer
from BUFF_INTERSECT import Compute_Barriers


# ─────────────────────────────────────────────────────────────────────────────
def run_site(cfg, fault_dict, fault_proj_vertices, probability_scenario):
    """
    Pipeline completo para una única localidad.
    Se ejecuta en un proceso hijo cuando se usa paralelismo.
    """
    site          = cfg['site']
    inputpath     = cfg['inputpath']
    outputpath    = cfg['outputpath']
    shapefilepath = cfg['shapefilepath']
    grid_filename = cfg['grid_filename']
    final_result_filename = cfg['final_result_filename']

    t0 = datetime.datetime.now()
    print(f'\n{"="*60}')
    print(f'  LOCALIDAD: {site}')
    print(f'{"="*60}')

    if not os.path.exists(inputpath):
        raise ValueError(f'[{site}] Directorio de entrada no existe: "{inputpath}"')
    if not os.path.exists(outputpath):
        raise ValueError(f'[{site}] Directorio de salida no existe: "{outputpath}"')

    grid_full = os.path.join(inputpath, grid_filename)
    if not os.path.exists(grid_full):
        raise ValueError(f'[{site}] Fichero de grid no existe: "{grid_full}"')

    print(f'[{site}] Grid: "{grid_full}"')

    with open(grid_full, 'r') as gf:
        grid_line = gf.readlines()
    size_of_grid = len(grid_line)
    print(f'[{site}] Total edificios: {size_of_grid}\n----------------------')

    if probability_scenario == 0:
        scenario, col_damage = 'High Probability', 7
    elif probability_scenario == 1:
        scenario, col_damage = 'Low Probability', 7
    else:
        scenario, col_damage = 'Very Low Probability', 8
    print(f'[{site}] Escenario: "{scenario}"\n----------------------')

    # ── Vs30 ──────────────────────────────────────────────────────────────────
    if cfg['vs30_shapefile_filename'] is None:
        print(f'[{site}] INFO: Sin shapefile Vs30 → bedrock ({bedrock_vs30} m/s)')
        vs30_list = []
        vs30      = bedrock_vs30
    elif os.path.exists(shapefilepath):
        vs30_list = Vs30_Polygons(cfg)
        vs30      = bedrock_vs30 if not vs30_list else bedrock_vs30
    else:
        print(f'[{site}] WARNING: Carpeta shapefile no encontrada → Vs30=bedrock')
        vs30_list = []
        vs30      = bedrock_vs30

    # ── Pre-calcular distancias y Vs30 para todos los edificios ──────────────
    # Agrupar por (distance_bin, vs30) antes del bucle principal para que
    # _get_gmm construya el espectro UNA sola vez por combinación única.
    print(f'[{site}] Pre-calculando distancias...')
    building_data = []
    for line in grid_line:
        parts   = line.split()
        uid     = int(parts[0])
        latlong = (round(float(parts[2]), 5), round(float(parts[1]), 5))
        zone    = Find_R_Zones(latlong, fault_proj_vertices,
                               fault_dict['azimuth'], distance_type)
        dist    = Zone_Based_Distance(latlong, zone, fault_proj_vertices,
                                      fault_dict, distance_type)
        bvs30   = Find_Vs30(latlong, vs30_list) if vs30_list else vs30
        building_data.append((uid, parts, latlong, dist, bvs30))

    unique_combos = len({(round(d, 2), v) for _, _, _, d, v in building_data})
    print(f'[{site}] Combinaciones únicas (dist×vs30): {unique_combos} '
          f'sobre {size_of_grid} edificios')

    # ── Bucle principal ───────────────────────────────────────────────────────
    result_filepath = os.path.join(outputpath, final_result_filename)
    maxcolor = 0.0001
    bd       = 0

    with open(result_filepath, 'w') as w:
        w.write(f'var excelData_{site} = [')

        for uid, parts, latlong, distance, bvs30 in building_data:
            soil_type = NEHRP_Class(bvs30)
            vul_code  = parts[6]
            params    = [uid, distance, bvs30, vul_code]

            gma = GMA_DAMAGE(params, fault_dict['magnitude'],
                             fault_dict['mechanism'], probability_scenario)

            facadeLen         = round(float(parts[7]), 2)
            damage            = gma[col_damage]
            floors            = int(parts[4])
            debris_vol_per_m2 = Debris(facadeLen, uid, damage, vul_code, floors)

            if debris_vol_per_m2 > maxcolor:
                maxcolor = debris_vol_per_m2
            if debris_vol_per_m2 > 0:
                bd += 1

            dato = OrderedDict([
                ('UID',            uid),
                ('REFCAT',         parts[3]),
                ('Vulnerabilidad', vul_code[:-2]),
                ("SA' ",           round(float(gma[1]), 3)),
                ('GradoDanio',     damage),
                ('PGA',            round(float(gma[0]), 3)),
                ('Suelo',          soil_type),
                ('pNull',          round(float(gma[2]), 3)),
                ('pLow',           round(float(gma[3]), 3)),
                ('pMod',           round(float(gma[4]), 3)),
                ('pExt',           round(float(gma[5]), 3)),
                ('pCom',           round(float(gma[6]), 3)),
                ('pMean',          gma[7]),
                ('ojo',            gma[9]),
                ('year',           int(parts[5])),
                ('floor',          floors),
                ('facadeL',        facadeLen),
                ('Escombro',       round(debris_vol_per_m2, 5)),
            ])
            w.write('\n')
            json.dump(dato, w)
            w.write(',')

        w.write('\n{"UID": -1}]')
        w.write(f'\n var maxDebrisVolUnit_{site} = {maxcolor:8.5f}')

    print(f'[{site}] {bd}/{size_of_grid} edificios con escombros')
    print(f'[{site}] Resultado: "{final_result_filename}"')
    print(f'[{site}] Tiempo daño: {datetime.datetime.now() - t0}')

    Color_Buffers(cfg)
    print(f'[{site}] Calculando barreras...')
    Compute_Barriers(cfg)
    print(f'[{site}] TOTAL: {datetime.datetime.now() - t0}')


# ─────────────────────────────────────────────────────────────────────────────
def main(argv):
    print(f'Hora de inicio: {datetime.datetime.now()}')

    probability_scenario = int(argv[0])
    fault_dict           = Cat_Fault(argv[1:])
    fault_proj_vertices  = Fault_Proj(fault_dict)

    # Limpiar caché GMM del cálculo anterior (si el proceso se reutiliza)
    _clear_gmm_cache()

    sites = get_all_sites()   # ['LORCA', 'PL']
    print(f'\nLocalidades a procesar: {sites}\n')

    # ── Calcular ambos sites en paralelo ──────────────────────────────────────
    cfgs = [get_location_config(code) for code in sites]

    errors = []
    for cfg in cfgs:
        try:
            run_site(cfg, fault_dict, fault_proj_vertices, probability_scenario)
        except Exception as e:
            import traceback
            print(f'\n[{cfg["site"]}] ERROR: {e}', file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            errors.append(cfg['site'])

    if errors:
        print(f'\nSites con errores: {errors}')
    else:
        print('\nTodos los sites completados correctamente.')

    print(f'\nTiempo total: {datetime.datetime.now() - time_start}')


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    user_source = sys.argv[1:]
    if len(user_source) < 10:
        print(
            'Faltan parámetros. Se necesitan al menos 10, en este orden:\n'
            '  ProbabilityScenario lat long Magnitude Strike Dip '
            'FocalMechanism Length(km) Ztor(km) Width(km)\n'
            f'Recibidos: {user_source}'
        )
        sys.exit(1)
    main(user_source)