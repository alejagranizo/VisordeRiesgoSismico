#!/usr/bin/env python3
# MAIN0.py — Orquestador: ejecuta RISK_.py y BUFF_.py en orden
# Llamado por routes/data.js cada vez que el usuario genera un nuevo escenario.

import subprocess
import sys
import os

PY   = sys.executable
BASE = os.path.dirname(os.path.abspath(__file__))  # pythonCode/
ROOT = os.path.dirname(BASE)                        # raíz del proyecto

# Entorno con UTF-8 forzado para los subprocesos
PY_ENV = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}

def run_step(label, script_path):
    """Lanza un script Python y redirige su salida directamente a los
    descriptores de fichero reales (fd 1 y fd 2), evitando los wrappers
    de TextIOWrapper que rompen el pipe en Windows cuando Node lanza el proceso."""
    print(f"\n[{label}] Ejecutando {os.path.basename(script_path)}...")
    sys.stdout.flush()
    sys.stderr.flush()

    ret = subprocess.call(
        [PY, script_path],
        cwd=BASE,
        env=PY_ENV,
        # Escribir directamente en los buffers binarios del proceso,
        # no en los wrappers Python — evita el cuelgue silencioso en Windows.
        stdout=sys.__stdout__.buffer if hasattr(sys.__stdout__, 'buffer') else None,
        stderr=sys.__stderr__.buffer if hasattr(sys.__stderr__, 'buffer') else None,
    )
    print(f"[{label}] Código de salida: {ret}")
    sys.stdout.flush()
    return ret

print("=" * 60)
print("MAIN0.py — iniciando orquestación")
print(f"  pythonCode: {BASE}")
print(f"  Proyecto:   {ROOT}")
print("=" * 60)
sys.stdout.flush()

# 1. RISK_.py — calcula el daño sísmico usando fault_params.json
ret1 = run_step("1/2", os.path.join(BASE, "RISK_.py"))
if ret1 != 0:
    print("ERROR: RISK_.py falló. Abortando.")
    sys.stdout.flush()
    sys.exit(ret1)

# 2. BUFF_.py — fusiona geometría + resultados en los JS del mapa
ret2 = run_step("2/2", os.path.join(BASE, "BUFF_.py"))
if ret2 != 0:
    print("ERROR: BUFF_.py falló.")
    sys.stdout.flush()
    sys.exit(ret2)

print("\nMAIN0.py - completado correctamente.")
sys.stdout.flush()