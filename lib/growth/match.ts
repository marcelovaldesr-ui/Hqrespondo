/**
 * GROWTH · Mapeo de rubro libre → slug de RUBROS.
 *
 * `prospects.rubro` es texto libre (lo que se escribió al buscar en Places,
 * ej. "clínica dental", "taller mecánico"). Esta función lo cruza con los
 * rubros de Growth Studio por palabras clave, para recomendar contenido en la
 * ficha del prospecto. Si no hay match → null (no se muestra nada; degrada
 * silencioso). El orden importa: lo más específico va primero
 * (veterinaria antes que clínica; constructora antes que ferretería).
 */

const KEYWORDS: [slug: string, kws: string[]][] = [
  ["veterinarias", ["veterinar", "mascota"]],
  ["clinicas", ["clinic", "clínic", "dental", "dentista", "medic", "médic", "kinesi", "psicol", "nutri", "centro de salud", "oftalmolog", "fonoaudiolog", "consulta", "optic", "óptic"]],
  ["estetica", ["estetic", "estétic", "belleza", "peluquer", "barber", "uñas", "unas", "depilaci", "spa", "manicure", "cosmetolog", "podolog"]],
  ["talleres", ["taller", "mecánic", "mecanic", "automotriz", "automotora", "desabolladura", "vulcaniz", "lubricentro"]],
  ["servicios-tecnicos", ["servicio técnico", "servicio tecnico", "reparacion", "reparación", "computador", "celular", "notebook", "línea blanca", "linea blanca", "refrigeraci"]],
  ["constructoras", ["constructora", "construcción", "construccion", "edificaci", "obra gruesa"]],
  ["ferreterias", ["ferret", "materiales", "fierro", "eléctric", "electric", "sanitari", "aceros"]],
  ["inmobiliarias", ["corredor", "inmobil", "propiedad", "arriendo", "corretaje", "bienes raíces", "bienes raices"]],
  ["distribuidoras", ["distribuidora", "distribucion", "distribución", "mayorista", "importadora", "proveedor"]],
  ["educacion-cursos", ["curso", "academia", "instituto", "preuniversitario", "capacitaci", "clases particulares", "educa", "idiomas"]],
  ["tiendas-catalogo", ["tienda", "boutique", "ropa", "calzado", "catálogo", "catalogo", "zapater", "accesorios", "emprendimiento"]],
  // Gimnasios, canchas y centros deportivos: es la vertical con MÁS clientes
  // reales del equipo (+20 según el doc de secuencias) y no estaba en esta
  // tabla, así que 165 de 596 prospectos quedaban sin ninguna clasificación
  // — y por lo tanto sin el punto de rubro en el score.
  ["agenda-reservas", ["reserva", "hotel", "cabaña", "cabana", "restauran", "masaje", "estudio de", "hora médica", "gimnasio", "crossfit", "fitness", "pilates", "yoga", "padel", "pádel", "cancha", "centro deportivo", "futbolito", "complejo deportivo", "club deportivo"]],
];

/** Devuelve el slug de RUBROS que mejor calza con un rubro de texto libre. */
export function matchRubroSlug(freeText: string | null | undefined): string | null {
  if (!freeText) return null;
  const t = freeText.toLowerCase();
  // Gana el que MÁS palabras clave calza, no el primero de la lista. Con
  // "primero gana", un "Centro de estética y kinesiología" caía en `clinicas`
  // (por «kinesi», que se evalúa antes) en vez de en `estetica`: de 18
  // prospectos de estética cargados, 16 quedaban mal clasificados y recibían
  // el dolor, el mensaje y el contenido de una clínica médica.
  let mejor: { slug: string; n: number } | null = null;
  for (const [slug, kws] of KEYWORDS) {
    const n = kws.filter((k) => t.includes(k)).length;
    if (n > 0 && (!mejor || n > mejor.n)) mejor = { slug, n };
  }
  return mejor ? mejor.slug : null;
}

const DEMO = process.env.NEXT_PUBLIC_DEMO_LINK || "[link demo]";

/** Reemplaza el marcador [link] por el link de demo configurado. */
export function conDemo(texto: string): string {
  return texto.replace(/\[link\]/g, DEMO);
}
