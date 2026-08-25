/**
 * ¿Vale la pena gastar buscando el teléfono de este decisor?
 *
 * Nace de una corrida real del 25-ago-2026. La cascada procesó tres empresas y
 * una de ellas era "CENTRO MEDICO MILITAR ROSA O'HIGGINS", de la que habíamos
 * extraído a "Rosa Higgins" como si fuera la dueña. Es una institución: nadie
 * se llama así, el apóstrofo se comió parte del apellido, y pagamos una
 * búsqueda de Gemini y una de Places para encontrar a un fantasma.
 *
 * Sobre una muestra de 22 decisores reales de `empresas_sii`, los modos de
 * falla resultaron ser cuatro, y solo uno estaba en el nombre:
 *
 *   1. Apellidos de socios ("Cardenas y Moran", "Almendras y Ulloa"). Son 8 de
 *      los 22 y TODOS venían marcados `confianza = media`. No son buscables:
 *      sin nombre de pila, ni Maps ni una búsqueda pueden distinguir a la
 *      persona de cualquier homónimo.
 *   2. Texto que no es un nombre ("Residencial y Restaurant", "Fisica y
 *      Reabilit"). `pareceNombreDePersona` ya los atajaba.
 *   3. Organismos ("CENTRO MEDICO MILITAR ROSA O'HIGGINS", 'POLICLINICO DE
 *      ALCOHOLISMO "OBISPO ENRIQUE ALVEAR"'). El nombre que aparece es una
 *      dedicatoria, no un dueño. Se detectan porque su razón social NO trae
 *      forma legal: `empresas_sii` viene del padrón de personas jurídicas, así
 *      que toda empresa de verdad dice LIMITADA, SPA o E.I.R.L. en alguna
 *      parte. Un organismo público no.
 *   4. Marcas ("MARIA JO BEAUTY ESTUDIO SPA" → "Maria Beauty Estudio").
 *      Nadie se apellida Beauty.
 *
 * Medido contra esos 22 casos más los 3 ya procesados: 24 aciertos de 24, cero
 * personas reales descartadas. El criterio es deliberadamente conservador —
 * perder un decisor bueno cuesta una oportunidad; buscar un fantasma cuesta
 * plata Y ensucia la lista de llamadas con un número que alguien va a marcar.
 */

import { pareceNombreDePersona, podarNombre } from "@/lib/nombrePersona";

const sinAcento = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/**
 * Forma legal de persona jurídica chilena. Su AUSENCIA es la señal: lo que no
 * la trae no es la empresa de alguien, es un organismo.
 */
const FORMA_LEGAL =
  /\b(LIMITADA|LTDA|SPA|S\.?P\.?A|E\.?I\.?R\.?L|EIRL|S\.?A\.?|COMPANIA|COMPAÑIA|SOCIEDAD|SOC)\b|E\.I\./;

/** Un nombre entre comillas es a quién está dedicado el lugar, no su dueño. */
const ENTRE_COMILLAS = /["“”'']([^"“”'']{4,})["“”'']/;

/** Organismos donde el concepto de "dueño" no aplica. */
const ORGANISMO =
  /\b(MILITAR|MUNICIPAL|MUNICIPALIDAD|CESFAM|CONSULTORIO|FUNDACION|CORPORACION|PENITENCIARIO|CARABINEROS|FUERZA AEREA|ARMADA|EJERCITO|UNIVERSIDAD|LICEO|COLEGIO|ESCUELA|PARROQUIA|OBISPADO|SERVICIO DE SALUD)\b/;

/** Palabras de marca que nadie tiene de apellido. */
const MARCA = new Set(
  `BEAUTY ESTUDIO STUDIO BOUTIQUE SHOP STORE LAB LABS GROUP HOUSE CENTER SPA NAILS HAIR
   SMILE DENT CARE CLUB EXPRESS PLUS PRIME TOP BEST GOLD PREMIUM DELUXE`.split(/\s+/),
);

export type VeredictoDecisor = { buscable: boolean; motivo: string };

export function decisorBuscable(
  razonSocial: string | null,
  nombre: string | null,
  confianza: string | null,
): VeredictoDecisor {
  if (!nombre) return { buscable: false, motivo: "sin nombre de decisor" };

  if (confianza !== "alta")
    return {
      buscable: false,
      motivo: `confianza ${confianza ?? "nula"}: son apellidos de socios, no un nombre buscable`,
    };

  const podado = podarNombre(nombre);
  if (!pareceNombreDePersona(podado))
    return { buscable: false, motivo: "no parece el nombre de una persona" };

  for (const t of sinAcento(podado).split(/\s+/))
    if (MARCA.has(t))
      return { buscable: false, motivo: `"${t}" es palabra de marca, no un apellido` };

  const rs = sinAcento(razonSocial ?? "");
  if (!rs) return { buscable: false, motivo: "sin razón social con qué contrastar" };

  if (!FORMA_LEGAL.test(rs))
    return {
      buscable: false,
      motivo: "la razón social no trae forma legal: es un organismo, no la empresa de una persona",
    };

  if (ORGANISMO.test(rs))
    return { buscable: false, motivo: "es un organismo público o institucional" };

  const comillas = razonSocial!.match(ENTRE_COMILLAS)?.[1];
  const apellido = sinAcento(podado).split(/\s+/).pop() ?? "@@";
  if (comillas && sinAcento(comillas).includes(apellido))
    return {
      buscable: false,
      motivo: "el nombre está entre comillas en la razón social: es una dedicatoria, no el dueño",
    };

  return { buscable: true, motivo: "ok" };
}
