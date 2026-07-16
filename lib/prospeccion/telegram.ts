/**
 * Notificaciones a Telegram (leads calientes + reporte diario).
 *
 * API HTTP pura vía fetch: sin SDK, sin dependencias nuevas. Falla silencioso
 * y devuelve false — una notificación caída no debe romper el pipeline.
 */

const API = "https://api.telegram.org";

function creds() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  return token && chatId ? { token, chatId } : null;
}

/** Envía un mensaje (HTML) al chat configurado. Devuelve true si salió. */
export async function enviarTelegram(texto: string): Promise<boolean> {
  const c = creds();
  if (!c) {
    console.warn("[telegram] falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID");
    return false;
  }
  try {
    const res = await fetch(`${API}/bot${c.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: c.chatId,
        text: texto,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function esc(s: string | null | undefined): string {
  return (s ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Alerta de lead CALIENTE (respuesta positiva) con todo lo accionable. */
export async function alertaLeadCaliente(p: {
  nombre: string;
  rubro: string | null;
  comuna: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_celular: string | null;
  contacto_linkedin: string | null;
  telefono: string | null;
  extracto: string;
}): Promise<boolean> {
  const texto =
    `🔥 <b>LEAD CALIENTE</b> — quiere demo\n\n` +
    `<b>${esc(p.nombre)}</b> · ${esc(p.rubro)} · ${esc(p.comuna)}\n` +
    `👤 ${esc(p.contacto_nombre)}\n` +
    `✉️ ${esc(p.contacto_email)}\n` +
    `📱 ${esc(p.contacto_celular || p.telefono)}\n` +
    (p.contacto_linkedin ? `🔗 ${esc(p.contacto_linkedin)}\n` : "") +
    `\n💬 <i>${esc(p.extracto.slice(0, 400))}</i>\n\n` +
    `➡️ Responde tú directo y cierra la demo.`;
  return enviarTelegram(texto);
}
