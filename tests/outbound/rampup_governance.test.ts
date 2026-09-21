/**
 * TESTS DE GOBERNANZA HUMANA DE RAMP-UP — Outbound V1
 *
 * Verificaciones mandatorias:
 * 1. Sender con métricas perfectas NO sube de etapa automáticamente bajo ninguna rutina.
 * 2. Solo una aprobación humana explícita permite la transición Stage N -> Stage N+1.
 * 3. Sender en estado 'paused' NO puede ser promovido de etapa ni siquiera por un humano hasta que se resuelva la causa.
 * 4. Sender en estado 'warning' o 'critical' rechaza la promoción de etapa hasta volver a estar 'healthy'.
 * 5. Subir capacidad por sobre Stage 5 (tope seguro estándar V1) requiere aprobación humana reforzada explícita.
 * 6. El sistema automatizado SÍ puede pausar preventivamente ante degradación, pero NUNCA auto-incrementar.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOutboundStore } from "../../lib/outbound/store";
import {
  evaluarRecomendacionRampup,
  promoverEtapaWarmupHumano,
  pausarPreventivamenteSender,
  calcularLimitesRampup,
  TABLA_ETAPAS_RAMPUP,
} from "../../lib/outbound/senders";

test("RAMP-UP GOVERNANCE 1: Sender con métricas perfectas NO sube de etapa automáticamente", async () => {
  const store = new MemoryOutboundStore();
  const senders = await store.getSenders();
  const senderOutbound1 = senders.find((s) => s.type === "outbound")!;

  // Asegurar que inicia en Stage 1
  await store.updateSender(senderOutbound1.id, {
    warmup_stage: 1,
    new_leads_daily_limit: 1,
    total_messages_daily_limit: 2,
    bounce_rate: 0,
    hard_bounce_rate: 0,
    opt_out_rate: 0,
    reply_rate: 35.0,
    health_status: "healthy",
  });

  const senderActualizado = (await store.getSenderById(senderOutbound1.id))!;

  // Se evalúa recomendación del sistema
  const recomendacion = evaluarRecomendacionRampup(senderActualizado);

  // El sistema solo emite recomendación para el operador humano
  assert.equal(recomendacion.elegibleParaRevisionHumana, true);
  assert.equal(recomendacion.proximaEtapaSugerida, 2);

  // COMPROBACIÓN CRÍTICA: En el store y en runtime el sender permanece estrictamente en Stage 1
  const senderEnStore = (await store.getSenderById(senderOutbound1.id))!;
  assert.equal(senderEnStore.warmup_stage, 1, "PROHIBICIÓN: warmup_stage NO debe cambiar automáticamente");
  assert.equal(senderEnStore.new_leads_daily_limit, 1);
  assert.equal(senderEnStore.total_messages_daily_limit, 2);

  const limites = calcularLimitesRampup(senderEnStore);
  assert.equal(limites.newLeadsLimit, 1);
  assert.equal(limites.totalMessagesLimit, 2);
});

test("RAMP-UP GOVERNANCE 2: Solo una aprobación humana explícita permite la transición de etapa", async () => {
  const store = new MemoryOutboundStore();
  const senders = await store.getSenders();
  const sender = senders.find((s) => s.type === "outbound")!;

  await store.updateSender(sender.id, {
    warmup_stage: 1,
    new_leads_daily_limit: 1,
    total_messages_daily_limit: 2,
    health_status: "healthy",
    paused_reason: null,
  });

  // Intento 1: Aprobación sin operador humano ("system") -> DEBE FALLAR
  await assert.rejects(
    async () => {
      await promoverEtapaWarmupHumano({
        store,
        senderId: sender.id,
        approvedBy: "system",
        newStage: 2,
        reason: "Auto-promoción periódica",
      });
    },
    /operador humano/i,
    "Debe rechazar 'system' como approved_by",
  );

  // Intento 2: Aprobación sin motivo -> DEBE FALLAR
  await assert.rejects(
    async () => {
      await promoverEtapaWarmupHumano({
        store,
        senderId: sender.id,
        approvedBy: "marcelo@respon-do.com",
        newStage: 2,
        reason: "",
      });
    },
    /motivo/i,
    "Debe rechazar razón vacía",
  );

  // Intento 3: Aprobación humana legítima por Marcelo Valdés -> DEBE ÉXITO
  const registro = await promoverEtapaWarmupHumano({
    store,
    senderId: sender.id,
    approvedBy: "marcelo@respon-do.com",
    newStage: 2,
    reason: "Días 1-3 completados con 0 rebotes y 1 respuesta positiva",
    notes: "Avanzando a Stage 2 según cronograma seguro",
  });

  assert.equal(registro.previous_stage, 1);
  assert.equal(registro.new_stage, 2);
  assert.equal(registro.approved_by, "marcelo@respon-do.com");
  assert.equal(registro.limites_aplicados.newLeadsLimit, 2);
  assert.equal(registro.limites_aplicados.totalMessagesLimit, 3);

  // Verificar actualización en store
  const senderActualizado = (await store.getSenderById(sender.id))!;
  assert.equal(senderActualizado.warmup_stage, 2);
  assert.equal(senderActualizado.new_leads_daily_limit, 2);
  assert.equal(senderActualizado.total_messages_daily_limit, 3);

  // Verificar auditoría en log de eventos
  const eventos = await store.listEvents({ tipo: "review_approved" });
  assert.equal(eventos.length, 1);
  assert.equal((eventos[0].metadata as any).subtipo, "rampup_stage_promoted");
  assert.equal((eventos[0].metadata as any).approved_by, "marcelo@respon-do.com");
});

test("RAMP-UP GOVERNANCE 3: Sender en estado 'paused' NO puede ser promovido aunque un humano lo intente", async () => {
  const store = new MemoryOutboundStore();
  const senders = await store.getSenders();
  const sender = senders.find((s) => s.type === "outbound")!;

  // Sender pausado preventivamente por rebotes transitorios
  await store.updateSender(sender.id, {
    warmup_stage: 1,
    health_status: "paused",
    paused_reason: "Soft bounces detectados en servidor de destino",
  });

  // Operador humano intenta promover sin despausar primero
  await assert.rejects(
    async () => {
      await promoverEtapaWarmupHumano({
        store,
        senderId: sender.id,
        approvedBy: "marcelo@respon-do.com",
        newStage: 2,
        reason: "Intentando forzar aumento de volumen",
      });
    },
    /sender pausado/i,
    "Debe rechazar categóricamente promover un sender que está en pausa",
  );

  // Comprobar que no cambió de etapa
  const senderCheck = (await store.getSenderById(sender.id))!;
  assert.equal(senderCheck.warmup_stage, 1);
});

test("RAMP-UP GOVERNANCE 4: Sender en warning o critical rechaza la promoción de etapa", async () => {
  const store = new MemoryOutboundStore();
  const senders = await store.getSenders();
  const sender = senders.find((s) => s.type === "outbound")!;

  // Sender en estado 'warning' por opt-outs elevados
  await store.updateSender(sender.id, {
    warmup_stage: 2,
    health_status: "warning",
    paused_reason: null,
    opt_out_rate: 1.5,
  });

  // Operador humano intenta promover
  await assert.rejects(
    async () => {
      await promoverEtapaWarmupHumano({
        store,
        senderId: sender.id,
        approvedBy: "marcelo@respon-do.com",
        newStage: 3,
        reason: "Intentar subir a Stage 3",
      });
    },
    /salud degradada \(warning\)/i,
    "Debe rechazar la promoción si el estado es warning",
  );

  // Sender en estado 'critical'
  await store.updateSender(sender.id, {
    health_status: "critical",
  });

  await assert.rejects(
    async () => {
      await promoverEtapaWarmupHumano({
        store,
        senderId: sender.id,
        approvedBy: "marcelo@respon-do.com",
        newStage: 3,
        reason: "Intentar subir a Stage 3",
      });
    },
    /salud degradada \(critical\)/i,
    "Debe rechazar la promoción si el estado es critical",
  );
});

test("RAMP-UP GOVERNANCE 5: Subir capacidad por sobre Stage 5 requiere aprobación humana reforzada", async () => {
  const store = new MemoryOutboundStore();
  const senders = await store.getSenders();
  const sender = senders.find((s) => s.type === "outbound")!;

  // Sender en Stage 5 (semana 4, tope conservador V1: 15 msgs/día)
  await store.updateSender(sender.id, {
    warmup_stage: 5,
    new_leads_daily_limit: 5,
    total_messages_daily_limit: 15,
    health_status: "healthy",
    paused_reason: null,
  });

  // Intento 1: Aprobación estándar para Stage 6 (sin flag reforzado) -> DEBE FALLAR
  await assert.rejects(
    async () => {
      await promoverEtapaWarmupHumano({
        store,
        senderId: sender.id,
        approvedBy: "marcelo@respon-do.com",
        newStage: 6,
        reason: "Queremos más volumen comercial",
        reinforcedApproval: false,
      });
    },
    /supera el límite estándar seguro V1/i,
    "Debe exigir aprobación reforzada para superar Stage 5",
  );

  // Intento 2: Aprobación humana REFORZADA con justificación explícita -> DEBE ÉXITO
  const registroReforzado = await promoverEtapaWarmupHumano({
    store,
    senderId: sender.id,
    approvedBy: "marcelo@respon-do.com",
    newStage: 6,
    reason: "Aprobación técnica de Marcelo tras 6 semanas de volumen estable y reputación impecable",
    notes: "Superando tope V1 de forma controlada a 20 msgs/día",
    reinforcedApproval: true,
  });

  assert.equal(registroReforzado.new_stage, 6);
  assert.equal(registroReforzado.reinforced_approval, true);

  const senderActualizado = (await store.getSenderById(sender.id))!;
  assert.equal(senderActualizado.warmup_stage, 6);
  assert.ok(senderActualizado.total_messages_daily_limit > 15, "Límite total supera 15");
});

test("RAMP-UP GOVERNANCE 6 (Bonus): El sistema automatizado SÍ puede pausar preventivamente ante degradación", async () => {
  const store = new MemoryOutboundStore();
  const senders = await store.getSenders();
  const sender = senders.find((s) => s.type === "outbound")!;

  // Remitente funcionando normalmente
  await store.updateSender(sender.id, {
    health_status: "healthy",
    paused_reason: null,
  });

  // Rutina de monitoreo detecta anomalía y ejecuta pausa preventiva automática
  await pausarPreventivamenteSender({
    store,
    senderId: sender.id,
    motivo: "Pico anómalo de rebotes 5.X.X detectado por monitoreo",
    origen: "monitoreo_metricas",
  });

  const senderPausado = (await store.getSenderById(sender.id))!;
  assert.equal(senderPausado.health_status, "paused");
  assert.equal(senderPausado.paused_reason, "Pico anómalo de rebotes 5.X.X detectado por monitoreo");

  // El evento de killswitch queda registrado
  const eventos = await store.listEvents({ tipo: "killswitch_activated" });
  assert.equal(eventos.length, 1);
  assert.equal((eventos[0].metadata as any).accion, "pausa_preventiva_automatica");
});
