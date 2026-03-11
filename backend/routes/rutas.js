const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { calcularDistancias, ordenarPorDistancia, generarURLGoogleMapsMobile } = require('../utils/googleMaps');
const { geocodificarDireccion } = require('../utils/geocoding');

// GET - Obtener todas las rutas
router.get('/', (req, res) => {
  db.all(`
    SELECT r.*, m.numero as movil_numero, m.conductor 
    FROM rutas r 
    LEFT JOIN moviles m ON r.movil_id = m.id 
    ORDER BY r.creado_en DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// GET - Obtener ruta por ID con sus paradas
router.get('/:id', (req, res) => {
  db.get(`
    SELECT r.*, m.numero as movil_numero, m.conductor 
    FROM rutas r 
    LEFT JOIN moviles m ON r.movil_id = m.id 
    WHERE r.id = ?
  `, [req.params.id], (err, ruta) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!ruta) {
      res.status(404).json({ mensaje: 'Ruta no encontrada' });
      return;
    }

    // Obtener paradas de la ruta
    db.all(
      `SELECT pr.*, c.razon_social, c.direccion, c.latitud, c.longitud, c.telefono, c.email
       FROM paradas_ruta pr
       JOIN clientes c ON pr.cliente_rut = c.rut
       WHERE pr.ruta_id = ?
       ORDER BY pr.orden`,
      [req.params.id],
      (err, paradas) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ ...ruta, paradas: paradas || [] });
      }
    );
  });
});

// POST - Crear nueva ruta con clientes (todo en un request)
router.post('/', async (req, res) => {
  const { nombre, movil_id, cliente_ruts, descripcion } = req.body;
  
  if (!nombre || !cliente_ruts || cliente_ruts.length === 0) {
    res.status(400).json({ error: 'Nombre y al menos un cliente son requeridos' });
    return;
  }

  try {
    // Obtener punto de inicio desde .env (coordenadas manuales)
    const puntoInicio = {
      latitud: parseFloat(process.env.PUNTO_INICIO_LATITUD) || -36.6068823,
      longitud: parseFloat(process.env.PUNTO_INICIO_LONGITUD) || -72.1135498,
      nombre: process.env.PUNTO_INICIO_NOMBRE || 'Almacén Central'
    };

    console.log(`✅ Punto de inicio: ${puntoInicio.nombre} (${puntoInicio.latitud}, ${puntoInicio.longitud})`);

    // Obtener coordenadas de clientes
    const placeholders = cliente_ruts.map(() => '?').join(',');
    db.all(
      `SELECT * FROM clientes WHERE rut IN (${placeholders})`,
      cliente_ruts,
      async (err, clientes) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (clientes.length === 0) {
          res.status(400).json({ error: 'Ninguno de los clientes existe en la base de datos' });
          return;
        }

        // Filtrar clientes con coordenadas válidas (pero sin requerir coordenadas)
        const clientesValidos = clientes.filter(c => c.latitud && c.longitud);
        
        if (clientesValidos.length === 0) {
          res.status(400).json({ 
            error: 'Los clientes seleccionados no tienen coordenadas válidas. Por favor agrega latitud y longitud a los clientes.' 
          });
          return;
        }

        try {
          // Calcular distancias
          console.log(`📏 Calculando distancias para ${clientesValidos.length} clientes...`);
          const distancias = await calcularDistancias(puntoInicio, clientesValidos);
          console.log(`✅ Distancias calculadas:`, distancias.map(d => `${d.cliente.razon_social}: ${d.distancia_km.toFixed(2)}km`));
          
          const ordenados = ordenarPorDistancia(distancias);
          console.log(`📍 Orden optimizado:`, ordenados.map(d => d.cliente.razon_social).join(' → '));

          // Generar URL de Google Maps (compatible con móviles)
          const paradas = ordenados.map(d => ({
            latitud: d.cliente.latitud,
            longitud: d.cliente.longitud,
            nombre: d.cliente.razon_social
          }));
          console.log(`🗺️ Generando URL de Google Maps...`);
          const urlMaps = generarURLGoogleMapsMobile(puntoInicio, paradas);
          console.log(`✅ URL generada:`, urlMaps.substring(0, 100) + '...');

          // Guardar ruta y paradas en transacción
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            // Insertar ruta
            db.run(
              `INSERT INTO rutas (nombre, movil_id, descripcion, url_maps) VALUES (?, ?, ?, ?)`,
              [nombre, movil_id || null, descripcion || '', urlMaps],
              function(errRuta) {
                if (errRuta) {
                  db.run('ROLLBACK');
                  res.status(500).json({ error: errRuta.message });
                  return;
                }

                const rutaId = this.lastID;

                // Insertar paradas
                let pendientes = ordenados.length;
                ordenados.forEach((item, index) => {
                  db.run(
                    `INSERT INTO paradas_ruta (ruta_id, cliente_rut, orden, distancia_km, duracion_min) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [rutaId, item.cliente.rut, index + 1, item.distancia_km, item.duracion_min || 0],
                    (errParada) => {
                      pendientes--;
                      if (errParada) {
                        db.run('ROLLBACK');
                        res.status(500).json({ error: errParada.message });
                        return;
                      }

                      if (pendientes === 0) {
                        db.run('COMMIT', (errCommit) => {
                          if (errCommit) {
                            res.status(500).json({ error: errCommit.message });
                            return;
                          }
                          
                          res.status(201).json({
                            ruta_id: rutaId,
                            nombre,
                            movil_id,
                            paradas: ordenados.map((d, i) => ({
                              orden: i + 1,
                              cliente_rut: d.cliente.rut,
                              razon_social: d.cliente.razon_social,
                              direccion: d.cliente.direccion,
                              distancia_km: d.distancia_km.toFixed(2),
                              duracion_min: (d.duracion_min || 0).toFixed(0)
                            })),
                            urlMaps,
                            distancia_total_km: ordenados.reduce((sum, d) => sum + d.distancia_km, 0).toFixed(2),
                            mensaje: 'Ruta creada exitosamente'
                          });
                        });
                      }
                    }
                  );
                });
              }
            );
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar ruta
router.delete('/:id', (req, res) => {
  db.run('BEGIN TRANSACTION', (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Eliminar paradas primero
    db.run('DELETE FROM paradas_ruta WHERE ruta_id = ?', [req.params.id], (err) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }

      // Luego eliminar ruta
      db.run('DELETE FROM rutas WHERE id = ?', [req.params.id], function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }

        if (this.changes === 0) {
          db.run('ROLLBACK');
          res.status(404).json({ mensaje: 'Ruta no encontrada' });
          return;
        }

        db.run('COMMIT', (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ mensaje: 'Ruta eliminada exitosamente' });
        });
      });
    });
  });
});

module.exports = router;

// POST - Crear nueva ruta
router.post('/', (req, res) => {
  const { nombre, punto_inicio_latitud, punto_inicio_longitud, punto_inicio_nombre, descripcion } = req.body;
  
  if (!nombre || punto_inicio_latitud === undefined || punto_inicio_longitud === undefined) {
    res.status(400).json({ error: 'Nombre y coordenadas del punto de inicio son requeridas' });
    return;
  }

  db.run(
    `INSERT INTO rutas (nombre, punto_inicio_latitud, punto_inicio_longitud, punto_inicio_nombre, descripcion) 
     VALUES (?, ?, ?, ?, ?)`,
    [nombre, punto_inicio_latitud, punto_inicio_longitud, punto_inicio_nombre || 'Punto de inicio', descripcion || ''],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ 
        id: this.lastID, 
        nombre,
        mensaje: 'Ruta creada exitosamente' 
      });
    }
  );
});

// POST - Calcular y optimizar ruta con clientes
router.post('/:id/calcular-ruta', async (req, res) => {
  const { cliente_ruts } = req.body;
  
  if (!cliente_ruts || cliente_ruts.length === 0) {
    res.status(400).json({ error: 'Se requieren al menos un cliente' });
    return;
  }

  try {
    // Obtener ruta
    db.get('SELECT * FROM rutas WHERE id = ?', [req.params.id], async (err, ruta) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!ruta) {
        res.status(404).json({ mensaje: 'Ruta no encontrada' });
        return;
      }

      try {
        // Obtener coordenadas de clientes
        const placeholders = cliente_ruts.map(() => '?').join(',');
        db.all(
          `SELECT * FROM clientes WHERE rut IN (${placeholders})`,
          cliente_ruts,
          async (err, clientes) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            // Filtrar clientes con coordenadas válidas
            const clientesValidos = clientes.filter(c => c.latitud && c.longitud);
            
            if (clientesValidos.length === 0) {
              res.status(400).json({ error: 'Los clientes seleccionados no tienen coordenadas válidas' });
              return;
            }

            // Calcular distancias
            const puntoInicio = {
              latitud: ruta.punto_inicio_latitud,
              longitud: ruta.punto_inicio_longitud
            };

            const distancias = await calcularDistancias(puntoInicio, clientesValidos);
            const ordenados = ordenarPorDistancia(distancias);

            // Generar URL de Google Maps
            const paradas = ordenados.map(d => ({
              latitud: d.cliente.latitud,
              longitud: d.cliente.longitud
            }));
            const urlMaps = generarURLGoogleMaps(puntoInicio, paradas);

            // Guardar paradas en BD
            db.run('BEGIN TRANSACTION', (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }

              // Primero eliminar paradas anteriores
              db.run('DELETE FROM paradas_ruta WHERE ruta_id = ?', [req.params.id], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  res.status(500).json({ error: err.message });
                  return;
                }

                // Insertar nuevas paradas
                let pendientes = ordenados.length;
                ordenados.forEach((item, index) => {
                  db.run(
                    `INSERT INTO paradas_ruta (ruta_id, cliente_rut, orden, distancia_km) 
                     VALUES (?, ?, ?, ?)`,
                    [req.params.id, item.cliente.rut, index + 1, item.distancia_km],
                    (err) => {
                      pendientes--;
                      if (err) {
                        db.run('ROLLBACK');
                        res.status(500).json({ error: err.message });
                        return;
                      }

                      if (pendientes === 0) {
                        db.run('COMMIT', (err) => {
                          if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                          }
                          
                          res.json({
                            ruta_id: req.params.id,
                            paradas: ordenados.map((d, i) => ({
                              orden: i + 1,
                              cliente_rut: d.cliente.rut,
                              razon_social: d.cliente.razon_social,
                              direccion: d.cliente.direccion,
                              distancia_km: d.distancia_km.toFixed(2),
                              duracion_min: d.duracion_min.toFixed(0)
                            })),
                            urlMaps,
                            distancia_total_km: ordenados.reduce((sum, d) => sum + d.distancia_km, 0).toFixed(2)
                          });
                        });
                      }
                    }
                  );
                });
              });
            });
          }
        );
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar ruta
router.delete('/:id', (req, res) => {
  db.run('BEGIN TRANSACTION', (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Eliminar paradas primero
    db.run('DELETE FROM paradas_ruta WHERE ruta_id = ?', [req.params.id], (err) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }

      // Luego eliminar ruta
      db.run('DELETE FROM rutas WHERE id = ?', [req.params.id], function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }

        if (this.changes === 0) {
          db.run('ROLLBACK');
          res.status(404).json({ mensaje: 'Ruta no encontrada' });
          return;
        }

        db.run('COMMIT', (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ mensaje: 'Ruta eliminada exitosamente' });
        });
      });
    });
  });
});

module.exports = router;
