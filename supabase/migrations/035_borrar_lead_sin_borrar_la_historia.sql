-- 035 — Se puede borrar un lead sin borrar el registro de que se le llamó.
--
-- EL PROBLEMA QUE ARREGLA
-- La migración 030 enlazó `actividades.lead_foco_id` con `on delete cascade`.
-- Eso significa que borrar un lead borra también todas las llamadas que se le
-- hicieron — y con ellas, silenciosamente, el denominador de la tasa de
-- conexión. Un mes después nadie sabría por qué los números no cuadran.
--
-- Contradice el motivo por el que existe `actividades`: la migración 020 la
-- diseñó SIN llave foránea a `prospects` y guardando una copia del contacto,
-- con este comentario textual: "Si el prospecto se borra o le cambian el
-- teléfono, la actividad sigue siendo auditable — que es justamente lo que
-- pide la 21.719". Al enlazar leads_foco me salté esa regla.
--
-- Con `on delete set null` la actividad sobrevive al lead. La fila conserva el
-- teléfono, el actor, el resultado y la nota (que trae "EMPRESA · PERSONA"),
-- así que se sigue pudiendo auditar y contar. Lo único que se pierde es el
-- enlace, que es exactamente lo que debe perderse.

begin;

alter table public.actividades
  drop constraint if exists actividades_lead_foco_id_fkey;

alter table public.actividades
  add constraint actividades_lead_foco_id_fkey
  foreign key (lead_foco_id) references public.leads_foco(id) on delete set null;

comment on column public.actividades.lead_foco_id is
  'A qué lead de Foco se refiere. Queda en NULL si el lead se borra: la actividad sobrevive porque es el registro auditable, no un adorno del lead.';

commit;
