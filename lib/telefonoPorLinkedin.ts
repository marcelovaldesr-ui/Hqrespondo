/**
 * Buscar el teléfono de una persona a partir de su perfil de LinkedIn.
 *
 * IMPORTANTE — esto NO scrapea LinkedIn. LinkedIn prohíbe el scraping en sus
 * términos y bloquea a quien lo intenta; construir eso sería regalarle la
 * cuenta a un baneo. Lo que se hace es consultar a proveedores de datos que
 * ya tienen licencia sobre esos perfiles (Apollo y Lusha), usando la URL como
 * identificador para que hagan el match. Es la misma vía que usa la agencia
 * de Tomás.
 *
 * La cascada va de lo barato a lo caro y se detiene apenas hay teléfono:
 *   1) Apollo people/match con linkedin_url + reveal_phone_number
 *   2) Lusha person con linkedinUrl, revelando phones
 * Si ninguno lo tiene, se dice que no se encontró — nunca se inventa un número.
 *
 * Cada llamada GASTA CRÉDITOS del plan, así que esto se dispara SIEMPRE a
 * pedido explícito de una persona, uno por uno, nunca en lote automático.
 */

import { APOLLO_BASE, cuentasApollo, esFaltaDeCupo } from "./apolloCuentas";

const LUSHA = "https://api.lusha.com/v3";

export type FuenteTelefono = "apollo" | "lusha";

export interface ResultadoTelefono {
  encontrado: boolean;
  telefono: string | null;
  email: string | null;
  nombre: string | null;
  cargo: string | null;
  empresa: string | null;
  fuente: FuenteTelefono | null;
  creditos: number;
  /** Qué se intentó y cómo fue, en orden. Para mostrarlo tal cual en pantalla. */
  intentos: { fuente: FuenteTelefono; resultado: string }[];
  /** Con qué cuenta se obtuvo el dato, cuando el proveedor tiene varias. */
  cuenta: string | null;
  /** Por qué no se pudo, cuando corresponde. */
  motivo: string | null;
}

/** Normaliza a la forma canónica https://www.linkedin.com/in/slug */
export function normalizarPerfil(url: string): string | null {
  const t = (url ?? "").trim();
  if (!t) return null;
  // Acepta que peguen solo el slug, o la URL con o sin país (cl.linkedin.com).
  const m = t.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  const slug = m ? m[1] : /^[a-zA-Z0-9-%]+$/.test(t) ? t : null;
  if (!slug) return null;
  return `https://www.linkedin.com/in/${slug.replace(/\/+$/, "")}`;
}

/** Un teléfono sirve si tiene dígitos suficientes para marcarlo. */
function telefonoUtil(t: unknown): string | null {
  if (typeof t !== "string") return null;
  const d = t.replace(/\D/g, "");
  return d.length >= 8 ? t.trim() : null;
}

async function porApollo(
  perfil: string,
): Promise<Partial<ResultadoTelefono> & { ok: boolean; detalle: string; cuenta?: string }> {
  const cuentas = cuentasApollo();
  if (!cuentas.length) return { ok: false, detalle: "sin APOLLO_API_KEY configurada" };

  const params = new URLSearchParams({
    reveal_personal_emails: "true",
    reveal_phone_number: "true",
  });

  let ultimo = "";
  for (const cuenta of cuentas) {
    const res = await fetch(`${APOLLO_BASE}/people/match?${params}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "x-api-key": cuenta.key,
      },
      body: JSON.stringify({ linkedin_url: perfil }),
    });

    if (!res.ok) {
      const cuerpo = (await res.text()).slice(0, 200);
      // Solo se pasa a la otra cuenta si el problema es de CUPO o de permiso.
      // Si el error es de otro tipo, repetir con la segunda llave no lo
      // arregla y además consume una llamada.
      if (esFaltaDeCupo(res.status, cuerpo) && cuenta !== cuentas[cuentas.length - 1]) {
        ultimo = `${cuenta.nombre}: sin cupo (${res.status})`;
        continue;
      }
      if (res.status === 402 || res.status === 403) {
        return { ok: false, cuenta: cuenta.nombre, detalle: `${cuenta.nombre}: el plan no permite esta consulta (${res.status})` };
      }
      return { ok: false, cuenta: cuenta.nombre, detalle: `${cuenta.nombre}: error ${res.status}: ${cuerpo}` };
    }

    const data = await res.json();
    const p = data?.person;
    // "No está en la base" es respuesta DEFINITIVA: las dos cuentas consultan
    // la misma base de Apollo, así que preguntarle a la otra es tirar una
    // llamada a la basura.
    if (!p) {
      return { ok: false, cuenta: cuenta.nombre, detalle: `${cuenta.nombre}: no tiene a esta persona en su base` };
    }

    const telefono =
      telefonoUtil(p.contact?.phone_numbers?.[0]?.sanitized_number) ??
      telefonoUtil(p.contact?.sanitized_phone) ??
      telefonoUtil(p.phone_numbers?.[0]?.sanitized_number) ??
      telefonoUtil(p.sanitized_phone) ??
      null;

    return {
      ok: !!telefono,
      cuenta: cuenta.nombre,
      detalle: `${cuenta.nombre}: ${telefono ? "teléfono encontrado" : "tiene la persona, pero sin teléfono"}`,
      telefono,
      email: p.email ?? p.contact?.email ?? null,
      nombre: p.name ?? ([p.first_name, p.last_name].filter(Boolean).join(" ") || null),
      cargo: p.title ?? null,
      empresa: p.organization?.name ?? p.employment_history?.[0]?.organization_name ?? null,
      creditos: data?.credits_consumed ?? 0,
    };
  }

  return { ok: false, detalle: ultimo || "ninguna cuenta de Apollo pudo responder" };
}

async function porLusha(perfil: string): Promise<Partial<ResultadoTelefono> & { ok: boolean; detalle: string }> {
  const key = process.env.LUSHA_API_KEY;
  if (!key) return { ok: false, detalle: "sin LUSHA_API_KEY configurada" };

  const params = new URLSearchParams({ linkedinUrl: perfil, revealPhones: "true", revealEmails: "true" });
  const res = await fetch(`${LUSHA}/person?${params}`, {
    method: "GET",
    headers: { api_key: key, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const cuerpo = (await res.text()).slice(0, 200);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, detalle: "el plan gratuito de Lusha no incluye API — se necesita plan Pro" };
    }
    if (res.status === 404) return { ok: false, detalle: "no tiene a esta persona en su base" };
    return { ok: false, detalle: `error ${res.status}: ${cuerpo}` };
  }
  const data = await res.json();
  const d = data?.data ?? data;
  const bruto = d?.phoneNumbers ?? d?.phones ?? [];
  const lista = Array.isArray(bruto) ? bruto : [bruto];
  let telefono: string | null = null;
  for (const item of lista) {
    telefono =
      telefonoUtil(typeof item === "string" ? item : item?.number ?? item?.internationalNumber ?? item?.value);
    if (telefono) break;
  }
  const correos = d?.emailAddresses ?? d?.emails ?? [];
  const listaMail = Array.isArray(correos) ? correos : [correos];
  const email =
    listaMail
      .map((e: any) => (typeof e === "string" ? e : e?.email ?? e?.address ?? e?.value))
      .find((e: any) => typeof e === "string" && e.includes("@")) ?? null;

  return {
    ok: !!telefono,
    detalle: telefono ? "teléfono encontrado" : "tiene la persona, pero sin teléfono",
    telefono,
    email,
    nombre: d?.fullName ?? ([d?.firstName, d?.lastName].filter(Boolean).join(" ") || null),
    cargo: d?.jobTitle ?? null,
    empresa: d?.company?.name ?? null,
    creditos: data?.creditsCharged ?? data?.billing?.creditsCharged ?? 0,
  };
}

export async function telefonoPorLinkedin(url: string): Promise<ResultadoTelefono> {
  const base: ResultadoTelefono = {
    encontrado: false, telefono: null, email: null, nombre: null, cargo: null,
    empresa: null, fuente: null, creditos: 0, intentos: [], cuenta: null, motivo: null,
  };

  const perfil = normalizarPerfil(url);
  if (!perfil) {
    return { ...base, motivo: "Eso no parece un perfil de LinkedIn. Se espera algo como linkedin.com/in/nombre-apellido." };
  }

  const proveedores: [FuenteTelefono, (p: string) => Promise<any>][] = [
    ["apollo", porApollo],
    ["lusha", porLusha],
  ];

  const acumulado = { ...base };
  for (const [fuente, fn] of proveedores) {
    let r: any;
    try {
      r = await fn(perfil);
    } catch (e: any) {
      acumulado.intentos.push({ fuente, resultado: `falló: ${e?.message ?? e}` });
      continue;
    }
    acumulado.intentos.push({ fuente, resultado: r.detalle });
    acumulado.creditos += r.creditos ?? 0;
    // Aunque no haya teléfono, si el proveedor devolvió nombre/cargo/correo
    // eso ya vale: es más de lo que había antes de preguntar.
    acumulado.nombre ??= r.nombre ?? null;
    acumulado.cargo ??= r.cargo ?? null;
    acumulado.empresa ??= r.empresa ?? null;
    acumulado.email ??= r.email ?? null;
    if (r.ok && r.telefono) {
      return { ...acumulado, encontrado: true, telefono: r.telefono, fuente, cuenta: r.cuenta ?? null };
    }
  }

  const sinLlaves = acumulado.intentos.every((i) => i.resultado.includes("sin ") && i.resultado.includes("_API_KEY"));
  return {
    ...acumulado,
    motivo: sinLlaves
      ? "No hay ningún proveedor configurado. Falta cargar APOLLO_API_KEY o LUSHA_API_KEY en las variables de entorno."
      : acumulado.email || acumulado.nombre
        ? "Ninguno de los proveedores tiene el teléfono de esta persona, pero sí devolvieron algo de su ficha."
        : "Ninguno de los proveedores tiene a esta persona.",
  };
}
