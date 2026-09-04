/**
 * Leer el sitio de un negocio y sacar de ahí lo que se pueda.
 *
 * Vive aparte porque dos lugares lo necesitan y ya estaba duplicado: la cascada
 * de teléfonos, para buscar un número junto al nombre del decisor, y el alta
 * manual de leads, para adivinar el rubro cuando pegas una URL. Dos copias de
 * la misma función se desincronizan — es exactamente lo que acaba de pasar con
 * el formulario y su endpoint.
 */

import { geminiJson } from "@/lib/gemini";
import { pareceEmail, pareceTelefono } from "@/lib/validarContacto";

/**
 * Destinos que este lector NUNCA debe pedir.
 *
 * El motivo: este módulo hace que el SERVIDOR descargue una dirección que
 * alguien escribió en un formulario. Sin este filtro, escribir
 * `http://169.254.169.254/` haría que la función de Vercel se pidiera a sí
 * misma las credenciales internas de la nube y las devolviera como "texto del
 * sitio". Se llama SSRF y es de los errores más caros que se pueden dejar en un
 * endpoint que acepta URLs.
 *
 * El endpoint ya está detrás del Basic Auth de HQ, así que solo alguien con
 * sesión podría intentarlo — pero "solo el equipo puede romperlo" no es una
 * defensa, es una suposición sobre quién tiene la clave.
 *
 * La regla más fuerte y más simple: el sitio de un negocio SIEMPRE tiene
 * nombre de dominio. Nunca es una IP pelada. Con eso se cierra casi todo.
 */
const HOST_PROHIBIDO =
  /^(localhost|.*\.local|.*\.internal|metadata\..*|.*\.localdomain)$/i;

function destinoPermitido(u: URL): boolean {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (HOST_PROHIBIDO.test(host)) return false;
  // IP pelada (v4 o v6) → fuera. Un negocio no publica su sitio así.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.includes(":")) return false; // IPv6
  // Tiene que parecer un dominio de verdad.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host)) return false;
  return true;
}

/** 4 MB de HTML es muchísimo para una portada; más que eso es otra cosa. */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Baja la portada y la convierte en texto plano.
 *
 * Nunca lanza: un sitio caído es un dato ("no se pudo leer"), no un error de la
 * corrida. Devuelve null cuando no hay nada legible.
 *
 * Lo que queda fuera del alcance, y lo digo para que quede escrito: se siguen
 * las redirecciones, así que un dominio válido que redirija a una dirección
 * interna se colaría. Cerrarlo obliga a resolver cada salto a mano. Con el
 * endpoint detrás del login y un equipo de cuatro personas, el riesgo no
 * justifica esa complejidad hoy — pero si algún día esto se expone sin sesión,
 * hay que arreglarlo ANTES.
 */
/**
 * Baja el HTML CRUDO de una página, con todas las guardas puestas.
 *
 * Se separó de `textoDeLaWeb` el 4-sep-2026 porque el HTML sin tocar contiene
 * exactamente lo que más vale y que el texto plano destruye: los `href` de
 * `wa.me`, los `tel:`, y el JSON-LD de schema.org donde el negocio declara su
 * propio teléfono. Convertir a texto primero y buscar números después es
 * quedarse con la parte pobre del dato.
 *
 * Ojo: esta es la ÚNICA función que debería descargar sitios de terceros.
 * `enriquecimiento.ts` tenía su propio `fetchHtml` sin ninguna guarda —
 * cualquier URL, incluida una interna. Ahora usa esta.
 */
export async function htmlDeLaWeb(web: string, maxMs = 12_000): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(web) ? web : `https://${web}`);
  } catch {
    return null;
  }
  if (!destinoPermitido(url)) return null;
  // Una red social devuelve el cascarón de su aplicación, no el perfil. Leer
  // eso y extraerle números produce datos inventados con cara de verdaderos.
  if (/facebook\.com|instagram\.com|linktr\.ee|tiktok\.com|youtube\.com|x\.com|twitter\.com/i.test(url.hostname)) return null;

  try {
    const ctrl = new AbortController();
    const corte = setTimeout(() => ctrl.abort(), maxMs);
    const r = await fetch(url.href, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RespondoHQ/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-CL,es;q=0.9",
      },
    });

    try {
      if (!r.ok) return null;
      const tipo = r.headers.get("content-type") ?? "";
      if (!/text\/html|application\/xhtml/i.test(tipo)) return null;

      // Se corta por tamaño MIENTRAS se lee, no después. Con `r.text()` a secas,
      // un archivo de 500 MB entraba entero a memoria antes de recortarlo — y la
      // función tiene 2 GB para todo.
      const declarado = Number(r.headers.get("content-length") ?? 0);
      if (declarado > MAX_BYTES) return null;

      const lector = r.body?.getReader();
      if (!lector) return null;
      const trozos: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        if (!value) continue;
        total += value.length;
        if (total > MAX_BYTES) {
          await lector.cancel();
          break;
        }
        trozos.push(value);
      }
      return new TextDecoder("utf-8", { fatal: false }).decode(
        await new Blob(trozos as BlobPart[]).arrayBuffer(),
      );
    } finally {
      clearTimeout(corte);
    }
  } catch {
    return null;
  }
}

/**
 * Baja la portada y la convierte en texto plano.
 *
 * Nunca lanza: un sitio caído es un dato ("no se pudo leer"), no un error de la
 * corrida. Devuelve null cuando no hay nada legible.
 *
 * Lo que queda fuera del alcance, y lo digo para que quede escrito: se siguen
 * las redirecciones, así que un dominio válido que redirija a una dirección
 * interna se colaría. Cerrarlo obliga a resolver cada salto a mano. Con el
 * endpoint detrás del login y un equipo de cuatro personas, el riesgo no
 * justifica esa complejidad hoy — pero si algún día esto se expone sin sesión,
 * hay que arreglarlo ANTES.
 */
export async function textoDeLaWeb(web: string, maxMs = 12_000): Promise<string | null> {
  // Una red social no es un sitio que se pueda leer así: devuelve el cascarón
  // de la app, no el contenido del perfil.
  // Se agregó TikTok el 4-sep: la corrida real intentó "leer" el perfil de
  // Go Models Chile en tiktok.com y se trajo el cascarón de la aplicación, no
  // el contenido. Cualquier número sacado de ahí es basura con apariencia de
  // dato.
  if (/facebook\.com|instagram\.com|linktr\.ee|wa\.me\/|tiktok\.com|youtube\.com|x\.com|twitter\.com/i.test(web)) return null;

  const html = await htmlDeLaWeb(web, maxMs);
  if (!html) return null;

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .slice(0, 120_000);
}

// ---------------------------------------------------------------------------
// Adivinar la ficha desde el sitio
// ---------------------------------------------------------------------------

export type FichaDelSitio = {
  empresa?: string;
  industria?: string;
  comuna?: string;
  telefono?: string;
  email?: string;
  contacto?: string;
  cargo?: string;
  /** Una línea sobre por qué podría interesarles Respondo. */
  senal?: string;
};

/**
 * Lee el sitio y propone los campos de un lead.
 *
 * Se le pasa el texto de la página al modelo en vez de dejarlo buscar: el
 * contenido ya está a la vista, no hay nada que investigar, y una llamada sin
 * grounding es más rápida y más barata. Tampoco puede inventar de dónde no hay.
 *
 * Todo lo que devuelve es una PROPUESTA. Cae en el formulario para que la
 * persona la vea y la corrija antes de guardar — nada se escribe en la base sin
 * que alguien apriete "Agregar lead". Por eso acá se puede ser generoso: el
 * costo de una sugerencia equivocada es un campo que hay que borrar, no un dato
 * falso en la base.
 */
export async function fichaDesdeElSitio(web: string): Promise<{
  ok: boolean;
  ficha: FichaDelSitio;
  motivo?: string;
}> {
  const texto = await textoDeLaWeb(web);
  if (!texto || texto.length < 200) {
    return {
      ok: false,
      ficha: {},
      motivo: !texto
        ? "No se pudo abrir el sitio (puede estar caído, ser una red social, o bloquear la lectura)."
        : "El sitio se abrió pero casi no trae texto: probablemente carga todo con JavaScript.",
    };
  }

  const prompt = `Abajo va el texto de la portada del sitio de un negocio chileno.
Saca de ahí los datos de la ficha. NO inventes nada: si un dato no está en el texto,
deja el campo vacío.

Reglas:
- "industria" en dos o tres palabras y en español, como lo diría un chileno:
  "clínica dental", "centro de estética", "veterinaria", "cancha de pádel",
  "taller mecánico", "peluquería". No uses categorías genéricas tipo "salud" o "servicios".
- "empresa" es el nombre de fantasía, no la razón social.
- "comuna" solo si aparece una dirección chilena.
- "telefono" y "email" solo los de contacto general del negocio.
- "contacto" y "cargo" solo si el sitio nombra a una persona a cargo
  (dueño, director, fundador). Si solo lista profesionales sin decir quién manda, déjalos vacíos.
- "senal": una línea, máximo 20 palabras, sobre cómo atienden a sus clientes
  (si agendan por WhatsApp, si tienen reserva en línea, si dicen "escríbenos", etc.).

Empieza tu respuesta directamente con la llave de apertura. Nada de texto antes ni después.

{"empresa":"","industria":"","comuna":"","telefono":"","email":"","contacto":"","cargo":"","senal":""}

--- TEXTO DEL SITIO ---
${texto.slice(0, 12_000)}`;

  try {
    const data = await geminiJson<FichaDelSitio>(prompt, undefined, {
      temperature: 0,
      maxOutputTokens: 800,
    });
    // Se limpia lo que venga, y en dos sentidos.
    //
    // 1. Solo pasan las claves que el formulario conoce. El texto de la página
    //    es contenido ajeno: si un sitio trae instrucciones escondidas y el
    //    modelo devuelve una clave inventada, esa clave viajaría hasta el
    //    endpoint de guardado. Con lista blanca, no llega a ninguna parte.
    // 2. El modelo a veces contesta "no encontrado" o "-" en vez de dejar el
    //    campo vacío, y eso terminaría escrito en el formulario como si fuera
    //    el rubro del negocio.
    const CLAVES: (keyof FichaDelSitio)[] = [
      "empresa", "industria", "comuna", "telefono", "email", "contacto", "cargo", "senal",
    ];
    // 3. Y que cada valor tenga la FORMA del campo donde va a caer. El modelo
    //    a veces pone el nombre del negocio en "telefono" o una frase en
    //    "email", y eso aterrizaba tal cual en la casilla del formulario. El
    //    usuario después lo guardaba sin mirar, porque venía "del sitio".
    const limpio: FichaDelSitio = {};
    for (const k of CLAVES) {
      const s = String((data as Record<string, unknown>)?.[k] ?? "").trim();
      if (!s || /^(no|n\/a|na|-|sin|null|none|no encontrado|no aparece|no especificado)$/i.test(s)) continue;
      if (k === "telefono" && !pareceTelefono(s)) continue;
      if (k === "email" && !pareceEmail(s)) continue;
      limpio[k] = s.slice(0, 300);
    }
    return { ok: true, ficha: limpio };
  } catch (e) {
    return {
      ok: false,
      ficha: {},
      motivo: `El sitio se leyó pero el análisis falló: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
