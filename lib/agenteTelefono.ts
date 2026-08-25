import { geminiJsonConFuentes } from "@/lib/gemini";
import { normalizarTelefono } from "@/lib/actividades";

/**
 * AGENTE DE TELÉFONO DIRECTO — buscar el número de la PERSONA, no del mesón.
 *
 * El problema: el número de Google Maps es la línea PÚBLICA del negocio: la que contesta quien esté en el mesón. Sirve para
 * entrar, pero la secretaria filtra. Lo que mueve la venta es el número donde
 * contesta quien decide.
 *
 * La idea que hace que esto funcione: una vez que sabemos el NOMBRE del dueño
 * —y de 1.100 empresas ya lo sabemos, sacado de la razón social del SII— se
 * puede dejar de buscar la empresa y empezar a buscar a la persona. Y en
 * salud eso rinde, porque el profesional suele tener presencia propia:
 * su ficha en Doctoralia o SAVALnet, su consulta particular con teléfono
 * aparte, y muchas veces hasta su PROPIO registro en Google Maps
 * ("Dr. Marcelo Guardia") separado del de la clínica.
 *
 * Tres pasadas, de la más barata a la más cara:
 *   1. Google Maps por el NOMBRE de la persona + comuna. Si tiene consulta
 *      propia, ahí está su número y no es el del mesón.
 *   2. La web del negocio, mirando qué teléfono está CERCA del nombre de la
 *      persona — no el del pie de página, que es el general.
 *   3. Búsqueda con IA sobre fuentes públicas, obligada a citar de dónde sacó
 *      cada número. Sin cita, se descarta.
 *
 * Nada de esto scrapea LinkedIn ni compra bases. Y todo número que sale de
 * acá viene con su fuente, porque la Ley 21.719 exige poder decir de dónde
 * salió un dato personal.
 */

/**
 * De quién es el número. `publico` es el que el negocio publica para que lo
 * llamen — lo único que se puede afirmar sin haber llamado. Que sea celular
 * NO lo convierte en el del dueño: basta una secretaria para que sea de ella,
 * y de hecho esa línea pública es justamente la que Respondo viene a atender.
 */
export type TipoNumero = "publico" | "recepcion" | "directo" | "movil_personal" | "desconocido";

export interface HallazgoTelefono {
  telefono: string;
  tipo: TipoNumero;
  /** Qué tan seguro es que sea de la persona y no del mesón. */
  confianza: "alta" | "media" | "baja";
  fuente: string;
  comoLoSupe: string;
}

export interface ResultadoAgente {
  persona: string;
  hallazgos: HallazgoTelefono[];
  /** El mejor candidato, o null si solo apareció el número que ya teníamos. */
  mejor: HallazgoTelefono | null;
  traza: string[];
}

/**
 * Cosas que llevan nombre de persona pero no son la persona. En Chile media
 * ciudad se llama como alguien: el agente devolvió el "Colegio Universitario
 * Antonio Rendic" como si fuera el teléfono del doctor Rendic.
 */
const NO_ES_LA_PERSONA =
  /colegio|escuela|liceo|universidad|instituto profesional|fundacion|corporacion|municipalidad|plaza|parque|avenida|poblacion|villa|estadio|biblioteca|museo|iglesia|parroquia|hospital regional|consultorio municipal|cesfam/i;

/** Rubros donde tiene sentido que atienda un profesional de salud o estética. */
const RUBRO_PLAUSIBLE =
  /dental|dentista|odont|medic|clinic|salud|oftal|optic|veterinar|estetic|kinesi|fisioterap|laborator|radiolog|belleza|peluquer|masaj|psicolog|nutricion|dermatolog|consulta|doctor|centro/i;

const PLACES = "https://places.googleapis.com/v1/places:searchText";
const MASK =
  "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.primaryTypeDisplayName";

/** Un celular chileno (9xxxxxxxx) casi nunca es el mesón. */
function esCelular(t: string): boolean {
  const d = normalizarTelefono(t);
  return /^9\d{8}$/.test(d);
}

function clasificar(tel: string, telefonoConocido?: string | null): TipoNumero {
  const nuevo = normalizarTelefono(tel);
  const viejo = normalizarTelefono(telefonoConocido ?? "");
  // Si es el mismo que ya publicaba el negocio, es la línea pública: no aporta.
  if (viejo && nuevo === viejo) return "publico";
  // Un número DISTINTO del publicado, encontrado junto al nombre de la
  // persona, sí es un hallazgo. Si además es celular, es su móvil.
  return esCelular(tel) ? "movil_personal" : "directo";
}

/**
 * 1) ¿La persona tiene su propia ficha en Google Maps?
 *
 * Exportada (25-ago-2026) para que la cascada de la Fase 2 pueda decidir
 * CUÁNDO llamarla. `buscarTelefonoDirecto` la corre siempre y de primera, pero
 * consume cupo de Places (1.000 gratis al mes); la cascada la deja para después
 * de la web, que es gratis, y se la salta cuando el cortacircuitos dice que no
 * queda cupo.
 */
export async function telefonoPorMapsDeLaPersona(
  persona: string,
  comuna: string,
  telefonoConocido?: string | null,
): Promise<HallazgoTelefono | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const r = await fetch(PLACES, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": MASK },
    body: JSON.stringify({ textQuery: `${persona}, ${comuna}, Chile`, languageCode: "es", maxResultCount: 4 }),
  });
  if (!r.ok) return null;
  const data = await r.json();

  const apellidos = persona
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .split(/\s+/).filter((w) => w.length >= 4);

  for (const p of data.places ?? []) {
    const nom = String(p.displayName?.text ?? "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    // Al menos dos partes del nombre tienen que estar en la ficha: con una
    // sola, "Clínica Santa María" calzaría con cualquier María.
    const coinciden = apellidos.filter((a) => nom.includes(a)).length;
    if (coinciden < 2 || !p.nationalPhoneNumber) continue;
    const etiqueta = `${p.displayName?.text ?? ""} ${p.primaryTypeDisplayName?.text ?? ""}`;
    if (NO_ES_LA_PERSONA.test(etiqueta)) continue;
    if (!RUBRO_PLAUSIBLE.test(etiqueta)) continue;
    // Y tiene que atender en la misma comuna: un homónimo en otra ciudad no
    // es la persona que buscamos.
    const dir = String(p.formattedAddress ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    if (!dir.includes(comuna.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase())) continue;
    const tipo = clasificar(p.nationalPhoneNumber, telefonoConocido);
    if (tipo === "publico") continue; // es el mismo que ya teníamos, no aporta
    return {
      telefono: p.nationalPhoneNumber,
      tipo,
      confianza: "alta",
      fuente: `Google Maps · ficha propia "${p.displayName?.text}"`,
      comoLoSupe: "la persona tiene su propio registro en Maps, distinto al de la clínica",
    };
  }
  return null;
}

/** 2) En la web del negocio, ¿hay un teléfono pegado al nombre de la persona? */
export function telefonoCercaDelNombre(
  textoWeb: string,
  persona: string,
  telefonoConocido?: string | null,
): HallazgoTelefono | null {
  const t = textoWeb.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const nombre = persona.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const partes = nombre.split(/\s+/).filter((w) => w.length >= 4);
  if (partes.length < 2) return null;

  const TEL = /(?:\+?56)?\s*(?:\(?\d{1,2}\)?[\s.-]?)?\d{4}[\s.-]?\d{4}|9\d{8}/g;
  const posNombre: number[] = [];
  const re = new RegExp(partes.slice(0, 2).join("\\s+"), "gi");
  for (const m of t.matchAll(re)) posNombre.push(m.index ?? 0);
  if (!posNombre.length) return null;

  for (const m of t.matchAll(TEL)) {
    const pos = m.index ?? 0;
    // 300 caracteres: el largo de una ficha de profesional. Más lejos que eso
    // ya es otro bloque de la página y probablemente el teléfono general.
    const cerca = posNombre.some((p) => Math.abs(p - pos) < 300);
    if (!cerca) continue;
    const tel = m[0].trim();
    if (normalizarTelefono(tel).length < 8) continue;
    const tipo = clasificar(tel, telefonoConocido);
    if (tipo === "publico") continue;
    return {
      telefono: tel,
      tipo,
      confianza: esCelular(tel) ? "alta" : "media",
      fuente: "sitio del negocio, junto a su nombre",
      comoLoSupe: "el número aparece en el mismo bloque que la persona, no en el pie de página",
    };
  }
  return null;
}

/**
 * 3) Búsqueda pública con IA, obligada a citar.
 *
 * Exportada por el mismo motivo que la de arriba: es el paso más caro y el que
 * más se puede equivocar, así que quien la llama tiene que poder decidir si
 * corresponde gastarla.
 */
export async function telefonoPorBusquedaPublica(
  persona: string,
  empresa: string,
  comuna: string,
  telefonoConocido?: string | null,
): Promise<HallazgoTelefono | null> {
  const prompt = `Busca el teléfono de contacto PROFESIONAL de esta persona en Chile.

Persona: ${persona}
Trabaja en: ${empresa}
Comuna: ${comuna}

Reglas que no puedes romper:
- Usa google_search. NO respondas de memoria.
- Solo sirve un teléfono que esté publicado en una página pública que puedas citar
  (su ficha profesional, el sitio de su consulta, un directorio médico, su perfil en
  Doctoralia/SAVALnet/AgendaPro, prensa). 
- Si el único teléfono que encuentras es el de la recepción de la empresa, responde
  encontrado:false. Buscamos el contacto de la persona, no el conmutador.
- Si no hay una fuente pública real, responde encontrado:false. NUNCA inventes un
  número ni completes dígitos que no viste.

Responde SOLO este JSON:
{"encontrado":true|false,"telefono":"...","donde":"qué página lo publica","es_directo":true|false}`;

  try {
    const { data, fuentes } = await geminiJsonConFuentes<{
      encontrado?: boolean; telefono?: string; donde?: string; es_directo?: boolean;
    }>(prompt, [{ google_search: {} }], { temperature: 0, maxOutputTokens: 600 });

    if (!data?.encontrado || !data.telefono) return null;
    if (normalizarTelefono(data.telefono).length < 8) return null;
    const tipo = clasificar(data.telefono, telefonoConocido);
    if (tipo === "publico") return null;
    // Sin fuente citada no se confía: el modelo pudo completar el número.
    const conFuente = fuentes.length > 0;
    return {
      telefono: data.telefono,
      tipo,
      confianza: conFuente ? "media" : "baja",
      fuente: conFuente ? `${data.donde ?? "búsqueda pública"} · ${fuentes[0]?.url ?? ""}` : "búsqueda sin fuente citada",
      comoLoSupe: conFuente
        ? "publicado en una página pública que se pudo citar"
        : "la búsqueda no citó fuente: hay que confirmarlo antes de usarlo",
    };
  } catch {
    return null;
  }
}

export async function buscarTelefonoDirecto(entrada: {
  persona: string;
  empresa: string;
  comuna: string;
  /** El número que ya tenemos, para saber cuál es el del mesón. */
  telefonoConocido?: string | null;
  /** Texto ya descargado del sitio, si lo hay, para no bajarlo de nuevo. */
  textoWeb?: string | null;
}): Promise<ResultadoAgente> {
  const traza: string[] = [];
  const hallazgos: HallazgoTelefono[] = [];

  const enMaps = await telefonoPorMapsDeLaPersona(entrada.persona, entrada.comuna, entrada.telefonoConocido);
  traza.push(enMaps ? `Maps de la persona → ${enMaps.telefono}` : "Maps de la persona → nada distinto al mesón");
  if (enMaps) hallazgos.push(enMaps);

  if (entrada.textoWeb) {
    const enWeb = telefonoCercaDelNombre(entrada.textoWeb, entrada.persona, entrada.telefonoConocido);
    traza.push(enWeb ? `web junto al nombre → ${enWeb.telefono}` : "web → no hay teléfono junto a su nombre");
    if (enWeb) hallazgos.push(enWeb);
  }

  // La búsqueda con IA es la más cara y la que más puede equivocarse: solo se
  // usa cuando las dos gratis no encontraron nada.
  if (!hallazgos.length) {
    const enBusqueda = await telefonoPorBusquedaPublica(
      entrada.persona, entrada.empresa, entrada.comuna, entrada.telefonoConocido,
    );
    traza.push(enBusqueda ? `búsqueda pública → ${enBusqueda.telefono}` : "búsqueda pública → nada citable");
    if (enBusqueda) hallazgos.push(enBusqueda);
  }

  const orden = { alta: 0, media: 1, baja: 2 } as const;
  hallazgos.sort((a, b) => orden[a.confianza] - orden[b.confianza]);
  return { persona: entrada.persona, hallazgos, mejor: hallazgos[0] ?? null, traza };
}
