/** Carga inicial del árbol de categorías (niveles 1 y 2). El nivel 3 ("tipo") se crea desde el panel. */
export type DocKey = "REGISTRO_SANITARIO" | "NOTIFICACION_SANITARIA" | "CERTIFICADO_INEN" | "HOMOLOGACION_ARCOTEL" | "OTRO";

export type CatSeed = {
  name: string;
  regulated?: DocKey[]; // presente = [REGULADO]; lista = documentos aceptados
  guide?: "mujer" | "hombre" | "ninos" | "calzado";
  children: string[];
};

export const CATEGORIES: CatSeed[] = [
  { name: "Moda mujer", guide: "mujer", children: ["Vestidos", "Blusas", "Pantalones", "Jeans", "Faldas", "Ropa deportiva", "Ropa interior y pijamas", "Trajes de baño", "Tallas grandes", "Maternidad"] },
  { name: "Moda hombre", guide: "hombre", children: ["Camisetas", "Camisas", "Pantalones", "Jeans", "Ropa deportiva", "Ropa interior", "Chaquetas", "Ropa de trabajo"] },
  { name: "Niños y bebés", guide: "ninos", children: ["Ropa de niña", "Ropa de niño", "Ropa de bebé", "Calzado infantil", "Artículos para bebé (alimentación, paseo, baño)", "Maternidad"] },
  { name: "Calzado", guide: "calzado", children: ["Mujer", "Hombre", "Deportivo", "Casual", "Formal", "Sandalias", "Botas", "Pantuflas"] },
  { name: "Bolsos y equipaje", children: ["Carteras", "Mochilas", "Billeteras", "Maletas", "Bolsos de viaje"] },
  { name: "Joyería y accesorios", children: ["Collares", "Aretes", "Pulseras", "Anillos", "Relojes", "Gafas", "Cinturones", "Gorras", "Bufandas", "Accesorios para el cabello"] },
  { name: "Belleza y cuidado personal", regulated: ["NOTIFICACION_SANITARIA"], children: ["Maquillaje", "Cuidado de la piel", "Cuidado del cabello", "Uñas", "Perfumes y fragancias", "Herramientas de belleza", "Afeitado y depilación", "Pelucas y extensiones"] },
  { name: "Salud y bienestar", regulated: ["REGISTRO_SANITARIO", "NOTIFICACION_SANITARIA"], children: ["Masajeadores", "Soportes ortopédicos", "Cuidado bucal", "Artículos de higiene"] },
  { name: "Hogar y cocina", children: ["Utensilios", "Ollas y sartenes", "Organización y almacenamiento", "Ropa de cama", "Baño", "Decoración", "Iluminación", "Cortinas", "Alfombras", "Limpieza"] },
  { name: "Electrodomésticos", regulated: ["CERTIFICADO_INEN"], children: ["Cocina (licuadoras, freidoras, cafeteras)", "Cuidado personal (secadoras, planchas de cabello)", "Limpieza (aspiradoras)", "Climatización (ventiladores)"] },
  { name: "Muebles", children: ["Sala", "Dormitorio", "Oficina", "Exterior", "Estanterías"] },
  { name: "Electrónica", regulated: ["CERTIFICADO_INEN", "HOMOLOGACION_ARCOTEL"], children: ["Audífonos", "Parlantes", "Relojes inteligentes", "Cámaras", "Accesorios de computación", "Videojuegos y accesorios", "Proyectores"] },
  { name: "Celulares y accesorios", children: ["Estuches", "Protectores", "Cargadores", "Cables", "Soportes", "Baterías externas"] },
  { name: "Juguetes y juegos", regulated: ["CERTIFICADO_INEN"], children: ["Didácticos", "Muñecas", "Vehículos", "Bloques de construcción", "Juegos de mesa", "Exterior", "Peluches", "Control remoto"] },
  { name: "Deportes y aire libre", children: ["Gimnasio y fitness", "Ciclismo", "Camping", "Pesca", "Natación", "Fútbol", "Yoga"] },
  { name: "Herramientas y mejoras del hogar", children: ["Herramientas manuales", "Herramientas eléctricas", "Ferretería", "Seguridad industrial", "Plomería", "Electricidad", "Pintura"] },
  { name: "Automotriz y motos", children: ["Accesorios interiores", "Accesorios exteriores", "Limpieza", "Herramientas", "Iluminación", "Accesorios para moto"] },
  { name: "Jardín y exterior", children: ["Jardinería", "Riego", "Macetas", "Iluminación solar", "Parrillas"] },
  { name: "Mascotas", children: ["Perros", "Gatos", "Aves", "Peces", "Camas", "Juguetes", "Paseo", "Higiene"] },
  { name: "Oficina y papelería", children: ["Escritura", "Cuadernos", "Organización", "Útiles escolares", "Impresión"] },
  { name: "Arte, manualidades y costura", children: ["Pintura", "Bisutería", "Telas", "Hilos", "Scrapbooking"] },
  { name: "Fiestas y eventos", children: ["Decoración", "Globos", "Disfraces", "Regalos", "Artículos de temporada (Navidad, Día de la Madre, etc.)"] },
  { name: "Industria y negocios", children: ["Empaques", "Etiquetado", "Equipamiento para locales comerciales"] },
  { name: "Libros y música", children: ["Instrumentos musicales y accesorios"] },
];

export const PROVINCES: { code: string; name: string; region: "Costa" | "Sierra" | "Oriente" | "Insular" }[] = [
  { code: "01", name: "Azuay", region: "Sierra" },
  { code: "02", name: "Bolívar", region: "Sierra" },
  { code: "03", name: "Cañar", region: "Sierra" },
  { code: "04", name: "Carchi", region: "Sierra" },
  { code: "05", name: "Cotopaxi", region: "Sierra" },
  { code: "06", name: "Chimborazo", region: "Sierra" },
  { code: "07", name: "El Oro", region: "Costa" },
  { code: "08", name: "Esmeraldas", region: "Costa" },
  { code: "09", name: "Guayas", region: "Costa" },
  { code: "10", name: "Imbabura", region: "Sierra" },
  { code: "11", name: "Loja", region: "Sierra" },
  { code: "12", name: "Los Ríos", region: "Costa" },
  { code: "13", name: "Manabí", region: "Costa" },
  { code: "14", name: "Morona Santiago", region: "Oriente" },
  { code: "15", name: "Napo", region: "Oriente" },
  { code: "16", name: "Pastaza", region: "Oriente" },
  { code: "17", name: "Pichincha", region: "Sierra" },
  { code: "18", name: "Tungurahua", region: "Sierra" },
  { code: "19", name: "Zamora Chinchipe", region: "Oriente" },
  { code: "20", name: "Galápagos", region: "Insular" },
  { code: "21", name: "Sucumbíos", region: "Oriente" },
  { code: "22", name: "Orellana", region: "Oriente" },
  { code: "23", name: "Santo Domingo de los Tsáchilas", region: "Sierra" },
  { code: "24", name: "Santa Elena", region: "Costa" },
];

export const SIZE_GUIDES = {
  mujer: { name: "Guía de tallas: mujer", columns: ["Busto", "Cintura", "Cadera"], rows: [["XS", "80", "62", "88"], ["S", "84", "66", "92"], ["M", "88", "70", "96"], ["L", "94", "76", "102"], ["XL", "100", "82", "108"]] },
  hombre: { name: "Guía de tallas: hombre", columns: ["Pecho", "Cintura", "Cadera"], rows: [["S", "92", "78", "94"], ["M", "98", "84", "100"], ["L", "104", "90", "106"], ["XL", "110", "96", "112"], ["XXL", "116", "102", "118"]] },
  ninos: { name: "Guía de tallas: niños", columns: ["Edad aprox.", "Altura"], rows: [["2", "2 años", "92"], ["4", "4 años", "104"], ["6", "6 años", "116"], ["8", "8 años", "128"], ["10", "10 años", "140"], ["12", "12 años", "152"]] },
  calzado: { name: "Guía de tallas: calzado", columns: ["Largo del pie"], rows: [["36", "23,0"], ["37", "23,5"], ["38", "24,0"], ["39", "24,5"], ["40", "25,0"], ["41", "25,5"], ["42", "26,5"]] },
} as const;
