const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET - Obtener todos los móviles
router.get('/', (req, res) => {
  db.all('SELECT * FROM moviles WHERE activo = 1 ORDER BY numero', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// GET - Obtener móvil por ID
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM moviles WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ mensaje: 'Móvil no encontrado' });
      return;
    }
    res.json(row);
  });
});

// POST - Crear nuevo móvil
router.post('/', (req, res) => {
  const { numero, nombre_movil, conductor, telefono } = req.body;
  
  if (!numero || !nombre_movil) {
    res.status(400).json({ error: 'Número y nombre de móvil son requeridos' });
    return;
  }

  db.run(
    `INSERT INTO moviles (numero, nombre_movil, conductor, telefono) VALUES (?, ?, ?, ?)`,
    [numero, nombre_movil, conductor || '', telefono || ''],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ 
        id: this.lastID, 
        numero,
        nombre_movil,
        conductor,
        mensaje: 'Móvil creado exitosamente' 
      });
    }
  );
});

// PUT - Actualizar móvil
router.put('/:id', (req, res) => {
  const { nombre_movil, conductor, telefono, activo } = req.body;
  
  db.run(
    `UPDATE moviles SET nombre_movil = ?, conductor = ?, telefono = ?, activo = ?, actualizado_en = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [nombre_movil || '', conductor || '', telefono || '', activo !== undefined ? activo : 1, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ mensaje: 'Móvil no encontrado' });
        return;
      }
      res.json({ mensaje: 'Móvil actualizado exitosamente' });
    }
  );
});

// DELETE - Desactivar móvil
router.delete('/:id', (req, res) => {
  db.run(
    `UPDATE moviles SET activo = 0, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`,
    [req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ mensaje: 'Móvil no encontrado' });
        return;
      }
      res.json({ mensaje: 'Móvil desactivado exitosamente' });
    }
  );
});

module.exports = router;
