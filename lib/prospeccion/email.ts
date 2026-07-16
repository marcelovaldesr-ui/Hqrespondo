/**
 * Envío y lectura de email vía Gmail API (REST puro, sin googleapis SDK).
 *
 * Autenticación: OAuth2 con refresh_token de una cuenta secundaria dedicada al
 * outreach (NO tu cuenta principal — proteges reputación de dominio). El
 * refresh_token se cambia por un access_token en cada uso; cero dependencias.
 *
 * Por qué Gmail y no SendGrid/Resend: para ~400 envíos en 7 días el volumen
 * cabe en el límite gratis (500/día), y los proveedores transaccionales
 * suelen suspender cuentas por cold outreach. Lo que sí cuida la entregabilidad
 * es: cuenta/dominio aparte, buena personalización y un opt-out real (abajo).
 */

let tokenCache: { token: string; exp: number } | null = null;

/** Obtiene un access_token fresco (cachea hasta ~55 min). */
async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refresh = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refresh) {
    throw new Error(
      "Faltan GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN",
    );
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`OAuth Gmail ${res.status}: ${await res.text()}`);
  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    exp: Date.now() + (data.expires_in ?? 3600) * 1000 - 300_000,
  };
  return tokenCache.token;
}

/**
 * Verifica que el OAuth de Gmail funciona: pide access_token y consulta el
 * perfil. Devuelve el email de la cuenta si todo está bien. Para el diagnóstico.
 */
export async function verificarGmail(): Promise<{ ok: boolean; email?: string; error?: string }> {
  try {
    const token = await accessToken();
    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { ok: false, error: `Gmail profile ${res.status}: ${await res.text()}` };
    const data = await res.json();
    return { ok: true, email: data.emailAddress };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function base64url(s: string): string {
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Codifica encabezados con acentos (RFC 2047) para asunto/nombre. */
function encHeader(s: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(s)
    ? s
    : `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`;
}

export interface EnvioResultado {
  ok: boolean;
  threadId?: string;
  messageId?: string;
  error?: string;
}

/**
 * Envía un email de texto plano. Devuelve threadId (para casar respuestas).
 * `threadId` opcional: si se pasa, el mensaje se manda DENTRO de ese hilo
 * (seguimientos en la misma conversación).
 */
export async function enviarEmail(opts: {
  para: string;
  deNombre: string;
  deEmail: string;
  asunto: string;
  cuerpo: string;
  threadId?: string | null;
  inReplyTo?: string | null;
}): Promise<EnvioResultado> {
  try {
    const token = await accessToken();

    const optOut =
      "\n\n—\nSi no es de tu interés, responde \"no\" y no vuelvo a escribir. Gracias.";
    const headers = [
      `From: ${encHeader(opts.deNombre)} <${opts.deEmail}>`,
      `To: <${opts.para}>`,
      `Subject: ${encHeader(opts.asunto)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
    ];
    if (opts.inReplyTo) {
      headers.push(`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`);
    }
    const mime = headers.join("\r\n") + "\r\n\r\n" + opts.cuerpo + optOut;

    const body: Record<string, string> = { raw: base64url(mime) };
    if (opts.threadId) body.threadId = opts.threadId;

    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) return { ok: false, error: `Gmail send ${res.status}: ${await res.text()}` };
    const data = await res.json();
    return { ok: true, threadId: data.threadId, messageId: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface RespuestaGmail {
  threadId: string;
  messageId: string;
  from: string;
  fecha: string;
  extracto: string;
}

/**
 * Trae respuestas recientes en la bandeja: mensajes entrantes (no enviados por
 * nosotros) de los últimos `horas`. El caller los casa con prospectos por
 * threadId o por email del remitente. Devuelve [] si algo falla.
 */
export async function leerRespuestas(horas = 3): Promise<RespuestaGmail[]> {
  try {
    const token = await accessToken();
    const auth = { Authorization: `Bearer ${token}` };
    const after = Math.floor((Date.now() - horas * 3600_000) / 1000);
    // Entrantes de la bandeja principal, excluyendo lo que mandamos nosotros.
    const q = encodeURIComponent(`in:inbox -from:me newer_than:1d after:${after}`);
    const lista = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=50`,
      { headers: auth },
    );
    if (!lista.ok) return [];
    const ids: { id: string }[] = (await lista.json())?.messages ?? [];

    const out: RespuestaGmail[] = [];
    for (const { id } of ids) {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: auth },
      );
      if (!r.ok) continue;
      const m = await r.json();
      const hdr = (n: string): string =>
        (m?.payload?.headers ?? []).find(
          (h: any) => h.name?.toLowerCase() === n,
        )?.value ?? "";
      out.push({
        threadId: m.threadId,
        messageId: id,
        from: hdr("from"),
        fecha: hdr("date"),
        extracto: (m?.snippet ?? "").slice(0, 600),
      });
    }
    return out;
  } catch {
    return [];
  }
}
