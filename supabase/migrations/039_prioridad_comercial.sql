-- 039 · PRIORIDAD COMERCIAL — el fit manda, la contactabilidad ordena
--
-- POR QUÉ, Marcelo, 4-sep-2026:
-- "CONTACTABILIDAD NO REEMPLAZA EL FIT COMERCIAL. Un lead perfectamente
--  enriquecido sigue siendo un mal lead si esa empresa no tiene sentido
--  comercial para Respondo."
--
-- Hasta esta migración la cola de /foco se ordenaba SOLO por `calidad_rank`
-- (qué tan bueno es el dato) y `alcance` (si el número es móvil). Las dos
-- miden lo mismo: qué tan fácil es que alguien conteste. Ninguna mira si a
-- esa empresa le sirve Respondo.
--
-- El efecto medido de eso: Clínica Alemana (3.000 empleados, mesa central,
-- área de compras, integraciones) salía como "encaje alto" y competía de
-- igual a igual con una clínica de 10 personas donde el dueño contesta su
-- propio WhatsApp. Tomás gastaba la hora en la primera.
--
-- QUÉ GUARDA ESTA MIGRACIÓN
--   oportunidad      0..100  Motor 1 · ¿le sirve Respondo a esta empresa?
--   contacto_pts     0..100  Motor 2 · ¿vamos a hablar con alguien que decide?
--   prioridad        0..100  generada = sqrt(oportunidad × contacto_pts)
--   veredicto                qué hacer con este lead, en castellano
--
-- POR QUÉ MULTIPLICA Y NO PROMEDIA
-- Un promedio deja que un dato excelente compense un fit nulo: 100 de
-- contacto y 20 de fit promedian 60 y el lead sube. La media geométrica de
-- lo mismo da 45, y si cualquiera de los dos es 0 el resultado es 0. Es la
-- forma aritmética de la regla de arriba: sin fit no hay prioridad, por
-- muy bueno que sea el teléfono.
--
-- POR QUÉ `prioridad` ES COLUMNA GENERADA
-- Porque ordena la cola. Si fuera una columna común, cualquier ruta que
-- escriba `oportunidad` y olvide recalcular `prioridad` deja la pantalla
-- ordenada con datos viejos, y eso no se nota mirando: se nota cuando el
-- vendedor perdió la mañana. La fórmula queda duplicada (acá y en
-- `prioridadComercial` de lib/contactabilidad.ts) y por eso hay una prueba
-- de paridad, igual que con `alcance` en la 036.
--
-- NULL NO ES CERO
-- Un lead sin enriquecer no es un lead malo: es un lead desconocido. Por eso
-- `prioridad` queda NULL mientras falte cualquiera de los dos motores, y la
-- app los ordena con NULLS LAST en vez de hundirlos con un 0 mentiroso.

alter table leads_foco
  add column if not exists oportunidad smallint,
  add column if not exists oportunidad_nivel text,
  add column if not exists contacto_pts smallint,
  add column if not exists veredicto text,
  add column if not exists porque jsonb;

-- Rangos: si algo escribe 250 o -3, es un bug y quiero que reviente acá y no
-- que se propague silenciosamente al orden de la cola.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_foco_oportunidad_rango') then
    alter table leads_foco add constraint leads_foco_oportunidad_rango
      check (oportunidad is null or (oportunidad between 0 and 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_foco_contacto_pts_rango') then
    alter table leads_foco add constraint leads_foco_contacto_pts_rango
      check (contacto_pts is null or (contacto_pts between 0 and 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_foco_oportunidad_nivel_ok') then
    alter table leads_foco add constraint leads_foco_oportunidad_nivel_ok
      check (oportunidad_nivel is null or oportunidad_nivel in
        ('alta','media','baja','no_ahora','sin_evaluar'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_foco_veredicto_ok') then
    alter table leads_foco add constraint leads_foco_veredicto_ok
      check (veredicto is null or veredicto in
        ('llamar_ahora','llamar_despues','investigar','no_ahora'));
  end if;
end $$;

alter table leads_foco
  add column if not exists prioridad smallint generated always as (
    case
      when oportunidad is null or contacto_pts is null then null
      else round(sqrt(oportunidad::numeric * contacto_pts::numeric))::smallint
    end
  ) stored;

-- El índice de la cola nueva. `nulls last` va explícito porque en Postgres
-- el default de DESC es NULLS FIRST, que es justo lo contrario de lo que se
-- quiere: pondría arriba a los que todavía no se han evaluado.
create index if not exists leads_foco_prioridad_idx
  on leads_foco (prioridad desc nulls last, intentos, n_empleados desc nulls last);

-- Para la pantalla "qué hay para llamar hoy".
create index if not exists leads_foco_veredicto_idx
  on leads_foco (veredicto, prioridad desc nulls last);

comment on column leads_foco.oportunidad is
  'Motor 1 (0-100): qué tan bien le calza Respondo a esta empresa. lib/oportunidad.ts';
comment on column leads_foco.contacto_pts is
  'Motor 2 (0-100): confianza x alcance x cercanía al decisor. lib/contactabilidad.ts';
comment on column leads_foco.prioridad is
  'Media geométrica de los dos motores. Ordena /foco. Sin fit no hay prioridad.';
comment on column leads_foco.veredicto is
  'llamar_ahora | llamar_despues | investigar | no_ahora. El sistema puede decir que no vale la pena.';

-- ── EL ORDEN DE LA PANTALLA NO ES SOLO `prioridad` ────────────────────────
--
-- Esto salió de probar la migración contra datos reales, y es un error que
-- habría llegado a la pantalla:
--
--   empresa                   oport  contacto  prioridad
--   Fit perfecto sin datos       95         0          0
--   Clínica Alemana              31        17         23
--
-- Ordenando solo por `prioridad`, una empresa que calza perfecto pero a la
-- que todavía no le encontramos teléfono queda POR DEBAJO de una que ya
-- decidimos no llamar. Es exactamente al revés: a la primera hay que
-- buscarle el número; la segunda no se toca.
--
-- La prioridad sigue siendo la media geométrica —eso no se toca, es la regla
-- de que sin fit no hay prioridad—. Lo que se agrega es que primero manda el
-- VEREDICTO (qué hay que hacer con este lead) y la prioridad ordena dentro
-- de cada grupo.
--
-- `sin evaluar` va sobre `no_ahora` a propósito: un lead que nadie ha mirado
-- todavía puede ser el mejor de la lista, y hundirlo bajo los descartados es
-- la forma de no encontrarlo nunca. Su tarea no es "llamar", es "enriquecer".

alter table leads_foco
  add column if not exists veredicto_rank smallint generated always as (
    case veredicto
      when 'llamar_ahora'   then 5
      when 'llamar_despues' then 4
      when 'investigar'     then 3
      when 'no_ahora'       then 1
      else 2                      -- sin evaluar: desconocido, no descartado
    end
  ) stored;

create index if not exists leads_foco_cola_comercial_idx
  on leads_foco (veredicto_rank desc, prioridad desc nulls last, intentos);

comment on column leads_foco.veredicto_rank is
  'Orden de la cola: primero qué hacer (veredicto), después qué tan buena es (prioridad).';

-- ── EL NÚMERO QUE ORDENA DENTRO DE CADA GRUPO ─────────────────────────────
--
-- Esto salió de mirar la pantalla renderizada, no el código.
--
-- Una clínica dental de 6 personas con encaje alto a la que todavía no le
-- encontramos teléfono quedaba con `prioridad` 0 —correcto: no la podemos
-- llamar— y en la lista se leía como un lead que no vale nada. Y peor: TODAS
-- las de su grupo quedaban en 0, o sea empatadas, o sea sin orden. El
-- vendedor que entra a "buscar números" no tenía por dónde empezar.
--
-- Dentro de "investigar" lo que ordena no es la prioridad (que es cero por
-- definición, porque falta el contacto) sino cuánto NOS INTERESA esa empresa.
-- Si hay que gastar media hora buscando un número, que sea el de la que más
-- calza.
--
-- `orden_dentro` es eso: el número que ordena a este lead dentro de su grupo.
-- Es también el que se muestra en la lista, para que el número que se ve sea
-- el mismo que explica el orden que se ve.
alter table leads_foco
  add column if not exists orden_dentro smallint generated always as (
    case
      when veredicto = 'investigar' then oportunidad
      when oportunidad is null or contacto_pts is null then null
      else round(sqrt(oportunidad::numeric * contacto_pts::numeric))::smallint
    end
  ) stored;

drop index if exists leads_foco_cola_comercial_idx;
create index if not exists leads_foco_cola_comercial_idx
  on leads_foco (veredicto_rank desc, orden_dentro desc nulls last, intentos);

comment on column leads_foco.orden_dentro is
  'El número que ordena y que se muestra: prioridad, salvo en "investigar" donde manda el encaje comercial.';
