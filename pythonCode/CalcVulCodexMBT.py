import pandas as pd

# 1. Cargamos el archivo CSV. Este csv ha sido previamente limpiado en Arcgis Pro
try:
    df = pd.read_csv('inputs/PuertoLumbreras/allBuildings_cusec_PL_sinVulCode.csv', sep='\t', encoding='utf-16', index_col=False)
except UnicodeDecodeError:
    # Si utf-16 falla por alguna razón, intentamos con utf-8 o latin1
    df = pd.read_csv('inputs/PuertoLumbreras/allBuildings_cusec_PL_sinVulCode.csv', sep='\t', encoding='latin1', index_col=False)
# 2. Función de clasificación 
def clasificar_vulnerabilidad(fila):
    codigo = str(fila['MBT']).strip().upper()
    pisos = fila['numFloors']
    
    # M11
    if codigo == 'M11':
        return 'M11-PRE-L' if pisos <= 2 else 'M11-PRE-M'
    
    # M31
    elif codigo == 'M31':
        if pisos <= 2: return 'M31-PRE-L'
        elif 2 < pisos <= 5: return 'M31-PRE-M'
        else: return 'M31-PRE-H'
        
    # M34
    elif codigo == 'M34':
        if pisos <= 2: return 'M34-PRE-L'
        elif 2 < pisos <= 5: return 'M34-PRE-M'
        else: return 'M34-PRE-H'
            
    # RC31-DCL y RC31-DCM
    elif codigo in ['RC31-DCL', 'RC31-DCM']:
        if pisos <= 3: return 'RC31-LOW-L'
        elif 3 < pisos <= 7: return 'RC31-LOW-M'
        else: return 'RC31-LOW-H'
        
    # RC31-PRE
    elif codigo == 'RC31-PRE':
        if pisos <= 3: return 'RC31-PRE-L'
        elif 3 < pisos <= 7: return 'RC31-PRE-M'
        else: return 'RC31-PRE-H'
        
    else:
        return 'No_Clasificado'

# 3. Cambiamos comas por puntos para mantener la estructura que pide RISK_.py
df['Lon'] = df['Lon'].astype(str).str.replace(',', '.')
df['Lat'] = df['Lat'].astype(str).str.replace(',', '.')
                                              
# 4. Cargamos los resultados en la columna VulCode
df['VulCode'] = df.apply(clasificar_vulnerabilidad, axis=1)

# 5. Reordenamos las columnas para que 'VulCode' esté en la posición que pide RISK_.py y eliminamos 'MBT'
columnas = list(df.columns)
indice_mbt = columnas.index('MBT')
columnas.insert(indice_mbt, columnas.pop(columnas.index('VulCode')))
columnas.remove('MBT')
df_final = df[columnas]

# 6. Guardardamos el fichero en txt como lo pide RISK_.py
df_final.to_csv('inputs/PuertoLumbreras/allBuildings_cusec_PL.txt', sep='\t', index=False, header=False, encoding='utf-8')

print("Archivo procesado con éxito.")
