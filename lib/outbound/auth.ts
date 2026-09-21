/**
 * AUTORIZACIÓN Y SEGURIDAD PARA APIS DE OUTBOUND — Respondo HQ
 *
 * Principios:
 * 1. Fail-closed: Sin token configurado o inválido, deniega acceso con 401.
 * 2. Validación de cabeceras seguras (`x-hq-token`, `Authorization: Bearer`).
 * 3. Validación específica para Google Cloud Pub/Sub Push Subscriptions con verificación de token y replay protection.
 * 4. Rate limiting defensivo en memoria por clave/IP para proteger contra ataques de denegación o bombardeo.
 */

// Caché de mensajes Pub/Sub para protección contra replay attacks (TTL 1 hora)
const pubsubMessageIdsVistos: Map<string, number> = new Map();
// Ventanas de rate limit en memoria: key -> array de timestamps
const rateLimitWindows: Map<string, number[]> = new Map();

/**
 * Valida autenticación estándar para endpoints de HQ / n8n
 */
export function verificarAutorizacionOutbound(req: Request): boolean {
  const tokenConfigurado = process.env.HQ_API_TOKEN || process.env.PROS_CRON_SECRET || process.env.HQ_INTERNAL_TOKEN;
  if (!tokenConfigurado || tokenConfigurado.trim() === "") {
    // Fail-closed por seguridad
    return false;
  }

  // 1. Header x-hq-token
  const xHq = req.headers.get("x-hq-token");
  if (xHq && compararSecreto(xHq, tokenConfigurado)) {
    return true;
  }

  // 2. Header Authorization Bearer
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    const bearerToken = auth.slice(7).trim();
    if (compararSecreto(bearerToken, tokenConfigurado)) {
      return true;
    }
  }

  return false;
}

import crypto from "node:crypto";

function compararSecreto(recibido: string, esperado: string): boolean {
  const a = Buffer.from(recibido.trim());
  const b = Buffer.from(esperado.trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Identity injected by the Basic Auth middleware for human HQ actions. */
export function verificarUsuarioHq(req: Request): string | null {
  const user = req.headers.get("x-hq-user")?.trim();
  return user || null;
}

export interface GoogleOidcPayload {
  iss: string;
  aud: string;
  sub?: string;
  email: string;
  email_verified: boolean;
  exp: number;
  iat: number;
  [key: string]: unknown;
}

export interface OidcVerificationResult {
  valido: boolean;
  motivo?: string;
  payload?: GoogleOidcPayload;
}

type OidcVerifierFn = (token: string, req?: Request) => Promise<OidcVerificationResult>;
let customOidcVerifier: OidcVerifierFn | null = null;

export function setCustomOidcVerifier(fn: OidcVerifierFn | null) {
  customOidcVerifier = fn;
}

interface JwkKey {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

let googleCertsCache: { keys: JwkKey[]; expiresAt: number } | null = null;

export async function obtenerClavesPublicasGoogle(): Promise<JwkKey[]> {
  const ahora = Date.now();
  if (googleCertsCache && ahora < googleCertsCache.expiresAt) {
    return googleCertsCache.keys;
  }

  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
    if (!res.ok) return [];
    const data = await res.json();
    const keys: JwkKey[] = data.keys || [];
    googleCertsCache = {
      keys,
      expiresAt: ahora + 3600_000,
    };
    return keys;
  } catch {
    return [];
  }

}

/**
 * Valida un token OIDC JWT emitido por Google Cloud Pub/Sub
 */
export async function verificarOidcJwtGoogle(token: string): Promise<OidcVerificationResult> {
  if (customOidcVerifier) {
    return await customOidcVerifier(token);
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valido: false, motivo: "El token OIDC no tiene el formato JWT esperado (3 partes)." };
  }

  let header: { alg?: string; kid?: string; typ?: string };
  let payload: GoogleOidcPayload;

  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf-8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
  } catch {
    return { valido: false, motivo: "Cabecera o payload de JWT malformado o no es JSON válido." };
  }

  if (header.alg !== "RS256") {
    return { valido: false, motivo: "El token OIDC debe usar RS256." };
  }

  // 1. Validar emisor (iss)
  const emisoresValidos = ["https://accounts.google.com", "accounts.google.com"];
  if (!payload.iss || !emisoresValidos.includes(payload.iss)) {
    return { valido: false, motivo: `Emisor de JWT inválido: ${payload.iss}. Esperado: accounts.google.com.` };
  }

  // 2. Validar email_verified == true
  if (payload.email_verified !== true) {
    return { valido: false, motivo: "La cuenta de servicio de Google no tiene email_verified=true." };
  }

  // 3. Validar expiración (exp)
  const ahoraSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= ahoraSec) {
    return { valido: false, motivo: `El token OIDC expiró (exp: ${payload.exp}, ahora: ${ahoraSec}).` };
  }
  if (!payload.iat || payload.iat > ahoraSec + 300) {
    return { valido: false, motivo: "El token OIDC tiene un iat ausente o futuro." };
  }

  // 4. Validar audiencia (aud) si está configurada
  const audEsperada = process.env.PUBSUB_AUDIENCE;
  const saEsperada = process.env.PUBSUB_SERVICE_ACCOUNT_EMAIL;
  if (process.env.NODE_ENV !== "test" && (!audEsperada || !saEsperada)) {
    return { valido: false, motivo: "Faltan PUBSUB_AUDIENCE o PUBSUB_SERVICE_ACCOUNT_EMAIL." };
  }
  if (audEsperada && payload.aud !== audEsperada) {
    return { valido: false, motivo: `Audiencia (aud) no coincide. Recibido: ${payload.aud}, Esperado: ${audEsperada}.` };
  }

  // 5. Validar service account email si está configurada
  if (saEsperada && payload.email !== saEsperada) {
    return { valido: false, motivo: `Email de service account no autorizado. Recibido: ${payload.email}, Esperado: ${saEsperada}.` };
  }

  // 6. Si estamos en modo de prueba o desarrollo local sin conexión externa
  if (process.env.NODE_ENV === "test" || process.env.SKIP_OIDC_CERT_CHECK === "true") {
    return { valido: true, payload };
  }

  // 7. Verificación criptográfica contra claves públicas de Google
  try {
    const keys = await obtenerClavesPublicasGoogle();
    const key = keys.find((k) => k.kid === header.kid);
    if (!key) {
      return { valido: false, motivo: `No se encontró clave pública de Google para kid=${header.kid}.` };
    }

    const publicKey = crypto.createPublicKey({ key: key as any, format: "jwk" });
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const signature = Buffer.from(parts[2], "base64url");
    const esFirmaValida = verifier.verify(publicKey, signature);

    if (!esFirmaValida) {
      return { valido: false, motivo: "Firma criptográfica de Google OIDC JWT inválida." };
    }

    return { valido: true, payload };
  } catch (err) {
    return {
      valido: false,
      motivo: `Error al verificar firma criptográfica OIDC: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Valida solicitudes push de Google Cloud Pub/Sub, admitiendo OIDC JWT con firma de Google
 * o fallback a token secreto configurado.
 */
export async function verificarAutorizacionPubSub(req: Request): Promise<{
  valido: boolean;
  motivo?: string;
  payload?: GoogleOidcPayload;
}> {
  // 1. Extraer token de cabecera Authorization: Bearer
  const auth = req.headers.get("authorization");
  let token: string | null = null;
  if (auth && auth.startsWith("Bearer ")) {
    token = auth.slice(7).trim();
  }

  // 2. Si no hay Bearer, revisar el header secreto dedicado.
  if (!token) {
    token = req.headers.get("x-pubsub-token");
  }

  if (!token || token.trim() === "") {
    return { valido: false, motivo: "No se proporcionó token de autenticación en la solicitud Pub/Sub." };
  }

  // 3. Si el token tiene formato JWT (3 partes separadas por punto), verificar como Google OIDC
  if (token.split(".").length === 3) {
    return await verificarOidcJwtGoogle(token);
  }

  // 4. Modo fallback para shared secret (testing local o n8n proxy)
  const pubsubSecret = process.env.PUBSUB_VERIFICATION_TOKEN;

  if (pubsubSecret && compararSecreto(token, pubsubSecret)) {
    return { valido: true };
  }

  return { valido: false, motivo: "Token de Pub/Sub inválido o no autorizado." };
}

/**
 * Protección contra Replay Attacks e Idempotencia para Pub/Sub
 */
export function validarReplayPubSub(messageId: string, publishTime?: string): boolean {
  const ahora = Date.now();

  // Limpiar entradas viejas de más de 1 hora
  for (const [id, timestamp] of pubsubMessageIdsVistos.entries()) {
    if (ahora - timestamp > 3600_000) {
      pubsubMessageIdsVistos.delete(id);
    }
  }

  // Si ya fue procesado recientemente, rechazar como replay attack / duplicado
  if (pubsubMessageIdsVistos.has(messageId)) {
    return false;
  }

  // Si el mensaje fue publicado hace más de 2 horas, descartar como mensaje expirado
  if (publishTime) {
    const pubTimestamp = new Date(publishTime).getTime();
    if (ahora - pubTimestamp > 7200_000) {
      return false;
    }
  }

  return true;
}

/** Marks a Pub/Sub delivery only after its database side effects completed. */
export function marcarPubSubProcesado(messageId: string): void {
  pubsubMessageIdsVistos.set(messageId, Date.now());
}

/**
 * Rate Limiting en memoria para proteger endpoints sensibles
 */
export function comprobarRateLimit(
  identificador: string,
  maxPeticionesPorMinuto = 60,
): { permitido: boolean; restantes: number } {
  const ahora = Date.now();
  const ventanaMs = 60_000;

  const timestamps = rateLimitWindows.get(identificador) ?? [];
  const filtrados = timestamps.filter((t) => ahora - t < ventanaMs);

  if (filtrados.length >= maxPeticionesPorMinuto) {
    return { permitido: false, restantes: 0 };
  }

  filtrados.push(ahora);
  rateLimitWindows.set(identificador, filtrados);

  return { permitido: true, restantes: maxPeticionesPorMinuto - filtrados.length };
}
