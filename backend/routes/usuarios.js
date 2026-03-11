const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { validarRUT, formatearRUT, normalizarRUT } = require('../utils/rut');

// GET - Obtener todos los usuarios
router.get('/', (req, res) => {
  db.all('SELECT rut, nombre, email, rol, creado_en, actualizado_en FROM usuarios ORDER BY nombre', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// GET - Obtener usuario por RUT
router.get('/:rut', (req, res) => {
  const rut = normalizarRUT(req.params.rut);
  db.get('SELECT rut, nombre, email, rol, creado_en, actualizado_en FROM usuarios WHERE rut = ?', [rut], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ mensaje: 'Usuario no encontrado' });
      return;
    }
    res.json(row);
  });
});

// POST - Crear nuevo usuario
router.post('/', (req, res) => {
  const { rut, nombre, email, contraseña, rol } = req.body;
  
  if (!rut || !nombre || !email || !contraseña) {
    res.status(400).json({ error: 'Faltan campos requeridos' });
    return;
  }

  if (!validarRUT(rut)) {
    res.status(400).json({ error: 'RUT inválido' });
    return;
  }

  // Formatear RUT al guardar
  const rutFormateado = formatearRUT(rut);

  db.run(
    'INSERT INTO usuarios (rut, nombre, email, contraseña, rol) VALUES (?, ?, ?, ?, ?)',
    [rutFormateado, nombre, email, contraseña, rol || 'usuario'],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed: usuarios.email')) {
          res.status(400).json({ error: 'El email ya está registrado' });
        } else if (err.message.includes('UNIQUE constraint failed: usuarios.rut')) {
          res.status(400).json({ error: 'El RUT ya está registrado' });
        } else {
          res.status(500).json({ error: err.message });
        }
        return;
      }
      res.status(201).json({ 
        rut: rutFormateado, 
        nombre, 
        email, 
        rol: rol || 'usuario',
        mensaje: 'Usuario creado exitosamente' 
      });
    }
  );
});

// PUT - Actualizar usuario
router.put('/:rut', (req, res) => {
  const rutOriginal = normalizarRUT(req.params.rut);
  const { nombre, email, rol } = req.body;
  
  if (!nombre || !email) {
    res.status(400).json({ error: 'Faltan campos requeridos' });
    return;
  }

  db.run(
    'UPDATE usuarios SET nombre = ?, email = ?, rol = ?, actualizado_en = CURRENT_TIMESTAMP WHERE rut = ?',
    [nombre, email, rol, rutOriginal],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed: usuarios.email')) {
          res.status(400).json({ error: 'El email ya está registrado' });
        } else {
          res.status(500).json({ error: err.message });
        }
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ mensaje: 'Usuario no encontrado' });
        return;
      }
      res.json({ 
        rut: rutOriginal,
        mensaje: 'Usuario actualizado exitosamente' 
      });
    }
  );
});

// DELETE - Eliminar usuario
router.delete('/:rut', (req, res) => {
  const rut = normalizarRUT(req.params.rut);
  db.run('DELETE FROM usuarios WHERE rut = ?', [rut], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ mensaje: 'Usuario no encontrado' });
      return;
    }
    res.json({ mensaje: 'Usuario eliminado exitosamente' });
  });
});

module.exports = router;
