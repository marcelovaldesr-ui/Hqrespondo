import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOutboundStore, calcularHashCopy } from "../../lib/outbound/store";
import { validarAntesDeEnvio } from "../../lib/outbound/guardrails";
import { procesarRebote, analizarMensajeRebote } from "../../lib/outbound/bounces";
import { calcularFechaProgramada, obtenerInicioDelDiaSantiago } from "../../lib/outbound/scheduler";
import { minimizarExtractoAutoresponder, procesarMensajeEntrante } from "../../lib/outbound/replies";
import { type Company, type Contact, type Campaign } from "../../lib/outbound/types";
import { type MensajeEntranteGmail } from "../../lib/outbound/gmail";
import { LocalEmailVerifier } from "../../lib/outbound/verification";

async function setupHardeningScenario(store: MemoryOutboundStore) {
  const source = await store.createLeadSource({
    tipo_origen: "csv",
    nombre: "Hardening Test Source",
    justificacion: "Demostración de interés legítimo B2B no automático",
    base_legal: "interes_legitimo",
    procedencia_datos: "Directorio público de empresas de salud",
  });

  const company: Company = await store.createCompany({
    nombre: "Clínica San Cristóbal",
    nombre_normalizado: "Clínica San Cristóbal",
    matching_key: "clinica_san_cristobal",
    rut: "76555444-3",
    sitio_web: "https://sancristobal.cl",
    dominio_web: "sancristobal.cl",
    rubro: "Salud",
    comuna: "Providencia",
    region: "Metropolitana",
    n_empleados: 40,
    encaje_icp: "alto",
    posible_duplicado: false,
    duplicado_de_id: null,
    tags: ["salud"],
  });

  const contact: Contact = await store.createContact({
    company_id: company.id,
    source_id: source.id,
    nombre: "Dra. Patricia",
    apellido: "Lagos",
    cargo: "Directora Médica",
    email: "patricia@sancristobal.cl",
    email_normalizado: "patricia@sancristobal.cl",
    telefono: "56988776655",
    linkedin_url: null,
    tipo_relacion: "cold",
    relacion_detalle: null,
    relationship_approved_for_copy: false,
    verificacion_estado: "valid",
    verificacion_proveedor: "mock",
    verificacion_fecha: new Date().toISOString(),
    verificacion_detalle: "MX OK",
    secuencia_pausada: false,
    secuencia_pausada_motivo: null,
    hold_hasta: null,
  });

  const campana: Campaign = await store.createCampaign({
    nombre: "Campaña Médica Hardened",
    slug: "campana_medica_hardened",
    tipo: "cold",
    activa: true,
    review_mode: true, // Review Mode activo
    sender_pool_ids: ["22222222-2222-2222-2222-222222222222"],
    daily_new_leads_limit: 10,
    horario_inicio: 9,
    horario_fin: 18,
    dias_laborales: [1, 2, 3, 4, 5],
    zona_horaria: "America/Santiago",
  });

  return { source, company, contact, campana };
}

test("CLASIFICACIÓN GRANULAR DE REBOTES: Distinción estricta entre RECIPIENT_INVALID y SENDER_OR_POLICY_REJECTION", async () => {
  const store = new MemoryOutboundStore();
  const { contact, campana, company } = await setupHardeningScenario(store);

  // 1. Caso SENDER_OR_POLICY_REJECTION (SPF / DKIM / DMARC / Throttling)
  // El contacto es legítimo, el problema es de nuestra infraestructura
  const mensajeRebotePolitica: MensajeEntranteGmail = {
    id: "bounce_policy_001",
    threadId: "thread_bounce_1",
    from: "mailer-daemon@google.com",
    to: "sender@respon-do.com",
    subject: "Delivery Status Notification (Failure)",
    snippet: "550 5.7.26 This message does not pass authentication checks (DMARC policy failed)",
    rawBody: "550 5.7.26 This message does not pass authentication checks (DMARC policy failed). Please visit https://support.google.com/mail/answer/81126",
    headers: {},
    date: new Date().toISOString(),
  };

  const analisisPolitica = analizarMensajeRebote(mensajeRebotePolitica);
  assert.equal(analisisPolitica.clasificacion, "SENDER_OR_POLICY_REJECTION");

  const resPolitica = await procesarRebote(mensajeRebotePolitica, store);
  assert.equal(resPolitica.clasificacion, "SENDER_OR_POLICY_REJECTION");
  assert.equal(resPolitica.contactoInvalidado, false); // NUNCA quemar el contacto por error de política

  // Verificar que el contacto NO fue invalidado ni añadido a supresiones
  const contactoSinTocar = await store.getContactById(contact.id);
  assert.equal(contactoSinTocar?.verificacion_estado, "valid");
  const supCheck = await store.isSuppressed(contact.email_normalizado);
  assert.equal(supCheck.suppressed, false);

  // 2. Caso RECIPIENT_INVALID (5.1.1 User Unknown)
  // El buzón de destino no existe: Sí debe invalidar y suprimir
  const mensajeReboteInvalido: MensajeEntranteGmail = {
    id: "bounce_invalid_002",
    threadId: "thread_bounce_2",
    from: "mailer-daemon@googlemail.com",
    to: "sender@respon-do.com",
    subject: "Mail Delivery Subsystem",
    snippet: "550 5.1.1 The email account that you tried to reach does not exist: patricia@sancristobal.cl",
    rawBody: "550 5.1.1 The email account that you tried to reach does not exist: patricia@sancristobal.cl",
    headers: {},
    date: new Date().toISOString(),
  };

  const analisisInvalido = analizarMensajeRebote(mensajeReboteInvalido);
  assert.equal(analisisInvalido.clasificacion, "RECIPIENT_INVALID");

  const resInvalido = await procesarRebote(mensajeReboteInvalido, store);
  assert.equal(resInvalido.clasificacion, "RECIPIENT_INVALID");
  assert.equal(resInvalido.contactoInvalidado, true);

  // Verificar que ahora sí fue invalidado y añadido a supresiones
  const contactoInvalidado = await store.getContactById(contact.id);
  assert.equal(contactoInvalidado?.verificacion_estado, "invalid");
  const supCheckInvalido = await store.isSuppressed(contact.email_normalizado);
  assert.equal(supCheckInvalido.suppressed, true);
  assert.match(supCheckInvalido.reason ?? "", /hard_bounce/);
});

test("REVIEW MODE Y COPY HASH: Edición posterior invalida aprobación y bloquea el despacho", async () => {
  const store = new MemoryOutboundStore();
  const { contact, campana, company } = await setupHardeningScenario(store);

  // 1. Crear ítem en pending_review
  const item = await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 1,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Propuesta de valor para Clínica San Cristóbal",
    body_text: "Estimada Dra. Patricia, vemos que coordinan horas por WhatsApp...",
    evidence_used: [],
    estado: "pending_review",
    scheduled_for: new Date(Date.now() - 1000).toISOString(),
    idempotency_key: `review_hash_test_${contact.id}`,
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: null,
    error_message: null,
    enviado_at: null,
  });

  // 2. Operador humano aprueba el ítem
  const aprobado = await store.approveOutboxItem(item.id, "marcelo_humano");
  assert.ok(aprobado);
  assert.equal(aprobado.estado, "approved");
  assert.equal(aprobado.approved_by, "marcelo_humano");
  assert.ok(aprobado.approved_copy_hash);

  // 3. Alguien modifica el cuerpo del mensaje tras haber sido aprobado
  await store.updateOutboxItem(item.id, {
    body_text: "TEXTO MODIFICADO NO AUTORIZADO: Ganaste un premio...",
  });

  // Verificar que el store revirtió automáticamente a pending_review y borró el hash
  const itemRevertido = await store.getOutboxItemById(item.id);
  assert.equal(itemRevertido?.estado, "pending_review");
  assert.equal(itemRevertido?.approved_by, null);
  assert.equal(itemRevertido?.approved_copy_hash, null);

  // 4. Intentar despachar con guardrails
  const prevOutboundEnabled = process.env.OUTBOUND_ENABLED;
  try {
    process.env.OUTBOUND_ENABLED = "true";
    const check = await validarAntesDeEnvio({
      store,
      outboxItem: itemRevertido!,
      workerId: "worker_test",
    });

    // Guardrails deben bloquear el envío porque está en pending_review
    assert.equal(check.autorizado, false);
    assert.match(check.motivoBloqueo ?? "", /REVIEW MODE ACTIVO/);
  } finally {
    process.env.OUTBOUND_ENABLED = prevOutboundEnabled ?? "false";
  }
});

test("CALENDAR DAYS DELAY Y ROLLING A LUNES: Días calendario ruedan al siguiente lunes a las 09:00 CLT", () => {
  // Jueves 10 de Septiembre 2026 a las 15:00 CLT (UTC-3 o UTC-4)
  // 2 días calendario -> Sábado 12 de Septiembre a las 15:00 CLT
  // Debe rodar al Lunes 14 de Septiembre a las 09:00 CLT (+ jitter)
  const jueves = new Date("2026-09-10T15:00:00-03:00");
  const configHorario = {
    horaInicio: 9,
    horaFin: 18,
    diasLaborales: [1, 2, 3, 4, 5],
    zonaHoraria: "America/Santiago",
    unidad: "calendar_days" as const,
  };

  const programadoJueves = calcularFechaProgramada(jueves, 2, configHorario, 5);

  // Obtener día de la semana y hora en America/Santiago
  const diaSemana = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    weekday: "long",
  }).format(programadoJueves);

  const horaCLT = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Santiago",
      hour: "numeric",
      hour12: false,
    }).format(programadoJueves),
    10,
  );

  assert.equal(diaSemana, "Monday");
  assert.equal(horaCLT, 9); // Rodado a las 09:00 de la mañana del lunes
});

test("DATA MINIMIZATION (LEY 21.719): Autoresponder médico/personal se sanitiza y no almacena datos sensibles", () => {
  const textoSensible =
    "Estimados, me encuentro hospitalizada por una cesárea de urgencia y licencia médica en Clínica Alemana. Vuelvo el 20/11/2026. Para urgencias contactar a Juan.";

  const resultado = minimizarExtractoAutoresponder(textoSensible);

  assert.equal(resultado.is_auto_reply, true);
  assert.equal(resultado.reason_category, "out_of_office");
  assert.equal(resultado.return_date, "2026-11-20");

  // Verificar que el snippet sanitizado NO contiene palabras médicas o diagnósticos
  assert.doesNotMatch(resultado.sanitized_snippet, /cesárea/i);
  assert.doesNotMatch(resultado.sanitized_snippet, /hospitalizada/i);
});

test("LÍMITES DIARIOS BASADOS EN LEDGER Y MEDIANOCHE DE SANTIAGO: Incluye items sending para evitar condiciones de carrera", async () => {
  const store = new MemoryOutboundStore();
  const { contact, campana, company } = await setupHardeningScenario(store);

  const senderId = "22222222-2222-2222-2222-222222222222";
  const domainId = "00000000-0000-0000-0000-000000000001";

  // Item 1: 'sent' hoy
  await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 1,
    sender_id: senderId,
    subject: "Asunto 1",
    body_text: "Cuerpo 1",
    evidence_used: [],
    estado: "sent",
    scheduled_for: new Date().toISOString(),
    idempotency_key: "ledger_test_1",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: "g1",
    gmail_thread_id: "t1",
    error_message: null,
    enviado_at: new Date().toISOString(),
  });

  // Item 2: 'sending' (worker concurrente bloqueó y está transmitiendo)
  await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 2,
    sender_id: senderId,
    subject: "Asunto 2",
    body_text: "Cuerpo 2",
    evidence_used: [],
    estado: "sending",
    scheduled_for: new Date().toISOString(),
    idempotency_key: "ledger_test_2",
    locked_at: new Date().toISOString(),
    locked_by: "worker_paralelo",
    lock_expires_at: new Date(Date.now() + 300000).toISOString(),
    gmail_message_id: null,
    gmail_thread_id: "t1",
    error_message: null,
    enviado_at: null,
  });

  // Conteo ledger del sender
  const conteo = await store.getDailySentCounts(senderId);
  assert.equal(conteo.sentToday, 2); // 1 sent + 1 sending
  assert.equal(conteo.newLeadsToday, 1); // solo step_number = 1

  // Conteo ledger del dominio
  const conteoDominio = await store.getDomainDailySentCount(domainId);
  assert.equal(conteoDominio, 2);
});

test("GLOBAL KILL SWITCH: OUTBOUND_ENABLED=false bloquea el despacho inmediatamente", async () => {
  const store = new MemoryOutboundStore();
  const { contact, campana, company } = await setupHardeningScenario(store);

  const item = await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 1,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Test Kill Switch",
    body_text: "Test Kill Switch",
    evidence_used: [],
    estado: "approved",
    scheduled_for: new Date(Date.now() - 1000).toISOString(),
    idempotency_key: "kill_switch_test",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: null,
    error_message: null,
    enviado_at: null,
  });

  process.env.OUTBOUND_ENABLED = "false";
  const check = await validarAntesDeEnvio({
    store,
    outboxItem: item,
    workerId: "worker_kill",
  });

  assert.equal(check.autorizado, false);
  assert.match(check.motivoBloqueo ?? "", /GLOBAL KILL SWITCH ACTIVO/);
  assert.equal(check.accionRequerida, "pausar_cola");
});

test("EMAIL VERIFICATION: Dominio desechable y sintaxis inválida se bloquean defensivamente", async () => {
  const verifier = new LocalEmailVerifier();

  // 1. Email con formato inválido
  const resInvalido = await verifier.verificar("correo_sin_arroba");
  assert.equal(resInvalido.estado, "invalid");
  assert.equal(resInvalido.es_enviable, false);

  // 2. Email con dominio desechable / temporal
  const resDisposable = await verifier.verificar("contacto@mailinator.com");
  assert.equal(resDisposable.estado, "disposable");
  assert.equal(resDisposable.es_enviable, false);

  // 3. Dominio inexistente en DNS
  const resInexistente = await verifier.verificar("test@dominio-inexistente-xyz987654.cl");
  assert.equal(resInexistente.estado, "invalid");
  assert.equal(resInexistente.es_enviable, false);
});

