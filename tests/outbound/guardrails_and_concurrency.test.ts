import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOutboundStore } from "../../lib/outbound/store";
import { validarAntesDeEnvio } from "../../lib/outbound/guardrails";
import { despacharColaOutbound } from "../../lib/outbound/dispatcher";
import { type OutboxItem, type Campaign, type Contact, type Company, type LeadSource } from "../../lib/outbound/types";

async function setupPruebaBase(store: MemoryOutboundStore) {
  const source = await store.createLeadSource({
    tipo_origen: "csv",
    nombre: "Test Base",
    referencia: null,
    url: null,
    notas: null,
  });

  const company = await store.createCompany({
    nombre: "Empresa Test SpA",
    nombre_normalizado: "Empresa Test SpA",
    matching_key: "empresa_test",
    rut: "77123456-7",
    sitio_web: "https://test.cl",
    dominio_web: "test.cl",
    rubro: "Salud",
    comuna: "Santiago",
    region: "Metropolitana",
    n_empleados: 30,
    encaje_icp: "alto",
    posible_duplicado: false,
    duplicado_de_id: null,
    tags: ["test"],
  });

  const contact = await store.createContact({
    company_id: company.id,
    source_id: source.id,
    nombre: "Rodrigo",
    apellido: "Silva",
    cargo: "Gerente",
    email: "rodrigo@test.cl",
    email_normalizado: "rodrigo@test.cl",
    telefono: "56911223344",
    linkedin_url: null,
    tipo_relacion: "cold",
    relacion_detalle: null,
    relationship_approved_for_copy: false,
    verificacion_estado: "valid",
    verificacion_proveedor: "mock",
    verificacion_fecha: new Date().toISOString(),
    verificacion_detalle: "OK",
    secuencia_pausada: false,
    secuencia_pausada_motivo: null,
    hold_hasta: null,
  });

  const campana = await store.createCampaign({
    nombre: "Campaña Fría Salud",
    slug: "salud_cold_01",
    tipo: "cold",
    activa: true,
    review_mode: false,
    sender_pool_ids: ["22222222-2222-2222-2222-222222222222"],
    daily_new_leads_limit: 5,
    horario_inicio: 9,
    horario_fin: 18,
    dias_laborales: [1, 2, 3, 4, 5],
    zona_horaria: "America/Santiago",
  });

  await store.upsertResearch({
    company_id: company.id,
    resumen_actividad: "Centro médico con consultas ambulatorias",
    canales_visibles: ["WhatsApp"],
    captacion_leads: "WhatsApp",
    senales_dolor: ["Consultas de horas"],
    propuesta_valor_respondo: "Asistente médico",
    evidencias: [
      {
        insight: "Atienden por WhatsApp",
        fuente_url: "https://test.cl",
        extracto: "Reserva tu hora por WhatsApp",
        confianza: "alta",
      },
    ],
    estado: "completo",
    confidence_score: 90,
    investigado_at: new Date().toISOString(),
  });

  return { source, company, contact, campana };
}

test("CASO CRÍTICO: Concurrencia y Locks Atómicos entre dos workers", async () => {
  const store = new MemoryOutboundStore();
  const { campana, contact, company } = await setupPruebaBase(store);

  const outboxItem = await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 1,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Consulta",
    body_text: "Hola Rodrigo...",
    evidence_used: [],
    estado: "approved",
    scheduled_for: new Date(Date.now() - 10_000).toISOString(),
    idempotency_key: "lock_test_1",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: null,
    error_message: null,
    enviado_at: null,
  });

  // Simulación: Worker 1 y Worker 2 intentan tomar el mismo ítem
  const lockWorker1 = await store.acquireOutboxLock(outboxItem.id, "worker_1", 30_000);
  const lockWorker2 = await store.acquireOutboxLock(outboxItem.id, "worker_2", 30_000);

  assert.equal(lockWorker1, true, "Worker 1 debe adquirir el lock exitosamente");
  assert.equal(lockWorker2, false, "Worker 2 debe ser rechazado por lock de concurrencia activo");

  const itemActual = await store.getOutboxItemById(outboxItem.id);
  assert.equal(itemActual?.estado, "sending");
  assert.equal(itemActual?.locked_by, "worker_1");
});

test("CASO CRÍTICO: Reply While Queued (Respuesta recibida mientras el mensaje estaba en cola)", async () => {
  const store = new MemoryOutboundStore();
  const { campana, contact, company } = await setupPruebaBase(store);

  // 09:00 - Seguimiento entra en cola programado
  const outboxItem = await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 2,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Re: Consulta",
    body_text: "Seguimiento...",
    evidence_used: [],
    estado: "approved",
    scheduled_for: new Date().toISOString(),
    idempotency_key: "reply_while_queued_test",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: "thread_123",
    error_message: null,
    enviado_at: null,
  });

  // 09:02 - Prospecto responde antes de que el worker despache
  await store.createReply({
    outbox_id: null,
    contact_id: contact.id,
    gmail_message_id: "msg_reply_902",
    gmail_thread_id: "thread_123",
    from_email: contact.email_normalizado,
    subject: "Re: Consulta",
    extracto: "Hola, háblame en octubre por favor.",
    clasificacion_ia: "later",
    es_humano: true,
    es_autoresponder: false,
    secuencia_detenida: true,
  });

  // 09:03 - Worker intenta enviar
  process.env.OUTBOUND_ENABLED = "true";
  process.env.DRY_RUN = "true";

  const check = await validarAntesDeEnvio({
    store,
    outboxItem,
    workerId: "worker_test",
  });

  assert.equal(check.autorizado, false, "El pre-send check DEBE RECHAZAR el envío");
  assert.match(check.motivoBloqueo ?? "", /CARRERA EVITADA/i);
  assert.equal(check.accionRequerida, "cancelar_secuencia");

  // Verificar que el mensaje en outbox fue cancelado
  const itemDespues = await store.getOutboxItemById(outboxItem.id);
  assert.equal(itemDespues?.estado, "cancelled");
});

test("LÍMITES DIARIOS: Diferenciación entre new_leads_daily_limit y total_messages_daily_limit", async () => {
  const store = new MemoryOutboundStore();
  const { campana, contact, company } = await setupPruebaBase(store);

  const sender = await store.getSenderById("22222222-2222-2222-2222-222222222222");
  assert.ok(sender);

  // Forzar que new_leads_today haya alcanzado su límite (5), pero total_messages (5/15) aún tiene cupo
  sender.new_leads_today = 5;
  sender.sent_today = 5;
  sender.warmup_stage = 5; // Limite new: 5, total: 15
  await store.updateSender(sender.id, sender);

  process.env.OUTBOUND_ENABLED = "true";

  // Ítem 1: Paso 1 (Nuevo lead) -> DEBE SER BLOQUEADO
  const itemNuevoLead = await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 1, // NUEVO LEAD
    sender_id: sender.id,
    subject: "Apertura",
    body_text: "Hola...",
    evidence_used: [],
    estado: "approved",
    scheduled_for: new Date().toISOString(),
    idempotency_key: "test_limit_step1",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: null,
    error_message: null,
    enviado_at: null,
  });

  const checkPaso1 = await validarAntesDeEnvio({
    store,
    outboxItem: itemNuevoLead,
    workerId: "worker_test",
  });
  assert.equal(checkPaso1.autorizado, false, "Nuevo lead debe ser bloqueado por new_leads_daily_limit");
  assert.match(checkPaso1.motivoBloqueo ?? "", /Límite de nuevos leads alcanzado/);

  // Ítem 2: Paso 2 (Follow-up) -> DEBE SER PERMITIDO porque total_messages (5/15) no se ha excedido
  const itemFollowUp = await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 2, // FOLLOW UP
    sender_id: sender.id,
    subject: "Re: Apertura",
    body_text: "Follow up...",
    evidence_used: [],
    estado: "approved",
    scheduled_for: new Date().toISOString(),
    idempotency_key: "test_limit_step2",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: null,
    error_message: null,
    enviado_at: null,
  });

  const checkPaso2 = await validarAntesDeEnvio({
    store,
    outboxItem: itemFollowUp,
    workerId: "worker_test",
  });
  assert.equal(checkPaso2.autorizado, true, "Follow-up debe ser permitido porque total_messages tiene cupo");
});

test("GLOBAL KILL SWITCH: OUTBOUND_ENABLED=false aborta todo envío", async () => {
  const store = new MemoryOutboundStore();
  const { campana, contact, company } = await setupPruebaBase(store);

  process.env.OUTBOUND_ENABLED = "false"; // Apagado

  const item = await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 1,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Test",
    body_text: "Hola...",
    evidence_used: [],
    estado: "approved",
    scheduled_for: new Date().toISOString(),
    idempotency_key: "killswitch_test",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: null,
    error_message: null,
    enviado_at: null,
  });

  const check = await validarAntesDeEnvio({
    store,
    outboxItem: item,
    workerId: "w1",
  });

  assert.equal(check.autorizado, false);
  assert.match(check.motivoBloqueo ?? "", /GLOBAL KILL SWITCH ACTIVO/);
});

test("LÍMITE DE DOMINIO: respon.do agregado alcanzado bloquea todos los envíos", async () => {
  const store = new MemoryOutboundStore();
  const { campana, contact, company } = await setupPruebaBase(store);

  process.env.OUTBOUND_ENABLED = "true";

  // Agotar límite de dominio (30/30)
  await store.updateDomain("respon.do", { sent_today: 30, domain_daily_limit: 30 });

  const item = await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 2,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Test Dominio",
    body_text: "Hola...",
    evidence_used: [],
    estado: "approved",
    scheduled_for: new Date().toISOString(),
    idempotency_key: "domain_limit_test",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: null,
    error_message: null,
    enviado_at: null,
  });

  const check = await validarAntesDeEnvio({
    store,
    outboxItem: item,
    workerId: "w1",
  });

  assert.equal(check.autorizado, false);
  assert.match(check.motivoBloqueo ?? "", /Límite agregado del dominio alcanzado/);
});
