/**
 * DECISOR, segunda fuente: la web del propio negocio.
 *
 * Complementa a `decisor.ts`. La razón social nombra al dueño en el 7% de los
 * casos —cuando la empresa es una EIRL o una "X y Compañía"—; el resto de las
 * veces la empresa tiene nombre de fantasía y hay que ir a mirar su sitio.
 *
 * Medido sobre 30 sitios reales de la base: 53% publica al menos un
 * profesional con nombre y apellido, 7% declara además un cargo de decisión.
 * O sea que el sitio casi siempre dice QUIÉNES trabajan ahí, y casi nunca
 * dice cuál manda. Por eso acá no se adivina el cargo: se devuelven las
 * personas encontradas y se marca la confianza según lo que el sitio diga.
 *
 * Solo se visita el dominio del propio negocio, siguiendo los links que él
 * mismo publica hacia su página de equipo. Nada de terceros, nada de
 * LinkedIn, nada de redes: es información que el negocio puso en su casa
 * para que la lean.
 */

const LINKS_EQUIPO =
  /href="([^"]*(?:equipo|nosotros|quienes-?somos|quienessomos|profesionales|especialistas|staff|doctores|dentistas|nuestro-?equipo|about|team)[^"]*)"/gi;

/**
 * Abreviaturas: llevan punto y el nombre viene justo después ("Dr. Pedro").
 * Palabras completas: NO pueden llevar punto, porque un punto ahí cierra la
 * frase y lo que sigue es otra cosa. Ese detalle producía los peores falsos
 * positivos: "...atención médica. Manuel Barros Borgoño 245..." entregaba la
 * CALLE como si fuera el dueño, y lo mismo con "Escuela Militar" y "Juan
 * Antonio Ríos", que son direcciones de Santiago con nombre de persona.
 */
const TITULO_ABREV = "(?:Dr|Dra|Klgo|Klga|MV|Lic|Prof|Od)";
const TITULO_PALABRA =
  "(?:Doctor|Doctora|Odontólog[oa]|Odontolog[oa]|Dentista|Kinesiólog[oa]|Médic[oa]|Medic[oa]|Cirujan[oa]|Nutricionista|Psicólog[oa]|Fonoaudiólog[oa]|Matron[ae]|Tecnólog[oa]|Veterinari[oa])";
const NOMBRE =
  "[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\\s+(?:de|del|la|los)?\\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}){1,3}";
const CON_TITULO = new RegExp(
  `\\b(?:${TITULO_ABREV}\\.?\\s+|${TITULO_PALABRA}\\s+)(${NOMBRE})`,
  "g",
);

/** Cargos que sí indican quién decide. */
const CARGO_MANDA =
  /\b(due[ñn][oa]|propietari[oa]|soci[oa]\b|fundador[a]?|cofundador[a]?|director[a]?(?:\s+(?:m[eé]dic[oa]|general|cl[ií]nic[oa]|ejecutiv[oa]|t[eé]cnic[oa]))?|gerente(?:\s+general)?|administrador[a]?|jefe[a]?\s+de\s+[a-zá-ú]+|encargad[oa])\b/i;

import { pareceNombreDePersona, podarNombre, ES_DIRECCION } from "@/lib/nombrePersona";

const TIMEOUT_MS = 9000;
const MAX_PAGINAS = 4;

export interface PersonaWeb {
  nombre: string;
  /** Cuántas veces aparece en el sitio. Una sola vez suele ser una calle. */
  menciones: number;
  /** Cargo tal como lo dice el sitio, si lo dice. */
  cargo: string | null;
  /** Página exacta donde apareció — hace falta para poder auditarlo. */
  fuente: string;
}

export interface ResultadoDecisorWeb {
  visitada: boolean;
  paginas: number;
  personas: PersonaWeb[];
  /** La que más parece mandar, o null si el sitio no lo dice. */
  probableDecisor: PersonaWeb | null;
  motivo: string;
}

async function bajar(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-CL,es;q=0.9",
      },
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "";
    if (ct && !ct.includes("html")) return null;
    return (await r.text()).slice(0, 1_500_000);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** ¿El "nombre" es en realidad parte de la dirección del negocio? */
function enLaDireccion(nombre: string, direccion?: string | null): boolean {
  if (!direccion?.trim()) return false;
  const dir = direccion.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const toks = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().split(/\s+/);
  const dentro = toks.filter((t) => t.length >= 4 && dir.includes(t)).length;
  return dentro >= 2;
}

function aTexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú").replace(/&ntilde;/g, "ñ")
    .replace(/\s+/g, " ");
}

export async function decisorDeWeb(
  web: string | null,
  /**
   * Dirección conocida del negocio. Es el mejor filtro contra calles: en Chile
   * muchas llevan nombre de persona y hasta el título — el Instituto
   * Radiológico queda en "Dr. Manuel Barros Borgoño 245", que el extractor lee
   * como un doctor. Si el nombre aparece dentro de la dirección, es la calle.
   */
  direccion?: string | null,
): Promise<ResultadoDecisorWeb> {
  const vacio: ResultadoDecisorWeb = {
    visitada: false, paginas: 0, personas: [], probableDecisor: null, motivo: "sin web",
  };
  if (!web?.trim()) return vacio;
  // Una red social no es la web del negocio: ahí no hay página de equipo.
  if (/facebook\.com|instagram\.com|linktr\.ee|wa\.me\//i.test(web)) {
    return { ...vacio, motivo: "su web es una red social" };
  }

  const url = /^https?:\/\//i.test(web) ? web : `https://${web}`;
  const home = await bajar(url);
  if (!home) return { ...vacio, motivo: "no se pudo abrir el sitio" };

  let base: URL;
  try { base = new URL(url); } catch { return { ...vacio, motivo: "url inválida" }; }

  const paginas: { html: string; url: string }[] = [{ html: home, url }];
  const vistos = new Set<string>();
  for (const m of home.matchAll(LINKS_EQUIPO)) {
    if (paginas.length >= MAX_PAGINAS) break;
    try {
      const u = new URL(m[1], base);
      if (u.hostname !== base.hostname && !u.hostname.endsWith(`.${base.hostname}`)) continue;
      if (vistos.has(u.href) || /\.(pdf|jpe?g|png|webp|svg)$/i.test(u.pathname)) continue;
      vistos.add(u.href);
      const h = await bajar(u.href);
      if (h) paginas.push({ html: h, url: u.href });
    } catch { /* link roto */ }
  }

  const encontradas = new Map<string, PersonaWeb>();
  for (const pag of paginas) {
    const t = aTexto(pag.html);
    for (const m of t.matchAll(CON_TITULO)) {
      const nombre = podarNombre(m[1].replace(/\s+/g, " ").trim());
      // Filtro duro: menús, rubros y calles se leen igual que un nombre.
      // "Manuel Barros Borgoño" es la calle del Instituto Radiológico, no su
      // dueño; "Inicio Nosotros Servicios" es la barra de navegación.
      if (!pareceNombreDePersona(nombre)) continue;
      const desde = Math.max(0, (m.index ?? 0) - 100);
      const ctx = t.slice(desde, (m.index ?? 0) + m[0].length + 100);
      const antes = t.slice(Math.max(0, (m.index ?? 0) - 45), m.index ?? 0);
      if (ES_DIRECCION.test(antes)) continue;
      if (enLaDireccion(nombre, direccion)) continue;
      // Una calle chilena suele llamarse como una persona ("Manuel Barros
      // Borgoño"). El delator es el número de la dirección justo después.
      const despues = t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 24);
      if (/^[\s,.]*(?:n[°º]|#)?\s*\d{2,5}\b/.test(despues)) continue;
      const c = ctx.match(CARGO_MANDA);
      const prev = encontradas.get(nombre);
      if (prev) {
        prev.menciones++;
        if (c && !prev.cargo) prev.cargo = c[1];
      } else {
        encontradas.set(nombre, { nombre, menciones: 1, cargo: c ? c[1] : null, fuente: pag.url });
      }
    }
  }

  const personas = [...encontradas.values()];
  const conCargo = personas.filter((p) => p.cargo);
  // Si el sitio nombra un cargo de decisión, esa persona es la apuesta.
  // Si lista a diez profesionales sin cargos, NO se elige uno al azar: en una
  // clínica de diez dentistas el primero de la lista no es el dueño.
  // Una persona del equipo aparece varias veces —en el listado, en su ficha,
  // en el pie—. Una calle aparece una sola vez. Por eso un nombre suelto sin
  // cargo no se promueve a decisor: queda como candidato para que lo elija
  // una persona.
  const solido = (p: PersonaWeb) => !!p.cargo || p.menciones >= 2;
  const probableDecisor =
    conCargo.length === 1
      ? conCargo[0]
      : personas.length === 1 && solido(personas[0])
        ? personas[0]
        : null;

  return {
    visitada: true,
    paginas: paginas.length,
    personas,
    probableDecisor,
    motivo: probableDecisor
      ? conCargo.length === 1
        ? `el sitio dice que es ${conCargo[0].cargo}`
        : "es la única persona nombrada, y aparece más de una vez"
      : personas.length
        ? `el sitio nombra a ${personas.length} personas pero no dice cuál decide`
        : "el sitio no nombra a nadie",
  };
}
