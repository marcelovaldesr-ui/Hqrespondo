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
  ["clinicas", ["clinic", "clínic", "dental", "dentista", "medic", "médic", "kinesi", "psicol", "nutri", "centro de salud", "oftalmolog", "fonoaudiolog", "consulta"]],
  ["estetica", ["estetic", "estétic", "belleza", "peluquer", "barber", "uñas", "unas", "depilaci", "spa", "manicure", "cosmetolog", "podolog"]],
  ["talleres", ["taller", "mecánic", "mecanic", "automotriz", "desabolladura", "vulcaniz", "lubricentro"]],
  ["servicios-tecnicos", ["servicio técnico", "servicio tecnico", "reparacion", "reparación", "computador", "celular", "notebook", "línea blanca", "linea blanca", "refrigeraci"]],
  ["constructoras", ["constructora", "construcción", "construccion", "edificaci", "obra gruesa"]],
  ["ferreterias", ["ferret", "materiales", "fierro", "eléctric", "electric", "sanitari", "aceros"]],
  ["inmobiliarias", ["corredor", "inmobil", "propiedad", "arriendo", "corretaje", "bienes raíces", "bienes raices"]],
  ["distribuidoras", ["distribuidora", "distribucion", "distribución", "mayorista", "importadora", "proveedor"]],
  ["educacion-cursos", ["curso", "academia", "instituto", "preuniversitario", "capacitaci", "clases particulares", "educa", "idiomas"]],
  ["tiendas-catalogo", ["tienda", "boutique", "ropa", "calzado", "catálogo", "catalogo", "zapater", "accesorios", "emprendimiento"]],
  ["agenda-reservas", ["reserva", "hotel", "cabaña", "cabana", "restauran", "masaje", "estudio de", "hora médica"]],
];

/** Devuelve el slug de RUBROS que mejor calza con un rubro de texto libre. */
export function matchRubroSlug(freeText: string | null | undefined): string | null {
  if (!freeText) return null;
  const t = freeText.toLowerCase();
  for (const [slug, kws] of KEYWORDS) {
    if (kws.some((k) => t.includes(k))) return slug;
  }
  return null;
}

const DEMO = process.env.NEXT_PUBLIC_DEMO_LINK || "[link demo]";

/** Reemplaza el marcador [link] por el link de demo configurado. */
export function conDemo(texto: string): string {
  return texto.replace(/\[link\]/g, DEMO);
}
