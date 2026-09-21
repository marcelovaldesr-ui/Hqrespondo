import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { verificarAutorizacionOutbound } from "../../lib/outbound/auth";
import { procesarMensajeEntrante } from "../../lib/outbound/replies";
import { MemoryOutboundStore } from "../../lib/outbound/store";

test("AUTH: rechaza secretos en query string y acepta header dedicado", () => {
  process.env.HQ_API_TOKEN = "secret-operational-test";
  const query = new Request("https://hq.test/api/outbound/dispatch?token=secret-operational-test");
  const header = new Request("https://hq.test/api/outbound/dispatch", {
    headers: { "x-hq-token": "secret-operational-test" },
  });
  assert.equal(verificarAutorizacionOutbound(query), false);
  assert.equal(verificarAutorizacionOutbound(header), true);
});

test("REPLIES: el mismo gmail_message_id solo produce efectos una vez", async () => {
  const store = new MemoryOutboundStore();
  const source = await store.createLeadSource({
    tipo_origen: "carga_manual", nombre: "test", referencia: null, url: null, notas: null,
  });
  const company = await store.createCompany({
    nombre: "Acme", nombre_normalizado: "Acme", matching_key: "acme", rut: null,
    sitio_web: null, dominio_web: "acme.cl", rubro: null, comuna: null, region: null,
    n_empleados: null, encaje_icp: "alto", posible_duplicado: false, duplicado_de_id: null, tags: [],
  });
  const contact = await store.createContact({
    company_id: company.id, source_id: source.id, nombre: "Ana", apellido: null, cargo: null,
    email: "ana@acme.cl", email_normalizado: "ana@acme.cl", telefono: null, linkedin_url: null,
    tipo_relacion: "cold", relacion_detalle: null, relationship_approved_for_copy: false,
    verificacion_estado: "valid", verificacion_proveedor: null, verificacion_fecha: null,
    verificacion_detalle: null, secuencia_pausada: false, secuencia_pausada_motivo: null, hold_hasta: null,
  });
  const message = {
    id: "gmail-unique-1", threadId: "thread-1", from: "Ana <ana@acme.cl>", to: "sender@respon-do.test",
    subject: "Re: Hola", date: new Date().toISOString(), snippet: "no", headers: {},
  };
  assert.equal((await procesarMensajeEntrante(message, store)).procesado, true);
  assert.equal((await procesarMensajeEntrante(message, store)).procesado, false);
  assert.equal((await store.listReplies()).filter((reply) => reply.contact_id === contact.id).length, 1);
});

test("SQL 045: pausa seeds, habilita RLS e idempotencia durable", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/045_outbound_operational_safety.sql"),
    "utf8",
  );
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table/i);
  assert.match(sql, /outbound_replies_gmail_message_id_uidx/i);
  assert.match(sql, /active = false/i);
  assert.match(sql, /'simulated'/i);
});

test("SQL 046: corrige el dominio hacia adelante sin inventar dos inboxes", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/046_outbound_domain_correction.sql"),
    "utf8",
  );
  assert.match(sql, /respon-do\.com/i);
  assert.match(sql, /marcelo@respon-do\.com/i);
  assert.match(sql, /delete from public\.outbound_senders/i);
  assert.match(sql, /contacto@respon\.do/i);
  assert.match(sql, /crecimiento@respon\.do/i);
  assert.doesNotMatch(sql, /contacto@respon-do\.com/i);
  assert.doesNotMatch(sql, /crecimiento@respon-do\.com/i);
});
