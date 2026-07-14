import type { ProspectoParaContacto, ResultadoBusquedaContacto } from "./contactoAI";
import { isAreaObjetivo, type AreaObjetivo, type Confianza, type FuenteContacto } from "./types";

/**
 * Prospección adicional, fuente Hunter.io (Domain Search — plan gratuito).
 *
 * A diferencia de lib/contactoAI.ts (que GENERA texto con un LLM), esto
 * consulta la base de datos real de Hunter: el dato no se puede "alucinar",
 * pero sí puede estar desactualizado (persona que ya no trabaja ahí) o ser
 * un patrón de correo adivinado con baja confianza — por eso igual exige
 * verificación humana antes de contactar (misma regla para todas las
 * fuentes, ver `verificado` en ContactoDecision).
 *
 * OJO plan gratuito: Hunter da ~25 búsquedas/mes. Por eso esto se llama
 * SIEMPRE a pedido manual (un prospecto a la vez), nunca en lote.
 */

// Departamentos que Hunter reconoce (ver docs): no tiene "compras" — para esa
// área buscamos sin filtro de departamento y dejamos que el humano revise.
const DEPARTAMENTO_HUNTER: Partial<Record<AreaObjetivo, string>> = {
  gerencia_general: "executive,management",
  marketing: "marketing",
  operaciones: "operations",
  rrhh: "hr",
  ventas: "sales",
  atencion_cliente: "support",
};

function extraerDominio(web: string | null): string | null {
  if (!web) return null;
  try {
    const url = web.startsWith("http") ? web : `https://${web}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

interface HunterEmail {
  value: string;
  confidence: number;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  department: string | null;
  linkedin: string | null;
  twitter: string | null;
  phone_number: string | null;
  verification?: { status?: string | null };
}

export async function buscarContactoHunter(
  p: ProspectoParaContacto,
  area: AreaObjetivo | string,
): Promise<ResultadoBusquedaContacto> {
  const key = process.env.HUNTER_API_KEY;
  if (!key) throw new Error("Falta HUNTER_API_KEY");

  const dominio = extraerDominio(p.web);
  const depto = isAreaObjetivo(area) ? DEPARTAMENTO_HUNTER[area] : undefined;

  const params = new URLSearchParams();
  if (dominio) params.set("domain", dominio);
  else params.set("company", p.nombre);
  params.set("seniority", "senior,executive"); // priorizamos encargados, no junior
  if (depto) params.set("department", depto);
  params.set("limit", "10");
  params.set("api_key", key);

  const res = await fetch(`https://api.hunter.io/v2/domain-search?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Hunter ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const emails: HunterEmail[] = data?.data?.emails ?? [];

  if (emails.length === 0) {
    return {
      encontrado: false,
      nombre: null,
      cargo: null,
      telefono: null,
      email: null,
      linkedin_url: null,
      confianza: "baja",
      fuentes: [],
      resumen: dominio
        ? `Hunter no encontró contactos para ${dominio}${depto ? ` en el área "${depto}"` : ""}.`
        : "Hunter no encontró contactos (el prospecto no tiene sitio web propio para buscar por dominio).",
    };
  }

  const top = [...emails].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  const nombre = [top.first_name, top.last_name].filter(Boolean).join(" ") || null;
  const confianza: Confianza = top.confidence >= 85 ? "alta" : top.confidence >= 50 ? "media" : "baja";

  const fuentes: FuenteContacto[] = [];
  if (top.linkedin) fuentes.push({ url: top.linkedin, titulo: "LinkedIn" });
  if (top.twitter) fuentes.push({ url: `https://twitter.com/${top.twitter}`, titulo: "Twitter" });

  return {
    encontrado: true,
    nombre,
    cargo: top.position ?? null,
    telefono: top.phone_number ?? null,
    email: top.value ?? null,
    linkedin_url: top.linkedin ?? null,
    confianza,
    fuentes,
    resumen:
      `Hunter.io (base de datos, no generado por IA) — confianza del email: ${top.confidence ?? "?"}%` +
      ` · verificación: ${top.verification?.status ?? "sin verificar"}.` +
      (emails.length > 1
        ? ` Había ${emails.length} contactos posibles para este dominio/área; se eligió el de mayor confianza.`
        : ""),
  };
}
