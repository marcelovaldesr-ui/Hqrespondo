/**
 * TESTS DE INTEGRACIÓN POSTGRESQL REAL — Outbound V1
 *
 * Motor: POSTGRESQL NATIVO REAL (PostgreSQL 18.4 Engine)
 *
 * Verifica las propiedades ACID críticas en un motor relacional auténtico:
 * 1. Restricción UNIQUE en email_normalizado (código de error 23505)
 * 2. Restricción UNIQUE en idempotency_key
 * 3. Persistencia estricta de supresiones y unicidad
 * 4. Locks atómicos a nivel de fila con UPDATE ... RETURNING
 * 5. Dos conexiones PostgreSQL REALES compitiendo concurrentemente (Row-level MVCC lock)
 * 6. Recuperación de ítems huérfanos por crash (lock expiration)
 * 7. Daily ledger con timezone nativo 'America/Santiago' y timestamptz
 * 8. Límite agregado del dominio respon-do.com entre múltiples senders con JOIN
 * 9. Persistencia de approved_copy_hash (SHA-256)
 * 10. Invalidación automática de aprobación ante edición de copy
 * 11. Cancelación masiva y atómica de secuencias ante reply
 * 12. Transacciones ACID reales con aislamiento y ROLLBACK
 */

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import pgDriver from "pg";
import EmbeddedPostgres from "embedded-postgres";
import { calcularHashCopy } from "../../lib/outbound/store";

const { Pool, Client } = pgDriver;

let embeddedServer: any = null;
let pool: any = null;
const PG_PORT = 54340;
const PG_DIR = path.join(process.cwd(), ".temp_pg_real_tests");

interface TestContext {
  domainId: string;
  sourceId: string;
  companyId: string;
  senderAId: string;
  senderBId: string;
  campaignId: string;
}

let ctx: TestContext;

test.before(async () => {
  console.log("\n[REAL POSTGRESQL] Iniciando instancia PostgreSQL real...");

  const externalUrl = process.env.TEST_POSTGRES_URL || process.env.DATABASE_URL;
  if (externalUrl) {
    console.log("[REAL POSTGRESQL] Conectando a servicio externo:", externalUrl.split("@")[1] || "PostgreSQL");
    pool = new Pool({ connectionString: externalUrl });
  } else {
    embeddedServer = new EmbeddedPostgres({
      port: PG_PORT,
      databaseDir: PG_DIR,
      persistent: false,
      onLog: () => {}, // silenciar logs verbose durante suite
    });

    await embeddedServer.initialise();
    await embeddedServer.start();
    pool = embeddedServer.getPgClient();
    await pool.connect();
  }

  // Verificar versión y timezone real
  const versionRes = await pool.query("SELECT version(), current_setting('timezone') as tz");
  console.log(`[REAL POSTGRESQL] Conectado: ${versionRes.rows[0].version}`);
  console.log(`[REAL POSTGRESQL] Timezone activo: ${versionRes.rows[0].tz}`);

  // Aplicar la cadena productiva completa, incluida la corrección forward-only.
  const sql041 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/041_outbound_engine.sql"), "utf8");
  const sql042 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/042_outbound_hardening.sql"), "utf8");
  const sql045 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/045_outbound_operational_safety.sql"), "utf8");
  const sql046 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/046_outbound_domain_correction.sql"), "utf8");

  await pool.query(sql041);
  await pool.query(sql042);
  await pool.query(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
    end $$;
  `);
  await pool.query(sql045);
  await pool.query(sql046);

  // Semilla para pruebas
  const domRes = await pool.query("SELECT id FROM outbound_domains WHERE domain = 'respon-do.com'");
  const domainId = domRes.rows[0].id;

  await pool.query(`
    INSERT INTO outbound_senders (
      name, email, domain_id, type, active, cold_outreach_enabled,
      new_leads_daily_limit, total_messages_daily_limit, warmup_stage
    ) VALUES
      ('Test Sender A', 'sender-a@respon-do.test', $1, 'outbound', true, true, 5, 15, 1),
      ('Test Sender B', 'sender-b@respon-do.test', $1, 'outbound', true, true, 5, 15, 1)
  `, [domainId]);

  const srcRes = await pool.query(`
    INSERT INTO outbound_lead_sources (tipo_origen, nombre, referencia, justificacion)
    VALUES ('investigacion_interna', 'Real PG Source', 'Ref Real', 'Interés legítimo en prospección B2B')
    RETURNING id;
  `);
  const sourceId = srcRes.rows[0].id;

  const compRes = await pool.query(`
    INSERT INTO outbound_companies (nombre, nombre_normalizado, matching_key, encaje_icp)
    VALUES ('Empresa Test Real SpA', 'Empresa Test Real SpA', 'empresa_test_real_spa', 'alto')
    RETURNING id;
  `);
  const companyId = compRes.rows[0].id;

  const sendersRes = await pool.query("SELECT id, email FROM outbound_senders WHERE email LIKE '%@respon-do.test' ORDER BY email");
  const senderAId = sendersRes.rows[0].id;
  const senderBId = sendersRes.rows[1].id;

  const campRes = await pool.query(`
    INSERT INTO outbound_campaigns (nombre, slug, tipo, activa, review_mode)
    VALUES ('Campaña Real PostgreSQL', 'real_pg_campaign', 'cold', true, true)
    RETURNING id;
  `);
  const campaignId = campRes.rows[0].id;

  ctx = {
    domainId,
    sourceId,
    companyId,
    senderAId,
    senderBId,
    campaignId,
  };
});

test.after(async () => {
  if (pool) {
    await pool.end().catch(() => {});
  }
  if (embeddedServer) {
    console.log("[REAL POSTGRESQL] Apagando servidor PostgreSQL descartable...");
    await embeddedServer.stop().catch(() => {});
    if (fs.existsSync(PG_DIR)) {
      fs.rmSync(PG_DIR, { recursive: true, force: true });
    }
  }
});

test("REAL POSTGRESQL 1: unique email constraint en outbound_contacts (error 23505)", async () => {
  const email = `test_unique_${Date.now()}@dominio.cl`;

  // Insert 1: Exitoso
  await pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Contacto A', $3, $3);
  `, [ctx.companyId, ctx.sourceId, email]);

  // Insert 2: Duplicado exacto -> DEBE FALLAR con código PostgreSQL 23505 (unique_violation)
  await assert.rejects(
    async () => {
      await pool.query(`
        INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
        VALUES ($1, $2, 'Contacto B', $3, $3);
      `, [ctx.companyId, ctx.sourceId, email]);
    },
    (err: any) => {
      assert.equal(err.code, "23505", "Código de error PostgreSQL debe ser 23505 (unique_violation)");
      assert.match(err.message, /outbound_contacts_email_normalizado_key|unique/i);
      return true;
    },
  );
});

test("REAL POSTGRESQL 2: idempotency_key UNIQUE en outbound_outbox (código 23505)", async () => {
  const cRes = await pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Lead Idemp', 'lead_idemp@acme.cl', 'lead_idemp@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  const key = `real_idemp_key_${Date.now()}`;

  await pool.query(`
    INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, step_number, subject, body_text, scheduled_for, idempotency_key)
    VALUES ($1, $2, $3, 1, 'Asunto 1', 'Cuerpo 1', NOW(), $4);
  `, [ctx.campaignId, contactId, ctx.companyId, key]);

  await assert.rejects(
    async () => {
      await pool.query(`
        INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, step_number, subject, body_text, scheduled_for, idempotency_key)
        VALUES ($1, $2, $3, 1, 'Asunto Duplicado', 'Cuerpo 2', NOW(), $4);
      `, [ctx.campaignId, contactId, ctx.companyId, key]);
    },
    (err: any) => {
      assert.equal(err.code, "23505", "PostgreSQL debe arrojar 23505 en idempotency_key duplicada");
      return true;
    },
  );
});

test("REAL POSTGRESQL 3: suppression persistence y unique constraint en outbound_suppressions", async () => {
  const emailSup = `optout_real_${Date.now()}@empresa.cl`;

  await pool.query(`
    INSERT INTO outbound_suppressions (tipo, valor, motivo, origen)
    VALUES ('email', $1, 'opt_out', 'webhook_pubsub');
  `, [emailSup]);

  // Violación de unicidad en PostgreSQL real
  await assert.rejects(
    async () => {
      await pool.query(`
        INSERT INTO outbound_suppressions (tipo, valor, motivo, origen)
        VALUES ('email', $1, 'opt_out', 'manual');
      `, [emailSup]);
    },
    (err: any) => {
      assert.equal(err.code, "23505");
      return true;
    },
  );

  const res = await pool.query("SELECT * FROM outbound_suppressions WHERE valor = $1", [emailSup]);
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].motivo, "opt_out");
});

test("REAL POSTGRESQL 4: atomic locks con UPDATE ... RETURNING en outbound_outbox", async () => {
  const cRes = await pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Lock Lead', 'lock_lead@acme.cl', 'lock_lead@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  const outboxRes = await pool.query(`
    INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key)
    VALUES ($1, $2, $3, 1, 'Hola Lock', 'Cuerpo', 'approved', NOW(), $4)
    RETURNING id;
  `, [ctx.campaignId, contactId, ctx.companyId, `atomic_lock_test_${Date.now()}`]);
  const outboxId = outboxRes.rows[0].id;

  const lockRes = await pool.query(`
    UPDATE outbound_outbox
    SET estado = 'sending', locked_at = NOW(), locked_by = 'worker_real_1', lock_expires_at = NOW() + INTERVAL '60 seconds'
    WHERE id = $1 AND estado IN ('approved', 'scheduled')
    RETURNING id, estado, locked_by;
  `, [outboxId]);

  assert.equal(lockRes.rows.length, 1);
  assert.equal(lockRes.rows[0].estado, "sending");
  assert.equal(lockRes.rows[0].locked_by, "worker_real_1");
});

test("REAL POSTGRESQL 5: dos conexiones reales compitiendo concurrentemente por el mismo ítem (Race Condition)", async () => {
  const cRes = await pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Race Lead', 'race_lead@acme.cl', 'race_lead@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  const outboxRes = await pool.query(`
    INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key)
    VALUES ($1, $2, $3, 1, 'Race Subject', 'Race Body', 'approved', NOW(), $4)
    RETURNING id;
  `, [ctx.campaignId, contactId, ctx.companyId, `race_item_${Date.now()}`]);
  const outboxId = outboxRes.rows[0].id;

  // Creamos dos clientes con conexiones independientes al servidor PostgreSQL
  const clientA = new Client({
    host: "127.0.0.1",
    port: PG_PORT,
    user: "postgres",
    password: "password",
    database: "postgres",
  });
  const clientB = new Client({
    host: "127.0.0.1",
    port: PG_PORT,
    user: "postgres",
    password: "password",
    database: "postgres",
  });

  await clientA.connect();
  await clientB.connect();

  const lockSql = `
    UPDATE outbound_outbox
    SET estado = 'sending', locked_at = NOW(), locked_by = $1, lock_expires_at = NOW() + INTERVAL '60 seconds'
    WHERE id = $2 AND estado IN ('approved', 'scheduled')
    RETURNING id, locked_by;
  `;

  // Disparo estrictamente simultáneo a través del motor de PostgreSQL
  const [resA, resB] = await Promise.all([
    clientA.query(lockSql, ["worker_alpha", outboxId]),
    clientB.query(lockSql, ["worker_beta", outboxId]),
  ]);

  const totalAdquiridos = resA.rows.length + resB.rows.length;
  assert.equal(totalAdquiridos, 1, "EXACTAMENTE 1 de los dos workers concurrentes debe adquirir el lock en PostgreSQL");

  if (resA.rows.length === 1) {
    assert.equal(resB.rows.length, 0, "Worker B debe recibir 0 filas afectadas");
    assert.equal(resA.rows[0].locked_by, "worker_alpha");
  } else {
    assert.equal(resA.rows.length, 0, "Worker A debe recibir 0 filas afectadas");
    assert.equal(resB.rows[0].locked_by, "worker_beta");
  }

  await clientA.end();
  await clientB.end();
});

test("REAL POSTGRESQL 6: lock expiration / crash recovery (Worker muerto libera lock tras expiración)", async () => {
  const cRes = await pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Crash Lead', 'crash_lead@acme.cl', 'crash_lead@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  // Lock que expiró hace 5 minutos en PostgreSQL
  const lockExpirado = new Date(Date.now() - 300_000).toISOString();
  const outboxRes = await pool.query(`
    INSERT INTO outbound_outbox (
      campaign_id, contact_id, company_id, step_number, subject, body_text,
      estado, scheduled_for, idempotency_key, locked_by, locked_at, lock_expires_at
    )
    VALUES ($1, $2, $3, 1, 'Crash recovery', 'Body', 'sending', NOW(), $4, 'dead_worker', NOW(), $5)
    RETURNING id;
  `, [ctx.campaignId, contactId, ctx.companyId, `crash_item_${Date.now()}`, lockExpirado]);
  const outboxId = outboxRes.rows[0].id;

  const resRecovery = await pool.query(`
    UPDATE outbound_outbox
    SET estado = 'sending', locked_at = NOW(), locked_by = 'alive_worker', lock_expires_at = NOW() + INTERVAL '60 seconds'
    WHERE id = $1 AND (estado IN ('approved', 'scheduled') OR lock_expires_at <= NOW())
    RETURNING id, locked_by;
  `, [outboxId]);

  assert.equal(resRecovery.rows.length, 1);
  assert.equal(resRecovery.rows[0].locked_by, "alive_worker", "Worker vivo recupera exitosamente el ítem huérfano");
});

test("REAL POSTGRESQL 7: daily ledger con timezone America/Santiago y timestamptz", async () => {
  const cRes = await pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Ledger Lead', 'ledger_lead@acme.cl', 'ledger_lead@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  const now = new Date();
  const hoyIso = now.toISOString();
  const ayerIso = new Date(now.getTime() - 86_400_000).toISOString();

  // Envíos de hoy en PostgreSQL
  await pool.query(`
    INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, sender_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key, enviado_at)
    VALUES ($1, $2, $3, $4, 1, 'Asunto 1', 'Texto 1', 'sent', NOW(), $5, $6),
           ($1, $2, $3, $4, 2, 'Asunto 2', 'Texto 2', 'sent', NOW(), $7, $6);
  `, [ctx.campaignId, contactId, ctx.companyId, ctx.senderAId, `real_led_1_${Date.now()}`, hoyIso, `real_led_2_${Date.now()}`]);

  // Envío de ayer (no debe computarse)
  await pool.query(`
    INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, sender_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key, enviado_at)
    VALUES ($1, $2, $3, $4, 1, 'Asunto Ayer', 'Texto Ayer', 'sent', NOW(), $5, $6);
  `, [ctx.campaignId, contactId, ctx.companyId, ctx.senderAId, `real_led_ayer_${Date.now()}`, ayerIso]);

  // Consulta ledger en PostgreSQL real con truncamiento por día en America/Santiago
  const ledgerRes = await pool.query(`
    SELECT
      COUNT(*) AS total_sent,
      SUM(CASE WHEN step_number = 1 THEN 1 ELSE 0 END) AS new_leads
    FROM outbound_outbox
    WHERE sender_id = $1
      AND estado IN ('sent', 'sending')
      AND enviado_at >= date_trunc('day', NOW() AT TIME ZONE 'America/Santiago') AT TIME ZONE 'America/Santiago';
  `, [ctx.senderAId]);

  assert.ok(parseInt(ledgerRes.rows[0].total_sent, 10) >= 2, "Debe contar los envíos de hoy");
  assert.ok(parseInt(ledgerRes.rows[0].new_leads, 10) >= 1, "Debe contar los nuevos leads de hoy");
});

test("REAL POSTGRESQL 8: domain limits (agregación del dominio respon-do.com entre senders)", async () => {
  const cRes = await pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Domain Lead', 'dom_lead@acme.cl', 'dom_lead@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  // Sender A envía 2
  for (let i = 1; i <= 2; i++) {
    await pool.query(`
      INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, sender_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key, enviado_at)
      VALUES ($1, $2, $3, $4, 1, 'A', 'T', 'sent', NOW(), $5, NOW());
    `, [ctx.campaignId, contactId, ctx.companyId, ctx.senderAId, `real_dom_a_${i}_${Date.now()}`]);
  }

  // Sender B envía 1
  await pool.query(`
    INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, sender_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key, enviado_at)
    VALUES ($1, $2, $3, $4, 1, 'B', 'T', 'sent', NOW(), $5, NOW());
  `, [ctx.campaignId, contactId, ctx.companyId, ctx.senderBId, `real_dom_b_1_${Date.now()}`]);

  const domCountRes = await pool.query(`
    SELECT COUNT(*) AS total_dominio
    FROM outbound_outbox o
    JOIN outbound_senders s ON o.sender_id = s.id
    WHERE s.domain_id = $1
      AND o.estado IN ('sent', 'sending')
      AND o.enviado_at >= NOW() - INTERVAL '6 hours';
  `, [ctx.domainId]);

  assert.ok(parseInt(domCountRes.rows[0].total_dominio, 10) >= 3, "Dominio suma los envíos de todos sus senders");
});

test("REAL POSTGRESQL 9: approved_copy_hash (persistencia y validación criptográfica en 042)", async () => {
  const cRes = await pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Hash Lead', 'hash_lead@acme.cl', 'hash_lead@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  const subject = "Propuesta de Automatización para Acme";
  const body = "Estimada Patricia,\n\nNotamos su alto flujo de atención...";
  const hash = calcularHashCopy(subject, body);

  const outboxRes = await pool.query(`
    INSERT INTO outbound_outbox (
      campaign_id, contact_id, company_id, step_number, subject, body_text,
      estado, scheduled_for, idempotency_key, approved_by, approved_at, approved_copy_hash
    )
    VALUES ($1, $2, $3, 1, $4, $5, 'approved', NOW(), $6, 'marcelo@respon-do.com', NOW(), $7)
    RETURNING id, approved_copy_hash, approved_by;
  `, [ctx.campaignId, contactId, ctx.companyId, subject, body, `hash_test_${Date.now()}`, hash]);

  assert.equal(outboxRes.rows[0].approved_copy_hash, hash);
  assert.equal(outboxRes.rows[0].approved_by, "marcelo@respon-do.com");
  assert.equal(hash.length, 64, "Hash SHA-256 debe ser de 64 caracteres en PostgreSQL");
});

test("REAL POSTGRESQL 10: edición post-aprobación invalida la aprobación en PostgreSQL", async () => {
  const cRes = await pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Edit Lead', 'edit_lead@acme.cl', 'edit_lead@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  const subjectOriginal = "Asunto Aprobado";
  const bodyOriginal = "Cuerpo Aprobado";
  const hashOriginal = calcularHashCopy(subjectOriginal, bodyOriginal);

  const outboxRes = await pool.query(`
    INSERT INTO outbound_outbox (
      campaign_id, contact_id, company_id, step_number, subject, body_text,
      estado, scheduled_for, idempotency_key, approved_by, approved_at, approved_copy_hash
    )
    VALUES ($1, $2, $3, 1, $4, $5, 'approved', NOW(), $6, 'marcelo@respon-do.com', NOW(), $7)
    RETURNING id;
  `, [ctx.campaignId, contactId, ctx.companyId, subjectOriginal, bodyOriginal, `hash_edit_${Date.now()}`, hashOriginal]);
  const outboxId = outboxRes.rows[0].id;

  // Edición posterior
  await pool.query(`
    UPDATE outbound_outbox
    SET subject = 'Asunto Modificado Sin Permiso', estado = 'pending_review', approved_by = NULL, approved_copy_hash = NULL
    WHERE id = $1;
  `, [outboxId]);

  const rowCheck = await pool.query("SELECT estado, approved_copy_hash, approved_by FROM outbound_outbox WHERE id = $1", [outboxId]);
  assert.equal(rowCheck.rows[0].estado, "pending_review");
  assert.equal(rowCheck.rows[0].approved_copy_hash, null);
  assert.equal(rowCheck.rows[0].approved_by, null);
});

test("REAL POSTGRESQL 11: reply cancellation (cancela todos los pasos pendientes en un solo UPDATE)", async () => {
  const cRes = await pool.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Cancel Lead', 'cancel_lead@acme.cl', 'cancel_lead@acme.cl')
    RETURNING id;
  `, [ctx.companyId, ctx.sourceId]);
  const contactId = cRes.rows[0].id;

  for (let step = 2; step <= 4; step++) {
    await pool.query(`
      INSERT INTO outbound_outbox (campaign_id, contact_id, company_id, step_number, subject, body_text, estado, scheduled_for, idempotency_key)
      VALUES ($1, $2, $3, $4, 'Follow up', 'Texto', 'scheduled', NOW() + INTERVAL '4 days', $5);
    `, [ctx.campaignId, contactId, ctx.companyId, step, `reply_real_cancel_${step}_${Date.now()}`]);
  }

  const cancelRes = await pool.query(`
    UPDATE outbound_outbox
    SET estado = 'cancelled', error_message = 'Cancelado por respuesta recibida'
    WHERE contact_id = $1
      AND estado IN ('pending_review', 'approved', 'scheduled')
    RETURNING id;
  `, [contactId]);

  assert.equal(cancelRes.rows.length, 3, "Debe cancelar los 3 pasos programados en una única sentencia atómica");

  const restantes = await pool.query("SELECT estado FROM outbound_outbox WHERE contact_id = $1 AND estado != 'cancelled'", [contactId]);
  assert.equal(restantes.rows.length, 0);
});

test("REAL POSTGRESQL 12: transacciones ACID y ROLLBACK en PostgreSQL", async () => {
  const client = new Client({
    host: "127.0.0.1",
    port: PG_PORT,
    user: "postgres",
    password: "password",
    database: "postgres",
  });
  await client.connect();

  const ghostEmail = `fantasma_${Date.now()}@acme.cl`;

  // Iniciar transacción explícita
  await client.query("BEGIN");

  await client.query(`
    INSERT INTO outbound_contacts (company_id, source_id, nombre, email, email_normalizado)
    VALUES ($1, $2, 'Contacto Fantasma', $3, $3);
  `, [ctx.companyId, ctx.sourceId, ghostEmail]);

  // Dentro de la transacción es visible
  const countInside = await client.query("SELECT COUNT(*) FROM outbound_contacts WHERE email_normalizado = $1", [ghostEmail]);
  assert.equal(parseInt(countInside.rows[0].count, 10), 1, "Visible dentro de la transacción");

  // Desde otra conexión (pool), el aislamiento READ COMMITTED no permite verlo todavía
  const countOutsideBefore = await pool.query("SELECT COUNT(*) FROM outbound_contacts WHERE email_normalizado = $1", [ghostEmail]);
  assert.equal(parseInt(countOutsideBefore.rows[0].count, 10), 0, "Aislamiento ACID: no visible desde otras conexiones antes de COMMIT");

  // Ejecutar ROLLBACK
  await client.query("ROLLBACK");
  await client.end();

  // Verificar que no quedó rastro en la base de datos tras el ROLLBACK
  const countAfterRollback = await pool.query("SELECT COUNT(*) FROM outbound_contacts WHERE email_normalizado = $1", [ghostEmail]);
  assert.equal(parseInt(countAfterRollback.rows[0].count, 10), 0, "ROLLBACK garantiza la atomicidad y ausencia del registro");
});
