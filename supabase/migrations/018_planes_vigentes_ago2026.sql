-- 018 — Planes comerciales vigentes (tabla aprobada el 12-ago-2026)
--
-- Reemplaza el esquema de julio ('esencial','cotizador','pro' con setup +
-- mensualidad) por los 3 planes de paquete vigentes, con instalación gratis.
--
--   inicial     $149.990/mes neto · 1.200 conversaciones · excedente $80/conv
--   crecimiento $269.990/mes neto · 3.000 conversaciones · excedente $60/conv
--   empresa     $449.990/mes neto · 6.000 conversaciones · excedente $50/conv
--
-- Todos los montos son NETOS, más IVA (decisión del 14-ago-2026).
-- "Tino solo" ($120.000) queda fuera del CRM a propósito: es una venta
-- distinta que no pasa por pipeline.
--
-- Seguro de correr: al 19-ago-2026 `deals` y `clients` están vacías, así que
-- no hay filas que reasignar. El UPDATE de abajo queda igual por si alguien
-- alcanzó a cargar algo entre medio.

begin;

-- 1. Soltar los CHECK viejos antes de tocar los datos.
--    Se buscan por catálogo en vez de por nombre: si alguien creó el
--    constraint a mano puede llamarse distinto de `deals_plan_check`, y un
--    `drop if exists` con el nombre equivocado no falla — simplemente no
--    borra nada, y después el INSERT sigue rebotando sin explicación.
do $$
declare c record;
begin
  for c in
    select rel.relname as tabla, con.conname as nombre
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname in ('deals','clients')
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%plan%'
  loop
    execute format('alter table public.%I drop constraint %I', c.tabla, c.nombre);
    raise notice 'constraint soltado: %.%', c.tabla, c.nombre;
  end loop;
end $$;

-- 2. Reasignar cualquier fila que haya quedado con las claves antiguas.
--    esencial → inicial · cotizador → crecimiento · pro → empresa
update deals set plan = case plan
  when 'esencial'  then 'inicial'
  when 'cotizador' then 'crecimiento'
  when 'pro'       then 'empresa'
  else plan end
where plan in ('esencial','cotizador','pro');

update clients set plan = case plan
  when 'esencial'  then 'inicial'
  when 'cotizador' then 'crecimiento'
  when 'pro'       then 'empresa'
  else plan end
where plan in ('esencial','cotizador','pro');

-- 3. Nuevo default y nuevo CHECK.
alter table deals   alter column plan set default 'crecimiento';
alter table clients alter column plan set default 'crecimiento';

alter table deals
  add constraint deals_plan_check check (plan in ('inicial','crecimiento','empresa'));
alter table clients
  add constraint clients_plan_check check (plan in ('inicial','crecimiento','empresa'));

commit;
