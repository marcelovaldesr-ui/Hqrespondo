-- 017: Agente de prospección multicanal (email + LinkedIn semi-auto).
--
-- Sobre la lista de oro (score>=70, con teléfono, sin contactar) el agente:
--   1) enriquece contacto (dueño, email, LinkedIn) con cascada de fuentes,
--   2) ejecuta una secuencia de toques por email (auto) y LinkedIn (redacta,
--      el humano envía),
--   3) clasifica respuestas y avisa por Telegram los leads calientes.
--
-- La "cola" es esta misma tabla: prospeccion_estado + proximo_toque_at hacen
-- que un cron pueda avanzar en lotes chicos, idempotente y reanudable. No hay
-- Redis ni BullMQ: para ~105 prospectos serie es más simple y más robusto.

-- ---------- Contacto enriquecido + ciclo de toques en prospects ----------
alter table prospects
  add column if not exists contacto_nombre   text,
  add column if not exists contacto_email    text,
  add column if not exists contacto_linkedin text,
  add column if not exists contacto_celular  text,
  add column if not exists contacto_confianza text,          -- 'alta' | 'media' | 'baja'
  add column if not exists enriquecido_at    timestamptz,
  add column if not exists enriquecer_intentos int not null default 0,
  add column if not exists prospeccion_estado text not null default 'pendiente'
    check (prospeccion_estado in (
      'pendiente',        -- en la lista de oro, aún sin tocar por el agente
      'enriqueciendo',    -- se intenta hallar contacto
      'no_encontrado',    -- 3 días / 3 intentos sin email ni nombre → al humano
      'en_secuencia',     -- recibiendo toques programados
      'respondio',        -- contestó (ver ultima_clasificacion)
      'demo_agendada',    -- lead caliente entregado al humano
      'descartado_agente',-- negativo o secuencia agotada sin respuesta
      'pausado'           -- intervención humana lo sacó del automático
    )),
  add column if not exists toque_num         int not null default 0,   -- último toque enviado (0..N)
  add column if not exists proximo_toque_at  timestamptz,              -- cuándo toca el siguiente
  add column if not exists gmail_thread_id   text,                     -- para casar respuestas
  add column if not exists ultima_clasificacion text                   -- 'positivo'|'neutral'|'negativo'
    check (ultima_clasificacion in ('positivo','neutral','negativo'));

comment on column prospects.contacto_confianza is
  'Confianza del email/contacto hallado: alta=verificado o en la web, media=Hunter/Serper, baja=patrón adivinado (nombre@dominio).';
comment on column prospects.prospeccion_estado is
  'Estado del prospecto DENTRO del agente automático. Independiente de prospects.estado (pipeline comercial humano).';
comment on column prospects.proximo_toque_at is
  'Timestamp del próximo toque a enviar. El cron diario procesa los que tengan proximo_toque_at <= now().';
comment on column prospects.gmail_thread_id is
  'threadId de Gmail del hilo de outreach. El calificador busca respuestas dentro de este hilo.';

-- Índice para que el cron pesque rápido lo pendiente/vencido.
create index if not exists idx_prospects_agente
  on prospects (prospeccion_estado, proximo_toque_at);

-- ---------- Log durable de eventos del agente ----------
-- Fuente de verdad de auditoría (en Vercel el filesystem es efímero, así que
-- el .log local es solo apoyo; esta tabla es la que persiste).
create table if not exists prospeccion_eventos (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  tipo        text not null check (tipo in (
    'enriquecimiento','email_enviado','linkedin_redactado',
    'respuesta','clasificacion','notificacion','error','sistema'
  )),
  canal       text,                    -- 'email' | 'linkedin' | 'telegram' | null
  toque_num   int,
  detalle     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_eventos_prospect on prospeccion_eventos (prospect_id, created_at desc);
create index if not exists idx_eventos_tipo      on prospeccion_eventos (tipo, created_at desc);

comment on table prospeccion_eventos is
  'Cada acción del agente (enriquecimiento, envío, respuesta, error). Sirve para rate-limiting (contar emails de la última hora) y para el reporte diario.';
