-- ============================================================
-- 005 — roadmap_items: roadmap interno compartido (/roadmap).
-- Reemplaza el uso de Notion. Estado y Área son texto libre
-- a propósito (mismo criterio que el Notion original).
-- ============================================================

create table if not exists roadmap_items (
  id uuid primary key default gen_random_uuid(),
  tarea text not null,
  estado text not null default 'Backlog',   -- ej: Backlog / Esta semana / En curso / Hecho
  area text,                                -- ej: Marca, Instagram, Comercial, Web, Producto, Ventas, Decisión
  fecha_limite date,
  notas text,
  creado_por text,                          -- viene del header x-hq-user (credencial que hizo login)
  actualizado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roadmap_estado_idx on roadmap_items (estado);

drop trigger if exists roadmap_items_updated_at on roadmap_items;
create trigger roadmap_items_updated_at
  before update on roadmap_items
  for each row execute function set_updated_at();

alter table roadmap_items enable row level security;
revoke all on roadmap_items from anon, authenticated;
