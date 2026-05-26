#!/usr/bin/python
# -*- coding: utf-8 -*-
#git
"""
by Alejandra Granizo
Topography and Cartography Department
Technical University of Madrid, Spain
May 2026

"""

#!/usr/bin/python
# -*- coding: utf-8 -*-
"""
BUFF.py  -  Colorea los buffers de escombros según el daño calculado por MAIN.
Las funciones reciben `cfg` (dict devuelto por info.get_location_config)
en lugar de importar variables globales.
"""

import json
import os
import sys

damage = {1: 'Sligth', 2: 'Moderate', 3: 'Extensive', 4: 'Complete'}


# ──────────────────────────────────────────────────────────────────────────────
def Color_Buffers(cfg):
    """
    Busca buffers para cada nivel de daño usando 4 geojson separados
    (uno por nivel: allBuffers1.geojson … allBuffers4.geojson).
    """
    inputpath            = cfg['inputpath']
    outputpath           = cfg['outputpath']
    final_result_filename = cfg['final_result_filename']
    final_buffer_filename = cfg['final_buffer_filename']
    buffer_level_filenames = cfg['buffer_level_filenames']   # lista de 4 rutas relativas
    site                 = cfg['site']

    print(f'\n[{site}] Color_Buffers: búsqueda por nivel de daño (4 geojson)')

    result_filepath = os.path.join(outputpath, final_result_filename)
    buffer_filepath = os.path.join(outputpath, final_buffer_filename)

    if not os.path.exists(result_filepath):
        raise ValueError(f'No existe "{final_result_filename}" en "{outputpath}"')

    # ── Leer edificios desde result.js ────────────────────────────────────────
    with open(result_filepath, 'r') as f:
        lines = f.readlines()[1:-2]

    buildings = []
    for line in lines:
        line = line.rstrip(',\n')
        try:
            buildings.append(json.loads(line))
        except json.JSONDecodeError:
            pass

    new_buffers_features = []

    for d in reversed(range(1, 5)):
        selected = [b for b in buildings if b.get('GradoDanio') == damage[d]]
        if not selected:
            print(f'  [{site}] Sin edificios con nivel de daño {d}')
            continue

        print(f'  [{site}] {len(selected)} edificios con nivel {d}')
        buffer_filename    = buffer_level_filenames[d - 1]
        buffer_full_path   = os.path.join(inputpath, buffer_filename)

        if not os.path.exists(buffer_full_path):
            raise ValueError(f'No existe "{buffer_filename}" en "{inputpath}"')

        try:
            with open(buffer_full_path, 'r') as bf:
                all_buffers = json.load(bf)
        except Exception as e:
            print(f'  [{site}] ERROR cargando {buffer_filename}: {e}')
            continue

        print(f'  [{site}] {buffer_filename} cargado ({len(all_buffers["features"])} buffers)')
        picked = 0
        for bldg in selected:
            uid    = bldg['UID']
            debris = bldg['Escombro']
            match  = [f for f in all_buffers['features'] if f['properties'].get('ID') == uid]
            if not match:
                print(f'  [{site}] Sin buffer para UID {uid} en {buffer_filename}')
            else:
                feature = match[0]
                feature['properties']['COLOR'] = debris
                new_buffers_features.append(feature)
                picked += 1
        print(f'  [{site}] {picked} buffers coloreados para nivel {d}')

    output = {'features': new_buffers_features}
    with open(buffer_filepath, 'w') as out:
        out.write(f'var json_Bufferin_{site} =')
        try:
            out.write(json.dumps(output))
        except Exception as e:
            print(f'  [{site}] ERROR escribiendo buffers: {e}')

    print(f'  [{site}] Salida: "{final_buffer_filename}" en "{outputpath}"\n------------')


# ──────────────────────────────────────────────────────────────────────────────
def Color_Buffer(cfg):
    """
    Busca buffers usando un único geojson con todos los niveles.
    Filtra los edificios que producen escombros y los empareja por UID y nivel.
    """
    inputpath            = cfg['inputpath']
    outputpath           = cfg['outputpath']
    buffer_filenames     = cfg['buffer_filenames']   # un solo geojson
    final_result_filename = cfg['final_result_filename']
    final_buffer_filename = cfg['final_buffer_filename']
    site                 = cfg['site']

    print(f'\n[{site}] Color_Buffer: búsqueda por UID (1 geojson)')

    buffer_full_path  = os.path.join(inputpath, buffer_filenames)
    result_full_path  = os.path.join(outputpath, final_result_filename)

    if not os.path.exists(buffer_full_path):
        raise ValueError(f'No existe "{buffer_filenames}" en "{inputpath}"')
    if not os.path.exists(result_full_path):
        raise ValueError(f'No existe "{final_result_filename}" en "{outputpath}"')

    with open(result_full_path, 'r') as f:
        lines = f.readlines()[1:-2]

    buildings = []
    for line in lines:
        line = line.rstrip(',\n')
        try:
            buildings.append(json.loads(line))
        except json.JSONDecodeError:
            pass

    selected = [b for b in buildings if b.get('Escombro', 0) > 0]
    print(f'  [{site}] {len(selected)} edificios con escombros de {len(buildings)} totales')

    try:
        with open(buffer_full_path, 'r') as bf:
            all_buffers = json.load(bf)
    except Exception as e:
        print(f'  [{site}] ERROR cargando buffers: {e}')
        return

    print(f'  [{site}] {buffer_filenames} cargado ({len(all_buffers["features"])} buffers)')

    new_buffers_features = []
    for b in selected:
        uid    = b['UID']
        color  = float(b['Escombro'])
        grad   = b['GradoDanio']
        match  = [f for f in all_buffers['features']
                  if f['properties'].get('ID') == uid
                  and damage.get(int(f['properties'].get('BUFF_DIST', 0))) == grad]
        if not match:
            print(f'  [{site}] Sin buffer para UID {uid} / daño {grad}')
        else:
            feature = match[0]
            feature['properties']['COLOR'] = color
            new_buffers_features.append(feature)

    output = {'features': new_buffers_features}
    buffer_filepath = os.path.join(outputpath, final_buffer_filename)
    with open(buffer_filepath, 'w') as out:
        out.write(f'var json_Bufferin_{site} =')
        try:
            out.write(json.dumps(output))
        except Exception as e:
            print(f'  [{site}] ERROR escribiendo buffers: {e}')

    print(f'  [{site}] {len(new_buffers_features)} buffers mapeados')
    print(f'  [{site}] Salida: "{final_buffer_filename}" en "{outputpath}"\n------------')