-- 031 — Que cada lead diga quién lo agregó y quién lo tocó por última vez.
--
-- El mecanismo ya existía y funcionaba a medias. El middleware autentica y deja
-- el login en la cabecera `x-hq-user`; `personaDeLogin()` lo traduce al nombre
-- del equipo. Pero solo algunos endpoints lo usaban, otros guardaban el login
-- crudo ("hq_admin" en vez de "Marcelo"), y el alta manual de leads —que escribí
-- yo hace un rato— no guardaba autor ninguno.
--
-- Esta migración cierra el lado de los datos: `leads_foco` pasa a recordar quién
-- creó cada fila y quién la modificó. La bitácora (`actividades`) ya tenía su
-- columna `actor`; lo que faltaba era llenarla siempre.
--
-- Sobre las filas que ya existen: quedan con `creado_por` en NULL y la ficha lo
-- muestra como "origen desconocido". No se rellena inventando: la mayoría entró
-- por importación de CSV antes de que esto existiera, y firmar esas filas con el
-- nombre de alguien sería poner una firma falsa en un registro de auditoría.

begin;

alter table public.leads_foco
  add column if not exists creado_por      text,
  add column if not exists actualizado_por text;

comment on column public.leads_foco.creado_por is
  'Quién agregó este lead: nombre del equipo si entró a mano desde HQ, o el origen automático (importación, agente). NULL = anterior a la migración 031.';

commit;
