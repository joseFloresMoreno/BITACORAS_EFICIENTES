const express = require('express');
const router = express.Router();
const { obtenerDireccionDesdeCoord } = require('../utils/geocoding');

/**
 * API de desarrollo - Herramientas útiles durante el desarrollo
 * NOTA: Estas rutas son solo para desarrollo y deben removerse en producción
 */

// GET - Obtener configuración actual (coordenadas del .env)
router.get('/config', (req, res) => {
  const config = {
    punto_inicio: {
      latitud: parseFloat(process.env.PUNTO_INICIO_LATITUD),
      longitud: parseFloat(process.env.PUNTO_INICIO_LONGITUD),
      nombre: process.env.PUNTO_INICIO_NOMBRE || 'Almacén Central'
    }
  };

  console.log(`🔧 [DEV] Configuración solicitada:`, config);
  res.json(config);
});

// GET - Geocodificación inversa (coordenadas a dirección)
router.get('/geocoding-inverso', async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    res.status(400).json({
      success: false,
      mensaje: 'Se requieren parámetros lat y lon'
    });
    return;
  }

  try {
    const latitud = parseFloat(lat);
    const longitud = parseFloat(lon);

    console.log(`🔧 [DEV] Geocodificación inversa solicitada: (${latitud}, ${longitud})`);

    const direccion = await obtenerDireccionDesdeCoord(latitud, longitud);

    if (direccion) {
      res.json({
        success: true,
        coordenadas: {
          latitud,
          longitud
        },
        direccion: direccion,
        mensaje: 'Dirección obtenida exitosamente desde OpenStreetMap'
      });
    } else {
      res.json({
        success: false,
        coordenadas: {
          latitud,
          longitud
        },
        mensaje: 'No se encontró dirección para las coordenadas especificadas'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      mensaje: 'Error al geocodificar inversamente'
    });
  }
});

module.exports = router;
