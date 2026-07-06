-- ============================================================
-- 007 — Operación interna: onboarding de clientes, registro de
-- decisiones, cobros (mensualidades) y gastos.
-- ============================================================

-- Checklist de instalación por cliente
create table if not exists onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  paso text not null,
  orden int not null default 0,
  hecho boolean not null default false,
  hecho_por text,
  hecho_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists onboarding_client_idx on onboarding_tasks (client_id, orden);

-- Registro de decisiones del equipo
create table if not exists decisiones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  detalle text,
  decidido_por text,
  created_at timestamptz not null default now()
);

-- Gastos (dominio, marketing, APIs, etc.)
create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  concepto text not null,
  categoria text,
  monto int not null default 0,          -- CLP
  pagado_por text,                       -- quién lo pagó (marcelo/socio/empresa)
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists gastos_fecha_idx on gastos (fecha desc);

-- Cobros de mensualidades por cliente y mes
create table if not exists cobros (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  mes date not null,                     -- primer día del mes cobrado
  monto int not null default 0,          -- CLP
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado')),
  pagado_at timestamptz,
  notas text,
  created_at timestamptz not null default now(),
  unique (client_id, mes)
);
create index if not exists cobros_mes_idx on cobros (mes desc);

-- Seguridad (mismo criterio del resto)
alter table onboarding_tasks enable row level security;
alter table decisiones enable row level security;
alter table gastos enable row level security;
alter table cobros enable row level security;
revoke all on onboarding_tasks, decisiones, gastos, cobros from anon, authenticated;
