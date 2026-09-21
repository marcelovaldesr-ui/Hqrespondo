import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOutboundStore } from "../../lib/outbound/store";
import { validarAntesDeEnvio } from "../../lib/outbound/guardrails";
import { despacharColaOutbound } from "../../lib/outbound/dispatcher";
import { procesarMensajeEntrante } from "../../lib/outbound/replies";
import { setCustomFrescuraChecker, type MensajeEntranteGmail } from "../../lib/outbound/gmail";
import { type Company, type Contact, type Campaign } from "../../lib/outbound/types";

async function setupScenario(store: MemoryOutboundStore) {
  const source = await store.createLeadSource({
    tipo_origen: "csv",
    nombre: "Test Ingestion",
  });

  const company: Company = await store.createCompany({
    nombre: "Inmobiliaria Los Andes",
    nombre_normalizado: "Inmobiliaria Los Andes",
    matching_key: "inmobiliaria_los_andes",
    rut: "76111222-3",
    sitio_web: "https://losandes.cl",
    dominio_web: "losandes.cl",
    rubro: "Inmobiliaria",
    comuna: "Santiago",
    region: "Metropolitana",
    n_empleados: 25,
    encaje_icp: "alto",
    posible_duplicado: false,
    duplicado_de_id: null,
    tags: ["real_estate"],
  });

  const contact: Contact = await store.createContact({
    company_id: company.id,
    source_id: source.id,
    nombre: "Felipe",
    apellido: "Matetic",
    cargo: "Gerente Comercial",
    email: "felipe@losandes.cl",
    email_normalizado: "felipe@losandes.cl",
    telefono: "56991122334",
    linkedin_url: null,
    tipo_relacion: "cold",
    relacion_detalle: null,
    relationship_approved_for_copy: false,
    verificacion_estado: "valid",
    verificacion_proveedor: "mock",
    verificacion_fecha: new Date().toISOString(),
    verificacion_detalle: "MX válido",
    secuencia_pausada: false,
    secuencia_pausada_motivo: null,
    hold_hasta: null,
  });

  const campana: Campaign = await store.createCampaign({
    nombre: "Campaña Inmobiliarias",
    slug: "campana_inmobiliarias",
    tipo: "cold",
    activa: true,
    review_mode: false, // para testear dispatcher directo
    sender_pool_ids: ["22222222-2222-2222-2222-222222222222"],
    daily_new_leads_limit: 10,
    horario_inicio: 9,
    horario_fin: 18,
    dias_laborales: [1, 2, 3, 4, 5],
    zona_horaria: "America/Santiago",
  });

  return { source, company, contact, campana };
}

test("RACE CONDITION CASO A (Pub/Sub): Mensaje entrante a las 09:02 detiene secuencia antes del despacho de las 09:03", async () => {
  const store = new MemoryOutboundStore();
  const { contact, campana, company } = await setupScenario(store);

  // 09:00 - Paso 2 listo y programado para las 09:03
  const outboxPaso2 = await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 2,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Re: Consulta sobre leads inmobiliarios",
    body_text: "Hola Felipe, te escribo en seguimiento...",
    evidence_used: [],
    estado: "scheduled",
    scheduled_for: new Date(Date.now() - 60000).toISOString(), // programado para ya (09:03)
    idempotency_key: `race_test_step2_${contact.id}`,
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: "thread_12345",
    error_message: null,
    enviado_at: null,
  });

  // 09:02 - Prospecto responde vía Gmail (recibido por webhook Pub/Sub cerca de tiempo real)
  const mensajeRespuesta: MensajeEntranteGmail = {
    id: "msg_reply_902",
    threadId: "thread_12345",
    from: "Felipe Matetic <felipe@losandes.cl>",
    to: "contacto@empresa.com",
    subject: "Re: Consulta sobre leads inmobiliarios",
    snippet: "Gracias pero por ahora no estamos interesados en sumar herramientas externas.",
    headers: {},
    date: new Date(Date.now() - 120000).toISOString(),
  };

  // Pub/Sub procesa mensaje entrante a las 09:02:05
  const resultadoPubSub = await procesarMensajeEntrante(mensajeRespuesta, store);
  assert.equal(resultadoPubSub.secuenciaDetenida, true);
  assert.equal(resultadoPubSub.tipo, "reply_humano");

  // Contacto pausado y outbox cancelado
  const contactoActualizado = await store.getContactById(contact.id);
  assert.equal(contactoActualizado?.secuencia_pausada, true);

  const itemVerif = await store.getOutboxItemById(outboxPaso2.id);
  assert.equal(itemVerif?.estado, "cancelled");
  assert.match(itemVerif?.error_message ?? "", /Respuesta.*recibida/);

  // 09:03 - El despachador corre su ciclo
  const resultadoDespacho = await despacharColaOutbound({
    store,
    workerId: "worker_0903",
    limiteLote: 10,
  });

  // VERIFICACIÓN CLAVE: 0 mensajes enviados
  assert.equal(resultadoDespacho.procesados, 0);
  assert.equal(resultadoDespacho.simulados, 0);
  assert.equal(resultadoDespacho.enviados, 0);
});

test("RACE CONDITION CASO B (Live Fresh Check Pre-Send): Si Pub/Sub falla o demora, la verificación en vivo con Gmail API a las 09:03 aborta el envío", async () => {
  const store = new MemoryOutboundStore();
  const { contact, campana, company } = await setupScenario(store);

  // 09:00 - Paso 2 listo y programado para 09:03
  const outboxPaso2 = await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 2,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Re: Consulta sobre leads inmobiliarios",
    body_text: "Hola Felipe, te escribo en seguimiento...",
    evidence_used: [],
    estado: "scheduled",
    scheduled_for: new Date(Date.now() - 1000).toISOString(),
    idempotency_key: `race_test_step2_live_${contact.id}`,
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: "thread_fresh_check_999",
    error_message: null,
    enviado_at: null,
  });

  // Configuramos el checker fresco de Gmail simulando que en el hilo existe una respuesta de Felipe
  setCustomFrescuraChecker(async (params) => {
    if (params.threadId === "thread_fresh_check_999" && params.contactEmail.includes("felipe@losandes.cl")) {
      return {
        respuestaDetectada: true,
        motivo: "Respuesta del prospecto detectada en Gmail en hilo thread_fresh_check_999",
      };
    }
    return { respuestaDetectada: false };
  });

  const prevOutboundEnabled = process.env.OUTBOUND_ENABLED;
  try {
    process.env.OUTBOUND_ENABLED = "true";
    // A las 09:03 el guardrail ejecuta la comprobación pre-envío con live fresh check en Gmail
    const guardrailResult = await validarAntesDeEnvio({
      store,
      outboxItem: outboxPaso2,
      workerId: "worker_0903",
    });

    // VERIFICACIÓN: El guardrail detecta la respuesta viva en Gmail y BLOQUEA el envío
    assert.equal(guardrailResult.autorizado, false);
    assert.equal(guardrailResult.accionRequerida, "cancelar_secuencia");
    assert.match(guardrailResult.motivoBloqueo ?? "", /RACE CONDITION PREVENIDA EN VIVO/);

    // La secuencia y el ítem deben haber quedado cancelados
    const itemDespues = await store.getOutboxItemById(outboxPaso2.id);
    assert.equal(itemDespues?.estado, "cancelled");

    const contactoDespues = await store.getContactById(contact.id);
    assert.equal(contactoDespues?.secuencia_pausada, true);
  } finally {
    process.env.OUTBOUND_ENABLED = prevOutboundEnabled ?? "false";
    setCustomFrescuraChecker(null);
  }
});
