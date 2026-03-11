// Función para validar y formatear RUT chileno
function validarRUT(rut) {
  if (!rut) return false;
  
  // Limpiar espacios y puntos
  rut = rut.toString().toUpperCase().replace(/\s/g, '').replace(/\./g, '').replace(/-/g, '');
  
  // Verificar formato básico: 7-8 dígitos + 1 dígito o K
  if (!/^\d{7,8}[0-9K]$/.test(rut)) {
    return false;
  }
  
  // Separar número y dígito verificador
  const rutNumeros = rut.slice(0, -1);
  const digitoVerificador = rut.slice(-1);
  
  // Calcular dígito verificador
  let suma = 0;
  let multiplicador = 2;
  
  for (let i = rutNumeros.length - 1; i >= 0; i--) {
    suma += parseInt(rutNumeros[i]) * multiplicador;
    multiplicador++;
    if (multiplicador > 7) multiplicador = 2;
  }
  
  const residuo = 11 - (suma % 11);
  let digitoCalculado;
  
  if (residuo === 11) {
    digitoCalculado = '0';
  } else if (residuo === 10) {
    digitoCalculado = 'K';
  } else {
    digitoCalculado = residuo.toString();
  }
  
  return digitoVerificador === digitoCalculado;
}

// Función para formatear RUT chileno
function formatearRUT(rut) {
  if (!rut) return '';
  
  rut = rut.toString().toUpperCase().replace(/\s/g, '').replace(/\./g, '').replace(/-/g, '');
  
  if (rut.length < 2) return rut;
  
  const rutNumeros = rut.slice(0, -1);
  const digitoVerificador = rut.slice(-1);
  
  return `${rutNumeros}-${digitoVerificador}`;
}

// Función para normalizar RUT (sin puntos ni espacios ni guion, en mayúsculas)
function normalizarRUT(rut) {
  if (!rut) return '';
  return rut.toString().toUpperCase().replace(/\s/g, '').replace(/\./g, '').replace(/-/g, '');
}

module.exports = {
  validarRUT,
  formatearRUT,
  normalizarRUT
};
