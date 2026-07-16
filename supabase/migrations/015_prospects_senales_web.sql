-- 015: Scoring v2 — señales de automatización detectadas en la web del
-- prospecto (enriquecimiento.ts) y desglose auditable del score.
-- senales_web:  {visitada, chatbot, reservas, ecommerce, crm, whatsapp_link, potencial}
-- score_detalle: {base: 30, rubro: 20, web_sin_automatizacion: 25, ...}

alter table prospects
  add column if not exists senales_web jsonb,
  add column if not exists score_detalle jsonb;

comment on column prospects.senales_web is
  'Señales de automatización detectadas en la web (lib/enriquecimiento.ts). potencial: alto=gestiona manual (ideal), bajo=ya automatizado.';
comment on column prospects.score_detalle is
  'Desglose por componente del score determinista (lib/scoring.ts v2).';

-- Filtro rápido "solo alto potencial" en el tablero
create index if not exists idx_prospects_potencial
  on prospects ((senales_web->>'potencial'));
