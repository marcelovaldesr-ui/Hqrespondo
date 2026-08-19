import { isAreaObjetivo, type AreaObjetivo } from "./types";

/**
 * Prospección adicional, fuente Apollo.io (plan gratuito).
 *
 * Apollo separa BUSCAR de REVELAR:
 *  1) People Search (mixed_people/api_search) — NO consume créditos, pero
 *     devuelve el nombre PARCIAL/ofuscado (ej. "Chuck Po***r") y sin
 *     contacto. Sirve para confirmar "sí hay alguien con este cargo en esta
 *     empresa" gratis.
 *  2) People Enrichment (people/bulk_match con reveal_personal_emails /
 *     reveal_phone_number) — esto SÍ consume créditos del plan. Por eso
 *     nunca se llama automático: el usuario decide, candidato por
 *     candidato, cuándo vale la pena gastar un crédito.
 *
 * OJO plan gratuito: el número exacto de créditos de email/teléfono varía
 * y Apollo no lo documenta de forma fija — revisa tu saldo real en
 * Apollo > Settings > API Usage antes de usar esto a gran escala.
 *
 * Fuente oficial verificada (jul-2026): docs.apollo.io/docs/find-people-using-filters
 * y docs.apollo.io/docs/enrich-people-data.
 */

const BASE = "https://api.apollo.io/api/v1";

// Cargos en inglés (base de Apollo es mayormente EN) + variante en español,
// para maximizar matches de "encargado" por área.
const TITULOS_APOLLO: Partial<Record<AreaObjetivo, string[]>> = {
  gerencia_general: ["ceo", "general manager", "managing director", "owner", "founder", "gerente general"],
  marketing: ["marketing manager", "head of marketing", "marketing director", "gerente de marketing"],
  operaciones: ["operations manager", "head of operations", "operations director", "gerente de operaciones"],
  compras: ["purchasing manager", "procurement manager", "head of procurement", "gerente de compras"],
  rrhh: ["hr manager", "head of hr", "human resources manager", "gerente de recursos humanos"],
  ventas: ["sales manager", "sales director", "head of sales", "gerente de ventas"],
  atencion_cliente: [
    "customer service manager",
    "customer support manager",
    "head of customer success",
    "gerente de atención al cliente",
  ],
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
    "Cache-Control": "no-cache",
    accept: "application/json",
    "x-api-key": key,
  };
}

export interface CandidatoApollo {
  apollo_person_id: string;
  nombre_parcial: string;
  cargo: string | null;
  organizacion: string | null;
}

/** Paso 1 (gratis): busca candidatos por cargo dentro del dominio del prospecto. */
export async function buscarPersonasApollo(
  p: { nombre: string; web: string | null },
  area: AreaObjetivo | string,
): Promise<{ candidatos: CandidatoApollo[]; motivo?: string }> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("Falta APOLLO_API_KEY");

  const dominio = extraerDominio(p.web);
  if (!dominio) {
    return {
      candidatos: [],
      motivo: "Este prospecto no tiene sitio web propio — Apollo necesita un dominio para buscar dentro de la empresa.",
    };
  }

  const titulos = isAreaObjetivo(area) ? TITULOS_APOLLO[area] ?? [] : [];
  const params = new URLSearchParams();
  params.set("per_page", "5");
  params.append("q_organization_domains_list[]", dominio);
  for (const t of titulos) params.append("person_titles[]", t);

  const res = await fetch(`${BASE}/mixed_people/api_search?${params.toString()}`, {
    method: "POST",
    headers: headers(key),
  });
  if (!res.ok) {
    throw new Error(`Apollo ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const people: any[] = data?.people ?? [];

  const candidatos: CandidatoApollo[] = people.slice(0, 5).map((per) => ({
    apollo_person_id: per.id,
    nombre_parcial: [per.first_name, per.last_name_obfuscated].filter(Boolean).join(" ") || "(sin nombre)",
    cargo: per.title ?? null,
    organizacion: per.organization?.name ?? null,
  }));

  return {
    candidatos,
    motivo: candidatos.length === 0 ? `Apollo no encontró a nadie con ese cargo en ${dominio}.` : undefined,
  };
}

export interface RevelacionApollo {
  nombre: string | null;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  linkedin_url: string | null;
  creditos_consumidos: number;
}

/** Paso 2 (GASTA crédito Apollo): revela email/teléfono de un candidato ya encontrado. */
export async function revelarContactoApollo(apolloPersonId: string): Promise<RevelacionApollo> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("Falta APOLLO_API_KEY");

  const params = new URLSearchParams({
    reveal_personal_emails: "true",
    reveal_phone_number: "true",
  });

  const res = await fetch(`${BASE}/people/bulk_match?${params.toString()}`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({ details: [{ id: apolloPersonId }] }),
  });
  if (!res.ok) {
    throw new Error(`Apollo ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const match = data?.matches?.[0];
  if (!match) {
    throw new Error("Apollo no pudo revelar este contacto (puede que ya no exista o se agotaron los créditos).");
  }

  const telefono: string | null =
    match.contact?.phone_numbers?.[0]?.sanitized_number ?? match.contact?.sanitized_phone ?? null;

  return {
    nombre: match.name ?? ([match.first_name, match.last_name].filter(Boolean).join(" ") || null),
    cargo: match.title ?? null,
    email: match.email ?? null,
    telefono,
    linkedin_url: match.linkedin_url ?? null,
    creditos_consumidos: data?.credits_consumed ?? 0,
  };
}
