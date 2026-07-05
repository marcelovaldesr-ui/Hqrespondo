-- ============================================================
-- Respondo HQ — Schema Supabase
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- ============================================================

-- ---------- Prospección ----------
create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rubro text not null,
  comuna text not null,
  telefono text,
  web text,
  direccion text,
  rating numeric,
  reviews int,
  score int not null default 50,
  razon_score text,
  mensaje text,
  estado text not null default 'nuevo'
    check (estado in ('nuevo','contactado','respondio','reunion','en_pipeline','descartado')),
  proxima_accion date,
  notas text,
  place_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospects_estado_idx on prospects (estado);
create index if not exists prospects_score_idx on prospects (score desc);

-- ---------- Pipeline ----------
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete set null,
  nombre_negocio text not null,
  rubro text,
  plan text not null default 'cotizador'
    check (plan in ('esencial','cotizador','pro')),
  valor_setup int not null default 0,
  valor_mensual int not null default 0,
  etapa text not null default 'contactado'
    check (etapa in ('contactado','demo','propuesta','cliente','perdido')),
  proxima_accion text,
  fecha_proxima date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_etapa_idx on deals (etapa);

-- ---------- Clientes & Bots ----------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rubro text,
  plan text not null default 'cotizador'
    check (plan in ('esencial','cotizador','pro')),
  mensualidad int not null default 0,
  telefono_bot text,
  workflow_id text,          -- id del workflow n8n del bot de este cliente
  activo boolean not null default true,
  fecha_inicio date,
  created_at timestamptz not null default now()
);

create table if not exists bot_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  tipo text not null check (tipo in ('mensaje','error','heartbeat')),
  detalle text,
  costo_clp numeric,
  created_at timestamptz not null default now()
);

create index if not exists bot_events_client_idx on bot_events (client_id, created_at desc);
create index if not exists bot_events_tipo_idx on bot_events (tipo, created_at desc);

-- ---------- Brief diario ----------
create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  contenido text not null,
  created_at timestamptz not null default now()
);

-- ---------- updated_at automático ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end
$$ language plpgsql;

drop trigger if exists prospects_updated_at on prospects;
create trigger prospects_updated_at
  before update on prospects
  for each row execute function set_updated_at();

drop trigger if exists deals_updated_at on deals;
create trigger deals_updated_at
  before update on deals
  for each row execute function set_updated_at();

-- ---------- Seguridad ----------
-- RLS activado SIN policies: bloquea el acceso con anon key.
-- El panel usa la service_role key (solo en el servidor), que ignora RLS.
alter table prospects enable row level security;
alter table deals enable row level security;
alter table clients enable row level security;
alter table bot_events enable row level security;
alter table briefs enable row level security;
