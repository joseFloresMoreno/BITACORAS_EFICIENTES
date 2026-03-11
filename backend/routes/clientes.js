const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { validarRUT, formatearRUT } = require('../utils/rut');
const { geocodificarDireccion } = require('../utils/geocoding');
const regionesYComunas = require('../utils/regionesYComunas');

// GET - Obtener regiones y comunas
router.get('/data/regiones-comunas', (req, res) => {
  res.json(regionesYComunas);
});

// GET - Geocodificar una dirección sin guardar (para búsqueda en tiempo real)
router.get('/geocodificar/search/:direccion', async (req, res) => {
  const direccion = req.params.direccion;
  const ciudad = req.query.ciudad || '';
  
  try {
    console.log(`🔍 Buscando coordenadas en tiempo real: ${direccion}, ${ciudad}`);
    const coordenadas = await geocodificarDireccion(direccion, ciudad);
    
    if (coordenadas) {
      console.log(`✅ Coordenadas encontradas: ${coordenadas.latitud}, ${coordenadas.longitud}`);
      res.json(coordenadas);
    } else {
      res.status(404).json({ error: 'No se encontraron coordenadas' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener todos los clientes
router.get('/', (req, res) => {
  db.all('SELECT rut, razon_social, direccion, region, comuna, telefono, email, creado_en FROM clientes ORDER BY razon_social', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// GET - Obtener cliente por RUT
router.get('/:rut', (req, res) => {
  const rut = formatearRUT(req.params.rut);
  db.get('SELECT * FROM clientes WHERE rut = ?', [rut], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ mensaje: 'Cliente no encontrado' });
      return;
    }
    res.json(row);
  });
});

// POST - Crear nuevo cliente
router.post('/', async (req, res) => {
  const { rut, razon_social, direccion, region, comuna, telefono, email, latitud, longitud } = req.body;
  
  if (!rut || !razon_social || !direccion || !region || !comuna) {
    res.status(400).json({ error: 'Faltan campos requeridos' });
    return;
  }

  if (!validarRUT(rut)) {
    res.status(400).json({ error: 'RUT inválido' });
    return;
  }

  const rutFormateado = formatearRUT(rut);

  try {
    let coordenadas = null;

    // Si el frontend proporciona coordenadas, usarlas
    if (latitud && longitud) {
      console.log(`📍 Usando coordenadas proporcionadas por cliente: ${latitud}, ${longitud}`);
      coordenadas = { latitud: parseFloat(latitud), longitud: parseFloat(longitud) };
    } else {
      // Si no, geocodificar dirección para obtener coordenadas
      console.log(`🔍 Geocodificando: ${direccion}, ${comuna}`);
      coordenadas = await geocodificarDireccion(direccion, comuna);
      
      if (coordenadas) {
        console.log(`✅ Coordenadas encontradas: ${coordenadas.latitud}, ${coordenadas.longitud}`);
      } else {
        console.log(`⚠️ No se encontraron coordenadas, continuando sin ellas`);
      }
    }

    db.run(
      'INSERT INTO clientes (rut, razon_social, direccion, region, comuna, telefono, email, latitud, longitud) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        rutFormateado, 
        razon_social, 
        direccion, 
        region, 
        comuna, 
        telefono || null, 
        email || null,
        coordenadas ? coordenadas.latitud : null,
        coordenadas ? coordenadas.longitud : null
      ],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed: clientes.rut')) {
            res.status(400).json({ error: 'El RUT ya está registrado' });
          } else {
            res.status(500).json({ error: err.message });
          }
          return;
        }
        res.status(201).json({ 
          rut: rutFormateado, 
          razon_social,
          latitud: coordenadas ? coordenadas.latitud : null,
          longitud: coordenadas ? coordenadas.longitud : null,
          mensaje: `Cliente creado exitosamente${coordenadas ? ' con coordenadas' : ' sin se pudo geocodificar'}` 
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar cliente: ' + error.message });
  }
});

// PUT - Actualizar cliente
router.put('/:rut', async (req, res) => {
  const rutOriginal = formatearRUT(req.params.rut);
  const { razon_social, direccion, region, comuna, telefono, email } = req.body;
  
  if (!razon_social || !direccion || !region || !comuna) {
    res.status(400).json({ error: 'Faltan campos requeridos' });
    return;
  }

  try {
    // Geocodificar dirección para obtener coordenadas
    console.log(`🔍 Geocodificando actualización: ${direccion}, ${comuna}`);
    const coordenadas = await geocodificarDireccion(direccion, comuna);
    
    if (coordenadas) {
      console.log(`✅ Coordenadas encontradas: ${coordenadas.latitud}, ${coordenadas.longitud}`);
    } else {
      console.log(`⚠️ No se encontraron coordenadas, continuando sin ellas`);
    }

    db.run(
      'UPDATE clientes SET razon_social = ?, direccion = ?, region = ?, comuna = ?, telefono = ?, email = ?, latitud = ?, longitud = ?, actualizado_en = CURRENT_TIMESTAMP WHERE rut = ?',
      [
        razon_social, 
        direccion, 
        region, 
        comuna, 
        telefono || null, 
        email || null,
        coordenadas ? coordenadas.latitud : null,
        coordenadas ? coordenadas.longitud : null,
        rutOriginal
      ],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ mensaje: 'Cliente no encontrado' });
          return;
        }
        res.json({ 
          rut: rutOriginal,
          latitud: coordenadas ? coordenadas.latitud : null,
          longitud: coordenadas ? coordenadas.longitud : null,
          mensaje: `Cliente actualizado exitosamente${coordenadas ? ' con nuevas coordenadas' : ''}` 
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar cliente: ' + error.message });
  }
});

// POST - Geocodificar cliente específico y guardar coordenadas
router.post('/:rut/geocodificar', async (req, res) => {
  const rut = formatearRUT(req.params.rut);
  
  try {
    // Obtener cliente primero
    db.get('SELECT * FROM clientes WHERE rut = ?', [rut], async (err, cliente) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!cliente) {
        res.status(404).json({ mensaje: 'Cliente no encontrado' });
        return;
      }

      try {
        // Geocodificar dirección
        console.log(`🔍 Geocodificando (búsqueda manual): ${cliente.direccion}, ${cliente.comuna}`);
        const coordenadas = await geocodificarDireccion(cliente.direccion, cliente.comuna);
        
        if (!coordenadas) {
          res.status(400).json({ error: 'No se encontraron coordenadas para esta dirección. Verifica que sea correcta.' });
          return;
        }

        // Guardar coordenadas
        db.run(
          'UPDATE clientes SET latitud = ?, longitud = ?, actualizado_en = CURRENT_TIMESTAMP WHERE rut = ?',
          [coordenadas.latitud, coordenadas.longitud, rut],
          function(err) {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            console.log(`✅ Coordenadas guardadas: ${coordenadas.latitud}, ${coordenadas.longitud}`);
            res.json({
              rut,
              latitud: coordenadas.latitud,
              longitud: coordenadas.longitud,
              mensaje: '✅ Coordenadas encontradas y guardadas exitosamente'
            });
          }
        );
      } catch (error) {
        res.status(500).json({ error: 'Error al geocodificar: ' + error.message });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error: ' + error.message });
  }
});

// DELETE - Eliminar cliente
router.delete('/:rut', (req, res) => {
  const rut = formatearRUT(req.params.rut);
  db.run('DELETE FROM clientes WHERE rut = ?', [rut], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ mensaje: 'Cliente no encontrado' });
      return;
    }
    res.json({ mensaje: 'Cliente eliminado exitosamente' });
  });
});

module.exports = router;
