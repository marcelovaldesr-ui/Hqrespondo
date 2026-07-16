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

export interface SenalesWeb {
  /** true si se pudo descargar el HTML */
  visitada: boolean;
  /** Su única "web" es una red social (IG/FB/Linktree) → gestión 100% manual */
  solo_redes?: boolean;
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
const MAX_BYTES = 400_000;

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-CL,es;q=0.9",
      },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.includes("html")) return null;
    const text = await res.text();
    return text.slice(0, MAX_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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

  const chatbot = detectar(todo, CHATBOTS);
  const reservas = detectar(todo, RESERVAS);
  const ecommerce = detectar(todo, ECOMMERCE);
  const crm = detectar(todo, CRM);

  // Formulario de hora: solo cuenta si hay página de agenda (o texto de
  // agendar en portada) SIN sistema de reservas real detrás.
  const hayIntencionAgenda =
    paginas.length > 1 ||
    /agenda\s?tu|reserva\s?tu|pide\s?tu\s?hora|solicita\s?tu\s?hora/i.test(home);
  const formulario_hora =
    !reservas && hayIntencionAgenda && detectar(todo, FORMULARIOS) !== null;

  const parcial = {
    visitada: true,
    chatbot,
    reservas,
    formulario_hora,
    ecommerce,
    crm,
    whatsapp_link: WHATSAPP_LINK.test(todo),
    paginas: paginas.length,
  };
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
