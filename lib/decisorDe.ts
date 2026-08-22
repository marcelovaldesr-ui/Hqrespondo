import { decisorDeRazonSocial, primerNombre, type DecisorDetectado } from "@/lib/decisor";
import { decisorDeWeb } from "@/lib/decisorWeb";

/**
 * El resolvedor de decisor: junta las fuentes públicas en un solo resultado.
 *
 * El orden no es casual, es por precisión medida:
 *   1. Razón social del SII — cuando dice el nombre, es el dueño legal. No
 *      hay forma más dura de saberlo y sale gratis. Cubre el 7% (583 de las
 *      7.312), y son justo las empresas de 3 y 4 trabajadores.
 *   2. Web del propio negocio — 53% nombra a alguien, 7% dice el cargo.
 *      Se usa para confirmar el nombre de arriba o para aportar uno nuevo.
 *   3. Lo que ya haya cargado una persona a mano — nunca se pisa.
 *
 * Lo que este archivo NO hace: elegir un nombre cuando no hay evidencia. Si
 * el sitio lista diez dentistas sin decir cuál manda, se devuelven los diez y
 * se deja la decisión a quien llama. Un nombre equivocado quema la llamada
 * peor que no tener ninguno.
 */

export interface DecisorResuelto {
  nombre: string | null;
  cargo: string | null;
  comoPreguntar: string | null;
  confianza: "alta" | "media" | "baja" | null;
  origen: string | null;
  /** Todas las personas vistas, para que la UI ofrezca elegir. */
  candidatos: { nombre: string; cargo: string | null; fuente: string }[];
  /** Qué se intentó y qué devolvió cada fuente. */
  traza: string[];
}

export async function resolverDecisor(entrada: {
  razon_social?: string | null;
  web?: string | null;
  /** Dirección del negocio, para no confundir la calle con el dueño. */
  direccion?: string | null;
  /** Si ya hay un nombre puesto por una persona, manda ese. */
  contactoActual?: string | null;
}): Promise<DecisorResuelto> {
  const traza: string[] = [];

  if (entrada.contactoActual?.trim()) {
    return {
      nombre: entrada.contactoActual.trim(),
      cargo: null,
      comoPreguntar: `¿Está ${primerNombre(entrada.contactoActual)}?`,
      confianza: "alta",
      origen: "cargado a mano",
      candidatos: [],
      traza: ["ya tenía contacto cargado: no se toca"],
    };
  }

  let porSii: DecisorDetectado | null = null;
  if (entrada.razon_social?.trim()) {
    porSii = decisorDeRazonSocial(entrada.razon_social);
    traza.push(porSii ? `razón social → ${porSii.nombre} (${porSii.patron})` : "razón social → sin nombre de persona");
  } else {
    traza.push("razón social → no hay");
  }

  const web = await decisorDeWeb(entrada.web ?? null, entrada.direccion ?? null);
  traza.push(`web → ${web.motivo}${web.personas.length ? ` (${web.personas.length} personas)` : ""}`);

  const candidatos = web.personas.map((p) => ({ nombre: p.nombre, cargo: p.cargo, fuente: p.fuente }));

  // Confirmación cruzada: el apellido del dueño legal aparece entre los
  // profesionales del sitio. Dos fuentes independientes diciendo lo mismo es
  // lo más firme que se puede tener sin llamar y preguntar.
  if (porSii) {
    const apellidos = porSii.nombre.toUpperCase().split(/\s+/).filter((w) => w.length >= 4);
    const enWeb = web.personas.find((p) =>
      apellidos.some((a) => p.nombre.toUpperCase().includes(a)),
    );
    if (enWeb) {
      traza.push(`cruce → el sitio también nombra a ${enWeb.nombre}`);
      return {
        nombre: enWeb.nombre,
        cargo: enWeb.cargo,
        comoPreguntar: `¿Está ${primerNombre(enWeb.nombre)}?`,
        confianza: "alta",
        origen: `${porSii.origen} · confirmado en ${enWeb.fuente}`,
        candidatos,
        traza,
      };
    }
    return {
      nombre: porSii.nombre,
      cargo: porSii.patron === "doctor" ? "profesional a cargo" : "dueño o socio (según razón social)",
      comoPreguntar: porSii.comoPreguntar,
      confianza: porSii.confianza,
      origen: porSii.origen,
      candidatos,
      traza,
    };
  }

  if (web.probableDecisor) {
    const d = web.probableDecisor;
    return {
      nombre: d.nombre,
      cargo: d.cargo,
      comoPreguntar: `¿Está ${primerNombre(d.nombre)}?`,
      confianza: d.cargo ? "alta" : "media",
      origen: `Sitio del negocio: ${d.fuente}`,
      candidatos,
      traza,
    };
  }

  return {
    nombre: null, cargo: null, comoPreguntar: null, confianza: null, origen: null,
    candidatos, traza,
  };
}
