-- 029 — Guardar el nombre completo que regala Google Maps.
--
-- Hallazgo del 25-ago-2026, en la primera corrida real de la cascada. Places
-- encontró la ficha propia de un dentista de Maipú y devolvió esto:
--
--     lo que teníamos:   "Jorge Bellolio"
--     lo que trajo Maps: "Jorge Adolfo Bellolio Messer"
--
-- El nombre que sacamos de la razón social del SII viene truncado: se pierde
-- el primer nombre ("Johnatan Eduardo Trujillo" quedó como "Eduardo Trujillo")
-- o parte del apellido compuesto ("Fernando Emilio Costa del Rio" perdió el
-- "del Rio"). Estábamos botando la versión completa.
--
-- Sirve dos veces: para pedir por la persona correcta cuando se llama, y para
-- que las búsquedas siguientes sobre esa empresa sean más precisas.
--
-- No pisa `decisor_nombre` a propósito: ese campo tiene su propia procedencia
-- (la razón social del SII) y mezclarlas haría imposible responder de dónde
-- salió cada dato — que es lo que pide la Ley 21.719 desde el 1-dic-2026.

begin;

alter table public.empresas_sii
  add column if not exists decisor_nombre_completo        text,
  add column if not exists decisor_nombre_completo_origen text;

comment on column public.empresas_sii.decisor_nombre_completo is
  'Nombre completo tal como aparece en una fuente pública (por ahora, la ficha propia en Google Maps). Complementa decisor_nombre, no lo reemplaza.';

commit;
