-- ============================================================================
-- 036 · ALCANCE — ¿este número lo contesta quien decide?
-- ============================================================================
-- POR QUÉ EXISTE — 4-sep-2026
--
-- Tomás hizo una tanda de llamadas y no alcanzó a nadie: número equivocado, o
-- no contestan, o contesta la recepción. Al revisar por qué, el problema no
-- era la falta de datos. Era el ORDEN.
--
-- `contactabilidad` (migración 021) mide si HAY teléfono y si HAY persona.
-- Nunca preguntó QUÉ teléfono. Y en Chile eso lo decide todo:
--
--   · Un CELULAR (9 xxxx xxxx) publicado por un negocio es, casi siempre, el
--     teléfono de quien manda. Es el mismo número con el que atiende clientes
--     por WhatsApp. Contesta él.
--   · Un FIJO (2 xxxx xxxx, 32 xxx xxxx…) es el mesón. Contesta quien está
--     ahí para filtrar llamadas.
--
-- La cascada de enriquecimiento YA sabía esto: cuando guardaba un fijo lo
-- anotaba como "es un FIJO: probablemente la línea de su consulta". Lo decía
-- y nadie lo escuchaba, porque el orden de la cola lo ponía igual arriba —
-- de hecho el llenado desde el SII ordenaba por número de trabajadores
-- descendente, o sea poniendo PRIMERO justo a las empresas que tienen
-- recepcionista.
--
-- Esto convierte esa observación en un número por el que se puede ordenar.
--
-- NO reemplaza a `contactabilidad`: la responde otra pregunta. Contactabilidad
-- dice "¿tengo con qué llamar?"; alcance dice "¿me va a contestar el que
-- decide?". La cola de llamadas debe ordenar por la segunda.
--
-- Ejecutar en: Supabase > SQL Editor. Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. DE DÓNDE SALIÓ EL NÚMERO
-- ---------------------------------------------------------------------------
-- Sin esto no se puede responder "¿los números de Apollo sirven o están
-- viejos?" más que con intuición. Guardar el origen del número que se marca
-- es lo que permite, después de una semana de llamadas, comparar fuentes con
-- datos: cuántas conexiones dio cada una.
--
-- Va como texto libre a propósito: las fuentes van a cambiar y un CHECK
-- obligaría a una migración cada vez que aparezca una nueva.
alter table public.leads_foco
  add column if not exists origen_telefono text not null default '';

comment on column public.leads_foco.origen_telefono is
  'De dónde salió el teléfono principal: apollo, places, cascada, sii, a mano… Sirve para medir qué fuente produce números que contestan.';

-- ---------------------------------------------------------------------------
-- 2. ALCANCE
-- ---------------------------------------------------------------------------
--   4 · celular + sabemos por quién preguntar   → lo mejor que hay
--   3 · celular, sin nombre                     → contesta el dueño igual
--   2 · fijo + nombre                           → hay que pasar la recepción,
--                                                 pero se puede pedir por él
--   1 · fijo, sin nombre                        → "con el encargado, por favor"
--   0 · sin teléfono                            → no es llamable
--
-- El celular pesa MÁS que el nombre a propósito: tener el nombre no sirve de
-- nada si el que contesta está para no pasarte. Medido en terreno el 4-sep.
--
-- La normalización (sacar +56, espacios, guiones) va acá adentro porque es
-- una columna generada: se recalcula sola cada vez que cambia el teléfono, y
-- nunca puede quedar desincronizada con el dato.
alter table public.leads_foco
  add column if not exists alcance smallint generated always as (
    case
      when coalesce(telefono, '') = '' then 0
      -- Se miran los PRIMEROS nueve dígitos, no el largo exacto: en la base
      -- hay números como "+56 9 8765 4321 anexo 12". Exigiendo largo exacto,
      -- un celular bueno quedaba clasificado como fijo y se hundía en la cola
      -- por una anotación al lado. Mismo criterio que `lib/alcance.ts`.
      when length(
             case
               when left(regexp_replace(telefono, '[^0-9]', '', 'g'), 2) = '56'
                 then substr(regexp_replace(telefono, '[^0-9]', '', 'g'), 3)
               else regexp_replace(telefono, '[^0-9]', '', 'g')
             end
           ) >= 9
       and left(
             case
               when left(regexp_replace(telefono, '[^0-9]', '', 'g'), 2) = '56'
                 then substr(regexp_replace(telefono, '[^0-9]', '', 'g'), 3)
               else regexp_replace(telefono, '[^0-9]', '', 'g')
             end, 9
           ) ~ '^9[0-9]{8}$'
        then case when coalesce(contacto, '') <> '' then 4 else 3 end
      else case when coalesce(contacto, '') <> '' then 2 else 1 end
    end
  ) stored;

comment on column public.leads_foco.alcance is
  '0-4: probabilidad de que conteste quien decide. Celular publicado = contesta el dueño; fijo = mesón. Ordenar la cola por esto, no por tamaño de empresa.';

-- ---------------------------------------------------------------------------
-- 3. EL ÍNDICE DE LA COLA
-- ---------------------------------------------------------------------------
-- El de la 021 ordenaba por (contactabilidad, intentos, n_empleados desc).
-- Ese `n_empleados desc` es literalmente la instrucción "llama primero a las
-- empresas más grandes", que es lo que puso la recepción arriba. Este índice
-- lo reemplaza para la cola real; el viejo se queda porque otras vistas
-- todavía lo usan.
create index if not exists leads_foco_alcance_idx
  on public.leads_foco (alcance desc, encaje_rank desc, intentos, sin_contestar);

commit;
