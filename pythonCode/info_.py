# info_.py
import os

# carpeta donde está este archivo (pythonCode/)
BASE = os.path.dirname(os.path.abspath(__file__))

# raíz del proyecto (un nivel arriba de pythonCode/)
ROOT = os.path.dirname(BASE)

# rutas de I/O
inputpath  = os.path.join(BASE, "inputs") + os.sep
outputpath = os.path.join(BASE, "output") + os.sep

# geometrías JS de entrada (en public/newData/)
js_data_dir = os.path.join(ROOT, "public", "newData")
sscc_js     = "SSCCEnd_Completo.js"
sscc_js_pl  = "SSCCEnd_PL.js"

# shapefiles (en inputs/)
secciones_shp    = os.path.join("Lorca", "SSCC_Lorca_Completo.shp")
secciones_shp_pl = os.path.join("PuertoLumbreras", "SSCC_PLum.shp")      # campo Vs30: Max_Id

# archivos de salida de RISK_ (en output/)
final_result_filename = "resultSSCC.js"  # combinado (solo referencia, BUFF_ usa los individuales)

