// js/mapInit.js
// Crea la variable global window.map y notifica con evento mapReady

(function(){
  // Evitar recrear si ya existe
  if (window.map && typeof window.map.addLayer === 'function') {
    // notificar por si alguien espera el evento
    try { window.dispatchEvent(new Event('mapReady')); } catch(e){}
    return;
  }

  // Crear mapa
  var map = L.map('map', {
    center: [37.98, -1.13], // ajustar coordenadas
    zoom: 12
  });

  // Exponer globalmente
  window.map = map;

  // Añadir capa base
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Notificar que el mapa está listo para que mapSettingSSCC lo detecte
  try {
    window.dispatchEvent(new Event('mapReady'));
  } catch(e){
    // fallback: nada
  }
})();
