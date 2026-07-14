-- ============================================================
-- 010 — Contactos de decisión: prospección ADICIONAL que busca
-- (con IA + Google Search grounding) el nombre/cargo/contacto del
-- ENCARGADO de un área específica dentro de un negocio ya guardado
-- en `prospects` (ej: encargado de marketing de una cadena, no el
-- dueño). NO reemplaza la prospección por rubro+comuna (Places),
-- es un enriquecimiento manual y opcional por prospecto.
--
-- Pensado sobre todo para negocios medianos/grandes con áreas
-- separadas. En pymes chicas el dueño suele SER el contacto y este
-- paso agrega poco — por eso se activa a mano, prospecto por
-- prospecto, nunca en lote automático.
--
-- ADITIVA Y SEGURA: solo CREATE TABLE IF NOT EXISTS. No toca
-- `prospects` ni ninguna tabla existente.
--
-- Ejecutar en: Supabase > SQL Editor > New query > Run.
-- ============================================================

create table if not exists contactos_decision (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  area_objetivo text not null,             -- ver AREAS_OBJETIVO en lib/types.ts
  nombre text,
  cargo text,
  telefono text,
  email text,
  linkedin_url text,
  -- Fuentes que sustentan el dato: [{ "url": "...", "titulo": "..." }, ...].
  -- Si viene vacío, el dato NO tiene respaldo verificable (revisar antes de usar).
  fuentes jsonb not null default '[]',
  confianza text not null default 'baja'
    check (confianza in ('alta', 'media', 'baja')),
  -- El humano confirmó el dato (llamó, revisó LinkedIn, etc.) antes de contactar.
  -- La UI no debe ofrecer envío directo mientras esto sea false.
  verificado boolean not null default false,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contactos_decision_prospect_idx
  on contactos_decision (prospect_id);

drop trigger if exists contactos_decision_updated_at on contactos_decision;
create trigger contactos_decision_updated_at
  before update on contactos_decision
  for each row execute function set_updated_at();

-- Seguridad (mismo criterio del resto: RLS on sin policies, service_role server-only)
alter table contactos_decision enable row level security;
revoke all on contactos_decision from anon, authenticated;
