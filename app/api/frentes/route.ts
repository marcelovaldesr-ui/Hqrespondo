import { NextRequest, NextResponse } from "next/server";
import { evaluarAutenticacionHq } from "@/lib/auth/hqAuth";
import { db } from "@/lib/db";
import { listFronts } from "@/lib/frentes/store";
import { Front, saveFront } from "@/lib/frentes/model";
export const dynamic = "force-dynamic";
function auth(req: NextRequest) {
  return evaluarAutenticacionHq({
    pathname: "/api/frentes",
    authHeader: req.headers.get("authorization"),
  });
}
export async function GET(req: NextRequest) {
  const access = auth(req);
  if (!access.allowed)
    return NextResponse.json(
      { error: "Acceso denegado" },
      { status: access.status },
    );
  try {
    return NextResponse.json(await listFronts());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
}
export async function POST(req: NextRequest) {
  const access = auth(req);
  if (!access.allowed)
    return NextResponse.json(
      { error: "Acceso denegado" },
      { status: access.status },
    );
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin)
    return NextResponse.json({ error: "Origen inválido" }, { status: 403 });
  try {
    const { front, note, expected } = await req.json();
    let previous: Front | null = null;
    if (front?.id) {
      const result = await db()
        .from("hq_fronts")
        .select("document")
        .eq("id", front.id)
        .single();
      if (result.error)
        return NextResponse.json(
          { error: "No se pudo cargar el frente" },
          { status: 404 },
        );
      previous = result.data.document;
      if (previous?.updated_at !== expected)
        return NextResponse.json(
          {
            error:
              "Otra persona actualizó el frente. Recarga antes de guardar.",
          },
          { status: 409 },
        );
    }
    const saved = saveFront(front, previous, access.user ?? "HQ", note);
    const query = previous
      ? db()
          .from("hq_fronts")
          .update({ document: saved })
          .eq("id", saved.id)
          .eq("document->>updated_at", expected)
          .select("id")
      : db()
          .from("hq_fronts")
          .insert({ id: saved.id, document: saved })
          .select("id");
    const result = await query;
    if (result.error)
      return NextResponse.json(
        {
          error: "No se pudo guardar. Verifica la conexión y la migración 044.",
        },
        { status: 503 },
      );
    if (!result.data?.length)
      return NextResponse.json(
        { error: "Conflicto de actualización. Recarga el frente." },
        { status: 409 },
      );
    return NextResponse.json(saved);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
