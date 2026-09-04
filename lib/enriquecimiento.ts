/**
 * ENRIQUECIMIENTO WEB v2.1 · Detección de señales de automatización.
 *
 * El criterio de segmentación de Respondo es "gestiona manual vs ya
 * automatizado". Este módulo visita la web del prospecto y detecta en el
 * HTML las herramientas que delatan automatización existente (chatbot,
 * reservas online, e-commerce con checkout, CRM).
 *
 * v2.1 (fix caso real NCA): el sistema de reservas suele vivir en una
 * página interna (/agendar, /reservas), no en la portada. Ahora:
 *  1. Se revisa la portada Y hasta 2 páginas internas de agenda/reserva.
 *  2. Se distingue SISTEMA de reservas real (horas en tiempo real → bajo
 *     potencial) de FORMULARIO de solicitud (Contact Form 7, WPForms…:
 *     un humano responde cada solicitud → sigue siendo gestión manual,
 *     potencial alto, y es munición para la llamada).
 *
 * Solo fetch + regex sobre HTML público: gratis, sin APIs pagas.
 * Falla silencioso (visitada:false) para no bloquear el scoring.
 */

import { htmlDeLaWeb } from "@/lib/leerWeb";

/**
 * ¿Su única "web" es una red social? Entonces gestionan TODO a mano por DM,
 * y son de los mejores prospectos que existen para Respondo.
 *
 * Vive acá y se exporta porque `enriquecerLead` necesita hacer la misma
 * pregunta ANTES de intentar descargar nada: `leerWeb` bloquea estos dominios
 * a propósito (no son sitios, y raspar Instagram no se hace), y el efecto
 * secundario era que el mejor perfil de cliente que tenemos entraba al
 * sistema como "no tiene web" — o sea, sin ninguna señal.
 */
export const ES_SOLO_REDES = /facebook\.com|instagram\.com|linktr\.ee|wa\.me\/|tiktok\.com/i;

/**
 * Marketplaces de delivery. NO es lo mismo que solo_redes: acá el negocio
 * delegó la toma de pedidos en un tercero que le cobra comisión. Sigue
 * atendiendo por WhatsApp lo que no pasa por ahí, así que sirve, pero no es
 * la señal fuerte de "gestiona todo a mano".
 */
export const ES_MARKETPLACE = /ubereats\.com|rappi\.|pedidosya\.|justo\.mx|menu\.dine/i;

/**
 * Directorios de empresas y perfiles corporativos. Su HTML NO es el sitio del
 * negocio: un teléfono ahí lo publicó un tercero, no la empresa.
 *
 * Salió de la corrida real del 4-sep-2026: a "Sociedad Comercial Riquelme
 * Hermanos" le leímos portalchile.org y a "Servicios Transitorios San
 * Cristóbal" su página de LinkedIn, las dos anotadas en la traza como "leí su
 * portada". Cualquier número sacado de ahí habría entrado como si el negocio
 * lo publicara, que es justamente la evidencia que más peso tiene.
 */
export const ES_DIRECTORIO =
  /linkedin\.com|portalchile\.|paginasamarillas\.|amarillas\.|guiaempresas|empresite|einforma|dateas\.|mercadopublico\.|boletinconcursal|rutificador|chilecubica|opendata|infoempresa|cylex|yelp\.|foursquare\./i;

export interface SenalesWeb {
  /** true si se pudo descargar el HTML */
  visitada: boolean;
  /** Su única "web" es una red social (IG/FB/Linktree) → gestión 100% manual */
  solo_redes?: boolean;
  /** Sin web y con CELULAR publicado en Google → opera 100% por WhatsApp */
  celular_whatsapp?: boolean;
  /** Herramienta de chatbot detectada (Cliengo, Tidio, …) o null */
  chatbot: string | null;
  /** Sistema de reservas/agenda online REAL detectado o null */
  reservas: string | null;
  /** La web pide la hora por formulario (respuesta manual del negocio) */
  formulario_hora: boolean;
  /** Plataforma e-commerce con checkout detectada o null */
  ecommerce: string | null;
  /** CRM / marketing automation detectado o null */
  crm: string | null;
  /** La web tiene link directo a WhatsApp (wa.me / api.whatsapp.com) */
  whatsapp_link: boolean;
  /** Botón flotante de WhatsApp: el negocio EMPUJA la conversación al DM */
  boton_wa_flotante: boolean;
  /** La web enlaza su Instagram — la vitrina real está allá */
  instagram_link: boolean;
  /** Cuántos canales de DM ofrece la web (WhatsApp, botón, Instagram) */
  canales_dm: number;
  /** Cuántas páginas se revisaron (portada + internas de agenda) */
  paginas: number;
  /** Resumen: alto = sin automatización (ideal), bajo = ya automatizado */
  potencial: "alto" | "medio" | "bajo" | "desconocido";
}

type Firma = [nombre: string, patron: RegExp];

/** Widgets de chat/bot — presencia = ya tienen algo respondiendo. */
const CHATBOTS: Firma[] = [
  ["Cliengo", /cliengo\.com|s\.cliengo/i],
  ["Tidio", /tidio\.co|tidiochat/i],
  ["Intercom", /intercom(?:cdn|\.io|settings)/i],
  ["Tawk.to", /tawk\.to|embed\.tawk/i],
  ["ManyChat", /manychat\.com|mccdn\.me/i],
  ["Crisp", /crisp\.chat|client\.crisp/i],
  ["JivoChat", /jivosite|jivochat/i],
  ["Zendesk Chat", /zopim|zdassets.*(?:chat|widget)|snippet\.zendesk/i],
  ["Landbot", /landbot\.io/i],
  ["Botmaker", /botmaker\.com|go\.botmaker/i],
  ["Zoho SalesIQ", /salesiq\.zoho/i],
  ["HubSpot Chat", /usemessages\.com|hubspot.*conversations/i],
  ["Chatwoot", /chatwoot/i],
  ["WATI", /wati\.io.*widget|wati-widget/i],
];

/** Sistemas de reservas/agenda REALES (horas online). Incluye los chilenos. */
const RESERVAS: Firma[] = [
  ["AgendaPro", /agendapro\.(?:com|cl)/i],
  ["Reservo", /reservo\.cl/i],
  ["Calendly", /calendly\.com/i],
  ["Dentalink", /dentalink/i],
  ["Medilink", /medilink/i],
  ["Booksy", /booksy\.com/i],
  ["Fresha", /fresha\.com/i],
  ["SimplyBook", /simplybook\.(?:me|it)/i],
  ["Acuity", /acuityscheduling/i],
  ["Setmore", /setmore\.com/i],
  ["Timify", /timify\.com/i],
  ["Mindbody", /mindbodyonline/i],
  ["Bewe", /bewe\.(?:io|co)/i],
  ["Flowww", /flowww\.(?:net|com)/i],
  ["Wix Bookings", /wix-?bookings|bookings\.wixapps/i],
  ["Amelia (WP)", /plugins\/ameliabooking|amelia-booking/i],
  ["Bookly (WP)", /plugins\/bookly|bookly-frontend/i],
  ["Booknetic (WP)", /booknetic/i],
  ["JetAppointments", /jet-appointments/i],
  ["WooCommerce Bookings", /wc-bookings|woocommerce-bookings/i],
  ["MotoPress Appointment", /motopress-appointment/i],
  ["AgendaOnline", /agendaonline\.cl/i],
  ["Agendalo", /agendalo\.cl/i],
  // Verticales fuertes en Chile (dental/médico/canchas/gimnasios)
  ["Doctoralia", /doctoralia|docplanner/i],
  ["Medipass", /medipass/i],
  ["SaludTools", /saludtools/i],
  ["Easycancha", /easycancha/i],
  ["Playtomic", /playtomic/i],
  ["MatchPoint", /matchpoint\.com\.es|tpc\.matchpoint/i],
  ["Gestionatuclub", /gestionatuclub\.cl/i],
  ["Boxmagic", /boxmagic/i],
  ["AgendaMédica", /agendamedica/i],
];

/** Formularios de contacto/solicitud — el negocio responde A MANO. */
const FORMULARIOS: Firma[] = [
  ["Contact Form 7", /contact-form-7|wpcf7/i],
  ["WPForms", /wpforms/i],
  ["Gravity Forms", /gravityforms|gform_/i],
  ["Elementor Form", /elementor-form|elementor-field/i],
  ["Typeform", /typeform\.com/i],
  ["Google Forms", /docs\.google\.com\/forms/i],
  ["JotForm", /jotform/i],
  ["Formulario propio", /<form[^>]*(?:method|action)/i],
];

/** E-commerce con checkout — pueden vender solo, menos dolor de cotización. */
const ECOMMERCE: Firma[] = [
  ["Shopify", /cdn\.shopify|myshopify\.com|Shopify\.theme/i],
  ["Jumpseller", /jumpseller/i],
  ["WooCommerce", /woocommerce/i],
  ["Tiendanube", /tiendanube|nuvemshop/i],
  ["VTEX", /vtex(?:\.com|assets|commercestable)/i],
  ["Bsale", /bsale\.(?:cl|io|com)/i],
  ["PrestaShop", /prestashop/i],
  ["Magento", /magento|mage\/cookies/i],
  ["Wix Stores", /wixstores/i],
  ["MercadoShops", /mercadoshops/i],
];

/** CRM / marketing automation — señal de proceso comercial ya digitalizado. */
const CRM: Firma[] = [
  ["HubSpot", /js\.hs-scripts|js\.hsforms|hubspot\.com/i],
  ["Pipedrive", /pipedrive|leadbooster/i],
  ["Salesforce", /salesforce|pardot/i],
  ["ActiveCampaign", /activecampaign|acems\d/i],
  ["RD Station", /rdstation|d335luupugsy2/i],
  ["Zoho CRM", /zoho\.com\/crm|zohopublic/i],
  ["Clientify", /clientify/i],
  ["Kommo", /kommo\.com|amocrm/i],
];

const WHATSAPP_LINK = /wa\.me\/|api\.whatsapp\.com\/send|whatsapp:\/\/send/i;

/**
 * Botón flotante de WhatsApp. No es lo mismo que tener un link: el botón
 * flotante sigue al visitante por toda la página, y es la señal más clara de
 * que el negocio decidió que la conversión pasa por el DM y no por su web.
 * Son los widgets más usados en Chile.
 */
const BOTON_WA = /joinchat|whatsapp-?chat|wa-?widget|whatsapp-?button|floating[_-]?w(?:ha|p)|click-?to-?chat|chaty|elfsight.*whatsapp|getbutton|wp-?whatsapp|holler|whatsapp-?float/i;

/** Enlace al perfil de Instagram del negocio. */
const INSTAGRAM_LINK = /instagram\.com\/[a-z0-9._]/i;

/** Links internos que probablemente llevan a la página de agenda/reserva. */
const LINK_AGENDA =
  /href="([^"]*(?:agendar?|agendamiento|reservar?|reservas?|booking|book|pide-?tu-?hora|solicita-?hora|citas?)[^"]*)"/gi;

function detectar(html: string, firmas: Firma[]): string | null {
  for (const [nombre, patron] of firmas) {
    if (patron.test(html)) return nombre;
  }
  return null;
}

export function clasificarPotencial(
  s: Omit<SenalesWeb, "potencial">,
): SenalesWeb["potencial"] {
  if (s.solo_redes) return "alto"; // solo IG/FB = gestión 100% manual
  if (!s.visitada) return "desconocido";
  if (s.chatbot || s.reservas) return "bajo"; // ya automatizaron lo que vendemos
  if (s.ecommerce || s.crm) return "medio"; // digitalizados, pero sin bot/agenda
  return "alto"; // sin automatización (formulario cuenta como manual)
}

// 5s por fetch: en serverless (Vercel) el presupuesto total de la función es
// acotado; un sitio que demora más de 5s casi nunca entrega señal útil.
const TIMEOUT_MS = 5000;
// 1.5 MB: los sitios Elementor/WordPress pesados superan 1 MB y el link del
// sistema de reservas puede quedar al final del HTML. Con 400 KB se nos escapó
// un Dentalink real (caso ohmydent.com, jul-2026) → score 100 falso.
const MAX_BYTES = 1_500_000;

/**
 * Antes esto tenía su propio fetch, SIN ninguna guarda: aceptaba cualquier
 * URL, incluida una dirección interna o una IP pelada. Se alimenta de
 * `prospects.web`, que viene de Places, así que el riesgo era acotado — pero
 * era un segundo camino de salida a internet con reglas distintas al primero.
 * Ahora hay uno solo, el de `leerWeb.ts`, con la guarda puesta.
 */
async function fetchHtml(url: string): Promise<string | null> {
  const html = await htmlDeLaWeb(url, TIMEOUT_MS);
  return html ? html.slice(0, MAX_BYTES) : null;
}

/** Extrae hasta `max` links internos de agenda/reserva de la portada. */
function linksAgenda(html: string, base: URL, max = 2): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(LINK_AGENDA)) {
    const href = m[1];
    if (/wa\.me|whatsapp|tel:|mailto:|facebook|instagram|\.pdf|\.jpg|\.png/i.test(href)) continue;
    try {
      const u = new URL(href, base);
      // solo mismo dominio (o subdominio de reservas del mismo negocio)
      if (u.hostname === base.hostname || u.hostname.endsWith(`.${base.hostname}`)) {
        u.hash = "";
        urls.add(u.toString());
      } else {
        // dominio externo tipo agendapro.com/xxx: se detecta por firma más abajo
        urls.add(u.toString());
      }
    } catch {
      /* href inválido */
    }
    if (urls.size >= max) break;
  }
  return [...urls];
}

/**
 * Detecta las señales sobre HTML YA DESCARGADO.
 *
 * Se separó del descargador el 4-sep-2026 por una razón concreta: el
 * enriquecimiento de leads (`lib/enriquecerLead.ts`) ya baja la portada y las
 * páginas internas para sacar teléfonos. Hacer una SEGUNDA descarga de las
 * mismas páginas para detectar chatbot y reservas era pagar dos veces el
 * mismo viaje —y sobre todo, tardar el doble— por información que ya estaba
 * en memoria.
 *
 * Un fetch, dos motores: los contactos y el encaje comercial salen del mismo
 * HTML.
 */
export function senalesDeHtml(
  todo: string,
  opts: { hayIntencionAgenda?: boolean } = {},
): Omit<SenalesWeb, "visitada" | "paginas" | "potencial"> {
  const chatbot = detectar(todo, CHATBOTS);
  const reservas = detectar(todo, RESERVAS);
  const ecommerce = detectar(todo, ECOMMERCE);
  const crm = detectar(todo, CRM);

  // Formulario de hora: solo cuenta si hay intención de agenda (una página
  // interna de reservas, o el texto en la portada) SIN sistema real detrás.
  const hayIntencionAgenda =
    opts.hayIntencionAgenda ||
    /agenda\s?tu|reserva\s?tu|pide\s?tu\s?hora|solicita\s?tu\s?hora/i.test(todo);
  const formulario_hora =
    !reservas && hayIntencionAgenda && detectar(todo, FORMULARIOS) !== null;

  const whatsapp_link = WHATSAPP_LINK.test(todo);
  const boton_wa_flotante = BOTON_WA.test(todo);
  const instagram_link = INSTAGRAM_LINK.test(todo);

  return {
    chatbot, reservas, formulario_hora, ecommerce, crm,
    whatsapp_link, boton_wa_flotante, instagram_link,
    canales_dm: (whatsapp_link ? 1 : 0) + (boton_wa_flotante ? 1 : 0) + (instagram_link ? 1 : 0),
  };
}

/** Enriquece UNA web (portada + hasta 2 páginas de agenda). Nunca lanza. */
export async function enriquecerWeb(web: string | null): Promise<SenalesWeb> {
  const vacio: SenalesWeb = {
    visitada: false,
    chatbot: null,
    reservas: null,
    formulario_hora: false,
    ecommerce: null,
    crm: null,
    whatsapp_link: false,
    boton_wa_flotante: false,
    instagram_link: false,
    canales_dm: 0,
    paginas: 0,
    potencial: "desconocido",
  };
  if (!web) return vacio;

  const url = /^https?:\/\//i.test(web) ? web : `https://${web}`;
  // Su única "web" es una red social → no hay nada que automatizar ahí:
  // gestionan TODO a mano por DM. Es de los mejores prospectos que existen.
  if (/facebook\.com|instagram\.com|linktr\.ee|wa\.me\//i.test(url)) {
    return { ...vacio, solo_redes: true, potencial: "alto" };
  }

  const home = await fetchHtml(url);
  if (!home) return vacio;

  // Portada + páginas internas de agenda/reserva
  const paginas: string[] = [home];
  let base: URL | null = null;
  try {
    base = new URL(url);
  } catch {
    /* url inválida */
  }
  if (base) {
    const internas = linksAgenda(home, base);
    for (const link of internas) {
      const html = await fetchHtml(link);
      if (html) paginas.push(html);
    }
  }
  const todo = paginas.join("\n<!--PAGINA-->\n");

  const parcial = { ...senalesDeHtml(todo, { hayIntencionAgenda: paginas.length > 1 }), visitada: true, paginas: paginas.length };
  return { ...parcial, potencial: clasificarPotencial(parcial) };
}

/** Enriquece un batch en paralelo (máx `concurrencia` webs a la vez). */
export async function enriquecerBatch(
  webs: (string | null)[],
  concurrencia = 10,
): Promise<SenalesWeb[]> {
  const resultados: SenalesWeb[] = new Array(webs.length);
  let i = 0;
  async function worker() {
    while (i < webs.length) {
      const idx = i++;
      resultados[idx] = await enriquecerWeb(webs[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrencia, webs.length) }, worker),
  );
  return resultados;
}
