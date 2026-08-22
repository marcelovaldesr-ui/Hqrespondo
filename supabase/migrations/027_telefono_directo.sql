-- 027 — Guardar el teléfono DIRECTO aparte del público.
--
-- El teléfono que trae Google Maps es la línea de entrada del negocio. Cuando
-- el agente encuentra uno distinto —la ficha propia del profesional, o un
-- número junto a su nombre en el sitio— ese es otro dato y merece su propia
-- columna: pisar el público perdería la puerta de entrada, que igual sirve.

begin;
alter table public.empresas_sii
  add column if not exists telefono_directo        text,
  add column if not exists telefono_directo_origen text;
create index if not exists empresas_sii_directo_idx
  on public.empresas_sii (rut) where telefono_directo is not null;
commit;
