import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOutboundStore } from "../../lib/outbound/store";
import { despacharColaOutbound } from "../../lib/outbound/dispatcher";
import { validarAntesDeEnvio } from "../../lib/outbound/guardrails";
import { investigarEmpresa } from "../../lib/outbound/research";
import { redactarEmailOutbound } from "../../lib/outbound/copy";
import { SECUENCIA_DEFAULT } from "../../lib/outbound/scheduler";

test("IDEMPOTENCY: Clave de idempotencia única previene doble inserción del mismo toque", async () => {
  const store = new MemoryOutboundStore();

  const itemData = {
    campaign_id: "camp_1",
    contact_id: "cnt_1",
    company_id: "comp_1",
    step_number: 1,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Asunto",
    body_text: "Cuerpo",
    evidence_used: [],
    estado: "pending_review" as const,
    scheduled_for: new Date().toISOString(),
    idempotency_key: "idemp_unico_123",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: null,
    error_message: null,
    enviado_at: null,
  };

  await store.createOutboxItem(itemData);

  // Segunda inserción con la misma clave debe fallar de inmediato
  await assert.rejects(
    async () => {
      await store.createOutboxItem(itemData);
    },
    /Duplicate idempotency_key/,
    "Debe rechazar inserción con clave de idempotencia duplicada",
  );
});

test("CONCURRENCY / RESTART: Worker muerto libera lock tras expiración para que otro worker lo retome", async () => {
  const store = new MemoryOutboundStore();

  const item = await store.createOutboxItem({
    campaign_id: "camp_1",
    contact_id: "cnt_1",
    company_id: "comp_1",
    step_number: 1,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Asunto",
    body_text: "Cuerpo",
    evidence_used: [],
    estado: "approved",
    scheduled_for: new Date().toISOString(),
    idempotency_key: "lock_expire_test",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: null,
    error_message: null,
    enviado_at: null,
  });

  // Worker 1 toma el lock pero con duración muy corta (50ms) y "muere"
  const lock1 = await store.acquireOutboxLock(item.id, "worker_muerto", 50);
  assert.equal(lock1, true);

  // Inmediatamente después Worker 2 no puede tomarlo
  const lock2Inmediato = await store.acquireOutboxLock(item.id, "worker_vivo", 5000);
  assert.equal(lock2Inmediato, false, "No debe tomarlo mientras el lock esté vigente");

  // Esperar a que expire el lock (60ms)
  await new Promise((r) => setTimeout(r, 60));

  // Ahora Worker 2 debe ser capaz de reclamarlo tras expiración
  const lock2Reclamado = await store.acquireOutboxLock(item.id, "worker_vivo", 5000);
  assert.equal(lock2Reclamado, true, "Worker vivo debe poder reclamar el ítem secuestrado tras expiración del lock");
});

test("SEGURIDAD: Campaña pausada o Sender pausado bloquea el envío", async () => {
  const store = new MemoryOutboundStore();

  const company = await store.createCompany({
    nombre: "Test Pausa",
    nombre_normalizado: "Test Pausa",
    matching_key: "test_pausa",
    rut: null,
    sitio_web: null,
    dominio_web: "pausa.cl",
    rubro: "Retail",
    comuna: "Santiago",
    region: "Metropolitana",
    n_empleados: 10,
    encaje_icp: "medio",
    posible_duplicado: false,
    duplicado_de_id: null,
    tags: [],
  });

  const source = await store.createLeadSource({
    tipo_origen: "csv",
    nombre: "Test",
  });

  const contact = await store.createContact({
    company_id: company.id,
    source_id: source.id,
    nombre: "Persona",
    apellido: null,
    cargo: null,
    email: "p@pausa.cl",
    email_normalizado: "p@pausa.cl",
    telefono: null,
    linkedin_url: null,
    tipo_relacion: "cold",
    relacion_detalle: null,
    relationship_approved_for_copy: false,
    verificacion_estado: "valid",
    verificacion_proveedor: "mock",
    verificacion_fecha: null,
    verificacion_detalle: null,
    secuencia_pausada: false,
    secuencia_pausada_motivo: null,
    hold_hasta: null,
  });

  const campanaPausada = await store.createCampaign({
    nombre: "Campaña Detenida",
    slug: "camp_detenida",
    tipo: "cold",
    activa: false, // PAUSADA
    review_mode: false,
    sender_pool_ids: [],
    daily_new_leads_limit: 5,
    horario_inicio: 9,
    horario_fin: 18,
    dias_laborales: [1, 2, 3, 4, 5],
    zona_horaria: "America/Santiago",
  });

  const item = await store.createOutboxItem({
    campaign_id: campanaPausada.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 1,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Asunto",
    body_text: "Cuerpo",
    evidence_used: [],
    estado: "approved",
    scheduled_for: new Date().toISOString(),
    idempotency_key: "pausa_test_key",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: null,
    error_message: null,
    enviado_at: null,
  });

  process.env.OUTBOUND_ENABLED = "true";

  const checkCampana = await validarAntesDeEnvio({
    store,
    outboxItem: item,
    workerId: "w1",
  });
  assert.equal(checkCampana.autorizado, false);
  assert.match(checkCampana.motivoBloqueo ?? "", /inactiva/i);

  // Reactivar campaña pero pausar sender
  await store.updateCampaign(campanaPausada.id, { activa: true });
  await store.updateSender("22222222-2222-2222-2222-222222222222", {
    health_status: "paused",
    paused_reason: "Tasa de rebote elevada",
  });

  const checkSender = await validarAntesDeEnvio({
    store,
    outboxItem: item,
    workerId: "w1",
  });
  assert.equal(checkSender.autorizado, false);
  assert.match(checkSender.motivoBloqueo ?? "", /Sender pausado/i);
});

test("E2E COMPLETO EN DRY RUN: simula sin consumo de límites ni creación de follow-up", async () => {
  const store = new MemoryOutboundStore();

  process.env.OUTBOUND_ENABLED = "true";
  process.env.DRY_RUN = "true"; // Simulación

  // 1. Empresa y Contacto
  const company = await store.createCompany({
    nombre: "Clínica Hunza",
    nombre_normalizado: "Clínica Hunza",
    matching_key: "clinica_hunza",
    rut: "77654321-0",
    sitio_web: "https://clinicahunza.cl",
    dominio_web: "clinicahunza.cl",
    rubro: "Medicina Estética",
    comuna: "Chillán",
    region: "Ñuble",
    n_empleados: 12,
    encaje_icp: "alto",
    posible_duplicado: false,
    duplicado_de_id: null,
    tags: ["estetica"],
  });

  const source = await store.createLeadSource({
    tipo_origen: "cliente_partner",
    nombre: "Impresora Color Base",
    referencia: "Cliente de material impreso",
  });

  const contact = await store.createContact({
    company_id: company.id,
    source_id: source.id,
    nombre: "Valeria",
    apellido: "Contreras",
    cargo: "Administración",
    email: "administracion@clinicahunza.cl",
    email_normalizado: "administracion@clinicahunza.cl",
    telefono: "56988955673",
    linkedin_url: null,
    tipo_relacion: "warm",
    relacion_detalle: "Cliente registrado en Impresora Color",
    relationship_approved_for_copy: false, // NO APROBADO
    verificacion_estado: "valid",
    verificacion_proveedor: "mock",
    verificacion_fecha: new Date().toISOString(),
    verificacion_detalle: "OK",
    secuencia_pausada: false,
    secuencia_pausada_motivo: null,
    hold_hasta: null,
  });

  const campana = await store.createCampaign({
    nombre: "Campaña Estética 2026",
    slug: "estetica_2026",
    tipo: "warm",
    activa: true,
    review_mode: false, // Auto-programar para test E2E
    sender_pool_ids: ["11111111-1111-1111-1111-111111111111"], // Marcelo
    daily_new_leads_limit: 5,
    horario_inicio: 9,
    horario_fin: 18,
    dias_laborales: [1, 2, 3, 4, 5],
    zona_horaria: "America/Santiago",
  });

  // 2. Research
  const research = await investigarEmpresa(company, store, {
    contextoAdicional: "Centro de estética con atención y reservas directas por WhatsApp.",
  });
  assert.equal(research.estado, "completo");

  // 3. Copy Paso 1
  const copyPaso1 = await redactarEmailOutbound({
    contacto: contact,
    empresa: company,
    research,
    paso: SECUENCIA_DEFAULT[0],
    remitenteNombre: "Marcelo Valdés",
  });
  assert.ok(copyPaso1.cuerpo);
  assert.doesNotMatch(copyPaso1.cuerpo, /impresora color/i);

  // 4. Encolar Paso 1
  const outboxPaso1 = await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 1,
    sender_id: "11111111-1111-1111-1111-111111111111", // Marcelo
    subject: copyPaso1.asunto,
    body_text: copyPaso1.cuerpo,
    evidence_used: copyPaso1.evidencia_usada,
    estado: "approved",
    scheduled_for: new Date(Date.now() - 60000).toISOString(), // Ya elegible
    idempotency_key: "e2e_step_1",
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: null,
    error_message: null,
    enviado_at: null,
  });

  // 5. Despachar Lote
  const resDespacho = await despacharColaOutbound({
    store,
    workerId: "worker_e2e",
    limiteLote: 5,
  });

  assert.equal(resDespacho.procesados, 1);
  assert.equal(resDespacho.simulados, 1, "En DRY_RUN debe simular el envío");

  const itemDespues = await store.getOutboxItemById(outboxPaso1.id);
  assert.equal(itemDespues?.estado, "simulated");
  assert.ok(itemDespues?.gmail_message_id);

  // 6. Un dry-run no debe alterar el ledger ni crear una secuencia operativa falsa.
  const todosOutbox = await store.listOutbox();
  const paso2 = todosOutbox.find((i) => i.contact_id === contact.id && i.step_number === 2);
  assert.equal(paso2, undefined, "El paso 2 no debe programarse desde una simulación");
  const senderDespues = await store.getSenderById("11111111-1111-1111-1111-111111111111");
  assert.equal(senderDespues?.sent_today, 0);
});
