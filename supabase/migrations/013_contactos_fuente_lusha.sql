-- ============================================================
-- 013 — Contactos de decisión: fuente "lusha" (cuarta fuente).
--
-- Evaluación real (14-jul-2026): Lusha SÍ tiene cobertura para
-- empresas medianas/pymes chilenas (no solo multinacionales) —
-- probado con Simmedical (simmedical.cl, Santiago): 27 contactos
-- reales con nombre completo, cargo y LinkedIn. A diferencia de
-- Apollo, el plan gratuito de Lusha SÍ permite buscar (Prospecting,
-- ~1 crédito por búsqueda) y revelar (Enrich, 1 crédito email /
-- 5 créditos teléfono) — ver lib/lushaAPI.ts.
--
-- Igual que con Apollo: agregamos 'lusha' al check constraint de
-- `fuente` (buscando el nombre real del constraint, que Postgres
-- genera automático) y una columna propia para el id externo de
-- Lusha, necesaria para poder "revelar" un candidato después de
-- encontrarlo gratis.
--
-- Aditiva y segura: no toca filas existentes.
--
-- Ejecutar en: Supabase > SQL Editor > New query > Run.
-- ============================================================

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'contactos_decision'::regclass
    and pg_get_constraintdef(oid) ilike '%fuente%';

  if con_name is not null then
    execute format('alter table contactos_decision drop constraint %I', con_name);
  end if;
end $$;

alter table contactos_decision
  add constraint contactos_decision_fuente_check
  check (fuente in ('ia', 'hunter', 'apollo', 'hunter_ia', 'lusha'));

alter table contactos_decision
  add column if not exists lusha_contact_id text;

create index if not exists idx_contactos_decision_lusha_id
  on contactos_decision (lusha_contact_id)
  where lusha_contact_id is not null;
