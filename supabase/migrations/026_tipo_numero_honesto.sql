-- 026 — Corrige una suposición mía que no estaba probada.
--
-- La migración 025 marcaba como `movil_dueno` todo teléfono con formato de
-- celular, con el argumento de que "en una clínica de 5 personas ese celular
-- es del dueño". Marcelo lo objetó y tiene razón: basta con que haya una
-- secretaria para que el celular publicado sea el de ella.
--
-- El argumento que lo cierra es el del propio producto: el número que el
-- negocio publica en Google Maps es su línea PÚBLICA de WhatsApp — es
-- exactamente la línea que Respondo viene a atender. Si fuera el celular
-- privado del dueño, Tino no tendría dónde conectarse. Así que por definición
-- es la línea de entrada, no la del dueño.
--
-- El formato del número dice cómo se marca, no de quién es. Lo único que
-- resuelve de quién es, es la llamada: por eso `tipo_numero` pasa a llenarse
-- con lo que reporte quien llamó, no con una regla adivinada.

begin;

-- Ya no se afirma dueño por el formato; se registra el formato aparte.
alter table public.prospects  drop constraint if exists prospects_tipo_numero_check;
alter table public.leads_foco drop constraint if exists leads_foco_tipo_numero_check;

alter table public.prospects
  add constraint prospects_tipo_numero_check
  check (tipo_numero in ('publico','recepcion','directo','movil_personal','desconocido'));
alter table public.leads_foco
  add constraint leads_foco_tipo_numero_check
  check (tipo_numero in ('publico','recepcion','directo','movil_personal','desconocido'));

-- 'publico' = el que el negocio publica para que lo llamen. Es lo único que
-- se puede afirmar sin haber llamado.
update public.prospects
   set tipo_numero = 'publico'
 where telefono is not null and telefono <> ''
   and (tipo_numero is null or tipo_numero in ('desconocido','movil_dueno','recepcion'));

-- Formato del número, que sí es un hecho: sirve para saber si acepta WhatsApp.
alter table public.prospects  add column if not exists numero_es_movil boolean;
alter table public.leads_foco add column if not exists numero_es_movil boolean;

update public.prospects
   set numero_es_movil = (regexp_replace(telefono, '\D', '', 'g') ~ '^(56)?9[0-9]{8}$')
 where telefono is not null and telefono <> '';

commit;
