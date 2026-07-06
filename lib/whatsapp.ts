/**
 * Envía un mensaje de texto vía WhatsApp Cloud API.
 * Se usa SOLO para notificarte a ti (alertas y brief), nunca para
 * outreach frío a prospectos (riesgo de baneo del número).
 *
 * Ojo con la ventana de 24 h: para recibir mensajes de sesión,
 * escríbele primero un mensaje a tu número de Cloud API desde MI_WHATSAPP,
 * o configura una plantilla aprobada.
 */
export async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token || !to) return false;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body },
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
