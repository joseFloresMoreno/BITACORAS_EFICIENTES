# Bitácoras de Viajes Eficientes

Sistema web para crear y gestionar rutas de distribución eficientes usando cálculo de distancias con Google Maps.

## 🎯 Características

- **Administración de Usuarios**: Gestión completa de usuarios con roles
- **Administración de Clientes**: CRUD de clientes con coordenadas geográficas
- **Creación de Rutas**: Crear rutas con punto de inicio configurables
- **Optimización de Rutas**: Calcula distancias y ordena clientes de forma automática
- **Google Maps Integration**: Genera URLs para visualizar rutas en Google Maps desde smartphones
- **Bootstrap UI**: Interfaz responsive con Bootstrap 5

## 📋 Requisitos

- Node.js v14 o superior
- npm o yarn
- Clave de API de Google Maps con acceso a:
  - Distance Matrix API
  - Maps JavaScript API

## 🚀 Instalación

### 1. Configurar el Backend

```bash
cd backend
npm install
```

### 2. Configurar Google Maps API Key

Edita el archivo `.env` en la carpeta `backend`:

```
PORT=5000
GOOGLE_MAPS_API_KEY=TU_CLAVE_API_AQUI
NODE_ENV=development
```

### 3. Iniciar el Backend

```bash
npm start
```

El servidor se ejecutará en `http://localhost:5000`

### 4. Servir los Frontends

Abre el archivo `frontend/menu/index.html` en tu navegador web o usa un servidor HTTP:

```bash
# Con Python 3
python -m http.server 8000

# Con Python 2
python -m SimpleHTTPServer 8000
```

O instala un servidor HTTP simple:

```bash
npm install -g http-server
http-server frontend -p 8000
```

Luego accede a `http://localhost:8000/menu/index.html`

## 📁 Estructura del Proyecto

```
BITACORAS_EFICIENTES/
├── backend/
│   ├── routes/           # Rutas API
│   ├── db/              # Configuración de base de datos
│   ├── utils/           # Utilidades (Google Maps)
│   ├── package.json     # Dependencias Node.js
│   ├── server.js        # Servidor principal
│   └── .env             # Variables de entorno
└── frontend/
    ├── menu/            # Menú principal
    ├── usuarios/        # Administración de usuarios
    ├── clientes/        # Administración de clientes
    └── rutas/           # Creación y gestión de rutas
```

## 🔌 API Endpoints

### Usuarios
- `GET /api/usuarios` - Obtener todos los usuarios
- `GET /api/usuarios/:id` - Obtener usuario por ID
- `POST /api/usuarios` - Crear nuevo usuario
- `PUT /api/usuarios/:id` - Actualizar usuario
- `DELETE /api/usuarios/:id` - Eliminar usuario

### Clientes
- `GET /api/clientes` - Obtener todos los clientes
- `GET /api/clientes/:id` - Obtener cliente por ID
- `POST /api/clientes` - Crear nuevo cliente
- `PUT /api/clientes/:id` - Actualizar cliente
- `DELETE /api/clientes/:id` - Eliminar cliente

### Rutas
- `GET /api/rutas` - Obtener todas las rutas
- `GET /api/rutas/:id` - Obtener ruta con sus paradas
- `POST /api/rutas` - Crear nueva ruta
- `POST /api/rutas/:id/calcular-ruta` - Calcular y optimizar ruta
- `DELETE /api/rutas/:id` - Eliminar ruta

## 💡 Uso

### 1. Crear Usuarios

Accede a `Administración de Usuarios` y crea los usuarios del sistema.

### 2. Crear Clientes

En `Administración de Clientes`:
- Ingresa nombre y dirección del cliente
- Opcionalmente agrega coordenadas (latitud/longitud)

**Nota**: Si no agregas coordenadas manualmente, necesitarás hacer geocoding (en futuras versiones)

### 3. Crear Ruta

En `Crear y Gestionar Rutas`:
1. Crea una nueva ruta con punto de inicio (ej: Almacén)
2. Ingresa coordenadas del punto de inicio
3. Selecciona la ruta
4. Selecciona los clientes que deseas incluir
5. Haz clic en "Calcular y Optimizar Ruta"
6. Abre en Google Maps con el botón "Abrir en Google Maps"

## 🗺️ Google Maps en Detalle

El sistema genera URLs de Google Maps en el siguiente formato:

```
https://www.google.com/maps/dir/LAT_INICIO,LONG_INICIO/LAT_CLIENTE1,LONG_CLIENTE1/LAT_CLIENTE2,LONG_CLIENTE2/...
```

Esto permite:
- Ver la ruta optimizada
- Obtener indicaciones paso a paso
- Compatible con Google Maps en teléfonos Android e iOS

## 🔐 Notas Importantes

- **Base de Datos**: SQLite (se crea automáticamente en `backend/db/bitacoras.db`)
- **Contraseñas**: En esta versión se almacenan en texto plano (implementar hash en producción)
- **CORS**: Habilitado para desarrollo local (cambiar en producción)
- **API Key**: Mantén tu clave segura, no la compartas en repositorios públicos

## 🚧 Próximos Pasos (Mejoras Futuras)

- [ ] Autenticación y JWT
- [ ] Geocoding automático de direcciones
- [ ] Mapa interactivo en tiempo real
- [ ] Exportar reportes de rutas
- [ ] Integración con múltiples proveedores de mapas
- [ ] Cálculo de costos de combustible
- [ ] Historial de rutas completadas

## 📝 Licencia

MIT

## 👨‍💻 Autor

Desarrollado como solución para optimización de rutas de distribución.
