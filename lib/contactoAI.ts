import { geminiJsonConFuentes } from "./gemini";
import { AREA_OBJETIVO_LABEL, type AreaObjetivo, type Confianza, type FuenteContacto } from "./types";

/**
 * Prospección ADICIONAL: busca al ENCARGADO de un área específica dentro de
 * un negocio (no el dueño/teléfono general que ya trae `prospects`, que sale
 * de Google Places). Pensada para negocios medianos/grandes con áreas
 * separadas — en una pyme chica el dueño YA es el contacto, esto no aporta.
 *
 * REGLA DE ORO: esto NO es un generador de texto libre, es una búsqueda. El
 * prompt obliga a usar `google_search` y a citar de dónde salió cada dato.
 * Si no hay una fuente pública real, la respuesta debe decir que no se
 * encontró — jamás inventar un nombre, cargo, teléfono o correo. Aun así,
 * tratamos el resultado como borrador: sin fuente citada, bajamos la
 * confianza a "baja" nosotros mismos (no confiamos ciegamente en que el
 * modelo cumplió la regla) y la UI exige verificación humana antes de usar
 * el dato para contactar a alguien.
 */

export interface ProspectoParaContacto {
  nombre: string;
  rubro: string | null;
  comuna: string | null;
  web: string | null;
}

export interface ResultadoBusquedaContacto {
  encontrado: boolean;
  nombre: string | null;
  cargo: string | null;
  telefono: string | null;
  email: string | null;
  linkedin_url: string | null;
  confianza: Confianza;
  fuentes: FuenteContacto[];
  resumen: string | null;
}

interface RawContacto {
  encontrado?: boolean;
  nombre?: string | null;
  cargo?: string | null;
  telefono?: string | null;
  email?: string | null;
  linkedin?: string | null;
  confianza?: string;
  resumen?: string | null;
}

const GEN: Record<string, unknown> = {
  temperature: 0.2,
  topP: 0.9,
  // 800 en vez de 500: con google_search el modelo a veces gasta varios
  // tokens en razonar/citar antes del JSON final; un límite muy justo corta
  // la respuesta a medias y produce "Unexpected end of JSON input".
  maxOutputTokens: 800,
};

function areaLabel(area: AreaObjetivo | string): string {
  return (AREA_OBJETIVO_LABEL as Record<string, string>)[area] ?? area;
}

export async function buscarContactoDecision(
  p: ProspectoParaContacto,
  area: AreaObjetivo | string,
): Promise<ResultadoBusquedaContacto> {
  const label = areaLabel(area);

  const prompt = `Estás ayudando a un equipo comercial B2B chileno a identificar a la persona ENCARGADA de "${label}" en esta empresa:

Nombre: ${p.nombre}
Rubro: ${p.rubro ?? "no especificado"}
Comuna: ${p.comuna ?? "no especificada"}
${p.web ? `Sitio web: ${p.web}` : "Sin sitio web conocido"}

USA la búsqueda web para encontrar información PÚBLICA y VERIFICABLE (sitio oficial de la empresa, página de "equipo"/"contacto", perfil de LinkedIn público, prensa, directorios de negocios). NO tienes permitido inventar ni "completar" datos plausibles.

REGLAS ESTRICTAS (léelas dos veces):
- Si NO encuentras una fuente pública real que confirme el nombre de esa persona, responde "encontrado": false y deja los demás campos en null. Un dato sin fuente es peor que no tener dato.
- NUNCA inventes un teléfono o correo personal. Si solo encuentras el nombre y cargo pero no un contacto directo, entrégalos igual y deja telefono/email en null.
- Prefiere datos de contacto PROFESIONALES (correo corporativo, LinkedIn) por sobre un celular personal.
- "confianza": "alta" solo si el nombre y cargo aparecen confirmados en una fuente oficial reciente (sitio de la empresa o LinkedIn activo). "media" si la fuente es indirecta o no reciente. "baja" en cualquier otro caso.
- "resumen": 1 frase explicando de dónde sacaste el dato (o por qué no lo encontraste).

Responde SOLO con JSON válido, sin markdown:
{"encontrado": true, "nombre": "...", "cargo": "...", "telefono": null, "email": "...", "linkedin": "...", "confianza": "media", "resumen": "..."}`;

  const { data, fuentes } = await geminiJsonConFuentes<RawContacto>(
    prompt,
    [{ google_search: {} }],
    GEN,
  );

  const encontrado = Boolean(data.encontrado && data.nombre);
  // No confiamos solo en lo que el modelo dice de sí mismo: sin fuentes
  // citadas por el grounding, la confianza baja a "baja" pase lo que pase.
  const confianza: Confianza =
    fuentes.length === 0 ? "baja" : data.confianza === "alta" || data.confianza === "media" ? data.confianza : "baja";

  const resumenBase = data.resumen?.trim() || (encontrado ? "" : "No se encontró un encargado publicado para esta área.");
  const advertencia =
    encontrado && fuentes.length === 0
      ? " (sin fuente verificable citada — revisar manualmente antes de usar este dato)"
      : "";

  return {
    encontrado,
    nombre: encontrado ? (data.nombre ?? null) : null,
    cargo: encontrado ? (data.cargo ?? null) : null,
    telefono: encontrado ? (data.telefono ?? null) : null,
    email: encontrado ? (data.email ?? null) : null,
    linkedin_url: encontrado ? (data.linkedin ?? null) : null,
    confianza,
    fuentes,
    resumen: `${resumenBase}${advertencia}`.trim() || null,
  };
}
