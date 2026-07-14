-- ============================================================
-- 012 — Contactos de decisión: fuente "hunter_ia" (modo mixto).
--
-- Combina Hunter.io (dato real) con verificación/enriquecimiento
-- por IA (google_search) — ver lib/contactoMixto.ts. Necesitamos
-- que la columna `fuente` acepte este nuevo valor además de los
-- ya existentes ('ia', 'hunter', 'apollo').
--
-- No asumimos el nombre exacto del constraint (Postgres lo genera
-- automático y puede variar); lo buscamos dinámicamente antes de
-- reemplazarlo. Aditiva y segura: no toca filas existentes.
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
  check (fuente in ('ia', 'hunter', 'apollo', 'hunter_ia'));
