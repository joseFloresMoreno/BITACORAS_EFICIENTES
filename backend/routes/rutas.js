const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { optimizarRutaNearestNeighbor, generarURLGoogleMapsMobile } = require('../utils/googleMaps');
const { geocodificarDireccion, obtenerDireccionDesdeCoord } = require('../utils/geocoding');

// 🔄 Sistema de rastreo de progreso para operaciones de cración de rutas
const operacionesEnCurso = {};

// Generar ID único para operaciones
function generarIdOperacion() {
  return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Actualizar progreso de operación
function actualizarProgreso(operacionId, estado, paso, totalPasos, mensaje) {
  if (operacionesEnCurso[operacionId]) {
    operacionesEnCurso[operacionId] = {
      operacionId,
      estado,
      paso,
      totalPasos,
      mensaje,
      timestamp: Date.now()
    };
  }
}

// Limpiar operaciones completadas hace más de 5 minutos
setInterval(() => {
  const ahora = Date.now();
  Object.keys(operacionesEnCurso).forEach(id => {
    if (ahora - operacionesEnCurso[id].timestamp > 5 * 60 * 1000) {
      delete operacionesEnCurso[id];
    }
  });
}, 60 * 1000); // Limpiar cada minuto

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

// GET - Obtener progreso de creación de ruta
router.get('/progreso/:operacionId', (req, res) => {
  const { operacionId } = req.params;
  const progreso = operacionesEnCurso[operacionId];
  
  if (!progreso) {
    res.status(404).json({ error: 'Operación no encontrada o expirada' });
    return;
  }
  
  res.json(progreso);
});

// POST - Crear nueva ruta con clientes (todo en un request)
router.post('/', async (req, res) => {
  const { nombre, movil_id, cliente_ruts, descripcion } = req.body;
  
  if (!nombre || !cliente_ruts || cliente_ruts.length === 0) {
    res.status(400).json({ error: 'Nombre y al menos un cliente son requeridos' });
    return;
  }

  // Generar ID de operación y retornar inmediatamente
  const operacionId = generarIdOperacion();
  operacionesEnCurso[operacionId] = {
    operacionId,
    estado: 'iniciando',
    paso: 1,
    totalPasos: 5,
    mensaje: '🚀 Iniciando creación de ruta...',
    timestamp: Date.now()
  };

  // Retornar operacionId inmediatamente para que el frontend haga polling
  res.json({ 
    operacionId,
    mensaje: 'Procesando creación de ruta. Puedes monitorear el progreso con el ID de operación.' 
  });

  // Procesar en background
  try {
    actualizarProgreso(operacionId, 'validando', 1, 5, '📋 Validando datos...');
    
    // Obtener punto de inicio desde .env (REQUERIDO)
    const latitudEnv = parseFloat(process.env.PUNTO_INICIO_LATITUD);
    const longitudEnv = parseFloat(process.env.PUNTO_INICIO_LONGITUD);

    if (isNaN(latitudEnv) || isNaN(longitudEnv)) {
      console.error('❌ Error: PUNTO_INICIO_LATITUD o PUNTO_INICIO_LONGITUD no están definidas en .env');
      actualizarProgreso(operacionId, 'error', 1, 5, '❌ Error: Coordenadas iniciales no configuradas');
      return;
    }

    const puntoInicio = {
      latitud: latitudEnv,
      longitud: longitudEnv,
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
          console.error('❌ Error al obtener clientes:', err.message);
          actualizarProgreso(operacionId, 'error', 2, 5, '❌ Error al obtener clientes');
          return;
        }

        if (clientes.length === 0) {
          actualizarProgreso(operacionId, 'error', 2, 5, '❌ Ninguno de los clientes existe');
          return;
        }

        // Filtrar clientes con coordenadas válidas (pero sin requerir coordenadas)
        const clientesValidos = clientes.filter(c => c.latitud && c.longitud);
        
        if (clientesValidos.length === 0) {
          actualizarProgreso(operacionId, 'error', 2, 5, '❌ Los clientes no tienen coordenadas válidas');
          return;
        }

        try {
          // Optimizar ruta con algoritmo Nearest Neighbor
          actualizarProgreso(operacionId, 'optimizando', 2, 5, `⚙️ Optimizando ruta para ${clientesValidos.length} clientes...`);
          console.log(`📏 Optimizando ruta para ${clientesValidos.length} clientes usando algoritmo Nearest Neighbor...`);
          const ordenados = await optimizarRutaNearestNeighbor(puntoInicio, clientesValidos);
          console.log(`✅ Ruta optimizada. Orden final:`, ordenados.map(d => d.cliente.razon_social).join(' → '));

          // Generar URL de Google Maps (compatible con móviles)
          actualizarProgreso(operacionId, 'procesando', 3, 5, '🗺️ Generando URL de Google Maps...');
          const paradas = ordenados.map(d => ({
            latitud: d.cliente.latitud,
            longitud: d.cliente.longitud,
            nombre: d.cliente.razon_social
          }));
          console.log(`🗺️ Generando URL de Google Maps...`);
          const urlMaps = generarURLGoogleMapsMobile(puntoInicio, paradas);
          console.log(`✅ URL generada:`, urlMaps.substring(0, 100) + '...');

          // Obtener dirección del punto de inicio desde OSM
          actualizarProgreso(operacionId, 'procesando', 4, 5, '📍 Obteniendo dirección del punto de inicio...');
          console.log(`📍 Obteniendo dirección del punto de inicio desde OpenStreetMap...`);
          const direccionInicio = await obtenerDireccionDesdeCoord(puntoInicio.latitud, puntoInicio.longitud);
          console.log(`📍 Dirección obtenida: ${direccionInicio || 'No disponible'}`);

          // Guardar ruta y paradas en transacción
          actualizarProgreso(operacionId, 'guardando', 5, 5, '💾 Guardando ruta en la base de datos...');
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
              console.error('❌ Error al iniciar transacción:', err.message);
              actualizarProgreso(operacionId, 'error', 5, 5, `❌ Error al guardar: ${err.message}`);
              return;
            }

            // Insertar ruta con coordenadas iniciales y dirección
            db.run(
              `INSERT INTO rutas (nombre, movil_id, descripcion, url_maps, punto_inicio_latitud, punto_inicio_longitud, punto_inicio_nombre, punto_inicio_direccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [nombre, movil_id || null, descripcion || '', urlMaps, puntoInicio.latitud, puntoInicio.longitud, puntoInicio.nombre, direccionInicio || ''],
              function(errRuta) {
                if (errRuta) {
                  db.run('ROLLBACK');
                  console.error('❌ Error al insertar ruta:', errRuta.message);
                  actualizarProgreso(operacionId, 'error', 5, 5, `❌ Error al guardar: ${errRuta.message}`);
                  return;
                }

                const rutaId = this.lastID;

                // Insertar paradas
                let pendientes = ordenados.length;
                let erroresParadas = false;
                
                ordenados.forEach((item, index) => {
                  db.run(
                    `INSERT INTO paradas_ruta (ruta_id, cliente_rut, orden, distancia_km, duracion_min) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [rutaId, item.cliente.rut, index + 1, item.distancia_km, item.duracion_min || 0],
                    (errParada) => {
                      pendientes--;
                      if (errParada) {
                        db.run('ROLLBACK');
                        erroresParadas = true;
                        console.error('❌ Error al insertar parada:', errParada.message);
                        actualizarProgreso(operacionId, 'error', 5, 5, `❌ Error al guardar: ${errParada.message}`);
                        return;
                      }

                      if (pendientes === 0 && !erroresParadas) {
                        db.run('COMMIT', (errCommit) => {
                          if (errCommit) {
                            console.error('❌ Error al hacer commit:', errCommit.message);
                            actualizarProgreso(operacionId, 'error', 5, 5, `❌ Error al guardar: ${errCommit.message}`);
                            return;
                          }
                          
                          console.log(`✅ Ruta ${rutaId} creada exitosamente`);
                          actualizarProgreso(operacionId, 'completado', 5, 5, `✅ Ruta creada exitosamente (ID: ${rutaId})`);
                        });
                      }
                    }
                  );
                });
              }
            );
          });
        } catch (error) {
          console.error('❌ Error en la creación de ruta:', error.message);
          actualizarProgreso(operacionId, 'error', 5, 5, `❌ Error: ${error.message}`);
        }
      }
    );
  } catch (error) {
    console.error('❌ Error general:', error.message);
    actualizarProgreso(operacionId, 'error', 1, 5, `❌ Error: ${error.message}`);
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

// POST - Recalcular ruta existente (actualizar distancias y orden cuando cambian coordenadas de clientes)
router.post('/:id/recalcular', async (req, res) => {
  const rutaId = req.params.id;

  try {
    // Obtener ruta con coordenadas iniciales guardadas
    db.get(
      `SELECT r.*, m.numero as movil_numero, m.conductor 
       FROM rutas r 
       LEFT JOIN moviles m ON r.movil_id = m.id 
       WHERE r.id = ?`,
      [rutaId],
      async (err, ruta) => {
        if (err || !ruta) {
          res.status(404).json({ error: 'Ruta no encontrada' });
          return;
        }

        // Obtener paradas actuales de la ruta
        db.all(
          `SELECT pr.*, c.razon_social, c.direccion, c.latitud, c.longitud
           FROM paradas_ruta pr
           JOIN clientes c ON pr.cliente_rut = c.rut
           WHERE pr.ruta_id = ?`,
          [rutaId],
          async (err, paradas) => {
            if (err || !paradas || paradas.length === 0) {
              res.status(400).json({ error: 'No se encontraron paradas para esta ruta' });
              return;
            }

            try {
              // Punto de inicio actual desde .env (REQUERIDO - siempre obtener las coordenadas actuales)
              const latitudEnv = parseFloat(process.env.PUNTO_INICIO_LATITUD);
              const longitudEnv = parseFloat(process.env.PUNTO_INICIO_LONGITUD);

              if (isNaN(latitudEnv) || isNaN(longitudEnv)) {
                res.status(500).json({ error: 'Las coordenadas iniciales no están configuradas en el .env' });
                return;
              }

              const puntoInicio = {
                latitud: latitudEnv,
                longitud: longitudEnv,
                nombre: process.env.PUNTO_INICIO_NOMBRE || 'Almacén Central'
              };

              // Punto de inicio guardado (del momento de creación de la ruta)
              const puntoInicioPrevio = {
                latitud: ruta.punto_inicio_latitud,
                longitud: ruta.punto_inicio_longitud,
                nombre: ruta.punto_inicio_nombre || 'Almacén Central'
              };

              // Detectar cambios en coordenadas iniciales
              const coordenadasCambiaron = 
                puntoInicio.latitud !== puntoInicioPrevio.latitud || 
                puntoInicio.longitud !== puntoInicioPrevio.longitud;

              let cambiosDetectados = {
                coordenadasIniciales: false,
                detallesCambios: null
              };

              if (coordenadasCambiaron) {
                cambiosDetectados.coordenadasIniciales = true;
                cambiosDetectados.detallesCambios = {
                  mensaje: '🚨 Las coordenadas iniciales han cambiado',
                  punto_anterior: {
                    nombre: puntoInicioPrevio.nombre,
                    latitud: puntoInicioPrevio.latitud,
                    longitud: puntoInicioPrevio.longitud
                  },
                  punto_actual: {
                    nombre: puntoInicio.nombre,
                    latitud: puntoInicio.latitud,
                    longitud: puntoInicio.longitud
                  }
                };
                console.log(`🚨 ALERTA: Coordenadas iniciales cambiadas para ruta ${rutaId}`);
                console.log(`   Anterior: ${puntoInicioPrevio.nombre} (${puntoInicioPrevio.latitud}, ${puntoInicioPrevio.longitud})`);
                console.log(`   Actual: ${puntoInicio.nombre} (${puntoInicio.latitud}, ${puntoInicio.longitud})`);
              }

              console.log(`♻️ Recalculando ruta ${rutaId}...`);
              console.log(coordenadasCambiaron ? `Usando coordenadas iniciales ACTUALES para recalculo` : `Coordenadas iniciales sin cambios`);

              // Recalcular ruta con algoritmo Nearest Neighbor
              console.log(`📏 Optimizando ruta para ${paradas.length} clientes usando algoritmo Nearest Neighbor...`);
              const parasdasOrdenadas = await optimizarRutaNearestNeighbor(puntoInicio, paradas);
              console.log(`📍 Ruta optimizada. Orden nuevo: ${parasdasOrdenadas.map(p => p.cliente.razon_social).join(' → ')}`);

              // Generar nueva URL
              const paradas_url = parasdasOrdenadas.map(d => ({
                latitud: d.cliente.latitud,
                longitud: d.cliente.longitud,
                nombre: d.cliente.razon_social
              }));
              const url_maps = generarURLGoogleMapsMobile(puntoInicio, paradas_url);
              console.log(`🗺️ URL nueva: ${url_maps.substring(0, 100)}...`);

              // Obtener dirección actual del punto de inicio desde OSM
              console.log(`📍 Obteniendo dirección actual del punto de inicio desde OpenStreetMap...`);
              const direccionInicio = await obtenerDireccionDesdeCoord(puntoInicio.latitud, puntoInicio.longitud);
              console.log(`📍 Dirección actual obtenida: ${direccionInicio || 'No disponible'}`);

              // Actualizar paradas con nuevas distancias y orden en transacción
              db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                  res.status(500).json({ error: err.message });
                  return;
                }

                // Borrar paradas antiguas
                db.run(`DELETE FROM paradas_ruta WHERE ruta_id = ?`, [rutaId], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    res.status(500).json({ error: err.message });
                    return;
                  }

                  let completadas = 0;
                  let responseEnviada = false;

                  // Insertar paradas nuevas con nuevo orden
                  parasdasOrdenadas.forEach((parada, index) => {
                    const distancia_km = parada.distancia_km || 0;
                    const duracion_min = parada.duracion_min || 0;
                    // Usar cliente_rut (del DB) en lugar de rut
                    const clienteRut = parada.cliente.cliente_rut || parada.cliente.rut;

                    db.run(
                      `INSERT INTO paradas_ruta (ruta_id, cliente_rut, orden, distancia_km, duracion_min)
                       VALUES (?, ?, ?, ?, ?)`,
                      [rutaId, clienteRut, index + 1, distancia_km, duracion_min],
                      (err) => {
                        completadas++;
                        if (err) {
                          if (!responseEnviada) {
                            responseEnviada = true;
                            db.run('ROLLBACK');
                            res.status(500).json({ error: err.message });
                          }
                          return;
                        }

                        // Si todas las paradas se insertaron, actualizar URL y coordenadas iniciales
                        if (completadas === parasdasOrdenadas.length && !responseEnviada) {
                          // Actualizar la ruta con URL recalculada, coordenadas iniciales actuales y dirección
                          db.run(
                            `UPDATE rutas SET url_maps = ?, punto_inicio_latitud = ?, punto_inicio_longitud = ?, punto_inicio_nombre = ?, punto_inicio_direccion = ? WHERE id = ?`,
                            [url_maps, puntoInicio.latitud, puntoInicio.longitud, puntoInicio.nombre, direccionInicio || '', rutaId],
                            (err) => {
                              if (err) {
                                if (!responseEnviada) {
                                  responseEnviada = true;
                                  db.run('ROLLBACK');
                                  res.status(500).json({ error: err.message });
                                }
                                return;
                              }

                              db.run('COMMIT', (err) => {
                                if (err) {
                                  if (!responseEnviada) {
                                    responseEnviada = true;
                                    res.status(500).json({ error: err.message });
                                  }
                                  return;
                                }

                                if (!responseEnviada) {
                                  responseEnviada = true;
                                  console.log(`✅ Ruta ${rutaId} recalculada exitosamente`);
                                  res.json({
                                    mensaje: 'Ruta recalculada exitosamente',
                                    ruta_id: rutaId,
                                    paradas_count: parasdasOrdenadas.length,
                                    coordenadas_iniciales_cambiaron: cambiosDetectados.coordenadasIniciales,
                                    detalles_cambios: cambiosDetectados.detallesCambios,
                                    paradas: parasdasOrdenadas.map((d, i) => ({
                                      orden: i + 1,
                                      cliente_rut: d.cliente.cliente_rut || d.cliente.rut,
                                      razon_social: d.cliente.razon_social,
                                      direccion: d.cliente.direccion,
                                      distancia_km: d.distancia_km.toFixed(2),
                                      duracion_min: (d.duracion_min || 0).toFixed(0)
                                    })),
                                    url_maps
                                  });
                                }
                              });
                            }
                          );
                        }
                      }
                    );
                  });
                });
              });
            } catch (error) {
              res.status(500).json({ error: 'Error al recalcular: ' + error.message });
            }
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
