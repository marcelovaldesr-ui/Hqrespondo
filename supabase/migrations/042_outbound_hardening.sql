-- ==============================================================================
-- 042_outbound_hardening.sql
-- MIGRACIÓN DE SEGURIDAD, AUDITORÍA Y ENDURECIMIENTO — Outbound V1
-- ==============================================================================

-- 1. Control de Aprobación en Review Mode y Detección de Modificación Posterior
ALTER TABLE outbound_outbox
  ADD COLUMN IF NOT EXISTS approved_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_copy_hash TEXT DEFAULT NULL;

COMMENT ON COLUMN outbound_outbox.approved_copy_hash IS
  'Hash SHA-256 de subject + body aprobado. Si el mensaje se edita tras la aprobación, el hash difiere y el despacho se bloquea automáticamente exigiendo nueva aprobación.';

-- 2. Minimización de Datos en Auto-Replies (Ley 21.719)
ALTER TABLE outbound_replies
  ADD COLUMN IF NOT EXISTS reason_category TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_date TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN outbound_replies.reason_category IS
  'Categoría genérica del autoresponder (ej. out_of_office) sin almacenar motivos personales, médicos o diagnósticos.';

-- 3. Clasificación Granular de Rebotes (Evitar falsas supresiones por SPF/DMARC)
ALTER TABLE outbound_events
  ADD COLUMN IF NOT EXISTS bounce_classification TEXT DEFAULT NULL;

COMMENT ON COLUMN outbound_events.bounce_classification IS
  'Clasificación estricta: RECIPIENT_INVALID (supresión), SENDER_OR_POLICY_REJECTION (alerta de infraestructura sin supresión), SOFT_BOUNCE o UNKNOWN.';

-- 4. Trazabilidad Legal en Fuentes (Ley 21.719)
ALTER TABLE outbound_lead_sources
  ADD COLUMN IF NOT EXISTS justificacion TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fecha_obtencion TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN outbound_lead_sources.justificacion IS
  'Fundamento legal específico y contextualizado de la obtención del dato, sin asumir interés legítimo universal de forma hardcodeada.';

-- 5. Tabla de Estado de Suscripciones Push de Gmail (Google Cloud Pub/Sub)
CREATE TABLE IF NOT EXISTS outbound_mailbox_watches (
  mailbox_email TEXT PRIMARY KEY,
  history_id TEXT DEFAULT NULL,
  expiration TIMESTAMPTZ DEFAULT NULL,
  last_notification_at TIMESTAMPTZ DEFAULT NULL,
  last_watch_renewal_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE outbound_mailbox_watches IS
  'Registro de suscripción activa de Gmail Watch (vencimiento a los 7 días). Controla renovación automática y seguimiento de historyId.';
