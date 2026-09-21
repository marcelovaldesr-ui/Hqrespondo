-- ============================================================================
-- 041 — V1 MOTOR INTERNO DE PROSPECCIÓN OUTBOUND (RESPONDO)
--
-- Principios rectores:
-- 1. Protección del dominio corporativo único (respon.do).
-- 2. Trazabilidad rigurosa y minimización de datos (Ley 21.719).
-- 3. Separación de AI Reasoning de Business Logic determinista.
-- 4. Diferenciación estricta de WARM vs COLD (relationship_approved_for_copy).
-- 5. Control de límites (new_leads_daily_limit vs total_messages_daily_limit).
-- 6. Lock atómico de concurrencia e idempotencia en outbox.
-- 7. Supresión permanente global (email y dominio).
--
-- Ejecutar en: Supabase > SQL Editor. Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. DOMINIO CORPORATIVO
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_domains (
  id                  uuid primary key default gen_random_uuid(),
  domain              text not null unique,
  active              boolean not null default true,
  domain_daily_limit  int not null default 30,
  sent_today          int not null default 0,
  health_status       text not null default 'healthy'
                      check (health_status in ('healthy', 'warning', 'critical', 'paused')),
  paused              boolean not null default false,
  paused_reason       text,
  spf_status          text not null default 'unknown'
                      check (spf_status in ('pass', 'warning', 'fail', 'unknown')),
  dkim_status         text not null default 'unknown'
                      check (dkim_status in ('pass', 'warning', 'fail', 'unknown')),
  dmarc_status        text not null default 'unknown'
                      check (dmarc_status in ('pass', 'warning', 'fail', 'unknown')),
  mx_status           text not null default 'unknown'
                      check (mx_status in ('pass', 'warning', 'fail', 'unknown')),
  last_dns_check      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. SENDER ACCOUNTS (Bandejas Reales de Google Workspace)
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_senders (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  email                       text not null unique,
  domain_id                   uuid not null references public.outbound_domains(id) on delete cascade,
  type                        text not null default 'outbound'
                              check (type in ('founder', 'outbound')),
  active                      boolean not null default true,
  cold_outreach_enabled       boolean not null default false, -- Marcelo = false por defecto
  new_leads_daily_limit       int not null default 5,
  total_messages_daily_limit  int not null default 15,
  sent_today                  int not null default 0,
  new_leads_today             int not null default 0,
  warmup_stage                int not null default 1,
  warmup_started_at           timestamptz,
  health_status               text not null default 'healthy'
                              check (health_status in ('healthy', 'warning', 'critical', 'paused')),
  bounce_rate                 numeric(5, 2) not null default 0.00,
  hard_bounce_rate            numeric(5, 2) not null default 0.00,
  opt_out_rate                numeric(5, 2) not null default 0.00,
  reply_rate                  numeric(5, 2) not null default 0.00,
  last_send_at                timestamptz,
  last_error                  text,
  paused_reason               text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. PROCEDENCIA DEL LEAD (Trazabilidad y Ley 21.719)
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_lead_sources (
  id          uuid primary key default gen_random_uuid(),
  tipo_origen text not null check (tipo_origen in (
                'relacion_previa', 'referido', 'cliente_partner', 'web_publica',
                'directorio_publico', 'proveedor_externo', 'carga_manual',
                'csv', 'google_sheets', 'investigacion_interna'
              )),
  nombre      text not null,
  referencia  text,
  url         text,
  notas       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. EMPRESAS (Companies)
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_companies (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  nombre_normalizado  text not null,
  matching_key        text not null, -- Clave auxiliar de matching (NO hace merge destructivo automático)
  rut                 text,
  sitio_web           text,
  dominio_web         text,
  rubro               text,
  comuna              text,
  region              text,
  n_empleados         int,
  encaje_icp          text not null default 'sin_evaluar'
                      check (encaje_icp in ('alto', 'medio', 'bajo', 'no_encaja', 'sin_evaluar')),
  posible_duplicado   boolean not null default false,
  duplicado_de_id     uuid references public.outbound_companies(id) on delete set null,
  tags                text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_outbound_companies_matching_key on public.outbound_companies (matching_key);
create index if not exists idx_outbound_companies_dominio on public.outbound_companies (dominio_web);

-- ---------------------------------------------------------------------------
-- 5. CONTACTOS (Contacts)
-- Nota: Varios contactos pueden pertenecer legítimamente al mismo dominio.
-- El email normalizado es UNIQUE.
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_contacts (
  id                              uuid primary key default gen_random_uuid(),
  company_id                      uuid not null references public.outbound_companies(id) on delete cascade,
  source_id                       uuid not null references public.outbound_lead_sources(id),
  nombre                          text not null,
  apellido                        text,
  cargo                           text,
  email                           text not null,
  email_normalizado               text not null unique,
  telefono                        text,
  linkedin_url                    text,
  tipo_relacion                   text not null default 'cold'
                                  check (tipo_relacion in ('warm', 'cold')),
  relacion_detalle                text,
  relationship_approved_for_copy  boolean not null default false, -- Si false, el copy NO puede usar la relación
  verificacion_estado             text not null default 'unknown'
                                  check (verificacion_estado in (
                                    'unknown', 'valid', 'invalid', 'risky',
                                    'catch_all', 'disposable', 'verification_failed'
                                  )),
  verificacion_proveedor          text,
  verificacion_fecha              timestamptz,
  verificacion_detalle            text,
  secuencia_pausada               boolean not null default false,
  secuencia_pausada_motivo        text,
  hold_hasta                      timestamptz, -- Autoresponder / out-of-office temporal
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create index if not exists idx_outbound_contacts_company on public.outbound_contacts (company_id);
create index if not exists idx_outbound_contacts_email_norm on public.outbound_contacts (email_normalizado);

-- ---------------------------------------------------------------------------
-- 6. INVESTIGACIÓN Y EVIDENCIA (Minimización de datos)
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_research (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid not null unique references public.outbound_companies(id) on delete cascade,
  resumen_actividad         text not null default '',
  canales_visibles          text[] not null default '{}',
  captacion_leads           text not null default '',
  senales_dolor             text[] not null default '{}',
  propuesta_valor_respondo  text not null default '',
  evidencias                jsonb not null default '[]'::jsonb, -- Array de { insight, fuente_url, extracto, confianza }
  estado                    text not null default 'pendiente'
                            check (estado in ('completo', 'insuficiente', 'pendiente')),
  confidence_score          int not null default 0 check (confidence_score between 0 and 100),
  investigado_at            timestamptz not null default now(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. CAMPAÑAS
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_campaigns (
  id                      uuid primary key default gen_random_uuid(),
  nombre                  text not null,
  slug                    text not null unique,
  tipo                    text not null default 'cold' check (tipo in ('warm', 'cold')),
  activa                  boolean not null default false,
  review_mode             boolean not null default true, -- Review humano por defecto
  sender_pool_ids         uuid[] not null default '{}',
  daily_new_leads_limit   int not null default 10,
  horario_inicio          int not null default 9,
  horario_fin             int not null default 18,
  dias_laborales          int[] not null default '{1,2,3,4,5}',
  zona_horaria            text not null default 'America/Santiago',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. OUTBOX (Cola de Envíos con Lock Atómico e Idempotencia)
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_outbox (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.outbound_campaigns(id) on delete cascade,
  contact_id        uuid not null references public.outbound_contacts(id) on delete cascade,
  company_id        uuid not null references public.outbound_companies(id) on delete cascade,
  step_number       int not null default 1,
  sender_id         uuid references public.outbound_senders(id) on delete set null,
  subject           text not null,
  body_text         text not null,
  evidence_used     jsonb not null default '[]'::jsonb,
  estado            text not null default 'pending_review'
                    check (estado in (
                      'generated', 'pending_review', 'approved', 'scheduled',
                      'sending', 'sent', 'failed', 'cancelled', 'blocked', 'suppressed'
                    )),
  scheduled_for     timestamptz not null,
  idempotency_key   text not null unique,
  attempt_count     int not null default 0,
  locked_at         timestamptz,
  locked_by         text,
  lock_expires_at   timestamptz,
  gmail_message_id  text,
  gmail_thread_id   text,
  error_message     text,
  enviado_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_outbox_despacho on public.outbound_outbox (estado, scheduled_for)
  where estado in ('approved', 'scheduled');
create index if not exists idx_outbox_contact on public.outbound_outbox (contact_id);
create index if not exists idx_outbox_thread on public.outbound_outbox (gmail_thread_id);

-- ---------------------------------------------------------------------------
-- 9. SUPRESIONES GLOBALES (Permanente por Email o Dominio)
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_suppressions (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('email', 'dominio')),
  valor       text not null unique, -- normalizado (minúsculas, sin espacios)
  motivo      text not null check (motivo in ('opt_out', 'hard_bounce', 'queja', 'manual', 'solicitud_21719')),
  origen      text not null default 'sistema',
  notas       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_suppressions_valor on public.outbound_suppressions (valor);

-- ---------------------------------------------------------------------------
-- 10. RESPUESTAS RECIBIDAS
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_replies (
  id                  uuid primary key default gen_random_uuid(),
  outbox_id           uuid references public.outbound_outbox(id) on delete set null,
  contact_id          uuid not null references public.outbound_contacts(id) on delete cascade,
  gmail_message_id    text not null,
  gmail_thread_id     text,
  from_email          text not null,
  subject             text not null default '',
  extracto            text not null default '',
  clasificacion_ia    text not null default 'unknown'
                      check (clasificacion_ia in (
                        'positive', 'neutral', 'negative', 'later', 'opt_out',
                        'wrong_person', 'referral', 'autoresponder', 'unknown'
                      )),
  es_humano           boolean not null default true,
  es_autoresponder    boolean not null default false,
  secuencia_detenida  boolean not null default true,
  created_at          timestamptz not null default now()
);

create index if not exists idx_replies_contact on public.outbound_replies (contact_id);
create index if not exists idx_replies_thread on public.outbound_replies (gmail_thread_id);

-- ---------------------------------------------------------------------------
-- 11. AUDITORÍA Y LIBRO MAYOR DE EVENTOS (Append-Only)
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_events (
  id          uuid primary key default gen_random_uuid(),
  outbox_id   uuid references public.outbound_outbox(id) on delete set null,
  contact_id  uuid references public.outbound_contacts(id) on delete set null,
  company_id  uuid references public.outbound_companies(id) on delete set null,
  sender_id   uuid references public.outbound_senders(id) on delete set null,
  campaign_id uuid references public.outbound_campaigns(id) on delete set null,
  tipo        text not null check (tipo in (
                'import', 'research', 'copy_generated', 'review_approved',
                'scheduled', 'lock_acquired', 'send_attempted', 'sent',
                'send_failed', 'reply_received', 'sequence_stopped',
                'bounced', 'suppressed', 'limit_reached',
                'killswitch_activated', 'dns_check'
              )),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_outbound_events_tipo on public.outbound_events (tipo, created_at desc);
create index if not exists idx_outbound_events_contact on public.outbound_events (contact_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 12. SEED INICIAL: DOMINIO respon.do Y LOS 3 SENDERS
-- ---------------------------------------------------------------------------
insert into public.outbound_domains (id, domain, active, domain_daily_limit, sent_today, health_status)
values (
  '00000000-0000-0000-0000-000000000001',
  'respon.do',
  true,
  30,
  0,
  'healthy'
) on conflict (domain) do nothing;

-- Sender A: Marcelo Valdés (WARM, cold_outreach_enabled = false por defecto)
insert into public.outbound_senders (
  id, name, email, domain_id, type, active, cold_outreach_enabled,
  new_leads_daily_limit, total_messages_daily_limit, warmup_stage
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Marcelo Valdés',
  'marcelo@respon.do',
  '00000000-0000-0000-0000-000000000001',
  'founder',
  true,
  false, -- REGLA ESTRICTA: false por defecto
  5,
  15,
  5
) on conflict (email) do nothing;

-- Sender B: Outbound Mailbox 1
insert into public.outbound_senders (
  id, name, email, domain_id, type, active, cold_outreach_enabled,
  new_leads_daily_limit, total_messages_daily_limit, warmup_stage
)
values (
  '22222222-2222-2222-2222-222222222222',
  'Equipo Respondo',
  'contacto@respon.do',
  '00000000-0000-0000-0000-000000000001',
  'outbound',
  true,
  true,
  5,
  15,
  1
) on conflict (email) do nothing;

-- Sender C: Outbound Mailbox 2
insert into public.outbound_senders (
  id, name, email, domain_id, type, active, cold_outreach_enabled,
  new_leads_daily_limit, total_messages_daily_limit, warmup_stage
)
values (
  '33333333-3333-3333-3333-333333333333',
  'Ventas Respondo',
  'crecimiento@respon.do',
  '00000000-0000-0000-0000-000000000001',
  'outbound',
  true,
  true,
  5,
  15,
  1
) on conflict (email) do nothing;

commit;
