const axios = require('axios');

/**
 * Geocodifica una dirección usando OpenStreetMap Nominatim (gratuito)
 * @param {string} direccion - Dirección a geocodificar
 * @param {string} ciudad - Ciudad/región (opcional, mejora precisión)
 * @returns {Promise<{latitud: number, longitud: number} | null>}
 */
async function geocodificarDireccion(direccion, ciudad = '') {
  try {
    // Combinar dirección y ciudad para mayor precisión
    let direccionCompleta = direccion;
    if (ciudad) {
      direccionCompleta += `, ${ciudad}, Chile`;
    } else {
      direccionCompleta += ', Chile';
    }

    console.log(`🌍 Geocodificando con OpenStreetMap: ${direccionCompleta}`);

    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: direccionCompleta,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'BitacorasEficientes/1.0'
      }
    });

    if (response.data && response.data.length > 0) {
      const resultado = response.data[0];
      const coordenadas = {
        latitud: parseFloat(resultado.lat),
        longitud: parseFloat(resultado.lon)
      };
      console.log(`✅ Coordenadas encontradas: ${coordenadas.latitud}, ${coordenadas.longitud}`);
      return coordenadas;
    } else {
      console.warn(`⚠️ No se encontró ubicación para: ${direccionCompleta}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error al geocodificar dirección:', error.message);
    return null;
  }
}

module.exports = {
  geocodificarDireccion
};
