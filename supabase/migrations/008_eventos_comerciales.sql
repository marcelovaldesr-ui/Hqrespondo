-- ============================================================
-- 008 — Eventos comerciales del bot.
-- Amplía los tipos de evento que n8n puede reportar a
-- /api/hooks/bot-events, para monitorear valor comercial
-- (leads, cotizaciones, agendas, derivaciones) y no solo tráfico.
--
-- Ejecutar en: Supabase > SQL Editor > New query > Run.
-- IMPORTANTE: correr ANTES del deploy que use los tipos nuevos
-- (el código actual sigue funcionando sin esta migración; solo
-- fallarían los inserts de tipos nuevos con un error claro).
-- ============================================================

alter table bot_events drop constraint if exists bot_events_tipo_check;
alter table bot_events add constraint bot_events_tipo_check
  check (tipo in (
    'mensaje',
    'error',
    'heartbeat',
    'lead_captured',
    'quote_generated',
    'meeting_booked',
    'human_handoff'
  ));
