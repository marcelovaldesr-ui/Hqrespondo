-- ============================================================
-- 009 — Growth Studio: persistencia OPCIONAL de contenido creado
-- por el equipo. El contenido base vive como seed en código
-- (lib/growth/*). Estas tablas guardan ideas y ítems de calendario
-- que el equipo cree o edite dentro del módulo.
--
-- ADITIVA Y SEGURA: solo CREATE TABLE IF NOT EXISTS. No toca datos
-- existentes. Si NO se ejecuta, Growth Studio igual funciona en modo
-- solo-lectura (lib/growth/store.ts degrada al seed sin romper la app).
--
-- Ejecutar en: Supabase > SQL Editor > New query > Run.
-- ============================================================

-- Ideas de contenido creadas por el equipo
create table if not exists growth_ideas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  pilar text not null default 'problema',
  rubro text,                              -- slug de RUBROS o null (transversal)
  canal text not null default 'instagram',
  formato text not null default 'carrusel',
  prioridad text not null default 'media' check (prioridad in ('alta','media','baja')),
  estado text not null default 'idea'
    check (estado in ('idea','borrador','en_revision','listo','publicado','descartado')),
  responsable text,
  fecha_sugerida date,
  fuente text,
  objetivo_comercial text,
  funnel text not null default 'descubrimiento'
    check (funnel in ('descubrimiento','consideracion','decision')),
  cta text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_ideas_estado_idx on growth_ideas (estado);
create index if not exists growth_ideas_pilar_idx on growth_ideas (pilar);

-- Ítems del calendario de contenido
create table if not exists growth_calendar (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  fecha date not null,
  canal text not null default 'instagram',
  formato text not null default 'carrusel',
  pilar text not null default 'problema',
  rubro text,
  estado text not null default 'idea'
    check (estado in ('idea','borrador','en_revision','listo','publicado','descartado')),
  responsable text,
  idea_id uuid references growth_ideas(id) on delete set null,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_calendar_fecha_idx on growth_calendar (fecha);

-- updated_at automático (usa la función set_updated_at del schema base)
drop trigger if exists growth_ideas_updated_at on growth_ideas;
create trigger growth_ideas_updated_at
  before update on growth_ideas
  for each row execute function set_updated_at();

drop trigger if exists growth_calendar_updated_at on growth_calendar;
create trigger growth_calendar_updated_at
  before update on growth_calendar
  for each row execute function set_updated_at();

-- Seguridad (mismo criterio del resto: RLS on sin policies, service_role server-only)
alter table growth_ideas enable row level security;
alter table growth_calendar enable row level security;
revoke all on growth_ideas, growth_calendar from anon, authenticated;
