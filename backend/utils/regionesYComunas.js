// Datos de Regiones y Comunas de Chile
const regionesYComunas = [
  {
    id: 1,
    nombre: "Región de Arica y Parinacota",
    comunas: ["Arica", "Camarones", "Putre", "General Lagos"]
  },
  {
    id: 2,
    nombre: "Región de Tarapacá",
    comunas: ["Iquique", "Alto Hospicio", "Camiña", "Colchane", "Huara", "Pica", "Pozo Almonte"]
  },
  {
    id: 3,
    nombre: "Región de Antofagasta",
    comunas: ["Antofagasta", "Mejillones", "Sierra Gorda", "Taltal", "Calama", "Ollagüe", "San Pedro de Atacama", "Tocopilla"]
  },
  {
    id: 4,
    nombre: "Región de Atacama",
    comunas: ["Copiapó", "Caldera", "Tierra Amarilla", "Chañaral", "Diego de Almagro", "Vallenar", "Alto del Carmen", "Freirina", "Huasco"]
  },
  {
    id: 5,
    nombre: "Región de Coquimbo",
    comunas: ["La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paiguano", "Vicuña", "Illapel", "Canela", "Los Vilos", "Salamanca", "Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado"]
  },
  {
    id: 6,
    nombre: "Región de Valparaíso",
    comunas: ["Valparaíso", "Casablanca", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Viña del Mar", "Isla de Pascua", "Los Andes", "Calle Larga", "Rinconada", "San Felipe", "Santa María", "Catemu", "Llaillay", "Panquehue", "Putaendo", "Quillota", "Calera", "Hijuelas", "La Calera", "Nogales", "Petorca", "Cabildo", "Papudo", "Zapallar"]
  },
  {
    id: 7,
    nombre: "Región del Libertador General Bernardo O'Higgins",
    comunas: ["Rancagua", "Acopiador", "Chépica", "Chimbarongo", "Lolol", "Marchihue", "Mostazal", "Olivar", "Peumo", "Pichidegua", "San Fernando", "Santa Cruz", "Chanco", "Litueche", "Paredones", "Coinco", "Coltauco", "Doñihue", "Graneros", "Las Cabras", "Machalí", "Malloa", "Mataquito", "Navidad", "Pichilemu", "Pumanque", "Requínoa", "Romeral", "San Clemente", "San Vicente", "Tagua Tagua"]
  },
  {
    id: 8,
    nombre: "Región del Maule",
    comunas: ["Talca", "Constitución", "Curepto", "Empedrado", "Maule", "Pelarco", "Pencahue", "Río Claro", "San Clemente", "San Javier", "Villa Alegre", "Yerbas Buenas", "Cauquenes", "Chanco", "Pelluhue", "Curicó", "Buenavista", "Hualañé", "Licantén", "Molina", "Rauco", "Romeral", "Sagrada Familia", "Teno", "Linares", "Colbún", "Longaví", "Parral", "Retiro", "San Javier", "Tusca", "Arauco", "Cabrero", "Laja", "Mulchén", "Nacimiento", "Negrete", "Quilaco", "Quilecura", "Santa Bárbara", "Tucapel"]
  },
  {
    id: 9,
    nombre: "Región de La Araucanía",
    comunas: ["Temuco", "Carahue", "Cunco", "Curarrehue", "Freire", "Gorbea", "Lautaro", "Loncoche", "Padre las Casas", "Perkinenco", "Pitrufquén", "Pucón", "Purén", "Saavedra", "Teodoro Schmidt", "Tolten", "Vilcún", "Villarrica", "Angol", "Collipulli", "Cumalí", "Ercilla", "Lonquimay", "Los Sauces", "Lumaco", "Nacimiento", "Renaico", "Traiguén"]
  },
  {
    id: 10,
    nombre: "Región de Los Lagos",
    comunas: ["Puerto Montt", "Calbuco", "Cochamó", "Dalcahue", "Fresia", "Frutillar", "Llanquihue", "Los Muermos", "Maullín", "Ochote", "Purranque", "Puyehue", "Quellon", "Quemchi", "Quinchao", "Rio Negro", "San Juan de la Costa", "San Pablo", "Puerto Varas", "Ancud", "Chonchi", "Curaco de Vélez"]
  },
  {
    id: 11,
    nombre: "Región de Aysén del General Carlos Ibáñez del Campo",
    comunas: ["Coyhaique", "Aysén", "Cisnes", "Guaitecas", "Lago Verde", "Puyuhuapi", "Cerro Castillo", "Chile Chico", "Guadal", "Hielo Azul", "La Junta", "Mañihuales", "Marble", "O'Higgins", "Perito Moreno", "Puerto Guadal", "Puerto Río Tranquilo", "Tortel", "Villa O'Higgins", "Cobquecura", "Coelemu", "Ninhue", "Quirihue", "Ránquil", "Treguaco"]
  },
  {
    id: 12,
    nombre: "Región de Magallanes y de la Antártica Chilena",
    comunas: ["Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio", "Puerto Natales", "Bulnes", "Chubut", "Los Antiguos", "Primavera", "Puerto Esperanza", "Timaukel"]
  },
  {
    id: 13,
    nombre: "Región del Ñuble",
    comunas: ["Chillán", "Bulnes", "Chillán Viejo", "Coihueco", "Coelemu", "Cobquecura", "Ñiquen", "Pemuco", "Pinto", "Quillón", "Ranquil", "San Carlos", "San Fabián", "San Ignacio", "San Javier", "San Nicolás", "Treguaco", "Yungay"]
  },
  {
    id: 14,
    nombre: "Región Metropolitana de Santiago",
    comunas: ["Santiago", "Antuco", "Buin", "Calera de Tango", "Paine", "San Bernardo", "Alhué", "Curacaví", "El Monte", "Isla de Maipo", "María Pinto", "Melipilla", "San Pedro", "Talagante", "Colina", "Lampa", "Tiltil", "Conchali", "El Bosque", "Estación Central", "Huechuraba", "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Puente Alto", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Vitacura", "Pirque", "San José de Maipo", "Buin", "Paine"]
  },
  {
    id: 15,
    nombre: "Región de Valparaíso",
    comunas: ["Valparaíso", "Viña del Mar", "Coquimbo", "La Serena"]
  },
  {
    id: 16,
    nombre: "Región del Biobío",
    comunas: ["Concepción", "Coronel", "Chiguayante", "Florida", "Hualqui", "Lota", "Penco", "San Pedro de la Paz", "Santa Juana", "Talcahuano", "Tomé", "Arauco", "Cabrero", "Curanilahue", "Lebu", "Los Alamos", "Lota", "Nacimiento", "Negrete", "Quilaco", "Quilecura", "Santa Bárbara", "Tucapel", "Yumbel"]
  }
];

module.exports = regionesYComunas;
