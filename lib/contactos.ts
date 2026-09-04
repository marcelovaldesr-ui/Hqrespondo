/**
 * CONTACTOS CON EVIDENCIA — de dónde salió cada número y qué tan creíble es.
 *
 * POR QUÉ EXISTE — 4-sep-2026
 * Medición real: de 13 llamadas a móviles de la lista, 9 no hablaron con
 * NADIE (no contesta o número equivocado). Y 68 de los 91 leads ya estaban en
 * la mejor categoría que sabíamos calcular ("celular + nombre"). O sea: el
 * problema no era ordenar mejor los números que teníamos. Los números eran
 * malos.
 *
 * LA DISTINCIÓN QUE FALTABA
 * "Celular" no es una sola cosa. Hay dos animales completamente distintos:
 *
 *   · Un móvil que una base B2B AFIRMA que pertenece a una persona. Nadie lo
 *     verificó, viene de perfiles de LinkedIn y firmas de correo, y para una
 *     pyme chilena suele estar mal atribuido o viejo.
 *   · Un número que el NEGOCIO PUBLICA él mismo para que lo contacten: el
 *     `wa.me` de su propio sitio, el `tel:` de su página de contacto, el
 *     teléfono de su ficha de Google. Ese lo mantiene él, porque de ahí le
 *     llegan clientes.
 *
 * Los dos se veían idénticos en la base: nueve dígitos partiendo en 9.
 *
 * Acá cada número deja de ser texto y pasa a ser una afirmación con respaldo:
 * qué es, dónde se vio, cómo se vio, cuándo, y cuántas fuentes independientes
 * dicen lo mismo.
 *
 * LO QUE YA TENÍAMOS Y ESTÁBAMOS TIRANDO
 * `enriquecimiento.ts` ya descarga la portada del negocio y hasta dos páginas
 * internas. Sobre ese HTML corría regex booleanos: `whatsapp_link: true`.
 * El número dentro de `wa.me/569XXXXXXXX` —el dato más confiable que existe
 * para este ICP— se descartaba. Los `tel:` se saltaban explícitamente.
 */

import { digitosCL, esCelularChileno } from "@/lib/alcance";

/** Qué ES este número, no de qué proveedor vino. */
export type TipoContacto =
  | "whatsapp_publicado"   // el negocio publica este número COMO su WhatsApp
  | "telefono_publicado"   // el negocio lo publica para que lo llamen
  | "ficha_google"         // el número de su Ficha de Empresa de Google
  | "telefono_en_texto"    // aparece escrito en su sitio, sin marcar como enlace
  | "afirmado_por_base"    // una base B2B dice que es de esta persona
  | "email";

/**
 * Cómo se obtuvo. Esto NO es "el proveedor": es el MÉTODO, que es lo que
 * determina si el dato es verificable o es una afirmación de un tercero.
 */
export type MetodoEvidencia =
  | "enlace_wa"        // <a href="wa.me/569...">
  | "enlace_tel"       // <a href="tel:+569...">
  | "schema_org"       // JSON-LD / microdatos del propio sitio
  | "enlace_mail"      // <a href="mailto:...">
  | "texto_del_sitio"  // escrito en el HTML sin marcar
  | "google_places"    // la Ficha de Empresa
  | "base_externa"     // Apollo, Lusha, un CSV
  | "a_mano";          // lo escribió una persona del equipo

export interface Evidencia {
  metodo: MetodoEvidencia;
  /** URL exacta donde se vio. Es lo que permite ir a comprobarlo a mano. */
  donde: string;
  /** ISO. Un dato de hace un año no vale lo mismo que uno de ayer. */
  cuando: string;
  /** Fragmento textual alrededor, recortado. Sirve para auditar sin re-visitar. */
  contexto?: string;
}

export interface ContactoConEvidencia {
  /** Normalizado: solo dígitos, sin código de país. La llave de comparación. */
  clave: string;
  /** Como se muestra. */
  valor: string;
  tipo: TipoContacto;
  evidencias: Evidencia[];
  /** Nombre de la persona, si el contacto está atribuido a alguien. */
  persona?: string;
  cargo?: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   EXTRACCIÓN DESDE EL SITIO DEL NEGOCIO
   ══════════════════════════════════════════════════════════════════════════ */

/** wa.me/569..., api.whatsapp.com/send?phone=569..., whatsapp://send?phone=... */
const RE_WA = /(?:wa\.me\/|api\.whatsapp\.com\/send\?[^"'>]*?phone=|whatsapp:\/\/send\?[^"'>]*?phone=)(\+?\d[\d\s\-()]{7,17})/gi;

/** <a href="tel:..."> */
const RE_TEL = /href\s*=\s*["']tel:(\+?[\d\s\-().]{7,20})["']/gi;

/** mailto: */
const RE_MAIL = /href\s*=\s*["']mailto:([^"'?>]+)/gi;

/**
 * Teléfono chileno escrito en texto. Es el más ruidoso, así que se pide
 * bastante: nueve dígitos que empiezan por 9 (móvil) o por 2-7 (fijo con
 * código de área), con separadores libres entre medio.
 *
 * OJO — la primera versión pedía `prefijo + 3-4 dígitos + 4 dígitos`, dando
 * por hecho que el código de área es de UN dígito. Eso es cierto en Santiago
 * (+56 2 2591 2340) y falso en todo el resto del país: Valparaíso es
 * +56 32 259 1234, con área de dos. La prueba lo detectó: el fijo de
 * repuestos de la tienda de motos no se extraía. Ahora se cuentan nueve
 * dígitos y da lo mismo cómo estén agrupados.
 *
 * Se exige que NO venga pegado a más dígitos, para no cortar un RUT
 * (12.345.678-9) ni un precio ($1.234.567) por la mitad.
 */
const RE_TEXTO = /(?<![\d.,\-])(\+56[\s\-.]?|56[\s\-.]?)?((?:9|[2-7])(?:[\s\-.]?\d){8})(?![\d\-])/g;

/** Lo que NUNCA es un teléfono aunque lo parezca. */
const NO_ES_TELEFONO = /\b(rut|r\.u\.t|iva|uf|utm|clp|\$|folio|c[oó]digo postal|cp\b|sku|c[oó]digo|referencia|serie|orden|pedido|factura)\b/i;

/**
 * Palabras que tienen que estar CERCA para creerle a un número suelto.
 *
 * Lo destapó la corrida real sobre pedalcity.cl: devolvió 72 "teléfonos". Son
 * SKUs, precios y códigos de producto de un catálogo — cualquier tienda en
 * línea tiene cientos de bloques de nueve dígitos.
 *
 * La regla que los separa no es el formato (son idénticos): es que un número
 * de contacto viene ACOMPAÑADO de una palabra que dice que lo es. Un código de
 * producto, no.
 */
const CERCA_DE_CONTACTO =
  /\b(tel[eé]fono|tel|fono|f[oó]no|celular|cel|m[oó]vil|whatsapp|wsp|wpp|ll[aá]ma|ll[aá]manos|cont[aá]ctanos|contacto|escr[ií]benos|atenci[oó]n|reservas?|agenda|mesa central|anexo|sucursal|ventas|soporte|consultas?)\b/i;

/** Tope de números sueltos por página. Pasado eso, es un catálogo, no un contacto. */
const MAX_TEXTO_POR_PAGINA = 6;

function contexto(html: string, indice: number, largo = 90): string {
  const desde = Math.max(0, indice - largo / 2);
  return html
    .slice(desde, desde + largo)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Códigos de área que EXISTEN en Chile. Sin esta lista, cualquier bloque de
 * nueve dígitos del HTML pasaba como teléfono.
 *
 * Lo encontró la corrida real sobre clinicaalemana.cl: salió "+56 77 316 2147"
 * y el 77 no es un código de área chileno — era un trozo de otro número del
 * HTML. Un teléfono inventado es peor que ninguno: el vendedor lo marca, no
 * existe, y anota "número equivocado" contra un lead que quizás servía.
 */
const AREAS_CHILE = new Set([
  "2",                                       // Santiago
  "32", "33", "34", "35",                    // Valparaíso
  "41", "42", "43", "45",                    // Biobío y Araucanía
  "51", "52", "53", "55", "57", "58",        // norte
  "61", "63", "64", "65", "67",              // sur y austral
  "71", "72", "73", "75",                    // Maule
]);

/** ¿El número tiene forma de teléfono chileno usable? */
export function telefonoPlausible(bruto: string): boolean {
  const d = digitosCL(bruto);
  if (d.length < 8 || d.length > 11 || /^0/.test(d)) return false;
  if (d.startsWith("9")) return true;               // móvil
  if (d.startsWith("600") || d.startsWith("800")) return true; // servicio
  if (d.length === 9 && d.startsWith("2")) return true;        // Santiago
  if (d.length === 9 && AREAS_CHILE.has(d.slice(0, 2))) return true;
  // Ocho dígitos: fijo viejo sin código de área. Se acepta pero vale poco.
  return d.length === 8;
}

/**
 * Saca TODOS los contactos de una página, cada uno con su evidencia.
 *
 * El orden de los patrones importa: primero los estructurados (un enlace
 * `wa.me` es una declaración explícita del negocio), después el texto suelto
 * (que puede ser el teléfono de su proveedor, del arquitecto que hizo el
 * local, o de la empresa que le programó el sitio).
 */
export function extraerContactos(html: string, urlPagina: string): ContactoConEvidencia[] {
  const ahora = new Date().toISOString();
  const porClave = new Map<string, ContactoConEvidencia>();

  const anotar = (
    valor: string,
    tipo: TipoContacto,
    metodo: MetodoEvidencia,
    indice: number,
  ) => {
    const esCorreo = tipo === "email";
    const clave = esCorreo ? limpiarCorreo(valor) : digitosCL(valor);
    if (esCorreo && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(clave)) return;
    if (!clave) return;
    if (!esCorreo && !telefonoPlausible(valor)) return;

    const ev: Evidencia = {
      metodo,
      donde: urlPagina,
      cuando: ahora,
      contexto: contexto(html, indice),
    };
    const ya = porClave.get(clave);
    if (ya) {
      // El mismo número visto de dos formas distintas es MÁS creíble, no un
      // duplicado. Se conserva el tipo más fuerte de los dos.
      ya.evidencias.push(ev);
      if (PESO_TIPO[tipo] > PESO_TIPO[ya.tipo]) ya.tipo = tipo;
      return;
    }
    porClave.set(clave, {
      clave,
      valor: esCorreo ? clave : formatearCL(clave),
      tipo,
      evidencias: [ev],
    });
  };

  let m: RegExpExecArray | null;

  RE_WA.lastIndex = 0;
  while ((m = RE_WA.exec(html)) !== null) anotar(m[1], "whatsapp_publicado", "enlace_wa", m.index);

  RE_TEL.lastIndex = 0;
  while ((m = RE_TEL.exec(html)) !== null) anotar(m[1], "telefono_publicado", "enlace_tel", m.index);

  RE_MAIL.lastIndex = 0;
  while ((m = RE_MAIL.exec(html)) !== null) anotar(m[1], "email", "enlace_mail", m.index);

  // schema.org — el negocio declarando sus propios datos de forma estructurada.
  for (const bloque of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const idx = bloque.index ?? 0;
    for (const t of bloque[1].matchAll(/"telephone"\s*:\s*"([^"]+)"/gi)) {
      anotar(t[1], "telefono_publicado", "schema_org", idx);
    }
    for (const e of bloque[1].matchAll(/"email"\s*:\s*"([^"]+)"/gi)) {
      anotar(e[1], "email", "schema_org", idx);
    }
  }

  // Los números sueltos son el último recurso y el más ruidoso, así que se les
  // exige contexto: una palabra que diga que ESO es un teléfono, a menos de
  // 120 caracteres. Sin este filtro, una tienda en línea devuelve su catálogo
  // entero disfrazado de agenda telefónica.
  const enTexto: { valor: string; indice: number }[] = [];
  RE_TEXTO.lastIndex = 0;
  while ((m = RE_TEXTO.exec(html)) !== null) {
    // Las dos ventanas son distintas a propósito, y la diferencia importa.
    //
    // Lo que DESCALIFICA tiene que estar pegado: "RUT 76.543.210-8" descalifica
    // a ese número, no al teléfono que está tres líneas más arriba. Con una
    // ventana ancha, una página de contacto chilena típica —que SIEMPRE pone el
    // RUT al lado del teléfono— perdía el teléfono. Lo encontró el fixture y
    // habría sido un desastre en producción.
    //
    // Lo que CALIFICA sí puede estar más lejos: el "Teléfono:" del encabezado
    // de una tabla vale para las filas de abajo.
    const pegado = html.slice(Math.max(0, m.index - 30), m.index).replace(/<[^>]*>/g, " ");
    if (NO_ES_TELEFONO.test(pegado)) continue;
    const alrededor = contexto(html, m.index, 120);
    // Dos formas de creerle a un número suelto: que haya una palabra de
    // contacto cerca, O que venga escrito con el prefijo internacional
    // explícito. Nadie escribe "+56" delante de un código de producto — es una
    // marca deliberada de "esto es un teléfono".
    //
    // Sin esta segunda vía, una página de sucursales que lista
    // "Concepción: +56 41 274 3300" perdía todos sus números por no tener la
    // palabra "teléfono" al lado.
    const conPrefijoExplicito = (m[1] ?? "").includes("+");
    if (!conPrefijoExplicito && !CERCA_DE_CONTACTO.test(alrededor)) continue;
    enTexto.push({ valor: m[2], indice: m.index });
  }
  // Y aun con contexto: si igual salen muchos NÚMEROS DISTINTOS, algo está mal
  // en esa página y es mejor no aportar ninguno que ensuciar la ficha con
  // veinte.
  //
  // El tope cuenta números distintos, no coincidencias: un sitio bien hecho
  // repite su teléfono en el encabezado, en el pie y en la sección de
  // contacto, y penalizarlo por eso sería castigar justo al que lo publica
  // bien. (Bug real: un fixture con el bloque duplicado perdía sus seis
  // números por llegar a doce coincidencias del mismo puñado.)
  const distintos = new Set(enTexto.map((t) => digitosCL(t.valor)));
  if (distintos.size <= MAX_TEXTO_POR_PAGINA) {
    for (const t of enTexto) anotar(t.valor, "telefono_en_texto", "texto_del_sitio", t.indice);
  }

  return [...porClave.values()];
}

/** Cuál gana cuando el mismo número aparece de dos formas. */
const PESO_TIPO: Record<TipoContacto, number> = {
  whatsapp_publicado: 6,
  ficha_google: 5,
  telefono_publicado: 4,
  telefono_en_texto: 2,
  afirmado_por_base: 1,
  email: 0,
};

/**
 * Los `mailto:` vienen sucios del HTML real: con `%20` del urlencode y con la
 * arroba escapada como entidad (`&#064;`, `&#64;`, `&commat;`) para despistar
 * a los robots de spam. Salieron los dos casos en sportlife.cl.
 */
export function limpiarCorreo(bruto: string): string {
  let v = bruto.trim();
  try { v = decodeURIComponent(v); } catch { /* urlencode inválido */ }
  return v
    .replace(/&#0*64;|&#x40;|&commat;/gi, "@")
    .replace(/&amp;/gi, "&")
    .replace(/^[\s,;<>"']+|[\s,;<>"']+$/g, "")
    .toLowerCase();
}

/**
 * +56 9 1234 5678 (móvil) · +56 2 2591 2340 (Santiago) · +56 32 259 1234 (resto)
 *
 * El código de área en Chile es de UN dígito solo en Santiago (2). En el resto
 * del país son dos (32 Valparaíso, 41 Concepción, 45 Temuco, 65 Puerto Montt…).
 * Formatearlos todos igual dejaba los números de región escritos mal, que es
 * justo lo que hace dudar al vendedor de si el dato está bien.
 */
export function formatearCL(clave: string): string {
  const d = digitosCL(clave);
  if (d.length !== 9) return d ? `+56 ${d}` : "";
  if (d.startsWith("9")) return `+56 9 ${d.slice(1, 5)} ${d.slice(5)}`;
  if (d.startsWith("2")) return `+56 2 ${d.slice(1, 5)} ${d.slice(5)}`;
  return `+56 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}

/**
 * Junta lo encontrado en varias páginas y en varias fuentes en una sola lista.
 *
 * Acá pasa lo que de verdad importa: si el mismo número aparece en la Ficha de
 * Google Y en el `wa.me` del sitio, deja de ser un dato y pasa a ser un hecho
 * confirmado por dos fuentes independientes. Esa coincidencia es la señal más
 * fuerte que podemos construir sin llamar.
 */
export function fusionar(listas: ContactoConEvidencia[][]): ContactoConEvidencia[] {
  const porClave = new Map<string, ContactoConEvidencia>();
  for (const lista of listas) {
    for (const c of lista) {
      const ya = porClave.get(c.clave);
      if (!ya) {
        porClave.set(c.clave, { ...c, evidencias: [...c.evidencias] });
        continue;
      }
      ya.evidencias.push(...c.evidencias);
      if (PESO_TIPO[c.tipo] > PESO_TIPO[ya.tipo]) ya.tipo = c.tipo;
      if (!ya.persona && c.persona) { ya.persona = c.persona; ya.cargo = c.cargo; }
    }
  }
  return [...porClave.values()];
}

/** Cuántos MÉTODOS distintos respaldan este número. Uno solo no es corroboración. */
export function metodosDistintos(c: ContactoConEvidencia): number {
  return new Set(c.evidencias.map((e) => e.metodo)).size;
}

/** ¿Está respaldado por fuentes independientes entre sí? */
export function corroborado(c: ContactoConEvidencia): boolean {
  const m = new Set(c.evidencias.map((e) => e.metodo));
  // Que aparezca dos veces en el mismo sitio no corrobora nada: es el mismo
  // que lo escribió dos veces. Hace falta que lo digan fuentes distintas.
  const independientes = new Set<string>();
  if (m.has("google_places")) independientes.add("google");
  if (m.has("enlace_wa") || m.has("enlace_tel") || m.has("enlace_mail") || m.has("schema_org") || m.has("texto_del_sitio")) independientes.add("sitio");
  if (m.has("base_externa")) independientes.add("base");
  if (m.has("a_mano")) independientes.add("persona");
  return independientes.size >= 2;
}

export function esMovil(c: ContactoConEvidencia): boolean {
  return c.tipo !== "email" && esCelularChileno(c.clave);
}
