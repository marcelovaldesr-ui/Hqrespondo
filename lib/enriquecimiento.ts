/**
 * ENRIQUECIMIENTO WEB · Detección de señales de automatización.
 *
 * El criterio de segmentación de Respondo es "gestiona manual vs ya
 * automatizado". Este módulo visita la web del prospecto y detecta en el
 * HTML las herramientas que delatan automatización existente (chatbot,
 * reservas online, e-commerce con checkout, CRM). Su ausencia — sobre todo
 * combinada con un link wa.me — es la señal más fuerte de ALTO potencial.
 *
 * Solo fetch + regex sobre el HTML público: gratis, sin BuiltWith ni APIs
 * pagas. Falla silencioso (visitada:false) para no bloquear el scoring.
 */

export interface SenalesWeb {
  /** true si se pudo descargar el HTML */
  visitada: boolean;
  /** Herramienta de chatbot detectada (Cliengo, Tidio, …) o null */
  chatbot: string | null;
  /** Sistema de reservas/agenda online detectado o null */
  reservas: string | null;
  /** Plataforma e-commerce con checkout detectada o null */
  ecommerce: string | null;
  /** CRM / marketing automation detectado o null */
  crm: string | null;
  /** La web tiene link directo a WhatsApp (wa.me / api.whatsapp.com) */
  whatsapp_link: boolean;
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

/** Reservas / agenda online — incluye las plataformas chilenas comunes. */
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
  ["Agenda online genérica", /agenda(?:r|miento)?[\s-]?online|reserva[\s-]?(?:tu[\s-]?)?hora[\s-]?online|pide[\s-]?tu[\s-]?hora[\s-]?online/i],
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

function detectar(html: string, firmas: Firma[]): string | null {
  for (const [nombre, patron] of firmas) {
    if (patron.test(html)) return nombre;
  }
  return null;
}

/** Clasifica el potencial según las señales encontradas. */
export function clasificarPotencial(s: Omit<SenalesWeb, "potencial">): SenalesWeb["potencial"] {
  if (!s.visitada) return "desconocido";
  if (s.chatbot || s.reservas) return "bajo"; // ya automatizaron lo que vendemos
  if (s.ecommerce || s.crm) return "medio"; // digitalizados, pero sin bot/agenda
  return "alto"; // web sin automatización = gestionan a mano
}

const TIMEOUT_MS = 8000;
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

/** Enriquece UNA web. Nunca lanza: si algo falla, visitada=false. */
export async function enriquecerWeb(web: string | null): Promise<SenalesWeb> {
  const vacio: SenalesWeb = {
    visitada: false,
    chatbot: null,
    reservas: null,
    ecommerce: null,
    crm: null,
    whatsapp_link: false,
    potencial: "desconocido",
  };
  if (!web) return vacio;

  const url = /^https?:\/\//i.test(web) ? web : `https://${web}`;
  // Redes sociales no son "web propia": no dicen nada de automatización.
  if (/facebook\.com|instagram\.com|linktr\.ee|wa\.me\//i.test(url)) return vacio;

  const html = await fetchHtml(url);
  if (!html) return vacio;

  const base = {
    visitada: true,
    chatbot: detectar(html, CHATBOTS),
    reservas: detectar(html, RESERVAS),
    ecommerce: detectar(html, ECOMMERCE),
    crm: detectar(html, CRM),
    whatsapp_link: WHATSAPP_LINK.test(html),
  };
  return { ...base, potencial: clasificarPotencial(base) };
}

/** Enriquece un batch en paralelo (máx `concurrencia` fetches a la vez). */
export async function enriquecerBatch(
  webs: (string | null)[],
  concurrencia = 5,
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
