-- ============================================================
-- 014 — Contactos de decisión: fuente "hunter_lusha".
--
-- Nuevo modo "Todas las fuentes" (lib/contactoCombinado.ts): corre Hunter
-- y Lusha en paralelo. Cuando ambas bases reales (independientes entre sí)
-- confirman el mismo nombre, se guarda con esta fuente y confianza "alta"
-- SIN pasar por verificación de IA (dos fuentes reales ya alcanzan más
-- confianza que una fuente real + una IA). Si no hay cruce, el resultado
-- cae al mismo camino ya existente (se guarda como "hunter_ia" o "ia").
--
-- "todas" (el valor que se envía al pedir la búsqueda) NUNCA se guarda tal
-- cual en la columna `fuente` — siempre se resuelve a uno de los valores
-- concretos ya soportados (hunter_lusha, hunter_ia, lusha, ia). Por eso
-- solo hace falta agregar 'hunter_lusha' al constraint, no 'todas'.
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
  check (fuente in ('ia', 'hunter', 'apollo', 'hunter_ia', 'lusha', 'hunter_lusha'));
