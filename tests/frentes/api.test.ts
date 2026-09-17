import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST } from "../../app/api/frentes/route";
import { emptyFront, saveFront } from "../../lib/frentes/model";
test("API: auth, CSRF, create, update and optimistic conflict against mocked Supabase transport", async () => {
  const originalFetch = globalThis.fetch;
  const keys = [
    "HQ_USER",
    "HQ_PASSWORD",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    HQ_USER: "qa",
    HQ_PASSWORD: "test-only",
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "test-only",
  });
  const headers = {
    authorization: "Basic " + Buffer.from("qa:test-only").toString("base64"),
    "content-type": "application/json",
    origin: "http://localhost",
  };
  let stored = saveFront(
    {
      ...emptyFront(),
      nombre: "API",
      objetivo: "Validar",
      proxima_accion: "Revisar",
    },
    null,
    "QA",
    "Creado",
  );
  let conflict = false;
  globalThis.fetch = async (input, init) => {
    assert.ok(
      String(input).startsWith("http://127.0.0.1:54321/rest/v1/hq_fronts"),
    );
    if (init?.method === "POST" || init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      stored = body.document;
      return new Response(JSON.stringify(conflict ? [] : [{ id: stored.id }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ document: stored }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const request = (body: unknown, extra = {}) =>
    new NextRequest("http://localhost/api/frentes", {
      method: "POST",
      headers: { ...headers, ...extra },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await GET(new NextRequest("http://localhost/api/frentes"))).status,
      401,
    );
    assert.equal(
      (await POST(request({}, { origin: "http://attacker.invalid" }))).status,
      403,
    );
    assert.equal(
      (await POST(request({ front: emptyFront(), note: "Crear" }))).status,
      400,
    );
    const created = await POST(
      request({
        front: {
          ...emptyFront(),
          nombre: "Nuevo",
          objetivo: "Objetivo",
          proxima_accion: "Validar",
        },
        note: "Crear",
      }),
    );
    assert.equal(created.status, 200);
    const f = await created.json();
    assert.equal(f.updates[0].autor, "qa");
    assert.equal(
      (
        await POST(
          request({
            front: { ...f, fase: "Prueba" },
            expected: "old",
            note: "Cambiar",
          }),
        )
      ).status,
      409,
    );
    const updated = await POST(
      request({
        front: { ...f, fase: "Prueba" },
        expected: f.updated_at,
        note: "Cambiar",
      }),
    );
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).updates.length, 2);
    conflict = true;
    assert.equal(
      (
        await POST(
          request({
            front: stored,
            expected: stored.updated_at,
            note: "Concurrente",
          }),
        )
      ).status,
      409,
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
