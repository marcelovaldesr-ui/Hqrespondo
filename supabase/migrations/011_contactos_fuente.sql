-- ============================================================
-- 011 — Contactos de decisión: soporte multi-fuente (migración
-- aditiva sobre 010_contactos_decision.sql).
--
-- Hasta ahora `contactos_decision` solo se llenaba con búsqueda IA
-- (google_search grounding). Esto agrega:
--   - `fuente`: de dónde salió el dato ('ia' | 'hunter' | 'apollo').
--   - `apollo_person_id`: para el flujo de Apollo, que primero busca
--     GRATIS (People Search, sin nombre/contacto) y recién después,
--     a pedido explícito, "revela" el email/teléfono gastando un
--     crédito del plan gratuito. Sin este id no se puede revelar.
--
-- ADITIVA Y SEGURA: solo ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- No borra ni migra datos existentes (quedan con fuente='ia').
--
-- Ejecutar en: Supabase > SQL Editor > New query > Run.
-- ============================================================

alter table contactos_decision
  add column if not exists fuente text not null default 'ia'
    check (fuente in ('ia', 'hunter', 'apollo'));

alter table contactos_decision
  add column if not exists apollo_person_id text;

create index if not exists contactos_decision_fuente_idx
  on contactos_decision (fuente);
