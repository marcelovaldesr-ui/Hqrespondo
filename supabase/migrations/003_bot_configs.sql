-- ============================================================
-- 003 — bot_configs: configuración operativa del bot por cliente
-- (reglas de derivación a humano, tono, horarios de atención).
-- La leen el panel (/clientes) y n8n vía GET /api/hooks/bot-config.
-- ============================================================

create table if not exists bot_configs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,
  tono text,                          -- ej: "cercano y profesional, trato de tú"
  horario_atencion jsonb not null default '{}'::jsonb,
                                      -- ej: {"lun_vie":"09:00-19:00","sab":"10:00-14:00","dom":null}
  derivacion_reglas text,             -- cuándo derivar a humano (texto libre que lee el bot)
  derivacion_contacto text,           -- a quién derivar (nombre/número WhatsApp)
  extra jsonb not null default '{}'::jsonb,  -- campo libre para reglas futuras sin migrar
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists bot_configs_updated_at on bot_configs;
create trigger bot_configs_updated_at
  before update on bot_configs
  for each row execute function set_updated_at();

alter table bot_configs enable row level security;
revoke all on bot_configs from anon, authenticated;
