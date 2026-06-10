/**
 * barrierLayer.js
 * Expone buildBarrierLayer(barrierDataArray) → L.layerGroup
 * Llamado por mapSetting.js al construir las capas de cada site.
 *
 * Niveles de barrera (basados en la comparación debris vs gap libre):
 *   barrier_level 3  →  ROJO    — debris_m > gap_real_m
 *                        Los escombros ocupan más espacio que el hueco libre.
 *   barrier_level 2  →  NARANJA — debris_m ≤ gap_real_m  y  gap ≤ 4 m
 *                        El paso es estrecho aunque los escombros no lo colapsen.
 *   barrier_level 1  →  AMARILLO— debris_m ≤ gap_real_m  y  gap > 4 m
 *                        Paso posible; los escombros son menores que el espacio libre.
 *
 * barrier_type:
 *   "buffer-buffer"    → dos buffers de escombros enfrentados
 *   "buffer-building"  → un buffer de escombros alcanza la huella de un edificio vecino
 *
 * Campos extra en cada barrera (v7):
 *   gap_real_m    → distancia real medida entre los dos polígonos (metros)
 *   debris_m      → espacio total ocupado por escombros en el corredor (metros)
 *   buff_dist_m   → [dist_buffer_A, dist_buffer_B] — BUFF_DIST original de GENERATE_BUFFERS
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN VISUAL
// ─────────────────────────────────────────────────────────────────────────────

var BARRIER_STYLE = {
    3: { color: '#e61f1f', label: 'Level 3 — debris > gap' },
    2: { color: '#f76707', label: 'Level 2 — gap ≤ 4 m' },
    1: { color: '#f5e100', label: 'Level 1 — gap > 4 m' },
};

var BARRIER_ICON_SIZE = 36;
var BARRIER_IMG_SRC   = 'css/barrera.png';

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: tamaño del icono según zoom
// ─────────────────────────────────────────────────────────────────────────────
function getBarrierIconSize(zoom) {
    if (zoom >= 17) return 40;
    if (zoom >= 15) return 32;
    if (zoom >= 13) return 26;
    return 20;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: icono de barrera
// ─────────────────────────────────────────────────────────────────────────────
function makeBarrierIcon(level, zoom) {
    var style = BARRIER_STYLE[level] || BARRIER_STYLE[1];
    var sz    = getBarrierIconSize(zoom);
    var r     = sz / 2;

    var imgSz  = Math.round(sz * 0.68);
    var imgOff = Math.round((sz - imgSz) / 2);

    var html =
        '<div style="' +
            'width:' + sz + 'px;' +
            'height:' + sz + 'px;' +
            'border-radius:50%;' +
            'background:' + style.color + ';' +
            'box-shadow:0 2px 6px rgba(0,0,0,0.45);' +
            'display:flex;align-items:center;justify-content:center;' +
        '">' +
            '<img src="' + BARRIER_IMG_SRC + '" ' +
                 'width="' + imgSz + '" ' +
                 'height="' + imgSz + '" ' +
                 'style="display:block;filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))" ' +
                 'draggable="false"/>' +
        '</div>';

    return L.divIcon({
        className: '',
        html: html,
        iconSize: [sz, sz],
        iconAnchor: [r, r],
        popupAnchor: [0, -(r + 6)],
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL: construir capa de barreras
// ─────────────────────────────────────────────────────────────────────────────
function buildBarrierLayer(barrierDataArray) {
    var group = L.layerGroup();

    if (!barrierDataArray || barrierDataArray.length === 0) {
        console.warn('[barrierLayer] Array vacío, no se crean marcadores.');
        return group;
    }

    barrierDataArray.forEach(function (barrier) {
        var lat   = barrier.centroid[0];
        var lng   = barrier.centroid[1];
        var ids   = barrier.building_ids  || [];
        var blvl  = barrier.barrier_level || 1;
        var btype = barrier.barrier_type  || 'buffer-buffer';
        var style = BARRIER_STYLE[blvl]   || BARRIER_STYLE[1];

        var typeLabel = (btype === 'buffer-building')
            ? 'Debris⭕ → Building🏠'
            : 'Debris⭕ → Debris⭕';

        var distStr = (barrier.dist_to_road_m !== undefined && barrier.dist_to_road_m !== null)
            ? barrier.dist_to_road_m + ' m'
            : '—';

        var gapStr = (barrier.gap_real_m !== undefined && barrier.gap_real_m !== null)
            ? barrier.gap_real_m + ' m'
            : '—';

        var debrisStr = (barrier.debris_m !== undefined && barrier.debris_m !== null)
            ? barrier.debris_m + ' m'
            : '—';

        var buffDistArr = barrier.buff_dist_m || [];
        var buffDistStr = buffDistArr.length
            ? buffDistArr.map(d => d !== null ? d + ' m' : '—').join(' / ')
            : '—';

        var marker = L.marker([lat, lng], {
            icon: makeBarrierIcon(blvl, map.getZoom()),
            keyboard: false,
            riseOnHover: true,
            riseOffset: 250,
            barrierLevel: blvl,
            barrierType: btype,
        });

        var BARRIER_DESCRIPTION = {
            3: "Debris fields occupy more space than the free passage — crossing is critically obstructed.",
            2: "Free gap is narrow (≤ 4 m); debris does not fully block but passage is very restricted.",
            1: "Debris is smaller than the free gap (> 4 m); passage remains possible with caution."
        };
        var BARRIER_BADGE = {
            3: "Critical",
            2: "Restricted",
            1: "Caution"
        };

        var desc  = BARRIER_DESCRIPTION[blvl] || "";
        var badge = BARRIER_BADGE[blvl]        || "";

        // ── Popup HTML: Variant A ─────────────────────────────────────────────
        // Estilos inline para que funcionen sin depender de CSS externo
        var hdrBg   = style.color;
        var rowStyle = "display:flex;align-items:center;justify-content:space-between;" +
                       "font-size:12px;padding:4px 0;border-bottom:0.5px solid #e8e8e8;";
        var lblStyle = "color:#6b7280;display:flex;align-items:center;gap:5px;";
        var valStyle = "font-weight:500;color:#111827;text-align:right;max-width:160px;";

        var popupHtml =
            "<div style='font-family:sans-serif;min-width:260px;max-width:300px;width:100%;box-sizing:border-box;" +
                        "position:relative;background:#ffffff;border-radius:10px;overflow:hidden;border:none;margin:0;'>" +

            // ── Header
            "  <div style='background:" + hdrBg + ";padding:10px 14px;" + 
                "display:flex;align-items:center;gap:8px;position:relative;'>" +
            "    <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' " +
                      "fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
            "      <path d='M3 7h18M3 17h18M6 7v10M18 7v10M9 7v2M12 7v2M15 7v2M9 15v2M12 15v2M15 15v2'/>" +
            "    </svg>" +
            "    <div style='flex:1;'>" +
            "      <p style='margin:0;font-size:13px;font-weight:500;color:#fff;'>Debris Barrier</p>" +
            "      <p style='margin:0;font-size:11px;color:rgba(255,255,255,0.85);'>" + style.label + "</p>" +
            "    </div>" +
            "    <span style='font-size:10px;font-weight:500;background:rgba(255,255,255,0.22);" +
                             "color:#fff;padding:2px 8px;border-radius:20px;margin-right:22px;'>" + badge + "</span>" +
            "  </div>" +

            // ── Description
            "  <p style='margin:0;padding:9px 14px 4px;font-size:12px;color:#6b7280;line-height:1.5;'>" +
                 desc +
            "  </p>" +

            // ── Rows
            "  <div style='padding:4px 14px 12px;display:flex;flex-direction:column;gap:2px;'>" +

            "    <div style='" + rowStyle + "'>" +
            "      <span style='" + lblStyle + "'>" +
            "        <svg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' " +
                          "fill='none' stroke='#6b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
            "          <path d='M5 12h14M5 12l4-4M5 12l4 4M19 12l-4-4M19 12l-4 4'/>" +
            "        </svg>" +
            "        Free gap" +
            "      </span>" +
            "      <span style='" + valStyle + "'>" + gapStr + "</span>" +
            "    </div>" +

            "    <div style='" + rowStyle + "'>" +
            "      <span style='" + lblStyle + "'>" +
            "        <svg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' " +
                          "fill='none' stroke='#6b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
            "          <path d='M3 6h18M3 12h18M3 18h18'/>" +
            "        </svg>" +
            "        Debris width" +
            "      </span>" +
            "      <span style='" + valStyle + "'>" + debrisStr + "</span>" +
            "    </div>" +

            "    <div style='" + rowStyle + "'>" +
            "      <span style='" + lblStyle + "'>" +
            "        <svg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' " +
                          "fill='none' stroke='#6b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
            "          <rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/>" +
            "          <rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/>" +
            "        </svg>" +
            "        REFCATs" +
            "      </span>" +
            "      <span style='" + valStyle + "'>" + ids.join(' / ') + "</span>" +
            "    </div>" +

            "    <div style='display:flex;align-items:center;justify-content:space-between;" +
                            "font-size:12px;padding:4px 0;'>" +
            "      <span style='" + lblStyle + "'>" +
            "        <svg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' " +
                          "fill='none' stroke='#6b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
            "          <circle cx='12' cy='12' r='9'/><path d='M12 8v4l3 3'/>" +
            "        </svg>" +
            "        Type" +
            "      </span>" +
            "      <span style='" + valStyle + "'>" + typeLabel + "</span>" +
            "    </div>" +

            "  </div>" +
            "</div>";

        marker.bindPopup(popupHtml, {
            maxWidth: 320,
            minWidth: 280,
            className: 'barrier-popup',
            offset: [0, -10]
        });

        group.addLayer(marker);
    });

    // Log resumen
    var labels = {
        3: 'debris > gap (rojo)',
        2: 'gap ≤ 4 m (naranja)',
        1: 'gap > 4 m (amarillo)'
    };
    [3, 2, 1].forEach(function (lvl) {
        var n = barrierDataArray.filter(b => b.barrier_level === lvl).length;
        console.log('[barrierLayer] Nivel ' + lvl + ' (' + labels[lvl] + '): ' + n + ' marcadores');
    });

    console.log('[barrierLayer] Total: ' + barrierDataArray.length + ' marcadores creados.');

    return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: filtrar barreras por nivel (3=rojo, 2=naranja, 1=amarillo)
// ─────────────────────────────────────────────────────────────────────────────
function filterBarriersByLevel(barrierDataArray, level) {
    return (barrierDataArray || []).filter(b => b.barrier_level === level);
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTO: actualizar iconos al hacer zoom
// ─────────────────────────────────────────────────────────────────────────────
map.on('zoomend', function () {
    var zoom = map.getZoom();
    group.eachLayer(function (marker) {
        var lvl = marker.options.barrierLevel;
        marker.setIcon(makeBarrierIcon(lvl, zoom));
    });
});