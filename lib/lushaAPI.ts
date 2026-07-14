import { isAreaObjetivo, type AreaObjetivo } from "./types";

/**
 * Prospección adicional, fuente Lusha (plan gratuito).
 *
 * Igual que Apollo, Lusha separa BUSCAR de REVELAR, pero con una diferencia
 * clave verificada el 14-jul-2026: el plan gratuito de Lusha SÍ deja usar
 * ambos pasos (Apollo bloquea el paso de búsqueda por completo). Y a
 * diferencia de Apollo, Lusha devuelve el NOMBRE COMPLETO real desde la
 * búsqueda (no ofuscado) — solo el email/teléfono quedan bloqueados hasta
 * revelar.
 *
 *  1) Prospecting (POST /v3/contacts/prospecting) — gasta ~1 crédito por
 *     búsqueda (tamaño de página 10), no por resultado. Devuelve nombre,
 *     cargo, departamento(s), país/ciudad y LinkedIn público — sin email
 *     ni teléfono.
 *  2) Enrich (POST /v3/contacts/enrich) — esto SÍ gasta crédito por dato
 *     revelado: 1 crédito por email, 5 créditos por teléfono (confirmado
 *     en el dashboard de Marcelo, plan gratuito = 40 créditos/mes). Por
 *     eso nunca se llama automático, solo a pedido explícito del usuario.
 *
 * OJO cobertura probada: Simmedical (simmedical.cl, empresa mediana de
 * insumos médicos en Santiago) devolvió 27 contactos reales — Lusha SÍ
 * cubre pymes/medianas chilenas, no solo multinacionales.
 *
 * OJO shape de Enrich: la documentación oficial (docs.lusha.com/apis/
 * openapi/enrich) confirma el request (`{ids, reveal}`) pero no publica el
 * detalle completo de los 14 campos de respuesta. El parseo de
 * revelarContactoLusha es defensivo (prueba varias rutas posibles) y
 * siempre guarda el JSON crudo en `notas` como respaldo — así ningún dato
 * se pierde aunque el nombre exacto de un campo no sea el esperado en el
 * primer uso real.
 *
 * Fuente oficial verificada (14-jul-2026): docs.lusha.com/apis/openapi
 * (Prospecting, Enrich). Body real probado con curl contra simmedical.cl.
 */

const BASE = "https://api.lusha.com/v3";

// Los `departments` que Lusha devuelve en los resultados son en inglés y en
// mayúscula inicial (confirmado con datos reales: "Sales", "Operations",
// "Finance", "General Management", "Legal", "Other"). Como no confirmamos
// por curl el enum exacto que acepta el FILTRO de búsqueda, filtramos acá
// mismo (client-side) sobre lo que ya nos devuelve Lusha, en vez de
// arriesgar otro 400 por adivinar el valor del filtro.
const DEPARTAMENTOS_LUSHA: Partial<Record<AreaObjetivo, string[]>> = {
  gerencia_general: ["general management", "executive", "c-suite", "founder"],
  marketing: ["marketing"],
  operaciones: ["operations"],
  compras: ["procurement", "purchasing", "operations"],
  rrhh: ["human resources", "hr", "people"],
  ventas: ["sales"],
  atencion_cliente: ["customer service", "customer success", "support"],
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

function headers(key: string) {
  return {
    "Content-Type": "application/json",
    api_key: key,
  };
}

interface LushaJobTitle {
  title?: string | null;
  departments?: string[] | null;
  seniority?: string | null;
}

interface LushaCanReveal {
  field: "emails" | "phones";
  credits: number;
}

interface LushaResultadoBusqueda {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: LushaJobTitle | null;
  location?: { country?: string | null; city?: string | null } | null;
  socialLinks?: { linkedin?: string | null } | null;
  canReveal?: LushaCanReveal[] | null;
}

export interface CandidatoLusha {
  lusha_contact_id: string;
  nombre: string;
  cargo: string | null;
  departamentos: string[];
  ciudad_pais: string | null;
  linkedin_url: string | null;
  costo_revelar: string;
}

/** Paso 1 (~1 crédito por búsqueda, no por resultado): busca contactos reales de la empresa. */
export async function buscarPersonasLusha(
  p: { nombre: string; web: string | null },
  area: AreaObjetivo | string,
): Promise<{ candidatos: CandidatoLusha[]; motivo?: string }> {
  const key = process.env.LUSHA_API_KEY;
  if (!key) throw new Error("Falta LUSHA_API_KEY");

  const dominio = extraerDominio(p.web);
  if (!dominio) {
    return {
      candidatos: [],
      motivo: "Este prospecto no tiene sitio web propio — Lusha necesita un dominio para buscar dentro de la empresa.",
    };
  }

  const body = {
    pagination: { page: 0, size: 10 },
    filters: {
      contacts: { include: { countries: ["CL"] } },
      companies: { include: { domains: [dominio] } },
    },
  };

  const res = await fetch(`${BASE}/contacts/prospecting`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Lusha ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const resultados: LushaResultadoBusqueda[] = data?.results ?? [];

  if (resultados.length === 0) {
    return {
      candidatos: [],
      motivo: `Lusha no encontró contactos públicos para ${dominio}.`,
    };
  }

  const claves = isAreaObjetivo(area) ? DEPARTAMENTOS_LUSHA[area] ?? [] : [];
  const coincide = (r: LushaResultadoBusqueda) => {
    const deptos = (r.jobTitle?.departments ?? []).map((d) => d.toLowerCase());
    return claves.some((clave) => deptos.some((d) => d.includes(clave) || clave.includes(d)));
  };

  const filtrados = claves.length > 0 ? resultados.filter(coincide) : [];
  const elegidos = (filtrados.length > 0 ? filtrados : resultados).slice(0, 5);

  const candidatos: CandidatoLusha[] = elegidos.map((r) => {
    const costos = (r.canReveal ?? [])
      .map((c) => `${c.field === "emails" ? "email" : "teléfono"}: ${c.credits} crédito${c.credits === 1 ? "" : "s"}`)
      .join(" · ");
    return {
      lusha_contact_id: r.id,
      nombre: [r.firstName, r.lastName].filter(Boolean).join(" ") || "(sin nombre)",
      cargo: r.jobTitle?.title ?? null,
      departamentos: r.jobTitle?.departments ?? [],
      ciudad_pais: [r.location?.city, r.location?.country].filter(Boolean).join(", ") || null,
      linkedin_url: r.socialLinks?.linkedin ?? null,
      costo_revelar: costos || "sin datos revelables",
    };
  });

  return {
    candidatos,
    motivo:
      filtrados.length === 0 && claves.length > 0
        ? `Lusha encontró ${resultados.length} contactos en ${dominio}, pero ninguno coincide exactamente con el área elegida — se muestran los más relevantes igual.`
        : undefined,
  };
}

export interface RevelacionLusha {
  email: string | null;
  telefono: string | null;
  creditos_consumidos: number;
  crudo: string;
}

/** Extrae el primer valor útil de un campo que puede venir como string, objeto o array de cualquiera. */
function primerValor(campo: unknown): string | null {
  if (!campo) return null;
  if (typeof campo === "string") return campo;
  if (Array.isArray(campo)) {
    for (const item of campo) {
      const v = primerValor(item);
      if (v) return v;
    }
    return null;
  }
  if (typeof campo === "object") {
    const o = campo as Record<string, unknown>;
    const candidato = o.email ?? o.address ?? o.number ?? o.phoneNumber ?? o.value ?? o.raw;
    if (typeof candidato === "string") return candidato;
  }
  return null;
}

/** Paso 2 (GASTA crédito Lusha: 1 email / 5 teléfono): revela el contacto real de un candidato ya encontrado. */
export async function revelarContactoLusha(
  lushaContactId: string,
  campos: ("emails" | "phones")[] = ["emails", "phones"],
): Promise<RevelacionLusha> {
  const key = process.env.LUSHA_API_KEY;
  if (!key) throw new Error("Falta LUSHA_API_KEY");

  const res = await fetch(`${BASE}/contacts/enrich`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({ ids: [lushaContactId], reveal: campos }),
  });
  if (!res.ok) {
    throw new Error(`Lusha ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const resultado = data?.results?.[0] ?? {};

  const email = primerValor(resultado.emails ?? resultado.email);
  const telefono = primerValor(resultado.phones ?? resultado.phone);

  return {
    email,
    telefono,
    creditos_consumidos: data?.billing?.creditsCharged ?? 0,
    crudo: JSON.stringify(resultado),
  };
}
