import { geminiJsonConFuentes } from "./gemini";
import { buscarContactoHunter } from "./hunterAPI";
import { buscarContactoDecision, type ProspectoParaContacto, type ResultadoBusquedaContacto } from "./contactoAI";
import type { AreaObjetivo, Confianza, FuenteContacto } from "./types";

/**
 * Modo mixto: Hunter.io + IA — pensado para compensar las debilidades de
 * cada uno por separado.
 *
 *  - Hunter es un dato REAL (no puede alucinar), pero su cobertura es baja
 *    en pymes chilenas y puede estar desactualizado (persona que ya no
 *    trabaja ahí).
 *  - La IA sola SÍ puede alucinar un nombre si no encuentra nada — por eso
 *    lib/contactoAI.ts fuerza google_search y baja la confianza sin fuente.
 *
 * Acá la IA NUNCA inventa desde cero: solo VERIFICA un nombre que Hunter ya
 * encontró (¿sigue en ese cargo? ¿hay más datos públicos?). Es un uso mucho
 * más seguro de la IA porque parte de un hecho, no de una pregunta abierta.
 *
 * Si Hunter no encuentra nada, caemos 100% al buscador de IA existente (con
 * sus mismas reglas anti-alucinación) — nunca nos quedamos sin intentarlo.
 */

export interface ResultadoMixto extends ResultadoBusquedaContacto {
  // 'hunter_ia' = Hunter encontró la base y la IA la verificó/enriqueció.
  // 'ia' = Hunter no encontró nada; esto es 100% resultado de la IA sola.
  fuente_real: "hunter_ia" | "ia";
}

interface VerificacionIA {
  confirmado?: boolean;
  telefono?: string | null;
  linkedin?: string | null;
  resumen?: string | null;
}

const GEN_VERIFICACION: Record<string, unknown> = {
  temperature: 0.2,
  topP: 0.9,
  maxOutputTokens: 400,
};

// Vercel (plan Hobby) mata la función a los 10s TOTALES sin importar
// maxDuration. Hunter ya gastó un poco de ese presupuesto, así que la
// verificación con Gemini (google_search puede tardar 10-20s ella sola)
// tiene que tener un techo propio — si se pasa, seguimos con el dato de
// Hunter en vez de arriesgar que Vercel corte TODO el request a medias
// (eso es lo que devolvía una página de error no-JSON al cliente).
const TIMEOUT_VERIFICACION_MS = 6500;

function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout de verificación IA")), ms);
    promesa.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function buscarContactoMixto(
  p: ProspectoParaContacto,
  area: AreaObjetivo | string,
): Promise<ResultadoMixto> {
  const base = await buscarContactoHunter(p, area);

  if (!base.encontrado || !base.nombre) {
    // Hunter no encontró nada — único caso 100% dependiente de la IA. Si
    // Gemini falla (cuota, JSON truncado, etc.) no debe tirar abajo todo el
    // request: devolvemos "no encontrado" en vez de un error 500 crudo.
    try {
      const ia = await buscarContactoDecision(p, area);
      return { ...ia, fuente_real: "ia" };
    } catch (e: any) {
      return {
        encontrado: false,
        nombre: null,
        cargo: null,
        telefono: null,
        email: null,
        linkedin_url: null,
        confianza: "baja",
        fuentes: [],
        resumen: `Hunter no encontró nada, y la búsqueda por IA falló en este intento (${e.message ?? "error desconocido"}). Prueba de nuevo en unos segundos.`,
        fuente_real: "ia",
      };
    }
  }

  const prompt = `Verifica con búsqueda web si esta persona sigue trabajando ahí (NO la busques desde cero, solo confírmala):

Nombre: ${base.nombre}
Cargo (según base de datos de Hunter.io): ${base.cargo ?? "no especificado"}
Empresa: ${p.nombre}${p.web ? ` (${p.web})` : ""}

Busca una fuente pública real (LinkedIn, sitio de la empresa, prensa) que confirme que esta
persona sigue en ese cargo hoy. NO inventes nada nuevo: si no encuentras una fuente que lo
confirme, responde "confirmado": false y deja los demás campos en null. Si de paso encuentras
un teléfono profesional o un LinkedIn público adicional (no personal), inclúyelo.

Responde SOLO con JSON válido, sin markdown:
{"confirmado": true, "telefono": null, "linkedin": "...", "resumen": "..."}`;

  try {
    const { data, fuentes } = await conTimeout(
      geminiJsonConFuentes<VerificacionIA>(prompt, [{ google_search: {} }], GEN_VERIFICACION),
      TIMEOUT_VERIFICACION_MS,
    );

    const confirmadoConFuente = Boolean(data.confirmado) && fuentes.length > 0;
    const confianza: Confianza = confirmadoConFuente ? "alta" : base.confianza;
    const todasFuentes: FuenteContacto[] = [...base.fuentes, ...fuentes];

    return {
      ...base,
      telefono: base.telefono ?? data.telefono ?? null,
      linkedin_url: base.linkedin_url ?? data.linkedin ?? null,
      confianza,
      fuentes: todasFuentes,
      resumen:
        `Hunter.io: ${base.resumen ?? "sin detalle"} · Verificación IA: ` +
        (confirmadoConFuente
          ? "confirmado con fuente pública."
          : "no se pudo confirmar de forma independiente — revisar con más cuidado.") +
        (data.resumen ? ` (${data.resumen})` : ""),
      fuente_real: "hunter_ia",
    };
  } catch {
    // Si la verificación por IA falla (cuota, red, etc.) no perdemos el dato
    // real de Hunter — se guarda igual, solo sin el paso de verificación.
    return {
      ...base,
      resumen: `${base.resumen ?? ""} (verificación IA no disponible en este intento)`.trim(),
      fuente_real: "hunter_ia",
    };
  }
}
