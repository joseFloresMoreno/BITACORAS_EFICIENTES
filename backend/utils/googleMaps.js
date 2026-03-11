const axios = require('axios');

/**
 * Calcula distancia entre dos puntos usando fórmula Haversine
 * Útil como fallback cuando Google Maps API no está disponible
 */
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Función para calcular distancia usando Google Maps Distance Matrix API
async function calcularDistancias(puntoInicio, clientes) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ Google Maps API Key no configurada. Usando cálculo aproximado (Haversine)');
    // Fallback: usar fórmula Haversine
    return clientes.map(cliente => ({
      cliente,
      distancia_km: calcularDistanciaHaversine(
        puntoInicio.latitud,
        puntoInicio.longitud,
        cliente.latitud,
        cliente.longitud
      ),
      duracion_min: 0 // Estimación no disponible sin API
    }));
  }

  try {
    const destinos = clientes.map(cliente => 
      `${cliente.latitud},${cliente.longitud}`
    ).join('|');

    console.log(`📡 Llamando Google Maps Distance Matrix API...`);
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        origins: `${puntoInicio.latitud},${puntoInicio.longitud}`,
        destinations: destinos,
        key: apiKey,
        units: 'metric'
      }
    });

    console.log(`📡 Respuesta Google Maps: ${response.data.status}`);

    if (response.data.status !== 'OK') {
      console.warn(`⚠️ Google Maps retornó: ${response.data.status}. Usando cálculo aproximado`);
      // Fallback a Haversine
      return clientes.map(cliente => ({
        cliente,
        distancia_km: calcularDistanciaHaversine(
          puntoInicio.latitud,
          puntoInicio.longitud,
          cliente.latitud,
          cliente.longitud
        ),
        duracion_min: 0
      }));
    }

    // Procesar resultados
    const distancias = response.data.rows[0].elements.map((elemento, index) => {
      return {
        cliente: clientes[index],
        distancia_km: elemento.distance ? elemento.distance.value / 1000 : 0,
        duracion_min: elemento.duration ? elemento.duration.value / 60 : 0
      };
    });

    return distancias;
  } catch (error) {
    console.error('❌ Error al calcular distancias con Google Maps:', error.message);
    console.log('📍 Usando fórmula Haversine como fallback...');
    
    // Fallback final: usar Haversine
    return clientes.map(cliente => ({
      cliente,
      distancia_km: calcularDistanciaHaversine(
        puntoInicio.latitud,
        puntoInicio.longitud,
        cliente.latitud,
        cliente.longitud
      ),
      duracion_min: 0
    }));
  }
}

// Función para ordenar clientes por distancia
function ordenarPorDistancia(distancias) {
  return distancias.sort((a, b) => a.distancia_km - b.distancia_km);
}

// Función para generar URL de Google Maps con múltiples paradas
function generarURLGoogleMaps(puntoInicio, paradas) {
  if (paradas.length === 0) {
    throw new Error('Se requieren al menos una parada');
  }

  // Formato: https://www.google.com/maps/dir/punto_inicio/parada1/parada2/.../parada_n
  let url = 'https://www.google.com/maps/dir/';
  
  // Agregar punto de inicio
  url += `${puntoInicio.latitud},${puntoInicio.longitud}/`;
  
  // Agregar paradas
  paradas.forEach((parada, index) => {
    url += `${parada.latitud},${parada.longitud}`;
    if (index < paradas.length - 1) {
      url += '/';
    }
  });

  return url;
}

// Función para generar URL de Google Maps compatible con móviles (Android e iOS)
// Esta URL funciona en apps de mensajería como WhatsApp y envíos por SMS
function generarURLGoogleMapsMobile(puntoInicio, paradas) {
  if (paradas.length === 0) {
    throw new Error('Se requieren al menos una parada');
  }

  // Usar Google Maps Directions API con formato deeplink
  // Este formato abre automáticamente en Google Maps en dispositivos móviles
  let url = 'https://www.google.com/maps/dir/?api=1';
  
  // Punto de origen
  url += `&origin=${puntoInicio.latitud},${puntoInicio.longitud}`;
  
  // Destino final (última parada)
  url += `&destination=${paradas[paradas.length - 1].latitud},${paradas[paradas.length - 1].longitud}`;
  
  // Waypoints (paradas intermedias)
  if (paradas.length > 1) {
    const waypoints = paradas.slice(0, -1).map(p => `${p.latitud},${p.longitud}`).join('|');
    url += `&waypoints=${waypoints}`;
  }
  
  // Parámetros adicionales para móvil
  url += '&travelmode=driving';
  
  return url;
}

module.exports = {
  calcularDistancias,
  ordenarPorDistancia,
  generarURLGoogleMaps,
  generarURLGoogleMapsMobile
};
