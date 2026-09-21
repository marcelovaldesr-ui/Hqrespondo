/**
 * WEBHOOK DE RECEPCIÓN PUSH — Google Cloud Pub/Sub (Gmail Watch)
 *
 * Endpoint: POST /api/outbound/pubsub
 *
 * Recibe eventos en tiempo real desde Google Cloud Pub/Sub cada vez que
 * ingresa un correo a cualquier buzón de Google Workspace conectado.
 *
 * Seguridad:
 * 1. Google OIDC Bearer o secreto dedicado en x-pubsub-token.
 * 2. Protección contra Replay Attacks e Idempotencia (Message-ID deduplication).
 * 3. Rate Limiting defensivo.
 * 4. Procesamiento inmediato de respuestas (detiene la secuencia antes de cualquier follow-up).
 */

import { NextResponse } from "next/server";
import { verificarAutorizacionPubSub, validarReplayPubSub, marcarPubSubProcesado, comprobarRateLimit } from "@/lib/outbound/auth";
import { getOutboundStore } from "@/lib/outbound/runtimeStore";
import { obtenerHistorialCambiosGmail, obtenerMensajeGmailPorId } from "@/lib/outbound/gmail";
import { procesarMensajeEntrante } from "@/lib/outbound/replies";

export async function POST(req: Request) {
  // 1. Rate Limiting por IP o identificador
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const rateCheck = comprobarRateLimit(`pubsub_${ip}`, 120);
  if (!rateCheck.permitido) {
    return NextResponse.json({ error: "Demasiadas peticiones (Rate limit excedido)" }, { status: 429 });
  }

  // 2. Validación de Seguridad y Token (Google OIDC JWT o Token Secreto)
  const auth = await verificarAutorizacionPubSub(req);
  if (!auth.valido) {
    return NextResponse.json({ error: auth.motivo ?? "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (!body?.message?.data) {
      return NextResponse.json({ error: "Payload de Pub/Sub malformado (falta message.data)" }, { status: 400 });
    }

    const messageId = body.message.messageId ?? "msg_" + Math.random().toString(36);
    const publishTime = body.message.publishTime;

    // 3. Protección contra Replay Attack
    const esMensajeValido = validarReplayPubSub(messageId, publishTime);
    if (!esMensajeValido) {
      // Respondemos 200 para que Pub/Sub no siga reintentando un mensaje ya procesado o expirado
      return NextResponse.json({ ok: true, deduplicado: true });
    }

    // 4. Decodificar data Base64 enviada por Google
    const decodedRaw = Buffer.from(body.message.data, "base64").toString("utf-8");
    let decodedData: { emailAddress?: string; historyId?: string };

    try {
      decodedData = JSON.parse(decodedRaw);
    } catch {
      return NextResponse.json({ error: "Data base64 no contiene JSON válido" }, { status: 400 });
    }

    const mailboxEmail = decodedData.emailAddress;
    const historyId = decodedData.historyId;

    if (!mailboxEmail) {
      return NextResponse.json({ error: "emailAddress ausente en notificación" }, { status: 400 });
    }

    const store = getOutboundStore();

    // 5. Consultar estado del watch previo
    const currentWatch = await store.getMailboxWatch(mailboxEmail);
    let respuestasProcesadas = 0;

    // La primera notificación solo establece el cursor. Las siguientes procesan IDs concretos.
    if (currentWatch?.history_id) {
      const historial = await obtenerHistorialCambiosGmail({
        senderEmail: mailboxEmail,
        startHistoryId: currentWatch.history_id,
      });

      const idsUnicos = [...new Set(historial.messagesAdded.map((message) => message.id))];
      for (const id of idsUnicos) {
        const msg = await obtenerMensajeGmailPorId(mailboxEmail, id);
        const res = await procesarMensajeEntrante(msg, store);
        if (res.procesado && res.secuenciaDetenida) {
          respuestasProcesadas++;
        }
      }

      // 6. Actualizar historyId para la siguiente notificación
      await store.upsertMailboxWatch({
        mailbox_email: mailboxEmail,
        history_id: historyId || historial.historyId,
        expiration: currentWatch?.expiration || null,
        last_notification_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else {
      await store.upsertMailboxWatch({
        mailbox_email: mailboxEmail,
        history_id: historyId || null,
        expiration: null,
        last_notification_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    marcarPubSubProcesado(messageId);
    return NextResponse.json({
      ok: true,
      mailboxEmail,
      historyId,
      respuestasProcesadas,
    });
  } catch (error) {
    console.error("Error en webhook Pub/Sub:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno procesando Pub/Sub" },
      { status: 500 },
    );
  }
}
