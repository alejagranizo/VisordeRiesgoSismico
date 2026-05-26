#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BUFF_COLORED.py — Genera Colored_Buffers_*.js con geometría de secciones + color por daño

Este script fusiona:
  1. Secciones censales con sus geometrías (desde newData/SSCCEnd_*.js)
  2. Datos de daño calculados (desde output/resultSSCC_*.js)
  3. Genera archivos Colored_Buffers_*.js con la variable json_Bufferin_*
"""

import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import os
import re
import json
from info_ import outputpath, js_data_dir

# Configuración de municipios
MUNICIPIOS = [
    {
        "id":           "LORCA",
        "geom_js_file": "SSCCEnd_Completo.js",    # geometría en public/newData/
        "result_file":  "resultSSCC_Lorca.js",    # datos de daño
        "output_file":  "Colored_Buffers_LORCA.js",  # salida
        "var_name":     "json_Bufferin_LORCA",
    },
    {
        "id":           "PL",
        "geom_js_file": "SSCCEnd_PL.js",
        "result_file":  "resultSSCC_PuertoLumbreras.js",
        "output_file":  "Colored_Buffers_PL.js",
        "var_name":     "json_Bufferin_PL",
    },
]

def strip_js_var(raw):
    """Extrae el JSON de una variable JS declarada."""
    raw = raw.strip()
    raw = re.sub(r"^\s*var\s+\w+\s*=\s*", "", raw)
    raw = re.sub(r"\s*;\s*$", "", raw)
    return raw.strip()

def load_geom_js(filepath):
    """Carga geometría GeoJSON desde archivo JS."""
    if not os.path.exists(filepath):
        print(f"  ⚠ Archivo no encontrado: {filepath}")
        return None
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = strip_js_var(f.read())
        return json.loads(content)
    except Exception as e:
        print(f"  ⚠ Error cargando geometría: {e}")
        return None

def load_results_js(filepath):
    """Carga resultados de daño desde archivo JS."""
    if not os.path.exists(filepath):
        print(f"  ⚠ Archivo no encontrado: {filepath}")
        return {}
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = strip_js_var(f.read())
        data = json.loads(content)
        # Crear dict indexado por CUSEC
        result_dict = {}
        for item in data:
            cusec = str(item.get("CUSEC", "")).strip()
            result_dict[cusec] = item
        return result_dict
    except Exception as e:
        print(f"  ⚠ Error cargando resultados: {e}")
        return {}

def get_color_from_damage(damage_mean):
    """Devuelve color RGB según nivel de daño medio (rango 1-4)."""
    # 0-1: verde (sin daño)
    # 1-2: amarillo (leve)
    # 2-3: naranja (moderado)
    # 3-4: rojo (extenso/completo)
    if isinstance(damage_mean, str):
        try:
            damage_mean = float(damage_mean)
        except:
            return None
    
    if damage_mean is None or damage_mean < 0.5:
        return None  # No colorear
    elif damage_mean < 1.5:
        return 0.01  # Leve
    elif damage_mean < 2.5:
        return 0.05  # Moderado
    elif damage_mean < 3.5:
        return 0.10  # Extenso
    else:
        return 0.15  # Completo

def merge_geom_with_damage(geojson, damage_dict):
    """Fusiona geometrías con datos de daño, añadiendo propiedad COLOR."""
    if not geojson:
        return geojson
    
    features_with_color = []
    for feature in geojson.get("features", []):
        props = feature.get("properties", {})
        cusec = str(props.get("CUSEC", "")).strip()
        
        # Buscar daño para esta sección
        damage_rec = damage_dict.get(cusec)
        
        if damage_rec:
            color = get_color_from_damage(damage_rec.get("dMean", 0))
            if color is not None:
                props["COLOR"] = color
                props["dMean"] = damage_rec.get("dMean", 0)
                props["NumEdif"] = damage_rec.get("NumEdif", 0)
                features_with_color.append(feature)
        # Si no hay daño, no incluir la feature (es un buffer vacío)
    
    return {
        "type": "FeatureCollection",
        "features": features_with_color
    }

def generar_colored_buffers():
    """Genera archivos Colored_Buffers_*.js con secciones coloreadas."""
    print("\n" + "=" * 80)
    print("BUFF_COLORED.py — Generando Colored_Buffers_*.js")
    print("=" * 80)
    
    os.makedirs(outputpath, exist_ok=True)
    
    for mun in MUNICIPIOS:
        print(f"\n── {mun['id']} ─────────────────────────────────────────────────────")
        
        # 1. Cargar geometría de secciones
        geom_path = os.path.join(js_data_dir, mun["geom_js_file"])
        print(f"  → Cargando geometría: {mun['geom_js_file']}")
        geojson = load_geom_js(geom_path)
        if not geojson:
            print(f"  ✗ No se pudo cargar geometría para {mun['id']}")
            continue
        print(f"    ✓ {len(geojson.get('features', []))} features cargadas")
        
        # 2. Cargar resultados de daño
        result_path = os.path.join(outputpath, mun["result_file"])
        print(f"  → Cargando daño: {mun['result_file']}")
        damage_dict = load_results_js(result_path)
        print(f"    ✓ {len(damage_dict)} secciones con daño")
        
        # 3. Fusionar geometría + daño
        print(f"  → Fusionando geometría + daño...")
        colored_geojson = merge_geom_with_damage(geojson, damage_dict)
        num_with_color = len(colored_geojson.get("features", []))
        print(f"    ✓ {num_with_color} features con color (daño > 0.5)")
        
        # 4. Guardar archivo de salida
        output_path = os.path.join(outputpath, mun["output_file"])
        
        # Borrar archivo anterior si existe
        if os.path.exists(output_path):
            try:
                os.remove(output_path)
                print(f"  ✓ Archivo anterior borrado: {mun['output_file']}")
            except:
                pass
        
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(f"var {mun['var_name']} = ")
                json.dump(colored_geojson, f, ensure_ascii=False, separators=(",", ":"))
                f.write(";")
            
            tamaño = os.path.getsize(output_path)
            print(f"  ✓ Generado: {mun['output_file']} ({tamaño} bytes)")
        except Exception as e:
            print(f"  ✗ Error escribiendo {mun['output_file']}: {e}")
    
    print("\n" + "=" * 80)
    print("✓ BUFF_COLORED.py — Completado")
    print("=" * 80)

if __name__ == "__main__":
    generar_colored_buffers()
