# VisordeRiesgoSismico — MERISUR

Seismic Risk Viewer developed as a Final Degree Project (TFG) at the Universidad Politécnica de Madrid, TERRA Research Group.

The application calculates and visualises the expected seismic damage to buildings in Lorca and Puerto Lumbreras (Murcia, Spain) for user-defined earthquake scenarios, including debris estimation, debris barriers and census-section-level analysis.

> **Acknowledgement:** The original seismic calculation engine (distance metrics, ground motion model, vulnerability and debris functions) was developed by **Pouye Yazdi** at the Universidad Politécnica de Madrid (2017). This project extends and integrates that work.

---

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** HTML, CSS, JavaScript, Leaflet.js
- **Seismic calculation:** Python 3.10 (geopandas, shapely, pygmm, scipy, pyproj, geopy)
- **Database:** MongoDB
- **Ground motion model:** Akkar-Sandikkaya-Bommer 2014

---

## Prerequisites

- Node.js v18 or higher
- Python 3.10
- MongoDB (local or Atlas)
- Git + Git LFS

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/alejagranizo/VisordeRiesgoSismico.git
cd VisordeRiesgoSismico
```

### 2. Install Node.js dependencies

```bash
npm install
```

### 3. Create a Python virtual environment and install dependencies

```bash
python -m venv pythonCode/env
pythonCode\env\Scripts\activate      # Windows
pip install -r requirements.txt
```

### 4. Set up environment variables

Create a `.env` file in the project root based on `.env.example`:

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/merisurDB
SESSION_SECRET=your_secret_here
MAIN_PATH=absolute_path/pythonCode/MAIN.py
MAIN_Secc_PATH=absolute_path/pythonCode/MAIN0.py
FAULT_JSON=absolute_path/pythonCode/inputs/fault_params.json
PYTHON_CODE_PATH=absolute_path/pythonCode
PYTHON_EXE=absolute_path/pythonCode/env/Scripts/python.exe
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_gmail_app_password
TECH_EMAIL=admin_email@domain.com
APP_URL=http://localhost:3000
```

> **Note:** `MAIL_PASS` is not your regular Gmail password. It is an App Password generated at **Google Account → Security → 2-Step Verification → App Passwords**.

### 5. Generate debris buffers (first time only)

Buffer GeoJSON files are not stored in the repository and must be generated before running any seismic scenario:

```bash
cd pythonCode
python GENERATE_BUFFERS.py
```

This produces the `allBuffers_Lorca1-4.geojson` files required by the calculation engine.

### 6. Start the server

```bash
npm start
```

The application will be available at `http://localhost:3000`.

---

## Project Structure

```
merisurNode/
├── app.js                  # Main Node.js server
├── routes/                 # Express routes (auth, data)
├── public/                 # Frontend (HTML, CSS, JS, GIS data)
│   └── newData/            # Census-section geometries as JS files
├── pythonCode/             # Python seismic calculation modules
│   ├── MAIN.py             # Per-building calculation (manual scenario)
│   ├── MAIN0.py            # Orchestrator (RISK_ + BUFF_)
│   ├── RISK_.py            # Damage calculation by census section
│   ├── BUFF_.py            # Geometry + results merger
│   ├── GENERATE_BUFFERS.py # Debris buffer generation
│   ├── inputs/             # Input data (shapefiles, txt)
│   └── output/             # Generated results (git-ignored)
├── requirements.txt        # Python dependencies
├── package.json            # Node.js dependencies
└── .env.example            # Environment variable template
```

---

## Usage

1. Open `http://localhost:3000` and log in.
2. Select a seismic fault and configure the scenario (magnitude, focal mechanism, probability level).
3. Click **Calculate** — the system runs the Python scripts in the background.
4. The map updates with the results: per-building damage, debris volumes, and census-section analysis.

---

## Required Input Data

The following files must be present in `pythonCode/inputs/` and are included in the repository via Git LFS:

- `Lorca/allBuildings_Lorca.txt` — building inventory for Lorca
- `Lorca/shapefiles/EdificiosLorca2026.shp` — building footprints
- `Lorca/shapefiles/LorcaSoil_WGS.*` — Vs30 soil map
- `PuertoLumbreras/allBuildings_PL.txt` — building inventory for Puerto Lumbreras
- `PuertoLumbreras/shapefiles/EdificiosPuertoLumbreras.shp` — building footprints
- `inputs/params.xlsx` — vulnerability and debris parameter tables

---

## Author

**Alejandra Granizo Caballo**
Universidad Politécnica de Madrid
May 2026
