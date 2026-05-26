/**
 * siteSwitcher.js  (v3 – fix "Load debris on map")
 *
 * Los botones de localidad ya NO cambian de site activo:
 * cada uno enciende/apaga sus propias capas de forma independiente,
 * permitiendo ver LORCA y PL al mismo tiempo.
 *
 * Depende de (orden de carga en map.html):
 *   1. barrierLayer.js   buildBarrierLayer()
 *   2. mapSetting.js     SITE_DATA + buildSiteLayers() + estilos
 *   3. navSetting.js     controles del panel lateral
 *   4. siteSwitcher.js   ← este fichero, siempre el último
 *
 * FIXES v3:
 *   - enableDebris() reconstruye Buffer y barrierLayer si eran null
 *     en el momento del arranque (datos aún no disponibles).
 *   - refreshBufferAllSites / refreshBarriersAllSites también intentan
 *     reconstruir las capas si son null antes de aplicarlas.
 */

(function () {

    // ── Debris: solo visible tras pulsar "Load debris on map" ─────────────────
    var _debrisEnabled = false;

    // ── Estado de visibilidad de cada site ────────────────────────────────────
    var _visible = { LORCA: false, PL: false };

    // ── Cache de capas ya construidas por site ────────────────────────────────
    var _layerCache = {};

    // ── Referencias globales con sufijo por site ───────────────────────────────
    window.SinContrucion_LORCA  = null;  window.SinContrucion_PL  = null;
    window.Edificios_LORCA      = null;  window.Edificios_PL      = null;
    window.EdificiosVuln_LORCA  = null;  window.EdificiosVuln_PL  = null;
    window.EdificiosDanio_LORCA = null;  window.EdificiosDanio_PL = null;
    window.barrierLayer_LORCA   = null;  window.barrierLayer_PL   = null;
    window._bufferLayer_LORCA   = null;  window._bufferLayer_PL   = null;

    // Alias legacy (apuntan al site primario visible)
    window.SinContrucion  = null;
    window.Edificios      = null;
    window.EdificiosVuln  = null;
    window.EdificiosDanio = null;
    window.barrierLayer   = null;
    window._bufferLayer   = null;

    // ── Devuelve el nombre de la capa temática activa ─────────────────────────
    function getThematicKey() {
        var $checked = $('input[name=tematic]:checked');
        var v = $checked.length ? $checked.val() : '0';
        if (v === '1') return 'EdificiosVuln';
        if (v === '2') return 'EdificiosDanio';
        return 'Edificios';
    }

    // ── Intenta construir Buffer si aún es null (datos llegaron tarde) ─────────
    function ensureBuffer(siteCode) {
        var layers = _layerCache[siteCode];
        if (!layers) return;
        if (!layers.Buffer) {
            var freshBufferin = window.SITE_DATA[siteCode] && window.SITE_DATA[siteCode].bufferin;
            if (freshBufferin) {
                console.log('[siteSwitcher] Construyendo Buffer tardío para: ' + siteCode);
                layers.Buffer = L.geoJSON(freshBufferin, { style: style_B });
                window['_bufferLayer_' + siteCode] = layers.Buffer;
            } else {
                console.warn('[siteSwitcher] Sin datos de bufferin para: ' + siteCode);
            }
        }
    }

    // ── Intenta construir barrierLayer si aún es null o vacío ─────────────────
    function ensureBarriers(siteCode) {
        var layers = _layerCache[siteCode];
        if (!layers) return;
        var isEmpty = !layers.barrierLayer ||
                      (typeof layers.barrierLayer.getLayers === 'function' &&
                       layers.barrierLayer.getLayers().length === 0);
        if (isEmpty) {
            var freshBarrier = window.SITE_DATA[siteCode] && window.SITE_DATA[siteCode].barrierData;
            if (freshBarrier && freshBarrier.length > 0) {
                console.log('[siteSwitcher] Construyendo barrierLayer tardío para: ' + siteCode);
                layers.barrierLayer = buildBarrierLayer(freshBarrier);
                window['barrierLayer_' + siteCode] = layers.barrierLayer;
            } else {
                console.warn('[siteSwitcher] Sin datos de barrierData para: ' + siteCode);
            }
        }
    }

    // ── Construye (o recupera del cache) las capas de un site ─────────────────
    function ensureLayers(siteCode) {
        if (_layerCache[siteCode]) return _layerCache[siteCode];

        var data = window.SITE_DATA[siteCode];
        if (!data) {
            console.error('[siteSwitcher] SITE_DATA no contiene el site: ' + siteCode);
            return null;
        }

        console.log('[siteSwitcher] Construyendo capas para: ' + siteCode);
        console.log('  sinConstruccion : ' + (data.sinConstruccion ? 'OK' : 'NULL ⚠'));
        console.log('  edificios       : ' + (data.edificios       ? 'OK' : 'NULL ⚠'));
        console.log('  excelData       : ' + (data.excelData ? data.excelData.length + ' filas' : 'VACÍO ⚠'));
        console.log('  bufferin        : ' + (data.bufferin        ? 'OK' : 'NULL ⚠'));
        console.log('  barrierData     : ' + (data.barrierData && data.barrierData.length > 0 ? data.barrierData.length + ' barreras' : 'VACÍO ⚠'));

        var layers = buildSiteLayers(data);
        _layerCache[siteCode] = layers;

        // Referencias globales con sufijo
        window['SinContrucion_'  + siteCode] = layers.SinContrucion  || null;
        window['Edificios_'      + siteCode] = layers.Edificios       || null;
        window['EdificiosVuln_'  + siteCode] = layers.EdificiosVuln   || null;
        window['EdificiosDanio_' + siteCode] = layers.EdificiosDanio  || null;
        window['barrierLayer_'   + siteCode] = layers.barrierLayer    || null;
        window['_bufferLayer_'   + siteCode] = layers.Buffer          || null;

        return layers;
    }

    // ── Muestra las capas de un site según el estado de los controles ──────────
    function showSite(siteCode) {
        var layers = ensureLayers(siteCode);
        if (!layers) return;

        // Urbanized Area
        if ($('#ly_parcela').is(':checked') && layers.SinContrucion) {
            layers.SinContrucion.addTo(map);
        }

        // Capa temática
        var key = getThematicKey();
        if (layers[key]) layers[key].addTo(map);

        // Buffer y barreras: solo si debris está habilitado
        if (_debrisEnabled && $('#ly_buffer1').is(':checked') && layers.Buffer) {
            layers.Buffer.addTo(map);
        }
        if (_debrisEnabled && $('#ly_barriers').is(':checked') && layers.barrierLayer) {
            layers.barrierLayer.addTo(map);
        }
    }

    // ── Oculta todas las capas de un site ─────────────────────────────────────
    function hideSite(siteCode) {
        var layers = _layerCache[siteCode];
        if (!layers) return;

        [
            layers.SinContrucion,
            layers.Edificios,
            layers.EdificiosVuln,
            layers.EdificiosDanio,
            layers.barrierLayer,
            layers.Buffer
        ].forEach(function (lyr) {
            if (lyr && map.hasLayer(lyr)) map.removeLayer(lyr);
        });
    }

    // ── Sincroniza alias legacy ────────────────────────────────────────────────
    function syncLegacyAliases() {
        var primary = _visible.LORCA ? 'LORCA' : (_visible.PL ? 'PL' : 'LORCA');
        var layers  = _layerCache[primary] || {};
        window.SinContrucion  = layers.SinContrucion  || null;
        window.Edificios      = layers.Edificios       || null;
        window.EdificiosVuln  = layers.EdificiosVuln   || null;
        window.EdificiosDanio = layers.EdificiosDanio  || null;
        window.barrierLayer   = layers.barrierLayer    || null;
        window._bufferLayer   = layers.Buffer          || null;

        if (window.bufferManual) {
            window.bufferManual.Buffer = window._bufferLayer || null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // API pública: window.enableDebris()
    // Llamada por el botón "Load debris on map".
    // FIX v3: intenta reconstruir Buffer y barrierLayer si eran null al arrancar.
    // ─────────────────────────────────────────────────────────────────────────
    window.enableDebris = function () {
        _debrisEnabled = true;
        console.log('[siteSwitcher] enableDebris() llamado');

        // Si ningún site está visible, activar LORCA por defecto
        var anySiteVisible = ['LORCA', 'PL'].some(function (code) {
            return _visible[code];
        });
        if (!anySiteVisible) {
            _visible['LORCA'] = true;
            showSite('LORCA');
            syncLegacyAliases();
            updateButtonStates();
        }

        // FIX: reconstruir Buffer y barrierLayer si llegaron tarde
        ['LORCA', 'PL'].forEach(function (code) {
            if (!_layerCache[code]) return; // site nunca inicializado, ignorar
            ensureBuffer(code);
            ensureBarriers(code);
        });

        // Activar checkbox y mostrar las capas en todos los sites visibles
        $('#ly_buffer1').prop('checked', true).trigger('change');
        $('li#li_ly_buffer1').css('display', 'list-item');
        window.refreshBufferAllSites(true);
        $('#ly_barriers').prop('checked', true).trigger('change');
        window.refreshBarriersAllSites(true);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // API pública: window.toggleSite(siteCode)
    // ─────────────────────────────────────────────────────────────────────────
    window.toggleSite = function (siteCode) {
        if (!window.SITE_DATA[siteCode]) {
            console.error('[siteSwitcher] Site desconocido: ' + siteCode);
            return;
        }

        _visible[siteCode] = !_visible[siteCode];

        if (_visible[siteCode]) {
            showSite(siteCode);
            // Zoom al site recién activado
            var layers = _layerCache[siteCode] || {};
            var targetLayer = layers.Edificios || layers.SinContrucion;
            if (targetLayer) {
                try {
                    map.fitBounds(targetLayer.getBounds(), { animate: true, padding: [20, 20] });
                } catch (e) {
                    var d = window.SITE_DATA[siteCode];
                    map.setView(d.center, d.zoom);
                }
            }
        } else {
            hideSite(siteCode);
            if (window.closeInfoPanel) window.closeInfoPanel();
        }

        syncLegacyAliases();
        updateButtonStates();
        console.log('[siteSwitcher] Toggle ' + siteCode + ' → ' + (_visible[siteCode] ? 'ON' : 'OFF'));
    };

    // ── Actualiza el aspecto visual de los botones flotantes ──────────────────
    function updateButtonStates() {
        ['LORCA', 'PL'].forEach(function (code) {
            var $btn = $('.locality-btn[data-site="' + code + '"]');
            if (_visible[code]) {
                $btn.removeClass('inactive');
            } else {
                $btn.addClass('inactive');
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Hooks para navSetting.js
    // ─────────────────────────────────────────────────────────────────────────

    /** Reaplica la capa temática en todos los sites visibles */
    window.refreshThematicAllSites = function () {
        ['LORCA', 'PL'].forEach(function (code) {
            if (!_visible[code]) return;
            var layers = _layerCache[code];
            if (!layers) return;

            ['Edificios', 'EdificiosVuln', 'EdificiosDanio'].forEach(function (k) {
                if (layers[k] && map.hasLayer(layers[k])) map.removeLayer(layers[k]);
            });

            var key = getThematicKey();
            if (layers[key]) layers[key].addTo(map);
        });
        syncLegacyAliases();
    };

    /** Aplica o quita Urbanized Area en todos los sites visibles */
    window.refreshParcelaAllSites = function (show) {
        ['LORCA', 'PL'].forEach(function (code) {
            if (!_visible[code]) return;
            var layers = _layerCache[code];
            if (!layers || !layers.SinContrucion) return;
            if (show) layers.SinContrucion.addTo(map);
            else if (map.hasLayer(layers.SinContrucion)) map.removeLayer(layers.SinContrucion);
        });
    };

    /** Aplica o quita la capa de buffer en todos los sites visibles.
     *  FIX v3: intenta reconstruir si Buffer es null antes de aplicar. */
    window.refreshBufferAllSites = function (show) {
        ['LORCA', 'PL'].forEach(function (code) {
            if (!_visible[code]) return;
            // Intentar reconstruir si faltaba al arrancar
            if (show) ensureBuffer(code);
            var layers = _layerCache[code];
            if (!layers || !layers.Buffer) return;
            if (show) layers.Buffer.addTo(map);
            else if (map.hasLayer(layers.Buffer)) map.removeLayer(layers.Buffer);
        });
    };

    /** Aplica o quita barreras en todos los sites visibles.
     *  FIX v3: intenta reconstruir si barrierLayer es null antes de aplicar. */
    window.refreshBarriersAllSites = function (show) {
        ['LORCA', 'PL'].forEach(function (code) {
            if (!_visible[code]) return;
            // Intentar reconstruir si faltaba al arrancar
            if (show) ensureBarriers(code);
            var layers = _layerCache[code];
            if (!layers || !layers.barrierLayer) return;
            if (show) layers.barrierLayer.addTo(map);
            else if (map.hasLayer(layers.barrierLayer)) map.removeLayer(layers.barrierLayer);
        });
    };


    // ─────────────────────────────────────────────────────────────────────────
    // API pública: window.resetSiteCache()
    // Llamada después de que Python termina un nuevo cálculo y los scripts
    // de datos han sido re-inyectados en el DOM con timestamp fresco.
    // ─────────────────────────────────────────────────────────────────────────
    window.resetSiteCache = function () {
        console.log('[siteSwitcher] resetSiteCache() — invalidando cache de capas');

        var wasVisible = {};
        ['LORCA', 'PL'].forEach(function (code) {
            wasVisible[code] = !!_visible[code];
        });

        ['LORCA', 'PL'].forEach(function (code) {
            hideSite(code);
            _visible[code] = false;
        });

        window.SinContrucion_LORCA  = null;  window.SinContrucion_PL  = null;
        window.Edificios_LORCA      = null;  window.Edificios_PL      = null;
        window.EdificiosVuln_LORCA  = null;  window.EdificiosVuln_PL  = null;
        window.EdificiosDanio_LORCA = null;  window.EdificiosDanio_PL = null;
        window.barrierLayer_LORCA   = null;  window.barrierLayer_PL   = null;
        window._bufferLayer_LORCA   = null;  window._bufferLayer_PL   = null;

        _layerCache = {};

        // Reset debris flag y desmarcar checkboxes disparando change
        // para que navSetting.js limpie la leyenda correctamente
        _debrisEnabled = false;
        $('#ly_buffer1').prop('checked', false).trigger('change');
        $('li#li_ly_buffer1').css('display', 'none');
        $('#ly_barriers').prop('checked', false).trigger('change');

        if (window.map) {
            window.map.eachLayer(function (layer) {
                if (layer === window.osm || layer === window.pnoa) return;
                window.map.removeLayer(layer);
            });
        }

        ['LORCA', 'PL'].forEach(function (code) {
            if (wasVisible[code]) {
                _visible[code] = true;
                showSite(code);
            }
        });

        var anyVisible = ['LORCA', 'PL'].some(function (c) { return _visible[c]; });
        if (!anyVisible) {
            _visible['LORCA'] = true;
            showSite('LORCA');
        }

        syncLegacyAliases();
        updateButtonStates();
        console.log('[siteSwitcher] resetSiteCache() — completado');
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Arranque inicial: activar LORCA por defecto
    // ─────────────────────────────────────────────────────────────────────────
    window.toggleSite('LORCA');

})();