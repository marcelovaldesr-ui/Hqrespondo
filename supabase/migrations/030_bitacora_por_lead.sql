-- 030 — Que la bitácora sepa de qué lead está hablando, y un próximo paso propio.
--
-- La tabla `actividades` (migración 020) ya registra cada toque de Leads Foco:
-- `POST /api/foco` la escribe con el resultado y la nota. Pero la escribe SIN
-- apuntar a cuál lead: solo guarda el teléfono y un texto "EMPRESA · CONTACTO".
-- Eso alcanza para contar toques del día y no alcanza para lo que Marcelo pidió
-- —"llevarle un registro a cada lead, cuántas veces se le llamó, qué dijo"—
-- porque para reconstruir la historia de UN lead habría que buscar por texto.
--
-- Se agrega la referencia que faltaba. No se crea una tabla nueva a propósito:
-- el sentido de `actividades` es que "tasa de conexión" tenga UNA definición y
-- no tres, y un log paralelo rompería justamente eso.
--
-- Y un `proximo_paso` explícito. Hoy eso vive dentro del campo `nota`, mezclado
-- con todo lo demás. Un compromiso enterrado en un párrafo es un compromiso que
-- se pierde: `recordatorio` dice CUÁNDO volver, pero nadie escribió QUÉ hacer.
--
-- Nota sobre lo viejo: las actividades ya registradas quedan sin `lead_foco_id`.
-- No se rellenan porque solo se podría adivinar cruzando el texto de la nota, y
-- un dato adivinado en un registro de auditoría es peor que un dato ausente.
-- La historia por lead empieza a acumularse desde acá.

begin;

alter table public.actividades
  add column if not exists lead_foco_id uuid references public.leads_foco(id) on delete cascade;

create index if not exists actividades_lead_foco_idx
  on public.actividades (lead_foco_id, created_at desc)
  where lead_foco_id is not null;

alter table public.leads_foco
  add column if not exists proximo_paso    text,
  add column if not exists proximo_paso_at timestamptz;

comment on column public.leads_foco.proximo_paso is
  'Qué hay que hacer la próxima vez, en una línea. Distinto de `recordatorio` (cuándo) y de `nota` (qué pasó).';

commit;
