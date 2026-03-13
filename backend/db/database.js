const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bitacoras.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al abrir la base de datos:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite');
    initializeDatabase();
  }
});

function initializeDatabase() {
  // Tabla de usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      rut TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      contraseña TEXT NOT NULL,
      rol TEXT DEFAULT 'usuario',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de clientes
  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      rut TEXT PRIMARY KEY,
      razon_social TEXT NOT NULL,
      direccion TEXT NOT NULL,
      region TEXT NOT NULL,
      comuna TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      latitud REAL,
      longitud REAL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de móviles/conductores
  db.run(`
    CREATE TABLE IF NOT EXISTS moviles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      nombre_movil TEXT,
      conductor TEXT NOT NULL,
      telefono TEXT,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de rutas (rediseñada)
  db.run(`
    CREATE TABLE IF NOT EXISTS rutas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      movil_id INTEGER,
      descripcion TEXT,
      url_maps TEXT,
      punto_inicio_latitud REAL,
      punto_inicio_longitud REAL,
      punto_inicio_nombre TEXT,
      punto_inicio_direccion TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(movil_id) REFERENCES moviles(id)
    )
  `);

  // Tabla de paradas en rutas
  db.run(`
    CREATE TABLE IF NOT EXISTS paradas_ruta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ruta_id INTEGER NOT NULL,
      cliente_rut TEXT NOT NULL,
      orden INTEGER NOT NULL,
      distancia_km REAL,
      duracion_min REAL,
      FOREIGN KEY(ruta_id) REFERENCES rutas(id),
      FOREIGN KEY(cliente_rut) REFERENCES clientes(rut)
    )
  `);
}

module.exports = db;
