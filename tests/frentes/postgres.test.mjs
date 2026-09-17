import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// Local disposable PostgreSQL only: never read production connection variables.
import EmbeddedPostgres from "embedded-postgres";
import { emptyFront, saveFront } from "../../lib/frentes/model.ts";
test("PostgreSQL: migration twice, privileges, persisted lifecycle and concurrent update", async () => {
  const server = new EmbeddedPostgres({
    port: 54341,
    databaseDir: fs.mkdtempSync(path.join(os.tmpdir(), "hq-fronts-")),
    persistent: false,
    onLog: () => {},
  });
  let client;
  try {
    await server.initialise();
    await server.start();
    client = server.getPgClient();
    await client.connect();
    await client.query(
      "create role anon; create role authenticated; create role service_role;",
    );
    const sql = fs.readFileSync(
      "supabase/migrations/044_strategic_fronts.sql",
      "utf8",
    );
    await client.query(sql);
    await client.query(sql);
    assert.equal(
      (await client.query("select count(*)::int as n from hq_fronts")).rows[0]
        .n,
      9,
    );
    assert.equal(
      (
        await client.query(
          "select has_table_privilege('anon','hq_fronts','SELECT') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
    const f = saveFront(
      {
        ...emptyFront(),
        nombre: "Prueba",
        objetivo: "Validar persistencia",
        proxima_accion: "Revisar",
      },
      null,
      "QA",
      "Creado",
      "2026-09-01T00:00:00Z",
    );
    await client.query("insert into hq_fronts(id,document) values($1,$2)", [
      f.id,
      f,
    ]);
    const closed = saveFront(
      { ...f, estado: "CERRADO" },
      f,
      "QA",
      "Cierre",
      "2026-09-02T00:00:00Z",
    );
    const update = () =>
      client.query(
        "update hq_fronts set document=$1 where id=$2 and document->>'updated_at'=$3 returning id",
        [closed, f.id, f.updated_at],
      );
    const a = await update(),
      b = await update();
    assert.equal(a.rowCount, 1);
    assert.equal(b.rowCount, 0);
    const reopened = saveFront(
      {
        ...closed,
        estado: "VALIDACION",
        hitos: [{ nombre: "Validado", completado_at: "2026-09-03T00:00:00Z" }],
      },
      closed,
      "QA",
      "Reabierto",
    );
    await client.query("update hq_fronts set document=$1 where id=$2", [
      reopened,
      f.id,
    ]);
    const read = (
      await client.query("select document from hq_fronts where id=$1", [f.id])
    ).rows[0].document;
    assert.equal(read.updates.length, 3);
    assert.equal(read.cerrado_at, null);
    assert.ok(read.hitos[0].completado_at);
  } finally {
    if (client) await client.end();
    await server.stop();
  }
});
