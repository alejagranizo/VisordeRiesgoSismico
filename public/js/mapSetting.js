// mapSetting.js
// Funciones de estilo, construcción de capas y helpers.
// Las capas NO se instancian aquí: lo hace siteSwitcher.js al arrancar.

// ── Mapa base ─────────────────────────────────────────────────────────────────
var peninsulaBounds = L.latLngBounds(
    L.latLng(35.0, -10.5),   // SW: sur de Canarias / Estrecho
    L.latLng(44.5,  5.0)    // NE: Pirineos / Costa Mediterránea
);

var map = new L.map('map', {
    zoomControl: false,
    maxZoom: 28,
    minZoom: 7,
    maxBounds: peninsulaBounds,
    maxBoundsViscosity: 1.0
}).setView([37.6710, -1.6982], 14);

var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 28,
    maxNativeZoom: 19
}).addTo(map);

var pnoa = L.tileLayer.wms("https://www.ign.es/wms-inspire/pnoa-ma", { // Usa HTTPS
    layers: "OI.OrthoimageCoverage",
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    attribution: "PNOA WMS © Instituto Geográfico Nacional de España",
    maxZoom: 28,          // Permite que la capa "exista" hasta el zoom máximo del mapa
    maxNativeZoom: 19     // El zoom real máximo donde el IGN tiene fotos (evita que desaparezca)
});

new L.control.scale({ maxWidth: 240, metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
new L.Control.Zoom({ position: 'bottomleft' }).addTo(map);

// ── Datos indexados por site ──────────────────────────────────────────────────
//
// CONVENCIÓN DE NOMBRES DE VARIABLES JS:
//   Cada fichero .js de datos debe declarar su variable CON SUFIJO de site:
//
//   EdificioEnd_LORCA.js    → var json_Edificios_LORCA = {...}
//   EdificioEnd_PL.js       → var json_Edificios_PL    = {...}
//   SinConstrucionEnd_LORCA.js → var json_SinConstruccion_LORCA = {...}
//   SinConstrucionEnd_PL.js    → var json_SinConstruccion_PL    = {...}
//   result_LORCA.js         → var excelData_LORCA = [...]
//   result_PL.js            → var excelData_PL    = [...]
//   Colored_Buffers_LORCA.js → var json_Bufferin_LORCA = {...}
//   Colored_Buffers_PL.js   → var json_Bufferin_PL    = {...}
//   barriers_LORCA.js       → var barrierData_LORCA = [...]
//   barriers_PL.js          → var barrierData_PL    = [...]
//
// Si alguno de tus ficheros legacy declara la variable SIN sufijo (p.ej.
// "var json_Edificios = {...}"), añade abajo el alias correspondiente:
//
//   if (typeof json_Edificios !== 'undefined' && typeof json_Edificios_LORCA === 'undefined')
//       var json_Edificios_LORCA = json_Edificios;
//
// ─────────────────────────────────────────────────────────────────────────────

// Aliases de compatibilidad: si los ficheros no llevan sufijo, los mapeamos.
// Edificios LORCA
if (typeof json_Edificios        !== 'undefined' &&
    typeof json_Edificios_LORCA  === 'undefined') {
    // eslint-disable-next-line no-var
    var json_Edificios_LORCA = json_Edificios;
}
// SinConstruccion LORCA
if (typeof json_SinConstruccion       !== 'undefined' &&
    typeof json_SinConstruccion_LORCA === 'undefined') {
    var json_SinConstruccion_LORCA = json_SinConstruccion;
}
// excelData LORCA
if (typeof excelData       !== 'undefined' &&
    typeof excelData_LORCA === 'undefined') {
    var excelData_LORCA = excelData;
}
// Bufferin LORCA
if (typeof json_Bufferin       !== 'undefined' &&
    typeof json_Bufferin_LORCA === 'undefined') {
    var json_Bufferin_LORCA = json_Bufferin;
}
// barrierData LORCA
if (typeof barrierData       !== 'undefined' &&
    typeof barrierData_LORCA === 'undefined') {
    var barrierData_LORCA = barrierData;
}

window.SITE_DATA = {
    LORCA: {
        label:  'Lorca',
        center: [37.6710, -1.6982],
        zoom:   14,
        get sinConstruccion() { return typeof json_SinConstruccion_LORCA !== 'undefined' ? json_SinConstruccion_LORCA : null; },
        get edificios()       { return typeof json_Edificios_LORCA       !== 'undefined' ? json_Edificios_LORCA       : null; },
        get excelData()       { return typeof excelData_LORCA            !== 'undefined' ? excelData_LORCA            : [];   },
        get bufferin()        { return typeof json_Bufferin_LORCA        !== 'undefined' ? json_Bufferin_LORCA        : null; },
        get barrierData()     { return typeof barrierData_LORCA          !== 'undefined' ? barrierData_LORCA          : [];   },
    },
    PL: {
        label:  'Puerto Lumbreras',
        center: [37.5680, -1.8100],
        zoom:   14,
        get edificios()   { return typeof json_Edificios_PL   !== 'undefined' ? json_Edificios_PL   : null; },
        get excelData()   { return typeof excelData_PL        !== 'undefined' ? excelData_PL        : [];   },
        get bufferin()    { return typeof json_Bufferin_PL    !== 'undefined' ? json_Bufferin_PL    : null; },
        get barrierData() { return typeof barrierData_PL      !== 'undefined' ? barrierData_PL      : [];   },
    }
};

// ── Site activo (mantenido por siteSwitcher.js) ───────────────────────────────
window.activeSite = 'LORCA';

// Helper: devuelve los datos del site activo
function siteData() {
    return window.SITE_DATA[window.activeSite];
}

// Helper: devuelve el grupo GeoJSON visible entre los tres modos temáticos
function getActiveGroup() {
    if (window.EdificiosDanio && map.hasLayer(window.EdificiosDanio)) return window.EdificiosDanio;
    if (window.EdificiosVuln  && map.hasLayer(window.EdificiosVuln))  return window.EdificiosVuln;
    return window.Edificios;
}

// ── Estilos ───────────────────────────────────────────────────────────────────
function style_SinContrucion() {
    return {
        opacity: 1, color: 'rgb(198,193,198)', lineCap: 'butt',
        lineJoin: 'miter', weight: 0.2, fillOpacity: 1,
        fillColor: 'rgba(198,193,198,0.8)'
    };
}

function style_Edificios() {
    return {
        opacity: 1, color: 'rgb(117,68,240)', lineCap: 'butt',
        lineJoin: 'miter', weight: 0.2, fillOpacity: 1,
        fillColor: 'rgb(205,151,234)'
    };
}

function style_Buffer_01(d) {
    return d > 0.1   ? 'rgb(100,0,0)'    :
           d > 0.01  ? 'rgb(178,38,0)'   :
           d > 0.001 ? 'rgb(210,105,0)'  :
           d > 0.0   ? 'rgb(218,165,32)' :
                       'rgba(255,255,255,0)';
}

function style_B(feature) {
    return {
        fillColor:   style_Buffer_01(feature.properties.COLOR),
        weight:      1, opacity: 1,
        color:       style_Buffer_01(feature.properties.COLOR),
        fillOpacity: 0.9
    };
}

function setVulColor(d) {
    switch (d) {
        case 'M11-PRE':  return "rgb(26,83,255)";
        case 'M31-PRE':  return "rgb(0,153,255)";
        case 'M34-PRE':  return "rgb(204,0,204)";
        case 'RC31-PRE': return "rgb(170,231,108)";
        case 'RC31-LOW': return "rgb(102,153,0)";
        default:         return 'rgba(238,234,66,0.3)';
    }
}

function setDanColor(d) {
    switch (d) {
        case 'Complete':  return "#7E080C";
        case 'Extensive': return "#DE2D26";
        case 'Moderate':  return "#FB6A4A";
        case 'Sligth':    return "#FCAE91";
        case 'None':      return "rgb(205,151,234)";
        default:          return 'rgba(238,234,66,0.3)';
    }
}

// ── Popup helpers ─────────────────────────────────────────────────────────────
function buildDetalleHtml(rc, feature) {
    var d = "";
    d += "<h2>Building Information</h2>";
    d += "<p class='text' id='buildingDataF' onclick='hideBuildingData()'><strong><i class='fa fa-plus-square-o'></i>  Building ID: </strong>" + rc + "</p>";
    d += "<div id='buildingData' class='hideClass'>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> Nº Stories: </strong>" + feature.properties['H_MAX'] + "</p>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> Date: </strong>" + feature.properties['YEAR'] + "</p>";
    d += "</div>";
    d += "<p class='text' id='vulnerF' onclick='hideVulner()'><strong><i class='fa fa-plus-square-o'></i>  Vulnerability: </strong>" + feature.properties["Vulnerabilidad"] + "</p>";
    d += "<div id='vulner' class='hideClass'>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> info: </strong>" + feature.properties['ojo'] + "</p>";
    d += "</div>";
    d += "<p class='text' id='groundMotionF' onclick='hideGroundMotion()'><strong><i class='fa fa-plus-square-o'></i>  Ground Motion</strong></p>";
    d += "<div id='groundMotion' class='hideClass'>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> Soil Class: </strong>" + feature.properties['Suelo'] + "</p>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> PGA (g): </strong>" + feature.properties['PGA'] + "</p>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> SA<sub>Te</sub> (g): </strong>" + feature.properties['SA'] + "</p>";
    d += "</div>";
d += "<p class='text' id='damageF' onclick='hideDamage()'><strong><i class='fa fa-plus-square-o'></i>  Damage: </strong>" + feature.properties["pMean"] + "</p>";    d += "<div id='damage' class='hideClass'>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> Mean Damage: </strong>" + feature.properties['pMean'] + "</p>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> Prob. Complete: </strong>" + feature.properties['pCom'] + "</p>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> Prob. Extensive: </strong>" + feature.properties['pExt'] + "</p>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> Prob. Moderate: </strong>" + feature.properties['pMod'] + "</p>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> Prob. Slight: </strong>" + feature.properties['pLow'] + "</p>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> Prob. No Damage: </strong>" + feature.properties['pNull'] + "</p>";
    d += "</div>";
    d += "<p class='text' id='escomF' onclick='hideEscom()'><strong><i class='fa fa-plus-square-o'></i>  Debris</strong></p>";
    d += "<div id='escom' class='hideClass'>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> total volume (m<sup>3</sup>): </strong>" + feature.properties["totalEscombro"] + "</p>";
    d += "<p class='text'><strong><i class='fa fa-angle-right'></i> thickness (m): </strong>" + feature.properties["perareaunitEscombro"] + "</p>";
    d += "</div>";
    return d;
}

function fillFeatureProps(feature, excelRow) {
    var p = feature.properties;
    p["Vulnerabilidad"] = excelRow.Vulnerabilidad;
    p["SA"]  = excelRow["SA' "] <= 0.001 ? "&lt0.001" : parseFloat(excelRow["SA' "]).toFixed(3);
    p["GradoDanio"] = excelRow["GradoDanio"];
    p["PGA"] = excelRow["PGA"] < 0.001 ? "&lt0.001" : parseFloat(excelRow["PGA"]).toFixed(3);
    p["H_MAX"] = excelRow["floor"] == "0" ? "unknown" : excelRow["floor"];
    p["YEAR"]  = excelRow["year"]  == "0" ? "unknown" : excelRow["year"];
    p["ojo"]   = excelRow["ojo"];
    p["pMean"] = excelRow["pMean"];
    p["pCom"]  = excelRow["pCom"];
    p["pExt"]  = excelRow["pExt"];
    p["pMod"]  = excelRow["pMod"];
    p["pLow"]  = excelRow["pLow"];
    p["pNull"] = excelRow["pNull"];

    var suelo = excelRow["Suelo"];
    var soilMap = { A: "A  (hard rock)", B: "B  (rock)", C: "C  (soft rock)", D: "D  (stiff soil)", E: "E  (soft soil)" };
    p["Suelo"] = soilMap[suelo] || suelo;

    var damageLevel = { Sligth: 1, Moderate: 2, Extensive: 3, Complete: 4 }[excelRow["GradoDanio"]] || 0;
    var facadeLength = excelRow["facadeL"];
    var esc = excelRow["Escombro"];
    if (esc == "-") {
        p["totalEscombro"] = p["perareaunitEscombro"] = 'not estimated yet';
    } else if (parseFloat(esc) < 0) {
        p["totalEscombro"] = p["perareaunitEscombro"] = 'unknown';
    } else {
        p["totalEscombro"]       = (parseFloat(esc) * damageLevel * facadeLength).toFixed(5);
        p["perareaunitEscombro"] = parseFloat(esc).toFixed(5);
    }
}

// ── Fábrica de capas: recibe los GeoJSON y excelData de un site ───────────────
function buildSiteLayers(data) {
    // Índice principal por REFCAT (tal como lo escribe Python en result_*.js)
    var refcatIndex = {};
    // Índice de respaldo por UID numérico
    var uidIndex = {};
    (data.excelData || []).forEach(function (row) {
        if (row.REFCAT !== undefined && row.REFCAT !== null && String(row.REFCAT).trim() !== '') {
            refcatIndex[String(row.REFCAT).trim()] = row;
        }
        if (row.UID !== undefined && row.UID !== null) {
            uidIndex[String(row.UID).trim()] = row;
        }
    });

    // Busca la fila de resultado probando todas las variantes de clave del feature
    function findRow(feature) {
        var rc  = String(feature.properties['REFCAT']   || feature.properties['RefCat']  ||
                         feature.properties['refcat']   || '').trim();
        var uid = String(feature.properties['UID']      || feature.properties['uid']     ||
                         feature.properties['OBJECTID'] || feature.properties['id']      || '').trim();
        return refcatIndex[rc] || uidIndex[uid] || uidIndex[rc] || null;
    }

    function onEachEdificio(feature, layer) {
        // Identificador visible en el panel (Building ID)
        var rc = String(
            feature.properties['REFCAT'] || feature.properties['RefCat'] ||
            feature.properties['refcat'] || ''
        ).trim();

        // Rellenar propiedades sólo una vez: el style function puede haber corrido
        // antes del click y ya haber puesto los valores correctos.
        // La bandera _propsLoaded evita sobreescribir con "unknown" en el segundo paso.
        if (!feature.properties['_propsLoaded']) {
            var row = findRow(feature);
            if (!row) {
                ['Vulnerabilidad','GradoDanio','H_MAX','YEAR','Suelo','PGA','SA',
                 'ojo','pMean','pCom','pExt','pMod','pLow','pNull',
                 'totalEscombro','perareaunitEscombro'].forEach(function (k) {
                    if (feature.properties[k] === undefined) {
                        feature.properties[k] = (k === 'ojo') ? '-' : 'unknown';
                    }
                });
            } else {
                fillFeatureProps(feature, row);
            }
            feature.properties['_propsLoaded'] = true;
        }

        layer.on({
            click: function (e) {
                var html  = buildDetalleHtml(rc, feature);
                var group = getActiveGroup();
                window.openInfoPanel(html, e.target, group);
            },
            mouseover: function (e) {
                if (window.activeFeatureLayer === e.target) return;
                e.target.setStyle({ color: 'rgba(255,255,255,0.8)', fillOpacity: 0.7, weight: 3 });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) e.target.bringToFront();
            },
            mouseout: function (e) {
                if (window.activeFeatureLayer === e.target) return;
                var group = getActiveGroup();
                if (group) group.resetStyle(e.target);
            }
        });
    }

    var layers = {};

    if (data.sinConstruccion) {
        layers.SinContrucion = L.geoJSON(data.sinConstruccion, { style: style_SinContrucion });
    }

    if (data.edificios) {
        layers.Edificios = L.geoJSON(data.edificios, {
            style: style_Edificios,
            onEachFeature: onEachEdificio
        });

        layers.EdificiosVuln = L.geoJSON(data.edificios, {
            style: function (feature) {
                var row = findRow(feature);
                var vul = row ? row.Vulnerabilidad : 'unknown';
                feature.properties["Vulnerabilidad"] = vul;
                return { color: 'rgb(117,68,240)', weight: 0.2, opacity: 1,
                         lineCap: 'butt', lineJoin: 'miter',
                         fillOpacity: 1, fillColor: setVulColor(vul) };
            },
            onEachFeature: onEachEdificio
        });

        layers.EdificiosDanio = L.geoJSON(data.edificios, {
            style: function (feature) {
                var row = findRow(feature);
                var dan = row ? row.pMean : 'unknown';
                feature.properties["pMean"] = dan;
                return { color: 'rgb(117,68,240)', weight: 0.2, opacity: 1,
                         lineCap: 'butt', lineJoin: 'miter',
                         fillOpacity: 1, fillColor: setDanColor(dan) };
            },
            onEachFeature: onEachEdificio
        });

    }
    if (data.bufferin) {
        layers.Buffer = L.geoJSON(data.bufferin, { style: style_B });
    }

    if (data.barrierData && data.barrierData.length > 0) {
        layers.barrierLayer = buildBarrierLayer(data.barrierData);
    } else {
        layers.barrierLayer = L.layerGroup();
    }

    return layers;
}

// ── Toggle helpers (panel de información) ─────────────────────────────────────
function hideBuildingData() {
    $('div#buildingData').toggle("fast");
    $('p#buildingDataF i').toggleClass('fa-plus-square-o fa-minus-square-o');
}
function hideGroundMotion() {
    $('div#groundMotion').toggle("fast");
    $('p#groundMotionF i').toggleClass('fa-plus-square-o fa-minus-square-o');
}
function hideDamage() {
    $('div#damage').toggle("fast");
    $('p#damageF i').toggleClass('fa-plus-square-o fa-minus-square-o');
}
function hideVulner() {
    $('div#vulner').toggle("fast");
    $('p#vulnerF i').toggleClass('fa-plus-square-o fa-minus-square-o');
}
function hideEscom() {
    $('div#escom').toggle("fast");
    $('p#escomF i').toggleClass('fa-plus-square-o fa-minus-square-o');
}