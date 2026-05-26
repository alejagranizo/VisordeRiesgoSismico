/* mapSettingSSCC.js */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // REGISTRO DE MUNICIPIOS
  // Para añadir uno nuevo: añadir entrada aquí + loadOutputScript en loadAllOutputs.
  // ---------------------------------------------------------------------------
  const MUNICIPIOS_CONFIG = {
    "Lorca": {
        geojsonVar: "json_SeccionesLorca",
        outputFile: "/pythonCode/output/Secciones_Lorca.js",
        bufferFile: "/pythonCode/output/Colored_Buffers_LORCA.js",
        bufferVar: "json_Bufferin_LORCA",
        displayName: "Lorca",
        center: [37.6710, -1.6982],
        zoom: 12
    },
    "PuertoLumbreras": {
        geojsonVar: "json_SeccionesPL",
        outputFile: "/pythonCode/output/Secciones_PuertoLumbreras.js",
        bufferFile: "/pythonCode/output/Colored_Buffers_PL.js",
        bufferVar: "json_Bufferin_PL",
        displayName: "Puerto Lumbreras",
        center: [37.5645, -1.8115],
        zoom: 12
    }
    // Para añadir un tercer municipio:
    // "Aguilas": {
    //     geojsonVar: "json_SeccionesAguilas",
    //     outputFile: "/pythonCode/output/Secciones_Aguilas.js",
    //     displayName: "Águilas",
    //     center: [37.4046, -1.5852],
    //     zoom: 12
    // }
  };

  // ---------------------------------------------------------------------------
  // Carga dinámica anti-caché de los JS de output generados por BUFF_.py
  //
  // IMPORTANTE: se inyecta un <script src="...?v=timestamp"> en el DOM,
  // NO se usa fetch + new Function(), porque "var x = ..." dentro de
  // new Function() queda en scope local y nunca llega a window.x.
  // Al inyectar el <script> el navegador lo ejecuta en scope global.
  // ---------------------------------------------------------------------------
  function loadOutputScript(url) {
    return new Promise(function (resolve, reject) {
      // Eliminar script anterior del mismo archivo si existe (evita duplicados)
      var oldId = "dynscript-" + url.replace(/\W/g, "_");
      var existing = document.getElementById(oldId);
      if (existing) existing.parentNode.removeChild(existing);

      // IMPORTANTE: limpiar la variable global anterior si existe
      // para forzar que la nueva lectura del <script> cree una variable nueva
      var varName = null;
      if (url.indexOf("resultSSCC") !== -1) {
        varName = "excelData";
      } else if (url.indexOf("Secciones_Lorca") !== -1) {
        varName = "json_SeccionesLorca";
      } else if (url.indexOf("Secciones_PuertoLumbreras") !== -1) {
        varName = "json_SeccionesPL";
      } else if (url.indexOf("Colored_Buffers_LORCA") !== -1) {
        varName = "json_Bufferin_LORCA";
      } else if (url.indexOf("Colored_Buffers_PL") !== -1) {
        varName = "json_Bufferin_PL";
      }
      if (varName && window[varName]) {
        try {
          delete window[varName];
        } catch (e) {
          // En algunos casos, delete no funciona con var globales, ignorar
          window[varName] = undefined;
        }
      }

      var script = document.createElement("script");
      script.id  = oldId;
      script.src = url + "?v=" + Date.now();   // cache-buster
      script.onload  = function () { resolve(); };
      script.onerror = function () { reject(new Error("Error cargando " + url)); };
      document.head.appendChild(script);
    });
  }

  function loadAllOutputs() {
    // resultSSCC.js (excelData combinado) también depende del escenario sísmico
    // y debe recargarse fresco igual que los Secciones_<Municipio>.js
    var urls = ["/pythonCode/output/resultSSCC.js"]
      .concat(Object.keys(MUNICIPIOS_CONFIG).map(function (id) {
        return MUNICIPIOS_CONFIG[id].outputFile;
      }))
      .concat(Object.keys(MUNICIPIOS_CONFIG).map(function (id) {
        return MUNICIPIOS_CONFIG[id].bufferFile;
      }).filter(Boolean));
    var promises = urls.map(function (url) {
      return loadOutputScript(url).catch(function (err) {
        console.warn("No se pudo cargar:", url, err.message);
      });
    });
    return Promise.all(promises).then(function () {
      // CORRECCIÓN: verificar que las variables globales de cada municipio se han
      // poblado. En Windows el disco puede tardar en liberar el archivo recién
      // escrito por BUFF_.py, haciendo que el <script> se ejecute con el fichero
      // anterior. Si alguna variable sigue vacía, reintentar una vez tras 600 ms.
      var allVarsOk = Object.keys(MUNICIPIOS_CONFIG).every(function (id) {
        var cfg = MUNICIPIOS_CONFIG[id];
        var geo = window[cfg.geojsonVar];
        var buff = cfg.bufferVar ? window[cfg.bufferVar] : true;
        return geo && geo.features && geo.features.length > 0 && (!cfg.bufferVar || (buff && buff.features && buff.features.length > 0));
      });
      if (!allVarsOk) {
        console.warn("loadAllOutputs: variables no listas, reintentando en 600 ms...");
        return new Promise(function (resolve) {
          setTimeout(resolve, 600);
        }).then(function () {
          return Promise.all(urls.map(function (url) {
            return loadOutputScript(url).catch(function (err) {
              console.warn("Reintento fallido:", url, err.message);
            });
          }));
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Utilidad: deduce localidad desde el CUSEC
  // Lorca      → 30024XXXXXXX
  // Pto. Lumb. → 30033XXXXXXX
  // ---------------------------------------------------------------------------
  function localidadDesdeCusec(cusec) {
    var s = String(cusec || "").trim();
    if (s.startsWith("30024")) return "Lorca";
    if (s.startsWith("30033")) return "PuertoLumbreras";
    return null;
  }

  // ---------------------------------------------------------------------------
  // Colores
  // ---------------------------------------------------------------------------

  function setDamageColor(d) {
    if (d === undefined || d === null || d === 0) return "#ffe6e6";
    return d > 3.5 ? "#7E080C"
         : d > 2.5 ? "#DE2D26"
         : d > 1.5 ? "#FB6A4A"
         : d > 0.5 ? "#FCAE91"
         :            "#FEE5D9";
  }

  function setVulColor(clase) {
    switch (clase) {
      case "M11-PRE":  return "#1a53ff";
      case "M31-PRE":  return "#0099ff";
      case "M34-PRE":  return "#cc00cc";
      case "RC31-PRE": return "#a7e76c";
      case "RC31-LOW": return "#669900";
      default:         return "#e6e66b";
    }
  }

  // ---------------------------------------------------------------------------
  // Estilos
  // ---------------------------------------------------------------------------

  function styleBase(feature) {
    return {
      fillColor: "#e3e3e3",
      weight: 0.9,
      opacity: 1,
      color: "#666666",
      fillOpacity: 0.6
    };
  }
  function styleVul(f) {
    var res = f.properties.Resultados || {};
    var maxN = 0, dominant = null;
    Object.keys(res).forEach(function (vul) {
      var n = res[vul].numEdif || 0;
      if (n > maxN) { maxN = n; dominant = vul; }
    });
    var base = dominant ? dominant.replace(/-[LMH]$/, "") : null;
    return { color: "#444", weight: 0.9, fillOpacity: 0.85, fillColor: setVulColor(base) };
  }
  function styleDamage(f) {
    return { color: "#333", weight: 0.9, fillOpacity: 0.9, fillColor: setDamageColor(f.properties.dMean) };
  }

  function styleBuffer(feature) {
    var v = feature.properties && parseFloat(feature.properties.COLOR);
    var c = isNaN(v) ? 0 : v;
    var fill = c > 0.1   ? 'rgb(100,0,0)'    :
               c > 0.01  ? 'rgb(178,38,0)'   :
               c > 0.001 ? 'rgb(210,105,0)'  :
               c > 0.0   ? 'rgb(218,165,32)' :
                           'rgba(255,255,255,0)';
    return {
      fillColor: fill,
      color: fill,
      weight: 1,
      opacity: 1,
      fillOpacity: 0.9
    };
  }

  // ---------------------------------------------------------------------------
  // Popup helpers
  // ---------------------------------------------------------------------------

  window.hideVul = function (id) {
    var panel = document.querySelector("#info-content");
    if (!panel) return;
    var div  = panel.querySelector("#" + id);
    var icon = panel.querySelector("#" + id + "F i");
    if (!div || !icon) return;
    div.classList.toggle("hideClass");
    icon.classList.toggle("fa-plus-square-o");
    icon.classList.toggle("fa-minus-square-o");
  };

  function safeNum(v, dec) {
    if (v === undefined || v === null || isNaN(v)) return "-";
    var n = parseFloat(v);
    return isNaN(n) ? "-" : dec !== undefined ? n.toFixed(dec) : n;
  }
  function sectionBtn(id, label) {
    return "<p class='text' id='" + id + "F' onclick=\"hideVul('" + id + "')\" style='margin:4px 0;cursor:pointer;'>" +
           "<strong><i class='fa fa-plus-square-o'></i> " + label + "</strong></p>" +
           "<div id='" + id + "' class='hideClass'>";
  }
  function row(label, value, indent) {
    var ml = indent ? "margin-left:" + indent + "px;" : "";
    return "<p class='text' style='" + ml + "margin-top:2px;margin-bottom:2px;'>" +
           "<span style='color:#555'>" + label + ":</span> <strong>" + value + "</strong></p>";
  }
  function pct(n, total) { return !total ? "0.0%" : ((n / total) * 100).toFixed(1) + "%"; }

  // ---------------------------------------------------------------------------
  // Popup completo
  // ---------------------------------------------------------------------------

  function buildPopupHtml(props) {
    var numEdif    = parseFloat(props.NumEdif) || 0;
    var resultados = props.Resultados || {};
    var loc = props.localidad || localidadDesdeCusec(props.CUSEC);
    var localidadLabel = loc === "PuertoLumbreras" ? "Puerto Lumbreras" : (loc || "—");
    var vulsToShow = ["M11-PRE", "M31-PRE", "M34-PRE", "RC31-PRE", "RC31-LOW"];
    var agrupados  = {};
    Object.keys(resultados).forEach(function (vul) {
      var base = vul.replace(/-[LMH]$/, "");
      if (vulsToShow.indexOf(base) === -1) return;
      if (!agrupados[base]) agrupados[base] = [];
      agrupados[base].push({ nivel: vul.slice(-1), code: vul, data: resultados[vul] });
    });

    var html = "<h2>Section Information</h2>";
    html += "<h3>" + localidadLabel + "</h3>";
    html += sectionBtn("sec_geo", "GeoID: " + props.CUSEC);
    html += row("Municipality", localidadLabel, 10);
    html += row("Buildings", props.NumEdif || "-", 10);
    html += "</div>";
    html += sectionBtn("sec_vul", "Vulnerability");
    vulsToShow.forEach(function (base) {
      if (!agrupados[base]) return;
      var idBase    = base.replace(/-/g, "_");
      var totalBase = agrupados[base].reduce(function (acc, item) { return acc + ((item.data && item.data.numEdif) || 0); }, 0);
      html += "<div style='margin-left:10px;'>";
      html += sectionBtn("sec_vul_" + idBase, base + " — " + totalBase + " edif.");
      agrupados[base].forEach(function (item) {
        var n = item.data && item.data.numEdif !== undefined ? item.data.numEdif : "?";
        html += row("Nivel " + item.nivel, n + " edif.", 20);
      });
      html += "</div></div>";
    });
    html += "</div>";
    var pgaRock = "-", pgaSoil = "-";
    var firstVul = Object.values(resultados)[0];
    if (firstVul) {
      if (firstVul.pgaRock !== undefined) pgaRock = firstVul.pgaRock.toFixed(2) + " gal";
      if (firstVul.pgaSoil !== undefined) pgaSoil = firstVul.pgaSoil.toFixed(2) + " gal";
    }
    html += sectionBtn("sec_gm", "Ground Motion");
    html += row("PGA Rock (Vs30=760)", pgaRock, 10);
    html += row("PGA Soil (Vs30=" + safeNum(props.Vs30, 0) + ")", pgaSoil, 10);
    html += "</div>";
    var d = props.DamageTotals || {};
    html += sectionBtn("sec_dmg", "Damage");
    html += row("Mean damage",      safeNum(props.dMean, 3), 10);
    html += row("Null damage",      (d.dmgNull || 0) + " edif. (" + pct(d.dmgNull || 0, numEdif) + ")", 10);
    html += row("Slight damage",    (d.dmgLow  || 0) + " edif. (" + pct(d.dmgLow  || 0, numEdif) + ")", 10);
    html += row("Moderate damage",  (d.dmgMod  || 0) + " edif. (" + pct(d.dmgMod  || 0, numEdif) + ")", 10);
    html += row("Extensive damage", (d.dmgExt  || 0) + " edif. (" + pct(d.dmgExt  || 0, numEdif) + ")", 10);
    html += row("Complete damage",  (d.dmgCom  || 0) + " edif. (" + pct(d.dmgCom  || 0, numEdif) + ")", 10);
    html += "</div>";
    html += "</div>";
    return html;
  }

  // ---------------------------------------------------------------------------
  // Eventos por feature
  // ---------------------------------------------------------------------------

  function onEachFeature(feature, layer) {
    layer.on({
      click: function (e) {
        var layer = e.target;
        var props = layer.feature.properties;
        var html = buildPopupHtml(props);
        var currentGroup = window.SeccionesBase;
        if (window.currentTheme === "vul") currentGroup = window.SeccionesVul;
        if (window.currentTheme === "meanDamage") currentGroup = window.SeccionesDanio;
        window.openInfoPanel(html, layer, currentGroup);
        L.DomEvent.stopPropagation(e);
      },
      mouseover: function (e) {
        if (window.activeFeatureLayer === e.target) return;
        e.target.setStyle({ weight: 2.5, color: "#fff", fillOpacity: 0.9 });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) e.target.bringToFront();
      },
      mouseout: function (e) {
        if (window.activeFeatureLayer === e.target) return;
        var layer = e.target;
        if (layer.options && layer.options.originalStyle) {
          layer.setStyle(layer.options.originalStyle);
        }
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Capas Leaflet — almacenadas por municipio
  // ---------------------------------------------------------------------------

  window.layersByLocality = {};

  window.BoundaryLayer      = L.featureGroup();
  window.SeccionesBase      = L.layerGroup();
  window.SeccionesVul       = L.layerGroup();
  window.SeccionesDanio     = L.layerGroup();
  window.BufferLayerGroup   = L.layerGroup();

  window.bufferManual = {
    Buffer: window.BufferLayerGroup,
    crearLayer: function () {
      if (!window.map || !this.Buffer) return false;
      if (!window.map.hasLayer(this.Buffer)) {
        this.Buffer.addTo(window.map);
      }
      this._appendLegend();
      return true;
    },
    addToMap: function () {
      if (!window.map || !this.Buffer) return false;
      if (!window.map.hasLayer(this.Buffer)) {
        window.map.addLayer(this.Buffer);
      }
      return true;
    },
    removeFromMap: function () {
      if (!window.map || !this.Buffer) return false;
      if (window.map.hasLayer(this.Buffer)) {
        window.map.removeLayer(this.Buffer);
      }
      return true;
    },
    _appendLegend: function () {
      var existing = document.getElementById('ilg_buff01');
      if (existing) return;
      var ul = document.querySelector('.listLegends>ul');
      if (!ul) return;
      ul.insertAdjacentHTML('beforeend',
        "<li id='ilg_buff01' class='text'><i class='fa fa-exclamation-triangle fa-1.5x'> | </i> Debris Vol. (m<sup>3</sup>/m<sup>2</sup>)</li>");
    }
  };

  window.enableDebris = function () {
    return window.bufferManual && window.bufferManual.crearLayer && window.bufferManual.crearLayer();
  };

  function buildLayersForLocality(id, geojson) {
    window.layersByLocality[id] = {
      base: L.geoJSON(geojson, {
        style: styleBase,
        onEachFeature: function (feature, layer) {
          layer.options.originalStyle = styleBase(feature);
          onEachFeature(feature, layer);
        }
      }),
      vul: L.geoJSON(geojson, {
        style: styleVul,
        onEachFeature: function (feature, layer) {
          layer.options.originalStyle = styleVul(feature);
          onEachFeature(feature, layer);
        }
      }),
      danio: L.geoJSON(geojson, {
        style: styleDamage,
        onEachFeature: function (feature, layer) {
          layer.options.originalStyle = styleDamage(feature);
          onEachFeature(feature, layer);
        }
      }),
    };

    // Contorno del municipio
    var boundaryStyle = {
      fill: false,
      color: "#1a1a1a",
      weight: 2.5,
      opacity: 1
    };

    if (window.turf) {
      try {
        var flatFeatures = [];
        geojson.features.forEach(function (f) {
          if (!f.geometry) return;
          if (f.geometry.type === "Polygon") {
            flatFeatures.push(f);
          } else if (f.geometry.type === "MultiPolygon") {
            f.geometry.coordinates.forEach(function (coords) {
              flatFeatures.push({
                type: "Feature",
                properties: f.properties,
                geometry: { type: "Polygon", coordinates: coords }
              });
            });
          }
        });

        var allPolygons = { type: "FeatureCollection", features: flatFeatures };
        var dissolved = null;

        try {
          dissolved = turf.dissolve(allPolygons);
        } catch (e1) {
          console.warn("turf.dissolve falló para " + id + ", usando union iterativo:", e1.message);
          var merged = null;
          flatFeatures.forEach(function (f) {
            if (!merged) { merged = f; return; }
            try { merged = turf.union(merged, f); } catch (eu) { /* saltar feature problemático */ }
          });
          if (merged) dissolved = { type: "FeatureCollection", features: [merged] };
        }

        if (dissolved) {
          window.layersByLocality[id].boundary = L.geoJSON(dissolved, {
            className: "locality-boundary",
            interactive: false,
            style: boundaryStyle
          });
        } else {
          console.warn("No se pudo disolver el contorno para " + id + ". Usando secciones directas.");
          window.layersByLocality[id].boundary = L.geoJSON(geojson, {
            className: "locality-boundary",
            interactive: false,
            style: boundaryStyle
          });
        }
      } catch (e) {
        console.warn("Error creando contorno para " + id + ":", e);
        window.layersByLocality[id].boundary = L.geoJSON(geojson, {
          className: "locality-boundary",
          interactive: false,
          style: boundaryStyle
        });
      }
    } else {
      window.layersByLocality[id].boundary = L.geoJSON(geojson, {
        className: "locality-boundary",
        interactive: false,
        style: boundaryStyle
      });
    }

    var bufferVar = (MUNICIPIOS_CONFIG[id] && MUNICIPIOS_CONFIG[id].bufferVar) || null;
    var bufferGeojson = bufferVar ? window[bufferVar] : null;
    if (bufferGeojson && bufferGeojson.features && bufferGeojson.features.length) {
      window.layersByLocality[id].buffer = L.geoJSON(bufferGeojson, {
        style: styleBuffer
      });
      window.BufferLayerGroup.addLayer(window.layersByLocality[id].buffer);
    }
  }

  // ---------------------------------------------------------------------------
  // Leyenda
  // ---------------------------------------------------------------------------

  function updateLegend(mode) {
    var c = document.querySelector(".listLegendsTematic");
    if (!c) return;
    var html = "";
    if (mode === "base") {
      html = '<p class="titles">Census Sections</p>';
    } else if (mode === "vul") {
      html = '<p class="titles">Vulnerability</p><ul>';
      ["M11-PRE", "M31-PRE", "M34-PRE", "RC31-PRE", "RC31-LOW"].forEach(function (cl) {
        html += '<li class="text"><i class="fa fa-square" style="color:' + setVulColor(cl) + '"></i> ' + cl + "</li>";
      });
      html += "</ul>";
    } else if (mode === "meanDamage") {
      html = '<p class="titles">Mean Damage (0–4)</p><ul>';
      [
        { l: "> 3.5 (Complete)",    v: 3.6 },
        { l: "2.5–3.5 (Extensive)", v: 3.0 },
        { l: "1.5–2.5 (Moderate)",  v: 2.0 },
        { l: "0.5–1.5 (Slight)",    v: 1.0 },
        { l: "0–0.5 (Null)",        v: 0.2 },
      ].forEach(function (r) {
        html += '<li class="text"><i class="fa fa-square" style="color:' + setDamageColor(r.v) + '"></i> ' + r.l + "</li>";
      });
      html += "</ul>";
    }
    c.innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // toggleLocality — activa/desactiva cada municipio de forma independiente
  // ---------------------------------------------------------------------------

  window.localityVisible = {};

  function updateToggleButtons() {
    document.querySelectorAll(".locality-btn").forEach(function (btn) {
      var id = btn.getAttribute("data-locality");
      var active = window.localityVisible[id] !== false;
      if (active) {
        btn.classList.remove("inactive");
      } else {
        btn.classList.add("inactive");
      }
    });
  }

  window.toggleLocality = function (id) {
    var m = window.map;
    if (!m) return;

    var layers = window.layersByLocality[id];
    if (!layers) {
      console.warn("toggleLocality: no hay capas para", id);
      return;
    }

    window.localityVisible[id] = !window.localityVisible[id];
    var isVisible = window.localityVisible[id];

    if (isVisible) {
      window.SeccionesBase.addLayer(layers.base);
      window.SeccionesVul.addLayer(layers.vul);
      window.SeccionesDanio.addLayer(layers.danio);
      if (layers.boundary) {
        window.BoundaryLayer.addLayer(layers.boundary);
        window.BoundaryLayer.bringToFront();
      }
      var conf = MUNICIPIOS_CONFIG[id];
      if (conf && conf.center && conf.zoom) {
        m.flyTo(conf.center, conf.zoom, { duration: 1.5 });
      }
    } else {
      window.SeccionesBase.removeLayer(layers.base);
      window.SeccionesVul.removeLayer(layers.vul);
      window.SeccionesDanio.removeLayer(layers.danio);
      if (layers.boundary) window.BoundaryLayer.removeLayer(layers.boundary);
      if (window.activeFeatureLayer) {
        var fProps = window.activeFeatureLayer.feature && window.activeFeatureLayer.feature.properties;
        if (fProps && fProps.localidad === id) window.closeInfoPanel();
      }
    }

    updateToggleButtons();
  };

  window.switchLocality  = window.toggleLocality;
  window._switchLocality = window.toggleLocality;
  window._toggleLocality = window.toggleLocality;

  // ---------------------------------------------------------------------------
  // BUSCADOR (sin cambios)
  // ---------------------------------------------------------------------------

  var searchDebounce = null;
  var searchCache    = {};

  function buildSearchUI() {
    var container = document.createElement("div");
    container.id = "map-search-box";
    container.innerHTML = [
      '<div id="search-input-wrap">',
        '<i class="fa fa-search" id="search-icon"></i>',
        '<input type="text" id="search-input" placeholder="Search street, place..." autocomplete="off" />',
        '<button id="search-clear" title="Clear">&times;</button>',
      '</div>',
      '<ul id="search-results"></ul>',
    ].join("");
    document.body.appendChild(container);
    return container;
  }

  var searchMarker = null;

  function clearSearchMarker() {
    if (searchMarker && window.map) {
      window.map.removeLayer(searchMarker);
      searchMarker = null;
    }
  }

  function showResultMarker(lat, lon, label) {
    clearSearchMarker();
    searchMarker = L.marker([lat, lon], {
      icon: L.divIcon({ className: "search-result-marker", iconSize: [14, 14], iconAnchor: [7, 7] }),
      title: label,
    }).addTo(window.map);
  }

  function showResults(items) {
    var ul = document.getElementById("search-results");
    if (!ul) return;
    ul.innerHTML = "";

    if (!items || items.length === 0) {
      ul.style.display = "block";
      var li = document.createElement("li");
      li.className = "no-results";
      li.textContent = "No results found.";
      ul.appendChild(li);
      return;
    }

    ul.style.display = "block";
    items.forEach(function (item) {
      var li = document.createElement("li");

      var typeIcon = "fa-map-marker";
      var t = (item.type || "").toLowerCase();
      if (t === "highway" || t === "road" || (item.addresstype || "").indexOf("road") !== -1) typeIcon = "fa-road";
      else if (t === "building" || t === "house") typeIcon = "fa-building-o";
      else if (t === "city" || t === "town" || t === "village" || t === "municipality") typeIcon = "fa-map-o";

      var parts = (item.display_name || "").split(",");
      var mainLabel = parts[0].trim();
      var subLabel  = parts.slice(1, 3).map(function(p){ return p.trim(); }).join(", ");

      li.innerHTML = [
        '<i class="fa ' + typeIcon + ' sr-icon"></i>',
        '<span>',
          '<span class="sr-main">' + mainLabel + '</span>',
          subLabel ? '<span class="sr-sub">' + subLabel + '</span>' : "",
        '</span>',
      ].join("");

      li.addEventListener("click", function () {
        var lat  = parseFloat(item.lat);
        var lon  = parseFloat(item.lon);
        var bbox = item.boundingbox;

        if (bbox && bbox.length === 4) {
          window.map.flyToBounds(
            [[parseFloat(bbox[0]), parseFloat(bbox[2])], [parseFloat(bbox[1]), parseFloat(bbox[3])]],
            { padding: [40, 40], maxZoom: 17, duration: 1.0 }
          );
        } else {
          window.map.flyTo([lat, lon], 16, { duration: 1.0 });
        }

        showResultMarker(lat, lon, mainLabel);
        document.getElementById("search-input").value = item.display_name;
        ul.style.display = "none";
        document.getElementById("search-clear").style.display = "flex";
      });

      ul.appendChild(li);
    });
  }

  function doSearch(q) {
    if (!q || q.trim().length < 2) {
      var ul = document.getElementById("search-results");
      if (ul) ul.style.display = "none";
      return;
    }

    if (searchCache[q]) {
      showResults(searchCache[q]);
      return;
    }

    var ul = document.getElementById("search-results");
    if (ul) {
      ul.style.display = "block";
      ul.innerHTML = '<li class="loading"><i class="fa fa-spinner fa-spin sr-icon"></i><span>Searching…</span></li>';
    }

    var viewbox = "-2.1,36.9,-1.5,37.9";
    var url = "https://nominatim.openstreetmap.org/search" +
              "?format=json" +
              "&q=" + encodeURIComponent(q) +
              "&limit=8" +
              "&addressdetails=1" +
              "&viewbox=" + viewbox +
              "&bounded=0" +
              "&countrycodes=es" +
              "&accept-language=es";

    fetch(url, { headers: { "Accept-Language": "es" } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        searchCache[q] = data;
        showResults(data);
      })
      .catch(function (err) {
        console.warn("Búsqueda fallida:", err);
        var ul2 = document.getElementById("search-results");
        if (ul2) {
          ul2.style.display = "block";
          ul2.innerHTML = '<li class="no-results">Search failed. Check your connection.</li>';
        }
      });
  }

  function initSearch() {
    buildSearchUI();

    var input = document.getElementById("search-input");
    var clear = document.getElementById("search-clear");
    var ul    = document.getElementById("search-results");

    input.addEventListener("input", function () {
      var q = this.value.trim();
      clear.style.display = q ? "flex" : "none";
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(function () { doSearch(q); }, 350);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        ul.style.display = "none";
        input.blur();
      }
    });

    clear.addEventListener("click", function () {
      input.value = "";
      clear.style.display = "none";
      ul.style.display = "none";
      clearSearchMarker();
      input.focus();
    });

    document.addEventListener("click", function (e) {
      var box = document.getElementById("map-search-box");
      if (box && !box.contains(e.target)) {
        if (ul) ul.style.display = "none";
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Función para limpiar completamente las capas antiguas
  // ---------------------------------------------------------------------------
  function clearAllLayers() {
    var m = window.map;
    if (!m) return;

    // Remover las capas del mapa
    if (m.hasLayer(window.SeccionesBase))  m.removeLayer(window.SeccionesBase);
    if (m.hasLayer(window.SeccionesVul))   m.removeLayer(window.SeccionesVul);
    if (m.hasLayer(window.SeccionesDanio)) m.removeLayer(window.SeccionesDanio);
    if (m.hasLayer(window.BoundaryLayer))  m.removeLayer(window.BoundaryLayer);
    if (m.hasLayer(window.BufferLayerGroup)) m.removeLayer(window.BufferLayerGroup);

    // Limpiar los layer groups
    window.SeccionesBase.clearLayers();
    window.SeccionesVul.clearLayers();
    window.SeccionesDanio.clearLayers();
    window.BoundaryLayer.clearLayers();
    window.BufferLayerGroup.clearLayers();

    // Limpiar el diccionario de capas por localidad
    Object.keys(window.layersByLocality).forEach(function (id) {
      delete window.layersByLocality[id];
    });
    window.layersByLocality = {};
  }

  // ---------------------------------------------------------------------------
  // Init — carga los outputs frescos y luego construye las capas
  // ---------------------------------------------------------------------------
  function init() {
    var m = window.map;
    if (!m) return;

    // Guardar el tema actual para restaurarlo después de recargar
    var previousTheme = window.currentTheme || "base";

    // CORRECCIÓN PRINCIPAL: cargar los JS de output siempre frescos (anti-caché)
    // antes de construir ninguna capa. Los <script> estáticos del HTML
    // se han eliminado para evitar que el navegador los cachée.
    loadAllOutputs().then(function () {

      // Limpiar completamente las capas antiguas para evitar duplicados
      clearAllLayers();

      console.log("=== INICIANDO RECONSTRUCCIÓN DE CAPAS (tema anterior: " + previousTheme + ") ===");

      Object.keys(MUNICIPIOS_CONFIG).forEach(function (id) {
        var conf    = MUNICIPIOS_CONFIG[id];
        var geojson = window[conf.geojsonVar];

        if (!geojson) {
          console.warn("init: No se encontró la variable " + conf.geojsonVar + " para " + id);
          return;
        }

        console.log("Cargando " + id + ": " + geojson.features.length + " secciones");
        // Log de muestra de datos
        if (geojson.features.length > 0) {
          var firstFeature = geojson.features[0];
          console.log("  Primera sección - dMean:", firstFeature.properties.dMean, "dmgNull:", firstFeature.properties.DamageTotals?.dmgNull);
        }

        // BUFF_.py ya fusiona geometría + resultados de RISK_.py en cada
        // Secciones_<Municipio>.js. No se necesita mergeRiskData aquí.
        buildLayersForLocality(id, geojson);

        var locLayers = window.layersByLocality[id];
        window.SeccionesBase.addLayer(locLayers.base);
        window.SeccionesVul.addLayer(locLayers.vul);
        window.SeccionesDanio.addLayer(locLayers.danio);
      });

      // Contornos — una sola vez, fuera del bucle
      Object.keys(window.layersByLocality).forEach(function (id) {
        var bl = window.layersByLocality[id].boundary;
        if (bl) window.BoundaryLayer.addLayer(bl);
      });
      window.BoundaryLayer.addTo(m);

      // Visibilidad inicial (todos activos)
      Object.keys(window.layersByLocality).forEach(function (id) {
        window.localityVisible[id] = true;
      });
      updateToggleButtons();

      console.log("Municipios cargados y visibles:", Object.keys(window.layersByLocality));

      // Determinar qué capa mostrar
      var initialTheme = previousTheme;
      if (previousTheme !== "base" && previousTheme !== "vul" && previousTheme !== "meanDamage") {
        initialTheme = "base";
      }

      window.SeccionesBase.addTo(m);
      window.currentTheme = "base";
      
      // Crear la función setTheme
      window.setTheme = function (value) {
        if (m.hasLayer(window.SeccionesBase))  m.removeLayer(window.SeccionesBase);
        if (m.hasLayer(window.SeccionesVul))   m.removeLayer(window.SeccionesVul);
        if (m.hasLayer(window.SeccionesDanio)) m.removeLayer(window.SeccionesDanio);

        if (value === "0") {
          window.SeccionesBase.addTo(m);
          window.currentTheme = "base";
          updateLegend("base");
        } else if (value === "1") {
          window.SeccionesVul.addTo(m);
          window.currentTheme = "vul";
          updateLegend("vul");
        } else if (value === "2") {
          window.SeccionesDanio.addTo(m);
          window.currentTheme = "meanDamage";
          updateLegend("meanDamage");
        }
      };

      // Si había un tema previo diferente al base, restaurarlo
      if (initialTheme === "vul") {
        window.setTheme("1");
      } else if (initialTheme === "meanDamage") {
        window.setTheme("2");
      } else {
        updateLegend("base");
      }

      console.log("=== RECONSTRUCCIÓN DE CAPAS COMPLETADA (tema restaurado: " + window.currentTheme + ") ===");

      initSearch();

    }).catch(function (err) {
      console.error("Error crítico cargando los outputs de RISK_/BUFF_:", err);
    });
  }

  function tryInit() {
    if (window.map && typeof window.map.addLayer === "function") init();
    else window.addEventListener("mapReady", init, { once: true });
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(tryInit, 0);
  } else {
    document.addEventListener("DOMContentLoaded", tryInit);
  }
})();