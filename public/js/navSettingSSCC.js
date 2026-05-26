var PANEL_W = 260;
var panelOpen = true;

// ── Posición inicial ──────────────────────────────────────────────────────────
// #map-search-box y #locality-switcher viven dentro de #top-toolbar (derecha),
// ya no se posicionan de forma independiente.
$(".menu-btn").css("left", PANEL_W + "px");
$(".contentid").css("margin-left", "0");

// ── Recalcular tamaño Leaflet tras la animación ───────────────────────────────
function resizeMap() {
  setTimeout(function () {
    if (window.map) window.map.invalidateSize();
  }, 300);
}

var ssccPanelState = {
  activePanel: null, // 'layers', 'legend', or null
};

function getPanelWidth() {
  var root = document.documentElement;
  var computed = getComputedStyle(root);
  var panelW = computed.getPropertyValue('--panel-w').trim();
  return parseInt(panelW, 10) || 260;
}

function updateButtonPositions() {
  var $layersBtn = $('#btn-fp-layers');
  var $legendBtn = $('#btn-fp-legend');
  var isLayersOpen = !$('#fp-layers').hasClass('hidden');
  var isLegendOpen = !$('#fp-legend').hasClass('hidden');
  var panelW = getPanelWidth();
  var closedLeft = 14;
  var secondClosedLeft = closedLeft + 44 + 10;
  var openButtonLeft = closedLeft + panelW + 10;

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
    $layersBtn.show().css('left', closedLeft + 'px');
    $legendBtn.show().css('left', secondClosedLeft + 'px');
    $('.contentid').css('margin-left', '0');
  }
}

function closeSSCCPanel() {
  var $activePanel = ssccPanelState.activePanel ? $('#fp-' + ssccPanelState.activePanel) : null;
  if ($activePanel) {
    $activePanel.addClass('hidden');
    ssccPanelState.activePanel = null;
    updateButtonPositions();
    resizeMap();
  }
}

function openSSCCPanel(panelName) {
  if (ssccPanelState.activePanel === panelName) {
    closeSSCCPanel();
    return;
  }

  if (ssccPanelState.activePanel) {
    $('#fp-' + ssccPanelState.activePanel).addClass('hidden');
  }

  ssccPanelState.activePanel = panelName;
  $('#fp-' + panelName).removeClass('hidden');
  updateButtonPositions();
  resizeMap();
}

$('#btn-fp-layers').on('click', function (e) {
  e.preventDefault();
  openSSCCPanel('layers');
});

$('#btn-fp-legend').on('click', function (e) {
  e.preventDefault();
  openSSCCPanel('legend');
});

$('#close-fp-layers').on('click', function (e) {
  e.preventDefault();
  closeSSCCPanel();
});

$('#close-fp-legend').on('click', function (e) {
  e.preventDefault();
  closeSSCCPanel();
});

updateButtonPositions();

// ── Actualizar icono ──────────────────────────────────────────────────────────
function updateIcon() {
  $("#btn-panel img").attr(
    "src",
    panelOpen ? "/css/icon-flecha.png" : "/css/icon-capas.png",
  );
}

// ── Botón ───────────────────────────────────────────────────────────────
$("#btn-panel").on("click", function (e) {
  e.preventDefault();
  if (panelOpen) {
    // Ocultar panel deslizando a la izquierda
    $("#side-panel").animate({ left: -PANEL_W }, 280);
    $(".menu-btn").animate({ left: 0 }, 280);
    $(".contentid").animate({ marginLeft: 0 }, 280, resizeMap);
  } else {
    // Mostrar panel
    $("#side-panel").animate({ left: 0 }, 280);
    $(".menu-btn").animate({ left: PANEL_W }, 280);
    $(".contentid").animate({ marginLeft: PANEL_W }, 280, resizeMap);
  }
  if (typeof window._updateSwitcherLeft === "function")
    window._updateSwitcherLeft(!panelOpen);
  panelOpen = !panelOpen;
  updateIcon();
});

// ── Desplegables ──────────────────────────────────────────────────────────────
$(".selecLayer li:has(a)").on("click", function (e) {
  e.preventDefault();
  $(".sub-selecLayer").on("click", function (p) {
    p.stopPropagation();
  });
  var $icon = $(this).find("i.masLayer");
  if ($(this).hasClass("activado")) {
    $(this).removeClass("activado");
    $(this).children("ul").slideUp(200);
    $icon.removeClass("fa-angle-up").addClass("fa-angle-down");
  } else {
    $icon.removeClass("fa-angle-down").addClass("fa-angle-up");
    $(this).addClass("activado");
    $(this).children("ul").slideDown(200);
  }
});

// ── Modal ─────────────────────────────────────────────────────────────────────
function termino() {
  try {
    $(".modal", window.parent.document).css("display", "none");
    $(".divLoadData", window.parent.document).css("display", "none");
    $(".warnigOption", window.parent.document).css("display", "inherit");
    window.parent.postMessage({ action: "iframeReady", ready: true }, "*");
  } catch (e) {}
}
termino();

// ── Capas temáticas ───────────────────────────────────────────────────────────
$("input[type=radio][name=tematic]").change(function () {
  if (typeof window.setTheme === "function") window.setTheme(this.value);
});

// ── Lógica del Panel Derecho de Información ──
window.activeFeatureLayer = null;
window.activeGeoJsonGroup = null;

window.openInfoPanel = function (htmlContent, layer, geoJsonGroup) {
  // 1. Quitar el resalte del elemento anterior si existe
  if (window.activeFeatureLayer) {
    // Usamos el estilo original que guardamos en buildLayersForLocality
    var oldLayer = window.activeFeatureLayer;
    if (oldLayer.options && oldLayer.options.originalStyle) {
      oldLayer.setStyle(oldLayer.options.originalStyle);
    }
  }

  // 2. Guardar el nuevo elemento activo
  window.activeFeatureLayer = layer;
  window.activeGeoJsonGroup = geoJsonGroup; // Se mantiene por compatibilidad, aunque no se use para resetear

  // 3. Resaltar la capa actual (Borde cyan grueso)
  layer.setStyle({
    weight: 4,
    color: "rgb(120, 190, 220)",
    fillOpacity: 0.8,
  });
  
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }

  // 4. Insertar la información y abrir el panel
  $("#info-content").html(htmlContent);
  $("#info-panel").addClass("open");
};

window.closeInfoPanel = function () {
  $("#info-panel").removeClass("open");
  // Quitar el resalte al cerrar el panel
  if (window.activeFeatureLayer && window.activeGeoJsonGroup) {
    window.activeGeoJsonGroup.resetStyle(window.activeFeatureLayer);
    window.activeFeatureLayer = null;
    window.activeGeoJsonGroup = null;
  }
};

// Evento para el botón de la 'X'
$("#close-info").on("click", function (e) {
  e.preventDefault();
  window.closeInfoPanel();
});