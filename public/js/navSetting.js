/**
 * navSetting.js
 * Controls for two exclusive floating panels: Layers and Legend.
 * - Only one panel can be open at a time
 * - Buttons at top-left with images
 * - Close button (X) at top-right of each panel
 * - Map resizes when panels open/close
 * Compatible with mapSetting.js + siteSwitcher.js (multi-site: LORCA, PL).
 */

// ── Panel state management ────────────────────────────────────────────────────
var panelState = {
    activePanel: null, // 'layers', 'legend', or null
    panelWidth: 260  // Matches --panel-w in CSS (260px)
};

// ── Get CSS variable value ────────────────────────────────────────────────────
function getPanelWidth() {
    var root = document.documentElement;
    var computed = getComputedStyle(root);
    var panelW = computed.getPropertyValue('--panel-w').trim();
    return parseInt(panelW) || 260;
}

// ── Sync button positions when panels change ──────────────────────────────────
function updateButtonPositions() {
    var $layersBtn = $('#btn-fp-layers');
    var $legendBtn = $('#btn-fp-legend');
    var isLayersOpen = !$('#fp-layers').hasClass('hidden');
    var isLegendOpen = !$('#fp-legend').hasClass('hidden');
    var panelW = getPanelWidth();
    var buttonMargin = 14;
    var buttonSize = 44;
    var buttonGap = 10;
    var openButtonLeft = buttonMargin + panelW + buttonGap;

    if (isLayersOpen || isLegendOpen) {
        if (isLayersOpen) {
            $layersBtn.hide();
            $legendBtn.show().css('left', openButtonLeft + 'px');
        } else if (isLegendOpen) {
            $legendBtn.hide();
            $layersBtn.show().css('left', openButtonLeft + 'px');
        }
        $('.contentid').css('margin-left', panelW + 'px');
    } else {
        $layersBtn.show().css('left', buttonMargin + 'px');
        $legendBtn.show().css('left', (buttonMargin + buttonSize + buttonGap) + 'px');
        $('.contentid').css('margin-left', '0');
    }
}

// ── Close panel and trigger map resize ────────────────────────────────────────
function closePanel() {
    var $activePanel = panelState.activePanel ? $('#fp-' + panelState.activePanel) : null;
    if ($activePanel) {
        $activePanel.addClass('hidden');
        panelState.activePanel = null;
        updateButtonPositions();
        setTimeout(function () { 
            if (window.map) window.map.invalidateSize(); 
        }, 280); // Match CSS transition time
    }
}

// ── Open specific panel ───────────────────────────────────────────────────────
function openPanel(panelName) {
    // If same panel is already open, close it
    if (panelState.activePanel === panelName) {
        closePanel();
        return;
    }
    
    // Close previous panel
    if (panelState.activePanel) {
        $('#fp-' + panelState.activePanel).addClass('hidden');
    }
    
    // Open new panel
    panelState.activePanel = panelName;
    $('#fp-' + panelName).removeClass('hidden');
    updateButtonPositions();
    
    setTimeout(function () { 
        if (window.map) window.map.invalidateSize(); 
    }, 280);
}

// ── Panel button handlers ─────────────────────────────────────────────────────
$('#btn-fp-layers').on('click', function (e) {
    e.preventDefault();
    openPanel('layers');
});

$('#btn-fp-legend').on('click', function (e) {
    e.preventDefault();
    openPanel('legend');
});

// ── Close button handlers (X buttons on panels) ───────────────────────────────
$('#close-fp-layers').on('click', function (e) {
    e.preventDefault();
    closePanel();
});

$('#close-fp-legend').on('click', function (e) {
    e.preventDefault();
    closePanel();
});

// Expose for external use
window.showLayersPanel = function () { openPanel('layers'); };
window.hideLayersPanel = function () { closePanel(); };
window.showLegendPanel = function () { openPanel('legend'); };
window.hideLegendPanel = function () { closePanel(); };

// ── Desplegables dentro del panel de Layers ───────────────────────────────────
$(document).on('click', '.selecLayer li:has(a) > a', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var $li   = $(this).parent();
    var $icon = $(this).find('i.masLayer');
    var $sub  = $li.children('ul.sub-selecLayer');

    if ($li.hasClass('activado')) {
        $li.removeClass('activado');
        $sub.slideUp(200);
        $icon.removeClass('fa-angle-up').addClass('fa-angle-down');
    } else {
        $li.addClass('activado');
        $sub.slideDown(200);
        $icon.removeClass('fa-angle-down').addClass('fa-angle-up');
    }
});

$(document).on('click', '.sub-selecLayer', function (e) { e.stopPropagation(); });

// ── Carga inicial ─────────────────────────────────────────────────────────────
function termino() {
    try {
        $('.modal', window.parent.document).css('display', 'none');
        $('.divLoadData', window.parent.document).css('display', 'none');
        $('.warnigOption', window.parent.document).css('display', 'inherit');
    } catch (e) {}
}
termino();

// ── Leyendas ──────────────────────────────────────────────────────────────────
var lg_sc   = "<li id='ilg_sc' class='text'><i class='fa fa-square fa-1.5x'> | </i> Urbanized Area</li>";
var lg_edif = "<li id='ilg_edif' class='text'><i class='fa fa-building fa-1.5x'> | </i> Buildings</li>";
// ── Leyenda de barreras: 4 niveles con círculo de color + icono ───────────────
// Los colores y etiquetas coinciden exactamente con BARRIER_STYLE en barrierLayer.js
var lg_barriers = "<li id='ilg_barriers' class='text' style='padding:0'>" +
    "<p class='titles' style='margin:4px 0 6px'>Debris Barriers</p>" +
    "<ul style='list-style:none;padding:0;margin:0'>" +

    "<li style='display:flex;align-items:center;gap:8px;margin-bottom:6px'>" +
        "<span style='flex-shrink:0;width:26px;height:26px;border-radius:50%;" +
               "background:#e61f1f;box-shadow:0 2px 5px rgba(0,0,0,.35);" +
               "display:flex;align-items:center;justify-content:center'>" +
            "<img src='css/barrera.png' width='16' height='16' style='display:block'>" +
        "</span>" +
        "<span style='font-size:12px;line-height:1.3'>" +
            "<strong>Level 4 — Critical</strong><br>" +
            "<span style='color:#6b7280'>Gap ≤ 2 m — passage almost blocked</span>" +
        "</span>" +
    "</li>" +

    "<li style='display:flex;align-items:center;gap:8px;margin-bottom:6px'>" +
        "<span style='flex-shrink:0;width:26px;height:26px;border-radius:50%;" +
               "background:#f76707;box-shadow:0 2px 5px rgba(0,0,0,.35);" +
               "display:flex;align-items:center;justify-content:center'>" +
            "<img src='css/barrera.png' width='16' height='16' style='display:block'>" +
        "</span>" +
        "<span style='font-size:12px;line-height:1.3'>" +
            "<strong>Level 3 — Severe</strong><br>" +
            "<span style='color:#6b7280'>Gap ≤ 3.5 m — highly restricted</span>" +
        "</span>" +
    "</li>" +

    "<li style='display:flex;align-items:center;gap:8px;margin-bottom:6px'>" +
        "<span style='flex-shrink:0;width:26px;height:26px;border-radius:50%;" +
               "background:#f5e100;box-shadow:0 2px 5px rgba(0,0,0,.35);" +
               "display:flex;align-items:center;justify-content:center'>" +
            "<img src='css/barrera.png' width='16' height='16' style='display:block'>" +
        "</span>" +
        "<span style='font-size:12px;line-height:1.3'>" +
            "<strong>Level 2 — Caution</strong><br>" +
            "<span style='color:#6b7280'>Gap ≤ 5 m — navigable with care</span>" +
        "</span>" +
    "</li>" +

    "<li style='display:flex;align-items:center;gap:8px'>" +
        "<span style='flex-shrink:0;width:26px;height:26px;border-radius:50%;" +
               "background:#2ea44f;box-shadow:0 2px 5px rgba(0,0,0,.35);" +
               "display:flex;align-items:center;justify-content:center'>" +
            "<img src='css/barrera.png' width='16' height='16' style='display:block'>" +
        "</span>" +
        "<span style='font-size:12px;line-height:1.3'>" +
            "<strong>Level 1 — Mild</strong><br>" +
            "<span style='color:#6b7280'>Gap ≤ 6 m — narrow but passable</span>" +
        "</span>" +
    "</li>" +

    "</ul></li>";

var lg_buff01 = "<li id='ilg_buff01' class='text'><i class='fa fa-exclamation-triangle fa-1.5x'> | </i> Debris Vol. (m<sup>3</sup>/m<sup>2</sup>)";
lg_buff01 += "<div id='uno'></div><div id='dos'></div><div id='tres'></div><div id='cuatro'></div><div id='cinco'></div></li>";

var lg_vulne = "<div id='vulne'><p class='titles'>Vulnerability Class</p><ul>";
lg_vulne += "<li id='ilg_vul01' class='text'><i class='fa fa-square'> | </i> M11-PRE</li>";
lg_vulne += "<li id='ilg_vul02' class='text'><i class='fa fa-square'> | </i> M31-PRE</li>";
lg_vulne += "<li id='ilg_vul03' class='text'><i class='fa fa-square'> | </i> M34-PRE</li>";
lg_vulne += "<li id='ilg_vul04' class='text'><i class='fa fa-square'> | </i> RC31-PRE</li>";
lg_vulne += "<li id='ilg_vul05' class='text'><i class='fa fa-square'> | </i> RC31-LOW</li>";
lg_vulne += "<li id='ilg_vul06' class='text'><i class='fa fa-square'> | </i> Not given</li>";
lg_vulne += "</ul></div>";

var lg_danio = "<div id='grado'><p class='titles'>Damage Level</p><ul>";
lg_danio += "<li id='ilg_dan01' class='text'><i class='fa fa-square'> | </i> Complete</li>";
lg_danio += "<li id='ilg_dan02' class='text'><i class='fa fa-square'> | </i> Extensive</li>";
lg_danio += "<li id='ilg_dan03' class='text'><i class='fa fa-square'> | </i> Moderate</li>";
lg_danio += "<li id='ilg_dan04' class='text'><i class='fa fa-square'> | </i> Sligth</li>";
lg_danio += "<li id='ilg_dan05' class='text'><i class='fa fa-square'> | </i> None</li>";
lg_danio += "<li id='ilg_dan06' class='text'><i class='fa fa-square'> | </i> Not estimated</li>";
lg_danio += "</ul></div>";

// Leyendas iniciales
$('.listLegends>ul').append(lg_sc);
$('.listLegends>ul').append(lg_edif);
if ($('#ly_barriers').is(':checked')) {
    $('.listLegends>ul').append(lg_barriers);
}

// ── Mapa base ─────────────────────────────────────────────────────────────────
$('input[type=radio][name=mapabase]').change(function () {
    if (this.value == 0) { map.addLayer(osm);  map.removeLayer(pnoa); }
    else                 { map.addLayer(pnoa); map.removeLayer(osm);  }
});

// ── Capa: Urbanized Area ──────────────────────────────────────────────────────
$('#ly_parcela').change(function () {
    var on = $(this).is(':checked');
    if (window.refreshParcelaAllSites) window.refreshParcelaAllSites(on);
    if (on) {
        $('.listLegends>ul').append(lg_sc);
    } else {
        $('#ilg_sc').remove();
    }
});

// ── Capa: Buffer de debris ────────────────────────────────────────────────────
$('#ly_buffer1').change(function () {
    var on = $(this).is(':checked');
    if (window.refreshBufferAllSites) window.refreshBufferAllSites(on);
    if (on) {
        $('.listLegends>ul').append(lg_buff01);
    } else {
        $('#ilg_buff01').remove();
    }
});

// ── Capa: Barreras ────────────────────────────────────────────────────────────
$('#ly_barriers').change(function () {
    var on = $(this).is(':checked');
    if (window.refreshBarriersAllSites) window.refreshBarriersAllSites(on);
    if (on) {
        $('.listLegends>ul').append(lg_barriers);
    } else {
        $('#ilg_barriers').remove();
    }
});

// ── Capas temáticas ───────────────────────────────────────────────────────────
$('input[type=radio][name=tematic]').change(function () {
    $('#ilg_edif').remove();
    $('.listLegendsTematic>#vulne').remove();
    $('.listLegendsTematic>#grado').remove();

    if (this.value == 0) {
        $('.listLegends>ul').append(lg_edif);
    } else if (this.value == 1) {
        $('.listLegendsTematic').append(lg_vulne);
        window.showLegendPanel && window.showLegendPanel();
    } else if (this.value == 2) {
        $('.listLegendsTematic').append(lg_danio);
        window.showLegendPanel && window.showLegendPanel();
    }

    if (window.refreshThematicAllSites) window.refreshThematicAllSites();
    window.closeInfoPanel && window.closeInfoPanel();
});

// ── Panel derecho de información ──────────────────────────────────────────────
window.activeFeatureLayer = null;
window.activeGeoJsonGroup = null;

window.openInfoPanel = function (htmlContent, layer, geoJsonGroup) {
    if (window.activeFeatureLayer && window.activeGeoJsonGroup) {
        window.activeGeoJsonGroup.resetStyle(window.activeFeatureLayer);
    }
    window.activeFeatureLayer = layer;
    window.activeGeoJsonGroup = geoJsonGroup;
    layer.setStyle({ weight: 4, color: 'rgb(120,190,220)', fillOpacity: 0.8 });
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) layer.bringToFront();
    $('#info-content').html(htmlContent);
    $('#info-panel').addClass('open');
};

window.closeInfoPanel = function () {
    $('#info-panel').removeClass('open');
    if (window.activeFeatureLayer && window.activeGeoJsonGroup) {
        window.activeGeoJsonGroup.resetStyle(window.activeFeatureLayer);
        window.activeFeatureLayer = null;
        window.activeGeoJsonGroup = null;
    }
};

$('#close-info').on('click', function (e) {
    e.preventDefault();
    window.closeInfoPanel();
});

// ── bufferManual (compatibilidad con index.html → showAlertBuffer) ────────────
window.bufferManual = {
    Buffer: null,
    crearLayer: function () {
        if (window.enableDebris) {
            window.enableDebris();
        } else if (this.Buffer) {
            this.Buffer.addTo(map);
            $('#ly_buffer1').prop('checked', true);
            $('li#li_ly_buffer1').css('display', 'inherit');
        }
        if (!$('#ilg_buff01').length) {
            $('.listLegends>ul').append(lg_buff01);
        }
        try {
            $('.modal', window.parent.document).css('display', 'none');
            $('.warnigOption', window.parent.document).css('display', 'inherit');
            $('.divLoadData', window.parent.document).css('display', 'none');
        } catch (e) {}
        return true;
    },
    addToMap:      function () { if (this.Buffer) this.Buffer.addTo(map); },
    removeFromMap: function () { if (this.Buffer) map.removeLayer(this.Buffer); }
};

// Initializar al cargar
$(document).ready(function () {
    updateButtonPositions();
});