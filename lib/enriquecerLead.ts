/**
 * ENRIQUECIMIENTO DE UN LEAD — de un nombre de empresa a un camino hacia el
 * decisor, con la evidencia al lado.
 *
 * ORDEN DE LOS PASOS: DEL MÁS BARATO AL MÁS CARO
 * No se consultan cinco fuentes por empresa. Se para apenas hay suficiente:
 *
 *   1. El sitio del propio negocio            → GRATIS (solo HTTP)
 *   2. Su Ficha de Empresa de Google (Places) → USD 0,00175 por negocio
 *   3. Quién manda, con IA                    → cuota de Gemini
 *
 * El paso 1 va primero a propósito, y es el que más rinde: el `wa.me` que el
 * negocio puso en su propio sitio es el número más confiable que existe para
 * este ICP —lo publicó él, para que le escriban, y lo mantiene porque de ahí
 * le llegan clientes— y no cuesta un peso.
 *
 * Si el paso 1 ya devolvió un WhatsApp publicado, el 2 y el 3 no se corren.
 * Eso es lo que hace que esto se pueda pasar por 600 empresas sin que el costo
 * se dispare.
 */

import { htmlDeLaWeb } from "@/lib/leerWeb";
import { searchPlaces } from "@/lib/places";
import {
  extraerContactos, fusionar, formatearCL,
  type ContactoConEvidencia,
} from "@/lib/contactos";
import { digitosCL } from "@/lib/alcance";
import {
  armarPlan, estadoDelLead, veredictoDelLead, prioridadComercial,
  type EstadoLead, type Paso, type EstadoLinea, type TipoContactoAjuste, type Veredicto,
} from "@/lib/contactabilidad";
import {
  senalesDeHtml, ES_SOLO_REDES, ES_MARKETPLACE, ES_DIRECTORIO, type SenalesWeb,
} from "@/lib/enriquecimiento";
import { evaluarOportunidad, senalesOportunidadDeHtml, type Oportunidad } from "@/lib/oportunidad";

/** Páginas donde un negocio pone sus datos de contacto y a su gente. */
const RUTAS_DE_CONTACTO =
  /(contacto|contactanos|contact|nosotros|quienes-?somos|about|equipo|team|sucursales|ubicacion)/i;

/** Hasta 3 páginas internas: pasado eso el rendimiento cae y el tiempo sube. */
const MAX_INTERNAS = 3;

function linksDeContacto(html: string, base: URL): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    const href = m[1];
    if (!RUTAS_DE_CONTACTO.test(href)) continue;
    if (/\.(pdf|jpe?g|png|svg|webp|zip)$/i.test(href)) continue;
    try {
      const u = new URL(href, base);
      if (u.hostname !== base.hostname) continue;
      // Normalizar la barra final: /quienes-somos y /quienes-somos/ son la
      // misma página. Sin esto se descargaba dos veces — pasó de verdad en
      // sportlife.cl y le costó un par de segundos a cada lead.
      const limpio = u.href.split("#")[0].split("?")[0].replace(/\/+$/, "");
      if (limpio === base.href.replace(/\/+$/, "")) continue; // es la portada
      out.add(limpio);
    } catch {
      /* href inválido */
    }
    if (out.size >= MAX_INTERNAS) break;
  }
  return [...out];
}

export interface EntradaEnriquecimiento {
  empresa: string;
  comuna?: string | null;
  rubro?: string | null;
  web?: string | null;
  /** Lo que ya teníamos: teléfonos de Apollo, del SII o escritos a mano. */
  telefonosPrevios?: { valor: string; fuente?: string }[];
  decisor?: { nombre?: string | null; cargo?: string | null } | null;
  linkedin?: string | null;
  /** Números ya comprobados malos, para no volver a proponerlos. */
  malos?: Set<string>;
  lineas?: Record<string, EstadoLinea>;
  ajustes?: TipoContactoAjuste;
  /** Si es false no se llama a Places (para correr gratis sobre muchas). */
  usarPlaces?: boolean;
  razonSocial?: string | null;
  nEmpleados?: number | null;
  senal?: string | null;
}

export interface ResultadoEnriquecimiento {
  contactos: ContactoConEvidencia[];
  pasos: Paso[];
  estado: EstadoLead;
  /** Motor 1: ¿vale la pena venderle a esta empresa? */
  oportunidad: Oportunidad;
  /**
   * Motor 2, en puntos (0-100): el mejor camino telefónico que encontramos.
   * Se devuelve aparte porque es lo que se guarda en `contacto_pts` y lo que
   * la base usa para calcular `prioridad`. Antes cada llamador lo volvía a
   * derivar de `pasos` con su propio filtro, y dos filtros distintos sobre
   * lo mismo terminan dando dos números distintos.
   */
  contactoPts: number;
  /** Los dos motores juntos: ¿a quién llama Tomás primero? */
  prioridad: number;
  veredicto: Veredicto;
  /** Lo que se detectó del sitio, para poder auditar el juicio. */
  senalesWeb: SenalesWeb | null;
  /** Qué se hizo y qué costó. Sirve para auditar el gasto y para depurar. */
  traza: string[];
  /** Datos canónicos si Places resolvió la identidad. */
  identidad?: { nombre: string; direccion: string | null; web: string | null; reviews: number | null };
  costoPlaces: number;
}

export async function enriquecerLead(e: EntradaEnriquecimiento): Promise<ResultadoEnriquecimiento> {
  const traza: string[] = [];
  const listas: ContactoConEvidencia[][] = [];
  let costoPlaces = 0;
  let identidad: ResultadoEnriquecimiento["identidad"];
  // El HTML se acumula UNA vez y lo leen los dos motores. Bajarlo de nuevo
  // para detectar chatbot y tamaño sería pagar y esperar dos veces por lo
  // mismo.
  const htmls: string[] = [];

  // ── Lo que ya teníamos entra como AFIRMACIÓN, no como hecho ──────────────
  // Un número de Apollo no viene con un lugar donde ir a comprobarlo. Se
  // guarda igual —puede ser el bueno— pero marcado como lo que es.
  if (e.telefonosPrevios?.length) {
    listas.push(
      e.telefonosPrevios
        .filter((t) => digitosCL(t.valor).length >= 8)
        .map((t) => ({
          clave: digitosCL(t.valor),
          valor: formatearCL(t.valor),
          tipo: "afirmado_por_base" as const,
          persona: e.decisor?.nombre ?? undefined,
          cargo: e.decisor?.cargo ?? undefined,
          evidencias: [{
            metodo: "base_externa" as const,
            donde: t.fuente || "base previa",
            cuando: new Date().toISOString(),
          }],
        })),
    );
    traza.push(`${e.telefonosPrevios.length} número(s) que ya teníamos, marcados como no verificados`);
  }

  // ── PASO 1 · el sitio del negocio (gratis) ───────────────────────────────
  let webUsada = (e.web ?? "").trim();
  if (webUsada) {
    const html = await htmlDeLaWeb(webUsada);
    if (html) {
      let base: URL | null = null;
      try { base = new URL(/^https?:\/\//i.test(webUsada) ? webUsada : `https://${webUsada}`); } catch { /* no válida */ }
      listas.push(extraerContactos(html, base?.href ?? webUsada));
      htmls.push(html);
      traza.push(`leí su portada (${webUsada})`);

      if (base) {
        for (const link of linksDeContacto(html, base)) {
          const interna = await htmlDeLaWeb(link, 8000);
          if (!interna) continue;
          listas.push(extraerContactos(interna, link));
          htmls.push(interna);
          traza.push(`leí ${link.replace(base.origin, "")}`);
        }
      }
    } else if (ES_SOLO_REDES.test(webUsada)) {
      // No es que fallara: no se abre a propósito. Decir "no se pudo abrir"
      // hacía parecer un problema técnico lo que en realidad es el dato más
      // útil que tenemos de este negocio.
      traza.push(`su única "web" es una red social (${webUsada}) — atiende por mensaje directo`);
    } else if (ES_MARKETPLACE.test(webUsada)) {
      traza.push(`lo que teníamos como web es su página en un marketplace de delivery (${webUsada})`);
    } else if (ES_DIRECTORIO.test(webUsada)) {
      // Esto además avisa que el campo "web" del lead tiene un dato malo, que
      // es algo que conviene arreglar a mano.
      traza.push(`ese enlace no es su sitio, es un directorio de empresas (${webUsada}): no se leyó como si fuera de ellos`);
    } else {
      traza.push(`su sitio no se pudo abrir (${webUsada})`);
    }
  } else {
    traza.push("no teníamos su sitio web");
  }

  // ── ¿Alcanza con lo gratis? ──────────────────────────────────────────────
  const hastaAqui = fusionar(listas);
  const yaHayPublicado = hastaAqui.some(
    (c) => c.tipo === "whatsapp_publicado" || c.tipo === "telefono_publicado",
  );

  // ── PASO 2 · la Ficha de Empresa de Google (cuesta) ──────────────────────
  const puedePlaces = e.usarPlaces !== false && Boolean(e.comuna);
  if (!yaHayPublicado && puedePlaces) {
    try {
      const r = await searchPlaces(e.empresa, String(e.comuna));
      costoPlaces = 1;
      // Se toma el primero SOLO si el nombre calza de verdad. Buscar
      // "Clínica Dental Aurora" y quedarse con "Clínica Dental Australis"
      // porque salió primera es peor que no encontrar nada: manda al vendedor
      // a llamar a otra empresa con toda confianza.
      // Dos gates, no uno. El nombre solo no alcanza y la prueba lo demostró:
      // "Hotel Los Andes" y "Hotel Andes Plaza" comparten la única palabra
      // distintiva que les queda, y no hay forma de separarlos por texto.
      //
      // La comuna sí los separa. Cuando la tenemos, se exige que aparezca en
      // la dirección de la ficha. Y si ningún candidato pasa los dos filtros,
      // NO se elige el "más parecido": se deja sin identidad. Un teléfono
      // correcto de la empresa equivocada es el peor resultado posible — el
      // vendedor llama con toda seguridad y queda en ridículo.
      const comunaBuscada = normalizar(String(e.comuna ?? ""));
      const candidatos = r.filter((p) => pareceLaMisma(p.nombre, e.empresa));
      const conComuna = comunaBuscada
        ? candidatos.filter((p) => normalizar(p.direccion ?? "").includes(comunaBuscada))
        : candidatos;
      const elegido =
        conComuna.length === 1 ? conComuna[0]
        : conComuna.length > 1 ? undefined  // ambiguo: dos fichas calzan igual
        : undefined;
      if (candidatos.length && !elegido) {
        traza.push(
          conComuna.length > 1
            ? `${conComuna.length} fichas calzan con el nombre Y la comuna: ambiguo, no se elige ninguna`
            : `calzó el nombre pero ninguna ficha está en ${e.comuna}: puede ser otra sucursal u otra empresa`,
        );
      }
      if (elegido) {
        identidad = { nombre: elegido.nombre, direccion: elegido.direccion, web: elegido.web, reviews: elegido.reviews };
        if (elegido.telefono) {
          listas.push([{
            clave: digitosCL(elegido.telefono),
            valor: formatearCL(elegido.telefono),
            tipo: "ficha_google",
            evidencias: [{ metodo: "google_places", donde: "Ficha de Empresa de Google", cuando: new Date().toISOString() }],
          }]);
        }
        traza.push(`Ficha de Google: ${elegido.nombre}${elegido.telefono ? ` · ${elegido.telefono}` : " · sin teléfono"}`);
        // Si Places trajo un sitio que no teníamos, vale la pena leerlo: es
        // gratis y es donde están los `wa.me`.
        if (!webUsada && elegido.web) {
          const html = await htmlDeLaWeb(elegido.web);
          if (html) {
            listas.push(extraerContactos(html, elegido.web));
            htmls.push(html);
            traza.push(`leí el sitio que traía su ficha (${elegido.web})`);
            webUsada = elegido.web;
          }
        }
      } else {
        traza.push(`Places devolvió ${r.length} resultados pero ninguno calza con el nombre — no se usa ninguno`);
      }
    } catch (err) {
      traza.push(`Places falló: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (yaHayPublicado) {
    traza.push("no hizo falta consultar Places: su propio sitio ya publicaba un número");
  }

  const contactos = fusionar(listas);
  const pasos = armarPlan(
    {
      contactos,
      decisor: e.decisor,
      empresa: e.empresa,
      web: webUsada || undefined,
      linkedin: e.linkedin,
      lineas: e.lineas,
      malos: e.malos,
      ajustes: e.ajustes,
    },
    e.rubro,
  );

  // ── MOTOR 1 · ¿vale la pena venderle? Sobre el MISMO HTML ya bajado.
  const todo = htmls.join("\n<!--PAGINA-->\n");
  // ── EL NEGOCIO QUE VIVE EN INSTAGRAM ──────────────────────────────────
  //
  // Bug encontrado en la corrida real del 4-sep-2026 sobre 50 leads.
  //
  // `leerWeb` bloquea instagram.com y facebook.com a propósito: no son sitios
  // web y no se raspan. Pero el efecto secundario era que un negocio cuya
  // ÚNICA presencia es Instagram entraba al sistema como "no se pudo abrir su
  // sitio" — o sea, sin ninguna señal, puntuado igual que uno del que no
  // sabemos nada.
  //
  // Y ese negocio es el mejor cliente que puede tener Respondo. Si toda su
  // atención pasa por DM, alguien está contestando a mano todos los días.
  // `enriquecimiento.ts` ya lo sabía (`solo_redes` → potencial alto); lo que
  // faltaba era preguntarlo ANTES de intentar descargar.
  //
  // En la tanda de Tomás esto afectó a Cecinas Larita, Gestcap y Rafael
  // Iturra: los tres salieron "No vale el tiempo ahora".
  const web = String(e.web ?? "");
  const soloRedes = !!web && ES_SOLO_REDES.test(web);
  const marketplace = !!web && ES_MARKETPLACE.test(web);

  const senalesWeb: SenalesWeb | null = htmls.length
    ? { ...senalesDeHtml(todo, { hayIntencionAgenda: htmls.length > 1 }), visitada: true, paginas: htmls.length, potencial: "desconocido" }
    : soloRedes || marketplace
      ? {
          visitada: false, solo_redes: soloRedes,
          chatbot: null, reservas: null, formulario_hora: false, ecommerce: null,
          crm: null, whatsapp_link: false, boton_wa_flotante: false,
          // Si su vitrina ES Instagram, el enlace a Instagram sobra decirlo.
          instagram_link: soloRedes, canales_dm: soloRedes ? 1 : 0, paginas: 0,
          potencial: soloRedes ? "alto" : "desconocido",
        }
      : null;
  const negocio = senalesOportunidadDeHtml(todo, htmls.length, identidad?.reviews ?? null);
  const oportunidad = evaluarOportunidad({
    empresa: e.empresa,
    razon_social: e.razonSocial,
    industria: e.rubro,
    senal: e.senal,
    nEmpleados: e.nEmpleados,
    web: senalesWeb,
    negocio,
  });

  const mejorContacto = pasos.find((p) => p.via !== "email" && p.via !== "linkedin" && p.via !== "formulario");
  const contactabilidad = mejorContacto?.puntos ?? 0;
  const prioridad = prioridadComercial(oportunidad.puntos, contactabilidad);
  const veredicto = veredictoDelLead({
    oportunidad: oportunidad.puntos,
    nivelOportunidad: oportunidad.nivel,
    contactabilidad,
  });

  return {
    contactos, pasos, estado: estadoDelLead(pasos),
    oportunidad, contactoPts: contactabilidad, prioridad, veredicto, senalesWeb,
    traza, identidad, costoPlaces,
  };
}

/**
 * ¿El resultado de Places es la MISMA empresa que buscamos?
 *
 * Es la guarda contra el error más caro de todo el pipeline: confundir una
 * empresa con otra de nombre parecido. Un teléfono correcto de la empresa
 * equivocada es peor que no tener teléfono — el vendedor llama con seguridad
 * y queda en ridículo, y encima quema el número.
 *
 * Se comparan las palabras con contenido: basta con que compartan las
 * significativas. "Clínica Dental Aurora" vs "Dental Aurora" pasa;
 * "Clínica Dental Aurora" vs "Clínica Dental Australis" no.
 */
/** minúsculas, sin tildes, sin puntuación. */
function normalizar(x: string): string {
  return x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function pareceLaMisma(a: string, b: string): boolean {
  const limpiar = (x: string) =>
    normalizar(x).split(/\s+/).filter((w) => w.length > 2 && !VACIAS.has(w));
  const A = new Set(limpiar(a));
  const B = new Set(limpiar(b));
  // Si a alguno no le queda ninguna palabra propia ("Clínica Dental" a secas),
  // no hay con qué distinguirlo de sus vecinos. Se prefiere no usar el
  // resultado antes que mandar al vendedor a llamar a otra empresa.
  if (!A.size || !B.size) return false;
  let comunes = 0;
  for (const w of A) if (B.has(w)) comunes++;
  // Jaccard sobre el conjunto más chico: tolera que uno traiga palabras extra
  // ("Ltda", "sucursal centro") sin dejar pasar nombres distintos.
  return comunes / Math.min(A.size, B.size) >= 0.6;
}

/**
 * Palabras que NO distinguen a una empresa de otra.
 *
 * Incluye a propósito los sustantivos del rubro. La prueba lo destapó:
 * "Clínica Dental Aurora" y "Clínica Dental Australis" compartían dos de tres
 * palabras y pasaban como la misma empresa. Las que coincidían eran "clínica"
 * y "dental" —que no dicen nada, las tienen todas— y la que de verdad
 * distingue, el nombre de fantasía, era justo la que se ignoraba.
 *
 * Sacándolas, la comparación queda entre lo único que identifica: aurora vs
 * australis. Y esas no se parecen.
 */
const VACIAS = new Set([
  // formas legales y relleno
  "spa", "ltda", "limitada", "sociedad", "comercial", "empresa", "empresas",
  "chile", "chilena", "the", "and", "los", "las", "del", "para", "por", "con",
  "sucursal", "casa", "matriz", "grupo", "holding",
  // sustantivos de rubro: los tienen todos los del rubro
  "clinica", "clinicas", "centro", "centros", "consulta", "consultorio",
  "dental", "dentales", "odontologia", "medico", "medica", "salud",
  "gimnasio", "gym", "taller", "talleres", "tienda", "shop", "store",
  "restaurant", "restaurante", "hotel", "hostal", "cabanas", "spa",
  "estetica", "peluqueria", "barberia", "veterinaria", "farmacia",
  "colegio", "instituto", "academia", "escuela", "jardin",
  "inmobiliaria", "corretaje", "propiedades", "automotriz", "automotora",
  "repuestos", "servicio", "servicios", "distribuidora", "importadora",
  "cancha", "canchas", "club", "complejo", "laboratorio",
]);
