# Archivo principal que usa MAIN.py
input_main = "inputs/allBuildings.txt"

# Archivo exportado desde ArcGIS (REFCAT;...;CUSEC)
input_arcgis = "inputs/Input_ed_Lorca.csv"

# Archivo de salida
output_file = "inputs/allBuildings_cusec.txt"

# 1. Cargar REFCAT → CUSEC desde ArcGIS
refcat_to_cusec = {}

with open(input_arcgis, "r", encoding="utf-8") as f:
    for line in f:
        parts = line.strip().split(";")
        if len(parts) < 7:
            continue
        refcat = parts[0]
        cusec = parts[6]
        refcat_to_cusec[refcat] = cusec

# 2. Leer allBuildings.txt y añadir CUSEC
with open(input_main, "r", encoding="utf-8") as fin, \
     open(output_file, "w", encoding="utf-8") as fout:

    for line in fin:
        parts = line.strip().split()
        refcat = parts[3]

        cusec = refcat_to_cusec.get(refcat, "0000000000")  # por si falta alguno

        parts.append(cusec)
        fout.write(" ".join(parts) + "\n")

print("Archivo generado con éxito:", output_file)
