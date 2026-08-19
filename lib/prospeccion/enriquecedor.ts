/**
 * ENRIQUECEDOR en cascada — halla contacto directo del prospecto.
 *
 * Objetivo: para un negocio del que ya tenemos nombre/web/rubro, encontrar
 * nombre del dueño, email directo y perfil de LinkedIn. Estrategia en cascada
 * (cada fuente rellena lo que falta; si una falla, sigue la siguiente):
 *
 *   1. Web propia   → mailto: y emails en el HTML (gratis, alta confianza).
 *   2. Serper.dev   → "dueño {empresa} {rubro} Chile" + "{empresa} linkedin"
 *                     (2.500 búsquedas/mes gratis) → nombre + URL de LinkedIn.
 *   3. Hunter.io    → domain-search sobre el dominio (25/mes gratis) → email.
 *   4. Patrón       → nombre@dominio como ÚLTIMO recurso (confianza baja).
 *
 * No usa Apify ni Puppeteer: nada que scrapee LinkedIn logueado (riesgo de
 * baneo). Solo APIs públicas y HTML público. Nunca lanza: devuelve lo que
 * pudo hallar + un nivel de confianza honesto.
 */

export interface ContactoHallado {
  nombre: string | null;
  email: string | null;
  linkedin: string | null;
  /** alta = en su web/verificado · media = Hunter/Serper · baja = patrón. */
  confianza: "alta" | "media" | "baja" | null;
  fuentes: string[];
}

const TIMEOUT_MS = 9000;

async function fetchTexto(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-CL,es;q=0.9",
      },
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 400_000);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Emails basura que NO son contacto real del negocio.
const EMAIL_BASURA =
  /(example|sentry|wixpress|\.png|\.jpg|\.gif|@2x|domain\.com|email\.com|tuemail|correo@)/i;

function dominioDe(web: string | null): string | null {
  if (!web) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(web) ? web : `https://${web}`);
    const h = u.hostname.replace(/^www\./, "");
    if (/facebook|instagram|linktr\.ee|wa\.me/i.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

/** 1) Emails en la web propia del negocio (alta confianza). */
async function emailsDeWeb(web: string | null, dominio: string | null): Promise<string[]> {
  if (!web) return [];
  const html = await fetchTexto(/^https?:\/\//i.test(web) ? web : `https://${web}`);
  if (!html) return [];
  const encontrados = new Set<string>();
  for (const raw of html.match(EMAIL_RE) ?? []) {
    const e = raw.toLowerCase();
    if (EMAIL_BASURA.test(e)) continue;
    // Prioriza emails del mismo dominio; guarda también gmail/outlook del negocio.
    if (!dominio || e.endsWith(`@${dominio}`) || /@(gmail|hotmail|outlook|yahoo)\./.test(e)) {
      encontrados.add(e);
    }
  }
  // Orden: mismo dominio primero.
  return [...encontrados].sort((a, b) => {
    const am = dominio && a.endsWith(`@${dominio}`) ? 0 : 1;
    const bm = dominio && b.endsWith(`@${dominio}`) ? 0 : 1;
    return am - bm;
  });
}

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
}

/** Llama a Serper.dev (Google). Devuelve resultados orgánicos o []. */
async function serper(q: string): Promise<SerperOrganic[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "cl", hl: "es", num: 10 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.organic ?? []) as SerperOrganic[];
  } catch {
    return [];
  }
}

/** 2) Serper: LinkedIn del negocio/dueño + posible nombre de persona. */
async function porSerper(
  nombre: string,
  rubro: string | null,
  comuna: string | null,
): Promise<{ nombre: string | null; linkedin: string | null }> {
  const lugar = comuna ? ` ${comuna}` : "";
  const queries = [
    `"${nombre}"${lugar} linkedin`,
    `dueño OR gerente "${nombre}" ${rubro ?? ""} Chile`,
  ];
  let linkedin: string | null = null;
  let persona: string | null = null;

  for (const q of queries) {
    const res = await serper(q);
    for (const r of res) {
      const link = r.link ?? "";
      // Perfil de persona (/in/) tiene prioridad sobre página de empresa (/company/).
      if (/linkedin\.com\/in\//i.test(link) && !linkedin) {
        linkedin = link.split("?")[0];
        // El título de LinkedIn suele ser "Nombre Apellido - Cargo | LinkedIn".
        const m = (r.title ?? "").match(/^([^\-|·]+?)\s*[-|·]/);
        if (m) persona = m[1].trim();
      } else if (/linkedin\.com\/company\//i.test(link) && !linkedin) {
        linkedin = link.split("?")[0];
      }
    }
    if (linkedin && persona) break;
  }
  return { nombre: persona, linkedin };
}

/** 3) Hunter.io domain-search: emails asociados al dominio (media confianza). */
async function porHunter(
  dominio: string | null,
): Promise<{ email: string | null; nombre: string | null }> {
  const key = process.env.HUNTER_API_KEY;
  if (!key || !dominio) return { email: null, nombre: null };
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(dominio)}&limit=5&api_key=${key}`,
    );
    if (!res.ok) return { email: null, nombre: null };
    const data = await res.json();
    const emails: any[] = data?.data?.emails ?? [];
    // Prioriza roles de decisión (owner/ceo/manager) y luego el genérico.
    const rank = (e: any) =>
      /owner|ceo|founder|director|gerente|manager/i.test(
        `${e?.position ?? ""} ${e?.department ?? ""}`,
      )
        ? 0
        : 1;
    emails.sort((a, b) => rank(a) - rank(b));
    const top = emails[0];
    if (!top?.value) return { email: null, nombre: null };
    const nombre =
      top.first_name || top.last_name
        ? `${top.first_name ?? ""} ${top.last_name ?? ""}`.trim()
        : null;
    return { email: String(top.value).toLowerCase(), nombre };
  } catch {
    return { email: null, nombre: null };
  }
}

/** Orquesta la cascada para UN prospecto. Nunca lanza. */
export async function enriquecerContacto(p: {
  nombre: string;
  rubro: string | null;
  comuna: string | null;
  web: string | null;
}): Promise<ContactoHallado> {
  const out: ContactoHallado = {
    nombre: null,
    email: null,
    linkedin: null,
    confianza: null,
    fuentes: [],
  };
  const dominio = dominioDe(p.web);

  // 1) Web propia (mejor fuente de email).
  const webEmails = await emailsDeWeb(p.web, dominio);
  if (webEmails.length) {
    out.email = webEmails[0];
    out.confianza = "alta";
    out.fuentes.push("web");
  }

  // 2) Serper → LinkedIn + nombre.
  const s = await porSerper(p.nombre, p.rubro, p.comuna);
  if (s.linkedin) {
    out.linkedin = s.linkedin;
    out.fuentes.push("serper");
  }
  if (s.nombre && !out.nombre) out.nombre = s.nombre;

  // 3) Hunter → email si aún no hay (media confianza).
  if (!out.email) {
    const h = await porHunter(dominio);
    if (h.email) {
      out.email = h.email;
      out.confianza = "media";
      out.fuentes.push("hunter");
    }
    if (h.nombre && !out.nombre) out.nombre = h.nombre;
  }

  // 4) Patrón nombre@dominio (último recurso, confianza baja).
  if (!out.email && out.nombre && dominio) {
    const primer = out.nombre
      .split(/\s+/)[0]
      ?.toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (primer && /^[a-z]+$/.test(primer)) {
      out.email = `${primer}@${dominio}`;
      out.confianza = "baja";
      out.fuentes.push("patron");
    }
  }

  return out;
}
