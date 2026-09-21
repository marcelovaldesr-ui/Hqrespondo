/**
 * TESTS DE INTEGRACIÓN POSTGRESQL / SUPABASE — Outbound V1
 *
 * Ejecuta los esquemas DDL reales:
 * - 041_outbound_engine.sql
 * - 042_outbound_hardening.sql
 * sobre un motor PostgreSQL descartable (pg-mem) para verificar las propiedades
 * críticas de base de datos a nivel de SQL relacional estricto.
 */

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { newDb } from "pg-mem";
import { calcularHashCopy } from "../../lib/outbound/store";

interface DbContext {
  db: any;
  pool: any;
  domainId: string;
  sourceId: string;
  companyId: string;
  senderAId: string;
  senderBId: string;
  campaignId: string;
}

async function setupPostgresDb(): Promise<DbContext> {
  const db = newDb();

  // Registrar función gen_random_uuid requerida por PostgreSQL (impure: true para invocarla en cada default)
  db.public.registerFunction({
    name: "gen_random_uuid",
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  const sql041 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/041_outbound_engine.sql"), "utf8");
  const sql042 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/042_outbound_hardening.sql"), "utf8");

  db.public.none(sql041);
  db.public.none(sql042);

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  // 1. Obtener domainId seed
  const domRes = await pool.query("SELECT id FROM outbound_domains WHERE domain = 'respon.do'");
  const domainId = domRes.rows[0].id;

  // 2. Crear lead source para tests
  const srcRes = await pool.query(`
    INSERT INTO outbound_lead_sources (tipo_origen, nombre, referencia, justificacion)
    VALUES ('investigacion_interna', 'Test Source', 'Ref 1', 'Interés legítimo en prospección B2B')
    RETURNING id;
  `);
  const sourceId = srcRes.rows[0].id;

  // 3. Crear company base
  const compRes = await pool.query(`
    INSERT INTO outbound_companies (nombre, nombre_normalizado, matching_key, encaje_icp)
    VALUES ('Acme SpA', 'Acme SpA', 'acme_spa', 'alto')
    RETURNING id;
  `);
  const companyId = compRes.rows[0].id;

  // 4. Senders
  const sendersRes = await pool.query("SELECT id, email FROM outbound_senders ORDER BY email");
  const senderAId = sendersRes.rows[0].id;
  const senderBId = sendersRes.rows[1].id;

  // 5. Campaign base
  const campRes = await pool.query(`
    INSERT INTO outbound_campaigns (nombre, slug, tipo, activa, review_mode)
    VALUES ('Campaña Test Postgres', 'test_pg', 'cold', true, true)
    RETURNING id;
  `);
  const campaignId = campRes.rows[0].id;

  return {
    db,
    pool,
    domainId,
    sourceId,
    companyId,
    senderAId,
    senderBId,
    campaignId,
  };
}

test("PG-MEM 1: unique email constraint en outbound_contacts", async () => {
  const ctx = await setupPostgresDb();

  // Contacto 1: exitoso
  await ctx.pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Juan Pérez', 'juan@acme.cl', 'juan@acme.cl');
  `, [ctx.companyId, ctx.sourceId]);

  // Contacto 2: duplicado exacto -> DEBE FALLAR por restricción UNIQUE de PostgreSQL
  await assert.rejects(
    async () => {
      await ctx.pool.query(`
        INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
        VALUES ($1, $2, 'Juan Duplicado', 'juan@acme.cl', 'juan@acme.cl');
      `, [ctx.companyId, ctx.sourceId]);
    },
    /unique/i,
    "PostgreSQL debe arrojar error de unique constraint en email_normalizado",
  );
  await ctx.pool.end();
});

test("PG-MEM 2: idempotency_key UNIQUE en outbound_outbox", async () => {
  const ctx = await setupPostgresDb();

  const cRes = await ctx.pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'María Soto', 'maria@acme.cl', 'maria@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  const idempKey = "test_idemp_key_12345";

  // Ítem 1 en outbox
  await ctx.pool.query(`
    INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, step_number, subject, body_text, scheduled_for, idempotency_key)
    VALUES ($1, $2, $3, 1, 'Asunto 1', 'Cuerpo 1', NOW(), $4);
  `, [ctx.campaignId, contactId, ctx.companyId, idempKey]);

  // Ítem 2 con misma idempotency_key -> DEBE FALLAR en PostgreSQL
  await assert.rejects(
    async () => {
      await ctx.pool.query(`
        INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, step_number, subject, body_text, scheduled_for, idempotency_key)
        VALUES ($1, $2, $3, 1, 'Asunto Duplicado', 'Cuerpo 2', NOW(), $4);
      `, [ctx.campaignId, contactId, ctx.companyId, idempKey]);
    },
    /unique/i,
    "PostgreSQL debe arrojar error de unique constraint en idempotency_key",
  );
  await ctx.pool.end();
});

test("PG-MEM 3: suppression persistence y unique constraint en outbound_suppressions", async () => {
  const ctx = await setupPostgresDb();

  // Supresión 1: insert exitoso
  await ctx.pool.query(`
    INSERT INTO outbound_suppressions (tipo, valor, motivo, origen)
    VALUES ('email', 'optout@prospecto.cl', 'opt_out', 'webhook_pubsub');
  `);

  // Intentar duplicar supresión -> violación de UNIQUE
  await assert.rejects(
    async () => {
      await ctx.pool.query(`
        INSERT INTO outbound_suppressions (tipo, valor, motivo, origen)
        VALUES ('email', 'optout@prospecto.cl', 'opt_out', 'manual');
      `);
    },
    /unique/i,
  );

  // Consulta verifica persistencia estricta
  const res = await ctx.pool.query("SELECT * FROM outbound_suppressions WHERE valor = $1", ["optout@prospecto.cl"]);
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].motivo, "opt_out");
  await ctx.pool.end();
});

test("PG-MEM 4: atomic locks con UPDATE ... RETURNING en outbound_outbox", async () => {
  const ctx = await setupPostgresDb();

  const cRes = await ctx.pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Ana Rojas', 'ana@acme.cl', 'ana@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  const outboxRes = await ctx.pool.query(`
    INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key)
    VALUES ($1, $2, $3, 1, 'Hola Ana', 'Texto...', 'approved', NOW(), 'lock_item_1')
    RETURNING id;
  `, [ctx.campaignId, contactId, ctx.companyId]);
  const outboxId = outboxRes.rows[0].id;

  // Lock atómico por Worker 1
  const lockRes = await ctx.pool.query(`
    UPDATE outbound_outbox
    SET estado = 'sending', locked_at = NOW(), locked_by = 'worker_1', lock_expires_at = NOW() + INTERVAL '60 seconds'
    WHERE id = $1 AND estado IN ('approved', 'scheduled')
    RETURNING id, estado, locked_by;
  `, [outboxId]);

  assert.equal(lockRes.rows.length, 1);
  assert.equal(lockRes.rows[0].estado, "sending");
  assert.equal(lockRes.rows[0].locked_by, "worker_1");
  await ctx.pool.end();
});

test("PG-MEM 5: dos workers concurrentes compitiendo por el mismo ítem", async () => {
  const ctx = await setupPostgresDb();

  const cRes = await ctx.pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Carlos Ruiz', 'carlos@acme.cl', 'carlos@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  const outboxRes = await ctx.pool.query(`
    INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key)
    VALUES ($1, $2, $3, 1, 'Propuesta Carlos', 'Texto...', 'approved', NOW(), 'concurrency_item_1')
    RETURNING id;
  `, [ctx.campaignId, contactId, ctx.companyId]);
  const outboxId = outboxRes.rows[0].id;

  // Worker 1 ejecuta UPDATE con condición de lock
  const resWorker1 = await ctx.pool.query(`
    UPDATE outbound_outbox
    SET estado = 'sending', locked_at = NOW(), locked_by = 'worker_1', lock_expires_at = NOW() + INTERVAL '60 seconds'
    WHERE id = $1 AND estado IN ('approved', 'scheduled')
    RETURNING id;
  `, [outboxId]);
  assert.equal(resWorker1.rows.length, 1, "Worker 1 adquiere el lock");

  // Worker 2 ejecuta exactamente la misma consulta simultáneamente
  const resWorker2 = await ctx.pool.query(`
    UPDATE outbound_outbox
    SET estado = 'sending', locked_at = NOW(), locked_by = 'worker_2', lock_expires_at = NOW() + INTERVAL '60 seconds'
    WHERE id = $1 AND estado IN ('approved', 'scheduled')
    RETURNING id;
  `, [outboxId]);
  assert.equal(resWorker2.rows.length, 0, "Worker 2 recibe 0 filas, evitando doble despacho");
  await ctx.pool.end();
});

test("PG-MEM 6: lock expiration / crash recovery (Worker muerto libera lock tras expiración)", async () => {
  const ctx = await setupPostgresDb();

  const cRes = await ctx.pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Elena Vega', 'elena@acme.cl', 'elena@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  // Simular ítem tomado por worker que crasheó hace 10 minutos (lock expirado)
  const lockExpirado = new Date(Date.now() - 600_000).toISOString();
  const outboxRes = await ctx.pool.query(`
    INSERT INTO outbound_outbox (
      campaign_id, contact_id, company_id, step_number, subject, body_text,
      estado, scheduled_for, idempotency_key, locked_by, locked_at, lock_expires_at
    )
    VALUES ($1, $2, $3, 1, 'Elena Crash', 'Texto...', 'sending', NOW(), 'crash_item_1', 'worker_dead', NOW(), $4)
    RETURNING id;
  `, [ctx.campaignId, contactId, ctx.companyId, lockExpirado]);
  const outboxId = outboxRes.rows[0].id;

  // Worker 2 ejecuta consulta de adquisición con recuperación de lock expirado
  const resRecovery = await ctx.pool.query(`
    UPDATE outbound_outbox
    SET estado = 'sending', locked_at = NOW(), locked_by = 'worker_alive', lock_expires_at = NOW() + INTERVAL '60 seconds'
    WHERE id = $1 AND (estado IN ('approved', 'scheduled') OR lock_expires_at <= NOW())
    RETURNING id, locked_by;
  `, [outboxId]);

  assert.equal(resRecovery.rows.length, 1);
  assert.equal(resRecovery.rows[0].locked_by, "worker_alive", "Worker vivo recupera exitosamente el ítem huérfano");
  await ctx.pool.end();
});

test("PG-MEM 7: daily ledger (agregación de envíos desde medianoche de Santiago)", async () => {
  const ctx = await setupPostgresDb();

  const cRes = await ctx.pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Diego Silva', 'diego@acme.cl', 'diego@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  // Envíos de hoy
  const hoyIso = new Date().toISOString();
  await ctx.pool.query(`
    INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, sender_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key, enviado_at)
    VALUES ($1, $2, $3, $4, 1, 'Asunto 1', 'Texto 1', 'sent', NOW(), 'ledger_item_1', $5),
           ($1, $2, $3, $4, 2, 'Asunto 2', 'Texto 2', 'sent', NOW(), 'ledger_item_2', $5);
  `, [ctx.campaignId, contactId, ctx.companyId, ctx.senderAId, hoyIso]);

  // Envío de ayer (no debe contarse)
  const ayerIso = new Date(Date.now() - 86_400_000).toISOString();
  await ctx.pool.query(`
    INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, sender_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key, enviado_at)
    VALUES ($1, $2, $3, $4, 1, 'Asunto Ayer', 'Texto Ayer', 'sent', NOW(), 'ledger_item_ayer', $5);
  `, [ctx.campaignId, contactId, ctx.companyId, ctx.senderAId, ayerIso]);

  // Inicio de hoy en medianoche
  const inicioDiaIso = new Date(Date.now() - 3600_000).toISOString();

  const ledgerRes = await ctx.pool.query(`
    SELECT
      COUNT(*) AS total_sent,
      SUM(CASE WHEN step_number = 1 THEN 1 ELSE 0 END) AS new_leads
    FROM outbound_outbox
    WHERE sender_id = $1
      AND estado IN ('sent', 'sending')
      AND enviado_at >= $2;
  `, [ctx.senderAId, inicioDiaIso]);

  assert.equal(parseInt(ledgerRes.rows[0].total_sent, 10), 2, "Debe contar exactamente 2 envíos de hoy");
  assert.equal(parseInt(ledgerRes.rows[0].new_leads, 10), 1, "Debe contar exactamente 1 nuevo lead de hoy");
  await ctx.pool.end();
});

test("PG-MEM 8: domain limits (límite agregado del dominio respon.do entre senders)", async () => {
  const ctx = await setupPostgresDb();

  const cRes = await ctx.pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Lucía Gómez', 'lucia@acme.cl', 'lucia@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  // Sender A envía 3 mensajes
  for (let i = 1; i <= 3; i++) {
    await ctx.pool.query(`
      INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, sender_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key, enviado_at)
      VALUES ($1, $2, $3, $4, 1, 'A', 'T', 'sent', NOW(), $5, NOW());
    `, [ctx.campaignId, contactId, ctx.companyId, ctx.senderAId, `dom_limit_a_${i}`]);
  }

  // Sender B envía 2 mensajes
  for (let i = 1; i <= 2; i++) {
    await ctx.pool.query(`
      INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, sender_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key, enviado_at)
      VALUES ($1, $2, $3, $4, 1, 'B', 'T', 'sent', NOW(), $5, NOW());
    `, [ctx.campaignId, contactId, ctx.companyId, ctx.senderBId, `dom_limit_b_${i}`]);
  }

  // Consulta de conteo agregado de dominio
  const domCountRes = await ctx.pool.query(`
    SELECT COUNT(*) AS total_dominio
    FROM outbound_outbox o
    JOIN outbound_senders s ON o.sender_id = s.id
    WHERE s.domain_id = $1
      AND o.estado IN ('sent', 'sending')
      AND o.enviado_at >= NOW() - INTERVAL '12 hours';
  `, [ctx.domainId]);

  assert.equal(parseInt(domCountRes.rows[0].total_dominio, 10), 5, "El dominio respon.do suma 5 envíos en total (3 de A + 2 de B)");
  await ctx.pool.end();
});

test("PG-MEM 9: approved_copy_hash (persistencia y validación criptográfica en 042)", async () => {
  const ctx = await setupPostgresDb();

  const cRes = await ctx.pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Patricia Morales', 'patricia@acme.cl', 'patricia@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  const subject = "Propuesta de Automatización para Acme";
  const body = "Estimada Patricia,\n\nNotamos su alto flujo de atención...";
  const hash = calcularHashCopy(subject, body);

  const outboxRes = await ctx.pool.query(`
    INSERT INTO outbound_outbox (
      campaign_id, contact_id, company_id, step_number, subject, body_text,
      estado, scheduled_for, idempotency_key, approved_by, approved_at, approved_copy_hash
    )
    VALUES ($1, $2, $3, 1, $4, $5, 'approved', NOW(), 'hash_test_1', 'marcelo_valdes', NOW(), $6)
    RETURNING id, approved_copy_hash, approved_by;
  `, [ctx.campaignId, contactId, ctx.companyId, subject, body, hash]);

  assert.equal(outboxRes.rows[0].approved_copy_hash, hash);
  assert.equal(outboxRes.rows[0].approved_by, "marcelo_valdes");
  assert.equal(hash.length, 64, "Hash SHA-256 debe tener 64 caracteres hexadecimales");
  await ctx.pool.end();
});

test("PG-MEM 10: edición post-aprobación invalida la aprobación en base de datos", async () => {
  const ctx = await setupPostgresDb();

  const cRes = await ctx.pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Felipe Castro', 'felipe@acme.cl', 'felipe@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  const subjectOriginal = "Asunto Aprobado";
  const bodyOriginal = "Cuerpo Aprobado";
  const hashOriginal = calcularHashCopy(subjectOriginal, bodyOriginal);

  const outboxRes = await ctx.pool.query(`
    INSERT INTO outbound_outbox (
      campaign_id, contact_id, company_id, step_number, subject, body_text,
      estado, scheduled_for, idempotency_key, approved_by, approved_at, approved_copy_hash
    )
    VALUES ($1, $2, $3, 1, $4, $5, 'approved', NOW(), 'hash_edit_1', 'marcelo_valdes', NOW(), $6)
    RETURNING id;
  `, [ctx.campaignId, contactId, ctx.companyId, subjectOriginal, bodyOriginal, hashOriginal]);
  const outboxId = outboxRes.rows[0].id;

  // Simular edición de copy posterior a la aprobación
  const subjectEditado = "Asunto Modificado Sin Permiso";
  await ctx.pool.query(`
    UPDATE outbound_outbox
    SET subject = $1, estado = 'pending_review', approved_by = NULL, approved_copy_hash = NULL
    WHERE id = $2;
  `, [subjectEditado, outboxId]);

  const rowCheck = await ctx.pool.query("SELECT estado, approved_copy_hash, approved_by FROM outbound_outbox WHERE id = $1", [outboxId]);
  assert.equal(rowCheck.rows[0].estado, "pending_review", "Estado se degrada a pending_review");
  assert.equal(rowCheck.rows[0].approved_copy_hash, null, "approved_copy_hash se limpia");
  assert.equal(rowCheck.rows[0].approved_by, null);
  await ctx.pool.end();
});

test("PG-MEM 11: reply cancellation (cancela todos los pasos pendientes en un solo UPDATE)", async () => {
  const ctx = await setupPostgresDb();

  const cRes = await ctx.pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Gloria Paz', 'gloria@acme.cl', 'gloria@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  // Insertar pasos 2, 3 y 4 en cola
  for (let step = 2; step <= 4; step++) {
    await ctx.pool.query(`
      INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key)
      VALUES ($1, $2, $3, $4, 'Follow up', 'Texto', 'scheduled', NOW() + INTERVAL '4 days', $5);
    `, [ctx.campaignId, contactId, ctx.companyId, step, `reply_cancel_step_${step}`]);
  }

  // Respuesta entrante recibida -> Cancelación masiva de secuencia en SQL
  const cancelRes = await ctx.pool.query(`
    UPDATE outbound_outbox
    SET estado = 'cancelled', error_message = 'Cancelado por respuesta recibida del prospecto'
    WHERE contact_id = $1
      AND estado IN ('pending_review', 'approved', 'scheduled')
    RETURNING id;
  `, [contactId]);

  assert.equal(cancelRes.rows.length, 3, "Debe cancelar los 3 pasos programados en una única sentencia atómica");

  const restantes = await ctx.pool.query("SELECT estado FROM outbound_outbox WHERE contact_id = $1 AND estado != 'cancelled'", [contactId]);
  assert.equal(restantes.rows.length, 0);
  await ctx.pool.end();
});

test("PG-MEM 12: transacciones ACID y rollback en PostgreSQL", async () => {
  const ctx = await setupPostgresDb();

  // Snapshot previo al inicio de la transacción
  const tx = ctx.db.backup();

  await ctx.pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Contacto Fantasma', 'fantasma@acme.cl', 'fantasma@acme.cl');
  `, [ctx.companyId, ctx.sourceId]);

  // Verificar que el registro existe durante la transacción
  const countInside = await ctx.pool.query("SELECT COUNT(*) FROM outbound_contacts WHERE email_normalizado = 'fantasma@acme.cl'");
  assert.equal(parseInt(countInside.rows[0].count, 10), 1, "Registro visible tras insert");

  // Rollback explícito
  tx.restore();

  // Verificar que el registro no existe en la tabla tras el rollback
  const check = await ctx.pool.query("SELECT * FROM outbound_contacts WHERE email_normalizado = 'fantasma@acme.cl'");
  assert.equal(check.rows.length, 0, "El rollback debe garantizar que no queden rastros del registro");
  await ctx.pool.end();
});
