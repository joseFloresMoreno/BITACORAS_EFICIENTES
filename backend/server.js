const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Determinar ruta del frontend
const frontendPath = process.env.FRONTEND_PATH || path.join(__dirname, '../frontend');
console.log(`📁 Sirviendo frontend desde: ${frontendPath}`);

// Servir archivos estáticos del frontend
app.use(express.static(frontendPath));

// Importar rutas
const usuariosRoutes = require('./routes/usuarios');
const clientesRoutes = require('./routes/clientes');
const movilesRoutes = require('./routes/moviles');
const rutasRoutes = require('./routes/rutas');
const devRoutes = require('./routes/dev');

// Usar rutas
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/moviles', movilesRoutes);
app.use('/api/rutas', rutasRoutes);

// 🔧 Rutas de desarrollo (remover en producción)
if (process.env.NODE_ENV !== 'production') {
  console.log('🔧 Rutas de desarrollo habilitadas');
  app.use('/api/dev', devRoutes);
}

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend funcionando correctamente' });
});

// Ruta raíz - Servir menú principal
app.get('/', (req, res) => {
  const menuPath = path.join(frontendPath, 'menu/index.html');
  console.log(`✅ Sirviendo raíz desde: ${menuPath}`);
  res.sendFile(menuPath, (err) => {
    if (err) {
      console.error('❌ Error al servir menu/index.html:', err);
      res.status(500).json({ error: 'No se pudo cargar la página principal' });
    }
  });
});

// Fallback para rutas no encontradas (SPA routing)
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});
