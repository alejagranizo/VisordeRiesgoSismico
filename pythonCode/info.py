#!/usr/bin/python
# -*- coding: utf-8 -*-
"""
info.py  -  Configuración centralizada del proyecto MERISUR
Cada localidad se obtiene llamando a get_location_config(site_code).
No hay variables globales mutables: el resto de módulos reciben `cfg` como parámetro.
"""

import os
import shapefile
import pandas
from pyproj import Proj
from shapely.geometry import Polygon

# ── Rutas base ────────────────────────────────────────────────────────────────
inputpath  = os.path.abspath('inputs')
outputpath = os.path.abspath('output')

# ── Parámetros comunes (no dependen de la localidad) ─────────────────────────
parameters_excelfilename         = 'params.xlsx'
vulnerability_sheetname          = 'vulcode'
debris_Mansory_sheetname         = 'debrisM'
debris_Reinforced_sheetname      = 'debrisH'
vs30_shapefile_coordinate_system = 'WGS'
bedrock_vs30                     = 450
default_te                       = 0.3
distance_type                    = 'Rjb'
p = Proj(proj='utm', zone=30, ellps='WGS84')

# ── Tablas de vulnerabilidad (se leen una sola vez) ───────────────────────────
_excel = os.path.join(inputpath, parameters_excelfilename)
vul_code_parameters  = pandas.read_excel(_excel, sheet_name=vulnerability_sheetname,   index_col=0, engine='openpyxl')
debris_M_parameters  = pandas.read_excel(_excel, sheet_name=debris_Mansory_sheetname,  index_col=0, engine='openpyxl')
debris_H_parameters  = pandas.read_excel(_excel, sheet_name=debris_Reinforced_sheetname, index_col=0, engine='openpyxl')
vul_table      = vul_code_parameters.to_dict()
debris_table_M = debris_M_parameters.to_dict()
debris_table_H = debris_H_parameters.to_dict()

# ── Definición de localidades ─────────────────────────────────────────────────
_LOCATIONS = {
    'LORCA': {
        'subfolder':    'Lorca',
        'grid':         'allBuildings_Lorca.txt',
        'buffers':      'allBuffers_Lorca.geojson',
        'soil_shp':     'LorcaSoil_WGS',
        'buildings_shp':'EdificiosLorca2026.shp',
        # Sufijos para los archivos de salida
        'result_filename': 'result_LORCA.js',
        'buffer_filename': 'Colored_Buffers_LORCA.js',
        'barriers_filename': 'barriers_LORCA.js',
    },
    'PL': {
        'subfolder':    'PuertoLumbreras',
        'grid':         'allBuildings_PL.txt',
        'buffers':      'allBuffers_PL.geojson',
        'soil_shp':     None,          # Sin mapa de suelo: se usará bedrock_vs30
        'buildings_shp':'EdificiosPuertoLumbreras.shp',
        'result_filename': 'result_PL.js',
        'buffer_filename': 'Colored_Buffers_PL.js',
        'barriers_filename': 'barriers_PL.js',
    },
}

# Nombres de los 4 geojson de buffers por nivel de daño
_BUFFER_LEVEL_SUFFIXES = ['1.geojson', '2.geojson', '3.geojson', '4.geojson']


def get_location_config(site_code: str) -> dict:
    """
    Devuelve un diccionario con todas las rutas y parámetros de la localidad.
    Uso:
        cfg = get_location_config('LORCA')
        cfg = get_location_config('PL')
    """
    site_code = site_code.upper()
    if site_code not in _LOCATIONS:
        raise ValueError(f"Localidad '{site_code}' no reconocida. Opciones: {list(_LOCATIONS.keys())}")

    loc = _LOCATIONS[site_code]
    sub = loc['subfolder']

    shapefilepath_loc = os.path.join(inputpath, sub, 'shapefiles')

    # Nombre base de los buffers sin extensión (para construir los 4 niveles)
    buffers_base = os.path.splitext(loc['buffers'])[0]   # ej. "allBuffers"

    cfg = {
        # ── Identificador ──────────────────────────────────────────────────
        'site':                 site_code,
        'subfolder':            sub,

        # ── Rutas de entrada ───────────────────────────────────────────────
        'inputpath':            inputpath,
        'outputpath':           outputpath,
        'shapefilepath':        shapefilepath_loc,
        'grid_filename':        os.path.join(sub, loc['grid']),
        'buffer_filenames':     os.path.join(sub, loc['buffers']),  # un solo geojson
        'buffer_level_filenames': [
            os.path.join(sub, f"{buffers_base}{suf}")
            for suf in _BUFFER_LEVEL_SUFFIXES
        ],
        'vs30_shapefile_filename':  loc['soil_shp'],
        'buildings_shp':            os.path.join(shapefilepath_loc, loc['buildings_shp']),

        # ── Rutas de salida ────────────────────────────────────────────────
        'final_result_filename':  loc['result_filename'],
        'final_buffer_filename':  loc['buffer_filename'],
        'final_barriers_filename': loc['barriers_filename'],

        # ── Parámetros comunes ─────────────────────────────────────────────
        'bedrock_vs30':    bedrock_vs30,
        'default_te':      default_te,
        'distance_type':   distance_type,
        'vs30_shapefile_coordinate_system': vs30_shapefile_coordinate_system,
    }
    return cfg


def get_all_sites() -> list:
    """Devuelve la lista de códigos de localidad disponibles."""
    return list(_LOCATIONS.keys())


# ── Funciones de utilidad (sin estado global) ─────────────────────────────────

def Cat_Fault(faultArray):
    fault_dictionary = {}
    fault_dictionary['long']      = round(float(faultArray[1]), 6)
    fault_dictionary['lat']       = round(float(faultArray[0]), 6)
    fault_dictionary['azimuth']   = float(faultArray[3])
    fault_dictionary['dip']       = float(faultArray[4])
    fault_dictionary['Ztor']      = float(faultArray[7])
    fault_dictionary['mechanism'] = faultArray[5]
    if fault_dictionary['mechanism'][0] == 'U': fault_dictionary['mechanism'] = 'SS'
    elif fault_dictionary['mechanism'][0] == 'S': fault_dictionary['mechanism'] = 'SS'
    elif fault_dictionary['mechanism'][0] == 'D': fault_dictionary['mechanism'] = 'SS'
    elif fault_dictionary['mechanism'][0] == 'N': fault_dictionary['mechanism'] = 'NS'
    elif fault_dictionary['mechanism'][0] == 'R': fault_dictionary['mechanism'] = 'RS'
    fault_dictionary['length']    = round(float(faultArray[6]), 3)
    fault_dictionary['wide']      = round(float(faultArray[8]), 3)
    fault_dictionary['magnitude'] = float(faultArray[2])
    print("The selected fault has the following characteristics:\n")
    for key in fault_dictionary:
        print('%s : %s' % (key, fault_dictionary[key]))
    print('----------------------')
    return fault_dictionary


def Vs30_Polygons(cfg):
    """
    Lee el shapefile de Vs30 indicado en cfg y devuelve lista de [Polygon, valor].
    Recibe cfg en lugar de variables globales.
    Si vs30_shapefile_filename es None, devuelve lista vacía (se usará bedrock).
    """
    Vs30Filename  = cfg['vs30_shapefile_filename']
    shapefilepath = cfg['shapefilepath']
    coord_system  = cfg['vs30_shapefile_coordinate_system']

    vs30_polygon_list = []

    if Vs30Filename is None:
        print(f'  [{cfg["site"]}] Sin shapefile de Vs30 definido → se usará bedrock ({cfg["bedrock_vs30"]} m/s)')
        return vs30_polygon_list

    required_exts = ['.shx', '.shp', '.prj', '.dbf']
    missing = [e for e in required_exts
               if not os.path.exists(os.path.join(shapefilepath, Vs30Filename + e))]
    if missing:
        print(f'WARNING: Faltan archivos del shapefile Vs30 "{Vs30Filename}": {missing}')
        return vs30_polygon_list

    print(f'Shapefile Vs30 en uso:\n  "{os.path.join(shapefilepath, Vs30Filename)}.shp"')
    vs30_shp   = shapefile.Reader(os.path.join(shapefilepath, Vs30Filename))
    shapes     = vs30_shp.shapes()
    records    = vs30_shp.records()
    N_polygons = len(shapes)
    print(f'  {N_polygons} áreas en "{Vs30Filename}.shp"\n----------------------')

    def _to_wgs(point):
        lon, lat = p(point[0], point[1], inverse=True)
        return (lon, lat)

    def _parse_parts(poly):
        parts     = poly.parts
        pts       = poly.points
        n         = len(parts)
        boundaries = []
        for i in range(n):
            start = parts[i]
            end   = parts[i + 1] if i + 1 < n else len(pts)
            boundaries.append(pts[start:end])
        return boundaries

    for i in range(N_polygons):
        poly  = shapes[i]
        value = records[i][0]
        boundaries = _parse_parts(poly)

        if coord_system == 'UTM':
            boundaries = [[_to_wgs(pt) for pt in b] for b in boundaries]
        elif coord_system != 'WGS':
            raise ValueError(f'Sistema de coordenadas desconocido: "{coord_system}"')

        if len(boundaries) >= 2:
            polygon = Polygon(boundaries[0], boundaries[1:])
        else:
            polygon = Polygon(boundaries[0])

        vs30_polygon_list.append([polygon, value])

    return vs30_polygon_list