/**
 * INTEGRACIÓN CON GOOGLE WORKSPACE / GMAIL API — Outbound V1
 *
 * Principios y Decisiones:
 * 1. Mínimo Privilegio (Least Privilege Scopes):
 *    - `https://www.googleapis.com/auth/gmail.send`: Solo para emitir correos.
 *    - `https://www.googleapis.com/auth/gmail.readonly`: Para leer respuestas y rebotados sin permiso de borrado ni cambio de claves.
 *    - CERO permisos administrativos de Workspace ni Domain-Wide Delegation.
 * 2. OAuth2 individual por mailbox (Marcelo, Outbound 1, Outbound 2).
 * 3. REST puro sin SDK pesado.
 * 4. Threading nativo RFC 2822 / RFC 2047 (In-Reply-To y References).
 */

import { type OutboundStore } from "./store";
import { type MailboxWatchStatus } from "./types";

export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export interface EnvioGmailResultado {
  ok: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

export interface MensajeEntranteGmail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  headers: Record<string, string>;
  rawBody?: string;
}

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}

const tokenCachePorSender: Map<string, TokenCacheEntry> = new Map();

/** Obtiene el refresh token específico configurado para el email del sender */
export function obtenerRefreshTokenParaSender(senderEmail: string): string | null {
  const norm = senderEmail.toLowerCase().trim();
  const localPart = norm.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();

  if (localPart && process.env[`GMAIL_REFRESH_TOKEN_${localPart}`]) {
    return process.env[`GMAIL_REFRESH_TOKEN_${localPart}`]!;
  }

  // Mapeo por convención de variables de entorno
  if (norm.includes("marcelo")) {
    return process.env.GMAIL_REFRESH_TOKEN_MARCELO || process.env.GMAIL_REFRESH_TOKEN || null;
  }
  if (norm.includes("felipe") || norm.includes("contacto") || norm.includes("outbound1")) {
    return process.env.GMAIL_REFRESH_TOKEN_OUTBOUND1 || process.env.GMAIL_REFRESH_TOKEN || null;
  }
  if (norm.includes("sofia") || norm.includes("crecimiento") || norm.includes("outbound2") || norm.includes("ventas")) {
    return process.env.GMAIL_REFRESH_TOKEN_OUTBOUND2 || process.env.GMAIL_REFRESH_TOKEN || null;
  }

  return process.env.GMAIL_REFRESH_TOKEN || null;
}

/** Obtiene un access_token fresco para el mailbox especificado */
export async function obtenerAccessToken(senderEmail: string): Promise<string> {
  const norm = senderEmail.toLowerCase().trim();
  const cached = tokenCachePorSender.get(norm);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.accessToken;
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = obtenerRefreshTokenParaSender(norm);

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      `Faltan credenciales OAuth para ${norm}: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET o Refresh Token`,
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    let oauthCode = "oauth_error";
    try {
      const body = await res.json();
      oauthCode = typeof body?.error === "string" ? body.error : oauthCode;
    } catch {
      // El detalle remoto puede contener datos sensibles; no se propaga.
    }
    throw new Error(`Error al renovar token OAuth para ${norm} (${res.status}, ${oauthCode})`);
  }

  const data = await res.json();
  const entry: TokenCacheEntry = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 300_000, // 5 min de holgura
  };
  tokenCachePorSender.set(norm, entry);
  return entry.accessToken;
}

function base64url(s: string): string {
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Codifica encabezados con acentos (RFC 2047) */
function encHeader(s: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(s)
    ? s
    : `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`;
}

export function formatearMessageIdRfc2822(id: string): string {
  const trimmed = id.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed;
  }
  return `<${trimmed}>`;
}

/** Construye un mensaje MIME RFC 2822 con codificación UTF-8 estricta y threading nativo */
export function construirMimeMensaje(params: {
  deNombre: string;
  deEmail: string;
  para: string;
  asunto: string;
  cuerpo: string;
  inReplyToMessageId?: string | null;
  references?: string[];
}): string {
  const { deNombre, deEmail, para, asunto, cuerpo, inReplyToMessageId, references } = params;

  const headers = [
    `From: ${encHeader(deNombre)} <${deEmail}>`,
    `To: <${para}>`,
    `Subject: ${encHeader(asunto)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];

  if (inReplyToMessageId) {
    const rfcId = formatearMessageIdRfc2822(inReplyToMessageId);
    headers.push(`In-Reply-To: ${rfcId}`);
    const refs = references && references.length > 0
      ? references.map(formatearMessageIdRfc2822).join(" ")
      : rfcId;
    headers.push(`References: ${refs}`);
  }

  return headers.join("\r\n") + "\r\n\r\n" + cuerpo;
}

/** Envía un email de texto plano usando Gmail API REST */
export async function enviarMensajeGmail(params: {
  deNombre: string;
  deEmail: string;
  para: string;
  asunto: string;
  cuerpo: string;
  inReplyToMessageId?: string | null;
  threadId?: string | null;
}): Promise<EnvioGmailResultado> {
  const { deNombre, deEmail, para, asunto, cuerpo, inReplyToMessageId, threadId } = params;

  try {
    const token = await obtenerAccessToken(deEmail);

    const mime = construirMimeMensaje({
      deNombre,
      deEmail,
      para,
      asunto,
      cuerpo,
      inReplyToMessageId,
    });

    const bodyPayload: Record<string, string> = { raw: base64url(mime) };
    if (threadId) {
      bodyPayload.threadId = threadId;
    }

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `Gmail API ${res.status}: ${err}` };
    }

    const data = await res.json();
    return {
      ok: true,
      messageId: data.id,
      threadId: data.threadId,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Lista mensajes recientes en la bandeja de entrada para detectar respuestas o rebotes */
export async function listarMensajesBandeja(
  senderEmail: string,
  filtroQuery = "in:inbox -from:me newer_than:2d",
  maxResults = 25,
): Promise<MensajeEntranteGmail[]> {
  const token = await obtenerAccessToken(senderEmail);
    const q = encodeURIComponent(filtroQuery);

    const listaRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!listaRes.ok) throw new Error(`Gmail list falló para ${senderEmail} (${listaRes.status})`);
    const listaData = await listaRes.json();
    const ids: { id: string }[] = listaData.messages ?? [];

    const resultado: MensajeEntranteGmail[] = [];
    for (const { id } of ids) {
      resultado.push(await obtenerMensajeGmailPorId(senderEmail, id, token));
    }

    return resultado;
}

/** Fetches one concrete Gmail message, used by Pub/Sub history without rescanning the inbox. */
export async function obtenerMensajeGmailPorId(
  senderEmail: string,
  messageId: string,
  accessToken?: string,
): Promise<MensajeEntranteGmail> {
  const token = accessToken ?? await obtenerAccessToken(senderEmail);
  const msgRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!msgRes.ok) throw new Error(`Gmail get falló para ${senderEmail} (${msgRes.status})`);
  const m = await msgRes.json();
  const headersObj: Record<string, string> = {};
  for (const h of m.payload?.headers ?? []) {
    if (h.name && h.value) headersObj[h.name.toLowerCase()] = h.value;
  }
  return {
    id: m.id,
    threadId: m.threadId,
    from: headersObj.from ?? "",
    to: headersObj.to ?? "",
    subject: headersObj.subject ?? "",
    date: headersObj.date ?? "",
    snippet: m.snippet ?? "",
    headers: headersObj,
  };
}

export function estadoConfiguracionOAuth(senderEmail: string): { configured: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.GMAIL_CLIENT_ID) missing.push("GMAIL_CLIENT_ID");
  if (!process.env.GMAIL_CLIENT_SECRET) missing.push("GMAIL_CLIENT_SECRET");
  if (!obtenerRefreshTokenParaSender(senderEmail)) missing.push("refresh_token_mailbox");
  return { configured: missing.length === 0, missing };
}

/** Configura la suscripción Push de Gmail hacia Google Cloud Pub/Sub */
export async function configurarWatchGmail(params: {
  senderEmail: string;
  topicName: string;
}): Promise<{ historyId: string; expiration: string }> {
  const token = await obtenerAccessToken(params.senderEmail);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topicName: params.topicName,
      labelIds: ["INBOX"],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error en gmail.watch para ${params.senderEmail} (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    historyId: data.historyId,
    expiration: new Date(Number(data.expiration)).toISOString(),
  };
}

/** Detiene la suscripción de Gmail Watch */
export async function detenerWatchGmail(senderEmail: string): Promise<boolean> {
  try {
    const token = await obtenerAccessToken(senderEmail);
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/stop", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Consulta el historial de cambios de Gmail desde un historyId dado */
export async function obtenerHistorialCambiosGmail(params: {
  senderEmail: string;
  startHistoryId: string;
}): Promise<{ historyId: string; messagesAdded: { id: string; threadId: string }[] }> {
  const token = await obtenerAccessToken(params.senderEmail);
  const q = encodeURIComponent(params.startHistoryId);

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${q}&historyTypes=messageAdded`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) {
    return { historyId: params.startHistoryId, messagesAdded: [] };
  }

  const data = await res.json();
  const messagesAdded: { id: string; threadId: string }[] = [];

  for (const h of data.history ?? []) {
    for (const m of h.messagesAdded ?? []) {
      if (m.message?.id && m.message?.threadId) {
        messagesAdded.push({ id: m.message.id, threadId: m.message.threadId });
      }
    }
  }

  return {
    historyId: data.historyId ?? params.startHistoryId,
    messagesAdded,
  };
}

/**
 * COMPROBACIÓN FRESCA PRE-ENVÍO (Pre-Send Fresh Check):
 * Inmediatamente antes de emitir un toque de seguimiento (Step 2, 3 o 4),
 * consulta Gmail en vivo para verificar si el prospecto respondió en el hilo
 * después de nuestro último envío, cerrando definitivamente cualquier ventana de race condition.
 */
type FrescuraCheckerFn = (params: {
  senderEmail: string;
  threadId: string;
  contactEmail: string;
}) => Promise<{ respuestaDetectada: boolean; motivo?: string }>;

let customFrescuraChecker: FrescuraCheckerFn | null = null;

export function setCustomFrescuraChecker(fn: FrescuraCheckerFn | null) {
  customFrescuraChecker = fn;
}

export async function verificarFrescuraHiloEnGmail(params: {
  senderEmail: string;
  threadId: string;
  contactEmail: string;
}): Promise<{ respuestaDetectada: boolean; motivo?: string }> {
  if (customFrescuraChecker) {
    return await customFrescuraChecker(params);
  }

  // Si estamos en DRY_RUN simulado o prueba unitaria sin tokens reales
  if (process.env.DRY_RUN === "true" || !process.env.GMAIL_CLIENT_ID) {
    return { respuestaDetectada: false };
  }

  try {
    const token = await obtenerAccessToken(params.senderEmail);
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${params.threadId}?format=metadata&metadataHeaders=From`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok) {
      return { respuestaDetectada: false };
    }

    const data = await res.json();
    const messages = data.messages ?? [];

    const normContact = params.contactEmail.toLowerCase().trim();
    const normSender = params.senderEmail.toLowerCase().trim();

    for (const msg of messages) {
      const fromHeader = msg.payload?.headers?.find((h: { name: string; value: string }) => h.name?.toLowerCase() === "from")?.value?.toLowerCase() ?? "";
      if (fromHeader.includes(normContact) && !fromHeader.includes(normSender)) {
        return {
          respuestaDetectada: true,
          motivo: `Respuesta detectada en comprobación fresca de hilo Gmail ${params.threadId} proveniente de ${normContact}`,
        };
      }
    }

    return { respuestaDetectada: false };
  } catch (err) {
    return {
      respuestaDetectada: false,
      motivo: `Error al verificar hilo en Gmail: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Renueva la suscripción de Gmail Watch (Google Cloud Pub/Sub) para un buzón específico.
 * Actualiza history_id, expiration y last_watch_renewal_at en outbound_mailbox_watches.
 */
export async function renovarWatchGmailParaBuzon(params: {
  senderEmail: string;
  topicName?: string;
  store: OutboundStore;
}): Promise<{ ok: boolean; historyId?: string; expiration?: string; error?: string }> {
  const { senderEmail, store } = params;
  const topicName = params.topicName || process.env.PUBSUB_TOPIC_NAME;

  if (!topicName) return { ok: false, error: "Falta PUBSUB_TOPIC_NAME." };
  const oauth = estadoConfiguracionOAuth(senderEmail);
  if (!oauth.configured) {
    return { ok: false, error: `OAuth no configurado para ${senderEmail}: ${oauth.missing.join(", ")}` };
  }

  try {
    const watchRes = await configurarWatchGmail({ senderEmail, topicName });
    const { historyId, expiration } = watchRes;

    const currentWatch = await store.getMailboxWatch(senderEmail);

    await store.upsertMailboxWatch({
      mailbox_email: senderEmail.toLowerCase().trim(),
      history_id: historyId || currentWatch?.history_id || null,
      expiration,
      last_notification_at: currentWatch?.last_notification_at ?? null,
      last_watch_renewal_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.logEvent({
      tipo: "dns_check", // infraestructura audit
      metadata: {
        tipo_accion: "gmail_watch_renewal",
        mailbox: senderEmail,
        expiration,
        historyId,
      },
    });

    return { ok: true, historyId, expiration };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: errorMsg };
  }
}

export type EstadoSaludWatch = "healthy" | "warning" | "critical" | "expired" | "not_configured";

export interface DiagnosticoWatchMailbox {
  mailboxEmail: string;
  estado: EstadoSaludWatch;
  horasRestantes: number | null;
  expiration: string | null;
  lastRenewalAt: string | null;
  mensaje: string;
}

/**
 * Verifica la salud y vigencia del watch de un buzón en outbound_mailbox_watches.
 * Umbrales mandatorios:
 * - <48h restantes: WARNING (alerta de renovación requerida)
 * - <24h restantes: CRITICAL (alerta crítica de riesgo inminente de desconexión)
 * - <= 0h: EXPIRED
 */
export async function verificarSaludWatchMailbox(params: {
  senderEmail: string;
  store: OutboundStore;
  now?: Date;
}): Promise<DiagnosticoWatchMailbox> {
  const { senderEmail, store } = params;
  const now = params.now ?? new Date();
  const watch = await store.getMailboxWatch(senderEmail);

  if (!watch || !watch.expiration) {
    return {
      mailboxEmail: senderEmail,
      estado: "not_configured",
      horasRestantes: null,
      expiration: null,
      lastRenewalAt: null,
      mensaje: `No existe suscripción Gmail Watch configurada para ${senderEmail}.`,
    };
  }

  const expDate = new Date(watch.expiration);
  const diffMs = expDate.getTime() - now.getTime();
  const horasRestantes = Math.round((diffMs / 3600_000) * 10) / 10;

  if (diffMs <= 0) {
    return {
      mailboxEmail: senderEmail,
      estado: "expired",
      horasRestantes: 0,
      expiration: watch.expiration,
      lastRenewalAt: watch.last_watch_renewal_at ?? null,
      mensaje: `CRÍTICO: Watch expirado para ${senderEmail}. Las notificaciones en tiempo real están caídas.`,
    };
  }

  if (horasRestantes < 24) {
    return {
      mailboxEmail: senderEmail,
      estado: "critical",
      horasRestantes,
      expiration: watch.expiration,
      lastRenewalAt: watch.last_watch_renewal_at ?? null,
      mensaje: `CRÍTICO: Watch para ${senderEmail} expira en ${horasRestantes}h (<24h). Riesgo inminente de perder push de respuestas.`,
    };
  }

  if (horasRestantes < 48) {
    return {
      mailboxEmail: senderEmail,
      estado: "warning",
      horasRestantes,
      expiration: watch.expiration,
      lastRenewalAt: watch.last_watch_renewal_at ?? null,
      mensaje: `ALERTA: Watch para ${senderEmail} expira en ${horasRestantes}h (<48h). Renovación automática necesaria.`,
    };
  }

  return {
    mailboxEmail: senderEmail,
    estado: "healthy",
    horasRestantes,
    expiration: watch.expiration,
    lastRenewalAt: watch.last_watch_renewal_at ?? null,
    mensaje: `Watch saludable para ${senderEmail} (${horasRestantes}h restantes).`,
  };
}

/**
 * Ejecuta la renovación diaria de todos los buzones activos con watch.
 */
export async function renovarTodosLosWatches(params: {
  store: OutboundStore;
  topicName?: string;
}): Promise<{
  procesados: number;
  renovados: string[];
  fallidos: Array<{ email: string; error: string }>;
  diagnosticos: DiagnosticoWatchMailbox[];
}> {
  const { store, topicName } = params;
  const senders = await store.getSenders();
  const activos = senders.filter((s) => s.active && s.health_status !== "paused");

  const resultado = {
    procesados: activos.length,
    renovados: [] as string[],
    fallidos: [] as Array<{ email: string; error: string }>,
    diagnosticos: [] as DiagnosticoWatchMailbox[],
  };

  for (const sender of activos) {
    const res = await renovarWatchGmailParaBuzon({
      senderEmail: sender.email,
      topicName,
      store,
    });

    if (res.ok) {
      resultado.renovados.push(sender.email);
    } else {
      resultado.fallidos.push({ email: sender.email, error: res.error ?? "Fallo desconocido" });
    }

    const diag = await verificarSaludWatchMailbox({
      senderEmail: sender.email,
      store,
    });
    resultado.diagnosticos.push(diag);
  }

  return resultado;
}
