const express      = require('express');
const { execFile } = require('child_process');
const path         = require('path');
const fs           = require('fs');
const router       = express.Router();

// Entorno con UTF-8 forzado para todos los subprocesos Python
const PY_ENV = { ...process.env, PYTHONIOENCODING: 'utf-8' };

// Normalización del mecanismo focal
// 'S' añadido para cubrir abreviatura corta de StrikeSlip
const FM_MAP = {
  'SS': 'SS', 'StrikeSlip':     'SS', 'S':  'SS',
  'N':  'NS', 'Normal':         'NS',
  'R':  'RS', 'Reverse':        'RS',
  'SR': 'RS', 'RS':             'RS',
  'NR': 'RS', 'ReverseOblique': 'RS',
  'NS': 'NS', 'NormalOblique':  'NS',
  'U':  'SS', 'Unknown':        'SS',
};

// ── Control de proceso Python activo ─────────────────────────────────────────
// Evita que dos cálculos corran en paralelo y corrompan los ficheros de salida.
let activePythonProcess = null;

function killActiveProcess() {
  if (activePythonProcess && !activePythonProcess.killed) {
    console.log('[/createData] Matando proceso Python anterior (PID ' + activePythonProcess.pid + ')...');
    activePythonProcess.kill('SIGTERM');
  }
  activePythonProcess = null;
}

// ── Script maestro SSCC (MAIN0.py) ───────────────────────────────────────────
function runMainSSCC(callback) {
  const proc = execFile(process.env.PYTHON_EXE, [
    path.join(process.env.PYTHON_CODE_PATH, 'MAIN0.py')
  ], {
    cwd:     process.env.PYTHON_CODE_PATH,
    timeout: 600000,   // 10 min
    env:     PY_ENV,
  }, (err, stdout, stderr) => {
    activePythonProcess = null;
    callback(err, stdout, stderr);
  });
  activePythonProcess = proc;
}

// ── Script de secciones censales (mantenido para compatibilidad) ──────────────
function runMain0(callback) {
  execFile(process.env.PYTHON_EXE, [process.env.MAIN_Secc_PATH], {
    cwd:     process.env.PYTHON_CODE_PATH,
    timeout: 300000,
    env:     PY_ENV,
  }, callback);
}

// ─────────────────────────────────────────────────────────────────────────────
router.get('/createData', (req, res) => {

  console.log('[DEBUG] Query recibida:', JSON.stringify(req.query));

  const fmRaw = (req.query.FM || 'U').toString().trim();
  const fm    = FM_MAP[fmRaw] || 'SS';  // fallback a SS en lugar de U

  killActiveProcess();

  // ── Rama usuario autenticado: cálculo por edificios (MAIN.py) ────────────
  if (req.session.usuario) {

    // Cat_Fault en info.py espera:
    //   faultArray[0] = lat  (~37.x, latitud)
    //   faultArray[1] = long (~-1.x, longitud)
    // El frontend envía lat=37.x y lng=-1.x correctamente → sin swap.
    // Los metadatos (Id, FN, SN, Area, NetSlipRat) van solo al log,
    // NO se pasan a Python para evitar que Cat_Fault los interprete.
    const args = [
      process.env.MAIN_PATH,
      req.query.caseValue ?? '0',
      req.query.lat,    // faultArray[0] → lat (~37.x) ✓
      req.query.lng,    // faultArray[1] → lng (~-1.x) ✓
      req.query.Mag,
      req.query.Strike,
      req.query.Dip,
      fm,
      req.query.Length,
      req.query.Ztop,
      req.query.Width,
    ];

    console.log(
      `[/createData] Edificios — Falla: Id=${req.query.Id} | ` +
      `FN=${req.query.FN} | FM_raw=${fmRaw} → FM=${fm} | ` +
      `Area=${req.query.Area} | NetSlipRat=${req.query.NetSlipRat}`
    );
    console.log(`[/createData] Args Python (caseValue lat lng ...): ${args.slice(1).join(' ')}`);

    const proc = execFile(process.env.PYTHON_EXE, args,
      { cwd: process.env.PYTHON_CODE_PATH, timeout: 300000, env: PY_ENV },
      (err, stdout, stderr) => {
        activePythonProcess = null;
      if (err) {
          // Detectar error de distancia excesiva para dar mensaje útil al usuario
          const stderrStr = (stderr || '').toString();
          const distMatch = stderrStr.match(/DISTANCE_ERROR:(.+)/s);
          if (distMatch) {
            const userMsg = distMatch[1].trim().replace(/\n.*/s, '');
            console.warn('[/createData] Distancia excesiva (edificios):', userMsg);
            return res.status(400).json({ userError: userMsg });
          }
          console.error('[/createData] Error MAIN.py:\n', stderr);
          return res.status(500).send(stderr || err.message);
        }
        if (stdout) console.log('[/createData] MAIN.py stdout:', stdout);
        runMain0((err2, stdout2, stderr2) => {
          if (err2) {
            console.error('[/createData] Error MAIN0/Secc:\n', stderr2);
            return res.status(500).send(stderr2 || err2.message);
          }
          res.json({ ok: true, mode: 'edificio' });
        });
      }
    );
    activePythonProcess = proc;

  // ── Rama sin sesión: cálculo por secciones censales (MAIN0.py) ───────────
  } else {

    // MAIN0.py lee lat/lng desde fault_params.json con nombres explícitos,
    // sin pasar por Cat_Fault → sin swap, lat y lng tal como llegan.
    const params = {
      lat:       parseFloat(req.query.lat),
      lng:       parseFloat(req.query.lng),
      mag:       parseFloat(req.query.Mag),
      strike:    parseFloat(req.query.Strike),
      dip:       parseFloat(req.query.Dip),
      mechanism: fm,
      length:    parseFloat(req.query.Length),
      ztop:      parseFloat(req.query.Ztop),
      width:     parseFloat(req.query.Width),
      scenario:  parseInt(req.query.caseValue),
      Id:        req.query.Id || '',
    };

    try {
      fs.writeFileSync(process.env.FAULT_JSON, JSON.stringify(params, null, 2));
    } catch (writeErr) {
      return res.status(500).send(`Error guardando parámetros del terremoto: ${writeErr.message}`);
    }

    console.log(`[/createData] SSCC — Iniciando MAIN0.py para terremoto ID=${params.Id}`);
    console.log(`[/createData] Coordenadas → lat=${params.lat} lng=${params.lng} FM=${fm}`);

    runMainSSCC((err, stdout, stderr) => {
      if (err) {
        // Detectar error de distancia excesiva para dar mensaje útil al usuario
        const stderrStr = (stderr || '').toString();
        const distMatch = stderrStr.match(/DISTANCE_ERROR:(.+)/s);
        if (distMatch) {
          const userMsg = distMatch[1].trim().replace(/\n.*/s, '');
          console.warn('[/createData] Distancia excesiva:', userMsg);
          return res.status(400).json({ userError: userMsg });
        }
        console.error('[/createData] Error MAIN0.py:', stderr);
        return res.status(500).send(stderr || err.message);
      }
      console.log('[/createData] ✓ MAIN0.py completado exitosamente');
      if (stdout) console.log('[/createData] Salida Python:', stdout);
      res.json({ ok: true, mode: 'sscc' });
    });
  }
});

module.exports = router;