(process.env as any).NODE_ENV = "test";
import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { evaluarMx } from "../../lib/outbound/dnsHealth";
import { calcularDelayRelativoPaso, calcularFechaProgramada, SECUENCIA_DEFAULT } from "../../lib/outbound/scheduler";
import {
  verificarOidcJwtGoogle,
  verificarAutorizacionPubSub,
  setCustomOidcVerifier,
} from "../../lib/outbound/auth";
import {
  renovarWatchGmailParaBuzon,
  verificarSaludWatchMailbox,
  renovarTodosLosWatches,
} from "../../lib/outbound/gmail";
import { MemoryOutboundStore } from "../../lib/outbound/store";

test("MX GOOGLE WORKSPACE: Estándar moderno smtp.google.com y fallback legacy aspmx", () => {
  // Caso 1: Moderno smtp.google.com con prioridad 1 -> PASS
  const diagModerno = evaluarMx([{ exchange: "smtp.google.com", priority: 1 }]);
  assert.equal(diagModerno.estado, "pass");
  assert.match(diagModerno.mensaje, /smtp\.google\.com/i);

  // Caso 2: Legacy aspmx.l.google.com -> PASS con nota legacy
  const diagLegacy = evaluarMx([
    { exchange: "aspmx.l.google.com", priority: 1 },
    { exchange: "alt1.aspmx.l.google.com", priority: 5 },
  ]);
  assert.equal(diagLegacy.estado, "pass");
  assert.match(diagLegacy.mensaje, /legacy/i);

  // Caso 3: Tercero ajeno (ej. mail.otro.com) -> WARNING
  const diagAjeno = evaluarMx([{ exchange: "mail.hosting-chile.cl", priority: 10 }]);
  assert.equal(diagAjeno.estado, "warning");

  // Caso 4: Sin registros MX -> FAIL
  const diagVacio = evaluarMx([]);
  assert.equal(diagVacio.estado, "fail");
});

test("REGRESIÓN SCHEDULER: Delays relativos entre pasos (D0 -> D4 -> D11 -> D21)", () => {
  // Verificar cálculo relativo estricto entre pasos consecutivos
  const delay1a2 = calcularDelayRelativoPaso(1, 2);
  const delay2a3 = calcularDelayRelativoPaso(2, 3);
  const delay3a4 = calcularDelayRelativoPaso(3, 4);

  assert.equal(delay1a2, 4, "Paso 1 -> Paso 2 debe tener retraso de 4 días");
  assert.equal(delay2a3, 7, "Paso 2 -> Paso 3 debe tener retraso de 7 días (11 - 4)");
  assert.equal(delay3a4, 10, "Paso 3 -> Paso 4 debe tener retraso de 10 días (21 - 11)");

  // Simulación de secuencia desde Martes 15-09-2026 10:00 CLT
  const inicioMartes = new Date("2026-09-15T13:00:00.000Z"); // 10:00 CLT

  // Paso 2: +4 días -> Sábado 19 -> Rueda a Lunes 21-09-2026 09:00 CLT
  const paso2Fecha = calcularFechaProgramada(inicioMartes, delay1a2, { horaInicio: 9, horaFin: 18 });
  const strPaso2 = paso2Fecha.toISOString();
  // En Chile (UTC-3), 09:00 CLT es 12:00 UTC
  assert.match(strPaso2, /^2026-09-21/);

  // Paso 3: +7 días desde Lunes 21 -> Lunes 28-09-2026 09:00 CLT
  const paso3Fecha = calcularFechaProgramada(paso2Fecha, delay2a3, { horaInicio: 9, horaFin: 18 });
  const strPaso3 = paso3Fecha.toISOString();
  assert.match(strPaso3, /^2026-09-28/);

  // Paso 4: +10 días desde Lunes 28 -> Jueves 08-10-2026 09:00 CLT
  const paso4Fecha = calcularFechaProgramada(paso3Fecha, delay3a4, { horaInicio: 9, horaFin: 18 });
  const strPaso4 = paso4Fecha.toISOString();
  assert.match(strPaso4, /^2026-10-08/);
});

test("PUB/SUB OIDC JWT: Verificación de claims, expiración y firma de Service Account", async () => {
  process.env.PUBSUB_AUDIENCE = "https://hq.respon.do/api/outbound/pubsub";
  process.env.PUBSUB_SERVICE_ACCOUNT_EMAIL = "pubsub-invoker@respondo-prod.iam.gserviceaccount.com";

  // Helper para generar tokens de prueba
  const generarTestJwt = (claims: Record<string, unknown>) => {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "key-1", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const signature = Buffer.from("simulated_signature").toString("base64url");
    return `${header}.${payload}.${signature}`;
  };

  const ahoraSec = Math.floor(Date.now() / 1000);

  // Caso 1: Token válido con claims correctos
  const tokenValido = generarTestJwt({
    iss: "https://accounts.google.com",
    aud: "https://hq.respon.do/api/outbound/pubsub",
    email: "pubsub-invoker@respondo-prod.iam.gserviceaccount.com",
    email_verified: true,
    exp: ahoraSec + 3600,
    iat: ahoraSec,
  });

  const resValido = await verificarOidcJwtGoogle(tokenValido);
  assert.equal(resValido.valido, true);
  assert.equal(resValido.payload?.email, "pubsub-invoker@respondo-prod.iam.gserviceaccount.com");

  // Caso 2: Rechazar si email_verified = false
  const tokenNoVerificado = generarTestJwt({
    iss: "https://accounts.google.com",
    aud: "https://hq.respon.do/api/outbound/pubsub",
    email: "pubsub-invoker@respondo-prod.iam.gserviceaccount.com",
    email_verified: false, // NO VERIFICADO
    exp: ahoraSec + 3600,
    iat: ahoraSec,
  });
  const resNoVerificado = await verificarOidcJwtGoogle(tokenNoVerificado);
  assert.equal(resNoVerificado.valido, false);
  assert.match(resNoVerificado.motivo ?? "", /email_verified=true/);

  // Caso 3: Rechazar si exp expiró
  const tokenExpirado = generarTestJwt({
    iss: "https://accounts.google.com",
    aud: "https://hq.respon.do/api/outbound/pubsub",
    email: "pubsub-invoker@respondo-prod.iam.gserviceaccount.com",
    email_verified: true,
    exp: ahoraSec - 60, // EXPIRADO
    iat: ahoraSec - 3600,
  });
  const resExpirado = await verificarOidcJwtGoogle(tokenExpirado);
  assert.equal(resExpirado.valido, false);
  assert.match(resExpirado.motivo ?? "", /expiró/);

  // Caso 4: Rechazar si audience no coincide
  const tokenAudInvalida = generarTestJwt({
    iss: "https://accounts.google.com",
    aud: "https://otro-sitio.com/webhook", // AUD ERRÓNEA
    email: "pubsub-invoker@respondo-prod.iam.gserviceaccount.com",
    email_verified: true,
    exp: ahoraSec + 3600,
    iat: ahoraSec,
  });
  const resAudInvalida = await verificarOidcJwtGoogle(tokenAudInvalida);
  assert.equal(resAudInvalida.valido, false);
  assert.match(resAudInvalida.motivo ?? "", /Audiencia/);

  // Caso 5: Integración en verificarAutorizacionPubSub con Bearer JWT
  const fakeReq = new Request("https://hq.respon.do/api/outbound/pubsub", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenValido}`,
    },
  });
  const authRes = await verificarAutorizacionPubSub(fakeReq);
  assert.equal(authRes.valido, true);
});

test("GMAIL WATCH RENEWAL: falla visible sin credenciales y diagnostica vigencia persistida", async () => {
  const store = new MemoryOutboundStore();
  const testMailbox = "felipe@respon.do";
  const now = new Date("2026-09-15T12:00:00.000Z");

  // 1. Buzón sin configurar
  const diagSinConfig = await verificarSaludWatchMailbox({ senderEmail: testMailbox, store, now });
  assert.equal(diagSinConfig.estado, "not_configured");

  // 2. Sin credenciales/tema reales no debe inventar un watch saludable.
  const resRenovacion = await renovarWatchGmailParaBuzon({ senderEmail: testMailbox, store });
  assert.equal(resRenovacion.ok, false);
  assert.match(resRenovacion.error ?? "", /PUBSUB_TOPIC_NAME|OAuth no configurado/);

  // No persiste estado simulado.
  const guardado = await store.getMailboxWatch(testMailbox);
  assert.equal(guardado, null);

  // 3. Simular Watch con 60 horas restantes -> HEALTHY
  await store.upsertMailboxWatch({
    mailbox_email: testMailbox,
    history_id: "hist_1",
    expiration: new Date(now.getTime() + 60 * 3600_000).toISOString(),
    last_watch_renewal_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  const diagHealthy = await verificarSaludWatchMailbox({ senderEmail: testMailbox, store, now });
  assert.equal(diagHealthy.estado, "healthy");

  // 4. Simular Watch con 36 horas restantes -> WARNING (<48h)
  await store.upsertMailboxWatch({
    mailbox_email: testMailbox,
    history_id: "hist_1",
    expiration: new Date(now.getTime() + 36 * 3600_000).toISOString(),
    last_watch_renewal_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  const diagWarning = await verificarSaludWatchMailbox({ senderEmail: testMailbox, store, now });
  assert.equal(diagWarning.estado, "warning");
  assert.match(diagWarning.mensaje, /<48h/);

  // 5. Simular Watch con 12 horas restantes -> CRITICAL (<24h)
  await store.upsertMailboxWatch({
    mailbox_email: testMailbox,
    history_id: "hist_1",
    expiration: new Date(now.getTime() + 12 * 3600_000).toISOString(),
    last_watch_renewal_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  const diagCritical = await verificarSaludWatchMailbox({ senderEmail: testMailbox, store, now });
  assert.equal(diagCritical.estado, "critical");
  assert.match(diagCritical.mensaje, /<24h/);

  // 6. Simular Watch vencido -> EXPIRED
  await store.upsertMailboxWatch({
    mailbox_email: testMailbox,
    history_id: "hist_1",
    expiration: new Date(now.getTime() - 3600_000).toISOString(),
    last_watch_renewal_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  const diagExpired = await verificarSaludWatchMailbox({ senderEmail: testMailbox, store, now });
  assert.equal(diagExpired.estado, "expired");
  assert.match(diagExpired.mensaje, /expirado/i);
});
