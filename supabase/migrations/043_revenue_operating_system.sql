-- ============================================================================
-- 043 · REVENUE OPERATING SYSTEM V1 — RESPONDO HQ
--
-- Transforma Respondo HQ en el Revenue Operating System unificado:
--   PROSPECCIÓN → RESEARCH → CONTACTO → REUNIÓN → DISCOVERY →
--   DEMO → PILOTO → PROPUESTA → FOLLOW-UP → CIERRE → ONBOARDING → APRENDIZAJE
--
-- Principios de Integridad & Remediación de Producción:
-- 1. Preserva 100% de los datos históricos (prospects, leads_foco, deals, outbound_*).
-- 2. Regla de Oro Comercial: Ninguna oportunidad activa sin next_action y next_action_at.
-- 3. Invariantes de Estado Cerrado:
--    - Si etapa = 'perdido', lost_reason ES OBLIGATORIO.
--    - Si etapa != 'perdido', lost_reason DEBE SER NULL.
--    - Si etapa in ('ganado', 'perdido'), stalled DEBE SER FALSE.
-- 4. Scoring Cuantitativo Persistente:
--    - fit_score (0..100), intent_score (0..100), priority_score (0..100).
-- 5. Invariantes Numéricas y Temporales:
--    - Montos de dinero >= 0 (no dinero negativo).
--    - Conteos y frecuencias >= 0.
--    - Scores de satisfacción Vera entre 1.0 y 5.0.
--    - Scores de interés de reunión entre 1 y 5.
--    - Fechas de fin/decisión >= fechas de inicio/revisión.
-- 6. Seguridad Fail-Closed & RLS:
--    - RLS activado en todas las tablas sin políticas públicas (deny-all directo).
--    - Acceso exclusivo mediante service_role en Server Components / Server Actions de Next.js.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. EXPERIMENTOS COMERCIALES (hq_experiments)
-- ---------------------------------------------------------------------------
create table if not exists public.hq_experiments (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  hipotesis           text not null,
  canal               text not null check (canal in ('cold_call','cold_email','warm_outreach','multichannel','referral')),
  segmento_icp        text not null,
  hook_probado        text not null,
  oferta_probada      text not null,
  fecha_inicio        date not null default current_date,
  fecha_fin           date,
  tamano_muestra      int not null default 0 check (tamano_muestra >= 0),
  metrica_primaria    text not null,
  resultado_resumen   text,
  aprendizaje         text,
  decision            text check (decision in ('validado','descartado','iterar','en_curso')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint hq_experiments_fechas_check check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index if not exists hq_experiments_canal_idx on public.hq_experiments (canal);
create index if not exists hq_experiments_decision_idx on public.hq_experiments (decision);

-- ---------------------------------------------------------------------------
-- 2. OPORTUNIDADES / TRATOS COMERCIALES V2 (hq_deals)
-- ---------------------------------------------------------------------------
create table if not exists public.hq_deals (
  id                  uuid primary key default gen_random_uuid(),
  company_name        text not null check (length(trim(company_name)) > 0),
  contact_name        text not null default '',
  contact_role        text not null default '',
  contact_phone       text not null default '',
  contact_email       text not null default '',
  contact_whatsapp    text not null default '',
  industry            text not null default 'general',
  city                text not null default 'Santiago',

  -- Etapas comerciales completas
  etapa               text not null default 'nuevo'
                      check (etapa in (
                        'nuevo',
                        'contactando',
                        'reunion_agendada',
                        'discovery_completado',
                        'calificado',
                        'piloto_propuesto',
                        'piloto_activo',
                        'propuesta_enviada',
                        'en_decision',
                        'ganado',
                        'nurture',
                        'perdido'
                      )),

  -- Modelo comercial (precios netos)
  plan                text not null default 'inicial'
                      check (plan in ('tino_solo','inicial','crecimiento','empresa')),
  valor_mensual_neto  int not null default 149990 check (valor_mensual_neto >= 0),
  valor_setup_neto    int not null default 0 check (valor_setup_neto >= 0),

  -- Diagnóstico comercial y dolor
  pain_primary        text not null default '',
  use_case            text not null default '',
  competidor          text not null default '',

  -- Núcleo Operativo: Next Action Mandatorio
  next_action         text not null default 'Revisar datos y primer contacto',
  next_action_at      timestamptz not null default (now() + interval '1 day'),
  next_action_owner   text not null default 'Fundador',

  -- Control de Estancamiento
  stalled             boolean not null default false,
  stalled_reason      text,

  -- Scoring Cuantitativo Integrado
  fit_score           int not null default 0 check (fit_score between 0 and 100),
  intent_score        int not null default 0 check (intent_score between 0 and 100),
  priority_score      int not null default 0 check (priority_score between 0 and 100),

  -- Resolución de Trato
  lost_reason         text check (lost_reason in (
                        'no_pain',
                        'no_urgency',
                        'no_budget',
                        'no_decision',
                        'product_gap',
                        'implementation_friction',
                        'trust',
                        'competitor',
                        'timing',
                        'no_response',
                        'other'
                      )),
  lost_notes          text,
  won_notes           text,

  -- Vinculación de experimentos y legado
  experiment_id       uuid references public.hq_experiments(id) on delete set null,
  prospect_id         uuid references public.prospects(id) on delete set null,
  lead_foco_id        uuid references public.leads_foco(id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Invariantes de Estado Cerrado y Next Action
  constraint hq_deals_closed_lost_check check (
    (etapa = 'perdido' and lost_reason is not null) or
    (etapa != 'perdido' and lost_reason is null)
  ),
  constraint hq_deals_closed_not_stalled check (
    (etapa in ('ganado','perdido') and stalled = false) or
    (etapa not in ('ganado','perdido'))
  ),
  constraint hq_deals_active_next_action check (
    etapa in ('ganado','perdido') or
    (length(trim(next_action)) > 0 and next_action_at is not null)
  )
);

create index if not exists hq_deals_etapa_idx on public.hq_deals (etapa);
create index if not exists hq_deals_stalled_idx on public.hq_deals (stalled) where etapa not in ('ganado','perdido');
create index if not exists hq_deals_next_action_idx on public.hq_deals (next_action_at) where etapa not in ('ganado','perdido');
create index if not exists hq_deals_priority_idx on public.hq_deals (priority_score desc);
create index if not exists hq_deals_company_idx on public.hq_deals (company_name);

-- ---------------------------------------------------------------------------
-- 3. REUNIONES Y DISCOVERY (hq_meetings)
-- ---------------------------------------------------------------------------
create table if not exists public.hq_meetings (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid not null references public.hq_deals(id) on delete cascade,
  company_name        text not null,
  contact_name        text not null default '',
  scheduled_at        timestamptz not null,
  status              text not null default 'agendada'
                      check (status in ('agendada','completada','no_show','cancelada','reprogramada')),
  meeting_type        text not null default 'discovery'
                      check (meeting_type in ('discovery','demo','pilot_review','proposal_review','decision')),
  interest_score      int check (interest_score is null or (interest_score between 1 and 5)),

  -- Ficha de Captura Rápida de Discovery (≤2 minutos)
  pain_diagnosticado  text not null default '',
  volumen_mensual     int not null default 0 check (volumen_mensual >= 0),
  proceso_actual      text not null default '',
  herramientas_actuales text not null default '',
  urgencia            text not null default 'media' check (urgencia in ('alta','media','baja')),
  decisor_involucrado boolean not null default false,
  proceso_decision    text not null default '',
  objeciones          text not null default '',
  demo_mostrada       text not null default '',

  -- Cierre con compromiso firme
  siguiente_paso      text not null default '',
  siguiente_paso_at   timestamptz,

  notas               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists hq_meetings_deal_idx on public.hq_meetings (deal_id);
create index if not exists hq_meetings_scheduled_idx on public.hq_meetings (scheduled_at desc);

-- ---------------------------------------------------------------------------
-- 4. PILOTOS DE 14 DÍAS — SUCCESS PLAN (hq_pilots)
-- ---------------------------------------------------------------------------
create table if not exists public.hq_pilots (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid not null references public.hq_deals(id) on delete cascade,
  company_name        text not null,
  status              text not null default 'propuesto'
                      check (status in (
                        'propuesto',
                        'programado',
                        'configuracion',
                        'activo',
                        'revision_pendiente',
                        'exitoso',
                        'no_concluyente',
                        'fallido',
                        'cancelado'
                      )),

  -- Tiempos del Piloto (14 días corridos)
  start_date          date,
  end_date            date,
  review_date         date,

  -- Piloto Success Plan (RS-Shop standard)
  hipotesis           text not null default '',
  metricas_base       text not null default '',
  resuelve_vs_deriva  jsonb not null default '{}'::jsonb,
  kpi_primario        text not null default 'Tasa de respuesta inmediata en horario no hábil',
  kpis_secundarios    text not null default 'Cotizaciones rescatadas y horas de taller agendadas',
  meta_kpi            text not null default '',
  criterio_exito      text not null default '',
  decision_si_exito   text not null default 'Contratación formal Plan Inicial/Crecimiento',

  -- Métricas operativas del Día 14
  tiempo_respuesta_promedio_seg int check (tiempo_respuesta_promedio_seg is null or tiempo_respuesta_promedio_seg >= 0),
  casos_totales_atendidos       int not null default 0 check (casos_totales_atendidos >= 0),
  casos_derivados_humano        int not null default 0 check (casos_derivados_humano >= 0),
  seguimientos_beto_enviados    int not null default 0 check (seguimientos_beto_enviados >= 0),
  seguimientos_beto_respuestas  int not null default 0 check (seguimientos_beto_respuestas >= 0),
  satisfaccion_vera_promedio    numeric(3,1) check (satisfaccion_vera_promedio is null or (satisfaccion_vera_promedio >= 1.0 and satisfaccion_vera_promedio <= 5.0)),

  resultado_dia_14    text,
  resultado_notas     text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint hq_pilots_fechas_check check (start_date is null or end_date is null or end_date >= start_date)
);

create index if not exists hq_pilots_deal_idx on public.hq_pilots (deal_id);
create index if not exists hq_pilots_status_idx on public.hq_pilots (status);
create index if not exists hq_pilots_review_date_idx on public.hq_pilots (review_date);

-- ---------------------------------------------------------------------------
-- 5. PROPUESTAS Y CONTROL DE CIERRE (hq_proposals)
-- ---------------------------------------------------------------------------
create table if not exists public.hq_proposals (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid not null references public.hq_deals(id) on delete cascade,
  company_name        text not null,
  version             int not null default 1 check (version >= 1),
  plan                text not null default 'inicial' check (plan in ('tino_solo','inicial','crecimiento','empresa')),
  valor_mensual_neto  int not null default 149990 check (valor_mensual_neto >= 0),
  valor_setup_neto    int not null default 0 check (valor_setup_neto >= 0),
  condiciones_prueba  text not null default '14 días de prueba gratis. Sin contrato de permanencia.',
  alcance_resumen     text not null default 'Tino, Beto y Vera con portal completo y hasta 1.200 conversaciones.',

  -- Fechas de trazabilidad y cierre
  sent_at             timestamptz not null default now(),
  review_date         date,
  decision_date       date,

  status              text not null default 'enviada'
                      check (status in ('borrador','enviada','en_revision','cambios_solicitados','aceptada','rechazada','sin_decision')),

  notas               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint hq_proposals_fechas_check check (review_date is null or decision_date is null or decision_date >= review_date)
);

create index if not exists hq_proposals_deal_idx on public.hq_proposals (deal_id);
create index if not exists hq_proposals_status_idx on public.hq_proposals (status);
create index if not exists hq_proposals_decision_date_idx on public.hq_proposals (decision_date);

-- ---------------------------------------------------------------------------
-- 6. RETROALIMENTACIÓN DE PRODUCTO Y MERCADO (hq_feedback)
-- ---------------------------------------------------------------------------
create table if not exists public.hq_feedback (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid references public.hq_deals(id) on delete set null,
  company_name        text not null,
  categoria           text not null check (categoria in (
                        'objecion',
                        'bug',
                        'competidor',
                        'integracion_solicitada',
                        'precio_reaccion',
                        'friccion_implementacion',
                        'gap_producto',
                        'elogio'
                      )),
  competidor_mencionado text,
  detalle             text not null,
  frecuencia          int not null default 1 check (frecuencia >= 1),
  created_at          timestamptz not null default now()
);

create index if not exists hq_feedback_cat_idx on public.hq_feedback (categoria);
create index if not exists hq_feedback_comp_idx on public.hq_feedback (competidor_mencionado);

-- ---------------------------------------------------------------------------
-- 7. TIMELINE UNIFICADO DE ACTIVIDADES (hq_activities)
-- ---------------------------------------------------------------------------
create table if not exists public.hq_activities (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid not null references public.hq_deals(id) on delete cascade,
  company_name        text not null,
  tipo                text not null check (tipo in (
                        'llamada',
                        'email',
                        'reunion',
                        'piloto',
                        'propuesta',
                        'cambio_etapa',
                        'nota',
                        'tarea'
                      )),
  resultado           text check (resultado in (
                        'no_contesta',
                        'conectado',
                        'gatekeeper',
                        'contacto_incorrecto',
                        'volver_a_llamar',
                        'interesado',
                        'reunion_agendada',
                        'no_interesado',
                        'nurture',
                        'invalido'
                      )),
  detalle             text not null,
  proxima_accion      text,
  proxima_accion_at   timestamptz,
  creado_por          text not null default 'Fundador',
  created_at          timestamptz not null default now()
);

create index if not exists hq_activities_deal_idx on public.hq_activities (deal_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 8. TRIGGERS UPDATED_AT
-- ---------------------------------------------------------------------------
drop trigger if exists hq_deals_updated_at on public.hq_deals;
create trigger hq_deals_updated_at
  before update on public.hq_deals
  for each row execute function set_updated_at();

drop trigger if exists hq_meetings_updated_at on public.hq_meetings;
create trigger hq_meetings_updated_at
  before update on public.hq_meetings
  for each row execute function set_updated_at();

drop trigger if exists hq_pilots_updated_at on public.hq_pilots;
create trigger hq_pilots_updated_at
  before update on public.hq_pilots
  for each row execute function set_updated_at();

drop trigger if exists hq_proposals_updated_at on public.hq_proposals;
create trigger hq_proposals_updated_at
  before update on public.hq_proposals
  for each row execute function set_updated_at();

drop trigger if exists hq_experiments_updated_at on public.hq_experiments;
create trigger hq_experiments_updated_at
  before update on public.hq_experiments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. SEGURIDAD Y RLS (FAIL-CLOSED)
--
-- NOTA ARQUITECTURAL:
-- Toda la interacción con Revenue OS V1 se realiza exclusivamente desde el backend
-- de Next.js utilizando el cliente de servidor `service_role` (que realiza bypass de RLS).
-- Habilitar RLS en estas tablas SIN crear políticas públicas garantiza que NINGÚN cliente
-- anónimo o autenticado vía browser pueda consultar o mutar estas tablas directamente (deny-all).
-- ---------------------------------------------------------------------------
alter table public.hq_experiments enable row level security;
alter table public.hq_deals       enable row level security;
alter table public.hq_meetings    enable row level security;
alter table public.hq_pilots      enable row level security;
alter table public.hq_proposals   enable row level security;
alter table public.hq_feedback    enable row level security;
alter table public.hq_activities  enable row level security;

-- ---------------------------------------------------------------------------
-- 10. RPCs TRANSACCIONALES ATÓMICAS (CHILD + DEAL TRANSITION)
-- ---------------------------------------------------------------------------

-- Helper canónico para validación de transiciones de etapa de Deals
-- Representa exactamente la misma matriz de negocio canónica de TRANSICIONES_VALIDAS
create or replace function public.hq_transicion_valida(
  p_etapa_actual text,
  p_etapa_destino text
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_etapa_actual is null or p_etapa_destino is null then
    return false;
  end if;

  if p_etapa_actual = p_etapa_destino then
    return true;
  end if;

  case p_etapa_actual
    when 'nuevo' then
      return p_etapa_destino in ('contactando', 'reunion_agendada', 'perdido', 'nurture');
    when 'contactando' then
      return p_etapa_destino in ('reunion_agendada', 'perdido', 'nurture');
    when 'reunion_agendada' then
      return p_etapa_destino in ('discovery_completado', 'piloto_propuesto', 'piloto_activo', 'propuesta_enviada', 'perdido', 'nurture');
    when 'discovery_completado' then
      return p_etapa_destino in ('calificado', 'piloto_propuesto', 'piloto_activo', 'propuesta_enviada', 'perdido', 'nurture');
    when 'calificado' then
      return p_etapa_destino in ('piloto_propuesto', 'piloto_activo', 'propuesta_enviada', 'perdido', 'nurture');
    when 'piloto_propuesto' then
      return p_etapa_destino in ('piloto_activo', 'propuesta_enviada', 'perdido', 'nurture');
    when 'piloto_activo' then
      return p_etapa_destino in ('propuesta_enviada', 'en_decision', 'ganado', 'perdido', 'nurture');
    when 'propuesta_enviada' then
      return p_etapa_destino in ('en_decision', 'ganado', 'perdido', 'nurture');
    when 'en_decision' then
      return p_etapa_destino in ('ganado', 'perdido', 'nurture');
    when 'ganado' then
      return p_etapa_destino in ('nurture');
    when 'nurture' then
      return p_etapa_destino in ('contactando', 'reunion_agendada', 'perdido');
    when 'perdido' then
      return p_etapa_destino in ('nurture');
    else
      return false;
  end case;
end;
$$;

create or replace function public.create_meeting_with_stage_transition(
  p_meeting jsonb,
  p_deal_updates jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_deal_id uuid;
  v_current_deal record;
  v_new_meeting record;
  v_updated_deal record;
  v_target_stage text;
begin
  if p_meeting ? 'id' then
    raise exception 'MASS_ASSIGNMENT_ERROR: No se permite proporcionar id';
  end if;

  v_deal_id := (p_meeting->>'deal_id')::uuid;

  select * into v_current_deal from public.hq_deals where id = v_deal_id for update;
  if not found then
    raise exception 'FOREIGN_KEY_ERROR: Deal con id % no existe', v_deal_id;
  end if;

  if p_deal_updates is not null and p_deal_updates ? 'etapa' then
    v_target_stage := p_deal_updates->>'etapa';
    if not public.hq_transicion_valida(v_current_deal.etapa, v_target_stage) then
      raise exception 'TRANSITION_ERROR: Transición no permitida desde etapa ''%'' hacia ''%''.', v_current_deal.etapa, v_target_stage;
    end if;
  end if;

  insert into public.hq_meetings (
    deal_id, company_name, contact_name, scheduled_at, status,
    meeting_type, interest_score, pain_diagnosticado, volumen_mensual,
    proceso_actual, herramientas_actuales, urgencia, decisor_involucrado,
    proceso_decision, objeciones, demo_mostrada, siguiente_paso, siguiente_paso_at, notas
  ) values (
    v_deal_id,
    p_meeting->>'company_name',
    coalesce(p_meeting->>'contact_name', ''),
    (p_meeting->>'scheduled_at')::timestamptz,
    coalesce(p_meeting->>'status', 'agendada'),
    coalesce(p_meeting->>'meeting_type', 'discovery'),
    (p_meeting->>'interest_score')::int,
    coalesce(p_meeting->>'pain_diagnosticado', ''),
    coalesce((p_meeting->>'volumen_mensual')::int, 0),
    coalesce(p_meeting->>'proceso_actual', ''),
    coalesce(p_meeting->>'herramientas_actuales', ''),
    coalesce(p_meeting->>'urgencia', 'media'),
    coalesce((p_meeting->>'decisor_involucrado')::boolean, false),
    coalesce(p_meeting->>'proceso_decision', ''),
    coalesce(p_meeting->>'objeciones', ''),
    coalesce(p_meeting->>'demo_mostrada', ''),
    coalesce(p_meeting->>'siguiente_paso', ''),
    (p_meeting->>'siguiente_paso_at')::timestamptz,
    coalesce(p_meeting->>'notas', '')
  ) returning * into v_new_meeting;

  if p_deal_updates is not null and jsonb_typeof(p_deal_updates) = 'object' then
    update public.hq_deals
    set
      etapa = coalesce(p_deal_updates->>'etapa', etapa),
      next_action = coalesce(p_deal_updates->>'next_action', next_action),
      next_action_at = coalesce((p_deal_updates->>'next_action_at')::timestamptz, next_action_at),
      updated_at = now()
    where id = v_deal_id
    returning * into v_updated_deal;
  else
    select * into v_updated_deal from public.hq_deals where id = v_deal_id;
  end if;

  return jsonb_build_object(
    'meeting', to_jsonb(v_new_meeting),
    'deal', to_jsonb(v_updated_deal)
  );
end;
$$;

create or replace function public.create_pilot_with_stage_transition(
  p_pilot jsonb,
  p_deal_updates jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_deal_id uuid;
  v_current_deal record;
  v_new_pilot record;
  v_updated_deal record;
  v_target_stage text;
begin
  if p_pilot ? 'id' then
    raise exception 'MASS_ASSIGNMENT_ERROR: No se permite proporcionar id';
  end if;

  v_deal_id := (p_pilot->>'deal_id')::uuid;

  select * into v_current_deal from public.hq_deals where id = v_deal_id for update;
  if not found then
    raise exception 'FOREIGN_KEY_ERROR: Deal con id % no existe', v_deal_id;
  end if;

  if p_deal_updates is not null and p_deal_updates ? 'etapa' then
    v_target_stage := p_deal_updates->>'etapa';
    if not public.hq_transicion_valida(v_current_deal.etapa, v_target_stage) then
      raise exception 'TRANSITION_ERROR: Transición no permitida desde etapa ''%'' hacia ''%''.', v_current_deal.etapa, v_target_stage;
    end if;
  end if;

  insert into public.hq_pilots (
    deal_id, company_name, status, start_date, end_date, review_date,
    hipotesis, metricas_base, resuelve_vs_deriva, kpi_primario, kpis_secundarios,
    meta_kpi, criterio_exito, decision_si_exito, casos_totales_atendidos,
    casos_derivados_humano, seguimientos_beto_enviados, seguimientos_beto_respuestas,
    resultado_dia_14, resultado_notas
  ) values (
    v_deal_id,
    p_pilot->>'company_name',
    coalesce(p_pilot->>'status', 'propuesto'),
    (p_pilot->>'start_date')::date,
    (p_pilot->>'end_date')::date,
    (p_pilot->>'review_date')::date,
    coalesce(p_pilot->>'hipotesis', ''),
    coalesce(p_pilot->>'metricas_base', ''),
    coalesce(p_pilot->'resuelve_vs_deriva', '{}'::jsonb),
    coalesce(p_pilot->>'kpi_primario', ''),
    coalesce(p_pilot->>'kpis_secundarios', ''),
    coalesce(p_pilot->>'meta_kpi', ''),
    coalesce(p_pilot->>'criterio_exito', ''),
    coalesce(p_pilot->>'decision_si_exito', ''),
    coalesce((p_pilot->>'casos_totales_atendidos')::int, 0),
    coalesce((p_pilot->>'casos_derivados_humano')::int, 0),
    coalesce((p_pilot->>'seguimientos_beto_enviados')::int, 0),
    coalesce((p_pilot->>'seguimientos_beto_respuestas')::int, 0),
    p_pilot->>'resultado_dia_14',
    p_pilot->>'resultado_notas'
  ) returning * into v_new_pilot;

  if p_deal_updates is not null and jsonb_typeof(p_deal_updates) = 'object' then
    update public.hq_deals
    set
      etapa = coalesce(p_deal_updates->>'etapa', etapa),
      next_action = coalesce(p_deal_updates->>'next_action', next_action),
      next_action_at = coalesce((p_deal_updates->>'next_action_at')::timestamptz, next_action_at),
      updated_at = now()
    where id = v_deal_id
    returning * into v_updated_deal;
  else
    select * into v_updated_deal from public.hq_deals where id = v_deal_id;
  end if;

  return jsonb_build_object(
    'pilot', to_jsonb(v_new_pilot),
    'deal', to_jsonb(v_updated_deal)
  );
end;
$$;

create or replace function public.create_proposal_with_stage_transition(
  p_proposal jsonb,
  p_deal_updates jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_deal_id uuid;
  v_current_deal record;
  v_new_proposal record;
  v_updated_deal record;
  v_target_stage text;
begin
  if p_proposal ? 'id' then
    raise exception 'MASS_ASSIGNMENT_ERROR: No se permite proporcionar id';
  end if;

  v_deal_id := (p_proposal->>'deal_id')::uuid;

  select * into v_current_deal from public.hq_deals where id = v_deal_id for update;
  if not found then
    raise exception 'FOREIGN_KEY_ERROR: Deal con id % no existe', v_deal_id;
  end if;

  if p_deal_updates is not null and p_deal_updates ? 'etapa' then
    v_target_stage := p_deal_updates->>'etapa';
    if not public.hq_transicion_valida(v_current_deal.etapa, v_target_stage) then
      raise exception 'TRANSITION_ERROR: Transición no permitida desde etapa ''%'' hacia ''%''.', v_current_deal.etapa, v_target_stage;
    end if;
  end if;

  insert into public.hq_proposals (
    deal_id, company_name, version, plan, valor_mensual_neto,
    valor_setup_neto, condiciones_prueba, alcance_resumen, sent_at,
    review_date, decision_date, status, notas
  ) values (
    v_deal_id,
    p_proposal->>'company_name',
    coalesce((p_proposal->>'version')::int, 1),
    coalesce(p_proposal->>'plan', 'inicial'),
    coalesce((p_proposal->>'valor_mensual_neto')::int, 0),
    coalesce((p_proposal->>'valor_setup_neto')::int, 0),
    coalesce(p_proposal->>'condiciones_prueba', ''),
    coalesce(p_proposal->>'alcance_resumen', ''),
    coalesce((p_proposal->>'sent_at')::timestamptz, now()),
    (p_proposal->>'review_date')::timestamptz,
    (p_proposal->>'decision_date')::timestamptz,
    coalesce(p_proposal->>'status', 'borrador'),
    coalesce(p_proposal->>'notas', '')
  ) returning * into v_new_proposal;

  if p_deal_updates is not null and jsonb_typeof(p_deal_updates) = 'object' then
    update public.hq_deals
    set
      etapa = coalesce(p_deal_updates->>'etapa', etapa),
      next_action = coalesce(p_deal_updates->>'next_action', next_action),
      next_action_at = coalesce((p_deal_updates->>'next_action_at')::timestamptz, next_action_at),
      plan = coalesce(p_deal_updates->>'plan', plan),
      valor_mensual_neto = coalesce((p_deal_updates->>'valor_mensual_neto')::int, valor_mensual_neto),
      valor_setup_neto = coalesce((p_deal_updates->>'valor_setup_neto')::int, valor_setup_neto),
      updated_at = now()
    where id = v_deal_id
    returning * into v_updated_deal;
  else
    select * into v_updated_deal from public.hq_deals where id = v_deal_id;
  end if;

  return jsonb_build_object(
    'proposal', to_jsonb(v_new_proposal),
    'deal', to_jsonb(v_updated_deal)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. PRIVILEGIOS MÍNIMOS Y SEGURIDAD DE EJECUCIÓN DE RPCs
-- ---------------------------------------------------------------------------
-- Por defecto en PostgreSQL, las funciones creadas son ejecutables por PUBLIC.
-- Revocamos explícitamente todo acceso a roles de navegador (anon, authenticated)
-- y concedemos EXECUTE única y exclusivamente al rol de backend (service_role).

revoke all on function public.hq_transicion_valida(text, text) from public, anon, authenticated;
grant execute on function public.hq_transicion_valida(text, text) to service_role;

revoke all on function public.create_meeting_with_stage_transition(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_meeting_with_stage_transition(jsonb, jsonb) to service_role;

revoke all on function public.create_pilot_with_stage_transition(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_pilot_with_stage_transition(jsonb, jsonb) to service_role;

revoke all on function public.create_proposal_with_stage_transition(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_proposal_with_stage_transition(jsonb, jsonb) to service_role;

commit;
