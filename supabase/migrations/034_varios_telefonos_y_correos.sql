-- 034 — Un lead puede tener más de un teléfono y más de un correo.
--
-- Apollo suele devolver dos números para la misma persona:
--
--     +56 9 9631 6017   Móvil
--     +56 2 2222 8889   Teléfono corporativo
--
-- Y a veces dos correos. Hasta ahora `leads_foco` tenía una sola columna para
-- cada cosa, así que el segundo dato se perdía en la importación — y el
-- importador, que elige la PRIMERA columna que calce y descarta el resto,
-- garantizaba que se perdiera siempre el mismo.
--
-- POR QUÉ UN ARREGLO JSONB Y NO UNA TABLA APARTE
-- Son dos o tres números por persona, se leen SIEMPRE junto con el lead, y
-- nunca se consultan solos. Una tabla obligaría a un join en cada pantalla de
-- la cola de llamadas a cambio de nada. Además `contactabilidad` es una columna
-- generada que depende de `telefono <> ''`: tocar eso rompería el orden de la
-- cola, la supresión y el filtro "por investigar" de una sola vez.
--
-- Por eso `telefono` y `email` SIGUEN SIENDO los que se trabajan —el primario,
-- el que ordena la cola y el que se marca— y los arreglos guardan todo lo que
-- se sabe. Cambiar de número es promover uno del arreglo al primario.
--
-- Forma de cada elemento:
--   {"valor":"+56 9 9631 6017","tipo":"movil","fuente":"apollo"}
--   tipo: movil | corporativo | otro     (correos: trabajo | personal | otro)
--
-- LO QUE ESTO NO RESUELVE, Y HAY QUE SABERLO
-- El veredicto de la llamada ("contestó el dueño", "contestó la recepción") se
-- guarda a nivel de LEAD, no de número. Si algún día importa saber que el móvil
-- sí contesta y el corporativo no, esto tiene que pasar a ser una tabla. Hoy no
-- hay ni una llamada registrada; construir eso ahora sería adivinar.

begin;

alter table public.leads_foco
  add column if not exists telefonos jsonb not null default '[]'::jsonb,
  add column if not exists emails    jsonb not null default '[]'::jsonb;

comment on column public.leads_foco.telefonos is
  'Todos los teléfonos conocidos, con tipo y fuente. El que se trabaja es `telefono`; esto es el resto.';

-- Los que ya existen: se copia su único dato al arreglo para que la ficha los
-- muestre igual y no queden dos formas distintas de leer lo mismo.
update public.leads_foco
   set telefonos = jsonb_build_array(
         jsonb_build_object('valor', telefono, 'tipo', 'otro', 'fuente', 'previo')
       )
 where telefono is not null and telefono <> '' and telefonos = '[]'::jsonb;

update public.leads_foco
   set emails = jsonb_build_array(
         jsonb_build_object('valor', email, 'tipo', 'otro', 'fuente', 'previo')
       )
 where email is not null and email <> '' and emails = '[]'::jsonb;

commit;
