-- 023 — Retiro automático por no contestar (regla TGP)
--
-- Referencia directa del equipo de TGP: cuando un número no contesta 3 veces,
-- se saca de la base. Sin esta regla, un "no contesta" reagendaba para siempre
-- y la cola se llenaba de números muertos que nadie se atrevía a borrar.
--
-- Se cuenta APARTE de `intentos`: intentos suma todos los toques (incluido
-- hablar con el portero), y llegar al portero prueba que el número FUNCIONA.
-- Lo que retira es el número que nunca levanta nadie. Por eso el contador se
-- reinicia cada vez que alguien contesta, aunque sea el portero.

begin;

alter table leads_foco
  add column if not exists sin_contestar smallint not null default 0;

commit;
