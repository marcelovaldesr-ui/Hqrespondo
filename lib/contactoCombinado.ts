import { geminiJsonConFuentes } from "./gemini";
import { buscarContactoHunter } from "./hunterAPI";
import { buscarPersonasLusha, type CandidatoLusha } from "./lushaAPI";
import { buscarContactoDecision, type ProspectoParaContacto, type ResultadoBusquedaContacto } from "./contactoAI";
import type { AreaObjetivo, Confianza, FuenteContacto } from "./types";

/**
 * Modo "Todas las fuentes" — mezcla Hunter.io + Lusha + IA para la búsqueda
 * más confiable posible, a pedido explícito de Marcelo (14-jul-2026): "la
 * gracia es mezclar todas para hacer la búsqueda lo más confiable y
 * potente posible".
 *
 * Estrategia (en ese orden):
 *  1. Hunter y Lusha se consultan EN PARALELO (ambos son bases reales,
 *     rápidas, sin alucinación) — esto no suma tiempo extra respecto a
 *     llamarlos uno a uno, importante por el límite de 10s de Vercel Hobby.
 *  2. Si Hunter encontró una persona Y Lusha encontró a alguien con el
 *     mismo apellido + inicial del nombre → cruce confirmado por DOS bases
 *     reales independientes → confianza "alta" directa, SIN pasar por IA
 *     (dos fuentes reales ya son más confiables que una fuente real sola
 *     verificada por IA, y nos ahorramos ~6s de presupuesto de Vercel).
 *  3. Si Hunter encontró pero no hay cruce con Lusha → mismo camino que el
 *     modo "Hunter + IA" ya probado en producción (contactoMixto.ts): la
 *     IA solo VERIFICA, nunca inventa, acotada a 6.5s.
 *  4. Si Hunter no encontró nada pero Lusha sí → se devuelven los
 *     candidatos de Lusha tal cual (mismo comportamiento que la fuente
 *     "lusha" sola): nombres reales, sin gastar crédito de revelado hasta
 *     que el usuario lo pida.
 *  5. Si ninguna base real encontró nada → 100% búsqueda IA (mismo
 *     fallback que ya existe en el modo mixto).
 *
 * OJO costos: a diferencia de "Hunter + IA" (gratis), este modo SIEMPRE
 * gasta ~1 crédito de Lusha por búsqueda (aparte de lo que cueste luego
 * "revelar"), y consume la cuota mensual de Hunter (~25 búsquedas/mes) al
 * mismo tiempo. No es gratis solo porque el resultado sea mejor.
 */

export interface ResultadoCombinadoUnico extends ResultadoBusquedaContacto {
  tipo: "unico";
  fuente_real: "hunter_lusha" | "hunter_ia" | "ia";
  lusha_contact_id?: string | null;
}

export interface ResultadoCombinadoMultiple {
  tipo: "multiple";
  candidatos: CandidatoLusha[];
  motivo?: string;
}

export type ResultadoCombinado = ResultadoCombinadoUnico | ResultadoCombinadoMultiple;

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

function normalizar(s: string): string {
  // NFD separa las tildes de la letra base (ej. "é" -> "e" + acento); el
  // filtro [^\x00-\x7F] saca todo lo no-ASCII (los acentos ya separados,
  // ñ descompuesta, etc.), evitando depender de un rango unicode literal
  // que es frágil de escribir/leer en distintos editores y encodings.
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

/** Requiere compartir apellido (última palabra) + inicial del primer nombre — evita falsos positivos por nombres comunes. */
function mismaPersona(nombreA: string, nombreB: string): boolean {
  const a = normalizar(nombreA).split(/\s+/).filter(Boolean);
  const b = normalizar(nombreB).split(/\s+/).filter(Boolean);
  if (a.length === 0 || b.length === 0) return false;
  const apellidoA = a[a.length - 1];
  const apellidoB = b[b.length - 1];
  if (apellidoA !== apellidoB) return false;
  return a[0][0] === b[0][0];
}

interface VerificacionIA {
  confirmado?: boolean;
  telefono?: string | null;
  linkedin?: string | null;
  resumen?: string | null;
}

export async function buscarContactoCombinado(
  p: ProspectoParaContacto,
  area: AreaObjetivo | string,
): Promise<ResultadoCombinado> {
  const [hunter, lusha] = await Promise.all([
    buscarContactoHunter(p, area).catch(() => null),
    buscarPersonasLusha(p, area).catch(() => ({ candidatos: [] as CandidatoLusha[], motivo: undefined as string | undefined })),
  ]);

  const candidatosLusha = lusha?.candidatos ?? [];
  const hunterOk = Boolean(hunter?.encontrado && hunter?.nombre);

  if (hunterOk && hunter) {
    const match = candidatosLusha.find((c) => mismaPersona(c.nombre, hunter.nombre!));

    if (match) {
      return {
        tipo: "unico",
        encontrado: true,
        nombre: hunter.nombre,
        cargo: hunter.cargo ?? match.cargo,
        telefono: hunter.telefono,
        email: hunter.email,
        linkedin_url: hunter.linkedin_url ?? match.linkedin_url,
        confianza: "alta",
        fuentes: hunter.fuentes,
        resumen:
          `Confirmado por dos bases reales independientes: Hunter.io (email) y Lusha ` +
          `(cargo "${match.cargo ?? "no especificado"}"${
            match.departamentos.length ? `, depto. ${match.departamentos.join(", ")}` : ""
          }).`,
        fuente_real: "hunter_lusha",
        lusha_contact_id: match.lusha_contact_id,
      };
    }

    const notaLusha =
      candidatosLusha.length > 0
        ? ` Lusha encontró otros candidatos distintos en la misma área: ${candidatosLusha
            .slice(0, 3)
            .map((c) => `${c.nombre} (${c.cargo ?? "cargo no especificado"})`)
            .join(", ")}.`
        : "";

    const prompt = `Verifica con búsqueda web si esta persona sigue trabajando ahí (NO la busques desde cero, solo confírmala):

Nombre: ${hunter.nombre}
Cargo (según base de datos de Hunter.io): ${hunter.cargo ?? "no especificado"}
Empresa: ${p.nombre}${p.web ? ` (${p.web})` : ""}

Busca una fuente pública real (LinkedIn, sitio de la empresa, prensa) que confirme que esta
persona sigue en ese cargo hoy. NO inventes nada nuevo: si no encuentras una fuente que lo
confirme, responde "confirmado": false y deja los demás campos en null. Si de paso encuentras
un teléfono profesional o un LinkedIn público adicional (no personal), inclúyelo.

Responde SOLO con JSON válido, sin markdown:
{"confirmado": true, "telefono": null, "linkedin": "...", "resumen": "..."}`;

    try {
      const { data, fuentes } = await conTimeout(
        geminiJsonConFuentes<VerificacionIA>(prompt, [{ google_search: {} }], {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 400,
        }),
        TIMEOUT_VERIFICACION_MS,
      );
      const confirmadoConFuente = Boolean(data.confirmado) && fuentes.length > 0;
      const confianza: Confianza = confirmadoConFuente ? "alta" : hunter.confianza;
      const todasFuentes: FuenteContacto[] = [...hunter.fuentes, ...fuentes];

      return {
        tipo: "unico",
        ...hunter,
        telefono: hunter.telefono ?? data.telefono ?? null,
        linkedin_url: hunter.linkedin_url ?? data.linkedin ?? null,
        confianza,
        fuentes: todasFuentes,
        resumen:
          `Hunter.io: ${hunter.resumen ?? "sin detalle"} · Verificación IA: ` +
          (confirmadoConFuente
            ? "confirmado con fuente pública."
            : "no se pudo confirmar de forma independiente — revisar con más cuidado.") +
          (data.resumen ? ` (${data.resumen})` : "") +
          notaLusha,
        fuente_real: "hunter_ia",
      };
    } catch {
      return {
        tipo: "unico",
        ...hunter,
        resumen: `${hunter.resumen ?? ""}${notaLusha} (verificación IA no disponible en este intento)`.trim(),
        fuente_real: "hunter_ia",
      };
    }
  }

  if (candidatosLusha.length > 0) {
    return { tipo: "multiple", candidatos: candidatosLusha, motivo: lusha?.motivo };
  }

  // Ninguna base real encontró nada — único caso donde dependemos 100% de la
  // IA. Si Gemini falla (cuota, JSON truncado, etc.) no debe tirar abajo
  // todo el request: devolvemos "no encontrado" en vez de un error 500 crudo.
  try {
    const ia = await buscarContactoDecision(p, area);
    return { tipo: "unico", ...ia, fuente_real: "ia" };
  } catch (e: any) {
    return {
      tipo: "unico",
      encontrado: false,
      nombre: null,
      cargo: null,
      telefono: null,
      email: null,
      linkedin_url: null,
      confianza: "baja",
      fuentes: [],
      resumen: `Hunter y Lusha no encontraron nada, y la búsqueda por IA falló en este intento (${e.message ?? "error desconocido"}). Prueba de nuevo en unos segundos.`,
      fuente_real: "ia",
    };
  }
}
