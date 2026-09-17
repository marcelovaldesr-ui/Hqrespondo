import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  emptyFront,
  saveFront,
  validate,
  summary,
  staleDays,
  progress,
} from "../../lib/frentes/model";
const start = "2026-09-01T12:00:00.000Z";
const create = () =>
  saveFront(
    {
      ...emptyFront(),
      nombre: "Frente",
      objetivo: "Objetivo",
      proxima_accion: "Validar",
    },
    null,
    "Marcelo",
    "Creado",
    start,
  );
test("crear: id y fechas de servidor, sin historial inyectado", () => {
  const f = create();
  assert.ok(f.id);
  assert.equal(f.created_at, start);
  assert.equal(f.updates.length, 1);
});
test("actualizar conserva historial y snapshot, no acepta autor ni fechas del cliente", () => {
  const f = create();
  const updated = saveFront(
    { ...f, fase: "Validación", updates: [], created_at: "fake" },
    f,
    "Owner",
    "Cambio",
    "2026-09-02T00:00:00Z",
  );
  assert.equal(updated.updates.length, 2);
  assert.equal(updated.updates[1].anterior?.fase, "");
  assert.equal(updated.created_at, start);
});
test("cerrar conserva historia, reabrir manualmente limpia cerrado_at", () => {
  const f = create();
  const closed = saveFront(
    { ...f, estado: "CERRADO" },
    f,
    "Owner",
    "Cierre",
    start,
  );
  assert.equal(closed.cerrado_at, start);
  const reopened = saveFront(
    { ...closed, estado: "DISCOVERY" },
    closed,
    "Owner",
    "Reapertura",
  );
  assert.equal(reopened.cerrado_at, null);
  assert.equal(reopened.updates.length, 3);
});
test("hitos derivan progreso; sin hitos no hay porcentaje", () => {
  const f = create();
  assert.equal(progress(f), null);
  f.hitos = [
    { nombre: "Uno", completado_at: start },
    { nombre: "Dos", completado_at: null },
  ];
  assert.deepEqual(progress(f), { done: 1, total: 2 });
});
test("stale: exactamente 7 días no alerta, 8 sí; cerrado y backlog excluidos", () => {
  const f = create();
  const day = 86400000;
  assert.equal(summary([f], Date.parse(start) + 7 * day).stale, 0);
  assert.equal(staleDays(f, Date.parse(start) + 8 * day), 8);
  assert.equal(summary([f], Date.parse(start) + 8 * day).stale, 1);
  assert.equal(
    staleDays({ ...f, estado: "CERRADO" }, Date.parse(start) + 9 * day),
    0,
  );
  assert.equal(summary([{ ...f, estado: "BACKLOG" }]).active.length, 0);
});
test("validaciones rechazan valores arbitrarios, próxima acción vacía y referencias ejecutables", () => {
  const f = create();
  for (const patch of [
    { estado: "ACTIVO" },
    { salud: "OK" },
    { prioridad: "P3" },
    { proxima_accion: " " },
    { hitos: [{ nombre: "" }] },
    { links: [{ label: "X", reference: "javascript:alert(1)" }] },
    { fecha_objetivo: "2026-02-30" },
  ])
    assert.throws(() => validate({ ...f, ...patch }));
  assert.throws(() => saveFront(f, f, "Owner", ""));
});
test("resumen cuenta bloqueos una vez y excluye owner actions cerradas", () => {
  const f = {
    ...create(),
    salud: "BLOQUEADO" as const,
    estado: "BLOQUEADO" as const,
    owner_action: "Aprobar",
  };
  const s = summary([f, { ...f, estado: "CERRADO" }]);
  assert.equal(s.blocked, 1);
  assert.equal(s.owner.length, 1);
  assert.equal(s.active.length, 1);
});
test("seed tiene 3 activos, 6 archivados, ids estables e inicialización idempotente", () => {
  const sql = fs.readFileSync(
    "supabase/migrations/044_strategic_fronts.sql",
    "utf8",
  );
  const rows = [
    ...sql.matchAll(/, '(\{.*\})'::jsonb\) on conflict \(id\) do nothing;/g),
  ].map((m) => JSON.parse(m[1]));
  assert.equal(rows.length, 9);
  assert.equal(new Set(rows.map((f) => f.id)).size, 9);
  assert.equal(summary(rows).active.length, 3);
  assert.equal(rows.filter((f) => f.estado === "CERRADO").length, 6);
  rows.forEach(validate);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all.*anon, authenticated/);
});
