-- 040 · UN TERCER GRUPO DE LLAMADA: "vale el intento"
--
-- POR QUÉ — 4-sep-2026, corrigiendo un arreglo mío de hace dos días.
--
-- En la 039 el veredicto tenía cuatro valores. Después saqué de "investigar"
-- a los leads que SÍ tenían teléfono —decir "falta cómo contactarlo" con el
-- número impreso al lado era un error— y los mandé a todos a "llamar
-- después". Eso arregló la etiqueta y rompió el grupo.
--
-- Medido sobre la tanda real de 84 leads: "llamar después" quedó con 19 de
-- los 40 con detalle, con prioridades entre 24 y 52. En la misma bolsa
-- estaban la clínica de Temuco —teléfono publicado, nombre del director, 52—
-- y un número de Apollo sin verificar de una empresa sin sitio, en 24. No son
-- la misma tarea.
--
-- `probar` dice lo que de verdad es: buen encaje, número que nadie confirmó,
-- dos minutos. Vale hacerla porque no hay otro camino a esa empresa, pero
-- después de las que sí tienen evidencia. Y en un día corto se puede parar
-- antes de este grupo sin dejar trabajo bueno sin hacer.

alter table leads_foco drop constraint if exists leads_foco_veredicto_ok;
alter table leads_foco add constraint leads_foco_veredicto_ok
  check (veredicto is null or veredicto in
    ('llamar_ahora','llamar_despues','probar','investigar','no_ahora'));

-- El rango se recalcula: hay que soltar lo que depende de la columna generada
-- antes de reemplazarla.
drop index if exists leads_foco_cola_comercial_idx;
alter table leads_foco drop column if exists veredicto_rank;

alter table leads_foco
  add column veredicto_rank smallint generated always as (
    case veredicto
      when 'llamar_ahora'   then 6
      when 'llamar_despues' then 5
      when 'probar'         then 4
      when 'investigar'     then 3
      when 'no_ahora'       then 1
      else 2                      -- sin evaluar: desconocido, no descartado
    end
  ) stored;

create index if not exists leads_foco_cola_comercial_idx
  on leads_foco (veredicto_rank desc, orden_dentro desc nulls last, intentos);

comment on column leads_foco.veredicto_rank is
  'Orden de la cola: primero qué hacer (veredicto), después qué tan buena es (orden_dentro).';

-- Los leads que ya estaban guardados como "llamar_despues" con prioridad baja
-- pertenecen al grupo nuevo. Se reclasifican acá para no tener que volver a
-- enriquecer 84 leads solo por un cambio de etiqueta.
update leads_foco
   set veredicto = 'probar'
 where veredicto = 'llamar_despues'
   and prioridad is not null
   and prioridad < 35;
