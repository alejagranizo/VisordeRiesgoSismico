# VisordeRiesgoSismico — MERISUR

Visor de Riesgo Sísmico desarrollado como Trabajo de Fin de Grado (TFG) en la Universidad Politécnica de Madrid, Departamento de Topografía y Cartografía.

Permite calcular y visualizar el daño sísmico esperado sobre edificios de Lorca y Puerto Lumbreras (Murcia) ante distintos escenarios de terremoto, incluyendo estimación de escombros y análisis por secciones censales.

---

## Tecnologías

- **Backend:** Node.js + Express
- **Frontend:** HTML, CSS, JavaScript, Leaflet.js
- **Cálculo sísmico:** Python 3.10 (geopandas, shapely, pygmm, scipy, pyproj, geopy)
- **Base de datos:** MongoDB
- **Modelo sísmico:** Akkar-Sandikkaya-Bommer 2014

---

## Requisitos previos

- Node.js v18 o superior
- Python 3.10
- MongoDB (local o Atlas)
- Git + Git LFS

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/alejagranizo/VisordeRiesgoSismico.git
cd VisordeRiesgoSismico
```

### 2. Instalar dependencias Node.js

```bash
npm install
```

### 3. Crear entorno virtual Python e instalar dependencias

```bash
python -m venv pythonCode/env
pythonCode\env\Scripts\activate      # Windows
pip install -r requirements.txt
```

### 4. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/merisurDB
SESSION_SECRET=tu_secreto_aqui
MAIN_PATH=ruta_absoluta/pythonCode/MAIN.py
MAIN_Secc_PATH=ruta_absoluta/pythonCode/MAIN0.py
FAULT_JSON=ruta_absoluta/pythonCode/inputs/fault_params.json
PYTHON_CODE_PATH=ruta_absoluta/pythonCode
PYTHON_EXE=ruta_absoluta/pythonCode/env/Scripts/python.exe
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=tu_correo@gmail.com
MAIL_PASS=tu_contraseña_de_aplicacion_gmail
TECH_EMAIL=correo_administrador@dominio.com
APP_URL=http://localhost:3000
```

> **Nota:** `MAIL_PASS` no es la contraseña normal de Gmail. Es una contraseña de aplicación generada en **Cuenta de Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones**.

### 5. Generar los buffers de escombros (primera vez)

Los archivos GeoJSON de buffers no están en el repositorio y deben generarse antes de ejecutar el cálculo sísmico:

```bash
cd pythonCode
python GENERATE_BUFFERS.py
```

Esto genera los archivos `allBuffers_Lorca1-4.geojson` necesarios para el cálculo.

### 6. Arrancar el servidor

```bash
npm start
```

La aplicación estará disponible en `http://localhost:3000`.

---

## Estructura del proyecto

```
merisurNode/
├── app.js                  # Servidor principal Node.js
├── routes/                 # Rutas Express (auth, data)
├── public/                 # Frontend (HTML, CSS, JS, datos GIS)
│   └── newData/            # Geometrías JS de secciones censales
├── pythonCode/             # Módulos de cálculo sísmico en Python
│   ├── MAIN.py             # Cálculo por edificio (escenario manual)
│   ├── MAIN0.py            # Orquestador (RISK_ + BUFF_)
│   ├── RISK_.py            # Cálculo de daño por sección censal
│   ├── BUFF_.py            # Fusión geometría + resultados
│   ├── GENERATE_BUFFERS.py # Generación de buffers de escombros
│   ├── inputs/             # Datos de entrada (shapefiles, txt)
│   └── output/             # Resultados generados (ignorado en git)
├── requirements.txt        # Dependencias Python
├── package.json            # Dependencias Node.js
└── .env.example            # Plantilla de configuración
```

---

## Uso

1. Accede a `http://localhost:3000` e inicia sesión.
2. Selecciona una falla sísmica y configura el escenario (magnitud, mecanismo focal, probabilidad).
3. Pulsa **Calcular** — el sistema ejecuta los scripts Python en segundo plano.
4. El mapa se actualiza con los resultados: daño por edificio, escombros y análisis por sección censal.

---

## Datos de entrada requeridos

Los siguientes archivos deben estar presentes en `pythonCode/inputs/` y se incluyen en el repositorio via Git LFS:

- `Lorca/allBuildings_Lorca.txt` — inventario de edificios de Lorca
- `Lorca/shapefiles/EdificiosLorca2026.shp` — polígonos de edificios
- `Lorca/shapefiles/LorcaSoil_WGS.*` — mapa de suelos Vs30
- `PuertoLumbreras/allBuildings_PL.txt` — inventario de edificios de Puerto Lumbreras
- `PuertoLumbreras/shapefiles/EdificiosPuertoLumbreras.shp`
- `inputs/params.xlsx` — tablas de vulnerabilidad y escombros

---

## Autora

**Alejandra Granizo**  
Departamento de Topografía y Cartografía  
Universidad Politécnica de Madrid  
Mayo 2026
