-- ============================================================
-- 004 — briefs: soporte para reporte mensual en lenguaje de cliente
-- (uso interno por ahora; no se expone a clientes).
-- ============================================================

alter table briefs add column if not exists tipo text not null default 'diario';
alter table briefs drop constraint if exists briefs_tipo_check;
alter table briefs add constraint briefs_tipo_check
  check (tipo in ('diario', 'mensual_cliente'));

alter table briefs add column if not exists client_id uuid
  references clients(id) on delete set null;

create index if not exists briefs_tipo_idx on briefs (tipo, created_at desc);
