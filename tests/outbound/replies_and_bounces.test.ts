import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOutboundStore } from "../../lib/outbound/store";
import { procesarMensajeEntrante, esAutoresponderDeterminista } from "../../lib/outbound/replies";
import { procesarRebote, analizarMensajeRebote } from "../../lib/outbound/bounces";
import { seleccionarSenderDeterminista } from "../../lib/outbound/senders";
import { type MensajeEntranteGmail } from "../../lib/outbound/gmail";

async function crearAmbientePrueba(store: MemoryOutboundStore) {
  const source = await store.createLeadSource({
    tipo_origen: "csv",
    nombre: "Test Leads",
  });

  const company = await store.createCompany({
    nombre: "Clínica Dental Zenith",
    nombre_normalizado: "Clínica Dental Zenith",
    matching_key: "clinica_dental_zenith",
    rut: "76999888-1",
    sitio_web: "https://zenith.cl",
    dominio_web: "zenith.cl",
    rubro: "Salud Dental",
    comuna: "Providencia",
    region: "Metropolitana",
    n_empleados: 15,
    encaje_icp: "alto",
    posible_duplicado: false,
    duplicado_de_id: null,
    tags: ["dental"],
  });

  const contact = await store.createContact({
    company_id: company.id,
    source_id: source.id,
    nombre: "Dra. Carolina",
    apellido: "Mendez",
    cargo: "Directora Médica",
    email: "carolina@zenith.cl",
    email_normalizado: "carolina@zenith.cl",
    telefono: "56999887766",
    linkedin_url: null,
    tipo_relacion: "cold",
    relacion_detalle: null,
    relationship_approved_for_copy: false,
    verificacion_estado: "valid",
    verificacion_proveedor: "local",
    verificacion_fecha: new Date().toISOString(),
    verificacion_detalle: "OK",
    secuencia_pausada: false,
    secuencia_pausada_motivo: null,
    hold_hasta: null,
  });

  const campana = await store.createCampaign({
    nombre: "Dental Cold",
    slug: "dental_cold",
    tipo: "cold",
    activa: true,
    review_mode: false,
    sender_pool_ids: [],
    daily_new_leads_limit: 5,
    horario_inicio: 9,
    horario_fin: 18,
    dias_laborales: [1, 2, 3, 4, 5],
    zona_horaria: "America/Santiago",
  });

  // Mensaje paso 2 y paso 3 en cola
  await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 2,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Re: Consulta",
    body_text: "Paso 2...",
    evidence_used: [],
    estado: "scheduled",
    scheduled_for: new Date(Date.now() + 86400000).toISOString(),
    idempotency_key: "dental_step2",
    gmail_thread_id: "thr_zenith_1",
  });

  await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: 3,
    sender_id: "22222222-2222-2222-2222-222222222222",
    subject: "Re: Consulta",
    body_text: "Paso 3...",
    evidence_used: [],
    estado: "scheduled",
    scheduled_for: new Date(Date.now() + 2 * 86400000).toISOString(),
    idempotency_key: "dental_step3",
    gmail_thread_id: "thr_zenith_1",
  });

  return { contact, company, campana };
}

test("REGLA ABSOLUTA: Cualquier respuesta humana detiene la secuencia inmediatamente", async () => {
  const store = new MemoryOutboundStore();
  const { contact } = await crearAmbientePrueba(store);

  const msgEntrante: MensajeEntranteGmail = {
    id: "msg_reply_1",
    threadId: "thr_zenith_1",
    from: "Dra. Carolina Mendez <carolina@zenith.cl>",
    to: "contacto@respon.do",
    subject: "Re: Consulta",
    date: new Date().toISOString(),
    snippet: "Hola, gracias por escribir. ¿Cuánto cuesta el servicio?",
    headers: {},
  };

  const res = await procesarMensajeEntrante(msgEntrante, store);

  assert.equal(res.procesado, true);
  assert.equal(res.secuenciaDetenida, true, "La secuencia debe ser detenida");

  // Verificar que el contacto quedó pausado
  const contactoActualizado = await store.getContactById(contact.id);
  assert.equal(contactoActualizado?.secuencia_pausada, true);

  // Verificar que los ítems en cola fueron CANCELADOS
  const outboxItems = await store.listOutbox();
  const itemsContacto = outboxItems.filter((i) => i.contact_id === contact.id);
  assert.equal(itemsContacto.every((i) => i.estado === "cancelled"), true);
});

test("OPT-OUT: Solicitud de no contacto añade a supresión global permanente", async () => {
  const store = new MemoryOutboundStore();
  const { contact } = await crearAmbientePrueba(store);

  const msgEntrante: MensajeEntranteGmail = {
    id: "msg_optout_1",
    threadId: "thr_zenith_1",
    from: "carolina@zenith.cl",
    to: "contacto@respon.do",
    subject: "Re: Consulta",
    date: new Date().toISOString(),
    snippet: "no me interesa, no enviar más correos",
    headers: {},
  };

  const res = await procesarMensajeEntrante(msgEntrante, store);
  assert.equal(res.clasificacion, "opt_out");

  const supCheck = await store.isSuppressed("carolina@zenith.cl");
  assert.equal(supCheck.suppressed, true, "Debe quedar en supresión global permanente");
});

test("AUTORESPONDER / OUT-OF-OFFICE: Aplica temporary_hold sin detener secuencia permanentemente", async () => {
  const store = new MemoryOutboundStore();
  const { contact } = await crearAmbientePrueba(store);

  const msgAuto: MensajeEntranteGmail = {
    id: "msg_auto_1",
    threadId: "thr_zenith_1",
    from: "carolina@zenith.cl",
    to: "contacto@respon.do",
    subject: "Respuesta automática: Fuera de la oficina",
    date: new Date().toISOString(),
    snippet: "Estoy de vacaciones fuera de la oficina hasta el próximo lunes.",
    headers: {
      "auto-submitted": "auto-replied",
    },
  };

  assert.equal(esAutoresponderDeterminista(msgAuto), true);

  const res = await procesarMensajeEntrante(msgAuto, store);
  assert.equal(res.tipo, "autoresponder");
  assert.equal(res.secuenciaDetenida, false, "No debe matar la secuencia comercial");

  const contactoActualizado = await store.getContactById(contact.id);
  assert.ok(contactoActualizado?.hold_hasta, "Debe tener fecha de hold temporal asignada");
});

test("HARD BOUNCE: Invalida contacto, cancela secuencia y añade a supresiones", async () => {
  const store = new MemoryOutboundStore();
  const { contact } = await crearAmbientePrueba(store);

  const msgNdr: MensajeEntranteGmail = {
    id: "msg_ndr_hard",
    threadId: "thr_zenith_1",
    from: "mailer-daemon@googlemail.com",
    to: "contacto@respon.do",
    subject: "Delivery Status Notification (Failure)",
    date: new Date().toISOString(),
    snippet: "550 5.1.1 The email account that you tried to reach does not exist: carolina@zenith.cl",
    headers: {},
  };

  const diag = analizarMensajeRebote(msgNdr);
  assert.equal(diag.esBounce, true);
  assert.equal(diag.esHard, true);

  const res = await procesarRebote(msgNdr, store);
  assert.equal(res.esBounce, true);

  const contactoActualizado = await store.getContactById(contact.id);
  assert.equal(contactoActualizado?.verificacion_estado, "invalid");
  assert.equal(contactoActualizado?.secuencia_pausada, true);

  const supCheck = await store.isSuppressed("carolina@zenith.cl");
  assert.equal(supCheck.suppressed, true);
});

test("SOFT BOUNCE: Registra evento sin destruir ni suprimir el contacto", async () => {
  const store = new MemoryOutboundStore();
  const { contact } = await crearAmbientePrueba(store);

  const msgSoft: MensajeEntranteGmail = {
    id: "msg_ndr_soft",
    threadId: "thr_zenith_1",
    from: "mailer-daemon@googlemail.com",
    to: "contacto@respon.do",
    subject: "Delivery Status Notification (Failure)",
    date: new Date().toISOString(),
    snippet: "452 4.2.2 Mailbox is full / quota exceeded for carolina@zenith.cl",
    headers: {},
  };

  const diag = analizarMensajeRebote(msgSoft);
  assert.equal(diag.esBounce, true);
  assert.equal(diag.esHard, false, "Buzón lleno es soft bounce");

  const res = await procesarRebote(msgSoft, store);
  assert.equal(res.esBounce, true);

  const contactoActualizado = await store.getContactById(contact.id);
  assert.notEqual(contactoActualizado?.verificacion_estado, "invalid", "No debe marcarse inválido");

  const supCheck = await store.isSuppressed("carolina@zenith.cl");
  assert.equal(supCheck.suppressed, false, "No debe suprimirse por soft bounce");
});

test("SENDER POOL: Marcelo no se asigna automáticamente a campañas COLD", async () => {
  const store = new MemoryOutboundStore();
  const { campana } = await crearAmbientePrueba(store);

  // Campaña tipo 'cold'
  const senderElegido = await seleccionarSenderDeterminista({
    store,
    campana,
    esNuevoLead: true,
  });

  assert.ok(senderElegido);
  assert.notEqual(
    senderElegido.email,
    "marcelo@respon.do",
    "Marcelo no debe entrar a pool cold (cold_outreach_enabled=false)",
  );
  assert.equal(senderElegido.cold_outreach_enabled, true);
});
