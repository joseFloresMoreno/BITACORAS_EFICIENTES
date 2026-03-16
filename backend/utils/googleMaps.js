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

// Función para ordenar clientes por distancia (ordenamiento simple por distancia inicial)
function ordenarPorDistancia(distancias) {
  return distancias.sort((a, b) => a.distancia_km - b.distancia_km);
}

/**
 * Algoritmo de Nearest Neighbor (Vecino más cercano) para optimizar rutas
 * Evita saturar la API haciendo cálculos en batches
 * 
 * Algoritmo:
 * 1. Comienza en el punto inicial
 * 2. Encuentra el cliente más cercano al punto actual
 * 3. Agrega ese cliente a la ruta
 * 4. Repite desde el nuevo cliente hasta visitar todos
 */
async function optimizarRutaNearestNeighbor(puntoInicio, clientesOriginales) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ Google Maps API Key no configurada. Usando ordenamiento simple');
    return clientesOriginales.map(cliente => ({
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

  try {
    const rutaOptimizada = [];
    const clientesNoVisitados = [...clientesOriginales];
    let puntoActual = puntoInicio;
    let distanciaTotal = 0;

    console.log(`🔄 Iniciando optimización con Nearest Neighbor (${clientesNoVisitados.length} clientes)...`);

    // Iterar hasta que todos los clientes estén visitados
    while (clientesNoVisitados.length > 0) {
      console.log(`  📍 Buscando cliente más cercano a ${puntoActual.nombre} (${clientesNoVisitados.length} restantes)...`);

      // Calcular distancias a todos los clientes no visitados
      const destinos = clientesNoVisitados.map(cliente => 
        `${cliente.latitud},${cliente.longitud}`
      ).join('|');

      const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: {
          origins: `${puntoActual.latitud},${puntoActual.longitud}`,
          destinations: destinos,
          key: apiKey,
          units: 'metric'
        }
      });

      if (response.data.status !== 'OK') {
        console.warn(`⚠️ Google Maps retornó: ${response.data.status}`);
        break;
      }

      // Encontrar el cliente más cercano
      let clienteMasCercanoIndex = 0;
      let distanciaMinima = Infinity;

      response.data.rows[0].elements.forEach((elemento, index) => {
        if (elemento.distance) {
          const distanciaKm = elemento.distance.value / 1000;
          if (distanciaKm < distanciaMinima) {
            distanciaMinima = distanciaKm;
            clienteMasCercanoIndex = index;
          }
        }
      });

      // Agregar el cliente más cercano a la ruta
      const clienteSeleccionado = clientesNoVisitados[clienteMasCercanoIndex];
      const durationMin = response.data.rows[0].elements[clienteMasCercanoIndex].duration 
        ? response.data.rows[0].elements[clienteMasCercanoIndex].duration.value / 60 
        : 0;

      rutaOptimizada.push({
        cliente: clienteSeleccionado,
        distancia_km: distanciaMinima,
        duracion_min: durationMin
      });

      distanciaTotal += distanciaMinima;
      console.log(`  ✅ Agregado: ${clienteSeleccionado.razon_social} (${distanciaMinima.toFixed(2)}km)`);

      // Actualizar el punto actual y remover el cliente visitado
      puntoActual = {
        latitud: clienteSeleccionado.latitud,
        longitud: clienteSeleccionado.longitud,
        nombre: clienteSeleccionado.razon_social
      };
      clientesNoVisitados.splice(clienteMasCercanoIndex, 1);

      // Pequeña pausa para no saturar la API
      if (clientesNoVisitados.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`🎯 Ruta optimizada completada. Distancia total: ${distanciaTotal.toFixed(2)}km`);
    return rutaOptimizada;

  } catch (error) {
    console.error('❌ Error al optimizar ruta con Nearest Neighbor:', error.message);
    console.log('📍 Usando ordenamiento simple como fallback...');
    return clientesOriginales.map(cliente => ({
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
// RUTA CERRADA: Sale del punto de inicio, pasa por todos los clientes, y regresa al punto de inicio
function generarURLGoogleMapsMobile(puntoInicio, paradas) {
  if (paradas.length === 0) {
    throw new Error('Se requieren al menos una parada');
  }

  // Usar Google Maps Directions API con formato deeplink
  // Este formato abre automáticamente en Google Maps en dispositivos móviles
  let url = 'https://www.google.com/maps/dir/?api=1';
  
  // Punto de origen
  url += `&origin=${puntoInicio.latitud},${puntoInicio.longitud}`;
  
  // Destino final: Volvemos al punto de origen (ruta cerrada)
  url += `&destination=${puntoInicio.latitud},${puntoInicio.longitud}`;
  
  // Waypoints (todos los clientes en orden de visita)
  if (paradas.length > 0) {
    const waypoints = paradas.map(p => `${p.latitud},${p.longitud}`).join('|');
    url += `&waypoints=${waypoints}`;
  }
  
  // Parámetros adicionales para móvil
  url += '&travelmode=driving';
  
  return url;
}

module.exports = {
  calcularDistancias,
  ordenarPorDistancia,
  optimizarRutaNearestNeighbor,
  generarURLGoogleMaps,
  generarURLGoogleMapsMobile
};
